// Заставка Open Lab AI при загрузке страницы: логотип, название, полоска загрузки и
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
  .oe-splash svg{width:84px;height:84px}
  .oe-splash .owl{animation:oe-bob 1.6s ease-in-out infinite}
  .oe-splash h1{margin:0;font:700 clamp(28px,6vw,44px)/1 "Unbounded","Golos Text",system-ui,sans-serif;letter-spacing:.18em;color:#e8ecf4}
  .oe-splash .bar{width:min(280px,70vw);height:8px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden}
  .oe-splash .bar i{display:block;height:100%;width:0;border-radius:99px;background:linear-gradient(90deg,#72d4e8,#86e0a8);transition:width .35s ease}
  .oe-splash .cap{font:600 13px/1.3 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:#8b96ad;min-height:1.3em}
  .oe-splash .cap b{color:#e8ecf4;font-weight:600}
  @keyframes oe-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
  @media (prefers-reduced-motion:reduce){.oe-splash .owl{animation:none}.oe-splash{transition:none}}`;
  document.head.appendChild(st);

  const el = document.createElement('div');
  el.className = 'oe-splash'; el.setAttribute('role', 'status'); el.setAttribute('aria-label', 'Загрузка');
  el.innerHTML = `<div class="box">
    <svg class="owl" viewBox="0 0 40 40" aria-hidden="true"><path d="M9.6 14.6 9.2 6.2 15 10.6Q20 9.4 25 10.6L30.8 6.2 30.4 14.6Q34.6 22 31.6 29Q27.6 36 20 36Q12.4 36 8.4 29Q5.4 22 9.6 14.6Z" fill="#ffb547"/><path d="M20 14Q15.2 10.8 10.9 13.4Q7.6 17.2 9.4 21.8Q11.6 25.8 15.9 25.4Q18.5 25.1 20 27.1Q21.5 25.1 24.1 25.4Q28.4 25.8 30.6 21.8Q32.4 17.2 29.1 13.4Q24.8 10.8 20 14Z" fill="#ffd896"/><circle cx="15" cy="18.8" r="5" fill="#fffaf0"/><circle cx="25" cy="18.8" r="5" fill="#fffaf0"/><circle cx="15.6" cy="19.2" r="2.9" fill="#0b1019"/><circle cx="24.4" cy="19.2" r="2.9" fill="#0b1019"/><circle cx="16.6" cy="18.1" r="1" fill="#fff"/><circle cx="25.4" cy="18.1" r="1" fill="#fff"/><path d="M18.6 23.4h2.8L20 26.6z" fill="#ff8a73"/><path d="M10.5 29.6Q15.3 27.4 20 29.7Q24.7 27.4 29.5 29.6V34.6Q24.7 32.6 20 34.8Q15.3 32.6 10.5 34.6Z" fill="#72d4e8"/><path d="M20 29.7V34.8" stroke="#0b1019" stroke-width="1.1"/><path d="M8.2 23.5Q5.6 28.6 9.4 32.6Q11.6 33.2 12.4 31Q10.4 28.4 8.2 23.5Z" fill="#e8962a"/><path d="M31.8 23.5Q34.4 28.6 30.6 32.6Q28.4 33.2 27.6 31Q29.6 28.4 31.8 23.5Z" fill="#e8962a"/><path d="M35 3.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" fill="#86e0a8"/></svg>
    <h1>OPEN LAB AI</h1>
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
