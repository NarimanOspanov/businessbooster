// Discover Kaspi brands across categories and build a storefront for each,
// through the production ingest API. Rate-limited on purpose: Kaspi is a live
// third-party service and we stay a polite guest.
//
// Usage:
//   node scripts/bulk-ingest.js discover            → writes brands list
//   node scripts/bulk-ingest.js build [limit] [host]→ ingests brands via API
//
// Output: scripts/out/brands.json, scripts/out/built.csv

const fs = require("fs");
const path = require("path");

const CITY = "750000000"; // Almaty
const OUT = path.join(__dirname, "out");
const H = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
  Accept: "application/json, text/*",
  "Accept-Language": "ru",
  "X-KS-City": CITY,
};

// Repeat-purchase, brand-driven categories — our ICP, not commodity resale.
const QUERIES = [
  "букет цветы", "композиция цветы", "розы букет", "пионы букет", "цветы в коробке",
  "торт на заказ", "бенто торт", "капкейки", "пряники имбирные", "макаронс",
  "крем для лица", "сыворотка для лица", "маска для лица", "скраб для тела", "мыло ручной работы",
  "свеча ароматическая", "диффузор ароматический", "подарочный набор",
  "украшения серебро", "браслет ручной работы", "серьги серебро", "кольцо серебро",
  "детская одежда комплект", "игрушка развивающая", "конструктор детский",
  "корм для собак", "корм для кошек", "лежанка для животных",
  "кофе в зернах", "чай подарочный", "мед натуральный", "орехи сухофрукты",
  "постельное белье", "полотенце набор", "плед покрывало",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function search(q, page) {
  const url =
    "https://kaspi.kz/yml/product-view/pl/results?page=" + page +
    "&text=" + encodeURIComponent(q) + "&sort=relevance&qs=&ui=d&i=-1&c=" + CITY;
  const res = await fetch(url, { headers: { ...H, Referer: "https://kaspi.kz/shop/search/?text=" + encodeURIComponent(q) } });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

async function discover() {
  const brands = new Map();
  for (const q of QUERIES) {
    for (let p = 0; p < 3; p++) {
      let json;
      try {
        json = await search(q, p);
      } catch (e) {
        console.error("  " + q + " p" + p + ": " + e.message);
        break;
      }
      const items = (json && json.data) || [];
      if (!items.length) break;
      for (const it of items) {
        const b = (it.brand || "").trim();
        if (!b || /без бренда/i.test(b)) continue;
        // Only Latin/digit brand names: the ingest slug and URL token must match
        if (!/^[A-Za-z0-9][A-Za-z0-9 .\-_&']{1,40}$/.test(b)) continue;
        if (!brands.has(b)) brands.set(b, { brand: b, category: q, products: 0, reviews: 0, ratings: [] });
        const r = brands.get(b);
        r.products++;
        r.reviews += it.reviewsQuantity || 0;
        if (it.rating) r.ratings.push(it.rating);
      }
      await sleep(450);
    }
    console.log(q + " → всего брендов: " + brands.size);
  }

  const rows = Array.from(brands.values())
    .map((r) => ({
      brand: r.brand,
      category: r.category,
      products: r.products,
      reviews: r.reviews,
      rating: r.ratings.length ? Math.round((r.ratings.reduce((a, b) => a + b, 0) / r.ratings.length) * 10) / 10 : 0,
      token: r.brand.replace(/\s+/g, "-"),
    }))
    // Real shops with a reputation first — they are both better demos and better leads
    .filter((r) => r.reviews >= 10)
    .sort((a, b) => b.reviews - a.reviews);

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "brands.json"), JSON.stringify(rows, null, 2), "utf8");
  console.log("\nНайдено брендов с отзывами ≥10: " + rows.length + " → scripts/out/brands.json");
}

async function build(limit, host) {
  const rows = JSON.parse(fs.readFileSync(path.join(OUT, "brands.json"), "utf8")).slice(0, limit);
  const base = "https://" + host;
  const lines = ["brand,category,reviews,slug,products,storeUrl,status"];
  let ok = 0;
  for (const [i, r] of rows.entries()) {
    const url = "kaspi.kz/shop/" + r.token;
    let out = { error: "request failed" };
    try {
      const res = await fetch(base + "/api/ingest?url=" + encodeURIComponent(url));
      out = await res.json();
    } catch (e) {
      out = { error: e.message };
    }
    const good = !!out.storeUrl;
    if (good) ok++;
    lines.push([r.brand, r.category, r.reviews, out.slug || "", out.productCount || 0, out.storeUrl || "", good ? "ok" : out.error].map((v) => '"' + String(v).replace(/"/g, "'") + '"').join(","));
    console.log((i + 1) + "/" + rows.length + " " + r.brand + " → " + (good ? out.storeUrl + " (" + out.productCount + ")" : "SKIP: " + out.error));
    await sleep(1500); // polite pacing towards both our server and Kaspi
  }
  fs.writeFileSync(path.join(OUT, "built.csv"), lines.join("\n"), "utf8");
  console.log("\nПостроено витрин: " + ok + " из " + rows.length + " → scripts/out/built.csv");
}

(async () => {
  const cmd = process.argv[2] || "discover";
  if (cmd === "discover") return discover();
  if (cmd === "build") return build(Number(process.argv[3] || 150), process.argv[4] || "saudager.ai");
  console.error("Usage: node scripts/bulk-ingest.js discover | build [limit] [host]");
})();
