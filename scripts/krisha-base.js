// База квартир от хозяев: по одной короткой записи на объявление, чтобы потом
// узнать свою квартиру в перевыложенном объявлении агента.
//
// Агент переписывает описание, меняет телефон и задирает цену, но площадь,
// этаж, этажность, год и район он не трогает — они и так пришли из оригинала.
// Площадь при этом хранится с десятыми: «52.13 м², 6 из 9, Жетысуский» на весь
// город встречается один раз. Поэтому ключ — параметры, а не фотографии:
// картинку можно перезалить, а 52.13 в объявлении так и останется.
//
// Запись держим короткой. Описание и полный список фотографий тут не нужны:
// когда квартира найдена, её карточку всегда можно перечитать одним запросом,
// а вот шесть тысяч описаний в памяти держать незачем.

const fs = require("fs");
const path = require("path");
const K = require("./krisha-lib.js");

let DIR = path.join(__dirname, "..", "data", "krisha-base");
function dir(d) { if (d) DIR = d; return DIR; }

const num = (s) => {
  const m = String(s == null ? "" : s).replace(",", ".").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};

// «Этаж: 6 из 9», «Площадь: 42 м²» — подписи из блока «О квартире».
function fromShort(short, label) {
  const line = (short || []).find((t) => t.toLowerCase().indexOf(label.toLowerCase()) === 0);
  return line ? line.slice(line.indexOf(":") + 1).trim() : null;
}

// «https://krisha-photos.kcdn.online/webp/1e/1e0e145a-…/3-560x350.jpg»
// -> «webp/1e/1e0e145a-…»
function photoDirOf(url) {
  const m = String(url || "").match(/(webp\/[0-9a-f]{2}\/[0-9a-f-]{36})\//);
  return m ? m[1] : null;
}

// «Наурызбайский р-н, мкр Шугыла 342/1» -> «Шугыла». Микрорайон указан у
// трети адресов, а в Алматы и Астане это привычнее улицы: спрашивают «что есть
// в Коктеме», а не «что есть на Розыбакиева».
function mkrOf(addr) {
  const m = String(addr || "").match(/мкр\.?\s+([^,—]+)/i);
  if (!m) return null;
  // Отрезаем номер дома в конце: «Шугыла 342/1», «Нуркент 9к35», «Мамыр 10».
  const s = m[1].trim().replace(/\s+\d+\S*$/, "").trim();
  return s || null;
}

// Значение из блока «Дополнительно»: там пары «подпись — значение».
function fromParams(params, label) {
  const p = (params || []).find((x) =>
    String(x.label || "").toLowerCase().indexOf(String(label).toLowerCase()) === 0);
  return p ? String(p.value || "").trim() || null : null;
}

// «да» / «нет» в человеческом написании -> true / false / null.
function yesNo(v) {
  const s = String(v == null ? "" : v).toLowerCase().trim();
  if (!s) return null;
  if (/^(да|есть|yes)/.test(s)) return true;
  if (/^(нет|no)/.test(s)) return false;
  return null;
}

const numOf = (s) => {
  const m = String(s == null ? "" : s).replace(",", ".").match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};

// Хвост заголовка — это место: «… 11/12 этаж, Абая 155 — Розыбакиева» либо
// просто перекрёсток без дома, «Абая — Абая Розыбакиева». Хранится отдельно от
// адреса, потому что в адресе улицы может не быть вовсе, а тут она есть, и
// искать по ней люди хотят так же, как по району.
function streetOf(title) {
  const t = String(title || "").trim();
  let m = t.match(/этаж,\s*(.+)$/i);
  if (!m) m = t.match(/м²\s*,\s*(.+)$/i);
  if (!m) return null;
  const s = m[1].trim().replace(/\s+/g, " ");
  return s.length > 1 ? s.slice(0, 160) : null;
}

// card — карточка из выдачи (комнаты, площадь, район, цена), detail — разбор
// страницы объявления (год, тип дома, этаж), photos — только счёт и первая.
function record(card, detail, extra) {
  const e = extra || {};
  const floors = detail && detail.floors ? detail.floors : num(fromShort(e.short, "Этаж") || "");
  return {
    id: String(card.id),
    city: e.city || null,
    rooms: card.rooms || null,
    area: card.area || null,
    floor: (detail && detail.floor) || null,
    floors: floors || null,
    year: (detail && detail.year) || null,
    house: (detail && detail.building) || fromShort(e.short, "Тип дома"),
    complex: fromShort(e.short, "Жилой комплекс"),
    cond: (detail && detail.renovation) || fromShort(e.short, "Состояние"),
    district: card.district || null,
    price: card.price || null,
    addr: card.addr || null,
    title: e.title || card.title || null,
    photos: e.photos || 0,
    ph1: e.ph1 || null,
    // Папка снимков на CDN: у объявления она одна на все фотографии, а имена
    // файлов — номера. Зная папку, галерею можно собрать перебором, не
    // открывая объявление.
    photoDir: e.photoDir || photoDirOf(e.ph1) || photoDirOf(e.photoSrc) || null,
    mkr: mkrOf(card.addr) || mkrOf(e.title) || null,
    street: streetOf(e.title || card.title),

    // Подробности со страницы объявления. Площадь кухни и высота потолков —
    // сильные различители: агент, перевыкладывая, их не переписывает. «Бывшее
    // общежитие» резко меняет цену, поэтому без него сравнение врёт.
    // isAgent — оценка самой Крыши, и она расходится с галочкой «от хозяина»,
    // которую ставит продавец: звонок агенту вместо хозяина — потраченное зря
    // время.
    kitchen: numOf((fromShort(e.short, "Площадь") || "").split(/кухни/i)[1]),
    ceiling: numOf(fromParams(e.params, "Высота потолков") || fromShort(e.short, "Высота потолков")),
    toilet: (detail && detail.toilet) || fromShort(e.short, "Санузел") || fromParams(e.params, "Санузел"),
    balcony: fromShort(e.short, "Балкон") || fromParams(e.params, "Балкон"),
    dorm: yesNo(fromParams(e.params, "Бывшее общежитие") || fromShort(e.short, "Бывшее общежитие")),
    // «полностью», «частично», «без мебели» — храним как сказано, а не как да/нет.
    furnished: fromParams(e.params, "Квартира меблирована"),
    parking: fromShort(e.short, "Парковка") || fromParams(e.params, "Парковка"),
    isAgent: detail && detail.isAgent == null ? null : !!(detail && detail.isAgent),
    created: (detail && detail.createdAt) || null,
    seen: new Date().toISOString().slice(0, 10),
  };
}

const dayFile = (day) => path.join(DIR, day + ".json");

function saveDay(day, records) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    let all = {};
    try { all = JSON.parse(fs.readFileSync(dayFile(day), "utf8")); } catch { /* первый за день */ }
    for (const r of records) all[r.id] = r;
    fs.writeFileSync(dayFile(day), JSON.stringify(all), "utf8");
    return Object.keys(all).length;
  } catch {
    return 0;
  }
}

