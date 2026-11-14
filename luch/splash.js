// Заставка Open Edu AI при загрузке страницы: логотип, название, полоска загрузки и
// подписи «Загружаем предметы · физика…». Подключается первой строкой <body>,
// поэтому показывается сразу, ещё до того, как страница нарисовалась.
(() => {
  if (window.__oeSplash) return; window.__oeSplash = true;
  const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const st = document.createElement('style');
  st.textContent = `
  .oe-splash{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:#0b1019;
    background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:32px 32px;transition:opacity .45s ease,visibility .45s}
  .oe-splash.out{opacity:0;visibility:hidden}
  .oe-splash .box{display:flex;flex-direction:column;align-items:center;gap:22px;padding:24px;text-align:center}
  .oe-splash svg{width:64px;height:64px}
  .oe-splash .ring{transform-origin:20px 20px;animation:oe-spin 6s linear infinite}
  .oe-splash h1{margin:0;font:700 clamp(28px,6vw,44px)/1 "Unbounded","Golos Text",system-ui,sans-serif;letter-spacing:.18em;color:#e8ecf4}
  .oe-splash .bar{width:min(280px,70vw);height:8px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden}
  .oe-splash .bar i{display:block;height:100%;width:0;border-radius:99px;background:linear-gradient(90deg,#72d4e8,#86e0a8);transition:width .35s ease}
  .oe-splash .cap{font:600 13px/1.3 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:#8b96ad;min-height:1.3em}
  .oe-splash .cap b{color:#e8ecf4;font-weight:600}
  @keyframes oe-spin{to{transform:rotate(360deg)}}
  @media (prefers-reduced-motion:reduce){.oe-splash .ring{animation:none}.oe-splash{transition:none}}`;
  document.head.appendChild(st);

  const el = document.createElement('div');
  el.className = 'oe-splash'; el.setAttribute('role', 'status'); el.setAttribute('aria-label', 'Загрузка');
  el.innerHTML = `<div class="box">
    <svg viewBox="0 0 40 40" aria-hidden="true"><g class="ring"><circle cx="20" cy="20" r="17" fill="none" stroke="#26324a" stroke-width="2"/><path d="M20 3a17 17 0 0 1 17 17" fill="none" stroke="#72d4e8" stroke-width="2.4" stroke-linecap="round"/></g>
      <path d="M20 30V19M20 19l-7-7M20 19l7-7M20 24l-5-3M20 24l5-3" stroke="#e8ecf4" stroke-width="2" stroke-linecap="round" fill="none"/>
      <circle cx="13" cy="12" r="2.4" fill="#72d4e8"/><circle cx="27" cy="12" r="2.4" fill="#ffb547"/><circle cx="15" cy="21" r="1.8" fill="#a99cff"/><circle cx="25" cy="21" r="1.8" fill="#ff8a73"/></svg>
    <h1>OPEN EDU AI</h1>
    <div class="bar"><i></i></div>
    <div class="cap"></div></div>`;
  (document.body || document.documentElement).appendChild(el);

  const bar = el.querySelector('.bar i'), cap = el.querySelector('.cap');
  const lab = !!document.querySelector('meta[name="oe-lab"]') || /\/labs\/|\/optics\/|\/mechanics\/|\/math\/|\/chemistry\/|\/biology\/|\/informatics\//.test(location.pathname);
  const words = lab ? ['готовим опыт', 'расставляем приборы', 'зовём наставника'] : ['физика', 'математика', 'химия', 'биология', 'информатика'];
  const head = lab ? 'Урок' : 'Загружаем предметы';
  let w = 0, p = 0;
  const say = () => { cap.innerHTML = `${head} · <b>${words[w % words.length]}</b>`; w++; };
  say();
  const tick = setInterval(() => { say(); }, 420);
  const grow = setInterval(() => { p = Math.min(92, p + (100 - p) * 0.12); bar.style.width = p + '%'; }, 120);
  const t0 = performance.now();
  let done = false;
  function finish() {
    if (done) return; done = true;
    const wait = Math.max(0, (reduce ? 200 : 650) - (performance.now() - t0));
    setTimeout(() => {
      clearInterval(grow); bar.style.width = '100%';
      setTimeout(() => { clearInterval(tick); el.classList.add('out'); setTimeout(() => el.remove(), 500); }, 220);
    }, wait);
  }
  // уходим, когда страница и шрифты готовы; не дольше 4 секунд в любом случае
  const ready = () => (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(finish, finish);
  if (document.readyState === 'complete') ready(); else addEventListener('load', ready);
  setTimeout(finish, 4000);
})();
