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
// Запуск руками: node scripts/krisha-urgent.js --n 8

const K = require("./krisha-lib.js");

const CITY = "almaty";
const BASE = "https://krisha.kz/prodazha/kvartiry/" + CITY +
  "/?das[_sys.hasphoto]=1&das[who]=1";
const pageUrl = (p) => (p > 1 ? BASE + "&page=" + p : BASE);

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

async function collect(opts) {
  const o = opts || {};
  const pace = o.pace || 1200;
  const maxPages = o.pages || 160;
  const minComparables = o.minComparables || 8;
  const log = o.log || (() => {});
  const today = almatyToday();

  // 1. Все объявления, поднятые сегодня. Сортировка на Крыше — по поднятию,
  //    поэтому первая полностью вчерашняя страница обрывает обход.
  const seen = new Map();
  let pages = 0, emptyRun = 0;
  for (let p = 1; p <= maxPages; p++) {
    let html;
    try { html = await K.fetchText(pageUrl(p), 2, 12000); } catch { break; }
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
  const corpus = [...seen.values()];

  // 2. Цена похожих считается по обычным объявлениям: если сравнивать срочные
  //    со срочными, метка растворяется в базе сравнения.
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
  return {
    today: today.iso, pages, corpus: corpus.length,
    urgentTotal: corpus.filter((c) => c.urgent).length,
    urgentScored: urgent.length, read, freshToday, rows,
  };
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

function post(rows, dateIso) {
  const when = new Date(dateIso + "T00:00:00Z")
    .toLocaleDateString("ru-RU", { timeZone: "UTC", day: "numeric", month: "long" });
  const lines = [
    "🔥 <b>Срочно, торг · " + when + "</b>",
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

module.exports = { collect, pick, verify, post, bumpedToday, almatyToday };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const flag = (n, d) => { const i = argv.indexOf("--" + n); return i === -1 ? d : argv[i + 1]; };
  (async () => {
    const r = await collect({
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
    console.log(post(ok, r.today));
  })();
}
