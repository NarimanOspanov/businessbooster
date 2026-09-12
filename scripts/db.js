// Подключение к Azure SQL и таблица звонков.
//
// Строка подключения берётся из переменной SQL_CONNECTION_STRING, а если её
// нет — из файла ~/.azure-sql-connection. В репозиторий она не попадает.
//
//   node scripts/db.js migrate  — создать таблицу, если её нет
//   node scripts/db.js check    — проверить связь и показать, что в таблице
//   node scripts/db.js last     — последние 10 звонков

const fs = require("fs");
const os = require("os");
const path = require("path");
const sql = require("mssql");

const CONN_FILE =
  process.env.SQL_CONNECTION_FILE ||
  path.join(os.homedir(), ".azure-sql-connection");

function connectionString() {
  if (process.env.SQL_CONNECTION_STRING) return process.env.SQL_CONNECTION_STRING.trim();
  try {
    return fs.readFileSync(CONN_FILE, "utf8").trim();
  } catch {
    return null;
  }
}

let poolPromise = null;

// Один пул на процесс. Каждый звонок открывает соединение заново — это
// секунды задержки на вебхуке и быстро упирается в лимит подключений.
function getPool() {
  const conn = connectionString();
  if (!conn) return Promise.reject(new Error("нет строки подключения"));
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(conn)
      .connect()
      .catch((e) => {
        poolPromise = null; // иначе первая же ошибка залипнет навсегда
        throw e;
      });
  }
  return poolPromise;
}

const SCHEMA = `
-- Клиника = организация в Clerk. Звонок принадлежит клинике по номеру, на
-- который позвонили: у каждой он свой, и это единственный признак, известный
-- ещё до того, как кто-то что-то сказал.
IF OBJECT_ID('dbo.clinics', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.clinics (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    org_id           NVARCHAR(64)  NOT NULL,
    name             NVARCHAR(200) NOT NULL,
    created_at       DATETIME2(0)  NOT NULL CONSTRAINT DF_clinics_created DEFAULT SYSUTCDATETIME(),
    phone_number_id  NVARCHAR(64)  NULL,
    agent_id         NVARCHAR(64)  NULL,
    public_number    NVARCHAR(32)  NULL,
    telegram_chat_id NVARCHAR(64)  NULL,
    is_active        BIT           NOT NULL CONSTRAINT DF_clinics_active DEFAULT 1
  );
  CREATE UNIQUE INDEX UX_clinics_org ON dbo.clinics (org_id);
  -- Номер закреплён за одной клиникой: два владельца у одного номера
  -- означают чужие записи в чужом кабинете.
  CREATE UNIQUE INDEX UX_clinics_phone ON dbo.clinics (phone_number_id)
    WHERE phone_number_id IS NOT NULL;
END

IF OBJECT_ID('dbo.calls', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.calls (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    conversation_id  NVARCHAR(64)  NOT NULL,
    received_at      DATETIME2(0)  NOT NULL CONSTRAINT DF_calls_received DEFAULT SYSUTCDATETIME(),
    agent_id         NVARCHAR(64)  NULL,
    caller_number    NVARCHAR(32)  NULL,
    duration_secs    INT           NOT NULL CONSTRAINT DF_calls_dur DEFAULT 0,
    client_name      NVARCHAR(120) NULL,
    client_phone     NVARCHAR(32)  NULL,
    service          NVARCHAR(200) NULL,
    desired_time     NVARCHAR(120) NULL,
    is_booked        BIT           NOT NULL CONSTRAINT DF_calls_booked DEFAULT 0,
    is_urgent        BIT           NOT NULL CONSTRAINT DF_calls_urgent DEFAULT 0,
    summary          NVARCHAR(MAX) NULL,
    transcript       NVARCHAR(MAX) NULL,
    raw              NVARCHAR(MAX) NULL
  );
  -- Один разговор — одна строка. ElevenLabs повторяет вебхук при сбое,
  -- без этого повтор создал бы дубль записи у клиники.
  CREATE UNIQUE INDEX UX_calls_conversation ON dbo.calls (conversation_id);
  CREATE INDEX IX_calls_received ON dbo.calls (received_at DESC);
  CREATE INDEX IX_calls_urgent ON dbo.calls (is_urgent) WHERE is_urgent = 1;
END

-- Добавляем по одной: таблица уже с данными, пересоздавать её нельзя.
IF COL_LENGTH('dbo.calls', 'clinic_id') IS NULL
  ALTER TABLE dbo.calls ADD clinic_id INT NULL;
IF COL_LENGTH('dbo.calls', 'phone_number_id') IS NULL
  ALTER TABLE dbo.calls ADD phone_number_id NVARCHAR(64) NULL;
IF COL_LENGTH('dbo.calls', 'agent_number') IS NULL
  ALTER TABLE dbo.calls ADD agent_number NVARCHAR(32) NULL;
IF COL_LENGTH('dbo.calls', 'direction') IS NULL
  ALTER TABLE dbo.calls ADD direction NVARCHAR(16) NULL;

-- Анкета клиники: из неё собирается промпт агента. Держим целиком в JSON —
-- набор полей ещё будет меняться после первых клиник, и каждое изменение не
-- должно быть миграцией таблицы.
IF COL_LENGTH('dbo.clinics', 'profile_json') IS NULL
  ALTER TABLE dbo.clinics ADD profile_json NVARCHAR(MAX) NULL;
-- Когда анкету последний раз переносили в агента. Если пусто или старее
-- правки анкеты — клиника видит, что изменения ещё не в работе.
IF COL_LENGTH('dbo.clinics', 'profile_saved_at') IS NULL
  ALTER TABLE dbo.clinics ADD profile_saved_at DATETIME2(0) NULL;
IF COL_LENGTH('dbo.clinics', 'agent_built_at') IS NULL
  ALTER TABLE dbo.clinics ADD agent_built_at DATETIME2(0) NULL;

-- Какие звонки можно показывать на витрине со звуком. По умолчанию НИ ОДИН:
-- демо-номер публичный, на него звонят посторонние, и их голос обезличить
-- нельзя — в отличие от номера и имени. Отметку ставим руками, для своих
-- проверочных звонков.
IF COL_LENGTH('dbo.calls', 'demo_public') IS NULL
  ALTER TABLE dbo.calls ADD demo_public BIT NOT NULL CONSTRAINT DF_calls_demo_public DEFAULT 0;

-- Ключ, по которому ассистент клиники обращается к нашему посреднику за её
-- расписанием. Лежит в конфигурации агента, а не на странице: по нему мы
-- узнаём клинику, не принимая её идентификатор из запроса.
IF COL_LENGTH('dbo.clinics', 'tool_key') IS NULL
  ALTER TABLE dbo.clinics ADD tool_key NVARCHAR(64) NULL;

-- Пул номеров. Номер у Zadarma активируется до двух рабочих дней, поэтому
-- купить его в момент онбординга нельзя: клиника нажала «выбрать», а номер
-- двое суток отвечает автоответчиком. Держим запас заранее и выдаём готовые.
IF OBJECT_ID('dbo.numbers', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.numbers (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    number          NVARCHAR(32)  NOT NULL,
    provider        NVARCHAR(32)  NOT NULL CONSTRAINT DF_numbers_provider DEFAULT 'zadarma',
    -- preparing: куплен, но ещё не проведён через настройку или не активирован
    -- free: готов к выдаче | assigned: за клиникой | retired: отключён
    status          NVARCHAR(16)  NOT NULL CONSTRAINT DF_numbers_status DEFAULT 'preparing',
    phone_number_id NVARCHAR(64)  NULL,
    pbx_extension   NVARCHAR(32)  NULL,
    clinic_id       INT           NULL,
    note            NVARCHAR(200) NULL,
    created_at      DATETIME2(0)  NOT NULL CONSTRAINT DF_numbers_created DEFAULT SYSUTCDATETIME(),
    assigned_at     DATETIME2(0)  NULL
  );
  CREATE UNIQUE INDEX UX_numbers_number ON dbo.numbers (number);
  -- Тот же запрет, что и у клиник: один номер в ElevenLabs не может стоять за
  -- двумя строками, иначе звонок достанется не той клинике.
  CREATE UNIQUE INDEX UX_numbers_phone_id ON dbo.numbers (phone_number_id)
    WHERE phone_number_id IS NOT NULL;
  CREATE INDEX IX_numbers_status ON dbo.numbers (status);
END

-- Сессия шлюза WhatsApp у этой клиники. Отдельной колонкой, а не в анкете:
-- анкета чистится по списку известных полей, и сессия пропала бы при первом
-- же сохранении формы.
IF COL_LENGTH('dbo.clinics', 'wa_session') IS NULL
  ALTER TABLE dbo.clinics ADD wa_session NVARCHAR(64) NULL;

-- Сырые события от АТС Zadarma. Нужны, чтобы понять, приходит ли номер, с
-- которого сделана переадресация: по SIP до нас доезжает только звонящий.
-- Поля храним целиком в JSON — мы как раз ищем поле, названия которого не знаем.
IF OBJECT_ID('dbo.zadarma_events', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.zadarma_events (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    received_at DATETIME2(0)  NOT NULL CONSTRAINT DF_zde_at DEFAULT SYSUTCDATETIME(),
    event       NVARCHAR(64)  NULL,
    fields      NVARCHAR(MAX) NULL
  );
  CREATE INDEX IX_zde_at ON dbo.zadarma_events (received_at DESC);
END
`;

