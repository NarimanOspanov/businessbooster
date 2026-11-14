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
  "Ты — добрый репетитор на сайте интерактивных опытов «Луч»: физика, математика, химия, биология, информатика. С тобой говорят школьники 5–11 классов и их родители.",
  "Характер: тёплый, терпеливый, спокойный. Говоришь мягко и дружелюбно, радуешься успехам ученика, хвалишь за попытку, никогда не стыдишь и не раздражаешься. Если ученик ошибся — «почти!», «хорошая мысль, давай проверим», а не «неправильно».",
  "Ученик сейчас на странице с интерактивным опытом. Ниже, в блоке «Что сейчас на экране», — точное состояние опыта: урок, задание, числа. Опирайся на эти числа, когда объясняешь, и ссылайся на то, что ученик видит.",
  "Как отвечать:",
  "- Отвечай на языке ученика: по-русски, если он пишет по-русски; по-казахски, если по-казахски.",
  "- Коротко и просто, как хороший живой репетитор: 2–6 предложений, без лекций. Если вопрос большой, объясни главное и предложи продолжить.",
  "- Объясняй через то, что видно в опыте, и через примеры из жизни.",
  "- Если ученик просит решить задание урока, не давай сразу готовый ответ: подскажи следующий шаг или задай наводящий вопрос. Если он застрял после двух подсказок, покажи решение и объясни его.",
  "- Формулы пиши обычным текстом: 1/F = 1/d + 1/f, M = F · l. Без LaTeX, без таблиц. Можно **жирный** и короткие списки через дефис.",
  "- Если ученик ошибается, мягко покажи, где ошибка, и почему.",
  "- Можно отвечать и на другие школьные вопросы. На темы не про учёбу отвечай одной фразой и возвращай к опыту.",
  "- Не выдумывай: если не уверен, так и скажи.",
  "",
  "Указка (подсветка на странице):",
  "- В блоке «Элементы страницы» перечислены части экрана с номерами [n]. Когда говоришь про какую-то часть, поставь сразу после её упоминания метку [[n]] — она подсветится у ученика на экране. Например: «Посмотри на задание [[2]] — там нужно…». Метка не заменяет слова: ученик её не видит, поэтому всегда называй часть словами («кнопка «+ груз» [[18]]»). 1–3 метки на ответ, только номера из списка.",
  "",
  "Доска:",
  "- Если объяснение понятнее с картинкой (схема, график, чертёж, разбор задачи по шагам, формула с пояснениями), нарисуй на доске, как учитель мелом. Вставь в ответ блок <board>…</board> с SVG-элементами внутри (без тега <svg>). Холст 480×300, начало координат слева сверху.",
  "- Разрешены: line, path, circle, ellipse, rect, polyline, polygon, text, g. Цвета мела: #f4f1e8 (белый, основной), #ffd166 (жёлтый, главное), #7fd4ff (голубой), #ff8fa3 (розовый, важное), #9be89b (зелёный). Линии stroke-width 2–3, fill=\"none\" (кроме точек). Текст: font-size 16–24, fill цветом мела. Стрелка на конце линии: marker-end=\"url(#arr)\".",
  "- Рисуй по порядку объяснения: элементы появляются на доске один за другим. Не больше 30 элементов, подписи короткие. Блок доски ставь после первой фразы ответа; текст вне блока — это то, что ты говоришь.",
  "- Не рисуй, если вопрос простой и картинка не добавляет понимания.",
  "",
  "Если ученик прислал рисунок со своей доски — посмотри на него внимательно, скажи, что на нём верно, и мягко поправь ошибки.",
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
  // рисунок ученика (m.image = { mime, data }) уходит картинкой перед текстом вопроса
  const msgs = messages.map((m) => m.image
    ? { role: m.role, content: [{ type: "image", source: { type: "base64", media_type: m.image.mime, data: m.image.data } }, { type: "text", text: m.content }] }
    : { role: m.role, content: m.content });
  const stream = client.messages.stream({ model: CLAUDE_MODEL, max_tokens: 4000, system, messages: msgs }, { signal });
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
      contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user",
        parts: m.image ? [{ inlineData: { mimeType: m.image.mime, data: m.image.data } }, { text: m.content }] : [{ text: m.content }] })),
      generationConfig: { maxOutputTokens: 8192, temperature: 0.6 },
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

