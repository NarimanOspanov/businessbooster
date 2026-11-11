// Reels по посту канала: короткий обзор новости для человека в метро.
//
// Вертикально, с субтитрами, своим голосом и кадровым рядом, который рисуется
// под смысл поста, а не берётся из него. Картинка поста для этого не годится:
// в посте она одна, а ролик на тридцать секунд из одного снимка — это
// слайд-шоу из одного слайда.
//
// Порядок: Gemini пишет закадровый текст и раскадровку → Gemini рисует кадры →
// ElevenLabs читает текст голосом канала → renderReel собирает. Сборку,
// наезд, перекрёстные склейки, субтитры и музыку делает тот же renderReel, что
// и рилсы по квартирам: второго конвейера здесь нет.
//
// Проверить без сервера:
//   node scripts/post-reel.js --headline "…" --body "…" --out reel.mp4
//   добавьте --dry, чтобы увидеть текст и раскадровку, ничего не рисуя.

const fs = require("fs");
const { renderReel } = require("./insta-reel.js");

const ELEVEN = "https://api.elevenlabs.io/v1";
const GEMINI = "https://generativelanguage.googleapis.com/v1beta/models/";

// Клон живёт в личном кабинете ElevenLabs. Ищем его ПО ИМЕНИ, а не по зашитому
// id: голос можно пересоздать, и тогда id меняется, а имя остаётся — зашитый id
// тихо превратился бы в чужой голос в эфире.
const VOICE_NAME = process.env.REEL_VOICE_NAME || "Nariman Ospanov";
const TTS_MODEL = process.env.ELEVEN_TTS_MODEL || "eleven_multilingual_v2";
const TEXT_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";
// Шесть кадров на тридцать секунд — пять секунд на кадр. Реже видно, что это
// слайд-шоу; чаще — не успеваешь рассмотреть, и каждый кадр стоит денег.
const SHOTS = Math.max(3, Math.min(8, Number(process.env.REEL_SHOTS || 6)));

function geminiKey() {
  const k = process.env.GEMINI_API_KEY || "";
  if (!k) throw new Error("GEMINI_API_KEY не задан");
  return k;
}
function elevenKey() {
  const k = process.env.ELEVENLABS_API_KEY
    || (process.env.ELEVENLABS_KEY_FILE && fs.existsSync(process.env.ELEVENLABS_KEY_FILE)
        ? fs.readFileSync(process.env.ELEVENLABS_KEY_FILE, "utf8").trim() : "");
  if (!k) throw new Error("ELEVENLABS_API_KEY не задан");
  return k;
}

