// «Научи меня»: поиск темы (/prof/learn/) и ИИ-курс (/prof/course/?c=<slug>[&m=&l=]).
// Сервер — scripts/prof-teach.js (/api/prof/course, /api/prof/lesson, /api/prof/quiz). Отметки — localStorage prof-course:<slug>.
(() => {
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* приватный режим */ } } };
  const pl = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; };
  async function api(p, body) {
    const r = await fetch(p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Не получилось. Попробуй ещё раз.");
    return j;
  }
  const remember = (C) => { const list = ls.get("prof-courses", []).filter((x) => x.slug !== C.slug); list.unshift({ slug: C.slug, title: C.title, n: C.modules.reduce((a, M) => a + M.lessons.length, 0) }); ls.set("prof-courses", list.slice(0, 12)); };
  const page = document.body.dataset.page;

  // ================= /prof/learn/ =================
  if (page === "learn") {
    const q = new URLSearchParams(location.search), term = (q.get("term") || "").trim(), rm = q.get("roadmap") || "", tp = q.get("topic") || "";
    const form = $("#tf"), inp = $("#tq");
    form.addEventListener("submit", (e) => { e.preventDefault(); const v = inp.value.trim(); if (v.length < 2) { inp.focus(); return; } location.href = "/prof/learn/?term=" + encodeURIComponent(v); });
    document.querySelectorAll(".ex-chips button").forEach((b) => b.addEventListener("click", () => { location.href = "/prof/learn/?term=" + encodeURIComponent(b.textContent.trim()); }));
    const rc = ls.get("prof-courses", []);
    if (rc.length) { $("#rcw").hidden = false; $("#rc").innerHTML = rc.map((c) => `<a href="/prof/course/?c=${encodeURIComponent(c.slug)}">${esc(c.title)}<small>${c.n} ${pl(c.n, "урок", "урока", "уроков")} · пройдено ${Object.keys((ls.get("prof-course:" + c.slug, {}).done) || {}).length}</small></a>`).join(""); }
    if (term || (rm && tp)) {
      inp.value = term; $("#home").hidden = true; const w = $("#wait"); w.hidden = false;
      $("#wt").textContent = "Составляю курс: «" + term + "»";
      const steps = [...w.querySelectorAll(".steps li")]; let i = 0;
      const tick = () => { steps.forEach((s, k) => { s.className = k < i ? "ok" : k === i ? "on" : ""; }); };
      tick(); const tmr = setInterval(() => { if (i < steps.length - 1) { i++; tick(); } }, 3500);
      api("/api/prof/course", { term, roadmap: rm, topic: tp }).then((C) => {
        clearInterval(tmr); i = steps.length; tick(); remember(C);
        location.replace("/prof/course/?c=" + encodeURIComponent(C.slug));
      }).catch((e) => { clearInterval(tmr); $("#wp").innerHTML = '<span class="err">' + esc(e.message) + '</span>'; steps.forEach((s) => { if (s.className === "on") s.className = ""; }); $("#wb").hidden = false; });
    }
    return;
  }
  if (page !== "course") return;

  // ================= /prof/course/ =================
  const app = $("#app"), side = $("#side"), main = $("#main");
  let C = null, S = null, cur = null, lessonMd = "", ctrl = null;
  const flat = () => C.modules.flatMap((M, m) => M.lessons.map((L, l) => ({ m, l, t: L.title })));
  const K = (m, l) => m + "." + l;
  const href = (m, l) => "/prof/course/?c=" + encodeURIComponent(C.slug) + (m == null ? "" : "&m=" + (m + 1) + "&l=" + (l + 1));
  const save = () => ls.set("prof-course:" + C.slug, S);
  const doneN = () => flat().filter((x) => S.done[K(x.m, x.l)]).length;

  // ---------- Markdown с особыми блоками ----------
  const renderer = new marked.Renderer();
  const txt = (x) => (x && typeof x === "object" ? (x.text != null ? x.text : x.raw || "") : x || "");
  renderer.html = (x) => esc(txt(x)); // сырой HTML от модели показываем как текст
  renderer.code = function (code, lang) {
    if (code && typeof code === "object") { lang = code.lang; code = code.text; }
    lang = String(lang || "").trim().split(/\s+/)[0].toLowerCase();
    if (lang === "flow" || lang === "mermaid") return `<div class="flow" data-src="${esc(code)}"><div class="fl">Рисую схему…</div></div>`;
    return `<pre${lang ? ` data-l="${esc(lang)}"` : ""}><code>${esc(code)}</code></pre>`;
  };
  const origLink = renderer.link.bind(renderer);
  renderer.link = function (href, title, text) {
    const h = href && typeof href === "object" ? href.href : href;
    if (!/^(https?:\/\/|\/|#)/i.test(String(h || ""))) return typeof href === "object" ? esc(href.text || "") : text;
    const out = origLink(href, title, text); return out.replace(/^<a /, '<a target="_blank" rel="noopener nofollow" ');
  };
  renderer.image = (x, t, alt) => esc(typeof x === "object" ? x.text || "" : alt || ""); // картинок в уроках нет
  const origTable = renderer.table.bind(renderer);
  renderer.table = function () { return '<div class="tw">' + origTable.apply(renderer, arguments) + "</div>"; };
  const md = (s) => marked.parse(String(s || ""), { renderer, gfm: true, breaks: false, async: false });

  function split(src) {
    const lines = String(src).replace(/\r/g, "").split("\n"), out = [], B = [];
    let fence = false, b = null;
    for (const line of lines) {
      if (b) {
        if (!b.fence && /^\s*:::\s*$/.test(line)) { B.push(b); out.push("", "@@B" + (B.length - 1) + "@@", ""); b = null; continue; }
        if (/^\s*(```|~~~)/.test(line)) b.fence = !b.fence;
        b.lines.push(line); continue;
      }
      if (/^\s*(```|~~~)/.test(line)) { fence = !fence; out.push(line); continue; }
      const m = !fence && /^\s*:::\s*(tip|pitfall|check|exercise|ask|note|warning)\b\s*(.*)$/i.exec(line);
      if (m) {
        // лишний заголовок прямо над блоком («## Совет», «## Проверка понимания») — у блока своя подпись
        let k = out.length - 1; while (k >= 0 && !out[k].trim()) k--;
        if (k >= 0 && /^#{2,4}s*(совет|советы|ловушка|ловушки|проверка понимания|проверь себя|проверь понимание)s*:?s*$/i.test(out[k].trim())) out.length = k;
        b = { type: m[1].toLowerCase(), lines: m[2] ? [m[2]] : [], fence: false }; continue;
      }
      out.push(line);
    }
    if (b) { b.open = true; B.push(b); out.push("", "@@B" + (B.length - 1) + "@@", ""); }
    return { src: out.join("\n"), B };
  }
  let exN = 0;
  function block(b, final) {
    const inner = b.lines.join("\n").trim();
    if (b.type === "tip" || b.type === "note") return `<aside class="co tip"><div class="coh">Совет</div>${md(inner)}</aside>`;
    if (b.type === "pitfall" || b.type === "warning") return `<aside class="co pitfall"><div class="coh">Ловушка</div>${md(inner)}</aside>`;
    if (b.type === "check") {
      let j = null; try { j = JSON.parse(inner.slice(inner.indexOf("{"), inner.lastIndexOf("}") + 1)); } catch (e) { /* ещё пишется */ }
      if (!j || !Array.isArray(j.options)) return b.open && !final ? `<div class="chk"><div class="h">Проверь себя</div><div class="fl">Готовлю вопрос…</div></div>` : "";
      return `<div class="chk" data-c="${Number(j.correct) | 0}" data-why="${esc(j.why || "")}"><div class="h">Проверь себя</div><div class="q">${esc(j.q)}</div><div class="opts">${j.options.map((o, i) => `<button type="button" data-o="${i}">${esc(o)}</button>`).join("")}</div><div class="fb" hidden></div></div>`;
    }
    if (b.type === "exercise") {
      exN++;
      const L = b.lines; let f = false, cut = -1;
      for (let i = 0; i < L.length; i++) { if (/^\s*(```|~~~)/.test(L[i])) f = !f; if (!f && /^\s*-{3,}\s*$/.test(L[i])) { cut = i; break; } }
      const qq = cut < 0 ? L.join("\n") : L.slice(0, cut).join("\n"), aa = cut < 0 ? "" : L.slice(cut + 1).join("\n");
      return `<div class="ex"><div class="h">Упражнение ${exN}</div>${md(qq)}${aa.trim() ? `<details><summary>Показать ответ</summary><div>${md(aa)}</div></details>` : ""}</div>`;
    }
    if (b.type === "ask") {
      const qs = b.lines.map((x) => x.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim()).filter(Boolean).slice(0, 6);
      return `<div class="ask"><div class="h">Сможешь ответить?</div>${qs.map((x) => `<div class="aq"><span>${esc(x)}</span><button type="button" data-ask="${esc(x)}">Спросить наставника →</button></div>`).join("")}</div>`;
    }
    return md(inner);
  }
  function render(src, final) {
    exN = 0;
    const { src: s, B } = split(src);
    let html = md(s);
    html = html.replace(/<p>@@B(\d+)@@<\/p>|@@B(\d+)@@/g, (_, a, c) => block(B[+(a || c)], final));
    return html;
  }

  // ---------- mermaid по требованию ----------
  let mmd = null;
  function mermaidLib() {
    if (!mmd) mmd = new Promise((ok, no) => {
      const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"; s.onload = () => {
        window.mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "strict", fontFamily: "Golos Text, system-ui, sans-serif",
          themeVariables: { background: "#121a28", primaryColor: "#1a2438", primaryBorderColor: "#ffb547", primaryTextColor: "#e8ecf4", lineColor: "#8b96ad", secondaryColor: "#1a2438", tertiaryColor: "#121a28", edgeLabelBackground: "#121a28", fontSize: "15px" },
          flowchart: { htmlLabels: false, curve: "basis", useMaxWidth: true } });
        ok(window.mermaid);
      }; s.onerror = () => no(new Error("mermaid")); document.head.appendChild(s);
    });
    return mmd;
  }
  let mmN = 0;
  async function drawFlows(root) {
    const els = [...root.querySelectorAll(".flow[data-src]")]; if (!els.length) return;
    let M; try { M = await mermaidLib(); } catch (e) { els.forEach((el) => { el.innerHTML = `<pre>${esc(el.dataset.src)}</pre>`; }); return; }
    for (const el of els) {
      const src = el.dataset.src.replace(/^\s*flowchart\s+(LR|RL)\b/, "flowchart TD"), id = "mmd" + ++mmN;
      try { const r = await M.render(id, src); el.innerHTML = r.svg; el.removeAttribute("data-src"); }
      catch (e) { el.innerHTML = `<div class="fl">Схема (текстом):</div><pre>${esc(el.dataset.src)}</pre>`; const junk = document.getElementById("d" + id); if (junk) junk.remove(); }
    }
  }

  // ---------- наставник ----------
  const askTutor = (q) => { if (window.LuchTutor && window.LuchTutor.ask) window.LuchTutor.ask(q); else alert("Наставник ещё загружается — попробуй через пару секунд."); };
  const plain = (s) => String(s || "").replace(/:::\s*check[\s\S]*?:::/g, "").replace(/```flow[\s\S]*?```/g, "[схема]").replace(/:::\s*\w*/g, "").replace(/[#*`|>]/g, " ").replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();
  window.LUCH_CONTEXT = () => {
    if (!C) return "";
    const head = `Раздел: Профессии, ИИ-курс «${C.title}» — ${C.subtitle}. Курс составлен ИИ по запросу ученика «${C.term}»${C.roadmapTitle ? `, тема «${C.topicTitle}» из карты профессии ${C.roadmapTitle}` : ""}. Сквозной пример курса: ${C.example}. Пройдено уроков: ${doneN()} из ${flat().length}.`;
    if (!cur) return [head, "Ученик на странице с программой курса:", C.modules.map((M, i) => `Модуль ${i + 1}. ${M.title}: ` + M.lessons.map((L) => L.title).join("; ")).join("\n"),
      "Для наставника: помоги понять, с чего начать и что даст курс; отвечай просто, на «ты»."].join("\n");
    const n = flat().findIndex((x) => x.m === cur.m && x.l === cur.l);
    return [head, `Сейчас открыт урок ${n + 1} из ${flat().length}: «${C.modules[cur.m].lessons[cur.l].title}» (модуль ${cur.m + 1} «${C.modules[cur.m].title}»).`,
      "Текст урока (сокращён): " + plain(lessonMd).slice(0, 2600),
      "Для наставника: объясняй на примерах из этого урока и сквозного примера курса, просто и на «ты». Если ученик спрашивает про упражнение урока — сначала подсказка, а не готовый ответ."].join("\n");
  };
  window.LUCH_SUGGEST = () => {
    if (!C) return [];
    if (!cur) return ["С чего начать этот курс?", "Что мне нужно знать заранее?", "Как этот навык пригодится в работе?"];
    const asks = [...document.querySelectorAll(".ask [data-ask]")].map((b) => b.dataset.ask);
    return ["Объясни главное в этом уроке проще", ...asks.slice(0, 2)];
  };

  // ---------- оглавление ----------
  function paintSide() {
    const n = flat().length, d = doneN();
    side.innerHTML = `<a class="ct" href="${href()}">${esc(C.title)}</a><div class="pg"><i style="width:${(100 * d) / n}%"></i></div><div class="pt">Пройдено ${d} из ${n}</div>` +
      C.modules.map((M, m) => { const k = M.lessons.filter((_, l) => S.done[K(m, l)]).length;
        return `<details${!cur || cur.m === m || M.lessons.length * C.modules.length <= 12 ? " open" : ""}><summary>${m + 1}. ${esc(M.title)}<small>${k}/${M.lessons.length}</small></summary><ol>` +
          M.lessons.map((L, l) => `<li><a href="${href(m, l)}" data-m="${m}" data-l="${l}" class="${S.done[K(m, l)] ? "done" : ""}"${cur && cur.m === m && cur.l === l ? ' aria-current="page"' : ""}><span class="dot"></span><span>${esc(L.title)}</span></a></li>`).join("") + "</ol></details>"; }).join("");
    $("#tocn").textContent = d + " из " + n;
  }
  $("#tocb").addEventListener("click", () => { side.classList.toggle("on"); $("#tocb").setAttribute("aria-expanded", String(side.classList.contains("on"))); });

  // ---------- программа курса ----------
  function overview() {
    cur = null; document.title = C.title + " — ИИ-курс | Open School AI";
    const n = flat().length, d = doneN(), nx = flat().find((x) => !S.done[K(x.m, x.l)]) || flat()[0];
    main.innerHTML = `<div class="kick"><a href="/prof/learn/">Научи меня</a> · ИИ-курс${C.category ? " · " + esc(C.category) : ""}</div>
<h1>${esc(C.title)}</h1><p class="sub">${esc(C.subtitle)}</p>
<div class="ov"><div>
<a class="btn" href="${href(nx.m, nx.l)}" data-go="${nx.m}.${nx.l}">${d ? "▶ Продолжить: " + esc(nx.t) : "▶ Начать курс"}</a>
<h2>О курсе</h2><p class="about">${esc(C.about)}</p>
${C.example ? `<h2>Сквозной пример</h2><div class="exm">${esc(C.example)}</div>` : ""}
<h2>Чему научишься</h2><ul class="cov">${C.covers.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
<h2>Программа</h2><div class="mods">${C.modules.map((M, m) => `<div class="mod"><h3>${m + 1}. ${esc(M.title)}<small>${M.lessons.filter((_, l) => S.done[K(m, l)]).length}/${M.lessons.length}</small></h3>${M.goal ? `<p>${esc(M.goal)}</p>` : ""}<ol>${M.lessons.map((L, l) => `<li><a href="${href(m, l)}" data-go="${m}.${l}"><span class="dot${S.done[K(m, l)] ? " done" : ""}"></span>${esc(L.title)}</a></li>`).join("")}</ol></div>`).join("")}</div>
</div>
<aside class="card2"><div class="big">${d} из ${n} ${pl(n, "урока", "уроков", "уроков")} пройдено</div><div class="pg"><i style="width:${(100 * d) / n}%"></i></div>
<dl>${C.category ? `<div><dt>Область</dt><dd>${esc(C.category)}</dd></div>` : ""}<div><dt>Сложность</dt><dd>${esc(C.difficulty)}</dd></div>
${C.prereq && C.prereq.length ? `<div><dt>Желательно знать</dt><dd class="pchips">${C.prereq.map((x) => `<span>${esc(x)}</span>`).join("")}</dd></div>` : ""}
<div><dt>Объём</dt><dd>${C.modules.length} ${pl(C.modules.length, "модуль", "модуля", "модулей")} · ${n} ${pl(n, "урок", "урока", "уроков")}</dd></div>
${C.roadmap ? `<div><dt>Карта профессии</dt><dd><a href="/prof/${esc(C.roadmap)}/#t-${esc(C.topic)}">${esc(C.topicTitle)} · ${esc(C.roadmapTitle)}</a></dd></div>` : ""}</dl>
<p style="margin:14px 0 0;color:var(--m);font-size:13px">Курс составил ИИ по твоему запросу. Уроки пишутся при первом открытии и сохраняются.</p></aside></div>`;
    paintSide();
  }

  // ---------- урок ----------
  function stagesHtml() {
    return `<ul class="steps"><li class="ok"><i></i><span>Читаю программу курса</span></li><li id="s-plan"><i></i><div style="flex:1;min-width:0"><span>Планирую урок</span><div class="think" id="think" hidden></div></div></li><li id="s-write"><i></i><span>Пишу урок</span></li></ul>`;
  }
  function lesson(m, l) {
    if (ctrl) ctrl.abort();
    cur = { m, l }; S.last = K(m, l); save();
    const F = flat(), n = F.findIndex((x) => x.m === m && x.l === l), L = C.modules[m].lessons[l], nx = F[n + 1];
    document.title = L.title + " — " + C.title + " | Open School AI";
    main.innerHTML = `<article class="lsn"><div class="kick">Модуль ${m + 1} · урок ${n + 1} из ${F.length}</div><h1>${esc(L.title)}</h1>
<div class="stg" id="stg">${stagesHtml()}</div><div class="lb2" id="lb"></div>
<div id="after" hidden><div class="acts"><button type="button" class="btn" id="bdone"></button><button type="button" class="btn g" id="bquiz">Проверь меня: 5 вопросов</button><button type="button" class="btn g" id="bask">Спросить наставника</button></div>
${nx ? `<a class="next" href="${href(nx.m, nx.l)}" data-go="${nx.m}.${nx.l}"><div><small>Дальше · урок ${n + 2} из ${F.length}</small><b>${esc(nx.t)}</b></div><span class="btn">Продолжить →</span></a>` : `<a class="next" href="${href()}" data-go="ov"><div><small>Это последний урок</small><b>Вернуться к программе курса</b></div><span class="btn">К курсу →</span></a>`}
<div class="help" id="help">Был ли урок полезен? <button type="button" data-h="1">Да</button><button type="button" data-h="0">Не очень</button></div></div></article>`;
    paintSide(); side.classList.remove("on"); scrollTo(0, 0);
    const lb = $("#lb"), stg = $("#stg"), think = $("#think");
    const st = (id, cls) => { const e = $("#" + id); if (e) e.className = cls; };
    lessonMd = ""; let plan = "", t = 0, cached = false;
    const paint = (final) => { lb.innerHTML = render(lessonMd, final); if (!final) lb.classList.add("cursor"); };
    const sched = () => { if (!t) t = setTimeout(() => { t = 0; paint(false); }, 180); };
    const fin = async () => {
      clearTimeout(t); t = 0; lb.classList.remove("cursor"); stg.hidden = true; paint(true); $("#after").hidden = false; paintDone();
      const h = (S.fb || {})[K(m, l)]; if (h != null) $("#help").textContent = "Спасибо за отзыв!";
      await drawFlows(lb);
    };
    const fail = (msg) => { clearTimeout(t); lb.classList.remove("cursor"); stg.innerHTML = `<p class="err" style="margin:0 0 10px">${esc(msg)}</p><button type="button" class="btn g" id="retry">Попробовать ещё раз</button>`; $("#retry").onclick = () => lesson(m, l); };
    st("s-plan", "on");
    ctrl = new AbortController(); const my = ctrl;
    (async () => {
      const r = await fetch("/api/prof/lesson", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: C.slug, m, l }), signal: my.signal });
      if (!r.ok || !r.body) { const j = await r.json().catch(() => ({})); throw new Error(j.error || "Не получилось открыть урок."); }
      const rd = r.body.getReader(), dec = new TextDecoder(); let buf = "", done = false, err = null;
      while (true) {
        const { value, done: end } = await rd.read(); if (end) break;
        buf += dec.decode(value, { stream: true }); let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i); buf = buf.slice(i + 1); if (!line.trim()) continue;
          let o; try { o = JSON.parse(line); } catch (e) { continue; }
          if (o.cached) { cached = true; stg.hidden = true; }
          if (o.stage === "plan") st("s-plan", "on");
          if (o.stage === "wait") { st("s-plan", "ok"); st("s-write", "on"); }
          if (o.planReset) plan = "";
          if (o.plan) { plan += o.plan; think.hidden = false; think.textContent = plan; think.scrollTop = think.scrollHeight; }
          if (o.stage === "write") { st("s-plan", "ok"); st("s-write", "on"); }
          if (o.reset) lessonMd = "";
          if (o.d) { lessonMd += o.d; if (!cached) sched(); }
          if (o.error) err = o.error;
          if (o.done) done = true;
        }
      }
      if (my !== ctrl) return;
      if (err || !done || !lessonMd.trim()) throw new Error(err || "Урок не дописался. Попробуй ещё раз.");
      await fin();
    })().catch((e) => { if (e.name !== "AbortError" && my === ctrl) fail(e.message); });
  }
  function paintDone() {
    const b = $("#bdone"); if (!b || !cur) return; const d = !!S.done[K(cur.m, cur.l)];
    b.textContent = d ? "✓ Урок пройден" : "Отметить пройденным"; b.className = d ? "btn g" : "btn";
  }

  // ---------- тест ----------
  async function quiz() {
    const { m, l } = cur, box = document.createElement("div"); box.className = "qz";
    box.innerHTML = `<div class="pn" role="dialog" aria-modal="true" aria-label="Тест по уроку"><div class="top"><small id="qk">Тест по уроку</small><button type="button" class="cl" aria-label="Закрыть">✕</button></div><div id="qb"><ul class="steps"><li class="on"><i></i><span>Составляю вопросы по уроку…</span></li></ul></div></div>`;
    app.appendChild(box);
    const close = () => { box.remove(); document.removeEventListener("keydown", onKey); }, onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey); box.querySelector(".cl").onclick = close; box.addEventListener("click", (e) => { if (e.target === box) close(); });
    let Q; try { Q = (await api("/api/prof/quiz", { slug: C.slug, m, l })).questions; } catch (e) { $("#qb", box).innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    let i = 0, score = 0;
    const show = () => {
      if (i >= Q.length) {
        const good = score >= Q.length - 1;
        if (good && !S.done[K(m, l)]) { S.done[K(m, l)] = 1; save(); paintSide(); paintDone(); }
        $("#qk", box).textContent = "Результат";
        $("#qb", box).innerHTML = `<h3>${score} из ${Q.length} верно</h3><p>${good ? "Отлично! Урок отмечен как пройденный." : "Перечитай разделы, где ошибся, и попробуй ещё раз — или спроси наставника."}</p><div class="row"><button type="button" class="btn g" id="qr">Пройти ещё раз</button><button type="button" class="btn" id="qc">Закрыть</button></div>`;
        $("#qr", box).onclick = () => { i = 0; score = 0; show(); }; $("#qc", box).onclick = close; return;
      }
      const q = Q[i]; $("#qk", box).textContent = "Вопрос " + (i + 1) + " из " + Q.length;
      $("#qb", box).innerHTML = `<h3>${esc(q.q)}</h3><div class="opts">${q.options.map((o, k) => `<button type="button" data-o="${k}">${esc(o)}</button>`).join("")}</div><div class="fb" hidden></div><div class="row"><button type="button" class="btn" id="qn" hidden>${i + 1 < Q.length ? "Следующий вопрос →" : "Результат"}</button></div>`;
      $(".opts", box).addEventListener("click", (e) => {
        const b = e.target.closest("button[data-o]"); if (!b || b.disabled) return; const k = +b.dataset.o, ok = k === q.correct; if (ok) score++;
        box.querySelectorAll(".opts button").forEach((x) => { x.disabled = true; if (+x.dataset.o === q.correct) x.classList.add("ok"); });
        if (!ok) b.classList.add("bad");
        const fb = $(".fb", box); fb.hidden = false; fb.innerHTML = `<b class="${ok ? "y" : "n"}">${ok ? "Верно." : "Не совсем."}</b> ${esc(q.why)}`;
        const nb = $("#qn", box); nb.hidden = false; nb.focus(); nb.onclick = () => { i++; show(); };
      });
    };
    show();
  }

  // ---------- клики ----------
  app.addEventListener("click", (e) => {
    const go = e.target.closest("[data-go], .side a[data-m], .side a.ct");
    if (go && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault(); const a = go.getAttribute("href"); history.pushState(null, "", a); route(); return;
    }
    const o = e.target.closest(".chk .opts button"); if (o && !o.disabled) {
      const box = o.closest(".chk"), c = +box.dataset.c, k = +o.dataset.o;
      box.querySelectorAll(".opts button").forEach((x) => { x.disabled = true; if (+x.dataset.o === c) x.classList.add("ok"); });
      if (k !== c) o.classList.add("bad");
      const fb = box.querySelector(".fb"); fb.hidden = false; fb.innerHTML = `<b class="${k === c ? "y" : "n"}">${k === c ? "Верно!" : "Не совсем."}</b> ${esc(box.dataset.why)}`; return;
    }
    const a = e.target.closest("[data-ask]"); if (a) return askTutor(a.dataset.ask);
    if (e.target.closest("#bdone")) { const k = K(cur.m, cur.l); if (S.done[k]) delete S.done[k]; else S.done[k] = 1; save(); paintDone(); paintSide(); return; }
    if (e.target.closest("#bquiz")) return quiz();
    if (e.target.closest("#bask")) return askTutor("Объясни главное в уроке «" + C.modules[cur.m].lessons[cur.l].title + "» проще, на примере");
    const h = e.target.closest("#help button"); if (h) { S.fb = S.fb || {}; S.fb[K(cur.m, cur.l)] = +h.dataset.h; save(); $("#help").textContent = "Спасибо за отзыв!"; }
  });
  function route() {
    const q = new URLSearchParams(location.search), m = +q.get("m") - 1, l = +q.get("l") - 1;
    if (m >= 0 && l >= 0 && C.modules[m] && C.modules[m].lessons[l]) lesson(m, l); else { if (ctrl) ctrl.abort(); overview(); scrollTo(0, 0); }
  }
  addEventListener("popstate", () => C && route());

  const slug = new URLSearchParams(location.search).get("c");
  if (!slug) { location.replace("/prof/learn/"); return; }
  api("/api/prof/course", { slug }).then((c) => {
    C = c; S = ls.get("prof-course:" + C.slug, {}) || {}; S.done = S.done || {}; remember(C); app.hidden = false; $("#load").hidden = true; route();
  }).catch((e) => { $("#load").innerHTML = `<p class="err">${esc(e.message)}</p><a class="btn g" href="/prof/learn/">Составить новый курс</a>`; });
})();