// Выборки в кабинете всегда «звонки моей клиники за период», поэтому индекс
// --- Крыша --------------------------------------------------------------
//
// Ежедневный слепок квартир, которые хозяева выставили на продажу. Смысл в
// покрытии: спросят про квартиру, которой в базе нет, и ответить будет нечем.
//
// Три таблицы вместо одной, потому что у данных разный срок жизни. Параметры
// квартиры живут вечно и нужны для поиска. Телефон хозяина — персональные
// данные: его удаляют по требованию человека, отдельно от всего остального.
// Снимок карточки тяжёлый и нужен только тем квартирам, что мы показываем.
const SCHEMA_KRISHA = `
IF OBJECT_ID('dbo.krisha_flats', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.krisha_flats (
    id          BIGINT        NOT NULL PRIMARY KEY,   -- номер объявления на Крыше
    city        NVARCHAR(40)  NULL,
    rooms       INT           NULL,
    -- Площадь с сотыми: «52.13 м², 6 из 9, Жетысуский» на весь город одна.
    -- Это и есть ключ, по которому квартира узнаётся в объявлении агента.
    area        DECIMAL(7,2)  NULL,
    floor       INT           NULL,
    floors      INT           NULL,
    build_year  INT           NULL,
    house       NVARCHAR(60)  NULL,
    complex     NVARCHAR(160) NULL,
    cond        NVARCHAR(80)  NULL,
    district    NVARCHAR(100) NULL,
    price       BIGINT        NULL,
    addr        NVARCHAR(300) NULL,
    title       NVARCHAR(300) NULL,
    photos      INT           NULL,
    photo1      NVARCHAR(300) NULL,
    posted_on   DATE          NULL,                   -- дата публикации на Крыше
    first_seen  DATETIME2(0)  NOT NULL CONSTRAINT DF_kflats_first DEFAULT SYSUTCDATETIME(),
    last_seen   DATETIME2(0)  NOT NULL CONSTRAINT DF_kflats_last  DEFAULT SYSUTCDATETIME()
  );
  -- Поиск всегда начинается с площади, остальное сужает.
  CREATE INDEX IX_kflats_area ON dbo.krisha_flats (area, rooms, floor);
  CREATE INDEX IX_kflats_posted ON dbo.krisha_flats (posted_on DESC);
END

IF OBJECT_ID('dbo.krisha_phones', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.krisha_phones (
    flat_id  BIGINT       NOT NULL,
    phone    NVARCHAR(20) NOT NULL,                   -- только цифры, 7XXXXXXXXXX
    got_at   DATETIME2(0) NOT NULL CONSTRAINT DF_kphones_got DEFAULT SYSUTCDATETIME(),
    source   NVARCHAR(20) NULL,                       -- script | manual
    CONSTRAINT PK_krisha_phones PRIMARY KEY (flat_id, phone)
  );
END

IF OBJECT_ID('dbo.krisha_cards', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.krisha_cards (
    flat_id   BIGINT        NOT NULL PRIMARY KEY,
    card_json NVARCHAR(MAX) NOT NULL,                 -- фото, описание, характеристики
    taken_at  DATETIME2(0)  NOT NULL CONSTRAINT DF_kcards_taken DEFAULT SYSUTCDATETIME()
  );
END

-- Папка снимков на CDN Крыши: у объявления она одна и постоянная, а имена
-- файлов — просто номера. Зная папку, всю галерею можно собрать перебором, не
-- открывая объявление. Номера при этом не вечные: если хозяин перезаливает
-- фотографии, старые умирают, а новые продолжают нумерацию дальше — проверено
-- на объявлении, у которого снимки 2–8 за сутки стали 9–15.
IF COL_LENGTH('dbo.krisha_flats', 'photo_dir') IS NULL
  ALTER TABLE dbo.krisha_flats ADD photo_dir NVARCHAR(120) NULL;

-- Микрорайон: в Алматы и Астане это привычнее улицы, спрашивают «что есть в
-- Коктеме». Указан у трети адресов, поэтому отдельной колонкой, а не разбором
-- строки на каждый запрос.
IF COL_LENGTH('dbo.krisha_flats', 'mkr') IS NULL
  ALTER TABLE dbo.krisha_flats ADD mkr NVARCHAR(80) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_kflats_place' AND object_id = OBJECT_ID('dbo.krisha_flats'))
  CREATE INDEX IX_kflats_place ON dbo.krisha_flats (city, district, mkr);

-- Подробности со страницы объявления. Площадь кухни и высота потолков — сильные
-- различители: агент, перевыкладывая, их не переписывает. «Бывшее общежитие»
-- резко меняет цену. is_agent — оценка самой Крыши, и она расходится с
-- галочкой «от хозяина», которую ставит продавец.
IF COL_LENGTH('dbo.krisha_flats', 'kitchen') IS NULL
  ALTER TABLE dbo.krisha_flats ADD kitchen DECIMAL(6,2) NULL;
IF COL_LENGTH('dbo.krisha_flats', 'ceiling') IS NULL
  ALTER TABLE dbo.krisha_flats ADD ceiling DECIMAL(4,2) NULL;
IF COL_LENGTH('dbo.krisha_flats', 'toilet') IS NULL
  ALTER TABLE dbo.krisha_flats ADD toilet NVARCHAR(40) NULL;
IF COL_LENGTH('dbo.krisha_flats', 'balcony') IS NULL
  ALTER TABLE dbo.krisha_flats ADD balcony NVARCHAR(60) NULL;
IF COL_LENGTH('dbo.krisha_flats', 'parking') IS NULL
  ALTER TABLE dbo.krisha_flats ADD parking NVARCHAR(60) NULL;
IF COL_LENGTH('dbo.krisha_flats', 'dorm') IS NULL
  ALTER TABLE dbo.krisha_flats ADD dorm BIT NULL;
IF COL_LENGTH('dbo.krisha_flats', 'furnished') IS NULL
  ALTER TABLE dbo.krisha_flats ADD furnished BIT NULL;
IF COL_LENGTH('dbo.krisha_flats', 'is_agent') IS NULL
  ALTER TABLE dbo.krisha_flats ADD is_agent BIT NULL;

-- Объявления, которые Крыша не отдала: в «сегодняшних» они больше не всплывут,
-- поэтому досниаются в начале следующих прогонов.
IF OBJECT_ID('dbo.krisha_pending', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.krisha_pending (
    flat_id  BIGINT       NOT NULL PRIMARY KEY,
    city     NVARCHAR(40) NULL,
    tries    INT          NOT NULL CONSTRAINT DF_kpend_tries DEFAULT 1,
    last_try DATETIME2(0) NOT NULL CONSTRAINT DF_kpend_last  DEFAULT SYSUTCDATETIME()
  );
END
`;

