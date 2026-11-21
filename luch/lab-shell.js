// Общий слой для всех лабораторий «Луча» (подключается из /luch/tutor.js):
// - вкладки «Теория · Практика · ДЗ» вместо «Обзор · Детали · Схема · Расчёты»
//   (старые вкладки остаются в странице скрытыми и переключаются отсюда, логика страницы не меняется);
// - домашнее задание к уроку: 3 задачи от ИИ, проверка ответа, подсказка;
// - «Поделиться»: ссылка на текущий урок (?l=номер), открывает страницу сразу на этом уроке.
(() => {
  const oldTabs = document.querySelector('.tabs[role="tablist"]');
  const T = id => document.getElementById('tab-' + id), P = id => document.getElementById('pane-' + id);
  if (!oldTabs || !T('overview') || !P('overview')) return;

  const css = `
  .ls-tabs{display:flex;align-items:stretch;border-bottom:1px solid var(--line,#26324a);flex:none}
  .ls-tabs button.g{flex:1;background:none;border:0;border-bottom:2px solid transparent;padding:14px 4px 12px;font:600 12px/1 var(--font-body,"Golos Text",sans-serif);letter-spacing:.1em;text-transform:uppercase;color:var(--muted,#8b96ad);cursor:pointer}
  .ls-tabs button.g[aria-selected="true"]{color:var(--fg,#e8ecf4);border-bottom-color:var(--accent,#ffb547)}
  .ls-tabs button.g:hover{color:var(--fg,#e8ecf4)}
  .ls-share{flex:none;width:46px;background:none;border:0;color:var(--muted,#8b96ad);cursor:pointer;display:grid;place-items:center}
  .ls-share:hover{color:var(--fg,#e8ecf4)}
  .ls-sub{display:flex;gap:6px;padding:10px 16px 0;flex:none;flex-wrap:wrap}
  .ls-sub[hidden]{display:none}
  .ls-sub button{background:var(--surface-2,#1a2438);border:1px solid var(--line,#26324a);border-radius:999px;padding:6px 12px;font:500 12.5px/1.2 var(--font-body,"Golos Text",sans-serif);color:var(--muted,#8b96ad);cursor:pointer}
  .ls-sub button[aria-pressed="true"]{background:var(--fg,#e8ecf4);color:var(--bg,#0b1019);border-color:var(--fg,#e8ecf4)}
  .ls-hw h2{font:500 18px/1.3 var(--font-display,"Unbounded",sans-serif);margin:4px 0 6px}
  .ls-hw .k{font:500 11px/1.4 var(--font-mono,monospace);color:var(--muted,#8b96ad);text-transform:uppercase;letter-spacing:.08em}
  .ls-hw p.note{color:var(--muted,#8b96ad);font-size:13.5px;margin:6px 0 14px}
  .ls-task{border:1px solid var(--line,#26324a);background:var(--surface-2,#1a2438);border-radius:12px;padding:12px 14px;margin:0 0 12px}
  .ls-task.ok{border-color:#86e0a8}
  .ls-task .lv{font:600 10.5px/1 var(--font-body,sans-serif);letter-spacing:.1em;text-transform:uppercase;color:var(--accent,#ffb547);margin-bottom:8px;display:flex;justify-content:space-between}
  .ls-task.ok .lv{color:#86e0a8}
  .ls-task .q{font-size:14.5px;line-height:1.5;margin:0 0 10px}
  .ls-task .row{display:flex;gap:6px}
  .ls-task input{flex:1;min-width:0;background:var(--bg,#0b1019);border:1px solid var(--line,#26324a);border-radius:9px;padding:9px 10px;color:var(--fg,#e8ecf4);font:500 14px var(--font-body,sans-serif)}
  .ls-btn{background:var(--fg,#e8ecf4);color:var(--bg,#0b1019);border:0;border-radius:9px;padding:9px 12px;font:600 13px var(--font-body,sans-serif);cursor:pointer;white-space:nowrap}
  .ls-btn.ghost{background:none;color:var(--muted,#8b96ad);border:1px solid var(--line,#26324a)}
  .ls-btn:disabled{opacity:.5;cursor:default}
  .ls-task .acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
  .ls-task .fb{margin-top:8px;font-size:13.5px;line-height:1.45;color:var(--fg,#e8ecf4)}
  .ls-task .hint{margin-top:8px;font-size:13px;color:var(--muted,#8b96ad)}
  .ls-toast{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:80;background:var(--fg,#e8ecf4);color:var(--bg,#0b1019);border-radius:12px;padding:12px 14px;font:500 14px var(--font-body,sans-serif);box-shadow:0 10px 30px -8px rgba(0,0,0,.6);display:flex;gap:10px;align-items:center;max-width:calc(100vw - 32px);flex-wrap:wrap}
  .ls-toast a{color:inherit;font-weight:600}
  `;
  const css1 = document.createElement('style'); css1.textContent = css; document.head.appendChild(css1);
  // рамка задания на стенде; на телефоне её переносим над опытом (см. «телефон» внизу), поэтому запоминаем сразу
  const stageTask = document.querySelector('#stage .task');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- вкладки ----------
  const GROUPS = {
    theory: { name: 'Теория', subs: [['overview', 'Объяснение'], ['parts', 'Детали']] },
    practice: { name: 'Практика', subs: [['scheme', 'Опыт и управление'], ['calc', 'Расчёты']] },
    hw: { name: 'ДЗ', subs: [] },
  };
  const SHARE = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="13.5" cy="4" r="2.2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="4.5" cy="9" r="2.2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="13.5" cy="14" r="2.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6.4 8l5.2-3M6.4 10l5.2 3" stroke="currentColor" stroke-width="1.6"/></svg>';
  const bar = document.createElement('div'); bar.className = 'ls-tabs'; bar.setAttribute('role', 'tablist');
  bar.innerHTML = Object.entries(GROUPS).map(([g, x]) => `<button class="g" role="tab" data-g="${g}" aria-selected="false">${x.name}</button>`).join('') +
    `<button class="ls-share" type="button" aria-label="Поделиться уроком" title="Поделиться уроком">${SHARE}</button>`;
  const sub = document.createElement('div'); sub.className = 'ls-sub';
  oldTabs.before(bar, sub); oldTabs.style.display = 'none';
  const hwPane = document.createElement('div'); hwPane.className = 'pbody ls-hw'; hwPane.id = 'pane-hw'; hwPane.setAttribute('role', 'tabpanel'); hwPane.hidden = true;
  P('calc').after(hwPane);

  const PANES = ['overview', 'parts', 'scheme', 'calc'];
  let group = 'theory', inHw = false;
  const lastSub = { theory: 'overview', practice: 'scheme' };
  const curTab = () => PANES.find(id => T(id) && T(id).getAttribute('aria-selected') === 'true') || 'overview';
  const groupOf = id => (id === 'scheme' || id === 'calc') ? 'practice' : 'theory';
  function paint() {
    bar.querySelectorAll('.g').forEach(b => b.setAttribute('aria-selected', b.dataset.g === group));
    const subs = GROUPS[group].subs, cur = curTab();
    sub.hidden = !subs.length;
    sub.innerHTML = subs.map(([id, n]) => `<button type="button" data-t="${id}" aria-pressed="${!inHw && id === cur}">${n}</button>`).join('');
  }
  function openHw() {
    inHw = true; group = 'hw';
    PANES.forEach(id => { if (P(id)) P(id).hidden = true; });
    hwPane.hidden = false; renderHw(); paint();
  }
  function openTab(id) {
    inHw = false; hwPane.hidden = true;
    group = groupOf(id); lastSub[group] = id;
    T(id).click();
    PANES.forEach(x => { if (P(x)) P(x).hidden = x !== id; });
    paint();
  }
  bar.addEventListener('click', e => {
    const b = e.target.closest('.g'); if (!b) return;
    if (b.dataset.g === 'hw') openHw(); else openTab(lastSub[b.dataset.g]);
  });
  sub.addEventListener('click', e => { const b = e.target.closest('button'); if (b) openTab(b.dataset.t); });
  // страница сама переключила вкладку (например, клик по детали на стенде)
  new MutationObserver(() => {
    const cur = curTab();
    if (inHw) { if (P(cur) && !P(cur).hidden) { inHw = false; hwPane.hidden = true; group = groupOf(cur); } else return; }
    group = groupOf(cur); lastSub[group] = cur; paint();
  }).observe(oldTabs, { attributes: true, subtree: true, attributeFilter: ['aria-selected'] });
  group = groupOf(curTab()); paint();

  // ---------- текущий урок и ссылка на него ----------
  const cards = () => [...document.querySelectorAll('.lessons button, .lessons .lesson')].filter(b => !b.closest('.ls-tabs'));
  function lessonIdx() {
    const list = cards(), cur = list.find(b => b.getAttribute('aria-current') === 'true');
    if (!cur) return 0;
    return cur.dataset.i !== undefined ? +cur.dataset.i : Math.max(0, list.indexOf(cur));
  }
  const lessonTitle = () => { const h = P('overview') && P('overview').querySelector('h2'); return h ? h.textContent.trim() : ''; };
  const lessonUrl = () => { const l = window.LuchI18n && window.LuchI18n.lang; return location.origin + location.pathname + '?l=' + (lessonIdx() + 1) + (l && l !== 'ru' ? '&lang=' + l : ''); };
  function syncUrl() { try { history.replaceState(null, '', location.pathname + '?l=' + (lessonIdx() + 1) + location.hash); } catch (e) {} }
  // открыть урок из ссылки ?l=N
  const want = parseInt(new URLSearchParams(location.search).get('l'), 10);
  if (want > 0) {
    // страница при смене урока сама прокручивает ленту уроков — возвращаем прокрутку наверх
    const go = () => { const list = cards(); const b = list.find(x => +x.dataset.i === want - 1) || list[want - 1]; if (b && lessonIdx() !== want - 1) { const y = scrollY; b.click(); requestAnimationFrame(() => scrollTo(0, y)); setTimeout(() => scrollTo(0, y), 60); } };
    go(); setTimeout(go, 300);
  }
  // шаблон лабораторий при старте прокручивает ленту уроков через scrollIntoView, и на телефоне
  // страница открывается внизу — возвращаем наверх, пока человек сам ничего не крутил
  let touched = false;
  ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(ev => addEventListener(ev, () => { touched = true; }, { once: true, passive: true }));
  if (!location.hash) [0, 60, 250, 600].forEach(ms => setTimeout(() => { if (!touched && scrollY > 0) scrollTo(0, 0); }, ms));
  const lessonsBox = document.querySelector('.lessons');
  if (lessonsBox) new MutationObserver(() => { syncUrl(); if (inHw) renderHw(); }).observe(lessonsBox, { attributes: true, subtree: true, childList: true, attributeFilter: ['aria-current'] });
  syncUrl();

  function toast(html, ms = 4000) {
    document.querySelectorAll('.ls-toast').forEach(t => t.remove());
    const t = document.createElement('div'); t.className = 'ls-toast'; t.setAttribute('role', 'status'); t.innerHTML = html;
    document.body.appendChild(t); setTimeout(() => t.remove(), ms);
  }
  bar.querySelector('.ls-share').addEventListener('click', async () => {
    const url = lessonUrl(), title = (lessonTitle() || document.title) + ' — интерактивный урок Open School AI';
    if (navigator.share && matchMedia('(pointer:coarse)').matches) { try { await navigator.share({ title, text: title, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    let copied = false;
    try { await navigator.clipboard.writeText(url); copied = true; } catch (e) {}
    const msg = encodeURIComponent(title + '\n' + url);
    toast(`${copied ? 'Ссылка на урок скопирована.' : esc(url)} Отправить: <a href="https://wa.me/?text=${msg}" target="_blank" rel="noopener">WhatsApp</a> · <a href="https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}" target="_blank" rel="noopener">Telegram</a>`, 6000);
  });

  // ---------- домашнее задание ----------
  const LANG = (window.LuchI18n && window.LuchI18n.lang) || 'ru';
  const HWKEY = () => 'luch-hw:' + location.pathname + ':' + lessonIdx() + (LANG === 'ru' ? '' : ':' + LANG);
  const load = () => { try { return JSON.parse(localStorage.getItem(HWKEY()) || 'null'); } catch (e) { return null; } };
  const save = v => { try { localStorage.setItem(HWKEY(), JSON.stringify(v)); } catch (e) {} };
  const ctx = () => { try { return (window.LUCH_CONTEXT && window.LUCH_CONTEXT()) || ''; } catch (e) { return ''; } };
  let loading = false;
  function renderHw() {
    const hw = load(), n = lessonIdx() + 1, title = lessonTitle();
    let h = `<div class="k">Урок ${n}${title ? ' · ' + esc(title) : ''}</div><h2>Домашнее задание</h2>`;
    if (!hw) {
      h += `<p class="note">Три задачи по этому уроку: лёгкая, средняя и жизненная. Ответ проверит ИИ-учитель и подскажет, если что-то не так.</p>
        <button class="ls-btn" id="ls-make" ${loading ? 'disabled' : ''}>${loading ? 'Составляю задачи…' : 'Получить задание'}</button>`;
    } else {
      const done = hw.tasks.filter(t => t.ok).length;
      h += `<p class="note">Решено ${done} из ${hw.tasks.length}. ${done === hw.tasks.length ? 'Отличная работа! 🎉' : 'Решайте по порядку, подсказка не отнимает баллов.'}</p>`;
      h += hw.tasks.map((t, i) => `<div class="ls-task ${t.ok ? 'ok' : ''}" data-i="${i}">
          <div class="lv"><span>${i + 1}. ${esc(t.level || '')}</span><span>${t.ok ? 'решено ✓' : ''}</span></div>
          <p class="q" data-noi18n>${esc(t.q)}</p>
          <div class="row"><input type="text" value="${esc(t.mine || '')}" placeholder="Ваш ответ" aria-label="Ответ на задачу ${i + 1}" ${t.ok ? 'readonly' : ''}>
            <button class="ls-btn" data-a="check" ${t.ok ? 'disabled' : ''}>Проверить</button></div>
          <div class="acts"><button class="ls-btn ghost" data-a="hint">Подсказка</button><button class="ls-btn ghost" data-a="ask">Спросить наставника</button></div>
          ${t.showHint ? `<div class="hint" data-noi18n>💡 ${esc(t.hint)}</div>` : ''}
          ${t.fb ? `<div class="fb" data-noi18n>${esc(t.fb)}</div>` : ''}</div>`).join('');
      h += `<button class="ls-btn ghost" id="ls-make">Другие задачи</button>`;
    }
    hwPane.innerHTML = h;
  }
  hwPane.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'ls-make') {
      if (loading) return; loading = true; save(null); renderHw();
      try {
        const r = await fetch('/api/tutor/hw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'make', lang: LANG, context: document.title + '\n' + ctx() }) });
        const j = await r.json();
        if (!r.ok || !j.tasks) throw new Error(j.error || 'error');
        save({ tasks: j.tasks });
      } catch (err) { toast('Не получилось составить задание. Попробуйте ещё раз.'); }
      loading = false; renderHw(); return;
    }
    const card = b.closest('.ls-task'); if (!card) return;
    const hw = load(), i = +card.dataset.i, t = hw.tasks[i];
    if (b.dataset.a === 'hint') { t.showHint = !t.showHint; save(hw); renderHw(); return; }
    if (b.dataset.a === 'ask') { if (window.LuchTutor) window.LuchTutor.ask(`Помоги с задачей из домашнего задания, но не говори ответ сразу: «${t.q}»${t.mine ? ` Мой ответ: ${t.mine}.` : ''}`); return; }
    if (b.dataset.a === 'check') {
      const val = card.querySelector('input').value.trim(); if (!val) return;
      t.mine = val; b.disabled = true; b.textContent = 'Проверяю…';
      try {
        const r = await fetch('/api/tutor/hw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'check', lang: LANG, context: document.title + '\n' + ctx(), task: t, answer: val }) });
        const j = await r.json(); if (!r.ok) throw new Error(j.error);
        t.ok = !!j.ok; t.fb = j.feedback;
      } catch (err) { t.fb = 'Не получилось проверить. Попробуйте ещё раз.'; }
      save(hw); renderHw();
    }
  });
  hwPane.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input')) { const b = e.target.closest('.ls-task').querySelector('[data-a="check"]'); if (b && !b.disabled) b.click(); } });

  // ---------- урок начинается с теории: «Теория» (рассказ с картинками или видео) → практика → ДЗ ----------
  const css2 = document.createElement('style');
  css2.textContent = `
  .ls-story{margin:12px 16px 0;border:1px solid var(--line,#26324a);border-radius:14px;background:linear-gradient(135deg,var(--surface-2,#1a2438),var(--surface,#121a28));padding:12px;flex:none}
  .ls-story[hidden]{display:none}
  .ls-story .play{display:flex;align-items:center;gap:12px;width:100%;background:none;border:0;color:var(--fg,#e8ecf4);cursor:pointer;text-align:left;padding:0}
  .ls-story .play i{width:42px;height:42px;flex:none;border-radius:50%;background:var(--accent,#ffb547);display:grid;place-items:center;color:#0b1019;font-style:normal;font-size:16px}
  .ls-story .play b{display:block;font:600 15px/1.25 var(--font-body,"Golos Text",sans-serif)}
  .ls-story .play small{display:block;font:500 12px/1.35 var(--font-mono,monospace);color:var(--muted,#8b96ad);margin-top:3px}
  #taskState.ls-ok{animation:ls-ok .9s ease-out}
  @keyframes ls-ok{0%{color:#22c55e;text-shadow:0 0 12px rgba(34,197,94,.6)}100%{text-shadow:none}}
  .ls-done{position:fixed;left:50%;top:14px;z-index:80;transform:translate(-50%,-30px);opacity:0;pointer-events:none;background:#16a34a;color:#fff;border-radius:14px;padding:10px 18px;box-shadow:0 12px 32px -8px rgba(0,0,0,.5);display:flex;flex-direction:column;align-items:center;gap:2px;font:500 14px/1.35 var(--font-body,system-ui,sans-serif);transition:opacity .25s,transform .25s;max-width:calc(100vw - 28px);text-align:center}
  .ls-done b{font-size:16px}.ls-done.on{opacity:1;transform:translate(-50%,0)}
  @media (prefers-reduced-motion:reduce){#taskState.ls-ok{animation:none}.ls-done{transition:none}}
  .lr-cover{display:none!important}
  .ls-start{position:fixed;inset:0;z-index:70;display:grid;place-items:center;background:rgba(5,8,14,.72);padding:16px}
  .ls-start .card{width:min(440px,100%);background:var(--surface,#121a28);border:1px solid var(--line,#26324a);border-radius:20px;padding:24px;box-shadow:0 30px 80px -20px rgba(0,0,0,.8);color:var(--fg,#e8ecf4)}
  .ls-start .k{font:500 11px/1.4 var(--font-mono,monospace);letter-spacing:.1em;text-transform:uppercase;color:var(--muted,#8b96ad)}
  .ls-start h3{font:500 22px/1.25 var(--font-display,"Unbounded",sans-serif);margin:8px 0 10px;text-wrap:balance}
  .ls-start p{margin:0 0 18px;color:var(--muted,#8b96ad);font-size:14.5px;line-height:1.55}
  .ls-start .acts{display:flex;flex-direction:column;gap:8px}
  .ls-start .ls-lsn{list-style:none;margin:0 0 14px;padding:0;display:flex;flex-direction:column;gap:3px}
  .ls-start .ls-lsn li{display:flex;gap:10px;align-items:center;font-size:13.5px;color:var(--muted,#8b96ad);padding:5px 8px;border-radius:8px}
  .ls-start .ls-lsn li b{font:500 11px var(--font-mono,monospace);min-width:18px;height:18px;display:grid;place-items:center;border-radius:50%;border:1px solid var(--line,#26324a)}
  .ls-start .ls-lsn li.ok b{background:rgba(94,220,150,.15);border-color:rgba(94,220,150,.5);color:#5edc96}
  .ls-start .ls-lsn li.cur{background:rgba(255,181,71,.1);color:var(--fg,#e8ecf4)}.ls-start .ls-lsn li.cur b{background:var(--accent,#ffb547);border-color:var(--accent,#ffb547);color:#1a1300}
  .ls-start .flow{font:500 11px/1.4 var(--font-mono,monospace);letter-spacing:.06em;color:var(--muted,#8b96ad);margin:0 0 14px}
  .ls-start .ls-btn{padding:13px 16px;font-size:15px;border-radius:12px}
  .ls-start .ls-btn.main{background:var(--accent,#ffb547)}
  .ls-stage{position:fixed;inset:0;z-index:72;display:grid;place-items:center;background:rgba(5,8,14,.86);padding:16px;animation:ls-in .25s ease}
  @keyframes ls-in{from{opacity:0}}
  .ls-stage .frame{width:min(920px,100%,calc((100vh - 290px) * 1.78));min-width:min(560px,100%);max-height:100%;display:flex;flex-direction:column;background:var(--surface,#121a28);border:1px solid var(--line,#26324a);border-radius:20px;overflow:hidden;box-shadow:0 30px 90px -20px rgba(0,0,0,.9);color:var(--fg,#e8ecf4)}
  .ls-stage .pic{position:relative;aspect-ratio:16/9;background:linear-gradient(120deg,#1a2438,#22304a,#1a2438);background-size:200% 100%;animation:ls-shim 2.4s linear infinite;overflow:hidden;flex:none}
  .ls-stage .pic.has{animation:none;background:#0b1019;cursor:pointer}
  .ls-stage .big{position:absolute;left:50%;top:50%;z-index:3;width:78px;height:78px;margin:-39px 0 0 -39px;border-radius:50%;border:0;padding:0;background:rgba(11,16,25,.58);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);color:#fff;font-size:28px;line-height:1;display:grid;place-items:center;cursor:pointer;opacity:0;transform:scale(.92);transition:opacity .25s ease,transform .25s ease;box-shadow:0 10px 30px rgba(0,0,0,.35)}
  .ls-stage .big span{display:block;transform:translateX(var(--nx,0))}
  .ls-stage .pic.has:hover .big,.ls-stage.paused .pic.has .big,.ls-stage .big.flash,.ls-stage .big:focus-visible{opacity:1;transform:none}
  .ls-stage .pic:not(.has) .big,.ls-stage.done .big{display:none}
  @media (hover:none){.ls-stage .pic.has .big{opacity:.85;transform:none}}
  @keyframes ls-shim{to{background-position:-200% 0}}
  .ls-stage .ph{position:absolute;inset:0;display:grid;place-items:center;font:500 12px/1 var(--font-mono,monospace);letter-spacing:.12em;text-transform:uppercase;color:var(--muted,#8b96ad)}
  .ls-stage .pic.has .ph{display:none}
  .ls-stage .pic img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .8s ease;transform-origin:50% 50%}
  .ls-stage .pic img.on{opacity:1;animation:ls-kb 18s ease-out forwards}
  .ls-stage .pic .brd{position:absolute;inset:0;container-type:size;opacity:0;transition:opacity .8s ease;display:grid;place-items:center;padding:4% 6%;background:radial-gradient(120% 90% at 30% 20%,#2c4a3c,#1a2e25 70%);box-shadow:inset 0 0 0 10px #4a3524,inset 0 0 40px rgba(0,0,0,.5);color:#f4f1e8;overflow:hidden}
  .ls-stage .pic .brd.on{opacity:1}
  .ls-stage .pic .brd.sch{display:block;padding:0;box-shadow:none;background:radial-gradient(120% 95% at 50% 35%,var(--stage-hi,#1c2740) 0%,var(--stage-lo,#111a2b) 62%,var(--bg,#0b1019) 100%)}
  .ls-stage .pic .brd.sch .tag{position:absolute;left:12px;top:12px;font:700 12px/1 var(--font-mono,monospace);letter-spacing:.08em;text-transform:uppercase;color:#0b1019;background:var(--accent,#ffb547);padding:6px 9px;border-radius:999px}
  .ls-stage .pic:has(.brd.on) .big{top:auto;right:auto;left:18px;bottom:18px;margin:0;width:52px;height:52px;font-size:18px}
  .ls-stage .pbtn{position:absolute;z-index:4;width:40px;height:40px;border-radius:12px;border:0;padding:0;display:grid;place-items:center;background:rgba(11,16,25,.58);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);color:#fff;font-size:18px;cursor:pointer;transition:background .15s}
  .ls-stage .pbtn:hover,.ls-stage .pbtn:focus-visible{background:rgba(11,16,25,.85)}
  .ls-stage .pbtn.px{top:10px;right:10px}
  .ls-stage .pbtn.pfs{bottom:10px;right:10px}
  .ls-stage .pic .brd .in{display:flex;flex-direction:column;gap:3cqh;max-width:100%}
  .ls-stage .pic .brd .f{font:600 clamp(20px,7cqw,64px)/1.15 "Golos Text",system-ui,sans-serif;color:#ffd166;text-align:center;letter-spacing:.02em;text-shadow:0 0 1px rgba(255,209,102,.6)}
  .ls-stage .pic .brd ul{list-style:none;margin:0 auto;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,38cqw),1fr));gap:.6cqh 3cqw;font:500 clamp(11px,2.7cqw,24px)/1.35 "Golos Text",system-ui,sans-serif;color:#e8e4d8}
  .ls-stage .pic .brd li b{color:#7fd4ff;font-weight:700}
  .ls-stage .pic .brd li i{color:#9be89b;font-style:normal}
  .ls-stage.paused .pic img.on{animation-play-state:paused}
  @keyframes ls-kb{from{transform:scale(1)}to{transform:scale(1.09) translate(-1%,-1%)}}
  .ls-stage.done .pic img.on{animation:none}
  .ls-stage .txt{padding:16px 20px 4px;overflow:auto;min-height:0}
  .ls-stage .txt b{display:block;font:600 12px/1 var(--font-body,sans-serif);letter-spacing:.12em;text-transform:uppercase;color:var(--accent,#ffb547);margin-bottom:8px}
  .ls-stage .txt p{margin:0;font-size:16.5px;line-height:1.55;text-wrap:pretty}
  .ls-stage .end{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
  .ls-stage .end .ls-btn{padding:12px 16px;font-size:15px;border-radius:12px}
  .ls-stage .end .main{background:var(--accent,#ffb547)}
  .ls-stage .dots{display:flex;gap:6px;padding:12px 20px 0}
  .ls-stage .dots button{flex:1;height:5px;border:0;border-radius:3px;background:var(--line,#26324a);cursor:pointer;padding:0}
  .ls-stage .dots button.on{background:var(--accent,#ffb547)}
  .ls-stage .dots button.cur{box-shadow:0 0 0 2px rgba(255,181,71,.25)}
  .ls-stage .ctl{display:flex;align-items:center;gap:8px;padding:12px 16px 16px}
  .ls-stage .ctl .sp{flex:1}
  .ls-stage .fsb{display:grid;place-items:center}
  .ls-stage.fs{padding:0;place-items:stretch;background:#05080e}
  .ls-stage.fs .frame{width:100%;max-width:none;min-width:0;height:100%;max-height:none;border-radius:0;border:0;box-shadow:none}
  .ls-stage.fs .pic{flex:1 1 auto;aspect-ratio:auto;min-height:0}
  .ls-stage.fs .pic img{object-fit:contain;background:#05080e}
  .ls-stage.fs .txt{flex:none;max-height:26vh}
  .ls-stage.fs .pic .brd .f{font-size:clamp(24px,6cqw,84px)}
  .ls-stage .ic{width:44px;height:44px;border-radius:12px;border:1px solid var(--line,#26324a);background:var(--surface-2,#1a2438);color:var(--fg,#e8ecf4);font-size:20px;cursor:pointer;flex:none}
  .ls-stage .ic.rate{width:auto;min-width:52px;padding:0 10px;font:600 14px/1 var(--font-mono,monospace)}
  .ls-stage.done .ic.rate{visibility:hidden}
  .ls-stage .volw{position:relative;flex:none}
  .ls-stage .ic.vol{display:inline-grid;place-items:center}
  .ls-stage .ic.vol svg{width:20px;height:20px}
  .ls-stage .volp{position:absolute;bottom:52px;left:50%;transform:translateX(-50%);z-index:5;background:var(--surface-2,#1a2438);border:1px solid var(--line,#26324a);border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:10px;box-shadow:0 8px 24px rgba(0,0,0,.35)}
  .ls-stage .volp[hidden]{display:none}
  .ls-stage .volp input{width:150px;accent-color:var(--accent,#ffb547)}
  .ls-stage .volp b{font:600 13px/1 var(--font-mono,monospace);min-width:38px;text-align:right;color:var(--fg,#e8ecf4)}
  .ls-stage.done .volw{visibility:hidden}
  .ls-stage .pp{height:44px;padding:0 18px;border-radius:12px;border:0;background:var(--accent,#ffb547);color:#0b1019;font:600 15px/1 var(--font-body,sans-serif);cursor:pointer;display:inline-flex;align-items:center;gap:8px;flex:none}
  .ls-stage.done .pp,.ls-stage.done [data-a="next"]{visibility:hidden}
  .ls-stage .ctl .ls-btn{height:44px;padding:0 14px;border-radius:12px}
  .ls-stage button:focus-visible{outline:2px solid var(--accent,#ffb547);outline-offset:2px}
  @media (max-width:600px){
    .ls-stage{padding:0;place-items:stretch}
    .ls-stage .frame{border-radius:0;border:0;height:100%}
    .ls-stage .txt{flex:1}
    .ls-stage .txt p{font-size:16px}
    .ls-stage .pp span{display:none}
    .ls-stage .ctl{padding-bottom:max(16px,env(safe-area-inset-bottom));flex-wrap:wrap;row-gap:10px}
    .ls-stage .ctl .ls-btn[data-a="practice"]{flex:1 1 100%;order:9}
    .ls-stage .volp{left:auto;right:-70px;transform:none}
  }
  .ls-stage .pv{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;gap:10px;padding:22px 28px;background:radial-gradient(120% 120% at 20% 0%,rgba(255,181,71,.16),transparent 60%),linear-gradient(135deg,#16213a,#0e1626);transition:opacity .5s ease}
  .ls-stage .pic.has .pv{opacity:0;pointer-events:none}
  .ls-stage .pv .k{font:500 11px/1 var(--font-mono,monospace);letter-spacing:.12em;text-transform:uppercase;color:var(--muted,#8b96ad)}
  .ls-stage .pv h4{margin:0;font:500 clamp(18px,3.2vw,28px)/1.2 var(--font-display,"Unbounded",sans-serif);color:var(--fg,#e8ecf4);text-wrap:balance}
  .ls-stage .pv ul{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:6px 14px;font:500 12.5px/1.3 var(--font-body,sans-serif);color:var(--muted,#8b96ad)}
  .ls-stage .pv li:before{content:"";display:inline-block;width:9px;height:9px;margin-right:7px;border-radius:50%;border:2px solid currentColor;vertical-align:-1px;animation:ls-pulse 1.1s ease-in-out infinite}
  .ls-stage .pv li.ok{color:#86e0a8}
  .ls-stage .pv li.ok:before{background:currentColor;animation:none}
  .ls-stage .pv .go{font:600 clamp(20px,3.6vw,32px)/1.2 var(--font-display,"Unbounded",sans-serif);color:var(--accent,#ffb547);animation:ls-in .3s ease}
  @keyframes ls-pulse{50%{opacity:.35}}
  .ls-stage .fact{font-size:15px;line-height:1.55;color:var(--fg,#e8ecf4);transition:opacity .4s ease;min-height:3.1em}
  .ls-stage .fact.out{opacity:0}
  .ls-stage .fact small{display:block;font:600 11px/1 var(--font-body,sans-serif);letter-spacing:.1em;text-transform:uppercase;color:var(--muted,#8b96ad);margin-bottom:7px}
  .ls-stage .pic .wt{position:absolute;right:12px;bottom:12px;width:26px;height:26px;border-radius:50%;border:3px solid rgba(255,255,255,.25);border-top-color:var(--accent,#ffb547);animation:ls-spin .8s linear infinite;opacity:0;transition:opacity .2s}
  .ls-stage.wait .pic .wt{opacity:1}
  @keyframes ls-spin{to{transform:rotate(360deg)}}
  .ls-stage .txt p .w{color:var(--muted,#8b96ad);transition:color .12s ease;border-radius:4px}
  .ls-stage .txt p .w.sp{color:var(--fg,#e8ecf4)}
  .ls-stage .txt p .w.cur{color:#0b1019;background:var(--accent,#ffb547);box-shadow:0 0 0 2px var(--accent,#ffb547)}
  @media (prefers-reduced-motion:reduce){.ls-stage .pic img.on{animation:none}.ls-stage{animation:none}.ls-stage .pv li:before,.ls-stage .pic .wt{animation:none}}`;
  css2.textContent += `
  .ls-tplay{pointer-events:auto;position:relative;z-index:2;display:inline-flex;align-items:center;gap:7px;margin:4px 0 6px;padding:5px 11px 5px 5px;border-radius:999px;border:1px solid var(--accent,#ffb547);background:rgba(255,181,71,.1);color:var(--fg,#e8ecf4);font:600 12.5px/1.2 var(--font-body,"Golos Text",sans-serif);cursor:pointer;white-space:nowrap;max-width:100%}
  .ls-tplay i{width:22px;height:22px;border-radius:50%;background:var(--accent,#ffb547);color:#0b1019;display:grid;place-items:center;font-style:normal;font-size:10px;padding-left:2px}
  .ls-tplay:hover{background:rgba(255,181,71,.2)}`;
  document.head.appendChild(css2);
  const story = document.createElement('div'); story.className = 'ls-story';
  sub.after(story);
  const LANG2 = (window.LuchI18n && window.LuchI18n.lang) || 'ru';
  // Старые ролики-рилсы (разделы «Механика», «Оптика») больше не показываем: везде одинаково — лекция, потом практика
  const reelBtn = () => null;
  const taskBox = () => [...document.querySelectorAll('[class*="task"]')].find(e => e.offsetParent && !e.closest('.ls-story,.ls-start,#pane-hw,.lt-panel,.lt-tip') && e.getBoundingClientRect().width > 120);
  const toPractice = () => { stopStory(); openTab('scheme'); const t = taskBox(); if (t && window.LuchTutor && window.LuchTutor.highlight) window.LuchTutor.highlight(t); };
  let cache = {};
  const storyKey = () => location.pathname + '|' + lessonIdx();
  function fetchStory() {
    const k = storyKey();
    if (!cache[k]) cache[k] = fetch('/api/tutor/story', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: k, lang: LANG2, context: 'Тема: ' + document.title + '\nУрок ' + (lessonIdx() + 1) + ': ' + lessonTitle() + '\n' + ctx() }) })
      .then(r => r.json().then(j => { if (!r.ok || !j.sections) throw new Error(j.error || 'story'); return j; })).catch(e => { delete cache[k]; throw e; });
    return cache[k];
  }
  function storyIdle() {
    const reel = reelBtn();
    story.innerHTML = `<button type="button" class="play" data-a="story"><i>▶</i><span><b>Прослушать лекцию</b><small>картинки и голос · теория, формулы и что делать в опыте</small></span></button>` +
      (reel ? `<div class="acts" style="display:flex;gap:6px;margin-top:10px"><button class="ls-btn" data-a="reel">▶ Смотреть видео</button><button class="ls-btn ghost" data-a="story">Прослушать лекцию</button></div>` : '');
  }
  // Плеер «Теории»: картинка на раздел + голос + подпись. Пауза доступна всегда.
  const imgUrl = i => '/api/tutor/story/img?k=' + encodeURIComponent(storyKey() + '|' + LANG2) + '&i=' + i;
  const tts = text => fetch('/api/tutor/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, hq: true }) }).then(r => r.ok ? r.blob() : null).catch(() => null);
  let st = null, lecture = null; // { el, secs, i, paused, audio, voice:[promise], timer, run }
  function stopStory() {
    if (!st) return;
    st.run = -1; clearTimeout(st.timer); clearInterval(st.factT); cancelAnimationFrame(st.kRaf);
    try { st.audio.pause(); st.audio.removeAttribute('src'); } catch (e) {}
    (st.url || []).forEach(u => u && URL.revokeObjectURL(u));
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    st.el.remove(); removeEventListener('keydown', stKeys, true); st = null;
  }
  function stKeys(e) {
    if (!st) return;
    if (e.key === 'Escape') { e.preventDefault(); if (st.el.classList.contains('fs')) setFs(false); else stopStory(); }
    else if ((e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А') && !/INPUT|TEXTAREA/.test(e.target.tagName)) { e.preventDefault(); toggleFs(); }
    else if (e.key === ' ' && !/INPUT|TEXTAREA/.test(e.target.tagName)) { e.preventDefault(); togglePause(); }
    else if (/INPUT/.test(e.target.tagName)) return; // стрелки на ползунке громкости — ему
    else if (e.key === 'ArrowRight') stGo(st.i + 1);
    else if (e.key === 'ArrowLeft') stGo(Math.max(0, st.i - 1));
  }
  // скорость лекции — как в плеерах; общая с аудиогидом, запоминается
  const RATES = [1, 1.2, 1.5, 2];
  // громкость лекции (0…1), по умолчанию полная; запоминаем между уроками
  let vol = 1; try { const v = parseFloat(localStorage.getItem('ag-vol')); if (v >= 0 && v <= 1) vol = v; } catch (e) {}
  const VOL_ICON = v => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/>' + (v === 0 ? '<path d="M17 9l5 6M22 9l-5 6"/>' : (v > 0 ? '<path d="M16.5 9.5a3.5 3.5 0 0 1 0 5"/>' : '') + (v > 0.5 ? '<path d="M19 7a7 7 0 0 1 0 10"/>' : '')) + '</svg>';
  function paintVol() { const b = st && st.el.querySelector('[data-a="vol"]'); if (!b) return; b.innerHTML = VOL_ICON(vol); const p = st.el.querySelector('.volp'); if (p) { p.querySelector('input').value = Math.round(vol * 100); p.querySelector('b').textContent = Math.round(vol * 100) + '%'; } }
  function setVol(v) { vol = Math.max(0, Math.min(1, v)); try { localStorage.setItem('ag-vol', vol); } catch (e) {} if (st && st.audio) st.audio.volume = vol; paintVol(); }
  let rate = 1.2; try { rate = RATES.includes(+localStorage.getItem('ag-rate')) ? +localStorage.getItem('ag-rate') : 1.2; } catch (e) {} // по умолчанию 1,2×
  function paintRate() { const b = st && st.el.querySelector('[data-a="rate"]'); if (!b) return; const t = String(rate).replace('.', ',') + '×'; b.textContent = t; b.setAttribute('aria-label', 'Скорость ' + t); }
  function stPaint() {
    paintRate();
    const el = st.el, pp = el.querySelector('.ctl [data-a="pp"]');
    pp.innerHTML = st.paused ? '▶ <span>Продолжить</span>' : '❚❚ <span>Пауза</span>';
    pp.setAttribute('aria-label', st.paused ? 'Продолжить' : 'Пауза');
    const big = el.querySelector('.big');
    if (big) { big.firstChild.textContent = st.paused ? '▶' : '❚❚'; big.style.setProperty('--nx', st.paused ? '3px' : '0'); big.setAttribute('aria-label', st.paused ? 'Продолжить' : 'Пауза');
      big.classList.add('flash'); clearTimeout(big._t); big._t = setTimeout(() => big.classList.remove('flash'), 700); }
    el.classList.toggle('paused', st.paused);
  }
  function togglePause() {
    if (!st || st.i >= st.secs.length) return;
    st.paused = !st.paused;
    if (st.paused) { try { st.audio.pause(); } catch (e) {} clearTimeout(st.timer); }
    else if (st.audio.src && !st.audio.ended && st.audio.currentTime > 0) st.audio.play().catch(() => {});
    else stGo(st.i);
    stPaint();
  }
  // На весь экран — как у видео: настоящий полноэкранный режим браузера, а где его
  // нет (iPhone) — плеер растягивается на всё окно. Кнопка ⤢, клавиша F, двойной клик.
  const FS_ICON = {
    on: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    off: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>' };
  function paintFs() {
    if (!st) return; const on = st.el.classList.contains('fs'), b = st.el.querySelector('[data-a="fs"]');
    if (b) { b.innerHTML = on ? FS_ICON.off : FS_ICON.on; b.setAttribute('aria-label', on ? 'Свернуть' : 'На весь экран'); b.title = on ? 'Свернуть (F)' : 'На весь экран (F)'; }
  }
  function setFs(on) {
    if (!st) return; const el = st.el;
    el.classList.toggle('fs', on); paintFs();
    if (on && el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().catch(() => {});
    if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }
  const toggleFs = () => st && setFs(!st.el.classList.contains('fs'));
  // вышли кнопкой браузера (Esc в полноэкранном) — убираем и растяжку
  document.addEventListener('fullscreenchange', () => { if (st && !document.fullscreenElement && st.el.classList.contains('fs')) { st.el.classList.remove('fs'); paintFs(); } });
  function stShell() {
    const el = document.createElement('div'); el.className = 'ls-stage'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Теория');
    el.innerHTML = '<div class="frame"><div class="pic"><div class="pv"><div class="k">Урок ' + (lessonIdx() + 1) + ' · теория</div><h4></h4>' +
      '<ul><li data-s="text">Пишу лекцию</li><li data-s="img">Рисую картинки</li><li data-s="voice">Записываю голос</li></ul></div><i class="wt"></i><button class="big" data-a="pp" aria-label="Пауза"><span>❚❚</span></button>' +
      '<button class="pbtn px" data-a="close" aria-label="Закрыть" title="Закрыть (Esc)">✕</button>' +
      '<button class="pbtn pfs fsb" data-a="fs" aria-label="На весь экран" title="На весь экран (F)">' + FS_ICON.on + '</button></div>' +
      '<div class="txt" data-noi18n><b>Готовлю лекцию</b><div class="fact"></div></div>' +
      '<div class="dots"></div>' +
      '<div class="ctl"><button class="ic" data-a="prev" aria-label="Назад">‹</button><button class="pp" data-a="pp"></button><button class="ic" data-a="next" aria-label="Дальше">›</button>' +
      '<button class="ic rate" data-a="rate" aria-label="Скорость 1,2×" title="Скорость: 1×, 1,2×, 1,5×, 2×">1,2×</button>' +
      '<span class="volw"><button class="ic vol" data-a="vol" aria-label="Громкость" title="Громкость"></button><span class="volp" hidden><input type="range" min="0" max="100" step="5" aria-label="Громкость"><b></b></span></span>' +
      '<span class="sp"></span><button class="ls-btn ghost" data-a="practice">К практике →</button></div></div>';
    el.addEventListener('click', e => {
      if (e.target === el) return stopStory();
      const b = e.target.closest('[data-a]');
      if (!b && st && e.target.closest('.pic.has') && !el.classList.contains('done')) return togglePause(); // как у видео: нажал на картинку — пауза
      if (!b || !st) return;
      const a = b.dataset.a;
      if (a === 'pp') togglePause();
      else if (a === 'prev') stGo(Math.max(0, st.i - 1));
      else if (a === 'next') stGo(st.i + 1);
      else if (a === 'dot') stGo(+b.dataset.i);
      else if (a === 'close') stopStory();
      else if (a === 'again') stGo(0);
      else if (a === 'rate') { rate = RATES[(RATES.indexOf(rate) + 1) % RATES.length]; try { localStorage.setItem('ag-rate', rate); } catch (e) {} st.audio.playbackRate = rate; paintRate(); }
      else if (a === 'vol') { const p = el.querySelector('.volp'); p.hidden = !p.hidden; }
      else if (a === 'practice') toPractice();
      else if (a === 'fs') toggleFs();
      else if (a === 'askq') { stopStory(); if (window.LuchTutor && window.LuchTutor.talk) window.LuchTutor.talk('Какой вопрос по объяснению? Спрашивай голосом — я слушаю. Можно и написать.'); }
    });
    el.querySelector('.volp input').addEventListener('input', e => setVol(e.target.value / 100));
    el.querySelector('.volp').addEventListener('click', e => e.stopPropagation());
    el.querySelector('.pv h4').textContent = lessonTitle() || document.title;
    el.querySelector('.pic').addEventListener('dblclick', e => { e.preventDefault(); toggleFs(); });
    return el;
  }
  // пока готовится лекция — полезные факты с этой же страницы
  function pageFacts() {
    const txt = [...document.querySelectorAll('#pane-overview p, #pane-overview li')].map(e => e.textContent.replace(/\s+/g, ' ').trim()).join(' ');
    return (txt.match(/[^.!?]+[.!?]/g) || []).map(x => x.trim()).filter(x => x.length >= 40 && x.length <= 180);
  }
  function factsLoop(me) {
    const box = me.el.querySelector('.fact'), list = pageFacts();
    if (!list.length) { box.innerHTML = '<small>Минутку</small>Сейчас будет лекция с картинками: что это, зачем нужно, как работает и немного истории.'; return; }
    let k = 0;
    const show = () => { box.innerHTML = '<small>Пока готовлю — знаете ли вы?</small>' + esc(list[k % list.length]); };
    show();
    me.factT = setInterval(() => { box.classList.add('out'); setTimeout(() => { k++; show(); box.classList.remove('out'); }, 400); }, 4800);
  }
  // слова текста становятся «караоке»: подсвечиваем то, что сейчас звучит
  function karaoke(p, text) {
    p.innerHTML = text.split(/(\s+)/).map(t => /^\s+$/.test(t) ? t : '<span class="w">' + esc(t) + '</span>').join('');
    const ws = [...p.querySelectorAll('.w')], cum = []; let tot = 0;
    ws.forEach(w => { const t = w.textContent; tot += t.length + 1 + (/[.!?…]$/.test(t) ? 7 : /[,;:—–)]$/.test(t) ? 3 : 0); cum.push(tot); });
    return { ws, cum, tot, at: -1 };
  }
  function karaokeTick() {
    if (!st || !st.k) return;
    const a = st.audio, K = st.k;
    if (a.duration && isFinite(a.duration) && a.currentTime > 0) {
      const lead = 0.12, f = Math.max(0, Math.min(1, (a.currentTime - lead) / Math.max(0.5, a.duration - lead - 0.25)));
      const target = f * K.tot; let idx = K.cum.findIndex(c => c >= target); if (idx < 0) idx = K.ws.length - 1;
      if (a.ended) idx = K.ws.length;
      if (idx !== K.at) { K.ws.forEach((w, j) => { w.classList.toggle('sp', j < idx); w.classList.toggle('cur', j === idx); }); K.at = idx; }
    }
    st.kRaf = requestAnimationFrame(karaokeTick);
  }
  // доска с формулами — вместо картинки в разделах «Формула: …»
  function boardOf(sec) {
    const b = document.createElement('div'); b.className = 'brd';
    b.innerHTML = '<div class="in">' + sec.formulas.map(f => '<div class="f">' + esc(f.f) + '</div>' +
      (f.vars && f.vars.length ? '<ul>' + f.vars.map(v => '<li><b>' + esc(v[0] || '') + '</b> — ' + esc(v[1] || '') + (v[2] && v[2] !== '—' ? ' <i>(' + esc(v[2]) + ')</i>' : '') + '</li>').join('') + '</ul>' : '')).join('') + '</div>';
    return b;
  }
  // схема опыта из урока — копия живой сцены лаборатории (в разделе «Что будем делать на практике»)
  const sceneSvg = () => { const s = document.getElementById('scene'); return s && s.tagName.toLowerCase() === 'svg' && s.childElementCount ? s : null; };
  function schemeOf() {
    const s = sceneSvg(); if (!s) return null;
    const b = document.createElement('div'); b.className = 'brd sch';
    const c = s.cloneNode(true); c.removeAttribute('id'); c.setAttribute('aria-hidden', 'true'); c.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    // кадрируем по приборам: фон и сетку (почти во весь холст) не считаем
    try {
      const vb = s.viewBox.baseVal; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      if (vb && vb.width) for (const el of s.children) {
        if (!el.getBBox || /^(defs|style|title)$/i.test(el.tagName)) continue;
        const r = el.getBBox(); if (!r.width && !r.height) continue;
        if (r.width > vb.width * 1.5 || r.height > vb.height * 1.5 || (r.width > vb.width * .85 && r.height > vb.height * .5)) continue;
        x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.width); y1 = Math.max(y1, r.y + r.height);
      }
      if (isFinite(x0) && x1 > x0 && y1 > y0) {
        let w = x1 - x0, h = y1 - y0; const pad = Math.max(w, h) * .08; x0 -= pad; y0 -= pad; w += pad * 2; h += pad * 2;
        if (w / h < 16 / 9) { const nw = h * 16 / 9; x0 -= (nw - w) / 2; w = nw; } else { const nh = w * 9 / 16; y0 -= (nh - h) / 2; h = nh; }
        if (w < vb.width * .95 || h < vb.height * .95) c.setAttribute('viewBox', [x0, y0, w, h].map(v => v.toFixed(1)).join(' '));
      }
    } catch (e) {}
    c.style.cssText = 'position:absolute;inset:4%;width:92%;height:92%;pointer-events:none;overflow:visible';
    b.appendChild(c); b.insertAdjacentHTML('beforeend', '<span class="tag">Схема опыта</span>');
    return b;
  }
  const visualOf = sec => sec.formulas ? 'board' : sec.scheme && sceneSvg() ? 'scheme' : 'img';
  const loadImg = i => st.img[i] || (st.img[i] = (st.secs[i] && visualOf(st.secs[i]) !== 'img') ? Promise.resolve(null) : new Promise(res => {
    const im = new Image(); im.alt = ''; im.decoding = 'async';
    const t = setTimeout(() => res(null), 30000);
    im.onload = () => { clearTimeout(t); (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => res(im)); };
    im.onerror = () => { clearTimeout(t); res(null); };
    im.src = imgUrl(i);
  }));
  const voiceOf = i => st.voice[i] || (st.voice[i] = tts(st.secs[i].text));
  function stGo(i) {
    if (!st) return;
    const my = ++st.run; clearTimeout(st.timer);
    try { st.audio.pause(); } catch (e) {}
    st.i = i; st.paused = false;
    const el = st.el, secs = st.secs, pic = el.querySelector('.pic'), txt = el.querySelector('.txt');
    el.querySelector('.dots').innerHTML = secs.map((x, k) => '<button data-a="dot" data-i="' + k + '" class="' + (k < i ? 'on' : k === i ? 'on cur' : '') + '" aria-label="' + esc(x.title) + '"></button>').join('');
    if (i >= secs.length) { // конец
      journal(j => { j.theoryDone = true; });
      el.classList.add('done');
      const outro = 'Ну что, давай попробуем на практике! Если что-то осталось непонятным — ничего страшного: задай мне любой вопрос, я отвечу. Не переживай.';
      txt.innerHTML = '<b>Объяснение закончено</b><p>' + esc(outro) + '</p><div class="end"><button class="ls-btn main" data-a="practice">Перейти к практике →</button><button class="ls-btn ghost" data-a="again">Посмотреть ещё раз</button></div>';
      // наставник говорит это вслух, как продолжение объяснения (если раздел «на практике» уже сказал это сам — не повторяем)
      if (!(secs[secs.length - 1] || {}).scheme) tts(outro).then(blob => {
        if (!st || st.run !== my || !blob || blob.size < 100) return;
        st.url = st.url || []; const u = st.url[99] = st.url[99] || URL.createObjectURL(blob);
        st.audio.onended = null; st.audio.onerror = null; st.audio.src = u; st.audio.play().catch(() => {});
      });
      return stPaint();
    }
    el.classList.remove('done');
    const sec = secs[i];
    stPaint();
    // заранее готовим следующий раздел
    if (i + 1 < secs.length) { loadImg(i + 1); voiceOf(i + 1); }
    const waitT = setTimeout(() => { if (st && st.run === my) el.classList.add('wait'); }, 250);
    Promise.all([loadImg(i), voiceOf(i)]).then(([im, blob]) => {
      clearTimeout(waitT);
      if (!st || st.run !== my) return;
      el.classList.remove('wait');
      // картинка: плавная смена, лёгкий наезд камеры
      const old = pic.querySelector('img.on, .brd.on');
      const vis = visualOf(sec), node = vis === 'board' ? boardOf(sec) : vis === 'scheme' ? schemeOf() : im ? im.cloneNode() : null;
      if (node) {
        pic.appendChild(node);
        requestAnimationFrame(() => { node.classList.add('on'); if (old) old.classList.remove('on'); setTimeout(() => old && old.remove(), 900); pic.classList.add('has'); });
      } else pic.classList.add('has');
      txt.innerHTML = '<b>' + esc(sec.title) + '</b><p></p>';
      st.k = karaoke(txt.querySelector('p'), sec.text);
      cancelAnimationFrame(st.kRaf); st.kRaf = requestAnimationFrame(karaokeTick);
      const nextUp = () => { if (st && st.run === my && !st.paused) stGo(i + 1); };
      // голос — когда картинка уже проявилась
      st.timer = setTimeout(() => {
        if (!st || st.run !== my) return;
        if (blob && blob.size > 100) {
          st.url = st.url || []; st.url[i] = st.url[i] || URL.createObjectURL(blob);
          st.audio.onended = () => { karaokeTick(); journal(j => { j.heard = [...new Set([...(j.heard || []), i])]; j.parts = secs.length; j.titles = secs.map(x => x.title); }); setTimeout(nextUp, 800); };
          st.audio.onerror = () => { st.timer = setTimeout(nextUp, 6000); };
          st.audio.src = st.url[i]; st.audio.playbackRate = rate; st.audio.defaultPlaybackRate = rate;
          if (!st.paused) st.audio.play().catch(() => { st.paused = true; stPaint(); });
        } else { st.k.ws.forEach(w => w.classList.add('sp')); st.timer = setTimeout(nextUp, 7000 / rate); }
      }, im && !old ? 650 : 450);
    });
  }
  async function playStory(from = 0) {
    stopStory();
    const audio = new Audio();
    // разблокируем звук сразу по нажатию (на телефонах иначе не заиграет)
    audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA='; audio.play().catch(() => {});
    st = { el: stShell(), secs: [], i: 0, paused: false, audio, voice: [], img: [], run: 0 };
    audio.volume = vol; paintVol();
    document.body.appendChild(st.el); addEventListener('keydown', stKeys, true);
    st.el.querySelector('.ctl [data-a="pp"]').innerHTML = '❚❚ <span>Пауза</span>';
    const me = st;
    factsLoop(me);
    const step = k => { const li = me.el.querySelector('.pv li[data-s="' + k + '"]'); if (li) li.classList.add('ok'); };
    let s; try { s = await fetchStory(); } catch (e) {
      if (st !== me) return;
      clearInterval(me.factT);
      st.el.querySelector('.txt').innerHTML = '<b>Теория</b><p>Не получилось подготовить лекцию. Попробуйте ещё раз чуть позже.</p>';
      return;
    }
    if (st !== me) return;
    st.secs = s.sections; step('text'); lecture = s.sections;
    const f0 = Math.max(0, Math.min(from, st.secs.length - 1));
    const first = [loadImg(f0).then(x => (step('img'), x)), voiceOf(f0).then(x => (step('voice'), x))];
    if (st.secs[f0 + 1]) { loadImg(f0 + 1); voiceOf(f0 + 1); }
    await Promise.all(first);
    if (st !== me) return;
    clearInterval(me.factT);
    const pv = me.el.querySelector('.pv'); pv.querySelector('ul').outerHTML = '<div class="go">Готово, поехали!</div>';
    await new Promise(r => setTimeout(r, 900));
    if (st !== me) return;
    stGo(f0);
    st.el.querySelector('.ctl [data-a="pp"]').focus();
  }
  story.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'story') playStory();
    else if (a === 'reel') { stopStory(); const r = reelBtn(); if (r) r.click(); }
  });
  const syncStory = () => { story.hidden = group !== 'theory'; };
  new MutationObserver(syncStory).observe(bar, { attributes: true, subtree: true, attributeFilter: ['aria-selected'] });
  syncStory(); storyIdle();

  // ---------- звук прогресса (18.11.2026) ----------
  // Лаборатории пишут прогресс задания в #taskState: «Подписано: 3 из 9», «найдено: 2 из 3 типов», «✓ Выполнено».
  // Выросло «N из M» или прибавилась галочка — короткое «тын» и зелёная вспышка строки; задание выполнено —
  // мелодия из трёх нот и плашка сверху. При открытии и смене урока — тишина (только на действие ученика).
  const prog = (() => {
    let ctx = null;
    const ac = () => { if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (A) ctx = new A(); } if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; };
    addEventListener('pointerdown', ac, { passive: true, capture: true });
    function note(f, t0, dur, vol) {
      const c = ac(); if (!c) return; const t = c.currentTime + t0, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 2; // мягкий «колокольчик»: тон и октава
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const g2 = c.createGain(); g2.gain.value = 0.25; o.connect(g); o2.connect(g2); g2.connect(g); g.connect(c.destination);
      o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    }
    const tick = () => { note(1046.5, 0, 0.18, 0.14); note(1568, 0.06, 0.22, 0.1); };          // «тын»
    const done = () => { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(f, i * 0.11, 0.5, 0.13)); };
    const score = (t) => { let s = 0; String(t).replace(/(\d+)\s*(?:из|\/)\s*\d+/g, (_, n) => { s += +n; }); return s + (String(t).match(/✓/g) || []).length; };
    let lesson = -1, base = null, wasDone = false, quietUntil = 0;
    function flash(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
    function banner() {
      let b = document.getElementById('lsDone');
      if (!b) { b = document.createElement('div'); b.id = 'lsDone'; b.className = 'ls-done'; b.setAttribute('role', 'status'); document.body.appendChild(b); }
      const last = lessonIdx() >= cards().length - 1;
      b.innerHTML = '<b>✓ Задание выполнено</b><span>' + (last ? 'Это был последний урок темы — отличная работа!' : 'Можно переходить к следующему уроку') + '</span>';
      b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); clearTimeout(banner.t); banner.t = setTimeout(() => b.classList.remove('on'), 4200);
    }
    function check() {
      const el = document.getElementById('taskState'); if (!el) return;
      const t = el.textContent || '', isDone = /Выполнено/.test(t) || el.classList.contains('done'), i = lessonIdx(), s = score(t);
      if (i !== lesson) { lesson = i; base = s; wasDone = isDone; quietUntil = Date.now() + 800; return; } // новый урок — запоминаем, не звучим
      if (Date.now() < quietUntil) { base = s; wasDone = isDone; return; }
      if (isDone && !wasDone) { done(); flash(el, 'ls-ok'); banner(); }
      else if (!isDone && base !== null && s > base) { tick(); flash(el, 'ls-ok'); }
      base = s; wasDone = isDone;
    }
    const el0 = document.getElementById('taskState');
    if (el0) new MutationObserver(check).observe(el0, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    setTimeout(check, 0);
    return { tick, done };
  })();
  window.LuchProgress = prog;

  // ---------- схему можно сдвинуть мышью (18.11.2026) ----------
  // Зажал на пустом месте схемы и повёл — картинка сдвигается (как в «Как в жизни»); двойной щелчок по пустому
  // месту или смена урока — обратно. Предметы опыта (свой курсор), кнопки и ссылки не трогаем; короткий щелчок —
  // как раньше. Только мышь и перо: на телефоне палец прокручивает страницу. Не дальше трети размера.
  (() => {
    const scene = document.getElementById('scene'), stage = document.getElementById('stage');
    if (!scene || !stage || scene.hasAttribute('data-nopan')) return;
    const BUSY = /pointer|grab|move|resize|crosshair|cell|text|copy|alias|zoom/;
    let pan = { x: 0, y: 0 }, drag = null, lesson = lessonIdx();
    const apply = (anim) => { scene.style.transition = anim ? 'transform .3s ease' : ''; scene.style.transform = pan.x || pan.y ? 'translate(' + pan.x + 'px,' + pan.y + 'px)' : ''; };
    const free = (t) => t && t.closest && t.closest('#scene') && !t.closest('a,button,input,select,textarea,[role="button"],[data-k],[data-drag]') && !BUSY.test(getComputedStyle(t).cursor);
    stage.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.pointerType === 'touch' || e.defaultPrevented || !free(e.target)) return;
      drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x0: pan.x, y0: pan.y, on: false };
    });
    addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!drag.on) { if (Math.hypot(dx, dy) < 6) return; drag.on = true; stage.style.cursor = 'grabbing'; }
      const r0 = scene.getBoundingClientRect(), lx = r0.width / 3, ly = r0.height / 3;
      pan = { x: Math.max(-lx, Math.min(lx, drag.x0 + dx)), y: Math.max(-ly, Math.min(ly, drag.y0 + dy)) }; apply(false);
    });
    const end = (e) => { if (!drag || (e && e.pointerId !== drag.id)) return; if (drag.on) { stage.style.cursor = ''; const stop = (ev) => { ev.stopPropagation(); ev.preventDefault(); }; addEventListener('click', stop, { capture: true, once: true }); setTimeout(() => removeEventListener('click', stop, { capture: true }), 0); } drag = null; };
    addEventListener('pointerup', end); addEventListener('pointercancel', end);
    stage.addEventListener('dblclick', (e) => { if ((pan.x || pan.y) && free(e.target)) { pan = { x: 0, y: 0 }; apply(true); } });
    setInterval(() => { const i = lessonIdx(); if (i !== lesson) { lesson = i; if (pan.x || pan.y) { pan = { x: 0, y: 0 }; apply(false); } } }, 500);
  })();

  // карточка в начале урока: «Прослушать лекцию» или «Перейти к практике» — каждый раз, когда открывается урок
  const seenKey = () => 'oe-start:' + location.pathname + ':' + lessonIdx();
  let startShown = false;
  function startCard() {
    if (startShown || st || document.querySelector('.ls-start')) return false;
    try { localStorage.setItem(seenKey(), '1'); } catch (e) {} // отметка «урок открывали» — для прогресса и наставника
    startShown = true;
    // Лаборатории перерисовывают обзор урока, только когда открыта его вкладка: перешёл к следующему
    // уроку с «Практики» — в обзоре ещё прошлый урок. Тихо «щёлкаем» обзор и возвращаем вкладку назад,
    // чтобы и карточка, и обзор были про текущий урок.
    try { const was = PANES.find(x => P(x) && !P(x).hidden); if (was && was !== 'overview' && T('overview') && T(was)) { T('overview').click(); T(was).click(); } } catch (e) {}
    const reel = reelBtn(), n = lessonIdx() + 1, cs = cards(), total = cs.length;
    // раздел — из заголовка страницы; о чём урок — первая фраза его текста (раньше тут был общий абзац,
    // одинаковый во всех уроках, и казалось, что открывается одно и то же)
    const section = String(document.title || '').split(/\s+[—–|·]\s+/)[0].trim();
    const ov = P('overview'), p1 = ov ? [...ov.querySelectorAll('p')].find(p => !p.closest('.life,.taskbox,[class*="task"]') && p.textContent.trim().length > 30) : null;
    let about = p1 ? p1.textContent.replace(/\s+/g, ' ').trim() : '';
    if (about.length > 170) { const cut = about.slice(0, 170), dot = cut.search(/[.!?…](?=[^.!?…]*$)/); about = dot > 70 ? cut.slice(0, dot + 1) : cut.replace(/\s+\S*$/, '') + '…'; }
    const titleOf = c => { const t = c.querySelector('.t'); return (t ? t.textContent : c.textContent).replace(/^\s*\d+\s*/, '').replace(/✓/g, '').replace(/\s+/g, ' ').trim(); };
    const h = (cs[n - 1] && titleOf(cs[n - 1])) || lessonTitle(); // название — из ленты уроков (она всегда про текущий урок)
    const list = total > 1 && total <= 10 ? '<ol class="ls-lsn">' + cs.map((c, k) => `<li class="${k === n - 1 ? 'cur' : ''}${c.querySelector('.chk') ? ' ok' : ''}"><b>${k + 1}</b><span>${esc(titleOf(c))}</span></li>`).join('') + '</ol>' : '';
    const w = document.createElement('div'); w.className = 'ls-start'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-label', 'Начало урока');
    w.innerHTML = `<div class="card"><div class="k">${section ? esc(section) + ' · ' : ''}Урок ${n} из ${total}</div><h3>${esc(h)}</h3>
      ${about ? `<p>${esc(about)}</p>` : ''}${list}
      <div class="flow">Лекция → Опыт → Домашнее задание</div>
      <div class="acts">${reel ? '<button class="ls-btn main" data-a="reel">▶ Смотреть видео</button>' : ''}<button class="ls-btn ${reel ? '' : 'main'}" data-a="story">▶ Прослушать лекцию</button><button class="ls-btn ghost" data-a="practice">Перейти к практике</button></div></div>`;
    const close = () => { w.remove(); startShown = false; };
    w.addEventListener('click', e => {
      if (e.target === w) return close();
      const b = e.target.closest('[data-a]'); if (!b) return;
      close();
      if (b.dataset.a === 'reel') { openTab('overview'); const r = reelBtn(); if (r) r.click(); }
      else if (b.dataset.a === 'story') { openTab('overview'); playStory(); }
      else toPractice();
    });
    addEventListener('keydown', function esc2(e) { if (e.key === 'Escape') { close(); removeEventListener('keydown', esc2); } });
    const show = () => { if (document.querySelector('.oe-splash')) return setTimeout(show, 150); document.body.appendChild(w); const m = w.querySelector('.main'); if (m) m.focus(); };
    show();
    return true;
  }
  // готовим историю заранее, пока человек читает карточку
  const prep = () => {
    taskPlay(null);
    if (!reelBtn()) fetchStory().then(j => { j.sections.forEach((x, i) => { if (!x.formulas && !x.scheme) new Image().src = imgUrl(i); }); taskPlay(j); }).catch(() => {});
  };
  // ▶ в блоке «Задание»: ещё раз прослушать только часть лекции про практическое задание
  function taskPlay(j) {
    document.querySelectorAll('.ls-tplay').forEach(x => x.remove());
    const idx = j && j.sections ? j.sections.findIndex(x => x.scheme) : -1;
    const box = stageTask || taskBox();
    if (idx < 0 || !box) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'ls-tplay';
    b.innerHTML = '<i>▶</i>Как выполнить задание'; b.title = 'Наставник объяснит задание голосом';
    b.addEventListener('click', e => { e.stopPropagation(); playStory(idx); });
    const k = box.querySelector('.k'); if (k) k.after(b); else box.prepend(b);
  }
  setTimeout(() => { startCard(); prep(); }, 300);
  // перешли на другой урок этой темы — снова предлагаем начать с теории
  { const strip = document.querySelector('.lessons'); let was = lessonIdx(), lt = 0;
    if (strip) new MutationObserver(() => { clearTimeout(lt); lt = setTimeout(() => { const now = lessonIdx(); if (now !== was) { was = now; if (startCard()) prep(); } }, 250); })
      .observe(strip, { childList: true, attributes: true, subtree: true, attributeFilter: ['aria-current', 'class'] }); }
  if (lessonsBox) { let t2 = 0; new MutationObserver(() => { clearTimeout(t2); t2 = setTimeout(() => { stopStory(); storyIdle(); startCard(); prep(); }, 400); }).observe(lessonsBox, { attributes: true, subtree: true, attributeFilter: ['aria-current'] }); }

  // ---------- после последнего урока — следующая тема предмета (или карта) ----------
  // Темы берём из тех же данных, что и карта: PHYS_TOPICS на главной и /physics/subjects-data.js.
  let nextTopic; // undefined — ещё не знаем, null — тем дальше нет, иначе { t, href, subj }
  const here = location.pathname.replace(/index\.html$/, '');
  const isLast = () => cards().length > 0 && lessonIdx() >= cards().length - 1;
  const findNext = () => Promise.all([fetch('/').then(r => r.text()), fetch('/physics/subjects-data.js').then(r => r.text())]).then(([home, data]) => {
    const groups = [];
    const a = home.indexOf('const PHYS_TOPICS'), b = home.indexOf('const STATUS', a);
    if (a > 0) groups.push(['phys', home.slice(a, b > a ? b : undefined)]);
    data.split(/\n {2}(\w+): \{/).forEach((part, i, arr) => { if (i % 2 === 1) groups.push([part, arr[i + 1] || '']); });
    for (const [subj, txt] of groups) {
      const list = [...txt.matchAll(/\{ id: '[\w-]+'[^\n]*?\bt: '([^']+)'[^\n]*?href: '([^']+)'/g)].map(m => ({ t: m[1], href: m[2], subj }));
      const k = list.findIndex(x => x.href === here);
      if (k >= 0) return list[k + 1] || { t: '', href: '/#' + subj, subj, map: true };
    }
    return null;
  }).catch(() => null);
  const goNext = () => { const n = nextTopic; location.href = n ? n.href : '/'; };
  const nextBtn = document.getElementById('nextL');
  function syncNext() {
    if (!nextBtn) return;
    if (!isLast()) { nextBtn.classList.remove('ls-next-topic'); nextBtn.removeAttribute('title'); return; }
    if (nextBtn.disabled) nextBtn.disabled = false;
    nextBtn.classList.add('ls-next-topic');
    const n = nextTopic, label = n && !n.map ? 'Следующая тема: ' + n.t : 'К карте предметов';
    nextBtn.title = label; nextBtn.setAttribute('aria-label', label);
  }
  if (nextBtn) {
    new MutationObserver(syncNext).observe(nextBtn, { attributes: true, attributeFilter: ['disabled'] });
    nextBtn.addEventListener('click', e => { if (!isLast()) return; e.preventDefault(); e.stopImmediatePropagation(); goNext(); }, true);
    findNext().then(n => { nextTopic = n; syncNext(); });
    syncNext();
  }
  // подсказка наставнику: что будет после этого урока
  const whatNext = () => {
    if (!isLast()) return 'Дальше в этой теме есть следующий урок (кнопка › внизу).';
    const n = nextTopic;
    return 'Это последний урок темы. ' + (n && !n.map ? 'Кнопка › внизу ведёт на следующую тему: «' + n.t + '».' : 'Кнопка › внизу ведёт на карту предметов — там можно выбрать новую тему.');
  };

  // ---------- журнал урока: что ученик уже сделал (для наставника и кнопки «Помоги») ----------
  const JKEY = () => 'oe-learn:' + location.pathname + ':' + lessonIdx();
  const jLoad = () => { try { return JSON.parse(localStorage.getItem(JKEY()) || 'null') || {}; } catch (e) { return {}; } };
  function journal(fn) { const j = jLoad(); j.first = j.first || Date.now(); fn(j); try { localStorage.setItem(JKEY(), JSON.stringify(j)); } catch (e) {} }
  journal(() => {});
  // время в «Теории», «Практике» и «ДЗ», только пока вкладка браузера видна
  setInterval(() => { if (document.hidden) return; const g = inHw ? 'hw' : group; journal(j => { j.t = j.t || {}; j.t[g] = (j.t[g] || 0) + 5; }); }, 5000);
  document.addEventListener('click', e => {
    if (e.target.closest('[data-reel]')) journal(j => { j.video = (j.video || 0) + 1; });
    const hb = e.target.closest('#pane-hw [data-a="hint"]'); if (hb) journal(j => { j.hwHints = (j.hwHints || 0) + 1; });
  }, true);
  const mins = sec => sec >= 90 ? Math.round(sec / 60) + ' мин' : (sec || 0) + ' с';
  function learnState() {
    const j = jLoad(), out = [];
    const onLesson = j.first ? Math.round((Date.now() - j.first) / 60000) : 0;
    out.push('На этом уроке ученик ' + (onLesson < 2 ? 'только начал' : 'уже около ' + onLesson + ' мин') + '.');
    if (j.theoryDone) out.push('Теорию-лекцию прослушал полностью.');
    else if (j.heard && j.heard.length) out.push('Теорию-лекцию слушал частично: ' + j.heard.map(i => '«' + (j.titles || [])[i] + '»').join(', ') + ' (' + j.heard.length + ' из ' + (j.parts || 4) + ').');
    else out.push('Теорию-лекцию не слушал.');
    if (lecture && (j.theoryDone || (j.heard && j.heard.length))) out.push('Текст объяснения, которое он слушал (отвечай на вопросы по нему, своими словами): ' + lecture.map(x => x.title + ': ' + x.text).join(' ').slice(0, 1600));
    if (reelBtn()) out.push(j.video ? 'Видео к уроку смотрел.' : 'Видео к уроку не смотрел.');
    const t = j.t || {};
    out.push('Время: теория ' + mins(t.theory) + ', практика ' + mins(t.practice) + ', ДЗ ' + mins(t.hw) + '. Сейчас открыта вкладка «' + (inHw ? 'ДЗ' : group === 'practice' ? 'Практика' : 'Теория') + '».');
    const hw = load();
    if (hw && hw.tasks) { const ok = hw.tasks.filter(x => x.ok).length, tried = hw.tasks.filter(x => x.mine && !x.ok); out.push('ДЗ: решено ' + ok + ' из ' + hw.tasks.length + (tried.length ? ', неверные ответы: ' + tried.map(x => '«' + x.mine + '» на «' + x.q.slice(0, 80) + '»').join('; ') : '') + (j.hwHints ? ', подсказки к задачам открывал ' + j.hwHints + ' раз' : '') + '.'); }
    else out.push('ДЗ ещё не открывал.');
    if (j.quiz) out.push('Мини-тест «Закрепим»: ' + j.quiz.ok + ' из ' + j.quiz.n + ' верно.');
    const recent = (j.helps || []).filter(x => Date.now() - x < 20 * 60e3).length;
    if (recent) out.push(recent > 1 ? 'Кнопку «Помоги» на этом уроке нажимает уже ' + recent + '-й раз за 20 минут.' : 'Кнопку «Помоги» на этом уроке нажал впервые.');
    return out.join(' ');
  }
  // уровень подсказки: 1 — наводящий вопрос, 2 — конкретный шаг, 3 — разбор по шагам
  function noteHelp() { let n = 0; journal(j => { j.helps = (j.helps || []).filter(x => Date.now() - x < 20 * 60e3); j.helps.push(Date.now()); n = j.helps.length; }); return n; }

  // ---------- главные формулы урока — всегда на виду, в рамке задания ----------
  const css3 = document.createElement('style');
  css3.textContent = `
  .ls-fx{pointer-events:auto;margin-top:10px;padding-top:9px;border-top:1px solid var(--line,#26324a)}
  .ls-fx .hd{display:flex;align-items:center;gap:6px;background:none;border:0;padding:0;cursor:pointer;font:600 10.5px/1 var(--font-body,sans-serif);letter-spacing:.12em;text-transform:uppercase;color:var(--accent,#ffb547)}
  .ls-fx .hd i{font-style:normal;color:var(--muted,#8b96ad);display:inline-block;transition:transform .2s}
  .ls-fx.closed .list{display:none}
  .ls-fx.closed .hd i{transform:rotate(-90deg)}
  .ls-fx .list{display:flex;flex-direction:column;gap:5px;margin-top:8px}
  .ls-fx .f{display:block;width:100%;text-align:left;background:rgba(255,255,255,.04);border:1px solid var(--line,#26324a);border-radius:9px;padding:6px 9px;cursor:pointer;color:var(--fg,#e8ecf4);font:inherit}
  .ls-fx .f:hover{border-color:var(--muted,#8b96ad)}
  .ls-fx .f code{font:600 14.5px/1.3 var(--font-mono,monospace);color:var(--fg,#e8ecf4);white-space:normal}
  .ls-fx .f span{display:block;font-size:11.5px;line-height:1.3;color:var(--muted,#8b96ad);margin-top:2px}
  .ls-fx .f .v{display:none;font-size:12px;line-height:1.5;color:var(--fg,#e8ecf4);margin-top:5px}
  .ls-fx .f .v b{font-family:var(--font-mono,monospace)}
  .ls-fx .f.open .v{display:block}`;
  document.head.appendChild(css3);
  const taskEl = stageTask;
  const fxCache = {};
  let fxFor = '';
  function renderFx() {
    if (!taskEl) return;
    const k = location.pathname + '|' + lessonIdx();
    if (fxFor === k) return; fxFor = k;
    let box = taskEl.querySelector('.ls-fx'); if (box) box.remove();
    if (!fxCache[k]) fxCache[k] = fetch('/api/tutor/formulas', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: k, lang: LANG2, context: 'Тема: ' + document.title + '\nУрок ' + (lessonIdx() + 1) + ': ' + lessonTitle() + '\n' + ctx() + '\nРаздел «Расчёты»: ' + ((P('calc') && P('calc').textContent) || '').replace(/\s+/g, ' ').slice(0, 1500) }) })
      .then(r => r.ok ? r.json() : { formulas: [] }).catch(() => { delete fxCache[k]; return { formulas: [] }; });
    fxCache[k].then(j => {
      if (fxFor !== k || !j.formulas || !j.formulas.length) return;
      let closed = null; try { closed = localStorage.getItem('oe-fx-closed'); } catch (e) {}
      box = document.createElement('div'); box.className = 'ls-fx' + ((closed === '1' || (closed === null && innerWidth < 600)) ? ' closed' : '');
      box.setAttribute('data-noi18n', '');
      box.innerHTML = '<button type="button" class="hd" aria-expanded="true"><i>▾</i>Формулы урока</button><div class="list">' + j.formulas.map(x =>
        '<button type="button" class="f" title="Что означают буквы"><code>' + esc(x.f) + '</code>' + (x.name ? '<span>' + esc(x.name) + '</span>' : '') +
        (x.vars && x.vars.length ? '<div class="v">' + x.vars.map(v => '<b>' + esc(v[0] || '') + '</b> — ' + esc(v[1] || '') + (v[2] && v[2] !== '—' ? ', ' + esc(v[2]) : '')).join('<br>') + '</div>' : '') + '</button>').join('') + '</div>';
      box.querySelector('.hd').setAttribute('aria-expanded', !box.classList.contains('closed'));
      box.addEventListener('click', e => {
        const h = e.target.closest('.hd');
        if (h) { box.classList.toggle('closed'); h.setAttribute('aria-expanded', !box.classList.contains('closed')); try { localStorage.setItem('oe-fx-closed', box.classList.contains('closed') ? '1' : '0'); } catch (er) {} return; }
        const f = e.target.closest('.f'); if (f) f.classList.toggle('open');
      });
      taskEl.appendChild(box); taskEl.dataset.fx = k;
    });
  }
  setTimeout(renderFx, 400);
  if (lessonsBox) new MutationObserver(() => setTimeout(renderFx, 300)).observe(lessonsBox, { attributes: true, subtree: true, attributeFilter: ['aria-current'] });
  // опыт иногда перерисовывает рамку задания — возвращаем блок на место
  if (taskEl) new MutationObserver(() => { if (taskEl.dataset.fx === fxFor && fxFor && !taskEl.querySelector('.ls-fx')) { fxFor = ''; renderFx(); } }).observe(taskEl, { childList: true });

  // ---------- «Закрепим?» — 4 вопроса после практики ----------
  const css4 = document.createElement('style');
  css4.textContent = `
  .ls-quiz{position:fixed;inset:0;z-index:72;display:grid;place-items:center;background:rgba(5,8,14,.78);padding:16px;animation:ls-in .25s ease}
  .ls-quiz .card{width:min(520px,100%);max-height:100%;overflow:auto;background:var(--surface,#121a28);border:1px solid var(--line,#26324a);border-radius:20px;padding:22px 22px 18px;color:var(--fg,#e8ecf4);box-shadow:0 30px 80px -20px rgba(0,0,0,.8)}
  .ls-quiz .top{display:flex;align-items:center;gap:10px}
  .ls-quiz .k{font:500 11px/1.4 var(--font-mono,monospace);letter-spacing:.1em;text-transform:uppercase;color:var(--muted,#8b96ad);flex:1}
  .ls-quiz .x{width:34px;height:34px;border-radius:10px;border:1px solid var(--line,#26324a);background:none;color:var(--muted,#8b96ad);cursor:pointer;font-size:15px}
  .ls-quiz .bar{display:flex;gap:5px;margin:12px 0 16px}
  .ls-quiz .bar i{flex:1;height:5px;border-radius:3px;background:var(--line,#26324a)}
  .ls-quiz .bar i.ok{background:#86e0a8}.ls-quiz .bar i.no{background:#ff8a73}.ls-quiz .bar i.cur{background:var(--accent,#ffb547)}
  .ls-quiz h3{margin:0 0 14px;font:500 18px/1.4 var(--font-body,"Golos Text",sans-serif);text-wrap:pretty}
  .ls-quiz .opts{display:flex;flex-direction:column;gap:8px}
  .ls-quiz .o{display:flex;gap:10px;align-items:center;text-align:left;width:100%;padding:12px 14px;border-radius:12px;border:1px solid var(--line,#26324a);background:rgba(255,255,255,.03);color:var(--fg,#e8ecf4);font:500 15px/1.35 var(--font-body,sans-serif);cursor:pointer;transition:border-color .15s,background .15s}
  .ls-quiz .o b{flex:none;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;border:1px solid var(--line,#26324a);font:600 12px/1 var(--font-mono,monospace);color:var(--muted,#8b96ad)}
  .ls-quiz .o:hover:not([disabled]){border-color:var(--accent,#ffb547)}
  .ls-quiz .o[disabled]{cursor:default}
  .ls-quiz .o.ok{border-color:#86e0a8;background:rgba(134,224,168,.12)}.ls-quiz .o.ok b{background:#86e0a8;color:#0b1019;border-color:#86e0a8}
  .ls-quiz .o.no{border-color:#ff8a73;background:rgba(255,138,115,.1)}.ls-quiz .o.no b{background:#ff8a73;color:#0b1019;border-color:#ff8a73}
  .ls-quiz .fb{margin-top:12px;font-size:14.5px;line-height:1.5;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.04)}
  .ls-quiz .fb[hidden]{display:none}
  .ls-quiz .fb b{color:#86e0a8}.ls-quiz .fb b.no{color:#ff8a73}
  .ls-quiz .acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
  .ls-quiz .acts .ls-btn{padding:12px 16px;border-radius:12px;font-size:15px}
  .ls-quiz .acts .main{background:var(--accent,#ffb547)}
  .ls-quiz .big{font:600 34px/1.1 var(--font-display,"Unbounded",sans-serif);margin:6px 0 8px}
  .ls-quiz .load{color:var(--muted,#8b96ad);font-size:14.5px;padding:18px 0}`;
  document.head.appendChild(css4);
  const quizCache = {};
  function fetchQuiz() {
    const k = location.pathname + '|' + lessonIdx();
    if (!quizCache[k]) {
      const lect = lecture ? '\nОбъяснение урока: ' + lecture.map(x => x.title + ': ' + x.text).join(' ') : '';
      quizCache[k] = fetch('/api/tutor/quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: k, lang: LANG2, context: 'Тема: ' + document.title + '\nУрок ' + (lessonIdx() + 1) + ': ' + lessonTitle() + '\n' + ctx() + lect }) })
        .then(r => r.json().then(j => { if (!r.ok || !j.questions) throw new Error(j.error || 'quiz'); return j; })).catch(e => { delete quizCache[k]; throw e; });
    }
    return quizCache[k];
  }
  function openQuiz() {
    document.querySelectorAll('.ls-quiz').forEach(x => x.remove());
    const w = document.createElement('div'); w.className = 'ls-quiz'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-label', 'Закрепим знания');
    w.innerHTML = '<div class="card" data-noi18n><div class="top"><div class="k">Закрепим · ' + esc(lessonTitle()) + '</div><button class="x" data-a="close" aria-label="Закрыть">✕</button></div><div class="body"><div class="load">Готовлю вопросы по уроку…</div></div></div>';
    document.body.appendChild(w);
    const body = w.querySelector('.body');
    let qs = [], i = 0, res = [];
    const close = () => { w.remove(); removeEventListener('keydown', onKey, true); };
    const onKey = e => { if (e.key === 'Escape') close(); else if (/^[1-4]$/.test(e.key)) { const o = body.querySelectorAll('.o')[+e.key - 1]; if (o && !o.disabled) o.click(); } else if (e.key === 'Enter') { const n = body.querySelector('[data-a="next"]'); if (n) n.click(); } };
    addEventListener('keydown', onKey, true);
    const bar = () => '<div class="bar">' + qs.map((_, k) => '<i class="' + (k < res.length ? (res[k] ? 'ok' : 'no') : k === i ? 'cur' : '') + '"></i>').join('') + '</div>';
    function showQ() {
      const q = qs[i];
      body.innerHTML = bar() + '<h3>' + esc(q.q) + '</h3><div class="opts">' + q.options.map((o, k) => '<button type="button" class="o" data-k="' + k + '"><b>' + (k + 1) + '</b><span>' + esc(o) + '</span></button>').join('') + '</div><div class="fb" hidden></div><div class="acts" hidden></div>';
      w.querySelector('.k').textContent = 'Закрепим · вопрос ' + (i + 1) + ' из ' + qs.length;
      const f = body.querySelector('.o'); if (f) f.focus();
    }
    function showEnd() {
      const ok = res.filter(Boolean).length, n = qs.length;
      journal(j => { j.quiz = { ok, n, at: Date.now() }; });
      w.querySelector('.k').textContent = 'Закрепили · ' + lessonTitle();
      const msg = ok === n ? 'Отлично! Всё понял 🎉' : ok >= n - 1 ? 'Хорошо! Почти без ошибок.' : 'Есть над чем подумать — спроси наставника, что осталось непонятным.';
      body.innerHTML = bar() + '<div class="big">' + ok + ' из ' + n + '</div><p style="margin:0 0 4px;font-size:15px;line-height:1.5">' + msg + '</p>' +
        '<div class="acts">' + (ok < n ? '<button class="ls-btn main" data-a="ask">🎤 Разобрать ошибки</button>' : '') +
        '<button class="ls-btn ' + (ok < n ? '' : 'main') + '" data-a="nextL">Дальше →</button><button class="ls-btn ghost" data-a="hw">Сделать ДЗ</button><button class="ls-btn ghost" data-a="again">Ещё раз</button></div>';
    }
    w.addEventListener('click', e => {
      if (e.target === w) return close();
      const b = e.target.closest('[data-a],.o'); if (!b) return;
      if (b.classList.contains('o')) {
        const q = qs[i], k = +b.dataset.k, right = k === q.correct;
        res.push(right);
        body.querySelectorAll('.o').forEach(o => { o.disabled = true; const kk = +o.dataset.k; if (kk === q.correct) o.classList.add('ok'); else if (kk === k) o.classList.add('no'); });
        const fb = body.querySelector('.fb'); fb.hidden = false;
        fb.innerHTML = (right ? '<b>Верно!</b> ' : '<b class="no">Не совсем.</b> ') + esc(q.why || '');
        const acts = body.querySelector('.acts'); acts.hidden = false;
        acts.innerHTML = '<button class="ls-btn main" data-a="next">' + (i + 1 < qs.length ? 'Следующий вопрос →' : 'Итог') + '</button>';
        body.querySelector('.bar').outerHTML = bar();
        acts.querySelector('button').focus();
        return;
      }
      const a = b.dataset.a;
      if (a === 'close') close();
      else if (a === 'next') { i++; if (i < qs.length) showQ(); else showEnd(); }
      else if (a === 'again') { i = 0; res = []; showQ(); }
      else if (a === 'hw') { close(); openHw(); }
      else if (a === 'nextL') { close(); const nx = document.getElementById('nextL') || cards()[lessonIdx() + 1]; if (nx) nx.click(); }
      else if (a === 'ask') {
        close();
        const wrong = qs.map((q, k) => res[k] === false ? '«' + q.q + '» (верно: ' + q.options[q.correct] + ')' : '').filter(Boolean).join('; ');
        if (window.LuchTutor) window.LuchTutor.ask('Я прошёл мини-тест по уроку и ошибся в вопросах: ' + wrong + '. Объясни коротко, в чём я ошибся, на примере из жизни.');
      }
    });
    fetchQuiz().then(j => { if (!w.isConnected) return; qs = j.questions; showQ(); })
      .catch(() => { if (w.isConnected) body.innerHTML = '<div class="load">Не получилось составить вопросы. Попробуйте ещё раз чуть позже.</div>'; });
  }
  // заранее, как только задание выполнено — чтобы не ждать
  const prefetchQuiz = () => fetchQuiz().catch(() => {});

  // ---------- телефон (≤600 px, 22.11.2026) ----------
  // На узком экране рамка задания и полоса кнопок лежали поверх опыта: задание закрывало чуть не половину
  // схемы, а кнопки опыта уезжали вбок за край экрана. Теперь на телефоне задание стоит над стендом во всю
  // ширину, кнопки опыта — под стендом, крупные и в несколько рядов (видны все). Стенд укорачиваем на
  // освободившуюся снизу полосу — сама схема остаётся того же размера. «Схема / Как в жизни» — в левый верхний
  // угол стенда, где раньше была рамка. Шире 600 px всё возвращается на место. Лаборатории, которые сами
  // раскладывают схему под рамкой задания (задают сцене top/height), рамку оставляют у себя.
  (() => {
    const stage = document.getElementById('stage'), scene = document.getElementById('scene');
    if (!stage) return;
    const mcss = document.createElement('style');
    mcss.textContent = `@media (max-width:600px){
    html .task.ls-mv{position:relative;inset:auto;width:auto;max-width:none;margin:0;transform:none;z-index:auto;pointer-events:auto;background:var(--surface,#121a28);padding:12px 14px 12px}
    html .task.ls-mv .k{display:inline-block;vertical-align:middle;margin:0 10px 0 0}
    html .task.ls-mv .ls-tplay{vertical-align:middle;margin:3px 0}
    html .task.ls-mv p{margin:8px 0 6px;font-size:15px}
    html .tools.ls-mv{position:relative;inset:auto;transform:none;width:auto;max-width:none;margin:0;flex-wrap:wrap;justify-content:center;overflow:visible;gap:6px;padding:6px;z-index:auto;border-radius:14px;background:var(--surface,#121a28)}
    html .tools.ls-mv .sep{display:none}
    html .task{min-width:0}
    html .tools:not(.ls-mv){flex-wrap:wrap;justify-content:center;overflow:visible;align-self:stretch;gap:4px}
    html .tools button{min-height:44px;padding:8px 13px;font-size:14px;border-radius:10px}
    html .tools.ls-mv button{flex:1 1 auto;background:rgba(255,255,255,.045)}
    html .tools.ls-mv button[aria-pressed="true"]{background:var(--surface-2,#1a2438);box-shadow:inset 0 0 0 1px var(--line,#26324a);color:var(--fg,#e8ecf4)}
    html #stage.ls-mvs > .scene{height:calc(100% - var(--ls-top,0px))!important}
    html #stage.ls-mvt > .rl-tog{top:10px;left:10px;right:auto;bottom:auto}
    html .rl-tog button{padding:12px 13px;font-size:13.5px}
    html .ls-tabs button.g{padding:16px 4px 14px;font-size:12.5px}
    html .ls-sub button{padding:10px 15px;font-size:14px}
    html .ls-task .ls-btn,html .ls-hw > .ls-btn{padding:12px 15px;font-size:14px}
    html .ls-task input{font-size:16px;padding:11px 12px}
    html .ls-fx .hd{padding:7px 0 4px}
    html .chips button{min-height:40px;padding:8px 12px;font-size:14px}
    html .ghostbtn{min-height:42px}
    html .primary{min-height:44px}
  }`;
    document.head.appendChild(mcss);
    const mq = matchMedia('(max-width:600px)');
    const task = stageTask && stageTask.parentElement === stage ? stageTask : null;
    const tools = [...stage.children].find(e => e.classList.contains('tools')) || null;
    const phT = document.createComment('ls-task'), phB = document.createComment('ls-tools');
    const abs = el => !!el && getComputedStyle(el).position === 'absolute';
    const selfLaid = () => !!scene && !!(scene.style.top || scene.style.height); // схема уже разложена под рамкой самой лабораторией
    let on = false, at = 0;
    function undo() {
      stage.classList.remove('ls-mvs', 'ls-mvt'); stage.style.height = ''; stage.style.removeProperty('--ls-top');
      if (phT.parentNode) { phT.replaceWith(task); task.classList.remove('ls-mv'); }
      if (phB.parentNode) { phB.replaceWith(tools); tools.classList.remove('ls-mv'); }
      on = false;
    }
    function apply() {
      if (on) undo();
      if (!mq.matches) return;
      at = innerWidth;
      const mvTask = abs(task) && !selfLaid(), mvTools = abs(tools);
      if (!mvTask && !mvTools) return;
      on = true;
      if (mvTask) { task.replaceWith(phT); stage.before(task); task.classList.add('ls-mv'); stage.classList.add('ls-mvt'); }
      if (mvTools) {
        // полоса под схемой, где лежали кнопки: стенд короче на неё, схема — того же размера
        let band = 0, top = 0;
        if (scene && !selfLaid()) { const sr = stage.getBoundingClientRect(), cr = scene.getBoundingClientRect(), bw = stage.clientTop || 0; band = Math.round(sr.bottom - bw - cr.bottom); top = Math.round(cr.top - sr.top - bw); }
        tools.replaceWith(phB); stage.after(tools); tools.classList.add('ls-mv');
        if (band >= 30 && band <= 90 && top >= 0) { const h = stage.offsetHeight; stage.style.setProperty('--ls-top', top + 'px'); stage.classList.add('ls-mvs'); stage.style.height = (h - band) + 'px'; }
      }
      if (mvTask) [400, 1500].forEach(ms => setTimeout(trimTop, ms));
    }
    // Схемы рисуются прижатыми к низу, а сверху оставлено место под рамку задания. Рамка ушла над стендом —
    // убираем пустое место сверху (оставляем его под прибор и переключатель вида). Схема не мельчает:
    // высота не меньше 0,86 ширины — столько нужно обычному полю опыта 520 × 440.
    function trimTop() {
      if (!on || !stage.classList.contains('ls-mvt') || selfLaid() || !scene || scene.tagName.toLowerCase() !== 'svg') return;
      const sr = scene.getBoundingClientRect(); if (sr.height < 100) return;
      let top = Infinity;
      for (const el of scene.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon,text,image,use,foreignObject')) {
        if (el.closest('defs,clipPath,mask,pattern,marker,symbol')) continue;
        const r = el.getBoundingClientRect(); if (!r.width && !r.height) continue;
        if (r.width >= sr.width * 0.85 && r.height >= sr.height * 0.5) continue; // фон, сетка
        if (r.bottom < sr.top || r.top > sr.bottom) continue;
        top = Math.min(top, r.top);
      }
      if (!isFinite(top)) return;
      let need = 8; // под приборы и переключатель, что стоят вверху стенда
      for (const el of stage.children) {
        if (el === scene || !el.offsetParent || el.classList.contains('rl-view') || getComputedStyle(el).position !== 'absolute') continue;
        const r = el.getBoundingClientRect(); if (r.height && r.top - sr.top < sr.height / 2) need = Math.max(need, r.bottom - sr.top + 8);
      }
      const cut = Math.floor(Math.min(top - sr.top - need, sr.height - sr.width * 0.86));
      if (cut > 24) stage.style.height = (stage.offsetHeight - cut) + 'px';
    }
    apply();
    mq.addEventListener('change', apply);
    let rt = 0; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (on && innerWidth !== at) apply(); }, 250); });
  })();

  window.LuchShell = { lessonIdx, lessonUrl, openHw, openTab, learnState, noteHelp, whatNext, nextTopic: () => nextTopic, goNext, startPending: () => startShown, storyPlaying: () => !!st, mediaBusy: () => !!(st && st.audio && !st.audio.paused && !st.audio.ended) || [...document.querySelectorAll('video,audio')].some(m => !m.paused && !m.ended && !m.muted), openQuiz, prefetchQuiz };
})();
