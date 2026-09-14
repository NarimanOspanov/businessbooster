// Похожи ли фотографии двух объявлений — та же квартира или нет.
//
// Площадь, этаж, ЖК находят кандидата, но не отличают ту же самую квартиру,
// перевыложенную агентом повторно, от соседней такой же планировки в том же
// доме — у обеих эти параметры совпадут один в один. Фотография — то, что
// при этом остаётся разным (или явно совпадает, если снимки те же).

const fs = require("fs");
const path = require("path");
const os = require("os");

function keyFrom(envName, fileName) {
  if (process.env[envName]) return process.env[envName].trim();
  try {
    return fs.readFileSync(path.join(os.homedir(), fileName), "utf8").trim() || null;
  } catch {
    return null;
  }
}

function geminiKey() { return keyFrom("GEMINI_API_KEY", ".gemini-key"); }
function available() { return !!geminiKey(); }

// Закреплённая версия однажды закрывается для новых аккаунтов (см. enrich.js) —
// на 404 переходим на плавающий алиас.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.7-flash";
const FALLBACK = "gemini-flash-latest";

async function callGemini(body, model) {
  const key = geminiKey();
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(model || MODEL) + ":generateContent",
    {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    }
  );
  const text = await res.text();
  if (res.status === 404 && model !== FALLBACK) return callGemini(body, FALLBACK);
  if (!res.ok) throw new Error("model_" + res.status + ": " + text.slice(0, 200));
  return JSON.parse(text);
}

// Снимок в base64: Gemini принимает фотографии только как inlineData, не как
// произвольный внешний URL.
async function toInlinePart(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error("photo_" + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  return { inlineData: { mimeType: "image/jpeg", data: buf.toString("base64") } };
}

const SYSTEM = `Ты сравниваешь фотографии из объявлений о продаже квартир на Крыше.
Сначала идут снимки «Объявление А» — квартира, которую ищут. Дальше —
кандидаты под номерами («Кандидат 1», «Кандидат 2», ...), у каждого свои
снимки. Определи, у какого из кандидатов на фото та же самая квартира, а не
просто похожая: сравнивай узнаваемые детали — кухонный гарнитур, обои, вид
из окна, расстановку мебели, напольное покрытие. Одну и ту же квартиру могли
переснять другим человеком под другим углом или при другом освещении — это
не мешает при совпадении деталей. Разный ремонт или другая планировка при
формально совпадающих метраже и этаже — это разные квартиры, а не кандидат,
даже если что-то одно на фото похоже.
Если у кандидата фотографий не хватает, чтобы сделать вывод (например, всего
один непоказательный снимок), не выдумывай — верни match:false с низким
confidence и честно объясни в why.
Ответь только JSON-массивом без пояснений вне него, по одному объекту на
каждого кандидата в том порядке, в котором они даны:
[{"candidate": "1", "match": true|false, "confidence": 0..1, "why": "коротко, по-русски"}]`;

// queryPhotos: [url, ...] — фото объявления А (то, что ищем).
// candidates: [{id, photos: [url, ...]}, ...] — фото каждого кандидата.
// Возвращает { [candidateId]: {match, confidence, why} } — кандидаты без
// фото (своих или объявления А) в ответ не попадают, не всех есть чем
// проверить.
async function scoreCandidates(queryPhotos, candidates) {
  if (!available()) throw new Error("no_gemini_key");
  const qImgs = (queryPhotos || []).slice(0, 4);
  const withPhotos = (candidates || []).filter((c) => c.photos && c.photos.length);
  if (!qImgs.length || !withPhotos.length) return {};

  const parts = [{ text: "Объявление А:" }];
  for (const u of qImgs) {
    try { parts.push(await toInlinePart(u)); } catch { /* один снимок не критичен */ }
  }
  const order = [];
  for (let i = 0; i < withPhotos.length; i++) {
    const cnd = withPhotos[i];
    const before = parts.length;
    parts.push({ text: "Кандидат " + (order.length + 1) + " (id " + cnd.id + "):" });
    for (const u of cnd.photos.slice(0, 3)) {
      try { parts.push(await toInlinePart(u)); } catch { /* один снимок не критичен */ }
    }
    // Ни одно фото кандидата не загрузилось — сравнивать нечего, убираем и
    // подпись, иначе модель увидит заголовок без снимков и запутается в счёте.
    if (parts.length === before + 1) { parts.pop(); continue; }
    order.push(cnd.id);
  }
  if (!order.length) return {};

  const body = {
    system_instruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 2000,
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: "application/json",
    },
  };
  const j = await callGemini(body);
  const cand = (j.candidates || [])[0] || {};
  if (cand.finishReason === "MAX_TOKENS") throw new Error("model_answer_cut_off");
  const text = ((cand.content || {}).parts || []).map((p) => p.text || "").join("");
  let arr;
  try { arr = JSON.parse(text); }
  catch {
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) throw new Error("model_gave_no_json");
    arr = JSON.parse(m[0]);
  }

  const out = {};
  for (const row of arr) {
    const idx = Number(row.candidate) - 1;
    const id = order[idx];
    if (id == null) continue;
    out[id] = {
      match: !!row.match,
      confidence: Number(row.confidence) || 0,
      why: String(row.why || "").slice(0, 300),
    };
  }
  return out;
}

module.exports = { available, scoreCandidates };
