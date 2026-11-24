// Открытые страницы-конспекты Open School для поисковиков и ИИ-ассистентов (SEO + GEO).
// Интерактивные уроки (/labs/…) рисуются скриптами, и поисковики видят в них почти пустую страницу.
// Здесь тот же материал — лекции, картинки, задания — отдаётся готовым HTML на русском и казахском:
//   /learn/                              все предметы          /kk/learn/… — то же на казахском
//   /learn/<предмет>/                    ветки и темы
//   /learn/<предмет>/<тема>/             уроки темы
//   /learn/<предмет>/<тема>/<n>/         конспект урока + ссылка на интерактивный урок
// Плюс robots.txt, sitemap.xml (с hreflang) и llms.txt для openschool.work, canonical для /labs/ и главной.
// Каталог: luch/learn-catalog.json (node scripts/learn-build.js), лекции и картинки — luch.lesson_story / luch.story_image.
const path = require("path");
const SITE = "https://openschool.work";
const isOsHost = (req) => /(^|\.)openschool\.work$/i.test(String(req.headers.host || "").replace(/:\d+$/, ""));
const isLocal = (req) => /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(String(req.headers.host || ""));

let CAT = null, catAt = 0;
function catalog() {
  if (CAT && Date.now() - catAt < 600e3) return CAT;
  const f = path.join(__dirname, "..", "luch", "learn-catalog.json");
  delete require.cache[require.resolve(f)];
  const c = require(f);
  for (const s of c.subjects) { s.T = new Map(s.topics.map((t) => [t.slug, t])); s.byId = new Map(s.topics.map((t) => [t.id, t])); }
  c.S = new Map(c.subjects.map((s) => [s.slug, s]));
  CAT = c; catAt = Date.now(); return c;
}

// ---------- данные из базы (кэш в памяти) ----------
let dbMod = null; const db = () => dbMod || (dbMod = require("./db.js"));
const story = new Map(); // key → { at, secs }
async function lecture(lab, n, lang) {
  const k = lab + "|" + (n - 1) + "|" + lang + "|f4", c = story.get(k);
  if (c && Date.now() - c.at < 6 * 3600e3) return c.secs;
  const sql = require("mssql"), pool = await db().getPool();
  const r = await pool.request().input("k", sql.NVarChar(300), k).query("SELECT body_json FROM luch.lesson_story WHERE story_key = @k");
  let secs = null; try { secs = r.recordset[0] ? JSON.parse(r.recordset[0].body_json).sections || null : null; } catch (e) { secs = null; }
  story.set(k, { at: Date.now(), secs }); if (story.size > 3000) story.delete(story.keys().next().value);
  return secs;
}
let imgs = null, imgsAt = 0; // множество «story_key#idx» готовых картинок
async function images() {
  if (imgs && Date.now() - imgsAt < 1800e3) return imgs;
  const pool = await db().getPool();
  const r = await pool.request().query("SELECT story_key + '#' + CAST(idx AS varchar(4)) k FROM luch.story_image WHERE story_key LIKE '/labs/%|ru|f4'");
  imgs = new Set(r.recordset.map((x) => x.k)); imgsAt = Date.now(); return imgs;
}

// вопросы ЕНТ (ent.mobi) по урокам: ключ «/labs/x/|N|lang» → [{u, q, w}]; сайт ЕНТ недоступен — блок просто не показывается
let ENT = null, entAt = 0, entP = null;
async function entMap() {
  if (ENT && Date.now() - entAt < 6 * 3600e3) return ENT;
  if (!entP) entP = fetch(process.env.ENT_MAP_URL || "https://ent.mobi/seo/os-map.json", { signal: AbortSignal.timeout(4000) }).then((r) => (r.ok ? r.json() : null))
    .then((j) => { if (j && j.map) { ENT = j.map; entAt = Date.now(); } }).catch(() => { entAt = Date.now() - 5.5 * 3600e3; }).finally(() => { entP = null; });
  if (!ENT) await Promise.race([entP, new Promise((r) => setTimeout(r, 2500))]);
  return ENT || {};
}
const entHtml = (lang, qs) => !qs || !qs.length ? "" : `<h2>${esc(UI[lang].ent)}</h2><ul class="ls">${qs.map((x) => `<li><a href="${esc(x.u)}">${esc(x.q)}</a>${x.w ? `<small>${esc(UI[lang].entWalk)}</small>` : ""}</li>`).join("")}</ul><p class="meta"><a href="https://ent.mobi/${lang === "kk" ? "kk/" : ""}ent/">${esc(UI[lang].entAll)} ›</a></p>`;

