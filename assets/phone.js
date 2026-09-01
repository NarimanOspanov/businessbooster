// Выбор страны в форме звонка.
//
// Флаги рисуем сами, а не эмодзи: Windows не поставляет глифы флагов, и
// «🇰🇿» превращается там в две буквы в рамочках — ровно то, ради чего флаг
// и ставили, теряется.
//
// Казахстан и Россия делят код +7, поэтому маршрут выбирается не по строке
// в списке, а по самим цифрам: казахстанский мобильный — это +7 7XX.
(function () {
  var F = {
    kz: '<rect width="21" height="15" fill="#00afca"/><circle cx="10" cy="7" r="3.1" fill="#ffe000"/>',
    ru: '<rect width="21" height="15" fill="#fff"/><rect y="5" width="21" height="5" fill="#0039a6"/>' +
        '<rect y="10" width="21" height="5" fill="#d52b1e"/>',
    kg: '<rect width="21" height="15" fill="#e8112d"/><circle cx="10.5" cy="7.5" r="3.2" fill="#ffef00"/>',
    uz: '<rect width="21" height="15" fill="#0099b5"/><rect y="5" width="21" height="5" fill="#fff"/>' +
        '<rect y="10" width="21" height="5" fill="#1eb53a"/><rect y="4.6" width="21" height="0.8" fill="#ce1126"/>' +
        '<rect y="9.6" width="21" height="0.8" fill="#ce1126"/><circle cx="4.5" cy="2.5" r="1.7" fill="#fff"/>' +
        '<circle cx="5.4" cy="2.2" r="1.7" fill="#0099b5"/>',
    az: '<rect width="21" height="15" fill="#00b5e2"/><rect y="5" width="21" height="5" fill="#ef3340"/>' +
        '<rect y="10" width="21" height="5" fill="#509e2f"/><circle cx="10" cy="7.5" r="2.4" fill="#fff"/>' +
        '<circle cx="11" cy="7.5" r="2" fill="#ef3340"/>',
    ge: '<rect width="21" height="15" fill="#fff"/><rect x="8.6" width="3.8" height="15" fill="#ff0000"/>' +
        '<rect y="5.6" width="21" height="3.8" fill="#ff0000"/>',
    tr: '<rect width="21" height="15" fill="#e30a17"/><circle cx="8.5" cy="7.5" r="3.4" fill="#fff"/>' +
        '<circle cx="9.8" cy="7.5" r="2.7" fill="#e30a17"/><circle cx="13.2" cy="7.5" r="1.3" fill="#fff"/>',
    ae: '<rect width="21" height="15" fill="#fff"/><rect width="21" height="5" fill="#00732f"/>' +
        '<rect y="10" width="21" height="5" fill="#000"/><rect width="5.5" height="15" fill="#ff0000"/>',
    de: '<rect width="21" height="15" fill="#000"/><rect y="5" width="21" height="5" fill="#dd0000"/>' +
        '<rect y="10" width="21" height="5" fill="#ffce00"/>',
    us: '<rect width="21" height="15" fill="#fff"/><rect width="21" height="2.1" fill="#b22234"/>' +
        '<rect y="4.2" width="21" height="2.1" fill="#b22234"/><rect y="8.4" width="21" height="2.1" fill="#b22234"/>' +
        '<rect y="12.6" width="21" height="2.1" fill="#b22234"/><rect width="9" height="8.4" fill="#3c3b6e"/>'
  };

  // len — сколько цифр ждём после кода. null значит «от шести до двенадцати»:
  // проверять точную длину для каждой страны мы не возьмёмся.
  var COUNTRIES = [
    { iso: "kz", name: "Казахстан",    code: "7",   len: 10 },
    { iso: "ru", name: "Россия",       code: "7",   len: 10 },
    { iso: "kg", name: "Кыргызстан",   code: "996", len: 9 },
    { iso: "uz", name: "Узбекистан",   code: "998", len: 9 },
    { iso: "az", name: "Азербайджан",  code: "994", len: 9 },
    { iso: "ge", name: "Грузия",       code: "995", len: 9 },
    { iso: "tr", name: "Турция",       code: "90",  len: 10 },
    { iso: "ae", name: "ОАЭ",          code: "971", len: 9 },
    { iso: "de", name: "Германия",     code: "49",  len: null },
    { iso: "us", name: "США",          code: "1",   len: 10 }
  ];

  var names = window.COUNTRY_NAMES || {};
  COUNTRIES.forEach(function (c) { if (names[c.iso]) c.name = names[c.iso]; });

  var btn = document.getElementById("cf-cc");
  var list = document.getElementById("cf-cclist");
  var input = document.getElementById("cf-phone");
  if (!btn || !list || !input) return;

  var current = COUNTRIES[0];

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

  list.innerHTML = COUNTRIES.map(function (c, i) {
    return '<li role="option" tabindex="-1" data-i="' + i + '">' + svg(c.iso) +
      "<span>" + c.name + '</span><b>+' + c.code + "</b></li>";
  }).join("");

  function open(on) {
    list.hidden = !on;
    btn.setAttribute("aria-expanded", on ? "true" : "false");
  }
  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    open(list.hidden);
  });
  list.addEventListener("click", function (e) {
    var li = e.target.closest("li");
    if (!li) return;
    current = COUNTRIES[Number(li.getAttribute("data-i"))];
    paint(); sync(); open(false); input.focus();
  });
  document.addEventListener("click", function (e) {
    if (!list.contains(e.target) && e.target !== btn) open(false);
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") open(false); });

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
})();
