// Факты о квартире для фото карусели — из карточки объявления на Крыше:
// характеристики («Монолитный дом 2025 года», «Потолки 3 м», «Паркинг»),
// оценка цены самой Крыши («метр на 7,4% дешевле похожих») и 2–3 довода из
// описания хозяина («Закрытый двор без машин»).
//
// Характеристики и цену разбираем правилами: это поля формы, выдумать там
// нечего. Описание — свободный текст, его читает Gemini, но только выбирает
// сказанное хозяином: каждый довод должен опираться на слова из текста.
//
// Страницу и оценку цены берём через прокси, как и остальные чтения карточек:
// с IP датацентра Крыша рвёт соединения. Нет прокси — пробуем напрямую.
const fs = require("fs");
const path = require("path");
const os = require("os");
const K = require("./krisha-lib.js");
const CARD = require("./krisha-card.js");

const MODEL = process.env.GEMINI_MODEL || "gemini-3.7-flash";
const FALLBACK = "gemini-flash-latest";
const MAX_LEN = 34; // столько влезает на плашку поверх фото одной строкой

function key() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  try { return fs.readFileSync(path.join(os.homedir(), ".gemini-key"), "utf8").trim() || null; } catch { return null; }
}

async function fetchKrisha(url) {
  try { return await K.fetchText(url, 2, 15000, { proxy: true }); }
  catch (e) { if (e && (e.status === 404 || e.status === 410)) throw e; }
  return K.fetchText(url, 2, 15000);
}

const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;
const num = (s) => { const m = String(s || "").match(/(\d+(?:[.,]\d+)?)/); return m ? Number(m[1].replace(",", ".")) : null; };
const fmt = (n) => String(Math.round(n * 10) / 10).replace(".", ",");

// Характеристики: «Тип дома: монолитный» из верхнего блока и пары dt/dd из
// «О квартире». Берём только то, что продаёт: панельный дом или «телефон:
// есть возможность подключения» на плашке не нужны.
function fromParams(card) {
  const kv = {};
  for (const s of card.short || []) {
    const i = s.indexOf(":");
    if (i > 0) kv[s.slice(0, i).trim().toLowerCase()] = s.slice(i + 1).trim();
  }
  for (const p of card.params || []) kv[String(p.label).toLowerCase()] = String(p.value);
  const out = [];

  const type = String(kv["тип дома"] || "").toLowerCase();
  const year = num(kv["год постройки"]);
  const material = /монолит/.test(type) ? "Монолитный дом" : /кирпич/.test(type) ? "Кирпичный дом" : null;
  const yearOk = year && year >= 2010 && year <= new Date().getFullYear() + 3;
  if (material && yearOk) out.push(material + " " + year + " года");
  else if (material) out.push(material);
  else if (yearOk) out.push("Дом " + year + " года");

  const kitchen = num((String(kv["площадь"] || "").match(/кухни\s*[—-]\s*([\d.,]+)/) || [])[1]);
  if (kitchen && kitchen >= 10 && kitchen < 60) out.push("Кухня " + fmt(kitchen) + " м²");
  const ceil = num(kv["высота потолков"]);
  if (ceil && ceil >= 2.8 && ceil < 6) out.push("Потолки " + fmt(ceil) + " м");
  const wc = String(kv["санузел"] || "").toLowerCase();
  if (/2\s*с\/у|два|более/.test(wc)) out.push("Два санузла");
  else if (/раздел/.test(wc)) out.push("Раздельный санузел");
  const cond = String(kv["состояние"] || "").toLowerCase();
  if (/свеж|евро|дизайн/.test(cond)) out.push(cap(cond));

  const park = String(kv["парковка"] || "").toLowerCase();
  if (/паркинг/.test(park)) out.push("Паркинг");
  else if (/охраняем/.test(park)) out.push("Охраняемая стоянка рядом");
  const sec = String(kv["безопасность"] || "").toLowerCase();
  const strong = [/консьерж/.test(sec) && "консьерж", /охран/.test(sec) && "охрана", /видеонаблюд/.test(sec) && "видеонаблюдение"].filter(Boolean);
  if (strong.length) out.push(cap(strong.slice(0, 2).join(" и ")));
  const balc = String(kv["балкон"] || "").toLowerCase();
  const glazed = /да/.test(String(kv["балкон остеклён"] || kv["балкон остеклен"] || "").toLowerCase());
  if (/несколько/.test(balc)) out.push("Несколько балконов");
  else if (/лоджи/.test(balc)) out.push(glazed ? "Застеклённая лоджия" : "Лоджия");
  else if (/балкон/.test(balc) && glazed) out.push("Застеклённый балкон");
  const furn = String(kv["квартира меблирована"] || "").toLowerCase();
  if (/полност/.test(furn)) out.push("С мебелью");
  // Название ЖК само по себе почти ничего не говорит — последним.
  const cx = String(kv["жилой комплекс"] || "").trim();
  if (cx && cx.length <= 22) out.push("ЖК «" + cx + "»");
  return out.filter((s) => s.length <= MAX_LEN);
}

