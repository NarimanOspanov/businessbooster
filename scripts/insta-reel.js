// Reels из готовых слайдов карусели: каждый слайд 4:5 ставим в кадр 9:16
// поверх размытой копии самого себя (без чёрных полос), медленный наезд и
// плавная смена. Последний слайд (призыв поставить «+») держим дольше.
// Звук: закадровый голос (текст по фактам квартиры пишет Gemini, озвучивает
// Gemini TTS) поверх тихой музыки из assets/reel-music (сгенерирована Lyria —
// музыку из библиотеки Instagram через API не добавить). Длина ролика — по
// голосу. Голос не вышел — ролик с одной музыкой. Кодируем ffmpeg-static.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { Resvg } = require("@resvg/resvg-js");

const W = 1080, H = 1920, SW = 1080, SH = 1350;
const MUSIC_DIR = path.join(__dirname, "..", "assets", "reel-music");
const FPS = 30;

function ffmpegPath() {
  try { return require("ffmpeg-static"); } catch { return "ffmpeg"; }
}

// Кадр 9:16: фон — тот же слайд, растянутый и размытый, с затемнением;
// сам слайд по центру, над ним — крупная надпись (одна-две строки).
// Кегль, чтобы строка влезла в 880 px: наезд камеры съедает края кадра.
// У Montserrat ExtraBold средний знак ≈ 0,66 кегля.
const fitSize = (t, max) => Math.max(30, Math.min(max, Math.floor(880 / (String(t).length * 0.66))));
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function frameSvg(slide, top, big) {
  const uri = "data:image/jpeg;base64," + slide.toString("base64");
  const y = Math.round((H - SH) / 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Montserrat">
  <defs><filter id="b" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="40"/></filter></defs>
  <image href="${uri}" x="-200" y="-100" width="${W + 400}" height="${H + 200}" preserveAspectRatio="xMidYMid slice" filter="url(#b)"/>
  <rect width="${W}" height="${H}" fill="#000" opacity=".35"/>
  <image href="${uri}" x="0" y="${y}" width="${SW}" height="${SH}" preserveAspectRatio="xMidYMid slice"/>
  ${(Array.isArray(top) ? top : top ? [top] : []).slice(0, 2).map((t, k, a) => `<text x="${W / 2}" y="${y - (a.length === 2 ? (k ? 60 : 135) : 85)}" text-anchor="middle" font-size="${fitSize(t, big ? 58 : 44)}" font-weight="800" fill="${k && big ? "#ffd166" : "#fff"}">${esc(t)}</text>`).join("")}
</svg>`;
}

const FONT_DIR = path.join(__dirname, "..", "assets", "fonts");
const FONTS = ["Montserrat_500Medium.ttf", "Montserrat_700Bold.ttf", "Montserrat_800ExtraBold.ttf"].map((f) => path.join(FONT_DIR, f));
function toPng(svg) {
  const r = new Resvg(svg, { font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: "Montserrat" } });
  return r.render().asPng();
}

function run(bin, args) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error("ffmpeg: " + String(stderr || err.message).split("\n").slice(-4).join(" ").slice(0, 400)));
      else resolve();
    });
  });
}

// slides — JPEG-буферы карусели (обложка, фото, …, призыв). Возвращает MP4.
// opts.hook — крупный зацеп над первым слайдом (строка или две, до 15 слов):
// решают первые 1–2 секунды. opts.top — мелкая надпись над остальными.
// opts.tops / opts.big — свои надписи по кадрам (общие ролики о странице).
async function renderReel(slides, opts) {
  const o = opts || {};
  const list = (slides || []).filter(Boolean);
  if (list.length < 2) throw new Error("мало слайдов для Reels");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reel-"));
  try {
    const dur = list.map((_, i) => (i === list.length - 1 ? 3.5 : i === 0 ? 2.6 : 2.0));
    const fade = 0.35;
    // Голос начинается через 0,3 с; ролик — на секунду длиннее голоса:
    // недостающее время раздаём фото посередине.
    const voiceLen = o.voice ? wavSeconds(o.voice) : 0;
    const need = voiceLen ? voiceLen + 1.3 : 0;
    const have = dur.reduce((a, b) => a + b, 0);
    if (need > have && list.length > 2) {
      const add = (need - have) / (list.length - 2);
      for (let i = 1; i < list.length - 1; i++) dur[i] += add;
    }
    const total = dur.reduce((a, b) => a + b, 0);
    const music = o.music === false ? null : pickMusic();
    list.forEach((b, i) => fs.writeFileSync(path.join(dir, i + ".png"), toPng(frameSvg(b, o.tops ? o.tops[i] : i === 0 ? o.hook : i === list.length - 1 ? null : o.top, o.tops ? !!(o.big && o.big[i]) : i === 0))));
    const args = ["-y", "-loglevel", "error"];
    // Каждый кадр — одна картинка: zoompan сам растягивает её на d кадров
    // (с -loop он делал бы d кадров из каждого повтора — в сотни раз дольше).
    list.forEach((_, i) => args.push("-i", path.join(dir, i + ".png")));
    // Наезд: увеличиваем вдвое и плавно приближаем до 6% — так zoompan не дрожит.
    const f = [];
    list.forEach((_, i) => {
      const frames = Math.round((dur[i] + fade) * FPS);
      f.push(`[${i}:v]scale=${W * 2}:${H * 2},zoompan=z='min(zoom+0.0009,1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS},format=yuv420p,setsar=1[v${i}]`);
    });
    let last = "v0", t = 0;
    for (let i = 1; i < list.length; i++) {
      t += dur[i - 1];
      const out = i === list.length - 1 ? "vout" : "x" + i;
      f.push(`[${last}][v${i}]xfade=transition=fade:duration=${fade}:offset=${t.toFixed(2)}[${out}]`);
      last = out;
    }
    let ai = list.length;
    const mix = [];
    if (o.voice) {
      fs.writeFileSync(path.join(dir, "voice.wav"), o.voice);
      args.push("-i", path.join(dir, "voice.wav"));
      f.push(`[${ai}:a]adelay=300|300,aformat=sample_rates=44100:channel_layouts=stereo[va]`);
      mix.push("[va]"); ai++;
    }
    if (music) {
      args.push("-i", music);
      // Под голосом музыка тихо, без голоса — заметнее; в конце затухает.
      f.push(`[${ai}:a]atrim=0:${total.toFixed(2)},aformat=sample_rates=44100:channel_layouts=stereo,volume=${o.voice ? 0.13 : 0.5},afade=t=in:d=0.5,afade=t=out:st=${(total - 1.5).toFixed(2)}:d=1.5[ma]`);
      mix.push("[ma]"); ai++;
    }
    if (mix.length) f.push(`${mix.join("")}amix=inputs=${mix.length}:duration=longest:normalize=0,atrim=0:${total.toFixed(2)}[aout]`);
    const outFile = path.join(dir, "reel.mp4");
    args.push("-filter_complex", f.join(";"), "-map", "[vout]");
    if (mix.length) args.push("-map", "[aout]", "-c:a", "aac", "-b:a", "128k");
    args.push(
      "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-profile:v", "high", "-pix_fmt", "yuv420p",
      "-r", String(FPS), "-movflags", "+faststart", outFile);
    await run(ffmpegPath(), args);
    return fs.readFileSync(outFile);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Зацеп первого кадра (до 15 слов): что, за сколько и почему смотреть —
