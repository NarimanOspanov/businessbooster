// То же, что scripts/luch-fill-images.js, но рисует Gemini (gemini-2.5-flash-image, 3:2) — когда у OpenAI нет кредитов.
// Картинки к лекциям, которых ещё нет → JPEG 960 → Azure Blob Storage (luch/img/<sha1(story_key)>_<номер>.jpg, контейнер photos);
// в luch.story_image — только ключ (data = 0x). Берём разделы без формул и без схемы (как на сайте), уже готовые не трогаем.
//   node scripts/luch-fill-images-gemini.js                 — все недостающие
//   LIMIT=50 node scripts/luch-fill-images-gemini.js        — первые 50
//   ONLY=/prof/fde/ node scripts/luch-fill-images-gemini.js — только лекции карты FDE (в Git Bash — с MSYS_NO_PATHCONV=1)
//   FIX_BARS=1 ONLY=/prof/fde/ node scripts/luch-fill-images-gemini.js — уже готовые картинки: обрезать пустые поля по краям
// Gemini иногда рисует картинку с однотонными полями по краям — их находим и обрезаем перед сжатием.
// Ключ Gemini: GEMINI_API_KEY или ~/.gemini-key; хранилище: AZURE_STORAGE_CONNECTION или ~/.azure-storage. ≈ $0.04 за картинку.
const fs = require("fs"), path = require("path"), os = require("os"), crypto = require("crypto"), { spawn } = require("child_process");
const db = require("./db.js"), sql = require("mssql"), blob = require("./azure-blob.js");
const FF = require("ffmpeg-static");
const GKEY = (process.env.GEMINI_API_KEY || fs.readFileSync(path.join(os.homedir(), ".gemini-key"), "utf8")).trim();
const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
const STYLE = "Яркая познавательная иллюстрация к уроку. Цифровая живопись в стиле современной иллюстрированной энциклопедии: мягкий свет, тёплые сочные цвета, понятные формы, широкий кадр. Никаких надписей, букв, цифр и подписей на картинке.";
// Gemini без этого часто дописывает заголовок на картинку и рисует поля сверху и снизу
const NOTEXT = "Strictly no text, letters, numbers, captions, signs or logos anywhere in the image. Painterly digital illustration, not a flat vector infographic. The scene fills the whole canvas edge to edge: full-bleed, no empty margins, no letterbox bars, no frame or border.";
const LIMIT = +process.env.LIMIT || Infinity, CONC = 2;
const blobName = (key, i) => "luch/img/" + crypto.createHash("sha1").update(key).digest("hex") + "_" + i + ".jpg";
// однотонные поля по краям: доли ширины/высоты слева, справа, сверху, снизу (по уменьшенной серой копии)
const BW = 192, BH = 128;
const grayRaw = (buf) => new Promise((res) => {
  const p = spawn(FF, ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-vf", "scale=" + BW + ":" + BH + ",format=gray", "-f", "rawvideo", "pipe:1"]);
  const out = []; p.stdout.on("data", (d) => out.push(d)); p.on("close", () => res(Buffer.concat(out))); p.stdin.on("error", () => {}); p.stdin.end(buf);
});
const flat = (v) => { const m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) < 5; };
async function bars(buf) {
  const r = await grayRaw(buf); if (r.length < BW * BH) return { l: 0, r: 0, t: 0, b: 0 };
  const col = (x) => flat(Array.from({ length: BH }, (_, y) => r[y * BW + x])), row = (y) => flat(Array.from({ length: BW }, (_, x) => r[y * BW + x]));
  let l = 0, rr = 0, t = 0, b = 0;
  while (l < BW / 3 && col(l)) l++; while (rr < BW / 3 && col(BW - 1 - rr)) rr++; while (t < BH / 3 && row(t)) t++; while (b < BH / 3 && row(BH - 1 - b)) b++;
  return { l: l / BW, r: rr / BW, t: t / BH, b: b / BH };
}
const cropOf = (m) => { if (Math.max(m.l, m.r, m.t, m.b) < 0.01) return ""; const e = (x) => (x ? x + 0.01 : 0); const l = e(m.l), r = e(m.r), t = e(m.t), b = e(m.b);
  return "crop=iw*" + (1 - l - r).toFixed(4) + ":ih*" + (1 - t - b).toFixed(4) + ":iw*" + l.toFixed(4) + ":ih*" + t.toFixed(4) + ","; };
