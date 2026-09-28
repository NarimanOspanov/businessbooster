// Кредитное бюро — ЗАГЛУШКА.
//
// Лендинг /ipoteka проверяет кредитный рейтинг клиента в два шага, как это
// обычно устроено у бюро: клиент вводит ИИН и телефон и даёт согласие на
// запрос, бюро присылает ему код, клиент вводит код — получаем рейтинг.
//
// Сейчас оба шага отвечают тестовыми данными: код всегда TEST_CODE, рейтинг
// выводится из ИИН (один и тот же ИИН — один и тот же ответ). Чтобы подключить
// настоящее бюро (например, Первое кредитное бюро, 1cb.kz), замените тела
// startRequest и confirmRequest на вызовы его API. Формат ответов менять не
// нужно — страница и сервер ждут именно его:
//
//   startRequest({ iin, phone })  → { ok, requestId, stub, hint? }  или { ok:false, error }
//   confirmRequest({ requestId, code }) → { ok, stub, score, band, bandText, loans?, overdue? }
//
// Ключи и адрес API бюро держите в переменных окружения (например
// CREDIT_BUREAU_URL, CREDIT_BUREAU_KEY) — в код их не пишем.

const crypto = require("crypto");

const STUB = !process.env.CREDIT_BUREAU_URL; // пока адреса нет — работаем заглушкой
const TEST_CODE = "1234";
const TTL_MS = 10 * 60 * 1000;
const pending = new Map(); // requestId → { iin, phone, at, tries }

// Контрольная цифра ИИН: веса 1..11, остаток от деления на 11; если 10 —
// второй набор весов 3..11,1,2; если снова 10 — ИИН недействителен.
function validIin(iin) {
  const s = String(iin || "");
  if (!/^\d{12}$/.test(s)) return false;
  const d = s.split("").map(Number);
  const sum = (w) => w.reduce((a, x, i) => a + x * d[i], 0) % 11;
  let c = sum([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  if (c === 10) c = sum([3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2]);
  return c !== 10 && c === d[11];
}

// Шкала рейтинга 0–1200 (так её показывают бюро и маркетплейсы).
function bandOf(score) {
  if (score < 400) return { band: "low", bandText: "Шансы на одобрение низкие. Сначала стоит разобраться с просрочками." };
  if (score < 600) return { band: "fair", bandText: "Одобрение возможно, но не гарантировано. Помогут больший взнос или созаёмщик." };
  if (score < 800) return { band: "good", bandText: "Хорошие шансы на одобрение." };
  if (score < 1000) return { band: "very_good", bandText: "Очень хорошие шансы на одобрение." };
  return { band: "excellent", bandText: "Отличный заёмщик: шансы максимальные." };
}

function cleanup() {
  const now = Date.now();
  for (const [k, v] of pending) if (now - v.at > TTL_MS) pending.delete(k);
}

async function startRequest({ iin, phone }) {
  cleanup();
  if (!validIin(iin)) return { ok: false, error: "ИИН неверный: 12 цифр, проверьте номер" };
  if (!/^7\d{10}$/.test(String(phone || ""))) return { ok: false, error: "номер телефона: +7 и 10 цифр" };
  if (!STUB) {
    // TODO: вызвать API бюро — отправить клиенту код подтверждения.
    return { ok: false, error: "подключение к бюро ещё не настроено" };
  }
  const requestId = crypto.randomBytes(12).toString("hex");
  pending.set(requestId, { iin: String(iin), phone: String(phone), at: Date.now(), tries: 0 });
  return { ok: true, requestId: requestId, stub: true, hint: "Тестовый режим: код " + TEST_CODE };
}

async function confirmRequest({ requestId, code }) {
  cleanup();
  const p = pending.get(String(requestId || ""));
  if (!p) return { ok: false, error: "запрос устарел, начните заново" };
  if (++p.tries > 5) { pending.delete(requestId); return { ok: false, error: "слишком много попыток, начните заново" }; }
  if (!STUB) {
    // TODO: вызвать API бюро — подтвердить код и получить рейтинг и отчёт.
    return { ok: false, error: "подключение к бюро ещё не настроено" };
  }
  if (String(code || "").trim() !== TEST_CODE) return { ok: false, error: "код не подошёл" };
  pending.delete(requestId);
  // Детерминированный тестовый рейтинг из ИИН: 420–1080.
  const h = crypto.createHash("sha256").update("stub:" + p.iin).digest();
  const score = 420 + (h.readUInt16BE(0) % 661);
  const loans = h[2] % 4;
  return Object.assign({ ok: true, stub: true, score: score, loans: loans, overdue: score < 500 && loans > 0 }, bandOf(score));
}

function mask(iin) { const s = String(iin || ""); return s.length === 12 ? s.slice(0, 2) + "••••••••" + s.slice(-2) : "—"; }

module.exports = { STUB, TEST_CODE, validIin, bandOf, startRequest, confirmRequest, mask };
