// «Как в жизни» для темы «Жидкости и твёрдые тела» (labs/phys-solids): проволочная рамка с мыльной плёнкой и динамометром,
// стеклянная ванночка со скрепкой и водомеркой, капилляры в ванночке с водой или ртутью, электропечь с тиглем и моделью решётки,
// модели алмаза и графита, разрывная машина с проволокой. Сцены строятся из window.LUCH_REAL() опыта;
// плавное движение (перекладина, уровни в капиллярах, нагрев, удлинение) — из window.LUCH_REAL.live() каждый кадр.
// Набор деталей kit — из /luch/real3d.js.
(() => {
  const SC = (window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {});
  const IRON = 0x4a5468, ROD = 0xb9c0cc, RED = 0xe0473a, ORANGE = 0xffb547, TEAL = 0x2b6d7c, BRASS_W = 0xc9a24a,
    CYAN = 0x72d4e8, GREEN = 0x86e0a8, WATER = 0x5fb4d9, HG = 0xc9d1dc, GLASS = 0xcfe8f5, CERAMIC = 0xd8d2c4;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const fmt = (x, n = 1) => (Math.round(x * 10 ** n) / 10 ** n).toFixed(n).replace('.', ',').replace('-', '−');
  const nf = x => Math.abs(x - Math.round(x)) < 1e-9 ? String(Math.round(x)) : fmt(x, 1);
  const live = () => { try { return (window.LUCH_REAL && window.LUCH_REAL.live && window.LUCH_REAL.live()) || {}; } catch (e) { return {}; } };
  const lastTag = () => { const l = document.querySelectorAll('.rl-view .rl-lbl'); return l[l.length - 1] || null; };
  function liveTag(kit, p, name, value, hot) {
    kit.tag(p, name, value, hot);
    const el = lastTag(), i = el && el.querySelector('i');
    let shown = value;
    return { p, set(v) { if (i && v !== shown) { shown = v; i.textContent = v; } } };
  }
  const follow = (cur, tgt, dt, k = 8) => (Math.abs(tgt - cur) < 0.01 ? tgt : cur + (tgt - cur) * Math.min(1, dt * k));

  // ---------- общие детали ----------
  function canvasTex(kit, w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    draw(x, w, h);
    const t = new kit.T.CanvasTexture(c); t.colorSpace = kit.T.SRGBColorSpace; t.anisotropy = 4; return kit.keep(t);
  }
  function plane(kit, w, h, tex, transparent, opacity) {
    const { T, keep } = kit;
    return new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: tex, transparent: !!transparent, opacity: opacity ?? 1, depthWrite: !transparent, side: T.DoubleSide })));
  }
  const textPlate = (kit, txt, w, h, fg = '#1b1610', bg = '#f7f3ea') => plane(kit, w, h, kit.keep(kit.textTex(txt, fg, bg, Math.round(64 * w / h), 64)));
  // прозрачное стекло или жидкость
  const seeMat = (kit, color, opacity) => kit.keep(new kit.T.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: kit.T.DoubleSide }));
  const toonSee = (kit, color, opacity) => kit.keep(new kit.T.MeshToonMaterial({ color, gradientMap: kit.grad, transparent: true, opacity }));
  // стержень между двумя точками (единичный цилиндр, растягиваем)
  function stick(kit, r, color, o = {}) {
    const m = kit.cyl(r, 1, color, { edges: false, hull: false, seg: 10, ...o });
    const Y1 = new kit.T.Vector3(0, 1, 0), d = new kit.T.Vector3();
    m.span = (a, b) => {
      d.copy(b).sub(a); const L = d.length(); m.visible = L > 0.02; if (!m.visible) return;
      m.position.copy(a).addScaledVector(d, 0.5); m.scale.set(1, L, 1); m.quaternion.setFromUnitVectors(Y1, d.normalize());
    };
    return m;
  }
  // динамометр как в лабораториях механики: крючок в (0,0,0), корпус по +y, кольцо на +21,2; setF двигает указатель
  function dynoTex(kit, max) {
    return canvasTex(kit, 128, 960, (x, w, h) => {
      x.fillStyle = '#f4f6fa'; x.fillRect(0, 0, w, h);
      const z0 = 0.5 / 12 * h, z1 = 11.5 / 12 * h;
      x.strokeStyle = '#1b2537'; x.fillStyle = '#1b2537'; x.font = '700 44px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let i = 0; i <= 10; i++) {
        const y = z0 + (z1 - z0) * i / 10, big = i % 2 === 0;
        x.lineWidth = big ? 6 : 3; x.beginPath(); x.moveTo(w * 0.62, y); x.lineTo(w * (big ? 0.98 : 0.84), y); x.stroke();
        if (big) x.fillText(String(max * i / 10), w * 0.3, y + 2);
      }
    });
  }
  function dyno(kit, max) {
    const { T, at, box, cyl, mesh } = kit, g = new T.Group();
    at(box(3.6, 15, 2.4, TEAL), 0, 9.9, 0, g);
    const face = plane(kit, 1.7, 12, dynoTex(kit, max)); at(face, 0.3, 9.9, 1.22, g);
    const ptr = box(2.6, 0.32, 3, RED, { edges: false, matOpt: { emissive: RED, emissiveIntensity: 0.35 } }); at(ptr, 0.3, 15.4, 0, g);
    const hk = mesh(new T.TorusGeometry(0.8, 0.22, 8, 18, Math.PI * 1.6), ROD, { edges: false }); hk.rotation.z = -Math.PI * 0.3; at(hk, 0, -0.2, 0, g);
    at(cyl(0.3, 2.4, ROD, { edges: false, hull: false }), 0, 18.6, 0, g);
    at(cyl(0.22, 2, ROD, { edges: false, hull: false }), 0, 1, 0, g);
    const ring = mesh(new T.TorusGeometry(1.4, 0.45, 10, 24), ORANGE, { edges: false, matOpt: { emissive: ORANGE, emissiveIntensity: 0.25 } }); at(ring, 0, 21.2, 0, g);
    kit.clickable(g, 'pull');
    g.setF = F => { ptr.position.y = 15.4 - clamp(F / max, 0, 1.06) * 11; };
    g.setF(0);
    return g;
  }
  function grow(kit, s, ox, oz) {
    const n0 = kit.root.children.length;
    const W = (x, y, z) => kit.v3(x * s + ox, y * s, z * s + oz);
    W.v = p => W(p.x, p.y, p.z);
    W.done = () => { const g = new kit.T.Group(); g.scale.setScalar(s); g.position.set(ox, 0, oz); kit.root.children.slice(n0).forEach(c => g.add(c)); kit.root.add(g); };
    return W;
  }
  function standBase(kit, x, z, len) {
    kit.at(kit.box(16, 2, 16, IRON), x, 1, z);
    kit.at(kit.cyl(1, len, ROD, { edges: false }), x, 2 + len / 2, z);
  }
  // плёнка: переливается, как мыльный пузырь
  function filmTex(kit) {
    return canvasTex(kit, 256, 256, (x, w, h) => {
      const gr = x.createLinearGradient(0, 0, w, h);
      ['#7fd4ff', '#c79bff', '#ffd36b', '#86e0a8', '#7fd4ff'].forEach((c, i, a) => gr.addColorStop(i / (a.length - 1), c));
      x.fillStyle = gr; x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 3;
      for (let k = 1; k < 6; k++) { x.beginPath(); x.moveTo(0, k * h / 6); x.quadraticCurveTo(w / 2, k * h / 6 - 14, w, k * h / 6); x.stroke(); }
    });
  }

  // =====================================================================================
  // 1. Рамка с мыльной плёнкой: П-образная проволока на штативе, перекладина, динамометр вправо
  SC['solids-frame'] = (kit, d) => {
    const { T, at, box, cyl, clickable, v3 } = kit;
    const U = 3, X0 = -18, YC = 30, l = d.bar * U, W = grow(kit, 1.7, -4, 6), wire = 0x9aa4b6;
    standBase(kit, X0 - 18, 0, YC + 4);
    const arm = cyl(0.8, 18, ROD, { edges: false }); arm.rotation.z = Math.PI / 2; at(arm, X0 - 9, YC, 0);
    at(box(3.6, 3.6, 3.6, IRON), X0 - 18, YC, 0);
    // рамка: закрытая сторона и два рельса
    const rail = (y) => { const r = cyl(0.35, 10 * U, wire, { edges: false, seg: 10 }); r.rotation.z = Math.PI / 2; at(r, X0 + 5 * U, y, 0); };
    rail(YC + l / 2); rail(YC - l / 2);
    at(cyl(0.35, l + 0.7, wire, { edges: false, seg: 10 }), X0, YC, 0);
    // плёнка
    const film = plane(kit, 1, l, filmTex(kit), true, 0.45); at(film, X0, YC, 0);
    // перекладина
    const bar = cyl(0.5, l + 2.4, BRASS_W, { seg: 12 }); at(bar, X0 + U, YC, 0); clickable(bar, 'bcycle');
    // динамометр лежит вдоль рельсов, кольцом вправо
    const dy = dyno(kit, 10); dy.rotation.z = -Math.PI / 2; at(dy, 0, YC, 0);
    // линейка под рамкой с отметкой 6 см
    const rl = canvasTex(kit, 640, 64, (x, w, h) => {
      x.fillStyle = '#e9d9a8'; x.fillRect(0, 0, w, h); x.strokeStyle = '#3b3320'; x.fillStyle = '#3b3320'; x.font = '700 26px "IBM Plex Mono", monospace'; x.textAlign = 'center';
      for (let c = 0; c <= 20; c++) { const px = 20 + c * 30; x.lineWidth = c % 2 ? 2 : 4; x.beginPath(); x.moveTo(px, 0); x.lineTo(px, c % 2 ? 16 : 26); x.stroke(); if (c % 2 === 0) x.fillText(String(c / 2), px, 54); }
      x.fillStyle = '#2f9e5a'; x.fillRect(20 + 12 * 30 - 3, 0, 6, h);
    });
    const rp = plane(kit, 10 * U * 640 / 600, 3, rl); rp.rotation.x = -Math.PI / 2; at(rp, X0 + 10 * U * 0.5 - 0.6 * 0, 0.12, 12);
    at(box(10 * U * 640 / 600, 0.2, 3.2, 0xe9d9a8, { edges: false }), X0 + 15, 0.05, 12);
    W.done();
    kit.tag(W(X0 + 14, YC + l / 2 + 6, 0), 'Мыльная плёнка', 'σ ≈ 0,04 Н/м, две поверхности');
    const dTag = liveTag(kit, W(10, YC + 8, 0), 'Динамометр', '0 мН');
    kit.tag(W(X0 + 18, 2, 14), 'Линейка', 'отметка 6 см');
    let xc = clamp(live().x || 1, 1, 9), acc = 1;
    const pose = dt => {
      const Lv = live(); xc = kit.reduce ? (Lv.x || 1) : follow(xc, Lv.x || 1, dt);
      const bx = X0 + xc * U;
      bar.position.x = bx;
      film.scale.x = Math.max(0.01, xc * U); film.position.x = X0 + xc * U / 2;
      dy.position.x = bx + 0.8; dy.setF(Lv.F || 0);
      dTag.p.copy(W(bx + 12, YC + 6, 2));
      acc += dt;
      if (acc > 0.12) { acc = 0; dTag.set(fmt(Lv.F || 0) + ' мН · отметка ' + nf(Math.round(xc * 2) / 2) + ' см'); }
    };
    pose(1); kit.onFrame(dt => pose(dt));
  };

  // =====================================================================================
  // 1. Скрепка на воде: стеклянная ванночка, стальная скрепка, водомерка, флакон с мылом
  function clipMesh(kit) {
    const { T } = kit, pts = [];
    // контур скрепки в плоскости XZ: две вложенные петли из одной проволоки
    const loop = (x0, x1, r, z0) => { const P = []; for (let k = 0; k <= 10; k++) { const a = Math.PI / 2 + k / 10 * Math.PI; P.push([x0 + Math.cos(a) * r, z0 + Math.sin(a) * r]); } for (let k = 0; k <= 10; k++) { const a = -Math.PI / 2 + k / 10 * Math.PI; P.push([x1 + Math.cos(a) * r, z0 + Math.sin(a) * r]); } return P; };
    const outer = loop(-6, 6, 2.4, 0), inner = loop(-4, 4.4, 1.5, 0.3);
    [...outer.slice(0, 21), ...inner.slice(0, 21).reverse()].forEach(([x, z]) => pts.push(new T.Vector3(x, 0, z)));
    const curve = new T.CatmullRomCurve3(pts, false, 'centripetal');
    return kit.mesh(new T.TubeGeometry(curve, 160, 0.22, 8), 0xc6ccd6, { edges: false });
  }
  function strider(kit) {
    const { T, at, mesh } = kit, g = new T.Group();
    const body = mesh(new T.SphereGeometry(1, 14, 10), 0x3a2e22, { edges: false }); body.scale.set(3.2, 0.7, 0.8); at(body, 0, 1.6, 0, g);
    [[-1, 1], [-1, -1], [1, 1], [1, -1], [0.2, 1], [0.2, -1]].forEach(([sx, sz], i) => {
      const leg = stick(kit, 0.12, 0x3a2e22); g.add(leg);
      const foot = v3k(kit, sx * (i < 4 ? 5.2 : 1.5), 0, sz * (i < 4 ? 3 : 2.6));
      leg.span(v3k(kit, sx * 1.8, 1.6, sz * 0.3), foot);
    });
    return g;
  }
  const v3k = (kit, x, y, z) => new kit.T.Vector3(x, y, z);
  SC['solids-clip'] = (kit, d) => {
    const { T, at, box, cyl, mesh, clickable, v3 } = kit;
    const R = 26, H = 10, WS = 7.5, W = grow(kit, 1.25, -6, 0);
    // ванночка: стеклянные стенки и дно, вода
    const wall = mesh(new T.CylinderGeometry(R, R, H, 48, 1, true), GLASS, { edges: false, mat: seeMat(kit, GLASS, 0.22) }); at(wall, 0, H / 2 + 0.6, 0);
    at(cyl(R, 0.6, GLASS, { edges: false, hull: false, mat: seeMat(kit, GLASS, 0.35) }), 0, 0.3, 0);
    const rim = mesh(new T.TorusGeometry(R, 0.35, 8, 48), GLASS, { edges: false }); rim.rotation.x = Math.PI / 2; at(rim, 0, H + 0.6, 0);
    const water = mesh(new T.CylinderGeometry(R - 0.3, R - 0.3, WS, 48), WATER, { edges: false, mat: seeMat(kit, d.soap ? 0x7fc6e0 : WATER, 0.4) }); at(water, 0, 0.6 + WS / 2, 0);
    clickable(water, 'fresh');
    // скрепка: в пинцете над водой, на воде или на дне
    const clip = clipMesh(kit), cg = new T.Group(); cg.add(clip); at(cg, 0, 0, 0); clickable(cg, 'clip');
    if (d.clip === 'hand') {
      [-0.6, 0.6].forEach(z => { const tw = box(0.5, 20, 0.5, 0x8b96ad, { edges: false }); tw.rotation.x = z * 0.05; at(tw, 6, 0, z, cg).position.y = 10.5; });
    }
    // ямка на поверхности под скрепкой
    const dimple = mesh(new T.SphereGeometry(1, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), WATER, { edges: false, mat: seeMat(kit, 0xbfe6f7, 0.5) });
    dimple.scale.set(7.5, 0.7, 3.4); at(dimple, 0, 0.6 + WS + 0.02, 0); dimple.visible = d.clip === 'float';
    // водомерка: на воде или на краю
    const st = strider(kit); if (!d.soap) at(st, -12, 0.6 + WS - 0.3, -10); else { at(st, -R + 1, H + 0.6, -6); st.rotation.y = 0.4; }
    st.rotation.y = 0.5;
    // флакон с мылом
    const bottle = new T.Group(); at(bottle, R + 12, 0, 6); clickable(bottle, 'soap');
    at(cyl(3.2, 11, GREEN), 0, 5.5, 0, bottle); at(cyl(1.6, 2.4, 0xe8ecf4), 0, 12.2, 0, bottle); at(cyl(0.2, 3, 0xe8ecf4, { r2: 0.6 }), 0, 14.6, 0, bottle);
    const lbl = textPlate(kit, 'мыло', 4.6, 2, '#1b1610', '#86e0a8'); at(lbl, 0, 6, 3.22, bottle);
    W.done();
    kit.tag(W(0, H + 4, -R + 2), 'Ванночка', d.soap ? 'мыльная вода, σ ≈ 0,04 Н/м' : 'чистая вода, σ ≈ 0,073 Н/м');
    kit.tag(W(-12, WS + 6, -10), 'Водомерка', d.soap ? 'выбралась на край' : 'бегает по поверхности');
    kit.tag(W(R + 12, 18, 6), 'Мыло', d.soap ? 'уже в воде' : 'нажмите — капнуть');
    const cTag = liveTag(kit, W(0, WS + 8, 6), 'Скрепка 1 г', d.clip === 'hand' ? 'в пинцете' : d.clip === 'float' ? 'лежит на воде' : 'тонет');
    let yc = d.clip === 'sink' ? 0 : 1;
    const pose = dt => {
      const Lv = live();
      if (d.clip === 'hand') cg.position.y = 0.6 + WS + 9;
      else if (d.clip === 'float') cg.position.y = 0.6 + WS + 0.05;
      else { const tgt = clamp(Lv.clipY || 1, 0, 1); yc = kit.reduce ? tgt : follow(yc, tgt, dt, 4); cg.position.y = 0.6 + WS - yc * (WS - 0.4); cTag.set(yc > 0.95 ? 'на дне' : 'тонет'); }
      cTag.p.copy(W(0, cg.position.y + 5, 6));
    };
    pose(1); kit.onFrame(dt => pose(dt));
  };

  // =====================================================================================
  // 2. Капилляры: стеклянная ванночка с водой или ртутью, три трубки на штативе, линейка в мм
  SC['solids-capil'] = (kit, d) => {
    const { T, at, box, cyl, mesh, clickable } = kit;
    const MM = 0.45, BW = 56, BD = 22, BH = 14, LS = 11, XS = [-16, 0, 16], RV = [1.6, 1.05, 0.65], TL = 46, W = grow(kit, 1.3, 0, 0);
    const hg = d.liq === 'hg', col = hg ? HG : WATER;
    // ванночка
    const glassBox = mesh(new T.BoxGeometry(BW, BH, BD), GLASS, { edges: true, mat: seeMat(kit, GLASS, 0.16) }); at(glassBox, 0, BH / 2, 0);
    const liq = mesh(new T.BoxGeometry(BW - 0.6, LS, BD - 0.6), col, { edges: false, mat: hg ? toonSee(kit, HG, 0.55) : seeMat(kit, WATER, 0.4) }); at(liq, 0, LS / 2 + 0.2, 0);
    clickable(liq, 'liq'); clickable(glassBox, 'liq');
    // перекладина-держатель трубок
    standBase(kit, -BW / 2 - 10, -6, 62);
    const beam = cyl(0.8, BW + 12, ROD, { edges: false }); beam.rotation.z = Math.PI / 2; at(beam, -4, 62, -6);
    const tubes = [];
    XS.forEach((x, i) => {
      const g = new T.Group(); at(g, x, 0, 0); clickable(g, 'tube-' + i);
      const glass = mesh(new T.CylinderGeometry(RV[i] + 0.35, RV[i] + 0.35, TL, 20, 1, true), GLASS, { edges: false, mat: seeMat(kit, GLASS, 0.32) }); at(glass, 0, TL / 2, 0, g);
      const rimT = mesh(new T.TorusGeometry(RV[i] + 0.35, 0.12, 6, 20), GLASS, { edges: false }); rimT.rotation.x = Math.PI / 2; at(rimT, 0, TL, 0, g);
      const colm = cyl(RV[i], 1, col, { edges: false, hull: false, seg: 16, mat: hg ? kit.toon(HG) : seeMat(kit, WATER, 0.85) }); at(colm, 0, 0, 0, g);
      const men = mesh(new T.SphereGeometry(RV[i], 14, 8, 0, Math.PI * 2, hg ? 0 : Math.PI / 2, Math.PI / 2), col, { edges: false, mat: hg ? kit.toon(HG) : seeMat(kit, 0xbfe6f7, 0.8) }); men.scale.y = 0.45; at(men, 0, 0, 0, g);
      // зажим на держателе
      const cl = box(2.4, 2, 2.4, IRON, { edges: false }); at(cl, 0, 0, 0, g);
      const stem = stick(kit, 0.3, ROD); kit.root.add(stem);
      const lbl = textPlate(kit, 'r ' + String(i === 0 ? 1 : i === 1 ? 0.5 : 0.25).replace('.', ',') + ' мм', 6.4, 1.8, '#1b1610', '#f7f3ea'); at(lbl, 0, TL + 2.4, 0, g);
      tubes.push({ g, colm, men, cl, stem, i });
    });
    // линейка в мм от уровня жидкости
    const UP = 65, DN = 25, RH = (UP + DN) * MM;
    const rt = canvasTex(kit, 96, Math.round(96 * RH / 3), (x, w, h) => {
      x.fillStyle = '#e9d9a8'; x.fillRect(0, 0, w, h); x.strokeStyle = '#3b3320'; x.fillStyle = '#3b3320'; x.font = '700 30px "IBM Plex Mono", monospace'; x.textAlign = 'right'; x.textBaseline = 'middle';
      for (let c = -DN; c <= UP; c += 5) { const y = h - (c + DN) * MM / RH * h; x.lineWidth = c % 10 ? 2 : 4; x.beginPath(); x.moveTo(0, y); x.lineTo(c % 10 ? 24 : 44, y); x.stroke(); if (c % 10 === 0) x.fillText(String(c), w - 6, y); }
    });
    const y0 = 0.2 + LS - DN * MM;
    at(box(3, RH, 0.6, 0xe9d9a8), BW / 2 + 5, y0 + RH / 2, BD / 2 - 2);
    const rp = plane(kit, 2.8, RH, rt); at(rp, BW / 2 + 5, y0 + RH / 2, BD / 2 - 1.68);
    W.done();
    kit.tag(W(-BW / 2 + 6, BH + 2, BD / 2), hg ? 'Ртуть' : 'Вода', hg ? 'не смачивает стекло, θ ≈ 140°' : 'смачивает стекло, θ ≈ 0°');
    const tTags = tubes.map(t => liveTag(kit, W(XS[t.i], 30, 2), ['r = 1 мм', 'r = 0,5 мм', 'r = 0,25 мм'][t.i], '—'));
    const dy = XS.map((x, i) => (d.dip[i] ? 0 : 1));
    let lv = (live().lev || [0, 0, 0]).slice(), acc = 1;
    const pose = dt => {
      const Lv = live(), lev = Lv.lev || [0, 0, 0];
      tubes.forEach(t => {
        const i = t.i, tgt = d.dip[i] ? 0 : 1; dy[i] = kit.reduce ? tgt : follow(dy[i], tgt, dt, 6);
        const bot = 1 + dy[i] * 16; t.g.position.y = bot;
        lv[i] = lev[i] ?? 0;
        const top = 0.2 + LS + lv[i] * MM - bot, inLiq = 0.2 + LS - bot > 0.05;
        t.colm.visible = t.men.visible = inLiq || Math.abs(lv[i]) > 0.3;
        const ht = Math.max(0.05, Math.min(TL, top));
        t.colm.scale.y = ht; t.colm.position.y = ht / 2; t.men.position.y = ht;
        t.cl.position.y = TL - 6;
        t.stem.span(new T.Vector3(XS[i], bot + TL - 6, 0), new T.Vector3(XS[i], 62, -6));
        tTags[i].p.copy(W(XS[i] + 2, bot + TL + 4, 2));
      });
      acc += dt;
      if (acc > 0.12) { acc = 0; tubes.forEach(t => tTags[t.i].set(d.dip[t.i] ? 'h = ' + fmt(lv[t.i], 0) + ' мм' : 'над жидкостью')); }
    };
    pose(1); kit.onFrame(dt => pose(dt));
  };

  // =====================================================================================
  // 3. Нагрев: электропечь с тиглем, термопара с табло, шаровая модель решётки (кристалл или беспорядок)
  SC['solids-heat'] = (kit, d) => {
    const { T, at, box, cyl, mesh, clickable } = kit;
    const W = grow(kit, 1.35, -4, 0), cr = d.kind === 'cr';
    // печь
    const plate = new T.Group(); at(plate, -16, 0, 0); clickable(plate, 'heat');
    at(box(30, 10, 24, 0x3a4762), 0, 5, 0, plate);
    const top = box(26, 0.8, 20, 0x6c7a96, { edges: false, matOpt: { emissive: 0xff5a1a, emissiveIntensity: 0 } }); at(top, 0, 10.4, 0, plate);
    const knob = cyl(1.6, 1, 0x6c7a96); knob.rotation.x = Math.PI / 2; at(knob, 9, 5, 12.2, plate);
    const lamp = box(2.6, 1.4, 0.4, 0x5a6680, { edges: false, matOpt: { emissive: 0xff3a1a, emissiveIntensity: 0 } }); at(lamp, -8, 5, 12.1, plate);
    // тигель
    const cru = new T.Group(); at(cru, -16, 10.8, 0); clickable(cru, 'samp');
    at(mesh(new T.CylinderGeometry(6.4, 4.8, 8, 28, 1, true), CERAMIC, { edges: false, mat: kit.toon(CERAMIC, { side: T.DoubleSide }) }), 0, 4, 0, cru);
    at(cyl(4.8, 0.6, CERAMIC, { edges: false }), 0, 0.3, 0, cru);
    // образец
    const solid = new T.Group(); at(solid, 0, 0.6, 0, cru);
    const iceC = d.samp === 'ice' ? 0xcfeefc : 0xf1f1ee, liqC = d.samp === 'ice' ? WATER : 0xffb36b;
    const pieces = [];
    if (cr) [[-1.8, -1.2, 2.6], [1.8, -0.8, 2.2], [0, 1.8, 2.4], [-0.4, -0.2, 2]].forEach(([x, z, s], k) => { const b = box(s, s, s, iceC, { edges: true }); b.rotation.y = k * 0.6; at(b, x, s / 2 + (k === 3 ? 2.2 : 0), z, solid); pieces.push(b); });
    const pool = cyl(5, 1, liqC, { edges: false, hull: false, mat: d.samp === 'ice' ? seeMat(kit, WATER, 0.7) : kit.toon(liqC, { emissive: 0xff6a1a, emissiveIntensity: 0.3 }) }); at(pool, 0, 0.6, 0, cru);
    const amC = d.samp === 'rosin' ? 0xd9a441 : 0x9fd8c8;
    const blob = mesh(new T.SphereGeometry(3.6, 24, 16), amC, { edges: false, hull: true, mat: kit.toon(amC, { emissive: 0xff6a1a, emissiveIntensity: 0 }) }); at(blob, 0, 3, 0, cru); blob.visible = !cr;
    // термопара и табло
    const probe = stick(kit, 0.25, ROD); kit.root.add(probe); probe.span(new T.Vector3(-14, 13, 2), new T.Vector3(-4, 24, 2));
    const probe2 = stick(kit, 0.25, ROD); kit.root.add(probe2); probe2.span(new T.Vector3(-4, 24, 2), new T.Vector3(4, 24, 2));
    const disp = new T.Group(); at(disp, 8, 0, 4);
    at(box(10, 7, 5, TEAL), 0, 3.5, 0, disp); at(box(8, 3, 0.2, 0x0e1520, { edges: false }), 0, 4.4, 2.55, disp);
    const probe3 = stick(kit, 0.25, ROD); kit.root.add(probe3); probe3.span(new T.Vector3(4, 24, 2), new T.Vector3(8, 7, 4));
    // модель решётки на подставке
    const lat = new T.Group(); at(lat, 30, 0, -6); clickable(lat, 'v-diamond');
    at(cyl(7, 1.2, 0x3a4762), 0, 0.6, 0, lat); at(cyl(0.5, 6, ROD, { edges: false }), 0, 4, 0, lat);
    const balls = [], N = 3, st = 4.4, base = new T.Vector3(0, 15, 0);
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
      const salt = d.samp === 'salt', c = cr ? (salt ? ((i + j + k) % 2 ? GREEN : 0xe8ecf4) : 0x9fd8f0) : (d.samp === 'rosin' ? 0xe3b25a : 0x9fd8c8);
      const r = cr && salt ? ((i + j + k) % 2 ? 1.5 : 1.0) : 1.2;
      const b = mesh(new T.SphereGeometry(r, 14, 10), c, { edges: false, hull: true });
      const home = cr ? new T.Vector3((i - 1) * st, (j - 1) * st, (k - 1) * st) : new T.Vector3((rnd() - 0.5) * 11, (rnd() - 0.5) * 11, (rnd() - 0.5) * 11);
      at(b, base.x + home.x, base.y + home.y, base.z + home.z, lat);
      balls.push({ b, home, ph: rnd() * 6.28, free: new T.Vector3((rnd() - 0.5) * 5, (rnd() - 0.5) * 5, (rnd() - 0.5) * 5), q: rnd() });
    }
    if (cr) for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
      // стержни решётки вдоль осей
      [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach(([a, b2, c]) => { if (i + a < N && j + b2 < N && k + c < N) { const s2 = stick(kit, 0.18, 0x8b96ad); lat.add(s2); s2.span(new T.Vector3((i - 1) * st, (j - 1) * st + 15, (k - 1) * st), new T.Vector3((i + a - 1) * st, (j + b2 - 1) * st + 15, (k + c - 1) * st)); s2.userData.lat = true; } });
    }
    W.done();
    const tTag = liveTag(kit, W(8, 12, 4), 'Термопара', '— °C');
    kit.tag(W(-16, 24, 0), 'Тигель: ' + d.name.toLowerCase(), cr ? 'кристалл · нажмите — другой образец' : 'аморфное · нажмите — другой образец');
    kit.tag(W(-16, -1, 13), d.hot ? 'Электропечь' : 'Нагреватель', 'нажмите — нагрев');
    kit.tag(W(30, 27, -6), cr ? 'Модель кристалла' : 'Модель аморфного тела', cr ? 'частицы в узлах решётки' : 'порядка нет');
    let t = 0, acc = 1;
    const pose = dt => {
      const Lv = live(), f = Lv.f || 0, heat = !!Lv.heat; t += dt;
      top.material = kit.toon(0x6c7a96, { emissive: 0xff5a1a, emissiveIntensity: heat ? 0.8 : 0 });
      lamp.material = kit.toon(0x5a6680, { emissive: 0xff3a1a, emissiveIntensity: heat ? 1 : 0 });
      if (cr) { pieces.forEach((p, k) => { const s = Math.max(0.001, 1 - f * (0.7 + k * 0.1)); p.scale.setScalar(s); p.visible = s > 0.05; }); pool.scale.y = 0.2 + f * 2.4; pool.position.y = 0.6 + pool.scale.y / 2; pool.visible = f > 0.01; }
      else { blob.scale.set(1 + f * 0.55, 1 - f * 0.65, 1 + f * 0.55); blob.position.y = 3 - f * 2; blob.material = kit.toon(amC, { emissive: 0xff6a1a, emissiveIntensity: d.samp === 'glass' ? f * 0.6 : 0 }); pool.visible = false; }
      const amp = kit.reduce ? 0 : 0.12 + 0.5 * clamp(f + (heat ? 0.2 : 0), 0, 1);
      balls.forEach(B => {
        const loose = cr && B.q < f, p = B.home.clone(); if (loose) p.add(B.free);
        if (!cr) p.addScaledVector(B.free, f * 0.4);
        B.b.position.set(base.x + p.x + Math.sin(t * 9 + B.ph) * amp, base.y + p.y + Math.cos(t * 11 + B.ph) * amp, base.z + p.z + Math.sin(t * 7 + B.ph * 2) * amp);
      });
      lat.children.forEach(c => { if (c.userData.lat) c.visible = f < 0.5; });
      acc += dt; if (acc > 0.12) { acc = 0; tTag.set(Math.round(Lv.T ?? 0) + ' °C'); }
    };
    pose(0.016); kit.onFrame(dt => pose(dt));
  };

  // =====================================================================================
  // 3. Углерод: шаровые модели алмаза (объёмная сетка) и графита (слои)
  function carbonPts() {
    const dia = [], db = [], fcc = [[0, 0, 0], [0, .5, .5], [.5, 0, .5], [.5, .5, 0]];
    for (const [a, b, c] of fcc) for (const o of [[0, 0, 0], [.25, .25, .25]]) for (const dx of [0, 1]) for (const dy of [0, 1]) for (const dz of [0, 1]) {
      const p = [a + o[0] + dx, b + o[1] + dy, c + o[2] + dz];
      if (p.every(v => v <= 1.001) && !dia.some(q => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) < 1e-3)) dia.push(p);
    }
    for (let i = 0; i < dia.length; i++) for (let j = i + 1; j < dia.length; j++) if (Math.abs(Math.hypot(dia[i][0] - dia[j][0], dia[i][1] - dia[j][1], dia[i][2] - dia[j][2]) - Math.sqrt(3) / 4) < 0.01) db.push([i, j]);
    const gr = [], gb = [], a = 1;
    for (let L = 0; L < 3; L++) {
      const base = gr.length, sh = L % 2 ? a : 0;
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
        // гексагональная сетка: два атома в ячейке
        const x = i * 1.5 * a + sh, z = (j + (i % 2 ? 0.5 : 0)) * Math.sqrt(3) * a;
        [[x, z], [x + a, z]].forEach(([px, pz]) => { if (Math.hypot(px - sh * 0.5, pz) < 3.2 && !gr.slice(base).some(q => Math.hypot(q[0] - px, q[2] - pz) < 0.05)) gr.push([px, L * 2.36, pz]); });
      }
      for (let i = base; i < gr.length; i++) for (let j = i + 1; j < gr.length; j++) if (Math.abs(Math.hypot(gr[i][0] - gr[j][0], gr[i][2] - gr[j][2]) - a) < 0.05) gb.push([i, j]);
    }
    return { dia, db, gr, gb };
  }
  SC['solids-carbon'] = (kit, d) => {
    const { T, at, cyl, mesh, clickable } = kit, P = carbonPts(), W = grow(kit, 1.3, 0, 0);
    const model = (pts, bonds, sc, ox, sel, key, col, lift) => {
      const g = new T.Group(); at(g, ox, 0, 0); clickable(g, key);
      at(cyl(9, 1.4, sel ? 0x2b6d7c : 0x3a4762), 0, 0.7, 0, g); at(cyl(0.5, lift - 2, ROD, { edges: false }), 0, lift / 2 + 0.7, 0, g);
      const m = new T.Group(); at(m, 0, lift, 0, g);
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length, cz = pts.reduce((s, p) => s + p[2], 0) / pts.length;
      const V = p => new T.Vector3((p[0] - cx) * sc, (p[1] - cy) * sc, (p[2] - cz) * sc);
      pts.forEach(p => at(mesh(new T.SphereGeometry((sel ? 1.15 : 0.95) * (sc < 5 ? 0.6 : 1), 14, 10), sel ? col : 0x5a6680, { edges: false, hull: true }), V(p).x, V(p).y, V(p).z, m));
      bonds.forEach(([i, j]) => { const s = stick(kit, 0.28, sel ? 0x8b96ad : 0x3a4762); m.add(s); s.span(V(pts[i]), V(pts[j])); });
      return m;
    };
    const selD = d.view === 'diamond';
    const mD = model(P.dia, P.db, 12, -22, selD, 'v-diamond', 0x9fd8f0, 16);
    const mG = model(P.gr, P.gb, 3.2, 22, !selD, 'v-graphite', 0xa9b4c9, 14);
    // карандаш рядом с графитом, кольцо с камнем — рядом с алмазом
    const pen = new T.Group(); at(pen, 30, 1.2, 18); pen.rotation.y = -0.6; clickable(pen, 'back');
    const pb = cyl(0.9, 16, 0xf2c94c, { seg: 6 }); pb.rotation.z = Math.PI / 2; at(pb, 0, 0, 0, pen);
    const tip = cyl(0.01, 2.6, 0xe9d9a8, { r2: 0.9, seg: 6 }); tip.rotation.z = Math.PI / 2; at(tip, -9.3, 0, 0, pen);
    const ring = mesh(new T.TorusGeometry(2.2, 0.45, 10, 24), BRASS_W, { edges: false }); ring.rotation.x = Math.PI / 2; at(ring, -30, 0.5, 18); clickable(ring, 'back');
    const gem = mesh(new T.OctahedronGeometry(1.2), 0xe8f6ff, { edges: true }); at(gem, -30, 2.4, 15.8); clickable(gem, 'back');
    W.done();
    kit.tag(W(-22, 30, 0), 'Алмаз', selD ? 'каждый атом — 4 связи, твёрдость 10' : 'нажмите — рассмотреть');
    kit.tag(W(22, 28, 0), 'Графит', !selD ? 'слои, проводит ток, твёрдость 1–2' : 'нажмите — рассмотреть');
    kit.tag(W(30, 3, 18), 'Карандаш', 'нажмите — к нагреву');
    let t = 0;
    kit.onFrame(dt => { if (kit.reduce) return; t += dt; (selD ? mD : mG).rotation.y = t * 0.35; });
  };

  // =====================================================================================
  // 4. Разрывная машина: колонны, траверса с датчиком силы, проволока в зажимах, индикатор удлинения, катушки проволоки
  SC['solids-tensile'] = (kit, d) => {
    const { T, at, box, cyl, mesh, clickable } = kit;
    const W = grow(kit, 1.2, -8, 0), TOP = 70, UG = 64, LEN = 40, wr = 0.25 + d.d * 0.22, wc = parseInt(d.col.slice(1), 16);
    at(box(44, 4, 22, 0x4a5468), 0, 2, 0);
    [-16, 16].forEach(x => at(cyl(1.6, TOP - 4, ROD, { edges: false }), x, 4 + (TOP - 4) / 2, 0));
    at(box(40, 5, 8, 0x3a4762), 0, TOP + 2.5, 0);
    // датчик силы на траверсе
    const disp = new T.Group(); at(disp, 0, TOP + 5, 0); clickable(disp, 'f0');
    at(box(14, 6, 4, TEAL), 0, 3, 0, disp); at(box(12, 3.4, 0.2, 0x0e1520, { edges: false }), 0, 3, 2.05, disp);
    // зажимы и проволока
    at(box(5, 6, 5, 0xa9b4c9), 0, UG + 3, 0);
    const wireTop = stick(kit, wr, wc, { hull: true }); kit.root.add(wireTop);
    const wireBot = stick(kit, wr, wc, { hull: true }); kit.root.add(wireBot);
    const low = new T.Group(); at(low, 0, 0, 0);
    at(box(5, 6, 5, 0xa9b4c9), 0, -3, 0, low);
    at(box(30, 4, 7, 0x3a4762), 0, -8, 0, low);
    const screw = stick(kit, 1.1, 0x8b96ad); kit.root.add(screw);
    // рукоятка
    const handle = new T.Group(); at(handle, 0, -8, 4.5, low); clickable(handle, 'pull');
    const hb = cyl(0.8, 14, ORANGE, { matOpt: { emissive: ORANGE, emissiveIntensity: 0.25 } }); hb.rotation.z = Math.PI / 2; at(hb, 0, 0, 0, handle);
    // индикатор удлинения
    const dial = new T.Group(); at(dial, 9, UG - 14, 3);
    const face = cyl(3.2, 1.2, 0xf4f6fa); face.rotation.x = Math.PI / 2; at(face, 0, 0, 0, dial);
    const needle = box(0.3, 2.6, 0.2, RED, { edges: false }); needle.geometry.translate(0, 1.3, 0); at(needle, 0, 0, 0.75, dial);
    const arm = stick(kit, 0.2, ROD); kit.root.add(arm);
    // защитный экран
    const screen = mesh(new T.PlaneGeometry(30, 50), GLASS, { edges: false, mat: seeMat(kit, GLASS, 0.12) }); screen.castShadow = false; at(screen, 0, 30, 11.5);
    // катушки проволоки: нажать — сменить материал
    const sp = new T.Group(); at(sp, 38, 0, 10); clickable(sp, 'mat');
    [[0xa9b4c9, -6], [0xd98a4e, 0], [0xd4d9e2, 6]].forEach(([c, x]) => { const s = cyl(2.6, 3, c); s.rotation.x = Math.PI / 2; at(s, x, 2.6, 0, sp); const ax = cyl(0.8, 3.6, 0x3a4762, { edges: false }); ax.rotation.x = Math.PI / 2; at(ax, x, 2.6, 0, sp); });
    W.done();
    const fTag = liveTag(kit, W(0, TOP + 14, 0), 'Датчик силы', '0 Н');
    const wTag = liveTag(kit, W(-14, UG - 20, 0), d.name + ', d = ' + d.d + ' мм', 'σ = 0 МПа');
    const gTag = liveTag(kit, W(20, UG - 12, 3), 'Индикатор', 'ΔL = 0 мм');
    kit.tag(W(38, 8, 10), 'Катушки', 'сталь · медь · алюминий');
    let ec = live().eps || 0, acc = 1;
    const pose = dt => {
      const Lv = live(), e = Lv.eps || 0; ec = kit.reduce ? e : follow(ec, e, dt, 6);
      const yl = UG - LEN - ec * LEN * 0.9 - (Lv.F || 0) / 3000 * 2;
      low.position.y = yl;
      const a = new T.Vector3(0, UG, 0), b = new T.Vector3(0, yl, 0);
      if (d.broken) { const m = a.clone().lerp(b, 0.5); wireTop.span(a, m.clone().add(new T.Vector3(0, 1.2, 0))); wireBot.span(m.clone().add(new T.Vector3(0, -1.2, 0)), b); }
      else { wireTop.span(a, a.clone().lerp(b, 0.5)); wireBot.span(a.clone().lerp(b, 0.5), b); }
      screw.span(new T.Vector3(0, 4, 0), new T.Vector3(0, yl - 10, 0));
      arm.span(new T.Vector3(1.2, yl + 1, 2), new T.Vector3(9, UG - 17, 3));
      const dl = ec * 1000; needle.rotation.z = -(dl % 1) * Math.PI * 2;
      acc += dt;
      if (acc > 0.12) { acc = 0; fTag.set(d.broken ? 'разрыв' : Math.round(Lv.F || 0) + ' Н'); wTag.set(d.broken ? 'разорвана' : 'σ = ' + Math.round(Lv.sig || 0) + ' МПа'); gTag.set('ΔL = ' + fmt(dl, dl < 10 ? 2 : 1) + ' мм'); }
      wTag.p.copy(W(-14, (UG + yl) / 2, 0));
    };
    pose(1); kit.onFrame(dt => pose(dt));
  };
})();
