// ==UserScript==
// @name         Reception365 · телефоны с Крыши
// @namespace    https://saudager.ai/
// @version      1.4
// @description  Сама жмёт «показать телефон», сохраняет номер и сама идёт дальше по очереди — пока не покажется капча; снятые объявления пропускает сама, не зависая
// @match        https://krisha.kz/a/show/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

// Капчу проходит человек — скрипт её не видит и не трогает. Он нажимает за
// человека только саму кнопку «Показать телефон» (класс show-phones), чтобы
// не тянуться к ней на каждой странице руками, — а дальше, если Крыша
// потребует капчу, её решает уже человек. Когда номер появился на экране,
// скрипт забирает его из разметки и отправляет к нам.
//
// Дальше — либо едет сам, либо ждёт руки. Пока капча ни разу не показалась
// на этой странице, номер, скорее всего, отдался без проверки — тогда скрипт
// сам открывает следующую квартиру из очереди, без клика. А если капча всё же
// всплыла (даже если человек её тут же решил), это знак, что Крыша
// присматривается к темпу, — на такой странице автопереход выключается, и
// дальше снова решает человек, кликая «следующая →» сам.

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

  var box = document.createElement("div");
  box.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:99999;max-width:280px;" +
    "padding:12px 14px;border-radius:10px;background:#1c1819;color:#fff;" +
    'font:14px/1.4 "Open Sans",Arial,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35)';
  document.body.appendChild(box);
  function say(html) { box.innerHTML = html; }

  say("Открываю телефон…");

  // Номера живут в блоке контактов и появляются только после капчи.
  function found() {
    var el = document.querySelector(".a-phones") || document.querySelector("#a-phones");
    if (!el) return [];
    var out = [];
    (el.innerText || "").replace(/(?:\+?7|8)[\s\-()]*\d{3}[\s\-()]*\d{3}[\s\-()]*\d{2}[\s\-()]*\d{2}/g,
      function (m) { if (out.indexOf(m) === -1) out.push(m.trim()); });
    return out;
  }

  // Капча — виджет reCAPTCHA, инлайном или в iframe. Селекторы — только
  // точные токены класса/атрибута, не подстрока: на каждой странице Крыши в
  // подвале есть <p class="g-recaptcha-policy"> — обычная приписка «сайт
  // защищён reCAPTCHA», и широкий [class*="captcha"] цеплял бы её всегда,
  // выключая автопереход навсегда с первой же страницы.
  var captchaSeen = false;
  function captchaVisible() {
    return !!(
      document.querySelector('iframe[src*="recaptcha" i]') ||
      document.querySelector('iframe[title*="recaptcha" i]') ||
      document.querySelector('iframe[src*="hcaptcha" i]') ||
      document.querySelector(".g-recaptcha") ||
      document.querySelector(".h-captcha")
    );
  }

  // Если за это время не нашлась ни кнопка с номером, ни капча — страница,
  // скорее всего, мертва (объявление снято). Ждать тут больше нет смысла:
  // раньше скрипт просто зависал навсегда на такой странице, и очередь
  // упиралась в один и тот же мертвяк на каждом заходе.
  var GIVE_UP_MS = 15000;
  var giveUpTimer = setTimeout(giveUp, GIVE_UP_MS);
  function giveUp() {
    if (sent || captchaSeen) return; // капча — значит дело живое, решает человек
    say("Похоже, объявление снято — сообщаю и еду дальше…");
    if (!KEY && !askKey()) { say("Без ключа даже промах сообщить некуда."); return; }
    fetch(API + "/api/krisha/phone/miss?key=" + encodeURIComponent(KEY), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ID }),
    }).catch(function () {}).then(function () { autoNext(); });
  }

  var sent = false;
  function save(phones) {
    if (sent) return;
    sent = true;
    clearTimeout(giveUpTimer);
    if (!KEY && !askKey()) { say("Без ключа сохранять некуда."); sent = false; return; }
    say("Сохраняю " + phones.join(", ") + " …");
    fetch(API + "/api/krisha/phone?key=" + encodeURIComponent(KEY), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ID, phones: phones }),
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (r) {
        if (!r.ok || !r.j.ok) {
          sent = false;
          if (r.j && r.j.error === "bad_key") { localStorage.removeItem("r365key"); KEY = null; }
          say("Не сохранилось: " + ((r.j && r.j.error) || "ошибка") +
            '<br><a href="#" id="r365-retry" style="color:#6fb2f0">повторить</a>');
          var a = document.getElementById("r365-retry");
          if (a) a.onclick = function (e) { e.preventDefault(); save(phones); };
          return;
        }
        say("✓ Сохранено: " + r.j.phones.join(", "));
        // Капча ни разу не показалась на этой странице — номер отдался
        // без проверки, и Крыша, похоже, не насторожилась. Едем дальше сами.
        // Если капча всё же мелькала (пусть человек её и решил), это знак
        // притормозить — дальше снова руками, кликом по ссылке.
        if (captchaSeen) next(); else autoNext();
      })
      .catch(function () {
        sent = false;
        say("Сеть не отвечает. Откройте страницу заново.");
      });
  }

  // total — очередь целиком, а не размер этой пачки. С limit=30 count почти
  // всегда был ровно 30 и не двигался, сколько ни сохраняй — на самом деле
  // счётчик тогда мерил не прогресс, а лимит запроса.
  function queueLeft() {
    return fetch(API + "/api/krisha/queue?key=" + encodeURIComponent(KEY) + "&limit=30")
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var left = (j.items || []).filter(function (x) { return x.id !== ID; });
        var n = typeof j.total === "number" ? j.total : left.length;
        return { left: left, n: n };
      });
  }

  // Следующая квартира без телефона. Переход — по кнопке, а не сам: страницу
  // из-под человека выдёргивать нельзя, вдруг он её ещё читает. Используется,
  // когда на этой странице была капча — дальше решает человек.
  function next() {
    queueLeft()
      .then(function (r) {
        if (!r.left.length) { say(box.innerHTML + "<br>Очередь пуста."); return; }
        say(box.innerHTML + "<br>Осталось " + r.n +
          '. <a href="' + r.left[0].url + '" style="color:#6fb2f0">следующая →</a>');
      })
      .catch(function () { /* очередь не обязательна */ });
  }

  // Капчи не было — едем сами, без клика. Небольшая пауза перед переходом:
  // не мгновенно, чтобы сообщение успело мелькнуть на экране, а не потому что
  // Крыше нужна задержка — по темпу запросов для неё это то же самое, что
  // клик сразу.
  function autoNext() {
    queueLeft()
      .then(function (r) {
        if (!r.left.length) { say(box.innerHTML + "<br>Очередь пуста."); return; }
        say(box.innerHTML + "<br>Осталось " + r.n + ". Открываю следующую…");
        setTimeout(function () { location.href = r.left[0].url; }, 1200);
      })
      .catch(function () { /* очередь не обязательна — просто останемся тут */ });
  }

  // Кнопка «Показать телефон» рисуется React-ом после загрузки, поэтому её
  // тоже ждём, а не ищем один раз сразу. Жмём один раз: повторный клик после
  // того, как Крыша уже показывает капчу или номер, только мешает.
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

  // Ждём, пока номер появится: страница подставляет его после капчи, без
  // перезагрузки, поэтому следим за изменениями разметки. Той же слежкой
  // ловим и саму кнопку, если её не было в первый момент.
  var seen = found();
  if (seen.length) save(seen);
  else if (!clickShow()) {
    var wait = new MutationObserver(function () {
      if (clickShow()) wait.disconnect();
    });
    wait.observe(document.body, { childList: true, subtree: true });
  }
  if (captchaVisible()) captchaSeen = true;
  var mo = new MutationObserver(function () {
    if (!captchaSeen && captchaVisible()) captchaSeen = true;
    var p = found();
    if (p.length) { mo.disconnect(); save(p); }
  });
  mo.observe(document.body, { childList: true, subtree: true, characterData: true });
})();
