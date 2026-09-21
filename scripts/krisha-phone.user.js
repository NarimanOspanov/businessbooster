// ==UserScript==
// @name         Reception365 · телефоны с Крыши
// @namespace    https://saudager.ai/
// @version      3.2
// @description  Берёт из очереди следующий объект без номера, сама жмёт «показать телефон», сохраняет номер, меняет IP прокси и едет дальше сама; в фоновой вкладке ждёт, пока её откроют; капча, не решённая за минуту, перезагружает страницу; снятые и зависшие страницы отмечает промахом с причиной
// @match        https://krisha.kz/a/show/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://saudager.ai/krisha-phone.user.js
// @downloadURL  https://saudager.ai/krisha-phone.user.js
// ==/UserScript==

// Ходит в /api/krisha/objphone (таблица krisha_objects, весь поток
// недвижимости). Очередь отдаёт по одному объекту от даты since и вверх;
// курсор вести не нужно — объект с номером или с промахом сам выпадает.
//
// Капчу проходит человек — скрипт её не видит и не трогает. Он нажимает за
// человека только саму кнопку «Показать телефон», чтобы не тянуться к ней на
// каждой странице руками. Когда номер появился на экране, скрипт забирает его
// из разметки и отправляет к нам.
//
// Если номер не снялся, сообщаем промах с причиной — от неё зависит, что
// сервер сделает с объектом:
//   archived  — объявление открывается, но снято: из очереди насовсем;
//   not_found — страницы нет вовсе, Крыша отдаёт 404: тоже насовсем;
//   no_phone — страница живая, но кнопки/номера нет: пауза сутки;
//   timeout  — кнопку нажали, а номер так и не появился: пауза час;
//   captcha  — капча показалась и за две минуты не решена: пауза полчаса.
//
// Дальше едет сама всегда, была капча на странице или нет: как только номер
// сохранён (или промах отправлен), открывается следующий объект без паузы
// на ручной клик. Если капча всё же показывалась, пауза перед переходом
// длиннее (20 с вместо 3) — не отказ от автоперехода, а просто более
// осторожный темп, раз Крыша начала присматриваться.

