// «Как в жизни» для тем «Механическое движение» (labs/phys-motion) и «Кинематика» (labs/phys-kinem):
// макет района с ниткой-путём и стрелкой-перемещением, велосипедист на треке с метками и секундомером,
// беговая дорожка с графопостроителем s(t), макет трассы A → Б с автобусом и тахографом,
// машинка-капельница у стоп-линии, падение шарика со стробоскопом и линейкой, пружинная пушка на транспортире,
// макет реки с течением, лодкой и плотом (две системы отсчёта).
// Описание сцены приходит из window.LUCH_REAL() опыта; время и положения — из window.LUCH_REAL.live() каждый кадр.
(() => {
  const SC = (window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {});
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const live = () => { try { const f = window.LUCH_REAL && window.LUCH_REAL.live; return f ? f() : null; } catch (e) { return null; } };
  const TAU = Math.PI * 2, DEG = Math.PI / 180;
  const fm = (x, n = 1) => { let s = (Math.round(x * 10 ** n) / 10 ** n).toFixed(n); if (/^-0(\.0+)?$/.test(s)) s = s.slice(1); return s.replace('.', ',').replace('-', '−'); };
  const nf = x => fm(x, Math.abs(x - Math.round(x)) < 1e-9 ? 0 : Math.abs(x * 10 - Math.round(x * 10)) < 1e-9 ? 1 : 2);
  const MONO = '"IBM Plex Mono", monospace';
  const mem = {}; // положения между перестройками сцены (человечек доходит, а не прыгает)
  const rnd = i => { const s = Math.sin(i * 127.1 + 31.7) * 43758.5453; return s - Math.floor(s); };

  // ---------- общие детали ----------
  function tools(kit) {
    const { T, at, box, cyl, mesh, keep, v3, C } = kit;
    const own = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: kit.grad, ...o }));
    const basic = (color, o = {}) => keep(new T.MeshBasicMaterial({ color, ...o }));
    const W = (g, p) => { g.updateMatrixWorld(true); return p.clone().applyMatrix4(g.matrixWorld); };
    function plate(txt, w, h, fg = '#1b1610', bg = '#f7f3ea') {
      const t = keep(kit.textTex(txt, fg, bg, Math.round(64 * w / h), 64));
      return new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: t })));
    }
    // табличка, лежащая на столе (читается сверху-спереди)
    function floorPlate(txt, w, h, x, y, z, fg, bg) { const p = plate(txt, w, h, fg, bg); p.rotation.x = -Math.PI / 2; return at(p, x, y, z); }
    function screen(w, h, pw = 288, ph = 192) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph;
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace;
      const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: tex })));
      return { m, c, x: c.getContext('2d'), tex, W: pw, H: ph };
    }
    function canvasTex(draw, pw, ph, rx = 1, ry = 1) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph; draw(c.getContext('2d'), pw, ph);
      const t = keep(new T.CanvasTexture(c)); t.colorSpace = T.SRGBColorSpace;
      if (rx !== 1 || ry !== 1) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry); }
      return t;
    }
    const texMat = (draw, pw, ph, rx, ry, o = {}) => own(0xffffff, { map: canvasTex(draw, pw, ph, rx, ry), ...o });
    // стрелка вдоль +x; set(len)
    function arrow(col, r = 0.5) {
      const g = new T.Group(), hd = r * 4.4;
      const sh = cyl(r, 1, col, { edges: false, hull: false }); sh.rotation.z = Math.PI / 2; g.add(sh);
      const head = cyl(r * 2.5, hd, col, { r2: 0, edges: false, seg: 18 }); head.rotation.z = -Math.PI / 2; g.add(head);
      return { g, set(len) { const l = Math.max(0.01, len - hd); sh.scale.y = l; sh.position.x = l / 2; head.position.x = l + hd / 2; g.visible = len > hd * 0.8; } };
    }
    // стрелка в любом направлении: set(откуда, вектор)
    function arrow3(col, r = 0.5) {
      const a = arrow(col, r), g = new T.Group(); g.add(a.g); const X = v3(1, 0, 0), dir = v3(0, 0, 0);
      return { g, set(from, vec) { const l = vec.length(); g.position.copy(from); if (l < 1e-4) { a.set(0); return; } dir.copy(vec).multiplyScalar(1 / l); g.quaternion.setFromUnitVectors(X, dir); a.set(l); } };
    }
    function rod(col, r = 0.22) {
      const m = cyl(r, 1, col, { edges: false, hull: false, seg: 8 }); const up = v3(0, 1, 0), dv = v3(0, 0, 0);
      return { m, set(a, b) { dv.copy(b).sub(a); const l = dv.length(); if (l < 1e-4) return; m.position.copy(a).addScaledVector(dv, 0.5); m.quaternion.setFromUnitVectors(up, dv.multiplyScalar(1 / l)); m.scale.set(1, l, 1); } };
    }
    function button(parent, x, y, z, txt, key, o = {}) {
      const b = new T.Group(); at(b, x, y, z, parent);
      const w = o.w || 5, h = o.h || 3.4;
      at(box(w, h, 1.4, o.col || 0xe8ecf4), 0, 0, 0, b);
      const p = plate(txt, w - 0.9, h - 1, o.fg || '#1b1610', o.bg || '#e8ecf4'); at(p, 0, 0, 0.72, b);
      kit.clickable(b, key); return b;
    }
    const red = { col: 0xe0473a, bg: '#e0473a', fg: '#ffffff' }, green = { col: 0x3fae5a, bg: '#3fae5a', fg: '#ffffff' }, yel = { col: 0xffd166, bg: '#ffd166' };
    // пульт: корпус, табло (dark) и кнопки на передней грани (+z)
    function pult(x, z, w, h = 12) {
      const g = new T.Group(); at(g, x, 0, z);
      at(box(w, h, 9, 0x3b4a66), 0, h / 2, 0, g); at(box(w + 0.4, 0.8, 9.4, 0x46536a), 0, h + 0.4, 0, g);
      return g;
    }
    const disp = (g, x, y, txt, w, col = '#ffb547') => at(plate(txt, w, 4, col, '#0e1520'), x, y, 4.56, g);
    // экран на стойках (задний край стола)
    function monitor(x, z, w, h, pw, ph, yc) {
      const g = new T.Group(); at(g, x, 0, z);
      const leg = yc - h / 2 - 1;
      for (const sx of [-w / 2 + 5, w / 2 - 5]) { at(box(3, leg + 1, 3, C.DARK), sx, (leg + 1) / 2, 0, g); at(box(7, 0.8, 7, C.DARK), sx, 0.4, 0, g); }
      at(box(w + 3, h + 3, 4, 0x2c3240), 0, yc, 0, g);
      const s = screen(w, h, pw, ph); at(s.m, 0, yc, 2.06, g);
      return { g, s, top: yc + h / 2 + 1.5 };
    }
    // человечек: ступни на y = 0, лицом к +x, высота ~8; swing(фаза, размах) — шаг
    function person(col, o = {}) {
      const g = new T.Group(), legs = [], arms = [];
      for (const sz of [-1, 1]) { const l = new T.Group(); at(l, 0, 3.2, sz * 0.62, g); at(cyl(0.48, 3.2, o.pants || 0x2c3e66, { seg: 8 }), 0, -1.6, 0, l); legs.push(l); }
      at(cyl(1.15, 3.2, col, { seg: 14, r2: 1.0 }), 0, 4.7, 0, g);
      for (const sz of [-1, 1]) { const a = new T.Group(); at(a, 0, 6, sz * 1.5, g); at(cyl(0.36, 2.8, col, { seg: 8 }), 0, -1.4, 0, a); arms.push(a); }
      at(mesh(new T.SphereGeometry(1.2, 18, 12), 0xf2c9a0, { hull: true, edges: false }), 0, 7.5, 0, g);
      const hair = mesh(new T.SphereGeometry(1.26, 18, 10, 0, TAU, 0, Math.PI / 2), o.hair || 0x3a2a1e, { hull: false, edges: false }); hair.rotation.z = 0.35; at(hair, -0.1, 7.6, 0, g);
      return { g, swing(ph, amp) { const s = Math.sin(ph) * amp; legs[0].rotation.z = s; legs[1].rotation.z = -s; arms[0].rotation.z = -s * 0.9; arms[1].rotation.z = s * 0.9; } };
    }
    function flagPole(x, z, h, tex, col = C.STEEL) {
      const g = new T.Group(); at(g, x, 0, z);
      at(cyl(1.4, 0.6, C.DARK), 0, 0.3, 0, g); at(cyl(0.3, h, col, { edges: false }), 0, h / 2, 0, g);
      const f = new T.Mesh(keep(new T.PlaneGeometry(6, 3.6)), basic(0xffffff, { map: tex, side: T.DoubleSide })); at(f, 3.1, h - 2, 0, g);
      return g;
    }
    // часть кривой: кружки-точки (стробоскоп, след), только видимые первые n
    function dots(n, r, col, o = {}) {
      const geo = keep(new T.SphereGeometry(r, 10, 8)), mat = basic(col, o), list = [];
      for (let i = 0; i < n; i++) { const m = new T.Mesh(geo, mat); m.visible = false; kit.root.add(m); list.push(m); }
      return list;
    }
    return { own, basic, W, plate, floorPlate, screen, canvasTex, texMat, arrow, arrow3, rod, button, pult, disp, monitor, person, flagPole, dots, red, green, yel };
  }

  // ---------- рисунки ----------
  function drawGrass(x, w, h) { x.fillStyle = '#6aa84f'; x.fillRect(0, 0, w, h); for (let i = 0; i < 260; i++) { x.fillStyle = i % 2 ? '#5d9946' : '#7bb75e'; x.fillRect(rnd(i) * w, rnd(i + 400) * h, 3, 5); } }
  function drawAsphalt(x, w, h) { x.fillStyle = '#454b58'; x.fillRect(0, 0, w, h); for (let i = 0; i < 300; i++) { x.fillStyle = i % 2 ? '#3d424e' : '#535a68'; x.fillRect(rnd(i) * w, rnd(i + 300) * h, 2, 2); } }
  function drawTartan(x, w, h) { x.fillStyle = '#b5523b'; x.fillRect(0, 0, w, h); for (let i = 0; i < 300; i++) { x.fillStyle = i % 2 ? '#a64733' : '#c4614a'; x.fillRect(rnd(i) * w, rnd(i + 200) * h, 2, 2); } }
  function drawWater(x, w, h) {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2c78b0'); g.addColorStop(1, '#3a8cc4'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(200,238,255,.55)'; x.lineWidth = 3; x.lineCap = 'round';
    for (let i = 0; i < 22; i++) { const px = rnd(i) * w, py = rnd(i + 70) * h; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + 14, py - 4, px + 30 + rnd(i + 5) * 20, py); x.stroke(); }
  }
  function drawChecker(x, w, h) { for (let i = 0; i < 8; i++) for (let j = 0; j < 5; j++) { x.fillStyle = (i + j) % 2 ? '#f4f4f4' : '#16181d'; x.fillRect(i * w / 8, j * h / 5, w / 8 + 1, h / 5 + 1); } }
  function drawSand(x, w, h) { x.fillStyle = '#e2c98f'; x.fillRect(0, 0, w, h); for (let i = 0; i < 200; i++) { x.fillStyle = i % 2 ? '#d4b878' : '#ecd7a6'; x.fillRect(rnd(i) * w, rnd(i + 90) * h, 2, 2); } }
  function drawEarth(x, w, h) {
    x.fillStyle = '#2f6fb0'; x.fillRect(0, 0, w, h); x.fillStyle = '#4c9a62';
    for (const [cx, cy, rx, ry] of [[0.12, 0.32, 0.09, 0.14], [0.2, 0.62, 0.06, 0.16], [0.47, 0.3, 0.1, 0.1], [0.52, 0.58, 0.07, 0.16], [0.7, 0.3, 0.16, 0.12], [0.84, 0.66, 0.06, 0.06]]) { x.beginPath(); x.ellipse(cx * w, cy * h, rx * w, ry * h, 0.3, 0, TAU); x.fill(); }
    x.fillStyle = '#f4f8fb'; x.fillRect(0, 0, w, h * 0.07); x.fillRect(0, h * 0.93, w, h * 0.07);
  }
  function drawMoon(x, w, h) {
    x.fillStyle = '#b9bcc4'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { const r = 4 + rnd(i + 3) * 14; x.fillStyle = i % 3 ? '#9fa3ad' : '#868b96'; x.beginPath(); x.arc(rnd(i) * w, rnd(i + 40) * h, r, 0, TAU); x.fill(); }
  }
  function drawRegolith(x, w, h) { x.fillStyle = '#9a9ca3'; x.fillRect(0, 0, w, h); for (let i = 0; i < 160; i++) { x.fillStyle = i % 2 ? '#8a8c94' : '#adb0b6'; x.beginPath(); x.arc(rnd(i) * w, rnd(i + 11) * h, 1 + rnd(i + 5) * 3, 0, TAU); x.fill(); } }
  function drawSign(txt) {
    return (x, w, h) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); x.strokeStyle = '#d42d22'; x.lineWidth = w * 0.12; x.beginPath(); x.arc(w / 2, h / 2, w / 2 - w * 0.07, 0, TAU); x.stroke();
      x.fillStyle = '#111'; x.font = `800 ${Math.round(w * (txt.length > 2 ? 0.3 : 0.4))}px Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, w / 2, h / 2 + w * 0.02); };
  }
  // оси графика на холсте → функции перевода
  function axes(x, o) {
    const X = v => o.x0 + o.w * v / o.xmax, Y = v => o.y0 + o.h - o.h * v / o.ymax;
    x.lineWidth = 1; x.strokeStyle = 'rgba(160,185,230,.18)'; x.fillStyle = '#8b96ad'; x.font = `500 ${o.fs || 15}px ${MONO}`;
    x.textAlign = 'center'; x.textBaseline = 'top';
    for (const v of o.xs) { x.beginPath(); x.moveTo(X(v), o.y0); x.lineTo(X(v), o.y0 + o.h); x.stroke(); x.fillText(String(v).replace('.', ','), X(v), o.y0 + o.h + 5); }
    x.textAlign = 'right'; x.textBaseline = 'middle';
    for (const v of o.ys) { x.beginPath(); x.moveTo(o.x0, Y(v)); x.lineTo(o.x0 + o.w, Y(v)); x.stroke(); x.fillText(String(v), o.x0 - 6, Y(v)); }
    x.strokeStyle = '#a9b4c9'; x.lineWidth = 2; x.beginPath(); x.moveTo(o.x0, o.y0 - 6); x.lineTo(o.x0, o.y0 + o.h); x.lineTo(o.x0 + o.w + 6, o.y0 + o.h); x.stroke();
    x.fillStyle = '#a9b4c9'; x.textAlign = 'right'; x.textBaseline = 'bottom'; x.fillText(o.xl, o.x0 + o.w, o.y0 + o.h - 4);
    x.textAlign = 'left'; x.textBaseline = 'top'; x.fillText(o.yl, o.x0 + 6, o.y0 - 4);
    return { X, Y };
  }
  function pline(x, pts, col, w, dash) {
    if (pts.length < 2) return; x.strokeStyle = col; x.lineWidth = w; x.setLineDash(dash || []); x.lineJoin = 'round';
    x.beginPath(); pts.forEach(([a, b], k) => k ? x.lineTo(a, b) : x.moveTo(a, b)); x.stroke(); x.setLineDash([]);
  }
  function dot(x, a, b, r, col) { x.fillStyle = col; x.strokeStyle = '#04070d'; x.lineWidth = 2.4; x.beginPath(); x.arc(a, b, r, 0, TAU); x.fill(); x.stroke(); }
  function bigText(x, txt, px, py, size, col, align = 'left') { x.fillStyle = col; x.font = `700 ${size}px ${MONO}`; x.textAlign = align; x.textBaseline = 'top'; x.fillText(txt, px, py); }

  // =====================================================================================
  // Путь и перемещение: макет района на столе, человечек, нитка по улицам (путь), синяя стрелка (перемещение), пульт со стрелками
  SC['kin-map'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, C } = kit;
    const K = tools(kit);
    const CELL = 12, NX = c => -42 + c * CELL, NZ = r => -32 + r * CELL, BT = 1.6, SW = BT + 0.6;
    at(box(100, BT, 66, 0, { mat: K.texMat(drawAsphalt, 128, 128, 6, 4) }), 0, BT / 2, -8);
    const parks = { '2,2': 1, '6,3': 1, '0,0': 1, '3,0': 1 };
    const hc = d.home.c, hr = d.home.r, sc = d.sch.c, sr = d.sch.r;
    const homeB = [hc - 1, hr - 1], schB = [sc, sr - 1];
    const COLS = [0xe8d7b5, 0xb9c7d9, 0xd9b8a8, 0xc8d6b9, 0xe2c290, 0xcfc2dc];
    const tree = (x, z, s = 1) => { at(cyl(0.45 * s, 1.6 * s, 0x7a5232, { seg: 6 }), x, SW + 0.8 * s, z); at(mesh(new T.SphereGeometry(1.7 * s, 12, 8), 0x3f9a52, { hull: true, edges: false }), x, SW + 2.6 * s, z); };
    for (let c = 0; c < 7; c++) for (let r = 0; r < 4; r++) {
      const cx = NX(c) + CELL / 2, cz = NZ(r) + CELL / 2, pk = parks[c + ',' + r];
      at(box(8.8, 0.6, 8.8, pk ? 0x6fb35a : 0xd9d4c7), cx, BT + 0.3, cz);
      if (c === homeB[0] && r === homeB[1]) {
        at(box(5.6, 4, 5.6, 0xffb547), cx, SW + 2, cz);
        const rf = cyl(4.6, 3, 0xc0502f, { r2: 0, seg: 4 }); rf.rotation.y = Math.PI / 4; at(rf, cx, SW + 5.5, cz);
        at(box(1.4, 2.2, 0.1, 0x3a2a1e, { edges: false }), cx + 1, SW + 1.1, cz + 2.85);
        at(box(1.3, 1.3, 0.1, 0x9fd4ea, { edges: false }), cx - 1.4, SW + 2.6, cz + 2.85);
        continue;
      }
      if (c === schB[0] && r === schB[1]) {
        at(box(8, 5, 6.4, 0x72d4e8), cx, SW + 2.5, cz);
        at(box(8.6, 0.8, 7, 0x4c9fb3), cx, SW + 5.4, cz);
        for (let k = 0; k < 3; k++) at(box(1.4, 1.2, 0.1, 0x2b3a55, { edges: false }), cx - 2.6 + k * 2.6, SW + 3.4, cz + 3.25);
        at(box(1.6, 2, 0.1, 0x2b3a55, { edges: false }), cx, SW + 1, cz + 3.25);
        at(cyl(0.18, 5, C.STEEL, { edges: false }), cx + 3.4, SW + 8.3, cz - 2.4);
        at(box(2.4, 1.4, 0.1, 0x3fae5a, { edges: false }), cx + 4.6, SW + 10, cz - 2.4);
        continue;
      }
      if (pk) { tree(cx - 2.2, cz - 1.8); tree(cx + 2.2, cz + 2, 1.15); tree(cx + 2, cz - 2.4, 0.8); continue; }
      const i = c * 4 + r, hgt = 2.5 + rnd(i) * 4;
      if (rnd(i + 9) > 0.5) { at(box(7.4, hgt, 3.4, COLS[i % 6]), cx, SW + hgt / 2, cz - 1.8); at(box(3.4, hgt * 0.7, 3.4, COLS[(i + 2) % 6]), cx - 2, SW + hgt * 0.35, cz + 2); }
      else { at(box(3.4, hgt, 7.4, COLS[i % 6]), cx - 1.8, SW + hgt / 2, cz); at(box(3.4, 2 + rnd(i + 3) * 2, 3.4, COLS[(i + 3) % 6]), cx + 2, SW + 1.5, cz + 2); }
    }
    // разметка улиц
    for (let r = 0; r <= 4; r++) for (let c = 0; c < 7; c++) for (const f of [0.25, 0.75]) at(box(2.6, 0.06, 0.35, 0xf2f2f2, { edges: false, shadow: false }), NX(c) + f * CELL, BT + 0.03, NZ(r));
    for (let c = 0; c <= 7; c++) for (let r = 0; r < 4; r++) for (const f of [0.25, 0.75]) at(box(0.35, 0.06, 2.6, 0xf2f2f2, { edges: false, shadow: false }), NX(c), BT + 0.03, NZ(r) + f * CELL);
    // кольца у дома и школы
    const ring = (x, z, col) => { const m = new kit.T.Mesh(kit.keep(new T.TorusGeometry(2.2, 0.35, 6, 28)), K.own(col)); m.rotation.x = Math.PI / 2; at(m, x, BT + 0.2, z); };
    ring(NX(hc), NZ(hr), 0xffb547); ring(NX(sc), NZ(sr), 0x3fb6d6);
    // катушка ниток у дома и нитка по пройденным улицам
    const spool = v3(NX(hc) - 3.4, 0, NZ(hr) + 3.4);
    at(cyl(1.5, 0.5, 0xd9b77a), spool.x, BT + 0.25, spool.z); at(cyl(1.0, 1.8, 0xff9a2e), spool.x, BT + 1.4, spool.z); at(cyl(1.5, 0.5, 0xd9b77a), spool.x, BT + 2.55, spool.z);
    const yT = BT + 0.45, path = new T.CurvePath();
    let prev = v3(spool.x, BT + 1.4, spool.z);
    const pts = [v3(NX(hc), yT, NZ(hr))].concat(d.trail.slice(1).map(([c, r]) => v3(NX(c), yT, NZ(r))));
    for (const p of pts) { if (p.distanceTo(prev) > 0.01) path.add(new T.LineCurve3(prev.clone(), p.clone())); prev = p; }
    if (path.curves.length) kit.root.add(mesh(new T.TubeGeometry(path, Math.max(8, path.curves.length * 6), 0.42, 6, false), 0xff9a2e, { edges: false, hull: false }));
    // флажок-булавка у дома и стрелка перемещения над крышами
    const AY = BT + 10.5;
    at(cyl(0.22, AY - BT, 0x3fb6d6, { edges: false }), NX(hc), BT + (AY - BT) / 2, NZ(hr));
    at(mesh(new T.SphereGeometry(0.8, 12, 8), 0x3fb6d6, { hull: true, edges: false }), NX(hc), AY, NZ(hr));
    const dA = K.arrow3(0x3fb6d6, 0.55); kit.root.add(dA.g);
    const drop = cyl(0.12, 1, 0x3fb6d6, { edges: false, hull: false }); kit.root.add(drop);
    // человечек
    const man = K.person(0xf4f6fb, { pants: 0x2c3e66 }); man.g.scale.setScalar(0.72); kit.root.add(man.g);
    const tgt = v3(NX(d.pos.c), BT, NZ(d.pos.r));
    const cur = mem.walk && mem.walk.key === JSON.stringify(d.home) ? mem.walk.p.clone() : tgt.clone();
    man.g.position.copy(cur);
    // мерная линейка «100 м»
    at(box(CELL, 0.4, 1.2, 0xf1e3c2), NX(0) + CELL / 2, 0.2, 28.5);
    for (const x of [NX(0), NX(1)]) at(box(0.3, 1.4, 1.6, 0x1b1610), x, 0.7, 28.5);
    K.floorPlate('100 м', 6, 2.2, NX(1) + 4.6, 0.06, 28.5);
    // табло: путь и перемещение
    const tb = new T.Group(); at(tb, -26, 0, 38);
    at(box(26, 9, 7, 0x2c3240), 0, 4.5, 0, tb);
    const s = K.screen(23, 6.6, 368, 106); at(s.m, 0, 5, 3.56, tb);
    { const x = s.x; x.fillStyle = '#0c1a14'; x.fillRect(0, 0, s.W, s.H);
      bigText(x, 'путь s = ' + d.s + ' м', 14, 10, 36, '#ffb547'); bigText(x, 'перемещ. = ' + nf(d.d) + ' м', 14, 58, 36, '#72d4e8'); s.tex.needsUpdate = true; }
    // пульт со стрелками
    const pu = K.pult(24, 38, 40, 10);
    const bo = { w: 6, h: 4.6 };
    K.button(pu, -15, 5, 4.7, '←', 'w-l', bo); K.button(pu, -8.4, 5, 4.7, '↑', 'w-u', bo); K.button(pu, -1.8, 5, 4.7, '↓', 'w-d', bo); K.button(pu, 4.8, 5, 4.7, '→', 'w-r', bo);
    K.button(pu, 13.6, 5, 4.7, 'Сначала', 'reset', { w: 10, h: 4.6 });

    tag(v3(NX(hc) - 9, 4, NZ(hr) + 4), 'Дом', 'отсюда считаем');
    tag(v3(NX(sc) + 6, 15, NZ(sr) - 6), 'Школа', d.school ? 'дошли за 700 м' : '4 на восток, 3 на север', d.school);
    const manTag = v3(cur.x, 9, cur.z);
    tag(manTag, 'Нитка = путь', 's = ' + d.s + ' м', d.back);
    const arTag = v3(0, AY + 2, 0);
    if (d.d > 0) tag(arTag, 'Перемещение', nf(d.d) + ' м');
    tag(v3(24, 12, 38), 'Пульт', 'шаг — 1 квартал = 100 м');

    let ph = 0;
    const place = () => {
      man.g.position.copy(cur); manTag.x = cur.x; manTag.z = cur.z;
      const from = v3(NX(hc), AY, NZ(hr)), to = v3(cur.x, AY, cur.z), vec = to.clone().sub(from);
      dA.set(from, vec); arTag.x = (from.x + to.x) / 2; arTag.z = (from.z + to.z) / 2;
      const yl = BT + 6.2; drop.visible = vec.length() > 1; drop.position.set(cur.x, (AY + yl) / 2, cur.z); drop.scale.y = AY - yl;
      mem.walk = { key: JSON.stringify(d.home), p: cur.clone() };
    };
    place();
    kit.onFrame((dt) => {
      const dv = tgt.clone().sub(cur), l = dv.length();
      if (l > 0.02) {
        const st = kit.reduce ? l : Math.min(l, dt * 34); cur.addScaledVector(dv, st / l);
        man.g.rotation.y = Math.atan2(-dv.z, dv.x); ph += st * 0.9; man.swing(ph, 0.6);
      } else { cur.copy(tgt); man.swing(0, 0); }
      place();
    });
  };

  // =====================================================================================
  // Скорость: дорога 600 м с отметками, велосипедист, метки каждые 10 с, секундомер, пульт (и перевод в км/ч)
  SC['kin-speed'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const PPM = 0.16, XS = -48, RZ = -4, RT = 1.6;
    at(box(118, 1.2, 30, 0, { mat: K.texMat(drawGrass, 128, 128, 8, 2) }), 0, 0.6, -4);
    at(box(112, 0.4, 12, 0, { mat: K.texMat(drawAsphalt, 128, 128, 10, 1) }), 0, 1.4, RZ);
    for (let x = -54; x < 54; x += 6) at(box(3, 0.05, 0.4, 0xf2f2f2, { edges: false, shadow: false }), x + 1.5, RT + 0.03, RZ);
    for (const s of [-1, 1]) at(box(112, 0.05, 0.35, 0xf2f2f2, { edges: false, shadow: false }), 0, RT + 0.03, RZ + s * 5.4);
    for (let m = 0; m <= d.dist; m += 100) {
      const x = XS + m * PPM;
      at(cyl(0.35, 3.4, 0xf2f2f2, { edges: false }), x, 1.2 + 1.7, RZ - 7.6); at(cyl(0.38, 0.8, 0xe0473a, { edges: false }), x, 1.2 + 3.2, RZ - 7.6);
      K.floorPlate(m === d.dist ? '600 м' : String(m), m === d.dist ? 6 : 4.4, 2.2, x, 1.24, RZ + 8.2, '#1b1610', '#f1e3c2');
    }
    // финишная клетка поперёк дороги и флаги
    const xf = XS + d.dist * PPM;
    at(box(1.8, 0.06, 10.6, 0, { mat: K.texMat(drawChecker, 64, 256, 1, 1), edges: false }), xf, RT + 0.04, RZ);
    at(box(0.6, 0.06, 10.6, 0xf2f2f2, { edges: false }), XS, RT + 0.04, RZ);
    K.flagPole(XS - 1, RZ - 10, 13, K.canvasTex((x, w, h) => { x.fillStyle = '#3fae5a'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.font = `800 ${h * 0.45}px Arial`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('СТАРТ', w / 2, h / 2); }, 160, 96));
    K.flagPole(xf + 1, RZ - 10, 13, K.canvasTex(drawChecker, 160, 96));
    // велосипед с велосипедистом (лицом к +x)
    const bk = new T.Group(); kit.root.add(bk); clickable(bk, 'go'); bk.scale.setScalar(1.4);
    const WR = 2.2, WY = RT + WR + 0.35, wheels = [];
    for (const wx of [-3.4, 3.4]) {
      const w = new T.Group(); at(w, wx, WY, 0, bk);
      w.add(mesh(new T.TorusGeometry(WR, 0.35, 8, 28), 0x2b3346, { hull: true, edges: false }));
      for (const r of [0, Math.PI / 2]) { const sp = box(WR * 2 - 0.4, 0.14, 0.14, 0xb8c0cc, { edges: false, shadow: false }); sp.rotation.z = r; w.add(sp); }
      at(cyl(0.45, 0.8, C.STEEL, { seg: 10 }), 0, 0, 0, w).rotation.x = Math.PI / 2;
      wheels.push(w);
    }
    const P = (x, y, z = 0) => v3(x, y, z);
    const hubR = P(-3.4, WY), hubF = P(3.4, WY), bb = P(-0.3, WY - 0.4), seat = P(-1.5, WY + 3.4), head = P(2.5, WY + 3.6);
    for (const [a, b] of [[hubR, bb], [bb, seat], [seat, hubR], [seat, head], [bb, head], [head, hubF]]) { const r = K.rod(0xffb547, 0.3); bk.add(r.m); r.set(a, b); }
    at(box(2, 0.5, 1, 0x1b1f28), -1.6, WY + 3.75, 0, bk);
    const hb = cyl(0.22, 3, 0x3a3f4c, { edges: false }); hb.rotation.x = Math.PI / 2; at(hb, 2.2, WY + 4.6, 0, bk);
    { const r = K.rod(0x3a3f4c, 0.24); bk.add(r.m); r.set(head, P(2.2, WY + 4.6)); }
    // седок
    const hip = P(-1.3, WY + 4.2), sh = P(0.9, WY + 7.6);
    { const r = K.rod(0x72d4e8, 1.05); bk.add(r.m); r.set(hip, sh); }
    at(mesh(new T.SphereGeometry(1.15, 16, 12), 0xf2c9a0, { hull: true, edges: false }), 1.6, WY + 9, 0, bk);
    const hel = mesh(new T.SphereGeometry(1.3, 16, 10, 0, TAU, 0, Math.PI / 2), 0xe0473a, { hull: true, edges: false }); at(hel, 1.5, WY + 9.2, 0, bk);
    for (const sz of [-1, 1]) { const r = K.rod(0x72d4e8, 0.32); bk.add(r.m); r.set(P(sh.x, sh.y - 0.4, sz * 1.0), P(2.2, WY + 4.6, sz * 1.2)); }
    const legs = [-1, 1].map(sz => { const a = K.rod(0x2c3e66, 0.42), b = K.rod(0x2c3e66, 0.38); bk.add(a.m); bk.add(b.m); return { a, b, sz }; });
    const pose = ph => legs.forEach(({ a, b, sz }, k) => {
      const an = ph + k * Math.PI, pd = P(bb.x + Math.cos(an) * 1.2, bb.y + Math.sin(an) * 1.2, sz * 1.0), hp = P(hip.x, hip.y, sz * 0.7);
      const mid = hp.clone().add(pd).multiplyScalar(0.5); const kn = P(mid.x + 1.3, mid.y + 0.4, sz * 0.9);
      a.set(hp, kn); b.set(kn, pd);
    });
    pose(0);
    // метки каждые 10 с (диски на дороге) и подписи к ним
    const nMax = Math.min(60, Math.floor(d.dist / d.v / 10 + 1e-9));
    const marks = []; for (let k = 1; k <= nMax; k++) { const m = cyl(0.9, 0.3, 0x3fb6d6, { edges: false, seg: 16 }); at(m, XS + Math.min(d.dist, d.v * 10 * k) * PPM, RT + 0.15, RZ + 2.6); m.visible = false; marks.push(m); }
    const step = Math.max(1, Math.ceil(6 / (d.v * 10 * PPM)));
    const labs = []; for (let k = step; k <= nMax && labs.length < 12; k += step) { const p = K.floorPlate(k * 10 + ' с', 4.2, 1.8, XS + Math.min(d.dist, d.v * 10 * k) * PPM, RT + 0.06, RZ + 4.4, '#ffffff', '#2c8fb0'); p.visible = false; labs.push({ p, k }); }
    // секундомер
    const sw = new T.Group(); at(sw, -20, 0, 37);
    at(box(28, 11, 9, 0x2c3240), 0, 5.5, 0, sw); at(box(28.4, 0.8, 9.4, 0x46536a), 0, 11.4, 0, sw);
    const ss = K.screen(24, 7.2, 384, 115); at(ss.m, 0, 6.6, 4.56, sw);
    at(K.plate('секундомер · время ×30', 16, 1.8, '#fff6e6', '#2c3240'), 0, 1.6, 4.56, sw);
    // пульт
    const pu = K.pult(26, 37, 46, 12);
    K.disp(pu, -14, 8.6, 'v = ' + nf(d.v) + ' м/с', 14);
    K.button(pu, -2.4, 8.6, 4.7, 'v −', 'v-', { w: 6.6, h: 4.4 }); K.button(pu, 4.8, 8.6, 4.7, 'v +', 'v+', { w: 6.6, h: 4.4 });
    K.button(pu, 15, 8.6, 4.7, d.run ? 'Едет…' : 'Старт', 'go', { w: 11, h: 4.4, ...(d.run ? K.green : K.red) });
    if (d.opts) d.opts.forEach((k, i) => K.button(pu, -16.5 + i * 9.4, 3, 4.7, k + ' км/ч', 'kmh-' + k, { w: 9, h: 4, ...K.yel }));
    else K.button(pu, 15, 3, 4.7, 'Сброс', 'reset', { w: 11, h: 4 });

    const bkTag = v3(XS, 17, RZ);
    tag(bkTag, 'Велосипедист', d.kmh ? nf(d.v) + ' м/с = ' + nf(d.v * 3.6) + ' км/ч' : 'v = ' + nf(d.v) + ' м/с', d.kmh);
    tag(v3(-20, 14, 37), 'Секундомер', d.finT != null ? 'финиш за ' + fm(d.finT, 1) + ' с' : '600 м нужно за 120 с', d.ride);
    tag(v3(26, 15, 37), 'Пульт', d.opts ? 'сколько это в км/ч?' : d.kmh ? 'задание выполнено' : 'v и «Старт»', !!d.opts);
    tag(v3(14, 3, RZ + 6), 'Метки каждые 10 с', 'равные отрезки');

    let tick = 0, last = -1;
    kit.onFrame(() => {
      const Lv = live(); if (!Lv) return;
      const x = XS + Lv.s * PPM; bk.position.set(x, -0.4 * RT, RZ); bkTag.x = x;
      const rot = -Lv.s * PPM / WR; wheels.forEach(w => { w.rotation.z = rot; }); pose(rot * 1.4);
      const n = Math.floor(Lv.t / 10 + 1e-9);
      marks.forEach((m, k) => { m.visible = k + 1 <= n; });
      labs.forEach(l => { l.p.visible = l.k <= n; });
      if (((tick++ & 1) && tick > 2) || (Lv.t === last && tick > 4)) return; last = Lv.t;
      const c = ss.x; c.fillStyle = '#0c1a14'; c.fillRect(0, 0, ss.W, ss.H); c.shadowColor = '#86e0a8'; c.shadowBlur = 8;
      bigText(c, 't = ' + fm(Lv.t, 1) + ' с', ss.W / 2, 10, 50, Lv.run ? '#86e0a8' : '#e8ecf4', 'center'); c.shadowBlur = 0;
      bigText(c, 's = ' + fm(Lv.s, 0) + ' м', ss.W / 2, 72, 30, '#8b96ad', 'center');
      ss.tex.needsUpdate = true;
    });
  };

  // =====================================================================================
  // График движения: беговая дорожка 60 м с двумя бегунами и экран-графопостроитель s(t) и v(t)
  SC['kin-graph'] = (kit, d) => {
    const { T, at, box, cyl, v3, tag, clickable } = kit;
    const K = tools(kit);
    const XS = -40, PPM = 80 / 60, ZG = 8, ZY = 20, TT = 1;
    at(box(98, TT, 24, 0, { mat: K.texMat(drawTartan, 128, 128, 8, 2) }), 0, TT / 2, 14);
    for (const z of [2.4, 14, 25.6]) at(box(98, 0.05, 0.35, 0xf2f2f2, { edges: false, shadow: false }), 0, TT + 0.03, z);
    for (let m = 0; m <= 60; m += 10) {
      at(box(m % 60 ? 0.3 : 0.7, 0.05, 23, 0xf2f2f2, { edges: false, shadow: false }), XS + m * PPM, TT + 0.03, 14);
      K.floorPlate(m === 60 ? '60 м' : String(m), m === 60 ? 5.4 : 3.6, 2.2, XS + m * PPM, 0.05, 28.4, '#1b1610', '#f1e3c2');
    }
    K.floorPlate('пунктир', 7, 2.2, XS - 6.5, TT + 0.06, ZG, '#e8ecf4', '#5d6573');
    K.floorPlate('ваш', 5, 2.2, XS - 5.6, TT + 0.06, ZY, '#1b1610', '#ffb547');
    const rg = K.person(0x9aa4b6, { pants: 0x5d6573, hair: 0x5d6573 }); rg.g.scale.setScalar(1.15); at(rg.g, XS, TT, ZG); clickable(rg.g, 'play');
    const ry = K.person(0xffb547, { pants: 0x2c3e66 }); ry.g.scale.setScalar(1.15); at(ry.g, XS, TT, ZY); clickable(ry.g, 'play');
    // графопостроитель
    const mo = K.monitor(0, -27, 78, 32, 760, 312, 25);
    const s = mo.s;
    // пульт
    const pu = K.pult(30, 42, 42, 12);
    K.disp(pu, -12, 8.6, 'v = ' + nf(d.v) + ' м/с', 14);
    K.button(pu, 1, 8.6, 4.7, 'v −', 'v-', { w: 7, h: 4.4 }); K.button(pu, 9, 8.6, 4.7, 'v +', 'v+', { w: 7, h: 4.4 });
    K.button(pu, -13, 3, 4.7, '◀ 0,5 с', 't-', { w: 10, h: 4 }); K.button(pu, -2, 3, 4.7, '0,5 с ▶', 't+', { w: 10, h: 4 });
    K.button(pu, 12, 3, 4.7, d.play ? 'Пауза' : 'Пуск', 'play', { w: 10, h: 4, ...(d.play ? K.green : K.red) });

    const tY = v3(XS, 12, ZY), tG = v3(XS, 22, ZG);
    tag(tY, 'Ваш бегун', 'v = ' + nf(d.v) + ' м/с', d.match);
    tag(tG, 'Серый бегун', 'бежит по пунктиру');
    tag(v3(0, mo.top + 2, -27), 'Графопостроитель', d.read ? 'за ' + d.tRead + ' с — ' + nf(d.v * d.tRead) + ' м' : d.match ? 'графики совпали' : d.v < d.vT ? 'ваш график положе' : 'ваш график круче', d.read || d.match);

    const s3 = (v, t) => Math.min(60, v * t);
    let tick = 0, last = -1, ph = 0;
    kit.onFrame(() => {
      const Lv = live(); if (!Lv) return;
      const tc = Lv.tc, xy = XS + s3(d.v, tc) * PPM, xg = XS + s3(d.vT, tc) * PPM;
      if (last >= 0 && tc !== last) ph += 0.35;
      ry.g.position.x = xy; rg.g.position.x = xg; tY.x = xy; tG.x = xg;
      const runY = d.play && s3(d.v, tc) < 60, runG = d.play && s3(d.vT, tc) < 60;
      ry.swing(ph, runY ? 0.7 : 0); rg.swing(ph + 0.6, runG ? 0.7 : 0);
      if (((tick++ & 1) && tick > 2) || (tc === last && tick > 4)) return; last = tc;
      const x = s.x, w = s.W, h = s.H; x.fillStyle = '#0b1220'; x.fillRect(0, 0, w, h);
      // s(t)
      const A = axes(x, { x0: 60, y0: 36, w: 400, h: 230, xmax: 10, ymax: 60, xs: [0, 2, 4, 6, 8, 10], ys: [0, 10, 20, 30, 40, 50, 60], xl: 't, с', yl: 's, м' });
      pline(x, [[A.X(0), A.Y(0)], [A.X(10), A.Y(d.vT * 10)]], '#8b96ad', 3, [10, 8]);
      const tE = Math.min(10, 60 / d.v); pline(x, [[A.X(0), A.Y(0)], [A.X(tE), A.Y(s3(d.v, tE))]], '#ffb547', 4);
      const sc = s3(d.v, tc);
      pline(x, [[A.X(tc), A.Y(0)], [A.X(tc), A.Y(60) - 6]], '#72d4e8', 2.4);
      pline(x, [[A.X(0), A.Y(sc)], [A.X(tc), A.Y(sc)]], '#72d4e8', 1.6, [5, 5]);
      dot(x, A.X(tc), A.Y(sc), 8, '#ffb547');
      bigText(x, nf(sc) + ' м', Math.min(A.X(tc) + 12, 400), A.Y(sc) - 34, 24, '#ffb547');
      bigText(x, 't = ' + nf(tc) + ' с', 64, 4, 22, '#72d4e8');
      // v(t)
      const B = axes(x, { x0: 540, y0: 36, w: 190, h: 230, xmax: 10, ymax: 8, xs: [0, 5, 10], ys: [0, 2, 4, 6, 8], xl: 't, с', yl: 'v, м/с' });
      x.fillStyle = 'rgba(255,181,71,.28)'; x.fillRect(B.X(0), B.Y(d.v), B.X(tc) - B.X(0), B.Y(0) - B.Y(d.v));
      pline(x, [[B.X(0), B.Y(d.vT)], [B.X(10), B.Y(d.vT)]], '#8b96ad', 3, [10, 8]);
      pline(x, [[B.X(0), B.Y(d.v)], [B.X(10), B.Y(d.v)]], '#ffb547', 4);
      pline(x, [[B.X(tc), B.Y(0)], [B.X(tc), B.Y(8) - 6]], '#72d4e8', 2.4);
      x.fillStyle = '#ffb547'; x.font = `600 16px ${MONO}`; x.textAlign = 'center'; x.textBaseline = 'top'; x.fillText('площадь = путь', B.X(5), 6);
      s.tex.needsUpdate = true;
    });
  };

  // =====================================================================================
  // Средняя скорость: макет трассы A → Б 120 км, знаки скорости на половинах, автобус, тахограф s(t), пульт
  SC['kin-avg'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const XA = -48, PK = 0.8, RZ = -4, RT = 1.5;
    at(box(122, 1.2, 30, 0, { mat: K.texMat(drawGrass, 128, 128, 8, 2) }), 0, 0.6, -5);
    at(box(108, 0.3, 7, 0, { mat: K.texMat(drawAsphalt, 128, 128, 10, 1) }), 0, 1.35, RZ);
    for (let x = -52; x < 52; x += 5) at(box(2.4, 0.05, 0.3, 0xf2f2f2, { edges: false, shadow: false }), x + 1.2, RT + 0.03, RZ);
    // города A и Б
    const town = (x0, dir, nm, col) => {
      for (let k = 0; k < 4; k++) { const h = 3 + rnd(k + x0) * 4, x = x0 + dir * (k % 2) * 6, z = RZ - 8 - Math.floor(k / 2) * 6; at(box(4.6, h, 4.6, [0xe8d7b5, 0xb9c7d9, 0xd9b8a8, 0xe2c290][k]), x, 1.2 + h / 2, z); at(box(5, 0.5, 5, 0x8a5a44), x, 1.2 + h + 0.25, z); }
      const g = new T.Group(); at(g, x0 - dir * 2, 0, RZ + 6.5);
      at(cyl(0.3, 9, C.STEEL, { edges: false }), 0, 5.7, 0, g);
      at(box(6, 4.4, 0.4, 0x2e6fd0), 0, 8.6, 0, g); at(K.plate(nm, 5.2, 3.6, '#ffffff', col), 0, 8.6, 0.22, g);
    };
    town(XA - 6, -1, 'A', '#2e9e4f'); town(XA + 120 * PK + 6, 1, 'Б', '#c0392b');
    // середина пути
    const xm = XA + 60 * PK;
    at(box(0.6, 0.06, 7, 0x72d4e8, { edges: false }), xm, RT + 0.05, RZ);
    { const g = new T.Group(); at(g, xm, 0, RZ - 7); at(cyl(0.3, 8, C.STEEL, { edges: false }), 0, 5.2, 0, g); at(K.plate('середина · 60 км', 10, 2.6, '#1b1610', '#e8ecf4'), 0, 9, 0.2, g); at(box(10.4, 3, 0.3, 0x5d6573), 0, 9, 0, g); }
    // знаки ограничения скорости на половинах
    const sign = (x, txt) => { const g = new T.Group(); at(g, x, 0, RZ - 6.5); at(cyl(0.3, 8, C.STEEL, { edges: false }), 0, 5.2, 0, g);
      const disc = cyl(2.8, 0.4, 0x8b93a1, { seg: 32 }); disc.rotation.x = Math.PI / 2; at(disc, 0, 9.8, 0, g);
      const f = new T.Mesh(kit.keep(new T.CircleGeometry(2.7, 32)), K.basic(0xffffff, { map: K.canvasTex(drawSign(txt), 128, 128) })); at(f, 0, 9.8, 0.22, g); };
    sign(XA + 30 * PK, String(d.v1)); sign(XA + 90 * PK, String(d.v2));
    for (let k = 0; k <= 120; k += 30) K.floorPlate(k === 0 || k === 120 ? k + ' км' : String(k), k % 120 ? 3.6 : 5.6, 2.2, XA + k * PK, 1.24, RZ + 7.6, '#1b1610', '#f1e3c2');
    K.floorPlate('v₁ = ' + d.v1 + ' км/ч', 11, 2.2, XA + 30 * PK, 1.24, RZ + 11, '#e8ecf4', '#5d6573');
    K.floorPlate('v₂ = ' + d.v2 + ' км/ч', 11, 2.2, XA + 90 * PK, 1.24, RZ + 11, '#1b1610', '#ffb547');
    // автобус (лицом к +x)
    const bus = new T.Group(); kit.root.add(bus); clickable(bus, 'drive');
    const WR = 1.1, by = RT + WR;
    at(box(10, 3.8, 4.2, 0xffb547), 0, by + 2.3, 0, bus);
    at(box(10.1, 0.5, 4.3, 0xe08a2a), 0, by + 0.65, 0, bus);
    for (const sz of [-1, 1]) for (let k = 0; k < 4; k++) at(box(1.7, 1.3, 0.1, 0x2b3a55, { edges: false }), -3.6 + k * 2.2, by + 3, sz * 2.13, bus);
    at(box(0.1, 1.6, 3.6, 0x2b3a55, { edges: false }), 5.03, by + 2.9, 0, bus);
    at(box(0.12, 0.6, 0.8, 0xfff3c2, { edges: false }), 5.04, by + 1.1, 1.4, bus); at(box(0.12, 0.6, 0.8, 0xfff3c2, { edges: false }), 5.04, by + 1.1, -1.4, bus);
    const wh = [];
    for (const wx of [-3, 3.2]) for (const sz of [-1, 1]) { const w = cyl(WR, 0.8, 0x2a3348, { seg: 16 }); w.rotation.x = Math.PI / 2; at(w, wx, by, sz * 2, bus); wh.push(w); }
    // тахограф с графиком s(t)
    const mo = K.monitor(6, -30, 62, 28, 640, 290, 21);
    const s = mo.s;
    // пульт
    const pu = K.pult(26, 32, 42, 12);
    K.disp(pu, -11, 8.6, 'v₂ = ' + d.v2 + ' км/ч', 17);
    K.button(pu, 3.4, 8.6, 4.7, '− 10', 'v2-', { w: 7, h: 4.4 }); K.button(pu, 11.4, 8.6, 4.7, '+ 10', 'v2+', { w: 7, h: 4.4 });
    K.button(pu, -8, 3, 4.7, d.drive ? 'Едет…' : 'Поехали', 'drive', { w: 13, h: 4, ...(d.drive ? K.green : K.red) });
    K.button(pu, 8, 3, 4.7, 'Сброс', 'reset', { w: 10, h: 4 });

    const busTag = v3(XA, 13, RZ);
    tag(busTag, 'Автобус', d.drive ? 'едет…' : 'v₁ = ' + d.v1 + ', v₂ = ' + d.v2 + ' км/ч');
    tag(v3(6, mo.top + 2, -30), 'Тахограф', d.trip ? 'vср = ' + fm(d.trip.avg, 1) + ' км/ч за ' + fm(d.trip.T, 2) + ' ч' : 'нужно vср = ' + d.vNeed + ' км/ч', d.ok);

    const s4 = t => t <= 1 ? 60 * t : Math.min(120, 60 + d.v2 * (t - 1)), Tt = 1 + 60 / d.v2;
    let tick = 0, last = -1;
    kit.onFrame(() => {
      const Lv = live(); if (!Lv) return;
      const x = XA + Lv.s * PK; bus.position.set(x, 0, RZ); busTag.x = x;
      wh.forEach(w => { w.rotation.y = -Lv.s * PK / WR; });
      if (((tick++ & 1) && tick > 2) || (Lv.tt === last && tick > 4)) return; last = Lv.tt;
      const c = s.x; c.fillStyle = '#0b1220'; c.fillRect(0, 0, s.W, s.H);
      const A = axes(c, { x0: 70, y0: 40, w: 520, h: 200, xmax: 3, ymax: 120, xs: [0, 0.5, 1, 1.5, 2, 2.5, 3], ys: [0, 30, 60, 90, 120], xl: 't, ч', yl: 's, км' });
      pline(c, [[A.X(0), A.Y(0)], [A.X(120 / d.vNeed), A.Y(120)]], '#86e0a8', 2.4, [3, 6]);
      c.fillStyle = '#86e0a8'; c.font = `600 16px ${MONO}`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(d.vNeed + ' км/ч', A.X(120 / d.vNeed) + 8, A.Y(120) + 14);
      pline(c, [[A.X(0), A.Y(0)], [A.X(1), A.Y(60)], [A.X(Tt), A.Y(120)]], 'rgba(255,181,71,.5)', 2, [8, 6]);
      const tt = Lv.tt;
      if (tt > 0) { const p = [[A.X(0), A.Y(0)], [A.X(Math.min(tt, 1)), A.Y(60 * Math.min(tt, 1))]]; if (tt > 1) p.push([A.X(tt), A.Y(s4(tt))]); pline(c, p, '#ffb547', 4.5); dot(c, A.X(tt), A.Y(s4(tt)), 7, '#ffb547'); }
      if (d.trip) { pline(c, [[A.X(0), A.Y(0)], [A.X(d.trip.T), A.Y(120)]], '#72d4e8', 3, [12, 6]); bigText(c, 'vср = ' + fm(d.trip.avg, 1) + ' км/ч', 300, 4, 24, '#72d4e8'); }
      bigText(c, 't = ' + fm(tt, 2) + ' ч', 74, 4, 24, '#ffb547');
      s.tex.needsUpdate = true;
    });
  };

  // =====================================================================================
  // Равноускоренное движение: машинка-капельница на дороге 100 м, стоп-линия, зебра, табло v(t)/s(t), пульт
  SC['kin-accel'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const XS = -48, PPM = 0.98, RZ = -4, RT = 1.5;
    at(box(122, 1.2, 28, 0, { mat: K.texMat(drawGrass, 128, 128, 8, 2) }), 0, 0.6, -4);
    at(box(116, 0.3, 12, 0, { mat: K.texMat(drawAsphalt, 128, 128, 10, 1) }), 0, 1.35, RZ);
    for (let x = -56; x < 56; x += 6) at(box(3, 0.05, 0.35, 0xf2f2f2, { edges: false, shadow: false }), x + 1.5, RT + 0.03, RZ);
    for (let m = 0; m <= 100; m += 10) {
      at(box(0.3, 0.05, 1.4, 0xf2f2f2, { edges: false, shadow: false }), XS + m * PPM, RT + 0.03, RZ + 5.2);
      if (m % 20 === 0) K.floorPlate(m === 100 ? '100 м' : String(m), m === 100 ? 5.4 : 3.6, 2.2, XS + m * PPM, 1.24, RZ + 8.6, '#1b1610', '#f1e3c2');
    }
    // стоп-линия, зебра, знак «СТОП»
    const xl = XS + d.line * PPM;
    at(box(1, 0.06, 11.6, 0xf2f2f2, { edges: false }), xl, RT + 0.04, RZ);
    for (let i = 0; i < 6; i++) at(box(5, 0.06, 1.1, 0xf2f2f2, { edges: false }), xl + 4, RT + 0.04, RZ - 5 + i * 2);
    { const g = new T.Group(); at(g, xl - 1, 0, RZ - 9);
      at(cyl(0.3, 9, C.STEEL, { edges: false }), 0, 5.7, 0, g);
      const o = cyl(2.6, 0.4, 0xd42d22, { seg: 8 }); o.rotation.x = Math.PI / 2; o.rotation.y = Math.PI / 8; at(o, 0, 10.4, 0, g);
      at(K.plate('СТОП', 3.6, 1.6, '#ffffff', '#d42d22'), 0, 10.4, 0.25, g); }
    // машинка (лицом к +x), на багажнике — капельница
    const car = new T.Group(); kit.root.add(car); clickable(car, 'go');
    const WR = 1.1, wy = RT + WR;
    at(box(9, 2.2, 4.6, 0x72d4e8), 0, wy + 1.0, 0, car);
    at(box(4.6, 1.6, 4.1, 0x2b3a55), -0.4, wy + 2.9, 0, car);
    at(box(4.9, 0.35, 4.4, 0x72d4e8), -0.4, wy + 3.85, 0, car);
    for (const sz of [-1, 1]) { at(box(0.15, 0.55, 0.9, 0xfff3c2, { edges: false }), 4.53, wy + 1.4, sz * 1.6, car); }
    const brakeM = K.own(0x7a2b24, { emissive: 0xff2a1a, emissiveIntensity: 0 });
    for (const sz of [-1, 1]) at(box(0.15, 0.55, 0.9, 0, { mat: brakeM, edges: false }), -4.53, wy + 1.4, sz * 1.6, car);
    const tank = new T.Mesh(kit.keep(new T.CylinderGeometry(0.8, 0.8, 1.6, 16)), K.own(0x9fd4ea, { transparent: true, opacity: 0.55 })); at(tank, -3.4, wy + 2.9, 0, car);
    at(cyl(0.55, 1.0, 0x3fb6d6, { edges: false, hull: false }), -3.4, wy + 2.6, 0, car);
    at(cyl(0.9, 0.3, C.DARK), -3.4, wy + 3.8, 0, car);
    at(cyl(0.12, 2.8, C.STEEL, { edges: false }), -4.6, wy + 0.9, 0, car);
    const wh = [];
    for (const wx of [-2.8, 2.8]) for (const sz of [-1, 1]) { const w = new T.Group(); at(w, wx, wy, sz * 2.3, car); const t = cyl(WR, 0.9, 0x2a3348, { seg: 16 }); t.rotation.x = Math.PI / 2; w.add(t); at(box(1.4, 0.3, 0.95, 0x8b93a1, { edges: false, shadow: false }), 0, 0, 0, w); wh.push(w); }
    // капли (метки каждую секунду) и подписи
    const DX = -4.6, drops = [], dl = [];
    for (let k = 1; k <= 12; k++) { const m = cyl(0.65, 0.08, 0xffb547, { edges: false, seg: 14 }); m.visible = false; kit.root.add(m); drops.push(m); const p = K.plate(k + ' с', 3, 1.6, '#1b1610', '#ffb547'); p.rotation.x = -Math.PI / 2; p.visible = false; kit.root.add(p); dl.push(p); }
    // табло спидометра с графиками
    const mo = K.monitor(4, -30, 70, 26, 760, 282, 20);
    const s = mo.s;
    // пульт
    const pu = K.pult(24, 31, 46, 13);
    K.disp(pu, -13, 9.4, 'v₀ = ' + d.v0 + ' м/с', 15);
    K.button(pu, 0.6, 9.4, 4.7, 'v₀ −1', 'v0-', { w: 8.4, h: 4.2 }); K.button(pu, 9.6, 9.4, 4.7, 'v₀ +1', 'v0+', { w: 8.4, h: 4.2 });
    K.disp(pu, -13, 3.6, 'a = ' + nf(d.a) + ' м/с²', 15, d.a < 0 ? '#ff8a73' : '#86e0a8');
    K.button(pu, 0.6, 3.6, 4.7, 'a −0,5', 'a-', { w: 8.4, h: 4.2 }); K.button(pu, 9.6, 3.6, 4.7, 'a +0,5', 'a+', { w: 8.4, h: 4.2 });
    K.button(pu, 18.4, 9.4, 4.7, d.run ? 'Едет…' : 'Пуск', 'go', { w: 7.6, h: 4.2, ...(d.run ? K.green : K.red) });
    K.button(pu, 18.4, 3.6, 4.7, 'Сброс', 'reset', { w: 7.6, h: 4.2 });

    const carTag = v3(XS, 12, RZ);
    tag(carTag, 'Машина-капельница', 'капля каждую секунду');
    tag(v3(xl + 4, 3, RZ + 7), 'Стоп-линия', d.line + ' м');
    const R = d.res;
    tag(v3(4, mo.top + 2, -30), 'Спидометр', R ? (R.stopped ? 'стоп через ' + fm(R.x, 1) + ' м за ' + fm(R.t, 1) + ' с' : 'не остановилась') : 'графики v(t) и s(t)', d.ok);

    const tStop = d.a < 0 ? -d.v0 / d.a : Infinity;
    const kin = t => { const te = Math.min(t, tStop); return { x: d.v0 * te + d.a * te * te / 2, v: d.v0 + d.a * te }; };
    let tick = 0, last = -1;
    kit.onFrame(() => {
      const Lv = live(); if (!Lv) return;
      const front = XS + Math.min(Lv.x, 106) * PPM; car.position.set(front - 4.5, 0, RZ); carTag.x = front - 4.5;
      wh.forEach(w => { w.rotation.z = -Lv.x * PPM / WR; });
      brakeM.emissiveIntensity = d.a < 0 && Lv.v > 0 && Lv.t > 0 && Lv.run ? 1 : 0;
      const n = Math.floor(Math.min(Lv.t, d.te) + 1e-9); let lastX = -1e9;
      drops.forEach((m, k) => {
        const on = k + 1 <= n, x = XS + kin(k + 1).x * PPM + DX;
        m.visible = on && x < 60; m.position.set(x, RT + 0.05, RZ);
        const lab = on && x < 58 && x - lastX >= 4.4; dl[k].visible = lab; if (lab) { dl[k].position.set(x, RT + 0.06, RZ + 3.2); lastX = x; }
      });
      if (((tick++ & 1) && tick > 2) || (Lv.t === last && tick > 4)) return; last = Lv.t;
      const c = s.x; c.fillStyle = '#0b1220'; c.fillRect(0, 0, s.W, s.H);
      bigText(c, 'v = ' + fm(Lv.v, 1) + ' м/с', 18, 14, 34, '#72d4e8');
      bigText(c, 't = ' + fm(Lv.t, 1) + ' с', 18, 60, 26, '#e8ecf4'); bigText(c, 's = ' + fm(Lv.x, 1) + ' м', 18, 96, 26, '#ffb547');
      const tt = Math.min(Lv.t, d.te), N = 40;
      const A = axes(c, { x0: 300, y0: 32, w: 190, h: 200, xmax: 12, ymax: 30, xs: [0, 4, 8, 12], ys: [0, 10, 20, 30], xl: 't', yl: 'v, м/с', fs: 13 });
      const B = axes(c, { x0: 546, y0: 32, w: 190, h: 200, xmax: 12, ymax: 100, xs: [0, 4, 8, 12], ys: [0, 50, 100], xl: 't', yl: 's, м', fs: 13 });
      pline(c, [[B.X(0), B.Y(d.line)], [B.X(12), B.Y(d.line)]], '#ff8a73', 1.6, [6, 6]);
      const pv = [], ps = [], dv = [], ds = [];
      for (let i = 0; i <= N; i++) { const t1 = d.te * i / N, k1 = kin(t1); pv.push([A.X(t1), A.Y(clamp(k1.v, 0, 30))]); ps.push([B.X(t1), B.Y(clamp(k1.x, 0, 100))]); const t2 = tt * i / N, k2 = kin(t2); dv.push([A.X(t2), A.Y(clamp(k2.v, 0, 30))]); ds.push([B.X(t2), B.Y(clamp(k2.x, 0, 100))]); }
      if (tt > 0) { c.fillStyle = 'rgba(255,181,71,.22)'; c.beginPath(); c.moveTo(A.X(0), A.Y(0)); dv.forEach(([a, b]) => c.lineTo(a, b)); c.lineTo(A.X(tt), A.Y(0)); c.closePath(); c.fill(); }
      pline(c, pv, 'rgba(114,212,232,.5)', 2, [7, 6]); pline(c, ps, 'rgba(255,181,71,.5)', 2, [7, 6]);
      if (tt > 0) { pline(c, dv, '#72d4e8', 4); pline(c, ds, '#ffb547', 4); }
      c.fillStyle = '#ffb547'; c.font = `600 15px ${MONO}`; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText('площадь под v(t) = путь', 18, 140);
      s.tex.needsUpdate = true;
    });
  };

  // =====================================================================================
  // Свободное падение: штатив с линейкой, электромагнит держит шарик, стробоскоп (вспышка каждые 0,2 с), лоток с песком, глобусы Земли и Луны
  SC['kin-fall'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const KM = 0.8, BX = -8, BZ = -18, BR = 1.4, Y0 = 2.6, moon = d.planet === 'moon';
    // основание и лоток
    at(box(30, 1.6, 16, 0x3a3f4c), -12, 0.8, BZ);
    at(box(10, 1, 10, 0x8a6a45), BX, 2.1, BZ);
    at(box(9, 0.3, 9, 0, { mat: K.texMat(moon ? drawRegolith : drawSand, 64, 64, 1, 1), edges: false }), BX, Y0 - 0.15, BZ);
    // стойка и линейка 0…60 м
    const PX = -22, top = Y0 + 60 * KM + 6;
    at(cyl(0.8, top - 1.6, C.STEEL), PX, 1.6 + (top - 1.6) / 2, BZ);
    at(box(4, 60 * KM + 2, 0.6, 0xf1e3c2), -15.5, Y0 + 30 * KM, BZ - 1.6);
    for (let m = 0; m <= 60; m++) { const big = m % 5 === 0; at(box(big ? 1.6 : 0.8, 0.14, 0.1, 0x1b1610, { edges: false, shadow: false }), -14.3 + (big ? -0.4 : 0), Y0 + m * KM, BZ - 1.25); }
    for (let m = 0; m <= 60; m += 10) at(K.plate(String(m), 2, 1.4, '#1b1610', '#f1e3c2'), -16.4, Y0 + m * KM, BZ - 1.27);
    at(K.plate('h, м', 3, 1.4, '#1b1610', '#f1e3c2'), -15.5, Y0 + 60 * KM + 2.2, BZ - 1.27);
    // электромагнит на каретке
    const yM = Y0 + d.h * KM + 2 * BR;
    at(box(3, 3, 3, C.DARK), PX, yM + 1.2, BZ);
    at(box(BX - PX, 1.2, 1.4, 0x5d6573), (PX + BX) / 2, yM + 2.2, BZ);
    const coil = new T.Group(); at(coil, BX, yM, BZ); clickable(coil, 'go');
    at(cyl(1.5, 2.2, 0xc87533), 0, 0.6, 0, coil); at(cyl(0.7, 0.5, C.STEEL, { edges: false }), 0, -0.6, 0, coil);
    at(cyl(0.7, 1.4, 0xe0473a, { r2: 0, seg: 3, edges: false }), -12.6, Y0 + d.h * KM, BZ - 1.15).rotation.z = Math.PI / 2;
    // шарик и «призраки» стробоскопа
    const ball = mesh(new T.SphereGeometry(BR, 24, 16), 0xe8ecf4, { hull: true, edges: false }); kit.root.add(ball); clickable(ball, 'go');
    const ghosts = K.dots(46, BR, 0x72d4e8, { transparent: true, opacity: 0.55, depthWrite: false });
    // стробоскоп на треноге
    const st = new T.Group(); at(st, 12, 0, -4); st.rotation.y = Math.atan2(-(BX - 12), -(BZ + 4));
    for (let k = 0; k < 3; k++) { const a = k * TAU / 3, r = K.rod(0x3a3f4c, 0.3); st.add(r.m); r.set(v3(Math.cos(a) * 4, 0, Math.sin(a) * 4), v3(0, 15, 0)); }
    at(cyl(0.4, 4, C.STEEL, { edges: false }), 0, 17, 0, st);
    at(box(5, 4.4, 5, 0x2c3240), 0, 20, 0, st);
    const lampM = K.own(0xd9dde4, { emissive: 0xfff4c8, emissiveIntensity: 0 });
    const lens = cyl(1.8, 0.4, 0, { mat: lampM, seg: 24 }); lens.rotation.x = Math.PI / 2; at(lens, 0, 20, -2.6, st);
    const glow = new T.Sprite(kit.keep(new T.SpriteMaterial({ map: kit.glowTex(), color: 0xfff1c0, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0 }))); glow.scale.setScalar(12); at(glow, 0, 20, -3.4, st);
    // глобусы: Земля и Луна (нажать — выбрать)
    const globe = (x, key, draw, r, on) => { const g = new T.Group(); at(g, x, 0, 26); clickable(g, key);
      at(box(11, on ? 1.4 : 0.8, 11, on ? 0xffd166 : C.WOOD2), 0, on ? 0.7 : 0.4, 0, g); at(cyl(0.6, 4, C.BRASS), 0, 3, 0, g);
      at(mesh(new T.SphereGeometry(r, 32, 20), 0, { mat: K.texMat(draw, 256, 128, 1, 1), hull: true, edges: false }), 0, 5 + r, 0, g);
      K.floorPlate(key === 'p-earth' ? 'Земля' : 'Луна', 9, 2.4, x, on ? 1.45 : 0.85, 26 + 6.6, on ? '#1b1610' : '#5d6573', on ? '#ffd166' : '#f7f3ea'); };
    globe(-48, 'p-earth', drawEarth, 4, !moon); globe(-34, 'p-moon', drawMoon, 3, moon);
    // секундомер
    const sw = new T.Group(); at(sw, -6, 0, 28);
    at(box(24, 11, 8, 0x2c3240), 0, 5.5, 0, sw);
    const ss = K.screen(21, 8, 336, 128); at(ss.m, 0, 6, 4.06, sw);
    // пульт
    const pu = K.pult(30, 28, 40, 12);
    K.disp(pu, -9, 8.6, 'h = ' + fm(d.h, 1) + ' м', 16);
    K.button(pu, 10.5, 8.6, 4.7, d.run ? 'Летит…' : 'Бросить', 'go', { w: 13, h: 4.4, ...(d.run ? K.green : K.red) });
    [['−1 м', 'h-1'], ['−0,1', 'h-.1'], ['+0,1', 'h+.1'], ['+1 м', 'h+1']].forEach(([t, k], i) => K.button(pu, -13.5 + i * 9, 3, 4.7, t, k, { w: 8.2, h: 4 }));
    // датчик скорости: график v(t)
    const mo = K.monitor(32, -24, 44, 26, 480, 284, 19);
    const s = mo.s;

    const bTag = v3(BX + 13, Y0 + d.h * KM * 0.5 + 4, BZ);
    tag(bTag, 'Шарик', 'h = ' + fm(d.h, 1) + ' м');
    tag(v3(17, 8, -2), 'Стробоскоп', 'вспышка каждые 0,2 с');
    tag(v3(-6, 13, 28), 'Секундомер', d.res ? 'упал за ' + fm(d.res.tf, 2) + ' с' : 'время падения', d.ok);
    tag(v3(moon ? -34 : -48, 15, 26), moon ? 'Луна' : 'Земля', 'g = ' + fm(d.g, 1) + ' м/с²');
    tag(v3(32, mo.top + 2, -24), 'Датчик скорости', 'v = g·t');

    const yAt = t => Y0 + BR + Math.max(0, d.h - d.g * t * t / 2) * KM;
    let tick = 0, last = -1, flashN = 0, flash = 0;
    kit.onFrame((dt) => {
      const Lv = live(); if (!Lv) return;
      const tt = Math.min(Lv.t, d.tf);
      ball.position.set(BX, yAt(tt), BZ);
      const n = Lv.t > 0 ? Math.floor(tt / 0.2 + 1e-9) : 0;
      ghosts.forEach((m, k) => { m.visible = k < n; if (m.visible) m.position.set(BX, yAt((k + 1) * 0.2), BZ); });
      if (Lv.run && n > flashN) flash = 1; flashN = n;
      flash = kit.reduce ? 0 : Math.max(0, flash - dt * 7);
      lampM.emissiveIntensity = Lv.run ? 0.25 + flash : 0; glow.material.opacity = Lv.run ? flash * 0.9 : 0;
      if (((tick++ & 1) && tick > 2) || (Lv.t === last && tick > 4)) return; last = Lv.t;
      const v = d.g * tt;
      const c = ss.x; c.fillStyle = '#0c1a14'; c.fillRect(0, 0, ss.W, ss.H); c.shadowColor = '#86e0a8'; c.shadowBlur = 8;
      bigText(c, 't = ' + fm(tt, 2) + ' с', ss.W / 2, 12, 48, '#86e0a8', 'center'); c.shadowBlur = 0;
      bigText(c, 'v = ' + fm(v, 1) + ' м/с', ss.W / 2, 78, 30, '#72d4e8', 'center'); ss.tex.needsUpdate = true;
      const x = s.x; x.fillStyle = '#0b1220'; x.fillRect(0, 0, s.W, s.H);
      const tmax = moon ? 9 : 4, vmax = moon ? 15 : 40;
      const xs = []; for (let k = 0; k <= tmax; k++) xs.push(k); const ys = []; for (let k = 0; k <= vmax; k += moon ? 5 : 10) ys.push(k);
      const A = axes(x, { x0: 56, y0: 40, w: 390, h: 196, xmax: tmax, ymax: vmax, xs, ys, xl: 't, с', yl: 'v, м/с' });
      pline(x, [[A.X(0), A.Y(0)], [A.X(d.tf), A.Y(Math.min(vmax, d.g * d.tf))]], 'rgba(114,212,232,.5)', 2, [7, 6]);
      if (tt > 0) { x.fillStyle = 'rgba(255,181,71,.22)'; x.beginPath(); x.moveTo(A.X(0), A.Y(0)); x.lineTo(A.X(tt), A.Y(Math.min(vmax, v))); x.lineTo(A.X(tt), A.Y(0)); x.fill(); pline(x, [[A.X(0), A.Y(0)], [A.X(tt), A.Y(Math.min(vmax, v))]], '#72d4e8', 4); }
      bigText(x, (moon ? 'Луна' : 'Земля') + ' · g = ' + fm(d.g, 1) + ' м/с²', 60, 4, 22, moon ? '#c9cdd6' : '#86e0a8');
      s.tex.needsUpdate = true;
    });
  };

  // =====================================================================================
  // Бросок под углом: пружинная пушка на транспортире, полигон с отметками, мишень 30 м, след полёта, прошлые выстрелы
  SC['kin-throw'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const G3 = 9.8, KX = 1.5, PX = -50, GY = 2, BR = 1.4, PY = GY + BR, Z = -2;
    const fl = (v0, al) => ({ T: 2 * v0 * Math.sin(al * DEG) / G3, H: (v0 * Math.sin(al * DEG)) ** 2 / (2 * G3), R: v0 * v0 * Math.sin(2 * al * DEG) / G3 });
    const pos = (v0, al, t) => v3(PX + v0 * Math.cos(al * DEG) * t * KX, PY + Math.max(0, v0 * Math.sin(al * DEG) * t - G3 * t * t / 2) * KX, Z);
    at(box(112, GY, 22, 0, { mat: K.texMat(drawGrass, 128, 128, 8, 2) }), -3, GY / 2, Z);
    for (let m = 0; m <= 60; m += 10) { at(box(0.3, 0.05, 2, 0xf2f2f2, { edges: false, shadow: false }), PX + m * KX, GY + 0.03, Z + 9.6); K.floorPlate(m === 60 ? '60 м' : String(m), m === 60 ? 5.4 : 3.6, 2.2, PX + m * KX, 0.05, Z + 13); }
    // мишень ±1 м с кольцами и флажком
    const xt = PX + d.target * KX;
    at(box(2 * d.tol * KX, 0.3, 9, 0, { mat: K.texMat((x, w, h) => { x.fillStyle = '#f4f4f4'; x.fillRect(0, 0, w, h); for (let r = 4; r >= 1; r--) { x.fillStyle = r % 2 ? '#e0473a' : '#f4f4f4'; x.beginPath(); x.arc(w / 2, h / 2, r * w / 9, 0, TAU); x.fill(); } }, 64, 192, 1, 1) }), xt, GY + 0.15, Z);
    K.flagPole(xt, Z - 6, 9, K.canvasTex((x, w, h) => { x.fillStyle = '#e0473a'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.font = `800 ${h * 0.42}px Arial`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('30 м', w / 2, h / 2); }, 160, 96));
    // пушка: вилка, ось, ствол на угол α, транспортир
    const cn = new T.Group(); at(cn, PX, 0, Z); clickable(cn, 'go');
    at(box(8, 0.8, 8, 0x4a5875), -1, GY + 0.4, 0, cn);
    for (const sz of [-1, 1]) at(box(3, PY + 1.4 - GY, 0.6, 0x4a5875), 0, (PY + 1.4 + GY) / 2, sz * 1.8, cn);
    const ax = cyl(0.45, 4.6, C.STEEL, { edges: false }); ax.rotation.x = Math.PI / 2; at(ax, 0, PY, 0, cn);
    const br = new T.Group(); at(br, 0, PY, 0, cn); br.rotation.z = d.al * DEG;
    { const b = cyl(1.2, 11, 0x9aa4b6); b.rotation.z = -Math.PI / 2; at(b, 4.5, 0, 0, br);
      const mz = cyl(1.45, 1, 0x6b7384); mz.rotation.z = -Math.PI / 2; at(mz, 10, 0, 0, br);
      const bc = cyl(1.35, 1.2, 0x3a3f4c); bc.rotation.z = -Math.PI / 2; at(bc, -1.4, 0, 0, br);
      const knob = cyl(0.5, 2.4, 0xe0473a, { edges: false }); knob.rotation.z = -Math.PI / 2; at(knob, -3, 0, 0, br); }
    const prot = new T.Mesh(kit.keep(new T.CircleGeometry(10, 40, 0, Math.PI / 2)), K.basic(0xffffff, { map: K.canvasTex((x, w, h) => {
      const cx = w / 2, cy = h / 2, R = w / 2 - 2; x.fillStyle = 'rgba(0,0,0,0)'; x.clearRect(0, 0, w, h);
      x.fillStyle = '#f1e3c2'; x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, R, -Math.PI / 2, 0); x.closePath(); x.fill();
      x.strokeStyle = '#1b1610'; x.fillStyle = '#1b1610'; x.font = `700 ${w * 0.05}px ${MONO}`; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let a = 0; a <= 90; a += 5) { const r0 = a % 15 ? R * 0.9 : R * 0.82, ca = Math.cos(a * DEG), sa = Math.sin(a * DEG); x.lineWidth = a % 15 ? 2 : 3; x.beginPath(); x.moveTo(cx + ca * r0, cy - sa * r0); x.lineTo(cx + ca * R, cy - sa * R); x.stroke(); if (a % 15 === 0) x.fillText(String(a), cx + ca * R * 0.7, cy - sa * R * 0.7); }
      x.strokeStyle = '#e07a1a'; x.lineWidth = 6; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(d.al * DEG) * R, cy - Math.sin(d.al * DEG) * R); x.stroke();
    }, 512, 512), transparent: true, side: T.DoubleSide }));
    at(prot, 0, PY, -2.4, cn);
    // мяч, след полёта (точки), стрелки скоростей
    const ball = mesh(new T.SphereGeometry(BR, 24, 16), 0xe8ecf4, { hull: true, edges: false }); kit.root.add(ball); ball.visible = false;
    const trail = K.dots(40, 0.45, 0xffb547);
    const aim = K.dots(40, 0.25, 0xffb547, { transparent: true, opacity: 0.45 });
    const f0 = fl(d.v0, d.al);
    aim.forEach((m, i) => { m.position.copy(pos(d.v0, d.al, f0.T * (i + 0.5) / 40)); m.visible = !d.run; });
    const vxA = K.arrow(0xffb547, 0.42), vyA = K.arrow(0x3fb6d6, 0.42); kit.root.add(vxA.g); kit.root.add(vyA.g); vxA.set(0); vyA.set(0);
    // прошлые выстрелы: пунктир (зелёный — попадание)
    const done = d.run ? d.shots.slice(0, -1) : d.shots;
    done.forEach(sh => {
      const f = fl(sh.v0, sh.al), list = K.dots(30, 0.32, sh.hit ? 0x3fae5a : 0x8b96ad, { transparent: !sh.hit, opacity: sh.hit ? 1 : 0.6 });
      list.forEach((m, i) => { m.position.copy(pos(sh.v0, sh.al, f.T * (i + 0.5) / 30)); m.visible = true; });
      const p = K.plate(sh.al + '°', 3.6, 1.8, sh.hit ? '#ffffff' : '#1b1610', sh.hit ? '#3fae5a' : '#e8ecf4'); at(p, PX + f.R * KX / 2, PY + f.H * KX + 2, Z);
    });
    // пульт
    const pu = K.pult(28, 30, 46, 13);
    K.disp(pu, -13, 9.4, 'α = ' + d.al + '°', 15);
    K.button(pu, 0.6, 9.4, 4.7, 'α −1°', 'al-', { w: 8.4, h: 4.2 }); K.button(pu, 9.6, 9.4, 4.7, 'α +1°', 'al+', { w: 8.4, h: 4.2 });
    K.disp(pu, -13, 3.6, 'v₀ = ' + d.v0 + ' м/с', 15, '#72d4e8');
    K.button(pu, 0.6, 3.6, 4.7, 'v₀ −1', 'v0-', { w: 8.4, h: 4.2 }); K.button(pu, 9.6, 3.6, 4.7, 'v₀ +1', 'v0+', { w: 8.4, h: 4.2 });
    K.button(pu, 18.4, 9.4, 4.7, d.run ? 'Летит…' : 'Огонь', 'go', { w: 7.6, h: 4.2, ...(d.run ? K.green : K.red) });
    K.button(pu, 18.4, 3.6, 4.7, 'Очистить', 'clear', { w: 7.6, h: 4.2 });

    tag(v3(PX - 2, 16, Z), 'Пружинная пушка', 'α = ' + d.al + '°, v₀ = ' + d.v0 + ' м/с');
    tag(v3(xt, 12, Z - 6), 'Мишень', d.target + ' м ± ' + d.tol + ' м');
    tag(v3(28, 16, 30), 'Попадания', d.hits.length ? d.hits.map(a => a + '°').join(' и ') : 'пока нет', d.ok);

    kit.onFrame(() => {
      const Lv = live(); if (!Lv) return;
      const show = Lv.t > 0 && d.shots.length > 0, tt = Math.min(Lv.t, f0.T);
      ball.visible = show; trail.forEach((m, i) => { const ti = f0.T * (i + 0.5) / 40; m.visible = show && ti <= tt; if (m.visible) m.position.copy(pos(d.v0, d.al, ti)); });
      if (!show) { vxA.set(0); vyA.set(0); return; }
      const p = pos(d.v0, d.al, tt); ball.position.copy(p);
      const c = d.v0 * Math.cos(d.al * DEG), vy = d.v0 * Math.sin(d.al * DEG) - G3 * tt, fly = Lv.run;
      vxA.g.position.copy(p); vyA.g.position.copy(p); vxA.set(fly ? c * 0.55 : 0);
      vyA.g.rotation.z = vy >= 0 ? Math.PI / 2 : -Math.PI / 2; vyA.set(fly ? Math.abs(vy) * 0.55 : 0);
    });
  };

  // =====================================================================================
  // Относительность движения: макет реки (течение), моторная лодка с рулём, плот с человечком, причал, две камеры — берег и плот
  SC['kin-river'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const KR = 40 / d.W, NB = 16, FB = -24, WY = 2, raftV = d.frame === 'raft';
    const vx = d.cur + d.u * Math.sin(d.th * DEG), vy = d.u * Math.cos(d.th * DEG), TX = d.W / vy;
    const Z0 = NB - 4.2, Z1 = FB + 9.3, KZ = (Z0 - Z1) / d.W;
    // лоток с водой и берега
    at(box(126, 1, 62, 0x3a3f4c), 0, 0.5, -4);
    const waterTex = K.canvasTex(drawWater, 256, 128, 6, 2);
    at(box(124, WY - 1, NB - FB, 0, { mat: K.own(0xffffff, { map: waterTex }), edges: false }), 0, 1 + (WY - 1) / 2, (NB + FB) / 2);
    const gNear = K.canvasTex(drawGrass, 128, 64, 10, 1), gFar = K.canvasTex(drawGrass, 128, 64, 10, 1);
    at(box(124, 2.2, 10, 0, { mat: K.own(0xffffff, { map: gNear }) }), 0, 1 + 1.1, NB + 5);
    at(box(124, 2.2, 10, 0, { mat: K.own(0xffffff, { map: gFar }) }), 0, 1 + 1.1, FB - 5);
    const BT = 3.2;
    for (const z of [NB + 0.3, FB - 0.3]) at(box(124, 0.5, 0.8, 0xc9b27a, { edges: false }), 0, BT - 0.2, z);
    // деревья (двигаются в системе «плот»)
    const trees = [];
    for (const [z, k0] of [[NB + 6, 0], [FB - 6, 5]]) for (let i = 0; i < 8; i++) {
      const g = new T.Group(); at(g, 0, BT, z + (rnd(i + k0) - 0.5) * 3); const s = 0.9 + rnd(i + k0 + 3) * 0.5;
      at(cyl(0.5 * s, 2.4 * s, 0x7a5232, { seg: 6 }), 0, 1.2 * s, 0, g); at(mesh(new T.SphereGeometry(2.2 * s, 12, 8), 0x3f9a52, { hull: true, edges: false }), 0, 3.6 * s, 0, g);
      trees.push({ g, x0: -60 + i * 15 + rnd(i + k0 + 7) * 6 + (k0 ? 7 : 0) });
    }
    // причал напротив старта и мостки старта
    const pier = new T.Group(); at(pier, 0, 0, 0);
    at(box(9, 0.6, 3.6, 0x8a6a45), 0, BT - 0.1, FB + 1.6, pier);
    for (const sx of [-3.6, 3.6]) at(cyl(0.45, 3, 0x6b4f33, { edges: false }), sx, 1.6, FB + 3, pier);
    { const f = new T.Group(); at(f, 0, BT, FB - 2, pier); at(cyl(0.25, 7, C.STEEL, { edges: false }), 0, 3.5, 0, f); at(K.plate('причал', 6, 2, '#1b1610', '#ffb547'), 3.2, 6, 0, f); }
    const jetty = new T.Group(); at(jetty, 0, 0, 0);
    at(box(5, 0.6, 6, 0x8a6a45), -6, BT - 0.1, NB - 2, jetty);
    for (const sx of [-8, -4]) at(cyl(0.4, 3, 0x6b4f33, { edges: false }), sx, 1.6, NB - 4.4, jetty);
    K.floorPlate('старт', 5, 1.8, 0, BT + 0.25, NB + 2.2);
    // плот с человечком и камерой
    const raft = new T.Group(); kit.root.add(raft); clickable(raft, 'f-raft');
    for (let k = 0; k < 5; k++) { const l = cyl(0.9, 10, 0xa8834f, { seg: 10 }); l.rotation.z = Math.PI / 2; at(l, 0, WY + 0.2, -3.6 + k * 1.8, raft); }
    const rp = K.person(0xe8ecf4, { pants: 0x5d6573 }); rp.g.scale.setScalar(0.62); rp.g.rotation.y = -Math.PI / 2; at(rp.g, 1.5, WY + 1.1, 0, raft);
    const cam = (parent, x, y, z, on) => { const g = new T.Group(); at(g, x, y, z, parent);
      at(box(2.6, 1.8, 1.6, 0x2c3240), 0, 0, 0, g); const l = cyl(0.6, 1, 0x1b1f28); l.rotation.x = Math.PI / 2; at(l, 0, 0, 1.2, g);
      at(mesh(new T.SphereGeometry(0.35, 10, 8), 0, { mat: K.own(on ? 0xff3a2a : 0x5a2a24, on ? { emissive: 0xff2a1a, emissiveIntensity: 1 } : {}), hull: true, edges: false }), 1, 1.1, 0, g); return g; };
    cam(raft, -3, WY + 2.6, 0, raftV);
    if (raftV) at(box(11.4, 0.3, 10.4, 0xffd166, { edges: false }), 0, WY + 0.05, 0, raft);
    // камера на берегу
    const shoreCam = new T.Group(); at(shoreCam, -46, BT, NB + 5); clickable(shoreCam, 'f-shore');
    for (let k = 0; k < 3; k++) { const a = k * TAU / 3 + 0.4, r = K.rod(0x3a3f4c, 0.25); shoreCam.add(r.m); r.set(v3(Math.cos(a) * 2, 0, Math.sin(a) * 2), v3(0, 6, 0)); }
    cam(shoreCam, 0, 7, 0, !raftV);
    if (!raftV) at(box(6, 0.3, 6, 0xffd166, { edges: false }), 0, 0.15, 0, shoreCam);
    // лодка: корпус, рубка, мотор; нос — к −z, поворот на θ
    const boat = new T.Group(); kit.root.add(boat); clickable(boat, 'go'); boat.scale.setScalar(1.35);
    const hullShape = new T.Shape(); hullShape.moveTo(0, -4.4); hullShape.quadraticCurveTo(2, -2.6, 1.9, 0); hullShape.lineTo(1.7, 3); hullShape.lineTo(-1.7, 3); hullShape.lineTo(-1.9, 0); hullShape.quadraticCurveTo(-2, -2.6, 0, -4.4);
    const hull = mesh(new T.ExtrudeGeometry(hullShape, { depth: 1.5, bevelEnabled: false }), 0xffb547, { hull: true, edges: true }); hull.rotation.x = Math.PI / 2; at(hull, 0, WY + 1.2, 0, boat);
    at(box(2.4, 1.4, 2.2, 0xf4f6fb), 0, WY + 1.9, 0.6, boat);
    at(box(2.2, 0.8, 0.1, 0x2b3a55, { edges: false }), 0, WY + 2.2, -0.52, boat);
    at(box(1.1, 2.4, 1.1, 0x2c3240), 0, WY + 1.4, 3.5, boat);
    const vU = K.arrow3(0xffb547, 0.55), vC = K.arrow3(0x3fb6d6, 0.55), vR = K.arrow3(0x3fae5a, 0.55);
    [vU, vC, vR].forEach(a => kit.root.add(a.g));
    const wake = K.dots(30, 0.35, 0xf4f6fb, { transparent: true, opacity: 0.85 });
    // стрелка «берега уплывают» в системе плота
    const shoreA = K.arrow(0xc9b27a, 0.5); shoreA.g.rotation.y = Math.PI; at(shoreA.g, 40, BT + 4, FB - 3); shoreA.set(raftV ? 4 + d.cur * 3 : 0);
    // пульт
    const pu = K.pult(32, 42, 50, 13);
    K.disp(pu, -15, 9.4, 'нос θ = ' + (d.th > 0 ? '+' : '') + d.th + '°', 16);
    K.button(pu, -0.6, 9.4, 4.7, '◀ нос', 'th-', { w: 8.6, h: 4.2 }); K.button(pu, 8.6, 9.4, 4.7, 'нос ▶', 'th+', { w: 8.6, h: 4.2 });
    K.disp(pu, -15, 3.6, 'течение ' + nf(d.cur) + ' м/с', 16, '#72d4e8');
    K.button(pu, -0.6, 3.6, 4.7, 'теч. −', 'c-', { w: 8.6, h: 4.2 }); K.button(pu, 8.6, 3.6, 4.7, 'теч. +', 'c+', { w: 8.6, h: 4.2 });
    K.button(pu, 19.4, 9.4, 4.7, d.run ? 'Плывёт…' : 'Плыть', 'go', { w: 9, h: 4.2, ...(d.run ? K.green : K.red) });
    K.button(pu, 19.4, 3.6, 4.7, raftV ? '→ Берег' : '→ Плот', raftV ? 'f-shore' : 'f-raft', { w: 9, h: 4.2, ...K.yel });

    const boatTag = v3(0, 3, NB), raftTag = v3(0, 9, (NB + FB) / 2);
    tag(boatTag, 'Лодка', '5 м/с относительно воды');
    tag(raftTag, 'Плот', raftV ? 'камера здесь: вода стоит' : 'плывёт вместе с водой', raftV);
    const pierTag = v3(0, 13, FB - 2);
    tag(pierTag, 'Причал', d.res ? 'снос ' + fm(Math.abs(d.res.xL), 1) + ' м' : 'точно напротив старта', d.pier);
    tag(v3(-46, 15, NB + 5), 'Камера на берегу', raftV ? 'нажмите — смотреть с берега' : 'смотрим отсюда', !raftV);

    const wrap = x => ((x + 62) % 124 + 124) % 124 - 62;
    kit.onFrame(() => {
      const Lv = live(); if (!Lv) return;
      const tt = Math.min(Lv.t, TX), drift = d.cur * tt * KR, off = raftV ? drift : 0;
      // вода и берега
      waterTex.offset.x = raftV ? 0 : -drift / (124 / 6);
      gNear.offset.x = gFar.offset.x = off / (124 / 10);
      trees.forEach(tr => { tr.g.position.x = wrap(tr.x0 - off); });
      pier.position.x = -off; pier.visible = Math.abs(off) < 56; pierTag.x = -off;
      jetty.position.x = -off; jetty.visible = Math.abs(off) < 56;
      // плот
      const xr = (-50 * KR) + (raftV ? 0 : drift); raft.position.set(xr, 0, (NB + FB) / 2); raftTag.x = xr;
      // лодка
      const bx = t => (raftV ? d.u * Math.sin(d.th * DEG) : vx) * t * KR, bz = t => Z0 - vy * t * KZ;
      const X = bx(tt), Zb = bz(tt), off2 = Math.abs(X) > 61;
      boat.visible = !off2; boat.position.set(X, WY * (1 - 1.35), Zb); boat.rotation.y = -d.th * DEG; boatTag.x = X + 12; boatTag.z = Zb + 7;
      wake.forEach((m, i) => { const t = tt * i / 30; m.visible = tt > 0 && i > 0 && Math.abs(bx(t)) < 61; if (m.visible) m.position.set(bx(t), WY + 0.05, bz(t)); });
      const k = 2.2, from = v3(X, WY + 4.2, Zb), u = v3(d.u * Math.sin(d.th * DEG) * k, 0, -d.u * Math.cos(d.th * DEG) * k);
      vU.set(from, u); vU.g.visible = !off2;
      if (raftV) { vC.g.visible = false; vR.g.visible = false; }
      else { vC.g.visible = vR.g.visible = !off2; vC.set(from.clone().add(u), v3(d.cur * k, 0, 0)); vR.set(from, u.clone().add(v3(d.cur * k, 0, 0))); }
    });
  };
})();
