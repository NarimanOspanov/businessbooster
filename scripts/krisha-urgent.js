// Подборка «Срочно, торг» за сегодня.
//
// Метка платная, ставит её сам продавец, и фильтра по ней в форме поиска нет —
// зато она приезжает в классе карточки, так что отбираем на своей стороне.
// Сама по себе метка ничего не доказывает: на замере из 800 объявлений медиана
// отклонения у «срочных» — 9% против 0% у обычных, а треть из них дороже
// похожих. Поэтому метка здесь только сужает круг, а решает сравнение цены.
//
// Дата на поиске — это последнее поднятие, а не публикация: 9 сентября так
// показались 1012 объявлений, а созданы в этот день были 3. Настоящую дату
// (createdAt) знает только карточка объявления, поэтому её читаем — но лишь у
// верхушки отранжированного списка, десяток запросов вместо полутора сотен.
//
// Запуск руками: node scripts/krisha-urgent.js --city astana --n 8

const K = require("./krisha-lib.js");

// Город — часть адреса на Крыше, поэтому в него нельзя пускать что угодно:
// принимаем только слаг вида «almaty», «ust-kamenogorsk».
const CITY = "almaty";
const cleanCity = (c) => {
  const s = String(c || "").toLowerCase().trim();
  return /^[a-z][a-z-]{1,39}$/.test(s) ? s : CITY;
};
const NAMES = {
  almaty: "Алматы", astana: "Астана", shymkent: "Шымкент", karaganda: "Караганда",
  aktobe: "Актобе", atyrau: "Атырау", taraz: "Тараз", pavlodar: "Павлодар",
  "ust-kamenogorsk": "Усть-Каменогорск", semey: "Семей", kostanay: "Костанай",
  kyzylorda: "Кызылорда", aktau: "Актау", uralsk: "Уральск", kokshetau: "Кокшетау",
  petropavlovsk: "Петропавловск", temirtau: "Темиртау", turkestan: "Туркестан",
  taldykorgan: "Талдыкорган", ekibastuz: "Экибастуз",
};
const cityName = (c) => NAMES[c] || c;
const pageUrl = (city, p) => {
  const base = "https://krisha.kz/prodazha/kvartiry/" + city + "/?das[_sys.hasphoto]=1&das[who]=1";
  return p > 1 ? base + "&page=" + p : base;
};

const MONTHS = [/^янв/, /^февр?/, /^март?/, /^апр/, /^ма[йя]/, /^июн/,
  /^июл/, /^авг/, /^сент?/, /^окт/, /^нояб?/, /^дек/];

// Сегодня по Алматы, а не по часам сервера во Франкфурте.
function almatyToday() {
  const now = new Date(Date.now() + 5 * 3600e3);
  return {
    day: now.getUTCDate(),
    mon: now.getUTCMonth(),
    iso: now.toISOString().slice(0, 10),
  };
}

// «9 сент.», «сегодня» — то, что написано на карточке.
function bumpedToday(text, today) {
  const s = String(text || "").toLowerCase().trim();
  if (!s) return false;
  if (s === "сегодня") return true;
  const m = s.match(/^(\d{1,2})\s+([а-яё]+)\.?$/);
  if (!m) return false;
  return Number(m[1]) === today.day && MONTHS.findIndex((re) => re.test(m[2])) === today.mon;
}

const median = (xs) => {
  const s = xs.slice().sort((a, b) => a - b);
  return s.length ? s[s.length >> 1] : 0;
};
const groupKey = (c) => c.district + "|" + K.areaBand(c.area);

// Обход выдачи: всё, что сегодня показано с сегодняшней датой. Дальше этот
// список используют оба режима — и «новые за сутки», и подборка по цене.
async function sweep(opts) {
  const o = opts || {};
  const pace = o.pace || 1200;
  const maxPages = o.pages || 160;
  const log = o.log || (() => {});
  const today = almatyToday();
  const city = cleanCity(o.city);

  // Все объявления, поднятые сегодня. Сортировка на Крыше — по поднятию,
  // поэтому первая полностью вчерашняя страница обрывает обход.
  const seen = new Map();
  let pages = 0, emptyRun = 0;
  for (let p = 1; p <= maxPages; p++) {
    let html;
    try { html = await K.fetchText(pageUrl(city, p), 2, 12000); } catch { break; }
    const cards = K.parseCards(html);
    if (!cards.length) break;
    pages = p;
    const fresh = cards.filter((c) => bumpedToday(c.bumped, today));
    fresh.forEach((c) => seen.set(c.id, c));
    log("страница " + p + " · сегодняшних " + seen.size);
    // Порядок на Крыше не строго по времени поднятия: платные объявления
    // перемешаны с обычными, и одна пустая страница ещё не конец сегодняшнего
    // дня — на замере после такой страницы находилось ещё несколько десятков.
    emptyRun = fresh.length ? 0 : emptyRun + 1;
    if (emptyRun >= 3) break;
    await K.sleep(pace);
  }
  return {
    today: today.iso, city, cityName: cityName(city), pages,
    cards: [...seen.values()],
  };
}

