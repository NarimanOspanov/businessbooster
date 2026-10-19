// Год постройки для объявлений из обхода списка (в списке Крыши его нет).
// Берём из объявлений, которые мы разбирали подробно (krisha_objects: год и
// координаты): сначала по ЖК (complex_id — год один на весь комплекс, src
// 'cx'), иначе по ближайшему объявлению в пределах 25 м — почти наверняка тот
// же дом (src 'nb', на странице «≈»). Рядом могут стоять дома разных лет,
// поэтому «≈», а при разбросе берём ближайший.
const NEAR_M = 25;
const CELL = 0.0005; // ~55 м по широте — сетка для поиска соседей

function index(objs) {
  const grid = new Map(), byCx = new Map();
  for (const o of objs) {
    const k = Math.floor(o.lat / CELL) + ":" + Math.floor(o.lon / CELL);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(o);
    if (o.cx) {
      const c = String(o.cx);
      if (!byCx.has(c)) byCx.set(c, []);
      byCx.get(c).push(o.y);
    }
  }
  return { grid, byCx };
}

// Самый частый год (при равенстве — более поздний).
function mode(ys) {
  const n = new Map();
  for (const y of ys) n.set(y, (n.get(y) || 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
}

function infer(l, idx) {
  if (l.cx && idx.byCx.has(String(l.cx))) return { y: mode(idx.byCx.get(String(l.cx))), src: "cx" };
  if (l.lat == null || l.lon == null) return null;
  const ci = Math.floor(l.lat / CELL), cj = Math.floor(l.lon / CELL);
  const kx = 111000, ky = 111000 * Math.cos((Number(l.lat) * Math.PI) / 180);
  let best = null;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    for (const o of idx.grid.get((ci + a) + ":" + (cj + b)) || []) {
      const d = Math.hypot((o.lat - l.lat) * kx, (o.lon - l.lon) * ky);
      if (d <= NEAR_M && (!best || d < best.d)) best = { d, y: o.y };
    }
  }
  return best ? { y: best.y, src: "nb" } : null;
}

// Один проход: до limit строк без проверки (или неизвестных, проверенных давно).
async function fillYears(db, opts) {
  const limit = (opts && opts.limit) || 20000;
  const objs = await db.listYearSources();
  const idx = index(objs);
  const todo = await db.listYearTodo(limit);
  const out = todo.map((l) => { const r = infer(l, idx); return { id: l.id, y: r ? r.y : null, src: r ? r.src : null }; });
  await db.listYearSave(out);
  return { sources: objs.length, checked: out.length, found: out.filter((x) => x.y).length };
}

module.exports = { fillYears, infer, index };
