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

// Подключение для миграций схемы: индекс на двухстах тысячах строк на 10 DTU
// строится минуты, а обычный таймаут запроса — 15 секунд. Обрыв по таймауту
// откатывал CREATE INDEX, следующий вызов начинал заново — и так по кругу,
// с процессором и журналом у 100%.
let ddlPromise = null;
function ddlPool() {
  const conn = connectionString();
  if (!conn) return Promise.reject(new Error("нет строки подключения"));
  if (!ddlPromise) {
    let cfg;
    try { cfg = sql.ConnectionPool.parseConnectionString(conn); } catch { cfg = null; }
    if (!cfg) return getPool(); // строку не разобрали — обычный пул
    cfg.requestTimeout = 60 * 60 * 1000;
    cfg.pool = Object.assign({}, cfg.pool || {}, { max: 1, min: 0 });
    ddlPromise = new sql.ConnectionPool(cfg).connect().catch((e) => { ddlPromise = null; throw e; });
  }
  return ddlPromise;
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

-- Место из заголовка: «Абая 155 — Розыбакиева» или один перекрёсток без дома,
-- «Абая — Абая Розыбакиева». В поле addr улицы может не быть вовсе, а тут она
-- есть, и искать по ней хотят так же, как по району.
IF COL_LENGTH('dbo.krisha_flats', 'street') IS NULL
  ALTER TABLE dbo.krisha_flats ADD street NVARCHAR(160) NULL;
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
-- «Квартира меблирована» отвечает не «да/нет», а «полностью», «частично»,
-- «без мебели». Булевой колонкой это не описать, а «частично» — как раз то,
-- что покупателю важно знать. Меняем тип: значений в ней всё равно не было.
IF COL_LENGTH('dbo.krisha_flats', 'furnished') IS NULL
  ALTER TABLE dbo.krisha_flats ADD furnished NVARCHAR(40) NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.krisha_flats')
           AND name = 'furnished' AND system_type_id = TYPE_ID('bit'))
  ALTER TABLE dbo.krisha_flats ALTER COLUMN furnished NVARCHAR(40) NULL;
IF COL_LENGTH('dbo.krisha_flats', 'is_agent') IS NULL
  ALTER TABLE dbo.krisha_flats ADD is_agent BIT NULL;

-- Название улицы или микрорайона без номера дома. Номер есть только в карточке
-- поиска, на странице объявления его нет, поэтому сравнивать стороны можно
-- лишь по названию — зато адрес известен почти у всей базы, и в опознании
-- квартиры это сильнейший признак после площади.
IF COL_LENGTH('dbo.krisha_flats', 'street_key') IS NULL
  ALTER TABLE dbo.krisha_flats ADD street_key NVARCHAR(120) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_flats_streetkey')
  CREATE INDEX IX_flats_streetkey ON dbo.krisha_flats (city, street_key);

-- Крыша отдаёт объявление структурой window.data: координаты дома и свои
-- же слаги адреса. Это надёжнее разбора русских строк — обе стороны получают
-- ровно одну и ту же строку, а координаты называют дом с точностью до метров.
-- user_type — вердикт самой Крыши о продавце, он расходится с галочкой
-- «от хозяина», которую ставит сам продавец.
IF COL_LENGTH('dbo.krisha_flats', 'lat') IS NULL
  ALTER TABLE dbo.krisha_flats ADD lat DECIMAL(11, 7) NULL;
IF COL_LENGTH('dbo.krisha_flats', 'lon') IS NULL
  ALTER TABLE dbo.krisha_flats ADD lon DECIMAL(11, 7) NULL;
IF COL_LENGTH('dbo.krisha_flats', 'street_slug') IS NULL
  ALTER TABLE dbo.krisha_flats ADD street_slug NVARCHAR(120) NULL;
IF COL_LENGTH('dbo.krisha_flats', 'mkr_slug') IS NULL
  ALTER TABLE dbo.krisha_flats ADD mkr_slug NVARCHAR(120) NULL;
IF COL_LENGTH('dbo.krisha_flats', 'user_type') IS NULL
  ALTER TABLE dbo.krisha_flats ADD user_type NVARCHAR(40) NULL;
IF COL_LENGTH('dbo.krisha_flats', 'owner_name') IS NULL
  ALTER TABLE dbo.krisha_flats ADD owner_name NVARCHAR(120) NULL;
IF COL_LENGTH('dbo.krisha_flats', 'complex_id') IS NULL
  ALTER TABLE dbo.krisha_flats ADD complex_id BIGINT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_flats_geo')
  CREATE INDEX IX_flats_geo ON dbo.krisha_flats (city, lat, lon);

-- То, что карточка выдачи отдаёт, а мы до сих пор выбрасывали. uuid — папка
-- снимков на CDN, она же ключ галереи. is_pro и метка «Срочно, торг» платные:
-- их ставит сам продавец, и по ним видно, кто перед нами. bumped_on — дата
-- последнего поднятия, она не равна дате публикации.
IF COL_LENGTH('dbo.krisha_flats', 'uuid') IS NULL
  ALTER TABLE dbo.krisha_flats ADD uuid NVARCHAR(40) NULL;
IF COL_LENGTH('dbo.krisha_flats', 'is_pro') IS NULL
  ALTER TABLE dbo.krisha_flats ADD is_pro BIT NULL;
IF COL_LENGTH('dbo.krisha_flats', 'urgent') IS NULL
  ALTER TABLE dbo.krisha_flats ADD urgent BIT NULL;
IF COL_LENGTH('dbo.krisha_flats', 'label') IS NULL
  ALTER TABLE dbo.krisha_flats ADD label NVARCHAR(80) NULL;
IF COL_LENGTH('dbo.krisha_flats', 'bumped_on') IS NULL
  ALTER TABLE dbo.krisha_flats ADD bumped_on NVARCHAR(40) NULL;

-- Объявление, как его отдала Крыша, без нашего разбора. Держим рядом с
-- карточкой: когда окажется, что полезно ещё какое-то поле, его можно будет
-- достать запросом к базе, а не двадцатью девятью тысячами обращений к Крыше.
IF COL_LENGTH('dbo.krisha_cards', 'advert_json') IS NULL
  ALTER TABLE dbo.krisha_cards ADD advert_json NVARCHAR(MAX) NULL;

-- Сколько раз страница объявления не отдалась. Нужно, чтобы очередь на
-- дочитывание двигалась: без счётчика те же неудачники попадали бы в начало
-- каждый раз и вытесняли непрочитанные — так уже было с фотографиями, копии
-- которых умерли.
--
-- Отдельной отметки «снято» нет намеренно. По коду ответа снятое от
-- придержанного не отличить: проверка показала, что одно и то же объявление
-- отдаёт то 404, то 468, а заведомо живое тоже отвечает 468. Объявить такое
-- снятым — значит похоронить живую квартиру.
IF COL_LENGTH('dbo.krisha_flats', 'card_tries') IS NULL
  ALTER TABLE dbo.krisha_flats ADD card_tries SMALLINT NULL;

-- Симметрично card_tries, но по другому сигналу: здесь не сервер не достучался
-- до страницы, а человек с юзерскриптом не нашёл на ней ни кнопки «Показать
-- телефон», ни капчи — типичный признак снятого объявления. Тот же счётчик,
-- а не флаг «снято», и по той же причине: наверняка не определить.
IF COL_LENGTH('dbo.krisha_flats', 'phone_tries') IS NULL
  ALTER TABLE dbo.krisha_flats ADD phone_tries SMALLINT NULL;

-- Ещё из того же JSON, из соседней ветки adverts[0].
--
-- expires_on — день, когда Крыша уберёт объявление в архив. Она называет это
-- «активно ещё 7 дней»; храним датой, а не остатком дней, потому что остаток
-- назавтра становится неправдой, а дата остаётся верной, и «что исчезнет
-- завтра» превращается в обычный запрос.
--
-- phones_nb — сколько у продавца номеров: иначе не узнать, все ли мы собрали.
-- is_edited — хозяин правил объявление: те двенадцать расхождений по площади
-- были именно правками. house_num — номер дома отдельным полем, а не концом
-- строки адреса.
IF COL_LENGTH('dbo.krisha_flats', 'house_num') IS NULL
  ALTER TABLE dbo.krisha_flats ADD house_num NVARCHAR(40) NULL;
IF COL_LENGTH('dbo.krisha_flats', 'expires_on') IS NULL
  ALTER TABLE dbo.krisha_flats ADD expires_on DATE NULL;
IF COL_LENGTH('dbo.krisha_flats', 'days_live') IS NULL
  ALTER TABLE dbo.krisha_flats ADD days_live INT NULL;
IF COL_LENGTH('dbo.krisha_flats', 'phones_nb') IS NULL
  ALTER TABLE dbo.krisha_flats ADD phones_nb INT NULL;
IF COL_LENGTH('dbo.krisha_flats', 'phone_preview') IS NULL
  ALTER TABLE dbo.krisha_flats ADD phone_preview NVARCHAR(32) NULL;
IF COL_LENGTH('dbo.krisha_flats', 'is_edited') IS NULL
  ALTER TABLE dbo.krisha_flats ADD is_edited BIT NULL;
IF COL_LENGTH('dbo.krisha_flats', 'price_m2') IS NULL
  ALTER TABLE dbo.krisha_flats ADD price_m2 INT NULL;
IF COL_LENGTH('dbo.krisha_flats', 'owner_checked') IS NULL
  ALTER TABLE dbo.krisha_flats ADD owner_checked BIT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_flats_expires')
  CREATE INDEX IX_flats_expires ON dbo.krisha_flats (expires_on);

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

// Полный поток недвижимости Крыши: не только квартиры хозяев на продажу, а
// всё — продажа и аренда, любой тип объекта, любой продавец. Проблема
// «агент вместо хозяина» есть везде, поэтому храним весь поток: разобранные
// поля для запросов + сам window.data (gzip) целиком, чтобы не открывать
// страницу второй раз, когда понадобится ещё какое-то поле.
const SCHEMA_OBJECTS = `
IF OBJECT_ID('dbo.krisha_objects', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.krisha_objects (
    id         BIGINT         NOT NULL PRIMARY KEY,   -- номер объявления
    deal       NVARCHAR(10)   NULL,   -- sale / rent
    prop       NVARCHAR(20)   NULL,   -- flat/house/commercial/land/garage/other
    user_type  NVARCHAR(20)   NULL,   -- owner/specialist/company/agent/complex
    city       NVARCHAR(40)   NULL,
    created_on DATE           NULL,   -- createdAt со страницы (настоящая дата)
    price      BIGINT         NULL,
    rooms      INT            NULL,
    area       DECIMAL(9,2)   NULL,
    lat        DECIMAL(11,7)  NULL,
    lon        DECIMAL(11,7)  NULL,
    title      NVARCHAR(300)  NULL,
    data_gz    VARBINARY(MAX) NULL,   -- gzip(window.data JSON)
    first_seen DATETIME2(0)   NOT NULL CONSTRAINT DF_kobj_first DEFAULT SYSUTCDATETIME(),
    last_seen  DATETIME2(0)   NOT NULL CONSTRAINT DF_kobj_last  DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_kobj_created ON dbo.krisha_objects (created_on DESC);
  CREATE INDEX IX_kobj_cat ON dbo.krisha_objects (deal, prop, city, user_type);
END
-- Поля для сопоставления «та же квартира» (добавляются к уже существующей
-- таблице). Этаж/этажность из заголовка, ЖК/район/улица/дом из advert.address.
IF COL_LENGTH('dbo.krisha_objects', 'floor')       IS NULL ALTER TABLE dbo.krisha_objects ADD floor INT NULL;
IF COL_LENGTH('dbo.krisha_objects', 'floors')      IS NULL ALTER TABLE dbo.krisha_objects ADD floors INT NULL;
IF COL_LENGTH('dbo.krisha_objects', 'complex_id')  IS NULL ALTER TABLE dbo.krisha_objects ADD complex_id BIGINT NULL;
IF COL_LENGTH('dbo.krisha_objects', 'district')    IS NULL ALTER TABLE dbo.krisha_objects ADD district NVARCHAR(120) NULL;
IF COL_LENGTH('dbo.krisha_objects', 'mkr')         IS NULL ALTER TABLE dbo.krisha_objects ADD mkr NVARCHAR(120) NULL;
IF COL_LENGTH('dbo.krisha_objects', 'street_slug') IS NULL ALTER TABLE dbo.krisha_objects ADD street_slug NVARCHAR(160) NULL;
IF COL_LENGTH('dbo.krisha_objects', 'house_num')   IS NULL ALTER TABLE dbo.krisha_objects ADD house_num NVARCHAR(40) NULL;
-- Год постройки, тип дома, санузел: из блока характеристик HTML (parseDetail),
-- иначе из текста описания. Вторичные null-tolerant поля для точности.
IF COL_LENGTH('dbo.krisha_objects', 'build_year')  IS NULL ALTER TABLE dbo.krisha_objects ADD build_year INT NULL;
IF COL_LENGTH('dbo.krisha_objects', 'house')       IS NULL ALTER TABLE dbo.krisha_objects ADD house NVARCHAR(60) NULL;
IF COL_LENGTH('dbo.krisha_objects', 'toilet')      IS NULL ALTER TABLE dbo.krisha_objects ADD toilet NVARCHAR(40) NULL;
-- added_on — дата последнего поднятия (addedAt со страницы); created_on — дата
-- создания. У старых строк заполняется лениво из data_gz (fillAddedOn).
IF COL_LENGTH('dbo.krisha_objects', 'added_on')    IS NULL ALTER TABLE dbo.krisha_objects ADD added_on DATE NULL;
-- Телефоны, снятые со страницы (человеком через капчу): цифрами через запятую
-- 7XXXXXXXXXX; phones_at — когда сняли. Очередь на съём — где phones пусто.
IF COL_LENGTH('dbo.krisha_objects', 'phones')      IS NULL ALTER TABLE dbo.krisha_objects ADD phones NVARCHAR(300) NULL;
IF COL_LENGTH('dbo.krisha_objects', 'phones_at')   IS NULL ALTER TABLE dbo.krisha_objects ADD phones_at DATETIME2(0) NULL;
-- Промахи плагина: phone_tries — сколько раз номер не снялся; phone_state —
-- чем кончилась последняя попытка (ok / archived / not_found / captcha / timeout /
-- no_phone / error, NULL — ещё не пробовали); phone_next_at — раньше этого
-- времени объект в очередь не отдаём (пауза после captcha/timeout/…).
IF COL_LENGTH('dbo.krisha_objects', 'phone_tries')   IS NULL ALTER TABLE dbo.krisha_objects ADD phone_tries SMALLINT NULL;
IF COL_LENGTH('dbo.krisha_objects', 'phone_state')   IS NULL ALTER TABLE dbo.krisha_objects ADD phone_state NVARCHAR(20) NULL;
IF COL_LENGTH('dbo.krisha_objects', 'phone_next_at') IS NULL ALTER TABLE dbo.krisha_objects ADD phone_next_at DATETIME2(0) NULL;
-- Учёт поиска оригинала-хозяина для каждого агентского объявления: когда
-- искали, сколько кандидатов нашли, лучший. По этим полям меряем, как растёт
-- эффективность инструмента день ото дня.
IF COL_LENGTH('dbo.krisha_objects', 'searched_at') IS NULL ALTER TABLE dbo.krisha_objects ADD searched_at DATETIME2(0) NULL;
IF COL_LENGTH('dbo.krisha_objects', 'match_count') IS NULL ALTER TABLE dbo.krisha_objects ADD match_count INT NULL;
IF COL_LENGTH('dbo.krisha_objects', 'match_top')   IS NULL ALTER TABLE dbo.krisha_objects ADD match_top BIGINT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_kobj_match' AND object_id = OBJECT_ID('dbo.krisha_objects'))
  CREATE INDEX IX_kobj_match ON dbo.krisha_objects (deal, prop, user_type, city, area);
-- EXEC у всех индексов ниже: они ссылаются на колонки, добавленные ALTER'ом
-- выше в этом же батче — прямой CREATE не скомпилируется (на чистой базе
-- колонок ещё нет на этапе разбора). EXEC откладывает компиляцию до
-- выполнения, когда ALTER'ы уже отработали.
-- Очередь на поиск: только неисканные.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_kobj_tosearch' AND object_id = OBJECT_ID('dbo.krisha_objects'))
  EXEC('CREATE INDEX IX_kobj_tosearch ON dbo.krisha_objects (searched_at) WHERE searched_at IS NULL');
-- Очередь на съём телефона: объекты без номера, по дате публикации.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_kobj_nophone' AND object_id = OBJECT_ID('dbo.krisha_objects'))
  EXEC('CREATE INDEX IX_kobj_nophone ON dbo.krisha_objects (created_on) WHERE phones IS NULL');
-- findObjects всегда ищет среди ХОЗЯЕВ — держим для них узкие фильтрованные
-- индексы (хозяева — меньшинство потока, индексы получаются небольшие):
--  по сделке/типу/городу/площади (главный фильтр),
--  по координатам (опознание дома),
--  по ЖК (второй путь опознания дома).
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_kobj_owner_cat' AND object_id = OBJECT_ID('dbo.krisha_objects'))
  EXEC('CREATE INDEX IX_kobj_owner_cat ON dbo.krisha_objects (deal, prop, city, area) WHERE user_type = ''owner''');
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_kobj_owner_geo' AND object_id = OBJECT_ID('dbo.krisha_objects'))
  EXEC('CREATE INDEX IX_kobj_owner_geo ON dbo.krisha_objects (lat, lon) WHERE user_type = ''owner'' AND lat IS NOT NULL');
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_kobj_owner_complex' AND object_id = OBJECT_ID('dbo.krisha_objects'))
  EXEC('CREATE INDEX IX_kobj_owner_complex ON dbo.krisha_objects (complex_id) WHERE user_type = ''owner'' AND complex_id IS NOT NULL');
`;

