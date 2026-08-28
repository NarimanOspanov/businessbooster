// Чтение публичных страниц клиники и извлечение из них анкеты.
//
// Адрес приходит от пользователя, а ходит по нему НАШ сервер — изнутри нашей
// сети. Поэтому проверка адреса здесь не формальность: без неё кабинет
// превращается в способ postучаться в приватные адреса Azure и прочитать
// ответ. Разрешаем только http(s) на публичные адреса.
const dns = require("dns").promises;
const net = require("net");
const fs = require("fs");
const os = require("os");
const path = require("path");

const MAX_BYTES = 700 * 1024;
const TIMEOUT_MS = 15000;

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // метаданные облака
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  const s = ip.toLowerCase();
  if (s === "::1" || s === "::") return true;
  if (s.startsWith("fe80") || s.startsWith("fc") || s.startsWith("fd")) return true;
  // ::ffff:10.0.0.1 — тот же приватный адрес, записанный как IPv6
  const m = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (m) return isPrivateIp(m[1]);
  return false;
}

async function assertPublicUrl(raw) {
  let u;
  try { u = new URL(String(raw).trim()); } catch { throw new Error("bad_url"); }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("bad_scheme");
  if (u.port && !["80", "443", ""].includes(u.port)) throw new Error("bad_port");

  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (/^localhost$/i.test(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("private_host");
  }
  const ips = net.isIP(host)
    ? [host]
    : (await dns.lookup(host, { all: true })).map((r) => r.address);
  if (!ips.length) throw new Error("dns_failed");
  // Достаточно одного приватного адреса, чтобы отказать: какой из них выберет
  // системный резолвер при самом запросе, мы не контролируем.
  if (ips.some(isPrivateIp)) throw new Error("private_host");
  return u.toString();
}

// Из HTML нужен текст, а не разметка: скрипты и стили — это мусор, который
// съест место в запросе к модели и ничего не добавит.
function htmlToText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&(mdash|ndash|minus);/g, "—")
    .replace(/&(laquo|raquo|ldquo|rdquo);/g, '"')
    .replace(/&(rsquo|lsquo|apos|#39);/g, "'")
    .replace(/&hellip;/g, "…").replace(/&middot;/g, "·")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/[ \t ]+/g, " ")
    // 2GIS и подобные SPA оставляют после разметки длинные ряды точек и
    // пустых строк. Модели они ничего не говорят, а место в запросе занимают:
    // карточка клиники худеет с 3 700 символов до 2 400.
    .replace(/[.·•]{4,}/g, " ")
    .replace(/\n[ \t ​]*(?=\n)/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchSource(url) {
  // Переходы отслеживаем сами. С redirect:"follow" проверка адреса ничего не
  // стоит: сайт отвечает 302 на 169.254.169.254, и мы послушно идём туда уже
  // без всякой проверки.
  let next = await assertPublicUrl(url);
  let res = null;
  for (let hop = 0; hop <= 3; hop++) {
    res = await fetch(next, {
      redirect: "manual",
      headers: {
        // Без внятного user-agent половина сайтов отдаёт заглушку.
        "User-Agent": "Mozilla/5.0 (compatible; OtvetBot/1.0; +https://otvet.mobi)",
        "Accept-Language": "ru,kk;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status < 300 || res.status >= 400) break;
    const loc = res.headers.get("location");
    if (!loc) break;
    if (hop === 3) throw new Error("too_many_redirects");
    next = await assertPublicUrl(new URL(loc, next).toString());
  }
  if (!res.ok) throw new Error("http_" + res.status);
  const safe = next;
  const type = res.headers.get("content-type") || "";
  if (!/text\/html|text\/plain|application\/xhtml/i.test(type)) throw new Error("not_html");

  const buf = Buffer.from(await res.arrayBuffer());
  const text = htmlToText(buf.subarray(0, MAX_BYTES).toString("utf8"));
  if (text.length < 40) throw new Error("empty_page");
  return { url: safe, text, chars: text.length };
}

// --- извлечение анкеты ----------------------------------------------------

const EXTRACT_PROMPT = `Ты помогаешь заполнить анкету стоматологической клиники по тексту с её
страниц. Возвращай ТОЛЬКО JSON, без пояснений и без markdown.

Страниц может быть несколько, но все они принадлежат ОДНОЙ клинике. Верни
ОДИН объект, собрав сведения со всех страниц вместе. Не возвращай массив и не
делай отдельный объект на каждую страницу.

Поля:
  name      — название клиники
  city      — город
  address   — адрес одной строкой
  hours     — часы работы одной строкой
  services  — услуги и цены, по строке на услугу, вида "Название — цена"
  doctors   — врачи, по строке, вида "Имя — специализация"
  extra     — парковка, оплата, детский приём, языки персонала

Правила:
- Бери только то, что прямо написано в тексте. Ничего не додумывай.
- Не нашёл поле — оставь пустую строку. Пустое поле лучше выдуманного:
  по этой анкете ассистент будет называть пациентам цены.
- Цены переписывай как есть, вместе с "от" и валютой.`;

// Разбором может заниматься любая модель — задача простая: вытащить факты из
// текста. Берём ту, чей ключ нашёлся, чтобы смена поставщика была настройкой,
// а не правкой кода. Ключ читаем из переменной окружения, а локально — из
// файла в домашней папке, как остальные ключи проекта.
function keyFrom(envName, fileName) {
  if (process.env[envName]) return process.env[envName].trim();
  try {
    return fs.readFileSync(path.join(os.homedir(), fileName), "utf8").trim() || null;
  } catch {
    return null;
  }
}

function provider() {
  if (keyFrom("GEMINI_API_KEY", ".gemini-key")) return "gemini";
  if (keyFrom("ANTHROPIC_API_KEY", ".anthropic-key")) return "anthropic";
  return null;
}

function available() { return !!provider(); }

const PROFILE_KEYS = ["name", "city", "address", "hours", "services", "doctors", "extra"];
// Одиночные сведения не складываются: два адреса подряд — это не адрес.
const LIST_KEYS = new Set(["services", "doctors", "extra"]);

function asText(v) {
  return Array.isArray(v) ? v.filter(Boolean).join("\n") : String(v == null ? "" : v).trim();
}

function mergeProfiles(items) {
  const out = {};
  for (const k of PROFILE_KEYS) {
    const values = items
      .filter((x) => x && typeof x === "object")
      .map((x) => asText(x[k]))
      .filter(Boolean);
    if (!values.length) { out[k] = ""; continue; }
    if (!LIST_KEYS.has(k)) { out[k] = values[0]; continue; }
    const seen = new Set();
    const lines = [];
    for (const line of values.join("\n").split("\n")) {
      const t = line.trim();
      if (t && !seen.has(t)) { seen.add(t); lines.push(t); }
    }
    out[k] = lines.join("\n");
  }
  return out;
}

// Модель иногда оборачивает JSON в ```json — вырезаем сами, а не просим её
// переделать: лишний заход стоит времени на глазах у клиники.
function parseJson(out) {
  const text = String(out).trim();
  let parsed = null;
  try {
    parsed = JSON.parse(text); // responseMimeType обычно даёт чистый JSON
  } catch {
    const m = text.match(/[\{\[][\s\S]*[\}\]]/);
    if (!m) throw new Error("model_gave_no_json");
    parsed = JSON.parse(m[0]);
  }

  // Получив несколько страниц, модель отвечает массивом — по объекту на
  // страницу, — даже когда схема просит один объект и промпт просит того же.
  // Страницы принадлежат одной клинике, поэтому объекты сливаем: адрес берём
  // первый найденный, а списки складываем, отбрасывая повторы.
  const raw = Array.isArray(parsed) ? mergeProfiles(parsed) : parsed;
  // Схема требует строк, но подстраховываемся: список, пришедший массивом,
  // склеиваем переносами, а не запятыми — иначе цены встанут в одну строку.
  const out2 = {};
  for (const k of PROFILE_KEYS) {
    const v = raw[k];
    out2[k] = Array.isArray(v) ? v.filter(Boolean).join("\n") : String(v == null ? "" : v);
  }
  return out2;
}

// Закреплённая версия однажды закрывается для новых аккаунтов — мы это уже
// поймали на gemini-2.5-flash, и поймали только потому, что проверяли руками.
// В проде такое всплыло бы при первой же клинике, поэтому на 404 переходим
// на плавающий алиас: он живёт всегда.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.7-flash";
const GEMINI_FALLBACK = "gemini-flash-latest";

async function askGemini(body, model) {
  const key = keyFrom("GEMINI_API_KEY", ".gemini-key");
  model = model || GEMINI_MODEL;
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(model) + ":generateContent",
    {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: EXTRACT_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: body }] }],
        generationConfig: {
          temperature: 0,
          // Прайс клиники — это десятки строк, и на 4000 ответ обрывался на
          // полуслове: JSON приходил недописанным. Плюс на «размышления»
          // уходило до 1400 токенов, хотя выписывать факты из текста думать
          // не надо — отключаем и отдаём весь бюджет ответу.
          maxOutputTokens: 12000,
          thinkingConfig: { thinkingBudget: 0 },
          // Просим сразу JSON: так реже приходится выковыривать его из текста.
          responseMimeType: "application/json",
          // Схема, а не уговоры в промпте. Без неё одна модель отдаёт услуги
          // строкой, другая — массивом, и цены слипаются через запятую.
          responseSchema: {
            type: "OBJECT",
            properties: Object.fromEntries(
              PROFILE_KEYS.map((k) => [k, { type: "STRING" }])
            ),
            required: PROFILE_KEYS,
          },
        },
      }),
      signal: AbortSignal.timeout(90000),
    }
  );
  const text = await res.text();
  if (res.status === 404 && model !== GEMINI_FALLBACK) {
    console.log("[enrich] модель " + model + " недоступна, беру " + GEMINI_FALLBACK);
    return askGemini(body, GEMINI_FALLBACK);
  }
  if (!res.ok) throw new Error("model_" + res.status + ": " + text.slice(0, 200));
  const j = JSON.parse(text);
  const cand = (j.candidates || [])[0] || {};
  // Обрыв по лимиту даёт недописанный JSON. Без отдельной проверки это
  // выглядит как «модель не вернула JSON», и чинишь совсем не то.
  if (cand.finishReason === "MAX_TOKENS") throw new Error("model_answer_cut_off");
  const parts = (cand.content || {}).parts || [];
  return parseJson(parts.map((x) => x.text || "").join(""));
}

async function askAnthropic(body) {
  const key = keyFrom("ANTHROPIC_API_KEY", ".anthropic-key");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
      max_tokens: 2000,
      system: EXTRACT_PROMPT,
      messages: [{ role: "user", content: body }],
    }),
    signal: AbortSignal.timeout(90000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error("model_" + res.status + ": " + text.slice(0, 200));
  const j = JSON.parse(text);
  return parseJson((j.content || []).map((c) => c.text || "").join(""));
}

async function extractProfile(sources) {
  const who = provider();
  if (!who) throw new Error("no_model_key");
  const body = sources
    .map((s) => "СТРАНИЦА: " + s.url + "\n\n" + s.text.slice(0, 24000))
    .join("\n\n---\n\n")
    .slice(0, 90000);
  return who === "gemini" ? askGemini(body) : askAnthropic(body);
}

module.exports = { fetchSource, extractProfile, available, provider, htmlToText, assertPublicUrl, isPrivateIp };
