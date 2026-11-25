// «Научи меня» в разделе «Профессии»: ИИ составляет курс по любой теме и пишет уроки по требованию
// (по образцу AI Tutor на roadmap.sh). Всё, что сгенерировано, хранится в luch.prof_ai и дальше отдаётся из кэша.
//   POST /api/prof/course { term, roadmap?, topic? } → курс (из кэша или новый); { slug } → курс по адресу
//   POST /api/prof/lesson { slug, m, l } → NDJSON-поток: {stage}, {plan}, {d: кусок текста}, {reset}, {done}, {error}
//   POST /api/prof/quiz   { slug, m, l } → { questions: [{ q, options[4], correct, why }] }
// Модель: Claude, если есть ключ ANTHROPIC (при ошибке — дальше по списку), затем OpenAI (на проде), затем Gemini.
const fs = require("fs");
const os = require("os");
const path = require("path");

const OPENAI_MODEL = process.env.PROF_OPENAI_MODEL || "gpt-4.1";
const OPENAI_MINI = process.env.PROF_OPENAI_MINI || "gpt-4.1-mini";
const CLAUDE_MODEL = process.env.PROF_CLAUDE_MODEL || "claude-sonnet-5-5";
const GEMINI_MODEL = process.env.PROF_GEMINI_MODEL || "gemini-3.7-flash";
// лимиты на НОВЫЕ генерации (из кэша — без ограничений)
const IP_COURSES = Number(process.env.PROF_IP_COURSES) || 8;
const IP_LESSONS = Number(process.env.PROF_IP_LESSONS) || 40;
const DAY_COURSES = Number(process.env.PROF_DAY_COURSES) || 300;
const DAY_LESSONS = Number(process.env.PROF_DAY_LESSONS) || 3000;

function keyFrom(envName, fileName) {
  if (process.env[envName]) return process.env[envName].trim();
  try { return fs.readFileSync(path.join(os.homedir(), fileName), "utf8").trim() || null; } catch { return null; }
}
const anthropicKey = () => keyFrom("ANTHROPIC_API_KEY", ".anthropic-key");
const openaiKey = () => keyFrom("OPENAI_API_KEY", ".openaikey");
const geminiKey = () => keyFrom("GEMINI_API_KEY", ".gemini-key");
let claude = null, claudeDownUntil = 0; // нет денег на счёте — не стучимся в Claude 10 минут
function claudeClient() {
  const key = anthropicKey(); if (!key || Date.now() < claudeDownUntil) return null;
  if (!claude) { const mod = require("@anthropic-ai/sdk"); const A = mod.Anthropic || mod.default || mod; claude = new A({ apiKey: key }); }
  return claude;
}