// ---------- подписи страниц ----------
const UI = {
  ru: { notes: "Конспекты уроков", home: "Главная", all: "Все предметы", grade: (g) => g + " класс", grades: (a, b) => `${a}–${b} классы`, lesson: "Урок", of: "из",
    open: "Открыть интерактивный урок", openSub: "Опыт своими руками, лекция голосом, ИИ-наставник и тест. Бесплатно.", task: "Задание в опыте", lessons: "Уроки темы",
    prev: "Предыдущий урок", next: "Следующий урок", inTopic: "Что изучают в теме", before: "Что пройти до этой темы", topics: "Темы", lessonsN: (n) => n + " " + pl(n, "урок", "урока", "уроков"),
    topicsN: (n) => n + " " + pl(n, "тема", "темы", "тем"), siteDesc: "Бесплатная школьная программа: интерактивные опыты, лекции с картинками и голосом, ИИ-наставник. Физика, математика, химия, биология, информатика, 5–11 классы.",
    learnTitle: "Конспекты уроков по физике, математике, химии, биологии и информатике", openLab: "Интерактивные уроки темы", formulas: "Формулы",
    ent: "Вопросы ЕНТ по этой теме", entWalk: "▶ с видеоразбором", entAll: "Все вопросы ЕНТ с разборами" },
  kk: { notes: "Сабақ конспектілері", home: "Басты бет", all: "Барлық пәндер", grade: (g) => g + "-сынып", grades: (a, b) => `${a}–${b} сыныптар`, lesson: "Сабақ", of: "/",
    open: "Интерактивті сабақты ашу", openSub: "Өз қолыңмен тәжірибе, дауыспен дәріс, ЖИ-тәлімгер және тест. Тегін.", task: "Тәжірибедегі тапсырма", lessons: "Тақырып сабақтары",
    prev: "Алдыңғы сабақ", next: "Келесі сабақ", inTopic: "Тақырыпта не оқытылады", before: "Бұл тақырыптан бұрын не өту керек", topics: "Тақырыптар", lessonsN: (n) => n + " сабақ",
    topicsN: (n) => n + " тақырып", siteDesc: "Тегін мектеп бағдарламасы: интерактивті тәжірибелер, суреттері мен дауысы бар дәрістер, ЖИ-тәлімгер. Физика, математика, химия, биология, информатика, 5–11 сыныптар.",
    learnTitle: "Физика, математика, химия, биология және информатика бойынша сабақ конспектілері", openLab: "Тақырыптың интерактивті сабақтары", formulas: "Формулалар",
    ent: "Осы тақырып бойынша ҰБТ сұрақтары", entWalk: "▶ бейнеталдауы бар", entAll: "Талдауы бар барлық ҰБТ сұрақтары" },
};
function pl(n, a, b, c) { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; }
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const T = (o, lang, f) => (o[lang] && o[lang][f]) || o.ru[f]; // казахский, если есть, иначе русский
const clip = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim().replace(/^(Сабақтың тақырыбы|Тема лекции) — «[^»]*»\.\s*(Талдап көрейік|Давай разберёмся)\.\s*/, ""); if (s.length <= n) return s; const c = s.slice(0, n); return c.slice(0, Math.max(c.lastIndexOf(" "), n - 20)).replace(/[,;:—–-]+$/, "") + "…"; };
const base = (lang) => (lang === "kk" ? "/kk/learn/" : "/learn/");
const url = (lang, ...p) => base(lang) + p.map((x) => x + "/").join("");
const labUrl = (t, n, lang) => t.lab + (n ? "?l=" + n : "") + (lang === "kk" ? (n ? "&" : "?") + "lang=kk" : "");

