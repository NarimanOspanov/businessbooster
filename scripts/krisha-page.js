// Страница квартиры для Телеграма, свёрстанная как страница объявления на
// Крыше: человек приходит по ссылке из поста и видит привычную карточку, а не
// чужую вёрстку.
//
// Размеры взяты из их собственного main-common.css, а не подобраны на глаз:
// Open Sans, заголовок 24/36, цена 22/32, подзаголовки разделов 18/28,
// характеристики 13px подписью и 14/24 значением, колонка значений 184px.
//
// Тема одна и тёмная. У Крыши тёмной темы нет, но её страницу открывают в
// браузере, а нашу — внутри Телеграма, где у большинства всё чёрное, и белый
// лист там бьёт по глазам. Светлого варианта нет совсем: раз тема одна, всё
// красится явно, и от настроек читателя ничего не зависит.
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
  :root{--ink:#f2f3f5;--dim:#8b8f98;--line:rgba(255,255,255,.11);--blue:#2a81dd;
    --blue-hi:#3b98ea;--link:#6fb2f0;--green:#64bd38;--bg:#16171a;--card:#1e2024}
  html{color-scheme:dark}
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:var(--bg);color:var(--ink);font-family:"Open Sans",Helvetica,Arial,sans-serif;
    font-size:14px;line-height:1.43;-webkit-font-smoothing:antialiased;padding-bottom:32px}
  .wrap{max-width:640px;margin:0 auto;padding:0 16px}

  /* Галерея как на Крыше: большой кадр и сетка миниатюр под ним. Ленту с
     горизонтальной прокруткой пришлось убрать — мышью её листать нечем, на
     десктопе оставались только стрелки.
     Живёт в той же колонке, что и текст: иначе на широком экране фотография
     растягивалась во весь монитор над узким столбцом описания. Высоту кадра
     тоже ограничиваем — хозяева снимают вертикально, и без потолка первый
     снимок занимал целый экран. */
  .gal-wrap{max-width:640px;margin:0 auto}
  .gal-main{display:block;background:#000}
  .gal-main img{display:block;width:100%;height:auto;aspect-ratio:var(--ratio,4/3);
    max-height:min(70vh,520px);object-fit:contain}
  .thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));
    gap:4px;margin-top:4px}
  .th{padding:0;border:2px solid transparent;border-radius:4px;background:#000;
    overflow:hidden;cursor:pointer;line-height:0}
  .th img{width:100%;height:100%;aspect-ratio:4/3;object-fit:cover;opacity:.65;transition:opacity .15s}
  .th.is-active{border-color:#ffa000}
  .th.is-active img,.th:hover img{opacity:1}

  /* Просмотрщик: снимок открывается поверх страницы, как на Крыше, а не
     уводит на файл в новой вкладке. */
  .lb{position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.92);
    display:flex;align-items:center;justify-content:center;padding:16px}
  .lb[hidden]{display:none}
  .lb img{max-width:100%;max-height:100%;object-fit:contain;display:block}
  .lb-x{position:absolute;top:10px;right:10px;width:40px;height:40px;padding:0;border:0;
    border-radius:50%;background:rgba(255,255,255,.14);color:#fff;font:300 26px/40px
    "Open Sans",Helvetica,Arial,sans-serif;cursor:pointer}
  .lb-n{position:absolute;left:0;right:0;bottom:14px;text-align:center;
    color:rgba(255,255,255,.75);font-size:13px}
  body.lb-open{overflow:hidden}
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
  .note a{color:var(--link);text-decoration:none}

  .src{margin-top:28px;padding-top:16px;border-top:1px solid var(--line);
    color:var(--dim);font-size:13px}
  .src a{color:var(--link);text-decoration:none}
