// Раздел «Профессии» Open School: атлас профессий и карта навыков каждой профессии.
// Данные — prof/data/<slug>.js, результат — статичный HTML (всё содержимое в разметке — для поисковиков и ИИ),
// интерактив (панель темы, отметки прогресса) — prof/roadmap.js.
//   node scripts/prof-build.js   → prof/index.html, prof/<slug>/index.html
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "prof");
const SITE = "https://openschool.work";
const LIVE = ["fde"];
// профессии в планах — карточки в атласе
const SOON = [
  ["AI-инженер", "Строит продукты на языковых моделях: агенты, поиск по знаниям, оценка качества."],
  ["Инженер данных", "Собирает данные компании в надёжные пайплайны и хранилища."],
  ["Продакт-менеджер ИИ-продуктов", "Решает, что делать с ИИ в продукте и как измерить пользу."],
  ["Платформенный инженер (DevOps)", "Делает так, чтобы код сам проверялся, выкатывался и не падал."],
  ["Инженер по безопасности ИИ", "Защищает ИИ-системы от атак, утечек и злоупотреблений."],
];

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pl = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; };
// логотип — тот же, что на главной школы
const OWL = (fs.readFileSync(path.join(__dirname, "..", "physics", "index.html"), "utf8").match(/<a class="brand" href="\/">\s*(<svg[\s\S]*?<\/svg>)/) || [, ""])[1];