// ---------- разметка ----------
const CSS = `:root{--bg:#0b1019;--s:#121a28;--l:#26324a;--fg:#e8ecf4;--m:#8b96ad;--a:#ffb547;--g:#86e0a8}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.6 "Golos Text",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--a)}a:hover{color:#ffd08a}.w{max-width:820px;margin:0 auto;padding:0 16px}
header{display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid var(--l)}header .logo{font:700 15px/1 Unbounded,"Golos Text",sans-serif;letter-spacing:.08em;color:var(--fg);text-decoration:none;margin-right:auto}
.lang{display:flex;gap:2px;border:1px solid var(--l);border-radius:10px;padding:3px}.lang a,.lang b{padding:5px 9px;border-radius:7px;font:600 12px/1 inherit;text-decoration:none;color:var(--m)}.lang b{background:var(--fg);color:var(--bg)}
nav.bc{font-size:14px;color:var(--m);margin:18px 0 6px}nav.bc a{color:var(--m);text-decoration:none}nav.bc a:hover{color:var(--fg)}
h1{font:700 clamp(26px,6vw,38px)/1.2 Unbounded,"Golos Text",sans-serif;margin:6px 0 10px;letter-spacing:-.01em}h2{font-size:22px;line-height:1.3;margin:34px 0 8px}h3{font-size:18px;margin:22px 0 6px}
.meta{color:var(--m);font-size:15px;margin:0 0 18px}p{margin:0 0 14px}figure{margin:16px 0 20px}figure img{width:100%;height:auto;border-radius:14px;display:block;background:var(--s)}figcaption{font-size:13px;color:var(--m);margin-top:6px}
.cta{display:flex;flex-direction:column;gap:4px;margin:20px 0;padding:16px 18px;border-radius:16px;background:#ffb5471a;border:1px solid #ffb54755;text-decoration:none;color:var(--fg)}.cta b{color:var(--a);font-size:18px}.cta span{color:var(--m);font-size:14px}
.f{list-style:none;padding:0;margin:8px 0 16px}.f li{padding:10px 14px;margin:6px 0;border-radius:12px;background:var(--s);border:1px solid var(--l)}.f code{font:500 16px "IBM Plex Mono",ui-monospace,monospace;color:var(--fg)}.f small{display:block;color:var(--m);font-size:14px}
.task{padding:14px 16px;border-left:3px solid var(--g);background:var(--s);border-radius:0 12px 12px 0;margin:14px 0}
ol.ls,ul.ls{padding-left:22px}ol.ls li,ul.ls li{margin:8px 0}.ls .cur{font-weight:600;color:var(--fg)}.ls small{display:block;color:var(--m);font-size:14px}
.pn{display:flex;gap:10px;margin:28px 0}.pn a{flex:1;padding:12px 14px;border:1px solid var(--l);border-radius:12px;text-decoration:none;color:var(--fg);font-size:15px}.pn a small{display:block;color:var(--m);font-size:12px}.pn .nx{text-align:right}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;margin:14px 0}.grid a{display:block;padding:14px;border:1px solid var(--l);border-radius:14px;background:var(--s);text-decoration:none;color:var(--fg)}.grid a small{display:block;color:var(--m);font-size:13px;margin-top:4px}
footer{margin:40px 0 0;padding:20px 0 40px;border-top:1px solid var(--l);color:var(--m);font-size:14px}footer a{color:var(--m)}
@media (max-width:600px){body{font-size:16px}h2{font-size:20px}.pn{flex-direction:column}.pn .nx{text-align:left}}`;

