// Сборка агента для клиники из анкеты.
//
// Деление такое: постоянная часть промпта — это правила, которые мы вывели из
// живых звонков (здороваться один раз, не произносить номер вслух, срочные
// случаи важнее записи). Клиника их не пишет и не может испортить. Из анкеты
// приходят только факты о клинике.
//
// Новый агент создаётся копией рабочего, а не собирается с нуля: в конфиге
// сидят голос, модель, распознавание, тайминги пауз и языковые пресеты,
// подобранные на реальных разговорах. Повторить это полем за полем — значит
// однажды забыть одно и долго искать, почему новый агент звучит хуже.
const fs = require("fs");
const os = require("os");
const path = require("path");

const BASE_AGENT = process.env.ELEVENLABS_AGENT_ID || "agent_2501m0ywtypefffaq1hf5edfadf5";

function elevenKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  return fs.readFileSync(path.join(os.homedir(), ".elevenlabs-key"), "utf8").trim();
}

async function eleven(pathname, init = {}, tries = 4) {
  const key = elevenKey();
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch("https://api.elevenlabs.io" + pathname, {
        ...init,
        headers: { "xi-api-key": key, "Content-Type": "application/json", ...(init.headers || {}) },
        signal: AbortSignal.timeout(30000),
      });
      const text = await res.text();
      if (!res.ok) throw new Error("ElevenLabs " + res.status + ": " + text.slice(0, 300));
      return text ? JSON.parse(text) : {};
    } catch (e) {
      last = e;
      if (/ElevenLabs 4\d\d/.test(e.message)) throw e; // отказ по существу, повтор не поможет
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw last;
}

// --- анкета ---------------------------------------------------------------

// Поля анкеты. Порядок тот же, в каком их показывает кабинет.
const FIELDS = [
  { key: "name", label: "Название клиники", required: true, max: 120,
    hint: "Как представляться пациенту" },
  { key: "city", label: "Город", max: 60 },
  { key: "address", label: "Адрес", max: 200 },
  { key: "hours", label: "Часы работы", max: 300,
    hint: "Например: пн-пт 9:00-19:00, сб 10:00-15:00, вс выходной" },
  { key: "services", label: "Услуги и цены", multiline: true, max: 3000,
    hint: "По строке на услугу. Чего здесь нет — ассистент не назовёт" },
  { key: "doctors", label: "Врачи и специализации", multiline: true, max: 1000 },
  { key: "booking", label: "Как записывать", max: 400,
    hint: "Подтверждать время сразу или говорить, что администратор перезвонит" },
  { key: "urgent", label: "Что делать при острой боли", multiline: true, max: 600,
    hint: "Куда направлять ночью. По умолчанию — скорая 103" },
  { key: "extra", label: "Что ещё важно знать", multiline: true, max: 2000,
    hint: "Парковка, оплата, детский приём, языки персонала" },
];

// Откуда мы читаем про клинику на онбординге. В промпт эти ссылки не идут —
// из них извлекаются факты, а сами ссылки ассистенту не нужны.
const SOURCES = [
  { key: "src_2gis", label: "Страница в 2GIS", max: 400, placeholder: "https://2gis.kz/almaty/firm/…",
    hint: "Начните с неё: там обычно уже есть адрес, часы, телефон и ссылка на сайт" },
  { key: "src_site", label: "Сайт клиники", max: 300, placeholder: "https://…" },
  { key: "src_instagram", label: "Instagram", max: 300, placeholder: "https://instagram.com/…" },
];

// Необязательная связка с программой записи клиники. Тоже не в промпт:
// это адреса, по которым ассистент будет ходить во время разговора.
const INTEGRATION = [
  { key: "book_read_url", label: "Адрес для чтения расписания", max: 500,
    placeholder: "https://…/slots", hint: "Отдаёт свободное время. Ассистент спросит его, прежде чем предлагать час" },
  { key: "book_write_url", label: "Адрес для записи", max: 500,
    placeholder: "https://…/appointments", hint: "Принимает подтверждённую запись" },
  { key: "book_token", label: "Ключ доступа", max: 200, secret: true,
    hint: "Отправим в заголовке Authorization. Виден только вам" },
];