// составной: по одному clinic_id база всё равно пошла бы сортировать.
const SCHEMA_INDEXES = `
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_calls_clinic' AND object_id = OBJECT_ID('dbo.calls'))
  CREATE INDEX IX_calls_clinic ON dbo.calls (clinic_id, received_at DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_clinics_tool_key')
  CREATE UNIQUE INDEX UX_clinics_tool_key ON dbo.clinics (tool_key) WHERE tool_key IS NOT NULL;
`;

async function migrate() {
  const pool = await getPool();
  await pool.request().batch(SCHEMA);
  await pool.request().batch(SCHEMA_KRISHA);
  await pool.request().batch(SCHEMA_INDEXES); // после ALTER: колонки должны уже быть
  const r = await pool.request().query(
    "SELECT (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.calls')) AS calls_cols," +
    " (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.clinics')) AS clinics_cols"
  );
  const x = r.recordset[0];
  console.log("dbo.calls колонок:", x.calls_cols, "| dbo.clinics колонок:", x.clinics_cols);
}

// Звонок принадлежит клинике по номеру, на который позвонили. Если номер ещё
// не закреплён — пробуем по агенту. Не нашли — оставляем без клиники: лучше
// осиротевшая строка, чем чужие записи в чужом кабинете.
async function clinicIdForCall({ phone_number_id, agent_id }) {
  const pool = await getPool();
  if (phone_number_id) {
    const r = await pool
      .request()
      .input("p", sql.NVarChar(64), phone_number_id)
      .query("SELECT TOP 1 id FROM dbo.clinics WHERE phone_number_id = @p AND is_active = 1");
    if (r.recordset.length) return r.recordset[0].id;
  }
  if (agent_id) {
    const r = await pool
      .request()
      .input("a", sql.NVarChar(64), agent_id)
      .query("SELECT TOP 1 id FROM dbo.clinics WHERE agent_id = @a AND is_active = 1");
    if (r.recordset.length) return r.recordset[0].id;
  }
  return null;
}

// Весь список — для кабинета агента, который ведёт чужие клиники. Кабинет
// самой клиники этим не пользуется: там выборка идёт строго по организациям.
async function listClinics() {
  const pool = await getPool();
  const r = await pool.request().query(
    "SELECT id, org_id, name, agent_id, phone_number_id, public_number, is_active, created_at, " +
    "  CASE WHEN profile_json IS NULL OR profile_json = '' THEN 0 ELSE 1 END AS has_profile " +
    "FROM dbo.clinics ORDER BY id DESC"
  );
  return r.recordset;
}

// Клиника заводится один раз на организацию Clerk и потом только обновляется.
async function upsertClinic(c) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("org_id", sql.NVarChar(64), c.org_id)
    .input("name", sql.NVarChar(200), c.name || "")
    .input("phone_number_id", sql.NVarChar(64), c.phone_number_id || null)
    .input("agent_id", sql.NVarChar(64), c.agent_id || null)
    .input("public_number", sql.NVarChar(32), c.public_number || null)
    .input("telegram_chat_id", sql.NVarChar(64), c.telegram_chat_id || null)
    .query(`
      MERGE dbo.clinics AS t
      USING (SELECT @org_id AS org_id) AS s ON t.org_id = s.org_id
      WHEN MATCHED THEN UPDATE SET
        name = @name, phone_number_id = @phone_number_id, agent_id = @agent_id,
        public_number = @public_number, telegram_chat_id = @telegram_chat_id
      WHEN NOT MATCHED THEN INSERT
        (org_id, name, phone_number_id, agent_id, public_number, telegram_chat_id)
        VALUES (@org_id, @name, @phone_number_id, @agent_id, @public_number, @telegram_chat_id)
      OUTPUT inserted.id;
    `);
  return r.recordset[0].id;
}

