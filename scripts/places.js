// Что рядом с домом — одна фраза для поста, как говорят риелторы: «рядом
// метро, школа, детсады, супермаркет». Только реальные объекты из
// OpenStreetMap (Overpass API) в пешей доступности, без генерации: в посте
// о квартире выдуманный садик хуже, чем никакого.

// Публичные серверы Overpass часто отвечают 504 под нагрузкой — идём по зеркалам.
const OVERPASS = (process.env.OVERPASS_URL ? [process.env.OVERPASS_URL] : []).concat([
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
]);

function query(lat, lon) {
  const a = (r) => "(around:" + r + "," + lat + "," + lon + ")";
  return `[out:json][timeout:25];(
    nwr${a(900)}[station=subway];
    nwr${a(900)}[railway=station][station=subway];
    nwr${a(800)}[shop=mall];
    nwr${a(700)}[amenity=school];
    nwr${a(700)}[amenity=kindergarten];
    nwr${a(600)}[shop=supermarket];
    nwr${a(700)}[leisure=park][name];
    nwr${a(700)}[amenity~"^(clinic|hospital)$"];
  );out tags center;`;
}

// Считаем по названиям: один садик часто лежит в OSM и точкой, и зданием.
function groupOf(t) {
  if (t.station === "subway") return "metro";
  if (t.shop === "mall") return "mall";
  if (t.amenity === "school") return "school";
  if (t.amenity === "kindergarten") return "kinder";
  if (t.shop === "supermarket") return "super";
  if (t.leisure === "park") return "park";
  if (t.amenity === "clinic" || t.amenity === "hospital") return "clinic";
  return null;
}
const plural = (n, one, few, many) => {
  const d = n % 10, h = n % 100;
  return d === 1 && h !== 11 ? one : d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
};

// Возвращает { text, facts } или null, если рядом ничего не нашлось.
async function nearby(lat, lon) {
  if (!lat || !lon) return null;
  const body = "data=" + encodeURIComponent(query(Number(lat).toFixed(6), Number(lon).toFixed(6)));
  let j = null, last = null;
  for (const url of OVERPASS) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "ipoteka1-bot/1.0" }, body: body, signal: AbortSignal.timeout(20000) });
      if (!r.ok) { last = new Error("overpass_" + r.status); continue; }
      j = await r.json();
      break;
    } catch (e) { last = e; }
  }
  if (!j) throw last || new Error("overpass_failed");
  const g = { metro: new Set(), mall: new Set(), school: new Set(), kinder: new Set(), super: new Set(), park: new Set(), clinic: new Set() };
  for (const e of j.elements || []) {
    const t = e.tags || {};
    const k = groupOf(t);
    if (!k) continue;
    const name = String(t["name:ru"] || t.name || "").trim();
    g[k].add(name || (k + ":" + (e.id || Math.random())));
  }
  const named = (set) => [...set].find((x) => x && !x.includes(":")) || null;
  const parts = [];
  const metro = named(g.metro);
  if (metro) parts.push("метро «" + metro.replace(/^метро\s+/i, "") + "»");
  const mall = named(g.mall);
  if (mall) parts.push("ТРЦ «" + mall.replace(/^(ТРЦ|ТЦ)\s+/i, "") + "»");
  const cnt = (k, one, few, many) => { const n = g[k].size; if (n) parts.push(n === 1 ? one : n + " " + plural(n, one, few, many)); };
  cnt("school", "школа", "школы", "школ");
  cnt("kinder", "детсад", "детсада", "детсадов");
  if (g.super.size) parts.push(g.super.size === 1 ? "супермаркет" : "супермаркеты");
  const park = named(g.park);
  if (park) parts.push("парк");
  if (g.clinic.size) parts.push("поликлиника");
  if (!parts.length) return null;
  // Одна строка на обложке: не длиннее ~56 знаков, лишнее отбрасываем с конца.
  let text = "Рядом: " + parts[0];
  for (const p of parts.slice(1)) {
    if ((text + ", " + p).length > 56) break;
    text += ", " + p;
  }
  return { text: text, facts: Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.size])) };
}

module.exports = { nearby };
