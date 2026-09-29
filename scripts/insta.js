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
const FONT_DIR = path.join(__dirname, "..", "assets", "fonts");
const FONTS = ["Montserrat_500Medium.ttf", "Montserrat_700Bold.ttf", "Montserrat_800ExtraBold.ttf"].map((f) => path.join(FONT_DIR, f));
const GRAPH = "https://graph.instagram.com/v23.0";

const ACCOUNTS = {
  almaty: { city: "Алматы", handle: "bezposrednikov_kz_almaty", tags: "#квартирыалматы #продажаквартиралматы #недвижимостьалматы #алматы #квартираотхозяина #безпосредников #купитьквартиру #квартиравалматы" },
  astana: { city: "Астана", handle: "bezposrednikov_kz_astana", tags: "#квартирыастана #продажаквартирастана #недвижимостьастана #астана #квартираотхозяина #безпосредников #купитьквартиру #квартиравастане" },
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
  return { kind: "mortgage", badge: pr ? "Ипотека · " + pr : "Подходит под ипотеку", text: "Можно купить в ипотеку — хозяин готов" };
}
// Ширина надписи на глаз: у Montserrat средний знак ≈ 0,6 кегля (жирный ≈ 0,64).
const textW = (s, size, bold) => String(s).length * size * (bold ? 0.64 : 0.58);

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
const dataUri = (buf) => "data:image/jpeg;base64," + buf.toString("base64");

function toJpeg(svg) {
  const r = new Resvg(svg, { fitTo: { mode: "width", value: W }, font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: "Montserrat" } });
  const img = r.render();
  return jpeg.encode({ data: img.pixels, width: img.width, height: img.height }, 88).data;
}

// Слайд 1: фото сверху целиком (4:3), ниже тёмная плашка с ценой и параметрами.
function coverSvg(f, photo, acc) {
  const A = ACCOUNTS[acc] || ACCOUNTS.almaty;
  const h = hook(f);
  const PH = 810;
  const pill = "ОТ ХОЗЯИНА · БЕЗ ПОСРЕДНИКОВ";
  const pw = pill.length * 26 * 0.78 + 64; // заглавные с разрядкой шире строчных
  const ppm = f.area ? Math.round(f.price / f.area / 1000) : null;
  let badge = "";
  if (h) {
    const bw = textW(h.badge, 34, true) + 64;
    badge = `<rect x="${W - 48 - bw}" y="${PH - 44}" width="${bw}" height="88" rx="44" fill="#ff7a1a"/>
      <text x="${W - 48 - bw / 2}" y="${PH + 12}" text-anchor="middle" font-size="34" font-weight="800" fill="#fff">${esc(h.badge)}</text>`;
  }
  const img = photo ? `<image href="${dataUri(photo)}" x="0" y="0" width="${W}" height="${PH}" preserveAspectRatio="xMidYMid slice"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Montserrat">
  <rect width="${W}" height="${H}" fill="#12211a"/>
  ${img}
  <rect x="40" y="40" width="${pw}" height="64" rx="32" fill="#1e8422"/>
  <text x="${40 + pw / 2}" y="82" text-anchor="middle" font-size="26" font-weight="700" fill="#fff" letter-spacing="1">${pill}</text>
  ${badge}
  <text x="56" y="${PH + 170}" font-size="96" font-weight="800" fill="#fff">${esc(money(f.price))} ₸</text>
  <text x="56" y="${PH + 250}" font-size="42" font-weight="700" fill="#e9f2ec">${esc(paramsLine(f))}</text>
  <text x="56" y="${PH + 318}" font-size="36" font-weight="500" fill="#a9c2b3">${esc(A.city + ", " + cleanAddr(f.addr))}</text>
  ${ppm ? `<text x="56" y="${PH + 378}" font-size="30" font-weight="500" fill="#7f9a8a">${esc(money(ppm))} тыс ₸ за м²${f.isNew ? " · новостройка" : ""}</text>` : ""}
  <text x="${W - 56}" y="${H - 44}" text-anchor="end" font-size="26" font-weight="500" fill="#6f8a7b">листайте →</text>
</svg>`;
}

