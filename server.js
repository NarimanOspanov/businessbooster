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
  ".pdf": "application/pdf",
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
// Кому уходят служебные уведомления (переходы, лиды, запросы в боте): список
// админов через запятую в BOT_ADMIN_TELEGRAM_IDS. Без него — один чат из
// TELEGRAM_CHAT_ID, как раньше. Каждое уведомление получает каждый из списка.
const TG_ADMINS = [...new Set(
  (process.env.BOT_ADMIN_TELEGRAM_IDS || TG_CHAT).split(/[^\d-]+/).filter(Boolean)
)];
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
  if (!TG_TOKEN || !TG_ADMINS.length) return;
  if (Date.now() - tgWindowStart > 3600e3) {
    tgWindowStart = Date.now();
    tgSent = 0;
  }
  // Бюджет считается на уведомление, а не на адресата: сорок событий в час,
  // сколько бы админов их ни получали.
  if (tgSent >= 40) return Promise.resolve({ ok: false, description: "rate limit reached" }); // never flood the chat
  tgSent++;
  // Всем админам разом. Итог — как у одиночной отправки: ok, если дошло хотя
  // бы до одного; description — кому не дошло и почему; result — от первого
  // удачного (на него смотрит /api/telegram-test).
  return Promise.all(TG_ADMINS.map((chat) => sendTelegram(chat, text).then((r) => ({ chat, r })))).then((all) => {
    const good = all.filter((x) => x.r && x.r.ok);
    const bad = all.filter((x) => !(x.r && x.r.ok));
    return {
      ok: good.length > 0,
      description: bad.length ? bad.map((x) => x.chat + ": " + ((x.r && x.r.description) || "нет ответа")).join("; ") : undefined,
      result: good.length ? good[0].r.result : undefined,
      delivered: good.map((x) => x.chat),
    };
  });
}

