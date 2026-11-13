// Ролики-объяснения «Луч» в формате Reels: вертикальная карточка, анимированная
// схема из самого опыта, крупные подписи, формулы, субтитры и закадровый голос.
// Страница вызывает LuchReel.setup({ scenes, draw, viewBox, base, titleOf }), где
// scenes[lessonId] = [{ cap, say, formula?, from, to }], draw(state, sceneIndex) → SVG-разметка.
// Голос лежит файлами base + `${lessonId}-${n}.mp3`, длительности — в base + 'durations.json'.
(() => {
  const css = `
  .lr-cover{display:flex;gap:14px;align-items:center;width:100%;text-align:left;background:linear-gradient(135deg,#1a2438,#121a28);border:1px solid #26324a;border-radius:14px;padding:10px;cursor:pointer;color:#e8ecf4;margin:0 0 16px}
  .lr-cover:hover{border-color:#ffb547}
  .lr-thumb{position:relative;width:78px;aspect-ratio:9/16;flex:none;border-radius:10px;overflow:hidden;background:radial-gradient(120% 80% at 50% 30%,#22304a,#0b1019)}
  .lr-thumb svg{position:absolute;left:-30%;width:160%;top:38%}
  .lr-thumb i{position:absolute;inset:0;margin:auto;width:30px;height:30px;border-radius:50%;background:#ffb547;display:grid;place-items:center}
  .lr-cover b{display:block;font:500 15px/1.25 "Unbounded","Golos Text",sans-serif}
  .lr-cover span{display:block;font:500 12px/1.4 "IBM Plex Mono",monospace;color:#8b96ad;margin-top:6px}
  .lr-wrap{position:fixed;inset:0;z-index:60;background:rgba(5,8,14,.88);display:grid;place-items:center;padding:max(12px,env(safe-area-inset-top,0px)) 12px max(12px,env(safe-area-inset-bottom,0px))}
  .lr-card{position:relative;height:min(88vh,780px);aspect-ratio:9/16;max-width:94vw;border-radius:22px;overflow:hidden;background:radial-gradient(130% 70% at 50% 18%,#1d2a42 0%,#0e1520 60%,#0b1019 100%);border:1px solid #26324a;display:flex;flex-direction:column;color:#e8ecf4;font-family:"Golos Text",system-ui,sans-serif;user-select:none}
  .lr-bars{display:flex;gap:4px;padding:12px 14px 0}
  .lr-bars i{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.18);overflow:hidden}
  .lr-bars i b{display:block;height:100%;width:0;background:#e8ecf4}
  .lr-top{display:flex;align-items:center;gap:8px;padding:10px 12px 0 16px;position:relative;z-index:3}
  .lr-top .lr-t{flex:1;min-width:0;font:600 11px/1.3 "Golos Text",sans-serif;letter-spacing:.11em;text-transform:uppercase;color:#8b96ad;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .lr-ib{width:34px;height:34px;border-radius:50%;border:0;background:rgba(255,255,255,.08);color:#e8ecf4;cursor:pointer;display:grid;place-items:center;font:500 15px/1 "Golos Text",sans-serif}
  .lr-ib:hover{background:rgba(255,255,255,.16)}
  .lr-body{flex:1;display:flex;flex-direction:column;padding:6% 7% 8%;gap:4%;min-height:0}
  .lr-cap{font:500 clamp(20px,3.4vh,30px)/1.15 "Unbounded","Golos Text",sans-serif;text-wrap:balance;min-height:2.4em;transition:opacity .35s,transform .35s}
  .lr-cap.in{opacity:0;transform:translateY(8px)}
  .lr-stage{position:relative;margin:0 -4%;border-radius:16px;background:rgba(11,16,25,.7);border:1px solid #26324a;padding:3%}
  .lr-stage svg{display:block;width:100%;height:auto}
  .lr-f{align-self:center;margin:auto 0;font:500 clamp(22px,3.8vh,34px)/1.2 "IBM Plex Mono",monospace;background:#e8ecf4;color:#0b1019;border-radius:14px;padding:12px 18px;text-align:center;box-shadow:0 12px 40px -10px rgba(255,181,71,.45);transition:opacity .35s,transform .35s}
  .lr-f.in{opacity:0;transform:scale(.92)}
  .lr-sub{margin-top:auto;font:600 clamp(17px,2.7vh,23px)/1.4 "Golos Text",sans-serif;color:rgba(232,236,244,.38)}
  .lr-sub span{transition:color .15s}
  .lr-sub span.on{color:#e8ecf4}
  .lr-zone{position:absolute;top:70px;bottom:0;z-index:2;cursor:pointer}
  .lr-zone.l{left:0;width:30%}.lr-zone.r{right:0;width:30%}.lr-zone.c{left:30%;right:30%}
  .lr-paused{position:absolute;inset:0;margin:auto;width:74px;height:74px;border-radius:50%;background:rgba(232,236,244,.92);color:#0b1019;display:grid;place-items:center;z-index:3;pointer-events:none}
  .lr-end{position:absolute;inset:0;z-index:4;display:flex;flex-direction:column;justify-content:flex-end;gap:10px;padding:0 7% 10%;background:linear-gradient(180deg,rgba(11,16,25,0) 30%,rgba(11,16,25,.94) 70%)}
  .lr-end b{font:500 22px/1.2 "Unbounded",sans-serif;margin-bottom:6px}
  .lr-end button{border:0;border-radius:12px;padding:14px;font:600 15px "Golos Text",sans-serif;cursor:pointer}
  .lr-end .go{background:#ffb547;color:#0b1019}
  .lr-end .again{background:rgba(255,255,255,.1);color:#e8ecf4}
  .lr-wrap :focus-visible{outline:2px solid #72d4e8;outline-offset:2px}
  @media (prefers-reduced-motion:reduce){.lr-cap,.lr-f{transition:none}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const ease = t => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  const lerpState = (a, b, k) => {
    const o = Object.assign({}, a || {}, b || {});
    for (const key in b || {}) if (a && typeof a[key] === 'number' && typeof b[key] === 'number') o[key] = a[key] + (b[key] - a[key]) * k;
    return o;
  };
  const words = s => s.split(/\s+/).filter(Boolean);
  const guess = s => Math.max(3, words(s).length * 0.42 + 0.6);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let cfg = null, durations = {};

  function totalOf(id) {
    return (cfg.scenes[id] || []).reduce((a, sc, i) => a + (durations[`${id}-${i}`] || guess(sc.say)) + 0.35, 0);
  }
  function coverHTML(id) {
    const sc = (cfg.scenes[id] || [])[0]; if (!sc) return '';
    const t = Math.round(totalOf(id));
    return `<button class="lr-cover" type="button" data-reel="${id}">
      <span class="lr-thumb"><svg viewBox="${cfg.viewBox}" aria-hidden="true">${cfg.draw(sc.to || sc.from || {}, 0)}</svg><i><svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 1.5v9l7.5-4.5z" fill="#0b1019"/></svg></i></span>
      <span><b>Смотреть объяснение</b><span>Ролик · ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')} · со звуком</span></span></button>`;
  }

  function open(id, opts = {}) {
    const scenes = cfg.scenes[id]; if (!scenes || !scenes.length) return;
    const wrap = document.createElement('div'); wrap.className = 'lr-wrap'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-label', 'Ролик-объяснение');
    wrap.innerHTML = `<div class="lr-card">
      <div class="lr-bars">${scenes.map(() => '<i><b></b></i>').join('')}</div>
      <div class="lr-top"><span class="lr-t">${esc(cfg.titleOf ? cfg.titleOf(id) : '')}</span>
        <button class="lr-ib" data-a="mute" aria-label="Выключить звук">🔊</button><button class="lr-ib" data-a="close" aria-label="Закрыть">✕</button></div>
      <div class="lr-body"><div class="lr-cap"></div><div class="lr-stage"><svg viewBox="${cfg.viewBox}" aria-hidden="true"></svg></div><div class="lr-f" hidden></div><div class="lr-sub" aria-live="polite"></div></div>
      <div class="lr-zone l" data-a="prev"></div><div class="lr-zone c" data-a="pause"></div><div class="lr-zone r" data-a="next"></div>
      <div class="lr-paused" hidden><svg width="26" height="26" viewBox="0 0 12 12"><path d="M3 1.5v9l7.5-4.5z" fill="#0b1019"/></svg></div>
      <div class="lr-end" hidden><b>Теперь попробуй сам</b><button class="go" data-a="close">Перейти к опыту</button><button class="again" data-a="again">Смотреть ещё раз</button></div></div>`;
    document.body.appendChild(wrap);
    const q = s => wrap.querySelector(s);
    const capEl = q('.lr-cap'), svg = q('.lr-stage svg'), fEl = q('.lr-f'), subEl = q('.lr-sub'), bars = [...wrap.querySelectorAll('.lr-bars b')];
    const audio = new Audio(); audio.preload = 'auto';
    let idx = -1, playing = true, muted = false, t0 = 0, acc = 0, dur = 1, raf = 0, ended = false, gap = 0;
    const next = new Audio(); next.preload = 'auto';

    function show(i) {
      idx = clamp(i, 0, scenes.length - 1); ended = false; q('.lr-end').hidden = true;
      const sc = scenes[idx];
      bars.forEach((b, k) => { b.style.width = k < idx ? '100%' : '0'; });
      capEl.textContent = sc.cap; capEl.classList.add('in'); requestAnimationFrame(() => capEl.classList.remove('in'));
      fEl.hidden = !sc.formula; if (sc.formula) { fEl.textContent = sc.formula; fEl.classList.add('in'); setTimeout(() => fEl.classList.remove('in'), 250); }
      subEl.innerHTML = words(sc.say).map(w => `<span>${esc(w)}</span> `).join('');
      dur = durations[`${id}-${idx}`] || guess(sc.say); acc = 0; t0 = performance.now();
      audio.src = cfg.base + `${id}-${idx}.mp3`; audio.muted = muted;
      if (playing) audio.play().catch(() => {});
      if (idx + 1 < scenes.length) next.src = cfg.base + `${id}-${idx + 1}.mp3`;
    }
    function progress() {
      if (audio.duration && isFinite(audio.duration) && !audio.error && audio.readyState > 1 && !muted) return clamp(audio.currentTime / audio.duration, 0, 1);
      return clamp((acc + (playing ? performance.now() - t0 : 0)) / 1000 / dur, 0, 1);
    }
    function frame() {
      raf = requestAnimationFrame(frame);
      const sc = scenes[idx], p = progress();
      const k = ease(clamp(p / 0.85, 0, 1));
      const stt = lerpState(sc.from || sc.to, sc.to || sc.from, k);
      if (cfg.viewBoxOf) svg.setAttribute('viewBox', cfg.viewBoxOf(stt));
      svg.innerHTML = cfg.draw(stt, idx, p);
      bars[idx].style.width = (p * 100).toFixed(1) + '%';
      const sp = subEl.children, n = Math.ceil(p * 1.08 * sp.length);
      for (let i = 0; i < sp.length; i++) sp[i].classList.toggle('on', i < n);
      const done = (audio.ended && !muted) || p >= 1;
      if (done && playing && !ended) {
        if (!gap) gap = performance.now();
        if (performance.now() - gap > 380) { gap = 0; if (idx < scenes.length - 1) show(idx + 1); else finish(); }
      }
    }
    function finish() { ended = true; playing = false; q('.lr-end').hidden = false; q('.lr-end .go').focus(); }
    function setPlaying(v) {
      if (ended) return;
      if (v === playing) return; playing = v; q('.lr-paused').hidden = v;
      if (v) { t0 = performance.now(); audio.play().catch(() => {}); } else { acc += performance.now() - t0; audio.pause(); }
    }
    function close() { cancelAnimationFrame(raf); audio.pause(); audio.src = ''; wrap.remove(); document.removeEventListener('keydown', key); if (opts.onClose) opts.onClose(); if (opts.returnFocus) opts.returnFocus.focus(); }
    function key(e) {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') show(idx + 1);
      else if (e.key === 'ArrowLeft') show(idx - 1);
      else if (e.key === ' ') { e.preventDefault(); setPlaying(!playing); }
    }
    wrap.addEventListener('click', e => {
      const a = (e.target.closest('[data-a]') || {}).dataset; const act = a && a.a;
      if (e.target === wrap) return close();
      if (act === 'close') close();
      else if (act === 'mute') { muted = !muted; audio.muted = muted; e.target.textContent = muted ? '🔇' : '🔊'; if (muted) { acc = audio.currentTime * 1000 || acc; t0 = performance.now(); } }
      else if (act === 'prev') { playing = true; q('.lr-paused').hidden = true; show(idx - 1); }
      else if (act === 'next') { playing = true; q('.lr-paused').hidden = true; if (idx < scenes.length - 1) show(idx + 1); else finish(); }
      else if (act === 'pause') setPlaying(!playing);
      else if (act === 'again') { playing = true; show(0); }
    });
    document.addEventListener('keydown', key);
    show(0); frame(); q('[data-a="close"]').focus();
  }
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  document.addEventListener('click', e => { const b = e.target.closest('[data-reel]'); if (b && cfg) open(b.dataset.reel, { returnFocus: b }); });
  window.LuchReel = {
    setup(c) { cfg = c; fetch(c.base + 'durations.json').then(r => r.ok ? r.json() : {}).then(j => { durations = j || {}; if (c.onReady) c.onReady(); }).catch(() => {}); },
    coverHTML, open,
  };
})();