// ---------- модель ----------
// complete({ system, user, tier: "main"|"mini", json, max, onDelta }) → весь текст.
// onDelta получает куски по мере написания; если провайдер упал посреди ответа — onReset(), и следующий пишет заново.
async function complete(o) {
  const errs = [];
  const tryOne = async (name, fn) => {
    let any = false;
    const d = o.onDelta ? (t) => { any = true; o.onDelta(t); } : null;
    try { const t = await fn(d); if (!String(t || "").trim()) throw new Error("пустой ответ"); return { t, name }; }
    catch (e) { errs.push(name + ": " + (e && e.message)); if (any && o.onReset) o.onReset(); return null; }
  };
  let r = null;
  if (claudeClient()) {
    r = await tryOne("claude", async (d) => {
      try { return await viaClaude(o, d); }
      catch (e) { if (/credit|billing|balance|401|403|429|529|overloaded/i.test(String(e && (e.message || e.status)))) claudeDownUntil = Date.now() + 600e3; throw e; }
    });
  }
  if (!r && openaiKey()) r = await tryOne("openai", (d) => viaOpenAI(o, d));
  if (!r && geminiKey()) r = await tryOne("gemini", (d) => viaGemini(o, d));
  if (!r) throw new Error("нет модели: " + (errs.join("; ") || "нет ключей"));
  if (errs.length) console.log("[prof-teach] запасной путь " + r.name + " после: " + errs.join("; ").slice(0, 300));
  lastProvider = r.name;
  return r.t;
}
let lastProvider = "";
async function viaClaude(o, d) {
  const c = claudeClient();
  const args = { model: CLAUDE_MODEL, max_tokens: o.max || 4000, system: o.system, messages: [{ role: "user", content: o.user + (o.json ? "\n\nОтветь только JSON, без пояснений." : "") }] };
  if (!d) { const r = await c.messages.create(args); return (r.content || []).filter((x) => x.type === "text").map((x) => x.text).join(""); }
  const s = c.messages.stream(args); s.on("text", (t) => d(t));
  const r = await s.finalMessage(); return (r.content || []).filter((x) => x.type === "text").map((x) => x.text).join("");
}
async function viaOpenAI(o, d) {
  const body = { model: o.tier === "mini" ? OPENAI_MINI : OPENAI_MODEL, max_tokens: o.max || 4000, temperature: 0.6,
    messages: [{ role: "system", content: o.system }, { role: "user", content: o.user }] };
  if (o.json) body.response_format = { type: "json_object" };
  if (d) body.stream = true;
  const res = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", signal: AbortSignal.timeout(o.ms || 150000),
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + openaiKey() }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error("openai_" + res.status + " " + (await res.text().catch(() => "")).slice(0, 160));
  if (!d) { const j = await res.json(); return String((((j.choices || [])[0] || {}).message || {}).content || ""); }
  const dec = new TextDecoder(); let buf = "", out = "";
  for await (const chunk of res.body) {
    buf += dec.decode(chunk, { stream: true });
    let i; while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue; const p = line.slice(5).trim(); if (p === "[DONE]") continue;
      try { const t = ((((JSON.parse(p).choices || [])[0] || {}).delta) || {}).content; if (t) { out += t; d(t); } } catch { /* неполная строка */ }
    }
  }
  return out;
}
async function viaGemini(o, d) {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(GEMINI_MODEL) + ":generateContent", {
    method: "POST", signal: AbortSignal.timeout(o.ms || 150000), headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey() },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: o.system }] }, contents: [{ role: "user", parts: [{ text: o.user }] }],
      generationConfig: { maxOutputTokens: (o.max || 4000) * 2, temperature: 0.6, ...(o.json ? { responseMimeType: "application/json" } : {}) } }) });
  const text = await res.text(); if (!res.ok) throw new Error("gemini_" + res.status);
  const cc = ((JSON.parse(text).candidates || [])[0] || {}).content;
  const t = cc && cc.parts ? cc.parts.map((p) => (p.thought ? "" : p.text || "")).join("") : "";
  if (d && t) d(t);
  return t;
}
const jsonOf = (t) => { const a = t.indexOf("{"), z = t.lastIndexOf("}"); return JSON.parse(t.slice(a, z + 1)); };