// Крыша отдаёт карточки не всегда: на замере четверть запросов вернула защиту
// от ботов. Для базы это дыра в покрытии, а второй раз те же квартиры в
// «сегодняшних» уже не окажутся — они станут вчерашними. Поэтому промахи
// складываем отдельно и досняем на следующих прогонах.
const PEND = () => path.join(DIR, "pending.json");

function readPending() {
  try { return JSON.parse(fs.readFileSync(PEND(), "utf8")); } catch { return {}; }
}

function markPending(ids, city) {
  const p = readPending();
  for (const id of ids) {
    const e = p[String(id)] || { city: city, tries: 0 };
    e.tries += 1;
    e.city = e.city || city;
    e.at = new Date().toISOString();
    // Пять неудач подряд — объявление, скорее всего, снято, а не заблокировано.
    if (e.tries > 5) delete p[String(id)]; else p[String(id)] = e;
  }
  try { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(PEND(), JSON.stringify(p), "utf8"); } catch { /* только чтение */ }
}

function clearPending(ids) {
  const p = readPending();
  let touched = false;
  for (const id of ids) if (p[String(id)]) { delete p[String(id)]; touched = true; }
  if (touched) { try { fs.writeFileSync(PEND(), JSON.stringify(p), "utf8"); } catch { /* только чтение */ } }
}

// Что доснять в этом прогоне: чужие города не берём, чтобы не путать выборку.
function pendingFor(city, limit) {
  const p = readPending();
  const have = new Set(all(0).map((r) => r.id));
  return Object.keys(p)
    .filter((id) => !have.has(id) && (!p[id].city || p[id].city === city))
    .sort((a, b) => p[a].tries - p[b].tries)
    .slice(0, limit || 60);
}