// Журнал находок: по каждому агентскому объявлению, где поиск дал кандидатов,
// пишем строку на каждого кандидата-хозяина — параметрический score и вердикт
// сравнения по фото (Gemini). human_ok оставляем под ручную проверку: человек
// потом смотрит, реально ли это та же квартира, и ставит галочку. По этому
// журналу видно, какая часть параметрических совпадений подтверждается фото.
const SCHEMA_MATCHLOG = `
IF OBJECT_ID('dbo.krisha_match_log', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.krisha_match_log (
    id          BIGINT IDENTITY(1,1) PRIMARY KEY,
    agent_id    BIGINT        NOT NULL,   -- искомое (агентское) объявление
    owner_id    BIGINT        NOT NULL,   -- кандидат-хозяин
    deal        NVARCHAR(10)  NULL,
    prop        NVARCHAR(20)  NULL,
    city        NVARCHAR(40)  NULL,
    param_score INT           NULL,       -- совпадение по параметрам
    photo_match BIT           NULL,       -- вердикт Gemini: та же квартира?
    photo_conf  FLOAT         NULL,
    photo_why   NVARCHAR(400) NULL,
    human_ok    BIT           NULL,       -- ручная проверка: null=не смотрели, 1=верно, 0=нет
    found_at    DATETIME2(0)  NOT NULL CONSTRAINT DF_kml_found DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_kml_agent  ON dbo.krisha_match_log (agent_id);
  CREATE INDEX IX_kml_review ON dbo.krisha_match_log (human_ok, found_at DESC);
END
`;

// --- Пользователи бота ------------------------------------------------------
//
// Телеграм присылает данные о человеке в каждом сообщении, и они меняются: имя
// правят, username берут и бросают. Поэтому храним и разобранные поля — по ним
// считаем, — и сырой объект целиком: набор полей у Телеграма со временем
// пополняется, и терять то, чего мы сегодня не знаем, незачем.
const SCHEMA_USERS = `
IF OBJECT_ID('dbo.users', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.users (
    id           BIGINT        NOT NULL PRIMARY KEY,   -- id пользователя в Телеграме
    chat_id      BIGINT        NULL,
    username     NVARCHAR(64)  NULL,
    first_name   NVARCHAR(128) NULL,
    last_name    NVARCHAR(128) NULL,
    lang         NVARCHAR(16)  NULL,
    is_premium   BIT           NULL,
    is_bot       BIT           NULL,
    joined_at    DATETIME2(0)  NOT NULL CONSTRAINT DF_users_joined DEFAULT SYSUTCDATETIME(),
    last_seen_at DATETIME2(0)  NOT NULL CONSTRAINT DF_users_seen   DEFAULT SYSUTCDATETIME(),
    searches     INT           NOT NULL CONSTRAINT DF_users_searches DEFAULT 0,
    contacts     INT           NOT NULL CONSTRAINT DF_users_contacts DEFAULT 0,
    raw          NVARCHAR(MAX) NULL
  );
  CREATE INDEX IX_users_joined ON dbo.users (joined_at DESC);
END

-- Журнал обращений. Нужен ради одной цифры, которую иначе не узнать: какая
-- доля присланных ссылок нашлась в базе. Пустой ответ — это не ошибка бота, а
-- нехватка покрытия, и видеть её надо в числах.
IF OBJECT_ID('dbo.bot_requests', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.bot_requests (
    id        BIGINT IDENTITY(1,1) PRIMARY KEY,
    at        DATETIME2(0)  NOT NULL CONSTRAINT DF_breq_at DEFAULT SYSUTCDATETIME(),
    user_id   BIGINT        NULL,
    kind      NVARCHAR(16)  NOT NULL,                  -- search | contact
    krisha_id BIGINT        NULL,                      -- что присылали
    flat_id   BIGINT        NULL,                      -- по какой квартире просили контакты
    found     BIT           NULL,                      -- нашлось ли хоть одно совпадение
    matches   INT           NULL,
    note      NVARCHAR(200) NULL
  );
  CREATE INDEX IX_breq_at ON dbo.bot_requests (at DESC);
  CREATE INDEX IX_breq_user ON dbo.bot_requests (user_id, at DESC);
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
  await pool.request().batch(SCHEMA_OBJECTS);
  await pool.request().batch(SCHEMA_MATCHLOG);
  await pool.request().batch(SCHEMA_USERS);
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
    .input("street", sql.NVarChar(160), f.street || null)
    .input("skey", sql.NVarChar(120), f.streetKey || null)
    .input("lat", sql.Decimal(11, 7), f.lat == null ? null : Number(f.lat))
    .input("lon", sql.Decimal(11, 7), f.lon == null ? null : Number(f.lon))
    .input("sslug", sql.NVarChar(120), f.streetSlug || null)
    .input("mslug", sql.NVarChar(120), f.mkrSlug || null)
    .input("utype", sql.NVarChar(40), f.userType || null)
    .input("oname", sql.NVarChar(120), f.ownerName || null)
    .input("cxid", sql.BigInt, f.complexId == null ? null : Number(f.complexId))
    .input("uuid", sql.NVarChar(40), f.uuid || null)
    .input("pro", sql.Bit, f.isPro == null ? null : (f.isPro ? 1 : 0))
    .input("urg", sql.Bit, f.urgent == null ? null : (f.urgent ? 1 : 0))
    .input("label", sql.NVarChar(80), f.label || null)
    .input("bump", sql.NVarChar(40), f.bumped || null)
    .input("hnum", sql.NVarChar(40), f.houseNum || null)
    .input("exp", sql.Date, f.expiresOn || null)
    .input("dlive", sql.Int, f.daysLive == null ? null : Number(f.daysLive))
    .input("pnb", sql.Int, f.phonesNb == null ? null : Number(f.phonesNb))
    .input("ppre", sql.NVarChar(32), f.phonePreview || null)
    .input("edit", sql.Bit, f.isEdited == null ? null : (f.isEdited ? 1 : 0))
    .input("pm2", sql.Int, f.priceM2 == null ? null : Number(f.priceM2))
    .input("ochk", sql.Bit, f.ownerChecked == null ? null : (f.ownerChecked ? 1 : 0))
    .input("kitchen", sql.Decimal(6, 2), f.kitchen == null ? null : f.kitchen)
    .input("ceiling", sql.Decimal(4, 2), f.ceiling == null ? null : f.ceiling)
    .input("toilet", sql.NVarChar(40), f.toilet || null)
    .input("balcony", sql.NVarChar(60), f.balcony || null)
    .input("parking", sql.NVarChar(60), f.parking || null)
    .input("dorm", sql.Bit, f.dorm == null ? null : f.dorm)
    .input("furnished", sql.NVarChar(40), f.furnished || null)
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
        street = COALESCE(t.street, @street),
        -- Ключ адреса пересчитываем всегда: правило разбора мы уточняем, а
        -- сравнение двух сторон должно идти по одной и той же его версии.
        street_key = COALESCE(@skey, t.street_key),
        lat = COALESCE(@lat, t.lat), lon = COALESCE(@lon, t.lon),
        street_slug = COALESCE(@sslug, t.street_slug), mkr_slug = COALESCE(@mslug, t.mkr_slug),
        user_type = COALESCE(@utype, t.user_type), owner_name = COALESCE(@oname, t.owner_name),
        complex_id = COALESCE(@cxid, t.complex_id),
        uuid = COALESCE(@uuid, t.uuid), is_pro = COALESCE(@pro, t.is_pro),
        -- Метка платная и снимается вместе с оплатой, поэтому не COALESCE:
        -- «была срочной месяц назад» — не то же, что «срочная сейчас».
        urgent = @urg, label = @label, bumped_on = COALESCE(@bump, t.bumped_on),
        house_num = COALESCE(@hnum, t.house_num),
        -- Срок жизни и число прожитых дней не COALESCE: объявление продлевают,
        -- и вчерашний срок — уже неправда.
        expires_on = COALESCE(@exp, t.expires_on), days_live = COALESCE(@dlive, t.days_live),
        phones_nb = COALESCE(@pnb, t.phones_nb), phone_preview = COALESCE(@ppre, t.phone_preview),
        is_edited = COALESCE(@edit, t.is_edited), price_m2 = COALESCE(@pm2, t.price_m2),
        owner_checked = COALESCE(@ochk, t.owner_checked),
        kitchen = COALESCE(t.kitchen, @kitchen), ceiling = COALESCE(t.ceiling, @ceiling),
        toilet = COALESCE(t.toilet, @toilet), balcony = COALESCE(t.balcony, @balcony),
        parking = COALESCE(t.parking, @parking), dorm = COALESCE(t.dorm, @dorm),
        furnished = COALESCE(t.furnished, @furnished), is_agent = COALESCE(t.is_agent, @agent),
        posted_on = COALESCE(t.posted_on, @posted)
      WHEN NOT MATCHED THEN INSERT
        (id, city, rooms, area, floor, floors, build_year, house, complex, cond,
         district, price, addr, title, photos, photo1, photo_dir, mkr, street, street_key, posted_on,
         lat, lon, street_slug, mkr_slug, user_type, owner_name, complex_id,
         uuid, is_pro, urgent, label, bumped_on,
         house_num, expires_on, days_live, phones_nb, phone_preview, is_edited, price_m2, owner_checked,
         kitchen, ceiling, toilet, balcony, parking, dorm, furnished, is_agent)
      VALUES
        (@id, @city, @rooms, @area, @floor, @floors, @year, @house, @complex, @cond,
         @district, @price, @addr, @title, @photos, @photo1, @dir, @mkr, @street, @skey, @posted,
         @lat, @lon, @sslug, @mslug, @utype, @oname, @cxid,
         @uuid, @pro, @urg, @label, @bump,
         @hnum, @exp, @dlive, @pnb, @ppre, @edit, @pm2, @ochk,
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

// Заменить номера квартиры целиком, а не добавить к ним. saveFlatPhones
// каждый раз ТОЛЬКО добавляет — это правильно для скрипта, который снимает
// номер со страницы и может перезапуститься на той же квартире, но не даёт
// способа поправить неверно записанный номер: он останется в базе рядом с
// исправленным. Здесь — для ручного редактирования, когда именно это и нужно.
async function replaceFlatPhones(flatId, phones, source) {
  const pool = await getPool();
  const seen = new Set();
  const clean = [];
  for (const raw of phones || []) {
    const d = normPhone(raw);
    if (d && !seen.has(d)) { seen.add(d); clean.push(d); }
  }
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await tx.request().input("id", sql.BigInt, Number(flatId))
      .query("DELETE FROM dbo.krisha_phones WHERE flat_id = @id");
    for (const p of clean) {
      await tx.request()
        .input("id", sql.BigInt, Number(flatId))
        .input("p", sql.NVarChar(20), p)
        .input("src", sql.NVarChar(20), source || "manual")
        .query("INSERT INTO dbo.krisha_phones (flat_id, phone, source) VALUES (@id, @p, @src)");
    }
    await tx.commit();
  } catch (e) { await tx.rollback(); throw e; }
  return clean;
}

// Что ещё без телефона: очередь для скрипта, который их собирает.
// total — сколько всего в очереди, а не в этой странице. Без него счётчик в
// userscript показывал бы размер запрошенной пачки (постоянные «осталось 30»
// при limit=30) вместо настоящего прогресса.
async function flatsWithoutPhone(limit) {
  const pool = await getPool();
  // Пять промахов подряд — предел: дальше объявление, скорее всего, снято
  // (юзерскрипт не находит на нём ни кнопки, ни капчи), но утверждать это
  // мы не можем, поэтому просто перестаём его предлагать — как и с card_tries,
  // без счётчика тот же мертвяк вечно занимал бы голову очереди.
  const alive = "ISNULL(f.phone_tries, 0) < 5";
  const r = await pool.request().input("n", sql.Int, Number(limit) || 30).query(`
    SELECT TOP (@n) f.id, f.title
    FROM dbo.krisha_flats f
    LEFT JOIN dbo.krisha_phones p ON p.flat_id = f.id
    WHERE p.flat_id IS NULL AND ${alive}
    ORDER BY f.first_seen DESC`);
  const t = await pool.request().query(`
    SELECT COUNT(*) AS n FROM dbo.krisha_flats f
    LEFT JOIN dbo.krisha_phones p ON p.flat_id = f.id
    WHERE p.flat_id IS NULL AND ${alive}`);
  return { rows: r.recordset, total: t.recordset[0].n };
}

// Юзерскрипт не смог получить номер на этой странице (кнопки нет, капчи нет,
// номер не появился) — считаем промах. Симметрично markCardMiss ниже по
// файлу, только сигнал приходит из браузера, а не с сервера.
async function markPhoneMiss(id) {
  const pool = await getPool();
  await pool.request().input("id", sql.BigInt, Number(id)).query(`
    UPDATE dbo.krisha_flats SET phone_tries = ISNULL(phone_tries, 0) + 1 WHERE id = @id`);
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

// Что вообще встречается в базе и у скольких квартир поле известно. Нужно и
// для выпадающих списков, и чтобы человек видел охват: фильтр по году, который
// известен у трёх процентов, обманчив, и это должно быть написано прямо.
async function facets() {
  const pool = await getPool();
  const out = {};
  for (const col of ["house", "toilet", "cond", "balcony", "parking", "furnished"]) {
    const r = await pool.request().query(
      "SELECT " + col + " AS v, COUNT(*) AS n FROM dbo.krisha_flats" +
      " WHERE " + col + " IS NOT NULL GROUP BY " + col + " ORDER BY n DESC");
    out[col] = r.recordset.map((x) => ({ v: x.v, n: x.n }));
  }
  const k = await pool.request().query(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN build_year IS NOT NULL THEN 1 ELSE 0 END) AS build_year,
      SUM(CASE WHEN house IS NOT NULL THEN 1 ELSE 0 END) AS house,
      SUM(CASE WHEN toilet IS NOT NULL THEN 1 ELSE 0 END) AS toilet,
      SUM(CASE WHEN cond IS NOT NULL THEN 1 ELSE 0 END) AS cond,
      SUM(CASE WHEN floor IS NOT NULL THEN 1 ELSE 0 END) AS floor,
      SUM(CASE WHEN kitchen IS NOT NULL THEN 1 ELSE 0 END) AS kitchen,
      SUM(CASE WHEN posted_on IS NOT NULL THEN 1 ELSE 0 END) AS posted_on
    FROM dbo.krisha_flats`);
  out.known = k.recordset[0];
  const y = await pool.request().query(
    "SELECT MIN(build_year) AS lo, MAX(build_year) AS hi FROM dbo.krisha_flats WHERE build_year IS NOT NULL");
  out.years = y.recordset[0];
  const d = await pool.request().query(
    "SELECT MIN(posted_on) AS lo, MAX(posted_on) AS hi FROM dbo.krisha_flats WHERE posted_on IS NOT NULL");
  out.posted = d.recordset[0];
  return out;
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

// Заполнение места из заголовка у того, что уже собрано: заголовки в базе есть,
// разбора не было. Сеть не нужна.
async function flatsWithoutStreet(limit) {
  const pool = await getPool();
  const r = await pool.request().input("n", sql.Int, Number(limit) || 3000).query(`
    SELECT TOP (@n) id, title FROM dbo.krisha_flats
    WHERE street IS NULL AND title IS NOT NULL`);
  return r.recordset;
}

