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
`;

// Выборки в кабинете всегда «звонки моей клиники за период», поэтому индекс
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
      "profile_json, profile_saved_at, agent_built_at FROM dbo.clinics WHERE id = @id"
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
      "SELECT TOP 1 id, name, profile_json FROM dbo.clinics " +
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

module.exports = { getPool, migrate, saveCall, connectionString, clinicIdForCall, upsertClinic, clinicsByOrgIds, callsForClinics, callForClinics, clinicById, saveClinicProfile, setClinicAgent, clinicByToolKey, ensureToolKey, numbersByStatus, upsertNumber, assignNumber, releaseNumber };

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
