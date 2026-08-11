// Shared Krisha logic: search, parsing, location scoring and the comparables
// model. Used by both the CLI agent (scripts/krisha-agent.js) and the scheduled
// watcher inside server.js, so the two can never drift apart.

const H = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
  "Accept-Language": "ru-RU,ru;q=0.9",
};

// --- the brief -------------------------------------------------------------
const CRITERIA = {
  city: "almaty",
  rooms: [1, 2],
  priceFrom: 30000000,
  priceTo: 40000000,
  yearFrom: 1980,
  buildings: [1, 2], // кирпичный, панельный
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
  const p = [
    "das[price][from]=" + c.priceFrom,
    "das[price][to]=" + c.priceTo,
    "das[house.year][from]=" + c.yearFrom,
  ];
  c.rooms.forEach((r) => p.push("das[live.rooms][]=" + r));
  c.buildings.forEach((b) => p.push("das[flat.building][]=" + b));
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
  return {
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
function locationScore(addr) {
  const a = String(addr || "").toLowerCase();
  const inCorridor = NEAR_DISTRICTS.some((s) => a.includes(s));
  if (!inCorridor) return { score: 0, why: "район в стороне от Абая" };
  if (ON_ABAY.test(a)) return { score: 3, why: "адрес на Абая" };
  const hit = CROSSES.find((s) => a.includes(s));
  if (hit) return { score: 2, why: "пересечение с Абая: " + hit };
  return { score: 1, why: "район вдоль Абая" };
}

// Two ads for one flat are common — same address, size, floor and price
const dedupeKey = (c) =>
  [c.district, Math.round(c.area), c.floor || "?", c.floors || "?", Math.round(c.price / 1e5)].join("|");

const ageBand = (y) => (y >= 2010 ? "2010+" : y >= 2000 ? "2000-09" : y >= 1990 ? "1990-99" : "1980-89");
const groupKey = (c) => c.district + "|" + (c.building || "?") + "|" + ageBand(c.year);
const median = (a) => {
  const s = a.map((x) => x.ppm).filter(Boolean).sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

// Comparables: same district AND building type AND age band. Anything looser is
// reported as such, because a discount to a mixed bag is not evidence.
function buildModel(corpus) {
  const groups = {}, byDistrict = {};
  corpus.filter((c) => c.year && c.ppm).forEach((c) => {
    (groups[groupKey(c)] = groups[groupKey(c)] || []).push(c);
    (byDistrict[c.district] = byDistrict[c.district] || []).push(c);
  });
  const all = median(corpus.filter((c) => c.ppm));
  return function price(c) {
    const g = groups[groupKey(c)];
    if (g && g.length >= 5) return { expected: median(g), basis: "дом того же типа и возраста в районе (" + g.length + ")", solid: true };
    const d = byDistrict[c.district];
    if (d && d.length >= 5) return { expected: median(d), basis: "район целиком (" + d.length + ")", solid: false };
    return { expected: all, basis: "вся выборка (" + corpus.length + ")", solid: false };
  };
}

function flagsFor(c) {
  const f = [];
  if (/требует ремонта|черновая/i.test(c.renovation || "")) f.push("требует ремонта");
  if (c.floor === 1) f.push("первый этаж");
  if (c.floor && c.floors && c.floor === c.floors) f.push("последний этаж");
  if (c.pro) f.push("похоже на агентство");
  return f;
}

async function fetchSearch(maxPages, crit, onPage) {
  const found = new Map();
  let total = null;
  for (let page = 1; page <= maxPages; page++) {
    const res = await fetch(searchUrl(page, crit), { headers: H });
    const html = await res.text();
    if (total === null) {
      const m = html.match(/"srchtype":"filter","offset":\d+,"count":(\d+)/);
      total = m ? +m[1] : null;
    }
    const cards = parseCards(html);
    if (!cards.length) break;
    cards.forEach((c) => found.set(c.id, c));
    if (onPage) onPage(page, found.size, total);
    await sleep(1300);
  }
  return { cards: [...found.values()], total };
}

// Listing pages come back fine from a datacenter IP but detail pages drop the
// connection outright about a third of the time, so every read gets a deadline
// and two retries with growing backoff before it counts as a failure.
async function fetchDetail(id, attempts = 3) {
  let last;
  for (let i = 0; i < attempts; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const r = await fetch("https://krisha.kz/a/show/" + id, { headers: H, signal: ctrl.signal });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const d = parseDetail(await r.text());
      if (!d.year) throw new Error("no build year in page");
      return d;
    } catch (e) {
      last = e;
      if (i < attempts - 1) await sleep(2500 * (i + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw last;
}

module.exports = {
  H, CRITERIA, NEAR_DISTRICTS, sleep, num, clean, money,
  searchUrl, parseCards, parseDetail, locationScore, dedupeKey,
  ageBand, groupKey, median, buildModel, flagsFor, fetchSearch, fetchDetail,
};
