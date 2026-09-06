// Занятость квартир из iCal.
//
// Ссылку на календарь отдают все, кто в этом рынке что-то значит: Airbnb,
// Booking, RealtyCalendar, Bnovo, Google Календарь. Поэтому переезд к нам —
// это скопировать одну ссылку, а не отдать нам логин от чужого сервиса.
//
// Свой разбор, а не библиотека: нам нужны три поля из VEVENT, а зависимость
// пришлось бы обновлять и проверять годами.

// Строки в iCal переносятся с отступом — сначала склеиваем обратно.
function unfold(text) {
  return String(text || "").replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}

// 20260908 или 20260908T140000Z -> Date (в UTC, время нам не важно).
function parseStamp(v) {
  const s = String(v || "").trim();
  const m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

const DAY = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);

// Занятые интервалы. DTEND в брони — это день выезда, и он свободен: гость
// уезжает утром, новый заезжает днём. Поэтому конец интервала не включаем.
function parseEvents(text) {
  const out = [];
  for (const block of unfold(text).split("BEGIN:VEVENT").slice(1)) {
    const body = block.split("END:VEVENT")[0];
    const start = parseStamp((body.match(/^DTSTART[^:]*:(.+)$/m) || [])[1]);
    const end = parseStamp((body.match(/^DTEND[^:]*:(.+)$/m) || [])[1]);
    const summary = ((body.match(/^SUMMARY[^:]*:(.+)$/m) || [])[1] || "").trim();
    if (!start) continue;
    out.push({ start: start, end: end || new Date(start.getTime() + DAY), summary: summary });
  }
  return out;
}

async function fetchBusy(url) {
  const r = await fetch(url, {
    headers: { "User-Agent": "Reception365/1.0" },
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error("календарь ответил " + r.status);
  const text = await r.text();
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error("это не iCal");
  return parseEvents(text);
}

function busyOn(events, day) {
  const t = day.getTime();
  return events.some((e) => t >= e.start.getTime() && t < e.end.getTime());
}

// Что ассистенту нужно знать про квартиру на названную дату: свободна ли она,
// сколько ночей подряд свободна и, если занята, когда освободится.
function freeInfo(events, from, horizonDays) {
  const horizon = horizonDays || 60;
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));

  if (busyOn(events, start)) {
    for (let i = 1; i <= horizon; i++) {
      const d = new Date(start.getTime() + i * DAY);
      if (!busyOn(events, d)) return { free: false, free_from: iso(d) };
    }
    return { free: false, free_from: null };
  }

  let nights = 0;
  for (let i = 0; i < horizon; i++) {
    if (busyOn(events, new Date(start.getTime() + i * DAY))) break;
    nights++;
  }
  const until = new Date(start.getTime() + nights * DAY);
  return { free: true, nights: nights, busy_from: nights < horizon ? iso(until) : null };
}

// «сегодня», «завтра», «8 сентября», «08.09», «2026-09-08» — всё, чем люди
// называют дату в разговоре. Считаем от алматинского дня, а не от UTC.
function parseWhen(text, now) {
  const base = now || new Date(Date.now() + 5 * 3600e3);
  const today = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  const s = String(text || "").toLowerCase().trim();

  if (!s || /сегодня|бүгін|today/.test(s)) return today;
  if (/послезавтра|бүрсігүні/.test(s)) return new Date(today.getTime() + 2 * DAY);
  if (/завтра|ертең|tomorrow/.test(s)) return new Date(today.getTime() + DAY);

  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));

  m = s.match(/(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{2,4}))?/);
  if (m) {
    const year = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : today.getUTCFullYear();
    return new Date(Date.UTC(year, +m[2] - 1, +m[1]));
  }

  const MONTHS = ["январ", "феврал", "март", "апрел", "мая|май", "июн", "июл",
    "август", "сентябр", "октябр", "ноябр", "декабр"];
  m = s.match(/(\d{1,2})\s+([а-яё]+)/);
  if (m) {
    const idx = MONTHS.findIndex((x) => new RegExp(x).test(m[2]));
    if (idx >= 0) {
      let d = new Date(Date.UTC(today.getUTCFullYear(), idx, +m[1]));
      // Названный месяц уже прошёл — значит имеют в виду следующий год.
      if (d.getTime() < today.getTime() - 200 * DAY) d = new Date(Date.UTC(d.getUTCFullYear() + 1, idx, +m[1]));
      return d;
    }
  }
  return today;
}

// Анкета хранит календари строками «Название — ссылка». Возвращаем занятость
// по каждой квартире; недоступный календарь не роняет остальные.
async function availability(icalText, when) {
  const day = when instanceof Date ? when : parseWhen(when);
  const lines = String(icalText || "").split("\n").map((x) => x.trim()).filter(Boolean);
  const out = [];
  for (const line of lines) {
    const m = line.match(/(https?:\/\/\S+)/i);
    if (!m) continue;
    const name = line.slice(0, m.index).replace(/[\s—–-]+$/, "").trim() || "Квартира";
    try {
      const events = await fetchBusy(m[1]);
      out.push(Object.assign({ объект: name }, freeInfo(events, day)));
    } catch (e) {
      out.push({ объект: name, ошибка: String(e.message).slice(0, 60) });
    }
  }
  return { дата: iso(day), квартиры: out };
}

module.exports = { availability, fetchBusy, parseEvents, freeInfo, parseWhen, iso };
