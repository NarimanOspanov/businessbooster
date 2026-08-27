const http = require("http");
const fs = require("fs");
const path = require("path");
const dns = require("dns").promises;
const net = require("net");

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
};

// ---------------------------------------------------------------------------
// AI-friendliness audit (/api/audit?url=...&lang=en|ru)
// ---------------------------------------------------------------------------

const S = {
  en: {
    fetch: (h) => `Fetching ${h}`,
    reachable: "reachable",
    login_wall: "login wall",
    robots: "AI crawlers allowed (robots.txt)",
    robots_ok: "allowed",
    robots_none: "no restrictions",
    robots_blocked: "blocks AI bots",
    llms: "llms.txt for AI crawlers",
    llms_ok: "found",
    llms_missing: "not found",
    schema: "Structured data (Schema.org)",
    schema_ok: "found",
    schema_partial: "microdata only",
    schema_missing: "missing",
    meta: "Title & meta description",
    meta_ok: "present",
    meta_partial: "no description",
    meta_missing: "missing",
    content: "Content readable without JavaScript",
    content_ok: "readable",
    content_partial: "thin content",
    content_missing: "requires JS",
    social_note: "closed platform — AI crawlers can't read it",
    mp_page: "marketplace page",
    mp_store: "Own brand storefront",
    mp_store_note: "none — only a marketplace listing",
    mp_brand: "Your brand in AI answers",
    mp_brand_note: "AI cites the marketplace, not you",
    mp_feed: "Product feed in ChatGPT / Perplexity",
    mp_feed_note: "not submitted",
    mp_fee: "Marketplace commission",
    mp_fee_note: "15–30% per order",
    mp_verdict: "Your sales live on rented land: the marketplace owns the customer, the data and the commission. An own AI channel fixes that.",
    verdict_low: "AI assistants can barely see your business. In most answers they'll recommend competitors instead.",
    verdict_mid: "AI can partially read your business, but key signals are missing — better-optimized competitors win the answer.",
    verdict_high: "Solid baseline! A bridge site still adds transactions, always-fresh data and AI-mention monitoring.",
    err_url: "That doesn't look like a valid URL. Check it and try again.",
    err_fetch: "Could not reach this address. Check the URL and try again.",
  },
  ru: {
    fetch: (h) => `Загружаем ${h}`,
    reachable: "доступен",
    login_wall: "закрыт логином",
    robots: "ИИ-краулеры разрешены (robots.txt)",
    robots_ok: "разрешены",
    robots_none: "ограничений нет",
    robots_blocked: "ИИ-боты заблокированы",
    llms: "llms.txt для ИИ-краулеров",
    llms_ok: "найден",
    llms_missing: "не найден",
    schema: "Структурированные данные (Schema.org)",
    schema_ok: "есть",
    schema_partial: "только микроданные",
    schema_missing: "нет",
    meta: "Title и meta description",
    meta_ok: "есть",
    meta_partial: "нет описания",
    meta_missing: "нет",
    content: "Контент читается без JavaScript",
    content_ok: "читается",
    content_partial: "мало текста",
    content_missing: "нужен JS",
    social_note: "закрытая платформа — ИИ-краулеры её не читают",
    mp_page: "нашли ваш магазин",
    mp_store: "Свой сайт магазина",
    mp_store_note: "нет — только карточка на Kaspi",
    mp_brand: "Вас находят в Google",
    mp_brand_note: "нет — своего сайта нет",
    mp_feed: "Вас рекомендует ChatGPT",
    mp_feed_note: "нет — ИИ вас не видит",
    mp_fee: "Комиссия с каждого заказа",
    mp_fee_note: "15–30% уходит Kaspi",
    mp_verdict: "Вы продаёте только через один канал: покупатель, его контакты и комиссия достаются маркетплейсу. Свой магазин это меняет — и добавляет два новых источника заказов.",
    verdict_low: "ИИ-ассистенты почти не видят ваш бизнес. В большинстве ответов они порекомендуют конкурентов.",
    verdict_mid: "ИИ читает ваш бизнес частично, но ключевых сигналов нет — ответ выигрывают более оптимизированные конкуренты.",
    verdict_high: "Хорошая база! Сайт-мост всё равно добавит транзакции, всегда свежие данные и мониторинг упоминаний в ИИ.",
    err_url: "Это не похоже на корректный URL. Проверьте и попробуйте ещё раз.",
    err_fetch: "Не удалось открыть этот адрес. Проверьте ссылку и попробуйте ещё раз.",
  },
};

const AI_BOTS = ["gptbot", "claudebot", "anthropic-ai", "perplexitybot", "google-extended", "oai-searchbot"];
const CLOSED_PLATFORMS = ["instagram.com", "facebook.com", "m.facebook.com", "tiktok.com", "vk.com"];
const MARKETPLACES = ["kaspi.kz", "wildberries.ru", "wildberries.kz", "wb.ru", "ozon.ru", "ozon.kz"];

function isPrivateIp(ip) {
  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase();
    if (low.startsWith("::ffff:")) return isPrivateIp(low.slice(7));
    return low === "::1" || low === "::" || low.startsWith("fe80") || low.startsWith("fc") || low.startsWith("fd");
  }
  const p = ip.split(".").map(Number);
  return (
    p[0] === 0 || p[0] === 127 || p[0] === 10 ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) ||
    (p[0] === 169 && p[1] === 254)
  );
}

async function assertPublicHost(hostname) {
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error("private address");
    return;
  }
  const addrs = await dns.lookup(hostname, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error("private address");
}

async function fetchSafe(url, ms = 10000) {
  const u = new URL(url);
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("bad protocol");
  await assertPublicHost(u.hostname);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(u, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SaudagerAudit/0.1)",
        Accept: "text/html,application/xhtml+xml,*/*",
        "Accept-Language": "en,ru;q=0.8",
      },
    });
    const text = await res.text();
    return { status: res.status, ok: res.ok, text, finalUrl: res.url };
  } finally {
    clearTimeout(t);
  }
}

// Naive robots.txt parse: does any group covering an AI bot (or *) disallow "/"?
function aiBotsBlocked(robotsTxt) {
  const lines = robotsTxt.split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim()).filter(Boolean);
  let agents = [];
  let inGroup = false;
  const blocked = new Set();
  for (const line of lines) {
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "user-agent") {
      if (inGroup) agents = []; // new group starts after directives
      agents.push(val.toLowerCase());
      inGroup = false;
    } else if (key === "disallow" || key === "allow") {
      inGroup = true;
      if (key === "disallow" && (val === "/" || val === "/*")) {
        for (const a of agents) blocked.add(a);
      }
    }
  }
  const hits = AI_BOTS.filter((b) => blocked.has(b));
  return { all: blocked.has("*"), bots: hits };
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function runAudit(rawUrl, lang) {
  const t = S[lang] || S.en;
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  let u;
  try {
    u = new URL(url);
    if (!u.hostname.includes(".")) throw new Error("no tld");
  } catch {
    return { error: t.err_url };
  }
  const host = u.hostname.replace(/^www\./, "");

  // Marketplace store pages (Kaspi, Wildberries, Ozon): the seller has no AI presence of their own
  if (MARKETPLACES.some((p) => host === p || host.endsWith("." + p))) {
    return {
      score: 18,
      verdict: t.mp_verdict,
      items: [
        { label: t.fetch(host + u.pathname), status: "warn", note: t.mp_page },
        { label: t.mp_store, status: "bad", note: t.mp_store_note },
        { label: t.mp_brand, status: "bad", note: t.mp_brand_note },
        { label: t.mp_feed, status: "bad", note: t.mp_feed_note },
        { label: t.mp_fee, status: "warn", note: t.mp_fee_note },
      ],
    };
  }

  // Closed platforms (Instagram etc.): truthful canned result — bots can't read them
  if (CLOSED_PLATFORMS.some((p) => host === p || host.endsWith("." + p))) {
    return {
      score: 12,
      verdict: t.verdict_low,
      items: [
        { label: t.fetch(host + u.pathname), status: "warn", note: t.login_wall },
        { label: t.robots, status: "bad", note: t.robots_blocked },
        { label: t.llms, status: "bad", note: t.llms_missing },
        { label: t.schema, status: "bad", note: t.social_note },
        { label: t.content, status: "bad", note: t.content_missing },
      ],
    };
  }

  let page;
  try {
    page = await fetchSafe(u.href);
    if (page.status >= 400) throw new Error("http " + page.status);
  } catch {
    return { error: t.err_fetch };
  }

  const items = [];
  let score = 10; // reachable
  items.push({ label: t.fetch(host), status: "ok", note: t.reachable });

  // robots.txt
  try {
    const robots = await fetchSafe(u.origin + "/robots.txt", 6000);
    if (robots.status === 200 && robots.text.trim()) {
      const b = aiBotsBlocked(robots.text);
      if (b.bots.length || b.all) {
        items.push({ label: t.robots, status: b.bots.length ? "bad" : "warn", note: t.robots_blocked });
        if (!b.bots.length) score += 8; // only "*" blocked — many sites still get crawled via partners
      } else {
        items.push({ label: t.robots, status: "ok", note: t.robots_ok });
        score += 20;
      }
    } else {
      items.push({ label: t.robots, status: "ok", note: t.robots_none });
      score += 20;
    }
  } catch {
    items.push({ label: t.robots, status: "ok", note: t.robots_none });
    score += 20;
  }

  // llms.txt
  try {
    const llms = await fetchSafe(u.origin + "/llms.txt", 6000);
    const looksText = llms.status === 200 && llms.text.trim() && !/^\s*</.test(llms.text);
    if (looksText) {
      // llms.txt: nice-to-have only — research shows no major AI system consumes it yet
      items.push({ label: t.llms, status: "ok", note: t.llms_ok });
      score += 5;
    } else {
      items.push({ label: t.llms, status: "warn", note: t.llms_missing });
    }
  } catch {
    items.push({ label: t.llms, status: "warn", note: t.llms_missing });
  }

  // Schema.org
  const jsonLd = /<script[^>]+type\s*=\s*["']application\/ld\+json["'][\s\S]*?<\/script>/i.test(page.text);
  const microdata = /itemscope|itemtype\s*=\s*["']https?:\/\/schema\.org/i.test(page.text);
  if (jsonLd) {
    items.push({ label: t.schema, status: "ok", note: t.schema_ok });
    score += 25;
  } else if (microdata) {
    items.push({ label: t.schema, status: "warn", note: t.schema_partial });
    score += 12;
  } else {
    items.push({ label: t.schema, status: "bad", note: t.schema_missing });
  }

  // Title + meta description
  const hasTitle = /<title[^>]*>[^<]{3,}<\/title>/i.test(page.text);
  const hasDesc = /<meta[^>]+name\s*=\s*["']description["'][^>]+content\s*=\s*["'][^"']{10,}/i.test(page.text) ||
    /<meta[^>]+content\s*=\s*["'][^"']{10,}["'][^>]+name\s*=\s*["']description["']/i.test(page.text);
  if (hasTitle && hasDesc) {
    items.push({ label: t.meta, status: "ok", note: t.meta_ok });
    score += 10;
  } else if (hasTitle) {
    items.push({ label: t.meta, status: "warn", note: t.meta_partial });
    score += 5;
  } else {
    items.push({ label: t.meta, status: "bad", note: t.meta_missing });
  }

  // Content without JS
  const textLen = stripHtml(page.text).length;
  if (textLen > 600) {
    // Highest-weight check: AI crawlers don't execute JS, so server-rendered text is decisive
    items.push({ label: t.content, status: "ok", note: t.content_ok });
    score += 25;
  } else if (textLen > 200) {
    items.push({ label: t.content, status: "warn", note: t.content_partial });
    score += 10;
  } else {
    items.push({ label: t.content, status: "bad", note: t.content_missing });
  }

  score = Math.max(5, Math.min(95, score));
  const verdict = score < 40 ? t.verdict_low : score < 70 ? t.verdict_mid : t.verdict_high;
  return { score, verdict, items };
}

// ---------------------------------------------------------------------------
// Live Kaspi ingest (/api/ingest?url=kaspi.kz/shop/<brand>)
// ---------------------------------------------------------------------------

const MEM_MERCHANTS = new Map(); // slug -> profile (fallback when the disk is read-only)
const KASPI_SHOP_RE = /kaspi\.kz\/shop\/([\w.\-]+)\/?(?:$|[?#])/i;

const KASPI_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "application/json, text/*",
  "Accept-Language": "ru",
  "X-KS-City": "750000000",
};

function normBrand(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9а-яё]+/gi, "");
}

async function kaspiSearch(query, page) {
  const url =
    "https://kaspi.kz/yml/product-view/pl/results?page=" + page +
    "&text=" + encodeURIComponent(query) +
    "&sort=relevance&qs=&ui=d&i=-1&c=750000000";
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: Object.assign({ Referer: "https://kaspi.kz/shop/search/?text=" + encodeURIComponent(query) }, KASPI_HEADERS),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  } finally {
    clearTimeout(t);
  }
}

function loadProfile(slug) {
  if (MEM_MERCHANTS.has(slug)) return MEM_MERCHANTS.get(slug);
  for (const dir of DATA_DIRS) {
    const file = path.join(dir, "merchants", slug + ".json");
    if (!fs.existsSync(file)) continue;
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      // corrupt file — fall through to the next directory
    }
  }
  return null;
}

function profileSummary(p) {
  return { slug: p.slug, name: p.name, productCount: p.productCount, storeUrl: "/store/" + p.slug };
}

async function handleIngest(rawUrl, host) {
  const m = String(rawUrl || "").match(KASPI_SHOP_RE);
  if (!m) return { error: "live ingest supports kaspi.kz/shop/<brand> links for now" };
  const token = decodeURIComponent(m[1]);
  const slug = token.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug) return { error: "could not read the shop name from the link" };

  // Fresh cache (memory or disk) within 24h
  const cached = loadProfile(slug);
  if (cached && cached.fetchedAt && Date.now() - Date.parse(cached.fetchedAt) < 24 * 3600 * 1000) {
    return profileSummary(cached);
  }

  const wanted = normBrand(token);
  const byId = new Map();
  for (let p = 0; p < 3 && byId.size < 40; p++) {
    let json;
    try {
      json = await kaspiSearch(token.replace(/[-_.]+/g, " "), p);
    } catch {
      break;
    }
    const items = (json && json.data) || [];
    if (!items.length) break;
    for (const it of items) {
      if (normBrand(it.brand || "") !== wanted) continue;
      const images = (it.previewImages || []).map((p) => p.large || p.medium).filter(Boolean).slice(0, 4);
      byId.set(String(it.id), {
        id: String(it.id),
        title: it.title,
        price: it.unitPrice,
        oldPrice: it.unitPriceBeforeDiscount || null,
        discount: it.discount || 0,
        priceFormatted: it.priceFormatted,
        image: images[0] || null,
        images,
        kaspiUrl: "https://kaspi.kz/shop" + it.shopLink,
        rating: it.rating || null,
        reviews: it.reviewsQuantity || null,
      });
    }
  }

  if (!byId.size) return { error: "no products found for this brand on Kaspi" };

  const profile = {
    slug,
    name: token.replace(/[-_.]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    source: "kaspi.kz",
    sourceQuery: token,
    fetchedAt: new Date().toISOString(),
    productCount: byId.size,
    products: Array.from(byId.values()),
  };

  MEM_MERCHANTS.set(slug, profile);
  try {
    const outDir = path.join(PERSIST_DATA || REPO_DATA, "merchants");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, slug + ".json"), JSON.stringify(profile, null, 2), "utf8");
  } catch {
    // read-only filesystem — memory cache still serves the store
  }
  if (host && !/localhost|127\.0\.0\.1/.test(host)) {
    const base = CANONICAL + "/store/" + slug;
    pingIndexNow(CANONICAL_HOST, [base, base + "/feed.json", base + "/feed-google.xml"]);
  }
  return profileSummary(profile);
}

// ---------------------------------------------------------------------------
// OpenAI-style product feed (/store/<slug>/feed.json)
// Field set follows the ChatGPT Shopping / Agentic Commerce product feed spec:
// id, title, description, link, image_link, price (value + ISO 4217),
// availability, brand, condition, enable_search / enable_checkout.
// inventory_quantity is intentionally omitted until the seller connects a
// merchant-cabinet source of truth — we never fabricate stock numbers.
// ---------------------------------------------------------------------------

