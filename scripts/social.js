// Социальное: профили, друзья, личные сообщения, группы.
// Платформа для школьников, поэтому:
//   • писать можно только друзьям (после принятой заявки), в группе — только участникам;
//   • профиль по умолчанию виден только друзьям; почта и возраст не показываются никому;
//   • есть блокировка и жалобы (luch.reports), лимит частоты сообщений.
const sql = require("mssql");
const crypto = require("crypto");
const { getPool } = require("./db.js");
const { auth, upsertUser } = require("./me.js");

const send = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); };
const clean = (s, n) => String(s || "").replace(/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, n);

// ---------- адрес профиля из имени: «Нариман» → nariman, при занятости nariman-2 ----------
const TR = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya", ә: "a", ғ: "g", қ: "k", ң: "n", ө: "o", ұ: "u", ү: "u", һ: "h", і: "i" };
const slug = (s) => String(s || "").toLowerCase().split("").map((c) => (c in TR ? TR[c] : c)).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "student";
async function ensureHandle(pool, uid) {
  const r = await pool.request().input("u", sql.Int, uid).query("SELECT handle, nick, name FROM luch.users WHERE id = @u");
  const row = r.recordset[0]; if (!row) return null; if (row.handle) return row.handle;
  const base = slug(row.nick || row.name);
  for (let i = 0; i < 30; i++) {
    const h = i === 0 ? base : base + "-" + (i < 10 ? i + 1 : crypto.randomInt(100, 9999));
    try {
      await pool.request().input("u", sql.Int, uid).input("h", sql.NVarChar(40), h).query("UPDATE luch.users SET handle = @h WHERE id = @u AND handle IS NULL");
      return h;
    } catch (e) { if (!/duplicate|UNIQUE/i.test(e.message)) throw e; }
  }
  return null;
}

// ---------- отношения ----------
const pair = (x, y) => (x < y ? [x, y] : [y, x]);
async function relation(pool, me, other) {
  if (me === other) return "self";
  const [a, b] = pair(me, other);
  const r = await pool.request().input("a", sql.Int, a).input("b", sql.Int, b).input("me", sql.Int, me).input("o", sql.Int, other).query(`
    SELECT (SELECT status FROM luch.friends WHERE a = @a AND b = @b) st,
           (SELECT requested_by FROM luch.friends WHERE a = @a AND b = @b) rb,
           (SELECT 1 FROM luch.blocks WHERE user_id = @me AND blocked_id = @o) ib,
           (SELECT 1 FROM luch.blocks WHERE user_id = @o AND blocked_id = @me) bm`);
  const x = r.recordset[0];
  if (x.ib) return "blocked";
  if (x.bm) return "blocked_me";
  if (x.st === "a") return "friend";
  if (x.st === "p") return x.rb === me ? "requested" : "incoming";
  return "none";
}
async function byHandle(pool, h) {
  const r = await pool.request().input("h", sql.NVarChar(40), clean(h, 40).toLowerCase()).query("SELECT id, handle, nick, name, image, bio, visibility, created_at FROM luch.users WHERE handle = @h");
  return r.recordset[0] || null;
}
const pub = (u) => ({ handle: u.handle, name: u.nick || (u.name || "").split(" ")[0] || u.handle, image: u.image || null });

