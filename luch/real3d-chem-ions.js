// «Как в жизни» для химии: «Электролиты и ионы» (labs/chem-ions).
// Белый лабораторный поднос: прибор для проверки электропроводности (батарейка, лампочка, графитовые электроды над стаканом),
// бутылки с растворами, пробирки для реакций обмена, банки с солями и пробирки с универсальным индикатором.
// Сцены строятся из window.LUCH_REAL() опыта; нажатия уходят в window.LUCH_REAL.click(key).
(() => {
  const SC = window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {};
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rnd = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const PAL = [0xc9151e, 0xe0262a, 0xec4527, 0xf37526, 0xf8a11f, 0xfbc81b, 0xe9e21f, 0x7cc443, 0x33a84f, 0x1b9c8c, 0x2179bb, 0x2f55a3, 0x4a3c97, 0x5e2c89, 0x4a1d6e];
  const CAT = 0x3d7fd6, ANI = 0xe0663a, MOL = 0x8b96ad;

  // ---------- общие детали (как в real3d-chem-electro.js) ----------
  function H(kit) {
    const { T, at, box, cyl, mesh, keep, grad, glowTex, C } = kit;
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    const glassMat = (color = 0xd8eef8, opacity = 0.24) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, transparent: true, opacity, side: T.DoubleSide, depthWrite: false }));
    const ownMat = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, ...o }));
    const glow = (color, size, opacity) => { const s = new T.Sprite(keep(new T.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending }))); s.scale.setScalar(size); return s; };
    const ball = (r, color, o = {}) => mesh(new T.SphereGeometry(r, o.seg || 16, o.seg2 || 10), color, { hull: o.hull ?? true, edges: false, matOpt: o.matOpt, shadow: o.shadow });
    function canvasTex(pw, ph) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph;
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace;
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
    function sticker(w, h, txt, fg = '#1b1610', bg = '#fffaf0', pw = 256) {
      const ph = Math.round(pw * h / w), k = canvasTex(pw, ph);
      k.x.fillStyle = bg; const r = ph * 0.18;
      k.x.beginPath(); k.x.roundRect ? k.x.roundRect(2, 2, pw - 4, ph - 4, r) : k.x.rect(2, 2, pw - 4, ph - 4); k.x.fill();
      k.x.strokeStyle = '#1b1610'; k.x.lineWidth = 4; k.x.stroke();
      drawLines(k.x, pw, ph, String(txt).split('\n'), fg); k.tex.needsUpdate = true;
      return new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: k.tex, transparent: true })));
    }
    const flatSticker = (parent, x, y, z, w, h, txt, fg, bg, pw) => { const s = sticker(w, h, txt, fg, bg, pw); s.rotation.x = -Math.PI / 2; return at(s, x, y, z, parent); };
    function tray(parent, x, z, w, d) {
      at(box(w, 1, d, 0xf1f3f5), x, 0.5, z, parent);
      const nx = Math.floor(w / 12), nz = Math.floor(d / 12);
      for (let i = 1; i < nx; i++) at(box(0.25, 0.06, d - 0.6, 0xc9d1da, { edges: false, shadow: false }), x - w / 2 + i * w / nx, 1.03, z, parent);
      for (let i = 1; i < nz; i++) at(box(w - 0.6, 0.06, 0.25, 0xc9d1da, { edges: false, shadow: false }), x, 1.03, z - d / 2 + i * d / nz, parent);
      return 1;
    }
    function beaker(parent, x, y0, z, r, h) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const wall = new T.Mesh(keep(new T.CylinderGeometry(r, r * 0.97, h, 40, 1, true)), glassMat(0xd8eef8, 0.22)); at(wall, 0, h / 2, 0, g);
      wall.add(new T.Mesh(wall.geometry, kit.hullMat));
      at(cyl(r * 0.97, 0.6, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.45 } }), 0, 0.3, 0, g);
      const rim = mesh(new T.TorusGeometry(r, 0.22, 6, 40), 0xeef6fb, { edges: false, shadow: false }); rim.rotation.x = Math.PI / 2; at(rim, 0, h, 0, g);
      for (let k = 1; k <= 5; k++) { const m = box(k % 2 ? 1.1 : 2, 0.16, 0.1, 0x6f8098, { edges: false, shadow: false }); m.rotation.y = 0.5; at(m, Math.sin(0.5) * (r + 0.05), h * k / 6.5, Math.cos(0.5) * (r + 0.05), g); }
      return { g, r, h };
    }
    function liquid(parent, x, y0, z, r, color, opacity = 0.62, hgt = 1) {
      const mat = ownMat(color, { transparent: true, opacity, depthWrite: false });
      const m = new T.Mesh(keep(new T.CylinderGeometry(r, r * 0.97, 1, 40)), mat);
      m.scale.y = Math.max(0.05, hgt); at(m, x, y0 + Math.max(0.05, hgt) / 2, z, parent);
      return { m, mat };
    }
    function testTube(parent, x, y0, z, r, hh) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const wg = keep(new T.CylinderGeometry(r, r, hh - r, 28, 1, true));
      const wall = new T.Mesh(wg, glassMat(0xd8eef8, 0.22)); at(wall, 0, r + (hh - r) / 2, 0, g); wall.add(new T.Mesh(wg, kit.hullMat));
      const bg = keep(new T.SphereGeometry(r, 28, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2));
      const bot = new T.Mesh(bg, glassMat(0xd8eef8, 0.22)); at(bot, 0, r, 0, g); bot.add(new T.Mesh(bg, kit.hullMat));
      const rim = mesh(new T.TorusGeometry(r + 0.1, 0.25, 6, 28), 0xeef6fb, { edges: false }); rim.rotation.x = Math.PI / 2; at(rim, 0, hh, 0, g);
      return { g, r, hh };
    }
    function tubeLiquid(parent, r, lv, color, opacity) {
      const mat = ownMat(color, { transparent: true, opacity, depthWrite: false }), g = new T.Group(); parent.add(g);
      const rr = r * 0.88;
      at(new T.Mesh(keep(new T.SphereGeometry(rr, 24, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), mat), 0, r, 0, g);
      if (lv > r) at(new T.Mesh(keep(new T.CylinderGeometry(rr, rr, lv - r, 24)), mat), 0, r + (lv - r) / 2, 0, g);
      return { g, mat };
    }
    function bubbles(parent, x, y0, z, r, n, top, big = 0.45, speed = 0.7) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const geo = keep(new T.SphereGeometry(1, 10, 8)), mat = keep(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }));
      const bs = [];
      for (let i = 0; i < n; i++) { const m = new T.Mesh(geo, mat); g.add(m); bs.push({ m, ph: rnd(i + 11), a: rnd(i + 21) * Math.PI * 2, rr: Math.sqrt(rnd(i + 31)) * r }); }
      kit.onFrame((dt, t) => bs.forEach((b, i) => {
        const ph = kit.reduce ? b.ph : (t * speed + b.ph) % 1;
        b.m.scale.setScalar(big * (0.5 + 0.8 * ph));
        b.m.position.set(Math.cos(b.a) * b.rr + 0.3 * Math.sin(t * 5 + i), 0.4 + ph * (top - 0.9), Math.sin(b.a) * b.rr);
      }));
      return g;
    }
    let dashT = null;
    function dashTex() {
      if (dashT) return dashT;
      const k = canvasTex(64, 8); k.x.fillStyle = '#ffd166'; k.x.fillRect(8, 0, 16, 8);
      dashT = k.tex; dashT.wrapS = T.RepeatWrapping; return dashT;
    }
    function wire(pts, color, flow = 0, r = 0.7) {
      const curve = new T.CatmullRomCurve3(pts, false, 'centripetal');
      const segs = Math.max(30, Math.round(curve.getLength() * 1.4));
      kit.root.add(mesh(new T.TubeGeometry(curve, segs, r, 10), color, { hull: true, edges: false }));
      if (flow > 1e-3) {
        const tex = keep(dashTex().clone()); tex.needsUpdate = true; tex.repeat.set(Math.max(1, curve.getLength() / 10), 1);
        const sl = new T.Mesh(keep(new T.TubeGeometry(curve, segs, r * 1.1, 10)), keep(new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })));
        sl.renderOrder = 2; kit.root.add(sl);
        const sp = 0.4 + 2 * flow;
        if (!kit.reduce) kit.onFrame(dt => { tex.offset.x -= sp * dt; });
      }
      return curve;
    }
    // реактивная бутылка: стекло, раствор, пробка, номер
    function bottle(parent, x, y0, z, col, dry, n) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const body = new T.Mesh(keep(new T.CylinderGeometry(3.2, 3.2, 10, 28, 1, true)), glassMat(0xcfe2ee, 0.3)); at(body, 0, 5, 0, g); body.add(new T.Mesh(body.geometry, kit.hullMat));
      const sh = new T.Mesh(keep(new T.CylinderGeometry(1.4, 3.2, 2.6, 28, 1, true)), glassMat(0xcfe2ee, 0.3)); at(sh, 0, 11.3, 0, g); sh.add(new T.Mesh(sh.geometry, kit.hullMat));
      at(cyl(1.6, 2.4, 0x3a4762), 0, 13.6, 0, g);
      if (dry) { for (let i = 0; i < 14; i++) at(box(1, 1, 1, 0xf4f7fb, { edges: false }), (rnd(i) - 0.5) * 4, 0.8 + rnd(i + 4) * 3, (rnd(i + 8) - 0.5) * 4, g); }
      else liquid(g, 0, 0.3, 0, 2.9, col, 0.55, 7);
      const lab = sticker(3.6, 2.6, String(n), '#1b1610', '#fffaf0', 96); at(lab, 0, 6, 3.25, g);
      return g;
    }
    return { v3, glassMat, ownMat, glow, ball, sticker, flatSticker, tray, beaker, liquid, testTube, tubeLiquid, bubbles, wire, bottle };
  }

  // ===== уроки 1–2: прибор для проверки электропроводности =====
  SC['ions-tester'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const ty = h.tray(g, 0, 2, 124, 80);
    const BX = 0, BZ = -8, R = 11, BH = 22, LV = 14;
    // стакан с образцом
    const bk = h.beaker(g, BX, ty, BZ, R, BH); clickable(bk.g, 'beaker');
    const s = d.s;
    if (s && s.kind === 'dry') {
      const pile = h.ball(8, 0xf2f5fa, { hull: false }); pile.scale.set(1, 0.45, 1); at(pile, BX, ty + 0.6, BZ, g);
      for (let i = 0; i < 18; i++) at(box(1.1, 1.1, 1.1, i % 2 ? CAT : ANI, { edges: false }), BX + (rnd(i) - 0.5) * 9, ty + 1.2 + rnd(i + 3) * 2, BZ + (rnd(i + 7) - 0.5) * 9, g);
    } else if (s) {
      h.liquid(g, BX, ty + 0.6, BZ, R - 0.45, s.col, 0.42, LV);
      // частицы в растворе
      const parts = [], add = (col, r, kind) => { const b = h.ball(r, col, { hull: false, seg: 10, seg2: 8 }); at(b, BX, ty + 4, BZ, g); parts.push({ b, kind, i: parts.length }); };
      if (s.kind === 'non') for (let i = 0; i < 8; i++) add(s.mol === 'сахар' ? 0xe8d6a4 : 0x9fc6e0, 0.6, 'm');
      else {
        const nm = s.kind === 'weak' ? 8 : 0;
        for (let i = 0; i < nm; i++) add(MOL, 0.9, 'm');
        for (let i = 0; i < d.pairs; i++) { add(CAT, 0.75, 'c'); add(ANI, 0.75, 'a'); }
      }
      const flow = d.on && d.b > 0;
      kit.onFrame((dt, t) => parts.forEach(p => {
        const k = p.i, u = rnd(k + 40), w = rnd(k + 50), y = rnd(k + 60);
        let x = (u - 0.5) * 2 * (R - 2.5);
        if (flow && p.kind !== 'm' && !kit.reduce) { const L = 2 * (R - 2.5); x = ((((u * L) + (p.kind === 'c' ? -1 : 1) * t * (1.2 + w)) % L) + L) % L - L / 2; }
        else if (!kit.reduce) x += Math.sin(t * 1.3 + k) * 0.6;
        const zz = (w - 0.5) * 2 * Math.sqrt(Math.max(0, (R - 2.5) ** 2 - x * x));
        p.b.position.set(BX + x, ty + 1.8 + y * (LV - 3), BZ + zz);
      }));
    }
    // крышка с графитовыми электродами
    at(box(2 * R + 6, 1.4, 4, C.DARK), BX, ty + BH + 0.7, BZ, g);
    const rods = [-4, 4].map(dx => { at(cyl(0.75, 24, 0x3b4150, { edges: false }), BX + dx, ty + BH + 1.4 - 10, BZ, g); return v3(BX + dx, ty + BH + 3.2, BZ); });
    at(box(1.6, 1.6, 1.6, 0x2f6fd8), rods[0].x, rods[0].y - 1, BZ, g); at(box(1.6, 1.6, 1.6, 0xe0473a), rods[1].x, rods[1].y - 1, BZ, g);
    // батарейка 4,5 В с выключателем
    const bat = new T.Group(); at(bat, -26, ty, -18, g);
    at(box(14, 8, 7, 0xf2c94c), 0, 4, 0, bat);
    const bl = h.sticker(9, 3, '4,5 В', '#1b1610', '#fffaf0', 160); at(bl, -1, 4.5, 3.55, bat);
    at(cyl(0.8, 1.2, 0x2f6fd8), -4.5, 8.6, 0, bat); at(cyl(0.8, 1.2, 0xe0473a), 4.5, 8.6, 0, bat);
    const sw = new T.Group(); at(sw, 0, 8, 0, bat); clickable(sw, 'sw');
    at(box(4.4, 1.2, 3, d.on ? 0x86e0a8 : 0x56627d), 0, 0.6, 0, sw); const knob = at(box(1.6, 1.4, 2.4, 0xe8ecf4), d.on ? 1.2 : -1.2, 1.5, 0, sw);
    // лампочка в патроне
    const bulb = kit.bulb({ glow: d.b * 1.2, value: '' }); const bN = kit.placeOn(bulb, v3(26, ty, -18), 0, 'lamp');
    const flow = d.on ? d.b : 0;
    const bm = v3(-30.5, ty + 9.2, -18), bp = v3(-21.5, ty + 9.2, -18);
    h.wire([rods[0], v3(rods[0].x - 3, rods[0].y + 4, BZ), v3(-14, ty + 14, -14), v3(-30.5, ty + 12, -16), bm], 0x2a2f3a, 0, 0.5);
    h.wire([bp, v3(-14, ty + 11, -20), v3(4, ty + 6, -24), v3(16, ty + 3, -22), bN.tin], C.WIRE.plus, flow, 0.55);
    h.wire([bN.tout, v3(30, ty + 4, -12), v3(16, ty + 16, -8), v3(rods[1].x + 3, rods[1].y + 4, BZ), rods[1]], C.WIRE.mid, flow, 0.55);
    // бутылки
    const strongL = d.lesson === 'strong', front = [], sortedS = [], sortedW = [];
    d.bottles.forEach((b, i) => { if (b.zone === 'strong') sortedS.push(i); else if (b.zone === 'weak') sortedW.push(i); else front.push(i); });
    const N = d.bottles.length, x0 = -((N - 1) * 14) / 2 - (strongL ? 10 : 0);
    d.bottles.forEach((b, i) => {
      let x = x0 + i * 14, z = 26;
      if (b.zone) { const list = b.zone === 'strong' ? sortedS : sortedW; x = 44 + list.indexOf(i) * 7.5; z = b.zone === 'strong' ? 10 : 26; }
      const bg = h.bottle(g, x, ty + (b.zone ? 1.2 : 0), z, b.col, b.dry, i + 1); clickable(bg, 'b' + i);
      if (d.at === i) { at(h.glow(0xffd166, 14, 0.35), x, ty + 8, z, g); }
      if (!b.zone) h.flatSticker(g, x, ty + 0.1, z + 6.5, 11, 3.6, b.f + (b.dry ? ' тв.' : ''), '#1b1610', b.tested ? (b.bright > 0.5 ? '#b8f0c8' : b.bright > 0.01 ? '#ffe2a8' : '#e8ecf4') : '#fffaf0', 220);
    });
    if (strongL) {
      for (const [z, lab, col] of [[10, 'сильные', 0x4a7aa6], [26, 'слабые', 0x7a5ea6]]) {
        at(box(26, 1.2, 10, col), 51.5, ty + 0.6, z, g);
        h.flatSticker(g, 51.5, ty + 1.3, z + 3.6, 14, 3, lab, '#1b1610', '#fff6e6', 200);
      }
    }
    const what = s ? (s.kind === 'strong' || s.kind === 'weak' ? s.eq : s.f + (s.kind === 'dry' ? ' (тв.)' : '')) + (d.c ? ' · ' + d.c + ' моль/л' : '') : 'выберите бутылку';
    tag(v3(BX, ty + BH + 12, BZ), s ? 'В стакане' : 'Стакан пуст', what, d.b > 0.5);
    tag(v3(26, ty + 22, -18), 'Лампочка', (!d.on ? 'ток выключен' : d.b > 0.5 ? 'ярко' : d.b > 0.01 ? 'тускло' : 'не горит') + (s && d.on ? ' · ' + d.I + (d.lesson === 'strong' && d.alpha ? ' · α ' + d.alpha : '') : ''), d.b > 0.5);
  };

  // ===== урок 3: реакции ионного обмена =====
  SC['ions-mix'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const ty = h.tray(g, 0, 2, 124, 80);
    // штатив с двумя пробирками
    const rk = new T.Group(); at(rk, -26, ty, -4, g); clickable(rk, 'mix');
    at(box(26, 1, 10, C.WOOD2), 0, 0.5, 0, rk); at(box(26, 1, 10, C.WOOD2), 0, 14, 0, rk);
    for (const x of [-12, 12]) at(box(1.2, 14, 1.2, C.WOOD), x, 7, 4, rk), at(box(1.2, 14, 1.2, C.WOOD), x, 7, -4, rk);
    [[-6, d.A], [6, d.B]].forEach(([x, f]) => {
      const tt = h.testTube(rk, x, 1, 0, 2.2, 22);
      if (!d.mixed) h.tubeLiquid(tt.g, 2.2, 10, 0xdfe7ee, 0.5);
      const s = h.sticker(7, 2.6, f, '#1b1610', '#fffaf0', 200); at(s, x, 26.5, 0, rk);
    });
    // стакан, куда сливают
    const BX = 22, BZ = -4, R = 10, BH = 18;
    const bk = h.beaker(g, BX, ty, BZ, R, BH); clickable(bk.g, 'reset');
    if (d.mixed) {
      const cloudy = d.rx === 'ba';
      h.liquid(g, BX, ty + 0.6, BZ, R - 0.45, cloudy ? 0xeef2f7 : 0xcfe6f5, cloudy ? 0.75 : 0.35, 12);
      if (cloudy) {
        const pts = []; for (let i = 0; i < 40; i++) { const b = h.ball(0.35 + rnd(i) * 0.3, 0xffffff, { hull: false, seg: 6, seg2: 5 }); at(b, BX, ty + 2, BZ, g); pts.push(b); }
        let t0 = null;
        kit.onFrame((dt, t) => { if (t0 === null) t0 = t; const f = kit.reduce ? 1 : clamp((t - t0) / 3, 0, 1); pts.forEach((b, i) => { const a = rnd(i + 9) * 6.28, rr = Math.sqrt(rnd(i + 3)) * (R - 2); b.position.set(BX + Math.cos(a) * rr, ty + 1.2 + (1 - f) * rnd(i + 5) * 10, BZ + Math.sin(a) * rr); }); });
        const layer = cyl(R - 0.8, 1.2, 0xffffff, { edges: false, hull: false }); at(layer, BX, ty + 1.2, BZ, g);
      }
      if (d.rx === 'g') h.bubbles(g, BX, ty + 0.8, BZ, R - 3, 22, 11, 0.5, 0.9);
      if (d.rx === 'w' && !kit.reduce) { const gw = h.glow(0xffb547, 18, 0.25); at(gw, BX, ty + BH + 2, BZ, g); kit.onFrame((dt, t) => { gw.material.opacity = 0.15 + 0.12 * Math.sin(t * 3); }); }
    }
    // табличка с реакцией — нажатие меняет реакцию
    const card = new T.Group(); at(card, 0, ty, 26, g); clickable(card, 'rx');
    at(box(64, 1, 13, 0x1a2438), 0, 0.5, 0, card);
    h.flatSticker(card, 0, 1.1, 0, 60, 10, d.mol + (d.short ? '\n' + d.short : ''), '#1b1610', d.ok ? '#b8f0c8' : '#fff6e6', 900);
    // флаконы-признаки: осадок, вода, газ
    tag(v3(BX, ty + BH + 10, BZ), d.mixed ? (d.rx === 'no' ? 'Ничего не произошло' : 'Признак: ' + d.sign) : 'Нажмите на пробирки', d.mixed ? (d.rx === 'ba' ? 'белый осадок BaSO₄' : d.rx === 'w' ? 'раствор нагрелся' : d.rx === 'g' ? 'пузырьки CO₂' : 'ионы просто смешались') : d.title, d.mixed && d.rx !== 'no');
    tag(v3(-26, ty + 32, -4), 'Решено', d.solved + ' из 3', d.solved === 3);
  };

  // ===== урок 4: гидролиз солей =====
  SC['ions-hyd'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const ty = h.tray(g, 0, 2, 124, 80);
    // штатив с тремя пробирками
    const RZ = -10, X = [-14, 2, 18];
    at(box(46, 1, 10, C.WOOD2), 2, ty + 0.5, RZ, g); at(box(46, 1, 10, C.WOOD2), 2, ty + 15, RZ, g);
    for (const x of [-20, 24]) at(box(1.2, 15, 1.2, C.WOOD), x, ty + 7.5, RZ + 4, g), at(box(1.2, 15, 1.2, C.WOOD), x, ty + 7.5, RZ - 4, g);
    d.tubes.forEach((tb, i) => {
      const tg = new T.Group(); at(tg, X[i], ty + 1, RZ, g); clickable(tg, 'tube' + i);
      const tt = h.testTube(tg, 0, 0, 0, 2.6, 24);
      if (tb.f) h.tubeLiquid(tt.g, 2.6, 13, tb.col, 0.85);
      if (d.act === i) at(h.glow(0xffd166, 16, 0.4), 0, 12, 0, tg);
      const s = h.sticker(9, 3, tb.lab, '#1b1610', tb.ok ? '#b8f0c8' : d.act === i ? '#ffd166' : '#fffaf0', 200); at(s, 0, 28, 0, tg);
      if (tb.f) tag(v3(X[i], ty + 34, RZ), 'Пробирка ' + (i + 1), tb.f + ' · pH ' + tb.pH, tb.ok);
    });
    // склянка с индикатором
    const ib = new T.Group(); at(ib, 36, ty, RZ, g);
    at(cyl(3, 8, 0xcfe2ee, { matOpt: { transparent: true, opacity: 0.45 } }), 0, 4, 0, ib); at(cyl(2.6, 5, 0xe9e21f, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.7 } }), 0, 3, 0, ib);
    at(cyl(1.2, 3, 0x2a3348), 0, 9.5, 0, ib); at(h.ball(1.6, 0x2a3348), 0, 11.6, 0, ib);
    // шкала pH на подносе
    for (let i = 0; i <= 14; i++) at(box(3.4, 0.3, 4, PAL[i], { edges: false }), -24 + i * 3.4, ty + 0.15, 8, g);
    h.flatSticker(g, -24, ty + 0.35, 12.5, 4, 2.4, '0', '#1b1610', '#fffaf0', 64); h.flatSticker(g, -24 + 7 * 3.4, ty + 0.35, 12.5, 4, 2.4, '7', '#1b1610', '#fffaf0', 64); h.flatSticker(g, -24 + 14 * 3.4, ty + 0.35, 12.5, 4, 2.4, '14', '#1b1610', '#fffaf0', 64);
    // банки с солями
    d.salts.forEach((s, i) => {
      const x = -40 + i * 16, jg = new T.Group(); at(jg, x, ty, 26, g); clickable(jg, 'salt-' + s.id);
      const wall = new T.Mesh(kit.keep(new T.CylinderGeometry(4, 4, 8, 28, 1, true)), h.glassMat(0xcfe2ee, 0.3)); at(wall, 0, 4, 0, jg); wall.add(new T.Mesh(wall.geometry, kit.hullMat));
      at(cyl(3.7, 4.5, s.col, { edges: false, hull: false }), 0, 2.4, 0, jg);
      at(cyl(4.3, 1.4, d.last === s.id ? 0xffb547 : 0x3a4762), 0, 8.7, 0, jg);
      const lab = h.sticker(10, 3, s.f, '#1b1610', '#fffaf0', 220); at(lab, 0, 4.4, 4.05, jg);
    });
  };
})();
