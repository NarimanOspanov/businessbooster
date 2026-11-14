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
  "Ты — добрый наставник на сайте Labiq: сложные темы (физика, математика, химия, биология, информатика) объясняются просто — на интерактивных опытах и картинках. С тобой говорят и школьники, и взрослые, которые хотят наконец понять тему. Подстраивайся под собеседника: со школьником — как с учеником, со взрослым — на равных, без школьных интонаций.",
  "Характер: тёплый, терпеливый, спокойный. Говоришь мягко и дружелюбно, радуешься успехам ученика, хвалишь за попытку, никогда не стыдишь и не раздражаешься. Если ученик ошибся — «почти!», «хорошая мысль, давай проверим», а не «неправильно».",
  "Ученик сейчас на странице с интерактивным опытом. Ниже, в блоке «Что сейчас на экране», — точное состояние опыта: урок, задание, числа. Опирайся на эти числа, когда объясняешь, и ссылайся на то, что ученик видит.",
  "Как отвечать:",
  "- Отвечай на языке ученика: по-русски, если он пишет по-русски; по-казахски, если по-казахски.",
  "- Коротко и просто, как хороший живой наставник: 2–6 предложений, без лекций. Если вопрос большой, объясни главное и предложи продолжить.",
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

// язык сайта, выбранный учеником: описание урока приходит по-русски, а отвечать надо на его языке
const LANG_NAMES = { ru: "русский", en: "английский (English)", kk: "казахский (қазақ тілі)", es: "испанский (español)" };
function langRule(l) {
  if (!LANG_NAMES[l] || l === "ru") return "";
  return "\n\nЯзык сайта у ученика — " + LANG_NAMES[l] + ". Отвечай только на этом языке (и текст на доске тоже на нём), даже если описание экрана ниже по-русски. Названия кнопок и частей экрана переводи на этот язык.";
}

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
  if (day.n >= PER_DAY) return "Наставник на сегодня устал. Попробуйте завтра.";
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
async function gemini(model, body, ms = 30000) {
  const key = keyFrom("GEMINI_API_KEY", ".gemini-key");
  if (!key) throw new Error("no_model_key");
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body), signal: AbortSignal.timeout(ms),
  });
  const text = await res.text();
  if (!res.ok) throw new Error("gemini_" + res.status + ": " + text.slice(0, 200));
  return JSON.parse(text);
}
// одинаковые фразы (аудиогид, подсказки наставника) озвучиваем один раз
const ttsCache = new Map();
async function speak(text) {
  const ck = ELEVEN_VOICE + ":" + text;
  if (ttsCache.has(ck)) { const v = ttsCache.get(ck); ttsCache.delete(ck); ttsCache.set(ck, v); return v; }
  const a = await speakRaw(text);
  ttsCache.set(ck, a); if (ttsCache.size > 400) ttsCache.delete(ttsCache.keys().next().value);
  return a;
}
async function speakRaw(text) {
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
      { text: "Это запись вопроса ученика наставнику. Напиши дословно, что он сказал, на языке оригинала (русский или казахский), числа цифрами. Только сам текст, без кавычек и пояснений. Если в записи нет речи, напиши ровно: [тишина]" }] }],
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
    const system = SYSTEM + (b.voice ? "\n\n" + VOICE_RULES : "") + langRule(b.lang) + "\n\nЧто сейчас на экране (страница " + page + "):\n" + (ctx || "нет данных") +
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
  "Ты — добрый наставник. Составь домашнее задание к уроку, который сейчас открыт у ученика (описание урока ниже).",
  "Ровно 3 задачи: 1) лёгкая на понимание, 2) средняя расчётная или на применение, 3) жизненная задача посложнее. Каждая — 1–3 предложения, с конкретными числами, по теме этого урока и уровню класса. Ответ должен быть коротким: число с единицами, слово или выражение.",
  "Ответь только JSON без пояснений: {\"tasks\":[{\"level\":\"легко\",\"q\":\"…\",\"hint\":\"…\",\"answer\":\"…\"},…]}. hint — мягкая подсказка без ответа. answer — правильный ответ (ученику не показывается).",
].join("\n");
const HW_CHECK = [
  "Ты — добрый наставник. Проверь ответ ученика на задачу домашнего задания. Будь тёплым: похвали за верное, мягко покажи ошибку, не давай готовый ответ, если ученик ошибся, — дай подсказку следующего шага.",
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
        const j = jsonOf(await oneShot(HW_CHECK + langRule(b.lang), user));
        return send(200, { ok: !!j.ok, feedback: String(j.feedback || "") });
      }
      const j = jsonOf(await oneShot(HW_MAKE + langRule(b.lang), "Урок:\n" + ctx));
      const tasks = (j.tasks || []).slice(0, 3).map((t) => ({ level: String(t.level || ""), q: String(t.q || ""), hint: String(t.hint || ""), answer: String(t.answer || "") }));
      if (!tasks.length) throw new Error("no tasks");
      send(200, { tasks });
    } catch (e) { console.log("[tutor hw] " + (e && e.message)); send(502, { error: "Не получилось. Попробуйте ещё раз." }); }
  })().catch(() => { try { send(500, { error: "error" }); } catch { /* уже ответили */ } });
}

