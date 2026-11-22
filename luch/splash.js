// Заставка Open School AI при загрузке страницы: логотип, название, полоска загрузки и
// подписи «Загружаем предметы · физика…». Подключается первой строкой <body>,
// поэтому показывается сразу, ещё до того, как страница нарисовалась.
(() => {
  if (window.__oeSplash) return; window.__oeSplash = true;
  // ?embed=real — только объёмная сцена опыта «Как в жизни» на весь экран (её встраивает видеоразбор ENT QUIZ в iframe)
  if (new URLSearchParams(location.search).get('embed') === 'real') {
    window.__oeEmbed = true; document.documentElement.classList.add('oe-embed');
    try { localStorage.setItem('luch-real', '1'); } catch (e) {}
    const es = document.createElement('style');
    es.textContent = `html.oe-embed,html.oe-embed body{overflow:hidden!important;background:#0b1019!important}
    html.oe-embed body #stage#stage.stage{position:fixed!important;inset:0!important;z-index:2147483001!important;margin:0!important;border:0!important;border-radius:0!important;width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;display:flex!important;flex-direction:column;justify-content:center;background:#0b1019}
    html.oe-embed body #stage#stage > :not(#scene):not(.rl-view){display:none!important}
    html.oe-embed .ls-start,html.oe-embed .ls-story,html.oe-embed .lt-btn,html.oe-embed .lt-panel{display:none!important}
    html.oe-embed body #scene#scene{display:block!important;width:100%!important;max-height:100vh}`;
    (document.head || document.documentElement).appendChild(es);
    // &set={"desc":{…},"live":{…}} — числа задачи поверх описания сцены опыта (LUCH_REAL() и LUCH_REAL.live()):
    // объекты сливаются, в массивах элемент ищется по id, потом по type/kind, иначе по номеру
    let SET = null; try { SET = JSON.parse(new URLSearchParams(location.search).get('set') || 'null'); } catch (e) {}
    if (SET && typeof SET === 'object') {
      const isO = x => x && typeof x === 'object' && !Array.isArray(x);
      const merge = (d, p) => {
        for (const k of Object.keys(p)) {
          const pv = p[k], dv = d[k];
          if (Array.isArray(pv) && Array.isArray(dv)) pv.forEach((pi, i) => {
            const j = isO(pi) && pi.id != null ? dv.findIndex(x => x && x.id === pi.id) : isO(pi) && (pi.type || pi.kind) ? dv.findIndex(x => x && (pi.type ? x.type === pi.type : x.kind === pi.kind)) : i;
            if (j < 0) return; dv[j] = isO(pi) && isO(dv[j]) ? merge(dv[j], pi) : pi;
          });
          else if (isO(pv) && isO(dv)) merge(dv, pv); else d[k] = pv;
        }
        return d;
      };
      const wrap = f => new Proxy(f, {
        apply(t, th, a) { const d = Reflect.apply(t, th, a); return isO(d) && SET.desc ? merge(d, SET.desc) : d; },
        get(t, k) { const v = t[k]; if (k === 'live' && typeof v === 'function' && SET.live) return () => { const d = v(); return isO(d) ? merge(d, SET.live) : d; }; return v; },
      });
      let real;
      Object.defineProperty(window, 'LUCH_REAL', { configurable: true, get: () => real, set: f => { real = typeof f === 'function' ? wrap(f) : f; } });
    }
    return; // без заставки
  }
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
    <svg class="owl" viewBox="0 0 40 40" aria-hidden="true"><path d="M12 27h12v10.5H12z" fill="#c8803e"/><path d="M10.5 31.5Q18 35.2 25.5 31.5" fill="none" stroke="#ffb547" stroke-width="3" stroke-linecap="round"/><circle cx="18" cy="33.6" r="1.6" fill="#ffd896"/><ellipse cx="18" cy="19.5" rx="11" ry="10" fill="#c8803e"/><path d="M19 15.5Q27 14.8 33.5 17.2Q38 19 37.6 23.2Q37 27.6 31.5 28Q24 28.4 19 26Z" fill="#c8803e"/><path d="M21 24.6Q27 27.4 32.5 26.9Q35.6 26.5 36.6 24.6Q32 25.8 27 24.6Q24 23.9 21 24.6Z" fill="#e7b37c"/><ellipse cx="35.6" cy="20.6" rx="2.5" ry="2.1" fill="#1b1206"/><circle cx="36.2" cy="19.9" r=".7" fill="#fff" opacity=".7"/><path d="M27.5 27.2Q30.5 28.8 33.6 27.3" fill="none" stroke="#5a3214" stroke-width="1" stroke-linecap="round"/><circle cx="22.4" cy="17.2" r="2.4" fill="#1b1206"/><circle cx="23.2" cy="16.4" r=".85" fill="#fff"/><path d="M19.8 13.6Q22.4 12.2 25 13.4" fill="none" stroke="#8a4f20" stroke-width="1.1" stroke-linecap="round"/><path d="M11.5 10.5Q4 11.5 4.2 21Q4.4 29.5 10.2 30.2Q13.4 30.4 14.2 26Q15.4 18 14.6 11.6Q13.6 10.2 11.5 10.5Z" fill="#8a4f20"/><path d="M7.4 16Q6.6 22 8.4 27" fill="none" stroke="#a8622b" stroke-width="1.2" stroke-linecap="round"/></svg>
    <h1>OPEN SCHOOL AI</h1>
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