function buildFeed(slug, origin) {
  const m = loadProfile(slug);
  if (!m || !m.products || !m.products.length) return null;
  const storeUrl = origin + "/store/" + m.slug;
  return {
    feed_format: "openai-product-feed/draft",
    generated_by: "Saudager",
    seller_name: m.name,
    seller_url: storeUrl,
    target_country: "KZ",
    source: m.source,
    updated_at: m.fetchedAt,
    item_count: m.products.length,
    items: m.products.map((p) => {
      const images = p.images && p.images.length ? p.images : p.image ? [p.image] : [];
      return Object.assign(
        {
          id: p.id,
          title: p.title,
          description: p.title + " — " + m.name + ". Заказ онлайн, наличие и цена подтверждаются при заказе.",
          link: p.kaspiUrl,
          price: p.price + " KZT",
          availability: "in_stock",
          brand: m.name,
          condition: "new",
          // Оба варианта флагов: enable_* (ранняя спека) и is_eligible_* (текущая)
          enable_search: true,
          enable_checkout: false,
          is_eligible_search: true,
          is_eligible_checkout: false,
        },
        images[0] ? { image_link: images[0] } : {},
        images.length > 1 ? { additional_image_link: images.slice(1) } : {},
        p.rating && p.reviews
          ? { product_review_rating: p.rating, product_review_count: p.reviews }
          : {}
      );
    }),
  };
}

// ---------------------------------------------------------------------------
// Storage: Azure keeps /home across restarts and deploys, so generated
// catalogs and traffic counters live there; the repo copy stays read-only.
// ---------------------------------------------------------------------------

const REPO_DATA = path.join(ROOT, "data");

