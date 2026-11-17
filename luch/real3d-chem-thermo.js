// «Как в жизни» для темы «Тепловой эффект реакции» (labs/chem-thermo):
// урок 1 — калориметр (стакан в теплоизоляции или банка над спиртовкой) с термометром, баночки опытов, клавиши «экзо/эндо»;
// урок 4 — полка с топливом и аккумулятором, столбики теплоты сгорания и CO₂, клавиши задач.
// Сцены строятся из window.LUCH_REAL() опыта; температура в калориметре — из LUCH_REAL.live() в onFrame.
(() => {
  const SC = window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {};
  const live = () => { try { return window.LUCH_REAL.live ? window.LUCH_REAL.live() : null; } catch (e) { return null; } };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (x, n) => { let s = (Math.round(x * 10 ** n) / 10 ** n).toFixed(n); if (/^-0(\.0+)?$/.test(s)) s = s.slice(1); return s.replace('.', ',').replace('-', '−'); };
  const rnd = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const hexN = s => typeof s === 'number' ? s : parseInt(String(s).slice(1), 16);
  const TY = 1.2; // верх подноса

  // ---------- общие детали ----------
  function H(kit) {
    const { T, at, box, cyl, keep, grad, glowTex, clickable, toon } = kit;
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    const glassMat = (color = 0xd8eef8, opacity = 0.26) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, transparent: true, opacity, side: T.DoubleSide, depthWrite: false }));
    const ownMat = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, ...o }));
    const spr = (map, color, opacity, add) => new T.Sprite(keep(new T.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending })));
    const glow = (color, size, opacity) => { const s = spr(glowTex(), color, opacity, true); s.scale.setScalar(size); return s; };
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
      const lh = ph / lines.length;
      lines.forEach((ln, i) => {
        const t = typeof ln === 'string' ? { t: ln } : ln;
        let fs = Math.round(lh * (t.k || 0.62)); const font = s => `${t.w || 600} ${s}px "IBM Plex Mono", monospace`;
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
    function key(parent, x, z, w, d, label, color, keyName, fg = '#ffffff') {
      const b = new T.Group(); at(b, x, TY, z, parent);
      at(box(w, 1.6, d, color), 0, 0.8, 0, b);
      const top = canvasPlane(w * 0.92, d * 0.8, Math.round(70 * w / d * 1.4), 112, (cx, a, bb) => textLines(cx, a, bb, [label], fg, '#' + color.toString(16).padStart(6, '0')));
      top.rotation.x = -Math.PI / 2; at(top, 0, 1.62, 0, b);
      clickable(b, keyName); return b;
    }
    const ring = (parent, x, z, r, col = 0xffd166) => at(cyl(r, 0.25, col, { edges: false, hull: false, shadow: false }), x, TY + 0.13, z, parent);
    function tray(g, w = 124, d = 84, z = 4) {
      at(box(w, TY, d, 0xf3f5f8), 0, TY / 2, z, g);
      at(box(w, 1.5, 1.2, 0xe2e7ee), 0, TY + 0.75, z - d / 2 + 0.6, g); at(box(w, 1.5, 1.2, 0xe2e7ee), 0, TY + 0.75, z + d / 2 - 0.6, g);
      at(box(1.2, 1.5, d - 2.4, 0xe2e7ee), -w / 2 + 0.6, TY + 0.75, z, g); at(box(1.2, 1.5, d - 2.4, 0xe2e7ee), w / 2 - 0.6, TY + 0.75, z, g);
    }
    // термометр: шарик, столбик, шкала 0…50 °C
    function thermo(parent, x, y0, z, len) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      at(new T.Mesh(keep(new T.SphereGeometry(1.0, 16, 12)), toon(0xe0473a)), 0, 0, 0, g);
      at(cyl(0.72, len, 0xeef6fb, { matOpt: { transparent: true, opacity: 0.55 } }), 0, len / 2 + 0.6, 0, g);
      at(box(1.0, len - 1.6, 0.1, 0xfffaf0, { edges: false, shadow: false }), 0, len / 2 + 0.8, -0.34, g);
      const col = cyl(0.3, 1, 0xe0473a, { edges: false, hull: false, shadow: false }); at(col, 0, 1, 0.05, g);
      const span = len - 2.4;
      for (let k = 0; k <= 5; k++) at(box(k % 5 === 0 ? 1.2 : 0.8, 0.14, 0.1, 0x1b1610, { edges: false, shadow: false }), 0.35, 1.2 + span * k / 5, 0.64, g);
      const set = t => { const hh = 0.3 + span * clamp(t / 50, 0, 1); col.scale.y = hh; col.position.y = 0.9 + hh / 2; };
      return { g, set };
    }
    // пар / тёплый воздух
    let puffT = null;
    function puffTex() {
      if (puffT) return puffT;
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
      const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.5, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 64, 64); puffT = keep(new T.CanvasTexture(c)); return puffT;
    }
    function steam(parent, x, y, z, o = {}) {
      const n = o.n || 6, ps = [], g = new T.Group(); at(g, x, y, z, parent);
      for (let i = 0; i < n; i++) { const s = spr(puffTex(), o.color ?? 0xffffff, 0, false); g.add(s); ps.push({ s, ph: i / n, dx: (rnd(i + 3) - 0.5) * (o.spread ?? 6), dz: (rnd(i + 9) - 0.5) * (o.spread ?? 6) }); }
      const st = { amt: 0 };
      kit.onFrame((dt, t) => {
        for (const p of ps) {
          const ph = kit.reduce ? 0.15 + p.ph * 0.7 : (t * 0.35 + p.ph) % 1;
          p.s.position.set(p.dx * (0.6 + ph), ph * (o.rise ?? 12), p.dz * (0.6 + ph));
          p.s.scale.setScalar((o.size || 4) * (0.6 + ph * 1.4));
          p.s.material.opacity = st.amt * (o.op ?? 0.5) * Math.sin(Math.PI * ph);
        }
      });
      return { g, set(a) { st.amt = a; } };
    }
    function flameTex() {
      const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d');
      const drop = (s, col, blur) => {
        x.save(); x.translate(32, 122); x.scale(s, s); x.beginPath();
        x.moveTo(0, -114); x.bezierCurveTo(8, -84, 24, -52, 22, -26); x.bezierCurveTo(20, -6, 10, 0, 0, 0);
        x.bezierCurveTo(-10, 0, -20, -6, -22, -26); x.bezierCurveTo(-24, -52, -8, -84, 0, -114); x.closePath();
        x.shadowColor = col; x.shadowBlur = blur; x.fillStyle = col; x.fill(); x.restore();
      };
      drop(1, '#ffb547', 9); drop(0.55, '#7ec8ff', 6);
      const t = keep(new T.CanvasTexture(c)); t.colorSpace = T.SRGBColorSpace; return t;
    }
    function flame(parent, x, y, z, hgt) {
      const g = new T.Group(); at(g, x, y, z, parent);
      const s = spr(flameTex(), 0xffffff, 0.94, false); s.center.set(0.5, 0.04); s.scale.set(hgt * 0.5, hgt, 1); at(s, 0, 0, 0, g);
      at(glow(0xffa040, hgt * 2.2, 0.45), 0, hgt * 0.35, 0, g);
      if (!kit.reduce) kit.onFrame((dt, t) => { s.scale.set(hgt * 0.5 * (1 + 0.08 * Math.sin(t * 17)), hgt * (1 + 0.12 * Math.sin(t * 13) + 0.05 * Math.sin(t * 29)), 1); });
      return g;
    }
    return { v3, glassMat, ownMat, glow, canvasPlane, textLines, screen, key, ring, tray, thermo, steam, flame };
  }
  const mixC = (T, a, b, t) => new T.Color(hexN(a)).lerp(new T.Color(hexN(b)), clamp(t, 0, 1));

  // ===== урок 1: калориметр =====
  SC['chth-calor'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const CX = -16, CZ = -4, burn = d.kind === 'burn';
    let liqMat, steam, flameG = null, base = TY;
    const cal = new T.Group(); at(cal, 0, 0, 0, g); clickable(cal, 'cup');
    if (!burn) {
      // стакан в пенопластовом кожухе с крышкой
      const R = 10, Hc = 22;
      const shell = new T.Mesh(keep(new T.CylinderGeometry(R + 1.6, R, Hc, 40, 1, true)), h.ownMat(0xf2f4f7, { side: T.DoubleSide, transparent: true, opacity: 0.55, depthWrite: false }));
      at(shell, CX, TY + Hc / 2, CZ, cal); shell.add(new T.Mesh(shell.geometry, kit.hullMat));
      at(cyl(R, 0.6, 0xf2f4f7, { edges: false }), CX, TY + 0.3, CZ, cal);
      liqMat = h.ownMat(0x8fc6ea, { transparent: true, opacity: 0.55, depthWrite: false });
      at(new T.Mesh(keep(new T.CylinderGeometry(R - 0.6, R - 0.8, 14, 36)), liqMat), CX, TY + 0.6 + 7, CZ, cal);
      const lid = cyl(R + 2.2, 1.4, 0x5c6b88, { seg: 36 }); at(lid, CX, TY + Hc + 0.7, CZ, cal);
      // нерастворившиеся крупинки на дне
      if (d.sid && d.kind !== 'mix') for (let i = 0; i < 8; i++) { const a = rnd(i) * 6.28, r = rnd(i + 5) * 6; at(box(1.1, 0.7, 1.1, hexN(d.samples[d.cur].col), { edges: false }), CX + Math.cos(a) * r, TY + 1.0, CZ + Math.sin(a) * r, cal).name = 'grain'; }
      steam = h.steam(cal, CX - 3, TY + Hc + 1.5, CZ, { n: 6, spread: 8, size: 4.5, rise: 12, op: 0.4 });
      base = TY + 2;
    } else {
      // банка с водой на треноге над спиртовкой
      const BY = TY + 16;
      for (let k = 0; k < 3; k++) { const a = k / 3 * 6.28 + 0.5, x = CX + Math.cos(a) * 10, z = CZ + Math.sin(a) * 10; const leg = cyl(0.5, 16, C.DARK, { edges: false }); leg.rotation.z = Math.cos(a) * 0.12; leg.rotation.x = -Math.sin(a) * 0.12; at(leg, x, TY + 8, z, cal); }
      const rg = mesh(new T.TorusGeometry(10, 0.6, 8, 32), C.DARK, { edges: false }); rg.rotation.x = Math.PI / 2; at(rg, CX, BY, CZ, cal);
      const can = new T.Mesh(keep(new T.CylinderGeometry(8, 8, 14, 36, 1, true)), h.ownMat(0xb9c2d0, { side: T.DoubleSide })); at(can, CX, BY + 7.6, CZ, cal); can.add(new T.Mesh(can.geometry, kit.hullMat));
      at(cyl(8, 0.6, 0xb9c2d0, { edges: false }), CX, BY + 0.9, CZ, cal);
      liqMat = h.ownMat(0x8fc6ea, { transparent: true, opacity: 0.7, depthWrite: false });
      at(new T.Mesh(keep(new T.CylinderGeometry(7.6, 7.6, 10, 32)), liqMat), CX, BY + 6.2, CZ, cal);
      // спиртовка
      const lamp = new T.Mesh(keep(new T.SphereGeometry(5, 24, 16, 0, Math.PI * 2, 0, Math.PI / 1.6)), h.glassMat(0xd8eef8, 0.4)); lamp.scale.y = 0.9; at(lamp, CX, TY + 1.5, CZ, cal);
      at(cyl(4.4, 1.5, 0xd8eef8, { edges: false, matOpt: { transparent: true, opacity: 0.4 } }), CX, TY + 0.75, CZ, cal);
      at(cyl(1, 2.2, 0x8ea0c0, { edges: false }), CX, TY + 6.6, CZ, cal);
      flameG = h.flame(cal, CX, TY + 7.6, CZ, 7);
      base = BY + 2;
    }
    const th = h.thermo(cal, CX + 4, base, CZ + 2, burn ? 26 : 30);
    // табло термометра
    const pn = new T.Group(); at(pn, CX + 18, TY, CZ + 16, g); pn.rotation.y = -0.35;
    at(box(14, 1.2, 8, C.DARK), 0, 0.6, 0, pn);
    const scr = h.screen(12, 5, '', '#ffd166', 300, 120); scr.rotation.x = -0.5; at(scr, 0, 3.2, 0.5, pn);
    at(box(13, 5.5, 1.2, 0x26324a), 0, 3.2, -0.4, pn).rotation.x = -0.5;
    // баночки опытов (сзади)
    d.samples.forEach((s, i) => {
      const x = 21 + (i % 3) * 17, z = -24 + Math.floor(i / 3) * 19, jg = new T.Group(); at(jg, x, TY, z, g); clickable(jg, 'smp-' + i);
      if (i === d.cur) h.ring(jg, 0, 0, 6.2); else if (s.sorted) h.ring(jg, 0, 0, 6.2, s.sorted === 'exo' ? 0xff8a73 : 0x9fd4f0);
      if (s.kind === 'burn') {
        const lp = new T.Mesh(keep(new T.SphereGeometry(3.4, 18, 12, 0, Math.PI * 2, 0, Math.PI / 1.6)), h.glassMat(0xd8eef8, 0.45)); at(lp, 0, 1.2, 0, jg);
        at(cyl(0.8, 2, 0x8ea0c0, { edges: false }), 0, 5, 0, jg); at(cyl(1.3, 2.4, 0x5c6b88), 0, 6.6, 0, jg);
      } else if (s.kind === 'mix') {
        [-2.2, 2.2].forEach((dx, k) => { const w = new T.Mesh(keep(new T.CylinderGeometry(1.8, 1.8, 9, 18, 1, true)), h.glassMat(0xd8eef8, 0.35)); at(w, dx, 4.5, 0, jg); at(cyl(1.5, 6, k ? 0x9fd4f0 : 0xcfe2f0, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.75 } }), dx, 3.2, 0, jg); });
      } else {
        const w = new T.Mesh(keep(new T.CylinderGeometry(3.4, 3.4, 7, 24, 1, true)), h.glassMat(0xd8eef8, 0.32)); at(w, 0, 3.5, 0, jg); w.add(new T.Mesh(w.geometry, kit.hullMat));
        for (let j = 0; j < 7; j++) at(box(1.3, 1.1, 1.3, hexN(s.col), { edges: false }), (rnd(j + i * 7) - 0.5) * 3.6, 0.8 + Math.floor(j / 3) * 1.1, (rnd(j + 3 + i) - 0.5) * 3.6, jg);
        at(cyl(3.7, 1.2, 0x2c3240), 0, 7.6, 0, jg);
      }
      const lb = h.canvasPlane(14, 3.4, 260, 64, (cx, a, b) => h.textLines(cx, a, b, [(s.sorted ? '✓ ' : '') + s.name], '#1b1610', i === d.cur ? '#ffd166' : s.tested ? '#dff3ff' : '#fff6e6', { round: 10 }));
      lb.rotation.x = -0.6; at(lb, 0, 0.9, 6.4, jg);
    });
    // клавиши сортировки (спереди)
    h.key(g, -14, 34, 26, 8, 'экзо · +Q', 0xc8452c, 'exo');
    h.key(g, 16, 34, 26, 8, 'эндо · −Q', 0x3b6fd8, 'endo');
    const L0 = live() || { T: 20, dT: 0, p: 0 };
    kit.onFrame(() => {
      const Lv = live() || L0;
      th.set(Lv.T);
      scr.userData.set(fmt(Lv.T, 1) + ' °C', Lv.dT > 0.5 ? '#ff8a73' : Lv.dT < -0.5 ? '#9fd4f0' : '#ffd166');
      liqMat.color.copy(Lv.dT >= 0 ? mixC(T, 0x8fc6ea, 0xff8a6a, Lv.dT / 12) : mixC(T, 0x8fc6ea, 0xe6f6ff, -Lv.dT / 6));
      if (d.sid === 'cao') liqMat.color.lerp(new T.Color(0xf2f5f0), 0.5 * Lv.p);
      if (steam) steam.set(clamp((Lv.dT - 2) / 10, 0, 1));
      if (flameG) flameG.visible = Lv.p < 1;
      cal.children.forEach(o => { if (o.name === 'grain') o.visible = Lv.p < 0.95; });
    });
    tag(v3(CX, TY + 34, CZ), burn ? 'Банка над спиртовкой' : 'Калориметр', d.name || '100 мл воды, 20 °C', !!d.name);
    tag(v3(CX + 18, TY + 9, CZ + 16), 'Термометр', '°C');
    tag(v3(38, TY + 13, -24), 'Опыты', d.samples.filter(s => s.sorted).length + ' из 6 разложено');
  };

  // ===== урок 4: топливо =====
  SC['chth-fuel'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g, 132, 88);
    // доска с задачей
    const bd = new T.Group(); at(bd, 0, TY, -36, g);
    at(box(2, 20, 2, C.DARK), -40, 10, 0, bd); at(box(2, 20, 2, C.DARK), 40, 10, 0, bd);
    at(box(80, 13, 1.6, 0x26324a), 0, 14, 0, bd);
    const board = h.canvasPlane(78, 12, 1040, 160, (cx, a, b) => h.textLines(cx, a, b, [{ t: `Задача ${d.sc + 1}: ${d.scName} · ${String(d.E).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} МДж`, c: '#ffd166' }, { t: d.text[0], k: 0.5 }, { t: d.text[1], k: 0.5 }], '#f2f5f0', '#132018'));
    at(board, 0, 14, 0.85, bd);
    // полка с топливом
    d.fuels.forEach((f, i) => {
      const x = -50 + i * 20, z = -12, fg = new T.Group(); at(fg, x, TY, z, g); clickable(fg, 'fuel-' + i);
      const ok = d.picks[d.sc] === f.id, off = d.only && !d.only.includes(f.id);
      if (ok) h.ring(fg, 0, 0, 8, 0x86e0a8); else if (d.sel === i) h.ring(fg, 0, 0, 8);
      if (f.id === 'h2' || f.id === 'ch4') {
        at(cyl(3.6, 14, f.id === 'h2' ? 0xdfe8f2 : 0x4d7cf0), 0, 7.3, 0, fg);
        const top = new T.Mesh(keep(new T.SphereGeometry(3.6, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)), kit.toon(f.id === 'h2' ? 0xdfe8f2 : 0x4d7cf0)); at(top, 0, 14.3, 0, fg);
        at(cyl(0.9, 2.4, C.STEEL, { edges: false }), 0, 18.6, 0, fg);
        const lb = h.canvasPlane(5, 3, 120, 72, (cx, a, b) => h.textLines(cx, a, b, [f.id === 'h2' ? 'H₂' : 'CH₄'], '#1b1610', '#fff6e6')); at(lb, 0, 8, 3.65, fg);
      } else if (f.id === 'pet') {
        at(box(7, 11, 4.2, 0xc8452c), 0, 5.5, 0, fg); at(cyl(0.9, 2.6, 0x2c3240, { edges: false }), 2, 12.3, 0, fg); at(box(3.4, 1.2, 1.2, 0x2c3240), -1.4, 11.6, 0, fg);
      } else if (f.id === 'coal') {
        for (let j = 0; j < 9; j++) { const c = mesh(new T.DodecahedronGeometry(1.6 + rnd(j) * 0.8, 0), 0x2a2f3a); c.rotation.set(rnd(j) * 3, rnd(j + 2) * 3, 0); at(c, (rnd(j + 4) - 0.5) * 6, 1.4 + (j > 5 ? 2.2 : 0), (rnd(j + 8) - 0.5) * 5, fg); }
      } else if (f.id === 'wood') {
        for (let j = 0; j < 5; j++) { const lg = cyl(1.3, 9, 0xa37b4a, { seg: 12 }); lg.rotation.z = Math.PI / 2; at(lg, 0, 1.5 + (j > 2 ? 2.4 : 0), -2.6 + (j % 3) * 2.6 + (j > 2 ? 1.3 : 0), fg); }
      } else {
        at(box(8, 9, 5, 0x2c3240), 0, 4.5, 0, fg); at(box(2.4, 1, 1.6, 0x86e0a8), -2, 9.5, 0, fg); at(box(2.4, 1, 1.6, 0x86e0a8), 2, 9.5, 0, fg);
        const lb = h.canvasPlane(6, 3, 140, 70, (cx, a, b) => h.textLines(cx, a, b, ['Li-ion'], '#0b1019', '#86e0a8')); at(lb, 0, 5, 2.55, fg);
      }
      // столбики: теплота сгорания (оранжевый) и CO₂ (серый)
      const qh = Math.max(0.2, f.q / 120 * 22), ch = Math.max(0.2, f.co2 / 120 * 22);
      at(box(3, qh, 3, off ? 0x8a6a3a : 0xffb547, { edges: false }), -2.2, qh / 2, 14, fg);
      at(box(3, ch, 3, 0x8b96ad, { edges: false }), 2.2, ch / 2, 14, fg);
      const lb = h.canvasPlane(16, 3.2, 300, 60, (cx, a, b) => h.textLines(cx, a, b, [f.name], '#1b1610', ok ? '#86e0a8' : d.sel === i ? '#ffd166' : off ? '#c9ced8' : '#fff6e6', { round: 10 }));
      lb.rotation.x = -0.6; at(lb, 0, 0.9, 7.5, fg);
    });
    // клавиши задач
    ['Ракета', 'Котельная', 'Склад'].forEach((n, i) => h.key(g, -36 + i * 36, 36, 30, 8, (i + 1) + '. ' + n + (d.picks[i] ? ' ✓' : ''), i === d.sc ? 0xc77800 : 0x3b4a66, 'sc-' + i));
    const sel = d.sel === null ? null : d.fuels[d.sel];
    tag(v3(sel ? -50 + d.sel * 20 : 0, TY + 22, -12), sel ? sel.name : 'Полка', sel ? d.res : 'нажмите на топливо', !!(sel && d.picks[d.sc] === sel.id));
    tag(v3(56, TY + 24, 2), 'Столбики', 'МДж/кг · г CO₂/МДж');
  };
})();
