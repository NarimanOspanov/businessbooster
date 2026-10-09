// Instagram-завод: карусель поста из объявления хозяина и публикация через
// Instagram API (вход через Instagram, graph.instagram.com).
//
// Карусель 1080×1350 (4:5): обложка — фото целиком и плашка с ценой и
// поводом («ниже рынка», «снизили цену»), дальше фото квартиры на размытом
// фоне, последний слайд — «поставьте + и получите номер хозяина».
// Рисуем SVG и растрируем resvg со своим шрифтом (Montserrat из assets),
// в JPEG — jpeg-js: Instagram принимает только JPEG по публичной ссылке.
const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");
const jpeg = require("jpeg-js");

const W = 1080, H = 1350;
const POLISH = require("./polish.js");
const FONT_DIR = path.join(__dirname, "..", "assets", "fonts");
const FONTS = ["Montserrat_500Medium.ttf", "Montserrat_700Bold.ttf", "Montserrat_800ExtraBold.ttf"].map((f) => path.join(FONT_DIR, f));
const GRAPH = "https://graph.instagram.com/v23.0";

const ACCOUNTS = {
  almaty: { city: "Алматы", handle: "ipoteka1.kz_almaty", tags: "#квартирыалматы #продажаквартиралматы #недвижимостьалматы #алматы #квартираотхозяина #купитьквартиру #квартиравалматы #ипотекаалматы #квартиравипотеку #ipoteka1" },
  astana: { city: "Астана", handle: "ipoteka1.kz_astana", tags: "#квартирыастана #продажаквартирастана #недвижимостьастана #астана #квартираотхозяина #купитьквартиру #квартиравастане #ипотекаастана #квартиравипотеку #ipoteka1" },
};

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (n) => Math.round(Number(n) || 0).toLocaleString("ru-RU").replace(/ | /g, " ");
const mln = (n) => { const v = Number(n) / 1e6; return (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10).toString().replace(".", ",") + " млн"; };