// Подборка по цене: что дешевле похожих. Тяжёлый режим — читает карточки.
async function collect(opts) {
  const o = opts || {};
  const pace = o.pace || 1200;
  const minComparables = o.minComparables || 8;
  const log = o.log || (() => {});
  const swept = await sweep(o);
  const corpus = swept.cards;
  const today = { iso: swept.today };

  // 2. Цена похожих считается по обычным объявлениям: если сравнивать срочные
  //    со срочными, метка растворяется в базе сравнения. В городах без деления
  //    на районы все объявления попадают в «без района» — сравнение тогда идёт
  //    по городу целиком и метражу, что для города поменьше и правильно.
  const groups = {};
  corpus.filter((c) => !c.urgent).forEach((c) => {
    (groups[groupKey(c)] = groups[groupKey(c)] || []).push(c.ppm);
  });

  // 3. Скидку считаем прямо по карточке: цена и площадь там уже есть, а
  //    карточки объявлений читаем только у верхушки списка — это десяток
  //    запросов вместо полутора сотен.
  const urgent = [];
  for (const c of corpus) {
    if (!c.urgent) continue;
    const g = groups[groupKey(c)] || [];
    if (g.length < minComparables) continue;
    c.expected = median(g);
    c.discount = Math.round((100 * (c.expected - c.ppm)) / c.expected);
    c.comparables = g.length;
    urgent.push(c);
  }
  urgent.sort((a, b) => b.discount - a.discount);

  // 4. Год дома, этаж и настоящая дата публикации есть только в карточке.
  //    Дата на поиске — это поднятие: сегодняшними там показаны и объявления,
  //    висящие месяцами.
  const rows = [];
  let read = 0, freshToday = 0;
  for (const c of urgent.slice(0, o.shortlist || 14)) {
    let d;
    try { d = K.parseDetail(await K.fetchText("https://krisha.kz/a/show/" + c.id, 2, 12000)); }
    catch { await K.sleep(pace); continue; }
    read++;
    Object.assign(c, d);
    c.fresh = c.createdAt === today.iso;
    if (c.fresh) freshToday++;
    c.ageDays = c.createdAt ? Math.floor((Date.parse(today.iso) - Date.parse(c.createdAt)) / 864e5) : null;
    rows.push(c);
    log("карточек прочитано " + read + " из " + Math.min(urgent.length, o.shortlist || 14));
    await K.sleep(pace);
  }

  rows.sort((a, b) => b.discount - a.discount);
  return Object.assign({}, swept, {
    cards: undefined,
    corpus: corpus.length,
    urgentTotal: corpus.filter((c) => c.urgent).length,
    urgentScored: urgent.length, read, freshToday, rows,
  });
}

// Новые за сутки: то же самое, но без оценки цены. Метка «срочно» плюс дата
// публикации — всё, что нужно рубрике «что появилось сегодня».
async function fresh(opts) {
  const o = opts || {};
  const log = o.log || (() => {});
  const swept = await sweep(o);
  const urgent = swept.cards.filter((c) => c.urgent);
  const b = await boundary(swept.cards, o.since || swept.today, { pace: o.pace, log: log });
  const rows = (b.id == null ? [] : urgent.filter((c) => Number(c.id) >= Number(b.id)))
    .sort((a, b2) => Number(b2.id) - Number(a.id));
  return Object.assign({}, swept, {
    cards: undefined,
    corpus: swept.cards.length,
    urgentTotal: urgent.length,
    boundaryId: b.id,
    boundaryReads: b.reads,
    rows,
  });
}