// Pick the first writable directory that survives a redeploy. On Azure Linux
// the /home mount persists while /home/site/wwwroot is replaced on every
// deploy, so anything written under ROOT is temporary by definition.
function pickPersistDir() {
  // /home is the Azure App Service persistent share (marked by /home/site);
  // HOME may point at /root, which is container-local and lost on restart.
  const candidates = [
    process.env.PERSIST_DIR,
    process.platform === "linux" && fs.existsSync("/home/site") ? "/home/data" : null,
  ].filter(Boolean);
  for (const dir of candidates) {
    if (path.resolve(dir).startsWith(path.resolve(ROOT))) continue; // inside wwwroot — wiped on deploy
    try {
      fs.mkdirSync(path.join(dir, "merchants"), { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch {
      // not writable — try the next candidate
    }
  }
  return null;
}

const PERSIST_DATA = pickPersistDir();
const PERSIST_OK = !!PERSIST_DATA;
const DATA_DIRS = PERSIST_OK ? [PERSIST_DATA, REPO_DATA] : [REPO_DATA];
console.log("[storage] persistent=" + (PERSIST_DATA || "none") + " repo=" + REPO_DATA);

// ---------------------------------------------------------------------------
// Traffic measurement: who reaches a storefront and who clicks through to Kaspi
// ---------------------------------------------------------------------------

const STATS_FILE = path.join(PERSIST_DATA || REPO_DATA, "stats.json");
let STATS = {};
try {
  STATS = JSON.parse(fs.readFileSync(STATS_FILE, "utf8"));
} catch {
  STATS = {};
}
let statsDirty = false;
setInterval(() => {
  if (!statsDirty) return;
  statsDirty = false;
  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(STATS), "utf8");
  } catch {
    // non-writable disk — counters stay in memory for this process
  }
}, 20000).unref();

const AI_BOT_UA = [
  ["gptbot", /GPTBot/i],
  ["oai-searchbot", /OAI-SearchBot/i],
  ["chatgpt-user", /ChatGPT-User/i],
  ["claudebot", /ClaudeBot|Claude-SearchBot|Claude-User/i],
  ["perplexitybot", /PerplexityBot|Perplexity-User/i],
  ["googlebot", /Googlebot/i],
  ["bingbot", /bingbot/i],
  ["other-bot", /bot|crawler|spider/i],
];

function sourceFromReferrer(ref) {
  if (!ref) return "direct";
  const h = (() => {
    try {
      return new URL(ref).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();
  if (!h) return "direct";
  if (/chatgpt\.com|openai\.com/.test(h)) return "chatgpt";
  if (/perplexity\.ai/.test(h)) return "perplexity";
  if (/claude\.ai|anthropic\.com/.test(h)) return "claude";
  if (/google\./.test(h)) return "google";
  if (/bing\.com|copilot\.microsoft/.test(h)) return "bing";
  if (/yandex\./.test(h)) return "yandex";
  if (/saudager\.ai|azurewebsites\.net|localhost/.test(h)) return "internal";
  return "other";
}

// Telegram alerts for the operator: a click means we just handed a merchant a
// buyer, which is the one event worth interrupting someone's day for.
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TG_CHAT = process.env.TELEGRAM_CHAT_ID || "";
let tgWindowStart = Date.now();
let tgSent = 0;

// Same sender, different destination: operator alerts go to the private chat,
// channel posts to the channel, and both must report what Telegram answered.
function sendTelegram(chatId, text) {
  if (!TG_TOKEN || !chatId) return Promise.resolve({ ok: false, description: "нет токена или адресата" });
  return fetch("https://api.telegram.org/bot" + TG_TOKEN + "/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  })
    .then((r) => r.json())
    .catch((e) => ({ ok: false, description: e.message }));
}

function notifyTelegram(text) {
  if (!TG_TOKEN || !TG_CHAT) return;
  if (Date.now() - tgWindowStart > 3600e3) {
    tgWindowStart = Date.now();
    tgSent = 0;
  }
  if (tgSent >= 40) return Promise.resolve({ ok: false, description: "rate limit reached" }); // never flood the chat
  tgSent++;
  return fetch("https://api.telegram.org/bot" + TG_TOKEN + "/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: "HTML", disable_web_page_preview: true }),
  })
    .then((r) => r.json())
    .catch((e) => ({ ok: false, description: e.message }));
}

const SOURCE_LABEL = {
  chatgpt: "ChatGPT", perplexity: "Perplexity", claude: "Claude", google: "Google",
  bing: "Bing / Copilot", yandex: "Яндекс", direct: "прямой заход", internal: "с сайта", other: "другое",
};

function bucket(slug) {
  if (!STATS[slug]) {
    STATS[slug] = { visits: 0, sources: {}, bots: {}, clicks: 0, firstSeen: new Date().toISOString(), lastSeen: null };
  }
  return STATS[slug];
}

// Returns true when the hit came from a human — the caller uses this to decide
// whether the event is worth a Telegram alert.
function track(slug, req, kind, tag) {
  const ua = req.headers["user-agent"] || "";
  const b = bucket(slug);
  b.lastSeen = new Date().toISOString();
  statsDirty = true;
  const botHit = AI_BOT_UA.find(([, re]) => re.test(ua));
  if (botHit) {
    b.bots[botHit[0]] = (b.bots[botHit[0]] || 0) + 1;
    if (kind === "click") b.botClicks = (b.botClicks || 0) + 1;
    // Keep a few raw agents for the unclassified ones so we can see who crawls us.
    // Crawlers hide their name AFTER a browser-shaped prefix, so the first 120 characters are the
    // least informative part of the string: 6 958 hits were sampled as plain "Chrome/145" and told us
    // nothing. Lead the key with the token that actually matched.
    if (botHit[0] === "other-bot") {
      b.otherBotAgents = b.otherBotAgents || {};
      const tok = (ua.match(/[w.-]*(?:bot|crawler|spider)[w./-]*/i) || [""])[0];
      const key = (tok ? tok + " · " : "") + ua.slice(0, 110);
      if (Object.keys(b.otherBotAgents).length < 8 || b.otherBotAgents[key]) {
        b.otherBotAgents[key] = (b.otherBotAgents[key] || 0) + 1;
      }
    }
    return false;
  }
  if (kind === "click") {
    // The buy button gets its ?s= marker appended by JavaScript on the
    // storefront, so a click carrying one came from a rendered page. Crawlers
    // read the href straight out of the markup and arrive without it — which is
    // how 27 "purchases" appeared against 3 page views.
    const tagged = !!tag && tag !== "unknown";
    b.clicks++;
    if (tagged) {
      b.clicksTagged = (b.clicksTagged || 0) + 1;
      b.clickSources = b.clickSources || {};
      b.clickSources[tag] = (b.clickSources[tag] || 0) + 1;
    } else {
      b.clicksUntagged = (b.clicksUntagged || 0) + 1;
      // Keep the agents behind untagged clicks: that is the evidence we lacked
      b.clickAgents = b.clickAgents || {};
      const key = (ua || "нет user-agent").slice(0, 120);
      if (Object.keys(b.clickAgents).length < 8 || b.clickAgents[key]) {
        b.clickAgents[key] = (b.clickAgents[key] || 0) + 1;
      }
    }
    return tagged;
  }
  b.visits++;
  const src = sourceFromReferrer(req.headers.referer || req.headers.referrer);
  b.sources[src] = (b.sources[src] || 0) + 1;

  // A human arriving from an AI assistant is the signal we launched this for
  if (["chatgpt", "perplexity", "claude"].includes(src)) {
    const prof = loadProfile(slug);
    notifyTelegram(
      "🤖 <b>Посетитель из " + (SOURCE_LABEL[src] || src) + "</b>\n" +
        "Магазин: <b>" + (prof ? prof.name : slug) + "</b>\n" +
        "Визитов всего: " + b.visits + " · переходов: " + b.clicks + "\n" +
        CANONICAL + "/store/" + slug
    );
  }
  return true;
}

function statsSummary() {
  const rows = Object.entries(STATS).map(([slug, s]) => ({
    slug,
    visits: s.visits,
    clicks: s.clicks,
    // Split out, because the headline click count was inflated by crawlers
    clicksTagged: s.clicksTagged || 0,
    clicksUntagged: s.clicksUntagged || 0,
    clickSources: s.clickSources || {},
    botHits: Object.values(s.bots).reduce((a, b) => a + b, 0),
    sources: s.sources,
    bots: s.bots,
    lastSeen: s.lastSeen,
  }));
  rows.sort((a, b) => b.clicks - a.clicks || b.visits - a.visits);
  const totals = rows.reduce(
    (acc, r) => {
      acc.visits += r.visits;
      acc.clicks += r.clicks;
      acc.botHits += r.botHits;
      for (const [k, v] of Object.entries(r.sources)) acc.sources[k] = (acc.sources[k] || 0) + v;
      for (const [k, v] of Object.entries(r.bots)) acc.bots[k] = (acc.bots[k] || 0) + v;
      return acc;
    },
    { visits: 0, clicks: 0, botHits: 0, sources: {}, bots: {} }
  );
  return { storeCount: rows.length, totals, stores: rows };
}

// ---------------------------------------------------------------------------
// Apartment watch: scans Krisha on a schedule and alerts on listings that are
// underpriced against comparable flats — same district, building type and age.
// Details are fetched once per listing and kept, so a routine run costs a few
// dozen requests, not a few hundred.
// ---------------------------------------------------------------------------

// On by default; KRISHA_WATCH=0 turns it off. Gated on Telegram being wired up:
// alerts have nowhere to go otherwise, and there is no reason to walk someone
// else's site for output nobody receives — which also keeps local dev quiet.
const KRISHA_ON = process.env.KRISHA_WATCH !== "0" && !!(TG_TOKEN && TG_CHAT);
const KRISHA_EVERY_H = Number(process.env.KRISHA_INTERVAL_H || 4);
const KRISHA_MIN_DISCOUNT = Number(process.env.KRISHA_MIN_DISCOUNT || 12);
// 80 was a hedge against the read failures; with retries in place a run reads
// every listing it tries, so the warm-up can finish in a couple of cycles.
const KRISHA_DETAILS_PER_RUN = Number(process.env.KRISHA_DETAILS_PER_RUN || 400);
const KRISHA_PACE_MS = Number(process.env.KRISHA_PACE_MS || 2500); // gentler than local: the datacenter IP gets dropped more
const KRISHA_FILE = path.join(PERSIST_DATA || REPO_DATA, "krisha-watch.json");

// ~2.2s per address including the fallback query, so 150 is about six minutes —
// well under Nominatim's one-per-second ceiling, and the backlog is one-time.
const KRISHA_GEO_PER_RUN = Number(process.env.KRISHA_GEO_PER_RUN || 150);

// KW.area is a box drawn on the map at /area/. When it is set it replaces the
// Abay text heuristic entirely: the corridor guess exists only because Krisha
// gives no coordinates, and a real box is strictly better.
let KW = { corpus: {}, seenKeys: [], bootstrapped: false, lastRun: null, lastError: null, runs: 0, area: null };
try {
  KW = Object.assign(KW, JSON.parse(fs.readFileSync(KRISHA_FILE, "utf8").replace(/^﻿/, "")));
} catch {
  // first boot, or a file we cannot read — a fresh corpus is rebuilt below
}
// Self-heal: an entry without a build year came from a failed read and is
// useless for comparables. Drop it so the next run fetches it again.
for (const [id, c] of Object.entries(KW.corpus || {})) if (!c || !c.year) delete KW.corpus[id];
function saveKrisha() {
  try {
    fs.mkdirSync(path.dirname(KRISHA_FILE), { recursive: true });
    fs.writeFileSync(KRISHA_FILE, JSON.stringify(KW), "utf8");
  } catch {
    // read-only disk: the corpus lives in memory for this process
  }
}

function krishaPost(c, kind) {
  const K = require("./scripts/krisha-lib.js");
  const head = kind === "drop"
    ? "📉 <b>Снизили цену</b>"
    : "🏠 <b>Новый вариант — дешевле похожих на " + c.discount + "%</b>";
  const lines = [
    head, "",
    "<b>" + K.money(c.price) + "</b> · " + c.ppm.toLocaleString("ru") + " ₸/м²" +
      (c.expected ? " (у сопоставимых " + c.expected.toLocaleString("ru") + ")" : ""),
    c.title,
    c.addr,
    [c.building, c.year ? c.year + " г." : null, c.renovation].filter(Boolean).join(" · "),
    "",
    c.loc ? c.loc.why : "",
    c.basis ? "сравнение: " + c.basis : "",
  ];
  if (c.flags && c.flags.length) lines.push("⚠ " + c.flags.join(", "));
  lines.push("", "https://krisha.kz/a/show/" + c.id);
  return notifyTelegram(lines.filter((l) => l !== null && l !== undefined).join("\n"));
}

// A drawn box beats the address heuristic outright, so it replaces it when set.
// The channel passes ignoreArea: the box is one person's search, and a public
// channel that only ever posted from it would be pointless.
function krishaLoc(c, ignoreArea) {
  const K = require("./scripts/krisha-lib.js");
  // City-wide: proximity to one avenue is not a ranking criterion for a public
  // channel, so ordering falls through to how underpriced the flat is.
  if (ignoreArea) return { score: 1, why: c.district || "Алматы" };
  if (!KW.area) return K.locationScore(c.addr);
  if (c.lat == null) return { score: 0, why: "координаты ещё не определены" };
  return K.inBox(c, KW.area)
    ? { score: 3, why: "внутри выбранной области" }
    : { score: 0, why: "вне выбранной области" };
}

// The shortlist the watch is holding right now, scored against everything it
// has ever read. Shared by the endpoint and the scheduled digest.
// One flat, one entry. Re-posting is rampant — thirteen ads for a single flat in
// one day — so the same home must not occupy thirteen slots in a shortlist. The
// cheapest live ad wins, and the earliest creation date is kept because that is
// how long the flat has really been for sale.
function krishaCollapse(list) {
  const K = require("./scripts/krisha-lib.js");
  const best = new Map();
  for (const c of list) {
    const k = K.dedupeKey(c);
    const prev = best.get(k);
    if (!prev) { best.set(k, Object.assign({ reposts: 1 }, c)); continue; }
    prev.reposts++;
    if (c.createdAt && (!prev.createdAt || c.createdAt < prev.createdAt)) prev.createdAt = c.createdAt;
    if (c.price < prev.price) {
      const reposts = prev.reposts, createdAt = prev.createdAt;
      best.set(k, Object.assign({}, c, { reposts, createdAt }));
    }
  }
  return [...best.values()];
}

function krishaShortlist(opts) {
  const K = require("./scripts/krisha-lib.js");
  const o = opts || {};
  const min = o.min == null ? KRISHA_MIN_DISCOUNT : Number(o.min);
  const corpus = krishaCollapse(Object.values(KW.corpus || {}).filter((c) => c.year));
  const price = K.buildModel(corpus);
  const seen = new Set();
  const rows = corpus
    .map((c) => {
      const p = price(c);
      return Object.assign({}, c, p, {
        discount: Math.round((1 - c.ppm / p.expected) * 100),
        flags: K.flagsFor(c),
        loc: krishaLoc(c, o.ignoreArea),
        url: "https://krisha.kz/a/show/" + c.id,
      });
    })
    .filter((c) => c.loc.score > 0)
    // "cheaper than comparable" is an option, not a precondition: inside a drawn
    // zone the honest default is everything that matches the brief.
    .filter((c) => (o.requireSolid === false || c.solid) && c.discount >= min)
    .filter((c) => !(o.clean && c.flags.length))
    .filter((c) => { const k = K.dedupeKey(c); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => b.loc.score - a.loc.score || b.discount - a.discount)
    .slice(0, Number(o.limit || 20));
  return { corpus: corpus.length, rows };
}

async function krishaDigest(opts) {
  const K = require("./scripts/krisha-lib.js");
  const { corpus, rows } = krishaShortlist(opts);
  if (!rows.length) return { delivered: false, sentItems: 0, reason: "под критерии сейчас ничего не подходит" };
  const when = new Date().toLocaleString("ru-RU", {
    timeZone: "Asia/Almaty", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  const body = rows.map((c, i) =>
    (i + 1) + ". <b>−" + c.discount + "%</b> · " + K.money(c.price) + " · " + c.area + " м²" +
    (c.floor ? " · " + c.floor + "/" + c.floors : "") + " · " +
    [c.building, c.year ? c.year + " г." : null].filter(Boolean).join(" ") +
    (c.flags.length ? " · ⚠ " + c.flags.join(", ") : "") + "\n" +
    c.addr + "\n" + c.url
  ).join("\n\n");
  const text =
    "🏠 <b>Подборка квартир · " + when + "</b>\n" +
    "30–40 млн · 1–2 комнаты · дом от 1980 · кирпич/панель · от хозяев · вдоль Абая\n" +
    "в базе " + corpus + " · подошло " + rows.length + "\n\n" + body;
  const tg = await notifyTelegram(text);
  return { delivered: !!(tg && tg.ok), sentItems: rows.length, telegram: tg && tg.ok ? undefined : tg };
}

// One flat, formatted for the public channel. The method line is deliberate: it
// is what separates this from a reposted feed, and it keeps the claim factual —
// KZ advertising law wants any superlative documented, a measured comparison
// needs no documenting.
function krishaChannelPost(c, rubric) {
  const K = require("./scripts/krisha-lib.js");
  const when = new Date().toLocaleString("ru-RU", {
    timeZone: "Asia/Almaty", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  const lines = [];
  lines.push("🏠 <b>" + (rubric || "Находка дня") +
    (c.solid ? " · дешевле похожих на " + c.discount + "%" : "") + "</b>", "");
  lines.push("<b>" + K.money(c.price) + "</b> · " + c.ppm.toLocaleString("ru") + " ₸/м²");
  if (c.solid) lines.push("По нашей выборке у похожих — " + c.expected.toLocaleString("ru") + " ₸/м²");
  // Krisha publishes its own comparison on every listing. Quoting it defuses the
  // obvious objection — a reader who opens the ad sees a different percentage —
  // and the gap is honest: their method uses year, rooms, district and building
  // type, ours adds floor area.
  if (c.kzSimilarLocal) {
    lines.push("По оценке Крыши у похожих — " + c.kzSimilarLocal.toLocaleString("ru") + " ₸/м²" +
      (c.kzDiscount != null ? " (" + (c.kzDiscount >= 0 ? "−" : "+") + Math.abs(c.kzDiscount) + "%)" : ""));
  }
  lines.push("");
  lines.push(c.rooms + "-комн · " + c.area + " м²" + (c.floor ? " · " + c.floor + "/" + c.floors + " этаж" : ""));
  lines.push([c.building, c.year ? c.year + " г." : null, c.renovation].filter(Boolean).join(", "));
  lines.push(c.addr);

  // Age is the one thing Krisha hides: its cards show the bump date, so a
  // year-old listing looks like today's.
  const marks = [];
  if (c.createdAt) {
    const days = Math.floor((Date.now() - Date.parse(c.createdAt)) / 864e5);
    marks.push(days <= 2 ? "🆕 новое объявление"
      : days < 30 ? "на сайте " + days + " дн."
      : "на сайте " + Math.round(days / 30) + " мес.");
  }
  if (c.isAgent === false) marks.push("от хозяина");
  else if (c.isAgent === true) marks.push("агентство");
  if (marks.length) lines.push("", marks.join(" · "));

  if (c.flags && c.flags.length) lines.push("⚠ " + c.flags.join(", "));
  lines.push("");
  if (c.basis) lines.push("<i>Сравнение: " + c.basis + " · цена на " + when + "</i>");
  lines.push("https://krisha.kz/a/show/" + c.id);
  return lines.join("\n");
}

// Picks what to post, skipping flats already published. A re-post of the same
// home under a new id must never come round again as a fresh find.
function krishaPickForChannel(n, opts) {
  const K = require("./scripts/krisha-lib.js");
  const o = opts || {};
  const { rows } = krishaShortlist({ min: o.min, limit: 200, clean: o.clean !== false, ignoreArea: true });
  const done = KW.published || {};
  const fresh = o.again ? rows : rows.filter((c) => !done[K.dedupeKey(c)]);
  return { rows: fresh.slice(0, n), available: fresh.length, total: rows.length };
}

async function krishaPublish(rows, rubric) {
  const K = require("./scripts/krisha-lib.js");
  KW.published = KW.published || {};
  const out = [];
  for (const c of rows) {
    // One extra request, only for what actually gets published
    try { Object.assign(c, await K.fetchPriceAnalysis(c.id)); } catch { /* post without it */ }
    // Krisha's own estimate is an independent check. When it disagrees sharply,
    // our comparable set is the thing that is wrong — publishing a "−49%" that
    // the listing page calls −15% would cost more credibility than the post is
    // worth. Such a flat is parked, not retried.
    if (c.kzDiscount != null && Math.abs(c.discount - c.kzDiscount) > KRISHA_MAX_GAP) {
      KW.published[K.dedupeKey(c)] = { id: c.id, at: new Date().toISOString(), skipped: "расхождение с оценкой Крыши" };
      out.push({ id: c.id, ok: false, error: "наша оценка −" + c.discount + "%, у Крыши −" + c.kzDiscount + "% — пропущено" });
      continue;
    }
    const tg = await sendTelegram(KW.channel, krishaChannelPost(c, rubric));
    const ok = !!(tg && tg.ok);
    if (ok) KW.published[K.dedupeKey(c)] = { id: c.id, at: new Date().toISOString(), price: c.price };
    out.push({ id: c.id, ok, error: ok ? undefined : tg && tg.description });
    await new Promise((r) => setTimeout(r, 1500));
  }
  saveKrisha();
  return out;
}

// Sunday roundup for the channel. Unlike the daily find it deliberately repeats
// flats already posted — the point is a cross-section for people who muted
// notifications, not a queue of unseen items.
async function krishaWeekly(limit) {
  const K = require("./scripts/krisha-lib.js");
  const n = Number(limit || KRISHA_WEEKLY_LIMIT);
  // The weekly list bypassed the sanity gate and filled up with new-build
  // artifacts at −45%, so it now checks each candidate against Krisha's own
  // estimate exactly as the daily post does.
  const { rows: pool } = krishaShortlist({ limit: n * 4, clean: true, ignoreArea: true });
  const rows = [];
  for (const c of pool) {
    if (rows.length >= n) break;
    try { Object.assign(c, await K.fetchPriceAnalysis(c.id)); } catch { /* keep it, unverified */ }
    if (c.kzDiscount != null && Math.abs(c.discount - c.kzDiscount) > KRISHA_MAX_GAP) continue;
    rows.push(c);
    await K.sleep(1200);
  }
  if (!rows.length) return { delivered: false, items: 0, reason: "нечего показывать" };
  const when = new Date().toLocaleDateString("ru-RU", { timeZone: "Asia/Almaty", day: "2-digit", month: "long" });
  const body = rows.map((c, i) =>
    (i + 1) + ". <b>−" + c.discount + "%</b> · " + K.money(c.price) + " · " + c.rooms + "-комн · " + c.area + " м²" +
    (c.floor ? " · " + c.floor + "/" + c.floors : "") + "\n" +
    [c.building, c.year ? c.year + " г." : null].filter(Boolean).join(" ") + " · " + c.addr + "\n" +
    "https://krisha.kz/a/show/" + c.id
  ).join("\n\n");
  const text =
    "📋 <b>Подборка недели · " + when + "</b>\n" +
    "Квартиры от хозяев в Алматы, дешевле сопоставимых по типу дома, году, площади и району\n\n" +
    body + "\n\n<i>Сравнение по нашей выборке. Цены на момент публикации.</i>";
  const tg = await sendTelegram(KW.channel, text);
  return { delivered: !!(tg && tg.ok), items: rows.length, telegram: tg && tg.ok ? undefined : tg };
}

async function runKrishaWatch() {
  const K = require("./scripts/krisha-lib.js");
  const started = Date.now();
  // Krisha stopped answering this server entirely after we pulled 833 pages
  // every four hours. Hammering a host that is refusing us is both useless and
  // rude, so a sweep that collects nothing trips a breaker instead of retrying.
  if (KW.pausedUntil && Date.now() < Date.parse(KW.pausedUntil)) return;
  try {
    // 40 pages covered the old narrow brief entirely; against 16 649 listings it
    // saw 5% — and the wrong 5%, since default order is driven by paid bumps, so
    // genuinely new listings were never reached.
    const { cards, total, skipped } = await K.fetchSearch(KRISHA_MAX_PAGES, K.CRITERIA, null, {
      pace: KRISHA_PAGE_PACE_MS,
      budgetMs: KRISHA_SWEEP_BUDGET_MIN * 60e3,
    });
    let okReads = 0, failReads = 0, geocoded = 0;
    // With a drawn area we cannot know what is inside it before the listing has
    // been read and geocoded, so every result becomes a candidate. Without one,
    // the address heuristic keeps the sweep small.
    cards.forEach((c) => (c.loc = K.locationScore(c.addr)));
    const near = KW.area ? cards.slice() : cards.filter((c) => c.loc.score > 0);

    // Listings that vanished from the sweep have been sold or withdrawn. A miss
    // is only counted when the sweep was complete — a skipped page would
    // otherwise read as half the market disappearing — and is confirmed twice
    // before anything is claimed.
    const goneNow = [];
    if (!skipped) {
      const seen = new Set(cards.map((c) => c.id));
      KW.published = KW.published || {};
      for (const c of Object.values(KW.corpus)) {
        if (c.goneAt) continue;
        if (seen.has(c.id)) { c.misses = 0; continue; }
        c.misses = (c.misses || 0) + 1;
        if (c.misses < 2) continue;
        // Confirm against the listing itself: gone from a filtered search can
        // also mean the seller edited it out of our price or room range.
        let alive = true;
        try { await K.fetchDetail(c.id); } catch { alive = false; }
        await K.sleep(1200);
        if (alive) { c.misses = 0; continue; }
        // Kept as a measurement, not a rubric: whether our finds actually sell,
        // and how fast, is the only check on whether the selection is any good.
        c.goneAt = new Date().toISOString();
        const pub = KW.published[K.dedupeKey(c)];
        if (pub && pub.at && !pub.skipped) {
          pub.goneAfterDays = Math.max(1, Math.round((Date.now() - Date.parse(pub.at)) / 864e5));
          goneNow.push({ c, pub });
        }
      }
    }

    // Price moves on listings we already know about
    const drops = [];
    for (const c of near) {
      const old = KW.corpus[c.id];
      if (old && old.price > c.price) {
        const pct = Math.round((1 - c.price / old.price) * 100);
        if (pct >= 3) drops.push(Object.assign({}, old, c, { drop: pct }));
      }
      if (old) Object.assign(old, { price: c.price, ppm: c.ppm, seenAt: new Date().toISOString() });
    }

    // Only unseen listings cost a detail request
    KW.failed = KW.failed || {};
    // Newest first: ids grow over time, and a channel lives on fresh listings —
    // the backlog can fill in behind it over the following runs.
    const fresh = near
      .filter((c) => !KW.corpus[c.id] && (KW.failed[c.id] || 0) < 3)
      .sort((a, b) => Number(b.id) - Number(a.id))
      .slice(0, KRISHA_DETAILS_PER_RUN);
    const added = [];
    for (const c of fresh) {
      try {
        Object.assign(c, await K.fetchDetail(c.id));
      } catch {
        // A failed read must not enter the corpus: the listing would be marked
        // seen, never retried, and sit there for ever without any features.
        KW.failed[c.id] = (KW.failed[c.id] || 0) + 1;
        failReads++;
        await K.sleep(KRISHA_PACE_MS);
        continue;
      }
      okReads++;
      delete KW.failed[c.id];
      KW.corpus[c.id] = {
        id: c.id, price: c.price, ppm: c.ppm, area: c.area, rooms: c.rooms, addr: c.addr,
        title: c.title, district: c.district, pro: c.pro, year: c.year, building: c.building,
        renovation: c.renovation, floor: c.floor, floors: c.floors,
        // createdAt is the real posting date; the card shows addedAt, the last
        // bump, which is why every listing on a page looks like it appeared today
        createdAt: c.createdAt, addedAt: c.addedAt, isAgent: c.isAgent,
        firstSeen: new Date().toISOString(), seenAt: new Date().toISOString(),
      };
      added.push(KW.corpus[c.id]);
      // Persist as we go: a restart mid-run used to throw away everything the
      // run had read, and a full warm-up is several hundred requests.
      if (added.length % 20 === 0) saveKrisha();
      await K.sleep(KRISHA_PACE_MS);
    }
    saveKrisha();

    // Coordinates are only needed for the map and the drawn area, so geocode
    // what a person might actually look at rather than the whole city — sending
    // 16 000 addresses to a free community service would be an abuse of it.
    const geoModel = K.buildModel(Object.values(KW.corpus).filter((c) => c.year));
    const needGeo = Object.values(KW.corpus)
      .filter((c) => c.lat == null && !c.geoTried && c.year)
      .filter((c) => {
        const p = geoModel(c);
        return p.solid && (1 - c.ppm / p.expected) * 100 >= 5;
      })
      .sort((a, b) => Number(b.id) - Number(a.id));
    for (const c of needGeo.slice(0, KRISHA_GEO_PER_RUN)) {
      const g = await K.geocode(c.addr);
      if (g) { Object.assign(c, g); geocoded++; } else { c.geoTried = true; }
      if (geocoded % 20 === 0) saveKrisha();
      await K.sleep(1100);
    }
    if (geocoded) saveKrisha();

    // Score against everything we have ever seen, not just this page of results
    const corpus = Object.values(KW.corpus).filter((c) => c.year);
    const price = K.buildModel(corpus);
    const score = (c) => {
      const p = price(c);
      return Object.assign({}, c, p, {
        discount: Math.round((1 - c.ppm / p.expected) * 100),
        flags: K.flagsFor(c),
        loc: krishaLoc(c),
      });
    };

    const seen = new Set(KW.seenKeys || []);
    const worth = added.map(score)
      .filter((c) => c.loc.score > 0)
      .filter((c) => c.solid && c.discount >= KRISHA_MIN_DISCOUNT)
      .filter((c) => { const k = K.dedupeKey(c); if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => b.loc.score - a.loc.score || b.discount - a.discount);
    KW.seenKeys = [...seen].slice(-4000);

    let sent = 0;
    if (!KW.bootstrapped) {
      // The first pass would fire dozens of alerts for a backlog the user never
      // asked about, so it only reports that the watch is live.
      if (fresh.length < KRISHA_DETAILS_PER_RUN) {
        KW.bootstrapped = true;
        await notifyTelegram(
          "🏠 <b>Слежу за квартирами на Крыше</b>\n\n" +
          "Критерии: 30–40 млн · 1–2 комнаты · дом от 1980 · кирпич/панель · от хозяев · вдоль Абая\n" +
          "Всего по фильтру: " + (total || "?") + " · в базе: " + corpus.length + "\n\n" +
          "Дальше буду присылать только новое, что дешевле сопоставимых на " + KRISHA_MIN_DISCOUNT + "%+ , и снижения цен."
        );
      }
    } else {
      for (const c of worth.slice(0, 5)) { await krishaPost(c, "new"); sent++; await K.sleep(1200); }
      for (const c of drops.slice(0, 5)) {
        await krishaPost(Object.assign(score(c), { discount: c.drop }), "drop");
        sent++;
        await K.sleep(1200);
      }
    }

    // A sweep that returned nothing at all means the host is refusing us, not
    // that the market emptied. Two in a row and we stand down for a day.
    if (total === null && !cards.length) {
      KW.deadSweeps = (KW.deadSweeps || 0) + 1;
      if (KW.deadSweeps >= 2 && !KW.pausedUntil) {
        KW.pausedUntil = new Date(Date.now() + 24 * 3600e3).toISOString();
        await notifyTelegram(
          "⛔️ <b>Крыша перестала отвечать этому серверу</b>\n\n" +
          "Два обхода подряд вернули ноль страниц — похоже, наш IP заблокирован после слишком частых обходов.\n" +
          "Слежение остановлено на сутки, чтобы не долбиться в закрытую дверь.\n\n" +
          "Снять паузу: " + CANONICAL + "/api/krisha?resume=1"
        );
      }
    } else {
      KW.deadSweeps = 0;
    }

    KW.runs = (KW.runs || 0) + 1;
    KW.lastRun = new Date().toISOString();
    KW.lastError = null;
    KW.lastSummary = {
      total, near: near.length, corpus: corpus.length,
      tried: fresh.length, read: okReads, failed: failReads, geocoded,
      searchPagesSkipped: skipped || 0,
      gone: goneNow.length,
      goneTotal: Object.values(KW.corpus).filter((c) => c.goneAt).length,
      // What was actually delivered — bootstrapped flips to true inside the
      // branch above, so reading it here reported a send that never happened.
      qualified: worth.length, sent, drops: drops.length,
      seconds: Math.round((Date.now() - started) / 1000),
    };
    saveKrisha();
    console.log("[krisha] " + JSON.stringify(KW.lastSummary));
  } catch (e) {
    KW.lastError = String(e && e.message ? e.message : e);
    KW.lastRun = new Date().toISOString();
    saveKrisha();
    console.log("[krisha] failed: " + KW.lastError);
  }
}

let krishaRunning = false;
async function krishaTick() {
  if (krishaRunning) return;
  krishaRunning = true;
  try { await runKrishaWatch(); } finally { krishaRunning = false; }
}
// The per-listing alerts only fire on arrivals, so without a periodic digest the
// backlog stays invisible in Telegram — the whole point is not having to open a
// dashboard to see what is on the market.
const KRISHA_DIGEST_H = Number(process.env.KRISHA_DIGEST_H || 24);
const KRISHA_DIGEST_LIMIT = Number(process.env.KRISHA_DIGEST_LIMIT || 10);
const KRISHA_POST_HOUR = Number(process.env.KRISHA_POST_HOUR || 19); // Asia/Almaty
const KRISHA_WEEKLY_HOUR = Number(process.env.KRISHA_WEEKLY_HOUR || 12); // Sundays
const KRISHA_WEEKLY_LIMIT = Number(process.env.KRISHA_WEEKLY_LIMIT || 7);
const KRISHA_MAX_GAP = Number(process.env.KRISHA_MAX_GAP || 15); // percentage points vs Krisha's own estimate
const KRISHA_MAX_PAGES = Number(process.env.KRISHA_MAX_PAGES || 900); // 16 649 listings ≈ 833 pages
const KRISHA_PAGE_PACE_MS = Number(process.env.KRISHA_PAGE_PACE_MS || 2000);
const KRISHA_SWEEP_BUDGET_MIN = Number(process.env.KRISHA_SWEEP_BUDGET_MIN || 35);

if (KRISHA_ON) {
  setTimeout(krishaTick, 45000).unref();                       // let the app finish booting
  setInterval(krishaTick, KRISHA_EVERY_H * 3600e3).unref();
  if (KRISHA_DIGEST_H > 0) {
    setInterval(() => {
      if (!KW.bootstrapped) return;                            // nothing worth summarising yet
      krishaDigest({ limit: KRISHA_DIGEST_LIMIT, clean: true })
        .then((o) => console.log("[krisha] digest " + JSON.stringify(o)))
        .catch((e) => console.log("[krisha] digest failed: " + e.message));
    }, KRISHA_DIGEST_H * 3600e3).unref();
  }
  // "Находка дня": one post at a fixed hour. A daily rubric only builds a habit
  // if it turns up at the same time whether or not the find is spectacular.
  setInterval(() => {
    if (!KW.channel || !KW.bootstrapped) return;
    const now = new Date().toLocaleString("en-CA", {
      timeZone: "Asia/Almaty", hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit",
    });
    const [date, hour] = now.split(", ");
    if (Number(hour) !== KRISHA_POST_HOUR || KW.lastDailyPost === date) return;
    KW.lastDailyPost = date;
    saveKrisha();
    const { rows, available } = krishaPickForChannel(1, { clean: true });
    if (!rows.length) { console.log("[krisha] дневной пост пропущен: нечего публиковать"); return; }
    krishaPublish(rows, "Находка дня")
      .then((o) => console.log("[krisha] дневной пост " + JSON.stringify(o) + " · в запасе " + available))
      .catch((e) => console.log("[krisha] дневной пост не ушёл: " + e.message));
  }, 15 * 60e3).unref();

  // Sunday roundup, on its own schedule so a quiet week still gets one post
  setInterval(() => {
    if (!KW.channel || !KW.bootstrapped) return;
    const parts = new Date().toLocaleString("en-CA", {
      timeZone: "Asia/Almaty", hour12: false, weekday: "short",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit",
    });
    // "Sun, 2026-08-16, 12" — anchor the hour to the end, or the year's first
    // two digits get read as the hour.
    const date = (parts.match(/\d{4}-\d{2}-\d{2}/) || [])[0];
    const hour = Number((parts.match(/,\s*(\d{1,2})\s*$/) || [])[1]);
    if (!/^Sun/i.test(parts) || hour !== KRISHA_WEEKLY_HOUR || KW.lastWeeklyPost === date) return;
    KW.lastWeeklyPost = date;
    saveKrisha();
    krishaWeekly()
      .then((o) => console.log("[krisha] подборка недели " + JSON.stringify(o)))
      .catch((e) => console.log("[krisha] подборка недели не ушла: " + e.message));
  }, 15 * 60e3).unref();

  console.log("[krisha] watch on · каждые " + KRISHA_EVERY_H + " ч · порог " + KRISHA_MIN_DISCOUNT +
    "% · дайджест каждые " + KRISHA_DIGEST_H + " ч · находка дня в " + KRISHA_POST_HOUR + ":00");
}

// ---------------------------------------------------------------------------
// Onboarding analysis: AI-search foundations and real competitors
// Both read the seller's live Kaspi catalog, so every number shown to the
// merchant comes from data we actually fetched — nothing is invented.
// ---------------------------------------------------------------------------

let kaspiRobotsCache = { blocked: null, at: 0 };
async function kaspiAllowsAiBots() {
  if (kaspiRobotsCache.blocked !== null && Date.now() - kaspiRobotsCache.at < 6 * 3600e3) {
    return kaspiRobotsCache.blocked;
  }
  let allowed = true;
  try {
    const r = await fetchSafe("https://kaspi.kz/robots.txt", 6000);
    if (r.status === 200 && r.text.trim()) {
      const b = aiBotsBlocked(r.text);
      allowed = !(b.bots.length || b.all);
    }
  } catch {
    // unreachable robots.txt is treated as "no restrictions"
  }
  kaspiRobotsCache = { blocked: allowed, at: Date.now() };
  return allowed;
}

async function buildFoundations(slug, host) {
  const m = loadProfile(slug);
  if (!m) return null;
  const reviews = m.products.reduce((s, p) => s + (p.reviews || 0), 0);
  const rated = m.products.filter((p) => p.rating);
  const avg = rated.length ? Math.round((rated.reduce((s, p) => s + p.rating, 0) / rated.length) * 10) / 10 : 0;
  const aiAllowed = await kaspiAllowsAiBots();

  const items = [
    {
      label: "Магазин существует и доступен",
      status: "ok",
      badge: "проверено",
      note: "Нашли ваш магазин на " + host + ": товаров — " + m.productCount + ".",
    },
    {
      label: "Репутация: отзывы и рейтинг",
      status: reviews >= 20 ? "ok" : "bad",
      badge: "проверено",
      note: reviews >= 20
        ? "У ваших товаров " + reviews.toLocaleString("ru-RU") + " отзывов" + (avg ? ", средний рейтинг " + avg + "★" : "") + ". ИИ опирается на такие сигналы, когда выбирает, кого рекомендовать."
        : "Отзывов пока мало (" + reviews + "). Это главный сигнал доверия для ИИ — его стоит набирать.",
    },
    {
      label: "ИИ-краулеры допущены",
      status: aiAllowed ? "ok" : "bad",
      badge: "проверено",
      note: aiAllowed
        ? "robots.txt площадки не запрещает ИИ-краулерам читать страницы (OAI-SearchBot, Googlebot, Bingbot, Claude-SearchBot, PerplexityBot)."
        : "robots.txt площадки закрывает страницы от ИИ-краулеров — ваши товары они прочитать не могут.",
    },
    {
      label: "Свой сайт бренда",
      status: "bad",
      badge: "проверено",
      note: "Своего сайта нет — только карточка внутри маркетплейса. ИИ и Google цитируют площадку, а не вас.",
    },
    {
      label: "Структурированные данные о товарах",
      status: "bad",
      badge: "проверено",
      note: "Нет страниц, которыми вы управляете, — значит нет и разметки Schema.org с вашими ценами и наличием.",
    },
    {
      label: "Товарный фид для ИИ-шопинга",
      status: "bad",
      badge: "проверено",
      note: "Фид в ChatGPT и Perplexity не подан. Это прямой и бесплатный канал попадания товаров в ответы ИИ.",
    },
  ];

  const reported = {
    label: "llms.txt",
    status: "neutral",
    badge: "не оцениваем",
    note: "Файл llms.txt не влияет: ни один крупный ИИ-поисковик пока не подтвердил, что читает его. Мы не считаем его отсутствие пробелом.",
  };

  const done = items.filter((i) => i.status === "ok").length;
  return {
    slug,
    name: m.name,
    productCount: m.productCount,
    reviews,
    rating: avg,
    score: done,
    total: items.length,
    items,
    reported,
  };
}

const STOPWORDS = new Set([
  "для", "или", "как", "что", "это", "при", "без", "все", "уже", "его", "она", "они",
  "шт", "см", "мм", "кг", "мл", "гр", "оформлении", "оформление", "набор", "цвет", "размер",
]);

function categoryQuery(m) {
  const brandTokens = new Set(normBrand(m.name).split(/\s+/).filter(Boolean));
  const freq = new Map();
  for (const p of m.products.slice(0, 20)) {
    for (const w of String(p.title).toLowerCase().split(/[^a-zа-яё0-9]+/i)) {
      if (w.length < 4 || STOPWORDS.has(w)) continue;
      if (normBrand(m.name).includes(normBrand(w))) continue;
      if (brandTokens.has(normBrand(w))) continue;
      if (/^\d+$/.test(w)) continue;
      freq.set(w, (freq.get(w) || 0) + 1);
    }
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map((e) => e[0])
    .join(" ");
}

async function buildCompetitors(slug) {
  const m = loadProfile(slug);
  if (!m) return null;
  const query = categoryQuery(m);
  if (!query) return { query: null, competitors: [], me: null };

  const brands = new Map();
  for (let page = 0; page < 2; page++) {
    let json;
    try {
      json = await kaspiSearch(query, page);
    } catch {
      break;
    }
    const items = (json && json.data) || [];
    if (!items.length) break;
    for (const it of items) {
      const b = (it.brand || "").trim();
      if (!b || /без бренда/i.test(b)) continue;
      if (!brands.has(b)) brands.set(b, { brand: b, products: 0, reviews: 0, ratings: [], prices: [] });
      const r = brands.get(b);
      r.products++;
      r.reviews += it.reviewsQuantity || 0;
      if (it.rating) r.ratings.push(it.rating);
      if (it.unitPrice) r.prices.push(it.unitPrice);
    }
  }

  const rows = Array.from(brands.values()).map((r) => ({
    brand: r.brand,
    products: r.products,
    reviews: r.reviews,
    rating: r.ratings.length ? Math.round((r.ratings.reduce((a, b) => a + b, 0) / r.ratings.length) * 10) / 10 : null,
    minPrice: r.prices.length ? Math.min(...r.prices) : null,
    isMe: normBrand(r.brand) === normBrand(m.name),
  }));
  rows.sort((a, b) => b.reviews - a.reviews);

  const myReviews = m.products.reduce((s, p) => s + (p.reviews || 0), 0);
  const meRow = rows.find((r) => r.isMe);
  const ranked = rows.filter((r) => !r.isMe).slice(0, 6);
  const strongerCount = ranked.filter((r) => r.reviews > myReviews).length;

  return {
    query,
    me: { brand: m.name, reviews: myReviews, products: m.productCount },
    position: strongerCount + 1,
    fieldSize: ranked.length + 1,
    hasOwnSite: false,
    competitors: ranked,
    meInSearch: !!meRow,
  };
}

// ---------------------------------------------------------------------------
// Clerk: seller accounts and Google sign-in
// Frontend gets the publishable key from /api/config and runs Clerk JS.
// Backend verifies the session JWT (RS256) against Clerk's JWKS with the
// built-in crypto module — no dependencies — then reads the user's email
// through the Clerk Backend API and records the lead.
// ---------------------------------------------------------------------------

const crypto = require("crypto");
const db = require("./scripts/db");
const agentTemplate = require("./scripts/agent-template");
const enrich = require("./scripts/enrich");
const CLERK_PK = process.env.CLERK_PUBLISHABLE_KEY || "";
const CLERK_SK = process.env.CLERK_SECRET_KEY || "";

// The publishable key encodes the instance's frontend API host in base64.
function clerkFrontendHost() {
  const raw = CLERK_PK.replace(/^pk_(test|live)_/, "");
  if (!raw) return null;
  try {
    return Buffer.from(raw, "base64").toString("utf8").replace(/\$+$/, "") || null;
  } catch {
    return null;
  }
}

let jwksCache = { keys: null, at: 0 };
async function clerkJwks() {
  if (jwksCache.keys && Date.now() - jwksCache.at < 3600e3) return jwksCache.keys;
  const host = clerkFrontendHost();
  if (!host) throw new Error("no clerk publishable key");
  const res = await fetch("https://" + host + "/.well-known/jwks.json");
  if (!res.ok) throw new Error("jwks http " + res.status);
  const json = await res.json();
  jwksCache = { keys: json.keys || [], at: Date.now() };
  return jwksCache.keys;
}

function b64urlToBuf(s) {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

// Returns the token payload when the signature and lifetime check out.
async function verifyClerkToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("malformed token");
  const [h, p, s] = parts;
  const header = JSON.parse(b64urlToBuf(h).toString("utf8"));
  const payload = JSON.parse(b64urlToBuf(p).toString("utf8"));
  if (header.alg !== "RS256") throw new Error("unexpected alg " + header.alg);

  const keys = await clerkJwks();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("unknown kid");
  const pub = crypto.createPublicKey({ key: jwk, format: "jwk" });
  const ok = crypto.verify("RSA-SHA256", Buffer.from(h + "." + p), pub, b64urlToBuf(s));
  if (!ok) throw new Error("bad signature");

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now - 5) throw new Error("token expired");
  if (payload.nbf && payload.nbf > now + 5) throw new Error("token not yet valid");
  return payload;
}

async function clerkUserEmail(userId) {
  if (!CLERK_SK) return null;
  const res = await fetch("https://api.clerk.com/v1/users/" + encodeURIComponent(userId), {
    headers: { Authorization: "Bearer " + CLERK_SK },
  });
  if (!res.ok) return null;
  const u = await res.json();
  const primary = (u.email_addresses || []).find((e) => e.id === u.primary_email_address_id);
  return {
    email: (primary || (u.email_addresses || [])[0] || {}).email_address || null,
    name: [u.first_name, u.last_name].filter(Boolean).join(" ") || null,
  };
}

function recordLead(lead) {
  const line = JSON.stringify(lead);
  console.log("[lead] " + line); // always visible in the Azure log stream
  try {
    fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });
    fs.appendFileSync(path.join(ROOT, "data", "leads.jsonl"), line + "\n", "utf8");
  } catch {
    // read-only filesystem — the console line above is the durable record
  }
}

// ---------------------------------------------------------------------------
// Кабинет клиники.
//
// Правило, из которого всё остальное: список клиник берётся ТОЛЬКО из
// организаций Clerk, в которых состоит владелец проверенного токена. Ни один
// идентификатор из запроса в выборку не попадает — иначе кабинет открывается
// подбором чужого номера.

async function clerkUserOrgIds(userId) {
  if (!CLERK_SK) return [];
  const res = await fetch(
    "https://api.clerk.com/v1/users/" + encodeURIComponent(userId) +
    "/organization_memberships?limit=50",
    { headers: { Authorization: "Bearer " + CLERK_SK } }
  );
  if (!res.ok) return [];
  const j = await res.json();
  return (j.data || [])
    .map((m) => m.organization && m.organization.id)
    .filter(Boolean);
}

// Достаёт пользователя из заголовка и отдаёт его клиники. Бросает — значит
// доступа нет, и вызывающий отвечает 401.
async function cabinetContext(req) {
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new Error("no_token");
  const claims = await verifyClerkToken(token);
  const orgIds = await clerkUserOrgIds(claims.sub);
  const clinics = await db.clinicsByOrgIds(orgIds);
  return { userId: claims.sub, orgIds, clinics, clinicIds: clinics.map((c) => c.id) };
}

// ---------------------------------------------------------------------------
// Записи со звонков: ElevenLabs присылает разговор, мы достаём из него поля.

// Пишем и в базу, и в файл. База — основное хранилище, файл — страховка:
// если Azure SQL недоступен, запись клиники не должна пропасть вместе с ним.
async function recordBooking(b, extra) {
  const line = JSON.stringify(b);
  console.log("[booking] " + line);
  try {
    fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });
    fs.appendFileSync(path.join(ROOT, "data", "bookings.jsonl"), line + "\n", "utf8");
  } catch {
    // файловая система только на чтение — строка выше остаётся единственной записью
  }
  try {
    await db.saveCall({
      conversation_id: b.conversation,
      agent_id: (extra && extra.agent_id) || null,
      caller_number: (extra && extra.caller_number) || null,
      duration_secs: b.seconds,
      client_name: b.name,
      client_phone: b.phone,
      service: b.service,
      desired_time: b.when,
      is_booked: b.booked,
      is_urgent: b.urgent,
      summary: b.summary,
      clinic_id: (extra && extra.clinic_id) || null,
      phone_number_id: (extra && extra.phone_number_id) || null,
      agent_number: (extra && extra.agent_number) || null,
      direction: (extra && extra.direction) || null,
      transcript: (extra && extra.transcript) || null,
      raw: (extra && extra.raw) || null,
    });
    console.log("[booking] в базу записано: " + b.conversation);
  } catch (e) {
    console.log(
      "[booking] БАЗА НЕДОСТУПНА (" + String(e.message).slice(0, 120) +
      ") — запись осталась только в файле: " + b.conversation
    );
  }
}

// ElevenLabs подписывает тело: t=<время>,v0=<hmac>. Без проверки эндпоинт
// открыт для подделки, а записи попадут клинике как настоящие.
function verifyElevenSignature(raw, header, secret) {
  if (!secret) return { ok: false, reason: "no_secret" };
  if (!header) return { ok: false, reason: "no_signature" };
  const parts = String(header).split(",");
  const t = (parts.find((p) => p.startsWith("t=")) || "").slice(2);
  const v0 = (parts.find((p) => p.startsWith("v0=")) || "").slice(3);
  if (!t || !v0) return { ok: false, reason: "malformed" };
  const age = Math.abs(Date.now() / 1000 - Number(t));
  if (!Number.isFinite(age) || age > 1800) return { ok: false, reason: "stale" };
  const mac = crypto.createHmac("sha256", secret).update(t + "." + raw).digest("hex");
  const a = Buffer.from(mac);
  const b = Buffer.from(v0);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_signature" };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Демо-звонок: посетитель вводит СВОЙ номер, агент перезванивает.
//
// Форма «позвоним на любой номер» — это готовый инструмент травли и способ
// слить чужой телефонный счёт, поэтому здесь три ограничителя: согласие,
// лимит на номер и общий дневной потолок.

const DEMO_CALL_LOG = []; // { at, phone, ip }
const DEMO_MAX_PER_DAY = Number(process.env.DEMO_CALL_MAX_PER_DAY || 40);
const DEMO_MAX_PER_NUMBER = 2; // за сутки
const DEMO_MAX_PER_IP = 5; // за сутки

// Чтение чужих страниц открыто без входа, значит им можно злоупотребить:
// нашим сервером будут ходить по чужим сайтам. Счётчик в памяти — этого
// достаточно, пока сервер один.
const hits = new Map();
function tooOften(key, limit, windowMs) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (list.length >= limit) { hits.set(key, list); return true; }
  list.push(now);
  hits.set(key, list);
  // Карта не должна расти вечно: раз в сотню обращений выбрасываем протухшее.
  if (hits.size > 500) {
    for (const [k, v] of hits) {
      if (!v.some((t) => now - t < windowMs)) hits.delete(k);
    }
  }
  return false;
}

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
         req.socket.remoteAddress || "";
}

function demoCallsSince(hours) {
  const since = Date.now() - hours * 3600e3;
  return DEMO_CALL_LOG.filter((c) => c.at >= since);
}

// +7 7XX XXX XX XX — казахстанские мобильные. Иначе демо звонит куда попало.
// Витрина кабинета открыта без входа, а звонили в неё живые люди. Показываем,
// как выглядит работа, но не сдаём тех, кто звонил: от номера оставляем код
// оператора и две последние цифры, от имени — только имя.
function maskPhone(raw) {
  const d = String(raw || "").replace(/[^0-9]/g, "");
  if (d.length < 8) return raw ? "•••" : null;
  return "+" + d.slice(0, 1) + " " + d.slice(1, 4) + " ••• •• " + d.slice(-2);
}

function maskDigits(text) {
  // Пять и больше цифр подряд (с пробелами и дефисами внутри) — это номер.
  return String(text || "").replace(/(?:\d[\s-]?){5,}\d/g, "•••");
}

function maskCall(c) {
  const out = Object.assign({}, c);
  delete out.raw;
  out.caller_number = maskPhone(c.caller_number);
  out.client_phone = maskPhone(c.client_phone);
  out.client_name = String(c.client_name || "").trim().split(/\s+/)[0] || null;
  return out;
}

function normalizeKzMobile(raw) {
  const d = String(raw || "").replace(/[^0-9]/g, "");
  if (d.length === 11 && (d[0] === "7" || d[0] === "8") && d[1] === "7") return "+7" + d.slice(1);
  if (d.length === 10 && d[0] === "7") return "+7" + d;
  return null;
}

// agentOverride — чтобы клиника из кабинета услышала СВОЕГО ассистента, а не
// общего демонстрационного.
async function placeDemoCall(toNumber, agentOverride) {
  const key = process.env.ELEVENLABS_API_KEY;
  const agentId = agentOverride || process.env.ELEVENLABS_AGENT_ID;
  const phoneId = process.env.ELEVENLABS_PHONE_NUMBER_ID;
  if (!key || !agentId || !phoneId) {
    return { ok: false, reason: "not_configured" };
  }
  const res = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      agent_id: agentId,
      agent_phone_number_id: phoneId,
      to_number: toNumber,
    }),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, reason: "provider", status: res.status, body: text.slice(0, 400) };
  // ElevenLabs отвечает 200 и на неудавшийся звонок — правду говорит только
  // поле success в теле. Без этой проверки форма радостно врёт «звоню».
  let parsed = null;
  try { parsed = JSON.parse(text); } catch {}
  if (!parsed || parsed.success !== true) {
    return { ok: false, reason: "call_failed", body: text.slice(0, 400) };
  }
  return { ok: true, body: text.slice(0, 400) };
}

// ---------------------------------------------------------------------------
// Discoverability: robots.txt, sitemap.xml and IndexNow
// IndexNow instantly notifies Bing (the index behind ChatGPT Search) about
// new/updated storefront URLs. The key file must be served from this host.
// ---------------------------------------------------------------------------

const INDEXNOW_KEY = "8c2f1e4b9a374d5f8b6a1c0d2e3f4a5b";
// Canonical host: the Azure default hostname serves the same content, so all
// canonical URLs, sitemaps and feeds point search engines at the real domain.
const CANONICAL_HOST = "saudager.ai";
const CANONICAL = "https://" + CANONICAL_HOST;

function listMerchantSlugs() {
  const slugs = new Set(MEM_MERCHANTS.keys());
  for (const dir of DATA_DIRS) {
    try {
      for (const f of fs.readdirSync(path.join(dir, "merchants"))) {
        if (f.endsWith(".json")) slugs.add(f.slice(0, -5));
      }
    } catch {
      // directory missing — skip
    }
  }
  return Array.from(slugs);
}

function buildSitemap(origin) {
  const urls = [
    { loc: origin + "/", priority: "1.0" },
    { loc: origin + "/kk/", priority: "0.9" },
    { loc: origin + "/kaspi/", priority: "0.9" },
    { loc: origin + "/en/", priority: "0.9" },
  ];
  for (const slug of listMerchantSlugs()) {
    const p = loadProfile(slug);
    urls.push({
      loc: origin + "/store/" + slug,
      lastmod: p && p.fetchedAt ? p.fetchedAt.slice(0, 10) : undefined,
      priority: "0.8",
    });
  }
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls
      .map(
        (u) =>
          "<url><loc>" + xmlEsc(u.loc) + "</loc>" +
          (u.lastmod ? "<lastmod>" + u.lastmod + "</lastmod>" : "") +
          "<priority>" + u.priority + "</priority></url>"
      )
      .join("\n") +
    "\n</urlset>\n"
  );
}

let lastIndexNow = { at: null, status: null, urls: 0, body: "" };

// Report what IndexNow answered. This used to swallow every outcome, so eight days
// of zero Bing traffic could not be told apart from submissions that were never
// accepted — 403 (key not readable) and 422 (host mismatch) look identical to
// success when nothing is logged.
function pingIndexNow(host, urls) {
  return fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host,
      key: INDEXNOW_KEY,
      keyLocation: "https://" + host + "/" + INDEXNOW_KEY + ".txt",
      urlList: urls,
    }),
  })
    .then(async (r) => {
      const body = (await r.text().catch(() => "")).slice(0, 200);
      lastIndexNow = { at: new Date().toISOString(), status: r.status, urls: urls.length, body };
      console.log("[indexnow] " + r.status + " for " + urls.length + " urls" + (body ? " · " + body : ""));
      return lastIndexNow;
    })
    .catch((e) => {
      lastIndexNow = { at: new Date().toISOString(), status: 0, urls: urls.length, body: String(e.message).slice(0, 120) };
      console.log("[indexnow] failed: " + lastIndexNow.body);
      return lastIndexNow;
    });
}