function page({ lang, title, desc, path: p, alt, h1, crumbs, body, ld }) {
  const u = UI[lang], other = lang === "kk" ? "ru" : "kk";
  const canon = SITE + p, altUrl = alt ? SITE + alt : null;
  const ru = lang === "ru" ? canon : altUrl, kk = lang === "kk" ? canon : altUrl;
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${canon}">
${ru && kk ? `<link rel="alternate" hreflang="ru" href="${ru}"><link rel="alternate" hreflang="kk" href="${kk}"><link rel="alternate" hreflang="x-default" href="${ru}">` : ""}
<meta property="og:type" content="article"><meta property="og:site_name" content="Open School AI"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${canon}"><meta property="og:locale" content="${lang === "kk" ? "kk_KZ" : "ru_RU"}">
<link rel="icon" href="/luch/owl.svg"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;600&family=IBM+Plex+Mono:wght@500&family=Unbounded:wght@700&display=swap">
<style>${CSS}</style>${(ld || []).map((x) => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, "\\u003c")}</script>`).join("")}</head>
<body><div class="w"><header><a class="logo" href="/">OPEN SCHOOL AI</a><div class="lang">${lang === "ru" ? "<b>Рус</b>" : `<a href="${alt || url("ru")}" hreflang="ru">Рус</a>`}${lang === "kk" ? "<b>Қаз</b>" : `<a href="${alt || url("kk")}" hreflang="kk">Қаз</a>`}</div></header>
<nav class="bc" aria-label="breadcrumbs">${crumbs.map(([n, h]) => (h ? `<a href="${h}">${esc(n)}</a>` : esc(n))).join(" › ")}</nav>
<main><h1>${esc(h1)}</h1>${body}</main>
<footer>Open School AI — ${esc(u.siteDesc)}<br><a href="/">${esc(u.home)}</a> · <a href="${url(lang)}">${esc(u.notes)}</a> · <a href="${url(other)}" hreflang="${other}">${other === "kk" ? "Қазақша" : "На русском"}</a></footer></div></body></html>`;
}
const ORG = { "@type": "Organization", name: "Open School AI", url: SITE + "/" };
const crumbLd = (crumbs) => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs.filter((c) => c[1]).map(([n, h], i) => ({ "@type": "ListItem", position: i + 1, name: n, item: SITE + h })) });

