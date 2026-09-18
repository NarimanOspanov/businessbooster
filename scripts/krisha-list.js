// Обход Крыши по списку карты, а не по страницам объявлений.
//
// /a/ajax-map-list/map/<раздел>/?page=N — JSON-список, которым живёт карта на
// сайте: по 20 объявлений на страницу, и у каждого уже есть то, ради чего мы
// открывали страницу объявления: координаты, id ЖК, тип продавца, цена,
// комнаты, площадь, этаж в заголовке, фото и состояние (live/archive).
// Отдаётся напрямую, без прокси, ~0.2–0.5 с на страницу; глубина — тысячи
// страниц, так что раздел можно пройти целиком.
//
// Чего тут нет: даты создания и поднятия, описания (год постройки, тип дома,
// санузел), города. Город вычисляем по координатам через полигоны городов с
// той же страницы карты (13 крупных; остальное — null).

const KB = require("./krisha-base.js");
const { fetch: undiciFetch } = require("undici");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const H = {
  "User-Agent": UA,
  Accept: "application/json, text/javascript, */*",
  "Accept-Language": "ru-RU,ru;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "X-Requested-With": "XMLHttpRequest",
};

const SECTIONS = [
  "/prodazha/kvartiry/", "/arenda/kvartiry/",
  "/prodazha/doma-dachi/", "/arenda/doma-dachi/",
  "/prodazha/kommercheskaya-nedvizhimost/", "/arenda/kommercheskaya-nedvizhimost/",
  "/prodazha/uchastkov/",
];

function dealOf(section) { return /^\/arenda\//.test(section) ? "rent" : "sale"; }
function propOf(section) {
  return /kvartiry/.test(section) ? "flat" : /doma/.test(section) ? "house"
    : /uchastk/.test(section) ? "land" : /kommerch/.test(section) ? "commercial" : "other";
}

// opts.proxy — через пул прокси (разные адреса), иначе напрямую с сервера.
async function fetchJson(url, timeoutMs, opts) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs || 15000);
  try {
    let agent;
    if (opts && opts.proxy) {
      const KL = require("./krisha-lib.js");
      agent = await KL.dispatcher();
      if (!agent) throw new Error(KL.proxyHint());
    }
    const r = await (agent ? undiciFetch : fetch)(url, {
      headers: H, signal: ctrl.signal, ...(agent ? { dispatcher: agent } : {}),
    });
    if (!r.ok) {
      try { if (r.body) r.body.cancel().catch(() => {}); } catch { /* уже закрыт */ }
      ctrl.abort();
      const e = new Error("HTTP " + r.status); e.status = r.status; throw e;
    }
    return await r.json();
  } finally { clearTimeout(t); }
}

// Одна страница списка. { adverts: [...], empty: bool }
async function fetchListPage(section, page, attempts, opts) {
  const url = "https://krisha.kz/a/ajax-map-list/map" + section + "?page=" + page;
  let last;
  for (let i = 0; i < (attempts || 2); i++) {
    try {
      const j = await fetchJson(url, 15000, opts);
      const adv = j && j.adverts ? Object.values(j.adverts) : [];
      // В JSON нет даты поднятия, а в HTML-части ответа у каждой карточки
      // есть a-map-sidebar-item__date («18 сентября», «сегодня»). Собираем
      // по id — по ней видно, когда объявление подняли в последний раз.
      const dates = {};
      for (const m of String(j && j.html || "").matchAll(/data-id="(\d+)"[\s\S]*?a-map-sidebar-item__date[^>]*>\s*([^<]+?)\s*</g)) {
        dates[m[1]] = m[2].trim();
      }
      return { adverts: adv, empty: adv.length === 0, dates: dates };
    } catch (e) {
      last = e;
      if (i < (attempts || 2) - 1) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw last;
}

// --- город по координатам ---------------------------------------------------
let regions = null, regionsAt = 0;
async function loadRegions() {
  if (regions && Date.now() - regionsAt < 24 * 3600e3) return regions;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch("https://krisha.kz/map/prodazha/kvartiry/", {
      headers: { "User-Agent": UA, Accept: "text/html", "Accept-Encoding": "gzip, deflate, br" }, signal: ctrl.signal,
    });
    const html = await r.text();
    const at = html.indexOf("window.data =");
    const i = html.indexOf("{", at);
    let d = 0, q = false, esc = false, end = -1;
    for (let j = i; j < html.length; j++) {
      const c = html[j];
      if (q) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') q = false; continue; }
      if (c === '"') q = true; else if (c === "{") d++; else if (c === "}") { d--; if (d === 0) { end = j; break; } }
    }
    const w = JSON.parse(html.slice(i, end + 1));
    const list = (w.dGisRegions || []).map((x) => ({
      name: x.name, slug: KB.citySlugOf(x.name), poly: (x.bounds || []).map((p) => [Number(p[0]), Number(p[1])]),
    })).filter((x) => x.slug && x.poly.length > 2);
    if (list.length) { regions = list; regionsAt = Date.now(); }
  } finally { clearTimeout(t); }
  return regions || [];
}

// Точка в многоугольнике (луч вправо; полигон — [lat, lon]).
function inside(poly, lat, lon) {
  let ok = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i][0], xi = poly[i][1], yj = poly[j][0], xj = poly[j][1];
    if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) ok = !ok;
  }
  return ok;
}
function cityOf(lat, lon) {
  if (!regions || lat == null || lon == null) return null;
  for (const r of regions) if (inside(r.poly, lat, lon)) return r.slug;
  return null;
}