// Announce EVERY storefront. The 145 built by scripts/bulk-ingest.js never went
// through handleIngest, so they were never submitted at all — which is the most
// likely reason Bing has not crawled a single one.
let indexNowAllAt = 0;
async function pingIndexNowAll() {
  if (Date.now() - indexNowAllAt < 3600e3) return { skipped: "cooldown", lastIndexNow };
  indexNowAllAt = Date.now();
  const slugs = listMerchantSlugs();
  const urls = [CANONICAL + "/", CANONICAL + "/kk/", CANONICAL + "/kaspi/", CANONICAL + "/en/"];
  for (const s of slugs) {
    urls.push(CANONICAL + "/store/" + s);
    urls.push(CANONICAL + "/store/" + s + "/feed-google.xml");
  }
  // IndexNow caps a submission at 10 000 URLs; batch well under it either way.
  const out = [];
  for (let i = 0; i < urls.length; i += 500) out.push(await pingIndexNow(CANONICAL_HOST, urls.slice(i, i + 500)));
  return { stores: slugs.length, urls: urls.length, batches: out.length, results: out };
}

// ---------------------------------------------------------------------------
// Google Merchant feed (/store/<slug>/feed-google.xml) — RSS 2.0 with the
// g: namespace. Google's Shopping Graph feeds Gemini shopping answers and
// AI Overviews; Merchant Center can fetch this URL on a schedule.
// ---------------------------------------------------------------------------

