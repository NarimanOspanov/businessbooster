// Оценка фото объявления глазами редактора: Gemini смотрит снимки квартиры
// и ставит каждому балл за то, насколько он годится для поста — свет,
// порядок и чистота, хлам, ракурс, резкость; планировки, скриншоты и
// документы — мимо. Возвращает общий балл, порядок лучших фото (первое —
// обложка) и признак «не публиковать», если смотреть совсем не на что.
//
// Картинки не правим и не дорисовываем: только выбираем и сортируем.
const fs = require("fs");
const path = require("path");
const os = require("os");

const MODEL = process.env.GEMINI_MODEL || "gemini-3.7-flash";
const FALLBACK = "gemini-flash-latest";
const MAX_PHOTOS = 10;

function key() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  try { return fs.readFileSync(path.join(os.homedir(), ".gemini-key"), "utf8").trim() || null; } catch { return null; }
}
function available() { return !!key(); }

const PROMPT = `Ты фоторедактор Instagram-аккаунта с квартирами на продажу. Тебе дают фото одной квартиры из объявления (на фото может быть водяной знак сайта — его не учитывай).
Оцени каждое фото от 0 до 10: насколько оно годится для красивого поста о продаже.
Выше: светло, чисто и прибрано, видно пространство, ровный ракурс, резко, приятный интерьер или вид из окна.
Ниже: темно, смазано, хлам и мусор, беспорядок, крупно угол или стена, криво.
Ставь 0–2, если это не фото квартиры: планировка, скриншот, документ, фото людей, случайный предмет.
Черновая отделка в новостройке — не повод для низкой оценки, если фото светлое и аккуратное.
Верни JSON: photos — массив {i, score, note} для каждого фото по номеру i (с 0), note — 2–5 слов по-русски;
best — номера фото от лучшего к худшему, только с оценкой 5 и выше (первое станет обложкой);
overall — общая оценка подборки для поста 0–10 (как бы выглядела карусель из лучших фото);
reject — true, если постить эту квартиру не стоит: хороших фото меньше трёх или квартира выглядит неопрятно;
reason — одна фраза по-русски, почему такая общая оценка.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    photos: { type: "ARRAY", items: { type: "OBJECT", properties: { i: { type: "INTEGER" }, score: { type: "NUMBER" }, note: { type: "STRING" } }, required: ["i", "score"] } },
    best: { type: "ARRAY", items: { type: "INTEGER" } },
    overall: { type: "NUMBER" },
    reject: { type: "BOOLEAN" },
    reason: { type: "STRING" },
  },
  required: ["photos", "best", "overall", "reject", "reason"],
};

async function fetchImage(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) return null;
    const b = Buffer.from(await r.arrayBuffer());
    return b.length > 2000 && b[0] === 0xff && b[1] === 0xd8 ? b : null;
  } catch { return null; }
}

async function ask(parts, model) {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
    method: "POST",
    headers: { "x-goog-api-key": key(), "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: PROMPT }] },
      contents: [{ role: "user", parts: parts }],
      generationConfig: { temperature: 0, maxOutputTokens: 3000, thinkingConfig: { thinkingBudget: 0 }, responseMimeType: "application/json", responseSchema: SCHEMA },
    }),
    signal: AbortSignal.timeout(90000),
  });
  const text = await res.text();
  if (res.status === 404 && model !== FALLBACK) return ask(parts, FALLBACK);
  if (!res.ok) throw new Error("gemini_" + res.status + ": " + text.slice(0, 200));
  const j = JSON.parse(text);
  const cand = (j.candidates || [])[0] || {};
  const out = ((cand.content || {}).parts || []).map((x) => x.text || "").join("");
  return JSON.parse(out);
}

// urls — ссылки на фото (полные); смотрим уменьшенные 560x350: для оценки
// хватает, а токенов в разы меньше. Возвращает { overall, reject, reason,
// order: индексы исходного массива от лучшего, photos: [{i, score, note}] }.
async function scorePhotos(urls) {
  if (!available()) throw new Error("нет ключа Gemini");
  const list = (urls || []).slice(0, MAX_PHOTOS);
  const small = list.map((u) => String(u).replace(/-full\.jpg$/, "-560x350.jpg"));
  const imgs = await Promise.all(small.map(fetchImage));
  const idx = [];
  const parts = [];
  imgs.forEach((b, k) => {
    if (!b) return;
    parts.push({ text: "Фото " + idx.length + ":" });
    parts.push({ inline_data: { mime_type: "image/jpeg", data: b.toString("base64") } });
    idx.push(k);
  });
  if (!idx.length) return { overall: 0, reject: true, reason: "фото не загрузились", order: [], photos: [] };
  const r = await ask(parts, MODEL);
  const map = (i) => (Number.isInteger(i) && i >= 0 && i < idx.length ? idx[i] : null);
  const order = [...new Set((r.best || []).map(map).filter((x) => x != null))];
  return {
    overall: Math.max(0, Math.min(10, Number(r.overall) || 0)),
    reject: !!r.reject,
    reason: String(r.reason || "").slice(0, 200),
    order: order,
    photos: (r.photos || []).map((p) => ({ i: map(p.i), score: Number(p.score) || 0, note: String(p.note || "").slice(0, 60) })).filter((p) => p.i != null),
  };
}

module.exports = { scorePhotos, available };
