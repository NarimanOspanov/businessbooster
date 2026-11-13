// Запись роликов «Луч» в mp4 1080×1920 для Instagram Reels: открывает страницу раздела
// в Chrome, покадрово прогоняет ролик (LuchReel.open(id, { render: true }).at(t)),
// склеивает кадры и озвучку <раздел>/reels/<урок>-<n>.mp3 через ffmpeg.
//   LUCH_TOOLS=<папка с node_modules: playwright-core, ffmpeg-static> \
//   node scripts/luch-reels-mp4.js [optics mechanics] [--only=image] [--fps=30] [--out=docs/luch-reels]
const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "..");
const TOOLS = process.env.LUCH_TOOLS ? path.join(process.env.LUCH_TOOLS, "node_modules") : "";
const req = (m) => require(TOOLS ? path.join(TOOLS, m) : m);
const { chromium } = req("playwright-core");
const FFMPEG = req("ffmpeg-static");
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=")[1] || d;
const FPS = +arg("fps", 30), ONLY = arg("only", ""), OUT = path.resolve(ROOT, arg("out", "docs/luch-reels"));
const sections = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const SECS = sections.length ? sections : ["optics", "mechanics"];
const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".mp3": "audio/mpeg", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" };

function serve() {
  const srv = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split("?")[0]);
    if (p.startsWith("/api/")) { r.writeHead(404); return r.end(); }
    let f = path.join(ROOT, p);
    if (!f.startsWith(ROOT)) { r.writeHead(403); return r.end(); }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
    if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" });
    fs.createReadStream(f).pipe(r);
  });
  return new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok(srv)));
}

function ffmpeg(args, stdin) {
  return new Promise((ok, bad) => {
    const p = spawn(FFMPEG, ["-y", "-loglevel", "error", ...args], { stdio: [stdin ? "pipe" : "ignore", "inherit", "inherit"] });
    p.on("close", (c) => (c ? bad(new Error("ffmpeg " + c)) : ok()));
    if (stdin) stdin(p.stdin);
  });
}

async function renderReel(page, sec, lesson, n) {
  const info = await page.evaluate((id) => { const r = window.__rec = LuchReel.open(id, { render: true }); r.at(0); return { starts: r.starts, total: r.total }; }, lesson);
  await page.evaluate(() => document.fonts.ready);
  const file = path.join(OUT, `${sec}-${lesson}.mp4`), tmp = file + ".video.mp4";
  const frames = Math.ceil(info.total * FPS);
  await ffmpeg(["-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(FPS), tmp], async (stdin) => {
    for (let f = 0; f < frames; f++) {
      await page.evaluate((t) => window.__rec.at(t), f / FPS);
      const jpg = await page.screenshot({ type: "jpeg", quality: 92 });
      if (!stdin.write(jpg)) await new Promise((ok) => stdin.once("drain", ok));
      if (f % (FPS * 5) === 0) process.stdout.write(`\r${sec}/${lesson} ${Math.round((f / frames) * 100)}%   `);
    }
    stdin.end();
  });
  // Озвучка: каждая сцена со своим сдвигом, затем тишина до конца (концовка без голоса).
  const ins = [], fl = [];
  info.starts.forEach((s, i) => { ins.push("-i", path.join(ROOT, sec, "reels", `${lesson}-${i}.mp3`)); fl.push(`[${i + 1}:a]adelay=${Math.round(s * 1000)}:all=1[a${i}]`); });
  const mix = `${fl.join(";")};${info.starts.map((_, i) => `[a${i}]`).join("")}amix=inputs=${n}:normalize=0,apad[aud]`;
  await ffmpeg(["-i", tmp, ...ins, "-filter_complex", mix, "-map", "0:v", "-map", "[aud]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-t", info.total.toFixed(2), "-movflags", "+faststart", file]);
  fs.unlinkSync(tmp);
  await page.evaluate(() => { document.querySelector(".lr-wrap").remove(); document.body.classList.remove("lr-recording"); });
  console.log(`\r${path.relative(ROOT, file)} · ${info.total.toFixed(1)} с`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve(), port = srv.address().port;
  const browser = await chromium.launch({ executablePath: CHROME });
  // 405×720 CSS-пикселей × 2.6667 = 1080×1920: вёрстка ровно как в плеере на сайте.
  const ctx = await browser.newContext({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 1080 / 405 });
  for (const sec of SECS) {
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${port}/${sec}/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.LuchReel && window.LUCH_REEL_SCENES && document.querySelector("[data-reel]"));
    const lessons = await page.evaluate(() => Object.entries(window.LUCH_REEL_SCENES).map(([k, v]) => [k, v.length]));
    for (const [lesson, n] of lessons) if (!ONLY || ONLY.split(",").includes(lesson)) await renderReel(page, sec, lesson, n);
    await page.close();
  }
  await browser.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