// Внутренний дашборд мониторинга находок «агент → хозяин». Данные тянет с
// /api/krisha/monitor?data=1, отметки шлёт на ?set=. Ключ берёт из своего URL.
const KRISHA_MONITOR_HTML = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Крыша · мониторинг находок</title>
<style>
  :root{--bg:#0f1216;--card:#181d24;--line:#262d37;--fg:#e6e9ee;--mut:#8a95a5;--ok:#2fbf71;--no:#e5484d;--acc:#4c8dff}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:16px}
  h1{font-size:18px;margin:0 0 12px}
  .mut{color:var(--mut)}
  table{border-collapse:collapse;width:100%;max-width:640px;margin:0 0 24px}
  th,td{padding:6px 10px;border-bottom:1px solid var(--line);text-align:left;font-variant-numeric:tabular-nums}
  th{color:var(--mut);font-weight:600}
  .find{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;margin:0 0 14px}
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  @media(max-width:640px){.cols{grid-template-columns:1fr}}
  .side h3{margin:0 0 6px;font-size:13px;letter-spacing:.02em;text-transform:uppercase;color:var(--mut)}
  .photos{display:flex;gap:4px;overflow-x:auto;margin:0 0 8px}
  .photos img{height:96px;border-radius:6px;object-fit:cover;flex:0 0 auto;background:#222}
  .p{margin:2px 0}
  a{color:var(--acc);text-decoration:none}
  .verdict{margin:10px 0;padding:8px 10px;border-radius:8px;background:#12161c;border:1px solid var(--line)}
  .btns{display:flex;gap:8px;margin-top:8px}
  button{border:1px solid var(--line);background:#12161c;color:var(--fg);border-radius:8px;padding:8px 14px;cursor:pointer;font:inherit}
  button.ok.on{background:var(--ok);border-color:var(--ok);color:#04140b}
  button.no.on{background:var(--no);border-color:var(--no);color:#1a0405}
  .tag{display:inline-block;padding:1px 7px;border-radius:99px;font-size:12px}
  .tag.y{background:rgba(47,191,113,.15);color:var(--ok)} .tag.n{background:rgba(229,72,77,.15);color:var(--no)} .tag.q{background:rgba(138,149,165,.15);color:var(--mut)}
  .fieldsbox{margin:10px 0;padding:8px 10px;border-radius:8px;background:#12161c;border:1px solid var(--line)}
  .fields{display:flex;flex-wrap:wrap}
  .agenthead{border-bottom:1px solid var(--line);padding-bottom:10px;margin-bottom:10px}
  .candhead{color:var(--mut);font-size:12px;text-transform:uppercase;letter-spacing:.03em;margin:0 0 8px}
  .cand{border:1px solid var(--line);border-radius:10px;padding:10px;margin:0 0 10px;background:#12161c}
  .candtitle{font-weight:600;margin:0 0 6px}
</style></head><body>
<h1>Крыша · мониторинг находок «агент → хозяин»</h1>
<div id="stats" class="mut">загрузка…</div>
<div id="finds"></div>
<script>
var KEY = new URLSearchParams(location.search).get("key") || "";
var API = "/api/krisha/monitor?key=" + encodeURIComponent(KEY);
function esc(s){s=(s==null?"":String(s));return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function money(n){return n?Math.round(n).toLocaleString("ru-RU")+" ₸":"";}
function show(id){return "https://krisha.kz/a/show/"+id;}
function pad2(n){return ("0"+n).slice(-2);}
function dm(v){if(!v)return "";var d=new Date(v);if(isNaN(d))return "";return pad2(d.getUTCDate())+"."+pad2(d.getUTCMonth()+1)+"."+d.getUTCFullYear();}
function dmT(v){if(!v)return "";var d=new Date(new Date(v).getTime()+5*3600e3);if(isNaN(d))return "";return dm(d)+" "+pad2(d.getUTCHours())+":"+pad2(d.getUTCMinutes());}
function dates(x,pre){var b=[];
  if(dm(x[pre+"created"]))b.push("создано "+dm(x[pre+"created"]));
  if(dm(x[pre+"added"]))b.push("поднято "+dm(x[pre+"added"]));
  if(dmT(x[pre+"seen"]))b.push("в базе с "+dmT(x[pre+"seen"])+" (Алматы)");
  return b.length?"<div class='p mut'>"+esc(b.join(" · "))+"</div>":"";}
function par(x,pre){var b=[];
  if(x[pre+"rooms"])b.push(x[pre+"rooms"]+"-комн");
  if(x[pre+"area"])b.push(x[pre+"area"]+" м²");
  if(x[pre+"floor"]&&x[pre+"floors"])b.push(x[pre+"floor"]+"/"+x[pre+"floors"]+" эт");
  if(x[pre+"year"])b.push(x[pre+"year"]+" г");
  if(x[pre+"house"])b.push(x[pre+"house"]);
  if(x[pre+"toilet"])b.push("с/у "+x[pre+"toilet"]);
  return b.join(" · ");}
function imgs(a){if(!a||!a.length)return "<div class=mut>нет фото</div>";var h="";for(var i=0;i<a.length;i++)h+="<img loading=lazy src='"+esc(a[i])+"'>";return "<div class=photos>"+h+"</div>";}
function side(title,id,photos,paramStr,extra){
  return "<div class=side><h3>"+title+"</h3>"+imgs(photos)+
    "<div class=p>"+esc(paramStr)+"</div>"+(extra||"")+
    "<div class=p><a href='"+show(id)+"' target=_blank>krisha.kz/a/show/"+id+"</a></div></div>";}
function fld(label,state,note){var c=state==="y"?"y":state==="n"?"n":"q";var s=state==="y"?"✓":state==="n"?"✗":"—";
  return "<span class='tag "+c+"' style='margin:2px 4px 2px 0'>"+label+" "+s+(note?" "+note:"")+"</span>";}
function eq(label,a,b){if(a==null||b==null||a===""||b==="")return fld(label,"q");return fld(label,a===b?"y":"n");}
function chips(f){var o=[];
  if(f.a_lat!=null&&f.o_lat!=null)o.push(fld("координаты",(Math.abs(f.a_lat-f.o_lat)<0.0006&&Math.abs(f.a_lon-f.o_lon)<0.0008)?"y":"n"));
  else o.push(fld("координаты","q"));
  if(f.a_cx&&f.o_cx)o.push(fld("ЖК",f.a_cx===f.o_cx?"y":"n"));else o.push(fld("ЖК","q"));
  o.push(fld("площадь",(Math.abs(f.a_area-f.o_area)<=5)?"y":"n",f.a_area+"/"+f.o_area));
  o.push(eq("комнаты",f.a_rooms,f.o_rooms));
  o.push(eq("этаж",f.a_floor,f.o_floor));
  o.push(eq("этажность",f.a_floors,f.o_floors));
  if(f.a_sslug&&f.o_sslug)o.push(fld("улица+дом",(f.a_sslug===f.o_sslug&&f.a_hnum===f.o_hnum)?"y":"n"));else o.push(fld("улица+дом","q"));
  o.push(eq("район",f.a_district,f.o_district));
  if(f.a_year&&f.o_year)o.push(fld("год",Math.abs(f.a_year-f.o_year)<=1?"y":"n",f.a_year+"/"+f.o_year));else o.push(fld("год","q"));
  o.push(eq("тип дома",f.a_house,f.o_house));
  o.push(eq("санузел",f.a_toilet,f.o_toilet));
  return "<div class=fields>"+o.join("")+"</div>";}
function render(d){
  var s=d.stats||{}; var t=s.total||{};
  var rows="<table><tr><th>День</th><th>Проверено</th><th>Нашли (параметры)</th></tr>";
  (s.byDay||[]).forEach(function(x){rows+="<tr><td>"+String(x.day).slice(0,10)+"</td><td>"+x.searched+"</td><td>"+x.matched+"</td></tr>";});
  rows+="</table>";
  document.getElementById("stats").innerHTML="<b>Всего проверено агентских:</b> "+(t.searched||0)+
    " · <b>нашли хозяина:</b> "+(t.matched||0)+rows;
  var box=document.getElementById("finds"); box.innerHTML="";
  // Группируем по агентскому объявлению: одно искомое сверху, под ним все его кандидаты.
  var groups={},order=[];
  (d.finds||[]).forEach(function(f){ if(!groups[f.agent_id]){groups[f.agent_id]=[];order.push(f.agent_id);} groups[f.agent_id].push(f); });
  order.forEach(function(aid){
    var list=groups[aid], f0=list[0];
    var el=document.createElement("div"); el.className="find";
    var h="<div class=agenthead><h3>Искомое объявление (агент)</h3>"+imgs(f0.a_photos)+
      "<div class=p>"+esc(par(f0,"a_")+" · "+money(f0.a_price))+"</div>"+dates(f0,"a_")+
      "<div class=p><a href='"+show(aid)+"' target=_blank>krisha.kz/a/show/"+aid+"</a></div></div>";
    h+="<div class=candhead>Кандидаты-хозяева: "+list.length+"</div>";
    list.forEach(function(f){
      var ph = f.photo_match===true ? "<span class='tag y'>фото: та же ("+f.photo_conf+")</span>"
        : f.photo_match===false ? "<span class='tag n'>фото: не та ("+f.photo_conf+")</span>"
        : "<span class='tag q'>фото не проверено</span>";
      h+="<div class=cand><div class=candtitle>Кандидат · score "+f.param_score+"</div>"+
        imgs(f.o_photos)+
        "<div class=p>"+esc(par(f,"o_")+" · "+money(f.o_price))+"</div>"+dates(f,"o_")+
        "<div class=p><a href='"+show(f.owner_id)+"' target=_blank>krisha.kz/a/show/"+f.owner_id+"</a></div>"+
        "<div class=fieldsbox><div class=mut style='font-size:12px;margin-bottom:4px'>что совпало:</div>"+chips(f)+"</div>"+
        "<div class=verdict>"+ph+(f.photo_why?" — "+esc(f.photo_why):"")+"</div>"+
        "<div class=mut style='font-size:12px;margin:8px 0 4px'>Ваш вердикт по фото — это та же квартира?</div>"+
        "<div class=btns>"+
          "<button class='ok"+(f.human_ok===true?" on":"")+"' data-id="+f.id+" data-v=1>✅ та же квартира</button>"+
          "<button class='no"+(f.human_ok===false?" on":"")+"' data-id="+f.id+" data-v=0>❌ другая квартира</button>"+
        "</div></div>";
    });
    el.innerHTML=h;
    box.appendChild(el);
  });
  box.querySelectorAll("button").forEach(function(b){
    b.onclick=function(){
      var id=b.getAttribute("data-id"), v=b.getAttribute("data-v");
      var on=b.classList.contains("on");
      fetch(API+"&set="+id+"&ok="+(on?"clear":v)).then(function(){
        var card=b.closest(".find");
        card.querySelectorAll("button").forEach(function(x){x.classList.remove("on");});
        if(!on)b.classList.add("on");
      });
    };
  });
}
fetch(API+"&data=1").then(function(r){return r.json();}).then(render).catch(function(e){
  document.getElementById("stats").textContent="Ошибка загрузки: "+e;
});
</script></body></html>`;

// Дашборд собственника: импорт по дням/периодам с разбивкой на сделку,
// продавца и тип, плюс конверсия (успешные находки оригиналов). Данные с
// /api/krisha/stats?data=1, всё считает и рисует клиент.
const KRISHA_STATS_HTML = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Крыша · импорт и находки</title>
<style>
  :root{--bg:#0f1216;--card:#181d24;--line:#262d37;--fg:#e6e9ee;--mut:#8a95a5;--ok:#2fbf71;--acc:#4c8dff;--rent:#f5a524;--sale:#4c8dff}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:18px;max-width:900px;margin:0 auto}
  h1{font-size:20px;margin:0 0 4px} .sub{color:var(--mut);margin:0 0 16px}
  .tabs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 16px}
  .tab{border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:8px;padding:8px 16px;cursor:pointer;font:inherit}
  .tab.on{background:var(--acc);border-color:var(--acc);color:#04122e;font-weight:600}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:0 0 20px}
  .c{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px}
  .c .n{font-size:26px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.1}
  .c .l{color:var(--mut);font-size:12px;margin-top:4px;text-transform:uppercase;letter-spacing:.03em}
  .c .sm{color:var(--mut);font-size:12px;margin-top:6px}
  .big .n{color:var(--ok)}
  .filters{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px;align-items:center}
  .filters .lbl{color:var(--mut);font-size:12px;margin-right:2px}
  .f{border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:99px;padding:5px 12px;cursor:pointer;font:inherit;font-size:13px}
  .f.on{background:var(--fg);color:#0f1216;border-color:var(--fg)}
  .chartbox{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;margin:0 0 20px}
  .chartbox h3{margin:0 0 12px;font-size:14px}
  svg{display:block;width:100%;height:auto;overflow:visible}
  table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}
  th,td{padding:6px 8px;border-bottom:1px solid var(--line);text-align:right}
  th:first-child,td:first-child{text-align:left}
  th{color:var(--mut);font-weight:600;font-size:12px}
  .leg{display:flex;gap:14px;font-size:12px;color:var(--mut);margin-top:8px}
  .leg i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:middle}
</style></head><body>
<h1>Крыша · импорт и находки</h1>
<p class="sub" id="range">загрузка…</p>
<div class="tabs" id="tabs"></div>
<div class="cards" id="cards"></div>
<div class="filters"><span class="lbl">Сделка:</span><span id="deals"></span></div>
<div class="chartbox"><h3>Импорт по дням</h3><div id="chart"></div>
  <div class="leg"><span><i style="background:var(--sale)"></i>продажа</span><span><i style="background:var(--rent)"></i>аренда</span><span><i style="background:var(--ok)"></i>найдено оригиналов</span></div>
</div>
<div class="chartbox"><h3>По дням — таблица</h3><div id="table"></div></div>
<script>
var KEY=new URLSearchParams(location.search).get("key")||"";
var DATA=null, PERIOD=1, DEAL="all";
var PERIODS=[{d:1,t:"Сутки"},{d:7,t:"7 дней"},{d:30,t:"30 дней"},{d:60,t:"60 дней"}];
function n(x){return (x==null?0:x).toLocaleString("ru-RU");}
function byDay(){ // объединяем импорт/поиск/фото по дню
  var m={};
  (DATA.imports||[]).forEach(function(r){m[r.day]=m[r.day]||{day:r.day};Object.assign(m[r.day],r);});
  (DATA.searched||[]).forEach(function(r){m[r.day]=m[r.day]||{day:r.day};m[r.day].searched=r.searched;m[r.day].matched=r.matched;});
  (DATA.photos||[]).forEach(function(r){m[r.day]=m[r.day]||{day:r.day};m[r.day].photo_ok=r.photo_ok;m[r.day].human_ok=r.human_ok;});
  return Object.keys(m).sort().map(function(k){return m[k];});
}
function periodRows(){var all=byDay();return all.slice(Math.max(0,all.length-PERIOD));}
function impVal(r){return DEAL==="sale"?(r.sale||0):DEAL==="rent"?(r.rent||0):(r.total||0);}
function render(){
  document.getElementById("range").textContent="за "+(PERIOD===1?"последние сутки":"последние "+PERIOD+" дней")+" · обновлено "+new Date().toLocaleString("ru-RU");
  var rows=periodRows();
  var sum=function(f){return rows.reduce(function(a,r){return a+(f(r)||0);},0);};
  var imp=sum(impVal), sale=sum(function(r){return r.sale;}), rent=sum(function(r){return r.rent;});
  var owner=sum(function(r){return r.owner;}), spec=sum(function(r){return r.specialist;}), comp=sum(function(r){return r.company;}), cx=sum(function(r){return r.complex;});
  var searched=sum(function(r){return r.searched;}), matched=sum(function(r){return r.matched;}), photo=sum(function(r){return r.photo_ok;});
  var conv=searched?Math.round(1000*photo/searched)/10:0;
  document.getElementById("cards").innerHTML=
    card(n(imp),"импортировано"+(DEAL==="all"?"":DEAL==="sale"?" (продажа)":" (аренда)"),"продажа "+n(sale)+" · аренда "+n(rent))+
    card(n(owner),"из них от хозяев",spec?("агенты "+n(spec+comp)+" · застройщик "+n(cx)):"")+
    card(n(searched),"проверено агентских","нашли по параметрам "+n(matched))+
    cardBig(n(photo),"найдено оригиналов","подтверждено по фото")+
    cardBig(conv+"%","конверсия","оригинал / проверенных");
  drawChart(rows);
  drawTable(rows);
}
function card(v,l,sm){return "<div class=c><div class=n>"+v+"</div><div class=l>"+l+"</div>"+(sm?"<div class=sm>"+sm+"</div>":"")+"</div>";}
function cardBig(v,l,sm){return "<div class='c big'><div class=n>"+v+"</div><div class=l>"+l+"</div>"+(sm?"<div class=sm>"+sm+"</div>":"")+"</div>";}
function drawChart(rows){
  var W=860,H=220,pad=28,bw;
  if(!rows.length){document.getElementById("chart").innerHTML="<p style='color:var(--mut)'>нет данных</p>";return;}
  var max=Math.max(1,Math.max.apply(null,rows.map(function(r){return (r.sale||0)+(r.rent||0);})));
  bw=Math.min(60,(W-pad*2)/rows.length-6);
  var x0=pad, gap=(W-pad*2)/rows.length;
  var svg="<svg viewBox='0 0 "+W+" "+H+"'>";
  // ось
  svg+="<line x1="+pad+" y1="+(H-pad)+" x2="+(W-pad)+" y2="+(H-pad)+" stroke='#262d37'/>";
  rows.forEach(function(r,i){
    var cx=x0+gap*i+gap/2, s=r.sale||0, rt=r.rent||0, tot=s+rt;
    var hTot=(H-pad*2)*tot/max, hRent=(H-pad*2)*rt/max;
    var y=H-pad-hTot;
    // продажа (низ) + аренда (верх)
    svg+="<rect x="+(cx-bw/2)+" y="+(H-pad-((H-pad*2)*s/max))+" width="+bw+" height="+((H-pad*2)*s/max)+" fill='var(--sale)' rx=2/>";
    svg+="<rect x="+(cx-bw/2)+" y="+y+" width="+bw+" height="+hRent+" fill='var(--rent)' rx=2/>";
    // найдено — зелёная точка над столбцом
    var f=r.photo_ok||0; if(f){svg+="<circle cx="+cx+" cy="+(y-8)+" r=4 fill='var(--ok)'/><text x="+cx+" y="+(y-14)+" fill='var(--ok)' font-size=11 text-anchor=middle>"+f+"</text>";}
    svg+="<text x="+cx+" y="+(H-pad+14)+" fill='#8a95a5' font-size=10 text-anchor=middle>"+r.day.slice(5)+"</text>";
    svg+="<text x="+cx+" y="+(y-2)+" fill='#e6e9ee' font-size=10 text-anchor=middle>"+(tot||"")+"</text>";
  });
  svg+="</svg>";
  document.getElementById("chart").innerHTML=svg;
}
function drawTable(rows){
  var h="<table><tr><th>День</th><th>Всего</th><th>Продажа</th><th>Аренда</th><th>Хозяев</th><th>Проверено</th><th>Найдено</th></tr>";
  rows.slice().reverse().forEach(function(r){
    h+="<tr><td>"+r.day+"</td><td>"+n(r.total)+"</td><td>"+n(r.sale)+"</td><td>"+n(r.rent)+"</td><td>"+n(r.owner)+"</td><td>"+n(r.searched)+"</td><td style='color:var(--ok)'>"+n(r.photo_ok)+"</td></tr>";
  });
  h+="</table>";
  document.getElementById("table").innerHTML=h;
}
function tabs(){
  document.getElementById("tabs").innerHTML=PERIODS.map(function(p){return "<button class='tab"+(p.d===PERIOD?" on":"")+"' data-d="+p.d+">"+p.t+"</button>";}).join("");
  document.getElementById("deals").innerHTML=[["all","все"],["sale","продажа"],["rent","аренда"]].map(function(x){return "<button class='f"+(x[0]===DEAL?" on":"")+"' data-deal="+x[0]+">"+x[1]+"</button>";}).join(" ");
  document.querySelectorAll("[data-d]").forEach(function(b){b.onclick=function(){PERIOD=+b.getAttribute("data-d");tabs();render();};});
  document.querySelectorAll("[data-deal]").forEach(function(b){b.onclick=function(){DEAL=b.getAttribute("data-deal");tabs();render();};});
}
fetch("/api/krisha/stats?data=1&key="+encodeURIComponent(KEY)).then(function(r){return r.json();}).then(function(d){DATA=d;tabs();render();}).catch(function(e){document.getElementById("range").textContent="Ошибка: "+e;});
</script></body></html>`;

// --- Те же две страницы, но поверх списка карты (krisha_list) ----------------
// Мониторинг находок по списку: у кандидатов нет года/типа дома/санузла и
// улицы, зато есть адрес текстом, состояние (архив) и номер.
const KRISHA_LIST_MONITOR_HTML = KRISHA_MONITOR_HTML
  .replace("<title>Крыша · мониторинг находок</title>", "<title>Крыша · находки по списку</title>")
  .replace("<h1>Крыша · мониторинг находок «агент → хозяин»</h1>", "<h1>Крыша · находки по списку «агент → хозяин»</h1>")
  .replace('"/api/krisha/monitor?key="', '"/api/krisha/listmonitor?key="')
  .replace(/function chips\(f\)\{[\s\S]*?return "<div class=fields>"\+o\.join\(""\)\+"<\/div>";\}/,
`function chips(f){var o=[];
  if(f.a_lat!=null&&f.o_lat!=null)o.push(fld("координаты",(Math.abs(f.a_lat-f.o_lat)<0.0006&&Math.abs(f.a_lon-f.o_lon)<0.0008)?"y":"n"));
  else o.push(fld("координаты","q"));
  if(f.a_cx&&f.o_cx)o.push(fld("ЖК",f.a_cx===f.o_cx?"y":"n"));else o.push(fld("ЖК","q"));
  var tol=Math.max(1,(f.a_area||0)*0.03);
  o.push(fld("площадь",(Math.abs(f.a_area-f.o_area)<=tol)?"y":"n",f.a_area+"/"+f.o_area));
  o.push(eq("комнаты",f.a_rooms,f.o_rooms));
  o.push(eq("этаж",f.a_floor,f.o_floor));
  o.push(eq("этажность",f.a_floors,f.o_floors));
  return "<div class=fields>"+o.join("")+"</div>";}`)
  .replace(/function dates\(x,pre\)\{[\s\S]*?return b\.length\?"<div class='p mut'>"\+esc\(b\.join\(" · "\)\)\+"<\/div>":"";\}/,
`function dates(x,pre){var b=[];
  if(x[pre+"addr"])b.push(x[pre+"addr"]);
  if(dm(x[pre+"bumped"]))b.push("поднято "+dm(x[pre+"bumped"]));
  if(dmT(x[pre+"seen"]))b.push("в базе с "+dmT(x[pre+"seen"])+" (Алматы)");
  if(x[pre+"storage"]&&x[pre+"storage"]!=="live")b.push("в архиве");
  if(x[pre+"phones"])b.push("номер снят");
  return b.length?"<div class='p mut'>"+esc(b.join(" · "))+"</div>":"";}`);

// Дашборд по списку: те же карточки и график, плюс события списка (поднятия,
// смены цены, архив) и снятые номера хозяев.
const KRISHA_LIST_STATS_HTML = KRISHA_STATS_HTML
  .replace("<title>Крыша · импорт и находки</title>", "<title>Крыша · список: импорт и находки</title>")
  .replace("<h1>Крыша · импорт и находки</h1>", "<h1>Крыша · список: импорт и находки</h1>")
  .replace('fetch("/api/krisha/stats?data=1&key="', 'fetch("/api/krisha/liststats?data=1&key="')
  .replace(`  (DATA.photos||[]).forEach(function(r){m[r.day]=m[r.day]||{day:r.day};m[r.day].photo_ok=r.photo_ok;m[r.day].human_ok=r.human_ok;});`,
`  (DATA.photos||[]).forEach(function(r){m[r.day]=m[r.day]||{day:r.day};m[r.day].photo_ok=r.photo_ok;m[r.day].human_ok=r.human_ok;});
  (DATA.events||[]).forEach(function(r){m[r.day]=m[r.day]||{day:r.day};m[r.day].bumps=r.bumps;m[r.day].prices=r.prices;m[r.day].archived=r.archived;});
  (DATA.phones||[]).forEach(function(r){m[r.day]=m[r.day]||{day:r.day};m[r.day].phones=r.phones;});`)
  .replace(`    cardBig(conv+"%","конверсия","оригинал / проверенных");`,
`    cardBig(conv+"%","конверсия","оригинал / проверенных")+
    card(n(sum(function(r){return r.phones;})),"номеров снято","у хозяев за период")+
    card(n(sum(function(r){return r.bumps;})),"поднятий","смен цены "+n(sum(function(r){return r.prices;}))+" · в архив "+n(sum(function(r){return r.archived;})))+
    (DATA.totals?card(n(DATA.totals.owner_queue),"хозяев в очереди","без номера, живых · с номером "+n(DATA.totals.owner_phones)):"");`)
  .replace(`  var h="<table><tr><th>День</th><th>Всего</th><th>Продажа</th><th>Аренда</th><th>Хозяев</th><th>Проверено</th><th>Найдено</th></tr>";
  rows.slice().reverse().forEach(function(r){
    h+="<tr><td>"+r.day+"</td><td>"+n(r.total)+"</td><td>"+n(r.sale)+"</td><td>"+n(r.rent)+"</td><td>"+n(r.owner)+"</td><td>"+n(r.searched)+"</td><td style='color:var(--ok)'>"+n(r.photo_ok)+"</td></tr>";
  });`,
`  var h="<table><tr><th>День</th><th>Всего</th><th>Продажа</th><th>Аренда</th><th>Хозяев</th><th>Проверено</th><th>Найдено</th><th>Номеров</th><th>Поднятий</th><th>Цена</th><th>Архив</th></tr>";
  rows.slice().reverse().forEach(function(r){
    h+="<tr><td>"+r.day+"</td><td>"+n(r.total)+"</td><td>"+n(r.sale)+"</td><td>"+n(r.rent)+"</td><td>"+n(r.owner)+"</td><td>"+n(r.searched)+"</td><td style='color:var(--ok)'>"+n(r.photo_ok)+"</td><td>"+n(r.phones)+"</td><td>"+n(r.bumps)+"</td><td>"+n(r.prices)+"</td><td>"+n(r.archived)+"</td></tr>";
  });`);

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
const KRISHA_ON = process.env.KRISHA_WATCH !== "0" && !!(TG_TOKEN && TG_ADMINS.length);
const KRISHA_EVERY_H = Number(process.env.KRISHA_INTERVAL_H || 4);
const KRISHA_MIN_DISCOUNT = Number(process.env.KRISHA_MIN_DISCOUNT || 12);
// 80 was a hedge against the read failures; with retries in place a run reads
// every listing it tries, so the warm-up can finish in a couple of cycles.
const KRISHA_DETAILS_PER_RUN = Number(process.env.KRISHA_DETAILS_PER_RUN || 400);
const KRISHA_PACE_MS = Number(process.env.KRISHA_PACE_MS || 2500); // gentler than local: the datacenter IP gets dropped more
// Готовая сессия Крыши, которую кладёт владелец аккаунта: без неё телефон
// продавца недоступен, потому что своего входа у сервиса нет — логин живёт на
// id.kolesa.kz за проверкой «подтвердите, что вы человек».
const KRISHA_COOKIE = process.env.KRISHA_COOKIE || "";
// Ключ для скрипта, который сохраняет телефоны с Крыши. Не задан — ручка
// закрыта совсем: открытый адрес, куда любой подставит чужой номер на нашей
// же странице, хуже, чем отсутствие телефонов.
const KRISHA_PHONE_KEY = process.env.KRISHA_PHONE_KEY || "";
// Отдельный ключ для внешнего планировщика. Не задан — принимаем тот же, что у
// скрипта: заводить вторую переменную ради одного джоба необязательно.
const KRISHA_JOB_KEY = process.env.KRISHA_JOB_KEY || "";
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
// Снимки карточек, база квартир и телефоны хозяев переехали в SQL: файл на
// диске App Service не имеет резервных копий, а телефон хозяина — персональные
// данные, которые придётся уметь удалять по требованию.
//
// Небольшой кеш карточек в памяти: страницу /kv/ открывают из поста, и ходить
// в базу на каждый просмотр незачем.
const cardCache = new Map();
async function loadCard(id) {
  if (cardCache.has(id)) return cardCache.get(id);
  let c = null;
  try { c = await db.card(id); } catch { /* база недоступна — покажем «не найдено» */ }
  if (c) {
    try { c.phones = await db.flatPhones(id); } catch { /* без телефона страница всё равно полезна */ }
    if (cardCache.size > 300) cardCache.clear();
    cardCache.set(id, c);
  }
  return c;
}

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

// Подборка «Срочно, торг» за сегодня. Отдельная от сторожа задача: у сторожа
// свой корпус и свои критерии, а здесь важна одна вещь — объявление появилось
// сегодня и продавец сам пометил его «срочно». Обход занимает минуты, дольше
// чем живёт HTTP-запрос, поэтому запуск асинхронный, а результат забирают
// повторным GET.
let KU = { running: false, startedAt: null, city: null, progress: null, lastRun: null, result: null };

async function runKrishaUrgent(opts) {
  const U = require("./scripts/krisha-urgent.js");
  const o = opts || {};
  KU.running = true;
  KU.startedAt = new Date().toISOString();
  KU.city = require("./scripts/krisha-urgent.js").cleanCity(o.city);
  KU.progress = "обход поиска";
  try {
    // Рубрика «что появилось за сутки»: метка плюс дата публикации, без оценки
    // цены. Дату берём не из карточек, а по границе id — одиннадцать запросов
    // вместо трёхсот, потому что id при продлении не меняется и растёт со
    // временем.
    if (o.mode === "fresh") {
      const f = await U.fresh({
        city: o.city,
        pages: o.pages || 220,
        urgentOnly: o.urgentOnly !== false,
        shortlist: o.shortlist || 30,
        pace: KRISHA_PACE_MS,
        log: (m) => { KU.progress = m; },
      });
      // Последний фильтр — цена, по оценке самой Крыши: один запрос на
      // квартиру, а квартир после отбора десятка два.
      KU.progress = "оценка цены";
      // min=off — публиковать всё сегодняшнее со «срочно», процент только
      // подписывать. Число — отсекать по нему.
      const min = o.min === null ? null : (o.min == null ? 8 : o.min);
      const good = f.rows.length
        ? await U.cheaper(f.rows, { min: min, pace: KRISHA_PACE_MS, log: (m) => { KU.progress = m; } })
        : [];
      // База: короткая запись по каждой сегодняшней квартире от хозяина, а не
      // только по опубликованным. Ценность базы — покрытие: спросят про
      // квартиру, которой в ней нет, и отвечать будет нечем.
      let based = 0;
      if (o.base) {
        const K = require("./scripts/krisha-lib.js");
        const Base = require("./scripts/krisha-base.js");
        const Card = require("./scripts/krisha-card.js");
        const batch = [];
        const missed = [];
        parsedNow.clear();
        // Сначала догоняем то, что не отдалось в прошлые прогоны: в
        // «сегодняшних» эти квартиры больше не появятся, они уже вчерашние.
        const behind = (await db.pendingFlats(f.city, 60)).map((id) => ({ id: id, catchUp: true }));
        // То, что уже в базе, не перечитываем: за сутки прогон может пройти
        // дважды, и второй раз это те же полторы сотни карточек впустую.
        const todays = f.fresh24 || [];
        const have = await db.knownIds(todays.map((c) => c.id)).catch(() => new Set());
        const news = todays.filter((c) => !have.has(String(c.id)));
        if (have.size) console.log("[krisha] уже в базе: " + have.size + ", читаем " + news.length);
        const list = behind.concat(news);
        for (let i = 0; i < list.length; i++) {
          const c = list[i];
          KU.progress = "база: " + (i + 1) + " из " + list.length +
            (behind.length ? " (догоняем " + behind.length + ")" : "");
          try {
            const html = await K.fetchText("https://krisha.kz/a/show/" + c.id, 4, 12000);
            const detail = K.parseDetail(html);
            const card = Card.parse(html, c.id);
            // Разобранное придержим: часть этих же квартир через несколько
            // минут уйдёт в канал, и читать их страницы второй раз незачем.
            parsedNow.set(String(c.id), { card: card, detail: detail });
            // У догоняемых нет карточки из выдачи, поэтому комнаты и площадь
            // достаём из заголовка объявления.
            const t = card.title || "";
            // Координаты дома, слаги адреса и вердикт Крыши о продавце лежат
            // в разобранной странице: подмешиваем её к карточке из выдачи,
            // иначе record() их не увидит и самый сильный признак опознания
            // пропадёт.
            const base = Object.assign({}, card, c.catchUp ? {
              id: c.id,
              rooms: card.rooms || Number((t.match(/(\d+)-комнатная/) || [])[1]) || null,
              area: card.square ||
                Number(String((t.match(/([\d.,]+)\s*м²/) || [])[1] || "").replace(",", ".")) || null,
              district: K.districtOf(Base.fromShort(card.short, "Город") || t),
              price: card.price || null,
              addr: card.addressTitle || null,
            } : c);
            // Страница объявления уже прочитана, значит полный список снимков
            // у нас на руках — забираем все, а не только первый. Объявление
            // однажды снимут, и показать квартиру покупателю будет нечем.
            // Размер берём средний: полноразмерные нужны только там, где их
            // разглядывают, то есть у опубликованных квартир.
            const shots = card.photos || [];
            let ph1 = shots[0] ? shots[0].big : null;
            if (shots.length && blob.ready()) {
              await Promise.all(shots.map(async (p, n) => {
                try {
                  const u = await blob.copyFrom(p.big, "flat/" + c.id + "/" + (n + 1) + ".jpg");
                  if (n === 0) ph1 = u;
                } catch { /* останется адрес Крыши */ }
              }));
            }
            batch.push(Base.record(base, detail, {
              city: f.city, title: card.title, short: card.short, params: card.params,
              photos: shots.length,
              ph1: ph1,
              photoSrc: shots[0] ? shots[0].big : null,
            }));
            // Страница уже прочитана — сохраняем и карточку. Раньше её здесь
            // выбрасывали, и дочитывание потом открывало ту же страницу второй
            // раз просто чтобы записать то, что у нас в руках уже было.
            try {
              card.addr = card.addr || c.addr;
              await db.saveCard(c.id, card);
            } catch { /* запись в базу подождёт, обход важнее */ }
          } catch { missed.push(c.id); }
          await new Promise((r) => setTimeout(r, KRISHA_PACE_MS));
        }
        based = await db.saveFlats(batch);
        await db.clearPending(batch.map((r) => r.id));
        if (missed.length) await db.markPending(missed, f.city);
        KU.missedBase = missed.length;

        // Отчёт после каждого сбора, а не один общий в конце: города обходятся
        // по очереди и подолгу, и знать, чем кончился каждый, полезнее, чем
        // получить итог через сорок минут.
        const st = await db.krishaStats().catch(() => null);
        const when = new Date(f.today + "T00:00:00Z")
          .toLocaleDateString("ru-RU", { timeZone: "UTC", day: "numeric", month: "long" });
        const lines = [
          "🏘 <b>Крыша · " + f.cityName + " · " + when + "</b>",
          "",
          "Поднято за сутки: " + f.corpus + ", из них опубликовано сегодня: <b>" + f.createdToday + "</b>",
          "В базу легло: <b>" + based + "</b>" + (missed.length ? ", не отдали: " + missed.length : "") +
            (behind.length ? " (в том числе догнали прошлые: " + behind.length + ")" : ""),
          have.size ? "Уже были в базе: " + have.size + ", их не перечитывали" : null,
        ];
        if (st) {
          lines.push("", "Всего в базе <b>" + st.flats + "</b>, с телефоном " + st.with_phone +
            (st.pending ? ", ждут досъёмки " + st.pending : ""));
        }
        await notifyTelegram(lines.filter(Boolean).join("\n"));
      }

      const rows = good.slice(0, o.n || 12);

      // Снимок каждой опубликованной квартиры: фотографии, описание хозяина,
      // характеристики. Телефон — только если владелец аккаунта положил свою
      // сессию в KRISHA_COOKIE.
      const Card = require("./scripts/krisha-card.js");
      const KL = require("./scripts/krisha-lib.js");
      const BaseRec = require("./scripts/krisha-base.js");
      for (let i = 0; i < rows.length; i++) {
        const c = rows[i];
        KU.progress = "снимок карточки " + (i + 1) + " из " + rows.length;
        try {
          // Эту страницу почти наверняка уже читал проход по базе — берём
          // разобранное из памяти, чтобы не ходить к Крыше второй раз.
          let got = parsedNow.get(String(c.id));
          if (!got) {
            const html = await KL.fetchText("https://krisha.kz/a/show/" + c.id, 3, 15000);
            got = { card: Card.parse(html, c.id), detail: KL.parseDetail(html) };
          }
          const card = got.card;

          // Средние снимки проход по базе уже сложил в flat/<id>/<n>.jpg —
          // второй копии под другим именем не нужно. Здесь добираем только
          // полноразмерные: их разглядывают в просмотрщике.
          if (blob.ready()) {
            KU.progress = "фото " + (i + 1) + " из " + rows.length;
            await Promise.all((card.photos || []).map(async (p, n) => {
              try { p.big = await blob.copyFrom(p.big, "flat/" + c.id + "/" + (n + 1) + ".jpg"); } catch { /* останется чужая */ }
              try { p.full = await blob.copyFrom(p.full, "kv/" + c.id + "/" + (n + 1) + "-full.jpg"); } catch { /* останется чужая */ }
            }));
          }
          // Опубликованная квартира должна и в базе быть: иначе телефон,
          // который вы по ней пройдёте, повиснет без объявления — не найдётся
          // ни поиском, ни очередью на досъёмку.
          try {
            await db.saveFlat(BaseRec.record(Object.assign({}, card, c), got.detail, {
              city: f.city, title: card.title, short: card.short, params: card.params,
              photos: (card.photos || []).length,
              ph1: card.photos && card.photos[0] ? card.photos[0].big : null,
            }));
          } catch { /* база подождёт, снимок важнее */ }
          card.addr = card.addr || c.addr;
          card.kzDiscount = c.kzDiscount == null ? null : c.kzDiscount;
          if (KRISHA_COOKIE) {
            try {
              const ph = await Card.fetchPhones(c.id, KRISHA_COOKIE);
              if (ph && ph.phones && ph.phones.length) await db.saveFlatPhones(c.id, ph.phones, "cookie");
              else if (ph && ph.error) card.phoneError = ph.error;
            } catch { /* без телефона страница всё равно полезна */ }
          }
          await db.saveCard(c.id, card);
          cardCache.delete(String(c.id));
          c.hasCard = true;
        } catch { /* не сняли — ссылка уйдёт прямо на Крышу */ }
        await new Promise((r) => setTimeout(r, KRISHA_PACE_MS));
      }

      // Рубрика «Квартиры ниже рынка» больше не нужна — сбор в базу и всё
      // остальное (карточки, фотографии, телефоны) идёт как прежде, просто
      // в канал больше ничего не уходит. Заголовок у postFresh один и тот же
      // что для urgentOnly=true, что для false — второго живого варианта у
      // этой рубрики нет, поэтому весь вызов sendTelegram здесь выключен.
      const KRISHA_POST_BELOW_MARKET = false;
      let tg = null;
      if (KRISHA_POST_BELOW_MARKET && o.send && rows.length && KW.channel) {
        tg = await sendTelegram(KW.channel, U.postFresh(rows, f.today, f.city, CANONICAL));
      }
      KU.result = {
        mode: "fresh",
        date: f.today, city: f.city, cityName: f.cityName,
        pages: f.pages, bumpedToday: f.corpus, urgentToday: f.urgentTotal,
        urgentOnly: f.urgentOnly,
        boundaryId: f.boundaryId, boundaryReads: f.boundaryReads,
        inBase: based || undefined,
        missedBase: KU.missedBase || undefined,
        createdToday: f.createdToday,
        newToday: f.rows.length,
        cheaperThanSimilar: good.length,
        minDiscount: min,
        published: rows.length,
        sent: !!(tg && tg.ok),
        telegram: tg && tg.ok ? undefined : tg,
        items: rows.map((c) => ({
          id: c.id, price: c.price, ppm: c.ppm, area: c.area, rooms: c.rooms,
          addr: c.addr,
          kzDiscount: c.kzDiscount == null ? null : c.kzDiscount,
          kzSimilarLocal: c.kzSimilarLocal || null,
          url: "https://krisha.kz/a/show/" + c.id,
        })),
      };
      KU.running = false;
      KU.progress = null;
      KU.lastRun = new Date().toISOString();
      return KU.result;
    }
    const r = await U.collect({
      city: o.city,
      pages: o.pages || 220,
      shortlist: o.shortlist || 30,
      pace: KRISHA_PACE_MS,
      log: (m) => { KU.progress = m; },
    });
    const top = U.pick(r.rows, { n: o.n || 8, min: o.min, max: o.max, maxAge: o.maxAge });
    KU.progress = "сверка с оценкой Крыши";
    const rows = top.length ? await U.verify(top, o.gap == null ? 20 : o.gap, KRISHA_PACE_MS) : [];
    let telegram = null;
    if (o.send && rows.length && KW.channel) telegram = await sendTelegram(KW.channel, U.post(rows, r.today, r.city));
    KU.result = {
      date: r.today,
      city: r.city,
      cityName: r.cityName,
      pages: r.pages,
      bumpedToday: r.corpus,
      urgentSeen: r.urgentSeen,
      detailsRead: r.read,
      urgentToday: r.urgentTotal,
      scored: r.urgentScored,
      createdToday: r.freshToday,
      published: rows.length,
      sent: !!(telegram && telegram.ok),
      telegram: telegram && telegram.ok ? undefined : telegram,
      items: rows.map((c) => ({
        id: c.id, price: c.price, ppm: c.ppm, area: c.area, rooms: c.rooms,
        addr: c.addr, discount: c.discount, expected: c.expected || null,
        ageDays: c.ageDays == null ? null : c.ageDays,
        kzDiscount: c.kzDiscount == null ? null : c.kzDiscount,
        url: "https://krisha.kz/a/show/" + c.id,
      })),
      skipped: r.rows.filter((c) => c.skipped).map((c) => ({ id: c.id, why: c.skipped })),
    };
  } catch (e) {
    KU.result = { error: String(e && e.message).slice(0, 200) };
  }
  KU.running = false;
  KU.progress = null;
  KU.lastRun = new Date().toISOString();
  return KU.result;
}

// Ежесуточный сбор: пройти города по очереди и сложить новые объявления от
// хозяев в базу. Телефоны здесь не собираются — их отдают только после капчи,
// которую проходит человек.
//
// Своего планировщика тут нет и не нужно: джоб живёт в отдельном приложении на
// Hangfire и дёргает /api/krisha/collect. Отсюда и устройство ручки — она
// отвечает сразу, а работает в фоне: обход двух городов идёт около сорока
// минут, столько ни один вызов по HTTP не проживёт.
const KRISHA_CITIES = String(process.env.KRISHA_CITIES || "almaty,astana")
  .split(/[^a-z-]+/i).filter(Boolean);
let baseRunning = false;

// Сбор идёт раз в сутки, и расписание живёт снаружи. Если внешний планировщик
// настроят на «каждые два часа» — а это уже случилось, — двенадцать обходов в
// сутки подведут нас к той нагрузке, после которой Крыша перестала отвечать.
// Поэтому город, собранный недавно, пропускаем; force=1 снимает ограничение.
const KRISHA_MIN_GAP_H = Number(process.env.KRISHA_MIN_GAP_H || 6);

async function runKrishaDaily(cities, opts) {
  const o = opts || {};
  if (baseRunning) return { skipped: "уже идёт" };
  baseRunning = true;
  let list = (cities && cities.length ? cities : KRISHA_CITIES);
  if (!o.force) {
    KW.lastBaseRun = KW.lastBaseRun || {};
    const fresh = [];
    const skipped = [];
    for (const c of list) {
      const at = Date.parse(KW.lastBaseRun[c] || 0);
      if (at && Date.now() - at < KRISHA_MIN_GAP_H * 3600e3) skipped.push(c); else fresh.push(c);
    }
    if (skipped.length) console.log("[krisha] пропускаем, собирали недавно: " + skipped.join(", "));
    list = fresh;
  }
  if (!list.length) { baseRunning = false; return { skipped: "собирали меньше " + KRISHA_MIN_GAP_H + " ч назад" }; }
  const done = [];
  try {
    for (const city of list) {
      const r = await runKrishaUrgent({ mode: "fresh", base: true, send: false, city: city, urgentOnly: false });
      done.push(r || {});
      KW.lastBaseRun = KW.lastBaseRun || {};
      KW.lastBaseRun[city] = new Date().toISOString();
      saveKrisha();
      // Пауза между городами: два обхода подряд — это шестьсот запросов в час.
      await new Promise((r2) => setTimeout(r2, 60000));
    }
  } finally {
    baseRunning = false;
  }

  // Общего письма в конце нет: каждый город отчитался сам, сразу как закончил.
  // Сообщаем только о сорвавшихся — их иначе было бы не заметить.
  let added = 0;
  const failed = [];
  for (const r of done) {
    if (!r || r.error) { failed.push((r && r.error) || "прогон сорвался"); continue; }
    added += r.inBase || 0;
  }
  if (failed.length) await notifyTelegram("⚠️ <b>Крыша: сбор сорвался</b>\n" + failed.join("\n"));
  return { cities: list, added: added, runs: done.length, failed: failed.length };
}

// Разбор архива: всё, что сейчас висит на Крыше от хозяев, а не только
// сегодняшнее. Тут нам везёт — в карточке выдачи уже есть площадь с десятыми,
// комнаты, этаж из этажности, район, цена и фотография. То есть весь ключ, по
// которому квартира потом узнаётся в объявлении агента, берётся из самой
// выдачи, и открывать 37 тысяч объявлений не нужно: хватает 1 900 страниц.
//
// Чего в карточке нет: года постройки, типа дома и даты публикации. Их
// дочитываем по требованию — в тот момент, когда квартира кому-то понадобилась.
const KRISHA_BACKFILL_PACE_MS = Number(process.env.KRISHA_BACKFILL_PACE_MS || 4000);

// Сколько часов не трогать Крышу после прогона, который почти ничего не
// принёс. Стучать в закрытую дверь бесполезно, а отказы, похоже, копятся.
const KRISHA_DEEPEN_PAUSE_H = Number(process.env.KRISHA_DEEPEN_PAUSE_H || 6);
// Сколько страниц объявлений читать сразу. Проверено четырьмя прогонами по
// 2000 попыток на живых данных: 50 → 69% успеха, 100 → 50%, 200 → 37%,
// 400 → 23% — чем выше параллельность, тем злее защита Крыши реагирует,
// почти линейно на каждое удвоение. 50 — не предел (меньшее не проверяли),
// но уже лучший результат среди проверенных, и им и живём, пока не найдём
// лучше. Намертво в коде, а не из переменной окружения: на Azure уже стоит
// KRISHA_DEEPEN_CONCURRENCY=20 из прежнего запуска, и переменная окружения
// перекрывала бы этот дефолт. ?concurrency=N в самом запросе по-прежнему
// работает — это для разового теста другого числа, а не постоянная настройка.
const KRISHA_DEEPEN_CONCURRENCY = 50;
let backfillRunning = false;
let photosRunning = false;
let deepenRunning = false;
let scanRunning = false;
let listRunning = false;
// Номера агента для фильтра уведомлений о звонках: {at, set}.
const agentDidsCache = { at: 0, set: null };
// Кэш счётчиков очереди телефонов: ключ «since|deal|prop» -> {at, left, waiting}.
const objphoneCounts = new Map();
let phoneQueueCache = null; // размер очереди для /api/krisha/objphone/count, живёт минуту
const rotateLastAt = new Map(); // порт → когда последний раз меняли его IP (/api/krisha/objphone/rotate)
const objphoneLastBySrc = new Map(); // метка клиента → номера из его предыдущей отправки (фильтр прилипших)
const listDashCache = { at: 0, body: null };
let freshRunning = false;
let matchListRunning = false;
let matchRunning = false;
// Подтверждённые 404 скана: id → когда. Пока курсор стоит у фронтира, каждый
// прогон заново качал бы те же пустые страницы через прокси; здесь их помним
// и в течение KRISHA_SCAN_GAP_TTL_MIN минут считаем 404 без запроса.
const scanGap404 = new Map();
// Одна минута: тело 404 теперь обрывается по заголовкам и стоит 1–2 КБ, а
// у фронтира id, бывший 404 минуту назад, мог только что опубликоваться —
// долгая память здесь откладывала бы его на весь срок.
const KRISHA_SCAN_GAP_TTL_MIN = Number(process.env.KRISHA_SCAN_GAP_TTL_MIN || 1);
// Бюджет прогона: Hangfire зовёт раз в минуту, прогон должен укладываться.
const KRISHA_SCAN_BUDGET_SEC = Number(process.env.KRISHA_SCAN_BUDGET_SEC || 50);
// Столько отказов 468 подряд — и скан меняет IP у входов Asocks (как deepen
// после восьми): refresh порта бесплатный, а серия отказов означает, что
// текущие адреса Крыша уже держит на подозрении.
const KRISHA_SCAN_ROTATE_STREAK = Number(process.env.KRISHA_SCAN_ROTATE_STREAK || 6);
// Выдача перемешивает свежие публикации с платными поднятиями старых
// объявлений. «Свежий» — id не старше этого окна от курсора (100 000 id —
// около шести дней): такие читаем вперёд всех. Старые поднятия — не срочно:
// добираем по KRISHA_SCAN_OLD_PER_RUN в конце прогона, если остался бюджет,
// иначе они бы съедали всю минуту и до обхода по id дело бы не доходило.
const KRISHA_SCAN_RECENT = Number(process.env.KRISHA_SCAN_RECENT || 100000);
const KRISHA_SCAN_OLD_PER_RUN = Number(process.env.KRISHA_SCAN_OLD_PER_RUN || 10);
// Разобранные страницы текущего прогона: тот же объект нужен и проходу по базе,
// и сборке страниц для канала, а страница у Крыши одна.
const parsedNow = new Map();

async function runKrishaBackfill(city, pages, fromPage) {
  if (backfillRunning) return { skipped: "уже идёт" };
  backfillRunning = true;
  const U = require("./scripts/krisha-urgent.js");
  const K = require("./scripts/krisha-lib.js");
  const Base = require("./scripts/krisha-base.js");
  const c = U.cleanCity(city);
  const base = "https://krisha.kz/prodazha/kvartiry/" + c + "/?das[_sys.hasphoto]=1&das[who]=1";
  const start = Math.max(1, Number(fromPage) || (KW.backfill && KW.backfill[c]) || 1);
  const limit = Math.max(1, Math.min(Number(pages) || 300, 600));

  let page = start, seen = 0, saved = 0, total = null, empty = 0, copied = 0;
  try {
    for (; page < start + limit; page++) {
      let html;
      try { html = await K.fetchText(page > 1 ? base + "&page=" + page : base, 3, 15000); }
      catch { empty++; if (empty > 5) break; await K.sleep(KRISHA_BACKFILL_PACE_MS); continue; }
      if (total === null) {
        const m = html.match(/"srchtype":"filter","offset":\d+,"count":(\d+)/);
        if (m) total = Number(m[1]);
      }
      const cards = K.parseCards(html);
      if (!cards.length) break;                      // страницы кончились
      empty = 0;
      seen += cards.length;

      // Фотографии забираем здесь же, не открывая объявлений. Лежат они на
      // отдельном хосте — krisha-photos.kcdn.online, — и наша пауза в четыре
      // секунды нужна выдаче, а не картинкам. Поэтому качаем их пачкой прямо
      // внутрь этой паузы: двадцать снимков успевают до следующей страницы.
      // Исходный адрес запоминаем до копирования: из него берётся папка на CDN,
      // а после подмены на наш адрес её уже не восстановить.
      cards.forEach((x) => { x.photoSrc = x.photo; });
      if (blob.ready()) {
        await Promise.all(cards.map(async (x) => {
          if (!x.photo) return;
          try { x.photo = await blob.copyFrom(x.photo, "base/" + x.id + ".jpg"); }
          catch { /* останется адрес Крыши */ }
        }));
        copied += cards.filter((x) => /blob\.core\.windows\.net/.test(String(x.photo))).length;
      }

      const rows = cards.map((x) => Base.record(x, {
        floor: x.floor || null, floors: x.floors || null,
      }, { city: c, title: x.title, photos: 0, ph1: x.photo || null, photoSrc: x.photoSrc }));
      saved += await db.saveFlats(rows);
      KU.progress = "архив " + c + ": страница " + page + ", собрано " + seen;

      // Отметку о пройденном сохраняем по ходу, а не в конце: прогон могут
      // оборвать выкатом, и терять из-за этого триста страниц незачем.
      if (page % 25 === 0) {
        KW.backfill = KW.backfill || {};
        KW.backfill[c] = page + 1;
        saveKrisha();
      }
      await K.sleep(KRISHA_BACKFILL_PACE_MS);
    }
  } finally {
    backfillRunning = false;
  }

  KW.backfill = KW.backfill || {};
  KW.backfill[c] = page;
  // Город пройден, если обход упёрся в конец, а не в предел по страницам:
  // тогда следующие запуски без города возьмутся за другой город, а не будут
  // раз за разом уходить за последнюю страницу этого.
  if (page < start + limit) {
    KW.backfillDone = KW.backfillDone || {};
    KW.backfillDone[c] = true;
  }
  saveKrisha();

  const st = await db.krishaStats().catch(() => null);
  const done = total ? Math.min(100, Math.round((100 * (page - 1) * 20) / total)) : null;
  await notifyTelegram([
    "📚 <b>Крыша · архив " + c + "</b>",
    "",
    "Страницы " + start + "–" + (page - 1) + ", карточек " + seen + ", записано " + saved,
    copied ? "Фотографий сохранено: " + copied : null,
    total ? "Всего по фильтру " + total.toLocaleString("ru") + (done != null ? " · пройдено ~" + done + "%" : "") : null,
    st ? "\nВ базе " + st.flats + ", с телефоном " + st.with_phone : null,
    "Следующий запуск продолжит со страницы " + page,
  ].filter(Boolean).join("\n"));

  return { city: c, from: start, to: page - 1, seen: seen, saved: saved, copied: copied, total: total, next: page };
}

// Сколько совпадений показываем покупателю. Больше трёх — это уже не ответ, а
// список, в котором он утонет: площадь с этажом обычно указывают на одну
// квартиру, остальные идут от округлённых данных.
const BOT_MATCHES = Number(process.env.KRISHA_BOT_MATCHES || 3);

async function handleTelegramUpdate(u) {
  const bot = require("./scripts/krisha-bot.js");
  const Base = require("./scripts/krisha-base.js");
  const say = (chat, text, extra) => bot.api(TG_TOKEN, "sendMessage", Object.assign(
    { chat_id: chat, text: text, parse_mode: "HTML", disable_web_page_preview: true }, extra || {}));

  // Кто пишет. Проверяем и заводим при каждом обращении — Телеграм не сообщает
  // о новых подписчиках отдельно, так что первое сообщение и есть регистрация.
  const from = (u.callback_query && u.callback_query.from) ||
    ((u.message || u.edited_message || {}).from) || null;
  const fromChat = (u.callback_query && u.callback_query.message && u.callback_query.message.chat
    && u.callback_query.message.chat.id) || ((u.message || u.edited_message || {}).chat || {}).id;
  let fresh = { isNew: false };
  try { fresh = await db.upsertUser(from, fromChat); } catch { /* не мешаем ответу */ }
  const uid = from && from.id ? from.id : null;
  const who = from
    ? [from.first_name, from.last_name, from.username ? "@" + from.username : null].filter(Boolean).join(" ")
    : "без имени";
  if (fresh.isNew) notifyTelegram("👤 <b>Новый пользователь</b>\n" + bot.esc(who) + "\nid " + uid);

  // Нажали «Показать контакты».
  if (u.callback_query) {
    const cq = u.callback_query;
    const chat = cq.message && cq.message.chat && cq.message.chat.id;
    const id = String(cq.data || "").replace(/^c:/, "").replace(/\D/g, "");
    await bot.api(TG_TOKEN, "answerCallbackQuery", { callback_query_id: cq.id });
    if (!id || !chat) return;

    let phones = [];
    try { phones = await db.flatPhones(id); } catch { /* база ответит в другой раз */ }
    db.logBotRequest({ userId: uid, kind: "contact", flatId: id, found: phones.length > 0,
      matches: phones.length }).catch(() => {});

    if (phones.length) {
      await say(chat, "📞 <b>Контакты хозяина</b>\n\n" +
        phones.map((p) => "+" + p).join("\n") +
        "\n\nСкажите, что нашли объявление на Крыше — так разговор начнётся понятнее.");
    } else {
      await say(chat, "Телефон этой квартиры мы ещё не открывали. Мы запросим его и вернёмся к вам.\n\n" +
        '<a href="https://krisha.kz/a/show/' + id + '">Объявление на Крыше</a>');
    }
    // Заявку показываем себе всегда: даже когда телефон отдан, полезно знать,
    // кто и что спрашивал.
    notifyTelegram("🔔 <b>Запрос контактов</b>\n" + bot.esc(who) +
      "\nКвартира: " + CANONICAL + "/kv/" + id +
      "\nТелефон " + (phones.length ? "отдан: +" + phones[0] : "у нас не собран"));
    return;
  }

  const msg = u.message || u.edited_message;
  if (!msg || !msg.chat) return;
  const chat = msg.chat.id;
  const text = String(msg.text || msg.caption || "");

  if (/^\/start|^\/help/.test(text)) {
    await say(chat, "Пришлите ссылку на объявление с Крыши — найдём то же самое от хозяина, " +
      "без посредника, и покажем его контакты.\n\nСсылка выглядит так: krisha.kz/a/show/1015591221");
    return;
  }

  const id = bot.idFromText(text);
  if (!id) {
    await say(chat, "Пришлите ссылку на объявление с Крыши — например krisha.kz/a/show/1015591221.");
    return;
  }

  await say(chat, "Смотрю объявление…");

  // Сначала проверяем себя: база собрана по фильтру «от хозяев», поэтому если
  // присланный номер в ней есть, искать похожие незачем — это объявление и так
  // без посредника, и контакты нужны именно по нему.
  let mine = null;
  try { mine = await db.flat(id); } catch { /* спросим Крышу как обычно */ }
  if (mine) {
    const f = flatForBot(mine);
    const cap = "✅ <b>Это объявление уже от хозяина</b>, без посредника.\n\n" + bot.caption(f, CANONICAL);
    db.logBotRequest({ userId: uid, kind: "search", krishaId: id, found: true, matches: 1,
      note: "сама ссылка от хозяина" }).catch(() => {});
    await sendFlat(chat, mine, cap);
    notifyTelegram("🔍 <b>Прислали ссылку хозяина</b>\n" + bot.esc(who) +
      "\n" + CANONICAL + "/kv/" + id);
    return;
  }

  let q;
  try {
    q = await Base.queryFromUrl("https://krisha.kz/a/show/" + id);
  } catch {
    await say(chat, "Не смог открыть это объявление. Возможно, его уже снял продавец.");
    db.logBotRequest({ userId: uid, kind: "search", krishaId: id, found: false, matches: 0,
      note: "объявление не открылось" }).catch(() => {});
    return;
  }

  // Параметры одни находят не ту квартиру чаще, чем ту: на выборке в 200
  // свежих агентских объявлений из 16 найденных по параметрам фото
  // подтвердило только 2 — остальные оказались соседними квартирами того же
  // дома с теми же метрами и этажом. Поэтому берём пул шире (параметры сами
  // не обязаны быть точными — их дело сузить дом), а показываем покупателю
  // только тех, кого фото подтвердило как ту же самую квартиру.
  let hits = [];
  try { hits = await db.findFlats(q, 12); } catch { /* покажем пустой ответ */ }
  // Само присланное объявление в ответе не нужно — покупатель его и так видел.
  hits = hits.filter((h) => String(h.id) !== String(id));

  const asked = bot.askedLine(q);
  if (!hits.length) {
    db.logBotRequest({ userId: uid, kind: "search", krishaId: id, found: false, matches: 0,
      note: asked }).catch(() => {});
    await say(chat, "Вы прислали: " + bot.esc(asked) +
      "\n\nТакой квартиры от хозяина у нас пока нет. Мы обновляем базу каждый день — " +
      "пришлите ссылку ещё раз через сутки.");
    notifyTelegram("🔍 <b>Искали, не нашли</b>\n" + bot.esc(who) + "\n" + bot.esc(asked) +
      "\nhttps://krisha.kz/a/show/" + id);
    return;
  }

  const photoNotes = {};
  let confirmed = hits;
  let photoChecked = false;
  if (q.photoUrls && q.photoUrls.length) {
    try {
      const PhotoMatch = require("./scripts/photo-match.js");
      if (PhotoMatch.available()) {
        const candidates = await Promise.all(hits.map(async (h) => ({
          id: String(h.id), photos: await db.candidatePhotoUrls(h.id, h.photo1),
        })));
        const scores = await PhotoMatch.scoreCandidates(q.photoUrls, candidates);
        photoChecked = true;
        for (const h of hits) {
          const s = scores[String(h.id)];
          if (s && s.match && s.confidence >= 0.7) {
            photoNotes[h.id] = "📷 Фото совпадают — это точно та же квартира";
          }
        }
        confirmed = hits.filter((h) => photoNotes[h.id]);
        confirmed.sort((a, b) => b.score - a.score);
      }
    } catch { /* сеть/модель подвела — покажем как есть, без фотоуточнения */ }
  }

  // Фото сработало, но никого не подтвердило — значит совпадение по
  // параметрам было случайным (та же площадь и этаж у другой квартиры дома).
  // Показать его как найденное — значит отправить покупателя звонить не по
  // адресу, поэтому в этом случае отвечаем как при пустом результате.
  if (photoChecked && !confirmed.length) {
    db.logBotRequest({ userId: uid, kind: "search", krishaId: id, found: false, matches: 0,
      note: asked + " (по параметрам " + hits.length + ", фото не подтвердило ни одного)" }).catch(() => {});
    await say(chat, "Вы прислали: " + bot.esc(asked) +
      "\n\nТакой квартиры от хозяина у нас пока нет. Мы обновляем базу каждый день — " +
      "пришлите ссылку ещё раз через сутки.");
    notifyTelegram("🔍 <b>Похожие по параметрам были, фото не подтвердило</b>\n" + bot.esc(who) +
      "\n" + bot.esc(asked) + "\nhttps://krisha.kz/a/show/" + id);
    return;
  }

  db.logBotRequest({ userId: uid, kind: "search", krishaId: id, found: true,
    matches: confirmed.length, note: asked }).catch(() => {});
  await say(chat, "Вы прислали: <b>" + bot.esc(asked) + "</b>\n" +
    "Нашли " + confirmed.length + (confirmed.length === 1 ? " похожую квартиру от хозяина." : " похожих квартиры от хозяина."));

  for (const h of confirmed.slice(0, BOT_MATCHES)) await sendFlat(chat, h, null, photoNotes[h.id]);
}

// Строка базы — в то, что понимает подпись бота.
function flatForBot(h) {
  return {
    id: String(h.id), price: h.price, rooms: h.rooms,
    area: h.area == null ? null : Number(h.area),
    kitchen: h.kitchen == null ? null : Number(h.kitchen),
    floor: h.floor, floors: h.floors, year: h.build_year,
    house: h.house, cond: h.cond, furnished: h.furnished, toilet: h.toilet,
    street: h.street, mkr: h.mkr, district: h.district,
    posted: h.posted_on, photos: h.photos,
  };
}

async function sendFlat(chat, h, caption, photoNote) {
  const bot = require("./scripts/krisha-bot.js");
  const cap = caption || bot.caption(flatForBot(h), CANONICAL, photoNote);
  const markup = bot.contactsButton(String(h.id));
  let sent = { ok: false };
  if (h.photo1) {
    sent = await bot.api(TG_TOKEN, "sendPhoto", {
      chat_id: chat, photo: h.photo1, caption: cap,
      parse_mode: "HTML", reply_markup: markup,
    });
  }
  // Фотография могла не загрузиться у Телеграма — текст всё равно уходит.
  if (!sent.ok) {
    await bot.api(TG_TOKEN, "sendMessage", { chat_id: chat, text: cap, parse_mode: "HTML",
      disable_web_page_preview: true, reply_markup: markup });
  }
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

// Вся эта слежка — один и тот же старый механизм «сравнение с похожими» на
// личном корпусе KW.corpus: тик со «снизили цену»/«дешевле похожих», дайджест,
// «Находка дня» и недельная подборка — все четыре читают его через
// krishaShortlist. Это не то же самое, что «Квартиры ниже рынка» из
// krisha-urgent.js (тот пайплайн живёт в SQL и продолжает работать своим
// путём). Пользователь решил, что сравнение с похожими больше не актуально —
// расписание выключено целиком. Ручной запуск через /api/krisha?run=1 и
// статус остаются рабочими, просто не наступают сами по будильнику.
const KRISHA_WATCH_SCHEDULED = false;

if (KRISHA_ON && KRISHA_WATCH_SCHEDULED) {
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
} else if (KRISHA_ON) {
  console.log("[krisha] watch выключен по расписанию (KRISHA_WATCH_SCHEDULED=false) — сравнение с похожими не актуально");
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
const blob = require("./scripts/azure-blob");
const agentTemplate = require("./scripts/agent-template");
// Инструменты агента ведут на наш сервер. Адрес берём из настройки, а не из
// заголовка Host: заголовок присылает клиент, и подменив его, он подменил бы
// и адрес, по которому ассистент пойдёт за расписанием.
const PUBLIC_URL = (process.env.PUBLIC_URL || "https://reception365.online").replace(/\/+$/, "");

const enrich = require("./scripts/enrich");
const ical = require("./scripts/ical");
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

// Кабинет агента. Агент ведёт чужие клиники: заводит организацию, выдаёт
// номер из пула, заполняет анкету — и только потом передаёт кабинет владельцу.
// Доступ по списку идентификаторов Clerk, а не по общему паролю: пароль на
// всех не отзывается и не показывает, кто именно что сделал.
// На время проверки ассистент отвечает только этим номерам. Пусто — отвечает
// всем, как в бою. Нужно затем, что подключаем живой номер человека: без
// фильтра ассистент про квартиры ответит и жене, и коллеге.
// Номера разделяются запятой: пробелы внутри одного номера — обычное дело,
// и по ним делить нельзя, иначе «+7 705 123 45 67» распадётся на обрывки.
const WA_ONLY_FROM = String(process.env.WA_ONLY_FROM || "")
  .split(/[,;]+/)
  .map((x) => x.replace(/\D/g, ""))
  .filter((x) => x.length >= 8);

function waAllowed(chatId) {
  if (!WA_ONLY_FROM.length) return true;
  const digits = String(chatId || "").replace(/\D/g, "");
  return WA_ONLY_FROM.some((n) => digits.endsWith(n.slice(-10)));
}

// Шлюз WhatsApp: адрес и ключ — настройки сервера, сессии — по клинике.
function waGateway() {
  const url = String(process.env.WA_API_URL || "").replace(/\/+$/, "");
  const key = process.env.WA_API_KEY || "";
  if (!url || !key) throw new Error("gateway_not_configured");
  return { url: url, key: key };
}

async function waApi(pathname, init) {
  const g = waGateway();
  const r = await fetch(g.url + pathname, {
    ...(init || {}),
    headers: { "Content-Type": "application/json", "X-API-Key": g.key, ...((init || {}).headers || {}) },
    signal: AbortSignal.timeout(20000),
  });
  const text = await r.text();
  if (!r.ok) throw new Error("gateway_" + r.status + ": " + text.slice(0, 200));
  try { return text ? JSON.parse(text) : {}; } catch { return {}; }
}

// Подключение номера клиники к переписке. Возвращает код из восьми символов,
// который человек вводит у себя в WhatsApp: «Связанные устройства» ->
// «Связать по номеру телефона». QR не годится — его нужно чем-то сканировать,
// а у клиента часто есть только тот самый телефон.
async function waConnect(clinic, phoneDigits) {
  let session = clinic.wa_session || "";

  if (!session) {
    // Прокси, если задан: WhatsApp смотрит, откуда пришло устройство, и адрес
    // дата-центра в чужой стране — сам по себе повод ограничить аккаунт.
    // Residential-адрес в стране номера этот сигнал снимает.
    const proxy = process.env.WA_PROXY_URL || "";
    const made = await waApi("/api/sessions", {
      method: "POST",
      body: JSON.stringify({
        name: "clinic-" + clinic.id,
        ...(proxy ? { proxyUrl: proxy, proxyType: process.env.WA_PROXY_TYPE || "http" } : {}),
      }),
    });
    session = made.id || made.sessionId || made.session || "";
    if (!session) throw new Error("сессия не создалась");
    await db.setClinicWaSession(clinic.id, session);
  }

  // Старт повторный не вредит: если сессия уже поднята, шлюз ответит отказом,
  // и это не повод прерывать подключение.
  try { await waApi("/api/sessions/" + encodeURIComponent(session) + "/start", { method: "POST" }); }
  catch (e) { console.log("[whatsapp] старт сессии: " + String(e.message).slice(0, 100)); }

  // Кода до готовности движка не будет: до qr_ready шлюз отвечает 409.
  let status = "";
  for (let i = 0; i < 15; i++) {
    const st = await waApi("/api/sessions/" + encodeURIComponent(session));
    status = st.status || st.state || "";
    if (/qr_ready|connected|authenticated/i.test(status)) break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (/connected|authenticated/i.test(status)) {
    return { already: true, session: session, status: status };
  }

  const code = await waApi("/api/sessions/" + encodeURIComponent(session) + "/pairing-code", {
    method: "POST",
    body: JSON.stringify({ phoneNumber: phoneDigits }),
  });

  // Вебхук ставим сразу: подключение без него — это сессия, которая молчит.
  const toolKey = await db.ensureToolKey(clinic.id);
  try {
    // Сначала убираем свои прежние: «Подключить» нажимают не по одному разу,
    // а каждый лишний вебхук — это ещё одна доставка того же сообщения и ещё
    // один ответ гостю. Плюс старый мог остаться без нынешнего фильтра.
    const had = await waApi("/api/sessions/" + encodeURIComponent(session) + "/webhooks");
    for (const h of (Array.isArray(had) ? had : had.data || [])) {
      if (!String(h.url || "").startsWith(PUBLIC_URL + "/api/whatsapp/inbound")) continue;
      await waApi("/api/sessions/" + encodeURIComponent(session) + "/webhooks/" + h.id,
        { method: "DELETE" });
    }
  } catch (e) {
    console.log("[whatsapp] старые вебхуки не убрались: " + String(e.message).slice(0, 120));
  }
  try {
    await waApi("/api/sessions/" + encodeURIComponent(session) + "/webhooks", {
      method: "POST",
      body: JSON.stringify({
        url: PUBLIC_URL + "/api/whatsapp/inbound?k=" + encodeURIComponent(toolKey),
        events: ["message.received"],
        // Фильтр ставим и здесь: тогда чужие сообщения не покидают шлюз и до
        // нашего сервера не доходят вовсе — это и надёжнее, и честнее.
        ...(WA_ONLY_FROM.length ? {
          filters: {
            conditions: [{
              field: "sender", operator: "is",
              value: WA_ONLY_FROM.map((n) => n + "@c.us"),
            }],
          },
        } : {}),
      }),
    });
  } catch (e) {
    console.log("[whatsapp] вебхук не встал: " + String(e.message).slice(0, 140));
  }

  return {
    already: false,
    session: session,
    status: status,
    code: code.pairingCode || code.code || "",
  };
}

// Переписка в WhatsApp. Хранение историй — в памяти: чтобы ответ был связным,
// хватает последних реплик, а держать чужую переписку дольше незачем.
const WA_CHATS = new Map(); // chatId -> [{from, text}]

function waRemember(chatId, from, text) {
  const list = WA_CHATS.get(chatId) || [];
  list.push({ from, text });
  if (list.length > 10) list.splice(0, list.length - 10);
  WA_CHATS.set(chatId, list);
  // Переписки живут не вечно: раз в сутки самые старые уходят.
  if (WA_CHATS.size > 500) WA_CHATS.delete(WA_CHATS.keys().next().value);
}

// У разных движков шлюза поля называются по-разному, поэтому достаём по
// нескольким именам: неверная догадка выглядела бы как молчание, а не ошибка.
function waPick(obj, names) {
  for (const n of names) {
    let v = obj;
    for (const part of n.split(".")) v = v && typeof v === "object" ? v[part] : undefined;
    if (typeof v === "string" && v) return v;
  }
  return "";
}

function waParse(payload) {
  const d = payload && payload.data ? payload.data : payload || {};
  const m = d.message && typeof d.message === "object" ? d.message
    : d.msg && typeof d.msg === "object" ? d.msg : d;
  const chatId = waPick(m, ["chatId", "from", "chat.id", "key.remoteJid", "chat_id"]);
  return {
    event: waPick(payload || {}, ["event", "type"]),
    chatId: chatId,
    text: waPick(m, ["body", "text", "message", "content", "caption"]),
    fromMe: !!(m.fromMe || m.from_me || (m.key && m.key.fromMe)),
    isGroup: /\ng\.us$/.test(chatId),
  };
}

// Ответ строим по анкете арендатора: та же анкета, что отвечает по телефону.
async function waReply(clinic, text, history) {
  let profile = {};
  try { profile = JSON.parse(clinic.profile_json || "{}"); } catch {}

  // Занятость подтягиваем прямо в подсказку: у посуточной аренды весь смысл
  // переписки в том, свободно или нет, и лазить за этим в календарь руками —
  // ровно та работа, которую мы забираем.
  let live = "";
  if (profile.ical) {
    try {
      const data = await ical.availability(profile.ical, "сегодня");
      live = "\n\nЗАНЯТОСТЬ ИЗ КАЛЕНДАРЯ КЛИЕНТА (свободных ночей подряд от сегодня):\n" +
        JSON.stringify(data).slice(0, 1500);
    } catch (e) {
      console.log("[ical] переписка: " + String(e.message).slice(0, 80));
    }
  } else if (profile.book_read_url) {
    try {
      const u = await enrich.assertPublicUrl(profile.book_read_url);
      const r = await fetch(u, { signal: AbortSignal.timeout(6000) });
      if (r.ok) live = "\n\nСВОБОДНО СЕЙЧАС (из системы бронирования):\n" + (await r.text()).slice(0, 1500);
    } catch (e) {
      console.log("[whatsapp] календарь не ответил: " + String(e.message).slice(0, 80));
    }
  }

  // Без сегодняшней даты «завтра» и «на выходные» превращаются в переспрос,
  // а это половина сообщений в посуточной аренде. Время алматинское: клиент,
  // квартиры и гости живут в нём, а сервер — в UTC.
  const now = new Date(Date.now() + 5 * 3600e3);
  const DAYS = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
  const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля",
    "августа", "сентября", "октября", "ноября", "декабря"];
  const NL2 = String.fromCharCode(10);
  const today = NL2 + NL2 + "СЕГОДНЯ: " + DAYS[now.getUTCDay()] + ", " + now.getUTCDate() + " " +
    MONTHS[now.getUTCMonth()] + " " + now.getUTCFullYear() + ", " +
    String(now.getUTCHours()).padStart(2, "0") + ":" + String(now.getUTCMinutes()).padStart(2, "0") +
    " по Алматы." + NL2 +
    "Считай от неё «сегодня», «завтра», «на выходные», «через неделю» " +
    "и не переспрашивай про них — человек ждёт, что ты знаешь число. " +
    "Если гость назвал срок в сутках, посчитай даты заезда и выезда сам и назови их.";

  const system = agentTemplate.buildPromptFor(profile) + live + today + "\n\n" +
    "КАНАЛ: ПЕРЕПИСКА В WHATSAPP\n" +
    "Ты переписываешься с телефона, как обычный человек. Не как служба " +
    "поддержки и не как бот.\n\n" +
    "КАК ПИСАТЬ\n" +
    "Коротко. Одно сообщение — одна мысль, одна-две строки.\n" +
    "Если мыслей несколько, раздели их пустой строкой: это уйдёт отдельными " +
    "сообщениями, как и пишут люди.\n" +
    "Максимум три сообщения за раз.\n" +
    "Никакой разметки: ни звёздочек, ни списков с цифрами, ни заголовков.\n" +
    "Никаких длинных тире. На телефоне их не набирают — пиши обычный дефис " +
    "или просто запятую.\n" +
    "Без канцелярита: не «подскажите, пожалуйста», а «на какие числа?». " +
    "Не «предусмотрены», не «уточните информацию», не «вам будет " +
    "предоставлено».\n" +
    "Здоровайся один раз, в первом сообщении переписки.\n" +
    "Не пиши «разговор записывается» — это не звонок.\n\n" +
    "ЧЕГО НЕ ДЕЛАТЬ\n" +
    "Не выдумывай цены и свободные даты: чего нет выше — того не знаешь.\n" +
    "Не перечисляй всё подряд. Если вариантов три, назови их в двух строках, " +
    "без нумерованного списка.\n" +
    "Правила заезда и депозит говори тогда, когда о них спросили или когда " +
    "человек уже выбрал квартиру, а не в первом же ответе.\n" +
    "Если человек готов бронировать, спроси имя и скажи, что подтвердим.\n" +
    "Отвечай на языке собеседника.";

  const past = (Array.isArray(history) ? history : [])
    .slice(-8)
    .map((m) => (m && m.from === "clinic" ? "Мы: " : "Человек: ") +
      String((m && m.text) || "").slice(0, 500))
    .join("\n");
  const user = (past ? "Переписка до этого:\n" + past + "\n\n" : "") + "Новое сообщение: " + text;
  return (await enrich.askText(system, user)).slice(0, 1500);
}

// Отправка обратно через шлюз. Его адрес и ключ — настройки сервера, а не
// клиники: шлюз один на всех, а арендатора мы узнаём по ключу в адресе вебхука.
// Отметить прочитанным перед ответом: человек сначала читает, потом пишет.
// Не критично, поэтому молча переживаем отказ.
async function waRead(session, chatId) {
  try {
    await waApi("/api/sessions/" + encodeURIComponent(session) + "/chats/read", {
      method: "POST",
      body: JSON.stringify({ chatId: chatId }),
    });
  } catch (e) {
    console.log("[whatsapp] прочитанным не отметилось: " + String(e.message).slice(0, 80));
  }
}

// Чистим следы машинного текста. Длинное тире на телефоне не набирают: его
// нет на клавиатуре, и в переписке оно выдаёт генератор вернее любых слов.
function waHumanize(text) {
  return String(text || "")
    .replace(/\u2014|\u2013/g, "-")
    .replace(/\*\*/g, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Человек не отвечает мгновенно и не шлёт простыню одним куском. Пауза перед
// каждым сообщением примерно как время набора: чем длиннее, тем дольше.
function waPause(text) {
  const ms = 900 + String(text).length * 45 + Math.random() * 700;
  return Math.min(Math.round(ms), 7000);
}

// Сессия у каждой клиники своя: одна на всех означала бы, что ответ уходит
// из чужого WhatsApp. Настройка WA_SESSION остаётся запасной — для первого
// номера, подключённого руками, пока клиник ещё нет.
async function waSend(chatId, text, session) {
  const url = String(process.env.WA_API_URL || "").replace(/\/+$/, "");
  const key = process.env.WA_API_KEY || "";
  session = session || process.env.WA_SESSION || "";
  if (!url || !key || !session) throw new Error("шлюз не настроен");
  const r = await fetch(url + "/api/sessions/" + encodeURIComponent(session) + "/messages/send-text", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": key },
    body: JSON.stringify({ chatId: chatId, text: text }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error("шлюз " + r.status + ": " + (await r.text()).slice(0, 200));
}

// Последние события от АТС Zadarma. Держим в памяти: это диагностика, а не
// данные клиник — переживать перезапуск им незачем.
const ZADARMA_EVENTS = [];

const ADMIN_IDS = (process.env.ADMIN_USER_IDS || "").split(/[^\w-]+/).filter(Boolean);

async function adminContext(req) {
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new Error("no_token");
  const claims = await verifyClerkToken(token);
  // Свой идентификатор возвращаем даже при отказе: первый агент иначе не
  // знает, что вписывать в ADMIN_USER_IDS, и войти не может никогда.
  if (!ADMIN_IDS.length) {
    const e = new Error("admin_not_configured"); e.userId = claims.sub; throw e;
  }
  if (!ADMIN_IDS.includes(claims.sub)) {
    const e = new Error("not_admin"); e.userId = claims.sub; throw e;
  }
  return { userId: claims.sub };
}

// Номер должен звонить агенту своей клиники. Пока этого не сделано, он
// отвечает базовым демо-агентом — то есть чужим голосом и чужим прайсом.
async function bindNumberToAgent(phoneNumberId, agentId) {
  if (!phoneNumberId || !agentId || !process.env.ELEVENLABS_API_KEY) return false;
  try {
    const r = await fetch(
      "https://api.elevenlabs.io/v1/convai/phone-numbers/" + phoneNumberId,
      {
        method: "PATCH",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ agent_id: agentId }),
      }
    );
    if (!r.ok) throw new Error("ElevenLabs " + r.status);
    return true;
  } catch (e) {
    console.log("[номер] не привязался к агенту: " + String(e.message).slice(0, 120));
    return false;
  }
}

// Переносит анкету в агента и ставит агента на номер. Один и тот же путь для
// кабинета клиники и для кабинета агента: разойдись они — у одной из сторон
// «Включить» однажды перестало бы включать.
async function publishClinic(clinicId) {
  const c = await db.clinicById(clinicId);
  if (!c) throw new Error("no_clinic");
  let profile = {};
  try { profile = JSON.parse(c.profile_json || "{}"); } catch {}
  if (!profile.name) throw new Error("profile_empty");

  // Ключ выдаётся один раз: он зашит в адреса инструментов агента.
  const toolKey = await db.ensureToolKey(clinicId);
  const opts = { toolKey: toolKey, baseUrl: PUBLIC_URL };

  let agentId = c.agent_id;
  // Базового агента не трогаем: он общий и обслуживает демо на сайте.
  if (!agentId || agentId === agentTemplate.BASE_AGENT) {
    agentId = await agentTemplate.createAgent(profile, opts);
  } else {
    await agentTemplate.updateAgent(agentId, profile, opts);
  }
  await db.setClinicAgent(clinicId, agentId);
  await bindNumberToAgent(c.phone_number_id, agentId);
  return agentId;
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
// Модель речи размечает свои реплики тегами подачи — [Friendly], [Efficient],
// [Professional]. Вслух они не звучат, но в расшифровку попадают как текст, и
// клиника видит их вперемешку со словами. Убираем только латинские теги в
// начале реплики: русский текст в скобках может быть настоящей речью.
function stripAudioTags(text) {
  return String(text || "")
    .replace(/^(?:\s*\[[A-Za-z][A-Za-z \-]{0,24}\])+\s*/, "")
    .trim();
}

function cleanTranscript(turns) {
  if (!Array.isArray(turns)) return turns;
  return turns.map((t) => Object.assign({}, t, { message: stripAudioTags(t.message) }));
}

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

// Коды стран, которые предлагает форма. Список нужен не для красоты: без него
// через демо-звонок можно набирать платные номера в любой точке мира за наш счёт.
// Порядок важен: длинные коды проверяются первыми, иначе «1» съел бы «1XX».
const DEMO_DIAL_CODES = [
  "998", "996", "995", "994", "993", "992", "971", "420", "380", "375", "358", "351",
  "90", "49", "48", "47", "46", "45", "44", "43", "41", "40", "39", "36", "34", "33",
  "32", "31", "30", "7", "1",
];
function normalizeDemoPhone(raw) {
  const d = String(raw || "").replace(/[^0-9]/g, "");
  if (d.length < 8 || d.length > 15) return null;
  const code = DEMO_DIAL_CODES.find((c) => d.startsWith(c));
  if (!code) return null;
  const rest = d.slice(code.length);
  if (rest.length < 6 || rest.length > 12) return null;
  return "+" + d;
}

function normalizeKzMobile(raw) {
  const d = String(raw || "").replace(/[^0-9]/g, "");
  if (d.length === 11 && (d[0] === "7" || d[0] === "8") && d[1] === "7") return "+7" + d.slice(1);
  if (d.length === 10 && d[0] === "7") return "+7" + d;
  return null;
}

// agentOverride — чтобы клиника из кабинета услышала СВОЕГО ассистента, а не
// общего демонстрационного.
// Казахстанский номер Zadarma. Часть операторов Казахстана отбивает вызовы с
// зарубежного определителя — проверено: один и тот же абонент отказал пяти
// звонкам с номера Twilio и снял трубку на первом же с алматинского. Поэтому
// внутрь страны звоним отсюда, а за границу — по-прежнему через Twilio,
// потому что с казахстанского номера Zadarma наружу звонить не разрешает.
// Пока пусто: транк Zadarma принимает вызов и сам же кладёт трубку через
// четыре секунды, до абонента звонок не доходит. Как только исходящий маршрут
// в АТС заработает, номер вписывается в ELEVENLABS_PHONE_NUMBER_ID_KZ — и
// казахстанские звонки пойдут через Алматы без выкладки кода.
const KZ_PHONE_ID = process.env.ELEVENLABS_PHONE_NUMBER_ID_KZ || "";
const isKzMobile = (e164) => /^\+77\d{9}$/.test(String(e164 || ""));

// Сценарии демо-звонка. «Приём» — агент как настроен, ничего не подменяем.
// Два исходящих играются подменой первой фразы и промпта: так посетитель
// слышит ровно ту работу, которую выбрал, а не рассказ о ней.
const DEMO_SCENARIOS = {
  reminder: {
    ru: {
      first: "Здравствуйте! Это клиника Нариман Дент. Напоминаю: вы записаны " +
             "завтра в три часа дня на чистку. Подскажите, всё в силе?",
      prompt: "Ты администратор стоматологии «Нариман Дент». Звонишь накануне " +
              "приёма, чтобы подтвердить визит. Цель — получить ответ: придёт " +
              "человек или нет. Если придёт — поблагодари и попрощайся. Если не " +
              "может — предложи перенести и спроси, какой день и время удобны, " +
              "затем подтверди перенос. Говори коротко, тремя-четырьмя фразами, " +
              "на языке собеседника. Если спросят, честно скажи, что это " +
              "демонстрационный звонок сервиса Reception365.",
    },
    kk: {
      first: "Сәлеметсіз бе! Бұл «Нариман Дент» клиникасы. Еске саламын: сіз " +
             "ертең сағат үште тазалауға жазылғансыз. Күшінде ме?",
      prompt: "Сен «Нариман Дент» стоматологиясының әкімшісісің. Қабылдау " +
              "алдында визитті растау үшін қоңырау шаласың. Мақсат — адам " +
              "келе ме, жоқ па, соны білу. Келсе — алғыс айтып қоштас. Келе " +
              "алмаса — басқа күнге ауыстыруды ұсын, ыңғайлы күн мен уақытты " +
              "сұра. Қысқа сөйле. Сұраса, бұл Reception365 сервисінің " +
              "демонстрациялық қоңырауы екенін шыншылдықпен айт.",
    },
  },
  upsell: {
    ru: {
      first: "Здравствуйте! Это клиника Нариман Дент. Вы были у нас чуть больше " +
             "полугода назад. Сейчас идёт профилактический осмотр и чистка со " +
             "скидкой — подобрать вам удобное время?",
      prompt: "Ты администратор стоматологии «Нариман Дент». Звонишь пациенту, " +
              "который давно не приходил, и предлагаешь плановый осмотр с " +
              "гигиенической чисткой. Цель — записать на приём. Если человек " +
              "согласен, предложи два конкретных времени на выбор и подтверди " +
              "запись. Если отказывается — не уговаривай, вежливо попрощайся. " +
              "Говори коротко, тремя-четырьмя фразами, на языке собеседника. " +
              "Если спросят, честно скажи, что это демонстрационный звонок " +
              "сервиса Reception365.",
    },
    kk: {
      first: "Сәлеметсіз бе! Бұл «Нариман Дент» клиникасы. Сіз бізде жарты " +
             "жылдан астам уақыт бұрын болғансыз. Қазір жоспарлы тексеру мен " +
             "тазалауға жеңілдік бар — ыңғайлы уақыт таңдайық па?",
      prompt: "Сен «Нариман Дент» стоматологиясының әкімшісісің. Ұзақ уақыт " +
              "келмеген пациентке қоңырау шалып, жоспарлы тексеру мен " +
              "гигиеналық тазалауды ұсынасың. Мақсат — қабылдауға жазу. " +
              "Келіссе, екі нақты уақыт ұсынып, жазуды растa. Бас тартса — " +
              "көндірме, сыпайы қоштас. Қысқа сөйле. Сұраса, бұл Reception365 " +
              "сервисінің демонстрациялық қоңырауы екенін айт.",
    },
  },
};

function demoOverride(scenario, lang) {
  const s = DEMO_SCENARIOS[scenario];
  if (!s) return null;
  const t = s[lang === "kk" ? "kk" : "ru"];
  return {
    conversation_config_override: {
      agent: { first_message: t.first, prompt: { prompt: t.prompt } },
    },
  };
}

async function placeDemoCall(toNumber, agentOverride, scenario, lang) {
  const key = process.env.ELEVENLABS_API_KEY;
  const agentId = agentOverride || process.env.ELEVENLABS_AGENT_ID;
  const viaKz = isKzMobile(toNumber) && KZ_PHONE_ID;
  const phoneId = viaKz ? KZ_PHONE_ID : process.env.ELEVENLABS_PHONE_NUMBER_ID;
  if (!key || !agentId || !phoneId) {
    return { ok: false, reason: "not_configured" };
  }
  const endpoint = viaKz
    ? "https://api.elevenlabs.io/v1/convai/sip-trunk/outbound-call"
    : "https://api.elevenlabs.io/v1/convai/twilio/outbound-call";
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      agent_id: agentId,
      agent_phone_number_id: phoneId,
      to_number: toNumber,
      ...(agentOverride ? {} : (demoOverride(scenario, lang)
        ? { conversation_initiation_client_data: demoOverride(scenario, lang) } : {})),
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
  return { ok: true, id: parsed.conversation_id || null, body: text.slice(0, 400) };
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
      if (!TG_TOKEN || !TG_ADMINS.length) {
        res.writeHead(400, { "Content-Type": MIME[".json"] });
        res.end(JSON.stringify({ error: "нужны переменные TELEGRAM_BOT_TOKEN и BOT_ADMIN_TELEGRAM_IDS (или TELEGRAM_CHAT_ID)" }));
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

    // Сегодняшние «Срочно, торг». run=1 запускает обход, send=1 отправляет
    // готовую подборку в канал; без параметров — что получилось в прошлый раз.
    // mode=fresh — что появилось за сутки, mode=deal (по умолчанию) — что
    // дешевле похожих.
    if (urlPath === "/api/krisha/urgent") {
      const q = parsed.searchParams;
      if (q.get("run") === "1" && !KU.running) {
        runKrishaUrgent({
          city: q.get("city"),
          mode: q.get("mode") === "fresh" ? "fresh" : "deal",
          // urgent=0 — брать всё, что хозяева опубликовали за сутки, а не
          // только помеченное «Срочно, торг».
          urgentOnly: q.get("urgent") !== "0",
          // base=1 — снять короткую запись по каждой сегодняшней квартире от
          // хозяина, а не только по тем, что идут в пост.
          base: q.get("base") === "1",
          send: q.get("send") === "1",
          n: Number(q.get("n") || 8),
          min: q.get("min") === "off" ? null : (q.get("min") == null ? 8 : Number(q.get("min"))),
          max: q.get("max") == null ? 35 : Number(q.get("max")),
          maxAge: q.get("age") == null ? 30 : Number(q.get("age")),
          pages: Number(q.get("pages") || 220),
          gap: q.get("gap") == null ? 20 : Number(q.get("gap")),
        }).catch(() => {});
      }
      res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
      res.end(JSON.stringify({
        running: KU.running, startedAt: KU.startedAt, city: KU.city, progress: KU.progress,
        lastRun: KU.lastRun, channel: KW.channel || null, result: KU.result,
      }, null, 2));
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
            error: TG_TOKEN && TG_ADMINS.length
              ? "выключено переменной KRISHA_WATCH=0"
              : "нужны TELEGRAM_BOT_TOKEN и BOT_ADMIN_TELEGRAM_IDS — слать уведомления некуда",
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
        telegram: TG_TOKEN && TG_ADMINS.length ? "настроен, админов " + TG_ADMINS.length : "не настроен",
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
        telegram: TG_TOKEN ? (TG_ADMINS.length ? "настроен, админов " + TG_ADMINS.length : "нет BOT_ADMIN_TELEGRAM_IDS") : "нет TELEGRAM_BOT_TOKEN",
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
          try {
            return send(200, { ok: true, agent_id: await publishClinic(myClinic) });
          } catch (e) {
            if (e.message === "profile_empty") return send(400, { error: "profile_empty" });
            throw e;
          }
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

    // Инструменты ассистента: во время разговора он спрашивает у нас свободное
    // время и записывает пациента. Мы — посредник, а не сквозной проброс:
    //   · ключ доступа клиники остаётся у нас и не уезжает в ElevenLabs;
    //   · адрес клиники проверяется тем же правилом, что и чтение сайтов, иначе
    //     кабинет становится способом ходить по внутренней сети Azure;
    //   · ответ приводим к короткому виду — модели нужен смысл, а не выгрузка.
    if (urlPath.startsWith("/api/tools/")) {
      (async () => {
        const send = (code, obj) => {
          res.writeHead(code, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
          res.end(JSON.stringify(obj));
        };
        const clinic = await db.clinicByToolKey(parsed.searchParams.get("k"));
        // Ассистенту отвечаем понятным текстом, а не кодом ошибки: он это
        // произнесёт вслух, и «404» в трубке звучит хуже, чем «не знаю».
        const nope = (why) => send(200, { ok: false, message: why });
        if (!clinic) return nope("Расписание недоступно.");

        let profile = {};
        try { profile = JSON.parse(clinic.profile_json || "{}"); } catch {}
        const token = profile.book_token || "";
        const headers = { "Content-Type": "application/json", Accept: "application/json" };
        if (token) headers.Authorization = "Bearer " + token;

        async function callClinic(rawUrl, init) {
          let url;
          try { url = await enrich.assertPublicUrl(rawUrl); }
          catch { throw new Error("bad_url"); }
          const r = await fetch(url, {
            ...init, headers, redirect: "manual", signal: AbortSignal.timeout(8000),
          });
          const text = (await r.text()).slice(0, 4000);
          if (!r.ok) throw new Error("http_" + r.status);
          try { return JSON.parse(text); } catch { return { raw: text }; }
        }

        // Реквизиты предоплаты — тоже сообщением, а не голосом: номер счёта
        // на слух записывают с ошибкой, и перевод уходит чужому человеку.
        if (urlPath === "/api/tools/send-payment") {
          let ask = {};
          try { ask = JSON.parse(await readBody(req)) || {}; } catch {}
          // На исходящем звонке ассистент не знает номер собеседника. Запасной
          // берём из анкеты — иначе он начнёт просить продиктовать номер вслух.
          // Запасной берём не только когда номер пустой: ассистент присылает и
          // «+7», и «неизвестен» — по длине цифр видно, что звонить туда некуда.
          let phone = String(ask.phone || "").replace(/[^0-9]/g, "");
          if (phone.length < 10) phone = String(profile.default_phone || "").replace(/[^0-9]/g, "");
          for (const pair of String(profile.test_redirect || "").split(",")) {
            const [from, to] = pair.split(">").map((x) => String(x).replace(/[^0-9]/g, ""));
            if (from && to && phone === from) phone = to;
          }
          if (phone.length < 10) return nope("Не понял, на какой номер отправить.");
          if (!clinic.wa_session) return nope("WhatsApp у клиники не подключён.");
          const text = String(profile.payment || "").trim();
          if (!text) return nope("Реквизитов нет в анкете.");
          try {
            await waSend(phone + "@c.us", text, clinic.wa_session);
            console.log("[реквизиты] " + clinic.name + " -> " + phone);
            return send(200, { ok: true, message: "Отправил реквизиты в WhatsApp." });
          } catch (e) {
            console.log("[реквизиты] не ушло: " + String(e.message).slice(0, 120));
            return nope("Не получилось отправить реквизиты.");
          }
        }

        // Фото квартиры в WhatsApp прямо во время звонка. Гость просит их почти
        // всегда, и «хозяин пришлёт» — это потерянная бронь: пока хозяин
        // доберётся, гость уже смотрит другую квартиру.
        if (urlPath === "/api/tools/send-photos") {
          let ask = {};
          try { ask = JSON.parse(await readBody(req)) || {}; } catch {}
          // На исходящем звонке ассистент не знает номер собеседника. Запасной
          // берём из анкеты — иначе он начнёт просить продиктовать номер вслух.
          // Запасной берём не только когда номер пустой: ассистент присылает и
          // «+7», и «неизвестен» — по длине цифр видно, что звонить туда некуда.
          let phone = String(ask.phone || "").replace(/[^0-9]/g, "");
          if (phone.length < 10) phone = String(profile.default_phone || "").replace(/[^0-9]/g, "");
          // Проверочная подмена: у пилота номер оператора и номер «гостя» —
          // это один и тот же телефон, сам себе в WhatsApp не напишешь.
          // Формат в анкете: "77029410625>19406025427", через запятую.
          for (const pair of String(profile.test_redirect || "").split(",")) {
            const [from, to] = pair.split(">").map((x) => String(x).replace(/[^0-9]/g, ""));
            if (from && to && phone === from) {
              console.log("[фото] проверочная подмена " + from + " -> " + to);
              phone = to;
            }
          }
          if (phone.length < 10) return nope("Не понял, на какой номер отправить.");
          if (!clinic.wa_session) return nope("WhatsApp у клиники не подключён.");

          // Ссылки лежат в анкете строками «Название — ссылка». Ищем строку
          // про названную квартиру; не нашли — отправляем всё, что есть.
          const lines = String(profile.photos || "").split("\n")
            .map((x) => x.trim()).filter(Boolean);
          if (!lines.length) return nope("Фотографий пока нет.");
          const words = String(ask.apartment || "").toLowerCase()
            .split(/[^a-zа-яё0-9]+/i).filter((w) => w.length > 3);
          const hit = lines.find((l) => words.some((w) => l.toLowerCase().includes(w)));
          const text = hit || lines.join("\n");

          try {
            await waSend(phone + "@c.us", text, clinic.wa_session);
            console.log("[фото] " + clinic.name + " -> " + phone);
            return send(200, { ok: true, message: "Отправил фото в WhatsApp." });
          } catch (e) {
            console.log("[фото] не ушло: " + String(e.message).slice(0, 140));
            return nope("Не получилось отправить, фото пришлёт хозяин.");
          }
        }

        if (urlPath === "/api/tools/slots") {
          // Если клиент дал ссылки на календари — занятость берём оттуда. Это
          // его настоящие брони со всех площадок, а не наша выдумка.
          if (profile.ical) {
            const when = String(parsed.searchParams.get("date") || "").slice(0, 40);
            try {
              const data = await ical.availability(profile.ical, when);
              return send(200, { ok: true, ...data });
            } catch (e) {
              console.log("[ical] клиника " + clinic.id + ": " + String(e.message).slice(0, 120));
              return nope("Календарь сейчас не отвечает — возьмите контакт и перезвоните.");
            }
          }
          if (!profile.book_read_url) {
            return nope("Свободное время я не вижу — предложите перезвонить утром.");
          }
          const date = String(parsed.searchParams.get("date") || "").slice(0, 40);
          const u = profile.book_read_url + (profile.book_read_url.includes("?") ? "&" : "?") +
            "date=" + encodeURIComponent(date);
          try {
            const data = await callClinic(u, { method: "GET" });
            const slots = Array.isArray(data) ? data : (data.slots || data.items || []);
            return send(200, { ok: true, slots: slots.slice(0, 12) });
          } catch (e) {
            console.log("[tools] slots клиника " + clinic.id + ": " + e.message);
            return nope("Расписание сейчас не отвечает — запишите контакт и перезвоните.");
          }
        }

        if (urlPath === "/api/tools/book") {
          if (req.method !== "POST") return send(405, { ok: false });
          if (!profile.book_write_url) {
            return nope("Записать в программу не могу — передайте заявку администратору.");
          }
          let body = {};
          try { body = JSON.parse(await readBody(req)) || {}; } catch {}
          const payload = {
            name: String(body.name || "").slice(0, 120),
            phone: normalizeKzMobile(body.phone) || String(body.phone || "").slice(0, 32),
            service: String(body.service || "").slice(0, 200),
            time: String(body.time || "").slice(0, 120),
            source: "otvet.mobi",
          };
          try {
            const data = await callClinic(profile.book_write_url, {
              method: "POST", body: JSON.stringify(payload),
            });
            return send(200, { ok: true, booked: true, result: data });
          } catch (e) {
            console.log("[tools] book клиника " + clinic.id + ": " + e.message);
            return nope("Записать не получилось — я передам заявку администратору.");
          }
        }

        send(404, { ok: false });
      })().catch((e) => {
        console.log("[tools] " + String(e.message).slice(0, 200));
        res.writeHead(200, { "Content-Type": MIME[".json"] });
        res.end(JSON.stringify({ ok: false, message: "Не получилось проверить расписание." }));
      });
      return;
    }

    // Онбординг до входа. Клиника заполняет анкету, видит, что вышло, и только
    // потом регистрируется — регистрация нужна, чтобы привязать номер, а не
    // чтобы посмотреть.
    // Кабинет агента. Всё, что здесь делается, делается за клинику, которая
    // ещё не завела себе вход: организация, номер, анкета. Поэтому проверка
    // не «состоит ли в организации», как в кабинете клиники, а «в списке ли
    // агентов» — и список задаётся снаружи, в настройках сервера.
    if (urlPath.startsWith("/api/admin/")) {
      (async () => {
        const send = (code, obj) => {
          res.writeHead(code, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
          res.end(JSON.stringify(obj));
        };
        if (!CLERK_PK || !CLERK_SK) return send(503, { error: "clerk_not_configured" });

        let ctx;
        try {
          ctx = await adminContext(req);
        } catch (e) {
          console.log("[admin] отказ: " + String(e.message).slice(0, 120));
          const denied = e.message === "not_admin" || e.message === "admin_not_configured";
          return send(denied ? 403 : 401, { error: e.message, user_id: e.userId || null });
        }
        const body = async () => {
          try { return JSON.parse(await readBody(req)) || {}; } catch { return {}; }
        };

        if (urlPath === "/api/admin/state") {
          const [clinics, numbers] = await Promise.all([db.listClinics(), db.numbersByStatus()]);
          return send(200, {
            clinics, numbers,
            fields: agentTemplate.FIELDS,
            sources: agentTemplate.SOURCES,
            integration: agentTemplate.INTEGRATION,
            enrich_available: enrich.available(),
          });
        }

        // Подключение WhatsApp клиники: код вместо QR.
        if (urlPath === "/api/admin/wa/connect" && req.method === "POST") {
          const b = await body();
          const clinic = await db.clinicById(Number(b.clinic_id));
          if (!clinic) return send(404, { error: "no_clinic" });
          const phone = String(b.phone || "").replace(/\D/g, "");
          if (phone.length < 10 || phone.length > 15) return send(400, { error: "bad_phone" });
          try {
            const r = await waConnect(clinic, phone);
            if (r.code) {
              // Код живёт минуты: пока агент диктует его клиенту, полезно
              // иметь его и в телефоне, а не только на экране кабинета.
              notifyTelegram("\u{1F4AC} <b>Код для WhatsApp</b>\n" + clinic.name +
                ", номер +" + phone + "\n<code>" + r.code + "</code>\n" +
                "Ввести: WhatsApp -> Связанные устройства -> Связать устройство -> " +
                "Связать по номеру телефона");
            }
            return send(200, { ok: true, ...r });
          } catch (e) {
            const m = String(e.message);
            if (m === "gateway_not_configured") return send(503, { error: "gateway_not_configured" });
            console.log("[admin] whatsapp: " + m.slice(0, 200));
            return send(502, { error: "gateway_failed", detail: m.slice(0, 160) });
          }
        }

        if (urlPath === "/api/admin/wa/status") {
          const clinic = await db.clinicById(Number(parsed.searchParams.get("clinic_id")));
          if (!clinic) return send(404, { error: "no_clinic" });
          if (!clinic.wa_session) return send(200, { ok: true, connected: false, status: "нет сессии" });
          try {
            const st = await waApi("/api/sessions/" + encodeURIComponent(clinic.wa_session));
            const status = st.status || st.state || "";
            return send(200, {
              ok: true, session: clinic.wa_session, status: status,
              // «ready» у шлюза и есть «на связи»: движок поднят, номер привязан.
              connected: /connected|authenticated|working|ready/i.test(status),
            });
          } catch (e) {
            if (String(e.message) === "gateway_not_configured") {
              return send(503, { error: "gateway_not_configured" });
            }
            return send(502, { error: "gateway_failed" });
          }
        }

        if (urlPath === "/api/admin/zadarma-events") {
          return send(200, { events: ZADARMA_EVENTS });
        }

        if (urlPath === "/api/admin/clinic" && req.method === "GET") {
          const c = await db.clinicById(Number(parsed.searchParams.get("id")));
          if (!c) return send(404, { error: "no_clinic" });
          let profile = {};
          try { profile = JSON.parse(c.profile_json || "{}"); } catch {}
          return send(200, {
            clinic: {
              id: c.id, name: c.name, org_id: c.org_id, agent_id: c.agent_id,
              public_number: c.public_number, phone_number_id: c.phone_number_id,
            },
            profile: agentTemplate.cleanAll(profile),
          });
        }

        // Новая клиника. Организация в Clerk заводится сразу: без неё клинике
        // некуда будет войти, а переселить её потом — значит переписать
        // владельца у уже накопленных звонков.
        if (urlPath === "/api/admin/clinic" && req.method === "POST") {
          const b = await body();
          const name = String(b.name || "").trim().slice(0, 120);
          if (!name) return send(400, { error: "name_required" });
          const r = await fetch("https://api.clerk.com/v1/organizations", {
            method: "POST",
            headers: { Authorization: "Bearer " + CLERK_SK, "Content-Type": "application/json" },
            body: JSON.stringify({ name: name, created_by: ctx.userId }),
          });
          const j = await r.json();
          if (!r.ok) {
            console.log("[admin] организация не создалась: " + JSON.stringify(j).slice(0, 200));
            return send(502, { error: "org_failed" });
          }
          const clinicId = await db.upsertClinic({ org_id: j.id, name: name });
          await db.saveClinicProfile(clinicId, agentTemplate.cleanAll({ name: name }));
          return send(200, { ok: true, clinic_id: clinicId, org_id: j.id });
        }

        if (urlPath === "/api/admin/profile" && req.method === "POST") {
          const b = await body();
          const c = await db.clinicById(Number(b.clinic_id));
          if (!c) return send(404, { error: "no_clinic" });
          const profile = agentTemplate.cleanAll(b.profile || {});
          if (!profile.name) return send(400, { error: "name_required" });
          await db.saveClinicProfile(c.id, profile);
          return send(200, { ok: true });
        }

        if (urlPath === "/api/admin/publish" && req.method === "POST") {
          const b = await body();
          try {
            return send(200, { ok: true, agent_id: await publishClinic(Number(b.clinic_id)) });
          } catch (e) {
            if (e.message === "profile_empty" || e.message === "no_clinic") {
              return send(400, { error: e.message });
            }
            throw e;
          }
        }

        // Выдать номер. Агента может ещё не быть — тогда номер закрепится за
        // клиникой, а на её агента встанет позже, при «Включить».
        if (urlPath === "/api/admin/assign" && req.method === "POST") {
          const b = await body();
          const number = String(b.number || "").trim();
          const c = await db.clinicById(Number(b.clinic_id));
          if (!c) return send(404, { error: "no_clinic" });
          const taken = await db.assignNumber(number, c.id);
          if (!taken) return send(409, { error: "not_free" });
          const bound = c.agent_id ? await bindNumberToAgent(taken.phone_number_id, c.agent_id) : false;
          return send(200, { ok: true, number: taken.number, bound: bound });
        }

        if (urlPath === "/api/admin/release" && req.method === "POST") {
          const b = await body();
          const number = String(b.number || "").trim();
          const row = (await db.numbersByStatus()).find((n) => n.number === number);
          const freed = await db.releaseNumber(number);
          if (!freed) return send(404, { error: "no_number" });
          // Освобождённый номер не должен продолжать отвечать голосом клиники,
          // от которой его забрали.
          if (row && row.phone_number_id) {
            await bindNumberToAgent(row.phone_number_id, agentTemplate.BASE_AGENT);
          }
          return send(200, { ok: true });
        }

        // Передача кабинета владельцу: приглашение в организацию клиники.
        if (urlPath === "/api/admin/invite" && req.method === "POST") {
          const b = await body();
          const c = await db.clinicById(Number(b.clinic_id));
          const email = String(b.email || "").trim().slice(0, 200);
          if (!c) return send(404, { error: "no_clinic" });
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(400, { error: "bad_email" });
          const r = await fetch(
            "https://api.clerk.com/v1/organizations/" + encodeURIComponent(c.org_id) + "/invitations",
            {
              method: "POST",
              headers: { Authorization: "Bearer " + CLERK_SK, "Content-Type": "application/json" },
              body: JSON.stringify({
                email_address: email,
                role: "org:admin",
                inviter_user_id: ctx.userId,
                redirect_url: PUBLIC_URL + "/cabinet/",
              }),
            }
          );
          const j = await r.json();
          if (!r.ok) {
            console.log("[admin] приглашение не ушло: " + JSON.stringify(j).slice(0, 200));
            return send(502, { error: "invite_failed" });
          }
          return send(200, { ok: true });
        }

        send(404, { error: "unknown_endpoint" });
      })().catch((e) => {
        console.log("[admin] " + String(e.message).slice(0, 200));
        res.writeHead(500, { "Content-Type": MIME[".json"] });
        res.end(JSON.stringify({ error: "internal" }));
      });
      return;
    }

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
          const toolKey = await db.ensureToolKey(clinicId);
          const opts = { toolKey: toolKey, baseUrl: PUBLIC_URL };
          let agentId = clinic.agent_id;
          if (!agentId || agentId === agentTemplate.BASE_AGENT) {
            agentId = await agentTemplate.createAgent(profile, opts);
          } else {
            await agentTemplate.updateAgent(agentId, profile, opts);
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

    // Запись с витрины. Отдаём только помеченные звонки: голос обезличить
    // нельзя, а на демо-номер звонят посторонние.
    if (urlPath === "/api/demo/audio") {
      (async () => {
        const clinicId = Number(process.env.DEMO_CLINIC_ID || 1);
        const id = parsed.searchParams.get("id") || "";
        const call = await db.callForClinics(id, [clinicId]);
        const deny = (code, err) => {
          res.writeHead(code, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
          res.end(JSON.stringify({ error: err }));
        };
        if (!call || !call.demo_public) return deny(404, "not_found");
        const key = process.env.ELEVENLABS_API_KEY;
        if (!key) return deny(503, "not_configured");
        const r = await fetch(
          "https://api.elevenlabs.io/v1/convai/conversations/" +
          encodeURIComponent(id) + "/audio",
          { headers: { "xi-api-key": key } }
        );
        if (!r.ok) return deny(502, "audio_unavailable");
        res.writeHead(200, {
          "Content-Type": r.headers.get("content-type") || "audio/mpeg",
          "Cache-Control": "public, max-age=3600",
        });
        res.end(Buffer.from(await r.arrayBuffer()));
      })().catch(() => {
        res.writeHead(500, { "Content-Type": MIME[".json"] });
        res.end(JSON.stringify({ error: "internal" }));
      });
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
          transcript: d.transcript ? JSON.stringify(cleanTranscript(d.transcript)) : null,
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

    // Вебхук Zadarma. Ставим его, чтобы увидеть, что АТС знает о звонке:
    // по SIP до нас доезжает только номер звонящего, а номер, С КОТОРОГО
    // сделана переадресация, теряется — а именно он позволил бы держать одну
    // линию на нескольких клиентов вместо номера на каждого.
    // Заглушка «системы бронирования» для проверки вертикали посуточной
    // аренды: ассистент ходит сюда за занятостью, как ходил бы в реальную
    // систему арендодателя. Данные выдуманные и намеренно постоянные —
    // проверяем разговор, а не базу.
    // Ответ для переписки в WhatsApp. Отвечаем текстом на текст: сам шлюз
    // (OpenWA) живёт у агента на машине и ходит сюда за репликой — так его
    // не нужно открывать наружу, а знания о клинике остаются в одном месте.
    // Узнаём клинику по её ключу инструментов: он уже есть, он секретный, и
    // ничей идентификатор из запроса мы на веру не принимаем.
    // Входящее сообщение от шлюза. Арендатора узнаём по ключу в адресе — тому
    // же, что у инструментов: он секретный, уже выдан и не приходит из тела
    // запроса, где его мог бы подставить кто угодно.
    if (urlPath === "/api/whatsapp/inbound") {
      (async () => {
        const ok = () => {
          // Шлюзу отвечаем сразу и всегда: он ждёт подтверждения доставки, а
          // не результата нашей работы, и на ошибку начнёт повторять.
          res.writeHead(200, { "Content-Type": MIME[".json"] });
          res.end('{"ok":true}');
        };
        const clinic = await db.clinicByToolKey(parsed.searchParams.get("k"));
        if (!clinic) {
          res.writeHead(403, { "Content-Type": MIME[".json"] });
          return res.end('{"error":"bad_key"}');
        }
        let payload = {};
        try { payload = JSON.parse(await readBody(req)) || {}; } catch {}
        ok();

        const msg = waParse(payload);
        // Пишем в базу каждый шаг: логи Azure видны не всегда, а «ассистент
        // молчит» без записи выглядит одинаково при десяти разных причинах.
        const note = (why, extra) => db.saveZadarmaEvent("wa:" + why, {
          clinic: String(clinic.id), chat: msg.chatId || "", text: (msg.text || "").slice(0, 200),
          allow_list: WA_ONLY_FROM.join(",") || "(пусто)", ...(extra || {}),
        }).catch(() => {});

        if (msg.event && !/message/i.test(msg.event)) return;  // статусы сессии
        if (msg.fromMe || msg.isGroup) return void note("skip-own-or-group");
        if (!waAllowed(msg.chatId)) return void note("skip-not-in-list");
        if (!msg.chatId || !msg.text) return void note("skip-empty");
        note("in");
        try {
          const reply = await waReply(clinic, msg.text.slice(0, 1500), WA_CHATS.get(msg.chatId));
          waRemember(msg.chatId, "human", msg.text);
          waRemember(msg.chatId, "clinic", reply);
          await waRead(clinic.wa_session, msg.chatId);
          // Пустая строка в ответе — граница сообщения: так модель сама решает,
          // где у мысли конец, а мы не режем текст посередине фразы.
          const parts = waHumanize(reply).split(/\n\n+/).map((x) => x.trim())
            .filter(Boolean).slice(0, 3);
          for (const part of parts) {
            await new Promise((r) => setTimeout(r, waPause(part)));
            await waSend(msg.chatId, part, clinic.wa_session);
          }
          note("out", { reply: reply.slice(0, 300), parts: String(parts.length) });
          console.log("[whatsapp] " + clinic.name + " " + msg.chatId + ": " +
            msg.text.slice(0, 40) + " -> " + reply.slice(0, 40));
        } catch (e) {
          note("fail", { error: String(e.message).slice(0, 300) });
          console.log("[whatsapp] не ответили: " + String(e.message).slice(0, 160));
        }
      })().catch((e) => {
        console.log("[whatsapp] " + String(e.message).slice(0, 200));
        try {
          res.writeHead(500, { "Content-Type": MIME[".json"] });
          res.end('{"error":"internal"}');
        } catch {}
      });
      return;
    }

    // Тот же ответ, но по запросу снаружи: для случая, когда шлюз WhatsApp
    // живёт у агента на машине и не может принять звонок от нас — тогда он
    // спрашивает реплику сам. Логика одна, чтобы каналы не разъехались.
    if (urlPath === "/api/whatsapp/reply") {
      (async () => {
        const send = (code, obj) => {
          res.writeHead(code, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
          res.end(JSON.stringify(obj));
        };
        if (req.method !== "POST") return send(405, { error: "method" });

        let body = {};
        try { body = JSON.parse(await readBody(req)) || {}; } catch {}
        const clinic = await db.clinicByToolKey(String(body.key || ""));
        if (!clinic) return send(403, { error: "bad_key" });

        const text = String(body.text || "").trim().slice(0, 1500);
        if (!text) return send(400, { error: "no_text" });
        if (!enrich.available()) return send(503, { error: "no_model_key" });

        try {
          const reply = await waReply(clinic, text, body.history);
          console.log("[whatsapp] " + clinic.name + ": " + text.slice(0, 50) +
            " -> " + reply.slice(0, 50));
          return send(200, { ok: true, reply: reply, clinic: clinic.name });
        } catch (e) {
          console.log("[whatsapp] модель не ответила: " + String(e.message).slice(0, 140));
          return send(200, { ok: false, error: "model_failed" });
        }
      })().catch((e) => {
        console.log("[whatsapp] " + String(e.message).slice(0, 200));
        res.writeHead(500, { "Content-Type": MIME[".json"] });
        res.end(JSON.stringify({ error: "internal" }));
      });
      return;
    }

    if (urlPath === "/api/demo/rental-slots") {
      const date = String(parsed.searchParams.get("date") || "").slice(0, 40);
      res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
      return res.end(JSON.stringify({
        запрошено: date || "без даты",
        slots: [
          {
            объект: "Студия, ЖК на Абая 143",
            цена_за_сутки: "12 000 ₸",
            свободно: "с 8 по 14 сентября",
            занято: "6 и 7 сентября",
            вместимость: "2 гостя",
          },
          {
            объект: "Однокомнатная, Достык 89",
            цена_за_сутки: "16 000 ₸",
            свободно: "6, 7 и с 12 сентября",
            занято: "с 8 по 11 сентября",
            вместимость: "3 гостя",
          },
          {
            объект: "Двухкомнатная, Сатпаева 30",
            цена_за_сутки: "24 000 ₸",
            свободно: "вся неделя",
            занято: "нет",
            вместимость: "5 гостей",
          },
        ],
        правила: "заезд с 14:00, выезд до 12:00, депозит 20 000 ₸ возвращается при выезде",
      }));
    }

    if (urlPath === "/api/zadarma/webhook") {
      // Сохранение адреса в панели Zadarma: они дёргают GET со случайной
      // строкой в zd_echo и ждут её же в теле ответа.
      if (req.method === "GET") {
        const echo = parsed.searchParams.get("zd_echo");
        res.writeHead(200, { "Content-Type": "text/plain", "Cache-Control": "no-store" });
        return res.end(echo == null ? "ok" : String(echo));
      }
      if (req.method !== "POST") {
        res.writeHead(405, { "Content-Type": MIME[".json"] });
        return res.end(JSON.stringify({ error: "method" }));
      }
      readBody(req)
        .then((raw) => {
          // Тело приходит формой; сохраняем ВСЕ поля, а не разбираем знакомые:
          // смысл затеи как раз в том, чтобы увидеть незнакомые.
          const fields = {};
          try {
            for (const [k, v] of new URLSearchParams(raw)) fields[k] = v;
          } catch {}
          const event = {
            at: new Date().toISOString(),
            event: fields.event || "",
            signature: String(req.headers.signature || "") ? "есть" : "нет",
            fields,
            raw: raw.slice(0, 2000),
          };
          ZADARMA_EVENTS.unshift(event);
          // И в базу: память переживёт не каждый перезапуск, а разбираться с
          // этими полями мы будем не в ту же минуту.
          db.saveZadarmaEvent(fields.event || "", fields).catch((e) =>
            console.log("[zadarma] в базу не записалось: " + String(e.message).slice(0, 120)));
          // И сводная строка по звонку — журнал phone_calls.
          db.upsertPhoneCall(fields.event || "", fields).catch((e) =>
            console.log("[zadarma] журнал звонков: " + String(e.message).slice(0, 120)));
          if (ZADARMA_EVENTS.length > 40) ZADARMA_EVENTS.length = 40;
          console.log("[zadarma] " + (fields.event || "?") + " " + JSON.stringify(fields).slice(0, 400));

          // В телеграм — по звонку, а не по каждому событию: «входящий» на
          // старте и итог на завершении; промежуточные события молчат.
          // Звонки на номера агента (клиники, ElevenLabs) — не сюда: у них
          // свой post-call вебхук и свои уведомления.
          const ev = String(fields.event || "");
          const who = fields.caller_id || fields.destination || "?";
          const didDigits = String(fields.called_did || "").replace(/D/g, "");
          if (!agentDidsCache.at || Date.now() - agentDidsCache.at > 300e3) {
            agentDidsCache.at = Date.now();
            db.agentDids().then((s) => { agentDidsCache.set = s; }).catch(() => {});
          }
          const isAgentDid = !!(didDigits && agentDidsCache.set && agentDidsCache.set.has(didDigits));
          if (isAgentDid) { /* журнал уже записан выше */ }
          else if (ev === "NOTIFY_START") {
            notifyTelegram("\u260e\ufe0f <b>Входящий</b> от " + who + (fields.called_did ? " на " + fields.called_did : ""));
          } else if (ev === "NOTIFY_END" || ev === "NOTIFY_OUT_END") {
            const secs = Number(fields.duration) || 0;
            const mm = Math.floor(secs / 60), ss = String(secs % 60).padStart(2, "0");
            const ok = String(fields.disposition || "").toLowerCase() === "answered";
            notifyTelegram((ok ? "\u2705 <b>Разговор</b> " : "\u274c <b>Пропущен</b> ") +
              (ev === "NOTIFY_OUT_END" ? "исходящий на " : "от ") + who +
              (ok ? " · " + mm + ":" + ss : "") +
              (fields.disposition && !ok ? " · " + fields.disposition : "") +
              (String(fields.is_recorded) === "1" ? " · есть запись" : ""));
          }
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("ok");
        })
        .catch(() => {
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("ok");
        });
      return;
    }

    // Журнал звонков: одна строка на звонок, собранная из событий АТС.
    // ?days=7&limit=200. Ключ — тот же служебный.
    if (urlPath === "/api/calls") {
      const want = KRISHA_JOB_KEY || KRISHA_PHONE_KEY;
      if (!want || parsed.searchParams.get("key") !== want) {
        res.writeHead(403, { "Content-Type": MIME[".json"] }); return res.end(JSON.stringify({ ok: false, error: "bad_key" }));
      }
      (async () => {
        const rows = await db.phoneCalls(parsed.searchParams.get("days"), parsed.searchParams.get("limit"), parsed.searchParams.get("mine") === "1");
        res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
        res.end(JSON.stringify({ ok: true, count: rows.length, calls: rows }, null, 2));
      })().catch((e) => { res.writeHead(500, { "Content-Type": MIME[".json"] }); res.end(JSON.stringify({ ok: false, error: String(e.message).slice(0, 200) })); });
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

        const phone = normalizeDemoPhone(body.phone);
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

        const scenario = ["reminder", "upsell"].includes(String(body.scenario))
          ? String(body.scenario) : "inbound";
        const r = await placeDemoCall(phone, null, scenario, body.lang === "kk" ? "kk" : "ru");
        if (!r.ok) {
          console.log("[demo-call] отказ " + phone + " — " + JSON.stringify(r).slice(0, 200));
          return send(r.reason === "not_configured" ? 503 : 502, { error: r.reason });
        }

        DEMO_CALL_LOG.push({ at: Date.now(), phone, ip, id: r.id });
        console.log("[demo-call] звоним " + phone + " (" + scenario + ")");
        await notifyTelegram("☎️ <b>Демо-звонок</b>\n\nНомер: " + phone +
                             "\nСценарий: " + scenario);
        send(200, { ok: true, id: r.id });
      })().catch((e) => {
        res.writeHead(500, { "Content-Type": MIME[".json"] });
        res.end(JSON.stringify({ error: String(e.message).slice(0, 120) }));
      });
      return;
    }

    // Казахстанские операторы отбивают часть зарубежных вызовов молча: Twilio
    // отдаёт busy, а разговор в ElevenLabs так и остаётся initiated с нулевой
    // длительностью. Форма спрашивает сюда, чтобы не обещать звонок, которого
    // не будет.
    if (urlPath === "/api/demo-call/status") {
      (async () => {
        const send = (code, obj) => {
          res.writeHead(code, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
          res.end(JSON.stringify(obj));
        };
        const id = String(parsed.searchParams.get("id") || "");
        // Отвечаем только про звонок, заказанный через эту же форму: иначе
        // ручка превращается в справочник по чужим разговорам.
        const mine = DEMO_CALL_LOG.find((c) => c.id && c.id === id);
        if (!mine) return send(404, { error: "unknown_call" });

        const key = process.env.ELEVENLABS_API_KEY;
        if (!key) return send(503, { error: "not_configured" });
        let conv = null;
        try {
          const r = await fetch("https://api.elevenlabs.io/v1/convai/conversations/" + id, {
            headers: { "xi-api-key": key }, signal: AbortSignal.timeout(8000),
          });
          if (r.ok) conv = await r.json();
        } catch { /* сеть до ElevenLabs рвётся — тогда честнее сказать «звонит» */ }
        if (!conv) return send(200, { state: "ringing" });

        const secs = (conv.metadata && conv.metadata.call_duration_secs) || 0;
        const age = (Date.now() - mine.at) / 1000;
        let state = "ringing";
        if (secs > 0 || conv.status === "in-progress") state = "talking";
        else if (conv.status === "done") state = "rejected";
        else if (conv.status === "initiated" && age > 35) state = "rejected";
        send(200, { state: state });
      })().catch(() => {
        res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
        res.end(JSON.stringify({ state: "ringing" }));
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
        const city = String(body.city || "").slice(0, 80).trim();
        const clinic = String(body.clinic || "").slice(0, 120).trim();
        const promo = String(body.promo || "").slice(0, 40).trim();
        const lang = body.lang === "kk" ? "kk" : "ru";
        if (phone.replace(/[^0-9]/g, "").length < 10) {
          res.writeHead(400, { "Content-Type": MIME[".json"] });
          res.end(JSON.stringify({ error: "phone_required" }));
          return;
        }
        recordLead({ at: new Date().toISOString(), product: "reception365",
                     name, phone, city, clinic, promo, kind, lang });
        await notifyTelegram(
          "📞 <b>Заявка — Reception365</b>\n\n" +
          (name ? "Имя: " + name + "\n" : "") +
          "Телефон: " + phone + "\n" +
          (city ? "Город: " + city + "\n" : "") +
          (clinic ? "Клиника: " + clinic + "\n" : "") +
          (promo ? "Промокод: " + promo + "\n" : "") +
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

    // Регистрация вебхука. Делается на сервере, а не снаружи: токен бота живёт
    // только здесь, а секрет вебхука из него и выводится.
    if (urlPath === "/api/telegram/setup") {
      const bot = require("./scripts/krisha-bot.js");
      const send = (code, obj) => {
        res.writeHead(code, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
        res.end(JSON.stringify(obj, null, 2));
      };
      const want = KRISHA_JOB_KEY || KRISHA_PHONE_KEY;
      if (!want || parsed.searchParams.get("key") !== want) return send(403, { ok: false, error: "bad_key" });
      if (!TG_TOKEN) return send(503, { ok: false, error: "нет токена бота" });
      (async () => {
        if (parsed.searchParams.get("off") === "1") {
          return send(200, { ok: true, deleted: await bot.api(TG_TOKEN, "deleteWebhook", {}) });
        }
        const set = await bot.api(TG_TOKEN, "setWebhook", {
          url: CANONICAL + "/api/telegram/webhook",
          secret_token: bot.webhookSecret(TG_TOKEN),
          allowed_updates: ["message", "callback_query"],
          drop_pending_updates: true,
        });
        const info = await bot.api(TG_TOKEN, "getWebhookInfo", {});
        const me = await bot.api(TG_TOKEN, "getMe", {});
        return send(200, {
          ok: !!set.ok,
          set: set.description || set.result,
          bot: me.result ? "@" + me.result.username : null,
          webhook: info.result ? {
            url: info.result.url,
            pending: info.result.pending_update_count,
            lastError: info.result.last_error_message || null,
          } : null,
        });
      })().catch((e) => send(500, { ok: false, error: String(e.message).slice(0, 160) }));
      return;
    }

    // Бот для покупателя. Он присылает ссылку на объявление агента — мы
    // отвечаем оригиналами от хозяев, по сообщению на совпадение, с кнопкой
    // «Показать контакты».
    //
    // Секрет вебхука выведен из токена бота, поэтому лишней переменной не
    // нужно, а посторонний по адресу ручки ничего не отправит.
    if (urlPath === "/api/telegram/webhook") {
      const bot = require("./scripts/krisha-bot.js");
      if (!TG_TOKEN) { res.writeHead(503).end(); return; }
      if (req.headers["x-telegram-bot-api-secret-token"] !== bot.webhookSecret(TG_TOKEN)) {
        res.writeHead(403).end();
        return;
      }
      // Телеграм повторяет доставку, если не ответить быстро, поэтому
      // подтверждаем сразу и работаем дальше в фоне.
      res.writeHead(200, { "Content-Type": MIME[".json"] }).end("{}");
      readBody(req)
        .then((raw) => handleTelegramUpdate(JSON.parse(raw || "{}")))
        .catch((e) => console.log("[бот] " + String(e.message).slice(0, 140)));
      return;
    }

    // Суточный сбор для внешнего планировщика: обойти города и сложить новые
    // объявления от хозяев в базу. Город необязателен — без него берутся все из
    // KRISHA_CITIES. Отвечаем сразу: работа идёт в фоне минут сорок, итог
    // приходит в Телеграм.
    if (urlPath === "/api/krisha/collect") {
      const send = (code, obj) => {
        res.writeHead(code, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
        res.end(JSON.stringify(obj, null, 2));
      };
      const want = KRISHA_JOB_KEY || KRISHA_PHONE_KEY;
      if (!want || parsed.searchParams.get("key") !== want) return send(403, { ok: false, error: "bad_key" });
      if (baseRunning || KU.running || deepenRunning || backfillRunning) {
        return send(409, { ok: false, running: true, progress: KU.progress || null, error: "уже идёт" });
      }
      const only = String(parsed.searchParams.get("cities") || parsed.searchParams.get("city") || "")
        .split(/[^a-z-]+/i).filter(Boolean);
      const cities = only.length ? only : KRISHA_CITIES;
      const force = parsed.searchParams.get("force") === "1";
      // Проверяем до запуска, чтобы планировщик получил внятный ответ, а не 202
      // на работу, которой не будет.
      if (!force) {
        const last = KW.lastBaseRun || {};
        const due = cities.filter((c) => {
          const at = Date.parse(last[c] || 0);
          return !at || Date.now() - at >= KRISHA_MIN_GAP_H * 3600e3;
        });
        if (!due.length) {
          return send(429, {
            ok: false, skipped: true, cities: cities, minGapHours: KRISHA_MIN_GAP_H,
            lastRun: last, error: "собирали меньше " + KRISHA_MIN_GAP_H + " ч назад",
          });
        }
      }
      runKrishaDaily(cities, { force: force })
        .then((o) => console.log("[krisha] сбор базы " + JSON.stringify(o)))
        .catch((e) => console.log("[krisha] сбор базы сорвался: " + e.message));
      return send(202, { ok: true, started: true, cities: cities, note: "итог придёт в Телеграм" });
    }

    // Дочитывание архива: описание хозяина, характеристики и полная галерея у
    // квартир, которые попали в базу из выдачи. Страницы объявлений идут через
    // KRISHA_PROXY — с адреса Azure Крыша эти запросы уже не отдаёт.
    if (urlPath === "/api/krisha/deepen") {
      const send = (code, obj) => {
        res.writeHead(code, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
        res.end(JSON.stringify(obj, null, 2));
      };
      const want = KRISHA_JOB_KEY || KRISHA_PHONE_KEY;
      if (!want || parsed.searchParams.get("key") !== want) return send(403, { ok: false, error: "bad_key" });
      if (deepenRunning || KU.running || backfillRunning) {
        return send(409, { ok: false, running: true, progress: KU.progress || null, error: "уже идёт" });
      }
      KW.deepen = KW.deepen || {};
      // Ручной сброс паузы: ?resume=1 снимает предохранитель раньше срока,
      // когда есть основания думать, что причина уже не действует (например,
      // починили ротацию прокси и хотят проверить прямо сейчас).
      if (parsed.searchParams.get("resume") === "1") {
        KW.deepen.pausedUntil = null;
        saveKrisha();
      }
      // Предохранитель: после прогона, который почти ничего не принёс, ждём.
      if (KW.deepen.pausedUntil && Date.now() < Date.parse(KW.deepen.pausedUntil)) {
        return send(429, {
          ok: false, skipped: true, pausedUntil: KW.deepen.pausedUntil,
          error: "Крыша отказывает — ждём до " + KW.deepen.pausedUntil,
        });
      }
      const limit = Math.max(1, Math.min(Number(parsed.searchParams.get("limit") || 500), 2000));
      const concurrency = Math.max(1, Math.min(500,
        Number(parsed.searchParams.get("concurrency") || KRISHA_DEEPEN_CONCURRENCY) || KRISHA_DEEPEN_CONCURRENCY));
      // Заставить процесс подхватить весь пул прямо сейчас, а не ждать
      // случайной серии из 8 отказов, которая до ротации может и не дойти.
      // Разовая проверка — не завязана на конкретное число прокси.
      const wantRotate = parsed.searchParams.get("rotateProxies") === "1";
      {
        const KL0 = require("./scripts/krisha-lib.js");
        if (!KL0.viaProxy()) return send(409, { ok: false, error: KL0.proxyHint() });
      }
      deepenRunning = true;
      (async () => {
        const Card = require("./scripts/krisha-card.js");
        const KL = require("./scripts/krisha-lib.js");
        const Base = require("./scripts/krisha-base.js");
        let done = 0, failed = 0, seen = 0, rotated = 0, streak = 0;
        try {
          if (wantRotate) {
            try { await KL.rotateProxies(); } catch { /* останется прежний пул */ }
          }
          const rows = await db.flatsWithoutCard(limit);
          const n = Math.min(concurrency, Math.max(1, rows.length));
          let next = 0;
          async function deepenOne(r) {
            try {
              const html = await KL.fetchText("https://krisha.kz/a/show/" + r.id, 3, 15000, { proxy: true });
              const card = Card.parse(html, r.id);
              const detail = KL.parseDetail(html);
              // Перечитка идёт ради JSON, а не ради снимков: у этих объявлений
              // галерея в хранилище уже лежит, и перекачивать её заново — сто
              // тысяч обращений к CDN впустую.
              if (blob.ready() && !r.reread) {
                await Promise.all((card.photos || []).map(async (p, n) => {
                  try { p.big = await blob.copyFrom(p.big, "flat/" + r.id + "/" + (n + 1) + ".jpg"); } catch { /* останется чужая */ }
                  try { p.full = await blob.copyFrom(p.full, "kv/" + r.id + "/" + (n + 1) + "-full.jpg"); } catch { /* останется чужая */ }
                }));
              }
              card.addr = card.addr || r.addr;
              await db.saveCard(r.id, card);
              // Тут же дописываем то, чего архивной записи не хватало: год
              // постройки, тип дома и дату публикации.
              await db.saveFlat(Base.record(
                Object.assign({}, card, {
                  id: r.id, rooms: r.rooms || card.rooms,
                  area: r.area == null ? card.square : Number(r.area),
                  district: r.district, price: r.price,
                  addr: card.addressTitle || r.addr,
                }),
                detail,
                { city: r.city, title: card.title, short: card.short, params: card.params,
                  photos: (card.photos || []).length,
                  ph1: card.photos && card.photos[0] ? card.photos[0].big : null }
              ));
              done++;
              streak = 0;
            } catch (e) {
              failed++;
              const gone = e && (e.status === 404 || e.status === 410);
              if (!gone) streak++;
              else streak = 0;
              if (streak >= 8) {
                try {
                  await KL.rotateProxies();
                  rotated++;
                  streak = 0;
                  KU.progress = "сменил прокси, пул " + KL.proxyCount();
                  console.log("[krisha] " + KU.progress);
                } catch (re) {
                  console.log("[krisha] прокси не сменились: " + String(re.message).slice(0, 120));
                }
              }
              // По коду ответа снятое от придержанного не отличить: одно и то
              // же объявление отдаёт то 404, то 468, и заведомо живое тоже
              // отвечает 468. Поэтому ничего не объявляем снятым — только
              // считаем попытки, а очередь ставит неудачников в конец.
              await db.markCardMiss(r.id).catch(() => {});
            }
            seen++;
            KW.deepen.read = (KW.deepen.read || 0) + 1;
            KU.progress = "дочитываю архив: " + seen + " из " + rows.length + " ×" + n;
            if (seen % 50 === 0) saveKrisha();
          }
          await Promise.all(Array.from({ length: n }, async (_, w) => {
            if (w) await KL.sleep(w * 40);
            while (true) {
              const i = next++;
              if (i >= rows.length) return;
              await deepenOne(rows[i]);
            }
          }));
        } finally {
          deepenRunning = false;
          KU.progress = null;
        }
        const st = await db.krishaStats().catch(() => null);
        const left = await db.deepenLeft().catch(() => null);
        // Прогон, из которого не вышло почти ничего, означает не «страницы
        // плохие», а «нас не пускают». Дальше читать нечего до следующего раза.
        let paused = null;
        if (done + failed >= 10 && done <= (done + failed) * 0.2) {
          paused = new Date(Date.now() + KRISHA_DEEPEN_PAUSE_H * 3600e3).toISOString();
          KW.deepen.pausedUntil = paused;
          saveKrisha();
        }
        await notifyTelegram([
          "📖 <b>Крыша: дочитывание архива</b>",
          "",
          "Прочитано: <b>" + done + "</b>" +
            (failed ? ", не отдали: " + failed + " (" + Math.round((100 * failed) / (done + failed)) + "%)" : "") +

          st ? "Карточек всего " + st.cards + " из " + st.flats + " квартир" : null,
          // Видно конец работы, а не только сегодняшний шаг.
          left ? "Осталось дочитать: <b>" + (left.no_card + left.old_parse) + "</b>" +
            " · с координатами " + left.with_geo +
            (left.given_up ? " · отложено " + left.given_up : "") : null,
          paused ? "Крыша отказывает — не трогаем её до " + paused.slice(11, 16) + " UTC" : null,
          rotated ? "Сменили прокси: " + rotated : null,
        ].filter(Boolean).join("\n"));
        return { done: done, failed: failed };
      })()
        .then((o) => console.log("[krisha] дочитывание " + JSON.stringify(o)))
        .catch((e) => { deepenRunning = false; console.log("[krisha] дочитывание сорвалось: " + e.message); });

      return send(202, {
        ok: true, started: true, limit: limit, concurrency: concurrency,
        viaProxy: true, proxies: require("./scripts/krisha-lib.js").proxyCount(),
        note: "итог придёт в Телеграм",
      });
    }

    // Догон фотографий по тем квартирам, что уже в базе со ссылкой на Крышу.
    // Ходим только на CDN — там нет ни капчи, ни ограничения темпа, поэтому
    // качаем по двадцать за раз. Заодно запоминаем папку снимков.
    if (urlPath === "/api/krisha/photos") {
      const send = (code, obj) => {
        res.writeHead(code, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
        res.end(JSON.stringify(obj, null, 2));
      };
      const want = KRISHA_JOB_KEY || KRISHA_PHONE_KEY;
      if (!want || parsed.searchParams.get("key") !== want) return send(403, { ok: false, error: "bad_key" });
      if (photosRunning) return send(409, { ok: false, running: true, progress: KU.progress || null });
      if (!blob.ready()) return send(409, { ok: false, error: "хранилище не настроено" });

      const limit = Math.max(1, Math.min(Number(parsed.searchParams.get("limit") || 600), 3000));
      photosRunning = true;
      (async () => {
        const Base = require("./scripts/krisha-base.js");
        let done = 0, failed = 0;
        try {
          for (;;) {
            const rows = await db.flatsNeedingPhoto(Math.min(20, limit - done - failed));
            if (!rows.length || done + failed >= limit) break;
            await Promise.all(rows.map(async (r) => {
              const dir = Base.photoDirOf(r.photo1);
              try {
                const url = await blob.copyFrom(r.photo1, "base/" + r.id + ".jpg");
                await db.setFlatPhoto(r.id, url, dir);
                done++;
              } catch {
                // Снимка уже нет — папку всё равно запомним, по ней галерею
                // можно будет собрать перебором.
                try { await db.setFlatPhoto(r.id, null, dir); } catch { /* не судьба */ }
                failed++;
              }
            }));
            KU.progress = "фото из базы: перенесено " + done + ", не вышло " + failed;
          }
        } finally {
          photosRunning = false;
          KU.progress = null;
        }
        const st = await db.photoStats().catch(() => null);
        // Хранилище догнало базу, и каждые десять минут приходил отчёт ни о чём.
        // Молчим, когда переносить было нечего: отчёт нужен про работу, а не
        // про её отсутствие.
        if (!done && !failed) return { done: 0, failed: 0, quiet: true };
        await notifyTelegram([
          "🖼 <b>Крыша: фотографии</b>",
          "",
          "Перенесено: <b>" + done + "</b>" + (failed ? ", не вышло: " + failed : ""),
          st ? "У нас в хранилище " + st.ours + " из " + st.total + ", папка известна у " + st.with_dir : null,
        ].filter(Boolean).join("\n"));
        return { done: done, failed: failed };
      })()
        .then((o) => console.log("[krisha] фото " + JSON.stringify(o)))
        .catch((e) => { photosRunning = false; console.log("[krisha] фото сорвалось: " + e.message); });

      return send(202, { ok: true, started: true, limit: limit, note: "итог придёт в Телеграм" });
    }

    // Разбор архива: то, что висит на Крыше давно. Идёт кусками по триста
    // страниц, каждый следующий вызов продолжает с того места, где кончил
    // предыдущий, — так весь город набирается за несколько заходов, а не одним
    // многочасовым обходом, на который площадка обидится.
    if (urlPath === "/api/krisha/backfill") {
      const send = (code, obj) => {
        res.writeHead(code, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
        res.end(JSON.stringify(obj, null, 2));
      };
      const want = KRISHA_JOB_KEY || KRISHA_PHONE_KEY;
      if (!want || parsed.searchParams.get("key") !== want) return send(403, { ok: false, error: "bad_key" });
      if (backfillRunning || KU.running || deepenRunning || baseRunning) {
        return send(409, { ok: false, running: true, progress: KU.progress || null, error: "уже идёт" });
      }
      // Без города берём первый непройденный из KRISHA_CITIES — так один джоб
      // без параметров доводит до конца сначала один город, потом следующий.
      // Раньше по умолчанию брался Алматы, и после его окончания каждый запуск
      // уходил за последнюю страницу и не делал ничего.
      const done = KW.backfillDone || {};
      const city = parsed.searchParams.get("city") ||
        KRISHA_CITIES.find((x) => !done[x]) || null;
      if (!city) {
        return send(200, { ok: true, started: false, doneCities: Object.keys(done), note: "все города пройдены" });
      }
      const pages = parsed.searchParams.get("pages");
      const from = parsed.searchParams.get("from");
      runKrishaBackfill(city, pages, from)
        .then((o) => console.log("[krisha] архив " + JSON.stringify(o)))
        .catch((e) => console.log("[krisha] архив сорвался: " + e.message));
      return send(202, {
        ok: true, started: true, city: city,
        from: Number(from) || (KW.backfill && KW.backfill[city]) || 1,
        note: "итог придёт в Телеграм",
      });
    }

    // Полный поток недвижимости обходом по id (id-walking). Держим курсор —
    // самый большой id, за которым уже видели живое объявление, — и на каждый
    // вызов проверяем следующий блок id за ним. Живые сохраняем целиком
    // (window.data в gzip + разобранные поля), 404 пропускаем, 468 отдаём на
    // ретрай самому fetchText. Курсор двигаем только до самого большого живого
    // id: у фронтира (дальше объявлений ещё нет) он стоит и ждёт, пока новые
    // появятся. Задумано под частый дёрг из Hangfire (раз в 30-60 c).
    // Отвечает синхронно — планировщик видит итог прогона, а не пустой 202.
    // Свежее: отдельный job, каждую минуту. Список карты отсортирован по дате
    // поднятия, новое всегда сверху, поэтому читаем страницы каждой части по
    // порядку и останавливаемся на первой, где нет ни одного нового для базы
    // объявления (дальше только уже известные поднятия). Потолок — ?pages
    // (10, максимум 20). Своя блокировка: круг scanlist ему не мешает.
    if (urlPath === "/api/krisha/fresh") {
      const send = (code, obj) => {
        res.writeHead(code, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
        res.end(JSON.stringify(obj, null, 2));
      };
      const want = KRISHA_JOB_KEY || KRISHA_PHONE_KEY;
      if (!want || parsed.searchParams.get("key") !== want) return send(403, { ok: false, error: "bad_key" });
      if (freshRunning) return send(409, { ok: false, running: true, error: "свежее уже читается" });
      const q = parsed.searchParams;
      const cap = Math.max(1, Math.min(20, Number(q.get("pages") || 10)));
      // Минимум страниц на часть — всегда, даже если на первой нет нового:
      // в пиковой части сверху входит до 20+ объявлений в минуту (замер 20.09:
      // 21 за минуту в «2к»), и новое могло уехать на вторую страницу за
      // известными поднятиями. Три страницы покрывают 60 вставок в минуту.
      const minPages = Math.max(1, Math.min(cap, Number(q.get("minPages") || 3)));
      const budgetMs = Math.max(5, Math.min(120, Number(q.get("budgetSec") || 50))) * 1000;
      const viaProxy = q.get("proxy") === "1";
      const L = require("./scripts/krisha-list.js");
      freshRunning = true;
      (async () => {
        const t0 = Date.now();
        await L.loadRegions().catch(() => { /* город останется пустым */ });
        const sweepNo = (KW.list && KW.list.sweepNo) || null;
        // Под нагрузкой базы глубину режем: новое всё равно на первых страницах.
        const load = await db.dbLoad().catch(() => null);
        const hot = load ? Math.max(load.cpu, load.io, load.log) : 0;
        const depth = hot > 85 ? Math.max(minPages, Math.min(cap, 2)) : hot > 70 ? Math.max(minPages, Math.min(cap, 4)) : cap;
        let pages = 0, adverts = 0, added = 0, bumped = 0, priceChanged = 0, errors = 0;
        const parts = [];
        // Части — по три параллельно; внутри части страницы по порядку, потому
        // что решение «читать дальше» зависит от предыдущей страницы.
        async function onePart(sec) {
          const r = { section: sec.label, pages: 0, added: 0 };
          for (let p = 1; p <= depth; p++) {
            if (Date.now() - t0 > budgetMs) break;
            let res;
            try { res = await L.fetchListPage(sec, p, 1, { proxy: viaProxy }); }
            catch { errors++; break; }
            if (res.empty) break;
            const rows = res.adverts.map((a) => L.parseAdvert(a, sec.path, res.dates)).filter((o) => o.id);
            const outs = await db.saveListAdverts(rows, sweepNo);
            let newHere = 0;
            for (const o of outs) { if (o.added) newHere++; if (o.bump) bumped++; if (o.price) priceChanged++; }
            pages++; r.pages++; adverts += rows.length; added += newHere; r.added += newHere;
            if (!newHere && p >= minPages) break; // нового нет и минимум прочитан — глубже только известное
          }
          parts.push(r);
        }
        for (let i = 0; i < L.SECTIONS.length; i += 3) {
          await Promise.all(L.SECTIONS.slice(i, i + 3).map(onePart));
        }
        freshRunning = false;
        send(200, {
          ok: true, seconds: Math.round((Date.now() - t0) / 100) / 10,
          depth: depth, minPages: minPages, dbLoad: load,
          pages: pages, adverts: adverts, added: added, bumped: bumped, priceChanged: priceChanged, errors: errors,
          parts: parts,
        });
      })().catch((e) => {
        freshRunning = false;
        send(500, { ok: false, error: String(e.message).slice(0, 200) });
      });
      return;
    }

    // Альтернатива скану: обход по списку карты Крыши (JSON, без прокси).
    // Каждый вызов проходит столько страниц, сколько влезает в бюджет, и
    // запоминает, где остановился (раздел, страница); пройдя все разделы,
    // начинает новый круг. ?compare=1 — сравнение со сканом по id: кто раньше
    // увидел объявление и кого сколько не хватает.
    if (urlPath === "/api/krisha/scanlist") {
      const send = (code, obj) => {
        res.writeHead(code, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
        res.end(JSON.stringify(obj, null, 2));
      };
      const want = KRISHA_JOB_KEY || KRISHA_PHONE_KEY;
      if (!want || parsed.searchParams.get("key") !== want) return send(403, { ok: false, error: "bad_key" });
      const q = parsed.searchParams;
      // ?history=<id> — хронология объявления: состояние и события (цены,
      // поднятия, архив) по порядку; на ней строится «мотивация продавца».
      if (q.get("history")) {
        (async () => {
          const h = await db.listHistory(q.get("history").replace(/D/g, ""));
          if (!h.item) return send(404, { ok: false, error: "нет такого объявления в списке" });
          const prices = h.events.filter((e) => e.kind === "price");
          const first = h.events.find((e) => e.kind === "new");
          const startPrice = first && first.new_price != null ? Number(first.new_price) : (prices[0] ? Number(prices[0].old_price) : null);
          const cur = h.item.price == null ? null : Number(h.item.price);
          send(200, {
            ok: true, item: h.item, events: h.events,
            // Сводка: с какой цены начали, где сейчас, сколько снижений/повышений, поднятий.
            summary: {
              startPrice: startPrice, currentPrice: cur,
              changePct: startPrice && cur ? Math.round(1000 * (cur - startPrice) / startPrice) / 10 : null,
              priceCuts: prices.filter((e) => Number(e.new_price) < Number(e.old_price)).length,
              priceRaises: prices.filter((e) => Number(e.new_price) > Number(e.old_price)).length,
              bumps: h.events.filter((e) => e.kind === "bump").length,
              archived: h.events.filter((e) => e.kind === "archived").length,
              daysTracked: h.item.first_seen ? Math.round((Date.now() - new Date(h.item.first_seen).getTime()) / 864e5) : null,
            },
          });
        })().catch((e) => send(500, { ok: false, error: String(e.message).slice(0, 200) }));
        return;
      }
      // ?have=id,id,… — какие из номеров объявлений есть в списке (сверка по id).
      if (q.get("have")) {
        (async () => {
          const ids = String(q.get("have")).split(/[^0-9]+/).filter(Boolean).slice(0, 500);
          const have = await db.knownListIds(ids);
          send(200, { ok: true, asked: ids.length, found: ids.filter((id) => have.has(String(id))).length,
                      missing: ids.filter((id) => !have.has(String(id))) });
        })().catch((e) => send(500, { ok: false, error: String(e.message).slice(0, 200) }));
        return;
      }
      if (q.get("compare") === "1" || q.get("stats") === "1") {
        (async () => {
          send(200, { ok: true, list: await db.listStats(), compare: await db.listCompare(), cursor: KW.list || null });
        })().catch((e) => send(500, { ok: false, error: String(e.message).slice(0, 200) }));
        return;
      }
      if (listRunning) return send(409, { ok: false, running: true, error: "обход списка уже идёт", cursor: KW.list || null });
      const budgetMs = Math.max(5, Math.min(600, Number(q.get("budgetSec") || 45))) * 1000;
      const pace = Math.max(0, Math.min(5000, Number(q.get("pace") || 200)));
      const maxPages = Math.max(1, Math.min(5000, Number(q.get("pages") || 400)));
      // Страницы независимы, их можно читать окном разом: ?concurrency=N
      // (по умолчанию 4), ?proxy=1 — окно через пул прокси с разных адресов,
      // если Крыша начнёт отбивать частые прямые запросы.
      // Если прошлый прогон видел медленную базу (страница пишется дольше
      // 1.5 с), стартуем с половины: на 10 DTU обход иначе съедает всё, и
      // очередь плагина с поиском стоят по 15 секунд.
      const concAsked = Math.max(1, Math.min(20, Number(q.get("concurrency") || 4)));
      let conc = KW.list && KW.list.dbSlow ? Math.max(1, Math.floor(concAsked / 2)) : concAsked;
      const viaProxy = q.get("proxy") === "1";
      // Свежее — первым делом: список карты отсортирован по дате поднятия,
      // новое объявление появляется на первой странице своей части в минуту
      // публикации. Читаем по freshPages первых страниц каждой части в начале
      // каждого прогона, независимо от того, где стоит курсор круга.
      // По умолчанию 0: свежее читает отдельный job /api/krisha/fresh, у него
      // своя блокировка и он не пропадает, пока идёт круг.
      const freshPages = Math.max(0, Math.min(5, Number(q.get("freshPages") || 0)));
      const L = require("./scripts/krisha-list.js");
      if (!KW.list || q.get("reset") === "1") {
        KW.list = { section: 0, page: 1, sweepNo: ((KW.list && KW.list.sweepNo) || 0) + 1,
                    startedAt: null, pages: 0, adverts: 0, lastSweep: (KW.list && KW.list.lastSweep) || null };
      }
      listRunning = true;
      (async () => {
        const t0 = Date.now();
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        await L.loadRegions().catch(() => { /* город останется пустым */ });
        const st = KW.list;
        if (!st.startedAt) st.startedAt = new Date().toISOString();
        let pages = 0, adverts = 0, added = 0, priceChanged = 0, archived = 0, back = 0, bumped = 0, cityNull = 0, errors = 0;
        // Перенос фото старых строк в компактный вид — первым делом, пока
        // есть что переносить: идём по id с сохранённого места, каждая пачка
        // возвращает базе место.
        let migrated = 0, migrateLeft = null;
        if (KW.list.photosMigrated !== true) {
          try {
            while (Date.now() - t0 < budgetMs / 3) {
              const m = await db.migrateListPhotos(500, KW.list.migrateAfter || 0);
              migrated += m.done; KW.list.migrateAfter = m.lastId; migrateLeft = "после id " + m.lastId;
              if (m.finished) { KW.list.photosMigrated = true; migrateLeft = "готово"; break; }
            }
          } catch (e) { errors++; migrateLeft = "ошибка: " + String(e.message).slice(0, 100); }
        }
        let sweepDone = null;
        // Конец раздела: следующий; кончились все — круг завершён.
        const nextSection = () => {
          st.section++; st.page = 1;
          if (st.section >= L.SECTIONS.length) {
            sweepDone = { sweepNo: st.sweepNo, pages: st.pages, adverts: st.adverts,
                          startedAt: st.startedAt, finishedAt: new Date().toISOString(),
                          minutes: Math.round((Date.now() - Date.parse(st.startedAt)) / 60e3) };
            st.section = 0; st.sweepNo++; st.startedAt = null; st.pages = 0; st.adverts = 0;
            return true;
          }
          return false;
        };
        // Самозащита от перегруза базы — по её собственным счётчикам, а не по
        // времени записи: на 10 DTU MERGE пишется быстро, но съедает весь
        // процессор, и очередь плагина с поиском не получают своей доли.
        // Выше 85% — один поток и пауза 1.5 с; выше 70% — два потока и 0.5 с;
        // ниже 50% — снимаем ограничение. Проверяем каждые 20 страниц.
        let storeMs = 0, storeN = 0, throttled = 0, pageGap = pace, lastLoad = null;
        async function checkDbSpeed(force) {
          if (!force && storeN < 20) return;
          storeMs = 0; storeN = 0;
          const l = await db.dbLoad().catch(() => null);
          if (!l) return;
          lastLoad = l;
          const hot = Math.max(l.cpu, l.io, l.log);
          if (hot > 85) { if (conc !== 1 || pageGap < 1500) throttled++; conc = 1; pageGap = Math.max(pace, 1500); KW.list.dbSlow = true; }
          else if (hot > 70) { if (conc > 2) throttled++; conc = Math.min(conc, 2); pageGap = Math.max(pace, 500); KW.list.dbSlow = true; }
          else if (hot < 50) { KW.list.dbSlow = false; }
        }
        await checkDbSpeed(true);
        // Записать страницу одним запросом (см. saveListAdverts).
        async function store(res, section) {
          const rows = res.adverts.map((a) => L.parseAdvert(a, section.path, res.dates)).filter((o) => o.id);
          const t1 = Date.now();
          const outs = await db.saveListAdverts(rows, st.sweepNo);
          storeMs += Date.now() - t1; storeN++;
          for (let k = 0; k < rows.length; k++) {
            const o = rows[k], r = outs[k] || {};
            if (!o.city) cityNull++;
            adverts++; st.adverts++;
            if (r.added) added++;
            if (r.price) priceChanged++;
            if (r.archived) archived++;
            if (r.back) back++;
            if (r.bump) bumped++;
          }
        }
        // 0. Свежее со всех частей: страницы 1..freshPages, разом, напрямую.
        let freshPagesRead = 0, freshAdverts = 0, freshAdded = 0;
        if (freshPages) {
          const jobs = [];
          for (const sec of L.SECTIONS) for (let p = 1; p <= freshPages; p++) jobs.push({ sec, p });
          const got = await Promise.all(jobs.map((j) =>
            L.fetchListPage(j.sec, j.p, 1, { proxy: viaProxy }).then((r) => ({ ok: true, r, sec: j.sec })).catch(() => ({ ok: false }))));
          const before = added;
          for (const g of got) {
            if (!g.ok || g.r.empty) continue;
            freshPagesRead++; freshAdverts += g.r.adverts.length;
            await store(g.r, g.sec);
          }
          freshAdded = added - before;
        }

        outer:
        while (pages < maxPages && Date.now() - t0 < budgetMs) {
          if (st.section >= L.SECTIONS.length) st.section = 0; // список частей мог измениться
          const section = L.SECTIONS[st.section];
          // Окно страниц разом; разбираем по порядку до первой пустой или сбойной:
          // всё после неё в этом окне не считается, курсор встаёт на неё.
          const win = [];
          for (let k = 0; k < conc && pages + k < maxPages; k++) win.push(st.page + k);
          const got = await Promise.all(win.map((p) =>
            L.fetchListPage(section, p, 2, { proxy: viaProxy }).then((r) => ({ ok: true, r })).catch((e) => ({ ok: false, e }))));
          let ended = false;
          for (let k = 0; k < win.length; k++) {
            const g = got[k];
            if (!g.ok) { errors++; break; }            // с этой страницы продолжит следующий вызов
            pages++; st.pages++;
            if (g.r.empty) { ended = true; break; }
            await store(g.r, section);
            st.page = win[k] + 1;
          }
          if (ended) { if (nextSection()) break outer; continue; }
          if (errors >= 3) break;
          await checkDbSpeed(false);
          if (pageGap) await sleep(pageGap);
        }
        if (sweepDone) st.lastSweep = sweepDone;
        KW.list = st;
        saveKrisha();
        listRunning = false;
        send(200, {
          ok: true, seconds: Math.round((Date.now() - t0) / 100) / 10,
          pages: pages, adverts: adverts, added: added, priceChanged: priceChanged,
          archived: archived, back: back, bumped: bumped, cityNull: cityNull, errors: errors,
          // Свежее: сколько первых страниц прочитали, сколько объявлений, сколько из них новых для базы.
          fresh: { pages: freshPagesRead, adverts: freshAdverts, added: freshAdded },
          photosMigrated: migrated, photosLeft: migrateLeft,
          concurrency: conc, concurrencyAsked: concAsked, throttled: throttled, dbSlow: !!KW.list.dbSlow, dbLoad: lastLoad, proxy: viaProxy,
          cursor: { section: (L.SECTIONS[st.section] || L.SECTIONS[0]).label, page: st.page, sweepNo: st.sweepNo,
                    pagesThisSweep: st.pages, advertsThisSweep: st.adverts, startedAt: st.startedAt },
          lastSweep: st.lastSweep || null,
        });
      })().catch((e) => {
        listRunning = false;
        send(500, { ok: false, error: String(e.message).slice(0, 200) });
      });
      return;
    }

    if (urlPath === "/api/krisha/scan") {
      const send = (code, obj) => {
        res.writeHead(code, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
        res.end(JSON.stringify(obj, null, 2));
      };
      const want = KRISHA_JOB_KEY || KRISHA_PHONE_KEY;
      if (!want || parsed.searchParams.get("key") !== want) return send(403, { ok: false, error: "bad_key" });
      if (scanRunning) return send(409, { ok: false, running: true, error: "скан уже идёт" });
      const KL = require("./scripts/krisha-lib.js");
      if (!KL.viaProxy()) return send(409, { ok: false, error: KL.proxyHint() });
      const batch = Math.max(1, Math.min(500, Number(parsed.searchParams.get("batch")) || 120));
      const concParam = Math.max(0, Math.min(30, Number(parsed.searchParams.get("concurrency")) || 0));
      const retries = Math.max(1, Math.min(8, Number(parsed.searchParams.get("retries")) || 5));
      const gapTtlMs = Math.max(0, Number(parsed.searchParams.get("gapTtlMin") || KRISHA_SCAN_GAP_TTL_MIN)) * 60e3;
      const retryPerRun = Math.max(0, Math.min(200, Number(parsed.searchParams.get("retryPerRun") || 20)));
      const budgetMs = Math.max(5, Math.min(600, Number(parsed.searchParams.get("budgetSec") || KRISHA_SCAN_BUDGET_SEC))) * 1000;
      const useFeed = parsed.searchParams.get("feed") !== "0";
      KW.scan = KW.scan || {};
      KW.scan.retry = KW.scan.retry || {};
      scanRunning = true;
      (async () => {
        const t0 = Date.now();
        // Бюджет времени: что не успели — возьмёт следующий прогон. Курсор от
        // этого не страдает: он двигается только по прочитанному.
        let budgetHit = false;
        const overBudget = () => { if (Date.now() - t0 > budgetMs) budgetHit = true; return budgetHit; };
        const Scan = require("./scripts/krisha-scan.js");
        // ?rotateProxies=1 — сменить пул входов (и добрать до KRISHA_PROXY_WANT)
        // прямо здесь, не запуская deepen ради этого.
        if (parsed.searchParams.get("rotateProxies") === "1") {
          try { await KL.rotateProxies(); } catch { /* останется прежний пул */ }
        }
        // Стартовый курсор: заданный вручную, сохранённый ранее, иначе самый
        // большой известный id (дальше него объявлений ещё нет).
        const override = Number(parsed.searchParams.get("cursor"));
        // Number(): курсор из maxKnownId/сохранения может быть строкой (BIGINT),
        // и тогда cursor + k склеил бы строки вместо арифметики.
        let cursor = Number(override || KW.scan.cursor || (await db.maxKnownId()) || 0);
        // Режим — по факту прошлого прогона: упёрся в серию 404 (фронтир) —
        // стоим у свежего края, новых 12 в минуту, читаем по 2, чтобы не
        // будить защиту; не упёрся — догоняем, читаем по 8. ?concurrency= —
        // руками, для разового опыта.
        const atFrontier = !!KW.scan.lastHitFrontier;
        const conc = concParam || (atFrontier ? 2 : 8);
        const ids = [];
        for (let id = cursor + 1; id <= cursor + batch; id++) ids.push(id);

        // --- Список на повтор: то, что курсор перешагнул, не прочитав. -------
        // Курсор всегда идёт вперёд, к свежему; а этот список возвращает нас к
        // пропущенному. Живёт в KW.scan.retry и переживает перезапуск.
        //  fail — 468/таймаут: через 1, 5, 15 и 60 минут, потом сдаёмся;
        //  gap  — 404 ниже курсора: id выдан, объявление либо ещё на модерации,
        //         либо удалено — через 5 и 15 минут, час и 6 часов, потом
        //         считаем удалённым. Первые шаги короткие: модерация чаще
        //         всего занимает минуты, и объявление должно попасть к нам
        //         сразу после неё (выдача ниже ловит это ещё раньше).
        const RETRY_PLAN = { fail: [1, 5, 15, 60], gap: [5, 15, 60, 360] };
        const retry = KW.scan.retry;
        // Записать следующую попытку; false — попытки кончились, запись снята.
        const schedule = (id, kind, tries) => {
          const plan = RETRY_PLAN[kind];
          if (tries >= plan.length) { delete retry[id]; return false; }
          retry[id] = { kind: kind, tries: tries, next: new Date(Date.now() + plan[tries] * 60e3).toISOString() };
          return true;
        };
        const nowTs = Date.now();
        const due = Object.keys(retry)
          .filter((id) => Date.parse(retry[id].next) <= nowTs)
          .sort((a, b) => Date.parse(retry[a].next) - Date.parse(retry[b].next))
          .slice(0, retryPerRun)
          .map(Number);

        let saved = 0, gaps = 0, gapsCached = 0, unresolved = 0, notListing = 0, knownSkipped = 0;
        let maxLive = cursor, scannedTo = cursor;
        let retried = 0, retryLive = 0, retryDropped = 0;
        let feedCards = 0, feedNew = 0, feedBelow = 0, feedSaved = 0, feedFailed = 0, feedOldTaken = 0;
        let rotated = 0, unresolvedStreak = 0;
        const feedSections = {};
        const byDeal = {}, bySeller = {};
        // Фронтир — это подряд идущие ПОДТВЕРЖДЁННЫЕ 404 (дальше объявлений ещё
        // нет). Останавливаемся только на такой серии, чтобы не жечь прокси на
        // пустоте. 468 — это «не смогли прочитать», а не «нет объявления»:
        // серию не обрывает и не двигает, иначе throttle-всплеск у любого
        // разрежённого участка застопорил бы курсор. Порог больше обычного
        // разрыва в середине потока (там до ~15 подряд 404).
        const FRONTIER_GAP = Math.max(40, conc * 4);
        // Прочитать один id. Исход: 'live' | 'gap'(404) | 'unresolved'(468/сеть) | 'skip'.
        // noCursor — прочитанное вне порядка (выдача) курсор не двигает: иначе
        // id между курсором и этим объявлением остались бы непрочитанными.
        async function probe(id, opts) {
          try {
            const html = await KL.fetchText("https://krisha.kz/a/show/" + id, retries, 15000, { proxy: true });
            const obj = Scan.parse(id, html);
            if (!obj) { notListing++; return "skip"; }
            await db.saveObject(obj);
            saved++;
            if (!(opts && opts.noCursor) && id > maxLive) maxLive = id;
            byDeal[obj.deal || "?"] = (byDeal[obj.deal || "?"] || 0) + 1;
            bySeller[obj.userType || "?"] = (bySeller[obj.userType || "?"] || 0) + 1;
            return "live";
          } catch (e) {
            if (e && (e.status === 404 || e.status === 410)) return "gap";
            return "unresolved";
          }
        }
        // Новый id по порядку: недавно подтверждённый 404 не переспрашиваем.
        async function handle(id) {
          const seenAt = scanGap404.get(id);
          if (seenAt && Date.now() - seenAt < gapTtlMs) { gapsCached++; return "gap"; }
          const out = await probe(id);
          if (out === "gap") { gaps++; scanGap404.set(id, Date.now()); }
          else if (out === "unresolved") unresolved++;
          return out;
        }
        // Повтор из списка: живое — сняли с повтора; 404 — ждём как «ещё не
        // вышло» (сбойный id, оказавшийся 404, переходит в план gap с нуля);
        // снова сбой — следующая ступень плана.
        async function handleRetry(id) {
          const r = retry[id] || { kind: "fail", tries: 0 };
          retried++;
          const out = await probe(id, { noCursor: true });
          if (out === "live" || out === "skip") { delete retry[id]; if (out === "live") retryLive++; }
          else if (out === "gap") { if (!schedule(id, "gap", r.kind === "gap" ? r.tries + 1 : 0)) retryDropped++; }
          else if (!schedule(id, "fail", r.kind === "fail" ? r.tries + 1 : 0)) retryDropped++;
          return out;
        }
        // Из выдачи: чего нет в базе — читаем вперёд всех, курсор не трогаем.
        async function handleFeed(id) {
          const out = await probe(id, { noCursor: true });
          if (out === "live") feedSaved++;
          else if (out === "unresolved") { feedFailed++; if (!retry[id]) schedule(id, "fail", 0); }
          else if (out === "gap" && !retry[id]) schedule(id, "gap", 0);
          return out;
        }
        // Серия отказов подряд — сменить IP у входов. Между сменами не меньше
        // двух минут и не больше трёх за прогон: Asocks выдаёт новый адрес не
        // мгновенно, и частая смена только сбивает пул. Между окнами ничего
        // не в полёте, так что смена никого не обрывает.
        async function maybeRotate(outs) {
          for (const o of outs) unresolvedStreak = o === "unresolved" ? unresolvedStreak + 1 : 0;
          if (unresolvedStreak < KRISHA_SCAN_ROTATE_STREAK || rotated >= 3) return;
          const last = Date.parse(KW.scan.lastRotateAt || 0);
          if (last && Date.now() - last < 120e3) return;
          try {
            await KL.rotateProxies();
            rotated++;
            KW.scan.lastRotateAt = new Date().toISOString();
          } catch { /* останется прежний пул */ }
          unresolvedStreak = 0;
        }
        // Память о 404 не растёт бесконечно: всё старше срока — вон.
        for (const [id, at] of scanGap404) if (Date.now() - at >= gapTtlMs) scanGap404.delete(id);

        // 1. Выдача: первые страницы разделов, напрямую, без прокси. Всё, чего
        //    нет в базе, — в первую очередь: это и есть только что
        //    опубликованное, включая вышедшее из модерации с id ниже курсора.
        let feedIds = [];
        if (useFeed) {
          try {
            const feed = await KL.newestFromSearch();
            feedCards = feed.ids.length;
            Object.assign(feedSections, feed.sections);
            const known = await db.knownObjectIds(feed.ids);
            const inBatch = new Set(ids);
            feedIds = feed.ids.filter((id) => !known.has(String(id)) && !inBatch.has(id));
            feedNew = feedIds.length;
            feedBelow = feedIds.filter((id) => id <= cursor).length;
          } catch (e) { feedSections.error = String(e.message).slice(0, 120); }
        }
        // Свежие (id рядом с курсором — только что опубликованные, в том числе
        // вышедшие из модерации) — сейчас; старые поднятия — в самом конце.
        const feedRecent = feedIds.filter((id) => id > cursor - KRISHA_SCAN_RECENT);
        const feedOld = feedIds.filter((id) => id <= cursor - KRISHA_SCAN_RECENT);
        for (let i = 0; i < feedRecent.length && !overBudget(); i += conc) {
          await maybeRotate(await Promise.all(feedRecent.slice(i, i + conc).map(handleFeed)));
        }
        // 2. Повторы (они старше новых).
        for (let i = 0; i < due.length && !overBudget(); i += conc) {
          await maybeRotate(await Promise.all(due.slice(i, i + conc).map(handleRetry)));
        }
        // 3. Новые id по порядку, окнами по conc (порядок нужен для серии 404).
        //    Что уже в базе (пришло через выдачу), не перечитываем, но курсор
        //    через него проводим как через живое.
        const outcome = new Map();
        let gap404Streak = 0, hitFrontier = false;
        outer:
        for (let i = 0; i < ids.length; i += conc) {
          if (overBudget()) break;
          const win = ids.slice(i, i + conc);
          const known = await db.knownObjectIds(win).catch(() => new Set());
          const out = await Promise.all(win.map((id) => {
            if (known.has(String(id))) { knownSkipped++; if (id > maxLive) maxLive = id; return "known"; }
            return handle(id);
          }));
          await maybeRotate(out);
          for (let k = 0; k < win.length; k++) {
            scannedTo = win[k];
            outcome.set(win[k], out[k]);
            if (out[k] === "gap") {
              if (++gap404Streak >= FRONTIER_GAP) { hitFrontier = true; break outer; } // прошли фронтир
            } else {
              gap404Streak = 0; // живое, 468 или не-объявление — серия прервана
            }
          }
        }

        // 4. Старые поднятия из выдачи — понемногу, на остаток бюджета. Это
        //    активные объявления, их стоит иметь, но они не срочные.
        const oldSlice = feedOld.slice(0, KRISHA_SCAN_OLD_PER_RUN);
        for (let i = 0; i < oldSlice.length && !overBudget(); i += conc) {
          const part = oldSlice.slice(i, i + conc);
          feedOldTaken += part.length;
          await maybeRotate(await Promise.all(part.map(handleFeed)));
        }

        // Что курсор перешагнул, не прочитав, — в список на повтор. Выше нового
        // курсора ничего не пишем: туда следующий прогон придёт сам.
        let queued = 0;
        for (const [id, out] of outcome) {
          if (id >= maxLive || retry[id]) continue;
          if (out === "unresolved") { schedule(id, "fail", 0); queued++; }
          else if (out === "gap") { schedule(id, "gap", 0); queued++; }
        }
        // Предохранитель на размер: список не должен расти без предела.
        // 20 000 записей — это дни притока даже при худшем проценте отказов;
        // ниже этого ничего не теряем.
        const keys = Object.keys(retry);
        if (keys.length > 20000) {
          keys.sort((a, b) => Date.parse(retry[b].next) - Date.parse(retry[a].next))
            .slice(20000).forEach((id) => { delete retry[id]; });
        }

        // Курсор двигаем только до самого большого живого id — у фронтира он
        // стоит и ждёт новых. Большой мёртвый провал (редко) виден по
        // advanced=0 при saved=0; тогда оператор перескакивает вручную ?cursor=.
        const advanced = maxLive > cursor;
        if (advanced) KW.scan.cursor = maxLive;
        KW.scan.savedTotal = (KW.scan.savedTotal || 0) + saved;
        KW.scan.lastRun = new Date().toISOString();
        KW.scan.lastHitFrontier = hitFrontier;
        saveKrisha();

        scanRunning = false;
        send(200, {
          ok: true,
          seconds: Math.round((Date.now() - t0) / 100) / 10, budgetHit: budgetHit,
          mode: atFrontier ? "frontier" : "catchup", concurrency: conc,
          scannedTo: scannedTo, hitFrontier: hitFrontier,
          saved: saved, gaps404: gaps, gaps404Cached: gapsCached, unresolved468: unresolved,
          notListing: notListing, knownSkipped: knownSkipped, rotated: rotated,
          byDeal: byDeal, bySeller: bySeller,
          cursor: KW.scan.cursor, advanced: KW.scan.cursor - cursor,
          savedTotal: KW.scan.savedTotal,
          // Выдача: сколько карточек прочитали, сколько из них не было в базе,
          // сколько из новых ниже курсора (вышли из модерации позже), итог.
          feed: { cards: feedCards, "new": feedNew, recent: feedRecent.length, old: feedOld.length,
                  oldTaken: feedOldTaken, belowCursor: feedBelow, saved: feedSaved,
                  failed: feedFailed, sections: feedSections },
          // Список на повтор: сколько было к сроку, сколько перечитали, сколько
          // из них ожило, сколько сняли по исчерпании, сколько добавили, сколько ждёт.
          retry: { due: due.length, retried: retried, live: retryLive, dropped: retryDropped,
                   queued: queued, pending: Object.keys(retry).length },
        });
      })().catch((e) => {
        scanRunning = false;
        send(500, { ok: false, error: String(e.message).slice(0, 200) });
      });
      return;
    }

    // Замер эффективности: по свежим агентским объявлениям, которые ещё не
    // искали, запускаем поиск оригинала-хозяина (findObjects), записываем
    // исход и находки скидываем в мониторинг-чат. Со временем видно, как
    // растёт доля агентских, у которых нашёлся хозяин. Дёргается Hangfire
    // после скана. Только база — быстро, отвечает синхронно.
    // Поиск хозяина по списку карты: агентские без searched_at, кандидаты —
    // хозяева среди всех наших, включая архив (хозяин прячет объявление по
    // просьбе агента — и найти его можно только у себя; сама архивация
    // признаком не считается). Дом по ЖК/координатам, квартира по
    // комнатам/этажу/площади, потом фото из photos_json.
    // ?stats=1 — итоги без запуска.
    if (urlPath === "/api/krisha/matchlist") {
      const send = (code, obj) => {
        res.writeHead(code, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
        res.end(JSON.stringify(obj, null, 2));
      };
      const want = KRISHA_JOB_KEY || KRISHA_PHONE_KEY;
      if (!want || parsed.searchParams.get("key") !== want) return send(403, { ok: false, error: "bad_key" });
      if (parsed.searchParams.get("stats") === "1") {
        (async () => send(200, { ok: true, stats: await db.listMatchStats() }))()
          .catch((e) => send(500, { ok: false, error: String(e.message).slice(0, 200) }));
        return;
      }
      if (matchListRunning) return send(409, { ok: false, running: true, error: "поиск по списку уже идёт" });
      const batch = Math.max(1, Math.min(1000, Number(parsed.searchParams.get("batch")) || 200));
      const notify = parsed.searchParams.get("notify") !== "0";
      // Через сколько дней перепроверять агентские без находок (KRISHA_RESEARCH_DAYS).
      const researchDays = Math.max(1, Number(parsed.searchParams.get("researchDays") || process.env.KRISHA_RESEARCH_DAYS || 3));
      matchListRunning = true;
      (async () => {
        const show = (id) => "https://krisha.kz/a/show/" + id;
        const floorText = (x) => x.floor && x.floors ? x.floor + "/" + x.floors
          : x.floor ? x.floor + " эт." : x.floors ? "дом " + x.floors + " эт." : null;
        const label = (x) => [x.city, x.rooms ? x.rooms + "к" : null, x.area ? x.area + "м²" : null,
          floorText(x), x.addr].filter(Boolean).join(" · ");
        const pad2 = (n) => String(n).padStart(2, "0");
        const dm = (v) => { const d = v ? new Date(v) : null; return d && !isNaN(d) ? pad2(d.getUTCDate()) + "." + pad2(d.getUTCMonth() + 1) : null; };
        const dmT = (v) => {
          const d = v ? new Date(new Date(v).getTime() + 5 * 3600e3) : null;
          return d && !isNaN(d) ? dm(d) + " " + pad2(d.getUTCHours()) + ":" + pad2(d.getUTCMinutes()) : null;
        };
        const dates = (x) => {
          const p = [];
          if (dm(x.bumped_on)) p.push("поднято " + dm(x.bumped_on));
          if (dmT(x.first_seen)) p.push("в базе с " + dmT(x.first_seen));
          if (x.phones) p.push("номер есть");
          return p.length ? "📅 " + p.join(" · ") : null;
        };
        const PhotoMatch = require("./scripts/photo-match.js");
        const agents = await db.agentsToMatchList(batch, researchDays);
        let searched = 0, matched = 0, photoConfirmed = 0, archivedOwners = 0, researched = 0, researchedFound = 0;
        const finds = [];
        for (const a of agents) {
          const q = {
            deal: a.deal, prop: a.prop, area: a.area, rooms: a.rooms, floor: a.floor, floors: a.floors,
            complexId: a.complex_id, lat: a.lat, lon: a.lon, id: a.id,
          };
          let hits = [];
          try { hits = await db.findListOwners(q, 6); } catch { /* пропустим */ }
          await db.recordListSearched(a.id, hits.length, hits[0] ? hits[0].id : null).catch(() => {});
          searched++;
          if (a.research) { researched++; if (hits.length) researchedFound++; }
          if (!hits.length) continue;
          matched++;
          let scores = {};
          if (PhotoMatch.available()) {
            try {
              const agentPhotos = db.listPhotoUrls(a.photos_c, a.photos_json);
              if (agentPhotos.length) {
                const cands = hits.map((h) => ({ id: String(h.id), photos: db.listPhotoUrls(h.photos_c, h.photos_json) }));
                scores = await PhotoMatch.scoreCandidates(agentPhotos, cands);
              }
            } catch { /* фото — уточнение, находка и так записана */ }
          }
          const cand = [];
          let anyPhoto = false;
          for (const h of hits) {
            const sc = scores[String(h.id)];
            if (sc && sc.match && sc.confidence >= 0.7) anyPhoto = true;
            if (h.archived_at) archivedOwners++;
            await db.logListMatch({
              agentId: a.id, ownerId: h.id, paramScore: h.score, archivedAt: h.archived_at || null,
              photoMatch: sc ? sc.match : null, photoConf: sc ? sc.confidence : null, photoWhy: sc ? sc.why : null,
            }).catch(() => {});
            cand.push({ h: h, s: sc });
          }
          if (anyPhoto) photoConfirmed++;
          finds.push({ a: a, cand: cand });
        }

        if (finds.length && notify) {
          const esc = (t) => require("./scripts/krisha-bot.js").esc(String(t == null ? "" : t));
          const photoOk = (c) => !!(c.s && c.s.match && c.s.confidence >= 0.7);
          const photoText = (c) => !c.s ? "фото не проверить" : photoOk(c) ? "фото совпали " + c.s.confidence : "фото не совпали";
          const verdict = (c) => "score " + c.h.score + " · " + photoText(c);
          const lines = [];
          finds.slice(0, 8).forEach((f, n) => {
            const best = f.cand[0];
            if (n) lines.push("");
            lines.push("🎯 <b>Совпадение по списку</b>" + (best ? " (" + verdict(best) + ")" : ""), "");
            lines.push("🏢 От агента: " + esc(label(f.a)));
            if (dates(f.a)) lines.push(dates(f.a));
            lines.push(show(f.a.id));
            f.cand.slice(0, 4).forEach((c, k) => {
              const mark = !c.s ? "➖" : photoOk(c) ? "✅" : "❌";
              lines.push(mark + " От собственника: " + esc(label(c.h)) + (k ? " (" + verdict(c) + ")" : ""));
              if (dates(c.h)) lines.push(dates(c.h));
              lines.push(show(c.h.id));
            });
          });
          const dashKey = encodeURIComponent(KRISHA_JOB_KEY || KRISHA_PHONE_KEY);
          lines.push("", "",
            '<a href="' + CANONICAL + "/api/krisha/listmonitor?key=" + dashKey + '">все совпадения</a>' +
            " · " +
            '<a href="' + CANONICAL + "/api/krisha/liststats?key=" + dashKey + '">статистика</a>');
          notifyTelegram(lines.join("\n"));
        }

        const st = await db.listMatchStats().catch(() => null);
        matchListRunning = false;
        send(200, {
          ok: true, searched: searched, matched: matched, photoConfirmed: photoConfirmed,
          ownerArchived: archivedOwners,
          // Перепроверка старых без находок: сколько взяли и у скольких теперь нашлись кандидаты.
          researched: researched, researchedFound: researchedFound,
          finds: finds.map((f) => ({
            agent: f.a.id,
            owners: f.cand.map((c) => ({
              id: c.h.id, score: c.h.score, archivedAt: c.h.archived_at || null, hasPhone: !!c.h.phones,
              photoMatch: c.s ? c.s.match : null, photoConf: c.s ? c.s.confidence : null,
            })),
          })),
          stats: st,
        });
      })().catch((e) => {
        matchListRunning = false;
        send(500, { ok: false, error: String(e.message).slice(0, 200) });
      });
      return;
    }

    if (urlPath === "/api/krisha/match") {
      const send = (code, obj) => {
        res.writeHead(code, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
        res.end(JSON.stringify(obj, null, 2));
      };
      const want = KRISHA_JOB_KEY || KRISHA_PHONE_KEY;
      if (!want || parsed.searchParams.get("key") !== want) return send(403, { ok: false, error: "bad_key" });
      if (matchRunning) return send(409, { ok: false, running: true, error: "поиск уже идёт" });
      const batch = Math.max(1, Math.min(1000, Number(parsed.searchParams.get("batch")) || 200));
      matchRunning = true;
      (async () => {
        const show = (id) => "https://krisha.kz/a/show/" + id;
        const floorText = (x) => x.floor && x.floors ? x.floor + "/" + x.floors
          : x.floor ? x.floor + " эт." : x.floors ? "дом " + x.floors + " эт." : null;
        const label = (x) => [x.city, x.rooms ? x.rooms + "к" : null, x.area ? x.area + "м²" : null,
          floorText(x), x.district].filter(Boolean).join(" · ");
        // Даты: создано и поднято — дни с Крыши (DATE, tedious отдаёт полночь
        // UTC, поэтому берём UTC-компоненты); «в базе с» — first_seen, UTC в
        // базе, показываем по Алматы (+5).
        const pad2 = (n) => String(n).padStart(2, "0");
        const dm = (v) => { const d = v ? new Date(v) : null; return d && !isNaN(d) ? pad2(d.getUTCDate()) + "." + pad2(d.getUTCMonth() + 1) : null; };
        const dmT = (v) => {
          const d = v ? new Date(new Date(v).getTime() + 5 * 3600e3) : null;
          return d && !isNaN(d) ? dm(d) + " " + pad2(d.getUTCHours()) + ":" + pad2(d.getUTCMinutes()) : null;
        };
        const dates = (x) => {
          const p = [];
          if (dm(x.created_on)) p.push("создано " + dm(x.created_on));
          if (dm(x.added_on)) p.push("поднято " + dm(x.added_on));
          if (dmT(x.first_seen)) p.push("в базе с " + dmT(x.first_seen));
          return p.length ? "📅 " + p.join(" · ") : null;
        };
        const PhotoMatch = require("./scripts/photo-match.js");
        const agents = await db.agentsToMatch(batch);
        let searched = 0, matched = 0, photoConfirmed = 0;
        const finds = [];
        for (const a of agents) {
          const q = {
            deal: a.deal, prop: a.prop, city: a.city, area: a.area, rooms: a.rooms,
            floor: a.floor, floors: a.floors, complexId: a.complex_id, district: a.district,
            streetSlug: a.street_slug, houseNum: a.house_num, lat: a.lat, lon: a.lon,
            buildYear: a.build_year, house: a.house, toilet: a.toilet, id: a.id,
          };
          let hits = [];
          try { hits = await db.findObjects(q, 6); } catch { /* пропустим */ }
          await db.recordSearched(a.id, hits.length, hits[0] ? hits[0].id : null).catch(() => {});
          searched++;
          if (!hits.length) continue;
          matched++;

          // Нашли по параметрам — сразу сверяем по фото (Gemini). Дорого только
          // на самих находках, а они редки, так что нагрузки почти нет.
          let scores = {};
          if (PhotoMatch.available()) {
            try {
              const agentPhotos = await db.objectPhotos(a.id);
              if (agentPhotos.length) {
                const cands = await Promise.all(hits.map(async (h) =>
                  ({ id: String(h.id), photos: await db.objectPhotos(h.id) })));
                scores = await PhotoMatch.scoreCandidates(agentPhotos, cands);
              }
            } catch { /* фото — уточнение, находка и так записана */ }
          }

          // Каждого кандидата — в журнал (для ручной проверки и статистики).
          const cand = [];
          let anyPhoto = false;
          for (const h of hits) {
            const s = scores[String(h.id)];
            if (s && s.match && s.confidence >= 0.7) anyPhoto = true;
            await db.logMatchCandidate({
              agentId: a.id, ownerId: h.id, deal: a.deal, prop: a.prop, city: a.city,
              paramScore: h.score,
              photoMatch: s ? s.match : null, photoConf: s ? s.confidence : null, photoWhy: s ? s.why : null,
            }).catch(() => {});
            cand.push({ h: h, s: s });
          }
          if (anyPhoto) photoConfirmed++;
          finds.push({ a: a, cand: cand });
        }

        // Находки — в мониторинг-чат с галочками. До 8 на сообщение, без флуда.
        if (finds.length) {
          const esc = (s) => require("./scripts/krisha-bot.js").esc(String(s == null ? "" : s));
          // Формат — как читается в чате: заголовок с оценкой лучшего кандидата,
          // затем «от агента» и «от собственника» со ссылками. Кандидаты идут
          // в порядке findObjects — лучший первым; у остальных оценка своя,
          // поэтому она дописана к строке.
          const photoOk = (c) => !!(c.s && c.s.match && c.s.confidence >= 0.7);
          const photoText = (c) => !c.s ? "фото не проверить" : photoOk(c) ? "фото совпали " + c.s.confidence : "фото не совпали";
          const verdict = (c) => "score " + c.h.score + " · " + photoText(c);
          // Дата поднятия у строк, сохранённых до появления колонки, — из
          // data_gz; находок мало, распаковка дешёвая.
          for (const f of finds.slice(0, 8)) {
            if (!f.a.added_on) f.a.added_on = await db.fillAddedOn(f.a.id).catch(() => null);
            for (const c of f.cand.slice(0, 4)) {
              if (!c.h.added_on) c.h.added_on = await db.fillAddedOn(c.h.id).catch(() => null);
            }
          }
          const lines = [];
          finds.slice(0, 8).forEach((f, n) => {
            const best = f.cand[0];
            if (n) lines.push("");
            lines.push("🎯 <b>Совпадение</b>" + (best ? " (" + verdict(best) + ")" : ""), "");
            lines.push("🏢 От агента: " + esc(label(f.a)));
            if (dates(f.a)) lines.push(dates(f.a));
            lines.push(show(f.a.id));
            f.cand.slice(0, 4).forEach((c, k) => {
              const mark = !c.s ? "➖" : photoOk(c) ? "✅" : "❌";
              lines.push(mark + " От собственника: " + esc(label(c.h)) + (k ? " (" + verdict(c) + ")" : ""));
              if (dates(c.h)) lines.push(dates(c.h));
              lines.push(show(c.h.id));
            });
          });
          // Хвост: куда смотреть дальше. Ключ — тот же, что открывает эти
          // маршруты; в чат админов он и так уходит с каждым отчётом.
          const dashKey = encodeURIComponent(KRISHA_JOB_KEY || KRISHA_PHONE_KEY);
          lines.push("", "",
            '<a href="' + CANONICAL + "/api/krisha/monitor?key=" + dashKey + '">все совпадения</a>' +
            " · " +
            '<a href="' + CANONICAL + "/api/krisha/stats?key=" + dashKey + '">статистика</a>');
          notifyTelegram(lines.join("\n"));
        }

        const st = await db.matchStats().catch(() => null);
        matchRunning = false;
        send(200, {
          ok: true, searched: searched, matched: matched, photoConfirmed: photoConfirmed,
          finds: finds.map((f) => ({
            agent: f.a.id,
            owners: f.cand.map((c) => ({
              id: c.h.id, score: c.h.score,
              photoMatch: c.s ? c.s.match : null, photoConf: c.s ? c.s.confidence : null,
            })),
          })),
          effectiveness: st && st.total ? st.total : null,
        });
      })().catch((e) => {
        matchRunning = false;
        send(500, { ok: false, error: String(e.message).slice(0, 200) });
      });
      return;
    }

    // Внутренний дашборд мониторинга находок: рост успешности по дням + лента
    // находок с фото агента и хозяина рядом и кнопками ручной проверки.
    //  ?key=..            -> HTML-страница
    //  ?key=..&data=1     -> JSON {stats, finds+фото}
    //  ?key=..&set=<id>&ok=<1|0|clear> -> проставить human_ok
    if (urlPath === "/api/krisha/monitor") {
      const q = parsed.searchParams;
      const key = KRISHA_JOB_KEY || KRISHA_PHONE_KEY;
      if (!key || q.get("key") !== key) { res.writeHead(403); res.end("bad key"); return; }

      if (q.get("set")) {
        const okv = q.get("ok");
        (async () => {
          await db.setHumanOk(Number(q.get("set")), okv === "1" ? 1 : okv === "0" ? 0 : null);
          res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
          res.end(JSON.stringify({ ok: true }));
        })().catch((e) => { res.writeHead(500); res.end(String(e.message)); });
        return;
      }

      if (q.get("data")) {
        (async () => {
          const stats = await db.matchStats();
          const rows = await db.matchReviewRows(40);
          const finds = await Promise.all(rows.map(async (r) => Object.assign({}, r, {
            a_photos: (await db.objectPhotos(r.agent_id).catch(() => [])).slice(0, 4),
            o_photos: (await db.objectPhotos(r.owner_id).catch(() => [])).slice(0, 4),
            a_added: r.a_added || (await db.fillAddedOn(r.agent_id).catch(() => null)),
            o_added: r.o_added || (await db.fillAddedOn(r.owner_id).catch(() => null)),
          })));
          res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
          res.end(JSON.stringify({ stats: stats, finds: finds }));
        })().catch((e) => { res.writeHead(500); res.end(String(e.message)); });
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      res.end(KRISHA_MONITOR_HTML);
      return;
    }

    // Дашборд собственника: импорт по дням/периодам, разбивка, конверсия.
    // Кто сколько занимает в базе — когда Azure SQL упирается в квоту.
    if (urlPath === "/api/krisha/dbsize") {
      const key = KRISHA_JOB_KEY || KRISHA_PHONE_KEY;
      if (!key || parsed.searchParams.get("key") !== key) { res.writeHead(403); res.end("bad key"); return; }
      (async () => {
        const d = await db.dbSize();
        res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
        res.end(JSON.stringify(d, null, 2));
      })().catch((e) => { res.writeHead(500); res.end(String(e.message)); });
      return;
    }

    // Те же страницы поверх списка карты. Старые остаются как были.
    if (urlPath === "/api/krisha/liststats") {
      const q = parsed.searchParams;
      const key = KRISHA_JOB_KEY || KRISHA_PHONE_KEY;
      if (!key || q.get("key") !== key) { res.writeHead(403); res.end("bad key"); return; }
      if (q.get("data")) {
        (async () => {
          // Шесть запросов по дням на 10 DTU — десятки секунд; держим минуту.
          if (!listDashCache.body || Date.now() - listDashCache.at > 60e3) {
            listDashCache.body = JSON.stringify(await db.listDashboard(60));
            listDashCache.at = Date.now();
          }
          res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
          res.end(listDashCache.body);
        })().catch((e) => { res.writeHead(500); res.end(String(e.message)); });
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      res.end(KRISHA_LIST_STATS_HTML);
      return;
    }

    if (urlPath === "/api/krisha/listmonitor") {
      const q = parsed.searchParams;
      const key = KRISHA_JOB_KEY || KRISHA_PHONE_KEY;
      if (!key || q.get("key") !== key) { res.writeHead(403); res.end("bad key"); return; }
      if (q.get("set")) {
        const okv = q.get("ok");
        (async () => {
          await db.setListHumanOk(Number(q.get("set")), okv === "1" ? 1 : okv === "0" ? 0 : null);
          res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
          res.end(JSON.stringify({ ok: true }));
        })().catch((e) => { res.writeHead(500); res.end(String(e.message)); });
        return;
      }
      if (q.get("data")) {
        (async () => {
          const stats = await db.listMatchStats();
          const rows = await db.listMatchReviewRows(40);
          const finds = rows.map((r) => {
            const x = Object.assign({}, r, {
              a_photos: db.listPhotoUrls(r.a_pc, r.a_pj).slice(0, 4),
              o_photos: db.listPhotoUrls(r.o_pc, r.o_pj).slice(0, 4),
            });
            delete x.a_pj; delete x.o_pj; delete x.a_pc; delete x.o_pc;
            return x;
          });
          // Форма stats — как у старой страницы: total.searched/matched + byDay.
          const byDay = (await db.listDashboard(30).catch(() => ({ searched: [] }))).searched;
          res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
          res.end(JSON.stringify({ stats: { total: stats.total, byDay: byDay }, finds: finds }));
        })().catch((e) => { res.writeHead(500); res.end(String(e.message)); });
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      res.end(KRISHA_LIST_MONITOR_HTML);
      return;
    }

    if (urlPath === "/api/krisha/stats") {
      const q = parsed.searchParams;
      const key = KRISHA_JOB_KEY || KRISHA_PHONE_KEY;
      if (!key || q.get("key") !== key) { res.writeHead(403); res.end("bad key"); return; }
      if (q.get("data")) {
        (async () => {
          const d = await db.ownerDashboard(60);
          res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
          res.end(JSON.stringify(d));
        })().catch((e) => { res.writeHead(500); res.end(String(e.message)); });
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      res.end(KRISHA_STATS_HTML);
      return;
    }

    // Узнать свою квартиру в объявлении агента. Покупатель присылает ссылку —
    // разбираем её тем же кодом, которым снимаем свои, и ищем по параметрам.
    // Без ссылки принимаем площадь с этажом руками: со скриншота их вбить
    // быстрее, чем искать глазами.
    if (urlPath === "/api/krisha/find" || urlPath === "/api/krisha/base" ||
        urlPath === "/api/krisha/places" || urlPath === "/api/krisha/dashboard") {
      const send = (code, obj) => {
        res.writeHead(code, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
        res.end(JSON.stringify(obj, null, 2));
      };
      if (!KRISHA_PHONE_KEY || parsed.searchParams.get("key") !== KRISHA_PHONE_KEY) {
        return send(403, { ok: false, error: "bad_key" });
      }
      const Base = require("./scripts/krisha-base.js");

      (async () => {
        // Сводка по боту: обращения, люди, доля находок.
        if (urlPath === "/api/krisha/dashboard") {
          const days = parsed.searchParams.get("days");
          return send(200, Object.assign({ ok: true },
            await db.botStats(days), { base: await db.krishaStats() }));
        }
        // Дерево «город — район — микрорайон» для выбора места в кабинете.
        if (urlPath === "/api/krisha/places") {
          return send(200, { ok: true, tree: await db.places(), facets: await db.facets() });
        }
        if (urlPath === "/api/krisha/base") {
          // Разовый перенос того, что собрано до переезда в SQL: файлы лежат на
          // диске App Service, руками до них не дотянуться.
          if (parsed.searchParams.get("import") === "1") {
            const dir = PERSIST_DATA || REPO_DATA;
            const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };
            let flats = 0, cards = 0, phones = 0;
            const baseDir = path.join(dir, "krisha-base");
            let files = [];
            try { files = fs.readdirSync(baseDir).filter((x) => /^\d{4}-\d{2}-\d{2}\.json$/.test(x)); } catch { /* нет базы */ }
            for (const f of files) {
              const day = readJson(path.join(baseDir, f)) || {};
              flats += await db.saveFlats(Object.values(day));
            }
            const kc = readJson(path.join(dir, "krisha-cards.json")) || {};
            for (const id of Object.keys(kc)) {
              const c = kc[id];
              try {
                await db.saveCard(id, c);
                cards++;
                if ((c.phones || []).length) { await db.saveFlatPhones(id, c.phones, "manual"); phones++; }
              } catch { /* одна битая карточка не должна рвать перенос */ }
            }
            return send(200, Object.assign(
              { ok: true, imported: { flats: flats, cards: cards, withPhone: phones } },
              await db.krishaStats()));
          }
          return send(200, Object.assign({ ok: true }, await db.krishaStats(), {
            backfill: KW.backfill || {}, backfillDone: KW.backfillDone || {},
          }));
        }
        const url = parsed.searchParams.get("url");
        let q;
        if (url) q = await Base.queryFromUrl(url);
        else {
          q = {
            rooms: parsed.searchParams.get("rooms"),
            area: parsed.searchParams.get("area"),
            floor: parsed.searchParams.get("floor"),
            floors: parsed.searchParams.get("floors"),
            year: parsed.searchParams.get("year"),
            district: parsed.searchParams.get("district"),
            city: parsed.searchParams.get("city"),
            mkr: parsed.searchParams.get("mkr"),
            addr: parsed.searchParams.get("addr"),
            yearFrom: parsed.searchParams.get("yearFrom"),
            yearTo: parsed.searchParams.get("yearTo"),
            house: parsed.searchParams.get("house"),
            toilet: parsed.searchParams.get("toilet"),
            cond: parsed.searchParams.get("cond"),
            furnished: parsed.searchParams.get("furnished"),
            postedFrom: parsed.searchParams.get("postedFrom"),
            postedTo: parsed.searchParams.get("postedTo"),
            notFirst: parsed.searchParams.get("notFirst") === "1",
            notLast: parsed.searchParams.get("notLast") === "1",
            priceFrom: parsed.searchParams.get("priceFrom"),
            priceTo: parsed.searchParams.get("priceTo"),
          };
          const anything = q.area || q.district || q.rooms || q.priceFrom || q.priceTo ||
            q.mkr || q.city || q.addr || q.yearFrom || q.yearTo || q.house || q.toilet ||
            q.cond || q.notFirst || q.notLast || q.postedFrom || q.postedTo || q.furnished;
          if (!anything) {
            return send(400, { ok: false, error: "нужна ссылка или хоть один признак" });
          }
        }
        const hits = await db.findFlats(q, 8);
        const items = [];
        for (const h of hits) {
          const id = String(h.id);
          // Телефон, если вы его уже проходили; иначе — ссылка, где пройти.
          let phones = [];
          try { phones = await db.flatPhones(id); } catch { /* необязательно */ }
          items.push({
            id: id, score: h.score,
            title: h.title, price: h.price, addr: h.addr, district: h.district,
            photo: h.photo1 || null, photos: h.photos || 0,
            area: h.area == null ? null : Number(h.area),
            kitchen: h.kitchen == null ? null : Number(h.kitchen),
            mkr: h.mkr || null, street: h.street || null, isAgent: h.is_agent,
            rooms: h.rooms, floor: h.floor, floors: h.floors, year: h.build_year,
            house: h.house || null, toilet: h.toilet || null, cond: h.cond || null,
            posted: h.posted_on ? String(h.posted_on).slice(0, 10) : null,
            phones: phones.length ? phones : null,
            krisha: "https://krisha.kz/a/show/" + id,
            card: CANONICAL + "/kv/" + id,
          });
        }
        // Найденный по ссылке запрос несёт свои фото (q.photoUrls) — тогда
        // каждого кандидата можно дополнительно проскорить по снимкам, а не
        // только по параметрам квартиры. Без ключа или без фото просто
        // пропускаем — это уточнение, а не обязательное условие показа.
        const PhotoMatch = require("./scripts/photo-match.js");
        if (q.photoUrls && q.photoUrls.length && items.length && PhotoMatch.available()) {
          try {
            const candidates = await Promise.all(items.map(async (it) => ({
              id: it.id, photos: await db.candidatePhotoUrls(it.id, it.photo),
            })));
            const scores = await PhotoMatch.scoreCandidates(q.photoUrls, candidates);
            for (const it of items) it.photoMatch = scores[it.id] || null;
          } catch (e) { /* фото не критично — параметры уже нашли кандидатов */ }
        }
        return send(200, { ok: true, query: q, found: items.length, items: items });
      })().catch((e) => send(400, { ok: false, error: String(e.message).slice(0, 160) }));
      return;
    }

    // Телефон хозяина, снятый скриптом со страницы Крыши после того, как
    // человек сам прошёл капчу. Запрос приходит с krisha.kz, то есть с чужого
    // источника, — отсюда разрешение CORS и отдельный ключ.
    if (urlPath === "/api/krisha/phone" || urlPath === "/api/krisha/queue" || urlPath === "/api/krisha/phone/miss") {
      const cors = {
        "Access-Control-Allow-Origin": "https://krisha.kz",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      };
      if (req.method === "OPTIONS") { res.writeHead(204, cors); res.end(); return; }
      const send = (code, obj) => {
        res.writeHead(code, Object.assign({ "Content-Type": MIME[".json"], "Cache-Control": "no-store" }, cors));
        res.end(JSON.stringify(obj));
      };
      const key = parsed.searchParams.get("key") || "";
      if (!KRISHA_PHONE_KEY || key !== KRISHA_PHONE_KEY) return send(403, { ok: false, error: "bad_key" });

      // Юзерскрипт зовёт это, когда на странице объявления не нашлось ни
      // кнопки «Показать телефон», ни капчи, ни самого номера — похоже на
      // снятое объявление. Отмечаем промах и уходим, не трогая остальную
      // логику ниже: у этого пути нет GET-варианта и он не пишет номера.
      if (urlPath === "/api/krisha/phone/miss") {
        if (req.method !== "POST") return send(405, { ok: false, error: "only POST" });
        (async () => {
          let body = {};
          try { body = JSON.parse(await readBody(req)) || {}; } catch { /* пусто */ }
          const id = String(body.id || parsed.searchParams.get("id") || "").replace(/\D/g, "");
          if (!id) return send(400, { ok: false, error: "нет номера объявления" });
          await db.markPhoneMiss(id);
          console.log("[телефон] промах " + id);
          return send(200, { ok: true, id: id });
        })().catch((e) => send(500, { ok: false, error: String(e.message).slice(0, 120) }));
        return;
      }

      const pretty = (n) =>
        "+" + n[0] + " " + n.slice(1, 4) + " " + n.slice(4, 7) + " " + n.slice(7, 9) + " " + n.slice(9);
      // Казахстанский номер: 11 цифр с 7/8 в начале либо 10 без кода страны.
      const parsePhones = (list) => {
        const out = [];
        for (const raw of [].concat(list || [])) {
          const n = db.normPhone(raw);
          if (n && !out.includes(n)) out.push(n);
        }
        return out;
      };

      (async () => {
        // GET: без id — очередь квартир без единого номера (свежие раньше);
        // с id — то, что по этой квартире уже сохранено. Второе нужно перед
        // правкой: не перезаписывать номера вслепую, не видя, что там сейчас.
        if (req.method === "GET" || req.method === "HEAD") {
          const id = String(parsed.searchParams.get("id") || "").replace(/\D/g, "");
          if (id) {
            const phones = await db.flatPhones(id);
            return send(200, { ok: true, id: id, phones: phones.map(pretty), raw: phones });
          }
          const q = await db.flatsWithoutPhone(Number(parsed.searchParams.get("limit") || 30));
          // count — сколько в этой пачке, total — сколько в очереди целиком.
          // Их путали: limit=30 всегда возвращал 30, и это выглядело как
          // застрявший прогресс, хотя очередь на деле двигалась.
          return send(200, {
            ok: true, count: q.rows.length, total: q.total,
            items: q.rows.map((r) => ({
              id: String(r.id), title: r.title, url: "https://krisha.kz/a/show/" + r.id,
            })),
          });
        }

        let body = {};
        try { body = JSON.parse(await readBody(req)) || {}; } catch { /* пусто */ }
        const id = String(body.id || parsed.searchParams.get("id") || "").replace(/\D/g, "");
        if (!id) return send(400, { ok: false, error: "нет номера объявления" });
        const phones = parsePhones(body.phones || body.phone);

        // PUT/PATCH: заменить номера этой квартиры целиком — для правки того,
        // что записалось неверно. Пустой список — осознанно стереть все номера,
        // а не молча ничего не сделать.
        if (req.method === "PUT" || req.method === "PATCH") {
          if (!phones.length && !("phones" in body || "phone" in body)) {
            return send(400, { ok: false, error: "нужен список phones (может быть пустым)" });
          }
          const saved = await db.replaceFlatPhones(id, phones, body.source || "manual");
          cardCache.delete(id);
          console.log("[телефон] заменено " + id + ": " + saved.length + " шт.");
          return send(200, { ok: true, id: id, phones: saved.map(pretty) });
        }

        // POST (по умолчанию): добавить к тому, что уже есть — для скрипта,
        // который снимает один номер со страницы и может перезапуститься на
        // той же квартире.
        if (!phones.length) return send(400, { ok: false, error: "номер не разобрал" });
        await db.saveFlatPhones(id, phones, body.source || "script");
        cardCache.delete(id);
        console.log("[телефон] " + id + ": " + phones.length + " шт.");
        return send(200, { ok: true, id: id, phones: phones.map(pretty) });
      })().catch((e) => send(500, { ok: false, error: String(e.message).slice(0, 120) }));
      return;
    }

    // Сколько объявлений уже с номером. Счётчики по номерам и промахам — на
    // каждый запрос (строк мало, индексы фильтрованные); размер очереди —
    // сотни тысяч строк, его держим минуту, время подсчёта в queueAt.
    if (urlPath === "/api/krisha/objphone/count") {
      const want = KRISHA_JOB_KEY || KRISHA_PHONE_KEY;
      const send = (code, obj) => {
        res.writeHead(code, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
        res.end(JSON.stringify(obj, null, 2));
      };
      if (!want || parsed.searchParams.get("key") !== want) return send(403, { ok: false, error: "bad_key" });
      (async () => {
        const live = await db.listPhoneCounts();
        if (!phoneQueueCache || Date.now() - phoneQueueCache.at > 60 * 1000) {
          phoneQueueCache = { at: Date.now(), n: await db.listPhoneQueueSize() };
        }
        send(200, Object.assign({ ok: true, at: new Date().toISOString() }, live,
          { queue: phoneQueueCache.n, queueAt: new Date(phoneQueueCache.at).toISOString() }));
      })().catch((e) => send(500, { ok: false, error: String(e.message).slice(0, 200) }));
      return;
    }

    // Очередь телефонов для плагина — по списку карты (krisha_list): хозяева,
    // живые, без номера, свежие первыми. Смысл — снять прямой номер хозяина
    // раньше, чем агент уговорит его спрятать объявление. GET отдаёт по
    // одному; номера и промахи пишутся в ту же таблицу.
    if (urlPath === "/api/krisha/objphone" || urlPath === "/api/krisha/objqueue" ||
        urlPath === "/api/krisha/objphone/miss" || urlPath === "/api/krisha/objphone/lease" ||
        urlPath === "/api/krisha/objphone/rotate" || urlPath === "/api/krisha/objphone/ports" ||
        urlPath === "/api/krisha/objphone/debug") {
      const cors = {
        "Access-Control-Allow-Origin": "https://krisha.kz",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      };
      if (req.method === "OPTIONS") { res.writeHead(204, cors); res.end(); return; }
      const send = (code, obj) => {
        res.writeHead(code, Object.assign({ "Content-Type": MIME[".json"], "Cache-Control": "no-store" }, cors));
        res.end(JSON.stringify(obj));
      };
      const key = parsed.searchParams.get("key") || "";
      if (!KRISHA_PHONE_KEY || key !== KRISHA_PHONE_KEY) return send(403, { ok: false, error: "bad_key" });

      // Плагин не снял номер — сообщает причину (reason): archived — объекта
      // больше нет, из очереди насовсем; captcha / timeout / no_phone / error —
      // пауза и повтор позже, после пяти промахов тоже насовсем. Без reason
      // считаем error. GET-варианта нет.
      if (urlPath === "/api/krisha/objphone/miss") {
        if (req.method !== "POST") return send(405, { ok: false, error: "only POST" });
        (async () => {
          let body = {};
          try { body = JSON.parse(await readBody(req)) || {}; } catch { /* пусто */ }
          const id = String(body.id || parsed.searchParams.get("id") || "").replace(/\D/g, "");
          if (!id) return send(400, { ok: false, error: "нет номера объявления" });
          const reason = String(body.reason || parsed.searchParams.get("reason") || "error").toLowerCase();
          if (!db.PHONE_MISS_REASONS.includes(reason)) {
            return send(400, { ok: false, error: "reason: один из " + db.PHONE_MISS_REASONS.join(", ") });
          }
          const m = await db.markListPhoneMiss(id, reason);
          console.log("[objphone] промах " + id + ": " + m.state + " (попытка " + m.tries + (m.final ? ", выбыл" : "") + ")");
          return send(200, Object.assign({ ok: true, id: id }, m));
        })().catch((e) => send(500, { ok: false, error: String(e.message).slice(0, 120) }));
        return;
      }

      // Список портов Asocks (без паролей): чтобы раздать по порту на каждый
      // экземпляр Chrome и вписать id порта в плагин.
      if (urlPath === "/api/krisha/objphone/ports") {
        const K = require("./scripts/krisha-lib.js");
        (async () => {
          const r = await K.browserPorts();
          return send(r.ok ? 200 : 503, Object.assign({ at: new Date().toISOString() }, r));
        })().catch((e) => send(500, { ok: false, error: String(e.message).slice(0, 120) }));
        return;
      }

      // Сменить IP у порта Asocks, через который ходит браузер с плагином.
      // GET — какой это порт (без пароля); POST — сменить IP. ?port=<id> —
      // какой именно (у каждого экземпляра Chrome свой), без него — порт по
      // умолчанию. Не чаще раза в 5 секунд на порт: сто вкладок разом не
      // должны дёргать Asocks сто раз.
      if (urlPath === "/api/krisha/objphone/rotate") {
        const K = require("./scripts/krisha-lib.js");
        (async () => {
          // ?check=1 — заодно показать выходной IP порта (запрос через прокси на api.ipify.org).
          const check = parsed.searchParams.get("check") === "1";
          let body = {};
          if (req.method === "POST") { try { body = JSON.parse(await readBody(req)) || {}; } catch { /* пусто */ } }
          const portId = String(body.port || parsed.searchParams.get("port") || "").replace(/\D/g, "");
          if (req.method === "GET") return send(200, Object.assign({ at: new Date().toISOString() }, await K.browserPort(false, check, portId)));
          if (req.method !== "POST") return send(405, { ok: false, error: "only POST" });
          const rk = portId || "default";
          const since = Date.now() - (rotateLastAt.get(rk) || 0);
          if (since < 5000) return send(200, { ok: true, rotated: false, throttled: true, waitMs: 5000 - since, port: portId || null, at: new Date(rotateLastAt.get(rk)).toISOString() });
          rotateLastAt.set(rk, Date.now());
          const r = await K.browserPort(true, check, portId);
          if (r.ok) console.log("[objphone] IP порта " + (r.port && r.port.id) + (r.rotated ? " сменён" : " не сменился"));
          return send(r.ok ? 200 : 503, Object.assign({ at: new Date().toISOString() }, r));
        })().catch((e) => send(500, { ok: false, error: String(e.message).slice(0, 120) }));
        return;
      }

      // Отладка: клиент присылает сырой текст экрана (тело как есть, любой
      // Content-Type), ?id= — объявление, ?src= — кто прислал. Смотрим в базе.
      if (urlPath === "/api/krisha/objphone/debug") {
        if (req.method !== "POST") return send(405, { ok: false, error: "only POST" });
        (async () => {
          const raw = await readBody(req);
          const id = String(parsed.searchParams.get("id") || "").replace(/\D/g, "");
          await db.saveObjphoneDebug(id, parsed.searchParams.get("src") || "tasker", raw);
          return send(200, { ok: true, id: id || null, bytes: raw.length });
        })().catch((e) => send(500, { ok: false, error: String(e.message).slice(0, 120) }));
        return;
      }

      // Продлить аренду объекта: фоновая вкладка зовёт раз в две минуты, пока
      // ждёт, чтобы объект за это время не ушёл другой вкладке.
      if (urlPath === "/api/krisha/objphone/lease") {
        if (req.method !== "POST") return send(405, { ok: false, error: "only POST" });
        (async () => {
          let body = {};
          try { body = JSON.parse(await readBody(req)) || {}; } catch { /* пусто */ }
          const id = String(body.id || parsed.searchParams.get("id") || "").replace(/\D/g, "");
          if (!id) return send(400, { ok: false, error: "нет номера объявления" });
          const sec = Math.max(30, Math.min(900, Number(body.lease || parsed.searchParams.get("lease")) || 240));
          const until = await db.renewListLease(id, sec);
          return send(200, { ok: true, id: id, leaseUntil: until ? new Date(until).toISOString() : null });
        })().catch((e) => send(500, { ok: false, error: String(e.message).slice(0, 120) }));
        return;
      }

      const pretty = (n) =>
        "+" + n[0] + " " + n.slice(1, 4) + " " + n.slice(4, 7) + " " + n.slice(7, 9) + " " + n.slice(9);
      const parsePhones = (list) => {
        const out = [];
        for (const raw of [].concat(list || [])) {
          const n = db.normPhone(raw);
          if (n && !out.includes(n)) out.push(n);
        }
        return out;
      };
      const day = (v) => { try { return v ? new Date(v).toISOString().slice(0, 10) : null; } catch { return null; } };

      (async () => {
        if (req.method === "GET" || req.method === "HEAD") {
          const id = String(parsed.searchParams.get("id") || "").replace(/\D/g, "");
          if (id) {
            const phones = await db.listPhonesGet(id);
            return send(200, { ok: true, id: id, phones: phones.map(pretty), raw: phones });
          }
          // Один следующий объект, не пачка. since — нижняя граница по дате
          // публикации (YYYY-MM-DD), от неё идём вверх к сегодняшнему дню;
          // без since — последняя неделя. Курсор клиенту вести не нужно:
          // объект с номером (или пятью промахами) сам выпадает из очереди.
          // Один следующий хозяин, не пачка: живой, без номера, самый свежий по
          // попаданию в базу. since — не старше этой даты (YYYY-MM-DD); без
          // since — последняя неделя. deal/prop — необязательные фильтры.
          // Курсор клиенту вести не нужно: объект с номером (или выбывший по
          // промахам) сам выпадает из очереди.
          const sinceRaw = parsed.searchParams.get("since");
          if (sinceRaw && (!/^\d{4}-\d{2}-\d{2}$/.test(sinceRaw) || isNaN(Date.parse(sinceRaw)))) {
            return send(400, { ok: false, error: "since: нужна дата YYYY-MM-DD" });
          }
          const since = sinceRaw || day(Date.now() - 7 * 86400e3);
          // По умолчанию очередь — продажа квартир в Алматы: аренду, дома,
          // коммерцию и другие города плагин не снимает. Снять фильтр можно
          // значением any (deal=any, prop=any, city=any).
          const filt = (name, def) => {
            const v = (parsed.searchParams.get(name) || "").trim().toLowerCase();
            if (!v) return def;
            return v === "any" || v === "all" ? null : v;
          };
          const dealF = filt("deal", "sale");
          const propF = filt("prop", "flat");
          const cityF = filt("city", "almaty");
          // Аренда: выданный объект на lease секунд не достаётся другим
          // вкладкам (по умолчанию 4 минуты — минута капчи, две перезагрузки
          // и запас). lease=0 — только посмотреть, без аренды.
          const leaseRaw = parsed.searchParams.get("lease");
          const leaseSec = leaseRaw == null || leaseRaw === "" ? 240 : Math.max(0, Math.min(900, Number(leaseRaw) || 0));
          // Счётчики очереди — раз в минуту на окно, остальные вызовы берут
          // из кэша: сам подсчёт на 10 DTU стоит секунды, объект — миллисекунды.
          const ck = since + "|" + (dealF || "") + "|" + (propF || "") + "|" + (cityF || "");
          let cached = objphoneCounts.get(ck);
          // Первый вызов на окно считает синхронно; дальше плагин получает
          // счётчики из кэша сразу, а пересчёт раз в минуту идёт в фоне.
          // И первый вызов не ждёт подсчёта: пока база занята обходом, подсчёт
          // по 200 тысячам строк может не уложиться в таймаут, а объект плагину
          // нужен сразу. Счётчики придут со следующим вызовом.
          if (!cached) {
            cached = { at: 0, left: null, waiting: null, busy: false };
            objphoneCounts.set(ck, cached);
          }
          if (Date.now() - cached.at > 60e3 && !cached.busy) {
            cached.busy = true;
            db.nextListOwnerWithoutPhone(since, dealF, propF, cityF, true, 0)
              .then((q1) => { cached.at = Date.now(); cached.left = q1.left; cached.waiting = q1.waiting; cached.inWork = q1.inWork; })
              .catch(() => {}).then(() => { cached.busy = false; });
          }
          const q = await db.nextListOwnerWithoutPhone(since, dealF, propF, cityF, false, leaseSec);
          const r = q.row;
          return send(200, {
            ok: true, since: since, left: cached.left, waiting: cached.waiting, inWork: cached.inWork == null ? null : cached.inWork,
            countsAt: cached.at ? new Date(cached.at).toISOString() : null,
            filter: { deal: dealF, prop: propF, city: cityF },
            // До какого момента объект закреплён за этой вкладкой (UTC); null — без аренды.
            leaseUntil: r && r.phone_lease_until ? new Date(r.phone_lease_until).toISOString() : null,
            item: r ? {
              id: String(r.id), title: r.title, deal: r.deal, prop: r.prop, city: r.city,
              seller: r.user_type, price: r.price == null ? null : Number(r.price),
              // posted — дата последнего поднятия с карточки; seen — когда мы
              // впервые увидели объявление (UTC): это и есть «свежесть».
              posted: day(r.bumped_on), seen: r.first_seen ? new Date(r.first_seen).toISOString() : null,
              url: "https://krisha.kz/a/show/" + r.id,
              // Сколько раз уже пробовали и чем кончилось — плагин может,
              // например, на повторной попытке ждать страницу дольше.
              tries: r.phone_tries || 0, last: r.phone_state || null,
            } : null,
          });
        }

        let body = {};
        try { body = JSON.parse(await readBody(req)) || {}; } catch { /* пусто */ }
        const id = String(body.id || parsed.searchParams.get("id") || "").replace(/\D/g, "");
        if (!id) return send(400, { ok: false, error: "нет номера объявления" });
        const phones = parsePhones(body.phones || body.phone);

        if (req.method === "PUT" || req.method === "PATCH") {
          if (!phones.length && !("phones" in body || "phone" in body)) {
            return send(400, { ok: false, error: "нужен список phones (может быть пустым)" });
          }
          const saved = await db.setListPhones(id, phones);
          console.log("[objphone] заменено " + id + ": " + saved.length + " шт.");
          return send(200, { ok: true, id: id, phones: saved.map(pretty) });
        }

        if (!phones.length) return send(400, { ok: false, error: "номер не разобрал" });
        // src — метка клиента (телефон с Tasker). Приложение Крыши держит в
        // шторке телефонов номера предыдущего объявления, пока их не вытеснит
        // следующее с таким же числом номеров; свой номер всегда первый.
        // Поэтому от клиента с меткой выбрасываем всё, кроме первого, что было
        // и в его предыдущей отправке. Без метки (браузер) ничего не режем.
        const src = String(body.src || parsed.searchParams.get("src") || "").slice(0, 40);
        let kept = phones, dropped = [];
        if (src) {
          const prev = objphoneLastBySrc.get(src) || new Set();
          kept = phones.filter((p, i) => i === 0 || !prev.has(p));
          dropped = phones.filter((p) => !kept.includes(p));
          objphoneLastBySrc.set(src, new Set(phones));
        }
        const merged = await db.addListPhones(id, kept);
        console.log("[objphone] " + id + ": +" + kept.length + (dropped.length ? " (отброшено как прилипшие: " + dropped.length + ")" : "") + " (итого " + merged.length + ")");
        return send(200, { ok: true, id: id, phones: merged.map(pretty), dropped: dropped.map(pretty) });
      })().catch((e) => send(500, { ok: false, error: String(e.message).slice(0, 120) }));
      return;
    }

    // Квартира из подборки: ссылку открывают прямо в Телеграме, поэтому
    // показываем свой снимок с фотографиями и контактами, а не отправляем
    // человека на чужой сайт, где объявления может уже не быть.
    const kvMatch = urlPath.match(/^\/kv\/(\d+)\/?$/);
    if (kvMatch) {
      const page = require("./scripts/krisha-page.js");
      loadCard(kvMatch[1]).then((card) => {
        res.writeHead(card ? 200 : 404, {
          "Content-Type": MIME[".html"],
          "Cache-Control": card ? "public, max-age=300" : "no-store",
        });
        res.end(card ? page.render(card) : page.notFound(kvMatch[1]));
      });
      return;
    }

    // Скрипт для браузера отдаём по адресу, чтобы Tampermonkey ставил его по
    // ссылке и сам обновлял. Ключа внутри нет — его спрашивают при первом
    // запуске и хранят в браузере.
    if (urlPath === "/krisha-phone.user.js") {
      fs.readFile(path.join(ROOT, "scripts", "krisha-phone.user.js"), (err, js) => {
        if (err) { res.writeHead(404).end("Not found"); return; }
        res.writeHead(200, {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "public, max-age=300",
        }).end(js);
      });
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
        // Подстановка главной уместна для адресов страниц, но не для файлов.
        // Картинка, которую не нашли, возвращалась как HTML с кодом 200 —
        // браузер показывал битый значок, а причину приходилось искать в
        // трёх местах. Отсутствующий файл должен отвечать 404.
        const ext = path.extname(urlPath).toLowerCase();
        if (ext && ext !== ".html" && ext !== ".htm") {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
          return;
        }
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
