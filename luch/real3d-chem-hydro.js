// «Как в жизни» для химии: «Основы органики» (labs/chem-orgbase) и «Углеводороды» (labs/chem-hydro).
// Учебный кабинет: шаростержневые и масштабные модели молекул из набора (C чёрный, H белый, Cl зелёный, Br бурый),
// двойные и тройные связи — две-три палочки (π — голубые), доска-конструктор с гнёздами; рядом настоящие опыты:
// газовая горелка, хлор под лампой, баллоны с газами и бромная вода, KMnO₄, штангенциркуль на бензольном кольце,
// макет ректификационной колонны с колбами фракций, качалка Тенгиза и платформа Кашагана, установка крекинга.
// Сцены строятся из window.LUCH_REAL() опыта; быстрые значения (поворот модели, обесцвечивание) — из LUCH_REAL.live() в onFrame.
(() => {
  const SC = window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {};
  const live = () => { try { return window.LUCH_REAL.live ? window.LUCH_REAL.live() : null; } catch (e) { return null; } };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rnd = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const hexs = c => '#' + c.toString(16).padStart(6, '0');
  // цвета набора моделей (CPK): углерод чёрный, водород белый, хлор зелёный, бром бурый
  const CC = 0x34383f, HC = 0xf3f5f9, CLC = 0x3cbf55, BRC = 0x9a2e1c, STICK = 0xd3d9e1, PIC = 0x5cc0e8, HOT = 0xffb547, OKC = 0x2f9e55;

  // ---------- общие детали ----------
  function H(kit) {
    const { T, at, box, cyl, mesh, keep, grad, glowTex, textTex, clickable, C } = kit;
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    const glassMat = (color = 0xd8eef8, opacity = 0.24) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, transparent: true, opacity, side: T.DoubleSide, depthWrite: false }));
    const ownMat = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, ...o }));
    const spr = (map, color, opacity, add) => new T.Sprite(keep(new T.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending })));
    const glow = (color, size, opacity) => { const s = spr(glowTex(), color, opacity, true); s.scale.setScalar(size); return s; };
    const flat = (w, h, tex) => new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: keep(tex), transparent: true })));
    const ball = (r, color, o = {}) => mesh(new T.SphereGeometry(r, o.seg || 18, o.seg2 || 12), color, { hull: o.hull ?? true, edges: false, matOpt: o.matOpt, shadow: o.shadow });
    const glassy = (geo, color = 0xd8eef8, op = 0.22) => { const m = new T.Mesh(keep(geo), glassMat(color, op)); m.add(new T.Mesh(m.geometry, kit.hullMat)); return m; };
    // невидимая зона нажатия (тонкие палочки трудно попасть)
    const hitMat = keep(new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    const hitbox = (geo) => new T.Mesh(keep(geo), hitMat);
    function rodAB(parent, a, b, r, color, o = {}) {
      const dv = b.clone().sub(a), L = dv.length();
      const m = cyl(r, L, color, { edges: false, ...o });
      m.quaternion.setFromUnitVectors(v3(0, 1, 0), dv.normalize());
      return at(m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, parent);
    }
    function canvasTex(pw, ph) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph;
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      return { c, x: c.getContext('2d'), tex };
    }
    function drawLines(x, pw, ph, lines, col, weight = 600) {
      const lh = ph / lines.length;
      lines.forEach((ln, i) => {
        let fs = Math.round(lh * 0.64); x.font = `${weight} ${fs}px "IBM Plex Mono", monospace`;
        const tw = x.measureText(ln).width; if (tw > pw * 0.88) { fs = Math.floor(fs * pw * 0.88 / tw); x.font = `${weight} ${fs}px "IBM Plex Mono", monospace`; }
        x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ln, pw / 2, lh * (i + 0.5) + 2);
      });
    }
    // табло с текстом
    function screen(w, h, txt, fg = '#86e0a8', pw = 320, ph = 120) {
      const k = canvasTex(pw, ph);
      k.x.fillStyle = '#0e1520'; k.x.fillRect(0, 0, pw, ph); drawLines(k.x, pw, ph, String(txt).split('\n'), fg); k.tex.needsUpdate = true;
      return new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: k.tex })));
    }
    // бумажная наклейка с надписью
    function sticker(w, h, txt, fg = '#1b1610', bg = '#fffaf0', pw = 256, border = '#1b1610') {
      const ph = Math.round(pw * h / w), k = canvasTex(pw, ph);
      k.x.clearRect(0, 0, pw, ph); k.x.fillStyle = bg; const r = ph * 0.18;
      k.x.beginPath(); k.x.roundRect ? k.x.roundRect(2, 2, pw - 4, ph - 4, Math.min(r, 22)) : k.x.rect(2, 2, pw - 4, ph - 4); k.x.fill();
      k.x.strokeStyle = border; k.x.lineWidth = 4; k.x.stroke();
      drawLines(k.x, pw, ph, String(txt).split('\n'), fg); k.tex.needsUpdate = true;
      return new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: k.tex, transparent: true })));
    }
    function floorSticker(parent, x, y, z, w, hh, txt, fg, bg, pw, border) { const s = sticker(w, hh, txt, fg, bg, pw, border); s.rotation.x = -Math.PI / 2; return at(s, x, y + 0.06, z, parent); }
    // табличка-клавиша на столе: плитка с надписью сверху
    function key(parent, x, z, w, d, label, on, k, color) {
      const b = new T.Group(); at(b, x, 0, z, parent);
      const col = color ?? (on ? 0x2f6fd8 : 0xdfe5ec);
      at(box(w, 1.4, d, col), 0, 0.7, 0, b);
      const s = flat(w * 0.92, d * 0.82, textTex(label, on || color != null ? '#ffffff' : '#1b1610', hexs(col), Math.round(90 * w / d), 90)); s.rotation.x = -Math.PI / 2; at(s, 0, 1.42, 0, b);
      if (k) clickable(b, k); return b;
    }
    // белый лабораторный поднос-плитка
    function tray(parent, x, z, w, d) {
      at(box(w, 1, d, 0xf1f3f5), x, 0.5, z, parent);
      const nx = Math.floor(w / 12), nz = Math.floor(d / 12);
      for (let i = 1; i < nx; i++) at(box(0.25, 0.06, d - 0.6, 0xc9d1da, { edges: false, shadow: false }), x - w / 2 + i * w / nx, 1.03, z, parent);
      for (let i = 1; i < nz; i++) at(box(w - 0.6, 0.06, 0.25, 0xc9d1da, { edges: false, shadow: false }), x, 1.03, z - d / 2 + i * d / nz, parent);
      return 1;
    }
    function liquid(parent, x, y0, z, r, color, opacity = 0.62, r2) {
      const mat = ownMat(color, { transparent: true, opacity, depthWrite: false });
      const m = new T.Mesh(keep(new T.CylinderGeometry(r2 ?? r, r * 0.97, 1, 32)), mat);
      at(m, x, y0, z, parent);
      const set = (hgt, yb = y0) => { m.visible = hgt > 0.05; m.scale.y = Math.max(0.05, hgt); m.position.y = yb + Math.max(0.05, hgt) / 2; };
      return { m, mat, set };
    }
    // пробирка: открытая трубка с круглым дном
    function testTube(parent, x, y0, z, r, hh) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const wall = glassy(new T.CylinderGeometry(r, r, hh - r, 28, 1, true)); at(wall, 0, r + (hh - r) / 2, 0, g);
      const bot = glassy(new T.SphereGeometry(r, 28, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)); at(bot, 0, r, 0, g);
      const rim = mesh(new T.TorusGeometry(r + 0.1, 0.25, 6, 28), 0xeef6fb, { edges: false }); rim.rotation.x = Math.PI / 2; at(rim, 0, hh, 0, g);
      return { g, r, hh };
    }
    // жидкость в пробирке: полусфера + столбик до уровня lv (от дна)
    function tubeLiquid(parent, r, lv, color, opacity, y0 = 0) {
      const mat = ownMat(color, { transparent: true, opacity, depthWrite: false }), g = new T.Group(); parent.add(g);
      const rr = r * 0.88;
      if (y0 <= 0) at(new T.Mesh(keep(new T.SphereGeometry(rr, 24, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), mat), 0, r, 0, g);
      const yb = Math.max(r, y0);
      if (lv > yb) at(new T.Mesh(keep(new T.CylinderGeometry(rr, rr, lv - yb, 24)), mat), 0, yb + (lv - yb) / 2, 0, g);
      return { g, mat };
    }
    // склянка с реактивом
    function bottle(parent, x, y0, z, o = {}) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const r = o.r || 3.6, h = o.h || 9, gc = o.glass ?? 0xd8eef8;
      const wall = glassy(new T.CylinderGeometry(r, r, h, 28, 1, true), gc, o.op ?? 0.32); at(wall, 0, h / 2, 0, g);
      at(cyl(r, 0.5, gc, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.5 } }), 0, 0.25, 0, g);
      const sh = glassy(new T.CylinderGeometry(r * 0.42, r, r * 0.7, 28, 1, true), gc, o.op ?? 0.32); at(sh, 0, h + r * 0.35, 0, g);
      if (o.liq != null) { const lq = liquid(g, 0, 0.5, 0, r * 0.92, o.liq, o.lop ?? 0.6); lq.set(h * (o.fill ?? 0.62)); }
      at(cyl(r * 0.46, 2.2, o.cap ?? 0x2c3240), 0, h + r * 0.7 + 1.1, 0, g);
      if (o.label) { const s = sticker(r * 1.8, o.lh || r * 1.1, o.label, o.fg || '#1b1610', o.bg || '#fffaf0', 220); at(s, 0, h * 0.5, r + 0.06, g); }
      return { g, top: h + r * 0.7 + 2.2 };
    }
    // пузырьки в жидкости
    function bubbles(parent, x, y0, z, r, n = 8, color = 0xffffff) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const geo = keep(new T.SphereGeometry(1, 10, 8)), mat = keep(new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false }));
      const bs = [];
      for (let i = 0; i < n; i++) { const m = new T.Mesh(geo, mat); m.visible = false; g.add(m); bs.push({ m, ph: rnd(i + 11), a: rnd(i + 21) * Math.PI * 2, rr: Math.sqrt(rnd(i + 31)) * r }); }
      const st = { amt: 0, top: 5, big: 0.5, speed: 0.6 };
      kit.onFrame((dt, t) => {
        const k = Math.round(st.amt * n);
        bs.forEach((b, i) => {
          b.m.visible = i < k && st.top > 1.2; if (!b.m.visible) return;
          const ph = kit.reduce ? b.ph : (t * st.speed + b.ph) % 1;
          b.m.scale.setScalar(st.big * (0.5 + 0.8 * ph));
          b.m.position.set(Math.cos(b.a) * b.rr + 0.3 * Math.sin(t * 5 + i), 0.4 + ph * (st.top - 0.9), Math.sin(b.a) * b.rr);
        });
      });
      return { g, set(a, top, big = 0.5, speed = 0.6) { Object.assign(st, { amt: a, top, big, speed }); } };
    }
    // клубы пара/дыма: поднимаются и тают
    let puffT = null;
    function puffTex() {
      if (puffT) return puffT;
      const k = canvasTex(64, 64), gr = k.x.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.5, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      k.x.fillStyle = gr; k.x.fillRect(0, 0, 64, 64); puffT = k.tex; return puffT;
    }
    function puffs(parent, x, y, z, o = {}) {
      const n = o.n || 6, ps = [], g = new T.Group(); at(g, x, y, z, parent);
      for (let i = 0; i < n; i++) { const s = spr(puffTex(), o.color ?? 0xffffff, 0, false); g.add(s); ps.push({ s, ph: i / n, dx: (rnd(i + 3) - 0.5) * (o.spread ?? 6), dz: (rnd(i + 9) - 0.5) * (o.spread ?? 6) }); }
      const st = { amt: o.amt ?? 1 };
      kit.onFrame((dt, t) => {
        for (const p of ps) {
          const ph = kit.reduce ? 0.15 + p.ph * 0.7 : (t * (o.speed || 0.3) + p.ph) % 1;
          p.s.position.set(p.dx * (0.6 + ph), ph * (o.rise ?? 10), p.dz * (0.6 + ph));
          p.s.scale.setScalar((o.size || 4) * (0.6 + ph * 1.3));
          p.s.material.opacity = st.amt * (o.op ?? 0.5) * Math.sin(Math.PI * ph);
        }
      });
      return { g, set(a) { st.amt = a; } };
    }
    // пламя-конус: внутренний и внешний конус, свечение, дрожание
    function flame(parent, x, y, z, hgt, outer, inner, o = {}) {
      const f = new T.Group(); at(f, x, y, z, parent);
      at(cyl(hgt * 0.2, hgt, outer, { r2: 0.05, edges: false, hull: false, shadow: false, matOpt: { emissive: outer, emissiveIntensity: 0.9, transparent: true, opacity: o.op ?? 0.75 } }), 0, hgt / 2, 0, f);
      at(cyl(hgt * 0.11, hgt * 0.45, inner, { r2: 0.04, edges: false, hull: false, shadow: false, matOpt: { emissive: inner, emissiveIntensity: 1, transparent: true, opacity: 0.9 } }), 0, hgt * 0.23, 0, f);
      at(glow(o.glow ?? outer, hgt * 2.4, 0.55), 0, hgt * 0.45, 0, f);
      if (o.light) at(new T.PointLight(o.glow ?? outer, o.light, 40, 1.4), 0, hgt * 0.6, 0, f);
      if (!kit.reduce) kit.onFrame((dt, t) => { f.scale.set(1 + 0.07 * Math.sin(t * 19 + x), 1 + 0.12 * Math.sin(t * 13 + z) + 0.05 * Math.sin(t * 31), 1 + 0.07 * Math.cos(t * 17)); });
      return f;
    }
    // лабораторный штатив
    function stand(parent, x, z, Hh, arms, y0 = 0) {
      at(box(12, 1.2, 9, C.DARK), x, y0 + 0.6, z, parent);
      at(cyl(0.65, Hh, C.STEEL, { edges: false }), x, y0 + 1.2 + Hh / 2, z, parent);
      arms.forEach(a => {
        rodAB(parent, v3(x, a.y, z), v3(a.to.x, a.y, a.to.z), 0.42, C.STEEL);
        at(box(2.2, 2.2, 2.2, C.DARK), x, a.y, z, parent);
        at(box(a.w || 2.6, 2.4, 2.6, 0x3b4a66), a.to.x, a.y, a.to.z, parent);
      });
    }
    // HTML-подпись, значение которой можно менять в onFrame
    function liveTag(p, name, value, hot) {
      kit.tag(p, name, value, hot);
      const els = document.querySelectorAll('.rl-view .rl-lbl'), el = els[els.length - 1], i = el && el.querySelector('i');
      let cur = value;
      return v => { if (i && v !== cur) { cur = v; i.textContent = v; } };
    }
    const halo = (parent, x, y, z, size = 16) => at(glow(0xffd166, size, 0.4), x, y, z, parent);
    // деревянная подставка со стержнем (держатель модели)
    function modelStand(parent, x, z, hgt, r = 5) {
      at(cyl(r, 1.4, C.WOOD2), x, 0.7, z, parent);
      at(cyl(0.4, hgt - 1.4, 0xdfe7ef, { edges: false, matOpt: { transparent: true, opacity: 0.7 } }), x, 1.4 + (hgt - 1.4) / 2, z, parent);
    }
    return { v3, glassMat, ownMat, spr, glow, flat, ball, glassy, hitbox, rodAB, canvasTex, drawLines, screen, sticker, floorSticker, key, tray, liquid,
      testTube, tubeLiquid, bottle, bubbles, puffs, flame, stand, liveTag, halo, modelStand };
  }

  // ---------- модели молекул ----------
  // палочки связи: 1 — одна, 2 — две (вторая голубая, π), 3 — три вокруг оси
  function bondRods(kit, h, parent, a, b, ord, nrm, o = {}) {
    const col = o.col ?? STICK, pcol = o.pcol ?? PIC, s = o.s ?? 1;
    if (ord <= 1) { h.rodAB(parent, a, b, 0.42 * s, col); return; }
    if (ord === 2) {
      const off = nrm.clone().multiplyScalar(0.62 * s);
      h.rodAB(parent, a.clone().add(off), b.clone().add(off), 0.32 * s, pcol); h.rodAB(parent, a.clone().sub(off), b.clone().sub(off), 0.32 * s, col); return;
    }
    const ax = b.clone().sub(a).normalize(), n2 = ax.clone().cross(nrm).normalize();
    for (let k = 0; k < 3; k++) {
      const an = k * 2 * Math.PI / 3 + Math.PI / 2, off = nrm.clone().multiplyScalar(Math.cos(an) * 0.68 * s).add(n2.clone().multiplyScalar(Math.sin(an) * 0.68 * s));
      h.rodAB(parent, a.clone().add(off), b.clone().add(off), 0.28 * s, k ? pcol : col);
    }
  }
  const SQ3 = 1 / Math.sqrt(3);
  const TETRA = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(a => a.map(x => x * SQ3));
  // направления свободных связей у атома C на плоской доске-конструкторе (соседи — по сетке)
  function gridHDirs(T, nbrs, n, occ) {
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    if (!n) return [];
    if (!nbrs.length) return TETRA.slice(0, n).map(a => v3(...a));
    const c = v3(0, 0, 0); nbrs.forEach(e => c.add(e.dir));
    const dbl = nbrs.some(e => e.ord === 2), tri = nbrs.some(e => e.ord === 3), tilt = dbl ? 0.58 : 0.4;
    const up = v3(0, 1, 0).addScaledVector(c, -tilt).normalize(), dn = v3(0, -1, 0).addScaledVector(c, -tilt).normalize();
    const plane = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([x, z]) => v3(x, 0, z)).filter(q => !nbrs.some(e => e.dir.dot(q) > 0.9));
    const free = plane.filter(q => !occ(q)), blocked = plane.filter(q => occ(q));
    const back = c.clone().negate();
    free.sort((a, b) => b.dot(back) - a.dot(back));
    const list = tri ? [...free, up, dn, ...blocked] : [up, dn, ...free, ...blocked];
    return list.slice(0, n);
  }
  // молекула на доске: атомы {x, z} (центры C), связи [i, j, порядок]; у каждого C свои H. Возвращает группы атомов.
  function gridMol(kit, h, parent, atoms, bonds, o = {}) {
    const { T, at } = kit, v3 = h.v3, y0 = o.y0 ?? 5, step = o.step ?? 10;
    const P = atoms.map(a => v3(a.x, y0, a.z));
    const occSet = new Set(atoms.map(a => Math.round(a.x) + ',' + Math.round(a.z)));
    const nb = atoms.map(() => []);
    bonds.forEach(([i, j, ord]) => { const dv = P[j].clone().sub(P[i]).normalize(); nb[i].push({ j, dir: dv, ord }); nb[j].push({ j: i, dir: dv.clone().negate(), ord }); });
    const cg = atoms.map((a, i) => { const gg = new T.Group(); at(gg, P[i].x, P[i].y, P[i].z, parent); return gg; });
    atoms.forEach((a, i) => {
      at(h.ball(o.rC ?? 1.9, a.col ?? CC), 0, 0, 0, cg[i]);
      if (a.ring) { const tr = kit.mesh(new T.TorusGeometry(2.45, 0.32, 8, 28), a.ring, { edges: false, hull: false }); tr.rotation.x = Math.PI / 2; at(tr, 0, 0, 0, cg[i]); }
      if (o.noH) return;
      const used = nb[i].reduce((s, e) => s + e.ord, 0), nH = Math.max(0, 4 - used);
      const dirs = gridHDirs(T, nb[i], nH, q => occSet.has(Math.round(a.x + q.x * step) + ',' + Math.round(a.z + q.z * step)));
      dirs.forEach(dv => { const hp = dv.clone().multiplyScalar(3.1); h.rodAB(cg[i], v3(0, 0, 0), hp, 0.36, STICK); at(h.ball(1.05, HC), hp.x, hp.y, hp.z, cg[i]); });
    });
    bonds.forEach(([i, j, ord, col]) => bondRods(kit, h, parent, P[i], P[j], ord, v3(0, 1, 0), { col }));
    return { P, cg };
  }
  // направления недостающих связей до тетраэдра (настоящая геометрия sp³)
  function tetraFill(T, nbrs, ref) {
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    if (!nbrs.length) return TETRA.map(a => v3(...a));
    if (nbrs.length === 1) {
      const a = nbrs[0], p = ref.clone().addScaledVector(a, -ref.dot(a)).normalize(), q = a.clone().cross(p).normalize(), out = [];
      for (let j = 0; j < 3; j++) { const an = j * 2 * Math.PI / 3; out.push(a.clone().multiplyScalar(-1 / 3).add(p.clone().multiplyScalar(Math.cos(an) * Math.sqrt(8) / 3)).add(q.clone().multiplyScalar(Math.sin(an) * Math.sqrt(8) / 3))); }
      return out;
    }
    if (nbrs.length === 2) {
      const u = nbrs[0].clone().add(nbrs[1]).negate().normalize(), p = nbrs[0].clone().cross(nbrs[1]).normalize(), A = 54.75 * Math.PI / 180;
      return [u.clone().multiplyScalar(Math.cos(A)).add(p.clone().multiplyScalar(Math.sin(A))), u.clone().multiplyScalar(Math.cos(A)).sub(p.clone().multiplyScalar(Math.sin(A)))];
    }
    return [nbrs.reduce((s, x) => s.add(x), v3(0, 0, 0)).negate().normalize()];
  }
  // цепь алкана зигзагом (sp³): n атомов C, cl — первый атом H на C1 заменён на Cl. Центр — в начале координат группы.
  function alkaneChain(kit, h, parent, n, o = {}) {
    const { T, at } = kit, v3 = h.v3, d = o.d ?? 4.3, dy = o.dy ?? 1.3;
    const P = []; for (let i = 0; i < n; i++) P.push(v3((i - (n - 1) / 2) * d, n === 1 ? 0 : (i % 2 ? dy : -dy), 0));
    const cs = [];
    P.forEach((p, i) => {
      cs.push(at(h.ball(1.9, CC), p.x, p.y, p.z, parent));
      const nbrs = []; if (i) nbrs.push(P[i - 1].clone().sub(p).normalize()); if (i < n - 1) nbrs.push(P[i + 1].clone().sub(p).normalize());
      const ref = v3(0, n === 1 ? 1 : Math.sign(p.y) || 1, 0);
      const dirs = tetraFill(T, nbrs, ref);
      dirs.forEach((dv, k) => {
        const isCl = o.cl && i === 0 && k === 0, L = isCl ? 4.1 : 3.1, hp = p.clone().addScaledVector(dv, L);
        h.rodAB(parent, p, hp, 0.36, STICK); at(h.ball(isCl ? 1.75 : 1.05, isCl ? CLC : HC), hp.x, hp.y, hp.z, parent);
        if (isCl && o.onCl) o.onCl(hp);
      });
      if (i) h.rodAB(parent, P[i - 1], p, 0.42, STICK);
    });
    return { P, cs, w: (n - 1) * d + 8 };
  }
  // скелет из дерева (запись канона «(()())») на сетке: главная цепь по x, ветви — вперёд/назад
  function treeLayout(canon) {
    let i = 0; const adj = [];
    const rec = p => { const id = adj.length; adj.push([]); if (p >= 0) { adj[id].push(p); adj[p].push(id); } i++; while (canon[i] === '(') rec(id); i++; return id; };
    rec(-1);
    const far = s => { const dist = adj.map(() => -1), par = adj.map(() => -1), q = [s]; dist[s] = 0; while (q.length) { const v = q.shift(); for (const w of adj[v]) if (dist[w] < 0) { dist[w] = dist[v] + 1; par[w] = v; q.push(w); } } let b = s; dist.forEach((x, k) => { if (x > dist[b]) b = k; }); return { b, par }; };
    const a = far(0).b, r = far(a), path = []; for (let v = r.b; v >= 0; v = r.par[v]) path.push(v);
    const pos = {}, inP = new Set(path);
    path.forEach((v, k) => { pos[v] = [k, 0]; });
    const place = (v, from, col, row, dir) => { pos[v] = [col, row]; let c = 0; for (const w of adj[v]) if (w !== from) { place(w, v, col + c, row + dir, dir); c++; } };
    path.forEach((v, k) => { let s = 0; for (const w of adj[v]) if (!inP.has(w)) { place(w, v, k, s ? -1 : 1, s ? -1 : 1); s++; } });
    const atoms = adj.map((x, k) => pos[k]), bonds = []; adj.forEach((ns, k) => ns.forEach(w => { if (w > k) bonds.push([k, w, 1]); }));
    return { atoms, bonds, len: path.length };
  }

  // =====================================================================================
  // ОСНОВЫ ОРГАНИКИ
  // =====================================================================================

  // доска-конструктор 7 × 4 гнезда: атомы C на гнёздах, «+» рядом — новый атом, связь — кратнее
  function builder(kit, h, g, d, o = {}) {
    const { T, at, box, cyl, clickable } = kit, v3 = h.v3;
    const SP = 10, BZ = 0, BT = 1.4, COLS = 7, ROWS = 4, S = o.s ?? 1, BZw = o.bz ?? 0;
    const outer = g; g = new T.Group(); at(g, 0, 0, BZw, outer); g.scale.setScalar(S);
    const W = (x, y, z) => v3(x * S, y * S, BZw + z * S);
    const nx = id => (id % COLS - 3) * SP, nz = id => BZ + (Math.floor(id / COLS) - 1.5) * SP;
    const nbrNodes = id => { const c = id % COLS, r = (id / COLS) | 0, out = []; if (c > 0) out.push(id - 1); if (c < COLS - 1) out.push(id + 1); if (r > 0) out.push(id - COLS); if (r < ROWS - 1) out.push(id + COLS); return out; };
    // доска из фанеры с рамкой
    at(box(76, 1.0, 46, 0xe2c79a), 0, 0.5, BZ, g);
    at(box(78, 1.4, 1.6, 0xb98a55), 0, 0.7, BZ - 23.4, g); at(box(78, 1.4, 1.6, 0xb98a55), 0, 0.7, BZ + 23.4, g);
    at(box(1.6, 1.4, 46, 0xb98a55), -38.2, 0.7, BZ, g); at(box(1.6, 1.4, 46, 0xb98a55), 38.2, 0.7, BZ, g);
    const atSet = new Set(d.at), canAdd = d.at.length < d.lim;
    const bonds = Object.entries(d.bd).map(([k, ord]) => { const [a, b] = k.split('-').map(Number); return [a, b, ord]; });
    const bonded = new Set(Object.keys(d.bd));
    const plusTex = kit.textTex('+', '#ffffff', '#2f9e55', 96, 96);
    for (let id = 0; id < COLS * ROWS; id++) {
      if (atSet.has(id)) continue;
      const near = nbrNodes(id).some(x => atSet.has(x));
      if (near && canAdd) {
        const b = new T.Group(); at(b, nx(id), 1.0, nz(id), g);
        at(cyl(2.2, 0.6, OKC, { seg: 24 }), 0, 0.3, 0, b);
        const s = new T.Mesh(kit.keep(new T.PlaneGeometry(3.4, 3.4)), kit.keep(new T.MeshBasicMaterial({ map: plusTex, transparent: true }))); s.rotation.x = -Math.PI / 2; at(s, 0, 0.62, 0, b);
        at(h.hitbox(new T.CylinderGeometry(3.6, 3.6, 2, 12)), 0, 1, 0, b);
        clickable(b, 'add-' + id);
      } else at(cyl(0.7, 0.14, 0x7a5a34, { edges: false, hull: false, shadow: false }), nx(id), 1.07, nz(id), g);
    }
    const idx = {}; d.at.forEach((id, i) => { idx[id] = i; });
    const atoms = d.at.map(id => ({ x: nx(id), z: nz(id), ring: o.ring && o.ring(id) }));
    const y0 = BT + 2.9;
    const M = gridMol(kit, h, g, atoms, bonds.map(([a, b, ord]) => [idx[a], idx[b], ord, o.bondCol && o.bondCol(a, b)]), { y0, step: SP });
    M.cg.forEach((gg, i) => { if (o.atomKey) clickable(gg, o.atomKey(d.at[i], i)); });
    // нажатие на связь
    if (o.gapKey) {
      bonds.forEach(([a, b]) => {
        const p = v3(nx(a), y0, nz(a)), q = v3(nx(b), y0, nz(b)), hb = h.hitbox(new T.CylinderGeometry(1.8, 1.8, SP - 4.6, 8));
        hb.quaternion.setFromUnitVectors(v3(0, 1, 0), q.clone().sub(p).normalize()); at(hb, (p.x + q.x) / 2, y0, (p.z + q.z) / 2, g); clickable(hb, o.gapKey(a, b));
      });
      // соседи без связи: пунктир — нажать, чтобы замкнуть кольцо
      if (o.ringHint) d.at.forEach(a => nbrNodes(a).forEach(b => {
        if (b < a || !atSet.has(b) || bonded.has(a + '-' + b) || bonded.has(b + '-' + a)) return;
        const p = v3(nx(a), y0, nz(a)), q = v3(nx(b), y0, nz(b)), gg = new T.Group(); g.add(gg);
        for (let k = 1; k <= 3; k++) at(h.ball(0.45, 0xa9b6c8, { hull: false, seg: 8, seg2: 6 }), p.x + (q.x - p.x) * k / 4, y0, p.z + (q.z - p.z) * k / 4, gg);
        const hb = h.hitbox(new T.CylinderGeometry(1.8, 1.8, SP - 4.6, 8)); hb.quaternion.setFromUnitVectors(v3(0, 1, 0), q.clone().sub(p).normalize()); at(hb, (p.x + q.x) / 2, y0, (p.z + q.z) / 2, gg);
        clickable(gg, o.gapKey(a, b));
      }));
    }
    return { M, nx, nz, y0, W };
  }

  // ===== 1. Почему углерод особенный: доска-конструктор, коробка набора, карточка целей =====
  SC['chhy-carbon'] = (kit, d) => {
    const { T, at, box, cyl, tag } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const B = builder(kit, h, g, d, { bz: -9, s: 1.42, atomKey: id => 'rm-' + id, gapKey: (a, b) => 'gap-' + a + '-' + b, ringHint: true });
    // формула над молекулой
    const xs = d.at.map(B.nx), zs = d.at.map(B.nz);
    tag(B.W((Math.min(...xs) + Math.max(...xs)) / 2, B.y0 + 7, Math.min(...zs)), 'Углеводород ' + d.f,
      `C: ${d.n} · H: ${d.H}` + (d.pi ? ` · π: ${d.pi}` : '') + (d.rings ? ` · колец: ${d.rings}` : ''));
    // карточка целей и кнопки
    h.floorSticker(g, -36, 0, 39, 40, 14, d.got.map(([n, ok]) => (ok ? '✓ ' : '· ') + n).join('\n'), '#1b1610', '#eef7ee', 420);
    h.key(g, 0, 40, 16, 8, 'Отменить', false, 'undo');
    h.key(g, 20, 40, 16, 8, 'Очистить', false, 'clear');
    // коробка набора моделей: ячейки с чёрными C и белыми H
    const kb = new T.Group(); at(kb, 47, 0, 38, g); kb.rotation.y = -0.2;
    at(box(22, 3, 14, 0x2f6fd8), 0, 1.5, 0, kb);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) at(box(6.4, 0.6, 5.8, 0x24539f, { edges: false }), -7 + i * 7, 3.1, -3.2 + j * 6.4, kb);
    for (let k = 0; k < 18; k++) { const c = k % 3, row = (k / 9) | 0, isC = c === 0 || (c === 1 && row === 0); at(h.ball(isC ? 1.3 : 0.85, isC ? CC : HC, { seg: 10, seg2: 8 }), -7 + c * 7 + (rnd(k) - 0.5) * 3, 4.2, -3.2 + row * 6.4 + (rnd(k + 5) - 0.5) * 2.6, kb); }
    const lb = h.sticker(18, 3.6, 'Набор моделей · C и H', '#ffffff', '#24539f', 300, '#ffffff'); at(lb, 0, 1.6, 7.06, kb);
  };

  // ===== 2. Строение молекул: модель на поворотной стойке, транспортир, масштабная модель, выбор молекулы =====
  SC['chhy-struct'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const M = d.mols[d.mol];
    // шаростержневая модель: координаты в ангстремах → K единиц
    function ballStick(parent, Mo, K, o = {}) {
      const P = Mo.atoms.map(a => v3(a[1] * K, a[2] * K, a[3] * K));
      const s = o.s ?? 1;
      Mo.atoms.forEach((a, i) => at(h.ball((a[0] === 'C' ? 1.9 : 1.1) * s, a[0] === 'C' ? CC : HC), P[i].x, P[i].y, P[i].z, parent));
      const arcSet = o.arc ? new Set([Mo.arc[0] + '-' + Mo.arc[1], Mo.arc[1] + '-' + Mo.arc[0], Mo.arc[2] + '-' + Mo.arc[1], Mo.arc[1] + '-' + Mo.arc[2]]) : null;
      Mo.bonds.forEach(([i, j, ord]) => {
        const nrm = Math.abs(P[j].y - P[i].y) < 0.01 && Math.abs(P[j].z - P[i].z) < 0.01 ? (Mo.atoms.length === 4 ? v3(0, 1, 0) : v3(0, 0, 1)) : v3(0, 0, 1);
        const hot = arcSet && arcSet.has(i + '-' + j);
        bondRods(kit, h, parent, P[i], P[j], ord, nrm, { s, col: hot ? HOT : STICK });
      });
      return P;
    }
    // --- главная модель на прозрачной стойке ---
    const MX = -12, MZ = 2, MY = 30, K = 12;
    h.modelStand(g, MX, MZ, MY - 0.5, 8);
    const rot = new T.Group(); at(rot, MX, MY, MZ, g);
    const mol = new T.Group(); rot.add(mol);
    const P = ballStick(mol, M, K, { arc: true, s: 1.6 });
    // тетраэдр метана — тонкие рёбра между атомами H
    if (M.atoms.length === 5) for (let i = 1; i < 5; i++) for (let j = i + 1; j < 5; j++) h.rodAB(mol, P[i], P[j], 0.22, 0x72d4e8, { hull: false, matOpt: { transparent: true, opacity: 0.55 } });
    // транспортир: дуга между оранжевыми связями
    const [ia, ic, ib] = M.arc, u = P[ia].clone().sub(P[ic]).normalize(), w = P[ib].clone().sub(P[ic]).normalize(), ang = u.angleTo(w);
    const pts = []; for (let k = 0; k <= 24; k++) { const t = k / 24, q = u.clone().multiplyScalar(Math.sin((1 - t) * ang)).add(w.clone().multiplyScalar(Math.sin(t * ang))).divideScalar(Math.sin(ang)); pts.push(P[ic].clone().addScaledVector(q, 6.4)); }
    at(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 40, 0.5, 6), HOT, { edges: false, hull: false }), 0, 0, 0, mol);
    const fan = new T.BufferGeometry(), fv = [];
    for (let k = 0; k < 24; k++) { fv.push(P[ic].x, P[ic].y, P[ic].z, pts[k].x, pts[k].y, pts[k].z, pts[k + 1].x, pts[k + 1].y, pts[k + 1].z); }
    fan.setAttribute('position', new T.Float32BufferAttribute(fv, 3));
    mol.add(new T.Mesh(kit.keep(fan), kit.keep(new T.MeshBasicMaterial({ color: HOT, transparent: true, opacity: 0.28, side: T.DoubleSide, depthWrite: false }))));
    tag(v3(MX, MY + 22, MZ), M.name + ' ' + M.cond, M.hyb ? 'углерод ' + M.hyb : 'гибридизация — ?', M.ans);
    tag(v3(MX + 24, MY - 12, MZ + 12), 'Угол ' + M.pair, d.real + '°');
    // --- масштабная (полусферическая) модель той же молекулы ---
    const SX = 38, SZ = -10, SY = 17, KS = 6;
    h.modelStand(g, SX, SZ, SY - 7, 6);
    const srot = new T.Group(); at(srot, SX, SY, SZ, g);
    M.atoms.forEach(a => at(h.ball(a[0] === 'C' ? 1.7 * KS * 0.78 : 1.2 * KS * 0.78, a[0] === 'C' ? CC : HC, { seg: 24, seg2: 16 }), a[1] * KS, a[2] * KS, a[3] * KS, srot));
    tag(v3(SX, SY + 16, SZ), 'Масштабная модель', M.f);
    // --- три молекулы для выбора (сзади) ---
    d.mols.forEach((Mo, i) => {
      const x = -52, z = -24 + i * 21, sel = i === d.mol, gg = new T.Group(); at(gg, x, 0, z, g); clickable(gg, 'mol' + i);
      at(cyl(7, 1.2, sel ? 0xffd166 : C.WOOD2), 0, 0.6, 0, gg);
      at(cyl(0.35, 9, 0xdfe7ef, { edges: false }), 0, 5.5, 0, gg);
      const mg = new T.Group(); at(mg, 0, 11, 0, gg); ballStick(mg, Mo, 4.2, { s: 0.8 });
      mg.rotation.y = 0.5;
      const s = h.sticker(16, 5.6, Mo.name + '\n' + (Mo.ans ? '✓ ' + Mo.hyb : Mo.f), '#1b1610', Mo.ans ? '#d9f2df' : sel ? '#fff1c4' : '#fffaf0', 240); s.rotation.x = -0.5; at(s, 0, 1.8, 8.6, gg);
    });
    // карточки ответа: sp³, sp², sp
    [['sp3', 'sp³'], ['sp2', 'sp²'], ['sp', 'sp']].forEach(([k, lbl], i) => {
      const right = M.ans && M.hyb === { sp3: 'sp³', sp2: 'sp²', sp: 'sp' }[k];
      h.key(g, -34 + i * 20, 41, 16, 8, lbl, false, 'hyb-' + k, right ? OKC : 0x3b4a66);
    });
    h.floorSticker(g, 42, 0, 34, 30, 10, 'σ — белые палочки\nπ — голубые', '#1b1610', '#fffaf0', 320);
    const rest = { yaw: 0.6, pitch: 0.35 };
    kit.onFrame(() => {
      const L = live() || rest;
      rot.rotation.set(0, 0, 0); rot.rotation.order = 'XYZ'; rot.rotation.x = -L.pitch * 0.8; rot.rotation.y = L.yaw;
      srot.rotation.order = 'XYZ'; srot.rotation.x = -L.pitch * 0.8; srot.rotation.y = L.yaw;
    });
  };

  // ===== 3. Изомерия: доска-конструктор + полка найденных изомеров с температурами кипения =====
  SC['chhy-iso'] = (kit, d) => {
    const { T, at, box, cyl, tag, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const B = builder(kit, h, g, d, { bz: 8, s: 1.2, atomKey: id => 'rm-' + id, gapKey: (a, b) => 'gap-' + a + '-' + b });
    const xs = d.at.map(B.nx), zs = d.at.map(B.nz);
    const fN = '' + d.N, sub = s => s.replace(/\d/g, x => '₀₁₂₃₄₅₆₇₈₉'[x]);
    tag(B.W((Math.min(...xs) + Math.max(...xs)) / 2, B.y0 + 7, Math.min(...zs)), 'Собрано: C' + sub('' + d.n) + (d.n ? 'H' + sub('' + d.H) : ''),
      d.name ? d.name : `${d.n} из ${d.N} атомов C`, !!d.name);
    // полка с найденными изомерами
    const SZ = -34, SH = 5;
    at(box(116, SH, 12, C.WOOD), 0, SH / 2, SZ, g);
    at(box(116, 14, 1.2, C.WOOD2), 0, SH + 7, SZ - 5.4, g);
    const n = d.total, sp = Math.min(37, 114 / n), s = n > 4 ? 0.46 : 0.62;
    for (let k = 0; k < n; k++) {
      const x = -((n - 1) * sp) / 2 + k * sp, I = d.iso[k];
      if (!I) { const q = h.sticker(sp * 0.7, 6, '?\nещё не найден', '#6b7383', '#f4f6f9', 220, '#9aa3b2'); at(q, x, SH + 10.5, SZ - 4.7, g); continue; }
      const L = treeLayout(I.c), cols = L.atoms.map(a => a[0]), mid = (Math.min(...cols) + Math.max(...cols)) / 2;
      const mg = new T.Group(); at(mg, x, SH, SZ + 1.5, g); mg.scale.setScalar(s);
      gridMol(kit, h, mg, L.atoms.map(a => ({ x: (a[0] - mid) * 10, z: a[1] * 10 })), L.bonds, { y0: 4 });
      const plate = h.sticker(sp * 0.86, 5.4, I.nm + '\nt кип ' + (I.bp ?? '?') + ' °C', '#1b1610', I.c === d.canon ? '#fff1c4' : '#eef7ee', 300);
      at(plate, x, SH + 10.5, SZ - 4.7, g);
    }
    [4, 5, 6].forEach((k, i) => h.key(g, -46 + i * 17, 44, 15, 7, 'C' + sub('' + k) + 'H' + sub('' + (2 * k + 2)), d.N === k, 'n' + k));
    h.key(g, 24, 44, 16, 7, 'Отменить', false, 'undo');
    h.key(g, 44, 44, 16, 7, 'Очистить', false, 'clear');
  };

  // ===== 4. Названия веществ: модель на доске, главная цепь с номерами, заместители, табличка с названием =====
  SC['chhy-names'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable } = kit, h = H(kit), v3 = h.v3;
    const G0 = new T.Group(); at(G0, 0, 0, 0);
    const g = new T.Group(); at(g, 0, 0, -9, G0); g.scale.setScalar(1.42);
    const SP = 10, BZ = 0, BT = 1.4, nx = c => (c - 3) * SP, nz = r => BZ + (r - 1.5) * SP;
    at(box(76, 1.0, 46, 0xe2c79a), 0, 0.5, BZ, g);
    at(box(78, 1.4, 1.6, 0xb98a55), 0, 0.7, BZ - 23.4, g); at(box(78, 1.4, 1.6, 0xb98a55), 0, 0.7, BZ + 23.4, g);
    at(box(1.6, 1.4, 46, 0xb98a55), -38.2, 0.7, BZ, g); at(box(1.6, 1.4, 46, 0xb98a55), 38.2, 0.7, BZ, g);
    const ch = d.chain, onChain = (a, b) => { const i = ch.indexOf(a), j = ch.indexOf(b); return i >= 0 && j >= 0 && Math.abs(i - j) === 1; };
    const atoms = d.atoms.map(([c, r], i) => ({ x: nx(c), z: nz(r), ring: ch.includes(i) ? HOT : null }));
    const y0 = BT + 2.9;
    const M = gridMol(kit, h, g, atoms, d.bonds.map(([a, b]) => [a, b, 1, onChain(a, b) ? HOT : undefined]), { y0 });
    M.cg.forEach((gg, i) => clickable(gg, 'at-' + i));
    // флажки с номерами атомов главной цепи
    const flag = (x, z, txt, bg, w = 4.2) => {
      const fg = new T.Group(); at(fg, x, 0, z, g);
      at(cyl(0.18, y0 + 6, 0x8a94a6, { edges: false }), 0, BT + (y0 + 6) / 2 - 1.4, 0, fg);
      const s = h.sticker(w, 3.6, txt, '#1b1610', bg, Math.round(64 * w)); s.rotation.y = 0.55; at(s, w / 2 * Math.cos(0.55), y0 + 4.4, -w / 2 * Math.sin(0.55), fg);
      return fg;
    };
    ch.forEach((a, k) => flag(atoms[a].x + 3.2, atoms[a].z + 3.4, '' + (k + 1), '#ffd88a'));
    d.subs.forEach(s => flag(atoms[s.a].x - 3.4, atoms[s.a].z + 3.4, s.loc + '-' + s.name, '#c9f0d4', 9));
    // табличка с названием
    const txt = {
      empty: d.done ? '✓ Эта молекула уже названа' : 'Нажмите на крайний атом самой длинной цепи',
      grow: `Цепь: ${d.k} C — продолжайте`, short: `Цепь: ${d.k} C — есть цепь длиннее`,
      ok: '✓ ' + d.user, flip: `${d.user}\nномера можно сделать меньше`, other: `${d.user}\nесть цепь с бо́льшим числом заместителей`,
    }[d.status];
    const good = d.status === 'ok' || (d.status === 'empty' && d.done), warn = ['flip', 'other', 'short'].includes(d.status);
    const plate = new T.Group(); at(plate, -6, 0, 33, G0);
    at(box(58, 2, 9, 0x3b4a66), 0, 1, 0, plate);
    const st = h.screen(55, 7.4, txt, good ? '#86e0a8' : warn ? '#ffb547' : '#c8d1e2', 900, 112); st.rotation.x = -Math.PI / 2; at(st, 0, 2.05, 0, plate);
    h.key(G0, -52, 45, 9, 7, '‹', false, 'prev');
    h.floorSticker(G0, -40, 0, 45, 12, 6, `${d.nm + 1} / ${d.total}` + (d.done ? ' ✓' : ''), '#1b1610', d.done ? '#d9f2df' : '#fffaf0', 200);
    h.key(G0, -28, 45, 9, 7, '›', false, 'next');
    h.key(G0, 18, 45, 19, 7, 'Перевернуть', false, 'flip');
    h.key(G0, 40, 45, 17, 7, 'Сбросить', false, 'reset');
    h.floorSticker(G0, 46, 0, 33, 22, 7, `названо ${d.named} из 3`, '#1b1610', d.named >= 3 ? '#d9f2df' : '#fffaf0', 260);
  };

  // =====================================================================================
  // УГЛЕВОДОРОДЫ
  // =====================================================================================

  // газовая горелка (Бунзена) с синим пламенем метана
  function burner(kit, h, g, x, z, o = {}) {
    const { T, at, box, cyl, C } = kit, v3 = h.v3;
    const b = new T.Group(); at(b, x, 0, z, g);
    at(cyl(4.2, 1.2, C.DARK, { seg: 24 }), 0, 0.6, 0, b);
    at(cyl(1.1, 12, C.BRASS), 0, 7.2, 0, b);
    at(cyl(1.45, 2, 0x8a94a6, { seg: 16 }), 0, 4, 0, b);
    h.rodAB(b, v3(0, 2, 0), v3(6, 2, 0), 0.6, C.BRASS);
    h.flame(b, 0, 13.2, 0, o.hgt ?? 9, 0x4a8cff, 0x9fd4ff, { glow: 0x6ab0ff, op: 0.6, light: 10 });
    return b;
  }

  // ===== 5. Алканы: модель цепи-зигзага, термометр-шкала, газ или жидкость, хлор под лампой, горелка =====
  SC['chhy-alk'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const ty = h.tray(g, 0, 4, 124, 82);
    // --- модель на стойках ---
    const MX = -6, MZ = -2, SM = 1.5, MY = 13;
    const turn = new T.Group(); at(turn, MX, ty, MZ, g);
    const mg = new T.Group(); at(mg, 0, MY, 0, turn); mg.scale.setScalar(SM); clickable(mg, 'cl');
    const ch = alkaneChain(kit, h, mg, d.n, { cl: d.sub, onCl: p => at(h.glow(0x7bd88f, 7, 0.6), p.x, p.y, p.z, mg) });
    // прозрачные стойки под нижними атомами C, деревянная планка
    const low = ch.P.map((p, i) => i).filter(i => d.n === 1 || ch.P[i].y < 0);
    const pick = low.length > 2 ? [low[1], low[low.length - 1 - (low.length > 3 ? 1 : 0)]] : [low[(low.length / 2) | 0]];
    const len = Math.max(14, (d.n - 1) * 4.3 * SM * 0.75);
    at(box(len, 1.2, 6, C.WOOD2), 0, 0.6, 0, turn);
    pick.forEach(i => { const p = ch.P[i], top = MY + (p.y - 1.9) * SM; at(cyl(0.45, top - 1.2, 0xdfe7ef, { edges: false, matOpt: { transparent: true, opacity: 0.75 } }), p.x * SM, 1.2 + (top - 1.2) / 2, 0, turn); });
    tag(v3(MX, ty + MY + 10, MZ), d.name, d.f, d.sub);
    if (!kit.reduce) kit.onFrame((dt, t) => { turn.rotation.y = 0.22 * Math.sin(t * 0.5); });
    // --- шкала температур: доска-термометр ---
    const TB = new T.Group(); at(TB, 44, ty, -14, g); TB.rotation.y = -0.45;
    at(box(14, 1.4, 6, C.WOOD2), 0, 0.7, 0, TB);
    at(box(13, 44, 1.2, 0xf6f1e6), 0, 23.4, 0, TB);
    const lo = -180, hi = 200, y = t => 3 + (t - lo) / (hi - lo) * 40;
    const k = h.canvasTex(300, 1000), x2 = k.x, cy = t => 1000 - (y(t) - 1.4) / 44 * 1000;
    x2.fillStyle = '#f6f1e6'; x2.fillRect(0, 0, 300, 1000);
    x2.fillStyle = '#d9d2c2'; x2.fillRect(118, 40, 26, 920);
    x2.font = '600 34px "IBM Plex Mono", monospace'; x2.textAlign = 'right'; x2.textBaseline = 'middle';
    for (let t = -160; t <= 200; t += 40) { x2.fillStyle = '#1b1610'; x2.fillRect(100, cy(t) - 2, 18, 4); x2.fillText((t > 0 ? '+' : t < 0 ? '−' : '') + Math.abs(t), 92, cy(t)); }
    // комнатная температура
    x2.fillStyle = '#2f9e55'; x2.fillRect(100, cy(20) - 4, 190, 8); x2.textAlign = 'left'; x2.font = '600 30px "Golos Text", sans-serif'; x2.fillText('20 °C', 196, cy(20) - 26);
    // уже просмотренные алканы
    x2.font = '600 26px "IBM Plex Mono", monospace';
    d.seen.forEach(([n, bp]) => { x2.fillStyle = '#8b96ad'; x2.beginPath(); x2.arc(131, cy(bp), 9, 0, Math.PI * 2); x2.fill(); x2.fillText('C' + n, 150, cy(bp)); });
    // столбик до t кип текущего
    x2.fillStyle = '#e0473a'; x2.fillRect(124, cy(d.bpv), 14, 960 - cy(d.bpv)); x2.beginPath(); x2.arc(131, 966, 24, 0, Math.PI * 2); x2.fill();
    x2.fillStyle = '#ff8a1f'; x2.beginPath(); x2.moveTo(150, cy(d.bpv)); x2.lineTo(178, cy(d.bpv) - 14); x2.lineTo(178, cy(d.bpv) + 14); x2.fill();
    x2.font = '700 30px "IBM Plex Mono", monospace'; x2.fillStyle = '#c4570f'; x2.fillText(d.bp, 184, cy(d.bpv) + (Math.abs(d.bpv - 20) < 25 ? 28 : 0));
    k.tex.needsUpdate = true;
    const face = new T.Mesh(kit.keep(new T.PlaneGeometry(12.4, 44)), kit.keep(new T.MeshBasicMaterial({ map: k.tex }))); at(face, 0, 23.4, 0.62, TB);
    tag(v3(44, ty + 47, -14), 't кип ' + d.alk, d.bp + ' °C');
    // --- образец: газ в колбе-шаре или жидкость во флаконе ---
    const sx = 30, sz = 22;
    if (d.gas) {
      const f = h.glassy(new T.SphereGeometry(6, 28, 18), 0xd8eef8, 0.22); at(f, sx, ty + 6, sz, g);
      at(h.glassy(new T.CylinderGeometry(1.4, 1.4, 4, 16, 1, true)), sx, ty + 13, sz, g);
      at(cyl(1.7, 2.2, 0xe0473a), sx, ty + 15.6, sz, g);
      at(cyl(5, 0.8, 0x3b4a66), sx, ty + 0.4, sz, g);
      const mols = []; for (let i = 0; i < 14; i++) { const m = h.ball(0.55, CC, { hull: false, seg: 8, seg2: 6 }); at(m, sx, ty + 6, sz, g); mols.push(m); }
      kit.onFrame((dt, t) => mols.forEach((m, i) => { const a = t * (0.9 + rnd(i) * 0.8) + i * 2.1, r = 3.8; m.position.set(sx + Math.sin(a * 1.3 + i) * r * rnd(i + 2), ty + 6 + Math.cos(a * 0.9 + i * 3) * r * 0.8, sz + Math.sin(a * 0.7 + i * 5) * r * rnd(i + 7)); }));
    } else {
      const f = new T.Group(); at(f, sx, ty, sz, g);
      at(h.glassy(new T.CylinderGeometry(3.6, 3.6, 12, 28, 1, true)), 0, 6, 0, f);
      at(cyl(3.6, 0.5, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.5 } }), 0, 0.25, 0, f);
      h.liquid(f, 0, 0.5, 0, 3.3, 0xf3ecc4, 0.62).set(7);
      at(cyl(3.9, 2.4, 0x2c3240), 0, 13.2, 0, f);
    }
    h.floorSticker(g, sx, ty, sz + 9.5, 15, 4.4, d.gas ? 'газ при 20 °C' : 'жидкость при 20 °C', '#1b1610', d.gas ? '#e4f1ff' : '#fff1c4', 260);
    tag(v3(sx, ty + 19, sz), 'При 20 °C', d.gas ? 'газ' : 'жидкость');
    // --- хлорирование на свету: банка с Cl₂ под настольной лампой ---
    const jx = -44, jz = 30, jg = new T.Group(); at(jg, jx, ty, jz, g); clickable(jg, 'cl');
    at(h.glassy(new T.CylinderGeometry(5, 5, 14, 32, 1, true), 0xd8eef8, 0.2), 0, 7, 0, jg);
    at(cyl(5.4, 1, 0xd8eef8, { edges: false, matOpt: { transparent: true, opacity: 0.5 } }), 0, 14.5, 0, jg);
    const gas = cyl(4.7, 13, d.sub ? 0xe6f2c8 : 0xc8e04a, { edges: false, hull: false, matOpt: { transparent: true, opacity: d.sub ? 0.18 : 0.42, depthWrite: false } }); at(gas, 0, 7, 0, jg);
    const js = h.sticker(7, 3, d.sub ? 'HCl + ' + 'RCl' : 'Cl₂'); at(js, 0, 5, 5.06, jg);
    // лампа
    at(cyl(3.6, 1, C.DARK), -9, 0.5, -4, jg);
    h.rodAB(jg, v3(-9, 1, -4), v3(-9, 20, -4), 0.5, C.STEEL); h.rodAB(jg, v3(-9, 20, -4), v3(-2, 22, -1), 0.5, C.STEEL);
    const shade = cyl(1.6, 4.2, 0x2f6fd8, { r2: 0.9 }); shade.rotation.z = Math.PI; at(shade, -1, 20.6, -0.5, jg);
    if (d.sub) { at(h.glow(0xfff2b0, 22, 0.75), -1, 17.6, -0.5, jg); at(new T.PointLight(0xfff0c0, 40, 60, 1.2), -1, 17, 0, jg); }
    at(h.ball(1.3, d.sub ? 0xfff6c8 : 0xcfd5de, { matOpt: d.sub ? { emissive: 0xffe680, emissiveIntensity: 0.9 } : undefined }), -1, 18.6, -0.5, jg);
    tag(v3(jx - 2, ty + 26, jz), d.sub ? 'Cl₂ + свет' : 'Хлор, лампа выключена', d.sub ? 'замещение: + HCl' : 'нажмите — включить свет', d.sub);
    // --- горелка: метан из газовой сети горит синим пламенем ---
    burner(kit, h, g, -50, -30);
    h.floorSticker(g, -38, ty, -24, 18, 4.4, 'CH₄ горит синим', '#1b1610', '#e4f1ff', 260);
    // --- бромная вода с алканом: окраска остаётся ---
    const bt = h.testTube(g, 50, ty + 2, 22, 2.2, 16); h.tubeLiquid(bt.g, 2.2, 11, 0xf08a24, 0.85);
    at(box(7, 2, 5, C.WOOD2), 50, ty + 1, 22, g);
    h.floorSticker(g, 50, ty, 31, 17, 4.4, 'Br₂-вода: без изменений', '#1b1610', '#fff1e0', 300);
    // --- кнопки «−» «+» ---
    h.key(g, -16, 39, 9, 7, '−', false, 'nm');
    h.floorSticker(g, -4, ty, 39, 13, 5.4, d.alk, '#1b1610', '#fffaf0', 220);
    h.key(g, 8, 39, 9, 7, '+', false, 'np');
  };

  // стальной баллон с вентилем
  function gasCylinder(kit, h, g, x, z, o) {
    const { T, at, box, cyl, C } = kit, v3 = h.v3;
    const c = new T.Group(); at(c, x, 0, z, g);
    at(cyl(4.6, 26, o.col ?? 0x6d7a90, { seg: 28 }), 0, 13.6, 0, c);
    const dome = h.ball(4.6, o.col ?? 0x6d7a90, { seg: 28, seg2: 10 }); dome.scale.y = 0.55; at(dome, 0, 26.6, 0, c);
    at(cyl(4.9, 1, C.DARK, { seg: 28 }), 0, 0.5, 0, c);
    at(cyl(1.1, 3, C.BRASS), 0, 30, 0, c);
    at(box(3.2, 1.6, 1.6, C.BRASS), 0, 31.6, 0, c);
    const wheel = kit.mesh(new T.TorusGeometry(1.4, 0.3, 6, 18), 0x2c3240, { edges: false }); wheel.rotation.x = Math.PI / 2; at(wheel, 0, 33.4, 0, c);
    at(cyl(0.35, 1.6, C.STEEL), 0, 32.6, 0, c);
    return { g: c, out: v3(x + 1.6, 31.6, z) };
  }

  // ===== 6. Алкены и алкины: баллоны A, B, C, бромная вода и KMnO₄, модели газов на табличках =====
  SC['chhy-br'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const ty = h.tray(g, 4, 6, 120, 80);
    const L0 = ['A', 'B', 'C'], CX = [-44, -30, -16], CZ = -22;
    let out = null;
    L0.forEach((c, i) => {
      const sel = d.sel === c, cy = gasCylinder(kit, h, g, CX[i], CZ, {});
      clickable(cy.g, 'cyl' + c);
      if (sel) { h.halo(g, CX[i], ty + 0.5, CZ, 18); out = cy.out; }
      const pl = h.sticker(5, 5, c, sel ? '#c4570f' : '#1b1610', sel ? '#fff1c4' : '#ffffff', 120); at(pl, CX[i], 18, CZ + 4.62, g);
      const lab = d.lab[i] ? d.lab[i] : d.res[i] !== null ? 'опыт сделан' : 'без этикетки';
      const tagS = h.sticker(9, 3.2, lab, '#1b1610', d.lab[i] ? '#d9f2df' : '#f4f6f9', 220, d.lab[i] ? '#2f9e55' : '#9aa3b2'); at(tagS, CX[i], 9, CZ + 4.66, g);
    });
    // --- штатив с пробиркой бромной воды и пробиркой KMnO₄ (газ идёт через обе); участок в увеличенном масштабе ---
    const SR = 1.4, RXw = 2, RZw = -4, R = new T.Group(); at(R, RXw, ty * (1 - SR), RZw, g); R.scale.setScalar(SR);
    const W = (x, y, z) => v3(RXw + x * SR, ty * (1 - SR) + y * SR, RZw + z * SR);
    const TX = 0, TZ = 0, TR = 2.7, THH = 22, TY0 = ty + 3;
    h.stand(R, TX - 11, TZ - 5, 28, [{ y: TY0 + 16, to: { x: TX, z: TZ } }, { y: TY0 + 16, to: { x: TX + 11, z: TZ } }], ty);
    const t1 = h.testTube(R, TX, TY0, TZ, TR, THH), t2 = h.testTube(R, TX + 11, TY0, TZ, TR, THH);
    at(box(20, 3, 7, C.WOOD2), TX + 5.5, ty + 1.5, TZ, R);
    clickable(t1.g, 'bub');
    const brM = h.ownMat(0xf08a24, { transparent: true, opacity: 0.85, depthWrite: false }), mnM = h.ownMat(0x8a2be2, { transparent: true, opacity: 0.85, depthWrite: false });
    const fillT = (tb, mat, lv) => { const rr = TR * 0.88; at(new T.Mesh(kit.keep(new T.SphereGeometry(rr, 24, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), mat), 0, TR, 0, tb.g); at(new T.Mesh(kit.keep(new T.CylinderGeometry(rr, rr, lv - TR, 24)), mat), 0, TR + (lv - TR) / 2, 0, tb.g); };
    fillT(t1, brM, 12); fillT(t2, mnM, 12);
    // пробки и трубки
    [TX, TX + 11].forEach(x => at(cyl(TR + 0.2, 2.4, 0x3a2a24, { r2: TR - 0.3 }), x, TY0 + THH + 0.6, TZ, R));
    h.rodAB(R, v3(TX, TY0 + THH + 4, TZ), v3(TX, TY0 + 1.6, TZ), 0.35, 0xeef6fb, { matOpt: { transparent: true, opacity: 0.6 } });
    const bend = [v3(TX + 1.2, TY0 + THH - 1, TZ), v3(TX + 1.2, TY0 + THH + 5, TZ), v3(TX + 11, TY0 + THH + 5, TZ), v3(TX + 11, TY0 + 1.6, TZ)];
    for (let k = 0; k < 3; k++) h.rodAB(R, bend[k], bend[k + 1], 0.35, 0xeef6fb, { matOpt: { transparent: true, opacity: 0.6 } });
    const s1 = h.sticker(4.4, 2.2, 'Br₂'), s2 = h.sticker(5.4, 2.2, 'KMnO₄'); at(s1, TX, TY0 + 15, TZ + TR + 0.08, R); at(s2, TX + 11, TY0 + 15, TZ + TR + 0.08, R);
    // шланг от выбранного баллона
    if (out) {
      const top = W(TX, TY0 + THH + 4, TZ), top2 = W(TX, TY0 + THH + 8, TZ);
      const curve = new T.CatmullRomCurve3([out, out.clone().add(v3(3, 5, 2)), v3((out.x + top.x) / 2, top.y + 10, (out.z + top.z) / 2), top2, top], false, 'centripetal');
      at(mesh(new T.TubeGeometry(curve, 60, 0.7, 8), 0xb0412e, { hull: true, edges: false }), 0, 0, 0, g);
    }
    const bub1 = h.bubbles(t1.g, 0, 0.6, 0, 1.6, 10), bub2 = h.bubbles(t2.g, 0, 0.6, 0, 1.6, 8);
    const brC = new T.Color(0xf08a24), mnC = new T.Color(0x8a2be2), clear = new T.Color(0xe9f1f4), mnEnd = new T.Color(0xc8a07a);
    const pct = Math.round(d.frac * 100);
    tag(W(TX - 3, TY0 + THH + 10, TZ), 'Бромная вода', d.vol ? `газ ${d.vol} мл · Br₂ ушло ${pct} %` : 'газа ещё не было', d.frac > 0);
    tag(W(TX + 13, TY0 + THH + 2, TZ + 3), 'KMnO₄', !d.vol ? 'фиолетовый' : d.frac > 0 ? 'обесцвечивается' : 'без изменений', d.frac > 0);
    kit.onFrame(() => {
      const L = live() || {}, s = d.vol ? (L.shown ?? d.frac) : 0;
      brM.color.copy(brC).lerp(clear, clamp(s, 0, 1)); brM.opacity = 0.85 - 0.5 * s;
      mnM.color.copy(mnC).lerp(mnEnd, clamp(s * 1.2, 0, 1)); mnM.opacity = 0.85 - 0.5 * clamp(s * 1.2, 0, 1);
      bub1.set(L.bub ? 1 : 0, 11.4, 0.45, 0.9); bub2.set(L.bub ? 1 : 0, 11.4, 0.4, 0.9);
    });
    // --- штатив-подставка со свежими пробирками бромной воды ---
    const rk = new T.Group(); at(rk, 42, ty, -18, g); clickable(rk, 'tube');
    at(box(18, 1.2, 7, C.WOOD2), 0, 0.6, 0, rk); at(box(18, 1, 7, C.WOOD2), 0, 9, 0, rk);
    [-6, 6].forEach(x => at(box(1, 9, 1, C.WOOD2), x * 1.4, 4.6, 0, rk));
    for (let k = 0; k < 3; k++) { const tb = h.testTube(rk, -5 + k * 5, 1.2, 0, 1.8, 14); h.tubeLiquid(tb.g, 1.8, 8, 0xf08a24, 0.85); }
    h.floorSticker(g, 42, ty, -11, 18, 4, 'новая пробирка', '#1b1610', '#fff1e0', 260);
    // --- кнопка подачи газа ---
    h.key(g, 40, 14, 18, 8, 'Пропустить 10 мл', false, 'bub', 0xc4570f);
    // --- таблички-этикетки с моделями газов ---
    d.gases.forEach((G, i) => {
      const x = -42 + i * 24, z = 40, on = d.cur === G.k;
      h.key(g, x, z, 21, 7, G.name + ' ' + G.f, on, 'lab-' + G.k, on ? OKC : undefined);
      const mg = new T.Group(); at(mg, x, ty + 9.5, z - 10, g); mg.scale.setScalar(0.95);
      // C–C вдоль x, водороды по геометрии sp³ (этан), sp² (этилен, 120°), sp (ацетилен, 180°)
      const hl = G.o === 1 ? 2.6 : G.o === 2 ? 2.25 : 2.0, cA = v3(-hl, 0, 0), cB = v3(hl, 0, 0);
      at(h.ball(1.9, CC), cA.x, 0, 0, mg); at(h.ball(1.9, CC), cB.x, 0, 0, mg);
      bondRods(kit, h, mg, cA, cB, G.o, v3(0, 0, 1));
      [[cA, 1], [cB, -1]].forEach(([p0, s]) => {
        const toN = v3(s, 0, 0);
        const dirs = G.o === 1 ? tetraFill(T, [toN], v3(0, 1, 0)) : G.o === 2 ? [v3(-s * 0.5, 0.866, 0), v3(-s * 0.5, -0.866, 0)] : [v3(-s, 0, 0)];
        dirs.forEach(dv => { const hp = p0.clone().addScaledVector(dv, 3.1); h.rodAB(mg, p0, hp, 0.36, STICK); at(h.ball(1.05, HC), hp.x, hp.y, hp.z, mg); });
      });
      at(cyl(0.35, 7, 0xdfe7ef, { edges: false }), x, ty + 3.5, z - 10, g); at(cyl(2.8, 0.8, C.WOOD2), x, ty + 0.4, z - 10, g);
      if (!kit.reduce) kit.onFrame((dt, t) => { mg.rotation.y = 0.5 + 0.3 * Math.sin(t * 0.6 + i); });
    });
    if (d.right !== null) h.floorSticker(g, 40, ty, 28, 22, 4.4, `верно подписано: ${d.right} из 3`, '#1b1610', d.right === 3 ? '#d9f2df' : '#fff1e0', 280);
  };

  // ===== 7. Бензол: большая модель кольца, штангенциркуль, π-облако, реактивы, коптящее пламя под тягой =====
  SC['chhy-benz'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const ty = h.tray(g, 2, 6, 120, 80);
    const BX = -8, BZ = 2, BY = ty + 15, R = 14;
    h.modelStand(g, BX, BZ, BY - 4, 7);
    const rg = new T.Group(); at(rg, BX, BY, BZ, g);
    const ang = i => -Math.PI / 2 + i * Math.PI / 3 + Math.PI / 6;
    const Pc = [], Ph = [];
    for (let i = 0; i < 6; i++) { Pc.push(v3(R * Math.cos(ang(i)), 0, R * Math.sin(ang(i)))); Ph.push(v3((R + 5) * Math.cos(ang(i)), 0, (R + 5) * Math.sin(ang(i)))); }
    Pc.forEach((p, i) => {
      at(h.ball(2.8, CC), p.x, 0, p.z, rg);
      const br = i === 0 && d.react === 'fe', hp = br ? v3((R + 6.4) * Math.cos(ang(i)), 0, (R + 6.4) * Math.sin(ang(i))) : Ph[i];
      h.rodAB(rg, p, hp, 0.5, STICK); at(h.ball(br ? 2.6 : 1.6, br ? BRC : HC), hp.x, 0, hp.z, rg);
      if (br) at(h.glow(0xff7a50, 10, 0.5), hp.x, 0, hp.z, rg);
    });
    const meas = new Set(d.meas);
    for (let i = 0; i < 6; i++) {
      const a = Pc[i], b = Pc[(i + 1) % 6], ord = d.view === 'kek' && i % 2 === 0 ? 2 : 1, hot = i === d.last;
      bondRods(kit, h, rg, a, b, ord, v3(0, 1, 0), { s: 1.4, col: hot ? HOT : meas.has(i) ? 0x86e0a8 : STICK });
      const bg = new T.Group(); rg.add(bg); clickable(bg, 'b' + i);
      const hb = h.hitbox(new T.CylinderGeometry(3, 3, R - 6, 8)); hb.quaternion.setFromUnitVectors(v3(0, 1, 0), b.clone().sub(a).normalize()); at(hb, (a.x + b.x) / 2, 0, (a.z + b.z) / 2, bg);
      if (meas.has(i)) { const m = a.clone().add(b).multiplyScalar(0.5), cl = kit.mesh(new T.TorusGeometry(1.6, 0.4, 6, 18), hot ? HOT : OKC, { edges: false }); cl.quaternion.setFromUnitVectors(v3(0, 0, 1), b.clone().sub(a).normalize()); at(cl, m.x, 0, m.z, rg); }
    }
    // π-облако: два прозрачных кольца над и под плоскостью
    if (d.view === 'ring') [1, -1].forEach(s => {
      const tr = mesh(new T.TorusGeometry(R, 3, 14, 48), 0x5cc0e8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.32, depthWrite: false } });
      tr.rotation.x = Math.PI / 2; at(tr, 0, s * 3.4, 0, rg);
    });
    tag(v3(BX, BY + 10, BZ - R - 8), 'Бензол C₆H₆', d.view === 'kek' ? 'модель Кекуле' : 'общее π-облако');
    // штангенциркуль на последней измеренной связи
    if (d.last >= 0) {
      const a = Pc[d.last], b = Pc[(d.last + 1) % 6], m = a.clone().add(b).multiplyScalar(0.5), dir = b.clone().sub(a).normalize();
      const cg = new T.Group(); at(cg, BX + m.x, BY + 8, BZ + m.z, g); cg.rotation.y = -Math.atan2(dir.z, dir.x);
      at(box(R + 9, 0.8, 2.2, C.STEEL), 0, 0, 0, cg);
      [-R / 2, R / 2].forEach(x => at(box(0.8, 6.4, 1.8, C.STEEL), x, -3.2, 0, cg));
      at(box(9, 4.2, 1.2, 0x2c3240), 3, 2.4, 0.4, cg);
      const sc = h.screen(8, 3.2, '0,139 нм', '#86e0a8', 240, 100); at(sc, 3, 2.4, 1.05, cg);
      const sc2 = h.screen(8, 3.2, '0,139 нм', '#86e0a8', 240, 100); sc2.rotation.y = Math.PI; at(sc2, 3, 2.4, -0.25, cg);
      tag(v3(BX + m.x * 1.3, BY + 14, BZ + m.z * 1.3), `Связь ${d.last + 1}–${(d.last + 1) % 6 + 1}`, '0,139 нм' + (d.view === 'kek' ? ` · Кекуле: ${d.last % 2 === 0 ? '0,134' : '0,154'}` : ''), true);
    }
    h.floorSticker(g, -40, ty, 24, 30, 11, 'C–C   0,154 нм\nC=C   0,134 нм\nбензол 0,139 нм', '#1b1610', '#fffaf0', 360);
    h.floorSticker(g, 22, ty, 30, 18, 4.4, `измерено ${d.meas.length} из 6`, '#1b1610', d.meas.length >= 3 ? '#d9f2df' : '#fffaf0', 260);
    // переключатели модели и сброс
    h.key(g, -40, 39, 17, 7, 'Кекуле', d.view === 'kek', 'kek');
    h.key(g, -20, 39, 17, 7, 'π-облако', d.view === 'ring', 'ring');
    h.key(g, 0, 39, 15, 7, 'Сброс', false, 'reset');
    // реактивы: бромная вода и бром с железом
    const bw = h.bottle(g, 18, ty, -6, { r: 3.6, h: 10, liq: 0xf08a24, lop: 0.8, label: 'Br₂ (вода)', cap: 0x7a3b22 }); clickable(bw.g, 'water');
    const bf = h.bottle(g, 30, ty, -6, { r: 3.6, h: 10, glass: 0x9a6a3a, op: 0.55, liq: 0x8e2a1c, lop: 0.9, label: 'Br₂ + FeBr₃', cap: 0x2c3240 }); clickable(bf.g, 'fe');
    const dish = cyl(4, 1, 0xf7f3ea); at(dish, 48, ty + 0.5, 0, g);
    for (let k = 0; k < 14; k++) at(box(0.5, 0.3, 0.5, 0x4a4a4a, { edges: false }), 48 + (rnd(k) - 0.5) * 5, ty + 1.15, 0 + (rnd(k + 3) - 0.5) * 5, g);
    h.floorSticker(g, 48, ty, 6.4, 10, 3, 'Fe', '#1b1610', '#fffaf0', 140);
    if (d.react === 'water') h.halo(bw.g, 0, 1, 0, 16); if (d.react === 'fe') h.halo(bf.g, 0, 1, 0, 16);
    // результат: пробирка с бензолом
    const RX = 34, RZ = 14, rt = h.testTube(g, RX, ty + 2, RZ, 2.6, 18);
    at(box(7, 2, 6, C.WOOD2), RX, ty + 1, RZ, g);
    if (d.react === 'water') { h.tubeLiquid(rt.g, 2.6, 7, 0xf08a24, 0.85); const up = h.tubeLiquid(rt.g, 2.6, 12, 0xf3d29a, 0.5, 7); }
    else if (d.react === 'fe') { h.tubeLiquid(rt.g, 2.6, 10, 0xc89a6a, 0.6); h.puffs(g, RX, ty + 21, RZ, { n: 6, spread: 3, rise: 9, size: 3.2, op: 0.55, color: 0xf2f4f6 }); }
    else h.tubeLiquid(rt.g, 2.6, 6, 0xeef3f6, 0.35);
    tag(v3(RX, ty + 24, RZ), d.react === 'water' ? '+ бромная вода' : d.react === 'fe' ? '+ Br₂, FeBr₃' : 'Бензол в пробирке',
      d.react === 'water' ? 'окраска не исчезла' : d.react === 'fe' ? 'C₆H₅Br + HBr↑' : 'выберите реактив', d.react === 'fe');
    // вытяжной шкаф: бензол горит коптящим пламенем
    const hd = new T.Group(); at(hd, 40, ty, -27, g);
    at(box(24, 1, 16, 0xdfe5ec), 0, 0.5, 0, hd); at(box(24, 22, 1, 0xc9d1da), 0, 11, -7.5, hd); at(box(24, 1.2, 16, 0xc9d1da), 0, 22.6, 0, hd);
    [-11.6, 11.6].forEach(x => at(box(0.8, 22, 16, 0xc9d1da), x, 11, 0, hd));
    at(h.glassy(new T.PlaneGeometry(22.4, 9), 0xd8eef8, 0.2), 0, 17, 7.6, hd);
    at(cyl(3.2, 1.4, 0xf7f5ee, { r2: 2.2 }), 0, 1.7, 0, hd);
    h.flame(hd, 0, 2.4, 0, 9, 0xffa020, 0xfff1a8, { glow: 0xffa040, op: 0.85, light: 8 });
    h.puffs(hd, 0, 11, 0, { n: 7, spread: 4, rise: 9, size: 3.4, op: 0.75, color: 0x1e1e22, speed: 0.4 });
    h.floorSticker(g, 40, ty, -15.6, 22, 4.4, 'бензол: коптящее пламя', '#1b1610', '#fff1e0', 300);
  };

  // ===== 8. Нефть и газ: качалка (Тенгиз), платформа (Кашаган), печь и ректификационная колонна, колбы фракций, крекинг =====
  SC['chhy-oil'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    // --- месторождение: песчаный участок с качалкой ---
    const FX = -46, FZ = -28;
    at(box(28, 2, 20, 0xd9b77a), FX, 1, FZ, g);
    const pj = new T.Group(); at(pj, FX, 2, FZ, g);
    at(box(14, 1, 4, C.DARK), 0, 0.5, 0, pj);
    h.rodAB(pj, v3(-2, 1, -1.6), v3(0, 11, 0), 0.5, 0x3b4a66); h.rodAB(pj, v3(-2, 1, 1.6), v3(0, 11, 0), 0.5, 0x3b4a66); h.rodAB(pj, v3(3, 1, 0), v3(0, 11, 0), 0.5, 0x3b4a66);
    const beam = new T.Group(); at(beam, 0, 11.4, 0, pj);
    at(box(16, 1.2, 1.4, 0xe0b23a), 1, 0, 0, beam);
    const head = box(1.6, 4.6, 2, 0xe0b23a); at(head, -7.6, -1.4, 0, beam);
    at(box(3, 2.4, 2.2, C.DARK), 6.5, -1.4, 0, beam);
    const rodP = cyl(0.25, 8, C.STEEL, { edges: false }); at(rodP, -8.4, 6.3, 0, pj);
    at(cyl(0.9, 2.4, C.STEEL), -8.4, 2.2, 0, pj); at(box(3, 1, 3, 0x2c3240), -8.4, 1.4, 0, pj);
    if (!kit.reduce) kit.onFrame((dt, t) => { const a = 0.22 * Math.sin(t * 1.6); beam.rotation.z = a; rodP.position.y = 6.3 + Math.sin(a) * -8; });
    const sign = (x, z, txt, bg) => { const sg = new T.Group(); at(sg, x, 0, z, g); at(cyl(0.3, 8, C.WOOD2), 0, 4, 0, sg); const s = h.sticker(11, 3.6, txt, '#1b1610', bg, 240); at(s, 0, 8, 0.4, sg); return sg; };
    sign(FX + 9, FZ + 7, 'Тенгиз', '#fff1c4');
    // Кашаган: морская платформа на «воде»
    const KX = -46, KZ = -6;
    at(box(24, 1.2, 14, 0x3d8fd0, { matOpt: { transparent: true, opacity: 0.85 } }), KX, 0.6, KZ, g);
    for (const [fx, fz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) at(cyl(0.45, 6, C.STEEL, { edges: false }), KX + fx, 3, KZ + fz, g);
    at(box(9, 1, 9, 0x8a94a6), KX, 6.4, KZ, g);
    h.rodAB(g, v3(KX - 2, 6.9, KZ - 2), v3(KX, 14, KZ), 0.25, 0xe0473a); h.rodAB(g, v3(KX + 2, 6.9, KZ - 2), v3(KX, 14, KZ), 0.25, 0xe0473a); h.rodAB(g, v3(KX, 6.9, KZ + 2), v3(KX, 14, KZ), 0.25, 0xe0473a);
    sign(KX + 9, KZ + 5, 'Кашаган', '#e4f1ff');
    // нефтепровод к печи
    const CX = -14, CZ = -18;
    [[v3(FX - 8.4, 2.4, FZ), v3(FX - 8.4, 2.4, FZ + 12)], [v3(FX - 8.4, 2.4, FZ + 12), v3(CX - 9, 2.4, FZ + 12)], [v3(CX - 9, 2.4, FZ + 12), v3(CX - 9, 2.4, CZ)]].forEach(([a, b]) => h.rodAB(g, a, b, 0.7, 0x2c3240));
    // --- печь и колонна ---
    at(box(14, 8, 14, 0xa4553a), CX, 4, CZ, g);
    for (let k = 0; k < 3; k++) at(box(14.2, 0.3, 14.2, 0xe8d7c8, { edges: false }), CX, 2 + k * 2.4, CZ, g);
    const mouth = box(5, 3, 0.4, 0x1b1610); at(mouth, CX, 3, CZ + 7.1, g);
    h.flame(g, CX, 1.6, CZ + 7.6, 3.6, 0xff7a20, 0xfff1a8, { glow: 0xff9a40, op: 0.9, light: 8 });
    const CB = 8, CH = 36, CR = 6;
    at(cyl(CR, CH, 0xb7c0cc, { seg: 32 }), CX, CB + CH / 2, CZ, g);
    const capD = h.ball(CR, 0xb7c0cc, { seg: 32, seg2: 10 }); capD.scale.y = 0.5; at(capD, CX, CB + CH, CZ, g);
    // полоса температуры по высоте: внизу горячо, наверху холодно
    const gk = h.canvasTex(16, 256), gr = gk.x.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#5aa8e8'); gr.addColorStop(0.5, '#f2c14a'); gr.addColorStop(1, '#d8432a'); gk.x.fillStyle = gr; gk.x.fillRect(0, 0, 16, 256); gk.tex.needsUpdate = true;
    const band = new T.Mesh(kit.keep(new T.CylinderGeometry(CR + 0.08, CR + 0.08, CH - 4, 32, 1, true, -0.9, 1.0)), kit.keep(new T.MeshBasicMaterial({ map: gk.tex }))); at(band, CX, CB + CH / 2, CZ, g);
    const ZY = [CB + 31, CB + 24, CB + 17, CB + 10, CB + 4];
    ZY.forEach(y => { const r = mesh(new T.TorusGeometry(CR + 0.15, 0.3, 6, 32), 0x6f8098, { edges: false }); r.rotation.x = Math.PI / 2; at(r, CX, y - 3, CZ, g); });
    // ползунок температуры пара: кольцо на колонне, кипящие фракции подсвечены
    const yT = clamp(CB + CH - 3 - (d.T - 20) / 360 * (CH - 6), CB + 2, CB + CH - 1);
    const ring = mesh(new T.TorusGeometry(CR + 0.9, 0.55, 8, 32), HOT, { edges: false }); ring.rotation.x = Math.PI / 2; at(ring, CX, yT, CZ, g);
    tag(v3(CX, CB + CH + 6, CZ), 'Колонна', `пар ${d.T} °C · внизу ~380 °C`);
    // --- колбы фракций ---
    const FC = [null, 0xf6efc0, 0xf2d26a, 0xd59a2e, 0x2a1a10];
    const fx = i => -2 + i * 13, fz = 6, FS = 1.3;
    d.zones.forEach((z, i) => {
      const x = fx(i), y = ZY[i], boil = d.T > z.lo, fg = new T.Group(); at(fg, x, 0, fz, g); fg.scale.setScalar(FS); clickable(fg, 'z' + i);
      let top = 13;
      if (i === 0) {
        // газ — в резиновый мешок-газгольдер
        at(cyl(3.4, 1, 0x3b4a66), 0, 0.5, 0, fg);
        const bag = h.ball(4.4, 0xc8503a, { seg: 20, seg2: 14 }); bag.scale.set(1, 1.25, 0.9); at(bag, 0, 6.6, 0, fg);
        at(cyl(0.9, 2.4, 0x2c3240), 0, 12.4, 0, fg); top = 13.6;
      } else {
        const fl = new T.Group(); fg.add(fl);
        const pts = [v3(0.01, 0, 0), v3(4.4, 0, 0), v3(5, 0.8, 0), v3(1.5, 8.6, 0), v3(1.5, 12, 0)].map(p => new T.Vector2(p.x, p.y));
        at(h.glassy(new T.LatheGeometry(pts, 32), 0xd8eef8, 0.24), 0, 0, 0, fl);
        const lq = new T.Mesh(kit.keep(new T.CylinderGeometry(3.1, 4.6, 4.6, 32)), h.ownMat(FC[i], { transparent: true, opacity: i === 4 ? 0.95 : 0.7, depthWrite: false })); at(lq, 0, 2.6, 0, fl);
        top = 12;
      }
      // отвод от колонны: вбок, вперёд и вниз в колбу
      const pcol = boil ? 0xd8a04a : 0x8a94a6;
      const p0 = v3(CX + CR, y, CZ), p1 = v3(x, y, CZ), p2 = v3(x, y, fz), p3 = v3(x, (top + 0.6) * FS, fz);
      h.rodAB(g, p0, p1, 0.55, pcol); h.rodAB(g, p1, p2, 0.55, pcol); h.rodAB(g, p2, p3, 0.55, pcol);
      at(h.ball(0.75, pcol, { hull: false }), p1.x, p1.y, p1.z, g); at(h.ball(0.75, pcol, { hull: false }), p2.x, p2.y, p2.z, g);
      if (boil) at(h.glow(0xffe08a, 9, 0.6), CX + CR + 1, y, CZ + 1, g);
      const here = d.placed.map((p, k) => p === i ? d.samples[k] : null).filter(Boolean);
      const lines = [z.n, z.t, z.c]; if (here.length) lines.push('✓ ' + here.join(', '));
      h.floorSticker(g, x, 0, fz + 12.4, 12.6, here.length ? 10 : 7.6, lines.join('\n'), '#1b1610', here.length ? '#d9f2df' : '#fffaf0', 260);
      here.forEach((s, j) => { const vx = x - 3 + j * 3.2, vz = fz + 19.6; at(h.glassy(new T.CylinderGeometry(0.9, 0.9, 3.6, 12, 1, true)), vx, 1.8, vz, g); at(cyl(0.8, 2.2, FC[i] ?? 0xe6eef6, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.8 } }), vx, 1.1, vz, g); at(cyl(1, 0.8, 0x2c3240), vx, 3.9, vz, g); });
    });
    // --- текущий образец ---
    if (d.s) {
      const sx = -44, sz = 24, sg = new T.Group(); at(sg, sx, 0, sz, g);
      at(cyl(4, 1, C.WOOD2), 0, 0.5, 0, sg);
      at(h.glassy(new T.CylinderGeometry(2.2, 2.2, 9, 20, 1, true)), 0, 5.5, 0, sg);
      at(cyl(2, 5, 0xf3ecc4, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.7 } }), 0, 3.5, 0, sg);
      at(cyl(2.4, 2, 0x2c3240), 0, 11, 0, sg);
      const lb = h.sticker(4.2, 3.4, d.s.f); at(lb, 0, 6, 2.26, sg);
      h.floorSticker(g, sx, 0, sz + 8, 22, 6, `${d.s.name}\nt кип ${d.s.bp} °C`, '#1b1610', '#fff1c4', 300);
      tag(v3(sx, 15, sz), 'Образец ' + d.s.f, `t кип ${d.s.bp} °C · ${d.n} из ${d.samples.length}`);
    } else tag(v3(-44, 8, 24), 'Образцы', `все ${d.samples.length} на местах`, true);
    // --- установка крекинга: трубчатый реактор с катализатором и модель молекулы ---
    const RX = -12, RZ = 35, rk = new T.Group(); at(rk, RX, 0, RZ, g); clickable(rk, 'crack');
    at(box(40, 3, 7, 0x3b4a66), 0, 1.5, -2, rk);
    const tube = h.glassy(new T.CylinderGeometry(2.2, 2.2, 36, 24, 1, true)); tube.rotation.z = Math.PI / 2; at(tube, 0, 6, -2, rk);
    for (let k = 0; k < 16; k++) at(h.ball(0.6, 0x9aa3b2, { hull: false, seg: 6, seg2: 4 }), -16 + k * 2.1, 5 + rnd(k) * 0.8, -2 + (rnd(k + 2) - 0.5) * 2, rk);
    if (d.cracked) { const lamp = cyl(0.8, 0.5, 0xff4a3a, { matOpt: { emissive: 0xff4a3a, emissiveIntensity: 1 } }); at(lamp, -17, 3.2, 1.6, rk); at(h.glow(0xff7a3a, 30, 0.35), 0, 6, -2, rk); }
    at(box(42, 0.8, 6, 0xf1f3f5), 2, 0.4, 7, rk);
    const chainG = new T.Group(); at(chainG, 2, 2.4, 7, rk);
    const N = 16, dx = 2.2;
    for (let k = 0; k < N; k++) {
      const part = d.cracked ? (k < 8 ? -1 : 1) : 0, x = (k - (N - 1) / 2) * dx + part * 2.6, y = k % 2 ? 0.7 : -0.7;
      at(h.ball(0.95, CC, { seg: 10, seg2: 8 }), x, y, 0, chainG);
      if (k && !(d.cracked && k === 8)) {
        const xp = (k - 1 - (N - 1) / 2) * dx + (d.cracked ? (k - 1 < 8 ? -1 : 1) : 0) * 2.6, yp = (k - 1) % 2 ? 0.7 : -0.7;
        bondRods(kit, h, chainG, v3(xp, yp, 0), v3(x, y, 0), d.cracked && k === 9 ? 2 : 1, v3(0, 0, 1), { s: 0.5 });
      }
    }
    tag(v3(RX, 11, RZ - 2), 'Крекинг C₁₆H₃₄', d.cracked ? '→ C₈H₁₈ + C₈H₁₆' : 'нажмите на реактор', d.cracked);
    h.key(g, 48, 44, 16, 7, 'Сначала', false, 'reset');
  };
})();