// MERGE, а не INSERT: повторный вебхук по тому же разговору обновит строку,
// а не добавит вторую.
async function saveCall(c) {
  const pool = await getPool();
  await pool
    .request()
    .input("conversation_id", sql.NVarChar(64), c.conversation_id || "")
    .input("agent_id", sql.NVarChar(64), c.agent_id || null)
    .input("caller_number", sql.NVarChar(32), c.caller_number || null)
    .input("clinic_id", sql.Int, c.clinic_id || null)
    .input("phone_number_id", sql.NVarChar(64), c.phone_number_id || null)
    .input("agent_number", sql.NVarChar(32), c.agent_number || null)
    .input("direction", sql.NVarChar(16), c.direction || null)
    .input("duration_secs", sql.Int, c.duration_secs || 0)
    .input("client_name", sql.NVarChar(120), c.client_name || null)
    .input("client_phone", sql.NVarChar(32), c.client_phone || null)
    .input("service", sql.NVarChar(200), c.service || null)
    .input("desired_time", sql.NVarChar(120), c.desired_time || null)
    .input("is_booked", sql.Bit, c.is_booked ? 1 : 0)
    .input("is_urgent", sql.Bit, c.is_urgent ? 1 : 0)
    .input("summary", sql.NVarChar(sql.MAX), c.summary || null)
    .input("transcript", sql.NVarChar(sql.MAX), c.transcript || null)
    .input("raw", sql.NVarChar(sql.MAX), c.raw || null)
    .query(`
      MERGE dbo.calls AS t
      USING (SELECT @conversation_id AS conversation_id) AS s
        ON t.conversation_id = s.conversation_id
      WHEN MATCHED THEN UPDATE SET
        duration_secs = @duration_secs, client_name = @client_name,
        client_phone = @client_phone, service = @service,
        desired_time = @desired_time, is_booked = @is_booked,
        is_urgent = @is_urgent, summary = @summary,
        transcript = @transcript, raw = @raw,
        clinic_id = COALESCE(@clinic_id, t.clinic_id),
        phone_number_id = @phone_number_id, agent_number = @agent_number,
        direction = @direction
      WHEN NOT MATCHED THEN INSERT
        (conversation_id, agent_id, caller_number, duration_secs, client_name,
         client_phone, service, desired_time, is_booked, is_urgent, summary,
         transcript, raw, clinic_id, phone_number_id, agent_number, direction)
        VALUES
        (@conversation_id, @agent_id, @caller_number, @duration_secs, @client_name,
         @client_phone, @service, @desired_time, @is_booked, @is_urgent, @summary,
         @transcript, @raw, @clinic_id, @phone_number_id, @agent_number, @direction);
    `);
}


// Клиники, доступные пользователю: только те, чьи организации Clerk он состоит.
// Список идентификаторов приходит с сервера после проверки токена — из запроса
// его брать нельзя, иначе кабинет открывается по подобранному номеру.
async function clinicsByOrgIds(orgIds) {
  if (!orgIds || !orgIds.length) return [];
  const pool = await getPool();
  const req = pool.request();
  const names = orgIds.map((id, i) => {
    req.input("o" + i, sql.NVarChar(64), id);
    return "@o" + i;
  });
  const r = await req.query(
    "SELECT id, org_id, name, public_number FROM dbo.clinics " +
    "WHERE is_active = 1 AND org_id IN (" + names.join(",") + ")"
  );
  return r.recordset;
}

async function callsForClinics(clinicIds, { limit = 50, offset = 0 } = {}) {
  if (!clinicIds || !clinicIds.length) return [];
  const pool = await getPool();
  const req = pool.request();
  const names = clinicIds.map((id, i) => {
    req.input("c" + i, sql.Int, id);
    return "@c" + i;
  });
  req.input("lim", sql.Int, Math.min(Number(limit) || 50, 200));
  req.input("off", sql.Int, Math.max(Number(offset) || 0, 0));
  const r = await req.query(
    "SELECT id, conversation_id, received_at, duration_secs, direction, " +
    "caller_number, client_name, client_phone, service, desired_time, " +
    "is_booked, is_urgent, summary, clinic_id " +
    "FROM dbo.calls WHERE clinic_id IN (" + names.join(",") + ") " +
    "ORDER BY received_at DESC OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY"
  );
  return r.recordset;
}

// Один звонок с расшифровкой — но только если он принадлежит клинике этого
// пользователя. Проверку владения делаем в самом запросе, а не после.
async function callForClinics(conversationId, clinicIds) {
  if (!clinicIds || !clinicIds.length) return null;
  const pool = await getPool();
  const req = pool.request();
  const names = clinicIds.map((id, i) => {
    req.input("c" + i, sql.Int, id);
    return "@c" + i;
  });
  req.input("conv", sql.NVarChar(64), conversationId);
  const r = await req.query(
    "SELECT TOP 1 conversation_id, received_at, duration_secs, direction, " +
    "caller_number, client_name, client_phone, service, desired_time, " +
    "is_booked, is_urgent, summary, transcript, clinic_id, demo_public " +
    "FROM dbo.calls WHERE conversation_id = @conv AND clinic_id IN (" + names.join(",") + ")"
  );
  return r.recordset[0] || null;
}

// ---------------------------------------------------------------------------
// Анкета клиники и её агент.

async function clinicById(clinicId) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("id", sql.Int, clinicId)
    .query(
      "SELECT TOP 1 id, org_id, name, public_number, phone_number_id, agent_id, " +
      "wa_session, profile_json, profile_saved_at, agent_built_at FROM dbo.clinics WHERE id = @id"
    );
  return r.recordset[0] || null;
}

async function saveClinicProfile(clinicId, profile) {
  const pool = await getPool();
  await pool
    .request()
    .input("id", sql.Int, clinicId)
    .input("json", sql.NVarChar(sql.MAX), JSON.stringify(profile))
    // Название клиники живёт и в анкете, и в колонке: колонку видно в кабинете
    // и в отчётах, и расходиться они не должны.
    .input("name", sql.NVarChar(200), String(profile.name || "").slice(0, 200) || null)
    .query(
      "UPDATE dbo.clinics SET profile_json = @json, profile_saved_at = SYSUTCDATETIME(), " +
      "name = COALESCE(@name, name) WHERE id = @id"
    );
}

async function setClinicAgent(clinicId, agentId) {
  const pool = await getPool();
  await pool
    .request()
    .input("id", sql.Int, clinicId)
    .input("agent", sql.NVarChar(64), agentId)
    .query("UPDATE dbo.clinics SET agent_id = @agent, agent_built_at = SYSUTCDATETIME() WHERE id = @id");
}

// Клиника по ключу инструмента. Ключ приходит от ElevenLabs вместе с вызовом
// инструмента — это единственное, чем звонок себя называет.
async function clinicByToolKey(k) {
  if (!k) return null;
  const pool = await getPool();
  const r = await pool
    .request()
    .input("k", sql.NVarChar(64), String(k))
    .query(
      // Сессия шлюза здесь же: по этому ключу приходит переписка, и отвечать
      // придётся из сессии этой клиники — без неё ответ уходить некуда.
      "SELECT TOP 1 id, name, profile_json, wa_session FROM dbo.clinics " +
      "WHERE tool_key = @k AND is_active = 1"
    );
  return r.recordset[0] || null;
}

