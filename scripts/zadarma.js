// Клиент API Zadarma.
//
// Каждый запрос подписывается: подпись считается от пути метода, строки
// параметров и md5 той же строки. Порядок параметров обязан быть
// алфавитным — при другом порядке подпись не сойдётся, и сервер ответит
// «authorization failed» без объяснения причины.
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const BASE = "https://api.zadarma.com";

function credentials() {
  if (process.env.ZADARMA_KEY && process.env.ZADARMA_SECRET) {
    return { key: process.env.ZADARMA_KEY, secret: process.env.ZADARMA_SECRET };
  }
  const file = path.join(os.homedir(), ".zadarma-keys");
  if (!fs.existsSync(file)) {
    throw new Error("нет ключей: ни ZADARMA_KEY/SECRET, ни ~/.zadarma-keys");
  }
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/)
    .map((s) => s.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error("в ~/.zadarma-keys ожидаются две строки: ключ и секрет");
  return { key: lines[0], secret: lines[1] };
}

// Zadarma сверяет подпись со строкой, собранной ровно так же, поэтому кодируем
// сами, а не полагаемся на URLSearchParams: он кодирует пробел как «+», а
// PHP-сборка на их стороне ждёт «%20» не везде одинаково.
function paramsString(params) {
  return Object.keys(params)
    .sort()
    .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(String(params[k])))
    .join("&");
}

function sign(method, params, secret) {
  const str = paramsString(params);
  const md5 = crypto.createHash("md5").update(str).digest("hex");
  const hmac = crypto.createHmac("sha1", secret).update(method + str + md5).digest("hex");
  return Buffer.from(hmac).toString("base64");
}

// method — путь вида "/v1/pbx/redirection/", обязательно с обеими косыми.
async function call(method, params = {}, httpMethod = "GET") {
  const { key, secret } = credentials();
  const str = paramsString(params);
  const auth = key + ":" + sign(method, params, secret);

  const isGet = httpMethod.toUpperCase() === "GET";
  const url = BASE + method + (isGet && str ? "?" + str : "");
  const init = {
    method: httpMethod.toUpperCase(),
    headers: { Authorization: auth },
  };
  if (!isGet) {
    init.headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = str;
  }

  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  if (!json) throw new Error("Zadarma ответила не JSON: " + text.slice(0, 200));
  // HTTP 200 у них бывает и на отказе — смотрим на поле status.
  if (json.status && json.status !== "success") {
    throw new Error("Zadarma: " + (json.message || JSON.stringify(json).slice(0, 200)));
  }
  return json;
}

module.exports = { call, paramsString, sign, credentials };
