// Buyer-side apartment agent: pulls a Krisha search, opens every listing card,
// models a fair price per m² from comparable flats and ranks what is actually
// underpriced for what it is.
//
// Usage: node scripts/krisha-agent.js [--pages N] [--out file.json] [--limit N]
//
// A discount to the district median mostly measures building age and condition,
// not value — which is why every card gets opened. All the shared logic lives in
// krisha-lib.js so the scheduled watcher in server.js behaves identically.

const fs = require("fs");
const path = require("path");
const K = require("./krisha-lib.js");

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf("--" + n); return i === -1 ? d : argv[i + 1]; };
const MAX_PAGES = Number(flag("pages", 40));
const LIMIT = Number(flag("limit", 0)); // cap detail fetches while testing
const OUT = flag("out", path.join(__dirname, "out", "krisha-shortlist.json"));

(async () => {
  const c = K.CRITERIA;
  console.log("Критерии: " + c.priceFrom / 1e6 + "-" + c.priceTo / 1e6 + " млн · " +
    c.rooms.join("/") + " комн · дом от " + c.yearFrom + " · кирпич/панель · от хозяев\n");

  const { cards, total } = await K.fetchSearch(MAX_PAGES, c, (page, got, tot) => {
    if (page === 1) console.log("объявлений по фильтру: " + tot);
    process.stdout.write("\rстраница " + page + " · собрано " + got);
  });
  console.log("\n");

  const pros = cards.filter((x) => x.pro).length;
  if (pros) console.log("⚠ помечены как специалисты несмотря на фильтр «от хозяев»: " + pros);

  cards.forEach((x) => (x.loc = K.locationScore(x.addr)));
  const near = cards.filter((x) => x.loc.score > 0);
  console.log("рядом с Абая по адресу: " + near.length + " из " + cards.length);

  const targets = LIMIT ? near.slice(0, LIMIT) : near;
  console.log("\nчитаю карточки…");
  let done = 0, failed = 0;
  for (const x of targets) {
    try { Object.assign(x, await K.fetchDetail(x.id)); } catch { failed++; }
    if (++done % 10 === 0) process.stdout.write("\r  " + done + "/" + targets.length);
    await K.sleep(1200);
  }
  console.log("\r  " + done + "/" + targets.length + " прочитано, ошибок: " + failed + "\n");

  const withYear = targets.filter((x) => x.year);
  console.log("с годом постройки: " + withYear.length);

  const price = K.buildModel(withYear);
  withYear.forEach((x) => {
    const p = price(x);
    Object.assign(x, p, { discount: Math.round((1 - x.ppm / p.expected) * 100), flags: K.flagsFor(x) });
  });

  const weak = withYear.filter((x) => x.discount >= 5 && !x.solid);
  if (weak.length) console.log("отложено (сравнивать было не с чем): " + weak.length);

  const seen = new Set();
  const ranked = withYear
    .filter((x) => x.solid && x.discount >= 5)
    .sort((a, b) => b.loc.score - a.loc.score || b.discount - a.discount)
    .filter((x) => { const k = K.dedupeKey(x); if (seen.has(k)) return false; seen.add(k); return true; });

  console.log("\n" + "=".repeat(72));
  console.log("ПОДБОРКА: " + ranked.length + " вариантов дешевле сопоставимых на 5%+");
  console.log("=".repeat(72));

  ranked.slice(0, 15).forEach((x, i) => {
    console.log("\n" + (i + 1) + ". −" + x.discount + "%  " + K.money(x.price) + "  ·  " +
      x.ppm.toLocaleString("ru") + " ₸/м²  (ожидаемо " + x.expected.toLocaleString("ru") + ")");
    console.log("   " + x.title);
    console.log("   " + x.addr);
    console.log("   " + [x.building, x.year + " г.", x.renovation].filter(Boolean).join(" · "));
    console.log("   " + x.loc.why + " · база: " + x.basis);
    if (x.flags.length) console.log("   ⚠ " + x.flags.join(", "));
    console.log("   https://krisha.kz/a/show/" + x.id);
  });

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    builtAt: new Date().toISOString(), criteria: c,
    totalOnSite: total, scanned: cards.length, nearAbay: near.length, ranked,
  }, null, 2), "utf8");
  console.log("\n\nсохранено: " + OUT);
})();