// Фото квартиры: целиком по центру поверх размытой и затемнённой копии.
function photoSvg(photo, acc, i, n) {
  const A = ACCOUNTS[acc] || ACCOUNTS.almaty;
  const u = dataUri(photo);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Montserrat">
  <defs><filter id="b" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="36"/></filter></defs>
  <rect width="${W}" height="${H}" fill="#12211a"/>
  <image href="${u}" x="-60" y="-60" width="${W + 120}" height="${H + 120}" preserveAspectRatio="xMidYMid slice" filter="url(#b)"/>
  <rect width="${W}" height="${H}" fill="#000" opacity=".38"/>
  <image href="${u}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid meet"/>
  <rect x="${W - 150}" y="36" width="114" height="52" rx="26" fill="#000" opacity=".45"/>
  <text x="${W - 93}" y="71" text-anchor="middle" font-size="26" font-weight="700" fill="#fff">${i}/${n}</text>
  <text x="${W / 2}" y="${H - 40}" text-anchor="middle" font-size="26" font-weight="600" fill="#fff" opacity=".8">@${esc(A.handle)}</text>
</svg>`;
}

// Последний слайд: как получить номер. Миниатюра квартиры — чтобы было ясно, о какой речь.
function ctaSvg(f, photo, acc) {
  const A = ACCOUNTS[acc] || ACCOUNTS.almaty;
  const steps = [["1", "Подпишитесь на", "@" + A.handle], ["2", "Поставьте «+»", "в комментариях к посту"], ["3", "Получите номер хозяина", "в личные сообщения"]];
  const sy = 640;
  const stepSvg = steps.map((s, k) => {
    const y = sy + k * 150;
    return `<circle cx="112" cy="${y}" r="44" fill="#fff"/>
      <text x="112" y="${y + 16}" text-anchor="middle" font-size="44" font-weight="800" fill="#1e8422">${s[0]}</text>
      <text x="186" y="${y - 6}" font-size="42" font-weight="800" fill="#fff">${esc(s[1])}</text>
      <text x="186" y="${y + 44}" font-size="32" font-weight="500" fill="#d5ecd9">${esc(s[2])}</text>`;
  }).join("");
  const thumb = photo ? `<clipPath id="c"><rect x="68" y="150" width="300" height="225" rx="24"/></clipPath>
    <image href="${dataUri(photo)}" x="68" y="150" width="300" height="225" preserveAspectRatio="xMidYMid slice" clip-path="url(#c)"/>` : "";
  const tx = photo ? 400 : 68;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Montserrat">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f4d24"/><stop offset="1" stop-color="#1e8422"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  ${thumb}
  <text x="${tx}" y="228" font-size="54" font-weight="800" fill="#fff">${esc(mln(f.price))} ₸</text>
  <text x="${tx}" y="286" font-size="34" font-weight="600" fill="#d5ecd9">${esc(paramsLine(f))}</text>
  <text x="${tx}" y="336" font-size="30" font-weight="500" fill="#b5dcbc">${esc(cleanAddr(f.addr))}</text>
  <text x="68" y="510" font-size="72" font-weight="800" fill="#fff">Номер хозяина —</text>
  <text x="68" y="592" font-size="72" font-weight="800" fill="#ffd166">бесплатно в директ</text>
  ${stepSvg.replace(/y="(\d+)"/g, (m, v) => 'y="' + (Number(v) + 90) + '"')}
  <rect x="68" y="${H - 190}" width="${W - 136}" height="2" fill="#fff" opacity=".25"/>
  <text x="${W / 2}" y="${H - 110}" text-anchor="middle" font-size="32" font-weight="700" fill="#fff">Квартиры от хозяев · Без посредников</text>
  <text x="${W / 2}" y="${H - 62}" text-anchor="middle" font-size="30" font-weight="500" fill="#d5ecd9">Выгодные предложения каждый день</text>
</svg>`;
}

