// Телеграм-бот для покупателя: он присылает ссылку на объявление агента, мы
// отвечаем найденными оригиналами от хозяев — по одному сообщению на совпадение,
// с фотографией, параметрами и кнопкой «Показать контакты».
//
// Текст в сообщении Телеграма ограничен: подпись к фотографии — 1024 знака.
// Поэтому в подписи только то, по чему решают звонить, а описание целиком
// живёт на нашей странице квартиры.

const crypto = require("crypto");

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const money = (n) => n
  ? String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₸"
  : "цена не указана";

// Секрет для вебхука выводим из самого токена бота: обе стороны его знают, и
// заводить ещё одну переменную окружения не приходится.
function webhookSecret(token) {
  return crypto.createHash("sha256").update("tg-webhook:" + String(token)).digest("hex").slice(0, 32);
}

function api(token, method, body) {
  return fetch("https://api.telegram.org/bot" + token + "/" + method, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  }).then((r) => r.json()).catch((e) => ({ ok: false, description: e.message }));
}

// Ссылка на объявление в присланном тексте. Люди шлют и с utm-хвостом, и с
// мобильного m.krisha.kz, и просто номером.
function idFromText(text) {
  const t = String(text || "");
  const m = t.match(/krisha\.kz\/a\/show\/(\d+)/i) || t.match(/\/a\/show\/(\d+)/) || t.match(/\b(10\d{8})\b/);
  return m ? m[1] : null;
}

function askedLine(q) {
  const bits = [
    q.rooms ? q.rooms + "-комн" : null,
    q.area ? q.area + " м²" : null,
    q.floor && q.floors ? q.floor + "/" + q.floors + " этаж" : null,
    q.year ? q.year + " г." : null,
    q.district && q.district !== "без района" ? q.district : null,
  ].filter(Boolean);
  return bits.join(" · ");
}

// Подпись к совпадению. Сначала то, ради чего пришли — цена и параметры, —
// потом чем подтверждается совпадение.
function caption(f, site) {
  const lines = [];
  lines.push("<b>" + money(f.price) + "</b>");
  lines.push([
    f.rooms ? f.rooms + "-комн" : null,
    f.area ? f.area + " м²" : null,
    f.floor && f.floors ? f.floor + "/" + f.floors + " этаж" : null,
    f.kitchen ? "кухня " + f.kitchen + " м²" : null,
  ].filter(Boolean).join(" · "));
  const place = [f.street, f.mkr ? "мкр " + f.mkr : null, f.district].filter(Boolean);
  if (place.length) lines.push(esc(place.join(" · ")));
  const about = [
    f.year ? f.year + " г. постройки" : null,
    f.house, f.cond,
    f.furnished ? "мебель: " + f.furnished : null,
    f.toilet ? "санузел " + f.toilet : null,
  ].filter(Boolean);
  if (about.length) lines.push(esc(about.join(" · ")));
  if (f.posted) lines.push("Опубликовано " + String(f.posted).slice(0, 10));
  if (f.photos > 1) lines.push(f.photos + " фото на странице квартиры");
  lines.push("");
  lines.push('<a href="' + site + "/kv/" + f.id + '">Вся информация о квартире</a>');
  const cap = lines.join("\n");
  return cap.length > 1000 ? cap.slice(0, 997) + "…" : cap;
}

const contactsButton = (id) => ({
  inline_keyboard: [[{ text: "📞 Показать контакты", callback_data: "c:" + id }]],
});

module.exports = { api, idFromText, caption, askedLine, webhookSecret, contactsButton, money, esc };
