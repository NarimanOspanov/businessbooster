// Сессия Крыши: читаем из ~/.krisha-creds на своей машине, из KRISHA_COOKIE —
// на сервере.
//
// Люди достают куки по-разному: кто-то копирует заголовок Cookie из вкладки
// Network, кто-то выгружает их расширением одним JSON-массивом. Принимаем оба
// вида, а наружу отдаём одну строку, пригодную и для заголовка, и для
// переменной окружения.

const fs = require("fs");
const os = require("os");
const path = require("path");

const FILE = path.join(os.homedir(), ".krisha-creds");

// Куки других сайтов из выгрузки нам не нужны: запрос уходит на krisha.kz, и
// чужие значения только раздували бы заголовок.
const MINE = /(^|\.)krisha\.kz$/i;

function fromJson(text) {
  const start = text.indexOf("[");
  if (start === -1) return null;
  let arr;
  try { arr = JSON.parse(text.slice(start, text.lastIndexOf("]") + 1)); } catch { return null; }
  if (!Array.isArray(arr)) return null;
  const seen = new Set();
  const out = [];
  for (const c of arr) {
    if (!c || !c.name || c.value == null) continue;
    if (c.domain && !MINE.test(String(c.domain).replace(/^\./, "").trim()) &&
        !MINE.test(String(c.domain))) continue;
    if (seen.has(c.name)) continue;
    seen.add(c.name);
    out.push(c.name + "=" + c.value);
  }
  return out.length ? out.join("; ") : null;
}

function parse(text) {
  const line = (String(text || "").match(/^KRISHA_COOKIE=(.*)$/m) || [])[1];
  if (line && line.trim() && !line.trim().startsWith("[")) return line.trim();
  return fromJson(String(text || ""));
}

function load() {
  if (process.env.KRISHA_COOKIE) return process.env.KRISHA_COOKIE;
  try { return parse(fs.readFileSync(FILE, "utf8")) || ""; } catch { return ""; }
}

// Приводим файл к одной строке: из неё же значение копируется в переменную
// окружения Azure, а многоэкранный JSON туда не вставишь.
function normalize() {
  const cookie = parse(fs.readFileSync(FILE, "utf8"));
  if (!cookie) return null;
  fs.writeFileSync(FILE, [
    "# Сессия Крыши для чтения телефонов продавцов.",
    "#",
    "# Живёт около недели. Когда телефоны перестанут приходить — залогиньтесь",
    "# на krisha.kz заново и замените строку ниже: F12 -> Network -> любой",
    "# запрос к krisha.kz -> Request Headers -> Cookie. Выгрузка расширением",
    "# одним JSON-массивом тоже подходит, скрипт её разберёт.",
    "#",
    "# На сервере то же значение лежит в переменной окружения KRISHA_COOKIE.",
    "",
    "KRISHA_COOKIE=" + cookie,
    "",
  ].join("\n"), "utf8");
  return cookie;
}

module.exports = { load, parse, normalize, FILE };
