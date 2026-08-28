// Проверка разбора страниц: какая модель настроена, какие вообще доступны и
// что получится на живой карточке 2GIS.
//
//   node scripts/check-enrich.js
//   node scripts/check-enrich.js https://2gis.kz/almaty/firm/70000001104984417
const fs = require("fs");
const os = require("os");
const path = require("path");
const enrich = require("./enrich.js");

const DEFAULT_URL = "https://2gis.kz/almaty/firm/70000001104984417";

function geminiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  try {
    return fs.readFileSync(path.join(os.homedir(), ".gemini-key"), "utf8").trim() || null;
  } catch {
    return null;
  }
}

// Имя модели меняется от версии к версии, а ошибка приходит только в момент
// разбора у клиники на глазах. Спрашиваем список у самого Google.
async function listGeminiModels(key) {
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
    headers: { "x-goog-api-key": key },
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error("http " + r.status + ": " + (await r.text()).slice(0, 200));
  const j = await r.json();
  return (j.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
    .map((m) => String(m.name).replace(/^models\//, ""));
}

(async () => {
  const who = enrich.provider();
  console.log("поставщик:", who || "ключа нет");
  if (!who) {
    console.log("\nПоложите ключ в ~/.gemini-key или задайте GEMINI_API_KEY.");
    return;
  }

  if (who === "gemini") {
    const key = geminiKey();
    const want = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    try {
      const models = await listGeminiModels(key);
      console.log("доступно моделей:", models.length);
      const flash = models.filter((m) => /flash/.test(m) && !/embedding|image|tts|live/.test(m));
      console.log("подходящие быстрые:", flash.slice(0, 8).join(", ") || "нет");
      console.log("выбрана:", want, models.includes(want) ? "— есть в списке" : "— НЕТ В СПИСКЕ, возьмите одну из перечисленных выше");
    } catch (e) {
      console.log("список моделей не получен:", e.message);
    }
  }

  const url = process.argv[2] || DEFAULT_URL;
  console.log("\nчитаю:", url);
  const page = await enrich.fetchSource(url);
  console.log("прочитано символов:", page.chars);

  console.log("\nразбираю…");
  const t0 = Date.now();
  const profile = await enrich.extractProfile([page]);
  console.log("заняло:", Math.round((Date.now() - t0) / 100) / 10, "с\n");
  for (const [k, v] of Object.entries(profile)) {
    const s = String(v || "").replace(/\n/g, " | ");
    console.log("  " + k + ": " + (s ? s.slice(0, 110) : "— пусто"));
  }
})().catch((e) => console.log("ошибка:", e.message));