const CSS = `:root{--bg:#0b1019;--s:#121a28;--s2:#1a2438;--l:#26324a;--fg:#e8ecf4;--m:#8b96ad;--a:#ffb547;--ok:#86e0a8;--doing:#a99cff;--fd:"Unbounded","Golos Text",system-ui,sans-serif;--fb:"Golos Text",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--fm:"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace;color-scheme:dark}
*{box-sizing:border-box}[hidden]{display:none!important}html{-webkit-text-size-adjust:100%}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 var(--fb)}
a{color:var(--a)}button{font:inherit;color:inherit}:focus-visible{outline:2px solid #72d4e8;outline-offset:2px}
.wrap{max-width:1240px;margin:0 auto;padding:14px max(16px,env(safe-area-inset-left,0px)) 40px max(16px,env(safe-area-inset-right,0px))}
header{display:flex;align-items:center;justify-content:space-between;gap:12px 20px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:12px;text-decoration:none;color:var(--fg)}.brand svg{width:40px;height:40px}.brand b{font:700 20px/1 var(--fd);letter-spacing:.16em}
.brand small{display:block;font:500 11px/1 var(--fm);color:var(--m);letter-spacing:.14em;text-transform:uppercase;margin-top:7px}
.sections{display:flex;gap:4px;background:var(--s);border:1px solid var(--l);border-radius:11px;padding:4px}
.sections a{color:var(--m);text-decoration:none;font:600 11.5px/1 var(--fb);letter-spacing:.11em;text-transform:uppercase;padding:9px 12px;border-radius:7px}.sections a:hover{color:var(--fg)}.sections a[aria-current=page]{background:var(--s2);color:var(--fg)}
.kick{font:500 11.5px/1 var(--fm);letter-spacing:.14em;text-transform:uppercase;color:var(--a);margin:34px 0 12px}
h1{font:700 clamp(28px,5vw,50px)/1.08 var(--fd);margin:0 0 10px;letter-spacing:-.01em;text-wrap:balance}
.sub{font-size:18px;color:var(--m);margin:0 0 16px}.lead{font-size:17px;max-width:68ch;margin:0 0 18px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 22px}.chips span{border:1px solid var(--l);background:var(--s);border-radius:999px;padding:6px 12px;font-size:13.5px}
.stats{display:flex;flex-wrap:wrap;gap:10px 28px;margin:0 0 20px}.stats div{font-size:13px;color:var(--m)}.stats b{display:block;font:600 22px/1.2 var(--fd);color:var(--fg)}
.bar{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:14px 16px;background:var(--s);border:1px solid var(--l);border-radius:14px;margin:0 0 8px;position:sticky;top:8px;z-index:5}
.bar .pg{flex:1;min-width:160px;height:8px;border-radius:9px;background:var(--s2);overflow:hidden}.bar .pg i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--ok),#c7f0d6);transition:width .3s}
.bar .pt{font:600 14px/1 var(--fb);white-space:nowrap}.bar .rst{background:none;border:0;color:var(--m);font-size:13px;cursor:pointer;text-decoration:underline}
.legend{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:13px;color:var(--m);margin:12px 0 0}.legend i{display:inline-block;width:14px;height:14px;border-radius:4px;vertical-align:-2px;margin-right:6px;border:1.5px solid var(--a)}
.legend .x i{border:1.5px dashed var(--m)}.legend .dg i{background:var(--doing);border-color:var(--doing)}.legend .dn i{background:var(--ok);border-color:var(--ok)}
/* карта: ствол по центру, этапы — узлы на стволе, темы — по бокам */
.map{position:relative;margin:30px 0 10px;padding:10px 0 30px}
.map::before{content:"";position:absolute;left:50%;top:0;bottom:0;width:3px;margin-left:-1.5px;background:#ffb547aa;border-radius:3px}
.stage{display:grid;grid-template-columns:1fr minmax(240px,300px) 1fr;column-gap:58px;align-items:center;padding:22px 0;position:relative}
.hub{grid-column:2;position:relative;z-index:1;text-align:left;background:var(--a);color:#1b1305;border:0;border-radius:14px;padding:14px 16px;cursor:pointer;box-shadow:0 0 0 6px var(--bg)}
.hub:hover{filter:brightness(1.06)}.hub small{display:block;font:600 11px/1 var(--fm);letter-spacing:.14em;text-transform:uppercase;opacity:.7;margin-bottom:6px}.hub b{font:700 16px/1.25 var(--fd)}
.hub .hp{display:block;margin-top:8px;height:5px;border-radius:5px;background:#0000001f;overflow:hidden}.hub .hp i{display:block;height:100%;width:0;background:#1b1305;transition:width .3s}
.col{display:flex;flex-direction:column;gap:9px}.col.l{grid-column:1;grid-row:1;align-items:flex-end}.col.r{grid-column:3;grid-row:1;align-items:flex-start}
.tp{position:relative;display:flex;align-items:center;gap:9px;width:100%;max-width:330px;text-align:left;background:var(--s);border:1.5px solid #ffb54799;border-radius:11px;padding:10px 12px;cursor:pointer;font-size:14.5px;font-weight:500;transition:border-color .15s,background .15s}
.tp:hover{border-color:var(--a);background:var(--s2)}.tp.x{border-style:dashed;border-color:#8b96ad88;font-weight:400}
.tp .tt{flex:1}.tp .hh{font:500 11.5px/1 var(--fm);color:var(--m)}
.tp .ck{flex:none;width:18px;height:18px;border-radius:5px;border:1.5px solid var(--l);display:grid;place-items:center;font-size:12px;line-height:1;color:var(--bg)}
.tp.doing{border-color:var(--doing)}.tp.doing .ck{background:var(--doing);border-color:var(--doing)}.tp.doing .ck::after{content:"…"}
.tp.done{border-color:var(--ok);background:#86e0a812}.tp.done .tt{color:var(--m);text-decoration:line-through;text-decoration-color:#86e0a8aa}.tp.done .ck{background:var(--ok);border-color:var(--ok)}.tp.done .ck::after{content:"✓"}
.tp.skip{opacity:.45}.tp.skip .ck::after{content:"–";color:var(--m)}
.col.l .tp::after,.col.r .tp::after{content:"";position:absolute;top:50%;width:58px;border-top:1.5px dashed #ffb54766}.col.l .tp::after{left:100%}.col.r .tp::after{right:100%}
.end{position:relative;z-index:1;width:max-content;margin:12px auto 0;background:var(--s);border:1.5px solid var(--ok);color:var(--ok);border-radius:999px;padding:10px 18px;font:600 14px/1 var(--fb);box-shadow:0 0 0 6px var(--bg)}
@media (max-width:900px){
 .map::before{left:15px}
 .stage{grid-template-columns:1fr;row-gap:8px;padding:16px 0 16px 38px}
 .hub,.col.l,.col.r{grid-column:1;grid-row:auto}.col.l,.col.r{align-items:stretch}
 .tp{max-width:none}.col.l .tp::after,.col.r .tp::after{left:auto;right:100%;width:22px}
 .hub::before{content:"";position:absolute;left:-29px;top:50%;width:12px;height:12px;margin-top:-6px;border-radius:50%;background:var(--a);box-shadow:0 0 0 4px var(--bg)}
 .end{margin-left:0}
}
/* панель темы */
.dw{position:fixed;inset:0;z-index:50;display:flex;justify-content:flex-end;background:#05080dcc;opacity:0;pointer-events:none;transition:opacity .2s}
.dw.on{opacity:1;pointer-events:auto}
.dw .pn{width:min(520px,100%);height:100%;overflow:auto;background:var(--s);border-left:1px solid var(--l);padding:20px 22px 40px;transform:translateX(30px);transition:transform .2s}.dw.on .pn{transform:none}
.dw .top{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px}.dw .top small{font:500 11.5px/1.3 var(--fm);color:var(--m);letter-spacing:.08em;text-transform:uppercase}
.dw .cl{background:var(--s2);border:1px solid var(--l);border-radius:9px;width:36px;height:36px;cursor:pointer;flex:none}
.dw h2{font:700 24px/1.2 var(--fd);margin:4px 0 12px}
.st{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 16px}.st button{border:1px solid var(--l);background:var(--s2);border-radius:9px;padding:8px 12px;cursor:pointer;font-size:13.5px;color:var(--m)}
.st button[aria-pressed=true]{color:var(--bg);font-weight:600}.st .b-doing[aria-pressed=true]{background:var(--doing);border-color:var(--doing)}.st .b-done[aria-pressed=true]{background:var(--ok);border-color:var(--ok)}.st .b-skip[aria-pressed=true]{background:var(--m);border-color:var(--m)}
.dw .nv{display:flex;gap:8px;margin-top:24px}.dw .nv button{flex:1;background:var(--s2);border:1px solid var(--l);border-radius:10px;padding:10px;cursor:pointer;font-size:13.5px}
@media (max-width:600px){.dw{align-items:flex-end}.dw .pn{height:88%;border-left:0;border-top:1px solid var(--l);border-radius:18px 18px 0 0;transform:translateY(30px)}}
/* видеолекция в панели: картинки разделов с медленным наездом, голос, субтитры */
.tp .pv,.hub .pv{font-style:normal;font-size:8px;vertical-align:1px;margin-right:4px;opacity:.65}.hub .pv{margin:0 0 0 6px}
.vp{position:relative;aspect-ratio:16/9;width:100%;margin:2px 0 14px;border-radius:14px;overflow:hidden;background:radial-gradient(circle at 30% 30%,#22314d,#0a0f18);user-select:none;-webkit-user-select:none;isolation:isolate}
.vp .fr{position:absolute;inset:0;opacity:0;transition:opacity .7s ease}.vp .fr.on{opacity:1}.vp .fr img{width:100%;height:100%;object-fit:cover;display:block;transform-origin:50% 50%;will-change:transform}
.vp .stage-c{position:absolute;inset:0;cursor:pointer}
.vp .bars{position:absolute;left:10px;right:10px;top:9px;display:flex;gap:4px;z-index:2}.vp .bars i{flex:1;height:3px;border-radius:3px;background:#ffffff4d;overflow:hidden}.vp .bars b{display:block;height:100%;width:0;background:#fff}
.vp .sub{position:absolute;left:12px;right:12px;bottom:46px;z-index:2;text-align:center;pointer-events:none}.vp .sub span{display:inline;padding:3px 8px;border-radius:6px;background:#05080dcc;color:#fff;font:500 15px/1.6 var(--fb);-webkit-box-decoration-break:clone;box-decoration-break:clone}
.vp .ctl{position:absolute;left:0;right:0;bottom:0;z-index:3;display:flex;align-items:center;gap:4px;padding:18px 8px 6px;background:linear-gradient(#05080d00,#05080dd9)}
.vp .ctl button{width:34px;height:34px;border:0;border-radius:9px;background:#ffffff1a;color:#fff;cursor:pointer;font-size:14px;line-height:1;display:grid;place-items:center}.vp .ctl button:hover{background:#ffffff33}.vp .ctl button:disabled{opacity:.35;cursor:default}
.vp .ctl .n{font:500 12px/1 var(--fm);color:#fff;opacity:.85;margin:0 4px;min-width:30px}.vp .ctl .sp{flex:1}
.vp .big{position:absolute;inset:0;z-index:4;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:#05080d8c;border:0;width:100%;cursor:pointer;color:#fff;padding:0}
.vp .big i{font-style:normal;width:68px;height:68px;border-radius:50%;background:var(--a);color:#1b1305;display:grid;place-items:center;font-size:26px;padding-left:5px;box-shadow:0 8px 30px #0008;transition:transform .15s}.vp .big:hover i{transform:scale(1.07)}.vp .big.re i{padding-left:0}
.vp .big span{font:600 13.5px/1.3 var(--fb);background:#05080daa;padding:5px 10px;border-radius:8px}
.vp .ld{position:absolute;right:12px;top:20px;z-index:2;width:18px;height:18px;border-radius:50%;border:2px solid #fff6;border-top-color:#fff;animation:vpspin .8s linear infinite}@keyframes vpspin{to{transform:rotate(360deg)}}
.vp .err{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:20px;color:var(--m);font-size:14px}
details.more{margin:14px 0 0;border-top:1px solid var(--l);padding-top:4px}details.more>summary{cursor:pointer;list-style:none;padding:10px 0;font:600 14px/1.2 var(--fb);color:var(--fg)}details.more>summary::-webkit-details-marker{display:none}details.more>summary::after{content:" ›";color:var(--m)}details.more[open]>summary::after{content:" ⌄"}
@media (max-width:600px){.dw .pn{padding:14px 14px 34px}.vp{border-radius:12px;margin-bottom:12px}.vp .sub{bottom:42px;left:8px;right:8px}.vp .sub span{font-size:13px;line-height:1.55}.vp .ctl{padding:14px 6px 5px}.vp .ctl button{width:32px;height:32px}.vp .big i{width:58px;height:58px;font-size:22px}.dw h2{font-size:20px}}
@media (prefers-reduced-motion:reduce){.vp .fr img{transform:none!important}}
/* конспект карты — тот же текст, что в панели */
.doc{max-width:780px;margin:50px auto 0;border-top:1px solid var(--l);padding-top:10px}
.doc>summary{cursor:pointer;list-style:none}.doc>summary::-webkit-details-marker{display:none}.doc>summary h2::after{content:" ›";color:var(--m)}.doc[open]>summary h2::after{content:" ⌄"}.doc>summary h2,.doc>h2{font:700 26px/1.2 var(--fd);margin:30px 0 6px}.doc .sg{margin:30px 0}.doc .sg>h3{font:700 20px/1.25 var(--fd);margin:0 0 6px}
.doc article{padding:16px 0;border-bottom:1px solid #26324a88}.doc h4{font-size:17px;margin:0 0 6px}
.why{color:var(--m)}.lb{font:600 11.5px/1 var(--fm);letter-spacing:.1em;text-transform:uppercase;color:var(--m);margin:16px 0 6px}
.bx{background:var(--s2);border-left:3px solid var(--ok);border-radius:0 10px 10px 0;padding:10px 14px}.bx.pj{border-left-color:var(--a)}
ul.li{margin:0;padding-left:20px}ul.li li{margin:4px 0}.meta{font:500 12px/1 var(--fm);color:var(--m)}
.os a{display:inline-block;margin:0 6px 6px 0;padding:6px 10px;border-radius:8px;background:#72d4e81a;border:1px solid #72d4e855;color:#9fe3f0;text-decoration:none;font-size:13.5px}
footer{margin:50px 0 0;padding-top:18px;border-top:1px solid var(--l);color:var(--m);font-size:13.5px}footer a{color:var(--m)}
/* атлас */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin:22px 0}
.card{display:flex;flex-direction:column;gap:8px;padding:18px;border:1px solid var(--l);border-radius:16px;background:var(--s);text-decoration:none;color:var(--fg)}
a.card:hover{border-color:var(--a)}.card b{font:700 18px/1.25 var(--fd)}.card span{color:var(--m);font-size:14px}.card em{font:500 11px/1 var(--fm);font-style:normal;text-transform:uppercase;letter-spacing:.12em;color:var(--a)}.card.soon{opacity:.6}.card.soon em{color:var(--m)}
/* «Научи меня»: кнопка в панели темы и поиск в атласе */
.teach{display:flex;align-items:center;justify-content:center;gap:8px;margin:0 0 16px;padding:12px 16px;border-radius:12px;background:var(--a);color:#1b1305;text-decoration:none;font:700 15px/1.2 var(--fb)}.teach:hover{filter:brightness(1.06)}.teach small{font-weight:500;opacity:.75}
.ask-ai{max-width:760px;margin:6px 0 8px;padding:16px 18px;border:1.5px solid var(--a);border-radius:16px;background:var(--s)}.ask-ai b{display:block;font:700 18px/1.25 var(--fd);margin-bottom:4px}.ask-ai>span{color:var(--m);font-size:14px}
.ask-ai form{display:flex;gap:8px;margin:12px 0 0;flex-wrap:wrap}.ask-ai input{flex:1 1 220px;min-width:0;background:var(--bg);border:1.5px solid var(--l);border-radius:12px;padding:12px 14px;font:16px/1.3 var(--fb);color:var(--fg)}.ask-ai input:focus{outline:none;border-color:var(--a)}.ask-ai button{border:0;border-radius:12px;padding:12px 18px;background:var(--a);color:#1b1305;font:700 15px/1.2 var(--fb);cursor:pointer}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}`;