const ALL_FIELDS = FIELDS.concat(SOURCES, INTEGRATION);

function cleanBy(list, profile) {
  const out = {};
  for (const f of list) {
    const v = profile && profile[f.key];
    out[f.key] = String(v == null ? "" : v).trim().slice(0, f.max);
  }
  return out;
}

// clean() — только факты для промпта. Ссылки и адреса интеграции сюда не
// попадают нарочно: иначе ассистент однажды продиктует пациенту наш токен.
function clean(profile) { return cleanBy(FIELDS, profile); }
function cleanAll(profile) { return cleanBy(ALL_FIELDS, profile); }

// --- промпт ---------------------------------------------------------------

const RULES = `ЗДОРОВАЙСЯ ОДИН РАЗ
Приветствие уже прозвучало в первой фразе. После того как человек
выбрал язык, НЕ здоровайся второй раз — сразу переходи к делу:
«Слушаю вас» или «Чем могу помочь?». Повторное «здравствуйте»
звучит так, будто ты его не услышал.

ЯЗЫК РАЗГОВОРА
Начинаешь с вопроса, на каком языке человеку удобнее: казахском, русском или
английском. Если он с первых слов сам заговорил на одном из трёх — не
переспрашивай, просто отвечай на нём.
Дальше говоришь ТОЛЬКО на выбранном языке и сам не переключаешься. Меняешь
язык, только если человек попросил или сам перешёл на другой.
Казахский для тебя полноценный язык: отвечай на нём так же подробно и точно,
как на русском, не сбивайся на русский посреди фразы.

КАК ГОВОРИТЬ
Коротко и по делу, как обычный администратор. Без канцелярита и без
восторженности. Одна мысль — одно предложение.

ЧТО ТЫ ДЕЛАЕШЬ
1. Отвечаешь на вопросы о ценах, услугах, адресе, режиме работы и свободном
   времени — строго по данным клиники, которые тебе даны ниже.
2. Подбираешь время и записываешь: имя, телефон, услуга, желаемое время.
3. Номер телефона НЕ диктуй и НЕ произноси вслух — ты его не знаешь
   и легко назовёшь чужой. Вместо этого спроси: «перезвонить вам на этот
   же номер или на другой?». Если скажет «на этот» — ничего записывать не
   нужно, он и так сохранится. Если назовёт другой — повтори его по цифрам
   и запиши.
4. В конце повторяешь запись целиком и просишь подтвердить.

ЧЕГО ТЫ НЕ ДЕЛАЕШЬ НИКОГДА
- Не ставишь диагнозов и не даёшь медицинских советов. Ты не врач и говоришь
  об этом прямо, если спросят.
- Не выдумываешь цены, сроки и свободные окна. Если не знаешь — так и говори:
  «этого я не знаю, передам администратору, вам перезвонят утром», и бери
  контакт.
- Не споришь и не уговариваешь.
- Если спросят, человек ты или программа — отвечаешь честно, что ты
  ассистент клиники.`;

const URGENT_DEFAULT = `Если человек говорит про отёк, температуру, кровотечение, травму челюсти или
сильную непроходящую боль — не записывай его «на завтра» и не обсуждай цены.
Скажи, что это может быть срочно, и направь в скорую (103) или в
круглосуточную стоматологию. После этого всё равно возьми имя и телефон,
чтобы клиника связалась утром.`;

function block(title, value) {
  return value ? "\n\n" + title + "\n" + value : "";
}

const TOOLS_RULE = `РАСПИСАНИЕ КЛИНИКИ
У тебя есть доступ к живому расписанию.
- Прежде чем назвать пациенту час, вызови check_slots и предлагай только то,
  что он вернул. Своё время не придумывай никогда.
- Когда пациент подтвердил час, вызови book_slot и запиши его.
- Если инструмент вернул ok:false — не настаивай: скажи, что уточнишь у
  администратора и вам перезвонят, и возьми контакт.`;

