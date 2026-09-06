// Коннектор между OpenWA и Reception365.
//
// Запускается рядом с OpenWA, на той же машине. OpenWA присылает сюда
// входящие сообщения, коннектор спрашивает ответ у нашего сервера и отправляет
// его обратно через OpenWA.
//
// Почему так, а не «OpenWA шлёт вебхук прямо на reception365.online»: чтобы
// ответить, наш сервер должен был бы достучаться до OpenWA, а он живёт на
// ноутбуке за домашним роутером. Здесь наружу ходит только эта программа.
//
//   node scripts/wa-connector.js
//
// Настройки через переменные окружения (или файл ~/.openwa рядом, см. ниже):
//   OPENWA_URL      адрес OpenWA, по умолчанию http://localhost:2785
//   OPENWA_KEY      ключ X-API-Key из панели OpenWA
//   OPENWA_SESSION  идентификатор сессии OpenWA
//   RECEPTION_KEY   ключ клиники (tool_key) — по нему сервер узнаёт, чья это переписка
//   RECEPTION_URL   по умолчанию https://reception365.online
//   PORT            порт коннектора, по умолчанию 3210
//
// Ключи в репозиторий не попадают: кладите их в ~/.openwa двумя-тремя
// строками вида OPENWA_KEY=... — файл читается при старте.
const fs = require("fs");
const os = require("os");
const http = require("http");
const path = require("path");

// ~/.openwa — тот же приём, что у остальных наших ключей: секрет живёт в
// домашней папке, а не в коде и не в переписке.
try {
  const raw = fs.readFileSync(path.join(os.homedir(), ".openwa"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const OPENWA_URL = (process.env.OPENWA_URL || "http://localhost:2785").replace(/\/+$/, "");
const OPENWA_KEY = process.env.OPENWA_KEY || "";
const SESSION = process.env.OPENWA_SESSION || "";
const RECEPTION_URL = (process.env.RECEPTION_URL || "https://reception365.online").replace(/\/+$/, "");
const RECEPTION_KEY = process.env.RECEPTION_KEY || "";
const PORT = Number(process.env.PORT || 3210);

for (const [name, v] of [["OPENWA_KEY", OPENWA_KEY], ["OPENWA_SESSION", SESSION],
                         ["RECEPTION_KEY", RECEPTION_KEY]]) {
  if (!v) { console.log("не задано " + name + " — смотрите комментарий вверху файла"); process.exit(1); }
}

// Переписки держим в памяти: истории нужно ровно столько, чтобы ответ был
// связным. Хранить чужую переписку дольше, чем нужно для ответа, незачем.
const chats = new Map(); // chatId -> [{from, text}]
const MAX_KEEP = 10;

function remember(chatId, from, text) {
  const list = chats.get(chatId) || [];
  list.push({ from, text });
  if (list.length > MAX_KEEP) list.splice(0, list.length - MAX_KEEP);
  chats.set(chatId, list);
}

// У шлюза поля могут называться по-разному в зависимости от движка и версии,
// поэтому вытаскиваем по нескольким вариантам, а не по одному ожидаемому.
function pick(obj, names) {
  for (const n of names) {
    const parts = n.split(".");
    let v = obj;
    for (const p of parts) v = v && typeof v === "object" ? v[p] : undefined;
    if (typeof v === "string" && v) return v;
  }
  return "";
}

function parseIncoming(payload) {
  const d = payload && payload.data ? payload.data : payload || {};
  // У части движков message — вложенный объект, у части сам текст. Ныряем
  // внутрь только если там действительно объект, иначе теряем и то и другое.
  const m = d.message && typeof d.message === "object" ? d.message
    : d.msg && typeof d.msg === "object" ? d.msg
    : d;
  return {
    event: pick(payload || {}, ["event", "type"]) || "",
    chatId: pick(m, ["chatId", "from", "chat.id", "key.remoteJid", "chat_id"]),
    text: pick(m, ["body", "text", "message", "content", "caption"]),
    fromMe: !!(m.fromMe || m.from_me),
    isGroup: /@g\.us$/.test(pick(m, ["chatId", "from", "key.remoteJid"]) || ""),
  };
}

async function askReception(chatId, text) {
  const r = await fetch(RECEPTION_URL + "/api/whatsapp/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: RECEPTION_KEY, from: chatId, text: text,
      history: chats.get(chatId) || [],
    }),
    signal: AbortSignal.timeout(30000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || ("http_" + r.status));
  return j.reply;
}

async function sendWhatsApp(chatId, text) {
  const r = await fetch(OPENWA_URL + "/api/sessions/" + encodeURIComponent(SESSION) + "/messages/send-text", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": OPENWA_KEY },
    body: JSON.stringify({ chatId: chatId, text: text }),
    signal: AbortSignal.timeout(20000),
  });
  const t = await r.text();
  if (!r.ok) throw new Error("openwa_" + r.status + ": " + t.slice(0, 200));
}

const server = http.createServer((req, res) => {
  if (req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("коннектор жив. переписок в памяти: " + chats.size);
  }
  let raw = "";
  req.on("data", (c) => { raw += c; if (raw.length > 1e6) req.destroy(); });
  req.on("end", async () => {
    // Шлюзу отвечаем сразу: он ждёт подтверждения доставки, а не нашей работы.
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end('{"ok":true}');

    let payload = {};
    try { payload = JSON.parse(raw); } catch { return; }
    const msg = parseIncoming(payload);

    if (msg.event && !/message/i.test(msg.event)) return;   // статусы сессии пропускаем
    if (msg.fromMe) return;                                  // свои же сообщения
    if (msg.isGroup) return;                                 // группы не ведём
    if (!msg.chatId || !msg.text) {
      console.log("не разобрал сообщение:", raw.slice(0, 300));
      return;
    }

    console.log("→", msg.chatId, ":", msg.text.slice(0, 80));
    try {
      const reply = await askReception(msg.chatId, msg.text);
      remember(msg.chatId, "human", msg.text);
      remember(msg.chatId, "clinic", reply);
      await sendWhatsApp(msg.chatId, reply);
      console.log("←", msg.chatId, ":", reply.slice(0, 80));
    } catch (e) {
      // Молчание хуже неудачи: человек ждёт ответа, а мы даже не признались.
      console.log("не ответили:", String(e.message).slice(0, 160));
    }
  });
});

server.listen(PORT, () => {
  console.log("коннектор слушает http://localhost:" + PORT);
  console.log("шлюз:", OPENWA_URL, "| сессия:", SESSION);
  console.log("мозг:", RECEPTION_URL);
  console.log("\nтеперь скажите OpenWA присылать сюда входящие:");
  console.log("curl -X POST " + OPENWA_URL + "/api/sessions/" + SESSION + "/webhooks \\");
  console.log("  -H 'Content-Type: application/json' -H 'X-API-Key: ВАШ_КЛЮЧ' \\");
  console.log("  -d '{\"url\":\"http://localhost:" + PORT + "/hook\",\"events\":[\"message.received\"]}'");
});
