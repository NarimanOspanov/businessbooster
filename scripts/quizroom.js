// Квизрум: викторина для компании по ссылке. Комнаты живут в памяти сервера (игра длится минуты),
// итоги и банк вопросов — в схеме quiz. Клиенты опрашивают состояние раз в секунду; ход игры
// продвигается при каждом запросе по времени (без таймеров на сервере).
//   POST /api/quizroom/create {category, count, name}     → {code, pid, token}
//   POST /api/quizroom/:code/join {name}                  → {pid, token}
//   GET  /api/quizroom/:code/state?pid&token              → состояние комнаты (+ сигналы голосового чата для pid)
//   POST /api/quizroom/:code/start|again|kick|answer|signal|voice|leave
const crypto = require("crypto");
const sql = require("mssql");
const { getPool } = require("./db.js");

const Q_TIME = 20000, REVEAL = 8000, LOAD_MAX = 90000, MAX_PLAYERS = 30, ROOM_TTL = 3 * 3600e3;
const rooms = new Map();
const send = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); };
const clean = (s, n) => String(s || "").replace(/[<>\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
const rnd = (n) => crypto.randomInt(n);
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- категории ----------
const CATS = {
  mix: { name: "Обо всём понемногу", emoji: "🎲", ai: "разные темы вперемешку: наука, кино, музыка, история, спорт, технологии, природа, еда, путешествия" },
  science: { name: "Наука и открытия", emoji: "🔬", ai: "наука, открытия, учёные, космос, природа, человеческое тело — удивительные факты" },
  tech: { name: "Хай-тек", emoji: "🚀", ai: "технологии, гаджеты, интернет, компании, ИИ, игры, изобретения" },
  cinema: { name: "Кино и сериалы", emoji: "🎬", ai: "кино, мультфильмы, сериалы, актёры, режиссёры — известные всем, включая советское, казахстанское и мировое кино" },
  music: { name: "Музыка", emoji: "🎵", ai: "музыка: исполнители, группы, хиты, инструменты, композиторы — разных эпох и стран, включая казахстанских артистов" },
  history: { name: "История", emoji: "🏛️", ai: "история: события, правители, изобретения, древние цивилизации, история Казахстана" },
  sport: { name: "Спорт", emoji: "⚽", ai: "спорт: чемпионаты, рекорды, известные спортсмены (в том числе казахстанские), правила игр" },
  flags: { name: "Флаги мира", emoji: "🏳️", geo: "flags" },
  globe: { name: "Страна на глобусе", emoji: "🌍", geo: "globe" },
  geo: { name: "География: флаги и глобус", emoji: "🗺️", geo: "mix" },
  school: { name: "Школьная программа", emoji: "🎓", school: null },
  phys: { name: "Физика", emoji: "⚡", school: "phys" },
  chem: { name: "Химия", emoji: "🧪", school: "chem" },
  bio: { name: "Биология", emoji: "🌿", school: "bio" },
  math: { name: "Математика", emoji: "📐", school: "math" },
  cs: { name: "Информатика", emoji: "💻", school: "cs" },
};

// ---------- география: вопросы без ИИ ----------
// [alpha-2, ISO 3166-1 numeric] — numeric совпадает с id стран в world-atlas (для глобуса)
const COUNTRIES = "KZ398 RU643 US840 CN156 JP392 IN356 BR076 AU036 CA124 DE276 FR250 GB826 IT380 ES724 PT620 TR792 EG818 ZA710 NG566 KE404 MX484 AR032 CL152 PE604 CO170 VE862 UA804 BY112 PL616 SE752 NO578 FI246 DK208 NL528 BE056 CH756 AT040 GR300 CZ203 HU348 RO642 BG100 RS688 IR364 IQ368 SA682 AE784 IL376 PK586 AF004 UZ860 KG417 TJ762 TM795 MN496 KR410 KP408 VN704 TH764 ID360 PH608 MY458 NZ554 MA504 DZ012 LY434 SD729 ET231 MG450 CU192 IS352 IE372 GE268 AM051 AZ031 SY760 JO400 YE887 OM512 NP524 BD050 LK144 MM104 KH116 BO068 PY600 UY858 EC218 CD180 AO024 TZ834 ML466 NE562 TD148 CM120 GH288 SN686 SO706 ZM894 ZW716 MZ508 NA516 BW072"
  .split(" ").map((x) => ({ a2: x.slice(0, 2), num: x.slice(2) }));
const BIG = new Set("KZ RU US CN JP IN BR AU CA DE FR GB IT ES TR EG ZA NG MX AR CL PE CO UA PL SE NO FI IR SA PK AF UZ MN KR TH ID PH NZ MA DZ LY SD ET MG CU IS GR RO KG TM BO VE CD AO TZ ML NE TD MZ NA ZM KE SO YE OM MM".split(" "));
const ruName = (() => { let dn = null; try { dn = new Intl.DisplayNames(["ru"], { type: "region" }); } catch { /* */ } return (a2) => (dn && dn.of(a2)) || a2; })();
function geoQuestion(kind) {
  const pool = kind === "globe" ? COUNTRIES.filter((c) => BIG.has(c.a2)) : COUNTRIES;
  const ans = pool[rnd(pool.length)], others = shuffle(pool.filter((c) => c.a2 !== ans.a2)).slice(0, 3);
  const opts = shuffle([ans, ...others]);
  const correct = opts.indexOf(ans);
  if (kind === "flags") return { kind: "flag", q: "Чей это флаг?", options: opts.map((c) => ruName(c.a2)), correct, image: `https://flagcdn.com/w640/${ans.a2.toLowerCase()}.png`, fact: "" };
  return { kind: "globe", q: "Какая страна подсвечена на глобусе?", options: opts.map((c) => ruName(c.a2)), correct, geo: ans.num, fact: "" };
}

// ---------- картинки из Википедии (бесплатно, по названию статьи) ----------
async function wikiImage(title) {
  if (!title) return null;
  for (const lang of ["ru", "en"]) {
    try {
      const r = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(String(title).replace(/ /g, "_"))}`, { headers: { "User-Agent": "OpenSchoolAI-Quiz/1.0" }, signal: AbortSignal.timeout(4000) });
      if (!r.ok) continue;
      const j = await r.json(); const src = (j.originalimage && j.originalimage.width <= 1600 ? j.originalimage.source : null) || (j.thumbnail && j.thumbnail.source);
      if (src && /^https:\/\/upload\.wikimedia\.org\//.test(src) && !/\.svg/i.test(src)) return src.replace(/\/(\d+)px-/, "/640px-");
    } catch { /* следующий язык */ }
  }
  return null;
}

// ---------- генерация вопросов ----------
const GEN = `Ты составляешь вопросы для весёлой командной викторины (как «Что? Где? Когда?», но быстрее): интересно, неожиданно, без занудства, понятно школьнику и взрослому.
Требования к каждому вопросу:
- короткий (до 160 знаков), читается вслух ведущим за 5–8 секунд; без «Какое из следующих…»;
- 4 варианта ответа, короткие (до 40 знаков), правдоподобные, один верный; верный — в случайной позиции;
- только проверенные, однозначные факты — никаких спорных или устаревающих;
- fact — одна живая фраза-пояснение после ответа («А знаете ли вы…»), до 160 знаков;
- image — точное название статьи русской Википедии для иллюстрации к вопросу, которая НЕ выдаёт ответ (например, для «кто снял фильм X» — сам фильм X, а не режиссёр); если картинка не нужна — пустая строка.
Ответ — строго JSON: {"questions":[{"q":"…","options":["…","…","…","…"],"correct":0,"fact":"…","image":"…"}]}`;
async function aiQuestions(topic, n, extra) {
  const { oneShot, jsonOf } = require("./tutor.js");
  const j = jsonOf(await oneShot(GEN, `Тема: ${topic}.\nНужно вопросов: ${n}. Разной сложности: от лёгких к трудным.${extra ? "\n" + extra : ""}`, 85000));
  return (j.questions || []).filter((q) => q && typeof q.q === "string" && Array.isArray(q.options) && q.options.length === 4 && Number.isInteger(q.correct) && q.correct >= 0 && q.correct < 4)
    .map((q) => ({ kind: "text", q: clean(q.q, 220), options: q.options.map((o) => clean(o, 60)), correct: q.correct, fact: clean(q.fact, 220), imageTitle: clean(q.image, 120), lesson: q.lesson || null }));
}
async function schoolQuestions(subject, n) {
  const pool = await getPool();
  const r = await pool.request().input("s", sql.NVarChar(32), subject).query(`SELECT TOP 40 s.code subj, t.page_url, l.sort, lt.title, lt.body_json FROM luch.lessons l
    JOIN luch.topics t ON t.id = l.topic_id JOIN luch.subjects s ON s.id = t.subject_id JOIN luch.lesson_texts lt ON lt.lesson_id = l.id AND lt.lang = 'ru'
    WHERE (@s IS NULL OR s.code = @s) AND t.status <> 'soon' ORDER BY NEWID()`);
  const ls = r.recordset.slice(0, Math.max(6, n));
  const material = ls.map((l, i) => `[${i}] ${l.title}: ${(() => { try { return JSON.parse(l.body_json).join(" ").slice(0, 600); } catch { return ""; } })()}`).join("\n");
  const qs = await aiQuestions("школьные уроки (материал ниже): вопросы на понимание и примеры из жизни, не зубрёжка", n,
    `Материал уроков:\n${material}\nК каждому вопросу добавь поле "lesson": номер урока из квадратных скобок, на котором он основан.`);
  return qs.map((q) => { const l = ls[+q.lesson]; return { ...q, lesson: l ? { title: l.title, url: l.page_url + "?l=" + l.sort } : null }; });
}
async function bankQuestions(cat, n) {
  const pool = await getPool();
  const have = (await pool.request().input("c", sql.VarChar(20), cat).query("SELECT COUNT(*) n FROM quiz.bank WHERE category = @c")).recordset[0].n;
  // в банке достаточно — берём оттуда (бесплатно), иначе генерируем свежие и пополняем банк
  if (have >= n * 4) {
    const r = await pool.request().input("c", sql.VarChar(20), cat).input("n", sql.Int, n).query("SELECT TOP (@n) id, body FROM quiz.bank WHERE category = @c ORDER BY used + RAND(CHECKSUM(NEWID())) * 3");
    await pool.request().query("UPDATE quiz.bank SET used = used + 1 WHERE id IN (" + r.recordset.map((x) => +x.id).join(",") + ")");
    return r.recordset.map((x) => JSON.parse(x.body));
  }
  const qs = await aiQuestions(CATS[cat].ai, n + 3);
  await Promise.all(qs.map(async (q) => { q.image = await wikiImage(q.imageTitle); }));
  for (const q of qs) await pool.request().input("c", sql.VarChar(20), cat).input("b", sql.NVarChar(sql.MAX), JSON.stringify(q)).query("INSERT INTO quiz.bank (category, body) VALUES (@c, @b)");
  return shuffle(qs).slice(0, n);
}
async function makeQuestions(cat, n) {
  const c = CATS[cat];
  if (c.geo) return Array.from({ length: n }, (_, i) => geoQuestion(c.geo === "mix" ? (i % 2 ? "globe" : "flags") : c.geo));
  if ("school" in c) { const qs = await schoolQuestions(c.school, n); await Promise.all(qs.map(async (q) => { q.image = await wikiImage(q.imageTitle); })); return qs.slice(0, n); }
  return bankQuestions(cat, n);
}

// ---------- комната ----------
const code6 = () => { let c; do { c = Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[rnd(32)]).join(""); } while (rooms.has(c)); return c; };
const tok = () => crypto.randomBytes(12).toString("hex");
function addPlayer(room, name) {
  const pid = "p" + (++room.seq), token = tok();
  room.players.set(pid, { pid, name, token, score: 0, answers: {}, seen: Date.now(), voice: false, gone: false });
  room.signals.set(pid, []); room.v++;
  return { pid, token };
}
function auth(room, q) { const p = room.players.get(q.pid); return p && !p.gone && p.token === q.token ? p : null; }
const active = (room) => [...room.players.values()].filter((p) => !p.gone && Date.now() - p.seen < 30000);

function tick(room) {
  const now = Date.now();
  if (room.phase === "loading" && room.questions.length) { room.phase = "q"; room.qi = 0; room.qStart = now + 1500; room.v++; }
  if (room.phase === "loading" && now - room.loadStart > LOAD_MAX) { room.phase = "lobby"; room.error = "Не получилось подготовить вопросы — попробуйте ещё раз."; room.v++; }
  if (room.phase === "q") {
    const ps = active(room), all = ps.length && ps.every((p) => room.questions[room.qi] && p.answers[room.qi] !== undefined);
    if (now - room.qStart > Q_TIME || (all && now - room.qStart > 2500)) { room.phase = "reveal"; room.revealStart = now; room.v++; }
  }
  if (room.phase === "reveal" && now - room.revealStart > REVEAL) {
    if (room.qi + 1 < room.questions.length) { room.qi++; room.phase = "q"; room.qStart = now + 600; }
    else { room.phase = "final"; room.finished = now; saveGame(room).catch(() => {}); }
    room.v++;
  }
}
async function saveGame(room) {
  const ranking = [...room.players.values()].sort((a, b) => b.score - a.score);
  const pool = await getPool();
  await pool.request().input("c", sql.Char(6), room.code).input("cat", sql.VarChar(20), room.category).input("q", sql.Int, room.questions.length)
    .input("p", sql.Int, room.players.size).input("w", sql.NVarChar(40), ranking[0] ? ranking[0].name : null).input("ref", sql.NVarChar(200), room.ref || null)
    .query("INSERT INTO quiz.games (code, category, questions, players, winner, ref, finished_at) VALUES (@c, @cat, @q, @p, @w, @ref, SYSUTCDATETIME())");
}
function view(room, me) {
  tick(room);
  const now = Date.now(), q = room.questions[room.qi];
  const players = [...room.players.values()].filter((p) => !p.gone).map((p) => ({ pid: p.pid, name: p.name, score: p.score, host: p.pid === room.host, voice: p.voice, online: now - p.seen < 15000,
    answered: room.phase === "q" ? p.answers[room.qi] !== undefined : undefined }));
  const out = { ok: true, code: room.code, v: room.v, phase: room.phase, category: room.category, catName: CATS[room.category].name, emoji: CATS[room.category].emoji, total: room.count,
    qi: room.qi, players, me: { pid: me.pid, host: me.pid === room.host, name: me.name }, error: room.error || null, now };
  if ((room.phase === "q" || room.phase === "reveal") && q) {
    out.question = { kind: q.kind, q: q.q, options: q.options, image: q.image || null, geo: q.geo || null };
    out.left = room.phase === "q" ? Math.max(0, Q_TIME - (now - room.qStart)) : 0; out.starts = Math.max(0, room.qStart - now);
    out.myAnswer = me.answers[room.qi] ? me.answers[room.qi].choice : null;
  }
  if (room.phase === "reveal" && q) {
    const ans = [...room.players.values()].filter((p) => p.answers[room.qi]);
    const right = ans.filter((p) => p.answers[room.qi].ok).sort((a, b) => a.answers[room.qi].t - b.answers[room.qi].t);
    out.reveal = { correct: q.correct, fact: q.fact, lesson: q.lesson || null, counts: [0, 1, 2, 3].map((i) => ans.filter((p) => p.answers[room.qi].choice === i).length),
      fastest: right[0] ? { name: right[0].name, sec: Math.round(right[0].answers[room.qi].t / 100) / 10 } : null, right: right.length, gain: me.answers[room.qi] ? me.answers[room.qi].gain : 0 };
  }
  if (room.phase === "final") out.lessons = room.questions.filter((x) => x.lesson).map((x) => x.lesson).filter((l, i, a) => a.findIndex((y) => y.url === l.url) === i).slice(0, 4);
  const sig = room.signals.get(me.pid); if (sig && sig.length) { out.signals = sig.splice(0); }
  return out;
}

async function body(req, readBody) { try { return JSON.parse(await readBody(req)) || {}; } catch { return {}; } }
const lim = new Map();
function limited(ip, n) { const now = Date.now(), a = (lim.get(ip) || []).filter((t) => now - t < 3600e3); if (a.length >= n) return true; a.push(now); lim.set(ip, a); if (lim.size > 5000) lim.clear(); return false; }

async function handle(req, res, { readBody, clientIp }) {
  const url = new URL(req.url, "http://x"), p = url.pathname.replace(/\/+$/, ""), M = req.method;
  for (const [c, r] of rooms) if (Date.now() - r.touched > ROOM_TTL) rooms.delete(c);
  // серверы для голосового чата: STUN бесплатно; TURN-ретранслятор (для мобильных и корпоративных сетей) — если задан в настройках
  if (p === "/api/quizroom/ice") {
    const ice = [{ urls: ["stun:stun.l.google.com:19302", "stun:global.stun.twilio.com:3478"] }];
    if (process.env.QUIZ_TURN_URLS) ice.push({ urls: process.env.QUIZ_TURN_URLS.split(",").map((x) => x.trim()), username: process.env.QUIZ_TURN_USER || "", credential: process.env.QUIZ_TURN_PASS || "" });
    return send(res, 200, { ok: true, iceServers: ice });
  }
  if (p === "/api/quizroom/categories") return send(res, 200, { ok: true, categories: Object.entries(CATS).map(([id, c]) => ({ id, name: c.name, emoji: c.emoji, group: c.geo ? "geo" : "school" in c ? "school" : "fun" })) });
  if (p === "/api/quizroom/create" && M === "POST") {
    if (limited(clientIp(req), 30)) return send(res, 429, { ok: false, error: "Слишком много комнат за час — подождите немного." });
    const b = await body(req, readBody), cat = CATS[b.category] ? b.category : "mix", name = clean(b.name, 24);
    if (!name) return send(res, 400, { ok: false, error: "Как тебя зовут?" });
    const code = code6(), room = { code, category: cat, count: [5, 10, 15].includes(+b.count) ? +b.count : 10, host: null, players: new Map(), signals: new Map(), seq: 0, v: 1, phase: "lobby", qi: 0, questions: [], created: Date.now(), touched: Date.now(), ref: clean(b.ref, 200) };
    const me = addPlayer(room, name); room.host = me.pid; rooms.set(code, room);
    return send(res, 200, { ok: true, code, ...me });
  }
  const m = p.match(/^\/api\/quizroom\/([A-Z0-9]{6})\/(join|state|start|again|kick|answer|signal|voice|leave)$/);
  if (!m) return send(res, 404, { ok: false, error: "нет такого адреса" });
  const room = rooms.get(m[1]);
  if (!room) return send(res, 404, { ok: false, error: "Комната не найдена — возможно, игра давно закончилась." });
  room.touched = Date.now();
  const act = m[2];
  if (act === "join" && M === "POST") {
    const name = clean((await body(req, readBody)).name, 24);
    if (!name) return send(res, 400, { ok: false, error: "Как тебя зовут?" });
    if ([...room.players.values()].filter((x) => !x.gone).length >= MAX_PLAYERS) return send(res, 400, { ok: false, error: "В комнате уже " + MAX_PLAYERS + " игроков." });
    let nm = name; for (let i = 2; [...room.players.values()].some((x) => !x.gone && x.name.toLowerCase() === nm.toLowerCase()); i++) nm = name + " " + i;
    return send(res, 200, { ok: true, ...addPlayer(room, nm) });
  }
  const q = M === "GET" ? Object.fromEntries(url.searchParams) : await body(req, readBody);
  const me = auth(room, q);
  if (!me) return send(res, 403, { ok: false, error: "Вы не в этой комнате — войдите по ссылке ещё раз.", gone: true });
  me.seen = Date.now();
  if (act === "state") return send(res, 200, view(room, me));
  const host = me.pid === room.host;
  if ((act === "start" || act === "again") && host) {
    if (room.phase !== "lobby" && room.phase !== "final") return send(res, 200, view(room, me));
    if (act === "again") for (const pl of room.players.values()) { pl.score = 0; pl.answers = {}; }
    if (q.category && CATS[q.category]) room.category = q.category;
    room.phase = "loading"; room.loadStart = Date.now(); room.questions = []; room.qi = 0; room.error = null; room.v++;
    makeQuestions(room.category, room.count).then((qs) => { if (!qs.length) throw new Error("пусто"); room.questions = qs; room.v++; })
      .catch((e) => { console.log("[quizroom] " + (e && e.message)); room.phase = "lobby"; room.error = "Не получилось подготовить вопросы — попробуйте ещё раз."; room.v++; });
    return send(res, 200, view(room, me));
  }
  if (act === "answer") {
    tick(room);
    const choice = +q.choice, qq = room.questions[room.qi];
    if (room.phase === "q" && qq && +q.qi === room.qi && me.answers[room.qi] === undefined && choice >= 0 && choice < 4 && Date.now() >= room.qStart) {
      const t = Date.now() - room.qStart, ok = choice === qq.correct, gain = ok ? 500 + Math.round(500 * Math.max(0, 1 - t / Q_TIME)) : 0;
      me.answers[room.qi] = { choice, t, ok, gain }; me.score += gain; room.v++;
    }
    return send(res, 200, view(room, me));
  }
  if (act === "kick" && host) { const t = room.players.get(q.target); if (t && t.pid !== room.host) { t.gone = true; room.v++; } return send(res, 200, view(room, me)); }
  if (act === "voice") { me.voice = !!q.on; room.v++; return send(res, 200, { ok: true }); }
  if (act === "leave") { me.gone = true; me.voice = false; room.v++; if (room.host === me.pid) { const next = active(room).find((x) => x.pid !== me.pid); if (next) room.host = next.pid; } return send(res, 200, { ok: true }); }
  if (act === "signal") {
    // голосовой чат: передаём WebRTC-сообщения (offer/answer/ice) адресату, он заберёт их со следующим опросом
    const target = room.signals.get(String(q.to || "")); if (!target || !q.data) return send(res, 400, { ok: false });
    if (JSON.stringify(q.data).length > 20000) return send(res, 400, { ok: false });
    if (target.length < 300) target.push({ from: me.pid, data: q.data });
    return send(res, 200, { ok: true });
  }
  return send(res, 403, { ok: false, error: "Это может только ведущий комнаты." });
}

module.exports = {
  handle(req, res, deps) {
    handle(req, res, deps).catch((e) => { console.log("[quizroom] " + (e && e.message)); try { send(res, 500, { ok: false, error: "ошибка сервера" }); } catch { /* уже ответили */ } });
  },
};
