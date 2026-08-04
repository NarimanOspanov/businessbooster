// Ingest a real merchant/brand catalog from Kaspi.kz public listing API.
// Usage: node scripts/ingest-kaspi.js "<brand>" [slug] [pages]
// Writes data/merchants/<slug>.json used by the /store/<slug> SSR route.

const fs = require("fs");
const path = require("path");

const query = process.argv[2] || "Rozarium";
const slug = (process.argv[3] || query).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const pages = Number(process.argv[4] || 3);

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "application/json, text/*",
  "Accept-Language": "ru",
  Referer: "https://kaspi.kz/shop/search/?text=" + encodeURIComponent(query),
  "X-KS-City": "750000000", // Almaty zone
};

async function fetchPage(page) {
  const url =
    "https://kaspi.kz/yml/product-view/pl/results?page=" + page +
    "&text=" + encodeURIComponent(query) +
    "&sort=relevance&qs=&ui=d&i=-1&c=750000000";
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error("HTTP " + res.status + " on page " + page);
  return res.json();
}

(async () => {
  const byId = new Map();
  for (let p = 0; p < pages; p++) {
    let json;
    try {
      json = await fetchPage(p);
    } catch (e) {
      console.error("page " + p + ": " + e.message);
      break;
    }
    const items = json && json.data ? json.data : [];
    if (!items.length) break;
    for (const it of items) {
      const brandMatch = (it.brand || "").toLowerCase() === query.toLowerCase();
      if (!brandMatch) continue;
      const img = it.previewImages && it.previewImages[0] ? (it.previewImages[0].large || it.previewImages[0].medium) : null;
      byId.set(String(it.id), {
        id: String(it.id),
        title: it.title,
        price: it.unitPrice,
        oldPrice: it.unitPriceBeforeDiscount || null,
        discount: it.discount || 0,
        priceFormatted: it.priceFormatted,
        image: img,
        kaspiUrl: "https://kaspi.kz/shop" + it.shopLink,
        rating: it.rating || null,
        reviews: it.reviewsQuantity || null,
      });
    }
    console.log("page " + p + ": +" + items.length + " items, matched so far: " + byId.size);
  }

  if (!byId.size) {
    console.error("No products matched brand '" + query + "'");
    process.exit(1);
  }

  const profile = {
    slug,
    name: query,
    source: "kaspi.kz",
    sourceQuery: query,
    fetchedAt: new Date().toISOString(),
    productCount: byId.size,
    products: Array.from(byId.values()),
  };

  const outDir = path.join(__dirname, "..", "data", "merchants");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, slug + ".json");
  fs.writeFileSync(outFile, JSON.stringify(profile, null, 2), "utf8");
  console.log("Wrote " + outFile + " (" + byId.size + " products)");
})();
