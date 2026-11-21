// «Как в жизни» для темы «Строение вещества» (labs/phys-matter): микроскоп с каплей на стекле и круглым экраном-окуляром,
// где при увеличении появляются шаровые модели молекул воды, и стол-конструктор из атомов H, O, C с полкой для готовых молекул;
// аквариум с водой, перегородкой и марганцовкой (частицы краски и воды бегают сами), термометр, секундомер и журнал опытов;
// стеклянный сосуд с поршнем на плитке: 42 молекулы воды — лёд, вода или пар, второй сосуд, чтобы «перелить».
// Сцены строятся из window.LUCH_REAL() опыта; быстрые значения (частицы, поршень, время) — из LUCH_REAL.live() в onFrame.
(() => {
  const SC = window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {};
  const live = () => { try { return (window.LUCH_REAL && window.LUCH_REAL.live && window.LUCH_REAL.live()) || {}; } catch (e) { return {}; } };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (x, n = 0) => { if (!isFinite(x)) return '∞'; let s = (Math.round(x * 10 ** n) / 10 ** n).toFixed(n); if (/^-0(\.0+)?$/.test(s)) s = s.slice(1); return s.replace('.', ',').replace('-', '−'); };
  const tC = T => (T < 0 ? '−' + -T : String(T)) + ' °C';
  const hash = (i, j, k) => { const s = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453; return s - Math.floor(s); };
  const niceLen = mm => mm >= 1 ? fmt(mm, 0) + ' мм' : mm >= 1e-3 ? fmt(mm * 1e3, 0) + ' мкм' : fmt(mm * 1e6, mm * 1e6 < 1 ? 1 : 0) + ' нм';
  const subF = f => String(f || '').replace(/\d/g, x => '₀₁₂₃₄₅₆₇₈₉'[x]);
  const AZ = 0.62;                                   // камера по умолчанию смотрит с этой стороны — экраны поворачиваем к ней

  // подпись, у которой значение меняется каждый кадр (без перестройки сцены)
  const lastTag = () => { const l = document.querySelectorAll('.rl-view .rl-lbl'); return l[l.length - 1] || null; };
  function liveTag(kit, p, name, value, hot) {
    kit.tag(p, name, value, hot);
    const el = lastTag(), i = el && el.querySelector('i');
    let shown = value, hs = !!hot;
    return { set(v, h) { if (i && v !== shown) { shown = v; i.textContent = v; } if (el && h != null && !!h !== hs) { hs = !!h; el.classList.toggle('hot', hs); } } };
  }

  // ---------- атомы и молекулы: шарики как в музейной модели ----------
  const ATOM = { H: { r: 1.1, col: 0xeef2f8, name: 'водород' }, O: { r: 1.7, col: 0xe5534b, name: 'кислород' }, C: { r: 1.5, col: 0x4a5468, name: 'углерод' } };
  const TH = 2.0 / Math.sqrt(3);
  const MOL = {
    H2O: [['O', 0, 0.4, 0], ['H', -1.66, -0.89, 0], ['H', 1.66, -0.89, 0]],
    O2: [['O', -1.3, 0, 0], ['O', 1.3, 0, 0]],
    CO2: [['O', -2.7, 0, 0], ['C', 0, 0, 0], ['O', 2.7, 0, 0]],
    H2: [['H', -0.8, 0, 0], ['H', 0.8, 0, 0]],
    CH4: [['C', 0, 0, 0], ['H', TH, TH, TH], ['H', TH, -TH, -TH], ['H', -TH, TH, -TH], ['H', -TH, -TH, TH]],
  };

  // ---------- общие детали ----------
  function H(kit) {
    const { T, at, box, cyl, mesh, keep, grad, glowTex, textTex, clickable } = kit;
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    const glassMat = (color = 0xd8eef8, opacity = 0.22) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, transparent: true, opacity, side: T.DoubleSide, depthWrite: false }));
    const ownMat = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, ...o }));
    const glow = (color, size, opacity) => { const s = new T.Sprite(keep(new T.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending }))); s.scale.setScalar(size); return s; };
    const flat = (w, h, tex) => new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: keep(tex), transparent: true })));
    const label = (w, h, txt, fg = '#1b1610', bg = '#fff6e6') => flat(w, h, textTex(txt, fg, bg, Math.round(64 * w / h), 64));
    // табло: текст можно менять каждый кадр (строки через \n)
    function screen(w, h, txt, fg = '#86e0a8', pw = 320, ph = 120, bg = '#0e1520') {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph; const x = c.getContext('2d');
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace;
      let cur = null;
      const set = (t, col = fg) => {
        t = String(t); if (cur === t + col) return; cur = t + col;
        x.fillStyle = bg; x.fillRect(0, 0, pw, ph); x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle';
        const lines = t.split('\n'), lh = ph / lines.length;
        lines.forEach((ln, i) => {
          let fs = Math.round(lh * 0.62); x.font = `600 ${fs}px "IBM Plex Mono", monospace`;
          const tw = x.measureText(ln).width; if (tw > pw * 0.9) { fs = Math.floor(fs * pw * 0.9 / tw); x.font = `600 ${fs}px "IBM Plex Mono", monospace`; }
          x.fillText(ln, pw / 2, lh * (i + 0.5) + 2);
        });
        tex.needsUpdate = true;
      };
      set(txt);
      const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: tex })));
      m.userData.set = set; return m;
    }
    // кнопка: колпачок с надписью сверху
    function button(parent, x, y, z, txt, color, key, w = 4.2, dep = 3.6) {
      const b = new T.Group(); at(b, x, y, z, parent);
      at(box(w, 1.4, dep, color), 0, 0.7, 0, b);
      const top = flat(w * 0.88, dep * 0.8, textTex(txt, '#ffffff', '#' + color.toString(16).padStart(6, '0'), Math.round(96 * w / dep), 96));
      top.rotation.x = -Math.PI / 2; at(top, 0, 1.42, 0, b);
      if (key) clickable(b, key);
      return b;
    }
    // наклонная табличка на подставке (смотрит на зрителя), можно нажать
    function sign(parent, x, z, w, txt, key, fg = '#1b1610', bg = '#ffd166') {
      const g = new T.Group(); at(g, x, 0, z, parent); g.rotation.y = AZ * 0.6;
      at(box(w + 2, 1, 5, kit.C.WOOD2), 0, 0.5, 0, g);
      const p = new T.Group(); at(p, 0, 1, 0, g); p.rotation.x = -0.35;
      at(box(w + 1, 6, 0.8, 0x3b4a66), 0, 3, 0, p);
      const l = label(w, 4.6, txt, fg, bg); at(l, 0, 3, 0.42, p);
      if (key) clickable(g, key);
      return g;
    }
    // стеклянный термометр: шарик, столбик, шкала
    function thermo(parent, x, y0, z, len, lo, hi, v) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      at(new T.Mesh(keep(new T.SphereGeometry(1.0, 16, 12)), kit.toon(0xe0473a)), 0, 0, 0, g);
      at(cyl(0.72, len, 0xeef6fb, { matOpt: { transparent: true, opacity: 0.55 } }), 0, len / 2 + 0.5, 0, g);
      at(box(1.05, len - 1.6, 0.1, 0xfffaf0, { edges: false, shadow: false }), 0, len / 2 + 0.7, -0.34, g);
      const span = len - 2.2, n = Math.round((hi - lo) / 10);
      for (let k = 0; k <= n; k++) at(box(k % 5 === 0 ? 1.2 : 0.7, 0.13, 0.1, 0x1b1610, { edges: false, shadow: false }), 0.36, 1.1 + span * k / n, 0.64, g);
      const f = clamp((v - lo) / (hi - lo), 0, 1), hh = 0.3 + span * f;
      at(cyl(0.3, hh, 0xe0473a, { edges: false, hull: false, shadow: false }), 0, 0.8 + hh / 2, 0.05, g);
      return { g, top: y0 + len + 1 };
    }
    function atom(e, s = 1) { const A = ATOM[e]; return mesh(new T.SphereGeometry(A.r * s, 22, 16), A.col, { hull: true, edges: false }); }
    function molModel(f, s = 1) {
      const g = new T.Group();
      (MOL[f] || []).forEach(([e, x, y, z]) => at(atom(e, s), x * s, y * s, z * s, g));
      return g;
    }
    return { v3, glassMat, ownMat, glow, flat, label, screen, button, sign, thermo, atom, molModel };
  }

  // ===== 1. «Молекулы и атомы»: микроскоп и экран-окуляр / стол-конструктор с атомами =====
  SC['matter-molecules'] = (kit, d) => {
    if (d.st === 'build') return buildScene(kit, d);
    const { T, at, box, cyl, mesh, keep, clickable, cable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    // ---- микроскоп ----
    const mg = new T.Group(); at(mg, -34, 0, 2, g); mg.rotation.y = 0.35;
    const BODY = 0x3b4a66, BODY2 = 0x2c3240;
    at(box(20, 3, 26, BODY2), 0, 1.5, 0, mg);
    at(box(6, 28, 5, BODY), 0, 17, -9, mg);
    at(box(6, 5, 12, BODY), 0, 31, -5, mg);
    // предметный столик со стеклом и каплей, лампа под ним
    at(box(16, 1.2, 15, BODY2), 0, 14, 1, mg);
    at(box(13, 0.3, 4.4, 0xd8eef8, { matOpt: { transparent: true, opacity: 0.6 } }), 0, 14.75, 1, mg);
    const drop = mesh(new T.SphereGeometry(1.1, 20, 12), 0, { mat: h.ownMat(0x5fb4d9, { transparent: true, opacity: 0.85 }), edges: false, hull: true }); drop.scale.y = 0.45; at(drop, 0, 15, 1, mg);
    at(cyl(2.2, 1.2, BODY2), 0, 9.5, 1, mg);
    at(h.glow(0xfff1b8, 7, 0.7), 0, 10.6, 1, mg);
    at(box(0.6, 4, 0.6, C.STEEL, { edges: false }), -4.5, 12, -5, mg); at(box(0.6, 4, 0.6, C.STEEL, { edges: false }), 4.5, 12, -5, mg);
    // револьвер с объективами, тубус, окуляр, камера на окуляре
    at(cyl(3.4, 2.2, C.STEEL), 0, 23, 0, mg);
    [-1.6, 0, 1.6].forEach((dx, i) => at(cyl(0.8 - i * 0.12, 3.6 + i, i === 1 ? 0xd8b04a : C.STEEL, { edges: false }), dx, 20.4 - i * 0.4, 0.4, mg));
    const tube = new T.Group(); at(tube, 0, 24, 0, mg); tube.rotation.x = -0.32;
    at(cyl(2.2, 13, 0xe8ecf4), 0, 6.5, 0, tube);
    at(cyl(1.7, 4, BODY2), 0, 14.5, 0, tube);
    at(cyl(1.9, 0.6, C.STEEL), 0, 16.8, 0, tube);
    at(box(3.6, 2.6, 3.6, 0x26324a), 0, 18.4, 0, tube);
    // ручки увеличения на штативе: правая — сильнее, левая — слабее
    const kp = cyl(3.4, 1.8, 0xffb547, { seg: 24 }); kp.rotation.z = Math.PI / 2; at(kp, 4.4, 12, -9, mg); clickable(kp, 'z+');
    const km = cyl(2.6, 1.6, 0x72d4e8, { seg: 24 }); km.rotation.z = Math.PI / 2; at(km, -4.3, 12, -9, mg); clickable(km, 'z-');
    mg.updateMatrixWorld(true);
    // ---- экран-окуляр на стойке: что видно сейчас ----
    const RR = 17, sx = 18, sz = -8, sy = 30;
    at(cyl(7, 1.4, BODY2), sx, 0.7, sz, g);
    at(cyl(1.2, sy - RR + 2, C.STEEL, { edges: false }), sx, (sy - RR + 2) / 2 + 1.4, sz, g);
    const win = new T.Group(); at(win, sx, sy, sz, g); win.rotation.y = AZ;
    at(mesh(new T.CircleGeometry(RR, 64), 0x121c2b, { edges: false, shadow: false }), 0, 0, -1.4, win);
    at(cyl(RR + 1.4, 1.6, BODY2, { seg: 64, edges: false }), 0, 0, -2.4, win).rotation.x = Math.PI / 2;
    const ring = mesh(new T.TorusGeometry(RR + 0.5, 0.9, 10, 72), 0xa9b4c9, { edges: false, hull: true }); at(ring, 0, 0, 0, win);
    // что внутри: капля, сплошная вода, молекулы — как на схеме
    const z = d.z || 0, S3 = RR / 150;
    const sp = 0.31 * 300 * 10 ** z / 12e6, spU = sp * S3, a = clamp((sp - 6) / 6, 0, 1);
    const dr = 50 * 10 ** z * S3;
    if (dr < RR * 0.97) {
      const dm = mesh(new T.SphereGeometry(dr, 40, 24), 0, { mat: h.ownMat(0x4f9fca), edges: false, hull: true }); dm.scale.z = Math.min(1, 1.1 / dr + 0.25); at(dm, 0, 0, 0, win);
      const hl = new T.Mesh(keep(new T.CircleGeometry(dr * 0.22, 24)), keep(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }))); hl.scale.y = 0.6; at(hl, -dr * 0.35, dr * 0.4, dr * dm.scale.z + 0.05, win);
    } else if (a < 0.98) {
      at(new T.Mesh(keep(new T.CircleGeometry(RR, 64)), keep(new T.MeshBasicMaterial({ color: 0x2e6f93, transparent: true, opacity: 1 - a }))), 0, 0, -0.9, win);
    }
    let jig = null;
    if (sp >= 6) {
      const full = sp >= 9, rO = 0.12 / 0.31 * spU, rH = 0.085 / 0.31 * spU, dOH = 0.1 / 0.31 * spU, ang = 52.25 * Math.PI / 180;
      const lim = RR - rO - 0.7, n = Math.ceil(lim / spU) + 1, rows = Math.ceil(lim / (spU * 0.866)) + 1, list = [];
      for (let j = -rows; j <= rows && list.length < 2600; j++) for (let i = -n; i <= n && list.length < 2600; i++) {
        const h1 = hash(i, j, 1), h2 = hash(i, j, 2), h3 = hash(i, j, 3);
        const x = (i + (j & 1) * 0.5) * spU + (h1 - 0.5) * 0.26 * spU, y = j * spU * 0.866 + (h2 - 0.5) * 0.26 * spU;
        if (x * x + y * y > lim * lim) continue;
        list.push({ x, y, zz: (h3 - 0.5) * Math.min(1.6, spU * 0.6), th: h3 * Math.PI * 2, h1, h2, h3 });
      }
      const geo = keep(new T.SphereGeometry(1, 12, 8));
      const oMat = h.ownMat(full ? 0xe5534b : 0xc9605a, { transparent: a < 0.99, opacity: Math.max(0.05, a) });
      const hMat = h.ownMat(0xeef2f8, { transparent: a < 0.99, opacity: Math.max(0.05, a) });
      const oM = new T.InstancedMesh(geo, oMat, list.length), hM = new T.InstancedMesh(geo, hMat, full ? list.length * 2 : 1);
      if (!full) hM.count = 0;
      oM.frustumCulled = hM.frustumCulled = false;
      at(oM, 0, 0, 0, win); at(hM, 0, 0, 0, win);
      const m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), pv = new T.Vector3();
      const put = (M, k, x, y, zz, r) => { pv.set(x, y, zz); sc.setScalar(r); m4.compose(pv, q, sc); M.setMatrixAt(k, m4); };
      const amp = 0.025 / 0.31 * spU, wig = sp >= 14 && !kit.reduce;
      const pose = (t = 0) => {
        list.forEach((m, k) => {
          let x = m.x, y = m.y, th = m.th;
          if (wig) { x += amp * Math.sin(t * 3.85 + m.h1 * 40); y += amp * Math.cos(t * 3.33 + m.h2 * 40); th += 0.25 * Math.sin(t * 2.94 + m.h3 * 30); }
          put(oM, k, x, y, m.zz, full ? rO : rO * 1.15);
          if (full) {
            const ux = Math.sin(th), uy = Math.cos(th);
            for (const s of [-1, 1]) put(hM, 2 * k + (s > 0 ? 1 : 0), x + dOH * (s * Math.sin(ang) * uy + Math.cos(ang) * ux), y - dOH * (-s * Math.sin(ang) * ux + Math.cos(ang) * uy), m.zz + rO * 0.35, rH);
          }
        });
        oM.instanceMatrix.needsUpdate = true; if (full) hM.instanceMatrix.needsUpdate = true;
      };
      pose(0);
      if (wig) jig = pose;
    }
    // масштабная черта внизу экрана
    const W = 12 / 10 ** z, tgt = W / 3, e = 10 ** Math.floor(Math.log10(tgt)), mm = tgt / e, Lb = (mm >= 5 ? 5 : mm >= 2 ? 2 : 1) * e, bp = Lb * 2 * RR / W;
    at(box(bp, 0.45, 0.3, 0xe8ecf4, { edges: false, shadow: false }), 0, -RR + 3.4, 1.2, win);
    for (const s of [-1, 1]) at(box(0.3, 1.6, 0.3, 0xe8ecf4, { edges: false, shadow: false }), s * bp / 2, -RR + 3.4, 1.2, win);
    // кабель от камеры на окуляре к экрану
    const camP = v3(0, 18.4, 1.8).applyMatrix4(tube.matrixWorld);
    cable(camP, v3(sx - 3, 1.2, sz + 3), 0x2a2f3a, 0, { r: 0.45, lift: 2 });
    // пульт: ступени увеличения
    const cp = new T.Group(); at(cp, -26, 0, 32, g); cp.rotation.y = 0.3;
    at(box(30, 2, 9, C.WOOD2), 0, 1, 0, cp);
    h.button(cp, -7.5, 2, 0, '− ×10', 0x3a7bd5, 'z-', 12, 5);
    h.button(cp, 7.5, 2, 0, '+ ×10', 0xe0473a, 'z+', 12, 5);
    h.sign(g, 44, 26, 18, 'Конструктор →', 'st-build');
    // подписи
    kit.tag(v3(-34, 42, 2), 'Микроскоп', d.zoomTxt, d.zoomed);
    kit.tag(v3(sx, sy + RR + 4, sz), 'В окуляре', d.level, d.zoomed);
    kit.tag(v3(sx, sy - RR - 1, sz + 4), 'Черта', niceLen(Lb));
    kit.tag(v3(-26, 6, 32), 'Увеличение', 'поле ' + d.field);
    if (jig) kit.onFrame((dt, t) => jig(t));
  };

  function buildScene(kit, d) {
    const { T, at, box, cyl, mesh, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const spin = [];
    // ---- полка с целями ----
    const SY = 14, SZ = -30;
    at(box(96, 1.6, 13, C.WOOD2), 0, SY, SZ, g);
    for (const x of [-44, 44]) at(box(2.4, SY - 0.8, 11, C.WOOD2), x, (SY - 0.8) / 2, SZ, g);
    (d.targets || []).forEach((Tg, i) => {
      const x = -30 + i * 30, ok = d.built && d.built[Tg.id];
      at(cyl(5.2, 0.8, ok ? 0x86e0a8 : 0x3a4762, { seg: 32 }), x, SY + 1.2, SZ, g);
      if (ok) { const m = h.molModel(Tg.f, 1.25); at(m, x, SY + 6.5, SZ, g); spin.push(m); }
      else { const q = h.label(5, 5, '?', '#8b96ad', '#1a2438'); at(q, x, SY + 5, SZ, g); q.rotation.y = AZ * 0.6; }
      const pl = h.label(18, 3.4, Tg.sub + ' · ' + Tg.name + (ok ? ' ✓' : ''), ok ? '#0e2a18' : '#e8ecf4', ok ? '#86e0a8' : '#26324a');
      at(pl, x, SY - 0.2, SZ + 6.56, g);
    });
    // ---- стол сборки ----
    const BZ = 4;
    at(box(60, 1.4, 24, 0x26324a), 0, 0.7, BZ, g);
    for (const s of [-1, 1]) { at(box(60, 1.6, 1, 0x3a4762, { edges: false }), 0, 1.6, BZ + s * 11.5, g); at(box(1, 1.6, 24, 0x3a4762, { edges: false }), s * 29.5, 1.6, BZ, g); }
    const asm = d.asm || [];
    if (asm.length) {
      const n = asm.length;
      asm.forEach((e, k) => {
        const ag = new T.Group(); at(ag, (k - (n - 1) / 2) * 7.5, 1.4 + ATOM[e].r * 1.5, BZ, g);
        at(h.atom(e, 1.5), 0, 0, 0, ag); clickable(ag, 'r' + k);
        if (!kit.reduce) { const ph = k * 1.7; kit.onFrame((dt, t) => { ag.position.y = 1.4 + ATOM[e].r * 1.5 + 0.25 * Math.sin(t * 3 + ph); }); }
      });
    } else if (d.last) {
      const m = h.molModel(d.last.f, 1.7); at(m, 0, 7, BZ, g); spin.push(m);
    }
    // ---- запас атомов в мисках ----
    ['H', 'O', 'C'].forEach((e, i) => {
      const bg = new T.Group(); at(bg, -26 + i * 26, 0, 30, g); clickable(bg, 'a' + e);
      at(cyl(7.5, 3, 0x3b4a66, { r2: 9, seg: 32 }), 0, 1.5, 0, bg);
      const r = ATOM[e].r;
      [[0, 0], [-2.6, 1.4], [2.5, 1.2], [-1.2, -2.4], [1.8, -2.2]].forEach(([x, zz], k) => at(h.atom(e, 1), x * (r / 1.3), 3 + r + (k ? 0 : r * 0.9), zz * (r / 1.3), bg));
      const pl = h.label(10, 3, e + ' · ' + ATOM[e].name, '#e8ecf4', '#26324a'); at(pl, 0, 1.5, 9.1, bg);
    });
    // ---- кнопки ----
    const cp = new T.Group(); at(cp, 47, 0, 8, g); cp.rotation.y = -0.2;
    at(box(16, 2, 26, C.WOOD2), 0, 1, 0, cp);
    h.button(cp, 0, 2, -5.5, 'Соединить', 0xe08a2a, 'join', 13, 7);
    h.button(cp, 0, 2, 6, 'Очистить', 0x3a7bd5, 'clear', 13, 7);
    h.sign(g, -50, 14, 16, '← Микроскоп', 'st-zoom');
    // подписи
    kit.tag(v3(0, 16, -26), 'Собрано', (d.n || 0) + ' / 3', d.n === 3);
    kit.tag(v3(0, asm.length ? 9 : d.last ? 13 : 5, BZ), 'Стол сборки', asm.length ? 'на столе: ' + subF(d.f) : d.last ? d.last.sub + ' — ' + d.last.name : 'пусто');
    kit.tag(v3(0, 9, 32), 'Атомы', 'нажми — положить');
    if (spin.length && !kit.reduce) kit.onFrame((dt) => spin.forEach(m => { m.rotation.y += dt * 0.8; }));
  }

  // ===== 2. «Диффузия»: аквариум с перегородкой, марганцовка, термометр, секундомер, журнал =====
  SC['matter-diffusion'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const K = 0.17, Y0 = 4, ZC = -8, DZ = 22, W = 400 * K, HW = 250 * K;
    const X = x => (x - 230) * K, Y = y => Y0 + (330 - y) * K;
    // подставка и стеклянный аквариум
    at(box(W + 6, Y0, DZ + 6, 0x3a4762), 0, Y0 / 2, ZC, g);
    const gm = h.glassMat(0xd8eef8, 0.18), HG = HW + 8 * K + 1.5;
    at(mesh(new T.BoxGeometry(W + 0.8, 0.6, DZ + 0.8), 0, { mat: gm }), 0, Y0 + 0.3, ZC, g);
    for (const s of [-1, 1]) {
      at(mesh(new T.BoxGeometry(W + 0.8, HG, 0.4), 0, { mat: gm }), 0, Y0 + HG / 2, ZC + s * (DZ / 2 + 0.2), g);
      at(mesh(new T.BoxGeometry(0.4, HG, DZ + 0.8), 0, { mat: gm }), s * (W / 2 + 0.2), Y0 + HG / 2, ZC, g);
    }
    // вода: две половины, цвет — сколько в них краски
    const wl = new T.MeshToonMaterial({ color: 0x5fb4d9, gradientMap: kit.grad, transparent: true, opacity: 0.22, depthWrite: false }), wr = wl.clone();
    keep(wl); keep(wr);
    at(new T.Mesh(keep(new T.BoxGeometry(W / 2 - 0.1, HW, DZ - 0.2)), wl), -W / 4, Y0 + HW / 2 + 0.6, ZC, g);
    at(new T.Mesh(keep(new T.BoxGeometry(W / 2 - 0.1, HW, DZ - 0.2)), wr), W / 4, Y0 + HW / 2 + 0.6, ZC, g);
    const sfc = new T.Mesh(keep(new T.PlaneGeometry(W - 0.2, DZ - 0.2)), keep(new T.MeshBasicMaterial({ color: 0x9fd8f0, transparent: true, opacity: 0.25, depthWrite: false })));
    sfc.rotation.x = -Math.PI / 2; at(sfc, 0, Y0 + HW + 0.6, ZC, g);
    // перегородка: стоит в аквариуме или лежит на столе
    const pg = new T.Group(); clickable(pg, 'wall');
    at(box(0.6, HG + 3, DZ - 0.4, 0xc8d1e2, { matOpt: { transparent: true, opacity: 0.75 } }), 0, (HG + 3) / 2, 0, pg);
    at(box(5, 2, 3, 0xffb547), 0, HG + 4, 0, pg);
    if (d.wall) at(pg, 0, Y0, ZC, g);
    else { at(pg, 24, 0.7, -36, g); pg.rotation.z = Math.PI / 2; }
    // частицы: краска (фиолетовые) и вода (голубые), координаты — из опыта
    const geo = keep(new T.SphereGeometry(1, 12, 8));
    const L0 = live(), P0 = L0.p2 || [];
    const nD = Math.max(1, d.nDye || 140), nW = Math.max(1, d.nWater || 200);
    const dM = new T.InstancedMesh(geo, h.ownMat(0xc26be8), nD), wM = new T.InstancedMesh(geo, h.ownMat(0x9fd3ee, { transparent: true, opacity: 0.6, depthWrite: false }), nW);
    dM.castShadow = false; wM.castShadow = false; dM.frustumCulled = wM.frustumCulled = false; at(dM, 0, 0, 0, g); at(wM, 0, 0, 0, g);
    const m4 = new T.Matrix4(), q = new T.Quaternion(), s1 = new T.Vector3(), pv = new T.Vector3();
    const purple = new T.Color(0x9a3fd0), blue = new T.Color(0x5fb4d9);
    // термометр в правом заднем углу, пар над горячей водой
    h.thermo(g, W / 2 - 3, Y0 + 2, ZC - DZ / 2 + 3, HW + 4, 0, 100, d.T);
    const steam = [];
    if (d.T >= 40 && !kit.reduce) for (let i = 0; i < (d.T >= 60 ? 7 : 3); i++) { const s = h.glow(0xeef6ff, 7, 0.22); at(s, 0, 0, 0, g); steam.push({ s, ph: i / 7, x: (hash(i, 1, 2) - 0.5) * W * 0.8, z: ZC + (hash(i, 3, 4) - 0.5) * DZ * 0.6 }); }
    // пульт температуры
    const tp = new T.Group(); at(tp, -40, 0, 28, g); tp.rotation.y = 0.3;
    const temps = d.temps || [];
    at(box(temps.length * 8 + 4, 2, 9, C.WOOD2), 0, 1, 0, tp);
    temps.forEach((t, i) => h.button(tp, (i - (temps.length - 1) / 2) * 8, 2, 0, tC(t), t === d.T ? 0xe0473a : 0x3b4a66, 'T2-' + t, 7, 5));
    // секундомер и счётчик краски справа
    const sw = new T.Group(); at(sw, 34, 0, 28, g); sw.rotation.y = -0.3;
    at(box(26, 1.6, 16, C.DARK), 0, 0.8, 0, sw);
    const bd = new T.Group(); at(bd, 0, 1.6, -3, sw); bd.rotation.x = -0.42;
    at(box(24, 10, 3, 0x3b4a66), 0, 5, 0, bd);
    const scr = h.screen(21, 8, '', '#ffd166', 400, 150); at(scr, 0, 5, 1.56, bd);
    at(box(20, 0.6, 2.4, 0x1a2438, { edges: false }), 0, 1.9, 3.5, sw);
    const bar = box(1, 0.7, 2.2, 0xc26be8, { edges: false, shadow: false }); at(bar, -10, 2.05, 3.5, sw);
    at(box(0.4, 1.4, 3, 0xffb547, { edges: false, shadow: false }), -10 + 20 * (d.goal / 100) / 0.5, 2.3, 3.5, sw);
    h.button(sw, -6, 1.6, 6.3, d.wall ? 'Убрать' : 'Убрана', d.wall ? 0xe08a2a : 0x3a4762, 'open', 9, 3);
    h.button(sw, 6, 1.6, 6.3, 'Заново', 0x3a7bd5, 'again', 9, 3);
    // журнал опытов
    const runs = d.runs || [];
    const nb = h.screen(18, 13, ['Журнал', ...(runs.length ? runs.map(r => `${tC(r.T)} — ${fmt(r.t, 1)} с`) : ['опытов нет'])].slice(0, 5).join('\n'), '#2a2018', 260, 190, '#f4efe2');
    nb.rotation.x = -Math.PI / 2; nb.rotation.z = 0.12; at(nb, 4, 0.12, 32, g);
    at(box(19, 0.2, 14, 0x8a6a3c, { edges: false }), 4, 0.02, 32, g).rotation.y = -0.12;
    // подписи
    kit.tag(v3(-W / 4, Y0 + HG + 5, ZC), 'Марганцовка', d.wall ? 'за перегородкой' : 'расходится сама');
    if (d.wall) kit.tag(v3(0, Y0 + HG + 8, ZC), 'Перегородка', 'нажми — убрать', true);
    kit.tag(v3(W / 2 - 3, Y0 + HW + 9, ZC - DZ / 2 + 3), 'Вода', tC(d.T), d.T <= d.tCold || d.T >= d.tHot);
    const gTag = liveTag(kit, v3(34, 14, 26), 'Краска справа', '0 %');
    kit.tag(v3(-40, 6, 28), 'Опыты', `холодная ${d.cold ? '✓' : '—'} · горячая ${d.hot ? '✓' : '—'}`, d.cold && d.hot);
    // анимация
    const pose = (dt, t) => {
      const Lv = live(), P = Lv.p2 || P0;
      let di = 0, wi = 0, dl = 0, dr = 0;
      for (let i = 0; i < P.length; i++) {
        const p = P[i];
        pv.set(X(p.x), Y(p.y), ZC + (hash(i, 7, 1) - 0.5) * (DZ - 3));
        if (p.d) { if (di >= nD) continue; s1.setScalar(0.62); m4.compose(pv, q, s1); dM.setMatrixAt(di++, m4); if (p.x > 230) dr++; else dl++; }
        else { if (wi >= nW) continue; s1.setScalar(0.42); m4.compose(pv, q, s1); wM.setMatrixAt(wi++, m4); }
      }
      dM.count = di; wM.count = wi; dM.instanceMatrix.needsUpdate = true; wM.instanceMatrix.needsUpdate = true;
      const tot = Math.max(1, dl + dr), fl = dl / tot, fr = dr / tot;
      wl.color.copy(blue).lerp(purple, 0.75 * fl); wr.color.copy(blue).lerp(purple, 0.75 * fr);
      wl.opacity = 0.18 + 0.2 * fl; wr.opacity = 0.18 + 0.2 * fr;
      const frac = Lv.frac != null ? Lv.frac : fr, tt = Lv.t || 0;
      bar.scale.x = Math.max(0.01, 20 * clamp(frac / 0.5, 0, 1)); bar.position.x = -10 + bar.scale.x / 2;
      const done = frac >= d.goal / 100 && !Lv.wall;
      scr.userData.set(`справа ${fmt(frac * 100, 0)} %\n${Lv.wall ? 't = —' : 't = ' + fmt(tt, 1) + ' с'}`, done || d.mixed ? '#86e0a8' : '#ffd166');
      gTag.set(fmt(frac * 100, 0) + ' %', d.mixed);
      steam.forEach(o => { const u = (t * 0.35 + o.ph) % 1; o.s.position.set(o.x + Math.sin(t + o.ph * 9) * 1.5, Y0 + HG + 1 + u * 12, o.z); o.s.material.opacity = 0.25 * (1 - u) * (d.T >= 60 ? 1 : 0.6); });
    };
    pose(0, 0); kit.onFrame(pose);
  };

  // ===== 3. «Твёрдое, жидкое, газ»: сосуд с поршнем на плитке, молекулы, термометр, второй сосуд =====
  SC['matter-states'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const K = 0.16, YP = 3.2, YB = YP + 0.6, ZC = -6, DZ = 13, TOP = 90, BOT = 340, R0 = 6.5 * K;
    const a = d.a, b = d.b, CXp = (a + b) / 2;
    const X = x => (x - CXp) * K, Y = y => YB + (BOT - y) * K;
    const WV = (b - a) * K, HV = (BOT - 70) * K;
    const s = d.s;
    // плитка: греет или охлаждает
    const pl = new T.Group(); at(pl, 0, 0, ZC, g); clickable(pl, 'tcyc');
    at(box(WV + 8, YP, DZ + 8, 0x2a3348), 0, YP / 2, 0, pl);
    const heat = clamp((d.T - 20) / 130, 0, 1), cold = clamp(-d.T / 30, 0, 1);
    const topCol = heat > 0 ? new T.Color(0x5a3a2a).lerp(new T.Color(0xff8a3d), 0.3 + 0.7 * heat) : cold > 0 ? new T.Color(0x3a4a5a).lerp(new T.Color(0x9fd8ff), 0.3 + 0.7 * cold) : new T.Color(0x4a5468);
    at(mesh(new T.BoxGeometry(WV + 4, 0.4, DZ + 4), 0, { mat: h.ownMat(topCol, heat > 0 ? { emissive: 0xff5a1a, emissiveIntensity: 0.5 * heat } : cold > 0 ? { emissive: 0x6ab8ff, emissiveIntensity: 0.3 * cold } : {}), edges: false }), 0, YP + 0.2, 0, pl);
    if (heat > 0.05) at(h.glow(0xff8a3c, WV + 10, 0.25 + 0.35 * heat), 0, YP + 1, 0, pl);
    if (cold > 0.05) at(h.glow(0x9fd8ff, WV + 10, 0.2 + 0.3 * cold), 0, YP + 1, 0, pl);
    at(box(3, 1.4, 1.4, heat > 0 ? 0xe0473a : cold > 0 ? 0x3a7bd5 : 0x8b96ad), WV / 2 + 2.2, YP / 2, DZ / 2 + 4.3, pl);
    // стеклянный сосуд
    const gm = h.glassMat(0xd8eef8, 0.2);
    at(mesh(new T.BoxGeometry(WV + 0.8, 0.6, DZ + 0.8), 0, { mat: gm }), 0, YB - 0.3, ZC, g);
    for (const sg of [-1, 1]) {
      at(mesh(new T.BoxGeometry(WV + 0.8, HV, 0.4), 0, { mat: gm }), 0, YB + HV / 2, ZC + sg * (DZ / 2 + 0.2), g);
      at(mesh(new T.BoxGeometry(0.4, HV, DZ + 0.8), 0, { mat: gm }), sg * (WV / 2 + 0.2), YB + HV / 2, ZC, g);
    }
    // шкала высоты на передней стенке
    for (let k = 0; k <= 10; k++) at(box(k % 5 ? 0.9 : 1.8, 0.14, 0.1, 0x6f8098, { edges: false, shadow: false }), -WV / 2 + 1.6, Y(BOT - (BOT - TOP) * k / 10), ZC + DZ / 2 + 0.45, g);
    // поршень со штоком и рукояткой — едет вместе с опытом
    const pis = new T.Group(); at(pis, 0, 0, ZC, g); clickable(pis, 'piston');
    at(box(WV - 0.5, 12 * K, DZ - 0.5, 0x8a96b0), 0, 12 * K / 2, 0, pis);
    at(box(WV - 0.3, 0.5, DZ - 0.3, 0x3a3f4c, { edges: false }), 0, 0.25, 0, pis);
    const ROD = 11; at(cyl(0.8, ROD, C.STEEL, { edges: false }), 0, 12 * K + ROD / 2, 0, pis);
    at(box(14, 2.4, 3.4, 0xffb547), 0, 12 * K + ROD + 1.2, 0, pis);
    // молекулы
    const N = 60, geo = keep(new T.SphereGeometry(1, 16, 10));
    const molCol = s === 'solid' ? 0xbfe6ff : s === 'gas' ? 0x9fd3ee : 0x5fb4d9;
    const mM = new T.InstancedMesh(geo, h.ownMat(molCol), N); mM.castShadow = false; mM.frustumCulled = false; at(mM, 0, 0, 0, g);
    const bondGeo = keep(new T.BufferGeometry()); const bondPos = new Float32Array(N * 4 * 3);
    bondGeo.setAttribute('position', new T.BufferAttribute(bondPos, 3));
    const bonds = new T.LineSegments(bondGeo, keep(new T.LineBasicMaterial({ color: 0x72d4e8, transparent: true, opacity: 0.55 })));
    bonds.visible = s === 'solid'; bonds.frustumCulled = false; at(bonds, 0, 0, 0, g);
    const zs = [], zt = i => s === 'solid' ? ZC : ZC + (hash(i, 5, 9) - 0.5) * (DZ - 2 * R0 - 0.8);
    for (let i = 0; i < N; i++) zs.push(zt(i));
    const m4 = new T.Matrix4(), q = new T.Quaternion(), s1 = new T.Vector3(R0, R0, R0), pv = new T.Vector3();
    // второй сосуд: «перелить» в другой
    const ow = (d.wide ? 180 : 300) * K, ox = WV / 2 + ow / 2 + 9;
    const og = new T.Group(); at(og, ox, 0, ZC + 4, g); clickable(og, 'vessel');
    at(box(ow + 3, 1, DZ + 3, 0x3a4762), 0, 0.5, 0, og);
    at(mesh(new T.BoxGeometry(ow + 0.8, 0.6, DZ + 0.8), 0, { mat: gm }), 0, 1.3, 0, og);
    for (const sg of [-1, 1]) {
      at(mesh(new T.BoxGeometry(ow + 0.8, HV * 0.7, 0.4), 0, { mat: gm }), 0, 1.6 + HV * 0.35, sg * (DZ / 2 + 0.2), og);
      at(mesh(new T.BoxGeometry(0.4, HV * 0.7, DZ + 0.8), 0, { mat: gm }), sg * (ow / 2 + 0.2), 1.6 + HV * 0.35, 0, og);
    }
    // термометр и пульт температуры
    h.thermo(g, -WV / 2 - 9, 0.5, ZC - 2, 34, -30, 150, d.T);
    const tp = new T.Group(); at(tp, -30, 0, 26, g); tp.rotation.y = 0.3;
    const temps = d.temps || [];
    at(box(temps.length * 12 + 4, 2, 9, C.WOOD2), 0, 1, 0, tp);
    const nm = t => t < 0 ? 'лёд' : t < 100 ? 'вода' : 'пар';
    temps.forEach((t, i) => h.button(tp, (i - (temps.length - 1) / 2) * 12, 2, 0, nm(t) + ' ' + tC(t), t === d.T ? 0xe0473a : 0x3b4a66, 'T3-' + t, 11, 5));
    const bp = new T.Group(); at(bp, 22, 0, 30, g); bp.rotation.y = -0.25;
    at(box(26, 2, 9, C.WOOD2), 0, 1, 0, bp);
    h.button(bp, -6.5, 2, 0, '▼ нажать', 0xe08a2a, 'push', 11, 5);
    h.button(bp, 6.5, 2, 0, '▲ отпустить', 0x3a7bd5, 'lift', 11, 5);
    // подписи
    const SN = { solid: 'Лёд', liquid: 'Вода', gas: 'Пар' }, SN2 = { solid: 'твёрдое · форма своя', liquid: 'жидкое · форма сосуда', gas: 'газ · весь сосуд' };
    kit.tag(v3(-WV / 2 - 2, YB + 8, ZC + DZ / 2), SN[s] + ' · ' + tC(d.T), SN2[s], true);
    const pTag = liveTag(kit, v3(0, YB + HV + 18, ZC), 'Поршень', 'поднят');
    kit.tag(v3(ox, HV * 0.7 + 5, ZC + 4), 'Другой сосуд', d.wide ? 'узкий · перелить' : 'широкий · перелить');
    const chk = ['solid', 'liquid', 'gas'].map(x => `${SN[x].toLowerCase()} ${d.press && d.press[x] ? '✓' : '—'}${d.pour && d.pour[x] ? '✓' : '—'}`).join(' · ');
    kit.tag(v3(-30, 7, 26), 'Сжать · перелить', chk, ['solid', 'liquid', 'gas'].every(x => d.press && d.press[x] && d.pour && d.pour[x]));
    // анимация
    const pose = (dt) => {
      const Lv = live(), P = Lv.p3 || [], py = Lv.py != null ? Lv.py : TOP;
      pis.position.y = Y(py);
      const n = Math.min(N, P.length);
      const kz = kit.reduce ? 1 : Math.min(1, (dt || 0) * 4);
      for (let i = 0; i < n; i++) {
        zs[i] += (zt(i) - zs[i]) * (dt ? kz : 1);
        pv.set(X(P[i].x), Y(P[i].y), zs[i]); m4.compose(pv, q, s1); mM.setMatrixAt(i, m4);
      }
      mM.count = n; mM.instanceMatrix.needsUpdate = true;
      if (bonds.visible) {
        let k = 0;
        for (let i = 0; i < n; i++) for (const j of [i + 1, i + 7]) {
          if (j >= n || (j === i + 1 && j % 7 === 0)) continue;
          bondPos[k++] = X(P[i].x); bondPos[k++] = Y(P[i].y); bondPos[k++] = zs[i];
          bondPos[k++] = X(P[j].x); bondPos[k++] = Y(P[j].y); bondPos[k++] = zs[j];
        }
        bondGeo.setDrawRange(0, k / 3); bondGeo.attributes.position.needsUpdate = true;
      }
      const down = py > TOP + 2, atLim = Lv.lim != null && py >= Lv.lim - 0.8;
      pTag.set(s === 'gas' ? (down ? 'газ сжат в ' + fmt(Lv.ratio || 1, 1) + ' раза' : 'поднят') : atLim ? 'дальше не сжимается' : down ? 'давит' : 'поднят', s === 'gas' ? (Lv.ratio || 1) >= 2 : atLim);
    };
    pose(0); kit.onFrame(pose);
  };
})();