// цена крупно, вторая строка — довод: дешевле соседей или «от хозяина».
function reelHook(f) {
  const r = ROOMS_NOM[f.rooms];
  const what = "Продаю " + (r ? r + "-комнатную" : "квартиру") + " · " + placeOf(f).replace(/^(в микрорайоне|на улице) /, "");
  const why = belowMarket(f) ? "Ниже рынка" + (f.mortgage ? " · можно в ипотеку" : " · от хозяина")
    : f.mortgage ? "От хозяина · можно в ипотеку" : "От хозяина";
  return [what, why];
}
const TOP = "Поставьте «+», чтобы получить контакты";

// --- Звук ------------------------------------------------------------------
function pickMusic() {
  try {
    const all = fs.readdirSync(MUSIC_DIR).filter((x) => /\.mp3$/i.test(x));
    return all.length ? path.join(MUSIC_DIR, all[Math.floor(Math.random() * all.length)]) : null;
  } catch { return null; }
}
// Длина WAV (PCM) в секундах — по заголовку.
function wavSeconds(b) {
  const rate = b.readUInt32LE(24), ch = b.readUInt16LE(22) || 1, bits = b.readUInt16LE(34) || 16;
  return (b.length - 44) / (rate * ch * bits / 8);
}
function geminiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  try { return fs.readFileSync(path.join(os.homedir(), ".gemini-key"), "utf8").trim() || null; } catch { return null; }
}
async function gemini(model, body) {
  const key = geminiKey();
  if (!key) throw new Error("no_gemini_key");
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent", {
    method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(90000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(model + ": " + ((j.error && j.error.message) || "HTTP " + r.status));
  return j;
}

// От лица продавца: «Продаю…», в конце — «отправлю информацию и номер».
// Цену в ролике не называем — её получают вместе с номером после «+».
// Призыв — слово в слово, как попросили; «вариантах ипотеки» — только у ипотечных.
const CTA = (f) => "Чтобы узнать больше о квартире, стоимости" + (f && f.mortgage ? " и вариантах ипотеки" : "") +
  ", поставьте плюс в комментариях к этому посту — отправлю в личку.";
const ROOMS_NOM = { 1: "1", 2: "2", 3: "3", 4: "4", 5: "5" };
// Ниже рынка — если метр дешевле похожих (своя оценка или карточка).
const belowMarket = (f) => (Number(f.below) || 0) >= 3 || /дешевле/i.test(String((f.card || {}).price || ""));
// На сколько процентов ниже рынка: своя оценка или «Метр на 9,1% дешевле…» из карточки.
function belowPct(f) {
  if (Number(f.below) >= 3) return Math.round(Number(f.below));
  const m = String((f.card || {}).price || "").match(/(\d+(?:[.,]\d+)?)\s*%/);
  const v = m ? Math.round(Number(m[1].replace(",", "."))) : 0;
  return v >= 3 ? v : 0;
}
// Начало ролика — одинаковое и проверенное, не на усмотрение модели: что,
// где, насколько ниже рынка (без цены), и ипотека — Отбасы и БВУ.
function opening(f) {
  const pct = belowPct(f);
  return "Продаю " + (ROOMS[f.rooms] || "") + " квартиру " + placeOf(f) + (pct ? " — на " + pct + "% ниже рынка" : belowMarket(f) ? " ниже рыночной стоимости" : "") + "." +
    (f.mortgage ? " Проходит ипотеку в Отбасы банке и других банках второго уровня." : "");
}
// Цена так, как её говорят: «54 миллиона 700 тысяч тенге». «54,7 миллиона»
// голос иногда читал неверно (54,5), целые числа — без ошибок.
const plural = (n, a, b, c) => { const m = n % 100, k = n % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k > 1 && k < 5 ? b : c; };
function priceWords(p) {
  const t = Math.round(Number(p) / 1000), mln = Math.floor(t / 1000), th = t % 1000;
  return (mln ? mln + " " + plural(mln, "миллион", "миллиона", "миллионов") : "") +
    (th ? (mln ? " " : "") + th + " " + plural(th, "тысяча", "тысячи", "тысяч") : "") + " тенге";
}
// Текст за кадром: 30–45 слов, зацеп → польза → призыв. Только факты из
// объявления (Gemini получает их списком и ничего не добавляет от себя);
// без «посредников» и названий сайтов. Не вышло — простой текст по шаблону.
function factsOf(f) {
  const c = f.card || {};
  return [
    f.rooms ? f.rooms + "-комнатная квартира" : "квартира",
    "где: " + placeOf(f),
    f.area ? "площадь " + String(f.area).replace(".", ",") + " м²" : null,
    f.floor ? "этаж " + f.floor + (f.floors ? " из " + f.floors : "") : null,
    f.isNew ? "новостройка" : null,
  ].concat((c.desc || []).slice(0, 6).map((t) => "из описания: " + t), (c.params || []).slice(0, 6),
    (f.chips || []).slice(0, 7).map((t) => "рядом: " + t)).filter(Boolean);
}
// Где квартира, как её называют: «в микрорайоне Самал-1», «на улице Розыбакиева».
function placeOf(f) {
  const a = String(f.addr || "").split(" — ")[0].split(",")[0].trim();
  // Название — всё до первого номера дома: «Самал-1 1» → «Самал-1», «Халиулина 140/6 кор6» → «Халиулина».
  const name = (t) => t.split(/\s+(?=\d)/)[0].trim();
  if (!a) return "в Алматы";
  const m = a.match(/^мкр\.?\s*(.+)$/i);
  if (m) return "в микрорайоне " + name(m[1]);
  return "на улице " + name(a.replace(/^(ул\.?|улица|пр\.?|проспект)\s*/i, ""));
}
const ROOMS = { 1: "однокомнатную", 2: "двухкомнатную", 3: "трёхкомнатную", 4: "четырёхкомнатную", 5: "пятикомнатную" };
function fallbackScript(f) {
  const c = f.card || {};
  const plus = [].concat(c.desc || [], c.params || []).slice(0, 3).join(", ");
  const near = (f.chips || []).slice(0, 2).map((t) => t.replace(/ — .*$/, "")).join(", ");
  return opening(f) + (plus ? " " + plus + "." : "") + (near ? " Рядом: " + near + "." : "") + " " + CTA(f);
}
async function reelScript(f) {
  // Модель пишет только середину: плюсы, кому подходит, что рядом. Начало
  // (opening) и призыв (CTA) — наши, слово в слово.
  try {
    const j = await gemini(process.env.GEMINI_MODEL || "gemini-3.7-flash", {
      contents: [{ role: "user", parts: [{ text: "Факты о квартире:\n- " + factsOf(f).join("\n- ") }] }],
      system_instruction: { parts: [{ text:
        "Ты пишешь середину текста за кадром для Reels: говорит сам продавец квартиры в Алматы, от первого лица, по-русски, живо и просто, как человек, а не реклама. " +
        "Начало («Продаю … квартиру …, проходит ипотеку…») и призыв в конце уже есть — их НЕ пиши. Напиши 3 коротких предложения, всего 25–40 слов: " +
        "1) 2–3 главных плюса самой квартиры и дома (ремонт, планировка, потолки, дом, двор, парковка — что есть в списке); " +
        "2) что рядом — 2–3 места из пунктов «рядом» с минутами пешком (детсад, школа, супермаркет, метро, парк); " +
        "3) кому подходит: для жизни семьёй или под инвестиции и сдачу в аренду — выбери по фактам (1-комнатная, студия, рядом метро или ТРЦ — хорошо сдаётся; 3 комнаты и больше, школы и сады рядом — для семьи; можно назвать оба, если подходят). " +
        "ЦЕНУ НЕ НАЗЫВАЙ — ни суммы, ни миллионов, ни тенге, ни процентов. Используй ТОЛЬКО факты из списка, ничего не придумывай. " +
        "Только настоящее время и формы без рода: «продаю», без «продала/продал». Не говори «без посредников», «агент», не называй сайты. " +
        "Числа пиши как произносят: «5 минут пешком», «3,3 метра». Без эмодзи, хэштегов, кавычек и списков. Ответь только текстом." }] },
      // Модель думает перед ответом — запас токенов, иначе текст обрывается.
      generationConfig: { temperature: 0.7, maxOutputTokens: 4000 },
    });
    const c = ((j.candidates || [])[0] || {}).content;
    let t = c && c.parts ? c.parts.map((p) => p.text || "").join("").trim() : "";
    t = t.replace(/[«»"*#]/g, "").replace(/^\s*[-•\d.)]+\s*/gm, "").replace(/\s+/g, " ").trim();
    const words = t.split(" ").length;
    if (!t || words < 10 || words > 60 || /посредник|крыш|krisha|агент|миллион|тенге|₸|%|поставьте плюс|продаю/i.test(t)) return fallbackScript(f);
    return opening(f) + " " + t + " " + CTA(f);
  } catch (e) {
    console.log("[reel] текст: " + e.message);
    return fallbackScript(f);
  }
}
// Озвучка: Gemini TTS, голос — app_config insta.reel_voice (по умолчанию Kore).
// Возвращает WAV; Gemini отдаёт то готовый WAV (бывает WAV внутри WAV), то сырой PCM.
async function tts(text, voice) {
  const j = await gemini(process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-tts", {
    // Только сам текст: подводку о манере («прочитай энергично…», и
    // по-английски тоже) модель время от времени зачитывала вслух (проверено
    // расшифровкой 11.10.2026). Без неё голос Kore и так звучит живо.
    contents: [{ parts: [{ text: text }] }],
    generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice || "Kore" } } } },
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
// Проверка озвучки: расшифровываем и смотрим, что призыв прозвучал, цены нет
// и нет посторонних слов (служебной подводки) в начале.
async function voiceOk(wav, f) {
  const j = await gemini(process.env.GEMINI_MODEL || "gemini-3.7-flash", {
    contents: [{ parts: [{ inlineData: { mimeType: "audio/wav", data: wav.toString("base64") } }, { text: "Дословно расшифруй речь, числа цифрами. Только текст." }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 3000 },
  });
  const c = ((j.candidates || [])[0] || {}).content;
  const t = (c && c.parts ? c.parts.map((p) => p.text || "").join("") : "").replace(/\s+/g, " ");
  // Цены в ролике нет — проверяем, что голос её и не выдумал, и что призыв прозвучал.
  return !/миллион|тенге|\b(say|tone|pace)\b|прочитай/i.test(t) && /плюс/i.test(t);
}
// Текст + голос для ролика; до двух попыток озвучки с проверкой. Не вышло —
// wav: null (ролик выйдет с одной музыкой).
async function reelVoice(f, voice) {
  const text = await reelScript(f);
  for (let i = 0; i < 2; i++) {
    try {
      const wav = await tts(text, voice);
      if (await voiceOk(wav, f).catch(() => true)) return { text: text, wav: wav };
      console.log("[reel] озвучка не прошла проверку, попытка " + (i + 1));
    } catch (e) { console.log("[reel] голос: " + e.message); }
  }
  return { text: text, wav: null };
}

// Подпись ролика — коротко и тем же голосом, что за кадром: без цены и номера
// объявления; рубрика, одна строка о квартире, призыв, хэштеги.
function reelCaption(f, tags) {
  const rubric = "🔑 От хозяина" + (f.mortgage ? " · можно в ипотеку" : "") + (belowMarket(f) ? " · ниже рынка" : "");
  const what = opening(f);
  return [rubric, "", what, "", "👉 " + CTA(f).replace("поставьте плюс", "поставьте «+»"), "", tags || ""].join("\n").trim();
}

module.exports = { renderReel, reelHook, reelVoice, reelScript, reelCaption, priceWords, tts, TOP };