`;

function render(card, opts) {
  const o = opts || {};
  const photos = card.photos || [];
  const phones = (card.phones || []).filter(Boolean);
  const krisha = "https://krisha.kz/a/show/" + card.id;
  const portrait = photos.filter((p) => p.portrait).length > photos.length / 2;

  const first = photos[0];
  const gallery = photos.length
    ? '<div class="gal-wrap">' +
      '<a class="gal-main" id="g-link" href="' + esc(first.full || first.big) + '" target="_blank" rel="noopener">' +
      '<img id="g-main" src="' + esc(first.big) + '" alt="Фото 1"' +
      (first.full ? ' onerror="this.onerror=null;this.src=\'' + esc(first.full) + "'\"" : "") +
      "></a>" +
      (photos.length > 1
        ? '<div class="thumbs">' + photos.map((p, i) =>
            '<button type="button" class="th' + (i ? "" : " is-active") + '"' +
            ' data-big="' + esc(p.big) + '" data-full="' + esc(p.full || p.big) + '"' +
            ' aria-label="Фото ' + (i + 1) + '">' +
            '<img src="' + esc(p.small) + '" alt=""' + (i < 6 ? "" : ' loading="lazy"') + "></button>"
          ).join("") + "</div>"
        : "") +
      "</div>" +
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
    ? phones.map((p, i) => '<a class="btn" href="tel:' + esc(String(p).replace(/[^\d+]/g, "")) + '"' +
        (i ? ' style="margin-top:8px"' : "") + ">" + esc(p) + "</a>").join("")
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

  <h2>${phones.length ? "Контакты хозяина" : "Контакты"}</h2>
  ${contacts}

  ${short.length ? "<h2>О квартире</h2>" + rows(short) : ""}
  ${card.description ? '<h2>Описание</h2><div class="desc">' + esc(card.description) + "</div>" : ""}
  ${params.length ? "<h2>Дополнительно</h2>" + rows(params) : ""}

  <div class="src">Объявление с <a href="${krisha}" target="_blank" rel="noopener">krisha.kz</a>${
    card.takenAt ? ", данные на " + esc(card.takenAt.slice(0, 10)) : ""}</div>
</div>
${photos.length ? '<div class="lb" id="lb" hidden><button class="lb-x" id="lb-x" type="button" aria-label="Закрыть">×</button><img id="lb-img" src="" alt=""><div class="lb-n" id="lb-n"></div></div>' : ""}
<script>
  try { if (window.Telegram && Telegram.WebApp) { Telegram.WebApp.ready(); Telegram.WebApp.expand(); } } catch (e) {}

  // Миниатюра переключает главный кадр; стрелки — для клавиатуры, свайп — для
  // телефона. Свайп гасит переход по ссылке, иначе смахивание открывало бы
  // оригинал вместо листания.
  (function () {
    var main = document.getElementById("g-main"), link = document.getElementById("g-link");
    if (!main) return;
    var th = Array.prototype.slice.call(document.querySelectorAll(".th"));
    var at = 0, swiped = false;
    function show(n) {
      if (!th.length) return;
      at = (n + th.length) % th.length;
      var b = th[at];
      main.src = b.getAttribute("data-big");
      link.href = b.getAttribute("data-full");
      th.forEach(function (x) { x.classList.remove("is-active"); });
      b.classList.add("is-active");
    }
    th.forEach(function (b, n) { b.addEventListener("click", function () { show(n); }); });

    // Просмотрщик. Ссылка на оригинал остаётся настоящей ссылкой: если скрипт
    // не отработал, снимок всё равно откроется — просто файлом.
    var lb = document.getElementById("lb"), lbImg = document.getElementById("lb-img"),
        lbN = document.getElementById("lb-n");
    function paint() {
      if (!lb || lb.hidden) return;
      lbImg.src = th.length ? th[at].getAttribute("data-full") : link.href;
      lbN.textContent = (at + 1) + " из " + (th.length || 1);
    }
    function open(e) {
      if (!lb) return;
      if (e) e.preventDefault();
      if (swiped) { swiped = false; return; }
      lb.hidden = false;
      document.body.classList.add("lb-open");
      paint();
    }
    function close() {
      if (!lb) return;
      lb.hidden = true;
      lbImg.src = "";
      document.body.classList.remove("lb-open");
    }
    link.addEventListener("click", open);
    if (lb) {
      document.getElementById("lb-x").addEventListener("click", close);
      // Клик мимо снимка закрывает; по самому снимку — нет, иначе не разглядеть.
      lb.addEventListener("click", function (e) { if (e.target === lb) close(); });
    }

    document.addEventListener("keydown", function (e) {
      if (lb && !lb.hidden && e.key === "Escape") return close();
      if (e.key === "ArrowRight") { show(at + 1); paint(); }
      else if (e.key === "ArrowLeft") { show(at - 1); paint(); }
    });

    // Свайп листает и на странице, и внутри просмотрщика.
    function swipe(el) {
      var x0 = null;
      el.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
      el.addEventListener("touchend", function (e) {
        if (x0 === null) return;
        var dx = e.changedTouches[0].clientX - x0;
        x0 = null;
        if (Math.abs(dx) > 40) { swiped = true; show(dx < 0 ? at + 1 : at - 1); paint(); }
      }, { passive: true });
    }
    swipe(main);
    if (lb) swipe(lb);
  })();
</script>
</body>
</html>`;
}

function notFound(id) {
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Объявление не найдено</title>
<link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600&display=swap" rel="stylesheet">
<style>html{color-scheme:dark}body{font-family:"Open Sans",Helvetica,Arial,sans-serif;font-size:14px;
color:#f2f3f5;background:#16171a;padding:48px 20px;text-align:center}
a{color:#6fb2f0;text-decoration:none}</style></head><body>
<p>Мы не сохраняли это объявление.</p>
<p style="margin-top:12px"><a href="https://krisha.kz/a/show/${esc(id)}">Открыть на Крыше</a></p>
</body></html>`;
}

module.exports = { render, notFound };