// Ключ выдаём один раз и больше не меняем: он зашит в конфигурацию агента.
async function ensureToolKey(clinicId) {
  const pool = await getPool();
  const cur = await pool.request().input("id", sql.Int, clinicId)
    .query("SELECT tool_key FROM dbo.clinics WHERE id = @id");
  const have = cur.recordset[0] && cur.recordset[0].tool_key;
  if (have) return have;
  const key = require("crypto").randomBytes(24).toString("base64url");
  await pool.request().input("id", sql.Int, clinicId).input("k", sql.NVarChar(64), key)
    .query("UPDATE dbo.clinics SET tool_key = @k WHERE id = @id");
  return key;
}

// ---------------------------------------------------------------------------
// Пул номеров.

async function numbersByStatus(status) {
  const pool = await getPool();
  const req = pool.request();
  let where = "";
  if (status) { req.input("s", sql.NVarChar(16), status); where = "WHERE status = @s"; }
  const r = await req.query(
    "SELECT id, number, provider, status, phone_number_id, pbx_extension, " +
    "clinic_id, note, created_at, assigned_at FROM dbo.numbers " + where +
    " ORDER BY status, number"
  );
  return r.recordset;
}

// Заводит номер в пул или обновляет то, что о нём известно. Статус трогаем
// только если он передан: провизионер вызывает функцию дважды, и второй вызов
// не должен вернуть выданный номер обратно в свободные.
async function upsertNumber(n) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("number", sql.NVarChar(32), n.number)
    .input("provider", sql.NVarChar(32), n.provider || "zadarma")
    .input("status", sql.NVarChar(16), n.status || null)
    .input("phone_number_id", sql.NVarChar(64), n.phone_number_id || null)
    .input("pbx_extension", sql.NVarChar(32), n.pbx_extension || null)
    .input("note", sql.NVarChar(200), n.note || null)
    .query(`
      MERGE dbo.numbers AS t
      USING (SELECT @number AS number) AS s ON t.number = s.number
      WHEN MATCHED THEN UPDATE SET
        provider = @provider,
        status = COALESCE(@status, t.status),
        phone_number_id = COALESCE(@phone_number_id, t.phone_number_id),
        pbx_extension = COALESCE(@pbx_extension, t.pbx_extension),
        note = COALESCE(@note, t.note)
      WHEN NOT MATCHED THEN INSERT
        (number, provider, status, phone_number_id, pbx_extension, note)
        VALUES (@number, @provider, COALESCE(@status, 'preparing'),
                @phone_number_id, @pbx_extension, @note)
      OUTPUT inserted.id;
    `);
  return r.recordset[0].id;
}

// Выдаёт номер клинике. Условие status = 'free' стоит внутри UPDATE нарочно:
// проверка отдельным SELECT оставила бы зазор, в котором две клиники,
// нажавшие «выбрать» одновременно, получили бы один номер.
async function assignNumber(number, clinicId) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("number", sql.NVarChar(32), number)
    .input("clinic", sql.Int, clinicId)
    .query(
      "UPDATE dbo.numbers SET status = 'assigned', clinic_id = @clinic, " +
      "assigned_at = SYSUTCDATETIME() " +
      "OUTPUT inserted.id, inserted.number, inserted.phone_number_id, inserted.pbx_extension " +
      "WHERE number = @number AND status = 'free'"
    );
  if (!r.recordset.length) return null; // уже занят или ещё не готов
  const taken = r.recordset[0];

  // Клиника ищет свои звонки по phone_number_id, поэтому переставляем и его.
  await pool
    .request()
    .input("pid", sql.NVarChar(64), taken.phone_number_id)
    .input("num", sql.NVarChar(32), taken.number)
    .input("clinic", sql.Int, clinicId)
    .query("UPDATE dbo.clinics SET phone_number_id = @pid, public_number = @num WHERE id = @clinic");
  return taken;
}

async function releaseNumber(number) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("number", sql.NVarChar(32), number)
    .query(
      "UPDATE dbo.clinics SET phone_number_id = NULL, public_number = NULL " +
      "WHERE phone_number_id = (SELECT phone_number_id FROM dbo.numbers WHERE number = @number);" +
      "UPDATE dbo.numbers SET status = 'free', clinic_id = NULL, assigned_at = NULL " +
      "OUTPUT inserted.number WHERE number = @number"
    );
  return r.recordset.length ? r.recordset[0].number : null;
}

async function setClinicWaSession(clinicId, session) {
  const pool = await getPool();
  await pool
    .request()
    .input("id", sql.Int, clinicId)
    .input("s", sql.NVarChar(64), session || null)
    .query("UPDATE dbo.clinics SET wa_session = @s WHERE id = @id");
}

async function saveZadarmaEvent(event, fields) {
  const pool = await getPool();
  await pool
    .request()
    .input("event", sql.NVarChar(64), String(event || "").slice(0, 64))
    .input("fields", sql.NVarChar(sql.MAX), JSON.stringify(fields || {}))
    .query("INSERT INTO dbo.zadarma_events (event, fields) VALUES (@event, @fields)");
}

async function lastZadarmaEvents(limit) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("n", sql.Int, Math.min(Number(limit) || 20, 100))
    .query("SELECT TOP (@n) id, received_at, event, fields FROM dbo.zadarma_events ORDER BY id DESC");
  return r.recordset;
}

// --- Крыша: запись ---------------------------------------------------------

