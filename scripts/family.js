// Родительский режим: родитель приглашает ребёнка ссылкой, ребёнок подтверждает; родитель видит прогресс,
// ставит цели с наградами и получает недельный отчёт наставника. Ребёнок видит свои цели и может отвязать родителя.
//   POST /api/family/invite            — новая ссылка-приглашение (родитель)
//   GET  /api/family/invite/:code      — кто приглашает (для подтверждения ребёнком)
//   POST /api/family/accept {code}     — ребёнок подтверждает
//   GET  /api/family                   — мои дети и мои родители, цели
//   POST /api/family/unlink {handle}   — отвязать (любая сторона)
//   GET  /api/family/child/:handle     — кабинет ребёнка для родителя: профиль, действия, темы, цели
//   GET  /api/family/report/:handle    — недельный отчёт наставника (кэш на день); ?fresh=1 — пересоставить
//   POST /api/family/goal              — {child, kind, target, topic?, reward?, days?} — новая цель
//   POST /api/family/goal/:id          — {action: rewarded | cancel}
const sql = require("mssql");
const crypto = require("crypto");
const { getPool } = require("./db.js");
const { auth, upsertUser } = require("./me.js");

const send = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); };
const clean = (s, n) => String(s || "").replace(/[<>\u0000-\u001f]/g, " ").trim().slice(0, n);
const nameOf = (u) => u.nick || (u.name || "").split(" ")[0] || u.handle || "ученик";
const pub = (u) => ({ id: u.id, handle: u.handle, name: nameOf(u), image: u.image || null });
const KINDS = { tasks: "выполнить заданий", days: "заниматься дней", streak: "дней подряд", quiz: "тестов «Закрепим» на 3+ из 4", topic: "заданий в теме" };

async function user(pool, id) { return (await pool.request().input("u", sql.Int, id).query("SELECT id, handle, nick, name, image, age, gender, created_at FROM luch.users WHERE id = @u")).recordset[0]; }
async function byHandle(pool, h) { return (await pool.request().input("h", sql.NVarChar(40), String(h || "").toLowerCase().slice(0, 40)).query("SELECT id, handle, nick, name, image, age, gender, created_at FROM luch.users WHERE handle = @h")).recordset[0]; }
async function isParent(pool, parent, child) { return (await pool.request().input("p", sql.Int, parent).input("c", sql.Int, child).query("SELECT 1 x FROM luch.family WHERE parent_id = @p AND child_id = @c")).recordset.length > 0; }

