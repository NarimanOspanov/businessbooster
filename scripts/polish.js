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

// --- Режим «готовое фото»: Gemini возвращает обработанную картинку -----------
// Модель редактирования картинок (Nano Banana) получает фото и промпт. К
// промпту из настроек всегда добавляем правила из кода (GUARD): только свет и
// цвет, содержимое и водяные знаки не трогать. Модель может их нарушить,
// поэтому каждый результат проверяем: (1) контуры кадра совпадают с оригиналом,
// (2) отдельная модель сравнивает пару — водяные знаки на месте, предметы те же.
// Не прошло — для этого фото берём обработку цифрами (adjust/filterSvg).
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";
const GUARD = `Это фото квартиры из объявления о продаже. Сделай только цветокоррекцию и улучшение качества изображения.
СТРОГО ЗАПРЕЩЕНО: убирать, добавлять или менять предметы, мебель, стены, пол, потолок, окна, двери, вид из окна; менять ракурс, кадрирование и пропорции.
СТРОГО: сохрани все водяные знаки и надписи на фото (например «krisha.kz» и номер «ID…») без изменений и на тех же местах.
Верни фото тех же пропорций.`;
const EDGE_MIN = 0.8; // корреляция контуров оригинала и результата: тот же кадр ~0,98, другой ~0,1

function sniffMime(b) { return b && b[0] === 0x89 && b[1] === 0x50 ? "image/png" : "image/jpeg"; }

async function generate(buf, prompt, model, guard) {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model || IMAGE_MODEL) + ":generateContent", {
    method: "POST",
    headers: { "x-goog-api-key": key(), "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: (guard || GUARD) + "\n\nПожелания редактора: " + (prompt || DEFAULT_PROMPT) }, { inline_data: { mime_type: "image/jpeg", data: buf.toString("base64") } }] }],
      generationConfig: { responseModalities: ["IMAGE"] },
    }),
    signal: AbortSignal.timeout(120000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("gemini_image_" + res.status + ": " + String((j.error && j.error.message) || "").slice(0, 160));
  const parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
  const img = parts.find((p) => p.inline_data || p.inlineData);
  if (!img) throw new Error("модель не вернула картинку");
  return Buffer.from((img.inline_data || img.inlineData).data, "base64");
}

// Контуры кадра в маленьком сером варианте — для сравнения «тот же кадр или нет».
const GW = 64, GH = 80;
function edgeMap(buf) {
  const { Resvg } = require("@resvg/resvg-js");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${GW}" height="${GH}"><image href="data:${sniffMime(buf)};base64,${buf.toString("base64")}" width="${GW}" height="${GH}" preserveAspectRatio="none"/></svg>`;
  const px = new Resvg(svg).render().pixels;
  const g = new Float64Array(GW * GH);
  for (let i = 0; i < GW * GH; i++) g[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
  const e = new Float64Array(GW * GH);
  for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) { const i = y * GW + x; e[i] = Math.abs(g[i + 1] - g[i - 1]) + Math.abs(g[i + GW] - g[i - GW]); }
  return e;
}
function corr(a, b) {
  const n = a.length; let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let s = 0, sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; s += x * y; sa += x * x; sb += y * y; }
  return sa && sb ? s / Math.sqrt(sa * sb) : 0;
}

const CHECK = `Тебе дают два фото: первое — оригинал, второе — после обработки. Проверь честность обработки.
same_content — true, если на втором фото те же предметы, мебель, двери, окна, отделка и ракурс; ничего не убрано и не добавлено (изменились только свет, цвет, резкость).
watermark_kept — true, если все водяные знаки и надписи оригинала (например «krisha.kz», «ID…») видны на втором фото на тех же местах. Если на оригинале водяных знаков нет — true.
note — 3–8 слов по-русски, что изменилось.`;
async function verify(orig, edited) {
  const edge = corr(edgeMap(orig), edgeMap(edited));
  const out = { edge: Math.round(edge * 1000) / 1000, same_content: null, watermark_kept: null, note: "" };
  if (edge < EDGE_MIN) { out.ok = false; out.note = "кадр изменился (контуры не совпадают)"; return out; }
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(MODEL) + ":generateContent", {
    method: "POST",
    headers: { "x-goog-api-key": key(), "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: CHECK }] },
      contents: [{ role: "user", parts: [
        { text: "Оригинал:" }, { inline_data: { mime_type: "image/jpeg", data: orig.toString("base64") } },
        { text: "После обработки:" }, { inline_data: { mime_type: sniffMime(edited), data: edited.toString("base64") } }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 400, thinkingConfig: { thinkingBudget: 0 }, responseMimeType: "application/json",
        responseSchema: { type: "OBJECT", properties: { same_content: { type: "BOOLEAN" }, watermark_kept: { type: "BOOLEAN" }, note: { type: "STRING" } }, required: ["same_content", "watermark_kept"] } },
    }),
    signal: AbortSignal.timeout(60000),
  });
  const j = await res.json().catch(() => ({}));
  try {
    const t = (((j.candidates || [])[0] || {}).content || {}).parts.map((p) => p.text || "").join("");
    const v = JSON.parse(t);
    out.same_content = !!v.same_content; out.watermark_kept = !!v.watermark_kept; out.note = String(v.note || "").slice(0, 80);
  } catch { out.note = "проверка не ответила"; }
  out.ok = out.same_content === true && out.watermark_kept === true;
  return out;
}

// Обработать фото поста в режиме «готовое фото». Возвращает для каждого
// { buf, fx, how, check }: how = "ai" (взяли картинку модели) | "numbers"
// (не прошла проверку — коррекция цифрами) | "none".
async function polishPhotos(buffers, cfg) {
  const out = buffers.map((b) => ({ buf: b, fx: null, how: "none", check: null }));
  if (!key()) return out;
  for (let i = 0; i < buffers.length; i += 3) {
    await Promise.all(buffers.slice(i, i + 3).map(async (b, k) => {
      const idx = i + k;
      try {
        const g = await generate(b, cfg.prompt, cfg.imageModel, cfg.guard);
        const v = await verify(b, g);
        out[idx].check = v;
        if (v.ok) { out[idx].buf = g; out[idx].how = "ai"; }
      } catch (e) { out[idx].check = { ok: false, note: String(e.message).slice(0, 100) }; }
    }));
  }
  const failed = out.map((o, i) => (o.how === "ai" ? -1 : i)).filter((i) => i >= 0);
  if (failed.length) {
    const fx = await adjust(failed.map((i) => buffers[i]), cfg.prompt, cfg.system).catch(() => []);
    failed.forEach((i, k) => { if (fx[k]) { out[i].fx = fx[k]; out[i].how = "numbers"; } });
  }
  return out;
}

// Всё, что влияет на обработку, — для страницы настроек (только просмотр).
function info() {
  return { model: MODEL, fallback: FALLBACK, format: FORMAT, limits: LIMITS, neutral: NEUTRAL,
    defaultPrompt: DEFAULT_PROMPT, defaultSystem: DEFAULT_SYSTEM, userPrefix: "Пожелания редактора: ",
    imageModel: IMAGE_MODEL, guard: GUARD, check: CHECK, edgeMin: EDGE_MIN };
}
module.exports = { adjust, filterSvg, info, polishPhotos, generate, verify, IMAGE_MODEL, GUARD, DEFAULT_PROMPT, DEFAULT_SYSTEM, NEUTRAL, LIMITS };
