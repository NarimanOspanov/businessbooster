// Снимок объявления: то, что нужно показать человеку, открывшему ссылку из
// поста, — фотографии, описание хозяина, характеристики и контакты.
//
// Снимаем в момент публикации подборки, а не по клику читателя: объявление
// живёт неделю, снимается в любой момент, и открывать чужой сайт на каждый
// просмотр — значит и читателя оставить с битой ссылкой, и Крышу нагрузить
// нашим трафиком.

const K = require("./krisha-lib.js");

const clean = (s) =>
  String(s || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

// Список фотографий берём из JSON в разметке, а не из самих тегов: там лежит
// «-full.jpg» с размерами, тогда как в вёрстке половина ссылок на 750x470
// отдаёт 404 — это заготовки под srcset, которые их же скрипт не запрашивает.
// Живые размеры у всех снимков — 280x175, 560x350 и full.
function photos(html) {
  const out = [];
  const seen = new Set();
  for (const m of html.matchAll(/\{"src":"(https:\/\/krisha-photos\.kcdn\.online\/[^"]+?)-full\.jpg","w":(\d+),"h":(\d+)/g)) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    out.push({
      big: m[1] + "-560x350.jpg",
      full: m[1] + "-full.jpg",
      small: m[1] + "-280x175.jpg",
      portrait: Number(m[3]) > Number(m[2]),
    });
  }
  if (out.length) return out;

  // Запасной разбор, если JSON поменяется: 280x175 есть у всех.
  const bases = new Map();
  for (const m of html.matchAll(/https:\/\/krisha-photos\.kcdn\.online\/[a-z0-9/-]+?\/(\d+)-\d+x\d+\.jpg/g)) {
    const base = m[0].replace(/-\d+x\d+\.jpg$/, "");
    if (!bases.has(base)) bases.set(base, Number(m[1]));
  }
  return [...bases.entries()].sort((a, b) => a[1] - b[1]).map(([base]) => ({
    big: base + "-560x350.jpg", full: base + "-full.jpg", small: base + "-280x175.jpg", portrait: false,
  }));
}

function params(html) {
  const block = (html.match(/class="offer__parameters"[\s\S]*?<\/div>/) || [])[0] || "";
  const out = [];
  for (const m of block.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g)) {
    const label = clean(m[1]), value = clean(m[2]);
    if (label && value) out.push({ label, value });
  }
  return out;
}

// Текст хозяина. В одном шаблоне у блока класс js-description, в другом просто
// a-text — поэтому надёжнее всего идти от подписи «Описание».
function description(html) {
  const tries = [
    /class="js-description[^"]*"[^>]*>([\s\S]*?)<\/div>/,
    /offer__bio-title">\s*Описание\s*<\/div>\s*<div class="text">\s*<div[^>]*>([\s\S]*?)<\/div>/,
    /class="a-text a-text-white-spaces"[^>]*>([\s\S]*?)<\/div>/,
  ];
  for (const re of tries) {
    const t = clean((html.match(re) || [])[1]);
    if (t) return t;
  }
  return "";
}

// Крыша сама отдаёт объявление структурой: на странице лежит `window.data` с
// объектом advert, а в нём — координаты дома и её собственные слаги адреса
// («Mkr_Koktem-1», «Bostandykskiy_r-n»). Для опознания квартиры это лучше
// разбора русских строк: обе стороны получают одну и ту же строку, сверять
// нечего. Скобки считаем вручную — вложенный JSON регуляркой не берут.
//
// В том же `window.data` рядом лежат ключи мобильного приложения. Берём только
// advert: чужие ключи нам не нужны.
function windowData(html) {
  const at = html.indexOf("window.data");
  if (at < 0) return null;
  const start = html.indexOf("{", at);
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && !--depth) {
      try { return JSON.parse(html.slice(start, i + 1)).advert || null; } catch { return null; }
    }
  }
  return null;
}

// Из advert берём только то, чем опознают квартиру и продавца.
function fromWindowData(html) {
  const a = windowData(html);
  if (!a) return {};
  const map = a.map || {}, ad = a.address || {};
  const geo = (v) => (typeof v === "number" && v > -90 && v < 90 && v !== 0 ? v : null);
  return {
    lat: geo(map.lat),
    lon: typeof map.lon === "number" && map.lon !== 0 ? map.lon : null,
    citySlug: ad.city || null,
    districtSlug: ad.district || null,
    mkrSlug: ad.microdistrict || null,
    streetSlug: ad.street || null,
    addressTitle: a.addressTitle || null,
    // userType — вердикт самой Крыши, а не галочка продавца в фильтре.
    userType: a.userType || null,
    ownerName: a.ownerName || null,
    complexId: a.complexId == null ? null : Number(a.complexId) || null,
    square: typeof a.square === "number" ? a.square : null,
    rooms: typeof a.rooms === "number" ? a.rooms : null,
    status: a.status || null,
    // Объект целиком — чтобы не переоткрывать 29 тысяч страниц, когда
    // выяснится, что полезно ещё какое-то поле. Крыша его может расширить, и
    // разбирать заново будет нечего: он уже у нас.
    //
    // Кроме массива фотографий: их 31, они занимают 10 из 11 килобайт объекта,
    // и они уже разобраны рядом. На 29 тысяч объявлений это треть гигабайта
    // дубля в базе, за которую мы платим.
    advertRaw: Object.assign({}, a, { photos: undefined }),
  };
}

