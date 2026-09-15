// Разбор страницы объявления для полного сбора потока (id-walking).
// Достаём window.data целиком (его и храним в gzip) и размечаем то, по чему
// потом фильтруют: сделка (продажа/аренда), тип объекта, продавец, город,
// дата создания, базовые поля. HTML не парсим — всё берём из JSON и <title>.

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

const S = (html, key) => (html.match(new RegExp('"' + key + '"\\s*:\\s*"([^"]*)"')) || [])[1] || null;
const N = (html, key) => {
  const m = html.match(new RegExp('"' + key + '"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)'));
  return m ? Number(m[1]) : null;
};

// Тип объекта и сделка — из <title>: «Продажа 2-комнатной квартиры …»,
// «Аренда …», «Продажа дома …», «… участка», «… помещения».
function dealAndProp(title) {
  const t = (title || "").toLowerCase();
  const deal = /аренд|сдам|сдаётся|снять|посуточн/.test(t) ? "rent"
    : /продажа|продам|продаётся/.test(t) ? "sale" : null;
  const prop = /кварт/.test(t) ? "flat"
    : /дом|коттедж|дач|таунхаус/.test(t) ? "house"
    : /участок|земл/.test(t) ? "land"
    : /гараж|парковк|паркинг/.test(t) ? "garage"
    : /офис|помещени|коммерч|магазин|склад|здание|бизнес/.test(t) ? "commercial"
    : /комнат[уые]|комнаты\b/.test(t) ? "room"
    : "other";
  return { deal, prop };
}

// Разбор одной страницы. Возвращает объект для db.saveObject или null, если
// это не объявление (нет window.data).
function parse(id, html) {
  const raw = windowDataRaw(html);
  if (!raw) return null;
  const title = (html.match(/<title>([^<]+)<\/title>/) || [])[1] || null;
  const { deal, prop } = dealAndProp(title);
  const cityRaw = S(html, "city");
  return {
    id: id,
    deal: deal,
    prop: prop,
    userType: S(html, "userType"),
    city: cityRaw ? cityRaw.toLowerCase() : null,
    createdOn: (html.match(/"createdAt"\s*:\s*"(\d{4}-\d{2}-\d{2})"/) || [])[1] || null,
    price: N(html, "price"),
    rooms: N(html, "rooms"),
    area: N(html, "square"),
    lat: (() => { const v = N(html, "lat"); return v && v > -90 && v < 90 && v !== 0 ? v : null; })(),
    lon: (() => { const v = N(html, "lon"); return v && v !== 0 ? v : null; })(),
    title: title,
    dataGz: zlib.gzipSync(Buffer.from(raw, "utf8")),
  };
}

module.exports = { windowDataRaw, dealAndProp, parse };
