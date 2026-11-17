// «Как в жизни» для темы «Силы Ампера и Лоренца» (labs/phys-lorentz): рельсы со стержнем между полюсами магнита,
// трубка с электронным лучом в катушках Гельмгольца, масс-спектрометр с фотопластинкой, намагниченный глобус
// (террелла) с линиями поля и кольцами сияний. Сцены строятся из window.LUCH_REAL() опыта; плавное движение
// (стержень, электроны, ионы, частицы ветра, свечение) — из window.LUCH_REAL.live() каждый кадр. Набор деталей kit — из /luch/real3d.js.
(() => {
  const SC = (window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {});
  const RED = 0xe0473a, BLUE = 0x2f6fd8, COPPER = 0xd98a4e, IRON = 0x5d6a86, ALU = 0xd5dbe4, ORANGE = 0xffb547, BEAM = 0x9effe0, ION = 0xd68cff, AUR = 0x7dff9b;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const fmt = (x, n = 1) => (Math.round(x * 10 ** n) / 10 ** n).toFixed(n).replace('.', ',');
  const live = () => { try { return (window.LUCH_REAL && window.LUCH_REAL.live && window.LUCH_REAL.live()) || {}; } catch (e) { return {}; } };
  const lastTag = () => { const l = document.querySelectorAll('.rl-view .rl-lbl'); return l[l.length - 1] || null; };
  function liveTag(kit, p, name, value, hot) {
    kit.tag(p, name, value, hot);
    const el = lastTag(), i = el && el.querySelector('i');
    let shown = value;
    return { set(v) { if (i && v !== shown) { shown = v; i.textContent = v; } } };
  }
  function letter(kit, txt, fg, bg, size) {
    const { T, keep } = kit;
    return new T.Mesh(keep(new T.PlaneGeometry(size, size)), keep(new T.MeshBasicMaterial({ map: keep(kit.textTex(txt, fg, bg, 128, 128)) })));
  }
  // стрелка-сила: стержень + конус, смотрит по +y
  function arrow(kit, len, col, r = 0.45) {
    const { T, at, cyl } = kit, g = new T.Group(), o = { edges: false, matOpt: { emissive: col, emissiveIntensity: 0.35 } };
    at(cyl(r, len, col, o), 0, len / 2, 0, g);
    at(cyl(r * 2.6, r * 5.5, col, { ...o, r2: 0.01 }), 0, len + r * 2.75, 0, g);
    return g;
  }
  function glow(kit, col, size, op = 0.8) {
    const { T } = kit;
    const s = new T.Sprite(kit.keep(new T.SpriteMaterial({ map: kit.glowTex(), color: col, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: op })));
    s.scale.setScalar(size); return s;
  }
  // светящийся луч по точкам: тонкая яркая нить и широкое мягкое свечение
  function glowLine(kit, pts, col, r = 0.35, op = 1) {
    const { T, keep } = kit;
    if (pts.length < 2) return null;
    const curve = new T.CatmullRomCurve3(pts), n = Math.max(8, pts.length * 2);
    const core = new T.Mesh(keep(new T.TubeGeometry(curve, n, r, 6)), keep(new T.MeshBasicMaterial({ color: col, transparent: op < 1, opacity: op })));
    const halo = new T.Mesh(keep(new T.TubeGeometry(curve, n, r * 2.8, 8)), keep(new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22 * op, blending: T.AdditiveBlending, depthWrite: false })));
    kit.root.add(core); kit.root.add(halo);
    return curve;
  }
  function canvasTex(kit, w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    draw(x, w, h);
    const t = new kit.T.CanvasTexture(c); t.colorSpace = kit.T.SRGBColorSpace; t.anisotropy = 4; return kit.keep(t);
  }
  // по кривой бегут огоньки (электроны, ионы)
  function runners(kit, curve, n, col, speed, r = 0.45, getOn) {
    const { T, keep } = kit, geo = keep(new T.SphereGeometry(r, 10, 8)), mat = keep(new T.MeshBasicMaterial({ color: col }));
    const ds = []; for (let i = 0; i < n; i++) { const m = new T.Mesh(geo, mat); kit.root.add(m); ds.push(m); }
    let u0 = 0;
    const place = () => { const on = getOn ? getOn() : true; ds.forEach((m, i) => { m.visible = on; if (on) m.position.copy(curve.getPointAt((u0 + i / n) % 1)); }); };
    place();
    kit.onFrame(dt => { if (!kit.reduce) u0 = (u0 + speed * dt) % 1; place(); });
  }

  // =====================================================================================
  // 1. Сила Ампера: рельсы между полюсами подковообразного магнита, стержень катится
  SC['lorentz-ampere'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, v3, supply, knife, placeOn, cable, C } = kit;
    const K = 2, ZB = -10, ZF = 10, YR = 10;          // 1 см = 2 единицы; задний рельс — верхний на схеме
    at(box(86, 2.4, 46, C.WOOD2), 0, 1.2, -2);
    // магнит: нижний полюс под рельсами, верхний над ними, ярмо сзади
    const topN = d.pol > 0, mg = new T.Group(); at(mg, 0, 0, -2); clickable(mg, 'mag');
    at(box(54, 4, 30, topN ? BLUE : RED), 0, 4.4, 0, mg);
    at(box(54, 4, 30, topN ? RED : BLUE, { matOpt: { transparent: true, opacity: 0.45, depthWrite: false } }), 0, 21, 0, mg);
    at(box(54, 20.6, 5, IRON), 0, 12.7, -17.5, mg);
    const lt = (t, y, col) => { const l = letter(kit, t, '#ffffff', col, 3.4); at(l, -22, y, 15.03, mg); };
    lt(topN ? 'N' : 'S', 21, topN ? '#e0473a' : '#2f6fd8'); lt(topN ? 'S' : 'N', 4.4, topN ? '#2f6fd8' : '#e0473a');
    // рельсы на изолирующих стойках
    [ZB, ZF].forEach(z => {
      at(box(66, 1.2, 1.6, COPPER), 0, YR - 0.6, z);
      [-34, 34].forEach(x => at(box(2.4, YR - 3, 2.4, 0x3a3f4c), x, 2.4 + (YR - 3) / 2 - 0.6, z));
    });
    // стержень (алюминиевая трубка) — едет вместе с опытом
    const rod = new T.Group(); at(rod, 0, YR + 1.1, 0); clickable(rod, 'back');
    const rc = cyl(1.1, 27, ALU, { seg: 20 }); rc.rotation.x = Math.PI / 2; at(rc, 0, 0, 0, rod);
    const fArr = arrow(kit, 3 + Math.min(14, d.F * 250), ORANGE, 0.5); fArr.rotation.z = -Math.PI / 2 * (d.dirI * d.pol); at(fArr, 0, 3.4, 0, rod);
    const iArr = arrow(kit, 8, 0xffd166, 0.32); iArr.rotation.x = d.dirI > 0 ? Math.PI / 2 : -Math.PI / 2; at(iArr, 0, 1.6, d.dirI > 0 ? -4 : 4, rod);
    // источник и ключ; «+» идёт к тому рельсу, откуда ток входит в стержень
    const src = supply(d.I, 'А'); src.g.userData.click = 'flip';
    const sN = placeOn(src, v3(-52, 0, 40), 0, 'src');
    const kN = placeOn(knife({ closed: d.on, click: 'key' }), v3(-20, 0, 44), 0, 'key');
    const pB = v3(-33, YR + 0.4, ZB - 2), pF = v3(-33, YR + 0.4, ZF - 2);
    const inR = d.dirI > 0 ? pB : pF, outR = d.dirI > 0 ? pF : pB, I = d.on ? d.I : 0;
    cable(sN.tout, kN.tin, C.WIRE.plus, I);
    cable(kN.tout, inR, C.WIRE.mid, I, { lift: 4 });
    cable(outR, sN.tin, C.WIRE.minus, I, { lift: 4 });
    tag(v3(-22, 25, -18), 'Магнит', `B = ${fmt(d.B, 2)} Тл · α = ${d.al}°`);
    tag(v3(-52, 23, 40), 'Источник', `I = ${fmt(d.I, 1)} А`);
    tag(v3(-20, 11, 44), 'Ключ', d.on ? 'замкнут' : 'разомкнут');
    const tp = v3(0, YR + 7, 10), tg = liveTag(kit, tp, 'Стержень', 'x = 15 см', d.F > 0);
    let acc = 1;
    const pose = dt => {
      const L = live(), x = typeof L.x === 'number' ? L.x : 15;
      rod.position.x = -30 + x * K; tp.x = rod.position.x;
      fArr.visible = !!L.on && d.F > 0; iArr.visible = !!L.on;
      acc += dt;
      if (acc > 0.2) { acc = 0; tg.set(`x = ${fmt(x, 1)} см${L.on && d.F > 0 ? ' · F = ' + fmt(d.F, 3) + ' Н' : ''}`); }
    };
    pose(1);
    kit.onFrame(dt => pose(dt));
  };

  // =====================================================================================
  // 2. Сила Лоренца: стеклянная трубка с электронным лучом между катушками Гельмгольца
  SC['lorentz-tube'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, v3, supply, placeOn, cable, C } = kit;
    const Y0 = 34, RG = 14, k = RG / 8;               // трубка Ø 16 см: 1 см = 1,75 единицы
    at(box(40, 3, 24, C.DARK), 0, 1.5, 0);
    // катушки: ось вдоль z (к зрителю) — луч поперёк поля; повёрнуты на 90° — луч вдоль поля
    const cg = new T.Group(); at(cg, 0, Y0, 0); clickable(cg, 'bflip');
    if (d.al === 0) cg.rotation.y = Math.PI / 2;
    [-12, 12].forEach(z => {
      const ring = mesh(new T.TorusGeometry(25, 2, 12, 64), 0xb8743f, { edges: false, hull: true }); at(ring, 0, 0, z, cg);
      at(box(3, 8, 3, C.DARK), 0, -27.5, z, cg);
    });
    if (d.Ic > 0) for (let i = 0; i < 6; i++) {   // направление тока в ближней катушке
      const a = i / 6 * Math.PI * 2, ar = arrow(kit, 1.8, 0xffd166, 0.35);
      ar.position.set(25 * Math.cos(a), 25 * Math.sin(a), 14.6); ar.rotation.z = a + (d.bdir > 0 ? 0 : Math.PI); cg.add(ar);
    }
    // стрелки поля B внутри (вдоль оси катушек)
    if (d.Ic > 0) [-1, 1].forEach(s => { const b = arrow(kit, 7, 0x72d4e8, 0.3); b.rotation.x = d.bdir > 0 ? Math.PI / 2 : -Math.PI / 2; at(b, 0, s * 18, d.bdir > 0 ? -4 : 4, cg); });
    // колба на подставке
    at(cyl(4, 6, C.DARK, { r2: 2.6 }), 0, Y0 - RG - 2, 0);
    const glass = new T.Mesh(keep(new T.SphereGeometry(RG, 40, 28)), keep(new T.MeshToonMaterial({ color: 0xcfe6f2, gradientMap: kit.grad, transparent: true, opacity: 0.18, depthWrite: false })));
    at(glass, 0, Y0, 0);
    const rim = mesh(new T.TorusGeometry(RG, 0.12, 6, 64), 0x9fc3d8, { edges: false, hull: false }); at(rim, 0, Y0, 0);
    // электронная пушка слева внутри колбы
    const gx = -RG * 70 / 120;
    const gun = cyl(0.9, 5, 0x7d8799, { seg: 14 }); gun.rotation.z = Math.PI / 2; at(gun, gx - 2.5, Y0, 0);
    const neck = cyl(1.6, 9, 0xcfe6f2, { matOpt: { transparent: true, opacity: 0.35, depthWrite: false } }); neck.rotation.z = Math.PI / 2; at(neck, -RG - 3, Y0, 0);
    // луч: дуга радиусом r в плоскости колбы, обрезается стеклом
    const pts = [v3(gx, Y0, 0)], rin = RG - 0.6;
    let hit = null;
    if (d.r > 0 && d.s) {
      const r = d.r * k, st = Math.min(0.05, 0.6 / r);
      for (let f = st; f < 2 * Math.PI - 0.32; f += st) {
        const p = v3(gx + r * Math.sin(f), Y0 + d.s * r * (1 - Math.cos(f)), 0);
        if (Math.hypot(p.x, p.y - Y0) > rin) { hit = p; pts.push(p); break; }
        pts.push(p);
      }
    } else { hit = v3(Math.sqrt(rin * rin), Y0, 0); for (let i = 1; i <= 10; i++) pts.push(v3(gx + (hit.x - gx) * i / 10, Y0, 0)); }
    const curve = glowLine(kit, pts, BEAM, 0.3);
    if (hit) { const g = glow(kit, 0x5cf2c9, 7, 0.9); at(g, hit.x, hit.y, hit.z); }
    if (curve) runners(kit, curve, 5, 0xe8fbff, 0.45, 0.42);
    // блоки питания: ток катушек и напряжение пушки
    const sC = supply(d.Ic, 'А'); sC.g.userData.click = 'icycle'; const nC = placeOn(sC, v3(-48, 0, 20), 0.4, 'coil');
    const sU = supply(d.U, 'В'); sU.g.userData.click = 'ucycle'; const nU = placeOn(sU, v3(48, 0, 20), -0.4, 'anode');
    cable(nC.tout, v3(-6, 3, 12), C.WIRE.plus, d.Ic, { lift: 5 }); cable(v3(6, 3, 12), nC.tin, C.WIRE.minus, d.Ic, { lift: 5 });
    cable(nU.tout, v3(-RG - 7, Y0 - 1, 0), C.WIRE.plus, 0, { lift: 3, r: 0.6 });
    tag(v3(0, Y0 + 30, 0), 'Катушки', d.Ic > 0 ? `B = ${fmt(d.B, 2)} мТл ${d.bdir > 0 ? '· к нам' : '· от нас'}` : 'тока нет');
    tag(v3(0, Y0 + RG + 3, 0), 'Луч', d.r > 0 && d.s ? `r = ${fmt(d.r, 1)} см · ${d.s > 0 ? 'вверх' : 'вниз'}` : 'прямой', d.r > 0 && d.s);
    tag(v3(-48, 23, 20), 'Ток катушек', fmt(d.Ic, 2) + ' А');
    tag(v3(48, 23, 20), 'Пушка', 'U = ' + d.U + ' В');
  };

  // =====================================================================================
  // 3. Масс-спектрометр: электромагнит, плоская вакуумная камера, источник ионов, фотопластинка
  SC['lorentz-spec'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, v3, supply, placeOn, cable, C } = kit;
    const k = 1.5, EX = -27, ZP = 16, YB = 13;        // 1 см = 1,5 единицы; плоскость полёта ионов y = 13
    // электромагнит: нижний полюс с обмоткой, полупрозрачный верхний, ярмо сзади
    const mg = new T.Group(); at(mg, 0, 0, 0); clickable(mg, 'bcycle');
    at(box(70, 3, 66, 0x3a3f4c), 0, 1.5, 0, mg);
    at(cyl(32, 6, IRON, { seg: 48 }), 0, 6, 2, mg);
    const coil = mesh(new T.TorusGeometry(33.5, 2.2, 10, 64), 0xb8743f, { edges: false, hull: true }); coil.rotation.x = Math.PI / 2; at(coil, 0, 6, 2, mg);
    at(cyl(32, 5, IRON, { seg: 48, matOpt: { transparent: true, opacity: 0.22, depthWrite: false }, hull: false }), 0, 21.5, 2, mg);
    at(box(16, 21, 5, IRON), 0, 13.5, -33, mg);
    at(box(16, 3, 36, IRON, { matOpt: { transparent: true, opacity: 0.35, depthWrite: false } }), 0, 25.5, -16, mg);
    // вакуумная камера между полюсами
    at(box(60, 4.6, 40, 0x9fc3d8, { matOpt: { transparent: true, opacity: 0.12, depthWrite: false }, edges: true }), 0, YB, -1);
    // фотопластинка со шкалой (см от входной щели)
    const W = d.len * k + 2, px0 = EX - 1;
    at(box(W, 5, 0.8, 0xe9d9a8), px0 + W / 2, YB, ZP + 0.6);
    const tex = canvasTex(kit, 1024, 96, (x, w, h) => {
      x.fillStyle = '#e9d9a8'; x.fillRect(0, 0, w, h); x.strokeStyle = '#3b3320'; x.fillStyle = '#3b3320'; x.font = '700 30px "IBM Plex Mono", monospace'; x.textAlign = 'center';
      for (let c = 0; c <= d.len; c++) { const X = (1 + c * k) / W * w; x.lineWidth = c % 5 ? 2 : 4; x.beginPath(); x.moveTo(X, h); x.lineTo(X, h - (c % 5 ? 22 : 40)); x.stroke(); if (c % 5 === 0 && c) x.fillText(String(c), X, 40); }
    });
    const face = new T.Mesh(keep(new T.PlaneGeometry(W, 5)), keep(new T.MeshBasicMaterial({ map: tex }))); at(face, px0 + W / 2, YB, ZP + 1.02);
    // пятна на пластинке и пути ионов
    const spots = [];
    [[20, d.d20, 0.8], [22, d.d22, 0.45]].forEach(([A, dd, op]) => {
      const r = dd / 2 * k, inside = dd <= d.len, pts = [v3(EX, YB, ZP + 14), v3(EX, YB, ZP)];
      for (let f = 0.06; f <= Math.PI + 1e-6; f += 0.06) { const p = v3(EX + r - r * Math.cos(f), YB, ZP - r * Math.sin(f)); if (p.x > 31) break; pts.push(p); }
      if (d.src) { const cv = glowLine(kit, pts, ION, 0.16, op); if (cv) runners(kit, cv, A === 20 ? 6 : 2, 0xf3d6ff, 0.35, 0.4); }
      if (inside) { const g = glow(kit, ION, 5, 0); at(g, EX + 2 * r, YB, ZP + 1.4); spots.push([A, g]); }
      else if (d.src) { const g = glow(kit, 0xff8a73, 6, 0.8); at(g, 31, YB, ZP - r); }
    });
    // источник ионов и ускоряющие пластины перед щелью
    const sg = new T.Group(); at(sg, EX, 0, ZP + 17); clickable(sg, 'src');
    at(box(9, 9, 7, 0x3b4a66), 0, 4.5 + 3, 0, sg);
    at(box(0.6, 5, 4, d.src ? 0x86e0a8 : 0x5d6a86, { edges: false, matOpt: d.src ? { emissive: 0x86e0a8, emissiveIntensity: 0.6 } : {} }), 4.6, 9, 0, sg);
    [-6, -11].forEach(z => at(box(8, 6, 0.6, C.STEEL), 0, YB, z, sg));
    const sU = supply(d.U, 'В'); sU.g.userData.click = 'ucycle'; const nU = placeOn(sU, v3(-54, 0, 38), 0.3, 'u');
    cable(nU.tout, v3(EX - 4, YB + 3, ZP + 6), C.WIRE.plus, 0, { lift: 3, r: 0.6 }); cable(v3(EX - 4, YB + 3, ZP + 11), nU.tin, C.WIRE.minus, 0, { lift: 3, r: 0.6 });
    // метка детектора над пластинкой
    const mk = arrow(kit, 2.5, 0xff4d3a, 0.4); mk.rotation.z = Math.PI; at(mk, 0, YB + 8, ZP + 0.6);
    tag(v3(0, 28, 2), 'Электромагнит', 'B = ' + fmt(d.B, 2) + ' Тл');
    tag(v3(EX, 17, ZP + 17), 'Источник ионов', d.src ? 'Ne⁺ летят' : 'выключен', d.src);
    const tg = liveTag(kit, v3(4, YB + 6, ZP + 2), 'Пластинка', 'd = 10,0 см');
    let acc = 1;
    const pose = dt => {
      const L = live(), dm = typeof L.dm === 'number' ? L.dm : 10;
      mk.position.x = EX + dm * k;
      spots.forEach(([A, g]) => { const n = (A === 20 ? L.c20 : L.c22) || 0; g.material.opacity = n > 0 ? clamp(0.25 + n / 25, 0.25, 1) : 0; });
      acc += dt; if (acc > 0.2) { acc = 0; tg.set('метка d = ' + fmt(dm, 1) + ' см'); }
    };
    pose(1); kit.onFrame(dt => pose(dt));
  };

  // =====================================================================================
  // 4. Поле Земли: намагниченный глобус (как террелла Биркеланда), линии поля, кольца сияний, «Солнце»
  let earthT = null;
  function earthTex(kit) {
    if (earthT) return earthT;
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d');
    x.fillStyle = '#2f78c4'; x.fillRect(0, 0, 512, 256);
    x.fillStyle = '#5fae6b';
    const blob = (pts) => { x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); x.fill(); };
    blob([[60, 50], [130, 40], [160, 70], [120, 110], [95, 105], [70, 80]]);          // Сев. Америка
    blob([[120, 125], [150, 130], [160, 170], [140, 215], [128, 190], [115, 150]]);   // Юж. Америка
    blob([[235, 60], [300, 40], [420, 50], [450, 90], [380, 110], [300, 95], [250, 90]]); // Евразия
    blob([[240, 105], [290, 110], [300, 150], [275, 195], [255, 170], [235, 130]]);   // Африка
    blob([[400, 160], [445, 155], [455, 185], [415, 190]]);                           // Австралия
    x.fillStyle = '#eef6fb'; x.fillRect(0, 0, 512, 16); x.fillRect(0, 236, 512, 20);
    earthT = new kit.T.CanvasTexture(c); earthT.colorSpace = kit.T.SRGBColorSpace; return earthT;
  }
  SC['lorentz-earth'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, v3, C } = kit;
    const E = v3(14, 38, 0), R = 17, la = d.lat * Math.PI / 180;
    // глобус на подставке
    at(cyl(11, 2, C.DARK, { seg: 32 }), E.x, 1, E.z);
    at(cyl(0.9, E.y - R - 2, C.STEEL, { edges: false }), E.x, 2 + (E.y - R - 2) / 2, E.z);
    const earth = new T.Mesh(keep(new T.SphereGeometry(R, 48, 32)), keep(new T.MeshToonMaterial({ map: earthTex(kit), gradientMap: kit.grad })));
    earth.add(new T.Mesh(earth.geometry, kit.hullMat)); earth.castShadow = true; at(earth, E.x, E.y, E.z); clickable(earth, 'field');
    at(new T.Mesh(keep(new T.SphereGeometry(R + 1.2, 40, 28)), keep(new T.MeshBasicMaterial({ color: 0x72d4e8, transparent: true, opacity: 0.12, depthWrite: false }))), E.x, E.y, E.z);
    if (!kit.reduce) kit.onFrame(dt => { earth.rotation.y += dt * 0.12; });
    // магнитная ось и полюсы: у Северного географического — S, у Южного — N
    const ax = cyl(0.35, 2 * R + 10, 0x3a3f4c, { edges: false, hull: false }); at(ax, E.x, E.y, E.z);
    [[1, 'S', '#2f6fd8'], [-1, 'N', '#e0473a']].forEach(([s, t, col]) => { const l = letter(kit, t, '#ffffff', col, 3); at(l, E.x, E.y + s * (R + 6.5), E.z + 0.1); const l2 = l.clone(); l2.rotation.y = Math.PI / 2; at(l2, E.x, E.y + s * (R + 6.5), E.z); });
    // линии поля: диполь в восьми меридианах
    if (d.field) {
      const lm = keep(new T.MeshBasicMaterial({ color: 0x2aa7c9, transparent: true, opacity: 0.6 }));
      [1.6, 2.3, 3.1].forEach(Lr => {
        const Lp = Lr * R, lmax = Math.acos(Math.sqrt((R + 0.6) / Lp));
        for (let m = 0; m < 8; m++) {
          const ph = m / 8 * Math.PI * 2, pts = [];
          for (let i = 0; i <= 40; i++) { const l = -lmax + 2 * lmax * i / 40, r = Lp * Math.cos(l) ** 2; pts.push(v3(E.x + r * Math.cos(l) * Math.cos(ph), E.y + r * Math.sin(l), E.z + r * Math.cos(l) * Math.sin(ph))); }
          at(new T.Mesh(keep(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 60, 0.18, 5)), lm), 0, 0, 0);
        }
      });
    }
    // кольца сияний (зелёный кислород внизу, красный выше)
    const rings = [];
    [1, -1].forEach(hs => {
      const rr = (R + 0.9) * Math.cos(la), yy = E.y + hs * (R + 0.9) * Math.sin(la);
      const g = new T.Mesh(keep(new T.TorusGeometry(rr, 0.9, 10, 64)), keep(new T.MeshBasicMaterial({ color: AUR, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false })));
      g.rotation.x = Math.PI / 2; at(g, E.x, yy, E.z);
      const rd = new T.Mesh(keep(new T.TorusGeometry(rr * 1.02, 0.6, 8, 64)), keep(new T.MeshBasicMaterial({ color: d.storm ? 0xff6b6b : 0xff8a8a, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false })));
      rd.rotation.x = Math.PI / 2; at(rd, E.x, yy + hs * 1.6, E.z);
      rings.push([hs, g, rd]);
    });
    // «Солнце» — лампа-источник частиц на стойке
    const SX = -54, SZ = 24, sunG = new T.Group(); at(sunG, SX, 0, SZ); clickable(sunG, 'wind');
    at(cyl(7, 2, C.DARK), 0, 1, 0, sunG); at(cyl(0.9, E.y - 8, C.STEEL, { edges: false }), 0, (E.y - 6) / 2, 0, sunG);
    at(new T.Mesh(keep(new T.SphereGeometry(6.5, 32, 22)), keep(new T.MeshBasicMaterial({ color: d.storm ? 0xffb547 : 0xffd27a }))), 0, E.y, 0, sunG);
    const sg = glow(kit, 0xffc247, 34, 0.75); at(sg, 0, E.y, 0, sunG);
    at(new T.PointLight(0xffd27a, 40, 120, 1.2), 0, E.y, 0, sunG);
    // пульт «Магнитная буря»
    const pult = new T.Group(); at(pult, -20, 0, 40); clickable(pult, 'storm');
    at(box(12, 4, 8, 0x3b4a66), 0, 2, 0, pult);
    at(cyl(1.6, 1.2, d.storm ? RED : 0x3fae5a, { edges: false, matOpt: { emissive: d.storm ? RED : 0x3fae5a, emissiveIntensity: 0.7 } }), 0, 4.6, 0, pult);
    // частицы солнечного ветра: вдоль поля к кольцам сияний или (без поля) прямо в атмосферу
    const pool = [], geo = keep(new T.SphereGeometry(0.55, 8, 6)), mat = keep(new T.MeshBasicMaterial({ color: d.storm ? 0xffb547 : 0xffd166 }));
    const Ll = (R + 1) / Math.cos(la) ** 2;
    function makePath() {
      const s = v3(SX + 6, E.y + (Math.random() - 0.5) * 6, SZ - 4 + (Math.random() - 0.5) * 6);
      if (!d.field) { const dir = v3(SX - E.x, 0, SZ - E.z).normalize(), tgt = E.clone().addScaledVector(dir, R * 0.85).add(v3(-dir.z * (Math.random() - 0.5) * R, (Math.random() - 0.5) * R, dir.x * (Math.random() - 0.5) * R)); return new T.CatmullRomCurve3([s, s.clone().lerp(tgt, 0.5), tgt]); }
      const hs = Math.random() < 0.5 ? 1 : -1, ph = Math.atan2(SZ - E.z, SX - E.x) + (Math.random() - 0.5) * 1.6, l1 = 28 * Math.PI / 180, pts = [s];
      for (let i = 0; i <= 14; i++) {
        const l = l1 + (la - l1) * i / 14, r = Ll * Math.cos(l) ** 2, w = 1.2 * (1 - i / 14) * Math.sin(i * 1.9);
        pts.push(v3(E.x + r * Math.cos(l) * Math.cos(ph + w * 0.05), E.y + hs * r * Math.sin(l) + w, E.z + r * Math.cos(l) * Math.sin(ph + w * 0.05)));
      }
      return new T.CatmullRomCurve3(pts);
    }
    let spawn = 0;
    const tg = liveTag(kit, v3(E.x, E.y + R + 13, E.z), 'Сияние', '—');
    let acc = 1;
    kit.onFrame(dt => {
      const L = live();
      rings.forEach(([hs, g, rd]) => { const v = clamp(hs > 0 ? L.gN || 0 : L.gS || 0, 0, 1); g.material.opacity = 0.9 * v; rd.material.opacity = 0.5 * v; });
      if (L.wind && !kit.reduce) { spawn += dt * (d.storm ? 18 : 11); while (spawn >= 1 && pool.length < 60) { spawn--; const m = new T.Mesh(geo, mat); kit.root.add(m); pool.push({ m, c: makePath(), u: 0, sp: (d.storm ? 0.75 : 0.45) * (0.8 + Math.random() * 0.4) }); } }
      for (let i = pool.length - 1; i >= 0; i--) {
        const p = pool[i]; p.u += p.sp * dt;
        if (p.u >= 1) { kit.root.remove(p.m); pool.splice(i, 1); continue; }
        p.m.position.copy(p.c.getPointAt(p.u));
      }
      acc += dt; if (acc > 0.3) { acc = 0; const on = (L.gN || 0) > 0.05 || (L.gS || 0) > 0.05; tg.set(on ? `светится · ${d.lat}° широты` : 'нет'); }
    });
    tag(v3(SX, E.y + 12, SZ), 'Солнце', d.storm ? 'буря · 800 км/с' : 'ветер · 400 км/с', d.storm);
    tag(v3(E.x + R + 4, E.y - R - 2, E.z), 'Земля', d.field ? 'поле включено' : 'поле выключено', !d.field);
    tag(v3(-20, 9, 40), 'Пульт', d.storm ? 'буря' : 'спокойно');
  };
})();
