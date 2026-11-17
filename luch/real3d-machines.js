// «Как в жизни» для темы «Блоки и наклонная плоскость» (labs/phys-machines): штатив с неподвижным или подвижным блоком
// и латунными гирями, полиспаст на перекладине, доска на деревянной подставке с тележкой или бруском, динамометр.
// Сцены строятся из window.LUCH_REAL() опыта; плавное движение (высота груза, вытянутая верёвка, путь по доске) —
// из window.LUCH_REAL.live() каждый кадр. Набор деталей kit — из /luch/real3d.js.
(() => {
  const SC = (window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {});
  const IRON = 0x4a5468, ROD = 0xb9c0cc, RED = 0xe0473a, ORANGE = 0xffb547, TEAL = 0x2b6d7c, ROPE = 0xd9c08a,
    BRASS_W = 0xc9a24a, BRASS_D = 0x8f6f2a, LOAD = 0x7d8799, CYAN = 0x72d4e8, GREEN = 0x86e0a8;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const fmt = (x, n = 1) => (Math.round(x * 10 ** n) / 10 ** n).toFixed(n).replace('.', ',');
  const nf = x => Math.abs(x - Math.round(x)) < 1e-9 ? String(Math.round(x)) : fmt(x, 1);
  const live = () => { try { return (window.LUCH_REAL && window.LUCH_REAL.live && window.LUCH_REAL.live()) || {}; } catch (e) { return {}; } };
  const vetv = n => n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'ветви' : 'ветвей';
  // последняя созданная подпись: её значение и место меняем каждый кадр, не перестраивая сцену
  const lastTag = () => { const l = document.querySelectorAll('.rl-view .rl-lbl'); return l[l.length - 1] || null; };
  function liveTag(kit, p, name, value, hot) {
    kit.tag(p, name, value, hot);
    const el = lastTag(), i = el && el.querySelector('i');
    let shown = value;
    return { p, set(v) { if (i && v !== shown) { shown = v; i.textContent = v; } } };
  }
  // плавно догоняем значение из опыта (кнопки двигают груз скачками по 2 см)
  const follow = (cur, tgt, dt, k = 9) => (Math.abs(tgt - cur) < 0.02 ? tgt : cur + (tgt - cur) * Math.min(1, dt * k));

  // ---------- текстуры и плоские детали ----------
  function canvasTex(kit, w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    draw(x, w, h);
    const t = new kit.T.CanvasTexture(c); t.colorSpace = kit.T.SRGBColorSpace; t.anisotropy = 4; return kit.keep(t);
  }
  function plane(kit, w, h, tex, transparent) {
    const { T, keep } = kit;
    return new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: tex, transparent: !!transparent, depthWrite: !transparent })));
  }
  const textPlate = (kit, txt, w, h, fg = '#1b1610', bg = '#f7f3ea') => plane(kit, w, h, kit.keep(kit.textTex(txt, fg, bg, Math.round(64 * w / h), 64)));

  // верёвка: единичный цилиндр, который каждый кадр растягиваем между двумя точками
  function ropePiece(kit, r = 0.3) {
    const m = kit.cyl(r, 1, ROPE, { edges: false, hull: false, seg: 8 });
    kit.root.add(m);
    const Y1 = new kit.T.Vector3(0, 1, 0), d = new kit.T.Vector3();
    m.span = (a, b) => {
      d.copy(b).sub(a); const L = d.length(); m.visible = L > 0.05; if (!m.visible) return;
      m.position.copy(a).addScaledVector(d, 0.5); m.scale.set(1, L, 1); m.quaternion.setFromUnitVectors(Y1, d.normalize());
    };
    return m;
  }
  // блок: латунное колесо с желобом и спицами в плоскости XY; верёвка огибает его половиной тора
  function sheave(kit, r, heavy, under) {
    const { T, at, cyl, mesh, box } = kit, g = new T.Group(), wheel = new T.Group(); at(wheel, 0, 0, 0, g);
    const rim = heavy ? 0x9aa4b6 : BRASS_W, dark = heavy ? 0x5d6677 : BRASS_D;
    const disk = cyl(r - 0.35, 1.5, rim, { seg: 32 }); disk.rotation.x = Math.PI / 2; at(disk, 0, 0, 0, wheel);
    [-0.8, 0.8].forEach(z => { const fl = cyl(r + 0.25, 0.3, dark, { seg: 32, edges: false }); fl.rotation.x = Math.PI / 2; at(fl, 0, 0, z, wheel); });
    for (let k = 0; k < 3; k++) { const sp = box(0.5, 2 * r - 1.6, 0.2, dark, { edges: false, shadow: false }); sp.rotation.z = k * Math.PI / 3; at(sp, 0, 0, 0.92, wheel); }
    const ax = cyl(0.6, 2.6, 0xe8ecf4, { seg: 12 }); ax.rotation.x = Math.PI / 2; at(ax, 0, 0, 0, g);
    const wrap = mesh(new T.TorusGeometry(r, 0.3, 8, 28, Math.PI), ROPE, { edges: false }); if (under) wrap.rotation.z = Math.PI; at(wrap, 0, 0, 0, g);
    g.userData.wheel = wheel;
    return g;
  }
  // латунная гиря 1 Н (100 г), как в лаборатории рычага; (0,0,0) — низ гири
  const WH = 3.2;
  function weight1(kit) {
    const { T, at, cyl } = kit, g = new T.Group();
    at(cyl(2.3, WH - 0.2, BRASS_W, { seg: 28 }), 0, WH / 2, 0, g);
    at(cyl(2.35, 0.25, BRASS_D, { seg: 28, edges: false, hull: false }), 0, WH - 0.7, 0, g);
    return g;
  }
  // шкала динамометра: 0 сверху (у кольца), max внизу (у крючка); flip — подписи вверх ногами (прибор висит кольцом вниз)
  function dynoTex(kit, max, flip) {
    return canvasTex(kit, 128, 960, (x, w, h) => {
      x.fillStyle = '#f4f6fa'; x.fillRect(0, 0, w, h);
      const z0 = 0.5 / 12 * h, z1 = 11.5 / 12 * h;
      x.strokeStyle = '#1b2537'; x.fillStyle = '#1b2537'; x.font = '700 44px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let i = 0; i <= 10; i++) {
        const y = z0 + (z1 - z0) * i / 10, big = i % 2 === 0;
        x.lineWidth = big ? 6 : 3; x.beginPath(); x.moveTo(w * 0.62, y); x.lineTo(w * (big ? 0.98 : 0.84), y); x.stroke();
        if (big) { const v = max * i / 10, s = Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : String(v).replace('.', ','); x.save(); x.translate(w * 0.3, y); if (flip) x.rotate(Math.PI); x.fillText(s, 0, 2); x.restore(); }
      }
    });
  }
  // динамометр: крючок в (0,0,0), корпус вверх по +y, кольцо — на +20,6. setF(F) двигает указатель
  function dyno(kit, max, flip) {
    const { T, at, box, cyl, mesh } = kit, g = new T.Group();
    at(box(3.6, 15, 2.4, TEAL), 0, 9.9, 0, g);
    const face = plane(kit, 1.7, 12, dynoTex(kit, max, flip)); at(face, 0.3, 9.9, 1.22, g);
    const back = plane(kit, 1.7, 12, dynoTex(kit, max, !flip)); back.rotation.y = Math.PI; at(back, -0.3, 9.9, -1.22, g);
    const ptr = box(2.6, 0.32, 3, RED, { edges: false, matOpt: { emissive: RED, emissiveIntensity: 0.35 } }); at(ptr, 0.3, 15.4, 0, g);
    const stem = cyl(0.22, 1, ROD, { edges: false, hull: false }); at(stem, 0, 0, 0, g);
    const hk = mesh(new T.TorusGeometry(0.8, 0.22, 8, 18, Math.PI * 1.6), ROD, { edges: false }); hk.rotation.z = -Math.PI * 0.3; at(hk, 0, -0.2, 0, g);
    at(cyl(0.3, 2.4, ROD, { edges: false, hull: false }), 0, 18.6, 0, g);
    const ring = mesh(new T.TorusGeometry(1.4, 0.45, 10, 24), ORANGE, { edges: false, matOpt: { emissive: ORANGE, emissiveIntensity: 0.25 } }); at(ring, 0, 21.2, 0, g);
    kit.clickable(g, 'pull');
    g.setF = F => {
      const y = 15.4 - clamp(F / max, 0, 1.06) * 11;
      ptr.position.y = y; stem.scale.y = Math.max(0.05, y - 0.6); stem.position.y = 0.6 + (y - 0.6) / 2;
    };
    g.setF(0);
    return g;
  }
  // деревянная линейка с сантиметрами: 0 у стола, зелёная метка — цель
  function ruler(kit, perCm, maxCm, target) {
    const { T, at, box } = kit, g = new T.Group(), H = perCm * maxCm + 2;
    at(box(3, H, 0.6, 0xe9d9a8), 0, H / 2, 0, g);
    const tex = canvasTex(kit, 96, Math.round(96 * H / 3), (x, w, h) => {
      x.fillStyle = '#e9d9a8'; x.fillRect(0, 0, w, h); x.strokeStyle = '#3b3320'; x.fillStyle = '#3b3320'; x.font = '700 30px "IBM Plex Mono", monospace'; x.textAlign = 'right'; x.textBaseline = 'middle';
      for (let c = 0; c <= maxCm; c++) { const y = h - c * perCm / H * h - 1; x.lineWidth = c % 5 ? 2 : 4; x.beginPath(); x.moveTo(0, y); x.lineTo(c % 5 ? 26 : 46, y); x.stroke(); if (c % 5 === 0 && c) x.fillText(String(c), w - 6, y); }
    });
    const f = plane(kit, 2.8, H, tex); at(f, 0, H / 2, 0.32, g);
    at(box(5, 0.3, 0.9, GREEN, { edges: false, matOpt: { emissive: GREEN, emissiveIntensity: 0.4 } }), 1, target * perCm, 0.2, g);
    return g;
  }
  // тетрадь с записями опыта (урок «КПД»)
  function notebook(kit, rows, title) {
    const { T, at, box } = kit, g = new T.Group();
    at(box(26, 0.6, 15, 0x3b6fd8), 0, 0.3, 0, g);
    const lines = rows && rows.length ? rows : ['пока пусто'];
    const tex = canvasTex(kit, 512, 300, (x, w, h) => {
      x.fillStyle = '#f7f3ea'; x.fillRect(0, 0, w, h); x.strokeStyle = '#b9c8e6'; x.lineWidth = 2;
      for (let y = 70; y < h; y += 46) { x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); }
      x.fillStyle = '#1b2537'; x.font = '700 34px "Golos Text", sans-serif'; x.fillText(title, 18, 46);
      x.font = '500 30px "IBM Plex Mono", monospace'; lines.slice(-5).forEach((l, i) => x.fillText(l, 18, 104 + i * 46));
    });
    const p = plane(kit, 24, 14, tex); p.rotation.x = -Math.PI / 2; at(p, 0, 0.62, 0, g);
    return g;
  }
  // увеличить всё, что сцена добавила (стол большой, приборы на нём мелкие): W(x,y,z) — точка после увеличения
  function grow(kit, s, ox, oz) {
    const n0 = kit.root.children.length;
    const W = (x, y, z) => kit.v3(x * s + ox, y * s, z * s + oz);
    W.v = p => W(p.x, p.y, p.z);
    W.done = () => { const g = new kit.T.Group(); g.scale.setScalar(s); g.position.set(ox, 0, oz); kit.root.children.slice(n0).forEach(c => g.add(c)); kit.root.add(g); };
    return W;
  }
  function standBase(kit, x, z, len) {
    const { at, box, cyl } = kit;
    at(box(16, 2, 16, IRON), x, 1, z);
    at(cyl(1, len, ROD, { edges: false }), x, 2 + len / 2, z);
  }

  // =====================================================================================
  // 1 (и 4). Штатив: неподвижный блок на лапке или подвижный блок на верёвке; гири по 1 Н; динамометр в руке
  SC['machines-pulley'] = (kit, d) => {
    const { T, at, box, cyl, clickable, v3 } = kit;
    const R = 5, PY = 70, ARM = 77, RX = -34, mov = d.mode === 'mov', nw = d.nw || 4, k = mov ? 2 : 1, W = grow(kit, 1.25, 6, 0);
    // штатив и лапка
    standBase(kit, RX, 0, 80);
    at(box(4, 3.4, 4, IRON), RX, ARM, 0);
    const armEnd = mov ? -R + 1.4 : 1.2, arm = cyl(0.8, armEnd - RX, ROD, { edges: false }); arm.rotation.z = Math.PI / 2; at(arm, (RX + armEnd) / 2, ARM, 0);
    const pul = sheave(kit, R, !!d.heavy, mov); at(pul, 0, PY, 0); clickable(pul, 'mode');
    if (!mov) [-1.3, 1.3].forEach(z => at(box(1.2, ARM - PY + 0.8, 0.35, IRON), 0, (ARM + PY) / 2, z));
    else {
      at(kit.mesh(new T.TorusGeometry(0.8, 0.25, 8, 18), ROD, { edges: false }), -R, ARM - 1.2, 0);
      [-1.3, 1.3].forEach(z => { const s = box(1, 6.4, 0.3, IRON, { edges: false }); s.userData.strap = true; at(s, 0, 0, z, pul); s.position.y = -3.2 - R * 0.5; });
    }
    // груз: стопка гирь на крючке
    const load = new T.Group(); at(load, mov ? 0 : -R, 0, 0); if (!d.heavy) clickable(load, 'winc');
    for (let i = 0; i < nw; i++) at(weight1(kit), 0, i * WH, 0, load);
    const lh = nw * WH;
    at(kit.mesh(new T.TorusGeometry(0.8, 0.25, 8, 18), ROD, { edges: false }), 0, lh + 1, 0, load);
    // запасные гири на столе
    if (!d.heavy) { const tray = new T.Group(); at(tray, 30, 0, 22); clickable(tray, 'winc'); at(box(26, 1, 9, kit.C.WOOD2), 0, 0.5, 0, tray); for (let i = 0; i < 4 - nw; i++) at(weight1(kit), -8 + i * 5.6, 1, 0, tray); }
    // линейка у груза
    const rl = ruler(kit, 1, 15, d.hT || 10); at(rl, (mov ? 0 : -R) - 9, 0, -2);
    // динамометр: неподвижный блок — тянем вниз (кольцо внизу), подвижный — вверх
    const dy = dyno(kit, 5, !mov); if (!mov) dy.rotation.z = Math.PI; at(dy, R, 0, 0);
    // верёвки
    const rA = ropePiece(kit), rB = ropePiece(kit), rH = ropePiece(kit, 0.22);
    if (d.rec) { const nb = notebook(kit, d.rec, 'КПД'); at(nb, 28, 0, 22); nb.rotation.y = -0.1; clickable(nb, 'setup'); }
    W.done();
    const dTag = liveTag(kit, W(R + 8, 40, 0), 'Динамометр', '0 Н');
    const lTag = liveTag(kit, W(0, 20, 0), 'Груз ' + nw + ' Н', 'h = 0 см');
    kit.tag(W(-R - 14, PY + 4, 0), mov ? (d.heavy ? 'Подвижный блок 1 Н' : 'Подвижный блок') : 'Неподвижный блок', mov ? 'F = P / 2' : 'F = P');
    let hc = clamp(live().h || 0, 0, 20), acc = 1;
    const pose = dt => {
      const Lv = live(); hc = kit.reduce ? (Lv.h || 0) : follow(hc, Lv.h || 0, dt);
      const s = hc * k, top = hc + lh;
      load.position.y = hc;
      let hy;
      if (!mov) {
        hy = PY - 18 - s;
        rA.span(v3(-R, PY, 0), v3(-R, top + 1.8, 0)); rB.span(v3(R, PY, 0), v3(R, hy, 0)); rH.visible = false;
        pul.userData.wheel.rotation.z = -s / R;
      } else {
        const py = top + 2 + 6.4 + R * 0.5 + 0.4;
        pul.position.y = py; hy = 46 + s;
        rA.span(v3(-R, ARM - 2, 0), v3(-R, py, 0)); rB.span(v3(R, py, 0), v3(R, hy, 0)); rH.span(v3(0, py - R * 0.5 - 6.4, 0), v3(0, top + 1.8, 0));
        pul.userData.wheel.rotation.z = -hc / R;
      }
      dy.position.y = hy; dy.setF(Lv.F || 0);
      dTag.p.copy(W(R + 12, mov ? hy + 12 : hy - 8, 2));
      lTag.p.copy(W(load.position.x - 12, top + 2, 2));
      acc += dt;
      if (acc > 0.12) { acc = 0; dTag.set(fmt(Lv.F || 0) + ' Н · s = ' + nf(Math.round(s * 2) / 2) + ' см'); lTag.set('h = ' + nf(Math.round(hc * 2) / 2) + ' см'); }
    };
    pose(1); kit.onFrame(dt => pose(dt));
  };

  // =====================================================================================
  // 2. Полиспаст: перекладина на двух стойках, верхние неподвижные блоки, нижняя обойма с крюком, чугунный груз
  SC['machines-poly'] = (kit, d) => {
    const { T, at, box, cyl, clickable, v3 } = kit;
    const r = 3.2, FY = 74, BEAM = 80, V = 0.5, m = d.nb / 2, x0 = -(2 * m - 1) * r;
    const mx = i => x0 + 4 * r * i, fx = i => x0 + 2 * r + 4 * r * i, xA = x0 - r, xH = fx(m - 1) + r, W = grow(kit, 1.25, 0, 0);
    standBase(kit, -38, 0, BEAM); standBase(kit, 38, 0, BEAM);
    at(box(80, 2.4, 3, IRON), 0, BEAM + 1, 0);
    const up = [];
    for (let i = 0; i < m; i++) { const s = sheave(kit, r, false, false); at(s, fx(i), FY, 0); up.push(s); [-1.2, 1.2].forEach(z => at(box(0.9, BEAM - FY + 0.5, 0.3, IRON, { edges: false }), fx(i), (BEAM + FY) / 2, z)); }
    at(kit.mesh(new T.TorusGeometry(0.7, 0.22, 8, 18), ROD, { edges: false }), xA, BEAM - 0.9, 0);
    // нижняя обойма: блоки на планке, крюк
    const low = new T.Group(); at(low, 0, 0, 0); clickable(low, 'ncycle');
    const dn = [];
    for (let i = 0; i < m; i++) { const s = sheave(kit, r, false, true); at(s, mx(i), 0, 0, low); dn.push(s); [-1.2, 1.2].forEach(z => at(box(0.9, r + 1.6, 0.3, IRON, { edges: false }), mx(i), -(r + 1.6) / 2, z, low)); }
    const cx = (mx(0) + mx(m - 1)) / 2;
    at(box(mx(m - 1) - mx(0) + 5, 1.2, 3, IRON), cx, -r - 1.6, 0, low);
    // груз
    const LH = 4 + d.P * 0.5, load = new T.Group(); at(load, cx, 0, 0); clickable(load, 'pcycle');
    at(cyl(4.4, LH, LOAD, { seg: 32 }), 0, LH / 2, 0, load);
    at(kit.mesh(new T.TorusGeometry(1.2, 0.4, 8, 18, Math.PI), LOAD, { edges: false }), 0, LH, 0, load);
    const lp = textPlate(kit, d.P + ' Н', 5.2, 2.2, '#f7f3ea', '#4a5468'); at(lp, 0, LH / 2, 4.45, load);
    const rl = ruler(kit, V, 12, d.hT || 10); at(rl, xA - 9, 0, -2);
    const dy = dyno(kit, 10, true); dy.rotation.z = Math.PI; at(dy, xH, 0, 0);
    // верёвка: от лапки вниз, вокруг каждого нижнего блока, вверх, через верхний, ... к динамометру
    const pieces = []; for (let i = 0; i < 2 * m + 1; i++) pieces.push(ropePiece(kit));
    const hk = ropePiece(kit, 0.22);
    W.done();
    const dTag = liveTag(kit, W(xH + 6, 40, 0), 'Динамометр', '0 Н');
    const lTag = liveTag(kit, W(cx, 20, 0), 'Груз ' + d.P + ' Н', 'h = 0 см');
    kit.tag(W(0, BEAM + 6, 0), 'Полиспаст', d.nb + ' ' + vetv(d.nb) + ' · F = P / ' + d.nb);
    let hc = clamp(live().h || 0, 0, 20), acc = 1;
    const pose = dt => {
      const Lv = live(); hc = kit.reduce ? (Lv.h || 0) : follow(hc, Lv.h || 0, dt);
      const s = hc * d.nb, by = hc * V, top = by + LH, frameY = top + 2.6, my = frameY + r + 1.6 + 0.6, hy = 60 - s * V;
      load.position.y = by; low.position.y = my;
      hk.span(v3(cx, frameY - 0.6, 0), v3(cx, top + 0.6, 0));
      let p = 0;
      pieces[p++].span(v3(xA, BEAM - 1.6, 0), v3(xA, my, 0));
      for (let i = 0; i < m; i++) {
        pieces[p++].span(v3(mx(i) + r, my, 0), v3(mx(i) + r, FY, 0));
        pieces[p++].span(v3(fx(i) + r, FY, 0), v3(fx(i) + r, i < m - 1 ? my : hy, 0));
      }
      up.forEach(s2 => { s2.userData.wheel.rotation.z = -s * V / r; }); dn.forEach(s2 => { s2.userData.wheel.rotation.z = by / r; });
      dy.position.y = hy; dy.setF(Lv.F || 0);
      dTag.p.copy(W(xH + 12, hy - 8, 2)); lTag.p.copy(W(cx - 12, top + 2, 5));
      acc += dt;
      if (acc > 0.12) { acc = 0; dTag.set(fmt(Lv.F || 0) + ' Н · s = ' + nf(Math.round(s * 2) / 2) + ' см'); lTag.set('h = ' + nf(Math.round(hc * 2) / 2) + ' см'); }
    };
    pose(1); kit.onFrame(dt => pose(dt));
  };

  // =====================================================================================
  // 3 (и 4). Наклонная плоскость: доска на деревянной подставке 20 см, тележка или брусок 6 Н, динамометр вдоль доски
  SC['machines-incline'] = (kit, d) => {
    const { T, at, box, cyl, clickable, v3, C } = kit;
    const V = 0.8, H = 20 * V, TX = 26, l = d.board, Lb = l * V, sa = 20 / l, ca = Math.sqrt(1 - sa * sa), al = Math.asin(sa);
    const dir = v3(ca, sa, 0), nrm = v3(-sa, ca, 0), TC = v3(TX, H, 0), B = TC.clone().addScaledVector(dir, -Lb), W = grow(kit, 1.3, -4, 0);
    // подставка
    const sup = new T.Group(); at(sup, TX + 9, 0, 0); clickable(sup, 'lcycle');
    at(box(18, H, 18, C.WOOD2), 0, H / 2, 0, sup);
    for (let i = 1; i < 3; i++) at(box(18.1, 0.12, 18.1, 0x8a5a30, { edges: false, shadow: false }), 0, i * H / 3, 0, sup);
    // доска
    const brd = box(Lb, 1.2, 14, C.WOOD); brd.rotation.z = al;
    const bc = TC.clone().addScaledVector(dir, -Lb / 2).addScaledVector(nrm, -0.6); at(brd, bc.x, bc.y, bc.z); clickable(brd, 'lcycle');
    // высота подставки
    at(box(0.4, H, 0.4, CYAN, { edges: false, matOpt: { emissive: CYAN, emissiveIntensity: 0.4 } }), TX + 21, H / 2, 9.4);
    // тело на доске
    const cart = d.body === 'cart', bodyG = new T.Group(); clickable(bodyG, d.eff ? 'setup' : 'body'); bodyG.rotation.z = al;
    if (cart) {
      at(box(8, 2.6, 6, 0x3b6fd8), 0, 2.9, 0, bodyG);
      [[-2.6, -3.3], [2.6, -3.3], [-2.6, 3.3], [2.6, 3.3]].forEach(([x, z]) => { const w = cyl(1.1, 0.7, 0x2c3240, { seg: 16 }); w.rotation.x = Math.PI / 2; at(w, x, 1.1, z, bodyG); });
      const lt = textPlate(kit, '6 Н', 3.6, 1.6, '#f7f3ea', '#3b6fd8'); at(lt, 0, 2.9, 3.02, bodyG);
    } else {
      at(box(8, 4, 6, 0xc79a5c), 0, 2, 0, bodyG);
      for (let i = 0; i < 2; i++) at(box(7.4, 0.1, 0.1, 0x9a6f3a, { edges: false, shadow: false }), 0, 1.2 + i * 1.6, 3.02, bodyG);
      const lt = textPlate(kit, '6 Н', 3.6, 1.6, '#1b1610', '#e6c48e'); at(lt, 0, 2, 3.03, bodyG);
    }
    const ex = 4.6, ey = cart ? 2.9 : 2;
    at(kit.mesh(new T.TorusGeometry(0.6, 0.18, 8, 16), ROD, { edges: false }), ex, ey, 0, bodyG);
    at(bodyG, 0, 0, 0);
    // запасное тело на столе (урок 3) или тетрадь с записями (урок 4)
    if (!d.eff) {
      const other = new T.Group(); at(other, -44, 0, 28); clickable(other, 'body');
      if (cart) at(box(8, 4, 6, 0xc79a5c), 0, 2, 0, other);
      else { at(box(8, 2.6, 6, 0x3b6fd8), 0, 2.9, 0, other); [[-2.6, -3.3], [2.6, -3.3], [-2.6, 3.3], [2.6, 3.3]].forEach(([x, z]) => { const w = cyl(1.1, 0.7, 0x2c3240, { seg: 16 }); w.rotation.x = Math.PI / 2; at(w, x, 1.1, z, other); }); }
    } else { const nb = notebook(kit, d.rec, 'КПД'); at(nb, 8, 0, 28); nb.rotation.y = -0.08; clickable(nb, 'setup'); }
    // динамометр вдоль доски, кольцом вверх по склону
    const dy = dyno(kit, 5, false); dy.rotation.z = al - Math.PI / 2; at(dy, 0, 0, 0);
    W.done();
    if (!d.eff) kit.tag(W(-44, 8, 28), cart ? 'Брусок' : 'Тележка', 'нажмите — сменить');
    const dTag = liveTag(kit, v3(0, 20, 0), 'Динамометр', '0 Н');
    const bTag = liveTag(kit, v3(0, 10, 0), (cart ? 'Тележка' : 'Брусок') + ' 6 Н', 'путь 0 / ' + l + ' см');
    kit.tag(W(B.x + (TX - B.x) * 0.3, 1, 9), 'Доска', 'l = ' + l + ' см');
    kit.tag(W(TX + 21, H + 3, 9.4), 'Подставка', 'h = 20 см');
    let dc = clamp(live().d || 0, 0, l), acc = 1;
    const pose = dt => {
      const Lv = live(); dc = kit.reduce ? (Lv.d || 0) : follow(dc, clamp(Lv.d || 0, 0, l), dt, 7);
      const c = (5 + dc * (l - 10) / l) * V, pos = B.clone().addScaledVector(dir, c);
      bodyG.position.copy(pos);
      const hk = pos.clone().addScaledVector(dir, ex + 0.6).addScaledVector(nrm, ey);
      dy.position.copy(hk); dy.setF(Lv.F || 0);
      dTag.p.copy(W.v(hk.clone().addScaledVector(dir, 16).addScaledVector(nrm, 5)));
      bTag.p.copy(W.v(pos.clone().addScaledVector(nrm, cart ? 7 : 8)));
      acc += dt;
      if (acc > 0.12) { acc = 0; dTag.set(fmt(Lv.F || 0) + ' Н'); bTag.set('путь ' + Math.round(dc) + ' / ' + l + ' см'); }
    };
    pose(1); kit.onFrame(dt => pose(dt));
  };
})();
