// Ежемесячный замер: сколько хозяев находим для свежих агентских объявлений.
// 100 агентских объявлений, опубликованных последними (Алматы, продажа квартир,
// 2–3 комнаты) → кандидаты-хозяева по параметрам (db.findListOwners, как в боте)
// → сверка фото через OpenAI (тот же промпт, что в photo-match.js).
// Только чтение: в базу ничего не пишет. Итог — в docs/agent-match-history.md.
//   node scripts/agent-match-test.js [N=100]
const path = require("path"), fs = require("fs"), os = require("os");
const B = path.join(__dirname, "..");
const L = require("./krisha-list.js"), db = require("./db.js");
const N = Number(process.argv[2]) || 100;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const KEY = process.env.OPENAI_API_KEY || fs.readFileSync(path.join(os.homedir(), ".openaikey"), "utf8").trim();
const SYSTEM = `Ты сравниваешь фотографии из объявлений о продаже квартир на Крыше.
Сначала идут снимки «Объявление А» — квартира, которую ищут. Дальше — кандидаты под номерами («Кандидат 1», «Кандидат 2», ...), у каждого свои снимки. Определи, у какого из кандидатов на фото та же самая квартира, а не просто похожая: сравнивай узнаваемые детали — кухонный гарнитур, обои, вид из окна, расстановку мебели, напольное покрытие. Одну и ту же квартиру могли переснять другим человеком под другим углом или при другом освещении — это не мешает при совпадении деталей. Разный ремонт или другая планировка при формально совпадающих метраже и этаже — это разные квартиры.
Если фотографий не хватает для вывода, не выдумывай — match:false с низким confidence.
Ответь только JSON-массивом, по объекту на каждого кандидата по порядку:
[{"candidate": "1", "match": true|false, "confidence": 0..1, "why": "коротко, по-русски"}]`;

// фото скачиваем сами: по прямой ссылке OpenAI иногда не успевает забрать снимок с Крыши
async function img(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error("photo " + r.status);
  return { type: "image_url", image_url: { url: "data:image/jpeg;base64," + Buffer.from(await r.arrayBuffer()).toString("base64"), detail: "low" } };
}

async function photoCheck(a) {
  const content = [{ type: "text", text: "Объявление А:" }];
  for (const u of a.photos.slice(0, 4)) { try { content.push(await img(u)); } catch { /* один снимок не критичен */ } }
  if (content.length < 2) return { nophoto: true };
  const order = [];
  for (const c of a.hits) {
    if (!c.photos.length) continue;
    const before = content.length;
    content.push({ type: "text", text: "Кандидат " + (order.length + 1) + ":" });
    for (const u of c.photos.slice(0, 3)) { try { content.push(await img(u)); } catch { /* */ } }
    if (content.length === before + 1) { content.pop(); continue; }
    order.push(c.id);
  }
  if (!order.length) return { nocand: true };
  const rr = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4.1", temperature: 0, messages: [{ role: "system", content: SYSTEM }, { role: "user", content }] }),
  });
  const j = await rr.json();
  if (!rr.ok) throw new Error(rr.status + " " + JSON.stringify(j).slice(0, 150));
  const t = j.choices[0].message.content;
  const arr = JSON.parse((t.match(/\[[\s\S]*\]/) || ["[]"])[0]);
  return { scores: arr.map((r) => ({ id: order[Number(r.candidate) - 1], match: !!r.match, conf: Number(r.confidence) || 0 })) };
}

(async () => {
  await L.loadRegions().catch(() => {});
  const p = await db.getPool();
  const top = Number((await p.request({ requestTimeout: 120000 }).query("SELECT MAX(id) m FROM dbo.krisha_list WITH (NOLOCK)")).recordset[0].m);
  const out = []; let scanned = 0;
  for (let id = top; out.length < N && id > top - 15000; id--) {
    scanned++;
    const r = await L.fetchMapObject(id); await sleep(120);
    if (r.status !== "live" || !r.row) continue;
    const a = r.row;
    if (a.userType === "owner" || a.deal !== "sale" || a.prop !== "flat" || ![2, 3].includes(a.rooms) || a.city !== "almaty") continue;
    const f = (await L.locateFull(a).catch(() => null)) || a;
    if (!f.city) f.city = a.city;
    const hits = (f.lat == null && !f.complexId) ? null : await db.findListOwners({ deal: f.deal, prop: f.prop, area: f.area, rooms: f.rooms,
      floor: f.floor, floors: f.floors, complexId: f.complexId, lat: f.lat, lon: f.lon, id: f.id }, 6);
    out.push({ id: f.id, photos: f.photoUrls || (f.photo1 ? [f.photo1] : []),
      hits: hits && hits.map((h) => ({ id: String(h.id), photos: db.listPhotoUrls(h.photos_c, h.photos_json) })) });
  }
  let sure = 0, any = 0, multi = 0, err = 0;
  for (const a of out) {
    if (!a.hits || !a.hits.length) continue;
    try {
      a.check = await photoCheck(a);
      const ok = (a.check.scores || []).filter((s) => s.match);
      if (ok.length) any++;
      if (ok.length > 1) multi++;
      if (ok.length === 1 && ok[0].conf >= 0.9) sure++;
    } catch (e) { err++; a.check = { err: String(e.message).slice(0, 120) }; }
  }
  const withCand = out.filter((x) => x.hits && x.hits.length).length;
  const line = `| ${new Date().toISOString().slice(0, 10)} | ${out.length} | ${withCand} | ${any} | ${sure} | ${multi} | ${err} | ${scanned} |`;
  const file = path.join(B, "docs", "agent-match-history.md");
  if (!fs.existsSync(file)) fs.writeFileSync(file, "# Поиск хозяина агентских объявлений — ежемесячный замер\n\nАлматы, продажа, 2–3 комнаты, последние опубликованные агентские объявления. Скрипт: scripts/agent-match-test.js.\n\n| дата | выборка | кандидаты по параметрам | фото совпали | уверенно (1 кандидат, ≥0.9) | совпало с несколькими | ошибки сверки | просмотрено номеров |\n|---|---|---|---|---|---|---|---|\n");
  fs.appendFileSync(file, line + "\n");
  console.log(line);
  process.exit(0);
})().catch((e) => { console.log("FATAL", e.message); process.exit(1); });