// Объявление могло попасться нам вчера и снова сегодня: тогда обновляем цену и
// отметку «видели», а дату публикации и первую встречу не трогаем.
async function saveFlat(f) {
  const pool = await getPool();
  await pool.request()
    .input("id", sql.BigInt, Number(f.id))
    .input("city", sql.NVarChar(40), f.city || null)
    .input("rooms", sql.Int, f.rooms || null)
    .input("area", sql.Decimal(7, 2), f.area || null)
    .input("floor", sql.Int, f.floor || null)
    .input("floors", sql.Int, f.floors || null)
    .input("year", sql.Int, f.year || null)
    .input("house", sql.NVarChar(60), f.house || null)
    .input("complex", sql.NVarChar(160), f.complex || null)
    .input("cond", sql.NVarChar(80), f.cond || null)
    .input("district", sql.NVarChar(100), f.district || null)
    .input("price", sql.BigInt, f.price || null)
    .input("addr", sql.NVarChar(300), f.addr || null)
    .input("title", sql.NVarChar(300), f.title || null)
    .input("photos", sql.Int, f.photos || null)
    .input("photo1", sql.NVarChar(300), f.ph1 || null)
    .input("dir", sql.NVarChar(120), f.photoDir || null)
    .input("mkr", sql.NVarChar(80), f.mkr || null)
    .input("kitchen", sql.Decimal(6, 2), f.kitchen == null ? null : f.kitchen)
    .input("ceiling", sql.Decimal(4, 2), f.ceiling == null ? null : f.ceiling)
    .input("toilet", sql.NVarChar(40), f.toilet || null)
    .input("balcony", sql.NVarChar(60), f.balcony || null)
    .input("parking", sql.NVarChar(60), f.parking || null)
    .input("dorm", sql.Bit, f.dorm == null ? null : f.dorm)
    .input("furnished", sql.Bit, f.furnished == null ? null : f.furnished)
    .input("agent", sql.Bit, f.isAgent == null ? null : f.isAgent)
    .input("posted", sql.Date, f.created || null)
    .query(`
      MERGE dbo.krisha_flats AS t
      USING (SELECT @id AS id) AS s ON t.id = s.id
      WHEN MATCHED THEN UPDATE SET
        price = COALESCE(@price, t.price), title = COALESCE(@title, t.title),
        photos = COALESCE(@photos, t.photos), last_seen = SYSUTCDATETIME(),
        -- Сначала квартира может попасть из выдачи, без года и даты
        -- публикации, а потом из карточки объявления — с ними. Пустое
        -- заполняем, заполненное не затираем.
        floor = COALESCE(t.floor, @floor), floors = COALESCE(t.floors, @floors),
        build_year = COALESCE(t.build_year, @year), house = COALESCE(t.house, @house),
        complex = COALESCE(t.complex, @complex), cond = COALESCE(t.cond, @cond),
        addr = COALESCE(t.addr, @addr), photo1 = COALESCE(t.photo1, @photo1),
        photo_dir = COALESCE(t.photo_dir, @dir), mkr = COALESCE(t.mkr, @mkr),
        kitchen = COALESCE(t.kitchen, @kitchen), ceiling = COALESCE(t.ceiling, @ceiling),
        toilet = COALESCE(t.toilet, @toilet), balcony = COALESCE(t.balcony, @balcony),
        parking = COALESCE(t.parking, @parking), dorm = COALESCE(t.dorm, @dorm),
        furnished = COALESCE(t.furnished, @furnished), is_agent = COALESCE(t.is_agent, @agent),
        posted_on = COALESCE(t.posted_on, @posted)
      WHEN NOT MATCHED THEN INSERT
        (id, city, rooms, area, floor, floors, build_year, house, complex, cond,
         district, price, addr, title, photos, photo1, photo_dir, mkr, posted_on,
         kitchen, ceiling, toilet, balcony, parking, dorm, furnished, is_agent)
      VALUES
        (@id, @city, @rooms, @area, @floor, @floors, @year, @house, @complex, @cond,
         @district, @price, @addr, @title, @photos, @photo1, @dir, @mkr, @posted,
         @kitchen, @ceiling, @toilet, @balcony, @parking, @dorm, @furnished, @agent);`);
}

// Какие из этих объявлений у нас уже есть. Нужно перед снятием карточек: за
// сутки прогон может пройти дважды, и второй раз читать то же самое незачем.
async function knownIds(ids) {
  const list = (ids || []).map((x) => Number(x)).filter(Boolean);
  if (!list.length) return new Set();
  const pool = await getPool();
  const have = new Set();
  // Пачками: список параметров в запросе не бесконечный.
  for (let i = 0; i < list.length; i += 200) {
    const chunk = list.slice(i, i + 200);
    const req = pool.request();
    const names = chunk.map((id, n) => { req.input("i" + n, sql.BigInt, id); return "@i" + n; });
    const r = await req.query("SELECT id FROM dbo.krisha_flats WHERE id IN (" + names.join(",") + ")");
    r.recordset.forEach((x) => have.add(String(x.id)));
  }
  return have;
}

async function saveFlats(list) {
  let ok = 0;
  for (const f of list || []) {
    try { await saveFlat(f); ok++; } catch (e) { console.log("[крыша] не записал " + f.id + ": " + e.message); }
  }
  return ok;
}

// «8 705…» и «+7 705…» — один и тот же номер, и лечь он должен одной строкой.
// Приводим здесь, а не у вызывающего: иначе однажды кто-нибудь передаст сырое
// значение, и в базе появится двойник, которого потом не свести.
function normPhone(raw) {
  const d = String(raw == null ? "" : raw).replace(/\D/g, "");
  if (d.length === 11 && /^[78]/.test(d)) return "7" + d.slice(1);
  if (d.length === 10) return "7" + d;
  return null;
}

// Квартиры, чья фотография всё ещё лежит на Крыше. Их снимки догоняем отдельным
// проходом: качать 24 тысячи картинок во время обхода выдачи незачем, а CDN на
// параллельные запросы не жалуется — там нет ни капчи, ни ограничения темпа.
async function flatsNeedingPhoto(limit) {
  const pool = await getPool();
  const r = await pool.request().input("n", sql.Int, Number(limit) || 400).query(`
    SELECT TOP (@n) id, photo1 FROM dbo.krisha_flats
    WHERE photo1 IS NOT NULL AND photo1 NOT LIKE '%blob.core.windows.net%'
    ORDER BY id DESC`);
  return r.recordset;
}

// url = null означает «показать нечего»: снимок не скачался и адрес на Крыше
// мёртвый. Тогда поле именно обнуляем, а не оставляем как было, — иначе эта
// квартира будет попадать в очередь на перенос при каждом прогоне и вечно
// откусывать бюджет. Папка при этом сохраняется: по ней галерею всё равно
// можно собрать перебором.
async function setFlatPhoto(id, url, dir) {
  const pool = await getPool();
  await pool.request()
    .input("id", sql.BigInt, Number(id))
    .input("u", sql.NVarChar(300), url || null)
    .input("d", sql.NVarChar(120), dir || null)
    .query(`UPDATE dbo.krisha_flats
            SET photo1 = @u, photo_dir = COALESCE(@d, photo_dir)
            WHERE id = @id`);
}