// ---------- статистика для профиля ----------
async function stats(pool, uid) {
  const [ev, st] = await Promise.all([
    pool.request().input("u", sql.Int, uid).query(`SELECT CONVERT(char(10), at, 23) d, kind, COUNT(*) n FROM luch.user_events
      WHERE user_id = @u AND at > DATEADD(day, -372, SYSUTCDATETIME()) GROUP BY CONVERT(char(10), at, 23), kind`),
    pool.request().input("u", sql.Int, uid).query("SELECT k, v FROM luch.user_state WHERE user_id = @u AND k LIKE 'luch-%'"),
  ]);
  const days = {}; let tasks = 0, quizzes = 0;
  for (const r of ev.recordset) { days[r.d] = (days[r.d] || 0) + r.n * ({ task: 3, quiz: 3, theory: 2, topic: 4 }[r.kind] || 1); if (r.kind === "task") tasks += r.n; if (r.kind === "quiz") quizzes += r.n; }
  const topics = [];
  for (const r of st.recordset) { let done = 0; try { const d = JSON.parse(r.v).done || {}; done = Array.isArray(d) ? d.filter(Boolean).length : Object.values(d).filter(Boolean).length; } catch { /* */ } if (done) topics.push({ path: "/labs/" + r.k.slice(5) + "/", done }); }
  topics.sort((a, b) => b.done - a.done);
  let streak = 0; const t = new Date(); const key = (d) => d.toISOString().slice(0, 10);
  if (!days[key(t)]) t.setUTCDate(t.getUTCDate() - 1);
  while (days[key(t)]) { streak++; t.setUTCDate(t.getUTCDate() - 1); }
  return { days, activeDays: Object.keys(days).length, tasks, quizzes, streak, topics: topics.slice(0, 12) };
}

// ---------- лимит сообщений: не больше 20 в минуту ----------
const sent = new Map();
function canSend(uid) { const now = Date.now(), a = (sent.get(uid) || []).filter((t) => now - t < 60e3); if (a.length >= 20) return false; a.push(now); sent.set(uid, a); return true; }

async function body(req, readBody) { try { return JSON.parse(await readBody(req)) || {}; } catch { return {}; } }