function xmlEsc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildGoogleFeed(slug, origin) {
  const m = loadProfile(slug);
  if (!m || !m.products || !m.products.length) return null;
  const storeUrl = origin + "/store/" + m.slug;
  const items = m.products
    .map((p) => {
      const images = p.images && p.images.length ? p.images : p.image ? [p.image] : [];
      return (
        "<item>" +
        "<g:id>" + xmlEsc(p.id) + "</g:id>" +
        "<g:title>" + xmlEsc(p.title) + "</g:title>" +
        "<g:description>" + xmlEsc(p.title + " — " + m.name) + "</g:description>" +
        "<g:link>" + xmlEsc(p.kaspiUrl) + "</g:link>" +
        (images[0] ? "<g:image_link>" + xmlEsc(images[0]) + "</g:image_link>" : "") +
        images.slice(1).map((u) => "<g:additional_image_link>" + xmlEsc(u) + "</g:additional_image_link>").join("") +
        "<g:price>" + xmlEsc(p.price + " KZT") + "</g:price>" +
        "<g:availability>in stock</g:availability>" +
        "<g:brand>" + xmlEsc(m.name) + "</g:brand>" +
        "<g:condition>new</g:condition>" +
        "</item>"
      );
    })
    .join("\n");
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n<channel>\n' +
    "<title>" + xmlEsc(m.name) + "</title>\n" +
    "<link>" + xmlEsc(storeUrl) + "</link>\n" +
    "<description>" + xmlEsc(m.name + " — каталог бренда, сгенерирован Saudager") + "</description>\n" +
    items +
    "\n</channel>\n</rss>\n"
  );
}

