// Вход через Clerk и учётная запись ученика: кнопка в шапке, прогресс и действия сохраняются на сервере,
// на новом устройстве прогресс подтягивается. Без входа всё работает как раньше (в браузере).
(() => {
  if (window.LuchAuth) return;
  const PK = 'pk_test_dXNhYmxlLWJhc2lsaXNrLTY0OTcuY2xlcmsuYWNjb3VudHMuZGV2JA';
  const FAPI = 'https://usable-basilisk-6497.clerk.accounts.dev';
  const RU = 'https://cdn.jsdelivr.net/npm/@clerk/localizations@4.24.1/dist/ru-RU.mjs';
  // какие ключи localStorage — это прогресс ученика (тот же список проверяет сервер)
  const KEY_RE = /^(luch-(phys|chem|bio|math|cs)-[a-z0-9-]{2,30}|oe-learn:\/labs\/[a-z0-9-]{2,40}\/:\d{1,2}|oe-start:\/labs\/[a-z0-9-]{2,40}\/:\d{1,2})$/;
  const QKEY = 'oe-me-queue';
  const A = window.LuchAuth = { user: null, data: null, ready: false, log, contextLine, openSignIn: () => clerk && clerk.openSignIn(), signOut: () => clerk && clerk.signOut() };
  let clerk = null;

  // ---------- кнопка в шапке ----------
  const css = document.createElement('style');
  css.textContent = `.oe-acc{flex:none;margin-left:12px;display:flex;align-items:center}
    .oe-acc a,.oe-acc button{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:8px;height:32px;padding:0 12px;border-radius:999px;
      font:600 13px/1 inherit;color:var(--fg,#e8ecf4);background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);white-space:nowrap}
    .oe-acc a:hover,.oe-acc button:hover{background:rgba(255,255,255,.13)}
    .oe-acc a:focus-visible,.oe-acc button:focus-visible{outline:2px solid #ffb347;outline-offset:2px}
    .oe-acc img,.oe-acc .av{width:24px;height:24px;border-radius:50%;margin-left:-6px;object-fit:cover;display:grid;place-items:center;background:#ff9f1c;color:#1b1206;font-size:12px}
    @media (max-width:600px){.oe-acc{margin-left:8px}.oe-acc .nm{display:none}.oe-acc a,.oe-acc button{padding:0 10px}}`;
  document.head.appendChild(css);
  const acc = document.createElement('div'); acc.className = 'oe-acc'; acc.dataset.noi18n = '';
  function mount() { const h = document.querySelector('header'); if (h && !acc.isConnected) h.appendChild(acc); }
  function paint() {
    mount();
    const u = A.user;
    if (!u) { acc.innerHTML = '<button type="button">Войти</button>'; acc.firstChild.onclick = () => clerk ? clerk.openSignIn({}) : null; acc.firstChild.title = 'Войти: прогресс сохранится и будет на любом устройстве'; return; }
    const first = esc((u.firstName || u.fullName || u.primaryEmailAddress?.emailAddress || 'Кабинет').split(' ')[0]);
    acc.innerHTML = `<a href="/me/" title="Мой кабинет: прогресс и история занятий">${u.imageUrl ? `<img src="${esc(u.imageUrl)}" alt="">` : `<span class="av">${first[0] || '•'}</span>`}<span class="nm">${first}</span></a>`;
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paint); else paint();

  // ---------- очередь событий и изменений прогресса ----------
  const q = (() => { try { return JSON.parse(localStorage.getItem(QKEY) || '{}') || {}; } catch (e) { return {}; } })();
  q.events = q.events || []; q.keys = q.keys || {};
  const saveQ = () => { try { origSet.call(localStorage, QKEY, JSON.stringify({ events: q.events.slice(-200), keys: q.keys })); } catch (e) {} };
  function log(kind, title, detail, extra) {
    q.events.push(Object.assign({ kind, title, detail, page: location.pathname, at: Date.now() }, extra || {}));
    saveQ(); push();
  }
  // перехватываем запись прогресса в localStorage: так ловим всё, что пишут опыты и оболочка урока
  const origSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    let before = null;
    if (this === localStorage && KEY_RE.test(k)) { try { before = localStorage.getItem(k); } catch (e) {} }
    origSet.call(this, k, v);
    if (this === localStorage && KEY_RE.test(k) && before !== v) { q.keys[k] = 1; saveQ(); try { notice(k, before, v); } catch (e) {} push(); }
  };
  // из изменения прогресса — понятное событие для кабинета
  const title = () => (document.querySelector('header h1, .lessons [aria-current="true"] .t, .lessons [aria-current="true"]') || {}).textContent || document.title;
  const lessonTitle = () => { const a = document.querySelector('.lessons [aria-current="true"], .lessons [aria-current="page"]'); return a ? a.textContent.replace(/^\s*\d+\s*/, '').replace(/\s+/g, ' ').trim().slice(0, 120) : ''; };
  const topicName = () => (document.querySelector('header .tt, header .topic, .brand + * b, header b') || {}).textContent || document.title.replace(/^Open Lab AI\s*[—-]\s*/, '');
  function doneCount(v) { try { const d = JSON.parse(v || '{}').done; return d ? (Array.isArray(d) ? d.filter(Boolean).length : Object.values(d).filter(Boolean).length) : 0; } catch (e) { return 0; } }
  function notice(k, before, v) {
    if (k.startsWith('luch-')) {
      const a = doneCount(before), b = doneCount(v);
      if (b > a) log('task', 'Выполнил задание: ' + (lessonTitle() || 'урок'), topicName().trim().slice(0, 120), { lesson: lessonIdx() });
    } else if (k.startsWith('oe-learn:')) {
      let jb = {}, jv = {}; try { jb = JSON.parse(before || '{}'); jv = JSON.parse(v || '{}'); } catch (e) {}
      const L = { lesson: +k.split(':').pop() };
      if (jv.theoryDone && !jb.theoryDone) log('theory', 'Прослушал теорию: ' + (lessonTitle() || 'урок'), topicName().trim().slice(0, 120), L);
      if (jv.quiz && (!jb.quiz || jv.quiz.at !== jb.quiz.at)) log('quiz', `Тест «Закрепим»: ${jv.quiz.ok} из ${jv.quiz.n}`, (lessonTitle() || '') + ' · ' + topicName().trim().slice(0, 80), L);
    }
  }
  const lessonIdx = () => { try { return window.LuchShell ? window.LuchShell.lessonIdx() : undefined; } catch (e) { return undefined; } };

  // ---------- отправка на сервер ----------
  let pushT = 0, pushing = false;
  function push() { clearTimeout(pushT); pushT = setTimeout(flush, 1500); }
  async function token() { try { return clerk && clerk.session ? await clerk.session.getToken() : null; } catch (e) { return null; } }
  async function flush(all) {
    if (pushing || !A.user) return; const t = await token(); if (!t) return;
    pushing = true;
    const keys = all ? Object.keys(localStorage).filter(k => KEY_RE.test(k)) : Object.keys(q.keys);
    const state = {}; keys.forEach(k => { const v = localStorage.getItem(k); if (v != null) state[k] = v; });
    const events = q.events.slice(0, 100), u = A.user;
    try {
      const r = await fetch('/api/me/sync', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ profile: { name: u.fullName || u.firstName || '', email: u.primaryEmailAddress && u.primaryEmailAddress.emailAddress, image: u.imageUrl }, state, events }) });
      const j = await r.json();
      if (j.ok) {
        keys.forEach(k => delete q.keys[k]); q.events.splice(0, events.length); saveQ();
        A.data = j; merge(j.state || {}); document.dispatchEvent(new CustomEvent('luch-me', { detail: j }));
      }
    } catch (e) { /* попробуем позже */ }
    pushing = false;
    if (q.events.length || Object.keys(q.keys).length) push();
  }
  // прогресс с сервера: чего нет на этом устройстве — дописываем; у опытов объединяем выполненные задания
  function merge(server) {
    let changed = false;
    for (const [k, v] of Object.entries(server)) {
      if (!KEY_RE.test(k)) continue;
      const cur = localStorage.getItem(k);
      if (cur == null) { origSet.call(localStorage, k, v); changed = true; continue; }
      if (k.startsWith('luch-') && cur !== v) {
        try {
          const a = JSON.parse(cur), b = JSON.parse(v);
          if (a && b && a.done && b.done && !Array.isArray(a.done)) {
            const d = Object.assign({}, b.done, a.done); let more = false;
            for (const x in b.done) if (b.done[x] && !a.done[x]) { d[x] = b.done[x]; more = true; }
            if (more) { a.done = d; origSet.call(localStorage, k, JSON.stringify(a)); changed = true; q.keys[k] = 1; }
          }
        } catch (e) {}
      }
    }
    if (changed && /^\/labs\//.test(location.pathname) && !sessionStorage.getItem('oe-me-merged')) {
      // опыт уже прочитал прогресс при загрузке — один раз перезагружаем, чтобы показать подтянутый
      try { sessionStorage.setItem('oe-me-merged', '1'); } catch (e) {}
      location.reload();
    }
  }

  // ---------- для наставника: кто ученик и что он уже делал ----------
  function contextLine() {
    if (!A.user || !A.data) return '';
    const ev = A.data.events || [], days = new Set(ev.map(e => String(e.at).slice(0, 10)));
    const done = ev.filter(e => e.kind === 'task').length, quiz = ev.filter(e => e.kind === 'quiz');
    const last = ev.slice(0, 8).map(e => `${String(e.at).slice(0, 10)}: ${e.title}${e.detail ? ' (' + e.detail + ')' : ''}`).join('; ');
    return `Ученик вошёл в аккаунт: ${A.user.firstName || A.user.fullName || 'без имени'}. Занимался ${days.size} ${days.size === 1 ? 'день' : 'дней'}, выполнил заданий: ${done}, тестов: ${quiz.length}` +
      (quiz.length ? ` (последний: ${quiz[0].title})` : '') + `. Последние действия: ${last || 'пока нет'}. Учитывай это: не повторяй то, что он уже прошёл, опирайся на пройденные темы.`;
  }

  // ---------- загрузка Clerk ----------
  async function boot() {
    const add = (src, pk) => new Promise((res, rej) => {
      const s = document.createElement('script'); s.async = true; s.crossOrigin = 'anonymous'; s.src = src;
      if (pk) s.setAttribute('data-clerk-publishable-key', pk);
      s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
    // окна входа и профиля — отдельный пакет @clerk/ui, сам Clerk — clerk-js
    const [, , loc] = await Promise.all([
      add(FAPI + '/npm/@clerk/ui@1/dist/ui.browser.js'),
      add(FAPI + '/npm/@clerk/clerk-js@6/dist/clerk.browser.js', PK),
      import(RU).catch(() => null),
    ]);
    clerk = window.Clerk;
    await clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor }, localization: loc && loc.ruRU, appearance: { variables: { colorPrimary: '#ff9f1c' } } });
    const wasIn = !!clerk.user;
    A.user = clerk.user || null; A.ready = true; paint();
    if (A.user) { log('open', 'Открыл: ' + (document.title.replace(/^Open Lab AI\s*[—-]\s*/, '').slice(0, 120)), '', { lesson: lessonIdx() }); flush(true); }
    clerk.addListener(({ user }) => {
      const before = A.user && A.user.id; A.user = user || null; paint();
      if (A.user && A.user.id !== before) { if (!wasIn || before) log('signin', 'Вошёл в аккаунт', ''); flush(true); }
      if (!A.user) A.data = null;
      document.dispatchEvent(new CustomEvent('luch-auth', { detail: { user: A.user } }));
    });
  }
  boot().catch(e => { A.ready = true; console.warn('[auth]', e && e.message); });
})();
