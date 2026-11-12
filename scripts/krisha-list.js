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

// Части обхода. Список карты обрезан примерно на 5 300 страницах (~107 тысяч
// объявлений), а продажа квартир — 225 тысяч, поэтому её читаем по числу
// комнат: каждая часть меньше лимита, а вместе они дают весь раздел.
// Остальные разделы в лимит укладываются целиком.
const SECTIONS = [
  { path: "/prodazha/kvartiry/", q: "das[live.rooms][]=1", label: "/prodazha/kvartiry/ 1к" },
  { path: "/prodazha/kvartiry/", q: "das[live.rooms][]=2", label: "/prodazha/kvartiry/ 2к" },
  { path: "/prodazha/kvartiry/", q: "das[live.rooms][]=3", label: "/prodazha/kvartiry/ 3к" },
  { path: "/prodazha/kvartiry/", q: "das[live.rooms][]=4", label: "/prodazha/kvartiry/ 4к" },
  { path: "/prodazha/kvartiry/", q: "das[live.rooms][]=5&das[live.rooms][]=6&das[live.rooms][]=7&das[live.rooms][]=8&das[live.rooms][]=9", label: "/prodazha/kvartiry/ 5к+" },
  { path: "/arenda/kvartiry/" },
  { path: "/prodazha/doma-dachi/" }, { path: "/arenda/doma-dachi/" },
  { path: "/prodazha/kommercheskaya-nedvizhimost/" }, { path: "/arenda/kommercheskaya-nedvizhimost/" },
  { path: "/prodazha/uchastkov/" },
].map((x) => Object.assign({ q: "", label: x.path }, x));

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
// section — объект из SECTIONS (или путь строкой, тогда без фильтра).
async function fetchListPage(section, page, attempts, opts) {
  const sec = typeof section === "string" ? { path: section, q: "" } : section;
  const url = "https://krisha.kz/a/ajax-map-list/map" + sec.path + "?page=" + page + (sec.q ? "&" + sec.q : "");
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
// Запас, когда полигонов нет: на странице карты больше нет dGisRegions
// (проверено 13.11.2026), и город по координатам не находился вовсе.
// Центр города и радиус в км — с запасом на пригороды, но без соседних городов.
const CITY_CENTERS = [
  ["almaty", 43.250, 76.900, 20], ["astana", 51.140, 71.440, 20], ["shymkent", 42.320, 69.600, 20],
  ["karaganda", 49.810, 73.090, 18], ["aktobe", 50.290, 57.170, 16], ["atyrau", 47.110, 51.900, 15],
  ["taraz", 42.900, 71.370, 14], ["pavlodar", 52.290, 76.970, 15], ["ust-kamenogorsk", 49.950, 82.620, 16],
  ["semey", 50.420, 80.250, 14], ["kostanay", 53.210, 63.630, 13], ["kyzylorda", 44.840, 65.500, 14],
  ["aktau", 43.650, 51.170, 15], ["uralsk", 51.230, 51.370, 14], ["kokshetau", 53.290, 69.390, 12],
  ["petropavlovsk", 54.870, 69.150, 12], ["temirtau", 50.060, 72.960, 10], ["turkestan", 43.300, 68.250, 12],
  ["taldykorgan", 45.020, 78.380, 12], ["ekibastuz", 51.730, 75.320, 10],
];
function cityByCenter(lat, lon) {
  let best = null, bestD = Infinity;
  for (const [slug, clat, clon, r] of CITY_CENTERS) {
    const dy = (lat - clat) * 111.2, dx = (lon - clon) * 111.2 * Math.cos(clat * Math.PI / 180);
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d <= r && d < bestD) { best = slug; bestD = d; }
  }
  return best;
}
function cityOf(lat, lon) {
  if (lat == null || lon == null) return null;
  if (regions && regions.length) for (const r of regions) if (inside(r.poly, lat, lon)) return r.slug;
  return cityByCenter(Number(lat), Number(lon));
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
  return m ? citySlugLoc(m[1]) : null;
}
// В подписи город в предложном падеже: «в Астане», «в Караганде», «в Шымкенте».
// Словарь KB знает только именительный, и до 13.11.2026 так находилась почти
// одна Алматы (не склоняется): Астана и другие города оставались без города.
const CITY_STEMS = [
  ["астан", "astana"], ["шымкент", "shymkent"], ["караганд", "karaganda"], ["актобе", "aktobe"], ["атырау", "atyrau"],
  ["тараз", "taraz"], ["павлодар", "pavlodar"], ["усть-каменогорск", "ust-kamenogorsk"], ["семе", "semey"],
  ["костана", "kostanay"], ["кызылорд", "kyzylorda"], ["актау", "aktau"], ["уральск", "uralsk"], ["кокшетау", "kokshetau"],
  ["петропавловск", "petropavlovsk"], ["темиртау", "temirtau"], ["туркестан", "turkestan"], ["талдыкорган", "taldykorgan"],
  ["экибастуз", "ekibastuz"], ["алматы", "almaty"],
];
function citySlugLoc(name) {
  const t = String(name || "").toLowerCase().trim();
  if (/обл\.?|област|р-н|район/.test(t)) return null; // «в Алматинской обл.» — это не город
  for (const [stem, slug] of CITY_STEMS) if (t === stem || (t.startsWith(stem) && t.length - stem.length <= 2)) return slug;
  return KB.citySlugOf(t);
}