// Дата публикации: id вместо чтения каждой карточки.
//
// Проверено на живых объявлениях: id при продлении не меняется, а растёт со
// временем строго. Объявление с id 683317840 создано в марте 2023-го и сегодня
// поднято заново — id прежний. Значит достаточно найти границу: наименьший id,
// у которого createdAt уже сегодняшний. Всё, что выше, опубликовано за сутки.
//
// Двоичный поиск по отсортированному списку — это десяток запросов вместо
// нескольких сотен, и никакого хранимого состояния: граница пересчитывается
// на каждом прогоне заново.
async function createdAt(id) {
  const html = await K.fetchText("https://krisha.kz/a/show/" + id, 2, 12000);
  return (html.match(/"createdAt"\s*:\s*"(\d{4}-\d{2}-\d{2})"/) || [])[1] || null;
}

async function boundary(cards, sinceIso, opts) {
  const o = opts || {};
  const pace = o.pace || 1200;
  const log = o.log || (() => {});
  const sorted = cards.slice().sort((a, b) => Number(a.id) - Number(b.id));
  let lo = 0, hi = sorted.length - 1, found = null, reads = 0;
  while (lo <= hi && reads < (o.maxReads || 14)) {
    const mid = (lo + hi) >> 1;
    let d = null;
    try { d = await createdAt(sorted[mid].id); } catch { /* объявление могли снять */ }
    reads++;
    log("поиск границы: " + reads + " запрос(ов)");
    if (d == null) { lo = mid + 1; }
    else if (d >= sinceIso) { found = sorted[mid].id; hi = mid - 1; }
    else { lo = mid + 1; }
    await K.sleep(pace);
  }
  return { id: found, reads };
}

// Что из этого годится в канал. Две отсечки, обе выяснились на первом же
// прогоне: «−74%» оказалось недостроем на участке, а «−50%» висело семь
// месяцев — если бы это была выгода, квартиру бы купили. Метка «срочно» на
// объявлении двухлетней давности не означает ничего.
function pick(rows, opts) {
  const o = opts || {};
  const min = o.min == null ? 8 : o.min;
  const max = o.max == null ? 35 : o.max;
  const maxAge = o.maxAge == null ? 30 : o.maxAge;
  return rows
    .filter((c) => c.discount >= min && c.discount <= max)
    .filter((c) => c.ageDays == null || c.ageDays <= maxAge)
    .slice(0, o.n || 8);
}

// Оценка Крыши — независимая проверка нашей. Расходится сильно — значит наша
// база сравнения врёт, и такую квартиру в подборку лучше не ставить.
async function verify(rows, maxGap, pace) {
  const gap = maxGap == null ? 20 : maxGap;
  const out = [];
  for (const c of rows) {
    try { Object.assign(c, await K.fetchPriceAnalysis(c.id)); } catch { /* без проверки */ }
    if (c.kzDiscount != null && c.discount != null && Math.abs(c.discount - c.kzDiscount) > gap) {
      c.skipped = "наша оценка −" + c.discount + "%, у Крыши −" + c.kzDiscount + "%";
    } else {
      out.push(c);
    }
    await K.sleep(pace || 1200);
  }
  return out;
}

function post(rows, dateIso, city) {
  const when = new Date(dateIso + "T00:00:00Z")
    .toLocaleDateString("ru-RU", { timeZone: "UTC", day: "numeric", month: "long" });
  const lines = [
    "🔥 <b>Срочно, торг · " + cityName(cleanCity(city)) + " · " + when + "</b>",
    "",
    "Квартиры от хозяев, где продавец сам поставил метку «Срочно, торг». " +
    "Процент — к цене метра у похожих квартир того же района и метража.",
    "",
  ];
  rows.forEach((c, i) => {
    const head = (i + 1) + ". <b>" + K.money(c.price) + "</b>" +
      (c.discount != null ? " · дешевле похожих на " + c.discount + "%" : "");
    lines.push(head);
    lines.push((c.rooms ? c.rooms + "-комн · " : "") + c.area + " м²" +
      (c.floor ? " · " + c.floor + "/" + c.floors + " этаж" : "") +
      (c.year ? " · " + c.year + " г." : ""));
    lines.push(c.addr);
    lines.push(c.fresh ? "🆕 объявление сегодняшнее"
      : c.ageDays != null ? "на сайте " + (c.ageDays < 30 ? c.ageDays + " дн." : Math.round(c.ageDays / 30) + " мес.")
      : "");
    lines.push(c.ppm.toLocaleString("ru") + " ₸/м²" +
      (c.expected ? " · у похожих " + c.expected.toLocaleString("ru") + " ₸/м²" : "") +
      (c.kzDiscount != null ? " · Крыша: " + (c.kzDiscount >= 0 ? "−" : "+") + Math.abs(c.kzDiscount) + "%" : ""));
    lines.push("https://krisha.kz/a/show/" + c.id);
    lines.push("");
  });
  lines.push("<i>Метку ставит продавец, торг обещает тоже он. Мы лишь показываем, " +
    "как цена выглядит на фоне похожих квартир.</i>");
  return lines.join("\n");
}

