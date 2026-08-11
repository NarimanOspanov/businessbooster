// Build the price-watch list: popular Kaspi SKUs worth following.
// Usage: node scripts/watchlist.js [maxItems]
// Writes data/watchlist.json, consumed by scripts/price-watch.js.
//
// We pick by review count, not by discount: a SKU nobody bought produces alerts
// nobody cares about, and the channel lives or dies on whether readers recognise
// the product in the first line.

const fs = require("fs");
const path = require("path");

const MAX = Number(process.argv[2] || 300);
const MIN_REVIEWS = 30;

// Categories where price actually moves. Large appliances are deliberately
// absent — the research measured a 0.02% spread there, so they can only
// generate noise.
const QUERIES = [
  "iphone", "samsung galaxy", "xiaomi redmi", "realme", "honor смартфон",
  "наушники беспроводные", "airpods", "умные часы", "фитнес браслет",
  "ноутбук", "macbook", "планшет", "монитор", "видеокарта", "ssd диск",
  "клавиатура механическая", "мышь игровая", "powerbank", "флешка",
  "робот пылесос", "кофемашина", "блендер", "мультиварка", "фен",
  "электробритва", "машинка для стрижки", "утюг", "аэрогриль",
  "детское автокресло", "коляска", "подгузники", "самокат", "велосипед",
  "гантели", "коврик для йоги", "палатка", "рюкзак", "чемодан",
  "парфюм мужской", "парфюм женский", "крем для лица", "шампунь",
  "автомобильный видеорегистратор", "шины зимние", "моторное масло",
];

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "application/json, text/*",
  "Accept-Language": "ru",
  "X-KS-City": "750000000", // Almaty
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function search(query, page) {
  const url =
    "https://kaspi.kz/yml/product-view/pl/results?page=" + page +
    "&text=" + encodeURIComponent(query) +
    "&sort=relevance&qs=&ui=d&i=-1&c=750000000";
  const res = await fetch(url, {
    headers: Object.assign(
      { Referer: "https://kaspi.kz/shop/search/?text=" + encodeURIComponent(query) },
      HEADERS
    ),
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

(async () => {
  const byId = new Map();

  for (const q of QUERIES) {
    for (let page = 0; page < 2; page++) {
      let json;
      try {
        json = await search(q, page);
      } catch (e) {
        console.error(q + " p" + page + ": " + e.message);
        break;
      }
      const items = (json && json.data) || [];
      if (!items.length) break;
      for (const it of items) {
        if ((it.reviewsQuantity || 0) < MIN_REVIEWS) continue;
        const id = String(it.id);
        if (byId.has(id)) continue;
        byId.set(id, {
          id,
          title: it.title,
          category: q,
          reviews: it.reviewsQuantity || 0,
          rating: it.rating || null,
          seenPrice: it.unitPrice,
          kaspiUrl: "https://kaspi.kz/shop" + it.shopLink,
        });
      }
      await sleep(900); // stay polite: this is someone else's API
    }
    console.log(q.padEnd(32) + " total: " + byId.size);
  }

  const items = Array.from(byId.values())
    .sort((a, b) => b.reviews - a.reviews)
    .slice(0, MAX);

  if (!items.length) {
    console.error("watchlist is empty — Kaspi returned nothing");
    process.exit(1);
  }

  const out = path.join(__dirname, "..", "data", "watchlist.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(
    out,
    JSON.stringify({ builtAt: new Date().toISOString(), city: "750000000", count: items.length, items }, null, 2),
    "utf8"
  );
  console.log("\nWrote " + out + " (" + items.length + " SKUs)");
})();