const head = (title, desc, p, ld) => `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${SITE}${p}">
<meta property="og:type" content="article"><meta property="og:site_name" content="Open School AI"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${SITE}${p}"><meta property="og:locale" content="ru_RU">
<link rel="icon" href="/luch/owl.svg"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600&family=IBM+Plex+Mono:wght@500&family=Unbounded:wght@700&display=swap">
<style>${CSS}</style>${ld.map((x) => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, "\\u003c")}</script>`).join("")}</head>`;
const top = `<header><a class="brand" href="/">${OWL}<div><b>OPEN SCHOOL AI</b><small>Доступное образование для всех</small></div></a>
<nav class="sections" aria-label="Разделы"><a href="/">Школа</a><a href="/prof/" aria-current="page">Профессии</a></nav></header>`;
const foot = `<footer>Open School AI — бесплатная школьная программа и карты новых профессий. Формат карты навыков вдохновлён проектом <a href="https://roadmap.sh" rel="noopener">roadmap.sh</a>; содержание написано для Open School.<br><a href="/">Школа</a> · <a href="/prof/">Атлас профессий</a> · <a href="/learn/">Конспекты уроков</a></footer>`;
const ORG = { "@type": "Organization", name: "Open School AI", url: SITE + "/" };

function topicDoc(t) {
  return `<article id="t-${t.id}" data-k="${t.k}"><h4>${esc(t.t)}</h4><div class="meta">${t.k === "core" ? "Обязательно" : "Полезно"} · ≈ ${t.h} ч</div>