// ---------- прогресс цели считаем по журналу действий ребёнка ----------
async function progress(pool, g) {
  const from = g.created_at, to = g.due_at || new Date(Date.now() + 864e5);
  const rq = () => pool.request().input("c", sql.Int, g.child_id).input("from", sql.DateTime2(0), from).input("to", sql.DateTime2(0), to);
  let n = 0;
  if (g.kind === "tasks") n = (await rq().query("SELECT COUNT(*) n FROM luch.user_events WHERE user_id = @c AND kind = 'task' AND at >= @from AND at <= @to")).recordset[0].n;
  else if (g.kind === "topic") n = (await rq().input("t", sql.NVarChar(80), g.topic || "").query("SELECT COUNT(*) n FROM luch.user_events WHERE user_id = @c AND kind = 'task' AND page = @t AND at >= @from AND at <= @to")).recordset[0].n;
  else if (g.kind === "days") n = (await rq().query("SELECT COUNT(DISTINCT CONVERT(date, at)) n FROM luch.user_events WHERE user_id = @c AND kind <> 'open' AND at >= @from AND at <= @to")).recordset[0].n;
  else if (g.kind === "quiz") {
    const r = await rq().query("SELECT title FROM luch.user_events WHERE user_id = @c AND kind = 'quiz' AND at >= @from AND at <= @to");
    n = r.recordset.filter((x) => { const m = String(x.title).match(/(\d+) из (\d+)/); return m && +m[1] >= 3; }).length;
  } else if (g.kind === "streak") {
    const r = await rq().query("SELECT DISTINCT CONVERT(char(10), at, 23) d FROM luch.user_events WHERE user_id = @c AND kind <> 'open' AND at >= DATEADD(day, -60, SYSUTCDATETIME())");
    const days = new Set(r.recordset.map((x) => x.d)), t = new Date(); const k = (d) => d.toISOString().slice(0, 10);
    if (!days.has(k(t))) t.setUTCDate(t.getUTCDate() - 1);
    while (days.has(k(t))) { n++; t.setUTCDate(t.getUTCDate() - 1); }
  }
  return Math.min(n, g.target);
}
async function goalsOf(pool, where, val) {
  const r = await pool.request().input("v", sql.Int, val).query(`SELECT g.*, p.handle p_handle, p.nick p_nick, p.name p_name, c.handle c_handle, c.nick c_nick, c.name c_name
    FROM luch.goals g JOIN luch.users p ON p.id = g.parent_id JOIN luch.users c ON c.id = g.child_id
    WHERE g.${where} = @v AND g.status IN ('a', 'd') OR (g.${where} = @v AND g.status = 'r' AND g.rewarded_at > DATEADD(day, -14, SYSUTCDATETIME())) ORDER BY g.status, g.created_at DESC`);
  const out = [];
  for (const g of r.recordset) {
    const n = await progress(pool, g);
    if (g.status === "a" && n >= g.target) { // цель достигнута — отмечаем один раз
      await pool.request().input("id", sql.Int, g.id).query("UPDATE luch.goals SET status = 'd', done_at = SYSUTCDATETIME() WHERE id = @id AND status = 'a'"); g.status = "d"; g.done_at = new Date();
    }
    const expired = g.status === "a" && g.due_at && new Date(g.due_at) < new Date();
    out.push({ id: g.id, kind: g.kind, what: KINDS[g.kind] || g.kind, target: g.target, topic: g.topic, reward: g.reward, due: g.due_at, progress: n,
      status: expired ? "expired" : g.status, created: g.created_at, doneAt: g.done_at, parent: { handle: g.p_handle, name: g.p_nick || (g.p_name || "").split(" ")[0] }, child: { handle: g.c_handle, name: g.c_nick || (g.c_name || "").split(" ")[0] } });
  }
  return out;
}
// подпись цели для наставника и отчёта
const goalLine = (g) => `${g.kind === "topic" ? "заданий в теме " + (g.topic || "") : g.what}: ${g.progress} из ${g.target}${g.reward ? " — награда: " + g.reward : ""}${g.status === "d" ? " (достигнута)" : ""}`;

// ---------- данные ребёнка для родителя ----------
async function childData(pool, cid) {
  const [ev, st] = await Promise.all([
    pool.request().input("u", sql.Int, cid).query("SELECT TOP 2000 at, kind, page, lesson, title, detail FROM luch.user_events WHERE user_id = @u AND at > DATEADD(day, -372, SYSUTCDATETIME()) ORDER BY at DESC"),
    pool.request().input("u", sql.Int, cid).query("SELECT k, v FROM luch.user_state WHERE user_id = @u AND k LIKE 'luch-%'"),
  ]);
  const state = {}; for (const r of st.recordset) state[r.k] = r.v;
  return { events: ev.recordset, state };
}

