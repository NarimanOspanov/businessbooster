// Shared Krisha logic: search, parsing, location scoring and the comparables
// model. Used by both the CLI agent (scripts/krisha-agent.js) and the scheduled
// watcher inside server.js, so the two can never drift apart.

const { ProxyAgent, fetch: undiciFetch } = require("undici");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const H = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
  "Accept-Language": "ru-RU,ru;q=0.9",
  // Сами undici и fetch просят только gzip/deflate; Крыша умеет brotli, и он
  // на десятую часть компактнее — через прокси это те же деньги. Оба пути
  // (глобальный fetch и undici с ProxyAgent) br распаковывают, проверено.
  "Accept-Encoding": "gzip, deflate, br",
};

// Прокси для страниц объявлений. Azure-адрес Крыша уже однажды закрыла.
//
// KRISHA_PROXY — один или несколько входов http://login:pass@host:port через
// запятую (или с новой строки в ~/.krisha-proxy). Кабинет Asocks прокси не
// является: живой порт тогда берём через API по ASOCKS_API_KEY. URL с паролем
// в лог не пишем. Несколько входов раздаём по кругу — у Крыши это разные IP.
let agents = [];
let agentKey = "";
let rr = 0;
// Рабочий пул на время процесса: после смены портов не ждём рестарт Azure.
let liveUrls = null;
let rotateWait = null;

function env(name) {
  return String(process.env[name] || "").trim();
}

const PROXY_FILE = path.join(os.homedir(), ".krisha-proxy");

function looksLikeDashboard(raw) {
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return host === "asocks.com" || host.endsWith(".asocks.com");
  } catch {
    return false;
  }
}

function looksLikeProxyUrl(raw) {
  if (!raw || looksLikeDashboard(raw)) return false;
  try {
    const u = new URL(raw.includes("://") ? raw : "http://" + raw);
    return !!(u.hostname && u.port);
  } catch {
    return false;
  }
}

