// «Луч» в основной базе: отдельная схема luch для всего направления обучения.
// Тексты лежат отдельно от структуры (таблицы *_texts с колонкой lang), чтобы
// добавлять казахский, английский и другие языки без переделки таблиц.
//
//   node scripts/luch-db.js migrate  — создать схему и таблицы, если их нет
//   node scripts/luch-db.js sync     — залить программу предметов, уроки и сценарии роликов (язык ru)
//   node scripts/luch-db.js check    — сколько строк в каждой таблице
//
// Источник правды пока — файлы сайта (physics/index.html, physics/subjects-data.js,
// <раздел>/index.html с LESSONS, <раздел>/reel-scenes.js); sync переносит их в базу
// по естественным ключам (code), id строк не меняются при повторной заливке.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const sql = require("mssql");
const { getPool } = require("./db.js");

const ROOT = path.join(__dirname, "..");
const LANG = "ru";

const SCHEMA = `
IF SCHEMA_ID('luch') IS NULL EXEC('CREATE SCHEMA luch');

IF OBJECT_ID('luch.languages', 'U') IS NULL
CREATE TABLE luch.languages (
  code        NVARCHAR(8)  NOT NULL PRIMARY KEY,   -- ru, kk, en
  name        NVARCHAR(50) NOT NULL,
  is_active   BIT          NOT NULL CONSTRAINT DF_luch_lang_active DEFAULT 1,
  sort        INT          NOT NULL CONSTRAINT DF_luch_lang_sort DEFAULT 0
);

IF OBJECT_ID('luch.subjects', 'U') IS NULL
CREATE TABLE luch.subjects (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  code        NVARCHAR(32) NOT NULL CONSTRAINT UQ_luch_subjects_code UNIQUE,
  sort        INT          NOT NULL,
  grade_from  TINYINT      NOT NULL,
  grade_to    TINYINT      NOT NULL,
  is_live     BIT          NOT NULL CONSTRAINT DF_luch_subjects_live DEFAULT 0,
  updated_at  DATETIME2(0) NOT NULL CONSTRAINT DF_luch_subjects_upd DEFAULT SYSUTCDATETIME()
);
IF OBJECT_ID('luch.subject_texts', 'U') IS NULL
CREATE TABLE luch.subject_texts (
  subject_id  INT          NOT NULL REFERENCES luch.subjects(id),
  lang        NVARCHAR(8)  NOT NULL REFERENCES luch.languages(code),
  name        NVARCHAR(100) NOT NULL,
  title       NVARCHAR(200) NULL,
  intro       NVARCHAR(1000) NULL,
  CONSTRAINT PK_luch_subject_texts PRIMARY KEY (subject_id, lang)
);

IF OBJECT_ID('luch.branches', 'U') IS NULL
CREATE TABLE luch.branches (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  subject_id  INT          NOT NULL REFERENCES luch.subjects(id),
  code        NVARCHAR(32) NOT NULL,
  color       NVARCHAR(32) NULL,
  sort        INT          NOT NULL,
  CONSTRAINT UQ_luch_branches UNIQUE (subject_id, code)
);
IF OBJECT_ID('luch.branch_texts', 'U') IS NULL
CREATE TABLE luch.branch_texts (
  branch_id   INT          NOT NULL REFERENCES luch.branches(id),
  lang        NVARCHAR(8)  NOT NULL REFERENCES luch.languages(code),
  name        NVARCHAR(150) NOT NULL,
  CONSTRAINT PK_luch_branch_texts PRIMARY KEY (branch_id, lang)
);

-- Тема программы. branch_id NULL = общие основы предмета (верх карты).
IF OBJECT_ID('luch.topics', 'U') IS NULL
CREATE TABLE luch.topics (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  subject_id  INT          NOT NULL REFERENCES luch.subjects(id),
  branch_id   INT          NULL REFERENCES luch.branches(id),
  code        NVARCHAR(32) NOT NULL,
  grade       TINYINT      NOT NULL,
  sort        INT          NOT NULL,
  status      NVARCHAR(8)  NOT NULL CONSTRAINT DF_luch_topics_status DEFAULT 'soon', -- soon | part | done
  page_url    NVARCHAR(200) NULL,
  CONSTRAINT UQ_luch_topics UNIQUE (subject_id, code)
);
IF OBJECT_ID('luch.topic_texts', 'U') IS NULL
CREATE TABLE luch.topic_texts (
  topic_id    INT          NOT NULL REFERENCES luch.topics(id),
  lang        NVARCHAR(8)  NOT NULL REFERENCES luch.languages(code),
  title       NVARCHAR(200) NOT NULL,
  CONSTRAINT PK_luch_topic_texts PRIMARY KEY (topic_id, lang)
);
IF OBJECT_ID('luch.topic_prereqs', 'U') IS NULL
CREATE TABLE luch.topic_prereqs (
  topic_id    INT NOT NULL REFERENCES luch.topics(id),
  requires_id INT NOT NULL REFERENCES luch.topics(id),
  CONSTRAINT PK_luch_topic_prereqs PRIMARY KEY (topic_id, requires_id)
);
IF OBJECT_ID('luch.subtopics', 'U') IS NULL
CREATE TABLE luch.subtopics (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  topic_id    INT NOT NULL REFERENCES luch.topics(id),
  sort        INT NOT NULL,
  is_ready    BIT NOT NULL CONSTRAINT DF_luch_subtopics_ready DEFAULT 0,
  CONSTRAINT UQ_luch_subtopics UNIQUE (topic_id, sort)
);
IF OBJECT_ID('luch.subtopic_texts', 'U') IS NULL
CREATE TABLE luch.subtopic_texts (
  subtopic_id INT          NOT NULL REFERENCES luch.subtopics(id),
  lang        NVARCHAR(8)  NOT NULL REFERENCES luch.languages(code),
  title       NVARCHAR(300) NOT NULL,
  CONSTRAINT PK_luch_subtopic_texts PRIMARY KEY (subtopic_id, lang)
);

-- Интерактивный урок (шаг лаборатории): начальное состояние опыта в params_json,
-- тексты (объяснение, задание, подсказка) — по языкам.
IF OBJECT_ID('luch.lessons', 'U') IS NULL
CREATE TABLE luch.lessons (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  topic_id    INT          NOT NULL REFERENCES luch.topics(id),
  code        NVARCHAR(32) NOT NULL,
  sort        INT          NOT NULL,
  page_url    NVARCHAR(200) NOT NULL,
  params_json NVARCHAR(MAX) NULL,
  CONSTRAINT UQ_luch_lessons UNIQUE (topic_id, code)
);
IF OBJECT_ID('luch.lesson_texts', 'U') IS NULL
CREATE TABLE luch.lesson_texts (
  lesson_id   INT          NOT NULL REFERENCES luch.lessons(id),
  lang        NVARCHAR(8)  NOT NULL REFERENCES luch.languages(code),
  title       NVARCHAR(200) NOT NULL,
  body_json   NVARCHAR(MAX) NULL,      -- абзацы объяснения и прочие блоки
  task        NVARCHAR(1000) NULL,
  hint        NVARCHAR(1000) NULL,
  CONSTRAINT PK_luch_lesson_texts PRIMARY KEY (lesson_id, lang)
);

-- Ролик-объяснение к уроку: сцены по порядку; голос и субтитры — по языкам.
IF OBJECT_ID('luch.reel_scenes', 'U') IS NULL
CREATE TABLE luch.reel_scenes (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  lesson_id   INT NOT NULL REFERENCES luch.lessons(id),
  sort        INT NOT NULL,
  state_json  NVARCHAR(MAX) NULL,      -- from/to состояния схемы
  CONSTRAINT UQ_luch_reel_scenes UNIQUE (lesson_id, sort)
);
IF OBJECT_ID('luch.reel_scene_texts', 'U') IS NULL
CREATE TABLE luch.reel_scene_texts (
  scene_id    INT          NOT NULL REFERENCES luch.reel_scenes(id),
  lang        NVARCHAR(8)  NOT NULL REFERENCES luch.languages(code),
  cap         NVARCHAR(200) NOT NULL,
  say         NVARCHAR(2000) NOT NULL,
  formula     NVARCHAR(200) NULL,
  icons_json  NVARCHAR(1000) NULL,
  audio_url   NVARCHAR(300) NULL,
  duration_s  DECIMAL(6,2) NULL,
  CONSTRAINT PK_luch_reel_scene_texts PRIMARY KEY (scene_id, lang)
);

-- Переводы интерфейса страниц (машинный перевод, кэш): ключ — sha1 исходной русской строки.
IF OBJECT_ID('luch.i18n', 'U') IS NULL
CREATE TABLE luch.i18n (
  src_hash    CHAR(40)      NOT NULL,
  lang        NVARCHAR(8)   NOT NULL,
  src         NVARCHAR(MAX) NOT NULL,
  dst         NVARCHAR(MAX) NOT NULL,
  created_at  DATETIME2(0)  NOT NULL CONSTRAINT DF_luch_i18n_created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_luch_i18n PRIMARY KEY (src_hash, lang)
);

-- «История урока»: популярный рассказ к уроку (что это, зачем, как работает, история), генерирует ИИ один раз.
IF OBJECT_ID('luch.lesson_story', 'U') IS NULL
CREATE TABLE luch.lesson_story (
  story_key   NVARCHAR(300) NOT NULL PRIMARY KEY,   -- путь страницы|номер урока|язык
  body_json   NVARCHAR(MAX) NOT NULL,
  created_at  DATETIME2(0)  NOT NULL CONSTRAINT DF_luch_story_created DEFAULT SYSUTCDATETIME()
);

MERGE luch.languages AS t USING (VALUES ('ru', N'Русский', 1), ('kk', N'Қазақша', 2), ('en', N'English', 3), ('es', N'Español', 4)) AS s(code, name, sort)
  ON t.code = s.code
  WHEN NOT MATCHED THEN INSERT (code, name, sort, is_active) VALUES (s.code, s.name, s.sort, CASE WHEN s.code = 'ru' THEN 1 ELSE 0 END);
`;

