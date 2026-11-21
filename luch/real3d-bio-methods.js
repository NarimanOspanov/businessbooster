// «Как в жизни» для биологии: «Как изучают жизнь» (labs/bio-methods). Аквариум с золотой рыбкой (жаберные крышки
// поднимаются в такт дыханию), нагреватель с терморегулятором, термометр, секундомер и тетрадь замеров; настоящий
// световой микроскоп (основание с лампой, диафрагма с рычажком, столик со стеклом и кожицей лука, револьвер с
// объективами 4×/10×/40×, наклонный окуляр с камерой, макро- и микровинты) и экран «вид в окуляр»; две чашки Петри
// с горохом на фильтровальной бумаге, лампы, коробка «в темноте», холодильник «4 °C», отрывной календарь.
// Сцены строятся из window.LUCH_REAL() опыта; фаза дыхания, секундомер, окраска йодом и дни опыта — из LUCH_REAL.live() в onFrame.
(() => {
  const SC = (window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {});
  const live = () => { try { return (window.LUCH_REAL && window.LUCH_REAL.live && window.LUCH_REAL.live()) || {}; } catch (e) { return {}; } };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (x, n = 0) => (Math.round(x * 10 ** n) / 10 ** n).toFixed(n).replace('.', ',').replace('-', '−');
  const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; };
  const hexs = c => '#' + c.toString(16).padStart(6, '0');
  // те же «случайные» клетки кожицы лука, что и на схеме
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263 + 1013904223) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const CELL = { L: 0.25, H: 0.06, r: 0.010 }, SPEC = { w: 3, h: 2 }, BAR = { 4: 1, 10: 0.5, 40: 0.1 };
  function cellBox(r, i) {
    const off = (r % 2) * 0.5, b = j => -SPEC.w + (j - off) * CELL.L + (hash(r, j) - 0.5) * 0.3 * CELL.L;
    let x0 = b(i), x1 = b(i + 1);
    if (x1 <= -SPEC.w || x0 >= SPEC.w) return null;
    x0 = Math.max(-SPEC.w, x0); x1 = Math.min(SPEC.w, x1);
    const y0 = -SPEC.h + r * CELL.H;
    return { x0, x1, nx: x0 + (0.3 + 0.4 * hash(r + 500, i)) * (x1 - x0), ny: y0 + (0.38 + 0.24 * hash(r + 900, i)) * CELL.H };
  }

  // ---------- общие детали ----------
  function H(kit) {
    const { T, at, box, cyl, mesh, keep, grad, clickable } = kit;
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    const glassMat = (color = 0xd8eef8, opacity = 0.22) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, transparent: true, opacity, side: T.DoubleSide, depthWrite: false }));
    const ownMat = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, ...o }));
    const addMat = (color, opacity) => keep(new T.MeshBasicMaterial({ color, transparent: true, opacity, blending: T.AdditiveBlending, depthWrite: false }));
    const glow = (color, size, opacity) => { const s = new T.Sprite(keep(new T.SpriteMaterial({ map: kit.glowTex(), color, transparent: true, opacity, blending: T.AdditiveBlending, depthWrite: false }))); s.scale.setScalar(size); s.renderOrder = 5; return s; };
    const hitBox = (w, h, d) => new T.Mesh(keep(new T.BoxGeometry(w, h, d)), keep(new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })));
    const ball = (r, color, o = {}) => mesh(new T.SphereGeometry(r, o.seg || 18, o.seg2 || 12), color, { hull: o.hull ?? true, edges: false, matOpt: o.matOpt, mat: o.mat, shadow: o.shadow });
    // стержень между двумя точками
    function rod(parent, a, b, r, color, o = {}) {
      const dv = b.clone().sub(a), L = dv.length();
      const m = cyl(r, L, color, { edges: false, ...o });
      m.quaternion.setFromUnitVectors(v3(0, 1, 0), dv.normalize());
      return at(m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, parent);
    }
    // гибкий шнур по точкам
    function wire(parent, pts, color, r = 0.45) {
      const m = mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts, false, 'centripetal'), 60, r, 8), color, { edges: false, hull: true });
      (parent || kit.root).add(m); return m;
    }
    // светящийся столб света (луч лампы)
    function shaft(parent, a, b, r, color, opacity) {
      const dv = b.clone().sub(a), L = dv.length();
      const m = new T.Mesh(keep(new T.CylinderGeometry(r, r, L, 20, 1, true)), addMat(color, opacity));
      m.quaternion.setFromUnitVectors(v3(0, 1, 0), dv.normalize()); m.renderOrder = 4;
      return at(m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, parent);
    }
    function canvasTex(pw, ph) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph;
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      return { c, x: c.getContext('2d'), tex };
    }
    function drawLines(x, pw, ph, lines, col, weight = 600, k = 0.62, align = 'center') {
      const lh = ph / lines.length;
      lines.forEach((ln, i) => {
        let fs = Math.round(lh * k); x.font = `${weight} ${fs}px "Golos Text", sans-serif`;
        const tw = x.measureText(ln).width; if (tw > pw * 0.9) { fs = Math.floor(fs * pw * 0.9 / tw); x.font = `${weight} ${fs}px "Golos Text", sans-serif`; }
        x.fillStyle = col; x.textAlign = align; x.textBaseline = 'middle'; x.fillText(ln, align === 'left' ? pw * 0.06 : pw / 2, lh * (i + 0.5) + 2);
      });
    }
    // бумажная наклейка / этикетка (строки через \n)
    function sticker(w, h, txt, fg = '#1b1610', bg = '#fffaf0', o = {}) {
      const pw = o.pw || 320, ph = Math.round(pw * h / w), k = canvasTex(pw, ph);
      k.x.fillStyle = bg; k.x.beginPath(); if (k.x.roundRect) k.x.roundRect(3, 3, pw - 6, ph - 6, Math.min(pw, ph) * 0.14); else k.x.rect(3, 3, pw - 6, ph - 6); k.x.fill();
      k.x.strokeStyle = '#1b1610'; k.x.lineWidth = 5; k.x.stroke();
      drawLines(k.x, pw, ph, String(txt).split('\n'), fg, o.weight || 700, o.k || 0.62, o.align);
      return new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: k.tex, transparent: true })));
    }
    // табло, которое перерисовывается в onFrame
    function screen(w, h, pw, ph, draw) {
      const k = canvasTex(pw, ph);
      const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: k.tex })));
      m.userData.redraw = (...a) => { draw(k.x, pw, ph, ...a); k.tex.needsUpdate = true; };
      return m;
    }
    // клавиша на столе с надписью сверху
    function key(parent, x, z, w, d, label, color, keyName, fg = '#ffffff') {
      const b = new T.Group(); at(b, x, 0, z, parent);
      at(box(w, 1.6, d, color), 0, 0.8, 0, b);
      const top = sticker(w * 0.94, d * 0.84, label, fg, hexs(color), { pw: Math.round(Math.min(512, 70 * w / d * 1.6)) });
      top.rotation.x = -Math.PI / 2; at(top, 0, 1.62, 0, b);
      if (keyName) clickable(b, keyName);
      return b;
    }
    return { v3, glassMat, ownMat, addMat, glow, hitBox, ball, rod, wire, shaft, canvasTex, drawLines, sticker, screen, key };
  }

  // =====================================================================================
  // 1. Наблюдение и эксперимент: аквариум с золотой рыбкой, нагреватель, термометр, секундомер
  // =====================================================================================
  function goldfish(kit, h) {
    const { T, at, mesh } = kit;
    const g = new T.Group();
    const ORANGE = 0xf39a3c, FIN = 0xf08a2c;
    const body = h.ball(1, ORANGE, { seg: 28, seg2: 18 }); body.scale.set(6.6, 4, 2.5); at(body, 0, 0, 0, g);
    const belly = h.ball(1, 0xffc27e, { hull: false, shadow: false }); belly.scale.set(4.4, 2, 2.2); at(belly, 0.4, -1.6, 0, g);
    // хвост машет: шарнир у тела
    const tail = new T.Group(); at(tail, -6, 0, 0, g);
    const fan = mesh(new T.ConeGeometry(3.2, 5.4, 18), FIN, { hull: true, edges: false }); fan.rotation.z = -Math.PI / 2; fan.scale.set(1, 1, 0.22); at(fan, -2.4, 0, 0, tail);
    const dors = mesh(new T.ConeGeometry(1.6, 3.4, 12), FIN, { hull: true, edges: false }); dors.scale.set(1.4, 1, 0.25); dors.rotation.z = 0.35; at(dors, -0.6, 4.4, 0, g);
    [-1, 1].forEach(s => { const pf = mesh(new T.ConeGeometry(0.9, 2.6, 10), FIN, { hull: true, edges: false }); pf.rotation.set(s * 0.6, 0, 2.3); pf.scale.set(1, 1, 0.3); at(pf, 1.4, -2.6, s * 1.6, g); });
    // жабры: красная щель под крышкой, крышка открывается наружу
    const gills = [];
    [-1, 1].forEach(s => {
      const red = h.ball(1, 0xd6283a, { hull: false, shadow: false }); red.scale.set(0.7, 2.3, 0.3); at(red, 2.2, 0, s * 2.05, g);
      const piv = new T.Group(); at(piv, 3.4, 0, s * 2.05, g);
      const cov = h.ball(1, 0xe0782a, { seg: 16, seg2: 10 }); cov.scale.set(1.4, 2.6, 0.45); at(cov, -1.2, 0, s * 0.15, piv);
      gills.push({ piv, s });
    });
    [-1, 1].forEach(s => { at(h.ball(0.85, 0xffffff, { hull: true }), 4.4, 1, s * 1.75, g); at(h.ball(0.48, 0x1b1610, { hull: false }), 4.85, 1.05, s * 2.15, g); });
    const mouth = h.ball(0.6, 0x5a2208, { hull: false }); at(mouth, 6.45, 0.1, 0, g);
    return { g, tail, gills, mouth };
  }

  SC['bio-aquarium'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, onFrame } = kit, h = H(kit), v3 = h.v3;
    const AX = -12, AZ = -10, W = 80, HH = 40, D = 34, WL = 35; // аквариум и уровень воды
    const hot = clamp((d.T - d.tmin) / (d.tmax - d.tmin), 0, 1);
    // тумба-подставка и рамы
    at(box(W + 3, 2, D + 3, 0x2a3348), AX, 1, AZ);
    const glassBox = box(W, HH, D, 0xcfe6f2, { matOpt: { transparent: true, opacity: 0.14, depthWrite: false }, shadow: false });
    glassBox.renderOrder = 3; at(glassBox, AX, 2 + HH / 2, AZ);
    [[0, -D / 2], [0, D / 2]].forEach(([, z]) => at(box(W + 2, 1.4, 1.4, 0x2a3348), AX, 2 + HH, AZ + z));
    [[-W / 2], [W / 2]].forEach(([x]) => at(box(1.4, 1.4, D + 2, 0x2a3348), AX + x, 2 + HH, AZ));
    // вода: теплее — чуть мутнее
    const wcol = new T.Color(0x3a8fc0).lerp(new T.Color(0x4fae9a), hot * 0.5);
    const water = new T.Mesh(kit.keep(new T.BoxGeometry(W - 1, WL - 2, D - 1)), h.ownMat(wcol.getHex(), { transparent: true, opacity: 0.2 + hot * 0.1, depthWrite: false }));
    water.renderOrder = 2; at(water, AX, 2 + (WL - 2) / 2 + 0.01, AZ);
    const surf = new T.Mesh(kit.keep(new T.PlaneGeometry(W - 1, D - 1)), h.ownMat(0xa8e2f5, { transparent: true, opacity: 0.35, depthWrite: false, side: T.DoubleSide }));
    surf.rotation.x = -Math.PI / 2; surf.renderOrder = 2; at(surf, AX, WL, AZ);
    // грунт и камешки
    at(box(W - 1, 3, D - 1, 0x5a5242, { edges: false }), AX, 3.5, AZ);
    for (let i = 0; i < 46; i++) { const p = h.ball(0.8 + hash(5, i) * 0.9, [0x6b6250, 0x857a62, 0x544c3e][i % 3], { hull: false, seg: 8, seg2: 6 }); p.scale.y = 0.6; at(p, AX - W / 2 + 3 + hash(3, i) * (W - 6), 5.1, AZ - D / 2 + 3 + hash(4, i) * (D - 6)); }
    // водоросли покачиваются
    const plants = [];
    [[-30, -6, 26], [-25, -2, 20], [22, -4, 28], [18, 2, 22], [-2, -14, 18]].forEach(([px, pz, ph], i) => {
      const pg = new T.Group(); at(pg, AX + px, 5, AZ + pz);
      for (let b = 0; b < 3; b++) {
        const a = b * 2.1 + i, lean = 2 + b;
        const pts = [v3(0, 0, 0), v3(Math.cos(a) * lean * 0.4, ph * 0.35, Math.sin(a) * lean * 0.4), v3(Math.cos(a) * lean, ph * (0.7 + 0.1 * b), Math.sin(a) * lean)];
        h.wire(pg, pts, 0x3fae6a, 0.55);
      }
      plants.push(pg);
    });
    // нагреватель в воде: светится тем ярче, чем теплее вода
    const HX = AX - W / 2 + 5, HZ = AZ - D / 2 + 4;
    const tube = new T.Mesh(kit.keep(new T.CylinderGeometry(1.7, 1.7, 26, 24, 1, true)), h.glassMat(0xdfe8ef, 0.35)); at(tube, HX, 19, HZ);
    tube.add(new T.Mesh(tube.geometry, kit.hullMat));
    const coreCol = new T.Color(0x56627d).lerp(new T.Color(0xff7a3c), 0.25 + 0.75 * hot);
    at(cyl(1, 20, coreCol.getHex(), { edges: false, hull: false, matOpt: { emissive: 0xff5a1e, emissiveIntensity: 0.2 + 0.8 * hot } }), HX, 18, HZ);
    at(cyl(2, 4, 0x2a3348), HX, 33.5, HZ);
    if (hot > 0.15) at(h.glow(0xff8a3c, 10 + 14 * hot, 0.2 + 0.4 * hot), HX, 18, HZ);
    const bubbles = [];
    if (hot > 0.4) for (let i = 0; i < 5; i++) { const b = new T.Mesh(kit.keep(new T.SphereGeometry(0.5, 10, 8)), kit.keep(new T.MeshBasicMaterial({ color: 0xeaf8ff, transparent: true, opacity: 0.7, depthWrite: false }))); at(b, HX + 2.2, 8, HZ); bubbles.push(b); }
    // термометр на передней стенке
    const TX = AX + W / 2 - 8, TZ = AZ + D / 2 - 1.4;
    at(cyl(0.9, 24, 0xeef6fb, { matOpt: { transparent: true, opacity: 0.85 } }), TX, 20, TZ);
    at(h.ball(1.4, 0xe2394b), TX, 7.6, TZ);
    const col = clamp((d.T - 10) / 20, 0.05, 1) * 21;
    at(cyl(0.45, col, 0xe2394b, { edges: false, hull: false }), TX, 8.5 + col / 2, TZ + 0.2);
    for (let v = 12; v <= 30; v += 2) at(box(v % 4 ? 0.8 : 1.5, 0.15, 0.1, 0x1b1610, { edges: false, shadow: false }), TX - 1.2, 8.5 + (v - 10) / 20 * 21, TZ + 0.6);
    // рыбка: плавает туда-сюда, жаберные крышки поднимаются в такт дыханию
    const F = goldfish(kit, h);
    const hb = h.hitBox(18, 11, 9); at(hb, 0, 0, 0, F.g);
    at(F.g, AX, 20, AZ); clickable(F.g, 'tap');
    let dirA = 0;
    const place = (t, L) => {
      const a = t / 5.2, x = AX + 2 + 26 * Math.sin(a), y = 19 + 2.2 * Math.sin(t / 3.3), z = AZ + 3 + 5 * Math.sin(t / 7.1);
      const want = Math.cos(a) >= 0 ? 0 : Math.PI;
      dirA += (want - dirA) * 0.08;
      F.g.position.set(x, y, z); F.g.rotation.y = dirA;
      const ph = L.ph ?? 0.3, f = ph - Math.floor(ph);
      const open = f < 0.45 ? Math.sin(f / 0.45 * Math.PI) : 0, mo = f > 0.55 ? Math.sin((f - 0.55) / 0.45 * Math.PI) : 0;
      F.gills.forEach(({ piv, s }) => { piv.rotation.y = s * open * 0.75; });
      F.mouth.scale.set(1, 0.35 + 1.2 * mo, 1);
      F.tail.rotation.y = kit.reduce ? 0 : 0.35 * Math.sin(t * 6.5);
      const pop = (L.tap ?? 99) < 0.26 ? 1 + 0.08 * Math.sin((L.tap / 0.26) * Math.PI) : 1;
      F.g.scale.setScalar(pop);
    };
    place(0, live());
    // терморегулятор на столе: кнопки −1 °C и +1 °C, табло
    const RG = new T.Group(); at(RG, -50, 0, 28);
    at(box(20, 5, 11, 0x3b4a66), 0, 2.5, 0, RG);
    const rs = h.screen(11, 3.2, 220, 64, (x, pw, ph) => { x.fillStyle = '#0e1520'; x.fillRect(0, 0, pw, ph); h.drawLines(x, pw, ph, [d.T + ' °C'], '#ffb547', 700, 0.7); });
    rs.userData.redraw(); rs.rotation.x = -Math.PI / 2; at(rs, 0, 5.05, -2.2, RG);
    h.key(RG, -5, 3, 7, 4, '−1 °C', 0x2f6fd8, 'cold').position.y = 5;
    h.key(RG, 5, 3, 7, 4, '+1 °C', 0xe0473a, 'hot').position.y = 5;
    h.wire(null, [v3(-50, 3, 22.5), v3(-56, 1.2, 14), v3(-58, 30, -2), v3(-56, 46, AZ - D / 2 + 2), v3(HX, 42, HZ), v3(HX, 35.4, HZ)], 0x2c3240, 0.5);
    // секундомер на подставке: нажать — старт, стрелка бежит 15 секунд
    const SW = new T.Group(); at(SW, 30, 9.5, 26); SW.rotation.x = -0.5;
    const bodyC = cyl(7.4, 2.6, d.run ? 0xffb547 : 0xc6ccd6, { seg: 40 }); bodyC.rotation.x = Math.PI / 2; at(bodyC, 0, 0, 0, SW);
    at(cyl(1.3, 2.2, 0x56627d), 0, 8.4, 0, SW); at(cyl(1.9, 1.2, d.run ? 0xffb547 : 0x8a96b0), 0, 10, 0, SW);
    const dial = h.screen(13.2, 13.2, 256, 256, (x, pw, ph, left) => {
      x.fillStyle = '#05070b'; x.fillRect(0, 0, pw, ph);
      x.fillStyle = '#f7f3ea'; x.beginPath(); x.arc(128, 128, 126, 0, 7); x.fill();
      const frac = left == null ? 0 : 1 - left / 15;
      if (frac > 0) { x.fillStyle = 'rgba(255,181,71,.55)'; x.beginPath(); x.moveTo(128, 128); x.arc(128, 128, 112, -Math.PI / 2, -Math.PI / 2 + frac * 2 * Math.PI); x.closePath(); x.fill(); }
      x.strokeStyle = '#1b1610';
      for (let i = 0; i < 60; i++) { const a = i / 60 * 2 * Math.PI, l = i % 5 ? 8 : 16; x.lineWidth = i % 5 ? 2 : 4; x.beginPath(); x.moveTo(128 + 118 * Math.sin(a), 128 - 118 * Math.cos(a)); x.lineTo(128 + (118 - l) * Math.sin(a), 128 - (118 - l) * Math.cos(a)); x.stroke(); }
      x.fillStyle = '#1b1610'; x.font = '700 34px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(left == null ? '0:15' : '0:' + String(Math.ceil(left)).padStart(2, '0'), 128, 178);
      const a = frac * 2 * Math.PI; x.strokeStyle = '#d6283a'; x.lineWidth = 6; x.lineCap = 'round';
      x.beginPath(); x.moveTo(128, 128); x.lineTo(128 + 100 * Math.sin(a), 128 - 100 * Math.cos(a)); x.stroke();
      x.fillStyle = '#1b1610'; x.beginPath(); x.arc(128, 128, 9, 0, 7); x.fill();
    });
    const dialMesh = dial; dialMesh.geometry.dispose(); dialMesh.geometry = kit.keep(new T.CircleGeometry(6.6, 48));
    at(dialMesh, 0, 0, 1.35, SW);
    at(box(4, 9, 3, 0x56627d), 0, -5.5, -2, SW);
    clickable(SW, 'start');
    let lastKey = '';
    const tick = L => { const left = d.run && L.left != null ? L.left : null, k = left == null ? 'idle' : String(Math.ceil(left * 10)); if (k !== lastKey) { lastKey = k; dial.userData.redraw(left); } };
    tick(live());
    // тетрадь с замерами
    const rows = (d.trials || []).slice(-4).map(([tT, n, ok]) => `${tT} °C: ${n} × 4 = ${n * 4} ${ok ? '✓' : '✗'}`);
    const note = h.sticker(26, 20, ['Замеры за 15 с', ...(rows.length ? rows : ['пока пусто'])].join('\n'), '#1b1610', '#fbf7ea', { pw: 360, k: 0.6, weight: 600 });
    note.rotation.x = -Math.PI / 2; note.rotation.z = 0.12; at(note, 54, 0.12, 26);
    at(box(1, 0.6, 18, 0xe0473a, { edges: false }), 41.5, 0.3, 26);
    onFrame((dt, t) => {
      const L = live(); place(t, L); tick(L);
      if (!kit.reduce) {
        plants.forEach((p, i) => { p.rotation.z = 0.06 * Math.sin(t * 0.7 + i * 1.3); p.rotation.x = 0.04 * Math.sin(t * 0.5 + i); });
        bubbles.forEach((b, i) => { const k = (t / 2.4 + i / bubbles.length) % 1; b.position.y = 8 + k * (WL - 9); b.position.x = HX + 2.2 + Math.sin(t * 3 + i) * 0.5; b.scale.setScalar(0.7 + k * 0.6); });
      }
    });
    // подписи
    tag(v3(AX, 46, AZ), 'Рыбка в аквариуме', d.run ? 'нажимайте при каждом взмахе жабр' : 'жаберные крышки — вдох-выдох');
    tag(v3(TX, 34, TZ), 'Термометр', d.T + ' °C', hot > 0.6);
    tag(v3(-50, 10, 28), 'Нагреватель', '−1 °C / +1 °C');
    tag(v3(30, 21, 24), d.run ? 'Идёт счёт' : 'Секундомер', d.run ? `взмахов: ${d.taps}` : 'нажмите — старт 15 с', d.run);
    const okN = (d.trials || []).filter(t => t[2]).length;
    tag(v3(54, 4, 18), 'Тетрадь', d.pair ? 'два точных замера ✓' : `точных: ${okN}`, d.pair);
  };

  // =====================================================================================
  // 2. Микроскоп: настоящий школьный световой микроскоп и экран камеры окуляра
  // =====================================================================================
  function drawView(x, S, d, st) {
    const X = S / 2, Y = S / 2, R = S / 2 - 20, k = 2 * R / d.fov, sc = R / 112;
    x.fillStyle = '#05070b'; x.fillRect(0, 0, S, S);
    x.save(); x.beginPath(); x.arc(X, Y, R, 0, Math.PI * 2); x.clip();
    x.fillStyle = '#f1efe6'; x.fillRect(0, 0, S, S);
    const blur = Math.min(9, Math.pow(d.err / d.tol, 1.2) * 0.7) * sc;
    if (blur > 0.3 && 'filter' in x) x.filter = `blur(${blur.toFixed(1)}px)`;
    const toS = (px, py) => [X - (px + d.sx) * k, Y - (py + d.sy) * k];
    // пузырёк воздуха на стекле
    { const [bx, by] = toS(-5.2, 1.4), br = 0.35 * k; x.fillStyle = '#fbfaf4'; x.strokeStyle = '#2a2f3a'; x.lineWidth = Math.max(1.5 * sc, br * 0.14); x.beginPath(); x.arc(bx, by, br, 0, 7); x.fill(); x.stroke(); }
    const [ax, ay] = toS(-SPEC.w, -SPEC.h), [ox, oy] = toS(SPEC.w, SPEC.h);
    x.fillStyle = `rgba(${Math.round(205 + 20 * st)},${Math.round(208 - 20 * st)},${Math.round(215 - 140 * st)},${(0.3 + 0.25 * st).toFixed(2)})`;
    x.fillRect(Math.min(ax, ox), Math.min(ay, oy), Math.abs(ax - ox), Math.abs(ay - oy));
    const wall = st > 0.5 ? '#7a5a14' : 'rgba(80,92,112,.6)';
    const half = R / k, pxa = Math.max(-SPEC.w, -d.sx - half), pxb = Math.min(SPEC.w, -d.sx + half), pya = Math.max(-SPEC.h, -d.sy - half), pyb = Math.min(SPEC.h, -d.sy + half);
    if (pxa < pxb && pya < pyb) {
      const r0 = Math.floor((pya + SPEC.h) / CELL.H), r1 = Math.floor((pyb + SPEC.h) / CELL.H);
      const nucA = (0.1 + 0.75 * st) * (d.obj === 40 ? 1 : 0.8), nucC = st > 0.5 ? '#6b3f0c' : '#7d8496';
      x.strokeStyle = wall; x.lineWidth = (d.obj === 40 ? 1.6 : d.obj === 10 ? 0.9 : 0.7) * sc;
      for (let r = r0; r <= r1; r++) {
        const y0 = -SPEC.h + r * CELL.H, y1 = Math.min(SPEC.h, y0 + CELL.H);
        const i0 = Math.floor((pxa + SPEC.w) / CELL.L) - 1, i1 = Math.floor((pxb + SPEC.w) / CELL.L) + 1;
        for (let i = i0; i <= i1; i++) {
          const c = cellBox(r, i); if (!c) continue;
          const [sa, sb] = toS(c.x0, y0), [sc2, sd] = toS(c.x1, y1);
          x.strokeRect(Math.min(sa, sc2), Math.min(sb, sd), Math.abs(sc2 - sa), Math.abs(sd - sb));
          if (d.obj !== 4) {
            const [nx, ny] = toS(c.nx, c.ny);
            x.globalAlpha = nucA; x.fillStyle = nucC; x.beginPath(); x.arc(nx, ny, CELL.r * k, 0, 7); x.fill();
            if (d.obj === 40 && st > 0.5) { x.globalAlpha = 0.7; x.fillStyle = '#3a2006'; x.beginPath(); x.arc(nx - CELL.r * k * 0.25, ny - CELL.r * k * 0.2, CELL.r * k * 0.28, 0, 7); x.fill(); }
            x.globalAlpha = 1;
          }
        }
      }
    }
    if ('filter' in x) x.filter = 'none';
    // свет: мало — темно, много — засвечено
    if (!d.lamp) { x.fillStyle = 'rgba(5,7,11,.96)'; x.fillRect(0, 0, S, S); }
    else if (d.bright < d.need) { x.fillStyle = `rgba(5,7,11,${((1 - d.bright / d.need) * 0.85).toFixed(2)})`; x.fillRect(0, 0, S, S); }
    else if (d.bright > d.need + 0.45) { x.fillStyle = `rgba(255,255,255,${Math.min(0.55, (d.bright - d.need - 0.45) * 1.6).toFixed(2)})`; x.fillRect(0, 0, S, S); }
    if (d.found && d.hit) { const [nx, ny] = toS(d.hit[0], d.hit[1]); x.strokeStyle = '#33a84f'; x.lineWidth = 2.4 * sc; x.beginPath(); x.arc(nx, ny, Math.max(10, CELL.r * k * 2.2), 0, 7); x.stroke(); }
    if (d.lamp) {
      // перекрестье — сюда «смотрит» нажатие на экран
      x.strokeStyle = 'rgba(214,40,58,.55)'; x.lineWidth = 1.6 * sc;
      x.beginPath(); x.moveTo(X - 14 * sc, Y); x.lineTo(X - 5 * sc, Y); x.moveTo(X + 5 * sc, Y); x.lineTo(X + 14 * sc, Y); x.moveTo(X, Y - 14 * sc); x.lineTo(X, Y - 5 * sc); x.moveTo(X, Y + 5 * sc); x.lineTo(X, Y + 14 * sc); x.stroke();
      const bl = BAR[d.obj] * k; x.strokeStyle = '#04070d'; x.lineWidth = 2.4 * sc; x.beginPath(); x.moveTo(X - bl / 2, Y + R - 20 * sc); x.lineTo(X + bl / 2, Y + R - 20 * sc); x.stroke();
      x.fillStyle = '#04070d'; x.font = `600 ${Math.round(9 * sc)}px "Golos Text", sans-serif`; x.textAlign = 'center'; x.fillText(fmt(BAR[d.obj], BAR[d.obj] < 1 ? 1 : 0) + ' мм', X, Y + R - 26 * sc);
    }
    x.restore();
    x.strokeStyle = '#2c3954'; x.lineWidth = 14; x.beginPath(); x.arc(X, Y, R + 4, 0, 7); x.stroke();
  }

  SC['bio-microscope'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, onFrame } = kit, h = H(kit), v3 = h.v3;
    const MX = -16, MZ = -6, DARKB = 0x2a3348, MID = 0x3a4762;
    const M = new T.Group(); at(M, MX, 0, MZ);
    const on = d.lamp, br = on ? d.bright : 0;
    // основание с лампой и выключателем
    at(box(26, 4, 34, DARKB), 0, 2, 2, M); at(box(22, 1, 30, MID), 0, 4.5, 2, M);
    const lampG = new T.Group(); at(lampG, 0, 5, 8, M);
    at(cyl(4, 1.4, MID), 0, 0.7, 0, lampG);
    at(cyl(2.6, 0.5, on ? 0xfff1b8 : 0x56627d, { edges: false, matOpt: on ? { emissive: 0xffd27a, emissiveIntensity: 0.9 } : {} }), 0, 1.6, 0, lampG);
    if (on) at(h.glow(0xffe08a, 8 + 12 * br, 0.5 + 0.4 * br), 0, 2.2, 0, lampG);
    clickable(lampG, 'lamp');
    const sw = box(4, 2.2, 1.6, on ? 0x3fae5a : 0xe0473a); at(sw, 8, 2.6, 19.2, M); clickable(sw, 'lamp');
    // штатив
    at(box(7, 42, 8, DARKB), 0, 25, -11, M);
    at(box(7, 3, 10, DARKB), 0, 20.5, -4, M);
    // диафрагма с рычажком под столиком
    at(cyl(3.6, 3, MID), 0, 19.4, 6, M);
    const lev = new T.Group(); at(lev, 0, 19.4, 6, M); lev.rotation.y = (d.dia - 0.5) * 1.8;
    at(box(1, 0.8, 6, 0xffb547), 0, 0, 5.2, lev); at(h.ball(0.9, 0xffb547), 0, 0, 8.4, lev);
    clickable(lev, 'dia');
    // предметный столик, отверстие, зажимы
    at(box(26, 1.6, 22, 0x1f2636), 0, 22, 6, M);
    const hole = new T.Mesh(kit.keep(new T.CircleGeometry(1.7, 24)), kit.keep(new T.MeshBasicMaterial({ color: on && br > 0.05 ? 0xfff1b8 : 0x05070b })));
    hole.rotation.x = -Math.PI / 2; at(hole, 0, 22.82, 6, M);
    [-1, 1].forEach(s => { const c = box(2, 0.35, 9, 0xc6ccd6); c.rotation.x = 0.05; at(c, s * 7.5, 23.25, 4.5, M); at(cyl(0.8, 1, 0xc6ccd6), s * 7.5, 23.1, 0.4, M); });
    // предметное стекло с кожицей лука; ездит вместе с ползунками
    const SL = new T.Group(); at(SL, d.sx * 0.6, 22.8, 6 + d.sy * 0.45, M);
    const glassS = box(19, 0.3, 6.4, 0xd6ecfa, { matOpt: { transparent: true, opacity: 0.55, depthWrite: false }, shadow: false }); at(glassS, 0, 0.15, 0, SL);
    const st0 = d.stained ? 1 : 0;
    const specMat = h.ownMat(0xe6e1cf, { transparent: true, opacity: 0.9 });
    const spec = new T.Mesh(kit.keep(new T.BoxGeometry(3.6, 0.1, 2.4)), specMat); at(spec, 0, 0.36, 0, SL);
    at(box(4.8, 0.06, 4.8, 0xeef6fb, { matOpt: { transparent: true, opacity: 0.35, depthWrite: false }, edges: true, shadow: false }), 0, 0.45, 0, SL);
    const setSpec = s => specMat.color.set(new T.Color(0xe6e1cf).lerp(new T.Color(0xc99a3a), s));
    setSpec(st0);
    clickable(SL, 'slide');
    // голова: револьвер с объективами, тубус, наклонный окуляр; ходит вверх-вниз от винтов
    const LEN = { 4: 6, 10: 8, 40: 11.5 }, BAND = { 4: 0xd6283a, 10: 0xe9d21f, 40: 0x2179bb };
    const tip0 = 37.3 - LEN[d.obj] - 0.8;
    const yOff = clamp(d.df * 0.12, 23.4 - tip0, 6);
    const HD = new T.Group(); at(HD, 0, yOff, 0, M);
    at(box(6, 5, 16, DARKB), 0, 43, -4, HD);
    const rev = cyl(5, 2.4, MID, { r2: 3.6 }); at(rev, 0, 38.5, 3, HD);
    const OBJS = [4, 10, 40], ai = OBJS.indexOf(d.obj);
    OBJS.forEach((o, i) => {
      const a = (i - ai) * 2.094, px = Math.sin(a) * 3.2, pz = 3 + Math.cos(a) * 3.2;
      const og = new T.Group(); at(og, px, 37.3, pz, HD);
      if (i !== ai) { og.rotation.z = -Math.sin(a) * 0.35; og.rotation.x = Math.cos(a) * 0.35; }
      const L = LEN[o];
      at(cyl(1.35, L, 0xc8d1e2, { r2: 1.6 }), 0, -L / 2, 0, og);
      at(cyl(1.42, 0.7, BAND[o], { edges: false }), 0, -L * 0.32, 0, og);
      at(cyl(0.75, 1, 0x2c3240), 0, -L - 0.4, 0, og);
      const lab = h.sticker(2.6, 1.4, o + '×', '#1b1610', '#f2f4f8', { pw: 128 }); at(lab, 0, -L * 0.62, 1.5, og);
      clickable(og, 'o' + o);
    });
    at(cyl(2.4, 5, DARKB), 0, 42, 2.4, HD);
    const e0 = v3(0, 44, 3), e1 = v3(0, 53, 10);
    h.rod(HD, e0, e1, 1.8, DARKB, { hull: true });
    const eDir = e1.clone().sub(e0).normalize();
    const ep = cyl(1.9, 3.6, 0x56627d); ep.quaternion.setFromUnitVectors(v3(0, 1, 0), eDir); ep.position.copy(e1.clone().addScaledVector(eDir, 1.6)); HD.add(ep);
    const cam = cyl(1.6, 2.2, 0x1b1f28); cam.quaternion.copy(ep.quaternion); cam.position.copy(e1.clone().addScaledVector(eDir, 4.4)); HD.add(cam);
    // винты: справа «+», слева «−»; крупный — макро, маленький — микро
    const knob = (x, r, w, color, ang, keyName) => {
      const g = new T.Group(); at(g, x, 26, -11, M); g.rotation.x = ang;
      const c = cyl(r, w, color, { seg: 20 }); c.rotation.z = Math.PI / 2; at(c, 0, 0, 0, g);
      at(box(w + 0.1, 0.5, 0.6, 0xe8ecf4, { edges: false }), 0, r - 0.2, 0, g);
      clickable(g, keyName); return g;
    };
    const ca = d.coarse * 0.25, fa = d.fine * 2.6;
    knob(4.6, 3.6, 2, 0x56627d, ca, 'cp'); knob(-4.6, 3.6, 2, 0x56627d, ca, 'cm');
    knob(6.6, 2, 1.8, 0x8a96b0, fa, 'fp'); knob(-6.6, 2, 1.8, 0x8a96b0, fa, 'fm');
    // свет идёт вверх через препарат в объектив
    M.updateMatrixWorld(true);
    if (on && br > 0.02) {
      h.shaft(M, v3(0, 6.8, 8), v3(0, 18, 6), 1.4, 0xffe08a, 0.12 + 0.3 * br);
      h.shaft(M, v3(0, 23, 6), v3(0, tip0 + yOff - 0.4, 6), 1.2, 0xffe08a, 0.1 + 0.35 * br);
      at(h.glow(0xffe08a, 4 + 6 * br, 0.35 + 0.4 * br), 0, 23.4, 6, M);
    }
    // йод в пузырьке с пипеткой
    const IB = new T.Group(); at(IB, -50, 0, 22);
    const bot = new T.Mesh(kit.keep(new T.CylinderGeometry(3.4, 3.6, 8, 28)), h.ownMat(0x7a3e12, { transparent: true, opacity: 0.85 })); at(bot, 0, 4, 0, IB); bot.add(new T.Mesh(bot.geometry, kit.hullMat));
    at(cyl(1.6, 1.6, 0x1b1f28), 0, 8.8, 0, IB); at(cyl(1.2, 3, 0x2c3240, { r2: 1.4 }), 0, 11, 0, IB); at(h.ball(1.5, 0xd6283a), 0, 13.3, 0, IB);
    const lb = h.sticker(5.4, 3, 'Йод', '#1b1610', '#fff6e6', { pw: 160 }); at(lb, 0, 4.4, 3.65, IB);
    clickable(IB, 'iod');
    if (d.stained) { at(h.ball(0.5, 0x8a4a12, { hull: false }), 0.6, 0.5, 0.4, SL); }
    // луковица на блюдце
    at(cyl(7, 0.8, 0xf2f4f8, { r2: 8 }), -52, 0.4, -16);
    const onion = h.ball(4.6, 0xc77b9a, { seg: 22, seg2: 16 }); onion.scale.y = 0.85; at(onion, -52, 4.8, -16);
    at(cyl(0.2, 3, 0xb08a4a, { r2: 0.9 }), -52, 9.6, -16);
    // экран камеры окуляра: что видно в микроскоп
    const MN = new T.Group(); at(MN, 38, 0, -4); MN.rotation.y = -0.32;
    at(box(10, 1, 8, 0x2c3240), 0, 0.5, 0, MN); at(box(1.8, 10, 1.8, 0x2c3240), 0, 6, -1, MN);
    at(box(32, 30, 1.8, 0x1b1f28), 0, 24, 0, MN);
    const view = h.screen(27, 27, 512, 512, (x, pw, ph, st) => drawView(x, pw, d, st));
    at(view, 0, 24, 0.95, MN);
    let stK = -1;
    const redraw = L => { const st = clamp(L.stain ?? st0, 0, 1), k = Math.round(st * 10); if (k !== stK) { stK = k; view.userData.redraw(k / 10); setSpec(k / 10); } };
    redraw(live());
    clickable(MN, 'nuc');
    MN.updateMatrixWorld(true);
    const camTip = cam.position.clone().addScaledVector(eDir, 1.2); HD.updateMatrixWorld(true); camTip.applyMatrix4(HD.matrixWorld);
    const mnIn = v3(-16, 14, -1.2).applyMatrix4(MN.matrixWorld);
    h.wire(null, [camTip, camTip.clone().add(v3(4, 4, 0)), v3(14, 40, MZ + 2), v3(20, 20, -8), mnIn], 0x1b1f28, 0.4);
    onFrame(() => redraw(live()));
    // подписи
    const wp = (x, y, z) => v3(MX + x, y, MZ + z);
    tag(wp(0, 62 + yOff, 10), `Окуляр 10× · объектив ${d.obj}×`, `увеличение ${d.mag}×`);
    tag(wp(-11, 32, -11), 'Винты: слева −, справа +', d.sharp ? 'резко' : 'размыто', !d.sharp);
    tag(wp(0, 9, 22), 'Лампа и диафрагма', on ? `открыта на ${Math.round(d.dia * 100)} %${d.lit ? '' : ' · мало света'}` : 'свет выключен', on && !d.lit);
    if (!d.centered) tag(wp(d.sx * 0.6, 27, 14), 'Кожица лука', 'не в центре — нажмите на стекло', true);
    if (d.obj === 40 && d.df < -3.5) tag(wp(0, 30, 12), 'Осторожно', 'объектив близко к стеклу!', true);
    tag(v3(-50, 17, 22), 'Йод', d.stained ? 'препарат окрашен' : 'капнуть на кожицу', d.stained);
    tag(v3(38, 42, -4), 'Вид в окуляр', d.found ? 'ядро найдено ✓' : 'нажмите — ядро в перекрестье', d.found);
  };

  // =====================================================================================
  // 3. Как поставить опыт: две чашки Петри с горохом, лампы, коробка, холодильник, календарь
  // =====================================================================================
  const SEEDPOS = Array.from({ length: 20 }, (_, i) => { const r = Math.sqrt((i + 0.5) / 20) * 0.78, a = i * 2.39996 + 0.4; return [r * Math.cos(a), r * Math.sin(a)]; });
  SC['bio-dishes'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, onFrame } = kit, h = H(kit), v3 = h.v3;
    const R = 14.5, DZ = -4, matDry = h.ownMat(0xb9b06a), matWet = h.ownMat(0xc9cf86);
    const seeds = [];
    d.dishes.forEach((dd, j) => {
      const cx = j ? 32 : -32, g = new T.Group(); at(g, cx, 0, DZ);
      // настольная лампа сзади
      const LG = new T.Group(); at(LG, 0, 0, -24, g);
      at(cyl(4, 1.2, 0x2c3240), 0, 0.6, 0, LG);
      h.rod(LG, v3(0, 1, 0), v3(0, 26, 6), 0.6, 0x56627d, { hull: true });
      const shade = cyl(2, 5, 0x3b6fd8, { r2: 4.6 }); shade.rotation.x = Math.PI; shade.rotation.z = 0; at(shade, 0, 26, 9, LG);
      if (dd.light) { at(h.glow(0xffe08a, 16, 0.75), 0, 23.4, 9, LG); h.shaft(g, v3(0, 22.5, -15), v3(0, 2, 0), 8, 0xffe08a, 0.08); }
      // холодильник со стеклянной дверцей и крышкой
      if (!dd.warm) {
        const FW = 40, FH = 22, FD = 38;
        at(box(FW, FH, 1.4, 0xf3f5f8), 0, FH / 2, -FD / 2, g);
        at(box(1.4, FH, FD, 0xf3f5f8), -FW / 2, FH / 2, 0, g); at(box(1.4, FH, FD, 0xf3f5f8), FW / 2, FH / 2, 0, g);
        at(box(FW, 1.2, FD, 0xe2e7ee), 0, 0.6, 0, g);
        const lid = box(FW, 0.6, FD, 0xbfe6ff, { matOpt: { transparent: true, opacity: 0.16, depthWrite: false }, shadow: false }); lid.renderOrder = 3; at(lid, 0, FH, 0, g);
        const door = box(FW, FH, 0.6, 0xbfe6ff, { matOpt: { transparent: true, opacity: 0.14, depthWrite: false }, shadow: false }); door.renderOrder = 3; at(door, 0, FH / 2, FD / 2, g);
        at(box(1.2, FH - 6, 1.2, 0xc6ccd6), FW / 2 - 3, FH / 2, FD / 2 + 0.9, g);
        const fl = h.sticker(10, 4, '4 °C', '#2179bb', '#eaf6ff', { pw: 200 }); at(fl, -FW / 2 + 7, FH - 3, FD / 2 + 0.4, g);
      }
      const y0 = dd.warm ? 0 : 1.2;
      // чашка: стеклянное дно, стенка, фильтровальная бумага
      at(cyl(R + 0.8, 0.5, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.45 } }), 0, y0 + 0.25, 0, g);
      const wl = new T.Mesh(kit.keep(new T.CylinderGeometry(R + 0.8, R + 0.8, 3, 48, 1, true)), h.glassMat(0xd8eef8, 0.26)); at(wl, 0, y0 + 1.5, 0, g);
      const rim = mesh(new T.TorusGeometry(R + 0.8, 0.22, 6, 48), 0xeef6fb, { edges: false }); rim.rotation.x = Math.PI / 2; at(rim, 0, y0 + 3, 0, g);
      at(cyl(R, 0.25, dd.water ? 0x8fb4cc : 0xe2d6b8, { edges: false, hull: false }), 0, y0 + 0.62, 0, g);
      // семена с корешком и ростком
      for (let i = 0; i < dd.n; i++) {
        const [u, w] = SEEDPOS[i], sg = new T.Group(); at(sg, u * (R - 2), y0 + 1.85, w * (R - 2), g);
        const s = h.ball(1.1, 0, { mat: matDry }); at(s, 0, 0, 0, sg);
        const root = new T.Group(); at(root, 0, 0, 0, sg); root.rotation.y = hash(j + 7, i) * Math.PI * 2;
        h.wire(root, [v3(0.6, -0.3, 0), v3(2, -0.9, 0.5), v3(4, -1.05, 0.2), v3(6.2, -1.05, 0.9)], 0xf4f0e2, 0.32);
        const shoot = new T.Group(); at(shoot, -0.2, 0.6, 0, sg);
        at(cyl(0.32, 4, 0x5fc46e, { edges: false }), 0, 2, 0, shoot);
        [-1, 1].forEach(q => { const lf = h.ball(1, 0x5fc46e, { hull: true }); lf.scale.set(1.2, 0.3, 0.7); lf.rotation.z = q * 0.5; at(lf, q * 1, 4, 0, shoot); });
        root.visible = shoot.visible = false;
        seeds.push({ s, sg, root, shoot, gd: dd.gd[i], wet: dd.water });
      }
      // коробка «в темноте»
      if (!dd.light) {
        const bx = box(34, 12, 34, 0x9a7046, { matOpt: { transparent: true, opacity: 0.62, depthWrite: false } }); bx.renderOrder = 3; at(bx, 0, y0 + 6.2, 0, g);
        const bl = h.sticker(12, 4, 'темно', '#f4efe2', '#5a3e22', { pw: 220 }); bl.rotation.x = -Math.PI / 2; at(bl, 0, y0 + 12.3, 0, g);
      }
      // клавиши условий перед чашкой
      const ON = 0x2f8f9d, OFF = 0x56627d;
      [['water', dd.water ? 'вода' : 'сухо', dd.water], ['light', dd.light ? 'свет' : 'темно', dd.light], ['warm', dd.warm ? '22 °C' : '4 °C', dd.warm]].forEach(([k, lab, onK], q) => {
        h.key(g, -12 + q * 12, 25, 10.5, 6, lab, onK ? ON : OFF, `tg-${j}-${k}`);
      });
      const cond = `${dd.water ? 'мокрая бумага' : 'сухо'} · ${dd.light ? 'на свету' : 'в темноте'} · ${dd.warm ? '22 °C' : '4 °C'}`;
      tag(v3(cx, dd.warm ? 18 : 26, DZ), `Чашка ${'АБ'[j]} · ${dd.n} ${plural(dd.n, 'семя', 'семени', 'семян')}`, d.finished && dd.k != null ? `проросло ${dd.k} из ${dd.n}` : cond, d.finished);
    });
    // отрывной календарь: нажать — ждать 5 дней
    const CG = new T.Group(); at(CG, 0, 0, -22); CG.rotation.x = -0.25;
    at(box(14, 18, 2, 0x2c3240), 0, 9, 0, CG);
    const cal = h.screen(12, 15, 240, 300, (x, pw, ph, day) => {
      x.fillStyle = '#fffaf0'; x.fillRect(0, 0, pw, ph);
      x.fillStyle = '#e0473a'; x.fillRect(0, 0, pw, 70);
      x.fillStyle = '#ffffff'; x.font = '700 38px "Golos Text", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('день', pw / 2, 38);
      x.fillStyle = '#1b1610'; x.font = '700 150px "Golos Text", sans-serif'; x.fillText(String(day), pw / 2, 175);
      x.font = '600 34px "Golos Text", sans-serif'; x.fillStyle = '#56627d'; x.fillText('из ' + d.days, pw / 2, 268);
    });
    at(cal, 0, 10, 1.05, CG);
    for (let i = 0; i < 4; i++) at(cyl(0.5, 1.2, 0xc6ccd6), -4.5 + i * 3, 18.4, 0, CG);
    clickable(CG, 'run');
    // кнопки опыта: число семян, «ждать», «новый опыт» или вывод
    const KZ = 40;
    if (!d.finished) {
      const same = d.dishes[0].n === d.dishes[1].n ? d.dishes[0].n : 0;
      [1, 10, 20].forEach((n, q) => h.key(null, -50 + q * 13, KZ, 12, 6, `${n} ${plural(n, 'семя', 'семени', 'семян')}`, same === n ? 0xb98a2e : 0x56627d, 'n' + n));
      h.key(null, 4, KZ, 20, 6, d.running ? 'идут дни…' : 'ждать 5 дней', d.running ? 0xb98a2e : 0x3fae5a, 'run');
      h.key(null, 30, KZ, 18, 6, 'новый опыт', 0x56627d, 'new');
    } else {
      [['yes', 'вода нужна'], ['no', 'не нужна'], ['unfair', 'опыт нечестный']].forEach(([k, lab], q) => h.key(null, -44 + q * 23, KZ, 21, 6, lab, d.answer === k ? 0xb98a2e : 0x3b6fd8, 'a-' + k));
      h.key(null, 34, KZ, 18, 6, 'новый опыт', 0x56627d, 'new');
    }
    // пакет с семенами
    const PK = new T.Group(); at(PK, 58, 0, 18); PK.rotation.y = -0.4;
    at(box(10, 14, 2, 0x5fc46e), 0, 7, 0, PK);
    const pl = h.sticker(8.6, 6, 'Горох\nсемена', '#1b1610', '#fff6e6', { pw: 200 }); at(pl, 0, 8, 1.05, PK);
    // анимация: семена набухают, появляются корешки и ростки
    let dayK = -1;
    const grow = L => {
      const day = L.day ?? 0;
      const dk = Math.round(Math.min(day, d.days));
      if (dk !== dayK) { dayK = dk; cal.userData.redraw(dk); }
      seeds.forEach(sd => {
        const sw = sd.wet && day > 0.4;
        sd.s.material = sw ? matWet : matDry; sd.s.scale.setScalar(sw ? 1.25 : 1);
        const gg = sd.gd >= 0 && day > sd.gd ? clamp((day - sd.gd) / 2.5, 0, 1) : 0;
        sd.root.visible = gg > 0.01; if (sd.root.visible) sd.root.scale.setScalar(Math.max(0.05, 0.25 + 0.75 * gg));
        sd.shoot.visible = gg > 0.5; if (sd.shoot.visible) sd.shoot.scale.setScalar(Math.max(0.05, (gg - 0.5) * 2));
      });
    };
    grow(live());
    onFrame(() => grow(live()));
    tag(v3(0, 24, -22), d.running ? 'Идут дни' : d.finished ? 'Прошло 5 дней' : 'Календарь', d.valid ? (d.finished ? 'сравните чашки' : 'опыт честный') : d.issue, !d.valid);
  };
})();