async function backfillStreet(rows) {
  const pool = await getPool();
  let n = 0;
  for (const r of rows) {
    await pool.request()
      .input("id", sql.BigInt, Number(r.id))
      .input("s", sql.NVarChar(160), r.street)
      .query("UPDATE dbo.krisha_flats SET street = @s WHERE id = @id AND street IS NULL");
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

// Что дочитать со страниц объявлений. Сначала те, у которых страницы не было
// вовсе, а когда они кончатся — прочитанные старым разбором, который не знал
// про JSON самой Крыши: у них нет ни координат, ни её слагов адреса.
//
// Признак перечитки — пустой advert_json, а не пустые координаты. Разница
// принципиальная: у объявления без карты координат не будет и после перечитки,
// и по «lat IS NULL» оно возвращалось бы в очередь вечно, вытесняя остальные.
// Сохранённый advert_json означает «эту страницу мы новым разбором уже видели»
// — независимо от того, что в ней нашлось, — поэтому очередь заканчивается.
async function flatsWithoutCard(limit) {
  const pool = await getPool();
  const n = Number(limit) || 200;
  // Восемь неудач подряд — предел: дальше объявление, скорее всего, снято, но
  // утверждать этого мы не можем, поэтому просто перестаём его пробовать.
  const alive = "ISNULL(f.card_tries, 0) < 8";
  const r = await pool.request().input("n", sql.Int, n).query(`
    SELECT TOP (@n) f.id, f.city, f.rooms, f.area, f.district, f.price, f.addr, 0 AS reread
    FROM dbo.krisha_flats f
    LEFT JOIN dbo.krisha_cards c ON c.flat_id = f.id
    WHERE c.flat_id IS NULL AND ${alive}
    ORDER BY ISNULL(f.card_tries, 0), f.id DESC`);
  const rows = r.recordset;
  const left = n - rows.length;
  if (left <= 0) return rows;
  const r2 = await pool.request().input("n", sql.Int, left).query(`
    SELECT TOP (@n) f.id, f.city, f.rooms, f.area, f.district, f.price, f.addr, 1 AS reread
    FROM dbo.krisha_flats f
    JOIN dbo.krisha_cards c ON c.flat_id = f.id
    WHERE c.advert_json IS NULL AND ${alive}
    ORDER BY ISNULL(f.card_tries, 0), f.id DESC`);
  return rows.concat(r2.recordset);
}

// Страница не отдалась — считаем попытку. Очередь сортируется по этому счёту,
// поэтому неудачник уходит в конец и вернётся, когда придержка снимется, а не
// на следующем же заходе.
async function markCardMiss(id) {
  const pool = await getPool();
  await pool.request().input("id", sql.BigInt, Number(id)).query(`
    UPDATE dbo.krisha_flats SET card_tries = ISNULL(card_tries, 0) + 1 WHERE id = @id`);
}

// Сколько ещё дочитывать: по обеим очередям сразу, чтобы видеть конец работы.
async function deepenLeft() {
  const pool = await getPool();
  // Считаем только то, что ещё имеет смысл читать: снятые объявления и те, что
  // не отдались пять раз, из остатка исключены — иначе число никогда не дойдёт
  // до нуля и перестанет что-либо значить.
  // Восемь неудач подряд — предел: дальше объявление, скорее всего, снято, но
  // утверждать этого мы не можем, поэтому просто перестаём его пробовать.
  const alive = "ISNULL(f.card_tries, 0) < 8";
  const r = await pool.request().query(`
    SELECT
      (SELECT COUNT(*) FROM dbo.krisha_flats f
        LEFT JOIN dbo.krisha_cards c ON c.flat_id = f.id
        WHERE c.flat_id IS NULL AND ${alive}) AS no_card,
      (SELECT COUNT(*) FROM dbo.krisha_flats f
        JOIN dbo.krisha_cards c ON c.flat_id = f.id
        WHERE c.advert_json IS NULL AND ${alive}) AS old_parse,
      (SELECT COUNT(*) FROM dbo.krisha_flats WHERE lat IS NOT NULL) AS with_geo,
      (SELECT COUNT(*) FROM dbo.krisha_flats WHERE ISNULL(card_tries, 0) >= 8) AS given_up,
      (SELECT COUNT(*) FROM dbo.krisha_flats) AS total`);
  return r.recordset[0];
}

async function saveCard(flatId, card) {
  const pool = await getPool();
  // Сырой объект от Крыши держим отдельной колонкой, а из разобранной карточки
  // убираем — иначе одно и то же лежало бы дважды.
  // Пустой объект, а не NULL, когда на странице JSON не нашлось: колонка
  // служит отметкой «эту страницу новый разбор уже видел», и без неё
  // объявление возвращалось бы в очередь на перечитку бесконечно.
  const raw = card && card.advertRaw ? JSON.stringify(card.advertRaw) : "{}";
  const parsed = Object.assign({}, card);
  delete parsed.advertRaw;
  await pool.request()
    .input("id", sql.BigInt, Number(flatId))
    .input("j", sql.NVarChar(sql.MAX), JSON.stringify(parsed))
    .input("raw", sql.NVarChar(sql.MAX), raw)
    .query(`
      MERGE dbo.krisha_cards AS t
      USING (SELECT @id AS flat_id) AS s ON t.flat_id = s.flat_id
      WHEN MATCHED THEN UPDATE SET card_json = @j,
        advert_json = COALESCE(@raw, t.advert_json), taken_at = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (flat_id, card_json, advert_json)
        VALUES (@id, @j, @raw);`);
}

async function card(flatId) {
  const pool = await getPool();
  const r = await pool.request().input("id", sql.BigInt, Number(flatId))
    .query("SELECT card_json FROM dbo.krisha_cards WHERE flat_id = @id");
  if (!r.recordset.length) return null;
  try { return JSON.parse(r.recordset[0].card_json); } catch { return null; }
}

// Все фото кандидата, если карточку уже сняли (deepen); иначе — только
// photo1, который приходит прямо со страницы поиска.
async function candidatePhotoUrls(flatId, photo1) {
  try {
    const c = await card(flatId);
    if (c && Array.isArray(c.photos) && c.photos.length) {
      const urls = c.photos.map((p) => p.big).filter(Boolean);
      if (urls.length) return urls;
    }
  } catch { /* обойдёмся первой фотографией */ }
  return photo1 ? [photo1] : [];
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
    const any = q.district || q.rooms || q.priceFrom || q.priceTo || q.mkr || q.city || q.addr ||
      q.yearFrom || q.yearTo || q.house || q.toilet || q.cond || q.notFirst || q.notLast ||
      q.postedFrom || q.postedTo || q.furnished;
    if (!any) return [];
    const r0 = await pool.request()
      .input("rooms", sql.Int, q.rooms ? Number(q.rooms) : null)
      .input("city", sql.NVarChar(40), q.city || null)
      .input("mkr", sql.NVarChar(80), q.mkr || null)
      .input("addr", sql.NVarChar(200), q.addr || null)
      .input("yf", sql.Int, q.yearFrom ? Number(q.yearFrom) : null)
      .input("yt", sql.Int, q.yearTo ? Number(q.yearTo) : null)
      .input("house", sql.NVarChar(60), q.house || null)
      .input("toilet", sql.NVarChar(40), q.toilet || null)
      .input("cond", sql.NVarChar(80), q.cond || null)
      .input("furn", sql.NVarChar(40), q.furnished || null)
      .input("nf", sql.Bit, q.notFirst ? 1 : 0)
      .input("nl", sql.Bit, q.notLast ? 1 : 0)
      .input("pf", sql.Date, q.postedFrom || null)
      .input("pt", sql.Date, q.postedTo || null)
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
          AND (@addr IS NULL OR f.addr LIKE '%' + @addr + '%'
               OR f.street LIKE '%' + @addr + '%' OR f.title LIKE '%' + @addr + '%')
          AND (@district IS NULL OR f.district LIKE '%' + @district + '%')
          AND (@from IS NULL OR f.price >= @from)
          AND (@to IS NULL OR f.price <= @to)
          AND (@yf IS NULL OR f.build_year >= @yf)
          AND (@yt IS NULL OR f.build_year <= @yt)
          AND (@house IS NULL OR f.house = @house)
          AND (@toilet IS NULL OR f.toilet = @toilet)
          AND (@cond IS NULL OR f.cond LIKE '%' + @cond + '%')
          AND (@furn IS NULL OR f.furnished = @furn)
          -- «не первый» и «не последний» — то, с чего начинают почти все:
          -- первый этаж и последний сбивают цену и отсеиваются первым делом.
          AND (@nf = 0 OR f.floor IS NULL OR f.floor > 1)
          AND (@nl = 0 OR f.floor IS NULL OR f.floors IS NULL OR f.floor < f.floors)
          AND (@pf IS NULL OR f.posted_on >= @pf)
          AND (@pt IS NULL OR f.posted_on <= @pt)
        ORDER BY f.posted_on DESC, f.id DESC`);
    return r0.recordset;
  }
  // Здесь мы не подбираем похожее, а узнаём ту же самую квартиру в чужом
  // объявлении. Порядок: город — обязателен всем; дом опознаём по ЖК или по
  // координатам — любой из двух совпал, достаточно (обе стороны заполняются
  // не полностью, поэтому берём то, что есть); дальше этаж, комнаты, санузел —
  // их сравниваем, только когда поле известно с обеих сторон, а не заполнено —
  // не исключаем из-за пустоты. Опознание дома (ЖК/координаты) — исключение:
  // оно обязательно, ни того ни другого нет — квартира не считается найденной,
  // иначе район и площадь сами по себе сходятся у десятков домов в городе.
  // ±5 м²: площадь иногда просто указывают неверно (не только опечатка в
  // десятых), поэтому допуск расширен с прежних 0.35–0.9.
  const tol = 5;
  const price = Number(q.price) || null;
  const r = await pool.request()
    .input("lo", sql.Decimal(7, 2), area - tol)
    .input("hi", sql.Decimal(7, 2), area + tol)
    .input("rooms", sql.Int, q.rooms ? Number(q.rooms) : null)
    .input("floor", sql.Int, q.floor ? Number(q.floor) : null)
    .input("floors", sql.Int, q.floors ? Number(q.floors) : null)
    .input("year", sql.Int, q.year ? Number(q.year) : null)
    .input("city", sql.NVarChar(40), q.city || null)
    .input("district", sql.NVarChar(100), q.district || null)
    .input("mkr", sql.NVarChar(80), q.mkr || null)
    .input("skey", sql.NVarChar(120), q.streetKey || null)
    .input("sslug", sql.NVarChar(120), q.streetSlug || null)
    .input("hnum", sql.NVarChar(40), q.houseNum || null)
    .input("lat", sql.Decimal(11, 7), q.lat == null ? null : Number(q.lat))
    .input("lon", sql.Decimal(11, 7), q.lon == null ? null : Number(q.lon))
    .input("kit", sql.Decimal(7, 2), q.kitchen == null ? null : Number(q.kitchen))
    .input("house", sql.NVarChar(60), q.house || null)
    .input("complex", sql.NVarChar(160), q.complex || null)
    .input("toilet", sql.NVarChar(40), q.toilet || null)
    .input("balcony", sql.NVarChar(60), q.balcony || null)
    .input("addr2", sql.NVarChar(200), q.addr || null)
    // Посредник ставит свою цену, но не втрое: вилка отсекает совпадения,
    // которые физически подошли, а по деньгам — другая квартира.
    .input("plo", sql.BigInt, price ? Math.round(price * 0.6) : null)
    .input("phi", sql.BigInt, price ? Math.round(price * 1.5) : null)
    .input("n", sql.Int, Number(limit) || 8)
    .query(`
      SELECT TOP (@n) f.*,
        3 + IIF(@rooms IS NOT NULL AND f.rooms = @rooms, 2, 0)
          + IIF(@skey IS NOT NULL AND f.street_key = @skey, 4, 0)
          + IIF(@sslug IS NOT NULL AND f.street_slug = @sslug, 4, 0)
          -- Улица и номер дома вместе — это уже адрес, а не район: столько же,
          -- сколько за совпадение по карте.
          + IIF(@hnum IS NOT NULL AND @sslug IS NOT NULL
               AND f.house_num = @hnum AND f.street_slug = @sslug, 6, 0)
          + IIF(@lat IS NOT NULL AND f.lat IS NOT NULL
               AND ABS(f.lat - @lat) < 0.0006 AND ABS(f.lon - @lon) < 0.0008, 6, 0)
          + IIF(@floor IS NOT NULL AND f.floor = @floor, 2, 0)
          + IIF(@floors IS NOT NULL AND f.floors = @floors, 1, 0)
          + IIF(@year IS NOT NULL AND f.build_year = @year, 1, 0)
          + IIF(@district IS NOT NULL AND f.district = @district, 1, 0)
          + IIF(@mkr IS NOT NULL AND f.mkr = @mkr, 2, 0)
          + IIF(@kit IS NOT NULL AND f.kitchen = @kit, 2, 0)
          + IIF(@house IS NOT NULL AND f.house = @house, 1, 0)
          + IIF(@complex IS NOT NULL AND f.complex = @complex, 1, 0)
          -- Вся затея ради прямого контакта хозяина, поэтому при равном
          -- совпадении выше встаёт тот, кого Крыша хозяином и считает, а
          -- платный значок «специалист» опускает.
          + IIF(f.user_type = 'owner', 2, 0)
          + IIF(f.is_pro = 1, -2, 0)
          + IIF(@addr2 IS NOT NULL AND (f.addr LIKE '%' + @addr2 + '%'
               OR f.street LIKE '%' + @addr2 + '%' OR f.title LIKE '%' + @addr2 + '%'), 2, 0) AS score
      FROM dbo.krisha_flats f
      WHERE f.area BETWEEN @lo AND @hi
        -- Застройщик, не хозяин: у ещё не сданного дома (user_type=complex)
        -- нет фото конкретной квартиры, только рендер планировки — он один
        -- на все квартиры этого типа в доме, и «совпадение» по фото ничего
        -- не доказывает. К тому же звонить там некому — не хозяину, а в
        -- отдел продаж застройщика, а бот обещает именно хозяина.
        AND (f.user_type IS NULL OR f.user_type <> 'complex')
        AND (@city IS NULL OR f.city = @city)
        AND (@rooms IS NULL OR f.rooms IS NULL OR f.rooms = @rooms)
        AND (@floor IS NULL OR f.floor IS NULL OR f.floor = @floor)
        AND (@floors IS NULL OR f.floors IS NULL OR f.floors = @floors)
        AND (@district IS NULL OR f.district IS NULL OR f.district = @district)
        -- Улица: у нас она с номером дома, на странице объявления — без него,
        -- поэтому сравниваем только название. Внутри района это сужает выбор
        -- до одного-двух домов и делает главную работу после площади.
        AND (@skey IS NULL OR f.street_key IS NULL OR f.street_key = @skey)
        -- Слаг улицы Крыша ставит сама, поэтому у двух объявлений одного дома
        -- он совпадает буква в букву — сверять нечего.
        AND (@sslug IS NULL OR f.street_slug IS NULL OR f.street_slug = @sslug)
        -- Номер дома сверяем только вместе с улицей: «дом 9» сам по себе есть
        -- на каждой улице города.
        AND (@hnum IS NULL OR f.house_num IS NULL OR @sslug IS NULL OR f.street_slug IS NULL
             OR f.street_slug <> @sslug OR f.house_num = @hnum)
        -- Координаты называют дом с точностью до метров. 0.0006° по широте —
        -- около 65 м, 0.0008° по долготе на нашей широте — около 65 м: это
        -- один дом с запасом на то, что геокодер ставит точку по-разному.
        AND (@lat IS NULL OR f.lat IS NULL
             OR (ABS(f.lat - @lat) < 0.0006 AND ABS(f.lon - @lon) < 0.0008))
        -- Дом должен быть подтверждён — ЖК или координаты, любой из двух:
        -- у присланной ссылки координаты есть почти всегда, а у нас в базе
        -- пока не у всех (43% и растёт по мере deepen), и у ЖК похожая
        -- картина (35%) — если требовать «строго один путь», запись,
        -- дочитанная только по координатам, не найдётся против запроса
        -- с указанным ЖК, хотя координаты её бы подтвердили. Улицу как
        -- самостоятельное подтверждение не берём: имя улицы называет улицу,
        -- а не дом, на ней таких домов может быть десяток. Если не известно
        -- ни ЖК, ни координаты — подтвердить дом нечем, квартира не считается
        -- найденной.
        AND (
          (@complex IS NOT NULL AND f.complex = @complex)
          OR (@lat IS NOT NULL AND f.lat IS NOT NULL
               AND ABS(f.lat - @lat) < 0.0006 AND ABS(f.lon - @lon) < 0.0008)
        )
        -- Год постройки на Крыше иногда расходится на год у одного и того же
        -- дома: сдача и заселение приходятся на разные годы, владельцы пишут
        -- по-разному. Терпим ±1, а не только точное совпадение.
        AND (@year IS NULL OR f.build_year IS NULL OR ABS(f.build_year - @year) <= 1)
        AND (@house IS NULL OR f.house IS NULL OR f.house = @house)
        AND (@toilet IS NULL OR f.toilet IS NULL OR f.toilet = @toilet)
        AND (@balcony IS NULL OR f.balcony IS NULL OR f.balcony = @balcony)
        -- Кухню каждая сторона округляет по-своему: «9» против «9.2».
        AND (@kit IS NULL OR f.kitchen IS NULL OR ABS(f.kitchen - @kit) <= 1)
        AND (@plo IS NULL OR f.price IS NULL OR f.price BETWEEN @plo AND @phi)
      ORDER BY score DESC, f.id DESC`);
  return r.recordset;
}

// Одна квартира по номеру. Нужна для случая, когда покупатель присылает ссылку,
// которая уже есть у нас: значит это объявление и так от хозяина, и искать
// похожие незачем — надо отдать контакты именно по нему.
async function flat(id) {
  const pool = await getPool();
  const r = await pool.request().input("id", sql.BigInt, Number(id))
    .query("SELECT * FROM dbo.krisha_flats WHERE id = @id");
  return r.recordset[0] || null;
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

// --- Пользователи бота и журнал обращений -----------------------------------

// Заводим человека при первом же сообщении и обновляем то, что Телеграм прислал
// сейчас. Возвращаем признак новизны — по нему бот здоровается, а сводка
// считает «новых за сегодня».
async function upsertUser(from, chatId) {
  if (!from || !from.id) return { isNew: false };
  const pool = await getPool();
  const r = await pool.request()
    .input("id", sql.BigInt, Number(from.id))
    .input("chat", sql.BigInt, chatId == null ? null : Number(chatId))
    .input("username", sql.NVarChar(64), from.username || null)
    .input("first", sql.NVarChar(128), from.first_name || null)
    .input("last", sql.NVarChar(128), from.last_name || null)
    .input("lang", sql.NVarChar(16), from.language_code || null)
    .input("prem", sql.Bit, from.is_premium == null ? null : (from.is_premium ? 1 : 0))
    .input("bot", sql.Bit, from.is_bot == null ? null : (from.is_bot ? 1 : 0))
    .input("raw", sql.NVarChar(sql.MAX), JSON.stringify(from))
    .query(`
      MERGE dbo.users AS t
      USING (SELECT @id AS id) AS s ON t.id = s.id
      WHEN MATCHED THEN UPDATE SET
        chat_id = ISNULL(@chat, t.chat_id), username = @username,
        first_name = @first, last_name = @last, lang = ISNULL(@lang, t.lang),
        is_premium = @prem, is_bot = ISNULL(@bot, t.is_bot),
        last_seen_at = SYSUTCDATETIME(), raw = @raw
      WHEN NOT MATCHED THEN INSERT (id, chat_id, username, first_name, last_name, lang, is_premium, is_bot, raw)
        VALUES (@id, @chat, @username, @first, @last, @lang, @prem, @bot, @raw)
      OUTPUT $action AS act;`);
  const act = r.recordset && r.recordset[0] ? r.recordset[0].act : null;
  return { isNew: act === "INSERT" };
}

async function logBotRequest(x) {
  const pool = await getPool();
  const col = x.kind === "contact" ? "contacts" : "searches";
  await pool.request()
    .input("user", sql.BigInt, x.userId == null ? null : Number(x.userId))
    .input("kind", sql.NVarChar(16), x.kind || "search")
    .input("kid", sql.BigInt, x.krishaId == null ? null : Number(x.krishaId))
    .input("fid", sql.BigInt, x.flatId == null ? null : Number(x.flatId))
    .input("found", sql.Bit, x.found == null ? null : (x.found ? 1 : 0))
    .input("matches", sql.Int, x.matches == null ? null : Number(x.matches))
    .input("note", sql.NVarChar(200), x.note ? String(x.note).slice(0, 200) : null)
    .query(`
      INSERT INTO dbo.bot_requests (user_id, kind, krisha_id, flat_id, found, matches, note)
      VALUES (@user, @kind, @kid, @fid, @found, @matches, @note);
      UPDATE dbo.users SET ${col} = ${col} + 1 WHERE id = @user;`);
}

// Сводка для панели. Сутки считаем по Алматы (UTC+5) — иначе «сегодня» на
// панели меняется в пять утра и дневные числа не сходятся с ощущением дня.
const ALM = "DATEADD(hour, 5, ";
async function botStats(days) {
  const pool = await getPool();
  const n = Math.min(Math.max(Number(days) || 14, 2), 90);
  const today = `CAST(${ALM}at) AS date) = CAST(${ALM}SYSUTCDATETIME()) AS date)`;
  const r = await pool.request().input("n", sql.Int, n).query(`
    SELECT
      (SELECT COUNT(*) FROM dbo.bot_requests WHERE kind = 'search' AND ${today}) AS searches_today,
      (SELECT COUNT(*) FROM dbo.bot_requests WHERE kind = 'search' AND found = 1 AND ${today}) AS found_today,
      (SELECT COUNT(*) FROM dbo.bot_requests WHERE kind = 'contact' AND ${today}) AS contacts_today,
      (SELECT COUNT(*) FROM dbo.bot_requests WHERE kind = 'search') AS searches_all,
      (SELECT COUNT(*) FROM dbo.bot_requests WHERE kind = 'search' AND found = 1) AS found_all,
      (SELECT COUNT(*) FROM dbo.bot_requests WHERE kind = 'contact') AS contacts_all,
      (SELECT COUNT(*) FROM dbo.users) AS users_all,
      (SELECT COUNT(*) FROM dbo.users
        WHERE CAST(${ALM}joined_at) AS date) = CAST(${ALM}SYSUTCDATETIME()) AS date)) AS users_today,
      (SELECT COUNT(*) FROM dbo.users
        WHERE last_seen_at > DATEADD(day, -7, SYSUTCDATETIME())) AS users_week`);

  const byDay = await pool.request().input("n", sql.Int, n).query(`
    SELECT CAST(${ALM}at) AS date) AS day,
      SUM(IIF(kind = 'search', 1, 0)) AS searches,
      SUM(IIF(kind = 'search' AND found = 1, 1, 0)) AS found,
      SUM(IIF(kind = 'contact', 1, 0)) AS contacts
    FROM dbo.bot_requests
    WHERE at > DATEADD(day, -@n, SYSUTCDATETIME())
    GROUP BY CAST(${ALM}at) AS date)
    ORDER BY day DESC`);

  const usersByDay = await pool.request().input("n", sql.Int, n).query(`
    SELECT CAST(${ALM}joined_at) AS date) AS day, COUNT(*) AS n
    FROM dbo.users
    WHERE joined_at > DATEADD(day, -@n, SYSUTCDATETIME())
    GROUP BY CAST(${ALM}joined_at) AS date)
    ORDER BY day DESC`);

  const recent = await pool.request().query(`
    SELECT TOP (40) r.at, r.kind, r.krisha_id, r.flat_id, r.found, r.matches, r.note,
      u.id AS user_id, u.username, u.first_name, u.last_name
    FROM dbo.bot_requests r
    LEFT JOIN dbo.users u ON u.id = r.user_id
    ORDER BY r.at DESC`);

  const people = await pool.request().query(`
    SELECT TOP (20) id, username, first_name, last_name, joined_at, last_seen_at, searches, contacts
    FROM dbo.users ORDER BY last_seen_at DESC`);

  const s = r.recordset[0];
  s.find_rate_today = s.searches_today ? Math.round((100 * s.found_today) / s.searches_today) : null;
  s.find_rate = s.searches_all ? Math.round((100 * s.found_all) / s.searches_all) : null;
  s.days = byDay.recordset;
  s.new_users = usersByDay.recordset;
  s.recent = recent.recordset;
  s.people = people.recordset;
  return s;
}

// --- Крыша: полный поток недвижимости (id-walking) -------------------------

let objectsReady = false;
// После сбоя миграции — пауза, а не немедленный повтор: иначе тяжёлый
// CREATE INDEX, оборвавшийся по таймауту, запускается снова каждым вызовом.
const DDL_RETRY_MS = 10 * 60 * 1000;
let objectsReadyPromise = null, objectsFailedAt = 0;
async function ensureObjects() {
  if (objectsReady) return;
  if (objectsFailedAt && Date.now() - objectsFailedAt < DDL_RETRY_MS) throw new Error("миграция схемы недавно сорвалась — пауза");
  if (!objectsReadyPromise) {
    objectsReadyPromise = (async () => {
      const p = await ddlPool();
      await p.request().batch(SCHEMA_OBJECTS);
      await p.request().batch(SCHEMA_MATCHLOG);
      objectsReady = true;
    })().catch((e) => { objectsReadyPromise = null; objectsFailedAt = Date.now(); throw e; });
  }
  await objectsReadyPromise;
}

// Ссылки на фото объекта — из сохранённого window.data (advert.photos).
// Отдаём размер 560x350 (полноразмерные -full.jpg тяжелее для Gemini).
async function objectPhotos(id) {
  const pool = await getPool();
  const r = await pool.request().input("id", sql.BigInt, Number(id))
    .query("SELECT data_gz FROM dbo.krisha_objects WHERE id = @id");
  if (!r.recordset.length || !r.recordset[0].data_gz) return [];
  try {
    const j = JSON.parse(require("zlib").gunzipSync(r.recordset[0].data_gz).toString("utf8"));
    const photos = (j.advert && j.advert.photos) || [];
    return photos.map((p) => String(p.src || "").replace(/-full\.jpg$/, "-560x350.jpg")).filter(Boolean);
  } catch { return []; }
}

// --- Крыша: обход по списку карты (эксперимент) ----------------------------
// krisha_list — текущее состояние каждого объявления, как его видит список
// карты; krisha_list_events — журнал: появилось, сменило цену, ушло в архив,
// вернулось. По журналу видна история объявления с момента, как мы его
// впервые встретили.
const SCHEMA_LIST = `
IF OBJECT_ID('dbo.krisha_list', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.krisha_list (
    id         BIGINT        NOT NULL PRIMARY KEY,
    deal       NVARCHAR(10)  NULL,
    prop       NVARCHAR(20)  NULL,
    user_type  NVARCHAR(20)  NULL,
    city       NVARCHAR(40)  NULL,
    price      BIGINT        NULL,
    rooms      INT           NULL,
    area       DECIMAL(9,2)  NULL,
    floor      INT           NULL,
    floors     INT           NULL,
    complex_id BIGINT        NULL,
    lat        DECIMAL(11,7) NULL,
    lon        DECIMAL(11,7) NULL,
    title      NVARCHAR(300) NULL,
    addr       NVARCHAR(300) NULL,
    owner_name NVARCHAR(120) NULL,
    photos     INT           NULL,
    photo1     NVARCHAR(300) NULL,
    storage    NVARCHAR(20)  NULL,
    first_seen DATETIME2(0)  NOT NULL CONSTRAINT DF_klist_first DEFAULT SYSUTCDATETIME(),
    last_seen  DATETIME2(0)  NOT NULL CONSTRAINT DF_klist_last  DEFAULT SYSUTCDATETIME(),
    seen_count INT           NOT NULL CONSTRAINT DF_klist_seen  DEFAULT 1,
    sweep_no   INT           NULL
  );
  CREATE INDEX IX_klist_first ON dbo.krisha_list (first_seen DESC);
  CREATE INDEX IX_klist_cat ON dbo.krisha_list (deal, prop, city, user_type);
END
-- bumped_on — дата последнего поднятия с карточки; смена даты — событие bump.
IF COL_LENGTH('dbo.krisha_list', 'bumped_on') IS NULL ALTER TABLE dbo.krisha_list ADD bumped_on DATE NULL;
-- photos_json — все ссылки на фото JSON-массивом (полноразмерные -full.jpg).
IF COL_LENGTH('dbo.krisha_list', 'photos_json') IS NULL ALTER TABLE dbo.krisha_list ADD photos_json NVARCHAR(MAX) NULL;
-- photos_c — то же компактно: «папка|номера» (см. packPhotos). photos_json
-- у старых строк переносится сюда и обнуляется — он и забил квоту базы.
-- Колонку не расширяем: ALTER COLUMN на 200 тысячах строк переписывает
-- таблицу и на 10 DTU не укладывается ни в какой таймаут. packPhotos сам
-- укладывает значение в 2000 символов.
IF COL_LENGTH('dbo.krisha_list', 'photos_c') IS NULL ALTER TABLE dbo.krisha_list ADD photos_c VARCHAR(2000) NULL;
-- Телефоны хозяев — те же колонки и та же логика промахов, что у krisha_objects:
-- очередь плагина теперь идёт по списку, он видит хозяев раньше и шире.
IF COL_LENGTH('dbo.krisha_list', 'phones')        IS NULL ALTER TABLE dbo.krisha_list ADD phones NVARCHAR(300) NULL;
IF COL_LENGTH('dbo.krisha_list', 'phones_at')     IS NULL ALTER TABLE dbo.krisha_list ADD phones_at DATETIME2(0) NULL;
IF COL_LENGTH('dbo.krisha_list', 'phone_tries')   IS NULL ALTER TABLE dbo.krisha_list ADD phone_tries SMALLINT NULL;
IF COL_LENGTH('dbo.krisha_list', 'phone_state')   IS NULL ALTER TABLE dbo.krisha_list ADD phone_state NVARCHAR(20) NULL;
IF COL_LENGTH('dbo.krisha_list', 'phone_next_at') IS NULL ALTER TABLE dbo.krisha_list ADD phone_next_at DATETIME2(0) NULL;
-- Поиск хозяина для агентского: когда искали, сколько нашли, лучший.
IF COL_LENGTH('dbo.krisha_list', 'searched_at')   IS NULL ALTER TABLE dbo.krisha_list ADD searched_at DATETIME2(0) NULL;
IF COL_LENGTH('dbo.krisha_list', 'match_count')   IS NULL ALTER TABLE dbo.krisha_list ADD match_count INT NULL;
IF COL_LENGTH('dbo.krisha_list', 'match_top')     IS NULL ALTER TABLE dbo.krisha_list ADD match_top BIGINT NULL;
-- EXEC: индексы на колонки, добавленные ALTER'ом в этом же батче.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_klist_nophone2' AND object_id = OBJECT_ID('dbo.krisha_list'))
  EXEC('CREATE INDEX IX_klist_nophone2 ON dbo.krisha_list (first_seen DESC)
        INCLUDE (storage, deal, prop, phone_tries, phone_state, phone_next_at)
        WHERE phones IS NULL AND user_type = ''owner''');
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_klist_nophone' AND object_id = OBJECT_ID('dbo.krisha_list'))
  DROP INDEX IX_klist_nophone ON dbo.krisha_list;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_klist_tosearch2' AND object_id = OBJECT_ID('dbo.krisha_list'))
  EXEC('CREATE INDEX IX_klist_tosearch2 ON dbo.krisha_list (first_seen DESC)
        INCLUDE (user_type, area, complex_id, lat)
        WHERE searched_at IS NULL');
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_klist_tosearch' AND object_id = OBJECT_ID('dbo.krisha_list'))
  DROP INDEX IX_klist_tosearch ON dbo.krisha_list;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_klist_owner_geo' AND object_id = OBJECT_ID('dbo.krisha_list'))
  EXEC('CREATE INDEX IX_klist_owner_geo ON dbo.krisha_list (lat, lon) INCLUDE (deal, prop, area, rooms, floor, floors) WHERE user_type = ''owner''');
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_klist_owner_cx' AND object_id = OBJECT_ID('dbo.krisha_list'))
  EXEC('CREATE INDEX IX_klist_owner_cx ON dbo.krisha_list (complex_id) INCLUDE (deal, prop, area, rooms, floor, floors) WHERE user_type = ''owner'' AND complex_id IS NOT NULL');
