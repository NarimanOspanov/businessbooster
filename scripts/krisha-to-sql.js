// Перенос собранного по Крыше из файлов в базу. Разовая операция: база квартир,
// снимки карточек и телефоны хозяев жили в /home/data на App Service, где нет
// ни резервных копий, ни возможности искать иначе как перебором.
//
// Запуск на сервере:  node scripts/krisha-to-sql.js /home/data
// Локально:           node scripts/krisha-to-sql.js ./data

const fs = require("fs");
const path = require("path");
const db = require("./db.js");

const DIR = process.argv[2] || path.join(__dirname, "..", "data");

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

(async () => {
  await db.migrate();

  // 1. База квартир: по файлу на день.
  const baseDir = path.join(DIR, "krisha-base");
  let files = [];
  try { files = fs.readdirSync(baseDir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)); } catch { /* нет базы */ }
  let flats = 0;
  for (const f of files) {
    const day = readJson(path.join(baseDir, f)) || {};
    const rows = Object.values(day);
    flats += await db.saveFlats(rows);
    console.log(f + ": " + rows.length);
  }

  // 2. Очередь на досъёмку.
  const pend = readJson(path.join(baseDir, "pending.json")) || {};
  const pendIds = Object.keys(pend);
  if (pendIds.length) {
    // Записываем по одному городу за раз: в файле город хранился у каждой записи.
    const byCity = {};
    pendIds.forEach((id) => { (byCity[pend[id].city || ""] = byCity[pend[id].city || ""] || []).push(id); });
    for (const city of Object.keys(byCity)) await db.markPending(byCity[city], city || null);
  }

  // 3. Снимки карточек и телефоны, которые уже прошли руками.
  const cards = readJson(path.join(DIR, "krisha-cards.json")) || {};
  let saved = 0, phones = 0;
  for (const id of Object.keys(cards)) {
    const c = cards[id];
    try {
      await db.saveCard(id, c);
      saved++;
      if ((c.phones || []).length) { await db.saveFlatPhones(id, c.phones, "manual"); phones++; }
    } catch (e) {
      console.log("карточка " + id + ": " + e.message);
    }
  }

  const s = await db.krishaStats();
  console.log("\nперенесено: квартир " + flats + ", карточек " + saved +
    ", с телефоном " + phones + ", в очереди " + pendIds.length);
  console.log("в базе теперь: " + JSON.stringify(s));
  process.exit(0);
})().catch((e) => { console.error("сорвалось:", e.message); process.exit(1); });
