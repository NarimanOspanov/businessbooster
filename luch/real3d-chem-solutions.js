// «Как в жизни» для темы «Растворы» (labs/chem-solutions):
// урок 1 — электронные весы со стаканом, банка соли NaCl и промывалка с водой, клавиши «соль/вода/вылить»;
// урок 2 — бутыли с растворами (или стакан на плитке для упаривания), доска с задачей, клавиши задач;
// урок 3 — весы с лодочкой, банки NaOH / CuSO₄ / MgSO₄ и мерная колба с меткой (100 мл … 1 л);
// урок 4 — банки с медным купоросом и английской солью, брусок «состав кристалла», весы со стаканом и промывалка.
// Сцены строятся из window.LUCH_REAL() опыта; нажатия уходят в window.LUCH_REAL.click(key).
(() => {
  const SC = window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {};
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rnd = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const fmt = (x, n = 2) => String(+(+x).toFixed(n)).replace('.', ',');
  const SUBD = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
  const low = s => String(s).replace(/([A-Za-z)])(\d+)/g, (q, a, d) => a + d.replace(/\d/g, x => SUBD[x]));
  const TY = 1.2; // верх подноса
  const WATER = 0x8fc6ea;

  // ---------- общие детали ----------
  function H(kit) {
    const { T, at, box, cyl, mesh, keep, grad, glowTex, clickable, C } = kit;
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    const glassMat = (color = 0xd8eef8, opacity = 0.24) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, transparent: true, opacity, side: T.DoubleSide, depthWrite: false }));
    const ownMat = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, ...o }));
    const spr = (map, color, opacity) => new T.Sprite(keep(new T.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false })));
    function canvasPlane(w, h, pw, ph, draw) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph; const x = c.getContext('2d');
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: tex, transparent: true })));
      m.userData.draw = fn => { x.clearRect(0, 0, pw, ph); fn(x, pw, ph); tex.needsUpdate = true; };
      if (draw) m.userData.draw(draw);
      return m;
    }
    const textLines = (x, pw, ph, lines, fg, bg, o = {}) => {
      if (bg) { x.fillStyle = bg; if (o.round && x.roundRect) { x.beginPath(); x.roundRect(2, 2, pw - 4, ph - 4, o.round); x.fill(); } else x.fillRect(0, 0, pw, ph); }
      const lh = ph / lines.length;
      lines.forEach((ln, i) => {
        const t = typeof ln === 'string' ? { t: ln } : ln;
        let fs = Math.round(lh * (t.k || 0.62)); const font = s => `${t.w || 600} ${s}px "IBM Plex Mono", monospace`;
        x.font = font(fs); const tw = x.measureText(t.t).width; if (tw > pw * 0.9) { fs = Math.floor(fs * pw * 0.9 / tw); x.font = font(fs); }
        x.fillStyle = t.c || fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t.t, pw / 2, lh * (i + 0.5) + 2);
      });
    };
    const label = (w, h, lines, fg = '#1b1610', bg = '#fff6e6', pw = 260) => canvasPlane(w, h, pw, Math.round(pw * h / w), (x, a, b) => textLines(x, a, b, lines, fg, bg, { round: 10 }));
    function key(parent, x, z, w, d, text, color, keyName, fg = '#ffffff') {
      const b = new T.Group(); at(b, x, TY, z, parent);
      at(box(w, 1.6, d, color), 0, 0.8, 0, b);
      const top = canvasPlane(w * 0.92, d * 0.8, Math.round(70 * w / d * 1.4), 112, (cx, a, bb) => textLines(cx, a, bb, [text], fg, '#' + color.toString(16).padStart(6, '0')));
      top.rotation.x = -Math.PI / 2; at(top, 0, 1.62, 0, b);
      clickable(b, keyName); return b;
    }
    function keys(parent, list, z = 37) {
      const n = list.length, span = 116, step = span / n, w = Math.min(19, step - 1.6);
      list.forEach(([k, t, col], i) => key(parent, -span / 2 + step * (i + 0.5), z, w, 8, t, col || 0x3b4a66, k));
    }
    const ring = (parent, x, z, r, col = 0xffd166) => at(cyl(r, 0.25, col, { edges: false, hull: false, shadow: false }), x, TY + 0.13, z, parent);
    function tray(g, w = 128, d = 86, z = 4) {
      at(box(w, TY, d, 0xf3f5f8), 0, TY / 2, z, g);
      at(box(w, 1.5, 1.2, 0xe2e7ee), 0, TY + 0.75, z - d / 2 + 0.6, g); at(box(w, 1.5, 1.2, 0xe2e7ee), 0, TY + 0.75, z + d / 2 - 0.6, g);
      at(box(1.2, 1.5, d - 2.4, 0xe2e7ee), -w / 2 + 0.6, TY + 0.75, z, g); at(box(1.2, 1.5, d - 2.4, 0xe2e7ee), w / 2 - 0.6, TY + 0.75, z, g);
    }
    // электронные весы: корпус, платформа, табло спереди; возвращает высоту платформы
    function scales(parent, x, z, w, d, text, click) {
      const g = new T.Group(); at(g, x, TY, z, parent);
      at(box(w, 4, d, 0x3b4a66), 0, 2, 0, g);
      at(box(w - 4, 0.8, d - 6, 0xc6ccd6), 0, 4.4, -1.5, g);
      at(box(w * 0.6, 3, 0.4, 0x26324a), 0, 2, d / 2 + 0.05, g);
      const scr = canvasPlane(w * 0.5, 2.4, 300, 96, (cx, a, b) => textLines(cx, a, b, [text], '#86e0a8', '#0e1520'));
      at(scr, 0, 2, d / 2 + 0.3, g);
      at(cyl(0.9, 0.6, 0xe0473a, { edges: false }), w / 2 - 3, 4.3, d / 2 - 2.2, g);
      if (click) clickable(g, click);
      return { g, top: TY + 4.8, scr };
    }
    // химический стакан с жидкостью; fill 0…1 от высоты
    function beaker(parent, x, y0, z, r, h, fill, color, opacity, o = {}) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const wall = new T.Mesh(keep(new T.CylinderGeometry(r, r * 0.97, h, 40, 1, true)), glassMat(0xd8eef8, 0.22)); at(wall, 0, h / 2, 0, g);
      wall.add(new T.Mesh(wall.geometry, kit.hullMat));
      at(cyl(r * 0.97, 0.6, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.45 } }), 0, 0.3, 0, g);
      const rim = mesh(new T.TorusGeometry(r, 0.22, 6, 40), 0xeef6fb, { edges: false, shadow: false }); rim.rotation.x = Math.PI / 2; at(rim, 0, h, 0, g);
      for (let k = 1; k <= 5; k++) { const m = box(k % 2 ? 1.1 : 2, 0.16, 0.1, 0x6f8098, { edges: false, shadow: false }); m.rotation.y = 0.5; at(m, Math.sin(0.5) * (r + 0.05), h * k / 6.5, Math.cos(0.5) * (r + 0.05), g); }
      const lh = clamp(fill, 0, 1) * h * 0.9;
      if (lh > 0.2) {
        const liq = new T.Mesh(keep(new T.CylinderGeometry(r * 0.95, r * 0.93, lh, 36)), ownMat(color, { transparent: true, opacity, depthWrite: false }));
        at(liq, 0, 0.6 + lh / 2, 0, g);
      }
      if (o.grains) for (let i = 0; i < o.grains; i++) { const a = rnd(i + 2) * 6.28, rr = rnd(i + 9) * r * 0.75; at(box(1, 0.7, 1, o.gc || 0xf2f5f8, { edges: false }), Math.cos(a) * rr, 0.95 + (i > 14 ? 0.7 : 0), Math.sin(a) * rr, g); }
      if (o.click) clickable(g, o.click);
      return g;
    }
    // банка с кристаллами и этикеткой
    function jar(parent, x, z, text, col, keyName, on, seed = 1) {
      const g = new T.Group(); at(g, x, TY, z, parent); clickable(g, keyName);
      const wall = new T.Mesh(keep(new T.CylinderGeometry(4.2, 4.2, 10, 28, 1, true)), glassMat(0xd8eef8, 0.3)); at(wall, 0, 5, 0, g); wall.add(new T.Mesh(wall.geometry, kit.hullMat));
      at(cyl(4.2, 0.5, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.4 } }), 0, 0.25, 0, g);
      for (let j = 0; j < 18; j++) { const a = rnd(j + seed * 5) * 6.28, rr = rnd(j + 11 + seed) * 3.2; at(box(1.2, 1.0, 1.2, col, { edges: false }), Math.cos(a) * rr, 0.9 + Math.floor(j / 6) * 1.0, Math.sin(a) * rr, g).rotation.y = rnd(j) * 3; }
      at(cyl(4.5, 1.6, 0x3b4a66), 0, 10.8, 0, g);
      const lb = label(7.2, 3.2, [text]); at(lb, 0, 6.2, 4.25, g);
      if (on) ring(g, 0, 0, 6.2).position.y = 0.13;
      return g;
    }
    // промывалка
    function washBottle(parent, x, z, keyName) {
      const g = new T.Group(); at(g, x, TY, z, parent); clickable(g, keyName);
      const body = new T.Mesh(keep(new T.CylinderGeometry(4.2, 4.6, 13, 28)), ownMat(0xdcefff, { transparent: true, opacity: 0.55, depthWrite: false })); at(body, 0, 6.5, 0, g); body.add(new T.Mesh(body.geometry, kit.hullMat));
      at(new T.Mesh(keep(new T.CylinderGeometry(4.0, 4.3, 9, 24)), ownMat(WATER, { transparent: true, opacity: 0.5, depthWrite: false })), 0, 4.7, 0, g);
      at(cyl(2, 2, 0xe0473a), 0, 14, 0, g);
      const pts = [v3(0, 15, 0), v3(0, 19, 0), v3(-1.5, 21, 0), v3(-5, 21.5, 0), v3(-7, 20.5, 0)];
      at(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 24, 0.45, 8), 0xeef2f6, { edges: false }), 0, 0, 0, g);
      const lb = label(6.4, 2.8, ['H₂O']); at(lb, 0, 8, 4.65, g);
      return g;
    }
    // реактивная бутыль с этикеткой
    function bottle(parent, x, z, lines, color, keyName) {
      const g = new T.Group(); at(g, x, TY, z, parent); clickable(g, keyName);
      const body = new T.Mesh(keep(new T.CylinderGeometry(4.4, 4.4, 12, 28)), glassMat(0xd8eef8, 0.32)); at(body, 0, 6, 0, g); body.add(new T.Mesh(body.geometry, kit.hullMat));
      at(new T.Mesh(keep(new T.CylinderGeometry(4.1, 4.1, 9, 24)), ownMat(color, { transparent: true, opacity: 0.55, depthWrite: false })), 0, 4.8, 0, g);
      const sh = new T.Mesh(keep(new T.CylinderGeometry(1.8, 4.4, 3, 28, 1, true)), glassMat(0xd8eef8, 0.32)); at(sh, 0, 13.5, 0, g); sh.add(new T.Mesh(sh.geometry, kit.hullMat));
      at(cyl(1.6, 2.2, 0xd8eef8, { matOpt: { transparent: true, opacity: 0.4 } }), 0, 16, 0, g);
      at(cyl(1.9, 1.6, 0x3b4a66), 0, 17.6, 0, g);
      const lb = label(7.4, 4.6, lines); at(lb, 0, 7, 4.45, g);
      return g;
    }
    // пар над стаканом
    let puffT = null;
    function puffTex() {
      if (puffT) return puffT;
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
      const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.5, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 64, 64); puffT = keep(new T.CanvasTexture(c)); return puffT;
    }
    function steam(parent, x, y, z, amt) {
      const g = new T.Group(); at(g, x, y, z, parent); const ps = [];
      for (let i = 0; i < 6; i++) { const s = spr(puffTex(), 0xffffff, 0); g.add(s); ps.push({ s, ph: i / 6, dx: (rnd(i + 3) - 0.5) * 8, dz: (rnd(i + 9) - 0.5) * 8 }); }
      kit.onFrame((dt, t) => {
        for (const p of ps) {
          const ph = kit.reduce ? 0.15 + p.ph * 0.7 : (t * 0.35 + p.ph) % 1;
          p.s.position.set(p.dx * (0.6 + ph), ph * 12, p.dz * (0.6 + ph)); p.s.scale.setScalar(4.5 * (0.6 + ph * 1.4));
          p.s.material.opacity = amt * 0.45 * Math.sin(Math.PI * ph);
        }
      });
      return g;
    }
    return { v3, glassMat, ownMat, canvasPlane, textLines, label, key, keys, ring, tray, scales, beaker, jar, washBottle, bottle, steam };
  }
  const liqOp = (w, k = 1.2) => 0.42 + Math.min(0.4, w / 100 * k);

  // ===== урок 1: массовая доля =====
  SC['chsol-mass'] = (kit, d) => {
    const { T, at, tag } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const sc = h.scales(g, -14, 2, 34, 28, fmt(d.m, 1) + ' г');
    const grains = d.sat ? 12 : 0;
    h.beaker(g, -14, sc.top, 0, 10, 24, d.m / 360, WATER, liqOp(d.w), { grains });
    h.jar(g, 22, -16, 'NaCl', 0xf2f5f8, 'salt', false, 2);
    h.washBottle(g, 42, 0, 'water');
    h.keys(g, [['s+1', 'соль +1 г', 0x8a6a3a], ['s+5', 'соль +5 г', 0x8a6a3a], ['w+1', 'вода +1', 0x2f6fb0], ['w+10', 'вода +10', 0x2f6fb0], ['w+50', 'вода +50', 0x2f6fb0], ['pour', 'вылить', 0xc8452c]]);
    tag(v3(-14, sc.top + 28, 0), 'Раствор', `${d.s} г соли + ${d.wt} г воды · ω ${fmt(d.w)} %`);
    tag(v3(22, TY + 14, -16), 'Соль NaCl', '+1 г');
    tag(v3(48, TY + 4, 8), 'Вода', '+10 г');
    if (d.sat) tag(v3(-14, sc.top + 4, 12), '', 'не растворяется');
  };

  // ===== урок 2: разбавление, упаривание, смешивание =====
  SC['chsol-dil'] = (kit, d) => {
    const { T, at, box, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    // доска с задачей
    const bd = new T.Group(); at(bd, 0, TY, -36, g);
    at(box(2, 20, 2, C.DARK), -40, 10, 0, bd); at(box(2, 20, 2, C.DARK), 40, 10, 0, bd);
    at(box(80, 13, 1.6, 0x26324a), 0, 14, 0, bd);
    const goal = `цель: ${d.tm ? d.tm + ' г, ' : ''}${fmt(d.tw)} %`;
    const board = h.canvasPlane(78, 12, 1040, 160, (cx, a, b) => h.textLines(cx, a, b, [{ t: `Задача ${d.pi + 1}: ${d.name} · ${low(d.sub)}`, c: '#ffd166' }, { t: `в стакане ${fmt(d.m, 1)} г · вещества ${fmt(d.ms, 1)} г · ω ${fmt(d.w)} %`, k: 0.5 }, { t: goal + (d.ok ? '  ✓' : ''), k: 0.5, c: d.ok ? '#86e0a8' : '#f2f5f0' }], '#f2f5f0', '#132018'));
    at(board, 0, 14, 0.85, bd);
    // плитка и стакан
    const pl = new T.Group(); at(pl, 6, TY, 2, g);
    at(box(30, 3, 26, 0x3a4762), 0, 1.5, 0, pl);
    at(kit.cyl(11, 0.4, d.evap && d.ev > 0 ? 0xff8a3c : 0x56688f, { edges: false }), 0, 3.2, 0, pl);
    at(kit.cyl(1.4, 1.2, 0x2a3550), 11, 1.8, 13.2, pl).rotation.x = Math.PI / 2;
    if (d.evap) clickable(pl, 'evap');
    const col = d.pi === 2 ? 0xb9a8f5 : WATER;
    h.beaker(g, 6, TY + 3.4, 2, 11, 26, d.m / 460, col, liqOp(d.w, 1.4));
    if (d.evap && d.ev > 0) h.steam(g, 6, TY + 31, 2, 1);
    if (d.src.length) d.src.forEach((s, i) => {
      h.bottle(g, -46 + i * 16, -10, [s.k === 'water' ? 'H₂O' : s.lab, s.amt + ' г'], s.k === 'water' ? WATER : s.w > 0.3 ? 0xb9a8f5 : s.k === 'a' && d.pi === 0 ? 0xffd48a : 0x9fd4f0, 'src-' + s.k);
      tag(v3(-46 + i * 16, TY + 3, -4), s.k === 'water' ? 'Вода' : s.lab.replace(' ', '') + '-й', `взято ${s.amt} г`);
    });
    else {
      const sg = h.label(18, 8, [`было: ${d.init.m} г`, `ω = ${fmt(d.init.w * 100)} %`, `испарилось ${d.ev} г`]); sg.rotation.x = -0.9; at(sg, -38, TY + 3, -6, g);
      at(box(20, 2, 10, 0x3b4a66), -38, TY + 1, -8, g);
    }
    const act = d.evap ? [['evap', 'выпарить 10 г', 0xc8452c]] : d.src.map(s => ['a-' + s.k + '-10', (s.k === 'water' ? 'вода' : s.lab) + ' +10', s.k === 'water' ? 0x2f6fb0 : 0x8a6a3a]);
    h.keys(g, [['p-0', '1. разбавл.' + (d.solved[0] ? ' ✓' : ''), d.pi === 0 ? 0xc77800 : 0x3b4a66], ['p-1', '2. упарив.' + (d.solved[1] ? ' ✓' : ''), d.pi === 1 ? 0xc77800 : 0x3b4a66], ['p-2', '3. смешив.' + (d.solved[2] ? ' ✓' : ''), d.pi === 2 ? 0xc77800 : 0x3b4a66], ...act, ['reset', 'сначала', 0x56688f]]);
    tag(v3(6, TY + 34, 2), 'Стакан', `${fmt(d.m, 1)} г · ω ${fmt(d.w)} %`, d.ok);
    if (d.evap) tag(v3(18, TY + 6, 16), 'Плитка', 'выпарить воду');
  };

  // ===== урок 3: молярная концентрация =====
  SC['chsol-molar'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const SOLID = { NaOH: 0xf2f5f8, CuSO4: 0xeef1f4, MgSO4: 0xf6f7f9 }, LIQ = { NaOH: [WATER, 0.42], CuSO4: [0x2f7fe0, 0.72], MgSO4: [WATER, 0.42] };
    // весы с лодочкой
    const sc = h.scales(g, -38, 4, 26, 24, fmt(d.fill ? 0 : d.m, 1) + ' г');
    const boat = new T.Group(); at(boat, -38, sc.top, 2.5, g);
    at(box(9, 0.6, 6, 0xc8d1e2), 0, 0.3, 0, boat);
    if (!d.fill && d.m > 0) { const r = 1 + Math.min(3.4, Math.sqrt(d.m) * 0.75); at(mesh(new T.ConeGeometry(r, r * 0.8, 18), SOLID[d.f], { edges: false }), 0, 0.6 + r * 0.4, 0, boat); }
    // мерная колба
    const r = 5 + 7 * Math.cbrt(d.V / 1000), fl = new T.Group(); at(fl, 4, TY, 4, g); clickable(fl, 'flask');
    const bulb = new T.Mesh(keep(new T.SphereGeometry(r, 32, 20)), h.glassMat(0xd8eef8, 0.26)); bulb.scale.y = 0.9; at(bulb, 0, r * 0.9, 0, fl); bulb.add(new T.Mesh(bulb.geometry, kit.hullMat));
    const nh = 24, ny = r * 1.7;
    const neck = new T.Mesh(keep(new T.CylinderGeometry(1.5, 1.5, nh, 20, 1, true)), h.glassMat(0xd8eef8, 0.3)); at(neck, 0, ny + nh / 2, 0, fl); neck.add(new T.Mesh(neck.geometry, kit.hullMat));
    const markY = ny + nh * 0.55;
    const mk = mesh(new T.TorusGeometry(1.55, 0.12, 6, 24), 0x1b1610, { edges: false, shadow: false }); mk.rotation.x = Math.PI / 2; at(mk, 0, markY, 0, fl);
    at(cyl(1.7, 1.6, 0x3b4a66), 0, ny + nh + 0.6, 0, fl);
    if (d.fill) {
      const [lc, lo] = LIQ[d.f] || [WATER, 0.42];
      const lq = new T.Mesh(keep(new T.SphereGeometry(r * 0.95, 28, 18)), h.ownMat(lc, { transparent: true, opacity: lo, depthWrite: false })); lq.scale.y = 0.9; at(lq, 0, r * 0.9, 0, fl);
      at(new T.Mesh(keep(new T.CylinderGeometry(1.35, 1.35, markY - ny + 0.6, 16)), h.ownMat(lc, { transparent: true, opacity: lo, depthWrite: false })), 0, ny + (markY - ny) / 2 - 0.3, 0, fl);
    }
    const fl2 = h.label(8, 3.4, [d.V >= 1000 ? '1 л' : d.V + ' мл']); at(fl2, 0, r * 0.9, r + 0.2, fl);
    if (!d.fill && d.m > 0) h.ring(fl, 0, 0, r + 1.5);
    // банки с веществами
    d.subs.forEach((s, i) => h.jar(g, 26 + i * 13, -18, low(s.f), SOLID[s.f] || 0xf2f5f8, 'j-' + s.f, s.f === d.f, i * 3 + 1));
    h.keys(g, [['m-1', '−1 г', 0x8a6a3a], ['m+1', '+1 г', 0x8a6a3a], ['m+5', '+5 г', 0x8a6a3a], ['vnext', 'колба ▸', 0x3b4a66], d.fill ? ['pour', 'вылить', 0xc8452c] : ['fill', 'до метки', 0x2f6fb0]]);
    tag(v3(-38, sc.top + 10, 2), 'Весы', d.fill ? 'пусто' : `${d.m} г ${low(d.f)}`);
    tag(v3(4, TY + ny + nh + 6, 4), 'Колба ' + (d.V >= 1000 ? '1 л' : d.V + ' мл'), d.fill ? `C = ${fmt(d.C, 4)} моль/л` : 'нажмите — до метки', d.fill && d.done.some(Boolean));
    tag(v3(39, TY + 16, -18), low(d.f) + ' · M ' + d.M, `n = ${fmt(d.n, 4)} моль`);
  };

  // ===== урок 4: кристаллогидраты =====
  SC['chsol-hyd'] = (kit, d) => {
    const { T, at, box, tag } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const COL = { cu: 0x3f8fe0, mg: 0xe8eef6 };
    // брусок «состав кристалла»: соль + кристаллизационная вода
    const k = d.Ms / d.M, L = 34, bz = 18, bx = -36;
    at(box(L * k, 4, 5, d.h === 'cu' ? 0x3f8fe0 : 0xc9d2e0), bx - L / 2 + L * k / 2, TY + 2, bz, g);
    at(box(L * (1 - k), 4, 5, 0x9fd4f0, { matOpt: { transparent: true, opacity: 0.7 } }), bx - L / 2 + L * k + L * (1 - k) / 2, TY + 2, bz, g);
    const sg = h.label(L, 3.6, [`${low(d.s)} ${d.Ms} + ${d.k}H₂O ${d.M - d.Ms} = ${d.M} г`]); sg.rotation.x = -0.5; at(sg, bx, TY + 2.4, bz + 4.6, g);
    d.hyds.forEach((q, i) => h.jar(g, -46 + i * 16, -6, low(q.f), COL[q.q] || 0xf2f5f8, 'jh-' + q.q, q.q === d.h, i * 4 + 2));
    const sc = h.scales(g, 10, 0, 34, 28, fmt(d.m, 1) + ' г');
    const liq = d.h === 'cu' ? 0x2f7fe0 : WATER;
    h.beaker(g, 10, sc.top, -2, 10, 24, d.m / 400, liq, d.wt > 0 ? liqOp(d.w, d.h === 'cu' ? 4 : 1.2) : 0.3, { grains: d.wt > 0 ? 0 : Math.min(26, Math.round(d.mh / 3)), gc: COL[d.h] });
    h.washBottle(g, 44, 0, 'water');
    h.keys(g, [['h+1', 'кристаллы +1', 0x8a6a3a], ['h+10', 'кристаллы +10', 0x8a6a3a], ['w+1', 'вода +1', 0x2f6fb0], ['w+10', 'вода +10', 0x2f6fb0], ['w+50', 'вода +50', 0x2f6fb0], ['pour', 'вылить', 0xc8452c]]);
    tag(v3(10, sc.top + 28, -2), 'Раствор', `${d.mh} г гидрата + ${d.wt} г воды · ω ${fmt(d.w)} %`);
    tag(v3(-36, TY + 5, 18), 'Состав кристалла', `в ${d.mh} г: ${fmt(d.ms, 2)} г ${low(d.s)}`);
    tag(v3(50, TY + 4, 8), 'Вода', '+10 г');
  };
})();
