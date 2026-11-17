// «Как в жизни» для темы «Элементарные частицы» (labs/phys-particles): модель протона из трёх кварков с глюонами,
// вакуумная трубка, где сталкиваются электрон и позитрон (или γ-квант рождает пару у свинцовой мишени), ПЭТ-сканер
// с кольцом детекторов, камера Вильсона между полюсами электромагнита со следами частиц, кольцо коллайдера
// с детектором и стена-таблица Стандартной модели. Сцены строятся из window.LUCH_REAL() опыта; движение
// (сближение частиц, вспышка, разлёт квантов, пучки в кольце) — из window.LUCH_REAL.live() каждый кадр.
// Набор деталей kit — из /luch/real3d.js.
(() => {
  const SC = (window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {});
  const QCOL = [0xff6b6b, 0x5fd38d, 0x5fa8ff], GOLD = 0xffd166, CYAN = 0x72d4e8, RED = 0xff8a73, BLUE = 0x2f6fd8, STEEL2 = 0x9aa3b2,
    COPPER = 0xd98a4e, GLASS = 0xcfe6f2, DARKB = 0x1d2a3e, TRACK = 0xe6eef8;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const ease = p => p < 0 ? 0 : p > 1 ? 1 : p * p * (3 - 2 * p);
  const live = () => { try { return (window.LUCH_REAL && window.LUCH_REAL.live && window.LUCH_REAL.live()) || {}; } catch (e) { return {}; } };
  const lastTag = () => { const l = document.querySelectorAll('.rl-view .rl-lbl'); return l[l.length - 1] || null; };
  function liveTag(kit, p, name, value, hot) {
    kit.tag(p, name, value, hot);
    const el = lastTag(), i = el && el.querySelector('i');
    let shown = value;
    return { p, el, set(v) { if (i && v !== shown) { shown = v; i.textContent = v; } } };
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
  function ball(kit, r, col, emis = 0.25) {
    const { T, keep } = kit;
    const m = new T.Mesh(keep(new T.SphereGeometry(r, 24, 16)), keep(new T.MeshToonMaterial({ color: col, gradientMap: kit.grad, emissive: col, emissiveIntensity: emis })));
    m.add(new T.Mesh(m.geometry, kit.hullMat)); m.castShadow = true; return m;
  }
  // тонкий стержень между двумя точками, который можно двигать каждый кадр
  function link(kit, r, col, op) {
    const { T, keep } = kit;
    const m = new T.Mesh(keep(new T.CylinderGeometry(r, r, 1, 8)), keep(new T.MeshBasicMaterial({ color: col, transparent: op != null, opacity: op ?? 1, depthWrite: op == null })));
    kit.root.add(m);
    const UP = new T.Vector3(0, 1, 0), d = new T.Vector3();
    return { m, set(a, b) { d.copy(b).sub(a); const L = d.length(); m.visible = L > 0.01; m.position.copy(a).addScaledVector(d, 0.5); m.scale.set(1, Math.max(0.001, L), 1); if (L > 0.01) m.quaternion.setFromUnitVectors(UP, d.normalize()); } };
  }
  // светящаяся линия по точкам; grow(f) показывает её часть от начала
  function glowTube(kit, pts, col, r = 0.35, op = 1) {
    const { T, keep } = kit;
    if (pts.length < 2) return { grow() {} };
    const curve = new T.CatmullRomCurve3(pts), n = Math.max(8, pts.length * 2), rs = 6;
    const core = new T.Mesh(keep(new T.TubeGeometry(curve, n, r, rs)), keep(new T.MeshBasicMaterial({ color: col, transparent: op < 1, opacity: op })));
    const halo = new T.Mesh(keep(new T.TubeGeometry(curve, n, r * 2.6, rs)), keep(new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.2 * op, blending: T.AdditiveBlending, depthWrite: false })));
    kit.root.add(core); kit.root.add(halo);
    return { curve, grow(f) { const c = Math.round(clamp(f, 0, 1) * n) * rs * 6; core.geometry.setDrawRange(0, c); halo.geometry.setDrawRange(0, c); } };
  }
  function canvasTex(kit, w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    draw(x, w, h);
    const t = new kit.T.CanvasTexture(c); t.colorSpace = kit.T.SRGBColorSpace; t.anisotropy = 4; return kit.keep(t);
  }
  const hex = c => '#' + c.toString(16).padStart(6, '0');

  // =====================================================================================
  // 1. Протон (или нейтрон): прозрачный «мешок» на подставке, внутри три кварка, между ними глюоны
  SC['particles-proton'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, v3, C } = kit;
    const Y = 34, R = 19;
    at(box(30, 3, 22, C.DARK), 0, 1.5, 0);
    at(cyl(1.2, Y - R - 3, C.STEEL, { seg: 14 }), 0, 3 + (Y - R - 3) / 2, 0);
    at(cyl(4, 1.4, C.DARK, { seg: 20 }), 0, Y - R + 0.5, 0);
    const bag = new T.Group(); at(bag, 0, Y, 0); clickable(bag, 'swap');
    const isP = d.q.filter(x => x === 'u').length === 2 && d.q.length === 3;
    const shell = glass(kit, new T.SphereGeometry(R, 40, 28), 0.16, isP ? 0xffb09c : d.q.join('') === 'udd' || d.q.slice().sort().join('') === 'ddu' ? 0xc8d0de : 0xffe08a);
    bag.add(shell);
    const rim = kit.mesh(new T.TorusGeometry(R, 0.15, 6, 64), 0x9fc3d8, { edges: false, hull: false }); rim.rotation.x = Math.PI / 2; bag.add(rim);
    bag.add(glow(kit, isP ? 0xff8a73 : 0xa9b4c9, R * 2.6, 0.25));
    // кварки
    const home = [0, 1, 2].map(i => { const a = -Math.PI / 2 + i * 2 * Math.PI / 3; return v3(Math.cos(a) * 8.5, -Math.sin(a) * 8.5, Math.sin(a * 2) * 2); });
    const qs = d.q.map((q, i) => { const b = ball(kit, 4.2, QCOL[i], 0.3); bag.add(b); b.position.copy(home[i]); return b; });
    // глюоны: жёлтые пружинки — несколько звеньев-зигзагов
    const gl = [];
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) { const segs = []; for (let k = 0; k < 10; k++) segs.push(link(kit, 0.32, GOLD)); gl.push({ i, j, segs }); }
    const wa = new T.Vector3(), wb = new T.Vector3(), tmp = new T.Vector3(), nrm = new T.Vector3(), Z = new T.Vector3(0, 0, 1);
    const tags = d.q.map((q, i) => liveTag(kit, v3(0, 0, 0), '', `${q} ${q === 'u' ? '+2/3' : '−1/3'}`));
    tag(v3(0, Y + R + 6, 0), d.had, 'заряд ' + d.Q, true);
    tag(v3(0, 6, 13), 'Модель', 'кварки держат глюоны');
    let t0 = 0;
    const pose = (dt, t) => {
      t0 += kit.reduce ? 0 : dt;
      bag.rotation.y = kit.reduce ? 0.3 : t0 * 0.25;
      qs.forEach((b, i) => { b.position.set(home[i].x + Math.sin(t0 * 2.1 + i * 2) * 1.4, home[i].y + Math.cos(t0 * 1.7 + i) * 1.4, home[i].z + Math.sin(t0 * 2.6 + i * 1.3) * 1.4); });
      bag.updateMatrixWorld(true);
      gl.forEach(g => {
        wa.copy(qs[g.i].position).applyMatrix4(bag.matrixWorld); wb.copy(qs[g.j].position).applyMatrix4(bag.matrixWorld);
        tmp.copy(wb).sub(wa); const L = tmp.length(); nrm.copy(tmp).cross(Z).normalize();
        let prev = wa.clone().addScaledVector(tmp, 4.6 / L);
        g.segs.forEach((s, k) => {
          const f = 4.6 / L + (k + 1) / g.segs.length * (1 - 9.2 / L), p = wa.clone().addScaledVector(tmp, f).addScaledVector(nrm, (k % 2 ? 1 : -1) * 0.9 * (k === g.segs.length - 1 ? 0 : 1));
          s.set(prev, p); prev = p;
        });
      });
      qs.forEach((b, i) => { tags[i].p.copy(b.position).applyMatrix4(bag.matrixWorld); tags[i].p.y += 5.5; });
    };
    pose(0, 0);
    kit.onFrame(pose);
  };

  // =====================================================================================
  // 2. Аннигиляция и рождение пары: вакуумная трубка на стойках, два счётчика γ-квантов, магнит для пары
  SC['particles-anni'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, v3, C } = kit;
    const Y = 16, Lt = 100;
    // трубка вдоль x
    const tube = glass(kit, new T.CylinderGeometry(5, 5, Lt, 32, 1, true), 0.16); tube.rotation.z = Math.PI / 2; at(tube, 0, Y, 0);
    [-1, 1].forEach(s => { const cap = cyl(5.4, 2, C.STEEL, { seg: 24 }); cap.rotation.z = Math.PI / 2; at(cap, s * (Lt / 2 + 1), Y, 0); at(box(3, Y - 5, 6, C.DARK), s * 38, (Y - 5) / 2, 0); });
    // «пушки» на концах
    const gunE = cyl(2.4, 8, 0x2e8fb0, { seg: 16 }); gunE.rotation.z = Math.PI / 2; at(gunE, -Lt / 2 - 6, Y, 0);
    const gunP = cyl(2.4, 8, 0xc8483a, { seg: 16 }); gunP.rotation.z = Math.PI / 2; at(gunP, Lt / 2 + 6, Y, 0);
    const pair = d.mode === 'pair', ok = d.ok;
    if (!pair) {
      const e = ball(kit, 2.6, CYAN, 0.5), pos = ball(kit, 2.6, RED, 0.5); kit.root.add(e); kit.root.add(pos);
      clickable(e, 'collide'); clickable(pos, 'collide'); clickable(gunE, 'collide');
      const eg = glow(kit, CYAN, 9, 0.6), pg = glow(kit, RED, 9, 0.6); kit.root.add(eg); kit.root.add(pg);
      const flash = glow(kit, GOLD, 10, 0.9); at(flash, 0, Y, 0);
      // направление разлёта квантов в плоскости стола
      const dir = v3(Math.cos(d.a), 0, Math.sin(d.a)).normalize();
      const det = [1, -1].map(s => { const g = new T.Group(); at(g, dir.x * 46 * s, 0, dir.z * 40 * s); at(box(8, 12, 8, 0x3b4a66), 0, 6, 0, g); const face = box(6.4, 6.4, 0.6, 0x88e0ff, { matOpt: { emissive: 0x3fc8ff, emissiveIntensity: 0.1 } }); at(face, 0, 9, 0, g); face.lookAt(v3(0, 9, 0)); g.lookAt(v3(0, 0, 0)); return { g, face }; });
      const ph = [1, -1].map(() => { const b = ball(kit, 1.6, GOLD, 0.8); kit.root.add(b); const gg = glow(kit, GOLD, 10, 0.8); kit.root.add(gg); return { b, gg }; });
      const tE = liveTag(kit, v3(-40, Y + 9, 0), 'Электрон', 'mc² = 0,511 МэВ'), tP = liveTag(kit, v3(40, Y + 9, 0), 'Позитрон', 'mc² = 0,511 МэВ');
      const tG = liveTag(kit, v3(0, Y + 14, 0), 'Аннигиляция', d.done ? '2 γ по 0,511 МэВ' : 'нажмите на частицу');
      tag(v3(det[0].g.position.x, 16, det[0].g.position.z), 'Счётчик квантов', '0,511 МэВ');
      const pose = () => {
        const L = live(), p = L.a === 'ann' ? L.p : d.done ? 99 : 0;
        const k = ease(Math.min(1, p)), x = 46 - (46 - 2.6) * k;
        e.visible = pos.visible = pg.visible = eg.visible = p < 1;
        e.position.set(-x, Y, 0); pos.position.set(x, Y, 0); eg.position.copy(e.position); pg.position.copy(pos.position);
        tE.p.set(-x, Y + 7, 0); tP.p.set(x, Y + 7, 0);
        tE.el.style.visibility = tP.el.style.visibility = p < 1 ? '' : 'hidden';
        flash.visible = p >= 0.95 && p < 1.6; if (flash.visible) { const f = (p - 0.95) / 0.65; flash.scale.setScalar(6 + 30 * f); flash.material.opacity = 1 - f; }
        const dd = p >= 1.1 ? Math.min(42, (p - 1.1) * 60) : -1;
        ph.forEach((o, i) => { const s = i ? -1 : 1; o.b.visible = o.gg.visible = dd >= 0 && dd < 42; if (dd >= 0) { o.b.position.set(dir.x * dd * s, Y, dir.z * dd * s * (40 / 46)); o.gg.position.copy(o.b.position); } });
        const hit = dd >= 41; det.forEach(o => { o.face.material.emissiveIntensity = hit ? 1 : 0.1; });
        tG.set(p >= 1.1 ? '2 γ по 0,511 МэВ' : p > 0 && p < 1.1 ? 'летят навстречу…' : 'нажмите на частицу');
      };
      pose(); kit.onFrame(pose);
      return;
    }
    // рождение пары: свинцовая мишень в центре, полюса магнита сверху и снизу трубки
    const lead = box(3, 9, 9, 0x6c7a96); at(lead, 0, Y, 0); clickable(lead, 'collide'); clickable(gunE, 'collide');
    at(box(56, 2, 34, BLUE), 0, 2.2, 0);
    const top = box(56, 2, 34, RED, { matOpt: { transparent: true, opacity: 0.35, depthWrite: false } }); at(top, 0, Y + 9, 0);
    at(box(3, Y + 8, 34, 0x5d6a86), -29.5, (Y + 8) / 2 + 1, 0);
    const gq = ball(kit, 1.6, GOLD, 0.9); kit.root.add(gq); const gg = glow(kit, GOLD, 10, 0.8); kit.root.add(gg);
    const flash = glow(kit, GOLD, 10, 0.9); at(flash, 0, Y, 0);
    // спирали e⁻ и e⁺ в плоскости y = Y (поле вертикальное)
    const K = Math.max(0, (d.E - 1.022) / 2), R0 = 4 + 10 * K, Ls = R0 * 8;
    const spiral = sgn => { const pts = []; let x = 1.6, z = 0, th = sgn * 0.3; for (let s = 0; s < Ls; s += 0.6) { th += sgn / Math.max(0.8, R0 * (1 - 0.85 * s / Ls)) * 0.6; x += Math.cos(th) * 0.6; z += Math.sin(th) * 0.6; pts.push(v3(x, Y, z)); } return pts; };
    const sE = ok ? glowTube(kit, spiral(1), 0xbfe9f5, 0.22) : null, sP = ok ? glowTube(kit, spiral(-1), 0xffd2c4, 0.22) : null;
    tag(v3(0, Y + 13, 0), 'Свинцовая мишень', `γ ${String(d.E).replace('.', ',')} МэВ`);
    const tR = liveTag(kit, v3(30, Y + 12, 0), 'Итог', ok == null ? 'выстрелите' : ok ? 'родилась пара e⁻ e⁺' : 'пары нет: < 1,022 МэВ', ok);
    tag(v3(14, 4, 19), 'Магнит', 'поле вертикально');
    const pose = () => {
      const L = live(), p = L.a === 'pair' ? L.p : ok == null ? -1 : 99;
      if (p < 0) { gq.visible = gg.visible = true; gq.position.set(-44, Y, 0); }
      else {
        const k = clamp(p / 0.9, 0, 1), x = -44 + 42 * k;
        const xx = !ok && p >= 0.9 ? Math.min(46, -2 + (p - 0.9) * 50) : x;
        gq.visible = gg.visible = (!ok || p < 0.9) && xx < 46; gq.position.set(xx, Y, 0);
      }
      gg.position.copy(gq.position);
      flash.visible = !!ok && p >= 0.9 && p < 1.4; if (flash.visible) { const f = (p - 0.9) / 0.5; flash.scale.setScalar(5 + 20 * f); flash.material.opacity = 1 - f; }
      if (sE) { const f = p < 0 ? 0 : clamp((p - 0.95) / 1.2, 0, 1); sE.grow(f); sP.grow(f); }
      tR.set(ok == null ? 'выстрелите' : p < 0.9 ? 'летит…' : ok ? 'родилась пара e⁻ e⁺' : 'пары нет: < 1,022 МэВ');
    };
    pose(); kit.onFrame(pose);
  };

  // =====================================================================================
  // 3. ПЭТ-сканер: кольцо детекторов, стол с пациентом, линии совпадений
  SC['particles-pet'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, v3, C, keep } = kit;
    const Yc = 30, Rr = 22, Rb = 28;
    const g = new T.Group(); at(g, 0, 0, -4); clickable(g, 'scan');
    // корпус-«бублик»
    const shell = kit.mesh(new T.TorusGeometry((Rr + Rb) / 2 + 1, (Rb - Rr) / 2 + 2.6, 16, 64), 0xe8ecf4, { edges: false, hull: true }); at(shell, 0, Yc, 0, g);
    at(box(40, Yc - Rb + 2, 16, 0xd5dbe4), 0, (Yc - Rb + 2) / 2, 0, g);
    // кристаллы-детекторы на внутренней стороне
    const lit = [];
    for (let i = 0; i < 36; i++) {
      const a = i / 36 * Math.PI * 2, b = box(3.6, 2.4, 6, 0x2b3a57, { edges: false, matOpt: { emissive: 0xffd166, emissiveIntensity: 0 } });
      b.position.set(Math.cos(a) * (Rr + 1.2), Yc + Math.sin(a) * (Rr + 1.2), 0); b.rotation.z = a + Math.PI / 2; g.add(b); lit.push(b);
    }
    // стол и пациент
    at(box(14, 3, 90, 0xd5dbe4), 0, Yc - 13, 20);
    at(box(3, Yc - 14.5, 3, 0x5d6a86), 0, (Yc - 14.5) / 2, 50);
    const body = cyl(6, 50, 0x6f87b3, { seg: 20 }); body.rotation.x = Math.PI / 2; at(body, 0, Yc - 6.5, 30);
    const head = ball(kit, 6.2, 0xe6b89c, 0.05); head.scale.set(0.9, 1, 1.15); at(head, 0, Yc - 4, 0);
    // линии совпадений: координаты из 2D (центр 260/228, радиус 108)
    const map = (x, y) => [(x - 260) / 108 * Rr, Yc - (y - 228) / 108 * Rr];
    const pos = [];
    (d.ev || []).forEach(e => { const a = map(e[0], e[1]), b = map(e[2], e[3]); pos.push(a[0], a[1], -4, b[0], b[1], -4); });
    if (pos.length) {
      const geo = keep(new T.BufferGeometry()); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      kit.root.add(new T.LineSegments(geo, keep(new T.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.55 }))));
      // кристаллы на концах последних линий подсвечены
      (d.ev || []).slice(-10).forEach(e => [[e[0], e[1]], [e[2], e[3]]].forEach(([x, y]) => { let a = Math.atan2(-(y - 228), x - 260); if (a < 0) a += Math.PI * 2; lit[Math.floor(a / (Math.PI * 2) * 36) % 36].material = kit.toon(0x2b3a57, { emissive: 0xffd166, emissiveIntensity: 0.9 }); }));
    }
    if (d.found) { const [x, y] = map(d.tum[0], d.tum[1]); const s = glow(kit, 0xff6b4a, 8, 0.95); at(s, x, y, -2); }
    tag(v3(0, Yc + Rb + 6, -4), 'ПЭТ-сканер', `линий: ${d.n}`);
    tag(v3(0, Yc - 4, 10), 'Пациент', d.found ? 'опухоль найдена' : 'фтор-18 в глюкозе', d.found);
    tag(v3(0, Yc - 11, 60), 'Стол', 'въезжает в кольцо');
  };

  // =====================================================================================
  // 4. Камера Вильсона: стеклянный короб на чёрном дне между полюсами электромагнита, следы — белые нити капель
  SC['particles-chamber'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, v3, C } = kit;
    const S = 0.2, B = d.box, W = (B.x1 - B.x0) * S, D = (B.y1 - B.y0) * S, cx = ((B.x0 + B.x1) / 2 - 260) * S, cz = ((B.y0 + B.y1) / 2 - 252) * S;
    const Yb = 7, H = 9;
    const mx = x => (x - 260) * S, mz = y => (y - 252) * S;
    // нижний полюс магнита и катушка
    const mag = new T.Group(); at(mag, 0, 0, 0); clickable(mag, 'field');
    const pc = d.B > 0 ? RED : d.B < 0 ? BLUE : 0x5d6a86, pc2 = d.B > 0 ? BLUE : d.B < 0 ? RED : 0x5d6a86;
    at(box(W + 10, 3.4, D + 10, pc), cx, 1.7, cz, mag);
    for (const s of [-1, 1]) { const coil = cyl(5, 3, COPPER, { seg: 24 }); at(coil, cx + s * (W / 2 + 1), 5, cz + D / 2 + 2, mag); }
    // дно камеры и стекло
    at(box(W, Yb - 3.4, D, 0x0d1118), cx, 3.4 + (Yb - 3.4) / 2, cz);
    const gl = glass(kit, new T.BoxGeometry(W, H, D), 0.12); at(gl, cx, Yb + H / 2, cz);
    const ed = new T.LineSegments(kit.keep(new T.EdgesGeometry(gl.geometry)), kit.edgeMat); gl.add(ed);
    // верхний полюс — полупрозрачный
    const topP = box(W + 10, 2.4, D + 10, pc2, { matOpt: { transparent: true, opacity: 0.22, depthWrite: false }, edges: true }); at(topP, cx, Yb + H + 6, cz, mag);
    at(box(4, Yb + H + 6, 6, 0x5d6a86), cx + W / 2 + 6, (Yb + H + 6) / 2, cz - D / 2 - 2, mag);
    // стрелки поля
    if (d.B) for (const [ax, az] of [[-0.3, -0.3], [0.3, 0.3], [0.3, -0.3], [-0.3, 0.3]]) {
      const ar = new T.Group(); at(ar, cx + ax * W, Yb + H / 2, cz + az * D);
      at(cyl(0.3, 6, CYAN, { edges: false, hull: false, matOpt: { emissive: CYAN, emissiveIntensity: 0.4 } }), 0, 0, 0, ar);
      at(cyl(0.9, 1.8, CYAN, { r2: 0.01, edges: false, hull: false, matOpt: { emissive: CYAN, emissiveIntensity: 0.4 } }), 0, 3.6, 0, ar);
      ar.rotation.z = d.B > 0 ? Math.PI : 0;
    }
    // источник на игле (только в опыте)
    if (!d.quiz) {
      const nd = cyl(0.35, (B.x1 - d.src.x) * S, C.STEEL, { edges: false }); nd.rotation.z = Math.PI / 2; at(nd, mx((B.x1 + d.src.x) / 2), Yb + 1.4, mz(d.src.y));
      const tip = box(2.4, 2.4, 2.4, 0xffb547); at(tip, mx(d.src.x) + 1, Yb + 1.4, mz(d.src.y)); clickable(tip, 'launch');
      tag(v3(mx(d.src.x) + 6, Yb + 5, mz(d.src.y) + 3), 'Источник', 'пуск');
    } else { const v = glow(kit, 0xffb547, 4, 0.9); at(v, mx(d.vtx.x), Yb + 1.4, mz(d.vtx.y)); }
    // следы
    (d.tracks || []).forEach((tr, i) => {
      const pts = tr.pts.map(p => v3(mx(p[0]), Yb + 1.2, mz(p[1])));
      if (pts.length < 2) return;
      glowTube(kit, pts, TRACK, 0.08 + tr.w * 0.07, i === d.tracks.length - 1 || d.quiz ? 1 : 0.55);
      const q = tr.lab ? v3(mx(tr.lab[0]), 0, mz(tr.lab[1])) : pts[pts.length - 1];
      if (d.quiz || i === d.tracks.length - 1) tag(v3(q.x, Yb + 3, q.z), '', tr.s);
    });
    tag(v3(cx - W / 2 + 10, Yb + H + 10, cz - D / 2), d.quiz ? 'Снимок камеры' : 'Камера Вильсона', d.B > 0 ? 'поле B вниз (⊗)' : d.B < 0 ? 'поле B вверх (⊙)' : 'поле выключено');
  };

  // =====================================================================================
  // 5. Коллайдер: кольцо с магнитами на столе, встречные пучки, детектор-«бочка» в передней точке
  SC['particles-lhc'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, v3, C } = kit;
    const R = 34, Y = 4.5, cz = -2;
    const ring = kit.mesh(new T.TorusGeometry(R, 2.2, 12, 96), 0xd5dbe4, { edges: false, hull: true }); ring.rotation.x = Math.PI / 2; at(ring, 0, Y, cz);
    for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; if (Math.abs(a - Math.PI / 2) < 0.35) continue; const m = box(4.6, 4.6, 5.4, BLUE, { edges: false }); m.position.set(Math.cos(a) * R, Y, cz + Math.sin(a) * R); m.rotation.y = -a; kit.root.add(m); }
    // три малых детектора
    [[Math.PI, 'ALICE'], [-Math.PI / 2, 'CMS'], [0, 'LHCb']].forEach(([a, n]) => { const x = Math.cos(a) * R, z = cz + Math.sin(a) * R; at(box(9, 9, 9, 0x566079), x, 4.5, z); tag(v3(x, 12, z), n, ''); });
    // ATLAS: цилиндр, ось вдоль пучка (по x в этой точке)
    const det = new T.Group(); at(det, 0, 13, cz + R); clickable(det, 'bang');
    const layer = (r, len, col, op, seg = 32) => { const m = kit.mesh(new T.CylinderGeometry(r, r, len, seg, 1, true), col, { edges: false, hull: false, matOpt: { transparent: op < 1, opacity: op, side: T.DoubleSide, depthWrite: op >= 1 } }); m.rotation.z = Math.PI / 2; det.add(m); return m; };
    layer(12.5, 24, 0x3a4f7a, 0.55, 8); layer(9, 20, 0x7a5a2e, 0.85); layer(6.4, 18, 0x2e6b4f, 0.9); layer(4, 16, 0x26324a, 0.95);
    for (const s of [-1, 1]) { const ring2 = kit.mesh(new T.RingGeometry(4, 12.5, 8, 1), 0x3a4f7a, { edges: false, hull: false, matOpt: { side: T.DoubleSide, transparent: true, opacity: 0.35, depthWrite: false } }); ring2.rotation.y = Math.PI / 2; ring2.position.x = s * 12; det.add(ring2); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, bar = box(24, 0.8, 0.8, 0x9aa3b2, { edges: false }); bar.position.set(0, Math.cos(a) * 11, Math.sin(a) * 11); det.add(bar); }
    at(box(20, 7, 14, C.DARK), 0, 3.5, cz + R);
    // пучки: бусины по двум кольцам навстречу друг другу
    const beads = []; for (let i = 0; i < 18; i++) { const b = ball(kit, 0.9, i % 2 ? CYAN : RED, 0.9); kit.root.add(b); beads.push(b); }
    // искры столкновения
    const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    const sparks = [], ev = d.ev;
    if (ev) {
      const n = 10, spec = ev === 'H' ? [[GOLD, 9, 2]] : ['Z', 'jpsi', 'ups', 'W', 'tt'].includes(ev) ? [[0xff6b4a, 15, ev === 'W' || ev === 'tt' ? 1 : 2]] : [];
      for (let i = 0; i < n; i++) sparks.push({ l: link(kit, 0.18, 0xe8ecf4), dir: v3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), L: 4 + rnd() * 4 });
      spec.forEach(([col, L, k]) => { const a = rnd() * 6.28; for (let j = 0; j < k; j++) { const dd = v3(rnd() - 0.5, Math.cos(a + j * Math.PI), Math.sin(a + j * Math.PI)).normalize(); sparks.push({ l: link(kit, 0.4, col), dir: dd, L }); } });
    }
    const flash = glow(kit, GOLD, 8, 0.9); det.add(flash);
    const c0 = v3(0, 13, cz + R);
    tag(v3(R * 0.72, 9, cz + R * 0.72), 'Кольцо БАК', '27 км под землёй');
    const tA = liveTag(kit, v3(0, 29, cz + R), 'ATLAS', ev ? d.sig : `энергия ${d.E}`, !!ev);
    let w = 0;
    const pose = (dt) => {
      w += kit.reduce ? 0 : dt * 0.8;
      beads.forEach((b, i) => { const s = i % 2 ? 1 : -1, a = s * w + Math.floor(i / 2) / 9 * Math.PI * 2, r = R + (i % 2 ? -0.9 : 0.9); b.position.set(Math.cos(a) * r, Y + 1.2, cz + Math.sin(a) * r); });
      const L = live(), p = L.a === 'bang' ? L.p : 99;
      flash.visible = p < 0.6; if (flash.visible) { flash.scale.setScalar(4 + 20 * p); flash.material.opacity = 1 - p / 0.6; }
      const f = p >= 99 ? 1 : clamp(p / 0.8, 0, 1);
      sparks.forEach(s => { s.l.set(c0, c0.clone().addScaledVector(s.dir, s.L * f + 0.02)); });
    };
    pose(0); kit.onFrame(pose);
  };

  // =====================================================================================
  // 6. Стандартная модель: стена-таблица из плиток на подставке
  const SM = [
    ['u', 'q', 0, 0, '2,2 МэВ', '+2/3'], ['c', 'q', 1, 0, '1,27 ГэВ', '+2/3'], ['t', 'q', 2, 0, '173 ГэВ', '+2/3'], ['gl', 'b', 3, 0, '0', '0', 'g'],
    ['d', 'q', 0, 1, '4,7 МэВ', '−1/3'], ['s', 'q', 1, 1, '95 МэВ', '−1/3'], ['b', 'q', 2, 1, '4,18 ГэВ', '−1/3'], ['ga', 'b', 3, 1, '0', '0', 'γ'],
    ['e', 'l', 0, 2, '0,511 МэВ', '−1'], ['mu', 'l', 1, 2, '106 МэВ', '−1', 'μ'], ['tau', 'l', 2, 2, '1,78 ГэВ', '−1', 'τ'], ['Z', 'b', 3, 2, '91,2 ГэВ', '0'],
    ['ve', 'l', 0, 3, '< 1 эВ', '0', 'νe'], ['vm', 'l', 1, 3, '< 1 эВ', '0', 'νμ'], ['vt', 'l', 2, 3, '< 1 эВ', '0', 'ντ'], ['W', 'b', 3, 3, '80,4 ГэВ', '±1'],
    ['H', 'h', 4, 1.5, '125 ГэВ', '0'],
  ];
  const GC = { q: 0xb48cff, l: 0x86e0a8, b: 0xffb547, h: 0xffd166 };
  SC['particles-sm'] = (kit, d) => {
    const { T, at, box, tag, clickable, v3, C } = kit;
    const z0 = -14, tw = 14, th = 11, gap = 1.6, x0 = -2 * (tw + gap), y0 = 54;
    at(box(5 * (tw + gap) + 8, 4 * (th + gap) + 10, 2.4, 0x26324a), 0, y0 - 1.5 * (th + gap), z0 - 1.6);
    at(box(6, y0 - 22, 4, C.DARK), -30, (y0 - 22) / 2, z0 - 2); at(box(6, y0 - 22, 4, C.DARK), 30, (y0 - 22) / 2, z0 - 2);
    at(box(80, 2.4, 14, C.DARK), 0, 1.2, z0 - 1);
    SM.forEach(([id, g, c, r, m, q, sym]) => {
      const s = sym || id, col = GC[g], sel = d.sel === id, hh = g === 'h' ? 2 * th + gap : th;
      const face = canvasTex(kit, 256, Math.round(256 * hh / tw), (x, W, Hh) => {
        x.fillStyle = sel ? hex(col) : '#1a2438'; x.fillRect(0, 0, W, Hh);
        x.fillStyle = hex(col); x.fillRect(0, 0, 14, Hh);
        x.fillStyle = sel ? '#04070d' : '#8b96ad'; x.font = '500 26px "IBM Plex Mono", monospace'; x.textAlign = 'left'; x.fillText(m, 26, 36); x.textAlign = 'right'; x.fillText(q, W - 14, 36);
        x.fillStyle = sel ? '#04070d' : hex(col); x.font = '700 92px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(s, W / 2 + 6, Hh / 2 + 14);
      });
      const tile = new T.Group(); at(tile, x0 + c * (tw + gap), y0 - r * (th + gap), z0 + (sel ? 2.4 : 0)); clickable(tile, 'sm-' + id);
      at(box(tw, hh, 1.6, 0x1a2438), 0, 0, 0, tile);
      const pl = new T.Mesh(kit.keep(new T.PlaneGeometry(tw - 0.6, hh - 0.6)), kit.keep(new T.MeshBasicMaterial({ map: face }))); at(pl, 0, 0, 0.82, tile);
      if (sel) at(glow(kit, col, 26, 0.35), 0, 0, 1.5, tile);
    });
    tag(v3(0, y0 + th / 2 + 6, z0), `Вопрос ${Math.min(d.qi + 1, 4)} из 4`, d.q, d.qi >= 4);
  };
})();
