// Окно ИИ-репетитора «Луч» в правом нижнем углу.
// Два голосовых режима: микрофон в поле ввода (надиктовать вопрос, ответ текстом)
// и «Голосом» — живой разговор: ученик говорит, репетитор отвечает вслух и снова слушает.
// Страница может задать window.LUCH_CONTEXT() — текст о том, что сейчас на экране,
// и window.LUCH_SUGGEST() — список готовых вопросов.
(() => {
  if (window.__luchTutor) return; window.__luchTutor = true;
  const KEY = 'luch-tutor-chat', LANG_KEY = 'luch-tutor-lang';
  const page = location.pathname.replace(/\/+$/, '') || '/';
  const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

  const css = `
  .lt-btn{position:fixed;right:calc(18px + env(safe-area-inset-right,0px));bottom:calc(18px + env(safe-area-inset-bottom,0px));z-index:50;display:flex;align-items:center;gap:10px;background:#e8ecf4;color:#0b1019;border:0;border-radius:999px;padding:10px 18px 10px 10px;font:600 14px/1 "Golos Text",system-ui,sans-serif;cursor:pointer;box-shadow:0 10px 30px -8px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.08);text-align:left}
  .lt-btn:hover{transform:translateY(-1px)}
  .lt-btn .lt-av{width:34px;height:34px}
  .lt-btn small{display:block;font:500 11px/1.2 "IBM Plex Mono",monospace;color:#4a5570;margin-top:3px}
  .lt-panel{position:fixed;right:calc(18px + env(safe-area-inset-right,0px));bottom:calc(18px + env(safe-area-inset-bottom,0px));z-index:51;width:min(400px,calc(100vw - 36px));height:min(620px,calc(100vh - 36px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px)));display:flex;flex-direction:column;background:#121a28;border:1px solid #26324a;border-radius:18px;box-shadow:0 24px 60px -12px rgba(0,0,0,.75);color:#e8ecf4;font:15px/1.5 "Golos Text",system-ui,sans-serif;overflow:hidden}
  .lt-head{display:flex;align-items:center;gap:8px;padding:12px 10px 12px 14px;border-bottom:1px solid #26324a}
  .lt-head .lt-av{width:36px;height:36px;flex:none}
  .lt-head b{display:block;font-size:14.5px}
  .lt-head span{display:block;font:500 11px/1.3 "IBM Plex Mono",monospace;color:#8b96ad}
  .lt-head .lt-sp{flex:1;min-width:0}
  .lt-ib{background:none;border:1px solid #26324a;border-radius:8px;height:30px;padding:0 9px;color:#8b96ad;cursor:pointer;font:500 12px "Golos Text",sans-serif;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
  .lt-ib:hover{color:#e8ecf4;border-color:#8b96ad}
  .lt-ib.on{background:#72d4e8;border-color:#72d4e8;color:#0b1019}
  .lt-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;overscroll-behavior:contain}
  .lt-m{max-width:88%;padding:9px 12px;border-radius:14px;font-size:14px;line-height:1.5;overflow-wrap:anywhere}
  .lt-m.u{align-self:flex-end;background:#e8ecf4;color:#0b1019;border-bottom-right-radius:5px}
  .lt-m.a{align-self:flex-start;background:#1a2438;border-bottom-left-radius:5px}
  .lt-m.a p{margin:0 0 7px}.lt-m.a p:last-child{margin:0}
  .lt-m.a ul{margin:4px 0 7px;padding-left:18px}
  .lt-m.a code{font:500 13px "IBM Plex Mono",monospace;background:#0b1019;padding:1px 5px;border-radius:5px}
  .lt-board.peek{opacity:.12;pointer-events:none;transition:opacity .3s}
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
  .lt-voice{border-top:1px solid #26324a;padding:16px 14px 14px;display:flex;flex-direction:column;align-items:center;gap:10px}
  .lt-orb{width:96px;height:96px;border-radius:50%;border:0;cursor:pointer;position:relative;background:radial-gradient(circle at 40% 35%,#9fe6f3,#2b9fb5 60%,#14495a);box-shadow:0 0 0 0 rgba(114,212,232,.5)}
  .lt-orb[data-s="listening"]{animation:lt-o 1.3s infinite;background:radial-gradient(circle at 40% 35%,#ffd59a,#ffb547 55%,#8a5212)}
  .lt-orb[data-s="thinking"]{animation:lt-spin 1.2s linear infinite;background:conic-gradient(#72d4e8,#1a2438,#72d4e8)}
  .lt-orb[data-s="speaking"]{animation:lt-o 0.9s infinite}
  .lt-orb[data-s="idle"]{opacity:.75}
  .lt-orb svg{position:absolute;inset:0;margin:auto}
  @keyframes lt-o{0%{box-shadow:0 0 0 0 rgba(255,255,255,.35)}100%{box-shadow:0 0 0 22px rgba(255,255,255,0)}}
  @keyframes lt-spin{to{transform:rotate(360deg)}}
  .lt-vs{font:600 14px/1.3 "Golos Text",sans-serif;text-align:center}
  .lt-vh{font:500 12px/1.4 "Golos Text",sans-serif;color:#8b96ad;text-align:center;min-height:17px;max-width:320px}
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
    body.lt-board-on .lt-panel{height:min(48vh,420px)}
    .lt-bf{display:none}
    .lt-panel{right:0;left:0;bottom:0;width:100%;height:min(86vh,660px);border-radius:18px 18px 0 0;padding-bottom:env(safe-area-inset-bottom,0px)}
    .lt-btn{padding:7px;opacity:.94;bottom:calc(92px + env(safe-area-inset-bottom,0px))}
    .lt-btn>span{display:none}
    .lt-ib .lt-tx{display:none}
  }
  @media (prefers-reduced-motion:reduce){.lt-dots i,.lt-orb,.lt-mic.rec{animation:none!important}.lt-btn:hover{transform:none}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const AV = '<svg class="lt-av" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="17" fill="#0b1019"/><path d="M18 8c2.6 3 2.6 17 0 20c-2.6-3-2.6-17 0-20z" fill="#72d4e8"/><path d="M6 14h12l12 7" stroke="#ffb547" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 22h12l12-7" stroke="#ffb547" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".5"/></svg>';
  const MIC = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="6" y="1.5" width="6" height="10" rx="3" fill="currentColor"/><path d="M3.5 8.5a5.5 5.5 0 0 0 11 0M9 14v2.5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>';
  const WAVE = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 5v4M5 3v8M8 1.5v11M11 4v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const SPK = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M1 4.5h2.5L7 1.5v9L3.5 7.5H1z" fill="currentColor"/><path d="M9 3.5a3.5 3.5 0 0 1 0 5" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round"/></svg>';

  let chat = [];
  try { chat = JSON.parse(ls.get(KEY) || '[]') || []; } catch (e) { chat = []; }
  const saveChat = () => ls.set(KEY, JSON.stringify(chat.slice(-30)));
  let lang = ls.get(LANG_KEY) === 'kk' ? 'kk' : 'ru';

  const btn = document.createElement('button');
  btn.className = 'lt-btn'; btn.type = 'button'; btn.setAttribute('aria-label', 'Спросить репетитора');
  btn.innerHTML = `${AV}<span>Спросить репетитора<small>текстом или голосом</small></span>`;
  const panel = document.createElement('section');
  panel.className = 'lt-panel'; panel.hidden = true; panel.setAttribute('aria-label', 'ИИ-репетитор');
  panel.innerHTML = `
    <div class="lt-head">${AV}<div class="lt-sp"><b>Репетитор</b><span>видит экран</span></div>
      <button class="lt-ib" id="lt-vm" type="button" aria-pressed="false" title="Разговор голосом">${WAVE}<span class="lt-tx">Голосом</span></button>
      <button class="lt-ib" id="lt-bd" type="button" title="Доска: рисовать и показывать репетитору">✎<span class="lt-tx">Доска</span></button>
      <button class="lt-ib" id="lt-new" type="button" title="Начать заново">Заново</button>
      <button class="lt-ib" id="lt-close" type="button" aria-label="Свернуть">✕</button></div>
    <div class="lt-log" id="lt-log" aria-live="polite"></div>
    <div class="lt-sug" id="lt-sug"></div>
    <form class="lt-form" id="lt-form">
      <button class="lt-mic" id="lt-mic" type="button" aria-label="Надиктовать вопрос" title="Надиктовать вопрос">${MIC}</button>
      <textarea id="lt-in" rows="1" placeholder="Спросите что угодно про опыт…" aria-label="Вопрос репетитору"></textarea>
      <button class="lt-send" id="lt-send" type="submit" aria-label="Отправить"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 9h11M9.5 4.5L14 9l-4.5 4.5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button></form>
    <div class="lt-voice" id="lt-voice" hidden>
      <button class="lt-orb" id="lt-orb" type="button" data-s="idle" aria-label="Говорить"><svg width="30" height="30" viewBox="0 0 18 18" aria-hidden="true"><rect x="6" y="1.5" width="6" height="10" rx="3" fill="#0b1019"/><path d="M3.5 8.5a5.5 5.5 0 0 0 11 0M9 14v2.5" stroke="#0b1019" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg></button>
      <div class="lt-vs" id="lt-vs">Нажмите и говорите</div>
      <div class="lt-vh" id="lt-vh"></div>
      <div class="lt-vrow"><div class="lt-lang" role="group" aria-label="Язык речи"><button type="button" data-l="ru">Рус</button><button type="button" data-l="kk">Қаз</button></div>
        <button class="lt-ib" id="lt-vend" type="button">Закончить разговор</button></div>
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
  function suggestions() {
    let list = [];
    try { list = (window.LUCH_SUGGEST && window.LUCH_SUGGEST()) || []; } catch (e) {}
    if (!list.length) list = ['Объясни, что сейчас происходит в опыте', 'С чего начать?'];
    sug.innerHTML = list.slice(0, 3).map(q => `<button type="button">${esc(q)}</button>`).join('');
    sug.hidden = busy || voiceMode;
  }
  function render() {
    log.innerHTML = '';
    if (!chat.length) {
      const h = document.createElement('div'); h.className = 'lt-hello';
      h.innerHTML = '<b>Привет! Я твой репетитор 🙂</b>Я вижу, какой урок открыт и что происходит в опыте, могу показать нужное место на странице и нарисовать объяснение на доске. Спрашивай что угодно — глупых вопросов не бывает. Можно написать, надиктовать или поговорить голосом (кнопка «Голосом»), можно по-казахски. А на доске можно рисовать самому и показать мне рисунок.';
      log.appendChild(h);
    }
    chat.forEach(m => bubble(m.role, m.content, m.role === 'assistant'));
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
      u.lang = lang === 'kk' ? 'kk-KZ' : 'ru-RU';
      const v = speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith(lang === 'kk' ? 'kk' : 'ru'));
      if (v) u.voice = v;
      u.onend = u.onerror = () => res();
      speechSynthesis.speak(u);
    });
  }
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
      add(text) { const marks = marksOf(text); text = clean(text); if (!text) { marks.forEach(n => highlight(n)); return; } ended = false; queue.push({ text, marks, p: fetchWav(text) }); run(gen); },
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
      rec = new SR(); rec.lang = lang === 'kk' ? 'kk-KZ' : 'ru-RU'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
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
  function listen(onInterim) { return SR ? listenBrowser(onInterim) : listenRecorder(); }
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
    const el = it.el, r0 = el.getBoundingClientRect();
    if (r0.top < 60 || r0.bottom > innerHeight - 40) el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth' });
    if (!hlBox) { hlBox = document.createElement('div'); hlBox.className = 'lt-hl'; document.body.appendChild(hlBox); }
    const place = () => { const r = el.getBoundingClientRect(), p = 6; Object.assign(hlBox.style, { left: r.left - p + 'px', top: r.top - p + 'px', width: r.width + p * 2 + 'px', height: r.height + p * 2 + 'px' }); };
    place(); hlBox.classList.remove('on'); void hlBox.offsetWidth; hlBox.classList.add('on');
    // доска закрывает подсвеченное место — делаем её прозрачной на время подсветки
    const bw = document.querySelector('.lt-board:not([hidden])');
    if (bw) { const a = bw.getBoundingClientRect(), r = el.getBoundingClientRect(); if (r.left < a.right && r.right > a.left && r.top < a.bottom && r.bottom > a.top) { bw.classList.add('peek'); setTimeout(() => bw.classList.remove('peek'), 3500); } }
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
          <button class="lt-ib" data-a="send" type="button" title="Отправить рисунок репетитору">Спросить про рисунок</button>
          <button class="lt-ib" data-a="close" type="button" aria-label="Закрыть доску">✕</button></div>
        <div class="lt-bb"><svg viewBox="0 0 480 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#f4f1e8"/></marker></defs><g class="lt-layer"></g></svg><canvas></canvas></div>
        <div class="lt-bf">Рисуйте пальцем или мышкой — репетитор увидит рисунок, если нажать «Спросить про рисунок».</div>`;
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
    chat.push({ role: 'user', content: q + (opts.image ? '\n(рисунок с доски)' : '') }); bubble('user', q + (opts.image ? ' 🖼' : ''));
    const a = bubble('assistant', ''); a.innerHTML = '<span class="lt-dots"><i></i><i></i><i></i></span>'; scroll();
    let context = '';
    try { context = (window.LUCH_CONTEXT && window.LUCH_CONTEXT()) || ''; } catch (e) {}
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
        body: JSON.stringify({ page, voice: !!opts.voice, context: `${document.title}\n${context}`, elements, image: opts.image || undefined, messages: chat.slice(-20) }) });
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
  mic.addEventListener('click', async () => {
    unlockAudio();
    if (dict) { dict.stop(); return; }
    const before = inp.value ? inp.value.trim() + ' ' : '';
    mic.classList.add('rec'); mic.setAttribute('aria-label', 'Остановить запись');
    inp.placeholder = SR ? 'Говорите…' : 'Говорите, я запишу и расшифрую…';
    dict = listen(t => { inp.value = before + t; });
    let heard = '';
    try { heard = await dict.p; inp.value = (before + heard).trim(); }
    catch (e) { flash(micError(e)); }
    dict = null; mic.classList.remove('rec'); mic.setAttribute('aria-label', 'Надиктовать вопрос');
    inp.placeholder = 'Спросите что угодно про опыт…'; inp.dispatchEvent(new Event('input'));
    if (heard) { dictated = true; form.requestSubmit(); } else inp.focus();
  });
  function flash(msg) { const d = bubble('assistant', msg); d.style.opacity = '.8'; scroll(); }

  // ---------- voice conversation ----------
  let vListen = null, vState = 'idle';
  const VS = { idle: 'Нажмите и говорите', listening: 'Слушаю…', thinking: 'Думаю…', speaking: 'Говорю… нажмите, чтобы перебить' };
  function setVoice(s, hint) { vState = s; orb.dataset.s = s; vs.textContent = VS[s]; if (hint !== undefined) vh.textContent = hint; }
  function setLang(l) { lang = l; ls.set(LANG_KEY, l); voiceBox.querySelectorAll('.lt-lang button').forEach(b => b.setAttribute('aria-pressed', b.dataset.l === l)); }
  voiceBox.querySelector('.lt-lang').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setLang(b.dataset.l); });
  setLang(lang);
  async function turn() {
    if (!voiceMode || busy) return;
    setVoice('listening', '');
    vListen = listen(t => { vh.textContent = t; });
    let q = '';
    try { q = await vListen.p; } catch (e) { vListen = null; setVoice('idle', micError(e)); return; }
    vListen = null;
    if (!voiceMode) return;
    if (!q) { setVoice('idle', 'Ничего не услышал. Нажмите на кружок и говорите.'); return; }
    vh.textContent = q; setVoice('thinking');
    speaker.stop();
    await ask(q, { voice: true });
    if (!voiceMode) return;
    await speaker.idle();
    if (voiceMode && vState !== 'idle') turn();
  }
  orb.addEventListener('click', () => {
    unlockAudio();
    if (vState === 'listening' && vListen) { vListen.stop(); return; }
    if (vState === 'speaking' || vState === 'thinking') { if (ctrl) ctrl.abort(); speaker.stop(); setVoice('idle', ''); setTimeout(turn, 50); return; }
    turn();
  });
  function setMode(on) {
    voiceMode = on;
    vmBtn.classList.toggle('on', on); vmBtn.setAttribute('aria-pressed', on);
    voiceBox.hidden = !on; form.hidden = on; suggestions();
    if (on) { if (!canListen) { setVoice('idle', 'В этом браузере нет доступа к микрофону. Откройте сайт в Chrome или Safari.'); return; } unlockAudio(); turn(); }
    else { if (vListen) { vListen.abort(); vListen = null; } speaker.stop(); setVoice('idle', ''); }
  }
  vmBtn.addEventListener('click', () => setMode(!voiceMode));
  $('#lt-vend').addEventListener('click', () => setMode(false));

  const open = () => { panel.hidden = false; btn.hidden = true; render(); setTimeout(() => (voiceMode ? orb : inp).focus(), 30); };
  function openPanel() { if (panel.hidden) open(); }
  $('#lt-bd').addEventListener('click', () => (board.open ? board.hide() : board.show()));
  window.LuchTutor = { ask: q => { openPanel(); ask(q); }, open: openPanel, board };
  const close = () => { setMode(false); if (dict) dict.abort(); panel.hidden = true; btn.hidden = false; btn.focus(); };
  btn.addEventListener('click', open);
  $('#lt-close').addEventListener('click', close);
  $('#lt-new').addEventListener('click', () => { if (ctrl) ctrl.abort(); speaker.stop(); chat = []; saveChat(); busy = false; send.disabled = false; render(); if (voiceMode) setVoice('idle', ''); });
  panel.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  sug.addEventListener('click', e => { const b = e.target.closest('button'); if (b) ask(b.textContent); });
  form.addEventListener('submit', e => {
    e.preventDefault(); const q = inp.value, voice = dictated; dictated = false;
    inp.value = ''; inp.style.height = '';
    if (voice) speaker.stop();
    ask(q, { voice }).then(() => inp.focus());
  });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  inp.addEventListener('input', () => { inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 120) + 'px'; });
  if (window.speechSynthesis) speechSynthesis.getVoices();
  if (document.getElementById('tab-overview') && !window.LuchShell) { const sc = document.createElement('script'); sc.src = '/luch/lab-shell.js'; document.head.appendChild(sc); }
})();