function buildPrompt(raw, withTools) {
  const p = clean(raw);
  const where = [p.city, p.address].filter(Boolean).join(", ");

  let s = "Ты — секретарь на телефоне стоматологической клиники «" +
    (p.name || "клиника") + "»" + (p.city ? " в городе " + p.city : " в Казахстане") + ".\n" +
    "Твоя работа: принять звонок, ответить на вопросы и записать пациента.\n\n" +
    RULES;

  s += block("АДРЕС", where);
  s += block("ЧАСЫ РАБОТЫ", p.hours);
  s += block("УСЛУГИ И ЦЕНЫ", p.services);
  s += block("ВРАЧИ", p.doctors);
  s += block("КАК ЗАПИСЫВАТЬ", p.booking);
  if (withTools) s += "\n\n" + TOOLS_RULE;
  s += "\n\nСРОЧНЫЕ СЛУЧАИ — ВАЖНЕЕ ВСЕГО ОСТАЛЬНОГО\n" + (p.urgent || URGENT_DEFAULT);
  s += block("ЧТО ЕЩЁ ВАЖНО", p.extra);

  // Пустые разделы не оставляем: строка «ЦЕНЫ:» без содержимого читается
  // моделью как разрешение придумать цены.
  s += "\n\nЕсли о чём-то выше не сказано — этого ты не знаешь. Так и отвечай.\n" +
    "\nВ НАЧАЛЕ РАЗГОВОРА\nСкажи, что разговор записывается.";
  return s;
}

function buildFirstMessage(raw) {
  const p = clean(raw);
  return "Здравствуйте, сәлеметсіз бе! Вас приветствует клиника " +
    (p.name || "") + ". Разговор записывается. Подскажите, на каком языке вам " +
    "удобнее говорить — қазақша, по-русски или English?";
}


// --- инструменты ассистента ------------------------------------------------
//
// Ассистент умеет во время разговора спросить свободное время и записать
// пациента. Оба инструмента ведут на НАШ сервер, а не на адрес клиники:
// её ключ доступа не должен оказаться в чужой конфигурации, и ответ нужно
// привести к короткому виду, прежде чем показывать модели.

function toolDefs(baseUrl, toolKey) {
  const q = "?k=" + encodeURIComponent(toolKey);
  return [
    {
      type: "webhook",
      name: "check_slots",
      description:
        "Свободное время клиники. Вызывай ПЕРЕД тем, как назвать пациенту час, " +
        "и никогда не придумывай время сам. Если вернулось ok:false — скажи, " +
        "что уточнишь у администратора, и возьми контакт.",
      api_schema: {
        url: baseUrl + "/api/tools/slots" + q,
        method: "GET",
        query_params_schema: {
          properties: {
            date: {
              type: "string",
              description: "День, который просит пациент: 'сегодня', 'завтра' или дата.",
            },
          },
          required: [],
        },
      },
    },
    {
      type: "webhook",
      name: "book_slot",
      description:
        "Записать пациента на выбранное время. Вызывай только после того, как " +
        "пациент подтвердил час. Если вернулось ok:false — скажи, что передашь " +
        "заявку администратору.",
      api_schema: {
        url: baseUrl + "/api/tools/book" + q,
        method: "POST",
        request_body_schema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Имя пациента" },
            phone: { type: "string", description: "Телефон в формате +7XXXXXXXXXX" },
            service: { type: "string", description: "Какая услуга нужна" },
            time: { type: "string", description: "Согласованные день и час" },
          },
          required: ["name", "time"],
        },
      },
    },
  ];
}

// Инструменты живут отдельно от агента и переиспользуются по id. У каждой
// клиники они свои — в адрес зашит её ключ.
async function ensureTools(baseUrl, toolKey, existingIds) {
  const ids = [];
  for (const def of toolDefs(baseUrl, toolKey)) {
    const made = await eleven("/v1/convai/tools", {
      method: "POST",
      body: JSON.stringify({ tool_config: def }),
    });
    ids.push(made.id);
  }
  // Старые удаляем после создания новых: если создание упадёт, агент
  // останется с рабочими инструментами, а не без единого.
  for (const old of existingIds || []) {
    try { await eleven("/v1/convai/tools/" + old, { method: "DELETE" }); } catch {}
  }
  return ids;
}

async function deleteTools(ids) {
  for (const id of ids || []) {
    try { await eleven("/v1/convai/tools/" + id, { method: "DELETE" }); } catch {}
  }
}

// --- создание и обновление агента ----------------------------------------

async function baseConfig() {
  return eleven("/v1/convai/agents/" + BASE_AGENT);
}

