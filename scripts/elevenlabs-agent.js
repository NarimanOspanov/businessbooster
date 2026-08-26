#!/usr/bin/env node
// Читает и настраивает агента ElevenLabs.
//
//   node scripts/elevenlabs-agent.js get     — показать текущую конфигурацию
//   node scripts/elevenlabs-agent.js apply   — записать конфигурацию ниже
//
// Ключ нигде не печатается, в репозиторий не попадает и в переписке не
// участвует. Берётся из переменной среды, а если её нет — из файла в домашней
// папке: переменная, заданная в одном окне терминала, в другой шелл не
// переходит, а файл виден всем.

const fs = require("fs");
const os = require("os");
const path = require("path");

const AGENT_ID =
  process.env.ELEVENLABS_AGENT_ID || "agent_2501m0ywtypefffaq1hf5edfadf5";
const KEY_FILE =
  process.env.ELEVENLABS_KEY_FILE ||
  path.join(os.homedir(), ".elevenlabs-key");

const KEY = (() => {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  try {
    return fs.readFileSync(KEY_FILE, "utf8").trim();
  } catch {
    return null;
  }
})();

const BASE = "https://api.elevenlabs.io/v1/convai/agents/" + AGENT_ID;

if (!KEY) {
  console.error(
    "Ключ не найден.\n" +
      "Положите его одной строкой в файл:\n  " + KEY_FILE + "\n\n" +
      "PowerShell:\n" +
      '  Set-Content -NoNewline -Path "' + KEY_FILE + '" -Value "ваш-ключ"'
  );
  process.exit(1);
}

// --------------------------------------------------------------- содержание

const PROMPT = `Ты — секретарь на телефоне казахстанской стоматологической клиники.
Твоя работа: принять звонок, ответить на вопросы и записать пациента.

КАК ГОВОРИТЬ
Коротко и по делу, как обычный администратор. Без канцелярита и без
восторженности. Одна мысль — одно предложение.

ЧТО ТЫ ДЕЛАЕШЬ
1. Отвечаешь на вопросы о ценах, услугах, адресе, режиме работы и свободном
   времени — строго по данным клиники, которые тебе даны.
2. Подбираешь время и записываешь: имя, телефон, услуга, желаемое время.
3. В конце повторяешь запись целиком и просишь подтвердить.

ЧЕГО ТЫ НЕ ДЕЛАЕШЬ НИКОГДА
- Не ставишь диагнозов и не даёшь медицинских советов. Ты не врач и говоришь
  об этом прямо, если спросят.
- Не выдумываешь цены, сроки и свободные окна. Если не знаешь — так и говори:
  «этого я не знаю, передам администратору, вам перезвонят утром», и бери
  контакт.
- Не споришь и не уговариваешь.
- Если спросят, человек ты или программа — отвечаешь честно, что ты
  ассистент клиники.

СРОЧНЫЕ СЛУЧАИ — ВАЖНЕЕ ВСЕГО ОСТАЛЬНОГО
Если человек говорит про отёк, температуру, кровотечение, травму челюсти или
сильную непроходящую боль — не записывай его «на завтра» и не обсуждай цены.
Скажи, что это может быть срочно, и направь в скорую (103) или в
круглосуточную стоматологию. После этого всё равно возьми имя и телефон,
чтобы клиника связалась утром.

В НАЧАЛЕ РАЗГОВОРА
Скажи, что разговор записывается.`;

const CONFIG = {
  conversation_config: {
    agent: {
      language: "ru",
      first_message:
        "Здравствуйте! Стоматология, ассистент на связи. Разговор записывается. Чем могу помочь?",
      prompt: {
        prompt: PROMPT,
      },
    },
    // Казахского нет в списке доп. языков ElevenLabs (en, ru, uk, tr… — kk
    // отсутствует), поэтому второй язык делается ОТДЕЛЬНЫМ агентом, а не
    // пресетом. Его id кладём в ELEVENLABS_AGENT_ID при запуске.
  },
};

// ------------------------------------------------------------------ запросы

async function call(method, body) {
  const res = await fetch(BASE, {
    method,
    headers: {
      "xi-api-key": KEY,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error("HTTP " + res.status + " — " + text.slice(0, 400));
  }
  return JSON.parse(text);
}

function summary(a) {
  const c = (a && a.conversation_config) || {};
  const ag = c.agent || {};
  return {
    имя: a.name,
    язык: ag.language,
    первая_фраза: (ag.first_message || "").slice(0, 90),
    длина_промпта: ((ag.prompt && ag.prompt.prompt) || "").length,
    модель: (ag.prompt && ag.prompt.llm) || "—",
    доп_языки: Object.keys(c.language_presets || {}),
  };
}

const cmd = process.argv[2];

(async () => {
  if (cmd === "get") {
    console.log(JSON.stringify(summary(await call("GET")), null, 2));
    return;
  }
  if (cmd === "apply") {
    console.log("было:");
    console.log(JSON.stringify(summary(await call("GET")), null, 2));
    const after = await call("PATCH", CONFIG);
    console.log("\nстало:");
    console.log(JSON.stringify(summary(after), null, 2));
    return;
  }
  console.error("Укажите команду: get или apply");
  process.exit(1);
})().catch((e) => {
  console.error(String(e.message));
  process.exit(1);
});