-- Журнал находок по списку: агентское -> кандидат-хозяин, баллы, фото, архив.
IF OBJECT_ID('dbo.krisha_list_matches', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.krisha_list_matches (
    id          BIGINT IDENTITY(1,1) PRIMARY KEY,
    agent_id    BIGINT        NOT NULL,
    owner_id    BIGINT        NOT NULL,
    param_score INT           NULL,
    photo_match BIT           NULL,
    photo_conf  FLOAT         NULL,
    photo_why   NVARCHAR(400) NULL,
    archived_at DATETIME2(0)  NULL,    -- когда хозяин снял объявление (если снял)
    found_at    DATETIME2(0)  NOT NULL CONSTRAINT DF_klm_found DEFAULT SYSUTCDATETIME(),
    human_ok    BIT           NULL
  );
  CREATE INDEX IX_klm_found ON dbo.krisha_list_matches (found_at DESC);
  CREATE INDEX IX_klm_agent ON dbo.krisha_list_matches (agent_id);
END
IF OBJECT_ID('dbo.krisha_list_events', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.krisha_list_events (
    ev_id     BIGINT IDENTITY(1,1) PRIMARY KEY,
    id        BIGINT        NOT NULL,
    at        DATETIME2(0)  NOT NULL CONSTRAINT DF_klev_at DEFAULT SYSUTCDATETIME(),
    kind      NVARCHAR(16)  NOT NULL,   -- new | price | archived | back | bump
    old_price BIGINT        NULL,
    new_price BIGINT        NULL,
    sweep_no  INT           NULL
  );
  CREATE INDEX IX_klev_id ON dbo.krisha_list_events (id, at);
  CREATE INDEX IX_klev_at ON dbo.krisha_list_events (at DESC);
END
`;
let listReady = false;
let listReadyPromise = null, listFailedAt = 0;
async function ensureList() {
  if (listReady) return;
  if (listFailedAt && Date.now() - listFailedAt < DDL_RETRY_MS) throw new Error("миграция схемы недавно сорвалась — пауза");
  if (!listReadyPromise) {
    listReadyPromise = (async () => {
      const p = await ddlPool();
      await p.request().batch(SCHEMA_LIST);
      listReady = true;
    })().catch((e) => { listReadyPromise = null; listFailedAt = Date.now(); throw e; });
  }
  await listReadyPromise;
}

// Записать объявление из списка. Один MERGE с OUTPUT: он же говорит, новое
// это или обновление, и какие были цена и состояние — по ним пишем журнал.
async function saveListAdvert(o, sweepNo) {
  const pool = await getPool();
  await ensureList(pool);
  // Строки режем до длины колонок: адрес или заголовок длиннее объявленного
  // драйвер не отправит вовсе (TDS «invalid data length»), а одно такое
  // объявление не должно останавливать весь обход.
  const cut = (v, n) => (v == null || v === "" ? null : String(v).slice(0, n));
  const r = await pool.request()
    .input("id", sql.BigInt, Number(o.id))
    .input("deal", sql.NVarChar(10), cut(o.deal, 10))
    .input("prop", sql.NVarChar(20), cut(o.prop, 20))
    .input("ut", sql.NVarChar(20), cut(o.userType, 20))
    .input("city", sql.NVarChar(40), cut(o.city, 40))
    .input("price", sql.BigInt, o.price == null ? null : Number(o.price))
    .input("rooms", sql.Int, o.rooms == null ? null : Number(o.rooms))
    .input("area", sql.Decimal(9, 2), o.area == null ? null : Number(o.area))
    .input("floor", sql.Int, o.floor == null ? null : Number(o.floor))
    .input("floors", sql.Int, o.floors == null ? null : Number(o.floors))
    .input("cxid", sql.BigInt, o.complexId == null ? null : Number(o.complexId))
    .input("lat", sql.Decimal(11, 7), o.lat == null ? null : Number(o.lat))
    .input("lon", sql.Decimal(11, 7), o.lon == null ? null : Number(o.lon))
    .input("title", sql.NVarChar(300), cut(o.title, 300))
    .input("addr", sql.NVarChar(300), cut(o.addr, 300))
    .input("owner", sql.NVarChar(120), cut(o.ownerName, 120))
    .input("photos", sql.Int, o.photos == null ? null : Number(o.photos))
    .input("photo1", sql.NVarChar(300), cut(o.photo1, 300))
    .input("storage", sql.NVarChar(20), cut(o.storage, 20))
    .input("bumped", sql.Date, o.bumpedOn || null)
    .input("pc", sql.VarChar(2000), require("./krisha-list.js").packPhotos(o.photoUrls))
    .input("sweep", sql.Int, sweepNo == null ? null : Number(sweepNo))
    .query(`
      MERGE dbo.krisha_list AS t
      USING (SELECT @id AS id) AS s ON t.id = s.id
      WHEN MATCHED THEN UPDATE SET
        deal = @deal, prop = @prop, user_type = @ut, city = COALESCE(@city, t.city),
        price = @price, rooms = @rooms, area = @area, floor = @floor, floors = @floors,
        complex_id = @cxid, lat = @lat, lon = @lon, title = @title, addr = @addr,
        owner_name = @owner, photos = @photos, photo1 = @photo1, storage = @storage,
        bumped_on = COALESCE(@bumped, t.bumped_on), photos_c = COALESCE(@pc, t.photos_c), photos_json = NULL,
        last_seen = SYSUTCDATETIME(), seen_count = t.seen_count + 1, sweep_no = @sweep
      WHEN NOT MATCHED THEN INSERT
        (id, deal, prop, user_type, city, price, rooms, area, floor, floors, complex_id, lat, lon,
         title, addr, owner_name, photos, photo1, storage, bumped_on, photos_c, sweep_no)
        VALUES (@id, @deal, @prop, @ut, @city, @price, @rooms, @area, @floor, @floors, @cxid, @lat, @lon,
         @title, @addr, @owner, @photos, @photo1, @storage, @bumped, @pc, @sweep)
      OUTPUT $action AS act, deleted.price AS old_price, deleted.storage AS old_storage,
             deleted.bumped_on AS old_bumped;`);
  const row = r.recordset[0] || {};
  const out = { added: row.act === "INSERT", price: false, archived: false, back: false, bump: false };
  const events = [];
  if (out.added) events.push(["new", null, o.price]);
  else {
    const oldP = row.old_price == null ? null : Number(row.old_price);
    if (oldP != null && o.price != null && oldP !== Number(o.price)) { out.price = true; events.push(["price", oldP, o.price]); }
    const was = row.old_storage || null, now = o.storage || null;
    if (was !== now && (was === "live" || now === "live")) {
      if (now === "live") { out.back = true; events.push(["back", null, null]); }
      else { out.archived = true; events.push(["archived", null, null]); }
    }
    // Поднятие: дата на карточке стала позже той, что мы видели. Первое
    // заполнение (раньше даты не было) поднятием не считаем.
    const oldB = row.old_bumped ? new Date(row.old_bumped).toISOString().slice(0, 10) : null;
    if (oldB && o.bumpedOn && o.bumpedOn > oldB) { out.bump = true; events.push(["bump", null, null]); }
  }
  for (const [kind, oldP, newP] of events) {
    await pool.request()
      .input("id", sql.BigInt, Number(o.id)).input("kind", sql.NVarChar(16), kind)
      .input("op", sql.BigInt, oldP == null ? null : Number(oldP)).input("np", sql.BigInt, newP == null ? null : Number(newP))
      .input("sweep", sql.Int, sweepNo == null ? null : Number(sweepNo))
      .query("INSERT INTO dbo.krisha_list_events (id, kind, old_price, new_price, sweep_no) VALUES (@id, @kind, @op, @np, @sweep)");
  }
  return out;
}

// --- Очередь телефонов по списку -------------------------------------------
// Хозяева без номера, живые, свежие первыми: номер надо снять до того, как
// агент уговорит хозяина спрятать объявление. since — не старше этой даты по
// first_seen; deal/prop — необязательные фильтры.
async function nextListOwnerWithoutPhone(since, deal, prop) {
  const pool = await getPool();
  await ensureList(pool);
  const ready = `user_type = 'owner' AND storage = 'live' AND phones IS NULL
        AND first_seen >= @since
        AND (@deal IS NULL OR deal = @deal) AND (@prop IS NULL OR prop = @prop)
        AND ISNULL(phone_tries, 0) < 5
        AND (phone_state IS NULL OR phone_state NOT IN (${PHONE_FINAL_SQL}))`;
  const now = "(phone_next_at IS NULL OR phone_next_at <= SYSUTCDATETIME())";
  const req = () => pool.request()
    .input("since", sql.DateTime2, new Date(since))
    .input("deal", sql.NVarChar(10), deal || null)
    .input("prop", sql.NVarChar(20), prop || null);
  const r = await req().query(`
      SELECT TOP (1) id, title, deal, prop, city, user_type, price, storage, first_seen, bumped_on, phone_tries, phone_state
      FROM dbo.krisha_list
      WHERE ${ready} AND ${now}
      ORDER BY first_seen DESC, id DESC`);
  const c = (await req().query(`SELECT
              SUM(CASE WHEN ${now} THEN 1 ELSE 0 END) AS ready,
              SUM(CASE WHEN ${now} THEN 0 ELSE 1 END) AS waiting
            FROM dbo.krisha_list WHERE ${ready}`)).recordset[0];
  return { row: r.recordset[0] || null, left: c.ready || 0, waiting: c.waiting || 0 };
}

async function markListPhoneMiss(id, reason) {
  const key = PHONE_MISS[reason] ? reason : "error";
  const rule = PHONE_MISS[key];
  const pool = await getPool();
  await ensureList(pool);
  const r = await pool.request()
    .input("id", sql.BigInt, Number(id))
    .input("st", sql.NVarChar(20), key)
    .input("min", sql.Int, rule.retryMin || 0)
    .query(`
      UPDATE dbo.krisha_list
      SET phone_tries = ISNULL(phone_tries, 0) + 1,
          phone_state = @st,
          phone_next_at = CASE WHEN @min > 0
            THEN DATEADD(minute, @min * (ISNULL(phone_tries, 0) + 1), SYSUTCDATETIME())
            ELSE NULL END
      OUTPUT INSERTED.phone_tries, INSERTED.phone_next_at
      WHERE id = @id`);
  const row = r.recordset[0] || {};
  const tries = row.phone_tries || 0;
  return { state: key, tries: tries, final: !!rule.final || tries >= 5,
           next_at: row.phone_next_at ? new Date(row.phone_next_at).toISOString() : null };
}

async function listPhonesGet(id) {
  const pool = await getPool();
  await ensureList(pool);
  const r = await pool.request().input("id", sql.BigInt, Number(id))
    .query("SELECT phones FROM dbo.krisha_list WHERE id = @id");
  return r.recordset.length ? rawList(r.recordset[0].phones) : [];
}

async function addListPhones(id, phones) {
  const pool = await getPool();
  await ensureList(pool);
  const cur = await listPhonesGet(id);
  const merged = cur.slice();
  for (const p of phones || []) if (p && !merged.includes(p)) merged.push(p);
  await pool.request()
    .input("id", sql.BigInt, Number(id))
    .input("ph", sql.NVarChar(300), merged.length ? merged.join(",") : null)
    .query(`UPDATE dbo.krisha_list
            SET phones = @ph, phones_at = SYSUTCDATETIME(),
                phone_state = CASE WHEN @ph IS NULL THEN NULL ELSE 'ok' END, phone_next_at = NULL
            WHERE id = @id`);
  return merged;
}

async function setListPhones(id, phones) {
  const pool = await getPool();
  await ensureList(pool);
  const clean = [];
  for (const p of phones || []) if (p && !clean.includes(p)) clean.push(p);
  await pool.request()
    .input("id", sql.BigInt, Number(id))
    .input("ph", sql.NVarChar(300), clean.length ? clean.join(",") : null)
    .query(`UPDATE dbo.krisha_list
            SET phones = @ph, phones_at = SYSUTCDATETIME(),
                phone_state = CASE WHEN @ph IS NULL THEN NULL ELSE 'ok' END, phone_next_at = NULL
            WHERE id = @id`);
  return clean;
}

// --- Поиск хозяина по списку -------------------------------------------------
// Агентские объявления, для которых ещё не искали; есть по чему опознать дом.
async function agentsToMatchList(limit) {
  const pool = await getPool();
  await ensureList(pool);
  const r = await pool.request().input("n", sql.Int, Number(limit) || 100).query(`
    SELECT TOP (@n) id, deal, prop, city, area, rooms, floor, floors, complex_id, lat, lon,
      price, title, addr, user_type, first_seen, bumped_on, photos_c, photos_json
    FROM dbo.krisha_list
    WHERE searched_at IS NULL
      AND user_type IN ('specialist', 'company', 'agent')
      AND area IS NOT NULL
      AND (complex_id IS NOT NULL OR lat IS NOT NULL)
    ORDER BY first_seen DESC`);
  return r.recordset;
}

// Хозяева той же квартиры среди ВСЕХ наших, включая архив: хозяин по просьбе
// агента прячет объявление, и найти его можно только у себя. Дом — по ЖК или
// координатам; дальше комнаты, этаж, площадь (±3%, не меньше 1 м²). Сам факт
// архивации признаком не считается и баллов не даёт.
async function findListOwners(q, limit) {
  const pool = await getPool();
  await ensureList(pool);
  const area = Number(q.area);
  if (!area) return [];
  const tol = Math.max(1, area * 0.03);
  const r = await pool.request()
    .input("deal", sql.NVarChar(10), q.deal || null)
    .input("prop", sql.NVarChar(20), q.prop || null)
    .input("lo", sql.Decimal(9, 2), area - tol)
    .input("hi", sql.Decimal(9, 2), area + tol)
    .input("rooms", sql.Int, q.rooms ? Number(q.rooms) : null)
    .input("floor", sql.Int, q.floor ? Number(q.floor) : null)
    .input("floors", sql.Int, q.floors ? Number(q.floors) : null)
    .input("cxid", sql.BigInt, q.complexId ? Number(q.complexId) : null)
    .input("lat", sql.Decimal(11, 7), q.lat == null ? null : Number(q.lat))
    .input("lon", sql.Decimal(11, 7), q.lon == null ? null : Number(q.lon))
    .input("exid", sql.BigInt, q.id ? Number(q.id) : null)
    .input("n", sql.Int, Number(limit) || 6)
    .query(`
      SELECT TOP (@n) f.id, f.deal, f.prop, f.user_type, f.city, f.area, f.rooms, f.floor, f.floors,
        f.complex_id, f.lat, f.lon, f.price, f.title, f.addr, f.storage, f.first_seen, f.bumped_on,
        f.phones, f.photos_c, f.photos_json, arch.at AS archived_at,
        IIF(@cxid IS NOT NULL AND f.complex_id = @cxid, 4, 0)
          + IIF(@lat IS NOT NULL AND f.lat IS NOT NULL
                AND ABS(f.lat - @lat) < 0.0006 AND ABS(f.lon - @lon) < 0.0008, 6, 0)
          + IIF(@rooms IS NOT NULL AND f.rooms = @rooms, 2, 0)
          + IIF(@floor IS NOT NULL AND f.floor = @floor, 2, 0)
          + IIF(@floors IS NOT NULL AND f.floors = @floors, 1, 0) AS score
      FROM dbo.krisha_list f
      OUTER APPLY (SELECT MAX(e.at) AS at FROM dbo.krisha_list_events e WHERE e.id = f.id AND e.kind = 'archived') arch
      WHERE f.user_type = 'owner'
        AND (@exid IS NULL OR f.id <> @exid)
        AND (@deal IS NULL OR f.deal = @deal)
        AND (@prop IS NULL OR f.prop = @prop)
        AND f.area BETWEEN @lo AND @hi
        AND (@rooms IS NULL OR f.rooms IS NULL OR f.rooms = @rooms)
        AND (@floor IS NULL OR f.floor IS NULL OR f.floor = @floor)
        AND (@floors IS NULL OR f.floors IS NULL OR f.floors = @floors)
        AND (
          (@cxid IS NOT NULL AND f.complex_id = @cxid)
          OR (@lat IS NOT NULL AND f.lat IS NOT NULL
              AND ABS(f.lat - @lat) < 0.0006 AND ABS(f.lon - @lon) < 0.0008)
        )
      ORDER BY score DESC, f.id DESC`);
  return r.recordset;
}

async function recordListSearched(id, count, topId) {
  const pool = await getPool();
  await pool.request()
    .input("id", sql.BigInt, Number(id)).input("n", sql.Int, Number(count) || 0)
    .input("top", sql.BigInt, topId == null ? null : Number(topId))
    .query("UPDATE dbo.krisha_list SET searched_at = SYSUTCDATETIME(), match_count = @n, match_top = @top WHERE id = @id");
}

async function logListMatch(m) {
  const pool = await getPool();
  await pool.request()
    .input("a", sql.BigInt, Number(m.agentId)).input("o", sql.BigInt, Number(m.ownerId))
    .input("ps", sql.Int, m.paramScore == null ? null : Number(m.paramScore))
    .input("pm", sql.Bit, m.photoMatch == null ? null : (m.photoMatch ? 1 : 0))
    .input("pc", sql.Float, m.photoConf == null ? null : Number(m.photoConf))
    .input("pw", sql.NVarChar(400), m.photoWhy ? String(m.photoWhy).slice(0, 400) : null)
    .input("ar", sql.DateTime2, m.archivedAt ? new Date(m.archivedAt) : null)
    .query(`INSERT INTO dbo.krisha_list_matches (agent_id, owner_id, param_score, photo_match, photo_conf, photo_why, archived_at)
            VALUES (@a, @o, @ps, @pm, @pc, @pw, @ar)`);
}

async function listMatchStats() {
  const pool = await getPool();
  await ensureList(pool);
  const t = (await pool.request().query(`
    SELECT COUNT(*) AS searched,
      SUM(CASE WHEN match_count > 0 THEN 1 ELSE 0 END) AS matched
    FROM dbo.krisha_list WHERE searched_at IS NOT NULL`)).recordset[0];
  const p = (await pool.request().query(`
    SELECT COUNT(*) AS candidates,
      SUM(CASE WHEN photo_match = 1 AND photo_conf >= 0.7 THEN 1 ELSE 0 END) AS photo_confirmed,
      SUM(CASE WHEN archived_at IS NOT NULL THEN 1 ELSE 0 END) AS owner_archived,
      SUM(CASE WHEN human_ok = 1 THEN 1 ELSE 0 END) AS human_yes,
      SUM(CASE WHEN human_ok = 0 THEN 1 ELSE 0 END) AS human_no
    FROM dbo.krisha_list_matches`)).recordset[0];
  return { total: t, candidates: p };
}

// Дашборд по списку: импорт по дням с разбивкой, поиск и находки, события
// (поднятия, цены, архив), снятые номера. 60 дней, периоды режет клиент.
async function listDashboard(days) {
  const pool = await getPool();
  await ensureList(pool);
  const d = Math.min(120, Math.max(1, Number(days) || 60));
  const q = (sqlText) => pool.request().input("d", sql.Int, d).query(sqlText).then((r) => r.recordset);
  const imports = await q(`
    SELECT CONVERT(char(10), first_seen, 23) AS day, COUNT(*) AS total,
      SUM(CASE WHEN deal='sale' THEN 1 ELSE 0 END) AS sale,
      SUM(CASE WHEN deal='rent' THEN 1 ELSE 0 END) AS rent,
      SUM(CASE WHEN user_type='owner' THEN 1 ELSE 0 END) AS owner,
      SUM(CASE WHEN user_type='specialist' THEN 1 ELSE 0 END) AS specialist,
      SUM(CASE WHEN user_type IN ('company','agent') THEN 1 ELSE 0 END) AS company,
      SUM(CASE WHEN user_type='complex' THEN 1 ELSE 0 END) AS complex
    FROM dbo.krisha_list
    WHERE first_seen >= DATEADD(day, -@d, SYSUTCDATETIME())
    GROUP BY CONVERT(char(10), first_seen, 23) ORDER BY day`);
  const searched = await q(`
    SELECT CONVERT(char(10), searched_at, 23) AS day, COUNT(*) AS searched,
      SUM(CASE WHEN match_count > 0 THEN 1 ELSE 0 END) AS matched
    FROM dbo.krisha_list
    WHERE searched_at IS NOT NULL AND searched_at >= DATEADD(day, -@d, SYSUTCDATETIME())
    GROUP BY CONVERT(char(10), searched_at, 23) ORDER BY day`);
  const photos = await q(`
    SELECT CONVERT(char(10), found_at, 23) AS day,
      COUNT(DISTINCT CASE WHEN photo_match = 1 AND photo_conf >= 0.7 THEN agent_id END) AS photo_ok,
      COUNT(DISTINCT CASE WHEN human_ok = 1 THEN agent_id END) AS human_ok
    FROM dbo.krisha_list_matches
    WHERE found_at >= DATEADD(day, -@d, SYSUTCDATETIME())
    GROUP BY CONVERT(char(10), found_at, 23) ORDER BY day`);
  const events = await q(`
    SELECT CONVERT(char(10), at, 23) AS day,
      SUM(CASE WHEN kind='bump' THEN 1 ELSE 0 END) AS bumps,
      SUM(CASE WHEN kind='price' THEN 1 ELSE 0 END) AS prices,
      SUM(CASE WHEN kind='archived' THEN 1 ELSE 0 END) AS archived,
      SUM(CASE WHEN kind='back' THEN 1 ELSE 0 END) AS back
    FROM dbo.krisha_list_events
    WHERE at >= DATEADD(day, -@d, SYSUTCDATETIME())
    GROUP BY CONVERT(char(10), at, 23) ORDER BY day`);
  const phones = await q(`
    SELECT CONVERT(char(10), phones_at, 23) AS day, COUNT(*) AS phones
    FROM dbo.krisha_list
    WHERE user_type='owner' AND phones_at IS NOT NULL AND phones_at >= DATEADD(day, -@d, SYSUTCDATETIME())
    GROUP BY CONVERT(char(10), phones_at, 23) ORDER BY day`);
  const totals = (await pool.request().query(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN storage='live' THEN 1 ELSE 0 END) AS live,
      SUM(CASE WHEN user_type='owner' THEN 1 ELSE 0 END) AS owner,
      SUM(CASE WHEN user_type='owner' AND phones IS NOT NULL THEN 1 ELSE 0 END) AS owner_phones,
      SUM(CASE WHEN user_type='owner' AND storage='live' AND phones IS NULL THEN 1 ELSE 0 END) AS owner_queue
    FROM dbo.krisha_list`)).recordset[0];
  return { imports, searched, photos, events, phones, totals };
}

