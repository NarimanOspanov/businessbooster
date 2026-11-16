// MCP-сервер Open School AI: https://saudager.ai/mcp (Streamable HTTP, JSON-RPC 2.0, без состояния).
// Его подключают в ChatGPT или Claude как коннектор — ученик занимается прямо в своём чате:
// думает модель за счёт его подписки, а мы отдаём программу, уроки, лекции, формулы, тесты и ссылки на опыты.
const sql = require("mssql");
const { getPool } = require("./db.js");

const SITE = "https://saudager.ai";
const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const SUBJ = { phys: "Физика", math: "Математика", chem: "Химия", bio: "Биология", cs: "Информатика" };

const INSTRUCTIONS = `Ты — наставник Open School AI: бесплатные интерактивные уроки по физике, математике, химии, биологии и информатике (школьная программа, подходит для любого возраста).
Как вести урок:
1. Узнай, что ученик хочет изучить (или предложи тему: list_topics / search_topics).
2. Возьми урок через get_lesson и объясни теорию простым языком, с примерами из жизни, коротко, по шагам. Не вываливай всё сразу.
3. Дай ссылку на интерактивный опыт урока (поле lab_url) — там ученик сам ставит опыт, в том числе в 3D «Как в жизни». Предложи выполнить задание урока и рассказать, что получилось.
4. Закрепи знания: get_quiz — задавай вопросы по одному, жди ответа, объясняй ошибки.
5. Предложи следующий урок.
Отвечай на языке ученика (по умолчанию — русский). Формулы пиши понятно, с объяснением букв.`;

const TOOLS = [
  { name: "list_subjects", title: "Предметы",
    description: "Список предметов Open School AI и сколько в каждом тем и уроков.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "list_topics", title: "Темы предмета",
    description: "Темы предмета по порядку изучения (от простого к сложному) с классом и числом уроков. subject: phys, math, chem, bio, cs.",
    inputSchema: { type: "object", properties: { subject: { type: "string", enum: Object.keys(SUBJ) }, grade: { type: "integer", description: "необязательно: только этот класс" } }, required: ["subject"], additionalProperties: false } },
  { name: "search_topics", title: "Найти тему",
    description: "Найти темы и уроки по словам (например «закон Ома», «дроби», «фотосинтез»).",
    inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false } },
  { name: "get_lesson", title: "Урок",
    description: "Урок темы: объяснение, популярная лекция (если есть), формулы, задание, подсказка и ссылка на интерактивный опыт. Без lesson — список уроков темы и первый урок.",
    inputSchema: { type: "object", properties: { topic: { type: "string", description: "код темы из list_topics (например current) или адрес /labs/phys-current/" }, subject: { type: "string", enum: Object.keys(SUBJ) }, lesson: { type: "integer", description: "номер урока с 1" } }, required: ["topic"], additionalProperties: false } },
  { name: "get_quiz", title: "Тест «Закрепим»",
    description: "Готовые вопросы с вариантами ответов и пояснениями к уроку (если уже составлены). Если вопросов нет — составь 4 вопроса сам по материалу get_lesson.",
    inputSchema: { type: "object", properties: { topic: { type: "string" }, subject: { type: "string", enum: Object.keys(SUBJ) }, lesson: { type: "integer" } }, required: ["topic", "lesson"], additionalProperties: false } },
];

// ---------- данные ----------
async function topicRow(pool, topic, subject) {
  const t = String(topic || "").trim();
  const byUrl = t.match(/\/labs\/([a-z]+)-([a-z0-9-]+)\/?/);
  const rq = pool.request().input("lang", sql.NVarChar(8), "ru");
  if (byUrl) rq.input("url", sql.NVarChar(200), `/labs/${byUrl[1]}-${byUrl[2]}/`);
  else rq.input("code", sql.NVarChar(32), t.toLowerCase()).input("subj", sql.NVarChar(32), subject || null);
  const r = await rq.query(`SELECT TOP 1 t.id, t.code, t.grade, t.page_url, s.code subj, tt.title FROM luch.topics t JOIN luch.subjects s ON s.id = t.subject_id
    LEFT JOIN luch.topic_texts tt ON tt.topic_id = t.id AND tt.lang = @lang
    WHERE ${byUrl ? "t.page_url = @url" : "t.code = @code AND (@subj IS NULL OR s.code = @subj)"} ORDER BY s.sort`);
  return r.recordset[0] || null;
}
async function lessonsOf(pool, topicId) {
  return (await pool.request().input("t", sql.Int, topicId).query(`SELECT l.id, l.sort, l.page_url, lt.title, lt.body_json, lt.task, lt.hint FROM luch.lessons l
    LEFT JOIN luch.lesson_texts lt ON lt.lesson_id = l.id AND lt.lang = 'ru' WHERE l.topic_id = @t ORDER BY l.sort`)).recordset;
}
async function cached(pool, key) {
  const r = await pool.request().input("k", sql.NVarChar(300), key).query("SELECT body_json FROM luch.lesson_story WHERE story_key = @k");
  try { return r.recordset[0] ? JSON.parse(r.recordset[0].body_json) : null; } catch { return null; }
}
const para = (j) => { try { const a = JSON.parse(j || "[]"); return Array.isArray(a) ? a.filter((x) => typeof x === "string") : []; } catch { return []; } };

