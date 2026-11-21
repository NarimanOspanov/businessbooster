// «Как в жизни» для темы «Генетическая связь веществ» (labs/chem-genchain): цепочки на лабораторном подносе —
// 1) вещества рядов кальция и серы в настоящей посуде, склянки-реактивы и карточки над стрелками;
// 2) шаростержневые модели органических молекул на подставках (метан → метилформиат, этилен → этилацетат);
// 3) макет установки синтеза: модели девяти веществ, соединённые трубопроводами-стадиями, путь светится.
// Сцены строятся из window.LUCH_REAL() опыта; нажатия уходят в LUCH_REAL.click (ch-*, sl-*, nd-*, reset, g0…g2, back, again).
(() => {
  const SC = window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {};
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rnd = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const SUBD = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
  const low = s => String(s).replace(/\d/g, d => SUBD[d]);
  const TY = 1.2; // верх подноса

  // ---------- общие детали ----------
  function H(kit) {
    const { T, at, box, cyl, mesh, keep, grad, glowTex, clickable, toon, C } = kit;
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    const v2 = (x, y) => new T.Vector2(x, y);
    const glassMat = (color = 0xd8eef8, opacity = 0.26) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, transparent: true, opacity, side: T.DoubleSide, depthWrite: false }));
    const ownMat = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, ...o }));
    const glow = (color, size, opacity) => { const s = new T.Sprite(keep(new T.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending }))); s.scale.setScalar(size); return s; };
    function canvasPlane(w, h, pw, ph, draw) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph; const x = c.getContext('2d');
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: tex, transparent: true })));
      x.clearRect(0, 0, pw, ph); draw(x, pw, ph); tex.needsUpdate = true;
      return m;
    }
    const rr = (x, a, b, w, hh, r) => { x.beginPath(); if (x.roundRect) x.roundRect(a, b, w, hh, r); else x.rect(a, b, w, hh); };
    // строки текста по центру; каждая строка: строка или { t, k (доля высоты), c, mono, w }
    function textLines(x, pw, ph, lines, fg) {
      const lh = ph / lines.length;
      lines.forEach((ln, i) => {
        const t = typeof ln === 'string' ? { t: ln } : ln;
        let fs = Math.round(lh * (t.k || 0.62)); const font = s => `${t.w || 600} ${s}px ${t.mono === false ? '"Golos Text", sans-serif' : '"IBM Plex Mono", monospace'}`;
        x.font = font(fs); const tw = x.measureText(t.t).width; if (tw > pw * 0.9) { fs = Math.floor(fs * pw * 0.9 / tw); x.font = font(fs); }
        x.fillStyle = t.c || fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t.t, pw / 2, lh * (i + 0.5) + 2);
      });
    }
    const hex = n => '#' + n.toString(16).padStart(6, '0');
    // плоская клавиша с надписью
    function key(parent, x, z, w, d, label, color, keyName, fg = '#ffffff') {
      const b = new T.Group(); at(b, x, TY, z, parent);
      at(box(w, 1.6, d, color), 0, 0.8, 0, b);
      const top = canvasPlane(w * 0.92, d * 0.8, Math.round(70 * w / d * 1.4), 112, (cx, a, bb) => { cx.fillStyle = hex(color); cx.fillRect(0, 0, a, bb); textLines(cx, a, bb, [label], fg); });
      top.rotation.x = -Math.PI / 2; at(top, 0, 1.62, 0, b);
      clickable(b, keyName); return b;
    }
    // белый лабораторный поднос
    function tray(g, w = 124, d = 84, z = 4) {
      at(box(w, TY, d, 0xf3f5f8), 0, TY / 2, z, g);
      at(box(w, 1.5, 1.2, 0xe2e7ee), 0, TY + 0.75, z - d / 2 + 0.6, g); at(box(w, 1.5, 1.2, 0xe2e7ee), 0, TY + 0.75, z + d / 2 - 0.6, g);
      at(box(1.2, 1.5, d - 2.4, 0xe2e7ee), -w / 2 + 0.6, TY + 0.75, z, g); at(box(1.2, 1.5, d - 2.4, 0xe2e7ee), w / 2 - 0.6, TY + 0.75, z, g);
    }
    // стеклянная стенка-цилиндр с контуром
    function glassWall(parent, x, y, z, r, h, col, op) {
      const w = new T.Mesh(keep(new T.CylinderGeometry(r, r, h, 32, 1, true)), glassMat(col, op)); at(w, x, y + h / 2, z, parent);
      w.add(new T.Mesh(w.geometry, kit.hullMat)); return w;
    }
    // чашка (фарфоровая или стеклянная)
    function dish(parent, r, col = 0xd8eef8, op = 0.45) {
      at(cyl(r, 0.4, col, { edges: false, matOpt: op < 1 ? { transparent: true, opacity: op } : {} }), 0, 0.2, 0, parent);
      if (op < 1) glassWall(parent, 0, 0, 0, r, 1.6, col, op * 0.7);
      else { const w = new T.Mesh(keep(new T.CylinderGeometry(r, r * 0.9, 1.6, 32, 1, true)), toon(col, { side: T.DoubleSide })); at(w, 0, 0.8, 0, parent); w.add(new T.Mesh(w.geometry, kit.hullMat)); }
    }
    // стакан с делениями
    function beaker(parent, r, h) {
      glassWall(parent, 0, 0, 0, r, h, 0xd8eef8, 0.24);
      at(cyl(r * 0.97, 0.5, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.45 } }), 0, 0.25, 0, parent);
      const rim = mesh(new T.TorusGeometry(r, 0.2, 6, 32), 0xeef6fb, { edges: false }); rim.rotation.x = Math.PI / 2; at(rim, 0, h, 0, parent);
      for (let k = 1; k <= 4; k++) { const m = box(k % 2 ? 0.9 : 1.6, 0.14, 0.1, 0x6f8098, { edges: false, shadow: false }); m.rotation.y = 0.4; at(m, Math.sin(0.4) * (r + 0.05), h * k / 5.5, Math.cos(0.4) * (r + 0.05), parent); }
    }
    // жидкость: цилиндр от дна
    function liquid(parent, r, hgt, col, op = 0.62, y0 = 0.5) {
      const m = new T.Mesh(keep(new T.CylinderGeometry(r, r * 0.97, hgt, 32)), ownMat(col, { transparent: true, opacity: op, depthWrite: false }));
      return at(m, 0, y0 + hgt / 2, 0, parent);
    }
    // пробирка с круглым дном
    function tube(parent, r, h) {
      const pts = []; for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + i / 8 * Math.PI / 2; pts.push(v2(Math.max(0.001, Math.cos(a) * r), r + Math.sin(a) * r)); }
      pts.push(v2(r, h)); pts.push(v2(r + 0.3, h + 0.15));
      const geo = keep(new T.LatheGeometry(pts, 24));
      const wall = new T.Mesh(geo, glassMat(0xd8eef8, 0.3)); parent.add(wall); wall.add(new T.Mesh(geo, kit.hullMat));
      return wall;
    }
    // клубы дыма/тумана внутри сосуда
    let puffT = null;
    function puffTex() {
      if (puffT) return puffT;
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
      const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.5, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 64, 64); puffT = keep(new T.CanvasTexture(c)); return puffT;
    }
    function fumes(parent, r, h, n, op, color = 0xffffff) {
      const ps = [];
      for (let i = 0; i < n; i++) {
        const s = new T.Sprite(keep(new T.SpriteMaterial({ map: puffTex(), color, transparent: true, opacity: op, depthWrite: false })));
        parent.add(s); ps.push({ s, ph: rnd(i + 2), a: rnd(i + 5) * 6.28, rr: Math.sqrt(rnd(i + 7)) * r * 0.6 });
      }
      kit.onFrame((dt, t) => {
        for (const p of ps) {
          const ph = kit.reduce ? p.ph : (t * 0.12 + p.ph) % 1;
          p.s.position.set(Math.cos(p.a + t * 0.3) * p.rr, 1 + ph * (h - 3), Math.sin(p.a + t * 0.3) * p.rr);
          p.s.scale.setScalar(r * (0.9 + 0.5 * Math.sin(Math.PI * ph)));
          p.s.material.opacity = op * (0.5 + 0.5 * Math.sin(Math.PI * ph));
        }
      });
    }
    // подставка-пьедестал (как в музее)
    function pedestal(parent, r, col = 0x3b4a66) {
      at(cyl(r, 1.4, col, { seg: 32 }), 0, 0.7, 0, parent);
      at(cyl(r * 0.82, 0.5, 0xe8ecf4, { seg: 32, edges: false }), 0, 1.65, 0, parent);
      return 1.9;
    }
    // плоская стрелка на подносе от a к b (вдоль x)
    function arrow(parent, x1, x2, z, col) {
      const len = x2 - x1 - 3.2;
      if (len > 0.5) at(box(len, 0.45, 1.1, col, { edges: false, shadow: false }), x1 + len / 2, TY + 0.23, z, parent);
      // плоский треугольник: вершина трёхгранной призмы смотрит по +x
      const head = cyl(2.1, 0.45, col, { seg: 3, edges: false, hull: false, shadow: false }); head.rotation.y = Math.PI / 2;
      at(head, x2 - 2.1, TY + 0.23, z, parent);
    }
    // кольцо-подсветка на подносе
    function ring(parent, x, z, r, col, op = 1) {
      const m = new T.Mesh(keep(new T.TorusGeometry(r, 0.35, 6, 40)), keep(new T.MeshBasicMaterial({ color: col, transparent: op < 1, opacity: op })));
      m.rotation.x = Math.PI / 2; return at(m, x, TY + 0.3, z, parent);
    }
    function rodAB(parent, a, b, r, color, o = {}) {
      const dv = b.clone().sub(a), L = dv.length();
      const m = cyl(r, L, color, { edges: false, ...o });
      m.quaternion.setFromUnitVectors(v3(0, 1, 0), dv.normalize());
      return at(m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, parent);
    }
    return { v3, v2, glassMat, ownMat, glow, canvasPlane, rr, textLines, hex, key, tray, glassWall, dish, beaker, liquid, tube, fumes, pedestal, arrow, ring, rodAB };
  }

  // ---------- шаростержневые модели молекул ----------
  // атом: [элемент, x, y, z, число H (ставятся сами), гибридизация 4|3]; '*' — продолжение цепи полимера (только стержень)
  const ACOL = { H: 0xf2f5fa, C: 0x4f586d, O: 0xe5533f, Cl: 0x5fc46a };
  const ARAD = { H: 0.3, C: 0.48, O: 0.46, Cl: 0.58 };
  const MOLS = {
    CH4: { a: [['C', 0, 0, 0, 4, 4]], b: [] },
    CH3Cl: { a: [['C', -0.8, 0, 0, 3, 4], ['Cl', 0.95, 0, 0]], b: [[0, 1, 1]] },
    CH3OH: { a: [['C', -0.7, -0.25, 0, 3, 4], ['O', 0.7, 0.25, 0], ['H', 1.3, -0.45, 0]], b: [[0, 1, 1], [1, 2, 1]] },
    HCHO: { a: [['C', 0, -0.5, 0, 2, 3], ['O', 0, 0.75, 0]], b: [[0, 1, 2]] },
    HCOOH: { a: [['C', -0.4, -0.2, 0, 1, 3], ['O', -0.4, 1.05, 0], ['O', 0.75, -0.85, 0], ['H', 1.6, -0.35, 0]], b: [[0, 1, 2], [0, 2, 1], [2, 3, 1]] },
    HCOOCH3: { a: [['C', -1.1, -0.1, 0, 1, 3], ['O', -1.1, 1.15, 0], ['O', 0.05, -0.75, 0], ['C', 1.3, -0.1, 0, 3, 4]], b: [[0, 1, 2], [0, 2, 1], [2, 3, 1]] },
    C2H4: { a: [['C', -0.67, 0, 0, 2, 3], ['C', 0.67, 0, 0, 2, 3]], b: [[0, 1, 2]] },
    C2H2: { a: [['C', -0.6, 0, 0], ['C', 0.6, 0, 0], ['H', -1.65, 0, 0], ['H', 1.65, 0, 0]], b: [[0, 1, 3], [0, 2, 1], [1, 3, 1]] },
    C2H5OH: { a: [['C', -1.25, -0.4, 0, 3, 4], ['C', 0, 0.4, 0, 2, 4], ['O', 1.25, -0.4, 0], ['H', 2.0, 0.2, 0]], b: [[0, 1, 1], [1, 2, 1], [2, 3, 1]] },
    C2H5Cl: { a: [['C', -1.25, -0.4, 0, 3, 4], ['C', 0, 0.4, 0, 2, 4], ['Cl', 1.45, -0.45, 0]], b: [[0, 1, 1], [1, 2, 1]] },
    CH3CHO: { a: [['C', -1.0, -0.4, 0, 3, 4], ['C', 0.25, 0.4, 0, 1, 3], ['O', 0.25, 1.65, 0]], b: [[0, 1, 1], [1, 2, 2]] },
    CH3COOH: { a: [['C', -1.1, -0.4, 0, 3, 4], ['C', 0.15, 0.4, 0], ['O', 0.15, 1.65, 0], ['O', 1.3, -0.25, 0], ['H', 2.1, 0.35, 0]], b: [[0, 1, 1], [1, 2, 2], [1, 3, 1], [3, 4, 1]] },
    CH3COOC2H5: { a: [['C', -2.5, -0.4, 0, 3, 4], ['C', -1.25, 0.4, 0], ['O', -1.25, 1.65, 0], ['O', 0, -0.3, 0], ['C', 1.25, 0.4, 0, 2, 4], ['C', 2.5, -0.3, 0, 3, 4]], b: [[0, 1, 1], [1, 2, 2], [1, 3, 1], [3, 4, 1], [4, 5, 1]] },
    PE: { a: [['*', -3.1, -0.4, 0], ['C', -1.9, 0.35, 0, 2, 4], ['C', -0.65, -0.4, 0, 2, 4], ['C', 0.65, 0.35, 0, 2, 4], ['C', 1.9, -0.4, 0, 2, 4], ['*', 3.1, 0.35, 0]], b: [[0, 1, 1], [1, 2, 1], [2, 3, 1], [3, 4, 1], [4, 5, 1]] },
  };
  MOLS.EST = MOLS.CH3COOC2H5;
  // достраиваем атомы водорода по направлениям, свободным от связей
  const molCache = {};
  function molGeo(T, name) {
    if (molCache[name]) return molCache[name];
    const spec = MOLS[name]; if (!spec) return null;
    const V = (x, y, z) => new T.Vector3(x, y, z);
    const atoms = spec.a.map(a => ({ el: a[0], p: V(a[1], a[2], a[3]) })), bonds = spec.b.map(b => b.slice());
    spec.a.forEach((a, i) => {
      const n = a[4] || 0, hy = a[5] || 4; if (!n) return;
      const p = atoms[i].p, dirs = bonds.filter(b => b[0] === i || b[1] === i).map(b => atoms[b[0] === i ? b[1] : b[0]].p.clone().sub(p).normalize());
      const out = [];
      if (!dirs.length) { out.push(V(0, 1, 0), V(0.943, -0.333, 0), V(-0.471, -0.333, 0.816), V(-0.471, -0.333, -0.816)); }
      else {
        const s = dirs.reduce((acc, d) => acc.add(d), V(0, 0, 0)), b = s.lengthSq() < 1e-6 ? V(0, 1, 0) : s.clone().negate().normalize();
        const zN = V(0, 0, 1), inPl = zN.clone().cross(b).normalize();
        if (hy === 3) {
          if (n === 1) out.push(b);
          else { out.push(b.clone().multiplyScalar(0.5).addScaledVector(inPl, 0.866), b.clone().multiplyScalar(0.5).addScaledVector(inPl, -0.866)); }
        } else if (dirs.length === 1) {
          const ax = dirs[0].clone().negate(), p1 = V(0, 0, 1).cross(ax); if (p1.lengthSq() < 1e-6) p1.set(1, 0, 0); p1.normalize();
          const p2 = ax.clone().cross(p1).normalize();
          for (let k = 0; k < 3; k++) { const ang = k * 2.094 + Math.PI / 2; out.push(ax.clone().multiplyScalar(0.334).addScaledVector(p1, 0.943 * Math.cos(ang)).addScaledVector(p2, 0.943 * Math.sin(ang))); }
        } else {
          out.push(b.clone().multiplyScalar(0.577).addScaledVector(zN, 0.816), b.clone().multiplyScalar(0.577).addScaledVector(zN, -0.816));
        }
      }
      out.slice(0, n).forEach(d => { atoms.push({ el: 'H', p: p.clone().addScaledVector(d.normalize(), 1.0) }); bonds.push([i, atoms.length - 1, 1]); });
    });
    // по центру
    const c = V(0, 0, 0); atoms.forEach(a => c.add(a.p)); c.multiplyScalar(1 / atoms.length);
    let minY = 1e9, maxY = -1e9; atoms.forEach(a => { a.p.sub(c); minY = Math.min(minY, a.p.y); maxY = Math.max(maxY, a.p.y); });
    return (molCache[name] = { atoms, bonds, minY, maxY });
  }
  // модель на подставке: возвращает { g (вращается), top }
  function molecule(kit, h, parent, name, s, ghost) {
    const { T, at, keep, toon } = kit;
    const M = molGeo(T, name), g = new T.Group(); parent.add(g);
    if (!M) return { g, top: 4, bottom: 0 };
    const sph = keep(new T.SphereGeometry(1, 18, 12));
    const mat = el => ghost ? toon(0xb8c2d4, { transparent: true, opacity: 0.32, depthWrite: false }) : toon(ACOL[el] || 0xcccccc);
    M.atoms.forEach(a => {
      if (a.el === '*') return;
      const m = new T.Mesh(sph, mat(a.el)); if (!ghost) { m.add(new T.Mesh(sph, kit.hullMat)); m.castShadow = true; }
      m.scale.setScalar((ARAD[a.el] || 0.45) * s); at(m, a.p.x * s, a.p.y * s, a.p.z * s, g);
    });
    const rodCol = ghost ? 0xc8d0de : 0x9aa3b2;
    M.bonds.forEach(([i, j, o]) => {
      const A = M.atoms[i].p.clone().multiplyScalar(s), B = M.atoms[j].p.clone().multiplyScalar(s);
      const dir = B.clone().sub(A).normalize(); let pp = dir.clone().cross(new T.Vector3(0, 0, 1)); if (pp.lengthSq() < 1e-6) pp.set(1, 0, 0); pp.normalize();
      const offs = o === 3 ? [-0.32, 0, 0.32] : o === 2 ? [-0.2, 0.2] : [0];
      const r = (o > 1 ? 0.09 : 0.13) * s;
      const half = M.atoms[i].el === '*' || M.atoms[j].el === '*';
      offs.forEach(k => h.rodAB(g, A.clone().addScaledVector(pp, k * s), B.clone().addScaledVector(pp, k * s), r, half ? 0x6f7a90 : rodCol, ghost ? { hull: false, matOpt: { transparent: true, opacity: 0.4, depthWrite: false } } : { hull: false }));
    });
    return { g, top: M.maxY * s + 0.6 * s, bottom: M.minY * s - 0.6 * s };
  }
  // подставка с моделью; лёгкое покачивание, чтобы было видно объём
  function molStand(kit, h, parent, x, z, name, s, ghost, ph) {
    const { T, at, cyl } = kit;
    const g = new T.Group(); at(g, x, TY, z, parent);
    const py = h.pedestal(g, 4.4, ghost ? 0x5d6b88 : 0x3b4a66);
    const holder = new T.Group(); g.add(holder);
    const mol = molecule(kit, h, holder, name, s, ghost);
    const lift = py + 2.2 - mol.bottom;
    at(cyl(0.25, lift - py, 0x9aa3b2, { edges: false, hull: false }), 0, py + (lift - py) / 2, 0, g);
    holder.position.y = lift;
    if (!kit.reduce) kit.onFrame((dt, t) => { mol.g.rotation.y = 0.55 * Math.sin(t * 0.5 + ph); });
    return { g, top: TY + lift + mol.top };
  }

  // ---------- вещества неорганических рядов в посуде ----------
  function substance(kit, h, parent, f, on) {
    const { T, at, box, cyl, mesh, toon } = kit;
    const g = new T.Group(); parent.add(g);
    const lumps = (n, r, col, y, spread, geoR = 0.9) => { for (let i = 0; i < n; i++) { const c = mesh(new T.IcosahedronGeometry(geoR * (0.8 + 0.4 * rnd(i + 3)), 0), col, { edgeAngle: 20 }); c.rotation.set(rnd(i) * 3, rnd(i + 1) * 3, 0); const a = rnd(i + 4) * 6.28, d = Math.sqrt(rnd(i + 5)) * spread; at(c, Math.cos(a) * d, y + (i % 3) * 0.4, Math.sin(a) * d, g); } };
    if (f === 'Ca' || f === 'CaO' || f === 'S') {
      h.dish(g, 5, f === 'Ca' ? 0xd8eef8 : 0xf7f5ee, f === 'Ca' ? 0.45 : 1);
      if (on) {
        if (f === 'Ca') lumps(7, 5, 0xc9ced8, 0.9, 3);
        else if (f === 'CaO') lumps(8, 5, 0xfbfbf6, 0.9, 3.2, 1.0);
        else { at(cyl(3.8, 2.2, 0xf2d230, { r2: 0.6, seg: 24 }), 0, 1.5, 0, g); }
      }
      return { g, top: 4 };
    }
    if (f === 'Ca(OH)2' || f === 'CaCO3') {
      h.beaker(g, 4, 10);
      if (on) {
        if (f === 'Ca(OH)2') h.liquid(g, 3.75, 6.5, 0xf0f3f5, 0.82);
        else { h.liquid(g, 3.75, 6.5, 0xd8eef8, 0.35); at(cyl(3.7, 1.3, 0xfbfbf6, { edges: false, hull: false }), 0, 1.15, 0, g); }
      }
      return { g, top: 11 };
    }
    if (f === 'SO2' || f === 'SO3') {
      // газовый цилиндр под стеклянной крышкой
      h.glassWall(g, 0, 0, 0, 3.6, 12, 0xd8eef8, 0.26);
      at(cyl(3.6, 0.5, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.45 } }), 0, 0.25, 0, g);
      at(cyl(4.4, 0.5, 0xd8eef8, { matOpt: { transparent: true, opacity: 0.55 } }), 0, 12.3, 0, g);
      if (on) {
        if (f === 'SO2') h.liquid(g, 3.3, 11, 0xe9eef4, 0.16);
        else h.fumes(g, 3.4, 12, 7, 0.5);
      }
      return { g, top: 13 };
    }
    if (f === 'H2SO4') {
      h.glassWall(g, 0, 0, 0, 3.6, 10, 0xd8eef8, 0.3);
      at(cyl(3.6, 1.6, 0xd8eef8, { r2: 1.4, edges: false, matOpt: { transparent: true, opacity: 0.4 } }), 0, 10.8, 0, g);
      at(cyl(1.6, 1.8, 0x2c3240, { seg: 16 }), 0, 12.5, 0, g);
      if (on) h.liquid(g, 3.25, 7, 0xf3f1e2, 0.62, 0.3);
      const lb = h.canvasPlane(5.6, 3, 200, 108, (x, a, b) => { x.fillStyle = '#fff6e6'; x.fillRect(0, 0, a, b); h.textLines(x, a, b, ['H₂SO₄'], '#1b1610'); });
      at(lb, 0, 4.6, 3.66, g);
      return { g, top: 14 };
    }
    if (f === 'BaSO4') {
      at(box(7, 3, 6, 0x3b4a66), 0, 1.5, 0, g);
      const tg = new T.Group(); at(tg, 0, 1.2, 0, g);
      h.tube(tg, 2, 14);
      if (on) {
        const lm = toon(0xdfe9f2, { transparent: true, opacity: 0.45, depthWrite: false });
        at(new T.Mesh(kit.keep(new T.CylinderGeometry(1.7, 1.7, 7, 20)), lm), 0, 2 + 3.5, 0, tg);
        at(new T.Mesh(kit.keep(new T.SphereGeometry(1.7, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), toon(0xfbfbf6)), 0, 2, 0, tg);
        at(cyl(1.7, 1.4, 0xfbfbf6, { edges: false, hull: false }), 0, 2.7, 0, tg);
      }
      return { g, top: 16 };
    }
    return { g, top: 4 };
  }

  // ===== уроки 1 и 2: два ряда веществ, стрелки, карточки реагентов, склянки, доска =====
  function chainScene(kit, d, organic) {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const ROWZ = [-19, 9];
    d.rows.forEach((row, ri) => {
      const n = row.nodes.length, sp = Math.min(26, 112 / n), z = ROWZ[ri];
      const xs = row.nodes.map((_, i) => (i - (n - 1) / 2) * sp);
      const got = i => i === 0 || !!row.fill[i - 1];
      // табличка ряда слева на подносе
      const lb = h.canvasPlane(14, 3.2, 420, 96, (x, a, b) => { x.fillStyle = row.done ? '#86e0a8' : '#fff6e6'; h.rr(x, 2, 2, a - 4, b - 4, 14); x.fill(); h.textLines(x, a, b, [{ t: (row.done ? '✓ ' : '') + row.title, mono: false, k: 0.5 }], '#1b1610'); });
      lb.rotation.x = -Math.PI / 2; at(lb, -52 + 7, TY + 0.05, z - 9.5, g);
      row.nodes.forEach((nd, i) => {
        const x = xs[i], on = got(i), justGot = d.last && d.last[0] === ri && d.last[1] === i - 1;
        let top;
        if (organic) {
          const s = n >= 6 ? 1.9 : 2.1;
          top = molStand(kit, h, g, x, z, nd[0], s * (nd[0].length > 7 ? 0.85 : 1), !on, i + ri * 3).top;
        } else {
          const sg = new T.Group(); at(sg, x, TY, z, g);
          at(cyl(5.6, 0.6, on ? 0xe8ecf4 : 0xd3d9e3, { seg: 32, edges: false }), 0, 0.3, 0, sg);
          const sub = new T.Group(); at(sub, 0, 0.6, 0, sg);
          top = TY + 0.6 + substance(kit, h, sub, nd[0], on).top;
        }
        if (row.done) at(h.glow(0x86e0a8, 13, 0.18), x, TY + 5, z, g);
        if (justGot) h.ring(g, x, z, 6.2, 0xffd166);
        tag(v3(x, top + 2.5, z), nd[1], low(nd[0]), justGot);
      });
      // стрелки и карточки реагентов
      row.fill.forEach((f, i) => {
        const x1 = xs[i] + 5.4, x2 = xs[i + 1] - 5.4, xm = (xs[i] + xs[i + 1]) / 2;
        h.arrow(g, x1, x2, z, f ? 0x2f9e55 : 0x8b96ad);
        const cw = Math.min(17, sp - 3), cz = z + 9.5;
        const cg = new T.Group(); at(cg, xm, TY, cz, g); clickable(cg, 'sl-' + ri + '-' + i);
        at(box(cw * 0.7, 1, 2.2, 0x5d6b88), 0, 0.5, -0.8, cg);
        const st = f ? 'ok' : d.sel ? 'wait' : 'empty';
        const col = { ok: '#2f9e55', wait: '#72d4e8', empty: '#ffb547' }[st];
        const card = h.canvasPlane(cw, 5.2, 520, 168, (x, a, b) => {
          x.fillStyle = f ? '#e5f7ea' : '#fffdf6'; h.rr(x, 6, 6, a - 12, b - 12, 22); x.fill();
          x.strokeStyle = col; x.lineWidth = 10; if (!f) x.setLineDash([26, 16]); x.stroke(); x.setLineDash([]);
          h.textLines(x, a, b, [{ t: f || '?', k: f ? 0.5 : 0.62 }], f ? '#1f7a43' : st === 'wait' ? '#2a8fa6' : '#c47a00');
        });
        card.rotation.x = -0.75; at(card, 0, 2.9, 0, cg);
        const back = box(cw + 0.3, 5.5, 0.4, 0xd9dee6); back.rotation.x = -0.75; at(back, 0, 2.75, -0.25, cg);
        // пунктир от карточки к стрелке
        at(box(0.35, 0.2, 5, f ? 0x2f9e55 : 0xb8c2d4, { edges: false, shadow: false }), 0, 0.1, -4.6, cg);
        if (st === 'wait' && !kit.reduce) { const gl = h.glow(0x72d4e8, cw * 1.2, 0.0); at(gl, 0, 3.2, 0.4, cg); kit.onFrame((dt, t) => { gl.material.opacity = 0.18 + 0.14 * Math.sin(t * 4); }); }
      });
    });
    // склянки с реактивами спереди
    const nC = d.chips.length, cs = Math.min(15, 116 / nC);
    d.chips.forEach((c, i) => {
      const x = (i - (nC - 1) / 2) * cs, z = 31, sel = d.sel === c.k;
      const bg = new T.Group(); at(bg, x, TY, z, g); clickable(bg, 'ch-' + c.k);
      const bot = new T.Group(); bg.add(bot);
      const colr = organic ? [0xf4e7c5, 0xe3eef8, 0x2b2b2b, 0xf0d7a8, 0xdfeefa, 0xf2ecd0, 0xe8f0f6, 0xe9e2f6][i % 8] : { O2: 0x8fc6ea, H2O: 0x8fc6ea, CO2: 0xdfe6ee, BaCl2: 0xf1f1ec, HCl: 0xe9f1e2, NaOH: 0xeef2f6, H2: 0xe6eaf0 }[c.k] || 0xe3eef8;
      const gas = !organic && /^(O2|CO2|H2)$/.test(c.k);
      if (gas) {
        // газ — в небольшом баллоне
        at(cyl(2.3, 8.5, { O2: 0x3a7bd5, CO2: 0x2c3240, H2: 0xb5432f }[c.k], { seg: 20 }), 0, 4.25, 0, bot);
        at(new T.Mesh(kit.keep(new T.SphereGeometry(2.3, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)), kit.toon({ O2: 0x3a7bd5, CO2: 0x2c3240, H2: 0xb5432f }[c.k])), 0, 8.5, 0, bot);
        at(cyl(0.7, 1.6, C.BRASS), 0, 11, 0, bot); at(box(2.4, 0.6, 0.6, C.BRASS), 0, 11.4, 0, bot);
      } else if (organic && c.k === 'cuo') {
        h.dish(bot, 3.4, 0xf7f5ee, 1);
        at(cyl(2.4, 1.0, 0x1d1d1d, { r2: 1.2, seg: 20 }), 0, 1.0, 0, bot);
      } else {
        h.glassWall(bot, 0, 0, 0, 2.6, 7.5, organic && c.k === 'ox' ? 0x9a6a3a : 0xd8eef8, organic && c.k === 'ox' ? 0.55 : 0.3);
        at(cyl(2.6, 1.2, 0xd8eef8, { r2: 1.1, edges: false, matOpt: { transparent: true, opacity: 0.4 } }), 0, 8.1, 0, bot);
        at(cyl(1.25, 1.4, organic && c.k === 'est' ? 0xb5432f : 0x2c3240, { seg: 16 }), 0, 9.4, 0, bot);
        h.liquid(bot, 2.3, 5, colr, 0.72, 0.3);
      }
      if (sel) {
        h.ring(g, x, z, 3.9, 0xffd166);
        at(h.glow(0xffd166, 12, 0.3), 0, 5, 0, bg);
        if (!kit.reduce) kit.onFrame((dt, t) => { bot.position.y = 1.4 + 0.6 * Math.sin(t * 4); }); else bot.position.y = 1.2;
      }
      const lb = h.canvasPlane(cs - 1.4, 3.6, 300, 104, (cx, a, b) => {
        cx.fillStyle = sel ? '#ffd166' : '#fff6e6'; h.rr(cx, 2, 2, a - 4, b - 4, 12); cx.fill();
        h.textLines(cx, a, b, [{ t: c.l, k: 0.6 }, { t: c.s, k: 0.5, mono: false, w: 500, c: '#5b6476' }], '#1b1610');
      });
      lb.rotation.x = -0.6; at(lb, 0, 1.3, 5.2, bg);
    });
    // доска: последнее уравнение и счёт
    const bd = new T.Group(); at(bd, -6, TY, -36, g);
    at(box(2.4, 19, 2.4, C.DARK), -40, 9.5, 0, bd); at(box(2.4, 19, 2.4, C.DARK), 40, 9.5, 0, bd);
    at(box(84, 13, 1.4, 0x26324a), 0, 13, 0, bd);
    const okc = d.done ? '#86e0a8' : '#ffb547';
    const lines = [
      { t: d.done ? 'Все стрелки подобраны ✓' : d.sel ? 'Взят реактив: ' + (d.chips.find(c => c.k === d.sel) || {}).l + ' — нажмите карточку «?»' : 'Выберите склянку, потом карточку над стрелкой', k: 0.5, mono: false, c: okc },
      { t: d.lastEq || '—', k: 0.62, c: '#f2f5f0' },
      { t: d.lastCond ? d.lastCond : (organic ? 'над стрелкой — реагент и условия' : 'над стрелкой — второй реагент'), k: 0.46, mono: false, w: 500, c: '#9fb0c8' },
    ];
    const board = h.canvasPlane(81, 11.4, 1100, 156, (cx, a, b) => { cx.fillStyle = '#132018'; cx.fillRect(0, 0, a, b); cx.strokeStyle = okc; cx.lineWidth = 6; cx.strokeRect(3, 3, a - 6, b - 6); h.textLines(cx, a, b, lines, '#f2f5f0'); });
    at(board, 0, 13, 0.75, bd);
    h.key(g, 51, -33, 15, 5, 'заново', 0x5d6b88, 'reset');
    tag(v3(-6, TY + 22, -36), organic ? 'Реагенты и условия' : 'Реактивы на стрелках', `${d.filled} из ${d.total} · ошибок ${d.wrong}`, d.done);
  }
  SC['cgen-inorg'] = (kit, d) => chainScene(kit, d, false);
  SC['cgen-org'] = (kit, d) => chainScene(kit, d, true);

  // ===== урок 3: макет установки синтеза — вещества на подставках, стадии — трубопроводы =====
  SC['cgen-syn'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const P = {}; d.nodes.forEach(n => { P[n.k] = v3((n.x - 250) * 0.25, 0, (n.y - 268) * 0.3); });
    const inRoute = new Set(), best = new Set(), cand = new Set(d.next);
    for (let i = 1; i < d.route.length; i++) inRoute.add(d.route[i - 1] + '>' + d.route[i]);
    if (d.best) for (let i = 1; i < d.best.length; i++) best.add(d.best[i - 1] + '>' + d.best[i]);
    const end = d.route[d.route.length - 1];
    const has = (a, b) => d.edges.some(e => e.a === a && e.b === b);
    // трубопроводы
    const flows = [];
    d.edges.forEach(e => {
      const k = e.a + '>' + e.b, A = P[e.a], B = P[e.b];
      const st = inRoute.has(k) ? 'route' : best.has(k) ? 'best' : e.a === end && cand.has(e.b) && !d.atGoal ? 'next' : 'off';
      const col = { route: 0xffb547, best: 0x2f9e55, next: 0x2a9fc0, off: 0x8b96ad }[st], r = st === 'off' ? 0.42 : 0.7;
      const dir = B.clone().sub(A).setY(0).normalize(), nrm = v3(-dir.z, 0, dir.x), off = has(e.b, e.a) ? 1.6 : 0;
      const a = A.clone().addScaledVector(dir, 6.6).addScaledVector(nrm, off).setY(TY + 2.4), b = B.clone().addScaledVector(dir, -7.4).addScaledVector(nrm, off).setY(TY + 2.4);
      const mid = a.clone().lerp(b, 0.5).setY(TY + 2.4 + (st === 'off' ? 1.2 : 2.6));
      const curve = new T.CatmullRomCurve3([a, a.clone().lerp(mid, 0.5).setY(TY + 2.4 + (mid.y - TY - 2.4) * 0.8), mid, b.clone().lerp(mid, 0.5).setY(TY + 2.4 + (mid.y - TY - 2.4) * 0.8), b]);
      at(mesh(new T.TubeGeometry(curve, 40, r, 8), col, { hull: st !== 'off', edges: false }), 0, 0, 0, g);
      // наконечник-стрелка
      const head = cyl(r * 2.4, 2.6, col, { r2: 0, seg: 12, edges: false });
      const tgt = curve.getTangent(1); head.quaternion.setFromUnitVectors(v3(0, -1, 0), tgt.clone().negate().normalize());
      at(head, b.x + tgt.x * 1.2, b.y + tgt.y * 1.2, b.z + tgt.z * 1.2, g);
      // опоры трубы
      if (st !== 'off') at(cyl(0.3, mid.y - TY, 0x5d6b88, { edges: false, hull: false }), mid.x, TY + (mid.y - TY) / 2, mid.z, g);
      if (st === 'route' || st === 'next') {
        flows.push({ curve, col: st === 'route' ? 0xffd166 : 0x9be6f5 });
        tag(mid.clone().setY(mid.y + 2.5), '', e.c, st === 'next');
      } else if (st === 'best') tag(mid.clone().setY(mid.y + 2.5), '', e.c);
    });
    // бегущие огоньки — вещество течёт по стадиям
    const bead = kit.keep(new T.SphereGeometry(0.55, 10, 8));
    flows.forEach((f, fi) => {
      const ms = [];
      for (let i = 0; i < 3; i++) { const m = new T.Mesh(bead, kit.keep(new T.MeshBasicMaterial({ color: f.col }))); g.add(m); ms.push(m); }
      const place = t => ms.forEach((m, i) => m.position.copy(f.curve.getPointAt(((kit.reduce ? 0 : t * 0.35) + i / 3 + fi * 0.13) % 1)));
      place(0); if (!kit.reduce) kit.onFrame((dt, t) => place(t));
    });
    // вещества на подставках
    d.nodes.forEach((n, i) => {
      const p = P[n.k], ri = d.route.indexOf(n.k), isC = cand.has(n.k) && !d.atGoal, isGoal = n.k === d.to, isStart = n.k === d.from;
      const ms = molStand(kit, h, g, p.x, p.z, n.k, n.k === 'EST' || n.k === 'PE' ? 1.7 : 2.0, false, i * 1.3);
      clickable(ms.g, 'nd-' + n.k);
      if (isStart) h.ring(g, p.x, p.z, 5.6, 0xffb547);
      else if (ri > 0) h.ring(g, p.x, p.z, 5.6, isGoal ? 0x2f9e55 : 0xffb547);
      if (isGoal && ri < 0) {
        // цель: пунктирное зелёное кольцо
        for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, s = box(1.3, 0.3, 0.5, 0x2f9e55, { edges: false, shadow: false }); s.rotation.y = -a; at(s, p.x + Math.cos(a) * 6.2, TY + 0.3, p.z + Math.sin(a) * 6.2, g); }
      }
      if (isC) {
        const rg = h.ring(g, p.x, p.z, 6.6, 0x72d4e8, 0.9);
        if (!kit.reduce) kit.onFrame((dt, t) => { rg.material.opacity = 0.45 + 0.45 * Math.sin(t * 4 + i); });
      }
      if (n.k === end && d.route.length > 1 && !d.atGoal) at(h.glow(0xffb547, 16, 0.25), p.x, TY + 7, p.z, g);
      if (isGoal && d.atGoal) at(h.glow(0x86e0a8, 22, 0.3), p.x, TY + 7, p.z, g);
      const val = n.d + (ri > 0 ? ' · ' + ri : ri === 0 ? ' · старт' : isGoal ? ' · цель' : '');
      tag(v3(p.x, ms.top + 2, p.z), n.n, val, isC || (isGoal && d.atGoal));
    });
    // табло: цель, путь, выход
    const bd = new T.Group(); at(bd, 0, TY, -41, g);
    at(box(2.4, 18, 2.4, C.DARK), -44, 9, 0, bd); at(box(2.4, 18, 2.4, C.DARK), 44, 9, 0, bd);
    at(box(92, 12, 1.4, 0x26324a), 0, 12.5, 0, bd);
    const sc = d.atGoal ? '#86e0a8' : d.next.length ? '#ffb547' : '#ff8a73';
    const status = d.atGoal ? (d.steps === d.bestLen ? `Готово за ${d.steps} ст. — кратчайший путь` : `Готово за ${d.steps} ст. · кратчайший — ${d.bestLen} ст.`)
      : d.next.length ? `Стадий: ${d.steps} · выход ${d.yieldTxt} · дальше — голубые кольца` : 'Тупик: дальше пути нет — «шаг назад»';
    const board = h.canvasPlane(89, 10.6, 1200, 144, (cx, a, b) => {
      cx.fillStyle = '#132018'; cx.fillRect(0, 0, a, b); cx.strokeStyle = sc; cx.lineWidth = 6; cx.strokeRect(3, 3, a - 6, b - 6);
      h.textLines(cx, a, b, [{ t: 'Цель: ' + d.goalName, k: 0.52, mono: false, c: '#9fb0c8' }, { t: d.routeTxt + (d.atGoal ? ' ✓' : ' → …'), k: 0.6, c: '#f2f5f0' }, { t: status, k: 0.5, mono: false, c: sc }], '#f2f5f0');
    });
    at(board, 0, 12.5, 0.75, bd);
    // кнопки: цели, шаг назад, заново
    d.goals.forEach((G, i) => h.key(g, -50 + i * 17, 41, 15.5, 5, (G.done ? '✓ ' : '') + G.short, i === d.goal ? 0xffb547 : 0x5d6b88, 'g' + i, i === d.goal ? '#1b1610' : '#ffffff'));
    h.key(g, 24, 41, 15, 5, 'шаг назад', 0x5d6b88, 'back');
    h.key(g, 42, 41, 13, 5, 'заново', 0x5d6b88, 'again');
    tag(v3(-34, TY + 4, 41), 'Цели синтеза', `готово ${d.reached} из ${d.goals.length}`, d.reached === d.goals.length);
  };
})();