// Находки по списку для страницы проверки: агентское, кандидат, что совпало.
async function listMatchReviewRows(limit) {
  const pool = await getPool();
  await ensureList(pool);
  const r = await pool.request().input("n", sql.Int, Number(limit) || 40).query(`
    SELECT TOP (@n) m.id, m.agent_id, m.owner_id, m.param_score, m.photo_match, m.photo_conf,
      m.photo_why, m.human_ok, m.found_at,
      a.title a_title, a.city a_city, a.area a_area, a.rooms a_rooms, a.floor a_floor, a.floors a_floors,
      a.price a_price, a.deal a_deal, a.prop a_prop, a.complex_id a_cx, a.lat a_lat, a.lon a_lon,
      a.addr a_addr, a.storage a_storage, a.bumped_on a_bumped, a.first_seen a_seen, a.photos_c a_pc, a.photos_json a_pj,
      o.title o_title, o.city o_city, o.area o_area, o.rooms o_rooms, o.floor o_floor, o.floors o_floors,
      o.price o_price, o.complex_id o_cx, o.lat o_lat, o.lon o_lon,
      o.addr o_addr, o.storage o_storage, o.bumped_on o_bumped, o.first_seen o_seen, o.phones o_phones, o.photos_c o_pc, o.photos_json o_pj
    FROM dbo.krisha_list_matches m
    JOIN dbo.krisha_list a ON a.id = m.agent_id
    JOIN dbo.krisha_list o ON o.id = m.owner_id
    ORDER BY m.found_at DESC`);
  return r.recordset;
}

