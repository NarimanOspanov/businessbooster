// Вход через Clerk и учётная запись ученика: кнопка в шапке, прогресс и действия сохраняются на сервере,
// на новом устройстве прогресс подтягивается. Без входа всё работает как раньше (в браузере).
(() => {
  if (window.LuchAuth) return;
  const FRAMED = window.top !== window; // превью урока внутри аудиогида — ничего не пишем в историю
  const PK = 'pk_test_dXNhYmxlLWJhc2lsaXNrLTY0OTcuY2xlcmsuYWNjb3VudHMuZGV2JA';
  const FAPI = 'https://usable-basilisk-6497.clerk.accounts.dev';
  const RU = 'https://cdn.jsdelivr.net/npm/@clerk/localizations@4.24.1/dist/ru-RU.mjs';
  // какие ключи localStorage — это прогресс ученика (тот же список проверяет сервер)
  const KEY_RE = /^(luch-(phys|chem|bio|math|cs)-[a-z0-9-]{2,30}|oe-learn:\/labs\/[a-z0-9-]{2,40}\/:\d{1,2}|oe-start:\/labs\/[a-z0-9-]{2,40}\/:\d{1,2})$/;
  const QKEY = 'oe-me-queue';
  const A = window.LuchAuth = { user: null, data: null, ready: false, log, contextLine, token: () => token(), clerk: () => clerk, refresh: () => flush(true), openSignIn: () => clerk && clerk.openSignIn(), signOut: () => clerk && clerk.signOut() };
  let clerk = null;

  // ---------- кнопка в шапке ----------
  const css = document.createElement('style');
  css.textContent = `.oe-acc{flex:none;margin-left:auto;padding-left:12px;display:flex;align-items:center}
    .oe-acc a,.oe-acc button{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:8px;height:32px;padding:0 12px;border-radius:999px;
      font:600 13px/1 inherit;color:var(--fg,#e8ecf4);background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);white-space:nowrap}
    .oe-acc a:hover,.oe-acc button:hover{background:rgba(255,255,255,.13)}
    .oe-acc a:focus-visible,.oe-acc button:focus-visible{outline:2px solid #ffb347;outline-offset:2px}
    .oe-acc .bd{min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#ff8a73;color:#1b0b06;font:700 11px/18px inherit;text-align:center;margin-right:-4px}
    .oe-acc img,.oe-acc .av{width:24px;height:24px;border-radius:50%;margin-left:-6px;object-fit:cover;display:grid;place-items:center;background:#ff9f1c;color:#1b1206;font-size:12px}
    .oe-acc{position:relative}.oe-menu{position:absolute;right:0;top:calc(100% + 8px);z-index:90;min-width:190px;background:#151d2c;border:1px solid #2a3650;border-radius:14px;padding:6px;box-shadow:0 18px 40px -12px rgba(0,0,0,.7);display:flex;flex-direction:column;gap:2px}
    .oe-menu[hidden]{display:none}.oe-acc .oe-menu a,.oe-acc .oe-menu button{all:unset;cursor:pointer;display:block;padding:10px 12px;border-radius:9px;font:500 14px/1.2 inherit;color:#e8ecf4;white-space:nowrap}
    .oe-acc .oe-menu a:hover,.oe-acc .oe-menu button:hover,.oe-acc .oe-menu a:focus-visible,.oe-acc .oe-menu button:focus-visible{background:rgba(255,255,255,.08)}.oe-acc .oe-menu [data-out]{color:#ff8a73}
    @media (max-width:480px){header .brand h1{font-size:17px!important;letter-spacing:.1em!important}header .brand small{font-size:9.5px!important;letter-spacing:.08em!important}header .brand svg{width:34px!important;height:34px!important}header{column-gap:8px!important}.oe-acc{padding-left:0!important}}
    @media (max-width:600px){.oe-acc{margin-left:8px}.oe-acc .nm{display:none}.oe-acc a,.oe-acc button{padding:0 10px}}`;
  document.head.appendChild(css);
  const acc = document.createElement('div'); acc.className = 'oe-acc'; acc.dataset.noi18n = '';
  // блок аккаунта не переводится автоматически (там имя ученика) — свои подписи переводим здесь
  const KK = { 'Войти': 'Кіру', 'Войти: прогресс сохранится и будет на любом устройстве': 'Кіру: прогресс сақталады және кез келген құрылғыда болады', 'Аккаунт': 'Аккаунт', 'Мой кабинет': 'Жеке кабинет', 'Друзья и группы': 'Достар мен топтар', 'Выйти': 'Шығу' };
  const T = s => (window.LuchI18n && window.LuchI18n.lang === 'kk' && KK[s]) || s;
  // меню аккаунта закрывается нажатием мимо и клавишей Esc
  document.addEventListener('click', (e) => { const m = acc.querySelector('.oe-menu'); if (m && !m.hidden && !acc.contains(e.target)) { m.hidden = true; const b = acc.querySelector('[aria-haspopup]'); if (b) b.setAttribute('aria-expanded', 'false'); } });
  document.addEventListener('keydown', (e) => { const m = acc.querySelector('.oe-menu'); if (e.key === 'Escape' && m && !m.hidden) { m.hidden = true; const b = acc.querySelector('[aria-haspopup]'); if (b) { b.setAttribute('aria-expanded', 'false'); b.focus(); } } });
  function mount() { const h = document.querySelector('header'); if (h && !acc.isConnected) h.appendChild(acc); }
  function paint() {
    mount();
    const u = A.user;
    if (!u) { acc.innerHTML = '<button type="button">' + T('Войти') + '</button>'; acc.firstChild.onclick = () => clerk ? A.openSignIn() : null; acc.firstChild.title = T('Войти: прогресс сохранится и будет на любом устройстве'); return; }
    const nick = A.data && A.data.user && A.data.user.nick;
    const first = esc((nick || u.firstName || u.fullName || u.primaryEmailAddress?.emailAddress || 'Кабинет').split(' ')[0]);
    acc.innerHTML = `<a href="/me/" role="button" aria-haspopup="menu" aria-expanded="false" title="${T('Аккаунт')}">${u.imageUrl ? `<img src="${esc(u.imageUrl)}" alt="">` : `<span class="av">${first[0] || '•'}</span>`}<span class="nm">${first}</span></a>` +
      `<div class="oe-menu" role="menu" hidden><a role="menuitem" href="/me/">${T('Мой кабинет')}</a><a role="menuitem" href="/social/">${T('Друзья и группы')}</a><button role="menuitem" type="button" data-out>${T('Выйти')}</button></div>`;
    const btn = acc.querySelector('a[aria-haspopup]'), menu = acc.querySelector('.oe-menu');
    const show = (on) => { menu.hidden = !on; btn.setAttribute('aria-expanded', String(on)); };
    btn.onclick = (e) => { e.preventDefault(); show(menu.hidden); if (!menu.hidden) menu.querySelector('a').focus(); };
    menu.querySelector('[data-out]').onclick = async () => { show(false); try { await A.signOut(); } catch (e) {} location.href = '/'; };
    if (A.social) setBadge(A.social);
  }
  // значок: новые заявки в друзья и непрочитанные сообщения
  function setBadge(j) { A.social = j; const n = (j.requests || 0) + (j.unread || 0) + (j.goalsDone || 0), l = acc.querySelector('a'); if (!l) return; let b = l.querySelector('.bd'); if (!n) { if (b) b.remove(); return; } if (!b) { b = document.createElement('span'); b.className = 'bd'; l.appendChild(b); } b.textContent = n; b.title = 'Новые заявки и сообщения'; }
  async function socialPoll() { if (!A.user || document.hidden || FRAMED) return; try { const t = await token(); if (!t) return; const j = await (await fetch('/api/social/me', { headers: { Authorization: 'Bearer ' + t } })).json(); if (j.ok) setBadge(j); } catch (e) {} }
  setInterval(socialPoll, 60000);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  A.repaint = paint; // перерисовать шапку (и для проверки без входа)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paint); else paint();

  // ---------- очередь событий и изменений прогресса ----------
  const q = (() => { try { return JSON.parse(localStorage.getItem(QKEY) || '{}') || {}; } catch (e) { return {}; } })();
  q.events = q.events || []; q.keys = q.keys || {};
  const saveQ = () => { try { origSet.call(localStorage, QKEY, JSON.stringify({ events: q.events.slice(-200), keys: q.keys })); } catch (e) {} };
  function log(kind, title, detail, extra) {
    if (FRAMED) return;
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
  const topicName = () => (document.querySelector('header .tt, header .topic, .brand + * b, header b') || {}).textContent || document.title.replace(/^Open School AI\s*[—-]\s*/, '');
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
        A.data = j; merge(j.state || {}); paint(); document.dispatchEvent(new CustomEvent('luch-me', { detail: j }));
        if (j.user && !j.user.nick) onboard();
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
    if (changed && !FRAMED && /^\/labs\//.test(location.pathname) && !sessionStorage.getItem('oe-me-merged')) {
      // опыт уже прочитал прогресс при загрузке — один раз перезагружаем, чтобы показать подтянутый
      try { sessionStorage.setItem('oe-me-merged', '1'); } catch (e) {}
      location.reload();
    }
  }

  // ---------- знакомство после первого входа: имя, возраст, пол, цель ----------
  const GOALS = [['school', 'Учусь в школе'], ['ent', 'Готовлюсь к ЕНТ'], ['self', 'Учусь для себя'], ['parent', 'Я родитель'], ['teacher', 'Я учитель']];
  const GOAL_TXT = { school: 'учится в школе', ent: 'готовится к ЕНТ', self: 'учится для себя', parent: 'родитель, смотрит курс для ребёнка', teacher: 'учитель' };
  let obOpen = false;
  function onboard(edit) {
    if (obOpen || !A.user || FRAMED) return;
    if (!edit) { try { if (sessionStorage.getItem('oe-ob-later')) return; } catch (e) {} }
    obOpen = true;
    const cur = (A.data && A.data.user) || {};
    const st = document.createElement('style');
    st.textContent = `.oe-ob{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:rgba(5,8,14,.62);backdrop-filter:blur(4px);padding:16px}
      .oe-ob form{width:min(440px,100%);background:#121a28;color:#e8ecf4;border:1px solid #26324a;border-radius:20px;padding:24px;box-shadow:0 24px 60px rgba(0,0,0,.45);font:15px/1.5 "Golos Text",system-ui,sans-serif}
      .oe-ob h2{margin:0 0 4px;font:700 20px/1.25 "Unbounded","Golos Text",sans-serif}
      .oe-ob p{margin:0 0 16px;color:#8b96ad;font-size:14px}
      .oe-ob label{display:block;font-size:13px;color:#8b96ad;margin:12px 0 6px}
      .oe-ob input{width:100%;box-sizing:border-box;height:42px;padding:0 12px;border-radius:12px;border:1px solid #26324a;background:#0b1019;color:#e8ecf4;font:inherit}
      .oe-ob input:focus{outline:2px solid #ffb547;border-color:transparent}
      .oe-ob .ch{display:flex;flex-wrap:wrap;gap:6px}
      .oe-ob .ch button{all:unset;cursor:pointer;padding:7px 12px;border-radius:999px;border:1px solid #26324a;background:#1a2438;font-size:13px}
      .oe-ob .ch button[aria-pressed="true"]{background:#ffb547;color:#1b1206;border-color:#ffb547;font-weight:600}
      .oe-ob .ch button:focus-visible,.oe-ob .ft button:focus-visible{outline:2px solid #ffb547;outline-offset:2px}
      .oe-ob .ft{display:flex;gap:8px;justify-content:flex-end;margin-top:20px}
      .oe-ob .ft button{all:unset;cursor:pointer;padding:10px 16px;border-radius:12px;font-weight:600;font-size:14px}
      .oe-ob .ft .ok{background:#ffb547;color:#1b1206}.oe-ob .ft .no{color:#8b96ad}
      .oe-ob .er{color:#ff8a73;font-size:13px;min-height:18px;margin-top:8px}`;
    const box = document.createElement('div'); box.className = 'oe-ob'; box.dataset.noi18n = '';
    const chips = (name, opts, val) => `<div class="ch" data-name="${name}">${opts.map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="${val === v}">${t}</button>`).join('')}</div>`;
    box.innerHTML = `<form role="dialog" aria-modal="true" aria-labelledby="oeObT"><h2 id="oeObT">${edit ? 'О себе' : 'Давай познакомимся'}</h2>
      <p>Наставник будет обращаться по имени и объяснять под твой возраст.</p>
      <label for="oeObN">Как тебя зовут?</label><input id="oeObN" autocomplete="given-name" maxlength="60" value="${esc(cur.nick || A.user.firstName || '')}" placeholder="Имя">
      <label for="oeObA">Сколько тебе лет?</label><input id="oeObA" type="number" inputmode="numeric" min="5" max="99" value="${cur.age || ''}" placeholder="Например, 14">
      <label>Пол <span style="opacity:.7">— чтобы правильно обращаться</span></label>${chips('gender', [['m', 'Мужской'], ['f', 'Женский'], ['', 'Не указывать']], cur.gender || '')}
      <label>Зачем учишься?</label>${chips('goal', GOALS, cur.goal || '')}
      <div class="er" aria-live="polite"></div>
      <div class="ft"><button type="button" class="no">${edit ? 'Отмена' : 'Позже'}</button><button type="submit" class="ok">Готово</button></div></form>`;
    document.head.appendChild(st); document.body.appendChild(box);
    const val = { gender: cur.gender || '', goal: cur.goal || '' };
    box.querySelectorAll('.ch').forEach(g => g.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; val[g.dataset.name] = b.dataset.v; g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); }));
    const close = () => { box.remove(); st.remove(); obOpen = false; };
    box.querySelector('.no').onclick = () => { if (!edit) try { sessionStorage.setItem('oe-ob-later', '1'); } catch (e) {} close(); };
    box.querySelector('form').onsubmit = async e => {
      e.preventDefault();
      const nick = box.querySelector('#oeObN').value.trim(), age = parseInt(box.querySelector('#oeObA').value, 10);
      const er = box.querySelector('.er');
      if (!nick) { er.textContent = 'Напиши, как к тебе обращаться.'; box.querySelector('#oeObN').focus(); return; }
      const t = await token(); if (!t) { er.textContent = 'Не получилось — попробуй ещё раз.'; return; }
      try {
        const r = await fetch('/api/me/profile', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ nick, age: age || null, gender: val.gender, goal: val.goal }) });
        const j = await r.json(); if (!j.ok) { er.textContent = j.error || 'Не получилось сохранить.'; return; }
        A.data = j; paint(); close(); document.dispatchEvent(new CustomEvent('luch-me', { detail: j }));
        try { if (!A.user.firstName) await A.user.update({ firstName: nick }); } catch (e2) {}
      } catch (e2) { er.textContent = 'Нет связи — попробуй ещё раз.'; }
    };
    setTimeout(() => box.querySelector('#oeObN').focus(), 50);
  }
  A.onboard = () => onboard(true);

  // ---------- для наставника: кто ученик и что он уже делал ----------
  function contextLine() {
    if (!A.user || !A.data) return '';
    const goals = (A.data.goals || []).filter(g => g.status === 'a' || g.status === 'd');
    const p = A.data.user || {}, ev = A.data.events || [], days = new Set(ev.map(e => String(e.at).slice(0, 10)));
    const done = ev.filter(e => e.kind === 'task').length, quiz = ev.filter(e => e.kind === 'quiz');
    const last = ev.filter(e => e.kind !== 'open').slice(0, 8).map(e => `${String(e.at).slice(0, 10)}: ${e.title}${e.detail ? ' (' + e.detail + ')' : ''}`).join('; ');
    const who = [p.nick ? `зовут ${p.nick} — обращайся по имени` : '', p.age ? `${p.age} лет — объясняй под этот возраст` : '',
      p.gender ? (p.gender === 'f' ? 'девушка — используй женский род' : 'парень — используй мужской род') : '', p.goal ? GOAL_TXT[p.goal] : ''].filter(Boolean).join(', ');
    return `Ученик вошёл в аккаунт${who ? ': ' + who : ''}. Занимался ${days.size} дн., выполнил заданий: ${done}, тестов: ${quiz.length}` +
      (quiz.length ? ` (последний: ${quiz[0].title})` : '') + `. Последние действия: ${last || 'пока нет'}. Учитывай это: не повторяй то, что он уже прошёл, опирайся на пройденные темы.` +
      (goals.length ? ` Цели от родителей: ${goals.map(g => `${g.kind === 'topic' ? 'заданий в теме' : g.what} — ${g.progress} из ${g.target}${g.reward ? ', награда: ' + g.reward : ''}${g.status === 'd' ? ' (достигнута!)' : ''}`).join('; ')}. Иногда мягко напоминай о цели и сколько осталось, хвали за шаг к ней.` : '');
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
    if (A.user) setTimeout(socialPoll, 1500);
    if (A.user) { log('open', 'Открыл: ' + (document.title.replace(/^Open School AI\s*[—-]\s*/, '').slice(0, 120)), '', { lesson: lessonIdx() }); flush(true); }
    // вход/выход: слушаем Clerk и дополнительно сверяемся сами — после входа по почте и паролю
    // событие иногда приходит раньше, чем сессия становится активной, и шапка оставалась с «Войти»
    const sync = () => {
      const user = (clerk.session && clerk.session.status && clerk.session.status !== 'active') ? null : (clerk.user || null);
      const before = A.user && A.user.id, now = user && user.id;
      if (before === now) { if (user && user !== A.user) { A.user = user; paint(); } return; }
      A.user = user; paint();
      if (A.user) { if (!wasIn || before) log('signin', 'Вошёл в аккаунт', ''); flush(true); setTimeout(socialPoll, 800); }
      else A.data = null;
      document.dispatchEvent(new CustomEvent('luch-auth', { detail: { user: A.user } }));
    };
    clerk.addListener(() => setTimeout(sync, 0));
    // пока открыто окно входа — проверяем раз в секунду (до 10 минут), плюс при возврате на вкладку
    let watch = 0;
    A.openSignIn = () => { clerk.openSignIn({}); clearInterval(watch); const t0 = Date.now(); watch = setInterval(() => { sync(); if (A.user || Date.now() - t0 > 600e3) clearInterval(watch); }, 1000); };
    addEventListener('focus', sync); document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  }
  boot().catch(e => { A.ready = true; console.warn('[auth]', e && e.message); });
})();
