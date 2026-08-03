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
    verdict_low: "ИИ-ассистенты почти не видят ваш бизнес. В большинстве ответов они порекомендуют конкурентов.",
    verdict_mid: "ИИ читает ваш бизнес частично, но ключевых сигналов нет — ответ выигрывают более оптимизированные конкуренты.",
    verdict_high: "Хорошая база! Сайт-мост всё равно добавит транзакции, всегда свежие данные и мониторинг упоминаний в ИИ.",
    err_url: "Это не похоже на корректный URL. Проверьте и попробуйте ещё раз.",
    err_fetch: "Не удалось открыть этот адрес. Проверьте ссылку и попробуйте ещё раз.",
  },
};

const AI_BOTS = ["gptbot", "claudebot", "anthropic-ai", "perplexitybot", "google-extended", "oai-searchbot"];
const CLOSED_PLATFORMS = ["instagram.com", "facebook.com", "m.facebook.com", "tiktok.com", "vk.com"];

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
        "User-Agent": "Mozilla/5.0 (compatible; BusinessBoosterAudit/0.1)",
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
      items.push({ label: t.llms, status: "ok", note: t.llms_ok });
      score += 15;
    } else {
      items.push({ label: t.llms, status: "bad", note: t.llms_missing });
    }
  } catch {
    items.push({ label: t.llms, status: "bad", note: t.llms_missing });
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
    items.push({ label: t.content, status: "ok", note: t.content_ok });
    score += 20;
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
// HTTP server: /api/audit + static files
// ---------------------------------------------------------------------------

http
  .createServer((req, res) => {
    const parsed = new URL(req.url, "http://localhost");
    const urlPath = decodeURIComponent(parsed.pathname);

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
  .listen(PORT, () => console.log(`Business Booster running on port ${PORT}`));