async function call(name, a) {
  const pool = await getPool();
  if (name === "list_subjects") {
    const r = await pool.request().query(`SELECT s.code, (SELECT COUNT(*) FROM luch.topics t WHERE t.subject_id = s.id AND t.status <> 'soon') topics,
      (SELECT COUNT(*) FROM luch.lessons l JOIN luch.topics t ON t.id = l.topic_id WHERE t.subject_id = s.id) lessons FROM luch.subjects s ORDER BY s.sort`);
    return { subjects: r.recordset.map((x) => ({ subject: x.code, name: SUBJ[x.code] || x.code, topics: x.topics, lessons: x.lessons, map_url: SITE + "/#" + x.code })) };
  }
  if (name === "list_topics") {
    const r = await pool.request().input("s", sql.NVarChar(32), a.subject).input("g", sql.TinyInt, Number.isInteger(a.grade) ? a.grade : null).query(`SELECT t.code, t.grade, t.page_url, tt.title,
      (SELECT COUNT(*) FROM luch.lessons l WHERE l.topic_id = t.id) lessons FROM luch.topics t JOIN luch.subjects s ON s.id = t.subject_id
      LEFT JOIN luch.topic_texts tt ON tt.topic_id = t.id AND tt.lang = 'ru' WHERE s.code = @s AND t.status <> 'soon' AND (@g IS NULL OR t.grade = @g) ORDER BY t.grade, t.sort`);
    return { subject: SUBJ[a.subject], topics: r.recordset.map((x) => ({ topic: x.code, title: x.title, grade: x.grade, lessons: x.lessons, lab_url: x.page_url ? SITE + x.page_url : null })) };
  }
  if (name === "search_topics") {
    const q = String(a.query || "").trim().slice(0, 60); if (q.length < 2) return { results: [] };
    const like = "%" + q.replace(/[%_[\]]/g, "") + "%";
    const r = await pool.request().input("q", sql.NVarChar(80), like).query(`SELECT TOP 15 s.code subj, t.code, t.grade, t.page_url, tt.title topic_title, lt.title lesson_title, l.sort
      FROM luch.topics t JOIN luch.subjects s ON s.id = t.subject_id LEFT JOIN luch.topic_texts tt ON tt.topic_id = t.id AND tt.lang = 'ru'
      LEFT JOIN luch.lessons l ON l.topic_id = t.id LEFT JOIN luch.lesson_texts lt ON lt.lesson_id = l.id AND lt.lang = 'ru'
      WHERE t.status <> 'soon' AND (tt.title LIKE @q OR lt.title LIKE @q OR lt.body_json LIKE @q) ORDER BY CASE WHEN tt.title LIKE @q THEN 0 WHEN lt.title LIKE @q THEN 1 ELSE 2 END, s.sort, t.grade`);
    return { results: r.recordset.map((x) => ({ subject: x.subj, topic: x.code, topic_title: x.topic_title, lesson: x.sort, lesson_title: x.lesson_title, grade: x.grade, lab_url: x.page_url ? SITE + x.page_url + (x.sort ? "?l=" + x.sort : "") : null })) };
  }
  if (name === "get_lesson" || name === "get_quiz") {
    const t = await topicRow(pool, a.topic, a.subject);
    if (!t) return { error: "Тема не найдена. Посмотри list_topics или search_topics." };
    const ls = await lessonsOf(pool, t.id);
    const n = Math.max(1, Math.min(ls.length, a.lesson || 1)), l = ls[n - 1];
    if (!l) return { error: "В теме пока нет уроков." };
    const base = `${t.page_url || l.page_url}|${n - 1}|ru`, lab = SITE + (t.page_url || l.page_url) + "?l=" + n;
    if (name === "get_quiz") {
      const qz = await cached(pool, base + "|q");
      if (!qz || !Array.isArray(qz.questions)) return { lesson: l.title, quiz: null, note: "Готовых вопросов нет — составь 4 вопроса сами: главная идея, «что будет, если…», расчёт по формуле, пример из жизни. Задавай по одному.", lab_url: lab };
      return { lesson: l.title, how: "Задавай вопросы по одному, не показывай правильный ответ до ответа ученика, потом объясни.", questions: qz.questions.map((q) => ({ q: q.q, options: q.options, correct_index: q.correct, why: q.why })), lab_url: lab };
    }
    const [story, fx] = await Promise.all([cached(pool, base), cached(pool, base + "|f")]);
    return {
      subject: SUBJ[t.subj], topic: t.code, topic_title: t.title, grade: t.grade,
      lesson: n, lessons_total: ls.length, lesson_title: l.title,
      lessons: ls.map((x) => ({ n: x.sort, title: x.title })),
      explanation: para(l.body_json),
      lecture: story && Array.isArray(story.sections) ? story.sections.map((s) => ({ title: s.title, text: s.text })) : null,
      formulas: fx && Array.isArray(fx.formulas) ? fx.formulas.map((f) => ({ formula: f.f, name: f.name, vars: f.vars })) : null,
      task: l.task || null, hint: l.hint || null,
      lab_url: lab,
      lab_note: "Интерактивный опыт урока: ученик сам ставит опыт (есть 3D «Как в жизни»), выполняет задание; там же голосовой наставник, лекция «Объясни за минуту» и тест.",
      next: n < ls.length ? { lesson: n + 1, title: ls[n].title } : null,
    };
  }
  throw Object.assign(new Error("Неизвестный инструмент: " + name), { code: -32602 });
}

