// Модерация: жалобы учеников, удаление сообщений, ограничение аккаунтов. Только для luch.users.is_admin = 1.
//   GET  /api/mod/reports?status=o|d  — жалобы с контекстом (сообщение, соседние сообщения, кто на кого)
//   GET  /api/mod/banned              — ограниченные аккаунты
//   POST /api/mod/action { report?, action, message?, user? }
//        action: dismiss — жалоба без нарушения; delete — удалить сообщение; ban / unban — ограничить / снять ограничение
const sql = require("mssql");
const { getPool } = require("./db.js");
const { auth, upsertUser } = require("./me.js");

const send = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); };
const who = (r, p) => r[p + "id"] == null ? null : { id: r[p + "id"], handle: r[p + "handle"], name: r[p + "nick"] || (r[p + "name"] || "").split(" ")[0] || r[p + "handle"], image: r[p + "image"], banned: !!r[p + "banned"] };

async function handle(req, res, { readBody }) {
  const url = new URL(req.url, "http://x"), p = url.pathname.replace(/\/+$/, ""), M = req.method;
  let claims; try { claims = await auth(req); } catch { claims = null; }
  if (!claims) return send(res, 401, { ok: false, error: "нужно войти" });
  const pool = await getPool();
  const me = (await upsertUser(pool, claims, null)).id;
  const adm = (await pool.request().input("u", sql.Int, me).query("SELECT is_admin FROM luch.users WHERE id = @u")).recordset[0];
  if (!adm || !adm.is_admin) return send(res, 403, { ok: false, error: "только для модераторов" });

  if (p === "/api/mod/reports" && M === "GET") {
    const status = url.searchParams.get("status") === "d" ? "d" : "o";
    const r = await pool.request().input("st", sql.Char(1), status).query(`SELECT TOP 100 r.id, r.reason, r.at, r.status, r.action, r.handled_at, r.message_id,
        ru.id r_id, ru.handle r_handle, ru.nick r_nick, ru.name r_name, ru.image r_image, ru.banned r_banned,
        tu.id t_id, tu.handle t_handle, tu.nick t_nick, tu.name t_name, tu.image t_image, tu.banned t_banned,
        m.body m_body, m.at m_at, m.deleted_at m_deleted, m.to_user m_to_user, m.to_group m_to_group, m.from_id m_from,
        au.id a_id, au.handle a_handle, au.nick a_nick, au.name a_name, au.image a_image, au.banned a_banned,
        g.name g_name, g.code g_code,
        (SELECT COUNT(*) FROM luch.reports x WHERE x.target_user = COALESCE(r.target_user, m.from_id) OR x.message_id IN (SELECT id FROM luch.messages WHERE from_id = COALESCE(r.target_user, m.from_id))) total_reports
      FROM luch.reports r
      JOIN luch.users ru ON ru.id = r.reporter_id
      LEFT JOIN luch.users tu ON tu.id = r.target_user
      LEFT JOIN luch.messages m ON m.id = r.message_id
      LEFT JOIN luch.users au ON au.id = m.from_id
      LEFT JOIN luch.groups g ON g.id = m.to_group
      WHERE r.status = @st ORDER BY r.at DESC`);
    const out = [];
    for (const x of r.recordset) {
      let context = [];
      if (x.message_id && x.m_from != null) {
        // 4 сообщения до и 2 после — чтобы понять, о чём речь
        const q = x.m_to_group
          ? "SELECT m.id, m.body, m.at, m.deleted_at, u.handle, u.nick, u.name FROM luch.messages m JOIN luch.users u ON u.id = m.from_id WHERE m.to_group = @g AND m.id BETWEEN @lo AND @hi ORDER BY m.id"
          : "SELECT m.id, m.body, m.at, m.deleted_at, u.handle, u.nick, u.name FROM luch.messages m JOIN luch.users u ON u.id = m.from_id WHERE m.to_group IS NULL AND ((m.from_id = @a AND m.to_user = @b) OR (m.from_id = @b AND m.to_user = @a)) AND m.id BETWEEN @lo AND @hi ORDER BY m.id";
        const c = await pool.request().input("g", sql.Int, x.m_to_group).input("a", sql.Int, x.m_from).input("b", sql.Int, x.m_to_user)
          .input("lo", sql.BigInt, x.message_id - 60).input("hi", sql.BigInt, x.message_id + 30).query(q);
        const rows = c.recordset, i = rows.findIndex((y) => String(y.id) === String(x.message_id));
        context = rows.slice(Math.max(0, i - 4), i + 3).map((y) => ({ id: y.id, body: y.body, at: y.at, deleted: !!y.deleted_at, name: y.nick || (y.name || "").split(" ")[0] || y.handle, handle: y.handle, target: String(y.id) === String(x.message_id) }));
      }
      out.push({ id: x.id, reason: x.reason, at: x.at, status: x.status, action: x.action, handledAt: x.handled_at,
        reporter: who(x, "r_"), target: who(x, "t_") || who(x, "a_"), totalReports: x.total_reports,
        message: x.message_id ? { id: x.message_id, body: x.m_body, at: x.m_at, deleted: !!x.m_deleted, where: x.m_to_group ? "группа «" + x.g_name + "»" : "личные сообщения" } : null, context });
    }
    const cnt = await pool.request().query("SELECT COUNT(*) n FROM luch.reports WHERE status = 'o'");
    return send(res, 200, { ok: true, open: cnt.recordset[0].n, reports: out });
  }
  if (p === "/api/mod/banned" && M === "GET") {
    const r = await pool.request().query("SELECT id, handle, nick, name, image, banned FROM luch.users WHERE banned = 1 ORDER BY last_seen DESC");
    return send(res, 200, { ok: true, users: r.recordset.map((x) => who(x, "")) });
  }
  if (p === "/api/mod/action" && M === "POST") {
    let b = {}; try { b = JSON.parse(await readBody(req)) || {}; } catch { /* */ }
    const rq = () => pool.request().input("rid", sql.Int, Number.isInteger(b.report) ? b.report : null).input("mid", sql.BigInt, /^\d{1,18}$/.test(String(b.message)) ? String(b.message) : null).input("uid", sql.Int, Number.isInteger(b.user) ? b.user : null);
    if (b.action === "delete") await rq().query("UPDATE luch.messages SET deleted_at = SYSUTCDATETIME() WHERE id = @mid AND deleted_at IS NULL");
    else if (b.action === "ban") { if (b.user === me) return send(res, 400, { ok: false, error: "себя ограничить нельзя" }); await rq().query("UPDATE luch.users SET banned = 1 WHERE id = @uid AND is_admin = 0"); }
    else if (b.action === "unban") await rq().query("UPDATE luch.users SET banned = 0 WHERE id = @uid");
    else if (b.action !== "dismiss" && b.action !== "close") return send(res, 400, { ok: false, error: "неизвестное действие" });
    // удалить / ограничить — жалоба остаётся открытой (можно сделать и то и другое); «нарушения нет» и «закрыть» — закрывают
    const closing = b.action === "dismiss" || b.action === "close";
    if (b.report) await rq().input("act", sql.NVarChar(40), b.action === "close" ? null : b.action).input("cl", sql.Bit, closing ? 1 : 0)
      .query("UPDATE luch.reports SET status = CASE WHEN @cl = 1 THEN 'd' ELSE status END, handled_at = CASE WHEN @cl = 1 THEN SYSUTCDATETIME() ELSE handled_at END, action = CASE WHEN @act IS NULL THEN action WHEN action IS NULL THEN @act ELSE action + ', ' + @act END WHERE id = @rid");
    console.log("[mod] " + b.action + (b.report ? " report " + b.report : "") + (b.message ? " msg " + b.message : "") + (b.user ? " user " + b.user : ""));
    return send(res, 200, { ok: true });
  }
  return send(res, 404, { ok: false, error: "нет такого адреса" });
}

module.exports = {
  handle(req, res, deps) {
    handle(req, res, deps).catch((e) => { console.log("[mod] " + (e && e.message)); try { send(res, 500, { ok: false, error: "ошибка сервера" }); } catch { /* уже ответили */ } });
  },
};