// ---------- голос: озвучка ответа и расшифровка речи (Gemini) ----------
const TTS_MODEL = process.env.TUTOR_TTS_MODEL || process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-tts";
const STT_MODEL = process.env.TUTOR_STT_MODEL || "gemini-flash-lite-latest";
// ElevenLabs читает текст точно и быстрее (~1 с); у Gemini TTS бывают сбои, когда
// вместо текста звучит посторонняя речь. Gemini — запасной вариант и для казахского.
const ELEVEN_VOICE = process.env.TUTOR_ELEVEN_VOICE || "XrExE9yKIg1WjnnlVkGX"; // Matilda: тёплый, мягкий
const ELEVEN_MODEL = process.env.TUTOR_ELEVEN_MODEL || "eleven_flash_v2_5";
const VOICE = process.env.TUTOR_VOICE || "Sulafat"; // Gemini: тёплый голос
const VOICE_RULES = [
  "Сейчас разговор голосом: твой ответ сразу озвучивается, а вопрос ученика расшифрован из речи (в нём могут быть ошибки распознавания — угадывай смысл).",
  "Говори как добрый живой человек в разговоре: мягко, тепло, 1–4 коротких предложения, без списков, без звёздочек и другого оформления. Доску и метки [[n]] использовать можно — их не озвучивают.",
  "Формулы и знаки произноси словами: «один делить на F», «F умножить на l», «сантиметров», «ньютонов».",
  "Заканчивай вопросом или короткой подсказкой, чтобы разговор продолжался.",
].join("\n");
const voiceHits = new Map();
function voiceAllowed(ip) {
  const now = Date.now(), h = (voiceHits.get(ip) || []).filter((t) => now - t < 3600e3);
  if (h.length >= 400) return false;
  h.push(now); voiceHits.set(ip, h);
  if (voiceHits.size > 5000) for (const [k, v] of voiceHits) if (!v.some((t) => now - t < 3600e3)) voiceHits.delete(k);
  return true;
}
async function gemini(model, body) {
  const key = keyFrom("GEMINI_API_KEY", ".gemini-key");
  if (!key) throw new Error("no_model_key");
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error("gemini_" + res.status + ": " + text.slice(0, 200));
  return JSON.parse(text);
}
async function speak(text) {
  const key = keyFrom("ELEVENLABS_API_KEY", ".elevenlabs-key");
  if (key && !/[әғқңөұүһі]/i.test(text)) {
    try {
      const r = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + ELEVEN_VOICE + "?output_format=mp3_44100_64", {
        method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ text, model_id: ELEVEN_MODEL, voice_settings: { stability: 0.62, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: 0.94 } }),
        signal: AbortSignal.timeout(20000),
      });
      if (r.ok) return { type: "audio/mpeg", buf: Buffer.from(await r.arrayBuffer()) };
      console.log("[tutor tts] ElevenLabs " + r.status + " " + (await r.text()).slice(0, 120));
    } catch (e) { console.log("[tutor tts] ElevenLabs " + (e && e.message)); }
  }
  return { type: "audio/wav", buf: await tts(text) };
}
// Gemini отдаёт то готовый WAV (бывает WAV внутри WAV), то сырой PCM — приводим к WAV.
async function tts(text) {
  const j = await gemini(TTS_MODEL, {
    contents: [{ parts: [{ text }] }],
    generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } },
  });
  const part = ((((j.candidates || [])[0] || {}).content || {}).parts || []).find((p) => p.inlineData);
  if (!part) throw new Error("tts: нет звука в ответе");
  let b = Buffer.from(part.inlineData.data, "base64");
  const inner = b.indexOf("RIFF", 4);
  if (b.slice(0, 4).toString() === "RIFF" && inner > 0 && inner < 100) b = b.slice(inner);
  if (b.slice(0, 4).toString() === "RIFF") return b;
  const rate = Number((String(part.inlineData.mimeType).match(/rate=(\d+)/) || [])[1]) || 24000;
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + b.length, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(b.length, 40);
  return Buffer.concat([h, b]);
}
async function stt(b64, mime) {
  const key = keyFrom("ELEVENLABS_API_KEY", ".elevenlabs-key");
  if (key) {
    try {
      const fd = new FormData();
      fd.append("model_id", process.env.TUTOR_SCRIBE_MODEL || "scribe_v1");
      fd.append("file", new Blob([Buffer.from(b64, "base64")], { type: mime }), mime === "audio/wav" ? "q.wav" : "q.audio");
      const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": key }, body: fd, signal: AbortSignal.timeout(20000) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) return String(j.text || "").replace(/\((?:[^)]*)\)|\[(?:[^\]]*)\]/g, " ").replace(/\s+/g, " ").trim();
      console.log("[tutor stt] ElevenLabs " + r.status);
    } catch (e) { console.log("[tutor stt] ElevenLabs " + (e && e.message)); }
  }
  const j = await gemini(STT_MODEL, {
    contents: [{ parts: [{ inlineData: { mimeType: mime, data: b64 } },
      { text: "Это запись вопроса школьника репетитору по физике. Напиши дословно, что он сказал, на языке оригинала (русский или казахский), числа цифрами. Только сам текст, без кавычек и пояснений. Если в записи нет речи, напиши ровно: [тишина]" }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 1000 },
  });
  const c = ((j.candidates || [])[0] || {}).content;
  const t = (c && c.parts ? c.parts.map((p) => (p.thought ? "" : p.text || "")).join("") : "").trim();
  return /^\[?тишина\]?$/i.test(t) ? "" : t;
}

function handle(req, res, deps) {
  const p = (req.url || "").split("?")[0];
  if (p === "/api/tutor/tts") return handleTts(req, res, deps);
  if (p === "/api/tutor/stt") return handleStt(req, res, deps);
  if (p === "/api/tutor/hw") return handleHw(req, res, deps);
  return handleChat(req, res, deps);
}
function handleTts(req, res, { readBody, clientIp }) {
  const fail = (code, msg) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify({ ok: false, error: msg })); };
  if (req.method !== "POST") return fail(405, "POST");
  (async () => {
    let b = {};
    try { b = JSON.parse(await readBody(req)) || {}; } catch { return fail(400, "bad json"); }
    const text = String(b.text || "").replace(/[*_`#]/g, "").trim().slice(0, 700);
    if (!text) return fail(400, "нужен текст");
    if (!voiceAllowed(clientIp(req))) return fail(429, "слишком много запросов");
    try {
      const a = await speak(text);
      res.writeHead(200, { "Content-Type": a.type, "Cache-Control": "no-store", "Content-Length": a.buf.length });
      res.end(a.buf);
    } catch (e) { console.log("[tutor tts] " + (e && e.message)); fail(502, "озвучка не получилась"); }
  })().catch(() => { try { fail(500, "error"); } catch { /* уже ответили */ } });
}
function handleStt(req, res, { readBody, clientIp }) {
  const send = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); };
  if (req.method !== "POST") return send(405, { ok: false, error: "POST" });
  (async () => {
    let b = {};
    try { b = JSON.parse(await readBody(req)) || {}; } catch { return send(400, { ok: false, error: "запись слишком длинная" }); }
    const audio = String(b.audio || ""), mime = /^audio\/[a-z0-9.+-]+$/.test(b.mime || "") ? b.mime : "audio/wav";
    if (!audio || audio.length > 990000) return send(400, { ok: false, error: "нет записи" });
    if (!voiceAllowed(clientIp(req))) return send(429, { ok: false, error: "слишком много запросов" });
    try { send(200, { ok: true, text: await stt(audio, mime) }); }
    catch (e) { console.log("[tutor stt] " + (e && e.message)); send(502, { ok: false, error: "не получилось распознать речь" }); }
  })().catch(() => { try { send(500, { ok: false, error: "error" }); } catch { /* уже ответили */ } });
}

function handleChat(req, res, { readBody, clientIp }) {
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
    const els = String(b.elements || "").slice(0, 3000);
    const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(b.image || ""));
    if (m && m[2].length < 900000) messages[messages.length - 1].image = { mime: m[1], data: m[2] };
    const system = SYSTEM + (b.voice ? "\n\n" + VOICE_RULES : "") + "\n\nЧто сейчас на экране (страница " + page + "):\n" + (ctx || "нет данных") +
      (els ? "\n\nЭлементы страницы (для меток [[n]]):\n" + els : "");

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

// ---------- домашнее задание к уроку ----------
// { mode: "make", context } → { tasks: [{ level, q, hint }] }
// { mode: "check", context, task, answer } → { ok, feedback }
const HW_MAKE = [
  "Ты — добрый школьный учитель. Составь домашнее задание к уроку, который сейчас открыт у ученика (описание урока ниже).",
  "Ровно 3 задачи: 1) лёгкая на понимание, 2) средняя расчётная или на применение, 3) жизненная задача посложнее. Каждая — 1–3 предложения, с конкретными числами, по теме этого урока и уровню класса. Ответ должен быть коротким: число с единицами, слово или выражение.",
  "Ответь только JSON без пояснений: {\"tasks\":[{\"level\":\"легко\",\"q\":\"…\",\"hint\":\"…\",\"answer\":\"…\"},…]}. hint — мягкая подсказка без ответа. answer — правильный ответ (ученику не показывается).",
].join("\n");
const HW_CHECK = [
  "Ты — добрый школьный учитель. Проверь ответ ученика на задачу домашнего задания. Будь тёплым: похвали за верное, мягко покажи ошибку, не давай готовый ответ, если ученик ошибся, — дай подсказку следующего шага.",
  "Ответь только JSON: {\"ok\":true|false,\"feedback\":\"1–3 предложения ученику\"}. ok=true, если ответ верный по смыслу (допусти округление и другую запись единиц).",
].join("\n");
async function oneShot(system, user) {
  const c = claudeClient();
  if (c) {
    const r = await c.messages.create({ model: CLAUDE_MODEL, max_tokens: 1500, system, messages: [{ role: "user", content: user }] });
    return (r.content || []).filter((x) => x.type === "text").map((x) => x.text).join("");
  }
  const j = await gemini(GEMINI_MODEL, { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: { maxOutputTokens: 1500, temperature: 0.5, responseMimeType: "application/json" } });
  const cc = ((j.candidates || [])[0] || {}).content;
  return cc && cc.parts ? cc.parts.map((p) => (p.thought ? "" : p.text || "")).join("") : "";
}
const jsonOf = (t) => { const a = t.indexOf("{"), z = t.lastIndexOf("}"); return JSON.parse(t.slice(a, z + 1)); };
function handleHw(req, res, { readBody, clientIp }) {
  const send = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); };
  if (req.method !== "POST") return send(405, { ok: false, error: "POST" });
  (async () => {
    let b = {};
    try { b = JSON.parse(await readBody(req)) || {}; } catch { return send(400, { error: "bad json" }); }
    const block = allowed(clientIp(req));
    if (block) return send(429, { error: block });
    const ctx = String(b.context || "").slice(0, MAX_CTX);
    try {
      if (b.mode === "check") {
        const task = b.task || {};
        const user = "Урок:\n" + ctx + "\n\nЗадача: " + String(task.q || "").slice(0, 800) + "\nПравильный ответ (для тебя): " + String(task.answer || "").slice(0, 200) +
          "\nОтвет ученика: " + String(b.answer || "").slice(0, 500);
        const j = jsonOf(await oneShot(HW_CHECK, user));
        return send(200, { ok: !!j.ok, feedback: String(j.feedback || "") });
      }
      const j = jsonOf(await oneShot(HW_MAKE, "Урок:\n" + ctx));
      const tasks = (j.tasks || []).slice(0, 3).map((t) => ({ level: String(t.level || ""), q: String(t.q || ""), hint: String(t.hint || ""), answer: String(t.answer || "") }));
      if (!tasks.length) throw new Error("no tasks");
      send(200, { tasks });
    } catch (e) { console.log("[tutor hw] " + (e && e.message)); send(502, { error: "Не получилось. Попробуйте ещё раз." }); }
  })().catch(() => { try { send(500, { error: "error" }); } catch { /* уже ответили */ } });
}

module.exports = { handle };
