// Карта профессии: панель с содержанием темы и отметки «Изучаю / Готово / Пропустить» (в этом браузере).
// Содержание тем уже есть на странице в разделе «Вся карта текстом» — панель показывает его копию.
(() => {
  const P = window.PROF; if (!P) return;
  const $ = (s) => document.querySelector(s);
  const KEY = "prof:" + P.slug;
  let S = {}; try { S = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { S = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* приватный режим — без сохранения */ } };
  const stageOf = (id) => P.stages.find((s) => s.t.includes(id));

  function paint() {
    document.querySelectorAll(".tp").forEach((b) => { const v = S[b.dataset.t]; b.classList.toggle("done", v === "done"); b.classList.toggle("doing", v === "doing"); b.classList.toggle("skip", v === "skip");
      b.setAttribute("aria-label", b.querySelector(".tt").textContent + (v === "done" ? ", готово" : v === "doing" ? ", изучаю" : v === "skip" ? ", пропущено" : "")); });
    const n = P.order.length, d = P.order.filter((id) => S[id] === "done" || S[id] === "skip").length;
    $("#pt").textContent = "Пройдено " + d + " из " + n; $("#pg").style.width = (100 * d / n) + "%"; $("#rst").hidden = !Object.keys(S).length;
    P.stages.forEach((s) => { const k = s.t.filter((id) => S[id] === "done" || S[id] === "skip").length, i = document.querySelector('.hub[data-g="' + s.id + '"] .hp i'); if (i) i.style.width = (100 * k / s.t.length) + "%"; });
  }

  // панель
  const dw = $("#dw"); let cur = null, back = null;
  function open(kind, id) {
    cur = { kind, id }; back = back || document.activeElement;
    const src = document.getElementById((kind === "t" ? "t-" : "g-") + id); if (!src) return;
    const c = src.cloneNode(true); c.removeAttribute("id");
    let k = "";
    if (kind === "t") { const s = stageOf(id); k = "Этап " + (P.stages.indexOf(s) + 1) + " · " + s.title; $("#dwh").textContent = c.querySelector("h4").textContent; c.querySelector("h4").remove(); }
    else { const i = P.stages.findIndex((s) => s.id === id); k = "Этап " + (i + 1) + " из " + P.stages.length; $("#dwh").textContent = P.stages[i].title; c.querySelector("h3").remove(); c.querySelectorAll("article").forEach((a) => a.remove());
      const ul = document.createElement("div"); ul.innerHTML = '<div class="lb">Темы этапа</div>' + P.stages[i].t.map((t) => '<button type="button" class="tp' + (document.querySelector('.tp[data-t="' + t + '"]').classList.contains("x") ? " x" : "") + '" data-t="' + t + '" style="margin:6px 0;max-width:none">' + document.querySelector('.tp[data-t="' + t + '"]').innerHTML + "</button>").join(""); c.appendChild(ul); }
    $("#dwk").textContent = k; $("#dwb").replaceChildren(c);
    $("#dwst").hidden = kind !== "t";
    // «Научи меня»: ИИ-курс по теме (/prof/learn/ → /prof/course/)
    const tb = $("#dwteach");
    if (tb) { tb.hidden = kind !== "t"; if (kind === "t") tb.href = "/prof/learn/?roadmap=" + encodeURIComponent(P.slug) + "&topic=" + encodeURIComponent(id) + "&term=" + encodeURIComponent($("#dwh").textContent); }
    $("#dwst").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(kind === "t" && S[id] === b.dataset.v)));
    const seq = kind === "t" ? P.order : P.stages.map((s) => s.id), i = seq.indexOf(id);
    $("#dwp").disabled = i <= 0; $("#dwn").disabled = i >= seq.length - 1;
    dw.classList.add("on"); dw.setAttribute("aria-hidden", "false"); dw.querySelector(".pn").scrollTop = 0; $("#dwx").focus({ preventScroll: true });
    paint();
    if (history.replaceState) history.replaceState(null, "", "#" + (kind === "t" ? "t-" : "g-") + id);
  }
  function close() { dw.classList.remove("on"); dw.setAttribute("aria-hidden", "true"); cur = null; if (back && back.focus) back.focus({ preventScroll: true }); back = null; if (history.replaceState) history.replaceState(null, "", location.pathname); }
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
  $("#rst").onclick = () => { if (confirm("Сбросить все отметки на этой карте?")) { S = {}; save(); paint(); } };
  document.addEventListener("keydown", (e) => { if (!cur) return; if (e.key === "Escape") close(); else if (e.key === "ArrowRight") step(1); else if (e.key === "ArrowLeft") step(-1); });

  paint();
  // ссылка на тему: /prof/fde/#t-rag открывает её сразу
  const fromHash = () => { const m = /^#([tg])-([\w-]+)$/.exec(location.hash); if (m && document.getElementById(m[1] + "-" + m[2])) { const y = document.getElementById("map").offsetTop - 70; open(m[1], m[2]); requestAnimationFrame(() => scrollTo(0, y)); } };
  addEventListener("hashchange", fromHash); fromHash();
})();