// Площадь из заголовка: «Свободное назначение · 62 м²» → 62, «Участок · 5.58 соток» → 5.58 (сотки).
function areaFromTitle(title) {
  const m = String(title || "").match(/([\d]+(?:[.,][\d]+)?)\s*(м²|сот)/);
  return m ? Number(m[1].replace(",", ".")) : null;
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
    area: typeof a.square === "number" ? a.square : areaFromTitle(title),
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

// Есть ли объявление на Крыше прямо сейчас. Карточка карты
// /a/ajax-map-object?id= отвечает теми же заголовками, что и список:
// 404 — объявления нет (удалено), 200 с data-storage="archive" — снято,
// data-storage="live" — живое. Любая другая ошибка — «неизвестно»: выдаём
// как есть, чтобы сбой сети не останавливал очередь.
async function checkAdvert(id, opts) {
  const url = "https://krisha.kz/a/ajax-map-object?id=" + encodeURIComponent(String(id));
  try {
    const j = await fetchJson(url, (opts && opts.timeoutMs) || 5000, opts);
    const html = String((j && j.html) || "");
    const m = /data-storage="([a-z]+)"/.exec(html);
    if (m && m[1] === "live") return { status: "live" };
    if (m) return { status: "archived", storage: m[1] };
    return { status: "unknown", why: "no data-storage" };
  } catch (e) {
    if (e && e.status === 404) return { status: "not_found" };
    return { status: "unknown", why: String((e && e.message) || e).slice(0, 80) };
  }
}

// --- обход по номерам (13.11.2026) -------------------------------------------
// Новые объявления встают в список не наверх: Крыша сортирует только по дню
// поднятия, а внутри дня — вперемешку (новое за сегодня видели и на 1-й, и на
// 800-й странице). Поэтому fresh ловил ~10% новых. Номера же Крыша выдаёт
// подряд, и карточка карты ajax-map-object?id= отдаёт по одному номеру всё
// нужное для очереди номеров: раздел, тип продавца, цену, заголовок, адрес,
// город (в подписи фото) и первое фото. Координат и всех фото в ней нет —
// их потом допишет полный обход списка.
// Категории Крыши (data-cat-id) → раздел списка. Прочее (ЖК, гаражи…) не берём.
const CAT_SECTIONS = {
  1: "/prodazha/kvartiry/", 2: "/arenda/kvartiry/",
  62: "/prodazha/doma-dachi/", 65: "/arenda/doma-dachi/",
  59: "/prodazha/kommercheskaya-nedvizhimost/", 60: "/arenda/kommercheskaya-nedvizhimost/",
  14: "/prodazha/uchastkov/",
};
function unescapeHtml(s) {
  return String(s == null ? "" : s).replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/&laquo;/g, "«").replace(/&raquo;/g, "»").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ").trim();
}
// html карточки карты → строка для krisha_list (как parseAdvert) или null.
function parseMapObject(id, html) {
  const h = String(html || "");
  const storage = (h.match(/data-storage="([a-z]+)"/) || [])[1] || null;
  const section = CAT_SECTIONS[Number((h.match(/data-cat-id="(\d+)"/) || [])[1])];
  if (!section) return null;
  const title = unescapeHtml((h.match(/class="a-map-sidebar-item__title"[^>]*>([^<]*)</) || [])[1])
    .replace(/(\d+)-комн\.\s*квартира/, "$1-комнатная квартира");
  const caption = unescapeHtml((h.match(/<img\s+alt="[^"]*"\s+title="([^"]*)"/) || [])[1]);
  const priceDigits = ((h.match(/a-map-sidebar-item__price">([\s\S]*?)<span/) || [])[1] || "").replace(/\D/g, "");
  const addr = unescapeHtml((h.match(/a-map-sidebar-item__address">([^<]*)</) || [])[1]);
  const nb = Number((h.match(/data-nb="(\d+)"/) || [])[1]) || 0;
  const full = (h.match(/data-full-src="(https:\/\/krisha-photos[^"]+)"/) || [])[1] || null;
  const ownerAt = h.indexOf("a-map-sidebar-item__owner");
  const owner = unescapeHtml(ownerAt < 0 ? "" : h.slice(ownerAt, ownerAt + 1500).replace(/<[^>]+>/g, " "));
  const userType = /Хозяин недвижимости/.test(owner) ? "owner" : /Специалист/.test(owner) ? "specialist"
    : /компани|Агентств/i.test(owner) ? "company" : /Новостройка|застройщик/i.test(owner) ? "complex" : null;
  const date = (owner.match(/(сегодня|вчера|\d{1,2}\s+[а-яё]+)/i) || [])[1] || null;
  const rm = title.match(/(\d+)-комнатн/) || title.match(/(\d+)\s+комнат/);
  const a = {
    id: Number(id), title: title, price: priceDigits ? Number(priceDigits) : null,
    rooms: rm ? Number(rm[1]) : null, addressTitle: addr || null, userType: userType, storage: storage,
    photos: full ? [{ src: full, title: caption }] : [],
  };
  const row = parseAdvert(a, section, { [String(id)]: date });
  row.photos = nb || row.photos; // в карточке одно фото, но data-nb — сколько их всего
  return row;
}
// Один номер: { status: live|archived|not_found|unknown, row }.
async function fetchMapObject(id, opts) {
  try {
    const j = await fetchJson("https://krisha.kz/a/ajax-map-object?id=" + encodeURIComponent(String(id)), (opts && opts.timeoutMs) || 8000, opts);
    const html = String((j && j.html) || "");
    const st = (/data-storage="([a-z]+)"/.exec(html) || [])[1];
    if (!st) return { status: "unknown", why: "no data-storage" };
    return { status: st === "live" ? "live" : "archived", row: st === "live" ? parseMapObject(id, html) : null };
  } catch (e) {
    if (e && e.status === 404) return { status: "not_found" };
    return { status: "unknown", why: String((e && e.message) || e).slice(0, 80) };
  }
}

// Карточка по номеру без координат и с одним фото. Полную строку берём из
// списка карты с узким фильтром (цена, комнаты, площадь, город): объявление
// попадает в первые 2–20 результатов, а там координаты, ЖК и все фото.
// null — не нашлось (тогда остаётся строка из карточки, полный обход допишет).
async function locateFull(row, opts) {
  const sec = Object.values(CAT_SECTIONS).find((p) => dealOf(p) === row.deal && propOf(p) === row.prop);
  if (!sec || row.price == null) return null;
  const q = ["das[price][from]=" + row.price, "das[price][to]=" + row.price];
  if (row.prop === "flat" && row.rooms) q.push("das[live.rooms][]=" + row.rooms);
  if (row.prop === "flat" && row.area) q.push("das[live.square][from]=" + Math.floor(row.area), "das[live.square][to]=" + Math.ceil(row.area));
  // Без города выдача по всему Казахстану шире — смотрим до трёх страниц.
  let res = null, hit = null;
  for (let page = 1; page <= (row.city ? 1 : 3) && !hit; page++) {
    res = await fetchListPage({ path: sec + (row.city ? row.city + "/" : ""), q: q.join("&") }, page, 1, opts);
    hit = res.adverts.find((a) => String(a.id) === String(row.id));
    if (res.adverts.length < 20) break;
  }
  if (!hit) return null;
  const full = parseAdvert(hit, sec, res.dates);
  if (!full.city) full.city = row.city;
  if (!full.bumpedOn) full.bumpedOn = row.bumpedOn;
  return full;
}

module.exports = { areaFromTitle, SECTIONS, fetchListPage, parseAdvert, loadRegions, cityOf, dealOf, propOf, bumpDate, packPhotos, unpackPhotos, checkAdvert, parseMapObject, fetchMapObject, locateFull };
