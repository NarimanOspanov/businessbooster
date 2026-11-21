// «Как в жизни» для биологии «Мозг и чувства» (labs/bio-nerves): анатомические модели и опыт урока на столе.
// Рефлекс: рука-манекен над свечой, модель спинного мозга в разрезе, нервы с бегущим импульсом, метки-флажки, карточки звеньев, музейная модель нейрона;
// головной мозг: модель на подставке (доли, мозжечок, ствол), карточка ситуации; зрение: модель глаза в разрезе, пробная линза, монитор «так видит глаз»;
// слух: звуковой генератор, модель уха (раковина, перепонка, косточки, улитка), развёрнутая улитка с бегущей волной;
// сон и память: кровать со спящим, будильник, планшет с гипнограммой, календарь до контрольной с карточками-повторениями и столбиками памяти.
// Сцены строятся из window.LUCH_REAL() опыта; набор деталей kit — из /luch/real3d.js.
(() => {
  const SC = (window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {});
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const fm = (x, d = 0) => (Math.round(x * 10 ** d) / 10 ** d).toFixed(d).replace('.', ',').replace('-', '−');
  const num = c => typeof c === 'string' ? parseInt(c.replace('#', ''), 16) : c;
  const hex = c => '#' + num(c).toString(16).padStart(6, '0');
  const SKIN = 0xd9a07e, SKIN2 = 0xb97a5e, BRAIN = 0xd9a3a8, NERVE = 0xe8d29a, BONE = 0xefe6d2, NEU = 0xc9d3e6,
    AMBER = 0xffb547, OK = 0x3fd28a, BAD = 0xff5a40, CYAN = 0x72d4e8, PURPLE = 0xb48cff, PANEL = 0x2c3240, ON = 0x2f9e5a, OFF = 0x5d6a86;
  const mem = {}; // прошлые значения — для плавных переходов (рука, хрусталик)

  // ---------- общие детали ----------
  const ease = u => u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
  function tween(kit, key, to, dur, apply) {
    const from = mem[key] == null ? to : mem[key]; mem[key] = to;
    if (kit.reduce || Math.abs(from - to) < 1e-9) { apply(to); return; }
    apply(from); let t0 = null;
    kit.onFrame((dt, t) => { if (t0 == null) t0 = t; const u = clamp((t - t0) / dur, 0, 1); apply(from + (to - from) * ease(u)); });
  }
  function canvasTex(kit, w, h, draw) {
    const { T } = kit;
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return kit.keep(t);
  }
  function rrect(x, X, Y, W, H, r) {
    x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath();
  }
  function fitFont(x, s, maxW, fs, wt) {
    x.font = `${wt} ${fs}px "Golos Text", sans-serif`;
    const tw = x.measureText(s).width;
    if (tw > maxW) { fs = Math.max(8, Math.floor(fs * maxW / tw)); x.font = `${wt} ${fs}px "Golos Text", sans-serif`; }
    return fs;
  }
  // табличка: строки текста на скруглённом фоне (или без фона)
  function cardTex(kit, lines, o = {}) {
    const W = o.w || 512, H = o.h || 200;
    return canvasTex(kit, W, H, x => {
      if (o.bg) { x.fillStyle = o.bg; rrect(x, 3, 3, W - 6, H - 6, o.r ?? 22); x.fill(); }
      if (o.border) { x.lineWidth = 7; x.strokeStyle = o.border; rrect(x, 4, 4, W - 8, H - 8, o.r ?? 22); x.stroke(); }
      const n = lines.length, lh = (H - 16) / n;
      lines.forEach((s, i) => {
        fitFont(x, s, W * 0.9, Math.round(lh * (o.fs || 0.6)), i === 0 || o.allBold ? 700 : 500);
        x.fillStyle = (o.cols && o.cols[i]) || o.fg || '#1b1610'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(s, W / 2, 8 + lh * (i + 0.5) + 2);
      });
    });
  }
  function plane(kit, w, h, tex, o = {}) {
    const { T, keep } = kit;
    return new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: tex, transparent: !!o.tr, depthWrite: !o.tr, side: o.side || T.FrontSide })));
  }
  // подпись на столе / на детали (прозрачный фон)
  function text(kit, lines, w, h, colr, o = {}) {
    const H = o.ch || 128 * lines.length, W = Math.min(2048, Math.round(H * w / h));
    const m = plane(kit, w, h, cardTex(kit, lines, { w: W, h: H, fg: colr, fs: o.fs || 0.7, allBold: o.allBold }), { tr: true });
    if (o.flat) m.rotation.x = -Math.PI / 2;
    m.renderOrder = 2; return m;
  }
  const ball = (kit, r, c, o = {}) => kit.mesh(new kit.T.SphereGeometry(r, o.ws || 22, o.hs || 14), c, { edges: false, hull: !!o.hull, matOpt: o.matOpt, mat: o.mat });
  function rod(kit, a, b, r, c, parent, o = {}) {
    const { T } = kit; const dv = b.clone().sub(a), L = dv.length();
    const m = kit.cyl(r, Math.max(0.01, L), c, { edges: false, hull: false, seg: 10, ...o });
    m.position.copy(a).addScaledVector(dv, 0.5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dv.normalize());
    (parent || kit.root).add(m); return m;
  }
  function tube(kit, pts, r, c, o = {}) {
    const { T, keep } = kit;
    const curve = new T.CatmullRomCurve3(pts, !!o.closed, 'centripetal');
    const geo = new T.TubeGeometry(curve, o.seg || Math.max(16, Math.round(curve.getLength() * 1.5)), r, o.rs || 8, !!o.closed);
    const m = o.basic ? new T.Mesh(keep(geo), keep(new T.MeshBasicMaterial({ color: c, transparent: o.op != null, opacity: o.op ?? 1, depthWrite: o.op == null })))
      : kit.mesh(geo, c, { edges: false, hull: !!o.hull, matOpt: o.matOpt });
    (o.parent || kit.root).add(m); m.userData.curve = curve; return m;
  }
  function glow(kit, p, c, size, op = 0.9, parent) {
    const { T, keep } = kit;
    const s = new T.Sprite(keep(new T.SpriteMaterial({ map: kit.glowTex(), color: c, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false })));
    s.scale.setScalar(size); s.position.copy(p); s.renderOrder = 5; (parent || kit.root).add(s); return s;
  }
  // кнопка на приборе: плоская клавиша с надписью сверху
  function button(kit, parent, x, y, z, label, color, key, w = 9, dp = 4.4) {
    const { T, at, box, clickable } = kit;
    const b = new T.Group(); at(b, x, y, z, parent);
    at(box(w, 1.2, dp, color), 0, 0.6, 0, b);
    const top = plane(kit, w * 0.92, dp * 0.84, cardTex(kit, [label], { w: Math.round(128 * w / dp), h: 128, fg: '#ffffff', bg: hex(color), r: 10, fs: 0.6 }));
    top.rotation.x = -Math.PI / 2; at(top, 0, 1.22, 0, b);
    clickable(b, key); return b;
  }
  // луч света: сердцевина, свечение и бегущие огоньки
  function beam(kit, a, b, c, o = {}) {
    const { T, keep } = kit;
    const dv = b.clone().sub(a), L = dv.length(); if (L < 0.05) return 0;
    const dn = dv.clone().normalize(), q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dn), mid = a.clone().addScaledVector(dv, 0.5);
    const op = o.op ?? 0.95, r = o.r || 0.17;
    const core = new T.Mesh(keep(new T.CylinderGeometry(r, r, L, 8, 1, true)), keep(new T.MeshBasicMaterial({ color: c, transparent: true, opacity: op, depthWrite: false })));
    const gl = new T.Mesh(keep(new T.CylinderGeometry(0.6, 0.6, L, 10, 1, true)), keep(new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.22 * op, blending: T.AdditiveBlending, depthWrite: false })));
    [core, gl].forEach(m => { m.quaternion.copy(q); m.position.copy(mid); m.renderOrder = 3; kit.root.add(m); });
    if (!kit.reduce && o.photons !== false) {
      const pm = keep(new T.SpriteMaterial({ map: kit.glowTex(), color: c, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false }));
      const SP = 6, n = Math.ceil(L / SP) + 1, sps = [], s0 = o.s0 || 0;
      for (let i = 0; i < n; i++) { const s = new T.Sprite(pm); s.scale.setScalar(1.5); s.renderOrder = 4; kit.root.add(s); sps.push(s); }
      const place = t => { const ph = ((t * 14 - s0) % SP + SP) % SP; sps.forEach((s, i) => { const u = ph + i * SP; s.visible = u < L; if (s.visible) s.position.copy(a).addScaledVector(dn, u); }); };
      place(0); kit.onFrame((dt, t) => place(t));
    }
    return L;
  }
  function beamPath(kit, pts, c, o = {}) {
    let s = o.s0 || 0;
    for (let i = 0; i + 1 < pts.length; i++) s += beam(kit, pts[i], pts[i + 1], c, { ...o, s0: s });
    return s;
  }
  // монитор на ножке (экран лицом к +z, повёрнут на rot)
  function monitor(kit, x, z, rot, tex, w, h, key) {
    const { T, at, box, clickable } = kit;
    const g = new T.Group(); at(g, x, 0, z); g.rotation.y = rot; if (key) clickable(g, key);
    at(box(10, 0.8, 7, PANEL), 0, 0.4, 0, g);
    at(box(2.2, 6.4, 1.4, PANEL), 0, 3.8, -0.8, g);
    const yC = 6.6 + h / 2;
    at(box(w + 1.8, h + 1.8, 1.4, 0x1f2430), 0, yC, 0, g);
    at(plane(kit, w, h, tex), 0, yC, 0.72, g);
    g.updateMatrixWorld(true);
    return { g, top: g.localToWorld(new T.Vector3(0, yC + h / 2 + 1.4, 0)), back: g.localToWorld(new T.Vector3(0, 3, -1.6)) };
  }

  // =====================================================================================
  // 1. Нейрон и рефлекс: рука над свечой → спинной мозг → мышца
  SC['nv-arc'] = (kit, d) => {
    const { T, at, box, cyl, keep, tag, clickable, v3, C } = kit;
    const ap = {}, APK = [];
    (d.ap || []).forEach(([k, n, c]) => { ap[k] = { name: n, c: num(c) }; APK.push(k); });
    const lab = d.lab || [], LET = d.letters || [], F = d.fire;
    const P0 = v3(-60, 24, 6); // локоть — ось, вокруг которой поднимается предплечье
    const W = p => p.clone().add(P0);

    // стойка-манекен и плечо в рукаве
    at(box(14, 2, 12, C.WOOD2), P0.x, 1, P0.z);
    at(cyl(1.1, P0.y - 5, C.STEEL, { edges: false }), P0.x, 2 + (P0.y - 5) / 2, P0.z);
    at(cyl(2, 2.2, C.BRASS), P0.x, P0.y - 4.6, P0.z);
    const up = cyl(3.9, 11, 0x3b6fd8, { r2: 4.2, edges: false }); up.rotation.z = 1.12; at(up, P0.x - 5.2, P0.y + 2.5, P0.z);

    // предплечье с кистью (поднимается, когда рефлекс сработал)
    const AG = new T.Group(); at(AG, P0.x, P0.y, P0.z); clickable(AG, 'hand');
    at(ball(kit, 4, SKIN, { hull: true }), 0, 0, 0, AG);
    const fa = cyl(3.6, 30, SKIN, { r2: 2.5, edges: false }); fa.rotation.z = -Math.PI / 2; at(fa, 16, 0, 0, AG);
    at(box(8, 2.2, 6.6, SKIN, { edges: false }), 33.5, -0.3, 0, AG);
    [4.2, 5, 4.8, 3.8].forEach((L, i) => {
      const fg = cyl(0.72, L, SKIN, { r2: 0.6, edges: false }); fg.rotation.z = -Math.PI / 2 - 0.25;
      at(fg, 37.5 + L / 2 * 0.97, -0.6 - L / 2 * 0.25, -2.4 + i * 1.6, AG);
    });
    const th = cyl(0.85, 4, SKIN, { r2: 0.7, edges: false }); th.rotation.z = -Math.PI / 2; at(th, 35.5, -1, 3.9, AG);
    // мышца-сгибатель: сокращается — короче и толще
    const mOn = !!d.fired;
    const mus = ball(kit, 1, mOn ? 0xe0555d : 0xb5535b, { matOpt: mOn ? { emissive: 0xe0555d, emissiveIntensity: 0.35 } : undefined });
    mus.scale.set(mOn ? 7 : 8.5, mOn ? 2.6 : 2.1, mOn ? 2.8 : 2.3); at(mus, 13, -1.4, 2.6, AG);
    tween(kit, 'nv-arm', d.fired ? 0.42 : 0, 0.35, a => { AG.rotation.z = a; });

    // свеча
    const CX = -18, CZ = 6;
    const cg = new T.Group(); at(cg, CX, 0, CZ); clickable(cg, 'fire');
    at(cyl(5, 1.2, C.BRASS), 0, 0.6, 0, cg);
    at(cyl(2.8, 12, 0xefe6d2), 0, 7.2, 0, cg);
    at(cyl(0.15, 1.2, 0x2a2f3a, { edges: false, hull: false }), 0, 13.8, 0, cg);
    const fl = new T.Mesh(keep(new T.ConeGeometry(0.95, 3.8, 18)), keep(new T.MeshBasicMaterial({ color: 0xffb02e, transparent: true, opacity: 0.92 }))); at(fl, 0, 16, 0, cg);
    const fl2 = new T.Mesh(keep(new T.ConeGeometry(0.45, 1.8, 14)), keep(new T.MeshBasicMaterial({ color: 0xfff3c4 }))); at(fl2, 0, 15.3, 0, cg);
    const halo = glow(kit, v3(0, 16, 0), 0xffa040, 9, 0.8, cg);
    at(new T.PointLight(0xffa040, 30, 45, 1.4), 0, 17, 0, cg);
    if (!kit.reduce) kit.onFrame((dt, t) => { const s = 1 + 0.08 * Math.sin(t * 13) + 0.05 * Math.sin(t * 7.3); fl.scale.set(1, s, 1); halo.scale.setScalar(9 * s); });

    // спинной мозг в разрезе на штативе: белое вещество снаружи, серое «бабочкой» внутри
    const CC = v3(24, 0, -4), CY = 24.06;
    at(box(26, 2, 20, C.WOOD2), CC.x, 1, CC.z);
    at(cyl(1.2, 14, C.STEEL, { edges: false }), CC.x, 9, CC.z);
    const cordG = new T.Group(); at(cordG, CC.x, 0, CC.z); clickable(cordG, 'cord');
    const cw = cyl(10, 8, 0xf1ece4, { seg: 48 }); cw.scale.z = 0.72; at(cw, 0, 20, 0, cordG);
    const RH = [[0, 1.3], [1.6, 2.2], [2.6, 4.6], [3.2, 5.6], [3.9, 5.3], [3.4, 3.2], [3.1, 1.2], [4.6, -0.6], [5.4, -2.8], [4.4, -4.4], [2.6, -3.9], [1.4, -2.4], [0, -1.7]];
    const bp = [...RH, ...RH.slice(1, -1).reverse().map(([x, y]) => [-x, y])];
    const sh = new T.Shape(); bp.forEach(([x, y], i) => i ? sh.lineTo(x, y) : sh.moveTo(x, y));
    const bf = new T.Mesh(keep(new T.ShapeGeometry(sh)), kit.toon(0xa99a90)); bf.rotation.x = -Math.PI / 2; at(bf, 0, CY, 0, cordG);
    const canal = new T.Mesh(keep(new T.CircleGeometry(0.45, 16)), kit.toon(0x3a4762)); canal.rotation.x = -Math.PI / 2; at(canal, 0, CY + 0.03, 0, cordG);
    at(text(kit, ['спина'], 5, 1.4, '#8b96ad', { flat: true }), 0, CY + 0.05, -9.2, cordG);
    at(text(kit, ['живот'], 5, 1.4, '#8b96ad', { flat: true }), 0, CY + 0.05, 9.2, cordG);
    const G = v3(12.5, 22.5, -10.5), INT = v3(22.4, CY + 0.35, -4.6), MOT = v3(20.2, CY + 0.35, -1.2);
    const gan = ball(kit, 1, 0x8d7f9a, { hull: true }); gan.scale.set(2.6, 1.8, 1.8); at(gan, G.x - CC.x, G.y, G.z - CC.z, cordG);

    // нервы: часть в руке (двигается с ней), часть от локтя до спинного мозга
    const armS = [v3(41.4, -1.9, 0.5), v3(37, 0.9, 0.6), v3(30, 2.6, 0.4), v3(20, 3.3, -0.3), v3(10, 3.9, -1.2), v3(3, 2.6, -3.4)];
    const armM = [v3(3, -1.6, -3.6), v3(6, -3.6, -0.8), v3(9, -3, 2.6), v3(13, -1.4, 4.9)];
    const stS = [W(armS[armS.length - 1]), v3(-50, 31, -1), v3(-32, 33, -8), v3(-8, 30, -11), v3(4, 24.5, -11.5), G];
    const s1 = [G, v3(16, 23.6, -10.2), v3(20.6, CY + 0.35, -9), v3(21.6, CY + 0.35, -6.5), INT];
    const s2 = [INT, v3(21.6, CY + 0.35, -2.8), MOT];
    const stM = [MOT, v3(17.5, 23.8, 0.8), v3(14.5, 22, 2), v3(6, 24, 5), v3(-20, 30, 8), v3(-44, 28, 5), W(armM[0])];
    const end = F ? (F.ok ? 4 : Math.max(0, F.bad)) : 0, lit = k => F && !F.run && k < end;
    const nerveCol = (k, base) => lit(k) ? { c: AMBER, m: { emissive: AMBER, emissiveIntensity: 0.6 } } : { c: base };
    const nv = (pts, r, k, base, parent) => { const q = nerveCol(k, base); return tube(kit, pts, r, q.c, { matOpt: q.m, parent }); };
    nv(armS, 0.55, 0, NERVE, AG); nv(stS, 0.55, 0, NERVE);
    nv(s1, 0.4, 1, NEU); nv(s2, 0.32, 2, NEU);
    nv(stM, 0.55, 3, NERVE); nv(armM, 0.55, 3, NERVE, AG);
    at(ball(kit, 0.75, NEU), INT.x, INT.y, INT.z); at(ball(kit, 1, 0x8f86c8), MOT.x, MOT.y, MOT.z);
    // кривые для бегущего импульса (рука опущена)
    const curves = [[...armS.map(W), ...stS.slice(1)], s1, s2, [...stM, ...armM.slice(1).map(W)]].map(p => new T.CatmullRomCurve3(p, false, 'centripetal'));
    const pt = s => { s = clamp(s, 0, 4); const i = Math.min(3, Math.floor(s)); return curves[i].getPointAt(clamp(s - i, 0, 1)); };

    // метки-флажки с буквами
    const SL = [{ a: armS[0], off: v3(1, 8.5, 4), arm: true }, { a: G, off: v3(-3, 8, -1) }, { a: INT, off: v3(1, 9.5, -5) }, { a: MOT, off: v3(-4, 8, 7) }, { a: v3(13, -1.4, 5), off: v3(-1, -7, 6), arm: true }];
    SL.forEach((s, i) => {
      const k = lab[i], sel = d.cur === i, g = new T.Group(); (s.arm ? AG : kit.root).add(g); clickable(g, 'sl' + i);
      const b = s.a.clone().add(s.off);
      rod(kit, s.a, b, 0.16, sel ? AMBER : 0x56627d, g);
      const tex = canvasTex(kit, 128, 128, x => {
        x.beginPath(); x.arc(64, 64, 54, 0, 7); x.fillStyle = k ? hex(ap[k].c) : '#1a2438'; x.fill();
        x.lineWidth = sel ? 10 : 6; x.strokeStyle = sel ? '#ffb547' : '#04070d'; x.stroke();
        x.font = '700 64px "Golos Text", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = k ? '#04070d' : '#e8ecf4'; x.fillText(LET[i] || '?', 64, 68);
      });
      const sp = new T.Sprite(keep(new T.SpriteMaterial({ map: tex, transparent: true }))); sp.scale.setScalar(4.4); sp.position.copy(b); sp.renderOrder = 6; g.add(sp);
      if (sel && !kit.reduce) kit.onFrame((dt, t) => sp.scale.setScalar(4.4 * (1 + 0.14 * Math.sin(t * 6))));
      if (sel) {
        const wp = s.arm ? W(b) : b;
        tag(wp.clone().add(v3(0, 2.8, 0)), `Метка ${LET[i] || ''}`, k ? ap[k].name.toLowerCase() : 'что здесь? выберите карточку');
      }
    });

    // импульс: бежит по дуге, пока опыт идёт; потом — итог
    if (F && F.run) {
      const head = glow(kit, pt(0), 0xfff3c4, 5.5, 1), trail = [0, 1, 2, 3, 4, 5].map(i => glow(kit, pt(0), AMBER, 4 - i * 0.45, 0.75 - i * 0.1));
      const place = () => {
        const p = F.dur > 0 ? clamp((performance.now() - F.t0) / F.dur, 0, 1) : 1, s = p * end;
        head.position.copy(pt(s)); trail.forEach((g, i) => g.position.copy(pt(Math.max(0, s - (i + 1) * 0.04))));
      };
      place(); if (!kit.reduce) kit.onFrame(place);
    } else if (F && F.ok) {
      const g = glow(kit, v3(13, -1.4, 4), OK, 9, 0.85, AG);
      if (!kit.reduce) kit.onFrame((dt, t) => g.scale.setScalar(9 * (1 + 0.12 * Math.sin(t * 5))));
    } else if (F && !F.ok && F.bad >= 0) {
      const s = SL[F.bad], p = s.arm ? W(s.a) : s.a;
      glow(kit, p, BAD, 7, 0.9);
      const x = text(kit, ['✗'], 3, 3, '#ff5a40', { ch: 128 }); x.position.copy(p).add(v3(0, 3, 1.5)); kit.root.add(x);
    }

    // музейная модель нейрона у заднего края стола
    const NZ = -34, NY = 9, NB = -34;
    at(box(90, 1.6, 8, PANEL), 6, 0.8, NZ);
    [-30, 8, 40].forEach(x => at(cyl(0.55, NY - 1.6, C.STEEL, { edges: false, hull: false }), x, 1.6 + (NY - 1.6) / 2, NZ - 1));
    const dG = new T.Group(); kit.root.add(dG); clickable(dG, 'n-dend');
    [150, 180, 210, 120, 240, 100].forEach((deg, i) => {
      const a = deg * Math.PI / 180, z = (i % 3 - 1) * 1.4, p0 = v3(NB + Math.cos(a) * 2.6, NY + Math.sin(a) * 2.6, NZ), p1 = v3(NB + Math.cos(a) * 8, NY + Math.sin(a) * 8, NZ + z);
      rod(kit, p0, p1, 0.42, NEU, dG);
      [-0.5, 0.5].forEach(da => rod(kit, p1, v3(p1.x + Math.cos(a + da) * 3.6, p1.y + Math.sin(a + da) * 3.6, p1.z + da * 1.5), 0.26, NEU, dG));
    });
    const bG = new T.Group(); kit.root.add(bG); clickable(bG, 'n-body');
    at(ball(kit, 3, 0x8f86c8, { hull: true }), NB, NY, NZ, bG);
    at(ball(kit, 1.25, 0x3a2f6a), NB + 0.4, NY + 0.3, NZ + 2.3, bG);
    const aG = new T.Group(); kit.root.add(aG); clickable(aG, 'n-axon');
    rod(kit, v3(NB + 2.8, NY, NZ), v3(40, NY, NZ), 0.45, NEU, aG);
    const mG = new T.Group(); kit.root.add(mG); clickable(mG, 'n-myel');
    const nodes = [];
    for (let x = -27; x + 6.2 <= 37; x += 8) { const m = cyl(1.25, 6.2, BONE, { edges: false, seg: 18 }); m.rotation.z = Math.PI / 2; at(m, x + 3.1, NY, NZ, mG); nodes.push(x - 0.9); }
    nodes.push(37.5);
    const sG = new T.Group(); kit.root.add(sG); clickable(sG, 'n-syn');
    [v3(44, NY + 3, NZ), v3(45, NY, NZ + 1), v3(44, NY - 3, NZ)].forEach(p => { rod(kit, v3(40, NY, NZ), p, 0.3, NEU, sG); at(ball(kit, 1, AMBER), p.x, p.y, p.z, sG); });
    at(box(1, 10, 6, 0xb5535b), 47.4, NY, NZ, sG);
    at(text(kit, ['дендриты'], 9, 1.8, '#8b96ad', { flat: true }), NB - 6, 1.65, NZ + 3);
    at(text(kit, ['аксон в миелине'], 14, 1.8, '#8b96ad', { flat: true }), 6, 1.65, NZ + 3);
    at(text(kit, ['синапс'], 7, 1.8, '#8b96ad', { flat: true }), 44, 1.65, NZ + 3);
    if (!kit.reduce) {
      const sp = glow(kit, v3(nodes[0], NY, NZ + 0.6), AMBER, 3.2, 0.95);
      kit.onFrame((dt, t) => { const k = Math.floor(t * 7) % (nodes.length + 4); sp.visible = k < nodes.length; if (sp.visible) sp.position.x = nodes[k]; });
    }

    // карточки звеньев: нажать метку, потом карточку
    const curK = d.cur >= 0 ? lab[d.cur] : null;
    APK.forEach((k, i) => {
      const on = curK === k, hgt = on ? 2.2 : 1.2, g = new T.Group(); at(g, -46 + i * 23, 0, 39); clickable(g, 'a:ap-' + k);
      at(box(20, hgt, 8, ap[k].c, on ? { matOpt: { emissive: ap[k].c, emissiveIntensity: 0.3 } } : undefined), 0, hgt / 2, 0, g);
      const w = ap[k].name.split(' ');
      const tp = plane(kit, 19, 7.2, cardTex(kit, w.length > 1 ? [w[0], w.slice(1).join(' ')] : w, { w: 400, h: 152, fg: '#14100a', bg: hex(ap[k].c), r: 12, fs: 0.62, allBold: true }));
      tp.rotation.x = -Math.PI / 2; at(tp, 0, hgt + 0.03, 0, g);
    });
    button(kit, null, -52, 0, 27, 'Коснуться огня', 0xc0563b, 'a:fire', 17, 5);
    button(kit, null, -33, 0, 27, 'Сбросить', OFF, 'a:reset', 12, 5);

    // подписи
    const st = F && F.run ? 'импульс бежит…' : d.fired ? `рука отдёрнута · ≈ ${d.t} мс` : F && !F.ok ? 'импульс оборвался' : 'нажмите — коснуться огня';
    tag(v3(CX - 4, 31, CZ + 6), 'Свеча', st, !!d.fired);
    tag(v3(CC.x + 4, 27, CC.z + 9), 'Спинной мозг', 'в разрезе');
    tag(v3(0, 4.5, 44), 'Звенья дуги', `названо ${d.placed} из ${APK.length}`, d.placed === APK.length);
    tag(v3(NB, NY + 5, NZ), 'Модель нейрона', 'нажмите на часть');
  };

  // =====================================================================================
  // 2. Головной мозг: модель на подставке, доли нажимаются
  SC['nv-brain'] = (kit, d) => {
    const { T, at, box, cyl, keep, toon, tag, clickable, v3, C } = kit;
    const RX = 24, RY = 14, RZ = 17, BC = v3(0, 33, -2), DS = T.DoubleSide;
    // точка на поверхности большого полушария: θ — от лба (0) к затылку (π), φ — вокруг оси (π — макушка, π/2 — бок к зрителю)
    const E = (t, p, s = 1) => v3(-RX * Math.cos(t) * s, -RY * Math.cos(p) * Math.sin(t) * s, RZ * Math.sin(p) * Math.sin(t) * s).add(BC);
    const br = {}; (d.br || []).forEach(([k, n, c]) => { br[k] = { name: n, c: num(c) }; });
    const solved = new Set(d.solved || []);
    const colOf = k => {
      const b = new T.Color(BRAIN);
      if (d.fl === k) return { c: d.flOk ? OK : BAD, e: 0.45 };
      if (d.part === k) return { c: b.lerp(new T.Color(br[k] ? br[k].c : BRAIN), 0.8).getHex(), e: 0.25 };
      if (solved.has(k)) return { c: b.lerp(new T.Color(br[k] ? br[k].c : BRAIN), 0.55).getHex(), e: 0 };
      return { c: BRAIN, e: 0 };
    };
    const matOf = k => { const q = colOf(k); return toon(q.c, q.e ? { side: DS, emissive: q.c, emissiveIntensity: q.e } : { side: DS }); };
    const patch = (t0, tL, p0, pL, mat, parent) => {
      const g = new T.SphereGeometry(1, 48, 24, p0, pL, t0, tL); g.rotateZ(Math.PI / 2);
      const m = kit.mesh(g, 0, { mat, edges: false }); m.scale.set(RX, RY, RZ); m.position.copy(BC); parent.add(m); return m;
    };
    // подставка
    at(box(48, 2.4, 34, C.WOOD2), 0, 1.2, -2);
    at(cyl(1.5, 5.4, C.BRASS), 8, 2.4 + 2.7, -2);
    // доли
    const T1 = 0.98, T2 = 2.25, PP = 1.15;
    const lobe = k => { const g = new T.Group(); kit.root.add(g); clickable(g, 'br-' + k); return g; };
    const gF = lobe('front'), gP = lobe('par'), gT = lobe('temp'), gO = lobe('occ');
    patch(0, T1, 0, Math.PI * 2, matOf('front'), gF);
    patch(T2, Math.PI - T2, 0, Math.PI * 2, matOf('occ'), gO);
    patch(T1, T2 - T1, Math.PI - PP, 2 * PP, matOf('par'), gP);
    patch(T1, T2 - T1, 0.25, Math.PI - PP - 0.25, matOf('temp'), gT);
    patch(T1, T2 - T1, Math.PI + PP, Math.PI - PP - 0.25, matOf('temp'), gT);
    patch(T1, T2 - T1, -0.25, 0.5, toon(0xc58e93, { side: DS }), kit.root);
    // борозды: продольная щель, центральная, боковая, теменно-затылочная
    const SUL = 0x7d5054, GY = 0xa87478;
    const line = (f, a, b, n, r, c) => { const pts = []; for (let i = 0; i <= n; i++) pts.push(f(a + (b - a) * i / n)); tube(kit, pts, r, c, { rs: 6 }); };
    line(t => E(t, Math.PI, 1.004), 0.12, 2.95, 30, 0.42, SUL);
    line(p => E(T1 + 0.05 * Math.sin(p * 9), p, 1.006), Math.PI - PP - 0.05, Math.PI + PP + 0.05, 30, 0.36, SUL);
    [Math.PI - PP, Math.PI + PP].forEach(p0 => line(t => E(t, p0 + 0.04 * Math.sin(t * 8), 1.006), T1 - 0.25, T2, 24, 0.36, SUL));
    line(p => E(T2, p, 1.006), Math.PI - PP - 0.05, Math.PI + PP + 0.05, 24, 0.3, SUL);
    // извилины
    [0.32, 0.6, 0.84].forEach((t0, j) => line(p => E(t0 + 0.06 * Math.sin(p * 7 + j), p, 1.008), 0.35, Math.PI * 2 - 0.35, 60, 0.22, GY));
    [2.5, 2.78].forEach((t0, j) => line(p => E(t0 + 0.05 * Math.sin(p * 8 + j), p, 1.008), 0.35, Math.PI * 2 - 0.35, 50, 0.22, GY));
    for (let j = 0; j < 5; j++) { const pc = Math.PI - PP + (j + 0.5) / 5 * 2 * PP; line(t => E(t, pc + 0.08 * Math.sin(t * 10 + j * 2), 1.008), T1 + 0.1, T2 - 0.1, 20, 0.22, GY); }
    [[0.45, Math.PI - PP - 0.1], [Math.PI + PP + 0.1, Math.PI * 2 - 0.45]].forEach(([a, b]) => { for (let j = 0; j < 3; j++) { const pc = a + (j + 0.5) / 3 * (b - a); line(t => E(t, pc + 0.08 * Math.sin(t * 10 + j), 1.008), T1 + 0.1, T2 - 0.1, 20, 0.22, GY); } });
    // мозжечок с листками
    const gC = lobe('cer');
    const qc = colOf('cer'), cb = ball(kit, 1, qc.c, { hull: true, ws: 32, hs: 20, matOpt: qc.e ? { emissive: qc.c, emissiveIntensity: qc.e } : undefined });
    cb.scale.set(8.5, 5.5, 12.5); at(cb, 15, 20, -2, gC);
    for (let k = -2; k <= 2; k++) { const y = k * 1.7, s = Math.sqrt(1 - (y / 5.6) ** 2), ring = kit.mesh(new T.TorusGeometry(1, 0.035, 6, 48), GY, { edges: false }); ring.rotation.x = Math.PI / 2; ring.scale.set(8.6 * s, 12.6 * s, 6); at(ring, 15, 20 + y, -2, gC); }
    // ствол: мост и продолговатый мозг
    const gS = lobe('stem'), qs = colOf('stem'), sm = qs.e ? { emissive: qs.c, emissiveIntensity: qs.e } : undefined;
    const pons = ball(kit, 1, qs.c, { hull: true, matOpt: sm }); pons.scale.set(4, 3.6, 4.6); at(pons, 4, 20, -2, gS);
    rod(kit, v3(5, 18.5, -2), v3(8, 7.4, -2), 2.5, qs.c, gS, { r2: 2.9, matOpt: sm, hull: true });
    // карточка ситуации на подставке
    const cg = new T.Group(); at(cg, -38, 0, 25); cg.rotation.x = -0.32; cg.rotation.y = 0.25;
    at(box(30.6, 13.4, 0.8, PANEL), 0, 7.2, 0, cg);
    const done = !d.sit;
    const lines = done ? ['Все ситуации разобраны!', 'нажимайте на отделы —', 'узнаете, что они делают'] : [`Ситуация ${d.q + 1} из ${d.n}`, d.sit[0], d.sit[1]];
    at(plane(kit, 29.4, 12.2, cardTex(kit, lines, { w: 640, h: 266, bg: '#121a28', border: done ? '#86e0a8' : '#ffb547', cols: [done ? '#86e0a8' : '#ffb547', '#e8ecf4', '#e8ecf4'], fs: 0.56 })), 0, 7.2, 0.42, cg);
    at(box(14, 1.2, 6, PANEL), 0, 0.6, -2.5, cg);
    // табличка с кнопками
    button(kit, null, 26, 0, 26, 'Подписи', d.names ? ON : OFF, 'a:names', 12, 5);
    button(kit, null, 40, 0, 26, 'Сначала', OFF, 'a:reset', 12, 5);
    // подписи
    if (d.names) {
      const at6 = { front: E(0.55, 1.35, 1.08), par: E(1.55, Math.PI - 0.35, 1.08), temp: E(1.65, 1.2, 1.1), occ: E(2.65, 1.9, 1.1), cer: v3(17, 18, 12), stem: v3(8, 10, 2) };
      Object.keys(at6).forEach(k => { if (br[k]) tag(at6[k], br[k].name, solved.has(k) ? '✓' : '', solved.has(k)); });
    }
    tag(v3(-38, 17, 25), 'Ситуации', `разобрано ${d.q} из ${d.n} · ошибок ${d.miss}`, done);
    tag(v3(-4, 51, -2), 'Головной мозг', `≈ 1,4 кг · ≈ ${d.W} Вт`);
  };

  // =====================================================================================
  // 3. Зрение и слух
  function modeRow(kit, mode) {
    button(kit, null, -58, 0, 37, 'Глаз', mode === 'eye' ? ON : OFF, 'a:m-eye', 9, 5);
    button(kit, null, -48, 0, 37, 'Ухо', mode === 'ear' ? ON : OFF, 'a:m-ear', 9, 5);
  }
  function viewTex(kit, obj, txt, sd) {
    return canvasTex(kit, 360, 240, (x, w, h) => {
      x.fillStyle = obj === 'book' ? '#f6f1e8' : '#3a4a68'; x.fillRect(0, 0, w, h);
      x.save(); if (sd > 0.05) x.filter = `blur(${(sd * 2.4).toFixed(1)}px)`;
      if (obj === 'book') { fitFont(x, txt, w * 0.86, 46, 700); x.fillStyle = '#1a2438'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, w / 2, h / 2 - 14); x.fillStyle = '#8b96ad'; [0, 1, 2].forEach(i => x.fillRect(50, h / 2 + 24 + i * 16, w - 100 - i * 40, 6)); }
      else { x.fillStyle = '#2f9e5a'; rrect(x, 30, 60, w - 60, 110, 12); x.fill(); fitFont(x, txt, w - 90, 52, 700); x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, w / 2, 117); x.fillStyle = '#8b96ad'; x.fillRect(w / 2 - 5, 170, 10, 70); }
      x.restore();
    });
  }
  function lensGeo(T, rad, tc, te, n = 14) {
    const hh = r => (te + (tc - te) * (1 - (r / rad) ** 2)) / 2, pts = [];
    for (let i = 0; i <= n; i++) { const r = Math.max(0.001, rad * i / n); pts.push(new T.Vector2(r, -hh(r))); }
    for (let i = n; i >= 0; i--) { const r = Math.max(0.001, rad * i / n); pts.push(new T.Vector2(r, hh(r))); }
    return new T.LatheGeometry(pts, 40);
  }

  SC['nv-eye'] = (kit, d) => {
    const { T, at, box, cyl, keep, toon, tag, clickable, v3, C } = kit;
    const DS = T.DoubleSide, EYC = 22, LXw = -6, ZR = 0.5, RY = 11.5;
    const X = mm => LXw + 20.8 + (mm - 16.67) * 4;
    const XC = LXw - 5, XR = X(d.dr), rx = (XR - XC) / 2, ECX = (XC + XR) / 2;
    // подставка
    at(box(rx * 2 + 10, 2, 22, C.WOOD2), ECX, 1, 2);
    at(cyl(1.3, EYC - RY - 2, C.STEEL, { edges: false }), ECX, 2 + (EYC - RY - 2) / 2, -5);
    at(cyl(2.6, 0.8, C.BRASS), ECX, EYC - RY - 0.1, -5);
    // глазное яблоко в разрезе: задняя половина, видна изнутри
    const half = (t0, tL) => { const g = new T.SphereGeometry(1, 48, 24, Math.PI, Math.PI, t0, tL); g.rotateZ(Math.PI / 2); return g; };
    const shell = (t0, tL, col, s, key) => {
      const m = kit.mesh(half(t0, tL), col, { mat: toon(col, { side: DS }), edges: false }); m.scale.set(rx * s, RY * s, RY * s);
      const g = new T.Group(); at(g, ECX, EYC, 0); g.add(m); if (key) clickable(g, key); return m;
    };
    shell(0.6, Math.PI - 0.6, 0xf3ece0, 1, 'ball');
    shell(0.7, Math.PI - 0.7, 0x8a4a46, 0.96);
    shell(Math.PI - 1.3, 1.3, 0xe0787a, 0.93, 'retina');
    const cut = new T.Mesh(keep(new T.RingGeometry(0.955, 1, 72, 1, -(Math.PI - 0.6), 2 * (Math.PI - 0.6))), toon(0xeadfcd, { side: DS })); cut.scale.set(rx, RY, 1); at(cut, ECX, EYC, 0.03);
    at(ball(kit, 0.9, 0xffd54a), XR - 1, EYC, -0.6);
    // роговица
    const cG = new T.Group(); at(cG, XC + 6, EYC, 0); clickable(cG, 'cornea');
    const cg = new T.SphereGeometry(6, 32, 12, Math.PI, Math.PI, 0, 1.0); cg.rotateZ(Math.PI / 2);
    cG.add(new T.Mesh(keep(cg), toon(0x9fd6ea, { side: DS, transparent: true, opacity: 0.45, depthWrite: false })));
    // радужка
    const xi = LXw - 1.6, iro = RY * Math.sqrt(Math.max(0.05, 1 - ((xi - ECX) / rx) ** 2)) - 0.5;
    const iG = new T.Group(); at(iG, xi, EYC, 0); clickable(iG, 'iris');
    const iris = new T.Mesh(keep(new T.RingGeometry(4.6, iro, 40, 1, -Math.PI / 2, Math.PI)), toon(0x8a5a36, { side: DS })); iris.rotation.y = Math.PI / 2; iG.add(iris);
    // хрусталик: толщина плавно меняется (аккомодация), нажать — выпуклее
    const LG = new T.Group(); at(LG, LXw, EYC, 0); clickable(LG, 'a:a+');
    const lb = new T.Mesh(keep(new T.SphereGeometry(1, 32, 20, Math.PI, Math.PI)), toon(0xffe2b0, { side: DS, transparent: true, opacity: 0.8 })); LG.add(lb);
    const lc = new T.Mesh(keep(new T.CircleGeometry(1, 48)), toon(0xffd9a0, { transparent: true, opacity: 0.9 })); lc.position.z = 0.04; LG.add(lc);
    [-1, 1].forEach(s => at(ball(kit, 1.3, 0xc47a7a), 0, s * 6.6, -0.6, LG));
    tween(kit, 'nv-acc', d.acc, 0.5, a => { const t = 1.5 + a * 0.22, r = 5.2 - a * 0.08; lb.scale.set(t, r, r); lc.scale.set(t, r, 1); });
    // зрительный нерв → монитор
    const sd = Math.min(5, Math.abs(d.mis) * 2.2);
    const mon = monitor(kit, 46, -14, 0.35, viewTex(kit, d.obj, d.txt, sd), 21, 14, 'view');
    const n0 = v3(XR - 0.8, EYC - 3.5, -2.5), n1 = v3(XR + 5, EYC - 6, -4);
    const nG = new T.Group(); kit.root.add(nG); clickable(nG, 'nerve');
    tube(kit, [n0, n1, v3(XR + 9, EYC - 9, -5)], 1.7, NERVE, { parent: nG, hull: true });
    kit.cable(v3(XR + 9, EYC - 9, -5), mon.back, NERVE, 0, { r: 0.7, lift: 1 });

    // предмет: книга на подставке (25 см) или вывеска на столбе (6 м, не в масштабе)
    const book = d.obj === 'book', XO = book ? -36 : -62;
    const oG = new T.Group(); at(oG, XO, 0, 0); clickable(oG, book ? 'a:ob-sign' : 'a:ob-book');
    if (book) {
      at(box(8, 2, 12, C.WOOD2), 0, 1, 0, oG); at(cyl(0.7, EYC - 7, C.STEEL, { edges: false }), 0, 2 + (EYC - 7) / 2 - 1, 0, oG);
      at(box(1.6, 11, 8.4, 0x5b7fd6), -0.4, EYC, 0, oG);
      const pg = plane(kit, 7.6, 10.2, cardTex(kit, ['Мозг', 'и чувства'], { w: 300, h: 400, bg: '#f6f1e8', fs: 0.42, r: 6 })); pg.rotation.y = Math.PI / 2; at(pg, 0.42, EYC, 0, oG);
    } else {
      at(box(6, 1.6, 6, PANEL), 0, 0.8, 0, oG); at(cyl(0.6, EYC - 4, C.STEEL, { edges: false }), 0, 1.6 + (EYC - 4.8) / 2, 0, oG);
      at(box(1, 7.4, 16, 0x2f9e5a), 0, EYC, 0, oG);
      const sg = plane(kit, 15, 6.4, cardTex(kit, [d.txt], { w: 600, h: 256, bg: '#2f9e5a', fg: '#ffffff', fs: 0.62, r: 8 })); sg.rotation.y = Math.PI / 2; at(sg, 0.52, EYC, 0, oG);
    }
    const xo = book ? XO + 0.4 : XO + 0.5;
    // пробная очковая линза в оправе
    const XG = XC - 8, gl = d.gl || 0;
    const gG = new T.Group(); at(gG, XG, 0, 0);
    at(box(17, 1.2, 14, PANEL), 0, 0.6, 3, gG);
    at(cyl(0.5, EYC - 7, C.STEEL, { edges: false }), 0, 1.2 + (EYC - 7.6) / 2, -2, gG);
    const rim = kit.mesh(new T.TorusGeometry(6, 0.42, 10, 48), 0x1f2430, { edges: false, hull: true }); rim.rotation.y = Math.PI / 2; at(rim, 0, EYC, 0, gG);
    if (gl) {
      const a = Math.abs(gl), lg = gl > 0 ? lensGeo(T, 5.7, 0.5 + a * 0.4, 0.35) : lensGeo(T, 5.7, 0.35, 0.55 + a * 0.4);
      const lm = kit.mesh(lg, 0xcfe6f2, { edges: false, shadow: false, matOpt: { transparent: true, opacity: 0.5, depthWrite: false, emissive: 0x6fb6d8, emissiveIntensity: 0.3 } });
      lm.rotation.z = Math.PI / 2; lm.renderOrder = 2; const lgG = new T.Group(); at(lgG, 0, EYC, 0, gG); lgG.add(lm); clickable(lgG, 'glass');
    }
    // лучи: от предмета → (очки) → хрусталик → фокус → сетчатка
    const xf = clamp(X(d.di), LXw + 3, XR + 16), XRr = XR - 0.5, after = d.sharp ? OK : BAD;
    let s0 = 0; const hits = [];
    [-1, 1].forEach((s, i) => {
      const ya = EYC + s * 4.2, pts = [];
      const src = book ? v3(xo, EYC, ZR) : v3(xo, ya, ZR);
      pts.push(src);
      if (gl) { const k = (XG - src.x) / (LXw - src.x); pts.push(v3(XG, src.y + (ya - src.y) * k, ZR)); }
      pts.push(v3(LXw, ya, ZR));
      const L1 = beamPath(kit, pts, AMBER, { s0: i * 3 });
      const yAt = x => ya + (EYC - ya) * (x - LXw) / (xf - LXw), yr = yAt(XRr);
      hits.push(yr);
      if (xf < XRr) beamPath(kit, [v3(LXw, ya, ZR), v3(xf, EYC, ZR), v3(XRr, yr, ZR)], after, { s0: L1 + i * 3 });
      else { beam(kit, v3(LXw, ya, ZR), v3(XRr, yr, ZR), after, { s0: L1 + i * 3 }); beam(kit, v3(XRr, yr, ZR), v3(xf, EYC, ZR), after, { op: 0.3, photons: false, r: 0.1 }); }
      s0 = L1;
    });
    const spread = Math.abs(hits[1] - hits[0]);
    if (d.sharp || spread < 0.6) glow(kit, v3(XRr, EYC, ZR + 0.2), after, 4, 0.95);
    else { at(box(0.5, spread, 0.4, BAD, { edges: false, matOpt: { emissive: BAD, emissiveIntensity: 0.7, transparent: true, opacity: 0.8 } }), XRr - 0.2, EYC, ZR); glow(kit, v3(XRr, EYC, ZR + 0.2), BAD, 2 + spread * 1.6, 0.6); }
    if (xf < XRr - 0.5 || xf > XRr + 0.5) glow(kit, v3(xf, EYC, ZR + 0.15), CYAN, 2.4, 0.9);

    // пульт: хрусталик, очки, тип глаза, предмет, режим
    button(kit, null, ECX - 6, 2, 9, 'Хрусталик −', 0x3b6fd8, 'a:a-', 11, 4.4);
    button(kit, null, ECX + 6, 2, 9, 'Хрусталик +', 0xc0563b, 'a:a+', 11, 4.4);
    button(kit, null, XG - 4.5, 1.2, 7.5, 'Очки −1', 0x3b6fd8, 'a:g-', 7.4, 4);
    button(kit, null, XG + 3.2, 1.2, 7.5, 'Очки +1', ON, 'a:g+', 7.4, 4);
    modeRow(kit, 'eye');
    [['norm', 'Норма'], ['myo', 'Близорукость'], ['hyp', 'Дальнозоркость']].forEach(([k, n], i) => button(kit, null, -32 + i * 14, 0, 37, n, d.eye === k ? ON : OFF, 'a:eye-' + k, 13, 5));
    [['book', 'Книга 25 см'], ['sign', 'Вывеска 6 м']].forEach(([k, n], i) => button(kit, null, 16 + i * 14, 0, 37, n, d.obj === k ? ON : OFF, 'a:ob-' + k, 13, 5));
    // подписи
    const where = d.sharp ? 'фокус на сетчатке' : d.mis > 0 ? 'фокус перед сетчаткой' : 'фокус за сетчаткой';
    const got = d.got || [], ng = got.filter(Boolean).length;
    tag(v3(ECX, EYC + RY + 3, 0), d.eyeName, `сила ${fm(d.P, 1)} дптр · ${where}`, d.sharp);
    tag(v3(XO, EYC + (book ? 8 : 6), 0), book ? 'Книга' : 'Вывеска', book ? '25 см · нажмите — сменить' : '6 м (не в масштабе)');
    if (gl) tag(v3(XG, EYC + 8, 0), 'Очки', `${gl > 0 ? '+' : '−'}${Math.abs(gl)} дптр`);
    tag(mon.top, 'Так видит глаз', `${d.sharp ? 'чётко' : 'размыто'} · опыты ${ng}/3`, ng >= 3);
  };

  SC['nv-ear'] = (kit, d) => {
    const { T, at, box, cyl, keep, toon, tag, clickable, v3, C } = kit;
    const DS = T.DoubleSide, CY = 16, hit = !!d.hit, pos = d.pos, tpos = d.tpos;
    // звуковой генератор с динамиком
    const gx = -60;
    at(box(12, 22, 11, 0x3b4a66), gx, 11, 0);
    at(box(11, 1, 10, 0x4a5b7c), gx, 22.5, 0);
    at(plane(kit, 9, 4, kit.keep(kit.textTex(d.fqTxt, '#86e0a8', '#0e1520', 256, 110))), gx, 7, 5.56);
    const spk = kit.mesh(new T.CylinderGeometry(4.2, 1.6, 2.6, 28, 1, true), 0x1f2430, { mat: toon(0x1f2430, { side: DS }), edges: false }); spk.rotation.z = -Math.PI / 2; at(spk, gx + 7.2, CY, 0);
    const cone = ball(kit, 1.4, 0x5d6a86); at(cone, gx + 6.4, CY, 0);
    button(kit, null, gx - 2.8, 23, 0, '÷1,25', 0x3b6fd8, 'a:f-', 5.2, 4.4);
    button(kit, null, gx + 2.8, 23, 0, '×1,25', 0xc0563b, 'a:f+', 5.2, 4.4);
    // звуковые волны: кольца от динамика к уху; чем выше звук, тем чаще
    const wl = 2 + 6 * (1 - pos), rings = [];
    for (let i = 0; i < 5; i++) { const r = kit.mesh(new T.TorusGeometry(3.2, 0.16, 6, 32), CYAN, { edges: false, matOpt: { emissive: CYAN, emissiveIntensity: 0.5, transparent: true, opacity: 0.7 } }); r.rotation.y = Math.PI / 2; at(r, gx + 9 + i * wl, CY, 0); rings.push(r); }
    const span = 15;
    if (!kit.reduce) kit.onFrame((dt, t) => rings.forEach((r, i) => { const u = ((t * 6 + i * wl) % (5 * wl)); r.visible = u < span; r.position.x = gx + 9 + u; r.scale.setScalar(1 + u / span * 0.6); }));
    // модель уха на подставке
    at(box(44, 2, 22, C.WOOD2), -12, 1, -1);
    [-30, -6].forEach(x => at(cyl(0.8, CY - 2, C.STEEL, { edges: false }), x, 2 + (CY - 2) / 2 - 2, -6));
    // ушная раковина
    const pG = new T.Group(); at(pG, -36, CY + 2, 0); clickable(pG, 'pinna');
    const pin = kit.mesh(new T.SphereGeometry(1, 32, 18, 0, Math.PI * 2, 0, Math.PI / 2), SKIN, { mat: toon(SKIN, { side: DS }), edges: false });
    pin.rotation.z = -Math.PI / 2; pin.scale.set(9, 2.2, 6); pG.add(pin);
    const helix = kit.mesh(new T.TorusGeometry(1, 0.08, 8, 40, Math.PI * 1.6), SKIN2, { edges: false }); helix.rotation.y = Math.PI / 2; helix.rotation.x = 0.3; helix.scale.set(8.4, 5.6, 5.6); pG.add(helix);
    // слуховой проход
    const caG = new T.Group(); kit.root.add(caG); clickable(caG, 'canal');
    const can = kit.mesh(new T.CylinderGeometry(1.7, 1.9, 13, 24, 1, true), SKIN2, { mat: toon(SKIN2, { side: DS }), edges: false }); can.rotation.z = Math.PI / 2; at(can, -28, CY, 0, caG);
    // барабанная перепонка (колеблется)
    const dG = new T.Group(); at(dG, -21.4, CY, 0); clickable(dG, 'drum');
    const drum = new T.Mesh(keep(new T.CircleGeometry(2.2, 32)), toon(0xe8ecf4, { side: DS })); drum.rotation.y = Math.PI / 2; dG.add(drum);
    // косточки: молоточек, наковальня, стремечко
    const oG = new T.Group(); at(oG, -21, CY, 0); clickable(oG, 'oss');
    rod(kit, v3(0.2, 0, 0), v3(1.2, 3.6, 0), 0.5, BONE, oG); at(ball(kit, 0.9, BONE), 1.3, 3.8, 0, oG);
    rod(kit, v3(1.3, 3.8, 0), v3(3.6, 2.6, 0), 0.5, BONE, oG); rod(kit, v3(3.6, 2.6, 0), v3(4.2, 0.6, 0), 0.35, BONE, oG);
    rod(kit, v3(4.2, 0.6, 0.7), v3(6.6, 0, 0.7), 0.25, BONE, oG); rod(kit, v3(4.2, 0.6, -0.7), v3(6.6, 0, -0.7), 0.25, BONE, oG);
    const fp = box(0.4, 1.2, 2, BONE, { edges: false }); at(fp, 6.7, 0, 0, oG);
    if (!kit.reduce) kit.onFrame((dt, t) => { const w = Math.sin(t * 40) * 0.15; drum.position.x = w; oG.rotation.z = w * 0.05; });
    // преддверие, полукружные каналы, улитка (спираль)
    const CC = v3(-6, CY, 0);
    const cG = new T.Group(); kit.root.add(cG); clickable(cG, 'coch');
    at(ball(kit, 2, 0xf0c8a8), -13.5, CY, 0, cG);
    [[0, 0], [Math.PI / 2, 0], [0, Math.PI / 2]].forEach(([ax, ay], i) => { const r = kit.mesh(new T.TorusGeometry(2.6, 0.38, 8, 32), 0xf0c8a8, { edges: false }); r.rotation.set(ax, ay, 0); at(r, -14 + i * 0.8, CY + 4.4, -0.6 * i, cG); });
    const sp = t => { const a = Math.PI + t * 2.6 * Math.PI * 2, r = 6 * (1 - 0.72 * t); return v3(CC.x + r * Math.cos(a), CC.y + r * Math.sin(a), CC.z + 1 + t * 4); };
    const spts = []; for (let i = 0; i <= 90; i++) spts.push(sp(i / 90));
    tube(kit, spts, 1.25, 0xf0c8a8, { parent: cG, seg: 260 });
    const peak = glow(kit, sp(pos), hit ? OK : AMBER, 5.5, 0.95);
    if (!kit.reduce) kit.onFrame((dt, t) => peak.scale.setScalar(5.5 * (1 + 0.15 * Math.sin(t * 9))));
    const tg = kit.mesh(new T.TorusGeometry(1.8, 0.28, 8, 24), AMBER, { edges: false, matOpt: { emissive: AMBER, emissiveIntensity: 0.4 } }); tg.position.copy(sp(tpos)); kit.root.add(tg); clickable(tg, 'target');
    // слуховой нерв → височная доля
    const nG = new T.Group(); kit.root.add(nG); clickable(nG, 'anerve');
    tube(kit, [v3(CC.x, CC.y, CC.z + 2), v3(CC.x + 6, CY + 3, -3), v3(10, CY + 8, -8), v3(19, CY + 10, -10)], 0.7, NERVE, { parent: nG });
    const mini = ball(kit, 1, BRAIN, { hull: true }); mini.scale.set(7, 5, 5); at(mini, 24, CY + 12, -11, nG);
    const tl = ball(kit, 1, 0x86e0a8, { matOpt: { emissive: 0x86e0a8, emissiveIntensity: 0.3 } }); tl.scale.set(3, 1.6, 1); at(tl, 23, CY + 10.5, -7.2, nG);
    // развёрнутая улитка: полоса от начала (высокие звуки) к верхушке (низкие), бегущая волна
    const UX0 = -6, UX1 = 54, UZ = 21, UY = 2.6;
    at(box(66, 1.6, 13, C.WOOD2), (UX0 + UX1) / 2, 0.8, UZ);
    const ux = u => UX0 + u * (UX1 - UX0);
    const shp = new T.Shape(); shp.moveTo(UX0, -3.2); shp.lineTo(UX1, -1.2); shp.lineTo(UX1, 1.2); shp.lineTo(UX0, 3.2); shp.closePath();
    const strip = new T.Mesh(keep(new T.ShapeGeometry(shp)), toon(0x3a4762)); strip.rotation.x = -Math.PI / 2; at(strip, 0, 1.65, UZ); clickable(strip, 'coch');
    const N = 64, bars = [], bgeo = keep(new T.BoxGeometry(0.7, 0.5, 1.6));
    const xp = ux(pos), w1 = 9.9, w2 = 2.6;
    for (let i = 0; i < N; i++) {
      const x = ux((i + 0.5) / N), e = Math.exp(-(((x - xp) / (x < xp ? w1 : w2)) ** 2));
      const c = hit && e > 0.5 ? OK : e > 0.25 ? AMBER : 0x8b96ad;
      const m = new T.Mesh(bgeo, toon(c, e > 0.25 ? { emissive: c, emissiveIntensity: 0.35 } : {})); at(m, x, UY, UZ); bars.push({ m, x, e });
    }
    const wave = t => bars.forEach(b => { b.m.position.y = UY + 0.3 + 2.4 * b.e * (0.5 + 0.5 * Math.sin((b.x - UX0) / 1.3 - t * 8)); });
    wave(0); if (!kit.reduce) kit.onFrame((dt, t) => wave(t));
    const tcone = kit.mesh(new T.ConeGeometry(1.1, 2.4, 4), AMBER, { edges: false, matOpt: { emissive: AMBER, emissiveIntensity: 0.4 } }); tcone.rotation.x = Math.PI; at(tcone, ux(tpos), 8.4, UZ - 2.4); clickable(tcone, 'target');
    (d.ticks || []).forEach(([s, u]) => { at(box(0.3, 0.2, 1.6, 0x8b96ad, { edges: false }), ux(u), 1.7, UZ + 4.4); at(text(kit, [s], 7, 1.8, '#8b96ad', { flat: true }), ux(u), 1.7, UZ + 6.2); });
    at(text(kit, ['начало улитки'], 11, 1.8, '#8b96ad', { flat: true }), UX0 + 5, 1.7, UZ - 5);
    at(text(kit, ['верхушка'], 8, 1.8, '#8b96ad', { flat: true }), UX1 - 4, 1.7, UZ - 5);
    modeRow(kit, 'ear');
    // подписи
    const got = d.got || [], ng = got.filter(Boolean).length;
    tag(v3(gx, 27, 0), 'Генератор', d.fqTxt, hit);
    tag(v3(-30, CY + 9, 0), 'Наружное и среднее ухо', 'перепонка и косточки');
    tag(v3(CC.x, CY + 10, 2), 'Улитка', hit ? 'колеблется отмеченное место' : pos > tpos ? 'пик ближе к верхушке — звук ниже' : 'пик ближе к началу — звук выше', hit);
    tag(v3(ux(tpos), 11.5, UZ - 2.4), 'Это место', `опыты ${ng}/3`, ng >= 3);
    tag(v3(24, CY + 19, -11), 'Слуховой нерв', '→ височная доля');
  };

  // =====================================================================================
  // 4. Сон и память
  SC['nv-sleep'] = (kit, d) => {
    const { T, at, box, cyl, keep, toon, tag, clickable, v3, C } = kit;
    // кровать со спящим
    const BX = -46;
    [[-20, -10], [-20, 10], [20, -10], [20, 10]].forEach(([x, z]) => at(box(2, 5, 2, C.WOOD2), BX + x, 2.5, z));
    at(box(44, 2, 24, C.WOOD), BX, 5.5, 0);
    at(box(2, 12, 24, C.WOOD2), BX - 22, 7, 0);
    at(box(42, 3, 22, 0xeef1f6), BX, 8, 0);
    at(box(8, 2.6, 15, 0xffffff, { edges: false }), BX - 15, 10.6, 0);
    const head = ball(kit, 3.2, SKIN, { hull: true }); at(head, BX - 14, 13, 0.5);
    const hair = kit.mesh(new T.SphereGeometry(3.35, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0x3a2a20, { edges: false }); hair.rotation.z = Math.PI / 2; at(hair, BX - 14.2, 13, 0.5);
    at(box(30, 3.4, 22.6, 0x5b7fd6), BX + 5, 10.9, 0);
    const hump = ball(kit, 1, 0x5b7fd6); hump.scale.set(12, 2.2, 6); at(hump, BX + 2, 12.2, 0);
    // «Z-z-z» над спящим
    const zz = [0, 1, 2].map(i => { const m = text(kit, ['z'], 2.4 + i * 0.8, 2.4 + i * 0.8, '#72d4e8', { ch: 128 }); at(m, BX - 12 + i * 2.6, 18 + i * 3, 2); return m; });
    if (!kit.reduce) kit.onFrame((dt, t) => zz.forEach((m, i) => { m.position.y = 18 + i * 3 + Math.sin(t * 1.6 + i) * 0.6; m.material.opacity = 0.5 + 0.5 * Math.sin(t * 1.6 + i * 1.3) ** 2; }));
    // тумбочка с будильником
    const NX = -14, NZ = -12;
    at(box(12, 12, 10, C.WOOD2), NX, 6, NZ);
    const cG = new T.Group(); at(cG, NX, 12, NZ); clickable(cG, 'wake');
    at(box(8.4, 4.6, 3.6, 0x1f2430), 0, 2.3, 0, cG);
    at(plane(kit, 7, 3.2, keep(kit.textTex(d.wake, d.wakeOk ? '#86e0a8' : '#ff8a73', '#0e1520', 256, 116))), 0, 2.3, 1.82, cG);
    [-2.6, 2.6].forEach(x => at(ball(kit, 1, 0xd8b04a, { hull: true }), x, 5.1, 0, cG));
    // планшет с гипнограммой
    const hyp = d.hyp || '', LV = { W: 0, R: 1, 1: 2, 2: 3, 3: 4 };
    const htex = canvasTex(kit, 640, 360, (x, w, h) => {
      x.fillStyle = '#0e1520'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#e8ecf4'; fitFont(x, `Ночь: ${d.bed} → ${d.wake} · ${fm(d.sleep, 1)} ч`, w - 40, 30, 700); x.textAlign = 'left'; x.textBaseline = 'top'; x.fillText(`Ночь: ${d.bed} → ${d.wake} · ${fm(d.sleep, 1)} ч`, 20, 14);
      const X0 = 92, X1 = w - 20, Y0 = 82, DY = 46, n = Math.max(1, hyp.length), sx = (X1 - X0) / (10 * 4);
      x.font = '500 20px "Golos Text", sans-serif'; x.fillStyle = '#8b96ad'; x.textAlign = 'right'; x.textBaseline = 'middle';
      ['бодр.', 'БДГ', 'N1', 'N2', 'глуб.'].forEach((s, i) => { x.fillText(s, X0 - 10, Y0 + i * DY); x.fillStyle = 'rgba(139,150,173,.15)'; x.fillRect(X0, Y0 + i * DY, X1 - X0, 1); x.fillStyle = '#8b96ad'; });
      x.strokeStyle = '#72d4e8'; x.lineWidth = 4; x.beginPath(); x.moveTo(X0, Y0);
      for (let i = 0; i < n; i++) { const yy = Y0 + (LV[hyp[i]] ?? 0) * DY; x.lineTo(X0 + i * sx, yy); x.lineTo(X0 + (i + 1) * sx, yy); }
      x.lineTo(X0 + n * sx, Y0); x.stroke();
      x.fillStyle = '#ff8a73'; for (let i = 0; i < n; i++) if (hyp[i] === 'R') x.fillRect(X0 + i * sx, Y0 + DY - 5, sx + 0.5, 10);
      x.strokeStyle = d.wakeOk ? '#86e0a8' : '#ff8a73'; x.lineWidth = 4; x.beginPath(); x.moveTo(X0 + n * sx, Y0 - 16); x.lineTo(X0 + n * sx, Y0 + 4 * DY + 10); x.stroke();
      x.fillStyle = '#56627d'; x.textAlign = 'center'; x.font = '500 18px "Golos Text", sans-serif';
      for (let k = 0; k <= 10; k++) x.fillText(String(((d.bedH || 23) + k) % 24).padStart(2, '0'), X0 + k * 4 * sx, Y0 + 4 * DY + 30);
    });
    const tG = new T.Group(); at(tG, -44, 0, -30); clickable(tG, 'hyp'); tG.rotation.y = 0.12;
    at(box(14, 1.4, 8, PANEL), 0, 0.7, 0, tG);
    at(box(2, 8, 1.6, PANEL), 0, 5, -1.5, tG);
    at(box(33, 19, 1.4, 0x1f2430), 0, 18, 0, tG);
    at(plane(kit, 31.4, 17.6, htex), 0, 18, 0.72, tG);
    // календарь до контрольной: дни, карточки-повторения, столбики памяти
    const DX = dd => 6 + dd * 8, TZ = 15, BZ = 1, BH = 26;
    at(box(68, 1, 10, PANEL), DX(3.5), 0.5, BZ);
    for (let dd = 0; dd <= 7; dd++) {
      const exam = dd === 7, g = new T.Group(); at(g, DX(dd), 0, TZ); clickable(g, dd === 0 ? 'mem' : exam ? 'exam' : 'day:' + dd);
      at(box(7.2, 1, 9, exam ? 0x7a3a3a : 0xf4efe2), 0, 0.5, 0, g);
      const lb = text(kit, [dd === 0 ? 'выучил' : exam ? 'к/р' : 'д.' + dd], 6.4, 2.2, exam ? '#ffd2c8' : '#1b1610', { flat: true }); at(lb, 0, 1.04, 3, g);
    }
    // столбики: доля выученного по четвертям дня
    const curve = d.curve || [], mG = new T.Group(); kit.root.add(mG); clickable(mG, 'mem');
    curve.forEach((v, i) => {
      const r = v / 100, hgt = Math.max(0.2, r * BH), last = i === curve.length - 1;
      const c = last ? (d.R7 >= 80 ? OK : BAD) : r >= 0.8 ? 0x86e0a8 : AMBER;
      at(box(1.5, hgt, 3, c, { edges: false, matOpt: last ? { emissive: c, emissiveIntensity: 0.35 } : undefined }), DX(i / 4), 1 + hgt / 2, BZ);
    });
    const thr = box(60, 0.15, 5, 0x86e0a8, { edges: false, matOpt: { transparent: true, opacity: 0.55, emissive: 0x86e0a8, emissiveIntensity: 0.4 } }); at(thr, DX(3.5), 1 + 0.8 * BH, BZ); clickable(thr, 'thr');
    at(text(kit, ['80 %'], 5, 2, '#86e0a8'), DX(0) - 6, 1 + 0.8 * BH, BZ);
    // карточки-повторения на днях календаря
    (d.reps || []).forEach((r, i) => {
      const g = new T.Group(); at(g, DX(r), 1, TZ - 1.4); clickable(g, 'mem');
      [0, 1, 2].forEach(k => { const c = box(4.4, 0.35, 5.6, k === 2 ? PURPLE : 0xd8c8ff, { edges: true }); c.rotation.y = (k - 1) * 0.12; at(c, 0, 0.2 + k * 0.4, 0, g); });
      rod(kit, v3(DX(r), 2.4, TZ - 1.4), v3(DX(r), 1 + BH * 0.95, BZ + 1.6), 0.12, PURPLE);
    });
    // листок контрольной
    const pg = plane(kit, 6, 7.4, cardTex(kit, ['к/р', `${d.R7} %`], { w: 240, h: 296, bg: '#ffffff', cols: ['#1b1610', d.R7 >= 80 ? '#2f9e5a' : '#e0473a'], fs: 0.5 }));
    pg.rotation.x = -Math.PI / 2; pg.rotation.z = -0.15; at(pg, DX(7), 1.4, TZ - 0.5); clickable(pg, 'exam');
    // кнопки
    button(kit, null, -58, 0, 35, 'Сон −30 мин', 0x3b6fd8, 'a:h-', 13, 5);
    button(kit, null, -43, 0, 35, 'Сон +30 мин', ON, 'a:h+', 13, 5);
    button(kit, null, -28, 0, 35, `Отбой ${d.bed}`, OFF, 'a:bed', 13, 5);
    button(kit, null, 14, 0, 35, '+ повторение', 0x7a5fc0, 'a:rep+', 14, 5);
    button(kit, null, 30, 0, 35, '− повторение', OFF, 'a:rep-', 14, 5);
    // подписи
    tag(v3(-44, 30, -30), 'Ночь', `${fm(d.sleep, 1)} ч · отбой ${d.bed}`, d.sleep >= 8);
    tag(v3(NX, 20, NZ), 'Подъём', `${d.wake} · ${d.wst}`, d.wakeOk);
    tag(v3(DX(7), 6, TZ), 'К контрольной', `помню ${d.R7} %`, d.R7 >= 80);
    const rp = (d.reps || []).slice().sort((a, b) => a - b);
    tag(v3(DX(3.5), 1 + BH + 3, BZ), 'Повторения', rp.length ? rp.map(r => 'д.' + fm(r, r % 1 ? 2 : 0).replace(/,?0+$/, '')).join(' · ') : 'нет — «+ повторение»');
  };
})();