// ---------- перевод интерфейса страниц «Луча» ----------
// POST /api/luch/i18n { lang: "en"|"kk"|"es", texts: ["русская строка", …] } → { tr: ["перевод", …] }
// Кэш: память процесса + таблица luch.i18n; модель вызывается только для новых строк.
const I18N_LANGS = { en: "English", kk: "Kazakh (Қазақ тілі, Cyrillic script)", es: "Spanish (Español)" };
const I18N_MODEL = process.env.LUCH_I18N_MODEL || process.env.GEMINI_MODEL || "gemini-3.7-flash";
const i18nMem = new Map(); // `${lang}:${hash}` → перевод
const sha1 = (s) => require("crypto").createHash("sha1").update(s).digest("hex");
const i18nHits = new Map();
function i18nAllowed(ip) {
  const now = Date.now(), h = (i18nHits.get(ip) || []).filter((t) => now - t < 3600e3);
  if (h.length >= 1500) return false;
  h.push(now); i18nHits.set(ip, h);
  if (i18nHits.size > 5000) for (const [k, v] of i18nHits) if (!v.some((t) => now - t < 3600e3)) i18nHits.delete(k);
  return true;
}
let dbMod = null;
const db = () => { if (!dbMod) dbMod = require("./db.js"); return dbMod; };
async function i18nFromDb(lang, hashes) {
  const sql = require("mssql"), pool = await db().getPool();
  const r = await pool.request().input("lang", sql.NVarChar(8), lang).input("j", sql.NVarChar(sql.MAX), JSON.stringify(hashes))
    .query("SELECT i.src_hash, i.dst FROM luch.i18n i JOIN OPENJSON(@j) j ON j.value = i.src_hash WHERE i.lang = @lang");
  return r.recordset;
}
async function i18nToDb(lang, rows) {
  const sql = require("mssql"), pool = await db().getPool();
  await pool.request().input("lang", sql.NVarChar(8), lang).input("j", sql.NVarChar(sql.MAX), JSON.stringify(rows)).query(`
    MERGE luch.i18n AS t USING (SELECT * FROM OPENJSON(@j) WITH (h CHAR(40), s NVARCHAR(MAX), d NVARCHAR(MAX))) AS s
      ON t.src_hash = s.h AND t.lang = @lang
    WHEN NOT MATCHED THEN INSERT (src_hash, lang, src, dst) VALUES (s.h, @lang, s.s, s.d);`);
}
async function i18nModel(lang, texts) {
  const system = [
    "You translate the interface and lesson texts of Labiq, an interactive school learning site (physics, maths, chemistry, biology, computer science, grades 5–11), from Russian into " + I18N_LANGS[lang] + ".",
    "Rules: natural, friendly language for school students; keep numbers, units (convert unit abbreviations to the target language's standard ones: Н→N, см→cm, кг→kg, с→s), formulas, chemical formulas, symbols, emoji, punctuation at the edges and leading/trailing spaces exactly as in the source. Keep proper names of Kazakhstan places/companies. The site name is Labiq (also written «Луч» in old texts): always write it as Labiq. If a string is a single letter/variable or has nothing to translate, return it unchanged.",
    "Placeholders like {0}, {1} stand for numbers: keep every placeholder exactly once, unchanged (you may move it if the target grammar needs it).",
    "Input: a JSON array of strings. Output: ONLY a JSON array of the same length with translations in the same order.",
  ].join("\n");
  const user = JSON.stringify(texts);
  let out = "";
  if (keyFrom("GEMINI_API_KEY", ".gemini-key")) {
    const j = await gemini(I18N_MODEL, { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 16000, responseMimeType: "application/json" } }, 90000);
    const c = ((j.candidates || [])[0] || {}).content;
    out = c && c.parts ? c.parts.map((p) => (p.thought ? "" : p.text || "")).join("") : "";
  } else {
    const c = claudeClient(); if (!c) throw new Error("no_model_key");
    const r = await c.messages.create({ model: process.env.LUCH_I18N_CLAUDE || CLAUDE_MODEL, max_tokens: 16000, system, messages: [{ role: "user", content: user }] });
    out = (r.content || []).filter((x) => x.type === "text").map((x) => x.text).join("");
  }
  const a = out.indexOf("["), z = out.lastIndexOf("]");
  const arr = JSON.parse(out.slice(a, z + 1));
  if (!Array.isArray(arr) || arr.length !== texts.length) throw new Error("i18n: length mismatch " + (arr && arr.length) + "/" + texts.length);
  return arr.map((x, i) => (typeof x === "string" && x.trim() ? x : texts[i]));
}
const i18nPending = new Map(); // одна и та же строка, запрошенная разными посетителями одновременно, переводится один раз
async function translate(lang, texts) {
  const res = new Array(texts.length), need = [], hashes = texts.map(sha1);
  texts.forEach((t, i) => { const v = i18nMem.get(lang + ":" + hashes[i]); if (v !== undefined) res[i] = v; });
  let miss = [...new Set(hashes.filter((h, i) => res[i] === undefined))];
  if (miss.length) {
    try { for (const r of await i18nFromDb(lang, miss)) i18nMem.set(lang + ":" + r.src_hash, r.dst); } catch (e) { console.log("[i18n db] " + (e && e.message)); }
    texts.forEach((t, i) => { const v = i18nMem.get(lang + ":" + hashes[i]); if (v !== undefined) res[i] = v; else if (!need.some((n) => n.h === hashes[i])) need.push({ h: hashes[i], s: t }); });
  }
  const parts = [];
  for (let k = 0; k < need.length; k += 30) parts.push(need.slice(k, k + 30));
  const one = async (part) => {
    const key = lang + ":" + part.map((p) => p.h).join(",");
    let p = i18nPending.get(key);
    if (!p) { p = i18nModel(lang, part.map((x) => x.s)); i18nPending.set(key, p); p.finally(() => i18nPending.delete(key)).catch(() => {}); }
    let tr;
    try { tr = await p; } catch (e) { console.log("[i18n] " + (e && e.message)); return; }
    const rows = part.map((x, i) => ({ h: x.h, s: x.s, d: tr[i] }));
    rows.forEach((r) => i18nMem.set(lang + ":" + r.h, r.d));
    i18nToDb(lang, rows).catch((e) => console.log("[i18n db write] " + (e && e.message)));
  };
  for (let k = 0; k < parts.length; k += 4) await Promise.all(parts.slice(k, k + 4).map(one));
  return texts.map((t, i) => (res[i] !== undefined ? res[i] : i18nMem.get(lang + ":" + hashes[i]) ?? t));
}
function handleI18n(req, res, { readBody, clientIp }) {
  const send = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); };
  if (req.method !== "POST") return send(405, { error: "POST" });
  (async () => {
    let b = {};
    try { b = JSON.parse(await readBody(req)) || {}; } catch { return send(400, { error: "bad json" }); }
    const lang = String(b.lang || "");
    if (!I18N_LANGS[lang]) return send(400, { error: "lang" });
    const texts = (Array.isArray(b.texts) ? b.texts : []).slice(0, 200).map((t) => String(t).slice(0, 1500));
    if (!texts.length) return send(200, { tr: [] });
    if (!i18nAllowed(clientIp(req))) return send(429, { error: "too many" });
    try { send(200, { tr: await translate(lang, texts) }); }
    catch (e) { console.log("[i18n] " + (e && e.message)); send(502, { error: "translate failed" }); }
  })().catch(() => { try { send(500, { error: "error" }); } catch { /* уже ответили */ } });
}

module.exports = { handle, handleI18n };
