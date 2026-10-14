// Районы городов по координатам: границы из OpenStreetMap (data/districts.json,
// упрощены до ~20 м). Крыша сама отдаёт район только в карточке объявления —
// в списке его нет, а координаты есть у каждого объявления. Названия-ключи —
// как в адресах поиска Крыши (almaty-bostandykskij), как и insta.districts.
const LIST = require("./data/districts.json");

// Точка внутри кольца (lon, lat) — луч вправо.
function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
// Полигон: первое кольцо — граница, остальные — дыры.
function inPoly(x, y, poly) {
  if (!inRing(x, y, poly[0])) return false;
  for (let k = 1; k < poly.length; k++) if (inRing(x, y, poly[k])) return false;
  return true;
}
const BOX = LIST.map((d) => {
  let a = Infinity, b = Infinity, c = -Infinity, e = -Infinity;
  for (const p of d.polys) for (const [x, y] of p[0]) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); e = Math.max(e, y); }
  return [a, b, c, e];
});

// Район по координатам или null (вне границ / город без районов).
function districtOf(city, lat, lon) {
  if (lat == null || lon == null) return null;
  const x = Number(lon), y = Number(lat);
  for (let i = 0; i < LIST.length; i++) {
    const d = LIST[i], bx = BOX[i];
    if (city && d.city !== city) continue;
    if (x < bx[0] || x > bx[2] || y < bx[1] || y > bx[3]) continue;
    if (d.polys.some((p) => inPoly(x, y, p))) return d.slug;
  }
  return null;
}
// Города, для которых районы известны. Объявление такого города вне всех
// районов (Крыша относит к Алматы и пригород — Каскелен, Боралдай…) — район
// «<город>-out», «Пригород». Другие города — null.
const CITIES = [...new Set(LIST.map((d) => d.city))].sort((a, b) => (a === "almaty" ? -1 : b === "almaty" ? 1 : a.localeCompare(b)));
function districtFor(city, lat, lon) {
  if (!CITIES.includes(city) || lat == null || lon == null) return null;
  return districtOf(city, lat, lon) || city + "-out";
}
// Районы для страниц: [{ city, slug, name }], пригород последним.
function list(city) {
  const out = [];
  for (const c of CITIES) {
    if (city && c !== city) continue;
    LIST.filter((d) => d.city === c).sort((a, b) => a.name.localeCompare(b.name, "ru"))
      .forEach((d) => out.push({ city: d.city, slug: d.slug, name: d.name }));
    out.push({ city: c, slug: c + "-out", name: "Пригород (за районами)" });
  }
  return out;
}
const NAMES = Object.fromEntries(list().map((d) => [d.slug, d.name]));

module.exports = { districtOf, districtFor, list, NAMES, CITIES };
