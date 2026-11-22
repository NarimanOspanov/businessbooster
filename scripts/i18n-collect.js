// Собирает все русские строки уроков из labs/*/index.html (LESSONS: теория, задания, подсказки, «зачем» и т. п.)
// в том виде, в каком их переводит страница (luch/tutor.js: числа → {0}, {1}…), и записывает те, у которых нет
// перевода на язык (по умолчанию kk), в luch.i18n_miss. Дальше их переводят агенты Claude.
//   node scripts/i18n-collect.js [kk]
const fs = require("fs"), path = require("path"), vm = require("vm"), crypto = require("crypto");
const ROOT = path.join(__dirname, ".."), LANG = process.argv[2] || "kk";
const CY = /[А-Яа-яЁё]/, NUM = /-?\d+(?:[.,]\d+)*/g;
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
// строка как её видит переводчик страницы: обрезанная, числа заменены шаблоном; HTML-теги режут текст на куски
const pieces = (s) => String(s).split(/<[^>]+>/).map((x) => x.replace(/\s+/g, " ").trim()).filter((x) => x && CY.test(x));
const tmpl = (k) => { let i = 0; return k.replace(NUM, () => "{" + i++ + "}"); };
const all = new Set();
const walk = (v) => { if (typeof v === "string") pieces(v).forEach((p) => all.add(tmpl(p))); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") Object.values(v).forEach(walk); };
let labs = 0;
for (const dir of fs.readdirSync(path.join(ROOT, "labs"))) {
  const f = path.join(ROOT, "labs", dir, "index.html"); if (!fs.existsSync(f)) continue;
  const L = lessonsOf(f); if (!L) continue; labs++; walk(L);
}
(async () => {
  const db = require("./db.js"), sql = require("mssql"), pool = await db.getPool();
  const list = [...all], hs = list.map((s) => crypto.createHash("sha1").update(s).digest("hex")), have = new Set();
  for (let i = 0; i < hs.length; i += 800) {
    const r = await pool.request().input("l", sql.NVarChar(8), LANG).input("j", sql.NVarChar(sql.MAX), JSON.stringify(hs.slice(i, i + 800)))
      .query("SELECT i.src_hash FROM luch.i18n i JOIN OPENJSON(@j) j ON j.value = i.src_hash WHERE i.lang = @l");
    r.recordset.forEach((x) => have.add(x.src_hash));
  }
  const miss = list.map((s, i) => ({ h: hs[i], s })).filter((x) => !have.has(x.h));
  for (let i = 0; i < miss.length; i += 500)
    await pool.request().input("l", sql.NVarChar(8), LANG).input("j", sql.NVarChar(sql.MAX), JSON.stringify(miss.slice(i, i + 500))).query(`
      MERGE luch.i18n_miss AS t USING (SELECT * FROM OPENJSON(@j) WITH (h CHAR(40), s NVARCHAR(MAX))) AS s ON t.src_hash = s.h AND t.lang = @l
      WHEN NOT MATCHED THEN INSERT (src_hash, lang, src) VALUES (s.h, @l, s.s);`);
  console.log(`лабораторий ${labs}, строк ${list.length}, уже переведено ${have.size}, без перевода ${miss.length} → luch.i18n_miss`);
  process.exit(0);
})().catch((e) => { console.log(e.message); process.exit(1); });
