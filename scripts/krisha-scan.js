// Разбор страницы объявления для полного сбора потока (id-walking).
// Достаём window.data целиком (его храним в gzip) и размечаем поля, по
// которым потом фильтруют и сопоставляют: сделка, тип объекта, продавец,
// город, дата, цена, а также то, что нужно для поиска «та же квартира»:
// координаты, ЖК, район, улица+дом, этаж, комнаты, площадь. HTML не парсим —
// всё берём из JSON (window.data.advert) и заголовка.

const zlib = require("zlib");

// window.data целиком — сопоставление скобок с учётом строк и экранирования.
function windowDataRaw(html) {
  const at = html.search(/window\.data\s*=\s*\{/);
  if (at < 0) return null;
  const i = html.indexOf("{", at);
  let depth = 0, inStr = false, esc = false;
  for (let j = i; j < html.length; j++) {
    const ch = html[j];
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) return html.slice(i, j + 1); }
  }
  return null;
}

// Сделка и тип объекта — из полей advert (надёжнее, чем разбор заголовка):
// sectionAlias = prodazha/arenda, categoryAlias = kvartiry/doma-dachi/…
// На случай отсутствия падаем в разбор заголовка.
function dealAndProp(section, category, title) {
  const s = String(section || "").toLowerCase();
  const c = String(category || "").toLowerCase();
  const t = (title || "").toLowerCase();
  const deal = s === "arenda" ? "rent" : s === "prodazha" ? "sale"
    : /аренд|сдам|сдаётся|снять|посуточн/.test(t) ? "rent"
    : /продажа|продам|продаётся/.test(t) ? "sale" : null;
  const prop = /kvartiry|komnaty/.test(c) ? (/komnaty/.test(c) ? "room" : "flat")
    : /doma|dachi|kottedzh|taunhaus/.test(c) ? "house"
    : /uchastk|zeml/.test(c) ? "land"
    : /garazh|parking/.test(c) ? "garage"
    : /kommerch|ofis|magazin|sklad|zdani/.test(c) ? "commercial"
    : /кварт/.test(t) ? "flat"
    : /дом|коттедж|дач|таунхаус/.test(t) ? "house"
    : /участок|земл/.test(t) ? "land"
    : /гараж|парковк|паркинг/.test(t) ? "garage"
    : /офис|помещени|коммерч|магазин|склад|здание|бизнес/.test(t) ? "commercial"
    : /комнат[уые]/.test(t) ? "room"
    : "other";
  return { deal, prop };
}

const geoLat = (v) => (typeof v === "number" && v > -90 && v < 90 && v !== 0 ? v : null);
const geoLon = (v) => (typeof v === "number" && v !== 0 ? v : null);

// Разбор одной страницы -> объект для db.saveObject, либо null, если это не
// объявление (нет window.data).
function parse(id, html) {
  const raw = windowDataRaw(html);
  if (!raw) return null;
  let j;
  try { j = JSON.parse(raw); } catch { return null; }
  const a = j.advert || {};
  const c = (j.adverts && j.adverts[0]) || {};
  const pageTitle = (html.match(/<title>([^<]+)<\/title>/) || [])[1] || null;
  // advert.title — «3-комнатная квартира · 85 м² · 6/12 этаж»: в нём этаж.
  const advTitle = a.title || null;
  const { deal, prop } = dealAndProp(a.sectionAlias, a.categoryAlias, pageTitle || advTitle);
  const ad = a.address || {};
  const map = a.map || {};
  // Этаж/этажность — из advert.title: «… · 6/12 этаж».
  const fl = (advTitle || "").match(/(\d+)\s*\/\s*(\d+)\s*этаж/);
  const city = (a.city || ad.city || (c.city && c.city.name) || null);

  return {
    id: id,
    deal: deal,
    prop: prop,
    userType: a.userType || null,
    city: city ? String(city).toLowerCase() : null,
    createdOn: c.createdAt || c.addedAt || null,
    price: typeof a.price === "number" ? a.price : null,
    rooms: typeof a.rooms === "number" ? a.rooms : null,
    area: typeof a.square === "number" ? a.square : null,
    lat: geoLat(map.lat),
    lon: geoLon(map.lon),
    // Поля для сопоставления «та же квартира»:
    floor: fl ? Number(fl[1]) : null,
    floors: fl ? Number(fl[2]) : null,
    complexId: a.complexId == null ? null : (Number(a.complexId) || null),
    district: ad.district || null,
    mkr: ad.microdistrict || null,
    streetSlug: ad.street || null,
    houseNum: ad.house_num || null,
    title: advTitle || pageTitle,
    dataGz: zlib.gzipSync(Buffer.from(raw, "utf8")),
  };
}

// Тот же разбор, но из уже сохранённого JSON (для backfill существующих
// строк). Принимает распакованную строку window.data и заголовок отдельно.
function fieldsFromJson(rawJson, title) {
  return parse(0, "<title>" + (title || "") + "</title>window.data = " + rawJson + ";</script>");
}

module.exports = { windowDataRaw, dealAndProp, parse, fieldsFromJson };
