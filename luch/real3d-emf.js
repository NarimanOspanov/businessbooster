// «Как в жизни» для темы «Закон Ома для полной цепи» (labs/phys-emf): источник (батарейка AA, батарея 3 × AA,
// ячейка Li-ion, автомобильный аккумулятор), ключ, лампа, вольтметр и амперметр, реостат с графиком U(I) на подставке,
// предохранитель и перемычка короткого замыкания, держатель с элементами s × p и колонка.
// Сцены строятся из window.LUCH_REAL() опыта; набор деталей kit — из /luch/real3d.js.
(() => {
  const SC = (window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {});
  const PI = Math.PI;
  const fmt = (x, n = 1) => (Math.round(x * 10 ** n) / 10 ** n).toFixed(n).replace('.', ',');
  const fI = I => I >= 100 ? fmt(I, 0) : I >= 10 ? fmt(I, 1) : fmt(I, 2);
  const GREEN = 0x6ccf4f, GOLD = 0xf2c94c, BLUE = 0x2f6fd8, OLD = 0x7d8a52, COPPER = 0xd98a4e;

  // перекрасить детали готовой модели (материалы общие, поэтому меняем материал у нужных сеток)
  function recolor(kit, g, from, to) { g.traverse(o => { if (o.isMesh && o.material && o.material.color && !o.material.transparent && o.material.color.getHex() === from) o.material = kit.toon(to); }); }
  function plate(kit, txt, w, h, fg = '#1b1610', bg = '#f7f3ea') {
    const { T, keep } = kit;
    return new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: kit.textTex(txt, fg, bg, Math.round(64 * w / h), 64) })));
  }
  // цвет провода, нагретого током короткого замыкания: серо-синий → красный → жёлто-белый
  function heatHex(kit, base, h) {
    const T = kit.T; if (!(h > 0.02)) return base;
    const c = new T.Color(base);
    return h < 0.7 ? c.lerp(new T.Color(0xff5a2a), h / 0.7).getHex() : new T.Color(0xff5a2a).lerp(new T.Color(0xffecaa), (h - 0.7) / 0.3).getHex();
  }

  // ---------- источники ----------
  function source(kit, kind, E) {
    const { T, at, box, cyl, C } = kit;
    if (kind === 'car') {
      const g = new T.Group();
      at(box(34, 17, 18, 0x2c3240), 0, 8.5, 0, g);
      at(box(34.6, 2.4, 18.6, 0x3a4762), 0, 17.6, 0, g);
      for (let k = 0; k < 6; k++) at(cyl(1.2, 0.6, 0x5d6677, { seg: 12 }), -12.5 + k * 5, 19.1, -4.5, g);
      at(cyl(1.7, 3, 0x2a2f3a), -12, 20.3, 4, g); at(cyl(1.7, 3, 0xe0473a), 12, 20.3, 4, g);
      at(plate(kit, '12 В', 14, 5, '#e8ecf4', '#2c3240'), 0, 9, 9.05, g);
      return { g, len: 36, tin: new T.Vector3(-12, 22, 4), tout: new T.Vector3(12, 22, 4), top: 23 };
    }
    const p = kit.cells(kind === 'aa3' ? 3 : 1, E);
    if (kind === 'li') { recolor(kit, p.g, GREEN, BLUE); recolor(kit, p.g, GOLD, 0x9aa3b2); }
    if (kind === 'old') recolor(kit, p.g, GREEN, OLD);
    void C;
    return p;
  }
  const place = (kit, part, x, z, rot, id) => kit.placeOn(part, kit.v3(x, 0, z), rot, id);

  // ===== урок 1: ЭДС — источник, ключ, лампа, вольтметр прямо на выводах =====
  SC['emf-src'] = (kit, d) => {
    const { v3, cable, tag, C } = kit, W = C.WIRE, I = d.sw ? d.I : 0;
    const src = source(kit, d.src, d.E); src.g.userData.click = 'src';
    const sN = place(kit, src, -4, -26, 0, 'src');
    const kn = place(kit, kit.knife({ closed: d.sw, click: 'sw' }), 46, -2, -PI / 2, 'sw');
    const bl = place(kit, kit.bulb({ glow: d.glow }), 12, 30, PI, 'bulb');
    const vm = place(kit, kit.meter({ kind: 'V', val: d.U, max: 5, click: 'rec' }), -30, 34, 0.35, 'vm');
    cable(sN.tout, kn.tin, W.plus, I); cable(kn.tout, bl.tin, W.mid, I); cable(bl.tout, sN.tin, W.minus, I);
    cable(vm.tin, sN.tout, W.probeR, 0, { r: 0.6, lift: 6, arch: 1 }); cable(vm.tout, sN.tin, W.probeB, 0, { r: 0.6, lift: 6, arch: 1 });
    tag(sN.tagAt, d.name, 'на корпусе ' + d.nom);
    tag(kn.tagAt, 'Ключ', d.sw ? 'замкнут' : 'разомкнут');
    tag(bl.tagAt, 'Лампа 6 Ом', d.sw ? 'I = ' + fmt(d.I, 2) + ' А' : 'не горит');
    tag(vm.tagAt, 'Вольтметр', fmt(d.U, 2) + ' В', !d.sw);
  };

  // ===== урок 2: полная цепь — батарея, ключ, амперметр, реостат, вольтметр, график U(I) на подставке =====
  function graphTex(kit, pts, solved) {
    const c = document.createElement('canvas'); c.width = 320; c.height = 256; const x = c.getContext('2d');
    x.fillStyle = '#f7f3ea'; x.fillRect(0, 0, 320, 256); x.strokeStyle = '#1b1610'; x.lineWidth = 6; x.strokeRect(3, 3, 314, 250);
    const gx = 46, gy = 212, gw = 250, gh = 176, X = i => gx + gw * i / 3, Y = u => gy - gh * u / 5;
    x.strokeStyle = '#d8cfbd'; x.lineWidth = 1.5;
    for (let i = 0; i <= 3; i++) { x.beginPath(); x.moveTo(X(i), gy); x.lineTo(X(i), gy - gh); x.stroke(); }
    for (let u = 0; u <= 5; u++) { x.beginPath(); x.moveTo(gx, Y(u)); x.lineTo(gx + gw, Y(u)); x.stroke(); }
    x.strokeStyle = '#1b1610'; x.lineWidth = 3; x.beginPath(); x.moveTo(gx, gy - gh - 6); x.lineTo(gx, gy); x.lineTo(gx + gw + 6, gy); x.stroke();
    x.fillStyle = '#1b1610'; x.font = '600 18px "IBM Plex Mono", monospace'; x.textAlign = 'center';
    for (let i = 0; i <= 3; i++) x.fillText(String(i), X(i), gy + 22);
    x.textAlign = 'right'; for (let u = 1; u <= 5; u++) x.fillText(String(u), gx - 8, Y(u) + 6);
    x.textAlign = 'left'; x.fillText('U, В', gx + 6, 24); x.textAlign = 'right'; x.fillText('I, А', gx + gw, gy - 10);
    if (pts.length >= 2) {
      const n = pts.length, sx = pts.reduce((a, p) => a + p[0], 0), sy = pts.reduce((a, p) => a + p[1], 0), sxx = pts.reduce((a, p) => a + p[0] * p[0], 0), sxy = pts.reduce((a, p) => a + p[0] * p[1], 0), dd = n * sxx - sx * sx;
      if (Math.abs(dd) > 1e-9) {
        const b = (n * sxy - sx * sy) / dd, a = (sy - b * sx) / n;
        if (b < 0) { const i1 = Math.min(3, -a / b); x.strokeStyle = '#e8962a'; x.lineWidth = 3; x.setLineDash(n >= 4 ? [] : [10, 8]); x.beginPath(); x.moveTo(X(0), Y(Math.min(5, a))); x.lineTo(X(i1), Y(a + b * i1)); x.stroke(); x.setLineDash([]); }
      }
    }
    x.fillStyle = '#2b6fd8'; pts.forEach(p => { x.beginPath(); x.arc(X(p[0]), Y(p[1]), 7, 0, 7); x.fill(); });
    if (solved) { x.fillStyle = '#2e9e4f'; x.textAlign = 'left'; x.fillText('ℰ = 4,5 В  r = 1,5 Ом', gx + 50, 46); }
    const t = new kit.T.CanvasTexture(c); t.colorSpace = kit.T.SRGBColorSpace; return kit.keep(t);
  }
  SC['emf-ohm'] = (kit, d) => {
    const { T, v3, at, box, cable, tag, clickable, keep, C } = kit, W = C.WIRE, I = d.sw ? d.I : 0;
    const src = source(kit, 'aa3', 4.5); src.g.userData.click = 'src';
    const sN = place(kit, src, -6, -26, 0, 'src');
    const kn = place(kit, kit.knife({ closed: d.sw, click: 'sw' }), 46, -22, -PI / 2, 'sw');
    const am = place(kit, kit.meter({ kind: 'A', val: d.I, max: 3 }), 46, 8, -PI / 2, 'am');
    const rh = place(kit, kit.rheostat({ f: d.f, click: 'rh' }), 8, 32, PI, 'rh');
    const vm = place(kit, kit.meter({ kind: 'V', val: d.U, max: 5 }), -24, 10, 0.35, 'vm');
    cable(sN.tout, kn.tin, W.plus, I); cable(kn.tout, am.tin, W.mid, I); cable(am.tout, rh.tin, W.mid, I); cable(rh.tout, sN.tin, W.minus, I);
    cable(vm.tin, sN.tout, W.probeR, 0, { r: 0.6, lift: 6, arch: 1 }); cable(vm.tout, sN.tin, W.probeB, 0, { r: 0.6, lift: 6, arch: 1 });
    // график на подставке: нажатие — записать точку
    const gb = new T.Group(); at(gb, -38, 0, 38); gb.rotation.y = 0.45; clickable(gb, 'rec');
    at(box(14, 1.4, 6, C.WOOD2), 0, 0.7, 0, gb); at(box(1.6, 16, 1.6, C.WOOD2), 0, 8, -1.6, gb);
    at(box(27, 21.6, 1, C.DARK), 0, 20, -0.6, gb);
    const pl = new T.Mesh(keep(new T.PlaneGeometry(25, 20)), keep(new T.MeshBasicMaterial({ map: graphTex(kit, d.pts || [], d.solved) })));
    at(pl, 0, 20, -0.05, gb);
    tag(sN.tagAt, 'Батарея', d.solved ? 'ℰ = 4,5 В · r = 1,5 Ом' : 'ℰ = ? · r = ?');
    tag(kn.tagAt, 'Ключ', d.sw ? 'замкнут' : 'разомкнут');
    tag(am.tagAt, 'Амперметр', fmt(d.I, 2) + ' А');
    tag(rh.tagAt, 'Реостат', 'R = ' + fmt(d.R, 1) + ' Ом');
    tag(vm.tagAt, 'Вольтметр', fmt(d.U, 2) + ' В');
    tag(v3(-38, 30.5, 40), 'График U(I)', (d.pts || []).length + ' точ. · нажмите — записать');
  };

  // ===== урок 3: короткое замыкание — предохранитель, перемычка, раскалённые провода =====
  function fuse(kit, d) {
    const { T, at, box, cyl, keep, baseBlock, post, C } = kit, g = new T.Group(), y0 = baseBlock(g, 24, 10);
    const tin = post(g, -9, 0, y0), tout = post(g, 9, 0, y0), yc = y0 + 4.4;
    if (d.fuse) {
      at(box(1.4, 4.6, 3.2, C.BRASS), -6.2, y0 + 2.3, 0, g); at(box(1.4, 4.6, 3.2, C.BRASS), 6.2, y0 + 2.3, 0, g);
      [-5.4, 5.4].forEach(x => { const cap = cyl(1.75, 1.8, C.STEEL, { seg: 18 }); cap.rotation.z = PI / 2; at(cap, x, yc, 0, g); });
      const glass = new T.Mesh(keep(new T.CylinderGeometry(1.6, 1.6, 9.2, 20, 1, true)), keep(new T.MeshToonMaterial({ color: 0xcfe6f2, gradientMap: kit.grad, transparent: true, opacity: 0.32, depthWrite: false, side: T.DoubleSide })));
      glass.rotation.z = PI / 2; at(glass, 0, yc, 0, g);
      if (!d.blown) { const w = cyl(0.14, 9.2, 0xe8ecf4, { edges: false, hull: false, seg: 6 }); w.rotation.z = PI / 2; at(w, 0, yc, 0, g); }
      else {
        [-3.2, 3.2].forEach(x => { const w = cyl(0.14, 3, 0xe8ecf4, { edges: false, hull: false, seg: 6 }); w.rotation.z = PI / 2; at(w, x, yc, 0, g); });
        at(new T.Mesh(keep(new T.SphereGeometry(1.3, 14, 10)), kit.toon(0x3a3a3a)), 0, yc, 0, g);
      }
    } else {
      at(box(19, 1.1, 2.2, COPPER), 0, y0 + 3.6, 0, g);
    }
    g.userData.click = 'fuse';
    return { g, len: 26, tin, tout, top: y0 + 8 };
  }
  SC['emf-short'] = (kit, d) => {
    const { T, v3, at, box, cable, tag, clickable, C } = kit, W = C.WIRE, I = d.I || 0, h = d.heat || 0;
    const col = base => heatHex(kit, base, h);
    const src = source(kit, d.src, d.E); src.g.userData.click = 'src';
    const sN = place(kit, src, -6, -28, 0, 'src');
    const fz = place(kit, fuse(kit, d), 46, -14, -PI / 2, 'fuse');
    const am = place(kit, kit.meter({ kind: 'A', val: Math.min(I, 5.4), max: 5, over: I > 3 }), 46, 14, -PI / 2, 'am');
    const bl = place(kit, kit.bulb({ glow: d.glow }), 8, 34, PI, 'bulb');
    const kn = place(kit, kit.knife({ closed: d.sw, click: 'sw' }), -46, 22, PI / 2, 'sw');
    cable(sN.tout, fz.tin, col(W.plus), I); cable(fz.tout, am.tin, col(W.mid), I); cable(am.tout, bl.tin, col(W.mid), I);
    cable(bl.tout, kn.tin, col(W.mid), I); cable(kn.tout, sN.tin, col(W.minus), I);
    // перемычка: на выводах лампы или лежит рядом на столе
    if (d.jump) {
      cable(bl.tin, bl.tout, col(COPPER), I, { lift: 7, arch: 1, r: 1.1 });
      const clip = new T.Group(); at(clip, (bl.tin.x + bl.tout.x) / 2, 0, bl.tin.z + 1); at(box(4, 2.4, 2.4, 0xe0473a), 0, 9, 0, clip); clickable(clip, 'jump');
      if (h > 0.5 && !kit.reduce) {
        const sp = [];
        for (let k = 0; k < 5; k++) { const s = new T.Sprite(new T.SpriteMaterial({ map: kit.glowTex(), color: 0xffc860, transparent: true, blending: T.AdditiveBlending, depthWrite: false })); at(s, bl.tin.x, bl.tin.y + 1, bl.tin.z); sp.push(s); }
        kit.onFrame((dt, t) => sp.forEach((s, k) => { const a = t * 9 + k * 1.3, r = 1.5 + 3 * Math.abs(Math.sin(t * 7 + k)); s.position.set(bl.tin.x + Math.cos(a) * r, bl.tin.y + 1 + Math.abs(Math.sin(a * 1.7)) * 4, bl.tin.z + Math.sin(a) * r); s.scale.setScalar(2 + 3 * Math.abs(Math.sin(t * 13 + k))); }));
      }
    } else {
      const jg = new T.Group(); at(jg, 34, 0, 44); jg.rotation.y = 0.3; clickable(jg, 'jump');
      at(box(3.6, 2, 2, 0xe0473a), -6, 1, 0, jg); at(box(3.6, 2, 2, 0xe0473a), 6, 1, 0, jg);
      const wv = kit.cyl(0.8, 10, COPPER, { edges: false }); wv.rotation.z = PI / 2; at(wv, 0, 1, 0, jg);
      tag(v3(34, 6, 44), 'Перемычка', 'нажмите — замкнуть');
    }
    tag(sN.tagAt, d.name, 'ℰ = ' + fmt(d.E, 1) + ' В · r = ' + fmt(d.r, 2) + ' Ом');
    tag(fz.tagAt, d.fuse ? 'Предохранитель 3 А' : 'Без предохранителя', d.fuse ? (d.blown ? 'перегорел — заменить' : 'цел') : 'медная перемычка', d.blown || !d.fuse);
    tag(am.tagAt, 'Амперметр', fI(I) + ' А', I > 3);
    tag(bl.tagAt, d.lampN, d.jump && I > 0 ? 'Iкз = ' + fI(I) + ' А' : d.glow > 0.02 ? 'горит' : 'не горит', d.jump && I > 0);
    tag(kn.tagAt, 'Ключ', d.sw ? 'замкнут' : 'разомкнут');
  };

  // ===== урок 4: держатель s × p элементов и колонка =====
  SC['emf-pack'] = (kit, d) => {
    const { T, v3, at, box, cyl, cable, tag, clickable, post, C } = kit, W = C.WIRE, li = d.cell === 'li';
    const s = d.s, p = d.p, Lc = 14, px = 16, pz = 9, R = li ? 2.9 : 2.5, body = li ? BLUE : GREEN, band = li ? 0x9aa3b2 : GOLD;
    const hg = new T.Group(); at(hg, -18, 0, -6); clickable(hg, 'type');
    const xL = -s * px / 2 - 3, xR = s * px / 2 + 3, zF = (p - 1) * pz / 2 + 6, zB = -(p - 1) * pz / 2 - 6;
    at(box(xR - xL + 8, 1.6, zF - zB + 4, 0x3a3f4c), 0, 0.8, (zF + zB) / 2, hg);
    const yc = 1.6 + R + 0.2;
    for (let j = 0; j < p; j++) {
      const z = (j - (p - 1) / 2) * pz;
      for (let i = 0; i < s; i++) {
        const x = -s * px / 2 + px / 2 + i * px, c = new T.Group(); at(c, x, yc, z, hg);
        const b = cyl(R, Lc - 2.2, body); b.rotation.z = PI / 2; at(b, -0.6, 0, 0, c);
        const bd = cyl(R + 0.05, 2.6, band, { edges: false }); bd.rotation.z = PI / 2; at(bd, Lc / 2 - 3.6, 0, 0, c);
        const nip = cyl(1, 1, C.STEEL); nip.rotation.z = PI / 2; at(nip, Lc / 2 - 0.2, 0, 0, c);
        if (i + 1 < s) at(box(2.6, 0.6, 2.6, C.STEEL, { edges: false }), px / 2, 0, 0, c);
      }
      at(box(2.4, 1.2, 2.4, C.STEEL, { edges: false }), xL + 1.6, yc, z, hg); at(box(2.4, 1.2, 2.4, C.STEEL, { edges: false }), xR - 1.6, yc, z, hg);
    }
    // шины: «−» слева (синяя), «+» справа (красная)
    at(box(1.4, 2 * R + 1, zF - zB, 0x2f6fd8), xL, yc, (zF + zB) / 2, hg); at(box(1.4, 2 * R + 1, zF - zB, 0xe0473a), xR, yc, (zF + zB) / 2, hg);
    const tm = post(hg, xL, zF + 1.5, 1.6, 0x2f6fd8), tp = post(hg, xR, zF + 1.5, 1.6, 0xe0473a);
    hg.updateMatrixWorld(true);
    const pM = tm.clone().applyMatrix4(hg.matrixWorld), pP = tp.clone().applyMatrix4(hg.matrixWorld);
    // колонка
    const dg = new T.Group(); at(dg, 44, 0, -6); dg.rotation.y = -0.35; clickable(dg, 'on');
    at(box(20, 28, 13, 0x2c3240), 0, 14, 0, dg); at(box(20.4, 1.2, 13.4, 0x3a4762), 0, 28.4, 0, dg);
    const cones = [];
    [[19.5, 4.2], [9, 6.2]].forEach(([y, r]) => { const cg = new T.Group(); at(cg, 0, y, 6.55, dg); const ring = cyl(r, 0.6, 0x5d6677, { seg: 32 }); ring.rotation.x = PI / 2; at(ring, 0, 0, 0, cg); const cone = cyl(r * 0.45, 0.8, 0x1b1f28, { seg: 24 }); cone.rotation.x = PI / 2; at(cone, 0, 0, 0.3, cg); cones.push(cg); });
    at(box(1.4, 1.4, 0.4, d.on ? 0x86e0a8 : 0x3a4762, { edges: false, matOpt: d.on ? { emissive: 0x3fe08a, emissiveIntensity: 1 } : {} }), 7, 25.5, 6.6, dg);
    const dIn = post(dg, -4, -3, 29), dOut = post(dg, 4, -3, 29);
    dg.updateMatrixWorld(true);
    const qIn = dIn.clone().applyMatrix4(dg.matrixWorld), qOut = dOut.clone().applyMatrix4(dg.matrixWorld);
    if (d.on && !kit.reduce) kit.onFrame((dt, t) => cones.forEach((c, k) => { const sc = 1 + 0.07 * Math.sin(t * (k ? 21 : 34)); c.scale.set(sc, sc, 1); }));
    const kn = place(kit, kit.knife({ closed: d.on, click: 'on' }), 20, 32, 0, 'sw');
    const I = d.on ? 1.5 : 0;
    cable(pP, kn.tin, W.plus, I, { lift: 4 }); cable(kn.tout, qIn, W.mid, I, { lift: 4 }); cable(qOut, pM, W.minus, I, { lift: 4, arch: 1 });
    tag(v3(-18, yc * 2 + 6, -6), `Батарея ${s}S${p}P · ${s * p} × ${li ? 'Li-ion' : 'AA'}`, `${fmt(d.E, 1)} В · ${d.C} мА·ч · ${fmt(d.W, 1)} Вт·ч`, d.ok);
    tag(v3(44, 33, -6), 'Колонка', d.on ? `играет ${fmt(d.t, 1)} ч` : '6,5–8,5 В · 1,5 А · ≥ 4 ч', d.on);
    tag(kn.tagAt, 'Ключ', d.on ? 'включено' : 'выключено');
  };
})();
