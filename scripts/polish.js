// Полировка фото перед постом. Промпт настраивается (dbo.app_config,
// insta.polish.prompt), но Gemini по нему только подбирает числа — яркость,
// контраст, насыщенность, «теплоту», резкость, шумоподавление, — а применяем
// мы их сами SVG-фильтрами при отрисовке. Перерисовать кадр, убрать предметы
// или водяной знак так нельзя: модель картинку не возвращает.
const fs = require("fs");
const path = require("path");
const os = require("os");

const MODEL = process.env.GEMINI_MODEL || "gemini-3.7-flash";
const FALLBACK = "gemini-flash-latest";

const DEFAULT_PROMPT = "Сделай фото светлее и чище, как у профессионального фотографа недвижимости: ровный свет, естественные цвета, лёгкая резкость, без цифрового шума. Не пересвечивай окна и не делай цвета кислотными.";

// Рамки, за которые не выйдет никакой промпт: дальше фото начинает врать.
const LIMITS = {
  brightness: [-0.15, 0.25], // сдвиг яркости (0 — как есть)
  contrast: [0.85, 1.3],     // множитель контраста (1 — как есть)
  saturation: [0.85, 1.3],   // множитель насыщенности
  warmth: [-0.4, 0.4],       // теплее/холоднее
  sharpen: [0, 1],           // резкость
  denoise: [0, 1],           // шумоподавление
};
const NEUTRAL = { brightness: 0, contrast: 1, saturation: 1, warmth: 0, sharpen: 0, denoise: 0 };

function key() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  try { return fs.readFileSync(path.join(os.homedir(), ".gemini-key"), "utf8").trim() || null; } catch { return null; }
}

// Инструкция модели по умолчанию; в работе — из настроек (insta.polish.system).
const DEFAULT_SYSTEM = `Ты настраиваешь цветокоррекцию фото квартир для Instagram. Тебе дают фото и пожелания редактора.
Ты НЕ рисуешь и не меняешь содержимое кадра — только выбираешь числовые настройки для каждого фото:
brightness от ${LIMITS.brightness[0]} до ${LIMITS.brightness[1]} (0 — без изменений),
contrast от ${LIMITS.contrast[0]} до ${LIMITS.contrast[1]} (1 — без изменений),
saturation от ${LIMITS.saturation[0]} до ${LIMITS.saturation[1]} (1 — без изменений),
warmth от ${LIMITS.warmth[0]} до ${LIMITS.warmth[1]} (0 — без изменений, плюс — теплее),
sharpen от 0 до 1, denoise от 0 до 1.
Если фото уже хорошее — оставь значения близкими к нейтральным. Тёмное — подними яркость; серое и плоское — контраст; мутное — резкость; зернистое — шумоподавление.`;
// Формат ответа добавляем всегда, к любой инструкции из настроек: без него
// разбор ответа ломается. Рамки значений всё равно режем в clamp().
// Числа — целыми в сотых: с дробями модель иногда пишет 0.2244444… до обрыва
// ответа, и он не разбирается.
const FORMAT = `
Ответ дай ЦЕЛЫМИ числами в сотых долях: brightness 12 означает 0.12, contrast 108 означает 1.08, saturation 105 — 1.05, warmth -20 — -0.20, sharpen 30 — 0.30, denoise 10 — 0.10.
Верни JSON: photos — массив {i, brightness, contrast, saturation, warmth, sharpen, denoise} по номеру фото i (с 0).`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    photos: { type: "ARRAY", items: { type: "OBJECT", properties: {
      i: { type: "INTEGER" }, brightness: { type: "INTEGER" }, contrast: { type: "INTEGER" }, saturation: { type: "INTEGER" },
      warmth: { type: "INTEGER" }, sharpen: { type: "INTEGER" }, denoise: { type: "INTEGER" },
    }, required: ["i"] } },
  },
  required: ["photos"],
};

function clamp(p) {
  const out = {};
  for (const k of Object.keys(NEUTRAL)) {
    let v = Number(p && p[k]);
    // Пришло в сотых (108 вместо 1.08, 12 вместо 0.12) — переводим.
    if (Number.isFinite(v) && ((k === "contrast" || k === "saturation") ? v > 3 : Math.abs(v) > 1.5)) v = v / 100;
    const [lo, hi] = LIMITS[k];
    out[k] = Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : NEUTRAL[k];
  }
  return out;
}

