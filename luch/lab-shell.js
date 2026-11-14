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
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
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
    const url = lessonUrl(), title = (lessonTitle() || document.title) + ' — интерактивный урок Labiq';
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

  window.LuchShell = { lessonIdx, lessonUrl, openHw, openTab };
})();