// Все слайды поста: обложка, до 7 фото, призыв. Битые фото пропускаем.
async function renderCarousel(f, acc, opts) {
  const max = (opts && opts.maxPhotos) || 7;
  const urls = (f.photos || []).slice(0, max + 4);
  const got = [];
  for (let i = 0; i < urls.length && got.length < max + 1; i += 4) {
    const part = await Promise.all(urls.slice(i, i + 4).map(fetchPhoto));
    part.forEach((b) => { if (b && got.length < max + 1) got.push(b); });
  }
  if (!got.length) throw new Error("нет фото");
  const inner = got.slice(1, max + 1);
  const n = inner.length + 2;
  const slides = [toJpeg(coverSvg(f, got[0], acc))];
  inner.forEach((b, k) => slides.push(toJpeg(photoSvg(b, acc, k + 2, n))));
  slides.push(toJpeg(ctaSvg(f, got[0], acc)));
  return slides;
}

// Только обложка — для превью в списке кандидатов: одно фото вместо восьми.
async function renderCover(f, acc) {
  for (const u of (f.photos || []).slice(0, 4)) {
    const b = await fetchPhoto(u);
    if (b) return toJpeg(coverSvg(f, b, acc));
  }
  return toJpeg(coverSvg(f, null, acc));
}

function caption(f, acc) {
  const A = ACCOUNTS[acc] || ACCOUNTS.almaty;
  const h = hook(f);
  const lines = [
    "🏠 " + paramsLine(f).replace(/-комн/, "-комнатная квартира") + (f.isNew ? ", новостройка" : ""),
    "📍 " + A.city + ", " + cleanAddr(f.addr),
    "💰 " + money(f.price) + " ₸" + (f.area ? " (" + money(Math.round(f.price / f.area / 1000)) + " тыс ₸/м²)" : ""),
  ];
  if (h) {
    lines.push("🏦 " + h.text + ((f.programs || []).length ? " (" + f.programs.join(", ") + ")" : ""));
    if (f.quote) lines.push("💬 Из объявления: «" + f.quote + "»");
  }
  lines.push("", "✅ Продаёт хозяин — без посредников и лишних комиссий.", "",
    "📊 Подобрать ипотечную программу и посчитать платёж — ссылка в шапке профиля.", "",
    "👉 Хотите номер хозяина? Подпишитесь на @" + A.handle + " и поставьте «+» в комментариях — пришлём номер в директ.", "",
    A.tags);
  return lines.join("\n");
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
  for (const url of imageUrls) {
    const j = await ig("POST", "/" + userId + "/media", { image_url: url, is_carousel_item: "true" }, token);
    kids.push(j.id);
  }
  for (const k of kids) await waitReady(k, token);
  const car = await ig("POST", "/" + userId + "/media", { media_type: "CAROUSEL", children: kids.join(","), caption: text }, token);
  await waitReady(car.id, token);
  const pub = await ig("POST", "/" + userId + "/media_publish", { creation_id: car.id }, token);
  let permalink = null;
  try { permalink = (await ig("GET", "/" + pub.id, { fields: "permalink" }, token)).permalink || null; } catch { /* ссылка — не главное */ }
  return { mediaId: pub.id, permalink: permalink };
}
// Комментарии поста: ник, текст, время. Для поиска «+» от конкретного человека.
async function comments(mediaId, token) {
  const j = await ig("GET", "/" + mediaId + "/comments", { fields: "id,text,username,timestamp", limit: "50" }, token);
  return j.data || [];
}
const isPlus = (t) => /^\s*(\+|➕|плюс)/i.test(String(t || ""));

module.exports = { ACCOUNTS, renderCarousel, renderCover, caption, hook, cleanAddr, publishCarousel, me, refreshToken, comments, isPlus, coverSvg, photoSvg, ctaSvg, toJpeg };