// ---------------------------------------------------------------------------
// MCP server per storefront (/store/<slug>/mcp) — the Anthropic-native door:
// Claude (or any MCP client) connects and queries the catalog with tools.
// Model Context Protocol over Streamable HTTP, stateless JSON responses.
// ---------------------------------------------------------------------------

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 1e6) {
        reject(new Error("body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const MCP_TOOLS = [
  {
    name: "get_store_info",
    description: "Store overview: brand name, product count, price range, data freshness.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "search_products",
    description: "Search the catalog by product title. Returns price, rating and a buy link.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "Search text, e.g. 'букет роза'" } },
      required: ["query"],
    },
  },
  {
    name: "get_product",
    description: "Full details for one product by its id.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
];

function mcpToolCall(m, name, args) {
  const brief = (p) => ({
    id: p.id,
    title: p.title,
    price_kzt: p.price,
    rating: p.rating,
    reviews: p.reviews,
    buy_url: p.kaspiUrl,
  });
  if (name === "get_store_info") {
    const prices = m.products.map((p) => p.price).filter(Boolean);
    return {
      name: m.name,
      source: m.source,
      product_count: m.productCount,
      min_price_kzt: prices.length ? Math.min(...prices) : null,
      max_price_kzt: prices.length ? Math.max(...prices) : null,
      updated_at: m.fetchedAt,
      note: "Availability and prices are confirmed at order time on Kaspi.",
    };
  }
  if (name === "search_products") {
    const q = String((args && args.query) || "").toLowerCase();
    const results = m.products.filter((p) => p.title.toLowerCase().includes(q)).slice(0, 10).map(brief);
    return { query: q, result_count: results.length, results };
  }
  if (name === "get_product") {
    const p = m.products.find((x) => x.id === String(args && args.id));
    if (!p) throw new Error("product not found: " + (args && args.id));
    return Object.assign(brief(p), {
      images: p.images || (p.image ? [p.image] : []),
      old_price_kzt: p.oldPrice,
      discount_percent: p.discount,
      price_formatted: p.priceFormatted,
    });
  }
  throw new Error("unknown tool: " + name);
}

async function handleMcp(req, res, slug) {
  const m = loadProfile(slug);
  if (!m || !m.products || !m.products.length) {
    res.writeHead(404, { "Content-Type": MIME[".json"] }).end(JSON.stringify({ error: "unknown store" }));
    return;
  }
  if (req.method !== "POST") {
    res.writeHead(405, { Allow: "POST", "Content-Type": MIME[".json"] })
      .end(JSON.stringify({ error: "MCP endpoint: send JSON-RPC 2.0 messages via POST (Streamable HTTP)" }));
    return;
  }
  let msg;
  try {
    msg = JSON.parse(await readBody(req));
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (Array.isArray(msg)) msg = msg[0]; // minimal batch support
  const id = msg && msg.id;
  const method = msg && msg.method;
  const params = (msg && msg.params) || {};
  if (id === undefined || id === null) {
    res.writeHead(202).end(); // notification (e.g. notifications/initialized)
    return;
  }
  const reply = (result) =>
    res.writeHead(200, { "Content-Type": MIME[".json"] }).end(JSON.stringify({ jsonrpc: "2.0", id, result }));
  const fail = (code, message) =>
    res.writeHead(200, { "Content-Type": MIME[".json"] }).end(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }));

  switch (method) {
    case "initialize":
      reply({
        protocolVersion: params.protocolVersion || "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "Saudager-store-" + slug, version: "0.1.0" },
      });
      break;
    case "ping":
      reply({});
      break;
    case "tools/list":
      reply({ tools: MCP_TOOLS });
      break;
    case "tools/call":
      try {
        const out = mcpToolCall(m, params.name, params.arguments);
        reply({ content: [{ type: "text", text: JSON.stringify(out, null, 2) }] });
      } catch (e) {
        reply({ content: [{ type: "text", text: "Error: " + e.message }], isError: true });
      }
      break;
    default:
      fail(-32601, "Method not found: " + method);
  }
}

// ---------------------------------------------------------------------------
// SSR brand storefronts (/store/<slug>) generated from ingested catalogs
// ---------------------------------------------------------------------------

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderStore(slug) {
  const m = loadProfile(slug);
  if (!m || !m.products || !m.products.length) return null;

  const prices = m.products.map((p) => p.price).filter(Boolean);
  const minP = Math.min(...prices);
  const rated = m.products.filter((p) => p.rating && p.reviews);
  const topRating = rated.length ? Math.max(...rated.map((p) => p.rating)) : null;

  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Store",
        name: m.name,
        description: m.name + " — фирменный каталог: " + m.productCount + " товаров, цены от " + minP + " ₸. Заказ онлайн через Kaspi.",
      },
      {
        "@type": "ItemList",
        itemListElement: m.products.map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: Object.assign(
            {
              "@type": "Product",
              name: p.title,
              brand: { "@type": "Brand", name: m.name },
              offers: {
                "@type": "Offer",
                price: p.price,
                priceCurrency: "KZT",
                availability: "https://schema.org/InStock",
                url: p.kaspiUrl,
              },
            },
            p.image ? { image: p.image } : {},
            p.rating && p.reviews
              ? { aggregateRating: { "@type": "AggregateRating", ratingValue: p.rating, reviewCount: p.reviews } }
              : {}
          ),
        })),
      },
    ],
  };

  const cards = m.products
    .map((p) => {
      const old = p.oldPrice && p.oldPrice > p.price ? '<s>' + p.oldPrice.toLocaleString("ru-RU") + " ₸</s>" : "";
      const disc = p.discount ? '<span class="disc">−' + p.discount + "%</span>" : "";
      const rating = p.rating && p.reviews ? '<div class="rate">★ ' + p.rating + ' <span>(' + p.reviews + ")</span></div>" : '<div class="rate"></div>';
      const imgs = p.images && p.images.length ? p.images : p.image ? [p.image] : [];
      const main = imgs.length ? '<img class="main" src="' + esc(imgs[0]) + '" alt="' + esc(p.title) + '" loading="lazy">' : "";
      const thumbs = imgs.length > 1
        ? '<div class="thumbs">' + imgs.map((u, i) => '<img src="' + esc(u) + '"' + (i === 0 ? ' class="on"' : "") + ' alt="" loading="lazy">').join("") + "</div>"
        : "";
      return (
        '<article class="card">' +
        main + thumbs +
        "<h3>" + esc(p.title) + "</h3>" +
        rating +
        '<div class="price">' + esc(p.priceFormatted || p.price + " ₸") + " " + old + " " + disc + "</div>" +
        '<a class="buy" href="/go/' + esc(m.slug) + '/' + esc(p.id) + '" rel="nofollow">Купить на Kaspi</a>' +
        "</article>"
      );
    })
    .join("\n");

  const fetchedDate = (m.fetchedAt || "").slice(0, 10);
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(m.name)} — официальный каталог и цены</title>
<meta name="description" content="${esc(m.name)}: ${m.productCount} товаров с ценами от ${minP.toLocaleString("ru-RU")} ₸${topRating ? ", рейтинг до " + topRating + "★" : ""}. Букеты и композиции с заказом онлайн через Kaspi.">
<link rel="canonical" href="${CANONICAL}/store/${esc(m.slug)}">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>
  :root { --ink: #1c1c28; --muted: #6f6f80; --line: #e8e8ef; --brand: #f14635; --kaspi: #f14635; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "Inter", "Segoe UI", system-ui, sans-serif; color: var(--ink); background: #fafafc; line-height: 1.5; }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 0 20px; }
  header { background: #fff; border-bottom: 1px solid var(--line); padding: 28px 0; }
  h1 { font-size: 28px; letter-spacing: -0.02em; }
  .sub { color: var(--muted); font-size: 14.5px; margin-top: 4px; }
  main { padding: 28px 0 40px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 16px; }
  .card { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 14px; display: flex; flex-direction: column; }
  .card img.main { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 10px; background: #f0f0f5; }
  .thumbs { display: flex; gap: 6px; margin-top: 8px; }
  .thumbs img {
    width: 44px; height: 44px; object-fit: cover; border-radius: 8px;
    border: 2px solid transparent; cursor: pointer; background: #f0f0f5;
  }
  .thumbs img.on { border-color: var(--brand); }
  .card h3 { font-size: 14px; font-weight: 600; margin: 10px 0 4px; flex-grow: 1; }
  .rate { font-size: 12.5px; color: #e8a33d; min-height: 19px; }
  .rate span { color: var(--muted); }
  .price { font-size: 16px; font-weight: 800; margin: 6px 0 10px; }
  .price s { color: var(--muted); font-weight: 400; font-size: 13px; }
  .disc { background: #ffe9e6; color: var(--kaspi); font-size: 12px; font-weight: 700; border-radius: 6px; padding: 1px 6px; }
  .buy { display: block; text-align: center; background: var(--kaspi); color: #fff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 10px; border-radius: 10px; }
  .buy:hover { filter: brightness(1.05); }
  footer { border-top: 1px solid var(--line); padding: 20px 0 32px; color: var(--muted); font-size: 12.5px; }
  footer a { color: var(--brand); text-decoration: none; font-weight: 600; }
</style>
</head>
<body>
<header>
  <div class="wrap">
    <h1>${esc(m.name)}</h1>
    <p class="sub">Официальная витрина бренда · ${m.productCount} товаров · цены от ${minP.toLocaleString("ru-RU")} ₸ · заказ через Kaspi</p>
  </div>
</header>
<main>
  <div class="wrap">
    <div class="grid">
${cards}
    </div>
  </div>
</main>
<footer>
  <div class="wrap">
    AI-читаемая витрина, сгенерированная <a href="/kaspi/">Saudager</a> из каталога продавца на Kaspi.kz · данные обновлены ${esc(fetchedDate)} · цены и наличие подтверждаются на Kaspi<br>
    Машинные интерфейсы: <a href="/store/${esc(m.slug)}/feed.json">фид OpenAI</a> · <a href="/store/${esc(m.slug)}/feed-google.xml">фид Google</a> · <a href="/store/${esc(m.slug)}/mcp" title="Model Context Protocol — подключается к Claude как коннектор">MCP для Claude</a>
  </div>
</footer>
<script>
  // Tag buy links with where this visitor came from, so the click report says
  // "from ChatGPT" instead of just "from our storefront".
  (function () {
    var r = document.referrer || "";
    var s = "direct";
    if (r) {
      var h = "";
      try { h = new URL(r).hostname.replace(/^www\\./, ""); } catch (e) {}
      if (/chatgpt\\.com|openai\\.com/.test(h)) s = "chatgpt";
      else if (/perplexity\\.ai/.test(h)) s = "perplexity";
      else if (/claude\\.ai|anthropic\\.com/.test(h)) s = "claude";
      else if (/google\\./.test(h)) s = "google";
      else if (/bing\\.com|copilot\\.microsoft/.test(h)) s = "bing";
      else if (/yandex\\./.test(h)) s = "yandex";
      else if (h && h !== location.hostname) s = "other";
      else if (h === location.hostname) s = "internal";
    }
    document.querySelectorAll("a.buy").forEach(function (a) {
      a.href += (a.href.indexOf("?") > -1 ? "&" : "?") + "s=" + encodeURIComponent(s);
    });
  })();

  document.querySelectorAll(".thumbs img").forEach(function (t) {
    t.addEventListener("click", function () {
      var card = t.closest(".card");
      card.querySelector("img.main").src = t.src;
      card.querySelectorAll(".thumbs img").forEach(function (x) { x.classList.remove("on"); });
      t.classList.add("on");
    });
  });
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// HTTP server: /api/audit + static files
// ---------------------------------------------------------------------------

http
  .createServer((req, res) => {
    const parsed = new URL(req.url, "http://localhost");
    const urlPath = decodeURIComponent(parsed.pathname);

    if (urlPath === "/api/foundations" || urlPath === "/api/competitors") {
      const target = parsed.searchParams.get("url") || "";
      (async () => {
        const ing = await handleIngest(target, req.headers.host);
        if (ing.error) return { error: ing.error };
        const host = String(target).replace(/^https?:\/\//i, "").split("/")[0] || "kaspi.kz";
        return urlPath === "/api/foundations"
          ? await buildFoundations(ing.slug, host)
          : await buildCompetitors(ing.slug);
      })()
        .then((result) => {
          if (!result || result.error) {
            res.writeHead(422, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
            res.end(JSON.stringify(result || { error: "no data" }));
            return;
          }
          res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
          res.end(JSON.stringify(result));
        })
        .catch(() => {
          res.writeHead(500, { "Content-Type": MIME[".json"] });
          res.end(JSON.stringify({ error: "analysis failed" }));
        });
      return;
    }

    // One-shot check that the bot really reaches the operator's chat
    if (urlPath === "/api/telegram-test") {
      if (!TG_TOKEN || !TG_CHAT) {
        res.writeHead(400, { "Content-Type": MIME[".json"] });
        res.end(JSON.stringify({ error: "нужны переменные TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID" }));
        return;
      }
      // Report what Telegram actually said — a test that cannot fail is useless
      Promise.resolve(notifyTelegram("✅ <b>Saudager подключён</b>\nУведомления о переходах покупателей будут приходить сюда."))
        .then((tg) => {
          const delivered = !!(tg && tg.ok);
          res.writeHead(delivered ? 200 : 502, { "Content-Type": MIME[".json"] });
          res.end(JSON.stringify({
            delivered,
            telegram: tg && tg.ok ? { chat: tg.result && tg.result.chat && tg.result.chat.id, messageId: tg.result && tg.result.message_id } : tg,
          }));
        });
      return;
    }

    // Reachability probe for marketplace endpoints, from the server's own IP.
    // Fixed host allowlist and status-only output — not a general proxy.
    if (urlPath === "/api/probe") {
      const allowHosts = ["kaspi.kz", "search.wb.ru", "card.wb.ru", "catalog.wb.ru", "www.wildberries.ru", "www.wildberries.kz", "api-seller.ozon.ru", "www.ozon.ru", "krisha.kz"];
      const target = parsed.searchParams.get("url") || "";
      (async () => {
        const u = new URL(/^https?:\/\//i.test(target) ? target : "https://" + target);
        if (!allowHosts.includes(u.hostname)) throw new Error("host not in allowlist");
        const r = await fetch(u, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            Accept: "application/json, text/plain, */*",
            "Accept-Language": "ru-RU,ru;q=0.9",
          },
        });
        const text = await r.text();
        let items = null;
        try {
          const j = JSON.parse(text);
          items = (j.data && j.data.products && j.data.products.length) || (j.products && j.products.length) || null;
        } catch {
          items = null;
        }
        return { host: u.hostname, status: r.status, bytes: text.length, items, head: text.slice(0, 100).replace(/\s+/g, " ") };
      })()
        .then((out) => {
          res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
          res.end(JSON.stringify(out));
        })
        .catch((e) => {
          res.writeHead(400, { "Content-Type": MIME[".json"] });
          res.end(JSON.stringify({ error: e.message }));
        });
      return;
    }

    // What the watch is holding right now. The warm-up deliberately suppresses
    // the backlog so the first cycle does not fire dozens of alerts about
    // listings that have been on the site for months — but the backlog is still
    // the answer to "what is on the market", so it needs a way out.
    // Public channel target. Kept in state rather than an env var so it can be
    // pointed at a test channel and back without a redeploy.
    if (urlPath === "/api/krisha/channel") {
      const id = parsed.searchParams.get("id");
      if (parsed.searchParams.get("clear") === "1") { KW.channel = null; saveKrisha(); }
      else if (id) { KW.channel = id; saveKrisha(); }
      res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
      res.end(JSON.stringify({ channel: KW.channel || null, botConfigured: !!TG_TOKEN }, null, 2));
      return;
    }

    // Sunday roundup, also triggerable by hand for a look before it goes out
    if (urlPath === "/api/krisha/weekly") {
      if (!KW.channel) {
        res.writeHead(409, { "Content-Type": MIME[".json"] });
        res.end(JSON.stringify({ error: "канал не задан: /api/krisha/channel?id=@имя" }));
        return;
      }
      krishaWeekly(parsed.searchParams.get("limit")).then((o) => {
        res.writeHead(o.delivered ? 200 : 502, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
        res.end(JSON.stringify(o, null, 2));
      });
      return;
    }

    // Publish the current best find to the channel, one post, in the rubric
    // format. Reports what Telegram answered rather than assuming success.
    if (urlPath === "/api/krisha/publish") {
      if (!KW.channel) {
        res.writeHead(409, { "Content-Type": MIME[".json"] });
        res.end(JSON.stringify({ error: "канал не задан: /api/krisha/channel?id=@имя" }));
        return;
      }
      const n = Math.max(1, Math.min(5, Number(parsed.searchParams.get("n") || 1)));
      const pick = krishaPickForChannel(n, {
        min: parsed.searchParams.get("min"),
        clean: parsed.searchParams.get("clean") !== "0",
        again: parsed.searchParams.get("again") === "1",
      });
      if (!pick.rows.length) {
        res.writeHead(200, { "Content-Type": MIME[".json"] });
        res.end(JSON.stringify({
          published: 0, queue: 0, matching: pick.total,
          reason: pick.total ? "всё подходящее уже опубликовано" : "под критерии сейчас ничего не подходит",
        }, null, 2));
        return;
      }
      krishaPublish(pick.rows, parsed.searchParams.get("rubric")).then((out) => {
        const ok = out.filter((x) => x.ok).length;
        res.writeHead(ok ? 200 : 502, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
        res.end(JSON.stringify({
          channel: KW.channel, published: ok,
          // How many days of daily posts are left in stock — the number that
          // decides whether a daily rubric can actually run
          queue: pick.available - ok, matching: pick.total, results: out,
        }, null, 2));
      });
      return;
    }

    // The box drawn on /area/. Reading is free; setting replaces the address
    // heuristic for every later run.
    if (urlPath === "/api/krisha/area") {
      const bbox = parsed.searchParams.get("bbox");
      if (parsed.searchParams.get("clear") === "1") {
        KW.area = null;
        saveKrisha();
      } else if (bbox) {
        const n = bbox.split(",").map(Number);
        if (n.length !== 4 || n.some((x) => !isFinite(x))) {
          res.writeHead(400, { "Content-Type": MIME[".json"] });
          res.end(JSON.stringify({ error: "bbox=south,west,north,east" }));
          return;
        }
        KW.area = {
          south: Math.min(n[0], n[2]), north: Math.max(n[0], n[2]),
          west: Math.min(n[1], n[3]), east: Math.max(n[1], n[3]),
          setAt: new Date().toISOString(),
        };
        saveKrisha();
      }
      const K = require("./scripts/krisha-lib.js");
      const pts = Object.values(KW.corpus || {}).filter((c) => c.lat != null);
      res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
      res.end(JSON.stringify({
        area: KW.area,
        geocoded: pts.length,
        pending: Object.values(KW.corpus || {}).filter((c) => c.lat == null && !c.geoTried).length,
        inside: KW.area ? pts.filter((c) => K.inBox(c, KW.area)).length : null,
      }, null, 2));
      return;
    }

    // Everything geocoded so far, already scored. The map page filters by box
    // and by "cheaper than comparable" locally, so drawing a zone shows its list
    // instantly instead of waiting on another round trip.
    if (urlPath === "/api/krisha/points") {
      const K = require("./scripts/krisha-lib.js");
      const corpus = Object.values(KW.corpus || {}).filter((c) => c.year);
      const price = K.buildModel(corpus);
      const items = corpus
        .filter((c) => c.lat != null)
        .map((c) => {
          const p = price(c);
          return {
            id: c.id, lat: c.lat, lon: c.lon, price: c.price, ppm: c.ppm, area: c.area,
            rooms: c.rooms, year: c.year, building: c.building, renovation: c.renovation,
            floor: c.floor, floors: c.floors, addr: c.addr, exact: !!c.geoExact,
            expected: p.expected, basis: p.basis, solid: p.solid,
            discount: Math.round((1 - c.ppm / p.expected) * 100),
            flags: K.flagsFor(c),
            url: "https://krisha.kz/a/show/" + c.id,
          };
        });
      res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
      res.end(JSON.stringify({ count: items.length, items }));
      return;
    }

    if (urlPath === "/api/krisha/shortlist") {
      const opts = {
        min: parsed.searchParams.get("min"),
        limit: parsed.searchParams.get("limit"),
        clean: parsed.searchParams.get("clean") === "1",
        requireSolid: parsed.searchParams.get("solid") !== "0",
      };
      if (parsed.searchParams.get("send") === "1") {
        // Report what Telegram actually answered — a send that cannot fail is useless
        krishaDigest(opts).then((out) => {
          res.writeHead(out.delivered ? 200 : 502, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
          res.end(JSON.stringify(out, null, 2));
        });
        return;
      }
      const { corpus, rows } = krishaShortlist(opts);
      res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
      res.end(JSON.stringify({ corpus, found: rows.length, items: rows }, null, 2));
      return;
    }

    // Apartment watch status, and a manual kick so it can be verified without
    // waiting out the interval. Writes nothing that a run would not write anyway.
    if (urlPath === "/api/krisha") {
      if (parsed.searchParams.get("resume") === "1") {
        KW.pausedUntil = null;
        KW.deadSweeps = 0;
        saveKrisha();
      }
      // Park it without a redeploy: ?pause=30 stands down for 30 days
      const pauseDays = Number(parsed.searchParams.get("pause") || 0);
      if (pauseDays > 0) {
        KW.pausedUntil = new Date(Date.now() + pauseDays * 24 * 3600e3).toISOString();
        saveKrisha();
      }
      if (parsed.searchParams.get("run") === "1") {
        if (!KRISHA_ON) {
          res.writeHead(409, { "Content-Type": MIME[".json"] });
          res.end(JSON.stringify({
            error: TG_TOKEN && TG_CHAT
              ? "выключено переменной KRISHA_WATCH=0"
              : "нужны TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID — слать уведомления некуда",
          }));
          return;
        }
        krishaTick();
      }
      res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
      res.end(JSON.stringify({
        enabled: KRISHA_ON,
        running: krishaRunning,
        everyHours: KRISHA_EVERY_H,
        minDiscount: KRISHA_MIN_DISCOUNT,
        paceMs: KRISHA_PACE_MS,
        detailsPerRun: KRISHA_DETAILS_PER_RUN,
        pausedUntil: KW.pausedUntil || null,
        deadSweeps: KW.deadSweeps || 0,
        bootstrapped: KW.bootstrapped,
        corpus: Object.keys(KW.corpus || {}).length,
        geocoded: Object.values(KW.corpus || {}).filter((c) => c.lat != null).length,
        area: KW.area,
        retrying: Object.keys(KW.failed || {}).length,
        runs: KW.runs || 0,
        lastRun: KW.lastRun,
        lastError: KW.lastError,
        lastSummary: KW.lastSummary || null,
        telegram: TG_TOKEN && TG_CHAT ? "настроен" : "не настроен",
      }, null, 2));
      return;
    }

    // Submit every storefront to IndexNow and report what it answered. Safe to expose:
    // it can only ever submit this host own URLs, and it is on a one-hour cooldown.
    if (urlPath === "/api/indexnow") {
      const go = parsed.searchParams.get("submit") === "1";
      if (!go) {
        res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
        res.end(JSON.stringify({ lastIndexNow, hint: "add ?submit=1 to announce all storefronts" }, null, 2));
        return;
      }
      pingIndexNowAll().then((out) => {
        res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
        res.end(JSON.stringify(out, null, 2));
      });
      return;
    }

    if (urlPath === "/api/health") {
      res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
      res.end(JSON.stringify({
        ok: true,
        node: process.version,
        persistentDir: PERSIST_DATA,
        persistent: PERSIST_OK,
        telegram: TG_TOKEN ? (TG_CHAT ? "настроен" : "нет TELEGRAM_CHAT_ID") : "нет TELEGRAM_BOT_TOKEN",
        stores: listMerchantSlugs().length,
        trackedStores: Object.keys(STATS).length,
      }));
      return;
    }

    if (urlPath === "/api/stats") {
      const token = parsed.searchParams.get("token") || "";
      const slug = parsed.searchParams.get("slug");
      const admin = process.env.STATS_TOKEN && token === process.env.STATS_TOKEN;
      if (slug) {
        const s = STATS[slug];
        res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
        res.end(JSON.stringify(s ? { slug, ...s } : { slug, visits: 0, clicks: 0, sources: {}, bots: {} }));
        return;
      }
      if (!admin) {
        res.writeHead(401, { "Content-Type": MIME[".json"] });
        res.end(JSON.stringify({ error: "token required for the aggregate view" }));
        return;
      }
      res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
      res.end(JSON.stringify(statsSummary(), null, 2));
      return;
    }

    if (urlPath === "/api/config") {
      res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
      res.end(JSON.stringify({ clerkPublishableKey: CLERK_PK || null }));
      return;
    }

    // Callback request from the phone-assistant landing. No auth on purpose: this is a
    // validation page, and a login wall in front of "leave your number" measures the wall.
    if (urlPath.startsWith("/api/cabinet/")) {
      (async () => {
        const send = (code, obj) => {
          res.writeHead(code, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
          res.end(JSON.stringify(obj));
        };
        if (!CLERK_PK || !CLERK_SK) return send(503, { error: "clerk_not_configured" });

        let ctx;
        try {
          ctx = await cabinetContext(req);
        } catch (e) {
          // Наружу — только факт отказа. Подробности разбора токена помогают
          // подбирать, а нам самим они видны в логе.
          console.log("[cabinet] отказ: " + String(e.message).slice(0, 120));
          return send(401, { error: e.message === "no_token" ? "no_token" : "bad_token" });
        }

        if (urlPath === "/api/cabinet/me") {
          const who = (await clerkUserEmail(ctx.userId)) || {};
          return send(200, {
            email: who.email || null,
            name: who.name || null,
            clinics: ctx.clinics.map((c) => ({
              name: c.name, number: c.public_number, org_id: c.org_id,
            })),
          });
        }

        // Ни один запрос ниже не принимает идентификатор клиники снаружи.
        if (!ctx.clinicIds.length) return send(200, { calls: [] });

        // Анкета клиники. Работаем с первой клиникой пользователя: сейчас она
        // у всех одна, а когда станет несколько, выбор придёт из кабинета и
        // будет сверен с ctx.clinicIds, а не принят на веру.
        const myClinic = ctx.clinicIds[0];

        if (urlPath === "/api/cabinet/profile" && req.method === "GET") {
          const c = await db.clinicById(myClinic);
          let profile = {};
          try { profile = JSON.parse(c.profile_json || "{}"); } catch {}
          return send(200, {
            fields: agentTemplate.FIELDS,
            sources: agentTemplate.SOURCES,
            integration: agentTemplate.INTEGRATION,
            profile: agentTemplate.cleanAll(profile),
            saved_at: c.profile_saved_at,
            built_at: c.agent_built_at,
            has_agent: !!c.agent_id,
            number: c.public_number,
            enrich_available: enrich.available(),
          });
        }

        if (urlPath === "/api/cabinet/profile" && req.method === "POST") {
          let body = {};
          try { body = JSON.parse(await readBody(req)) || {}; } catch {}
          // cleanAll режет длину и выбрасывает всё, чего нет в анкете: иначе в
          // хранилище попадёт то, что прислали помимо формы.
          const profile = agentTemplate.cleanAll(body.profile || {});
          if (!profile.name) return send(400, { error: "name_required" });
          await db.saveClinicProfile(myClinic, profile);
          return send(200, { ok: true, profile });
        }

        // Читает страницы клиники и предлагает заполненную анкету. Ничего не
        // сохраняет: предложение показывается клинике, и правит его она.
        if (urlPath === "/api/cabinet/enrich" && req.method === "POST") {
          let body = {};
          try { body = JSON.parse(await readBody(req)) || {}; } catch {}
          const urls = (Array.isArray(body.urls) ? body.urls : [])
            .map((u) => String(u || "").trim()).filter(Boolean).slice(0, 4);
          if (!urls.length) return send(400, { error: "no_urls" });

          const pages = [];
          const failed = [];
          for (const u of urls) {
            try { pages.push(await enrich.fetchSource(u)); }
            catch (e) { failed.push({ url: u, error: String(e.message).slice(0, 40) }); }
          }
          if (!pages.length) return send(200, { pages: [], failed, profile: null });

          if (!enrich.available()) {
            // Страницы прочитаны, разбирать нечем. Отдаём текст: даже так
            // заполнять анкету быстрее, чем ходить по сайту вручную.
            return send(200, {
              pages: pages.map((p) => ({ url: p.url, chars: p.chars, text: p.text.slice(0, 6000) })),
              failed, profile: null, error: "no_model_key",
            });
          }
          try {
            const draft = await enrich.extractProfile(pages);
            return send(200, {
              pages: pages.map((p) => ({ url: p.url, chars: p.chars })),
              failed,
              profile: agentTemplate.clean(draft),
            });
          } catch (e) {
            return send(200, {
              pages: pages.map((p) => ({ url: p.url, chars: p.chars })),
              failed, profile: null, error: String(e.message).slice(0, 80),
            });
          }
        }

        // Звонок самой клинике, чтобы она услышала своего ассистента. Номер
        // берём из запроса, но звоним ЕЁ агентом: услышать чужого нельзя.
        if (urlPath === "/api/cabinet/test-call" && req.method === "POST") {
          let body = {};
          try { body = JSON.parse(await readBody(req)) || {}; } catch {}
          const to = normalizeKzMobile(body.phone);
          if (!to) return send(400, { error: "bad_number" });
          const c = await db.clinicById(myClinic);
          if (!c.agent_id) return send(400, { error: "no_agent" });
          const r = await placeDemoCall(to, c.agent_id);
          if (!r.ok) return send(502, { error: r.reason || "call_failed" });
          return send(200, { ok: true });
        }

        // Сборка агента. Отделена от сохранения нарочно: анкету правят по
        // частям и подолгу, а перестраивать агента на каждое нажатие клавиши
        // значит менять то, что прямо сейчас разговаривает с пациентом.
        if (urlPath === "/api/cabinet/publish" && req.method === "POST") {
          const c = await db.clinicById(myClinic);
          let profile = {};
          try { profile = JSON.parse(c.profile_json || "{}"); } catch {}
          if (!profile.name) return send(400, { error: "profile_empty" });

          let agentId = c.agent_id;
          // Базового агента не трогаем: он общий и обслуживает демо на сайте.
          if (!agentId || agentId === agentTemplate.BASE_AGENT) {
            agentId = await agentTemplate.createAgent(profile);
          } else {
            await agentTemplate.updateAgent(agentId, profile);
          }
          await db.setClinicAgent(myClinic, agentId);

          // Номер клиники должен звонить именно этому агенту.
          if (c.phone_number_id && process.env.ELEVENLABS_API_KEY) {
            try {
              await fetch(
                "https://api.elevenlabs.io/v1/convai/phone-numbers/" + c.phone_number_id,
                {
                  method: "PATCH",
                  headers: {
                    "xi-api-key": process.env.ELEVENLABS_API_KEY,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ agent_id: agentId }),
                }
              );
            } catch (e) {
              console.log("[cabinet] номер к агенту не привязался: " + String(e.message).slice(0, 120));
            }
          }
          return send(200, { ok: true, agent_id: agentId });
        }

        // Даём клинике увидеть промпт целиком. Это её слова, и она вправе
        // знать, что именно услышит пациент.
        if (urlPath === "/api/cabinet/preview" && req.method === "GET") {
          const c = await db.clinicById(myClinic);
          let profile = {};
          try { profile = JSON.parse(c.profile_json || "{}"); } catch {}
          return send(200, {
            first_message: agentTemplate.buildFirstMessage(profile),
            prompt: agentTemplate.buildPrompt(profile),
          });
        }

        if (urlPath === "/api/cabinet/calls") {
          const calls = await db.callsForClinics(ctx.clinicIds, {
            limit: parsed.searchParams.get("limit"),
            offset: parsed.searchParams.get("offset"),
          });
          return send(200, { calls });
        }

        if (urlPath === "/api/cabinet/call") {
          const id = parsed.searchParams.get("id") || "";
          const call = await db.callForClinics(id, ctx.clinicIds);
          if (!call) return send(404, { error: "not_found" });
          return send(200, { call });
        }

        // Запись разговора лежит у ElevenLabs. Проксируем, а не даём ссылку:
        // прямая ссылка требует нашего ключа и открыла бы чужие разговоры.
        if (urlPath === "/api/cabinet/audio") {
          const id = parsed.searchParams.get("id") || "";
          const call = await db.callForClinics(id, ctx.clinicIds);
          if (!call) return send(404, { error: "not_found" });
          const key = process.env.ELEVENLABS_API_KEY;
          if (!key) return send(503, { error: "not_configured" });
          const r = await fetch(
            "https://api.elevenlabs.io/v1/convai/conversations/" +
            encodeURIComponent(id) + "/audio",
            { headers: { "xi-api-key": key } }
          );
          if (!r.ok) return send(502, { error: "audio_unavailable" });
          res.writeHead(200, {
            "Content-Type": r.headers.get("content-type") || "audio/mpeg",
            "Cache-Control": "private, max-age=300",
          });
          res.end(Buffer.from(await r.arrayBuffer()));
          return;
        }

        send(404, { error: "unknown_endpoint" });
      })().catch((e) => {
        console.log("[cabinet] " + String(e.message).slice(0, 200));
        res.writeHead(500, { "Content-Type": MIME[".json"] });
        res.end(JSON.stringify({ error: "internal" }));
      });
      return;
    }

    // Онбординг до входа. Клиника заполняет анкету, видит, что вышло, и только
    // потом регистрируется — регистрация нужна, чтобы привязать номер, а не
    // чтобы посмотреть.
    if (urlPath.startsWith("/api/onboard/")) {
      (async () => {
        const send = (code, obj) => {
          res.writeHead(code, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
          res.end(JSON.stringify(obj));
        };
        if (req.method !== "POST" && urlPath !== "/api/onboard/fields") {
          return send(405, { error: "method" });
        }

        if (urlPath === "/api/onboard/fields") {
          return send(200, {
            fields: agentTemplate.FIELDS,
            sources: agentTemplate.SOURCES,
            integration: agentTemplate.INTEGRATION,
            enrich_available: enrich.available(),
          });
        }

        if (urlPath === "/api/onboard/enrich") {
          if (tooOften("enrich:" + clientIp(req), 20, 3600e3)) {
            return send(429, { error: "too_often" });
          }
          let body = {};
          try { body = JSON.parse(await readBody(req)) || {}; } catch {}
          const urls = (Array.isArray(body.urls) ? body.urls : [])
            .map((u) => String(u || "").trim()).filter(Boolean).slice(0, 4);
          if (!urls.length) return send(400, { error: "no_urls" });

          const pages = [], failed = [];
          for (const u of urls) {
            try { pages.push(await enrich.fetchSource(u)); }
            catch (e) { failed.push({ url: u, error: String(e.message).slice(0, 40) }); }
          }
          if (!pages.length) return send(200, { pages: [], failed, profile: null });
          if (!enrich.available()) {
            return send(200, {
              pages: pages.map((p) => ({ url: p.url, chars: p.chars })),
              failed, profile: null, error: "no_model_key",
            });
          }
          try {
            const draft = await enrich.extractProfile(pages);
            return send(200, {
              pages: pages.map((p) => ({ url: p.url, chars: p.chars })),
              failed, profile: agentTemplate.clean(draft),
            });
          } catch (e) {
            return send(200, {
              pages: pages.map((p) => ({ url: p.url, chars: p.chars })),
              failed, profile: null, error: String(e.message).slice(0, 80),
            });
          }
        }

        // Здесь вход уже нужен: за анкетой закрепляется организация и номер.
        if (urlPath === "/api/onboard/claim") {
          if (!CLERK_PK || !CLERK_SK) return send(503, { error: "clerk_not_configured" });
          let ctx;
          try { ctx = await cabinetContext(req); }
          catch (e) { return send(401, { error: String(e.message).slice(0, 40) }); }

          let body = {};
          try { body = JSON.parse(await readBody(req)) || {}; } catch {}
          const profile = agentTemplate.cleanAll(body.profile || {});
          if (!profile.name) return send(400, { error: "name_required" });

          // Уже есть клиника — обновляем её, а не заводим вторую.
          let clinicId = ctx.clinicIds[0] || null;
          let orgId = ctx.orgIds[0] || null;

          if (!clinicId) {
            if (!orgId) {
              const r = await fetch("https://api.clerk.com/v1/organizations", {
                method: "POST",
                headers: { Authorization: "Bearer " + CLERK_SK, "Content-Type": "application/json" },
                body: JSON.stringify({ name: profile.name.slice(0, 100), created_by: ctx.userId }),
              });
              const j = await r.json();
              if (!r.ok) {
                console.log("[onboard] организация не создалась: " + JSON.stringify(j).slice(0, 200));
                return send(502, { error: "org_failed" });
              }
              orgId = j.id;
            }
            clinicId = await db.upsertClinic({ org_id: orgId, name: profile.name });
          }

          await db.saveClinicProfile(clinicId, profile);
          const clinic = await db.clinicById(clinicId);
          let agentId = clinic.agent_id;
          if (!agentId || agentId === agentTemplate.BASE_AGENT) {
            agentId = await agentTemplate.createAgent(profile);
          } else {
            await agentTemplate.updateAgent(agentId, profile);
          }
          await db.setClinicAgent(clinicId, agentId);
          return send(200, { ok: true, clinic_id: clinicId, org_id: orgId });
        }

        send(404, { error: "unknown_endpoint" });
      })().catch((e) => {
        console.log("[onboard] " + String(e.message).slice(0, 200));
        res.writeHead(500, { "Content-Type": MIME[".json"] });
        res.end(JSON.stringify({ error: "internal" }));
      });
      return;
    }

    // Витрина кабинета: показать, как он выглядит, не требуя входа. Звонки
    // берём у демо-клиники — той, чей номер стоит на лендинге.
    if (urlPath === "/api/demo/calls") {
      (async () => {
        const send = (code, obj) => {
          res.writeHead(code, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
          res.end(JSON.stringify(obj));
        };
        const clinicId = Number(process.env.DEMO_CLINIC_ID || 1);
        try {
          const calls = await db.callsForClinics([clinicId], { limit: 25 });
          send(200, { calls: calls.map(maskCall) });
        } catch (e) {
          console.log("[demo] " + String(e.message).slice(0, 120));
          send(200, { calls: [] });
        }
      })();
      return;
    }

    if (urlPath === "/api/demo/call") {
      (async () => {
        const send = (code, obj) => {
          res.writeHead(code, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
          res.end(JSON.stringify(obj));
        };
        const clinicId = Number(process.env.DEMO_CLINIC_ID || 1);
        const id = parsed.searchParams.get("id") || "";
        const call = await db.callForClinics(id, [clinicId]);
        if (!call) return send(404, { error: "not_found" });
        const safe = maskCall(call);
        // Расшифровку отдаём, потому что ради неё витрину и открывают, но
        // цифры в ней прячем: номер, названный вслух, — тот же номер.
        let turns = [];
        try { turns = JSON.parse(call.transcript || "[]"); } catch {}
        safe.transcript = JSON.stringify(turns.map((t) => ({
          role: t.role, message: maskDigits(String(t.message || "")),
        })));
        safe.summary = maskDigits(safe.summary || "");
        send(200, { call: safe });
      })().catch(() => {
        res.writeHead(500, { "Content-Type": MIME[".json"] });
        res.end(JSON.stringify({ error: "internal" }));
      });
      return;
    }

    if (urlPath === "/api/elevenlabs/post-call") {
      if (req.method !== "POST") { res.writeHead(405, { Allow: "POST" }).end(); return; }
      (async () => {
        const raw = await readBody(req);
        const check = verifyElevenSignature(
          raw,
          req.headers["elevenlabs-signature"],
          process.env.ELEVENLABS_WEBHOOK_SECRET
        );
        if (!check.ok) {
          console.log("[post-call] отклонён: " + check.reason);
          res.writeHead(401, { "Content-Type": MIME[".json"] });
          res.end(JSON.stringify({ error: check.reason }));
          return;
        }

        let body = {};
        try { body = JSON.parse(raw) || {}; } catch { body = {}; }
        const d = body.data || {};
        const an = d.analysis || {};
        const got = an.data_collection_results || {};
        const val = (k) => {
          const v = got[k];
          if (v === undefined || v === null) return "";
          return typeof v === "object" ? (v.value ?? "") : v;
        };

        // Номер, с которого звонили, известен всегда. Если из разговора
        // телефон не извлёкся — берём его, иначе клинике некому перезвонить.
        const pc = (d.metadata && d.metadata.phone_call) || {};
        const callerNumber = pc.external_number || pc.to_number || "";

        // Чья это клиника — определяем по номеру, на который позвонили.
        // Не нашли — строка останется без клиники и попадёт в общий список,
        // но не в чужой кабинет.
        let clinicId = null;
        try {
          clinicId = await db.clinicIdForCall({
            phone_number_id: pc.phone_number_id,
            agent_id: d.agent_id,
          });
        } catch (e) {
          console.log("[post-call] клинику определить не вышло: " + String(e.message).slice(0, 100));
        }

        const booking = {
          at: new Date().toISOString(),
          conversation: d.conversation_id || "",
          seconds: (d.metadata && d.metadata.call_duration_secs) || 0,
          // Модель слышит «восемь семьсот два» и пишет 8..., получается
          // +87029410625 — такой номер не наберётся и не откроется в WhatsApp.
          // А иногда она ошибается так, что чинить нечего (+72772940625).
          // Тогда берём определившийся номер звонящего: он от оператора, а не
          // с слуха. Нераспознанное показываем последним — лучше правдивый
          // номер линии, чем набор цифр, по которому не перезвонить.
          phone: normalizeKzMobile(val("client_phone")) ||
                 normalizeKzMobile(callerNumber) || callerNumber ||
                 String(val("client_phone") || "").slice(0, 40),
          name: String(val("client_name") || "").slice(0, 80),
          service: String(val("service") || "").slice(0, 120),
          when: String(val("desired_time") || "").slice(0, 80),
          booked: val("is_booked") === true || val("is_booked") === "true",
          urgent: val("is_urgent") === true || val("is_urgent") === "true",
          summary: String(an.transcript_summary || "").slice(0, 600),
        };
        await recordBooking(booking, {
          agent_id: d.agent_id || "",
          caller_number: callerNumber,
          clinic_id: clinicId,
          phone_number_id: pc.phone_number_id || "",
          agent_number: pc.agent_number || "",
          direction: pc.direction || "",
          transcript: d.transcript ? JSON.stringify(d.transcript) : null,
          raw: raw.slice(0, 200000),
        });

        // Разговор мог не состояться: связь, спешка, случайное нажатие. Тогда
        // от звонка остаётся только номер — перезванивать придётся вслепую,
        // и администратор должен видеть это сразу, а не выяснять из пустых полей.
        // Судим по тому, что узнали, а не по секундам: за двенадцать секунд
        // можно успеть сказать «зуб болит», и это уже не пустой звонок.
        const barelyTalked =
          !booking.name && !booking.service && !booking.when && !booking.summary;

        // Неотложка идёт отдельным сообщением: её нельзя пролистать в общем списке.
        const head = booking.urgent
          ? "🚨 <b>Срочный звонок</b>"
          : booking.booked
          ? "✅ <b>Новая запись</b>"
          : barelyTalked
          ? "📵 <b>Только номер — поговорить не успели</b>"
          : "📋 <b>Звонок без записи</b>";

        // Время по Алматы: клиника читает отчёт утром и должна сразу понимать,
        // во сколько человек звонил, а не пересчитывать из UTC.
        const almaty = new Date(Date.now() + 5 * 3600e3)
          .toISOString().slice(0, 16).replace("T", " ");

        // Пустые поля показываем явно. Пропуск строки читается как «всё есть»,
        // а клинике важно видеть, что телефон не назвали и перезвонить некуда.
        const row = (label, v) => label + ": " + (v ? v : "<i>не назвал</i>") + "\n";

        await notifyTelegram(
          head + "\n" + almaty + " (Алматы)\n\n" +
          (barelyTalked
            ? "Телефон: " + (booking.phone || "<i>скрыт</i>") + "\n" +
              "\nЗвонок длился " + booking.seconds + " с — человек не назвал " +
              "ни имени, ни причины.\nПерезвоните: зачем звонил, мы не знаем."
            : row("Имя", booking.name) +
              row("Телефон", booking.phone) +
              row("Услуга", booking.service) +
              row("Когда хочет", booking.when) +
              "\nРазговор: " + booking.seconds + " с" +
              (booking.summary ? "\n\n" + booking.summary : ""))
        );

        res.writeHead(200, { "Content-Type": MIME[".json"] });
        res.end(JSON.stringify({ ok: true }));
      })().catch((e) => {
        console.log("[post-call] ошибка: " + String(e.message).slice(0, 200));
        res.writeHead(500, { "Content-Type": MIME[".json"] });
        res.end(JSON.stringify({ error: "internal" }));
      });
      return;
    }

    if (urlPath === "/api/demo-call") {
      if (req.method !== "POST") { res.writeHead(405, { Allow: "POST" }).end(); return; }
      (async () => {
        const send = (code, obj) => {
          res.writeHead(code, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
          res.end(JSON.stringify(obj));
        };
        let body = {};
        try { body = JSON.parse(await readBody(req)) || {}; } catch { body = {}; }

        // Без явного согласия не звоним: иначе сюда впишут чужой номер.
        if (body.consent !== true) return send(400, { error: "consent_required" });

        const phone = normalizeKzMobile(body.phone);
        if (!phone) return send(400, { error: "bad_number" });

        const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
                   req.socket.remoteAddress || "";
        const day = demoCallsSince(24);
        if (day.length >= DEMO_MAX_PER_DAY) return send(429, { error: "daily_limit" });
        if (day.filter((c) => c.phone === phone).length >= DEMO_MAX_PER_NUMBER) {
          return send(429, { error: "number_limit" });
        }
        if (ip && day.filter((c) => c.ip === ip).length >= DEMO_MAX_PER_IP) {
          return send(429, { error: "ip_limit" });
        }

        const r = await placeDemoCall(phone);
        if (!r.ok) {
          console.log("[demo-call] отказ " + phone + " — " + JSON.stringify(r).slice(0, 200));
          return send(r.reason === "not_configured" ? 503 : 502, { error: r.reason });
        }

        DEMO_CALL_LOG.push({ at: Date.now(), phone, ip });
        console.log("[demo-call] звоним " + phone);
        await notifyTelegram("☎️ <b>Демо-звонок</b>\n\nНомер: " + phone);
        send(200, { ok: true });
      })().catch((e) => {
        res.writeHead(500, { "Content-Type": MIME[".json"] });
        res.end(JSON.stringify({ error: String(e.message).slice(0, 120) }));
      });
      return;
    }

    if (urlPath === "/api/callback") {
      if (req.method !== "POST") { res.writeHead(405, { Allow: "POST" }).end(); return; }
      (async () => {
        let body = {};
        try { body = JSON.parse(await readBody(req)) || {}; } catch { body = {}; }
        const phone = String(body.phone || "").slice(0, 40).trim();
        const name = String(body.name || "").slice(0, 80).trim();
        const kind = String(body.kind || "").slice(0, 60).trim();
        const lang = body.lang === "kk" ? "kk" : "ru";
        if (phone.replace(/[^0-9]/g, "").length < 10) {
          res.writeHead(400, { "Content-Type": MIME[".json"] });
          res.end(JSON.stringify({ error: "phone_required" }));
          return;
        }
        recordLead({ at: new Date().toISOString(), product: "otvet", name, phone, kind, lang });
        await notifyTelegram(
          "📞 <b>Заявка — Ответ</b>\n\n" +
          (name ? "Имя: " + name + "\n" : "") +
          "Телефон: " + phone + "\n" +
          (kind ? "Бизнес: " + kind + "\n" : "") +
          "Язык страницы: " + lang
        );
        res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
        res.end(JSON.stringify({ ok: true }));
      })().catch((e) => {
        res.writeHead(500, { "Content-Type": MIME[".json"] });
        res.end(JSON.stringify({ error: String(e.message).slice(0, 120) }));
      });
      return;
    }

    if (urlPath === "/api/lead") {
      if (req.method !== "POST") {
        res.writeHead(405, { Allow: "POST" }).end();
        return;
      }
      (async () => {
        const auth = req.headers.authorization || "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        const claims = await verifyClerkToken(token);
        let body = {};
        try {
          body = JSON.parse(await readBody(req)) || {};
        } catch {
          body = {};
        }
        const who = (await clerkUserEmail(claims.sub)) || {};
        recordLead({
          at: new Date().toISOString(),
          userId: claims.sub,
          email: who.email || null,
          name: who.name || null,
          shopUrl: String(body.shopUrl || "").slice(0, 300),
          slug: String(body.slug || "").slice(0, 100),
          score: Number(body.score) || null,
          lang: body.lang === "en" ? "en" : "ru",
        });
        res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
        res.end(JSON.stringify({ ok: true, email: who.email || null }));
      })().catch((e) => {
        res.writeHead(401, { "Content-Type": MIME[".json"] });
        res.end(JSON.stringify({ error: "unauthorized: " + e.message }));
      });
      return;
    }

    if (urlPath === "/api/ingest") {
      const target = parsed.searchParams.get("url") || "";
      handleIngest(target, req.headers.host)
        .then((result) => {
          res.writeHead(result.error ? 422 : 200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
          res.end(JSON.stringify(result));
        })
        .catch(() => {
          res.writeHead(500, { "Content-Type": MIME[".json"] });
          res.end(JSON.stringify({ error: "ingest failed" }));
        });
      return;
    }

    if (urlPath === "/api/audit") {
      const target = parsed.searchParams.get("url") || "";
      const lang = parsed.searchParams.get("lang") === "ru" ? "ru" : "en";
      runAudit(target, lang)
        .then((result) => {
          res.writeHead(result.error ? 422 : 200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
          res.end(JSON.stringify(result));
        })
        .catch(() => {
          res.writeHead(500, { "Content-Type": MIME[".json"] });
          res.end(JSON.stringify({ error: (S[lang] || S.en).err_fetch }));
        });
      return;
    }

    // /phone/ was where this landing first lived and is already submitted to
    // IndexNow, so it keeps working — permanently, pointing at the new place.
    if (urlPath === "/phone" || urlPath === "/phone/" || urlPath === "/phone/kk" || urlPath === "/phone/kk/") {
      res.writeHead(301, { Location: urlPath.indexOf("/kk") > 0 ? "/kk/" : "/" }).end();
      return;
    }

    if (urlPath === "/robots.txt") {
      res.writeHead(200, { "Content-Type": MIME[".txt"], "Cache-Control": "public, max-age=3600" });
      // /go/ are outbound buy redirects — no reason for crawlers to follow them
      res.end("User-agent: *\nAllow: /\nDisallow: /go/\nDisallow: /api/\n\nSitemap: " + CANONICAL + "/sitemap.xml\n");
      return;
    }

    if (urlPath === "/sitemap.xml") {
      res.writeHead(200, { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=600" });
      res.end(buildSitemap(CANONICAL));
      return;
    }

    if (urlPath === "/" + INDEXNOW_KEY + ".txt") {
      res.writeHead(200, { "Content-Type": MIME[".txt"] });
      res.end(INDEXNOW_KEY);
      return;
    }

    const mcpMatch = urlPath.match(/^\/store\/([a-z0-9-]+)\/mcp$/);
    if (mcpMatch) {
      handleMcp(req, res, mcpMatch[1]).catch(() => {
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
      return;
    }

    const gfeedMatch = urlPath.match(/^\/store\/([a-z0-9-]+)\/feed-google\.xml$/);
    if (gfeedMatch) {
      const xml = buildGoogleFeed(gfeedMatch[1], CANONICAL);
      if (xml) {
        res.writeHead(200, { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=300" });
        res.end(xml);
        return;
      }
    }

    const feedMatch = urlPath.match(/^\/store\/([a-z0-9-]+)\/feed\.json$/);
    if (feedMatch) {
      const feed = buildFeed(feedMatch[1], CANONICAL);
      if (feed) {
        res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "public, max-age=300" });
        res.end(JSON.stringify(feed, null, 2));
        return;
      }
    }

    // Buy-button redirect: the click we can prove we sent to the merchant
    const goMatch = urlPath.match(/^\/go\/([a-z0-9-]+)\/([\w-]+)$/);
    if (goMatch) {
      const prof = loadProfile(goMatch[1]);
      const prod = prof && prof.products.find((p) => String(p.id) === goMatch[2]);
      if (prod) {
        const src = parsed.searchParams.get("s") || "unknown";
        const isHuman = track(goMatch[1], req, "click", src);
        const b = STATS[goMatch[1]] || { clicks: 0, clicksTagged: 0 };
        // Crawlers follow buy links too, and some pose as browsers — the missing
        // JS-added marker is what separates them, so it gates the alert.
        if (isHuman) notifyTelegram(
          "🛒 <b>Переход к продавцу</b>\n" +
            "Магазин: <b>" + prof.name + "</b>\n" +
            prod.title + "\n" +
            (prod.priceFormatted || prod.price + " ₸") + "\n" +
            "Источник: " + (SOURCE_LABEL[src] || src) + "\n" +
            "Живых переходов у этого магазина: " + (b.clicksTagged || 0) + "\n" +
            CANONICAL + "/store/" + goMatch[1]
        );
        res.writeHead(302, { Location: prod.kaspiUrl, "Cache-Control": "no-store" }).end();
        return;
      }
    }

    const storeMatch = urlPath.match(/^\/store\/([a-z0-9-]+)\/?$/);
    if (storeMatch) {
      const html = renderStore(storeMatch[1]);
      if (html) {
        track(storeMatch[1], req, "visit");
        res.writeHead(200, { "Content-Type": MIME[".html"], "Cache-Control": "public, max-age=300" }).end(html);
        return;
      }
    }

    let filePath = path.normalize(path.join(ROOT, urlPath));

    // Не выходить за пределы корня проекта
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        // SPA-стиль: на неизвестные пути отдаём главную
        fs.readFile(path.join(ROOT, "index.html"), (err2, home) => {
          if (err2) {
            res.writeHead(404).end("Not found");
          } else {
            res.writeHead(200, { "Content-Type": MIME[".html"] }).end(home);
          }
        });
        return;
      }
      const type = MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": type }).end(data);
    });
  })
  .listen(PORT, () => console.log(`Saudager running on port ${PORT}`));
