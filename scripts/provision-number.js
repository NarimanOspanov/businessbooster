// Заводит купленный номер Zadarma в работу целиком.
//
//   node scripts/provision-number.js --number=+77273122837 [--extension=100]
//                                    [--skip-zadarma] [--free]
//
// Шаги: внутренний номер АТС -> переадресация на SIP-адрес ElevenLabs ->
// импорт номера в ElevenLabs -> запись в пул. Каждый шаг терпит повтор: если
// провизионер упал на середине, его можно запустить снова.
const fs = require("fs");
const os = require("os");
const path = require("path");
const db = require("./db");
const zadarma = require("./zadarma");

const SIP_HOST = "sip.rtc.elevenlabs.io:5060;transport=tcp";
const AGENT = process.env.ELEVENLABS_AGENT_ID || "agent_2501m0ywtypefffaq1hf5edfadf5";

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith("--" + name + "="));
  return hit ? hit.slice(name.length + 3) : null;
}
const has = (name) => process.argv.includes("--" + name);

function elevenKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  return fs.readFileSync(path.join(os.homedir(), ".elevenlabs-key"), "utf8").trim();
}

// Сеть до api.elevenlabs.io отсюда срывается, одиночный запрос ненадёжен.
async function eleven(pathname, init = {}, tries = 4) {
  const key = elevenKey();
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch("https://api.elevenlabs.io" + pathname, {
        ...init,
        headers: { "xi-api-key": key, "Content-Type": "application/json", ...(init.headers || {}) },
        signal: AbortSignal.timeout(25000),
      });
      const text = await res.text();
      if (!res.ok) throw new Error("ElevenLabs " + res.status + ": " + text.slice(0, 200));
      return text ? JSON.parse(text) : {};
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

async function ensureExtension(wanted) {
  const list = await zadarma.call("/v1/pbx/internal/");
  const numbers = list.numbers || [];
  console.log("  внутренние номера АТС:", numbers.join(", ") || "нет");
  if (wanted && numbers.map(String).includes(String(wanted))) return String(wanted);
  if (!wanted && numbers.length) return String(numbers[0]);

  const made = await zadarma.call("/v1/pbx/internal/create/", {}, "POST");
  const created = made.internal_number || (made.numbers || [])[0];
  console.log("  создан внутренний номер:", created);
  return String(created);
}

async function setRedirection(extension, number) {
  const destination = number + "@" + SIP_HOST;
  await zadarma.call("/v1/pbx/redirection/", {
    pbx_number: extension,
    status: "on",
    type: "sip_uri",
    destination,
    condition: "always",
  }, "POST");

  const check = await zadarma.call("/v1/pbx/redirection/", { pbx_number: extension });
  console.log("  переадресация:", JSON.stringify(check).slice(0, 240));
  return destination;
}

async function importToEleven(number) {
  const have = await eleven("/v1/convai/phone-numbers");
  const already = (have || []).find((p) => p.phone_number === number);
  if (already) {
    console.log("  в ElevenLabs уже есть:", already.phone_number_id);
    return already.phone_number_id;
  }
  const made = await eleven("/v1/convai/phone-numbers", {
    method: "POST",
    body: JSON.stringify({
      provider: "sip_trunk",
      phone_number: number,
      label: "Reception365 — " + number,
    }),
  });
  console.log("  импортирован:", made.phone_number_id);
  return made.phone_number_id;
}

(async () => {
  const number = arg("number");
  if (!number || !/^\+\d{10,15}$/.test(number)) {
    console.log("укажите --number=+7727XXXXXXX в международном формате");
    process.exit(1);
  }
  console.log("номер:", number);

  let extension = arg("extension");
  if (has("skip-zadarma")) {
    console.log("\n[1-2] Zadarma пропущена по флагу");
  } else {
    console.log("\n[1] внутренний номер АТС");
    extension = await ensureExtension(extension);
    console.log("\n[2] переадресация на ElevenLabs");
    console.log("  адрес:", await setRedirection(extension, number));
  }

  console.log("\n[3] импорт в ElevenLabs");
  const phoneNumberId = await importToEleven(number);
  await eleven("/v1/convai/phone-numbers/" + phoneNumberId, {
    method: "PATCH",
    body: JSON.stringify({ agent_id: AGENT }),
  });
  console.log("  агент привязан:", AGENT);

  console.log("\n[4] запись в пул");
  // 'free' ставим только по флагу: номер бывает куплен, но ещё не активирован
  // у оператора, и выдавать его клинике в этот момент нельзя.
  const status = has("free") ? "free" : "preparing";
  await db.upsertNumber({
    number,
    status,
    phone_number_id: phoneNumberId,
    pbx_extension: extension || null,
  });
  console.log("  статус:", status);

  console.log("\nготово. В пуле сейчас:");
  for (const n of await db.numbersByStatus()) {
    console.log("  ", n.number, "|", n.status, "|", n.pbx_extension || "—",
      "|", n.clinic_id ? "клиника " + n.clinic_id : "свободен");
  }
  process.exit(0);
})().catch((e) => {
  console.log("\nне вышло:", e.message);
  process.exit(1);
});
