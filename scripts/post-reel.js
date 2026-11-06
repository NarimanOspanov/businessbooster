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
const VOICE_NAME = process.env.REEL_VOICE_NAME || "Нариман";
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
   что случилось, цифры, что это значит для читателя. Последняя фраза — вывод
   или вопрос, без призыва подписаться. __LEN__ знаков, это примерно полминуты речи.
   Только то, что есть в новости: ничего не придумывай и не достраивай.
2) "shots" — ровно __N__ описаний кадров ПО-АНГЛИЙСКИ, по порядку текста: первый
   кадр иллюстрирует начало, последний — конец. Каждое описание — одна фраза
   для модели, рисующей фотографию: что в кадре, свет, настроение.
   Documentary photography, вертикальный кадр, без текста и надписей в кадре,
   без логотипов и узнаваемых брендов, без узнаваемых реальных людей.
   Кадр показывает СМЫСЛ фразы, а не иллюстрирует слово буквально.

Ответь строго JSON: {"script": "…", "shots": ["…", …]}`;

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
  const script = String(out.script || "").replace(/\s+/g, " ").trim();
  const list = (Array.isArray(out.shots) ? out.shots : []).map((s) => String(s || "").trim()).filter(Boolean);
  if (script.length < 80) throw new Error("раскадровка: слишком короткий текст");
  if (list.length < 2) throw new Error("раскадровка: меньше двух кадров");
  return { script, shots: list.slice(0, shots) };
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
async function voiceId(name) {
  const want = String(name || VOICE_NAME).trim().toLowerCase();
  if (voiceCache && voiceCache.name === want) return voiceCache.id;
  const r = await fetch(ELEVEN + "/voices", { headers: { "xi-api-key": elevenKey() } });
  if (!r.ok) throw new Error("ElevenLabs /voices: " + r.status);
  const list = ((await r.json()) || {}).voices || [];
  const hit = list.find((v) => String(v.name || "").trim().toLowerCase() === want);
  if (!hit) throw new Error(`в аккаунте ElevenLabs нет голоса «${name || VOICE_NAME}» (есть: ${list.map((v) => v.name).join(", ").slice(0, 160)})`);
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
  step("render", { frames: frames.length });
  const tail = channel ? "Подробнее в " + String(channel).replace(/^@?/, "@") : null;
  const tops = frames.map((_, i) => (i === 0 ? twoLines(headline) : i === frames.length - 1 ? tail : null));
  const mp4 = await renderReel(frames, {
    voice: voice,
    subs: p.script,
    tops: tops,
    big: frames.map((_, i) => i === 0),
    music: music !== false,
    tempo: 1.06,
  });
  step("done", { bytes: mp4.length });
  return { mp4, script: p.script, shots: p.shots };
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