async function gemini(model, body, timeoutMs) {
  const r = await fetch(GEMINI + encodeURIComponent(model) + ":generateContent", {
    method: "POST",
    headers: { "x-goog-api-key": geminiKey(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs || 120000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("gemini " + r.status + ": " + String((j.error && j.error.message) || "").slice(0, 200));
  return j;
}

/* ---------------- текст и раскадровка ---------------- */

// Пишем по-русски, рисуем по-английски: модели картинок слушаются английского
// заметно лучше, а голосу нужен русский. Это одна просьба, а не две: кадры
// должны идти ЗА текстом, иначе пятый кадр иллюстрирует вторую фразу.
const PLAN = `Ты режиссёр коротких вертикальных роликов для телеграм-канала о работе,
ИТ и диджитале. Читатель смотрит это в метро со звуком или без.

Из новости ниже сделай:
1) "script" — закадровый текст ПО-РУССКИ. Разговорно, по делу, без канцелярита
   и без эмодзи. Первая фраза — зацеп, не пересказ заголовка. Дальше суть:
   что случилось, цифры, что это значит для читателя. Последняя фраза — вывод,
   утверждением. НЕ вопрос: ролик кончается точкой, а не вопросительным знаком —
   вопрос в конце звучит как чужая интонация поверх ровного рассказа. И без
   призыва подписаться. __LEN__ знаков, это примерно полминуты речи.
   Только то, что есть в новости: ничего не придумывай и не достраивай.
2) "shots" — ровно __N__ описаний кадров ПО-АНГЛИЙСКИ, по порядку текста: первый
   кадр иллюстрирует начало, последний — конец. Каждое описание — одна фраза
   для модели, рисующей фотографию: что в кадре, свет, настроение.
   Documentary photography, вертикальный кадр, без текста и надписей в кадре,
   без логотипов и узнаваемых брендов, без узнаваемых реальных людей.
   Кадр показывает СМЫСЛ фразы, а не иллюстрирует слово буквально.

3) "mood" — тон новости одним словом: "serious" (увольнения, запреты, утечки,
   беда), "calm" (разбор, инструкция, спокойная находка) или "upbeat" (запуск,
   успех, что-то бесплатное и полезное). По нему подбирается музыка, и бодрая
   подложка под плохую новость слышна как фальшь.

Ответь строго JSON: {"script": "…", "shots": ["…", …], "mood": "…"}`;

// Просьбы «не вопросом» модель слушается почти всегда — почти. Остаток снимаем
// руками: последнюю фразу, если она вопрос, выбрасываем. Выбрасываем только
// когда без неё остаётся связный текст (две трети длины и ещё хотя бы одна
// фраза) — иначе вопрос и есть весь вывод, и ролик кончится ничем.
function dropTrailingQuestion(script) {
  const s = String(script || "").trim();
  if (!s.endsWith("?")) return s;
  const parts = s.match(/[^.!?]+[.!?]+/g);
  if (!parts || parts.length < 2) return s;
  const kept = parts.slice(0, -1).join("").trim();
  return kept.length >= s.length * 0.66 ? kept : s;
}

async function plan(headline, body, { shots = SHOTS, chars = 520 } = {}) {
  const text = PLAN.replace("__LEN__", String(chars)).replace("__N__", String(shots));
  const news = [String(headline || "").trim(), String(body || "").trim()].filter(Boolean).join("\n\n");
  const j = await gemini(TEXT_MODEL, {
    contents: [{ role: "user", parts: [{ text: text + "\n\nНОВОСТЬ:\n" + news.slice(0, 4000) }] }],
    generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
  }, 90000);
  const raw = ((((j.candidates || [])[0] || {}).content || {}).parts || []).map((p) => p.text).join("");
  let out;
  try { out = JSON.parse(raw); } catch { throw new Error("раскадровка: модель вернула не JSON"); }
  const script = dropTrailingQuestion(String(out.script || "").replace(/\s+/g, " ").trim());
  const list = (Array.isArray(out.shots) ? out.shots : []).map((s) => String(s || "").trim()).filter(Boolean);
  if (script.length < 80) throw new Error("раскадровка: слишком короткий текст");
  if (list.length < 2) throw new Error("раскадровка: меньше двух кадров");
  const mood = ["serious", "calm", "upbeat"].includes(String(out.mood || "").toLowerCase())
    ? String(out.mood).toLowerCase() : "calm";
  return { script, shots: list.slice(0, shots), mood };
}

/* ---------------- кадры ---------------- */

// То же, чем polish.js правит фотографии, но без входной картинки: тот же
// эндпоинт рисует с нуля, если не передавать inline_data.
async function draw(prompt) {
  const j = await gemini(IMAGE_MODEL, {
    contents: [{ role: "user", parts: [{ text: prompt + " Vertical 4:5 frame, photographic, no text, no watermark, no logos." }] }],
    generationConfig: { responseModalities: ["IMAGE"] },
  }, 120000);
  const parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
  const img = parts.find((p) => p.inline_data || p.inlineData);
  if (!img) throw new Error("модель не вернула картинку");
  return Buffer.from((img.inline_data || img.inlineData).data, "base64");
}

// По очереди, а не разом: на B2 шесть одновременных генераций съедают память,
// и упавший кадр должен стоить один кадр, а не весь ролик.
async function drawAll(shots, onStep) {
  const out = [];
  for (const [i, s] of shots.entries()) {
    try {
      out.push(await draw(s));
      if (onStep) onStep(i + 1, shots.length, null);
    } catch (e) {
      // Кадр пропускаем: пять кадров вместо шести — это ролик, а ноль — это
      // ничего. Ряд всё равно идёт за текстом, просто одна сцена длиннее.
      if (onStep) onStep(i + 1, shots.length, String(e.message || e));
    }
  }
  if (out.length < 2) throw new Error("не нарисовано и двух кадров");
  return out;
}

/* ---------------- голос ---------------- */

let voiceCache = null;

/**
 * Список голосов аккаунта.
 *
 * Через v2, а не v1: v1 отдаёт усечённый список без пагинации, и клон, который
 * в кабинете прекрасно виден, в ответ просто не попадал — в логе были одни
 * стоковые голоса. У v2 есть и поиск по имени, так что сначала спрашиваем
 * конкретно нужный, и только если не вышло — тянем страницу целиком.
 * На старых ключах v2 может быть недоступен, поэтому v1 остаётся запасным.
 */
async function listVoices(name) {
  const get = async (path) => {
    const r = await fetch(ELEVEN + path, { headers: { "xi-api-key": elevenKey() } });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    return j && Array.isArray(j.voices) ? j.voices : null;
  };
  const found = name ? await get("/v2/voices?page_size=100&search=" + encodeURIComponent(name)) : null;
  if (found && found.length) return found;
  return (await get("/v2/voices?page_size=100")) || (await get("/voices")) || [];
}

/**
 * Голос по имени — не придираясь к написанию.
 *
 * Клон в кабинете может называться «Нариман», «Nariman» или «Нариман (ru)», и
 * ронять ролик из-за скобки глупо. Поэтому: точное совпадение, иначе вхождение
 * подстроки, иначе — если в переменной лежит не имя, а сам идентификатор —
 * берём его как есть. Своих голосов в аккаунте единицы, спутать не с чем.
 */
async function voiceId(name) {
  const raw = String(name || VOICE_NAME).trim();
  const want = raw.toLowerCase();
  if (voiceCache && voiceCache.name === want) return voiceCache.id;
  // Идентификатор ElevenLabs — двадцать с лишним знаков без пробелов.
  if (/^[A-Za-z0-9]{18,}$/.test(raw)) { voiceCache = { name: want, id: raw }; return raw; }

  const list = await listVoices(raw);
  const nameOf = (v) => String(v.name || "").trim().toLowerCase();
  const hit = list.find((v) => nameOf(v) === want)
    || list.find((v) => nameOf(v).includes(want) || want.includes(nameOf(v)));
  if (!hit) {
    // Сначала СВОИ голоса: стоковых в любом аккаунте два десятка, и в обрезанном
    // списке они вытесняли именно то, что нужно было увидеть.
    const mine = list.filter((v) => v.category && v.category !== "premade").map((v) => v.name);
    const rest = list.filter((v) => !v.category || v.category === "premade").map((v) => v.name);
    // Сколько всего вернулось — половина диагноза: «ни одного своего из 21» это
    // чужой кабинет у ключа, а «ни одного вообще» — что ключ не тот или не те права.
    throw new Error(`в аккаунте ElevenLabs нет голоса «${raw}» (всего голосов ${list.length}). `
      + `Свои: ${mine.join(", ") || "нет ни одного"}. Стоковые: ${rest.join(", ").slice(0, 100)}…`);
  }
  voiceCache = { name: want, id: hit.voice_id };
  return hit.voice_id;
}

// renderReel меряет длину голоса по заголовку WAV, поэтому просим сырой PCM и
// надеваем заголовок сами — так же, как это делает ветка Gemini TTS рядом.
function wavOf(pcm, rate) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

async function speak(text, { name } = {}) {
  const id = await voiceId(name);
  const r = await fetch(`${ELEVEN}/text-to-speech/${id}?output_format=pcm_24000`, {
    method: "POST",
    headers: { "xi-api-key": elevenKey(), "Content-Type": "application/json" },
    body: JSON.stringify({
      text: text,
      model_id: TTS_MODEL,
      // Ровная подача: текст читают поверх музыки, и прыгающая интонация там
      // слышна как брак, а не как живость.
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.1, use_speaker_boost: true },
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!r.ok) throw new Error("ElevenLabs TTS: " + r.status + " " + (await r.text()).slice(0, 160));
  return wavOf(Buffer.from(await r.arrayBuffer()), 24000);
}

/* ---------------- заголовок ---------------- */

/**
 * Заголовок — в две строки.
 *
 * frameSvg подбирает кегль так, чтобы строка влезла в 880 px, и для новостного
 * заголовка в сорок с лишним знаков упирается в минимальные 30 px — в ленте это
 * нечитаемо. Он писался под короткие строки вроде «2 комн · 42 млн».
 */
function twoLines(text) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  if (words.join(" ").length <= 22) return words.join(" ");
  let best = null;
  for (let i = 1; i < words.length; i += 1) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const score = Math.abs(a.length - b.length) + Math.max(0, Math.max(a.length, b.length) - 26) * 4;
    if (!best || score < best.score) best = { score, lines: [a, b] };
  }
  return best.lines;
}

/* ---------------- ролик ---------------- */

/**
 * Ролик по одному посту: обзор новости на полминуты.
 *
 * Возвращает { mp4, script, shots }. Текст возвращается вместе с видео, чтобы
 * было видно, что именно прочитал голос, не пересматривая ролик.
 */
async function postReel({ headline, body, channel, voiceName, music, shots, onStep } = {}) {
  const step = onStep || (() => {});
  step("plan");
  const p = await plan(headline, body, { shots: shots || SHOTS });
  step("draw", { shots: p.shots.length });
  const frames = await drawAll(p.shots, (i, n, err) => step("drawn", { i, n, err }));
  step("speak", { chars: p.script.length });
  const voice = await speak(p.script, { name: voiceName });
  step("render", { frames: frames.length, mood: p.mood });
  const tail = channel ? "Подробнее в " + String(channel).replace(/^@?/, "@") : null;
  const tops = frames.map((_, i) => (i === 0 ? twoLines(headline) : i === frames.length - 1 ? tail : null));
  const mp4 = await renderReel(frames, {
    voice: voice,
    subs: p.script,
    tops: tops,
    big: frames.map((_, i) => i === 0),
    music: music !== false,
    mood: p.mood,
    // Тише обычного: здесь закадровый текст плотный и идёт без пауз, и на
    // штатных 0,13 музыка слышна поверх голоса, а не под ним. 0,09 — это на
    // три децибела ниже: подложка остаётся, спорить с голосом перестаёт.
    musicVolume: 0.09,
    tempo: 1.06,
    // Новость смотрят в ленте, где верх кадра занят интерфейсом: слайд уходит
    // ниже, заголовок вместе с ним. Подложку гасим слабее — при 0.35 поля над
    // и под кадром читались как чёрные полосы, а не как продолжение картинки.
    frame: { scrim: 0.22, headroom: 70 },
  });
  step("done", { bytes: mp4.length });
  return { mp4, script: p.script, shots: p.shots, mood: p.mood };
}

module.exports = { postReel, plan, draw, drawAll, speak, voiceId, twoLines };

if (require.main === module) {
  const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i > 0 ? process.argv[i + 1] : d; };
  (async () => {
    const headline = arg("headline", "");
    const body = arg("body", "");
    if (process.argv.includes("--dry")) {
      const p = await plan(headline, body, { shots: Number(arg("shots", SHOTS)) });
      console.log("ТЕКСТ (" + p.script.length + " знаков):\n" + p.script + "\n");
      p.shots.forEach((s, i) => console.log("кадр " + (i + 1) + ": " + s));
      return;
    }
    const out = arg("out", "reel.mp4");
    const r = await postReel({
      headline, body, channel: arg("channel", ""), voiceName: arg("voice", ""),
      shots: Number(arg("shots", SHOTS)), music: arg("music") !== "no",
      onStep: (s, d) => console.log("·", s, d ? JSON.stringify(d) : ""),
    });
    fs.writeFileSync(out, r.mp4);
    console.log("готово:", out, (r.mp4.length / 1048576).toFixed(1), "МБ");
  })().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
}
