// Окно ИИ-репетитора Open Edu AI в правом нижнем углу.
// Два голосовых режима: микрофон в поле ввода (надиктовать вопрос, ответ текстом)
// и «Голосом» — живой разговор: ученик говорит, репетитор отвечает вслух и снова слушает.
// Страница может задать window.LUCH_CONTEXT() — текст о том, что сейчас на экране,
// и window.LUCH_SUGGEST() — список готовых вопросов.

// ---------- языки сайта: Рус · Eng · Қаз · Esp ----------
// Страницы написаны по-русски; для других языков весь текст страницы (включая подписи стенда,
// которые перерисовываются каждый кадр) подменяется переводом из кэша. Новые строки переводит
// сервер (/api/luch/i18n, кэш в базе), здесь они запоминаются в localStorage.
(() => {
  if (window.LuchI18n) return;
  const LANGS = [['ru', 'Рус'], ['en', 'Eng'], ['kk', 'Қаз'], ['es', 'Esp']];
  const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  const fromUrl = new URLSearchParams(location.search).get('lang');
  // Пока сайт только на русском: переключатель скрыт, другие языки включаются лишь вручную через ?lang=en (для проверки).
  const LANGS_ON = false;
  let lang = LANGS.some(l => l[0] === fromUrl) ? fromUrl : (LANGS_ON ? (store.get('luch-lang') || 'ru') : 'ru');
  if (!LANGS.some(l => l[0] === lang)) lang = 'ru';
  if (fromUrl) store.set('luch-lang', lang);
  document.documentElement.lang = lang;
  const api = window.LuchI18n = { lang, langs: LANGS, set(l) { store.set('luch-lang', l); const u = new URL(location.href); u.searchParams.delete('lang'); location.href = u.toString(); } };

  // переключатель в шапке
  const css = document.createElement('style');
  css.textContent = `.li-lang{display:flex;gap:2px;background:var(--surface,#121a28);border:1px solid var(--line,#26324a);border-radius:10px;padding:3px;flex:none}
    .li-lang button{background:none;border:0;border-radius:7px;padding:6px 9px;font:600 12px/1 var(--font-body,"Golos Text",sans-serif);color:var(--muted,#8b96ad);cursor:pointer}
    .li-lang button[aria-pressed="true"]{background:var(--fg,#e8ecf4);color:var(--bg,#0b1019)}
    .li-lang button:hover{color:var(--fg,#e8ecf4)}
    html.li-wait body{opacity:0}
    body{transition:opacity .18s}`;
  document.head.appendChild(css);
  const mount = () => {
    const header = document.querySelector('header'); if (!header || header.querySelector('.li-lang')) return;
    const box = document.createElement('div'); box.className = 'li-lang'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Language'); box.dataset.noi18n = '';
    box.innerHTML = LANGS.map(([c, n]) => `<button type="button" data-l="${c}" aria-pressed="${c === lang}">${n}</button>`).join('');
    box.addEventListener('click', e => { const b = e.target.closest('button'); if (b && b.dataset.l !== lang) api.set(b.dataset.l); });
    header.appendChild(box);
  };
  if (LANGS_ON) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount(); }
  if (lang === 'ru') return;

  const CY = /[А-Яа-яЁё]/;
  const KEY = 'luch-i18n-' + lang;
  let cache;
  try { cache = new Map(JSON.parse(store.get(KEY) || '[]')); } catch (e) { cache = new Map(); }
  const done = new Set(cache.values());          // уже переведённые строки (для казахского они тоже кириллица)
  const queue = new Set(), inflight = new Set(), waiting = new Set();
  const SKIP = 'script,style,textarea,code,pre,[data-noi18n],.lt-m';
  const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  // числа меняются каждый кадр («12,3 см») — переводим шаблон «{0} см», а числа подставляем обратно
  const NUM = /-?\d+(?:[.,]\d+)*/g;
  const lookup = s => {
    const k = s.trim(); if (!k || !CY.test(k) || done.has(k)) return null;
    const nums = k.match(NUM) || []; let i = 0;
    const tmpl = nums.length ? k.replace(NUM, () => '{' + (i++) + '}') : k;
    if (done.has(tmpl)) return null;
    const t = cache.get(tmpl);
    if (t !== undefined) { const out = nums.length ? t.replace(/\{(\d+)\}/g, (m, n) => nums[+n] !== undefined ? nums[+n] : m) : t; return s.replace(k, out); }
    queue.add(tmpl); return undefined;
  };
  function textNode(n) {
    const p = n.parentElement; if (!p || p.closest(SKIP)) return;
    const r = lookup(n.nodeValue); if (r === null) return;
    if (r === undefined) { waiting.add(n); return; }
    if (n.nodeValue !== r) n.nodeValue = r;
  }
  function attrs(el) {
    if (el.closest(SKIP)) return;
    for (const a of ATTRS) { const v = el.getAttribute(a); if (!v) continue; const r = lookup(v); if (r === undefined) waiting.add(el); else if (r !== null && r !== v) el.setAttribute(a, r); }
  }
  function walk(root) {
    if (root.nodeType === 3) return textNode(root);
    if (root.nodeType !== 1 || root.matches(SKIP)) return;
    attrs(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: n => (n.nodeType === 1 && n.matches(SKIP)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    while (w.nextNode()) { const n = w.currentNode; if (n.nodeType === 3) textNode(n); else attrs(n); }
  }
  let saveT = 0;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { const arr = [...cache].slice(-6000); store.set(KEY, JSON.stringify(arr)); }, 800); };
  let flushT = 0, first = true, running = 0;
  const kick = () => { if (!flushT) flushT = setTimeout(flush, 90); };
  async function flush() {
    flushT = 0;
    if (running >= 3) { kick(); return; }
    const batch = [...queue].filter(k => !inflight.has(k)).slice(0, 40);
    batch.forEach(k => queue.delete(k));
    if (!batch.length) { if (!running) reveal(); return; }
    running++; if (queue.size) kick();
    batch.forEach(k => inflight.add(k));
    try {
      const r = await fetch('/api/luch/i18n', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang, texts: batch }) });
      const j = await r.json();
      if (r.ok && Array.isArray(j.tr)) { batch.forEach((k, i) => { const t = j.tr[i]; cache.set(k, t); done.add(t); }); save(); }
    } catch (e) {}
    batch.forEach(k => inflight.delete(k)); running--;
    const ws = [...waiting]; waiting.clear();
    ws.forEach(n => { if (n.isConnected) (n.nodeType === 3 ? textNode(n) : attrs(n)); });
    { const tt = lookup(document.title); if (tt) document.title = tt; }
    if (queue.size) kick(); else if (!running) reveal();
  }
  function reveal() { if (first) { first = false; document.documentElement.classList.remove('li-wait'); } }
  // первая отрисовка: прячем страницу, пока не подставим перевод (не дольше 2,5 с)
  document.documentElement.classList.add('li-wait');
  setTimeout(reveal, 2500);
  const start = () => {
    walk(document.body);
    const title = document.title; const t = lookup(title); if (t) document.title = t;
    new MutationObserver(ms => {
      for (const m of ms) {
        if (m.type === 'characterData') textNode(m.target);
        else if (m.type === 'attributes') attrs(m.target);
        else m.addedNodes.forEach(walk);
      }
      if (queue.size) kick();
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    new MutationObserver(() => { const t = lookup(document.title); if (t && t !== document.title) document.title = t; if (queue.size) kick(); }).observe(document.querySelector('title') || document.head, { childList: true, subtree: true, characterData: true });
    if (queue.size) kick(); else reveal();
  };
  api.pending = () => queue.size + inflight.size + waiting.size;
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();

// ---------- дата и время справа в шапке ----------
(() => {
  const mount = () => {
    const header = document.querySelector('header'); if (!header || header.querySelector('.oe-clock')) return;
    const st = document.createElement('style');
    st.textContent = `.oe-clock{flex:none;text-align:right;font:500 12px/1.45 "IBM Plex Mono",ui-monospace,monospace;color:var(--muted,#8b96ad);font-variant-numeric:tabular-nums;letter-spacing:.02em}
      .oe-clock b{display:block;font-weight:500;color:var(--fg,#e8ecf4);font-size:13px}
      @media (max-width:600px){.oe-clock{display:none}}`;
    document.head.appendChild(st);
    const c = document.createElement('div'); c.className = 'oe-clock'; c.setAttribute('aria-hidden', 'true'); c.dataset.noi18n = '';
    header.appendChild(c);
    const M = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    const p2 = n => String(n).padStart(2, '0');
    const tick = () => { const d = new Date(); c.innerHTML = `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()}<b>${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}</b>`; };
    tick(); setInterval(tick, 1000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();

(() => {
  if (window.__luchTutor) return; window.__luchTutor = true;
  const KEY = 'luch-tutor-chat';
  const page = location.pathname.replace(/\/+$/, '') || '/';
  const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

  const css = `
  .lt-btn{position:fixed;right:calc(18px + env(safe-area-inset-right,0px));bottom:calc(18px + env(safe-area-inset-bottom,0px));z-index:50;display:flex;align-items:center;flex-direction:row-reverse;gap:0;background:#e8ecf4;color:#0b1019;border:0;border-radius:999px;padding:5px;font:500 13.5px/1.3 "Golos Text",system-ui,sans-serif;cursor:pointer;box-shadow:0 10px 30px -8px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.08);text-align:left;max-width:calc(100vw - 36px);transition:transform .15s}
  .lt-btn:hover{transform:translateY(-1px)}
  .lt-btn .lt-av{width:44px;height:44px;flex:none}
  .lt-btn .lt-bt{display:none;padding:0 6px 0 12px;max-width:270px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
  .lt-btn:not(.tip-open) .lt-bt{display:none}
  .lt-btn .lt-dot{position:absolute;top:3px;right:3px;width:11px;height:11px;border-radius:50%;background:#ff8a3c;box-shadow:0 0 0 2px #e8ecf4;display:none}
  .lt-btn.has-tip .lt-dot{display:block;animation:lt-dotp 1.6s ease-in-out infinite}
  @keyframes lt-dotp{50%{transform:scale(1.25)}}
  .lt-panel{position:fixed;right:calc(18px + env(safe-area-inset-right,0px));bottom:calc(18px + env(safe-area-inset-bottom,0px));z-index:51;width:min(360px,calc(100vw - 36px));min-height:180px;max-height:min(480px,calc(100vh - 36px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px)));display:flex;flex-direction:column;background:#121a28;border:1px solid #26324a;border-radius:18px;box-shadow:0 24px 60px -12px rgba(0,0,0,.75);color:#e8ecf4;font:15px/1.5 "Golos Text",system-ui,sans-serif;overflow:hidden}
  .lt-head{display:flex;align-items:center;gap:8px;padding:7px 7px 7px 10px;border-bottom:1px solid #26324a}
  .lt-head .lt-av{width:28px;height:28px;flex:none}
  .lt-head b{display:block;font-size:14px}
  .lt-head .lt-ib{width:30px;padding:0;justify-content:center;border-color:transparent}
  .lt-head .lt-ib:hover{border-color:#26324a}
  .lt-head .lt-stop{width:auto;padding:0 11px;background:#ffb547;color:#0b1019;border:0;font-weight:700;animation:lt-stp 1.2s ease-out infinite}
  .lt-head .lt-stop[hidden]{display:none}
  @keyframes lt-stp{0%{box-shadow:0 0 0 0 rgba(255,181,71,.65)}100%{box-shadow:0 0 0 10px rgba(255,181,71,0)}}
  .lt-orb[data-s="speaking"] svg{display:none}
  .lt-orb[data-s="speaking"]:after{content:"";position:absolute;inset:0;margin:auto;width:14px;height:14px;border-radius:3px;background:#0b1019}
  .lt-head span{display:block;font:500 11px/1.3 "IBM Plex Mono",monospace;color:#8b96ad}
  .lt-head .lt-sp{flex:1;min-width:0}
  .lt-ib{background:none;border:1px solid #26324a;border-radius:8px;height:30px;padding:0 9px;color:#8b96ad;cursor:pointer;font:500 12px "Golos Text",sans-serif;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
  .lt-ib:hover{color:#e8ecf4;border-color:#8b96ad}
  .lt-ib.on{background:#72d4e8;border-color:#72d4e8;color:#0b1019}
  .lt-log{flex:1 1 auto;min-height:0;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;overscroll-behavior:contain}
  .lt-m{max-width:88%;padding:9px 12px;border-radius:14px;font-size:14px;line-height:1.5;overflow-wrap:anywhere}
  .lt-m.u{align-self:flex-end;background:#e8ecf4;color:#0b1019;border-bottom-right-radius:5px}
  .lt-m.a{align-self:flex-start;background:#1a2438;border-bottom-left-radius:5px}
  .lt-m.a p{margin:0 0 7px}.lt-m.a p:last-child{margin:0}
  .lt-m.a ul{margin:4px 0 7px;padding-left:18px}
  .lt-m.a code{font:500 13px "IBM Plex Mono",monospace;background:#0b1019;padding:1px 5px;border-radius:5px}
  .lt-panel,.lt-board,.lt-btn{transition:opacity .3s}
  .lt-peek{opacity:.1!important;pointer-events:none!important}
  .lt-m .lt-say{display:inline-flex;margin:6px 14px 0 0;background:none;border:0;padding:0;color:#8b96ad;font:500 11.5px "Golos Text",sans-serif;cursor:pointer;gap:5px;align-items:center}
  .lt-m .lt-say:hover{color:#72d4e8}
  .lt-dots{display:inline-flex;gap:4px;padding:4px 0}
  .lt-dots i{width:6px;height:6px;border-radius:50%;background:#8b96ad;animation:lt-b 1s infinite}
  .lt-dots i:nth-child(2){animation-delay:.15s}.lt-dots i:nth-child(3){animation-delay:.3s}
  @keyframes lt-b{0%,80%,100%{opacity:.3;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}
  .lt-hello{color:#8b96ad;font-size:13.5px;line-height:1.5;padding:2px 2px 4px}
  .lt-hello b{color:#e8ecf4;display:block;font-size:15px;margin-bottom:4px}
  .lt-sug{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 10px}
  .lt-sug button{background:#1a2438;border:1px solid #26324a;border-radius:9px;padding:6px 10px;font:500 12.5px/1.3 "Golos Text",sans-serif;color:#e8ecf4;cursor:pointer;text-align:left}
  .lt-sug button:hover{border-color:#72d4e8}
  .lt-form{display:flex;gap:8px;align-items:flex-end;padding:10px;border-top:1px solid #26324a}
  .lt-form textarea{flex:1;min-width:0;resize:none;max-height:120px;background:#0b1019;border:1px solid #26324a;border-radius:12px;padding:10px 12px;color:#e8ecf4;font:14px/1.4 "Golos Text",sans-serif;outline:none}
  .lt-form textarea:focus{border-color:#72d4e8}
  .lt-send,.lt-mic{width:42px;height:42px;flex:none;border:0;border-radius:12px;cursor:pointer;display:grid;place-items:center}
  .lt-send{background:#ffb547;color:#0b1019}
  .lt-send:disabled{opacity:.4;cursor:default}
  .lt-mic{background:#1a2438;color:#e8ecf4;border:1px solid #26324a}
  .lt-mic.rec{background:#ff6b5a;border-color:#ff6b5a;color:#0b1019;animation:lt-p 1.2s infinite}
  @keyframes lt-p{0%{box-shadow:0 0 0 0 rgba(255,107,90,.5)}100%{box-shadow:0 0 0 12px rgba(255,107,90,0)}}
  .lt-voice{border-top:1px solid #26324a;padding:10px 10px 10px 12px;display:flex;align-items:center;gap:10px}
  .lt-voice[hidden]{display:none}
  .lt-vtx{flex:1;min-width:0}
  .lt-orb{width:44px;height:44px;flex:none;border-radius:50%;border:0;cursor:pointer;position:relative;background:radial-gradient(circle at 40% 35%,#9fe6f3,#2b9fb5 60%,#14495a);box-shadow:0 0 0 0 rgba(114,212,232,.5)}
  .lt-orb[data-s="listening"]{animation:lt-o 1.3s infinite;background:radial-gradient(circle at 40% 35%,#ffd59a,#ffb547 55%,#8a5212)}
  .lt-orb[data-s="thinking"]{background:radial-gradient(circle at 40% 35%,#c9f1fa,#5fc3d8 60%,#1f6f82)}
  .lt-orb[data-s="thinking"] svg{display:none}
  .lt-orb[data-s="thinking"]:before{content:"";position:absolute;inset:-4px;border-radius:50%;background:conic-gradient(from 0deg,transparent 0 50%,rgba(255,181,71,.2) 62%,#ffb547 88%,#fff6e6 100%);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 3.5px),#000 calc(100% - 3px));mask:radial-gradient(farthest-side,transparent calc(100% - 3.5px),#000 calc(100% - 3px));animation:lt-spin .95s linear infinite}
  .lt-orb[data-s="thinking"]:after{content:"";position:absolute;inset:0;margin:auto;width:6px;height:6px;border-radius:50%;background:#0b1019;animation:lt-think .9s ease-in-out infinite}
  @keyframes lt-think{0%,100%{transform:translateY(2px);box-shadow:-9px -3px 0 #0b1019,9px 1px 0 #0b1019}33%{transform:translateY(-3px);box-shadow:-9px 2px 0 #0b1019,9px -2px 0 #0b1019}66%{transform:translateY(0);box-shadow:-9px -1px 0 #0b1019,9px -4px 0 #0b1019}}
  .lt-orb[data-s="speaking"]{animation:lt-o 0.9s infinite}
  .lt-orb[data-s="idle"]{opacity:.75}
  .lt-orb svg{position:absolute;inset:0;margin:auto}
  @keyframes lt-o{0%{box-shadow:0 0 0 0 rgba(255,255,255,.35)}100%{box-shadow:0 0 0 10px rgba(255,255,255,0)}}
  @keyframes lt-spin{to{transform:rotate(360deg)}}
  .lt-vs{font:600 13.5px/1.3 "Golos Text",sans-serif}
  .lt-vh{font:500 12px/1.35 "Golos Text",sans-serif;color:#8b96ad;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .lt-vh:empty{display:none}
  .lt-vrow{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center}
  .lt-lang{display:inline-flex;border:1px solid #26324a;border-radius:8px;overflow:hidden}
  .lt-lang button{background:none;border:0;color:#8b96ad;font:600 12px "Golos Text",sans-serif;padding:6px 10px;cursor:pointer}
  .lt-lang button[aria-pressed="true"]{background:#e8ecf4;color:#0b1019}
  .lt-btn:focus-visible,.lt-ib:focus-visible,.lt-send:focus-visible,.lt-mic:focus-visible,.lt-orb:focus-visible,.lt-sug button:focus-visible{outline:2px solid #72d4e8;outline-offset:2px}
  .lt-hl{position:fixed;z-index:58;pointer-events:none;border:3px solid #ffd166;border-radius:12px;box-shadow:0 0 0 4px rgba(255,209,102,.22),0 0 28px rgba(255,209,102,.5);opacity:0;transition:opacity .3s,left .2s,top .2s}
  .lt-hl.on{opacity:1;animation:lt-hlp 1s ease-in-out 3}
  @keyframes lt-hlp{50%{box-shadow:0 0 0 10px rgba(255,209,102,.1),0 0 40px rgba(255,209,102,.75)}}
  .lt-drawing{margin-top:8px;font:500 12px "IBM Plex Mono",monospace;color:#ffd166}
  .lt-board{position:fixed;z-index:52;right:calc(430px + env(safe-area-inset-right,0px));bottom:calc(18px + env(safe-area-inset-bottom,0px));width:min(640px,calc(100vw - 466px));background:#1e2b25;border:1px solid #33463b;border-radius:16px;box-shadow:0 24px 60px -12px rgba(0,0,0,.75);display:flex;flex-direction:column;overflow:hidden;color:#f4f1e8;font:14px/1.4 "Golos Text",system-ui,sans-serif}
  .lt-bh{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #33463b;flex-wrap:wrap}
  .lt-bh b{font:500 14px "Unbounded","Golos Text",sans-serif;margin-right:auto}
  .lt-pens{display:flex;gap:6px}
  .lt-pens button{width:22px;height:22px;border-radius:50%;border:2px solid transparent;background:var(--c);cursor:pointer}
  .lt-pens button[aria-pressed="true"]{border-color:#fff;box-shadow:0 0 0 2px #1e2b25 inset}
  .lt-board .lt-ib{background:rgba(255,255,255,.08);color:#f4f1e8}
  .lt-bb{position:relative;aspect-ratio:480/300;background:radial-gradient(120% 90% at 30% 20%,#2a3a32,#1b2621);}
  .lt-bb svg,.lt-bb canvas{position:absolute;inset:0;width:100%;height:100%}
  .lt-bb canvas{touch-action:none;cursor:crosshair}
  .lt-bb svg text{font-family:"Caveat",cursive;font-weight:700}
  .lt-bb svg *{stroke-linecap:round;stroke-linejoin:round}
  .lt-bf{padding:8px 12px;font-size:12px;color:#a9b8ae}
  @media (max-width:1100px){.lt-board{left:12px;right:12px;width:auto;top:calc(12px + env(safe-area-inset-top,0px));bottom:auto}}
  @media (max-width:600px){
    .lt-board{left:0;right:0;top:0;border-radius:0 0 16px 16px}
    body.lt-board-on .lt-panel{max-height:min(48vh,420px)}
    .lt-bf{display:none}
    .lt-panel{right:0;left:0;bottom:0;width:100%;max-height:min(70vh,560px);border-radius:18px 18px 0 0;padding-bottom:env(safe-area-inset-bottom,0px)}
    .lt-btn{opacity:.96;bottom:calc(92px + env(safe-area-inset-bottom,0px))}
    .lt-btn .lt-bt{max-width:calc(100vw - 110px)}
    .lt-ib .lt-tx{display:none}
  }
  @media (prefers-reduced-motion:reduce){.lt-dots i,.lt-orb,.lt-orb:before,.lt-orb:after,.lt-mic.rec,.lt-head .lt-stop{animation:none!important}.lt-btn:hover{transform:none}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  try { let ic = document.querySelector('link[rel~="icon"]'); if (!ic) { ic = document.createElement('link'); ic.rel = 'icon'; document.head.appendChild(ic); } ic.type = 'image/svg+xml'; ic.href = '/luch/owl.svg'; } catch (e) {}
  const AV = '<svg class="lt-av" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="19.5" fill="#0b1019"/><g transform="translate(3.6 3.4) scale(.82)"><path d="M9.6 14.6 9.2 6.2 15 10.6Q20 9.4 25 10.6L30.8 6.2 30.4 14.6Q34.6 22 31.6 29Q27.6 36 20 36Q12.4 36 8.4 29Q5.4 22 9.6 14.6Z" fill="#ffb547"/><path d="M20 14Q15.2 10.8 10.9 13.4Q7.6 17.2 9.4 21.8Q11.6 25.8 15.9 25.4Q18.5 25.1 20 27.1Q21.5 25.1 24.1 25.4Q28.4 25.8 30.6 21.8Q32.4 17.2 29.1 13.4Q24.8 10.8 20 14Z" fill="#ffd896"/><circle cx="15" cy="18.8" r="5" fill="#fffaf0"/><circle cx="25" cy="18.8" r="5" fill="#fffaf0"/><circle cx="15.6" cy="19.2" r="2.9" fill="#0b1019"/><circle cx="24.4" cy="19.2" r="2.9" fill="#0b1019"/><circle cx="16.6" cy="18.1" r="1" fill="#fff"/><circle cx="25.4" cy="18.1" r="1" fill="#fff"/><path d="M18.6 23.4h2.8L20 26.6z" fill="#ff8a73"/><path d="M10.5 29.6Q15.3 27.4 20 29.7Q24.7 27.4 29.5 29.6V34.6Q24.7 32.6 20 34.8Q15.3 32.6 10.5 34.6Z" fill="#72d4e8"/><path d="M20 29.7V34.8" stroke="#0b1019" stroke-width="1.1"/><path d="M8.2 23.5Q5.6 28.6 9.4 32.6Q11.6 33.2 12.4 31Q10.4 28.4 8.2 23.5Z" fill="#e8962a"/><path d="M31.8 23.5Q34.4 28.6 30.6 32.6Q28.4 33.2 27.6 31Q29.6 28.4 31.8 23.5Z" fill="#e8962a"/><path d="M35 3.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" fill="#86e0a8"/></g></svg>';
  const MIC = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="6" y="1.5" width="6" height="10" rx="3" fill="currentColor"/><path d="M3.5 8.5a5.5 5.5 0 0 0 11 0M9 14v2.5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>';
  const WAVE = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 5v4M5 3v8M8 1.5v11M11 4v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const SPK = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M1 4.5h2.5L7 1.5v9L3.5 7.5H1z" fill="currentColor"/><path d="M9 3.5a3.5 3.5 0 0 1 0 5" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round"/></svg>';

  let chat = [];
  try { chat = JSON.parse(ls.get(KEY) || '[]') || []; } catch (e) { chat = []; }
  const saveChat = () => ls.set(KEY, JSON.stringify(chat.slice(-30)));
  // язык речи и ответов = язык сайта (переключатель в шапке)
  const lang = (window.LuchI18n && window.LuchI18n.lang) || 'ru';
  const LOCALE = { ru: 'ru-RU', en: 'en-US', kk: 'kk-KZ', es: 'es-ES' }[lang] || 'ru-RU';

  const btn = document.createElement('button');
  btn.className = 'lt-btn'; btn.type = 'button'; btn.setAttribute('aria-label', 'Спросить наставника');
  btn.innerHTML = `${AV}<span class="lt-bt"></span><i class="lt-dot"></i>`; btn.title = 'Наставник: поможет с заданием';
  const panel = document.createElement('section');
  panel.className = 'lt-panel'; panel.hidden = true; panel.setAttribute('aria-label', 'ИИ-наставник');
  panel.innerHTML = `
    <div class="lt-head">${AV}<div class="lt-sp"><b>Наставник</b></div>
      <button class="lt-ib" id="lt-vm" type="button" aria-pressed="false" title="Разговор голосом" hidden>${WAVE}<span class="lt-tx">Голосом</span></button>
      <button class="lt-ib" id="lt-bd" type="button" title="Доска: рисовать и показывать наставнику" aria-label="Доска">✎</button>
      <button class="lt-ib lt-stop" id="lt-stop" type="button" title="Остановить озвучку (или скажите «стоп»)" hidden>■ Стоп</button>
      <button class="lt-ib" id="lt-close" type="button" aria-label="Свернуть">✕</button></div>
    <div class="lt-log" id="lt-log" aria-live="polite"></div>
    <div class="lt-sug" id="lt-sug"></div>
    <form class="lt-form" id="lt-form">
      <button class="lt-mic" id="lt-mic" type="button" aria-label="Надиктовать вопрос" title="Надиктовать вопрос">${MIC}</button>
      <textarea id="lt-in" rows="1" placeholder="Спросите что угодно…" aria-label="Вопрос наставнику"></textarea>
      <button class="lt-send" id="lt-send" type="submit" aria-label="Отправить"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 9h11M9.5 4.5L14 9l-4.5 4.5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button></form>
    <div class="lt-voice" id="lt-voice" hidden>
      <button class="lt-orb" id="lt-orb" type="button" data-s="idle" aria-label="Говорить"><svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true"><rect x="6" y="1.5" width="6" height="10" rx="3" fill="#0b1019"/><path d="M3.5 8.5a5.5 5.5 0 0 0 11 0M9 14v2.5" stroke="#0b1019" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg></button>
      <div class="lt-vtx"><div class="lt-vs" id="lt-vs">Нажмите и говорите</div><div class="lt-vh" id="lt-vh"></div></div>
      <button class="lt-ib" id="lt-vend" type="button" title="Написать текстом">⌨<span class="lt-tx">Написать</span></button>
    </div>`;
  document.body.append(btn, panel);
  const $ = s => panel.querySelector(s);
  const log = $('#lt-log'), inp = $('#lt-in'), send = $('#lt-send'), sug = $('#lt-sug'), mic = $('#lt-mic');
  const form = $('#lt-form'), voiceBox = $('#lt-voice'), orb = $('#lt-orb'), vs = $('#lt-vs'), vh = $('#lt-vh'), vmBtn = $('#lt-vm');

  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function md(text) {
    const lines = esc(text).split(/\n/);
    let out = '', inList = false, para = [];
    const inline = s => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
    const flush = () => { if (para.length) { out += `<p>${inline(para.join('<br>'))}</p>`; para = []; } };
    for (const l of lines) {
      const m = l.match(/^\s*[-•*]\s+(.*)/);
      if (m) { flush(); if (!inList) { out += '<ul>'; inList = true; } out += `<li>${inline(m[1])}</li>`; continue; }
      if (inList) { out += '</ul>'; inList = false; }
      if (!l.trim()) flush(); else para.push(l);
    }
    flush(); if (inList) out += '</ul>';
    return out;
  }
  const sayBtn = text => { const b = document.createElement('button'); b.type = 'button'; b.className = 'lt-say'; b.innerHTML = `${SPK}Озвучить`; b.onclick = () => { unlockAudio(); speaker.stop(); speaker.add(text); speaker.end(); }; return b; };
  const bubble = (role, text, withSay) => {
    const d = document.createElement('div'); d.className = 'lt-m ' + (role === 'user' ? 'u' : 'a');
    if (role === 'user') d.textContent = text; else { d.innerHTML = md(shown(text)); boardBtn(d, text); if (withSay && text) d.appendChild(sayBtn(shown(text))); }
    log.appendChild(d); return d;
  };
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  function boardBtn(d, text) { const bs = split(text, true).boards; if (!bs.length) return; const b = document.createElement('button'); b.type = 'button'; b.className = 'lt-say'; b.textContent = '✎ Показать на доске'; b.onclick = () => bs.forEach((x, i) => board.draw(x, i > 0)); d.appendChild(b); }

  let busy = false, ctrl = null, voiceMode = false;
  let tipChips = [];
  function suggestions() {
    if (tipChips.length) {
      sug.innerHTML = tipChips.map((c, i) => `<button type="button" data-tc="${i}">${esc(c[0])}</button>`).join('') + '<button type="button" data-ant="1">💡 Помоги</button>';
      sug.hidden = busy; return;
    }
    let list = [];
    try { list = (window.LUCH_SUGGEST && window.LUCH_SUGGEST()) || []; } catch (e) {}
    if (!list.length) list = ['Объясни, что сейчас происходит в опыте', 'С чего начать?'];
    sug.innerHTML = '<button type="button" data-ant="1">💡 Помоги</button>' + list.slice(0, 2).map(q => `<button type="button">${esc(q)}</button>`).join('');
    sug.hidden = busy || voiceMode;
  }
  function render() {
    log.innerHTML = '';
    if (!chat.length) {
      const h = document.createElement('div'); h.className = 'lt-hello';
      h.innerHTML = '<b>Привет! Я твой наставник 🙂</b>Вижу экран и что ты делаешь. Спроси голосом или нажми «💡 Помоги».';
      log.appendChild(h);
    }
    chat.forEach(m => bubble(m.role, m.show || m.content, m.role === 'assistant'));
    suggestions(); scroll();
  }

  // ---------- speaking: server voice (Gemini), browser voice if that fails ----------
  let audio = null, unlocked = false;
  function unlockAudio() {
    if (!audio) audio = new Audio();
    if (unlocked) return; unlocked = true;
    try { audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA='; audio.play().catch(() => {}); } catch (e) {}
    try { if (window.speechSynthesis) speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch (e) {}
  }
  const clean = t => t.replace(/\s*\[\[\d{1,3}\]\]/g, '').replace(/\*\*|`|#+\s/g, '').replace(/^\s*[-•*]\s+/gm, '').replace(/·/g, ' на ').replace(/\s+/g, ' ').trim();
  function browserSay(text) {
    return new Promise(res => {
      if (!window.speechSynthesis) return res();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = LOCALE;
      const v = speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith(lang));
      if (v) u.voice = v;
      u.onend = u.onerror = () => res();
      speechSynthesis.speak(u);
    });
  }
  let spoken = '';
  const speaker = (() => {
    let queue = [], gen = 0, running = false, ended = true, waiters = [];
    const fetchWav = text => fetch('/api/tutor/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
      .then(r => r.ok ? r.blob() : null).catch(() => null);
    const done = () => { if (!queue.length && ended && !running) { const w = waiters; waiters = []; w.forEach(f => f()); } };
    async function run(g) {
      if (running) return; running = true;
      while (queue.length && g === gen) {
        const item = queue.shift();
        const blob = await item.p;
        if (g !== gen) break;
        (item.marks || []).forEach(n => highlight(n));
        if (blob && blob.size > 100) {
          const url = URL.createObjectURL(blob);
          await new Promise(res => { audio.onended = audio.onerror = res; audio.src = url; audio.play().catch(res); });
          URL.revokeObjectURL(url);
        } else await browserSay(item.text);
        if (voiceMode && !queue.length && !ended) setVoice('speaking');
      }
      running = false; done();
    }
    return {
      add(text) { const marks = marksOf(text); text = clean(text); if (!text) { marks.forEach(n => highlight(n)); return; } ended = false; spoken = (spoken + ' ' + text).slice(-1500); queue.push({ text, marks, p: fetchWav(text) }); run(gen); },
      end() { ended = true; done(); },
      stop() { gen++; queue = []; ended = true; running = false; try { audio && audio.pause(); } catch (e) {} try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {} done(); },
      idle() { return new Promise(res => { waiters.push(res); done(); }); },
      get busy() { return running || queue.length > 0; },
    };
  })();
  // cut the streaming answer into sentences so speech starts before the answer is complete
  function sentenceFeeder() {
    let said = 0;
    return (text, final) => {
      for (;;) {
        const rest = text.slice(said), re = /[.!?…](?=\s)|\n/g;
        let m, cut = -1;
        while ((m = re.exec(rest))) if (m.index + 1 >= 28) { cut = m.index + 1; break; }
        if (cut < 0) break;
        speaker.add(rest.slice(0, cut)); said += cut;
      }
      if (final && said < text.length) { speaker.add(text.slice(said)); said = text.length; }
    };
  }

  // ---------- listening: browser recognition, or record and let the server transcribe ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function listenBrowser(onInterim) {
    let rec, stopFn;
    const p = new Promise((resolve, reject) => {
      rec = new SR(); rec.lang = LOCALE; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
      let fin = '', heard = '';
      rec.onresult = e => { let interim = ''; fin = ''; for (const r of e.results) { if (r.isFinal) fin += r[0].transcript; else interim += r[0].transcript; } heard = (fin + ' ' + interim).trim(); onInterim && onInterim(heard); };
      rec.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') reject(new Error('mic')); };
      rec.onend = () => resolve((fin || heard).trim());
      try { rec.start(); } catch (e) { reject(e); }
      stopFn = () => { try { rec.stop(); } catch (e) {} };
    });
    return { p, stop: () => stopFn && stopFn(), abort: () => { try { rec.onend = null; rec.abort(); } catch (e) {} } };
  }
  function listenRecorder(onLevel) {
    let stopFlag = false, aborted = false, cleanup = () => {};
    const p = (async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).catch(() => { throw new Error('mic'); });
      const AC = window.AudioContext || window.webkitAudioContext, ac = new AC();
      const src = ac.createMediaStreamSource(stream), proc = ac.createScriptProcessor(4096, 1, 1);
      const chunks = []; let speech = false, lastLoud = 0; const t0 = performance.now();
      cleanup = () => { try { proc.disconnect(); src.disconnect(); } catch (e) {} stream.getTracks().forEach(t => t.stop()); ac.close().catch(() => {}); };
      await new Promise(res => {
        proc.onaudioprocess = e => {
          const d = e.inputBuffer.getChannelData(0); let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] * d[i];
          const rms = Math.sqrt(s / (d.length / 4)), now = performance.now();
          onLevel && onLevel(rms);
          if (rms > 0.02) { speech = true; lastLoud = now; }
          if (speech || chunks.length < 4) chunks.push(new Float32Array(d));
          if (stopFlag || aborted || (speech && now - lastLoud > 1300) || (!speech && now - t0 > 9000) || now - t0 > 28000) res();
        };
        src.connect(proc); proc.connect(ac.destination);
      });
      const rate = ac.sampleRate; cleanup();
      if (aborted || !speech) return '';
      const wav = encodeWav(chunks, rate, 16000);
      const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(wav); });
      const res = await fetch('/api/tutor/stt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audio: b64, mime: 'audio/wav' }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'stt');
      return (j.text || '').trim();
    })();
    return { p, stop: () => { stopFlag = true; }, abort: () => { aborted = true; } };
  }
  function encodeWav(chunks, inRate, outRate) {
    const len = chunks.reduce((a, c) => a + c.length, 0), ratio = inRate / outRate, n = Math.floor(len / ratio);
    const all = new Float32Array(len); let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
    const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (p, s) => { for (let i = 0; i < s.length; i++) v.setUint8(p + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, outRate, true); v.setUint32(28, outRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) { const s = Math.max(-1, Math.min(1, all[Math.floor(i * ratio)])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
    return new Blob([buf], { type: 'audio/wav' });
  }
  const canListen = !!(SR || (navigator.mediaDevices && navigator.mediaDevices.getUserMedia));
  const MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  function listen(onInterim) { return SR && !MOBILE ? listenBrowser(onInterim) : listenRecorder(); }
  const micError = e => e && e.message === 'mic'
    ? 'Нет доступа к микрофону. Разрешите его в настройках браузера (значок замка у адреса сайта).'
    : 'Не получилось распознать речь. Попробуйте ещё раз.';

  // ---------- указка: подсветка частей страницы по меткам [[n]] в ответе ----------
  let pageEls = [];
  const visible = el => { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; for (let e = el; e && e !== document.body; e = e.parentElement) { if (e.hidden || getComputedStyle(e).display === 'none' || getComputedStyle(e).visibility === 'hidden') return false; } return true; };
  const txt = el => (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();
  function collectElements() {
    const seen = new Set(), out = [];
    const add = (el, kind, label) => { label = (label || '').slice(0, 60); if (!label || seen.has(el) || out.length >= 70) return; if (el.closest('.lt-panel,.lt-btn,.lt-board,.ls-toast')) return; if (!visible(el)) return; seen.add(el); out.push({ el, d: `${kind}: ${label}` }); };
    const q = s => [...document.querySelectorAll(s)];
    q('.ls-tabs .g').forEach(e => add(e, 'вкладка', txt(e)));
    q('h1, h2, h3').forEach(e => add(e, 'заголовок', txt(e)));
    q('[class*="task"], [class*="readout"], [class*="hint"]').filter(e => txt(e).length > 8 && !e.querySelector('[class*="task"],[class*="readout"]')).forEach(e => add(e, 'блок', txt(e)));
    q('.lessons button, .lessons .lesson').forEach(e => add(e, 'урок в ленте', txt(e)));
    q('label').forEach(e => add(e, 'ползунок/поле', txt(e)));
    q('button').forEach(e => add(e, 'кнопка', txt(e)));
    const texts = new Map();
    q('svg text').forEach(e => { const t = txt(e); if (t && t.length <= 40 && !texts.has(t)) { texts.set(t, 1); add(e, 'на стенде', t); } });
    q('svg [data-id], svg [id]').forEach(e => { const id = e.getAttribute('data-id') || e.id; if (id && !/^(arr|grad|clip|mask|f\d|lg)/i.test(id)) add(e, 'деталь стенда', id); });
    pageEls = out;
    return out.map((x, i) => `[${i + 1}] ${x.d}`).join('\n');
  }
  let hlBox = null, hlTimer = 0;
  function highlight(n) {
    const it = pageEls[n - 1]; if (!it || !document.contains(it.el)) return;
    highlightEl(it.el);
  }
  const overlap = (a, r) => r.left < a.right && r.right > a.left && r.top < a.bottom && r.bottom > a.top;
  function peekOver(el) {
    if (!el || !document.contains(el)) return;
    const r = el.getBoundingClientRect();
    for (const w of [panel, btn, document.querySelector('.lt-board:not([hidden])'), document.querySelector('.lt-tip')]) {
      if (!w || w.hidden || !overlap(w.getBoundingClientRect(), r)) continue;
      w.classList.add('lt-peek'); w._peekAt = Date.now(); clearTimeout(w._peek);
      w._peek = setTimeout(() => w.classList.remove('lt-peek'), 5000);
    }
  }
  // вернуть панель сразу: касание экрана или мышь над панелью
  const unpeek = () => document.querySelectorAll('.lt-peek').forEach(w => { clearTimeout(w._peek); w.classList.remove('lt-peek'); });
  document.addEventListener('pointermove', e => { const w = document.querySelector('.lt-panel.lt-peek'); if (w && e.pointerType === 'mouse') { const a = w.getBoundingClientRect(); if (e.clientX > a.left && e.clientX < a.right && e.clientY > a.top && e.clientY < a.bottom && Date.now() - (w._peekAt || 0) > 1200) unpeek(); } }, { passive: true });
  document.addEventListener('pointerdown', () => setTimeout(unpeek, 250), { passive: true, capture: true });
  function highlightEl(el) {
    if (!el || !document.contains(el)) return;
    const r0 = el.getBoundingClientRect();
    if (r0.top < 60 || r0.bottom > innerHeight - 40) el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth' });
    if (!hlBox) { hlBox = document.createElement('div'); hlBox.className = 'lt-hl'; document.body.appendChild(hlBox); }
    const place = () => { const r = el.getBoundingClientRect(), p = 6; Object.assign(hlBox.style, { left: r.left - p + 'px', top: r.top - p + 'px', width: r.width + p * 2 + 'px', height: r.height + p * 2 + 'px' }); };
    place(); hlBox.classList.remove('on'); void hlBox.offsetWidth; hlBox.classList.add('on');
    // панель, доска или облачко закрывают подсвеченное место — делаем их прозрачными на время подсветки
    peekOver(el); setTimeout(() => peekOver(el), 500);
    clearInterval(hlTimer); let k = 0; hlTimer = setInterval(() => { place(); if (++k > 60) { clearInterval(hlTimer); hlBox.classList.remove('on'); } }, 80);
  }
  const MARK = /\[\[(\d{1,3})\]\]/g;
  const marksOf = t => [...t.matchAll(MARK)].map(m => +m[1]);
  // текст ответа без доски и меток; незаконченный блок доски тоже убираем
  function split(text, final) {
    const boards = []; let say = text.replace(/<board>([\s\S]*?)<\/board>/g, (m, inner) => { boards.push(inner); return '\n'; });
    const open = say.indexOf('<board'); let drawing = open >= 0;
    if (drawing) {
      // ответ оборвался посреди доски — рисуем то, что успело прийти (до последнего целого элемента)
      if (final) { const rest = say.slice(open).replace(/^<board>?/, ''); const cut = rest.lastIndexOf('>'); if (cut > 0) boards.push(rest.slice(0, cut + 1)); drawing = false; }
      say = say.slice(0, open);
    }
    return { say, boards, drawing };
  }
  const shown = t => split(t).say.replace(/[ \t]*\[\[\d{1,3}\]\]/g, '').replace(/[ \t]+\n/g, '\n').trim();

  // ---------- доска ----------
  const board = (() => {
    const NS = 'http://www.w3.org/2000/svg';
    const OK_TAGS = new Set(['line', 'path', 'circle', 'ellipse', 'rect', 'polyline', 'polygon', 'text', 'tspan', 'g']);
    const OK_ATTR = new Set(['x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'd', 'points', 'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline', 'transform', 'opacity', 'dx', 'dy']);
    let wrap = null, svg = null, layer = null, cv = null, cx = null, drawingGen = 0, pen = '#ffd166', strokes = [], cur = null;
    function ensure() {
      if (wrap) return;
      if (!document.getElementById('lt-font')) { const l = document.createElement('link'); l.id = 'lt-font'; l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&display=swap'; document.head.appendChild(l); }
      wrap = document.createElement('section'); wrap.className = 'lt-board'; wrap.hidden = true; wrap.setAttribute('aria-label', 'Доска');
      wrap.innerHTML = `<div class="lt-bh"><b>Доска</b>
          <div class="lt-pens" role="group" aria-label="Мел">${['#f4f1e8', '#ffd166', '#7fd4ff', '#ff8fa3'].map(c => `<button type="button" data-c="${c}" style="--c:${c}" aria-label="Мел ${c}"></button>`).join('')}</div>
          <button class="lt-ib" data-a="clear" type="button" title="Стереть мой рисунок">Стереть</button>
          <button class="lt-ib" data-a="send" type="button" title="Отправить рисунок наставнику">Спросить про рисунок</button>
          <button class="lt-ib" data-a="close" type="button" aria-label="Закрыть доску">✕</button></div>
        <div class="lt-bb"><svg viewBox="0 0 480 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#f4f1e8"/></marker></defs><g class="lt-layer"></g></svg><canvas></canvas></div>
        <div class="lt-bf">Рисуйте пальцем или мышкой — наставник увидит рисунок, если нажать «Спросить про рисунок».</div>`;
      document.body.appendChild(wrap);
      svg = wrap.querySelector('svg'); layer = wrap.querySelector('.lt-layer'); cv = wrap.querySelector('canvas'); cx = cv.getContext('2d');
      const pens = wrap.querySelector('.lt-pens');
      const setPen = c => { pen = c; pens.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.c === c)); };
      setPen(pen);
      pens.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setPen(b.dataset.c); });
      wrap.addEventListener('click', e => {
        const a = (e.target.closest('[data-a]') || {}).dataset; if (!a || !a.a) return;
        if (a.a === 'close') hide();
        if (a.a === 'clear') { strokes = []; paint(); }
        if (a.a === 'send') sendDrawing();
      });
      const pt = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 480, (e.clientY - r.top) / r.height * 300]; };
      cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); cur = { c: pen, p: [pt(e)] }; strokes.push(cur); paint(); });
      cv.addEventListener('pointermove', e => { if (cur) { cur.p.push(pt(e)); paint(); } });
      const up = () => { cur = null; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      new ResizeObserver(fit).observe(cv);
    }
    function fit() { const r = cv.getBoundingClientRect(), d = devicePixelRatio || 1; cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); paint(); }
    function paint(ctx = cx, w = cv.width, h = cv.height) {
      ctx.clearRect(0, 0, w, h); ctx.lineCap = ctx.lineJoin = 'round';
      for (const s of strokes) { ctx.strokeStyle = s.c; ctx.lineWidth = 3 * w / 480; ctx.beginPath(); s.p.forEach(([x, y], i) => { const X = x / 480 * w, Y = y / 300 * h; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.stroke(); }
    }
    function clean(inner) {
      const doc = new DOMParser().parseFromString(`<svg xmlns="${NS}">${inner}</svg>`, 'image/svg+xml');
      if (doc.querySelector('parsererror')) return [];
      const copy = src => {
        if (src.nodeType === 3) return document.createTextNode(src.textContent);
        if (src.nodeType !== 1 || !OK_TAGS.has(src.localName)) return null;
        const el = document.createElementNS(NS, src.localName);
        for (const a of src.attributes) { if (OK_ATTR.has(a.name) && !/url\(|javascript:/i.test(a.value)) el.setAttribute(a.name, a.value); else if (a.name === 'marker-end' && a.value === 'url(#arr)') el.setAttribute('marker-end', 'url(#arr)'); }
        if (src.localName === 'text' && !el.getAttribute('fill')) el.setAttribute('fill', '#f4f1e8');
        for (const c of src.childNodes) { const k = copy(c); if (k) el.appendChild(k); }
        return el;
      };
      return [...doc.documentElement.childNodes].map(copy).filter(n => n && n.nodeType === 1);
    }
    const reduce = () => matchMedia('(prefers-reduced-motion:reduce)').matches;
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    async function animate(el, gen) {
      const shapes = el.localName === 'g' ? [...el.querySelectorAll('*')] : [el];
      if (reduce()) return;
      for (const s of shapes) {
        if (gen !== drawingGen) return;
        if (s.localName === 'text' || s.localName === 'tspan') { s.style.opacity = 0; s.style.transition = 'opacity .45s'; requestAnimationFrame(() => { s.style.opacity = 1; }); await sleep(380); continue; }
        let len = 0; try { len = s.getTotalLength(); } catch (e) {}
        const fill = s.getAttribute('fill');
        if (len > 0) {
          if (fill && fill !== 'none') { s.style.fillOpacity = 0; }
          s.style.strokeDasharray = len; s.style.strokeDashoffset = len;
          const dur = Math.min(900, 250 + len * 1.4);
          s.style.transition = `stroke-dashoffset ${dur}ms ease-in-out, fill-opacity .3s ${dur}ms`;
          requestAnimationFrame(() => { s.style.strokeDashoffset = 0; s.style.fillOpacity = ''; });
          await sleep(dur * 0.85);
          setTimeout(() => { if (!s.getAttribute('stroke-dasharray')) s.style.strokeDasharray = ''; }, 400);
        }
      }
    }
    async function draw(inner, keep) {
      ensure(); show();
      const gen = ++drawingGen;
      if (!keep) layer.textContent = '';
      for (const el of clean(inner)) {
        if (gen !== drawingGen) return;
        if (!el.getAttribute('stroke') && el.localName !== 'text' && el.localName !== 'g') el.setAttribute('stroke', '#f4f1e8');
        layer.appendChild(el); await animate(el, gen);
      }
    }
    function show() { ensure(); wrap.hidden = false; document.body.classList.add('lt-board-on'); fit(); }
    function hide() { if (!wrap) return; wrap.hidden = true; drawingGen++; document.body.classList.remove('lt-board-on'); }
    async function snapshot() {
      const W = 960, H = 600, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
      g.fillStyle = '#1e2b25'; g.fillRect(0, 0, W, H);
      const s = svg.cloneNode(true); s.setAttribute('width', W); s.setAttribute('height', H); s.querySelectorAll('*').forEach(e => { e.style.strokeDasharray = ''; e.style.strokeDashoffset = ''; e.style.opacity = ''; e.style.fillOpacity = ''; });
      s.querySelectorAll('text').forEach(t => t.setAttribute('font-family', 'Caveat, cursive'));
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(s)], { type: 'image/svg+xml' }));
      await new Promise(res => { const im = new Image(); im.onload = () => { g.drawImage(im, 0, 0, W, H); res(); }; im.onerror = res; im.src = url; });
      URL.revokeObjectURL(url);
      paint(g, W, H);
      return c.toDataURL('image/jpeg', 0.82);
    }
    async function sendDrawing() {
      if (!strokes.length && !layer.childNodes.length) return;
      const img = await snapshot();
      const q = inp.value.trim() || 'Посмотри мой рисунок на доске. Я правильно понял(а)?';
      inp.value = '';
      if (panel.hidden) openPanel();
      ask(q, { image: img });
    }
    return { draw, show, hide, get open() { return wrap && !wrap.hidden; } };
  })();

  // ---------- asking ----------
  async function ask(q, opts = {}) {
    q = q.trim(); if (!q || busy) return '';
    busy = true; send.disabled = true; sug.hidden = true;
    if (!chat.length) log.innerHTML = '';
    chat.push({ role: 'user', content: q + (opts.image ? '\n(рисунок с доски)' : ''), show: opts.show }); bubble('user', (opts.show || q) + (opts.image ? ' 🖼' : ''));
    const a = bubble('assistant', ''); a.innerHTML = '<span class="lt-dots"><i></i><i></i><i></i></span>'; scroll();
    let context = '';
    try { context = (window.LUCH_CONTEXT && window.LUCH_CONTEXT()) || ''; } catch (e) {}
    try { const sh = window.LuchShell; if (sh && sh.whatNext) context += '\n' + sh.whatNext(); } catch (e) {}
    try { const sh = window.LuchShell; if (sh && sh.learnState) context += '\nЧто ученик уже сделал на этом уроке: ' + sh.learnState(); } catch (e) {}
    const acts = recentActions(); if (acts) context += '\nЖурнал действий ученика (от старых к новым):\n' + acts;
    const feed = opts.voice ? sentenceFeeder() : null;
    let text = '', drawn = 0; const fired = new Set();
    const elements = collectElements();
    const live = fin => {
      const sp = split(text, fin);
      a.innerHTML = md(shown(text)) + (sp.drawing ? '<div class="lt-drawing">✎ рисую на доске…</div>' : '');
      while (drawn < sp.boards.length) { board.draw(sp.boards[drawn], drawn > 0); drawn++; }
      if (!feed) for (const n of marksOf(sp.say)) if (!fired.has(n)) { fired.add(n); highlight(n); }
    };
    ctrl = new AbortController();
    try {
      const res = await fetch('/api/tutor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
        body: JSON.stringify({ page, lang, voice: !!opts.voice, context: `${document.title}\n${context}`, elements, image: opts.image || undefined, messages: chat.slice(-20).map(m => ({ role: m.role, content: m.content })) }) });
      if (!res.ok) { let msg = 'Не получилось ответить. Попробуйте ещё раз.'; try { msg = (await res.json()).error || msg; } catch (e) {} text = msg; }
      else {
        const rd = res.body.getReader(), dec = new TextDecoder();
        for (;;) {
          const { done, value } = await rd.read(); if (done) break;
          text += dec.decode(value, { stream: true }); live(); scroll();
          if (feed) { feed(split(text).say, false); if (voiceMode) setVoice('speaking'); }
        }
      }
    } catch (e) { if (e.name !== 'AbortError') text = text || 'Нет связи с сервером. Проверьте интернет и спросите ещё раз.'; }
    text = text.trim() || 'Не получилось ответить. Попробуйте ещё раз.';
    if (feed) { feed(split(text).say, true); speaker.end(); }
    live(true); const dr = a.querySelector('.lt-drawing'); if (dr) dr.remove(); boardBtn(a, text); a.appendChild(sayBtn(shown(text)));
    chat.push({ role: 'assistant', content: text }); saveChat();
    busy = false; send.disabled = false; ctrl = null; suggestions(); scroll();
    return text;
  }

  // ---------- dictation (mic next to the input) ----------
  // a question asked by voice gets an answer in text and in voice at the same time
  let dict = null, dictated = false;
  mic.hidden = !canListen;
  mic.addEventListener('click', () => { unlockAudio(); ls.set('luch-tutor-mode', 'voice'); setMode(true); });
  function flash(msg) { const d = bubble('assistant', msg); d.style.opacity = '.8'; scroll(); }

  // ---------- voice conversation ----------
  // Разговор без рук: пока панель открыта, наставник всё время слушает.
  // Тишина не выключает микрофон; выключить — нажать на кружок (и нажать снова, чтобы включить).
  let vListen = null, vState = 'idle', micOff = false, vErr = 0;
  const VS = { idle: 'Микрофон выключен · нажмите 🎤', listening: 'Слушаю · говорите в любой момент', thinking: 'Смотрю на экран…', speaking: 'Говорю · скажите «стоп» или нажмите ■' };
  function setVoice(s, hint) { vState = s; orb.dataset.s = s; vs.textContent = VS[s]; if (hint !== undefined) vh.textContent = hint; orb.setAttribute('aria-label', s === 'listening' ? 'Выключить микрофон' : s === 'idle' ? 'Включить микрофон' : 'Перебить'); }
  async function turn() {
    if (!voiceMode || busy || micOff || vListen) return;
    if (document.hidden) { setVoice('idle', 'Вернитесь на вкладку — я снова буду слушать.'); return; }
    if (mediaBusy()) { waitMedia(); return; }
    setVoice('listening', '');
    const me = vListen = listen(t => { vh.textContent = t; });
    me.media = false;
    let q = '';
    try { q = await me.p; } catch (e) {
      if (vListen === me) vListen = null;
      if (e && e.message === 'mic') { micOff = true; setVoice('idle', micError(e)); return; }
      if (++vErr > 4) { micOff = true; setVoice('idle', micError(e)); return; }
      setTimeout(turn, 600 * vErr); return;
    }
    if (vListen !== me) return; // выключили или перебили
    vListen = null; vErr = 0;
    if (me.media || mediaBusy()) { waitMedia(); return; } // это звук лекции/видео, а не ученик
    if (!voiceMode || micOff) return;
    if (!q) { setTimeout(turn, 120); return; } // тишина — просто слушаем дальше
    if (isStop(q)) { speaker.stop(); setVoice('listening', 'Хорошо, молчу. Говорите, когда нужно.'); setTimeout(turn, 120); return; }
    vh.textContent = q; setVoice('thinking');
    speaker.stop();
    await ask(q, { voice: true });
    if (!voiceMode) return;
    await speaker.idle();
    if (voiceMode && !micOff) turn();
  }
  // пока на странице звучит лекция или видео — не слушаем, иначе наставник примет их голос за ученика
  function mediaBusy() { const sh = window.LuchShell; return !!(sh && sh.mediaBusy && sh.mediaBusy()); }
  let mediaWait = 0;
  function waitMedia() {
    setVoice('idle', 'Слушаю объяснение вместе с вами — задайте вопрос, когда оно закончится или на паузе.');
    clearTimeout(mediaWait);
    mediaWait = setTimeout(function poll() { if (!voiceMode || micOff) return; if (mediaBusy()) { mediaWait = setTimeout(poll, 600); return; } if (vState === 'idle' && !busy && !vListen) turn(); }, 600);
  }
  setInterval(() => {
    if (!mediaBusy()) return;
    if (talking()) { stopTalk(); return; } // включили лекцию/видео — наставник уступает
    if (!vListen) return;
    const l = vListen; l.media = true; vListen = null; l.abort(); waitMedia();
  }, 300);
  orb.addEventListener('click', () => {
    unlockAudio();
    if (vState === 'listening') { micOff = true; const l = vListen; vListen = null; if (l) l.abort(); setVoice('idle', 'Нажмите, когда захотите снова говорить.'); return; }
    if (vState === 'speaking' || vState === 'thinking') { stopTalk(); return; }
    micOff = false; vErr = 0; turn();
  });
  // вкладку свернули — микрофон на паузе; вернулись — снова слушаем
  document.addEventListener('visibilitychange', () => {
    if (!voiceMode) return;
    if (document.hidden) { if (vListen) { const l = vListen; vListen = null; l.abort(); setVoice('idle', 'Вернитесь на вкладку — я снова буду слушать.'); } }
    else if (!micOff && vState === 'idle' && !busy) turn();
  });
  function setMode(on, quiet) {
    voiceMode = on;
    vmBtn.classList.toggle('on', on); vmBtn.setAttribute('aria-pressed', on);
    voiceBox.hidden = !on; form.hidden = on; suggestions();
    if (on && quiet) { micOff = false; vErr = 0; if (canListen) unlockAudio(); return; }
    if (on) { micOff = false; vErr = 0; if (!canListen) { setVoice('idle', 'В этом браузере нет доступа к микрофону. Откройте сайт в Chrome или Safari.'); return; } unlockAudio(); turn(); }
    else { if (vListen) { const l = vListen; vListen = null; l.abort(); } speaker.stop(); setVoice('idle', ''); }
  }
  vmBtn.addEventListener('click', () => { setMode(!voiceMode); ls.set('luch-tutor-mode', voiceMode ? 'voice' : 'text'); });
  $('#lt-vend').addEventListener('click', () => { setMode(false); ls.set('luch-tutor-mode', 'text'); setTimeout(() => inp.focus(), 30); });

  const ANT_BASE = 'Я нажал «Помоги». Не жди вопроса и не спрашивай, чем помочь. Сам пойми, что мне сейчас нужно, по всему, что знаешь: что на экране и в каком состоянии опыт, что я нажимал и выставлял (журнал действий), какие сообщения показывал опыт, прослушал ли я теорию и смотрел ли видео, сколько времени где провёл, как дела с ДЗ, и что мы уже обсуждали в этом разговоре (голосом и текстом). Найди одну самую вероятную причину, почему я застрял или что мне сейчас пригодится, и помоги точно в эту точку. Не повторяй дословно то, что уже говорил раньше. Если ошибка в понимании идеи и теорию я не слушал — объясни идею одной-двумя фразами на примере из жизни. Если всё уже сделано — коротко похвали и предложи следующий шаг (ДЗ или следующий урок). Ответ короткий: 1–3 предложения, подсвети нужное место на странице.';
  const ANT_LEVEL = ['', ' Это первая просьба о помощи: дай наводящий вопрос или намёк, не говори ответ.', ' Я уже просил помощи: теперь скажи конкретный следующий шаг — что нажать или какое значение выставить.', ' Я прошу помощи уже не в первый раз и, видимо, застрял всерьёз: разбери решение по шагам (2–4 коротких шага) и объясни, почему так.'];
  let antAt = 0;
  async function anticipate() {
    if (busy) return;
    antAt = Date.now();
    const show = '💡 Помоги', sh = window.LuchShell;
    const n = sh && sh.noteHelp ? sh.noteHelp() : 1, ANT = ANT_BASE + ANT_LEVEL[Math.min(3, n)] + ' В конце — короткий вопрос, чтобы я мог ответить голосом.';
    if (voiceMode) { setVoice('thinking', ''); await ask(ANT, { voice: true, show }); await speaker.idle(); if (voiceMode && !micOff) turn(); }
    else await ask(ANT, { show });
  }
  // журнал действий ученика: что нажимал и что выставлял (без полей наставника)
  const actions = [];
  const labelOf = el => {
    const t = (el.getAttribute('aria-label') || el.title || (el.tagName === 'INPUT' || el.tagName === 'SELECT' ? (el.labels && el.labels[0] && el.labels[0].textContent) || el.name || el.id : el.textContent) || '').replace(/\s+/g, ' ').trim();
    return t.slice(0, 60);
  };
  const logAct = (kind, el, extra) => {
    if (!el || el.closest('.lt-panel,.lt-btn,.lt-tip,.lt-board')) return;
    const l = labelOf(el); if (!l && !extra) return;
    const line = kind + ' «' + l + '»' + (extra ? ' = ' + extra : '');
    const last = actions[actions.length - 1];
    if (last && last.line === line) { last.at = Date.now(); return; }
    if (last && kind === 'изменил' && last.line.startsWith('изменил «' + l + '»')) { last.line = line; last.at = Date.now(); return; }
    actions.push({ line, at: Date.now() }); if (actions.length > 24) actions.shift();
  };
  document.addEventListener('click', e => { const el = e.target.closest('button,a,[role="button"],[role="tab"],[data-reel],label,.lesson,svg [data-k],[onclick]'); if (el) logAct('нажал', el); }, true);
  document.addEventListener('change', e => { const el = e.target; if (el.matches && el.matches('input,select,textarea')) logAct('изменил', el, el.type === 'checkbox' ? (el.checked ? 'вкл' : 'выкл') : String(el.value).slice(0, 30)); }, true);
  document.addEventListener('pointerup', e => { const el = e.target.closest && e.target.closest('svg,canvas'); if (el && !e.target.closest('button') && !el.closest('.lt-board,.lt-panel')) logAct('двигал/нажал на схеме', el.closest('[aria-label],[id]') || el); }, true);
  const note = line => { actions.push({ line, at: Date.now() }); if (actions.length > 24) actions.shift(); };
  window.LuchTutorNote = note;
  const watchToast = () => {
    const t = document.getElementById('toast'); if (!t) return;
    let lastT = '';
    new MutationObserver(() => { const x = t.textContent.replace(/\s+/g, ' ').trim(); if (x && x !== lastT) { lastT = x; note('опыт показал сообщение: «' + x.slice(0, 160) + '»'); } }).observe(t, { childList: true, characterData: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchToast); else watchToast();
  function recentActions() {
    const now = Date.now();
    return actions.filter(a => now - a.at < 20 * 60e3).slice(-16).map(a => '- ' + Math.round((now - a.at) / 1000) + ' с назад: ' + a.line).join('\n');
  }
  const open = () => { panel.hidden = false; btn.hidden = true; render(); setTimeout(() => (voiceMode ? orb : inp).focus(), 30); };
  function openPanel() { if (panel.hidden) open(); }
  $('#lt-bd').addEventListener('click', () => (board.open ? board.hide() : board.show()));
  window.LuchTutor = { ask: q => { openPanel(); ask(q); }, open: openPanel, board, highlight: el => highlightEl(el), hideTip: () => guide && guide.hide(), talk: t => guide && guide.talk(t) };
  const close = () => { setMode(false); if (dict) dict.abort(); panel.hidden = true; btn.hidden = false; btn.focus(); };
  // голос в первую очередь: кнопка сразу открывает разговор голосом (если ученик сам не выбрал текст)
  btn.addEventListener('click', () => {
    if (guide && guide.takeTip()) return;
    open(); unlockAudio();
    if (canListen && ls.get('luch-tutor-mode') !== 'text') setMode(true, true);
    anticipate();
  });
  $('#lt-close').addEventListener('click', close);

  // Наставник говорит? — «■ Стоп», Esc или голосом «стоп / хватит / остановись»
  const STOP_RE = /(^|[^а-яa-z])(стоп|хватит|остановись|остановитесь|остановиться|замолчи|помолчи|тихо|прекрати|достаточно|всё понятно|все понятно|ладно[, ]+вс[её]|stop|тоқта)([^а-яa-z]|$)/i;
  const isStop = t => { const m = String(t || '').toLowerCase().replace(/ё/g, 'е').match(STOP_RE); return !!m && String(t).trim().split(/\s+/).length <= 6; };
  const talking = () => speaker.busy || (audio && !audio.paused && !audio.ended) || !!(window.speechSynthesis && speechSynthesis.speaking);
  const stopBtn = $('#lt-stop');
  function stopTalk(said) {
    if (ctrl) ctrl.abort();
    speaker.stop(); spoken = '';
    stopWatchEnd();
    if (voiceMode) { micOff = false; setVoice('idle', said ? 'Хорошо, молчу. Говорите, когда нужно.' : ''); setTimeout(turn, 350); }
  }
  stopBtn.addEventListener('click', () => stopTalk());
  // пока наставник говорит — слушаем только команду «стоп» (на компьютере; на телефоне — кнопкой)
  let sw = null;
  function stopWatchStart() {
    if (sw || !SR || MOBILE || !voiceMode || panel.hidden) return;
    let rec; try { rec = new SR(); } catch (e) { return; }
    rec.lang = LOCALE; rec.continuous = true; rec.interimResults = true;
    rec.onresult = e => {
      let t = ''; for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript + ' ';
      // своё же слово из динамиков — не команда
      const w = (String(t).toLowerCase().match(STOP_RE) || [])[2];
      if (isStop(t) && !(w && spoken.toLowerCase().includes(w))) stopTalk(true);
    };
    rec.onerror = () => {};
    rec.onend = () => { if (sw === rec) { sw = null; if (talking()) setTimeout(stopWatchStart, 250); } };
    try { rec.start(); sw = rec; } catch (e) {}
  }
  function stopWatchEnd() { const r = sw; sw = null; if (r) { try { r.onend = null; r.abort(); } catch (e) {} } }
  let wasTalking = false;
  setInterval(() => {
    const t = talking();
    if (t !== wasTalking) { wasTalking = t; stopBtn.hidden = !t; if (t) stopWatchStart(); else { stopWatchEnd(); spoken = ''; } }
  }, 200);
  panel.addEventListener('keydown', e => { if (e.key === 'Escape') { if (talking()) { e.preventDefault(); stopTalk(); } else close(); } });
  sug.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tc) { const c = tipChips[+b.dataset.tc]; tipChips = []; suggestions(); if (c && c[1]) c[1](); return; }
    tipChips = [];
    if (b.dataset.ant) anticipate(); else ask(b.textContent);
  });
  form.addEventListener('submit', e => {
    e.preventDefault(); const q = inp.value, voice = dictated; dictated = false;
    inp.value = ''; inp.style.height = '';
    if (voice) speaker.stop();
    ask(q, { voice }).then(() => inp.focus());
  });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  inp.addEventListener('input', () => { inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 120) + 'px'; });
  if (window.speechSynthesis) speechSynthesis.getVoices();

  // ---------- гид: репетитор сам ведёт ученика — коротко, по одному шагу, голосом ----------
  // Облачко над кнопкой: одна фраза и максимум две кнопки, главная — «Ответить голосом».
  // Фразы проговариваются вслух, как только браузер разрешил звук (после первого касания страницы).
  const guide = (() => {
    const st2 = document.createElement('style');
    st2.textContent = `.lt-tip{position:fixed;z-index:50;right:calc(18px + env(safe-area-inset-right,0px));bottom:calc(86px + env(safe-area-inset-bottom,0px));width:min(340px,calc(100vw - 36px));background:#e8ecf4;color:#0b1019;border-radius:16px;padding:13px 14px 13px 15px;box-shadow:0 14px 40px -10px rgba(0,0,0,.6);font:15px/1.45 "Golos Text",system-ui,sans-serif;animation:lt-tip-in .35s ease-out}
      .lt-tip p{margin:0 24px 11px 0}
      .lt-tip .x{position:absolute;top:6px;right:6px;background:none;border:0;font-size:15px;color:#4a5570;cursor:pointer;width:30px;height:30px;border-radius:50%}
      .lt-tip .row{display:flex;gap:6px;flex-wrap:wrap}
      .lt-tip .row button{border:0;border-radius:999px;padding:9px 14px;font:600 13.5px "Golos Text",sans-serif;cursor:pointer;background:#d3d9e7;color:#0b1019}
      .lt-tip .row button.mic{background:#0b1019;color:#e8ecf4}
      .lt-tip:after{content:"";position:absolute;right:28px;bottom:-6px;width:13px;height:13px;background:#e8ecf4;transform:rotate(45deg)}
      @keyframes lt-tip-in{from{opacity:0;transform:translateY(8px)}}
      @media (max-width:600px){.lt-tip{bottom:calc(150px + env(safe-area-inset-bottom,0px))}}
      @media (prefers-reduced-motion:reduce){.lt-tip{animation:none}}`;
    document.head.appendChild(st2);
    const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
    let tip = null, lastAt = 0, closes = 0, lastAct = Date.now();
    const wait = ms => new Promise(r => setTimeout(r, ms));
    async function sayAloud(el) {
      if (!unlocked) return;
      for (let i = 0; i < 30 && window.LuchI18n && window.LuchI18n.pending && window.LuchI18n.pending(); i++) await wait(100); // ждём перевод
      const p = el.querySelector('p'); if (!p || !el.isConnected) return;
      speaker.stop(); speaker.add(p.textContent); speaker.end();
    }
    // голосом: фраза гида попадает в разговор, и репетитор сразу слушает ответ
    function talk(text) { hide(); chat.push({ role: 'assistant', content: text }); saveChat(); openPanel(); if (canListen) setMode(true); else render(); }
    async function askVoice(q) {
      hide(); openPanel();
      if (!canListen) { ask(q); return; }
      voiceMode = true; micOff = false; vErr = 0; vmBtn.classList.add('on'); vmBtn.setAttribute('aria-pressed', true); voiceBox.hidden = false; form.hidden = true; suggestions();
      setVoice('thinking', ''); unlockAudio();
      await ask(q, { voice: true }); await speaker.idle();
      if (voiceMode && !micOff) turn();
    }
    let pend = null; // подсказка, ждущая открытия панели
    function show(text, chips = [], o = {}) {
      try { if (window.LuchTutorNote) window.LuchTutorNote('наставник показал подсказку: «' + String(text).slice(0, 140) + '»'); } catch (e) {}
      if (!o.force && Date.now() - lastAt < 40000) return;
      if (!panel.hidden) {
        if (o.inChat) { bubble('assistant', text); chat.push({ role: 'assistant', content: text }); saveChat(); tipChips = chips; suggestions(); scroll(); if (voiceMode && unlocked) { speaker.stop(); speaker.add(text); speaker.end(); } }
        return;
      }
      lastAt = Date.now();
      pend = { text, chips };
      btn.querySelector('.lt-bt').textContent = text;
      btn.classList.add('has-tip', 'tip-open');
      btn.setAttribute('aria-label', 'Наставник: ' + text);
      if (o.el) highlightEl(o.el);
    }
    function hide() { pend = null; btn.classList.remove('has-tip', 'tip-open'); btn.setAttribute('aria-label', 'Наставник'); }
    // нажали на совёнка с подсказкой: она — первое сообщение, её кнопки — варианты ответа, наставник её проговаривает
    function takeTip() {
      if (!pend) return false;
      const { text, chips } = pend; hide();
      chat.push({ role: 'assistant', content: text }); saveChat();
      tipChips = chips; open(); unlockAudio();
      if (canListen && ls.get('luch-tutor-mode') !== 'text') {
        setMode(true, true); setVoice('speaking', '');
        speaker.stop(); speaker.add(text); speaker.end();
        speaker.idle().then(() => { if (voiceMode && !micOff && !busy) turn(); });
      }
      return true;
    }

    // звук разрешается только после касания страницы
    addEventListener('pointerdown', e => { if (!e.target.closest('.lt-tip')) unlockAudio(); }, { once: true, capture: true });
    // любое действие в интерфейсе убирает облачко (и его озвучку), чтобы оно не мешало
    ['pointerdown', 'keydown', 'input'].forEach(ev => addEventListener(ev, e => {
      if (e.target.closest && e.target.closest('.lt-panel,.lt-tip,.lt-btn')) return;
      lastAct = Date.now();
      if (pend) btn.classList.remove('tip-open');
    }, { capture: true, passive: true }));

    // ----- лаборатория -----
    function lab() {
      const sh = window.LuchShell; if (!sh) return false;
      const L = (() => { try { return (0, eval)('typeof LESSONS !== "undefined" ? LESSONS : null'); } catch (e) { return null; } })();
      const info = () => {
        const i = sh.lessonIdx(), h = document.querySelector('#pane-overview h2'), l = L && L[i];
        let task = l ? (typeof l.task === 'function' ? l.task() : l.task) : '';
        if (!task) { const tb = [...document.querySelectorAll('[class*="task"]')].find(e => e.offsetParent && e.textContent.trim().length > 15); task = tb ? tb.textContent.trim() : ''; }
        // из рамки задания берём только саму задачу: без «Задание · урок 1» и счётчиков после неё
        task = String(task || '').replace(/\s+/g, ' ').replace(/^Задание\s*·\s*урок\s*\d+\s*/i, '').trim();
        const sent = task.match(/^.{12,200}?[.!?](?=\s|$)/); if (sent) task = sent[0];
        return { i, n: L ? L.length : document.querySelectorAll('.lessons .lesson, .lessons button').length, title: h ? h.textContent.trim() : '', task: task.slice(0, 200) };
      };
      const taskEl = () => [...document.querySelectorAll('[class*="task"]')].find(e => e.offsetParent && !e.closest('.lt-panel,.lt-tip,#pane-hw') && e.getBoundingClientRect().width > 120);
      const remember = () => { const x = info(); store.set('luch-last', JSON.stringify({ url: sh.lessonUrl(), title: x.title, at: Date.now() })); };
      let idleShown = false;
      function lessonTip(force) {
        const x = info(); idleShown = false; remember();
        show(`Урок ${x.i + 1}: «${x.title}». ${x.task ? 'Задача: ' + x.task : 'Попробуй опыт слева.'}`, [['Покажи, с чего начать', () => askVoice('Покажи на странице, с чего начать это задание. Коротко, по одному шагу.')]], { force, el: taskEl() });
      }
      // урок начинается с карточки «Начнём с теории» (lab-shell); пока она открыта — молчим
      const tipUnlessStart = () => { remember(); if (sh.startPending && sh.startPending()) return; if (!document.querySelector('.ls-start')) lessonTip(true); };
      setTimeout(tipUnlessStart, 1300);
      // смена урока
      const strip = document.querySelector('.lessons'); let lt = 0;
      if (strip) new MutationObserver(() => { clearTimeout(lt); lt = setTimeout(tipUnlessStart, 900); }).observe(strip, { attributes: true, subtree: true, attributeFilter: ['aria-current'] });
      // урок пройден: счётчик «2/5» в шапке вырос
      const counter = [...document.querySelectorAll('header *')].find(e => !e.children.length && /^\s*\d+\s*\/\s*\d+\s*$/.test(e.textContent));
      if (counter) {
        let prev = parseInt(counter.textContent, 10) || 0;
        new MutationObserver(() => {
          const m = counter.textContent.match(/(\d+)\s*\/\s*(\d+)/); if (!m) return;
          const a = +m[1], b = +m[2]; if (a <= prev) { prev = a; return; } prev = a; clearTimeout(lt);
          // после практики — закрепить: 4 коротких вопроса (готовим их заранее)
          if (sh.prefetchQuiz) sh.prefetchQuiz();
          const quiz = sh.openQuiz ? [['✅ Закрепить: 4 вопроса', () => sh.openQuiz()]] : [];
          if (a >= b) {
            const n = sh.nextTopic && sh.nextTopic();
            show('Ты прошёл всю тему! 🎉 Давай закрепим последний урок — ответь на 4 коротких вопроса. ' + (n && !n.map ? 'А потом — «' + n.t + '».' : ''),
              [...quiz, [n && !n.map ? 'Следующая тема →' : 'К карте предметов', () => (sh.goNext ? sh.goNext() : document.querySelector('.brand').click())], ['Сделать ДЗ', () => sh.openHw()]], { force: true, inChat: true });
          }
          else show('Отлично, задание выполнено! 🎉 Давай закрепим знания — ответь на 4 коротких вопроса.', [...quiz, ['Следующий урок →', () => { const nx = document.getElementById('nextL') || [...document.querySelectorAll('.lessons .lesson, .lessons button')][info().i + 1]; if (nx) nx.click(); }], ['Сделать ДЗ', () => sh.openHw()]], { force: true, inChat: true });
        }).observe(counter, { childList: true, characterData: true, subtree: true });
      }
      // ученик долго ничего не делает — предлагаем помощь (один раз на урок)
      setInterval(() => {
        if (idleShown || closes >= 3 || !panel.hidden || document.hidden || Date.now() - lastAct < 30000) return;
        if ((sh.storyPlaying && sh.storyPlaying()) || document.querySelector('.ls-start')) { lastAct = Date.now(); return; }
        idleShown = true;
        show('Что-то не получается? Подскажу следующий шаг.', [['Подскажи шаг', () => askVoice('Я застрял. Подскажи следующий шаг в задании, коротко.')]], { force: true });
      }, 5000);
      return true;
    }

    // ----- карта предметов (главная) -----
    function home() {
      if (!document.getElementById('subjects')) return false;
      let last = null; try { last = JSON.parse(store.get('luch-last') || 'null'); } catch (e) {}
      setTimeout(() => {
        if (last && last.url) return show(`С возвращением! Продолжим урок «${last.title}»?`, [['Продолжить', () => { location.href = last.url; }], ['Выбрать другое', () => gradeAsk()]], { force: true });
        gradeAsk();
      }, 1200);
      function gradeAsk() {
        show('Привет! Я твой наставник. Объясню любую тему просто — на опытах и картинках. С чего начнём?', [['🎓 Учусь в школе', () => show('В каком ты классе? Подберу, с чего начать.', [['5–6', () => pick(5)], ['7', () => pick(7)], ['8', () => pick(8)], ['9', () => pick(9)], ['10–11', () => pick(10)]], { force: true, speak: true })], ['💡 Хочу разобраться в теме', () => show('Скажи, что хочешь понять — например, «как работает электричество», — или выбери тему на карте.', [], { force: true, el: document.getElementById('subjects') })]], { force: true });
      }
      function pick(g) {
        store.set('luch-grade', g);
        const nodes = [...document.querySelectorAll('#tree .node')];
        const gr = n => parseInt((n.querySelector('.nm') || n).textContent, 10) || 0;
        let cand = nodes.filter(n => gr(n) >= g && /done|part/.test(n.className)).sort((a, b) => gr(a) - gr(b))[0] || nodes.find(n => /done|part/.test(n.className));
        if (!cand) return;
        cand.click();
        const name = (cand.querySelector('.nt') || cand).textContent.trim();
        const item = matchMedia('(max-width:760px)').matches ? document.querySelector(`#list details[data-id="${cand.dataset.id}"]`) : cand;
        if (item && item.tagName === 'DETAILS') item.open = true;
        const go = () => { const a = document.querySelector('#side a.cta') || (item && item.querySelector('a.cta')); if (a) location.href = a.href; };
        show(`Начни с темы «${name}». Открыть первый урок?`, [['Перейти к урокам', go], ['Другой предмет', () => highlightEl(document.getElementById('subjects'))]], { force: true, el: item });
      }
      return true;
    }
    const startAt = Date.now();
    (function boot() { if (lab() || home()) return; if (Date.now() - startAt < 6000) setTimeout(boot, 300); })();
    return { show, hide, talk, takeTip };
  })();

  if (document.getElementById('tab-overview') && !window.LuchShell) { const sc = document.createElement('script'); sc.src = '/luch/lab-shell.js'; document.head.appendChild(sc); }
  if (typeof window.LUCH_REAL === 'function' && !window.__luchReal) { const r3 = document.createElement('script'); r3.src = '/luch/real3d.js'; document.head.appendChild(r3); }
})();