async function photoStats() {
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN photo1 LIKE '%blob.core.windows.net%' THEN 1 ELSE 0 END) AS ours,
      SUM(CASE WHEN photo1 IS NULL THEN 1 ELSE 0 END) AS none,
      SUM(CASE WHEN photo_dir IS NOT NULL THEN 1 ELSE 0 END) AS with_dir
    FROM dbo.krisha_flats`);
  return r.recordset[0];
}

async function saveFlatPhones(flatId, phones, source) {
  const pool = await getPool();
  const seen = new Set();
  for (const raw of phones || []) {
    const digits = normPhone(raw);
    if (!digits || seen.has(digits)) continue;
    seen.add(digits);
    await pool.request()
      .input("id", sql.BigInt, Number(flatId))
      .input("p", sql.NVarChar(20), digits)
      .input("src", sql.NVarChar(20), source || "script")
      .query(`
        MERGE dbo.krisha_phones AS t
        USING (SELECT @id AS flat_id, @p AS phone) AS s
          ON t.flat_id = s.flat_id AND t.phone = s.phone
        WHEN NOT MATCHED THEN INSERT (flat_id, phone, source) VALUES (@id, @p, @src);`);
  }
}

async function flatPhones(flatId) {
  const pool = await getPool();
  const r = await pool.request().input("id", sql.BigInt, Number(flatId))
    .query("SELECT phone FROM dbo.krisha_phones WHERE flat_id = @id ORDER BY got_at");
  return r.recordset.map((x) => x.phone);
}

// Что ещё без телефона: очередь для скрипта, который их собирает.
async function flatsWithoutPhone(limit) {
  const pool = await getPool();
  const r = await pool.request().input("n", sql.Int, Number(limit) || 30).query(`
    SELECT TOP (@n) f.id, f.title
    FROM dbo.krisha_flats f
    LEFT JOIN dbo.krisha_phones p ON p.flat_id = f.id
    WHERE p.flat_id IS NULL
    ORDER BY f.first_seen DESC`);
  return r.recordset;
}

// Квартиры, у которых есть запись в базе, но нет снятой карточки: описание,
// характеристики и галерею им ещё не читали. Архивный обход страниц объявлений
// не открывает, поэтому дочитываем их отдельным неспешным проходом.
// Дерево «город — район — микрорайон» строится из самих данных, а не забивается
// списком: города и районы меняются, а выдумывать справочник, который разойдётся
// с базой, — худшее из решений.
async function places() {
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT city, district, mkr, COUNT(*) AS n
    FROM dbo.krisha_flats
    GROUP BY city, district, mkr`);
  const tree = {};
  for (const x of r.recordset) {
    const city = x.city || "?";
    const d = x.district || "без района";
    tree[city] = tree[city] || { n: 0, districts: {} };
    tree[city].n += x.n;
    tree[city].districts[d] = tree[city].districts[d] || { n: 0, mkrs: {} };
    tree[city].districts[d].n += x.n;
    if (x.mkr) tree[city].districts[d].mkrs[x.mkr] = x.n;
  }
  return tree;
}

// Заполнение микрорайона у того, что уже собрано: адрес есть, разбора не было.
async function backfillMkr(rows) {
  const pool = await getPool();
  let n = 0;
  for (const r of rows) {
    await pool.request()
      .input("id", sql.BigInt, Number(r.id))
      .input("m", sql.NVarChar(80), r.mkr)
      .query("UPDATE dbo.krisha_flats SET mkr = @m WHERE id = @id AND mkr IS NULL");
    n++;
  }
  return n;
}

async function flatsWithoutMkr(limit) {
  const pool = await getPool();
  const r = await pool.request().input("n", sql.Int, Number(limit) || 2000).query(`
    SELECT TOP (@n) id, addr FROM dbo.krisha_flats
    WHERE mkr IS NULL AND addr LIKE N'%мкр%'`);
  return r.recordset;
}

async function flatsWithoutCard(limit) {
  const pool = await getPool();
  const r = await pool.request().input("n", sql.Int, Number(limit) || 200).query(`
    SELECT TOP (@n) f.id, f.city, f.rooms, f.area, f.district, f.price, f.addr
    FROM dbo.krisha_flats f
    LEFT JOIN dbo.krisha_cards c ON c.flat_id = f.id
    WHERE c.flat_id IS NULL
    ORDER BY f.id DESC`);
  return r.recordset;
}

async function saveCard(flatId, card) {
  const pool = await getPool();
  await pool.request()
    .input("id", sql.BigInt, Number(flatId))
    .input("j", sql.NVarChar(sql.MAX), JSON.stringify(card))
    .query(`
      MERGE dbo.krisha_cards AS t
      USING (SELECT @id AS flat_id) AS s ON t.flat_id = s.flat_id
      WHEN MATCHED THEN UPDATE SET card_json = @j, taken_at = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (flat_id, card_json) VALUES (@id, @j);`);
}

async function card(flatId) {
  const pool = await getPool();
  const r = await pool.request().input("id", sql.BigInt, Number(flatId))
    .query("SELECT card_json FROM dbo.krisha_cards WHERE flat_id = @id");
  if (!r.recordset.length) return null;
  try { return JSON.parse(r.recordset[0].card_json); } catch { return null; }
}

// --- Крыша: поиск ----------------------------------------------------------

// Жёсткое условие одно — площадь: она приезжает из оригинала и агент её не
// трогает. Комнаты и этаж отсекают, если известны; район и год только
// добавляют уверенности, потому что агент иногда пишет свой район.
async function findFlats(q, limit) {
  const pool = await getPool();
  const area = Number(String(q.area || "").replace(",", "."));
  // Без площади ищем по тому, что назвали: район, комнаты, вилка цены. Это уже
  // не «узнать квартиру», а «посмотреть, что подходит», поэтому сортировка по
  // свежести, а не по совпадению.
  if (!area) {
    if (!q.district && !q.rooms && !q.priceFrom && !q.priceTo && !q.mkr && !q.city && !q.addr) return [];
    const r0 = await pool.request()
      .input("rooms", sql.Int, q.rooms ? Number(q.rooms) : null)
      .input("city", sql.NVarChar(40), q.city || null)
      .input("mkr", sql.NVarChar(80), q.mkr || null)
      .input("addr", sql.NVarChar(200), q.addr || null)
      .input("district", sql.NVarChar(100), q.district || null)
      .input("floor", sql.Int, q.floor ? Number(q.floor) : null)
      .input("from", sql.BigInt, q.priceFrom ? Number(q.priceFrom) : null)
      .input("to", sql.BigInt, q.priceTo ? Number(q.priceTo) : null)
      .input("n", sql.Int, Number(limit) || 20)
      .query(`
        SELECT TOP (@n) f.*, 0 AS score
        FROM dbo.krisha_flats f
        WHERE (@rooms IS NULL OR f.rooms = @rooms)
          AND (@floor IS NULL OR f.floor = @floor)
          AND (@city IS NULL OR f.city = @city)
          AND (@mkr IS NULL OR f.mkr LIKE '%' + @mkr + '%')
          -- Улица с домом попадает то в адрес, то в заголовок, поэтому ищем в
          -- обоих: «Бурундайская 91» встречается только в заголовке.
          AND (@addr IS NULL OR f.addr LIKE '%' + @addr + '%' OR f.title LIKE '%' + @addr + '%')
          AND (@district IS NULL OR f.district LIKE '%' + @district + '%')
          AND (@from IS NULL OR f.price >= @from)
          AND (@to IS NULL OR f.price <= @to)
        ORDER BY f.posted_on DESC, f.id DESC`);
    return r0.recordset;
  }
  const tol = String(q.area).indexOf(".") === -1 ? 0.9 : 0.35;
  const r = await pool.request()
    .input("lo", sql.Decimal(7, 2), area - tol)
    .input("hi", sql.Decimal(7, 2), area + tol)
    .input("rooms", sql.Int, q.rooms ? Number(q.rooms) : null)
    .input("floor", sql.Int, q.floor ? Number(q.floor) : null)
    .input("floors", sql.Int, q.floors ? Number(q.floors) : null)
    .input("year", sql.Int, q.year ? Number(q.year) : null)
    .input("district", sql.NVarChar(100), q.district || null)
    .input("complex", sql.NVarChar(160), q.complex || null)
    .input("addr2", sql.NVarChar(200), q.addr || null)
    .input("n", sql.Int, Number(limit) || 8)
    .query(`
      SELECT TOP (@n) f.*,
        3 + IIF(@rooms IS NOT NULL AND f.rooms = @rooms, 2, 0)
          + IIF(@floor IS NOT NULL AND f.floor = @floor, 2, 0)
          + IIF(@floors IS NOT NULL AND f.floors = @floors, 1, 0)
          + IIF(@year IS NOT NULL AND f.build_year = @year, 1, 0)
          + IIF(@district IS NOT NULL AND f.district = @district, 1, 0)
          + IIF(@complex IS NOT NULL AND f.complex = @complex, 1, 0)
          + IIF(@addr2 IS NOT NULL AND (f.addr LIKE '%' + @addr2 + '%' OR f.title LIKE '%' + @addr2 + '%'), 2, 0) AS score
      FROM dbo.krisha_flats f
      WHERE f.area BETWEEN @lo AND @hi
        AND (@rooms IS NULL OR f.rooms IS NULL OR f.rooms = @rooms)
        AND (@floor IS NULL OR f.floor IS NULL OR f.floor = @floor)
        AND (@floors IS NULL OR f.floors IS NULL OR f.floors = @floors)
      ORDER BY score DESC, f.id DESC`);
  return r.recordset;
}

