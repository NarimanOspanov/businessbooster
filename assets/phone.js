// Выбор страны в форме звонка.
//
// Флаги рисуем сами, а не эмодзи: Windows не поставляет глифы флагов, и
// «🇰🇿» превращается там в две буквы в рамочках — ровно то, ради чего флаг
// и ставили, теряется.
//
// Казахстан и Россия делят код +7, поэтому маршрут выбирается не по строке
// в списке, а по самим цифрам: казахстанский мобильный — это +7 7XX.
(function () {
  // Большинство флагов — это две-три полосы или скандинавский крест, поэтому
  // держим их формулами, а рисуем руками только те, что иначе не выходят.
  var W = 21, H = 15;
  function r(x, y, w, h, f) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + f + '"/>';
  }
  var h3 = function (a, b, c) { return r(0, 0, W, 5, a) + r(0, 5, W, 5, b) + r(0, 10, W, 5, c); };
  var v3 = function (a, b, c) { return r(0, 0, 7, H, a) + r(7, 0, 7, H, b) + r(14, 0, 7, H, c); };
  var h2 = function (a, b) { return r(0, 0, W, 7.5, a) + r(0, 7.5, W, 7.5, b); };
  // Скандинавский крест смещён влево — так он и выглядит на всех этих флагах.
  var nordic = function (bg, cross) {
    return r(0, 0, W, H, bg) + r(6, 0, 3.2, H, cross) + r(0, 6, W, 3.2, cross);
  };

  var F = {
    us: r(0, 0, W, H, "#fff") + r(0, 0, W, 2.1, "#b22234") + r(0, 4.2, W, 2.1, "#b22234") +
        r(0, 8.4, W, 2.1, "#b22234") + r(0, 12.6, W, 2.1, "#b22234") + r(0, 0, 9, 8.4, "#3c3b6e"),
    ca: r(0, 0, W, H, "#fff") + r(0, 0, 5, H, "#d80621") + r(16, 0, 5, H, "#d80621") +
        '<path d="M10.5 4.2l1 2.4 2-.6-.9 2 1.3.9-1.6.5.3 1.6-1.5-.8-.2 2-.2-2-1.5.8.3-1.6-1.6-.5 1.3-.9-.9-2 2 .6z" fill="#d80621"/>',
    kz: r(0, 0, W, H, "#00afca") + '<circle cx="10" cy="7" r="3.1" fill="#ffe000"/>',
    ru: h3("#fff", "#0039a6", "#d52b1e"),
    gr: r(0, 0, W, H, "#0d5eaf") + r(0, 1.7, W, 1.7, "#fff") + r(0, 5.1, W, 1.7, "#fff") +
        r(0, 8.5, W, 1.7, "#fff") + r(0, 11.9, W, 1.7, "#fff") + r(0, 0, 8.5, 8.5, "#0d5eaf") +
        r(3.4, 0, 1.7, 8.5, "#fff") + r(0, 3.4, 8.5, 1.7, "#fff"),
    nl: h3("#ae1c28", "#fff", "#21468b"),
    be: v3("#000", "#fdda24", "#ef3340"),
    fr: v3("#002395", "#fff", "#ed2939"),
    es: r(0, 0, W, H, "#c60b1e") + r(0, 3.8, W, 7.4, "#ffc400"),
    hu: h3("#ce2939", "#fff", "#477050"),
    it: v3("#008c45", "#fff", "#cd212a"),
    ro: v3("#002b7f", "#fcd116", "#ce1126"),
    ch: r(0, 0, W, H, "#d52b1e") + r(8.7, 3.4, 3.6, 8.2, "#fff") + r(6.5, 5.6, 8, 3.8, "#fff"),
    at: h3("#ed2939", "#fff", "#ed2939"),
    gb: r(0, 0, W, H, "#012169") +
        '<path d="M0 0L21 15M21 0L0 15" stroke="#fff" stroke-width="3"/>' +
        '<path d="M0 0L21 15M21 0L0 15" stroke="#c8102e" stroke-width="1.6"/>' +
        r(8.4, 0, 4.2, H, "#fff") + r(0, 5.4, W, 4.2, "#fff") +
        r(9.3, 0, 2.4, H, "#c8102e") + r(0, 6.3, W, 2.4, "#c8102e"),
    dk: nordic("#c8102e", "#fff"),
    se: nordic("#006aa7", "#fecc00"),
    no: r(0, 0, W, H, "#ba0c2f") + r(5.4, 0, 4.4, H, "#fff") + r(0, 5.4, W, 4.4, "#fff") +
        r(6.4, 0, 2.4, H, "#00205b") + r(0, 6.4, W, 2.4, "#00205b"),
    pl: h2("#fff", "#dc143c"),
    de: h3("#000", "#dd0000", "#ffce00"),
    pt: r(0, 0, W, H, "#da291c") + r(0, 0, 8, H, "#046a38") +
        '<circle cx="8" cy="7.5" r="3" fill="#ffe900"/><circle cx="8" cy="7.5" r="1.8" fill="#da291c"/>',
    fi: nordic("#fff", "#003580"),
    ua: h2("#0057b7", "#ffd700"),
    by: r(0, 0, W, H, "#c8313e") + r(0, 10, W, 5, "#00af3f") + r(0, 0, 4, H, "#fff"),
    tr: r(0, 0, W, H, "#e30a17") + '<circle cx="8.5" cy="7.5" r="3.4" fill="#fff"/>' +
        '<circle cx="9.8" cy="7.5" r="2.7" fill="#e30a17"/><circle cx="13.2" cy="7.5" r="1.3" fill="#fff"/>',
    cz: h2("#fff", "#d7141a") + '<path d="M0 0L10 7.5L0 15z" fill="#11457e"/>',
    ae: r(0, 0, W, H, "#fff") + r(0, 0, W, 5, "#00732f") + r(0, 10, W, 5, "#000") +
        r(0, 0, 5.5, H, "#ff0000"),
    tj: h3("#cc0000", "#fff", "#006600") + '<circle cx="10.5" cy="7.5" r="1.5" fill="#f8c300"/>',
    tm: r(0, 0, W, H, "#28ae66") + r(3, 0, 3.4, H, "#fff") +
        '<circle cx="14" cy="5" r="2.4" fill="#fff"/><circle cx="15.1" cy="4.6" r="2" fill="#28ae66"/>',
    az: h3("#00b5e2", "#ef3340", "#509e2f") + '<circle cx="10" cy="7.5" r="2.4" fill="#fff"/>' +
        '<circle cx="11" cy="7.5" r="2" fill="#ef3340"/>',
    ge: r(0, 0, W, H, "#fff") + r(8.6, 0, 3.8, H, "#f00") + r(0, 5.6, W, 3.8, "#f00"),
    kg: r(0, 0, W, H, "#e8112d") + '<circle cx="10.5" cy="7.5" r="3.2" fill="#ffef00"/>',
    uz: h3("#0099b5", "#fff", "#1eb53a") + r(0, 4.6, W, 0.8, "#ce1126") +
        r(0, 9.6, W, 0.8, "#ce1126") + '<circle cx="4.5" cy="2.5" r="1.7" fill="#fff"/>' +
        '<circle cx="5.4" cy="2.2" r="1.7" fill="#0099b5"/>'
  };

  // len — сколько цифр ждём после кода. null значит «от шести до двенадцати»:
  // проверять точную длину для каждой страны мы не возьмёмся.
  // Порядок — по возрастанию кода.
  var COUNTRIES = [
    { iso: "us", name: "США",            code: "1",   len: 10 },
    { iso: "ca", name: "Канада",         code: "1",   len: 10 },
    { iso: "kz", name: "Казахстан",      code: "7",   len: 10 },
    { iso: "ru", name: "Россия",         code: "7",   len: 10 },
    { iso: "gr", name: "Греция",         code: "30",  len: 10 },
    { iso: "nl", name: "Нидерланды",     code: "31",  len: 9 },
    { iso: "be", name: "Бельгия",        code: "32",  len: null },
    { iso: "fr", name: "Франция",        code: "33",  len: 9 },
    { iso: "es", name: "Испания",        code: "34",  len: 9 },
    { iso: "hu", name: "Венгрия",        code: "36",  len: null },
    { iso: "it", name: "Италия",         code: "39",  len: null },
    { iso: "ro", name: "Румыния",        code: "40",  len: 9 },
    { iso: "ch", name: "Швейцария",      code: "41",  len: 9 },
    { iso: "at", name: "Австрия",        code: "43",  len: null },
    { iso: "gb", name: "Великобритания", code: "44",  len: 10 },
    { iso: "dk", name: "Дания",          code: "45",  len: 8 },
    { iso: "se", name: "Швеция",         code: "46",  len: null },
    { iso: "no", name: "Норвегия",       code: "47",  len: 8 },
    { iso: "pl", name: "Польша",         code: "48",  len: 9 },
    { iso: "de", name: "Германия",       code: "49",  len: null },
    { iso: "tr", name: "Турция",         code: "90",  len: 10 },
    { iso: "pt", name: "Португалия",     code: "351", len: 9 },
    { iso: "fi", name: "Финляндия",      code: "358", len: null },
    { iso: "by", name: "Беларусь",       code: "375", len: 9 },
    { iso: "ua", name: "Украина",        code: "380", len: 9 },
    { iso: "cz", name: "Чехия",          code: "420", len: 9 },
    { iso: "ae", name: "ОАЭ",            code: "971", len: 9 },
    { iso: "tj", name: "Таджикистан",    code: "992", len: 9 },
    { iso: "tm", name: "Туркменистан",   code: "993", len: 8 },
    { iso: "az", name: "Азербайджан",    code: "994", len: 9 },
    { iso: "ge", name: "Грузия",         code: "995", len: 9 },
    { iso: "kg", name: "Кыргызстан",     code: "996", len: 9 },
    { iso: "uz", name: "Узбекистан",     code: "998", len: 9 }
  ];

  var names = window.COUNTRY_NAMES || {};
  COUNTRIES.forEach(function (c) { if (names[c.iso]) c.name = names[c.iso]; });

  var btn = document.getElementById("cf-cc");
  var box = document.getElementById("cf-cclist");
  var input = document.getElementById("cf-phone");
  if (!btn || !box || !input) return;

  var current = COUNTRIES.filter(function (c) { return c.iso === "kz"; })[0];
  var shown = COUNTRIES.slice();
  var cursor = 0;

  function svg(iso) {
    return '<svg class="flag" viewBox="0 0 21 15" aria-hidden="true">' + F[iso] + "</svg>";
  }
  function digits(v) {
    var d = String(v).replace(/[^0-9]/g, "");
    // Казахстанский номер часто пишут с восьмёрки или с семёрки — убираем.
    if (current.code === "7" && d.length > current.len && (d[0] === "8" || d[0] === "7")) d = d.slice(1);
    return d.slice(0, current.len || 12);
  }
  function pretty(d) {
    if (current.code !== "7") return d.replace(/(.{3})(?=.)/g, "$1 ").trim();
    var out = d.slice(0, 3);
    if (d.length > 3) out += " " + d.slice(3, 6);
    if (d.length > 6) out += " " + d.slice(6, 8);
    if (d.length > 8) out += " " + d.slice(8, 10);
    return out;
  }
  function sync() { input.value = pretty(digits(input.value)); }

  function paint() {
    btn.innerHTML = svg(current.iso) + '<span class="cc-code">+' + current.code + "</span>" +
      '<svg class="cc-chev" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" ' +
      'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    btn.setAttribute("aria-label", current.name + ", +" + current.code);
    input.placeholder = current.code === "7" ? "707 000 00 00" : "000 000 000";
  }

  box.innerHTML = '<input class="ccsearch" id="cf-ccq" type="text" autocomplete="off" spellcheck="false" ' +
    'placeholder="' + (window.COUNTRY_SEARCH || "Страна или код") + '">' +
    '<ul class="ccitems" id="cf-ccitems" role="listbox"></ul>';
  var q = document.getElementById("cf-ccq");
  var items = document.getElementById("cf-ccitems");

  function draw() {
    items.innerHTML = shown.map(function (c, i) {
      return '<li role="option" data-i="' + i + '"' + (i === cursor ? ' class="on"' : "") + ">" +
        svg(c.iso) + "<span>" + c.name + "</span><b>+" + c.code + "</b></li>";
    }).join("") || '<li class="empty">' + (window.COUNTRY_EMPTY || "Ничего не нашлось") + "</li>";
  }
  function filter() {
    var s = q.value.trim().toLowerCase().replace(/^\+/, "");
    shown = !s ? COUNTRIES.slice() : COUNTRIES.filter(function (c) {
      return c.code.indexOf(s) === 0 || c.name.toLowerCase().indexOf(s) === 0;
    });
    cursor = 0;
    draw();
  }

  // Список лежит внутри блока с overflow:hidden — фиксированная привязка
  // единственная, при которой он не обрезается о край секции.
  function place() {
    var b = btn.getBoundingClientRect();
    box.style.left = Math.round(Math.max(8, Math.min(b.left, window.innerWidth - 276))) + "px";
    // На невысоком экране список не помещается под кнопкой — тогда открываем
    // его вверх, а список стран сжимаем по остатку места.
    var below = window.innerHeight - b.bottom - 16;
    var above = b.top - 16;
    var up = below < 220 && above > below;
    var room = Math.max(120, (up ? above : below) - 60);
    items.style.maxHeight = Math.min(250, room) + "px";
    box.style.top = up ? "auto" : Math.round(b.bottom + 8) + "px";
    box.style.bottom = up ? Math.round(window.innerHeight - b.top + 8) + "px" : "auto";
  }
  function open(on) {
    box.hidden = !on;
    btn.setAttribute("aria-expanded", on ? "true" : "false");
    if (!on) return;
    q.value = ""; filter(); place(); q.focus();
  }
  function choose(c) {
    if (!c) return;
    current = c; paint(); sync(); open(false); input.focus();
  }

  btn.addEventListener("click", function (e) { e.stopPropagation(); open(box.hidden); });
  items.addEventListener("click", function (e) {
    var li = e.target.closest("li[data-i]");
    if (li) choose(shown[Number(li.getAttribute("data-i"))]);
  });
  q.addEventListener("input", filter);
  q.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!shown.length) return;
      cursor = (cursor + (e.key === "ArrowDown" ? 1 : shown.length - 1)) % shown.length;
      draw();
      var on = items.querySelector("li.on");
      if (on) on.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault(); choose(shown[cursor]);
    } else if (e.key === "Escape") {
      open(false); btn.focus();
    }
  });
  document.addEventListener("click", function (e) {
    if (!box.contains(e.target) && e.target !== btn) open(false);
  });
  window.addEventListener("resize", function () { if (!box.hidden) place(); });
  window.addEventListener("scroll", function () { if (!box.hidden) place(); }, true);

  input.addEventListener("input", sync);
  input.addEventListener("paste", function () { setTimeout(sync, 0); });

  paint();

  // Полный номер в международном виде — или null, если цифр столько, что
  // звонить бессмысленно.
  window.phoneE164 = function () {
    var d = digits(input.value);
    if (current.len ? d.length !== current.len : (d.length < 6 || d.length > 12)) return null;
    return "+" + current.code + d;
  };

  // Тот же номер, но в том виде, в каком человек его видит в поле: его же
  // мы показываем в окне выбора сценария, чтобы он узнал свой номер.
  window.phoneShown = function () {
    return ("+" + current.code + " " + input.value).replace(/\s+/g, " ").trim();
  };
})();
