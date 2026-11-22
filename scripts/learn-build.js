// Каталог для открытых страниц-конспектов /learn/ (SEO и ИИ-поисковики): предметы → ветки → темы → уроки,
// на русском и казахском. Источники: physics/index.html (физика), physics/subjects-data.js (остальные предметы),
// LESSONS в labs/<опыт>/index.html (названия и задания уроков), казахские подписи — из luch.i18n (переводы Claude).
// Строки, которых нет в luch.i18n, попадают в luch.i18n_miss — их переводят агентами, потом скрипт запускают снова.
//   node scripts/learn-build.js  → luch/learn-catalog.json
const fs = require("fs"), path = require("path"), vm = require("vm"), crypto = require("crypto");
const ROOT = path.join(__dirname, "..");
const SLUG = { phys: "fizika", math: "matematika", chem: "himiya", bio: "biologiya", cs: "informatika" };

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
const arr = (src, name) => { const a = src.indexOf("const " + name + " = ["), b = src.indexOf("];", a); return vm.runInNewContext(src.slice(a + 9 + name.length, b + 1), {}); };
const plain = (s) => (typeof s === "string" ? s : Array.isArray(s) ? s.join(" ") : "").replace(/\s+/g, " ").trim();

const home = fs.readFileSync(path.join(ROOT, "physics/index.html"), "utf8");
const pm = /\{ id: 'phys', name: 'Физика', live: true, title: '([^']+)',\s*intro: '([^']+)'/.exec(home);
const PHYS = { id: "phys", name: "Физика", title: pm[1], intro: pm[2], grades: arr(home, "PHYS_GRADES"), branches: arr(home, "PHYS_BRANCHES"), topics: arr(home, "PHYS_TOPICS") };
const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(ROOT, "physics/subjects-data.js"), "utf8"), ctx);
const NAMES = { math: "Математика", chem: "Химия", bio: "Биология", cs: "Информатика" };
const subjects = [PHYS, ...["math", "chem", "bio", "cs"].map((id) => ({ id, name: NAMES[id], ...ctx.window.LUCH_SUBJECTS[id] }))];

// все русские строки каталога → казахский из luch.i18n
const RU = new Set(); const want = (s) => { if (s) RU.add(s); return s; };
const out = { built: new Date().toISOString(), subjects: [] };
for (const S of subjects) {
  const subj = { id: S.id, slug: SLUG[S.id], grades: [S.grades[0], S.grades[S.grades.length - 1]], ru: { name: want(S.name), title: want(S.title), intro: want(S.intro) }, branches: [], topics: [] };
  subj.branches = [{ id: "base", ru: want("Основы") }, ...S.branches.map((b) => ({ id: b.id, ru: want(b.name) }))];
  for (const t of S.topics) {
    if (!t.href || !/^\/labs\/[a-z0-9-]+\/$/.test(t.href)) continue;
    const dir = t.href.split("/")[2], file = path.join(ROOT, "labs", dir, "index.html");
    if (!fs.existsSync(file)) continue;
    const L = lessonsOf(file); if (!L || !L.length) { console.warn("нет LESSONS:", dir); continue; }
    subj.topics.push({
      id: t.id, slug: dir.replace(/^[a-z]+-/, ""), lab: t.href, b: t.b, g: t.g, req: t.req || [],
      ru: { title: want(t.t), items: (t.items || []).map(want) },
      lessons: L.map((l, i) => ({ n: i + 1, ru: { title: want(plain(l.title)), task: want(plain(l.task)) } })),
    });
  }
  out.subjects.push(subj);
}
(async () => {
  const db = require("./db.js"), sql = require("mssql"), pool = await db.getPool();
  const list = [...RU], h = list.map((s) => crypto.createHash("sha1").update(s).digest("hex")), kk = new Map();
  for (let i = 0; i < h.length; i += 500) {
    const r = await pool.request().input("j", sql.NVarChar(sql.MAX), JSON.stringify(h.slice(i, i + 500)))
      .query("SELECT i.src_hash, i.dst FROM luch.i18n i JOIN OPENJSON(@j) j ON j.value = i.src_hash WHERE i.lang = 'kk'");
    for (const x of r.recordset) kk.set(x.src_hash, x.dst);
  }
  const miss = [];
  const tr = (s) => { if (!s) return s; const k = crypto.createHash("sha1").update(s).digest("hex"); if (kk.has(k)) return kk.get(k); if (!miss.some((m) => m.h === k)) miss.push({ h: k, s }); return null; };
  for (const S of out.subjects) {
    S.kk = { name: tr(S.ru.name), title: tr(S.ru.title), intro: tr(S.ru.intro) };
    for (const b of S.branches) b.kk = tr(b.ru);
    for (const t of S.topics) {
      t.kk = { title: tr(t.ru.title), items: t.ru.items.map(tr) };
      for (const l of t.lessons) l.kk = { title: tr(l.ru.title), task: tr(l.ru.task) };
    }
  }
  if (miss.length) await pool.request().input("j", sql.NVarChar(sql.MAX), JSON.stringify(miss)).query(`
    MERGE luch.i18n_miss AS t USING (SELECT * FROM OPENJSON(@j) WITH (h CHAR(40), s NVARCHAR(MAX))) AS s ON t.src_hash = s.h AND t.lang = 'kk'
    WHEN NOT MATCHED THEN INSERT (src_hash, lang, src) VALUES (s.h, 'kk', s.s);`);
  fs.writeFileSync(path.join(ROOT, "luch/learn-catalog.json"), JSON.stringify(out));
  const T = out.subjects.reduce((a, s) => a + s.topics.length, 0), Ls = out.subjects.reduce((a, s) => a + s.topics.reduce((b, t) => b + t.lessons.length, 0), 0);
  console.log(`предметов ${out.subjects.length}, тем ${T}, уроков ${Ls}; строк ${list.length}, без казахского перевода ${miss.length} (записаны в luch.i18n_miss)`);
  process.exit(0);
})().catch((e) => { console.log(e.message); process.exit(1); });
