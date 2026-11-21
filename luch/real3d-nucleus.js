// «Как в жизни» для темы «Атомное ядро» (labs/phys-nucleus): свинцовый контейнер с радием, электромагнит, преграда и
// светящийся экран (α, β, γ-лучи); лоток со 100 ядрами-шариками, счётчик Гейгера и доска с графиком распада;
// сборка ядра из лотков протонов и нейтронов с весами «нуклоны врозь / ядро»; ядерная реакция на подставках
// с весами сумм A и Z и пультом; дозиметр у шести предметов со шкалой доз, ряды «источник — преграда — счётчик»,
// дозиметр на рельсе с секундомером; настольный макет АЭС: реактор со стержнями, насос, парогенератор, турбина,
// генератор, градирня и дома. Сцены строятся из window.LUCH_REAL() опыта; движение (распад ядер, мощность
// реактора, стержни, вылет частиц в реакции) — из window.LUCH_REAL.live() каждый кадр. Набор деталей kit — из /luch/real3d.js.
(() => {
  const SC = (window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {});
  const PRO = 0xff8a73, NEU = 0xa9b4c9, GOLD = 0xffd166, CP = 0xffb547, CYAN = 0x72d4e8, VIOLET = 0xc3a8ff, OK = 0x86e0a8,
    RED = 0xe0473a, BLUE = 0x2f6fd8, COPPER = 0xd98a4e, GLASS = 0xcfe6f2, PANEL = 0x3b4a66, LEAD = 0x56607a, SLATE = 0x26324a;
  const RCOL = { a: CP, b: CYAN, g: VIOLET };
  const RSYM = { a: 'α', b: 'β', g: 'γ' };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const ease = p => p < 0 ? 0 : p > 1 ? 1 : p * p * (3 - 2 * p);
  const f = (x, d = 1) => { let s = (Math.round(x * 10 ** d) / 10 ** d).toFixed(d); if (/^-0(\.0+)?$/.test(s)) s = s.slice(1); return s.replace('.', ',').replace('-', '−'); };
  const hex = c => '#' + c.toString(16).padStart(6, '0');
  const live = () => { try { return (window.LUCH_REAL && window.LUCH_REAL.live && window.LUCH_REAL.live()) || {}; } catch (e) { return {}; } };
  const lastTag = () => { const l = document.querySelectorAll('.rl-view .rl-lbl'); return l[l.length - 1] || null; };
  // подпись, у которой значение можно менять каждый кадр
  function liveTag(kit, p, name, value, hot) {
    kit.tag(p, name, value, hot);
    const el = lastTag(), i = el && el.querySelector('i');
    let shown = value, hh = !!hot;
    return { p, el, set(v, h) { if (i && v !== shown) { shown = v; i.textContent = v; } if (el && h !== undefined && !!h !== hh) { hh = !!h; el.classList.toggle('hot', hh); } } };
  }
  function glow(kit, col, size, op = 0.8) {
    const { T } = kit;
    const s = new T.Sprite(kit.keep(new T.SpriteMaterial({ map: kit.glowTex(), color: col, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: op })));
    s.scale.setScalar(size); return s;
  }
  function glass(kit, geo, op = 0.18, col = GLASS) {
    const { T, keep } = kit;
    return new T.Mesh(keep(geo), keep(new T.MeshToonMaterial({ color: col, gradientMap: kit.grad, transparent: true, opacity: op, depthWrite: false, side: T.DoubleSide })));
  }
  function ball(kit, r, col, emis = 0.2, geo) {
    const { T, keep } = kit;
    const m = new T.Mesh(geo || keep(new T.SphereGeometry(r, 20, 14)), kit.toon(col, { emissive: col, emissiveIntensity: emis }));
    m.add(new T.Mesh(m.geometry, kit.hullMat)); m.castShadow = true; return m;
  }
  // своя (не общая) мультяшная заливка — её цвет и свечение можно менять каждый кадр
  function ownMat(kit, col, o = {}) { return kit.keep(new kit.T.MeshToonMaterial({ color: col, gradientMap: kit.grad, ...o })); }
  // стержень (труба, провод) между двумя точками
  function rod(kit, a, b, r, col, o = {}) {
    const { T, cyl } = kit; const d = b.clone().sub(a), L = d.length(); if (L < 0.01) return null;
    const m = o.mat ? new T.Mesh(kit.keep(new T.CylinderGeometry(r, r, L, 14)), o.mat) : cyl(r, L, col, { edges: false, hull: r >= 0.5, seg: 14 });
    m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
    (o.parent || kit.root).add(m); return m;
  }
  // светящаяся линия по точкам; curve — для бегущих огоньков
  function glowTube(kit, pts, col, r = 0.35, op = 1) {
    const { T, keep } = kit;
    if (pts.length < 2) return null;
    const curve = new T.CatmullRomCurve3(pts), n = Math.max(8, pts.length * 2);
    const core = new T.Mesh(keep(new T.TubeGeometry(curve, n, r, 6)), keep(new T.MeshBasicMaterial({ color: col, transparent: op < 1, opacity: op })));
    const halo = new T.Mesh(keep(new T.TubeGeometry(curve, n, r * 2.6, 6)), keep(new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.2 * op, blending: T.AdditiveBlending, depthWrite: false })));
    kit.root.add(core); kit.root.add(halo);
    return { curve };
  }
  function canvasTex(kit, w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    draw(x, w, h);
    const t = new kit.T.CanvasTexture(c); t.colorSpace = kit.T.SRGBColorSpace; t.anisotropy = 4; kit.keep(t); return { t, c, x };
  }
  // табличка с надписью (плоскость); flat — лежит на столе
  function plate(kit, txt, w, h, fg = '#e8ecf4', bg = '#1a2438', flat) {
    const { T, keep } = kit;
    const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: keep(kit.textTex(txt, fg, bg, Math.round(96 * w / h), 96)) })));
    if (flat) m.rotation.x = -Math.PI / 2;
    return m;
  }
  // клавиша на пульте с надписью сверху
  function key(kit, label, col, k, x, z, o = {}) {
    const { T, at, box, clickable } = kit, w = o.w || 7, dd = o.d || 7, g = new T.Group();
    at(g, x, o.y || 0, z);
    at(box(w, 2, dd, 0x2c3240), 0, 1, 0, g);
    at(box(w - 1.4, o.on ? 1 : 1.6, dd - 1.4, col), 0, o.on ? 2.5 : 2.8, 0, g);
    const lab = plate(kit, label, w - 2.2, dd - 2.6, o.fg || '#1b1610', hex(col), true); at(lab, 0, o.on ? 3.03 : 3.63, 0, g);
    clickable(g, k); return g;
  }
  // круглая подставка
  function pedestal(kit, x, z, r = 4.5, h = 3, col) { kit.at(kit.cyl(r, h, col || kit.C.DARK, { seg: 24 }), x, h / 2, z); return h; }

  // ---------- ядро из шариков: плотная упаковка (решётка ГЦК), протоны вперемешку с нейтронами ----------
  const LAT = (() => {
    const p = [];
    for (let i = -7; i <= 7; i++) for (let j = -7; j <= 7; j++) for (let k = -7; k <= 7; k++) if ((((i + j + k) % 2) + 2) % 2 === 0) p.push([i, j, k, i * i + j * j + k * k + i * 0.013 + j * 0.007 + k * 0.003]);
    p.sort((a, b) => a[3] - b[3]); return p;
  })();
  function nucleus(kit, A, Z, r) {
    const { T } = kit, g = new T.Group();
    A = clamp(Math.round(A), 0, 300);
    if (A <= 0) return { g, R: r };
    const s = 2 * r * 0.94 / Math.SQRT2, pts = LAT.slice(0, A);
    let cx = 0, cy = 0, cz = 0; pts.forEach(p => { cx += p[0]; cy += p[1]; cz += p[2]; }); cx /= A; cy /= A; cz /= A;
    let R = 0; const P = [], N = [];
    pts.forEach((p, i) => {
      const v = [(p[0] - cx) * s, (p[1] - cy) * s, (p[2] - cz) * s]; R = Math.max(R, Math.hypot(v[0], v[1], v[2]));
      const isP = Z >= A ? true : Z <= 0 ? false : Math.floor((i + 1) * Z / A) > Math.floor(i * Z / A);
      (isP ? P : N).push(v);
    });
    if (A <= 64) {
      const geo = kit.keep(new T.SphereGeometry(r, 18, 12));
      P.forEach(v => { const b = ball(kit, r, PRO, 0.15, geo); b.position.set(v[0], v[1], v[2]); g.add(b); });
      N.forEach(v => { const b = ball(kit, r, NEU, 0.1, geo); b.position.set(v[0], v[1], v[2]); g.add(b); });
    } else {
      const geo = kit.keep(new T.SphereGeometry(r, 14, 10)), m4 = new T.Matrix4();
      [[P, PRO, 0.15], [N, NEU, 0.1]].forEach(([arr, col, em]) => {
        if (!arr.length) return;
        const im = new T.InstancedMesh(geo, kit.toon(col, { emissive: col, emissiveIntensity: em }), arr.length);
        arr.forEach((v, i) => { m4.makeTranslation(v[0], v[1], v[2]); im.setMatrixAt(i, m4); });
        im.instanceMatrix.needsUpdate = true; im.castShadow = true; kit.keep(im); g.add(im);
      });
    }
    return { g, R: R + r };
  }
  const rOf = A => A > 100 ? 1.25 : A > 40 ? 1.55 : A > 12 ? 1.9 : 2.3;
  // частица реакции: ядро, нуклон, электрон/позитрон, γ-квант или антинейтрино
  function particleObj(kit, A, Z, sym) {
    const { T } = kit;
    if (A > 0) return nucleus(kit, A, Z, rOf(A));
    const g = new T.Group();
    if (Z === 0 && sym === 'ν̃') { g.add(ball(kit, 0.9, 0x8b96ad, 0.1)); g.add(glow(kit, 0x8b96ad, 5, 0.35)); return { g, R: 1.2 }; }
    if (Z === 0) { g.add(ball(kit, 1, VIOLET, 0.9)); g.add(glow(kit, VIOLET, 10, 0.85)); return { g, R: 1.5 }; }
    const col = Z < 0 ? CYAN : 0xff6b6b;
    g.add(ball(kit, 1.3, col, 0.5)); g.add(glow(kit, col, 7, 0.6)); return { g, R: 1.6 };
  }
  // рычажные весы: возвращают концы коромысла (мировые), чашки подвешены
  function scales(kit, x, z, ang, o = {}) {
    const { T, at, box, cyl, C } = kit, H = o.H || 24, L = o.L || 16, g = new T.Group();
    at(g, x, 0, z);
    at(box(14, 1.6, 9, C.DARK), 0, 0.8, 0, g);
    at(cyl(0.9, H, C.STEEL, { seg: 12 }), 0, 1.6 + H / 2, 0, g);
    const beam = new T.Group(); at(beam, 0, H + 1.6, 0, g); beam.rotation.z = ang;
    at(box(2 * L + 2, 1, 1.4, 0x8b96ad), 0, 0, 0, beam);
    at(cyl(1.3, 1.6, 0x8b96ad, { seg: 14 }), 0, 0, 0, beam).rotation.x = Math.PI / 2;
    const pans = [-1, 1].map(s => {
      const ex = s * L * Math.cos(ang), ey = H + 1.6 + s * L * Math.sin(ang), py = ey - (o.drop || 10);
      const pg = new T.Group(); at(pg, ex, py, 0, g);
      at(cyl(o.pr || 5.5, 0.7, kit.C.BRASS, { r2: (o.pr || 5.5) + 0.8, seg: 24 }), 0, 0, 0, pg);
      for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; rod(kit, new T.Vector3(Math.cos(a) * 4, 0.4, Math.sin(a) * 4), new T.Vector3(0, o.drop || 10, 0), 0.12, 0x8b96ad, { parent: pg }); }
      return { g: pg, top: new T.Vector3(x + ex, py + 0.6, z) };
    });
    return { g, pans, top: H + 4 };
  }

  // =====================================================================================
  // 1а. Лучи: свинцовый контейнер с радием, электромагнит (поле вверх), держатель преграды, светящийся экран
  SC['nucleus-rays'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, v3, C } = kit;
    const Y = 12, X0 = -44, F0 = -28, F1 = 8, XA = 22, XS = 50;
    const DEF = { a: 2.6, b: -9, g: 0 };
    const zOf = (k, x) => { if (!d.field) return 0; const dd = DEF[k]; if (x <= F0) return 0; if (x <= F1) { const u = (x - F0) / (F1 - F0); return dd * u * u; } return dd + 2 * dd / (F1 - F0) * (x - F1); };
    const stops = (k, ab) => ab === 'paper' ? k === 'a' : (ab === 'al' || ab === 'pb') ? k !== 'g' : false;
    // источник
    at(box(14, 20, 14, LEAD), -52, 10, 0);
    at(box(15.5, 1.4, 15.5, 0x3b4459), -52, 20.7, 0);
    const nz = cyl(2.2, 2.4, 0x0e1520, { seg: 16 }); nz.rotation.z = Math.PI / 2; at(nz, -44.3, Y, 0);
    at(glow(kit, OK, 6, 0.8), -44, Y, 0);
    const trefoil = plate(kit, '☢', 6, 6, '#1b1610', '#ffd166'); at(trefoil, -52, 12, 7.06);
    // электромагнит: полюса снизу и сверху, ярмо сзади
    const mag = new T.Group(); at(mag, 0, 0, 0); clickable(mag, 'field');
    const fx = (F0 + F1) / 2, fw = F1 - F0;
    at(box(fw, 3, 30, d.field ? BLUE : 0x5d6a86), fx, 1.5, 0, mag);
    const top = box(fw, 3, 30, d.field ? RED : 0x5d6a86, { matOpt: { transparent: true, opacity: 0.35, depthWrite: false } }); at(top, fx, Y + 8.5, 0, mag);
    at(box(fw, Y + 10, 3, 0x5d6a86), fx, (Y + 10) / 2, -16.5, mag);
    for (const s of [-1, 1]) at(cyl(4.6, 3, COPPER, { seg: 22 }), fx + s * 10, Y + 11.5, -8, mag);
    if (d.field) for (const [ax, az] of [[-0.32, -0.3], [0.32, 0.3], [0.32, -0.3], [-0.32, 0.3]]) {
      const ar = new T.Group(); at(ar, fx + ax * fw, 4.5, az * 30, mag);
      at(cyl(0.3, 9, CYAN, { edges: false, hull: false, matOpt: { emissive: CYAN, emissiveIntensity: 0.4 } }), 0, 4.5, 0, ar);
      const tip = cyl(1, 2, CYAN, { r2: 0.01, edges: false, hull: false, matOpt: { emissive: CYAN, emissiveIntensity: 0.4 } }); at(tip, 0, 10, 0, ar);
    }
    // держатель преграды
    const hold = new T.Group(); at(hold, XA, 0, 0); clickable(hold, 'ab');
    at(box(6, 1.6, 32, C.DARK), 0, 0.8, 0, hold);
    for (const s of [-1, 1]) at(box(1.4, 24, 1.4, C.STEEL), 0, 12, s * 15.5, hold);
    if (d.ab !== 'none') {
      const w = { paper: 0.4, al: 1.2, pb: 4 }[d.ab], col = { paper: 0xf4efe2, al: 0x9fb0c8, pb: LEAD }[d.ab];
      at(box(w, 21, 29, col), 0, 12.1, 0, hold);
    } else at(box(0.3, 21, 29, 0x9fc3d8, { matOpt: { transparent: true, opacity: 0.1, depthWrite: false } }), 0, 12.1, 0, hold);
    // экран
    at(box(6, 1.6, 40, C.DARK), XS + 1, 0.8, 0);
    at(box(1.6, 28, 64, SLATE), XS + 1, 15, 0);
    const face = new T.Mesh(kit.keep(new T.PlaneGeometry(62, 26)), kit.keep(new T.MeshBasicMaterial({ color: 0x1d3a2a }))); face.rotation.y = -Math.PI / 2; at(face, XS + 0.15, 15, 0);
    // пучки
    const COL = { ...RCOL, m: 0xe8ecf4 }, movers = [];
    const kinds = d.field ? ['a', 'b', 'g'] : ['m'];
    const stoppedAll = ['a', 'b', 'g'].filter(q => stops(q, d.ab));
    for (const k of kinds) {
      const ks = k === 'm' ? ['a', 'b', 'g'] : [k], pass = ks.filter(q => !stops(q, d.ab)), kk = k === 'm' ? 'g' : k;
      const weak = pass.length && d.ab === 'pb', hasAb = d.ab !== 'none';
      const x1 = hasAb ? XA - 0.6 : XS - 0.4;
      const p1 = []; for (let x = X0; x < x1; x += 2) p1.push(v3(x, Y, zOf(kk, x))); p1.push(v3(x1, Y, zOf(kk, x1)));
      const t1 = glowTube(kit, p1, COL[k], 0.3);
      if (t1) movers.push({ c: t1.curve, col: COL[k], n: 5, sp: 0.5 });
      if (hasAb && !pass.length) { at(glow(kit, COL[k], 7, 0.8), XA - 1, Y, zOf(kk, XA)); continue; }
      if (hasAb) {
        const after = k === 'm' ? (pass.length === 1 ? COL[pass[0]] : 0xe8ecf4) : COL[k];
        const p2 = []; for (let x = XA + 2.4; x < XS - 0.4; x += 2) p2.push(v3(x, Y, zOf(kk, x))); p2.push(v3(XS - 0.4, Y, zOf(kk, XS - 0.4)));
        const t2 = glowTube(kit, p2, after, weak ? 0.18 : 0.3, weak ? 0.45 : 1);
        if (t2) movers.push({ c: t2.curve, col: after, n: weak ? 1 : 3, sp: 0.6 });
      }
      const zs = zOf(kk, XS);
      at(glow(kit, COL[k], weak ? 5 : 9, weak ? 0.5 : 0.9), XS - 0.3, Y, zs);
      tag(v3(XS, Y + 4, zs), '', pass.map(q => RSYM[q]).join(' + ') + (weak ? ' (ослаблен)' : ''));
    }
    const dots = [];
    movers.forEach(m => { for (let i = 0; i < m.n; i++) { const s = glow(kit, m.col, 3.2, 0.95); kit.root.add(s); dots.push({ s, m, u: i / m.n }); } });
    const pose = (dt) => { dots.forEach(o => { if (!kit.reduce) o.u = (o.u + dt * o.m.sp) % 1; o.s.position.copy(o.m.c.getPointAt(o.u)); }); };
    pose(0); kit.onFrame(pose);
    tag(v3(-52, 24, 0), 'Радий', 'в свинцовом контейнере');
    tag(v3(fx, Y + 15, -10), 'Магнит', d.field ? 'поле включено' : 'выключен', d.field);
    tag(v3(XA, 27, 0), 'Преграда', { none: 'нет', paper: 'бумага', al: 'алюминий 3 мм', pb: 'свинец 5 см' }[d.ab] + (stoppedAll.length ? ' · задержаны ' + stoppedAll.map(q => RSYM[q]).join(', ') : ''), !!stoppedAll.length);
    tag(v3(XS, 31, 0), 'Экран', 'светится от лучей');
  };

  // =====================================================================================
  // 1б. Распад: лоток со 100 ядрами, счётчик Гейгера, пробирки с изотопами и доска с графиком N(t)
  SC['nucleus-decay'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, v3, C } = kit;
    const TX = -26, sp = 4.2;
    const tray = new T.Group(); at(tray, TX, 0, -2); clickable(tray, 'run');
    at(box(46, 2, 46, C.DARK), 0, 1, 0, tray);
    for (const [w, dd, xx, zz] of [[46, 1.4, 0, 22.7], [46, 1.4, 0, -22.7], [1.4, 46, 22.7, 0], [1.4, 46, -22.7, 0]]) at(box(w, 2, dd, PANEL), xx, 3, zz, tray);
    const geo = kit.keep(new T.SphereGeometry(1.6, 16, 12)), LIVE = kit.toon(OK, { emissive: OK, emissiveIntensity: 0.25 }), DEAD = kit.toon(0x2a3550);
    const balls = [];
    for (let i = 0; i < 100; i++) {
      const b = new T.Mesh(geo, LIVE); b.add(new T.Mesh(geo, kit.hullMat)); b.castShadow = true;
      b.position.set((i % 10 - 4.5) * sp, 3.6, (Math.floor(i / 10) - 4.5) * sp); tray.add(b); balls.push(b);
    }
    const flashes = []; for (let i = 0; i < 10; i++) { const s = glow(kit, CP, 6, 0); s.visible = false; tray.add(s); flashes.push({ s, t: 9 }); }
    let fi = 0;
    // счётчик Гейгера
    const ctr = new T.Group(); at(ctr, 18, 0, 6);
    at(box(20, 12, 14, 0xe6c14a), 0, 6, 0, ctr);
    at(box(14, 5, 0.4, 0x0e1520), -1.5, 7.5, 7.1, ctr);
    for (let k = 0; k < 4; k++) at(box(0.5, 4, 0.3, 0x1b1610), 5.6 + k * 1.1, 4, 7.1, ctr);
    const btn = new T.Group(); at(btn, 4, 12, 0, ctr); clickable(btn, 'run');
    at(cyl(2.6, 1.6, d.run ? CP : OK, { seg: 20 }), 0, 0.8, 0, btn);
    const led = new T.Mesh(kit.keep(new T.SphereGeometry(0.9, 12, 8)), ownMat(kit, 0xff6b4a, { emissive: 0xff3a1a, emissiveIntensity: 0 })); at(led, -5, 12.6, 3, ctr);
    key(kit, 'сброс', 0x9aa3b2, 'dreset', 34, 14, { w: 8, d: 5 });
    // зонд на проводе у лотка
    const probe = cyl(1.4, 9, 0x3b4459, { seg: 14 }); probe.rotation.z = Math.PI / 2; at(probe, 0.5, 4, -10);
    const curve = new T.CatmullRomCurve3([v3(5, 4, -10), v3(9, 2, -8), v3(10, 1.2, -2), v3(10, 4, 4), v3(8, 6, 6)]);
    kit.root.add(kit.mesh(new T.TubeGeometry(curve, 40, 0.5, 8), 0x2a2f3a, { edges: false }));
    // доска с графиком
    const bd = new T.Group(); at(bd, 44, 0, -26);
    for (const s of [-1, 1]) at(box(1.4, 34, 1.4, C.WOOD2), s * 17, 17, 0, bd);
    at(box(34, 24, 1, 0x1a2438), 0, 21, 0, bd);
    const gr = canvasTex(kit, 512, 360, () => {});
    const scr = new T.Mesh(kit.keep(new T.PlaneGeometry(32, 22.5)), kit.keep(new T.MeshBasicMaterial({ map: gr.t }))); at(scr, 0, 21, 0.55, bd);
    const drawPlot = (hist, half) => {
      const x = gr.x, X = tt => 62 + Math.min(tt, 4) / 4 * 430, Yp = n => 316 - n / 100 * 280;
      x.fillStyle = '#0e1520'; x.fillRect(0, 0, 512, 360);
      x.strokeStyle = '#26324a'; x.lineWidth = 2; for (let k = 1; k <= 4; k++) { x.beginPath(); x.moveTo(X(k), 36); x.lineTo(X(k), 316); x.stroke(); }
      x.strokeStyle = '#3a4762'; x.setLineDash([6, 8]); for (const n of [50, 25]) { x.beginPath(); x.moveTo(62, Yp(n)); x.lineTo(492, Yp(n)); x.stroke(); }
      x.strokeStyle = '#8b96ad'; x.beginPath(); for (let tt = 0; tt <= 4.001; tt += 0.1) { const px = X(tt), py = Yp(100 * 2 ** -tt); tt ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); x.setLineDash([]);
      x.strokeStyle = '#86e0a8'; x.lineWidth = 5; x.beginPath(); (hist || [[0, 100]]).forEach(([tt, n], i) => i ? x.lineTo(X(tt), Yp(n)) : x.moveTo(X(tt), Yp(n))); x.stroke();
      x.strokeStyle = '#8b96ad'; x.lineWidth = 2; x.beginPath(); x.moveTo(62, 36); x.lineTo(62, 316); x.lineTo(492, 316); x.stroke();
      x.fillStyle = '#a9b4c9'; x.font = '500 22px "IBM Plex Mono", monospace'; x.textAlign = 'right';
      for (const n of [100, 50, 25, 0]) x.fillText(String(n), 54, Yp(n) + 7);
      x.textAlign = 'center'; for (let k = 1; k <= 4; k++) x.fillText(k + 'T½', X(k), 344);
      if (half != null) { x.strokeStyle = '#ffb547'; x.lineWidth = 3; x.beginPath(); x.moveTo(X(half), Yp(50)); x.lineTo(X(half), 316); x.stroke(); x.fillStyle = '#ffb547'; x.beginPath(); x.arc(X(half), Yp(50), 7, 0, 7); x.fill(); }
      gr.t.needsUpdate = true;
    };
    // пробирки с изотопами
    (d.isos || []).forEach((nm, i) => {
      const x = -46 + i * 11, z = 34, sel = i === d.iso, g = new T.Group(); at(g, x, 0, z); clickable(g, 'iso-' + i);
      at(box(8, 1.4, 8, sel ? PANEL : C.DARK), 0, 0.7, 0, g);
      const col = [0x9fd8a8, 0xd6b3ff, 0x72d4e8, 0xe8c07a][i % 4];
      at(cyl(1.6, 5, col, { edges: false, hull: false, matOpt: { emissive: col, emissiveIntensity: sel ? 0.6 : 0.15 } }), 0, 4, 0, g);
      at(glass(kit, new T.CylinderGeometry(2, 2, 9, 20, 1, true), 0.3), 0, 6, 0, g);
      at(cyl(2.2, 1.4, 0x2c3240, { seg: 18 }), 0, 11, 0, g);
      if (sel) at(glow(kit, col, 12, 0.45), 0, 5, 0, g);
    });
    tag(v3(-46 + d.iso * 11, 15, 34), d.isos ? d.isos[d.iso] : 'Изотоп', 'T½ = ' + d.T, true);
    const tN = liveTag(kit, v3(TX, 9, -26), 'Ядер осталось', '100 из 100');
    const tC = liveTag(kit, v3(18, 17, 6), 'Счётчик', d.run ? 'идёт отсчёт' : 'нажмите — пуск', d.run);
    if (d.half) tag(v3(44, 37, -26), 'Половина распалась', 'через ' + d.half, true);
    else tag(v3(44, 37, -26), 'График N(t)', 'опыт и закон');
    let prev = '', acc = 1, lastH = -1, lastDt = -1, ledK = 0;
    const pose = (dt) => {
      const L = live(), dec = L.dec || '';
      if (dec !== prev) {
        for (let i = 0; i < 100; i++) {
          const was = prev[i] === '1', now = dec[i] === '1';
          if (was === now && prev) continue;
          balls[i].material = now ? DEAD : LIVE; balls[i].scale.setScalar(now ? 0.8 : 1);
          if (now && !was && prev) { const fl = flashes[fi++ % flashes.length]; fl.s.position.copy(balls[i].position); fl.t = 0; fl.s.visible = true; ledK = 1; }
        }
        prev = dec;
      }
      flashes.forEach(fl => { if (fl.t > 0.6) { fl.s.visible = false; return; } fl.t += dt; const k = fl.t / 0.6; fl.s.scale.setScalar(3 + 10 * k); fl.s.material.opacity = 0.9 * (1 - k); });
      ledK = Math.max(0, ledK - dt * 6); led.material.emissiveIntensity = ledK * 1.5;
      if (L.n != null) tN.set(`${L.n} из 100`);
      if (L.t) tC.set(L.run ? `t = ${L.t}` : (L.dt > 0 ? `стоп · t = ${L.t}` : 'нажмите — пуск'), !!L.run);
      acc += dt;
      if (acc > 0.2) { acc = 0; const h = L.hist || [[0, 100]]; if (h.length !== lastH || L.dt !== lastDt) { lastH = h.length; lastDt = L.dt; drawPlot(h, L.half); } }
    };
    pose(0); kit.onFrame(pose);
  };

  // =====================================================================================
  // 2. Состав ядра: лотки с протонами и нейтронами, ядро на подставке, весы, таблички-цели
  SC['nucleus-build'] = (kit, d) => {
    const { T, at, box, tag, clickable, v3, C } = kit;
    const heap = (x, z, col, k, keyP, keyM, name) => {
      const g = new T.Group(); at(g, x, 0, z); clickable(g, keyP);
      at(box(18, 2, 14, C.DARK), 0, 1, 0, g);
      for (const [w, dd, xx, zz] of [[18, 1, 0, 6.5], [18, 1, 0, -6.5], [1, 14, 8.5, 0], [1, 14, -8.5, 0]]) at(box(w, 1.6, dd, PANEL), xx, 2.8, zz, g);
      const geo = kit.keep(new T.SphereGeometry(1.8, 16, 12));
      [[-4.5, -2.5], [0, -2.5], [4.5, -2.5], [-4.5, 2.5], [0, 2.5], [4.5, 2.5], [-2.2, 0], [2.2, 0], [0, 0]].forEach(([bx, bz], i) => {
        const b = ball(kit, 1.8, col, 0.2, geo); b.position.set(bx, i < 6 ? 3.8 : 6.6, bz); g.add(b);
      });
      key(kit, '+' + d.st, col, keyP, x - 4.5, z + 11, { w: 7, d: 6 });
      key(kit, '−' + d.st, 0x9aa3b2, keyM, x + 4.5, z + 11, { w: 7, d: 6 });
      tag(v3(x, 11, z), name, (k === 'p' ? 'Z = ' + d.Z : 'N = ' + d.N));
    };
    heap(-52, 18, PRO, 'p', 'Z+', 'Z-', 'Протоны');
    heap(-52, -18, NEU, 'n', 'N+', 'N-', 'Нейтроны');
    key(kit, d.st === 10 ? 'шаг 10' : 'шаг 1', d.st === 10 ? CP : 0x9aa3b2, 'st', -32, 40, { w: 10, d: 6 });
    key(kit, 'сброс', 0x9aa3b2, 'reset', -19, 40, { w: 10, d: 6 });
    // ядро
    const bound = !!d.be, NX = -6, NZ = -2;
    const h = kit.cyl(7, 6, C.DARK, { seg: 28 }); at(h, NX, 3, NZ);
    const nu = nucleus(kit, d.A, d.Z, rOf(d.A)), cy = 6 + nu.R + 1.5;
    at(nu.g, NX, cy, NZ);
    at(glow(kit, bound ? OK : CP, nu.R * 3.2, bound ? 0.22 : 0.3), NX, cy, NZ);
    tag(v3(NX, cy + nu.R + 3, NZ), `${d.sym}-${d.A} · ${d.name}`, bound ? (d.A > 1 ? `E св ${d.be} МэВ · ${d.bpn} на нуклон` : 'один протон') : 'нет в таблице — неустойчиво', bound && d.A > 1);
    tag(v3(NX, 2, NZ + 9), '', `${d.Z} p + ${d.N} n = ${d.A}`);
    let t0 = 0;
    if (!bound) kit.onFrame(dt => { if (kit.reduce) return; t0 += dt; nu.g.position.set(NX + Math.sin(t0 * 31) * 0.35, cy + Math.cos(t0 * 27) * 0.3, NZ + Math.sin(t0 * 23 + 1) * 0.35); });
    else kit.onFrame(dt => { if (kit.reduce) return; t0 += dt; nu.g.rotation.y = t0 * 0.3; });
    // весы: нуклоны врозь (тяжелее) — ядро
    const ang = bound && d.A > 1 ? 0.12 : 0, sc = scales(kit, 40, 6, ang, { H: 22, L: 15 });
    const lp = sc.pans[0].top, rp = sc.pans[1].top;
    const fl = Math.min(d.A, 12), geo = kit.keep(new T.SphereGeometry(1.1, 12, 8));
    for (let i = 0; i < fl; i++) { const isP = i < Math.round(fl * d.Z / Math.max(d.A, 1)); const b = ball(kit, 1.1, isP ? PRO : NEU, 0.2, geo); b.position.set(lp.x - 3.3 + (i % 4) * 2.2, lp.y + 1.1 + Math.floor(i / 8) * 1.9, lp.z - 2.2 + (Math.floor(i / 4) % 2) * 2.2 + (i >= 8 ? 1.1 : 0)); kit.root.add(b); }
    const cr = 1 + 0.5 * Math.cbrt(d.A); const core = ball(kit, cr, CP, 0.4); at(core, rp.x, rp.y + cr, rp.z); at(glow(kit, CP, cr * 5, 0.5), rp.x, rp.y + cr, rp.z);
    tag(v3(lp.x, lp.y + 7, lp.z), 'Врозь', d.mf + ' а.е.м.');
    tag(v3(rp.x, rp.y + 7, rp.z), 'Ядро', d.mn ? d.mn + ' а.е.м.' : '?');
    if (d.dm) tag(v3(40, 33, 6), 'Дефект масс', 'Δm = ' + d.dm + ' а.е.м.', true);
    // таблички-цели
    const nf = (d.targets || []).filter(t => t.found).length;
    (d.targets || []).forEach((tg, i) => {
      const x = -26 + i * 20, z = -36, g = new T.Group(); at(g, x, 0, z); clickable(g, 'pk-' + tg.s);
      const pick = d.pick === tg.s, col = pick ? (tg.s === 'Fe' ? OK : 0xff8a73) : tg.found ? 0x3f6a54 : SLATE;
      at(box(17, 1.6, 6, C.DARK), 0, 0.8, 0, g);
      at(box(16, 11, 1.2, col), 0, 7.1, 0, g);
      const tex = canvasTex(kit, 320, 220, (x2, W, H) => {
        x2.fillStyle = '#121a28'; x2.fillRect(0, 0, W, H);
        x2.fillStyle = '#e8ecf4'; x2.textAlign = 'right'; x2.font = '600 44px "IBM Plex Mono", monospace';
        x2.fillText(String(tg.A), 128, 86); x2.fillText(String(tg.Z), 128, 150);
        x2.textAlign = 'left'; x2.font = '700 110px "IBM Plex Mono", monospace'; x2.fillText(tg.s, 138, 142);
        x2.font = '600 30px "Golos Text", sans-serif'; x2.textAlign = 'center'; x2.fillStyle = tg.found ? '#86e0a8' : '#8b96ad'; x2.fillText(tg.found ? 'собрано ✓' : 'не собрано', W / 2, 200);
      });
      const pl = new T.Mesh(kit.keep(new T.PlaneGeometry(14.4, 9.8)), kit.keep(new T.MeshBasicMaterial({ map: tex.t }))); at(pl, 0, 7.1, 0.62, g);
      if (pick) at(glow(kit, col, 22, 0.35), 0, 7, 1.5, g);
    });
    tag(v3(-6, 16, -36), 'Цели', nf >= 3 ? (d.pick ? (d.pick === 'Fe' ? 'прочнее всех — железо-56 ✓' : 'выберите прочнее') : 'нажмите на самое прочное') : `собрано ${nf} из 3`, nf >= 3 && d.pick === 'Fe');
  };

  // =====================================================================================
  // 3. Ядерная реакция: частицы на подставках «до → после», весы сумм A и Z, пульт подбора
  SC['nucleus-react'] = (kit, d) => {
    const { T, at, box, cyl, tag, v3, C } = kit;
    const Zb = -16;
    const place = (arr, side) => {
      const n = arr.length;
      return arr.map((q, i) => {
        const x = side < 0 ? (n === 1 ? -30 : -44 + i * 26) : (n === 1 ? 30 : n === 2 ? 16 + i * 28 : 12 + i * 20);
        pedestal(kit, x, Zb, q.A > 100 ? 6 : 4.5);
        const o = particleObj(kit, q.A, q.Z, q.s);
        const y = 3 + o.R + (q.A > 0 ? 0.8 : 3);
        at(o.g, x, y, Zb);
        if (q.unk) {
          const sz = Math.max(10, 2 * o.R + 4);
          const gb = glass(kit, new T.BoxGeometry(sz, sz, sz), 0.12, d.bal ? OK : CP); at(gb, x, 3 + sz / 2, Zb);
          gb.add(new T.LineSegments(kit.keep(new T.EdgesGeometry(gb.geometry)), kit.keep(new T.LineBasicMaterial({ color: d.bal ? OK : CP }))));
        }
        const nm = q.A === 0 && q.Z === -1 ? 'e⁻' : q.A === 0 && q.Z === 1 ? 'e⁺' : q.A === 1 ? (q.Z === 1 ? 'p' : q.Z === 0 ? 'n' : q.s) : q.s;
        tag(v3(x, y + o.R + 4 + (q.unk ? 3 : 0), Zb), q.unk ? '? = ' + nm : nm, `A ${q.A} · Z ${String(q.Z).replace('-', '−')}`, q.unk && d.bal);
        return { g: o.g, home: o.g.position.clone() };
      });
    };
    const left = place(d.L || [], -1), right = place(d.R || [], 1);
    // стрелка
    const ar = new T.Group(); at(ar, 0, 7, Zb);
    at(box(9, 1.4, 1.6, 0x8b96ad), -1.5, 0, 0, ar);
    const tip = cyl(2, 3.6, 0x8b96ad, { r2: 0.01, seg: 16 }); tip.rotation.z = -Math.PI / 2; at(tip, 4.6, 0, 0, ar);
    const flash = glow(kit, GOLD, 10, 0); flash.visible = false; at(flash, 0, 10, Zb);
    tag(v3(0, 30, Zb - 4), `Реакция ${d.r + 1} из 4`, d.name);
    // весы сумм
    const tilt = (l, r) => l === r ? 0 : clamp((l - r) * 0.02, -0.3, 0.3) || 0, sgnMin = (l, r, a) => l === r ? 0 : Math.sign(a || (l - r)) * Math.max(0.08, Math.abs(a));
    const aA = sgnMin(d.AL, d.AR, tilt(d.AL, d.AR)), aZ = sgnMin(d.ZL, d.ZR, tilt(d.ZL, d.ZR));
    [['A', -26, d.AL, d.AR, aA], ['Z', 26, d.ZL, d.ZR, aZ]].forEach(([nm, x, l, r, a]) => {
      const s = scales(kit, x, 14, a, { H: 16, L: 11, drop: 7, pr: 4 });
      const okk = l === r;
      s.pans.forEach((p, i) => { const v = i ? r : l; const n = clamp(Math.round(Math.abs(v) / (nm === 'A' ? 30 : 12)) + (v ? 1 : 0), 0, 6); for (let k = 0; k < n; k++) at(cyl(2.4, 0.7, okk ? OK : CP, { seg: 18 }), p.top.x, p.top.y + 0.4 + k * 0.75, p.top.z); });
      tag(v3(x, 22, 14), 'Сумма ' + nm, `${String(l).replace('-', '−')} ${okk ? '=' : '≠'} ${String(r).replace('-', '−')}`, okk);
    });
    // пульт
    at(box(64, 2, 14, PANEL), 0, 1, 39);
    key(kit, 'A −', 0x9aa3b2, 'A-', -26, 39, { w: 7, d: 7, y: 2 });
    key(kit, 'A +', CP, 'A+', -18, 39, { w: 7, d: 7, y: 2 });
    key(kit, 'Z −', 0x9aa3b2, 'Z-', -6, 39, { w: 7, d: 7, y: 2 });
    key(kit, 'Z +', CYAN, 'Z+', 2, 39, { w: 7, d: 7, y: 2 });
    (d.solved || []).forEach((sv, i) => key(kit, String(i + 1) + (sv ? ' ✓' : ''), sv ? OK : i === d.r ? 0xe8ecf4 : 0x5d6a86, 'r-' + i, 13 + i * 6, 39, { w: 5.4, d: 7, y: 2, on: i === d.r }));
    tag(v3(-12, 7, 39), 'Пульт', d.ok ? '«?» — ' + d.pr : 'такой частицы нет', d.bal);
    // столкновение: частицы слева сходятся, справа разлетаются
    const C0 = v3(0, 9, Zb);
    const pose = () => {
      const L = live(), t = L.anim;
      if (t == null) { left.forEach(o => { o.g.visible = true; o.g.position.copy(o.home); }); right.forEach(o => { o.g.visible = true; o.g.position.copy(o.home); }); flash.visible = false; return; }
      const k1 = ease(t / 0.5), k2 = ease((t - 0.5) / 0.5);
      left.forEach(o => { o.g.visible = t < 0.5; o.g.position.copy(o.home).lerp(C0, k1); });
      right.forEach(o => { o.g.visible = t >= 0.5; o.g.position.copy(C0).lerp(o.home, k2); });
      flash.visible = t > 0.42 && t < 0.75; if (flash.visible) { const q = (t - 0.42) / 0.33; flash.scale.setScalar(6 + 30 * q); flash.material.opacity = 1 - q; }
    };
    pose(); kit.onFrame(pose);
  };

  // =====================================================================================
  // 4а. Дозы: шесть предметов на подставках, дозиметр у выбранного, шкала доз (каждое деление ×10)
  SC['nucleus-dose-scale'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, v3, C } = kit;
    const items = d.items || [], X = i => -50 + i * 20, Zs = -12;
    const build = (id, g) => {
      if (id === 'banana') {
        const b = kit.mesh(new T.TorusGeometry(5, 1.5, 10, 24, 2.4), 0xffd34d, { edges: false, hull: true }); b.rotation.x = -Math.PI / 2; b.rotation.z = 0.4; at(b, -1, 3.6, 2, g);
        at(cyl(0.5, 2, 0x6b5a2a, { seg: 8 }), 3, 4, -3, g).rotation.z = 1;
      } else if (id === 'npp') {
        const pts = [[6, 0], [4.6, 5], [3.9, 9], [4.3, 13]].map(([a, b]) => new T.Vector2(a, b));
        at(kit.mesh(new T.LatheGeometry(pts, 24), 0xd5dbe4, { edges: false, hull: false, matOpt: { side: T.DoubleSide } }), -1.5, 2, -1, g);
        at(glow(kit, 0xffffff, 9, 0.35), -1.5, 17, -1, g);
        at(box(4, 5, 4, 0x8b96ad), 4.5, 4.5, 3, g);
      } else if (id === 'flight') {
        at(cyl(0.6, 6, C.STEEL, { seg: 10 }), 0, 5, 0, g);
        const pl = new T.Group(); at(pl, 0, 9, 0, g); pl.rotation.y = 0.5;
        const fu = cyl(1.3, 13, 0xe8ecf4, { seg: 16 }); fu.rotation.z = Math.PI / 2; at(fu, 0, 0, 0, pl);
        at(ball(kit, 1.3, 0xe8ecf4, 0.05), 6.5, 0, 0, pl);
        at(box(3.4, 0.4, 15, 0x9aa3b2), 0.5, 0, 0, pl); at(box(1.8, 0.3, 5, 0x9aa3b2), -5.6, 0.4, 0, pl); at(box(2, 3, 0.3, 0x9aa3b2), -5.8, 1.8, 0, pl);
      } else if (id === 'xray') {
        at(box(12, 14, 1.6, 0x3b4459), 0, 9, 0, g); at(box(6, 1.6, 4, C.DARK), 0, 2.8, 0, g);
        const tex = canvasTex(kit, 192, 224, (x, W, H) => {
          x.fillStyle = '#0e1520'; x.fillRect(0, 0, W, H); x.strokeStyle = '#e8ecf4'; x.lineWidth = 6; x.beginPath(); x.moveTo(W / 2, 20); x.lineTo(W / 2, 200); x.stroke();
          x.lineWidth = 5; for (let i = 0; i < 6; i++) { const y = 46 + i * 26; x.beginPath(); x.moveTo(W / 2 - 6, y); x.quadraticCurveTo(W / 2 - 60, y - 14, W / 2 - 74, y + 16); x.moveTo(W / 2 + 6, y); x.quadraticCurveTo(W / 2 + 60, y - 14, W / 2 + 74, y + 16); x.stroke(); }
        });
        at(new T.Mesh(kit.keep(new T.PlaneGeometry(10.4, 12.2)), kit.keep(new T.MeshBasicMaterial({ map: tex.t }))), 0, 9, 0.82, g);
      } else if (id === 'bg') {
        at(kit.mesh(new T.ConeGeometry(6.5, 11, 6), 0x5d6a86, { edges: true }), -1, 7.5, 0, g);
        at(kit.mesh(new T.ConeGeometry(2.4, 4, 6), 0xf4f6fa, { edges: false }), -1, 11.5, 0, g);
        at(ball(kit, 1.8, GOLD, 0.9), 4.5, 15, -1, g); at(glow(kit, GOLD, 10, 0.7), 4.5, 15, -1, g);
      } else {
        const ring = kit.mesh(new T.TorusGeometry(5, 1.8, 12, 32), 0xe8ecf4, { edges: false, hull: true }); at(ring, 0, 8.5, -1, g);
        at(box(3.4, 1, 14, 0x9aa3b2), 0, 6, 1, g); at(box(2, 4, 2, C.DARK), 0, 3.5, 5, g);
      }
    };
    const selI = items.findIndex(q => q.id === d.src);
    items.forEach((q, i) => {
      const g = new T.Group(); at(g, X(i), 0, Zs); clickable(g, 'src-' + q.id);
      const sel = i === selI, seen = (d.seen || []).includes(q.id);
      at(box(15, 2, 15, sel ? PANEL : C.DARK), 0, 1, 0, g);
      if (seen) at(box(15.2, 0.3, 1.2, OK, { edges: false }), 0, 2.1, 7, g);
      build(q.id, g);
      if (sel) at(glow(kit, CP, 26, 0.3), 0, 8, 0, g);
      tag(v3(X(i), 2.5, Zs + 8.5), '', q.short + (seen ? ' · ' + q.v : ''));
    });
    // дозиметр
    const s = selI >= 0 ? items[selI] : null, dx = s ? X(selI) : 0;
    const dz = new T.Group(); at(dz, dx, 0, 10);
    at(box(8, 13, 4, 0xe6c14a), 0, 6.5, 0, dz);
    at(plate(kit, s ? s.v : '—', 6.4, 3.4, '#86e0a8', '#0e1520'), 0, 9.5, 2.05, dz);
    at(cyl(1.2, 5, 0x3b4459, { seg: 12 }), 2, 15.5, 0, dz);
    tag(v3(dx, 22, 10), 'Дозиметр', s ? `${s.full}: ${s.v}` : 'нажмите на предмет', !!s);
    // шкала доз
    const SX = lg => -60 + (lg + 5) / 7 * 120;
    at(box(124, 1.2, 9, C.DARK), 0, 0.6, 36);
    [[-5, -0.5, OK], [-0.5, 1, CP], [1, 2, 0xff8a73]].forEach(([a, b, col]) => at(box(SX(b) - SX(a), 0.8, 2.6, col, { edges: false }), (SX(a) + SX(b)) / 2, 1.6, 34));
    const TL = ['0,01 мкЗв', '0,1 мкЗв', '1 мкЗв', '10 мкЗв', '0,1 мЗв', '1 мЗв', '10 мЗв', '100 мЗв'];
    for (let e = -5; e <= 2; e++) { at(box(0.5, 1.4, 4, 0xe8ecf4, { edges: false }), SX(e), 1.9, 34); if (e < 2) at(plate(kit, TL[e + 5], 13, 2.6, '#a9b4c9', '#1a2438', true), SX(e) + (e === -5 ? 6 : 0), 1.25, 38.5); }
    for (const [v, ln] of [[0, true], [Math.log10(20), false]]) { at(cyl(0.35, 9, RED, { edges: false, hull: false }), SX(v), 5.6, 34); if (ln) tag(v3(SX(v), 11, 34), 'Предел', '1 мЗв в год для населения'); }
    items.filter(q => (d.seen || []).includes(q.id)).forEach(q => { const sel = q.id === d.src; at(ball(kit, sel ? 1.4 : 1, sel ? CP : OK, 0.5), SX(q.lg), 3.4, 34); });
    // ответ: что больше
    if (d.ask) {
      key(kit, 'перелёт', d.cmp === 'flight' ? 0xff8a73 : 0x9aa3b2, 'cmp-flight', 42, 22, { w: 12, d: 7 });
      key(kit, 'рентген', d.cmp === 'xray' ? OK : 0x9aa3b2, 'cmp-xray', 57, 22, { w: 12, d: 7 });
      tag(v3(49.5, 7, 22), 'Что больше?', d.cmp ? (d.cmp === 'xray' ? 'рентген — верно' : 'перелёт — проверьте') : 'нажмите ответ', d.cmp === 'xray');
    }
  };

  // =====================================================================================
  // 4б. Защита: три ряда «источник — преграда — счётчик» и стойка с пластинами
  const SHT = { paper: 0.4, al: 1.4, pb: 4.5, con: 7 }, SHC = { paper: 0xf4efe2, al: 0x9fb0c8, pb: LEAD, con: 0x7d8290 };
  SC['nucleus-dose-shield'] = (kit, d) => {
    const { T, at, box, tag, clickable, v3, C } = kit;
    const ROWZ = { a: -24, b: 0, g: 24 }, Yb = 6;
    const stops = (k, m) => m === 'paper' ? k === 'a' : (m === 'al' || m === 'pb' || m === 'con') ? k !== 'g' : false;
    const weakF = (k, m) => k === 'g' && (m === 'pb' || m === 'con');
    const movers = [];
    ['a', 'b', 'g'].forEach((k, ri) => {
      const z = ROWZ[k], m = (d.sh || {})[k] || 'none', act = d.row === k, col = RCOL[k];
      if (act) at(box(104, 0.2, 18, GOLD, { edges: false, matOpt: { transparent: true, opacity: 0.18, depthWrite: false } }), 0, 0.12, z);
      // источник
      const sg = new T.Group(); at(sg, -44, 0, z); clickable(sg, 'row-' + k);
      at(box(12, 10, 9, 0x3b4459), 0, 5, 0, sg);
      at(plate(kit, RSYM[k], 5, 5, hex(col), '#1a2438'), 0, 5.5, 4.56, sg);
      at(glow(kit, col, 5, 0.8), 6.2, Yb, 0, sg);
      // преграда
      const hg = new T.Group(); at(hg, 0, 0, z); clickable(hg, 'shc-' + k);
      at(box(9, 1.4, 15, C.DARK), 0, 0.7, 0, hg);
      if (m !== 'none') at(box(SHT[m], 13, 12, SHC[m]), 0, 7.9, 0, hg);
      else at(box(0.3, 13, 12, 0x9fc3d8, { matOpt: { transparent: true, opacity: 0.12, depthWrite: false } }), 0, 7.9, 0, hg);
      // счётчик
      const stopped = m !== 'none' && stops(k, m), weak = weakF(k, m), hit = !stopped, ok = (d.ok || [])[ri];
      at(box(9, 9, 9, 0x1a2438), 42, 4.5, z);
      const lamp = new T.Mesh(kit.keep(new T.SphereGeometry(1.4, 14, 10)), kit.toon(hit ? (weak ? CP : col) : 0x3a4762, { emissive: hit ? (weak ? CP : col) : 0x000000, emissiveIntensity: hit ? 0.9 : 0 }));
      at(lamp, 42, 10.4, z);
      if (hit) at(glow(kit, weak ? CP : col, weak ? 5 : 8, 0.7), 42, 10.4, z);
      // пучок
      const x0 = -37.6, w = m !== 'none' ? SHT[m] : 0;
      const t1 = glowTube(kit, [v3(x0, Yb, z), v3(m !== 'none' ? -w / 2 - 0.1 : 37.4, Yb, z)], col, 0.3);
      if (t1) movers.push({ c: t1.curve, col, n: 3 });
      if (m !== 'none' && stopped) at(glow(kit, col, 7, 0.8), -w / 2 - 0.6, Yb, z);
      if (m !== 'none' && !stopped) { const t2 = glowTube(kit, [v3(w / 2 + 0.1, Yb, z), v3(37.4, Yb, z)], col, weak ? 0.16 : 0.3, weak ? 0.4 : 1); if (t2) movers.push({ c: t2.curve, col, n: weak ? 1 : 2 }); }
      tag(v3(42, 15, z), RSYM[k] + (ok ? ' ✓' : ''), stopped ? 'стоп' : weak ? 'ослаблен' : 'проходит', !!ok);
      tag(v3(0, 16, z), '', m === 'none' ? 'нет преграды' : (d.names || {})[m] || m);
    });
    const dots = [];
    movers.forEach(mv => { for (let i = 0; i < mv.n; i++) { const s = glow(kit, mv.col, 3, 0.95); kit.root.add(s); dots.push({ s, mv, u: i / mv.n }); } });
    const pose = dt => dots.forEach(o => { if (!kit.reduce) o.u = (o.u + dt * 0.55) % 1; o.s.position.copy(o.mv.c.getPointAt(o.u)); });
    pose(0); kit.onFrame(pose);
    // стойка с пластинами: ставит в выбранный ряд
    at(box(78, 1.6, 10, C.WOOD2), -4, 0.8, 42);
    const cur = (d.sh || {})[d.row];
    ['paper', 'al', 'pb', 'con'].forEach((m, i) => {
      const x = -34 + i * 20, g = new T.Group(); at(g, x, 1.6, 41); clickable(g, 'm-' + m);
      const on = cur === m;
      at(box(Math.max(SHT[m], 0.8), 9, 8, SHC[m]), 0, 4.5 + (on ? 1.5 : 0), 0, g);
      at(plate(kit, (d.names || {})[m] || m, 14, 2.6, '#e8ecf4', on ? '#3f6a54' : '#1a2438', true), 0, 0.05, 4.2, g);
      if (on) at(glow(kit, GOLD, 16, 0.3), 0, 6, 0, g);
    });
    tag(v3(-4, 18, 42), 'Преграда для ' + (RSYM[d.row] || 'α'), cur && cur !== 'none' ? (d.names || {})[cur] || cur : 'не выбрана');
  };

  // =====================================================================================
  // 4в. Расстояние: свинцовый источник, рельс с метками, рамки 1–4–9 клеток, дозиметр и секундомер
  SC['nucleus-dose-dist'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, v3, C } = kit;
    const S0 = -56, M = 18.5, XR = r => S0 + r * M, Ya = 8;
    // источник
    at(cyl(5, 12, LEAD, { seg: 24 }), S0 - 3, 6, 0);
    at(cyl(5.4, 1.4, 0x3b4459, { seg: 24 }), S0 - 3, 12.7, 0);
    at(glow(kit, VIOLET, 10, 0.85), S0 + 2, Ya, 0);
    tag(v3(S0 - 3, 17, 0), 'Источник γ', '40 мкЗв/ч на 1 м');
    // рельс и линейка
    at(box(118, 1.2, 5, 0x5d6a86), 2, 0.6, 0);
    for (let r = 0.5; r <= 6; r += 0.5) at(box(0.4, 0.3, r % 1 ? 2 : 4, 0xe8ecf4, { edges: false }), XR(r), 1.35, 4.5);
    for (let r = 1; r <= 6; r++) at(plate(kit, r + ' м', 5, 2.4, '#a9b4c9', '#1a2438', true), XR(r), 0.65, 9);
    // рамки: тот же поток на 1, 4 и 9 клеток
    const lineMat = kit.keep(new T.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.55 }));
    for (let r = 1; r <= 3; r++) {
      const s = 4.4 * r, h = s / 2, pos = [];
      const x = XR(r);
      for (let i = 0; i <= r; i++) { const u = -h + i * s / r; pos.push(x, Ya - h, u, x, Ya + h, u, x, Ya + u, -h, x, Ya + u, h); }
      const g = kit.keep(new T.BufferGeometry()); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      kit.root.add(new T.LineSegments(g, lineMat));
      tag(v3(x, Ya + h + 2, 0), '', r * r === 1 ? '1 клетка' : r * r + ' клеток');
    }
    const cone = [[-1, -1], [1, -1], [1, 1], [-1, 1]].flatMap(([a, b]) => [S0 + 2, Ya, 0, XR(3), Ya + a * 6.6, b * 6.6]);
    const cg = kit.keep(new T.BufferGeometry()); cg.setAttribute('position', new T.Float32BufferAttribute(cone, 3));
    kit.root.add(new T.LineSegments(cg, kit.keep(new T.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.25 }))));
    // дозиметр на каретке
    const x = XR(d.dist), dm = new T.Group(); at(dm, x, 0, 0); clickable(dm, 'd+');
    at(box(7, 1.6, 6, C.DARK), 0, 2, 0, dm);
    at(box(6, 10, 4, d.low ? OK : 0xe6c14a), 0, 7.8, 0, dm);
    at(plate(kit, d.rate + ' мкЗв/ч', 5.2, 2.6, '#86e0a8', '#0e1520'), 0, 9.6, 2.05, dm);
    for (const [s, k] of [[-1, 'd-'], [1, 'd+']]) {
      const ag = new T.Group(); at(ag, x + s * 7, 3.2, 6); clickable(ag, k);
      const c = cyl(1.8, 3.4, CP, { r2: 0.01, seg: 14 }); c.rotation.z = -s * Math.PI / 2; at(c, 0, 0, 0, ag);
    }
    tag(v3(x, 17, 0), `Дозиметр · ${f(d.dist, d.dist % 1 ? 1 : 0)} м`, d.rate + ' мкЗв/ч', d.low);
    // секундомер
    const sw = new T.Group(); at(sw, 40, 0, 30); clickable(sw, 'tm');
    at(box(8, 1.4, 5, C.DARK), 0, 0.7, 0, sw);
    const body = cyl(5.2, 1.8, 0xd5dbe4, { seg: 32 }); body.rotation.x = Math.PI / 2; at(body, 0, 7, 0, sw);
    const fc = canvasTex(kit, 256, 256, (cx, W) => {
      cx.fillStyle = '#f7f3ea'; cx.beginPath(); cx.arc(W / 2, W / 2, W / 2, 0, 7); cx.fill();
      cx.strokeStyle = '#1b1610'; cx.lineWidth = 6; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; cx.beginPath(); cx.moveTo(W / 2 + Math.cos(a) * 112, W / 2 + Math.sin(a) * 112); cx.lineTo(W / 2 + Math.cos(a) * 96, W / 2 + Math.sin(a) * 96); cx.stroke(); }
      const frac = [0.25, 0.5, 1, 2][d.ti] ?? 1, a = -Math.PI / 2 + Math.min(1, frac / 2) * Math.PI * 2;
      cx.strokeStyle = '#c0392b'; cx.lineWidth = 8; cx.beginPath(); cx.moveTo(W / 2, W / 2); cx.lineTo(W / 2 + Math.cos(a) * 92, W / 2 + Math.sin(a) * 92); cx.stroke();
      cx.fillStyle = '#1b1610'; cx.font = '700 40px "Golos Text", sans-serif'; cx.textAlign = 'center'; cx.fillText(d.t || '', W / 2, W / 2 + 62);
    });
    const face = new T.Mesh(kit.keep(new T.CircleGeometry(4.6, 32)), kit.keep(new T.MeshBasicMaterial({ map: fc.t }))); at(face, 0, 7, 0.95, sw);
    at(cyl(0.8, 1.6, C.STEEL, { seg: 12 }), 0, 13, 0, sw);
    tag(v3(40, 16, 30), 'Доза за ' + (d.t || ''), (d.dose || '0') + ' мкЗв' + (d.low ? ' — меньше 1 ✓' : ''), !!d.low);
  };

  // =====================================================================================
  // 5. АЭС: реактор со стержнями, насос, парогенератор, турбина, генератор, градирня, дома, пульт
  SC['nucleus-npp'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, v3, C } = kit;
    const RX = -46, RZ = -6;
    // реактор
    at(cyl(12, 2, C.DARK, { seg: 32 }), RX, 1, RZ);
    const ves = glass(kit, new T.CylinderGeometry(9, 9, 30, 36, 1, true), 0.2); at(ves, RX, 17, RZ);
    at(cyl(9.4, 1.2, 0x8b96ad, { seg: 32 }), RX, 32.4, RZ);
    const water = glass(kit, new T.CylinderGeometry(8.6, 8.6, 26, 32), 0.22, 0x5fb4d9); at(water, RX, 15.5, RZ);
    const fuelMat = ownMat(kit, 0xc9a36a, { emissive: 0xff9a2a, emissiveIntensity: 0.1 });
    const fuelGeo = kit.keep(new T.CylinderGeometry(0.9, 0.9, 16, 12));
    const fpos = [[0, 0]]; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; fpos.push([Math.cos(a) * 5, Math.sin(a) * 5]); }
    fpos.forEach(([x, z]) => { const m = new T.Mesh(fuelGeo, fuelMat); m.add(new T.Mesh(fuelGeo, kit.hullMat)); at(m, RX + x, 13, RZ + z); });
    const coreGlow = glow(kit, 0xff9a2a, 22, 0); at(coreGlow, RX, 13, RZ);
    // управляющие стержни на траверсе
    const rods = new T.Group(); at(rods, RX, 0, RZ); clickable(rods, 'hup');
    for (let i = 0; i < 3; i++) { const a = (i / 3 + 1 / 12) * Math.PI * 2; at(cyl(0.7, 18, 0x2b3245, { seg: 10 }), Math.cos(a) * 2.7, 14, Math.sin(a) * 2.7, rods); }
    at(box(8, 1, 8, 0x8b96ad), 0, 23.5, 0, rods);
    at(cyl(0.5, 14, C.STEEL, { seg: 10, edges: false }), 0, 30.5, 0, rods);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) at(box(0.8, 16, 0.8, 0x5d6a86), RX + sx * 4.5, 41, RZ + sz * 4.5);
    at(box(11, 1.4, 11, 0x5d6a86), RX, 49.4, RZ);
    // нейтроны в активной зоне
    const neu = []; for (let i = 0; i < 24; i++) { const s = glow(kit, 0xffffff, 1.6, 0.95); s.visible = false; kit.root.add(s); neu.push(s); }
    // трубы
    const hotMat = ownMat(kit, 0xd98a4e), coldMat = kit.toon(0x5fb4d9);
    const pipe = (a, b, mat, r = 1.2) => rod(kit, a, b, r, 0, { mat });
    pipe(v3(RX + 9, 26, RZ), v3(-22, 26, RZ), hotMat);
    const cold = [v3(-16, 4, RZ + 6.5), v3(-16, 4, 10), v3(RX, 4, 10), v3(RX, 4, RZ + 8.6)];
    for (let i = 0; i + 1 < cold.length; i++) pipe(cold[i], cold[i + 1], coldMat);
    // насос на холодной трубе
    const pump = new T.Group(); at(pump, -31, 0, 10); clickable(pump, 'pump');
    at(box(9, 2, 8, C.DARK), 0, 1, 0, pump);
    const pb = cyl(3.6, 6, d.pump ? 0x3fae5a : 0xc8483a, { seg: 24 }); pb.rotation.x = Math.PI / 2; at(pb, 0, 5, 0, pump);
    const imp = new T.Group(); at(imp, 0, 5, 3.2, pump);
    at(box(6, 0.8, 0.4, 0xe8ecf4, { edges: false }), 0, 0, 0, imp); at(box(0.8, 6, 0.4, 0xe8ecf4, { edges: false }), 0, 0, 0, imp);
    // парогенератор
    at(cyl(6, 30, 0xd5dbe4, { seg: 28 }), -16, 17, RZ);
    // пар к турбине
    const steamMat = kit.toon(0xe8ecf4);
    pipe(v3(-16, 32, RZ), v3(-16, 37, RZ), steamMat, 1.1); pipe(v3(-16, 37, RZ), v3(8, 37, RZ), steamMat, 1.1); pipe(v3(8, 37, RZ), v3(8, 22, RZ), steamMat, 1.1);
    // турбина: прозрачный корпус, внутри три колеса с лопатками
    const TY = 16;
    const casing = glass(kit, new T.CylinderGeometry(5, 8.5, 24, 28, 1, true), 0.22, 0x9aa3b2); casing.rotation.z = Math.PI / 2; at(casing, 18, TY, RZ);
    at(box(26, TY - 8, 12, 0x5fb4d9, { matOpt: { transparent: true, opacity: 0.5 } }), 18, (TY - 8) / 2, RZ);
    const rotor = new T.Group(); at(rotor, 18, TY, RZ);
    const sh = cyl(1, 44, C.STEEL, { seg: 12 }); sh.rotation.z = Math.PI / 2; at(sh, 11, 0, 0, rotor);
    [-8, 0, 8].forEach((x, wi) => { const R = 4.5 + wi * 1.4; for (let i = 0; i < 8; i++) { const bl = box(0.5, R, 1.6, 0xa9b4c9, { edges: false }); const a = i / 8 * Math.PI * 2; bl.position.set(x, Math.cos(a) * R / 2, Math.sin(a) * R / 2); bl.rotation.x = a; bl.rotation.y = 0.4; rotor.add(bl); } });
    // генератор
    const gen = cyl(6, 14, 0x3f6a54, { seg: 28 }); gen.rotation.z = Math.PI / 2; at(gen, 44, TY, RZ);
    at(box(14, TY - 6, 10, C.DARK), 44, (TY - 6) / 2, RZ);
    // градирня с паром
    const pts = [[13, 0], [9.5, 14], [8.4, 24], [9.4, 32]].map(([a, b]) => new T.Vector2(a, b));
    at(kit.mesh(new T.LatheGeometry(pts, 32), 0xd5dbe4, { edges: false, hull: false, matOpt: { side: T.DoubleSide } }), 52, 0, -34);
    const puffs = []; for (let i = 0; i < 5; i++) { const s = glow(kit, 0xffffff, 12, 0.3); at(s, 52, 36 + i * 5, -34); puffs.push(s); }
    // ЛЭП и дома
    const wireMat = ownMat(kit, 0x3a4762);
    at(box(1.2, 24, 1.2, 0x8b96ad), 56, 12, 10); at(box(8, 1, 1, 0x8b96ad), 56, 23, 10);
    pipe(v3(50, TY + 2, RZ), v3(56, 23.6, 10), wireMat, 0.25);
    const houses = [];
    for (let i = 0; i < 6; i++) {
      const hx = 28 + (i % 3) * 13, hz = 30 + Math.floor(i / 3) * 12;
      at(box(8, 6, 7, 0xd5c4a8), hx, 3, hz);
      const roof = kit.mesh(new T.ConeGeometry(6.4, 4, 4), 0x8a4b3a, { edges: true }); roof.rotation.y = Math.PI / 4; at(roof, hx, 8, hz);
      const win = new T.Mesh(kit.keep(new T.PlaneGeometry(2.6, 2.2)), kit.toon(0x26324a)); at(win, hx, 3.5, hz + 3.52); houses.push(win);
      pipe(v3(56, 23.6, 10), v3(hx, 6, hz), wireMat, 0.18);
    }
    // пульт
    const desk = new T.Group(); at(desk, -40, 0, 36);
    at(box(36, 8, 12, PANEL), 0, 4, 0, desk);
    key(kit, '▲ стержни', 0x9aa3b2, 'hup', -52, 36, { w: 10, d: 7, y: 8 });
    key(kit, '▼ стержни', 0x9aa3b2, 'hdn', -40, 36, { w: 10, d: 7, y: 8 });
    const sc = new T.Group(); at(sc, -28, 8, 36); clickable(sc, 'scram');
    at(cyl(2.8, 2, 0xffd166, { seg: 20 }), 0, 1, 0, sc); at(cyl(2.4, 2, d.scram ? 0xff3a1a : RED, { seg: 20, matOpt: d.scram ? { emissive: 0xff3a1a, emissiveIntensity: 0.8 } : {} }), 0, 3, 0, sc);
    // подписи
    const tR = liveTag(kit, v3(RX, 54, RZ), 'Реактор', '—');
    const tW = liveTag(kit, v3(-16, 36, RZ + 8), 'Вода', '—');
    tag(v3(-31, 13, 10), 'Насос', d.pump ? 'работает' : 'выключен', d.pump);
    const tG = liveTag(kit, v3(44, TY + 10, RZ), 'Генератор', '—');
    const tD = liveTag(kit, v3(-40, 16, 36), 'Пульт', d.scram ? 'аварийная защита' : '—', d.scram);
    tag(v3(18, TY + 11, RZ + 6), 'Турбина', 'пар крутит лопатки');
    const c0 = new T.Color(0xd98a4e), c1 = new T.Color(0xff5a1a), cw0 = new T.Color(0x3a4762), cw1 = new T.Color(0xffb547);
    let tt = 0, pa = 0;
    const nseed = neu.map((s, i) => [Math.random() * 6.28, Math.random() * 6.28, 0.6 + Math.random()]);
    const pose = dt => {
      const L = live(), P = L.P ?? 0.1, h = L.h ?? 1, heat = clamp(P / 100, 0, 1.3);
      if (!kit.reduce) tt += dt;
      rods.position.y = (1 - h) * 16;
      fuelMat.emissiveIntensity = 0.08 + 0.9 * Math.min(heat, 1.2);
      coreGlow.material.opacity = 0.5 * Math.min(heat, 1.2);
      hotMat.color.copy(c0).lerp(c1, Math.min(1, heat));
      const nn = Math.round(clamp(Math.log10(P * 10 + 1) * 6, 0, 24));
      neu.forEach((s, i) => { s.visible = i < nn; if (!s.visible) return; const q = nseed[i], ph = tt * q[2] * 2 + i; s.position.set(RX + Math.sin(ph * 1.3 + q[0]) * 6.5, 13 + Math.cos(ph * 0.9 + q[1]) * 7.5, RZ + Math.cos(ph * 1.1 + q[0]) * 6.5); });
      rotor.rotation.x = kit.reduce ? 0 : (L.ph || 0) * Math.PI * 2;
      if (d.pump && !kit.reduce) { pa += dt * 8; imp.rotation.z = pa; }
      const lit = clamp(Math.round((L.Pel || 0) / 1000 * 6), 0, 6);
      houses.forEach((w, i) => { w.material = i < lit ? kit.toon(GOLD, { emissive: GOLD, emissiveIntensity: 0.9 }) : kit.toon(0x26324a); });
      wireMat.color.copy(cw0).lerp(cw1, (L.Pel || 0) > 5 ? 1 : 0);
      puffs.forEach((s, i) => { const k = ((tt * 0.25 + i / puffs.length) % 1); s.position.y = 34 + k * 26; s.material.opacity = 0.45 * Math.min(1, heat) * (1 - k); s.scale.setScalar(10 + k * 14); });
      const inBand = P >= 95 && P <= 105;
      tR.set(`${L.fP ?? '—'} % · k ${L.fk ?? '—'}`, inBand);
      tW.set(`${L.fT ?? '—'} °C`, (L.T || 0) > 330);
      tG.set(`${L.fPel ?? '0'} МВт`, (L.Pel || 0) > 5);
      tD.set(d.scram ? 'аварийная защита' : `100 % держится ${f(Math.min(L.hold || 0, 5), 1)} из 5 с`, !!d.scram || (L.hold || 0) >= 5);
    };
    pose(0); kit.onFrame(pose);
  };
})();
