// Выдаёт готовый номер из пула конкретной клинике.
//
//   node scripts/assign-number.js --list
//   node scripts/assign-number.js --number=+77273122851 --clinic=3 [--ready]
//
// Номер к этому моменту уже проведён через provision-number.js: у него есть
// внутренний номер АТС, переадресация на SIP ElevenLabs и phone_number_id.
// Здесь остаётся закрепить его за клиникой и перевести звонки с базового
// агента на агента этой клиники — иначе пациент услышит демо-ассистента.
const fs = require("fs");
const os = require("os");
const path = require("path");
const db = require("./db");

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith("--" + name + "="));
  return hit ? hit.slice(name.length + 3) : null;
}
const has = (name) => process.argv.includes("--" + name);

function elevenKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  return fs.readFileSync(path.join(os.homedir(), ".elevenlabs-key"), "utf8").trim();
}

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

async function clinics() {
  const pool = await db.getPool();
  const r = await pool.request().query(
    "SELECT id, org_id, name, agent_id, phone_number_id, public_number, is_active " +
    "FROM dbo.clinics ORDER BY id"
  );
  return r.recordset;
}

async function show() {
  console.log("\nклиники:");
  for (const c of await clinics()) {
    console.log("  ", String(c.id).padStart(3), "|", (c.name || "—").slice(0, 28).padEnd(28),
      "| агент", c.agent_id ? c.agent_id.slice(0, 22) : "нет",
      "| номер", c.public_number || "нет", c.is_active ? "" : "| ВЫКЛЮЧЕНА");
  }
  console.log("\nномера:");
  for (const n of await db.numbersByStatus()) {
    console.log("  ", n.number, "|", n.status.padEnd(9), "| вн.", n.pbx_extension || "—",
      "|", n.clinic_id ? "клиника " + n.clinic_id : "свободен");
  }
}

(async () => {
  if (has("list")) { await show(); process.exit(0); }

  const number = arg("number");
  const clinicId = Number(arg("clinic"));
  if (!number || !/^\+\d{10,15}$/.test(number) || !clinicId) {
    console.log("укажите --number=+7727XXXXXXX --clinic=<id>; список: --list");
    process.exit(1);
  }

  const clinic = (await clinics()).find((c) => c.id === clinicId);
  if (!clinic) { console.log("клиники", clinicId, "нет"); process.exit(1); }
  if (!clinic.agent_id) {
    console.log("у клиники «" + clinic.name + "» нет агента: сначала анкета на /start/ " +
      "и «Включить» — иначе номер вести некуда");
    process.exit(1);
  }
  console.log("клиника:", clinic.name, "| агент:", clinic.agent_id);

  // preparing -> free: номер бывает куплен, но ещё не проверен. Флаг нужен,
  // чтобы это было решением человека, а не побочным эффектом выдачи.
  if (has("ready")) {
    const pool = await db.getPool();
    await pool.request().input("n", number).query(
      "UPDATE dbo.numbers SET status = 'free' WHERE number = @n AND status = 'preparing'"
    );
    console.log("номер переведён в free");
  }

  const taken = await db.assignNumber(number, clinicId);
  if (!taken) {
    console.log("\nномер не выдан: он либо ещё preparing (добавьте --ready), " +
      "либо уже за кем-то. Как сейчас:");
    await show();
    process.exit(1);
  }
  console.log("выдан:", taken.number, "| phone_number_id:", taken.phone_number_id);

  // Главное действие: звонки на этот номер должен принимать агент клиники.
  await eleven("/v1/convai/phone-numbers/" + taken.phone_number_id, {
    method: "PATCH",
    body: JSON.stringify({ agent_id: clinic.agent_id }),
  });
  const check = await eleven("/v1/convai/phone-numbers/" + taken.phone_number_id);
  const bound = (check.assigned_agent && check.assigned_agent.agent_id) || check.agent_id || "—";
  console.log("агент на номере:", bound, bound === clinic.agent_id ? "— совпадает" : "— НЕ ТОТ");

  await show();
  console.log("\nдальше: клиника ставит переадресацию со своего номера на " + taken.number +
    ", потом контрольный звонок.");
  process.exit(0);
})().catch((e) => {
  console.log("\nне вышло:", e.message);
  process.exit(1);
});
