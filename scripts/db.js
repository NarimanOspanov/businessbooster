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
`;

async function migrate() {
  const pool = await getPool();
  await pool.request().batch(SCHEMA);
  const r = await pool
    .request()
    .query(
      "SELECT COUNT(*) AS n FROM sys.columns WHERE object_id = OBJECT_ID('dbo.calls')"
    );
  console.log("таблица dbo.calls готова, колонок:", r.recordset[0].n);
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
        transcript = @transcript, raw = @raw
      WHEN NOT MATCHED THEN INSERT
        (conversation_id, agent_id, caller_number, duration_secs, client_name,
         client_phone, service, desired_time, is_booked, is_urgent, summary,
         transcript, raw)
        VALUES
        (@conversation_id, @agent_id, @caller_number, @duration_secs, @client_name,
         @client_phone, @service, @desired_time, @is_booked, @is_urgent, @summary,
         @transcript, @raw);
    `);
}

module.exports = { getPool, migrate, saveCall, connectionString };

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