async function krishaStats() {
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT
      (SELECT COUNT(*) FROM dbo.krisha_flats) AS flats,
      (SELECT COUNT(DISTINCT flat_id) FROM dbo.krisha_phones) AS with_phone,
      (SELECT COUNT(*) FROM dbo.krisha_cards) AS cards,
      (SELECT COUNT(*) FROM dbo.krisha_pending) AS pending,
      (SELECT MIN(posted_on) FROM dbo.krisha_flats) AS from_day,
      (SELECT MAX(posted_on) FROM dbo.krisha_flats) AS to_day`);
  const byCity = await pool.request().query(
    "SELECT city, COUNT(*) AS n FROM dbo.krisha_flats GROUP BY city ORDER BY n DESC");
  const s = r.recordset[0];
  s.cities = {};
  byCity.recordset.forEach((x) => { s.cities[x.city || "?"] = x.n; });
  return s;
}

// --- Крыша: очередь на досъёмку -------------------------------------------

async function markPending(ids, city) {
  const pool = await getPool();
  for (const id of ids || []) {
    await pool.request()
      .input("id", sql.BigInt, Number(id))
      .input("city", sql.NVarChar(40), city || null)
      .query(`
        MERGE dbo.krisha_pending AS t
        USING (SELECT @id AS flat_id) AS s ON t.flat_id = s.flat_id
        WHEN MATCHED THEN UPDATE SET tries = t.tries + 1, last_try = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN INSERT (flat_id, city) VALUES (@id, @city);`);
  }
  // Пять неудач подряд — объявление, скорее всего, снято, а не заблокировано.
  await pool.request().query("DELETE FROM dbo.krisha_pending WHERE tries > 5");
}

async function clearPending(ids) {
  if (!ids || !ids.length) return;
  const pool = await getPool();
  for (const id of ids) {
    await pool.request().input("id", sql.BigInt, Number(id))
      .query("DELETE FROM dbo.krisha_pending WHERE flat_id = @id");
  }
}

async function pendingFlats(city, limit) {
  const pool = await getPool();
  const r = await pool.request()
    .input("city", sql.NVarChar(40), city || null)
    .input("n", sql.Int, Number(limit) || 60)
    .query(`
      SELECT TOP (@n) p.flat_id
      FROM dbo.krisha_pending p
      LEFT JOIN dbo.krisha_flats f ON f.id = p.flat_id
      WHERE f.id IS NULL AND (@city IS NULL OR p.city IS NULL OR p.city = @city)
      ORDER BY p.tries, p.last_try`);
  return r.recordset.map((x) => String(x.flat_id));
}

module.exports = { saveFlat, saveFlats, knownIds, flatsWithoutCard, places, backfillMkr, flatsWithoutMkr, flatsNeedingPhoto, setFlatPhoto, photoStats, saveFlatPhones, normPhone, flatPhones, flatsWithoutPhone,
  saveCard, card, findFlats, krishaStats, markPending, clearPending, pendingFlats,
  getPool, migrate, saveCall, setClinicWaSession, saveZadarmaEvent, lastZadarmaEvents, connectionString, clinicIdForCall, upsertClinic, listClinics, clinicsByOrgIds, callsForClinics, callForClinics, clinicById, saveClinicProfile, setClinicAgent, clinicByToolKey, ensureToolKey, numbersByStatus, upsertNumber, assignNumber, releaseNumber };

if (require.main === module) {
  const cmd = process.argv[2];
  (async () => {
    if (!connectionString()) {
      console.error(
        "Нет строки подключения.\n" +
          "Положите её одной строкой в файл:\n  " + CONN_FILE + "\n\n" +
          "Взять: Azure Portal → ваша база → Connection strings → ADO.NET,\n" +
          "и подставить настоящий пароль вместо {your_password}."
      );
      process.exit(1);
    }
    if (cmd === "migrate") {
      await migrate();
    } else if (cmd === "check") {
      const pool = await getPool();
      const r = await pool.request().query(
        "SELECT COUNT(*) AS всего, SUM(CASE WHEN is_booked = 1 THEN 1 ELSE 0 END) AS записей, " +
        "SUM(CASE WHEN is_urgent = 1 THEN 1 ELSE 0 END) AS срочных FROM dbo.calls"
      );
      console.log(r.recordset[0]);
    } else if (cmd === "last") {
      const pool = await getPool();
      const r = await pool.request().query(
        "SELECT TOP 10 received_at, client_name, client_phone, service, desired_time, " +
        "is_booked, is_urgent, duration_secs FROM dbo.calls ORDER BY received_at DESC"
      );
      console.table(r.recordset);
    } else {
      console.error("Команды: migrate, check, last");
      process.exit(1);
    }
    await sql.close();
  })().catch((e) => {
    console.error(String(e.message).slice(0, 300));
    process.exit(1);
  });
}