// ---------- недельный отчёт наставника ----------
const REPORT = `Ты — наставник Open Lab AI (интерактивные уроки: теория «Объясни за минуту», опыт, 3D, мини-тесты). Пиши ОТЧЁТ ДЛЯ РОДИТЕЛЯ о том, как его ребёнок занимался за последние 7 дней.
Тон: тёплый, конкретный, без канцелярита и без воды; обращайся к родителю на «вы», о ребёнке — по имени и в правильном роде.
Опирайся только на данные. Если занятий мало или не было — скажи это мягко и предложи, как помочь начать (например, 10 минут вместе на одном уроке).
Ответ — строго JSON: {"summary":"1 предложение: сколько занимался и главное","good":"что получается (темы, тесты) — 1–2 предложения","improve":"что подтянуть и что я как наставник предложу — 1–2 предложения","advice":"совет родителю, как поддержать и похвалить, с учётом целей — 1 предложение"}`;
function weekStart() { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d; }
async function report(pool, child, fresh) {
  const ws = weekStart();
  if (!fresh) {
    const c = (await pool.request().input("c", sql.Int, child.id).input("w", sql.Date, ws).query("SELECT body, created_at FROM luch.parent_reports WHERE child_id = @c AND week_start = @w")).recordset[0];
    if (c && Date.now() - new Date(c.created_at) < 20 * 3600e3) return { ...JSON.parse(c.body), at: c.created_at };
  }
  const ev = (await pool.request().input("c", sql.Int, child.id).query("SELECT at, kind, title, detail FROM luch.user_events WHERE user_id = @c AND kind <> 'open' AND at > DATEADD(day, -7, SYSUTCDATETIME()) ORDER BY at")).recordset;
  const goals = await goalsOf(pool, "child_id", child.id);
  const days = new Set(ev.map((e) => new Date(e.at).toISOString().slice(0, 10))).size;
  const facts = `Ребёнок: ${nameOf(child)}${child.age ? ", " + child.age + " лет" : ""}${child.gender ? ", " + (child.gender === "f" ? "девочка" : "мальчик") : ""}.
Дней с занятиями за неделю: ${days}. Действий: ${ev.length}.
Действия (дата: что): ${ev.slice(-60).map((e) => new Date(e.at).toISOString().slice(5, 10) + ": " + e.title + (e.detail ? " (" + e.detail + ")" : "")).join("; ") || "нет"}.
Цели от родителя: ${goals.map(goalLine).join("; ") || "нет"}.`;
  let j;
  try { const { oneShot, jsonOf } = require("./tutor.js"); j = jsonOf(await oneShot(REPORT, facts)); }
  catch (e) { console.log("[family] report " + (e && e.message)); j = { summary: days ? `За неделю ${nameOf(child)} занимал${child.gender === "f" ? "ась" : "ся"} ${days} дн.` : "На этой неделе занятий пока не было.", good: "", improve: "", advice: "" }; }
  const body = JSON.stringify({ summary: clean(j.summary, 400), good: clean(j.good, 500), improve: clean(j.improve, 500), advice: clean(j.advice, 400) });
  await pool.request().input("c", sql.Int, child.id).input("w", sql.Date, ws).input("b", sql.NVarChar(sql.MAX), body).query(`MERGE luch.parent_reports t USING (SELECT @c c, @w w) s ON t.child_id = s.c AND t.week_start = s.w
    WHEN MATCHED THEN UPDATE SET body = @b, created_at = SYSUTCDATETIME() WHEN NOT MATCHED THEN INSERT (child_id, week_start, body) VALUES (@c, @w, @b);`);
  return { ...JSON.parse(body), at: new Date() };
}

async function body(req, readBody) { try { return JSON.parse(await readBody(req)) || {}; } catch { return {}; } }