// ---------- кэш в базе (luch.prof_ai), при недоступной базе — в памяти ----------
let dbMod = null, ready = null;
const mem = new Map();
async function pool() {
  if (!dbMod) dbMod = require("./db.js");
  const p = await dbMod.getPool();
  if (!ready) ready = p.request().query("IF OBJECT_ID('luch.prof_ai') IS NULL CREATE TABLE luch.prof_ai (k NVARCHAR(400) NOT NULL PRIMARY KEY, body NVARCHAR(MAX) NOT NULL, created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME());")
    .catch((e) => { ready = null; throw e; });
  await ready; return p;
}
async function cget(k) {
  if (mem.has(k)) return mem.get(k);
  try {
    const sql = require("mssql"), p = await pool();
    const r = await p.request().input("k", sql.NVarChar(400), k).query("SELECT body FROM luch.prof_ai WHERE k = @k");
    const v = r.recordset.length ? r.recordset[0].body : null;
    if (v != null && mem.size < 3000) mem.set(k, v);
    return v;
  } catch (e) { console.log("[prof-teach db] " + (e && e.message)); return null; }
}
async function cset(k, v) {
  mem.set(k, v);
  try {
    const sql = require("mssql"), p = await pool();
    await p.request().input("k", sql.NVarChar(400), k).input("b", sql.NVarChar(sql.MAX), v)
      .query("IF EXISTS (SELECT 1 FROM luch.prof_ai WHERE k = @k) UPDATE luch.prof_ai SET body = @b WHERE k = @k ELSE INSERT luch.prof_ai (k, body) VALUES (@k, @b)");
  } catch (e) { console.log("[prof-teach db] " + (e && e.message)); }
}
// одна генерация на ключ: второй запрос ждёт первый
const inflight = new Map();
function once(k, fn) {
  if (inflight.has(k)) return { p: inflight.get(k), mine: false };
  const p = Promise.resolve().then(fn).finally(() => inflight.delete(k));
  inflight.set(k, p); return { p, mine: true };
}

// ---------- лимиты ----------
const use = new Map(); let today = { d: "", c: 0, l: 0 };
function ipOf(req, clientIp) {
  const raw = String(clientIp(req) || "");
  return /^\d+\.\d+\.\d+\.\d+:\d+$/.test(raw) ? raw.replace(/:\d+$/, "") : /^\[.*\]:\d+$/.test(raw) ? raw.replace(/^\[(.*)\]:\d+$/, "$1") : raw;
}
// kind: "c" (курс) | "l" (урок или тест). null — можно, иначе текст ошибки
function spend(ip, kind) {
  const d = new Date().toISOString().slice(0, 10);
  if (today.d !== d) { today = { d, c: 0, l: 0 }; use.clear(); }
  const u = use.get(ip) || { c: 0, l: 0 };
  if (kind === "c" && (today.c >= DAY_COURSES)) return "Сегодня ИИ уже составил очень много курсов и отдыхает. Загляни завтра — а пока открой готовые курсы.";
  if (kind === "l" && (today.l >= DAY_LESSONS)) return "Сегодня ИИ уже написал очень много уроков и отдыхает. Загляни завтра — уже готовые уроки открываются как обычно.";
  if (kind === "c" && u.c >= IP_COURSES) return `На сегодня хватит новых курсов: ты уже заказал ${IP_COURSES}. Завтра можно ещё — а пока доучи начатые, они открываются без ограничений.`;
  if (kind === "l" && u.l >= IP_LESSONS) return `На сегодня хватит новых уроков: ИИ написал для тебя уже ${IP_LESSONS}. Завтра можно продолжить — уже готовые уроки открываются без ограничений.`;
  u[kind]++; today[kind]++; use.set(ip, u); return null;
}