async function setListHumanOk(logId, ok) {
  const pool = await getPool();
  await pool.request()
    .input("id", sql.BigInt, Number(logId))
    .input("ok", sql.Bit, ok == null ? null : (ok ? 1 : 0))
    .query("UPDATE dbo.krisha_list_matches SET human_ok = @ok WHERE id = @id");
}

// Размер базы: лимит и занято, и кто сколько занимает по таблицам и индексам.
// Нужно, когда Azure SQL упирается в квоту и надо решать, что резать.
async function dbSize() {
  const pool = await getPool();
  const head = (await pool.request().query(`
    SELECT DB_NAME() AS db,
      CAST(DATABASEPROPERTYEX(DB_NAME(), 'MaxSizeInBytes') AS BIGINT) / 1048576 AS max_mb,
      (SELECT SUM(CAST(FILEPROPERTY(name, 'SpaceUsed') AS BIGINT)) * 8 / 1024 FROM sys.database_files WHERE type_desc = 'ROWS') AS used_mb,
      (SELECT SUM(CAST(size AS BIGINT)) * 8 / 1024 FROM sys.database_files WHERE type_desc = 'ROWS') AS allocated_mb`)).recordset[0];
  const parts = (await pool.request().query(`
    SELECT t.name AS table_name, ISNULL(i.name, '(heap)') AS index_name, i.type_desc,
      SUM(ps.used_page_count) * 8 / 1024 AS used_mb,
      SUM(CASE WHEN i.index_id IN (0, 1) THEN ps.row_count ELSE 0 END) AS rows_
    FROM sys.dm_db_partition_stats ps
    JOIN sys.indexes i ON i.object_id = ps.object_id AND i.index_id = ps.index_id
    JOIN sys.tables t ON t.object_id = ps.object_id
    GROUP BY t.name, i.name, i.type_desc
    HAVING SUM(ps.used_page_count) * 8 / 1024 >= 1
    ORDER BY used_mb DESC`)).recordset;
  const byTable = {};
  for (const p of parts) { byTable[p.table_name] = (byTable[p.table_name] || 0) + Number(p.used_mb); }
  // Нагрузка за последние минуты (Azure SQL пишет её раз в 15 секунд): если
  // CPU, IO или журнал у 100% — база упёрлась в DTU, а не в место.
  let load = [];
  try {
    load = (await pool.request().query(`
      SELECT TOP (8) CONVERT(varchar(19), end_time, 120) AS at, avg_cpu_percent AS cpu, avg_data_io_percent AS io,
        avg_log_write_percent AS log_write, dtu_limit
      FROM sys.dm_db_resource_stats ORDER BY end_time DESC`)).recordset;
  } catch { /* нет прав или не Azure */ }
  let running = [];
  try {
    running = (await pool.request().query(`
      SELECT TOP (10) r.session_id, r.status, r.wait_type, r.wait_time / 1000 AS wait_s, r.total_elapsed_time / 1000 AS elapsed_s,
        LEFT(t.text, 90) AS sql_text
      FROM sys.dm_exec_requests r CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
      WHERE r.session_id <> @@SPID ORDER BY r.total_elapsed_time DESC`)).recordset;
  } catch { /* нет прав */ }
  return { db: head, load: load, running: running,
    tables: Object.entries(byTable).sort((a, b) => b[1] - a[1]).map(([t, mb]) => ({ table: t, used_mb: mb })), parts: parts };
}

// Фото объявления из списка — уменьшенные 560x350, как у objectPhotos.
// Сначала компактная колонка, потом старое JSON-поле (пока не перенесено).
function listPhotoUrls(photosC, photosJson) {
  let arr = [];
  if (photosC) arr = require("./krisha-list.js").unpackPhotos(photosC);
  else if (photosJson) { try { arr = JSON.parse(photosJson); } catch { arr = []; } }
  return (Array.isArray(arr) ? arr : []).map((u) => String(u).replace(/-full\.jpg$/, "-560x350.jpg")).filter(Boolean);
}

// Перенос старых строк: photos_json -> photos_c, старое поле обнуляем, и
// место освобождается по ходу. Пачками, чтобы не держать базу; возвращает
// сколько перенесли и сколько осталось.
// Идём по id (кластерный ключ, дёшево), а не «WHERE photos_json IS NOT NULL»
// — такой поиск по LOB-колонке на 10 DTU не укладывался в таймаут.
async function migrateListPhotos(batch, afterId) {
  const pool = await getPool();
  await ensureList(pool);
  const L = require("./krisha-list.js");
  const n = Math.max(1, Math.min(2000, Number(batch) || 500));
  const rows = (await pool.request().input("n", sql.Int, n).input("after", sql.BigInt, Number(afterId) || 0)
    .query("SELECT TOP (@n) id, photos_json FROM dbo.krisha_list WHERE id > @after ORDER BY id")).recordset;
  let done = 0;
  const todo = rows.filter((r) => r.photos_json);
  for (let i = 0; i < todo.length; i += 5) {
    await Promise.all(todo.slice(i, i + 5).map(async (r) => {
      let urls = [];
      try { urls = JSON.parse(r.photos_json || "[]"); } catch { urls = []; }
      await pool.request()
        .input("id", sql.BigInt, Number(r.id))
        .input("pc", sql.VarChar(2000), L.packPhotos(urls))
        .query("UPDATE dbo.krisha_list SET photos_c = COALESCE(photos_c, @pc), photos_json = NULL WHERE id = @id");
      done++;
    }));
  }
  return { done: done, scanned: rows.length, lastId: rows.length ? Number(rows[rows.length - 1].id) : Number(afterId) || 0,
           finished: rows.length < n };
}

// Страница списка одним запросом: MERGE по VALUES из всех строк и один INSERT
// событий. На 10 DTU двадцать отдельных MERGE на страницу были главным
// потребителем базы; так — один обмен вместо двадцати с лишним.
async function saveListAdverts(rows, sweepNo) {
  const list = (rows || []).filter((o) => o && o.id);
  if (!list.length) return [];
  const pool = await getPool();
  await ensureList(pool);
  const L = require("./krisha-list.js");
  const cut = (v, n) => (v == null || v === "" ? null : String(v).slice(0, n));
  const req = pool.request().input("sweep", sql.Int, sweepNo == null ? null : Number(sweepNo));
  const vals = [];
  list.forEach((o, k) => {
    req.input("id" + k, sql.BigInt, Number(o.id))
      .input("deal" + k, sql.NVarChar(10), cut(o.deal, 10))
      .input("prop" + k, sql.NVarChar(20), cut(o.prop, 20))
      .input("ut" + k, sql.NVarChar(20), cut(o.userType, 20))
      .input("city" + k, sql.NVarChar(40), cut(o.city, 40))
      .input("price" + k, sql.BigInt, o.price == null ? null : Number(o.price))
      .input("rooms" + k, sql.Int, o.rooms == null ? null : Number(o.rooms))
      .input("area" + k, sql.Decimal(9, 2), o.area == null ? null : Number(o.area))
      .input("floor" + k, sql.Int, o.floor == null ? null : Number(o.floor))
      .input("floors" + k, sql.Int, o.floors == null ? null : Number(o.floors))
      .input("cxid" + k, sql.BigInt, o.complexId == null ? null : Number(o.complexId))
      .input("lat" + k, sql.Decimal(11, 7), o.lat == null ? null : Number(o.lat))
      .input("lon" + k, sql.Decimal(11, 7), o.lon == null ? null : Number(o.lon))
      .input("title" + k, sql.NVarChar(300), cut(o.title, 300))
      .input("addr" + k, sql.NVarChar(300), cut(o.addr, 300))
      .input("owner" + k, sql.NVarChar(120), cut(o.ownerName, 120))
      .input("photos" + k, sql.Int, o.photos == null ? null : Number(o.photos))
      .input("photo1" + k, sql.NVarChar(300), cut(o.photo1, 300))
      .input("storage" + k, sql.NVarChar(20), cut(o.storage, 20))
      .input("bumped" + k, sql.Date, o.bumpedOn || null)
      .input("pc" + k, sql.VarChar(2000), L.packPhotos(o.photoUrls));
    vals.push("(@id" + k + ",@deal" + k + ",@prop" + k + ",@ut" + k + ",@city" + k + ",@price" + k + ",@rooms" + k +
      ",@area" + k + ",@floor" + k + ",@floors" + k + ",@cxid" + k + ",@lat" + k + ",@lon" + k + ",@title" + k +
      ",@addr" + k + ",@owner" + k + ",@photos" + k + ",@photo1" + k + ",@storage" + k + ",@bumped" + k + ",@pc" + k + ")");
  });
  const r = await req.query(`
    MERGE dbo.krisha_list AS t
    USING (VALUES ${vals.join(",")}) AS s
      (id, deal, prop, user_type, city, price, rooms, area, floor, floors, complex_id, lat, lon,
       title, addr, owner_name, photos, photo1, storage, bumped_on, photos_c)
    ON t.id = s.id
    WHEN MATCHED THEN UPDATE SET
      deal = s.deal, prop = s.prop, user_type = s.user_type, city = COALESCE(s.city, t.city),
      price = s.price, rooms = s.rooms, area = s.area, floor = s.floor, floors = s.floors,
      complex_id = s.complex_id, lat = s.lat, lon = s.lon, title = s.title, addr = s.addr,
      owner_name = s.owner_name, photos = s.photos, photo1 = s.photo1, storage = s.storage,
      bumped_on = COALESCE(s.bumped_on, t.bumped_on), photos_c = COALESCE(s.photos_c, t.photos_c), photos_json = NULL,
      last_seen = SYSUTCDATETIME(), seen_count = t.seen_count + 1, sweep_no = @sweep
    WHEN NOT MATCHED THEN INSERT
      (id, deal, prop, user_type, city, price, rooms, area, floor, floors, complex_id, lat, lon,
       title, addr, owner_name, photos, photo1, storage, bumped_on, photos_c, sweep_no)
      VALUES (s.id, s.deal, s.prop, s.user_type, s.city, s.price, s.rooms, s.area, s.floor, s.floors, s.complex_id, s.lat, s.lon,
       s.title, s.addr, s.owner_name, s.photos, s.photo1, s.storage, s.bumped_on, s.photos_c, @sweep)
    OUTPUT $action AS act, inserted.id AS id, deleted.price AS old_price, deleted.storage AS old_storage,
           deleted.bumped_on AS old_bumped;`);
  const byId = {};
  for (const row of r.recordset) byId[String(row.id)] = row;
  const out = [];
  const events = [];
  for (const o of list) {
    const row = byId[String(o.id)] || {};
    const res = { id: o.id, added: row.act === "INSERT", price: false, archived: false, back: false, bump: false };
    if (res.added) events.push([o.id, "new", null, o.price]);
    else if (row.act === "UPDATE") {
      const oldP = row.old_price == null ? null : Number(row.old_price);
      if (oldP != null && o.price != null && oldP !== Number(o.price)) { res.price = true; events.push([o.id, "price", oldP, o.price]); }
      const was = row.old_storage || null, now = o.storage || null;
      if (was !== now && (was === "live" || now === "live")) {
        if (now === "live") { res.back = true; events.push([o.id, "back", null, null]); }
        else { res.archived = true; events.push([o.id, "archived", null, null]); }
      }
      const oldB = row.old_bumped ? new Date(row.old_bumped).toISOString().slice(0, 10) : null;
      if (oldB && o.bumpedOn && o.bumpedOn > oldB) { res.bump = true; events.push([o.id, "bump", null, null]); }
    }
    out.push(res);
  }
  if (events.length) {
    const er = pool.request().input("sweep", sql.Int, sweepNo == null ? null : Number(sweepNo));
    const ev = events.map(([id, kind, op, np], k) => {
      er.input("eid" + k, sql.BigInt, Number(id)).input("ek" + k, sql.NVarChar(16), kind)
        .input("eo" + k, sql.BigInt, op == null ? null : Number(op)).input("en" + k, sql.BigInt, np == null ? null : Number(np));
      return "(@eid" + k + ",@ek" + k + ",@eo" + k + ",@en" + k + ",@sweep)";
    });
    await er.query("INSERT INTO dbo.krisha_list_events (id, kind, old_price, new_price, sweep_no) VALUES " + ev.join(","));
  }
  return out;
}