// Рубрика «что появилось за сутки». Здесь не заявляется никакой выгоды —
// только факт: объявление новое и продавец сам пометил его «срочно».
function postFresh(rows, dateIso, city) {
  const when = new Date(dateIso + "T00:00:00Z")
    .toLocaleDateString("ru-RU", { timeZone: "UTC", day: "numeric", month: "long" });
  const lines = [
    "🔥 <b>Срочно, торг · " + cityName(cleanCity(city)) + " · " + when + "</b>",
    "",
    "Что появилось за сутки: квартиры от хозяев, где продавец сам поставил " +
    "метку «Срочно, торг».",
    "",
  ];
  rows.forEach((c, i) => {
    lines.push((i + 1) + ". <b>" + K.money(c.price) + "</b> · " +
      (c.rooms ? c.rooms + "-комн · " : "") + c.area + " м² · " +
      c.ppm.toLocaleString("ru") + " ₸/м²");
    lines.push(c.addr);
    lines.push("https://krisha.kz/a/show/" + c.id);
    lines.push("");
  });
  lines.push("<i>Метку ставит продавец, торг обещает тоже он. Цену с рынком " +
    "не сравниваем — смотрите сами.</i>");
  return lines.join("\n");
}

module.exports = {
  sweep, collect, fresh, pick, verify, post, postFresh, boundary, createdAt,
  bumpedToday, almatyToday, cleanCity, cityName,
};

if (require.main === module) {
  const argv = process.argv.slice(2);
  const flag = (n, d) => { const i = argv.indexOf("--" + n); return i === -1 ? d : argv[i + 1]; };
  (async () => {
    if (flag("mode", "deal") === "fresh") {
      const r = await fresh({
        city: flag("city", CITY),
        pages: Number(flag("pages", 220)),
        log: (m) => process.stdout.write("\r" + m + "          "),
      });
      console.log("\n\n" + r.cityName + " · страниц: " + r.pages + " · поднято сегодня: " +
        r.corpus + " · из них со «срочно»: " + r.urgentTotal);
      console.log("граница по id: " + r.boundaryId + " (" + r.boundaryReads + " запросов)");
      console.log("новых за сутки со «срочно»: " + r.rows.length + "\n");
      r.rows.forEach((c) => console.log("  " + (c.rooms || "?") + "к " + c.area + " м²  " +
        (c.price / 1e6).toFixed(1) + " млн  " + c.addr.slice(0, 44) + "  /a/show/" + c.id));
      if (r.rows.length) console.log("\n--- пост ---\n\n" + postFresh(r.rows, r.today, r.city));
      return;
    }
    const r = await collect({
      city: flag("city", CITY),
      pages: Number(flag("pages", 220)),
      shortlist: Number(flag("shortlist", 30)),
      log: (m) => process.stdout.write("\r" + m + "          "),
    });
    console.log("\n\nстраниц: " + r.pages + " · поднято сегодня: " + r.corpus +
      " · из них со «срочно»: " + r.urgentTotal + " (с базой сравнения: " + r.urgentScored + ")");
    console.log("прочитано карточек: " + r.read + " · созданы сегодня: " + r.freshToday + "\n");
    r.rows.forEach((c) => console.log(
      String(c.discount + "%").padStart(5) + "  " +
      String(c.ageDays == null ? "?" : c.ageDays + " дн.").padStart(8) + "  " +
      (c.rooms || "?") + "к " + c.area + " м²  " + (c.price / 1e6).toFixed(1) + " млн  " +
      c.addr.slice(0, 40) + "  /a/show/" + c.id));
    const n = Number(flag("n", 8));
    const top = pick(r.rows, {
      n, min: Number(flag("min", 8)), max: Number(flag("max", 35)), maxAge: Number(flag("age", 30)),
    });
    if (!top.length) return console.log("\nпод порог ничего не прошло");
    const ok = await verify(top, Number(flag("gap", 20)));
    console.log("\n--- пост ---\n");
    console.log(post(ok, r.today, r.city));
  })();
}
