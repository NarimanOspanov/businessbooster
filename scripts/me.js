// Учётная запись ученика (вход через Clerk): прогресс, действия, кабинет.
//   POST /api/me/sync — профиль + изменившийся прогресс (localStorage-ключи уроков) + события → вернуть весь сохранённый прогресс
//   GET  /api/me      — профиль, прогресс, действия за год (для кабинета и для наставника)
// Вход проверяем по сессионному токену Clerk (JWT RS256) и публичным ключам Clerk (JWKS) —
// секретный ключ Clerk серверу не нужен.
const crypto = require("crypto");
const sql = require("mssql");
const { getPool } = require("./db.js");

const FAPI = (process.env.CLERK_FRONTEND_API || "https://usable-basilisk-6497.clerk.accounts.dev").replace(/\/$/, "");

// ---------- проверка токена Clerk ----------
let jwks = { at: 0, keys: {} };
async function keyFor(kid) {
  if (jwks.keys[kid] && Date.now() - jwks.at < 6 * 3600e3) return jwks.keys[kid];
  const r = await fetch(FAPI + "/.well-known/jwks.json", { signal: AbortSignal.timeout(8000) });
  const j = await r.json();
  const keys = {};
  for (const k of j.keys || []) { try { keys[k.kid] = crypto.createPublicKey({ key: k, format: "jwk" }); } catch { /* пропускаем */ } }
  jwks = { at: Date.now(), keys };
  return keys[kid];
}
const b64 = (s) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
async function verify(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  let head, body;
  try { head = JSON.parse(b64(parts[0]).toString("utf8")); body = JSON.parse(b64(parts[1]).toString("utf8")); } catch { return null; }
  if (head.alg !== "RS256" || !head.kid) return null;
  const key = await keyFor(head.kid).catch(() => null);
  if (!key) return null;
  const ok = crypto.verify("RSA-SHA256", Buffer.from(parts[0] + "." + parts[1]), key, b64(parts[2]));
  if (!ok) return null;
  const now = Math.floor(Date.now() / 1000);
  if (body.exp && now > body.exp + 30) return null;
  if (body.nbf && now < body.nbf - 30) return null;
  if (body.iss && body.iss.replace(/\/$/, "") !== FAPI) return null;
  return body.sub ? body : null;
}
async function auth(req) {
  const h = String(req.headers.authorization || "");
  return h.startsWith("Bearer ") ? verify(h.slice(7)) : null;
}

// ---------- база ----------
// ключи прогресса, которые храним: прогресс урока, журнал урока, «стартовая карточка показана»
const KEY_RE = /^(luch-(phys|chem|bio|math|cs)-[a-z0-9-]{2,30}|oe-learn:\/labs\/[a-z0-9-]{2,40}\/:\d{1,2}|oe-start:\/labs\/[a-z0-9-]{2,40}\/:\d{1,2})$/;
const KINDS = new Set(["open", "theory", "task", "topic", "quiz", "help", "hw", "signin"]);

