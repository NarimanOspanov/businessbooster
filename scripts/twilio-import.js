#!/usr/bin/env node
// Подключает номер Twilio к агенту ElevenLabs.
//
//   node scripts/twilio-import.js list     — показать номера в Twilio и в ElevenLabs
//   node scripts/twilio-import.js import   — импортировать номер в ElevenLabs
//
// Секреты берутся из файлов в домашней папке и нигде не печатаются:
//   .elevenlabs-key   — ключ ElevenLabs, одной строкой
//   .twilio-creds     — две строки: Account SID (ACxxxx), затем Auth Token
//
// Импортировать нужно один раз. Дальше id номера кладётся в переменную
// ELEVENLABS_PHONE_NUMBER_ID на сервере, и демо-звонок начинает работать.

const fs = require("fs");
const os = require("os");
const path = require("path");

const AGENT_ID =
  process.env.ELEVENLABS_AGENT_ID || "agent_2501m0ywtypefffaq1hf5edfadf5";

function readSecret(file, what) {
  const p = path.join(os.homedir(), file);
  try {
    const v = fs.readFileSync(p, "utf8").trim();
    if (!v) throw new Error("пусто");
    return v;
  } catch {
    console.error("Не нашёл " + what + " в файле:\n  " + p);
    process.exit(1);
  }
}

const EL_KEY = readSecret(".elevenlabs-key", "ключ ElevenLabs");
const TW = readSecret(".twilio-creds", "данные Twilio")
  .split(/\r?\n/)
  .map((x) => x.trim())
  .filter(Boolean);

if (TW.length < 2 || !/^AC[0-9a-f]{32}$/i.test(TW[0])) {
  console.error(
    "Файл ~/.twilio-creds должен содержать две строки:\n" +
      "  первая — Account SID, начинается с AC\n" +
      "  вторая — Auth Token\n" +
      "Взять их: console.twilio.com → панель Account Info."
  );
  process.exit(1);
}
const [TW_SID, TW_TOKEN] = TW;

// ------------------------------------------------------------------ Twilio

async function twilioNumbers() {
  const url =
    "https://api.twilio.com/2010-04-01/Accounts/" + TW_SID + "/IncomingPhoneNumbers.json?PageSize=50";
  const res = await fetch(url, {
    headers: {
      Authorization: "Basic " + Buffer.from(TW_SID + ":" + TW_TOKEN).toString("base64"),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error("Twilio HTTP " + res.status + " — " + text.slice(0, 300));
  return JSON.parse(text).incoming_phone_numbers || [];
}

// -------------------------------------------------------------- ElevenLabs

async function elevenlabs(method, urlPath, body) {
  const res = await fetch("https://api.elevenlabs.io/v1/convai" + urlPath, {
    method,
    headers: {
      "xi-api-key": EL_KEY,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error("ElevenLabs HTTP " + res.status + " — " + text.slice(0, 300));
  return text ? JSON.parse(text) : null;
}

// ------------------------------------------------------------------ команды

const cmd = process.argv[2];

(async () => {
  if (cmd === "list") {
    const nums = await twilioNumbers();
    console.log("В Twilio: " + nums.length);
    nums.forEach((n) =>
      console.log("  " + n.phone_number + "  " + (n.friendly_name || "") +
        "  голос: " + (n.capabilities && n.capabilities.voice ? "да" : "НЕТ"))
    );
    const el = await elevenlabs("GET", "/phone-numbers");
    console.log("\nВ ElevenLabs: " + el.length);
    el.forEach((n) =>
      console.log("  " + n.phone_number + "  id: " + n.phone_number_id +
        "  агент: " + (n.assigned_agent ? n.assigned_agent.agent_name : "не назначен"))
    );
    return;
  }

  if (cmd === "import") {
    const nums = await twilioNumbers();
    const voice = nums.filter((n) => n.capabilities && n.capabilities.voice);
    if (!voice.length) {
      console.error(
        "В Twilio нет номера с поддержкой голоса. Купите номер: " +
          "console.twilio.com → Phone Numbers → Buy a number, галочка Voice."
      );
      process.exit(1);
    }
    const pick = process.argv[3] || voice[0].phone_number;
    const chosen = voice.find((n) => n.phone_number === pick);
    if (!chosen) {
      console.error("Номер " + pick + " не найден. Доступны: " +
        voice.map((n) => n.phone_number).join(", "));
      process.exit(1);
    }

    const already = (await elevenlabs("GET", "/phone-numbers")).find(
      (n) => n.phone_number === chosen.phone_number
    );
    if (already) {
      console.log("Уже импортирован. phone_number_id: " + already.phone_number_id);
      return;
    }

    const created = await elevenlabs("POST", "/phone-numbers", {
      phone_number: chosen.phone_number,
      label: "Ответ — демо",
      provider: "twilio",
      sid: TW_SID,
      token: TW_TOKEN,
      agent_id: AGENT_ID,
    });
    console.log("Импортирован " + chosen.phone_number);
    console.log("phone_number_id: " + (created.phone_number_id || JSON.stringify(created)));
    console.log("\nПоложите это значение в переменную сервера ELEVENLABS_PHONE_NUMBER_ID.");
    return;
  }

  console.error("Укажите команду: list или import");
  process.exit(1);
})().catch((e) => {
  console.error(String(e.message));
  process.exit(1);
});