async function handle(req, res, { readBody }) {
  const url = new URL(req.url, "http://x"), p = url.pathname.replace(/\/+$/, ""), M = req.method;
  let claims; try { claims = await auth(req); } catch { claims = null; }
  if (!claims) return send(res, 401, { ok: false, error: "нужно войти" });
  const pool = await getPool();
  const me = (await upsertUser(pool, claims, null)).id;
  const myHandle = await ensureHandle(pool, me);
  // ограниченный модератором ученик: читать можно, писать и добавлять — нет
  const banned = (await pool.request().input("u", sql.Int, me).query("SELECT banned FROM luch.users WHERE id = @u")).recordset[0].banned;
  if (banned && M === "POST" && !/\/report$/.test(p)) return send(res, 403, { ok: false, error: "модератор ограничил твой аккаунт: писать и добавлять друзей пока нельзя" });
  let m;

  // мои настройки и счётчики (значок в шапке)
  if (p === "/api/social/me" && M === "GET") {
    const r = await pool.request().input("u", sql.Int, me).query(`SELECT handle, visibility, bio, is_admin, banned,
      CASE WHEN is_admin = 1 THEN (SELECT COUNT(*) FROM luch.reports WHERE status = 'o') ELSE 0 END reports,
      (SELECT COUNT(*) FROM luch.friends WHERE (a = @u OR b = @u) AND status = 'p' AND requested_by <> @u) requests,
      (SELECT COUNT(*) FROM luch.messages WHERE to_user = @u AND read_at IS NULL AND deleted_at IS NULL AND from_id NOT IN (SELECT blocked_id FROM luch.blocks WHERE user_id = @u)) unread
      FROM luch.users WHERE id = @u`);
    return send(res, 200, { ok: true, ...r.recordset[0] });
  }
  if (p === "/api/social/settings" && M === "POST") {
    const b = await body(req, readBody);
    const vis = ["public", "friends"].includes(b.visibility) ? b.visibility : null;
    const bio = b.bio !== undefined ? clean(b.bio, 200) : null;
    let h = b.handle !== undefined ? slug(b.handle) : null;
    if (h && h.length < 3) return send(res, 400, { ok: false, error: "адрес — минимум 3 латинские буквы или цифры" });
    try {
      await pool.request().input("u", sql.Int, me).input("v", sql.VarChar(10), vis).input("bio", sql.NVarChar(200), bio).input("h", sql.NVarChar(40), h)
        .query("UPDATE luch.users SET visibility = COALESCE(@v, visibility), bio = CASE WHEN @bio IS NULL THEN bio ELSE NULLIF(@bio, '') END, handle = COALESCE(@h, handle) WHERE id = @u");
    } catch (e) { if (/duplicate|UNIQUE/i.test(e.message)) return send(res, 409, { ok: false, error: "такой адрес уже занят" }); throw e; }
    return send(res, 200, { ok: true });
  }

  // поиск людей по имени или адресу
  if (p === "/api/social/search" && M === "GET") {
    const q = clean(url.searchParams.get("q"), 40);
    if (q.length < 2) return send(res, 200, { ok: true, users: [] });
    const r = await pool.request().input("u", sql.Int, me).input("q", sql.NVarChar(50), q.replace(/[%_[\]]/g, "") + "%")
      .query(`SELECT TOP 20 id, handle, nick, name, image FROM luch.users
        WHERE id <> @u AND handle IS NOT NULL AND (nick LIKE @q OR handle LIKE @q OR name LIKE @q)
          AND id NOT IN (SELECT user_id FROM luch.blocks WHERE blocked_id = @u)
        ORDER BY last_seen DESC`);
    const users = [];
    for (const u of r.recordset) users.push({ ...pub(u), rel: await relation(pool, me, u.id) });
    return send(res, 200, { ok: true, users });
  }

  // профиль: полностью — себе, друзьям и если открыт для всех; иначе только имя и аватар
  if ((m = p.match(/^\/api\/social\/u\/([a-z0-9-]{2,40})$/)) && M === "GET") {
    const u = await byHandle(pool, m[1]);
    if (!u) return send(res, 404, { ok: false, error: "нет такого ученика" });
    const rel = await relation(pool, me, u.id);
    if (rel === "blocked_me") return send(res, 404, { ok: false, error: "нет такого ученика" });
    const open = rel === "self" || rel === "friend" || u.visibility === "public";
    const fr = await pool.request().input("u", sql.Int, u.id).query("SELECT COUNT(*) n FROM luch.friends WHERE (a = @u OR b = @u) AND status = 'a'");
    return send(res, 200, { ok: true, user: { ...pub(u), bio: open ? u.bio : null, since: u.created_at, friends: fr.recordset[0].n }, rel, open, stats: open ? await stats(pool, u.id) : null });
  }

  // заявки в друзья, удаление, блокировка
  if (p === "/api/social/friend" && M === "POST") {
    const b = await body(req, readBody), u = await byHandle(pool, b.handle || "");
    if (!u || u.id === me) return send(res, 404, { ok: false, error: "нет такого ученика" });
    const [a, c] = pair(me, u.id), rq = () => pool.request().input("a", sql.Int, a).input("b", sql.Int, c).input("me", sql.Int, me).input("o", sql.Int, u.id);
    const rel = await relation(pool, me, u.id);
    if (b.action === "request") {
      if (rel === "blocked" || rel === "blocked_me") return send(res, 403, { ok: false, error: "нельзя" });
      if (rel === "incoming") await rq().query("UPDATE luch.friends SET status = 'a' WHERE a = @a AND b = @b");
      else if (rel === "none") await rq().query("INSERT INTO luch.friends (a, b, status, requested_by) VALUES (@a, @b, 'p', @me)");
    } else if (b.action === "accept") { if (rel === "incoming") await rq().query("UPDATE luch.friends SET status = 'a' WHERE a = @a AND b = @b"); }
    else if (b.action === "decline" || b.action === "remove" || b.action === "cancel") { await rq().query("DELETE FROM luch.friends WHERE a = @a AND b = @b"); }
    else if (b.action === "block") {
      await rq().query(`DELETE FROM luch.friends WHERE a = @a AND b = @b;
        IF NOT EXISTS (SELECT 1 FROM luch.blocks WHERE user_id = @me AND blocked_id = @o) INSERT INTO luch.blocks (user_id, blocked_id) VALUES (@me, @o)`);
    } else if (b.action === "unblock") { await rq().query("DELETE FROM luch.blocks WHERE user_id = @me AND blocked_id = @o"); }
    else return send(res, 400, { ok: false, error: "неизвестное действие" });
    return send(res, 200, { ok: true, rel: await relation(pool, me, u.id) });
  }
  if (p === "/api/social/friends" && M === "GET") {
    const r = await pool.request().input("u", sql.Int, me).query(`SELECT f.status, f.requested_by, u.id, u.handle, u.nick, u.name, u.image, u.last_seen
      FROM luch.friends f JOIN luch.users u ON u.id = CASE WHEN f.a = @u THEN f.b ELSE f.a END WHERE f.a = @u OR f.b = @u ORDER BY u.last_seen DESC`);
    const out = { friends: [], incoming: [], outgoing: [] };
    for (const x of r.recordset) {
      const it = { ...pub(x), seen: x.last_seen };
      if (x.status === "a") out.friends.push(it); else if (x.requested_by === me) out.outgoing.push(it); else out.incoming.push(it);
    }
    const bl = await pool.request().input("u", sql.Int, me).query("SELECT u.handle, u.nick, u.name, u.image FROM luch.blocks b JOIN luch.users u ON u.id = b.blocked_id WHERE b.user_id = @u");
    out.blocked = bl.recordset.map(pub);
    return send(res, 200, { ok: true, ...out });
  }

  // лента: что делают друзья
  if (p === "/api/social/feed" && M === "GET") {
    const r = await pool.request().input("u", sql.Int, me).query(`SELECT TOP 60 e.at, e.kind, e.title, e.detail, e.page, u.handle, u.nick, u.name, u.image
      FROM luch.user_events e JOIN luch.users u ON u.id = e.user_id
      WHERE e.kind IN ('task','quiz','theory','topic') AND e.user_id IN (SELECT CASE WHEN a = @u THEN b ELSE a END FROM luch.friends WHERE (a = @u OR b = @u) AND status = 'a')
      ORDER BY e.at DESC`);
    return send(res, 200, { ok: true, items: r.recordset.map((x) => ({ at: x.at, kind: x.kind, title: x.title, detail: x.detail, page: x.page, user: pub(x) })) });
  }

  // личные сообщения — только между друзьями
  if (p === "/api/social/inbox" && M === "GET") {
    const r = await pool.request().input("u", sql.Int, me).query(`WITH c AS (
        SELECT CASE WHEN from_id = @u THEN to_user ELSE from_id END other, id, body, at, from_id, read_at, to_user
        FROM luch.messages WHERE to_group IS NULL AND deleted_at IS NULL AND (from_id = @u OR to_user = @u))
      SELECT o.other, o.body, o.at, o.from_id, u.handle, u.nick, u.name, u.image,
        (SELECT COUNT(*) FROM c c2 WHERE c2.other = o.other AND c2.to_user = @u AND c2.read_at IS NULL) unread
      FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY other ORDER BY id DESC) rn FROM c) o JOIN luch.users u ON u.id = o.other
      WHERE o.rn = 1 AND o.other NOT IN (SELECT blocked_id FROM luch.blocks WHERE user_id = @u) ORDER BY o.at DESC`);
    return send(res, 200, { ok: true, chats: r.recordset.map((x) => ({ user: pub(x), last: x.body, at: x.at, mine: x.from_id === me, unread: x.unread })) });
  }
  if ((m = p.match(/^\/api\/social\/dm\/([a-z0-9-]{2,40})$/))) {
    const u = await byHandle(pool, m[1]); if (!u) return send(res, 404, { ok: false, error: "нет такого ученика" });
    const rel = await relation(pool, me, u.id);
    if (M === "POST") {
      if (rel !== "friend") return send(res, 403, { ok: false, error: "писать можно только друзьям" });
      if (!canSend(me)) return send(res, 429, { ok: false, error: "слишком часто — подожди минуту" });
      const text = clean((await body(req, readBody)).body, 1000); if (!text) return send(res, 400, { ok: false, error: "пустое сообщение" });
      await pool.request().input("f", sql.Int, me).input("t", sql.Int, u.id).input("b", sql.NVarChar(1000), text).query("INSERT INTO luch.messages (from_id, to_user, body) VALUES (@f, @t, @b)");
    }
    const after = Math.max(0, parseInt(url.searchParams.get("after") || "0", 10) || 0);
    const r = await pool.request().input("me", sql.Int, me).input("o", sql.Int, u.id).input("after", sql.BigInt, after).query(`
      UPDATE luch.messages SET read_at = SYSUTCDATETIME() WHERE to_user = @me AND from_id = @o AND read_at IS NULL;
      SELECT TOP 200 id, from_id, body, at, read_at FROM luch.messages
      WHERE to_group IS NULL AND deleted_at IS NULL AND ((from_id = @me AND to_user = @o) OR (from_id = @o AND to_user = @me)) AND id > @after ORDER BY id DESC`);
    return send(res, 200, { ok: true, user: pub(u), rel, canWrite: rel === "friend", messages: r.recordset.reverse().map((x) => ({ id: x.id, mine: x.from_id === me, body: x.body, at: x.at, read: !!x.read_at })) });
  }

  // группы: создать, вступить по коду, выйти, мои группы, страница группы, чат группы
  if (p === "/api/social/groups" && M === "GET") {
    const r = await pool.request().input("u", sql.Int, me).query(`SELECT g.code, g.name, g.owner_id, (SELECT COUNT(*) FROM luch.group_members x WHERE x.group_id = g.id) members,
      (SELECT TOP 1 body FROM luch.messages WHERE to_group = g.id AND deleted_at IS NULL ORDER BY id DESC) last
      FROM luch.groups g JOIN luch.group_members m ON m.group_id = g.id WHERE m.user_id = @u ORDER BY g.created_at DESC`);
    return send(res, 200, { ok: true, groups: r.recordset.map((x) => ({ code: x.code, name: x.name, members: x.members, mine: x.owner_id === me, last: x.last })) });
  }
  if (p === "/api/social/group" && M === "POST") {
    const b = await body(req, readBody);
    if (b.action === "create") {
      const name = clean(b.name, 80); if (name.length < 2) return send(res, 400, { ok: false, error: "назови группу" });
      const own = await pool.request().input("u", sql.Int, me).query("SELECT COUNT(*) n FROM luch.groups WHERE owner_id = @u");
      if (own.recordset[0].n >= 20) return send(res, 400, { ok: false, error: "не больше 20 своих групп" });
      const code = crypto.randomBytes(6).toString("base64").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8).padEnd(8, "X");
      const g = await pool.request().input("c", sql.Char(8), code).input("n", sql.NVarChar(80), name).input("u", sql.Int, me)
        .query("INSERT INTO luch.groups (code, name, owner_id) OUTPUT inserted.id VALUES (@c, @n, @u)");
      await pool.request().input("g", sql.Int, g.recordset[0].id).input("u", sql.Int, me).query("INSERT INTO luch.group_members (group_id, user_id) VALUES (@g, @u)");
      return send(res, 200, { ok: true, code });
    }
    const g = (await pool.request().input("c", sql.Char(8), clean(b.code, 8).toUpperCase()).query("SELECT id, owner_id FROM luch.groups WHERE code = @c")).recordset[0];
    if (!g) return send(res, 404, { ok: false, error: "группа не найдена — проверь код" });
    if (b.action === "join") {
      await pool.request().input("g", sql.Int, g.id).input("u", sql.Int, me).query("IF NOT EXISTS (SELECT 1 FROM luch.group_members WHERE group_id = @g AND user_id = @u) INSERT INTO luch.group_members (group_id, user_id) VALUES (@g, @u)");
      return send(res, 200, { ok: true });
    }
    if (b.action === "leave") { await pool.request().input("g", sql.Int, g.id).input("u", sql.Int, me).query("DELETE FROM luch.group_members WHERE group_id = @g AND user_id = @u"); return send(res, 200, { ok: true }); }
    if (b.action === "kick" && g.owner_id === me) {
      const u = await byHandle(pool, b.handle || ""); if (u && u.id !== me) await pool.request().input("g", sql.Int, g.id).input("u", sql.Int, u.id).query("DELETE FROM luch.group_members WHERE group_id = @g AND user_id = @u");
      return send(res, 200, { ok: true });
    }
    return send(res, 400, { ok: false, error: "неизвестное действие" });
  }
  if ((m = p.match(/^\/api\/social\/g\/([A-Za-z0-9]{8})$/))) {
    const g = (await pool.request().input("c", sql.Char(8), m[1].toUpperCase()).query("SELECT id, code, name, owner_id, created_at FROM luch.groups WHERE code = @c")).recordset[0];
    if (!g) return send(res, 404, { ok: false, error: "группа не найдена" });
    const isMember = (await pool.request().input("g", sql.Int, g.id).input("u", sql.Int, me).query("SELECT 1 x FROM luch.group_members WHERE group_id = @g AND user_id = @u")).recordset.length > 0;
    if (!isMember) { const n = await pool.request().input("g", sql.Int, g.id).query("SELECT COUNT(*) n FROM luch.group_members WHERE group_id = @g"); return send(res, 200, { ok: true, group: { code: g.code, name: g.name, members: n.recordset[0].n }, member: false }); }
    if (M === "POST") {
      if (!canSend(me)) return send(res, 429, { ok: false, error: "слишком часто — подожди минуту" });
      const text = clean((await body(req, readBody)).body, 1000); if (!text) return send(res, 400, { ok: false, error: "пустое сообщение" });
      await pool.request().input("f", sql.Int, me).input("g", sql.Int, g.id).input("b", sql.NVarChar(1000), text).query("INSERT INTO luch.messages (from_id, to_group, body) VALUES (@f, @g, @b)");
    }
    const after = Math.max(0, parseInt(url.searchParams.get("after") || "0", 10) || 0);
    const [mem, msg] = await Promise.all([
      pool.request().input("g", sql.Int, g.id).query(`SELECT u.id, u.handle, u.nick, u.name, u.image,
          (SELECT COUNT(*) FROM luch.user_events e WHERE e.user_id = u.id AND e.kind = 'task' AND e.at > DATEADD(day, -7, SYSUTCDATETIME())) week,
          (SELECT COUNT(*) FROM luch.user_events e WHERE e.user_id = u.id AND e.kind = 'task') total
        FROM luch.group_members m JOIN luch.users u ON u.id = m.user_id WHERE m.group_id = @g ORDER BY week DESC, total DESC`),
      pool.request().input("g", sql.Int, g.id).input("after", sql.BigInt, after).input("u", sql.Int, me).query(`SELECT TOP 200 m.id, m.from_id, m.body, m.at, u.handle, u.nick, u.name, u.image
        FROM luch.messages m JOIN luch.users u ON u.id = m.from_id WHERE m.to_group = @g AND m.deleted_at IS NULL AND m.id > @after
          AND m.from_id NOT IN (SELECT blocked_id FROM luch.blocks WHERE user_id = @u) ORDER BY m.id DESC`),
    ]);
    return send(res, 200, { ok: true, member: true, owner: g.owner_id === me,
      group: { code: g.code, name: g.name, members: mem.recordset.length, since: g.created_at },
      board: mem.recordset.map((x) => ({ ...pub(x), week: x.week, total: x.total, me: x.id === me })),
      messages: msg.recordset.reverse().map((x) => ({ id: x.id, mine: x.from_id === me, body: x.body, at: x.at, user: pub(x) })) });
  }

  // жалоба на ученика или сообщение
  if (p === "/api/social/report" && M === "POST") {
    const b = await body(req, readBody), u = b.handle ? await byHandle(pool, b.handle) : null;
    await pool.request().input("r", sql.Int, me).input("t", sql.Int, u ? u.id : null).input("m", sql.BigInt, /^\d{1,18}$/.test(String(b.message)) ? String(b.message) : null)
      .input("why", sql.NVarChar(300), clean(b.reason, 300) || null).query("INSERT INTO luch.reports (reporter_id, target_user, message_id, reason) VALUES (@r, @t, @m, @why)");
    console.log("[social] жалоба от user " + me + (u ? " на " + u.handle : ""));
    return send(res, 200, { ok: true });
  }
  return send(res, 404, { ok: false, error: "нет такого адреса", me: myHandle });
}

module.exports = {
  handle(req, res, deps) {
    handle(req, res, deps).catch((e) => { console.log("[social] " + (e && e.message)); try { send(res, 500, { ok: false, error: "ошибка сервера" }); } catch { /* уже ответили */ } });
  },
};
