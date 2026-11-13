// Озвучка роликов-объяснений «Луч»: для каждой сцены из <раздел>/reel-scenes.js
// делает <раздел>/reels/<урок>-<n>.mp3 голосом ElevenLabs и пишет длительности
// в <раздел>/reels/durations.json. Озвучивает только сцены, у которых поменялся текст.
//   node scripts/luch-reels-audio.js optics mechanics [--force]
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const VOICE = process.env.LUCH_REEL_VOICE || "kwajW3Xh5svCeKU5ky2S"; // Дмитрий: молодой русский голос для соцсетей
const MODEL = process.env.LUCH_REEL_MODEL || "eleven_v3"; // v3 понимает [теги] интонации
const key = (process.env.ELEVENLABS_API_KEY || fs.readFileSync(path.join(os.homedir(), ".elevenlabs-key"), "utf8")).trim();
const force = process.argv.includes("--force");
const sections = process.argv.slice(2).filter((a) => !a.startsWith("--"));

async function speak(text) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: MODEL, voice_settings: { stability: 0.5 } }),
  });
  if (!r.ok) throw new Error("ElevenLabs " + r.status + " " + (await r.text()).slice(0, 200));
  return Buffer.from(await r.arrayBuffer());
}

(async () => {
  for (const sec of sections) {
    const ctx = { window: {} };
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, sec, "reel-scenes.js"), "utf8"), ctx);
    const scenes = ctx.window.LUCH_REEL_SCENES;
    const dir = path.join(ROOT, sec, "reels");
    fs.mkdirSync(dir, { recursive: true });
    const durFile = path.join(dir, "durations.json"), hashFile = path.join(dir, "texts.json");
    const durs = fs.existsSync(durFile) ? JSON.parse(fs.readFileSync(durFile, "utf8")) : {};
    const hashes = fs.existsSync(hashFile) ? JSON.parse(fs.readFileSync(hashFile, "utf8")) : {};
    for (const [lesson, list] of Object.entries(scenes)) {
      for (let i = 0; i < list.length; i++) {
        const k = `${lesson}-${i}`, file = path.join(dir, k + ".mp3");
        const h = crypto.createHash("sha1").update(VOICE + MODEL + list[i].say).digest("hex").slice(0, 12);
        if (!force && hashes[k] === h && fs.existsSync(file)) continue;
        const mp3 = await speak(list[i].say);
        fs.writeFileSync(file, mp3);
        durs[k] = Math.round((mp3.length * 8 / 128000) * 100) / 100; // 128 кбит/с, постоянный битрейт
        hashes[k] = h;
        console.log(sec, k, durs[k] + " с");
      }
    }
    fs.writeFileSync(durFile, JSON.stringify(durs, null, 1));
    fs.writeFileSync(hashFile, JSON.stringify(hashes, null, 1));
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
