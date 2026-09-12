// Загрузка файлов в Azure Blob Storage без единой зависимости.
//
// Пакет @azure/storage-blob тянет за собой полсотни чужих модулей ради одного
// PUT. Здесь нужен ровно он — плюс подпись SharedKey, которая укладывается в
// тридцать строк на встроенном crypto.
//
// Строка подключения берётся из AZURE_STORAGE_CONNECTION, а если её нет — из
// файла ~/.azure-storage. В репозиторий она не попадает.

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const FILE = process.env.AZURE_STORAGE_FILE || path.join(os.homedir(), ".azure-storage");
const VERSION = "2021-08-06";

function fromFile(key) {
  try {
    const m = fs.readFileSync(FILE, "utf8").match(new RegExp("^" + key + "=(.*)$", "m"));
    return m ? m[1].trim() : "";
  } catch {
    return "";
  }
}

function config() {
  const conn = process.env.AZURE_STORAGE_CONNECTION || fromFile("AZURE_STORAGE_CONNECTION");
  if (!conn) return null;
  const get = (k) => (conn.match(new RegExp(k + "=([^;]+)")) || [])[1] || "";
  const account = get("AccountName");
  const key = (conn.match(/AccountKey=([^;]+(?:;[^;]*=)?[^;]*)/) || [])[1] || get("AccountKey");
  if (!account || !key) return null;
  return {
    account: account,
    key: key,
    container: process.env.AZURE_STORAGE_CONTAINER || fromFile("AZURE_STORAGE_CONTAINER") || "photos",
    host: account + ".blob.core.windows.net",
  };
}

const ready = () => !!config();

// Подпись SharedKey: строка собирается в строго заданном порядке, любая лишняя
// или пропущенная перевод строки — и сервер отвечает 403 без объяснений.
function sign(cfg, method, blobPath, headers, query) {
  const h = (n) => headers[n] || "";
  const ms = Object.keys(headers)
    .filter((k) => k.toLowerCase().indexOf("x-ms-") === 0)
    .sort()
    .map((k) => k.toLowerCase() + ":" + String(headers[k]).trim() + "\n")
    .join("");
  const q = Object.keys(query || {}).sort()
    .map((k) => "\n" + k.toLowerCase() + ":" + query[k])
    .join("");
  const toSign = [
    method, "", "", h("Content-Length") === "0" ? "" : h("Content-Length"), "",
    h("Content-Type"), "", "", "", "", "", "",
  ].join("\n") + "\n" + ms + "/" + cfg.account + "/" + cfg.container + blobPath + q;
  const mac = crypto.createHmac("sha256", Buffer.from(cfg.key, "base64"));
  return "SharedKey " + cfg.account + ":" + mac.update(toSign, "utf8").digest("base64");
}

async function call(method, blobPath, query, body, type, extra) {
  const cfg = config();
  if (!cfg) throw new Error("нет строки подключения к хранилищу");
  const headers = Object.assign({
    "x-ms-date": new Date().toUTCString(),
    "x-ms-version": VERSION,
  }, extra || {});
  if (body) {
    headers["Content-Length"] = String(Buffer.byteLength(body));
    headers["Content-Type"] = type || "application/octet-stream";
  } else {
    headers["Content-Length"] = "0";
  }
  headers.Authorization = sign(cfg, method, blobPath, headers, query);
  const qs = Object.keys(query || {}).map((k) => k + "=" + encodeURIComponent(query[k])).join("&");
  const url = "https://" + cfg.host + "/" + cfg.container + blobPath + (qs ? "?" + qs : "");
  const r = await fetch(url, {
    method: method, headers: headers, body: body || undefined,
    signal: AbortSignal.timeout(30000),
  });
  return { ok: r.ok, status: r.status, text: r.ok ? "" : (await r.text()).slice(0, 200), url: url };
}

// Контейнер отдаёт файлы всем: это фотографии из объявлений, они и так открыты
// на Крыше, а раздавать их через своё приложение — значит гонять чужой трафик
// через себя без всякой пользы.
async function openContainer() {
  return call("PUT", "", { restype: "container", comp: "acl" }, "", null,
    { "x-ms-blob-public-access": "blob" });
}

async function put(name, buffer, type) {
  const p = "/" + String(name).replace(/^\/+/, "");
  const r = await call("PUT", p, null, buffer, type || "image/jpeg", { "x-ms-blob-type": "BlockBlob" });
  if (!r.ok) throw new Error("хранилище ответило " + r.status + " " + r.text);
  return publicUrl(name);
}

async function head(name) {
  const r = await call("HEAD", "/" + String(name).replace(/^\/+/, ""), null, null);
  return r.status === 200;
}

function publicUrl(name) {
  const cfg = config();
  return "https://" + cfg.host + "/" + cfg.container + "/" + String(name).replace(/^\/+/, "");
}

// Скачать у Крыши и положить к себе. Уже лежащее не перекачиваем.
async function copyFrom(url, name) {
  if (await head(name).catch(() => false)) return publicUrl(name);
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Referer: "https://krisha.kz/" },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error("не скачалось: " + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 500) throw new Error("подозрительно маленький файл");
  return put(name, buf, r.headers.get("content-type") || "image/jpeg");
}

async function del(name) {
  const r = await call("DELETE", "/" + String(name).replace(/^\/+/, ""), null, null);
  return r.ok || r.status === 404;
}

module.exports = { ready, config, put, head, del, copyFrom, publicUrl, openContainer };
