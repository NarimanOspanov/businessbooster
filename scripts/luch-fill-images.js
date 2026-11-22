// Картинки к лекциям Open School, которых ещё нет: OpenAI gpt-image-1.5 low (1536×1024) → JPEG 960 →
// Azure Blob Storage (luch/img/<sha1(story_key)>_<номер>.jpg, контейнер photos); в luch.story_image — только ключ (data = 0x).
// Медиа в базе не храним. Берём разделы без формул и без схемы (как на сайте), уже готовые не трогаем.
//   node scripts/luch-fill-images.js            — все недостающие
//   LIMIT=50 node scripts/luch-fill-images.js   — первые 50
// Ключ OpenAI: OPENAI_API_KEY или ~/.openaikey; хранилище: AZURE_STORAGE_CONNECTION или ~/.azure-storage.
const fs = require("fs"), path = require("path"), os = require("os"), crypto = require("crypto"), { spawn } = require("child_process");
const db = require("./db.js"), sql = require("mssql"), blob = require("./azure-blob.js");
const FF = require("ffmpeg-static");
const OKEY = (process.env.OPENAI_API_KEY || fs.readFileSync(path.join(os.homedir(), ".openaikey"), "utf8")).trim();
const STYLE = "Яркая познавательная иллюстрация к уроку. Цифровая живопись в стиле современной иллюстрированной энциклопедии: мягкий свет, тёплые сочные цвета, понятные формы, широкий кадр. Никаких надписей, букв, цифр и подписей на картинке.";
const LIMIT = +process.env.LIMIT || Infinity, CONC = 2;
const blobName = (key, i) => "luch/img/" + crypto.createHash("sha1").update(key).digest("hex") + "_" + i + ".jpg";
const shrink = (buf) => new Promise((res) => {
  const p = spawn(FF, ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-vf", "scale='min(960,iw)':-2", "-q:v", "6", "-f", "mjpeg", "pipe:1"]);
  const out = []; p.stdout.on("data", (d) => out.push(d)); p.on("close", (c) => { const o = Buffer.concat(out); res(c === 0 && o.length > 1000 ? o : null); }); p.stdin.on("error", () => {}); p.stdin.end(buf);
});
async function gen(prompt) {
  for (let a = 0; a < 3; a++) {
    const r = await fetch("https://api.openai.com/v1/images/generations", { method: "POST", headers: { Authorization: "Bearer " + OKEY, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-image-1.5", prompt, size: "1536x1024", quality: "low", n: 1 }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return Buffer.from(j.data[0].b64_json, "base64");
    const msg = JSON.stringify(j.error || j).slice(0, 200);
    if (r.status === 429 || r.status >= 500) { await new Promise((s) => setTimeout(s, 5000 * (a + 1))); continue; }
    throw new Error(r.status + " " + msg);
  }
  throw new Error("retries");
}
(async () => {
  if (!blob.config()) throw new Error("нет строки подключения к хранилищу");
  const pool = await db.getPool();
  const rows = (await pool.request().query("SELECT story_key, body_json FROM luch.lesson_story WHERE story_key LIKE '/labs/%|ru|f4'")).recordset;
  const have = new Set((await pool.request().query("SELECT story_key + '#' + CAST(idx AS varchar) k FROM luch.story_image")).recordset.map((x) => x.k));
  const todo = [];
  for (const r of rows) JSON.parse(r.body_json).sections.forEach((s, i) => {
    if (s.formulas || s.scheme || i > 7 || have.has(r.story_key + "#" + i)) return;
    todo.push({ k: r.story_key, i, scene: s.img || (s.title + ". " + s.text) });
  });
  const list = todo.slice(0, LIMIT);
  console.log("нужно картинок", todo.length, "делаю", list.length);
  let ok = 0, fail = 0, n = 0;
  const worker = async () => {
    while (n < list.length) {
      const t = list[n++];
      try {
        const jpg = await shrink(await gen(STYLE + "\nСюжет: " + t.scene));
        if (!jpg) throw new Error("ffmpeg");
        await blob.put(blobName(t.k, t.i), jpg, "image/jpeg");
        await pool.request().input("k", sql.NVarChar(300), t.k).input("i", sql.TinyInt, t.i).input("m", sql.VarChar(40), "image/jpeg")
          .query("IF NOT EXISTS (SELECT 1 FROM luch.story_image WHERE story_key = @k AND idx = @i) INSERT luch.story_image (story_key, idx, mime, data) VALUES (@k, @i, @m, 0x)");
        ok++;
      } catch (e) { fail++; console.log("ERR", t.k, t.i, e.message); if (/insufficient_quota|billing/i.test(e.message)) n = list.length; }
      if ((ok + fail) % 25 === 0) console.log("готово", ok, "ошибок", fail, "из", list.length);
    }
  };
  await Promise.all(Array.from({ length: CONC }, worker));
  console.log("ИТОГ: записано", ok, "ошибок", fail);
  process.exit(0);
})().catch((e) => { console.log("FATAL", e.message); process.exit(1); });
