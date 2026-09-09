// Страница квартиры для Телеграма, свёрстанная как страница объявления на
// Крыше: человек приходит по ссылке из поста и видит привычную карточку, а не
// чужую вёрстку.
//
// Размеры и цвета взяты из их собственного main-common.css, а не подобраны на
// глаз: текст #1c1819, синий #2a81dd, рамки rgba(28,24,25,.1), Open Sans,
// заголовок 24/36, цена 22/32, подзаголовки разделов 18/28, характеристики
// 13px серым и 14px чёрным. Тёмной темы у Крыши нет — нет и у нас.
//
// Чего мы не повторяем: их шапку, логотип и название. Страница показывает
// чужое объявление и говорит об этом внизу; выдавать её за krisha.kz нельзя.

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const money = (n) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₸";

// Тот же номер, что на сайте и в вакансии — публичный рабочий, не чей-то чужой.
const FALLBACK_PHONE = process.env.CONTACT_PHONE || "+7 702 941 06 25";

const CSS = `
  :root{--ink:#1c1819;--dim:#888b94;--line:rgba(28,24,25,.1);--blue:#2a81dd;
    --blue-hi:#34a2e9;--green:#64bd38;--bg:#fff}
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:var(--bg);color:var(--ink);font-family:"Open Sans",Helvetica,Arial,sans-serif;
    font-size:14px;line-height:1.43;-webkit-font-smoothing:antialiased;padding-bottom:32px}
  .wrap{max-width:640px;margin:0 auto;padding:0 16px}

  .gal{display:flex;gap:4px;overflow-x:auto;scroll-snap-type:x mandatory;
    -webkit-overflow-scrolling:touch;scrollbar-width:none;background:#000}
  .gal::-webkit-scrollbar{display:none}
  .gal a{flex:0 0 100%;scroll-snap-align:center;display:block}
  .gal img{display:block;width:100%;height:auto;aspect-ratio:var(--ratio,4/3);object-fit:cover}
  .gal-n{padding:8px 16px 0;color:var(--dim);font-size:13px}

  .price{margin-top:12px;color:var(--ink);font-weight:600;font-size:22px;line-height:32px}
  .off{display:inline-block;margin-left:8px;padding:2px 8px;border-radius:4px;
    background:var(--green);color:#fff;font-size:13px;font-weight:600;line-height:20px;
    vertical-align:3px}
  h1{padding-bottom:20px;border-bottom:1px solid var(--line);
    font-weight:600;font-size:24px;line-height:36px}
  .loc{margin-top:8px;color:var(--dim);font-size:14px}

  h2{margin:24px 0 8px;color:var(--ink);font-weight:600;font-size:18px;line-height:28px}

  .row{display:flex;padding-top:17px}
  .row .k{flex-shrink:0;max-width:calc(100% - 194px);color:var(--dim);font-size:13px;line-height:24px}
  .row .v{flex:1;margin-left:10px;text-align:right;color:var(--ink);font-size:14px;line-height:24px}

  .desc{margin-top:4px;font-size:14px;line-height:24px;white-space:pre-line}

  .btn{display:block;padding:0 15px;border:0;border-radius:8px;background:var(--blue);
    color:#fff;font:600 16px/48px "Open Sans",Helvetica,Arial,sans-serif;height:48px;
    text-align:center;text-decoration:none;box-shadow:0 2px 4px rgba(28,24,25,.1)}
  .btn:active{background:var(--blue-hi)}
  .note{margin-top:8px;color:var(--dim);font-size:13px;line-height:20px}
  .note a{color:var(--blue);text-decoration:none}

  .src{margin-top:28px;padding-top:16px;border-top:1px solid var(--line);
    color:var(--dim);font-size:13px}
  .src a{color:var(--blue);text-decoration:none}
`;

