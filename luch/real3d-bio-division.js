// «Как в жизни» для темы «Деление клетки» (labs/bio-division): музейная модель делящейся клетки на подставке —
// полупрозрачная мембрана, ядро, хромосомы из двух хроматид с белой центромерой (красные — от матери, голубые — от отца),
// центриоли и нити веретена, метафазная пластинка, хиазмы кроссинговера, гаметы; рядом микроскоп с камерой и монитором:
// давленый препарат корешка лука (митоз) или пыльника лилии (мейоз) в текущей фазе. Урок о цикле: часы клеточного цикла
// со стрелкой, клетка в чашке Петри (растёт, удваивает ДНК, делится), монитор с графиком ДНК, коробки периодов и карточки.
// Сцены строятся из window.LUCH_REAL() опыта; положения хроматид и время цикла — из LUCH_REAL.live() каждый кадр.
(() => {
  const SC = window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {};
  const live = () => { try { return window.LUCH_REAL.live ? window.LUCH_REAL.live() : null; } catch (e) { return null; } };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rnd = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const RAD = Math.PI / 180;
  const RED = 0xff7a63, BLUE = 0x52c8e6, CEN = 0xf4f6fa, MEMB = 0x86e0a8, NUC = 0xb48cff, YEL = 0xffd166;
  const LEN = i => (i >> 1) ? 30 : 46;
  const COL = i => (i & 1) ? BLUE : RED;
  const tipCol = s => { const n = typeof s === 'number' ? s : parseInt(String(s).replace('#', ''), 16); return n === 0xff8a73 ? RED : n === 0x72d4e8 ? BLUE : n; };
  const TY = 0.4;
  // координаты схемы (SVG 520 × 405, центр клетки 260, 245) → модель на столе
  const K = 0.19, OX = -12, OZ = -3, CY = 9.9;
  const mx = x => OX + (x - 260) * K, mz = y => OZ + (y - 245) * K;
  const cen2 = (x, y, a, len) => { const y0 = -len * 0.12; return [x - y0 * Math.sin(a * RAD), y + y0 * Math.cos(a * RAD)]; };

  // ---------- общие детали ----------
  function H(kit) {
    const { T, at, box, cyl, keep, grad, clickable, toon, C } = kit;
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    const hexs = c => '#' + c.toString(16).padStart(6, '0');
    const ownMat = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, ...o }));
    const glassMat = (color, opacity, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, transparent: true, opacity, side: T.DoubleSide, depthWrite: o.depthWrite ?? true }));
    const hitMat = keep(new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true, opacity: 0 }));
    const hullT = keep(kit.hullMat.clone()); hullT.transparent = true;
    const hullThin = keep(kit.hullMat.clone()); hullThin.uniforms.t.value = 0.1;
    const glow = (color, size, opacity) => { const s = new T.Sprite(keep(new T.SpriteMaterial({ map: kit.glowTex(), color, transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending }))); s.scale.setScalar(size); return s; };
    function canvasTex(pw, ph) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph;
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      return { c, x: c.getContext('2d'), tex };
    }
    function canvasPlane(w, h, pw, ph, draw) {
      const k = canvasTex(pw, ph);
      const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: k.tex, transparent: true })));
      m.userData.draw = fn => { k.x.clearRect(0, 0, pw, ph); fn(k.x, pw, ph); k.tex.needsUpdate = true; };
      if (draw) m.userData.draw(draw);
      return m;
    }
    const textLines = (x, pw, ph, lines, fg, bg, o = {}) => {
      if (bg) { x.fillStyle = bg; if (o.round) { x.beginPath(); x.roundRect(2, 2, pw - 4, ph - 4, o.round); x.fill(); } else x.fillRect(0, 0, pw, ph); }
      if (o.border) { const bw = o.bw || 6; x.strokeStyle = o.border; x.lineWidth = bw; x.beginPath(); x.roundRect(bw / 2, bw / 2, pw - bw, ph - bw, o.round || 8); x.stroke(); }
      const ws = lines.map(l => typeof l === 'string' ? { t: l } : l), tot = ws.reduce((s, l) => s + (l.k2 || 1), 0);
      let y = 0;
      ws.forEach(t => {
        const lh = ph * (t.k2 || 1) / tot;
        let fs = Math.round(lh * (t.k || 0.62)); const font = s => `${t.w || 600} ${s}px ${t.mono === false ? '"Golos Text", sans-serif' : '"IBM Plex Mono", monospace'}`;
        x.font = font(fs); const tw = x.measureText(t.t).width; if (tw > pw * 0.9) { fs = Math.floor(fs * pw * 0.9 / tw); x.font = font(fs); }
        x.fillStyle = t.c || fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t.t, pw / 2, y + lh / 2 + 2);
        y += lh;
      });
    };
    const sgeo = {};
    const sphereGeo = r => sgeo[r] || (sgeo[r] = keep(new T.SphereGeometry(r, 18, 12)));
    function ball(parent, x, y, z, r, col, o = {}) {
      const m = new T.Mesh(sphereGeo(r), o.mat || toon(col, o.matOpt));
      m.castShadow = o.shadow !== false; m.add(new T.Mesh(m.geometry, o.thin ? hullThin : kit.hullMat));
      return at(m, x, y, z, parent);
    }
    // плоская клавиша с надписью сверху
    function key(parent, x, z, w, dd, lines, color, keyName, o = {}) {
      const b = new T.Group(); at(b, x, o.y ?? TY, z, parent);
      at(box(w, 1.6, dd, color), 0, 0.8, 0, b);
      const top = canvasPlane(w * 0.9, dd * 0.8, Math.round(70 * w / dd * 1.4), 112, (cx, a, bb) => textLines(cx, a, bb, [].concat(lines), o.fg || '#ffffff', hexs(color)));
      top.rotation.x = -Math.PI / 2; at(top, 0, 1.62, 0, b);
      if (o.on) at(box(w + 1.2, 0.5, dd + 1.2, YEL, { edges: false }), 0, 0.25, 0, b);
      if (keyName) clickable(b, keyName);
      return b;
    }
    // табличка на ножке, чуть откинута назад, лицом к зрителю (+z)
    function plate(parent, x, z, w, hh, lines, o = {}) {
      const g = new T.Group(); at(g, x, o.y ?? TY, z, parent);
      at(box(w * 0.6, 0.8, 3, o.foot ?? 0x2c3240), 0, 0.4, -0.6, g);
      const pw = Math.round(Math.min(1024, 90 * w)), ph = Math.round(pw * hh / w);
      const pl = canvasPlane(w, hh, pw, ph, (cx, a, b) => o.draw ? o.draw(cx, a, b) : textLines(cx, a, b, lines, o.fg || '#1b1610', o.bg || '#fff6e6', { round: 16, border: '#1b1610', bw: 5 }));
      const tilt = o.tilt ?? 0.22;
      const hold = new T.Group(); at(hold, 0, 0.8, 0, g); hold.rotation.x = -tilt;
      at(box(w + 0.4, hh + 0.4, 0.4, o.foot ?? 0x2c3240, { edges: false }), 0, hh / 2 + 0.2, -0.25, hold); at(pl, 0, hh / 2 + 0.2, 0, hold);
      g.userData.plane = pl;
      return g;
    }
    // пульсирующее кольцо «сюда»
    function beacon(parent, x, y, z, r, col = YEL) {
      const m = new T.Mesh(keep(new T.RingGeometry(r * 0.78, r, 40)), keep(new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthWrite: false, side: T.DoubleSide })));
      m.rotation.x = -Math.PI / 2; at(m, x, y + 0.16, z, parent);
      if (!kit.reduce) kit.onFrame((dt, t) => { const k = 0.5 + 0.5 * Math.sin(t * 4); m.material.opacity = 0.35 + 0.55 * k; m.scale.setScalar(1 + 0.06 * k); });
      return m;
    }
    // светлый лабораторный коврик
    function mat(g) {
      at(box(126, TY, 90, 0x4a6b78, { edges: false }), 0, TY / 2, 4, g);
      at(box(126, 0.12, 0.6, 0x6f94a2, { edges: false, shadow: false }), 0, TY + 0.06, -40.6, g);
      at(box(126, 0.12, 0.6, 0x6f94a2, { edges: false, shadow: false }), 0, TY + 0.06, 48.6, g);
    }
    // световой микроскоп с камерой на окуляре; возвращает точку выхода кабеля камеры
    function microscope(parent, x, z, rotY, stain, keyName) {
      const mg = new T.Group(); at(mg, x, TY, z, parent); mg.rotation.y = rotY;
      const BODY = 0xe8ecf4, BODY2 = 0x2c3240;
      at(box(15, 2.4, 19, BODY2), 0, 1.2, 0, mg);
      at(box(4.6, 23, 4.4, BODY), 0, 13.6, -7.4, mg);
      at(box(4.6, 4.4, 10, BODY), 0, 26.4, -3.6, mg);
      at(box(13, 1, 12, BODY2), 0, 11.6, 1, mg);
      at(box(11, 0.25, 3.6, 0xd8eef8, { matOpt: { transparent: true, opacity: 0.65 } }), 0, 12.25, 1, mg);
      at(box(2.6, 0.12, 2.6, stain, { edges: false }), 0, 12.42, 1, mg);
      at(box(1.2, 0.5, 4, kit.C.STEEL, { edges: false }), -4.6, 12.35, 1, mg); at(box(1.2, 0.5, 4, kit.C.STEEL, { edges: false }), 4.6, 12.35, 1, mg);
      at(cyl(1.8, 1.2, BODY2), 0, 9, 1, mg);
      at(glow(0xfff1b8, 6, 0.75), 0, 10, 1, mg);
      at(cyl(2.8, 1.8, kit.C.STEEL), 0, 23.4, 0.6, mg);
      [-1.4, 0, 1.4].forEach((dx, i) => at(cyl(0.75 - i * 0.1, 3.4 + i * 0.8, i === 1 ? kit.C.BRASS : kit.C.STEEL, { edges: false }), dx, 21 - i * 0.4, 1, mg));
      const tube = new T.Group(); at(tube, 0, 28.4, -2.4, mg); tube.rotation.x = -0.4;
      at(cyl(1.7, 7, BODY), 0, 3.5, 0, tube);
      at(cyl(1.3, 2.6, BODY2), 0, 8.2, 0, tube);
      at(box(3.4, 2.6, 3.4, 0x26324a), 0, 10.7, 0, tube);
      const kn = cyl(2.6, 1.6, 0xffb547, { seg: 24 }); kn.rotation.z = Math.PI / 2; at(kn, 3.4, 13, -7.4, mg);
      const kn2 = cyl(2.6, 1.6, 0xffb547, { seg: 24 }); kn2.rotation.z = Math.PI / 2; at(kn2, -3.4, 13, -7.4, mg);
      if (keyName) clickable(mg, keyName);
      mg.updateMatrixWorld(true);
      return { g: mg, out: v3(0, 12.2, 0).applyMatrix4(tube.matrixWorld), top: 36 };
    }
    // монитор на подставке с экраном-холстом
    function monitor(parent, x, z, rotY, w, hh, pw, draw, keyName) {
      const g = new T.Group(); at(g, x, TY, z, parent); g.rotation.y = rotY;
      at(box(10, 0.8, 7, 0x2c3240), 0, 0.4, 0, g); at(box(2, 6.4, 1.6, 0x2c3240), 0, 4, -1.4, g);
      const y0 = 6.6, ph = Math.round(pw * hh / w);
      at(box(w + 1.6, hh + 1.6, 1.4, 0x1b1f28), 0, y0 + hh / 2, -0.6, g);
      const scr = canvasPlane(w, hh, pw, ph, draw); scr.material.transparent = false; at(scr, 0, y0 + hh / 2, 0.12, g);
      if (keyName) clickable(g, keyName);
      g.updateMatrixWorld(true);
      return { g, scr, top: y0 + hh + 1, back: v3(0, y0 + 2, -1.3).applyMatrix4(g.matrixWorld) };
    }
    return { v3, hexs, ownMat, glassMat, hitMat, hullT, hullThin, glow, canvasTex, canvasPlane, textLines, ball, key, plate, beacon, mat, microscope, monitor };
  }

  // =====================================================================================
  // МОДЕЛЬ КЛЕТКИ (митоз и мейоз): мембрана, ядро, хромосомы, веретено — следуют за схемой
  // =====================================================================================
  const GCELL = [[150, 178], [150, 312], [370, 178], [370, 312]];
  function cellModel(kit, h, g, d, kind) {
    const { T, at, box, cyl, mesh, keep, toon, clickable } = kit, v3 = h.v3;
    const p = d.p, mito = kind === 'mito';
    // подставка: деревянный овал и прозрачная плита, на которой лежит клетка
    const plinth = keep(new T.CylinderGeometry(1, 1.06, 2.2, 56)); plinth.scale(48, 1, 32);
    at(mesh(plinth, kit.C.WOOD2, { hull: true, edges: false }), OX, TY + 1.1, OZ, g);
    const slab = new T.Mesh(keep(new T.BoxGeometry(84, 1.2, 54)), h.glassMat(0xe6f4fb, 0.22)); slab.renderOrder = 1; slab.add(new T.LineSegments(keep(new T.EdgesGeometry(slab.geometry)), kit.edgeMat));
    at(slab, OX, TY + 2.8, OZ, g);
    // мембраны
    const shape = mito ? (p <= 3 ? 'one' : p === 4 ? 'pinch' : 'two') : (p <= 3 ? 'one' : p === 4 ? 'pinch' : p <= 6 ? 'two' : 'four');
    const blob = (x, y, rx, rz, ry) => {
      const geo = keep(new T.SphereGeometry(1, 48, 26)); geo.scale(rx * K, ry, rz * K);
      const m = new T.Mesh(geo, h.glassMat(MEMB, 0.2)); m.renderOrder = 1;
      const hm = new T.Mesh(geo, h.hullT); hm.renderOrder = 2; m.add(hm);
      at(m, mx(x), CY, mz(y), g);
    };
    if (shape === 'one') blob(260, 245, 200, 124, 6.5);
    else if (shape === 'pinch') { blob(150, 245, 125, 128, 6.2); blob(370, 245, 125, 128, 6.2); }
    else if (shape === 'two') { blob(150, 245, 104, 120, 6); blob(370, 245, 104, 120, 6); }
    else GCELL.forEach(([x, y]) => blob(x, y, 60, 60, 4.6));
    // ядро: целое — полупрозрачная сфера, распадающееся или собирающееся — отдельные лоскуты оболочки
    const nucleus = (x, y, r, broken) => {
      const R = r * K;
      if (!broken) {
        const geo = keep(new T.SphereGeometry(1, 36, 20)); geo.scale(R, 3.6, R);
        const m = new T.Mesh(geo, h.glassMat(NUC, 0.22, { depthWrite: false })); m.renderOrder = 0; at(m, mx(x), CY, mz(y), g);
        return;
      }
      for (let k = 0; k < 9; k++) {
        const geo = keep(new T.SphereGeometry(1, 8, 6, k * Math.PI * 2 / 9, Math.PI * 2 / 9 * 0.62, Math.PI * (0.22 + 0.1 * rnd(k)), Math.PI * 0.5)); geo.scale(R, 3.6, R);
        const m = new T.Mesh(geo, h.glassMat(NUC, 0.34, { depthWrite: false })); at(m, mx(x), CY, mz(y), g);
      }
    };
    if (p === 0) { nucleus(260, 245, 74, false); h.ball(g, mx(282), CY + 0.6, mz(262), 1.7, 0x8a5fd0, { thin: true }); }
    if (p === 1) nucleus(260, 245, 74, true);
    if (mito && p >= 4) for (const x of [150, 370]) nucleus(x, 245, p === 4 ? 44 : 50, p === 4);
    // центриоли и лучи звезды
    const segs = [];
    const centriole = (x, y) => {
      const a = cyl(0.42, 1.8, 0xc9d3e6, { seg: 10, edges: false }); a.rotation.z = Math.PI / 2; at(a, mx(x), CY, mz(y), g);
      at(cyl(0.42, 1.8, 0xc9d3e6, { seg: 10, edges: false }), mx(x), CY, mz(y) + 0.5, g);
    };
    const aster = (x, y) => {
      for (let k = 0; k < 8; k++) { const a = k * 45 * RAD; segs.push([mx(x + Math.cos(a) * 8), mz(y + Math.sin(a) * 8), mx(x + Math.cos(a) * 18), mz(y + Math.sin(a) * 18)]); }
      centriole(x, y);
    };
    const poles = [];
    if (mito) {
      if (p === 0) { centriole(196, 158); centriole(206, 160); }
      if (p === 1) { aster(150, 190); aster(370, 300); }
      if (p === 2 || p === 3) { aster(95, 245); aster(425, 245); segs.push([mx(95), mz(245), mx(425), mz(245)]); }
      if (p >= 4) { centriole(70, 245); centriole(450, 245); }
    } else {
      if (p === 2 || p === 3) { aster(95, 245); aster(425, 245); }
      if (p === 5 || p === 6) for (const cx of [150, 370]) { aster(cx, 140); aster(cx, 350); }
    }
    if (segs.length) {
      const pos = new Float32Array(segs.length * 6);
      segs.forEach((s, n) => pos.set([s[0], CY, s[1], s[2], CY, s[3]], n * 6));
      const geo = keep(new T.BufferGeometry()); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
      at(new T.LineSegments(geo, keep(new T.LineBasicMaterial({ color: 0xaebbd2, transparent: true, opacity: 0.55 }))), 0, 0, 0, g);
    }
    // экватор (метафазная пластинка)
    if (p === 2) {
      const pl = new T.Mesh(keep(new T.PlaneGeometry(44, 8)), keep(new T.MeshBasicMaterial({ color: YEL, transparent: true, opacity: 0.16, side: T.DoubleSide, depthWrite: false })));
      pl.rotation.y = Math.PI / 2; at(pl, mx(260), CY, mz(245), g);
      const fr = new T.LineSegments(keep(new T.EdgesGeometry(pl.geometry)), keep(new T.LineBasicMaterial({ color: YEL }))); pl.add(fr);
    }
    // хромосомы: 8 хроматид, положения и поворот — из схемы каждый кадр
    const capG = {};
    const capGeo = (r, l) => { const k = r + ':' + l.toFixed(2); return capG[k] || (capG[k] = keep(new T.CapsuleGeometry(r, Math.max(0.05, l), 6, 14))); };
    const CR = 0.62, chs = [];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
      const cg = new T.Group(); at(cg, mx(SCX[i]), CY, mz(SCY[i]), g);
      const L = LEN(i) * K, main = COL(i), tip = d.tips ? tipCol(d.tips[i][j]) : main;
      const cap = (len, col, zc) => {
        const geo = capGeo(CR, len - 2 * CR), m = new T.Mesh(geo, toon(col)); m.castShadow = true; m.add(new T.Mesh(geo, h.hullThin));
        m.rotation.x = Math.PI / 2; m.position.z = zc; cg.add(m);
      };
      if (tip === main) cap(L, main, 0); else { cap(0.66 * L, main, -0.17 * L); cap(0.34 * L + 0.3, tip, 0.33 * L - 0.15); }
      at(new T.Mesh(keep(new T.BoxGeometry(2.6, 2.6, L + 1)), h.hitMat), 0, 0, 0, cg);
      clickable(cg, 'chr-' + i);
      chs.push(cg);
    }
    // центромеры: общая у сестёр, пока хроматиды вместе; потом у каждой своя
    const cJ = [0, 1, 2, 3].map(() => h.ball(g, 0, CY + 0.3, 0, 0.66, CEN, { thin: true }));
    const cS = [0, 1, 2, 3, 4, 5, 6, 7].map(() => h.ball(g, 0, CY + 0.3, 0, 0.5, CEN, { thin: true }));
    const joined = mito ? p <= 2 : p <= 5;
    // нити веретена — к центромерам
    const fPos = new Float32Array(20 * 6), fGeo = keep(new T.BufferGeometry());
    fGeo.setAttribute('position', new T.BufferAttribute(fPos, 3)); fGeo.setDrawRange(0, 0);
    const fib = new T.LineSegments(fGeo, keep(new T.LineBasicMaterial({ color: 0xc9d6ea, transparent: true, opacity: 0.85 }))); fib.frustumCulled = false; at(fib, 0, 0, 0, g);
    // хиазмы
    const chi = [0, 1].map(() => {
      const x = new T.Group(); at(x, 0, CY + 1, 0, g);
      for (const s of [-1, 1]) { const b = box(3.2, 0.3, 0.45, YEL, { edges: false }); b.rotation.y = s * 0.7; at(b, 0, 0, 0, x); }
      x.visible = false; return x;
    });
    const pcen = (P, i, j) => { const q = P[i * 2 + j]; return cen2(q.x, q.y, q.a, LEN(i)); };
    const pairC = (P, i) => { const a = pcen(P, i, 0), b = pcen(P, i, 1); return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
    const slot = d.slot || [], ori = d.ori || [0, 0], co = d.co || [false, false];
    function pose() {
      const P = (live() || {}).pc;
      if (!P || P.length !== 8) return;
      for (let n = 0; n < 8; n++) {
        const q = P[n], c = chs[n];
        c.position.set(mx(q.x), CY, mz(q.y)); c.rotation.y = -q.a * RAD;
        const r = q.m === 1 ? 0.38 : q.m === 2 ? 0.72 : 1, l = q.m === 2 ? 0.65 : 1;
        c.scale.set(r, r, l);
      }
      for (let i = 0; i < 4; i++) {
        const a = P[i * 2], b = P[i * 2 + 1], hide = a.m === 1;
        const ca = pcen(P, i, 0), cb = pcen(P, i, 1);
        cJ[i].visible = joined && !hide;
        if (cJ[i].visible) cJ[i].position.set(mx((ca[0] + cb[0]) / 2), CY + 0.3, mz((ca[1] + cb[1]) / 2));
        [[a, ca], [b, cb]].forEach(([q, c], j) => { const s = cS[i * 2 + j]; s.visible = !joined && !hide && q.m !== 2; if (s.visible) s.position.set(mx(c[0]), CY + 0.3, mz(c[1])); });
      }
      // нити: как на схеме
      const L = [];
      if (mito && (p === 2 || p === 3)) {
        for (let i = 0; i < 4; i++) {
          if (p === 2 && !(slot[i] >= 0)) continue;
          for (let j = 0; j < 2; j++) { const c = p === 2 ? pairC(P, i) : pcen(P, i, j); L.push([j ? 425 : 95, 245, c[0] + (p === 2 ? (j ? 4 : -4) : 0), c[1]]); }
        }
      }
      if (!mito && (p === 2 || p === 3)) for (let i = 0; i < 4; i++) { const c = pairC(P, i), left = (i & 1) === ori[i >> 1]; L.push([left ? 95 : 425, 245, c[0], c[1]]); }
      if (!mito && (p === 5 || p === 6)) for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
        const c = p === 5 ? pairC(P, i) : pcen(P, i, j), cx = ((i & 1) === ori[i >> 1]) ? 150 : 370;
        L.push([cx, j ? 350 : 140, c[0], c[1] + (p === 5 ? (j ? 3 : -3) : 0)]);
      }
      L.slice(0, 20).forEach((s, n) => fPos.set([mx(s[0]), CY, mz(s[1]), mx(s[2]), CY, mz(s[3])], n * 6));
      fGeo.setDrawRange(0, Math.min(20, L.length) * 2); fGeo.attributes.position.needsUpdate = true;
      // хиазмы
      for (let k = 0; k < 2; k++) {
        const on = !mito && (p === 1 || p === 2) && co[k]; chi[k].visible = on;
        if (on) { const a = P[k * 4 + 1], b = P[k * 4 + 2], y = a.y + LEN(k * 2) * 0.16; chi[k].position.set(mx((a.x + b.x) / 2), CY + 1, mz(y)); }
      }
    }
    pose();
    kit.onFrame(pose);
    return { shape };
  }
  // начальные места хромосом в интерфазе (как SC на схеме) — до первого кадра live
  const SCX = [214, 302, 232, 300], SCY = [212, 218, 286, 282];

  // ---------- что видно в микроскоп ----------
  const INKP = '#6d1d55';
  function worm(x, pts, w = 7, col = INKP) { x.strokeStyle = col; x.lineWidth = w; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); pts.forEach(([a, b], k) => k ? x.lineTo(a, b) : x.moveTo(a, b)); x.stroke(); }
  // клетка корешка лука в фазе митоза p (ось корня вертикальна, веретено вдоль неё)
  function rootCell(x, cx, cy, cw, ch, p, s = 1) {
    const nr = cw * 0.3;
    if (p === 0) {
      x.fillStyle = 'rgba(150,60,115,.55)'; x.beginPath(); x.ellipse(cx, cy, nr, nr * 1.1, 0, 0, 7); x.fill();
      x.fillStyle = 'rgba(110,30,85,.8)'; x.beginPath(); x.arc(cx + nr * 0.25, cy - nr * 0.2, nr * 0.25, 0, 7); x.fill();
      for (let k = 0; k < 10; k++) { x.fillStyle = 'rgba(110,30,85,.55)'; x.beginPath(); x.arc(cx + (rnd(k + cx) - 0.5) * nr * 1.3, cy + (rnd(k + cy) - 0.5) * nr * 1.5, 2.2 * s, 0, 7); x.fill(); }
    } else if (p === 1) {
      x.strokeStyle = 'rgba(150,60,115,.7)'; x.lineWidth = 3 * s; x.setLineDash([9 * s, 7 * s]); x.beginPath(); x.ellipse(cx, cy, nr * 1.15, nr * 1.25, 0, 0, 7); x.stroke(); x.setLineDash([]);
      for (let k = 0; k < 5; k++) { const a = rnd(k + 3) * 6.28, ox = cx + Math.cos(a) * nr * 0.45, oy = cy + Math.sin(a) * nr * 0.55; worm(x, [[ox - 9 * s, oy - 6 * s], [ox - 3 * s, oy + 4 * s], [ox + 4 * s, oy - 4 * s], [ox + 9 * s, oy + 6 * s]], 5 * s); }
    } else if (p === 2) {
      for (let k = 0; k < 6; k++) { const ox = cx - cw * 0.3 + k * cw * 0.12; worm(x, [[ox, cy - 9 * s], [ox, cy + 9 * s]], 6 * s); }
      x.strokeStyle = 'rgba(150,60,115,.22)'; x.lineWidth = 1.5; for (let k = -3; k <= 3; k++) { x.beginPath(); x.moveTo(cx, cy - ch * 0.42); x.lineTo(cx + k * cw * 0.1, cy); x.lineTo(cx, cy + ch * 0.42); x.stroke(); }
    } else if (p === 3) {
      for (const sg of [-1, 1]) for (let k = 0; k < 5; k++) { const ox = cx - cw * 0.26 + k * cw * 0.13, oy = cy + sg * ch * 0.2; worm(x, [[ox - 5 * s, oy - sg * 9 * s], [ox, oy + sg * 3 * s], [ox + 5 * s, oy - sg * 9 * s]], 5 * s); }
    } else if (p === 4) {
      for (const sg of [-1, 1]) { x.fillStyle = 'rgba(120,35,90,.8)'; x.beginPath(); x.ellipse(cx, cy + sg * ch * 0.3, cw * 0.3, ch * 0.08, 0, 0, 7); x.fill(); }
      x.strokeStyle = 'rgba(150,60,115,.55)'; x.lineWidth = 3; x.setLineDash([6, 6]); x.beginPath(); x.moveTo(cx - cw * 0.3, cy); x.lineTo(cx + cw * 0.3, cy); x.stroke(); x.setLineDash([]);
    } else {
      x.strokeStyle = '#a77890'; x.lineWidth = 4; x.beginPath(); x.moveTo(cx - cw / 2, cy); x.lineTo(cx + cw / 2, cy); x.stroke();
      for (const sg of [-1, 1]) { x.fillStyle = 'rgba(150,60,115,.6)'; x.beginPath(); x.ellipse(cx, cy + sg * ch * 0.25, nr * 0.85, nr * 0.75, 0, 0, 7); x.fill(); }
    }
  }
  function drawRoot(x, w, h, p, phase) {
    x.fillStyle = '#f2e4e9'; x.fillRect(0, 0, w, h);
    const cols = 9, rows = 3, H0 = h - 58, cw = w / cols, ch = H0 / rows;
    const other = { '0,1': 2, '2,6': 1, '0,7': 4, '2,2': 3 };
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const X = c * cw + (r % 2 ? -cw * 0.25 : 0), cx = X + cw / 2, cy = r * ch + ch / 2, me = r === 1 && c === 4;
      x.fillStyle = me ? 'rgba(255,240,245,.9)' : 'rgba(255,255,255,.35)'; x.fillRect(X + 3, r * ch + 3, cw - 6, ch - 6);
      x.strokeStyle = '#b98aa0'; x.lineWidth = 4; x.strokeRect(X + 2, r * ch + 2, cw - 4, ch - 4);
      rootCell(x, cx, cy, cw, ch, me ? p : (other[r + ',' + c] ?? 0), me ? 1 : 0.8);
      if (me) { x.strokeStyle = '#ffb020'; x.lineWidth = 6; x.strokeRect(X + 5, r * ch + 5, cw - 10, ch - 10); }
    }
    x.fillStyle = '#0e1520'; x.fillRect(0, H0, w, h - H0);
    x.fillStyle = '#e8ecf4'; x.font = '600 26px "Golos Text", sans-serif'; x.textAlign = 'left'; x.textBaseline = 'middle';
    x.fillText('Корешок лука · ×400', 18, H0 + 29); x.textAlign = 'right'; x.fillStyle = '#ffd166'; x.fillText(phase, w - 18, H0 + 29);
  }
  // материнская клетка пыльцы в пыльнике лилии в фазе мейоза p (все клетки пыльника делятся вместе)
  function antherCell(x, cx, cy, r, p, s) {
    const ring = (X, Y, R) => { x.strokeStyle = '#b79a72'; x.lineWidth = 4 * s; x.beginPath(); x.arc(X, Y, R, 0, 7); x.stroke(); };
    const bar = (X, Y, vert, L = 10) => worm(x, vert ? [[X, Y - L * s], [X, Y + L * s]] : [[X - L * s, Y], [X + L * s, Y]], 6 * s);
    x.fillStyle = 'rgba(255,250,240,.6)';
    if (p <= 3) {
      x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); ring(cx, cy, r);
      if (p === 0) { x.fillStyle = 'rgba(150,60,115,.5)'; x.beginPath(); x.arc(cx, cy, r * 0.42, 0, 7); x.fill(); }
      if (p === 1) { x.strokeStyle = 'rgba(150,60,115,.6)'; x.lineWidth = 3 * s; x.setLineDash([8 * s, 6 * s]); x.beginPath(); x.arc(cx, cy, r * 0.5, 0, 7); x.stroke(); x.setLineDash([]); for (const o of [-1, 1]) { worm(x, [[cx + o * r * 0.2 - 3 * s, cy - 12 * s], [cx + o * r * 0.2 - 3 * s, cy + 12 * s]], 5 * s); worm(x, [[cx + o * r * 0.2 + 3 * s, cy - 12 * s], [cx + o * r * 0.2 + 3 * s, cy + 12 * s]], 5 * s); } }
      if (p === 2) for (const o of [-1, 1]) { bar(cx + o * r * 0.25, cy - 6 * s, false, 7); bar(cx + o * r * 0.25, cy + 6 * s, false, 7); }
      if (p === 3) for (const sg of [-1, 1]) for (const o of [-1, 1]) bar(cx + o * r * 0.25, cy + sg * r * 0.55, false, 7);
    } else if (p <= 6) {
      x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); ring(cx, cy, r);
      x.strokeStyle = '#b79a72'; x.lineWidth = 3 * s; x.beginPath(); x.moveTo(cx, cy - r); x.lineTo(cx, cy + r); x.stroke();
      for (const sg of [-1, 1]) {
        const X = cx + sg * r * 0.5;
        if (p === 4) { x.fillStyle = 'rgba(150,60,115,.6)'; x.beginPath(); x.arc(X, cy, r * 0.22, 0, 7); x.fill(); }
        if (p === 5) { bar(X, cy - 5 * s, false, 6); bar(X, cy + 5 * s, false, 6); }
        if (p === 6) { bar(X, cy - r * 0.5, false, 6); bar(X, cy + r * 0.5, false, 6); }
      }
    } else {
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + Math.PI / 4, X = cx + Math.cos(a) * r * 0.42, Y = cy + Math.sin(a) * r * 0.42;
        x.beginPath(); x.arc(X, Y, r * 0.46, 0, 7); x.fill(); ring(X, Y, r * 0.46);
        x.fillStyle = 'rgba(150,60,115,.6)'; x.beginPath(); x.arc(X, Y, r * 0.14, 0, 7); x.fill(); x.fillStyle = 'rgba(255,250,240,.6)';
      }
    }
  }
  function drawAnther(x, w, h, p, phase) {
    x.fillStyle = '#f4ead9'; x.fillRect(0, 0, w, h);
    const H0 = h - 58, r = 60;
    for (let row = -1; row <= 3; row++) for (let c = -1; c <= 6; c++) {
      const cx = w / 2 + (c - 2.5) * r * 2.1 + (row % 2 ? r * 1.05 : 0), cy = H0 / 2 + (row - 1) * r * 1.82;
      if (cy - r > H0) continue;
      const me = row === 1 && c === 2;
      antherCell(x, cx + (me ? 0 : (rnd(row * 9 + c) - 0.5) * 8), cy, me ? r * 0.98 : r * 0.9, p, me ? 1 : 0.85);
      if (me) { x.strokeStyle = '#ffb020'; x.lineWidth = 6; x.beginPath(); x.arc(cx, cy, r + 6, 0, 7); x.stroke(); }
    }
    x.fillStyle = '#0e1520'; x.fillRect(0, H0, w, h - H0);
    x.fillStyle = '#e8ecf4'; x.font = '600 26px "Golos Text", sans-serif'; x.textAlign = 'left'; x.textBaseline = 'middle';
    x.fillText('Пыльник лилии · ×400', 18, H0 + 29); x.textAlign = 'right'; x.fillStyle = '#ffd166'; x.fillText(phase, w - 18, H0 + 29);
  }

  // =====================================================================================
  // 1. МИТОЗ
  // =====================================================================================
  const MITO_KEYS = ['Профаза', 'Метафаза', 'Анафаза', 'Телофаза', 'Цитокинез'];
  SC['bio-mitosis'] = (kit, d) => {
    const { T, at, tag, cable } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.mat(g);
    cellModel(kit, h, g, d, 'mito');
    tag(v3(OX, CY + 9, OZ - 6), `Митоз · ${d.phase}`, d.p >= 4 ? `${d.f} в каждом ядре` : d.f, d.done);
    if (d.p === 2) tag(v3(OX, CY + 5, OZ - 23), 'Экватор', `на экваторе ${d.al} из 4`, d.al === 4);
    // клавиши фаз и «Заново»
    MITO_KEYS.forEach((t, n) => h.key(g, -54 + n * 14.2, 40, 13, 5.6, [{ t, k: 0.6, mono: false, w: 600 }], n + 1 === d.p ? 0x3fae5a : 0x3b4a66, 'ph-' + (n + 1), { on: n + 1 === d.p }));
    h.key(g, 20, 40, 11, 5.6, [{ t: 'Заново', k: 0.6, mono: false, w: 600 }], 0x6b5a44, 'again');
    tag(v3(-26, 5, 40), 'Следующая фаза', d.err ? `ошибок порядка: ${d.err}` : 'по порядку', false);
    h.plate(g, -48, 30, 15, 5, [{ t: 'Модель клетки', k: 0.6, mono: false, w: 700 }, { t: '2n = 4', k: 0.6 }], { tilt: 0.45 });
    // микроскоп с камерой и монитор
    const ms = h.microscope(g, 52, 14, -0.5, 0xb0457f, 'scope');
    const mon = h.monitor(g, 46, -26, 0.35, 30, 19.7, 640, (x, w, hh) => drawRoot(x, w, hh, d.p, d.phase), 'scope');
    cable(ms.out, mon.back, 0x2c3240, 0, { r: 0.45, lift: 2 });
    tag(v3(52, TY + ms.top, 14), 'Микроскоп', 'корешок лука', false);
    tag(v3(46, TY + mon.top + 1, -26), 'Камера микроскопа', d.phase.toLowerCase(), false);
  };

  // =====================================================================================
  // 2. МЕЙОЗ
  // =====================================================================================
  SC['bio-meiosis'] = (kit, d) => {
    const { T, at, tag, cable } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.mat(g);
    cellModel(kit, h, g, d, 'mei');
    tag(v3(OX, CY + 9, OZ - 6), `Мейоз · ${d.phase}`, d.f, d.done);
    if (d.p === 1 || d.p === 2) for (let k = 0; k < 2; k++) {
      const bx = d.p === 1 ? [205, 315][k] : 260, by = d.p === 1 ? 245 : [190, 300][k];
      if (d.p === 1 && !d.co[k]) h.beacon(g, mx(bx), CY - 2.2, mz(by), 4.6);
      if (d.p === 2) h.beacon(g, mx(bx), CY - 2.2, mz(by), 5.2);
    }
    if (d.p === 1) tag(v3(mx(260), CY + 4, mz(300)), 'Биваленты', 'нажмите пару — кроссинговер', true);
    if (d.p === 2) tag(v3(mx(260), CY + 4, mz(345)), 'Биваленты', 'нажмите пару — развернуть', true);
    if (d.gam) GCELL.forEach(([x, y], n) => tag(v3(mx(x), CY + 5, mz(y)), '', 'гамета ' + d.gam[n], d.types.includes(d.gam[n])));
    // клавиши
    const ks = [];
    if (d.p === 1) ks.push(['co-0', ['Кроссинговер', 'длинная'], d.co[0]], ['co-1', ['Кроссинговер', 'короткая'], d.co[1]]);
    if (d.p === 2) ks.push(['fl-0', ['Развернуть', 'длинную'], false], ['fl-1', ['Развернуть', 'короткую'], false]);
    if (d.p < 7) ks.push(['next', ['Дальше ›'], false]);
    ks.push(['new', ['Новая', 'клетка'], false]);
    ks.forEach(([k, lines, on], n) => h.key(g, -52 + n * 15, 40, 14, 6.4, lines.map(t => ({ t, k: 0.66, mono: false, w: 600 })), k === 'next' ? 0x3fae5a : k === 'new' ? 0x6b5a44 : 0x3b4a66, k, { on }));
    // сочетания в гаметах
    const all = ['ММ', 'МП', 'ПМ', 'ПП'];
    h.plate(g, 18, 34, 22, 7.4, [], {
      tilt: 0.4,
      draw: (x, w, hh) => {
        x.fillStyle = '#fff6e6'; x.beginPath(); x.roundRect(2, 2, w - 4, hh - 4, 16); x.fill(); x.strokeStyle = '#1b1610'; x.lineWidth = 5; x.stroke();
        x.fillStyle = '#6b5a44'; x.font = '600 40px "Golos Text", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('Сочетания в гаметах', w / 2, hh * 0.28);
        all.forEach((t, n) => {
          const got = d.types.includes(t), X = w * (0.14 + n * 0.24), Y = hh * 0.66;
          x.fillStyle = got ? '#d6f5df' : '#efe7d8'; x.beginPath(); x.roundRect(X - 70, Y - 40, 140, 80, 14); x.fill();
          x.strokeStyle = got ? '#1d7a3e' : '#b8a98f'; x.lineWidth = 4; x.stroke();
          x.fillStyle = got ? '#1d7a3e' : '#9a8b72'; x.font = '700 54px "IBM Plex Mono", monospace'; x.fillText(t, X, Y + 3);
        });
      },
    });
    tag(v3(18, 10, 34), 'Гаметы', `${d.types.length} из 4`, d.types.length === 4);
    const ms = h.microscope(g, 52, 14, -0.5, 0xc9a24a, 'scope');
    const mon = h.monitor(g, 46, -26, 0.35, 30, 19.7, 640, (x, w, hh) => drawAnther(x, w, hh, d.p, d.phase), 'scope');
    cable(ms.out, mon.back, 0x2c3240, 0, { r: 0.45, lift: 2 });
    tag(v3(52, TY + ms.top, 14), 'Микроскоп', 'пыльник лилии', false);
    tag(v3(46, TY + mon.top + 1, -26), 'Камера микроскопа', d.phase.toLowerCase(), false);

  };

  // =====================================================================================
  // 3. ЖИЗНЕННЫЙ ЦИКЛ: часы цикла, клетка в чашке Петри, график ДНК, коробки и карточки
  // =====================================================================================
  const PN = ['G₁', 'S', 'G₂', 'M'], PFULL = ['пресинтетический', 'синтетический', 'постсинтетический', 'митоз'];
  const PC = [0x86e0a8, 0xffb547, 0x72d4e8, 0xff8a73], PCS = ['#86e0a8', '#ffb547', '#72d4e8', '#ff8a73'];
  const DOING = ['растёт', 'удваивает ДНК', 'готовится к делению', 'делится'];
  SC['bio-cycle'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, toon } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.mat(g);
    const D = d.d, TT = d.T;
    const perAt = t => { let acc = 0; for (let k = 0; k < 3; k++) { if (t < acc + D[k]) return k; acc += D[k]; } return 3; };
    const cAt = t => t < D[0] ? 2 : t < D[0] + D[1] ? 2 + 2 * (t - D[0]) / D[1] : 4;
    const now = () => { const L = live(); return L && typeof L.time === 'number' ? clamp(L.time, 0, TT) : 0; };

    // --- часы цикла на стойке ---
    const DX = -38, DZ = -24, DY = 21, DR = 15;
    const dial = new T.Group(); at(dial, DX, TY, DZ, g); dial.rotation.y = 0.45; clickable(dial, 'wheel');
    at(box(16, 1.4, 9, 0x2c3240), 0, 0.7, 0, dial);
    at(box(2.2, DY - 2, 2.2, 0x2c3240), 0, (DY - 2) / 2 + 1.4, -1.6, dial);
    const rim = mesh(new T.CylinderGeometry(DR + 1.4, DR + 1.4, 2.2, 64), 0xe8ecf4, { hull: true, edges: false }); rim.rotation.x = Math.PI / 2; at(rim, 0, DY, -0.8, dial);
    const face = h.canvasPlane(DR * 2, DR * 2, 600, 600, (x, w, hh) => {
      const cx = w / 2, cy = hh / 2, r1 = w / 2 - 6, r0 = r1 * 0.58;
      x.fillStyle = '#fff6e6'; x.beginPath(); x.arc(cx, cy, r1 + 4, 0, 7); x.fill();
      let acc = 0;
      for (let k = 0; k < 4; k++) {
        const a0 = acc / TT * Math.PI * 2 - Math.PI / 2, a1 = (acc + D[k]) / TT * Math.PI * 2 - Math.PI / 2;
        x.fillStyle = PCS[k]; x.globalAlpha = d.per === k ? 1 : 0.45;
        x.beginPath(); x.arc(cx, cy, r1, a0, a1); x.arc(cx, cy, r0, a1, a0, true); x.closePath(); x.fill(); x.globalAlpha = 1;
        x.strokeStyle = '#1b1610'; x.lineWidth = 4; x.stroke();
        const am = (a0 + a1) / 2, rr = (r0 + r1) / 2;
        x.fillStyle = '#1b1610'; x.font = `700 ${k === 3 ? 36 : 56}px "IBM Plex Mono", monospace`; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(PN[k], cx + Math.cos(am) * rr, cy + Math.sin(am) * rr + 3);
        acc += D[k];
      }
      for (let t = 0; t < TT; t++) { const a = t / TT * Math.PI * 2 - Math.PI / 2, l = t % 6 ? 10 : 22; x.strokeStyle = '#1b1610'; x.lineWidth = t % 6 ? 2 : 4; x.beginPath(); x.moveTo(cx + Math.cos(a) * (r0 - 4), cy + Math.sin(a) * (r0 - 4)); x.lineTo(cx + Math.cos(a) * (r0 - 4 - l), cy + Math.sin(a) * (r0 - 4 - l)); x.stroke(); }
      x.fillStyle = '#6b5a44'; x.font = '600 30px "Golos Text", sans-serif'; x.fillText(`цикл ${TT} ч`, cx, cy + r0 * 0.45);
    });
    at(face, 0, DY, 0.35, dial);
    const hand = new T.Group(); at(hand, 0, DY, 0.9, dial);
    at(box(0.9, DR * 0.92, 0.5, 0x1b1610, { edges: false }), 0, DR * 0.46, 0, hand);
    const hub = cyl(1.2, 0.8, 0x1b1610, { edges: false }); hub.rotation.x = Math.PI / 2; at(hub, 0, 0, 0, hand);
    h.ball(hand, 0, DR * 0.95, 0.2, 1, 0xe8ecf4, { thin: true });
    tag(v3(DX, TY + DY + DR + 3, DZ), 'Часы цикла', `${PN[d.per]} · ${PFULL[d.per]}`, d.per === 3);

    // --- клетка в чашке Петри (розовая питательная среда) ---
    const PX = -38, PZ = 12, PY = TY + 1.8;
    const dish = new T.Mesh(keep(new T.CylinderGeometry(10, 10, 2.4, 48, 1, true)), h.glassMat(0xe6f4fb, 0.3)); dish.renderOrder = 1; at(dish, PX, TY + 1.2, PZ, g);
    at(cyl(10, 0.3, 0xe6f4fb, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.5 } }), PX, TY + 0.15, PZ, g);
    at(cyl(9.6, 1.3, 0xf2a0b8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.55 } }), PX, TY + 0.95, PZ, g);
    const cellG = new T.Group(); at(cellG, PX, PY, PZ, g);
    const mkCell = () => {
      const c = new T.Group(); cellG.add(c);
      const m = new T.Mesh(keep(new T.SphereGeometry(1, 32, 20)), h.glassMat(MEMB, 0.32)); m.renderOrder = 1; m.add(new T.Mesh(m.geometry, h.hullT)); c.add(m);
      const n = new T.Mesh(keep(new T.SphereGeometry(0.45, 24, 14)), h.glassMat(NUC, 0.55, { depthWrite: false })); c.add(n);
      return { c, m, n };
    };
    const big = mkCell(), twins = [mkCell(), mkCell()];
    const thread = (y) => {
      const pts = []; for (let k = 0; k <= 12; k++) pts.push(v3(-0.32 + k * 0.055, y + Math.sin(k * 1.4) * 0.05, Math.cos(k * 1.4) * 0.05));
      const m = new T.Mesh(keep(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 30, 0.035, 6)), toon(RED)); big.c.add(m); return m;
    };
    thread(0.08); const th2 = thread(-0.08);
    const twinCh = twins.map(tw => { const m = box(0.12, 0.5, 0.12, RED, { edges: false }); at(m, 0, 0, 0, tw.c); const m2 = box(0.12, 0.5, 0.12, BLUE, { edges: false }); at(m2, 0.18, 0, 0, tw.c); return [m, m2]; });
    clickable(cellG, 'graph');
    tag(v3(PX, TY + 16, PZ), 'Клетка', DOING[d.per], d.per === 3);

    // --- монитор: количество ДНК в ядре ---
    const mon = h.monitor(g, 10, -28, 0.12, 34, 17, 760, null, 'graph');
    let lastDrawn = -1;
    const drawGraph = t => {
      mon.scr.userData.draw((x, w, hh) => {
        x.fillStyle = '#0e1520'; x.fillRect(0, 0, w, hh);
        const X0 = 90, X1 = w - 40, Y4 = 90, Y2 = hh - 120, gx = s => X0 + s / TT * (X1 - X0), gy = c => Y2 - (c - 2) / 2 * (Y2 - Y4);
        x.fillStyle = '#e8ecf4'; x.font = '600 30px "Golos Text", sans-serif'; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText('ДНК в ядре', X0, 42);
        x.strokeStyle = '#56627d'; x.lineWidth = 3; x.beginPath(); x.moveTo(X0, Y4 - 30); x.lineTo(X0, Y2 + 10); x.lineTo(X1, Y2 + 10); x.stroke();
        x.fillStyle = '#8b96ad'; x.font = '600 26px "IBM Plex Mono", monospace'; x.textAlign = 'right'; x.fillText('4c', X0 - 12, Y4); x.fillText('2c', X0 - 12, Y2);
        let acc = 0;
        for (let k = 0; k < 4; k++) {
          x.fillStyle = PCS[k]; x.globalAlpha = perAt(t) === k ? 0.95 : 0.4; x.fillRect(gx(acc), Y2 + 22, gx(acc + D[k]) - gx(acc), 16); x.globalAlpha = 1;
          x.fillStyle = '#c9d3e6'; x.textAlign = 'center'; x.font = '600 24px "IBM Plex Mono", monospace'; if (D[k] / TT > 0.06) x.fillText(PN[k], gx(acc + D[k] / 2), Y2 + 62);
          acc += D[k];
        }
        x.strokeStyle = '#ff8a73'; x.lineWidth = 6; x.lineJoin = 'round'; x.beginPath();
        for (let s = 0; s <= 200; s++) { const tt = s / 200 * TT * 0.999, X = gx(tt), Y = gy(cAt(tt)); s ? x.lineTo(X, Y) : x.moveTo(X, Y); }
        x.lineTo(gx(TT), gy(2)); x.stroke();
        const c = cAt(t), px = gx(t), py = gy(c);
        x.strokeStyle = '#e8ecf4'; x.lineWidth = 2; x.beginPath(); x.moveTo(px, Y4 - 30); x.lineTo(px, Y2 + 10); x.stroke();
        x.fillStyle = '#e8ecf4'; x.beginPath(); x.arc(px, py, 10, 0, 7); x.fill();
        x.font = '700 34px "IBM Plex Mono", monospace'; x.textAlign = 'right'; x.fillStyle = '#ffd166';
        x.fillText(`${c.toFixed(1).replace('.', ',')}c · ${t.toFixed(1).replace('.', ',')} ч`, X1, 42);
      });
    };
    tag(v3(10, TY + mon.top + 1, -28), 'Монитор', 'количество ДНК', false);

    // --- коробки периодов ---
    const BZ = 10, BX = k => 2 + k * 17;
    PN.forEach((n, k) => {
      const bg = new T.Group(); at(bg, BX(k), TY, BZ, g); clickable(bg, 'bin-' + k);
      at(box(15.6, 0.8, 21, 0xe9edf2), 0, 0.4, 0, bg);
      at(box(15.6, 3.2, 0.7, PC[k]), 0, 1.6, -10.2, bg); at(box(15.6, 2.2, 0.7, PC[k]), 0, 1.1, 10.2, bg);
      at(box(0.7, 3.2, 20, PC[k]), -7.5, 1.6, 0, bg); at(box(0.7, 3.2, 20, PC[k]), 7.5, 1.6, 0, bg);
      const lb = h.canvasPlane(14.6, 2, 600, 82, (x, w, hh) => h.textLines(x, w, hh, [{ t: `${n} · ${PFULL[k]}`, k: 0.6, mono: false, w: 700 }], '#1b1610', PCS[k]));
      at(lb, 0, 1.1, 10.58, bg);
      if (d.sel >= 0) h.beacon(bg, 0, 0.8, 0, 6.4);
    });
    // --- карточки ---
    const all = d.placed === d.cards.length;
    const cardMesh = (i, c) => {
      const cg = new T.Group(); clickable(cg, 'card-' + i);
      const edge = all ? (c.ok ? 0x3fbf6a : 0xe0473a) : d.sel === i ? YEL : 0x3a4866;
      at(box(13.6, 0.6, 3.6, edge, { edges: false }), 0, 0.3, 0, cg);
      const top = h.canvasPlane(13, 3.1, 560, 134, (x, w, hh) => h.textLines(x, w, hh, [{ t: c.t + (all ? (c.ok ? '  ✓' : '  ✗') : ''), k: 0.5, mono: false, w: 600 }], '#e8ecf4', '#1a2438'));
      top.rotation.x = -Math.PI / 2; at(top, 0, 0.62, 0, cg);
      return cg;
    };
    d.cards.forEach((c, i) => {
      const cg = cardMesh(i, c);
      if (c.b === null || c.b === undefined) {
        const x = -54 + (i % 4) * 15, z = 31 + Math.floor(i / 4) * 5.4;
        at(cg, x, TY, z, g);
        if (d.sel === i) {
          if (kit.reduce) cg.position.y = TY + 2; else kit.onFrame((dt, t) => { cg.position.y = TY + 2 + 0.5 * Math.sin(t * 3); });
          h.beacon(g, x, TY, z, 5);
          tag(v3(x, TY + 5, z), 'Карточка', 'нажмите коробку', true);
        }
      } else {
        const list = d.ord.filter(j => d.cards[j].b === c.b), idx = Math.max(0, list.indexOf(i));
        at(cg, BX(c.b), TY + 0.8 + Math.floor(idx / 5) * 0.7 + (d.sel === i ? 1.6 : 0), BZ - 7.6 + (idx % 5) * 3.9, g);
      }
    });
    tag(v3(-32, TY + 4, 28), 'Карточки-события', all ? `верно ${d.right} из 8` : `разложено ${d.placed} из 8`, all && d.right === 8);
    // --- клавиши ---
    h.key(g, 6, 41, 12, 5.6, [{ t: d.play ? 'Пауза' : 'Пуск', k: 0.62, mono: false, w: 700 }], d.play ? 0xe0473a : 0x3fae5a, 'play', { on: d.play });
    h.key(g, 21, 41, 12, 5.6, [{ t: 'Сбросить', k: 0.6, mono: false, w: 600 }], 0x6b5a44, 'reset');

    // --- каждый кадр: стрелка, клетка, график ---
    const pose = () => {
      const t = now(), per = perAt(t), c = cAt(t);
      hand.rotation.z = -t / TT * Math.PI * 2;
      if (per === 3) {
        const k = (t - (TT - D[3])) / D[3];
        big.c.visible = false;
        twins.forEach((tw, s) => { tw.c.visible = true; tw.c.scale.setScalar(4.4); tw.c.position.set((s ? 1 : -1) * (3.3 + 1.6 * k), 4.4, 0); });
        twinCh.forEach(pr => pr.forEach(m => { m.visible = true; }));
      } else {
        const gg = clamp(t / (TT - D[3]), 0, 1), r = 4 + 2.6 * gg;
        big.c.visible = true; big.c.scale.setScalar(r); big.c.position.set(0, r, 0);
        twins.forEach(tw => { tw.c.visible = false; });
        th2.visible = c > 2.05; th2.scale.setScalar(clamp((c - 2) / 2, 0.15, 1));
      }
      if (Math.abs(t - lastDrawn) > 0.04) { lastDrawn = t; drawGraph(t); }
    };
    pose(); drawGraph(now());
    kit.onFrame(pose);

  };
})();
