// «Как в жизни» для темы «Астрофизика» (labs/phys-astro): настольный планетарий — латунное Солнце в фокусе, орбита-проволока,
// планета, перигелий и афелий со стрелками скорости и равными площадями; модель звезды на подставке рядом с Солнцем,
// табло диаграммы Г–Р и колба «запас водорода»; музейная витрина галактик с корзинами E / S / SB / Irr и моделью Млечного Пути;
// телескоп со спектрографом, экран спектра с меткой Hα и табло графика Хаббла.
// Сцены строятся из window.LUCH_REAL() опыта; время планеты — из window.LUCH_REAL.live() каждый кадр. Набор деталей kit — из /luch/real3d.js.
(() => {
  const SC = (window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {});
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const live = () => { try { const f = window.LUCH_REAL && window.LUCH_REAL.live; return f ? f() : null; } catch (e) { return null; } };
  const TAU = Math.PI * 2;
  const num = (x, n) => { if (!isFinite(x)) return '∞'; let s = (Math.round(x * 10 ** n) / 10 ** n).toFixed(n); if (/^-0(\.0+)?$/.test(s)) s = s.slice(1); return s.replace('.', ',').replace('-', '−'); };
  const fint = x => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ').replace('-', '−');
  const FONT = '"Golos Text", sans-serif', MONO = '"IBM Plex Mono", monospace';

  // ---------- общие детали темы ----------
  function tools(kit) {
    const { T, at, box, cyl, mesh, keep, v3 } = kit;
    const own = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: kit.grad, ...o }));
    const basic = (color, o = {}) => keep(new T.MeshBasicMaterial({ color, ...o }));
    function plate(txt, w, h, fg = '#1b1610', bg = '#f7f3ea') {
      const t = keep(kit.textTex(txt, fg, bg, Math.round(64 * w / h), 64));
      return new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: t })));
    }
    function screen(w, h, pw, ph) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph;
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: tex })));
      return { m, c, x: c.getContext('2d'), tex, W: pw, H: ph };
    }
    function button(parent, x, y, z, txt, key, o = {}) {
      const b = new T.Group(); at(b, x, y, z, parent);
      const w = o.w || 5, h = o.h || 3.4;
      at(box(w, h, 1.4, o.col || 0xe8ecf4), 0, 0, 0, b);
      const p = plate(txt, w - 0.9, h - 1, o.fg || '#1b1610', o.bg || '#e8ecf4'); at(p, 0, 0, 0.72, b);
      kit.clickable(b, key); return b;
    }
    function console3(x, z, w, title) {
      const g = new T.Group(); at(g, x, 0, z);
      at(box(w, 12, 9, 0x3b4a66), 0, 6, 0, g);
      if (title) { const p = plate(title, w - 4, 2.2, '#fff6e6', '#3b4a66'); p.rotation.x = -Math.PI / 2; at(p, 0, 12.05, -2.4, g); }
      return g;
    }
    // стержень между двумя точками
    function rod(col, r = 0.22, mat) {
      const m = cyl(r, 1, col, { edges: false, hull: false, seg: 8 }); if (mat) m.material = mat;
      const up = v3(0, 1, 0), dv = v3(0, 0, 0);
      return { m, set(a, b) { dv.copy(b).sub(a); const l = dv.length(); if (l < 1e-4) { m.visible = false; return; } m.visible = true; m.position.copy(a).addScaledVector(dv, 0.5); m.quaternion.setFromUnitVectors(up, dv.multiplyScalar(1 / l)); m.scale.set(1, l, 1); } };
    }
    // стрелка от точки a в направлении dir длиной len
    function arrow(a, dir, len, col) {
      const g = new T.Group(); kit.root.add(g); g.position.copy(a);
      const head = Math.min(2.6, len * 0.4), sh = Math.max(0.01, len - head);
      at(cyl(0.38, sh, col, { edges: false, seg: 10 }), 0, sh / 2, 0, g);
      at(mesh(new T.ConeGeometry(1.1, head, 14), col, { hull: true, edges: false }), 0, sh + head / 2, 0, g);
      g.quaternion.setFromUnitVectors(v3(0, 1, 0), dir.clone().normalize());
      return g;
    }
    function glow(col, s, op = 0.8) {
      const h = new T.Sprite(keep(new T.SpriteMaterial({ map: kit.glowTex(), color: col, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: op })));
      h.scale.setScalar(s); return h;
    }
    function board(x, z, w, h, pw, ph, legH = 9) {
      const g = new T.Group(); at(g, x, 0, z);
      for (const sx of [-1, 1]) at(box(3, legH, 3, kit.C.DARK), sx * (w / 2 - 4), legH / 2, 0, g);
      at(box(w + 3, h + 3, 4, 0x2c3240), 0, legH + h / 2, 0, g);
      const s = screen(w, h, pw, ph); at(s.m, 0, legH + h / 2, 2.06, g);
      return { g, s, top: legH + h + 2 };
    }
    // звёздочки на тёмном основании
    function starDust(n, cx, cz, R, y, size = 0.7) {
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const r = R * Math.sqrt(((i * 0.618034) % 1)), a = i * 2.39996; pos[i * 3] = r * Math.cos(a); pos[i * 3 + 1] = 0; pos[i * 3 + 2] = r * Math.sin(a); }
      const geo = keep(new T.BufferGeometry()); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
      const p = new T.Points(geo, keep(new T.PointsMaterial({ color: 0xdfe6f5, size, sizeAttenuation: true, transparent: true, opacity: 0.8 })));
      p.position.set(cx, y, cz); kit.root.add(p); return p;
    }
    return { own, basic, plate, screen, button, console3, rod, arrow, glow, board, starDust };
  }

  // ---------- модель галактики (группа в плоскости xz, радиус ~ 6·s) ----------
  function galaxyModel(kit, K, g, s = 1) {
    const { T, at, mesh } = kit;
    const G = new T.Group(), spin = new T.Group(); G.add(spin);
    if (g.t === 'E') {
      const e = mesh(new T.SphereGeometry(5 * s, 24, 16), 0, { mat: K.own(0xf0cf8e, { transparent: true, opacity: 0.92 }), hull: true, edges: false });
      e.scale.set(1, (g.ratio || 0.8) * 0.9, g.ratio || 0.8); e.rotation.y = (g.rot || 0) * Math.PI / 180; spin.add(e);
      at(mesh(new T.SphereGeometry(1.8 * s, 14, 10), 0, { mat: K.basic(0xfff6dc), edges: false }), 0, 0, 0, spin);
      spin.add(K.glow(0xffd9a0, 16 * s, 0.55));
    } else if (g.t === 'S' || g.t === 'SB') {
      const bar = g.t === 'SB', st = bar ? 11 : 3.5, k = 6 * s / 34;
      at(mesh(new T.CylinderGeometry(6.2 * s, 6.2 * s, 0.25, 40), 0, { mat: K.basic(0x5f78c8, { transparent: true, opacity: 0.35, depthWrite: false }), edges: false, shadow: false }), 0, 0, 0, spin);
      for (const ph of [0, Math.PI]) {
        const pts = [];
        for (let i = 0; i <= 36; i++) { const th = i / 36 * 6.6, r = st * Math.exp(0.32 * th); if (r > 33) break; pts.push(new T.Vector3(r * k * Math.cos(th + ph), 0.2, r * k * Math.sin(th + ph))); }
        if (pts.length > 2) spin.add(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 60, 0.42 * s, 6), 0, { mat: K.basic(0xc4d5ff), edges: false, shadow: false }));
      }
      if (bar) at(mesh(new T.CapsuleGeometry(0.9 * s, 3.8 * s, 4, 10), 0, { mat: K.basic(0xffe2a8), edges: false }), 0, 0.3, 0, spin).rotation.z = Math.PI / 2;
      const core = mesh(new T.SphereGeometry(1.4 * s, 16, 12), 0, { mat: K.basic(0xfff6dc), edges: false }); core.scale.y = 0.7; spin.add(core);
      spin.add(K.glow(0xcfdcff, 13 * s, 0.4));
    } else {
      [[-10, -4, 12], [6, 4, 10], [14, -8, 7], [-4, 10, 8], [-18, 8, 6], [2, -12, 6]].forEach(([x, z, r], i) => {
        const b = mesh(new T.SphereGeometry(r * 0.13 * s, 12, 8), 0, { mat: K.own(0xcfdcff, { transparent: true, opacity: 0.75 }), edges: false });
        at(b, x * 0.22 * s, (i % 3 - 1) * 0.5 * s, z * 0.22 * s, spin);
      });
      [[-6, 2], [10, -6], [-14, 10], [4, 9]].forEach(([x, z]) => at(mesh(new T.SphereGeometry(0.45 * s, 8, 6), 0, { mat: K.basic(0xff9fb8), edges: false }), x * 0.22 * s, 0.6 * s, z * 0.22 * s, spin));
      spin.add(K.glow(0xcfdcff, 12 * s, 0.35));
    }
    return { G, spin };
  }

  // =====================================================================================
  // Урок 1: настольный планетарий — тёмный диск со звёздами, Солнце на стойке, орбита-проволока, планета, П и А, пульт
  SC['astro-orrery'] = (kit, d) => {
    const { T, at, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const SX = 8, Y = 9, k = 4.4;
    const a = d.a, e = d.e, b = d.b, Tp = d.T;
    const P = (E, y = Y) => v3(SX + k * a * (Math.cos(E) - e), y, -k * b * Math.sin(E));
    const solveE = t => { const M = TAU * (((t / Tp) % 1) + 1) % TAU; let E = M; for (let i = 0; i < 12; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); return E; };
    // основание-планетарий
    at(cyl(47, 1.4, 0x141c2e, { seg: 72 }), 0, 0.7, 0);
    K.starDust(160, 0, 0, 45, 1.5, 0.8);
    // Солнце на латунной стойке
    at(cyl(2.4, 1, C.BRASS, { seg: 20 }), SX, 1.9, 0);
    at(cyl(0.6, Y - 2.4, C.BRASS, { seg: 10 }), SX, (2.4 + Y) / 2, 0);
    const sun = mesh(new T.SphereGeometry(3.2, 28, 20), 0, { mat: K.basic(0xffd25a), hull: true, edges: false }); at(sun, SX, Y, 0);
    const sg = K.glow(0xffb347, 22, 0.85); at(sg, SX, Y, 0);
    // орбиты-ориентиры: Земля, Марс, Юпитер
    (d.refs || []).forEach((r, i) => {
      const R = r.a * k, ring = new T.Mesh(kit.keep(new T.TorusGeometry(R, 0.12, 6, 128)), K.basic(r.c, { transparent: true, opacity: 0.6 }));
      ring.rotation.x = Math.PI / 2; at(ring, SX, Y - 0.4, 0);
      const ang = [225, 300, 45][i % 3] * Math.PI / 180, p = K.plate(r.n, 6, 2, '#1b1610', '#e8ecf4');
      p.rotation.x = -Math.PI / 2; at(p, SX + (R + 3.4) * Math.cos(ang), Y - 0.3, -(R + 3.4) * Math.sin(ang));
    });
    // орбита планеты
    const pts = []; for (let i = 0; i < 160; i++) pts.push(P(i / 160 * TAU));
    kit.root.add(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts, true), 240, 0.34, 8, true), 0, { mat: K.own(0x72d4e8), edges: false }));
    // большая ось
    const xp = SX + d.rp * k, xa = SX - d.ra * k;
    if (xp - xa > 0.5) { const ax = K.rod(0x8b96ad, 0.14, K.basic(0x8b96ad, { transparent: true, opacity: 0.7 })); kit.root.add(ax.m); ax.set(v3(xa, Y - 0.2, 0), v3(xp, Y - 0.2, 0)); }
    // равные площади (II закон) для вытянутых орбит
    if (e >= 0.2) {
      const fan = t0 => {
        const v = [SX, Y + 0.05, 0];
        for (let i = 0; i <= 10; i++) { const q = P(solveE(t0 + Tp * 0.06 * i / 10), Y + 0.05); v.push(q.x, q.y, q.z); }
        const idx = []; for (let i = 1; i <= 10; i++) idx.push(0, i, i + 1);
        const geo = kit.keep(new T.BufferGeometry()); geo.setAttribute('position', new T.Float32BufferAttribute(v, 3)); geo.setIndex(idx);
        kit.root.add(new T.Mesh(geo, K.basic(0xffb547, { transparent: true, opacity: 0.32, side: T.DoubleSide, depthWrite: false })));
      };
      fan(-Tp * 0.03); fan(Tp * 0.47);
    }
    // перигелий и афелий: штырьки-флажки, нажатие отодвигает точку
    const peg = (x, txt, key) => {
      const g = new T.Group(); at(g, x, 0, 0); clickable(g, key);
      at(cyl(0.35, Y - 1.4, 0xffb547, { edges: false, seg: 8 }), 0, 1.4 + (Y - 1.4) / 2, 0, g);
      at(mesh(new T.SphereGeometry(1.1, 14, 10), 0xffb547, { hull: true, edges: false }), 0, Y, 0, g);
      const p = K.plate(txt, 2.6, 2.6, '#ffb547', '#04070d'); p.rotation.y = 0.62; at(p, 0, Y + 2.6, 0, g);
      return g;
    };
    if (xp - xa > 3) { peg(xp, 'П', 'p+'); peg(xa, 'А', 'a+'); } else peg(xp, 'П', 'p+');
    // стрелки скорости: в перигелии планета уходит «от нас», в афелии — «к нам»
    K.arrow(v3(xp, Y + 0.6, 0), v3(0, 0, -1), Math.max(2, d.vp * 0.3), 0x86e0a8);
    K.arrow(v3(xa, Y + 0.6, 0), v3(0, 0, 1), Math.max(2, d.va * 0.3), 0x86e0a8);
    // планета
    const pl = mesh(new T.SphereGeometry(1.7, 20, 14), 0, { mat: K.own(0x9fd4ff), hull: true, edges: false }); kit.root.add(pl);
    const plTag = v3(0, 0, 0);
    // пульт
    const pu = K.console3(52, 45, 30, 'орбита');
    [['П −', 'p-'], ['П +', 'p+'], ['А −', 'a-'], ['А +', 'a+']].forEach(([t, key], i) => K.button(pu, -10.5 + i * 7, 8, 4.7, t, key, { w: 6.2, h: 3.6 }));
    K.button(pu, -9.5, 3, 4.7, 'Земля', 'earth', { w: 8.6, h: 3.6 }); K.button(pu, 0, 3, 4.7, 'Марс', 'mars', { w: 8.6, h: 3.6 });
    K.button(pu, 9.5, 3, 4.7, 'Сброс', 'reset', { w: 8.6, h: 3.6, col: 0xe0473a, bg: '#e0473a', fg: '#ffffff' });
    tag(v3(SX, Y + 6, 0), 'Солнце', 'в фокусе');
    tag(v3(xp, Y + 6, 0), 'Перигелий ' + num(d.rp, 2) + ' а. е.', num(d.vp, 1) + ' км/с');
    if (xp - xa > 3) tag(v3(xa, Y + 6, 0), 'Афелий ' + num(d.ra, 2) + ' а. е.', num(d.va, 1) + ' км/с');
    tag(plTag, 'Планета · e = ' + num(e, 2), 'T = ' + num(Tp, 2) + ' г.', !!d.jup);
    kit.onFrame((dt, t) => {
      const L = live(); const tt = L ? L.t : 0;
      const q = P(solveE(tt)); pl.position.copy(q); pl.rotation.y += dt * 2;
      plTag.set(q.x, Y + 4, q.z);
      if (!kit.reduce) sg.scale.setScalar(22 + Math.sin(t * 2.2) * 1.2);
    });
  };

  // =====================================================================================
  // Урок 2: звезда на подставке рядом с моделью Солнца, табло диаграммы Г–Р, колба «запас водорода», пульт массы
  const SUP = { '-4': '⁻⁴', '-2': '⁻²', '2': '²', '4': '⁴', '6': '⁶' };
  const HR = { tMax: Math.log10(40000), tMin: Math.log10(2300), lMin: -4, lMax: 6 };
  const msStar = M => ({ T: 5778 * Math.pow(M, 0.475), L: Math.pow(M, 3.5) });
  const TC = [[2300, [255, 140, 70]], [3500, [255, 180, 115]], [4500, [255, 212, 165]], [5800, [255, 243, 230]], [7500, [238, 240, 255]], [10000, [205, 216, 255]], [20000, [172, 192, 255]], [40000, [150, 172, 255]]];
  function tCol(Tk) {
    let i = 0; while (i < TC.length - 2 && Tk > TC[i + 1][0]) i++;
    const [t1, c1] = TC[i], [t2, c2] = TC[i + 1], q = clamp((Tk - t1) / (t2 - t1), 0, 1);
    return `rgb(${c1.map((v, j) => Math.round(v + (c2[j] - v) * q)).join(',')})`;
  }
  function drawHR(s, d) {
    const x = s.x, W = s.W, H = s.H, x0 = 74, x1 = W - 18, y0 = H - 52, y1 = 22;
    const X = Tk => x0 + (HR.tMax - Math.log10(Tk)) / (HR.tMax - HR.tMin) * (x1 - x0);
    const Yl = L => y0 - (Math.log10(L) - HR.lMin) / (HR.lMax - HR.lMin) * (y0 - y1);
    x.fillStyle = '#0b1019'; x.fillRect(0, 0, W, H);
    x.strokeStyle = '#26324a'; x.lineWidth = 1.5; x.strokeRect(x0, y1, x1 - x0, y0 - y1);
    x.font = `500 15px ${MONO}`; x.fillStyle = '#8b96ad'; x.textAlign = 'center'; x.textBaseline = 'top';
    [30000, 10000, 6000, 4000, 3000].forEach(t => { const px = X(t); x.beginPath(); x.moveTo(px, y1); x.lineTo(px, y0); x.stroke(); x.fillText(fint(t), px, y0 + 6); });
    x.textAlign = 'right'; x.textBaseline = 'middle';
    [-4, -2, 0, 2, 4, 6].forEach(p => { const py = Yl(10 ** p); x.beginPath(); x.moveTo(x0, py); x.lineTo(x1, py); x.stroke(); x.fillText(p === 0 ? '1' : '10' + SUP[p], x0 - 6, py); });
    x.fillStyle = '#c8d0dd'; x.font = `600 15px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'bottom';
    x.fillText('температура, К (горячие — слева)', (x0 + x1) / 2, H - 6);
    x.save(); x.translate(18, (y0 + y1) / 2); x.rotate(-Math.PI / 2); x.textBaseline = 'middle'; x.fillText('светимость, L☉', 0, 0); x.restore();
    // области
    x.setLineDash([5, 5]); x.lineWidth = 1.5;
    x.strokeStyle = 'rgba(205,216,255,.45)'; x.beginPath(); x.ellipse(X(14000), Yl(0.004), 46, 15, 0, 0, TAU); x.stroke();
    x.strokeStyle = 'rgba(255,180,115,.45)'; x.beginPath(); x.ellipse(X(4300), Yl(150), 42, 20, 0, 0, TAU); x.stroke();
    x.setLineDash([]);
    x.font = `500 14px ${FONT}`; x.textBaseline = 'top';
    x.fillStyle = '#cad7ff'; x.fillText('белые карлики', X(14000), Yl(0.004) + 18);
    x.fillStyle = '#ffc08a'; x.fillText('гиганты', X(4300), Yl(150) + 23);
    // главная последовательность
    x.beginPath();
    for (let i = 0; i <= 40; i++) { const q = msStar(0.2 * Math.pow(150, i / 40)), px = X(q.T), py = Yl(q.L); i ? x.lineTo(px, py) : x.moveTo(px, py); }
    x.strokeStyle = 'rgba(114,212,232,.22)'; x.lineWidth = 18; x.lineCap = 'round'; x.stroke();
    x.strokeStyle = '#72d4e8'; x.lineWidth = 1.5; x.stroke();
    // известные звёзды
    x.font = `500 13px ${FONT}`; x.textAlign = 'left'; x.textBaseline = 'bottom';
    (d.refs || []).forEach(r => { const px = X(r.T), py = Yl(r.L); x.fillStyle = tCol(r.T); x.beginPath(); x.arc(px, py, 4, 0, TAU); x.fill(); x.fillStyle = '#8b96ad'; x.fillText(r.n, px + 6, py - 3); });
    // ваша звезда
    const px = X(d.T), py = Yl(d.L);
    x.fillStyle = d.col; x.globalAlpha = 0.25; x.beginPath(); x.arc(px, py, 18, 0, TAU); x.fill(); x.globalAlpha = 1;
    x.beginPath(); x.arc(px, py, 9, 0, TAU); x.fill(); x.strokeStyle = '#ffb547'; x.lineWidth = 3; x.stroke();
    x.fillStyle = '#ffb547'; x.font = `700 16px ${MONO}`; x.textAlign = 'center'; x.textBaseline = 'bottom'; x.fillText(d.mtxt + ' M☉', clamp(px, x0 + 50, x1 - 50), py - 14);
    s.tex.needsUpdate = true;
  }
  SC['astro-stars'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    // табло диаграммы Г–Р
    const bd = K.board(-26, -32, 58, 40, 600, 414, 8);
    drawHR(bd.s, d);
    // ваша звезда на подставке
    const SXs = 22, SZ = 6, rs = clamp(4.2 * Math.pow(d.R, 0.45), 1.8, 13), Ys = 8 + rs;
    const st = new T.Group(); at(st, SXs, 0, SZ); clickable(st, 'm+');
    at(cyl(6, 2, 0x2c3240, { seg: 32 }), 0, 1, 0, st);
    at(cyl(0.7, 6, C.BRASS, { seg: 10 }), 0, 5, 0, st);
    const star = mesh(new T.SphereGeometry(rs, 36, 24), 0, { mat: K.basic(new T.Color(d.col).getHex()), hull: true, edges: false }); at(star, 0, Ys, 0, st);
    const sg = K.glow(new T.Color(d.col).getHex(), rs * 3.6, 0.75); at(sg, 0, Ys, 0, st);
    // модель Солнца для сравнения: нажатие — «как Солнце»
    const su = new T.Group(); at(su, -6, 0, 18); clickable(su, 'sun');
    at(cyl(3.6, 1.6, 0x2c3240, { seg: 24 }), 0, 0.8, 0, su);
    at(cyl(0.5, 5, C.BRASS, { seg: 8 }), 0, 4, 0, su);
    at(mesh(new T.SphereGeometry(4.2, 28, 18), 0, { mat: K.basic(0xfff3e6), hull: true, edges: false }), 0, 10.6, 0, su);
    at(K.glow(0xffe0a0, 15, 0.5), 0, 10.6, 0, su);
    // колба «запас водорода»: уровень — по сроку жизни (шкала логарифмическая)
    const fx = 50, fz = -4, fH = 30, fr = clamp((Math.log10(d.life) + 3) / 6, 0.03, 1);
    at(cyl(5, 2, 0x2c3240, { seg: 24 }), fx, 1, fz);
    at(mesh(new T.CylinderGeometry(3.6, 3.6, fH, 28, 1, true), 0, { mat: K.own(0xbfe0ff, { transparent: true, opacity: 0.22, depthWrite: false, side: T.DoubleSide }), edges: false, shadow: false }), fx, 2 + fH / 2, fz);
    const fill = cyl(3.2, fH * fr, d.life < 0.1 ? 0xff8a73 : 0x72d4e8, { seg: 24, edges: false }); at(fill, fx, 2 + fH * fr / 2, fz);
    at(cyl(3.9, 1.2, C.STEEL, { seg: 24 }), fx, 2.6 + fH, fz);
    const lp = K.plate('запас водорода', 12, 2.2, '#fff6e6', '#2c3240'); at(lp, fx, 1, fz + 5.1);
    // пульт
    const pu = K.console3(42, 44, 30, 'масса звезды');
    const ms = K.plate(d.mtxt + ' M☉', 10, 3.6, '#ffb547', '#0e1520'); at(ms, -8.5, 8, 4.56, pu);
    K.button(pu, 2.5, 8, 4.7, 'M −', 'm-', { w: 6.4, h: 3.6 }); K.button(pu, 9.8, 8, 4.7, 'M +', 'm+', { w: 6.4, h: 3.6 });
    K.button(pu, -5, 3, 4.7, 'Как Солнце', 'sun', { w: 14, h: 3.6, col: 0xffd166, bg: '#ffd166' });
    K.button(pu, 8.5, 3, 4.7, 'Сброс', 'reset', { w: 9, h: 3.6 });
    tag(v3(SXs, Ys + rs + 3, SZ), 'Звезда ' + d.mtxt + ' M☉', fint(d.T) + ' К · ' + d.Ltxt + ' L☉', !!(d.hot || d.cool));
    tag(v3(-6, 18, 18), 'Солнце', '5778 К · 1 L☉');
    tag(v3(-26, bd.top + 2, -32), 'Диаграмма Г–Р', d.T < 4000 ? 'красный карлик' : d.M >= 8 ? 'массивная звезда' : 'главная последовательность');
    tag(v3(fx, fH + 6, fz), 'Срок жизни', d.lifeTxt + ' → ' + d.fate, d.life < 0.1);
    kit.onFrame((dt, t) => {
      star.rotation.y += dt * 0.4;
      if (!kit.reduce) sg.scale.setScalar(rs * (3.6 + Math.sin(t * 3) * 0.15));
    });
  };

  // =====================================================================================
  // Урок 3: витрина галактик на подставках, четыре корзины E / S / SB / Irr, модель Млечного Пути с Солнцем
  SC['astro-gal'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const spins = [];
    const bins = d.bins || [];
    // корзины
    const BX = i => -42 + i * 26, BZ = 28;
    bins.forEach((b, i) => {
      const g = new T.Group(); at(g, BX(i), 0, BZ); clickable(g, 'gbin:' + i);
      const rim = d.sel !== null ? 0xffd166 : 0x3a4762;
      at(box(23, 1, 17, 0x141c2e), 0, 0.5, 0, g);
      for (const s of [-1, 1]) { at(box(23, 3, 0.8, rim), 0, 1.5, s * 8.1, g); at(box(0.8, 3, 17, rim), s * 11.1, 1.5, 0, g); }
      const p = K.plate(b.t + ' · ' + b.name, 20, 2.4, '#1b1610', '#f7f3ea'); at(p, 0, 1.6, 8.55, g);
    });
    // галактики: на подставках (ещё не разложены) или в корзинах
    let slot = 0;
    const inBin = bins.map(() => 0);
    (d.gals || []).forEach((g, i) => {
      const m = galaxyModel(kit, K, g, g.bin === null ? 1 : 0.62); spins.push(m.spin);
      if (g.bin === null) {
        const sel = d.sel === i, x = -56 + slot * 16, z = -20; slot++;
        const st = new T.Group(); at(st, x, 0, z); clickable(st, 'gsel:' + i);
        at(cyl(3, 1.4, 0x2c3240, { seg: 20 }), 0, 0.7, 0, st);
        at(cyl(0.5, sel ? 10 : 7, C.BRASS, { seg: 8 }), 0, 1.4 + (sel ? 5 : 3.5), 0, st);
        m.G.rotation.x = 0.55; at(m.G, 0, sel ? 14 : 11, 0, st);
        if (sel) { const r = new T.Mesh(kit.keep(new T.TorusGeometry(7.4, 0.3, 6, 48)), K.basic(0xffd166)); r.rotation.x = Math.PI / 2 + 0.55; at(r, 0, 14, 0, st); }
        tag(v3(x, sel ? 22 : 18, z), sel ? g.n : '', sel ? 'выбрана — нажмите корзину' : g.n, sel);
      } else {
        const n = inBin[g.bin]++, x = BX(g.bin) + (n ? 5.5 : -5.5);
        m.G.rotation.x = 0.35; at(m.G, x, 3.2, BZ - 1, kit.root);
        tag(v3(x, 7, BZ - 1), '', g.n.split(' ')[0]);
      }
    });
    if (slot === 0) tag(v3(-20, 12, -20), 'Готово', 'все галактики на местах', true);
    // Млечный Путь: диск с перемычкой, Солнце обращается по своей орбите
    const MX = 52, MZ = -8;
    at(cyl(4, 1.6, 0x2c3240, { seg: 24 }), MX, 0.8, MZ);
    at(cyl(0.7, 8, C.BRASS, { seg: 8 }), MX, 5.6, MZ);
    const mw = galaxyModel(kit, K, { t: 'SB' }, 2.1); mw.G.rotation.x = 0.3; at(mw.G, MX, 10, MZ);
    const rS = clamp(d.Rg / 50000, 0.1, 1) * 13;
    const ring = new T.Mesh(kit.keep(new T.TorusGeometry(rS, 0.12, 6, 96)), K.basic(0xffd166, { transparent: true, opacity: 0.7 })); ring.rotation.x = Math.PI / 2; mw.G.add(ring);
    const sunDot = mesh(new T.SphereGeometry(0.8, 12, 8), 0, { mat: K.basic(0xffd25a), edges: false }); mw.G.add(sunDot);
    sunDot.add(K.glow(0xffc04a, 5, 0.8));
    // кнопка «начать заново»
    const pu = K.console3(-52, 46, 18, '');
    K.button(pu, 0, 6, 4.7, 'Заново', 'reset', { w: 12, h: 4 });
    tag(v3(MX, 22, MZ), 'Млечный Путь · SB', 'галакт. год ≈ ' + fint(d.Tg) + ' млн лет');
    tag(v3(-3, 8, BZ + 10), 'Корзины Хаббла', 'на местах ' + d.placed + '/6 · ошибок ' + d.wrong, d.placed >= 6);
    let ang = 0;
    kit.onFrame(dt => {
      if (kit.reduce) return;
      spins.forEach(s => { s.rotation.y += dt * 0.25; });
      mw.spin.rotation.y += dt * 0.12;
      ang += dt * 0.4 * (d.vg / 230) / (d.Rg / 26000);
      sunDot.position.set(rS * Math.cos(ang), 0.4, -rS * Math.sin(ang));
    });
    sunDot.position.set(rS, 0.4, 0);
  };

  // =====================================================================================
  // Урок 4: галактики-модели вдали, телескоп со спектрографом, экран спектра с меткой, табло закона Хаббла, пульт
  function drawSpec(s, d) {
    const x = s.x, W = s.W, H = s.H, x0 = 30, x1 = W - 30, l0 = 640, l1 = 700, L = l => x0 + (l - l0) / (l1 - l0) * (x1 - x0);
    x.fillStyle = '#0b1019'; x.fillRect(0, 0, W, H);
    const strip = (y, lam, lab) => {
      const g = x.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, '#ff9a1a'); g.addColorStop(0.5, '#ff4a12'); g.addColorStop(1, '#a8061c');
      x.fillStyle = g; x.fillRect(x0, y, x1 - x0, 46);
      x.fillStyle = '#05070c'; x.fillRect(L(lam) - 2.5, y, 5, 46);
      x.fillStyle = '#c8d0dd'; x.font = `500 17px ${FONT}`; x.textAlign = 'left'; x.textBaseline = 'bottom'; x.fillText(lab, x0, y - 5);
    };
    strip(36, 656.3, 'лаборатория: водород, Hα = 656,3 нм');
    strip(122, d.lt, 'галактика ' + d.gn + ', ' + d.gd + ' Мпк');
    x.strokeStyle = 'rgba(232,236,244,.5)'; x.setLineDash([3, 4]); x.lineWidth = 1.5; x.beginPath(); x.moveTo(L(656.3), 82); x.lineTo(L(656.3), 168); x.stroke(); x.setLineDash([]);
    x.strokeStyle = '#8b96ad'; x.fillStyle = '#8b96ad'; x.font = `500 15px ${MONO}`; x.textAlign = 'center'; x.textBaseline = 'top';
    for (let l = 640; l <= 700; l += 2) { const px = L(l), big = l % 10 === 0; x.beginPath(); x.moveTo(px, 168); x.lineTo(px, 168 + (big ? 12 : 6)); x.stroke(); if (big) x.fillText(l, px, 184); }
    const mx = L(d.lam);
    x.strokeStyle = '#ffd54a'; x.lineWidth = 4; x.beginPath(); x.moveTo(mx, 114); x.lineTo(mx, 172); x.stroke();
    x.fillStyle = '#ffd54a'; x.beginPath(); x.moveTo(mx, 172); x.lineTo(mx - 10, 190); x.lineTo(mx + 10, 190); x.closePath(); x.fill();
    x.font = `700 19px ${MONO}`; x.textBaseline = 'top'; x.fillText('метка ' + num(d.lam, 1) + ' нм', clamp(mx, x0 + 90, x1 - 90), 206);
    x.fillStyle = '#86e0a8'; x.font = `600 17px ${MONO}`; x.fillText('z = ' + num((d.lam - 656.3) / 656.3, 4) + '   v ≈ ' + fint(299792 * (d.lam - 656.3) / 656.3) + ' км/с', W / 2, 236);
    s.tex.needsUpdate = true;
  }
  function drawPlot(s, d) {
    const x = s.x, W = s.W, H = s.H, x0 = 86, x1 = W - 20, y0 = H - 48, y1 = 30, dMax = 220, vMax = 16000;
    const PX = q => x0 + q / dMax * (x1 - x0), PY = v => y0 - v / vMax * (y0 - y1);
    x.fillStyle = '#0b1019'; x.fillRect(0, 0, W, H);
    x.strokeStyle = '#26324a'; x.lineWidth = 1.5; x.strokeRect(x0, y1, x1 - x0, y0 - y1);
    x.fillStyle = '#8b96ad'; x.font = `500 15px ${MONO}`; x.textAlign = 'center'; x.textBaseline = 'top';
    for (let q = 0; q <= 200; q += 50) x.fillText(q, PX(q), y0 + 6);
    x.textAlign = 'right'; x.textBaseline = 'middle';
    for (let v = 0; v <= 16000; v += 4000) x.fillText(fint(v), x0 - 6, PY(v));
    x.fillStyle = '#c8d0dd'; x.font = `600 15px ${FONT}`; x.textAlign = 'right'; x.textBaseline = 'bottom'; x.fillText('расстояние d, Мпк', x1, H - 4);
    x.textAlign = 'left'; x.fillText('скорость удаления v, км/с', x0 + 4, y1 - 6);
    const cur = (d.gx || [])[d.gi];
    if (cur && cur.v === null) { x.strokeStyle = 'rgba(255,181,71,.6)'; x.setLineDash([3, 5]); x.beginPath(); x.moveTo(PX(cur.d), y1); x.lineTo(PX(cur.d), y0); x.stroke(); x.setLineDash([]); x.fillStyle = '#ffb547'; x.font = `600 15px ${MONO}`; x.textAlign = 'left'; x.textBaseline = 'top'; x.fillText(cur.n + ' ?', PX(cur.d) + 5, y1 + 6); }
    if (d.nrec >= 2 && isFinite(d.H)) {
      x.strokeStyle = '#86e0a8'; x.lineWidth = 2.5; x.setLineDash([9, 6]); x.beginPath(); x.moveTo(PX(0), PY(0)); x.lineTo(PX(dMax), PY(d.H * dMax)); x.stroke(); x.setLineDash([]);
      x.fillStyle = '#86e0a8'; x.font = `700 17px ${MONO}`; x.textAlign = 'right'; x.textBaseline = 'bottom'; x.fillText('H₀ ≈ ' + fint(d.H) + ' км/(с·Мпк)', PX(150) - 6, PY(d.H * 150) - 10);
    }
    (d.gx || []).forEach(g => {
      if (g.v === null) return;
      x.fillStyle = '#ffb547'; x.beginPath(); x.arc(PX(g.d), PY(g.v), 7, 0, TAU); x.fill(); x.strokeStyle = '#04070d'; x.lineWidth = 2; x.stroke();
      x.font = `600 15px ${MONO}`; x.textAlign = 'left'; x.textBaseline = 'top'; x.fillText(g.n, PX(g.d) + 9, PY(g.v) + 6);
    });
    s.tex.needsUpdate = true;
  }
  SC['astro-hubble'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const spins = [];
    // тёмная полоса «неба» с галактиками на тонких стойках: дальше — меньше и глубже
    at(box(70, 0.6, 30, 0x141c2e, { edges: false }), -32, 0.3, -34);
    K.starDust(90, -32, -34, 15, 0.8, 0.6).scale.set(2.2, 1, 1);
    const gpos = [];
    (d.gx || []).forEach((g, i) => {
      const s = clamp(0.75 * Math.pow(20 / g.d, 0.3), 0.3, 0.8), x = -60 + i * 14, z = -24 - g.d * 0.1, y = 14 + i * 2.2;
      const st = new T.Group(); at(st, x, 0, z); clickable(st, 'g:' + i);
      at(cyl(1.8, 1, 0x2c3240, { seg: 16 }), 0, 0.5, 0, st);
      at(cyl(0.25, y - 1, C.STEEL, { seg: 6, edges: false }), 0, 1 + (y - 1) / 2 - 0.5, 0, st);
      const m = galaxyModel(kit, K, { t: i % 2 ? 'E' : 'S', ratio: 0.7 }, s); m.G.rotation.x = 0.7; at(m.G, 0, y, 0, st); spins.push(m.spin);
      if (i === d.gi) { const r = new T.Mesh(kit.keep(new T.TorusGeometry(6 * s + 1.6, 0.25, 6, 40)), K.basic(0xffd166)); r.rotation.x = Math.PI / 2 + 0.7; at(r, 0, y, 0, st); }
      gpos.push(v3(x, y, z));
      tag(v3(x, y + 5, z), '', g.n + ' · ' + g.d + ' Мпк' + (g.v !== null ? ' ✓' : ''), i === d.gi);
    });
    // телескоп на треноге, смотрит на выбранную галактику
    const TX = 14, TY = 16, TZ = 12, tgt = gpos[d.gi] || v3(-30, 20, -30);
    for (let k = 0; k < 3; k++) { const a = k * TAU / 3 + 0.4, lg = K.rod(0x3a4152, 0.45); kit.root.add(lg.m); lg.set(v3(TX + 7 * Math.cos(a), 0, TZ + 7 * Math.sin(a)), v3(TX, TY - 2, TZ)); }
    at(box(3, 3, 3, 0x2c3240), TX, TY - 1.5, TZ);
    const tube = new T.Group(); at(tube, TX, TY, TZ);
    const tb = cyl(2.4, 22, 0xeef1f6, { seg: 24 }); tb.rotation.x = Math.PI / 2; at(tb, 0, 0, -4, tube);
    const dew = cyl(2.8, 4, 0x2c3240, { seg: 24 }); dew.rotation.x = Math.PI / 2; at(dew, 0, 0, -15.5, tube);
    at(box(5, 5, 6, 0x3b6fd8), 0, 0, 9.5, tube); // спектрограф на окулярном конце
    tube.lookAt(tgt); tube.rotateY(Math.PI); // тубус смотрит объективом (−z) на галактику
    tube.updateMatrixWorld(true);
    const obj = v3(0, 0, -17.5).applyMatrix4(tube.matrixWorld);
    // луч света от галактики к телескопу и «фотоны» — краснее, чем сильнее смещение линии
    const zf = clamp((d.lt - 656.3) / 30, 0, 1), phCol = new T.Color(0xffe6a0).lerp(new T.Color(0xff3a1a), zf);
    const beam = K.rod(0, 0.18, K.basic(phCol.getHex(), { transparent: true, opacity: 0.35, depthWrite: false })); kit.root.add(beam.m); beam.set(tgt, obj);
    const phot = []; for (let i = 0; i < 6; i++) { const p = K.glow(phCol.getHex(), 3.2, 0.9); kit.root.add(p); phot.push(p); }
    // экран спектра
    const sp = K.board(-26, 30, 46, 23, 560, 280, 6);
    drawSpec(sp.s, d);
    const cab = K.rod(0x2a2f3a, 0.4); kit.root.add(cab.m); cab.set(v3(0, 0, 9.5).applyMatrix4(tube.matrixWorld), v3(-4, 12, 30));
    // табло закона Хаббла
    const hp = K.board(38, -22, 42, 30, 480, 344, 8);
    drawPlot(hp.s, d);
    // пульт
    const pu = K.console3(42, 45, 32, 'метка λ');
    [['−1 нм', 'l--'], ['−0,1', 'l-'], ['+0,1', 'l+'], ['+1 нм', 'l++']].forEach(([t, key], i) => K.button(pu, -10.8 + i * 7.2, 8, 4.7, t, key, { w: 6.6, h: 3.6 }));
    K.button(pu, 0, 3, 4.7, 'Записать замер', 'rec', { w: 22, h: 3.6, col: 0xe0473a, bg: '#e0473a', fg: '#ffffff' });
    tag(v3(TX, TY + 6, TZ), 'Телескоп + спектрограф', 'галактика ' + d.gn);
    tag(v3(-26, sp.top + 2, 30), 'Спектр', 'λ = ' + num(d.lam, 1) + ' нм · Δλ = ' + num(d.lam - 656.3, 1) + ' нм');
    tag(v3(38, hp.top + 2, -22), 'Закон Хаббла', d.nrec ? 'замеры ' + d.nrec + '/3 · H₀ ≈ ' + fint(d.H) : 'замеров пока нет', d.nrec >= 3);
    const dv = v3(), tmp = v3();
    kit.onFrame((dt, t) => {
      if (kit.reduce) { phot.forEach((p, i) => p.position.copy(tgt).lerp(obj, (i + 0.5) / phot.length)); return; }
      spins.forEach(s => { s.rotation.y += dt * 0.3; });
      dv.copy(obj).sub(tgt);
      phot.forEach((p, i) => { const f = ((t * 0.35 + i / phot.length) % 1); p.position.copy(tgt).addScaledVector(dv, f); });
      void tmp;
    });
  };
})();