// ---------- slug ----------
const TR = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya", ә: "a", ғ: "g", қ: "k", ң: "n", ө: "o", ұ: "u", ү: "u", һ: "h", і: "i" };
const slugify = (s) => String(s).toLowerCase().split("").map((c) => (TR[c] !== undefined ? TR[c] : c)).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "") || "kurs";
const normTerm = (s) => String(s || "").toLowerCase().replace(/ё/g, "е").replace(/[«»"'`]/g, "").replace(/\s+/g, " ").trim().slice(0, 120);

// ---------- данные карт профессий ----------
function roadmapTopic(rm, id) {
  if (!/^[a-z0-9-]{2,30}$/.test(String(rm || "")) || !/^[a-z0-9-]{1,40}$/.test(String(id || ""))) return null;
  const f = path.join(__dirname, "..", "prof", "data", rm + ".js"); if (!fs.existsSync(f)) return null;
  const P = require(f);
  for (const s of P.stages || []) for (const t of s.topics || []) if (t.id === id) return { P, s, t };
  return null;
}

// ---------- промпты ----------
const STYLE = [
  "Пиши по-русски, просто и «на пальцах», обращайся к ученику на «ты». Читатель — умный новичок: школьник старших классов или взрослый, который меняет профессию.",
  "Примеры — международные и понятные везде: интернет-магазин, кофейня, служба доставки, клиника, стартап. Не привязывайся к стране: не упоминай конкретные страны, города, местные валюты и законы. Деньги — в долларах ($).",
  "Только практика: что делать, как решать, как не ошибиться. Без истории, дат и зубрёжки определений.",
  "Не выдумывай точные цены, версии продуктов и статистику. Если для примера нужны числа — бери условные и прямо говори «допустим».",
].join("\n");

const COURSE_SYS = [
  "Ты — методист Open School AI. Составь программу короткого практического курса по теме, которую попросил ученик.",
  STYLE,
  "Размер: по умолчанию 4 модуля по 3 урока (12 уроков). Если тема узкая или очень широкая — можно 3–5 модулей и 3–4 урока в модуле, но не больше 20 уроков всего. Модули идут от простого к сложному, последний модуль — применение на практике.",
  "Придумай ОДИН сквозной пример, который пройдёт через все уроки (как пекарня, для которой делают сайт): конкретная вымышленная компания или ситуация с понятными числами. Опиши его в поле example 1–2 предложениями.",
  "Названия уроков — конкретные действия или вопросы (например, «Как выбрать размер кусочков текста»), не «Введение» и не «Основы».",
  'Ответь только JSON: {"title":"короткое название курса","subtitle":"одна строка: что ученик сможет после курса","about":"2–3 предложения о курсе","covers":["5 пунктов: чему научишься"],"category":"область, 1–3 слова","difficulty":"Начальный|Средний|Продвинутый","prereq":["что желательно знать заранее, 0–4 коротких пункта"],"example":"сквозной пример","modules":[{"title":"…","goal":"одно предложение: что умеешь после модуля","lessons":[{"title":"…"}]}]}',
].join("\n");

const LESSON_FORMAT = [
  "Формат — Markdown с особыми блоками (страница их рисует). Не пиши заголовок урока первой строкой — он уже на странице. Не используй HTML-теги.",
  "Структура урока по порядку:",
  "1. Начало: 1–2 абзаца — конкретная ситуация из сквозного примера курса, в которой нужен этот урок.",
  "2. 3–5 разделов с заголовками `## …`. Внутри — короткие абзацы и списки, ключевые термины **жирным** с объяснением простыми словами.",
  "3. Ровно одна схема решения в блоке ```flow … ``` — синтаксис Mermaid `flowchart TD`, 4–10 узлов. Каждую подпись пиши в кавычках: A[\"Текст\"], B{\"Вопрос?\"}; подписи стрелок: -->|Да|, -->|Нет|. Внутри подписей нет кавычек, скобок и точек с запятой.",
  "4. Хотя бы одна таблица Markdown (сравнение вариантов, критерии, чек-лист с баллами).",
  "5. Раздел `## Разбор на примере` — пошаговый разбор на сквозном примере с конкретными числами.",
  "6. По одному блоку совета и ловушки:\n:::tip\nкороткий совет\n:::\n:::pitfall\nчастая ошибка и как её избежать\n:::",
  "7. Ровно одна проверка понимания посреди урока, после объяснения главного (JSON в одну строку, 4 варианта, correct — номер верного с 0):\n:::check\n{\"q\":\"вопрос-ситуация\",\"options\":[\"…\",\"…\",\"…\",\"…\"],\"correct\":1,\"why\":\"почему так, 1–2 предложения\"}\n:::",
  "8. Раздел `## Упражнения` — 2–3 задания, каждое в своём блоке: условие, затем строка из трёх дефисов, затем ответ с объяснением:\n:::exercise\nусловие\n---\nответ\n:::\nЕсли тема техническая — одно задание с небольшим кодом (Python, SQL или JavaScript в блоке кода с указанием языка).",
  "9. Раздел `## Итог` — 3–5 пунктов главного и одна фраза, что будет в следующем уроке (назови его).",
  "10. В самом конце — 4 вопроса, которые ученик может задать наставнику, чтобы копнуть глубже, по одному на строку:\n:::ask\nвопрос 1\nвопрос 2\nвопрос 3\nвопрос 4\n:::",
  "Не ставь отдельные заголовки над блоками :::tip, :::pitfall и :::check — у них есть своя подпись; вставляй их прямо в тот раздел, к которому они относятся.",
  "Объём — 900–1400 слов. Код и таблицы — только по делу.",
].join("\n");

function outlineText(C, m, l) {
  return C.modules.map((M, i) => `Модуль ${i + 1}. ${M.title} — ${M.goal || ""}\n` + M.lessons.map((L, j) => `  ${i === m && j === l ? "▶ " : ""}${i + 1}.${j + 1} ${L.title}${i === m && j === l ? "  ← ЭТОТ УРОК" : ""}`).join("\n")).join("\n");
}
function anchorText(C) {
  if (!C.roadmap) return "";
  const x = roadmapTopic(C.roadmap, C.topic); if (!x) return "";
  return `\nКурс для будущего специалиста «${x.P.title}» (${x.P.ru}): ${x.P.short}\nТема карты навыков: «${x.t.t}». ${x.t.what}\nЧто выучить: ${x.t.learn.join("; ")}.\nПрактика из карты: ${x.t.practice}\nПримеры связывай с работой этой профессии.`;
}
function lessonCtx(C, m, l) {
  const flat = C.modules.flatMap((M, i) => M.lessons.map((L, j) => ({ i, j, t: L.title })));
  const n = flat.findIndex((x) => x.i === m && x.j === l), prev = flat[n - 1], next = flat[n + 1];
  return [`Курс: «${C.title}» — ${C.subtitle}`, `Сквозной пример курса: ${C.example || "придумай сам и держись его"}`, anchorText(C),
    `Программа курса:\n${outlineText(C, m, l)}`,
    `Сейчас пишем: модуль ${m + 1} «${C.modules[m].title}», урок ${l + 1} — «${C.modules[m].lessons[l].title}» (урок ${n + 1} из ${flat.length}).`,
    prev ? `Предыдущий урок: «${prev.t}» — не повторяй его, можно сослаться.` : "Это первый урок курса.",
    next ? `Следующий урок: «${next.t}» — не забегай вперёд, назови его в итоге.` : "Это последний урок курса: в итоге подведи итог всего курса."].filter(Boolean).join("\n");
}

function cleanCourse(j) {
  const s = (x, n) => String(x == null ? "" : x).replace(/\s+/g, " ").trim().slice(0, n);
  let modules = (Array.isArray(j.modules) ? j.modules : []).slice(0, 5).map((M) => ({ title: s(M.title, 120), goal: s(M.goal, 300),
    lessons: (Array.isArray(M.lessons) ? M.lessons : []).slice(0, 4).map((L) => ({ title: s(typeof L === "string" ? L : L && L.title, 140) })).filter((L) => L.title) })).filter((M) => M.title && M.lessons.length);
  let total = 0; modules = modules.map((M) => { const room = Math.max(0, 20 - total); M.lessons = M.lessons.slice(0, room); total += M.lessons.length; return M; }).filter((M) => M.lessons.length);
  if (modules.length < 2 || total < 6) throw new Error("плохая программа");
  return { title: s(j.title, 120), subtitle: s(j.subtitle, 200), about: s(j.about, 700), covers: (j.covers || []).slice(0, 6).map((x) => s(x, 200)).filter(Boolean),
    category: s(j.category, 60), difficulty: ["Начальный", "Средний", "Продвинутый"].includes(s(j.difficulty, 20)) ? s(j.difficulty, 20) : "Начальный",
    prereq: (j.prereq || []).slice(0, 5).map((x) => s(x, 80)).filter(Boolean), example: s(j.example, 400), modules };
}

async function makeCourse(term, x) {
  let user = `Тема, которую попросил ученик: «${term}».`;
  if (x) user += `\nЭто тема из карты навыков профессии «${x.P.title}» (${x.P.ru}): ${x.P.short}\nТема: «${x.t.t}». ${x.t.what}\nЧто выучить: ${x.t.learn.join("; ")}.\nПрактика: ${x.t.practice}\nСоставь курс для будущего ${x.P.title}: те же навыки, примеры из работы этой профессии. Обязательно покрой все пункты «Что выучить».`;
  const j = jsonOf(await complete({ system: COURSE_SYS, user, tier: "main", json: true, max: 2500, ms: 90000 }));
  const C = cleanCourse(j); if (!C.title) C.title = term;
  let base = slugify(C.title), slug = base;
  for (let i = 2; (await cget("course|" + slug)) || inflight.has("course|" + slug); i++) slug = base.slice(0, 55) + "-" + i;
  C.slug = slug; C.term = term; if (x) { C.roadmap = x.P.slug; C.topic = x.t.id; C.roadmapTitle = x.P.title; C.topicTitle = x.t.t; }
  C.at = new Date().toISOString();
  await cset("course|" + slug, JSON.stringify(C));
  return C;
}

// ---------- обработчик ----------
async function handle(req, res, { readBody, clientIp }) {
  const url = req.url.split("?")[0];
  const send = (code, obj) => { if (res.headersSent) return; res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); };
  if (req.method !== "POST") return send(405, { error: "POST" });
  let b = {}; try { b = JSON.parse(await readBody(req)) || {}; } catch { return send(400, { error: "bad json" }); }
  const ip = ipOf(req, clientIp);
  try {
    if (url === "/api/prof/course") {
      if (b.slug) {
        const v = await cget("course|" + String(b.slug).slice(0, 80));
        return v ? send(200, { ...JSON.parse(v), cached: true }) : send(404, { error: "Курс не найден. Попробуй составить его заново." });
      }
      const x = b.roadmap && b.topic ? roadmapTopic(b.roadmap, b.topic) : null;
      const term = String((x && x.t.t) || b.term || "").replace(/\s+/g, " ").trim().slice(0, 120);
      if (term.length < 2) return send(400, { error: "Напиши, чему тебя научить." });
      const tk = "term|" + (x ? "rm:" + x.P.slug + ":" + x.t.id : normTerm(term));
      const have = await cget(tk);
      if (have) { const v = await cget("course|" + have); if (v) return send(200, { ...JSON.parse(v), cached: true }); }
      let job = inflight.get(tk);
      if (!job) {
        const block = spend(ip, "c"); if (block) return send(429, { error: block });
        job = once(tk, async () => { const C = await makeCourse(term, x); await cset(tk, C.slug); return C; }).p;
      }
      const C = await job; return send(200, { ...C, cached: false });
    }

    const slug = String(b.slug || "").slice(0, 80), m = Number(b.m) | 0, l = Number(b.l) | 0;
    const cv = await cget("course|" + slug); if (!cv) return send(404, { error: "Курс не найден." });
    const C = JSON.parse(cv), M = C.modules[m], L = M && M.lessons[l];
    if (!L) return send(404, { error: "Такого урока нет в курсе." });
    const lk = `lesson|${slug}|${m}|${l}`;

    if (url === "/api/prof/lesson") {
      res.writeHead(200, { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" });
      const out = (o) => { if (!res.writableEnded) try { res.write(JSON.stringify(o) + "\n"); } catch { /* ушёл */ } };
      const have = await cget(lk);
      if (have) { out({ cached: true }); out({ d: have }); out({ done: true }); return res.end(); }
      let job = inflight.get(lk), mine = false;
      if (!job) {
        const block = spend(ip, "l"); if (block) { out({ error: block }); return res.end(); }
        mine = true;
        job = once(lk, async () => {
          out({ stage: "plan" });
          const ctx = lessonCtx(C, m, l);
          let plan = "";
          try {
            plan = await complete({ tier: "mini", max: 500, ms: 45000, onDelta: (t) => out({ plan: t }), onReset: () => out({ planReset: true }),
              system: "Ты — методист. Коротко спланируй урок: 5–7 пунктов, по одной строке, без Markdown-заголовков. Что объяснить, какую ситуацию из сквозного примера взять, какую схему и таблицу показать, какие упражнения дать. Пиши по-русски.\n" + STYLE,
              user: ctx });
          } catch (e) { console.log("[prof-teach plan] " + (e && e.message)); }
          out({ stage: "write" });
          const md = await complete({ tier: "main", max: 6000, ms: 180000, onDelta: (t) => out({ d: t }), onReset: () => out({ reset: true }),
            system: "Ты — сильный практик и добрый преподаватель Open School AI. Напиши один урок курса.\n" + STYLE + "\n" + LESSON_FORMAT,
            user: ctx + (plan ? "\n\nПлан урока:\n" + plan : "") });
          const clean = md.replace(/^\s*#\s+[^\n]*\n/, "").trim();
          await cset(lk, clean); return clean;
        }).p;
      } else out({ stage: "wait" });
      try {
        const md = await job;
        if (!mine) { out({ reset: true }); out({ d: md }); }
        out({ done: true });
      } catch (e) { console.log("[prof-teach lesson] " + (e && e.message)); out({ error: "Не получилось написать урок. Попробуй ещё раз через минуту." }); }
      return res.end();
    }

    if (url === "/api/prof/quiz") {
      const qk = `quiz|${slug}|${m}|${l}`;
      const have = await cget(qk); if (have) return send(200, { ...JSON.parse(have), cached: true });
      const md = await cget(lk); if (!md) return send(409, { error: "Сначала открой урок — тест составляется по нему." });
      let job = inflight.get(qk);
      if (!job) {
        const block = spend(ip, "l"); if (block) return send(429, { error: block });
        job = once(qk, async () => {
          const j = jsonOf(await complete({ tier: "mini", json: true, max: 2500, ms: 60000,
            system: "Ты — преподаватель Open School AI. Составь тест из 5 вопросов по уроку ниже. Вопросы — практические ситуации (что сделаешь, что выберешь, где ошибка), а не определения. 4 варианта, один верный, неверные — правдоподобные. Позиция верного ответа меняется от вопроса к вопросу.\n" + STYLE +
              '\nОтветь только JSON: {"questions":[{"q":"…","options":["…","…","…","…"],"correct":0,"why":"1–2 предложения: почему так"}]}',
            user: `Курс «${C.title}», урок «${L.title}».\n\n${md.slice(0, 12000)}` }));
          const qs = (j.questions || []).slice(0, 5).map((q) => ({ q: String(q.q || "").slice(0, 500), options: (q.options || []).slice(0, 4).map((o) => String(o).slice(0, 240)), correct: Math.max(0, Math.min(3, Number(q.correct) | 0)), why: String(q.why || "").slice(0, 500) }))
            .filter((q) => q.q && q.options.length === 4);
          if (qs.length < 3) throw new Error("мало вопросов");
          const v = { questions: qs }; await cset(qk, JSON.stringify(v)); return v;
        }).p;
      }
      return send(200, { ...(await job), cached: false });
    }
    return send(404, { error: "not found" });
  } catch (e) {
    console.log("[prof-teach] " + (e && e.message));
    if (res.headersSent) { try { res.write(JSON.stringify({ error: "Не получилось. Попробуй ещё раз." }) + "\n"); res.end(); } catch { /* ушёл */ } return; }
    return send(502, { error: "ИИ сейчас не ответил. Попробуй ещё раз через минуту." });
  }
}

module.exports = { handle, slugify, _provider: () => lastProvider };