// ---------- чтение контента из файлов сайта ----------
function sliceEval(file, from, to, names, keepEnd) {
  const src = fs.readFileSync(path.join(ROOT, file), "utf8");
  const a = src.indexOf(from); if (a < 0) return null;
  const b = src.indexOf(to, a); if (b < 0) return null;
  // Помощники страницы, которые уроки вызывают при объявлении, подменяем пустыми функциями.
  const stubs = {};
  for (let i = 0; i < 30; i++) {
    const ctx = { window: {}, S: {}, clamp: (v) => v, Math, ...stubs }; // каждый раз новый контекст: const уже объявлен в старом
    try { vm.runInNewContext(src.slice(a, keepEnd ? b + to.length : b) + `;this.__out={${names.join(",")}}`, ctx); return ctx.__out; }
    catch (e) { const m = /^(\w+) is not defined/.exec(e.message); if (!m) throw e; stubs[m[1]] = () => ""; }
  }
  return null;
}

const SUBJECT_META = [
  { code: "phys", name: "Физика", live: true },
  { code: "math", name: "Математика" },
  { code: "chem", name: "Химия" },
  { code: "bio", name: "Биология" },
  { code: "cs", name: "Информатика" },
];
// Лаборатория = страница с уроками, привязана к теме программы.
const LABS = [
  { dir: "optics", subject: "phys", topic: "lens" },
  { dir: "mechanics", subject: "phys", topic: "lever" },
  { dir: "math", subject: "math", topic: "fquad" },
  { dir: "chemistry", subject: "chem", topic: "solutions" },
  { dir: "biology", subject: "bio", topic: "mendel" },
  { dir: "informatics", subject: "cs", topic: "binary" },
];