async function upsertUser(pool, claims, profile) {
  const p = profile || {};
  const r = await pool.request()
    .input("cid", sql.NVarChar(64), claims.sub)
    .input("email", sql.NVarChar(200), String(p.email || "").slice(0, 200) || null)
    .input("name", sql.NVarChar(200), String(p.name || "").slice(0, 200) || null)
    .input("img", sql.NVarChar(500), /^https:\/\//.test(p.image || "") ? String(p.image).slice(0, 500) : null)
    .query(`MERGE luch.users WITH (HOLDLOCK) AS t USING (SELECT @cid AS clerk_id) AS s ON t.clerk_id = s.clerk_id
      WHEN MATCHED THEN UPDATE SET last_seen = SYSUTCDATETIME(), email = COALESCE(@email, t.email), name = COALESCE(@name, t.name), image = COALESCE(@img, t.image)
      WHEN NOT MATCHED THEN INSERT (clerk_id, email, name, image) VALUES (@cid, @email, @name, @img)
      OUTPUT inserted.id, $action AS act;`);
  return { id: r.recordset[0].id, isNew: r.recordset[0].act === "INSERT" };
}

async function loadAll(pool, uid) {
  const [u, st, ev] = await Promise.all([
    pool.request().input("u", sql.Int, uid).query("SELECT name, email, image, created_at, nick, age, gender, goal FROM luch.users WHERE id = @u"),
    pool.request().input("u", sql.Int, uid).query("SELECT k, v FROM luch.user_state WHERE user_id = @u"),
    pool.request().input("u", sql.Int, uid).query(`SELECT TOP 2000 at, kind, page, lesson, title, detail FROM luch.user_events
      WHERE user_id = @u AND at > DATEADD(day, -372, SYSUTCDATETIME()) ORDER BY at DESC`),
  ]);
  const state = {}; for (const r of st.recordset) state[r.k] = r.v;
  return { user: u.recordset[0] || null, state, events: ev.recordset };
}

function send(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

async function handle(req, res, { readBody }) {
  const p = req.url.split("?")[0];
  let claims;
  try { claims = await auth(req); } catch { claims = null; }
  if (!claims) return send(res, 401, { ok: false, error: "нужно войти" });
  const pool = await getPool();

  if (p === "/api/me" && req.method === "GET") {
    const u = await upsertUser(pool, claims, null);
    return send(res, 200, { ok: true, ...(await loadAll(pool, u.id)) });
  }
  if (p === "/api/me/sync" && req.method === "POST") {
    let b = {};
    try { b = JSON.parse(await readBody(req)) || {}; } catch { return send(res, 400, { ok: false, error: "bad json" }); }
    const u = await upsertUser(pool, claims, b.profile);
    // прогресс: только известные ключи, разумного размера
    const st = Object.entries(b.state || {}).filter(([k, v]) => KEY_RE.test(k) && typeof v === "string" && v.length <= 60000).slice(0, 400);
    for (const [k, v] of st) {
      await pool.request().input("u", sql.Int, u.id).input("k", sql.NVarChar(200), k).input("v", sql.NVarChar(sql.MAX), v)
        .query(`MERGE luch.user_state WITH (HOLDLOCK) AS t USING (SELECT @u AS user_id, @k AS k) AS s ON t.user_id = s.user_id AND t.k = s.k
          WHEN MATCHED THEN UPDATE SET v = @v, updated_at = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN INSERT (user_id, k, v) VALUES (@u, @k, @v);`);
    }
    const evs = (Array.isArray(b.events) ? b.events : []).filter((e) => e && KINDS.has(e.kind)).slice(0, 100);
    if (u.isNew) evs.push({ kind: "signin", title: "Создан аккаунт", at: Date.now() });
    for (const e of evs) {
      const at = Number(e.at) > 0 && Math.abs(Date.now() - Number(e.at)) < 400 * 864e5 ? new Date(Number(e.at)) : new Date();
      await pool.request().input("u", sql.Int, u.id).input("at", sql.DateTime2(0), at)
        .input("kind", sql.NVarChar(16), e.kind)
        .input("page", sql.NVarChar(200), String(e.page || "").slice(0, 200) || null)
        .input("lesson", sql.Int, Number.isInteger(e.lesson) ? e.lesson : null)
        .input("title", sql.NVarChar(300), String(e.title || "").slice(0, 300) || null)
        .input("detail", sql.NVarChar(500), String(e.detail || "").slice(0, 500) || null)
        .query("INSERT INTO luch.user_events (user_id, at, kind, page, lesson, title, detail) VALUES (@u, @at, @kind, @page, @lesson, @title, @detail)");
    }
    return send(res, 200, { ok: true, ...(await loadAll(pool, u.id)) });
  }
  if (p === "/api/me/profile" && req.method === "POST") {
    let b = {};
    try { b = JSON.parse(await readBody(req)) || {}; } catch { return send(res, 400, { ok: false, error: "bad json" }); }
    const nick = String(b.nick || "").replace(/[<>\r\n]/g, "").trim().slice(0, 60);
    if (!nick) return send(res, 400, { ok: false, error: "как тебя зовут?" });
    const age = Number.isInteger(+b.age) && +b.age >= 5 && +b.age <= 99 ? +b.age : null;
    const gender = b.gender === "m" || b.gender === "f" ? b.gender : null;
    const goal = ["school", "ent", "self", "parent", "teacher"].includes(b.goal) ? b.goal : null;
    const u = await upsertUser(pool, claims, null);
    await pool.request().input("u", sql.Int, u.id).input("nick", sql.NVarChar(60), nick).input("age", sql.TinyInt, age)
      .input("g", sql.Char(1), gender).input("goal", sql.NVarChar(40), goal)
      .query("UPDATE luch.users SET nick = @nick, age = @age, gender = @g, goal = @goal WHERE id = @u");
    return send(res, 200, { ok: true, ...(await loadAll(pool, u.id)) });
  }
  return send(res, 404, { ok: false, error: "нет такого адреса" });
}

module.exports = {
  handle(req, res, deps) {
    handle(req, res, deps).catch((e) => { console.log("[me] " + (e && e.message)); try { send(res, 500, { ok: false, error: "ошибка сервера" }); } catch { /* уже ответили */ } });
  },
  verify,
};
