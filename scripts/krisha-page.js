// Страница квартиры для Телеграма: её открывают из поста, поэтому она должна
// выглядеть как карточка объявления, а не как переход на чужой сайт.
//
// Телеграм открывает ссылки во встроенном браузере, и там же живут мини-аппы,
// поэтому вёрстка одноколоночная, под телефон, и подхватывает цвета темы
// пользователя через telegram-web-app.js — если скрипт не подгрузился, страница
// просто остаётся светлой.

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const money = (n) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₸";

// Тот же номер, что на сайте и в вакансии — публичный рабочий, не чей-то чужой.
const FALLBACK_PHONE = process.env.CONTACT_PHONE || "+7 702 941 06 25";

function render(card, opts) {
  const o = opts || {};
  const photos = card.photos || [];
  const phones = (card.phones || []).filter(Boolean);
  const krisha = "https://krisha.kz/a/show/" + card.id;

  // Показываем 560x350, по нажатию открываем оригинал. Если среднего размера у
  // снимка не оказалось, подставляем оригинал прямо в тег — молча битых картинок
  // на странице быть не должно.
  const gallery = photos.length
    ? '<div class="ph">' + photos.map((p, i) =>
        '<a class="ph-i" href="' + esc(p.full || p.big) + '" target="_blank" rel="noopener">' +
        '<img src="' + esc(p.big) + '" alt="Фото ' + (i + 1) + '"' +
        (i < 2 ? "" : ' loading="lazy"') +
        (p.full ? ' onerror="this.onerror=null;this.src=\'' + esc(p.full) + "'\"" : "") +
        "></a>").join("") + "</div>" +
      '<div class="ph-n">' + photos.length + " фото · листайте вбок</div>"
    : "";

  const facts = (card.short || []).map((t) => {
    const i = t.indexOf(":");
    const k = i > 0 ? t.slice(0, i) : "";
    const v = i > 0 ? t.slice(i + 1) : t;
    return '<div class="f"><span>' + esc(k) + "</span><b>" + esc(v.trim()) + "</b></div>";
  }).join("");

  const params = (card.params || []).map((p) =>
    '<div class="f"><span>' + esc(p.label) + "</span><b>" + esc(p.value) + "</b></div>").join("");

  // Номера хозяина у нас нет: Крыша отдаёт его только после капчи. Пока вместо
  // него стоит наш собственный номер — и подписан как наш. Выдуманный ставить
  // нельзя: любой правдоподобный казахстанский номер принадлежит живому
  // человеку, и звонить по квартире стали бы ему.
  const ours = o.phone || FALLBACK_PHONE;
  const contacts = phones.length
    ? '<div class="tel">' + phones.map((p) =>
        '<a href="tel:' + esc(String(p).replace(/[^\d+]/g, "")) + '">' + esc(p) + "</a>").join("") + "</div>"
    : '<div class="tel"><a href="tel:' + esc(ours.replace(/[^\d+]/g, "")) + '">' + esc(ours) + "</a>" +
      '<div class="stub">Это наш номер. Телефон хозяина — ' +
      '<a href="' + krisha + '" target="_blank" rel="noopener">на странице объявления</a>' +
      (card.phonePreview ? ", начинается на " + esc(card.phonePreview.trim()) : "") + ".</div></div>";

  const discount = card.kzDiscount != null && card.kzDiscount > 0
    ? '<div class="tag">↓ на ' + Math.round(card.kzDiscount) + "% ниже рынка</div>"
    : "";

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(card.title || "Квартира")}</title>
<meta name="robots" content="noindex">
<meta property="og:title" content="${esc(card.title || "Квартира")}">
<meta property="og:description" content="${esc((card.description || "").slice(0, 160))}">
${photos.length ? '<meta property="og:image" content="' + esc(photos[0].big) + '">' : ""}
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
  /* Хозяева снимают квартиры телефоном вертикально: у широкой рамки от такого
     снимка остаётся полоска посередине, поэтому форму задаёт большинство. */
  :root{--bg:#fff;--card:#f6f6f7;--ink:#0f172a;--dim:#6b7280;--line:#e6e7ea;--accent:#0f9aa8;
    --ratio:${photos.filter((p) => p.portrait).length > photos.length / 2 ? "3/4" : "16/10"}}
  @media (prefers-color-scheme:dark){:root{--bg:#17181c;--card:#212228;--ink:#f2f3f5;--dim:#9aa0a6;--line:#2e3038;--accent:#4dd0c4}}
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:var(--bg);color:var(--ink);font:16px/1.5 -apple-system,"Segoe UI",Roboto,system-ui,sans-serif;
    -webkit-font-smoothing:antialiased;padding-bottom:28px}
  .wrap{max-width:560px;margin:0 auto;padding:0 16px}
  .ph{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;padding:12px 16px;
    -webkit-overflow-scrolling:touch;scrollbar-width:none}
  .ph::-webkit-scrollbar{display:none}
  .ph-i{flex:0 0 88%;scroll-snap-align:center;border-radius:14px;overflow:hidden;background:var(--card)}
  .ph-i img{display:block;width:100%;height:auto;aspect-ratio:var(--ratio,16/10);object-fit:cover}
  .ph-n{color:var(--dim);font-size:13px;padding:0 16px 14px}
  h1{font-size:19px;font-weight:600;line-height:1.3;margin:2px 0 10px}
  .price{font-size:26px;font-weight:700;letter-spacing:-.02em}
  .tag{display:inline-block;margin-top:8px;background:var(--accent);color:#fff;font-size:13px;
    font-weight:600;border-radius:999px;padding:4px 12px}
  h2{font-size:15px;font-weight:600;margin:24px 0 10px}
  .f{display:flex;justify-content:space-between;gap:16px;padding:9px 0;border-top:1px solid var(--line);font-size:15px}
  .f:first-child{border-top:none}
  .f span{color:var(--dim);flex:0 0 auto}
  .f b{font-weight:500;text-align:right}
  .desc{white-space:pre-wrap;background:var(--card);border-radius:14px;padding:14px 16px;font-size:15px}
  .tel{display:flex;flex-direction:column;gap:8px;margin-top:10px}
  /* Только прямая ссылка-номер выглядит кнопкой: ссылка внутри подписи под ней
     тоже подхватывала эти стили, и кнопок становилось две. */
  .tel > a{display:block;background:var(--accent);color:#fff;text-align:center;text-decoration:none;
    font-size:17px;font-weight:600;border-radius:12px;padding:14px}
  .tel-off{flex-direction:row;align-items:center;gap:12px;background:var(--card);border-radius:12px;padding:12px 14px}
  .tel-off span{font-size:17px;font-weight:600;color:var(--dim)}
  .tel-off .btn{flex:1;font-size:15px;padding:10px}
  .stub{font-size:13px;color:var(--dim);text-align:center;line-height:1.45}
  .stub a{color:var(--dim);text-decoration:underline}
  .src{margin-top:22px;font-size:13px;color:var(--dim);text-align:center}
  .src a{color:var(--dim)}
</style>
</head>
<body>
${gallery}
<div class="wrap">
  <div class="price">${money(card.price)}</div>
  ${discount}
  <h1>${esc(card.title)}</h1>
  ${card.addr ? '<div style="color:var(--dim);font-size:15px">' + esc(card.addr) + "</div>" : ""}

  <h2>${phones.length ? "Контакты хозяина" : "Контакты"}</h2>
  ${contacts}

  ${card.description ? "<h2>Описание</h2><div class=\"desc\">" + esc(card.description) + "</div>" : ""}
  ${facts ? "<h2>О квартире</h2>" + facts : ""}
  ${params ? "<h2>Ещё</h2>" + params : ""}

  <div class="src">Объявление с <a href="${krisha}" target="_blank" rel="noopener">krisha.kz</a>${
    card.takenAt ? " · данные на " + esc(card.takenAt.slice(0, 10)) : ""}</div>
</div>
<script>
  try { if (window.Telegram && Telegram.WebApp) { Telegram.WebApp.ready(); Telegram.WebApp.expand(); } } catch (e) {}
</script>
</body>
</html>`;
}

function notFound(id) {
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Объявление не найдено</title>
<style>body{font:16px/1.5 -apple-system,"Segoe UI",Roboto,system-ui,sans-serif;padding:40px 20px;text-align:center;color:#0f172a}
a{color:#0f9aa8}</style></head><body>
<p>Мы не сохраняли это объявление.</p>
<p><a href="https://krisha.kz/a/show/${esc(id)}">Открыть на Крыше</a></p>
</body></html>`;
}

module.exports = { render, notFound };
