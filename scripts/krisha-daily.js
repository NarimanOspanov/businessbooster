// How many flats actually appear per day, and how many of them are worth a post.
// Usage: node scripts/krisha-daily.js [--district almaty-almalinskij] [--rooms 2] [--days 4]
//
// Krisha's card date is the last bump, so every listing on a page reads "today".
// The real creation date lives in the detail page as createdAt. Listing ids grow
// over time, so we sort ids descending and read details from the newest down
// until we are past the window — a few dozen requests instead of thousands.

const fs = require("fs");
const path = require("path");
const K = require("./krisha-lib.js");

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf("--" + n); return i === -1 ? d : argv[i + 1]; };
const DISTRICT = flag("district", "almaty-almalinskij");
const ROOMS = flag("rooms", "2");
const DAYS = Number(flag("days", 4));
const MAX_DETAILS = Number(flag("max", 260));
const OUT = flag("out", path.join(__dirname, "out", "krisha-daily.json"));

const H = K.H;
const day = (d) => d.toISOString().slice(0, 10);
const today = new Date();
const windowStart = new Date(today.getTime() - (DAYS - 1) * 864e5);

function searchUrl(page) {
  return "https://krisha.kz/prodazha/kvartiry/" + DISTRICT + "/?das[live.rooms][]=" + ROOMS + "&page=" + page;
}

(async () => {
  console.log("Район: " + DISTRICT + " · комнат: " + ROOMS + " · окно: " + DAYS + " дн.\n");

  // 1. every id under the filter
  const byId = new Map();
  let total = null;
  for (let page = 1; page <= 200; page++) {
    let html;
    try { html = await K.fetchText(searchUrl(page)); } catch { break; }
    if (total === null) {
      const m = html.match(/"srchtype":"filter","offset":\d+,"count":(\d+)/);
      total = m ? +m[1] : null;
      console.log("объявлений по фильтру: " + total);
    }
    const cards = K.parseCards(html);
    if (!cards.length) break;
    cards.forEach((c) => byId.set(c.id, c));
    process.stdout.write("\rстраница " + page + " · собрано " + byId.size);
    await K.sleep(1300);
  }
  console.log("\n");

  // 2. newest ids first — ids grow with time, so this reaches the fresh ones fast
  const ordered = [...byId.values()].sort((a, b) => Number(b.id) - Number(a.id));

  const perDay = {}, agentPerDay = {}, samples = [];
  let read = 0, older = 0;
  for (const c of ordered) {
    if (read >= MAX_DETAILS) break;
    let d;
    try { d = await K.fetchDetail(c.id); } catch { await K.sleep(1200); continue; }
    read++;
    Object.assign(c, d);
    if (c.createdAt) {
      perDay[c.createdAt] = (perDay[c.createdAt] || 0) + 1;
      if (c.isAgent) agentPerDay[c.createdAt] = (agentPerDay[c.createdAt] || 0) + 1;
      if (new Date(c.createdAt) >= windowStart) samples.push(c);
      else older++;
    }
    if (read % 10 === 0) process.stdout.write("\r  прочитано " + read + " · в окне " + samples.length + " · старше " + older);
    // Stop once a solid run of consecutive listings falls outside the window
    if (older >= 40) break;
    await K.sleep(1200);
  }
  console.log("\r  прочитано " + read + " · в окне " + samples.length + " · старше окна " + older + "\n");

  // 3. how many of the fresh ones would be worth publishing
  const corpus = samples.filter((c) => c.year);
  const price = K.buildModel(corpus.length >= 20 ? corpus : samples.filter((c) => c.year));
  samples.forEach((c) => {
    if (!c.year) return;
    const p = price(c);
    c.expected = p.expected; c.solid = p.solid;
    c.discount = Math.round((1 - c.ppm / p.expected) * 100);
    c.flags = K.flagsFor(c);
  });

  // A flood of "new today" would mean the whole stock turns over in days, which
  // real estate does not do — so check whether the same flat is being re-posted.
  const dupKey = (c) => [c.area, c.floor, c.floors, c.rooms, Math.round(c.price / 1e5)].join("|");
  const groups = {};
  samples.forEach((c) => (groups[dupKey(c)] = groups[dupKey(c)] || []).push(c));
  const dups = Object.values(groups).filter((g) => g.length > 1);
  console.log("=".repeat(64));
  console.log("ПОВТОРЫ СРЕДИ СВЕЖИХ");
  console.log("=".repeat(64));
  console.log("  уникальных квартир " + Object.keys(groups).length + " из " + samples.length + " объявлений · " +
    "групп-повторов " + dups.length);
  dups.sort((a, b) => b.length - a.length).slice(0, 5).forEach((g) =>
    console.log("    " + g.length + "× " + (g[0].price / 1e6).toFixed(1) + " млн · " + g[0].area + " м² · " +
      g[0].addr.slice(0, 40) + " · " + g.map((x) => x.createdAt).join(", ")));

  console.log("\n" + "=".repeat(64));
  console.log("НОВЫЕ ОБЪЯВЛЕНИЯ ПО ДНЯМ (createdAt)");
  console.log("=".repeat(64));
  const days = [];
  for (let i = 0; i < DAYS; i++) days.push(day(new Date(today.getTime() - i * 864e5)));
  days.forEach((dt, i) => {
    const n = perDay[dt] || 0;
    const ag = agentPerDay[dt] || 0;
    const fresh = samples.filter((c) => c.createdAt === dt);
    const cheap = fresh.filter((c) => c.solid && c.discount >= 12);
    const clean = cheap.filter((c) => !c.flags.length);
    const label = i === 0 ? "сегодня " : i === 1 ? "вчера   " : i === 2 ? "позавчера" : dt;
    console.log("  " + label.padEnd(10) + dt + "  всего " + String(n).padStart(3) +
      " · от агентств " + String(ag).padStart(3) +
      " · дешевле похожих на 12%+ " + String(cheap.length).padStart(2) +
      " · без флагов " + String(clean.length).padStart(2));
  });

  const inWindow = days.reduce((a, d) => a + (perDay[d] || 0), 0);
  const agents = days.reduce((a, d) => a + (agentPerDay[d] || 0), 0);
  console.log("\n  итого за " + DAYS + " дн.: " + inWindow + " новых · " +
    (inWindow ? Math.round((agents / inWindow) * 100) : 0) + "% от агентств · " +
    "в среднем " + (inWindow / DAYS).toFixed(1) + " в день");

  const worth = samples.filter((c) => c.solid && c.discount >= 12 && !c.flags.length);
  console.log("\n  годится в канал: " + worth.length + " за " + DAYS + " дн. = " +
    (worth.length / DAYS).toFixed(1) + " в день");
  worth.sort((a, b) => b.discount - a.discount).slice(0, 6).forEach((c) =>
    console.log("    −" + c.discount + "%  " + (c.price / 1e6).toFixed(1) + " млн · " + c.area + " м² · " +
      c.building + " " + c.year + " · " + c.addr.slice(0, 44) + "  " + c.createdAt));

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    builtAt: new Date().toISOString(), district: DISTRICT, rooms: ROOMS, days: DAYS,
    totalOnSite: total, detailsRead: read, perDay, agentPerDay,
    worth: worth.map((c) => ({ id: c.id, price: c.price, discount: c.discount, addr: c.addr, createdAt: c.createdAt })),
  }, null, 2), "utf8");
  console.log("\nсохранено: " + OUT);
})();
