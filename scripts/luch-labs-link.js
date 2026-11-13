// Подключает готовые лаборатории labs/<предмет>-<тема>/index.html к карте предметов:
// тема получает status 'done', ссылку и число уроков (physics/index.html для физики,
// physics/subjects-data.js для остальных). Страница без LESSONS или с синтаксической
// ошибкой пропускается.   node scripts/luch-labs-link.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const LABS = path.join(ROOT, "labs");

function lessonsOf(file) {
  const src = fs.readFileSync(file, "utf8");
  const a = src.indexOf("const LESSONS = ["); if (a < 0) return null;
  const b = src.indexOf("\n];", a); if (b < 0) return null;
  const stubs = {};
  for (let i = 0; i < 30; i++) {
    try { const ctx = { window: {}, S: {}, clamp: (v) => v, Math, ...stubs }; vm.runInNewContext(src.slice(a, b + 3) + ";this.__o=LESSONS", ctx); return ctx.__o; }
    catch (e) { const m = /^(\w+) is not defined/.exec(e.message); if (!m) return null; stubs[m[1]] = () => ""; }
  }
  return null;
}

function setTopic(file, id, n) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const i = lines.findIndex((l) => l.includes(`{ id: '${id}', b: '`));
  if (i < 0) return false;
  let l = lines[i].replace(/, status: '[a-z]+'.*? \},$/, " },");
  const items = (l.match(/items: \[(.*?)\]/) || [, ""])[1].split("', '").length;
  lines[i] = l.replace(/ \},$/, `, status: 'done', href: '${n.href}', lessons: ${n.lessons}, doneItems: ${items} },`);
  fs.writeFileSync(file, lines.join("\n"));
  return true;
}

const done = [];
for (const dir of fs.existsSync(LABS) ? fs.readdirSync(LABS) : []) {
  const m = /^(phys|math|chem|bio|cs)-(\w+)$/.exec(dir); if (!m) continue;
  const f = path.join(LABS, dir, "index.html"); if (!fs.existsSync(f)) continue;
  const L = lessonsOf(f);
  if (!L || !L.length) { console.warn("пропуск", dir, "— LESSONS не читаются"); continue; }
  const target = m[1] === "phys" ? path.join(ROOT, "physics", "index.html") : path.join(ROOT, "physics", "subjects-data.js");
  if (setTopic(target, m[2], { href: `/labs/${dir}/`, lessons: L.length })) done.push(`${dir}:${L.length}`);
  else console.warn("тема не найдена на карте:", dir);
}
console.log("подключено:", done.length, done.join(" "));
