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
      return { adverts: adv, empty: adv.length === 0 };
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

// Объявление списка -> строка для krisha_list.
function parseAdvert(a, section) {
  const title = String(a.title || "");
  const fl = title.match(/(\d+)\s*\/\s*(\d+)\s*этаж/);
  const lat = a.map && typeof a.map.lat === "number" ? a.map.lat : null;
  const lon = a.map && typeof a.map.lon === "number" ? a.map.lon : null;
  const photos = Array.isArray(a.photos) ? a.photos : [];
  return {
    id: Number(a.id),
    deal: dealOf(section), prop: propOf(section),
    userType: a.userType || null,
    city: cityOf(lat, lon),
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
    storage: a.storage || a.status || null,
  };
}

module.exports = { SECTIONS, fetchListPage, parseAdvert, loadRegions, cityOf, dealOf, propOf };
