// ==UserScript==
// @name         Reception365 · телефоны с Крыши
// @namespace    https://saudager.ai/
// @version      1.2
// @description  Сама жмёт «показать телефон», сохраняет номер и ведёт к следующей квартире из очереди
// @match        https://krisha.kz/a/show/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

// Капчу проходит человек — скрипт её не видит и не трогает. Он нажимает за
// человека только саму кнопку «Показать телефон» (класс show-phones), чтобы
// не тянуться к ней на каждой странице руками, — а дальше, если Крыша
// потребует капчу, её решает уже человек. Когда номер появился на экране,
// скрипт забирает его из разметки и отправляет к нам. Дальше предлагает
// открыть следующую квартиру из очереди.

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

  var sent = false;
  function save(phones) {
    if (sent) return;
    sent = true;
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
        next();
      })
      .catch(function () {
        sent = false;
        say("Сеть не отвечает. Откройте страницу заново.");
      });
  }

  // Следующая квартира без телефона. Переход — по кнопке, а не сам: страницу
  // из-под человека выдёргивать нельзя, вдруг он её ещё читает.
  function next() {
    fetch(API + "/api/krisha/queue?key=" + encodeURIComponent(KEY) + "&limit=30")
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var left = (j.items || []).filter(function (x) { return x.id !== ID; });
        if (!left.length) { say(box.innerHTML + "<br>Очередь пуста."); return; }
        // total — очередь целиком, а не размер этой пачки. С limit=30 count
        // почти всегда был ровно 30 и не двигался, сколько ни сохраняй — на
        // самом деле счётчик тогда мерил не прогресс, а лимит запроса.
        var n = typeof j.total === "number" ? j.total : left.length;
        say(box.innerHTML + "<br>Осталось " + n +
          '. <a href="' + left[0].url + '" style="color:#6fb2f0">следующая →</a>');
      })
      .catch(function () { /* очередь не обязательна */ });
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
  var mo = new MutationObserver(function () {
    var p = found();
    if (p.length) { mo.disconnect(); save(p); }
  });
  mo.observe(document.body, { childList: true, subtree: true, characterData: true });
})();
