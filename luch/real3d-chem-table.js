// «Как в жизни» для тем «Периодическая система» (labs/chem-table), «Моль и расчёты» (labs/chem-mole)
// и «Биомолекулы» (labs/chem-biomol): учебный кабинет химии на белом лабораторном подносе.
// Таблица Менделеева — стенд из карточек-блоков, лента элементов, образцы металлов и неметаллов с лампочкой
// и батарейкой, клетка «экасилиций» с прогнозом; моль — порции по 1 моль на весах, ящики частиц и счётчик,
// рычажные весы с гирьками-атомами, газовый цилиндр и мешки по 22,4 л рядом с кубом-эталоном, расчёт по уравнению
// с весами до и после; биомолекулы — цепь глюкоз (йод синеет в спирали), бусы аминокислот, двойная спираль ДНК.
// Сцены строятся из window.LUCH_REAL() опыта; быстрые значения (ход опыта) — из LUCH_REAL.live() в onFrame.
(() => {
  const SC = window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {};
  const live = () => { try { return window.LUCH_REAL.live ? window.LUCH_REAL.live() : null; } catch (e) { return null; } };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rnd = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const ease = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const fmt = (x, n) => { let s = (Math.round(x * 10 ** n) / 10 ** n).toFixed(n); if (/^-0(\.0+)?$/.test(s)) s = s.slice(1); return s.replace('.', ',').replace('-', '−'); };
  const fmtG = (x, n = 2) => String(+(+x).toFixed(n)).replace('.', ',');
  const SUBD = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
  const SUPD = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  const low = s => String(s).replace(/\d/g, d => SUBD[d]);
  const sup = s => String(s).replace(/[\d-]/g, d => SUPD[d]);
  const hexN = s => typeof s === 'number' ? s : parseInt(String(s).slice(1), 16);
  const hexS = n => '#' + (n >>> 0).toString(16).padStart(6, '0');
  const cap = s => s && /[а-яёa-z]/.test(s[0]) ? s[0].toUpperCase() + s.slice(1) : s;
  const ROM = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  const TY = 1.2; // верх подноса
  // n моль частиц → «1,204·10²⁴»
  const sci = n => {
    if (n <= 0) return '0';
    let m = n * 6.02, e = 23;
    while (m >= 10 - 1e-9) { m /= 10; e++; }
    while (m < 1) { m *= 10; e--; }
    return String(+m.toPrecision(4)).replace('.', ',') + '·10' + sup(e);
  };
  // состояние между перестройками сцены (плавные переходы)
  const MEM = {};

  // ---------- общие детали ----------
  function H(kit) {
    const { T, at, box, cyl, mesh, keep, grad, glowTex, textTex, clickable, toon, C } = kit;
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    const v2 = (x, y) => new T.Vector2(x, y);
    const glassMat = (color = 0xd8eef8, opacity = 0.26) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, transparent: true, opacity, side: T.DoubleSide, depthWrite: false }));
    const ownMat = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, ...o }));
    const spr = (map, color, opacity, add) => new T.Sprite(keep(new T.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending })));
    const glow = (color, size, opacity) => { const s = spr(glowTex(), color, opacity, true); s.scale.setScalar(size); return s; };
    const ball = (r, color, o = {}) => mesh(new T.SphereGeometry(r, o.seg || 20, o.seg2 || 14), color, { hull: true, edges: false, ...o });
    function rodAB(parent, a, b, r, color, o = {}) {
      const dv = b.clone().sub(a), L = dv.length();
      const m = cyl(r, L, color, { edges: false, ...o });
      m.quaternion.setFromUnitVectors(v3(0, 1, 0), dv.normalize());
      return at(m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, parent);
    }
    // табличка на холсте: draw(ctx, w, h)
    function canvasPlane(w, h, pw, ph, draw) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph; const x = c.getContext('2d');
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: tex, transparent: true })));
      m.userData.draw = fn => { x.clearRect(0, 0, pw, ph); fn(x, pw, ph); tex.needsUpdate = true; };
      if (draw) m.userData.draw(draw);
      return m;
    }
    const textLines = (x, pw, ph, lines, fg, bg, o = {}) => {
      if (bg) { x.fillStyle = bg; if (o.round) { x.beginPath(); x.roundRect(2, 2, pw - 4, ph - 4, o.round); x.fill(); } else x.fillRect(0, 0, pw, ph); }
      if (o.border) { x.strokeStyle = o.border; x.lineWidth = o.bw || 6; x.beginPath(); x.roundRect((o.bw || 6) / 2, (o.bw || 6) / 2, pw - (o.bw || 6), ph - (o.bw || 6), o.round || 8); x.stroke(); }
      const lh = ph / lines.length;
      lines.forEach((ln, i) => {
        const t = typeof ln === 'string' ? { t: ln } : ln;
        let fs = Math.round(lh * (t.k || 0.62)); const font = s => `${t.w || 600} ${s}px ${t.mono === false ? '"Golos Text", sans-serif' : '"IBM Plex Mono", monospace'}`;
        x.font = font(fs); const tw = x.measureText(t.t).width; if (tw > pw * 0.9) { fs = Math.floor(fs * pw * 0.9 / tw); x.font = font(fs); }
        x.fillStyle = t.c || fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t.t, pw / 2, lh * (i + 0.5) + 2);
      });
    };
    function screen(w, h, txt, fg = '#86e0a8', pw = 320, ph = 120, bg = '#0e1520') {
      const m = canvasPlane(w, h, pw, ph);
      let cur = null;
      m.userData.set = (t, col = fg) => { t = String(t); if (cur === t + col) return; cur = t + col; m.userData.draw((x, a, b) => textLines(x, a, b, t.split('\n'), col, bg)); };
      m.userData.set(txt); return m;
    }
    // плоская клавиша с надписью на подносе
    function key(parent, x, z, w, d, label, color, keyName, fg = '#ffffff', o = {}) {
      const b = new T.Group(); at(b, x, TY, z, parent);
      at(box(w, 1.6, d, color), 0, 0.8, 0, b);
      const top = canvasPlane(w * 0.92, d * 0.8, Math.round(70 * w / d * 1.4), 112, (cx, a, bb) => textLines(cx, a, bb, [label], fg, hexS(color)));
      top.rotation.x = -Math.PI / 2; at(top, 0, 1.62, 0, b);
      if (o.on) at(box(w + 1.2, 0.5, d + 1.2, 0xffd166, { edges: false }), 0, 0.25, 0, b);
      clickable(b, keyName); return b;
    }
    // подсветка выбранного: жёлтое кольцо на подносе
    const ring = (parent, x, z, r, col = 0xffd166, y = TY + 0.13) => at(cyl(r, 0.25, col, { edges: false, hull: false, shadow: false }), x, y, z, parent);
    // белый лабораторный поднос
    function tray(g, w = 124, d = 84, z = 4) {
      at(box(w, TY, d, 0xf3f5f8), 0, TY / 2, z, g);
      at(box(w, 1.5, 1.2, 0xe2e7ee), 0, TY + 0.75, z - d / 2 + 0.6, g); at(box(w, 1.5, 1.2, 0xe2e7ee), 0, TY + 0.75, z + d / 2 - 0.6, g);
      at(box(1.2, 1.5, d - 2.4, 0xe2e7ee), -w / 2 + 0.6, TY + 0.75, z, g); at(box(1.2, 1.5, d - 2.4, 0xe2e7ee), w / 2 - 0.6, TY + 0.75, z, g);
    }
    // электронные весы: платформа и табло спереди; вернёт { g, top, disp }
    function scale(parent, x, z, w = 16, d = 14, o = {}) {
      const g = new T.Group(); at(g, x, TY, z, parent);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => at(cyl(0.7, 0.4, C.DARK, { edges: false }), a * (w / 2 - 1.4), 0.2, b * (d / 2 - 1.4), g));
      at(box(w, 3, d, o.col || 0x34405a), 0, 1.9, 0, g);
      at(box(w - 1, 0.3, 3.6, 0x232b3d, { edges: false }), 0, 3.5, d / 2 - 2.2, g);
      const disp = screen(w * 0.62, 2.4, o.txt || '0,0 г', '#86e0a8', 300, 72, '#0c1a14'); disp.rotation.x = -1.0; at(disp, 0, 3.72, d / 2 - 2.2, g);
      at(cyl(Math.min(w, d - 4) * 0.42, 0.6, C.STEEL, { seg: 36 }), 0, 3.7, -1.6, g);
      return { g, top: TY + 4.0, disp, pz: z - 1.6 };
    }
    // стеклянный стакан с делениями
    function beaker(parent, x, y0, z, r, h) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const wall = new T.Mesh(keep(new T.CylinderGeometry(r, r * 0.97, h, 40, 1, true)), glassMat(0xd8eef8, 0.24)); at(wall, 0, h / 2, 0, g);
      wall.add(new T.Mesh(wall.geometry, kit.hullMat));
      at(cyl(r * 0.97, 0.5, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.45 } }), 0, 0.25, 0, g);
      const rim = mesh(new T.TorusGeometry(r, 0.2, 6, 40), 0xeef6fb, { edges: false }); rim.rotation.x = Math.PI / 2; at(rim, 0, h, 0, g);
      const a = 0.35;
      for (let k = 1; k <= 4; k++) { const m = box(k % 2 ? 1 : 1.8, 0.14, 0.1, 0x6f8098, { edges: false, shadow: false }); m.rotation.y = a; at(m, Math.sin(a) * (r + 0.05), h * k / 5.5, Math.cos(a) * (r + 0.05), g); }
      return { g, r, h };
    }
    // жидкость: цилиндр единичной высоты
    function liquid(parent, x, y0, z, r, color, opacity = 0.62) {
      const mat = ownMat(color, { transparent: true, opacity, depthWrite: false });
      const m = new T.Mesh(keep(new T.CylinderGeometry(r, r * 0.97, 1, 40)), mat);
      at(m, x, y0, z, parent);
      const set = (hgt, yb = y0) => { m.visible = hgt > 0.05; m.scale.y = Math.max(0.05, hgt); m.position.y = yb + Math.max(0.05, hgt) / 2; };
      return { m, mat, set };
    }
    // пробирка с круглым дном и жидкостью (уровень от дна)
    function tube(parent, x, y0, z, r, h, o = {}) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const pts = []; for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + i / 8 * Math.PI / 2; pts.push(v2(Math.max(0.001, Math.cos(a) * r), r + Math.sin(a) * r)); }
      pts.push(v2(r, h)); pts.push(v2(r + 0.3, h + 0.15));
      const geo = keep(new T.LatheGeometry(pts, 28));
      const wall = new T.Mesh(geo, glassMat(0xd8eef8, 0.3)); g.add(wall); wall.add(new T.Mesh(geo, kit.hullMat));
      const lm = ownMat(o.color ?? 0xcfe2f0, { transparent: true, opacity: o.op ?? 0.7, depthWrite: false });
      const ri = r - 0.3;
      const bot = new T.Mesh(keep(new T.SphereGeometry(ri, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), lm); at(bot, 0, r, 0, g);
      const body = new T.Mesh(keep(new T.CylinderGeometry(ri, ri, 1, 24)), lm); at(body, 0, r, 0, g);
      const set = lv => { bot.visible = lv > 0.3; const hb = lv - r; body.visible = hb > 0.05; if (body.visible) { body.scale.y = hb; body.position.y = r + hb / 2; } };
      set(o.level ?? 0);
      return { g, r, h, ri, mat: lm, set };
    }
    // склянка с раствором и этикеткой
    function bottle(parent, x, z, col, label, o = {}) {
      const g = new T.Group(); at(g, x, TY, z, parent);
      const r = o.r || 3.6, hh = o.h || 10;
      const wall = new T.Mesh(keep(new T.CylinderGeometry(r, r, hh, 28, 1, true)), glassMat(o.brown ? 0x9a6a3a : 0xd8eef8, o.brown ? 0.55 : 0.3)); at(wall, 0, hh / 2, 0, g); wall.add(new T.Mesh(wall.geometry, kit.hullMat));
      at(cyl(r, 1.6, 0xd8eef8, { r2: 1.4, edges: false, matOpt: { transparent: true, opacity: 0.4 } }), 0, hh + 0.8, 0, g);
      at(cyl(1.6, 1.8, o.cap || 0x2c3240, { seg: 16 }), 0, hh + 2.4, 0, g);
      if (col != null) { const lq = cyl(r - 0.35, hh * 0.72, col, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.8 } }); at(lq, 0, 0.3 + hh * 0.36, 0, g); }
      if (label) { const lb = canvasPlane(r * 1.7, hh * 0.38, 200, 96, (x, a, b) => textLines(x, a, b, [label], '#1b1610', '#fff6e6')); at(lb, 0, hh * 0.45, r + 0.06, g); }
      return { g, top: TY + hh + 3.3 };
    }
    // спиртовка с пламенем
    function flameTex(inner, outer) {
      const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d');
      const drop = (s, col, blur) => {
        x.save(); x.translate(32, 122); x.scale(s, s); x.beginPath();
        x.moveTo(0, -114); x.bezierCurveTo(8, -84, 24, -52, 22, -26); x.bezierCurveTo(20, -6, 10, 0, 0, 0);
        x.bezierCurveTo(-10, 0, -20, -6, -22, -26); x.bezierCurveTo(-24, -52, -8, -84, 0, -114); x.closePath();
        x.shadowColor = col; x.shadowBlur = blur; x.fillStyle = col; x.fill(); x.restore();
      };
      drop(1, outer, 9); drop(0.55, inner, 6);
      const t = keep(new T.CanvasTexture(c)); t.colorSpace = T.SRGBColorSpace; return t;
    }
    function burner(parent, x, z, on) {
      const bg = new T.Group(); at(bg, x, TY, z, parent);
      const body = mesh(new T.SphereGeometry(4.4, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), 0xd8eef8, { mat: glassMat(0xd8eef8, 0.35), hull: true, edges: false }); body.scale.y = 0.9; at(body, 0, 3.0, 0, bg);
      at(cyl(4.1, 3.0, 0xbfe0f5, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.55 } }), 0, 1.5, 0, bg);
      at(cyl(1.6, 1.8, C.STEEL), 0, 7.0, 0, bg); at(cyl(0.5, 1.2, 0xf2ead2, { edges: false }), 0, 8.4, 0, bg);
      const fg = new T.Group(); at(fg, 0, 8.8, 0, bg);
      const s = spr(flameTex('#d8f0ff', '#4a9cff'), 0xffffff, 0.94, false); s.center.set(0.5, 0.04); s.scale.set(3.4, 7, 1); fg.add(s);
      const gl = glow(0x6ab0ff, 14, 0.4); at(gl, 0, 2.4, 0, fg);
      fg.visible = !!on;
      if (!kit.reduce) kit.onFrame((dt, t) => { s.scale.set(3.4 * (1 + 0.08 * Math.sin(t * 17)), 7 * (1 + 0.12 * Math.sin(t * 13) + 0.05 * Math.sin(t * 29)), 1); });
      return { g: bg, fg, top: TY + 8.8 };
    }
    // пузырьки в жидкости
    function bubbles(parent, x, y0, z, r, n = 8) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const geo = keep(new T.SphereGeometry(1, 10, 8)), mat = keep(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }));
      const bs = [];
      for (let i = 0; i < n; i++) { const m = new T.Mesh(geo, mat); m.visible = false; g.add(m); bs.push({ m, ph: rnd(i + 11), a: rnd(i + 21) * Math.PI * 2, rr: Math.sqrt(rnd(i + 31)) * r }); }
      const st = { amt: 0, top: 5, big: 0.4, speed: 0.6 };
      kit.onFrame((dt, t) => {
        const k = Math.round(st.amt * n);
        bs.forEach((b, i) => {
          b.m.visible = i < k && st.top > 1.2; if (!b.m.visible) return;
          const ph = kit.reduce ? b.ph : (t * st.speed + b.ph) % 1, y = 0.4 + ph * (st.top - 0.9);
          b.m.scale.setScalar(st.big * (0.4 + 0.9 * ph));
          b.m.position.set(Math.cos(b.a) * b.rr + 0.2 * Math.sin(t * 5 + i), y, Math.sin(b.a) * b.rr);
        });
      });
      return { g, set(a, top, big = 0.4, speed = 0.6) { Object.assign(st, { amt: a, top, big, speed }); } };
    }
    // штатив с лапкой
    function stand(parent, x, z, Hh, arms) {
      at(box(10, 1.2, 8, C.DARK), x, TY + 0.6, z, parent);
      at(cyl(0.6, Hh, C.STEEL, { edges: false }), x, TY + 1.2 + Hh / 2, z, parent);
      arms.forEach(a => {
        rodAB(parent, v3(x, a.y, z), v3(a.to.x, a.y, a.to.z), 0.4, C.STEEL);
        at(box(2.0, 2.0, 2.0, C.DARK), x, a.y, z, parent);
        at(box(2.4, 2.2, 2.4, 0x3b4a66), a.to.x, a.y, a.to.z, parent);
      });
    }
    // кучка мелких кусочков (соль, сахар, мел, порошок)
    function heap(parent, x, y0, z, r, hgt, color, n, o = {}) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const cone = cyl(r, hgt, color, { r2: r * 0.18, edges: false, seg: 24 }); at(cone, 0, hgt / 2, 0, g);
      const geo = o.round ? new T.IcosahedronGeometry(o.s || 0.6, 0) : new T.BoxGeometry(o.s || 0.8, o.s || 0.8, o.s || 0.8);
      for (let i = 0; i < n; i++) {
        const a = rnd(i + 3) * 6.28, rr = Math.sqrt(rnd(i + 5)) * r * 0.85, yy = hgt * (1 - rr / r) * (0.7 + 0.3 * rnd(i + 7));
        const c = mesh(geo.clone(), o.c2 ?? color, { edgeAngle: 20 }); c.rotation.set(rnd(i) * 3, rnd(i + 1) * 3, 0); at(c, Math.cos(a) * rr, yy, Math.sin(a) * rr, g);
      }
      geo.dispose();
      return g;
    }
    // чашка (фарфоровая или стеклянная)
    function dish(parent, x, y0, z, r, col = 0xf7f3ea, op = 1) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      at(cyl(r * 0.8, 0.4, col, { edges: false, matOpt: op < 1 ? { transparent: true, opacity: op } : undefined }), 0, 0.2, 0, g);
      const pts = [v2(r * 0.8, 0), v2(r * 0.92, 0.6), v2(r, 1.8), v2(r + 0.25, 1.9)];
      const geo = keep(new T.LatheGeometry(pts, 36));
      const w = new T.Mesh(geo, op < 1 ? glassMat(col, op * 0.7) : toon(col, { side: T.DoubleSide })); g.add(w); w.add(new T.Mesh(geo, kit.hullMat));
      return { g, top: y0 + 0.4 };
    }
    // мешок-шар газа (радиус r), с горлышком и зажимом
    function balloon(parent, x, y0, z, r, color, op = 0.55) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const neck = cyl(0.9, 2.2, 0xdfe4ec, { r2: 1.4, edges: false }); at(neck, 0, 1.1, 0, g);
      at(box(3.2, 0.8, 1.2, 0x3b4a66), 0, 0.5, 0, g);
      const b = mesh(new T.SphereGeometry(1, 28, 20), color, { mat: ownMat(color, { transparent: true, opacity: op, depthWrite: false }), hull: false, edges: false });
      b.scale.set(r, r * 1.08, r); at(b, 0, 2.0 + r * 1.02, 0, g);
      return { g, b, top: y0 + 2.0 + r * 2.1 };
    }
    return { v3, v2, glassMat, ownMat, spr, glow, ball, rodAB, canvasPlane, textLines, screen, key, ring, tray, scale, beaker, liquid, tube, bottle, burner, bubbles, stand, heap, dish, balloon };
  }

  // =====================================================================================
  //                        ПЕРИОДИЧЕСКАЯ СИСТЕМА (labs/chem-table)
  // =====================================================================================
  const GC = [0, 0xc08cf0, 0x6fd0b0, 0x9fb4d8, 0xf0b45a, 0x5f9cf0, 0xef6a55, 0x6cc96f, 0xe88ac8];
  const lighten = (c, k) => { const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255, f = v => Math.round(v + (255 - v) * k); return (f(r) << 16) | (f(g) << 8) | f(b); };

  // карточка-блок элемента: верхняя грань (лёжа) или лицевая (на стенде)
  function cardFace(h, w, d, o) {
    return h.canvasPlane(w, d, 160, Math.round(160 * d / w), (x, a, b) => {
      x.fillStyle = o.bg; x.beginPath(); x.roundRect(3, 3, a - 6, b - 6, 14); x.fill();
      if (o.border) { x.strokeStyle = o.border; x.lineWidth = o.bw || 8; x.beginPath(); x.roundRect(o.bw / 2 || 4, o.bw / 2 || 4, a - (o.bw || 8), b - (o.bw || 8), 14); x.stroke(); }
      x.textAlign = 'center'; x.textBaseline = 'middle';
      if (o.z != null) { x.font = `600 ${Math.round(a * 0.17)}px "IBM Plex Mono", monospace`; x.fillStyle = o.sub || '#5d6b88'; x.textAlign = 'left'; x.fillText(String(o.z), a * 0.1, b * 0.17); x.textAlign = 'center'; }
      if (o.s) { let fs = Math.round(Math.min(a * 0.48, b * (o.m != null ? 0.42 : 0.5))); x.font = `700 ${fs}px "Golos Text", sans-serif`; const tw = x.measureText(o.s).width; if (tw > a * 0.86) { fs = Math.floor(fs * a * 0.86 / tw); x.font = `700 ${fs}px "Golos Text", sans-serif`; } x.fillStyle = o.fg || '#1b1610'; x.fillText(o.s, a / 2, b * (o.m != null ? 0.5 : 0.55)); }
      if (o.m != null) { let fs = Math.round(a * 0.17); x.font = `600 ${fs}px "IBM Plex Mono", monospace`; const tw = x.measureText(o.m).width; if (tw > a * 0.9) { fs = Math.floor(fs * a * 0.9 / tw); x.font = `600 ${fs}px "IBM Plex Mono", monospace`; } x.fillStyle = o.sub || '#5d6b88'; x.fillText(o.m, a / 2, b * 0.84); }
    });
  }

  // ===== 1. Закон Менделеева: лента карточек на подносе, разрезы, галочки над столбцами =====
  SC['chtb-law'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const nr = d.rows.length, ml = d.maxLen;
    const cw = Math.min(12, 116 / ml), rd = Math.min(15, 58 / nr), wC = cw * 0.86, dC = Math.min(rd * 0.8, 12.5);
    const z0 = 0 - (nr - 1) * rd / 2;
    const pos = {}, cards = [];
    d.rows.forEach((row, ri) => {
      const z = z0 + ri * rd;
      const c0 = d.place[ri][0], c1 = d.place[ri][row.length - 1];
      // бумажная лента под строкой
      if (row.length) {
        const xa = (-ml / 2 + c0) * cw, xb = (-ml / 2 + c1 + 1) * cw;
        at(box(xb - xa - 0.2, 0.3, dC + 1.4, 0xfffaf0, { edges: false }), (xa + xb) / 2, TY + 0.15, z, g);
        if (row.length === 2 && c1 - c0 > 1) at(box((c1 - c0 - 1) * cw, 0.12, 1.2, 0xd8c9a8, { edges: false }), (xa + xb) / 2, TY + 0.06, z, g);
      }
      row.forEach((zz, i) => {
        const e = d.els[zz - 1], x = (-ml / 2 + d.place[ri][i] + 0.5) * cw;
        pos[zz] = [x, z];
        const cg = new T.Group(); g.add(cg);
        const col = GC[e[2]];
        at(box(wC, 1.3, dC, col), 0, 0.65, 0, cg);
        const top = cardFace(h, wC * 0.94, dC * 0.94, { bg: hexS(lighten(col, 0.72)), s: e[0], z: zz, m: wC > 7 && dC > 8 ? fmt(e[1], 1) : null, fg: '#1b1610' });
        top.rotation.x = -Math.PI / 2; at(top, 0, 1.32, 0, cg);
        clickable(cg, 'cut-' + zz);
        cards.push({ cg, zz, x, z });
      });
      // разрез: оранжевая стойка-маркер после последней карточки строки
      if (ri < nr - 1 && row.length) {
        const xe = (-ml / 2 + c1 + 1) * cw;
        at(box(0.5, 3.2, dC + 2, 0xff9f1c, { edges: false }), xe + 0.15, TY + 1.6, z, g);
      }
    });
    // галочки над ровными столбцами — флажки за первой строкой
    d.cols.forEach((ok, c) => {
      if (!ok) return;
      const x = (-ml / 2 + c + 0.5) * cw, z = z0 - rd / 2 - 2.2;
      at(cyl(0.25, 4.2, C.STEEL, { edges: false, hull: false }), x, TY + 2.1, z, g);
      const f = h.canvasPlane(Math.min(5, cw * 0.8), Math.min(4, cw * 0.65), 96, 80, (x2, a, b) => h.textLines(x2, a, b, ['✓'], '#ffffff', '#2f9e55', { round: 12 }));
      at(f, x, TY + 4.6, z, g);
    });
    // ножницы
    const sc = new T.Group(); at(sc, -50, TY + 0.5, 38, g); sc.rotation.y = 0.5;
    [-0.35, 0.35].forEach(a => { const bl = box(10, 0.4, 1.0, C.STEEL); bl.rotation.y = a; at(bl, 4, 0, 0, sc); });
    [-1, 1].forEach(s => { const rg = kit.mesh(new T.TorusGeometry(1.6, 0.45, 8, 20), 0xe0473a, { hull: true, edges: false }); rg.rotation.x = Math.PI / 2; at(rg, -2.6, 0, s * 1.8, sc); });
    // клавиши порядка
    h.key(g, -8, 38, 15, 6, 'по заряду Z', d.order === 'z' ? 0x2f6fd8 : 0x5d6b88, 'ord-z', '#fff', { on: d.order === 'z' });
    h.key(g, 10, 38, 15, 6, 'по массе', d.order === 'mass' ? 0xe08a00 : 0x5d6b88, 'ord-mass', '#fff', { on: d.order === 'mass' });
    h.key(g, 30, 38, 15, 6, 'склеить', 0x5d6b88, 'cuts0');
    // плавный переезд карточек на новые места
    const prev = MEM.law || {}, t0 = performance.now();
    MEM.law = pos;
    kit.onFrame(() => {
      const k = kit.reduce ? 1 : ease((performance.now() - t0) / 650);
      for (const c of cards) {
        const p = prev[c.zz] || [c.x, c.z];
        const lift = Math.sin(Math.PI * k) * (p[0] !== c.x || p[1] !== c.z ? 3 : 0);
        c.cg.position.set(p[0] + (c.x - p[0]) * k, TY + 0.35 + lift, p[1] + (c.z - p[1]) * k);
      }
    });
    tag(v3(0, TY + 9, z0 - rd / 2 - 3), nr > 1 ? 'Строки таблицы' : 'Лента элементов', `строк ${nr} · ровных столбцов ${d.ok} из ${ml}`, d.done);
    if (d.order === 'mass' && pos[18] && pos[19]) tag(v3(pos[19][0], TY + 5, pos[19][1]), 'K 39,10 < Ar 39,95', 'по массе калий раньше', true);
    else if (nr === 1) tag(v3(-50, TY + 5, 38), 'Ножницы', 'нажмите на карточку — разрез');
  };

  // стенд-таблица из блоков: { wg, pos(r,c) → локальная точка, cellGroup }
  function wallStand(kit, h, g, o) {
    const { T, at, box, cyl, C } = kit;
    const { cols, rows, step, cs } = o, W = cols * step + 16, Hh = rows * step + 11;
    // основание
    at(box(W + 4, 2.4, 10, C.WOOD2), 0, TY + 1.2, o.z + 1, g);
    const wg = new T.Group(); at(wg, 0, TY + 2.2, o.z, g); wg.rotation.x = -(o.tilt ?? 0.16);
    at(box(W, Hh, 1.6, 0x3b4a66), 0, Hh / 2, -0.8, wg);
    at(box(W + 1.2, 1.2, 2.2, C.WOOD), 0, Hh + 0.4, -0.6, wg);
    const xC = c => (c - (cols - 1) / 2) * step + 3, yR = r => 2.2 + (rows - 1 - r + 0.5) * step;
    if (o.heads) o.heads.forEach((s, c) => { const p = h.canvasPlane(step * 0.95, 3.8, 160, 64, (x, a, b) => h.textLines(x, a, b, [s], '#c9d3e6', null)); at(p, xC(c), yR(0) + step / 2 + 2.6, 0.05, wg); });
    if (o.rowsLab) o.rowsLab.forEach((s, r) => { const p = h.canvasPlane(4, 4, 64, 64, (x, a, b) => h.textLines(x, a, b, [String(s)], '#c9d3e6', null)); at(p, xC(0) - step / 2 - 2.6, yR(r), 0.05, wg); });
    return { wg, xC, yR, W, Hh };
  }
  // блок-клетка на стенде
  function cellBlock(kit, h, parent, x, y, cs, col, face, o = {}) {
    const { T, at, box } = kit;
    const cg = new T.Group(); at(cg, x, y, o.out || 0, parent);
    at(box(cs, cs, o.th || 1.8, col, o.boxO), 0, 0, (o.th || 1.8) / 2, cg);
    const f = cardFace(h, cs * 0.94, cs * 0.94, face); at(f, 0, 0, (o.th || 1.8) + 0.04, cg);
    if (o.ring) { const fr = box(cs + 1.2, cs + 1.2, 0.8, o.ring, { edges: false }); at(fr, 0, 0, 0.3, cg); }
    return cg;
  }
  // модель атома: ядро и слои-орбиты с электронами (вращаются)
  function atomModel(kit, h, parent, x, y, z, sh, sc, o = {}) {
    const { T, at, cyl, C } = kit;
    const ag = new T.Group(); at(ag, x, y, z, parent); ag.rotation.y = 0.55;
    const nuc = h.ball(2.2 * sc, 0xe5533f); at(nuc, 0, 0, 0, ag);
    const el = [];
    sh.forEach((n, k) => {
      const r = (4.4 + 3.4 * k) * sc, outer = k === sh.length - 1;
      const tor = kit.mesh(new T.TorusGeometry(r, 0.16, 6, 64), outer ? 0xffb547 : 0x5d6b88, { edges: false, shadow: false }); at(tor, 0, 0, 0, ag);
      for (let i = 0; i < n; i++) { const e = h.ball(0.62 * Math.max(0.8, sc), outer ? 0xffb547 : 0x72d4e8, { seg: 12, seg2: 10 }); at(e, 0, 0, 0, ag); el.push({ e, r, k, a: i * 2 * Math.PI / n }); }
    });
    const place = t => el.forEach(q => { const a = q.a + (kit.reduce ? 0 : t / (1.6 + 0.7 * q.k)); q.e.position.set(Math.cos(a) * q.r, Math.sin(a) * q.r, 0); });
    place(0); kit.onFrame((dt, t) => place(t));
    return { ag, R: (4.4 + 3.4 * (sh.length - 1)) * sc };
  }

  // ===== 2. Периоды и группы: стенд таблицы 4×8, атом-загадка на подставке =====
  SC['chtb-pg'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const W = wallStand(kit, h, g, { cols: 8, rows: 4, step: 9.6, cs: 8.8, z: -26, tilt: 0.32, heads: ROM.slice(1).map(s => s + 'A'), rowsLab: [1, 2, 3, 4] });
    d.els.forEach(e => {
      const on = d.placed.includes(e.z), last = d.last === e.z;
      const cg = cellBlock(kit, h, W.wg, W.xC(e.g - 1), W.yR(e.p - 1), 8.8, on ? 0x2f9e55 : 0x56688f,
        on ? { bg: '#dff5e6', s: e.s, z: e.z, fg: '#1b5e34', sub: '#2f7a4a' } : { bg: '#2a3550', s: '?', z: null, fg: '#56688f', border: '#8b96ad', bw: 4 },
        { th: on ? 2.4 : 1.2, ring: last ? 0xffd166 : null });
      clickable(cg, 'c-' + e.z);
    });
    // подставка с атомом-загадкой
    if (d.cur) {
      const ax = -34, az = 20, sc = 1.25, R = (4.4 + 3.4 * (d.cur.sh.length - 1)) * sc, ay = TY + 4 + R + 2;
      at(box(18, 2, 12, C.WOOD2), ax, TY + 1, az, g);
      at(cyl(0.6, ay - TY - 2 - R + 1, C.STEEL, { edges: false }), ax, TY + 2 + (ay - TY - 2 - R + 1) / 2, az, g);
      atomModel(kit, h, g, ax, ay, az, d.cur.sh, sc);
      const lb = h.canvasPlane(14, 3.6, 300, 76, (x, a, b) => h.textLines(x, a, b, ['заряд ядра +' + d.cur.z], '#1b1610', '#fff6e6', { round: 10 }));
      lb.rotation.x = -0.5; at(lb, ax, TY + 2.3, az + 6.2, g);
      tag(v3(ax, ay + R + 2, az), `Атом-загадка ${d.mi} из ${d.total}`, 'слои: ' + d.cur.sh.join(', '));
    } else {
      // все найдены: кубок-звезда
      at(box(16, 2, 10, C.WOOD2), -30, TY + 1, 22, g);
      const st = h.ball(4, 0xffd166); at(st, -30, TY + 7, 22, g);
      at(h.glow(0xffd166, 24, 0.4), -30, TY + 7, 22, g);
      tag(v3(-30, TY + 14, 22), 'Все загадки', 'разгаданы ✓', true);
    }
    // табличка подсказки
    const pl = h.canvasPlane(40, 10, 640, 160, (x, a, b) => h.textLines(x, a, b, [{ t: 'число слоёв → период', c: '#1b1610' }, { t: 'e⁻ на внешнем (оранжевом) → группа', c: '#b26200' }], '#1b1610', '#fff6e6', { round: 14 }));
    pl.rotation.x = -Math.PI / 2 + 0.25; at(pl, 22, TY + 1.6, 30, g);
    at(box(42, 1.2, 12, C.WOOD), 22, TY + 0.6, 30, g);
    h.key(g, 48, 41, 18, 5.5, 'начать заново', 0x5d6b88, 'restart2');
    tag(v3(0, TY + 46, -32), 'Таблица: периоды 1–4', `найдено ${d.found} из ${d.total}`, d.found === d.total);
  };

  // образец простого вещества для проверки проводимости
  const SAMPLE = {
    H: { k: 'gas', c: 0xeef4fb, t: 'газ водород' }, He: { k: 'gas', c: 0xeef4fb, t: 'газ гелий' }, N: { k: 'gas', c: 0xeef4fb, t: 'газ азот' },
    O: { k: 'gas', c: 0xe9f3ff, t: 'газ кислород' }, F: { k: 'gas', c: 0xf3f0a0, t: 'газ фтор' }, Ne: { k: 'gas', c: 0xffc8b0, t: 'газ неон' },
    Cl: { k: 'gas', c: 0xc8e86a, t: 'газ хлор' }, Ar: { k: 'gas', c: 0xeef4fb, t: 'газ аргон' },
    Li: { k: 'oil', c: 0xd9dee6, t: 'под керосином' }, Na: { k: 'oil', c: 0xd9dee6, t: 'под керосином' }, K: { k: 'oil', c: 0xd9dee6, t: 'под керосином' },
    Be: { k: 'metal', c: 0xc9ced8, t: 'серый блеск' }, Mg: { k: 'metal', c: 0xdfe3ea, t: 'серебристый' }, Al: { k: 'metal', c: 0xe6e9ee, t: 'серебристый' }, Ca: { k: 'metal', c: 0xe2e2da, t: 'серебристый' },
    B: { k: 'lump', c: 0x4a3a32, t: 'тёмные кусочки' }, C: { k: 'graph', c: 0x3a3d44, t: 'графит' }, Si: { k: 'cryst', c: 0x6d7a8c, t: 'серый кристалл' },
    P: { k: 'powder', c: 0xb8402e, t: 'красный фосфор' }, S: { k: 'powder', c: 0xf2d33a, t: 'жёлтый порошок' },
  };
  // проводимость простого вещества: 0 — нет, 1 — металл; графит проводит, кремний — полупроводник
  const COND = z => ({ 3: 1, 4: 1, 11: 1, 12: 1, 13: 1, 19: 1, 20: 1, 6: 0.55, 14: 0.12 }[z] || 0);
  function sample(kit, h, parent, x, z, s) {
    const { T, at, box, cyl, C } = kit;
    const sg = new T.Group(); at(sg, x, TY, z, parent);
    const S = SAMPLE[s] || SAMPLE.H;
    at(box(10, 1.2, 8, 0xe2e7ee), 0, 0.6, 0, sg);
    const y0 = 1.2;
    if (S.k === 'gas') {
      const amp = h.ball(3.4, S.c, { mat: h.ownMat(S.c, { transparent: true, opacity: 0.5, depthWrite: false }) }); at(amp, 0, y0 + 4.2, 0, sg);
      at(cyl(0.6, 2.4, 0xd8eef8, { edges: false, matOpt: { transparent: true, opacity: 0.6 } }), 0, y0 + 8.4, 0, sg);
      at(cyl(2.2, 1, C.DARK), 0, y0 + 0.5, 0, sg);
      [-1, 1].forEach(sx => at(box(1.2, 1.2, 1.2, C.STEEL), sx * 3.6, y0 + 4.2, 0, sg));
      return { top: y0 + 9.6, cx: 3.9, cy: y0 + 4.2, sg };
    }
    if (S.k === 'oil') {
      const w = new T.Mesh(kit.keep(new T.CylinderGeometry(4, 4, 8, 28, 1, true)), h.glassMat(0xd8eef8, 0.3)); at(w, 0, y0 + 4, 0, sg); w.add(new T.Mesh(w.geometry, kit.hullMat));
      at(cyl(3.7, 5.5, 0xf5e6a8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.45 } }), 0, y0 + 2.9, 0, sg);
      const cb = box(3, 2.2, 3, S.c); cb.rotation.y = 0.4; at(cb, 0, y0 + 1.4, 0, sg);
      at(cyl(4.3, 1, 0x2c3240), 0, y0 + 8.5, 0, sg);
      return { top: y0 + 9, cx: 4.1, cy: y0 + 3, sg, jar: true };
    }
    if (S.k === 'metal' || S.k === 'graph' || S.k === 'cryst') {
      const cb = box(5.4, 5.4, 5.4, S.c); at(cb, 0, y0 + 2.7, 0, sg);
      if (S.k !== 'graph') {
        const hl = box(4.4, 0.6, 0.05, 0xffffff, { edges: false, shadow: false }); hl.rotation.z = 0.6; at(hl, 0, y0 + 3.2, 2.73, sg);
        const hl2 = box(0.05, 0.6, 3.6, 0xffffff, { edges: false, shadow: false }); hl2.rotation.x = 0.6; at(hl2, 2.73, y0 + 3.4, 0, sg);
      }
      return { top: y0 + 5.4, cx: 2.7, cy: y0 + 2.7, sg };
    }
    if (S.k === 'lump') { for (let i = 0; i < 5; i++) { const c = kit.mesh(new T.IcosahedronGeometry(1.4, 0), S.c, { edgeAngle: 20 }); c.rotation.set(rnd(i) * 3, rnd(i + 2) * 3, 0); at(c, (i - 2) * 1.6, y0 + 1.1 + (i % 2) * 0.8, (rnd(i + 4) - 0.5) * 2, sg); } return { top: y0 + 3.5, cx: 4, cy: y0 + 1.5, sg }; }
    const ds = h.dish(sg, 0, y0, 0, 4, 0xf7f3ea);
    h.heap(sg, 0, y0 + 0.4, 0, 3.2, 2.2, S.c, 10, { s: 0.6 });
    return { top: y0 + 3, cx: 3.4, cy: y0 + 1.2, sg };
  }

  // ===== 3. Металлы и неметаллы: стенд с кистями, образец в проверке проводимости =====
  SC['chtb-metals'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, cable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const W = wallStand(kit, h, g, { cols: 8, rows: 4, step: 9.6, cs: 8.8, z: -27, tilt: 0.32, heads: ROM.slice(1).map(s => s + 'A'), rowsLab: [1, 2, 3, 4] });
    d.els.forEach(e => {
      const p = d.paint[e.z], sel = d.sel === e.z;
      const col = p === 'm' ? 0xc6ccd6 : p === 'n' ? 0x4fae5a : 0x3a4762;
      const face = p === 'm' ? { bg: '#eef1f6', s: e.s, z: e.z, fg: '#2c3240' } : p === 'n' ? { bg: '#d6f2d8', s: e.s, z: e.z, fg: '#1b5e34', sub: '#2f7a4a' } : { bg: '#1c2536', s: e.s, z: e.z, fg: '#c9d3e6', sub: '#7d89a3' };
      const cg = cellBlock(kit, h, W.wg, W.xC(e.g - 1), W.yR(e.p - 1), 8.8, col, face, { th: p ? 2.4 : 1.4, ring: sel ? 0xffd166 : null });
      clickable(cg, 'c-' + e.z);
    });
    // граница металл/неметалл: ступенька от бора вниз вправо (после полной раскраски)
    if (d.border) {
      const x2 = W.xC(1) + 5.2, x3 = W.xC(2) + 5.2, y1 = W.yR(1) + 5.2, y2 = W.yR(2) + 5.2, y3 = W.yR(3) - 5.2;
      const segs = [[x2, y1, x2, y2], [x2, y2, x3, y2], [x3, y2, x3, y3]];
      segs.forEach(([a, b, c, e]) => { const m = box(Math.abs(c - a) + 0.9, Math.abs(e - b) + 0.9, 0.9, 0xff9f1c, { edges: false }); at(m, (a + c) / 2, (b + e) / 2, 3, W.wg); });
    }
    // кисти в банках с краской
    [['m', 'металл', 0xc6ccd6], ['n', 'неметалл', 0x4fae5a]].forEach(([k, nm, col], i) => {
      const x = -52 + i * 12, z = 32, pg = new T.Group(); at(pg, x, TY, z, g); clickable(pg, 'br-' + k);
      if (d.brush === k) h.ring(pg, 0, 0, 5.2, 0xffd166, 0.13);
      at(cyl(4, 5, 0xf0f2f6, { seg: 28 }), 0, 2.5, 0, pg);
      at(cyl(3.6, 0.3, col, { edges: false }), 0, 4.9, 0, pg);
      const lb = h.canvasPlane(6.6, 2.4, 220, 80, (x2, a, b) => h.textLines(x2, a, b, [nm], '#1b1610', '#fff6e6')); at(lb, 0, 2.6, 4.05, pg);
      if (d.brush === k) {
        const br = new T.Group(); at(br, 0.8, 5, 0, pg); br.rotation.z = -0.35;
        at(cyl(0.45, 10, C.WOOD, { edges: false }), 0, 5.5, 0, br); at(cyl(0.8, 2, C.STEEL, { edges: false }), 0, 0.8, 0, br); at(cyl(1.0, 2.2, col, { r2: 0.75, edges: false }), 0, -0.6, 0, br);
      }
    });
    // проверка проводимости: батарейка, лампочка, щупы на образце
    const el = d.sel ? d.els[d.sel - 1] : null;
    if (el) {
      const tested = !!d.paint[el.z]; // ток проверяем только после того, как ученик сам раскрасил клетку — иначе лампочка подсказывает ответ
      const cnd = tested ? COND(el.z) : 0, I = cnd > 0.3 ? cnd : 0;
      const bat = kit.cells(2, 3); const bn = kit.placeOn(bat, v3(34, 0, -6), 0, 'bat');
      const bl = kit.bulb({ glow: cnd > 0.5 ? 1.25 : cnd > 0.3 ? 0.5 : cnd > 0.05 ? 0.12 : 0, value: '' }); const ln = kit.placeOn(bl, v3(18, 0, 32), 0, 'bulb');
      const sm = sample(kit, h, g, 46, 30, el.s);
      const pA = v3(46 - sm.cx - 0.6, TY + sm.cy, 30), pB = v3(46 + sm.cx + 0.6, TY + sm.cy, 30);
      [pA, pB].forEach((p, i) => { const pr = cyl(0.5, 4, i ? C.DARK : 0xe0473a, { edges: false }); pr.rotation.z = Math.PI / 2; at(pr, p.x + (i ? 2 : -2), p.y, p.z, g); });
      cable(bn.tout, ln.tin, C.WIRE.plus, I, { r: 0.6, lift: 4 });
      cable(ln.tout, v3(pA.x - 4, pA.y, pA.z), C.WIRE.plus, I, { r: 0.6, lift: 2 });
      cable(v3(pB.x + 4, pB.y, pB.z), bn.tin, C.WIRE.minus, I, { r: 0.6, lift: 4, via: [v3(58, 1.4, 18), v3(56, 1.4, -2)] });
      const word = !tested ? 'сначала раскрасьте клетку' : cnd > 0.5 ? (el.z === 6 ? 'горит — графит проводит' : 'горит — проводит ток') : cnd > 0.05 ? 'еле светится — полупроводник' : 'не горит — ток не идёт';
      tag(v3(46, TY + sm.top + 4, 30), `${el.s} · ${el.name}`, SAMPLE[el.s].t + (d.paint[el.z] ? (d.paint[el.z] === 'm' ? ' · металл' : ' · неметалл') : ''));
      tag(v3(18, TY + 21, 31), 'Лампочка', word, cnd > 0.5);
      // строение атома выбранного элемента
      const aR = (4.4 + 3.4 * (el.sh.length - 1)) * 0.95;
      atomModel(kit, h, g, -22, TY + 5 + aR, 18, el.sh, 0.95);
      at(box(14, 2, 9, C.WOOD2), -22, TY + 1, 18, g);
      at(cyl(0.5, 3.5, C.STEEL, { edges: false }), -22, TY + 3.7, 18, g);
      const lb = h.canvasPlane(13, 3.4, 320, 84, (x2, a, b) => h.textLines(x2, a, b, ['внешних e⁻: ' + el.out], '#1b1610', '#fff6e6', { round: 10 }));
      lb.rotation.x = -0.5; at(lb, -22, TY + 2.3, 22.8, g);
    } else {
      const pl = h.canvasPlane(40, 9, 640, 144, (x, a, b) => h.textLines(x, a, b, [{ t: 'нажмите на клетку —', c: '#1b1610' }, { t: 'образец встанет в проверку тока', c: '#5d6b88' }], '#1b1610', '#fff6e6', { round: 14 }));
      pl.rotation.x = -Math.PI / 2 + 0.25; at(pl, 18, TY + 1.6, 28, g);
      at(box(42, 1.2, 11, C.WOOD), 18, TY + 0.6, 28, g);
    }
    tag(v3(0, TY + 46, -33), 'Металлы и неметаллы', `раскрашено ${d.painted} из 20`, d.painted === 20);
  };

  // ===== 4. Предсказываем неоткрытый элемент: стенд-фрагмент 3×4, табличка прогноза, найденный образец =====
  SC['chtb-predict'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const W = wallStand(kit, h, g, { cols: 4, rows: 3, step: 17, cs: 15.6, z: -24, tilt: 0.14, heads: d.heads, rowsLab: [3, 4, 5] });
    d.cells.forEach((row, r) => row.forEach((c, ci) => {
      const x = W.xC(ci), y = W.yR(r);
      if (!c) { const fr = kit.box(15.6, 15.6, 0.4, 0x56688f, { edges: true }); fr.material.transparent = true; fr.material.opacity = 0.25; at(fr, x, y, 0.3, W.wg); return; }
      if (c.t) {
        const face = d.solved ? { bg: '#dff5e6', s: c.s, z: null, m: fmt(c.m, 2) + ' · ' + fmt(c.d, 2), fg: '#1b5e34', sub: '#2f7a4a' } : { bg: '#fff1d6', s: '?', z: null, m: d.ekaS, fg: '#d97a00', sub: '#b26200' };
        const cg = cellBlock(kit, h, W.wg, x, y, 15.6, d.solved ? 0x2f9e55 : 0xffb547, face, { th: 2.4 });
        if (!d.solved) { const gl = h.glow(0xffb547, 30, 0.35); at(gl, 0, 0, 3, cg); }
        clickable(cg, 'p-' + c.s); return;
      }
      const sel = d.nb.includes(c.s);
      const cg = cellBlock(kit, h, W.wg, x, y, 15.6, sel ? 0x2f7fa8 : 0x3a4762,
        { bg: sel ? '#dbf0fb' : '#eef1f6', s: c.s, z: null, m: fmt(c.m, 2) + ' · ' + fmt(c.d, 2), fg: '#1b1610', sub: '#5d6b88' },
        { th: sel ? 4 : 1.8, ring: sel ? 0x72d4e8 : null });
      clickable(cg, 'p-' + c.s);
    }));
    // табличка прогноза на подставке
    const PX = -8, PZ = 22;
    at(box(40, 1.6, 9, C.WOOD2), PX, TY + 0.8, PZ, g);
    const sign = new T.Group(); at(sign, PX, TY + 1.6, PZ, g); sign.rotation.x = -0.35;
    at(box(38, 15, 1.2, 0x26324a), 0, 7.5, 0, sign);
    const okN = d.nb.length === 4, okO = d.ox === d.oxRight;
    const lines = [
      { t: 'ПРОГНОЗ · ' + d.eka.toUpperCase(), k: 0.5, c: '#ffd166' },
      { t: 'масса ≈ ' + (d.am != null ? fmt(d.am, 1) : '?') + '   ρ ≈ ' + (d.ad != null ? fmt(d.ad, 2) : '?') + ' г/см³', c: okN ? '#86e0a8' : '#e8ecf4' },
      { t: 'соседей ' + d.nb.length + ' из 4 · оксид ' + (d.ox ? d.oxT : '?'), c: okO ? '#86e0a8' : d.ox ? '#ff8a73' : '#e8ecf4' },
    ];
    const pl = h.canvasPlane(36, 13, 720, 260, (x, a, b) => h.textLines(x, a, b, lines, '#e8ecf4', '#132018'));
    at(pl, 0, 7.5, 0.65, sign);
    // переключатель «?» и клавиши формул оксида
    h.key(g, -48, 30, 14, 5.6, '? эка-Al', d.tgt === 'Ga' ? 0xe08a00 : 0x5d6b88, 'tg-Ga', '#fff', { on: d.tgt === 'Ga' });
    h.key(g, -48, 38, 14, 5.6, '? эка-Si', d.tgt === 'Ge' ? 0xe08a00 : 0x5d6b88, 'tg-Ge', '#fff', { on: d.tgt === 'Ge' });
    d.oxes.forEach((o, i) => h.key(g, -26 + i * 12.5, 38, 11, 5.6, o.t, d.ox === o.f ? (o.f === d.oxRight ? 0x2f9e55 : 0xc0563f) : 0xfff6e6, 'ox-' + o.f, d.ox === o.f ? '#fff' : '#1b1610'));
    // открытый элемент: образец
    if (d.solved) {
      const sx = 40, sz = 22;
      at(box(16, 1.2, 12, 0xe2e7ee), sx, TY + 0.6, sz, g);
      if (d.tgt === 'Ga') {
        const ds = h.dish(g, sx, TY + 1.2, sz, 5, 0xd8eef8, 0.5);
        const drop = h.ball(2.6, 0xd5dbe3); drop.scale.y = 0.45; at(drop, sx, TY + 2.4, sz, g);
        const hl = h.ball(0.8, 0xffffff, { hull: false }); hl.scale.y = 0.4; at(hl, sx - 0.8, TY + 3.3, sz + 0.6, g);
      } else {
        const ing = box(9, 3.2, 4.4, 0x8a93a3); at(ing, sx, TY + 2.8, sz, g);
        const hl = box(7, 0.4, 0.05, 0xffffff, { edges: false, shadow: false }); hl.rotation.z = 0.3; at(hl, sx, TY + 3.2, sz + 2.24, g);
      }
      tag(v3(sx, TY + 9, sz), `${d.real.s} · ${d.real.n}`, `открыт в ${d.real.year} · ${fmt(d.real.m, 2)} и ${fmt(d.real.d, 2)} г/см³`, true);
    }
    tag(v3(PX, TY + 21, PZ - 3), 'Прогноз по соседям', okN && okO ? 'готов ✓' : 'сверху, снизу, слева, справа', okN && okO);
  };

  // =====================================================================================
  //                              МОЛЬ И РАСЧЁТЫ (labs/chem-mole)
  // =====================================================================================
  const ACOL = { H: 0xeef2f8, C: 0x4f586d, N: 0x4d7cf0, O: 0xe5533f, Cl: 0x5fc46a, Na: 0xb88cf0, Ca: 0x9fd27a, S: 0xe6c63a, Mg: 0x7ad1b5 };
  const ARAD = { H: 0.8, C: 1.2, N: 1.15, O: 1.15, Cl: 1.4, Na: 1.45, Ca: 1.5, S: 1.35 };
  const MOLX = {
    H2: [['H', -0.7, 0, 0], ['H', 0.7, 0, 0]], O2: [['O', -1.0, 0, 0], ['O', 1.0, 0, 0]], N2: [['N', -1.0, 0, 0], ['N', 1.0, 0, 0]],
    H2O: [['O', 0, 0.3, 0], ['H', -1.25, -0.5, 0], ['H', 1.25, -0.5, 0]], CO2: [['C', 0, 0, 0], ['O', -2.0, 0, 0], ['O', 2.0, 0, 0]],
  };
  function molecule(kit, h, f, s) {
    const { T, at } = kit, m = new T.Group(), A = MOLX[f] || [['C', 0, 0, 0]];
    A.forEach(([el, x, y, z]) => at(h.ball(ARAD[el] || 1.2, ACOL[el] || 0xcccccc, { seg: 14, seg2: 10 }), x, y, z, m));
    for (let i = 1; i < A.length; i++) h.rodAB(m, h.v3(A[0][1], A[0][2], A[0][3]), h.v3(A[i][1], A[i][2], A[i][3]), 0.28, 0x9aa3b2, { hull: false });
    m.scale.setScalar(s); return m;
  }
  // деревянный ящик «моль»
  function crate(kit, h, parent, x, z, w, hh, dd, label, f, ms) {
    const { T, at, box, C } = kit;
    const cg = new T.Group(); at(cg, x, TY, z, parent);
    at(box(w, hh, dd, C.WOOD), 0, hh / 2, 0, cg);
    [-1, 1].forEach(s => at(box(w + 0.3, 0.8, 0.5, C.WOOD2, { edges: false }), 0, hh / 2 + s * hh * 0.28, dd / 2 + 0.1, cg));
    const lb = h.canvasPlane(w * 0.8, hh * 0.42, 260, Math.round(260 * hh * 0.42 / (w * 0.8)), (x2, a, b) => h.textLines(x2, a, b, [label], '#1b1610', '#fff6e6', { round: 8 }));
    at(lb, 0, hh / 2, dd / 2 + 0.42, cg);
    const mol = molecule(kit, h, f, ms); at(mol, 0, hh + 1.6 * ms + 0.4, 0, cg);
    return { cg, mol };
  }

  // ===== 5. Моль и число Авогадро: витрина «по 1 моль» на весах, ящики-порции, склад, счётчик частиц =====
  SC['chtb-mole'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    // витрина: порции ровно по 1 моль на весах
    const shelf = [
      { x: -45, m: '18,0 г', l: '1 моль H₂O' }, { x: -15, m: '58,5 г', l: '1 моль NaCl' },
      { x: 15, m: '56,0 г', l: '1 моль Fe' }, { x: 45, m: '342 г', l: '1 моль сахара' },
    ];
    shelf.forEach((s, i) => {
      const sc = h.scale(g, s.x, -29, 17, 13, { txt: s.m });
      const y = sc.top, z = sc.pz;
      if (i === 0) { const bk = h.beaker(g, s.x, y + 0.3, z, 3.2, 6.5); const w = h.liquid(g, s.x, y + 0.55, z, 2.95, 0x6fb6e8, 0.55); w.set(2.4, y + 0.55); }
      else if (i === 1) { h.dish(g, s.x, y + 0.3, z, 4.4); h.heap(g, s.x, y + 0.7, z, 3.4, 2.4, 0xf7f7f2, 12, { s: 0.7 }); }
      else if (i === 2) { const cb = box(3.4, 3.4, 3.4, 0x6b717c); at(cb, s.x, y + 2.0, z, g); const hl = box(2.6, 0.4, 0.05, 0xc9ced8, { edges: false, shadow: false }); hl.rotation.z = 0.6; at(hl, s.x, y + 2.3, z + 1.73, g); }
      else { for (let k = 0; k < 14; k++) { const lv = k < 9 ? 0 : k < 13 ? 1 : 2, j = k < 9 ? k : k < 13 ? k - 9 : 0, n = lv === 0 ? 3 : lv === 1 ? 2 : 1; const cx = ((j % n) - (n - 1) / 2) * 2.1, cz = (Math.floor(j / n) - (n - 1) / 2) * 2.1; at(box(1.9, 1.9, 1.9, 0xfbfbf6), s.x + cx, y + 1.25 + lv * 1.9, z + cz, g); } }
      const lb = h.canvasPlane(16, 3.6, 360, 80, (x2, a, b) => h.textLines(x2, a, b, [s.l], '#1b1610', '#fff6e6', { round: 8 }));
      lb.rotation.x = -0.5; at(lb, s.x, TY + 1.4, -29 + 9.0, g);
    });
    tag(v3(0, TY + 15, -30), 'По 1 моль на весах', 'в каждой порции 6,02·10²³ частиц');
    // площадка порции
    const A = { x0: -50, x1: 22, z0: -13, z1: 20 };
    [[A.x0, A.z0, A.x1, A.z0], [A.x0, A.z1, A.x1, A.z1], [A.x0, A.z0, A.x0, A.z1], [A.x1, A.z0, A.x1, A.z1]].forEach(([a, b, c, e]) => at(box(Math.abs(c - a) + 0.6, 0.2, Math.abs(e - b) + 0.6, 0x72d4e8, { edges: false, shadow: false }), (a + c) / 2, TY + 0.1, (b + e) / 2, g));
    const mols = [];
    for (let i = 0; i < d.F; i++) { const c = crate(kit, h, g, -42 + i * 15.6, -4, 13, 7, 10, '1 моль', d.f, 1.05); clickable(c.cg, 'cf-' + i); mols.push(c.mol); }
    for (let j = 0; j < d.Q; j++) { const c = crate(kit, h, g, -44 + j * 9, 13, 6.4, 4, 5.6, '¼', d.f, 0.6); clickable(c.cg, 'cq-' + j); mols.push(c.mol); }
    if (!d.F && !d.Q) { const pl = h.canvasPlane(40, 6, 640, 96, (x, a, b) => h.textLines(x, a, b, ['пусто — возьмите ящик со склада'], '#5d6b88', null)); pl.rotation.x = -Math.PI / 2; at(pl, -14, TY + 0.3, 3, g); }
    // склад
    at(box(22, 1.6, 34, C.WOOD2), 44, TY + 0.8, 4, g);
    for (let k = -1; k <= 1; k++) at(box(22, 0.4, 2.4, C.WOOD, { edges: false }), 44, TY + 1.8, 4 + k * 12, g);
    const s1 = crate(kit, h, g, 44, -4, 13, 7, 10, '1 моль', d.f, 1.05); s1.cg.position.y = TY + 1.6; clickable(s1.cg, 'tf'); mols.push(s1.mol);
    const s2 = crate(kit, h, g, 44, 13, 6.4, 4, 5.6, '¼', d.f, 0.6); s2.cg.position.y = TY + 1.6; clickable(s2.cg, 'tq'); mols.push(s2.mol);
    tag(v3(44, TY + 16, -4), 'Склад', 'нажмите — добавить ящик');
    // счётчик частиц
    const cg = new T.Group(); at(cg, -14, TY, 32, g); cg.rotation.x = -0.45;
    at(box(56, 11, 2.4, 0x26324a), 0, 5.5, 0, cg);
    const disp = h.screen(53, 9, '', '#86e0a8', 900, 160, '#0c1a14'); at(disp, 0, 5.5, 1.25, cg);
    at(box(58, 1.4, 6, C.DARK), -14, TY + 0.7, 33, g);
    const prev = MEM.mole && MEM.mole.f === d.f ? MEM.mole.n : d.n, t0 = performance.now();
    MEM.mole = { f: d.f, n: d.n };
    const atomsLine = n => d.at.map(([e, k]) => `${e}: ${sci(n * k)}`).join('  ');
    kit.onFrame((dt, t) => {
      const k = kit.reduce ? 1 : ease((performance.now() - t0) / 900), n = prev + (d.n - prev) * k;
      disp.userData.set(`N = ${sci(n)} молекул\nатомов  ${atomsLine(n)}`, k < 1 ? '#ffd166' : '#86e0a8');
      if (!kit.reduce) mols.forEach((m, i) => { m.rotation.y = t * 0.6 + i; });
    });
    // клавиши вещества
    d.subs.forEach((f, i) => h.key(g, 30 + i * 11, 40, 9.6, 5.6, low(f), d.f === f ? 0x2f6fd8 : 0x5d6b88, 's1-' + f, '#fff', { on: d.f === f }));
    tag(v3(-14, TY + 15, -4), `Порция ${low(d.f)}`, `n = ${fmtG(d.n)} моль` + (d.hit ? ' ✓ цель' : ''), d.hit);
  };

  // гирька-атом: латунное основание, цветная головка, знак и Ar сверху
  function weightAtom(kit, h, parent, x, y, z, e, ar, r, hh) {
    const { T, at, cyl } = kit;
    const wg = new T.Group(); at(wg, x, y, z, parent);
    at(cyl(r, hh * 0.75, ACOL[e] || 0xcccccc, { seg: 24 }), 0, hh * 0.375, 0, wg);
    at(cyl(r * 1.04, hh * 0.12, 0xd8b04a, { seg: 24 }), 0, hh * 0.06, 0, wg);
    const dark = ['C', 'N', 'O'].includes(e);
    const lb = h.canvasPlane(r * 1.8, r * 1.8, 128, 128, (x2, a, b) => h.textLines(x2, a, b, [{ t: e, k: 0.78, w: 700 }, { t: fmtG(ar, 1), k: 0.6 }], dark ? '#ffffff' : '#1b1610', null));
    lb.rotation.x = -Math.PI / 2; at(lb, 0, hh * 0.75 + 0.03, 0, wg);
    return wg;
  }
  // содержимое банки 1 моль
  function jarFill(kit, h, parent, f) {
    const { T, at, box } = kit;
    if (f === 'H2O') { const w = h.liquid(parent, 0, 0.5, 0, 3.9, 0x6fb6e8, 0.55); w.set(1.6, 0.5); }
    else if (f === 'H2SO4') { const w = h.liquid(parent, 0, 0.5, 0, 3.9, 0xf2ecd2, 0.7); w.set(3.4, 0.5); }
    else if (f === 'CO2') { for (let i = 0; i < 6; i++) { const c = box(2, 1.4, 2, 0xf4f6fa); c.rotation.y = rnd(i) * 3; at(c, (rnd(i + 2) - 0.5) * 4, 1.2 + (i > 3 ? 1.4 : 0), (rnd(i + 5) - 0.5) * 4, parent); } }
    else if (f === 'NaCl') h.heap(parent, 0, 0.5, 0, 3.6, 2.6, 0xf7f7f2, 12, { s: 0.6 });
    else for (let i = 0; i < 9; i++) { const c = kit.mesh(new T.IcosahedronGeometry(1.1, 0), 0xf4f4f0, { edgeAngle: 20 }); c.rotation.set(rnd(i) * 3, rnd(i + 3) * 3, 0); at(c, (rnd(i + 7) - 0.5) * 5, 1.4 + Math.floor(i / 4) * 1.5, (rnd(i + 8) - 0.5) * 5, parent); }
  }

  // ===== 6. Молярная масса: рычажные весы, банка с 1 моль, гирьки-атомы =====
  SC['chtb-molar'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const BX = -2, BZ = -10, PY = TY + 34, ARM = 25, DROP = 17;
    at(box(34, 2.4, 12, C.WOOD2), BX, TY + 1.2, BZ, g);
    at(cyl(1.4, PY - TY - 2.4, C.STEEL, { edges: false }), BX, TY + 2.4 + (PY - TY - 2.4) / 2, BZ, g);
    // шкала стрелки
    const arc = h.canvasPlane(12, 5, 240, 100, (x, a, b) => { x.fillStyle = '#f7f3ea'; x.beginPath(); x.roundRect(2, 2, a - 4, b - 4, 10); x.fill(); x.strokeStyle = '#1b1610'; x.lineWidth = 3; for (let k = -4; k <= 4; k++) { const xx = a / 2 + k * 24; x.beginPath(); x.moveTo(xx, 10); x.lineTo(xx, k === 0 ? 54 : 34); x.stroke(); } x.fillStyle = '#2f9e55'; x.fillRect(a / 2 - 3, 8, 6, 50); });
    at(arc, BX, PY - 15, BZ + 1.6, g);
    const beam = new T.Group(); at(beam, BX, PY, BZ, g);
    at(box(ARM * 2 + 4, 2.2, 2.0, 0x56688f), 0, 0, 0, beam);
    at(cyl(1.6, 3, 0xffb547, { seg: 16 }), 0, 0, 0, beam).rotation.x = Math.PI / 2;
    const needle = box(0.5, 13, 0.5, 0xe0473a, { edges: false }); at(needle, 0, -7, 1.3, beam);
    const pans = [-1, 1].map(s => {
      const pg = new T.Group(); g.add(pg);
      at(cyl(0.7, 1.6, C.STEEL), 0, 0, 0, pg);
      [0, 1, 2].forEach(k => { const a = k * 2.094 + 0.5; h.rodAB(pg, v3(0, 0, 0), v3(Math.cos(a) * 9, -DROP + 0.6, Math.sin(a) * 9), 0.22, 0x3b4a66, { hull: false }); });
      at(cyl(10, 0.8, 0x8b96ad, { seg: 40 }), 0, -DROP, 0, pg);
      return pg;
    });
    // левая чаша: банка с 1 моль вещества
    const jar = new T.Group(); at(jar, 0, -DROP + 0.4, 0, pans[0]);
    const jw = new T.Mesh(kit.keep(new T.CylinderGeometry(4.4, 4.4, 9, 28, 1, true)), h.glassMat(0xd8eef8, 0.3)); at(jw, 0, 4.5, 0, jar); jw.add(new T.Mesh(jw.geometry, kit.hullMat));
    at(cyl(4.4, 0.5, 0xd8eef8, { edges: false, matOpt: { transparent: true, opacity: 0.4 } }), 0, 0.25, 0, jar);
    at(cyl(4.7, 1.2, 0x56688f), 0, 9.4, 0, jar);
    jarFill(kit, h, jar, d.f);
    const jl = h.canvasPlane(7.4, 2.8, 240, 90, (x, a, b) => h.textLines(x, a, b, ['1 моль ' + low(d.f)], '#1b1610', '#fff6e6')); at(jl, 0, 6.2, 4.46, jar);
    // правая чаша: гирьки
    d.pan.forEach((e, k) => { const w = weightAtom(kit, h, pans[1], ((k % 4) - 1.5) * 4.4, -DROP + 0.4, (Math.floor(k / 4) - 0.5) * 4.6, e, d.ar[e], 1.9, 3.4); clickable(w, 'pw-' + k); });
    // лоток с гирьками
    at(box(104, 1.4, 12, C.WOOD), 0, TY + 0.7, 26, g);
    d.wts.forEach((e, i) => { const w = weightAtom(kit, h, g, -45 + i * 15, TY + 1.4, 26, e, d.ar[e], 3.3, 4.6); clickable(w, 'w-' + e); });
    d.subs.forEach((f, i) => h.key(g, -48 + i * 15, 40, 13.5, 5.6, low(f), d.f === f ? 0x2f6fd8 : 0x5d6b88, 's2-' + f, '#fff', { on: d.f === f }));
    h.key(g, 46, 40, 16, 5.6, 'снять всё', 0x5d6b88, 'clr');
    // наклон коромысла: плавно к цели
    const tgt = clamp((d.M - d.R) * 0.3, -12, 12) * Math.PI / 180;
    if (MEM.tilt == null) MEM.tilt = tgt;
    const tmp = v3(0, 0, 0);
    const place = () => { beam.rotation.z = MEM.tilt; beam.updateMatrixWorld(true); [-1, 1].forEach((s, i) => { tmp.set(s * ARM, 0, 0).applyMatrix4(beam.matrixWorld); pans[i].position.copy(tmp); }); };
    place();
    kit.onFrame(dt => { MEM.tilt = kit.reduce ? tgt : MEM.tilt + (tgt - MEM.tilt) * Math.min(1, dt * 4); place(); });
    const st = d.bal ? (d.same ? 'равновесие ✓' : 'массы равны, атомы не те') : d.R < d.M ? 'перевешивает банка' : 'перевешивают гирьки';
    tag(v3(BX - ARM, PY - DROP + 14, BZ), 'Банка: 1 моль ' + low(d.f), d.showM ? `M = ${fmtG(d.M, 1)} г/моль` : 'M = ?', d.showM && d.found);
    tag(v3(BX + ARM, PY - DROP + 9, BZ), 'Гирьки-атомы', `Σ Ar = ${fmtG(d.R, 1)}`);
    tag(v3(BX, PY + 5, BZ), 'Весы', st, d.bal && d.same);
  };

  // ===== 7. Молярный объём: цилиндр с поршнем, куб-эталон 22,4 л, мешки газов одного объёма =====
  const GASC = { H2: 0xeef2f8, N2: 0x4d7cf0, O2: 0xe5533f, CO2: 0x9aa6bd };
  SC['chtb-volume'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const CX = -44, CZ = 8, R = 7, K = 11, Y0 = TY + 3, HMAX = 3 * K + 2;
    at(box(20, 3, 18, C.DARK), CX, TY + 1.5, CZ, g);
    const wall = new T.Mesh(kit.keep(new T.CylinderGeometry(R, R, HMAX, 40, 1, true)), h.glassMat(0xd8eef8, 0.22)); at(wall, CX, Y0 + HMAX / 2, CZ, g); wall.add(new T.Mesh(wall.geometry, kit.hullMat));
    const rim = kit.mesh(new T.TorusGeometry(R, 0.3, 6, 40), 0xeef6fb, { edges: false }); rim.rotation.x = Math.PI / 2; at(rim, CX, Y0 + HMAX, CZ, g);
    // шкала в литрах
    for (let k = 1; k <= 6; k++) { const y = Y0 + k * K / 2, major = k % 2 === 0; const tk = box(major ? 2.4 : 1.4, 0.2, 0.1, 0x2c3240, { edges: false, shadow: false }); tk.rotation.y = 0.6; at(tk, CX + Math.sin(0.6) * (R + 0.05), y, CZ + Math.cos(0.6) * (R + 0.05), g); if (major) { const lb = h.canvasPlane(7, 2.2, 200, 64, (x, a, b) => h.textLines(x, a, b, [fmtG(k / 2 * 22.4, 1) + ' л'], '#1b1610', '#fff6e6', { round: 8 })); lb.rotation.y = 0.6; at(lb, CX + Math.sin(0.6) * (R + 4.2), y, CZ + Math.cos(0.6) * (R + 4.2), g); } }
    // газ, молекулы, поршень
    const gc = GASC[d.g] || 0xeef2f8;
    const gas = h.liquid(g, CX, Y0, CZ, R - 0.4, gc, 0.18);
    const pg = new T.Group(); at(pg, CX, Y0, CZ, g); clickable(pg, 'v+q');
    at(cyl(R - 0.3, 1.6, 0x56688f, { seg: 36 }), 0, 0.8, 0, pg);
    const rod = cyl(0.7, 1, C.STEEL, { edges: false }); at(rod, 0, 1.6, 0, pg);
    const grip = cyl(1.2, 12, 0xffb547); grip.rotation.z = Math.PI / 2; at(grip, 0, 8, 0, pg);
    const nM = Math.min(18, Math.round(d.n * 6)), mm = [];
    for (let i = 0; i < nM; i++) { const m = molecule(kit, h, d.g, 0.75); g.add(m); mm.push({ m, u: rnd(i + 1), v: rnd(i + 2), w: rnd(i + 3), ph: rnd(i + 4) * 6 }); }
    if (MEM.vol == null) MEM.vol = d.n;
    kit.onFrame((dt, t) => {
      MEM.vol = kit.reduce ? d.n : MEM.vol + (d.n - MEM.vol) * Math.min(1, dt * 5);
      const hh = MEM.vol * K; pg.position.y = Y0 + hh; gas.set(hh, Y0);
      const L = HMAX - hh + 5; rod.scale.y = L; rod.position.y = 1.6 + L / 2; grip.position.y = 1.6 + L + 0.6;
      mm.forEach((q, i) => {
        const j = kit.reduce ? 0 : 1, a = q.u * 6.28 + j * t * (0.6 + q.w), rr = (R - 2) * Math.sqrt(q.v);
        q.m.position.set(CX + Math.cos(a) * rr, Y0 + 1.2 + (hh - 2.4) * (0.5 + 0.45 * Math.sin(q.ph + j * t * (1.3 + q.u))), CZ + Math.sin(a) * rr);
        q.m.rotation.set(t * 1.3 + i, t * 0.9 + i, 0); q.m.visible = hh > 2.6;
      });
    });
    // куб-эталон 22,4 л (тот же масштаб, что и цилиндр: 1 моль = π·R²·K)
    const S3 = Math.cbrt(Math.PI * R * R * K), QX = -16, QZ = 26;
    const cube = new T.Group(); at(cube, QX, TY + S3 / 2, QZ, g); cube.rotation.y = 0.3;
    const fm = new T.Mesh(kit.keep(new T.BoxGeometry(S3, S3, S3)), h.glassMat(0xffd166, 0.12)); cube.add(fm);
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      at(box(0.5, S3, 0.5, 0xd8b04a, { edges: false }), a * S3 / 2, 0, b * S3 / 2, cube);
      at(box(S3, 0.5, 0.5, 0xd8b04a, { edges: false }), 0, a * S3 / 2, b * S3 / 2, cube);
      at(box(0.5, 0.5, S3, 0xd8b04a, { edges: false }), a * S3 / 2, b * S3 / 2, 0, cube);
    }
    const cl = h.canvasPlane(S3 * 0.86, 3.4, 320, 90, (x, a, b) => h.textLines(x, a, b, ['22,4 л'], '#1b1610', '#fff1d6', { round: 10 })); at(cl, 0, -S3 / 2 + 2.4, S3 / 2 + 0.3, cube);
    // мешки газов одного объёма
    const rB = 7.2 * Math.cbrt(Math.max(d.n, 0.02));
    d.gases.forEach((q, i) => {
      const x = -18 + i * 23, z = -22, sel = q.g === d.g, bg = new T.Group(); at(bg, x, 0, z, g); clickable(bg, 'g-' + q.g);
      at(box(14, 1.6, 10, sel ? 0xffd166 : 0xdfe4ec), 0, TY + 0.8, 0, bg);
      const bl = h.balloon(bg, 0, TY + 1.6, 0, Math.max(1.2, rB), GASC[q.g], d.n > 0 ? 0.55 : 0.8);
      const pl = h.canvasPlane(12, 3.6, 300, 90, (x2, a, b) => h.textLines(x2, a, b, [low(q.g) + ' · ' + fmtG(d.n * q.M, 1) + ' г'], '#1b1610', sel ? '#ffd166' : '#fff6e6', { round: 10 }));
      pl.rotation.x = -0.6; at(pl, 0, TY + 2.2, 5.6, bg);
    });
    [['v-1', '−1'], ['v-q', '−¼'], ['v+q', '+¼'], ['v+1', '+1']].forEach(([k, l], i) => h.key(g, 14 + i * 12, 40, 10, 5.6, l + ' моль', i < 2 ? 0xc0563f : 0x2f9e55, k));
    tag(v3(CX + 4, TY + 8, CZ + 12), `Цилиндр · ${low(d.g)}`, `V = ${fmtG(d.V, 2)} л · n = ${fmtG(d.n)} моль` + (d.hit ? ' ✓' : ''), d.hit);
    tag(v3(16, TY + 2 + rB * 2.2 + 4, -22), `Мешки по ${fmtG(d.V, 1)} л`, 'объём один — массы разные');
    tag(v3(QX, TY + S3 + 3, QZ), 'Куб-эталон', '1 моль газа при н. у.');
  };

  // ===== 8. Расчёты по уравнениям: доска с уравнением, «дано» на весах, установка, «найти», стопки молей =====
  SC['chtb-calc'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    // доска
    const bd = new T.Group(); at(bd, 0, TY, -32, g);
    at(box(3, 22, 3, C.DARK), -47, 11, 0, bd); at(box(3, 22, 3, C.DARK), 47, 11, 0, bd);
    at(box(100, 20, 1.6, 0x26324a), 0, 14, 0, bd);
    const board = h.canvasPlane(96, 18, 1100, 206, (x, a, b) => {
      x.fillStyle = '#132018'; x.fillRect(0, 0, a, b); x.strokeStyle = d.okS ? '#86e0a8' : '#56688f'; x.lineWidth = 6; x.strokeRect(3, 3, a - 6, b - 6);
      x.textBaseline = 'middle'; x.font = '600 52px "IBM Plex Mono", monospace';
      const parts = []; const side = arr => arr.forEach(([k, f], i) => { if (i) parts.push([' + ', '#8b96ad']); parts.push([(k > 1 ? k : '') + low(f), f === d.g ? '#ffb547' : f === d.s ? '#72d4e8' : '#f2f5f0']); });
      side(d.L); parts.push([' → ', '#8b96ad']); side(d.R);
      const tw = parts.reduce((s, p) => s + x.measureText(p[0]).width, 0); let cx = (a - tw) / 2;
      parts.forEach(([t, c]) => { x.fillStyle = c; x.textAlign = 'left'; x.fillText(t, cx, 48); cx += x.measureText(t).width; });
      x.textAlign = 'center'; x.font = '500 32px "IBM Plex Mono", monospace'; x.fillStyle = '#c9d3e6';
      x.fillText(`дано: m(${low(d.g)}) = ${d.gm} г · найти: ${d.ask}(${low(d.s)})${d.ask === 'V' ? ', н. у.' : ''}`, a / 2, 108);
      x.fillStyle = d.okS ? '#86e0a8' : '#8b96ad';
      x.fillText(d.okS ? `до: ${d.before}  →  после: ${d.after}` : 'массы до и после — когда моли совпадут', a / 2, 160);
    });
    at(board, 0, 14, 0.85, bd);
    // «дано» на весах
    const LX = -36, RX = 36, Z = 2;
    const sl = h.scale(g, LX, Z, 20, 15);
    sl.disp.userData.set(fmtG(d.mG, 1) + ' г', d.okG ? '#86e0a8' : '#ffd166');
    const kG = clamp(d.nG / 3, 0, 1);
    if (d.g === 'H2') {
      const cy = new T.Group(); at(cy, LX, sl.top, sl.pz, g);
      at(cyl(3.2, 12, 0x2f6fd8, { seg: 24 }), 0, 6, 0, cy); at(cyl(3.2, 2.4, 0x2f6fd8, { r2: 1.4, seg: 24 }), 0, 13.2, 0, cy); at(cyl(0.9, 2.4, C.BRASS), 0, 15.4, 0, cy);
      const lb = h.canvasPlane(5, 2.4, 160, 76, (x, a, b) => h.textLines(x, a, b, ['H₂'], '#fff', '#2f6fd8')); at(lb, 0, 7, 3.25, cy);
    } else if (d.g === 'CaCO3') {
      h.dish(g, LX, sl.top + 0.1, sl.pz, 6);
      const n = Math.max(1, Math.round(kG * 14)); for (let i = 0; i < n; i++) { const c = kit.mesh(new T.IcosahedronGeometry(1.0, 0), 0xf4f4f0, { edgeAngle: 20 }); c.rotation.set(rnd(i) * 3, rnd(i + 3) * 3, 0); const a = rnd(i + 7) * 6.28, rr = Math.sqrt(rnd(i + 8)) * 4; at(c, LX + Math.cos(a) * rr, sl.top + 1.3 + Math.floor(i / 7) * 1.2, sl.pz + Math.sin(a) * rr, g); }
    } else {
      h.beaker(g, LX, sl.top + 0.1, sl.pz, 4.6, 10);
      const w = h.liquid(g, LX, sl.top + 0.4, sl.pz, 4.3, 0x6fb6e8, 0.55); w.set(Math.max(0.2, kG * 8.6), sl.top + 0.4);
    }
    // установка в центре
    const cx0 = 0, cz0 = -6;
    let mid = v3(cx0, TY + 14, cz0);
    if (d.pi === 0) {
      // круглая колба на подставке-кольце, электроды искры
      at(box(10, 1.2, 10, C.DARK), cx0, TY + 0.6, cz0, g);
      const rgM = kit.mesh(new T.TorusGeometry(4.2, 0.4, 8, 28), 0x3b4a66, { hull: true, edges: false }); rgM.rotation.x = Math.PI / 2; at(rgM, cx0, TY + 4.5, cz0, g);
      [[-1, -1], [1, -1], [0, 1.2]].forEach(([a, b]) => at(cyl(0.4, 4, C.STEEL, { edges: false }), cx0 + a * 3.6, TY + 2.6, cz0 + b * 3.2, g));
      const fl = h.ball(7, 0xd8eef8, { mat: h.glassMat(0xd8eef8, 0.3), hull: false }); at(fl, cx0, TY + 11, cz0, g);
      at(cyl(1.8, 5, 0xd8eef8, { edges: false, matOpt: { transparent: true, opacity: 0.4 } }), cx0, TY + 19.5, cz0, g);
      at(cyl(2.2, 2, 0x9c3b2e), cx0, TY + 22, cz0, g);
      [-0.8, 0.8].forEach(s => at(cyl(0.2, 9, C.STEEL, { edges: false, hull: false }), cx0 + s, TY + 16, cz0, g));
      mid = v3(cx0, TY + 22, cz0);
    } else if (d.pi === 1) {
      // фарфоровый тигель на треноге над спиртовкой
      [0, 1, 2].forEach(k => { const a = k * 2.094; h.rodAB(g, v3(cx0 + Math.cos(a) * 6, TY, cz0 + Math.sin(a) * 6), v3(cx0 + Math.cos(a) * 4, TY + 15, cz0 + Math.sin(a) * 4), 0.35, C.DARK); });
      const tri = kit.mesh(new T.TorusGeometry(4, 0.35, 6, 24), C.DARK, { hull: true, edges: false }); tri.rotation.x = Math.PI / 2; at(tri, cx0, TY + 15, cz0, g);
      at(cyl(3.6, 4.6, 0xf7f3ea, { r2: 4.4, seg: 28 }), cx0, TY + 17, cz0, g);
      h.heap(g, cx0, TY + 19.2, cz0, 3, 1.2, 0xf4f4f0, 5, { s: 0.6 });
      h.burner(g, cx0, cz0, true);
      mid = v3(cx0, TY + 21, cz0);
    } else {
      // электролизёр: стакан с двумя пробирками над электродами и батарея
      h.beaker(g, cx0, TY, cz0, 7, 9);
      const w = h.liquid(g, cx0, TY + 0.3, cz0, 6.7, 0x9fd0ee, 0.45); w.set(7.6, TY + 0.3);
      [-3, 3].forEach((s, i) => { const t2 = h.tube(g, cx0 + s, TY + 26, cz0, 1.8, 18, { level: 0 }); t2.g.rotation.z = Math.PI; t2.g.position.x = cx0 + s; at(cyl(0.5, 7, C.DARK, { edges: false }), cx0 + s, TY + 4, cz0, g); });
      const bat = kit.cells(1, 1.5); const bn = kit.placeOn(bat, v3(cx0, 0, cz0 + 14), 0, 'bat');
      kit.cable(bn.tin, v3(cx0 - 3, TY + 8, cz0), kit.C.WIRE.minus, d.okS ? 0.5 : 0, { r: 0.5, lift: 3 });
      kit.cable(bn.tout, v3(cx0 + 3, TY + 8, cz0), kit.C.WIRE.plus, d.okS ? 0.5 : 0, { r: 0.5, lift: 3 });
      mid = v3(cx0, TY + 27, cz0);
    }
    // «найти»
    const kS = clamp(d.nS / 3, 0, 1);
    let rTop;
    if (d.ask === 'm') {
      const sr = h.scale(g, RX, Z, 20, 15); sr.disp.userData.set(fmtG(d.out, 1) + ' г', d.okS ? '#86e0a8' : '#c9d3e6');
      h.beaker(g, RX, sr.top + 0.1, sr.pz, 5, 12);
      const w = h.liquid(g, RX, sr.top + 0.4, sr.pz, 4.7, 0x6fb6e8, 0.55); w.set(Math.max(0.2, kS * 10.6), sr.top + 0.4);
      rTop = v3(RX, sr.top + 12, sr.pz);
    } else {
      at(box(14, 1.6, 12, 0xdfe4ec), RX, TY + 0.8, Z, g);
      const rB = 7 * Math.cbrt(Math.max(0.05, d.nS / 3));
      h.balloon(g, RX, TY + 1.6, Z, rB, d.s === 'O2' ? 0xe5533f : 0x9aa6bd, 0.55);
      const vp = h.canvasPlane(12, 3.4, 300, 86, (x, a, b) => h.textLines(x, a, b, ['V = ' + fmtG(d.out, 2) + ' л'], d.okS ? '#1f7a43' : '#1b1610', '#fff6e6', { round: 10 }));
      vp.rotation.x = -0.6; at(vp, RX, TY + 2.2, Z + 6.6, g);
      rTop = v3(RX, TY + 3, Z);
    }
    // шланги и бегущие частицы при верном решении
    const pts1 = [v3(LX + 5, TY + 16, Z - 2), v3(-18, TY + 24, -4), mid.clone()];
    const pts2 = [mid.clone(), v3(18, TY + 24, -4), v3(RX - 3, rTop.y + 4, Z - 2)];
    const curves = [pts1, pts2].map(p => { const c = new T.CatmullRomCurve3(p, false, 'centripetal'); at(kit.mesh(new T.TubeGeometry(c, 40, 0.5, 8), 0x8fb9d6, { hull: true, edges: false, matOpt: { transparent: true, opacity: 0.55 } }), 0, 0, 0, g); return c; });
    if (d.okS) {
      const dots = [];
      for (let i = 0; i < 10; i++) { const b = h.ball(0.75, i % 2 ? 0xffb547 : 0x72d4e8, { hull: false, seg: 10, seg2: 8 }); g.add(b); dots.push({ b, ph: i / 10 }); }
      kit.onFrame((dt, t) => dots.forEach(q => { const u = kit.reduce ? q.ph : (t * 0.25 + q.ph) % 1; const c = u < 0.5 ? curves[0] : curves[1]; q.b.position.copy(c.getPointAt(u < 0.5 ? u * 2 : u * 2 - 1)); q.b.material.color.setHex(u < 0.5 ? 0xffb547 : 0x72d4e8); }));
    }
    // стопки молей: шайба = ¼ моль
    const stack = (x, n, col, ok, kMinus, kPlus, label) => {
      const z = 24;
      at(box(9, 1, 9, C.DARK), x, TY + 0.5, z, g);
      const q = Math.round(n * 4), full = Math.floor(n * 4 + 1e-9), rest = n * 4 - full;
      for (let i = 0; i < full; i++) at(cyl(3.4, 0.9, col, { seg: 28 }), x, TY + 1.0 + 0.45 + i * 1.0, z, g);
      if (rest > 0.05) at(cyl(3.4, 0.9 * rest, col, { seg: 28, matOpt: { transparent: true, opacity: 0.6 } }), x, TY + 1.0 + full * 1.0 + 0.45 * rest, z, g);
      if (ok) at(h.glow(0x86e0a8, 18, 0.35), x, TY + 2 + n * 2, z, g);
      h.key(g, x - 10, z + 2, 6.4, 5.6, '−¼', 0xc0563f, kMinus);
      h.key(g, x + 10, z + 2, 6.4, 5.6, '+¼', 0x2f9e55, kPlus);
      const lb = h.canvasPlane(16, 3, 360, 68, (x2, a, b) => h.textLines(x2, a, b, [label], ok ? '#1f7a43' : '#1b1610', '#fff6e6', { round: 10 }));
      lb.rotation.x = -Math.PI / 2 + 0.3; at(lb, x, TY + 0.4, z + 7.6, g);
      return q;
    };
    stack(LX, d.nG, 0xffb547, d.okG, 'g-', 'g+', `n(${low(d.g)}) = ${fmtG(d.nG)} моль`);
    stack(RX, d.nS, 0x72d4e8, d.okS, 's-', 's+', `n(${low(d.s)}) = ${fmtG(d.nS)} моль`);
    // табличка соотношения
    const rp = h.canvasPlane(26, 9, 520, 180, (x, a, b) => h.textLines(x, a, b, [{ t: 'коэффициенты ' + d.cg + ' : ' + d.cs, c: '#1b1610' }, { t: 'моли ' + fmtG(d.nG) + ' : ' + fmtG(d.nS), c: d.okS ? '#1f7a43' : '#b26200' }], '#1b1610', '#fff6e6', { round: 14, border: d.okS ? '#2f9e55' : '#c9d3e6', bw: 6 }));
    rp.rotation.x = -Math.PI / 2 + 0.3; at(rp, 0, TY + 1.8, 22, g); at(box(28, 1.2, 11, C.WOOD), 0, TY + 0.6, 22, g);
    d.probs.forEach((p, i) => h.key(g, -22 + i * 22, 40, 19, 5.6, 'Задача ' + (i + 1) + (p ? ' ✓' : ''), i === d.pi ? 0x2f6fd8 : 0x5d6b88, 'p-' + i, '#fff', { on: i === d.pi }));
    tag(v3(LX, TY + 22, Z), 'Дано: ' + low(d.g), `m = ${fmtG(d.mG, 1)} г` + (d.okG ? ' ✓' : ` · нужно ${d.gm} г`), d.okG);
    tag(v3(RX, TY + (d.ask === 'm' ? 22 : 20), Z), 'Найти: ' + low(d.s), d.ask === 'm' ? `m = ${fmtG(d.out, 1)} г` : `V = ${fmtG(d.out, 2)} л`, d.okS);
  };

  // =====================================================================================
  //                              БИОМОЛЕКУЛЫ (labs/chem-biomol)
  // =====================================================================================
  // опытный уголок: пробирка в лапке над спиртовкой, склянки с реактивами; цвет слоёв — из LUCH_REAL.live()
  function testCorner(kit, h, g, d, x, z, reag) {
    const { T, at, box, cyl, clickable, C } = kit, v3 = h.v3;
    const bur = h.burner(g, x, z, d.heat && d.run);
    const y0 = bur.top + 3.4, TH = 22, R = 2.4;
    h.stand(g, x + 12, z - 4, 34, [{ y: y0 + 16, to: v3(x, 0, z) }]);
    const tb = h.tube(g, x, y0, z, R, TH, { level: 0 });
    const ri = R - 0.32, layers = [0, 1].map(() => { const mat = h.ownMat(0xffffff, { transparent: true, opacity: 0.8, depthWrite: false }); const m = new T.Mesh(kit.keep(new T.CylinderGeometry(ri, ri, 1, 24)), mat); m.visible = false; at(m, 0, 0, 0, tb.g); return { m, mat }; });
    const botM = h.ownMat(0xffffff, { transparent: true, opacity: 0.8, depthWrite: false });
    const bot = new T.Mesh(kit.keep(new T.SphereGeometry(ri, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), botM); bot.visible = false; at(bot, 0, R, 0, tb.g);
    const bub = h.bubbles(tb.g, 0, 0.6, 0, ri - 0.6, 8);
    kit.onFrame(() => {
      const L = (live() || {}).L || [], ph = (live() || {}).ph ?? 1;
      let acc = R;
      layers.forEach((l, i) => {
        const q = L[i]; l.m.visible = !!q; if (!q) return;
        const hh = q.f * TH * 0.92; l.mat.color.setHex(hexN(q.col)); l.mat.opacity = q.op ?? 0.85;
        l.m.scale.y = Math.max(0.05, hh); l.m.position.y = acc + hh / 2; acc += hh;
      });
      bot.visible = !!L[0]; if (L[0]) { botM.color.setHex(hexN(L[0].col)); botM.opacity = L[0].op ?? 0.85; }
      bub.set(d.heat && ph < 1 ? 1 : 0, acc - 0.4, 0.35, 1.2);
    });
    reag.forEach((r, i) => { const b = h.bottle(g, x - 14 + i * 12, z + 24, r.col, r.label, { r: 3.4, h: 9, brown: r.brown }); clickable(b.g, r.key); if (d.test === r.t) h.ring(g, x - 14 + i * 12, z + 24, 4.6); });
    return { top: y0 + TH };
  }
  // шестиугольное (пятиугольное) звено сахара, стоит лицом к зрителю
  function sugarRing(kit, h, parent, type, flip) {
    const { T, at, cyl } = kit;
    const col = { a: 0xffb547, b: 0x86e0a8, f: 0xff8a73 }[type], n = type === 'f' ? 5 : 6, r = type === 'f' ? 3.4 : 3.8;
    const rg = new T.Group(); parent.add(rg);
    const pr = cyl(r, 1.6, col, { seg: n, edges: true }); pr.rotation.x = Math.PI / 2; if (n === 6) pr.rotation.y = Math.PI / 6; rg.add(pr);
    const a0 = flip ? -Math.PI / 2 : Math.PI / 2;
    const o = h.ball(0.75, 0xe5533f, { seg: 12, seg2: 10 }); at(o, Math.cos(a0) * r * 0.9, Math.sin(a0) * r * 0.9, 0.2, rg);
    const lb = h.canvasPlane(r * 1.3, r * 0.8, 128, 80, (x, a, b) => h.textLines(x, a, b, [{ a: 'α', b: 'β', f: 'Фру' }[type]], '#1b1610', null));
    at(lb, 0, 0, 0.82, rg);
    return rg;
  }

  // ===== 9. Углеводы: цепь звеньев глюкозы на подставке (спираль крахмала, прямая целлюлоза), опыты с I₂ и Cu(OH)₂ =====
  SC['chtb-carbs'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    // подставка-рейка
    const SZ = -14, SY = TY + 15, CXc = -13;
    at(box(100, 2, 10, C.WOOD2), CXc, TY + 1, SZ, g);
    [CXc - 48, CXc + 48].forEach(x => { at(cyl(0.8, SY - TY - 2, C.STEEL, { edges: false }), x, TY + 2 + (SY - TY - 2) / 2, SZ, g); });
    { const ax = cyl(0.35, 96, C.STEEL, { edges: false, hull: false }); ax.rotation.z = Math.PI / 2; at(ax, CXc, SY, SZ, g); }
    const n = d.chain.length, sp = 10, hs = 0.82, x0 = CXc - (n - 1) * sp * (d.helix ? hs : 1) / 2;
    const chain = new T.Group(); at(chain, 0, SY, SZ, g);
    const pts = d.chain.map((c, i) => d.helix ? v3(x0 + i * sp * hs, 6 * Math.cos(i * Math.PI / 3), 6 * Math.sin(i * Math.PI / 3)) : v3(x0 + i * sp, 0, 0));
    // ось спирали (для крахмала) и молекулы йода внутри
    const iodine = [];
    if (d.helix) {
      at(cyl(0.3, (n - 1) * sp * hs, 0x56688f, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.4 } }), x0 + (n - 1) * sp * hs / 2, 0, 0, chain).rotation.z = Math.PI / 2;
      if (d.test === 'i2') for (let i = 0; i < (n - 1) * 2; i++) { const io = h.ball(1.1, 0x3a2a7a, { seg: 12, seg2: 10 }); at(io, x0 + 2 + i * sp * hs / 2, 0, 0, chain); io.visible = false; iodine.push(io); }
    }
    for (let i = 1; i < n; i++) {
      const a = pts[i - 1], b = pts[i], m = a.clone().lerp(b, 0.5);
      if (!d.helix) m.y += d.chain[i] === 'b' ? (i % 2 ? -1.2 : 1.2) : -1.6;
      h.rodAB(chain, a, m, 0.35, 0xc8d1e2); h.rodAB(chain, m, b, 0.35, 0xc8d1e2);
      at(h.ball(0.85, 0xe5533f, { seg: 12, seg2: 10 }), m.x, m.y, m.z, chain);
    }
    d.chain.forEach((c, i) => {
      const rg = sugarRing(kit, h, chain, c, c === 'b' && i % 2 === 1);
      rg.position.copy(pts[i]); if (d.helix) rg.rotation.x = i * Math.PI / 3;
      clickable(rg, 'u-' + i);
    });
    if (!n) { const pl = h.canvasPlane(44, 5, 700, 80, (x, a, b) => h.textLines(x, a, b, ['подставка пуста — возьмите звено из банки'], '#5d6b88', null)); pl.rotation.x = -Math.PI / 2; at(pl, CXc, TY + 2.1, SZ, g); }
    if (iodine.length) kit.onFrame(() => { const ph = (live() || {}).ph ?? 1; iodine.forEach((io, i) => { io.visible = ph > i / iodine.length * 0.8; }); });
    // банки со звеньями
    [['a', 'α-глюкоза', 0xffb547], ['b', 'β-глюкоза', 0x86e0a8], ['f', 'фруктоза', 0xff8a73]].forEach(([k, nm, col], i) => {
      const x = -50 + i * 15, z = 24, jg = new T.Group(); at(jg, x, TY, z, g); clickable(jg, 'm-' + k);
      const w = new T.Mesh(kit.keep(new T.CylinderGeometry(5, 5, 8, 28, 1, true)), h.glassMat(0xd8eef8, 0.3)); at(w, 0, 4, 0, jg); w.add(new T.Mesh(w.geometry, kit.hullMat));
      at(cyl(5, 0.5, 0xd8eef8, { edges: false, matOpt: { transparent: true, opacity: 0.4 } }), 0, 0.25, 0, jg);
      for (let j = 0; j < 4; j++) { const t = cyl(1.8, 0.8, col, { seg: k === 'f' ? 5 : 6 }); t.rotation.set(rnd(j + i * 5) * 0.8, rnd(j + 2) * 3, 0); at(t, (j % 2 - 0.5) * 3.6, 1.2 + Math.floor(j / 2) * 1.6, (rnd(j + 7) - 0.5) * 3, jg); }
      const lb = h.canvasPlane(9, 2.8, 260, 80, (x2, a, b) => h.textLines(x2, a, b, ['+ ' + nm], '#1b1610', '#fff6e6', { round: 8 })); lb.rotation.x = -0.7; at(lb, 0, 0.6, 7.2, jg);
    });
    h.key(g, -8, 40, 9, 5.6, '⌫', 0x5d6b88, 'cut');
    h.key(g, 6, 40, 14, 5.6, 'очистить', 0x5d6b88, 'clr');
    testCorner(kit, h, g, d, 46, 6, [{ key: 't-i2', t: 'i2', label: 'I₂', col: 0x8a4a1a, brown: true }, { key: 't-cu', t: 'cu', label: 'Cu(OH)₂', col: 0x3b8fe0 }]);
    tag(v3(CXc, SY + (d.helix ? 10 : 8), SZ), n ? cap(d.name) + ' · ' + d.f : 'Цепь углевода', n ? `${d.cls}, M = ${d.M} г/моль` : 'добавьте звено', d.helix || d.fiber);
    tag(v3(46, TY + 40, 6), 'Пробирка', d.test ? d.res : 'выберите реактив', d.test && !d.run && d.ok);
    tag(v3(-35, TY + 15, 24), 'Звенья', 'нажмите на банку — добавить');
  };

  // ===== 10. Аминокислоты и белки: бусы-остатки на подставке, сворачиваются в спираль; цветные реакции =====
  SC['chtb-pep'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const SZ = -14, SY = TY + 16;
    at(box(96, 2, 10, C.WOOD2), -13, TY + 1, SZ, g);
    [-59, 33].forEach(x => at(cyl(0.8, SY - TY - 2, C.STEEL, { edges: false }), x, TY + 2 + (SY - TY - 2) / 2, SZ, g));
    { const ax = cyl(0.35, 92, C.STEEL, { edges: false, hull: false }); ax.rotation.z = Math.PI / 2; at(ax, -13, SY, SZ, g); }
    const n = d.pep.length, fold = n >= 4;
    const chain = new T.Group(); at(chain, 0, SY, SZ, g);
    // прямая зигзаг-цепь и α-спираль (3,6 остатка на виток)
    const straight = i => v3(-13 + (i - (n - 1) / 2) * 12.4, i % 2 ? 1.8 : -1.8, 0);
    const helix = i => { const a = i * 100 * Math.PI / 180; return v3(-13 + (i - (n - 1) / 2) * 4.6, 6.5 * Math.cos(a), 6.5 * Math.sin(a)); };
    const beads = d.pep.map((k, i) => {
      const A = d.aa[k], bg = new T.Group(); chain.add(bg);
      const b = h.ball(3.6, A.col); bg.add(b);
      const lb = h.canvasPlane(5.6, 3, 128, 70, (x, a, bb) => h.textLines(x, a, bb, [A.s], '#ffffff', null)); at(lb, 0, 0, 3.65, bg);
      // радикал R: палочка и шарик (кольцо — у ароматических)
      const up = i % 2 ? 1 : -1;
      h.rodAB(bg, v3(0, up * 3.2, -0.5), v3(0, up * 5.6, -1.4), 0.3, 0x8b96ad, { hull: false });
      if (A.k === 'ar') { const rr = cyl(1.6, 0.6, 0x8a5cc7, { seg: 6 }); rr.rotation.x = Math.PI / 2; at(rr, 0, up * 6.8, -1.6, bg); }
      else at(h.ball(A.k === 'ch' ? 1.3 : 1.0, A.k === 'ch' ? 0xc0563f : A.k === 'p' ? 0x2f7fa8 : 0x9aa3b2, { seg: 12, seg2: 10 }), 0, up * 6.4, -1.6, bg);
      clickable(bg, 'r-' + i);
      return bg;
    });
    // пептидные связи: жёлтые перемычки (перестраиваются каждый кадр)
    const bonds = [];
    for (let i = 1; i < n; i++) { const r = cyl(0.55, 1, 0xffb547, { edges: false }); chain.add(r); bonds.push(r); }
    // концы цепи
    const endN = h.canvasPlane(5, 2.2, 160, 70, (x, a, b) => h.textLines(x, a, b, ['H₂N–'], '#2f7fa8', '#fff6e6', { round: 8 }));
    const endC = h.canvasPlane(6, 2.2, 190, 70, (x, a, b) => h.textLines(x, a, b, ['–COOH'], '#c0563f', '#fff6e6', { round: 8 }));
    if (n) { chain.add(endN); chain.add(endC); }
    const yAx = v3(0, 1, 0), t0 = performance.now();
    const place = k => {
      for (let i = 0; i < n; i++) beads[i].position.copy(straight(i).lerp(helix(i), k));
      for (let i = 1; i < n; i++) { const a = beads[i - 1].position, b = beads[i].position, dv = b.clone().sub(a), L = dv.length(); const r = bonds[i - 1]; r.scale.set(1, Math.max(0.1, L - 5.6), 1); r.position.copy(a).lerp(b, 0.5); r.quaternion.setFromUnitVectors(yAx, dv.normalize()); }
      if (n) { endN.position.copy(beads[0].position).add(v3(-6.4, 0, 1)); endC.position.copy(beads[n - 1].position).add(v3(6.8, 0, 1)); }
    };
    place(fold ? (kit.reduce ? 1 : 0) : 0);
    if (fold && !kit.reduce) kit.onFrame((dt, t) => place(ease((performance.now() - t0) / 1800 - 0.3)));
    if (!n) { const pl = h.canvasPlane(44, 5, 700, 80, (x, a, b) => h.textLines(x, a, b, ['подставка пуста — возьмите аминокислоту'], '#5d6b88', null)); pl.rotation.x = -Math.PI / 2; at(pl, -13, TY + 2.1, SZ, g); }
    // склянки с аминокислотами
    d.aa.forEach((A, k) => {
      const x = -52 + k * 9.4, z = 26, bt = h.bottle(g, x, z, null, null, { r: 3.2, h: 7, cap: A.col });
      for (let j = 0; j < 4; j++) at(h.ball(0.9, 0xf4f4f0, { seg: 8, seg2: 6 }), x + (j % 2 - 0.5) * 2, TY + 1.2 + Math.floor(j / 2) * 1.4, z + (rnd(j + k) - 0.5) * 2, g);
      const lb = h.canvasPlane(7.4, 2.6, 220, 76, (x2, a, b) => h.textLines(x2, a, b, [A.s], '#ffffff', hexS(A.col), { round: 8 })); lb.rotation.x = -0.7; at(lb, x, TY + 0.6, z + 5, g);
      clickable(bt.g, 'aa' + k);
    });
    h.key(g, 30, 40, 9, 5.6, '⌫', 0x5d6b88, 'cut');
    testCorner(kit, h, g, d, 46, 6, [{ key: 't-biu', t: 'biu', label: 'CuSO₄+NaOH', col: 0x3b8fe0 }, { key: 't-xan', t: 'xan', label: 'HNO₃', col: 0xf2ecd2 }]);
    tag(v3(-13, SY + 12, SZ), n ? d.seq : 'Цепь пептида', n ? `связей –CO–NH–: ${d.bonds} · M = ${d.M}` + (fold ? ' · спираль' : '') : 'добавьте аминокислоту', d.target);
    tag(v3(46, TY + 40, 6), 'Пробирка', d.test ? d.res : 'выберите реактив', d.test && !d.run && d.ok);
  };

  // ===== 11. ДНК и РНК: двойная спираль на подставке; достраивается лестницей, закручивается, раскручивается для иРНК =====
  SC['chtb-dna'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C, keep } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const NB = d.tpl.length, SP = 12, AY = TY + 22, AZ = -8, RR = 8.5;
    // подставка: основание и две стойки, ось
    at(box(110, 2.4, 12, C.WOOD2), 0, TY + 1.2, AZ, g);
    [-53, 53].forEach(x => { at(cyl(1, AY - TY - 2.4, C.STEEL, { edges: false }), x, TY + 2.4 + (AY - TY - 2.4) / 2, AZ, g); const ax = cyl(0.5, 6, C.STEEL, { edges: false }); ax.rotation.z = Math.PI / 2; at(ax, x + (x < 0 ? 3 : -3), AY, AZ, g); });
    const rna = d.mode === 'rna';
    const twT = d.mode === 'hb' || (d.mode === 'dna' && d.dnaOk) ? 1 : 0;
    if (MEM.dna == null || MEM.dnaMode == null) { MEM.dna = twT; MEM.sep = rna ? 1 : 0; }
    MEM.dnaMode = d.mode;
    const xs = i => (i - (NB - 1) / 2) * SP;
    // шарики-буквы (спрайты, всегда к зрителю)
    const letter = (b, col) => { const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d'); x.fillStyle = hexS(col); x.beginPath(); x.arc(48, 48, 42, 0, 7); x.fill(); x.lineWidth = 6; x.strokeStyle = '#04070d'; x.stroke(); x.fillStyle = '#0b1019'; x.font = '700 54px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(b, 48, 52); const t = keep(new T.CanvasTexture(c)); t.colorSpace = T.SRGBColorSpace; const s = new T.Sprite(keep(new T.SpriteMaterial({ map: t, depthTest: false }))); s.scale.setScalar(4.4); s.renderOrder = 5; return s; };
    const rungs = [];
    for (let i = 0; i < NB; i++) {
      const b = d.tpl[i], f = d.fill[i], ok = f && f === d.want[i];
      const rg = new T.Group(); at(rg, xs(i), AY, AZ, g); clickable(rg, 'c-' + i);
      // половинка матрицы (сверху)
      const h1 = cyl(1.1, RR - 0.6, d.bcol[b], { edges: false }); at(h1, 0, RR / 2 + 0.2, 0, rg);
      const s1 = letter(b, d.bcol[b]); at(s1, 0, RR / 2 + 0.6, 1.6, rg);
      const p1 = h.ball(1.3, 0xffb547, { seg: 12, seg2: 10 }); at(p1, 0, RR, 0, rg);
      // вторая половинка (снизу): ДНК или иРНК
      const lo = new T.Group(); rg.add(lo);
      let h2;
      if (f) { h2 = cyl(1.1, RR - 0.6, d.bcol[f], { edges: false }); at(h2, 0, -RR / 2 - 0.2, 0, lo); const s2 = letter(f, d.bcol[f]); at(s2, 0, -RR / 2 - 0.6, 1.6, lo); }
      else { h2 = cyl(1.1, RR - 0.6, 0xdfe4ec, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.6 } }); at(h2, 0, -RR / 2 - 0.2, 0, lo); }
      const p2 = h.ball(1.3, rna ? 0xff8a73 : 0xffb547, { seg: 12, seg2: 10 }); at(p2, 0, -RR, 0, lo);
      if (f && !ok) { const x2 = box(2.4, 0.5, 0.5, 0xe0473a, { edges: false }); x2.rotation.z = 0.8; at(x2, 0, 0, 1.2, rg); const x3 = box(2.4, 0.5, 0.5, 0xe0473a, { edges: false }); x3.rotation.z = -0.8; at(x3, 0, 0, 1.2, rg); }
      if (ok) { const nh = (b === 'G' || b === 'C') ? 3 : 2; for (let k = 0; k < nh; k++) at(box(0.35, 0.35, 0.35, 0xffffff, { edges: false, shadow: false }), (k - (nh - 1) / 2) * 0.9, 0, 1.0, rg); }
      if (d.mode !== 'hb' && d.cur === i) { const sel = kit.mesh(new T.TorusGeometry(2.0, 0.3, 8, 24), 0xffd166, { edges: false }); at(sel, 0, -RR / 2, 0, lo); }
      rungs.push({ rg, lo });
    }
    // «перила»: сахаро-фосфатные остовы (трубки по точкам, перестраиваются при закрутке)
    const railMat = [h.ownMat(0xffb547), h.ownMat(rna ? 0xff8a73 : 0xffb547)];
    const rails = [null, null];
    const tmpA = v3(0, 0, 0);
    const build = (tw, sep) => {
      rungs.forEach((r, i) => {
        const th = tw * (i - (NB - 1) / 2) * 36 * Math.PI / 180;
        r.rg.rotation.x = th;
        r.lo.position.set(0, -sep * 2.2, 0); r.lo.rotation.x = 0;
      });
      [0, 1].forEach(s => {
        const pts = [];
        rungs.forEach((r, i) => { r.rg.updateMatrixWorld(true); const loc = s === 0 ? v3(0, RR, 0) : v3(0, -RR - sep * 2.2, 0); pts.push(loc.applyMatrix4(r.rg.matrix).add(v3(0, 0, 0))); });
        // концы
        const first = pts[0].clone().add(v3(-SP / 2, 0, 0)), last = pts[NB - 1].clone().add(v3(SP / 2, 0, 0));
        const all = [first, ...pts, last].map(p => p.clone().sub(v3(0, 0, 0)));
        if (rails[s]) { g.remove(rails[s]); rails[s].geometry.dispose(); }
        const geo = keep(new T.TubeGeometry(new T.CatmullRomCurve3(all.map(p => v3(p.x, p.y, p.z)), false, 'centripetal'), 120, 0.75, 8));
        const m = new T.Mesh(geo, railMat[s]); m.add(new T.Mesh(geo, kit.hullMat)); rails[s] = m; g.add(m);
      });
    };
    // группы ступенек стоят в g по (xs, AY, AZ): матрица rg.matrix даёт координаты в g
    build(MEM.dna, MEM.sep);
    const sepT = rna ? 1 : 0;
    kit.onFrame(dt => {
      const k = Math.min(1, dt * 2.2), tw0 = MEM.dna, sp0 = MEM.sep;
      MEM.dna = kit.reduce ? twT : MEM.dna + (twT - MEM.dna) * k; MEM.sep = kit.reduce ? sepT : MEM.sep + (sepT - MEM.sep) * k;
      if (Math.abs(MEM.dna - tw0) > 1e-4 || Math.abs(MEM.sep - sp0) > 1e-4) build(MEM.dna, MEM.sep);
    });
    // отодвинутая вторая цепь ДНК при транскрипции
    if (rna) {
      const ghost = new T.Group(); at(ghost, 0, TY + 4.6, AZ + 12, g);
      const gt = cyl(0.7, NB * SP, 0xffb547, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.6 } }); gt.rotation.z = Math.PI / 2; ghost.add(gt);
      const lb = h.canvasPlane(26, 3, 520, 60, (x, a, b) => h.textLines(x, a, b, ['вторая цепь ДНК отошла'], '#c9d3e6', null)); at(lb, 0, 2.6, 0, ghost);
    }
    // клавиши режима и оснований
    [['md-dna', 'ДНК'], ['md-rna', 'иРНК'], ['md-hb', 'Связи']].forEach(([k, l], i) => h.key(g, -48 + i * 13, 38, 11.5, 5.6, l, d.mode === k.slice(3) ? 0x2f6fd8 : 0x5d6b88, k, '#fff', { on: d.mode === k.slice(3) }));
    if (d.mode === 'hb') {
      h.key(g, 2, 38, 7, 5.6, '−', 0xc0563f, 'hb-');
      const sc = h.screen(10, 5, String(d.hbG), '#86e0a8', 200, 100, '#0c1a14'); sc.rotation.x = -Math.PI / 2; at(box(11, 1.6, 6, C.DARK), 13, TY + 0.8, 38, g); at(sc, 13, TY + 1.65, 38, g);
      h.key(g, 24, 38, 7, 5.6, '+', 0x2f9e55, 'hb+');
      h.key(g, 40, 38, 18, 5.6, 'Проверить', 0xe08a00, 'hbc');
    } else {
      (rna ? 'AUGC' : 'ATGC').split('').forEach((b, i) => h.key(g, 0 + i * 10, 38, 8.4, 5.6, b, d.bcol[b], 'b' + b, '#0b1019'));
      h.key(g, 44, 38, 9, 5.6, '⌫', 0x5d6b88, 'bk');
    }
    const lbl = d.mode === 'rna' ? 'Матрица ДНК и иРНК' : 'Двойная спираль ДНК';
    const val = d.mode === 'hb' ? (d.hb != null ? `${d.hb} водородных связей ✓` : `ваш ответ: ${d.hbG}`) : d.ok ? (rna ? 'иРНК верна ✓' : 'цепи комплементарны ✓') : d.wrong ? `ошибок: ${d.wrong}` : `заполнено ${d.filled} из ${NB}`;
    tag(v3(0, AY + RR + 7, AZ), lbl, val, d.ok);
    tag(v3(44, TY + 4, 24), 'A=T · G≡C', rna ? 'в РНК напротив A — U' : 'пары оснований');
  };
})();
