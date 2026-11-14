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
    const url = lessonUrl(), title = (lessonTitle() || document.title) + ' — интерактивный урок Open Edu AI';
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
  .ls-start{position:fixed;inset:0;z-index:70;display:grid;place-items:center;background:rgba(5,8,14,.72);padding:16px}
  .ls-start .card{width:min(440px,100%);background:var(--surface,#121a28);border:1px solid var(--line,#26324a);border-radius:20px;padding:24px;box-shadow:0 30px 80px -20px rgba(0,0,0,.8);color:var(--fg,#e8ecf4)}
  .ls-start .k{font:500 11px/1.4 var(--font-mono,monospace);letter-spacing:.1em;text-transform:uppercase;color:var(--muted,#8b96ad)}
  .ls-start h3{font:500 22px/1.25 var(--font-display,"Unbounded",sans-serif);margin:8px 0 10px;text-wrap:balance}
  .ls-start p{margin:0 0 18px;color:var(--muted,#8b96ad);font-size:14.5px;line-height:1.55}
  .ls-start .acts{display:flex;flex-direction:column;gap:8px}
  .ls-start .ls-btn{padding:13px 16px;font-size:15px;border-radius:12px}
  .ls-start .ls-btn.main{background:var(--accent,#ffb547)}
  .ls-stage{position:fixed;inset:0;z-index:72;display:grid;place-items:center;background:rgba(5,8,14,.86);padding:16px;animation:ls-in .25s ease}
  @keyframes ls-in{from{opacity:0}}
  .ls-stage .frame{width:min(920px,100%,calc((100vh - 290px) * 1.78));min-width:min(560px,100%);max-height:100%;display:flex;flex-direction:column;background:var(--surface,#121a28);border:1px solid var(--line,#26324a);border-radius:20px;overflow:hidden;box-shadow:0 30px 90px -20px rgba(0,0,0,.9);color:var(--fg,#e8ecf4)}
  .ls-stage .pic{position:relative;aspect-ratio:16/9;background:linear-gradient(120deg,#1a2438,#22304a,#1a2438);background-size:200% 100%;animation:ls-shim 2.4s linear infinite;overflow:hidden;flex:none}
  .ls-stage .pic.has{animation:none;background:#0b1019}
  @keyframes ls-shim{to{background-position:-200% 0}}
  .ls-stage .ph{position:absolute;inset:0;display:grid;place-items:center;font:500 12px/1 var(--font-mono,monospace);letter-spacing:.12em;text-transform:uppercase;color:var(--muted,#8b96ad)}
  .ls-stage .pic.has .ph{display:none}
  .ls-stage .pic img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .8s ease;transform-origin:50% 50%}
  .ls-stage .pic img.on{opacity:1;animation:ls-kb 18s ease-out forwards}
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
  .ls-stage .ic{width:44px;height:44px;border-radius:12px;border:1px solid var(--line,#26324a);background:var(--surface-2,#1a2438);color:var(--fg,#e8ecf4);font-size:20px;cursor:pointer;flex:none}
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
    .ls-stage .ctl{padding-bottom:max(16px,env(safe-area-inset-bottom))}
  }
  @media (prefers-reduced-motion:reduce){.ls-stage .pic img.on{animation:none}.ls-stage{animation:none}}`;
  document.head.appendChild(css2);
  const story = document.createElement('div'); story.className = 'ls-story';
  sub.after(story);
  const LANG2 = (window.LuchI18n && window.LuchI18n.lang) || 'ru';
  const reelBtn = () => P('overview') && P('overview').querySelector('[data-reel]');
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
    story.innerHTML = `<button type="button" class="play" data-a="story"><i>▶</i><span><b>${reel ? 'Теория: видео и рассказ с картинками' : 'Теория: рассказ с картинками'}</b><small>что это · зачем нужно · как работает · немного истории</small></span></button>` +
      (reel ? `<div class="acts" style="display:flex;gap:6px;margin-top:10px"><button class="ls-btn" data-a="reel">▶ Смотреть видео</button><button class="ls-btn ghost" data-a="story">Послушать теорию</button></div>` : '');
  }
  // Плеер «Теории»: картинка на раздел + голос + подпись. Пауза доступна всегда.
  const imgUrl = i => '/api/tutor/story/img?k=' + encodeURIComponent(storyKey() + '|' + LANG2) + '&i=' + i;
  const tts = text => fetch('/api/tutor/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) }).then(r => r.ok ? r.blob() : null).catch(() => null);
  let st = null; // { el, secs, i, paused, audio, voice:[promise], timer, run }
  function stopStory() {
    if (!st) return;
    st.run = -1; clearTimeout(st.timer);
    try { st.audio.pause(); st.audio.removeAttribute('src'); } catch (e) {}
    (st.url || []).forEach(u => u && URL.revokeObjectURL(u));
    st.el.remove(); removeEventListener('keydown', stKeys, true); st = null;
  }
  function stKeys(e) {
    if (!st) return;
    if (e.key === 'Escape') { e.preventDefault(); stopStory(); }
    else if (e.key === ' ' && !/INPUT|TEXTAREA/.test(e.target.tagName)) { e.preventDefault(); togglePause(); }
    else if (e.key === 'ArrowRight') stGo(st.i + 1);
    else if (e.key === 'ArrowLeft') stGo(Math.max(0, st.i - 1));
  }
  function stPaint() {
    const el = st.el, pp = el.querySelector('[data-a="pp"]');
    pp.innerHTML = st.paused ? '▶ <span>Продолжить</span>' : '❚❚ <span>Пауза</span>';
    pp.setAttribute('aria-label', st.paused ? 'Продолжить' : 'Пауза');
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
  function stShell() {
    const el = document.createElement('div'); el.className = 'ls-stage'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Теория');
    el.innerHTML = '<div class="frame"><div class="pic"><div class="ph"><span>Готовлю лекцию…</span></div></div>' +
      '<div class="txt" data-noi18n><b></b><p>Готовлю лекцию… это займёт несколько секунд.</p></div>' +
      '<div class="dots"></div>' +
      '<div class="ctl"><button class="ic" data-a="prev" aria-label="Назад">‹</button><button class="pp" data-a="pp"></button><button class="ic" data-a="next" aria-label="Дальше">›</button>' +
      '<span class="sp"></span><button class="ls-btn ghost" data-a="practice">К практике →</button><button class="ic x" data-a="close" aria-label="Закрыть">✕</button></div></div>';
    el.addEventListener('click', e => {
      if (e.target === el) return stopStory();
      const b = e.target.closest('[data-a]'); if (!b || !st) return;
      const a = b.dataset.a;
      if (a === 'pp') togglePause();
      else if (a === 'prev') stGo(Math.max(0, st.i - 1));
      else if (a === 'next') stGo(st.i + 1);
      else if (a === 'dot') stGo(+b.dataset.i);
      else if (a === 'close') stopStory();
      else if (a === 'again') stGo(0);
      else if (a === 'practice') toPractice();
    });
    return el;
  }
  function stGo(i) {
    if (!st) return;
    const my = ++st.run; clearTimeout(st.timer);
    try { st.audio.pause(); } catch (e) {}
    st.i = i; st.paused = false;
    const el = st.el, secs = st.secs, pic = el.querySelector('.pic'), txt = el.querySelector('.txt');
    el.querySelector('.dots').innerHTML = secs.map((x, k) => '<button data-a="dot" data-i="' + k + '" class="' + (k < i ? 'on' : k === i ? 'on cur' : '') + '" aria-label="' + esc(x.title) + '"></button>').join('');
    if (i >= secs.length) { // конец
      el.classList.add('done');
      txt.innerHTML = '<b>Теория пройдена</b><p>Теперь самое интересное — попробуй сам в опыте.</p><div class="end"><button class="ls-btn main" data-a="practice">Теперь попробуй сам →</button><button class="ls-btn ghost" data-a="again">Послушать ещё раз</button></div>';
      return stPaint();
    }
    el.classList.remove('done');
    const sec = secs[i];
    txt.innerHTML = '<b>' + esc(sec.title) + '</b><p>' + esc(sec.text) + '</p>';
    // картинка: плавная смена, лёгкий наезд камеры
    const old = pic.querySelector('img.on');
    const im = new Image(); im.alt = ''; im.decoding = 'async';
    im.onload = () => { if (!st || st.i !== i) return; pic.appendChild(im); requestAnimationFrame(() => { im.classList.add('on'); if (old) old.classList.remove('on'); setTimeout(() => old && old.remove(), 900); pic.classList.add('has'); }); };
    im.onerror = () => { if (st && st.i === i && !pic.querySelector('img')) pic.classList.remove('has'); };
    im.src = imgUrl(i);
    if (!old) pic.classList.remove('has');
    stPaint();
    // голос
    const v = st.voice[i] || (st.voice[i] = tts(sec.text));
    if (i + 1 < secs.length && !st.voice[i + 1]) st.voice[i + 1] = tts(secs[i + 1].text);
    v.then(blob => {
      if (!st || st.run !== my) return;
      const nextUp = () => { if (st && st.run === my && !st.paused) stGo(i + 1); };
      if (blob && blob.size > 100) {
        st.url = st.url || []; st.url[i] = st.url[i] || URL.createObjectURL(blob);
        st.audio.onended = () => setTimeout(nextUp, 700);
        st.audio.onerror = () => { st.timer = setTimeout(nextUp, 6000); };
        st.audio.src = st.url[i];
        if (!st.paused) st.audio.play().catch(() => { st.paused = true; stPaint(); });
      } else st.timer = setTimeout(nextUp, 7000);
    });
  }
  async function playStory() {
    stopStory();
    const audio = new Audio();
    // разблокируем звук сразу по нажатию (на телефонах иначе не заиграет)
    audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA='; audio.play().catch(() => {});
    st = { el: stShell(), secs: [], i: 0, paused: false, audio, voice: [], run: 0 };
    document.body.appendChild(st.el); addEventListener('keydown', stKeys, true);
    st.el.querySelector('[data-a="pp"]').innerHTML = '❚❚ <span>Пауза</span>';
    const me = st;
    let s; try { s = await fetchStory(); } catch (e) {
      if (st !== me) return;
      st.el.querySelector('.txt').innerHTML = '<b>Теория</b><p>Не получилось подготовить лекцию. Попробуйте ещё раз чуть позже.</p>';
      return;
    }
    if (st !== me) return;
    st.secs = s.sections; stGo(0);
    st.el.querySelector('[data-a="pp"]').focus();
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

  // карточка в начале урока: «Начнём с теории?» (один раз на урок)
  const seenKey = () => 'oe-start:' + location.pathname + ':' + lessonIdx();
  let startShown = false;
  function startCard() {
    if (localStorage.getItem(seenKey())) return false;
    try { localStorage.setItem(seenKey(), '1'); } catch (e) {}
    startShown = true;
    const reel = reelBtn(), h = lessonTitle(), n = lessonIdx() + 1, total = cards().length;
    const w = document.createElement('div'); w.className = 'ls-start'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-label', 'Начало урока');
    w.innerHTML = `<div class="card"><div class="k">Урок ${n} из ${total}</div><h3>${esc(h)}</h3>
      <p>Сначала — интересная теория: что это, зачем нужно и как работает. Потом попробуешь сам в опыте, а в конце закрепим домашним заданием.</p>
      <div class="acts">${reel ? '<button class="ls-btn main" data-a="reel">▶ Смотреть видео</button>' : ''}<button class="ls-btn ${reel ? '' : 'main'}" data-a="story">▶ Слушать теорию · 1 мин</button><button class="ls-btn ghost" data-a="practice">Сразу к практике</button></div></div>`;
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
  const prep = () => { if (!reelBtn()) fetchStory().then(j => j.sections.forEach((x, i) => { new Image().src = imgUrl(i); })).catch(() => {}); };
  setTimeout(() => { startCard(); prep(); }, 300);
  if (lessonsBox) { let t2 = 0; new MutationObserver(() => { clearTimeout(t2); t2 = setTimeout(() => { stopStory(); storyIdle(); startCard(); prep(); }, 400); }).observe(lessonsBox, { attributes: true, subtree: true, attributeFilter: ['aria-current'] }); }

  window.LuchShell = { lessonIdx, lessonUrl, openHw, openTab, startPending: () => startShown, storyPlaying: () => !!st };
})();
