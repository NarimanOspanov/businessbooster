// «Как в жизни» для темы «Силы» (labs/phys-forces): весы и мензурка, ящик на планете, пружина на штативе
// с грузами, брусок с динамометром на доске, лабораторный динамометр с лупой.
// Сцены строятся из window.LUCH_REAL() опыта; плавное движение — из window.LUCH_REAL.live() каждый кадр.
// Набор деталей kit — из /luch/real3d.js.
(() => {
  const SC = (window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {});
  const IRON = 0x4a5468, ROD = 0xb9c0cc, RED = 0xe0473a, ORANGE = 0xffb547, GLASS = 0xdff2fb, WATER = 0x5fb4d9, PAPER = 0xf4efe2;
  const mem = {}; // что было до перестройки сцены: где лежали бруски, уровень воды, показание весов
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const num = x => String(x).replace('.', ',');
  const fmt = (x, n = 1) => (Math.round(x * 10 ** n) / 10 ** n).toFixed(n).replace('.', ',');
  const live = () => { try { return (window.LUCH_REAL && window.LUCH_REAL.live && window.LUCH_REAL.live()) || {}; } catch (e) { return {}; } };
  const smooth = t => t * t * (3 - 2 * t);
  // последняя созданная подпись: её значение и место меняем каждый кадр, не перестраивая сцену
  const lastTag = () => { const l = document.querySelectorAll('.rl-view .rl-lbl'); return l[l.length - 1] || null; };
  function liveTag(kit, p, name, value, hot) {
    kit.tag(p, name, value, hot);
    const el = lastTag(), i = el && el.querySelector('i');
    let shown = value;
    return { p, set(v) { if (i && v !== shown) { shown = v; i.textContent = v; } } };
  }

  // уменьшить всё, что сцена добавила после n0 (высокие штативы не влезают в кадр): W(x,y,z) — точка после уменьшения
  function shrinkW(kit, s, ox, oz) {
    const W = (x, y, z) => kit.v3(x * s + ox, y * s, z * s + oz);
    W.done = n0 => { const g = new kit.T.Group(); g.scale.setScalar(s); g.position.set(ox, 0, oz); kit.root.children.slice(n0).forEach(c => g.add(c)); kit.root.add(g); };
    return W;
  }

  // ---------- текстуры и плоские детали ----------
  function canvasTex(kit, w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    draw(x, w, h);
    const t = new kit.T.CanvasTexture(c); t.colorSpace = kit.T.SRGBColorSpace; t.anisotropy = 4; return kit.keep(t);
  }
  function plane(kit, w, h, tex, transparent) {
    const { T, keep } = kit;
    return new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: tex, transparent: !!transparent, depthWrite: !transparent })));
  }
  const textPlate = (kit, txt, w, h, fg = '#1b1610', bg = '#f7f3ea') => plane(kit, w, h, kit.keep(kit.textTex(txt, fg, bg, Math.round(64 * w / h), 64)));
  // сила: стержень + конус вдоль +y, видна сквозь детали (как стрелка на рисунке в учебнике)
  function forceArrow(kit, col, r = 0.5) {
    const { T, at, cyl } = kit;
    const o = { edges: false, hull: false, shadow: false, matOpt: { emissive: col, emissiveIntensity: 0.35, depthTest: false, transparent: true } };
    const g = new T.Group(), shaft = cyl(r, 1, col, o), head = cyl(r * 2.6, r * 5.5, col, { ...o, r2: 0.01 });
    at(shaft, 0, 0.5, 0, g); at(head, 0, 0, 0, g);
    shaft.renderOrder = head.renderOrder = 6;
    g.setLen = L => { const s = Math.max(0.01, L - r * 5.5); shaft.scale.y = s; shaft.position.y = s / 2; head.position.y = s + r * 2.75; g.visible = L > 0.4; };
    g.setLen(5);
    return g;
  }
  // пружина-спираль: висит вниз от (0,0,0) на длину len; прямые хвостики на концах
  function helixGeo(T, R, len, turns, wire) {
    const lead = 1.1, a = -lead, b = -(len - lead), n = Math.round(turns * 16), pts = [new T.Vector3(0, 0, 0), new T.Vector3(0, -lead * 0.55, 0)];
    for (let i = 0; i <= n; i++) { const t = i / n, ang = t * turns * Math.PI * 2; pts.push(new T.Vector3(R * Math.sin(ang), a + (b - a) * t, R * Math.cos(ang))); }
    pts.push(new T.Vector3(0, -len + lead * 0.55, 0), new T.Vector3(0, -len, 0));
    return new T.TubeGeometry(new T.CatmullRomCurve3(pts), n * 3, wire, 7);
  }
  function spring(kit, col, R, turns, wire, len0, hull) {
    const { T } = kit;
    const m = kit.mesh(helixGeo(T, R, len0, turns, wire), col, { hull: hull !== false, edges: false });
    let cur = len0;
    m.setLen = L => {
      L = Math.max(turns * wire * 2.05 + 2.4, L);
      if (Math.abs(L - cur) < 0.03) return; cur = L;
      const old = m.geometry, g = kit.keep(helixGeo(T, R, L, turns, wire));
      m.geometry = g; m.children.forEach(c => { if (c.geometry === old) c.geometry = g; }); old.dispose();
    };
    return m;
  }
  // крючок: незамкнутое кольцо из проволоки (плоскость XY), подвес сверху в (0,0,0)
  function hook(kit, r = 1.1, wire = 0.28, col = ROD) {
    const { T, at, mesh, cyl } = kit, g = new T.Group();
    at(cyl(wire, 1.4, col, { edges: false, hull: false }), 0, -0.7, 0, g);
    const t = mesh(new T.TorusGeometry(r, wire, 8, 24, Math.PI * 1.72), col, { edges: false });
    t.rotation.z = Math.PI / 2; at(t, 0, -1.4 - r, 0, g);
    return g;
  }
  // проволочное кольцо в плоскости XY (центр в (0,0,0)) или YZ
  function loop(kit, r, wire, yz, col = ROD) {
    const t = kit.mesh(new kit.T.TorusGeometry(r, wire, 8, 22), col, { edges: false });
    if (yz) t.rotation.y = Math.PI / 2;
    return t;
  }

  // =====================================================================================
  // 1. Масса и плотность: электронные весы, мензурка с водой, лоток с брусками A, B, X
  SC['forces-density'] = (kit, d) => {
    const { T, at, box, cyl, keep, tag, clickable, v3, C } = kit;
    const U = 3, ML = 0.2166; // 1 см → 3 ед.; 1 мл в мензурке (внутренний радиус 2,1 см) → 0,2166 ед. по высоте
    const BC = { A: 0xc9d1dc, B: 0x8f9aab, X: 0xc98a5e };
    const m = mem.density || (mem.density = { pos: {}, level: d.water, w: 0 });

    // --- электронные весы ---
    const SX = -36, SZ = 12;
    const sg = new T.Group(); at(sg, SX, 0, SZ); clickable(sg, 'to-scale');
    [[-11, -8], [11, -8], [-11, 8], [11, 8]].forEach(([x, z]) => at(cyl(1, 0.5, C.DARK, { edges: false }), x, 0.25, z, sg));
    at(box(28, 5, 22, 0x34405a), 0, 3, 0, sg);
    at(box(24, 0.4, 5, 0x232b3d, { edges: false }), 0, 5.6, 8, sg);
    const disp = plane(kit, 11, 3.2, null); at(disp, -3, 3.2, 11.06, sg);
    const tex = w => keep(kit.textTex(w + ' г', '#86e0a8', '#0c1a14', 220, 64));
    const t0 = tex(m.w), t1 = m.w === d.w ? t0 : tex(d.w);
    disp.material.map = t0;
    [[6, 0x3fae5a], [9.5, 0xe0473a]].forEach(([x, c]) => { const b = cyl(1, 0.8, c, { seg: 16 }); b.rotation.x = Math.PI / 2; at(b, x, 3.2, 11.2, sg); });
    at(cyl(2, 1.4, C.STEEL), 0, 6.2, 0, sg);
    at(cyl(10, 0.8, C.STEEL, { seg: 40 }), 0, 7.3, 0, sg);
    const panTop = 7.7;

    // --- мензурка ---
    const CX = -2, CZ = -8, y0 = 2.4, rIn = 6.3, top = y0 + 34;
    const cg = new T.Group(); at(cg, CX, 0, CZ); clickable(cg, 'to-cyl');
    at(cyl(8.4, 1.2, 0x3b6fd8, { seg: 6 }), 0, 0.6, 0, cg);
    at(cyl(rIn + 0.5, 1.2, GLASS, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.45 } }), 0, 1.8, 0, cg);
    const water = cyl(rIn - 0.05, 1, WATER, { edges: false, hull: false, shadow: false, matOpt: { transparent: true, opacity: 0.5, depthWrite: false } });
    at(water, 0, y0, 0, cg);
    const surf = cyl(rIn - 0.05, 0.12, 0x9fd8f0, { edges: false, hull: false, shadow: false, matOpt: { transparent: true, opacity: 0.8, depthWrite: false } });
    at(surf, 0, y0, 0, cg);
    const glass = cyl(rIn + 0.6, top - 1.2, GLASS, { hull: false, shadow: false, matOpt: { transparent: true, opacity: 0.2, depthWrite: false } });
    glass.renderOrder = 3; at(glass, 0, 1.2 + (top - 1.2) / 2, 0, cg);
    const rim = kit.mesh(new T.TorusGeometry(rIn + 0.6, 0.35, 8, 40), GLASS, { edges: false, shadow: false, matOpt: { transparent: true, opacity: 0.7 } }); rim.rotation.x = Math.PI / 2; at(rim, 0, top, 0, cg);
    at(box(2.4, 0.6, 2.2, GLASS, { edges: false, matOpt: { transparent: true, opacity: 0.6 } }), 0, top + 0.1, rIn + 1.2, cg);
    // шкала на стекле: деления через 5 мл, числа через 10
    const H = 150 * ML;
    const sTex = canvasTex(kit, 220, 1024, (x, w, h) => {
      x.clearRect(0, 0, w, h); x.strokeStyle = '#1b2537'; x.fillStyle = '#1b2537'; x.font = '700 40px "IBM Plex Mono", monospace'; x.textBaseline = 'middle';
      for (let ml = 0; ml <= 150; ml += 5) {
        const y = h - 6 - ml / 150 * (h - 30), big = ml % 10 === 0;
        x.lineWidth = big ? 6 : 4; x.beginPath(); x.moveTo(20, y); x.lineTo(big ? 100 : 66, y); x.stroke();
        if (big && ml) x.fillText(String(ml), 112, y + 2);
      }
      x.font = '700 38px "Golos Text", sans-serif'; x.fillText('мл', 112, 24);
    });
    const scl = new T.Mesh(keep(new T.CylinderGeometry(rIn + 0.66, rIn + 0.66, H * 1024 / (1024 - 30), 24, 1, true, -0.62, 1.24)), keep(new T.MeshBasicMaterial({ map: sTex, transparent: true, depthWrite: false })));
    const Hp = H * 1024 / (1024 - 30);
    scl.renderOrder = 4; at(scl, 0, y0 - Hp * 6 / 1024 + Hp / 2, 0, cg);
    // вода: уровень меняется плавно (после того как брусок опустился)
    let lv = m.level, delay = 0;

    // --- лоток ---
    const TX = 36, TZ = 26;
    const tg = new T.Group(); at(tg, TX, 0, TZ); clickable(tg, 'to-shelf');
    at(box(38, 1.2, 15, C.WOOD2), 0, 0.6, 0, tg);
    [[0, -7, 38, 1.2], [0, 7, 38, 1.2]].forEach(([x, z, w, dd]) => at(box(w, 2.2, dd, C.WOOD2), x, 1.1, z, tg));
    [-1, 1].forEach(s => at(box(1.2, 2.2, 15, C.WOOD2), s * 18.4, 1.1, 0, tg));
    const shelfX = { A: TX - 11, B: TX, X: TX + 11 };

    // --- бруски ---
    const ring = box(1, 0.3, 1, 0xffd166, { edges: false, matOpt: { emissive: 0xffd166, emissiveIntensity: 0.8 } });
    ring.visible = false; at(ring, 0, 1.35, 0);
    const blocks = d.bodies.map(b => {
      const s = U * Math.cbrt(b.V), g = new T.Group();
      at(box(s, s, s, BC[b.id]), 0, 0, 0, g);
      const lt = textPlate(kit, b.id, s * 0.55, s * 0.55, '#1b1610', '#' + BC[b.id].toString(16)); lt.rotation.x = -Math.PI / 2; at(lt, 0, s / 2 + 0.03, 0, g);
      const lf = textPlate(kit, b.id, s * 0.5, s * 0.5, '#1b1610', '#' + BC[b.id].toString(16)); at(lf, 0, 0, s / 2 + 0.03, g);
      clickable(g, 'blk-' + b.id);
      const where = d.loc[b.id];
      const tgt = where === 'scale' ? v3(SX, panTop + s / 2, SZ) : where === 'cyl' ? v3(CX, y0 + s / 2, CZ) : v3(shelfX[b.id], 1.2 + s / 2, TZ);
      const from = m.pos[b.id] ? m.pos[b.id].clone() : tgt.clone();
      m.pos[b.id] = tgt.clone();
      at(g, from.x, from.y, from.z);
      if (where === 'shelf' && d.sel === b.id) { ring.visible = true; ring.scale.set(s + 2, 1, s + 2); ring.position.set(tgt.x, 1.35, tgt.z); }
      const moving = from.distanceTo(tgt) > 0.5 && !kit.reduce;
      if (moving && where === 'cyl') delay = 0.75;
      return { g, from, tgt, s, moving, toScale: moving && where === 'scale', t: moving ? 0 : 1, bob: where === 'shelf' && d.sel === b.id };
    });
    const peak = top + 6;
    let wDelay = blocks.some(b => b.toScale) ? 0.75 : 0; // табло меняется, когда брусок лёг на чашку
    m.w = d.w;
    const setWater = h => { water.scale.y = Math.max(0.01, h); water.position.y = y0 + h / 2; surf.position.y = y0 + h; };
    setWater(lv * ML);
    if (!wDelay) disp.material.map = t1;
    kit.onFrame((dt, t) => {
      for (const b of blocks) {
        if (b.t < 1) {
          b.t = Math.min(1, b.t + dt / 0.9);
          const k = smooth(Math.min(1, b.t / 0.72)), y = b.from.y + (b.tgt.y - b.from.y) * smooth(b.t);
          const lift = Math.sin(Math.PI * b.t) * Math.max(0, peak - Math.max(b.from.y, b.tgt.y));
          b.g.position.set(b.from.x + (b.tgt.x - b.from.x) * k, y + lift, b.from.z + (b.tgt.z - b.from.z) * k);
        } else if (b.bob && !kit.reduce) b.g.position.set(b.tgt.x, b.tgt.y + 0.5 + 0.5 * Math.sin(t * 3), b.tgt.z);
        else b.g.position.copy(b.tgt);
      }
      if (delay > 0) delay -= dt;
      else if (Math.abs(lv - d.level) > 0.05) { lv = kit.reduce ? d.level : lv + (d.level - lv) * Math.min(1, dt * 5); setWater(lv * ML); }
      else if (lv !== d.level) { lv = d.level; setWater(lv * ML); }
      m.level = lv;
      if (wDelay > 0) { wDelay -= dt; if (wDelay <= 0) disp.material.map = t1; }
    });
    if (kit.reduce) { blocks.forEach(b => b.g.position.copy(b.tgt)); lv = d.level; setWater(lv * ML); disp.material.map = t1; }

    tag(v3(SX, panTop + 11, SZ), 'Весы', d.w + ' г');
    tag(v3(CX, top + 5, CZ), 'Мензурка', d.level + ' мл');
    tag(v3(TX, 13, TZ), 'Бруски', d.ans ? 'X — медь' : 'выбран ' + d.sel, d.ans);
  };

  // =====================================================================================
  // 2. Сила тяжести: площадка с грунтом планеты, деревянный ящик, стрелка Fтяж, глобус планеты
  const PL = {
    earth: { top: 0x5fae5a, soil: 0x7a5a3a, globe: ['#2d6fb8', '#4c9a62'] },
    moon: { top: 0xaeb2bb, soil: 0x7c818c, globe: ['#9aa0aa', '#6c727e'] },
    mars: { top: 0xcf6a43, soil: 0x8a4430, globe: ['#c0664a', '#8a4430'] },
    jup: { top: 0xd9b083, soil: 0x9c7350, globe: ['#c9a37a', '#8a6a4a'] },
  };
  function groundTex(kit, id) {
    return canvasTex(kit, 512, 512, (x, w, h) => {
      const P = { earth: '#5fae5a', moon: '#aeb2bb', mars: '#cf6a43', jup: '#d9b083' }[id];
      x.fillStyle = P; x.fillRect(0, 0, w, h);
      let s = 7; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
      if (id === 'jup') {
        ['#e8c9a0', '#b98a5e', '#f0dcc0', '#a8744a', '#e3c193', '#c48f62', '#f2e2c8'].forEach((c, i) => { x.fillStyle = c; x.fillRect(0, i * 74 + 8, w, 46); });
        x.fillStyle = '#c0503a'; x.beginPath(); x.ellipse(330, 300, 52, 28, 0, 0, 7); x.fill();
      } else for (let i = 0; i < 70; i++) {
        const px = rnd() * w, py = rnd() * h, r = 4 + rnd() * (id === 'moon' ? 30 : 16);
        if (id === 'moon') { x.fillStyle = 'rgba(70,74,84,.35)'; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); x.strokeStyle = 'rgba(230,232,238,.5)'; x.lineWidth = 3; x.beginPath(); x.arc(px - 2, py - 2, r, 3.4, 5.6); x.stroke(); }
        else if (id === 'mars') { x.fillStyle = rnd() > 0.5 ? 'rgba(120,50,30,.35)' : 'rgba(240,150,100,.35)'; x.beginPath(); x.ellipse(px, py, r * 1.6, r, rnd() * 3, 0, 7); x.fill(); }
        else { x.strokeStyle = rnd() > 0.5 ? '#3f8a46' : '#7cc46a'; x.lineWidth = 3; for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(px + k * 3, py); x.lineTo(px + k * 3 + (rnd() - 0.5) * 6, py - 8 - rnd() * 6); x.stroke(); } }
      }
    });
  }
  function globeTex(kit, id) {
    return canvasTex(kit, 512, 256, (x, w, h) => {
      let s = 3; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
      const [a, b] = PL[id].globe; x.fillStyle = a; x.fillRect(0, 0, w, h);
      if (id === 'jup') {
        for (let i = 0; i < 11; i++) { x.fillStyle = i % 2 ? '#e8cfa8' : '#a8744a'; x.fillRect(0, 20 + i * 20, w, 11 + (i % 3) * 3); }
        x.fillStyle = '#c0503a'; x.beginPath(); x.ellipse(300, 165, 30, 14, 0, 0, 7); x.fill();
      } else if (id === 'earth') {
        x.fillStyle = b; [[90, 90, 60, 45], [130, 170, 30, 40], [270, 80, 80, 40], [300, 150, 40, 50], [420, 170, 40, 25]].forEach(([px, py, rx, ry]) => { x.beginPath(); x.ellipse(px, py, rx, ry, 0.3, 0, 7); x.fill(); });
        x.fillStyle = '#f4f7fb'; x.fillRect(0, 0, w, 16); x.fillRect(0, h - 14, w, 14);
      } else {
        for (let i = 0; i < 50; i++) { x.fillStyle = b; x.globalAlpha = 0.5; x.beginPath(); x.arc(rnd() * w, rnd() * h, 4 + rnd() * 16, 0, 7); x.fill(); }
        x.globalAlpha = 1; if (id === 'mars') { x.fillStyle = '#f4f0ea'; x.fillRect(0, 0, w, 12); x.fillRect(0, h - 10, w, 10); }
      }
    });
  }
  SC['forces-gravity'] = (kit, d) => {
    const { T, at, box, cyl, keep, tag, clickable, v3, C } = kit;
    const P = PL[d.planet] || PL.earth;
    const GX = -8, GZ = 4, R = 32, gy = 3.2;
    // площадка-«кусок планеты»
    at(cyl(R, 2.4, P.soil, { seg: 48 }), GX, 1.2, GZ);
    const gt = new T.Mesh(keep(new T.CylinderGeometry(R, R, 0.8, 48)), [keep(new T.MeshToonMaterial({ color: P.top, gradientMap: kit.grad })), keep(new T.MeshToonMaterial({ color: 0xffffff, map: groundTex(kit, d.planet), gradientMap: kit.grad })), kit.toon(P.top)]);
    gt.receiveShadow = true; at(gt, GX, 2.8, GZ);
    const rim = kit.mesh(new T.TorusGeometry(R, 0.25, 6, 64), C.INK, { edges: false }); rim.rotation.x = Math.PI / 2; at(rim, GX, gy, GZ);
    // мелкие детали поверхности
    let s = 11; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 12; i++) {
      const a = rnd() * Math.PI * 2, rr = 12 + rnd() * (R - 15), x = GX + Math.cos(a) * rr, z = GZ + Math.sin(a) * rr;
      if (Math.abs(x - GX) < 10 && Math.abs(z - GZ) < 10) continue;
      if (d.planet === 'earth') at(cyl(0.9, 2.2, 0x3f8a46, { r2: 0.05, seg: 6, edges: false }), x, gy + 1.1, z);
      else if (d.planet === 'mars') at(kit.mesh(new T.DodecahedronGeometry(0.8 + rnd() * 1.2), 0x8a4430, { hull: true, edges: false }), x, gy + 0.4, z);
      else if (d.planet === 'moon') { const c = kit.mesh(new T.TorusGeometry(1.6 + rnd() * 2, 0.4, 6, 20), 0x9aa0aa, { edges: false }); c.rotation.x = Math.PI / 2; at(c, x, gy + 0.1, z); }
      else at(kit.mesh(new T.SphereGeometry(1.4 + rnd(), 12, 8), 0xf2e2c8, { hull: true, edges: false, matOpt: { transparent: true, opacity: 0.8 } }), x, gy + 1.8 + rnd() * 2, z);
    }
    // рейка высоты (красно-белая) — видно, на сколько подняли ящик
    for (let k = 0; k < 9; k++) at(box(1.6, 4, 1.6, k % 2 ? 0xf4f4f4 : RED, { edges: k === 8 }), GX + 15, gy + 2 + k * 4, GZ - 8);
    at(box(4, 0.8, 4, C.DARK), GX + 15, gy + 0.4, GZ - 8);
    // ящик
    const cs = 14, crate = new T.Group(); clickable(crate, 'lift');
    at(box(cs - 0.6, cs - 0.6, cs - 0.6, 0xc79a5c), 0, 0, 0, crate);
    const F = 0x8a6238, e = cs / 2 - 0.7;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => {
      at(box(1.6, cs, 1.6, F), a * e, 0, b * e, crate);
      at(box(cs, 1.6, 1.6, F), 0, a * e, b * e, crate);
      at(box(1.6, 1.6, cs, F), a * e, b * e, 0, crate);
    });
    const dg = box(1.4, cs * 1.2, 0.5, F); dg.rotation.z = Math.PI / 4; at(dg, 0, 0, cs / 2 - 0.1, crate);
    const lab = textPlate(kit, num(d.m) + ' кг', 7, 2.8); at(lab, 0, 3.8, cs / 2 + 0.25, crate);
    at(crate, GX, gy + cs / 2, GZ);
    // стрелка силы тяжести из центра ящика вниз; точка приложения
    const L = clamp(4 + 2.4 * Math.sqrt(d.F), 4, 44);
    const fa = forceArrow(kit, ORANGE, 0.8); fa.rotation.z = Math.PI; fa.setLen(L); at(fa, 0, 0, 0);
    const dot = kit.mesh(new T.SphereGeometry(0.9, 14, 10), ORANGE, { edges: false, matOpt: { depthTest: false, transparent: true } }); dot.renderOrder = 7; at(dot, 0, 0, 0);
    // глобус планеты на подставке
    const gl = new T.Group(); at(gl, 42, 0, -24); clickable(gl, 'pcycle');
    at(cyl(5, 1.2, C.DARK), 0, 0.6, 0, gl);
    at(cyl(0.6, 8, C.BRASS, { edges: false }), 0, 5, 0, gl);
    const arc = kit.mesh(new T.TorusGeometry(9.6, 0.45, 8, 40, Math.PI), C.BRASS, { edges: false }); arc.rotation.z = Math.PI / 2 + 0.4; at(arc, 0, 18, 0, gl);
    const sph = kit.mesh(new T.SphereGeometry(8.6, 36, 24), 0xffffff, { hull: true, edges: false, mat: keep(new T.MeshToonMaterial({ color: 0xffffff, map: globeTex(kit, d.planet), gradientMap: kit.grad })) });
    sph.rotation.z = 0.4; at(sph, 0, 18, 0, gl);
    // гиря 0,5 кг — добавить массу
    const kb = new T.Group(); at(kb, -48, 0, 30); clickable(kb, 'mcycle');
    const bell = kit.mesh(new T.SphereGeometry(3.4, 24, 16), 0x3a3f4c, { hull: true, edges: false }); bell.scale.y = 0.85; at(bell, 0, 2.9, 0, kb);
    const hd = kit.mesh(new T.TorusGeometry(2, 0.6, 8, 20, Math.PI), 0x3a3f4c, { edges: false }); at(hd, 0, 5.4, 0, kb);
    const kl = textPlate(kit, '+0,5 кг', 5, 1.8, '#fff6e6', '#1b1610'); at(kl, 0, 2.6, 3.0, kb);

    const crTag = liveTag(kit, v3(GX, gy + cs + 2, GZ), 'Ящик', 'm = ' + num(d.m) + ' кг');
    const fTag = liveTag(kit, v3(GX + 9, gy, GZ + cs / 2), 'Сила тяжести', 'Fтяж = ' + fmt(d.F) + ' Н', true);
    tag(v3(42, 30, -24), d.name, 'g = ' + num(d.g) + ' Н/кг');
    const pose = () => {
      const h = clamp((live().h || 0) * 0.25, 0, 40), yc = gy + cs / 2 + h;
      crate.position.y = yc;
      fa.position.set(GX, yc, GZ + cs / 2 + 0.8); dot.position.copy(fa.position);
      crTag.p.set(GX, yc + cs / 2 + 2, GZ);
      fTag.p.set(GX + 22, yc - L + 4, GZ + cs / 2 + 1);
    };
    pose();
    kit.onFrame(dt => { pose(); if (!kit.reduce) sph.rotation.y += dt * 0.3; });
  };

  // =====================================================================================
  // 3. Закон Гука: штатив, пружина с крючком, грузы по 100 г с крючками, линейка на подставке
  const SPR = { A: { col: 0x72d4e8, R: 2.3, turns: 9, wire: 0.42 }, B: { col: 0x72d4e8, R: 2.1, turns: 13, wire: 0.24 }, X: { col: ORANGE, R: 2.2, turns: 11, wire: 0.32 } };
  // груз 100 г: петля сверху (плоскость YZ, продета в кольцо выше), тело, кольцо снизу (XY) для следующего.
  // (0,0,0) — центр кольца, на котором он висит; центр нижнего кольца — на −5,4
  function weight100(kit, ringBelow = true) {
    const { T, at, cyl } = kit, g = new T.Group();
    at(loop(kit, 0.7, 0.2, true), 0, -0.7, 0, g);
    at(cyl(0.22, 0.6, ROD, { edges: false, hull: false }), 0, -1.6, 0, g);
    at(cyl(2.2, 2.6, 0x9aa4b6, { seg: 24 }), 0, -1.9 - 1.3, 0, g);
    at(cyl(1.5, 0.12, 0x6c7689, { edges: false, hull: false }), 0, -1.86, 0, g);
    if (ringBelow) { at(cyl(0.22, 0.4, ROD, { edges: false, hull: false }), 0, -4.6, 0, g); at(loop(kit, 0.7, 0.2, false), 0, -5.4, 0, g); }
    return g;
  }
  SC['forces-hooke'] = (kit, d) => {
    const { T, at, box, cyl, keep, clickable, v3, C } = kit;
    const SX = -6, SZ = -6, YA = 58, N0 = 10, CM = 1.2, STEP = 5.4;
    const yT = YA - 1.4, n0 = kit.root.children.length, W = shrinkW(kit, 0.86, 2, 0);
    // штатив
    at(box(24, 2, 18, IRON), -24, 1, SZ);
    at(cyl(1, 64, ROD, { edges: false }), -30, 33, SZ);
    at(box(4, 3.4, 4, IRON), -30, YA, SZ);
    const arm = cyl(0.8, 25, ROD, { edges: false }); arm.rotation.z = Math.PI / 2; at(arm, -17.5, YA, SZ);
    const sc = cyl(0.9, 2.4, IRON, { seg: 6 }); sc.rotation.z = Math.PI / 2; at(sc, -27, YA, SZ);
    at(box(1.2, 1.4, 1.2, ROD), SX, YA - 0.9, SZ);
    // пружина
    const P = SPR[d.spr];
    const sp = spring(kit, P.col, P.R, P.turns, P.wire, N0, P.wire > 0.3); at(sp, SX, yT, SZ);
    // нижний конец: крючок с указателем, цепочка грузов
    const low = new T.Group(); at(low, SX, yT - N0, SZ);
    at(loop(kit, 0.9, 0.26, false), 0, -0.9, 0, low);
    const ptr = box(10.4, 0.5, 0.9, RED, { matOpt: { emissive: RED, emissiveIntensity: 0.3 } }); at(ptr, 6.2, -0.6, 0, low);
    const tip = kit.mesh(new T.ConeGeometry(0.7, 1.4, 4), RED, { edges: false }); tip.rotation.z = -Math.PI / 2; at(tip, 11.8, -0.6, 0, low);
    const chain = new T.Group(); at(chain, 0, -0.9, 0, low); clickable(chain, 'n-');
    for (let i = 0; i < d.n; i++) at(weight100(kit, true), 0, -i * STEP, 0, chain);
    // линейка на подставке: ноль — где указатель без груза, числа вниз
    const RX = SX + 14, y0 = yT - N0 - 0.6, top = y0 + 3, bot = 1.6;
    at(box(8, 1.6, 7, C.WOOD2), RX, 0.8, SZ);
    at(box(4.6, top - bot, 0.7, 0xe9d9a8), RX, (top + bot) / 2, SZ);
    const len = top - bot, cmMax = Math.floor((y0 - bot - 0.6) / CM);
    const rt = canvasTex(kit, 128, 1024, (x, w, h) => {
      x.fillStyle = '#e9d9a8'; x.fillRect(0, 0, w, h); x.strokeStyle = '#3b3320'; x.fillStyle = '#3b3320'; x.font = '700 30px "IBM Plex Mono", monospace'; x.textAlign = 'right'; x.textBaseline = 'middle';
      for (let c = 0; c <= cmMax; c++) {
        const y = (top - (y0 - c * CM)) / len * h, big = c % 5 === 0;
        x.lineWidth = big ? 4 : 2.5; x.beginPath(); x.moveTo(0, y); x.lineTo(big ? 56 : 32, y); x.stroke();
        if (big) x.fillText(String(c), w - 8, y + 1);
        for (let mm = 1; mm < 10 && c < cmMax; mm++) { const ym = y + mm * CM / 10 / len * h; x.lineWidth = 1.2; x.beginPath(); x.moveTo(0, ym); x.lineTo(mm === 5 ? 22 : 14, ym); x.stroke(); }
      }
      x.font = '700 26px "Golos Text", sans-serif'; x.textAlign = 'center'; x.fillText('см', w / 2 + 14, 22);
    });
    const rp = plane(kit, 4.4, len - 0.2, rt); at(rp, RX, (top + bot) / 2, SZ + 0.37);
    // запасные грузы висят на подставке-вешалке
    const left = d.nMax - d.n, tray = new T.Group(); at(tray, 22, 0, 14); clickable(tray, 'n+');
    at(box(34, 1.2, 8, C.WOOD2), 0, 0.6, 0, tray);
    [-1, 1].forEach(s => at(box(1.6, 12, 1.6, C.WOOD2), s * 15.5, 6.6, 0, tray));
    const bar = cyl(0.45, 32.6, ROD, { edges: false }); bar.rotation.z = Math.PI / 2; at(bar, 0, 12, 0, tray);
    for (let i = 0; i < left; i++) at(weight100(kit, false), -11 + i * 5.5, 12, 0, tray);
    // другие пружины лежат на столе — нажать, чтобы сменить
    const others = ['A', 'B', 'X'].filter(k => k !== d.spr);
    others.forEach((k, i) => {
      const Q = SPR[k], g = new T.Group(); at(g, -44 + i * 18, 0, 26); clickable(g, 'sp-' + k);
      const s = spring(kit, Q.col, Q.R, Q.turns, Q.wire, N0, Q.wire > 0.3); s.rotation.z = Math.PI / 2; at(s, -5, Q.R + Q.wire + 0.1, 0, g);
      const lt = textPlate(kit, k, 5, 5, '#1b1610', '#fff6e6'); lt.rotation.x = -Math.PI / 2; at(lt, 0, 0.05, Q.R + 4.6, g);
    });

    const kTxt = d.spr === 'X' && !d.kOk ? 'k = ?' : 'k = ' + d.k + ' Н/м';
    W.done(n0);
    kit.tag(W(SX - 14, YA + 4, SZ), 'Пружина ' + d.spr, kTxt, d.spr === 'X' && d.kOk);
    const lTag = liveTag(kit, W(RX + 9, 9, SZ), 'Линейка', 'Δl = 0 см');
    const wTag = liveTag(kit, W(SX - 9, 30, SZ), 'Грузы', d.n ? d.n + ' × 100 г · F = ' + d.n + ' Н' : 'нет');
    let acc = 1;
    const pose = dt => {
      const dl = clamp(live().dl || 0, -3, 30), yb = yT - N0 - dl * CM;
      sp.setLen(N0 + dl * CM); low.position.y = yb;
      wTag.p.copy(W(SX - 15, yb - 0.9 - Math.max(1, d.n) * STEP - 1, SZ)); // под цепочкой грузов
      acc += dt; if (acc > 0.15) { acc = 0; lTag.set('Δl = ' + fmt(Math.max(0, dl)) + ' см'); }
    };
    pose(1); kit.onFrame(dt => pose(dt));
  };

  // =====================================================================================
  // 4. Трение: доска с поверхностью, деревянный брусок 1 кг (+ груз 1 кг), горизонтальный динамометр в руке
  const SURF = { wood: { col: 0xd9a46a, name: 'дерево' }, ice: { col: 0xbfe6f5, name: 'лёд' }, rubber: { col: 0x34373f, name: 'резина' } };
  function surfTex(kit, id, w, h) {
    return canvasTex(kit, w, h, (x) => {
      x.fillStyle = '#' + SURF[id].col.toString(16).padStart(6, '0'); x.fillRect(0, 0, w, h);
      let s = 5; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
      if (id === 'wood') { x.strokeStyle = '#a8743f'; x.lineWidth = 3; for (let i = 0; i < 14; i++) { const y = 10 + i * h / 14; x.beginPath(); x.moveTo(0, y); for (let k = 0; k <= 8; k++) x.lineTo(k * w / 8, y + Math.sin(k * 1.3 + i) * 5); x.stroke(); } }
      if (id === 'ice') { x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 3; for (let i = 0; i < 18; i++) { const px = rnd() * w, py = rnd() * h; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 30 + rnd() * 60, py + (rnd() - 0.5) * 20); x.stroke(); } }
      if (id === 'rubber') { x.fillStyle = '#4c515c'; for (let px = 8; px < w; px += 16) for (let py = 8; py < h; py += 16) { x.beginPath(); x.arc(px, py, 3.4, 0, 7); x.fill(); } }
    });
  }
  function scaleTexH(kit, u0, u15) { // шкала горизонтального динамометра: 0 справа (u0), 15 Н слева (u15)
    return canvasTex(kit, 1024, 128, (x, w, h) => {
      x.fillStyle = '#f4f6fa'; x.fillRect(0, 0, w, h); x.strokeStyle = '#1b2537'; x.fillStyle = '#1b2537'; x.font = '700 50px "IBM Plex Mono", monospace'; x.textAlign = 'center';
      for (let f = 0; f <= 30; f++) { const px = w * (u0 + (u15 - u0) * f / 30), big = f % 10 === 0, mid = f % 2 === 0; x.lineWidth = big ? 6 : 3; x.beginPath(); x.moveTo(px, 0); x.lineTo(px, big ? 56 : mid ? 40 : 26); x.stroke(); if (big) x.fillText(String(f / 2), px, 112); }
      x.font = '700 42px "Golos Text", sans-serif'; x.fillText('Н', 26, 112);
    });
  }
  function hand(kit) { // мультяшная рука в перчатке, держит кольцо динамометра (смотрит влево)
    const { T, at, box, cyl } = kit, g = new T.Group(), SKIN = 0xf2c4a0, CUF = 0x3b6fd8;
    at(box(5, 6, 4.4, SKIN), 2.6, 0, 0, g);
    for (let i = 0; i < 4; i++) { const f = cyl(0.85, 4, SKIN, { seg: 12 }); f.rotation.z = Math.PI / 2; at(f, -0.8, 2.1 - i * 1.4, 1.2, g); }
    const th = cyl(0.9, 3.4, SKIN, { seg: 12 }); th.rotation.x = Math.PI / 2; at(th, 0.4, 2.4, -1.6, g);
    const cuff = cyl(3.2, 4, CUF, { seg: 20 }); cuff.rotation.z = Math.PI / 2; at(cuff, 7, 0, 0, g);
    const arm = cyl(2.8, 10, CUF, { seg: 20 }); arm.rotation.z = Math.PI / 2; at(arm, 14, 0, 0, g);
    return g;
  }
  SC['forces-friction'] = (kit, d) => {
    const { T, at, box, cyl, keep, clickable, v3, C } = kit;
    const BZ = 4, BT = 1.8, BX0 = -64, BX1 = 52;
    // доска с поверхностью
    const bl = BX1 - BX0;
    at(box(bl, BT - 0.4, 20, C.WOOD2), (BX0 + BX1) / 2, (BT - 0.4) / 2, BZ);
    const top = new T.Mesh(keep(new T.BoxGeometry(bl, 0.4, 20)), [kit.toon(SURF[d.surf].col), kit.toon(SURF[d.surf].col), keep(new T.MeshToonMaterial({ color: 0xffffff, map: surfTex(kit, d.surf, 1024, 180), gradientMap: kit.grad })), kit.toon(SURF[d.surf].col), kit.toon(SURF[d.surf].col), kit.toon(SURF[d.surf].col)]);
    top.receiveShadow = true; at(top, (BX0 + BX1) / 2, BT - 0.2, BZ);
    top.add(new T.LineSegments(keep(new T.EdgesGeometry(top.geometry)), kit.edgeMat));
    // другие поверхности: пластины у заднего края
    ['ice', 'wood', 'rubber'].filter(k => k !== d.surf).forEach((k, i) => {
      const g = new T.Group(); at(g, -30 + i * 30, 0, -28); clickable(g, 'sf-' + k);
      const p = new T.Mesh(keep(new T.BoxGeometry(24, 1, 12)), [kit.toon(SURF[k].col), kit.toon(SURF[k].col), keep(new T.MeshToonMaterial({ color: 0xffffff, map: surfTex(kit, k, 256, 128), gradientMap: kit.grad })), kit.toon(SURF[k].col), kit.toon(SURF[k].col), kit.toon(SURF[k].col)]);
      p.castShadow = p.receiveShadow = true; p.add(new T.LineSegments(keep(new T.EdgesGeometry(p.geometry)), kit.edgeMat)); at(p, 0, 0.5, 0, g);
      const lt = textPlate(kit, SURF[k].name, 14, 4, '#1b1610', '#fff6e6'); lt.rotation.x = -Math.PI / 2; at(lt, 0, 1.03, 2.6, g);
    });
    // брусок
    const bw = 16, bh = 8, bd = 10, by = BT + bh / 2, hy = BT + 4.6;
    const blk = new T.Group(); clickable(blk, 'bmt');
    at(box(bw, bh, bd, 0xc79a5c), 0, 0, 0, blk);
    for (let i = 0; i < 3; i++) at(box(bw - 1, 0.12, 0.2, 0x9a6f3a, { edges: false, shadow: false }), 0, -2 + i * 2, bd / 2 + 0.02, blk);
    const bl1 = textPlate(kit, '1 кг', 5, 2, '#1b1610', '#e6c48e'); at(bl1, -3.5, 2, bd / 2 + 0.05, blk);
    const eye = kit.mesh(new T.TorusGeometry(0.9, 0.28, 8, 18), ROD, { edges: false }); at(eye, bw / 2 + 1.1, hy - by, 0, blk);
    if (d.bm === 2) {
      at(cyl(3.6, 5, 0x9aa4b6, { seg: 28 }), 0, bh / 2 + 2.5, 0, blk);
      const wl = textPlate(kit, '1 кг', 4.4, 1.8); wl.rotation.x = -Math.PI / 2; at(wl, 0, bh / 2 + 5.04, 0, blk);
      at(cyl(0.9, 1, ROD, { edges: false }), 0, bh / 2 + 5.5, 0, blk);
    }
    at(blk, 0, by, BZ);
    // динамометр: корпус, шкала, пружина, шток с указателем и крючком; кольцо в руке
    const S = 1.4, L0 = 10, ROD_L = 26, HL = 36, hh = 7.2;
    const dyn = new T.Group(); at(dyn, 0, hy, BZ); clickable(dyn, 'auto');
    at(box(HL, hh, 1, 0x2a3a58), HL / 2, 0, -1.6, dyn);
    [-1, 1].forEach(s => at(box(HL, 0.9, 3.4, 0x2a3a58), HL / 2, s * (hh / 2 - 0.45), 0, dyn));
    at(box(1, hh, 3.4, 0x2a3a58), 0.5, 0, 0, dyn); at(box(1.4, hh, 3.4, 0x2a3a58), HL - 0.7, 0, 0, dyn);
    const st = plane(kit, 26.5, 2.6, scaleTexH(kit, (34 - L0 - 0.5) / 26.5, (34 - L0 - 15 * S - 0.5) / 26.5)); at(st, 0.5 + 26.5 / 2, -1.85, 1.2, dyn);
    const ringH = kit.mesh(new T.TorusGeometry(2, 0.5, 8, 24), ROD, { edges: false }); at(ringH, HL + 2.2, 0, 0, dyn);
    const cover = box(HL - 2, hh - 1.8, 0.2, 0xdff2fb, { edges: false, shadow: false, matOpt: { transparent: true, opacity: 0.18, depthWrite: false } }); at(cover, HL / 2, 0, 1.75, dyn);
    // пружина: от указателя вправо до конца корпуса (висит «вниз» по −y, повёрнута на +90° → вдоль +x)
    const sp = spring(kit, 0xc6ccd6, 1.3, 12, 0.22, L0, false); sp.rotation.z = Math.PI / 2;
    const spG = new T.Group(); at(spG, 34 - L0, 1, 0, dyn); at(sp, 0, 0, 0, spG);
    const hd = hand(kit); at(hd, HL + 3.6, 0, 0, dyn);
    // шток: от крючка до указателя (едет с бруском)
    const rodG = new T.Group(); at(rodG, 0, hy, BZ);
    const rd = cyl(0.35, ROD_L, ROD, { edges: false }); rd.rotation.z = Math.PI / 2; at(rd, ROD_L / 2, 1, 0, rodG);
    const hk = kit.mesh(new T.TorusGeometry(0.9, 0.28, 8, 18, Math.PI * 1.5), ROD, { edges: false }); hk.rotation.z = Math.PI * 0.25; at(hk, 0.4, 0, 0, rodG);
    const lnk = cyl(0.3, 1.2, ROD, { edges: false, hull: false }); at(lnk, 0.8, 0.6, 0, rodG);
    const pt = box(0.6, 4.4, 0.4, RED, { edges: false, matOpt: { emissive: RED, emissiveIntensity: 0.3 } }); at(pt, ROD_L, -0.6, 1.45, rodG);
    // силы: тяга над бруском (оранжевая), трение у опоры (красная)
    const fPull = forceArrow(kit, ORANGE, 0.45); fPull.rotation.z = -Math.PI / 2; at(fPull, 0, 0, 0);
    const fFr = forceArrow(kit, 0xff6a50, 0.45); fFr.rotation.z = Math.PI / 2; at(fFr, 0, 0, 0);
    // записи
    const pad = new T.Group(); at(pad, -46, 0, 32); pad.rotation.y = 0.12;
    at(box(26, 0.6, 15, 0x3b6fd8), 0, 0.3, 0, pad);
    const lines = d.rec.length ? d.rec : ['пока пусто'];
    const pt2 = canvasTex(kit, 512, 300, (x, w, h) => {
      x.fillStyle = '#f7f3ea'; x.fillRect(0, 0, w, h); x.strokeStyle = '#b9c8e6'; x.lineWidth = 2;
      for (let y = 70; y < h; y += 46) { x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); }
      x.fillStyle = '#1b2537'; x.font = '700 34px "Golos Text", sans-serif'; x.fillText('Трение скольжения', 18, 46);
      x.font = '500 30px "IBM Plex Mono", monospace'; lines.slice(-5).forEach((l, i) => x.fillText(l, 18, 104 + i * 46));
    });
    const pp = plane(kit, 24, 14, pt2); pp.rotation.x = -Math.PI / 2; at(pp, 0, 0.62, 0, pad);

    const bTag = liveTag(kit, v3(0, by + bh / 2 + 3, BZ), 'Брусок ' + d.bm + ' кг', 'стоит');
    const dTag = liveTag(kit, v3(0, hy + 6, BZ), 'Динамометр', '0 Н');
    kit.tag(v3(BX1 - 10, BT + 1, BZ - 10), 'Поверхность', d.sname);
    let acc = 1;
    const pose = dt => {
      const Lv = live(), b = Lv.b ?? 24, F = clamp(Lv.F || 0, 0, 15);
      const xl = -58 + (b - 24) * 0.22, xc = xl + bw / 2, xk = xl + bw + 1.9;
      blk.position.x = xc;
      rodG.position.x = xk;
      const hl = xk + ROD_L + L0 - 34 + F * S;
      dyn.position.x = hl;
      const sl = L0 + F * S; spG.position.x = 34 - sl; sp.setLen(sl);
      const fl = F > 0.05 ? 3 + F * 1.8 : 0;
      fPull.position.set(xc, by + bh / 2 + (d.bm === 2 ? 7.5 : 2.2), BZ + bd / 2 + 0.6); fPull.setLen(fl);
      fFr.position.set(xc, BT + 0.4, BZ + bd / 2 + 1.2); fFr.setLen(fl);
      bTag.p.set(xc, by + bh / 2 + (d.bm === 2 ? 7 : 2.5), BZ);
      dTag.p.set(hl + HL / 2, hy + hh / 2 + 2, BZ);
      acc += dt;
      if (acc > 0.12) { acc = 0; dTag.set(fmt(F) + ' Н'); bTag.set(Lv.edge ? 'у края' : Lv.slide ? 'скользит' : 'стоит'); }
    };
    pose(1); kit.onFrame(dt => pose(dt));
  };

  // =====================================================================================
  // 5. Динамометр: лабораторный динамометр на штативе, шкала 0–5 Н, лупа у указателя, предметы на столе
  function dynoScaleDraw(x, w, h, Hs) { // Hs — высота шкалы в ед.; 0 Н сверху; деления через 0,2 Н
    x.fillStyle = '#f4f6fa'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#20283a'; x.fillRect(w * 0.44, 0, w * 0.16, h); // прорезь с пружиной
    x.strokeStyle = '#1b2537'; x.fillStyle = '#1b2537'; x.textAlign = 'right'; x.textBaseline = 'middle'; x.font = `700 ${Math.round(w * 0.2)}px "IBM Plex Mono", monospace`;
    const y0 = h * 0.12, y1 = h * 0.12 + (h * 0.8);
    for (let i = 0; i <= 25; i++) {
      const y = y0 + (y1 - y0) * i / 25, big = i % 5 === 0;
      x.lineWidth = big ? w * 0.022 : w * 0.013; x.beginPath(); x.moveTo(w * 0.62, y); x.lineTo(w * (big ? 0.92 : 0.8), y); x.stroke();
      if (big) x.fillText(String(i / 5), w * 0.4, y + 2);
    }
    x.textAlign = 'center'; x.font = `700 ${Math.round(w * 0.16)}px "Golos Text", sans-serif`; x.fillText('Н', w * 0.78, h * 0.05);
    void Hs;
  }
  function objMesh(kit, id) { // предмет с петлёй сверху; подвес в (0,0,0), вниз
    const { T, at, box, cyl, mesh } = kit, g = new T.Group();
    if (id === 'w') {
      at(weight100(kit, false), 0, 0, 0, g);
      const l = textPlate(kit, '100 г', 3, 1.2); at(l, 0, -3.2, 2.23, g);
      g.userData.h = 4.5;
    } else if (id === 'apple') {
      const prof = []; for (let i = 0; i <= 16; i++) { const t = i / 16 * Math.PI; prof.push(new T.Vector2(Math.max(0.05, Math.sin(t) * 3.6 * (1 - 0.18 * Math.cos(t)) + (i === 0 || i === 16 ? 0 : 0)), -Math.cos(t) * 3.3)); }
      const ap = mesh(new T.LatheGeometry(prof, 28), 0xd9483b, { hull: true, edges: false }); at(ap, 0, -1.6 - 3.3, 0, g);
      at(cyl(0.22, 1.8, 0x6b4a2a, { edges: false, hull: false }), 0, -1.0, 0, g);
      const lf = mesh(new T.SphereGeometry(0.9, 10, 6), 0x4c9a62, { edges: false }); lf.scale.set(1.6, 0.35, 0.8); at(lf, 1.1, -1.1, 0, g);
      const str = cyl(0.12, 1.6, 0xf4efe2, { edges: false, hull: false }); at(str, 0, 0.1, 0, g); // нитка
      g.userData.h = 8.2;
    } else {
      const lp = mesh(new T.TorusGeometry(0.9, 0.22, 6, 16), 0xf4efe2, { edges: false }); at(lp, 0, -0.9, 0, g);
      at(box(10, 4.6, 3.4, 0x4c7fd1), 0, -1.8 - 2.3, 0, g);
      const zp = box(9.4, 0.25, 0.3, 0xe8ecf4, { edges: false }); at(zp, 0, -1.9, 0, g);
      const l = textPlate(kit, 'пенал', 4.4, 1.5, '#e8ecf4', '#4c7fd1'); at(l, 0, -4.1, 1.72, g);
      g.userData.h = 6.6;
    }
    return g;
  }
  SC['forces-dyno'] = (kit, d) => {
    const { T, at, box, cyl, keep, clickable, v3, C } = kit;
    const DX = -8, DZ = -2, YA = 70, PT = 66, PB = 29, PW = 12;
    const Hs = PT - PB, zeroY = PT - 0.12 * Hs, fullY = zeroY - 0.8 * Hs, NS = 0.8 * Hs / 5; // 0 и 5 Н на шкале; 1 Н → NS ед.
    const n0 = kit.root.children.length, W = shrinkW(kit, 0.86, 0, 0);
    // штатив
    at(box(24, 2, 16, IRON), DX - 14, 1, DZ);
    at(cyl(1, 72, ROD, { edges: false }), DX - 22, 37, DZ);
    at(box(4, 3.4, 4, IRON), DX - 22, YA, DZ);
    const arm = cyl(0.8, 22, ROD, { edges: false }); arm.rotation.z = Math.PI / 2; at(arm, DX - 11, YA, DZ);
    const rg = kit.mesh(new T.TorusGeometry(1.2, 0.3, 6, 18), ROD, { edges: false }); at(rg, DX, YA - 1.6, DZ);
    at(cyl(0.3, 1.6, ROD, { edges: false, hull: false }), DX, PT + 0.5, DZ);
    // корпус-планка с шкалой
    at(box(PW + 2, Hs + 2, 2, 0x2f6fd8), DX, (PT + PB) / 2, DZ - 0.6);
    const tex = canvasTex(kit, 256, Math.round(256 * Hs / PW), (x, w, h) => dynoScaleDraw(x, w, h, Hs));
    const face = plane(kit, PW, Hs, tex); at(face, DX, (PT + PB) / 2, DZ + 0.42);
    const sx = DX + PW * (0.52 - 0.5); // ось прорези
    const sTop = PT - 1.2;
    const sp = spring(kit, 0xe8ecf4, 0.8, 10, 0.2, sTop - zeroY, false); at(sp, sx, sTop, DZ + 1.3);
    const mov = new T.Group(); at(mov, 0, 0, 0); // указатель + шток + крючок едут вместе
    const ptr = box(PW * 0.5, 0.42, 0.35, RED, { edges: false, matOpt: { emissive: RED, emissiveIntensity: 0.35 } }); at(ptr, sx + PW * 0.18, 0, DZ + 1.05, mov);
    const shaftL = zeroY - PB + 3;
    at(cyl(0.3, shaftL, ROD, { edges: false, hull: false }), sx, -shaftL / 2, DZ + 0.9, mov);
    const hk = hook(kit, 1, 0.3); at(hk, sx, -shaftL, DZ + 0.9, mov);
    const hookDY = -shaftL - 1.4 - 2; // низ крючка относительно указателя
    // подвешенный предмет
    let hungG = null;
    if (d.hung) { hungG = objMesh(kit, d.hung); clickable(hungG, 'hung'); at(hungG, sx, hookDY + 0.9, DZ + 0.9, mov); }
    // предметы на столе
    const SPOT = { w: [26, 22], apple: [38, 22], pen: [52, 22] };
    ['w', 'apple', 'pen'].filter(k => k !== d.hung).forEach(k => {
      const o = objMesh(kit, k); clickable(o, 'ob-' + k);
      at(o, SPOT[k][0], o.userData.h + 0.6, SPOT[k][1]);
    });
    at(box(42, 0.6, 12, C.WOOD2), 39, 0.3, 22);
    // лупа: стекло ходит по стойке вслед за указателем, внутри — шкала ×3
    const LX = DX + PW * 0.27, LZ = DZ + 4, LR = 4.4;
    const LS = DX + 16;
    at(cyl(4, 1, C.DARK), LS, 0.5, LZ);
    at(cyl(0.5, 64, ROD, { edges: false }), LS, 32.5, LZ);
    const lens = new T.Group(); at(lens, LX, zeroY, LZ);
    const frame = kit.mesh(new T.TorusGeometry(LR, 0.55, 10, 40), 0x2c3240, { edges: false }); at(frame, 0, 0, 0, lens);
    const lc = document.createElement('canvas'); lc.width = lc.height = 256; const lx = lc.getContext('2d');
    const src = tex.image, ltex = keep(new T.CanvasTexture(lc)); ltex.colorSpace = T.SRGBColorSpace;
    const disc = new T.Mesh(keep(new T.CircleGeometry(LR, 40)), keep(new T.MeshBasicMaterial({ map: ltex }))); at(disc, 0, 0, 0.05, lens);
    const glint = new T.Mesh(keep(new T.CircleGeometry(LR, 40)), keep(new T.MeshBasicMaterial({ color: 0xdff2fb, transparent: true, opacity: 0.12, depthWrite: false }))); at(glint, 0, 0, 0.1, lens);
    const lArm = cyl(0.4, LS - LX - LR, ROD, { edges: false }); lArm.rotation.z = Math.PI / 2; at(lArm, LR + (LS - LX - LR) / 2, 0, 0, lens);
    let lastF = -1;
    const drawLens = F => {
      // область шкалы вокруг указателя, увеличенная в 3 раза
      const pxPerU = src.width / PW, yU = PT - (zeroY - F * NS), cyPx = yU * pxPerU, half = LR / 3 * pxPerU;
      lx.fillStyle = '#f4f6fa'; lx.fillRect(0, 0, 256, 256);
      const cxPx = (LX - DX + PW / 2) * pxPerU;
      lx.drawImage(src, cxPx - half, cyPx - half, half * 2, half * 2, 0, 0, 256, 256);
      lx.fillStyle = '#e5352a'; lx.fillRect(0, 124, 256, 9);
      ltex.needsUpdate = true;
    };
    W.done(n0);
    kit.tag(W(DX - 16, PT - 4, DZ), 'Динамометр', d.div ? 'ц. д. 0,2 Н' : 'ц. д. ?', d.div && d.read);
    kit.tag(W(LS + 1, 67, LZ), 'Лупа', '×3');
    const NAME = { w: 'гиря 100 г', apple: 'яблоко', pen: 'пенал' };
    const hTag = liveTag(kit, W(sx - 9, 10, DZ), 'На крючке', d.hung ? NAME[d.hung] : 'ничего');
    const pose = () => {
      const F = clamp(live().F || 0, -0.5, 5.4), yp = zeroY - F * NS;
      sp.setLen(sTop - yp); mov.position.y = yp; lens.position.y = yp;
      hTag.p.copy(W(sx - 12, yp + hookDY - (hungG ? hungG.userData.h * 0.5 : 0) + 3, DZ));
      if (Math.abs(F - lastF) > 0.004) { lastF = F; drawLens(F); }
    };
    pose(); kit.onFrame(() => pose());
    void fullY;
  };
})();