// «18 сентября» / «сегодня» / «вчера» -> YYYY-MM-DD (по Алматы, UTC+5).
// Года на карточке нет: берём текущий, а если месяц впереди сегодняшнего —
// прошлый (в январе «28 декабря» — это декабрь прошлого года).
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
function bumpDate(text) {
  const t = String(text || "").toLowerCase().trim();
  const now = new Date(Date.now() + 5 * 3600e3);
  const ymd = (d) => d.toISOString().slice(0, 10);
  if (/^сегодня/.test(t)) return ymd(now);
  if (/^вчера/.test(t)) return ymd(new Date(now.getTime() - 86400e3));
  const m = t.match(/^(\d{1,2})\s+([а-яё]+)/);
  if (!m) return null;
  const mon = MONTHS.findIndex((x) => m[2].startsWith(x.slice(0, 3)));
  if (mon < 0) return null;
  let year = now.getUTCFullYear();
  if (mon > now.getUTCMonth()) year--;
  const d = new Date(Date.UTC(year, mon, Number(m[1])));
  return isNaN(d) ? null : ymd(d);
}

// Город, когда координаты не попали ни в один полигон: заголовок первого
// фото начинается с «Продажа квартир в Атырау: …» / «… в Алматинской обл.: …».
function cityFromCaption(a) {
  const p = a.photos && a.photos[0];
  const t = p ? String(p.title || p.alt || "") : "";
  const m = t.match(/ в ([^:]+):/);
  return m ? KB.citySlugOf(m[1]) : null;
}

// Объявление списка -> строка для krisha_list. dates — карта id -> текст даты.
function parseAdvert(a, section, dates) {
  const title = String(a.title || "");
  const fl = title.match(/(\d+)\s*\/\s*(\d+)\s*этаж/);
  const lat = a.map && typeof a.map.lat === "number" ? a.map.lat : null;
  const lon = a.map && typeof a.map.lon === "number" ? a.map.lon : null;
  const photos = Array.isArray(a.photos) ? a.photos : [];
  return {
    id: Number(a.id),
    deal: dealOf(section), prop: propOf(section),
    userType: a.userType || null,
    city: cityOf(lat, lon) || cityFromCaption(a),
    bumpedOn: bumpDate(dates && dates[String(a.id)]),
    price: typeof a.price === "number" ? a.price : null,
    rooms: typeof a.rooms === "number" ? a.rooms : null,
    area: typeof a.square === "number" ? a.square : null,
    floor: fl ? Number(fl[1]) : null,
    floors: fl ? Number(fl[2]) : null,
    complexId: a.complexId == null ? null : (Number(a.complexId) || null),
    lat: lat, lon: lon,
    title: title || null,
    addr: a.addressTitle || null,
    ownerName: a.ownerName || null,
    photos: photos.length,
    photo1: photos.length ? String(photos[0].src || "") : null,
    // Все ссылки на фото — по ним потом сверяем «та же квартира».
    photoUrls: photos.map((p) => String(p.src || "")).filter(Boolean),
    storage: a.storage || a.status || null,
  };
}

// Ссылки на фото — компактно. У всех фото одного объявления общая папка на
// CDN, различается только номер файла:
//   https://krisha-photos.kcdn.online/webp/78/789eb091-…/20-full.jpg
// Храним «папка|20,21,22» (~200 байт) вместо списка полных ссылок (~4 КБ в
// NVARCHAR): именно они и забили базу до квоты. Если ссылки не по шаблону —
// запасной вид «j:» + JSON, он редкий.
const PHOTO_HOST = "https://krisha-photos.kcdn.online/";
const PACK_MAX = 2000; // длина колонки photos_c; расширять её — переписывать таблицу
// Несколько папок пишем через «;»: «папка|1,2;папка2|7». Ссылки не по шаблону
// CDN пропускаем (редкость). Если не влезает — оставляем столько фото, сколько
// влезает: первые важнее, по ним и сверяем.
function packPhotos(urls) {
  const groups = [];
  for (const u of (urls || []).map(String)) {
    const m = u.match(/^https:\/\/krisha-photos\.kcdn\.online\/(.+)\/(\d+)-full\.jpg$/);
    if (!m) continue;
    const g = groups.length && groups[groups.length - 1].folder === m[1] ? groups[groups.length - 1] : null;
    if (g) g.nums.push(m[2]); else groups.push({ folder: m[1], nums: [m[2]] });
  }
  if (!groups.length) return null;
  let out = "";
  for (const g of groups) {
    let seg = g.folder + "|", any = false;
    for (const n of g.nums) {
      const piece = (any ? "," : "") + n;
      if (((out ? out + ";" : "") + seg + piece).length > PACK_MAX) {
        return any ? (out ? out + ";" : "") + seg : (out || null);
      }
      seg += piece; any = true;
    }
    out = (out ? out + ";" : "") + seg;
  }
  return out || null;
}
function unpackPhotos(packed) {
  const s = String(packed || "");
  if (!s) return [];
  if (s.startsWith("j:")) { try { return JSON.parse(s.slice(2)); } catch { return []; } }
  const out = [];
  for (const seg of s.split(";")) {
    const bar = seg.indexOf("|");
    if (bar < 0) continue;
    const folder = seg.slice(0, bar);
    for (const n of seg.slice(bar + 1).split(",")) if (n) out.push(PHOTO_HOST + folder + "/" + n + "-full.jpg");
  }
  return out;
}

module.exports = { SECTIONS, fetchListPage, parseAdvert, loadRegions, cityOf, dealOf, propOf, bumpDate, packPhotos, unpackPhotos };
