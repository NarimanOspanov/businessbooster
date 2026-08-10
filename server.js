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

function track(slug, req, kind) {
  const ua = req.headers["user-agent"] || "";
  const b = bucket(slug);
  b.lastSeen = new Date().toISOString();
  statsDirty = true;
  const botHit = AI_BOT_UA.find(([, re]) => re.test(ua));
  if (botHit) {
    b.bots[botHit[0]] = (b.bots[botHit[0]] || 0) + 1;
    return;
  }
  if (kind === "click") {
    b.clicks++;
    return;
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
}

function statsSummary() {
  const rows = Object.entries(STATS).map(([slug, s]) => ({
    slug,
    visits: s.visits,
    clicks: s.clicks,
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

function pingIndexNow(host, urls) {
  // Fire-and-forget: tell Bing about new/updated URLs
  return fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host,
      key: INDEXNOW_KEY,
      keyLocation: "https://" + host + "/" + INDEXNOW_KEY + ".txt",
      urlList: urls,
    }),
  }).catch(() => {});
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
    AI-читаемая витрина, сгенерированная <a href="/">Saudager</a> из каталога продавца на Kaspi.kz · данные обновлены ${esc(fetchedDate)} · цены и наличие подтверждаются на Kaspi<br>
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

    if (urlPath === "/robots.txt") {
      res.writeHead(200, { "Content-Type": MIME[".txt"], "Cache-Control": "public, max-age=3600" });
      res.end("User-agent: *\nAllow: /\n\nSitemap: " + CANONICAL + "/sitemap.xml\n");
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
        track(goMatch[1], req, "click");
        const src = parsed.searchParams.get("s") || "unknown";
        const b = STATS[goMatch[1]] || { clicks: 0 };
        notifyTelegram(
          "🛒 <b>Переход к продавцу</b>\n" +
            "Магазин: <b>" + prof.name + "</b>\n" +
            prod.title + "\n" +
            (prod.priceFormatted || prod.price + " ₸") + "\n" +
            "Источник: " + (SOURCE_LABEL[src] || src) + "\n" +
            "Всего переходов у этого магазина: " + b.clicks + "\n" +
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
