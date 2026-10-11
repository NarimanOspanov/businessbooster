// Reels из готовых слайдов карусели: каждый слайд 4:5 ставим в кадр 9:16
// поверх размытой копии самого себя (без чёрных полос), медленный наезд и
// плавная смена. Последний слайд (призыв поставить «+») держим дольше.
// Звука нет: музыку из библиотеки Instagram через API не добавить, а
// немая дорожка Reels не мешает. Кодируем ffmpeg (пакет ffmpeg-static).

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { Resvg } = require("@resvg/resvg-js");

const W = 1080, H = 1920, SW = 1080, SH = 1350;
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
async function renderReel(slides, opts) {
  const o = opts || {};
  const list = (slides || []).filter(Boolean);
  if (list.length < 2) throw new Error("мало слайдов для Reels");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reel-"));
  try {
    const dur = list.map((_, i) => (i === list.length - 1 ? 3.5 : i === 0 ? 2.6 : 2.0));
    const fade = 0.35;
    list.forEach((b, i) => fs.writeFileSync(path.join(dir, i + ".png"), toPng(frameSvg(b, i === 0 ? o.hook : i === list.length - 1 ? null : o.top, i === 0))));
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
    const outFile = path.join(dir, "reel.mp4");
    args.push("-filter_complex", f.join(";"), "-map", "[vout]",
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
  const v = Number(f.price) / 1e6;
  const mln = (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10).toString().replace(".", ",") + " млн ₸";
  const what = f.rooms ? f.rooms + "-комнатная за " + mln : "Квартира за " + mln;
  const why = f.below >= 5 ? "На " + f.below + "% дешевле соседей — от хозяина" : "Продаёт сам хозяин · можно в ипотеку";
  return [what, why];
}
const TOP = "Поставьте «+» — пришлём номер хозяина";

module.exports = { renderReel, reelHook, TOP };