function loadContent() {
  const phys = sliceEval("physics/index.html", "const PHYS_BRANCHES", "const STATUS", ["PHYS_BRANCHES", "PHYS_GRADES", "PHYS_TOPICS"]);
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "physics/subjects-data.js"), "utf8"), ctx);
  const extra = ctx.window.LUCH_SUBJECTS;
  const subjects = SUBJECT_META.map((m, i) => {
    const d = m.code === "phys"
      ? { title: "Физика от простого к сложному", intro: "Вся школьная физика с 7 по 11 класс на одной карте.", grades: phys.PHYS_GRADES, branches: phys.PHYS_BRANCHES, topics: phys.PHYS_TOPICS }
      : extra[m.code];
    return { ...m, sort: i + 1, ...d };
  });
  const labs = [];
  // плюс лаборатории по темам: labs/<предмет>-<тема>/index.html
  const labsDir = path.join(ROOT, "labs");
  const auto = fs.existsSync(labsDir) ? fs.readdirSync(labsDir).map((d) => /^(phys|math|chem|bio|cs)-(\w+)$/.exec(d)).filter(Boolean)
    .map((m) => ({ dir: `labs/${m[0]}`, subject: m[1], topic: m[2] })) : [];
  for (const lab of [...LABS, ...auto]) {
    const file = `${lab.dir}/index.html`;
    if (!fs.existsSync(path.join(ROOT, file))) continue;
    let L = null;
    try { L = sliceEval(file, "const LESSONS = [", "\n];", ["LESSONS"], true); } catch (e) { console.warn(file, "LESSONS не прочитались:", e.message); }
    if (!L || !Array.isArray(L.LESSONS)) { console.warn(file, "нет LESSONS — пропускаю уроки"); continue; }
    let scenes = {};
    const sf = path.join(ROOT, lab.dir, "reel-scenes.js");
    if (fs.existsSync(sf)) { const c = { window: {} }; vm.runInNewContext(fs.readFileSync(sf, "utf8"), c); scenes = c.window.LUCH_REEL_SCENES || {}; }
    let durs = {};
    const df = path.join(ROOT, lab.dir, "reels", "durations.json");
    if (fs.existsSync(df)) durs = JSON.parse(fs.readFileSync(df, "utf8"));
    labs.push({ ...lab, url: `/${lab.dir}/`, lessons: L.LESSONS, scenes, durs });
  }
  return { subjects, labs };
}

