// Price-drop watcher for the Telegram channel.
// Usage: node scripts/price-watch.js [--dry] [--limit N] [--drop 3] [--min 2000]
//
// Reads data/watchlist.json, asks Kaspi for every seller on each SKU, remembers
// the cheapest offer, and posts to the channel when it falls. First run only
// records baselines — there is nothing to compare against yet.
//
// Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID (the public channel — deliberately
// a different variable from TELEGRAM_CHAT_ID, which is the operator's own alerts).
//
// Deliberately posts no product images: prices are facts and free to republish
// under KZ copyright law, but photos and descriptions are separate protected
// works. Title + price + link only.

const fs = require("fs");
const path = require("path");

const argv = process.argv.slice(2);
const flag = (name, def) => {
  const i = argv.indexOf("--" + name);
  return i === -1 ? def : argv[i + 1];
};
const DRY = argv.includes("--dry");
const LIMIT = Number(flag("limit", 8)); // never flood the channel in one run
const MIN_DROP_PCT = Number(flag("drop", 3));
const MIN_DROP_ABS = Number(flag("min", 2000)); // ignore rounding noise on cheap goods

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TG_CHANNEL = process.env.TELEGRAM_CHANNEL_ID || "";

const DATA_DIR = process.env.PERSIST_DIR
  ? path.join(process.env.PERSIST_DIR)
  : path.join(__dirname, "..", "data");
const STATE_FILE = path.join(DATA_DIR, "pricewatch.json");
// WATCHLIST_FILE lets one bot drive several themed channels off separate lists
const WATCHLIST = process.env.WATCHLIST_FILE || path.join(__dirname, "..", "data", "watchlist.json");

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "application/json, text/*",
  "Accept-Language": "ru",
  "Content-Type": "application/json",
  "X-KS-City": "750000000",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const money = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₸";

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function fetchOffers(sku) {
  const res = await fetch("https://kaspi.kz/yml/offer-view/offers/" + sku, {
    method: "POST",
    headers: Object.assign({ Referer: "https://kaspi.kz/shop/p/-" + sku + "/" }, HEADERS),
    body: JSON.stringify({
      cityId: "750000000",
      id: String(sku),
      merchantUID: "",
      limit: 10,
      page: 0,
      sort: true,
      installationId: "-1",
      zoneId: ["Magnum_ZONE1"],
    }),
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

async function post(text) {
  if (DRY || !TG_TOKEN || !TG_CHANNEL) {
    console.log("\n--- would post ---\n" + text.replace(/<[^>]+>/g, "") + "\n");
    return { ok: true, dry: true };
  }
  const res = await fetch("https://api.telegram.org/bot" + TG_TOKEN + "/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TG_CHANNEL,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  return res.json();
}

// Factual phrasing only. KZ advertising law (ПК ст. 191, ЗРК "О рекламе" ст. 7)
// requires documentary proof for any superlative, so we never say "cheapest in
// Kazakhstan" — only what we measured, on which marketplace, and when.
function render(item, cur, prev, stamp) {
  const dropAbs = prev.price - cur.price;
  const dropPct = (dropAbs / prev.price) * 100;
  const lines = [
    "📉 <b>" + esc(item.title) + "</b>",
    "",
    "<b>" + money(cur.price) + "</b>  ·  было " + money(prev.price) +
      "  (−" + dropPct.toFixed(1) + "%, −" + money(dropAbs) + ")",
    "",
    "Продавец: " + esc(cur.merchantName) +
      (cur.merchantRating ? "  ⭐ " + cur.merchantRating + " (" + (cur.merchantReviewsQuantity || 0) + ")" : ""),
    "Предложений на товар: " + cur.total,
    "",
    '<a href="' + item.kaspiUrl + '">Открыть на Kaspi</a>',
    "",
    "<i>Минимальная цена на Kaspi в Алматы на " + stamp + "</i>",
  ];
  return lines.join("\n");
}

(async () => {
  if (!fs.existsSync(WATCHLIST)) {
    console.error("no watchlist — run: node scripts/watchlist.js");
    process.exit(1);
  }
  const watchlist = JSON.parse(fs.readFileSync(WATCHLIST, "utf8")).items || [];

  let state = {};
  if (fs.existsSync(STATE_FILE)) {
    try {
      // strip a BOM: an editor or PowerShell touching this file must not silently
      // wipe every baseline and leave the channel quiet for a whole cycle
      state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8").replace(/^﻿/, ""));
    } catch (e) {
      console.error("state file unreadable (" + e.message + ") — refusing to overwrite it");
      process.exit(1);
    }
  }
  const firstRun = !Object.keys(state).length;

  const now = new Date();
  const stamp = now.toLocaleString("ru-RU", {
    timeZone: "Asia/Almaty", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });

  const drops = [];
  let checked = 0, gone = 0, failed = 0;

  for (const item of watchlist) {
    let json;
    try {
      json = await fetchOffers(item.id);
    } catch (e) {
      failed++;
      console.error(item.id + ": " + e.message);
      await sleep(1500);
      continue;
    }
    checked++;

    const offers = (json && json.offers) || [];
    if (!offers.length) {
      gone++;
      state[item.id] = Object.assign({}, state[item.id], { available: false, checkedAt: now.toISOString() });
      await sleep(1200);
      continue;
    }

    // sort:true already returns ascending, but never trust that with money
    const best = offers.reduce((a, b) => (b.price < a.price ? b : a));
    const cur = {
      price: best.price,
      merchantName: best.merchantName,
      merchantRating: best.merchantRating || null,
      merchantReviewsQuantity: best.merchantReviewsQuantity || 0,
      total: json.total || offers.length,
    };

    const prev = state[item.id];
    if (prev && prev.available !== false && prev.price > cur.price) {
      const dropAbs = prev.price - cur.price;
      const dropPct = (dropAbs / prev.price) * 100;
      // The absolute floor kills rounding noise on expensive goods, but a third of
      // the list costs less than the floor itself — for those, a big enough
      // relative cut qualifies on its own.
      if (dropPct >= MIN_DROP_PCT && (dropAbs >= MIN_DROP_ABS || dropPct >= 15)) {
        drops.push({ item, cur, prev, dropPct, dropAbs });
      }
    }

    state[item.id] = Object.assign({}, cur, {
      available: true,
      title: item.title,
      checkedAt: now.toISOString(),
      low: prev && prev.low != null ? Math.min(prev.low, cur.price) : cur.price,
    });

    await sleep(1200); // ~1 req/s — polite, and 300 SKUs still fit in ~7 minutes
  }

  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");

  console.log(
    "\nchecked " + checked + " / watchlist " + watchlist.length +
    " · out of stock " + gone + " · failed " + failed + " · drops " + drops.length
  );

  if (firstRun) {
    console.log("first run — baselines recorded, nothing posted");
    return;
  }

  drops.sort((a, b) => b.dropPct - a.dropPct);
  const toPost = drops.slice(0, LIMIT);
  if (drops.length > toPost.length) {
    console.log("holding back " + (drops.length - toPost.length) + " smaller drops to keep the channel readable");
  }

  for (const d of toPost) {
    const r = await post(render(d.item, d.cur, d.prev, stamp));
    console.log((r.ok ? "posted  " : "FAILED  ") + d.dropPct.toFixed(1) + "%  " + d.item.title.slice(0, 60) +
      (r.ok ? "" : "  " + (r.description || "")));
    await sleep(3500); // Telegram throttles channel posts hard
  }
})();