function render(card, opts) {
  const o = opts || {};
  const photos = card.photos || [];
  const phones = (card.phones || []).filter(Boolean);
  const krisha = "https://krisha.kz/a/show/" + card.id;
  const portrait = photos.filter((p) => p.portrait).length > photos.length / 2;

  const gallery = photos.length
    ? '<div class="gal">' + photos.map((p, i) =>
        '<a href="' + esc(p.full || p.big) + '" target="_blank" rel="noopener">' +
        '<img src="' + esc(p.big) + '" alt="Фото ' + (i + 1) + '"' +
        (i < 2 ? "" : ' loading="lazy"') +
        (p.full ? ' onerror="this.onerror=null;this.src=\'' + esc(p.full) + "'\"" : "") +
        "></a>").join("") + "</div>" +
      '<div class="wrap"><div class="gal-n">' + photos.length + " фото</div></div>"
    : "";

  const rows = (list) => list.map((r) =>
    '<div class="row"><div class="k">' + esc(r[0]) + '</div><div class="v">' + esc(r[1]) + "</div></div>"
  ).join("");

  const short = (card.short || []).map((t) => {
    const i = t.indexOf(":");
    return i > 0 ? [t.slice(0, i), t.slice(i + 1).trim()] : ["", t];
  });
  const params = (card.params || []).map((p) => [p.label, p.value]);

  // Номера хозяина у нас нет: Крыша отдаёт его только после капчи. Пока вместо
  // него стоит наш собственный номер — и подписан как наш. Выдуманный ставить
  // нельзя: любой правдоподобный казахстанский номер принадлежит живому
  // человеку, и звонить по квартире стали бы ему.
  const ours = o.phone || FALLBACK_PHONE;
  const contacts = phones.length
    ? phones.map((p) => '<a class="btn" href="tel:' + esc(String(p).replace(/[^\d+]/g, "")) +
        '" style="margin-top:8px">' + esc(p) + "</a>").join("")
    : '<a class="btn" href="tel:' + esc(ours.replace(/[^\d+]/g, "")) + '">' + esc(ours) + "</a>" +
      '<div class="note">Это наш номер. Телефон хозяина — <a href="' + krisha +
      '" target="_blank" rel="noopener">на странице объявления</a>' +
      (card.phonePreview ? ", начинается на " + esc(card.phonePreview.trim()) : "") + ".</div>";

  const off = card.kzDiscount != null && card.kzDiscount > 0
    ? '<span class="off">−' + Math.round(card.kzDiscount) + "%</span>" : "";

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
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>${CSS}
  :root{--ratio:${portrait ? "3/4" : "4/3"}}
</style>
</head>
<body>
${gallery}
<div class="wrap">
  <div class="price">${money(card.price)}${off}</div>
  <h1>${esc(card.title)}</h1>
  ${card.addr ? '<div class="loc">' + esc(card.addr) + "</div>" : ""}

  <h2>Контакты</h2>
  ${contacts}

  ${short.length ? "<h2>О квартире</h2>" + rows(short) : ""}
  ${card.description ? '<h2>Описание</h2><div class="desc">' + esc(card.description) + "</div>" : ""}
  ${params.length ? "<h2>Дополнительно</h2>" + rows(params) : ""}

  <div class="src">Объявление с <a href="${krisha}" target="_blank" rel="noopener">krisha.kz</a>${
    card.takenAt ? ", данные на " + esc(card.takenAt.slice(0, 10)) : ""}</div>
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
<link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600&display=swap" rel="stylesheet">
<style>body{font-family:"Open Sans",Helvetica,Arial,sans-serif;font-size:14px;color:#1c1819;
padding:48px 20px;text-align:center}a{color:#2a81dd;text-decoration:none}</style></head><body>
<p>Мы не сохраняли это объявление.</p>
<p style="margin-top:12px"><a href="https://krisha.kz/a/show/${esc(id)}">Открыть на Крыше</a></p>
</body></html>`;
}

module.exports = { render, notFound };