(function () {
  "use strict";

  var API = "https://saudager.ai";
  var ID = (location.pathname.match(/\/a\/show\/(\d+)/) || [])[1];
  if (!ID) return;

  // Ключ спрашиваем один раз и держим в хранилище самого krisha.kz.
  var KEY = localStorage.getItem("r365key");
  function askKey() {
    var k = prompt("Ключ Reception365 (спрашивается один раз):", "");
    if (k && k.trim()) { KEY = k.trim(); localStorage.setItem("r365key", KEY); }
    return KEY;
  }

  // Нижняя граница очереди по дате публикации (YYYY-MM-DD). Пусто — сервер
  // берёт последнюю неделю. Меняется ссылкой «с даты» в углу.
  var SINCE = localStorage.getItem("r365since") || "";
  function askSince() {
    var s = prompt("С какой даты публикации брать объекты (YYYY-MM-DD, пусто — последняя неделя):", SINCE);
    if (s === null) return;
    s = s.trim();
    if (s && !/^\d{4}-\d{2}-\d{2}$/.test(s)) { alert("Нужна дата вида 2026-09-10"); return; }
    SINCE = s;
    if (s) localStorage.setItem("r365since", s); else localStorage.removeItem("r365since");
    say(status);
  }

  var box = document.createElement("div");
  box.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:99999;max-width:280px;" +
    "padding:12px 14px;border-radius:10px;background:#1c1819;color:#fff;" +
    'font:14px/1.4 "Open Sans",Arial,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35)';
  document.body.appendChild(box);
  // Секундомер: сколько секунд страница открыта (от начала загрузки, не от
  // запуска скрипта). Наглядно видно, когда ждать перезагрузку или промах.
  function openedSec() { return Math.floor(performance.now() / 1000); }
  var status = "";
  function say(html) {
    status = html;
    box.innerHTML = html +
      '<div style="margin-top:8px;font-size:12px;color:#aaa">очередь ' +
      (SINCE ? "с " + SINCE : "за неделю") +
      ' · <a href="#" id="r365-since" style="color:#6fb2f0">с даты</a>' +
      ' · <span id="r365-clock" style="font-variant-numeric:tabular-nums">' + openedSec() + ' с</span></div>';
    var a = document.getElementById("r365-since");
    if (a) a.onclick = function (e) { e.preventDefault(); askSince(); };
  }
  setInterval(function () {
    var c = document.getElementById("r365-clock");
    if (c) c.textContent = openedSec() + " с";
  }, 1000);
  function append(html) { say(status + "<br>" + html); }

  say("Открываю телефон…");

  function api(path, method, body) {
    return fetch(API + path + (path.indexOf("?") > -1 ? "&" : "?") + "key=" + encodeURIComponent(KEY), {
      method: method || "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); });
  }

  // Номера живут в блоке контактов и появляются только после капчи.
  // offer__contacts-phones — актуальный класс блока на текущей вёрстке Крыши;
  // .a-phones/#a-phones — старые селекторы, оставлены запасным вариантом.
  function found() {
    var el = document.querySelector(".offer__contacts-phones") ||
      document.querySelector(".a-phones") || document.querySelector("#a-phones");
    if (!el) return [];
    var out = [];
    (el.innerText || "").replace(/(?:\+?7|8)[\s\-()]*\d{3}[\s\-()]*\d{3}[\s\-()]*\d{2}[\s\-()]*\d{2}/g,
      function (m) { if (out.indexOf(m) === -1) out.push(m.trim()); });
    return out;
  }

  // Капча — виджет reCAPTCHA, инлайном или в iframe. Селекторы — только
  // точные токены класса/атрибута, не подстрока: в подвале каждой страницы
  // есть <p class="g-recaptcha-policy">, и широкий [class*="captcha"] цеплял
  // бы её всегда.
  //
  // Крыша держит iframe капчи в DOM постоянно (внутри .a-phones__recaptcha)
  // и просто переключает ему display: none/blank — не добавляет и не убирает
  // узел. Поэтому querySelector один не годится: он находит iframe и тогда,
  // когда капча ни разу не показывалась, а номер отдался сразу. offsetParent
  // — дешёвая проверка, что элемент (или кто-то из родителей) не спрятан
  // через display: none.
  var captchaSeen = false;
  function visible(el) { return !!el && el.offsetParent !== null; }
  function captchaVisible() {
    return !!(
      visible(document.querySelector('iframe[src*="recaptcha" i]')) ||
      visible(document.querySelector('iframe[title*="recaptcha" i]')) ||
      visible(document.querySelector('iframe[src*="hcaptcha" i]')) ||
      visible(document.querySelector(".g-recaptcha")) ||
      visible(document.querySelector(".h-captcha"))
    );
  }

  // Архивное объявление Крыша отдаёт тем же макетом, что и живое, только
  // вместо кнопки «Показать телефон» — фраза «Объявление может быть
  // неактуальным.». Ловим её целиком по всему тексту страницы.
  function archivedVisible() {
    return (document.body.innerText || "").indexOf("Объявление может быть неактуальным") !== -1;
  }

  // Несуществующее объявление: Крыша отдаёт 404 с тем же адресом, скрипт на
  // ней тоже запускается. Страница — <div class="error-page error-404"> с
  // заголовком «Страница не найдена»; проверяем и класс, и текст.
  function notFoundVisible() {
    var t = document.querySelector(".error-content__title");
    return !!document.querySelector(".error-page.error-404") ||
      !!(t && (t.textContent || "").indexOf("не найдена") !== -1);
  }

  // Мёртвая страница — какая именно. null, если живая.
  function deadReason() {
    if (notFoundVisible()) return "not_found";
    if (archivedVisible()) return "archived";
    return null;
  }
  var DEAD_WHY = { not_found: "Страницы нет (404)", archived: "Объявление снято" };

  // --- промах -------------------------------------------------------------
  // Одна отправка на страницу: кто первый определил причину, тот и прав.
  var done = false;
  function miss(reason, why) {
    if (done) return;
    done = true;
    clearTimeout(giveUpTimer);
    clearTimeout(captchaTimer);
    if (mo) mo.disconnect();
    say(why + " — сообщаю (" + reason + ")…");
    if (!KEY && !askKey()) { say("Без ключа даже промах сообщить некуда."); return; }
    api("/api/krisha/objphone/miss", "POST", { id: ID, reason: reason })
      .then(function (r) {
        if (!r.ok || !r.j.ok) { append("Не записалось: " + ((r.j && r.j.error) || "ошибка")); return; }
        append(r.j.final ? "Объект выбыл из очереди." : "Вернётся в очередь позже (попытка " + r.j.tries + ").");
      })
      .catch(function () { append("Сеть не отвечает."); })
      .then(autoNext);
  }

  // За 15 секунд не нашлось ни номера, ни капчи, ни архивной пометки.
  // Кнопку нажимали — значит, страница живая, но номер не пришёл: timeout.
  // Кнопки не было вовсе — живая страница без телефона (только чат): no_phone.
  // Таймер заводится только когда вкладка на экране (см. start): в фоновой
  // вкладке браузер не рисует капчу и не отдаёт номер, и 15 секунд там
  // кончались промахом «timeout» на живом объявлении.
  var GIVE_UP_MS = 15000;
  var giveUpTimer = null;
  function armGiveUp() {
    clearTimeout(giveUpTimer);
    giveUpTimer = setTimeout(function () {
      if (done || captchaSeen) return; // капча — значит дело живое, решает человек
      var dead = deadReason();
      if (dead) miss(dead, DEAD_WHY[dead]);
      else if (clicked) miss("timeout", "Номер так и не появился");
      else miss("no_phone", "На странице нет кнопки с номером");
    }, GIVE_UP_MS);
  }

  // Капча показалась — ждём человека минуту. Не дождались — перезагружаем
  // страницу: капча иногда зависает, и свежая решается быстрее. Больше
  // MAX_RELOADS раз подряд на одном объекте не перезагружаем — тогда captcha,
  // сервер даст объекту паузу и вернёт его позже.
  var CAPTCHA_MS = 60000;
  var MAX_RELOADS = 2;
  var RELOAD_KEY = "r365reload:" + ID;
  var captchaTimer = null;
  function reloadsSoFar() {
    try { return Number(sessionStorage.getItem(RELOAD_KEY)) || 0; } catch (e) { return 0; }
  }
  function onCaptcha() {
    if (captchaSeen) return;
    captchaSeen = true;
    clearTimeout(giveUpTimer);
    var n = reloadsSoFar();
    append("Капча — решите её, номер сохранится сам." + (n ? " (перезагрузка " + n + " из " + MAX_RELOADS + ")" : ""));
    if (!document.hidden) armCaptcha();
  }
  // Минута на капчу идёт только пока вкладка на экране: в фоне её никто не решит.
  function armCaptcha() {
    clearTimeout(captchaTimer);
    captchaTimer = setTimeout(function () {
      if (done) return;
      if (n < MAX_RELOADS) {
        try { sessionStorage.setItem(RELOAD_KEY, String(n + 1)); } catch (e) {}
        append("Капча висит минуту — перезагружаю страницу (" + (n + 1) + " из " + MAX_RELOADS + ").");
        location.reload();
        return;
      }
      try { sessionStorage.removeItem(RELOAD_KEY); } catch (e) {}
      miss("captcha", "Капча не решена за минуту и после " + MAX_RELOADS + " перезагрузок");
    }, CAPTCHA_MS);
  }

  // --- сохранение ---------------------------------------------------------
  function save(phones) {
    if (done) return;
    done = true;
    clearTimeout(giveUpTimer);
    clearTimeout(captchaTimer);
    if (!KEY && !askKey()) { say("Без ключа сохранять некуда."); done = false; return; }
    say("Сохраняю " + phones.join(", ") + " …");
    api("/api/krisha/objphone", "POST", { id: ID, phones: phones })
      .then(function (r) {
        if (!r.ok || !r.j.ok) {
          done = false;
          if (r.j && r.j.error === "bad_key") { localStorage.removeItem("r365key"); KEY = null; }
          say("Не сохранилось: " + ((r.j && r.j.error) || "ошибка") +
            '<br><a href="#" id="r365-retry" style="color:#6fb2f0">повторить</a>');
          var a = document.getElementById("r365-retry");
          if (a) a.onclick = function (e) { e.preventDefault(); save(phones); };
          return;
        }
        say("✓ Сохранено: " + r.j.phones.join(", "));
        try { sessionStorage.removeItem(RELOAD_KEY); } catch (e) {}
        autoNext();
      })
      .catch(function () {
        done = false;
        say("Сеть не отвечает. Откройте страницу заново.");
      });
  }

  // --- очередь ------------------------------------------------------------
  // Сервер отдаёт один следующий объект: item (или null), left — сколько
  // готовых осталось, waiting — сколько на паузе после промахов.
  function nextItem() {
    return api("/api/krisha/objphone" + (SINCE ? "?since=" + encodeURIComponent(SINCE) : ""))
      .then(function (r) {
        var j = r.j || {};
        var it = j.item && String(j.item.id) !== ID ? j.item : null;
        return { item: it, left: j.left || 0, waiting: j.waiting || 0 };
      });
  }
  function emptyNote(q) {
    return "Очередь пуста" + (q.waiting ? ", на паузе " + q.waiting + "." : ".");
  }

  // Запрос за следующим объектом может упасть (сеть, таймаут) уже после того,
  // как номер сохранён или промах отправлен — тогда без этого блока страница
  // просто зависала бы на «Сохранено» без единой подсказки, что делать
  // дальше.
  function nextFailed() {
    append('Очередь не ответила. <a href="#" id="r365-nextretry" style="color:#6fb2f0">повторить</a>');
    var a = document.getElementById("r365-nextretry");
    if (a) a.onclick = function (e) { e.preventDefault(); autoNext(); };
  }

  // Едем дальше сами всегда — состояние «сохранено» (или «промах отправлен»)
  // не должно упираться в ручной клик. Но если капча на этой странице
  // показывалась, пауза перед переходом длиннее: это и есть тормоз на
  // случай, если Крыша начала присматриваться к темпу — не отказ от
  // автоперехода, а просто более осторожный интервал перед ним.
  var NEXT_DELAY_MS = 1000;
  var NEXT_DELAY_AFTER_CAPTCHA_MS = 1000;

  // Смена IP перед следующей страницей: сервер дёргает Asocks, у порта
  // браузера меняется выходной адрес, следующая страница грузится уже с
  // него. Если на сервере прокси не настроен, запоминаем и больше не зовём.
  // Ждём ответа не дольше ROTATE_MAX_MS — страница важнее смены IP.
  var ROTATE_MAX_MS = 15000;
  function rotateIp() {
    try { if (sessionStorage.getItem("r365norotate") === "1") return Promise.resolve(null); } catch (e) {}
    var timeout = new Promise(function (res) { setTimeout(function () { res({ timeout: true }); }, ROTATE_MAX_MS); });
    var call = api("/api/krisha/objphone/rotate", "POST", {}).then(function (r) { return r.j || {}; });
    return Promise.race([call, timeout])
      .then(function (j) {
        if (j && (j.error === "no_proxy" || j.error === "no_port")) {
          try { sessionStorage.setItem("r365norotate", "1"); } catch (e) {}
          append("Прокси на сервере не настроен — IP не меняю.");
          return null;
        }
        if (j && j.timeout) { append("Смена IP не ответила за 15 с — еду так."); return null; }
        if (j && j.rotated) append("IP сменён.");
        else if (j && j.throttled) append("IP менялся только что.");
        return j;
      })
      .catch(function () { return null; });
  }

  function autoNext() {
    nextItem()
      .then(function (q) {
        if (!q.item) { append(emptyNote(q)); return; }
        var delay = captchaSeen ? NEXT_DELAY_AFTER_CAPTCHA_MS : NEXT_DELAY_MS;
        append("Осталось " + q.left + ". Меняю IP и открываю следующую…");
        rotateIp().then(function () {
          setTimeout(function () { location.href = q.item.url; }, delay);
        });
      })
      .catch(nextFailed);
  }

  // --- страница -----------------------------------------------------------
  // Кнопка «Показать телефон» рисуется React-ом после загрузки, поэтому её
  // ждём, а не ищем один раз. Жмём один раз: повторный клик после того, как
  // Крыша уже показывает капчу или номер, только мешает.
  var clicked = false;
  function clickShow() {
    if (clicked) return false;
    var btn = document.querySelector(".show-phones") ||
      [].slice.call(document.querySelectorAll("button, a")).filter(function (b) {
        return (b.textContent || "").trim() === "Показать телефон";
      })[0];
    if (!btn) return false;
    clicked = true;
    btn.click();
    return true;
  }

  // Окно согласия на cookies (Google Funding Choices, класс fc-choice-dialog):
  // Крыша показывает его, когда меняется IP, и оно закрывает страницу.
  // Жмём «Consent» сами, как только окно появилось; проверяем полминуты.
  var consented = false;
  function acceptConsent() {
    if (consented) return true;
    var dlg = document.querySelector(".fc-choice-dialog");
    var btn = dlg && dlg.querySelector(".fc-cta-consent");
    if (!btn || btn.offsetParent === null) return false;
    btn.click();
    consented = true;
    append("Окно согласия на cookies закрыто.");
    return true;
  }
  var consentTicks = 0;
  var consentTimer = setInterval(function () {
    if (acceptConsent() || ++consentTicks > 60) clearInterval(consentTimer);
  }, 500);

  // --- запуск -------------------------------------------------------------
  // Вся работа начинается, только когда вкладка на экране. В фоновой вкладке
  // браузер замораживает отрисовку: капча не появляется, номер не приходит,
  // а таймеры срабатывают раз в минуту. Поэтому фоновая вкладка просто ждёт,
  // держит аренду объекта (продлевает её раз в две минуты) и стартует, когда
  // её откроют. Сто вкладок — это сто заранее открытых страниц, каждая
  // отрабатывает в момент, когда на неё переключились.
  var mo = null;
  var started = false;
  function start() {
    if (started) return;
    started = true;
    armGiveUp();
    var seen = found();
    var dead0 = deadReason();
    if (seen.length) save(seen);
    else if (dead0) miss(dead0, DEAD_WHY[dead0]);
    else if (!clickShow()) {
      var wait = new MutationObserver(function () {
        if (clickShow()) wait.disconnect();
      });
      wait.observe(document.body, { childList: true, subtree: true });
    }
    if (!done) {
      if (captchaVisible()) onCaptcha();
      // Ждём, пока номер появится: страница подставляет его после капчи без
      // перезагрузки, поэтому следим за изменениями разметки.
      mo = new MutationObserver(function () {
        if (done) return;
        if (captchaVisible()) onCaptcha();
        var d = deadReason();
        if (d) { miss(d, DEAD_WHY[d]); return; }
        var p = found();
        if (p.length) { mo.disconnect(); save(p); }
      });
      mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { clearTimeout(giveUpTimer); clearTimeout(captchaTimer); return; }
    if (!started) { start(); return; }
    if (done) return;
    if (captchaSeen) armCaptcha(); else armGiveUp();
  });
  if (document.hidden) {
    say("Вкладка в фоне — жду, пока её откроют.");
    var keepLease = setInterval(function () {
      if (started) { clearInterval(keepLease); return; }
      api("/api/krisha/objphone/lease", "POST", { id: ID }).catch(function () { /* продлим в следующий раз */ });
    }, 120000);
  } else {
    start();
  }
})();