function parse(html, id) {
  const short = (html.match(/class="offer__short-description"[\s\S]*?(?=<div class="offer__description")/) || [])[0] || "";
  const shortItems = [];
  for (const m of short.matchAll(/<div class="offer__info-item"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g)) {
    // «Город: Алматы, Жетысуский р-н: показать на карте» — хвост от ссылки на
    // карту, которой на нашей странице всё равно нет.
    const t = clean(m[1]).replace(/\s*\n\s*/g, ": ")
      .replace(/:?\s*показать на карте\s*$/i, "").trim();
    if (t) shortItems.push(t);
  }
  return Object.assign(fromWindowData(html), {
    id: String(id),
    // У Крыши два шаблона страницы: в одном заголовок обёрнут в
    // offer__advert-title-text, в другом h1 лежит прямо в offer__advert-title.
    // Первый разбор знал только про первый, и у двух объявлений из трёх не
    // было ни заголовка, ни описания.
    title: clean((html.match(/class="offer__advert-title[^"]*"[\s\S]{0,300}?<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1]),
    price: K.num((html.match(/class="offer__price"[^>]*>([\s\S]*?)<\/div>/) || [])[1]),
    // Блок с адресом на странице есть не всегда, зато адрес всегда стоит в
    // <title>: «… - №1015591221: Хусаинова, Алматы, Бостандыкский р-н — за …».
    // Улица нужна для опознания квартиры, поэтому берём откуда достанем.
    addr: clean((html.match(/class="offer__location[^"]*"[\s\S]*?<div>([\s\S]*?)<\/div>/) || [])[1])
      || clean((html.match(/<title>[^<]*?№\d+:\s*([^<]+?)\s+—\s+за\s/i) || [])[1]),
    description: description(html),
    short: shortItems,
    params: params(html),
    photos: photos(html),
    // Полного номера в разметке нет — только начало и сколько их всего.
    phonePreview: (html.match(/"phonePreview":"([^"]*)"/) || [])[1] || null,
    phonesNb: Number((html.match(/"phonesNb":(\d+)/) || [])[1]) || 0,
    createdAt: (html.match(/"createdAt"\s*:\s*"(\d{4}-\d{2}-\d{2})"/) || [])[1] || null,
    takenAt: new Date().toISOString(),
  });
}

async function fetchCard(id) {
  return parse(await K.fetchText("https://krisha.kz/a/show/" + id, 3, 15000), id);
}

// Номер телефона отдаёт отдельная ручка и только авторизованным. Своего входа
// у нас нет: логин Крыши живёт на id.kolesa.kz за проверкой «подтвердите, что
// вы человек». Поэтому работаем чужой готовой сессией — её кладёт владелец
// аккаунта, и без неё эта функция просто ничего не возвращает.
async function fetchPhones(id, cookie) {
  if (!cookie) return null;
  const r = await fetch("https://krisha.kz/a/ajaxPhones?id=" + id, {
    headers: Object.assign({}, K.H, {
      Cookie: cookie,
      "X-Requested-With": "XMLHttpRequest",
      Referer: "https://krisha.kz/a/show/" + id,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const text = await r.text();
  let j = null;
  try { j = JSON.parse(text); } catch { return null; }
  if (j && j.error) return { error: String(j.error).slice(0, 120) };
  // Сессии мало: на живом аккаунте ручка отвечает 200, отдаёт пустой список и
  // конфиг reCAPTCHA — номер показывают только после решённой капчи. Капчи мы
  // не решаем, поэтому честно сообщаем, что номера не будет.
  if (j && j.gRecaptcha && !(j.phones || []).length) {
    return { error: "Крыша просит пройти капчу — номер отдаём ссылкой на объявление" };
  }
  const phones = [];
  const dig = (v) => {
    if (typeof v === "string" && /\+?\d[\d\s()-]{9,}/.test(v)) phones.push(v.trim());
    else if (Array.isArray(v)) v.forEach(dig);
    else if (v && typeof v === "object") Object.values(v).forEach(dig);
  };
  dig(j);
  return { phones: [...new Set(phones)] };
}

module.exports = { parse, photos, params, fetchCard, fetchPhones, clean };