// ---------- заливка ----------
const J = (v) => JSON.stringify(v);
const plainParams = (o) => { const p = {}; for (const [k, v] of Object.entries(o)) if (!["id", "title", "text", "task", "hint", "check", "goal", "why", "overview"].includes(k) && typeof v !== "function") p[k] = v; return p; };

async function sync() {
  const { subjects, labs } = loadContent();
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  const q = (text, params = {}) => { const r = tx.request(); for (const [k, v] of Object.entries(params)) r.input(k, v); return r.query(text); };
  try {
    for (const s of subjects) {
      const g = s.grades;
      const sid = (await q(`
        MERGE luch.subjects AS t USING (SELECT @code AS code) AS s ON t.code = s.code
        WHEN MATCHED THEN UPDATE SET sort=@sort, grade_from=@gf, grade_to=@gt, is_live=@live, updated_at=SYSUTCDATETIME()
        WHEN NOT MATCHED THEN INSERT (code, sort, grade_from, grade_to, is_live) VALUES (@code, @sort, @gf, @gt, @live);
        SELECT id FROM luch.subjects WHERE code=@code;`, { code: s.code, sort: s.sort, gf: g[0], gt: g[g.length - 1], live: !!s.live })).recordset[0].id;
      await q(`MERGE luch.subject_texts AS t USING (SELECT @sid AS subject_id, @lang AS lang) AS s ON t.subject_id=s.subject_id AND t.lang=s.lang
        WHEN MATCHED THEN UPDATE SET name=@name, title=@title, intro=@intro
        WHEN NOT MATCHED THEN INSERT (subject_id, lang, name, title, intro) VALUES (@sid, @lang, @name, @title, @intro);`,
        { sid, lang: LANG, name: s.name, title: s.title || null, intro: s.intro || null });

      // ветки, темы, подтемы, связи — пачкой через OPENJSON
      const branches = s.branches.map((b, i) => ({ code: b.id, color: b.c, sort: i + 1, name: b.name }));
      await q(`
        MERGE luch.branches AS t USING (SELECT * FROM OPENJSON(@j) WITH (code NVARCHAR(32), color NVARCHAR(32), sort INT)) AS s
          ON t.subject_id=@sid AND t.code=s.code
        WHEN MATCHED THEN UPDATE SET color=s.color, sort=s.sort
        WHEN NOT MATCHED THEN INSERT (subject_id, code, color, sort) VALUES (@sid, s.code, s.color, s.sort);
        MERGE luch.branch_texts AS t USING (
          SELECT b.id AS branch_id, j.name FROM OPENJSON(@j) WITH (code NVARCHAR(32), name NVARCHAR(150)) j JOIN luch.branches b ON b.subject_id=@sid AND b.code=j.code) AS s
          ON t.branch_id=s.branch_id AND t.lang=@lang
        WHEN MATCHED THEN UPDATE SET name=s.name
        WHEN NOT MATCHED THEN INSERT (branch_id, lang, name) VALUES (s.branch_id, @lang, s.name);`, { sid, lang: LANG, j: J(branches) });

      const topics = s.topics.map((t, i) => ({ code: t.id, branch: t.b === "base" ? null : t.b, grade: t.g, sort: i + 1, status: t.status || "soon", url: t.href || null, title: t.t }));
      await q(`
        MERGE luch.topics AS t USING (
          SELECT j.code, b.id AS branch_id, j.grade, j.sort, j.status, j.url FROM OPENJSON(@j)
            WITH (code NVARCHAR(32), branch NVARCHAR(32), grade TINYINT, sort INT, status NVARCHAR(8), url NVARCHAR(200)) j
            LEFT JOIN luch.branches b ON b.subject_id=@sid AND b.code=j.branch) AS s
          ON t.subject_id=@sid AND t.code=s.code
        WHEN MATCHED THEN UPDATE SET branch_id=s.branch_id, grade=s.grade, sort=s.sort, status=s.status, page_url=s.url
        WHEN NOT MATCHED THEN INSERT (subject_id, branch_id, code, grade, sort, status, page_url) VALUES (@sid, s.branch_id, s.code, s.grade, s.sort, s.status, s.url);
        MERGE luch.topic_texts AS t USING (
          SELECT tp.id AS topic_id, j.title FROM OPENJSON(@j) WITH (code NVARCHAR(32), title NVARCHAR(200)) j JOIN luch.topics tp ON tp.subject_id=@sid AND tp.code=j.code) AS s
          ON t.topic_id=s.topic_id AND t.lang=@lang
        WHEN MATCHED THEN UPDATE SET title=s.title
        WHEN NOT MATCHED THEN INSERT (topic_id, lang, title) VALUES (s.topic_id, @lang, s.title);`, { sid, lang: LANG, j: J(topics) });

      const reqs = s.topics.flatMap((t) => t.req.map((r) => ({ code: t.id, req: r })));
      await q(`
        DELETE p FROM luch.topic_prereqs p JOIN luch.topics t ON t.id=p.topic_id WHERE t.subject_id=@sid;
        INSERT luch.topic_prereqs (topic_id, requires_id)
          SELECT a.id, b.id FROM OPENJSON(@j) WITH (code NVARCHAR(32), req NVARCHAR(32)) j
          JOIN luch.topics a ON a.subject_id=@sid AND a.code=j.code JOIN luch.topics b ON b.subject_id=@sid AND b.code=j.req;`, { sid, j: J(reqs) });

      const subs = s.topics.flatMap((t) => t.items.map((x, i) => ({ code: t.id, sort: i + 1, ready: !!(t.doneItems && i < t.doneItems), title: x })));
      await q(`
        MERGE luch.subtopics AS t USING (
          SELECT tp.id AS topic_id, j.sort, j.ready FROM OPENJSON(@j) WITH (code NVARCHAR(32), sort INT, ready BIT) j JOIN luch.topics tp ON tp.subject_id=@sid AND tp.code=j.code) AS s
          ON t.topic_id=s.topic_id AND t.sort=s.sort
        WHEN MATCHED THEN UPDATE SET is_ready=s.ready
        WHEN NOT MATCHED THEN INSERT (topic_id, sort, is_ready) VALUES (s.topic_id, s.sort, s.ready);
        MERGE luch.subtopic_texts AS t USING (
          SELECT st.id AS subtopic_id, j.title FROM OPENJSON(@j) WITH (code NVARCHAR(32), sort INT, title NVARCHAR(300)) j
            JOIN luch.topics tp ON tp.subject_id=@sid AND tp.code=j.code JOIN luch.subtopics st ON st.topic_id=tp.id AND st.sort=j.sort) AS s
          ON t.subtopic_id=s.subtopic_id AND t.lang=@lang
        WHEN MATCHED THEN UPDATE SET title=s.title
        WHEN NOT MATCHED THEN INSERT (subtopic_id, lang, title) VALUES (s.subtopic_id, @lang, s.title);`, { sid, lang: LANG, j: J(subs) });
      console.log(`${s.name}: ${branches.length} веток, ${topics.length} тем, ${subs.length} подтем`);
    }

    for (const lab of labs) {
      const tid = (await q(`SELECT t.id FROM luch.topics t JOIN luch.subjects s ON s.id=t.subject_id WHERE s.code=@s AND t.code=@t`, { s: lab.subject, t: lab.topic })).recordset[0]?.id;
      if (!tid) { console.warn(lab.dir, "тема не найдена:", lab.subject, lab.topic); continue; }
      const lessons = lab.lessons.map((l, i) => ({
        code: l.id, sort: i + 1, params: J(plainParams(l)), title: l.title,
        body: J(Array.isArray(l.text) ? l.text : [l.text || l.overview || l.goal].filter(Boolean)), task: l.task || null, hint: l.hint || null,
      }));
      await q(`
        MERGE luch.lessons AS t USING (SELECT * FROM OPENJSON(@j) WITH (code NVARCHAR(32), sort INT, params NVARCHAR(MAX))) AS s
          ON t.topic_id=@tid AND t.code=s.code
        WHEN MATCHED THEN UPDATE SET sort=s.sort, page_url=@url, params_json=s.params
        WHEN NOT MATCHED THEN INSERT (topic_id, code, sort, page_url, params_json) VALUES (@tid, s.code, s.sort, @url, s.params);
        MERGE luch.lesson_texts AS t USING (
          SELECT l.id AS lesson_id, j.title, j.body, j.task, j.hint FROM OPENJSON(@j)
            WITH (code NVARCHAR(32), title NVARCHAR(200), body NVARCHAR(MAX), task NVARCHAR(1000), hint NVARCHAR(1000)) j
            JOIN luch.lessons l ON l.topic_id=@tid AND l.code=j.code) AS s
          ON t.lesson_id=s.lesson_id AND t.lang=@lang
        WHEN MATCHED THEN UPDATE SET title=s.title, body_json=s.body, task=s.task, hint=s.hint
        WHEN NOT MATCHED THEN INSERT (lesson_id, lang, title, body_json, task, hint) VALUES (s.lesson_id, @lang, s.title, s.body, s.task, s.hint);`,
        { tid, url: lab.url, lang: LANG, j: J(lessons) });

      const scenes = Object.entries(lab.scenes).flatMap(([lesson, list]) => list.map((sc, i) => ({
        lesson, sort: i + 1, state: J({ from: sc.from || null, to: sc.to || null }), cap: sc.cap, say: sc.say, formula: sc.formula || null,
        icons: sc.icons ? J(sc.icons) : null, audio: `/${lab.dir}/reels/${lesson}-${i}.mp3`, dur: lab.durs[`${lesson}-${i}`] ?? null,
      })));
      if (scenes.length) await q(`
        DELETE x FROM luch.reel_scene_texts x JOIN luch.reel_scenes r ON r.id=x.scene_id JOIN luch.lessons l ON l.id=r.lesson_id
          WHERE l.topic_id=@tid AND NOT EXISTS (SELECT 1 FROM OPENJSON(@j) WITH (lesson NVARCHAR(32), sort INT) j WHERE j.lesson=l.code AND j.sort=r.sort);
        DELETE r FROM luch.reel_scenes r JOIN luch.lessons l ON l.id=r.lesson_id
          WHERE l.topic_id=@tid AND NOT EXISTS (SELECT 1 FROM OPENJSON(@j) WITH (lesson NVARCHAR(32), sort INT) j WHERE j.lesson=l.code AND j.sort=r.sort);
        MERGE luch.reel_scenes AS t USING (
          SELECT l.id AS lesson_id, j.sort, j.state FROM OPENJSON(@j) WITH (lesson NVARCHAR(32), sort INT, state NVARCHAR(MAX)) j JOIN luch.lessons l ON l.topic_id=@tid AND l.code=j.lesson) AS s
          ON t.lesson_id=s.lesson_id AND t.sort=s.sort
        WHEN MATCHED THEN UPDATE SET state_json=s.state
        WHEN NOT MATCHED THEN INSERT (lesson_id, sort, state_json) VALUES (s.lesson_id, s.sort, s.state);
        MERGE luch.reel_scene_texts AS t USING (
          SELECT r.id AS scene_id, j.cap, j.say, j.formula, j.icons, j.audio, j.dur FROM OPENJSON(@j)
            WITH (lesson NVARCHAR(32), sort INT, cap NVARCHAR(200), say NVARCHAR(2000), formula NVARCHAR(200), icons NVARCHAR(1000), audio NVARCHAR(300), dur DECIMAL(6,2)) j
            JOIN luch.lessons l ON l.topic_id=@tid AND l.code=j.lesson JOIN luch.reel_scenes r ON r.lesson_id=l.id AND r.sort=j.sort) AS s
          ON t.scene_id=s.scene_id AND t.lang=@lang
        WHEN MATCHED THEN UPDATE SET cap=s.cap, say=s.say, formula=s.formula, icons_json=s.icons, audio_url=s.audio, duration_s=s.dur
        WHEN NOT MATCHED THEN INSERT (scene_id, lang, cap, say, formula, icons_json, audio_url, duration_s) VALUES (s.scene_id, @lang, s.cap, s.say, s.formula, s.icons, s.audio, s.dur);`,
        { tid, lang: LANG, j: J(scenes) });
      console.log(`${lab.url}: ${lessons.length} уроков, ${scenes.length} сцен роликов`);
    }
    await tx.commit();
  } catch (e) { await tx.rollback(); throw e; }
}

async function check() {
  const pool = await getPool();
  const r = await pool.request().query(`SELECT t.name, SUM(p.rows) AS n FROM sys.tables t JOIN sys.partitions p ON p.object_id=t.object_id AND p.index_id IN (0,1)
    WHERE SCHEMA_NAME(t.schema_id)='luch' GROUP BY t.name ORDER BY t.name`);
  console.table(r.recordset);
}

(async () => {
  const cmd = process.argv[2];
  if (cmd === "migrate") { const pool = await getPool(); await pool.request().batch(SCHEMA); console.log("схема luch готова"); }
  else if (cmd === "sync") await sync();
  else if (cmd === "check") await check();
  else if (cmd === "dry") { const c = loadContent(); console.log(c.subjects.map((s) => `${s.code}: ${s.topics.length}`).join(", "), "| labs:", c.labs.map((l) => `${l.dir}:${l.lessons.length}`).join(", ")); }
  else { console.error("Команды: migrate, sync, check, dry"); process.exit(1); }
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
