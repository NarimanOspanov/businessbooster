// Shared Krisha logic: search, parsing, location scoring and the comparables
// model. Used by both the CLI agent (scripts/krisha-agent.js) and the scheduled
// watcher inside server.js, so the two can never drift apart.

const H = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
  "Accept-Language": "ru-RU,ru;q=0.9",
};

// --- the brief -------------------------------------------------------------
// City-wide and owner-only: 16 629 listings, against 624 under the narrow
// personal brief. Building type and build year are no longer filtered — the
// model bands by both, so restricting them only starved the comparables.
const CRITERIA = {
  city: "almaty",
  rooms: [1, 2, 3],
  priceFrom: 15000000,
  priceTo: 80000000,
  yearFrom: null,
  buildings: null,
  ownerOnly: true,
};

// Abay runs east-west through these three districts only.
const NEAR_DISTRICTS = ["бостандыкский", "алмалинский", "ауэзовский"];
const ON_ABAY = /абая/i;
// Streets crossing Abay — a hit means roughly one block away
const CROSSES = [
  "момышулы", "саина", "алтынсарина", "тлендиева", "розыбакиева", "гагарина",
  "ауэзова", "байзакова", "манаса", "жарокова", "радостовца", "масанчи",
  "шагабутдинова", "байтурсынова", "наурызбай", "абылай хана", "фурманова",
  "назарбаева", "желтоксан", "сейфуллина", "варламова", "брусиловского",
  "гончарова", "утепова", "левитана", "джандосова", "жандосова",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (s) => Number(String(s).replace(/&nbsp;/g, "").replace(/[^\d]/g, "")) || 0;
const clean = (s) =>
  String(s || "").replace(/&nbsp;/g, " ").replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
const money = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₸";

function searchUrl(page, crit) {
  const c = crit || CRITERIA;
  const p = [];
  if (c.priceFrom) p.push("das[price][from]=" + c.priceFrom);
  if (c.priceTo) p.push("das[price][to]=" + c.priceTo);
  if (c.yearFrom) p.push("das[house.year][from]=" + c.yearFrom);
  (c.rooms || []).forEach((r) => p.push("das[live.rooms][]=" + r));
  (c.buildings || []).forEach((b) => p.push("das[flat.building][]=" + b));
  if (c.ownerOnly) p.push("das[who]=1");
  p.push("page=" + page);
  return "https://krisha.kz/prodazha/kvartiry/" + c.city + "/?" + p.join("&");
}

// The card container writes data-id before class, across several lines, so we
// chunk on that opening tag rather than on the class attribute.
function parseCards(html) {
  const re = /<div\s+data-id="(\d+)"\s+data-uuid="[^"]*"\s+class="a-card[\s"]/g;
  const marks = [];
  let m;
  while ((m = re.exec(html))) marks.push({ id: m[1], at: m.index });
  const out = [];
  for (let i = 0; i < marks.length; i++) {
    const c = html.slice(marks[i].at, marks[i + 1] ? marks[i + 1].at : marks[i].at + 9000);
    const title = clean((c.match(/class="a-card__title[^"]*"[^>]*>([^<]+)</) || [])[1]);
    const price = num((c.match(/class="a-card__price"[^>]*>([^<]+)</) || [])[1]);
    const addr = clean((c.match(/class="a-card__subtitle[^"]*"[^>]*>([^<]+)</) || [])[1]);
    const area = Number(((title.match(/([\d.,]+)\s*м²/) || [])[1] || "").replace(",", "."));
    if (!price || !area || !title) continue;
    out.push({
      id: marks[i].id, price, area, addr, title,
      rooms: num((title.match(/(\d+)-комнатная/) || [])[1]),
      ppm: Math.round(price / area),
      pro: /user-label-identified-specialist|user-title-pro/.test(c),
      district: (addr.match(/([А-Яа-яЁё-]+ский р-н)/) || [])[1] || "без района",
    });
  }
  return out;
}

function parseDetail(html) {
  const d = {};
  for (const m of html.matchAll(/data-name="([^"]+)"[\s\S]{0,400}?offer__advert-short-info"[^>]*>([\s\S]{0,140}?)<\/div>/g)) {
    d[m[1]] = clean(m[2]);
  }
  const fl = (d["flat.floor"] || "").match(/(\d+)\s*из\s*(\d+)/);
  // The card shows addedAt — the last bump — which is why every listing on a
  // page reads "today". createdAt is the real one. isAgent is Krisha's own
  // verdict, unlike the das[who]=1 filter which the seller ticks themselves.
  const createdAt = (html.match(/"createdAt"\s*:\s*"(\d{4}-\d{2}-\d{2})"/) || [])[1] || null;
  const addedAt = (html.match(/"addedAt"\s*:\s*"(\d{4}-\d{2}-\d{2})"/) || [])[1] || null;
  const agentM = html.match(/"isAgent"\s*:\s*(true|false)/);
  return {
    createdAt, addedAt,
    isAgent: agentM ? agentM[1] === "true" : null,
    year: num(d["house.year"]) || null,
    building: d["flat.building"] || null,
    renovation: d["flat.renovation"] || null,
    floorRaw: d["flat.floor"] || null,
    floor: fl ? +fl[1] : null,
    floors: fl ? +fl[2] : null,
    toilet: d["flat.toilet"] || null,
  };
}

// Without the district guard a long street like Момышулы matches at its far end
// in Зердели, 15 km away, and Наурызбай matches the district's own name.
// The Abay corridor guess was a stand-in for coordinates we did not have. Now
// that listings are geocoded and an area can be drawn on the map, it no longer
// filters anything out — it only nudges ranking when no box is set.
function locationScore(addr) {
  const a = String(addr || "").toLowerCase();
  if (!NEAR_DISTRICTS.some((s) => a.includes(s))) return { score: 1, why: "Алматы" };
  if (ON_ABAY.test(a)) return { score: 3, why: "адрес на Абая" };
  const hit = CROSSES.find((s) => a.includes(s));
  if (hit) return { score: 2, why: "пересечение с Абая: " + hit };
  return { score: 1, why: "район вдоль Абая" };
}

// Identity of a flat, price deliberately excluded: one flat was found posted
// thirteen times in a day, and a re-post with a nudged price must not read as a
// new find. Price changes are handled separately, as their own event.
const dedupeKey = (c) =>
  [c.district, Math.round(c.area * 10), c.rooms || "?", c.floor || "?", c.floors || "?"].join("|");

const ageBand = (y) =>
  y >= 2020 ? "2020+" : y >= 2010 ? "2010-19" : y >= 2000 ? "2000-09"
  : y >= 1990 ? "1990-99" : y >= 1980 ? "1980-89" : y >= 1960 ? "1960-79" : "до 1960";
// Price per m² falls as flats get bigger, so without an area band a whole
// new-build complex of 74-87 m² reads as a 40% bargain against small old stock.
const areaBand = (a) => (a < 40 ? "<40" : a < 55 ? "40-55" : a < 70 ? "55-70" : a < 90 ? "70-90" : "90+");
const groupKey = (c) => c.district + "|" + (c.building || "?") + "|" + ageBand(c.year) + "|" + areaBand(c.area);
const median = (a) => {
  const s = a.map((x) => x.ppm).filter(Boolean).sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

// Comparables, tried from tightest to loosest. Only a match that controls for
// area counts as solid — that is the one a claim can rest on. Everything looser
// is returned but flagged, because a discount to a mixed bag is not evidence.
function buildModel(corpus) {
  const usable = corpus.filter((c) => c.year && c.ppm && c.area);
  const idx = { full: {}, noArea: {}, distArea: {}, dist: {} };
  const put = (bag, k, c) => ((bag[k] = bag[k] || []).push(c));
  usable.forEach((c) => {
    put(idx.full, groupKey(c), c);
    put(idx.noArea, c.district + "|" + (c.building || "?") + "|" + ageBand(c.year), c);
    put(idx.distArea, c.district + "|" + areaBand(c.area), c);
    put(idx.dist, c.district, c);
  });
  const all = median(usable);

  return function price(c) {
    const ladder = [
      [idx.full[groupKey(c)], (n) => "тот же тип, возраст и площадь в районе (" + n + ")", true],
      [idx.distArea[c.district + "|" + areaBand(c.area)], (n) => "та же площадь в районе (" + n + ")", true],
      [idx.noArea[c.district + "|" + (c.building || "?") + "|" + ageBand(c.year)],
        (n) => "тот же тип и возраст в районе, площадь любая (" + n + ")", false],
      [idx.dist[c.district], (n) => "район целиком (" + n + ")", false],
    ];
    for (const [g, label, solid] of ladder) {
      if (g && g.length >= 5) return { expected: median(g), basis: label(g.length), solid };
    }
    return { expected: all, basis: "вся выборка (" + usable.length + ")", solid: false };
  };
}

function flagsFor(c) {
  const f = [];
  if (/требует ремонта|черновая/i.test(c.renovation || "")) f.push("требует ремонта");
  if (c.floor === 1) f.push("первый этаж");
  if (c.floor && c.floors && c.floor === c.floors) f.push("последний этаж");
  // Krisha's own isAgent from the listing page beats the card badge: measured on
  // 70 listings they disagree on 22, and the badge over-flags badly — it was
  // disqualifying almost every candidate.
  if (c.isAgent === true) f.push("агентство");
  else if (c.isAgent == null && c.pro) f.push("похоже на агентство");
  return f;
}

async function fetchSearch(maxPages, crit, onPage) {
  const found = new Map();
  let total = null, skipped = 0;
  for (let page = 1; page <= maxPages; page++) {
    let html;
    try {
      html = await fetchText(searchUrl(page, crit));
    } catch {
      // One unreachable page must not abort the sweep — note it and move on.
      skipped++;
      await sleep(1300);
      continue;
    }
    if (total === null) {
      const m = html.match(/"srchtype":"filter","offset":\d+,"count":(\d+)/);
      if (m) total = +m[1];
    }
    const cards = parseCards(html);
    if (!cards.length) break;
    cards.forEach((c) => found.set(c.id, c));
    if (onPage) onPage(page, found.size, total);
    await sleep(1300);
  }
  return { cards: [...found.values()], total, skipped };
}

// From a datacenter IP Krisha drops connections intermittently — on detail pages
// most often, but search pages too. Every read therefore gets a deadline and two
// backoff retries; without this a single blip killed an entire run.
async function fetchText(url, attempts = 3, timeoutMs = 20000) {
  let last;
  for (let i = 0; i < attempts; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(url, { headers: H, signal: ctrl.signal });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.text();
    } catch (e) {
      last = e;
      if (i < attempts - 1) await sleep(2500 * (i + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw last;
}

// Krisha publishes its own price comparison — I was wrong earlier to say it does
// not. It is rendered client-side from this fragment, which is why it was
// invisible in the listing HTML. Not disallowed in robots.txt.
//
// Their stated method: build year, room count, district and building type —
// area is not among them, which is exactly why their percentage and ours differ.
async function fetchPriceAnalysis(id) {
  const html = await fetchText("https://krisha.kz/analytics/aPriceAnalysis/?id=" + id);
  const money = (re) => {
    const m = html.match(re);
    return m ? num(m[1]) : null;
  };
  const pct = clean(html).match(/На\s+([\d.,]+)%\s+(дешевле|дороже)/i);
  const series = html.match(/chartColumnsData\s*=\s*(\{[\s\S]{0,4000}?\});/);
  let city = null, micro = null;
  if (series) {
    try {
      const j = JSON.parse(series[1]);
      city = j.city || null;
      micro = j.microdistrict || null;
    } catch { /* chart is a bonus, not a requirement */ }
  }
  return {
    kzPpm: money(/class="green-price">([\d\s&nbsp;]+)/),
    kzSimilarLocal: money(/class="blue-price">([\d\s&nbsp;]+)/),
    kzSimilarCity: money(/class="white-blue-price">([\d\s&nbsp;]+)/),
    kzDiscount: pct ? (pct[2].toLowerCase() === "дешевле" ? 1 : -1) * Number(pct[1].replace(",", ".")) : null,
    kzCompareUrl: (html.match(/href="(\/prodazha\/kvartiry\/[^"]+)"/) || [])[1] || null,
    trendCity: city, trendMicro: micro,
  };
}

async function fetchDetail(id) {
  const d = parseDetail(await fetchText("https://krisha.kz/a/show/" + id));
  if (!d.year) throw new Error("no build year in page");
  return d;
}

// --- geocoding ---------------------------------------------------------------
// Krisha exposes no coordinates and closed its map (/a/show-map/ is disallowed
// in robots.txt), so a "draw a box on the map" filter has to run on coordinates
// we derive ourselves from addresses we already hold. That also means zero extra
// load on Krisha.
//
// Nominatim's usage policy: identify yourself and stay under one request per
// second. Callers must pace; this only does one request per attempt.
const NOMINATIM_UA = process.env.GEOCODER_UA ||
  "saudager-apartment-watch/0.1 (https://saudager.ai)";

// Address strings look like "Ауэзовский р-н, мкр Аксай-3 7 — Момышулы Толеби".
// The part before "—" is the actual location; the rest is a cross-street hint.
function addressQueries(addr) {
  const raw = String(addr || "").split("—")[0].replace(/^[^,]*р-н,\s*/, "").trim();
  if (!raw) return [];
  const out = [];
  const mkr = raw.match(/мкр\.?\s*([^,]+?)(?:\s+(\d+[а-яa-z]?))?$/i);
  if (mkr) {
    const name = mkr[1].trim(), house = mkr[2];
    if (house) out.push("микрорайон " + name + " " + house + ", Алматы");
    out.push("микрорайон " + name + ", Алматы");
    out.push(name + ", Алматы");
  } else {
    out.push(raw + ", Алматы");
    const noHouse = raw.replace(/\s+\d+[а-яa-z]?(\/\d+)?$/i, "").trim();
    if (noHouse && noHouse !== raw) out.push(noHouse + ", Алматы");
  }
  return [...new Set(out)];
}

async function geocode(addr) {
  for (const q of addressQueries(addr)) {
    const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=kz&q=" +
      encodeURIComponent(q);
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": NOMINATIM_UA, "Accept-Language": "ru" },
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      if (j && j[0]) {
        // A microdistrict resolves to its centre, not the building — worth
        // recording so the UI can say how much to trust the pin.
        const exact = /house|building|apartments|address/i.test(j[0].type || "") || /^\d/.test(q);
        return { lat: +j[0].lat, lon: +j[0].lon, geoQuery: q, geoExact: exact };
      }
    } catch {
      // try the next, looser formulation
    }
    await sleep(1100);
  }
  return null;
}

const inBox = (c, b) =>
  c && b && c.lat >= b.south && c.lat <= b.north && c.lon >= b.west && c.lon <= b.east;

module.exports = {
  addressQueries, geocode, inBox,
  H, CRITERIA, NEAR_DISTRICTS, sleep, num, clean, money,
  searchUrl, parseCards, parseDetail, locationScore, dedupeKey,
  ageBand, areaBand, groupKey, median, buildModel, flagsFor,
  fetchText, fetchSearch, fetchDetail, fetchPriceAnalysis,
};