async function listStats() {
  const pool = await getPool();
  await ensureList(pool);
  const tot = (await pool.request().query(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN storage = 'live' THEN 1 ELSE 0 END) AS live,
      SUM(CASE WHEN user_type = 'owner' THEN 1 ELSE 0 END) AS owner,
      SUM(CASE WHEN city IS NULL THEN 1 ELSE 0 END) AS city_null,
      SUM(CASE WHEN lat IS NOT NULL THEN 1 ELSE 0 END) AS with_geo,
      SUM(CASE WHEN complex_id IS NOT NULL THEN 1 ELSE 0 END) AS with_complex,
      MIN(first_seen) AS since
    FROM dbo.krisha_list`)).recordset[0];
  const ev = (await pool.request().query(`
    SELECT kind, COUNT(*) AS n FROM dbo.krisha_list_events
    WHERE at >= DATEADD(hour, -24, SYSUTCDATETIME()) GROUP BY kind`)).recordset;
  const bumps = (await pool.request().query(`
    SELECT bumped_on, COUNT(*) AS n FROM dbo.krisha_list
    WHERE bumped_on >= DATEADD(day, -7, CAST(SYSUTCDATETIME() AS DATE))
    GROUP BY bumped_on ORDER BY bumped_on DESC`)).recordset;
  const byDeal = (await pool.request().query(`
    SELECT deal, prop, COUNT(*) AS n FROM dbo.krisha_list GROUP BY deal, prop`)).recordset;
  // Телефоны хозяев: сколько уже с номером, сколько живых ещё без него.
  const ph=(await pool.request().query(`
    SELECT
      (SELECT COUNT(*) FROM dbo.krisha_list WHERE user_type = 'owner' AND phones IS NOT NULL) AS owners_with_phone,
      (SELECT COUNT(*) FROM dbo.krisha_list WHERE user_type = 'owner' AND storage = 'live' AND phones IS NULL) AS owners_live_no_phone`)).recordset[0];
  return { total: tot, events24h: ev, byDealProp: byDeal, bumpedByDay: bumps, phones: ph };
}

// Кто быстрее и полнее: список карты или обход по id. Считаем по общему
// окну — с момента, когда список начал писать.
async function listCompare() {
  const pool = await getPool();
  await ensureList(pool);
  await ensureObjects(pool);
  const r = (await pool.request().query(`
    DECLARE @since DATETIME2(0) = (SELECT MIN(first_seen) FROM dbo.krisha_list);
    SELECT
      @since AS since,
      (SELECT COUNT(*) FROM dbo.krisha_list) AS list_total,
      (SELECT COUNT(*) FROM dbo.krisha_objects) AS obj_total,
      (SELECT COUNT(*) FROM dbo.krisha_list l WHERE NOT EXISTS (SELECT 1 FROM dbo.krisha_objects o WHERE o.id = l.id)) AS list_only,
      (SELECT COUNT(*) FROM dbo.krisha_list l WHERE l.storage = 'live' AND l.id >= (SELECT MIN(id) FROM dbo.krisha_objects)
         AND NOT EXISTS (SELECT 1 FROM dbo.krisha_objects o WHERE o.id = l.id)) AS list_only_in_scan_range,
      (SELECT COUNT(*) FROM dbo.krisha_objects o WHERE o.first_seen >= @since
         AND NOT EXISTS (SELECT 1 FROM dbo.krisha_list l WHERE l.id = o.id)) AS obj_only_since,
      (SELECT COUNT(*) FROM dbo.krisha_list l JOIN dbo.krisha_objects o ON o.id = l.id
         WHERE o.first_seen >= @since AND l.first_seen < o.first_seen) AS list_first,
      (SELECT COUNT(*) FROM dbo.krisha_list l JOIN dbo.krisha_objects o ON o.id = l.id
         WHERE o.first_seen >= @since AND l.first_seen > o.first_seen) AS scan_first,
      (SELECT AVG(CAST(DATEDIFF(minute, o.first_seen, l.first_seen) AS FLOAT)) FROM dbo.krisha_list l JOIN dbo.krisha_objects o ON o.id = l.id
         WHERE o.first_seen >= @since AND l.first_seen >= @since) AS avg_list_minus_scan_min`)).recordset[0];
  return r;
}

// Какие из этих id уже есть в krisha_objects. Скан спрашивает это перед
// чтением окна и не тратит прокси на то, что уже лежит в базе (например,
// пришло минутой раньше через выдачу).
async function knownObjectIds(ids) {
  const list = (ids || []).map((x) => Number(x)).filter(Boolean);
  if (!list.length) return new Set();
  const pool = await getPool();
  await ensureObjects(pool);
  const have = new Set();
  for (let i = 0; i < list.length; i += 200) {
    const chunk = list.slice(i, i + 200);
    const req = pool.request();
    const names = chunk.map((id, n) => { req.input("i" + n, sql.BigInt, id); return "@i" + n; });
    const r = await req.query("SELECT id FROM dbo.krisha_objects WHERE id IN (" + names.join(",") + ")");
    r.recordset.forEach((x) => have.add(String(x.id)));
  }
  return have;
}

// Дата поднятия для строки, сохранённой до появления колонки added_on: берём
// из сохранённого window.data и дописываем в колонку, чтобы второй раз не
// распаковывать. Возвращает строку YYYY-MM-DD или null.
async function fillAddedOn(id) {
  const pool = await getPool();
  const r = await pool.request().input("id", sql.BigInt, Number(id))
    .query("SELECT added_on, data_gz FROM dbo.krisha_objects WHERE id = @id");
  if (!r.recordset.length) return null;
  const row = r.recordset[0];
  if (row.added_on) return row.added_on;
  if (!row.data_gz) return null;
  let added = null;
  try {
    const j = JSON.parse(require("zlib").gunzipSync(row.data_gz).toString("utf8"));
    const c = (j.adverts && j.adverts[0]) || {};
    added = c.addedAt || null;
  } catch { return null; }
  if (!added) return null;
  await pool.request().input("id", sql.BigInt, Number(id)).input("d", sql.Date, added)
    .query("UPDATE dbo.krisha_objects SET added_on = @d WHERE id = @id AND added_on IS NULL").catch(() => {});
  return added;
}

// Записать кандидата в журнал находок (для ручной проверки и статистики).
async function logMatchCandidate(m) {
  const pool = await getPool();
  await ensureObjects(pool);
  await pool.request()
    .input("agent", sql.BigInt, Number(m.agentId))
    .input("owner", sql.BigInt, Number(m.ownerId))
    .input("deal", sql.NVarChar(10), m.deal || null)
    .input("prop", sql.NVarChar(20), m.prop || null)
    .input("city", sql.NVarChar(40), m.city || null)
    .input("score", sql.Int, m.paramScore == null ? null : Number(m.paramScore))
    .input("pm", sql.Bit, m.photoMatch == null ? null : (m.photoMatch ? 1 : 0))
    .input("pc", sql.Float, m.photoConf == null ? null : Number(m.photoConf))
    .input("pw", sql.NVarChar(400), m.photoWhy ? String(m.photoWhy).slice(0, 400) : null)
    .query(`INSERT INTO dbo.krisha_match_log
      (agent_id, owner_id, deal, prop, city, param_score, photo_match, photo_conf, photo_why)
      VALUES (@agent, @owner, @deal, @prop, @city, @score, @pm, @pc, @pw)`);
}

// Самый большой известный id — стартовая точка курсора сканера: дальше него
// объявлений ещё нет, оттуда и идём вперёд. Берём максимум из обеих таблиц.
async function maxKnownId() {
  const pool = await getPool();
  await ensureObjects(pool);
  const r = await pool.request().query(
    "SELECT MAX(m) AS mx FROM (SELECT MAX(id) AS m FROM dbo.krisha_flats " +
    "UNION ALL SELECT MAX(id) AS m FROM dbo.krisha_objects) x");
  // mssql отдаёт BIGINT строкой — вернём число, иначе cursor + k склеит строки.
  return r.recordset[0].mx == null ? null : Number(r.recordset[0].mx);
}

// Одно объявление из потока: разобранные поля + сам window.data (gzip).
async function saveObject(o) {
  const pool = await getPool();
  await ensureObjects(pool);
  await pool.request()
    .input("id", sql.BigInt, Number(o.id))
    .input("deal", sql.NVarChar(10), o.deal || null)
    .input("prop", sql.NVarChar(20), o.prop || null)
    .input("ut", sql.NVarChar(20), o.userType || null)
    .input("city", sql.NVarChar(40), o.city || null)
    .input("created", sql.Date, o.createdOn || null)
    .input("added", sql.Date, o.addedOn || null)
    .input("price", sql.BigInt, o.price == null ? null : Number(o.price))
    .input("rooms", sql.Int, o.rooms == null ? null : Number(o.rooms))
    .input("area", sql.Decimal(9, 2), o.area == null ? null : Number(o.area))
    .input("lat", sql.Decimal(11, 7), o.lat == null ? null : Number(o.lat))
    .input("lon", sql.Decimal(11, 7), o.lon == null ? null : Number(o.lon))
    .input("title", sql.NVarChar(300), o.title || null)
    .input("floor", sql.Int, o.floor == null ? null : Number(o.floor))
    .input("floors", sql.Int, o.floors == null ? null : Number(o.floors))
    .input("cxid", sql.BigInt, o.complexId == null ? null : Number(o.complexId))
    .input("district", sql.NVarChar(120), o.district || null)
    .input("mkr", sql.NVarChar(120), o.mkr || null)
    .input("sslug", sql.NVarChar(160), o.streetSlug || null)
    .input("hnum", sql.NVarChar(40), o.houseNum || null)
    .input("byear", sql.Int, o.buildYear == null ? null : Number(o.buildYear))
    .input("house", sql.NVarChar(60), o.house || null)
    .input("toilet", sql.NVarChar(40), o.toilet || null)
    .input("gz", sql.VarBinary(sql.MAX), o.dataGz || null)
    .query(`
      MERGE dbo.krisha_objects AS t
      USING (SELECT @id AS id) AS s ON t.id = s.id
      WHEN MATCHED THEN UPDATE SET
        deal = @deal, prop = @prop, user_type = @ut, city = @city,
        created_on = COALESCE(@created, t.created_on), added_on = COALESCE(@added, t.added_on),
        price = @price, rooms = @rooms,
        area = @area, lat = @lat, lon = @lon, title = @title,
        floor = @floor, floors = @floors, complex_id = @cxid, district = @district,
        mkr = @mkr, street_slug = @sslug, house_num = @hnum,
        build_year = COALESCE(@byear, t.build_year), house = COALESCE(@house, t.house),
        toilet = COALESCE(@toilet, t.toilet),
        data_gz = COALESCE(@gz, t.data_gz), last_seen = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT
        (id, deal, prop, user_type, city, created_on, added_on, price, rooms, area, lat, lon, title,
         floor, floors, complex_id, district, mkr, street_slug, house_num, build_year, house, toilet, data_gz)
        VALUES (@id, @deal, @prop, @ut, @city, @created, @added, @price, @rooms, @area, @lat, @lon, @title,
         @floor, @floors, @cxid, @district, @mkr, @sslug, @hnum, @byear, @house, @toilet, @gz);`);
}

// Узнать ту же самую недвижимость в объявлении агента — но по полному потоку
// (krisha_objects), не только по квартирам-на-продажу. Возвращаем объявления
// ХОЗЯЕВ той же сделки и типа (аренда против аренды, дом против дома). Логика
// та же, что в findFlats: дом опознаём по ЖК или координатам (любой из двух),
// дальше площадь/комнаты/этаж; поле неизвестно с одной стороны — не исключаем.
async function findObjects(q, limit) {
  const pool = await getPool();
  await ensureObjects(pool);
  const area = Number(q.area);
  if (!area) return [];
  const tol = 5; // площадь иногда указывают неверно — тот же допуск, что в findFlats
  const r = await pool.request()
    .input("deal", sql.NVarChar(10), q.deal || null)
    .input("prop", sql.NVarChar(20), q.prop || null)
    .input("lo", sql.Decimal(9, 2), area - tol)
    .input("hi", sql.Decimal(9, 2), area + tol)
    .input("city", sql.NVarChar(40), q.city || null)
    .input("rooms", sql.Int, q.rooms ? Number(q.rooms) : null)
    .input("floor", sql.Int, q.floor ? Number(q.floor) : null)
    .input("floors", sql.Int, q.floors ? Number(q.floors) : null)
    .input("cxid", sql.BigInt, q.complexId ? Number(q.complexId) : null)
    .input("district", sql.NVarChar(120), q.district || null)
    .input("sslug", sql.NVarChar(160), q.streetSlug || null)
    .input("hnum", sql.NVarChar(40), q.houseNum || null)
    .input("lat", sql.Decimal(11, 7), q.lat == null ? null : Number(q.lat))
    .input("lon", sql.Decimal(11, 7), q.lon == null ? null : Number(q.lon))
    .input("year", sql.Int, q.buildYear ? Number(q.buildYear) : null)
    .input("house", sql.NVarChar(60), q.house || null)
    .input("toilet", sql.NVarChar(40), q.toilet || null)
    .input("exid", sql.BigInt, q.id ? Number(q.id) : null)
    .input("n", sql.Int, Number(limit) || 12)
    .query(`
      SELECT TOP (@n) f.id, f.deal, f.prop, f.user_type, f.city, f.area, f.rooms, f.floor, f.floors,
        f.complex_id, f.district, f.street_slug, f.house_num, f.lat, f.lon, f.price, f.title, f.created_on,
        f.added_on, f.first_seen, f.build_year, f.house, f.toilet,
        IIF(@rooms IS NOT NULL AND f.rooms = @rooms, 2, 0)
          + IIF(@cxid IS NOT NULL AND f.complex_id = @cxid, 4, 0)
          + IIF(@lat IS NOT NULL AND f.lat IS NOT NULL
                AND ABS(f.lat - @lat) < 0.0006 AND ABS(f.lon - @lon) < 0.0008, 6, 0)
          + IIF(@sslug IS NOT NULL AND f.street_slug = @sslug, 3, 0)
          + IIF(@hnum IS NOT NULL AND @sslug IS NOT NULL
                AND f.house_num = @hnum AND f.street_slug = @sslug, 4, 0)
          + IIF(@floor IS NOT NULL AND f.floor = @floor, 2, 0)
          + IIF(@floors IS NOT NULL AND f.floors = @floors, 1, 0)
          + IIF(@district IS NOT NULL AND f.district = @district, 1, 0)
          + IIF(@year IS NOT NULL AND f.build_year = @year, 1, 0)
          + IIF(@house IS NOT NULL AND f.house = @house, 1, 0)
          + IIF(@toilet IS NOT NULL AND f.toilet = @toilet, 1, 0) AS score
      FROM dbo.krisha_objects f
      WHERE f.user_type = 'owner'
        AND (@deal IS NULL OR f.deal = @deal)
        AND (@prop IS NULL OR f.prop = @prop)
        AND (@exid IS NULL OR f.id <> @exid)
        AND f.area BETWEEN @lo AND @hi
        AND (@city IS NULL OR f.city = @city)
        AND (@rooms IS NULL OR f.rooms IS NULL OR f.rooms = @rooms)
        AND (@floor IS NULL OR f.floor IS NULL OR f.floor = @floor)
        AND (@floors IS NULL OR f.floors IS NULL OR f.floors = @floors)
        AND (@hnum IS NULL OR f.house_num IS NULL OR @sslug IS NULL OR f.street_slug IS NULL
             OR f.street_slug <> @sslug OR f.house_num = @hnum)
        AND (@lat IS NULL OR f.lat IS NULL
             OR (ABS(f.lat - @lat) < 0.0006 AND ABS(f.lon - @lon) < 0.0008))
        -- Год постройки/тип дома/санузел — null-tolerant: исключаем, только
        -- если поле известно с обеих сторон и не совпало (год ±1 на разнобой).
        AND (@year IS NULL OR f.build_year IS NULL OR ABS(f.build_year - @year) <= 1)
        AND (@house IS NULL OR f.house IS NULL OR f.house = @house)
        AND (@toilet IS NULL OR f.toilet IS NULL OR f.toilet = @toilet)
        -- Опознание дома обязательно: ЖК или координаты, любой из двух.
        AND (
          (@cxid IS NOT NULL AND f.complex_id = @cxid)
          OR (@lat IS NOT NULL AND f.lat IS NOT NULL
              AND ABS(f.lat - @lat) < 0.0006 AND ABS(f.lon - @lon) < 0.0008)
        )
      ORDER BY score DESC, f.id DESC`);
  return r.recordset;
}

// Свежие агентские объявления, для которых ещё не искали оригинал хозяина.
// Только те, у кого есть по чему опознать дом (ЖК или координаты) и площадь —
// иначе искать нечем. Застройщиков (complex) не берём: у них нет «хозяина».
async function agentsToMatch(limit) {
  const pool = await getPool();
  await ensureObjects(pool);
  const r = await pool.request().input("n", sql.Int, Number(limit) || 100).query(`
    SELECT TOP (@n) id, deal, prop, city, area, rooms, floor, floors,
      complex_id, district, street_slug, house_num, lat, lon, build_year, house, toilet, title, user_type,
      created_on, added_on, first_seen
    FROM dbo.krisha_objects
    WHERE searched_at IS NULL
      AND user_type IN ('specialist', 'company', 'agent')
      AND area IS NOT NULL
      AND (complex_id IS NOT NULL OR lat IS NOT NULL)
    ORDER BY id DESC`);
  return r.recordset;
}

// Отметить, что по агентскому объявлению искали, и записать исход.
async function recordSearched(id, count, topId) {
  const pool = await getPool();
  await pool.request()
    .input("id", sql.BigInt, Number(id))
    .input("cnt", sql.Int, Number(count) || 0)
    .input("top", sql.BigInt, topId ? Number(topId) : null)
    .query(`UPDATE dbo.krisha_objects
            SET searched_at = SYSUTCDATETIME(), match_count = @cnt, match_top = @top
            WHERE id = @id`);
}

// Эффективность инструмента: сколько агентских проверили и у скольких нашёлся
// хозяин — всего и по дням. По этому видно рост со временем.
async function matchStats() {
  const pool = await getPool();
  await ensureObjects(pool);
  const tot = (await pool.request().query(`
    SELECT
      COUNT(*) AS searched,
      SUM(CASE WHEN match_count > 0 THEN 1 ELSE 0 END) AS matched
    FROM dbo.krisha_objects WHERE searched_at IS NOT NULL`)).recordset[0];
  const byDay = (await pool.request().query(`
    SELECT CAST(searched_at AS DATE) AS day,
      COUNT(*) AS searched,
      SUM(CASE WHEN match_count > 0 THEN 1 ELSE 0 END) AS matched
    FROM dbo.krisha_objects WHERE searched_at IS NOT NULL
    GROUP BY CAST(searched_at AS DATE) ORDER BY day DESC`)).recordset;
  return { total: tot, byDay: byDay };
}

// Находки для дашборда-ревью: последние строки журнала с деталями искомого
// (агентского) и кандидата (хозяина) рядом — для ручной проверки по фото.
async function matchReviewRows(limit) {
  const pool = await getPool();
  await ensureObjects(pool);
  const r = await pool.request().input("n", sql.Int, Number(limit) || 40).query(`
    SELECT TOP (@n) m.id, m.agent_id, m.owner_id, m.param_score, m.photo_match, m.photo_conf,
      m.photo_why, m.human_ok, m.found_at,
      a.title a_title, a.city a_city, a.area a_area, a.rooms a_rooms, a.floor a_floor,
      a.floors a_floors, a.price a_price, a.deal a_deal, a.prop a_prop,
      a.build_year a_year, a.house a_house, a.toilet a_toilet,
      a.complex_id a_cx, a.lat a_lat, a.lon a_lon, a.district a_district,
      a.street_slug a_sslug, a.house_num a_hnum,
      a.created_on a_created, a.added_on a_added, a.first_seen a_seen,
      o.created_on o_created, o.added_on o_added, o.first_seen o_seen,
      o.title o_title, o.area o_area, o.rooms o_rooms, o.floor o_floor, o.floors o_floors,
      o.price o_price, o.build_year o_year, o.house o_house, o.toilet o_toilet,
      o.complex_id o_cx, o.lat o_lat, o.lon o_lon, o.district o_district,
      o.street_slug o_sslug, o.house_num o_hnum
    FROM dbo.krisha_match_log m
    JOIN dbo.krisha_objects a ON a.id = m.agent_id
    JOIN dbo.krisha_objects o ON o.id = m.owner_id
    ORDER BY m.found_at DESC`);
  return r.recordset;
}

// Ручная отметка результата: 1 — та же квартира, 0 — нет, null — снять отметку.
async function setHumanOk(logId, ok) {
  const pool = await getPool();
  await pool.request()
    .input("id", sql.BigInt, Number(logId))
    .input("ok", sql.Bit, ok == null ? null : (ok ? 1 : 0))
    .query("UPDATE dbo.krisha_match_log SET human_ok = @ok WHERE id = @id");
}

// Данные для дашборда собственника: сколько импортировано по дням (с
// разбивкой на сделку и продавца) и эффективность поиска по дням. Отдаём за
// 60 дней разом, а периоды (1/7/30/60) клиент режет сам.
async function ownerDashboard(days) {
  const pool = await getPool();
  await ensureObjects(pool);
  const d = Math.min(120, Math.max(1, Number(days) || 60));
  const imports = (await pool.request().input("d", sql.Int, d).query(`
    SELECT CONVERT(char(10), first_seen, 23) AS day, COUNT(*) AS total,
      SUM(CASE WHEN deal='sale' THEN 1 ELSE 0 END) AS sale,
      SUM(CASE WHEN deal='rent' THEN 1 ELSE 0 END) AS rent,
      SUM(CASE WHEN user_type='owner' THEN 1 ELSE 0 END) AS owner,
      SUM(CASE WHEN user_type='specialist' THEN 1 ELSE 0 END) AS specialist,
      SUM(CASE WHEN user_type IN ('company','agent') THEN 1 ELSE 0 END) AS company,
      SUM(CASE WHEN user_type='complex' THEN 1 ELSE 0 END) AS complex,
      SUM(CASE WHEN prop='flat' THEN 1 ELSE 0 END) AS flat,
      SUM(CASE WHEN prop='house' THEN 1 ELSE 0 END) AS house,
      SUM(CASE WHEN prop NOT IN ('flat','house') THEN 1 ELSE 0 END) AS other
    FROM dbo.krisha_objects
    WHERE first_seen >= DATEADD(day, -@d, SYSUTCDATETIME())
    GROUP BY CONVERT(char(10), first_seen, 23) ORDER BY day`)).recordset;
  const searched = (await pool.request().input("d", sql.Int, d).query(`
    SELECT CONVERT(char(10), searched_at, 23) AS day, COUNT(*) AS searched,
      SUM(CASE WHEN match_count > 0 THEN 1 ELSE 0 END) AS matched
    FROM dbo.krisha_objects
    WHERE searched_at IS NOT NULL AND searched_at >= DATEADD(day, -@d, SYSUTCDATETIME())
    GROUP BY CONVERT(char(10), searched_at, 23) ORDER BY day`)).recordset;
  const photos = (await pool.request().input("d", sql.Int, d).query(`
    SELECT CONVERT(char(10), found_at, 23) AS day,
      COUNT(DISTINCT CASE WHEN photo_match = 1 THEN agent_id END) AS photo_ok,
      COUNT(DISTINCT CASE WHEN human_ok = 1 THEN agent_id END) AS human_ok
    FROM dbo.krisha_match_log
    WHERE found_at >= DATEADD(day, -@d, SYSUTCDATETIME())
    GROUP BY CONVERT(char(10), found_at, 23) ORDER BY day`)).recordset;
  return { imports: imports, searched: searched, photos: photos };
}

// --- Крыша objects: телефоны хозяев ----------------------------------------

// Чем может кончиться попытка снять номер, и что с объектом делать дальше.
//  final    — объекта на Крыше больше нет, в очередь не возвращаем никогда.
//  retryMin — пауза до следующей попытки; растёт с каждым промахом
//             (retryMin × номер попытки), чтобы не долбить одну страницу.
// Любой промах — плюс один к phone_tries; после пяти объект выпадает
// насовсем, какая бы ни была причина.
const PHONE_MISS = {
  archived:  { final: true },    // объявление открывается, но снято / в архиве
  not_found: { final: true },    // страницы нет вовсе: Крыша отдаёт 404
  no_phone: { retryMin: 1440 },  // страница живая, но номера нет (только чат)
  captcha:  { retryMin: 30 },    // капча показалась и не решена
  timeout:  { retryMin: 60 },    // страница или кнопка не дождались
  error:    { retryMin: 60 },    // всё остальное
};
const PHONE_MISS_REASONS = Object.keys(PHONE_MISS);
// Состояния, после которых объект в очередь не возвращается, — списком в SQL.
const PHONE_FINAL_SQL = PHONE_MISS_REASONS.filter((k) => PHONE_MISS[k].final).map((k) => "'" + k + "'").join(", ");

// Следующий объект без сохранённого номера — один, а не пачка: плагин на
// той стороне снимает номера по одному и каждый раз спрашивает «кого дальше».
// since — нижняя граница по дате публикации (YYYY-MM-DD); от неё идём вверх,
// к сегодняшнему дню: что старее в окне — то раньше. Курсор клиенту не нужен:
// как только у объекта появился номер (или он выбыл по промахам), он сам
// выпадает из очереди, и следующий вызов отдаёт следующий. Объекты на паузе
// (phone_next_at в будущем) пропускаем — они вернутся, когда пауза выйдет.
async function nextObjectWithoutPhone(since) {
  const pool = await getPool();
  await ensureObjects(pool);
  const ready = `phones IS NULL AND created_on >= @since
        AND ISNULL(phone_tries, 0) < 5
        AND (phone_state IS NULL OR phone_state NOT IN (${PHONE_FINAL_SQL}))`;
  const now = "(phone_next_at IS NULL OR phone_next_at <= SYSUTCDATETIME())";
  const r = await pool.request()
    .input("since", sql.Date, since)
    .query(`
      SELECT TOP (1) id, title, deal, prop, city, user_type, created_on, phone_tries, phone_state
      FROM dbo.krisha_objects
      WHERE ${ready} AND ${now}
      ORDER BY created_on ASC, id ASC`);
  const c = (await pool.request()
    .input("since", sql.Date, since)
    .query(`SELECT
              SUM(CASE WHEN ${now} THEN 1 ELSE 0 END) AS ready,
              SUM(CASE WHEN ${now} THEN 0 ELSE 1 END) AS waiting
            FROM dbo.krisha_objects WHERE ${ready}`)).recordset[0];
  return { row: r.recordset[0] || null, left: c.ready || 0, waiting: c.waiting || 0 };
}

// Плагин не снял номер — записываем причину и решаем, когда объект снова
// предложить (см. PHONE_MISS). Неизвестная причина считается за error.
async function markObjectPhoneMiss(id, reason) {
  const key = PHONE_MISS[reason] ? reason : "error";
  const rule = PHONE_MISS[key];
  const pool = await getPool();
  await ensureObjects(pool);
  const r = await pool.request()
    .input("id", sql.BigInt, Number(id))
    .input("st", sql.NVarChar(20), key)
    .input("min", sql.Int, rule.retryMin || 0)
    .query(`
      UPDATE dbo.krisha_objects
      SET phone_tries = ISNULL(phone_tries, 0) + 1,
          phone_state = @st,
          phone_next_at = CASE WHEN @min > 0
            THEN DATEADD(minute, @min * (ISNULL(phone_tries, 0) + 1), SYSUTCDATETIME())
            ELSE NULL END
      OUTPUT INSERTED.phone_tries, INSERTED.phone_next_at
      WHERE id = @id`);
  const row = r.recordset[0] || {};
  const tries = row.phone_tries || 0;
  return {
    state: key, tries: tries,
    // Отдали объект насовсем: архив или исчерпаны попытки.
    final: !!rule.final || tries >= 5,
    next_at: row.phone_next_at ? new Date(row.phone_next_at).toISOString() : null,
  };
}

const rawList = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);

// Номера по объекту (цифрами 7XXXXXXXXXX).
async function objectPhonesGet(id) {
  const pool = await getPool();
  const r = await pool.request().input("id", sql.BigInt, Number(id))
    .query("SELECT phones FROM dbo.krisha_objects WHERE id = @id");
  return r.recordset.length ? rawList(r.recordset[0].phones) : [];
}

// Добавить номера к уже сохранённым (не затирая старые).
async function addObjectPhones(id, phones) {
  const pool = await getPool();
  await ensureObjects(pool);
  const cur = await objectPhonesGet(id);
  const merged = cur.slice();
  for (const p of phones || []) if (p && !merged.includes(p)) merged.push(p);
  await pool.request()
    .input("id", sql.BigInt, Number(id))
    .input("ph", sql.NVarChar(300), merged.length ? merged.join(",") : null)
    .query(`UPDATE dbo.krisha_objects
            SET phones = @ph, phones_at = SYSUTCDATETIME(),
                phone_state = CASE WHEN @ph IS NULL THEN NULL ELSE 'ok' END,
                phone_next_at = NULL
            WHERE id = @id`);
  return merged;
}

// Заменить номера целиком (пустой массив — стереть).
async function setObjectPhones(id, phones) {
  const pool = await getPool();
  await ensureObjects(pool);
  const clean = [];
  for (const p of phones || []) if (p && !clean.includes(p)) clean.push(p);
  await pool.request()
    .input("id", sql.BigInt, Number(id))
    .input("ph", sql.NVarChar(300), clean.length ? clean.join(",") : null)
    .query(`UPDATE dbo.krisha_objects
            SET phones = @ph, phones_at = SYSUTCDATETIME(),
                phone_state = CASE WHEN @ph IS NULL THEN NULL ELSE 'ok' END,
                phone_next_at = NULL
            WHERE id = @id`);
  return clean;
}

// Сводка по собранному потоку — для статуса и отчётов.
async function objectStats() {
  const pool = await getPool();
  await ensureObjects(pool);
  const r = await pool.request().query(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN deal = 'rent' THEN 1 ELSE 0 END) AS rent,
      SUM(CASE WHEN deal = 'sale' THEN 1 ELSE 0 END) AS sale,
      SUM(CASE WHEN user_type = 'owner' THEN 1 ELSE 0 END) AS owner,
      SUM(CAST(DATALENGTH(data_gz) AS BIGINT)) AS gz_bytes
    FROM dbo.krisha_objects`);
  return r.recordset[0];
}