async function handle(req, res, { readBody }) {
  const url = new URL(req.url, "http://x"), p = url.pathname.replace(/\/+$/, ""), M = req.method;
  let claims; try { claims = await auth(req); } catch { claims = null; }
  if (!claims) return send(res, 401, { ok: false, error: "нужно войти" });
  const pool = await getPool();
  const me = (await upsertUser(pool, claims, null)).id;
  let m;

  if (p === "/api/family/invite" && M === "POST") {
    const code = crypto.randomBytes(6).toString("base64").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8).padEnd(8, "Z");
    await pool.request().input("c", sql.Char(8), code).input("p", sql.Int, me).query("INSERT INTO luch.family_invites (code, parent_id) VALUES (@c, @p)");
    return send(res, 200, { ok: true, code });
  }
  if ((m = p.match(/^\/api\/family\/invite\/([A-Za-z0-9]{8})$/)) && M === "GET") {
    const r = (await pool.request().input("c", sql.Char(8), m[1].toUpperCase()).query("SELECT i.parent_id, i.used_by, i.created_at, u.nick, u.name, u.handle, u.image FROM luch.family_invites i JOIN luch.users u ON u.id = i.parent_id WHERE i.code = @c")).recordset[0];
    if (!r) return send(res, 404, { ok: false, error: "приглашение не найдено" });
    if (r.used_by || Date.now() - new Date(r.created_at) > 14 * 864e5) return send(res, 410, { ok: false, error: "приглашение уже использовано или устарело — попросите новое" });
    return send(res, 200, { ok: true, parent: { name: r.nick || (r.name || "").split(" ")[0] || r.handle, image: r.image }, self: r.parent_id === me });
  }
  if (p === "/api/family/accept" && M === "POST") {
    const code = clean((await body(req, readBody)).code, 8).toUpperCase();
    const inv = (await pool.request().input("c", sql.Char(8), code).query("SELECT parent_id, used_by, created_at FROM luch.family_invites WHERE code = @c")).recordset[0];
    if (!inv || inv.used_by || Date.now() - new Date(inv.created_at) > 14 * 864e5) return send(res, 410, { ok: false, error: "приглашение не найдено или устарело" });
    if (inv.parent_id === me) return send(res, 400, { ok: false, error: "это ваше приглашение — отправьте ссылку ребёнку" });
    await pool.request().input("p", sql.Int, inv.parent_id).input("c", sql.Int, me).input("code", sql.Char(8), code).query(`
      IF NOT EXISTS (SELECT 1 FROM luch.family WHERE parent_id = @p AND child_id = @c) INSERT INTO luch.family (parent_id, child_id) VALUES (@p, @c);
      UPDATE luch.family_invites SET used_by = @c, used_at = SYSUTCDATETIME() WHERE code = @code;`);
    return send(res, 200, { ok: true });
  }
  if (p === "/api/family" && M === "GET") {
    const [kids, pars] = await Promise.all([
      pool.request().input("u", sql.Int, me).query("SELECT u.id, u.handle, u.nick, u.name, u.image, u.last_seen FROM luch.family f JOIN luch.users u ON u.id = f.child_id WHERE f.parent_id = @u ORDER BY f.created_at"),
      pool.request().input("u", sql.Int, me).query("SELECT u.id, u.handle, u.nick, u.name, u.image FROM luch.family f JOIN luch.users u ON u.id = f.parent_id WHERE f.child_id = @u ORDER BY f.created_at"),
    ]);
    const children = [];
    for (const k of kids.recordset) {
      const wk = (await pool.request().input("c", sql.Int, k.id).query("SELECT COUNT(DISTINCT CONVERT(date, at)) d, SUM(CASE WHEN kind = 'task' THEN 1 ELSE 0 END) t FROM luch.user_events WHERE user_id = @c AND kind <> 'open' AND at > DATEADD(day, -7, SYSUTCDATETIME())")).recordset[0];
      children.push({ ...pub(k), seen: k.last_seen, weekDays: wk.d || 0, weekTasks: wk.t || 0, goals: await goalsOf(pool, "child_id", k.id) });
    }
    return send(res, 200, { ok: true, children, parents: pars.recordset.map(pub), myGoals: await goalsOf(pool, "child_id", me) });
  }
  if (p === "/api/family/unlink" && M === "POST") {
    const u = await byHandle(pool, (await body(req, readBody)).handle); if (!u) return send(res, 404, { ok: false, error: "не найден" });
    await pool.request().input("a", sql.Int, me).input("b", sql.Int, u.id).query("DELETE FROM luch.family WHERE (parent_id = @a AND child_id = @b) OR (parent_id = @b AND child_id = @a)");
    return send(res, 200, { ok: true });
  }
  if ((m = p.match(/^\/api\/family\/(child|report)\/([a-z0-9-]{2,40})$/)) && M === "GET") {
    const c = await byHandle(pool, m[2]);
    if (!c || !(await isParent(pool, me, c.id))) return send(res, 403, { ok: false, error: "это не ваш ребёнок или связь отключена" });
    if (m[1] === "report") return send(res, 200, { ok: true, report: await report(pool, c, url.searchParams.get("fresh") === "1") });
    const d = await childData(pool, c.id);
    return send(res, 200, { ok: true, user: { ...pub(c), nick: nameOf(c), age: c.age, created_at: c.created_at }, events: d.events, state: d.state, goals: await goalsOf(pool, "child_id", c.id) });
  }
  if (p === "/api/family/goal" && M === "POST") {
    const b = await body(req, readBody), c = await byHandle(pool, b.child);
    if (!c || !(await isParent(pool, me, c.id))) return send(res, 403, { ok: false, error: "это не ваш ребёнок" });
    if (!KINDS[b.kind]) return send(res, 400, { ok: false, error: "выберите, какая цель" });
    const target = Math.round(+b.target); if (!(target >= 1 && target <= 500)) return send(res, 400, { ok: false, error: "сколько — число от 1 до 500" });
    const topic = b.kind === "topic" ? clean(b.topic, 80) : null; if (b.kind === "topic" && !/^\/labs\/[a-z0-9-]+\/$/.test(topic || "")) return send(res, 400, { ok: false, error: "выберите тему" });
    const days = Math.round(+b.days) || 0, due = days >= 1 && days <= 120 ? new Date(Date.now() + days * 864e5) : null;
    const open = (await pool.request().input("c", sql.Int, c.id).query("SELECT COUNT(*) n FROM luch.goals WHERE child_id = @c AND status = 'a'")).recordset[0].n;
    if (open >= 10) return send(res, 400, { ok: false, error: "не больше 10 целей одновременно" });
    await pool.request().input("p", sql.Int, me).input("c", sql.Int, c.id).input("k", sql.VarChar(10), b.kind).input("t", sql.Int, target).input("topic", sql.NVarChar(80), topic)
      .input("r", sql.NVarChar(120), clean(b.reward, 120) || null).input("due", sql.DateTime2(0), due)
      .query("INSERT INTO luch.goals (parent_id, child_id, kind, target, topic, reward, due_at) VALUES (@p, @c, @k, @t, @topic, @r, @due)");
    return send(res, 200, { ok: true, goals: await goalsOf(pool, "child_id", c.id) });
  }
  if ((m = p.match(/^\/api\/family\/goal\/(\d+)$/)) && M === "POST") {
    const b = await body(req, readBody);
    const st = b.action === "rewarded" ? "r" : b.action === "cancel" ? "x" : null; if (!st) return send(res, 400, { ok: false, error: "неизвестное действие" });
    const r = await pool.request().input("id", sql.Int, +m[1]).input("p", sql.Int, me).input("s", sql.Char(1), st)
      .query("UPDATE luch.goals SET status = @s, rewarded_at = CASE WHEN @s = 'r' THEN SYSUTCDATETIME() ELSE rewarded_at END WHERE id = @id AND parent_id = @p; SELECT @@ROWCOUNT n");
    return send(res, r.recordset[0].n ? 200 : 404, { ok: !!r.recordset[0].n });
  }
  return send(res, 404, { ok: false, error: "нет такого адреса" });
}

module.exports = {
  handle(req, res, deps) {
    handle(req, res, deps).catch((e) => { console.log("[family] " + (e && e.message)); try { send(res, 500, { ok: false, error: "ошибка сервера" }); } catch { /* уже ответили */ } });
  },
  goalsOf, goalLine,
};