async function ask(parts, prompt, system, model) {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
    method: "POST",
    headers: { "x-goog-api-key": key(), "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: (system || DEFAULT_SYSTEM) + FORMAT }] },
      contents: [{ role: "user", parts: [{ text: "Пожелания редактора: " + (prompt || DEFAULT_PROMPT) }].concat(parts) }],
      generationConfig: { temperature: 0, maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 0 }, responseMimeType: "application/json", responseSchema: SCHEMA },
    }),
    signal: AbortSignal.timeout(90000),
  });
  const text = await res.text();
  if (res.status === 404 && model !== FALLBACK) return ask(parts, prompt, system, FALLBACK);
  if (!res.ok) throw new Error("gemini_" + res.status + ": " + text.slice(0, 200));
  const j = JSON.parse(text);
  const cand = (j.candidates || [])[0] || {};
  const out = ((cand.content || {}).parts || []).map((x) => x.text || "").join("");
  try { return JSON.parse(out); } catch {
    // Ответ оборвался (модель иногда пишет число-«простыню» до лимита) —
    // режем по «"i":» и берём из каждого куска те поля, что успели прийти.
    const photos = [];
    for (const chunk of out.split(/"i"\s*:/).slice(1)) {
      const o = { i: parseInt(chunk, 10) };
      for (const kv of chunk.matchAll(/"(\w+)"\s*:\s*(-?\d{1,6}(?:\.\d{1,6})?)/g)) o[kv[1]] = Number(kv[2]);
      if (Number.isInteger(o.i)) photos.push(o);
    }
    return { photos: photos };
  }
}

// buffers — JPEG фото поста (как скачали); возвращает массив настроек той же длины.
async function adjust(buffers, prompt, system) {
  if (!key() || !buffers.length) return buffers.map(() => Object.assign({}, NEUTRAL));
  const parts = [];
  buffers.forEach((b, i) => {
    parts.push({ text: "Фото " + i + ":" });
    parts.push({ inline_data: { mime_type: "image/jpeg", data: b.toString("base64") } });
  });
  const r = await ask(parts, prompt, system, MODEL);
  const byI = {};
  (r.photos || []).forEach((p) => { if (Number.isInteger(p.i)) byI[p.i] = clamp(p); });
  return buffers.map((_, i) => byI[i] || Object.assign({}, NEUTRAL));
}

// SVG-фильтр из настроек: шумоподавление → яркость/контраст → насыщенность →
// теплота → резкость. id — чтобы на одном слайде не путались фильтры.
function filterSvg(id, p) {
  if (!p) return "";
  const c = p.contrast, b = p.brightness;
  const inter = (0.5 - 0.5 * c + b).toFixed(3);
  const k = (p.sharpen * 0.45).toFixed(3);
  const w = p.warmth * 0.08;
  return `<filter id="${id}" color-interpolation-filters="sRGB">
    ${p.denoise > 0.05 ? `<feGaussianBlur stdDeviation="${(p.denoise * 0.7).toFixed(2)}"/>` : ""}
    <feComponentTransfer><feFuncR type="linear" slope="${c.toFixed(3)}" intercept="${inter}"/><feFuncG type="linear" slope="${c.toFixed(3)}" intercept="${inter}"/><feFuncB type="linear" slope="${c.toFixed(3)}" intercept="${inter}"/></feComponentTransfer>
    <feColorMatrix type="saturate" values="${p.saturation.toFixed(3)}"/>
    <feColorMatrix type="matrix" values="${(1 + w).toFixed(3)} 0 0 0 0  0 1 0 0 0  0 0 ${(1 - w).toFixed(3)} 0 0  0 0 0 1 0"/>
    ${p.sharpen > 0.05 ? `<feConvolveMatrix order="3" kernelMatrix="0 -${k} 0 -${k} ${(1 + 4 * k).toFixed(3)} -${k} 0 -${k} 0"/>` : ""}
  </filter>`;
}

// Всё, что влияет на обработку, — для страницы настроек (только просмотр).
function info() {
  return { model: MODEL, fallback: FALLBACK, format: FORMAT, limits: LIMITS, neutral: NEUTRAL,
    defaultPrompt: DEFAULT_PROMPT, defaultSystem: DEFAULT_SYSTEM, userPrefix: "Пожелания редактора: " };
}
module.exports = { adjust, filterSvg, info, DEFAULT_PROMPT, DEFAULT_SYSTEM, NEUTRAL, LIMITS };