module.exports = { saveFlat, saveFlats, knownIds, flatsWithoutCard, deepenLeft, markCardMiss, places, facets, backfillMkr, flatsWithoutMkr, flatsWithoutStreet, backfillStreet, flatsNeedingPhoto, setFlatPhoto, photoStats, saveFlatPhones, replaceFlatPhones, normPhone, flatPhones, flatsWithoutPhone, markPhoneMiss,
  saveCard, card, candidatePhotoUrls, flat, findFlats, krishaStats, markPending, clearPending, pendingFlats,
  maxKnownId, saveObject, knownObjectIds, objectStats, findObjects, agentsToMatch, recordSearched, matchStats,
  saveListAdvert, listStats, listCompare,
  nextListOwnerWithoutPhone, markListPhoneMiss, listPhonesGet, addListPhones, setListPhones,
  agentsToMatchList, findListOwners, recordListSearched, logListMatch, listMatchStats, listPhotoUrls,
  listDashboard, listMatchReviewRows, setListHumanOk, dbSize, migrateListPhotos, saveListAdverts,
  objectPhotos, fillAddedOn, logMatchCandidate, matchReviewRows, setHumanOk, ownerDashboard,
  nextObjectWithoutPhone, markObjectPhoneMiss, PHONE_MISS_REASONS, objectPhonesGet, addObjectPhones, setObjectPhones,
  upsertUser, logBotRequest, botStats,
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
