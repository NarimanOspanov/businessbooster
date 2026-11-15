// «Как в жизни» для темы «Температура и теплопередача» (labs/phys-temp):
// воздушное огниво (стеклянный цилиндр с поршнем, молекулы, горелка, вата), два стержня на горячем бруске
// с кнопками на воске, макет комнаты с батареей и потоками воздуха, лампа с двумя банками и термометрами.
// Сцены строятся из window.LUCH_REAL() опыта; быстрые значения (температуры, время) — из LUCH_REAL.live() в onFrame.
(() => {
  const SC = window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {};
  const live = () => { try { return (window.LUCH_REAL && window.LUCH_REAL.live && window.LUCH_REAL.live()) || {}; } catch (e) { return {}; } };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (x, n = 0) => { let s = (Math.round(x * 10 ** n) / 10 ** n).toFixed(n); if (/^-0(\.0+)?$/.test(s)) s = s.slice(1); return s.replace('.', ',').replace('-', '−'); };
  const deg = x => fmt(x, 0) + ' °C';
  const rnd = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const smooth = t => t * t * (3 - 2 * t);
  const mem = {};                     // что было до перестройки сцены (положение поршня, молекулы)
  // цвет температуры, как на схеме: синий → голубой → янтарный → красный
  const STOPS = [[74, 143, 224], [114, 212, 232], [255, 181, 71], [255, 90, 60]];
  const tcol = (T, t, lo, hi) => {
    const u = clamp((t - lo) / (hi - lo), 0, 1) * (STOPS.length - 1), i = Math.min(STOPS.length - 2, Math.floor(u)), f = u - i;
    const c = STOPS[i].map((v, k) => (v + (STOPS[i + 1][k] - v) * f) / 255);
    return new T.Color(c[0], c[1], c[2]).convertSRGBToLinear();
  };
  // подпись, у которой значение меняется каждый кадр (без перестройки сцены)
  const lastTag = () => { const l = document.querySelectorAll('.rl-view .rl-lbl'); return l[l.length - 1] || null; };
  function liveTag(kit, p, name, value, hot) {
    kit.tag(p, name, value, hot);
    const el = lastTag(), i = el && el.querySelector('i');
    let shown = value, hs = !!hot;
    return { p, set(v, h) { if (i && v !== shown) { shown = v; i.textContent = v; } if (el && h != null && !!h !== hs) { hs = !!h; el.classList.toggle('hot', hs); } } };
  }

  // ---------- общие детали ----------
  function H(kit) {
    const { T, at, box, cyl, mesh, keep, grad, glowTex, textTex, clickable, toon, C } = kit;
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    const glassMat = (color = 0xd8eef8, opacity = 0.26) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, transparent: true, opacity, side: T.DoubleSide, depthWrite: false }));
    const ownMat = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, ...o }));
    const spr = (map, color, opacity, add) => new T.Sprite(keep(new T.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending })));
    const glow = (color, size, opacity) => { const s = spr(glowTex(), color, opacity, true); s.scale.setScalar(size); return s; };
    const flat = (w, h, tex) => new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: keep(tex), transparent: true })));
    const label = (w, h, txt, fg = '#1b1610', bg = '#fff6e6') => flat(w, h, textTex(txt, fg, bg, Math.round(64 * w / h), 64));
    function rodAB(parent, a, b, r, color, o = {}) {
      const dv = b.clone().sub(a), L = dv.length();
      const m = cyl(r, L, color, { edges: false, ...o });
      m.quaternion.setFromUnitVectors(v3(0, 1, 0), dv.normalize());
      return at(m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, parent);
    }
    // табло: текст можно менять каждый кадр (строки через \n)
    function screen(w, h, txt, fg = '#86e0a8', pw = 320, ph = 120) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph; const x = c.getContext('2d');
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace;
      let cur = null;
      const set = (t, col = fg) => {
        t = String(t); if (cur === t + col) return; cur = t + col;
        x.fillStyle = '#0e1520'; x.fillRect(0, 0, pw, ph); x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle';
        const lines = t.split('\n'), lh = ph / lines.length;
        lines.forEach((ln, i) => {
          let fs = Math.round(lh * 0.64); x.font = `600 ${fs}px "IBM Plex Mono", monospace`;
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
    function button(parent, x, y, z, txt, color, key, w = 4.2) {
      const b = new T.Group(); at(b, x, y, z, parent);
      at(box(w, 1.4, 3.6, color), 0, 0.7, 0, b);
      const top = flat(w * 0.86, 2.9, textTex(txt, '#ffffff', '#' + color.toString(16).padStart(6, '0'), Math.round(96 * w / 3.6), 96));
      top.rotation.x = -Math.PI / 2; at(top, 0, 1.42, 0, b);
      clickable(b, key); return b;
    }
    // пламя: капля-спрайт, внутри светлое ядро; колышется
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
    function flame(parent, x, y, z, hgt, inner, outer, glowCol, light = 40) {
      const g = new T.Group(); at(g, x, y, z, parent);
      const s = spr(flameTex(inner, outer), 0xffffff, 0.94, false); s.center.set(0.5, 0.04); s.scale.set(hgt * 0.5, hgt, 1); at(s, 0, 0, 0, g);
      at(glow(glowCol, hgt * 2.4, 0.5), 0, hgt * 0.35, 0, g);
      if (light) at(new T.PointLight(glowCol, light, 60, 1.3), 0, hgt * 0.5, 0, g);
      if (!kit.reduce) kit.onFrame((dt, t) => { const f = 1 + 0.13 * Math.sin(t * 13) + 0.06 * Math.sin(t * 29); s.scale.set(hgt * 0.5 * (1 + 0.08 * Math.sin(t * 17)), hgt * f, 1); });
      return g;
    }
    // газовая горелка Бунзена: подставка, трубка, муфта, шланг
    function bunsen(parent, x, z, on) {
      const g = new T.Group(); at(g, x, 0, z, parent);
      at(cyl(4, 1.2, C.DARK, { seg: 24 }), 0, 0.6, 0, g);
      at(cyl(1.0, 7.4, C.STEEL, { seg: 16 }), 0, 4.9, 0, g);
      at(cyl(1.45, 1.8, C.BRASS, { seg: 16 }), 0, 2.6, 0, g);
      const hose = cyl(0.7, 4, C.STEEL, { seg: 12 }); hose.rotation.z = Math.PI / 2; at(hose, -2.6, 2, 0, g);
      at(cyl(1.2, 0.5, C.DARK, { seg: 16 }), 0, 8.6, 0, g);
      if (on) flame(g, 0, 8.9, 0, 5, '#d8f0ff', '#4a9cff', 0x6ab0ff);
      return { g, top: 8.9 };
    }
    // стеклянный термометр: шарик, столбик, шкала (к зрителю), зелёная метка цели
    function thermo(parent, x, y0, z, len, lo, hi, v, o = {}) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      at(new T.Mesh(keep(new T.SphereGeometry(1.0, 16, 12)), toon(0xe0473a)), 0, 0, 0, g);
      at(cyl(0.72, len, 0xeef6fb, { matOpt: { transparent: true, opacity: 0.55 } }), 0, len / 2 + 0.5, 0, g);
      at(box(1.05, len - 1.6, 0.1, 0xfffaf0, { edges: false, shadow: false }), 0, len / 2 + 0.7, -0.34, g);
      const col = cyl(0.3, 1, 0xe0473a, { edges: false, hull: false, shadow: false }); at(col, 0, 1, 0.05, g);
      const span = len - 2.2, n = Math.round((hi - lo) / 10);
      for (let k = 0; k <= n; k++) at(box(k % 5 === 0 ? 1.2 : 0.7, 0.13, 0.1, 0x1b1610, { edges: false, shadow: false }), 0.36, 1.1 + span * k / n, 0.64, g);
      if (o.mark != null) at(box(1.9, 0.3, 0.4, 0x2fbf5a, { edges: false, shadow: false }), 0, 1.1 + span * (o.mark - lo) / (hi - lo), 0.55, g);
      const set = t => { const f = clamp((t - lo) / (hi - lo), 0, 1), hh = 0.3 + span * f; col.scale.y = hh; col.position.y = 0.8 + hh / 2; };
      set(v); return { g, set, top: y0 + len + 1 };
    }
    // прозрачная стрелка (поток воздуха)
    function arrow(parent, x, y, z, len, color, down) {
      const g = new T.Group(); at(g, x, y, z, parent);
      const mo = { edges: false, hull: false, shadow: false, matOpt: { transparent: true, opacity: 0.55, depthWrite: false, emissive: color, emissiveIntensity: 0.4 } };
      at(cyl(0.7, len - 3, color, mo), 0, (len - 3) / 2, 0, g);
      at(cyl(1.9, 3, color, { ...mo, r2: 0.01 }), 0, len - 1.5, 0, g);
      if (down) g.rotation.z = Math.PI;
      return g;
    }
    return { v3, glassMat, ownMat, spr, glow, flat, label, rodAB, screen, button, flame, bunsen, thermo, arrow };
  }

  // ===== 1. «Внутренняя энергия»: воздушное огниво на треножнике над горелкой, молекулы, вата, термометр =====
  SC['temp-inner'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, clickable, cable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const CX = -2, CZ = -4, R = 8, Y0 = 13, HG = 24;            // цилиндр: внутреннее дно Y0 + 0.8, полный объём — 24 ед.
    const yb = Y0 + 0.8;
    // треножник
    const ringY = Y0 - 0.6, ring = mesh(new T.TorusGeometry(R + 2.4, 0.6, 8, 40), 0x3a3f4c, { edges: false, hull: true }); ring.rotation.x = Math.PI / 2; at(ring, CX, ringY, CZ, g);
    for (const a of [Math.PI / 6, Math.PI * 5 / 6, Math.PI * 1.5]) h.rodAB(g, v3(CX + Math.cos(a) * (R + 2.4), ringY, CZ + Math.sin(a) * (R + 2.4)), v3(CX + Math.cos(a) * (R + 9), 0.3, CZ + Math.sin(a) * (R + 9)), 0.6, 0x3a3f4c);
    // горелка
    const bn = h.bunsen(g, CX, CZ, d.burner); clickable(bn.g, 'burn');
    at(cyl(2, 0.5, C.DARK), CX - 12, 0.25, CZ + 2, g);
    cable(v3(CX - 4.6, 2, CZ), v3(CX - 12, 1, CZ + 2), 0xd0603a, 0, { r: 0.6, lift: 0.5 });
    // цилиндр: металлическое дно, толстое стекло, верхнее кольцо
    at(cyl(R + 1.2, 1.6, C.STEEL, { seg: 32 }), CX, Y0, CZ, g);
    const wall = new T.Mesh(keep(new T.CylinderGeometry(R + 0.6, R + 0.6, HG + 3, 40, 1, true)), h.glassMat(0xd8eef8, 0.22)); at(wall, CX, yb + (HG + 3) / 2, CZ, g);
    for (const yy of [yb + 0.2, yb + (HG + 3) / 2]) { const rg = mesh(new T.TorusGeometry(R + 0.62, 0.2, 5, 40), 0xc9dbe6, { edges: false }); rg.rotation.x = Math.PI / 2; at(rg, CX, yy, CZ, g); }
    const topR = mesh(new T.TorusGeometry(R + 0.7, 0.5, 8, 40), C.STEEL, { edges: false, hull: true }); topR.rotation.x = Math.PI / 2; at(topR, CX, yb + HG + 3, CZ, g);
    // шкала объёма на стекле (к зрителю): V₀, V₀/2, 0
    for (let k = 0; k <= 10; k++) at(box(k % 5 ? 0.9 : 1.8, 0.16, 0.1, 0x6f8098, { edges: false, shadow: false }), CX - 3.2, yb + HG * k / 10, CZ + R + 0.68, g);
    [[1, 'V₀'], [0.5, 'V₀/2']].forEach(([f, t]) => { const l = h.label(3.6, 1.5, t, '#1b1610', '#e8f2f8'); at(l, CX - 6.4, yb + HG * f, CZ + R + 0.9, g); });
    // газ: подкрашенный столб (цвет — температура)
    const gasMat = h.ownMat(0x72d4e8, { transparent: true, opacity: 0.16, depthWrite: false });
    const gas = new T.Mesh(keep(new T.CylinderGeometry(R - 0.1, R - 0.1, 1, 36)), gasMat); at(gas, CX, yb, CZ, g);
    // вата на дне и огонёк, если вспыхнула
    const cot = new T.Group(); at(cot, CX, yb, CZ, g);
    for (let i = 0; i < 6; i++) { const b = mesh(new T.IcosahedronGeometry(1.1 + rnd(i) * 0.5, 1), 0xf2efe6, { edges: false, hull: true }); b.scale.y = 0.6; at(b, (rnd(i + 4) - 0.5) * 4, 0.6, (rnd(i + 8) - 0.5) * 4, cot); }
    const fire = d.fire ? h.flame(g, CX, yb + 0.8, CZ, 7, '#ffe9a0', '#ff7a1a', 0xff8a3c, 30) : null;
    // поршень: резиновое уплотнение, шток, рукоятка
    const pis = new T.Group(); at(pis, CX, 0, CZ, g); clickable(pis, 'V-');
    at(cyl(R - 0.05, 2.2, 0x8b96ad, { seg: 32 }), 0, 1.1, 0, pis);
    at(cyl(R + 0.02, 0.7, 0x3a3f4c, { seg: 32, edges: false }), 0, 0.5, 0, pis);
    const ROD = HG + 4; at(cyl(0.85, ROD, C.STEEL, { edges: false }), 0, 2.2 + ROD / 2, 0, pis);
    const hdl = box(20, 2.8, 3.4, 0xffb547); at(hdl, 0, 2.2 + ROD + 1.4, 0, pis);
    for (const s of [-1, 1]) at(cyl(1.6, 3.6, 0xffb547, { seg: 16 }), s * 10, 2.2 + ROD + 1.4, 0, pis).rotation.x = Math.PI / 2;
    // молекулы воздуха: бегают тем быстрее, чем выше температура
    const N = 24, mGeo = keep(new T.SphereGeometry(0.85, 12, 8)), mMat = h.ownMat(0xffb547);
    if (!mem.mol) mem.mol = Array.from({ length: N }, (_, i) => { const a = rnd(i + 50) * Math.PI * 2, r = Math.sqrt(rnd(i + 70)) * (R - 1.2), u = rnd(i + 90) * Math.PI * 2, w = rnd(i + 110) * 2 - 1; return { x: Math.cos(a) * r, z: Math.sin(a) * r, y: 0.08 + rnd(i + 30) * 0.84, vx: Math.cos(u) * Math.sqrt(1 - w * w), vy: w, vz: Math.sin(u) * Math.sqrt(1 - w * w) }; });
    const mols = mem.mol.map(m => { const s = new T.Mesh(mGeo, mMat); s.castShadow = false; at(s, CX, yb, CZ, g); return s; });
    // цифровой термометр с щупом в цилиндре
    const tg = new T.Group(); at(tg, 28, 0, 14, g); tg.rotation.y = -0.35;
    at(box(22, 7, 13, 0xf2c94c), 0, 3.5, 0, tg);
    const tScr = h.screen(19, 5.6, '', '#86e0a8', 320, 130); at(tScr, 0, 3.6, 6.56, tg);
    at(box(19, 0.6, 2, 0x2c3240), 0, 7.3, -4, tg);
    tg.updateMatrixWorld(true);
    at(cyl(0.9, 2.4, C.DARK, { seg: 12 }), CX + R + 1.6, Y0, CZ + 1, g).rotation.z = Math.PI / 2;
    cable(v3(0, 7, -5).applyMatrix4(tg.matrixWorld), v3(CX + R + 2.8, Y0, CZ + 1), 0x2a2f3a, 0, { r: 0.5, lift: 3 });
    // пульт: сжать / отпустить, таблички способов
    const cp = new T.Group(); at(cp, -34, 0, 18, g); cp.rotation.y = 0.25;
    at(box(28, 2.2, 10, C.WOOD2), 0, 1.1, 0, cp);
    h.button(cp, -6.5, 2.2, 0, '▼ сжать', 0xe0473a, 'V-', 12);
    h.button(cp, 6.5, 2.2, 0, '▲ отпустить', 0x3a7bd5, 'V+', 12);
    const fl = new T.Group(); at(fl, -4, 0, 36, g); fl.rotation.y = 0.2;
    [['работой', d.byA, d.usedA], ['теплопередачей', d.byQ, d.usedQ]].forEach(([t, ok, used], i) => {
      const x = i ? 12 : -12;
      at(box(22, 1.2, 7.5, 0x3b4a66), x, 0.6, 0, fl);
      const pl = h.label(19, 5.2, (ok ? '✓ ' : '') + t, ok ? '#0e2a18' : '#e8ecf4', ok ? '#86e0a8' : used ? '#5a4a26' : '#26324a'); pl.rotation.x = -Math.PI / 2; at(pl, x, 1.22, 0, fl);
    });
    // подписи
    const tTag = liveTag(kit, v3(28, 10, 14), 'Термометр', '20 °C');
    kit.tag(v3(CX - 15, 36, CZ), 'Воздух под поршнем', 'V = ' + fmt(d.V, 2).replace(/,?0+$/, '') + ' V₀');
    kit.tag(v3(CX - 16, 9, CZ + 8), 'Горелка', d.burner ? 'горит' : 'выкл', d.burner);
    kit.tag(v3(-4, 4, 33), 'Нагрели до ' + d.tNeed + ' °C', 'двумя способами');
    // анимация: поршень едет к новому объёму, молекулы летают, цвет газа — температура
    const V0 = mem.V != null ? mem.V : d.V, t0 = performance.now() / 1000; mem.V = V0;
    let lastT = null;
    const pose = (dt, t) => {
      const Lv = live(), tc = Lv.t ?? 20;
      const k = kit.reduce ? 1 : clamp((performance.now() / 1000 - t0) / 0.35, 0, 1), V = V0 + (d.V - V0) * smooth(k); mem.V = V;
      const hg = HG * V;
      gas.scale.y = hg; gas.position.y = yb + hg / 2;
      pis.position.y = yb + hg;
      const col = tcol(T, tc, 0, 450); gasMat.color.copy(col); mMat.color.copy(col);
      const sp = 9 * Math.sqrt((tc + 273) / 293) * (kit.reduce ? 0 : 1);
      mem.mol.forEach((m, i) => {
        if (dt) {
          m.x += m.vx * sp * dt; m.z += m.vz * sp * dt; m.y += m.vy * sp * dt / Math.max(4, hg);
          const rr = Math.hypot(m.x, m.z), lim = R - 1.3;
          if (rr > lim) { const nx = m.x / rr, nz = m.z / rr, dot = m.vx * nx + m.vz * nz; if (dot > 0) { m.vx -= 2 * dot * nx; m.vz -= 2 * dot * nz; } m.x = nx * lim; m.z = nz * lim; }
          if (m.y < 0.03) { m.y = 0.03; m.vy = Math.abs(m.vy); } if (m.y > 0.97) { m.y = 0.97; m.vy = -Math.abs(m.vy); }
        }
        mols[i].position.set(CX + m.x, yb + 0.7 + m.y * Math.max(0.2, hg - 1.4), CZ + m.z);
      });
      if (fire) fire.visible = tc > 120;
      const tr = Math.round(tc);
      if (tr !== lastT) { lastT = tr; tScr.userData.set(deg(tc) + '\n' + fmt(tc + 273, 0) + ' К', tc >= d.tNeed ? '#86e0a8' : '#e8ecf4'); tTag.set(deg(tc), tc >= d.tNeed); }
    };
    pose(0, 0); kit.onFrame(pose);
  };

  // ===== 2. «Теплопроводность»: горячий брусок над горелкой, два стержня, кнопки на воске, подносы, секундомер =====
  SC['temp-cond'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const X0 = -24, LEN = 68, RY = 26, RZ = [-9, 9], NSEG = 25, PINS = [10, 20, 30, 40, 50];
    const xAt = i => X0 + LEN * i / 50;
    // брусок на ножках и горелка под ним
    const bx = X0 - 4.5;
    const blkMat = h.ownMat(0xd8a04a, d.heat ? { emissive: 0xff5a2a, emissiveIntensity: 0.35 } : {});
    const blk = new T.Group(); at(blk, bx, 0, 0, g); clickable(blk, 'heat');
    at(mesh(new T.BoxGeometry(9, 16, 25), 0, { mat: blkMat }), 0, 16 + 8, 0, blk);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) at(cyl(0.6, 16, C.STEEL, { edges: false }), sx * 3.4, 8, sz * 10.5, blk);
    const bn = h.bunsen(g, bx, 0, d.heat); clickable(bn.g, 'heat');
    if (d.heat) at(h.glow(0xff7a3a, 30, 0.35), bx, 18, 0, g);
    // опора дальних концов
    at(box(6, 1.2, 26, C.WOOD2), X0 + LEN + 5, 0.6, 0, g);
    at(box(2, RY - 2.4, 2, C.WOOD2), X0 + LEN + 5, 1.2 + (RY - 2.4) / 2, 0, g);
    at(box(3, 1.2, 24, C.WOOD2), X0 + LEN + 3, RY - 1.8, 0, g);
    // стержни из отрезков: цвет каждого — его температура
    const rods = d.rods.map((r, ri) => {
      const z = RZ[ri], rg = new T.Group(); at(rg, 0, 0, 0, g); clickable(rg, 'm' + ri);
      const base = new T.Color(r.col), segs = [];
      for (let j = 0; j < NSEG; j++) {
        const m = h.ownMat(r.col), sl = LEN / NSEG;
        const s = new T.Mesh(keep(new T.CylinderGeometry(1.2, 1.2, sl + 0.02, 18)), m); s.rotation.z = Math.PI / 2; s.castShadow = true;
        at(s, X0 + sl * (j + 0.5), RY, z, rg); segs.push(m);
      }
      const hullR = mesh(new T.CylinderGeometry(1.2, 1.2, LEN + 4, 18), 0, { mat: keep(new T.MeshBasicMaterial({ visible: false })), hull: true, edges: false, shadow: false });
      hullR.rotation.z = Math.PI / 2; at(hullR, X0 + LEN / 2 - 2, RY, z, rg);
      // поднос под стержнем
      at(box(LEN + 6, 0.5, 6, 0x8a94a8), X0 + LEN / 2 + 2, 0.25, z, g);
      for (const s of [-1, 1]) at(box(LEN + 6, 1.2, 0.4, 0x6c7689, { edges: false }), X0 + LEN / 2 + 2, 0.6, z + s * 3, g);
      // воск и кнопки
      const pins = PINS.map((p, k) => {
        const x = xAt(p) - (p === 50 ? 1.2 : 0);
        const wax = mesh(new T.SphereGeometry(1.1, 12, 8), 0, { mat: h.ownMat(0xf0dc9a), edges: false, hull: true }); wax.scale.set(1.2, 0.7, 1.2); at(wax, x, RY - 1.25, z, g);
        const pg = new T.Group(); at(pg, x, RY - 1.6, z, g);
        at(cyl(0.13, 3.6, C.STEEL, { edges: false, hull: false }), 0, -1.8, 0, pg);
        at(cyl(1.1, 0.4, 0xe0473a, { seg: 16 }), 0, -3.8, 0, pg);
        return { x, wax, pg, fell: null, lab: null };
      });
      return { r, base, segs, pins, z };
    });
    const hotA = new T.Color(0xffb547), hotB = new T.Color(0xff4a2a);
    const heatCol = (base, t) => { const f = clamp((t - 20) / (d.hot - 20), 0, 1); return base.clone().lerp(f < 0.5 ? hotA : hotA.clone().lerp(hotB, (f - 0.5) * 2), Math.min(0.9, f * 1.25)); };
    // секундомер-табло
    const sw = new T.Group(); at(sw, -6, 0, 34, g); sw.rotation.y = 0.25;
    at(box(30, 1.6, 12, C.DARK), 0, 0.8, 0, sw);
    const bd = new T.Group(); at(bd, 0, 1.6, -1, sw); bd.rotation.x = -0.42;
    at(box(28, 12, 4, 0x3b4a66), 0, 6, 0, bd);
    const scr = h.screen(25, 9.6, '', '#ffd166', 400, 156); at(scr, 0, 6, 2.06, bd);
    // подписи
    rods.forEach((R, ri) => kit.tag(v3(X0 + LEN * 0.55, RY + 4, R.z - 2), R.r.name[0].toUpperCase() + R.r.name.slice(1), 'λ = ' + fmt(R.r.lam, R.r.lam < 1 ? 2 : 0) + ' Вт/(м·°C)', ri === 0 && d.ok));
    kit.tag(v3(bx - 2, 26, 15), 'Брусок ' + d.hot + ' °C', d.heat ? 'нагрев' : 'нажми — нагреть', d.heat);
    kit.tag(v3(-6, 18, 34), 'Время ×10', 'воск тает при ' + d.melt + ' °C');
    // анимация: цвет стержней, падение кнопок
    const now = () => performance.now() / 1000;
    const L0 = live();
    const place = (p, f, ri, k, instant) => {
      p.fell = { at: instant ? -9 : now(), ts: f };
      p.wax.material.color.set(0xffe9b8); p.wax.scale.set(1.5, 0.35, 1.5); p.wax.position.y = RY - 1.05;
      const lab = h.label(4.4, 1.8, fmt(f, 0) + ' с'); lab.rotation.x = -Math.PI / 2; at(lab, p.x - 1, 0.56, rods[ri].z + 1.9, g); lab.visible = instant; p.lab = lab;
    };
    rods.forEach((R, ri) => R.pins.forEach((p, k) => { const f = L0.fell && L0.fell[ri] && L0.fell[ri][k]; if (f != null) place(p, f, ri, k, true); }));
    const pose = () => {
      const Lv = live(), tN = now();
      rods.forEach((R, ri) => {
        const TT = Lv.T && Lv.T[ri];
        if (TT) R.segs.forEach((m, j) => m.color.copy(heatCol(R.base, (TT[2 * j] + TT[2 * j + 1] + TT[2 * j + 2]) / 3)));
        R.pins.forEach((p, k) => {
          const f = Lv.fell && Lv.fell[ri] && Lv.fell[ri][k];
          if (f != null && !p.fell) place(p, f, ri, k, false);
          if (f == null && p.fell) { p.fell = null; p.wax.material.color.set(0xf0dc9a); p.wax.scale.set(1.2, 0.7, 1.2); p.wax.position.y = RY - 1.25; if (p.lab) p.lab.visible = false; p.lab = null; }
          if (!p.fell) { p.pg.position.set(p.x, RY - 1.6, R.z); p.pg.rotation.z = 0; return; }
          const u = kit.reduce ? 1 : clamp((tN - p.fell.at) / 0.55, 0, 1);
          p.pg.position.set(p.x - 1.9 * smooth(u), RY - 1.6 + (1.7 - (RY - 1.6)) * u * u, R.z);
          p.pg.rotation.z = Math.PI / 2 * smooth(u);
          if (u >= 1 && p.lab) p.lab.visible = true;
        });
      });
      const n = ri => (Lv.fell && Lv.fell[ri] ? Lv.fell[ri].filter(x => x != null).length : 0);
      const nm = d.rods.map(r => r.name.padEnd(8, ' '));
      scr.userData.set('t = ' + fmt(Lv.ts || 0, 0) + ' с\n' + nm[0] + ' ' + n(0) + '/5\n' + nm[1] + ' ' + n(1) + '/5', d.ok ? '#86e0a8' : '#ffd166');
    };
    pose(); kit.onFrame(pose);
  };

  // ===== 3. «Конвекция»: макет комнаты зимой — окно, батарея внизу или под потолком, слои воздуха, частицы, термометры =====
  SC['temp-conv'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 2, 0, 6); g.rotation.y = 0.3;
    const WP = (x, y, z) => { g.updateMatrixWorld(true); return v3(x, y, z).applyMatrix4(g.matrixWorld); };
    const XL = -36, XR = 32, ZB = -24, ZF = 8, YF = 3, YC = 45, NL = 8, LH = (YC - YF) / NL;
    const W = XR - XL, D = ZF - ZB, low = d.pos === 'low';
    // основание и пол
    at(box(W + 6, YF, D + 6, C.WOOD2), (XL + XR) / 2 - 1, YF / 2, (ZB + ZF) / 2, g);
    at(box(W, 0.3, D, 0xd9b78a, { edges: false }), (XL + XR) / 2, YF + 0.15, (ZB + ZF) / 2, g);
    for (let k = 1; k < 8; k++) at(box(0.15, 0.05, D, 0xb8945e, { edges: false, shadow: false }), XL + W * k / 8, YF + 0.32, (ZB + ZF) / 2, g);
    // задняя стена
    at(box(W + 2, YC - YF + 2, 2, 0xf2e6cf), (XL + XR) / 2, YF + (YC - YF) / 2 + 1, ZB - 1, g);
    at(box(W, 1.2, 0.6, 0xc9b28a, { edges: false }), (XL + XR) / 2, YF + 0.9, ZB + 0.3, g);
    // левая стена с окном
    const wy0 = 17, wy1 = 31, wz0 = -18, wz1 = -2, WX = XL - 1;
    const wallPart = (y0, y1, z0, z1) => at(box(2, y1 - y0, z1 - z0, 0xe8dcc4), WX, (y0 + y1) / 2, (z0 + z1) / 2, g);
    wallPart(YF, wy0, ZB - 2, ZF); wallPart(wy1, YC + 2, ZB - 2, ZF); wallPart(wy0, wy1, ZB - 2, wz0); wallPart(wy0, wy1, wz1, ZF);
    const frost = kit.keep(new T.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = 256; c.height = 220; const x = c.getContext('2d'); const gr = x.createLinearGradient(0, 0, 0, 220); gr.addColorStop(0, '#2a4a78'); gr.addColorStop(1, '#9cc8e8'); x.fillStyle = gr; x.fillRect(0, 0, 256, 220); x.fillStyle = '#ffffff'; for (let i = 0; i < 70; i++) { x.globalAlpha = 0.5 + rnd(i) * 0.5; x.beginPath(); x.arc(rnd(i + 1) * 256, rnd(i + 2) * 220, 1.5 + rnd(i + 3) * 3, 0, 7); x.fill(); } x.globalAlpha = 1; x.fillStyle = '#f4f8fc'; x.beginPath(); x.moveTo(0, 220); x.quadraticCurveTo(80, 170, 160, 196); x.quadraticCurveTo(220, 180, 256, 200); x.lineTo(256, 220); x.fill(); return c; })()));
    frost.colorSpace = T.SRGBColorSpace;
    const pane = new T.Mesh(keep(new T.PlaneGeometry(wz1 - wz0, wy1 - wy0)), keep(new T.MeshBasicMaterial({ map: frost, side: T.DoubleSide }))); pane.rotation.y = Math.PI / 2; at(pane, WX + 0.2, (wy0 + wy1) / 2, (wz0 + wz1) / 2, g);
    at(box(2.4, 0.6, wz1 - wz0, 0xffffff), WX, (wy0 + wy1) / 2, (wz0 + wz1) / 2, g);
    at(box(2.4, wy1 - wy0, 0.6, 0xffffff), WX, (wy0 + wy1) / 2, (wz0 + wz1) / 2, g);
    at(box(4, 0.8, wz1 - wz0 + 2, 0xffffff), WX + 1, wy0 - 0.4, (wz0 + wz1) / 2, g);
    // потолок: тонкое стекло и балки, углы-стойки (макет открыт к зрителю)
    const ceil = new T.Mesh(keep(new T.BoxGeometry(W + 2, 0.5, D + 2)), h.glassMat(0xe8f2f8, 0.1)); at(ceil, (XL + XR) / 2, YC + 0.25, (ZB + ZF) / 2, g);
    at(box(W + 2, 1, 1, 0xcfd6e2), (XL + XR) / 2, YC + 0.5, ZF + 0.5, g);
    at(box(1, 1, D + 2, 0xcfd6e2), XR + 0.5, YC + 0.5, (ZB + ZF) / 2, g);
    at(box(1, YC - YF, 1, 0xcfd6e2), XR + 0.5, YF + (YC - YF) / 2, ZF + 0.5, g);
    at(box(1, YC - YF, 1, 0xcfd6e2), XR + 0.5, YF + (YC - YF) / 2, ZB, g);
    // улица: сугроб, ёлка, снежинки
    const snow = mesh(new T.SphereGeometry(9, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0xf4f8fc, { edges: false, hull: true }); snow.scale.set(1.2, 0.35, 1.6); at(snow, XL - 12, 0, -10, g);
    at(cyl(0.8, 4, 0x6b4a2a), XL - 16, 2, -16, g);
    [[7, 9, 6], [5.5, 8, 11], [4, 7, 15.5]].forEach(([r, hh, y]) => at(cyl(r, hh, 0x2f7a4a, { r2: 0.01, seg: 9 }), XL - 16, y, -16, g));
    const flakes = [], fMat = keep(new T.SpriteMaterial({ map: kit.glowTex(), color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
    for (let i = 0; i < 16; i++) { const s = new T.Sprite(fMat); s.scale.setScalar(1.3); at(s, 0, 0, 0, g); flakes.push({ s, x: XL - 6 - rnd(i) * 16, z: -24 + rnd(i + 5) * 30, ph: rnd(i + 9) }); }
    // слои воздуха
    const layers = [];
    for (let i = 0; i < NL; i++) {
      const m = h.ownMat(0x72d4e8, { transparent: true, opacity: 0.13, depthWrite: false });
      const s = new T.Mesh(keep(new T.BoxGeometry(W - 0.4, LH - 0.15, D - 0.4)), m); at(s, (XL + XR) / 2, YF + LH * (i + 0.5), (ZB + ZF) / 2, g);
      layers.push(m);
    }
    // батарея (и пустое место, куда её можно перевесить)
    const radiator = (y0, ghost) => {
      const rg = new T.Group(); at(rg, XL + 2.4, y0, -8, g);
      const col = ghost ? 0xb8c2d1 : d.on ? 0xff8a73 : 0xd9dfe9;
      const o = ghost ? { matOpt: { transparent: true, opacity: 0.28, depthWrite: false }, shadow: false } : {};
      for (let k = 0; k < 8; k++) at(box(3, 9, 1.4, col, o), 0, 4.5, -7 + k * 2, rg);
      at(box(2, 0.9, 16.5, col, o), 0, 0.9, 0, rg); at(box(2, 0.9, 16.5, col, o), 0, 8.1, 0, rg);
      if (!ghost) { for (const s of [-1, 1]) at(box(2.4, 1, 1, C.DARK), -1.6, 7, s * 6, rg); }
      return rg;
    };
    const ry = low ? YF + 1.5 : YC - 10.5, gy = low ? YC - 10.5 : YF + 1.5;
    const rad = radiator(ry, false); clickable(rad, 'on');
    const ghost = radiator(gy, true); clickable(ghost, low ? 'pos-high' : 'pos-low');
    at(cyl(0.6, ry - YF + 1, 0xb8c2d1, { edges: false }), XL + 1.2, YF + (ry - YF + 1) / 2, -17.5, g);
    if (d.on) { at(h.glow(0xff8a5a, 22, 0.35), XL + 4, ry + 4.5, -8, g); at(new T.PointLight(0xff9a6a, 14, 40, 1.4), XL + 6, ry + 5, -8, g); }
    // стрелки потока
    const up = h.arrow(g, XL + 7, YF + 12, -8, 22, 0xffb547, false), dn = h.arrow(g, XR - 6, YC - 12, -8, 22, 0x4f9fe0, true);
    up.visible = dn.visible = false;
    // частицы воздуха: по кругу — вверх у батареи, под потолком, вниз у дальней стены, по полу обратно
    const NP = 46, pGeo = keep(new T.SphereGeometry(0.8, 10, 6)), pMat = [];
    if (!mem.trc) mem.trc = Array.from({ length: NP }, (_, i) => ({ u: rnd(i + 200), o: rnd(i + 300), j: rnd(i + 400) * 6.28, z: ZB + 3 + rnd(i + 500) * (D - 6) }));
    const parts = mem.trc.map(p => { const m = h.ownMat(0x72d4e8); const s = new T.Mesh(pGeo, m); s.castShadow = false; g.add(s); pMat.push(m); return s; });
    const loopXY = p => {
      const x0 = XL + 4 + p.o * 14, x1 = XR - 4 - p.o * 12, y0 = YF + 2 + p.o * 7, y1 = YC - 2 - p.o * 9;
      const w = x1 - x0, hh = y1 - y0, per = 2 * (w + hh); let s = (((p.u % 1) + 1) % 1) * per;
      if (s < hh) return [x0, y0 + s]; s -= hh; if (s < w) return [x0 + s, y1]; s -= w; if (s < hh) return [x1, y1 - s]; s -= hh; return [x1 - s, y0];
    };
    // термометры по высоте: колонка табло у правого угла
    const pole = new T.Group(); at(pole, XR + 7, 0, ZF + 4, g); pole.rotation.y = 0.15;
    at(box(6, 1, 6, C.DARK), 0, 0.5, 0, pole); at(cyl(0.5, YC - 2, C.STEEL, { edges: false }), -2.2, (YC - 2) / 2 + 1, -1, pole);
    const scr = [];
    for (let i = 0; i < NL; i++) { const sc = h.screen(7.6, LH - 1.4, '', '#e8ecf4', 200, 76); at(sc, 2, YF + LH * (i + 0.5), 0, pole); at(box(8.2, LH - 0.8, 0.5, 0x3b4a66), 2, YF + LH * (i + 0.5), -0.3, pole); scr.push(sc); }
    // подписи
    const st = h.label(13, 2.6, 'улица ' + fmt(d.tOut, 0) + ' °C', '#e8f4ff', '#3a5f8a'); st.rotation.y = Math.PI / 2; at(st, WX + 1.1, wy1 + 3, (wz0 + wz1) / 2, g);
    kit.tag(WP(XL + 4, ry + 13, -8), 'Батарея ' + d.tRad + ' °C', d.on ? 'включена' : 'нажми — включить', d.on);
    kit.tag(WP(XL + 12, gy + 7, -8), low ? 'Под потолок?' : 'Вниз?', 'нажми — перевесить');
    const rTag = liveTag(kit, WP(XR + 7, YC + 4, ZF + 4), 'Термометры', 'пол ' + d.tNeed + ' °C?');
    const tmTag = liveTag(kit, WP(-2, YC + 3, ZB), 'Комната', '0 мин');
    let lastSig = '';
    const pose = (dt, t) => {
      const Lv = live(), room = Lv.room || Array(NL).fill(12), w = Lv.w || 0;
      room.forEach((v, i) => layers[i].color.copy(tcol(T, v, 0, 35)));
      const conv = low && d.on && w > 0.3; up.visible = dn.visible = conv;
      mem.trc.forEach((p, i) => {
        if (dt && !kit.reduce) p.u += (low ? w : 0) * dt * 0.035 * (0.6 + 0.4 * (1 - p.o));
        let [x, y] = loopXY(p);
        if (!kit.reduce) { x += 1.2 * Math.sin(p.j + t * 1.4); y += 1.2 * Math.cos(p.j * 1.7 + t * 1.1); }
        parts[i].position.set(x, y, p.z);
        pMat[i].color.copy(tcol(T, room[clamp(Math.floor((y - YF) / LH), 0, NL - 1)], 0, 35));
      });
      flakes.forEach(f => { const u = kit.reduce ? f.ph : (t * 0.12 + f.ph) % 1; f.s.position.set(f.x + Math.sin(t + f.ph * 9) * 1.2, 46 - u * 46, f.z); });
      const sig = room.map(v => Math.round(v)).join(',') + '|' + Math.round(Lv.tm || 0);
      if (sig !== lastSig) {
        lastSig = sig;
        room.forEach((v, i) => scr[i].userData.set((i === 0 ? 'пол ' : i === NL - 1 ? 'верх ' : '') + fmt(v, 0) + '°', i === 0 && v >= d.tNeed ? '#86e0a8' : i === 0 || i === NL - 1 ? '#ffd166' : '#e8ecf4'));
        rTag.set('пол ' + deg(room[0]) + ' · верх ' + deg(room[NL - 1]), room[0] >= d.tNeed);
        tmTag.set(fmt(Lv.tm || 0, 0) + ' мин');
      }
    };
    pose(0, 0); kit.onFrame(pose);
  };

  // ===== 4. «Излучение»: лампа накаливания, две банки с водой и термометрами, лента-рулетка =====
  const CANC = { black: [0x1c2029, 0x3a404e], white: [0xf4f6fa, 0xffffff], foil: [0xa9b6c8, 0xffffff] };
  SC['temp-rad'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, clickable, C } = kit, h = H(kit), v3 = h.v3;
    // ось «банка — лампа — банка» повёрнута так, чтобы в исходном виде лежать поперёк экрана
    const g = new T.Group(); at(g, 0, 0, 4); g.rotation.y = 0.5;
    const W = (x, y, z) => { g.updateMatrixWorld(true); return v3(x, y, z).applyMatrix4(g.matrixWorld); };
    const LY = 30, K = 66, dx = K * d.d, CR = 6.5, CH = 16;
    // лампа на стойке
    const lp = new T.Group(); at(lp, 0, 0, 0, g); clickable(lp, 'lamp');
    at(cyl(7.5, 1.6, C.DARK, { seg: 28 }), 0, 0.8, 0, lp);
    at(cyl(1, 18, C.STEEL, { edges: false }), 0, 10.6, 0, lp);
    at(cyl(2.8, 4.6, 0x3a3f4c, { seg: 20 }), 0, 21.6, 0, lp);
    at(cyl(2.4, 3, C.BRASS, { seg: 20 }), 0, 25.2, 0, lp);
    const bulbMat = keep(new T.MeshToonMaterial({ color: d.lamp ? 0xfff0c0 : 0xdfeaf2, gradientMap: kit.grad, transparent: true, opacity: d.lamp ? 0.9 : 0.4, emissive: d.lamp ? 0xffd27a : 0x000000, emissiveIntensity: d.lamp ? 0.9 : 0, depthWrite: false }));
    const bulb = new T.Mesh(keep(new T.SphereGeometry(6.4, 28, 20)), bulbMat); at(bulb, 0, LY + 2.4, 0, lp); bulb.add(new T.Mesh(bulb.geometry, kit.hullMat));
    const fil = []; for (let k = 0; k <= 30; k++) fil.push(v3(-2.4 + 4.8 * k / 30, LY + 2.6 + 0.7 * Math.sin(k * 1.9), 0));
    at(new T.Mesh(keep(new T.TubeGeometry(new T.CatmullRomCurve3(fil), 60, 0.18, 5)), keep(new T.MeshBasicMaterial({ color: d.lamp ? 0xffffff : 0x6a6050 }))), 0, 0, 0, lp);
    for (const s of [-1, 1]) h.rodAB(lp, v3(s * 2.4, LY + 2.6, 0), v3(s * 1.1, LY - 2.4, 0), 0.14, 0x6a6050, { hull: false });
    if (d.lamp) { at(h.glow(0xffd27a, 36, 0.75), 0, LY + 2.4, 0, lp); at(new T.PointLight(0xffc860, 80, 100, 1.2), 0, LY + 2.4, 0, lp); }
    // банки: одинаковые, отличаются только цветом; сверху пробка и термометр
    const cans = d.cans.map((c, i) => {
      const s = i ? 1 : -1, x = s * dx, cg = new T.Group(); at(cg, x, 0, 0, g); clickable(cg, 'c' + i);
      const [col, hi] = CANC[c.k];
      at(cyl(CR, CH, col, { seg: 32, matOpt: c.k === 'foil' ? { emissive: 0x8090a8, emissiveIntensity: 0.25 } : {} }), 0, CH / 2, 0, cg);
      for (const y of [1.4, CH - 1.4]) { const r = mesh(new T.TorusGeometry(CR + 0.05, 0.3, 6, 32), hi, { edges: false }); r.rotation.x = Math.PI / 2; at(r, 0, y, 0, cg); }
      if (c.k === 'foil') for (let k = 0; k < 3; k++) { const a = -0.5 + k * 0.45, st = box(0.6, CH - 4, 0.2, 0xffffff, { edges: false, shadow: false, matOpt: { transparent: true, opacity: 0.7 } }); at(st, Math.sin(a) * (CR + 0.03), CH / 2, Math.cos(a) * (CR + 0.03), cg).rotation.y = a; }
      at(cyl(CR + 0.1, 0.7, c.k === 'black' ? 0x2c3240 : 0xb8c2d1, { seg: 32 }), 0, CH + 0.35, 0, cg);
      at(cyl(1.7, 1.8, 0xb8865a, { r2: 1.9, seg: 14 }), 0, CH + 1.4, 0, cg);
      const th = h.thermo(cg, 0, CH - 1, 0, 22, 0, 100, 20, { mark: d.tNeed });
      th.g.rotation.y = -g.rotation.y;
      const lab = h.label(9, 2.8, c.name, c.k === 'black' ? '#e8ecf4' : '#1b1610', c.k === 'black' ? '#1c2029' : '#fff6e6'); lab.rotation.y = -g.rotation.y; at(lab, Math.sin(-g.rotation.y) * (CR + 0.08), CH / 2, Math.cos(-g.rotation.y) * (CR + 0.08), cg);
      const tg = liveTag(kit, W(x, CH + 25, 0), (c.name[0].toUpperCase() + c.name.slice(1)) + ' банка', '20 °C');
      return { x, s, th, tg, k: c.k };
    });
    // лучи: огоньки бегут от лампы к банкам, чем дальше банка — тем бледнее
    const I = Math.pow(0.3 / d.d, 2), op = clamp(0.3 + 0.55 * I, 0.3, 0.95), rays = [];
    if (d.lamp) {
      const rm = keep(new T.SpriteMaterial({ map: kit.glowTex(), color: 0xff8a3c, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false }));
      cans.forEach(c => { for (let l = 0; l < 3; l++) for (let k = 0; k < 6; k++) { const s = new T.Sprite(keep(rm.clone())); s.scale.setScalar(2.4); g.add(s); rays.push({ s, c, l, ph: k / 6 + l * 0.11 }); } });
    }
    // рулетка: лента от лампы вправо, сантиметры
    const TL = 62, tc = document.createElement('canvas'); tc.width = 2048; tc.height = 96; const tx = tc.getContext('2d');
    tx.fillStyle = '#f2c94c'; tx.fillRect(0, 0, 2048, 96); tx.fillStyle = '#1b1610'; tx.strokeStyle = '#1b1610'; tx.textAlign = 'center'; tx.font = '700 34px "IBM Plex Mono", monospace';
    for (let cm = 0; cm <= 100; cm++) { const x = cm * K / 100 / TL * 2048; if (x > 2048) break; const L = cm % 10 === 0 ? 44 : cm % 5 === 0 ? 30 : 16; tx.lineWidth = cm % 10 ? 2 : 4; tx.beginPath(); tx.moveTo(x, 0); tx.lineTo(x, L); tx.stroke(); if (cm % 10 === 0 && cm) tx.fillText(String(cm), x, 80); }
    const ttex = keep(new T.CanvasTexture(tc)); ttex.colorSpace = T.SRGBColorSpace; ttex.anisotropy = 4;
    const tape = new T.Mesh(keep(new T.PlaneGeometry(TL, 3.4)), keep(new T.MeshBasicMaterial({ map: ttex }))); tape.rotation.x = -Math.PI / 2; at(tape, TL / 2, 0.12, 11, g);
    const rc = new T.Group(); at(rc, TL + 3.6, 0, 11, g);
    at(cyl(3.8, 3.6, 0xe0473a, { seg: 24 }), 0, 1.8, 0, rc); at(cyl(1.4, 3.8, C.DARK, { seg: 16 }), 0, 1.9, 0, rc);
    at(box(0.4, 1.8, 4, 0xe0473a), dx, 0.9, 11, g);
    // пульт: банки ближе / дальше
    const cp = new T.Group(); at(cp, 6, 0, 30, g);
    at(box(30, 2.2, 9, C.WOOD2), 0, 1.1, 0, cp);
    h.button(cp, -7, 2.2, 0, '◀ ближе', 0x3a7bd5, 'd-', 12, 5);
    h.button(cp, 7, 2.2, 0, 'дальше ▶', 0x3a7bd5, 'd+', 12, 5);
    // подписи
    const lTag = liveTag(kit, W(0, LY + 12, 0), 'Лампа', d.lamp ? 'вкл' : 'выкл — нажми', d.lamp);
    kit.tag(W(dx, 5, 13), 'До лампы', fmt(d.d * 100, 0) + ' см');
    const pose = (dt, t) => {
      const Lv = live(), TT = Lv.T || [20, 20];
      cans.forEach((c, i) => { c.th.set(TT[i]); c.tg.set(deg(TT[i]), c.k === 'black' && TT[i] >= d.tNeed); });
      for (const r of rays) {
        const u = kit.reduce ? r.ph % 1 : (t * 0.55 + r.ph) % 1, ex = r.c.x - r.c.s * (CR + 0.4), sx = r.c.s * 6.6;
        const y0 = LY + 2.4 + (r.l - 1) * 2, y1 = 4 + r.l * 4.5;
        r.s.position.set(sx + (ex - sx) * u, y0 + (y1 - y0) * u + 0.9 * Math.sin(u * 22 - t * 6), (r.l - 1) * 2.6);
        r.s.material.opacity = op * Math.sin(Math.PI * u);
      }
      lTag.set(d.lamp ? 'вкл · ' + fmt(Lv.t || 0, 1) + ' мин' : 'выкл — нажми', d.lamp);
    };
    pose(0, 0); kit.onFrame(pose);
  };
})();