const shrink = async (buf) => { const crop = cropOf(await bars(buf)); if (crop) console.log("  поля обрезаны:", crop); return shrinkRaw(buf, crop); };
const shrinkRaw = (buf, crop) => new Promise((res) => {
  const p = spawn(FF, ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-vf", (crop || "") + "scale='min(960,iw)':-2", "-q:v", "6", "-f", "mjpeg", "pipe:1"]);
  const out = []; p.stdout.on("data", (d) => out.push(d)); p.on("close", (c) => { const o = Buffer.concat(out); res(c === 0 && o.length > 1000 ? o : null); }); p.stdin.on("error", () => {}); p.stdin.end(buf);
});
async function gen(prompt) {
  let last = "";
  for (let a = 0; a < 4; a++) {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent?key=" + GKEY, { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(150000),
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "3:2" } } }) }).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: e.message }) }));
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      const parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
      const im = parts.find((p) => p.inlineData || p.inline_data);
      if (im) return Buffer.from((im.inlineData || im.inline_data).data, "base64");
      last = "no image " + JSON.stringify((j.candidates || [])[0] || j).slice(0, 160); // иногда отвечает текстом — пробуем ещё раз
      continue;
    }
    last = r.status + " " + JSON.stringify(j.error || j).slice(0, 200);
    if (r.status === 0 || r.status === 429 || r.status >= 500) { await new Promise((s) => setTimeout(s, 5000 * (a + 1))); continue; }
    throw new Error(last);
  }
  throw new Error("retries: " + last);
}
// уже готовые картинки с полями: скачать из хранилища, обрезать, положить обратно под тем же именем
async function fixBars(pool) {
  const rows = (await pool.request().query("SELECT story_key, idx FROM luch.story_image WHERE DATALENGTH(data) = 0")).recordset.filter((x) => !process.env.ONLY || x.story_key.startsWith(process.env.ONLY));
  let fixed = 0;
  for (const r of rows) {
    const name = blobName(r.story_key, r.idx), res = await fetch(blob.publicUrl(name)).catch(() => null);
    if (!res || !res.ok) { console.log("нет файла", r.story_key, r.idx); continue; }
    const buf = Buffer.from(await res.arrayBuffer()), crop = cropOf(await bars(buf));
    if (!crop) continue;
    const jpg = await shrinkRaw(buf, crop); if (!jpg) continue;
    await blob.put(name, jpg, "image/jpeg"); fixed++; console.log("обрезал", r.story_key, r.idx, crop);
  }
  console.log("ИТОГ: проверено", rows.length, "обрезано", fixed); process.exit(0);
}
(async () => {
  if (!blob.config()) throw new Error("нет строки подключения к хранилищу");
  const pool = await db.getPool();
  if (process.env.FIX_BARS) return fixBars(pool);
  // картинки общие для языков и хранятся под русским ключом; лекцию, которую открывали только на казахском, рисуем по её тексту
  const all = (await pool.request().query("SELECT story_key, body_json FROM luch.lesson_story WHERE story_key LIKE '%|ru|f4' OR story_key LIKE '%|kk|f4'")).recordset;
  const byRu = new Map();
  for (const r of all) { const ru = r.story_key.replace(/\|kk\|f4$/, "|ru|f4"); if (r.story_key === ru || !byRu.has(ru)) byRu.set(ru, { story_key: ru, body_json: r.body_json }); }
  const rows = [...byRu.values()];
  const have = new Set((await pool.request().query("SELECT story_key + '#' + CAST(idx AS varchar) k FROM luch.story_image")).recordset.map((x) => x.k));
  const todo = [];
  for (const r of rows) (JSON.parse(r.body_json).sections || []).forEach((s, i) => {
    if (s.formulas || (s.scheme && r.story_key.startsWith("/labs/")) || i > 7 || have.has(r.story_key + "#" + i)) return; // схема опыта есть только в лабораториях; на страницах разделов — картинка
    todo.push({ k: r.story_key, i, scene: s.img || (s.title + ". " + s.text) });
  });
  const list = todo.filter((t) => !process.env.ONLY || t.k.startsWith(process.env.ONLY)).slice(0, LIMIT);
  console.log("нужно картинок", todo.length, "делаю", list.length);
  let ok = 0, fail = 0, n = 0;
  const worker = async () => {
    while (n < list.length) {
      const t = list[n++];
      try {
        const jpg = await shrink(await gen(STYLE + "\nСюжет: " + t.scene + "\n" + NOTEXT));
        if (!jpg) throw new Error("ffmpeg");
        await blob.put(blobName(t.k, t.i), jpg, "image/jpeg");
        await pool.request().input("k", sql.NVarChar(300), t.k).input("i", sql.TinyInt, t.i).input("m", sql.VarChar(40), "image/jpeg")
          .query("IF NOT EXISTS (SELECT 1 FROM luch.story_image WHERE story_key = @k AND idx = @i) INSERT luch.story_image (story_key, idx, mime, data) VALUES (@k, @i, @m, 0x)");
        ok++;
      } catch (e) { fail++; console.log("ERR", t.k, t.i, e.message); if (/billing|quota|API key/i.test(e.message) && !/429/.test(e.message)) n = list.length; }
      if ((ok + fail) % 25 === 0) console.log("готово", ok, "ошибок", fail, "из", list.length);
    }
  };
  await Promise.all(Array.from({ length: CONC }, worker));
  console.log("ИТОГ: записано", ok, "ошибок", fail);
  process.exit(0);
})().catch((e) => { console.log("FATAL", e.message); process.exit(1); });
