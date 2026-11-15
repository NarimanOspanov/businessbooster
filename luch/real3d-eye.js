// «Как в жизни» для опыта «Глаз и оптические приборы» (labs/phys-eye).
// Модель глаза в разрезе на подставке (хрусталик, ресничная мышца, сетчатка, зрительный нерв → монитор «что видит глаз»);
// пробная очковая линза в оправе перед глазом пациента; оптическая скамья со свечой, линзой и экраном;
// микроскоп и телескоп в разрезе с цифровой камерой в окуляре.
// Сцены строятся из window.LUCH_REAL() опыта; набор деталей kit — из /luch/real3d.js.
(() => {
  const SC = (window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {});
  const Y0 = 0.4, ZR = 0.45; // верх тёмного сукна; плоскость, в которой идут лучи (чуть перед плоскостью разреза)
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const f = (x, d = 0) => { let s = (Math.round(x * 10 ** d) / 10 ** d).toFixed(d); if (/^-0(\.0+)?$/.test(s)) s = s.slice(1); return s.replace('.', ',').replace('-', '−'); };
  const sg = (x, d) => (x > 0 ? '+' : '') + f(x, d);
  const RAY_IN = 0xffc23a, RAY_OK = 0x3fd28a, RAY_BAD = 0xff5a40, CYAN = 0x72d4e8, GLASS = 0xcfe6f2, PAPER = 0xf4efe2, BODY = 0x3b4a66, NERVE = 0xe2c09a;
  const mem = {}; // что было показано в прошлый раз — для плавных переходов (хрусталик, винты)

  // ---------- текстуры: кэш на сессию (LRU) ----------
  const texC = new Map();
  function cacheTex(key, make) {
    if (texC.has(key)) { const t = texC.get(key); texC.delete(key); texC.set(key, t); return t; }
    const t = make(); texC.set(key, t);
    if (texC.size > 60) { const k0 = texC.keys().next().value; texC.get(k0).dispose(); texC.delete(k0); }
    return t;
  }
  function canvasTex(T, w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  function labelTex(T, txt, col, w = 256, h = 96) {
    return cacheTex('lb' + txt + col + w + 'x' + h, () => canvasTex(T, w, h, x => {
      let fs = Math.round(h * 0.72); x.font = `700 ${fs}px "Golos Text", sans-serif`;
      const tw = x.measureText(txt).width; if (tw > w * 0.92) { fs = Math.floor(fs * w * 0.92 / tw); x.font = `700 ${fs}px "Golos Text", sans-serif`; }
      x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, w / 2, h / 2 + 2);
    }));
  }
  function flatLabel(kit, txt, col, w, h, flat) {
    const { T, keep } = kit;
    const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: labelTex(T, txt, col, Math.round(96 * w / h), 96), transparent: true, depthWrite: false })));
    if (flat) m.rotation.x = -Math.PI / 2;
    return m;
  }
  const plane = (kit, w, h, tex, o = {}) => { const { T, keep } = kit; return new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: tex, side: o.side || T.FrontSide, transparent: !!o.transparent, depthWrite: !o.transparent }))); };

  // «что видит глаз / в окуляре»: тот же рисунок, что на схеме опыта, с размытием
  function viewTex(T, kind, sd, mag) {
    const round = kind === 'cells' || kind === 'moon';
    const W = round ? 90 : 150, H = round ? 90 : 100, S = round ? 256 / 90 : 2;
    const key = 'v' + kind + (Math.round(sd * 4) / 4) + ':' + Math.round(mag || 0);
    return cacheTex(key, () => canvasTex(T, Math.round(W * S), Math.round(H * S), x => {
      x.scale(S, S);
      const cx = W / 2, cy = H / 2;
      if (round) { x.fillStyle = '#0b0f17'; x.fillRect(0, 0, W, H); x.save(); x.beginPath(); x.arc(cx, cy, W / 2 - 1, 0, 7); x.clip(); }
      const bg = { far: '#22324d', m1: '#3a4762', book: '#efe9dc', cells: '#d6ead0', moon: '#05070c' }[kind];
      x.fillStyle = bg; x.fillRect(-2, -2, W + 4, H + 4);
      x.save(); if (sd > 0.05) x.filter = `blur(${(sd * S).toFixed(1)}px)`;
      const path = (pts, col) => { x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); x.fillStyle = col; x.fill(); };
      const txt = (s, X, Y, fs, col, al = 'center', w = 400) => { x.font = `${w} ${fs}px "Golos Text", sans-serif`; x.fillStyle = col; x.textAlign = al; x.textBaseline = 'alphabetic'; x.fillText(s, X, Y); };
      if (kind === 'far') {
        x.fillStyle = '#ffd54a'; x.beginPath(); x.arc(W - 28, 24, 9, 0, 7); x.fill();
        path([[0, H], [22, 52], [40, 66], [70, 30], [98, 62], [120, 44], [W, 70], [W, H]], '#5d6a86');
        path([[62, 40], [70, 30], [79, 41], [72, 38]], '#fff'); path([[114, 50], [120, 44], [128, 50]], '#fff');
        x.fillStyle = '#2f5e3a'; x.fillRect(0, H - 14, W, 14);
      } else if (kind === 'm1') {
        x.fillStyle = '#eef1f6'; x.fillRect(cx - 46, 10, 92, H - 20);
        txt('Ш Б', cx, 46, 26, '#111', 'center', 700); txt('М Н К', cx, 70, 14, '#111', 'center', 700); txt('Ы М Б Ш', cx, 84, 8, '#111');
      } else if (kind === 'book') {
        txt('Луч светит', 10, 24, 13, '#222', 'left', 700);
        ['всем, кто хочет', 'понять, как устроен', 'мир вокруг нас.', 'Глава 8. Оптика'].forEach((t, i) => txt(t, 10, 42 + i * 13, 9.5, '#333', 'left'));
      } else if (kind === 'cells') {
        const k = (mag || 78) / 78;
        [[0, 0, 26, 15, 20], [-34, -22, 20, 13, -30], [30, 24, 22, 12, 40], [-26, 30, 18, 11, 10], [38, -26, 19, 12, -15]].forEach(([dx, dy, rx, ry, r]) => {
          x.save(); x.translate(cx + dx * k, cy + dy * k); x.rotate(r * Math.PI / 180); x.scale(k, k);
          x.beginPath(); x.ellipse(0, 0, rx, ry, 0, 0, 7); x.fillStyle = '#a9d39a'; x.fill(); x.lineWidth = 2; x.strokeStyle = '#4f8a45'; x.stroke();
          x.beginPath(); x.arc(rx * 0.25, 0, ry * 0.38, 0, 7); x.fillStyle = '#6e5aa6'; x.fill(); x.restore();
        });
      } else if (kind === 'moon') {
        const r = Math.min(160, 1.7 * (mag || 10));
        x.fillStyle = '#fff'; [[14, 18], [W - 18, H - 20], [W - 26, 16]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 0.8, 0, 7); x.fill(); });
        x.fillStyle = '#d9d4c4'; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
        x.fillStyle = '#a9a393'; [[-0.3, -0.25, 0.22], [0.25, 0.1, 0.16], [-0.1, 0.35, 0.12], [0.35, -0.4, 0.1], [0.05, -0.05, 0.08]].forEach(([a, b, q]) => { x.beginPath(); x.arc(cx + a * r, cy + b * r, q * r, 0, 7); x.fill(); });
      }
      x.restore();
      if (round) { x.restore(); x.strokeStyle = '#8b96ad'; x.lineWidth = 3; x.beginPath(); x.arc(cx, cy, W / 2 - 2, 0, 7); x.stroke(); }
    }));
  }

  // ---------- общие детали ----------
  // сцена в сдвинутой группе: свой kit, у которого root и подписи сдвинуты на off (cable не сдвигается — в таких сценах не используется)
  const shifted = (kit, off) => {
    const G = new kit.T.Group(); G.position.set(off[0], off[1], off[2]); kit.root.add(G);
    const O = new kit.T.Vector3(off[0], off[1], off[2]), k2 = Object.create(kit);
    Object.defineProperty(k2, 'root', { get: () => G });
    k2.at = (o, x, y, z, p) => kit.at(o, x, y, z, p || G);
    k2.tag = (p, ...r) => kit.tag(p.clone().add(O), ...r);
    return k2;
  };
  function felt(kit) { kit.at(kit.box(126, Y0, 90, 0x2a2f3a, { edges: false }), 0, Y0 / 2, 3); }
  function rod(kit, a, b, r, col, o = {}) {
    const { T, cyl } = kit; const d = b.clone().sub(a), L = d.length();
    const m = cyl(r, L, col, { edges: false, hull: r >= 0.5, ...o });
    m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
    kit.root.add(m); return m;
  }
  function dashed(kit, a, b, col, o = {}) {
    const { T, keep } = kit; const r = o.r || 0.12, dash = o.dash || 1.1, gap = o.gap || 0.9;
    const d = b.clone().sub(a), L = d.length(); if (L < 0.1) return;
    const dn = d.clone().normalize(), q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dn);
    const geo = keep(new T.CylinderGeometry(r, r, dash, 6, 1)), mat = keep(new T.MeshBasicMaterial({ color: col, transparent: true, opacity: o.op ?? 0.8, depthWrite: false }));
    for (let s = 0; s + dash <= L + 0.01; s += dash + gap) {
      const m = new T.Mesh(geo, mat); m.quaternion.copy(q); m.position.copy(a).addScaledVector(dn, s + dash / 2); m.renderOrder = 3; kit.root.add(m);
    }
  }
  // луч света: яркая сердцевина, мягкое свечение и бегущие огоньки по ходу света
  function beam(kit, a, b, k, o = {}) {
    const { T, keep } = kit;
    if (k < 0.03) return 0;
    const d = b.clone().sub(a), L = d.length(); if (L < 0.05) return 0;
    const dn = d.clone().normalize(), q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dn), mid = a.clone().addScaledVector(d, 0.5);
    const base = o.col ?? RAY_IN, kk = clamp(k, 0, 1);
    const coreCol = new T.Color(base).lerp(new T.Color(o.hot ?? 0xfff4d0), 0.5 * kk);
    const r = o.r || 0.16, gr = o.gr || 0.6;
    const core = new T.Mesh(keep(new T.CylinderGeometry(r, r, L, 8, 1, true)), keep(new T.MeshBasicMaterial({ color: coreCol, transparent: true, opacity: 0.35 + 0.65 * kk, depthWrite: false })));
    const glow = new T.Mesh(keep(new T.CylinderGeometry(gr, gr, L, 12, 1, true)), keep(new T.MeshBasicMaterial({ color: base, transparent: true, opacity: 0.28 * kk, blending: T.AdditiveBlending, depthWrite: false })));
    [core, glow].forEach(m => { m.quaternion.copy(q); m.position.copy(mid); m.renderOrder = 3; kit.root.add(m); });
    if (!kit.reduce && kk > 0.1 && o.photons !== false) {
      const SP = o.sp || 7, V = o.v || 16, s0 = o.s0 || 0, n = Math.ceil(L / SP) + 1, sps = [];
      const pm = keep(new T.SpriteMaterial({ map: kit.glowTex(), color: o.pcol ?? base, transparent: true, opacity: 0.95 * kk, blending: T.AdditiveBlending, depthWrite: false }));
      for (let i = 0; i < n; i++) { const s = new T.Sprite(pm); s.scale.setScalar((o.ps || 1.6) * (0.6 + 0.4 * kk)); s.renderOrder = 4; kit.root.add(s); sps.push(s); }
      const place = t => { const ph = ((t * V - s0) % SP + SP) % SP; sps.forEach((s, i) => { const u = ph + i * SP; s.visible = u < L; if (s.visible) s.position.copy(a).addScaledVector(dn, u); }); };
      place(0); kit.onFrame((dt, t) => place(t));
    }
    return L;
  }
  function beamPath(kit, pts, k, o = {}) {
    let s = o.s0 || 0;
    for (let i = 0; i + 1 < pts.length; i++) s += beam(kit, pts[i], pts[i + 1], k, { ...o, s0: s });
    return s;
  }
  function spot(kit, p, k, size = 4, col = 0xffd27a, pulse) {
    const { T, keep } = kit;
    if (k < 0.04) return null;
    const s = new T.Sprite(keep(new T.SpriteMaterial({ map: kit.glowTex(), color: col, transparent: true, opacity: clamp(0.4 + 0.6 * k, 0, 1), blending: T.AdditiveBlending, depthWrite: false })));
    s.scale.setScalar(size); s.position.copy(p); s.renderOrder = 5; kit.root.add(s);
    if (pulse && !kit.reduce) kit.onFrame((dt, t) => s.scale.setScalar(size * (1 + 0.1 * Math.sin(t * 5))));
    return s;
  }
  // фокус: голубая бусинка на оси с подписью
  function focusMark(kit, p, txt, labelDy = -2.4) {
    spot(kit, p, 1, 2.6, CYAN);
    const b = kit.mesh(new kit.T.SphereGeometry(0.42, 12, 8), CYAN, { edges: false, matOpt: { emissive: CYAN, emissiveIntensity: 0.6 } }); kit.at(b, p.x, p.y, p.z);
    if (txt) { const l = flatLabel(kit, txt, '#72d4e8', 2.8, 1.6); kit.at(l, p.x, p.y + labelDy, p.z + 0.3); }
  }
  // линза: тело вращения, ось по y (axis 'x' — положить вдоль x). tc — толщина в центре, te — у края
  function lensGeo(T, rad, tc, te, n = 14) {
    const h = r => (te + (tc - te) * (1 - (r / rad) ** 2)) / 2, pts = [];
    for (let i = 0; i <= n; i++) { const r = Math.max(0.001, rad * i / n); pts.push(new T.Vector2(r, -h(r))); }
    for (let i = n; i >= 0; i--) { const r = Math.max(0.001, rad * i / n); pts.push(new T.Vector2(r, h(r))); }
    return new T.LatheGeometry(pts, 40);
  }
  function lens(kit, rad, tc, te, axis) {
    const m = kit.mesh(lensGeo(kit.T, rad, tc, te), GLASS, { edges: false, shadow: false, matOpt: { transparent: true, opacity: 0.5, depthWrite: false, emissive: 0x6fb6d8, emissiveIntensity: 0.3 } });
    if (axis === 'x') m.rotation.z = Math.PI / 2;
    m.renderOrder = 2; return m;
  }
  // труба в разрезе (видна задняя половина, z < 0), ось по y, центр в 0
  function halfTube(kit, r, len, col, o = {}) {
    const { T, mesh, toon, box } = kit;
    const g = new T.Group();
    g.add(mesh(new T.CylinderGeometry(r, r, len, 36, 1, true, Math.PI / 2, Math.PI), col, { mat: toon(col, { side: T.DoubleSide }), edges: false }));
    [-1, 1].forEach(s => { const e = box(o.wall || 0.6, len, 0.25, o.rim ?? 0xe8e2d4, { edges: false }); e.position.set(s * (r - (o.wall || 0.6) / 2), 0, -0.1); g.add(e); });
    return g;
  }
  // кнопка на приборе: колпачок со значком сверху
  function button(kit, parent, x, y, z, label, color, key, w = 4.4, dp = 3.2) {
    const { T, at, box, keep, textTex, clickable } = kit;
    const b = new T.Group(); at(b, x, y, z, parent);
    at(box(w, 1.2, dp, color), 0, 0.6, 0, b);
    const th = dp - 0.5, tex = keep(textTex(label, '#ffffff', '#' + color.toString(16).padStart(6, '0'), Math.round(96 * w * 0.88 / th), 96));
    const top = plane(kit, w * 0.88, th, tex); top.rotation.x = -Math.PI / 2; at(top, 0, 1.22, 0, b);
    clickable(b, key); return b;
  }
  // монитор на ножке (экран лицом к +z, повёрнут на rot); вернёт точки для подписи и кабеля
  function monitor(kit, x, z, rot, tex, w, h) {
    const { T, at, box } = kit;
    const g = new T.Group(); at(g, x, 0, z); g.rotation.y = rot;
    at(box(10, 0.8, 7, 0x2c3240), 0, Y0 + 0.4, 0, g);
    at(box(2.2, 6.4, 1.4, 0x2c3240), 0, Y0 + 3.8, -0.8, g);
    const yC = Y0 + 6.6 + h / 2;
    at(box(w + 1.8, h + 1.8, 1.4, 0x1f2430), 0, yC, 0, g);
    at(plane(kit, w, h, tex), 0, yC, 0.72, g);
    at(box(0.9, 0.4, 0.3, 0x3fd28a, { edges: false, matOpt: { emissive: 0x3fd28a, emissiveIntensity: 0.8 } }), w / 2 - 0.4, yC - h / 2 - 0.45, 0.72, g);
    g.updateMatrixWorld(true);
    return { g, top: g.localToWorld(new T.Vector3(0, yC + h / 2 + 1.4, 0)), back: g.localToWorld(new T.Vector3(0, Y0 + 3, -1.6)) };
  }
  // табличка «Микроскоп | Телескоп»
  function modePlate(kit, x, z, mode) {
    const { T, at, box } = kit;
    const g = new T.Group(); at(g, x, 0, z);
    at(box(28, 1, 7, 0x2c3240), 0, Y0 + 0.5, 0, g);
    button(kit, g, -6.6, Y0 + 1, 0, 'Микроскоп', mode === 'micro' ? 0x2f9e5a : 0x5d6a86, 'mode:micro', 12.6, 5);
    button(kit, g, 6.6, Y0 + 1, 0, 'Телескоп', mode === 'tele' ? 0x2f9e5a : 0x5d6a86, 'mode:tele', 12.6, 5);
  }
  const ease = u => u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
  // плавный переход от прошлого значения к новому за dur секунд
  function tween(kit, key, to, dur, apply) {
    const from = mem[key] == null ? to : mem[key]; mem[key] = to;
    if (kit.reduce || Math.abs(from - to) < 1e-9) { apply(to); return; }
    apply(from); let t0 = null;
    kit.onFrame((dt, t) => { if (t0 == null) t0 = t; const u = clamp((t - t0) / dur, 0, 1); apply(from + (to - from) * ease(u)); });
  }
  // параксиальный ход луча через тонкие линзы (как в опыте): единицы — см
  function trace(x0, y0, u, lenses, xEnd) {
    const pts = [[x0, y0]]; let x = x0, y = y0;
    for (const l of lenses) { if (l.x <= x) continue; y += u * (l.x - x); x = l.x; pts.push([x, y]); u -= y / l.F; }
    y += u * (xEnd - x); pts.push([xEnd, y]);
    return pts;
  }

  // =====================================================================================
  // 1–2. Модель глаза в разрезе на подставке; предмет слева; зрительный нерв кабелем к монитору «что видит глаз»
  const R = 17, EYC = Y0 + 26, XF = -8, PR = 3.8, KD = 0.2316 * R, LXL = 0.39 * R;
  const OBJX = { far: -52, m1: -40, book: -30 };
  const OBJN = { far: 'горы · далеко', m1: 'плакат · 1 м', book: 'книга · 25 см' };
  const thick = acc => 1.45 + clamp(acc, 0, 10) * 0.2; // полутолщина хрусталика

  function eyeObject(kit, obj) {
    const { T, at, box, cyl, mesh, clickable, C } = kit;
    const g = new T.Group(); at(g, 0, 0, 0); clickable(g, 'objc');
    const X = OBJX[obj];
    if (obj === 'far') {
      const top = EYC - 7;
      at(box(15, top - Y0, 12, C.WOOD2), X, (Y0 + top) / 2, 0, g);
      at(box(15, 0.6, 12, 0x3f7a4a, { edges: false }), X, top + 0.3, 0, g);
      [[-4, -2, 5, 10], [1.5, 1.5, 5.6, 12], [5, -2.5, 4, 7]].forEach(([dx, dz, r, h]) => {
        at(cyl(r, h, 0x6f7d99, { r2: 0, seg: 6 }), X + dx, top + 0.6 + h / 2, dz, g);
        at(cyl(r * 0.32, h * 0.32, 0xffffff, { r2: 0, seg: 6, edges: false }), X + dx, top + 0.6 + h * 0.84, dz, g);
      });
      const sun = mesh(new T.SphereGeometry(1.5, 16, 12), 0xffd54a, { edges: false, matOpt: { emissive: 0xffc43a, emissiveIntensity: 0.9 } }); at(sun, X - 4, EYC + 9, -5, g);
      spot(kit, new T.Vector3(X - 4, EYC + 9, -5), 1, 6, 0xffd54a);
      return { top: new T.Vector3(X + 1.5, top + 12.6, 0), src: null, tag: new T.Vector3(X, Y0 + 1, 7) };
    }
    // стойка-держатель
    at(box(8, 1, 8, C.DARK), X, Y0 + 0.5, 0, g);
    at(cyl(0.55, EYC - 6 - Y0, C.STEEL, { edges: false }), X - 0.6, Y0 + (EYC - 6 - Y0) / 2, 0, g);
    if (obj === 'm1') {
      at(box(0.6, 12, 10, 0xd9dde6), X, EYC, 0, g);
      const tex = cacheTex('chart', () => canvasTex(kit.T, 200, 240, x => {
        x.fillStyle = '#eef1f6'; x.fillRect(0, 0, 200, 240); x.fillStyle = '#111'; x.textAlign = 'center';
        x.font = '700 64px "Golos Text", sans-serif'; x.fillText('Ш Б', 100, 92);
        x.font = '700 36px "Golos Text", sans-serif'; x.fillText('М Н К', 100, 156);
        x.font = '600 22px "Golos Text", sans-serif'; x.fillText('Ы М Б Ш', 100, 200);
      }));
      const p = plane(kit, 9.4, 11.4, tex); p.rotation.y = Math.PI / 2; at(p, X + 0.32, EYC, 0, g);
      return { top: new T.Vector3(X + 0.3, EYC + 5.5, 0), src: new T.Vector3(X + 0.35, EYC, 0), tag: new T.Vector3(X, Y0 + 1.5, 5) };
    }
    // открытая книга на пюпитре
    const lect = box(0.8, 8.4, 12, 0x7a2f2f); at(lect, X - 0.5, EYC, 0, g);
    const tex = cacheTex('bookpg', () => canvasTex(kit.T, 300, 210, x => {
      x.fillStyle = '#efe9dc'; x.fillRect(0, 0, 300, 210);
      const gr = x.createLinearGradient(130, 0, 170, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gr; x.fillRect(130, 0, 40, 210);
      x.fillStyle = '#222'; x.font = '700 22px "Golos Text", sans-serif'; x.fillText('Луч светит', 14, 34);
      x.fillStyle = '#555'; for (let i = 0; i < 9; i++) { x.fillRect(14, 52 + i * 17, 110 - (i % 3) * 14, 5); x.fillRect(166, 26 + i * 19, 118 - (i % 4) * 12, 5); }
    }));
    const p = plane(kit, 11, 7.7, tex); p.rotation.y = Math.PI / 2; at(p, X - 0.05, EYC, 0, g);
    return { top: new T.Vector3(X, EYC + 3.5, 0), src: new T.Vector3(X + 0.1, EYC, 0), tag: new T.Vector3(X, Y0 + 1.5, 5) };
  }

  // модель глаза. o: { sx — растяжение глазного яблока, acc — сколько добавил хрусталик, dP, sharp, G (очки или null), obj, accKey }
  function eyeScene(kit, o) {
    const { T, at, box, cyl, mesh, keep, toon, clickable, v3, C } = kit;
    felt(kit);
    const rx = R * o.sx, LX = XF + LXL, XR = XF + 2 * rx - 1.0, ECX = XF + rx, side = T.DoubleSide;
    // подставка
    at(box(2 * rx + 10, 2, 22, C.WOOD2), ECX, Y0 + 1, 2);
    const ph = EYC - R + 1 - Y0 - 2;
    at(cyl(1.3, ph - 1, C.STEEL, { edges: false }), ECX, Y0 + 2 + (ph - 1) / 2, -6);
    at(cyl(2.6, 0.8, C.BRASS), ECX, EYC - R - 0.15, -6);
    const EG = new T.Group(); at(EG, XF, EYC, 0);
    const half = (r, th0, thL) => { const g = new T.SphereGeometry(r, 48, 24, Math.PI, Math.PI, th0, thL); g.rotateZ(Math.PI / 2); return g; };
    const shell = (r, th0, thL, col, extra = {}) => { const m = mesh(half(r, th0, thL), col, { mat: toon(col, { side, ...extra }), edges: false }); m.scale.x = o.sx; at(m, rx, 0, 0, EG); return m; };
    const ring = (r0, r1, a0, aL, col, cx = rx, sx = o.sx) => { const m = new T.Mesh(keep(new T.RingGeometry(r0, r1, 72, 1, a0, aL)), toon(col, { side })); m.scale.x = sx; at(m, cx, 0, 0.03, EG); return m; };
    // склера, сосудистая оболочка, сетчатка и их срез
    shell(R, 0.62, Math.PI - 0.62, 0xf3ece0);
    shell(R - 0.9, 0.7, Math.PI - 0.7, 0x8a4a46);
    shell(R - 1.25, Math.PI - 1.2, 1.2, 0xe0787a);
    ring(R - 0.9, R, -(Math.PI - 0.62), 2 * (Math.PI - 0.62), 0xeadfcd);
    ring(R - 1.25, R - 0.9, -(Math.PI - 0.7), 2 * (Math.PI - 0.7), 0x8a4a46);
    ring(R - 1.75, R - 1.25, -1.2, 2.4, 0xe0606a);
    const vit = new T.Mesh(keep(new T.SphereGeometry(R - 1.3, 40, 20, Math.PI, Math.PI)), keep(new T.MeshBasicMaterial({ color: 0x9fd6ea, transparent: true, opacity: 0.1, depthWrite: false, side })));
    vit.scale.x = o.sx; at(vit, rx, 0, 0, EG);
    const mac = mesh(new T.SphereGeometry(0.9, 12, 8), 0xffd54a, { edges: false }); mac.scale.set(0.5, 1.4, 1); at(mac, 2 * rx - 1.5, 0, -0.4, EG);
    // роговица
    const rc = 0.62 * R, ccx = -0.17 * R + rc;
    const cor = new T.Mesh(keep(half(rc, 0, 0.95)), toon(0x9fd6ea, { side, transparent: true, opacity: 0.4, depthWrite: false })); at(cor, ccx, 0, 0, EG);
    ring(rc - 0.55, rc, Math.PI - 0.95, 1.9, 0x8cc6dc, ccx, 1);
    // радужка (половина кольца) и её срез
    const iris = new T.Mesh(keep(new T.RingGeometry(PR + 0.2, 7.9, 40, 1, -Math.PI / 2, Math.PI)), toon(0x8a5a36, { side })); iris.rotation.y = Math.PI / 2; at(iris, 0.26 * R, 0, 0, EG);
    [-1, 1].forEach(s => at(box(0.9, 7.9 - PR, 0.5, 0x7a4a2a, { edges: false }), 0.26 * R, s * (PR + (7.9 - PR) / 2), 0.05, EG));
    // хрусталик с ресничной мышцей; толщина плавно меняется
    const LG = new T.Group(); at(LG, LXL, 0, 0, EG); clickable(LG, 'acc+');
    const lb = new T.Mesh(keep(new T.SphereGeometry(1, 32, 20, Math.PI, Math.PI)), toon(0xffe2b0, { side, transparent: true, opacity: 0.75 })); LG.add(lb);
    const lc = new T.Mesh(keep(new T.CircleGeometry(1, 48)), toon(0xffd9a0, { transparent: true, opacity: 0.85 })); lc.position.z = 0.04; LG.add(lc);
    const lo = new T.Mesh(keep(new T.RingGeometry(0.93, 1, 48)), keep(new T.MeshBasicMaterial({ color: 0xc98a3a }))); lo.position.z = 0.06; LG.add(lo);
    const ry = 6.3;
    const MG = new T.Group(); LG.add(MG);
    const tg = new T.TorusGeometry(ry + 2.4, 1.4, 12, 40, Math.PI); tg.rotateZ(-Math.PI / 2);
    const mus = mesh(tg, 0xc47a7a, { edges: false }); mus.rotation.y = Math.PI / 2; MG.add(mus);
    [-1, 1].forEach(s => {
      const c = new T.Mesh(keep(new T.CircleGeometry(1.4, 20)), toon(0xd89090)); c.position.set(0, s * (ry + 2.4), 0.04); MG.add(c);
    });
    const zon = [-1, 1].map(s => { const z = box(0.12, 1, 0.12, 0xf0d6b0, { edges: false, shadow: false }); z.position.set(0, s * (ry + 0.5), 0.1); LG.add(z); return z; });
    const setLens = a => {
      const t = thick(a), rr = ry - a * 0.12; lb.scale.set(t, rr, rr); lc.scale.set(t, rr, 1); lo.scale.set(t, rr, 1);
      const mr = (ry + 2.4 - a * 0.16) / (ry + 2.4); MG.scale.set(1, mr, mr);
      zon.forEach((z, i) => { const s = i ? 1 : -1, y0 = rr, y1 = (ry + 1.0) * mr; z.scale.y = Math.max(0.05, y1 - y0); z.position.y = s * (y0 + y1) / 2; });
    };
    tween(kit, o.accKey, o.acc, 0.7, setLens);
    // зрительный нерв
    const na = -25 * Math.PI / 180, np = v3(ECX + rx * Math.cos(na) * 0.97, EYC + R * Math.sin(na) * 0.97, -1.5), nd = v3(Math.cos(-0.7), Math.sin(-0.7), -0.25).normalize(), ne = np.clone().addScaledVector(nd, 8);
    rod(kit, np, ne, 1.9, NERVE, { hull: true });

    // предмет, очки, лучи
    const ob = eyeObject(kit, o.obj);
    const XG = XF - 8;
    if (o.G != null) {
      const gg = new T.Group(); at(gg, XG, 0, 0);
      at(box(12, 1.2, 16, C.DARK), 0, Y0 + 0.6, 3, gg);
      at(cyl(0.5, EYC - 6.6 - Y0, C.STEEL, { edges: false }), 0, Y0 + (EYC - 6.6 - Y0) / 2, -1.5, gg);
      const rim = mesh(new T.TorusGeometry(6, 0.42, 10, 48), 0x1f2430, { edges: false, hull: true }); rim.rotation.y = Math.PI / 2; at(rim, 0, EYC, 0, gg);
      at(box(0.8, 2.6, 2.6, 0x1f2430), 0, EYC - 7.6, -1.5, gg);
      if (o.G !== 0) {
        const a = Math.abs(o.G), l = o.G > 0 ? lens(kit, 5.7, 0.5 + a * 0.32, 0.35, 'x') : lens(kit, 5.7, 0.35, 0.55 + a * 0.32, 'x');
        at(l, 0, EYC, 0, gg);
      }
      const tab = plane(kit, 4.4, 2.2, kit.keep(kit.textTex(o.G === 0 ? 'пусто' : sg(o.G, 2), '#ffffff', '#1f2430', 176, 88))); tab.rotation.y = Math.PI / 2;
      at(box(0.5, 2.4, 4.6, 0x1f2430), 0, EYC + 8, 0, gg); at(tab, 0.3, EYC + 8, 0, gg);
      at(box(0.4, 1.6, 0.4, 0x1f2430, { edges: false }), 0, EYC + 6.4, 0, gg);
      button(kit, gg, -2.8, Y0 + 1.2, 8, '−0,25', 0x3b6fd8, 'g:-0.25', 5.2, 4);
      button(kit, gg, 2.8, Y0 + 1.2, 8, '+0,25', 0x2f9e5a, 'g:0.25', 5.2, 4);
    }
    const XRr = XR - 0.3, xf = clamp(XR - KD * o.dP, LX + 4.5, XR + 0.8 * R);
    const after = o.sharp ? RAY_OK : RAY_BAD;
    let spread = 0, s0 = 0;
    [-1, 1].forEach((s, i) => {
      const pts = [];
      const yg = PR * (1 + 0.045 * (o.G || 0));
      const start = ob.src ? ob.src.clone().setZ(ZR) : v3(OBJX.far + 7.5, EYC + s * (o.G != null ? yg : PR), ZR);
      pts.push(start);
      if (o.G != null) pts.push(v3(XG, EYC + s * yg, ZR));
      pts.push(v3(LX, EYC + s * PR, ZR));
      const L1 = beamPath(kit, pts, 0.9, { col: RAY_IN, s0: i * 3 });
      const yAt = X => EYC + s * PR * (1 - (X - LX) / (xf - LX));
      const yr = yAt(XRr); spread = Math.abs(yr - EYC);
      if (xf < XRr) beamPath(kit, [v3(LX, EYC + s * PR, ZR), v3(xf, EYC, ZR), v3(XRr, yr, ZR)], 0.9, { col: after, s0: L1 + i * 3 });
      else { beam(kit, v3(LX, EYC + s * PR, ZR), v3(XRr, yr, ZR), 0.9, { col: after, s0: L1 + i * 3 }); dashed(kit, v3(XRr, yr, ZR), v3(xf, EYC, ZR), after, { op: 0.6 }); }
      s0 = L1;
    });
    // фокус и пятно на сетчатке
    const fp = v3(xf, EYC, ZR + 0.1);
    spot(kit, fp, 1, o.sharp ? 3.4 : 2.4, after, o.sharp);
    if (spread > 0.35) { at(box(0.5, 2 * spread, 0.4, RAY_BAD, { edges: false, matOpt: { emissive: RAY_BAD, emissiveIntensity: 0.7, transparent: true, opacity: 0.75 } }), XRr - 0.2, EYC, ZR); spot(kit, v3(XRr, EYC, ZR + 0.2), 0.7, 2 + spread * 2.2, RAY_BAD); }
    // главный луч от верха предмета через центр хрусталика → перевёрнутое изображение на сетчатке
    const tp = ob.top.clone().setZ(ZR), yi = EYC - (tp.y - EYC) * (XRr - LX) / (LX - tp.x);
    dashed(kit, tp, v3(LX, EYC, ZR), 0xffd54a, { op: 0.55, r: 0.1 }); dashed(kit, v3(LX, EYC, ZR), v3(XRr, yi, ZR), 0xffd54a, { op: 0.55, r: 0.1 });
    const ic = o.sharp ? RAY_OK : 0xffb547;
    at(box(0.55, Math.abs(yi - EYC), 0.5, ic, { edges: false, matOpt: { emissive: ic, emissiveIntensity: 0.6 } }), XRr - 0.6, (EYC + yi) / 2, ZR + 0.15);
    const arrow = mesh(new T.ConeGeometry(0.8, 1.4, 4), ic, { edges: false, matOpt: { emissive: ic, emissiveIntensity: 0.6 } }); arrow.rotation.z = Math.PI; at(arrow, XRr - 0.6, yi - 0.5, ZR + 0.15);
    // монитор «что видит глаз» и кабель от нерва
    const mon = monitor(kit, 47, -10, 0.45, viewTex(T, o.obj, Math.min(8, Math.abs(o.dP) * 2.6)), 22.5, 15);
    kit.cable(ne, mon.back, NERVE, 0, { r: 0.75, lift: 1 });
    return { ob, mon, LX, XR, ECX, XG, rx };
  }

  // 1. Как устроен глаз: аккомодация
  SC['eye-eye'] = (kit, d) => {
    const { v3, tag, at } = kit;
    const E = eyeScene(kit, { sx: 1, acc: d.acc, dP: d.dP, sharp: d.sharp, G: null, obj: d.obj, accKey: 'acc-eye' });
    // пульт ресничной мышцы на подставке
    const pg = new kit.T.Group(); at(pg, E.ECX, 0, 0);
    button(kit, pg, -5, Y0 + 2, 9.6, 'Мышца −', 0x3b6fd8, 'acc-', 9, 4.4);
    button(kit, pg, 5, Y0 + 2, 9.6, 'Мышца +', 0xc0563b, 'acc+', 9, 4.4);
    const where = d.sharp ? 'фокус на сетчатке' : d.dP > 0 ? 'фокус перед сетчаткой' : 'фокус за сетчаткой';
    tag(E.ob.tag, 'Предмет', OBJN[d.obj]);
    tag(v3(E.LX, EYC + R + 4, 0), 'Хрусталик', `+${f(d.acc, 2)} дптр · ${where}`, d.sharp);
    tag(E.mon.top, 'Что видит глаз', `${d.sharp ? 'чётко' : 'размыто'} · готово ${d.gk.length}/3`, d.gk.length >= 3);
  };

  // 2. Очки: модель глаза пациента, пробная линза в оправе, карточки пациентов, блокнот рецептов
  const P0 = 1 / 0.017, PL = { norm: 0.017, myo: 1 / (P0 - 2), hyp: 1 / (P0 + 1) };
  const PN = { norm: ['Норма', 'нормальное зрение'], myo: ['Асель', 'близорукость'], hyp: ['Данияр', 'дальнозоркость'] };
  SC['eye-glasses'] = (kit, d) => {
    const { T, v3, tag, at, box, keep, textTex, clickable } = kit;
    const sx = 1 + (PL[d.pat] - 0.017) * 210;
    const E = eyeScene(kit, { sx, acc: d.acc, dP: d.dP, sharp: d.sharp, G: d.G, obj: d.obj, accKey: 'acc-gl' });
    // карточки пациентов
    ['norm', 'myo', 'hyp'].forEach((k, i) => {
      const on = d.pat === k, g = new T.Group(); at(g, -44 + i * 13, 0, 31); clickable(g, 'pat:' + k);
      at(box(12, on ? 1.4 : 0.6, 6.6, on ? 0xffd166 : PAPER), 0, Y0 + (on ? 0.7 : 0.3), 0, g);
      const p = plane(kit, 11, 3.2, keep(textTex(PN[k][0], '#1b1610', on ? '#ffd166' : '#f4efe2', 220, 64))); p.rotation.x = -Math.PI / 2; at(p, 0, Y0 + (on ? 1.42 : 0.62), -0.9, g);
      if (d.rk.includes(k)) { const c = flatLabel(kit, '✓', '#23804a', 2.4, 2.4, true); at(c, 4.4, Y0 + (on ? 1.45 : 0.65), 1.8, g); }
    });
    // блокнот рецептов
    const ng = new T.Group(); at(ng, 26, 0, 30); ng.rotation.y = -0.2; clickable(ng, 'rx');
    at(box(12, 0.8, 15, 0x2f6fd8), 0, Y0 + 0.4, 0, ng);
    const RX = { myo: 'Асель: −2,00 дптр', hyp: 'Данияр: +3,00 дптр' };
    const pt = cacheTex('rx' + d.rk.join(','), () => canvasTex(T, 220, 280, x => {
      x.fillStyle = '#f7f3ea'; x.fillRect(0, 0, 220, 280);
      x.fillStyle = '#c0392b'; x.font = '700 30px "Golos Text", sans-serif'; x.textAlign = 'center'; x.fillText('РЕЦЕПТ', 110, 40);
      x.fillStyle = '#9fb6cf'; for (let i = 0; i < 9; i++) x.fillRect(16, 70 + i * 22, 188, 2);
      x.fillStyle = '#1b3a8a'; x.font = '600 19px "Golos Text", sans-serif'; x.textAlign = 'left';
      d.rk.forEach((k, i) => x.fillText(RX[k], 18, 86 + i * 44));
    }));
    const pp = plane(kit, 11, 14, pt); pp.rotation.x = -Math.PI / 2; at(pp, 0, Y0 + 0.82, 0, ng);
    tag(E.ob.tag, 'Предмет', OBJN[d.obj]);
    tag(v3(E.ECX, Y0 + 2.5, 12), PN[d.pat][0] + ' · ' + PN[d.pat][1], `вдаль ${d.far ? 'чётко' : 'размыто'} · книга ${d.near ? 'чётко' : 'размыто'}`, d.far && d.near);
    tag(v3(E.XG, EYC + 12, 0), 'Очки', d.G === 0 ? 'без очков' : `${sg(d.G, 2)} дптр`);
    tag(E.mon.top, 'Что видит глаз', d.sharp ? 'чётко' : 'размыто', d.sharp);
    tag(v3(26, Y0 + 2, 30), 'Рецепты', `${d.rk.length}/2`, d.rk.length >= 2);
  };

  // =====================================================================================
  // 3. Оптическая скамья: свеча, линза F = 10 см на рейтере, полупрозрачный экран; световой конус и три луча
  const FL = 10, AP = 8, HC = 3;
  function candle(kit, x, ya, k, o = {}) {
    const { T, at, cyl, mesh, keep } = kit;
    const g = new T.Group(); at(g, x, ya, 0);
    const G = o.G || 1, inv = G < 0 ? -1 : 1, s = Math.abs(G) * k, ghost = !!o.ghost;
    const op = ghost ? { edges: false, hull: false, shadow: false, matOpt: { transparent: true, opacity: 0.35, depthWrite: false } } : {};
    at(cyl(0.6 * s, 2.2 * s, 0xf1e6cf, op), 0, inv * 1.1 * s, 0, g);
    at(cyl(0.06 * s + 0.04, 0.3 * s, 0x2b2f3a, { edges: false, hull: false, ...(ghost ? op : {}) }), 0, inv * 2.35 * s, 0, g);
    const fl = new T.Group(); at(fl, 0, inv * 2.65 * s, 0, g);
    const outer = new T.Mesh(keep(new T.SphereGeometry(0.28 * s, 14, 10)), keep(new T.MeshBasicMaterial({ color: 0xffb02e, transparent: true, opacity: ghost ? 0.5 : 1 })));
    outer.scale.set(1, 1.4, 1); fl.add(outer);
    const inner = new T.Mesh(keep(new T.SphereGeometry(0.14 * s, 10, 8)), keep(new T.MeshBasicMaterial({ color: 0xfff4c2, transparent: true, opacity: ghost ? 0.5 : 1 })));
    inner.scale.set(1, 1.4, 1); inner.position.y = -inv * 0.05 * s; fl.add(inner);
    const halo = new T.Sprite(keep(new T.SpriteMaterial({ map: kit.glowTex(), color: 0xffc860, transparent: true, opacity: ghost ? 0.35 : 0.9, blending: T.AdditiveBlending, depthWrite: false })));
    halo.scale.setScalar(Math.max(3, 2.2 * s)); fl.add(halo);
    if (!ghost) { const L = new T.PointLight(0xffb050, 14, 30, 1.4); L.position.y = 1; fl.add(L); }
    if (!kit.reduce && !ghost) kit.onFrame((dt, t) => { const q = 1 + 0.08 * Math.sin(t * 11) + 0.05 * Math.sin(t * 17.3); fl.scale.set(1 / Math.sqrt(q), q, 1 / Math.sqrt(q)); });
    return g;
  }
  SC['eye-bench'] = (kit0, d) => {
    felt(kit0);
    const kit = shifted(kit0, [7, 0, 21]);
    const { T, at, box, cyl, mesh, keep, tag, clickable, v3, C } = kit;
    const kx = 1.4, XC = -49, ya = Y0 + 22.5, X = cm => XC + cm * kx, Lc = d.Lc, dd = d.x, s = Lc - dd;
    const XL = X(dd), XS = X(Lc), yT = Y0 + 3;
    // скамья: рельс со шкалой на ножках
    const xa = X(-3), xb = X(73);
    at(box(xb - xa, 2.6, 7, 0x5d6a86), (xa + xb) / 2, Y0 + 1.7, 0);
    [xa + 3, xb - 3].forEach(x => at(box(4, 0.8, 12, 0x2c3240), x, Y0 + 0.4, 0));
    at(box(xb - xa - 2, 0.12, 2.4, 0xf1e3c2, { edges: false }), (xa + xb) / 2, yT + 0.06, 2.1);
    for (let c = 0; c <= 70; c += 1) { const L = c % 10 === 0 ? 1.6 : c % 5 === 0 ? 1.1 : 0.6; at(box(0.12, 0.05, L, 0x3a2e22, { edges: false, shadow: false }), X(c), yT + 0.14, 3.3 - L / 2); }
    for (let c = 0; c <= 70; c += 10) { const l = flatLabel(kit, String(c), '#3a2e22', 2.2, 1.2, true); at(l, X(c), yT + 0.15, 1.6); }
    const rider = (x, top, key) => {
      const g = new T.Group(); at(g, x, 0, 0); if (key) clickable(g, key);
      at(box(5, 2.2, 8, 0x2c3240), 0, yT + 1.1, 0, g);
      at(box(1.2, 0.6, 8.6, C.STEEL, { edges: false }), 0, yT + 0.3, 0, g);
      at(cyl(0.55, top - yT - 2.2, C.STEEL, { edges: false }), 0, yT + 2.2 + (top - yT - 2.2) / 2, 0, g);
      return g;
    };
    // свеча
    const cg = rider(X(0), ya - 0.6, null);
    at(cyl(1.6, 0.6, C.BRASS), 0, ya - 0.3, 0, cg);
    candle(kit, X(0), ya, kx);
    // линза в оправе
    const lr = AP / 2 * kx;
    const lg = rider(XL, ya - lr - 0.5, 'lens');
    const rim = mesh(new T.TorusGeometry(lr + 0.3, 0.4, 10, 48), 0x1f2430, { edges: false, hull: true }); rim.rotation.y = Math.PI / 2; at(rim, 0, ya, 0, lg);
    at(lens(kit, lr, 1.5, 0.3, 'x'), 0, ya, 0, lg);
    at(box(14.2, 1, 5, 0x2c3240), 0, yT + 0.6, 6.6, lg);
    [['−1', 'mv:-1', -5.1, 0x3b6fd8], ['−0,1', 'mv:-0.1', -1.7, 0x5d8ae8], ['+0,1', 'mv:0.1', 1.7, 0x4fb87a], ['+1', 'mv:1', 5.1, 0x2f9e5a]].forEach(([t, k, x, c]) => button(kit, lg, x, yT + 1.1, 6.6, t, c, k, 3.3, 4));
    // экран: калька в рамке (видно и с обратной стороны)
    const sw = 16 * kx, sh = 24 * kx;
    const sgp = rider(XS, ya - sh / 2 - 0.4, 'scr');
    at(box(0.8, sh + 1.2, 1, 0x2c3240), 0, ya, -sw / 2 - 0.5, sgp); at(box(0.8, sh + 1.2, 1, 0x2c3240), 0, ya, sw / 2 + 0.5, sgp);
    at(box(0.8, 1, sw + 2, 0x2c3240), 0, ya + sh / 2 + 0.1, 0, sgp); at(box(0.8, 1, sw + 2, 0x2c3240), 0, ya - sh / 2 - 0.1, 0, sgp);
    const PX = 16, key = 'scr' + [d.real, d.G, d.blur, d.sharp].join(':');
    const stex = cacheTex(key, () => canvasTex(T, 16 * PX, 24 * PX, (x, w, h) => {
      x.fillStyle = '#e9e5da'; x.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      if (!d.real) { const gr = x.createRadialGradient(cx, cy - 20, 0, cx, cy - 20, 170); gr.addColorStop(0, 'rgba(255,200,110,.35)'); gr.addColorStop(1, 'rgba(255,200,110,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, h); return; }
      const G = d.G, bl = d.blur, dim = clamp(1.2 / (1.2 + bl), 0.3, 1);
      const fy = cy + 2.65 * G * PX;
      const gr = x.createRadialGradient(cx, fy, 0, cx, fy, Math.max(10, bl * PX / 2 + 0.6 * G * PX)); gr.addColorStop(0, `rgba(255,190,90,${0.55 * dim + 0.1})`); gr.addColorStop(1, 'rgba(255,190,90,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
      x.save(); if (bl > 0.02) x.filter = `blur(${(bl * PX / 2.6).toFixed(1)}px)`;
      x.globalAlpha = dim;
      x.fillStyle = '#d8c79a'; x.fillRect(cx - 0.6 * G * PX, cy, 1.2 * G * PX, 2.2 * G * PX);
      x.fillStyle = '#ffb547'; x.beginPath(); x.ellipse(cx, fy, 0.28 * G * PX, 0.38 * G * PX, 0, 0, 7); x.fill();
      x.fillStyle = '#fff3c4'; x.beginPath(); x.ellipse(cx, fy - 0.03 * G * PX, 0.13 * G * PX, 0.2 * G * PX, 0, 0, 7); x.fill();
      x.restore();
    }));
    const scr = plane(kit, sw, sh, stex, { side: T.DoubleSide }); scr.rotation.y = -Math.PI / 2; at(scr, 0, ya, 0, sgp);
    // фокусы линзы
    [[-2, '2F'], [-1, 'F'], [1, 'F'], [2, '2F']].forEach(([k, t]) => { const c = dd + k * FL; if (c < 0.5 || c > Lc - 0.5) return; focusMark(kit, v3(X(c), ya, ZR), t); });
    dashed(kit, v3(X(-2), ya, -0.2), v3(X(Lc), ya, -0.2), 0x8b96ad, { op: 0.45, r: 0.07, dash: 1.4, gap: 1.2 });
    // световой конус: от пламени на край линзы и дальше — к экрану (кружок нерезкости)
    const P = v3(X(0), ya + HC * kx, 0), N = 36, ring = [], scrp = [];
    for (let i = 0; i < N; i++) {
      const a = i / N * Math.PI * 2, yy = AP / 2 * Math.cos(a), zz = AP / 2 * Math.sin(a);
      const uy = (yy - HC) / dd - yy / FL, uz = zz / dd - zz / FL;
      ring.push(v3(XL, ya + yy * kx, zz * kx)); scrp.push(v3(XS - 0.2, ya + (yy + uy * s) * kx, (zz + uz * s) * kx));
    }
    const pos = [];
    for (let i = 0; i < N; i++) {
      const a = ring[i], b = ring[(i + 1) % N], c = scrp[i], e = scrp[(i + 1) % N];
      pos.push(P.x, P.y, P.z, a.x, a.y, a.z, b.x, b.y, b.z, a.x, a.y, a.z, c.x, c.y, c.z, e.x, e.y, e.z, a.x, a.y, a.z, e.x, e.y, e.z, b.x, b.y, b.z);
    }
    const cgeo = new T.BufferGeometry(); cgeo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    const cone = new T.Mesh(keep(cgeo), keep(new T.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.07, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false })));
    cone.renderOrder = 2; kit.root.add(cone);
    // три луча, как на схеме: параллельный (через фокус), через центр, через передний фокус
    const W = (c, y) => v3(X(c), ya + y * kx, ZR);
    const L1 = beamPath(kit, [W(0, HC), W(dd, HC), W(Lc, HC - HC / FL * s)], 1, { col: 0xff6a55, pcol: 0xffb0a0 });
    beamPath(kit, [W(0, HC), W(dd, 0), W(Lc, HC - HC / dd * Lc)], 1, { col: 0xffd54a, s0: 2 });
    if (d.real) { const yl = HC - HC / (dd - FL) * dd; if (Math.abs(yl) <= AP / 2) beamPath(kit, [W(0, HC), W(dd, yl), W(Lc, yl)], 1, { col: 0xc58bff, s0: 4 }); }
    // где на самом деле получается изображение (если не на экране)
    let ghostAt = null;
    if (d.real && !d.sharp && d.f != null && Math.abs(d.G) < 6) {
      const xi = X(dd + d.f);
      if (xi < 53 && xi > XL + 2 && Math.abs(d.G) * 3 * kx < ya - yT - 1) { candle(kit, xi, ya, kx, { G: -d.G, ghost: true }); ghostAt = v3(xi, ya + 4, 0); }
    }
    if (d.sharp) spot(kit, v3(XS - 0.5, ya - 2.65 * d.G * kx, 0), 1, 3 + d.G, 0xffc860, true);
    tag(v3(X(0), yT + 2.5, 6), 'Свеча', '3 см · на 0');
    tag(v3(XL, ya + lr + 3, 0), 'Линза F = 10 см', `d = ${f(dd, 1)} см`);
    if (ghostAt) tag(ghostAt.setY(ya + Math.max(4, 3 * Math.abs(d.G) * kx * 0.3)), 'Изображение', `f = ${f(d.f, 1)} см`);
    tag(v3(XS + 6, yT + 1, 16), `Экран · ${Lc} см`, d.sharp ? `резко · Г = ${f(d.G, 2)}` : d.real ? `пятно · найдено ${d.found}/2` : 'изображения нет', d.sharp);
  };

  // =====================================================================================
  // 4а. Микроскоп в разрезе: предметное стекло, объектив, тубус 20 см, окуляр, цифровая камера → монитор
  const MF1 = 2, MF2 = 2.5, MT = 20, MH = 0.02;
  SC['eye-micro'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, v3, C } = kit;
    felt(kit);
    const mx = -6, mz = -10, ys = Y0 + 15, kv = 1.45, kh = 22;
    const yO = ys + d.d1 * kv, yE = yO + MT * kv;
    const W = (xc, yc) => v3(mx + yc * kh, ys + xc * kv, mz + ZR);
    // основание с лампой, колонна, столик
    at(box(30, 3.4, 26, BODY), mx, Y0 + 1.7, mz);
    const lamp = cyl(2.6, 0.6, 0xfff4c2, { matOpt: { emissive: 0xfff0b0, emissiveIntensity: 1 } }); at(lamp, mx, Y0 + 3.6, mz);
    spot(kit, v3(mx, Y0 + 4.2, mz), 1, 8, 0xfff0c0);
    const lb = new T.Mesh(keep(new T.CylinderGeometry(1.4, 2.4, ys - Y0 - 4.5, 20, 1, true)), keep(new T.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.16, blending: T.AdditiveBlending, depthWrite: false })));
    at(lb, mx, (ys + Y0 + 4) / 2, mz); lb.renderOrder = 2;
    const colX = mx, colZ = mz - 13;
    at(box(7, yE - 3 - Y0, 7, BODY), colX, (Y0 + yE - 3) / 2, colZ);
    at(box(22, 1.6, 20, 0x2c3240), mx, ys - 1.05, mz);
    at(box(6, 1.6, 6, BODY), mx, ys - 1.05, colZ + 2.5);
    at(cyl(2.4, 3, 0x5d6a86), mx, ys - 3.4, mz);
    // стекло с препаратом и лапки
    const slide = at(box(14, 0.35, 5, GLASS, { matOpt: { transparent: true, opacity: 0.5, depthWrite: false }, shadow: false }), mx, ys - 0.17, mz); slide.renderOrder = 1;
    const spec = mesh(new T.SphereGeometry(0.9, 16, 10), 0x6fbf5a, { edges: false }); spec.scale.set(1.2, 0.3, 0.8); at(spec, mx, ys + 0.05, mz);
    [-1, 1].forEach(s => at(box(1.4, 0.4, 7, C.STEEL, { edges: false }), mx + s * 8.6, ys + 0.15, mz - 1.5));
    // объектив, револьвер, тубус и окуляр — в разрезе
    const ob = halfTube(kit, 3, 5.4, 0xc6ccd6, { wall: 0.5 }); at(ob, mx, yO + 1.5, mz);
    at(box(0.15, 0.8, 0.8, 0xc0392b, { edges: false }), mx, yO + 3, mz - 2.9);
    const nose = halfTube(kit, 6.5, 2.2, 0x5d6a86, { wall: 3.4, rim: 0x48546e }); at(nose, mx, yO + 5.3, mz);
    [-1, 1].forEach(s => { const o2 = cyl(1.8, 4.5, C.STEEL, { r2: 2.2 }); o2.rotation.z = s * 0.6; at(o2, mx + s * 4.6, yO + 2.6, mz - 3.8); });
    const tL = yE - yO - 8.6;
    const tube = halfTube(kit, 5, tL, 0x2c3240, { wall: 0.6 }); at(tube, mx, yO + 6.4 + tL / 2, mz);
    const ep = halfTube(kit, 5, 5.6, 0x1f2430, { wall: 0.6 }); at(ep, mx, yE + 0.6, mz);
    at(box(8, 9, 8, BODY), mx, yO + 17, mz - 9);
    at(lens(kit, 2.6, 0.9, 0.25, 'y'), mx, yO, mz);
    at(lens(kit, 4.6, 1.3, 0.3, 'y'), mx, yE, mz);
    // цифровая камера в окуляре → монитор
    const cam = cyl(5.2, 4.6, 0x1f2430); at(cam, mx, yE + 5.8, mz);
    at(cyl(2.4, 0.4, 0x3a4a66, { edges: false }), mx, yE + 8.2, mz);
    const mon = monitor(kit, 36, -6, 0.45, viewTex(T, 'cells', Math.min(8, d.err * 0.9), d.G), 18, 18);
    kit.cable(v3(mx + 5, yE + 5.8, mz), mon.back, 0x2c3240, 0, { r: 0.55, lift: 0 });
    // винты фокусировки: большой — грубо, малый — точно (вращаются)
    const kn = new T.Group(); at(kn, colX + 3.5, ys + 7, colZ); clickable(kn, 'd1:-0.02');
    const big = cyl(4.6, 2.2, 0x2c3240, { seg: 14 }); big.rotation.z = Math.PI / 2; at(big, 1.1, 0, 0, kn);
    const bigM = box(0.3, 0.8, 4, 0xf4efe2, { edges: false }); at(bigM, 2.25, 0, 0, kn);
    const kf = new T.Group(); at(kf, colX + 3.5, ys - 6.5, colZ); clickable(kf, 'd1:-0.001');
    const sm = cyl(2.6, 1.8, 0x5d6a86, { seg: 12 }); sm.rotation.z = Math.PI / 2; at(sm, 0.9, 0, 0, kf);
    const smM = box(0.3, 0.6, 2.2, 0xf4efe2, { edges: false }); at(smM, 1.85, 0, 0, kf);
    tween(kit, 'd1', d.d1, 0.6, v => { kn.rotation.x = (v - 2.4) / 0.02 * 0.5; kf.rotation.x = (v - 2.4) / 0.001 * 0.35; });
    // кнопки подачи на основании
    const bg = new T.Group(); at(bg, mx, 0, mz + 9.4);
    [['▼ 0,2 мм', 'd1:-0.02', -10.5, 0x3b6fd8], ['▲ 0,2 мм', 'd1:0.02', -3.5, 0x2f9e5a], ['▼ 10 мкм', 'd1:-0.001', 3.5, 0x5d8ae8], ['▲ 10 мкм', 'd1:0.001', 10.5, 0x4fb87a]].forEach(([t, k, x, c]) => button(kit, bg, x, Y0 + 3.4, 0, t, c, k, 6.4, 4.6));
    // лучи от кончика препарата (как на схеме: поперёк растянуто)
    const lenses = [{ x: d.d1, F: MF1 }, { x: d.d1 + MT, F: MF2 }], xe = d.d1 + MT + 3.2;
    [[0, 0xff6a55], [-MH / d.d1, 0xffd54a], [(-0.08 - MH) / d.d1, 0xc58bff]].forEach(([u, c], i) => {
      const pts = trace(0, MH, u, lenses, xe).map(p => W(p[0], p[1]));
      beamPath(kit, pts, 0.95, { col: c, r: 0.14, gr: 0.5, ps: 1.3, sp: 5, v: 12, s0: i * 1.6 });
    });
    focusMark(kit, W(d.d1 + MF1, 0), 'F₁', 0); focusMark(kit, W(d.d1 + MT - MF2, 0), 'F₂', 0);
    // промежуточное изображение
    if (d.f1 != null) {
      const xi = d.d1 + d.f1, hi = -MH * d.f1 / d.d1, ic = d.sharp ? RAY_OK : 0xffb547;
      if (xi < d.d1 + MT + 4) { const a = W(xi, 0), b = W(xi, hi); at(box(Math.abs(b.x - a.x), 0.5, 0.4, ic, { edges: false, matOpt: { emissive: ic, emissiveIntensity: 0.6 } }), (a.x + b.x) / 2, a.y, mz + ZR + 0.1); }
    }
    modePlate(kit, -44, 31, 'micro');
    tag(v3(mx, yE + 10, mz), 'Микроскоп', `≈ ${d.G}×`, d.sharp);
    tag(v3(mx - 14, ys - 1, mz + 8), 'Объектив', `до предмета ${f(d.d1 * 10, 2)} мм`);
    tag(mon.top, 'В окуляре', `${d.sharp ? 'чётко' : 'размыто'} · пучок ${d.V == null ? '∞' : sg(d.V, 1)} дптр`, d.sharp);
    if (d.okm || d.okt) tag(v3(-44, Y0 + 3, 31), 'Готово', `микроскоп ${d.okm ? '✓' : '—'} · телескоп ${d.okt ? '✓' : '—'}`, d.okm && d.okt);
  };

  // 4б. Телескоп-рефрактор на настольной треноге, нацелен на Луну; труба и окулярный узел в разрезе
  const TH = 0.012;
  SC['eye-tele'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, v3, C } = kit;
    felt(kit);
    const k = 0.7, ky = 1.1, el = 8 * Math.PI / 180;
    const TG = new T.Group(); at(TG, -12, Y0 + 30, 20); TG.rotation.z = -el; TG.updateMatrixWorld(true);
    const Lw = p => TG.localToWorld(p.clone());
    const F1 = d.F1, F2 = d.F2, Tt = d.T, Lm = (F1 - 3) * k;
    // главная труба и бленда (в разрезе), оправа объектива с линзой
    const along = (g, x0, x1) => { g.rotation.z = -Math.PI / 2; at(g, (x0 + x1) / 2, 0, 0, TG); return g; };
    along(halfTube(kit, 4, Lm, 0xf4efe2, { wall: 0.5, rim: 0xd9d2c0 }), 0, Lm);
    const og = new T.Group(); at(og, 0, 0, 0, TG); clickable(og, 'F1c');
    const dew = halfTube(kit, 4.6, 6, 0x2c3240, { wall: 0.6 }); dew.rotation.z = -Math.PI / 2; at(dew, -3, 0, 0, og);
    const cell = mesh(new T.TorusGeometry(3.9, 0.55, 8, 40), 0x2c3240, { edges: false, hull: true }); cell.rotation.y = Math.PI / 2; at(cell, 0, 0, 0, og);
    at(lens(kit, 3.6, 0.5 + 40 / F1 * 0.5, 0.25, 'x'), 0, 0, 0, og);
    // фокусёр с кремальерой, выдвижной тубус, окуляр, камера
    const xd0 = Math.min((Tt - 14) * k, Lm - 3), xd1 = (Tt - 1.5) * k;
    along(halfTube(kit, 2.4, Math.max(2, xd1 - xd0), 0x9aa3b2, { wall: 0.4 }), xd0, xd1);
    const fz = new T.Group(); at(fz, Lm + 1.6, 0, 0, TG);
    const fh = halfTube(kit, 3.1, 3.2, 0x1f2430, { wall: 0.7 }); fh.rotation.z = -Math.PI / 2; fz.add(fh);
    at(box(3.2, 2, 3.4, 0x1f2430), 0, -3.6, -1.2, fz);
    const knob = cyl(1.5, 1.4, 0x5d6a86, { seg: 12 }); knob.rotation.x = Math.PI / 2; at(knob, 0, -3.6, 1.2, fz); clickable(knob, 'T:1');
    const eg = new T.Group(); at(eg, Tt * k, 0, 0, TG); clickable(eg, 'F2c');
    const eb = halfTube(kit, 1.9, 5.6, 0x1f2430, { wall: 0.4 }); eb.rotation.z = -Math.PI / 2; at(eb, 0.8, 0, 0, eg);
    at(lens(kit, 1.6, 0.4 + 2 / F2 * 0.5, 0.2, 'x'), 0, 0, 0, eg);
    const camc = cyl(2.6, 3.4, 0x2c3240); camc.rotation.z = Math.PI / 2; at(camc, 7.4, 0, 0, eg);
    tween(kit, 'teleT', Tt, 0.6, v => { knob.rotation.z = v * 0.8; });
    // монтировка: колыбель с хомутами, головка, тренога
    const xp = Lm * 0.5;
    [xp - 6, xp + 6].forEach(x => { const r = mesh(new T.TorusGeometry(4.5, 0.5, 8, 32), 0x2c3240, { edges: false, hull: true }); r.rotation.y = Math.PI / 2; at(r, x, 0, 0, TG); });
    at(box(16, 1.2, 3, 0x2c3240), xp, -5.2, 0, TG);
    const head = Lw(v3(xp, -6.5, 0));
    at(box(4, 3, 4, 0x1f2430), head.x, head.y - 1.2, head.z);
    [[0, -9], [8, 6], [-8, 6]].forEach(([dx, dz]) => rod(kit, v3(head.x, head.y - 2.5, head.z), v3(head.x + dx, Y0 + 0.4, head.z + dz), 0.55, C.STEEL));
    // Луна далеко «впереди» трубы
    const moonP = Lw(v3(-21, 0, 0));
    const mtex = cacheTex('moonsurf', () => canvasTex(T, 256, 128, x => {
      x.fillStyle = '#d9d4c4'; x.fillRect(0, 0, 256, 128); x.fillStyle = '#a9a393';
      [[40, 40, 14], [90, 80, 10], [150, 30, 18], [200, 90, 12], [120, 60, 7], [230, 40, 8], [20, 100, 9]].forEach(([a, b, r]) => { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); });
    }));
    const moon = new T.Mesh(keep(new T.SphereGeometry(5, 32, 20)), keep(new T.MeshBasicMaterial({ map: mtex }))); at(moon, moonP.x, moonP.y, moonP.z);
    spot(kit, moonP, 1, 18, 0xfff6d8);
    if (!kit.reduce) kit.onFrame((dt, t) => { moon.rotation.y = t * 0.15; });
    // лучи от одной точки Луны: почти параллельные; сходятся в фокусе объектива, выходят из окуляра
    const lenses = [{ x: 0, F: F1 }, { x: Tt, F: F2 }], x0 = -16 / k, xe = Tt + 6;
    const LP = (xc, yc) => Lw(v3(xc * k, yc * ky, ZR));
    [[2, 0xff6a55], [0, 0xffd54a], [-2, 0xc58bff]].forEach(([y0, c], i) => {
      const pts = trace(x0, y0 - TH * x0, -TH, lenses, xe).map(p => LP(p[0], p[1]));
      beamPath(kit, pts, 0.95, { col: c, r: 0.13, gr: 0.45, ps: 1.2, sp: 7, v: 18, s0: i * 2 });
    });
    focusMark(kit, LP(F1, 0), 'F₁', -1.6); focusMark(kit, LP(Tt - F2, 0), 'F₂', 1.8);
    const ic = d.sharp ? RAY_OK : 0xffb547, ia = LP(F1, 0), ib = LP(F1, -TH * F1);
    at(box(0.4, Math.max(0.3, ia.distanceTo(ib)), 0.4, ic, { edges: false, matOpt: { emissive: ic, emissiveIntensity: 0.6 } }), (ia.x + ib.x) / 2, (ia.y + ib.y) / 2, ia.z + 0.1);
    // монитор камеры и пульт фокусёра
    const mon = monitor(kit, 46, 2, 0.45, viewTex(T, 'moon', Math.min(8, d.err * 0.6), d.G), 15, 15);
    const camP = Lw(v3(Tt * k + 9, 0, 0));
    kit.cable(camP, mon.back, 0x2c3240, 0, { r: 0.5, lift: 0 });
    const pad = new T.Group(); at(pad, 10, 0, 40); pad.rotation.y = -0.15;
    at(box(22, 1.4, 7.4, 0x1f2430), 0, Y0 + 0.7, 0, pad);
    [['−1', 'T:-1', -7.8, 0x3b6fd8], ['−0,05', 'T:-0.05', -2.6, 0x5d8ae8], ['+0,05', 'T:0.05', 2.6, 0x4fb87a], ['+1', 'T:1', 7.8, 0x2f9e5a]].forEach(([t, kk, x, c]) => button(kit, pad, x, Y0 + 1.4, 0, t, c, kk, 4.8, 4.2));
    const fzW = Lw(v3(Lm + 1.6, -4.6, -1)); pad.updateMatrixWorld(true);
    kit.cable(pad.localToWorld(v3(0, Y0 + 1, -3.5)), fzW, 0x2c3240, 0, { r: 0.4, lift: 0 });
    modePlate(kit, -44, 31, 'tele');
    tag(v3(moonP.x + 2, moonP.y + 7, moonP.z), 'Луна', 'лучи почти параллельны');
    tag(Lw(v3(1, 6.5, 0)), 'Объектив', `F₁ = ${F1} см`);
    tag(Lw(v3(Tt * k + 1, 4.5, 0)), 'Окуляр', `F₂ = ${F2} см · труба ${f(Tt, 2)} см`);
    tag(mon.top, 'В окуляре', `${f(d.G, 1)}× · ${d.sharp ? 'чётко' : 'размыто'}`, d.sharp && Math.abs(d.G - 30) < 1e-6);
    if (d.okm || d.okt) tag(v3(-44, Y0 + 3, 31), 'Готово', `микроскоп ${d.okm ? '✓' : '—'} · телескоп ${d.okt ? '✓' : '—'}`, d.okm && d.okt);
  };
})();
