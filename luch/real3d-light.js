// «Как в жизни» для темы «Свет и тени» (labs/phys-light): предметы и ящики «источник / не источник» с выключателем света;
// оптическая скамья с лампой, тремя экранами с отверстиями и глазом; лампа (точечная или матовая), диск и экран с тенью;
// настольная модель Солнце (лампа) — Земля (глобус) — Луна (шарик на проволоке) с тенями и затмениями.
// Сцены строятся из window.LUCH_REAL() опыта; набор деталей kit — из /luch/real3d.js.
(() => {
  const SC = (window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {});
  const RAD = Math.PI / 180;
  const Y0 = 0.4; // верх тёмного сукна на столе
  const YEL = 0xffd54a, ORANGE = 0xffb547, PAPER = 0xf4efe2, CARD = 0xb08d5a, CARD_SEL = 0xdcae68, RAIL = 0x3b4a66;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const f = (x, d = 1) => { let s = (Math.round(x * 10 ** d) / 10 ** d).toFixed(d); if (/^-0(\.0+)?$/.test(s)) s = s.slice(1); return s.replace(/\.0+$/, '').replace('.', ',').replace('-', '−'); };

  // ---------- свет в комнате: «Темнота» гасит общий свет, остаются только источники ----------
  const LIGHT0 = new WeakMap();
  function room(kit, k) {
    const sc = kit.root.parent; if (!sc) return;
    sc.children.forEach(o => {
      if (!(o.isHemisphereLight || o.isDirectionalLight)) return;
      if (!LIGHT0.has(o)) LIGHT0.set(o, o.intensity);
      o.intensity = LIGHT0.get(o) * k;
    });
  }

  // ---------- текстуры (общие, живут всю сессию) ----------
  const texC = {};
  function labelTex(T, txt, col, w = 256, h = 96, bg) {
    const key = txt + col + w + 'x' + h + (bg || ''); if (texC[key]) return texC[key];
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
    let fs = Math.round(h * 0.68); x.font = `700 ${fs}px "Golos Text", sans-serif`;
    const tw = x.measureText(txt).width; if (tw > w * 0.9) { fs = Math.floor(fs * w * 0.9 / tw); x.font = `700 ${fs}px "Golos Text", sans-serif`; }
    x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, w / 2, h / 2 + 2);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; texC[key] = t; return t;
  }
  function flatLabel(kit, txt, col, w, h, flat, bg) {
    const { T, keep } = kit;
    const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: labelTex(T, txt, col, Math.round(96 * w / h), 96, bg), transparent: !bg, depthWrite: !!bg })));
    if (flat) m.rotation.x = -Math.PI / 2;
    return m;
  }
  // глобус: океан, материки, шапки льда (равнопромежуточная развёртка)
  function earthTex(T) {
    if (texC.earth) return texC.earth;
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d');
    x.fillStyle = '#2f7fd0'; x.fillRect(0, 0, 512, 256);
    const land = [[80, 70, 50, 34, '#4fae5a'], [120, 120, 26, 40, '#5bb35a'], [150, 175, 24, 40, '#7cbf55'], [262, 78, 30, 22, '#5bb35a'],
      [270, 135, 30, 48, '#c9a95a'], [345, 70, 80, 34, '#5bb35a'], [380, 112, 40, 22, '#7cbf55'], [430, 175, 26, 16, '#c9a95a'], [212, 60, 14, 10, '#5bb35a']];
    land.forEach(([cx, cy, rx, ry, col]) => { x.fillStyle = col; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0.3, 0, 7); x.fill(); x.beginPath(); x.ellipse(cx + rx * 0.5, cy + ry * 0.4, rx * 0.6, ry * 0.5, -0.4, 0, 7); x.fill(); });
    x.fillStyle = '#eef6ff'; x.fillRect(0, 0, 512, 14); x.fillRect(0, 240, 512, 16);
    x.fillStyle = 'rgba(255,255,255,.55)';
    [[60, 150, 30, 5], [200, 100, 40, 6], [320, 190, 36, 5], [450, 90, 30, 5], [110, 40, 26, 4]].forEach(([cx, cy, rx, ry]) => { x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, 7); x.fill(); });
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; texC.earth = t; return t;
  }

  // ---------- общие детали ----------
  function felt(kit) { kit.at(kit.box(126, Y0, 90, 0x2a2f3a, { edges: false }), 0, Y0 / 2, 3); }
  // стержень между двумя точками
  function rod(kit, a, b, r, col, o = {}) {
    const { T, cyl } = kit; const d = b.clone().sub(a), L = d.length(); if (L < 0.01) return null;
    const m = cyl(r, L, col, { edges: false, hull: r >= 0.5, ...o });
    m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
    kit.root.add(m); return m;
  }
  // светлая линия (луч, нить) без теней и контура
  function line3(kit, a, b, col, r, op = 1, add) {
    const { T, keep } = kit; const d = b.clone().sub(a), L = d.length(); if (L < 0.05) return null;
    const m = new T.Mesh(keep(new T.CylinderGeometry(r, r, L, 8, 1, true)), keep(new T.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending })));
    m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); m.renderOrder = 3;
    kit.root.add(m); return m;
  }
  // конус (усечённый) вдоль отрезка a→b: радиус ra у a, rb у b — пучок света, область тени
  function cone(kit, a, b, ra, rb, col, op, add) {
    const { T, keep } = kit; const d = b.clone().sub(a), L = d.length(); if (L < 0.05) return null;
    const m = new T.Mesh(keep(new T.CylinderGeometry(Math.max(0.001, rb), Math.max(0.001, ra), L, 40, 1, true)),
      keep(new T.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, side: T.DoubleSide, blending: add ? T.AdditiveBlending : T.NormalBlending })));
    m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); m.renderOrder = 2;
    kit.root.add(m); return m;
  }
  // луч: яркая сердцевина, мягкое свечение и бегущие огоньки (направление хода света)
  function beam(kit, a, b, k, o = {}) {
    const { T, keep } = kit;
    const d = b.clone().sub(a), L = d.length(); if (L < 0.05 || k < 0.03) return 0;
    const dn = d.clone().normalize(), q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dn), mid = a.clone().addScaledVector(d, 0.5);
    const base = o.col ?? YEL, r = o.r || 0.3, gr = o.gr || 1.1;
    const core = new T.Mesh(keep(new T.CylinderGeometry(r, r, L, 8, 1, true)), keep(new T.MeshBasicMaterial({ color: o.hot ?? 0xfff4c2, transparent: true, opacity: 0.9 * k, depthWrite: false })));
    const glow = new T.Mesh(keep(new T.CylinderGeometry(gr, gr, L, 12, 1, true)), keep(new T.MeshBasicMaterial({ color: base, transparent: true, opacity: 0.32 * k, blending: T.AdditiveBlending, depthWrite: false })));
    [core, glow].forEach(m => { m.quaternion.copy(q); m.position.copy(mid); m.renderOrder = 3; kit.root.add(m); });
    if (!kit.reduce && o.photons !== false) {
      const SP = o.sp || 7, V = o.v || 18, n = Math.ceil(L / SP) + 1, sps = [];
      const pm = keep(new T.SpriteMaterial({ map: kit.glowTex(), color: o.pcol ?? 0xffe27a, transparent: true, opacity: 0.95 * k, blending: T.AdditiveBlending, depthWrite: false }));
      for (let i = 0; i < n; i++) { const s = new T.Sprite(pm); s.scale.setScalar(o.ps || 2.2); s.renderOrder = 4; kit.root.add(s); sps.push(s); }
      const place = t => { const ph = (t * V % SP + SP) % SP; sps.forEach((s, i) => { const u = ph + i * SP; s.visible = u < L; if (s.visible) s.position.copy(a).addScaledVector(dn, u); }); };
      place(0); kit.onFrame((dt, t) => place(t));
    }
    return L;
  }
  // светящееся пятно
  function spot(kit, p, size, col = 0xffe9a0, op = 1, pulse) {
    const { T, keep } = kit;
    const s = new T.Sprite(keep(new T.SpriteMaterial({ map: kit.glowTex(), color: col, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false })));
    s.scale.setScalar(size); s.position.copy(p); s.renderOrder = 5; kit.root.add(s);
    if (pulse && !kit.reduce) kit.onFrame((dt, t) => s.scale.setScalar(size * (1 + 0.1 * Math.sin(t * 5))));
    return s;
  }
  // линейка оптической скамьи: штрихи каждый сантиметр, числа — через step
  function ruler(kit, X, cm0, cm1, step, y, z) {
    const { at, box } = kit;
    at(box(X(cm1) - X(cm0) + 3, 0.12, 2.6, 0xf1e3c2, { edges: false }), (X(cm0) + X(cm1)) / 2, y, z);
    for (let c = cm0; c <= cm1; c++) at(box(0.16, 0.05, c % step ? 0.7 : 1.4, 0x3a2e22, { edges: false, shadow: false }), X(c), y + 0.08, z - 1.3 + (c % step ? 0.35 : 0.7));
    for (let c = cm0; c <= cm1; c += step) { const lb = flatLabel(kit, String(c), '#3a2e22', 2.6, 1.3, true); at(lb, X(c), y + 0.1, z + 0.6); }
  }
  // плоская стрелка-кнопка (конус) в группе g, смотрит по dir ('up' | 'down' | 'left' | 'right')
  function arrowBtn(kit, g, x, y, z, dir, key) {
    const { T, at, cyl, clickable } = kit;
    const a = new T.Group(); at(a, x, y, z, g);
    const c = cyl(1.3, 2.4, ORANGE, { r2: 0, seg: 16 });
    if (dir === 'down') c.rotation.z = Math.PI; if (dir === 'left') c.rotation.z = Math.PI / 2; if (dir === 'right') c.rotation.z = -Math.PI / 2;
    a.add(c); clickable(a, key);
    if (!kit.reduce) { const p0 = a.position.clone(), v = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] }[dir]; kit.onFrame((dt, t) => { const s = 0.35 * Math.sin(t * 4); a.position.set(p0.x + v[0] * s, p0.y + v[1] * s, p0.z); }); }
    return a;
  }
  // лампочка на стойке: точечная (прозрачная колба с нитью) или матовая (молочный шар диаметра D)
  function lampHead(kit, x, y, z, D, k, key) {
    const { T, at, cyl, mesh, keep, clickable } = kit;
    const g = new T.Group(); at(g, x, y, z);
    const r = D > 0 ? Math.max(0.8, D / 2 * k) : 1.7;
    at(cyl(1.25, 2.2, kit.C.DARK), 0, -r - 1.5, 0, g);
    at(cyl(1.0, 1.4, kit.C.STEEL, { seg: 18 }), 0, -r - 0.1, 0, g);
    if (D > 0) {
      at(mesh(new T.SphereGeometry(r, 36, 24), 0xfff6dc, { hull: true, edges: false, matOpt: { emissive: 0xffe2a0, emissiveIntensity: 0.95 } }), 0, 0, 0, g);
    } else {
      const glass = new T.Mesh(keep(new T.SphereGeometry(r, 28, 20)), keep(new T.MeshBasicMaterial({ color: 0xfff7d6, transparent: true, opacity: 0.35, depthWrite: false })));
      glass.add(new T.Mesh(glass.geometry, kit.hullMat)); at(glass, 0, 0, 0, g);
      at(new T.Mesh(keep(new T.SphereGeometry(0.42, 12, 10)), keep(new T.MeshBasicMaterial({ color: 0xffffff }))), 0, 0, 0, g);
    }
    const halo = new T.Sprite(keep(new T.SpriteMaterial({ map: kit.glowTex(), color: 0xffd98a, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false })));
    halo.scale.setScalar(D > 0 ? r * 4 + 6 : 11); g.add(halo);
    const L = new T.PointLight(0xffd88a, 40, 90, 1.2); g.add(L);
    if (key) clickable(g, key);
    return { g, r };
  }

  // =====================================================================================
  // 1. Источники света: девять предметов на подставках, три ящика, выключатель света
  const ITEMS = { moon: 'Луна', lamp: 'Лампочка', fly: 'Светлячок', mirror: 'Зеркало', sun: 'Солнце', phone: 'Телефон', refl: 'Катафот', bolt: 'Молния', led: 'Светодиод' };
  const ORDER = Object.keys(ITEMS);
  const BINS = [['nat', 'Естественные', 'ЕСТЕСТВЕННЫЕ', 0x4fbf78], ['art', 'Искусственные', 'ИСКУССТВЕННЫЕ', 0x3fb6d6], ['none', 'Не источники', 'НЕ ИСТОЧНИКИ', 0x8b96ad]];
  // модели предметов: строятся в группе g от y = 0 вверх, высота около 12
  const glowMat = (kit, col, op = 1) => kit.keep(new kit.T.MeshBasicMaterial({ color: col, transparent: op < 1, opacity: op }));
  const halo = (kit, g, y, col, s, op = 0.85) => { const { T, keep } = kit; const h = new T.Sprite(keep(new T.SpriteMaterial({ map: kit.glowTex(), color: col, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false }))); h.scale.setScalar(s); h.position.y = y; g.add(h); return h; };
  const plight = (kit, g, y, col, I = 7) => { const L = new kit.T.PointLight(col, I, 16, 1.6); L.position.y = y; g.add(L); return L; };
  const MODEL = {
    moon(kit, g) {
      const { T, at, cyl, mesh, C } = kit;
      at(cyl(0.45, 4, C.STEEL, { edges: false }), 0, 2, 0, g);
      at(mesh(new T.SphereGeometry(4.2, 32, 22), 0xc8ccd4, { hull: true, edges: false }), 0, 8, 0, g);
      [[-1.6, 9.4, 3.5, 1], [1.8, 7, 3.6, 1.2], [1.5, 10.6, 2.6, 0.7], [-2.6, 6.8, 2.8, 0.8]].forEach(([x, y, z, r]) => {
        const c = mesh(new T.SphereGeometry(r, 16, 10), 0x9ea4b0, { edges: false }); c.scale.z = 0.35; at(c, x, y, z, g);
      });
    },
    lamp(kit, g) {
      const { T, at, cyl, keep, C } = kit;
      at(cyl(2, 2.4, C.DARK), 0, 1.2, 0, g);
      at(cyl(1.5, 2.4, C.STEEL, { seg: 18 }), 0, 3.6, 0, g);
      for (let i = 0; i < 3; i++) at(cyl(1.6, 0.3, 0x9aa3b2, { edges: false, hull: false }), 0, 2.8 + i * 0.7, 0, g);
      const gl = new T.Mesh(keep(new T.SphereGeometry(3.6, 32, 22)), new T.MeshToonMaterial({ color: 0xfff1b8, gradientMap: kit.grad, transparent: true, opacity: 0.92, emissive: 0xffc23a, emissiveIntensity: 0.9 }));
      keep(gl.material); gl.add(new T.Mesh(gl.geometry, kit.hullMat)); at(gl, 0, 8.2, 0, g);
      const pts = []; for (let k = 0; k <= 8; k++) pts.push(new T.Vector3(-1.6 + k * 0.4, 0.8 + (k % 2 ? 0.6 : 0), 0));
      at(new T.Mesh(keep(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(-1.2, -2.6, 0), ...pts, new T.Vector3(1.2, -2.6, 0)]), 40, 0.14, 6)), glowMat(kit, 0xffffff)), 0, 8.2, 0, g);
      halo(kit, g, 8.2, 0xffd27a, 18); plight(kit, g, 8.2, 0xffc860);
    },
    fly(kit, g) {
      const { T, at, cyl, mesh, keep } = kit;
      at(cyl(3.5, 0.6, 0x9fb6cf, { edges: false }), 0, 0.3, 0, g);
      const jar = at(cyl(3.4, 8, 0xcfe6f2, { edges: false, hull: false, shadow: false, matOpt: { transparent: true, opacity: 0.22, depthWrite: false } }), 0, 4.6, 0, g); jar.renderOrder = 1;
      at(cyl(3.6, 1.2, 0xd8b04a), 0, 9.2, 0, g);
      const bug = new T.Group(); at(bug, 0, 4.8, 0, g);
      const body = mesh(new T.SphereGeometry(0.9, 16, 12), 0x3a3328, { edges: false }); body.scale.set(1.7, 0.85, 0.85); at(body, -0.6, 0, 0, bug);
      at(mesh(new T.SphereGeometry(0.6, 12, 10), 0xd0563a, { edges: false }), -2.1, 0.1, 0, bug);
      [-0.7, 0.7].forEach(z => { const w = new T.Mesh(keep(new T.CircleGeometry(1.2, 16)), glowMat(kit, 0xdfe8ef, 0.55)); w.scale.set(1.5, 0.6, 1); w.rotation.x = -Math.PI / 2 + z * 0.6; at(w, -0.8, 0.9, z, bug); });
      const tail = new T.Mesh(keep(new T.SphereGeometry(0.85, 16, 12)), glowMat(kit, 0xdcff7a)); at(tail, 1.1, -0.1, 0, bug);
      const h = halo(kit, bug, 0, 0xc8ff5a, 8); h.position.x = 1.1;
      if (!kit.reduce) kit.onFrame((dt, t) => { const k = 0.55 + 0.45 * Math.max(0, Math.sin(t * 2.6)); h.material.opacity = 0.9 * k; tail.scale.setScalar(0.85 + 0.2 * k); bug.position.y = 4.8 + 0.4 * Math.sin(t * 1.3); });
    },
    mirror(kit, g) {
      const { T, at, box, cyl, C } = kit;
      at(box(5, 1, 4, C.WOOD2), 0, 0.5, 0, g);
      at(box(1.1, 4.6, 0.8, C.WOOD), 0, 3, 0, g);
      const fr = cyl(4.4, 0.8, C.WOOD, { seg: 36 }); fr.rotation.x = Math.PI / 2; at(fr, 0, 9.4, 0, g);
      const gl = cyl(3.8, 0.9, 0xd6ecfa, { seg: 36, edges: false, hull: false }); gl.rotation.x = Math.PI / 2; at(gl, 0, 9.4, 0.05, g);
      at(box(0.4, 3.4, 0.1, 0xffffff, { edges: false, shadow: false }), -1.2, 10, 0.55, g).rotation.z = -0.6;
    },
    sun(kit, g) {
      const { T, at, cyl, mesh, C } = kit;
      at(cyl(0.45, 3.8, C.STEEL, { edges: false }), 0, 1.9, 0, g);
      at(mesh(new T.SphereGeometry(4.2, 32, 22), 0xffcf4a, { hull: true, edges: false, matOpt: { emissive: 0xff9f2e, emissiveIntensity: 0.9 } }), 0, 8.4, 0, g);
      const rays = new T.Group(); at(rays, 0, 8.4, 0, g);
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, r = cyl(0.6, 1.8, 0xffd54a, { r2: 0, seg: 10, edges: false, hull: false, matOpt: { emissive: 0xffb02e, emissiveIntensity: 1 } }); r.position.set(Math.cos(a) * 5.4, Math.sin(a) * 5.4, 0); r.rotation.z = a - Math.PI / 2; rays.add(r); }
      halo(kit, g, 8.4, 0xffb347, 22); plight(kit, g, 8.4, 0xffb050);
      if (!kit.reduce) kit.onFrame((dt, t) => { rays.rotation.z = t * 0.3; });
    },
    phone(kit, g) {
      const { T, at, box, keep, C } = kit;
      at(box(6, 1.2, 4, 0x3b4a66), 0, 0.6, 0, g);
      const ph = new T.Group(); at(ph, 0, 1.2, -0.4, g); ph.rotation.x = -0.22;
      at(box(5.6, 10, 0.7, 0x2b2f3a), 0, 5, 0, ph);
      const scr = new T.Mesh(keep(new T.PlaneGeometry(4.8, 8.6)), glowMat(kit, 0x7fc4ff)); at(scr, 0, 5.2, 0.37, ph);
      [[7.6, 3.4], [6.6, 2.4], [5.6, 3.2], [4.2, 3.4], [3.2, 2.2]].forEach(([y, w]) => { const b = new T.Mesh(keep(new T.PlaneGeometry(w, 0.5)), glowMat(kit, 0xe8f6ff)); at(b, -1.8 + w / 2, y, 0.38, ph); });
      at(box(1.6, 0.25, 0.1, 0x111418, { edges: false }), 0, 9.6, 0.36, ph);
      halo(kit, g, 6.4, 0x7fc4ff, 13, 0.6); plight(kit, g, 6.4, 0x9fd4ff, 5);
    },
    refl(kit, g) {
      const { T, at, box, cyl, C } = kit;
      at(box(5, 1, 4, C.DARK), 0, 0.5, 0, g);
      at(cyl(0.45, 5, C.STEEL, { edges: false }), 0, 3.4, 0, g);
      const d = cyl(4.2, 0.9, 0xc8402e, { seg: 36 }); d.rotation.x = Math.PI / 2; at(d, 0, 9.4, 0, g);
      const h = cyl(2.6, 1, 0xe25a44, { seg: 6 }); h.rotation.x = Math.PI / 2; at(h, 0, 9.4, 0.1, g);
      const h2 = cyl(1.2, 1.1, 0xff8a73, { seg: 6, edges: false }); h2.rotation.x = Math.PI / 2; at(h2, 0, 9.4, 0.15, g);
    },
    bolt(kit, g) {
      const { T, at, cyl, mesh, keep, C } = kit;
      at(cyl(0.4, 9, C.STEEL, { edges: false }), 0, 4.5, -2, g);
      [[-2.4, 11.6, 2.6], [0.6, 12.6, 3.2], [3.2, 11.4, 2.4], [0.4, 10.6, 2.6]].forEach(([x, y, r]) => at(mesh(new T.SphereGeometry(r, 18, 12), 0x6b7590, { hull: true, edges: false }), x, y, -1.2, g));
      const zig = [[0.2, 9.4], [-1.2, 6.6], [0.6, 6.4], [-0.8, 3.2], [0.8, 3.4], [-0.4, 0.6]].map(([x, y]) => new T.Vector3(x, y, 0.6));
      const bolt = new T.Mesh(keep(new T.TubeGeometry(new T.CatmullRomCurve3(zig, false, 'catmullrom', 0.05), 40, 0.32, 6)), glowMat(kit, 0xfff4a0)); g.add(bolt);
      const h = halo(kit, g, 5, 0xfff0a0, 14);
      if (!kit.reduce) kit.onFrame((dt, t) => { const ph = t % 2.2, on = ph < 0.12 || (ph > 0.2 && ph < 0.32) || ph > 0.5; bolt.visible = on; h.material.opacity = on ? 0.85 : 0.15; });
    },
    led(kit, g) {
      const { T, at, box, cyl, mesh, C } = kit;
      at(box(7, 0.8, 5, 0x2f7d4a), 0, 0.4, 0, g);
      for (let i = -2; i <= 2; i++) at(box(0.4, 0.06, 0.4, 0xd8b04a, { edges: false, shadow: false }), i * 1.3, 0.83, 1.6, g);
      [-0.6, 0.6].forEach(x => at(cyl(0.15, 3.4, C.STEEL, { edges: false, hull: false }), x, 2.4, 0, g));
      at(cyl(1.8, 0.4, 0xdff4ff, { edges: false, matOpt: { emissive: 0x9fe6ff, emissiveIntensity: 0.6 } }), 0, 4.2, 0, g);
      at(cyl(1.5, 2.6, 0xeafaff, { edges: false, matOpt: { emissive: 0xbff0ff, emissiveIntensity: 1, transparent: true, opacity: 0.9 } }), 0, 5.6, 0, g);
      at(mesh(new T.SphereGeometry(1.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0xeafaff, { edges: false, hull: true, matOpt: { emissive: 0xbff0ff, emissiveIntensity: 1 } }), 0, 6.9, 0, g);
      halo(kit, g, 6, 0xbfeaff, 12); plight(kit, g, 6, 0xcfefff, 6);
    },
  };
  SC['light-src'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, v3, C } = kit;
    room(kit, d.dark ? 0.035 : 1);
    const sorted = d.sorted || {}, left = ORDER.filter(k => !sorted[k]);
    const SLOT = i => i < 5 ? [-48 + i * 24, -27] : [-36 + (i - 5) * 24, -5];
    // предметы на подставках с табличками
    ORDER.forEach((k, i) => {
      if (sorted[k]) return;
      const [x, z] = SLOT(i), sel = d.sel === k;
      const g = new T.Group(); at(g, x, 0, z);
      at(cyl(6.6, 1.4, C.WOOD2), 0, 0.7, 0, g);
      // табличка с названием повёрнута к зрителю
      const pg = new T.Group(); at(pg, Math.sin(0.62) * 7.6, 0, Math.cos(0.62) * 7.6, g); pg.rotation.y = 0.62;
      const pl = at(box(11.4, 3, 0.5, PAPER), 0, 1.9, 0, pg); pl.rotation.x = -0.4;
      const lb = flatLabel(kit, ITEMS[k], '#1b1610', 10.6, 2.5); lb.position.set(0, 1.98, 0.27); lb.rotation.x = -0.4; pg.add(lb);
      const m = new T.Group(); m.scale.setScalar(1.3); at(m, 0, 1.4, 0, g); MODEL[k](kit, m);
      clickable(g, 'choose:' + k);
      if (sel) {
        const ring = mesh(new T.TorusGeometry(7.8, 0.45, 8, 40), ORANGE, { edges: false, matOpt: { emissive: ORANGE, emissiveIntensity: 0.6 } }); ring.rotation.x = Math.PI / 2; at(ring, 0, 0.5, 0, g);
        if (!kit.reduce) kit.onFrame((dt, t) => { m.position.y = 2.2 + 0.9 * Math.sin(t * 3); ring.scale.setScalar(1 + 0.05 * Math.sin(t * 6)); });
        else m.position.y = 2.6;
        tag(v3(x, 22, z), ITEMS[k], 'теперь — в ящик', true);
      }
    });
    // ящики с подписями, внутри — разложенные предметы
    BINS.forEach(([b, name, cap, col], i) => {
      const x = -40 + i * 40, z = 28, w = 34, dp = 18, g = new T.Group(); at(g, x, 0, z);
      at(box(w, 1, dp, C.WOOD2), 0, 0.5, 0, g);
      at(box(w, 4, 1, C.WOOD), 0, 2.5, -dp / 2 + 0.5, g); at(box(1, 4, dp, C.WOOD), -w / 2 + 0.5, 2.5, 0, g); at(box(1, 4, dp, C.WOOD), w / 2 - 0.5, 2.5, 0, g);
      at(box(w, 4, 1, col), 0, 2.5, dp / 2 - 0.5, g);
      const lb = flatLabel(kit, cap, '#ffffff', 24, 2.6); at(lb, 0, 2.5, dp / 2 + 0.03, g);
      clickable(g, 'bin:' + b);
      const inside = ORDER.filter(k => sorted[k] === b);
      inside.forEach((k, j) => { const m = new T.Group(); m.scale.setScalar(0.62); at(m, -10 + j * 10, 1, -0.5, g); MODEL[k](kit, m); clickable(m, 'pick:' + k); });
      tag(v3(x, 9, z - 4), name, `${inside.length}/3`, inside.length === 3);
    });
    // выключатель света на подставке
    const sw = new T.Group(); at(sw, 54, 0, 4); sw.rotation.y = -0.3;
    at(box(8, 1, 5, C.WOOD2), 0, 0.5, 0, sw);
    at(box(7, 10, 1.4, PAPER), 0, 6, 0, sw);
    at(box(3, 4.6, 0.6, 0xdcd6c8), 0, 6.4, 0.9, sw);
    const key = at(box(2, 2.6, 1, d.dark ? 0x2c3240 : 0xffffff), 0, 6.4 + (d.dark ? -0.8 : 0.8), 1.4, sw); key.rotation.x = d.dark ? 0.35 : -0.35;
    const lb = flatLabel(kit, d.dark ? 'ВЫКЛ' : 'ВКЛ', '#1b1610', 5, 1.6); at(lb, 0, 2.6, 0.72, sw);
    clickable(sw, 'dark');
    tag(v3(54, 15, 4), 'Свет в комнате', d.dark ? 'выключен' : 'включён');
    if (!left.length) tag(v3(0, 6, -14), 'Все 9 разложены', '✓', true);
  };

  // =====================================================================================
  // 2. Свет идёт по прямой: оптическая скамья — лампа, три экрана с отверстиями 1 см, глаз
  SC['light-line'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, v3, C } = kit;
    room(kit, 0.85); felt(kit);
    // свет идёт справа налево (−x): освещённые стороны экранов и зрачок смотрят на зрителя
    const k = 1.6, zc = 14, X = cm => 35.2 - cm * k, Y = cm => Y0 + cm * k, rT = Y0 + 1.8;
    const xs = [11, 22, 33], hw = 0.5, pup = 0.4, xe = 44;
    // скамья с линейкой
    at(box(88, 1.8, 7, RAIL), 0, Y0 + 0.9, zc);
    ruler(kit, X, 0, 44, 11, rT + 0.02, zc + 5.2);
    at(box(88, 0.6, 1.2, 0x2c3240), 0, rT, zc - 3);
    // лампа на стойке
    const yl = Y(d.ly), xl = X(0);
    at(box(5, 2, 8, C.DARK), xl, rT + 1, zc);
    rod(kit, v3(xl, rT + 2, zc), v3(xl, yl - 4.4, zc), 0.55, C.STEEL, { hull: true });
    lampHead(kit, xl, yl, zc, 0, k);
    // катушка с нитью у лампы
    const sp = new T.Group(); at(sp, xl - 1, 0, zc + 10);
    at(cyl(1.4, 3, 0xf1e6cf), 0, Y0 + 1.5, 0, sp); at(cyl(2, 0.5, C.WOOD), 0, Y0 + 0.25, 0, sp); at(cyl(2, 0.5, C.WOOD), 0, Y0 + 2.75, 0, sp);
    clickable(sp, 'thread');
    // прямая лампа→глаз через отверстия: тот же расчёт, что в опыте (в сантиметрах, вверх — плюс)
    let lo = -0.7, hi = 0.7, passed = 0, block = -1, bandAt = [];
    for (let i = 0; i < 3; i++) {
      const dx = xs[i];
      bandAt.push([d.ly + lo * dx, d.ly + hi * dx]);
      const a = (d.holes[i] - hw - d.ly) / dx, b = (d.holes[i] + hw - d.ly) / dx;
      const nlo = Math.max(lo, a), nhi = Math.min(hi, b);
      if (nlo >= nhi) { block = i; break; }
      lo = nlo; hi = nhi; passed++;
    }
    const ye = d.ye, sees = d.sees;
    // экраны: картонные доски с отверстием, вставлены в держатели на скамье
    const cw = 10 * k;
    xs.forEach((cm, i) => {
      const x = X(cm), hy = Y(d.holes[i]), top = hy + 9 * k, bot = rT + 1.4, sel = d.sel === i;
      at(box(5, 2.6, 9, C.DARK), x, rT + 1.3, zc);
      at(box(1.4, 0.4, 9, 0x1b1f28, { edges: false }), x, rT + 2.62, zc);
      const g = new T.Group(); at(g, x, hy, zc);
      const sh = new T.Shape(); sh.moveTo(-cw / 2, bot - hy); sh.lineTo(cw / 2, bot - hy); sh.lineTo(cw / 2, top - hy); sh.lineTo(-cw / 2, top - hy); sh.closePath();
      const hole = new T.Path(); hole.absarc(0, 0, hw * k, 0, Math.PI * 2, true); sh.holes.push(hole);
      const geo = new T.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: false, curveSegments: 24 }); geo.translate(0, 0, -0.25);
      const card = mesh(geo, sel ? CARD_SEL : CARD, { edgeAngle: 30 }); card.rotation.y = Math.PI / 2; g.add(card);
      // обод отверстия
      const rim = mesh(new T.TorusGeometry(hw * k + 0.15, 0.16, 6, 24), 0x6b5434, { edges: false }); rim.rotation.y = Math.PI / 2; at(rim, 0.3, 0, 0, g);
      clickable(g, 'sel' + i);
      if (sel) {
        [[top - hy - 0.4, 0], [bot - hy + 0.4, 0]].forEach(([y]) => at(box(0.7, 0.5, cw + 0.4, ORANGE, { edges: false }), 0, y, 0, g));
        const zb = cw / 2 + 2.4;
        at(box(0.8, 9.4, 1.2, C.DARK), 0, 0, cw / 2 + 0.6, g);
        arrowBtn(kit, g, 0, 3.4, zb, 'up', 'up5');
        arrowBtn(kit, g, 0, -3.4, zb, 'down', 'dn5');
        at(box(0.8, 0.8, 2.4, C.DARK), 0, 3.4 - 1.4, cw / 2 + 1.2, g); at(box(0.8, 0.8, 2.4, C.DARK), 0, -3.4 + 1.4, cw / 2 + 1.2, g);
        tag(v3(x, top + 2, zc), `Экран ${i + 1}`, `отверстие ${f(d.holes[i])} см`, passed > i);
      }
      // где на этот экран падает свет
      if (i === 0) {
        const lit = new T.Mesh(keep(new T.PlaneGeometry(cw, Math.min(top, Y(d.ly) + 12) - Math.max(rT + 2.6, Y(d.ly) - 12))), keep(new T.MeshBasicMaterial({ color: 0xffe49a, transparent: true, opacity: 0.16, blending: T.AdditiveBlending, depthWrite: false })));
        lit.rotation.y = Math.PI / 2; at(lit, x + 0.3, (Math.min(top, Y(d.ly) + 12) + Math.max(rT + 2.6, Y(d.ly) - 12)) / 2, zc); lit.renderOrder = 3;
      } else if (i <= passed && bandAt[i]) {
        const [b1, b2] = bandAt[i], yc = Y((b1 + b2) / 2);
        if (yc > rT + 2.6 && yc < top) {
          const hh = Math.max(0.9, (b2 - b1) * k);
          const band = new T.Mesh(keep(new T.PlaneGeometry(hh * 0.9, hh)), keep(new T.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.85, depthWrite: false })));
          band.rotation.y = Math.PI / 2; at(band, x + 0.3, yc, zc); band.renderOrder = 3;
          spot(kit, v3(x + 0.5, yc, zc), hh + 3.5, 0xffe27a, 0.9, block === i);
        }
      }
    });
    // свет: широкий конус от лампы до первого экрана, дальше — узкий луч по прямой через пройденные отверстия
    cone(kit, v3(xl - 1.6, yl, zc), v3(X(11) + 0.4, yl, zc), 1.2, 11, 0xffe49a, 0.07, true);
    if (passed > 0) {
      const mid = (lo + hi) / 2, endCm = passed < 3 ? xs[passed] : sees ? xe - 0.4 : xe + 6;
      const w = Math.max(0.12, (hi - lo) * 20 * k / 2);
      beam(kit, v3(xl, yl, zc), v3(X(endCm) + (passed < 3 ? 0.4 : 0), Y(d.ly + mid * endCm), zc), 1, { r: Math.min(0.35, w), gr: Math.min(1.2, w + 0.7) });
    }
    // глаз на штативе, зрачок к лампе
    const ex = X(xe) - 2.6, ey = Y(ye);
    const eg = new T.Group(); at(eg, ex, 0, zc);
    at(cyl(3.4, 1, C.DARK), -1.8, Y0 + 0.5, 0, eg);
    rod(kit, v3(ex - 1.8, Y0 + 1, zc), v3(ex - 1.8, ey - 1, zc), 0.55, C.STEEL, { hull: true });
    at(box(2, 2, 2, C.DARK), -1.8, ey - 1.6, 0, eg);
    at(mesh(new T.SphereGeometry(2.6, 28, 20), 0xf7f3ea, { hull: true, edges: false }), 0, ey, 0, eg);
    const iris = new T.Mesh(keep(new T.CircleGeometry(1.25, 28)), keep(new T.MeshBasicMaterial({ color: sees ? 0xffd54a : 0x5f7d92 }))); iris.rotation.y = Math.PI / 2; at(iris, 2.52, ey, 0, eg);
    const pp = new T.Mesh(keep(new T.CircleGeometry(0.55, 20)), keep(new T.MeshBasicMaterial({ color: 0x0b0e14 }))); pp.rotation.y = Math.PI / 2; at(pp, 2.56, ey, 0, eg);
    const lid = mesh(new T.SphereGeometry(2.75, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.32), 0xe8b896, { edges: false }); lid.rotation.z = -Math.PI / 8; at(lid, 0, ey, 0, eg);
    if (sees) spot(kit, v3(ex + 2.7, ey, zc), 6, 0xffd54a, 0.9, true);
    // нить от лампы к глазу
    if (d.thread) {
      line3(kit, v3(xl, yl, zc), v3(ex + 2.6, ey, zc), 0xf4efe2, 0.08, 0.9);
      line3(kit, v3(xl - 1, Y0 + 2.8, zc + 10), v3(xl, yl - 1.5, zc), 0xf4efe2, 0.06, 0.7);
    }
    tag(v3(xl + 2, Y0 + 3, zc + 8), 'Лампа', `${f(d.ly)} см`);
    tag(v3(ex - 2, Y0 + 3, zc + 6), 'Глаз', sees ? 'видит лампу!' : `свет прошёл ${passed}/3`, sees);
  };

  // =====================================================================================
  // 3. Тень и полутень: лампа (точечная или матовая), диск на рейтере, белый экран с тенью
  // доля лампы, видимой из точки экрана на расстоянии rho (см) от оси: круги лампы и «проекции» диска на плоскость лампы
  function visible(rho, D, h, l, L) {
    const s = D / 2, rp = h / 2 * L / (L - l), c = rho * l / (L - l);
    if (s <= 0) return c >= rp ? 1 : 0;
    if (c >= s + rp) return 1;
    if (c <= rp - s) return 0;
    if (c <= s - rp) return 1 - (rp * rp) / (s * s);
    const a1 = s * s * Math.acos(clamp((c * c + s * s - rp * rp) / (2 * c * s), -1, 1)), a2 = rp * rp * Math.acos(clamp((c * c + rp * rp - s * s) / (2 * c * rp), -1, 1));
    const a3 = 0.5 * Math.sqrt(Math.max(0, (-c + s + rp) * (c + s - rp) * (c - s + rp) * (c + s + rp)));
    return 1 - (a1 + a2 - a3) / (Math.PI * s * s);
  }
  function shadowTex(kit, D, h, l, L, size) {
    const { T, keep } = kit, N = 200, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'), img = x.createImageData(N, N);
    const px = size / N;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const u = (i + 0.5 - N / 2) * px, v = (j + 0.5 - N / 2) * px, rho = Math.hypot(u, v);
      // сглаживание края: 4 выборки
      let s = 0; for (const [a, b] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) s += visible(Math.hypot(u + a * px, v + b * px), D, h, l, L);
      const fv = s / 4, edge = 1 - 0.18 * Math.min(1, rho / (size * 0.75));
      const o = (j * N + i) * 4;
      img.data[o] = Math.round((34 + 221 * fv) * (fv > 0 ? edge : 1)); img.data[o + 1] = Math.round((38 + 206 * fv) * (fv > 0 ? edge : 1)); img.data[o + 2] = Math.round((50 + 164 * fv) * (fv > 0 ? edge : 1)); img.data[o + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    const t = keep(new T.CanvasTexture(c)); t.colorSpace = T.SRGBColorSpace; return t;
  }
  SC['light-shadow'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, v3, C } = kit;
    room(kit, 0.75); felt(kit);
    // свет идёт справа налево (−x): белая сторона экрана смотрит на зрителя
    const k = 1.6, zc = 12, X = cm => 32 - cm * k, rT = Y0 + 1.8, yc = Y0 + 17 * k, S = 26, Sw = S * k;
    const D = d.D, h = d.h, Lc = d.L, l = d.l, hr = h / 2 * k;
    // скамья с линейкой
    at(box(80, 1.8, 7, RAIL), 0, Y0 + 0.9, zc);
    ruler(kit, X, 0, 40, 10, rT + 0.02, zc + 5.2);
    // лампа: рейтер, стойка, ручка размера плафона
    const xl = X(0), lh = lampHead(kit, xl, yc, zc, D, k, 'lamp3');
    at(box(5, 2, 8, C.DARK), xl, rT + 1, zc);
    rod(kit, v3(xl, rT + 2, zc), v3(xl, yc - lh.r - 2.6, zc), 0.55, C.STEEL, { hull: true });
    const kn = new T.Group(); at(kn, xl, rT + 1, zc + 4.6);
    const knob = cyl(1.5, 1.4, D > 0 ? ORANGE : 0xd9dfe9, { seg: 18 }); knob.rotation.x = Math.PI / 2; kn.add(knob);
    at(box(0.4, 1.6, 0.3, C.DARK, { edges: false }), 0, 0.5, 0.75, kn).rotation.z = -D / 8 * 2.4 + 1.2;
    clickable(kn, 'Dcyc');
    // диск на рейтере и стрелки «ближе / дальше»
    const xd = X(l), dg = new T.Group(); at(dg, xd, 0, zc);
    at(box(4.4, 2, 8, C.DARK), 0, rT + 1, 0, dg);
    at(cyl(0.4, yc - hr - rT - 2, C.STEEL, { edges: false }), 0, (rT + 2 + yc - hr) / 2, 0, dg);
    const disk = cyl(hr, 0.5, 0x2c3240, { seg: 40 }); disk.rotation.z = Math.PI / 2; at(disk, 0, yc, 0, dg);
    clickable(dg, 'far');
    arrowBtn(kit, kit.root, xd + 4.6, rT + 1.6, zc + 6, 'right', 'near');
    arrowBtn(kit, kit.root, xd - 4.6, rT + 1.6, zc + 6, 'left', 'far');
    // экран: белая доска на подставке, на ней — освещённость каждой точки
    const xs = X(Lc) - 0.4;
    at(box(6, 1.2, Sw + 6, C.WOOD2), xs - 0.6, Y0 + 0.6, zc);
    [-1, 1].forEach(s => at(box(1.2, yc - Sw / 2 - Y0, 1.2, C.WOOD), xs - 0.6, (Y0 + yc - Sw / 2) / 2 + 0.6, zc + s * (Sw / 2 - 3)));
    at(box(1, Sw + 1.6, Sw + 1.6, C.WOOD), xs - 0.7, yc, zc);
    const face = new T.Mesh(keep(new T.PlaneGeometry(Sw, Sw)), keep(new T.MeshBasicMaterial({ map: shadowTex(kit, D, h, l, Lc, S) })));
    face.rotation.y = Math.PI / 2; at(face, xs - 0.15, yc, zc);
    // объём полной тени (тёмный конус от диска) и крайние лучи в вертикальной плоскости
    const um = d.umbra, xEnd = um > 0 ? X(Lc) : X(D * l / (D - h));
    cone(kit, v3(xd - 0.3, yc, zc), v3(Math.max(xEnd, X(Lc)), yc, zc), hr, um > 0 ? um / 2 * k : 0, 0x05080e, 0.16);
    cone(kit, v3(xl - lh.r, yc, zc), v3(xs + 0.2, yc, zc), lh.r * 0.8, Sw / 2, 0xffe49a, 0.05, true);
    const zr = zc, sR = D / 2 * k, ray = (y0, y1, col) => { const yS = y0 + (y1 - y0) * Lc / l; const t = clamp((Sw / 2 + 2) / Math.max(1e-6, Math.abs(yS)), 0, 1); const yE = Math.abs(yS) > Sw / 2 + 2 ? y0 + (yS - y0) * t : yS; const xE = Math.abs(yS) > Sw / 2 + 2 ? xl + (xs - xl) * ((yE - y0) / (yS - y0)) : xs + 0.2; line3(kit, v3(xl, yc + y0, zr), v3(xE, yc + yE, zr), col, 0.13, 0.75); };
    ray(sR, hr, YEL); ray(-sR, -hr, YEL);
    if (D > 0) { ray(-sR, hr, ORANGE); ray(sR, -hr, ORANGE); }
    tag(v3(xl, yc + lh.r + 4, zc), 'Лампа', D > 0 ? `матовая, D = ${f(D)} см` : 'точечная');
    tag(v3(xd, yc + hr + 4, zc), 'Диск 4 см', `l = ${f(l)} см`);
    tag(v3(xs, Y0 + 2, zc + Sw / 2 + 4), 'Экран', um > 0.05 ? `тень ${f(um)} см` + (D > 0 ? ` · с полутенью ${f(d.pen)}` : '') : `полной тени нет · полутень ${f(d.pen)} см`, um <= 0.05);
    tag(v3(14, Y0 + 2, zc + 18), 'Опыты', `1 ${d.fa ? '✓' : '—'} · 2 ${d.fb ? '✓' : '—'}`, d.fa && d.fb);
  };

  // =====================================================================================
  // 4. Затмения: лампа-Солнце, глобус на стойке, Луна на проволочном рычаге вокруг него; тени — тёмные конусы
  SC['light-eclipse'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, v3, C } = kit;
    room(kit, 0.6);
    // модель повёрнута на 180° относительно вида сверху в опыте: Солнце справа, дневные стороны смотрят на зрителя
    const k = 0.24, kz = 0.2, ex = -10, yE = 25, ez = 0, re = d.re * k, rm = Math.max(1.6, d.rm * k), R = d.R * k, tan = d.tan;
    const P = (mx, mz, my) => v3(ex - mx * k, yE + mz * kz, ez - my * k);
    const E = v3(ex, yE, ez), Mp = P(d.mx, d.mz, d.my);
    // Солнце — большая лампа на стойке
    const sx = 44, sr = 8.5;
    at(cyl(6.5, 2, C.DARK), sx, Y0 + 1, ez);
    rod(kit, v3(sx, Y0 + 2, ez), v3(sx, yE - sr - 2, ez), 0.8, C.STEEL, { hull: true });
    at(cyl(3.2, 3, C.DARK), sx, yE - sr - 0.6, ez);
    const sg = new T.Group(); at(sg, sx, yE, ez);
    sg.add(mesh(new T.SphereGeometry(sr, 40, 28), 0xffe58a, { hull: true, edges: false, matOpt: { emissive: 0xffb02e, emissiveIntensity: 1 } }));
    const sh = new T.Sprite(keep(new T.SpriteMaterial({ map: kit.glowTex(), color: 0xffc860, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false }))); sh.scale.setScalar(40); sg.add(sh);
    sg.add(new T.PointLight(0xfff0c8, 160, 180, 1));
    clickable(sg, 'sun');
    if (!kit.reduce) kit.onFrame((dt, t) => sh.scale.setScalar(40 + 2.5 * Math.sin(t * 2)));
    // подставка, стойка, глобус с осью 23,5°
    at(cyl(9, 2, C.WOOD2), ex, Y0 + 1, ez);
    at(cyl(0.9, yE - re - 2.4 - Y0, C.STEEL, { edges: false }), ex, (Y0 + 2 + yE - re - 0.4) / 2, ez);
    const tilt = new T.Group(); at(tilt, ex, yE, ez); tilt.rotation.z = 23.5 * RAD;
    const spin = new T.Group(); tilt.add(spin);
    spin.add(mesh(new T.SphereGeometry(re, 40, 28), 0xffffff, { hull: true, edges: false, mat: keep(new T.MeshToonMaterial({ map: earthTex(T), gradientMap: kit.grad })) }));
    tilt.add(cyl(0.3, 2 * re + 4, C.BRASS, { edges: false, hull: false }));
    const mer = mesh(new T.TorusGeometry(re + 0.7, 0.28, 6, 40, Math.PI), C.BRASS, { edges: false }); mer.rotation.z = Math.PI / 2; mer.rotation.y = -Math.PI / 2; tilt.add(mer);
    clickable(tilt, 'earth');
    if (!kit.reduce) kit.onFrame((dt, t) => { spin.rotation.y = t * 0.35; });
    // ночная сторона Земли и Луны — от Солнца (по −x)
    const night = (c, r) => { const m = new T.Mesh(keep(new T.SphereGeometry(r + 0.06, 32, 20, -Math.PI / 2, Math.PI)), keep(new T.MeshBasicMaterial({ color: 0x02040a, transparent: true, opacity: 0.55, depthWrite: false }))); m.position.copy(c); m.renderOrder = 2; kit.root.add(m); };
    night(E, re);
    // плоскость орбиты Земли (полупрозрачный круг) и орбита Луны
    const pl = new T.Mesh(keep(new T.CircleGeometry(R + 6, 64)), keep(new T.MeshBasicMaterial({ color: 0x9fc4ff, transparent: true, opacity: 0.1, depthWrite: false, side: T.DoubleSide })));
    pl.rotation.x = -Math.PI / 2; at(pl, ex, yE, ez); pl.renderOrder = 1;
    const ring = mesh(new T.TorusGeometry(R + 6, 0.14, 4, 64), 0x9fc4ff, { edges: false, shadow: false, matOpt: { transparent: true, opacity: 0.5 } }); ring.rotation.x = Math.PI / 2; at(ring, ex, yE, ez);
    const orbit = [];
    for (let a = 0; a < 360; a += 5) orbit.push(P(d.R * Math.cos(a * RAD), d.tilt ? 90 * Math.sin((a - d.node) * RAD) : 0, -d.R * Math.sin(a * RAD)));
    at(new T.Mesh(keep(new T.TubeGeometry(new T.CatmullRomCurve3(orbit, true), 144, 0.2, 6, true)), keep(new T.MeshBasicMaterial({ color: 0xc8d0dd, transparent: true, opacity: 0.75 }))), 0, 0, 0);
    if (d.tilt) {
      const n1 = P(d.R * Math.cos(d.node * RAD), 0, -d.R * Math.sin(d.node * RAD)), n2 = E.clone().multiplyScalar(2).sub(n1);
      line3(kit, n1, n2, 0x72d4e8, 0.1, 0.6);
      const ng = new T.Group(); at(ng, n1.x, n1.y, n1.z);
      ng.add(mesh(new T.SphereGeometry(1.3, 16, 12), 0x72d4e8, { hull: true, edges: false, matOpt: { emissive: 0x72d4e8, emissiveIntensity: 0.5 } })); clickable(ng, 'node');
      const n2m = mesh(new T.TorusGeometry(1, 0.3, 6, 20), 0x72d4e8, { edges: false }); n2m.rotation.x = Math.PI / 2; at(n2m, n2.x, n2.y, n2.z);
    }
    // Луна на проволоке: рычаг от втулки на стойке, вертикальная проволока к шарику
    const yA = yE - re - 3.2, armEnd = v3(Mp.x, yA, Mp.z);
    at(cyl(1.5, 1.6, C.BRASS), ex, yA, ez);
    rod(kit, v3(ex, yA, ez), armEnd, 0.35, C.STEEL);
    if (Math.abs(Mp.y - yA) > rm) rod(kit, armEnd, v3(Mp.x, Mp.y + (Mp.y > yA ? -rm : rm), Mp.z), 0.2, C.STEEL);
    const lunar = d.side === 'night' && (d.type === 'total' || d.type === 'partial'), penL = d.side === 'night' && d.type === 'pen';
    const mg = new T.Group(); at(mg, Mp.x, Mp.y, Mp.z);
    const moon = mesh(new T.SphereGeometry(rm, 28, 20), lunar ? 0xc0603a : penL ? 0xa9adb6 : 0xe4e7ee, { hull: true, edges: false, matOpt: lunar ? { emissive: 0x8c3a20, emissiveIntensity: 0.6, transparent: true, opacity: 1 } : undefined });
    if (lunar) moon.renderOrder = 6;
    mg.add(moon); clickable(mg, 'moon');
    if (!lunar) night(Mp, rm);
    else spot(kit, Mp.clone(), rm * 5, 0xff7a40, 0.55);
    // тени: полная — тёмный сходящийся конус, полутень — светлее и расширяется
    const Le = 44, Lm = d.rm / tan * k;
    cone(kit, E, E.clone().add(v3(-Le, 0, 0)), re, re - tan * Le, 0x03050b, lunar ? 0.26 : 0.36);
    cone(kit, E, E.clone().add(v3(-Le, 0, 0)), re, re + tan * Le, 0x0a1020, 0.12);
    cone(kit, Mp, Mp.clone().add(v3(-Lm, 0, 0)), rm, 0, 0x03050b, 0.5);
    cone(kit, Mp, Mp.clone().add(v3(-Lm * 1.6, 0, 0)), rm, rm + tan * Lm * 1.6, 0x0a1020, 0.16);
    // пятно тени Луны на дневной стороне Земли (смещение — как в опыте)
    if (d.side === 'day' && d.type !== 'none') {
      const oy = d.mz * kz, oz = -d.my * k, o2 = oy * oy + oz * oz;
      if (o2 < re * re) {
        const n = v3(Math.sqrt(re * re - o2), oy, oz).normalize();
        const cap = (r, col, op) => { const th = Math.asin(clamp(r / re, 0.02, 1)); const m = new T.Mesh(keep(new T.SphereGeometry(re + 0.08, 32, 8, 0, Math.PI * 2, 0, th)), keep(new T.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false }))); m.quaternion.setFromUnitVectors(v3(0, 1, 0), n); m.position.copy(E); m.renderOrder = 3; kit.root.add(m); };
        cap(d.pen * k, 0x02040a, 0.45);
        if (d.um > 0 && d.type === 'total') cap(Math.max(0.45, d.um * k), 0x000000, 0.92);
      }
    }
    const eTxt = d.ec === 'нет' ? 'затмения нет' : d.ec;
    tag(v3(sx, yE + sr + 3, ez), 'Солнце', 'лампа');
    tag(v3(ex, Y0 + 2, ez + 10), 'Земля', eTxt, d.ec !== 'нет' && d.type !== 'pen');
    tag(v3(Mp.x, Mp.y + rm + 2.5, Mp.z), 'Луна', `${f(d.age)} сут · ${d.phase}`);
    tag(v3(34, Y0 + 1, 34), 'Поймано', `солнечное ${d.sol ? '✓' : '—'} · лунное ${d.lun ? '✓' : '—'}`, d.sol && d.lun);
  };
})();
