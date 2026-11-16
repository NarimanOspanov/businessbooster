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
  .ls-stage .pic:has(.brd.on) .big{top:auto;left:auto;right:18px;bottom:18px;margin:0;width:52px;height:52px;font-size:18px}
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
  .ls-stage .ic{width:44px;height:44px;border-radius:12px;border:1px solid var(--line,#26324a);background:var(--surface-2,#1a2438);color:var(--fg,#e8ecf4);font-size:20px;cursor:pointer;flex:none}
  .ls-stage .ic.rate{width:auto;min-width:52px;padding:0 10px;font:600 14px/1 var(--font-mono,monospace)}
  .ls-stage.done .ic.rate{visibility:hidden}
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
    story.innerHTML = `<button type="button" class="play" data-a="story"><i>▶</i><span><b>Объясни за минуту</b><small>картинки и голос · что это, зачем, как работает</small></span></button>` +
      (reel ? `<div class="acts" style="display:flex;gap:6px;margin-top:10px"><button class="ls-btn" data-a="reel">▶ Смотреть видео</button><button class="ls-btn ghost" data-a="story">Объясни за минуту</button></div>` : '');
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
    st.el.remove(); removeEventListener('keydown', stKeys, true); st = null;
  }
  function stKeys(e) {
    if (!st) return;
    if (e.key === 'Escape') { e.preventDefault(); stopStory(); }
    else if (e.key === ' ' && !/INPUT|TEXTAREA/.test(e.target.tagName)) { e.preventDefault(); togglePause(); }
    else if (e.key === 'ArrowRight') stGo(st.i + 1);
    else if (e.key === 'ArrowLeft') stGo(Math.max(0, st.i - 1));
  }
  // скорость лекции — как в плеерах; общая с аудиогидом, запоминается
  const RATES = [1, 1.2, 1.5, 2];
  let rate = 1; try { rate = RATES.includes(+localStorage.getItem('ag-rate')) ? +localStorage.getItem('ag-rate') : 1; } catch (e) {}
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
  function stShell() {
    const el = document.createElement('div'); el.className = 'ls-stage'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Теория');
    el.innerHTML = '<div class="frame"><div class="pic"><div class="pv"><div class="k">Урок ' + (lessonIdx() + 1) + ' · теория</div><h4></h4>' +
      '<ul><li data-s="text">Пишу лекцию</li><li data-s="img">Рисую картинки</li><li data-s="voice">Записываю голос</li></ul></div><i class="wt"></i><button class="big" data-a="pp" aria-label="Пауза"><span>❚❚</span></button></div>' +
      '<div class="txt" data-noi18n><b>Готовлю лекцию</b><div class="fact"></div></div>' +
      '<div class="dots"></div>' +
      '<div class="ctl"><button class="ic" data-a="prev" aria-label="Назад">‹</button><button class="pp" data-a="pp"></button><button class="ic" data-a="next" aria-label="Дальше">›</button>' +
      '<button class="ic rate" data-a="rate" aria-label="Скорость 1×" title="Скорость: 1×, 1,2×, 1,5×, 2×">1×</button><span class="sp"></span><button class="ls-btn ghost" data-a="practice">К практике →</button><button class="ic x" data-a="close" aria-label="Закрыть">✕</button></div></div>';
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
      else if (a === 'practice') toPractice();
      else if (a === 'askq') { stopStory(); if (window.LuchTutor && window.LuchTutor.talk) window.LuchTutor.talk('Какой вопрос по объяснению? Спрашивай голосом — я слушаю. Можно и написать.'); }
    });
    el.querySelector('.pv h4').textContent = lessonTitle() || document.title;
    return el;
  }
  // пока готовится лекция — полезные факты с этой же страницы
  function pageFacts() {
    const txt = [...document.querySelectorAll('#pane-overview p, #pane-overview li')].map(e => e.textContent.replace(/\s+/g, ' ').trim()).join(' ');
    return (txt.match(/[^.!?]+[.!?]/g) || []).map(x => x.trim()).filter(x => x.length >= 40 && x.length <= 180);
  }
  function factsLoop(me) {
    const box = me.el.querySelector('.fact'), list = pageFacts();
    if (!list.length) { box.innerHTML = '<small>Минутку</small>Сейчас будет короткая лекция с картинками: что это, зачем нужно, как работает и немного истории.'; return; }
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
  const loadImg = i => st.img[i] || (st.img[i] = (st.secs[i] && st.secs[i].formulas) ? Promise.resolve(null) : new Promise(res => {
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
      const outro = 'Если что-то осталось непонятным — спроси меня, я отвечу. А если всё ясно — попробуй сам в опыте.';
      txt.innerHTML = '<b>Объяснение закончено</b><p>' + esc(outro) + '</p><div class="end"><button class="ls-btn main" data-a="askq">🎤 Задать вопрос</button><button class="ls-btn" data-a="practice">Теперь попробуй сам →</button><button class="ls-btn ghost" data-a="again">Посмотреть ещё раз</button></div>';
      // наставник говорит это вслух, как продолжение объяснения
      tts(outro).then(blob => {
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
      const node = sec.formulas ? boardOf(sec) : im ? im.cloneNode() : null;
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
  async function playStory() {
    stopStory();
    const audio = new Audio();
    // разблокируем звук сразу по нажатию (на телефонах иначе не заиграет)
    audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA='; audio.play().catch(() => {});
    st = { el: stShell(), secs: [], i: 0, paused: false, audio, voice: [], img: [], run: 0 };
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
    const first = [loadImg(0).then(x => (step('img'), x)), voiceOf(0).then(x => (step('voice'), x))];
    if (st.secs[1]) { loadImg(1); voiceOf(1); }
    await Promise.all(first);
    if (st !== me) return;
    clearInterval(me.factT);
    const pv = me.el.querySelector('.pv'); pv.querySelector('ul').outerHTML = '<div class="go">Готово, поехали!</div>';
    await new Promise(r => setTimeout(r, 900));
    if (st !== me) return;
    stGo(0);
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

  // карточка в начале урока: «Объясни за минуту» или «Сразу к практике» — каждый раз, когда открывается урок
  const seenKey = () => 'oe-start:' + location.pathname + ':' + lessonIdx();
  let startShown = false;
  function startCard() {
    if (startShown || st || document.querySelector('.ls-start')) return false;
    try { localStorage.setItem(seenKey(), '1'); } catch (e) {} // отметка «урок открывали» — для прогресса и наставника
    startShown = true;
    const reel = reelBtn(), h = lessonTitle(), n = lessonIdx() + 1, total = cards().length;
    const w = document.createElement('div'); w.className = 'ls-start'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-label', 'Начало урока');
    w.innerHTML = `<div class="card"><div class="k">Урок ${n} из ${total}</div><h3>${esc(h)}</h3>
      <p>Сначала — интересная теория: что это, зачем нужно и как работает. Потом попробуешь сам в опыте, а в конце закрепим домашним заданием.</p>
      <div class="acts">${reel ? '<button class="ls-btn main" data-a="reel">▶ Смотреть видео</button>' : ''}<button class="ls-btn ${reel ? '' : 'main'}" data-a="story">▶ Объясни за минуту</button><button class="ls-btn ghost" data-a="practice">Сразу к практике</button></div></div>`;
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
  const taskEl = document.querySelector('#stage .task');
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

  window.LuchShell = { lessonIdx, lessonUrl, openHw, openTab, learnState, noteHelp, whatNext, nextTopic: () => nextTopic, goNext, startPending: () => startShown, storyPlaying: () => !!st, mediaBusy: () => !!(st && st.audio && !st.audio.paused && !st.audio.ended) || [...document.querySelectorAll('video,audio')].some(m => !m.paused && !m.ended && !m.muted), openQuiz, prefetchQuiz };
})();
