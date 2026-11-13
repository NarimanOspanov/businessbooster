// ИИ-репетитор для опытов «Луч» (/physics, /optics, /mechanics).
// POST /api/tutor { page, context, messages: [{ role: "user"|"assistant", content }] }
// Отвечает обычным текстом по кусочкам, пока модель пишет ответ.
// Модель: Claude, если на сервере есть ANTHROPIC_API_KEY, иначе Gemini.
const fs = require("fs");
const os = require("os");
const path = require("path");

const CLAUDE_MODEL = process.env.TUTOR_MODEL || "claude-opus-5-5";
const GEMINI_MODEL = process.env.TUTOR_GEMINI_MODEL || process.env.GEMINI_MODEL || "gemini-3.7-flash";
const PER_HOUR = Number(process.env.TUTOR_PER_HOUR) || 40;   // вопросов в час с одного адреса
const PER_DAY = Number(process.env.TUTOR_PER_DAY) || 3000;   // вопросов в сутки на всех
const MAX_MSG = 2000, MAX_CTX = 4000, MAX_TURNS = 24;

const SYSTEM = [
  "Ты — репетитор по физике на сайте интерактивных опытов «Луч». С тобой говорят школьники 7–11 классов и их родители.",
  "Ученик сейчас на странице с 3D-опытом. Ниже, в блоке «Что сейчас на экране», — точное состояние опыта: урок, задание, положения деталей, числа. Опирайся на эти числа, когда объясняешь, и ссылайся на то, что ученик видит.",
  "Как отвечать:",
  "- Отвечай на языке ученика: по-русски, если он пишет по-русски; по-казахски, если по-казахски.",
  "- Коротко и просто, как хороший живой репетитор: 2–6 предложений, без лекций. Если вопрос большой, объясни главное и предложи продолжить.",
  "- Объясняй через то, что видно в опыте, и через примеры из жизни.",
  "- Если ученик просит решить задание урока, не давай сразу готовый ответ: подскажи следующий шаг или задай наводящий вопрос. Если он застрял после двух подсказок, покажи решение и объясни его.",
  "- Формулы пиши обычным текстом: 1/F = 1/d + 1/f, M = F · l. Без LaTeX, без таблиц. Можно **жирный** и короткие списки через дефис.",
  "- Если ученик ошибается, мягко покажи, где ошибка, и почему.",
  "- Можно отвечать и на другие школьные вопросы по физике и математике. На темы не про учёбу отвечай одной фразой и возвращай к опыту.",
  "- Не выдумывай: если не уверен, так и скажи.",
].join("\n");

function keyFrom(envName, fileName) {
  if (process.env[envName]) return process.env[envName].trim();
  try { return fs.readFileSync(path.join(os.homedir(), fileName), "utf8").trim() || null; } catch { return null; }
}

let claude = null;
function claudeClient() {
  const key = keyFrom("ANTHROPIC_API_KEY", ".anthropic-key");
  if (!key) return null;
  if (!claude) {
    const mod = require("@anthropic-ai/sdk");
    const Anthropic = mod.Anthropic || mod.default || mod;
    claude = new Anthropic({ apiKey: key });
  }
  return claude;
}

const hits = new Map();
let day = { d: "", n: 0 };
function allowed(ip) {
  const now = Date.now(), d = new Date().toISOString().slice(0, 10);
  if (day.d !== d) day = { d, n: 0 };
  if (day.n >= PER_DAY) return "Репетитор на сегодня устал. Попробуйте завтра.";
  const h = (hits.get(ip) || []).filter((t) => now - t < 3600e3);
  if (h.length >= PER_HOUR) return "Слишком много вопросов за час. Сделайте паузу и попробуйте позже.";
  h.push(now); hits.set(ip, h); day.n++;
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < 3600e3)) hits.delete(k);
  return null;
}

function cleanMessages(list) {
  const out = [];
  for (const m of Array.isArray(list) ? list.slice(-MAX_TURNS) : []) {
    const role = m && m.role === "assistant" ? "assistant" : "user";
    const content = String((m && m.content) || "").slice(0, MAX_MSG).trim();
    if (!content) continue;
    if (out.length && out[out.length - 1].role === role) out[out.length - 1].content += "\n\n" + content;
    else out.push({ role, content });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out.length && out[out.length - 1].role === "user" ? out : null;
}

async function streamClaude(client, system, messages, write, signal) {
  const stream = client.messages.stream({ model: CLAUDE_MODEL, max_tokens: 4000, system, messages }, { signal });
  for await (const ev of stream) {
    if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") write(ev.delta.text);
  }
}

async function streamGemini(system, messages, write, signal) {
  const key = keyFrom("GEMINI_API_KEY", ".gemini-key");
  if (!key) throw new Error("no_model_key");
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(GEMINI_MODEL) + ":streamGenerateContent?alt=sse", {
    method: "POST", signal,
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      generationConfig: { maxOutputTokens: 2000, temperature: 0.6 },
    }),
  });
  if (!res.ok) throw new Error("gemini_" + res.status + ": " + (await res.text()).slice(0, 200));
  const dec = new TextDecoder();
  let buf = "";
  for await (const chunk of res.body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      try {
        const j = JSON.parse(line.slice(5));
        const parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
        for (const p of parts) if (p.text && !p.thought) write(p.text);
      } catch { /* неполная строка */ }
    }
  }
}

function handle(req, res, { readBody, clientIp }) {
  const fail = (code, msg) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify({ ok: false, error: msg })); };
  if (req.method !== "POST") return fail(405, "POST");
  (async () => {
    let b = {};
    try { b = JSON.parse(await readBody(req)) || {}; } catch { return fail(400, "bad json"); }
    const messages = cleanMessages(b.messages);
    if (!messages) return fail(400, "нужен вопрос");
    const block = allowed(clientIp(req));
    if (block) return fail(429, block);
    const page = String(b.page || "").slice(0, 80);
    const ctx = String(b.context || "").slice(0, MAX_CTX);
    const system = SYSTEM + "\n\nЧто сейчас на экране (страница " + page + "):\n" + (ctx || "нет данных");

    const ac = new AbortController();
    res.on("close", () => { if (!res.writableEnded) ac.abort(); });
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" });
    const write = (t) => { if (!res.writableEnded) res.write(t); };
    try {
      const c = claudeClient();
      if (c) await streamClaude(c, system, messages, write, ac.signal);
      else await streamGemini(system, messages, write, ac.signal);
    } catch (e) {
      if (!ac.signal.aborted) {
        console.log("[tutor] " + (e && e.message ? e.message : e));
        write("\n\nНе получилось ответить. Попробуйте спросить ещё раз.");
      }
    }
    if (!res.writableEnded) res.end();
  })().catch(() => { try { fail(500, "error"); } catch { /* уже ответили */ } });
}

module.exports = { handle };