// ---------- протокол ----------
function send(res, code, obj, extra) {
  res.writeHead(code, Object.assign({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*", "Access-Control-Expose-Headers": "Mcp-Session-Id" }, extra || {}));
  res.end(obj === null ? "" : JSON.stringify(obj));
}
async function rpc(msg) {
  const { id, method, params } = msg || {};
  const ok = (result) => ({ jsonrpc: "2.0", id, result }), err = (code, message) => ({ jsonrpc: "2.0", id: id === undefined ? null : id, error: { code, message } });
  if (!msg || msg.jsonrpc !== "2.0" || typeof method !== "string") return err(-32600, "Invalid Request");
  if (id === undefined || id === null) return null; // уведомления (notifications/initialized и т. п.) — без ответа
  try {
    if (method === "initialize") {
      const v = params && PROTOCOLS.includes(params.protocolVersion) ? params.protocolVersion : PROTOCOLS[0];
      return ok({ protocolVersion: v, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "open-school-ai", title: "Open School AI", version: "1.0.0" }, instructions: INSTRUCTIONS });
    }
    if (method === "ping") return ok({});
    if (method === "tools/list") return ok({ tools: TOOLS });
    if (method === "tools/call") {
      const name = params && params.name, args = (params && params.arguments) || {};
      if (!TOOLS.some((t) => t.name === name)) return err(-32602, "Неизвестный инструмент: " + name);
      try {
        const data = await call(name, args);
        return ok({ content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data, isError: !!data.error });
      } catch (e) { console.log("[mcp] " + name + ": " + (e && e.message)); return ok({ content: [{ type: "text", text: "Ошибка: " + (e && e.message) }], isError: true }); }
    }
    if (method === "resources/list") return ok({ resources: [] });
    if (method === "prompts/list") return ok({ prompts: [] });
    return err(-32601, "Method not found: " + method);
  } catch (e) { return err(-32603, (e && e.message) || "Internal error"); }
}

// лимит: 120 запросов в минуту с одного адреса
const hits = new Map();
function allowed(ip) { const now = Date.now(), a = (hits.get(ip) || []).filter((t) => now - t < 60e3); if (a.length >= 120) return false; a.push(now); hits.set(ip, a); if (hits.size > 5000) hits.clear(); return true; }

function handle(req, res, { readBody, clientIp }) {
  if (req.method === "OPTIONS") return send(res, 204, null, { "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version" });
  if (req.method === "GET") return send(res, 405, { error: "Это MCP-сервер Open School AI. Подключите его как коннектор в ChatGPT или Claude: " + SITE + "/mcp. Инструкция: " + SITE + "/connect/" }, { Allow: "POST" });
  if (req.method === "DELETE") return send(res, 405, null, { Allow: "POST" });
  if (req.method !== "POST") return send(res, 405, null);
  if (!allowed(clientIp(req))) return send(res, 429, { jsonrpc: "2.0", id: null, error: { code: -32000, message: "Слишком много запросов" } });
  (async () => {
    let body; try { body = JSON.parse(await readBody(req)); } catch { return send(res, 400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }); }
    if (Array.isArray(body)) { const out = (await Promise.all(body.map(rpc))).filter(Boolean); return out.length ? send(res, 200, out) : send(res, 202, null); }
    const out = await rpc(body);
    return out ? send(res, 200, out) : send(res, 202, null);
  })().catch((e) => { console.log("[mcp] " + (e && e.message)); try { send(res, 500, { jsonrpc: "2.0", id: null, error: { code: -32603, message: "Internal error" } }); } catch { /* */ } });
}

module.exports = { handle };
