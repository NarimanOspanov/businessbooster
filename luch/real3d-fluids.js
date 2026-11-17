// «Как в жизни» для темы «Жидкости и газы в движении» (labs/phys-fluids): прозрачный шланг с наконечником-зажимом
// и струёй до клумбы, трубка Вентури с тремя манометрическими трубками и бачком, два листа бумаги под воздуходувкой,
// аэродинамическая труба с крылом на весах и с телами разной формы на динамометре.
// Сцены строятся из window.LUCH_REAL() опыта; скорость потока, сечение наконечника, уровни в трубках, угол атаки
// и показания приборов (меняются плавно) — из window.LUCH_REAL.live() каждый кадр. Набор деталей kit — из /luch/real3d.js.
(() => {
  const SC = (window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {});
  const WATER = 0x5fb4d9, GLASSC = 0xcfe6f2, STEELC = 0xa9b4c9, RED = 0xe0473a, ORANGE = 0xffb547, TEAL = 0x2b6d7c,
    GREEN = 0x86e0a8, CASE = 0x3b4a66, SMOKE = 0xf2f7fb, SOIL = 0x5a3b24, LEAF = 0x3fae5a;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const fmt = (x, n = 1) => { let s = (Math.round(x * 10 ** n) / 10 ** n).toFixed(n); if (/^-0(\.0+)?$/.test(s)) s = s.slice(1); return s.replace('.', ',').replace('-', '−'); };
  const nf = x => Math.abs(x - Math.round(x)) < 1e-9 ? String(Math.round(x)) : fmt(x, 1);
  const live = () => { try { return (window.LUCH_REAL && window.LUCH_REAL.live && window.LUCH_REAL.live()) || {}; } catch (e) { return {}; } };
  const follow = (cur, tgt, dt, k = 6) => (Math.abs(tgt - cur) < 1e-3 ? tgt : cur + (tgt - cur) * Math.min(1, dt * k));
  const smooth = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  // последняя созданная подпись: её значение и место меняем каждый кадр, не перестраивая сцену
  const lastTag = () => { const l = document.querySelectorAll('.rl-view .rl-lbl'); return l[l.length - 1] || null; };
  function liveTag(kit, p, name, value, hot) {
    kit.tag(p, name, value, hot);
    const el = lastTag(), i = el && el.querySelector('i');
    let shown = value;
    return { p, set(v) { if (i && v !== shown) { shown = v; i.textContent = v; } } };
  }

  // ---------- общие детали ----------
  function H(kit) {
    const { T, keep, grad, mesh, cyl, at } = kit;
    const glassMat = (op = 0.2) => keep(new T.MeshToonMaterial({ color: GLASSC, gradientMap: grad, transparent: true, opacity: op, side: T.DoubleSide, depthWrite: false }));
    const liqMat = (color = WATER, op = 0.55) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, transparent: true, opacity: op, depthWrite: false }));
    // цилиндр вдоль оси x
    const xcyl = (r, len, color, o = {}) => { const m = cyl(r, len, color, o); m.rotation.z = -Math.PI / 2; return m; };
    // много одинаковых шариков (метки воды, дым): put(i, x, y, z, s) — поставить, flush() — показать
    function dots(n, r, color, emissive) {
      const m = new T.InstancedMesh(keep(new T.SphereGeometry(r, 10, 8)), kit.toon(color, emissive ? { emissive: color, emissiveIntensity: 0.35 } : {}), n);
      m.instanceMatrix.setUsage(T.DynamicDrawUsage); m.frustumCulled = false; m.castShadow = false; kit.root.add(m);
      const M = new T.Matrix4();
      m.put = (i, x, y, z, s = 1) => { M.makeScale(s, s, s); M.setPosition(x, y, z); m.setMatrixAt(i, M); };
      m.hideAll = () => { for (let i = 0; i < n; i++) m.put(i, 0, -999, 0, 0.001); };
      m.flush = () => { m.instanceMatrix.needsUpdate = true; };
      m.hideAll(); m.flush();
      return m;
    }
    // отрезок-цилиндр между двумя точками (струя, стержень); span(a, b) двигает его каждый кадр
    function piece(r, mat) {
      const m = mesh(new T.CylinderGeometry(r, r, 1, 12), 0, { mat, edges: false, shadow: false });
      kit.root.add(m);
      const Y1 = new T.Vector3(0, 1, 0), d = new T.Vector3();
      m.span = (a, b, rr) => {
        d.copy(b).sub(a); const L = d.length(); m.visible = L > 0.05; if (!m.visible) return;
        m.position.copy(a).addScaledVector(d, 0.5); m.scale.set(rr || 1, L, rr || 1); m.quaternion.setFromUnitVectors(Y1, d.normalize());
      };
      return m;
    }
    // стрелка силы вдоль +y внутри группы; setLen(L) меняет длину
    function arrow(color) {
      const g = new T.Group();
      const sh = cyl(0.5, 1, color, { seg: 12, edges: false, matOpt: { emissive: color, emissiveIntensity: 0.3 } }); g.add(sh);
      const hd = cyl(1.3, 2.4, color, { r2: 0.02, seg: 14, edges: false, matOpt: { emissive: color, emissiveIntensity: 0.3 } }); g.add(hd);
      g.setLen = L => { g.visible = L > 0.6; const s = Math.max(0.2, L - 2.4); sh.scale.y = s; sh.position.y = s / 2; hd.position.y = s + 1.2; };
      g.setLen(5); return g;
    }
    function canvasTex(w, h, draw) {
      const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
      draw(x, w, h); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return keep(t);
    }
    const flat = (w, h, tex, o = {}) => new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: tex, transparent: true, ...o })));
    function label(parent, txt, x, y, z, w, hgt, flatOnTable) {
      const p = flat(w, hgt, keep(kit.textTex(txt, '#1b1610', '#f7f3ea', Math.round(64 * w / hgt), 64)));
      if (flatOnTable) p.rotation.x = -Math.PI / 2;
      at(p, x, y, z, parent); return p;
    }
    return { glassMat, liqMat, xcyl, dots, piece, arrow, canvasTex, flat, label };
  }

  // =====================================================================================
  // 1. Шланг с наконечником на высоте 1 м, струя до клумбы
  SC['fluids-pipe'] = (kit, d) => {
    const { T, at, box, cyl, clickable, v3, C } = kit, h = H(kit);
    const K = 21, Y0 = K * (d.H || 1), R1 = 2.4, XA = -46, XW = -16, XC = -11, XN = -4, A1 = R1 * R1, S1 = d.S1 || 3;
    const tF = Math.sqrt(2 * (d.H || 1) / 9.8);
    // стена с краном
    at(box(5, 34, 24, 0x3a3346), XA - 6, 17, 0);
    const tap = new T.Group(); at(tap, XA - 1, Y0, 0); clickable(tap, 'qcycle');
    at(box(4, 5, 5, STEELC), 0, 0, 0, tap); at(cyl(0.8, 4, STEELC, { edges: false }), 0, 4.4, 0, tap);
    const wheel = kit.mesh(new T.TorusGeometry(2.2, 0.55, 8, 20), RED, { edges: false }); wheel.rotation.x = Math.PI / 2; at(wheel, 0, 6.6, 0, tap);
    // подставки под шланг
    [XA + 8, XW - 6].forEach(x => { at(box(6, 1, 6, C.WOOD2), x, 0.5, 0); at(cyl(0.6, Y0 - R1 - 1, STEELC, { edges: false }), x, (Y0 - R1) / 2 + 0.5, 0); at(box(3, 0.8, 2, STEELC), x, Y0 - R1 - 0.3, 0); });
    // шланг: стекло и вода
    at(h.xcyl(R1 + 0.4, XW - XA, 0, { mat: h.glassMat(0.22), hull: false, shadow: false }), (XA + XW) / 2, Y0, 0);
    at(h.xcyl(R1, XW - XA, 0, { mat: h.liqMat(WATER, 0.5), hull: false, edges: false, shadow: false }), (XA + XW) / 2, Y0, 0);
    // наконечник: держатель-кликабельный, внутри меняем сужение
    const noz = new T.Group(); at(noz, 0, Y0, 0); clickable(noz, 'squeeze');
    let nozIn = null, r2c = -1;
    const buildNoz = r2 => {
      if (nozIn) noz.remove(nozIn);
      nozIn = new T.Group(); noz.add(nozIn);
      const cone = h.xcyl(R1 + 0.4, XC - XW, 0, { r2: r2 + 0.4, mat: h.glassMat(0.24), hull: false, shadow: false }); at(cone, (XW + XC) / 2, 0, 0, nozIn);
      const wc = h.xcyl(R1, XC - XW, 0, { r2, mat: h.liqMat(WATER, 0.5), hull: false, edges: false, shadow: false }); at(wc, (XW + XC) / 2, 0, 0, nozIn);
      at(h.xcyl(r2 + 0.4, XN - XC, 0, { mat: h.glassMat(0.24), hull: false, shadow: false }), (XC + XN) / 2, 0, 0, nozIn);
      at(h.xcyl(r2, XN - XC, 0, { mat: h.liqMat(WATER, 0.5), hull: false, edges: false, shadow: false }), (XC + XN) / 2, 0, 0, nozIn);
      // зажим-хомут с оранжевым винтом
      const ring = kit.mesh(new T.TorusGeometry(r2 + 0.9, 0.45, 8, 20), STEELC, { edges: false }); ring.rotation.y = Math.PI / 2; at(ring, (XC + XN) / 2, 0, 0, nozIn);
      at(cyl(0.35, 2.6, STEELC, { edges: false }), (XC + XN) / 2, -r2 - 2.2, 0, nozIn);
      const knob = kit.mesh(new T.TorusGeometry(1, 0.38, 8, 16), ORANGE, { edges: false, matOpt: { emissive: ORANGE, emissiveIntensity: 0.25 } }); knob.rotation.x = Math.PI / 2; at(knob, (XC + XN) / 2, -r2 - 3.6, 0, nozIn);
      r2c = r2;
    };
    // клумба и разметка по столу
    const xb0 = XN + d.bed[0] * K, xb1 = XN + d.bed[1] * K;
    at(box(xb1 - xb0, 1.6, 18, SOIL), (xb0 + xb1) / 2, 0.8, 0);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
      const fx = xb0 + 1.2 + i * (xb1 - xb0 - 2.4) / 5, fz = -6 + j * 6;
      at(cyl(0.18, 2.6, LEAF, { edges: false, hull: false }), fx, 2.9, fz);
      at(new T.Mesh(kit.keep(new T.SphereGeometry(0.75, 10, 8)), kit.toon([0xff8a73, 0xffd166, 0xf2a2d6][(i + j) % 3])), fx, 4.3, fz);
    }
    for (let m = 0; m <= 3.001; m += 0.5) {
      const x = XN + m * K; if (x > 68) break;
      at(box(0.35, 0.12, m % 1 ? 3 : 6, 0x1b1610, { edges: false, shadow: false }), x, 0.08, 15);
      if (m % 1 === 0) h.label(kit.root, m + ' м', x, 0.1, 21, 5, 2.4, true);
    }
    // струя и метки воды
    const jetMat = h.liqMat(WATER, 0.42), NJ = 18, jet = []; for (let i = 0; i < NJ; i++) jet.push(h.piece(1, jetMat));
    const splash = new T.Mesh(kit.keep(new T.CircleGeometry(1, 24)), h.liqMat(WATER, 0.6)); splash.rotation.x = -Math.PI / 2; at(splash, 0, 0.12, 0);
    const ND = 96, pts = h.dots(ND, 0.42, 0xe8f6ff, true);
    const dTag = liveTag(kit, v3((XA + XW) / 2, Y0 + 6, 0), 'Шланг · S₁ = ' + nf(S1) + ' см²', 'v₁');
    const nTag = liveTag(kit, v3(XN - 4, Y0 + 7, 0), 'Наконечник', 'S₂');
    const jTag = liveTag(kit, v3(0, 8, 0), 'Струя', 'L');
    kit.tag(v3(XA - 1, Y0 + 11, 0), 'Кран', 'Q = ' + fmt(d.Q, 2) + ' л/с');
    kit.tag(v3((xb0 + xb1) / 2, 7, 0), 'Клумба', fmt(d.bed[0], 1) + '–' + fmt(d.bed[1], 1) + ' м', false);
    let vol = 0, acc = 1, S2s = live().S2 || S1;
    const lanes = [[0, 0], [0.5, 0.45], [-0.5, -0.4]];
    const pose = dt => {
      const Lv = live(), S2t = Lv.S2 || S1; S2s = kit.reduce ? S2t : follow(S2s, S2t, dt, 8);
      const r2 = R1 * Math.sqrt(S2s / S1);
      if (Math.abs(r2 - r2c) > 0.03) buildNoz(r2);
      const v1 = (Lv.Q || 0) * 10 / S1, v2 = v1 * S1 / S2s, A2 = r2 * r2, Ac = (A1 + R1 * r2 + A2) / 3;
      const rate = v1 * K * A1, xiW = (XW - XA) * A1, xiC = xiW + (XC - XW) * Ac, xiT = xiC + (XN - XC) * A2;
      if (!kit.reduce) vol += rate * dt * 0.35;
      // струя по параболе
      for (let i = 0; i < NJ; i++) {
        const t0 = tF * i / NJ, t1 = tF * (i + 1) / NJ;
        jet[i].span(v3(XN + v2 * t0 * K, Y0 - 4.9 * t0 * t0 * K, 0), v3(XN + v2 * t1 * K, Math.max(0.1, Y0 - 4.9 * t1 * t1 * K), 0), r2 * 0.75);
      }
      const L = v2 * tF; splash.position.x = XN + L * K; splash.scale.setScalar(1.2 + r2 * 0.8);
      // метки воды: по «объёму», поэтому в узкой части они разбегаются
      const dXi = 3.4 * A1, W = xiT + rate * tF * 1.02, N = Math.min(Math.floor(ND / 3), Math.ceil(W / dXi)), Wm = N * dXi;
      let k = 0;
      lanes.forEach(([fy, fz], li) => {
        for (let i = 0; i < N; i++) {
          const xi = ((vol + i * dXi + li * dXi / 3) % Wm + Wm) % Wm;
          let x, y, z, rr;
          if (xi > W) { pts.put(k++, 0, -999, 0, 0.001); continue; }
          if (xi <= xiW) { x = XA + xi / A1; rr = R1; }
          else if (xi <= xiC) { const u = (xi - xiW) / (xiC - xiW); x = XW + u * (XC - XW); rr = R1 + (r2 - R1) * u; }
          else if (xi <= xiT) { x = XC + (xi - xiC) / A2; rr = r2; }
          if (xi <= xiT) { y = Y0 + fy * rr * 0.7; z = fz * rr * 0.7; }
          else { const t = (xi - xiT) / Math.max(1e-6, rate); x = XN + v2 * t * K; y = Y0 + fy * r2 * 0.5 - 4.9 * t * t * K; z = fz * r2 * 0.5; if (y < 0.3) { pts.put(k++, 0, -999, 0, 0.001); continue; } }
          pts.put(k++, x, y, z, 1);
        }
      });
      for (; k < ND; k++) pts.put(k, 0, -999, 0, 0.001);
      pts.flush();
      jTag.p.copy(v3(Math.min(66, XN + L * K), 6, 0)); nTag.p.copy(v3(XN - 4, Y0 + r2 + 5, 0));
      acc += dt;
      if (acc > 0.12) { acc = 0; dTag.set('v₁ = ' + fmt(v1, 1) + ' м/с'); nTag.set('S₂ = ' + fmt(Lv.S2 || S1, 2) + ' см² · v₂ = ' + fmt((Lv.v2 || v2), 1) + ' м/с'); jTag.set('L = ' + fmt(Lv.L != null ? Lv.L : L, 2) + ' м'); }
    };
    pose(1); kit.onFrame(dt => pose(dt));
  };

  // =====================================================================================
  // 2. Трубка Вентури на подставках, три манометрические трубки на фоне шкалы, бачок с краном и раковина
  SC['fluids-venturi'] = (kit, d) => {
    const { T, at, box, cyl, clickable, v3, C } = kit, h = H(kit);
    const PY = 9, R1 = 3.4, n = d.n || 2, R2 = R1 / Math.sqrt(n), KH = 0.62, X = [-50, -21, -9, 9, 22, 50], TX = [-36, 0, 36];
    const rx = x => x <= X[1] ? R1 : x < X[2] ? R1 + (R2 - R1) * smooth((x - X[1]) / (X[2] - X[1])) : x <= X[3] ? R2 : x < X[4] ? R2 + (R1 - R2) * smooth((x - X[3]) / (X[4] - X[3])) : R1;
    // трубка: тело вращения (стекло и вода)
    const prof = pad => { const p = []; for (let i = 0; i <= 100; i++) { const x = X[0] + (X[5] - X[0]) * i / 100; p.push(new T.Vector2(rx(x) + pad, x)); } return p; };
    const vg = new T.Group(); at(vg, 0, PY, 0); vg.rotation.z = -Math.PI / 2; clickable(vg, 'ncycle');
    const gl = kit.mesh(new T.LatheGeometry(prof(0.45), 40), 0, { mat: h.glassMat(0.22), edges: false, shadow: false }); vg.add(gl);
    const wa = kit.mesh(new T.LatheGeometry(prof(0), 40), 0, { mat: h.liqMat(WATER, 0.5), edges: false, shadow: false }); vg.add(wa);
    [X[0], X[5]].forEach(x => { const r = kit.mesh(new T.TorusGeometry(R1 + 0.5, 0.35, 8, 24), STEELC, { edges: false }); r.rotation.y = Math.PI / 2; at(r, x, PY, 0); });
    [-30, 30].forEach(x => { at(box(8, 1, 8, C.WOOD2), x, 0.5, 0); at(box(1.6, PY - R1, 1.6, STEELC), x, (PY - R1) / 2 + 1, 0); });
    // манометрические трубки и вода в них
    const TOP = PY + 62 * KH, cols = [];
    TX.forEach((x, i) => {
      const yb = PY + rx(x);
      at(cyl(1.1, TOP - yb, 0, { mat: h.glassMat(0.24), hull: false, shadow: false }), x, (TOP + yb) / 2, 0);
      const c = cyl(0.85, 1, 0x2f8fd0, { hull: false, edges: false, matOpt: { emissive: 0x2f8fd0, emissiveIntensity: 0.25 } }); at(c, x, PY, 0); cols.push(c);
    });
    // шкала за трубками: деления через 10 см от оси трубы
    const bw = 92, bh = TOP - PY + 2;
    const board = h.flat(bw, bh, h.canvasTex(920, Math.round(920 * bh / bw), (x, w, hh) => {
      x.fillStyle = '#f2ead6'; x.fillRect(0, 0, w, hh); x.strokeStyle = '#3b3320'; x.fillStyle = '#3b3320'; x.font = '600 26px "IBM Plex Mono", monospace';
      for (let c = 0; c <= 60; c += 5) { const y = hh - (c * KH + 1) / bh * hh; x.lineWidth = c % 10 ? 1 : 2.4; x.globalAlpha = c % 10 ? 0.35 : 0.7; x.beginPath(); x.moveTo(c % 10 ? 30 : 0, y); x.lineTo(w, y); x.stroke(); x.globalAlpha = 1; if (c % 10 === 0 && c) x.fillText(c + ' см', 6, y - 6); }
    }), { transparent: false });
    at(board, 0, PY - 1 + bh / 2, -4);
    at(box(bw + 1, bh + 1, 0.6, 0x3a2e22), 0, PY - 1 + bh / 2, -4.5);
    // бачок с краном слева, раковина справа
    const tank = new T.Group(); at(tank, -61, 0, 0); clickable(tank, 'qinc');
    at(box(12, 22, 14, 0, { mat: h.glassMat(0.25), hull: false, shadow: false }), 0, 11, 0, tank);
    at(box(11, 17, 13, 0, { mat: h.liqMat(WATER, 0.45), edges: false, hull: false, shadow: false }), 0, 8.6, 0, tank);
    at(h.xcyl(1.6, 6, STEELC), 8, PY, 0, tank);
    const vw = kit.mesh(new T.TorusGeometry(2, 0.5, 8, 20), RED, { edges: false }); vw.rotation.x = Math.PI / 2; at(vw, 8.5, PY + 4.4, 0, tank); at(cyl(0.4, 3, STEELC, { edges: false }), 8.5, PY + 2.6, 0, tank);
    at(box(14, 4, 16, 0x9aa3b2), 60, 2, 0); at(box(12, 0.4, 14, 0, { mat: h.liqMat(WATER, 0.6), edges: false, hull: false }), 60, 3.9, 0);
    const fall = h.piece(1, h.liqMat(WATER, 0.5));
    // метки воды
    const ND = 90, pts = h.dots(ND, 0.45, 0xe8f6ff, true), xs = [], vs = []; let acc0 = 0;
    for (let i = 0; i <= 200; i++) { const x = X[0] + (X[5] - X[0]) * i / 200; xs.push(x); vs.push(acc0); acc0 += rx(x + 0.25) ** 2 * (X[5] - X[0]) / 200; }
    const tot = vs[200], xOf = v => { let lo = 0, hi = 200; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (vs[m] <= v) lo = m; else hi = m; } return xs[lo] + (v - vs[lo]) / ((vs[hi] - vs[lo]) || 1) * (xs[hi] - xs[lo]); };
    const tags = TX.map((x, i) => liveTag(kit, v3(x, TOP + 3, 0), 'Трубка ' + (i + 1), 'h'));
    const qTag = liveTag(kit, v3(-61, 26, 0), 'Кран', 'Q');
    kit.tag(v3(0, PY - 5, 8), 'Сужение', n === 1 ? 'нет' : 'S₂ = S₁ / ' + n);
    const hs = [d.h1 || 50, d.h1 || 50, d.h1 || 50]; let vol = 0, acc = 1;
    const lanes = [[0, 0], [0.5, 0.4], [-0.5, -0.45]];
    const pose = dt => {
      const Lv = live(), tg = [Lv.h1, Lv.h2, Lv.h3];
      for (let i = 0; i < 3; i++) { hs[i] = kit.reduce ? (tg[i] || 0) : follow(hs[i], tg[i] || 0, dt, 3); const hh = Math.max(0.05, hs[i] * KH); cols[i].scale.y = hh; cols[i].position.y = PY + hh / 2; cols[i].visible = hs[i] > 0.2; }
      const v1 = Lv.v1 || 0;
      if (!kit.reduce) vol += v1 * 12 * R1 * R1 * dt;
      const dXi = 3.2 * R1 * R1, N = Math.min(30, Math.ceil(tot / dXi)), Wm = N * dXi;
      let k = 0;
      lanes.forEach(([fy, fz], li) => { for (let i = 0; i < N; i++) { const xi = ((vol + i * dXi + li * dXi / 3) % Wm + Wm) % Wm; if (v1 <= 0 || xi > tot) { pts.put(k++, 0, -999, 0, 0.001); continue; } const x = xOf(xi), r = rx(x); pts.put(k++, x, PY + fy * r * 0.7, fz * r * 0.7, 1); } });
      for (; k < ND; k++) pts.put(k, 0, -999, 0, 0.001);
      pts.flush();
      fall.span(v3(X[5] + 1.5, PY - 1, 0), v3(X[5] + 6, 4, 0), v1 > 0 ? 0.6 + v1 * 1.2 : 0.01); fall.visible = v1 > 0;
      acc += dt;
      if (acc > 0.12) { acc = 0; tags.forEach((t, i) => t.set((tg[i] || 0) < 0 ? 'разрежение' : 'h = ' + Math.round(tg[i] || 0) + ' см')); qTag.set('Q = ' + fmt(Lv.Q || 0, 2) + ' л/с'); }
    };
    pose(1); kit.onFrame(dt => pose(dt));
  };

  // =====================================================================================
  // 2б. Два листа бумаги на штативе, воздуходувка дует между ними
  SC['fluids-paper'] = (kit, d) => {
    const { T, at, box, cyl, clickable, v3, C } = kit, h = H(kit);
    const TOP = 40, LEN = 28, GAP = 5.5;
    at(box(20, 1.6, 14, 0x4a5875), -24, 0.8, 0); at(cyl(0.8, 46, STEELC, { edges: false }), -24, 23.5, 0);
    const rod = h.xcyl(0.6, 36, STEELC, { edges: false }); at(rod, -6, TOP + 1, 0);
    const sheets = [-1, 1].map(s => {
      const geo = kit.keep(new T.PlaneGeometry(20, LEN, 1, 18));
      const m = new T.Mesh(geo, kit.keep(new T.MeshToonMaterial({ color: 0xf6f3ea, gradientMap: kit.grad, side: T.DoubleSide })));
      m.castShadow = true; m.rotation.y = Math.PI / 2; at(m, s * GAP, TOP - LEN / 2, 0);
      at(box(1.2, 2, 3, 0x3b6fd8), s * GAP, TOP + 0.4, 0);
      const base = geo.attributes.position.array.slice();
      return { m, geo, base, s };
    });
    // воздуходувка над листами
    const bl = new T.Group(); at(bl, 0, TOP + 10, 0); clickable(bl, 'blow');
    at(box(16, 8, 10, CASE), 10, 0, 0, bl); at(h.xcyl(1.4, 10, STEELC), 0, 0, 0, bl);
    at(cyl(1.4, 7, STEELC, { edges: false }), -4, -3.5, 0, bl);
    const rotor = new T.Group(); at(rotor, 18.2, 0, 0, bl);
    for (let k = 0; k < 3; k++) { const b = box(0.4, 6, 1.4, STEELC, { edges: false }); b.rotation.x = k * 2.094; rotor.add(b); }
    // стрелки атмосферного давления снаружи
    [-1, 1].forEach(s => { const a = h.arrow(0x72d4e8); a.rotation.z = s * Math.PI / 2; at(a, s * (GAP + 12), TOP - LEN * 0.62, 0); a.setLen(7); });
    const ND = 30, air = h.dots(ND, 0.38, SMOKE, true);
    const pTag = liveTag(kit, v3(0, TOP - LEN - 4, 8), 'Между листами', 'Δp');
    const bTag = liveTag(kit, v3(10, TOP + 16, 0), 'Воздуходувка', 'v');
    kit.tag(v3(-GAP - 14, TOP - LEN * 0.62 + 4, 0), 'Снаружи', 'p атм');
    let df = 0, t = 0, acc = 1;
    const pose = dt => {
      const Lv = live(); df = kit.reduce ? (Lv.def || 0) : follow(df, Lv.def || 0, dt, 3); t += dt;
      sheets.forEach(o => {
        const p = o.geo.attributes.position.array;
        for (let i = 0; i < p.length; i += 3) { const y = o.base[i + 1], s = (LEN / 2 - y) / LEN; p[i + 2] = o.base[i + 2] - o.s * 4.6 * df * s * s; }
        o.geo.attributes.position.needsUpdate = true; o.geo.computeVertexNormals();
      });
      rotor.rotation.x += dt * (Lv.vb || 0) * 1.2;
      for (let i = 0; i < ND; i++) {
        const u = ((t * (0.15 + (Lv.vb || 0) * 0.06) + i / ND) % 1), y = TOP + 3 - u * (LEN + 3), z = ((i * 7) % 5 - 2) * 3;
        if ((Lv.vb || 0) <= 0) air.put(i, 0, -999, 0, 0.001); else air.put(i, ((i % 3) - 1) * 1.2 * (1 - 0.7 * df * u * u), y, z, 1);
      }
      air.flush();
      acc += dt;
      if (acc > 0.12) { acc = 0; pTag.set('Δp = ' + fmt(Lv.dp || 0, 0) + ' Па'); bTag.set('v = ' + nf(Lv.vb || 0) + ' м/с'); }
    };
    pose(1); kit.onFrame(dt => pose(dt));
  };

  // =====================================================================================
  // 3, 4. Аэродинамическая труба: вентилятор, стеклянный короб на ножках, дым-метки
  function tunnel(kit, h) {
    const { T, at, box, cyl, clickable } = kit;
    const Y0 = 16, Y1 = 48, X0 = -50, X1 = 60, ZD = 30, yc = (Y0 + Y1) / 2;
    [[X0 + 4, -ZD / 2 + 2], [X0 + 4, ZD / 2 - 2], [X1 - 4, -ZD / 2 + 2], [X1 - 4, ZD / 2 - 2]].forEach(([x, z]) => at(box(2, Y0 - 1, 2, 0x4a5875), x, (Y0 - 1) / 2, z));
    at(box(X1 - X0, 1, ZD, 0x26324a), (X0 + X1) / 2, Y0 - 0.5, 0);
    at(box(X1 - X0, Y1 - Y0, 0.6, 0x1a2438, { shadow: false }), (X0 + X1) / 2, (Y0 + Y1) / 2, -ZD / 2 - 0.3);
    const gl = kit.mesh(new T.BoxGeometry(X1 - X0, Y1 - Y0, ZD), 0, { mat: h.glassMat(0.12), hull: false, shadow: false }); gl.renderOrder = 3; at(gl, (X0 + X1) / 2, (Y0 + Y1) / 2, 0);
    const fan = new T.Group(); at(fan, X0 - 6, 0, 0); clickable(fan, 'vcycle');
    at(box(11, Y1 - Y0 + 6, ZD + 4, CASE), 0, yc, 0, fan);
    const ring = kit.mesh(new T.TorusGeometry(13, 1, 10, 32), STEELC, { edges: false }); ring.rotation.y = Math.PI / 2; at(ring, 5.8, yc, 0, fan);
    const rotor = new T.Group(); at(rotor, 6, yc, 0, fan);
    at(h.xcyl(2, 2, 0xe8ecf4), 0, 0, 0, rotor);
    for (let k = 0; k < 3; k++) { const b = box(0.6, 11, 3.6, STEELC); b.position.y = 6.5; const arm = new T.Group(); arm.rotation.x = k * 2.094; b.rotation.y = 0.35; arm.add(b); rotor.add(arm); }
    return { rotor, Y0, Y1, X0, X1, yc };
  }
  const fanTag = (kit, tn) => liveTag(kit, kit.v3(tn.X0 - 6, tn.Y0 - 2, 18), 'Вентилятор', 'v');

  // линии тока у крыла — как в схеме (иллюстрация обтекания, не расчёт CFD); y вниз, единицы — пиксели схемы
  const cyOf = a => a <= 15 ? 0.25 + 0.09 * a : 1.15 - 0.035 * (a - 15);
  function wingY(y0, xl, a) {
    const ta = Math.tan(a * Math.PI / 180), cy = cyOf(a), dec = Math.exp(-Math.abs(y0) / 45);
    const at = x => { const u = x / 120, win = Math.exp(-((u - 0.15) ** 2) * 1.2), th = 8 * Math.exp(-(((u - 0.05) / 0.35) ** 2)) * Math.exp(-Math.abs(y0) / 30); return y0 + dec * x * ta * win + 10 * cy * dec * Math.tanh(1.8 * (u - 0.15)) + (y0 < 0 ? -th : th * 0.5); };
    let y = at(xl);
    const xs = -0.3 * 120;
    if (a > 15 && y0 < 0 && y0 > -50 && xl > xs) { const ys = at(xs), k = Math.exp(-Math.max(0, xl - xs - 156) / 90); y = ys + (y - ys) * (1 - k) - 6 * k * Math.exp(-Math.abs(y0) / 25); }
    return y;
  }
  const FOIL = (() => {
    const up = [], lo = [], m = 0.04, p = 0.4, t = 0.13;
    for (let i = 0; i <= 30; i++) {
      const x = (1 - Math.cos(i / 30 * Math.PI)) / 2, yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1015 * x ** 4);
      const yc = x < p ? m / (p * p) * (2 * p * x - x * x) : m / ((1 - p) ** 2) * (1 - 2 * p + 2 * p * x - x * x);
      up.push([x - 0.35, yc + yt]); lo.push([x - 0.35, yc - yt]);
    }
    return up.concat(lo.reverse());
  })();

  SC['fluids-wing'] = (kit, d) => {
    const { T, at, box, cyl, clickable, v3 } = kit, h = H(kit), tn = tunnel(kit, h);
    const CW = 28, SPAN = 22, sc = CW / 120, xc = 2;
    // крыло: профиль, вытянутый по размаху
    const shape = new T.Shape(FOIL.map(([x, y]) => new T.Vector2(x * CW, y * CW)));
    const geo = new T.ExtrudeGeometry(shape, { depth: SPAN, bevelEnabled: false, curveSegments: 4 }); geo.translate(0, 0, -SPAN / 2);
    const wing = new T.Group(); at(wing, xc, tn.yc, 0); clickable(wing, 'ainc');
    wing.add(kit.mesh(geo, 0xd9dfe9, { edgeAngle: 40 }));
    const hd = kit.mesh(new T.TorusGeometry(1, 0.38, 8, 16), ORANGE, { edges: false, matOpt: { emissive: ORANGE, emissiveIntensity: 0.25 } }); at(hd, 0.67 * CW, 0, SPAN / 2 + 0.6, wing);
    // стойка и весы под трубой
    at(cyl(0.55, tn.yc - 8, STEELC, { edges: false }), xc, (tn.yc + 8) / 2, 0);
    at(box(18, 8, 14, CASE), xc, 4, 0);
    const scr = h.flat(12, 3.6, h.canvasTex(256, 76, (x, w, hh) => { x.fillStyle = '#0e1520'; x.fillRect(0, 0, w, hh); }), { transparent: false }); at(scr, xc, 5, 7.05);
    const lift = h.arrow(GREEN); at(lift, xc, tn.yc + 3, SPAN / 2 + 2);
    // дым: метки по линиям тока в двух плоскостях
    const Y0 = [-66, -46, -28, -14, 12, 26, 44, 64], ZS = [-6, 6], NP = 12, ND = Y0.length * ZS.length * NP, smoke = h.dots(ND, 0.42, SMOKE, true);
    const vortex = h.dots(16, 0.5, 0xff8a73, true);
    const fTag = fanTag(kit, tn), wTag = liveTag(kit, v3(xc - 10, tn.Y1 + 2, 0), 'Крыло · S = 0,05 м²', 'α');
    const bTag = liveTag(kit, v3(xc, 10, 9), 'Весы', 'F');
    let ac = live().a || 6, t = 0, acc = 1;
    const Lx = tn.X1 - tn.X0 - 2;
    const pose = dt => {
      const Lv = live(), v = Lv.v || 0; ac = kit.reduce ? (Lv.a || 0) : follow(ac, Lv.a || 0, dt, 8); t += dt;
      wing.rotation.z = -ac * Math.PI / 180;
      tn.rotor.rotation.x += dt * v * 0.5;
      const F = Lv.F || 0; lift.setLen(Math.min(26, Math.abs(F) * 0.8)); lift.rotation.z = F < 0 ? Math.PI : 0;
      let k = 0; const st = ac > 15, cy = cyOf(ac);
      Y0.forEach((y0, li) => {
        const dec = Math.exp(-Math.abs(y0) / 45), boost = st ? (y0 < 0 ? 0.1 : -0.1) : (y0 < 0 ? 0.42 : -0.22) * Math.max(0, cy) * dec, spd = v * 1.6 * (1 + boost);
        ZS.forEach((z, zi) => { for (let i = 0; i < NP; i++) {
          if (v <= 0) { smoke.put(k++, 0, -999, 0, 0.001); continue; }
          const s = kit.reduce ? i / NP : (((t * spd / Lx + i / NP + li * 0.137 + zi * 0.31) % 1) + 1) % 1, x = tn.X0 + 1 + s * Lx;
          let y = tn.yc - wingY(y0, (x - xc) / sc, ac) * sc;
          if (st && y0 < 0 && y0 > -50 && x > xc - 8) y += Math.sin(t * 9 + i * 2.1 + li) * 1.2;
          smoke.put(k++, x, clamp(y, tn.Y0 + 1, tn.Y1 - 1), z, 1);
        } });
      });
      smoke.flush();
      for (let i = 0; i < 16; i++) {
        if (!st || v <= 0) { vortex.put(i, 0, -999, 0, 0.001); continue; }
        const c = i % 4, ph = t * (2 + v * 0.1) + i * 1.6, r = 1.6 + c * 0.4;
        vortex.put(i, xc + 4 + c * 7 + Math.cos(ph) * r, tn.yc + 5 - c * 0.6 + Math.sin(ph) * r, (Math.floor(i / 4) - 1.5) * 5, 1);
      }
      vortex.flush();
      acc += dt;
      if (acc > 0.12) { acc = 0; fTag.set('v = ' + nf(v) + ' м/с'); wTag.set('α = ' + nf(Math.round(Lv.a || 0)) + '°' + (Lv.stalled ? ' · срыв!' : '')); bTag.set('F = ' + fmt(F, 1) + ' Н'); }
    };
    pose(1); kit.onFrame(dt => pose(dt));
  };

  // =====================================================================================
  // 4. Тело на стойке в трубе; стойка на тележке, тележку держит горизонтальный динамометр
  const SHG = { plate: { a: 4, wake: 0.3, sh: 0 }, sphere: { a: 40, wake: 0.55, sh: 0 }, drop: { a: 82, wake: 1, sh: 34 }, car: { a: 76, wake: 0.8, sh: 6, b: 30 } };
  function flowY(shape, y0, xr) {   // обтекание эллипса (потенциальный поток), за плохо обтекаемым телом — след; пиксели схемы
    const g = SHG[shape], R = g.b || 40, A = Math.abs(y0);
    let xp = (xr - g.sh) * R / g.a; if (xp > 0) xp *= g.wake;
    if (A < 1e-6) return 0;
    let lo = Math.sqrt(Math.max(0, R * R - xp * xp)) + 1e-3, hi = A + R + 2;
    for (let it = 0; it < 22; it++) { const m = (lo + hi) / 2, f = m * (1 - R * R / (xp * xp + m * m)); if (f > A) hi = m; else lo = m; }
    return Math.sign(y0) * (lo + hi) / 2;
  }
  function body(kit, shape, h) {
    const { T, at, box, cyl, mesh } = kit, g = new T.Group(), R = 7, col = 0xd9dfe9;
    if (shape === 'plate') at(box(0.9, 2 * R, 2 * R, col), 0, 0, 0, g);
    else if (shape === 'sphere') g.add(mesh(new T.SphereGeometry(R, 28, 20), col, { hull: true, edges: false }));
    else if (shape === 'drop') {
      const p = []; for (let i = 0; i <= 40; i++) { const u = i / 40, x = -R + u * 30; const r = x < 0 ? Math.sqrt(Math.max(0, R * R - x * x)) : R * Math.pow(1 - x / (30 - R), 1.4) * (1 - 0.15 * x / (30 - R)); p.push(new T.Vector2(Math.max(0.001, r), x)); }
      const m = mesh(new T.LatheGeometry(p, 32), col, { hull: true, edges: false }); m.rotation.z = -Math.PI / 2; g.add(m);
    } else {
      const B = 0x3b6fd8; at(box(26, 5, 11, B), 0, -2.2, 0, g); at(box(13, 4.4, 10, B), 2, 2.4, 0, g);
      at(box(0.2, 3.4, 8.6, 0xcfe6f2, { edges: false }), -4.6, 2.4, 0, g);
      [[-8, -5.6], [8, -5.6], [-8, 5.6], [8, 5.6]].forEach(([x, z]) => { const w = cyl(2, 1.4, 0x2c3240, { seg: 18 }); w.rotation.x = Math.PI / 2; at(w, x, -4.6, z, g); });
    }
    return g;
  }
  SC['fluids-drag'] = (kit, d) => {
    const { T, at, box, cyl, clickable, v3 } = kit, h = H(kit), tn = tunnel(kit, h);
    const bx = -6, sc = 7 / 40, shape = d.shape || 'plate';
    const b = body(kit, shape, h); at(b, bx, tn.yc, 0); clickable(b, 'shape');
    // стойка, тележка на рельсе под трубой, динамометр слева
    const cart = new T.Group(); at(cart, bx, 0, 0);
    at(cyl(0.55, tn.yc - 7, STEELC, { edges: false }), 0, (tn.yc + 7) / 2, 0, cart);
    at(box(9, 3, 7, 0x4a5875), 0, 5.5, 0, cart);
    [-3, 3].forEach(x => { const w = cyl(1.1, 8.4, 0x2c3240, { seg: 14 }); w.rotation.x = Math.PI / 2; at(w, x, 3.6, 0, cart); });
    at(box(56, 0.8, 1.2, STEELC), -10, 2.4, -3); at(box(56, 0.8, 1.2, STEELC), -10, 2.4, 3);
    at(box(2.4, 10, 6, 0x4a5875), -40, 5, 0);
    const dyn = new T.Group(); at(dyn, -36, 5.5, 0);
    at(box(20, 3.2, 3.6, TEAL), 10, 0, 0, dyn);
    const face = h.flat(17, 1.8, h.canvasTex(680, 72, (x, w, hh) => { x.fillStyle = '#f4f6fa'; x.fillRect(0, 0, w, hh); x.strokeStyle = '#1b2537'; x.fillStyle = '#1b2537'; x.font = '700 30px "IBM Plex Mono", monospace'; x.textAlign = 'center'; for (let i = 0; i <= 10; i++) { const X = 20 + i * (w - 40) / 10; x.lineWidth = i % 2 ? 2 : 4; x.beginPath(); x.moveTo(X, 0); x.lineTo(X, i % 2 ? 22 : 34); x.stroke(); if (i % 2 === 0) x.fillText(String(i), X, 64); } }), { transparent: false });
    at(face, 10, 0, 1.82, dyn);
    const ptr = box(0.4, 2.6, 4, RED, { edges: false, matOpt: { emissive: RED, emissiveIntensity: 0.35 } }); at(ptr, 2, 0, 0, dyn);
    const hook = h.piece(0.3, kit.toon(STEELC));
    const drag = h.arrow(0xff8a73); drag.rotation.z = -Math.PI / 2; at(drag, bx + (shape === 'drop' ? 24 : shape === 'car' ? 14 : shape === 'plate' ? 1.5 : 8), tn.yc + 10, 0);
    // дым и вихри
    const Y0 = [-84, -64, -46, -30, -16, -5, 5, 16, 30, 46, 64, 84], ZS = [-3, 3], NP = 10, ND = Y0.length * ZS.length * NP, smoke = h.dots(ND, 0.4, SMOKE, true);
    const ys = Y0.map(y0 => { const arr = []; for (let i = 0; i <= 110; i++) { const x = tn.X0 + 1 + i; arr.push(tn.yc - flowY(shape, y0, (x - bx) / sc) * sc); } return arr; });
    const wake = h.dots(15, 0.5, 0xff8a73, true), bluff = SHG[shape].wake < 1;
    const fTag = fanTag(kit, tn);
    kit.tag(v3(bx, tn.Y1 + 3, 0), d.name || 'Тело', 'Cx ≈ ' + fmt(d.cx || 0, 2));
    const dTag = liveTag(kit, v3(-26, 12, 4), 'Динамометр', 'F');
    let t = 0, acc = 1, Fs = live().F || 0;
    const Lx = tn.X1 - tn.X0 - 2;
    const pose = dt => {
      const Lv = live(), v = Lv.v || 0; t += dt; Fs = kit.reduce ? (Lv.F || 0) : follow(Fs, Lv.F || 0, dt, 6);
      tn.rotor.rotation.x += dt * v * 0.5;
      const px = clamp(Fs / 10, 0, 1.05), stretch = 0.6 * px;
      ptr.position.x = 2 + 16 * px; cart.position.x = bx + stretch; b.position.x = bx + stretch;
      hook.span(v3(-16, 5.5, 0), v3(bx + stretch - 4.5, 5.5, 0), 1);
      drag.setLen(Math.min(22, Fs * 3)); drag.position.x = bx + stretch + (shape === 'drop' ? 24 : shape === 'car' ? 14 : shape === 'plate' ? 1.5 : 8);
      let k = 0;
      ys.forEach((arr, li) => ZS.forEach((z, zi) => { for (let i = 0; i < NP; i++) {
        if (v <= 0) { smoke.put(k++, 0, -999, 0, 0.001); continue; }
        const s = kit.reduce ? i / NP : (((t * v * 1.6 / Lx + i / NP + li * 0.173 + zi * 0.29) % 1) + 1) % 1, xr = s * Lx, j = Math.min(109, Math.floor(xr)), fr = xr - j;
        smoke.put(k++, tn.X0 + 1 + xr, clamp(arr[j] + (arr[j + 1] - arr[j]) * fr, tn.Y0 + 1, tn.Y1 - 1), z, 1);
      } }));
      smoke.flush();
      const back = bx + (shape === 'car' ? 14 : shape === 'plate' ? 1 : 7);
      for (let i = 0; i < 15; i++) {
        if (!bluff || v <= 0) { wake.put(i, 0, -999, 0, 0.001); continue; }
        const c = i % 3, sgn = c % 2 ? -1 : 1, ph = t * (2.5 + v * 0.12) * sgn + i * 1.3, r = (shape === 'plate' ? 2.6 : 2) - c * 0.3;
        wake.put(i, back + 3.5 + c * 5 + Math.cos(ph) * r, tn.yc + sgn * (shape === 'car' ? 1 : 3) + Math.sin(ph) * r, (Math.floor(i / 3) - 2) * 3, 1);
      }
      wake.flush();
      acc += dt;
      if (acc > 0.12) { acc = 0; fTag.set('v = ' + nf(v) + ' м/с'); dTag.set('F = ' + fmt(Lv.F || 0, (Lv.F || 0) < 1 ? 2 : 1) + ' Н'); }
    };
    pose(1); kit.onFrame(dt => pose(dt));
  };
})();