// Адрес без приписок после «—» (ориентиры, «обмен на машину») и не длиннее строки.
function cleanAddr(a) {
  let s = String(a || "").split(" — ")[0].replace(/\s+/g, " ").trim();
  if (s.length > 34) s = s.slice(0, 33).replace(/[\s,.;:-]+\S*$/, "") + "…";
  return s;
}
function paramsLine(f) {
  const p = [f.rooms ? f.rooms + "-комн" : null, f.area ? String(f.area).replace(".", ",") + " м²" : null,
    f.floor ? f.floor + (f.floors ? "/" + f.floors : "") + " этаж" : null];
  return p.filter(Boolean).join(" · ");
}
// Повод поста — ипотека: хозяин сам написал, что готов продать в ипотеку.
// Если назвал программу — она на плашке.
function hook(f) {
  if (!f.mortgage) return null;
  const pr = (f.programs || [])[0];
  // Рубрика «от хозяев · можно в ипотеку» уже на плашке сверху; оранжевая — только если названа программа.
  return { kind: "mortgage", badge: pr ? "Программа · " + pr : null, text: "Можно купить в ипотеку — хозяин готов" };
}
// Ширина надписи на глаз: у Montserrat средний знак ≈ 0,6 кегля (жирный ≈ 0,64).
const textW = (s, size, bold) => String(s).length * size * (bold ? 0.64 : 0.58);
// Точная ширина строки: рисуем её тем же шрифтом и берём рамку. Нужна там,
// где плашка подгоняется под текст — на глаз кириллица выходила шире расчёта.
const measured = new Map();
function measure(s, size, weight) {
  const k = size + ":" + weight + ":" + s;
  if (measured.has(k)) return measured.get(k);
  let w = textW(s, size, weight >= 700) * 1.1;
  try {
    const bb = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="200" font-family="Montserrat"><text x="0" y="100" font-size="${size}" font-weight="${weight}">${esc(s)}</text></svg>`,
      { font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: "Montserrat" } }).getBBox();
    if (bb) w = bb.x + bb.width;
  } catch { /* остаётся оценка */ }
  if (measured.size > 2000) measured.clear();
  measured.set(k, w);
  return w;
}
// Строка не шире max: сначала отбрасываем перечисления с конца («, парк»),
// потом режем по слову с «…».
function fit(s, size, weight, max) {
  s = String(s || "");
  while (measure(s, size, weight) > max && s.includes(", ")) s = s.slice(0, s.lastIndexOf(", "));
  while (measure(s, size, weight) > max && s.length > 4) s = s.slice(0, -2).replace(/[\s,.;:—-]+\S*$/, "") + "…";
  return s;
}

async function fetchPhoto(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) return null;
    const b = Buffer.from(await r.arrayBuffer());
    return b.length > 2000 && b[0] === 0xff && b[1] === 0xd8 ? b : null;
  } catch { return null; } finally { clearTimeout(t); }
}
const dataUri = (buf) => "data:" + (buf[0] === 0x89 && buf[1] === 0x50 ? "image/png" : "image/jpeg") + ";base64," + buf.toString("base64");

function toJpeg(svg) {
  const r = new Resvg(svg, { fitTo: { mode: "width", value: W }, font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: "Montserrat" } });
  const img = r.render();
  return jpeg.encode({ data: img.pixels, width: img.width, height: img.height }, 88).data;
}

// Слайд 1: фото сверху целиком (4:3), ниже тёмная плашка с ценой и параметрами.
function coverSvg(f, photo, acc, fx) {
  const A = ACCOUNTS[acc] || ACCOUNTS.almaty;
  const h = hook(f);
  const PH = 810;
  // Плашка слева сверху: «от хозяина · можно в ипотеку» одной строкой.
  // Ширина — по измеренному тексту (заглавные с разрядкой: +1 px на знак).
  const pillLines = f.mortgage ? ["ОТ ХОЗЯИНА · МОЖНО В ИПОТЕКУ"] : ["ОТ ХОЗЯИНА"];
  const pw = Math.max(...pillLines.map((t) => measure(t, 26, 700) + t.length)) + 64;
  const ph = pillLines.length === 2 ? 100 : 64;
  const pillSvg = `<rect x="40" y="40" width="${pw.toFixed(0)}" height="${ph}" rx="${ph === 64 ? 32 : 28}" fill="#1e8422"/>` +
    pillLines.map((t, i) => `<text x="${(40 + pw / 2).toFixed(0)}" y="${pillLines.length === 2 ? 80 + i * 38 : 82}" text-anchor="middle" font-size="26" font-weight="700" fill="#fff" letter-spacing="1">${t}</text>`).join("");
  const ppm = f.area ? Math.round(f.price / f.area / 1000) : null;
  // Ниже рынка — строкой прямо под ценой: наша оценка (3–10%) или оценка
  // Крыши из карточки. Остальные строки сдвигаются вниз на dy.
  const c = f.card || {};
  const belowText = f.below ? "Метр на " + f.below + "% дешевле похожих " + (f.belowWhere === "near" ? "поблизости" : "в этом ЖК")
    : c.price ? c.price : null;
  const dy = belowText ? 58 : 0;
  let badge = "";
  if (h && h.badge) {
    const bw = textW(h.badge, 34, true) + 64;
    badge = `<rect x="40" y="${PH - 44}" width="${bw}" height="88" rx="44" fill="#ff7a1a"/>
      <text x="${40 + bw / 2}" y="${PH + 12}" text-anchor="middle" font-size="34" font-weight="800" fill="#fff">${esc(h.badge)}</text>`;
  }
  const img = photo ? `<image href="${dataUri(photo)}" x="0" y="0" width="${W}" height="${PH}" preserveAspectRatio="xMidYMid slice"${fx ? ' filter="url(#fx)"' : ""}/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Montserrat">
  ${fx ? "<defs>" + POLISH.filterSvg("fx", fx) + "</defs>" : ""}
  <rect width="${W}" height="${H}" fill="#12211a"/>
  ${img}
  ${pillSvg}
  ${f.below ? belowPill(f.below, 40 + ph + 12) : ""}
  ${badge}
  <text x="56" y="${PH + 170}" font-size="96" font-weight="800" fill="#fff">${esc(money(f.price))} ₸</text>
  ${belowText ? `<path d="M56 ${PH + 206} h30 l-15 22 z" fill="#4cc35a"/><text x="100" y="${PH + 228}" font-size="34" font-weight="700" fill="#4cc35a">${esc(fit(belowText, 34, 700, W - 100 - 56))}</text>` : ""}
  <text x="56" y="${PH + 250 + dy}" font-size="42" font-weight="700" fill="#e9f2ec">${esc(paramsLine(f))}</text>
  <text x="56" y="${PH + 318 + dy}" font-size="36" font-weight="500" fill="#a9c2b3">${esc(A.city + ", " + cleanAddr(f.addr))}</text>
  ${ppm ? `<text x="56" y="${PH + 378 + dy}" font-size="30" font-weight="500" fill="#7f9a8a">${esc(money(ppm))} тыс ₸ за м²${f.isNew ? " · новостройка" : ""}</text>` : ""}
  ${f.near ? pinIcon(70, PH + 418 + dy, 20, "#4cc35a") + `<text x="100" y="${PH + 432 + dy}" font-size="28" font-weight="500" fill="#9fc3ad">${esc(fit(f.near, 28, 500, W - 100 - 56 - (dy ? 210 : 0)))}</text>` : ""}
  <text x="${W - 56}" y="${H - 44}" text-anchor="end" font-size="26" font-weight="500" fill="#6f8a7b">листайте →</text>
  ${f.code ? codePill(f.code, PH - 100) : ""}
</svg>`;
}

// Третья ценность: «ниже рынка на N%» — вторая зелёная плашка под первой.
function belowPill(pct, y) {
  const t = "НИЖЕ РЫНКА НА " + pct + "%";
  const w = t.length * 26 * 0.78 + 64;
  return `<rect x="40" y="${y}" width="${w}" height="64" rx="32" fill="#1e8422"/>
  <text x="${40 + w / 2}" y="${y + 42}" text-anchor="middle" font-size="26" font-weight="700" fill="#fff" letter-spacing="1">${esc(t)}</text>`;
}

// Код поста: его пишут в комментарии, и по нему сервер отдаёт номер хозяина
// именно этой квартиры (какой пост прокомментировали, нам не видно).
function codePill(code, y) {
  const t = "№ " + code; // номер объявления: коротко
  const w = t.length * 34 * 0.8 + 64;
  return `<rect x="${W - 40 - w}" y="${y}" width="${w}" height="72" rx="36" fill="#000" opacity=".6"/>
  <text x="${W - 40 - w / 2}" y="${y + 49}" text-anchor="middle" font-size="34" font-weight="800" fill="#ffd166" letter-spacing="1">${esc(t)}</text>`;
}
// Значок метки на карте (рисуем сами: эмодзи в нашем шрифте нет).
function pinIcon(x, y, s, color) {
  return `<path d="M${x} ${y + s} C${x - s * 0.15} ${y + s * 0.6} ${x - s * 0.55} ${y + s * 0.25} ${x - s * 0.55} ${y - s * 0.05} A${s * 0.55} ${s * 0.55} 0 1 1 ${x + s * 0.55} ${y - s * 0.05} C${x + s * 0.55} ${y + s * 0.25} ${x + s * 0.15} ${y + s * 0.6} ${x} ${y + s} Z" fill="${color}"/>
  <circle cx="${x}" cy="${y - s * 0.05}" r="${s * 0.2}" fill="#12211a"/>`;
}
// «Что рядом» плашкой поверх фото — сверху слева: внизу водяной знак сайта
// (его не закрываем), справа сверху счётчик карусели Instagram («2/9»), под
// него оставляем 220 px. Ширина плашки — по измеренному тексту.
// Факт о самой квартире — с галочкой, о районе — с меткой.
function checkIcon(x, y, r, color) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>
  <path d="M${x - r * 0.45} ${y + r * 0.02} L${x - r * 0.1} ${y + r * 0.38} L${x + r * 0.5} ${y - r * 0.35}" fill="none" stroke="#12211a" stroke-width="${(r * 0.28).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`;
}
function nearBar(text, kind) {
  const t = fit(text, 26, 600, W - 220 - 40 - 110 - 30);
  const w = 110 + measure(t, 26, 600) + 30;
  return `<rect x="40" y="40" width="${w.toFixed(0)}" height="64" rx="32" fill="#000" opacity=".6"/>
  ${kind === "flat" ? checkIcon(80, 72, 17, "#4cc35a") : pinIcon(80, 66, 18, "#4cc35a")}
  <text x="110" y="82" font-size="26" font-weight="600" fill="#fff">${esc(t)}</text>`;
}

// Фото квартиры: целиком по центру поверх размытой и затемнённой копии.
function photoSvg(photo, acc, i, n, f, fx, fact) {
  const A = ACCOUNTS[acc] || ACCOUNTS.almaty;
  const u = dataUri(photo);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Montserrat">
  <defs><filter id="b" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="36"/></filter>${fx ? POLISH.filterSvg("fx", fx) : ""}</defs>
  <rect width="${W}" height="${H}" fill="#12211a"/>
  <image href="${u}" x="-60" y="-60" width="${W + 120}" height="${H + 120}" preserveAspectRatio="xMidYMid slice" filter="url(#b)"/>
  <rect width="${W}" height="${H}" fill="#000" opacity=".38"/>
  <image href="${u}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid meet"${fx ? ' filter="url(#fx)"' : ""}/>
  ${fact ? nearBar(fact.t, fact.k) : ""}
  <text x="${W / 2}" y="${H - 40}" text-anchor="middle" font-size="26" font-weight="600" fill="#fff" opacity=".8">@${esc(A.handle)}</text>
</svg>`;
}

// Последний слайд: как получить номер. Миниатюра квартиры — чтобы было ясно, о какой речь.
function ctaSvg(f, photo, acc) {
  const A = ACCOUNTS[acc] || ACCOUNTS.almaty;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Montserrat">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f4d24"/><stop offset="1" stop-color="#1e8422"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <text x="${W / 2}" y="330" text-anchor="middle" font-size="76" font-weight="800" fill="#fff">Чтобы узнать больше</text>
  <text x="${W / 2}" y="425" text-anchor="middle" font-size="76" font-weight="800" fill="#fff">и получить</text>
  <text x="${W / 2}" y="520" text-anchor="middle" font-size="76" font-weight="800" fill="#ffd166">номер хозяина</text>
  <rect x="140" y="660" width="${W - 280}" height="240" rx="48" fill="#fff"/>
  <text x="${W / 2}" y="790" text-anchor="middle" font-size="64" font-weight="800" fill="#1e8422">Поставьте «+»</text>
  <text x="${W / 2}" y="852" text-anchor="middle" font-size="36" font-weight="600" fill="#2f5d3c">в комментариях</text>
  ${f.code ? `<text x="${W / 2}" y="1010" text-anchor="middle" font-size="44" font-weight="800" fill="#ffd166">Объявление № ${f.code}</text>` : ""}
  <text x="${W / 2}" y="${H - 70}" text-anchor="middle" font-size="30" font-weight="600" fill="#d5ecd9">@${esc(A.handle)}</text>
</svg>`;
}

// --- Слайд «где находится»: карта из тайлов OpenStreetMap ------------------
// Масштаб 17 — видно дома и улицы; тайлы рисуем вдвое крупнее (512 px), чтобы
// подписи читались на телефоне. По правилам OSM нужен понятный User-Agent и
// подпись «© OpenStreetMap»; тайлы кэшируем, постов в день — единицы.
const TILE_Z = 17, TILE_PX = 512;
const tileCache = new Map();
async function tile(x, y) {
  const k = x + ":" + y;
  if (tileCache.has(k)) return tileCache.get(k);
  const r = await fetch("https://tile.openstreetmap.org/" + TILE_Z + "/" + x + "/" + y + ".png", {
    headers: { "User-Agent": "ipoteka1-instagram/1.0 (+https://reception365.online)" }, signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error("tile " + r.status);
  const b = Buffer.from(await r.arrayBuffer());
  tileCache.set(k, b);
  if (tileCache.size > 400) tileCache.delete(tileCache.keys().next().value);
  return b;
}
async function mapSlide(f, acc) {
  if (f.lat == null || f.lon == null) return null;
  const A = ACCOUNTS[acc] || ACCOUNTS.almaty;
  const n = Math.pow(2, TILE_Z);
  const lat = Number(f.lat) * Math.PI / 180;
  const gx = (Number(f.lon) + 180) / 360 * n * TILE_PX;
  const gy = (1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2 * n * TILE_PX;
  // Точка дома — выше центра: снизу карточка с адресом.
  const cx = W / 2, cy = 600;
  const x0 = gx - cx, y0 = gy - cy;
  const tx0 = Math.floor(x0 / TILE_PX), tx1 = Math.floor((x0 + W) / TILE_PX);
  const ty0 = Math.floor(y0 / TILE_PX), ty1 = Math.floor((y0 + H) / TILE_PX);
  const jobs = [];
  for (let tx = tx0; tx <= tx1; tx++) for (let ty = ty0; ty <= ty1; ty++) jobs.push({ tx, ty });
  const imgs = await Promise.all(jobs.map((j) => tile(j.tx, j.ty).then((b) => Object.assign(j, { b }))));
  const tiles = imgs.map((j) => `<image href="data:image/png;base64,${j.b.toString("base64")}" x="${(j.tx * TILE_PX - x0).toFixed(1)}" y="${(j.ty * TILE_PX - y0).toFixed(1)}" width="${TILE_PX}" height="${TILE_PX}"/>`).join("");
  const addr = A.city + ", " + cleanAddr(f.addr);
  const near = f.near ? fit(f.near, 27, 500, W - 40 - 124 - 40) : "";
  const cardH = near ? 220 : 160;
  return toJpeg(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Montserrat">
  <rect width="${W}" height="${H}" fill="#e8e4dc"/>
  ${tiles}
  <rect x="40" y="40" width="360" height="72" rx="36" fill="#1e8422"/>
  <text x="220" y="88" text-anchor="middle" font-size="32" font-weight="800" fill="#fff">ГДЕ НАХОДИТСЯ</text>
  <circle cx="${cx}" cy="${cy}" r="70" fill="#e5484d" opacity=".18"/>
  <circle cx="${cx}" cy="${cy}" r="36" fill="#e5484d" opacity=".3"/>
  <path d="M${cx} ${cy} C${cx - 14} ${cy - 38} ${cx - 52} ${cy - 62} ${cx - 52} ${cy - 98} A52 52 0 1 1 ${cx + 52} ${cy - 98} C${cx + 52} ${cy - 62} ${cx + 14} ${cy - 38} ${cx} ${cy} Z" fill="#e5484d" stroke="#fff" stroke-width="6"/>
  <circle cx="${cx}" cy="${cy - 98}" r="20" fill="#fff"/>
  <rect x="40" y="${H - 90 - cardH}" width="${W - 80}" height="${cardH}" rx="36" fill="#fff"/>
  <text x="80" y="${H - 90 - cardH + 72}" font-size="42" font-weight="800" fill="#12211a">${esc(addr)}</text>
  <text x="80" y="${H - 90 - cardH + 124}" font-size="30" font-weight="600" fill="#4b5d52">${esc(paramsLine(f))} · ${esc(mln(f.price))} ₸</text>
  ${near ? pinIcon(96, H - 90 - cardH + 168, 18, "#1e8422") + `<text x="124" y="${H - 90 - cardH + 182}" font-size="27" font-weight="500" fill="#4b5d52">${esc(near)}</text>` : ""}
  <rect x="${W - 260}" y="${H - 56}" width="230" height="34" rx="8" fill="#fff" opacity=".9"/>
  <text x="${W - 145}" y="${H - 32}" text-anchor="middle" font-size="20" font-weight="500" fill="#555">© OpenStreetMap</text>
</svg>`);
}

// Факты для фото, по одному на снимок, по кругу из трёх источников: доводы
// (слова хозяина из описания), характеристики дома и
// квартиры, что рядом. Так подряд не идут три школы или три параметра.
// Кончились — фото без плашки. Нет фактов о районе (старый кэш) — общая
// строка «Рядом: …» одним пунктом.
function photoFacts(f) {
  const c = f.card || {};
  const flat = (t) => ({ t: t, k: "flat" });
  const lists = [
    (c.desc || []).map(flat), // «дешевле похожих» — уже под ценой на обложке
    (c.params || []).map(flat),
    ((f.chips && f.chips.length) ? f.chips : (f.near ? [f.near] : [])).map((t) => ({ t: t, k: "place" })),
  ];
  const out = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) lists.forEach((l) => { if (l[i]) out.push(l[i]); });
  return out;
}

// Все слайды поста: обложка, до 7 фото, карта, призыв. Битые фото пропускаем.
async function renderCarousel(f, acc, opts) {
  const max = (opts && opts.maxPhotos) || 7;
  const urls = (f.photos || []).slice(0, max + 4);
  const got = [];
  for (let i = 0; i < urls.length && got.length < max + 1; i += 4) {
    // Фото — ссылки (Крыша) или уже готовые буферы (свои объявления из базы).
    const part = await Promise.all(urls.slice(i, i + 4).map((u) => Buffer.isBuffer(u) ? u : fetchPhoto(u)));
    part.forEach((b) => { if (b && got.length < max + 1) got.push(b); });
  }
  if (!got.length) throw new Error("нет фото");
  const inner = got.slice(1, max + 1);
  const n = inner.length + 2;
  // Полировка (если включена): Gemini по промпту из настроек подбирает
  // цифры коррекции для каждого фото, применяем их фильтром. Сбой — без неё.
  let fx = [];
  if (opts && opts.polish && opts.polish.enabled) {
    if (opts.polish.mode === "image") {
      // Gemini возвращает готовые фото; что не прошло проверку — цифрами.
      const res = await POLISH.polishPhotos(got.slice(0, max + 1), opts.polish).catch((e) => { console.log("[insta] polish image: " + e.message); return []; });
      res.forEach((r, i) => { got[i] = r.buf; fx[i] = r.fx || undefined; });
      if (opts.report) opts.report.polish = res.map((r) => ({ how: r.how, check: r.check }));
    } else {
      fx = await POLISH.adjust(got.slice(0, max + 1), opts.polish.prompt, opts.polish.system).catch((e) => { console.log("[insta] polish: " + e.message); return []; });
    }
  }
  const inner2 = got.slice(1, max + 1);
  inner.splice(0, inner.length, ...inner2);
  const slides = [toJpeg(coverSvg(f, got[0], acc, fx[0]))];
  const facts = photoFacts(f);
  inner.forEach((b, k) => slides.push(toJpeg(photoSvg(b, acc, k + 2, n, f, fx[k + 1], facts[k]))));
  const map = await mapSlide(f, acc).catch((e) => { console.log("[insta] map: " + e.message); return null; });
  if (map) slides.push(map);
  slides.push(toJpeg(ctaSvg(f, got[0], acc)));
  return slides;
}

// Фото без шаблона (свои объявления, «как есть»): только обрезка по центру до
// 4:5 — Instagram не принимает в карусель кадры уже 4:5 (обычные 3:4 с
// телефона), — без надписей, плашек, карты и последнего слайда. До 10 фото.
function rawSlides(buffers) {
  return (buffers || []).slice(0, 10).map((b) => toJpeg(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <image href="${dataUri(b)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/></svg>`));
}

// Только обложка — для превью в списке кандидатов: одно фото вместо восьми.
async function renderCover(f, acc) {
  for (const u of (f.photos || []).slice(0, 4)) {
    const b = await fetchPhoto(u);
    if (b) return toJpeg(coverSvg(f, b, acc));
  }
  return toJpeg(coverSvg(f, null, acc));
}

// Значок к факту — по смыслу, чтобы список читался глазами, а не строкой.
const ICONS = [
  [/метро/i, "🚇"], [/трц|тц/i, "🛍"], [/школ/i, "🏫"], [/детсад/i, "🧸"], [/парк(?!инг)/i, "🌳"],
  [/супермаркет/i, "🛒"], [/поликлиник/i, "🏥"], [/(^|\s)дом(\s|$)/i, "🏢"], [/жк/i, "🏙"], [/кухн/i, "🍳"],
  [/потолк/i, "📐"], [/санузл/i, "🚿"], [/паркинг|стоянк/i, "🚗"], [/консьерж|охран|видеонаблюд/i, "🛡"],
  [/лоджи|балкон/i, "🌿"], [/мебел/i, "🛋"], [/ремонт/i, "🎨"],
];
const iconOf = (t) => (ICONS.find(([re]) => re.test(t)) || [null, "▫️"])[1];

// Хэштеги про ипотеку: общие и по названной программе. Instagram берёт не
// больше 30 — лишние с конца отбрасываем.
const MORTGAGE_TAGS = "#ипотека #ипотекакз #ипотекаказахстан #купитьквартирувипотеку #жильевипотеку #квартиравипотекуотхозяина #ипотеканаквартиру #отбасыбанк #ипотекаотбасы";
const PROGRAM_TAGS = { "Отбасы банк": "#отбасы", "7-20-25": "#72025 #ипотека72025", "Наурыз": "#наурыз #ипотеканаурыз", "Баспана Хит": "#баспанахит", "Алматы жастары": "#алматыжастары", "Шаңырақ": "#шанырак" };
function hashtags(f, acc) {
  const A = ACCOUNTS[acc] || ACCOUNTS.almaty;
  const city = acc === "astana" ? "#ипотекаастана" : "#ипотекаалматы";
  const all = (A.tags + " " + city + " " + MORTGAGE_TAGS + " " + (f.programs || []).map((p) => PROGRAM_TAGS[p] || "").join(" ")).split(/\s+/).filter(Boolean);
  return [...new Set(all)].slice(0, 30).join(" ");
}

// Подпись поста: сверху то, по чему решают (цена, где, сколько метров), потом
// почему эта квартира, что в доме, что рядом, ипотека, как получить номер.
// Всё — из объявления и карт, ничего от себя: доводы — слова хозяина.
function caption(f, acc) {
  const A = ACCOUNTS[acc] || ACCOUNTS.almaty;
  const h = hook(f);
  const c = f.card || {};
  const kind = (f.rooms ? f.rooms + "-комнатная квартира" : "Квартира") + (f.area ? " " + String(f.area).replace(".", ",") + " м²" : "");
  const lines = [
    // «Можно в ипотеку» — только если это так (у своих объявлений — галочка в форме).
    "🔑 От хозяина" + (f.mortgage ? " · можно в ипотеку" : "") + (f.below ? " · ниже рынка" : ""), "",
    kind + " в " + (acc === "astana" ? "Астане" : "Алматы") + (f.isNew ? ", новостройка" : "") + " — продаёт сам хозяин. Без посредников", "",
    "💰 " + money(f.price) + " ₸",
    "📍 " + A.city + ", " + cleanAddr(f.addr),
    f.floor ? "🏠 Этаж " + f.floor + (f.floors ? " из " + f.floors : "") : null,
  ].filter((x) => x != null);
  if (f.below) lines.push("💚 Метр на " + f.below + "% дешевле похожих квартир " + (f.belowWhere === "near" ? "поблизости" : "в этом ЖК"));
  else if (c.price) lines.push("📉 " + c.price);

  const why = c.desc || [];
  if (why.length) lines.push("", "Почему стоит посмотреть:", ...why.map((t) => "✔️ " + t));
  const params = c.params || [];
  if (params.length) lines.push("", "О доме и квартире:", ...params.slice(0, 8).map((t) => iconOf(t) + " " + t));
  const near = (f.chips || []).slice(0, 5);
  if (near.length) lines.push("", "Что рядом:", ...near.map((t) => iconOf(t) + " " + t));
  else if (f.near) lines.push("", "🗺 " + f.near);

  if (h) {
    lines.push("", "🏦 Можно купить в ипотеку — хозяин готов" + ((f.programs || []).length ? ", в том числе по программе " + f.programs.join(", ") : "") + ", документы в порядке. Не в залоге");
    if (f.quote) lines.push("💬 Из объявления: «" + f.quote + "»");
  }
  // Свои объявления: строки от себя (условия сделки, срочность) — перед призывом.
  if (f.extra) lines.push("", ...String(f.extra).split(/\r?\n/).map((x) => x.trim()).filter(Boolean));
  lines.push("", "✅ Договариваетесь напрямую с хозяином.", "",
    "👉 Хотите узнать больше и получить номер хозяина? Подпишитесь на @" + A.handle + " и поставьте «+» в комментариях к этому посту — пришлём номер в директ." +
      (f.code ? " Это объявление № " + f.code + ", ищите его в списке." : ""),
    "", hashtags(f, acc));
  // Instagram режет подпись после 2200 знаков: лишнее убираем из середины,
  // начиная с «что рядом», а не хвост с призывом и хэштегами.
  let out = lines.join("\n");
  while (out.length > 2200 && near.length) { near.pop(); out = caption(Object.assign({}, f, { chips: near.slice() }), acc); }
  return out.length > 2200 ? out.slice(0, 2200) : out;
}

// --- Instagram API --------------------------------------------------------
async function ig(method, url, params, token) {
  const u = new URL(url.startsWith("http") ? url : GRAPH + url);
  const body = new URLSearchParams(Object.assign({}, params || {}, { access_token: token }));
  let r;
  if (method === "GET") { body.forEach((v, k) => u.searchParams.set(k, v)); r = await fetch(u, { method: "GET" }); }
  else r = await fetch(u, { method: "POST", body: body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error("Instagram: " + ((j.error && (j.error.error_user_msg || j.error.message)) || ("HTTP " + r.status)));
  return j;
}
// Кто владелец токена: id и ник.
async function me(token) { return ig("GET", "/me", { fields: "user_id,username" }, token); }
// Долгий токен живёт 60 дней; продлевать можно, когда ему больше суток.
async function refreshToken(token) {
  const j = await ig("GET", "https://graph.instagram.com/refresh_access_token", { grant_type: "ig_refresh_token" }, token);
  return { token: j.access_token, expiresIn: j.expires_in };
}
async function waitReady(id, token) {
  for (let i = 0; i < 30; i++) {
    const j = await ig("GET", "/" + id, { fields: "status_code,status" }, token);
    if (j.status_code === "FINISHED") return;
    if (j.status_code === "ERROR" || j.status_code === "EXPIRED") throw new Error("контейнер " + id + ": " + (j.status || j.status_code));
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("контейнер " + id + " не готов за минуту");
}
// Карусель: контейнер на каждую картинку, контейнер карусели, публикация.
async function publishCarousel(userId, token, imageUrls, text) {
  const kids = [];
  // Instagram иногда не дожидается картинки и отвечает «could not be fetched»,
  // хотя ссылка живая (проверяли: отдаётся стабильно). Пробуем слайд ещё раз.
  for (const url of imageUrls) {
    let j;
    for (let t = 0; ; t++) {
      try { j = await ig("POST", "/" + userId + "/media", { image_url: url, is_carousel_item: "true" }, token); break; }
      catch (e) {
        if (!/could not be fetched|2207052|9004/i.test(String(e.message)) || t >= 3) throw e;
        await new Promise((r) => setTimeout(r, 4000 * (t + 1)));
      }
    }
    kids.push(j.id);
  }
  for (const k of kids) await waitReady(k, token);
  const car = await ig("POST", "/" + userId + "/media", { media_type: "CAROUSEL", children: kids.join(","), caption: text }, token);
  await waitReady(car.id, token);
  // Instagram бывает говорит FINISHED, а публикация всё равно отвечает «media
  // is not ready» — карусель доделывается у них ещё несколько секунд. Повторяем.
  let pub;
  for (let i = 0; ; i++) {
    try { pub = await ig("POST", "/" + userId + "/media_publish", { creation_id: car.id }, token); break; }
    catch (e) {
      if (!/not ready|2207027|9007/i.test(String(e.message)) || i >= 7) throw e;
      await new Promise((r) => setTimeout(r, [3, 5, 7, 10, 12, 15, 15][i] * 1000));
    }
  }
  let permalink = null;
  try { permalink = (await ig("GET", "/" + pub.id, { fields: "permalink" }, token)).permalink || null; } catch { /* ссылка — не главное */ }
  return { mediaId: pub.id, permalink: permalink };
}
// Комментарии поста: ник, текст, время. Для поиска «+» от конкретного человека.
// У комментариев посторонних людей Instagram оставляет поле username пустым,
// а ник отдаёт в from{username} — берём оттуда (проверено 06.10.2026 после
// перевода приложения в рабочий режим).
async function comments(mediaId, token) {
  const j = await ig("GET", "/" + mediaId + "/comments", { fields: "id,text,username,timestamp,from{id,username}", limit: "50" }, token);
  return (j.data || []).map((c) => Object.assign({}, c, { username: c.username || (c.from && c.from.username) || null }));
}
// Последние посты аккаунта: найти тот, в подписи которого есть метка.
async function findByCaption(userId, token, mark) {
  const j = await ig("GET", "/" + userId + "/media", { fields: "id,caption,permalink,timestamp", limit: "10" }, token);
  return (j.data || []).find((m) => String(m.caption || "").includes(mark)) || null;
}
// Приватный ответ на комментарий — сообщение в директ автору комментария
// (Instagram разрешает в течение 7 дней после комментария, один раз).
async function igMessage(userId, token, recipient, text, buttonPayload, buttonTitle) {
  const message = { text: String(text).slice(0, 1000) };
  // Кнопка — «быстрый ответ»: нажатие приходит нам событием messages, и
  // после него Instagram разрешает спросить, подписан ли человек.
  // Несколько кнопок — массив { title, payload } (до 13, как разрешает Instagram).
  if (Array.isArray(buttonPayload)) message.quick_replies = buttonPayload.slice(0, 13).map((b) => ({ content_type: "text", title: String(b.title).slice(0, 20), payload: String(b.payload) }));
  else if (buttonPayload) message.quick_replies = [{ content_type: "text", title: String(buttonTitle || "Получить номер").slice(0, 20), payload: String(buttonPayload) }];
  const r = await fetch(GRAPH + "/" + userId + "/messages", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ recipient: recipient, message: message }),
    signal: AbortSignal.timeout(20000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error("Instagram: " + ((j.error && (j.error.error_user_msg || j.error.message)) || ("HTTP " + r.status)));
  return j; // { recipient_id, message_id }
}
// Приватный ответ на комментарий — первое сообщение в директ автору
// (Instagram разрешает в течение 7 дней после комментария, один раз).
function privateReply(userId, token, commentId, text, buttonPayload) {
  return igMessage(userId, token, { comment_id: String(commentId) }, text, buttonPayload);
}
// Сообщение в уже начатую переписку (после нажатия кнопки человеком).
function sendMessage(userId, token, igsid, text, buttonPayload, buttonTitle) {
  return igMessage(userId, token, { id: String(igsid) }, text, buttonPayload, buttonTitle);
}
// Подписан ли человек на наш аккаунт. Instagram отвечает, только если
// человек сам написал нам или нажал кнопку в переписке.
async function userFollows(igsid, token) {
  const j = await ig("GET", "/" + igsid, { fields: "username,is_user_follow_business" }, token);
  return { follows: !!j.is_user_follow_business, username: j.username || null };
}
// Публичный ответ под комментарием («Отправили в директ 📩»).
async function replyComment(commentId, token, text) { return ig("POST", "/" + commentId + "/replies", { message: text }, token); }
const isPlus = (t) => /^\s*(\+|➕|плюс)/i.test(String(t || ""));

module.exports = { findByCaption, ACCOUNTS, renderCarousel, renderCover, caption, hook, cleanAddr, publishCarousel, me, refreshToken, comments, isPlus, coverSvg, photoSvg, ctaSvg, toJpeg, rawSlides, privateReply, replyComment, sendMessage, userFollows };
