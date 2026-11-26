// Карта профессии: панель с видеолекцией и содержанием темы, отметки «Изучаю / Готово / Пропустить» (в этом браузере).
// Содержание тем уже есть на странице в разделе «Вся карта текстом» — панель показывает его копию.
// Видеолекция: разделы лекции (POST /api/tutor/story) — картинка с медленным наездом, голос (/api/tutor/tts), субтитры.
// Один файл на ru/kk/en: язык — <html lang>, подписи — window.PROF.ui; отметки прогресса общие для всех языков (ключ prof:<slug>).
(() => {
  const P = window.PROF; if (!P) return;
  const $ = (s) => document.querySelector(s);
  const KEY = "prof:" + P.slug;
  let S = {}; try { S = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { S = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* приватный режим — без сохранения */ } };
  const stageOf = (id) => P.stages.find((s) => s.t.includes(id));
  const LEC = P.lec || {};
  // язык страницы (/prof/ — ru, /kk/prof/ — kk, /en/prof/ — en); подписи — из window.PROF.ui (scripts/prof-build.js), по умолчанию русские
  const LANG = document.documentElement.lang || P.lang || "ru";
  const T = Object.assign({ stage: "Этап {n}", stageOf: "Этап {i} из {n}", more: "Подробнее: что выучить и как практиковаться", stageTopics: "Темы этапа",
    aDone: ", готово", aDoing: ", изучаю", aSkip: ", пропущено", aVideo: ", есть видеолекция", done: "Пройдено {d} из {n}", resetQ: "Сбросить все отметки на этой карте?",
    prevPart: "Предыдущая часть", nextPart: "Следующая часть", pause: "Пауза", play: "Смотреть", speed: "Скорость", mute: "Выключить звук", unmute: "Включить звук", volume: "Громкость", fs: "Во весь экран",
    video: "Видеолекция", parts: ["часть", "части", "частей"], min: "мин", err: "Лекция пока не готова. Загляни позже — текст темы ниже.", again: "Посмотреть ещё раз", dec: "," }, P.ui || {});
  const fmt = (k, o) => String(T[k]).replace(/\{(\w+)\}/g, (_, x) => o[x]);

  function paint() {
    document.querySelectorAll(".tp").forEach((b) => { const v = S[b.dataset.t]; b.classList.toggle("done", v === "done"); b.classList.toggle("doing", v === "doing"); b.classList.toggle("skip", v === "skip");
      b.setAttribute("aria-label", b.querySelector(".tt").textContent + (v === "done" ? T.aDone : v === "doing" ? T.aDoing : v === "skip" ? T.aSkip : "") + (b.querySelector(".pv") ? T.aVideo : "")); });
    const n = P.order.length, d = P.order.filter((id) => S[id] === "done" || S[id] === "skip").length;
    $("#pt").textContent = fmt("done", { d, n }); $("#pg").style.width = (100 * d / n) + "%"; $("#rst").hidden = !Object.keys(S).length;
    P.stages.forEach((s) => { const k = s.t.filter((id) => S[id] === "done" || S[id] === "skip").length, i = document.querySelector('.hub[data-g="' + s.id + '"] .hp i'); if (i) i.style.width = (100 * k / s.t.length) + "%"; });
  }

  // ---------- видеолекция ----------
  const box = $("#dwv");
  const storyCache = {};
  const fetchStory = (key, context) => storyCache[key] || (storyCache[key] = fetch("/api/tutor/story", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, lang: LANG, context }) })
    .then((r) => r.json().then((j) => { if (!r.ok || !j.sections) throw new Error(j.error || "story"); return j; })).catch((e) => { delete storyCache[key]; throw e; }));
  const imgUrl = (key, i) => "/api/tutor/story/img?k=" + encodeURIComponent(key + "|ru") + "&i=" + i;
  // картинки лекции общие для всех языков — всегда с ключом «|ru»
  // у разделов с формулами и у схемы опыта в лабораториях своей картинки нет — показываем предыдущую
  const imgOf = (V, i) => { for (let k = i; k >= 0; k--) { const x = V.secs && V.secs[k]; if (x && !x.formulas && !(x.scheme && V.key.startsWith("/labs/"))) return k; } return 0; };
  // субтитры: по предложению, длинные — делим по запятой/двоеточию/тире ближе к середине, чтобы строка не закрывала картинку
  const cut = (x) => { if (x.length <= 95) return [x]; const re = /[,:;—]\s/g, mid = x.length / 2; let best = -1, m;
    while ((m = re.exec(x))) if (m.index > 20 && x.length - m.index > 20 && (best < 0 || Math.abs(m.index - mid) < Math.abs(best - mid))) best = m.index;
    return best < 0 ? [x] : [...cut(x.slice(0, best + 1).trim()), ...cut(x.slice(best + 1).trim())]; };
  const sentences = (t) => { const a = String(t || "").split(/(?<=[.!?…])\s+/).filter(Boolean).flatMap(cut); let c = 0; return a.map((x) => { const r = { x, from: c }; c += x.length + 1; r.to = c; return r; }); };
  const KB = [[1.04, 1.16, -3, -2], [1.16, 1.04, 2, 1.5], [1.05, 1.17, 3, -2], [1.06, 1.16, -2, 2]]; // наезд: масштаб от → до, сдвиг по x/y в %
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let V = null;
  // скорость и громкость — как в уроках: по умолчанию 1,5×, выбор помним
  const RATES = [1, 1.25, 1.5, 1.75, 2];
  const pref = (k, d) => { try { const v = parseFloat(localStorage.getItem(k)); return isFinite(v) ? v : d; } catch (e) { return d; } };
  const keep = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) { /* приватный режим */ } };
  let RATE = pref("prof-rate", 1.5), VOL = pref("prof-vol", 1);
  const rateTxt = (r) => String(r).replace(".", T.dec) + "×";
  const applyAudio = (V) => { V.audio.defaultPlaybackRate = RATE; V.audio.playbackRate = RATE; V.audio.volume = VOL; V.audio.muted = V.muted || VOL === 0; };
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  function fsToggle(el) {
    if (fsEl() === el) return (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    if (el.classList.contains("full")) { el.classList.remove("full"); document.body.style.overflow = ""; return; }
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) Promise.resolve(req.call(el)).catch(() => { el.classList.add("full"); document.body.style.overflow = "hidden"; });
    else { el.classList.add("full"); document.body.style.overflow = "hidden"; } // iPhone: div во весь экран не разворачивается — растягиваем сами
  }

  function vpStop() {
    if (!V) return;
    V.run++; V.dead = true; cancelAnimationFrame(V.raf);
    try { V.audio.pause(); V.audio.removeAttribute("src"); V.audio.load(); } catch (e) { /* уже остановлен */ }
    V.urls.forEach((u) => URL.revokeObjectURL(u));
    if (fsEl() === V.el) try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) { /* уже */ }
    document.body.style.overflow = "";
    V = null; box.replaceChildren(); box.hidden = true;
  }
  function vpMount(node, key, context) {
    vpStop();
    const el = document.createElement("div"); el.className = "vp";
    el.innerHTML = '<div class="frs"></div><div class="stage-c" aria-hidden="true"></div><div class="bars"></div><div class="sub" aria-live="polite"></div>' +
      '<div class="ctl"><button type="button" class="b-prev" aria-label="' + T.prevPart + '">⏮</button><button type="button" class="b-play" aria-label="' + T.pause + '">❚❚</button><button type="button" class="b-next" aria-label="' + T.nextPart + '">⏭</button><span class="n"></span><span class="sp"></span><button type="button" class="b-rate" aria-label="' + T.speed + '">' + rateTxt(1.5) + '</button><span class="vol"><button type="button" class="b-mute" aria-label="' + T.mute + '">🔊</button><input type="range" class="vr" min="0" max="1" step="0.05" aria-label="' + T.volume + '"></span><button type="button" class="b-fs" aria-label="' + T.fs + '">⛶</button></div>' +
      '<button type="button" class="big"><i>▶</i><span>' + T.video + '</span></button>';
    box.replaceChildren(el); box.hidden = false;
    const audio = new Audio(); audio.preload = "auto";
    V = { node, key, context, el, audio, secs: null, i: 0, playing: false, started: false, run: 0, voice: {}, urls: [], fb: false, elapsed: 0, last: 0, est: 0, frame: null, kb: 0, subIdx: -1, muted: false };
    const my = V;
    el.querySelector(".frs").appendChild(frame(V, 0));
    fetchStory(key, context).then((j) => {
      if (my.dead) return; my.secs = j.sections;
      el.querySelector(".bars").innerHTML = my.secs.map(() => "<i><b></b></i>").join("");
      const words = my.secs.reduce((a, x) => a + String(x.text || "").split(/\s+/).length, 0), min = Math.max(1, Math.round(words / 130));
      el.querySelector(".big span").textContent = T.video + " · " + my.secs.length + " " + pl(my.secs.length, T.parts[0], T.parts[1], T.parts[2]) + " · ≈ " + min + " " + T.min;
      counter(my); new Image().src = imgUrl(key, imgOf(my, 1));
    }).catch(() => { if (my.dead) return; el.querySelector(".big").remove(); el.querySelector(".ctl").hidden = true; const e = document.createElement("div"); e.className = "err"; e.textContent = T.err; el.appendChild(e); });
    el.querySelector(".big").onclick = () => { if (!my.secs) return; my.playing = true; my.started = true; el.querySelector(".big").hidden = true; if (my.i >= my.secs.length) my.i = 0; show(my, my.i); loop(my); };
    el.querySelector(".stage-c").onclick = () => toggle(my);
    el.querySelector(".b-play").onclick = () => toggle(my);
    el.querySelector(".b-prev").onclick = () => { if (my.secs) show(my, Math.max(0, my.i - 1)); };
    el.querySelector(".b-next").onclick = () => { if (my.secs && my.i < my.secs.length - 1) show(my, my.i + 1); };
    { const rb = el.querySelector(".b-rate"), vr = el.querySelector(".vr"); rb.textContent = rateTxt(RATE); vr.value = VOL;
      rb.onclick = () => { RATE = RATES[(RATES.indexOf(RATE) + 1) % RATES.length] || 1.5; keep("prof-rate", RATE); rb.textContent = rateTxt(RATE); applyAudio(my); };
      vr.oninput = () => { VOL = +vr.value; keep("prof-vol", VOL); if (VOL > 0 && my.muted) { my.muted = false; } applyAudio(my); el.querySelector(".b-mute").textContent = VOL === 0 || my.muted ? "🔇" : "🔊"; };
      el.querySelector(".b-fs").onclick = () => fsToggle(el); }
    el.querySelector(".b-mute").onclick = (e) => { my.muted = !my.muted; audio.muted = my.muted; e.currentTarget.textContent = my.muted ? "🔇" : "🔊"; e.currentTarget.setAttribute("aria-label", my.muted ? T.unmute : T.mute); };
    audio.onended = () => { if (my.playing && !my.fb) next(my); };
    audio.onerror = () => { if (my.playing && !my.fb && audio.getAttribute("src")) fallback(my); };
  }
  const pl = (n, a, b, c) => { if (LANG !== "ru") return n === 1 ? a : b; const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; };
  function frame(V, i) {
    const f = document.createElement("div"); f.className = "fr";
    const im = new Image(); im.alt = ""; im.decoding = "async"; im.src = imgUrl(V.key, imgOf(V, i));
    im.onerror = () => { im.remove(); }; // без картинки остаётся фон-градиент
    f.appendChild(im); requestAnimationFrame(() => f.classList.add("on"));
    return f;
  }
  function counter(V) {
    const el = V.el; el.querySelector(".n").textContent = (V.secs ? Math.min(V.i + 1, V.secs.length) : 1) + "/" + (V.secs ? V.secs.length : "…");
    el.querySelector(".b-prev").disabled = !V.secs || V.i <= 0; el.querySelector(".b-next").disabled = !V.secs || V.i >= V.secs.length - 1;
    const b = el.querySelector(".b-play"); b.textContent = V.playing ? "❚❚" : "▶"; b.setAttribute("aria-label", V.playing ? T.pause : T.play);
    el.querySelectorAll(".bars b").forEach((x, k) => { if (k !== V.i) x.style.width = k < V.i ? "100%" : "0"; });
  }
  function voice(V, i) {
    if (!V.secs[i]) return Promise.resolve(null);
    return V.voice[i] || (V.voice[i] = fetch("/api/tutor/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: V.secs[i].text, hq: true, voice: "azure" }) })
      .then((r) => (r.ok ? r.blob() : null)).then((b) => { if (!b || V.dead) return null; const u = URL.createObjectURL(b); V.urls.push(u); return u; }).catch(() => null));
  }
  // показать раздел i; если идёт показ — сразу озвучить
  function show(V, i) {
    const run = ++V.run; V.i = i; V.fb = false; V.elapsed = 0; V.est = Math.max(2500, String(V.secs[i].text || "").length * 70 / RATE); V.subIdx = -1; V.kb = i % KB.length; V.loaded = false;
    try { V.audio.pause(); } catch (e) { /* ничего */ }
    const frs = V.el.querySelector(".frs"), old = [...frs.children];
    const f = frame(V, i); frs.appendChild(f); V.frame = f; // новый кадр поверх старого — плавная смена
    setTimeout(() => old.forEach((o) => o.remove()), 800);
    V.sents = sentences(V.secs[i].text); setSub(V, 0);
    counter(V);
    const nx = V.secs[i + 1]; if (nx) { new Image().src = imgUrl(V.key, imgOf(V, i + 1)); }
    if (V.playing) startAudio(V, run);
  }
  function startAudio(V, run) {
    V.el.querySelector(".sub").insertAdjacentHTML("afterend", '<div class="ld"></div>');
    voice(V, V.i).then((u) => {
      V.el.querySelectorAll(".ld").forEach((x) => x.remove());
      if (run !== V.run || V.dead) return;
      voice(V, V.i + 1); // следующий раздел — заранее
      if (!u) return fallback(V);
      V.audio.src = u; applyAudio(V); V.loaded = true;
      if (V.playing) V.audio.play().catch(() => fallback(V));
    });
  }
  function fallback(V) { V.fb = true; V.last = performance.now(); try { V.audio.pause(); } catch (e) { /* ничего */ } }
  function next(V) {
    if (V.i < V.secs.length - 1) return show(V, V.i + 1);
    // конец лекции
    V.playing = false; V.i = V.secs.length; counter(V);
    V.el.querySelectorAll(".bars b").forEach((x) => { x.style.width = "100%"; });
    const b = V.el.querySelector(".big"); b.classList.add("re"); b.querySelector("i").textContent = "↻"; b.querySelector("span").textContent = T.again; b.hidden = false;
    V.el.querySelector(".n").textContent = V.secs.length + "/" + V.secs.length;
  }
  function toggle(V) {
    if (!V.secs) return;
    if (!V.started || V.i >= V.secs.length) return V.el.querySelector(".big").click();
    V.playing = !V.playing;
    if (V.playing) { V.last = performance.now(); if (V.fb) { /* таймер продолжит в loop */ } else if (V.loaded && V.audio.getAttribute("src")) V.audio.play().catch(() => fallback(V)); else startAudio(V, V.run); }
    else { try { V.audio.pause(); } catch (e) { /* ничего */ } }
    counter(V);
  }
  function setSub(V, p) {
    const pos = p * (V.sents.length ? V.sents[V.sents.length - 1].to : 0);
    let k = V.sents.findIndex((s) => pos < s.to); if (k < 0) k = V.sents.length - 1;
    if (k === V.subIdx) return; V.subIdx = k;
    const sp = document.createElement("span"); sp.textContent = V.sents[k] ? V.sents[k].x : ""; V.el.querySelector(".sub").replaceChildren(sp);
  }
  function loop(V) {
    const tick = () => {
      if (V.dead) return;
      if (V.secs && V.i < V.secs.length) {
        let p = 0; const now = performance.now();
        if (V.fb) { if (V.playing) V.elapsed += now - V.last; V.last = now; p = Math.min(1, V.elapsed / V.est); }
        else if (V.loaded && V.audio.duration && isFinite(V.audio.duration)) p = Math.min(1, V.audio.currentTime / V.audio.duration);
        const bar = V.el.querySelectorAll(".bars b")[V.i]; if (bar) bar.style.width = (p * 100).toFixed(2) + "%";
        const im = V.frame && V.frame.querySelector("img");
        if (im && !reduceMotion) { const [s0, s1, x, y] = KB[V.kb]; im.style.transform = "scale(" + (s0 + (s1 - s0) * p).toFixed(4) + ") translate(" + (x * p).toFixed(3) + "%," + (y * p).toFixed(3) + "%)"; }
        setSub(V, p);
        if (V.fb && V.playing && p >= 1) next(V);
      }
      V.raf = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(V.raf); V.raf = requestAnimationFrame(tick);
  }

  // ---------- панель ----------
  const dw = $("#dw"); let cur = null, back = null;
  function open(kind, id) {
    const node = (kind === "t" ? "t-" : "g-") + id, same = !!cur && dw.classList.contains("on") && (cur.kind === "t" ? "t-" : "g-") + cur.id === node;
    cur = { kind, id }; back = back || document.activeElement;
    const src = document.getElementById(node); if (!src) return;
    const c = src.cloneNode(true); c.removeAttribute("id");
    let k = "", ctx = "";
    if (kind === "t") { const s = stageOf(id); k = fmt("stage", { n: P.stages.indexOf(s) + 1 }) + " · " + s.title; $("#dwh").textContent = c.querySelector("h4").textContent; c.querySelector("h4").remove();
      const w = c.querySelector("p"); ctx = "Тема карты навыков «" + P.slug.toUpperCase() + "»: " + $("#dwh").textContent + "\n" + (w ? w.textContent : "");
      // видео — главное, текст — вторым планом: «что выучить / практика / проверь себя» свёрнуты
      if (w && LEC[node]) { const more = document.createElement("details"); more.className = "more"; more.innerHTML = "<summary></summary>"; more.firstChild.textContent = T.more;
        let n = w.nextElementSibling; while (n) { const nn = n.nextElementSibling; more.appendChild(n); n = nn; } c.appendChild(more); } }
    else { const i = P.stages.findIndex((s) => s.id === id); k = fmt("stageOf", { i: i + 1, n: P.stages.length }); $("#dwh").textContent = P.stages[i].title; c.querySelector("h3").remove(); c.querySelectorAll("article").forEach((a) => a.remove());
      const w = c.querySelector(".why"); ctx = "Этап карты навыков: " + P.stages[i].title + "\n" + (w ? w.textContent : "");
      const ul = document.createElement("div"); ul.innerHTML = '<div class="lb">' + T.stageTopics + '</div>' + P.stages[i].t.map((t) => '<button type="button" class="tp' + (document.querySelector('.tp[data-t="' + t + '"]').classList.contains("x") ? " x" : "") + '" data-t="' + t + '" style="margin:6px 0;max-width:none">' + document.querySelector('.tp[data-t="' + t + '"]').innerHTML + "</button>").join(""); c.appendChild(ul); }
    $("#dwk").textContent = k; $("#dwb").replaceChildren(c);
    // видеолекция: при повторном открытии той же темы (смена статуса) плеер не трогаем
    if (!V || V.node !== node) { if (LEC[node]) vpMount(node, LEC[node], ctx); else vpStop(); }
    $("#dwst").hidden = kind !== "t";
    // «Научи меня»: ИИ-курс по теме (/prof/learn/ → /prof/course/)
    const tb = $("#dwteach");
    if (tb) { tb.hidden = kind !== "t"; if (kind === "t") tb.href = "/prof/learn/?roadmap=" + encodeURIComponent(P.slug) + "&topic=" + encodeURIComponent(id) + "&term=" + encodeURIComponent($("#dwh").textContent); }
    $("#dwst").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(kind === "t" && S[id] === b.dataset.v)));
    const seq = kind === "t" ? P.order : P.stages.map((s) => s.id), i = seq.indexOf(id);
    $("#dwp").disabled = i <= 0; $("#dwn").disabled = i >= seq.length - 1;
    dw.classList.add("on"); dw.setAttribute("aria-hidden", "false"); if (!same) dw.querySelector(".pn").scrollTop = 0; $("#dwx").focus({ preventScroll: true });
    paint();
    if (history.replaceState) history.replaceState(null, "", "#" + node);
  }
  function close() { vpStop(); dw.classList.remove("on"); dw.setAttribute("aria-hidden", "true"); cur = null; if (back && back.focus) back.focus({ preventScroll: true }); back = null; if (history.replaceState) history.replaceState(null, "", location.pathname); }
  function step(d) { if (!cur) return; const seq = cur.kind === "t" ? P.order : P.stages.map((s) => s.id), i = seq.indexOf(cur.id) + d; if (seq[i]) open(cur.kind, seq[i]); }

  document.addEventListener("click", (e) => {
    const t = e.target.closest(".tp");
    if (t) { if (e.shiftKey || e.altKey) { S[t.dataset.t] = S[t.dataset.t] === "done" ? undefined : "done"; if (!S[t.dataset.t]) delete S[t.dataset.t]; save(); paint(); return; } return open("t", t.dataset.t); }
    const h = e.target.closest(".hub"); if (h) return open("g", h.dataset.g);
    if (e.target === dw) close();
  });
  $("#dwx").onclick = close; $("#dwp").onclick = () => step(-1); $("#dwn").onclick = () => step(1);
  $("#dwst").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b || !cur || cur.kind !== "t") return;
    if (S[cur.id] === b.dataset.v) delete S[cur.id]; else S[cur.id] = b.dataset.v; save(); open("t", cur.id); });
  $("#rst").onclick = () => { if (confirm(T.resetQ)) { S = {}; save(); paint(); } };
  document.addEventListener("keydown", (e) => { if (!cur) return; if (e.key === "Escape") close(); else if (e.key === "ArrowRight") step(1); else if (e.key === "ArrowLeft") step(-1); });

  paint();
  // ссылка на тему: /prof/fde/#t-rag открывает её сразу
  const fromHash = () => { const m = /^#([tg])-([\w-]+)$/.exec(location.hash); if (m && document.getElementById(m[1] + "-" + m[2])) { const y = document.getElementById("map").offsetTop - 70; open(m[1], m[2]); requestAnimationFrame(() => scrollTo(0, y)); } };
  addEventListener("hashchange", fromHash); fromHash();
})();