function applyProfile(conversationConfig, profile, toolIds) {
  const cc = JSON.parse(JSON.stringify(conversationConfig));
  cc.agent = cc.agent || {};
  cc.agent.first_message = buildFirstMessage(profile);
  cc.agent.prompt = cc.agent.prompt || {};
  cc.agent.prompt.prompt = buildPrompt(profile, !!(toolIds && toolIds.length));
  // Пустой список тоже осмыслен: клиника убрала адреса — инструменты уходят.
  cc.agent.prompt.tool_ids = toolIds || [];
  return cc;
}

// Что переносим из настроек площадки. Список короткий, но каждый пункт тут по
// делу, и один из них уже был забыт:
//   workspace_overrides — здесь лежит post_call_webhook_id. Вебхук привязан к
//     АГЕНТУ, а не к аккаунту. Без него звонок проходит хорошо, но до нас не
//     доезжает: ни в базе, ни в кабинете, ни в телеграме его не будет, и
//     заметить это можно только хватившись пропавшего разговора.
//   data_collection — поля, которые мы разбираем из разговора.
//   summary_language — иначе сводка приходит по-английски.
function platformSettings(ps) {
  const out = {
    data_collection: ps.data_collection || {},
    summary_language: ps.summary_language || "ru",
  };
  if (ps.workspace_overrides) out.workspace_overrides = ps.workspace_overrides;
  return out;
}

// Проверка после сборки: агент без вебхука выглядит рабочим и молча теряет
// звонки, поэтому спрашиваем платформу, а не полагаемся на то, что послали.
async function checkAgent(agentId) {
  const a = await eleven("/v1/convai/agents/" + agentId);
  const ps = a.platform_settings || {};
  const hook = ((ps.workspace_overrides || {}).webhooks || {}).post_call_webhook_id || null;
  return {
    agent_id: agentId,
    webhook: hook,
    fields: Object.keys(ps.data_collection || {}),
    summary_language: ps.summary_language || null,
  };
}

async function createAgent(profile, opts) {
  opts = opts || {};
  const base = await baseConfig();
  const toolIds = await wantedTools(profile, opts, []);
  const ps = base.platform_settings || {};
  const made = await eleven("/v1/convai/agents/create", {
    method: "POST",
    body: JSON.stringify({
      name: "Ответ — " + (clean(profile).name || "клиника"),
      conversation_config: applyProfile(base.conversation_config, profile, toolIds),
      platform_settings: platformSettings(ps),
    }),
  });
  return made.agent_id;
}

// Какие инструменты положены этой клинике: оба адреса пусты — ни одного.
async function wantedTools(profile, opts, existingIds) {
  const p = cleanAll(profile);
  const need = p.book_read_url || p.book_write_url;
  if (!need || !opts.toolKey || !opts.baseUrl) {
    await deleteTools(existingIds);
    return [];
  }
  return ensureTools(opts.baseUrl, opts.toolKey, existingIds);
}

async function updateAgent(agentId, profile, opts) {
  opts = opts || {};
  const base = await baseConfig();
  const cur = await eleven("/v1/convai/agents/" + agentId);
  const had = (((cur.conversation_config || {}).agent || {}).prompt || {}).tool_ids || [];
  const toolIds = await wantedTools(profile, opts, had);
  await eleven("/v1/convai/agents/" + agentId, {
    method: "PATCH",
    body: JSON.stringify({
      name: "Ответ — " + (clean(profile).name || "клиника"),
      conversation_config: applyProfile(base.conversation_config, profile, toolIds),
      // И при обновлении тоже: агент мог быть создан до того, как мы научились
      // переносить вебхук.
      platform_settings: platformSettings(base.platform_settings || {}),
    }),
  });
  return agentId;
}

async function deleteAgent(agentId) {
  return eleven("/v1/convai/agents/" + agentId, { method: "DELETE" });
}

module.exports = {
  FIELDS, SOURCES, INTEGRATION, ALL_FIELDS, clean, cleanAll, buildPrompt, buildFirstMessage,
  createAgent, updateAgent, deleteAgent, checkAgent, BASE_AGENT,
  toolDefs, ensureTools, deleteTools, wantedTools,
};