// Оценка цены самой Крыши: тот же блок «Цена м² в похожих квартирах», что
// на странице объявления. Показываем только «дешевле» и в разумных пределах:
// −40% — скорее ошибка в объявлении, чем находка.
async function priceFact(id) {
  const html = await fetchKrisha("https://krisha.kz/analytics/aPriceAnalysis/?id=" + id);
  const t = CARD.clean(html);
  const m = t.match(/На\s+([\d.,]+)%\s+дешевле/i);
  const pct = m ? Number(m[1].replace(",", ".")) : null;
  return pct && pct >= 2 && pct <= 30 ? "Метр на " + fmt(pct) + "% дешевле похожих" : null;
}

const PROMPT = `Ты редактор Instagram-аккаунта с квартирами от хозяев. Тебе дают описание квартиры, которое написал продавец.
Выбери до трёх самых сильных доводов купить эту квартиру — то, что сам продавец прямо написал.
Каждый довод — короткая фраза по-русски до ${MAX_LEN} знаков, с заглавной буквы, без точки и эмодзи, например: «Напротив Национального музея», «Закрытый двор без машин», «Окна во двор, тихо», «Не угловая», «Вид на горы».
Нельзя: придумывать то, чего нет в тексте; цену, торг, ипотеку, телефоны, имена; общие слова («Отличная квартира», «Развитая инфраструктура», «Всё рядом»);
параметры, которые и так видны: комнаты, площадь, этаж, год и тип дома, высота потолков, санузел, паркинг, балкон, мебель.
Если сильных доводов нет — верни пустой список.`;
const SCHEMA = { type: "OBJECT", properties: { points: { type: "ARRAY", items: { type: "STRING" } } }, required: ["points"] };

async function ask(text, model) {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
    method: "POST",
    headers: { "x-goog-api-key": key(), "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: PROMPT }] },
      contents: [{ role: "user", parts: [{ text: text }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 400, thinkingConfig: { thinkingBudget: 0 }, responseMimeType: "application/json", responseSchema: SCHEMA },
    }),
    signal: AbortSignal.timeout(40000),
  });
  const body = await res.text();
  if (res.status === 404 && model !== FALLBACK) return ask(text, FALLBACK);
  if (!res.ok) throw new Error("gemini_" + res.status + ": " + body.slice(0, 200));
  const j = JSON.parse(body);
  const out = ((((j.candidates || [])[0] || {}).content || {}).parts || []).map((x) => x.text || "").join("");
  return JSON.parse(out).points || [];
}

// Довод должен держаться за текст: хотя бы одно его значимое слово (основа из
// 5 букв) встречается в описании. Отсекает «выдуманный» вид на горы.
function grounded(point, desc) {
  const d = desc.toLowerCase().replace(/ё/g, "е");
  const words = point.toLowerCase().replace(/ё/g, "е").match(/[\p{L}\d]{5,}/gu) || [];
  return words.some((w) => d.includes(w.slice(0, 5)));
}

async function fromDescription(desc) {
  const text = String(desc || "").trim();
  if (text.length < 80 || !key()) return [];
  const pts = await ask(text.slice(0, 4000), MODEL);
  return pts.map((s) => String(s).replace(/[.!]+$/, "").replace(/^[«"]|[»"]$/g, "").trim())
    .filter((s) => s && s.length <= MAX_LEN && grounded(s, text)).slice(0, 3);
}

// { params: [...], price: "…" | null, desc: [...], text } — каждая часть отдельно:
// сбой оценки цены или Gemini не отменяет характеристики.
async function cardFacts(id) {
  const card = CARD.parse(await fetchKrisha("https://krisha.kz/a/show/" + id), id);
  const [price, desc] = await Promise.all([
    priceFact(id).catch((e) => { console.log("[card-facts] price " + id + ": " + e.message); return null; }),
    fromDescription(card.description).catch((e) => { console.log("[card-facts] desc " + id + ": " + e.message); return []; }),
  ]);
  // Текст карточки — сохранить как есть (описание и «параметр: значение»
  // строками, тот же вид, что присылает плагин номеров).
  const text = {
    desc: card.description || "",
    params: (card.short || []).concat((card.params || []).map((p) => p.label + ": " + p.value)).join("\n"),
  };
  return { params: fromParams(card), price: price, desc: desc, text: text };
}

module.exports = { cardFacts, fromParams };
