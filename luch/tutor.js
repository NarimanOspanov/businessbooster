// Окно ИИ-репетитора «Луч» в правом нижнем углу.
// Страница может задать window.LUCH_CONTEXT() — текст о том, что сейчас на экране,
// и window.LUCH_SUGGEST() — список готовых вопросов.
(() => {
  if (window.__luchTutor) return; window.__luchTutor = true;
  const KEY = 'luch-tutor-chat';
  const page = location.pathname.replace(/\/+$/, '') || '/';

  const css = `
  .lt-btn{position:fixed;right:calc(18px + env(safe-area-inset-right,0px));bottom:calc(18px + env(safe-area-inset-bottom,0px));z-index:50;display:flex;align-items:center;gap:10px;background:#e8ecf4;color:#0b1019;border:0;border-radius:999px;padding:10px 18px 10px 10px;font:600 14px/1 "Golos Text",system-ui,sans-serif;cursor:pointer;box-shadow:0 10px 30px -8px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.08)}
  .lt-btn:hover{transform:translateY(-1px)}
  .lt-btn .lt-av{width:34px;height:34px}
  .lt-btn small{display:block;font:500 11px/1.2 "IBM Plex Mono",monospace;color:#4a5570;margin-top:3px}
  .lt-panel{position:fixed;right:calc(18px + env(safe-area-inset-right,0px));bottom:calc(18px + env(safe-area-inset-bottom,0px));z-index:51;width:min(400px,calc(100vw - 36px));height:min(600px,calc(100vh - 36px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px)));display:flex;flex-direction:column;background:#121a28;border:1px solid #26324a;border-radius:18px;box-shadow:0 24px 60px -12px rgba(0,0,0,.75);color:#e8ecf4;font:15px/1.5 "Golos Text",system-ui,sans-serif;overflow:hidden}
  .lt-head{display:flex;align-items:center;gap:10px;padding:12px 12px 12px 14px;border-bottom:1px solid #26324a}
  .lt-head .lt-av{width:36px;height:36px;flex:none}
  .lt-head b{display:block;font-size:14.5px}
  .lt-head span{display:block;font:500 11px/1.3 "IBM Plex Mono",monospace;color:#8b96ad}
  .lt-head .lt-sp{flex:1;min-width:0}
  .lt-ib{background:none;border:1px solid #26324a;border-radius:8px;height:30px;padding:0 9px;color:#8b96ad;cursor:pointer;font:500 12px "Golos Text",sans-serif}
  .lt-ib:hover{color:#e8ecf4;border-color:#8b96ad}
  .lt-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;overscroll-behavior:contain}
  .lt-m{max-width:88%;padding:9px 12px;border-radius:14px;font-size:14px;line-height:1.5;white-space:normal;overflow-wrap:anywhere}
  .lt-m.u{align-self:flex-end;background:#e8ecf4;color:#0b1019;border-bottom-right-radius:5px}
  .lt-m.a{align-self:flex-start;background:#1a2438;border-bottom-left-radius:5px}
  .lt-m.a p{margin:0 0 7px}.lt-m.a p:last-child{margin:0}
  .lt-m.a ul{margin:4px 0 7px;padding-left:18px}
  .lt-m.a code{font:500 13px "IBM Plex Mono",monospace;background:#0b1019;padding:1px 5px;border-radius:5px}
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
  .lt-send{width:42px;height:42px;flex:none;border:0;border-radius:12px;background:#ffb547;color:#0b1019;cursor:pointer;display:grid;place-items:center}
  .lt-send:disabled{opacity:.4;cursor:default}
  .lt-btn:focus-visible,.lt-ib:focus-visible,.lt-send:focus-visible,.lt-sug button:focus-visible{outline:2px solid #72d4e8;outline-offset:2px}
  @media (max-width:600px){
    .lt-panel{right:0;left:0;bottom:0;width:100%;height:min(82vh,640px);border-radius:18px 18px 0 0;padding-bottom:env(safe-area-inset-bottom,0px)}
    .lt-btn{padding:8px 14px 8px 8px}
    .lt-btn small{display:none}
  }
  @media (prefers-reduced-motion:reduce){.lt-dots i{animation:none}.lt-btn:hover{transform:none}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const AV = '<svg class="lt-av" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="17" fill="#0b1019"/><path d="M18 8c2.6 3 2.6 17 0 20c-2.6-3-2.6-17 0-20z" fill="#72d4e8"/><path d="M6 14h12l12 7" stroke="#ffb547" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 22h12l12-7" stroke="#ffb547" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".5"/></svg>';

  let chat = [];
  try { chat = JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch (e) { chat = []; }
  const saveChat = () => { try { localStorage.setItem(KEY, JSON.stringify(chat.slice(-30))); } catch (e) {} };

  const btn = document.createElement('button');
  btn.className = 'lt-btn'; btn.type = 'button';
  btn.innerHTML = `${AV}<span>Спросить репетитора<small>ИИ видит ваш опыт</small></span>`;
  const panel = document.createElement('section');
  panel.className = 'lt-panel'; panel.hidden = true; panel.setAttribute('aria-label', 'ИИ-репетитор');
  panel.innerHTML = `
    <div class="lt-head">${AV}<div class="lt-sp"><b>Репетитор «Луч»</b><span id="lt-sub">видит, что у вас на экране</span></div>
      <button class="lt-ib" id="lt-new" type="button" title="Начать заново">Заново</button>
      <button class="lt-ib" id="lt-close" type="button" aria-label="Свернуть">✕</button></div>
    <div class="lt-log" id="lt-log" aria-live="polite"></div>
    <div class="lt-sug" id="lt-sug"></div>
    <form class="lt-form" id="lt-form"><textarea id="lt-in" rows="1" placeholder="Спросите что угодно про опыт…" aria-label="Вопрос репетитору"></textarea>
      <button class="lt-send" id="lt-send" type="submit" aria-label="Отправить"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 9h11M9.5 4.5L14 9l-4.5 4.5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button></form>`;
  document.body.append(btn, panel);
  const log = panel.querySelector('#lt-log'), inp = panel.querySelector('#lt-in'), send = panel.querySelector('#lt-send'), sug = panel.querySelector('#lt-sug');

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
  const bubble = (role, text) => { const d = document.createElement('div'); d.className = 'lt-m ' + (role === 'user' ? 'u' : 'a'); if (role === 'user') d.textContent = text; else d.innerHTML = md(text); log.appendChild(d); return d; };
  const scroll = () => { log.scrollTop = log.scrollHeight; };

  function suggestions() {
    let list = [];
    try { list = (window.LUCH_SUGGEST && window.LUCH_SUGGEST()) || []; } catch (e) {}
    if (!list.length) list = ['Объясни, что сейчас происходит в опыте', 'С чего начать?'];
    sug.innerHTML = list.slice(0, 3).map(q => `<button type="button">${esc(q)}</button>`).join('');
    sug.hidden = busy;
  }
  function render() {
    log.innerHTML = '';
    if (!chat.length) {
      const h = document.createElement('div'); h.className = 'lt-hello';
      h.innerHTML = '<b>Привет! Я репетитор по физике.</b>Вижу, какой урок открыт и что вы сейчас крутите в опыте. Спрашивайте что угодно: почему так происходит, как решить задание, где ошибка. Можно по-казахски.';
      log.appendChild(h);
    }
    chat.forEach(m => bubble(m.role, m.content));
    suggestions(); scroll();
  }

  let busy = false, ctrl = null;
  async function ask(q) {
    q = q.trim(); if (!q || busy) return;
    busy = true; send.disabled = true; sug.hidden = true;
    if (!chat.length) log.innerHTML = '';
    chat.push({ role: 'user', content: q }); bubble('user', q);
    const a = bubble('assistant', ''); a.innerHTML = '<span class="lt-dots"><i></i><i></i><i></i></span>'; scroll();
    let context = '';
    try { context = (window.LUCH_CONTEXT && window.LUCH_CONTEXT()) || ''; } catch (e) {}
    let text = '';
    ctrl = new AbortController();
    try {
      const res = await fetch('/api/tutor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
        body: JSON.stringify({ page, context: `${document.title}\n${context}`, messages: chat.slice(-20) }) });
      if (!res.ok) { let msg = 'Не получилось ответить. Попробуйте ещё раз.'; try { msg = (await res.json()).error || msg; } catch (e) {} text = msg; }
      else {
        const rd = res.body.getReader(), dec = new TextDecoder();
        for (;;) { const { done, value } = await rd.read(); if (done) break; text += dec.decode(value, { stream: true }); a.innerHTML = md(text); scroll(); }
      }
    } catch (e) { if (e.name !== 'AbortError') text = text || 'Нет связи с сервером. Проверьте интернет и спросите ещё раз.'; }
    text = text.trim() || 'Не получилось ответить. Попробуйте ещё раз.';
    a.innerHTML = md(text);
    chat.push({ role: 'assistant', content: text }); saveChat();
    busy = false; send.disabled = false; ctrl = null; suggestions(); scroll();
    inp.focus();
  }

  const open = () => { panel.hidden = false; btn.hidden = true; render(); setTimeout(() => inp.focus(), 30); };
  const close = () => { panel.hidden = true; btn.hidden = false; btn.focus(); };
  btn.addEventListener('click', open);
  panel.querySelector('#lt-close').addEventListener('click', close);
  panel.querySelector('#lt-new').addEventListener('click', () => { if (ctrl) ctrl.abort(); chat = []; saveChat(); busy = false; send.disabled = false; render(); inp.focus(); });
  panel.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  sug.addEventListener('click', e => { const b = e.target.closest('button'); if (b) ask(b.textContent); });
  panel.querySelector('#lt-form').addEventListener('submit', e => { e.preventDefault(); const q = inp.value; inp.value = ''; inp.style.height = ''; ask(q); });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); panel.querySelector('#lt-form').requestSubmit(); } });
  inp.addEventListener('input', () => { inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 120) + 'px'; });
})();
