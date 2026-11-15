// «Как в жизни» для волновой оптики (labs/phys-wave): призма и спектр, опыт Юнга, дифракционная решётка,
// поляроиды и закон Малюса. Приборы стоят на тёмном сукне и на оптической скамье; лучи — цветные трубки с огоньками,
// картина на экране считается по тем же формулам, что и в опыте. Сцены строятся из window.LUCH_REAL() опыта;
// набор деталей kit — из /luch/real3d.js.
(() => {
  const SC = (window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {});
  const RAD = Math.PI / 180;
  const Y0 = 0.4; // верх тёмного сукна на столе
  const ORANGE = 0xffb547, PAPER = 0xf4efe2, GLASS = 0xcfe6f2, EVEC = 0x72d4e8, WARM = 0xfff1c8;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const f = (x, d = 0) => String(Math.round(x * 10 ** d) / 10 ** d).replace('.', ',').replace('-', '−');
  const ff = (x, d) => (Math.round(x * 10 ** d) / 10 ** d).toFixed(d).replace('.', ',').replace('-', '−'); // с нулями: 0,25

  // ---------- текстуры ----------
  const texC = {};
  function labelTex(T, txt, col, w = 256, h = 96) {
    const key = txt + col + w + 'x' + h; if (texC[key]) return texC[key];
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    let fs = Math.round(h * 0.72); x.font = `700 ${fs}px "Golos Text", sans-serif`;
    const tw = x.measureText(txt).width; if (tw > w * 0.92) { fs = Math.floor(fs * w * 0.92 / tw); x.font = `700 ${fs}px "Golos Text", sans-serif`; }
    x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, w / 2, h / 2 + 2);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; texC[key] = t; return t;
  }
  function flatLabel(kit, txt, col, w, h, flat) {
    const { T, keep } = kit;
    const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: labelTex(T, txt, col, Math.round(96 * w / h), 96), transparent: true, depthWrite: false })));
    if (flat) m.rotation.x = -Math.PI / 2;
    return m;
  }
  const canvasTex = (kit, w, h, draw) => {
    const { T, keep } = kit;
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = keep(new T.CanvasTexture(c)); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
  };
  const hex = c => '#' + c.toString(16).padStart(6, '0');

  // ---------- общие детали (как в real3d-optics.js) ----------
  function felt(kit) { kit.at(kit.box(126, Y0, 90, 0x2a2f3a, { edges: false }), 0, Y0 / 2, 3); }
  function rod(kit, a, b, r, col, o = {}) {
    const { T, cyl } = kit; const d = b.clone().sub(a), L = d.length();
    const m = cyl(r, L, col, { edges: false, hull: r >= 0.5, ...o });
    m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
    kit.root.add(m); return m;
  }
  function dashed(kit, a, b, col, o = {}) {
    const { T, keep } = kit; const r = o.r || 0.13, dash = o.dash || 1.3, gap = o.gap || 1;
    const d = b.clone().sub(a), L = d.length(); if (L < 0.1) return;
    const dn = d.clone().normalize(), q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dn);
    const geo = keep(new T.CylinderGeometry(r, r, dash, 6, 1)), mat = keep(new T.MeshBasicMaterial({ color: col, transparent: true, opacity: o.op ?? 0.8, depthWrite: false }));
    for (let s = 0; s + dash <= L + 0.01; s += dash + gap) {
      const m = new T.Mesh(geo, mat); m.quaternion.copy(q); m.position.copy(a).addScaledVector(dn, s + dash / 2); m.renderOrder = 3; kit.root.add(m);
    }
  }
  // луч: яркая сердцевина, мягкое свечение и бегущие огоньки (направление хода света)
  function beam(kit, a, b, k, o = {}) {
    const { T, keep } = kit;
    if (k < 0.03) return 0;
    const d = b.clone().sub(a), L = d.length(); if (L < 0.05) return 0;
    const dn = d.clone().normalize(), q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dn), mid = a.clone().addScaledVector(d, 0.5);
    const base = o.col ?? 0xff3b2a, kk = clamp(k, 0, 1);
    const coreCol = new T.Color(base).lerp(new T.Color(o.hot ?? 0xffffff), 0.5 * kk);
    const r = o.r || 0.24, gr = o.gr || 0.95;
    const core = new T.Mesh(keep(new T.CylinderGeometry(r, r, L, 8, 1, true)), keep(new T.MeshBasicMaterial({ color: coreCol, transparent: true, opacity: 0.3 + 0.7 * kk, depthWrite: false })));
    const glow = new T.Mesh(keep(new T.CylinderGeometry(gr, gr, L, 12, 1, true)), keep(new T.MeshBasicMaterial({ color: base, transparent: true, opacity: (o.go ?? 0.3) * kk, blending: T.AdditiveBlending, depthWrite: false })));
    [core, glow].forEach(m => { m.quaternion.copy(q); m.position.copy(mid); m.renderOrder = 3; kit.root.add(m); });
    if (!kit.reduce && kk > 0.1 && o.photons !== false) {
      const SP = o.sp || 7, V = o.v || 24, s0 = o.s0 || 0, n = Math.ceil(L / SP) + 1, sps = [];
      const pm = keep(new T.SpriteMaterial({ map: kit.glowTex(), color: o.pcol ?? base, transparent: true, opacity: 0.95 * kk, blending: T.AdditiveBlending, depthWrite: false }));
      for (let i = 0; i < n; i++) { const s = new T.Sprite(pm); s.scale.setScalar((o.ps || 2.2) * (0.6 + 0.4 * kk)); s.renderOrder = 4; kit.root.add(s); sps.push(s); }
      const place = t => { const ph = ((t * V - s0) % SP + SP) % SP; sps.forEach((s, i) => { const u = ph + i * SP; s.visible = u < L; if (s.visible) s.position.copy(a).addScaledVector(dn, u); }); };
      place(0); kit.onFrame((dt, t) => place(t));
    }
    return L;
  }
  function beamPath(kit, pts, k, o = {}) {
    let s = o.s0 || 0;
    for (let i = 0; i + 1 < pts.length; i++) s += beam(kit, pts[i], pts[i + 1], k, { ...o, s0: s });
    return s;
  }
  function spot(kit, p, k, size = 5, col = 0xff5a40, o = {}) {
    const { T, keep } = kit;
    if (k < 0.04) return null;
    const s = new T.Sprite(keep(new T.SpriteMaterial({ map: kit.glowTex(), color: col, transparent: true, opacity: clamp(o.op ?? (0.4 + 0.6 * k), 0, 1), blending: T.AdditiveBlending, depthWrite: false })));
    if (o.sy) s.scale.set(size, o.sy, 1); else s.scale.setScalar(size);
    s.position.copy(p); s.renderOrder = 5; kit.root.add(s);
    if (o.pulse && !kit.reduce) kit.onFrame((dt, t) => s.scale.setScalar(size * (1 + 0.08 * Math.sin(t * 9) + 0.05 * Math.sin(t * 23))));
    return s;
  }
  function arc(kit, c, r, th0, thL, col) {   // дуга на высоте c.y в плоскости стола; θ от +x к −z
    const { T, keep } = kit;
    if (Math.abs(thL) < 0.05) return;
    const m = new T.Mesh(keep(new T.RingGeometry(r - 0.3, r + 0.3, 40, 1, th0, thL)), keep(new T.MeshBasicMaterial({ color: col, side: T.DoubleSide, transparent: true, depthWrite: false })));
    m.rotation.x = -Math.PI / 2; m.position.copy(c); m.renderOrder = 2; kit.root.add(m);
  }

  // ---------- оптическая скамья ----------
  const BT = Y0 + 2.6; // верх рельса скамьи
  function bench(kit, x0, x1, z) {
    const { at, box, C } = kit, L = x1 - x0, xm = (x0 + x1) / 2;
    [x0 + 3, x1 - 3].forEach(x => at(box(4, 1, 13, C.DARK), x, Y0 + 0.5, z));
    at(box(L, 1.4, 5, 0x4a5368), xm, Y0 + 1.7, z);
    at(box(L - 1, 0.5, 2.6, 0x9aa3b2, { edges: false }), xm, BT - 0.25, z);
    at(box(L - 2, 1, 0.12, 0xf1e3c2, { edges: false, shadow: false }), xm, Y0 + 1.7, z + 2.56);   // мерная лента на боку рельса
  }
  // рейтер на скамье со стойкой до высоты y; вернёт группу (детали прибора добавлять в неё)
  function rider(kit, x, z, y, g) {
    const { T, at, box, cyl, C } = kit;
    const r = g || new T.Group(); if (!g) at(r, 0, 0, 0);
    at(box(5, 2, 7.4, 0x5d6a86), x, BT + 1, z, r);
    const sc = cyl(0.55, 2.2, C.BRASS, { edges: false }); sc.rotation.x = Math.PI / 2; at(sc, x, BT + 1, z + 4.4, r);   // стопорный винт
    if (y > BT + 2.2) at(cyl(0.65, y - BT - 2, C.STEEL, { edges: false }), x, (BT + 2 + y) / 2, z, r);
    return r;
  }

  // =====================================================================================
  // 1. Дисперсия: осветитель со щелью, призма на столике, полупрозрачный экран со спектром
  SC['wopt-prism'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, v3, C } = kit;
    felt(kit);
    const s = 0.22, X = x => (x - 250) * s - 6, Z = y => (y - 214) * s, yT = Y0 + 4.6, yb = yT + 6;
    const P = (x, y) => v3(X(x), yb, Z(y));
    const [p1x, p1y] = d.p1, a = (30 - d.inc) * RAD, dir = { x: Math.cos(a), y: Math.sin(a) };
    // столик призмы: треножник, колонка, круглый стол
    const cx = X(250), cz = Z(234);
    at(cyl(7, 1, C.DARK), cx, Y0 + 0.5, cz);
    at(cyl(1.4, yT - Y0 - 2, C.STEEL, { edges: false }), cx, (Y0 + 1 + yT - 1) / 2, cz);
    at(cyl(26, 1, 0x3b4252, { seg: 64 }), cx, yT - 0.5, cz);
    // призма: равносторонняя, A = 60°, высота 12
    const sh = new T.Shape(); d.pr.forEach(([x, y], i) => (i ? sh.lineTo(X(x), -Z(y)) : sh.moveTo(X(x), -Z(y)))); sh.closePath();
    const prism = mesh(new T.ExtrudeGeometry(sh, { depth: 12, bevelEnabled: false }), GLASS, { matOpt: { transparent: true, opacity: 0.3, depthWrite: false }, edgeAngle: 20, shadow: false });
    prism.rotation.x = -Math.PI / 2; at(prism, 0, yT, 0); prism.renderOrder = 1; clickable(prism, 'prism');
    const [tx, ty] = d.pr[0];
    at(box(0.12, 11, 0.4, 0xffffff, { edges: false, shadow: false, matOpt: { transparent: true, opacity: 0.5 } }), X(tx) - 4, yT + 6, Z(ty) + 7);
    // экран: калька в деревянной рамке, видна с обеих сторон
    const [sx, sy0, sy1] = d.scr, xS = X(sx) + 0.6, z0 = Z(sy0), z1 = Z(sy1), hS = 18;
    const sg = new T.Group(); at(sg, 0, 0, 0); clickable(sg, 'mode');
    [z0, z1].forEach(z => { at(box(1.4, hS + 3, 1.4, C.WOOD), xS, Y0 + (hS + 3) / 2, z, sg); at(box(7, 1, 3, C.WOOD2), xS, Y0 + 0.5, z, sg); });
    at(box(1.4, 1.4, z1 - z0 + 1.4, C.WOOD), xS, Y0 + hS + 3.6, (z0 + z1) / 2, sg);
    at(box(0.4, hS, z1 - z0 - 1.4, PAPER, { edges: false, shadow: false, matOpt: { transparent: true, opacity: 0.72, depthWrite: false } }), xS, Y0 + 2 + hS / 2, (z0 + z1) / 2, sg);
    // осветитель со щелью: направлен на точку входа P1
    const back = 112, L0 = P(p1x - dir.x * back, p1y - dir.y * back), dv = v3(dir.x, 0, dir.y);
    const lg = new T.Group(); lg.position.copy(L0).setY(0); lg.rotation.y = Math.atan2(-dir.y, dir.x); kit.root.add(lg); clickable(lg, 'lamp');
    at(cyl(4.5, 1, C.DARK), -7, Y0 + 0.5, 0, lg);
    at(cyl(0.9, yb - Y0 - 5, C.STEEL, { edges: false }), -7, (Y0 + yb - 4) / 2, 0, lg);
    at(box(13, 8.5, 8, 0x2c3240), -7.5, yb + 0.5, 0, lg);
    for (let i = 0; i < 4; i++) at(box(1, 1.2, 7, 0x3b4a66), -12 + i * 2.6, yb + 5.3, 0, lg);
    const tube = cyl(2.6, 3.4, 0x3b4a66); tube.rotation.z = Math.PI / 2; at(tube, 0.6, yb, 0, lg);
    at(box(0.3, 5.4, 5.4, 0x15181f), 2.4, yb, 0, lg);
    const modeCol = d.mode === 'white' ? WARM : new T.Color(d.rays[0].c).getHex();
    at(box(0.32, 4, 0.5, modeCol, { edges: false, matOpt: { emissive: modeCol, emissiveIntensity: 1 } }), 2.5, yb, 0, lg);
    if (d.mode !== 'white') at(box(0.5, 5, 5, modeCol, { edges: false, matOpt: { transparent: true, opacity: 0.55 } }), -0.6 + 3.6, yb, 0, lg);   // светофильтр
    const lamp = new T.PointLight(0xffd9a0, 20, 40, 1.3); lamp.position.set(-7, yb + 1, 0); lg.add(lamp);
    const exit = L0.clone().addScaledVector(dv, 2.6);
    spot(kit, exit, 1, 3.4, modeCol);
    // нормаль к левой грани и угол падения
    const N = v3(Math.cos(30 * RAD), 0, Math.sin(30 * RAD)), E1 = P(p1x, p1y);
    dashed(kit, E1.clone().addScaledVector(N, -15), E1.clone().addScaledVector(N, 9), 0xe8ecf4, { op: 0.6 });
    if (d.inc >= 5) {
      const c = E1.clone(); arc(kit, c, 8, 150 * RAD, d.inc * RAD, 0xffd54a);
      const lb = flatLabel(kit, 'i', '#ffd54a', 2.6, 2.6, true); const am = (150 + d.inc / 2) * RAD; lb.position.set(c.x + 10.5 * Math.cos(am), c.y + 0.05, c.z - 10.5 * Math.sin(am)); kit.root.add(lb);
    }
    // лучи: падающий (белый или цветной), внутри призмы — свой цвет у каждой длины волны, на выходе — веер к экрану
    const one = d.rays.length === 1;
    const s1 = beam(kit, exit, E1, 1, { col: modeCol, hot: 0xffffff, r: 0.32, gr: 1.1, pcol: modeCol, sp: 8 });
    const hits = [];
    d.rays.forEach((r, i) => {
      const col = new T.Color(r.c).getHex(), op = { col, hot: col, r: 0.2, gr: 0.6, go: 0.35, pcol: col, ps: 1.6, sp: 9, v: 18, photons: one || i % 2 === 0 };
      const pts = r.p.map(q => P(q[0], q[1]));
      let s0 = beamPath(kit, pts, 0.9, { ...op, s0: s1 });
      if (!r.o) return;
      const [ox, oy, odx, ody] = r.o;
      let len = 600, onS = false;
      if (odx > 0) { const t = (sx - ox) / odx, y = oy + t * ody; if (y >= sy0 && y <= sy1) { len = t; onS = true; } }
      const A = P(ox, oy); let B = P(ox + odx * len, oy + ody * len);
      if (!onS) { // не на экране: обрезаем у края сукна
        const dv2 = B.clone().sub(A), L = dv2.length(), dn = dv2.normalize(); let tt = L;
        if (dn.x > 0) tt = Math.min(tt, (61 - A.x) / dn.x); if (dn.z > 0) tt = Math.min(tt, (46 - A.z) / dn.z); if (dn.z < 0) tt = Math.min(tt, (-40 - A.z) / dn.z);
        B = A.clone().addScaledVector(dn, tt);
      }
      beam(kit, A, B, 0.95, { ...op, s0 });
      if (onS) { hits.push(B.z); spot(kit, B.clone().setX(xS + 0.5), 1, one ? 2.4 : 1.3, col, { sy: 9, op: 0.95 }); }
    });
    // подписи
    const devOf = r => { if (!r.o) return null; const c = dir.x * r.o[2] + dir.y * r.o[3]; return Math.acos(clamp(c, -1, 1)) / RAD; };
    const MN = { white: 'белый', red: 'красный', green: 'зелёный', violet: 'фиолетовый' };
    let sv;
    if (one) { const dv1 = devOf(d.rays[0]); sv = d.rays[0].ok && dv1 !== null ? `${MN[d.mode]} · δ = ${f(dv1, 1)}°` : 'луч не выходит'; }
    else sv = d.ok ? `δ: красный ${f(d.dr, 1)}° · фиол. ${f(d.dv, 1)}°` : 'часть лучей не выходит';
    tag(v3(L0.x - 4, yb + 9, L0.z), 'Осветитель', `i = ${d.inc}°`);
    tag(v3(X(tx), yT + 15, Z(ty) + 3), 'Призма', `${d.gname} · A = 60°`);
    const zt = hits.length ? clamp((Math.min(...hits) + Math.max(...hits)) / 2, z0 + 6, z1 - 6) : (z0 + z1) / 2;
    tag(v3(xS, Y0 + hS + 7, zt), 'Экран', sv, d.ok && d.inc === 50);
    tag(v3(-20, Y0 + 1, 40), 'При i = 50°', `записано ${d.seen}/3`, d.done);
  };

  // =====================================================================================
  // 2. Опыт Юнга: лазер, пластинка с двумя щелями, полупрозрачный экран с полосами, датчик со стрелочным… цифровым прибором
  const FAN_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const FAN_FS = `
    uniform float uT, uLen, uW, uLam, uD, uA, uL; uniform vec3 uCol; varying vec2 vUv;
    void main(){
      float X = vUv.x * uLen, Z = (vUv.y - 0.5) * uW;
      float hw = 0.5 * uW * X / uLen + 0.5;
      if (X < 0.2 || abs(Z) > hw) discard;
      float th = Z / X * (uLen / (uL * 1000.0));          // угол (рад) в настоящем опыте
      float lam = uLam * 1e-6;                              // нм → мм
      float c = cos(3.14159265 * uD * th / lam), I = c * c;
      float u = 3.14159265 * uA * th / lam; if (abs(u) > 1e-4) I *= pow(sin(u) / u, 2.0);
      float r = sqrt(X * X + Z * Z);
      float crest = 0.5 + 0.5 * cos(6.2831853 * (r / 2.4 - uT));
      float a = I * (0.35 + 0.65 * crest) * smoothstep(hw, hw - 1.2, abs(Z)) * smoothstep(0.0, 5.0, X) * 0.75;
      gl_FragColor = vec4(uCol, a);
    }`;
  const young = (d, x) => {   // та же формула, что в опыте: x — мм на экране
    const k = d.d * x / d.L * 1000 / d.lam, u = Math.PI * d.a * x / d.L * 1000 / d.lam;
    const env = Math.abs(u) < 1e-9 ? 1 : (Math.sin(u) / u) ** 2;
    return Math.cos(Math.PI * k) ** 2 * env;
  };
  SC['wopt-young'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, v3, C } = kit;
    felt(kit);
    const colObj = new T.Color(d.col), col = colObj.getHex(), yb = Y0 + 15, zB = 0;
    const xp = -36, K = 30, xs = xp + d.L * K, W = 36, HS = 22;
    bench(kit, -60, 58, zB);
    // метры от щелей до экрана на мерной ленте и на сукне
    for (let m = 0; m <= 3.001; m += 0.1) {
      const big = Math.abs(m * 2 - Math.round(m * 2)) < 1e-6;
      at(box(0.14, big ? 0.8 : 0.45, 0.06, 0x3a2e22, { edges: false, shadow: false }), xp + m * K, Y0 + 1.7 + (big ? 0.1 : 0.25), zB + 2.65);
      if (big) { const lb = flatLabel(kit, m ? f(m, 1) + ' м' : '0', '#cfd6e4', 5, 1.9, true); at(lb, xp + m * K, Y0 + 0.05, zB + 5.6); }
    }
    // лазер на рейтере
    const lg = rider(kit, -50, zB, yb - 2.4); clickable(lg, 'laser');
    at(box(4, 1.2, 3.4, C.DARK), -50, yb - 2.2, zB, lg);
    const body = cyl(2.3, 15, 0x2c3240); body.rotation.z = Math.PI / 2; at(body, -51, yb, zB, lg);
    const band = cyl(2.38, 1.6, col, { edges: false, matOpt: { emissive: col, emissiveIntensity: 0.35 } }); band.rotation.z = Math.PI / 2; at(band, -55, yb, zB, lg);
    const cap = cyl(1.5, 1.6, C.STEEL); cap.rotation.z = Math.PI / 2; at(cap, -42.7, yb, zB, lg);
    at(box(1.2, 0.8, 2, 0xe0473a), -48, yb + 2.5, zB, lg);
    spot(kit, v3(-41.8, yb, zB), 1, 3.4, col, { pulse: true });
    beam(kit, v3(-41.8, yb, zB), v3(xp - 0.3, yb, zB), 1, { col, r: 0.34, gr: 1.1, sp: 6 });
    // пластинка с двумя щелями в держателе
    const pg = rider(kit, xp, zB, yb - 7); clickable(pg, 'plate');
    at(box(1.2, 1.2, 15, C.DARK), xp, yb - 6.6, zB, pg);
    [-7, 7].forEach(z => at(box(1.2, 14, 1.2, C.DARK), xp, yb, zB + z, pg));
    at(box(0.35, 12, 12.8, 0x15181f), xp, yb, zB, pg);
    const sep = d.d * 10;
    [-sep / 2, sep / 2].forEach(z => at(box(0.42, 5, 0.16, 0xf4efe2, { edges: false, matOpt: { emissive: col, emissiveIntensity: 0.6 } }), xp + 0.05, yb, zB + z, pg));
    spot(kit, v3(xp - 0.3, yb, zB), 1, 6.5, col);
    // веер света за щелями: полосы сходятся к максимумам на экране, бегут гребни волн
    const len = xs - xp;
    const fan = new T.Mesh(keep(new T.PlaneGeometry(len, W)), keep(new T.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uLen: { value: len }, uW: { value: W }, uLam: { value: d.lam }, uD: { value: d.d }, uA: { value: d.a }, uL: { value: d.L }, uCol: { value: colObj.clone() } },
      vertexShader: FAN_VS, fragmentShader: FAN_FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    })));
    fan.rotation.x = -Math.PI / 2; at(fan, (xp + xs) / 2, yb, zB); fan.renderOrder = 3;
    if (!kit.reduce) kit.onFrame((dt, t) => { fan.material.uniforms.uT.value = t * 0.8; });
    // экран: калька в рамке; картина считается по формуле опыта, 1 мм на экране = 1 деление
    const sg = rider(kit, xs, zB, Y0 + 3); clickable(sg, 'screen');
    at(box(3, 1, 3, C.DARK), xs, BT + 2.4, zB, sg);
    [-W / 2 - 1, W / 2 + 1].forEach(z => at(box(1.3, HS + 4, 1.3, C.WOOD), xs, yb + 1, zB + z, sg));
    at(box(1.3, 1.3, W + 3.3, C.WOOD), xs, yb + HS / 2 + 3.6, zB, sg);
    at(box(1.3, 1.3, W + 3.3, C.WOOD), xs, yb - HS / 2 - 1.6, zB, sg);
    at(box(0.3, HS, W, 0xe9e6de, { edges: false, shadow: false, matOpt: { transparent: true, opacity: 0.62, depthWrite: false } }), xs, yb + 1, zB, sg);
    const tex = canvasTex(kit, 1152, 704, (x, w, h) => {
      const mm = w / W, cy = h / 2 - mm;
      x.globalCompositeOperation = 'lighter';
      for (let i = 0; i < w; i++) {
        const xm = (i + 0.5) / mm - W / 2, I = young(d, xm); if (I < 0.01) continue;
        const g = x.createLinearGradient(0, cy - 4.2 * mm, 0, cy + 4.2 * mm);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, d.col); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.globalAlpha = Math.min(1, I * 1.1); x.fillStyle = g; x.fillRect(i, cy - 4.2 * mm, 1, 8.4 * mm);
      }
      x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
      // линейка в миллиметрах под картиной
      const ry = h - 3.2 * mm; x.strokeStyle = '#2b2620'; x.fillStyle = '#2b2620'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(mm, ry); x.lineTo(w - mm, ry); x.stroke();
      x.font = `600 ${Math.round(1.5 * mm)}px "IBM Plex Mono", monospace`; x.textAlign = 'center'; x.textBaseline = 'top';
      for (let k = -17; k <= 17; k++) {
        const px = (k + W / 2) * mm, big = k % 5 === 0;
        x.beginPath(); x.moveTo(px, ry); x.lineTo(px, ry - (big ? 1.4 : 0.7) * mm); x.stroke();
        if (big) x.fillText(String(k).replace('-', '−'), px, ry + 0.3 * mm);
      }
      x.textAlign = 'right'; x.fillText('мм', w - 0.6 * mm, ry - 2.6 * mm);
    });
    const face = new T.Mesh(keep(new T.PlaneGeometry(W, HS)), keep(new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: T.DoubleSide })));
    face.rotation.y = Math.PI / 2; at(face, xs + 0.2, yb + 1, zB, sg); face.renderOrder = 4;   // на экране +x↔−z: x мм → z = −x
    spot(kit, v3(xs + 0.3, yb, zB), 1, 4, col, { op: 0.6 });
    // датчик на направляющей перед экраном (со стороны света), провод к прибору
    const zp = zB - d.px;
    at(box(0.6, 0.6, W + 2, C.STEEL, { edges: false }), xs - 1.6, yb - 4.4, zB);
    const pr = new T.Group(); at(pr, 0, 0, 0); clickable(pr, 'probe');
    at(box(1.6, 3.4, 1.8, 0x2c3240), xs - 1.6, yb - 2.4, zp, pr);
    const lens = cyl(0.55, 0.4, 0x0d0f14, { edges: false, matOpt: { emissive: col, emissiveIntensity: d.I / 100 } }); lens.rotation.z = Math.PI / 2; at(lens, xs - 0.6, yb, zp, pr);
    const tip = mesh(new T.ConeGeometry(0.7, 1.6, 4), ORANGE, { edges: false }); tip.rotation.z = -Math.PI / 2; at(tip, xs - 0.9, yb - 4.4, zp, pr);
    const mX = clamp(xs - 14, -22, 40), mZ = 30, mT = v3(mX - 3, Y0 + 3.4, mZ - 4.4);
    kit.cable(v3(xs - 1.6, yb - 4.2, zp), mT, 0x2c3240, 0, { r: 0.32, lift: 2, via: [v3(xs - 3, Y0 + 1, zp + 6)] });
    // прибор: яркость в точке датчика, % от центральной полосы
    const mg = new T.Group(); at(mg, mX, 0, mZ); clickable(mg, 'probe'); mg.rotation.y = -0.2;
    at(box(16, 4, 10, 0xe8b23a), 0, Y0 + 2, 0, mg);
    at(box(15, 0.4, 9, 0x2c3240, { edges: false }), 0, Y0 + 4.2, 0, mg);
    const disp = new T.Mesh(keep(new T.PlaneGeometry(11, 4.2)), keep(new T.MeshBasicMaterial({ map: keep(kit.textTex(`${d.I} %`, '#86e0a8', '#0d1a14', 320, 120)) })));
    disp.rotation.x = -Math.PI / 2; at(disp, 0, Y0 + 4.45, -1.4, mg);
    const bar = Math.max(0.2, 11 * d.I / 100);
    at(box(bar, 0.12, 1.2, col, { edges: false, matOpt: { emissive: col, emissiveIntensity: 0.6 } }), -5.5 + bar / 2, Y0 + 4.48, 2.6, mg);
    // подписи
    tag(v3(-53, Y0 + 5, zB + 9), 'Лазер', `λ = ${d.lam} нм`);
    tag(v3(xp, yb + 10, zB), 'Две щели', `d = ${ff(d.d, 2)} мм`);
    tag(v3(xs, yb + HS / 2 + 6, zB - 8), 'Экран', `L = ${ff(d.L, 1)} м · Δx = ${ff(d.dx, 2)} мм`, Math.abs(d.dx - 3) < 1e-6);
    tag(v3(mX, Y0 + 7, mZ), 'Датчик', `x = ${ff(d.px, 1)} мм · Δ = ${ff(d.k, 2)}λ`, d.done);
  };

  // =====================================================================================
  // 3. Дифракционная решётка: лазер, решётка в рамке над лимбом, зрительная труба на поворотной алидаде
  SC['wopt-grating'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, v3, C } = kit;
    felt(kit);
    const col = new T.Color(d.col).getHex(), cx = -12, cz = 2, yL = Y0 + 2, yb = Y0 + 12, R = 40;
    const dirOf = phi => v3(Math.cos(phi * RAD), 0, -Math.sin(phi * RAD));
    const Cg = v3(cx, yb, cz);
    // лимб: полукруг со шкалой градусов (0° — вдоль лазера)
    at(cyl(5, yL - Y0, C.DARK), cx, (Y0 + yL) / 2, cz);
    at(mesh(new T.CylinderGeometry(R + 1.2, R + 1.2, 1.2, 96, 1, false, 4 * RAD, 172 * RAD), 0xe9dcc0, { edgeAngle: 50 }), cx, yL - 0.4, cz);
    const ltex = canvasTex(kit, 1024, 1024, (x, w) => {
      const c = w / 2, sc = c / (R + 1.2), r0 = R * sc;
      x.translate(c, c); x.strokeStyle = '#2b2620'; x.fillStyle = '#2b2620'; x.lineCap = 'round';
      for (let a = -80; a <= 80; a++) {
        const L = a % 10 === 0 ? 3.2 : a % 5 === 0 ? 2.2 : 1.2, ca = Math.cos(a * RAD), sa = Math.sin(a * RAD);
        x.lineWidth = a % 10 === 0 ? 3.2 : 1.8;
        x.beginPath(); x.moveTo(ca * r0, -sa * r0); x.lineTo(ca * (r0 - L * sc), -sa * (r0 - L * sc)); x.stroke();
      }
      x.font = `700 ${Math.round(2.4 * sc)}px "Golos Text", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let a = -80; a <= 80; a += 10) { const rr = r0 - 5.4 * sc; x.fillText(String(Math.abs(a)), Math.cos(a * RAD) * rr, -Math.sin(a * RAD) * rr); }
      x.lineWidth = 2; x.beginPath(); x.arc(0, 0, r0 - 8 * sc, -80 * RAD, 80 * RAD); x.stroke();
    });
    const lface = new T.Mesh(keep(new T.CircleGeometry(R + 1.2, 96, -86 * RAD, 172 * RAD)), keep(new T.MeshBasicMaterial({ map: ltex, transparent: true })));
    lface.rotation.x = -Math.PI / 2; at(lface, cx, yL + 0.22, cz);
    // лазер на стойке
    const lg = new T.Group(); at(lg, 0, 0, 0); clickable(lg, 'las');
    at(cyl(4, 1, C.DARK), -46, Y0 + 0.5, cz, lg);
    at(cyl(0.8, yb - Y0 - 3, C.STEEL, { edges: false }), -46, (Y0 + yb - 2) / 2, cz, lg);
    at(box(4, 1.2, 3.4, C.DARK), -46, yb - 2.2, cz, lg);
    const body = cyl(2.3, 15, 0x2c3240); body.rotation.z = Math.PI / 2; at(body, -46, yb, cz, lg);
    const band = cyl(2.38, 1.6, col, { edges: false, matOpt: { emissive: col, emissiveIntensity: 0.35 } }); band.rotation.z = Math.PI / 2; at(band, -50, yb, cz, lg);
    const cap = cyl(1.5, 1.6, C.STEEL); cap.rotation.z = Math.PI / 2; at(cap, -37.7, yb, cz, lg);
    if (d.las === 'x') { const q = flatLabel(kit, '?', '#ffd54a', 2.6, 2.6, false); q.rotation.y = 0.6; at(q, -46, yb + 3.4, cz + 1.4, lg); }
    spot(kit, v3(-36.8, yb, cz), 1, 3.4, col, { pulse: true });
    const s1 = beam(kit, v3(-36.8, yb, cz), Cg, 1, { col, r: 0.34, gr: 1.1, sp: 6 });
    // решётка в рамке на стойке в центре лимба
    const gg = new T.Group(); at(gg, 0, 0, 0); clickable(gg, 'N');
    at(cyl(0.7, yb - 6 - yL, C.STEEL, { edges: false }), cx, (yL + yb - 6) / 2, cz, gg);
    at(box(1.4, 1.2, 12, C.DARK), cx, yb - 6, cz, gg);
    [-6, 6].forEach(z => at(box(1.4, 12, 1.2, C.DARK), cx, yb, cz + z, gg));
    at(box(1.4, 1.2, 12, C.DARK), cx, yb + 6, cz, gg);
    const gtex = canvasTex(kit, 256, 256, (x, w, h) => {
      x.fillStyle = 'rgba(200,225,245,.35)'; x.fillRect(0, 0, w, h);
      const step = clamp(14 - d.N / 60, 3, 13); x.strokeStyle = 'rgba(40,50,70,.55)'; x.lineWidth = 1;
      for (let i = 2; i < w; i += step) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); }
      const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0.2, 'rgba(255,90,90,.18)'); g.addColorStop(0.5, 'rgba(90,255,140,.18)'); g.addColorStop(0.8, 'rgba(120,120,255,.18)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
    });
    const gp = new T.Mesh(keep(new T.PlaneGeometry(10.8, 10.8)), keep(new T.MeshBasicMaterial({ map: gtex, transparent: true, side: T.DoubleSide, depthWrite: false })));
    gp.rotation.y = Math.PI / 2; at(gp, cx, yb, cz, gg); gp.renderOrder = 2;
    spot(kit, Cg.clone(), 1, 5, col);
    // максимумы: d·sin φ = kλ
    const tel = d.tel, ends = [];
    d.o.forEach(([k, phi]) => {
      const aimed = Math.abs(phi - tel) < 1.2, r = aimed ? 22 : 52, dn = dirOf(phi);
      let L = r; if (dn.x > 0) L = Math.min(L, (61 - cx) / dn.x); if (dn.z > 0) L = Math.min(L, (46 - cz) / dn.z); if (dn.z < 0) L = Math.min(L, (-40 - cz) / dn.z);
      const k0 = k === 0, kk = k0 ? 1 : 0.75;
      beam(kit, Cg, Cg.clone().addScaledVector(dn, L), kk, { col, r: k0 ? 0.3 : 0.2, gr: k0 ? 1 : 0.6, go: 0.25, sp: 7, s0: s1, photons: Math.abs(k) <= 1 });
      if (!aimed) spot(kit, Cg.clone().addScaledVector(dn, L), kk, 2.4, col);
      if (Math.abs(k) <= 3) { const lb = flatLabel(kit, String(k).replace('-', '−'), d.col, 2.6, 2.6, true); lb.position.copy(v3(cx, yL + 0.3, cz).addScaledVector(dirOf(phi + (k >= 0 ? -2.2 : 2.2)), R + 4)); kit.root.add(lb); }
      ends.push(phi);
    });
    // алидада со зрительной трубой: поворачивается вокруг центра решётки
    const ag = new T.Group(); ag.position.set(cx, 0, cz); ag.rotation.y = tel * RAD; kit.root.add(ag); clickable(ag, 't1');
    at(box(R - 6, 0.6, 3.2, 0x5d6a86), 6 + (R - 6) / 2, yL + 0.6, 0, ag);
    at(box(1.8, 0.2, 0.5, 0xe0473a, { edges: false }), R - 0.5, yL + 0.95, 0, ag);   // указатель на шкале
    [27, 37].forEach(x => at(cyl(0.6, yb - yL - 2.6, C.STEEL, { edges: false }), x, (yL + 0.9 + yb - 1.7) / 2, 0, ag));
    const tb = cyl(1.8, 16, 0x2c3240); tb.rotation.z = Math.PI / 2; at(tb, 32, yb, 0, ag);
    const ob = cyl(2.3, 2.6, 0x3b4a66); ob.rotation.z = Math.PI / 2; at(ob, 23.4, yb, 0, ag);
    const ep = cyl(1.1, 3.4, C.STEEL); ep.rotation.z = Math.PI / 2; at(ep, 41.6, yb, 0, ag);
    const ring = cyl(1.9, 0.8, C.BRASS, { edges: false }); ring.rotation.z = Math.PI / 2; at(ring, 30, yb, 0, ag);
    // микрометрический винт тонкой наводки
    const fs = new T.Group(); at(fs, 0, 0, 0, ag); clickable(fs, 'tf');
    const sc = cyl(0.35, 5, C.STEEL, { edges: false, hull: false }); sc.rotation.x = Math.PI / 2; at(sc, 34, yL + 1.4, 3.6, fs);
    const kn = cyl(1.3, 1.4, C.BRASS, { seg: 12 }); kn.rotation.x = Math.PI / 2; at(kn, 34, yL + 1.4, 6.3, fs);
    // что видно в окуляре: яркость максимума в перекрестье
    const eye = new T.Sprite(keep(new T.SpriteMaterial({ map: kit.glowTex(), color: col, transparent: true, opacity: clamp(d.B / 100, 0, 1), blending: T.AdditiveBlending, depthWrite: false })));
    eye.scale.setScalar(2 + 4 * d.B / 100); eye.position.set(43.5, yb, 0); eye.renderOrder = 5; ag.add(eye);
    if (d.B > 50 && !kit.reduce) kit.onFrame((dt, t) => eye.scale.setScalar((2 + 4 * d.B / 100) * (1 + 0.1 * Math.sin(t * 6))));
    // подписи
    const name = d.las === 'x' ? 'λ = ?' : `λ = ${d.lam} нм`;
    tag(v3(-48, yb + 6, cz), 'Лазер', name);
    tag(v3(cx, yb + 11, cz), 'Решётка', `${d.N} штр/мм · d = ${ff(1000 / d.N, 2)} мкм`);
    const te = v3(cx, yb + 6, cz).addScaledVector(dirOf(tel), 36);
    tag(te, 'Труба', `φ = ${ff(tel, 1)}° · ${d.B} %`, d.B >= 90 || d.done);
  };

  // =====================================================================================
  // 4. Поляризация: лампа, поляризатор, (средний поляроид), анализатор в поворотных оправах со шкалами, люксметр
  function filmTex(kit) {
    return canvasTex(kit, 256, 256, (x, w, h) => {
      x.fillStyle = 'rgba(70,76,92,.55)'; x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(200,214,236,.38)'; x.lineWidth = 2;
      for (let i = 10; i < w; i += 20) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); }
    });
  }
  function scaleTex(kit) {
    return canvasTex(kit, 512, 512, (x, w) => {
      const c = w / 2, r1 = c * 0.98, r0 = c * 0.72;
      x.translate(c, c);
      x.fillStyle = '#f1e3c2'; x.beginPath(); x.arc(0, 0, r1, 0, 7); x.arc(0, 0, r0, 0, 7, true); x.fill();
      x.strokeStyle = '#2b2620'; x.fillStyle = '#2b2620'; x.lineCap = 'round';
      for (let a = 0; a < 360; a += 5) {
        const L = a % 30 === 0 ? 0.11 : 0.05, s = Math.sin(a * RAD), cc = Math.cos(a * RAD);
        x.lineWidth = a % 30 === 0 ? 4 : 2;
        x.beginPath(); x.moveTo(s * r1 * 0.97, -cc * r1 * 0.97); x.lineTo(s * r1 * (0.97 - L), -cc * r1 * (0.97 - L)); x.stroke();
      }
      x.font = `700 ${Math.round(c * 0.11)}px "Golos Text", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let a = 0; a < 360; a += 30) { const rr = r1 * 0.74, s = Math.sin(a * RAD), cc = Math.cos(a * RAD); x.fillText(String(a % 180), s * rr, -cc * rr); }
    });
  }
  // оправа: неподвижное кольцо со шкалой, поворотная плёнка с осью и ручкой; ось th от вертикали
  function polaroid(kit, x, th, key, film, scale, o = {}) {
    const { T, at, box, cyl, mesh, keep, clickable, C } = kit;
    const yb = o.yb, R = 7, g = rider(kit, x, 0, yb - R - 3.4); clickable(g, key);
    at(box(2.4, 2, 2.4, C.DARK), x, yb - R - 3.4, 0, g);
    const ring = mesh(new T.TorusGeometry(R + 1.6, 1.5, 10, 56), 0x2c3240, { edges: false, hull: true }); ring.rotation.y = Math.PI / 2; at(ring, x, yb, 0, g);
    const face = new T.Mesh(keep(new T.RingGeometry(R + 0.5, R + 3.4, 64)), keep(new T.MeshBasicMaterial({ map: scale, transparent: true })));
    face.rotation.y = Math.PI / 2; at(face, x + 1.55, yb, 0, g);
    const rot = new T.Group(); at(rot, x, yb, 0, g); rot.rotation.x = -th * RAD;
    const fm = new T.Mesh(keep(new T.CircleGeometry(R + 0.4, 48)), keep(new T.MeshBasicMaterial({ map: film, transparent: true, side: T.DoubleSide, depthWrite: false })));
    fm.rotation.y = Math.PI / 2; fm.renderOrder = 2; rot.add(fm);
    const rim = mesh(new T.TorusGeometry(R + 0.4, 0.45, 8, 48), o.fixed ? C.STEEL : C.BRASS, { edges: false }); rim.rotation.y = Math.PI / 2; rot.add(rim);
    at(box(0.12, 2 * R + 0.4, 0.34, ORANGE, { edges: false, shadow: false }), 0.3, 0, 0, rot);   // ось пропускания
    at(box(0.12, 2 * R + 0.4, 0.34, ORANGE, { edges: false, shadow: false }), -0.3, 0, 0, rot);
    at(cyl(0.45, 3.6, o.fixed ? C.STEEL : C.BRASS, { edges: false }), 1.8, R + 2, 0, rot);    // ручка-указатель на шкале
    const kb = mesh(new T.SphereGeometry(1.05, 16, 12), o.fixed ? 0x8a93a6 : ORANGE, { edges: false, hull: true }); at(kb, 1.8, R + 4.4, 0, rot);
    return g;
  }
  // вектор E: двойная стрелка вдоль оси th; у естественного света направление беспорядочно меняется
  function eArrow(kit, x, yb, th, amp, natural) {
    const { T, at, cyl, mesh } = kit;
    if (amp < 0.03) return;
    const g = new T.Group(); g.position.set(x, yb, 0); g.rotation.x = -th * RAD; kit.root.add(g);
    const a = new T.Group(); g.add(a);
    const L = 5.2;
    at(cyl(0.2, 2 * L - 1.6, EVEC, { edges: false, hull: false, shadow: false }), 0, 0, 0, a);
    [1, -1].forEach(sg => { const cn = mesh(new T.ConeGeometry(0.6, 1.4, 12), EVEC, { edges: false, shadow: false }); cn.rotation.x = sg > 0 ? 0 : Math.PI; at(cn, 0, sg * (L - 0.7), 0, a); });
    a.scale.y = amp;
    if (kit.reduce) return;
    if (natural) { let ph = x * 0.7, sp = 2.4; kit.onFrame((dt, t) => { g.rotation.x = ph + t * sp + 0.9 * Math.sin(t * 3.7 + x); a.scale.y = amp * (0.65 + 0.35 * Math.abs(Math.sin(t * 7))); }); }
    else kit.onFrame((dt, t) => { a.scale.y = amp * (0.25 + 0.75 * Math.abs(Math.sin(t * 6 + x * 0.3))); });
  }
  SC['wopt-polar'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, v3, C } = kit;
    felt(kit);
    const yb = Y0 + 15, x1 = -30, x2 = -10, x3 = 10, xd = 30;
    bench(kit, -60, 42, 0);
    const film = filmTex(kit), scale = scaleTex(kit);
    // лампа накаливания в кожухе с конденсором
    const lg = rider(kit, -51, 0, yb - 5);
    at(box(11, 8, 8, 0x2c3240), -51.5, yb, 0, lg);
    for (let i = 0; i < 3; i++) at(box(1.1, 1, 7, 0x3b4a66), -55 + i * 3, yb + 4.5, 0, lg);
    const cnd = cyl(3.4, 3, 0x3b4a66); cnd.rotation.z = Math.PI / 2; at(cnd, -44, yb, 0, lg);
    const lensM = cyl(2.8, 0.3, 0xfff4d6, { edges: false, matOpt: { emissive: 0xffe2a0, emissiveIntensity: 1 } }); lensM.rotation.z = Math.PI / 2; at(lensM, -42.4, yb, 0, lg);
    spot(kit, v3(-42, yb, 0), 1, 9, 0xffd890, { op: 0.75 });
    const pl = new T.PointLight(0xffd9a0, 30, 50, 1.3); pl.position.set(-40, yb, 0); kit.root.add(pl);
    // световой пучок: после каждого поляроида слабее (I = I₁ cos²φ)
    const B = (xa, xb, I, s0) => beam(kit, v3(xa, yb, 0), v3(xb, yb, 0), I, { col: WARM, hot: 0xffffff, r: 1.1, gr: 2.3, go: 0.2, pcol: 0xffe6a8, ps: 2.4, sp: 6, v: 16, s0 });
    let s = B(-42, x1 - 0.5, 1, 0);
    s += B(x1 + 0.5, (d.mid ? x2 : x3) - 0.5, d.I1 / 50, s);
    if (d.mid) s += B(x2 + 0.5, x3 - 0.5, d.I2 / 50, s);
    B(x3 + 0.5, xd - 2.2, d.I3 / 50, s);
    // поляроиды
    polaroid(kit, x1, 0, 'p1', film, scale, { yb, fixed: true });
    if (d.mid) polaroid(kit, x2, d.a2, 'p2', film, scale, { yb });
    else {
      const eg = rider(kit, x2, 0, yb - 10.4); clickable(eg, 'mid');      // пустой держатель
      at(box(2.4, 2, 2.4, C.DARK), x2, yb - 10.4, 0, eg);
      [-3, 3].forEach(z => at(box(1, 3, 1, C.DARK), x2, yb - 8.6, z, eg));
      // запасной поляроид лежит на столе перед скамьёй
      const sp = new T.Group(); at(sp, x2 + 2, Y0, 22); clickable(sp, 'mid');
      const r = mesh(new T.TorusGeometry(8.6, 1.5, 10, 56), 0x2c3240, { edges: false, hull: true }); r.rotation.x = Math.PI / 2; at(r, 0, 1.5, 0, sp);
      const fm = new T.Mesh(keep(new T.CircleGeometry(7.4, 48)), keep(new T.MeshBasicMaterial({ map: film, transparent: true, depthWrite: false }))); fm.rotation.x = -Math.PI / 2; fm.rotation.z = 0.5; at(fm, 0, 1.6, 0, sp);
      const ax = box(14.8, 0.1, 0.34, ORANGE, { edges: false, shadow: false }); ax.rotation.y = 0.5; at(ax, 0, 1.75, 0, sp);
      const kb = mesh(new T.SphereGeometry(1.05, 16, 12), ORANGE, { edges: false, hull: true }); at(kb, 11.4 * Math.cos(0.5), 1.5, -11.4 * Math.sin(0.5), sp);
    }
    polaroid(kit, x3, d.a3, 'p3', film, scale, { yb });
    // вектор E между приборами
    eArrow(kit, -37, yb, 0, 0.75, true);
    const amp = I => Math.sqrt(clamp(I / 50, 0, 1));
    if (d.mid) { eArrow(kit, (x1 + x2) / 2, yb, 0, amp(d.I1)); eArrow(kit, (x2 + x3) / 2, yb, d.a2, amp(d.I2)); }
    else eArrow(kit, (x1 + x3) / 2, yb, 0, amp(d.I1));
    eArrow(kit, (x3 + xd) / 2 - 1, yb, d.a3, amp(d.I3));
    // фотоэлемент на рейтере и люксметр
    const dg = rider(kit, xd, 0, yb - 3.4);
    at(box(3, 1.4, 4, C.DARK), xd, yb - 3.6, 0, dg);
    const cell = cyl(4.2, 4, 0x2c3240); cell.rotation.z = Math.PI / 2; at(cell, xd + 0.4, yb, 0, dg);
    const k3 = clamp(d.I3 / 50, 0, 1);
    const win = cyl(3.2, 0.3, 0x3a3020, { edges: false, matOpt: { emissive: 0xffe2a0, emissiveIntensity: 0.05 + 0.95 * k3 } }); win.rotation.z = Math.PI / 2; at(win, xd - 1.7, yb, 0, dg);
    spot(kit, v3(xd - 2, yb, 0), k3, 5 + 5 * k3, 0xffe2a0);
    const mX = 46, mZ = 22;
    kit.cable(v3(xd + 2.6, yb - 1, 0), v3(mX - 6, Y0 + 3.6, mZ - 3), 0x2c3240, 0, { r: 0.35, lift: 2, via: [v3(xd + 6, Y0 + 1, 8)] });
    const mg = new T.Group(); at(mg, mX, 0, mZ); mg.rotation.y = -0.25;
    at(box(17, 4, 11, 0xe8b23a), 0, Y0 + 2, 0, mg);
    at(box(16, 0.4, 10, 0x2c3240, { edges: false }), 0, Y0 + 4.2, 0, mg);
    const disp = new T.Mesh(keep(new T.PlaneGeometry(12, 4.4)), keep(new T.MeshBasicMaterial({ map: keep(kit.textTex(`${f(d.I3, 1)} %`, '#86e0a8', '#0d1a14', 320, 118)) })));
    disp.rotation.x = -Math.PI / 2; at(disp, 0, Y0 + 4.45, -1.6, mg);
    const bar = Math.max(0.2, 12 * clamp(d.I3 / 50, 0, 1));
    at(box(bar, 0.12, 1.3, 0xffe2a0, { edges: false, matOpt: { emissive: 0xffe2a0, emissiveIntensity: 0.6 } }), -6 + bar / 2, Y0 + 4.48, 2.7, mg);
    at(box(0.15, 0.14, 1.8, 0xe0473a, { edges: false }), -6 + 3, Y0 + 4.5, 2.7, mg);   // отметка 12,5 %
    // подписи
    tag(v3(x1 - 4, Y0 + 6, 14), 'Поляризатор', `ось 0° · ${f(d.I1, 1)} %`);
    if (d.mid) tag(v3(x2, yb + 13, 0), 'Средний', `ось ${d.a2}° · ${f(d.I2, 1)} %`);
    else tag(v3(x2 + 2, Y0 + 6, 22), 'Поляроид', 'вставить');
    tag(v3(x3, yb + 11, 0), 'Анализатор', `ось ${d.a3}°`);
    tag(v3(mX, Y0 + 8, mZ), 'Люксметр', `${f(d.I3, 1)} % от I₀`, d.done);
  };
})();