// Всё, что накопили, одним индексом в памяти. Записи короткие, шесть тысяч
// занимают пару мегабайт, поэтому проще держать целиком, чем ходить на диск.
let cache = { at: 0, rows: [] };
function all(maxAgeMs) {
  const ttl = maxAgeMs == null ? 60000 : maxAgeMs;
  if (Date.now() - cache.at < ttl && cache.rows.length) return cache.rows;
  const rows = [];
  let files = [];
  try { files = fs.readdirSync(DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort(); } catch { /* пусто */ }
  for (const f of files) {
    try {
      const day = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
      for (const id of Object.keys(day)) rows.push(day[id]);
    } catch { /* битый файл не должен ронять поиск */ }
  }
  cache = { at: Date.now(), rows: rows };
  return rows;
}

function stats() {
  const rows = all();
  const byCity = {};
  rows.forEach((r) => { byCity[r.city || "?"] = (byCity[r.city || "?"] || 0) + 1; });
  const days = [...new Set(rows.map((r) => r.seen))].sort();
  return { total: rows.length, cities: byCity, days: days.length, from: days[0] || null, to: days[days.length - 1] || null };
}

// Поиск. Жёсткое условие одно — площадь: она приезжает из оригинала и почти
// никогда не меняется. Остальное складывается в счёт, потому что район агент
// иногда пишет свой, а год может и потерять.
function search(q, opts) {
  const o = opts || {};
  const area = num(q.area);
  const tol = area == null ? 0 : (String(q.area).indexOf(".") === -1 ? 0.9 : 0.35);
  const rows = all(o.ttl);
  const out = [];
  for (const r of rows) {
    if (area != null && r.area != null && Math.abs(r.area - area) > tol) continue;
    let score = area != null ? 3 : 0;
    const why = area != null ? ["площадь " + r.area] : [];
    if (q.rooms && r.rooms) {
      if (Number(q.rooms) !== r.rooms) continue;
      score += 2; why.push(r.rooms + "-комн");
    }
    if (q.floor && r.floor) {
      if (Number(q.floor) !== r.floor) continue;
      score += 2; why.push("этаж " + r.floor);
    }
    if (q.floors && r.floors) {
      if (Number(q.floors) !== r.floors) continue;
      score += 1; why.push("из " + r.floors);
    }
    if (q.year && r.year && Number(q.year) === r.year) { score += 1; why.push(r.year + " г."); }
    if (q.district && r.district &&
        String(q.district).toLowerCase().slice(0, 6) === String(r.district).toLowerCase().slice(0, 6)) {
      score += 1; why.push(r.district);
    }
    if (q.complex && r.complex &&
        String(q.complex).toLowerCase() === String(r.complex).toLowerCase()) { score += 1; why.push(r.complex); }
    if (q.photos && r.photos && Math.abs(q.photos - r.photos) <= 1) { score += 1; why.push(r.photos + " фото"); }
    out.push({ score: score, why: why, row: r });
  }
  out.sort((a, b) => b.score - a.score || Number(b.row.id) - Number(a.row.id));
  return out.slice(0, o.limit || 10);
}

// Объявление, которое присылает покупатель, разбираем тем же кодом, которым
// снимаем свои, — и сразу получаем всё, по чему искать.
async function queryFromUrl(url) {
  const id = (String(url).match(/\/a\/show\/(\d+)/) || [])[1];
  if (!id) throw new Error("это не ссылка на объявление");
  const Card = require("./krisha-card.js");
  const html = await K.fetchText("https://krisha.kz/a/show/" + id, 3, 15000);
  const c = Card.parse(html, id);
  const d = K.parseDetail(html);
  const t = c.title || "";
  return {
    id: id,
    rooms: num((t.match(/(\d+)-комнатная/) || [])[1]),
    area: num((t.match(/([\d.,]+)\s*м²/) || [])[1]),
    floor: d.floor || null,
    floors: d.floors || null,
    year: d.year || null,
    // На странице объявления адреса как отдельного поля нет, зато район стоит
    // в строке «Город: Алматы, Бостандыкский р-н».
    district: K.districtOf(fromShort(c.short, "Город") || c.addr || t),
    complex: fromShort(c.short, "Жилой комплекс"),
    photos: (c.photos || []).length,
    title: t,
    price: c.price || null,
  };
}

module.exports = {
  dir, record, saveDay, photoDirOf, mkrOf, streetOf, fromParams, all, stats, search, queryFromUrl, fromShort,
  markPending, clearPending, pendingFor, readPending,
};
