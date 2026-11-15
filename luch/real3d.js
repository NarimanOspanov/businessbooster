// «Как в жизни»: объёмная сцена цепи на Three.js рядом со схемой опыта.
// Опыт задаёт window.LUCH_REAL() → описание цепи (источник, детали по порядку от «+», приборы, токи)
// и window.LUCH_REAL.click(key) — что делать по нажатию на деталь (ключ, резистор…).
// Сцена перестраивается, когда меняется состояние опыта; ток бежит огоньками по проводам.
(() => {
  if (window.__luchReal || typeof window.LUCH_REAL !== 'function') return;
  window.__luchReal = true;
  const stage = document.getElementById('stage'), scene2d = document.getElementById('scene');
  if (!stage || !scene2d) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';

  // ---------- переключатель «Схема / Как в жизни» ----------
  const css = document.createElement('style');
  css.textContent = `
  .rl-tog{position:absolute;z-index:6;right:12px;bottom:62px;display:flex;background:var(--tag-bg,rgba(14,21,32,.86));border:1px solid var(--line,#26324a);border-radius:10px;padding:3px;gap:2px;backdrop-filter:blur(6px)}
  .rl-tog button{border:0;background:none;color:var(--muted,#8b96ad);font:600 12.5px/1 var(--font-body,"Golos Text",sans-serif);padding:8px 11px;border-radius:7px;cursor:pointer;white-space:nowrap}
  .rl-tog button[aria-pressed="true"]{background:var(--fg,#e8ecf4);color:var(--bg,#0b1019)}
  .rl-tog[hidden]{display:none}
  .rl-view{position:absolute;left:0;top:0;width:100%;z-index:0;overflow:hidden;touch-action:none;cursor:grab;background:radial-gradient(120% 95% at 50% 35%,var(--stage-hi,#16213a) 0%,var(--stage-lo,#0d1424) 62%,var(--bg,#0b1019) 100%)}
  .rl-view[hidden]{display:none}
  .rl-view.grab{cursor:grabbing}
  .rl-view canvas{display:block;width:100%;height:100%}
  .rl-lbl{position:absolute;left:0;top:0;pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:3px;transform:translate(-50%,-100%);white-space:nowrap}
  .rl-lbl b{font:700 10.5px/1 var(--font-body,"Golos Text",sans-serif);letter-spacing:.06em;text-transform:uppercase;color:#1b1610;background:#fff6e6;border:1.5px solid #1b1610;border-radius:7px;padding:4px 7px}
  .rl-lbl i{font:600 11px/1 var(--font-mono,"IBM Plex Mono",monospace);font-style:normal;color:#fff6e6;background:#1b1610;border-radius:99px;padding:4px 8px}
  .rl-lbl.hot b{background:#ffd166}
  .rl-help{position:absolute;left:50%;bottom:62px;transform:translateX(-50%);z-index:1;font:500 11px/1.3 var(--font-body,sans-serif);color:var(--muted,#8b96ad);background:var(--tag-bg,rgba(14,21,32,.8));border:1px solid var(--line,#26324a);border-radius:99px;padding:5px 11px;pointer-events:none;white-space:nowrap}
  .rl-off{position:absolute;inset:0;display:grid;place-items:center;color:var(--muted,#8b96ad);font:500 13px/1.4 var(--font-body,sans-serif);text-align:center;padding:20px}
  @media (max-width:600px){.rl-help{display:none}.rl-lbl b{display:none}.rl-lbl i{font-size:10px;padding:3px 6px}.rl-tog{bottom:60px;right:8px}}`;
  document.head.appendChild(css);
  const tog = document.createElement('div'); tog.className = 'rl-tog'; tog.setAttribute('role', 'group'); tog.setAttribute('aria-label', 'Вид опыта');
  tog.innerHTML = '<button type="button" data-v="scheme" aria-pressed="true">Схема</button><button type="button" data-v="real" aria-pressed="false">Как в жизни</button>';
  const view = document.createElement('div'); view.className = 'rl-view'; view.hidden = true;
  view.setAttribute('role', 'img'); view.setAttribute('aria-label', 'Цепь как в жизни: объёмные детали на столе');
  const help = document.createElement('div'); help.className = 'rl-help'; help.textContent = 'Нажимайте на ключ · тяните — повернуть · колесо — ближе';
  scene2d.after(view); stage.appendChild(tog);
  const place = () => { const a = scene2d.getBoundingClientRect(), b = stage.getBoundingClientRect(); view.style.top = (a.top - b.top) + 'px'; view.style.height = a.height + 'px'; };
  new ResizeObserver(() => { place(); if (R) R.resize(); }).observe(scene2d);
  place();

  let mode = 'scheme', R = null, loading = null;
  try { if (localStorage.getItem('luch-real') === '1') setTimeout(() => setMode('real'), 0); } catch (e) {}
  tog.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setMode(b.dataset.v, true); });
  function setMode(m, user) {
    mode = m;
    tog.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === m));
    view.hidden = m !== 'real';
    if (help.isConnected !== (m === 'real')) m === 'real' ? stage.appendChild(help) : help.remove();
    if (user) try { localStorage.setItem('luch-real', m === 'real' ? '1' : '0'); } catch (e) {}
    if (m === 'real') start(); else if (R) R.pause();
  }
  // урок без цепи — переключатель прячем
  function desc() { try { return window.LUCH_REAL(); } catch (e) { return null; } }
  setInterval(() => {
    const d = desc();
    tog.hidden = !d;
    if (!d && mode === 'real') { view.hidden = true; help.remove(); if (R) R.pause(); }
    else if (d && mode === 'real' && view.hidden) { view.hidden = false; stage.appendChild(help); start(); }
    if (d && R && mode === 'real') R.update(d);
  }, 180);
  tog.hidden = !desc();

  function start() {
    if (R) { R.resume(); R.update(desc()); return; }
    if (loading) return;
    loading = import(THREE_URL).then(T => { R = make(T); R.update(desc()); }).catch(() => {
      view.innerHTML = '<div class="rl-off">Не получилось загрузить 3D-вид. Проверьте интернет — схема работает как обычно.</div>';
    });
  }

  // =====================================================================================
  function make(T) {
    let renderer;
    try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) {
      view.innerHTML = '<div class="rl-off">Этот браузер не умеет показывать 3D. Схема работает как обычно.</div>'; return { update() {}, pause() {}, resume() {}, resize() {} };
    }
    renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    view.appendChild(renderer.domElement);
    const labels = document.createElement('div'); labels.style.cssText = 'position:absolute;inset:0;pointer-events:none'; view.appendChild(labels);

    const sc = new T.Scene();
    const cam = new T.OrthographicCamera(-1, 1, 1, -1, -2000, 2000);
    sc.add(new T.HemisphereLight(0xfff4e0, 0x3a4560, 1.15));
    const sun = new T.DirectionalLight(0xffffff, 1.9); sun.position.set(-40, 110, 60); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 1, far: 300 }); sun.shadow.bias = -0.0006; sun.shadow.radius = 4;
    sc.add(sun);

    // ---------- материалы: мультяшный свет в три тона + тёмный контур ----------
    const grad = new T.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, T.RedFormat); grad.minFilter = grad.magFilter = T.NearestFilter; grad.needsUpdate = true;
    const mats = new Map();
    const toon = (color, o = {}) => { const k = color + JSON.stringify(o); if (!mats.has(k)) mats.set(k, new T.MeshToonMaterial({ color, gradientMap: grad, ...o })); return mats.get(k); };
    const INK = 0x1b1610;
    const edgeMat = new T.LineBasicMaterial({ color: INK });
    const hullMat = new T.ShaderMaterial({ side: T.BackSide, uniforms: { t: { value: 0.32 } },
      vertexShader: 'uniform float t; void main(){ vec3 p = position + normal * t; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
      fragmentShader: 'void main(){ gl_FragColor = vec4(0.106, 0.086, 0.063, 1.0); }' });

    let root = new T.Group(); sc.add(root);
    const clickables = [], sleeves = [], tags = [];
    let disposables = [];
    const keep = o => { disposables.push(o); return o; };
    // деталь: сетка + контур (рёбра для углов, «оболочка» для круглых)
    function mesh(geo, color, o = {}) {
      keep(geo);
      const m = new T.Mesh(geo, o.mat || toon(color, o.matOpt));
      m.castShadow = o.shadow !== false; m.receiveShadow = true;
      if (o.edges !== false) { const e = new T.LineSegments(keep(new T.EdgesGeometry(geo, o.edgeAngle || 30)), edgeMat); m.add(e); }
      if (o.hull) { const h = new T.Mesh(geo, hullMat); m.add(h); }
      return m;
    }
    const box = (w, h, d, color, o) => mesh(new T.BoxGeometry(w, h, d), color, o);
    const cyl = (r, h, color, o = {}) => mesh(new T.CylinderGeometry(o.r2 ?? r, r, h, o.seg || 28), color, { hull: true, ...o });
    const at = (obj, x, y, z, parent) => { obj.position.set(x, y, z); (parent || root).add(obj); return obj; };

    // ---------- детали ----------
    const WOOD = 0xc98f55, WOOD2 = 0xb47944, BRASS = 0xd8b04a, STEEL = 0xc6ccd6, DARK = 0x2c3240;
    function baseBlock(g, len, dep, h = 2.4) { at(box(len, h, dep, WOOD2), 0, h / 2, 0, g); return h; }
    function post(g, x, z, y0, col = BRASS) {
      at(cyl(1.15, 3.2, col), x, y0 + 1.6, z, g);
      at(cyl(1.7, 1.1, STEEL, { seg: 6 }), x, y0 + 0.55, z, g);
      return new T.Vector3(x, y0 + 3.2, z);
    }
    // батарейка: лежащие элементы в держателе; «+» смотрит по ходу тока (+x)
    function cells(n, U) {
      const g = new T.Group(), L = 15, len = n * L + 6;
      at(box(len, 2, 13, 0x3a3f4c), 0, 1, 0, g);
      at(box(len, 5, 1.2, 0x3a3f4c), 0, 3.5, -6.2, g); at(box(len, 5, 1.2, 0x3a3f4c), 0, 3.5, 6.2, g);
      for (let i = 0; i < n; i++) {
        const cx = -len / 2 + 3 + L * i + L / 2, c = new T.Group();
        const body = cyl(5, L - 2.4, 0x6ccf4f); body.rotation.z = Math.PI / 2; at(body, -0.6, 0, 0, c);
        const band = cyl(5.05, 3, 0xf2c94c, { edges: false }); band.rotation.z = Math.PI / 2; at(band, L / 2 - 4.6, 0, 0, c);
        const cap = cyl(4.3, 1, STEEL); cap.rotation.z = Math.PI / 2; at(cap, L / 2 - 1.2, 0, 0, c);
        const nip = cyl(1.6, 1.2, STEEL); nip.rotation.z = Math.PI / 2; at(nip, L / 2 - 0.1, 0, 0, c);
        const bot = cyl(4.6, 0.8, STEEL); bot.rotation.z = Math.PI / 2; at(bot, -L / 2 + 0.6, 0, 0, c);
        at(c, cx, 7, 0, g);
      }
      const yT = 7;
      const tm = new T.Vector3(-len / 2 - 1.5, yT, 0), tp = new T.Vector3(len / 2 + 1.5, yT, 0);
      at(cyl(1.2, 3, 0x26324a), tm.x, yT - 1, 0, g); at(cyl(1.2, 3, 0xe0473a), tp.x, yT - 1, 0, g);
      return { g, len: len + 4, tin: tm, tout: tp, tag: [n > 1 ? `БАТАРЕЯ · ${n} эл.` : 'БАТАРЕЙКА', fmtU(U)], top: 13 };
    }
    // регулируемый источник: корпус с табло и ручкой
    function supply(U, unit) {
      const g = new T.Group();
      at(box(26, 16, 14, 0x3b4a66), 0, 8, 0, g);
      at(box(24, 1.2, 12, 0x4a5b7c), 0, 16.6, 0, g);
      const scr = new T.Mesh(keep(new T.PlaneGeometry(14, 6)), new T.MeshBasicMaterial({ map: keep(textTex(unit ? String(U).replace('.', ',') + ' ' + unit : fmtU(U), '#86e0a8', '#0e1520', 256, 110)) }));
      at(scr, -3, 10.5, 7.05, g);
      const knob = cyl(2.6, 2, 0xd9dfe9, { seg: 18 }); knob.rotation.x = Math.PI / 2; at(knob, 8.5, 10.5, 7.8, g);
      at(cyl(1.3, 3, 0xe0473a), 9, 18.6, -3, g); at(cyl(1.3, 3, 0x26324a), -9, 18.6, -3, g);
      return { g, len: 28, tin: new T.Vector3(-9, 20, -3), tout: new T.Vector3(9, 20, -3), tag: ['ИСТОЧНИК ТОКА', fmtU(U)], top: 22 };
    }
    // рубильник: лезвие поднимается, когда ключ разомкнут
    function knife(el) {
      const g = new T.Group(), y0 = baseBlock(g, 24, 11);
      const tin = post(g, -9, 0, y0), tout = post(g, 9, 0, y0);
      at(box(1.2, 4.2, 3.2, BRASS), -7, y0 + 2.1, 0, g);
      at(box(1, 4.4, 0.8, BRASS), 7, y0 + 2.2, -1.3, g); at(box(1, 4.4, 0.8, BRASS), 7, y0 + 2.2, 1.3, g);
      const hinge = new T.Group(); at(hinge, -7, y0 + 3.6, 0, g);
      hinge.rotation.z = el.closed ? 0 : 0.75;
      at(box(17, 0.9, 1.8, 0xd38b4a), 8.5, 0, 0, hinge);
      const h = cyl(1.3, 5, 0x3b6fd8); h.rotation.z = Math.PI / 2; at(h, 18.5, 0, 0, hinge);
      g.userData.click = el.click || 'sw';
      return { g, len: 26, tin, tout, tag: ['КЛЮЧ', el.closed ? 'замкнут' : 'разомкнут'], top: 10 };
    }
    // лампочка в патроне на подставке; светит по-настоящему
    function bulb(el) {
      const g = new T.Group(), y0 = baseBlock(g, 16, 12);
      const tin = post(g, -6, 3.2, y0), tout = post(g, 6, 3.2, y0);
      at(cyl(3.4, 3, DARK), 0, y0 + 1.5, -1, g);
      const screw = cyl(2.5, 3.2, STEEL, { seg: 20 }); at(screw, 0, y0 + 4.6, -1, g);
      for (let k = 0; k < 3; k++) at(cyl(2.65, 0.4, 0x9aa3b2, { edges: false, hull: false }), 0, y0 + 3.4 + k * 1.1, -1, g);
      const gl = Math.max(0, Math.min(1.6, el.glow || 0));
      const glass = new T.Mesh(keep(new T.SphereGeometry(5.4, 32, 22)), new T.MeshToonMaterial({ color: gl > 0.02 ? 0xfff1b8 : 0xdfe8ef, gradientMap: grad, transparent: true, opacity: gl > 0.02 ? 0.92 : 0.5, emissive: 0xffc23a, emissiveIntensity: Math.min(1, gl * 0.9) }));
      glass.add(new T.Mesh(glass.geometry, hullMat));
      at(glass, 0, y0 + 10.4, -1, g);
      // нить накала
      const pts = []; for (let k = 0; k <= 8; k++) pts.push(new T.Vector3(-2 + k * 0.5, 1.2 + (k % 2 ? 0.9 : 0), 0));
      const fil = new T.Mesh(keep(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(-1.6, -2.4, 0), ...pts, new T.Vector3(1.6, -2.4, 0)]), 40, 0.18, 6)),
        new T.MeshBasicMaterial({ color: gl > 0.02 ? (gl > 1.25 ? 0xffffff : 0xffd27a) : 0x5d6a86 }));
      at(fil, 0, y0 + 10.4, -1, g);
      if (gl > 0.02) {
        const light = new T.PointLight(0xffc860, 60 * gl, 70, 1.2); at(light, 0, y0 + 11, -1, g);
        const halo = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color: 0xffd27a, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: Math.min(1, 0.35 + gl * 0.5) }));
        halo.scale.setScalar(16 + 22 * Math.min(1.4, gl)); at(halo, 0, y0 + 10.4, -1, g);
      }
      return { g, len: 16, tin, tout, tag: [el.label || 'ЛАМПОЧКА', el.value], top: y0 + 17, hot: gl > 1.25 };
    }
    // резистор: керамический цилиндр с полосками на стойках
    function resistor(el) {
      const g = new T.Group(), y0 = baseBlock(g, 22, 10);
      const tin = post(g, -9, 0, y0), tout = post(g, 9, 0, y0);
      at(box(1, 3.2, 1, STEEL), -7, y0 + 2.6, 0, g); at(box(1, 3.2, 1, STEEL), 7, y0 + 2.6, 0, g);
      const body = cyl(2.4, 12, el.hot ? 0xe9a15a : 0xe3cfa6); body.rotation.z = Math.PI / 2; at(body, 0, y0 + 4.6, 0, g);
      const cols = el.bands || bandsOf(el.R);
      cols.forEach((c, k) => { const b = cyl(2.48, 0.9, c, { edges: false, hull: false }); b.rotation.z = Math.PI / 2; at(b, -3.6 + k * 2.4, y0 + 4.6, 0, g); });
      const lead = cyl(0.3, 16, STEEL, { edges: false, hull: false }); lead.rotation.z = Math.PI / 2; at(lead, 0, y0 + 4.6, 0, g);
      if (el.click) g.userData.click = el.click;
      return { g, len: 22, tin, tout, tag: [el.label || 'РЕЗИСТОР', el.value], top: y0 + 9 };
    }
    // реостат: обмотка на керамике, стержень и ползунок
    function rheostat(el) {
      const g = new T.Group(), y0 = baseBlock(g, 34, 11), f = Math.max(0, Math.min(1, el.f ?? 1));
      const tin = post(g, -15, 3.5, y0), tout = post(g, 15, -3.5, y0);
      at(box(2, 9, 6, 0x3a3f4c), -14, y0 + 4.5, 0, g); at(box(2, 9, 6, 0x3a3f4c), 14, y0 + 4.5, 0, g);
      const tube = cyl(3.2, 26, 0xe3cfa6); tube.rotation.z = Math.PI / 2; at(tube, 0, y0 + 4.6, 0, g);
      for (let k = 0; k < 26; k++) { const t = cyl(3.32, 0.45, 0xc0703a, { edges: false, hull: false }); t.rotation.z = Math.PI / 2; at(t, -12.5 + k, y0 + 4.6, 0, g); }
      const rod = cyl(0.55, 28, STEEL, { edges: false }); rod.rotation.z = Math.PI / 2; at(rod, 0, y0 + 10, 0, g);
      const sx = -12 + 24 * f;
      at(box(3.6, 3, 4, 0x3b6fd8), sx, y0 + 10, 0, g); at(box(1, 2.4, 1, BRASS), sx, y0 + 7.9, 0, g);
      if (el.click) g.userData.click = el.click;
      return { g, len: 34, tin, tout, tag: ['РЕОСТАТ', el.value], top: y0 + 13 };
    }
    // стрелочный прибор: корпус, шкала, стрелка, клеммы сверху
    function meter(el, small) {
      const g = new T.Group(), s = small ? 0.62 : 1, w = 16 * s, h = 13 * s, d = 11 * s;
      at(box(w, h, d, el.kind === 'V' ? 0xe6c14a : 0xe8ecf4), 0, h / 2, 0, g);
      const face = new T.Mesh(keep(new T.PlaneGeometry(w - 2.4 * s, h - 3 * s)), new T.MeshBasicMaterial({ map: keep(dialTex(el.kind, el.val || 0, el.max || 1, el.over)) }));
      at(face, 0, h / 2 + 0.3 * s, d / 2 + 0.05, g);
      const back = face.clone(); back.rotation.y = Math.PI; at(back, 0, h / 2 + 0.3 * s, -d / 2 - 0.05, g);
      const tin = new T.Vector3(-w / 2 + 3 * s, h + 2 * s, -d / 4), tout = new T.Vector3(w / 2 - 3 * s, h + 2 * s, -d / 4);
      at(cyl(1.1 * s, 2 * s, el.kind === 'V' ? 0xe0473a : 0xe0473a), tin.x, h + s, tin.z, g); at(cyl(1.1 * s, 2 * s, 0x26324a), tout.x, h + s, tout.z, g);
      if (el.click) g.userData.click = el.click;
      return { g, len: w + 2, tin, tout, tag: [el.label || (el.kind === 'V' ? 'ВОЛЬТМЕТР' : 'АМПЕРМЕТР'), el.value], top: h + 4, faceFront: true, hot: el.over };
    }
    // цветовые полоски резистора по номиналу: две цифры, множитель, допуск
    function bandsOf(R) {
      const C = [0x111111, 0x8b4513, 0xd62828, 0xf07c1e, 0xf2d230, 0x2e9e4f, 0x2f6fd8, 0x8e44ad, 0x8b8f99, 0xf4f4f4], GOLD = 0xd4af37;
      if (!(R > 0)) return [0x8b4513, 0x111111, 0xd62828, GOLD];
      if (R < 10) { const v = Math.round(R * 10); return [C[Math.floor(v / 10) % 10], C[v % 10], GOLD, GOLD]; }
      let e = 0, v = R; while (v >= 100) { v /= 10; e++; } v = Math.round(v);
      return [C[Math.floor(v / 10) % 10], C[v % 10], C[e] ?? GOLD, GOLD];
    }
    const BUILD = { bulb, resistor, rheostat, switch: knife, ammeter: e => meter({ ...e, kind: 'A' }, e.small), voltmeter: e => meter({ ...e, kind: 'V' }, e.small) };

    // ---------- текстуры ----------
    let glowT = null;
    function glowTex() {
      if (glowT) return glowT;
      const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
      const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,240,190,1)'); gr.addColorStop(0.35, 'rgba(255,200,90,.45)'); gr.addColorStop(1, 'rgba(255,170,60,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 128, 128); glowT = new T.CanvasTexture(c); return glowT;
    }
    function textTex(txt, fg, bg, w, h) {
      const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
      x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = fg; let fs = Math.round(h * 0.62); x.font = `600 ${fs}px "IBM Plex Mono", monospace`; const tw = x.measureText(txt).width; if (tw > w * 0.88) { fs = Math.floor(fs * w * 0.88 / tw); x.font = `600 ${fs}px "IBM Plex Mono", monospace`; } x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, w / 2, h / 2 + 2);
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
    }
    function dialTex(kind, val, max, over) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 192; const x = c.getContext('2d');
      x.fillStyle = '#f7f3ea'; x.fillRect(0, 0, 256, 192);
      x.strokeStyle = '#1b1610'; x.lineWidth = 6; x.strokeRect(3, 3, 250, 186);
      const cx = 128, cy = 168, r = 120;
      x.lineWidth = 3; x.beginPath(); x.arc(cx, cy, r, Math.PI * 1.2, Math.PI * 1.8); x.stroke();
      for (let k = 0; k <= 10; k++) {
        const a = Math.PI * (1.2 + 0.6 * k / 10), l = k % 5 ? 12 : 22;
        x.lineWidth = k % 5 ? 2 : 3.5; x.beginPath(); x.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); x.lineTo(cx + Math.cos(a) * (r - l), cy + Math.sin(a) * (r - l)); x.stroke();
      }
      x.fillStyle = '#1b1610'; x.font = '700 46px "Golos Text", sans-serif'; x.textAlign = 'center'; x.fillText(kind, cx, 150);
      const f = Math.max(0, Math.min(1.08, max ? val / max : 0)), a = Math.PI * (1.2 + 0.6 * f);
      x.strokeStyle = over ? '#ff2a1a' : '#c0392b'; x.lineWidth = 5; x.lineCap = 'round'; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8)); x.stroke();
      x.fillStyle = '#1b1610'; x.beginPath(); x.arc(cx, cy, 10, 0, Math.PI * 2); x.fill();
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
    }
    let dashT = null;
    function dashTex() {
      if (dashT) return dashT;
      const c = document.createElement('canvas'); c.width = 64; c.height = 8; const x = c.getContext('2d');
      x.clearRect(0, 0, 64, 8); x.fillStyle = '#ffd166'; x.fillRect(8, 0, 16, 8);
      dashT = new T.CanvasTexture(c); dashT.wrapS = T.RepeatWrapping; dashT.colorSpace = T.SRGBColorSpace; return dashT;
    }

    // ---------- провода ----------
    const WIRE_COL = { plus: 0xe0473a, mid: 0x3fae5a, minus: 0x2f6fd8, probeR: 0xe0473a, probeB: 0x2a2f3a };
    function cable(a, b, col, I, o = {}) {
      // от клеммы вверх-в сторону, по столу, и в другую клемму
      const lift = o.lift ?? 3, mid = a.clone().lerp(b, 0.5);
      const dist = a.distanceTo(b), sag = Math.min(8, dist * 0.12);
      const p1 = a.clone().add(new T.Vector3(0, lift, 0)), p2 = b.clone().add(new T.Vector3(0, lift, 0));
      const pts = [a, p1, a.clone().lerp(b, 0.25).setY(Math.max(1.3, Math.min(a.y, b.y) * 0.25)), mid.clone().setY(1.2 + (o.arch || 0) * sag), b.clone().lerp(a, 0.25).setY(Math.max(1.3, Math.min(a.y, b.y) * 0.25)), p2, b];
      if (o.via) pts.splice(3, 1, ...o.via);
      const curve = new T.CatmullRomCurve3(pts, false, 'centripetal');
      const r = o.r || 0.95, segs = Math.max(30, Math.round(curve.getLength() * 1.4));
      const tube = mesh(new T.TubeGeometry(curve, segs, r, 10), col, { hull: true, edges: false });
      root.add(tube);
      if (I > 1e-6) {
        const tex = dashTex().clone(); tex.needsUpdate = true; keep(tex);
        tex.repeat.set(Math.max(1, curve.getLength() / 12), 1);
        const sl = new T.Mesh(keep(new T.TubeGeometry(curve, segs, r * 1.08, 10)), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
        sl.renderOrder = 2; root.add(sl);
        sleeves.push({ tex, speed: Math.min(3.2, 0.5 + 2.2 * Math.sqrt(I)) });
      }
      return curve;
    }

    // ---------- раскладка цепи по краям стола ----------
    const B = { x0: -52, x1: 52, z0: -30, z1: 28 };
    function table() {
      at(box(140, 3, 100, WOOD, { edges: true }), 0, -1.5, 4);
      for (let k = -4; k <= 4; k++) at(box(0.35, 0.05, 100, 0xb07a44, { edges: false, shadow: false }), k * 15.5, 0.03, 4);
    }
    const clickable = (g, key) => { if (key) { g.userData.click = key; clickables.push(g); } return g; };
    const v3 = (x, y, z) => new T.Vector3(x, y, z);

    // ===== «Сопротивление»: проволока на доске с линейкой, зажим-ползунок, мультиметр =====
    function sceneWire(d) {
      const g = new T.Group(); root.add(g);
      at(box(112, 3, 24, WOOD2), 0, 1.5, -6, g);
      // линейка вдоль переднего края доски
      at(box(100, 0.5, 5, 0xf1e3c2, { edges: true }), 0, 3.25, 3.5, g);
      for (let k = 0; k <= 20; k++) at(box(0.35, 0.12, k % 2 ? 1.6 : 3, 0x3a2e22, { edges: false, shadow: false }), -48 + k * 4.8, 3.56, 2.6 + (k % 2 ? 0.7 : 0), g);
      const xa = -48, xb = 48, xl = xa + (xb - xa) * Math.max(0.05, Math.min(1, d.l));
      // концевые стойки
      const pa = post(g, xa - 3, -8, 3), pb = post(g, xb + 3, -8, 3);
      // проволока: толщина — сечение, цвет — металл
      const r = 0.35 + 0.75 * Math.sqrt(d.S || 0.5), wy = 5.4;
      const metal = toon(d.col || 0xd98a4e);
      const wire = mesh(new T.CylinderGeometry(r, r, xb - xa, 18), 0, { mat: metal, hull: true, edges: false }); wire.rotation.z = Math.PI / 2; at(wire, 0, wy, -8, g);
      clickable(wire, 'mcycle');
      // подсвечиваем измеряемый участок
      const seg = mesh(new T.CylinderGeometry(r * 1.25, r * 1.25, xl - xa, 18), 0, { mat: new T.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.28, depthWrite: false }), edges: false, shadow: false });
      seg.rotation.z = Math.PI / 2; at(seg, (xa + xl) / 2, wy, -8, g);
      at(box(2.4, 3, 3, BRASS), xa, wy - 1.2, -8, g); at(box(2.4, 3, 3, BRASS), xb, wy - 1.2, -8, g);
      // зажим-ползунок
      const cl = new T.Group(); at(cl, xl, 0, -8, g);
      at(box(4, 6, 5, 0xe0473a), 0, wy + 3.4, 0, cl); at(box(1, 3, 1.2, STEEL), 0, wy + 0.6, 1.6, cl); at(box(1, 3, 1.2, STEEL), 0, wy + 0.6, -1.6, cl);
      clickable(cl, 'lcycle');
      // мультиметр перед доской
      const mm = new T.Group(); at(mm, -24, 0, 34);
      at(box(22, 5, 30, 0xf2c94c), 0, 2.5, 0, mm);
      const scr = new T.Mesh(keep(new T.PlaneGeometry(17, 8)), new T.MeshBasicMaterial({ map: keep(textTex(d.Rtxt, d.ok ? '#86e0a8' : '#e8ecf4', '#0e1520', 300, 130)) }));
      scr.rotation.x = -Math.PI / 2; at(scr, 0, 5.05, -7, mm);
      const knob = cyl(4, 1.4, 0x2c3240); at(knob, 0, 5.7, 5, mm);
      at(cyl(1.3, 2, 0xe0473a), -5, 6, 12, mm); at(cyl(1.3, 2, 0x26324a), 5, 6, 12, mm);
      mm.updateMatrixWorld(true); cl.updateMatrixWorld(true);
      const tR = v3(-5, 7, 12).applyMatrix4(mm.matrixWorld), tB = v3(5, 7, 12).applyMatrix4(mm.matrixWorld);
      cable(tR, v3(xl, wy + 6.4, -8), WIRE_COL.probeR, 0, { r: 0.6, lift: 6, arch: 1 });
      cable(tB, pa.clone().add(v3(0, 0, -8)), WIRE_COL.probeB, 0, { r: 0.6, lift: 6, arch: 1 });
      tag(v3((xa + xb) / 2, 13, -8), d.matName, 'S = ' + d.Stxt);
      tag(v3(xl, 17, -8), 'Зажим', 'l = ' + d.ltxt);
      tag(v3(-24, 12, 34), 'Мультиметр', d.Rtxt, false);
    }

    // ===== «Мощность»: удлинитель с автоматом и бытовые приборы =====
    function appliance(id, on) {
      const g = new T.Group();
      if (id === 'kettle') {
        at(cyl(5.2, 1.4, 0x2c3240), 0, 0.7, 0, g);
        at(cyl(4.4, 12, 0xe8ecf4, { r2: 3.6 }), 0, 7.4, 0, g);
        at(cyl(3.8, 0.8, 0x9aa3b2), 0, 13.8, 0, g);
        at(box(1.4, 9, 2, 0x2c3240), -5.2, 7.6, 0, g); at(box(3, 1.4, 2, 0x2c3240), -4.2, 12, 0, g); at(box(3, 1.4, 2, 0x2c3240), -4.2, 3.4, 0, g);
        const sp = cyl(0.9, 4, 0xe8ecf4); sp.rotation.z = -0.9; at(sp, 5.2, 11, 0, g);
        if (on) at(box(1.2, 0.8, 0.4, 0x6fe3ff, { edges: false, matOpt: { emissive: 0x3fc8ff, emissiveIntensity: 1 } }), 0, 2, 4.2, g);
      } else if (id === 'dryer') {
        const b = cyl(3.4, 11, 0xc779d0); b.rotation.z = Math.PI / 2; at(b, 1, 10, 0, g);
        const nz = cyl(2.2, 4, 0x8e44ad, { r2: 1.6 }); nz.rotation.z = -Math.PI / 2; at(nz, 8.4, 10, 0, g);
        at(box(2.6, 8, 3, 0xc779d0), -2, 4.8, 0, g); at(box(6, 1, 5, 0x8e44ad), -2, 0.5, 0, g);
        if (on) { const h = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color: 0xff9d5c, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.55 })); h.scale.setScalar(7); at(h, 11, 10, 0, g); }
      } else if (id === 'iron') {
        at(box(12, 1.2, 6, STEEL), 0, 0.6, 0, g);
        at(box(10, 3, 5, 0x3b6fd8), -0.6, 2.7, 0, g);
        at(box(1.4, 3.2, 1.4, 0x2c3240), -3.5, 5.4, 0, g); at(box(1.4, 3.2, 1.4, 0x2c3240), 2.5, 5.4, 0, g); at(box(8, 1.4, 2, 0x2c3240), -0.5, 7.4, 0, g);
        if (on) at(box(0.8, 0.5, 0.8, 0xff5a3c, { edges: false, matOpt: { emissive: 0xff3c1e, emissiveIntensity: 1 } }), 3.5, 4.4, 2.2, g);
      } else if (id === 'tv') {
        at(box(8, 0.8, 5, 0x2c3240), 0, 0.4, 0, g); at(box(1.4, 4, 1.4, 0x2c3240), 0, 2.6, -0.6, g);
        at(box(20, 12, 1.2, 0x1b1f28), 0, 10.6, -0.6, g);
        const sc = new T.Mesh(keep(new T.PlaneGeometry(18.4, 10.4)), on ? new T.MeshBasicMaterial({ map: screenTex() }) : new T.MeshBasicMaterial({ color: 0x0b0e14 }));
        at(sc, 0, 10.6, 0.02, g);
      } else if (id === 'laptop') {
        at(box(14, 0.9, 10, 0x9aa3b2), 0, 0.45, 0, g);
        at(box(11, 0.1, 4, 0x2c3240, { edges: false }), 0, 0.95, -1.5, g);
        const lid = new T.Group(); at(lid, 0, 0.9, -5, g); lid.rotation.x = -0.32;
        at(box(14, 9.5, 0.6, 0x9aa3b2), 0, 4.75, 0, lid);
        const sc = new T.Mesh(keep(new T.PlaneGeometry(12.4, 8)), on ? new T.MeshBasicMaterial({ map: screenTex() }) : new T.MeshBasicMaterial({ color: 0x0b0e14 }));
        at(sc, 0, 4.75, 0.32, lid);
      } else {
        at(cyl(3.6, 1.2, 0x2c3240), 0, 0.6, 0, g); at(cyl(0.5, 9, STEEL, { edges: false }), 0, 5.6, 0, g);
        at(cyl(2.4, 1.6, 0x2c3240), 0, 10.6, 0, g);
        const glass = new T.Mesh(keep(new T.SphereGeometry(2.6, 24, 16)), new T.MeshToonMaterial({ color: on ? 0xfff1b8 : 0xdfe8ef, gradientMap: grad, transparent: true, opacity: on ? 0.95 : 0.55, emissive: 0xffc23a, emissiveIntensity: on ? 0.9 : 0 }));
        glass.add(new T.Mesh(glass.geometry, hullMat)); at(glass, 0, 13.4, 0, g);
        if (on) { const h = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color: 0xffd27a, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.8 })); h.scale.setScalar(14); at(h, 0, 13.4, 0, g); at(new T.PointLight(0xffc860, 25, 40, 1.2), 0, 14, 0, g); }
      }
      return g;
    }
    let scrT = null;
    function screenTex() {
      if (scrT) return scrT;
      const c = document.createElement('canvas'); c.width = 256; c.height = 144; const x = c.getContext('2d');
      const gr = x.createLinearGradient(0, 0, 256, 144); gr.addColorStop(0, '#2b6fd8'); gr.addColorStop(1, '#72d4e8'); x.fillStyle = gr; x.fillRect(0, 0, 256, 144);
      x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.arc(80, 70, 26, 0, 7); x.fill(); x.fillRect(130, 50, 90, 10); x.fillRect(130, 70, 70, 10); x.fillRect(130, 90, 80, 10);
      scrT = new T.CanvasTexture(c); scrT.colorSpace = T.SRGBColorSpace; return scrT;
    }
    function scenePower(d) {
      // удлинитель с шестью розетками и автоматом
      const strip = new T.Group(); at(strip, 0, 0, -22);
      at(box(76, 4.4, 11, 0xf3f4f6), 0, 2.2, 0, strip);
      const n = d.apps.length, xs = k => -30 + k * 11;
      for (let k = 0; k < n; k++) {
        at(cyl(3.3, 0.5, 0xdfe3ea, { seg: 24 }), xs(k), 4.6, 0, strip);
        at(box(0.8, 0.3, 2.2, 0x2c3240, { edges: false }), xs(k) - 1.1, 4.95, 0, strip); at(box(0.8, 0.3, 2.2, 0x2c3240, { edges: false }), xs(k) + 1.1, 4.95, 0, strip);
      }
      const br = at(box(5, 3, 7, d.trip ? 0xe0473a : 0x3fae5a), 35.5, 5.6, 0, strip); clickable(br, 'breaker');
      strip.updateMatrixWorld(true);
      // шнур к розетке в стене (за столом)
      at(box(9, 12, 2, 0xf3f4f6), -60, 6, -40);
      cable(v3(-38, 2, -22), v3(-60, 5, -38.8), 0xf3f4f6, 0, { r: 0.9, lift: 1 });
      // приборы в ряд перед удлинителем
      d.apps.forEach((a, k) => {
        const x = -52 + k * 20.8, z = 18 + (k % 2) * 8;
        const g = appliance(a.id, a.on); at(g, x, 0, z); clickable(g, 'app' + k);
        const base = v3(x + (a.id === 'dryer' ? -2 : 0), 1.2, z - 3);
        if (a.plug) {
          const sock = v3(xs(k), 6.2, -22);
          at(box(2.6, 2.2, 3, 0x2c3240), sock.x, 6.2, sock.z);
          cable(base, sock.clone().setY(5.2), 0x2c3240, a.on ? 1 : 0, { r: 0.6, lift: 1 });
        } else {
          const tip = v3(x + 4, 1.4, z - 9);
          cable(base, tip, 0x2c3240, 0, { r: 0.6, lift: 1 }); at(box(2.6, 2.2, 3, 0x2c3240), tip.x, 1.4, tip.z - 1.2);
        }
        tag(v3(x, a.id === 'tv' ? 20 : a.id === 'lamp' ? 19 : 17, z), a.name, a.P + ' Вт', a.on);
      });
      tag(v3(0, 10, -22), d.trip ? 'Автомат отключился' : 'Удлинитель', d.Ptxt, d.over);
    }

    // ===== «Джоуль — Ленц»: источник, амперметр, калориметр со спиралью и термометром =====
    function sceneJoule(d) {
      const src = supply(d.I, 'А'); clickable(src.g, 'icycle');
      const sN = placeOn(src, v3(-34, 0, -14), 0, 'src');
      const am = meter({ kind: 'A', val: d.I, max: 4, value: d.Itxt }); const aN = placeOn(am, v3(-6, 0, 22), 0, 'am');
      // калориметр: стеклянный стакан, вода, крышка
      const cg = new T.Group(); at(cg, 30, 0, -2); clickable(cg, 'spiral');
      const glass = new T.Mesh(keep(new T.CylinderGeometry(11, 10, 26, 40, 1, true)), new T.MeshToonMaterial({ color: 0xcfe6f2, gradientMap: grad, transparent: true, opacity: 0.28, side: T.DoubleSide, depthWrite: false }));
      at(glass, 0, 13, 0, cg); glass.add(new T.Mesh(glass.geometry, hullMat));
      at(cyl(10.4, 0.6, 0xcfe6f2, { edges: false, hull: false }), 0, 0.3, 0, cg);
      const hot = Math.max(0, Math.min(1, (d.T - 20) / 70));
      const water = new T.Mesh(keep(new T.CylinderGeometry(10.6, 9.8, 18, 40)), new T.MeshToonMaterial({ color: new T.Color(0x5fb4e8).lerp(new T.Color(0xe88a5f), hot * 0.6), gradientMap: grad, transparent: true, opacity: 0.55, depthWrite: false }));
      at(water, 0, 9.6, 0, cg);
      at(cyl(11.6, 1.4, 0x3a3f4c), 0, 26.7, 0, cg);
      // спираль: светится тем ярче, чем больше мощность
      const pts = []; for (let k = 0; k <= 160; k++) { const a = k / 160 * Math.PI * 2 * 9; pts.push(v3(Math.cos(a) * 3.4, 4 + k / 160 * 10, Math.sin(a) * 3.4)); }
      const glow = Math.max(0, Math.min(1, Math.sqrt(d.P / 60)));
      const coilCol = d.run ? new T.Color(0x9aa3b2).lerp(new T.Color(0xff6a1a), 0.35 + 0.65 * glow) : new T.Color(0x9aa3b2);
      const coil = new T.Mesh(keep(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 400, 0.35, 6)), new T.MeshBasicMaterial({ color: coilCol }));
      at(coil, 0, 0, 0, cg);
      at(cyl(0.45, 14, STEEL, { edges: false }), -3.4, 21, 0, cg); at(cyl(0.45, 14, STEEL, { edges: false }), 3.4, 21, 0, cg);
      at(cyl(1.3, 2.4, 0xe0473a), -3.4, 28.6, 0, cg); at(cyl(1.3, 2.4, 0x26324a), 3.4, 28.6, 0, cg);
      if (d.run) { const h = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color: 0xff8a3c, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.25 + 0.5 * glow })); h.scale.setScalar(16); at(h, 0, 9, 0, cg); }
      // термометр: красный столбик по температуре
      at(cyl(0.9, 30, 0xeef6fb, { r2: 0.9 }), 6.5, 18, 3, cg);
      const col = Math.max(1, Math.min(24, (d.T - 0) / 100 * 24));
      at(cyl(0.45, col, 0xe0473a, { edges: false, hull: false }), 6.5, 4 + col / 2, 3.6, cg);
      at(new T.Mesh(keep(new T.SphereGeometry(1.4, 16, 12)), toon(0xe0473a)), 6.5, 3.2, 3, cg);
      cg.updateMatrixWorld(true);
      const tIn = v3(-3.4, 29.8, 0).applyMatrix4(cg.matrixWorld), tOut = v3(3.4, 29.8, 0).applyMatrix4(cg.matrixWorld);
      cable(sN.tout, aN.tin, WIRE_COL.plus, d.run ? d.I : 0);
      cable(aN.tout, tIn, WIRE_COL.mid, d.run ? d.I : 0, { lift: 8 });
      cable(tOut, sN.tin, WIRE_COL.minus, d.run ? d.I : 0, { lift: 8 });
      tag(v3(-34, 24, -14), 'Источник тока', d.Itxt);
      tag(v3(-6, 17, 22), 'Амперметр', d.Itxt);
      tag(v3(20, 30, -4), 'Спираль ' + d.R + ' Ом', d.run ? 'нагрев…' : d.Qtxt, d.run);
      tag(v3(44, 33, 4), 'Термометр', d.Ttxt);
    }
    const SCENES = { wire: sceneWire, power: scenePower, joule: sceneJoule };

    function layout(d) {
      clear();
      table();
      if (d.scene) { SCENES[d.scene](d); return; }
      const parts = [];
      // источник на заднем крае, «+» справа
      const src = d.source.type === 'supply' ? supply(d.source.U) : cells(d.source.n || 1, d.source.U);
      if (d.source.click) src.g.userData.click = d.source.click;
      const srcNode = placeOn(src, new T.Vector3(0, 0, B.z0 - 2), 0, 'src'); parts.push(srcNode);
      // путь: правый край (к зрителю), передний край (влево), левый край (назад)
      const edges = [
        { a: new T.Vector3(B.x1, 0, B.z0 + 10), b: new T.Vector3(B.x1, 0, B.z1 - 10), list: [] },
        { a: new T.Vector3(B.x1 - 10, 0, B.z1), b: new T.Vector3(B.x0 + 10, 0, B.z1), list: [] },
        { a: new T.Vector3(B.x0, 0, B.z1 - 10), b: new T.Vector3(B.x0, 0, B.z0 + 10), list: [] },
      ];
      const built = d.path.map(el => ({ el, part: el.type === 'par' ? null : BUILD[el.type](el) }));
      let ei = 0;
      for (const it of built) {
        const len = it.el.type === 'par' ? 84 : it.part.len;
        while (ei < edges.length) {
          const E = edges[ei], use = E.a.distanceTo(E.b) + 8, sum = E.list.reduce((s, x) => s + x.len + 6, 0);
          if (it.el.type === 'par' && E.list.length) { ei++; continue; }
          if (it.el.type === 'par' && ei !== 1) { ei++; continue; }
          if (sum + len <= use || !E.list.length && ei === edges.length - 1) { E.list.push({ ...it, len }); break; }
          ei++;
        }
      }
      const nodes = []; // точки цепи по порядку: [вход, выход] каждой детали
      edges.forEach(E => {
        if (!E.list.length) return;
        const dir = E.b.clone().sub(E.a).normalize(), tot = E.list.reduce((s, x) => s + x.len, 0), L = E.a.distanceTo(E.b);
        const gap = (L - tot) / (E.list.length + 1);
        let s = gap;
        E.list.forEach(x => {
          const c = E.a.clone().addScaledVector(dir, s + x.len / 2); s += x.len + gap;
          if (x.el.type === 'par') { nodes.push(...parBlock(x.el, c, dir, parts)); return; }
          const node = placeOn(x.part, c, Math.atan2(-dir.z, dir.x), x.el.id || x.el.type); node.el = x.el; parts.push(node);
          nodes.push([node.tin, node.tout, x.el.I]);
        });
      });
      // провода: + → детали → −
      const I = d.I || 0;
      let prev = srcNode.tout, k = 0;
      // провод идёт вдоль краёв стола: через углы контура между точками
      const CORN = [new T.Vector3(B.x1, 1.2, B.z0), new T.Vector3(B.x1, 1.2, B.z1), new T.Vector3(B.x0, 1.2, B.z1), new T.Vector3(B.x0, 1.2, B.z0)];
      const perim = p => {
        const W = B.x1 - B.x0, Hh = B.z1 - B.z0, dx1 = Math.abs(p.x - B.x1), dz1 = Math.abs(p.z - B.z1), dx0 = Math.abs(p.x - B.x0), dz0 = Math.abs(p.z - B.z0), m = Math.min(dx1, dz1, dx0, dz0);
        if (m === dz0 && p.x > 0) return (p.x - B.x1) / W;               // задний край справа от центра: перед первым углом
        if (m === dx1) return (p.z - B.z0) / Hh;                          // правый край
        if (m === dz1) return 1 + (B.x1 - p.x) / W;                       // передний край
        if (m === dx0) return 2 + (B.z1 - p.z) / Hh;                      // левый край
        return 3 + (p.x - B.x0) / W;                                      // задний край слева
      };
      const corner = (p, q) => { const a = perim(p), b = perim(q); return CORN.filter((c, i) => i > a - 0.02 && i < b + 0.02 && i >= 0).filter((c, i, arr) => true).filter(c => { const k = CORN.indexOf(c); return k > a && k < b; }); };
      for (const [a, b, Iel] of nodes) {
        const via = corner(prev, a);
        cable(prev, a, k === 0 ? WIRE_COL.plus : WIRE_COL.mid, Iel ?? I, via.length ? { via } : {});
        prev = b; k++;
      }
      { const via = corner(prev, srcNode.tin); cable(prev, srcNode.tin, WIRE_COL.minus, I, via.length ? { via } : {}); }
      // вольтметр/амперметр, подключённые щупами к точкам цепи
      (d.meters || []).forEach((m, i) => meterOnLeads(m, i, parts, srcNode));
      // подписи
      parts.forEach(p => { if (p.tag) tag(p.tagAt, p.tag[0], p.tag[1], p.hot); });
    }
    function placeOn(part, c, rotY, id) {
      const g = part.g; g.position.copy(c); g.rotation.y = rotY; root.add(g); g.updateMatrixWorld(true);
      if (g.userData.click) clickables.push(g);
      const tin = part.tin.clone().applyMatrix4(g.matrixWorld), tout = part.tout.clone().applyMatrix4(g.matrixWorld);
      return { id, g, tin, tout, tag: part.tag, hot: part.hot, tagAt: c.clone().setY(part.top + 3) };
    }
    // параллельные ветки: шины по краям блока, в каждой ветке свои детали
    function parBlock(el, c, dir, parts) {
      const n = el.branches.length, half = 40, step = n > 2 ? 20 : 24;
      const left = c.clone().addScaledVector(dir, -half), right = c.clone().addScaledVector(dir, half); // left — вход (ближе к «+»)
      const back = new T.Vector3(-dir.z, 0, dir.x); // внутрь стола
      if (back.z > 0) back.multiplyScalar(-1);
      const bIn = [], bOut = [];
      el.branches.forEach((br, k) => {
        const off = back.clone().multiplyScalar(k * step), a = left.clone().add(off), b = right.clone().add(off);
        const items = br.map(e => ({ e, p: BUILD[e.type]({ ...e, small: e.type === 'ammeter' || e.type === 'voltmeter' }) }));
        const tot = items.reduce((s, x) => s + x.p.len, 0), gap = (2 * half - 8 - tot) / (items.length + 1);
        let s = 4 + gap, prev = null, first = null;
        items.forEach(x => {
          const cc = a.clone().addScaledVector(dir, s + x.p.len / 2); s += x.p.len + gap;
          const node = placeOn(x.p, cc, Math.atan2(-dir.z, dir.x), x.e.id); parts.push(node);
          node.tag = x.e.type === 'switch' ? null : ['', x.e.value]; node.tagAt.y -= 2;
          if (!first) first = node.tin; if (prev) cable(prev, node.tin, WIRE_COL.mid, br.I ?? el.I?.[k] ?? 0, { lift: 2 });
          prev = node.tout;
        });
        const Ik = el.I ? el.I[k] : 0;
        const pa = a.clone().setY(1.6), pb = b.clone().setY(1.6);
        bIn.push(pa); bOut.push(pb);
        cable(pa, first, WIRE_COL.mid, Ik, { lift: 1 }); cable(prev, pb, WIRE_COL.mid, Ik, { lift: 1 });
        at(cyl(1.4, 1.2, BRASS), pa.x, 1.2, pa.z); at(cyl(1.4, 1.2, BRASS), pb.x, 1.2, pb.z);
      });
      // шины между ветками
      const sumFrom = k => (el.I || []).slice(k).reduce((s, v) => s + v, 0);
      for (let k = 0; k + 1 < n; k++) { cable(bIn[k], bIn[k + 1], WIRE_COL.mid, sumFrom(k + 1), { lift: 0.3 }); cable(bOut[k + 1], bOut[k], WIRE_COL.mid, sumFrom(k + 1), { lift: 0.3 }); }
      return [[bIn[0], bOut[0], (el.I || []).reduce((s, v) => s + v, 0)]];
    }
    // прибор перед столом с двумя проводами-щупами к точкам цепи (или лежит рядом, если не подключён)
    function meterOnLeads(m, i, parts, src) {
      const pt = ref => {
        if (!ref) return null;
        const [id, end] = ref.split('.'); const p = id === 'src' ? src : parts.find(q => q.id === id);
        return p ? (end === 'in' ? p.tin : p.tout) : null;
      };
      const A = pt(m.a), Bp = pt(m.b);
      const anchor = A && Bp ? A.clone().lerp(Bp, 0.5) : new T.Vector3(-18 + i * 30, 0, B.z1);
      const part = meter({ kind: m.kind, val: m.val, max: m.max, over: m.over, label: m.label, value: m.value, click: m.click });
      const c = new T.Vector3(Math.max(-56, Math.min(56, anchor.x - 32)), 0, 45);
      const node = placeOn(part, c, 0, 'm' + i); parts.push(node);
      const lead = (from, to, col) => {
        if (to) cable(from, to, col, 0, { r: 0.6, lift: 6, arch: 1 });
        else { const tip = from.clone().add(new T.Vector3(col === WIRE_COL.probeR ? -12 : 12, 0, -9)).setY(1.4); cable(from, tip, col, 0, { r: 0.6, lift: 4 }); at(cyl(0.9, 5, col, { seg: 12 }), tip.x, 1.4, tip.z).rotation.x = Math.PI / 2; }
      };
      lead(node.tin, A, WIRE_COL.probeR); lead(node.tout, Bp, WIRE_COL.probeB);
    }
    function tag(p, name, value, hot) {
      if (!name && !value) return;
      const el = document.createElement('div'); el.className = 'rl-lbl' + (hot ? ' hot' : '');
      el.innerHTML = `${name ? '<b></b>' : ''}${value ? '<i></i>' : ''}`; if (name) el.querySelector('b').textContent = name; if (value) el.querySelector('i').textContent = value;
      labels.appendChild(el); tags.push({ el, p });
    }
    function clear() {
      sc.remove(root); root = new T.Group(); sc.add(root);
      disposables.forEach(o => o.dispose && o.dispose()); disposables = [];
      clickables.length = 0; sleeves.length = 0; tags.length = 0; labels.innerHTML = '';
    }

    // ---------- камера: изометрия, тянуть — повернуть, колесо — ближе ----------
    let az = 0.62, el = 0.6, zoom = 1, W = 1, H = 1;
    const target = new T.Vector3(0, 4, 8);
    function aim() {
      const r = 300;
      cam.position.set(target.x + Math.sin(az) * Math.cos(el) * r, target.y + Math.sin(el) * r, target.z + Math.cos(az) * Math.cos(el) * r);
      cam.lookAt(target);
      cam.updateMatrixWorld();
      // вписываем стол; сверху оставляем место под рамку задания
      const pts = [[-70, 0, -46], [70, 0, -46], [-70, 0, 54], [70, 0, 54], [0, 26, -34]].map(p => new T.Vector3(...p).applyMatrix4(cam.matrixWorldInverse));
      const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
      const cw = Math.max(...xs) - Math.min(...xs), ch = Math.max(...ys) - Math.min(...ys);
      const narrow = W < 520, topPad = narrow ? 0.36 : H > 520 ? 0.2 : 0.12, availH = H * (1 - topPad - 0.06);
      const s = Math.min(W / cw * (narrow ? 1.12 : 1), availH / ch) * 0.94 * zoom;
      const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
      const hw = W / s / 2, hh = H / s / 2, shift = (H * (topPad - 0.06) / 2) / s;
      Object.assign(cam, { left: cx - hw, right: cx + hw, top: cy + hh + shift, bottom: cy - hh + shift });
      cam.updateProjectionMatrix();
    }
    function resize() {
      W = view.clientWidth || 1; H = view.clientHeight || 1;
      renderer.setSize(W, H, false); aim(); dirty = true;
    }
    let drag = null, dirty = true;
    const ray = new T.Raycaster(), ndc = new T.Vector2();
    const hit = e => {
      const r = view.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, cam);
      const h = ray.intersectObjects(clickables, true)[0]; if (!h) return null;
      let o = h.object; while (o && !o.userData.click) o = o.parent; return o;
    };
    view.addEventListener('pointerdown', e => {
      const o = hit(e);
      if (o) { const fn = window.LUCH_REAL.click; if (fn) fn(o.userData.click); setTimeout(() => R && R.update(desc()), 30); return; }
      drag = { x: e.clientX, y: e.clientY, az, el }; view.classList.add('grab');
      try { view.setPointerCapture(e.pointerId); } catch (er) {}
    });
    view.addEventListener('pointermove', e => {
      if (drag) { az = drag.az - (e.clientX - drag.x) * 0.006; el = Math.max(0.25, Math.min(1.25, drag.el + (e.clientY - drag.y) * 0.004)); az = Math.max(-0.4, Math.min(1.5, az)); aim(); dirty = true; return; }
      view.style.cursor = hit(e) ? 'pointer' : '';
    });
    const endDrag = () => { drag = null; view.classList.remove('grab'); };
    view.addEventListener('pointerup', endDrag); view.addEventListener('pointercancel', endDrag);
    view.addEventListener('wheel', e => { e.preventDefault(); zoom = Math.max(0.7, Math.min(2.6, zoom * (e.deltaY < 0 ? 1.1 : 0.9))); aim(); dirty = true; }, { passive: false });

    // ---------- цикл ----------
    let run = true, last = performance.now(), sig = '';
    const vTmp = new T.Vector3();
    function frame(t) {
      if (!run) return;
      requestAnimationFrame(frame);
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      if (!reduce) for (const s of sleeves) { s.tex.offset.x -= s.speed * dt; dirty = true; }
      if (!dirty || document.hidden) return;
      renderer.render(sc, cam); dirty = false;
      const r = view.getBoundingClientRect();
      for (const g of tags) { vTmp.copy(g.p).project(cam); g.el.style.transform = `translate(${((vTmp.x + 1) / 2 * r.width).toFixed(1)}px,${((1 - vTmp.y) / 2 * r.height).toFixed(1)}px) translate(-50%,-100%)`; }
    }
    resize(); requestAnimationFrame(frame);
    return {
      update(d) {
        if (!d) return;
        const s = JSON.stringify(d); if (s === sig) return; sig = s;
        help.textContent = (d.help || 'Нажимайте на ключ') + ' · тяните — повернуть · колесо — ближе';
        layout(d); dirty = true;
      },
      pause() { run = false; },
      resume() { if (!run) { run = true; last = performance.now(); dirty = true; requestAnimationFrame(frame); } },
      resize,
    };
  }
  function fmtU(U) { return (Math.round(U * 10) / 10).toFixed(1).replace('.', ',') + ' В'; }
})();