<p>${esc(t.what)}</p>
<div class="lb">Что выучить</div><ul class="li">${t.learn.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
${t.practice ? `<div class="lb">Практика</div><div class="bx">${esc(t.practice)}</div>` : ""}
${t.check && t.check.length ? `<div class="lb">Проверь себя</div><ul class="li">${t.check.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
${t.os && t.os.length ? `<div class="lb">Основа в Open School</div><div class="os">${t.os.map(([n, h]) => `<a href="${h}">${esc(n)} ›</a>`).join("")}</div>` : ""}
${t.links && t.links.length ? `<div class="lb">Материалы</div><ul class="li">${t.links.map(([n, h]) => `<li><a href="${h}" target="_blank" rel="noopener">${esc(n)}</a></li>`).join("")}</ul>` : ""}</article>`;
}

function roadmap(P) {
  const all = P.stages.flatMap((s) => s.topics), H = all.reduce((a, t) => a + t.h, 0);
  const p = `/prof/${P.slug}/`;
  const stages = P.stages.map((s, i) => {
    const half = Math.ceil(s.topics.length / 2), L = s.topics.slice(0, half), R = s.topics.slice(half);
    const box = (t) => `<button type="button" class="tp${t.k === "extra" ? " x" : ""}" data-t="${t.id}"><span class="tt">${esc(t.t)}</span><span class="hh">${t.lec ? '<i class="pv" aria-hidden="true">▶</i>' : ""}${t.h} ч</span><span class="ck" aria-hidden="true"></span></button>`;
    return `<section class="stage" data-s="${s.id}"><button type="button" class="hub" data-g="${s.id}"><small>Этап ${i + 1}${s.lec ? '<i class="pv" aria-hidden="true">▶</i>' : ""}</small><b>${esc(s.title)}</b><span class="hp"><i></i></span></button>
<div class="col l">${L.map(box).join("")}</div><div class="col r">${R.map(box).join("")}</div></section>`;
  }).join("\n");
  const doc = P.stages.map((s, i) => `<section class="sg" id="g-${s.id}"><h3>Этап ${i + 1}. ${esc(s.title)}</h3><p class="why">${esc(s.why)}</p>
<div class="lb">Сквозной проект — шаг ${i + 1}</div><div class="bx pj">${esc(s.project)}</div>
${s.topics.map(topicDoc).join("\n")}</section>`).join("\n");
  const title = `${P.title} — карта навыков: что выучить по шагам | Open School AI`;
  const desc = `Как стать Forward Deployed Engineer: ${P.stages.length} этапов и ${all.length} тем — от Python и SQL до ИИ-агентов, RAG и работы с клиентом. Практика, сквозной проект, бесплатно.`;
  const ld = [{ "@context": "https://schema.org", "@type": "Course", name: `${P.title}: карта навыков`, description: P.short, inLanguage: "ru", url: SITE + p, provider: ORG, isAccessibleForFree: true,
    educationalCredentialAwarded: "Портфолио из сквозного проекта", timeRequired: "PT" + H + "H", teaches: all.filter((t) => t.k === "core").map((t) => t.t),
    hasCourseInstance: { "@type": "CourseInstance", courseMode: "online", courseWorkload: "PT" + H + "H" }, offers: { "@type": "Offer", price: 0, priceCurrency: "USD", category: "Free" },
    syllabusSections: P.stages.map((s) => ({ "@type": "Syllabus", name: s.title, description: s.why })) },
    { "@context": "https://schema.org", "@type": "Occupation", name: P.title, alternateName: P.ru, description: P.intro, skills: all.map((t) => t.t).join(", ") },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Профессии", item: SITE + "/prof/" }, { "@type": "ListItem", position: 2, name: P.title, item: SITE + p }] }];
  return `${head(title, desc, p, ld)}
<body><div class="wrap">${top}
<div class="kick"><a href="/prof/" style="color:inherit;text-decoration:none">Атлас профессий</a> · новая профессия</div>
<h1>${esc(P.title)}</h1><p class="sub">${esc(P.ru)}</p>
<p class="lead">${esc(P.short)}</p>
<div class="chips">${P.traits.map((x) => `<span>${esc(x)}</span>`).join("")}</div>
<div class="stats"><div><b>${P.stages.length}</b>этапов</div><div><b>${all.length}</b>тем</div><div><b>${esc(P.hours)}</b>учёбы и практики</div><div><b>${esc(P.months.split(" при ")[0])}</b>${esc("при " + P.months.split(" при ")[1])}</div></div>
<div class="bar" id="bar"><span class="pt" id="pt">Пройдено 0 из ${all.length}</span><span class="pg"><i id="pg"></i></span><button type="button" class="rst" id="rst" hidden>Сбросить</button></div>
<div class="legend"><span><i></i>Обязательно</span><span class="x"><i></i>Полезно, можно позже</span><span class="dg"><i></i>Изучаю</span><span class="dn"><i></i>Готово</span><span>▶ Нажми на тему — короткая видеолекция и что учить</span></div>
<div class="map" id="map">
${stages}
<div class="end">Готовы к собеседованию на FDE</div>
</div>
<details class="doc" id="doc"><summary><h2>Вся карта текстом</h2></summary><p class="why">Те же этапы и темы подряд — удобно читать, распечатать или отправить другу. Через все этапы идёт один сквозной проект: к концу у вас будет работающая система для «клиента» и история для собеседования.</p>
${doc}</details>
${foot}</div>
<div class="dw" id="dw" aria-hidden="true"><div class="pn" role="dialog" aria-modal="true" aria-labelledby="dwh"><div class="top"><small id="dwk"></small><button type="button" class="cl" id="dwx" aria-label="Закрыть">✕</button></div><div id="dwv" hidden></div><h2 id="dwh"></h2><a class="teach" id="dwteach" href="/prof/learn/" hidden>✦ Научи меня <small>— ИИ-курс по этой теме</small></a><div class="st" id="dwst" role="group" aria-label="Статус темы"><button type="button" class="b-doing" data-v="doing" aria-pressed="false">Изучаю</button><button type="button" class="b-done" data-v="done" aria-pressed="false">✓ Готово</button><button type="button" class="b-skip" data-v="skip" aria-pressed="false">Пропустить</button></div><div id="dwb"></div><div class="nv"><button type="button" id="dwp">‹ Предыдущая</button><button type="button" id="dwn">Следующая ›</button></div></div></div>
<script>window.PROF=${JSON.stringify({ slug: P.slug, order: all.map((t) => t.id), stages: P.stages.map((s) => ({ id: s.id, title: s.title, t: s.topics.map((t) => t.id) })),
  lec: Object.fromEntries(P.stages.flatMap((s) => [s.lec ? ["g-" + s.id, s.lec] : null, ...s.topics.map((t) => (t.lec ? ["t-" + t.id, t.lec] : null))]).filter(Boolean)) })};</script>
<script src="/prof/roadmap.js"></script>
</body></html>`;
}

function atlas(list) {
  const p = "/prof/";
  const cards = list.map((P) => { const n = P.stages.flatMap((s) => s.topics).length;
    return `<a class="card" href="/prof/${P.slug}/"><em>Карта и вводный курс</em><b>${esc(P.title)}</b><span>${esc(P.short)}</span><span>${P.stages.length} этапов · ${n} ${pl(n, "тема", "темы", "тем")} · ${esc(P.months.split(" при ")[0])}</span></a>`; }).join("")
    + SOON.map(([n, d]) => `<div class="card soon"><em>Скоро</em><b>${esc(n)}</b><span>${esc(d)}</span></div>`).join("");
  const title = "Атлас новых профессий: карты навыков по шагам | Open School AI";
  const desc = "Новые профессии в IT и ИИ: что выучить, в каком порядке и как практиковаться. Бесплатные карты навыков со сквозным проектом.";
  return `${head(title, desc, p, [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "Атлас новых профессий", inLanguage: "ru", url: SITE + p, publisher: ORG }])}
<body><div class="wrap">${top}
<div class="kick">Open School · профессии</div><h1>Атлас новых профессий</h1>
<p class="lead">Школа даёт основу, а здесь — путь дальше: профессии, которых ещё недавно не было. Для каждой — карта навыков по шагам, практические задания и сквозной проект, который к концу пути становится портфолио.</p>
<div class="ask-ai"><b>✦ Научи меня</b><span>Не нашёл нужное? Напиши любую тему — ИИ составит короткий курс с уроками, схемами, упражнениями и тестом.</span><form action="/prof/learn/" method="get"><input name="term" placeholder="Чему тебя научить? Например, SQL для аналитики" aria-label="Тема курса" maxlength="120" required><button type="submit">Составить курс</button></form></div>
<div class="grid">${cards}</div>
${foot}</div></body></html>`;
}

// «Научи меня»: страница темы и ИИ-курс — оболочки, всё остальное делает prof/teach.js
const EXAMPLES = ["SQL для аналитики", "Python для автоматизации", "Как устроены LLM-агенты", "Промпт-инженерия", "Docker с нуля", "Переговоры с клиентом", "Статистика для A/B-тестов", "Git для команды"];
const teachHead = (title, desc, p, robots) => head(title, desc, p, []).replace("</head>", `${robots ? '<meta name="robots" content="noindex">' : ""}<link rel="stylesheet" href="/prof/teach.css"></head>`);
function learnPage() {
  return `${teachHead("Научи меня: ИИ составит курс по любой теме | Open School AI", "Напиши тему — ИИ составит короткий практический курс: модули, уроки с примерами, схемами и упражнениями, тест и наставник. Бесплатно.", "/prof/learn/")}
<body data-page="learn"><div class="wrap">${top}
<div class="kick"><a href="/prof/">Атлас профессий</a> · научи меня</div>
<div id="home"><h1>Научи меня</h1>
<p class="lead">Напиши тему — ИИ составит короткий практический курс: модули и уроки со сквозным примером, схемами, таблицами и упражнениями. В каждом уроке — проверка себя, тест и наставник, которого можно спросить.</p>
<form class="tf" id="tf" action="/prof/learn/" method="get"><input id="tq" name="term" placeholder="Чему тебя научить?" aria-label="Тема курса" maxlength="120" autocomplete="off" required><button type="submit" class="btn">Составить курс</button></form>
<div class="ex-chips" aria-label="Примеры тем">${EXAMPLES.map((x) => `<button type="button">${esc(x)}</button>`).join("")}</div>
<div id="rcw" hidden><h2 style="font:700 20px/1.25 var(--fd);margin:0 0 10px">Твои курсы</h2><div class="rc" id="rc"></div></div>
<div class="teach-box" style="margin-top:22px"><h2>Как это устроено</h2><p>Курс — 3–5 модулей по 3–4 урока. Урок пишется, когда ты его открываешь, и сохраняется: в следующий раз откроется сразу. Отметки «пройдено» хранятся в этом браузере. Темы из карт профессий — кнопка «Научи меня» в панели темы.</p></div>
</div>
<div class="wait" id="wait" hidden><h2 id="wt">Составляю курс</h2><p id="wp">Обычно это 10–30 секунд.</p>
<ul class="steps"><li><i></i><span>Разбираюсь, чему учить</span></li><li><i></i><span>Составляю модули и уроки</span></li><li><i></i><span>Придумываю сквозной пример</span></li><li><i></i><span>Проверяю программу</span></li></ul>
<div id="wb" hidden style="margin-top:14px"><a class="btn g" href="/prof/learn/">← Назад</a></div></div>
${foot}</div><script src="/prof/teach.js" defer></script></body></html>`;
}
function coursePage() {
  return `${teachHead("ИИ-курс | Open School AI", "Курс, который ИИ составил по запросу ученика: уроки с примерами, схемами, упражнениями и тестом.", "/prof/course/", true)}
<body data-page="course"><div class="wrap">${top}
<div class="wait" id="load"><ul class="steps"><li class="on"><i></i><span>Открываю курс…</span></li></ul></div>
<div class="tc" id="app" hidden data-noi18n>
<button type="button" class="btn g tocb" id="tocb" aria-expanded="false" aria-controls="side"><span>☰ Содержание</span><span id="tocn"></span></button>
<nav class="side" id="side" aria-label="Содержание курса"></nav>
<main class="mn" id="main"></main>
</div>
${foot}</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js" defer></script>
<script src="/prof/teach.js" defer></script>
<script src="/luch/tutor.js" defer></script>
</body></html>`;
}
for (const [d, h] of [["learn", learnPage()], ["course", coursePage()]]) { fs.mkdirSync(path.join(ROOT, d), { recursive: true }); fs.writeFileSync(path.join(ROOT, d, "index.html"), h); }

const live = LIVE.map((s) => { delete require.cache[require.resolve(path.join(ROOT, "data", s + ".js"))]; return require(path.join(ROOT, "data", s + ".js")); });
for (const P of live) { fs.mkdirSync(path.join(ROOT, P.slug), { recursive: true }); fs.writeFileSync(path.join(ROOT, P.slug, "index.html"), roadmap(P)); }
fs.writeFileSync(path.join(ROOT, "index.html"), atlas(live));
console.log("ok:", live.map((P) => P.slug + " " + P.stages.flatMap((s) => s.topics).length + " тем").join(", "));
