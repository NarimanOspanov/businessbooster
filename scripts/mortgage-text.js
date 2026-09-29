// Подходит ли квартира под ипотеку — по тексту хозяина и параметрам карточки.
//
// Ответ: "yes" — хозяин прямо пишет, что ипотека возможна (или называет
// программу: Отбасы, 7-20-25, Наурыз…); "no" — прямо отказывается от ипотеки,
// продаёт только за наличные, или по параметрам банк её не одобрит (бывшее
// общежитие, квартира в залоге); null — про ипотеку ничего не сказано.
// Отказ сильнее согласия: «ипотеку не рассматриваю, только наличные» — no.
// «В ипотеке» (квартира сейчас в залоге у банка) — не согласие.

// В JS \w и \b знают только латиницу, поэтому шаблоны пишем как обычно, а
// перед использованием меняем \w на \p{L} и \b на «дальше не буква».
const U = (re) => new RegExp(re.source.replace(/\\w/g, "\\p{L}").replace(/\\b/g, "(?!\\p{L})"), re.flags.replace("u", "") + "u");
const NEG = [
  /без\s+ипотек/i,
  /ипотек\w*[\s,]+(?:[^\s.!?]+[\s,]+){0,3}(?:не\s+(?:рассматр|предлаг|подход|интерес|возможн|принима|оформл|продаю)|нет\b|исключ)/i,
  /не\s+(?:рассматр\w*|подходит|предлага\w*|принима\w*|продаю|продам)\s+(?:[^\s.!?]+\s+){0,2}(?:под\s+|в\s+|по\s+)?ипотек/i,
  /(?:только|исключительно)\s+(?:за\s+)?(?:наличн|нал\b|кэш|cash)/i,
  /ипотекаға\s+(?:болмайды|жоқ|бермейміз)/i,
].map(U);
const POS = [
  /(?:под|в|через)\s+ипотеку/i,
  /ипотек[аиуой]\w*\s+(?:[^\s.!?]+\s+){0,2}(?:возможн|рассматр|подход|одобр|приветств|пройд|проход|есть|да\b)/i,
  /(?:возможн\w*|рассмотр\w*|можно|подходит|подойд[её]т)\s+(?:[^\s.!?]+\s+){0,3}ипотек/i,
  /ипотек\w*\s*[-–—:]\s*(?:да|возможн|можно)/i,
  /ипотекаға\s+(?:болады|беріледі|жарайды)/i,
].map(U);
const PROGRAMS = [
  [/отбасы|жилстройсбер|жсс(?:бк)?\b/i, "Отбасы банк"],
  [/7[\s-]*20[\s-]*25/, "7-20-25"],
  [/наурыз/i, "Наурыз"],
  [/баспана/i, "Баспана Хит"],
  [/алматы\s+жастары/i, "Алматы жастары"],
  [/шаңырақ|шанырак/i, "Шаңырақ"],
].map(([re, name]) => [U(re), name]);

// Предложение вокруг совпадения — для подписи поста.
function sentenceAt(text, idx) {
  const s = Math.max(text.lastIndexOf(".", idx), text.lastIndexOf("!", idx), text.lastIndexOf("\n", idx)) + 1;
  const ends = [".", "!", "\n", "?"].map((c) => text.indexOf(c, idx)).filter((x) => x >= 0);
  const e = ends.length ? Math.min(...ends) : text.length;
  let out = text.slice(s, e).replace(/\s+/g, " ").trim();
  if (out.length > 140) out = out.slice(0, 139).replace(/\s+\S*$/, "") + "…";
  return out;
}

function classify(desc, params) {
  const text = String(desc || "");
  const p = String(params || "");
  const programs = PROGRAMS.filter(([re]) => re.test(text)).map(([, name]) => name);
  if (/бывшее\s+общежитие:\s*да/i.test(p)) return { mortgage: "no", why: "бывшее общежитие", programs: programs, quote: null };
  if (/(?:квартира\s+)?в\s+залоге:\s*да/i.test(p)) return { mortgage: "no", why: "в залоге", programs: programs, quote: null };
  for (const re of NEG) { const m = re.exec(text); if (m) return { mortgage: "no", why: m[0].slice(0, 60), programs: programs, quote: null }; }
  let hit = null;
  for (const re of POS) { const m = re.exec(text); if (m && (!hit || m.index < hit.index)) hit = m; }
  if (!hit && programs.length) hit = PROGRAMS.map(([re]) => re.exec(text)).filter(Boolean).sort((a, b) => a.index - b.index)[0];
  if (hit) return { mortgage: "yes", why: hit[0].slice(0, 60), programs: programs, quote: sentenceAt(text, hit.index) };
  return { mortgage: null, why: null, programs: programs, quote: null };
}

module.exports = { classify };
