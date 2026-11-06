// Reels из одного поста канала: его картинка, его заголовок и его текст,
// прочитанный собственным голосом из ElevenLabs.
//
// Это не второй конвейер: кадр, наезд, музыку, субтитры и сборку делает тот же
// renderReel, что и Reels по квартирам. Здесь только три вещи, которых у него
// нет: речь нужным голосом, подготовка текста к чтению вслух и три кадра из
// одной картинки — renderReel требует минимум два слайда, а у поста снимок один.
//
// Проверить без сервера:
//   node scripts/post-reel.js --image pic.jpg --headline "Заголовок" \
//        --body "Текст поста" --out reel.mp4

const fs = require("fs");
const { renderReel } = require("./insta-reel.js");

const ELEVEN = "https://api.elevenlabs.io/v1";
// Клон живёт в личном кабинете ElevenLabs. Ищем его ПО ИМЕНИ, а не по
// зашитому id: голос можно пересоздать, и тогда id меняется, а имя остаётся —
// зашитый id тихо превратился бы в чужой голос в эфире.
const VOICE_NAME = process.env.REEL_VOICE_NAME || "Нариман";
const TTS_MODEL = process.env.ELEVEN_TTS_MODEL || "eleven_multilingual_v2";
// Дальше этого голос уже не ролик, а лекция: лента такое не досматривает.
const MAX_CHARS = Number(process.env.REEL_MAX_CHARS || 420);

function apiKey() {
  const k = process.env.ELEVENLABS_API_KEY
    || (process.env.ELEVENLABS_KEY_FILE && fs.existsSync(process.env.ELEVENLABS_KEY_FILE)
        ? fs.readFileSync(process.env.ELEVENLABS_KEY_FILE, "utf8").trim() : "");
  if (!k) throw new Error("ELEVENLABS_API_KEY не задан");
  return k;
}

let voiceCache = null;
async function voiceId(name) {
  const want = String(name || VOICE_NAME).trim().toLowerCase();
  if (voiceCache && voiceCache.name === want) return voiceCache.id;
  const r = await fetch(ELEVEN + "/voices", { headers: { "xi-api-key": apiKey() } });
  if (!r.ok) throw new Error("ElevenLabs /voices: " + r.status);
  const list = ((await r.json()) || {}).voices || [];
  const hit = list.find((v) => String(v.name || "").trim().toLowerCase() === want);
  if (!hit) {
    throw new Error(`в аккаунте ElevenLabs нет голоса «${name || VOICE_NAME}» (есть: ${list.map((v) => v.name).join(", ").slice(0, 160)})`);
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
    headers: { "xi-api-key": apiKey(), "Content-Type": "application/json" },
    body: JSON.stringify({
      text: text,
      model_id: TTS_MODEL,
      // Ровная подача: ролик читают поверх музыки, и прыгающая интонация там
      // слышна как брак, а не как живость.
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.1, use_speaker_boost: true },
    }),
  });
  if (!r.ok) throw new Error("ElevenLabs TTS: " + r.status + " " + (await r.text()).slice(0, 160));
  return wavOf(Buffer.from(await r.arrayBuffer()), 24000);
}

/**
 * Текст поста — в текст для чтения вслух.
 *
 * Голос не должен читать ссылку, решётку и строку с источником: вслух это шум,
 * а на субтитрах — каша. Режем по границе предложения, а не по букве.
 */
function speakable(headline, body) {
  const clean = String(body || "")
    // Ссылку забираем ВМЕСТЕ с окружающими скобками и без закрывающей скобки
    // внутри: жадное \S+ съедало «).» в «агентство bloomberg (https://…).» и
    // оставляло висеть открытую скобку, которую голос читал как паузу.
    .replace(/\s*\(?\s*https?:\/\/[^\s)]+\s*\)?/g, " ")
    .replace(/\(\s*\)/g, "")
    .replace(/^[ \t]*[📰🗞👉🔗▪️•]+[ \t]*/gmu, "")
    .replace(/#[^\s#]+/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    // Пробел, оставшийся перед знаком препинания на месте вырезанной ссылки.
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();
  const head = String(headline || "").trim().replace(/[.!?]+$/, "");
  let text = head ? head + ". " + clean : clean;
  if (text.length > MAX_CHARS) {
    const cut = text.slice(0, MAX_CHARS);
    const stop = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("!"), cut.lastIndexOf("?"));
    text = (stop > MAX_CHARS * 0.5 ? cut.slice(0, stop + 1) : cut.replace(/\s+\S*$/, "") + "…");
  }
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Заголовок — в две строки.
 *
 * frameSvg подбирает кегль так, чтобы строка влезла в 880 px, и для новостного
 * заголовка в сорок с лишним знаков упирается в минимальные 30 px — в ленте это
 * нечитаемо. Он писался под короткие строки вроде «2 комн · 42 млн». Две строки
 * примерно поровну дают знаков по двадцать и кегль под 58.
 */
function twoLines(text) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  if (words.join(" ").length <= 22) return words.join(" ");
  let best = null;
  for (let i = 1; i < words.length; i += 1) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    // Ровные строки читаются лучше рваных, а длинная строка задаёт кегль обеим.
    const score = Math.abs(a.length - b.length) + Math.max(0, Math.max(a.length, b.length) - 26) * 4;
    if (!best || score < best.score) best = { score, lines: [a, b] };
  }
  return best.lines;
}

/**
 * Ролик по одному посту.
 *
 * `image` — снимок поста (Buffer). Он один, а слайдов нужно минимум два, так что
 * кадр повторяется: на первом крупно заголовок, дальше его место занимают
 * субтитры, на последнем — отсылка к каналу. Наезд у renderReel свой на каждый
 * слайд, поэтому повтор одной картинки читается как смена плана, а не как стоп-кадр.
 */
async function postReel({ headline, body, image, voiceName, channel, music }) {
  if (!image || !image.length) throw new Error("нет картинки поста");
  const text = speakable(headline, body);
  if (text.length < 40) throw new Error("слишком короткий текст для озвучки");
  const voice = await speak(text, { name: voiceName });
  const tail = channel ? "Подробнее в " + String(channel).replace(/^@?/, "@") : null;
  return renderReel([image, image, image], {
    voice: voice,
    subs: text,
    tops: [twoLines(headline), null, tail],
    big: [true, false, false],
    music: music !== false,
    tempo: 1.06,
  });
}

module.exports = { postReel, speak, speakable, voiceId };

if (require.main === module) {
  const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i > 0 ? process.argv[i + 1] : d; };
  (async () => {
    const out = arg("out", "reel.mp4");
    const mp4 = await postReel({
      headline: arg("headline", ""),
      body: arg("body", ""),
      image: fs.readFileSync(arg("image")),
      channel: arg("channel", ""),
      voiceName: arg("voice", ""),
      music: arg("music") !== "no",
    });
    fs.writeFileSync(out, mp4);
    console.log("готово:", out, (mp4.length / 1048576).toFixed(1), "МБ");
  })().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
}