function toHttpProxy(raw) {
  const withScheme = raw.includes("://") ? raw : "http://" + raw;
  // CONNECT идёт по HTTP; схема https:// у прокси здесь только путает undici.
  return withScheme.replace(/^https:\/\//i, "http://");
}

function splitProxies(text) {
  const out = [];
  const seen = new Set();
  for (const part of String(text || "").split(/[\s,]+/)) {
    const val = part.replace(/^KRISHA_PROXY=/i, "").replace(/,$/, "").trim();
    if (!val || val.startsWith("#") || /^KEY=/i.test(val)) continue;
    if (!looksLikeProxyUrl(val)) continue;
    const url = toHttpProxy(val);
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

function fromFileText() {
  try { return fs.readFileSync(PROXY_FILE, "utf8"); } catch { return ""; }
}

function proxyUrlsFromConfig() {
  const fromEnv = splitProxies(env("KRISHA_PROXY"));
  if (fromEnv.length) return fromEnv;
  const text = fromFileText();
  const listed = splitProxies(text);
  if (listed.length) return listed;
  const login = (text.match(/^LOGIN=(.*)$/m) || [])[1];
  const pass = (text.match(/^PASSWORD=(.*)$/m) || [])[1];
  const ip = (text.match(/^(?:IP|HOST)=(.*)$/m) || [])[1];
  const port = (text.match(/^PORT=(.*)$/m) || [])[1];
  if (login && pass && ip && port) {
    return ["http://" + String(login).trim() + ":" + String(pass).trim() + "@" +
      String(ip).trim() + ":" + String(port).trim()];
  }
  return [];
}

function asocksKey() {
  return env("ASOCKS_API_KEY");
}

function currentUrls() {
  if (liveUrls && liveUrls.length) return liveUrls;
  return proxyUrlsFromConfig();
}

function viaProxy() {
  return currentUrls().length > 0 || !!asocksKey();
}

function proxyCount() {
  return currentUrls().length;
}

function proxyHint() {
  const raw = env("KRISHA_PROXY") || fromFileText();
  if (looksLikeDashboard(raw.trim().split(/[\s,]+/)[0]) && !asocksKey()) {
    return "https://my.asocks.com/ — кабинет Asocks, не прокси. Положите ASOCKS_API_KEY из кабинета (API) или KRISHA_PROXY=http://login:pass@ip:port";
  }
  return "KRISHA_PROXY не задан — дочитывание с адреса Azure Крыша не отдаёт";
}

function portList(j) {
  if (!j || typeof j !== "object") return [];
  if (Array.isArray(j.data)) return j.data;
  if (Array.isArray(j.message)) return j.message;
  // Настоящая форма ответа /v2/proxy/ports: {success, message:{countProxies,
  // pagination, proxies:[...]}} — message тут объект, а не массив, и список
  // лежит на уровень глубже. Без этого случая portList всегда отдавал пустоту,
  // даже когда success:true и порты реально есть в кабинете.
  if (j.message && Array.isArray(j.message.proxies)) return j.message.proxies;
  if (Array.isArray(j.ports)) return j.ports;
  if (Array.isArray(j)) return j;
  return [];
}

function portHostPort(p) {
  if (!p || typeof p !== "object") return "";
  if (typeof p.proxy === "string" && p.proxy.includes(":")) return p.proxy.trim();
  const host = p.ip || p.host || p.server;
  const port = p.port || p.server_port;
  return host && port ? host + ":" + port : "";
}

function portAuth(p) {
  const login = p.login || p.user || p.username || p.login_name;
  const pass = p.password || p.pass;
  return { login, pass };
}

function pickPort(list) {
  const kz = list.filter((p) => {
    const c = String(p.countryName || p.country_code || p.country || "").toLowerCase();
    return c === "kz" || c.includes("kazakh");
  });
  return kz[0] || list[0] || null;
}

function formatAsocksPort(p) {
  const hostport = portHostPort(p);
  if (!hostport) throw new Error("Asocks не отдал адрес порта");
  const { login, pass } = portAuth(p);
  if (login && pass) {
    return "http://" + encodeURIComponent(String(login)) + ":" + encodeURIComponent(String(pass)) + "@" + hostport;
  }
  return "http://" + hostport;
}

async function asocksProxyUrl(key) {
  const r = await fetch("https://api.asocks.com/v2/proxy/ports?apiKey=" + encodeURIComponent(key) + "&per_page=50", {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || (j && j.success === false)) {
    throw new Error("Asocks API не отдал порты");
  }
  const p = pickPort(portList(j));
  if (!p) throw new Error("в кабинете Asocks нет порта — создайте HTTP-порт (KZ) и повторите");
  return formatAsocksPort(p);
}

async function resolveProxyUrls() {
  const listed = currentUrls();
  if (listed.length) return listed;
  const key = asocksKey();
  if (!key) throw new Error(proxyHint());
  return [await asocksProxyUrl(key)];
}

async function asocksListPorts(key) {
  const r = await fetch("https://api.asocks.com/v2/proxy/ports?apiKey=" + encodeURIComponent(key) + "&per_page=50", {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || (j && j.success === false)) throw new Error("Asocks не отдал порты");
  return portList(j);
}

async function asocksRefreshPort(key, id) {
  const r = await fetch("https://api.asocks.com/v2/proxy/refresh/" + encodeURIComponent(id) +
    "?apiKey=" + encodeURIComponent(key), { signal: AbortSignal.timeout(20000) });
  return r.ok;
}

async function asocksCreatePorts(key, count) {
  // proxy_type_id/type_id обязательны — без них Asocks отвечает 422. 2/1 — то
  // же, что у остальных наших портов (мобильный, резидентный, KZ): смотрели
  // на уже существующий рабочий порт в кабинете и повторили его тип.
  const r = await fetch("https://api.asocks.com/v2/proxy/create-port?apiKey=" + encodeURIComponent(key), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      country_code: "KZ", proxy_type_id: 2, type_id: 1,
      name: "krisha-deepen", count: count,
    }),
    signal: AbortSignal.timeout(30000),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || (j && j.success === false)) {
    throw new Error("Asocks не создал порты" +
      (j && j.errors ? ": " + JSON.stringify(j.errors).slice(0, 200) : ""));
  }
  return portList(j);
}

function urlsFromPorts(list) {
  const out = [];
  for (const p of list || []) {
    try { out.push(formatAsocksPort(p)); } catch { /* битая запись */ }
  }
  return out;
}

function newSessionUrl(raw) {
  try {
    const u = new URL(raw.includes("://") ? raw : "http://" + raw);
    const user = decodeURIComponent(u.username || "");
    const hex = crypto.randomBytes(8).toString("hex");
    const next = /hold-session-session-[a-zA-Z0-9]+/i.test(user)
      ? user.replace(/hold-session-session-[a-zA-Z0-9]+/i, "hold-session-session-" + hex)
      : /session-[a-zA-Z0-9]+/i.test(user)
        ? user.replace(/session-[a-zA-Z0-9]+/i, "session-" + hex)
        : user + "-session-" + hex;
    u.username = next;
    return toHttpProxy(u.toString());
  } catch {
    return raw;
  }
}

async function doRotateProxies() {
  // KRISHA_PROXY_WANT — сколько входов держать в пуле: больше входов —
  // реже 468 на каждом. Новые порты создаются в Asocks при ротации
  // (?rotateProxies=1), это платно, поэтому только по явной переменной.
  const want = Math.max(Number(process.env.KRISHA_PROXY_WANT) || 0, currentUrls().length, 1);
  const key = asocksKey();
  if (key) {
    const listed = await asocksListPorts(key);
    for (const p of listed) {
      const id = p.id || p.portId || p.port_id;
      if (id) await asocksRefreshPort(key, id).catch(() => false);
    }
    let urls = urlsFromPorts(await asocksListPorts(key));
    if (!urls.length && listed.length) urls = urlsFromPorts(listed);
    // Портов меньше, чем хотим (KRISHA_PROXY_WANT), — добираем разницу. Это
    // платно и случается только при ротации, а не на каждом запросе.
    if (urls.length < want) {
      try { urls = urls.concat(urlsFromPorts(await asocksCreatePorts(key, want - urls.length))); }
      catch (e) { console.log("[proxy] добрать порты не вышло: " + String(e.message).slice(0, 120)); }
    }
    const kz = urls.filter((u) => /country-KZ/i.test(u) || /KZ/i.test(u));
    liveUrls = (kz.length ? kz : urls).slice(0, Math.max(want, urls.length));
  } else {
    liveUrls = currentUrls().map(newSessionUrl);
  }
  agentKey = "";
  console.log("[proxy] пул сменили, входов " + liveUrls.length);
  return liveUrls.length;
}

function rotateProxies() {
  if (!rotateWait) rotateWait = doRotateProxies().finally(() => { rotateWait = null; });
  return rotateWait;
}

// avoid — вход, через который только что ответили 468: повтор идёт через
// другой, если входов больше одного. Тот же порт, скорее всего, ответит тем же.
async function dispatcher(avoid) {
  const urls = await resolveProxyUrls();
  if (!urls.length) return undefined;
  const key = urls.join("\n");
  if (agentKey !== key) {
    // Реальный параллелизм упирается в этот предел раньше, чем в сам
    // concurrency: при 5 входах и N соединений на каждый, больше N×5 задач
    // всё равно бегут по очереди у undici, сколько бы их ни запустили разом.
    agents = urls.map((uri) => new ProxyAgent({ uri: uri, connections: 50 }));
    agentKey = key;
    rr = 0;
  }
  let agent = agents[rr % agents.length];
  rr++;
  if (avoid && agent === avoid && agents.length > 1) { agent = agents[rr % agents.length]; rr++; }
  return agent;
}

// --- the brief -------------------------------------------------------------
// City-wide and owner-only: 16 629 listings, against 624 under the narrow
// personal brief. Building type and build year are no longer filtered — the
// model bands by both, so restricting them only starved the comparables.
const CRITERIA = {
  city: "almaty",
  rooms: [1, 2, 3],
  priceFrom: 15000000,
  priceTo: 80000000,
  yearFrom: null,
  buildings: null,
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
  const p = [];
  if (c.priceFrom) p.push("das[price][from]=" + c.priceFrom);
  if (c.priceTo) p.push("das[price][to]=" + c.priceTo);
  if (c.yearFrom) p.push("das[house.year][from]=" + c.yearFrom);
  (c.rooms || []).forEach((r) => p.push("das[live.rooms][]=" + r));
  (c.buildings || []).forEach((b) => p.push("das[flat.building][]=" + b));
  if (c.ownerOnly) p.push("das[who]=1");
  p.push("page=" + page);
  return "https://krisha.kz/prodazha/kvartiry/" + c.city + "/?" + p.join("&");
}

// The card container writes data-id before class, across several lines, so we
// chunk on that opening tag rather than on the class attribute.
function districtOf(addr) {
  const a = String(addr || "");
  const m = a.match(/([А-Яа-яЁё-]+)\s+р-н/) || a.match(/р-н\s+([А-Яа-яЁё-]+)/);
  return m ? m[1] + " р-н" : "без района";
}

function parseCards(html) {
  const re = /<div\s+data-id="(\d+)"\s+data-uuid="([^"]*)"\s+class="(a-card[^"]*)"/g;
  const marks = [];
  let m;
  while ((m = re.exec(html))) marks.push({ id: m[1], uuid: m[2], cls: m[3], at: m.index });
  const out = [];
  for (let i = 0; i < marks.length; i++) {
    const c = html.slice(marks[i].at, marks[i + 1] ? marks[i + 1].at : marks[i].at + 9000);
    const title = clean((c.match(/class="a-card__title[^"]*"[^>]*>([^<]+)</) || [])[1]);
    const price = num((c.match(/class="a-card__price"[^>]*>([^<]+)</) || [])[1]);
    const addr = clean((c.match(/class="a-card__subtitle[^"]*"[^>]*>([^<]+)</) || [])[1]);
    const area = Number(((title.match(/([\d.,]+)\s*м²/) || [])[1] || "").replace(",", "."));
    if (!price || !area || !title) continue;
    // «Срочно, торг» — платная метка, которую ставит сам продавец. Фильтра по
    // ней в форме поиска нет, но она приезжает в классе карточки, так что
    // отбирать можно на нашей стороне.
    const stats = [...c.matchAll(/class="a-card__stats-item"[^>]*>([\s\S]{0,300}?)<\/div>/g)]
      .map((x) => clean(x[1]));
    out.push({
      id: marks[i].id, price, area, addr, title,
      urgent: /(^| )is-urgent( |$)/.test(marks[i].cls || ""),
      label: clean((c.match(/class="a-card__label"[^>]*>([^<]+)</) || [])[1]) || null,
      // дата на карточке — это последнее поднятие, а не публикация
      bumped: stats.find((x) => /^(сегодня|вчера|\d{1,2}\s+[а-яё]+\.?)$/i.test(x)) || null,
      rooms: num((title.match(/(\d+)-комнатная/) || [])[1]),
      // Этаж в заголовке: «... 42 м² · 6/9 этаж, Бурундайская 91». Есть почти
      // у всех, и этого хватает, чтобы завести квартиру в базу, не открывая
      // самого объявления.
      floor: num((title.match(/(\d+)\/(\d+)\s*этаж/) || [])[1]),
      floors: num((title.match(/(\d+)\/(\d+)\s*этаж/) || [])[2]),
      photo: (c.match(/https:\/\/krisha-photos\.kcdn\.online\/[a-z0-9\/-]+?\/\d+-400x300\.jpg/) || [])[0] || null,
      // Папку снимков на CDN и их общее число карточка называет прямо: uuid в
      // своём атрибуте, число — в data-nb у ссылки. Значит всю галерею можно
      // собрать перебором «папка/1..N», ни разу не открыв объявление.
      uuid: marks[i].uuid || null,
      photosNb: num((c.match(/data-nb="(\d+)"/) || [])[1]) || 0,
      ppm: Math.round(price / area),
      pro: /user-label-identified-specialist|user-title-pro/.test(c),
      // В Алматы районы «-ский», в Астане это «Нура р-н» и «р-н Байконур» —
      // под старое правило они не подходили, и весь город уезжал в «без района»,
      // то есть сравнивался сам с собой целиком.
      district: districtOf(addr),
    });
  }
  return out;
}

function parseDetail(html) {
  const d = {};
  for (const m of html.matchAll(/data-name="([^"]+)"[\s\S]{0,400}?offer__advert-short-info"[^>]*>([\s\S]{0,140}?)<\/div>/g)) {
    d[m[1]] = clean(m[2]);
  }
  // «5 из 9» — этаж и этажность. Если продавец не указал этажность, Крыша
  // показывает одно число («9») и не пишет этаж в заголовок объявления —
  // тогда берём хотя бы этаж, а этажность остаётся неизвестной.
  const flRaw = (d["flat.floor"] || "").trim();
  const fl = flRaw.match(/(\d+)\s*из\s*(\d+)/) || (/^\d+$/.test(flRaw) ? [flRaw, flRaw, null] : null);
  // The card shows addedAt — the last bump — which is why every listing on a
  // page reads "today". createdAt is the real one. isAgent is Krisha's own
  // verdict, unlike the das[who]=1 filter which the seller ticks themselves.
  const createdAt = (html.match(/"createdAt"\s*:\s*"(\d{4}-\d{2}-\d{2})"/) || [])[1] || null;
  const addedAt = (html.match(/"addedAt"\s*:\s*"(\d{4}-\d{2}-\d{2})"/) || [])[1] || null;
  const agentM = html.match(/"isAgent"\s*:\s*(true|false)/);
  return {
    createdAt, addedAt,
    isAgent: agentM ? agentM[1] === "true" : null,
    year: num(d["house.year"]) || null,
    building: d["flat.building"] || null,
    renovation: d["flat.renovation"] || null,
    floorRaw: d["flat.floor"] || null,
    floor: fl ? +fl[1] : null,
    floors: fl && fl[2] ? +fl[2] : null,
    toilet: d["flat.toilet"] || null,
  };
}

// Without the district guard a long street like Момышулы matches at its far end
// in Зердели, 15 km away, and Наурызбай matches the district's own name.
// The Abay corridor guess was a stand-in for coordinates we did not have. Now
// that listings are geocoded and an area can be drawn on the map, it no longer
// filters anything out — it only nudges ranking when no box is set.
function locationScore(addr) {
  const a = String(addr || "").toLowerCase();
  if (!NEAR_DISTRICTS.some((s) => a.includes(s))) return { score: 1, why: "Алматы" };
  if (ON_ABAY.test(a)) return { score: 3, why: "адрес на Абая" };
  const hit = CROSSES.find((s) => a.includes(s));
  if (hit) return { score: 2, why: "пересечение с Абая: " + hit };
  return { score: 1, why: "район вдоль Абая" };
}

// Identity of a flat, price deliberately excluded: one flat was found posted
// thirteen times in a day, and a re-post with a nudged price must not read as a
// new find. Price changes are handled separately, as their own event.
const dedupeKey = (c) =>
  [c.district, Math.round(c.area * 10), c.rooms || "?", c.floor || "?", c.floors || "?"].join("|");

const ageBand = (y) =>
  y >= 2020 ? "2020+" : y >= 2010 ? "2010-19" : y >= 2000 ? "2000-09"
  : y >= 1990 ? "1990-99" : y >= 1980 ? "1980-89" : y >= 1960 ? "1960-79" : "до 1960";
// Price per m² falls as flats get bigger, so without an area band a whole
// new-build complex of 74-87 m² reads as a 40% bargain against small old stock.
const areaBand = (a) => (a < 40 ? "<40" : a < 55 ? "40-55" : a < 70 ? "55-70" : a < 90 ? "70-90" : "90+");
const groupKey = (c) => c.district + "|" + (c.building || "?") + "|" + ageBand(c.year) + "|" + areaBand(c.area);
const median = (a) => {
  const s = a.map((x) => x.ppm).filter(Boolean).sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

// Comparables, tried from tightest to loosest. Only a match that controls for
// area counts as solid — that is the one a claim can rest on. Everything looser
// is returned but flagged, because a discount to a mixed bag is not evidence.
function buildModel(corpus) {
  const usable = corpus.filter((c) => c.year && c.ppm && c.area);
  const idx = { full: {}, noArea: {}, distArea: {}, dist: {} };
  const put = (bag, k, c) => ((bag[k] = bag[k] || []).push(c));
  usable.forEach((c) => {
    put(idx.full, groupKey(c), c);
    put(idx.noArea, c.district + "|" + (c.building || "?") + "|" + ageBand(c.year), c);
    put(idx.distArea, c.district + "|" + areaBand(c.area), c);
    put(idx.dist, c.district, c);
  });
  const all = median(usable);

  return function price(c) {
    const ladder = [
      [idx.full[groupKey(c)], (n) => "тот же тип, возраст и площадь в районе (" + n + ")", true],
      // District alone is far too coarse a geography — Медеуский runs from the
      // centre to the mountains — so an area-only match inside it is a hint, not
      // evidence. It produced a 1965 panel in a remote micro-district priced
      // against central stock and called it 49% below market.
      [idx.distArea[c.district + "|" + areaBand(c.area)], (n) => "та же площадь в районе (" + n + ")", false],
      [idx.noArea[c.district + "|" + (c.building || "?") + "|" + ageBand(c.year)],
        (n) => "тот же тип и возраст в районе, площадь любая (" + n + ")", false],
      [idx.dist[c.district], (n) => "район целиком (" + n + ")", false],
    ];
    for (const [g, label, solid] of ladder) {
      if (g && g.length >= 5) return { expected: median(g), basis: label(g.length), solid };
    }
    return { expected: all, basis: "вся выборка (" + usable.length + ")", solid: false };
  };
}

function flagsFor(c) {
  const f = [];
  if (/требует ремонта|черновая/i.test(c.renovation || "")) f.push("требует ремонта");
  if (c.floor === 1) f.push("первый этаж");
  if (c.floor && c.floors && c.floor === c.floors) f.push("последний этаж");
  // Krisha's own isAgent from the listing page beats the card badge: measured on
  // 70 listings they disagree on 22, and the badge over-flags badly — it was
  // disqualifying almost every candidate.
  if (c.isAgent === true) f.push("агентство");
  else if (c.isAgent == null && c.pro) f.push("похоже на агентство");
  return f;
}

async function fetchSearch(maxPages, crit, onPage, opts) {
  const o = opts || {};
  const pace = o.pace || 1300;
  const deadline = o.budgetMs ? Date.now() + o.budgetMs : null;
  const found = new Map();
  let total = null, skipped = 0;
  for (let page = 1; page <= maxPages; page++) {
    // A run that spent 8.6 hours retrying 726 unreachable pages is worse than a
    // partial sweep: search pages get one short attempt, and the whole sweep
    // gets a wall-clock budget.
    if (deadline && Date.now() > deadline) { skipped += maxPages - page + 1; break; }
    let html;
    try {
      html = await fetchText(searchUrl(page, crit), 1, 8000);
    } catch {
      // One unreachable page must not abort the sweep — note it and move on.
      skipped++;
      await sleep(pace);
      continue;
    }
    if (total === null) {
      const m = html.match(/"srchtype":"filter","offset":\d+,"count":(\d+)/);
      if (m) total = +m[1];
    }
    const cards = parseCards(html);
    if (!cards.length) break;
    cards.forEach((c) => found.set(c.id, c));
    if (onPage) onPage(page, found.size, total);
    await sleep(pace);
  }
  return { cards: [...found.values()], total, skipped };
}

// From a datacenter IP Krisha drops connections intermittently — on detail pages
// most often, but search pages too. Every read therefore gets a deadline and two
// backoff retries; without this a single blip killed an entire run.
async function fetchText(url, attempts = 3, timeoutMs = 20000, opts) {
  const useProxy = !!(opts && opts.proxy);
  let last;
  let lastAgent;
  let blocked = 0; // сколько раз ответили 468
  for (let i = 0; i < attempts; i++) {
    const agent = useProxy ? await dispatcher(blocked ? lastAgent : undefined) : undefined;
    if (useProxy && !agent) throw new Error(proxyHint());
    lastAgent = agent;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await (agent ? undiciFetch : fetch)(url, {
        headers: H,
        signal: ctrl.signal,
        ...(agent ? { dispatcher: agent } : {}),
      });
      if (!r.ok) {
        // Тело нам не нужно — рвём соединение сразу, не дочитывая. Страница
        // 468 у Крыши — 231 КБ без сжатия, 404 — ещё 14 КБ; через прокси это
        // чистый расход трафика за ответ, из которого берём только статус.
        try { if (r.body) r.body.cancel().catch(() => {}); } catch { /* уже закрыт */ }
        ctrl.abort();
        const e = new Error("HTTP " + r.status);
        e.status = r.status;
        throw e;
      }
      return await r.text();
    } catch (e) {
      last = e;
      if (e && (e.status === 404 || e.status === 410)) throw e;
      // 468 — не больше двух попыток, и вторая через другой вход прокси:
      // каждая попытка стоит трафика, а после двух отказов подряд третий
      // ничего не меняет — дальше эту страницу возьмёт следующий прогон.
      if (e && e.status === 468 && ++blocked >= 2) throw e;
      if (i < attempts - 1) await sleep(2500 * (i + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw last;
}

// Выдача как сигнал публикации. Первая страница раздела у Крыши отсортирована
// по дате поднятия: свежеопубликованное объявление появляется на ней в ту же
// минуту (вперемешку с платными поднятиями старых). Читаем первые страницы
// основных разделов напрямую с Azure (выдачу Крыша с него отдаёт, это же
// читает ежедневный сбор) и отдаём все id карточек — кого из них нет в базе,
// решает вызывающий. Так объявление, вышедшее из модерации с «старым» id ниже
// курсора скана, попадает в базу через минуту, а не через полчаса повторов.
const FEED_SECTIONS = [
  "/prodazha/kvartiry/", "/arenda/kvartiry/",
  "/prodazha/doma-dachi/", "/arenda/doma-dachi/",
  "/prodazha/kommercheskaya-nedvizhimost/", "/arenda/kommercheskaya-nedvizhimost/",
  "/prodazha/uchastkov/",
];
async function newestFromSearch(sections) {
  const list = sections && sections.length ? sections : FEED_SECTIONS;
  const seen = new Set();
  const ids = [];
  const out = {};
  for (const sec of list) {
    let html;
    try { html = await fetchText("https://krisha.kz" + sec, 1, 10000); } catch (e) { out[sec] = "ошибка: " + (e.status || e.message); continue; }
    let n = 0;
    // Только карточки выдачи (a-card), не «горячие» блоки и не меню.
    for (const m of html.matchAll(/<div\s+data-id="(\d+)"\s+data-uuid="[^"]*"\s+class="a-card/g)) {
      const id = Number(m[1]);
      n++;
      if (id && !seen.has(id)) { seen.add(id); ids.push(id); }
    }
    out[sec] = n;
  }
  return { ids: ids, sections: out };
}

// Krisha publishes its own price comparison — I was wrong earlier to say it does
// not. It is rendered client-side from this fragment, which is why it was
// invisible in the listing HTML. Not disallowed in robots.txt.
//
// Their stated method: build year, room count, district and building type —
// area is not among them, which is exactly why their percentage and ours differ.
async function fetchPriceAnalysis(id) {
  const html = await fetchText("https://krisha.kz/analytics/aPriceAnalysis/?id=" + id);
  // Крыша округляет крупные суммы до «1 млн», и старый разбор читал из этого
  // единицу — в подборке стояло «у похожих 1 ₸/м²». Такие значения помечаем
  // приблизительными, а ноль означает, что похожих рядом не нашлось.
  const money = (re) => {
    const m = html.match(re);
    if (!m) return null;
    const raw = clean(m[1]);
    const mm = raw.match(/^([\d.,]+)\s*млн/i);
    if (mm) return Math.round(Number(mm[1].replace(",", ".")) * 1e6);
    const v = num(raw);
    return v || null;
  };
  const pct = clean(html).match(/На\s+([\d.,]+)%\s+(дешевле|дороже)/i);
  const series = html.match(/chartColumnsData\s*=\s*(\{[\s\S]{0,4000}?\});/);
  let city = null, micro = null;
  if (series) {
    try {
      const j = JSON.parse(series[1]);
      city = j.city || null;
      micro = j.microdistrict || null;
    } catch { /* chart is a bonus, not a requirement */ }
  }
  return {
    kzPpm: money(/class="green-price">([^<]+)/),
    kzApprox: /class="green-price">[^<]*млн/i.test(html),
    kzSimilarLocal: money(/class="blue-price">([^<]+)/),
    kzSimilarCity: money(/class="white-blue-price">([^<]+)/),
    kzDiscount: pct ? (pct[2].toLowerCase() === "дешевле" ? 1 : -1) * Number(pct[1].replace(",", ".")) : null,
    kzCompareUrl: (html.match(/href="(\/prodazha\/kvartiry\/[^"]+)"/) || [])[1] || null,
    trendCity: city, trendMicro: micro,
  };
}

async function fetchDetail(id) {
  const d = parseDetail(await fetchText("https://krisha.kz/a/show/" + id));
  if (!d.year) throw new Error("no build year in page");
  return d;
}

// --- geocoding ---------------------------------------------------------------
// Krisha exposes no coordinates and closed its map (/a/show-map/ is disallowed
// in robots.txt), so a "draw a box on the map" filter has to run on coordinates
// we derive ourselves from addresses we already hold. That also means zero extra
// load on Krisha.
//
// Nominatim's usage policy: identify yourself and stay under one request per
// second. Callers must pace; this only does one request per attempt.
const NOMINATIM_UA = process.env.GEOCODER_UA ||
  "saudager-apartment-watch/0.1 (https://saudager.ai)";

// Address strings look like "Ауэзовский р-н, мкр Аксай-3 7 — Момышулы Толеби".
// The part before "—" is the actual location; the rest is a cross-street hint.
function addressQueries(addr) {
  const raw = String(addr || "").split("—")[0].replace(/^[^,]*р-н,\s*/, "").trim();
  if (!raw) return [];
  const out = [];
  const mkr = raw.match(/мкр\.?\s*([^,]+?)(?:\s+(\d+[а-яa-z]?))?$/i);
  if (mkr) {
    const name = mkr[1].trim(), house = mkr[2];
    if (house) out.push("микрорайон " + name + " " + house + ", Алматы");
    out.push("микрорайон " + name + ", Алматы");
    out.push(name + ", Алматы");
  } else {
    out.push(raw + ", Алматы");
    const noHouse = raw.replace(/\s+\d+[а-яa-z]?(\/\d+)?$/i, "").trim();
    if (noHouse && noHouse !== raw) out.push(noHouse + ", Алматы");
  }
  return [...new Set(out)];
}

async function geocode(addr) {
  for (const q of addressQueries(addr)) {
    const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=kz&q=" +
      encodeURIComponent(q);
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": NOMINATIM_UA, "Accept-Language": "ru" },
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      if (j && j[0]) {
        // A microdistrict resolves to its centre, not the building — worth
        // recording so the UI can say how much to trust the pin.
        const exact = /house|building|apartments|address/i.test(j[0].type || "") || /^\d/.test(q);
        return { lat: +j[0].lat, lon: +j[0].lon, geoQuery: q, geoExact: exact };
      }
    } catch {
      // try the next, looser formulation
    }
    await sleep(1100);
  }
  return null;
}

const inBox = (c, b) =>
  c && b && c.lat >= b.south && c.lat <= b.north && c.lon >= b.west && c.lon <= b.east;

// Порт Asocks для браузера с плагином: portId из запроса (у каждого
// экземпляра Chrome свой порт), иначе KRISHA_BROWSER_PORT_ID, иначе первый
// казахстанский порт из кабинета. refresh — сменить у него выходной IP (адрес
// порта, логин и пароль не меняются, Chrome перенастраивать не нужно).
// Пароль наружу не отдаём: он есть в кабинете Asocks.
// check — заодно сходить через порт на api.ipify.org и вернуть выходной IP
// (exitIp): так видно, что ротация действительно сменила адрес.
function portIdOf(x) { return String(x.id || x.portId || x.port_id || ""); }
function portBrief(p) {
  return { id: p.id || p.portId || p.port_id, name: p.name || null,
           country: p.countryName || p.country_code || p.country || null,
           proxy: portHostPort(p) || null, login: portAuth(p).login || null };
}
async function browserPorts() {
  const key = asocksKey();
  if (!key) return { ok: false, error: "no_proxy", hint: "на сервере нет ASOCKS_API_KEY" };
  const list = await asocksListPorts(key);
  return { ok: true, ports: list.map(portBrief) };
}
async function browserPort(refresh, check, portId) {
  const key = asocksKey();
  if (!key) return { ok: false, error: "no_proxy", hint: "на сервере нет ASOCKS_API_KEY" };
  const list = await asocksListPorts(key);
  const askId = String(portId || "").trim();
  if (askId && !list.some((x) => portIdOf(x) === askId)) {
    return { ok: false, error: "bad_port", hint: "порта " + askId + " нет в кабинете Asocks" };
  }
  const wantId = askId || String(process.env.KRISHA_BROWSER_PORT_ID || "").trim();
  const p = (wantId && list.find((x) => portIdOf(x) === wantId)) || pickPort(list);
  if (!p) return { ok: false, error: "no_port", hint: "в кабинете Asocks нет ни одного порта" };
  const id = p.id || p.portId || p.port_id;
  let rotated = false;
  if (refresh && id) rotated = await asocksRefreshPort(key, id).catch(() => false);
  let exitIp = null, exitErr = null;
  if (check) {
    try {
      const agent = new ProxyAgent(formatAsocksPort(p));
      const r = await undiciFetch("https://api.ipify.org?format=json", { dispatcher: agent, signal: AbortSignal.timeout(20000) });
      exitIp = ((await r.json().catch(() => null)) || {}).ip || null;
      agent.close().catch(() => {});
    } catch (e) { exitErr = String(e.message).slice(0, 120); }
  }
  return { ok: true, rotated: rotated, exitIp: exitIp, exitErr: exitErr, port: portBrief(p) };
}

module.exports = {
  browserPort, browserPorts,
  addressQueries, geocode, inBox,
  H, CRITERIA, NEAR_DISTRICTS, sleep, num, clean, money,
  searchUrl, parseCards, parseDetail, districtOf, locationScore, dedupeKey,
  ageBand, areaBand, groupKey, median, buildModel, flagsFor,
  fetchText, fetchSearch, fetchDetail, fetchPriceAnalysis, newestFromSearch, FEED_SECTIONS,
  viaProxy, proxyHint, proxyCount, rotateProxies, dispatcher, PROXY_FILE,
};
