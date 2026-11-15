// «Как в жизни» для темы «Переменный ток» (labs/phys-ac): колебательный контур, R, C и L на переменном токе, радиосвязь.
// Описание сцены приходит из window.LUCH_REAL() опыта; быстрое состояние (заряд, ток, фаза) — из window.LUCH_REAL.live() каждый кадр.
(() => {
  const SC = (window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {});
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const live = () => { try { const f = window.LUCH_REAL && window.LUCH_REAL.live; return f ? f() : null; } catch (e) { return null; } };
  const TAU = Math.PI * 2;

  // ---------- общие детали этой темы ----------
  function tools(kit) {
    const { T, at, box, cyl, mesh, keep, v3, C } = kit;
    const W = (g, p) => { g.updateMatrixWorld(true); return p.clone().applyMatrix4(g.matrixWorld); };
    // провод по точкам (мировые координаты)
    function wire(pts, col, r = 0.95) {
      const curve = new T.CatmullRomCurve3(pts, false, 'centripetal');
      kit.root.add(mesh(new T.TubeGeometry(curve, Math.max(30, Math.round(curve.getLength() * 1.4)), r, 10), col, { hull: true, edges: false }));
      return curve;
    }
    // от клеммы a вверх, по столу через via, вверх к клемме b
    function run(a, b, col, o = {}) {
      const lift = o.lift ?? 3, y = o.y ?? 1.3;
      const via = o.via || [a.clone().lerp(b, 0.3).setY(y), a.clone().lerp(b, 0.7).setY(y)];
      return wire([a, a.clone().add(v3(0, lift, 0)), ...via, b.clone().add(v3(0, o.liftB ?? lift, 0)), b], col, o.r);
    }
    // огоньки тока, которые бегут в обе стороны: set(v, dt) — v от −1 до 1 (знак — направление)
    let dashBase = null;
    function flow(curve, r = 0.95) {
      if (!dashBase) {
        const c = document.createElement('canvas'); c.width = 64; c.height = 8; const x = c.getContext('2d');
        x.fillStyle = '#ffd166'; x.fillRect(8, 0, 16, 8);
        dashBase = keep(new T.CanvasTexture(c)); dashBase.colorSpace = T.SRGBColorSpace;
      }
      const tex = keep(dashBase.clone()); tex.wrapS = T.RepeatWrapping; tex.needsUpdate = true;
      tex.repeat.set(Math.max(1, curve.getLength() / 12), 1);
      const mat = keep(new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
      const m = new T.Mesh(keep(new T.TubeGeometry(curve, Math.max(30, Math.round(curve.getLength() * 1.4)), r * 1.08, 10)), mat);
      m.renderOrder = 2; kit.root.add(m);
      return { set(v, dt, move = true) { if (move && !kit.reduce) tex.offset.x -= clamp(v, -1.5, 1.5) * dt * 2.4; mat.opacity = clamp(Math.abs(v) * 1.8, 0, 1); } };
    }
    // табличка с текстом
    function plate(txt, w, h, fg = '#1b1610', bg = '#f7f3ea') {
      const t = keep(kit.textTex(txt, fg, bg, Math.round(64 * w / h), 64));
      return new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: t })));
    }
    // экран, который перерисовывается каждый кадр
    function screen(w, h, pw = 288, ph = 192) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph;
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace;
      const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: tex })));
      return { m, c, x: c.getContext('2d'), tex, W: pw, H: ph };
    }
    const glow = (col, s, op) => { const h = new T.Sprite(keep(new T.SpriteMaterial({ map: kit.glowTex(), color: col, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: op }))); h.scale.setScalar(s); return h; };
    const own = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: kit.grad, ...o }));
    const basic = (color, o = {}) => keep(new T.MeshBasicMaterial({ color, ...o }));

    // осциллограф: экран спереди (+z), гнёзда щупов сверху сзади
    function scope(o = {}) {
      const g = new T.Group();
      for (const [x, z] of [[-14, -7], [14, -7], [-14, 7], [14, 7]]) at(box(3, 1.2, 3, C.DARK), x, 0.6, z, g);
      at(box(34, 20, 18, 0x56657e), 0, 11.2, 0, g);
      at(box(35, 1.4, 19, 0x46536a), 0, 21.6, 0, g);
      at(box(1.4, 3, 1.4, C.DARK), -6, 23.4, 0, g); at(box(1.4, 3, 1.4, C.DARK), 6, 23.4, 0, g); at(box(14, 1.4, 2, C.DARK), 0, 25.2, 0, g);
      at(box(22, 15.6, 0.8, 0x1b1f28), -5, 12.2, 9.2, g);
      const scr = screen(20, 13.6); at(scr.m, -5, 12.2, 9.65, g);
      // ручки развёртки и усиления
      for (const [x, y, r] of [[10, 17.5, 1.9], [14.4, 17.5, 1.9], [10, 12.2, 1.5], [14.4, 12.2, 1.5]]) { const k = cyl(r, 1.4, 0xd9dfe9, { seg: 18 }); k.rotation.x = Math.PI / 2; at(k, x, y, 9.7, g); at(box(0.4, r * 0.9, 0.3, C.INK, { edges: false }), x, y + r * 0.45, 10.45, g); }
      // гнёзда входов спереди (желтое — канал 1, голубое — канал 2)
      for (const [x, c] of [[-12, 0xf2c94c], [-6, 0x72d4e8]]) { const j = cyl(1.2, 1.2, c, { seg: 14 }); j.rotation.x = Math.PI / 2; at(j, x, 2.8, 9.6, g); }
      const btns = [];
      (o.buttons || []).forEach((b, k) => {
        const bg = new T.Group(); at(bg, 9.6 + k * 5.2, 6.2, 9.4, g);
        at(box(4.2, 3.4, 1.4, b.col), 0, 0, 0, bg);
        const p = plate(b.txt, 3.6, 2.4, '#ffffff', b.bg || '#2c3240'); at(p, 0, 0, 0.72, bg);
        kit.clickable(bg, b.key); btns.push(bg);
      });
      // щупы выходят сверху сзади
      const jA = v3(-10, 21.6, -9.6), jB = v3(-4, 21.6, -9.6);
      at(box(3, 2, 1.2, 0x2c3240), -10, 20, -9.4, g); at(box(3, 2, 1.2, 0x2c3240), -4, 20, -9.4, g);
      return { g, scr, jA, jB, top: 27 };
    }
    function grid(s) {
      const { x, W: w, H: h } = s;
      x.fillStyle = '#06261a'; x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(140,255,190,.13)'; x.lineWidth = 1;
      for (let i = 1; i < 10; i++) { x.beginPath(); x.moveTo(w * i / 10, 0); x.lineTo(w * i / 10, h); x.stroke(); }
      for (let j = 1; j < 8; j++) { x.beginPath(); x.moveTo(0, h * j / 8); x.lineTo(w, h * j / 8); x.stroke(); }
      x.strokeStyle = 'rgba(140,255,190,.38)'; x.beginPath(); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.stroke();
    }
    function trace(s, pts, col) {
      const { x } = s; if (pts.length < 2) return;
      x.strokeStyle = col; x.lineWidth = 3.4; x.lineJoin = 'round'; x.shadowColor = col; x.shadowBlur = 8;
      x.beginPath(); pts.forEach(([px, py], k) => k ? x.lineTo(px, py) : x.moveTo(px, py)); x.stroke(); x.shadowBlur = 0;
    }
    function legend(s, items) { const { x } = s; x.font = '700 20px "IBM Plex Mono", monospace'; x.textBaseline = 'top'; let px = 10; for (const [t, c] of items) { x.fillStyle = c; x.fillText(t, px, 8); px += x.measureText(t).width + 18; } }

    // катушка: обмотка из медной проволоки на каркасе, на подставке; клеммы спереди
    function coilPart(o) {
      const g = new T.Group(), len = o.len, r = o.r, y0 = kit.baseBlock(g, len + 14, o.dep || 13);
      const cy = y0 + r + 3.4;
      for (const s of [-1, 1]) { at(box(1.8, cy - y0 + 1, 7, 0x3a3f4c), s * (len / 2 + 1.8), y0 + (cy - y0 + 1) / 2, 0, g); const f = cyl(r + 1.5, 1, 0x3a3f4c); f.rotation.z = Math.PI / 2; at(f, s * (len / 2 + 0.5), cy, 0, g); }
      const fr = cyl(r * 0.92, len + 1.2, 0xe3cfa6); fr.rotation.z = Math.PI / 2; at(fr, 0, cy, 0, g);
      if (o.core) { at(box(len + 9, r * 1.05, r * 1.05, 0x8b93a1), 0, cy, 0, g); for (let k = -3; k <= 3; k++) at(box(len + 9.1, 0.12, r * 1.06, 0x5d6573, { edges: false, shadow: false }), 0, cy + k * r * 0.15, 0, g); }
      const N = o.turns * 24, pts = [];
      for (let k = 0; k <= N; k++) { const a = k / N * o.turns * TAU; pts.push(v3(-len / 2 + len * k / N, Math.cos(a) * r, Math.sin(a) * r)); }
      const mat = own(0xc8743a, { emissive: 0xff7a1a, emissiveIntensity: 0 });
      const wind = mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), N, o.wire || 0.55, 6), 0, { mat, edges: false });
      at(wind, 0, cy, 0, g);
      const tin = kit.post(g, -(len / 2 + 4.6), 4, y0), tout = kit.post(g, len / 2 + 4.6, 4, y0);
      // выводы обмотки к клеммам
      for (const s of [-1, 1]) { const ld = cyl(0.3, 4.2, 0xc8743a, { edges: false, hull: false }); ld.rotation.z = s * 0.9; at(ld, s * (len / 2 + 2.6), cy - r - 0.6, 2.6, g); }
      return { g, tin, tout, mat, cy, top: cy + r + 2.5 };
    }
    return { W, wire, run, flow, plate, screen, glow, own, basic, scope, grid, trace, legend, coilPart };
  }

  // =====================================================================================
  // Урок 1: колебательный контур — батарея, ключ-переключатель, конденсатор на стойках, катушка, осциллограф
  SC['ac-lc'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit), WC = C.WIRE;

    // батарея 10 В
    const bat = new T.Group(); at(bat, -47, 0, 4); clickable(bat, 'bat');
    at(box(18, 9, 11, 0x2c3240), 0, 4.5, 0, bat);
    at(box(18.2, 2.6, 11.2, 0xf2a33a), 0, 7.3, 0, bat);
    const bl = K.plate(d.U0 + ' В', 9, 4, '#fff6e6', '#2c3240'); at(bl, -2, 3.6, 5.56, bat);
    at(cyl(1.4, 2.2, 0xe0473a), 5, 10.1, 0, bat); at(cyl(1.4, 2.2, 0x26324a), -5, 10.1, 0, bat);
    const bP = K.W(bat, v3(5, 11.2, 0)), bM = K.W(bat, v3(-5, 11.2, 0));

    // ключ-переключатель: нож качается от батареи (слева) к катушке (справа)
    const sw = new T.Group(); at(sw, -20, 0, -20); clickable(sw, 'sw');
    const y0 = kit.baseBlock(sw, 32, 13);
    const sL = kit.post(sw, -12, -4, y0), sP = kit.post(sw, 0, -4, y0), sR = kit.post(sw, 12, -4, y0);
    at(box(2.6, 3.4, 2.6, C.BRASS), 0, y0 + 1.7, 1.5, sw);
    for (const s of [-1, 1]) {
      const on = (s < 0) === (d.sw === 'bat');
      for (const dz of [-1.1, 1.1]) at(box(0.7, 7, 0.6, on ? 0xffd166 : C.BRASS), s * 9.2, y0 + 3.5, 1.5 + dz, sw);
      at(box(3, 0.6, 3, C.STEEL), s * 9.2, y0 + 0.3, 1.5, sw);
    }
    const hinge = new T.Group(); at(hinge, 0, y0 + 3.2, 1.5, sw);
    hinge.rotation.z = d.sw === 'bat' ? 0.92 : -0.92;
    at(box(1, 12.2, 1.6, 0xd38b4a), 0, 6.1, 0, hinge);
    const hd = cyl(1.4, 3.6, 0x3b6fd8); at(hd, 0, 13.6, 0, hinge);
    const pl = K.plate('заряд', 7, 2.2), pr = K.plate('катушка', 7, 2.2);
    pl.rotation.x = pr.rotation.x = -1.1; at(pl, -10, y0 + 0.4, 5.2, sw); at(pr, 10, y0 + 0.4, 5.2, sw);
    const wsL = K.W(sw, sL), wsP = K.W(sw, sP), wsR = K.W(sw, sR);

    // конденсатор: две круглые пластины на изолирующих стойках
    const cap = new T.Group(); at(cap, 4, 0, -6); clickable(cap, 'Cc');
    const cy0 = kit.baseBlock(cap, 24, 15), cyc = cy0 + 12.5, PR = 7.6;
    const mats = [K.own(C.STEEL), K.own(C.STEEL)];
    [-1, 1].forEach((s, k) => {
      at(cyl(0.9, 4.6, 0xf3f4f6), s * 3, cy0 + 2.3, 0, cap);
      at(cyl(1.5, 0.8, C.BRASS), s * 3, cy0 + 0.4, 0, cap);
      const p = mesh(new T.CylinderGeometry(PR, PR, 0.9, 40), 0, { mat: mats[k], hull: true, edges: false }); p.rotation.z = Math.PI / 2; at(p, s * 3, cyc, 0, cap);
      const hnd = cyl(0.9, 2.6, C.DARK); hnd.rotation.z = Math.PI / 2; at(hnd, s * 4.9, cyc, 0, cap);
    });
    const fieldMat = K.basic(0x72d4e8, { transparent: true, opacity: 0, depthWrite: false });
    for (const [yy, zz] of [[-4, -3], [-4, 3], [0, -5], [0, 0], [0, 5], [4, -3], [4, 3], [-2, 0], [2, 0]]) {
      const fl = new T.Mesh(kit.keep(new T.CylinderGeometry(0.22, 0.22, 5, 6)), fieldMat); fl.rotation.z = Math.PI / 2; at(fl, 0, cyc + yy, zz, cap);
    }
    const cL = kit.post(cap, -9.5, 5, cy0), cR = kit.post(cap, 9.5, 5, cy0);
    const wcL = K.W(cap, cL), wcR = K.W(cap, cR);
    K.wire([wcL, wcL.clone().add(v3(0, 2, 0)), K.W(cap, v3(-3.6, cyc - PR + 0.6, 1.5))], C.STEEL, 0.32);
    K.wire([wcR, wcR.clone().add(v3(0, 2, 0)), K.W(cap, v3(3.6, cyc - PR + 0.6, 1.5))], C.STEEL, 0.32);

    // катушка
    const co = K.coilPart({ len: 24, r: 5.4, turns: 16 });
    at(co.g, 38, 0, -16); clickable(co.g, 'Lc');
    const wkL = K.W(co.g, co.tin), wkR = K.W(co.g, co.tout);
    const fieldL = K.basic(0xffb547, { transparent: true, opacity: 0, depthWrite: false });
    for (const [a, b] of [[19, 10], [25, 14.5]]) {
      const pts = []; for (let k = 0; k <= 64; k++) { const t = k / 64 * TAU; pts.push(v3(Math.cos(t) * a, 0, Math.sin(t) * b)); }
      const lp = new T.Mesh(kit.keep(new T.TubeGeometry(new T.CatmullRomCurve3(pts, true), 96, 0.32, 6, true)), fieldL);
      at(lp, 38, co.cy, -16);
    }

    // резистор (R = 0 — перемычка через клеммы)
    const res = kit.resistor({ R: d.R || 20, value: '', click: 'Rc' });
    const rN = kit.placeOn(res, v3(8, 0, 19), 0, 'res');
    if (!d.R) { const tin = rN.tin, tout = rN.tout; const j = box(tout.x - tin.x + 2, 0.7, 1.6, C.BRASS); at(j, (tin.x + tout.x) / 2, tin.y - 1.6, tin.z); }

    // осциллограф
    const S = K.scope({ buttons: [{ key: 'run', txt: d.run ? '❚❚' : '▶', col: d.run ? 0x3fae5a : 0xe0473a }, { key: 'step', txt: '⅛T', col: 0x3b6fd8 }] });
    at(S.g, 44, 0, 29);
    const sA = K.W(S.g, S.jA), sB = K.W(S.g, S.jB);

    // провода
    const wPC = K.run(wsP, wcL, WC.mid, { via: [v3(-12, 1.3, -10), v3(-8, 1.3, -1)] });
    const wCB = K.run(wcR, bM, WC.minus, { via: [v3(15, 1.3, 6), v3(-10, 1.3, 11), v3(-50, 1.3, 12)], liftB: 2 });
    const wCR = K.run(wcR, rN.tin, WC.mid, { via: [v3(8, 1.3, 7), v3(-4, 1.3, 13)] });
    const wRK = K.run(rN.tout, wkR, WC.mid, { via: [v3(24, 1.3, 14), v3(40, 1.3, 6), v3(56, 1.3, -2)] });
    const wKS = K.run(wkL, wsR, WC.mid, { via: [v3(18, 1.3, -26), v3(-2, 1.3, -30)] });
    K.run(sA, wcL, WC.probeR, { r: 0.55, lift: 3, via: [v3(30, 1.3, 12), v3(-2, 1.3, 5)] });
    K.run(sB, wcR, WC.probeB, { r: 0.55, lift: 3, via: [v3(38, 1.3, 12), v3(18, 1.3, 4)] });
    const fCh = [K.flow(wPC), K.flow(wCB)], fLoop = [K.flow(wCR), K.flow(wRK), K.flow(wKS)];
    const fBat = K.flow(K.run(bP, wsL, WC.plus));

    tag(v3(-47, 15, 4), 'Батарея', d.U0 + ' В');
    tag(v3(-20, 21, -20), 'Ключ', d.sw === 'bat' ? 'заряд' : 'на катушке', d.sw === 'coil');
    tag(v3(4, 26, -6), 'Конденсатор', 'C = ' + d.Ctxt);
    tag(v3(38, co.top + 3, -16), 'Катушка', 'L = ' + d.Ltxt);
    tag(v3(8, 13, 19), d.R ? 'Резистор' : 'Перемычка', 'R = ' + d.R + ' Ом');
    tag(v3(44, 29, 29), 'Осциллограф', 'ν = ' + d.f + ' Гц', d.fok);

    const red = new T.Color(0xe0473a), blue = new T.Color(0x2f6fd8), steel = new T.Color(C.STEEL);
    let qPrev = null, tick = 0, lastT = -1; const buf = [];
    kit.onFrame((dt, t) => {
      const Lv = live(); if (!Lv) return;
      const q = clamp(Lv.q, -1.1, 1.1), i = clamp(Lv.i, -1.1, 1.1);
      // пластины: «+» красная, «−» синяя; поле между ними
      mats[0].color.copy(steel).lerp(q >= 0 ? red : blue, Math.min(1, Math.abs(q)));
      mats[1].color.copy(steel).lerp(q >= 0 ? blue : red, Math.min(1, Math.abs(q)));
      fieldMat.opacity = 0.9 * Math.min(1, Math.abs(q));
      // катушка: магнитное поле и «тёплая» обмотка при токе
      fieldL.opacity = 0.8 * Math.min(1, Math.abs(i));
      co.mat.emissiveIntensity = 0.45 * Math.min(1, Math.abs(i));
      // огоньки: ток в пластину слева (по проводам контура — в сторону ключа)
      const charging = Lv.sw === 'bat' ? clamp((1 - q) * 3, 0, 1) * (qPrev !== null && Math.abs(q - qPrev) < 1e-5 ? 0 : 1) : 0;
      qPrev = q;
      const into = Lv.sw === 'coil' ? i : charging, mv = Lv.sw === 'bat' || Lv.run;
      fCh.forEach(f => f.set(into, dt, mv));
      fBat.set(charging, dt, true);
      fLoop.forEach(f => f.set(Lv.sw === 'coil' ? i : 0, dt, mv));
      // экран осциллографа: заряд и ток за последние 8 мс
      if ((tick++ & 1) && !kit.reduce && tick > 2) return;
      const s = S.scr, w = s.W, h = s.H; K.grid(s);
      for (const p of Lv.hist || []) if (p[0] > lastT) { buf.push(p); lastT = p[0]; }
      if (Lv.tt < lastT - 1e-9) { buf.length = 0; lastT = -1; }
      const win = 3 / d.f;
      while (buf.length > 2 && buf[0][0] < Lv.tt - win * 1.05) buf.shift();
      const qs = [], is = [];
      for (const p of buf) { const x = w - (Lv.tt - p[0]) / win * w; if (x < 0) continue; qs.push([x, h / 2 - h * 0.36 * clamp(p[1], -1.2, 1.2)]); is.push([x, h / 2 - h * 0.36 * clamp(p[2], -1.2, 1.2)]); }
      K.trace(s, qs, '#72d4e8'); K.trace(s, is, '#ffb547');
      K.legend(s, [['q', '#72d4e8'], ['i', '#ffb547']]);
      s.x.fillStyle = 'rgba(200,255,220,.75)'; s.x.font = '600 16px "IBM Plex Mono", monospace'; s.x.textAlign = 'right'; s.x.fillText('3 периода', w - 8, 10); s.x.textAlign = 'left';
      s.tex.needsUpdate = true;
    });
  };

  // =====================================================================================
  // Урок 2: генератор переменного тока, амперметр, лампа, резистор / конденсатор / катушка, осциллограф с U и I
  SC['ac-rcl'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit), WC = C.WIRE;

    // генератор: табло частоты, ручка, кнопки − и +, гнёзда выхода
    const gen = new T.Group(); at(gen, -42, 0, -4);
    at(box(30, 19, 16, 0x3b4a66), 0, 9.5, 0, gen);
    at(box(28, 1.2, 14, 0x4a5b7c), 0, 19.6, 0, gen);
    for (const x of [-12, 12]) at(box(2, 1, 12, C.DARK), x, -0.0 + 0.5, 0, gen);
    const scr = new T.Mesh(kit.keep(new T.PlaneGeometry(14, 6)), new T.MeshBasicMaterial({ map: kit.keep(kit.textTex(d.nu + ' Гц', '#ffb547', '#0e1520', 256, 110)) }));
    kit.keep(scr.material); at(scr, -6, 13.4, 8.05, gen);
    const wv = K.plate('~ ' + d.U + ' В', 9, 3, '#fff6e6', '#3b4a66'); at(wv, -6, 8.3, 8.05, gen);
    const kn = new T.Group(); at(kn, 9, 13, 8, gen);
    const kb = cyl(3.4, 2, 0xd9dfe9, { seg: 22 }); kb.rotation.x = Math.PI / 2; at(kb, 0, 0, 1, kn);
    const mk = box(0.7, 2.6, 0.4, 0xe0473a, { edges: false }); at(mk, 0, 1.6, 2.1, kn);
    kn.rotation.z = 2.3 - 4.6 * clamp(Math.log(d.nu / 5) / Math.log(100), 0, 1);
    const bM = new T.Group(), bP = new T.Group();
    at(bM, 5.4, 5, 8.4, gen); at(bP, 12.6, 5, 8.4, gen);
    for (const [b, t, k] of [[bM, '−', 'nu-'], [bP, '+', 'nu+']]) { at(box(5, 3.6, 1.6, 0xe8ecf4), 0, 0, 0, b); const p = K.plate(t, 3, 2.4, '#1b1610', '#e8ecf4'); at(p, 0, 0, 0.82, b); clickable(b, k); }
    const jA = new T.Group(), jB = new T.Group();
    at(jA, -10, 3.4, 8.2, gen); at(jB, -3, 3.4, 8.2, gen);
    for (const [j, c] of [[jA, 0xe0473a], [jB, 0x26324a]]) { const r = cyl(1.4, 1.4, c, { seg: 16 }); r.rotation.x = Math.PI / 2; at(r, 0, 0, 0.4, j); }
    const gA = K.W(gen, v3(-10, 3.4, 9.4)), gB = K.W(gen, v3(-3, 3.4, 9.4));

    // три элемента на своих подставках
    const els = {};
    { // резистор
      const p = kit.resistor({ R: 100, value: '', click: 'eR' }); els.R = kit.placeOn(p, v3(0, 0, -24), 0, 'R'); els.R.top = 12;
    }
    { // конденсатор-бочонок
      const g = new T.Group(), y0 = kit.baseBlock(g, 22, 11);
      const tin = kit.post(g, -8.5, 0, y0), tout = kit.post(g, 8.5, 0, y0);
      at(cyl(5, 0.8, 0x2c3240), 0, y0 + 0.4, 0, g);
      at(cyl(4.6, 13, 0x2f6fd8), 0, y0 + 7.3, 0, g);
      at(cyl(4.66, 2.2, 0xe8ecf4, { edges: false }), 0, y0 + 10.2, 0, g);
      at(cyl(4.3, 0.6, C.STEEL), 0, y0 + 14.1, 0, g);
      for (const s of [-1, 1]) { const ld = cyl(0.3, 5.6, C.STEEL, { edges: false, hull: false }); ld.rotation.z = Math.PI / 2; at(ld, s * 6.1, y0 + 2.6, 0, g); }
      g.userData.click = 'eC';
      els.C = kit.placeOn({ g, tin, tout }, v3(21, 0, -24), 0, 'C'); els.C.top = y0 + 16;
    }
    { // катушка с железным сердечником
      const p = K.coilPart({ len: 14, r: 4.6, turns: 14, core: true, wire: 0.6, dep: 11 });
      p.g.userData.click = 'eL';
      els.L = kit.placeOn(p, v3(44, 0, -24), 0, 'L'); els.L.top = p.top;
    }
    const names = { R: ['R', '100 Ом'], C: ['C', '31,8 мкФ'], L: ['L', '0,318 Гн'] };
    for (const k of ['R', 'C', 'L']) {
      const n = els[k], on = d.el === k, pl = K.plate(names[k][0] + ' · ' + names[k][1], 13, 3.2, on ? '#1b1610' : '#5d6573', on ? '#ffd166' : '#f7f3ea');
      pl.rotation.x = -0.6; at(pl, n.g.position.x, 2, n.g.position.z + 7.4);
    }

    // амперметр переменного тока, лампа, осциллограф
    const am = kit.meter({ kind: 'A', val: d.I, max: 10, over: d.I > 10, value: '' });
    const aN = kit.placeOn(am, v3(-26, 0, 27), 0, 'am');
    const lp = kit.bulb({ glow: Math.round(clamp(Math.pow(d.I / 4.4, 2), 0, 1.6) * 100) / 100, value: '' });
    const lN = kit.placeOn(lp, v3(0, 0, 14), 0, 'lamp');
    const S = K.scope(); at(S.g, 44, 0, 30);
    const sA = K.W(S.g, S.jA), sB = K.W(S.g, S.jB);

    // провода: генератор → амперметр → лампа → элемент → генератор
    const E = els[d.el];
    const w1 = K.run(gA, aN.tin, WC.plus, { lift: 0.1, via: [gA.clone().add(v3(0, 0, 4)).setY(1.3), v3(-46, 1.3, 22)] });
    const w2 = K.run(aN.tout, lN.tin, WC.mid, { via: [v3(-15, 1.3, 20)] });
    const w3 = K.run(lN.tout, E.tin, WC.mid, { via: [v3(10, 1.3, 8), E.tin.clone().setY(1.3).add(v3(-2, 0, 10))] });
    const w4 = K.run(E.tout, gB, WC.minus, { liftB: 0.1, via: [E.tout.clone().setY(1.3).add(v3(3, 0, 9)), v3(-14, 1.3, 2), gB.clone().add(v3(0, 0, 5)).setY(1.3)] });
    K.run(sA, E.tin, WC.probeR, { r: 0.55, lift: 4, liftB: 5, via: [v3(30, 1.3, 14), E.tin.clone().setY(1.3).add(v3(0, 0, 7))] });
    K.run(sB, E.tout, WC.probeB, { r: 0.55, lift: 4, liftB: 5, via: [v3(38, 1.3, 14), E.tout.clone().setY(1.3).add(v3(0, 0, 7))] });
    const fl = [w1, w2, w3, w4].map(c => K.flow(c));

    const nm = { R: 'Резистор', C: 'Конденсатор', L: 'Катушка' }[d.el];
    tag(v3(-42, 23, -4), 'Генератор', d.U + ' В · ' + d.nu + ' Гц');
    tag(E.g.position.clone().setY(E.top + 3), nm, d.Xtxt);
    tag(v3(-26, 17, 27), 'Амперметр', d.Itxt, d.ok);
    tag(v3(0, 21, 14), 'Лампа', d.I >= 3 ? 'ярко' : d.I >= 1.2 ? 'светит' : 'еле светит');
    tag(v3(44, 29, 30), 'Осциллограф', d.phi > 0 ? 'I опережает U' : d.phi < 0 ? 'I отстаёт от U' : 'U и I в фазе');

    const ph = d.phi * Math.PI / 180, ai = clamp(d.I / 8.8, 0.12, 1), amp = clamp(d.I / 4.4, 0.3, 1);
    let t0 = 0;
    kit.onFrame((dt, t) => {
      const Lv = live(); const th = Lv && Lv.ph !== undefined ? Lv.ph : (t0 += dt * TAU * 0.35);
      const iNow = Math.sin(th + ph);
      fl.forEach(f => f.set(iNow * amp, dt));
      const s = S.scr, w = s.W, h = s.H; K.grid(s);
      const us = [], is = [];
      for (let k = 0; k <= 120; k++) { const u = k / 120, a = th - 4 * Math.PI * (1 - u); us.push([u * w, h / 2 - h * 0.36 * Math.sin(a)]); is.push([u * w, h / 2 - h * 0.36 * ai * Math.sin(a + ph)]); }
      K.trace(s, us, '#ffb547'); K.trace(s, is, '#72d4e8');
      K.legend(s, [['U', '#ffb547'], ['I', '#72d4e8']]);
      s.tex.needsUpdate = true;
    });
  };

  // =====================================================================================
  // Урок 3: радиосвязь — передатчик с микрофоном и антенной, волны, радиоприёмник с настройкой, детектором и динамиком
  function dialTex(kit, d) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 200; const x = c.getContext('2d');
    x.fillStyle = '#f3e7c9'; x.fillRect(0, 0, 512, 200);
    x.strokeStyle = '#1b1610'; x.lineWidth = 8; x.strokeRect(4, 4, 504, 192);
    const X = f => 34 + (f - 500) / 1200 * 444;
    x.lineWidth = 3; x.beginPath(); x.moveTo(X(500), 120); x.lineTo(X(1700), 120); x.stroke();
    x.fillStyle = '#1b1610'; x.font = '600 22px "IBM Plex Mono", monospace'; x.textAlign = 'center';
    for (let f = 500; f <= 1700; f += 100) { const big = f % 200 === 100; x.lineWidth = big ? 3 : 2; x.beginPath(); x.moveTo(X(f), 120); x.lineTo(X(f), big ? 98 : 108); x.stroke(); if (big && !d.st.includes(f + 0)) x.fillText(String(f), X(f), 152); }
    d.st.forEach((f, k) => {
      const col = k === d.tg ? '#2e9e4f' : '#8e44ad';
      x.fillStyle = col; x.fillRect(X(f) - 9, 54, 18, 26);
      x.font = '700 22px "IBM Plex Mono", monospace'; x.fillText(String(f), X(f), 152);
      x.font = '700 18px "Golos Text", sans-serif'; x.fillText('ст.' + (k + 1), X(f), 180);
      x.fillStyle = '#1b1610';
    });
    x.font = '600 18px "IBM Plex Mono", monospace'; x.textAlign = 'left'; x.fillText('кГц', 16, 34);
    const xn = X(clamp(d.nu0, 500, 1700));
    x.strokeStyle = '#d62828'; x.lineWidth = 6; x.beginPath(); x.moveTo(xn, 14); x.lineTo(xn, 190); x.stroke();
    const t = kit.keep(new kit.T.CanvasTexture(c)); t.colorSpace = kit.T.SRGBColorSpace; return t;
  }
  SC['ac-radio'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit), WC = C.WIRE;

    // передатчик
    const tx = new T.Group(); at(tx, -40, 0, -20); tx.rotation.y = 0.25;
    at(box(26, 16, 15, 0x3b4a66), 0, 8, 0, tx);
    at(box(24, 1.2, 13, 0x4a5b7c), 0, 16.6, 0, tx);
    const ds = new T.Mesh(kit.keep(new T.PlaneGeometry(13, 5.4)), new T.MeshBasicMaterial({ map: kit.keep(kit.textTex(d.st[d.tg] + ' кГц', '#86e0a8', '#0e1520', 256, 106)) }));
    kit.keep(ds.material); at(ds, -4.5, 11.2, 7.55, tx);
    const amL = K.plate(d.mod ? 'АМ' : 'без мод.', 6, 2.4, '#fff6e6', d.mod ? '#2e9e4f' : '#5d6573'); at(amL, 7.5, 11.2, 7.55, tx);
    for (const x of [-8, -2, 4]) { const k = cyl(1.6, 1.4, 0xd9dfe9, { seg: 16 }); k.rotation.x = Math.PI / 2; at(k, x, 4.6, 8.2, tx); }
    const mj = cyl(1.2, 1.2, C.DARK, { seg: 14 }); mj.rotation.x = Math.PI / 2; at(mj, 9, 4.6, 8, tx);
    for (let k = 0; k < 5; k++) at(box(0.5, 9, 0.3, 0x2c3240, { edges: false, shadow: false }), 13.05, 8, -5 + k * 2.4, tx).rotation.y = Math.PI / 2;
    // антенна передатчика
    at(cyl(1.8, 3, 0xf3f4f6), 8, 18.7, -3, tx);
    for (let k = 0; k < 4; k++) at(cyl(1.4, 0.7, 0xf3f4f6), 8, 20.6 + k * 1, -3, tx);
    at(cyl(0.6, 30, C.STEEL), 8, 38, -3, tx);
    at(mesh(new T.SphereGeometry(1.3, 16, 12), 0xe0473a, { hull: true, edges: false }), 8, 53.3, -3, tx);
    const aTx = K.W(tx, v3(8, 38, -3));

    // микрофон на настольной стойке
    const mic = new T.Group(); at(mic, -40, 0, 8); clickable(mic, 'mod');
    at(cyl(4.6, 1.2, C.DARK), 0, 0.6, 0, mic);
    at(cyl(0.6, 9, C.STEEL, { edges: false }), 0, 5.6, 0, mic);
    at(cyl(1.2, 2, C.DARK), 0, 10.6, 0, mic);
    const ring = new T.Mesh(kit.keep(new T.TorusGeometry(2.5, 0.45, 8, 28)), K.own(d.mod ? 0x3fe07a : 0x5d6573, d.mod ? { emissive: 0x2fd06a, emissiveIntensity: 0.9 } : {}));
    ring.rotation.x = Math.PI / 2; at(ring, 0, 12.8, 0, mic);
    const head = mesh(new T.CapsuleGeometry(2.5, 3.6, 6, 16), 0x3a3f4c, { hull: true, edges: false }); at(head, 0, 15.6, 0, mic);
    for (let k = 0; k < 4; k++) at(new T.Mesh(kit.keep(new T.TorusGeometry(2.56, 0.12, 4, 24)), K.basic(0x8b93a1)), 0, 14 + k * 1.1, 0, mic).rotation.x = Math.PI / 2;
    K.run(K.W(mic, v3(0, 1.2, -3.5)), K.W(tx, v3(9, 4.6, 8.6)), 0x2c3240, { r: 0.55, lift: 0.4, liftB: 0, via: [K.W(mic, v3(0, 1, -7)), K.W(tx, v3(9, 1.3, 11))] });

    // радиоприёмник
    const rx = new T.Group(); at(rx, 22, 0, 2); rx.rotation.y = 0.42;
    at(box(40, 22, 15, 0x9a6332), 0, 11, 0, rx);
    at(box(37, 19, 0.6, 0xefe3c8), 0, 11.4, 7.6, rx);
    for (const x of [-16, 16]) at(box(3, 1, 10, C.DARK), x, 0.5, 0, rx);
    // динамик: диффузор с пылезащитным колпачком
    at(new T.Mesh(kit.keep(new T.TorusGeometry(6.6, 0.6, 8, 32)), K.own(C.STEEL)), -9.5, 11.4, 8.1, rx);
    const cone = new T.Group(); at(cone, -9.5, 11.4, 7.2, rx);
    const cg = mesh(new T.CylinderGeometry(6.1, 1.8, 2.6, 32, 1, true), 0x34302c, { hull: false, edges: false, mat: K.own(0x34302c, { side: T.DoubleSide }) });
    cg.rotation.x = Math.PI / 2; at(cg, 0, 0, 0, cone);
    at(mesh(new T.SphereGeometry(1.9, 16, 10, 0, TAU, 0, Math.PI / 2), 0x4a4440, { hull: false, edges: false }), 0, 0, -0.9, cone).rotation.x = Math.PI / 2;
    // шкала настройки и индикатор
    at(box(19, 8.6, 0.6, 0x2c3240), 9, 15.6, 7.9, rx);
    const dial = new T.Mesh(kit.keep(new T.PlaneGeometry(18, 7.2)), kit.keep(new T.MeshBasicMaterial({ map: dialTex(kit, d) }))); at(dial, 9, 15.6, 8.25, rx);
    const eye = mesh(new T.SphereGeometry(1.2, 16, 10), 0, { mat: K.own(0x2e5e3a, { emissive: 0x3fff8a, emissiveIntensity: 0.15 + 0.85 * d.resp }), hull: true, edges: false }); at(eye, 17.5, 9.6, 8, rx);
    if (d.resp > 0.5) at(K.glow(0x6fff9a, 6 * d.resp, 0.7), 17.5, 9.6, 8.6, rx);
    const knob = new T.Group(); at(knob, 9, 6.6, 8.4, rx);
    const kb = cyl(3, 2.4, 0x2c3240, { seg: 24 }); kb.rotation.x = Math.PI / 2; at(kb, 0, 0, 0.6, knob);
    at(box(0.6, 2.4, 0.4, 0xf3e7c9, { edges: false }), 0, 1.4, 1.9, knob);
    knob.rotation.z = 2.4 - 4.8 * clamp((d.nu0 - 500) / 1200, 0, 1);
    const tb = [];
    for (const [x, t, k] of [[2.4, '◄', 'tune-'], [15.6, '►', 'tune+']]) { const b = new T.Group(); at(b, x, 6.6, 8.3, rx); at(box(4.4, 3.6, 1.6, 0xe8ecf4), 0, 0, 0, b); const p = K.plate(t, 3, 2.6, '#1b1610', '#e8ecf4'); at(p, 0, 0, 0.82, b); clickable(b, k); tb.push(b); }
    // детектор сверху: диод в гнёздах и тумблер
    const det = new T.Group(); at(det, -2, 22, 1.5, rx); clickable(det, 'det');
    at(box(14, 1.6, 7, 0x2c3240), 0, 0.8, 0, det);
    for (const x of [-4.5, 4.5]) at(cyl(0.9, 1.6, C.BRASS), x, 2.2, -1.2, det);
    const dio = cyl(0.9, 6, 0x1b1f28); dio.rotation.z = Math.PI / 2; at(dio, 0, 3.4, -1.2, det);
    const band = cyl(0.95, 0.8, 0xe8ecf4, { edges: false, hull: false }); band.rotation.z = Math.PI / 2; at(band, 2.2, 3.4, -1.2, det);
    for (const s of [-1, 1]) { const l = cyl(0.22, 2.4, C.STEEL, { edges: false, hull: false }); l.rotation.z = Math.PI / 2; at(l, s * 3.8, 3.4, -1.2, det); }
    const lever = new T.Group(); at(lever, -3, 1.6, 2.2, det); lever.rotation.z = d.det ? -0.55 : 0.55;
    at(box(0.9, 4, 0.9, C.STEEL), 0, 2, 0, lever); at(cyl(0.8, 1.2, 0xe0473a), 0, 4.2, 0, lever);
    at(mesh(new T.SphereGeometry(0.8, 12, 8), 0, { mat: K.own(d.det ? 0x3fe07a : 0x4a5240, d.det ? { emissive: 0x2fd06a, emissiveIntensity: 1 } : {}), hull: true, edges: false }), 3.5, 2, 2.2, det);
    // телескопическая антенна
    const ant = new T.Group(); at(ant, -14, 22, -4.5, rx); ant.rotation.z = 0.38;
    at(mesh(new T.SphereGeometry(1.3, 14, 10), C.STEEL, { hull: true, edges: false }), 0, 0, 0, ant);
    [[0.75, 10], [0.6, 10], [0.45, 10]].forEach(([r, h], k) => at(cyl(r, h, C.STEEL, { edges: k === 0 }), 0, 5 + k * 9.6, 0, ant));
    at(mesh(new T.SphereGeometry(0.8, 12, 8), C.STEEL, { hull: true, edges: false }), 0, 29.8, 0, ant);
    const aRx = K.W(ant, v3(0, 22, 0));

    // волны от антенны передатчика: кольца расходятся, при модуляции яркость колец идёт «в такт» со звуком
    const N = 7, RMAX = 66, rings = [];
    for (let k = 0; k < N; k++) {
      const m = K.basic(0xffb547, { transparent: true, opacity: 0, depthWrite: false });
      const r = new T.Mesh(kit.keep(new T.TorusGeometry(1, 0.02, 6, 72)), m); r.rotation.x = Math.PI / 2; r.renderOrder = 3;
      at(r, aTx.x, aTx.y, aTx.z); rings.push({ r, m });
    }
    const pulse = K.glow(0xffc860, 10, 0); at(pulse, aRx.x, aRx.y, aRx.z);
    // звук из динамика
    const sw = [];
    for (let k = 0; k < 3; k++) { const m = K.basic(0x86e0a8, { transparent: true, opacity: 0, depthWrite: false }); const r = new T.Mesh(kit.keep(new T.TorusGeometry(1, 0.06, 6, 40)), m); r.renderOrder = 3; rx.add(r); r.position.set(-9.5, 11.4, 8.5); sw.push({ r, m }); }

    tag(K.W(tx, v3(-4, 21, 0)), 'Передатчик', d.st[d.tg] + ' кГц');
    tag(v3(-40, 21, 8), 'Микрофон', d.mod ? 'модуляция вкл' : 'модуляция выкл', d.mod);
    tag(K.W(rx, v3(-2, 28, 1.5)), 'Детектор', d.det ? 'вкл' : 'выкл', d.det);
    tag(K.W(rx, v3(14, 24, -2)), 'Приёмник', d.nu0 + ' кГц · ' + Math.round(d.resp * 100) + ' %', d.tuned);
    tag(K.W(rx, v3(-12, 2, 14)), 'Динамик', d.hear, d.lvl > 0.05 && d.tuned);

    const mt = d.mod ? 0.6 : 0, spd = 16;
    kit.onFrame((dt, t) => {
      const tt = kit.reduce ? 1.3 : t;
      rings.forEach((o, k) => {
        const age = ((tt * spd / RMAX + k / N) % 1), r = 2 + age * RMAX;
        o.r.scale.set(r, r, r);
        const env = (1 + mt * Math.sin(TAU * 0.45 * (tt - age * RMAX / spd))) / (1 + mt);
        o.m.opacity = 0.85 * (1 - age) * env * Math.min(1, age * 8);
      });
      // антенна приёмника вспыхивает, когда до неё доходит волна
      pulse.material.opacity = 0.25 + 0.25 * Math.sin(TAU * spd / (RMAX / N) * tt * 0.5) ** 2;
      // диффузор и звуковые волны
      const lv = Math.min(1, d.lvl);
      cone.position.z = 7.2 + (kit.reduce ? 0 : 0.45 * lv * Math.sin(tt * 38) * (0.6 + 0.4 * Math.sin(tt * 4.5)));
      sw.forEach((o, k) => { const a = (tt * 0.9 + k / 3) % 1, r = 7 + a * 9; o.r.scale.set(r, r, r); o.r.position.z = 8.5 + a * 8; o.m.opacity = lv * 0.8 * (1 - a); });
    });
  };
})();