function learnIndex(lang) {
  const c = catalog(), u = UI[lang];
  const body = `<p class="meta">${esc(u.siteDesc)}</p><div class="grid">${c.subjects.map((s) => `<a href="${url(lang, s.slug)}"><b>${esc(T(s, lang, "name"))}</b><small>${esc(u.grades(s.grades[0], s.grades[1]))} · ${esc(u.topicsN(s.topics.length))} · ${esc(u.lessonsN(s.topics.reduce((a, t) => a + t.lessons.length, 0)))}</small></a>`).join("")}</div>`;
  const crumbs = [[u.home, "/"], [u.notes, null]];
  return page({ lang, title: u.learnTitle + " | Open School AI", desc: u.siteDesc, path: url(lang), alt: url(lang === "kk" ? "ru" : "kk"), h1: u.notes, crumbs, body,
    ld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: u.learnTitle, inLanguage: lang, url: SITE + url(lang), publisher: ORG }] });
}
function subjectPage(lang, s) {
  const u = UI[lang], other = lang === "kk" ? "ru" : "kk", name = T(s, lang, "name");
  const blocks = s.branches.map((b) => { const ts = s.topics.filter((t) => t.b === b.id).sort((x, y) => x.g - y.g); if (!ts.length) return "";
    return `<h2>${esc(b[lang] || b.ru)}</h2><ul class="ls">${ts.map((t) => `<li><a href="${url(lang, s.slug, t.slug)}">${esc(T(t, lang, "title"))}</a><small>${esc(u.grade(t.g))} · ${esc(u.lessonsN(t.lessons.length))}${t.ru.items.length ? " · " + esc((t[lang] && t[lang].items && t[lang].items.every(Boolean) ? t[lang].items : t.ru.items).join(", ")) : ""}</small></li>`).join("")}</ul>`; }).join("");
  const crumbs = [[u.home, "/"], [u.notes, url(lang)], [name, null]];
  return page({ lang, title: `${T(s, lang, "title")} — ${u.notes.toLowerCase()} | Open School AI`, desc: T(s, lang, "intro") || u.siteDesc, path: url(lang, s.slug), alt: url(other, s.slug),
    h1: T(s, lang, "title"), crumbs, body: `<p class="meta">${esc(T(s, lang, "intro") || "")}</p>${blocks}`,
    ld: [crumbLd([...crumbs.slice(0, 2), [name, url(lang, s.slug)]]), { "@context": "https://schema.org", "@type": "CollectionPage", name: T(s, lang, "title"), inLanguage: lang, url: SITE + url(lang, s.slug), about: name, publisher: ORG }] });
}
async function topicPage(lang, s, t) {
  const u = UI[lang], other = lang === "kk" ? "ru" : "kk", name = T(s, lang, "name"), title = T(t, lang, "title");
  const firsts = await Promise.all(t.lessons.map((l) => lecture(t.lab, l.n, lang).catch(() => null)));
  const items = t[lang] && t[lang].items && t[lang].items.every(Boolean) ? t[lang].items : t.ru.items;
  const req = t.req.map((id) => s.byId.get(id)).filter(Boolean);
  const em = await entMap(), seen = new Set(), entQs = [];
  for (let k = 0; k < 3; k++) for (const l of t.lessons) { const x = (em[t.lab + "|" + (l.n - 1) + "|" + lang] || [])[k]; if (x && !seen.has(x.u) && entQs.length < 8) { seen.add(x.u); entQs.push(x); } }
  const lessonsHtml = `<h2>${esc(u.lessons)}</h2><ol class="ls">${t.lessons.map((l, i) => `<li><a href="${url(lang, s.slug, t.slug, l.n)}">${esc(T(l, lang, "title"))}</a>${firsts[i] && firsts[i][0] ? `<small>${esc(clip(firsts[i][0].text, 190))}</small>` : ""}</li>`).join("")}</ol>`;
  const body = `<p class="meta">${esc(name)} · ${esc(u.grade(t.g))} · ${esc(u.lessonsN(t.lessons.length))}</p>
${items.length ? `<h2>${esc(u.inTopic)}</h2><ul class="ls">${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
<a class="cta" href="${labUrl(t, 0, lang)}"><b>${esc(u.open)} ›</b><span>${esc(u.openSub)}</span></a>${lessonsHtml}${entHtml(lang, entQs)}
${req.length ? `<h2>${esc(u.before)}</h2><ul class="ls">${req.map((r) => `<li><a href="${url(lang, s.slug, r.slug)}">${esc(T(r, lang, "title"))}</a></li>`).join("")}</ul>` : ""}`;
  const crumbs = [[u.home, "/"], [u.notes, url(lang)], [name, url(lang, s.slug)], [title, null]];
  const desc = clip(`${title}: ${items.join(", ")}. ${(firsts[0] && firsts[0][0] && firsts[0][0].text) || ""}`, 160);
  return page({ lang, title: `${title} — ${name}, ${u.grade(t.g)} | Open School AI`, desc, path: url(lang, s.slug, t.slug), alt: url(other, s.slug, t.slug), h1: title, crumbs, body,
    ld: [crumbLd([...crumbs.slice(0, 3), [title, url(lang, s.slug, t.slug)]]), { "@context": "https://schema.org", "@type": "Course", name: title, description: desc, inLanguage: lang, url: SITE + url(lang, s.slug, t.slug),
      provider: ORG, educationalLevel: u.grade(t.g), isAccessibleForFree: true, about: name, teaches: items,
      hasCourseInstance: { "@type": "CourseInstance", courseMode: "online", courseWorkload: "PT" + t.lessons.length * 20 + "M" },
      offers: { "@type": "Offer", price: 0, priceCurrency: "KZT", category: "Free" },
      hasPart: t.lessons.map((l) => ({ "@type": "LearningResource", name: T(l, lang, "title"), url: SITE + url(lang, s.slug, t.slug, l.n) })) }] });
}
async function lessonPage(lang, s, t, l) {
  const u = UI[lang], other = lang === "kk" ? "ru" : "kk", name = T(s, lang, "name"), topic = T(t, lang, "title"), title = T(l, lang, "title");
  const secs = (await lecture(t.lab, l.n, lang)) || (await lecture(t.lab, l.n, "ru")) || [];
  const have = await images().catch(() => new Set()), ruKey = t.lab + "|" + (l.n - 1) + "|ru|f4", imgKey = t.lab + "|" + (l.n - 1) + "|ru"; // imgKey — как в lab-shell (сервер сам добавит |f4)
  const img = (i, sec) => !sec.formulas && !sec.scheme && i <= 7 && have.has(ruKey + "#" + i)
    ? `<figure><img src="/api/tutor/story/img?k=${encodeURIComponent(imgKey)}&amp;i=${i}" width="960" height="640" loading="${i ? "lazy" : "eager"}" alt="${esc(sec.img || title + (sec.title ? " — " + sec.title : ""))}"></figure>` : "";
  const fml = (sec) => Array.isArray(sec.formulas) && sec.formulas.length ? `<ul class="f">${sec.formulas.map((f) => `<li><code>${esc(f.f || f)}</code>${f.name ? `<small>${esc(f.name)}</small>` : ""}${Array.isArray(f.vars) && f.vars.length ? `<small>${f.vars.map((v) => `${esc(v[0])} — ${esc(v[1])}${v[2] ? ", " + esc(v[2]) : ""}`).join("<br>")}</small>` : ""}</li>`).join("")}</ul>` : "";
  const article = secs.map((sec, i) => `<section>${sec.title ? `<h2>${esc(sec.title)}</h2>` : ""}${String(sec.text || "").split(/\n{2,}/).map((p) => `<p>${esc(p)}</p>`).join("")}${fml(sec)}${img(i, sec)}</section>`).join("\n");
  const task = T(l, lang, "task"), prev = t.lessons[l.n - 2], next = t.lessons[l.n];
  const ent = entHtml(lang, (await entMap())[t.lab + "|" + (l.n - 1) + "|" + lang]);
  const body = `<p class="meta">${esc(name)} · ${esc(u.grade(t.g))} · <a href="${url(lang, s.slug, t.slug)}">${esc(topic)}</a> · ${esc(u.lesson)} ${l.n} ${u.of} ${t.lessons.length}</p>
<a class="cta" href="${labUrl(t, l.n, lang)}"><b>${esc(u.open)} ›</b><span>${esc(u.openSub)}</span></a>
<article>${article}</article>
${task ? `<h2>${esc(u.task)}</h2><div class="task">${esc(task)}</div><a class="cta" href="${labUrl(t, l.n, lang)}"><b>${esc(u.open)} ›</b><span>${esc(u.openSub)}</span></a>` : ""}
${ent}<div class="pn">${prev ? `<a href="${url(lang, s.slug, t.slug, prev.n)}"><small>‹ ${esc(u.prev)}</small>${esc(T(prev, lang, "title"))}</a>` : ""}${next ? `<a class="nx" href="${url(lang, s.slug, t.slug, next.n)}"><small>${esc(u.next)} ›</small>${esc(T(next, lang, "title"))}</a>` : ""}</div>
<h2>${esc(u.lessons)}: ${esc(topic)}</h2><ol class="ls">${t.lessons.map((x) => x.n === l.n ? `<li class="cur">${esc(T(x, lang, "title"))}</li>` : `<li><a href="${url(lang, s.slug, t.slug, x.n)}">${esc(T(x, lang, "title"))}</a></li>`).join("")}</ol>`;
  const crumbs = [[u.home, "/"], [u.notes, url(lang)], [name, url(lang, s.slug)], [topic, url(lang, s.slug, t.slug)], [title, null]];
  const desc = clip((secs[0] && secs[0].text) || `${title}. ${topic}`, 160);
  const firstImg = secs.findIndex((sec, i) => img(i, sec));
  return page({ lang, title: `${title} — ${topic} | ${name}, ${u.grade(t.g)} | Open School AI`, desc, path: url(lang, s.slug, t.slug, l.n), alt: url(other, s.slug, t.slug, l.n), h1: title, crumbs, body,
    ld: [crumbLd([...crumbs.slice(0, 4), [title, url(lang, s.slug, t.slug, l.n)]]), { "@context": "https://schema.org", "@type": "LearningResource", name: title, description: desc, inLanguage: lang,
      url: SITE + url(lang, s.slug, t.slug, l.n), learningResourceType: "Lesson", educationalLevel: u.grade(t.g), isAccessibleForFree: true, about: [name, topic], provider: ORG, publisher: ORG,
      isPartOf: { "@type": "Course", name: topic, url: SITE + url(lang, s.slug, t.slug), provider: ORG, description: clip(topic + ". " + desc, 160) },
      ...(firstImg >= 0 ? { image: SITE + "/api/tutor/story/img?k=" + encodeURIComponent(imgKey) + "&i=" + firstImg } : {}),
      potentialAction: { "@type": "ViewAction", name: u.open, target: SITE + labUrl(t, l.n, lang) } }] });
}

// ---------- robots, sitemap, llms.txt ----------
function robots() {
  return "User-agent: *\nAllow: /\nAllow: /api/tutor/story/img\nDisallow: /api/\nDisallow: /go/\n\n" +
    "# ИИ-поисковики и ассистенты — добро пожаловать\nUser-agent: GPTBot\nAllow: /\nUser-agent: OAI-SearchBot\nAllow: /\nUser-agent: ChatGPT-User\nAllow: /\nUser-agent: ClaudeBot\nAllow: /\nUser-agent: Claude-SearchBot\nAllow: /\nUser-agent: PerplexityBot\nAllow: /\nUser-agent: Google-Extended\nAllow: /\n\n" +
    "Sitemap: " + SITE + "/sitemap.xml\n";
}
const profSlugs = () => { const fs = require("fs"), d = path.join(__dirname, "..", "prof"); try { return fs.readdirSync(d).filter((x) => x !== "data" && fs.existsSync(path.join(d, x, "index.html"))); } catch (e) { return []; } };
function sitemap() {
  const c = catalog(), day = c.built.slice(0, 10), out = [];
  const pair = (ru, kk, pr) => { for (const [lang, p] of [["ru", ru], ["kk", kk]]) out.push(`<url><loc>${SITE}${p}</loc><lastmod>${day}</lastmod><priority>${pr}</priority><xhtml:link rel="alternate" hreflang="ru" href="${SITE}${ru}"/><xhtml:link rel="alternate" hreflang="kk" href="${SITE}${kk}"/><xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${ru}"/></url>`); };
  out.push(`<url><loc>${SITE}/</loc><priority>1.0</priority></url>`);
  pair(url("ru"), url("kk"), "0.9");
  for (const s of c.subjects) {
    pair(url("ru", s.slug), url("kk", s.slug), "0.8");
    for (const t of s.topics) {
      pair(url("ru", s.slug, t.slug), url("kk", s.slug, t.slug), "0.7");
      out.push(`<url><loc>${SITE}${t.lab}</loc><priority>0.6</priority></url>`);
      for (const l of t.lessons) pair(url("ru", s.slug, t.slug, l.n), url("kk", s.slug, t.slug, l.n), "0.6");
    }
  }
  // раздел «Профессии»: атлас и готовые карты (prof/<slug>/index.html, scripts/prof-build.js)
  out.push(`<url><loc>${SITE}/prof/</loc><priority>0.8</priority></url>`);
  for (const d of profSlugs()) out.push(`<url><loc>${SITE}/prof/${d}/</loc><priority>0.8</priority></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${out.join("\n")}\n</urlset>\n`;
}
function llms() {
  const c = catalog();
  return `# Open School AI\n\n> Бесплатная онлайн-школа для 5–11 классов (Казахстан и все русско- и казахскоязычные): физика, математика, химия, биология и информатика. ` +
    `Каждый урок — лекция с картинками и голосом, интерактивный опыт своими руками, ИИ-наставник, который видит экран ученика, и тест. Помогает готовиться к ЕНТ (ҰБТ). Языки: русский и казахский.\n\n` +
    `Конспекты всех уроков открыты без регистрации: ${SITE}/learn/ (русский) и ${SITE}/kk/learn/ (қазақша). У каждого конспекта есть ссылка на интерактивный урок.\n\n` +
    `Атлас новых профессий — карты навыков по шагам с практикой и сквозным проектом: ${SITE}/prof/` + profSlugs().map((d) => ` · ${SITE}/prof/${d}/`).join("") + `\n\n` +
    c.subjects.map((s) => `## ${s.ru.name} (${s.grades[0]}–${s.grades[1]} классы)\n\n${s.ru.intro}\n\n- [${s.ru.title}](${SITE}${url("ru", s.slug)})\n` +
      s.topics.map((t) => `- [${t.ru.title}](${SITE}${url("ru", s.slug, t.slug)}): ${t.g} класс, ${t.lessons.length} ${pl(t.lessons.length, "урок", "урока", "уроков")} — ${t.lessons.map((l) => l.ru.title).join("; ")}`).join("\n")).join("\n\n") + "\n";
}

// ---------- canonical для страниц приложения ----------
function decorate(urlPath, html) {
  const m = /^\/labs\/([a-z0-9-]+)\/?(index\.html)?$/.exec(urlPath);
  const canon = urlPath === "/" || urlPath === "/index.html" ? SITE + "/" : m ? SITE + "/labs/" + m[1] + "/" : null;
  if (!canon) return html;
  let s = html.toString("utf8");
  if (/<link rel="canonical"/i.test(s)) return html;
  let extra = `<link rel="canonical" href="${canon}">`;
  if (m) { // ссылка с интерактивного урока на открытый конспект темы — поисковик видит связь
    const c = catalog();
    for (const sj of c.subjects) for (const t of sj.topics) if (t.lab === "/labs/" + m[1] + "/") extra += `<link rel="alternate" type="text/html" href="${SITE}${url("ru", sj.slug, t.slug)}" title="${esc(t.ru.title)} — конспект">`;
  }
  return Buffer.from(s.replace(/<\/head>/i, extra + "</head>"), "utf8");
}

// ---------- маршруты ----------
const pages = new Map(); // кэш готовых страниц
function send(res, code, type, body, maxAge) { res.writeHead(code, { "Content-Type": type, "Cache-Control": "public, max-age=" + (maxAge || 600) }); res.end(body); }
function handle(req, res, urlPath) {
  const os = isOsHost(req) || isLocal(req);
  if (os && urlPath === "/robots.txt") { send(res, 200, "text/plain; charset=utf-8", robots(), 3600); return true; }
  if (os && urlPath === "/sitemap.xml") { send(res, 200, "application/xml; charset=utf-8", sitemap(), 3600); return true; }
  if (os && urlPath === "/llms.txt") { send(res, 200, "text/plain; charset=utf-8", llms(), 3600); return true; }
  const m = /^\/(kk\/)?learn(?:\/([a-z]+))?(?:\/([a-z0-9]+))?(?:\/(\d{1,2}))?\/?$/.exec(urlPath);
  if (!m) return false;
  if (!os) { res.writeHead(301, { Location: SITE + urlPath }); res.end(); return true; }
  if (!urlPath.endsWith("/")) { res.writeHead(301, { Location: urlPath + "/" }); res.end(); return true; }
  const lang = m[1] ? "kk" : "ru", c = catalog();
  const notFound = () => send(res, 404, "text/html; charset=utf-8", page({ lang, title: "404 | Open School AI", desc: "", path: urlPath, h1: "404", crumbs: [[UI[lang].notes, url(lang)]], body: `<p><a href="${url(lang)}">${esc(UI[lang].all)}</a></p>` }), 60);
  const s = m[2] && c.S.get(m[2]), t = s && m[3] && s.T.get(m[3]), l = t && m[4] && t.lessons[+m[4] - 1];
  if ((m[2] && !s) || (m[3] && !t) || (m[4] && !l)) { notFound(); return true; }
  const key = urlPath, hit = pages.get(key);
  if (hit && Date.now() - hit.at < 3600e3) { send(res, 200, "text/html; charset=utf-8", hit.html); return true; }
  (async () => {
    const html = l ? await lessonPage(lang, s, t, l) : t ? await topicPage(lang, s, t) : s ? subjectPage(lang, s) : learnIndex(lang);
    pages.set(key, { at: Date.now(), html }); if (pages.size > 2500) pages.delete(pages.keys().next().value);
    send(res, 200, "text/html; charset=utf-8", html);
  })().catch((e) => { console.log("[learn] " + (e && e.message)); if (!res.headersSent) send(res, 500, "text/plain; charset=utf-8", "error", 5); });
  return true;
}
module.exports = { handle, decorate, isOsHost };
