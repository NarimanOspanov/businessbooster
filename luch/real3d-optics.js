// «Как в жизни» для оптики: «Отражение света» (labs/phys-reflect) и «Преломление света» (labs/phys-refract).
// Лазер на поворотном рычаге над плоским зеркалом и экран с мишенями; свеча перед стеклом и её изображение;
// человек перед зеркалом на стене; аквариум с монетками; оптическая шайба с полуцилиндром (замер n, полное отражение).
// Сцены строятся из window.LUCH_REAL() опыта; набор деталей kit — из /luch/real3d.js.
(() => {
  const SC = (window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {});
  const RAD = Math.PI / 180;
  const Y0 = 0.4; // верх тёмного сукна на столе
  const LASER = 0xff3b2a, YEL = 0xffd54a, GRN = 0x3fd28a, ORANGE = 0xffb547, PAPER = 0xf4efe2, GLASS = 0xcfe6f2;
  const MAT = { water: { name: 'Вода', col: 0x4aa3d9, op: 0.34 }, glass: { name: 'Стекло', col: 0xbfe3f2, op: 0.3 }, X: { name: 'Брусок X', col: 0x7f8ff5, op: 0.42 } };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const f = (x, d = 0) => String(Math.round(x * 10 ** d) / 10 ** d).replace('.', ',').replace('-', '−');
  const snell = (a, n1, n2) => { const s = n1 / n2 * Math.sin(a * RAD); return s > 1 ? NaN : Math.asin(s) / RAD; };
  function fres(a, n1, n2) {
    const si = Math.sin(a * RAD), st = n1 / n2 * si; if (st >= 1) return 1;
    const ci = Math.cos(a * RAD), ct = Math.sqrt(1 - st * st);
    const rs = ((n1 * ci - n2 * ct) / (n1 * ci + n2 * ct)) ** 2, rp = ((n1 * ct - n2 * ci) / (n1 * ct + n2 * ci)) ** 2;
    return (rs + rp) / 2;
  }

  // ---------- текстуры (общие, живут всю сессию) ----------
  const texC = {};
  // градусная шкала оптической шайбы: 0° — вдоль нормали (верх и низ), 90° — вдоль границы
  function scaleTex(T, kind) {
    if (texC[kind]) return texC[kind];
    const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d');
    const clear = kind === 'clear', R = 500, ink = clear ? '#f4efe2' : '#1b1610';
    x.translate(512, 512);
    x.fillStyle = clear ? 'rgba(220,235,250,.13)' : '#f4efe2'; x.beginPath(); x.arc(0, 0, R, 0, 7); x.fill();
    if (!clear) { // четверти шайбы чуть разного тона, как на настоящей
      x.fillStyle = 'rgba(114,160,210,.12)'; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, R - 70, Math.PI, 1.5 * Math.PI); x.closePath(); x.fill();
      x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, R - 70, 0, 0.5 * Math.PI); x.closePath(); x.fill();
    }
    x.strokeStyle = ink; x.lineWidth = 6; x.beginPath(); x.arc(0, 0, R - 3, 0, 7); x.stroke();
    x.lineWidth = 2; x.beginPath(); x.arc(0, 0, R - 70, 0, 7); x.stroke();
    x.lineCap = 'round';
    for (let t = 0; t < 360; t++) {
      if (clear && t % 5) continue;
      const l = t % 10 === 0 ? 40 : t % 5 === 0 ? 26 : 13, a = t * RAD;
      x.lineWidth = t % 10 === 0 ? 4 : 2.2;
      x.beginPath(); x.moveTo(Math.sin(a) * (R - 6), -Math.cos(a) * (R - 6)); x.lineTo(Math.sin(a) * (R - 6 - l), -Math.cos(a) * (R - 6 - l)); x.stroke();
    }
    x.fillStyle = ink; x.font = '700 30px "Golos Text", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let t = 0; t < 360; t += 10) {
      const u = t % 180, lab = Math.min(u, 180 - u), a = t * RAD;
      x.save(); x.translate(Math.sin(a) * (R - 92), -Math.cos(a) * (R - 92)); x.rotate(a); x.fillText(String(lab), 0, 0); x.restore();
    }
    x.strokeStyle = clear ? 'rgba(244,239,226,.5)' : 'rgba(27,22,16,.35)'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(-R + 70, 0); x.lineTo(R - 70, 0); x.stroke();
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; texC[kind] = t; return t;
  }
  // надпись на прозрачном фоне (буквы α, β, γ, цифры линейки)
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

  // ---------- общие детали ----------
  // тёмное сукно на столе: на нём лучи видно лучше
  function felt(kit) { kit.at(kit.box(126, Y0, 90, 0x2a2f3a, { edges: false }), 0, Y0 / 2, 3); }
  // сцена на сукне, сдвинутая на off (подальше от рамки задания): свой kit, у которого root — сдвинутая группа
  const onFelt = (off, fn) => (kit, d) => {
    felt(kit);
    const G = new kit.T.Group(); G.position.set(off[0], off[1], off[2]); kit.root.add(G);
    const O = new kit.T.Vector3(off[0], off[1], off[2]);
    const k2 = Object.create(kit);
    Object.defineProperty(k2, 'root', { get: () => G });
    k2.at = (o, x, y, z, p) => kit.at(o, x, y, z, p || G);
    k2.tag = (p, ...r) => kit.tag(p.clone().add(O), ...r);
    fn(k2, d);
  };
  // цилиндр-стержень между двумя точками
  function rod(kit, a, b, r, col, o = {}) {
    const { T, cyl } = kit; const d = b.clone().sub(a), L = d.length();
    const m = cyl(r, L, col, { edges: false, hull: r >= 0.5, ...o });
    m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
    kit.root.add(m); return m;
  }
  // штриховая линия (нормаль, продолжения лучей)
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
    const base = o.col ?? LASER, kk = clamp(k, 0, 1);
    const coreCol = new T.Color(base).lerp(new T.Color(o.hot ?? 0xffd2c8), 0.55 * kk);
    const r = o.r || 0.24, gr = o.gr || 0.95;
    const core = new T.Mesh(keep(new T.CylinderGeometry(r, r, L, 8, 1, true)), keep(new T.MeshBasicMaterial({ color: coreCol, transparent: true, opacity: 0.35 + 0.65 * kk, depthWrite: false })));
    const glow = new T.Mesh(keep(new T.CylinderGeometry(gr, gr, L, 12, 1, true)), keep(new T.MeshBasicMaterial({ color: base, transparent: true, opacity: 0.3 * kk, blending: T.AdditiveBlending, depthWrite: false })));
    [core, glow].forEach(m => { m.quaternion.copy(q); m.position.copy(mid); m.renderOrder = 3; kit.root.add(m); });
    if (!kit.reduce && kk > 0.1 && o.photons !== false) {
      const SP = o.sp || 7, V = o.v || 24, s0 = o.s0 || 0, n = Math.ceil(L / SP) + 1, sps = [];
      const pm = keep(new T.SpriteMaterial({ map: kit.glowTex(), color: o.pcol ?? 0xff6a50, transparent: true, opacity: 0.95 * kk, blending: T.AdditiveBlending, depthWrite: false }));
      for (let i = 0; i < n; i++) { const s = new T.Sprite(pm); s.scale.setScalar((o.ps || 2.2) * (0.6 + 0.4 * kk)); s.renderOrder = 4; kit.root.add(s); sps.push(s); }
      const place = t => { const ph = ((t * V - s0) % SP + SP) % SP; sps.forEach((s, i) => { const u = ph + i * SP; s.visible = u < L; if (s.visible) s.position.copy(a).addScaledVector(dn, u); }); };
      place(0); kit.onFrame((dt, t) => place(t));
    }
    return L;
  }
  // путь луча из нескольких отрезков: огоньки бегут непрерывно через изломы
  function beamPath(kit, pts, k, o = {}) {
    let s = o.s0 || 0;
    for (let i = 0; i + 1 < pts.length; i++) s += beam(kit, pts[i], pts[i + 1], k, { ...o, s0: s });
    return s;
  }
  // светящееся пятно (где луч упирается в экран, дно, край шайбы)
  function spot(kit, p, k, size = 5, col = 0xff5a40, pulse) {
    const { T, keep } = kit;
    if (k < 0.04) return null;
    const s = new T.Sprite(keep(new T.SpriteMaterial({ map: kit.glowTex(), color: col, transparent: true, opacity: clamp(0.4 + 0.6 * k, 0, 1), blending: T.AdditiveBlending, depthWrite: false })));
    s.scale.setScalar(size); s.position.copy(p); s.renderOrder = 5; kit.root.add(s);
    if (pulse && !kit.reduce) kit.onFrame((dt, t) => s.scale.setScalar(size * (1 + 0.08 * Math.sin(t * 9) + 0.05 * Math.sin(t * 23))));
    return s;
  }
  // дуга угла: плоское кольцо; plane 'xy' — вертикально (лицом к +z), 'xz' — на столе. Угол θ — от +x против часовой (в xz: к −z)
  function arc(kit, c, r, th0, thL, col, plane) {
    const { T, keep } = kit;
    if (Math.abs(thL) < 0.05) return;
    const m = new T.Mesh(keep(new T.RingGeometry(r - 0.32, r + 0.32, 40, 1, th0, thL)), keep(new T.MeshBasicMaterial({ color: col, side: T.DoubleSide, transparent: true, depthWrite: false })));
    if (plane === 'xz') m.rotation.x = -Math.PI / 2;
    m.position.copy(c); m.renderOrder = 2; kit.root.add(m);
  }
  function arcLabel(kit, c, r, th, txt, col, plane) {
    const m = flatLabel(kit, txt, col, 3.4, 3.4, plane === 'xz');
    if (plane === 'xz') m.position.set(c.x + r * Math.cos(th), c.y + 0.02, c.z - r * Math.sin(th));
    else m.position.set(c.x + r * Math.cos(th), c.y + r * Math.sin(th), c.z + 0.02);
    m.renderOrder = 3; kit.root.add(m);
  }
  // лазерная указка: кончик в tip, светит по dir
  function laserPen(kit, tip, dir, key) {
    const { T, at, cyl, box, clickable, C } = kit;
    const g = new T.Group(); g.position.copy(tip);
    g.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.clone().normalize().negate());
    at(cyl(1.25, 0.9, C.BRASS), 0, 0.45, 0, g);
    at(cyl(1.12, 9.6, 0x2c3240), 0, 5.7, 0, g);
    at(cyl(1.2, 0.5, 0x9aa3b2, { edges: false }), 0, 3, 0, g);
    at(cyl(1.25, 0.9, C.STEEL), 0, 10.9, 0, g);
    at(box(0.9, 1.6, 0.7, 0xe0473a), 0, 6.6, 1.1, g);
    at(cyl(0.55, 0.12, 0xff7a60, { edges: false, hull: false, matOpt: { emissive: 0xff3b2a, emissiveIntensity: 1 } }), 0, -0.02, 0, g);
    kit.root.add(g); clickable(g, key);
    spot(kit, tip.clone(), 1, 3.2, 0xff4a30, true);
    return g;
  }
  // оптическая шайба на столе: диск со шкалой на ножке, центр O; вернёт высоту верха
  function disc(kit, cx, cz, R, key) {
    const { T, at, cyl, keep, clickable, C } = kit;
    const g = new T.Group(); at(g, cx, 0, cz);
    at(cyl(7, 1, C.DARK), 0, Y0 + 0.5, 0, g);
    at(cyl(R + 0.4, 1.2, PAPER, { seg: 72 }), 0, Y0 + 1.6, 0, g);
    const face = new T.Mesh(keep(new T.CircleGeometry(R, 72)), keep(new T.MeshBasicMaterial({ map: scaleTex(T, 'disc') })));
    face.rotation.x = -Math.PI / 2; at(face, 0, Y0 + 2.22, 0, g);
    clickable(g, key);
    return Y0 + 2.22;
  }
  // полуцилиндр: плоская грань по оси x через O, круглая — к +z
  function semi(kit, O, r, h, mat, key) {
    const { T, mesh, clickable } = kit;
    const sh = new T.Shape(); sh.moveTo(-r, 0); sh.absarc(0, 0, r, Math.PI, 2 * Math.PI, false); sh.closePath();
    const geo = new T.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 48 });
    const M = MAT[mat];
    const m = mesh(geo, M.col, { matOpt: { transparent: true, opacity: M.op, depthWrite: false }, edgeAngle: 40, shadow: false });
    m.rotation.x = -Math.PI / 2; m.position.set(O.x, O.y, O.z); m.renderOrder = 1;
    kit.root.add(m); clickable(m, key);
    return m;
  }

  // =====================================================================================
  // 1. Закон отражения: зеркало на столе, шайба-транспортир, лазер на поворотном рычаге, экран с мишенями
  SC['optics-mirror'] = onFelt([8, 0, 8], (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, v3, C } = kit;
    const k = 1.8, ox = -14, yM = Y0 + 1.7, a = d.a, ar = a * RAD, R = 17 * k, wx = ox + 21 * k, wH = 21 * k;
    const O = v3(ox, yM, 0);
    // доска, зеркало (сверху стекло, снизу тёмная задняя сторона), паз для шайбы
    at(box(58, 1.2, 14, C.WOOD2), ox, Y0 + 0.6, 2.2);
    const mir = at(box(54, 0.5, 10, 0xd6ecfa, { matOpt: { emissive: 0x9fc6e0, emissiveIntensity: 0.25 } }), ox, Y0 + 1.45, 3.6); clickable(mir, 'a0');
    at(box(54, 0.12, 0.2, 0xffffff, { edges: false, shadow: false, matOpt: { transparent: true, opacity: 0.6 } }), ox, yM + 0.02, 7.6);
    at(box(52, 0.8, 2, C.DARK), ox, Y0 + 1.6, -2.6);
    // шайба-транспортир стоит в пазу за лучом
    const pr = 14 * k;
    const hs = new T.Shape(); hs.moveTo(-pr, 0); hs.absarc(0, 0, pr, 0, Math.PI, false); hs.closePath();
    const hd = mesh(new T.ExtrudeGeometry(hs, { depth: 0.6, bevelEnabled: false, curveSegments: 40 }), PAPER, { edgeAngle: 40 });
    at(hd, ox, yM, -2.9); clickable(hd, 'a1');
    if (d.prot) { const fc = new T.Mesh(keep(new T.CircleGeometry(pr - 0.2, 64, 0, Math.PI)), keep(new T.MeshBasicMaterial({ map: scaleTex(T, 'disc') }))); at(fc, ox, yM + 0.01, -2.28); }
    // рычаг с лазером: ось в центре шайбы (сзади), рычаг, скоба к указке
    const zA = -3.7, L2 = R + 5.5, A = v3(ox - L2 * Math.sin(ar), yM + L2 * Math.cos(ar), zA);
    const hub = cyl(1.6, 1.2, C.BRASS); hub.rotation.x = Math.PI / 2; at(hub, ox, yM, zA);
    rod(kit, v3(ox, yM, zA), A, 0.55, C.STEEL);
    rod(kit, A, v3(A.x, A.y, 0), 0.42, C.STEEL);
    const dir = v3(Math.sin(ar), -Math.cos(ar), 0), tip = v3(ox - R * Math.sin(ar), yM + R * Math.cos(ar), 0);
    laserPen(kit, tip, dir, 'a5');
    // нормаль и дуги углов на шайбе
    dashed(kit, v3(ox, yM, -2.2), v3(ox, yM + pr - 1, -2.2), 0x2c3240, { r: 0.16, op: 0.9 });
    if (a >= 4) {
      const c = v3(ox, yM, -2.2);
      arc(kit, c, 8.5, Math.PI / 2, ar, 0xe6a817, 'xy'); arc(kit, c, 10.5, Math.PI / 2 - ar, ar, 0x2f9e5a, 'xy');
      arcLabel(kit, c, 13, Math.PI / 2 + ar / 2, 'α', '#c48a00', 'xy'); arcLabel(kit, c, 13.5, Math.PI / 2 - ar / 2, 'β', '#23804a', 'xy');
    }
    // экран: полупрозрачная калька в рамке, мишени видны с обеих сторон
    const sg = new T.Group(); at(sg, wx, 0, 0);
    [-9, 9].forEach(z => { at(box(1.4, wH + 3, 1.4, C.WOOD), 0, Y0 + (wH + 3) / 2, z, sg); at(box(7, 1, 3, C.WOOD2), 0, Y0 + 0.5, z, sg); });
    at(box(1.4, 1.4, 19.4, C.WOOD), 0, Y0 + wH + 3.6, 0, sg);
    at(box(0.4, wH, 16.6, PAPER, { edges: false, matOpt: { transparent: true, opacity: 0.72, depthWrite: false } }), 0, yM + wH / 2, 0, sg);
    const TG = [50, 62, 74];
    TG.forEach((ta, i) => {
      const done = i < d.ti, cur = i === d.ti; if (!done && !cur) return;
      const y = yM + 21 / Math.tan(ta * RAD) * k, col = done ? 0x3fae5a : 0xff8a1e;
      const tg = new T.Group(); at(tg, wx, y, 0);
      [-0.32, 0.32].forEach(s => {
        const rg = mesh(new T.TorusGeometry(1.7, 0.28, 8, 32), col, { edges: false }); rg.rotation.y = Math.PI / 2; at(rg, s, 0, 0, tg);
        const dt = mesh(new T.CircleGeometry(0.6, 20), col, { edges: false, shadow: false }); dt.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2; at(dt, s * 1.05, 0, 0, tg);
      });
      if (cur && !kit.reduce) kit.onFrame((dt, t) => tg.scale.setScalar(1 + 0.12 * Math.sin(t * 4)));
    });
    // лучи: падающий и отражённый (β = α), пятно на экране
    const pts = [tip, O];
    let hitTxt = 'луч уходит вверх';
    if (a === 0) { pts.push(tip.clone()); hitTxt = 'луч вернулся в лазер'; }
    else {
      const hW = 21 / Math.tan(ar);
      if (hW <= 21) { const P = v3(wx - 0.3, yM + hW * k, 0); pts.push(P); spot(kit, P, 1, 4.5, 0xff5a40, true); spot(kit, P.clone().setX(wx + 0.3), 0.8, 4, 0xff5a40); hitTxt = 'луч на ' + f(hW, 1) + ' см'; }
      else pts.push(O.clone().add(v3(Math.sin(ar), Math.cos(ar), 0).multiplyScalar(56)));
    }
    beamPath(kit, pts, 1);
    spot(kit, O.clone().setY(yM + 0.2), 1, 3.6, 0xff6a50);
    const lt = tip.clone().addScaledVector(dir, -6);
    tag(v3(lt.x, lt.y + 4, 0), 'Лазер', `α = ${a}°`);
    tag(v3(ox - 18, yM + 1, 6), 'Зеркало', `β = ${a}°`);
    tag(v3(wx, Y0 + wH + 6, 0), 'Экран', d.ti >= 3 ? 'все 3 мишени ✓' : `мишени ${d.ti}/3 · ${hitTxt}`, d.ti >= 3);
  });

  // =====================================================================================
  // 2. Изображение в зеркале: свеча перед стеклом, вторая свеча за стеклом, изображение, глаз на штативе
  function candle(kit, x, z, o) {
    const { T, at, cyl, mesh, keep, C } = kit;
    const k = 2, g = new T.Group(); at(g, x, 0, z);
    const ghost = !!o.ghost;
    if (!ghost) { at(cyl(1.7, 0.45, C.BRASS), 0, Y0 + 0.22, 0, g); at(cyl(2.1, 0.3, C.BRASS, { edges: false }), 0, Y0 + 0.15, 0, g); }
    const wax = ghost ? cyl(1.45, 6 * k, 0xf1e6cf, { edges: false, hull: false, shadow: false, matOpt: { transparent: true, opacity: 0.2, depthWrite: false } }) : cyl(1.45, 6 * k, 0xf1e6cf);
    at(wax, 0, Y0 + 3 * k, 0, g);
    if (ghost) { const r = mesh(new T.TorusGeometry(1.45, 0.08, 6, 32), 0xf1e6cf, { edges: false, matOpt: { transparent: true, opacity: 0.6 } }); r.rotation.x = Math.PI / 2; at(r, 0, Y0 + 6 * k, 0, g); }
    at(cyl(0.12, 0.9, 0x2b2f3a, { edges: false, hull: false, ...(ghost ? { matOpt: { transparent: true, opacity: 0.4 } } : {}) }), 0, Y0 + 6 * k + 0.4, 0, g);
    if (o.lit) {
      const fl = new T.Group(); at(fl, 0, Y0 + 6 * k + 0.6, 0, g);
      const outer = new T.Mesh(keep(new T.SphereGeometry(0.75, 16, 12)), keep(new T.MeshBasicMaterial({ color: 0xffb02e, transparent: true, opacity: ghost ? 0.6 : 1 })));
      outer.scale.set(1, 2.1, 1); outer.position.y = 1.3; fl.add(outer);
      const inner = new T.Mesh(keep(new T.SphereGeometry(0.42, 12, 10)), keep(new T.MeshBasicMaterial({ color: 0xfff4c2, transparent: true, opacity: ghost ? 0.6 : 1 })));
      inner.scale.set(1, 1.8, 1); inner.position.y = 1; fl.add(inner);
      const halo = new T.Sprite(keep(new T.SpriteMaterial({ map: kit.glowTex(), color: 0xffc860, transparent: true, opacity: ghost ? 0.45 : 0.85, blending: T.AdditiveBlending, depthWrite: false })));
      halo.scale.setScalar(o.big ? 13 : 9); halo.position.y = 1.4; fl.add(halo);
      if (!ghost) { const L = new T.PointLight(0xffb050, 18, 34, 1.4); L.position.y = 2; fl.add(L); }
      if (!kit.reduce) { const ph = x * 0.37; kit.onFrame((dt, t) => { const s = 1 + 0.07 * Math.sin(t * 11 + ph) + 0.05 * Math.sin(t * 17.3 + ph); fl.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s)); fl.rotation.z = 0.05 * Math.sin(t * 5.1 + ph); }); }
    }
    return g;
  }
  SC['optics-candle'] = onFelt([14, 0, 20], (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, v3, C } = kit;
    const k = 2, x1 = -d.d * k, x2 = d.x2 * k, xi = d.d * k, flY = Y0 + 7 * k, pH = 18 * k;
    // линейка на столе: сантиметры от стекла в обе стороны
    at(box(92, 0.3, 4.4, 0xf1e3c2), 0, Y0 + 0.15, 8);
    for (let c = -22; c <= 22; c++) at(box(0.18, 0.06, c % 5 ? 1 : 1.9, 0x3a2e22, { edges: false, shadow: false }), c * k, Y0 + 0.33, 6.3 + (c % 5 ? 0.5 : 0.95));
    for (let c = -20; c <= 20; c += 5) { if (!c) continue; const lb = flatLabel(kit, String(Math.abs(c)), '#3a2e22', 2.4, 1.6, true); at(lb, c * k, Y0 + 0.34, 8.9); }
    // стеклянная пластина в зажимах на подставке
    at(box(6, 1, 32, C.DARK), 0, Y0 + 0.5, 0);
    [-13.5, 13.5].forEach(z => { at(box(3, 3.4, 2.4, 0x3b4a66), -1.5, Y0 + 2.7, z); at(box(3, 3.4, 2.4, 0x3b4a66), 1.5, Y0 + 2.7, z); });
    const plate = at(box(0.5, pH, 28, GLASS, { matOpt: { transparent: true, opacity: 0.26, depthWrite: false }, shadow: false }), 0, Y0 + 1 + pH / 2, 0); plate.renderOrder = 1; clickable(plate, 'rays');
    at(box(0.1, pH - 2, 0.6, 0xffffff, { edges: false, shadow: false, matOpt: { transparent: true, opacity: 0.45 } }), 0.3, Y0 + 1 + pH / 2, -9);
    // свечи и изображение
    const c1 = candle(kit, x1, 0, { lit: true }); clickable(c1, 'c1');
    const c2 = candle(kit, x2, 0, { lit: d.on, big: d.on }); clickable(c2, 'c2');
    candle(kit, xi, 0, { lit: true, ghost: true });
    // глаз на штативе (смотрит на стекло)
    const ex = (d.ex - 260) / 10 * k, ey = Y0 + (380 - d.ey) / 10 * k;
    const eg = new T.Group(); at(eg, ex, 0, 0); clickable(eg, 'eye');
    at(cyl(3, 0.8, C.DARK), 0, Y0 + 0.4, -7, eg);
    at(cyl(0.5, ey - Y0 - 0.8, C.STEEL, { edges: false }), 0, Y0 + 0.8 + (ey - Y0 - 0.8) / 2, -7, eg);
    const arm = cyl(0.4, 5.2, C.STEEL, { edges: false, hull: false }); arm.rotation.x = Math.PI / 2; at(arm, 0, ey, -4.6, eg);
    at(box(1.6, 1.6, 1.6, C.DARK), 0, ey, -7, eg);
    const ball = mesh(new T.SphereGeometry(2.2, 28, 20), 0xf7f3ea, { hull: true, edges: false }); at(ball, 0, ey, 0, eg);
    const iris = new T.Mesh(keep(new T.CircleGeometry(1.05, 28)), keep(new T.MeshBasicMaterial({ color: 0x5f7d92 }))); iris.rotation.y = Math.PI / 2; at(iris, 2.12, ey, 0, eg);
    const pup = new T.Mesh(keep(new T.CircleGeometry(0.5, 20)), keep(new T.MeshBasicMaterial({ color: 0x0b0e14 }))); pup.rotation.y = Math.PI / 2; at(pup, 2.15, ey, 0, eg);
    // лучи от пламени, отражённые стеклом в глаз; пунктир — их продолжения к изображению
    const P = v3(x1, flY, 0), Pi = v3(xi, flY, 0);
    let sees = false;
    if (d.rays) {
      [-0.9, 0.9].forEach((o, i) => {
        const E = v3(ex + 2, ey + o, 0), t = (0 - E.x) / (Pi.x - E.x), My = E.y + t * (Pi.y - E.y), M = v3(0, My, 0);
        const ok = My >= Y0 && My <= Y0 + pH; sees = sees || ok;
        if (!ok) { dashed(kit, P, M, 0xff8a73, { op: 0.5 }); return; }
        beamPath(kit, [P, M, E], 0.85, { col: 0xffc23a, hot: 0xfff4c2, r: 0.14, gr: 0.5, pcol: 0xffd54a, ps: 1.6, sp: 9, v: 14, s0: i * 4 });
        dashed(kit, M, Pi, YEL, { op: 0.75, r: 0.11 });
      });
    } else sees = true;
    tag(v3(x1, Y0 + 22, 0), 'Свеча', 'd = ' + f(d.d, 1) + ' см');
    if (!d.on) tag(v3(xi, Y0 + 32, 0), 'Изображение', 'f = ' + f(d.d, 1) + ' см');
    tag(v3(x2, Y0 + 22, 0), 'Вторая свеча', d.on ? '«горит»!' : f(d.x2, 1) + ' см', d.on);
    tag(v3(0, Y0 + pH + 4, 0), 'Стекло', `опытов ${d.n}/2`, d.n >= 2);
    tag(v3(ex, ey + 5, 0), 'Глаз', d.rays ? (sees ? 'видит' : 'лучи мимо') : 'лучи скрыты');
  });

  // =====================================================================================
  // 3. Зеркало в полный рост: модель комнаты — пол, стена с зеркалом, человек, изображение за стеной
  function figure(kit, H, face, ghost) {
    const { T, at, box, cyl, mesh } = kit;
    const g = new T.Group();
    const hip = 0.5 * H, sh = H - 25, hr = 10.5;
    const parts = [];
    const P = (obj, x, y, z, y0, y1, col) => { parts.push({ obj, y0, y1 }); at(obj, x, y, z, g); return obj; };
    const o = (col, y0, y1) => {
      if (!ghost) return [col, {}];
      const ov = (Math.min(y1, ghost.hi) - Math.max(y0, ghost.lo)) / (y1 - y0);
      return [col, { edges: false, hull: false, shadow: false, matOpt: { transparent: true, opacity: ov > 0.45 ? 0.72 : 0.13, depthWrite: false } }];
    };
    const B = (w, h, dd, col, x, y, z, y0, y1) => { const [c, op] = o(col, y0, y1); return P(box(w, h, dd, c, op), x, y, z, y0, y1); };
    const Cy = (r, h, col, x, y, z, y0, y1) => { const [c, op] = o(col, y0, y1); return P(cyl(r, h, c, op), x, y, z, y0, y1); };
    [-9, 9].forEach(z => {
      B(25, 8, 11, 0x2c3240, face * 4, 4, z, 0, 8);
      const kn = 8 + (hip - 8) / 2;
      Cy(6, kn - 8, 0x3b4a66, 0, (8 + kn) / 2, z, 8, kn); Cy(6.5, hip - kn, 0x3b4a66, 0, (kn + hip) / 2, z, kn, hip);
    });
    B(21, sh - hip + 4, 38, 0x2f6fd8, 0, hip + (sh - hip + 4) / 2 - 2, 0, hip - 2, sh + 2);
    const el = (hip - 4 + sh) / 2;
    [-23, 23].forEach(z => { Cy(4.6, el - hip + 4, 0x2f6fd8, 0, (hip - 4 + el) / 2, z, hip - 4, el); Cy(5, sh - el, 0x2f6fd8, 0, (el + sh) / 2, z, el, sh); });
    [-23, 23].forEach(z => { const [c, op] = o(0xf2c9a0, hip - 12, hip - 4); P(mesh(new T.SphereGeometry(5, 16, 12), c, { hull: !ghost, edges: false, ...op }), 0, hip - 8, z, hip - 12, hip - 4); });
    Cy(5, 6, 0xf2c9a0, 0, sh + 3, 0, sh, sh + 6);
    { const [c, op] = o(0xf2c9a0, H - 2 * hr, H); P(mesh(new T.SphereGeometry(hr, 28, 20), c, { hull: !ghost, edges: false, ...op }), 0, H - hr, 0, H - 2 * hr, H); }
    { const [c, op] = o(0x3a2a1c, H - 9, H); P(mesh(new T.SphereGeometry(hr + 0.6, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), c, { edges: false, ...op }), -face * 0.8, H - hr, 0, H - 9, H); }
    [-4, 4].forEach(z => { const [c, op] = o(0x1b1610, H - 13, H - 11); P(mesh(new T.SphereGeometry(1.5, 10, 8), c, { edges: false, ...op }), face * 9.6, H - 12, z, H - 13, H - 11); });
    return g;
  }
  SC['optics-fullmirror'] = onFelt([12, 0, 12], (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, v3, C } = kit;
    const k = 0.21, zc = 8, wX = -14, yF = Y0 + 1, H = d.H, e = H - 12;
    const px = wX + d.dist * k, xi = wX - d.dist * k, xe = px - 5 * k;
    const Yc = cm => yF + cm * k;
    // пол комнаты: перед стеной — паркет, за стеной — «зазеркалье»
    at(box(42, 1, 30, 0xd9b27c), wX + 21, Y0 + 0.5, zc);
    at(box(30, 1, 30, 0x8fa3c0, { matOpt: { transparent: true, opacity: 0.55, depthWrite: false } }), wX - 15, Y0 + 0.5, zc);
    for (let i = 1; i < 7; i++) at(box(0.15, 0.05, 30, 0xb98e58, { edges: false, shadow: false }), wX + i * 6, yF + 0.03, zc);
    // стена (полупрозрачная, чтобы видеть изображение за ней)
    const wall = at(box(1.2, 220 * k, 30, 0xdfe7ef, { matOpt: { transparent: true, opacity: 0.32, depthWrite: false }, shadow: false }), wX - 0.6, yF + 110 * k, zc); wall.renderOrder = 1;
    at(box(1.8, 1.2, 30, 0xf4efe2), wX - 0.6, yF + 220 * k, zc);
    at(box(1.6, 1.4, 30, 0xf4efe2), wX - 0.6, yF + 0.7, zc);
    // зеркало на стене, ручки краёв
    const mL = (d.top - d.bot) * k;
    if (mL > 0.05) at(box(0.6, mL, 15, 0xd6ecfa, { matOpt: { emissive: 0x9fc6e0, emissiveIntensity: 0.35 } }), wX + 0.3, Yc((d.top + d.bot) / 2), zc);
    at(box(0.12, Math.max(0.1, mL - 1), 0.5, 0xffffff, { edges: false, shadow: false, matOpt: { transparent: true, opacity: 0.6 } }), wX + 0.66, Yc((d.top + d.bot) / 2), zc - 3);
    const hTop = at(box(1.6, 1.5, 6, ORANGE), wX + 1, Yc(d.top), zc); clickable(hTop, 'mtop');
    const hBot = at(box(1.6, 1.5, 6, ORANGE), wX + 1, Yc(d.bot), zc); clickable(hBot, 'mbot');
    // человек (смотрит в зеркало) и его изображение: ярко — то, что он видит
    const man = figure(kit, H, -1, null); man.scale.setScalar(k); at(man, px, yF, zc); clickable(man, 'person');
    const img = figure(kit, H, 1, { lo: d.lo, hi: d.hi }); img.scale.setScalar(k); at(img, xi, yF, zc);
    if (d.hi > d.lo) at(box(0.7, (d.hi - d.lo) * k, 0.7, GRN, { edges: false, matOpt: { emissive: GRN, emissiveIntensity: 0.6 } }), xi - 4.5, Yc((d.hi + d.lo) / 2), zc + 6);
    // лучи от макушки и от ступней: отразились в глаз (зелёные) или прошли мимо зеркала (красный пунктир)
    const zr = zc + 6, E = v3(xe - 0.6, Yc(e), zr);
    [[H, 0], [0, 6]].forEach(([cm, s0]) => {
      const m = (cm + e) / 2, ok = m >= d.bot && m <= d.top, P = v3(xe, Yc(cm) + (cm ? 0.2 : 0.15), zr), M = v3(wX + 0.65, Yc(m), zr);
      if (ok) {
        beamPath(kit, [P, M, E], 0.9, { col: GRN, hot: 0xd8ffe8, r: 0.15, gr: 0.5, pcol: 0x9dffc8, ps: 1.4, sp: 6, v: 10, s0 });
        dashed(kit, M, v3(2 * wX - xe, Yc(cm), zr), GRN, { op: 0.55, r: 0.1 });
      } else { beam(kit, P, M, 0.75, { col: 0xff5a45, r: 0.15, gr: 0.5, photons: false }); spot(kit, M, 0.8, 2.6, 0xff5a40); }
    });
    // рулетка на полу от стены до человека
    at(box(d.dist * k, 0.12, 1.6, 0xf2c94c, { edges: false }), wX + d.dist * k / 2, yF + 0.07, zc + 11);
    for (let c = 10; c < d.dist; c += 10) at(box(0.12, 0.05, 0.9, 0x3a2e22, { edges: false, shadow: false }), wX + c * k, yF + 0.15, zc + 10.8);
    at(box(1.8, 1.4, 2.4, 0xe0473a), px + 0.9, yF + 0.7, zc + 11);
    tag(v3(px, Yc(H) + 3, zc), 'Человек', `рост ${H} см`);
    tag(v3(wX - 0.6, Yc(220) + 1.5, zc - 13), 'Зеркало', `верх ${d.top} · низ ${d.bot}`, d.ok);
    tag(v3(xi, Yc(H) + 3, zc), 'Изображение', d.full ? 'видно целиком' : `видно ${Math.max(0, d.hi - d.lo)} из ${H} см`, d.full);
    tag(v3(wX + d.dist * k / 2, yF + 2, zc + 12), 'До зеркала', d.dist + ' см');
  });

  // =====================================================================================
  // 4. Закон преломления: аквариум с водой, монетки на дне, лазер на рычаге, прозрачный транспортир на стекле
  SC['optics-tank'] = onFelt([8, 0, 12], (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, v3, C } = kit;
    const k = 1.8, n = 1.33, ox = -12, yb = Y0 + 1, ys = yb + 10 * k, zb = 8.5, a = d.a, ar = a * RAD;
    const x0 = ox - 17 * k, x1 = ox + 31 * k, zi = 11, yt = ys + 2.2, R = 14.5 * k;
    const g = snell(a, 1, n), gr = g * RAD, Rf = fres(a, 1, n);
    // аквариум: дно, стёкла, уголки, вода
    at(box(x1 - x0 + 1.6, 1, 2 * zi + 1.6, 0x5d6a86), (x0 + x1) / 2, Y0 + 0.5, 0);
    const gl = { matOpt: { transparent: true, opacity: 0.2, depthWrite: false }, shadow: false };
    const walls = [[x1 - x0 + 1.2, 2 * zi, 0, -zi - 0.3], [x1 - x0 + 1.2, 2 * zi, 0, zi + 0.3]];
    walls.forEach(([w, , , z]) => { const m = at(box(w, yt - yb, 0.6, GLASS, gl), (x0 + x1) / 2, (yb + yt) / 2, z); m.renderOrder = 1; });
    [x0 - 0.3, x1 + 0.3].forEach(x => { const m = at(box(0.6, yt - yb, 2 * zi, GLASS, gl), x, (yb + yt) / 2, 0); m.renderOrder = 1; });
    [[x0 - 0.3, -zi - 0.3], [x0 - 0.3, zi + 0.3], [x1 + 0.3, -zi - 0.3], [x1 + 0.3, zi + 0.3]].forEach(([x, z]) => at(box(1, yt - Y0, 1, 0x5d6a86), x, (Y0 + yt) / 2, z));
    [-zi - 0.3, zi + 0.3].forEach(z => at(box(x1 - x0 + 1.6, 0.6, 1, 0x5d6a86), (x0 + x1) / 2, yt, z));
    const water = at(box(x1 - x0, ys - yb, 2 * zi, 0x3d9ad6, { edges: false, shadow: false, matOpt: { transparent: true, opacity: 0.26, depthWrite: false } }), (x0 + x1) / 2, (yb + ys) / 2, 0);
    water.renderOrder = 1; clickable(water, 'a1');
    const surf = new T.Mesh(keep(new T.PlaneGeometry(x1 - x0, 2 * zi)), keep(new T.MeshBasicMaterial({ color: 0x9fd8f5, transparent: true, opacity: 0.3, depthWrite: false, side: T.DoubleSide })));
    surf.rotation.x = -Math.PI / 2; at(surf, (x0 + x1) / 2, ys, 0); surf.renderOrder = 2;
    if (!kit.reduce) kit.onFrame((dt, t) => { surf.material.opacity = 0.26 + 0.07 * Math.sin(t * 1.7); });
    // монетки на дне: текущая мигает, найденные — с зелёным кольцом
    const TG = [30, 50, 70];
    TG.forEach((ta, i) => {
      const done = i < d.ti, cur = i === d.ti; if (!done && !cur) return;
      const x = ox + 10 * Math.tan(snell(ta, 1, n) * RAD) * k;
      at(cyl(1.6, 0.35, 0xd9a93a, { seg: 24 }), x, yb + 0.18, zb);
      const rg = mesh(new T.TorusGeometry(2.4, 0.22, 6, 32), done ? 0x3fae5a : 0xff8a1e, { edges: false }); rg.rotation.x = Math.PI / 2; at(rg, x, yb + 0.3, zb);
      if (cur && !kit.reduce) kit.onFrame((dt, t) => rg.scale.setScalar(1 + 0.15 * Math.sin(t * 4)));
    });
    // стойка с осью позади аквариума, рычаг и скоба с лазером
    const zA = -15, L2 = R + 5.5, A = v3(ox - L2 * Math.sin(ar), ys + L2 * Math.cos(ar), zA);
    at(cyl(3, 0.8, C.DARK), ox, Y0 + 0.4, zA); at(cyl(0.7, ys - Y0, C.STEEL, { edges: false }), ox, (Y0 + ys) / 2, zA);
    const hub = cyl(1.6, 1.2, C.BRASS); hub.rotation.x = Math.PI / 2; at(hub, ox, ys, zA + 0.2);
    rod(kit, v3(ox, ys, zA), A, 0.55, C.STEEL);
    rod(kit, A, v3(A.x, A.y, zb), 0.42, C.STEEL);
    const dir = v3(Math.sin(ar), -Math.cos(ar), 0), tip = v3(ox - R * Math.sin(ar), ys + R * Math.cos(ar), zb);
    laserPen(kit, tip, dir, 'a5');
    // прозрачный транспортир прижат к переднему стеклу
    const O = v3(ox, ys, zb), pc = v3(ox, ys, zi + 0.7);
    if (d.prot) {
      const pd = new T.Mesh(keep(new T.CircleGeometry(16, 64)), keep(new T.MeshBasicMaterial({ map: scaleTex(T, 'clear'), transparent: true, depthWrite: false })));
      at(pd, pc.x, pc.y, pc.z); pd.renderOrder = 2; clickable(pd, 'a1');
    }
    if (a >= 4) { arc(kit, pc.clone().setZ(pc.z + 0.02), 6.5, Math.PI / 2, ar, 0xffd54a, 'xy'); arcLabel(kit, pc, 10, Math.PI / 2 + ar / 2, 'α', '#ffd54a', 'xy'); }
    if (g >= 3) { arc(kit, pc.clone().setZ(pc.z + 0.02), 8.5, -Math.PI / 2, gr, 0x86e0a8, 'xy'); arcLabel(kit, pc, 11.5, -Math.PI / 2 + gr / 2, 'γ', '#86e0a8', 'xy'); }
    dashed(kit, v3(ox, yb + 0.4, zb), v3(ox, ys + 22, zb), 0xe8ecf4, { op: 0.65 });
    // лучи: падающий, преломлённый (γ < α), слабый отражённый; пунктир — путь без преломления
    const Q = O.clone().add(v3(Math.sin(gr), -Math.cos(gr), 0).multiplyScalar((ys - yb - 0.3) / Math.cos(gr)));
    const s1 = beam(kit, tip, O, 1);
    beam(kit, O, Q, 1 - Rf, { s0: s1 });
    beam(kit, O, O.clone().add(v3(Math.sin(ar), Math.cos(ar), 0).multiplyScalar(24)), 0.12 + 0.9 * Math.sqrt(Rf), { s0: s1 });
    if (a >= 3) dashed(kit, O, O.clone().add(v3(Math.sin(ar), -Math.cos(ar), 0).multiplyScalar(Math.min(40, (ys - yb - 0.3) / Math.cos(ar)))), 0xff8a73, { op: 0.5, r: 0.11 });
    spot(kit, Q, 1, 4.5, 0xff5a40, true); spot(kit, O.clone().setY(ys + 0.1), 1, 3.4, 0xff6a50);
    const lt = tip.clone().addScaledVector(dir, -6);
    tag(v3(lt.x, lt.y + 4, zb), 'Лазер', `α = ${a}°`);
    tag(v3(x1 - 9, ys + 4, 0), 'Вода · n = 1,33', `γ = ${f(g, 1)}°`);
    const cx = d.ti < 3 ? ox + 10 * Math.tan(snell(TG[d.ti], 1, n) * RAD) * k : x1 - 10;
    tag(v3(cx, Y0, zi + 16), 'Монетки', d.ti >= 3 ? 'все 3 ✓' : `попаданий ${d.ti}/3`, d.ti >= 3);
  });

  // =====================================================================================
  // 5. Измеряем n: оптическая шайба, полуцилиндр в центре, лазер на рейтере, журнал замеров
  SC['optics-semi'] = onFelt([0, 0, 2], (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, v3, C } = kit;
    const oz = 4, a = d.a, ar = a * RAD, n = d.n, r = 24, Rl = 38;
    const yD = disc(kit, 0, oz, 34, 'a1'), yB = yD + 3.5, O = v3(0, yB, oz);
    semi(kit, v3(0, yD, oz), r, 7, d.mat, 'mat');
    const g = snell(a, 1, n), gr = g * RAD, Rf = fres(a, 1, n);
    // лазер на рейтере у края шайбы
    const dir = v3(Math.sin(ar), 0, Math.cos(ar)), tip = v3(-Rl * Math.sin(ar), yB, oz - Rl * Math.cos(ar));
    const bc = tip.clone().addScaledVector(dir, -5.5);
    at(box(3.6, yB - 1.3 - Y0, 3.6, 0x3b4a66), bc.x, Y0 + (yB - 1.3 - Y0) / 2, bc.z).rotation.y = ar;
    laserPen(kit, tip, dir, 'a5');
    // нормаль и углы на шайбе
    dashed(kit, v3(0, yD + 0.05, oz - 31), v3(0, yD + 0.05, oz + 31), 0x2c3240, { r: 0.15, op: 0.85 });
    const c = v3(0, yD + 0.04, oz);
    if (a >= 4) { arc(kit, c, 8.5, Math.PI / 2, ar, 0xe6a817, 'xz'); arcLabel(kit, c, 12.5, Math.PI / 2 + ar / 2, 'α', '#c48a00', 'xz'); }
    if (g >= 3) { arc(kit, c, 10.5, -Math.PI / 2, gr, 0x2f9e5a, 'xz'); arcLabel(kit, c, 14, -Math.PI / 2 + gr / 2, 'γ', '#23804a', 'xz'); }
    // лучи: падающий; в полуцилиндре идёт по радиусу и выходит без излома; слабый отражённый
    const E = O.clone().add(v3(Math.sin(gr) * r, 0, Math.cos(gr) * r)), F = O.clone().add(v3(Math.sin(gr) * 34, 0, Math.cos(gr) * 34));
    const s1 = beam(kit, tip, O, 1);
    beamPath(kit, [O, E, F], 1 - Rf, { s0: s1 });
    beam(kit, O, O.clone().add(v3(Math.sin(ar) * 32, 0, -Math.cos(ar) * 32)), 0.12 + 0.9 * Math.sqrt(Rf), { s0: s1 });
    spot(kit, F, 1 - Rf, 4.5, 0xff5a40, true); spot(kit, O, 1, 3.2, 0xff6a50);
    // журнал замеров
    const nb = new T.Group(); at(nb, 47, 0, 30); nb.rotation.y = -0.25; clickable(nb, 'rec');
    at(box(15, 0.7, 19, 0x2f6fd8), 0, Y0 + 0.35, 0, nb);
    at(box(14, 0.5, 18, PAPER, { edges: false }), 0.3, Y0 + 0.95, 0, nb);
    for (let i = 0; i < 8; i++) at(box(11, 0.04, 0.14, i < d.rec ? 0x2c3240 : 0x9fb6cf, { edges: false, shadow: false }), 0.8, Y0 + 1.22, -7 + i * 2, nb);
    at(box(0.5, 0.6, 18, 0xe0473a, { edges: false }), -5.2, Y0 + 1.25, 0, nb);
    const pen = cyl(0.45, 13, 0x2c3240, { edges: false }); pen.rotation.z = Math.PI / 2; pen.rotation.y = 0.5; at(pen, 1, Y0 + 1.7, 3, nb);
    const name = d.ans ? 'Сапфир' : MAT[d.mat].name;
    tag(v3(tip.x - Math.sin(ar) * 6, yB + 5, tip.z - Math.cos(ar) * 6), 'Лазер', `α = ${a}°`);
    tag(v3(-26, yD + 6, oz + 14), name + ' · n = ' + (d.mat === 'X' && !d.ans ? '?' : f(n, 2)), `γ = ${f(g, 1)}°`, d.ans);
    tag(v3(47, Y0 + 4, 30), 'Журнал', `замеров ${d.rec}` + (d.mat === 'X' ? '' : ''), d.good >= 2);
  });

  // =====================================================================================
  // 6. Полное отражение: свет идёт из полуцилиндра в воздух; при α > αпр наружу не выходит
  SC['optics-tir'] = onFelt([0, 0, 6], (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, v3, C } = kit;
    const oz = -4, a = d.a, ar = a * RAD, n = d.n, r = 24, Rl = 38;
    const yD = disc(kit, 0, oz, 34, 'a1'), yB = yD + 3.5, O = v3(0, yB, oz);
    semi(kit, v3(0, yD, oz), r, 7, d.mat, 'mat');
    const b = snell(a, n, 1), total = isNaN(b), br = b * RAD, Rf = fres(a, n, 1);
    // лазер спереди, луч входит в круглую грань по радиусу
    const dir = v3(Math.sin(ar), 0, -Math.cos(ar)), tip = v3(-Rl * Math.sin(ar), yB, oz + Rl * Math.cos(ar));
    const bc = tip.clone().addScaledVector(dir, -5.5);
    at(box(3.6, yB - 1.3 - Y0, 3.6, 0x3b4a66), bc.x, Y0 + (yB - 1.3 - Y0) / 2, bc.z).rotation.y = -ar;
    laserPen(kit, tip, dir, 'a5');
    dashed(kit, v3(0, yD + 0.05, oz - 31), v3(0, yD + 0.05, oz + 31), 0x2c3240, { r: 0.15, op: 0.85 });
    // отметки найденных предельных углов
    const c = v3(0, yD + 0.04, oz);
    [['glass', d.fg, 1.5, 'стекло'], ['water', d.fw, 1.33, 'вода']].forEach(([key, on, nn, nm]) => {
      if (!on) return;
      const cr = Math.asin(1 / nn), u = v3(-Math.sin(cr), 0, Math.cos(cr));
      const m = rod(kit, c.clone().addScaledVector(u, 25).setY(yD + 0.12), c.clone().addScaledVector(u, 31).setY(yD + 0.12), 0.3, 0x2f9e5a, { hull: false, matOpt: { emissive: 0x2f9e5a, emissiveIntensity: 0.4 } });
      const lb = flatLabel(kit, nm + ' ' + f(cr / RAD, 1) + '°', '#23804a', 9, 2.2, true);
      lb.position.copy(c.clone().addScaledVector(u, 28).add(v3(-5.5, 0.1, key === 'glass' ? -1.6 : 1.6))); kit.root.add(lb);
    });
    if (a >= 4) { arc(kit, c, 8.5, -Math.PI / 2 - ar, ar, 0xe6a817, 'xz'); arcLabel(kit, c, 12.5, -Math.PI / 2 - ar / 2, 'α', '#c48a00', 'xz'); }
    if (!total && b >= 3) { arc(kit, c, 10.5, Math.PI / 2 - br, br, 0x2f9e5a, 'xz'); arcLabel(kit, c, 14, Math.PI / 2 - br / 2, 'β', '#23804a', 'xz'); }
    // лучи
    const E = O.clone().add(v3(-Math.sin(ar) * r, 0, Math.cos(ar) * r));
    const s1 = beamPath(kit, [tip, E, O], 1);
    const kR = total ? 1 : 0.12 + 0.88 * Math.sqrt(Rf);
    const E2 = O.clone().add(v3(Math.sin(ar) * r, 0, Math.cos(ar) * r)), F2 = O.clone().add(v3(Math.sin(ar) * 34, 0, Math.cos(ar) * 34));
    beamPath(kit, [O, E2, F2], kR, { s0: s1 });
    spot(kit, F2, kR, 4.5, 0xff5a40, true);
    if (!total) { const F = O.clone().add(v3(Math.sin(br) * 33, 0, -Math.cos(br) * 33)); beam(kit, O, F, 1 - Rf, { s0: s1 }); spot(kit, F, 1 - Rf, 4.5, 0xff5a40, true); }
    spot(kit, O, 1, total ? 4.2 : 3.2, 0xff6a50, total);
    tag(v3(tip.x + Math.sin(ar) * -6, yB + 5, tip.z + Math.cos(ar) * 6), 'Лазер', `α = ${a}°`);
    tag(v3(-4, Y0, oz + 40), MAT[d.mat].name + ' · n = ' + f(n, 2), total ? 'полное отражение' : `β = ${f(b, 1)}°`, total);
    tag(v3(20, yD + 3, oz - 26), 'Предельный угол', `найден ${(d.fg ? 1 : 0) + (d.fw ? 1 : 0)}/2`, d.fg && d.fw);
  });
})();
