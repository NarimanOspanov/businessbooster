// «Как в жизни» для химии: «Азотсодержащие органические вещества» (labs/chem-nitrorg).
// Белый лабораторный поднос, модели молекул из шариков (азот — голубой), пробирки с индикаторами, склянки, лимон,
// колба над спиртовкой и лоскут шёлка для красителя Перкина; в третьем уроке — модель цепи из фрагментов.
// Сцены строятся из window.LUCH_REAL() опыта; нажатия уходят в window.LUCH_REAL.click(key).
(() => {
  const SC = window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {};
  const rnd = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const hexs = c => '#' + c.toString(16).padStart(6, '0');
  const CC = 0x4f586d, HC = 0xeef2f8, OC = 0xe5604f, NC = 0x3d6fe0, BRC = 0xa8432f;

  // ---------- общие детали ----------
  function H(kit) {
    const { T, at, box, cyl, mesh, keep, grad, glowTex, textTex, clickable, C } = kit;
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    const glassMat = (color = 0xd8eef8, opacity = 0.24) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, transparent: true, opacity, side: T.DoubleSide, depthWrite: false }));
    const ownMat = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, ...o }));
    const glow = (color, size, opacity) => { const s = new T.Sprite(keep(new T.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending }))); s.scale.setScalar(size); return s; };
    const flat = (w, h, tex) => new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: keep(tex), transparent: true })));
    const ball = (r, color, o = {}) => mesh(new T.SphereGeometry(r, o.seg || 18, o.seg2 || 12), color, { hull: o.hull ?? true, edges: false, matOpt: o.matOpt, shadow: o.shadow });
    const glassy = (geo, color = 0xd8eef8, op = 0.22) => { const m = new T.Mesh(keep(geo), glassMat(color, op)); m.add(new T.Mesh(m.geometry, kit.hullMat)); return m; };
    function rodAB(parent, a, b, r, color, o = {}) {
      const dv = b.clone().sub(a), L = dv.length();
      const m = cyl(r, L, color, { edges: false, ...o });
      m.quaternion.setFromUnitVectors(v3(0, 1, 0), dv.normalize());
      return at(m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, parent);
    }
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
      k.x.clearRect(0, 0, pw, ph); k.x.fillStyle = bg; const r = ph * 0.18;
      k.x.beginPath(); k.x.roundRect ? k.x.roundRect(2, 2, pw - 4, ph - 4, r) : k.x.rect(2, 2, pw - 4, ph - 4); k.x.fill();
      k.x.strokeStyle = '#1b1610'; k.x.lineWidth = 4; k.x.stroke();
      drawLines(k.x, pw, ph, String(txt).split('\n'), fg); k.tex.needsUpdate = true;
      return new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: k.tex, transparent: true })));
    }
    function floorSticker(parent, x, y, z, w, hh, txt, fg, bg, pw) { const s = sticker(w, hh, txt, fg, bg, pw); s.rotation.x = -Math.PI / 2; return at(s, x, y + 0.06, z, parent); }
    function button(parent, x, y, z, label, color, key, w = 4.2, d = 3.6) {
      const b = new T.Group(); at(b, x, y, z, parent);
      at(box(w, 1.4, d, color), 0, 0.7, 0, b);
      const top = flat(w * 0.86, d * 0.8, textTex(label, '#ffffff', hexs(color), Math.round(128 * w / 4.2), 96));
      top.rotation.x = -Math.PI / 2; at(top, 0, 1.42, 0, b);
      clickable(b, key); return b;
    }
    function modeSign(parent, x, y, z, label, on, key, w = 13) {
      const b = new T.Group(); at(b, x, y, z, parent);
      at(box(w, 1.2, 5, on ? 0x2f6fd8 : 0xdfe5ec), 0, 0.6, 0, b);
      const s = flat(w * 0.9, 4.2, textTex(label, on ? '#ffffff' : '#1b1610', on ? '#2f6fd8' : '#dfe5ec', 256, 80)); s.rotation.x = -Math.PI / 2; at(s, 0, 1.22, 0, b);
      clickable(b, key); return b;
    }
    function tray(parent, x, z, w, d) {
      at(box(w, 1, d, 0xf1f3f5), x, 0.5, z, parent);
      const nx = Math.floor(w / 12), nz = Math.floor(d / 12);
      for (let i = 1; i < nx; i++) at(box(0.25, 0.06, d - 0.6, 0xc9d1da, { edges: false, shadow: false }), x - w / 2 + i * w / nx, 1.03, z, parent);
      for (let i = 1; i < nz; i++) at(box(w - 0.6, 0.06, 0.25, 0xc9d1da, { edges: false, shadow: false }), x, 1.03, z - d / 2 + i * d / nz, parent);
      return 1;
    }
    function liquid(parent, x, y0, z, r, color, opacity = 0.62) {
      const m = new T.Mesh(keep(new T.CylinderGeometry(r, r * 0.97, 1, 40)), ownMat(color, { transparent: true, opacity, depthWrite: false }));
      at(m, x, y0, z, parent);
      return { m, set(hgt) { m.visible = hgt > 0.05; m.scale.y = Math.max(0.05, hgt); m.position.y = y0 + Math.max(0.05, hgt) / 2; } };
    }
    function testTube(parent, x, y0, z, r, hh) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const wall = glassy(new T.CylinderGeometry(r, r, hh - r, 28, 1, true)); at(wall, 0, r + (hh - r) / 2, 0, g);
      const bot = glassy(new T.SphereGeometry(r, 28, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)); at(bot, 0, r, 0, g);
      const rim = mesh(new T.TorusGeometry(r + 0.1, 0.25, 6, 28), 0xeef6fb, { edges: false }); rim.rotation.x = Math.PI / 2; at(rim, 0, hh, 0, g);
      return { g, r, hh };
    }
    function tubeLiquid(parent, r, lv, color, opacity) {
      const mat = ownMat(color, { transparent: true, opacity, depthWrite: false }), g = new T.Group(); parent.add(g);
      const rr = r * 0.88;
      at(new T.Mesh(keep(new T.SphereGeometry(rr, 24, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), mat), 0, r, 0, g);
      if (lv > r) at(new T.Mesh(keep(new T.CylinderGeometry(rr, rr, lv - r, 24)), mat), 0, r + (lv - r) / 2, 0, g);
      return g;
    }
    function tubeLayer(parent, r, y0, y1, color, opacity) {
      return at(new T.Mesh(keep(new T.CylinderGeometry(r * 0.88, r * 0.88, y1 - y0, 24)), ownMat(color, { transparent: true, opacity, depthWrite: false })), 0, (y0 + y1) / 2, 0, parent);
    }
    function bottle(parent, x, y0, z, o = {}) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const r = o.r || 3.6, h = o.h || 9, gc = o.glass ?? 0xd8eef8;
      const wall = glassy(new T.CylinderGeometry(r, r, h, 28, 1, true), gc, o.op ?? 0.32); at(wall, 0, h / 2, 0, g);
      at(cyl(r, 0.5, gc, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.5 } }), 0, 0.25, 0, g);
      const sh = glassy(new T.CylinderGeometry(r * 0.42, r, r * 0.7, 28, 1, true), gc, o.op ?? 0.32); at(sh, 0, h + r * 0.35, 0, g);
      if (o.liq != null) { const lq = liquid(g, 0, 0.5, 0, r * 0.92, o.liq, o.lop ?? 0.6); lq.set(h * (o.fill ?? 0.62)); }
      at(cyl(r * 0.46, 2.2, o.cap ?? 0x2c3240), 0, h + r * 0.7 + 1.1, 0, g);
      if (o.label) { const s = sticker(r * 1.7, o.lh || r * 1.1, o.label, o.fg || '#1b1610', o.bg || '#fffaf0', 200); at(s, 0, h * 0.5, r + 0.06, g); }
      if (o.key) clickable(g, o.key);
      return { g, top: h + r * 0.7 + 2.2 };
    }
    let puffT = null;
    function puffTex() {
      if (puffT) return puffT;
      const k = canvasTex(64, 64), gr = k.x.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.5, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      k.x.fillStyle = gr; k.x.fillRect(0, 0, 64, 64); puffT = k.tex; return puffT;
    }
    function puffs(parent, x, y, z, o = {}) {
      const n = o.n || 6, ps = [], g = new T.Group(); at(g, x, y, z, parent);
      for (let i = 0; i < n; i++) { const s = new T.Sprite(keep(new T.SpriteMaterial({ map: puffTex(), color: o.color ?? 0xffffff, transparent: true, opacity: 0, depthWrite: false }))); g.add(s); ps.push({ s, ph: i / n, dx: (rnd(i + 3) - 0.5) * (o.spread ?? 6), dz: (rnd(i + 9) - 0.5) * (o.spread ?? 6) }); }
      kit.onFrame((dt, t) => {
        for (const p of ps) {
          const ph = kit.reduce ? 0.15 + p.ph * 0.7 : (t * (o.speed || 0.3) + p.ph) % 1;
          p.s.position.set(p.dx * (0.6 + ph), ph * (o.rise ?? 10), p.dz * (0.6 + ph));
          p.s.scale.setScalar((o.size || 4) * (0.6 + ph * 1.3));
          p.s.material.opacity = (o.op ?? 0.5) * Math.sin(Math.PI * ph);
        }
      });
      return g;
    }
    function spirit(parent, x, y, z, on, s = 1, key) {
      const g = new T.Group(); at(g, x, y, z, parent); if (key) clickable(g, key);
      at(cyl(4.2 * s, 5 * s, 0xbfe3f2, { r2: 2.9 * s, matOpt: { transparent: true, opacity: 0.6 } }), 0, 2.5 * s, 0, g);
      at(cyl(1.6 * s, 1.5 * s, C.BRASS), 0, 5.7 * s, 0, g);
      at(cyl(0.5 * s, 1.3 * s, 0xf4efe2, { hull: false }), 0, 7 * s, 0, g);
      if (on) {
        const f = new T.Group(); at(f, 0, 7.5 * s, 0, g);
        const hgt = 8 * s;
        at(cyl(1.4 * s, hgt, 0xff8a2a, { r2: 0.05, edges: false, hull: false, shadow: false, matOpt: { emissive: 0xff6a10, emissiveIntensity: 0.9, transparent: true, opacity: 0.85 } }), 0, hgt / 2, 0, f);
        at(glow(0xff9a40, hgt * 2.2, 0.55), 0, hgt * 0.45, 0, f);
        at(new T.PointLight(0xffa040, 22 * s, 40, 1.4), 0, hgt * 0.5, 0, f);
        if (!kit.reduce) kit.onFrame((dt, t) => { f.scale.set(1 + 0.06 * Math.sin(t * 17), 1 + 0.1 * Math.sin(t * 11), 1 + 0.06 * Math.cos(t * 15)); });
      } else at(cyl(2 * s, 2.8 * s, 0xbfe3f2, { r2: 1.6 * s, matOpt: { transparent: true, opacity: 0.55 } }), 0, 7.3 * s, 0, g);
      return g;
    }
    function rack(parent, x, z, w, ty) {
      at(box(w, 1.4, 9, C.WOOD2), x, ty + 0.7, z, parent);
      at(box(w, 1.2, 9, C.WOOD), x, ty + 9, z, parent);
      for (const sx of [-w / 2 + 0.7, w / 2 - 0.7]) at(box(1.4, 9, 8, C.WOOD2), x + sx, ty + 4.9, z, parent);
    }
    const halo = (parent, x, y, z, size = 16) => at(glow(0xffd166, size, 0.4), x, y, z, parent);
    function zone(parent, x, z, sc, ty = 1) {
      const zg = new T.Group(); at(zg, x, ty * (1 - sc), z, parent); zg.scale.setScalar(sc);
      zg.userData.W = (a, b, c) => v3(x + a * sc, ty * (1 - sc) + b * sc, z + c * sc); return zg;
    }
    return { v3, ownMat, glow, flat, ball, glassy, rodAB, sticker, floorSticker, button, modeSign, tray, liquid, testTube, tubeLiquid, tubeLayer, bottle, puffs, spirit, rack, halo, zone };
  }

  // связь: одинарная или двойная
  function bond(kit, h, parent, a, b, dbl, col = 0xc8d1e2) {
    if (!dbl) { h.rodAB(parent, a, b, 0.36, col); return; }
    const dv = b.clone().sub(a), n = new kit.T.Vector3(0, 0, 1).cross(dv).normalize().multiplyScalar(0.45);
    if (n.lengthSq() < 1e-6) n.set(0.45, 0, 0);
    h.rodAB(parent, a.clone().add(n), b.clone().add(n), 0.26, 0x72d4e8); h.rodAB(parent, a.clone().sub(n), b.clone().sub(n), 0.26, 0x72d4e8);
  }
  // атом с водородами в заданных направлениях
  function atomH(kit, h, parent, p, r, col, hDirs, hLen = 2.5) {
    kit.at(h.ball(r, col, { seg: 16, seg2: 12 }), p.x, p.y, p.z, parent);
    hDirs.forEach(d => { const q = p.clone().addScaledVector(d.clone().normalize(), hLen); bond(kit, h, parent, p, q, false); kit.at(h.ball(0.95, HC, { seg: 12, seg2: 8 }), q.x, q.y, q.z, parent); });
  }

  // ===== 1. Амины: модель молекулы с неподелённой парой, пробирка, фенолфталеин, HCl, лимон =====
  SC['nitro-amine'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const ty = h.tray(g, 0, 2, 124, 80);
    // --- модель на подставке ---
    const MX = -4, MZ = 20, base = new T.Group(); at(base, MX, ty, MZ, g); base.scale.setScalar(1.5); clickable(base, 'next');
    at(cyl(6.5, 1.4, C.WOOD2), 0, 0.7, 0, base); at(cyl(0.45, 11, C.STEEL, { edges: false }), 0, 1.4 + 5.5, 0, base);
    const mol = new T.Group(); at(mol, 0, 16, 0, base);
    const N0 = v3(0, 0, 0);
    at(h.ball(1.9, NC, { seg: 20, seg2: 14 }), 0, 0, 0, mol);
    const DIRS = [v3(-0.94, -0.33, 0), v3(0.47, -0.33, 0.82), v3(0.47, -0.33, -0.82)];
    DIRS.forEach((dv, i) => {
      if (d.sub[i]) {
        const c = dv.clone().multiplyScalar(4.2); bond(kit, h, mol, N0, c, false);
        const away = dv.clone(), ax = new T.Vector3(0, 1, 0).cross(away).normalize(); if (ax.lengthSq() < 1e-6) ax.set(1, 0, 0);
        const hs = [0, 1, 2].map(k => away.clone().multiplyScalar(0.34).add(ax.clone().applyAxisAngle(away, k * 2.094).multiplyScalar(0.94)));
        atomH(kit, h, mol, c, 1.75, CC, hs, 2.4);
      } else { const q = dv.clone().multiplyScalar(2.9); bond(kit, h, mol, N0, q, false); at(h.ball(0.95, HC, { seg: 12, seg2: 8 }), q.x, q.y, q.z, mol); }
    });
    if (d.prot) {
      const q = v3(0, 3, 0); h.rodAB(mol, N0, q, 0.36, 0xffb547); at(h.ball(1, HC, { seg: 12, seg2: 8 }), q.x, q.y, q.z, mol); at(h.glow(0xffb547, 8, 0.5), q.x, q.y, q.z, mol);
    } else {
      const lp = new T.Mesh(kit.keep(new T.SphereGeometry(1.2, 18, 12)), h.ownMat(0xffb547, { transparent: true, opacity: 0.45, depthWrite: false }));
      lp.scale.set(1, 1.7, 1); at(lp, 0, 3, 0, mol); at(h.ball(0.32, 0xffb547, { hull: false }), -0.45, 3.4, 0.9, mol); at(h.ball(0.32, 0xffb547, { hull: false }), 0.45, 3.4, 0.9, mol);
      at(h.glow(0xffb547, 7, 0.35), 0, 3, 0, mol);
    }
    if (!kit.reduce) kit.onFrame((dt, t) => { mol.rotation.y = 0.6 * Math.sin(t * 0.45); });
    tag(v3(MX, ty + 31, MZ), d.name + ' ' + d.f, d.prot ? d.ion + ' · пара занята' : 'неподелённая пара свободна', d.prot);
    h.floorSticker(g, MX - 30, ty, MZ + 4, 30, 6, d.prot ? d.ion : d.f + ' · нажмите — дальше', '#1b1610', '#fffaf0', 360);
    h.button(g, -40, ty, 10, '+ H⁺', 0xe08a2a, 'proton', 7, 4);
    h.button(g, -26, ty, 10, 'Заново', 0x56627d, 'reset', 9, 4);
    // --- пробирка в штативе ---
    const R = h.zone(g, 16, -14, 1.4), W = R.userData.W;
    h.rack(R, 0, 0, 10, ty);
    const tb = h.testTube(R, 0, ty + 1.6, 0, 2.4, 22);
    if (d.ind && !d.acid) h.tubeLiquid(tb.g, 2.4, 10, 0xd6337a, 0.85);
    else if (d.acid === 'lemon') h.tubeLiquid(tb.g, 2.4, 11, 0xf3e7a0, 0.5);
    else if (d.acid) h.tubeLiquid(tb.g, 2.4, 11, 0xe2e8f0, 0.38);
    else h.tubeLiquid(tb.g, 2.4, 9, 0xd7ecf7, 0.35);
    if (d.smell) h.puffs(R, 0, ty + 25, 0, { n: 6, spread: 4, rise: 9, size: 3.2, op: 0.5, color: d.fish ? 0xb6e6a4 : 0xe8ecf4 });
    const res = d.acid === 'hcl' ? ['+ HCl', 'соль, запаха нет'] : d.acid === 'lemon' ? ['+ лимон', 'соль, запаха нет'] : d.ind ? ['Фенолфталеин', 'малиновый: среда щелочная'] : ['Раствор ' + d.f, d.smell ? 'запах: ' + d.smell : ''];
    tag(W(0, ty + 30, 0), res[0], res[1], !!(d.acid || d.ind));
    // --- склянки и лимон ---
    const ff = h.bottle(g, 38, ty, -18, { r: 3.2, h: 8, liq: 0xf1f4f8, lop: 0.4, fill: 0.5, label: 'ф-ф', key: 'ind' }); ff.g.scale.setScalar(1.3);
    if (d.ind) h.halo(ff.g, 0, 1, 0, 16);
    const hc = h.bottle(g, 52, ty, -18, { r: 3.2, h: 8, liq: 0xf1f4f8, lop: 0.4, fill: 0.5, cap: 0xe0473a, label: 'HCl', key: 'hcl' }); hc.g.scale.setScalar(1.3);
    if (d.acid === 'hcl') h.halo(hc.g, 0, 1, 0, 16);
    const lm = new T.Group(); at(lm, 44, ty, 4, g); clickable(lm, 'lemon');
    const half = kit.mesh(new T.SphereGeometry(4.6, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), 0xf2d33a, { edges: false, hull: true }); half.scale.set(1, 0.8, 1.25); at(half, 0, 0.1, 0, lm);
    const cut = new T.Mesh(kit.keep(new T.CircleGeometry(4.3, 24)), h.ownMat(0xf8e98a)); cut.rotation.x = -Math.PI / 2; cut.scale.set(1, 1.25, 1); at(cut, 0, 0.12, 0, lm);
    for (let k = 0; k < 4; k++) { const sg = box(8, 0.06, 0.25, 0xe9cc3b, { edges: false, shadow: false }); sg.rotation.y = k * Math.PI / 4; at(sg, 0, 0.16, 0, lm); }
    lm.rotation.x = -0.5; lm.position.y = ty + 2.6;
    if (d.acid === 'lemon') h.halo(lm, 0, 0, 0, 16);
    tag(v3(44, ty + 8, 4), 'Лимон', 'лимонная кислота');
    const G = ['H⁺ к азоту', 'щелочная среда', 'соль с HCl', 'лимон и рыба'];
    h.floorSticker(g, 40, ty, 28, 34, 12, G.map((s, i) => (d.got[i] ? '✓ ' : '· ') + s).join('\n'), '#1b1610', '#eef7ee', 420);
  };

  // ===== 2. Анилин: сила оснований, бромная вода, синтез мовеина и парацетамола =====
  SC['nitro-anil'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const ty = h.tray(g, 0, 2, 124, 80);
    [['pH', 'ph'], ['Br₂', 'br'], ['Синтез', 'syn']].forEach(([n, k], i) => h.modeSign(g, -40 + i * 15, ty, 34, n, d.mode === k, 'm-' + k, 13));
    if (d.mode === 'ph') {
      const R = h.zone(g, -10, 0, 1.35), W = R.userData.W, XS = [-11, 0, 11];
      h.rack(R, 0, 0, 36, ty);
      d.tubes.forEach((tb, i) => {
        const tg = new T.Group(); at(tg, XS[i], ty + 1.6, 0, R); clickable(tg, 'p' + i);
        const t = h.testTube(tg, 0, 0, 0, 2.3, 20);
        h.tubeLiquid(t.g, 2.3, 9, tb.col ? parseInt(tb.col.slice(1), 16) : 0xd7ecf7, tb.col ? 0.9 : 0.35);
        const k = d.rank.indexOf(i);
        const s = h.sticker(6.4, 2.6, tb.f, '#1b1610', k >= 0 ? '#c9f2d8' : '#fffaf0', 200); at(s, 0, 14, 2.4, tg);
        if (k >= 0) { const n = h.sticker(2.6, 2.6, String(k + 1), '#1b1610', '#86e0a8', 96); at(n, 0, 17.4, 2.45, tg); }
        tag(W(XS[i], ty + 26, 0), tb.name, tb.ph ? 'pH ' + tb.ph : d.ui ? 'нажмите' : '');
      });
      const ui = h.bottle(g, 26, ty, -14, { r: 3.4, h: 9, liq: 0x7cc35a, lop: 0.7, fill: 0.55, label: 'универс.\nиндикатор', lh: 4, key: 'ui' }); ui.g.scale.setScalar(1.25);
      if (d.ui) h.halo(ui.g, 0, 1, 0, 16);
      const names = d.rank.map(i => d.tubes[i].name);
      h.floorSticker(g, 38, ty, 20, 36, 13, ['от слабого к сильному:', ...[0, 1, 2].map(k => (k + 1) + '. ' + (names[k] || '…'))].join('\n'), '#1b1610', d.got[0] ? '#eef7ee' : '#fffaf0', 420);
      // шкала индикатора на подносе
      const sc = new T.Group(); at(sc, 40, ty, -14, g);
      ['#e8553a', '#f2c94c', '#7cc35a', '#36a88a', '#2f86c8', '#3d5fc4', '#5b45b0', '#7a3aa0'].forEach((c, k) => at(box(2.2, 0.4, 3, parseInt(c.slice(1), 16), { edges: false }), -7.7 + k * 2.2, 0.2, 0, sc));
      tag(v3(40, ty + 4, -14), 'Шкала pH', '4 … 13');
      return;
    }
    if (d.mode === 'br') {
      const R = h.zone(g, -10, 2, 1.4), W = R.userData.W, XS = [-7, 7], NM = ['бензол', 'анилин'];
      h.rack(R, 0, 0, 26, ty);
      XS.forEach((x, i) => {
        const sel = d.sel === i, tg = new T.Group(); at(tg, x, ty + 1.6 + (sel ? 4 : 0), 0, R); clickable(tg, 'b' + i);
        const t = h.testTube(tg, 0, 0, 0, 2.4, 22), st = d.st[i];
        if (st === 'none') h.tubeLiquid(t.g, 2.4, 8, i ? 0xf1e6cf : 0xe8ecf4, 0.35);
        else if (i === 0) { h.tubeLiquid(t.g, 2.4, 8, 0xf4e3b0, 0.4); h.tubeLayer(t.g, 2.4, 8, 13, 0xe8913a, 0.8); }
        else if (st === 'run') h.tubeLiquid(t.g, 2.4, 13, 0xe8913a, 0.55);
        else { h.tubeLiquid(t.g, 2.4, 13, 0xeef0ec, 0.4); for (let k = 0; k < 14; k++) at(h.ball(0.35 + rnd(k) * 0.25, 0xfbfbf6, { hull: false, seg: 8, seg2: 6 }), (rnd(k + 2) - 0.5) * 3, 0.8 + rnd(k + 5) * 2, (rnd(k + 9) - 0.5) * 3, t.g); }
        const s = h.sticker(6.6, 2.6, NM[i], '#1b1610', sel ? '#ffd166' : '#fffaf0', 200); at(s, 0, 15, 2.5, tg);
        if (sel) h.halo(tg, 0, 6, 0, 14);
        tag(W(x, ty + 30, 0), NM[i], st === 'none' ? '' : st === 'run' ? '…' : i ? 'белый осадок' : 'реакции нет', st === 'done' && i === 1);
      });
      const bw = h.bottle(g, 18, ty, -10, { r: 3.4, h: 9, liq: 0xe8913a, lop: 0.75, fill: 0.6, cap: 0x8a4a1a, label: 'Br₂\nводн.', lh: 4, key: 'brw' }); bw.g.scale.setScalar(1.3);
      // модель анилина: кольцо из шариков и NH₂
      const mg = new T.Group(); at(mg, 40, ty + 14, -2, g); mg.scale.setScalar(1.4);
      const brDone = d.sel === 1 && d.st[1] === 'done';
      const V = [0, 1, 2, 3, 4, 5].map(k => v3(3 * Math.cos(Math.PI / 2 + k * Math.PI / 3), 3 * Math.sin(Math.PI / 2 + k * Math.PI / 3), 0));
      V.forEach((p, k) => { at(h.ball(1.15, CC, { seg: 14, seg2: 10 }), p.x, p.y, p.z, mg); bond(kit, h, mg, p, V[(k + 1) % 6], k % 2 === 0); });
      V.forEach((p, k) => {
        if (k === 0 && d.sel === 1) { const q = p.clone().multiplyScalar(1.85); bond(kit, h, mg, p, q, false); atomH(kit, h, mg, q, 1.4, NC, [v3(-0.7, 0.7, 0.3), v3(0.7, 0.7, 0.3)], 2); return; }
        const isBr = brDone && (k === 1 || k === 3 || k === 5);
        const q = p.clone().multiplyScalar(isBr ? 1.9 : 1.62); bond(kit, h, mg, p, q, false);
        at(h.ball(isBr ? 1.35 : 0.75, isBr ? BRC : HC, { seg: 12, seg2: 8 }), q.x, q.y, q.z, mg);
      });
      if (!kit.reduce) kit.onFrame((dt, t) => { mg.rotation.y = 0.5 * Math.sin(t * 0.5); });
      tag(v3(40, ty + 30, -2), brDone ? '2,4,6-триброманилин' : d.sel ? 'Анилин C₆H₅NH₂' : 'Бензол C₆H₆', brDone ? 'Br в положениях 2, 4, 6' : '');
      return;
    }
    // синтез
    const rawB = h.bottle(g, -24, ty, 22, { r: 3.6, h: 9, liq: 0xe8d9a8, lop: 0.6, fill: 0.55, label: d.raw, lh: 3.2, key: 'raw' }); rawB.g.scale.setScalar(1.3);
    const rgB = h.bottle(g, -8, ty, 22, { r: 3.6, h: 9, liq: d.ox ? 0xe8862a : 0xd7ecf7, lop: 0.7, fill: 0.55, label: d.rg, lh: 3.2, cap: d.ox ? 0x8a4a1a : 0x2c3240, key: 'rg' }); rgB.g.scale.setScalar(1.3);
    tag(v3(-24, ty + 21, 22), 'Сырьё', d.raw); tag(v3(-8, ty + 21, 22), 'Реагент', d.rgN);
    // колба на треноге над спиртовкой
    const R = h.zone(g, 10, -10, 1.3), W = R.userData.W, gy = ty + 13;
    for (let k = 0; k < 3; k++) { const a = k * 2.094 + 0.5; h.rodAB(R, v3(Math.cos(a) * 9, ty, Math.sin(a) * 9), v3(Math.cos(a) * 7, gy, Math.sin(a) * 7), 0.4, C.DARK); }
    const rg = kit.mesh(new T.TorusGeometry(7, 0.45, 6, 32), C.DARK, { edges: false }); rg.rotation.x = Math.PI / 2; at(rg, 0, gy, 0, R);
    h.spirit(R, 0, ty, 0, d.st === 'run', 0.9);
    const fg = new T.Group(); at(fg, 0, gy + 0.3, 0, R); clickable(fg, 'flask');
    const FRr = 6;
    at(h.glassy(new T.SphereGeometry(FRr, 32, 20), 0xd8eef8, 0.2), 0, FRr, 0, fg);
    at(h.glassy(new T.CylinderGeometry(FRr * 0.28, FRr * 0.3, 8, 24, 1, true)), 0, FRr * 1.9 + 4, 0, fg);
    const col = d.st === 'none' ? 0xd7ecf7 : d.st === 'run' ? 0xc9a46a : d.pk === 'dye' ? 0x6e2f88 : d.pk === 'tar' ? 0x3a2a22 : 0xf4f1e8;
    const lq = new T.Mesh(kit.keep(new T.SphereGeometry(FRr * 0.9, 28, 14, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45)), h.ownMat(col, { transparent: true, opacity: d.st === 'done' && (d.pk === 'dye' || d.pk === 'tar') ? 0.9 : 0.55, depthWrite: false }));
    at(lq, 0, FRr, 0, fg);
    if (d.st === 'run') h.puffs(R, 0, gy + FRr * 2 + 8, 0, { n: 5, spread: 3, rise: 8, size: 3, op: 0.4 });
    tag(W(0, gy + 24, 0), 'Колба', d.st === 'none' ? 'нажмите — реакция' : d.st === 'run' ? 'идёт реакция…' : d.prod, d.st === 'done' && d.pk !== 'tar');
    // лоскут шёлка
    const cl = new T.Group(); at(cl, 38, ty, 2, g);
    const segs = 6; for (let k = 0; k < segs; k++) { const p = box(18 / segs, 0.35, 12, d.dyed ? 0x8e3fb0 : 0xf1ece0, { edges: false }); at(p, -9 + 18 / segs * (k + 0.5), 0.5 + 0.35 * Math.sin(k * 1.3), 0, cl); }
    tag(v3(38, ty + 4, 2), 'Шёлк', d.dyed ? 'лиловый — мовеин' : 'белый');
    h.floorSticker(g, 38, ty, 18, 34, 8, ['мовеин → шёлк', 'парацетамол'].map((s, i) => (d.got[i + 2] ? '✓ ' : '· ') + s).join('\n'), '#1b1610', '#eef7ee', 380);
  };

  // ===== 3. Конструктор: модель цепи из фрагментов =====
  SC['nitro-build'] = (kit, d) => {
    const { T, at, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const ty = h.tray(g, 0, 2, 124, 80);
    const EL = { h: [HC, 0.95], ch3: [CC, 1.6], ch2: [CC, 1.6], nh2: [NC, 1.6], nh: [NC, 1.6], oh: [OC, 1.5], co: [CC, 1.6], cooh: [CC, 1.6] };
    const ch = d.chain, n = ch.length, BL = 3.6, RR = 2.6;
    // раскладка вдоль x
    const items = []; let x = 0, k = 0;
    ch.forEach((key, i) => {
      if (key === 'ph' || key === 'c6h4') { items.push({ key, i, ring: true, cx: x + RR, inX: x, outX: x + 2 * RR, y: 0 }); x += 2 * RR + BL; k = 0; }
      else { items.push({ key, i, x, y: k % 2 ? 0.9 : -0.9, inX: x, outX: x }); x += BL; k++; }
    });
    const width = n ? x - BL : 0, s = Math.min(2.2, 92 / Math.max(1, width + 6));
    const stand = new T.Group(); at(stand, 0, ty, -4, g);
    at(kit.box(Math.max(30, width * s + 14), 1.4, 9, C.WOOD2), 0, 0.7, 0, stand);
    [-1, 1].forEach(sx => at(cyl(0.45, 13, C.STEEL, { edges: false }), sx * Math.max(10, width * s / 2 + 2), 7.4, 0, stand));
    const mol = new T.Group(); at(mol, -width * s / 2, 18, 0, stand); mol.scale.setScalar(s);
    const conn = i => (i > 0) + (i < n - 1);
    items.forEach((a, idx) => {
      const fg = new T.Group(); mol.add(fg); clickable(fg, 'cut' + a.i);
      const out = a.i === 0 ? -1 : 1, up = a.y > 0 ? 1 : -1;
      if (a.ring) {
        const V = [0, 1, 2, 3, 4, 5].map(j => v3(a.cx + RR * Math.cos(Math.PI - j * Math.PI / 3), RR * Math.sin(Math.PI - j * Math.PI / 3), 0));
        V.forEach((p, j) => { at(h.ball(1.05, CC, { seg: 12, seg2: 8 }), p.x, p.y, p.z, fg); bond(kit, h, fg, p, V[(j + 1) % 6], j % 2 === 0); });
        V.forEach((p, j) => { if (j === 0 || (j === 3 && a.key === 'c6h4')) return; const q = v3(a.cx, 0, 0).sub(p).multiplyScalar(-0.62).add(p); bond(kit, h, fg, p, q, false); at(h.ball(0.7, HC, { seg: 10, seg2: 8 }), q.x, q.y, q.z, fg); });
      } else {
        const p = v3(a.x, a.y, 0), [col, r] = EL[a.key];
        const hz = [v3(0, up * 0.6, 0.8), v3(0, up * 0.6, -0.8)];
        const hd = { h: [], ch3: [v3(0, up, 0), ...hz], ch2: hz, nh2: hz, nh: [v3(0, up, 0.5)], oh: [v3(out * 0.5, up, 0.4)], co: [], cooh: [] }[a.key];
        atomH(kit, h, fg, p, r, col, hd, 2.1);
        if (a.key === 'co') { const q = v3(a.x, a.y + up * 3, 0); bond(kit, h, fg, p, q, true); at(h.ball(1.4, OC, { seg: 14, seg2: 10 }), q.x, q.y, q.z, fg); }
        if (a.key === 'cooh') {
          const dir = a.i === 0 && n > 1 ? -1 : 1, q1 = v3(a.x + dir * 2.2, a.y + 2.6, 0), q2 = v3(a.x + dir * 2.2, a.y - 2.6, 0);
          bond(kit, h, fg, p, q1, true); at(h.ball(1.4, OC, { seg: 14, seg2: 10 }), q1.x, q1.y, q1.z, fg);
          atomH(kit, h, fg, q2, 1.4, OC, [v3(dir, -0.5, 0.3)], 1.9); bond(kit, h, fg, p, q2, false);
        }
      }
      // связь со следующим фрагментом
      if (idx + 1 < n) { const b = items[idx + 1]; bond(kit, h, mol, v3(a.outX, a.y, 0), v3(b.inX, b.y, 0), false); }
      // амидная связь — подсветка
      if (idx + 1 < n) { const b = items[idx + 1], pr = [a.key, b.key]; if ((pr[0] === 'co' && (pr[1] === 'nh' || pr[1] === 'nh2')) || (pr[1] === 'co' && (pr[0] === 'nh' || pr[0] === 'nh2'))) at(h.glow(0xffb547, 9, 0.55), (a.outX + b.inX) / 2, (a.y + b.y) / 2, 0, mol); }
    });
    // свободные валентности — оранжевые штыри
    if (n) {
      const stub = (p, dir) => { const q = p.clone().add(v3(dir * 2.4, 0, 0)); h.rodAB(mol, p, q, 0.3, 0xff8a73); at(h.ball(0.5, 0xff8a73, { hull: false }), q.x, q.y, q.z, mol); };
      const TT2 = k => (k === 'ch2' || k === 'nh' || k === 'co' || k === 'c6h4') ? 2 : 1;
      if (TT2(ch[0]) - conn(0) > 0 && (n > 1 || TT2(ch[0]) === 2)) stub(v3(items[0].inX - (items[0].ring ? 0 : 1.4), items[0].y, 0), -1);
      if (TT2(ch[n - 1]) - conn(n - 1) > 0) stub(v3(items[n - 1].outX + (items[n - 1].ring ? 0 : 1.4), items[n - 1].y, 0), 1);
    }
    if (!kit.reduce && n) kit.onFrame((dt, t) => { mol.rotation.x = 0.25 * Math.sin(t * 0.5); });
    tag(v3(0, ty + 18 + 9, -4), d.name ? d.name : n ? 'Цепь: ' + d.f : 'Цепь пуста', n ? `M = ${d.M} · свободно: ${d.free} · амидных: ${d.amide}` : 'добавьте фрагменты кнопками', !!d.name);
    h.button(g, -30, ty, 26, '⌫', 0xe0473a, 'back', 6, 4);
    h.button(g, -20, ty, 26, 'Очистить', 0x56627d, 'clear', 10, 4);
    h.button(g, -6, ty, 26, 'Цель ›', 0x2f6fd8, 'tgt', 10, 4);
    h.floorSticker(g, 30, ty, 24, 44, 12, ['цель: ' + d.tgt + ' ' + d.tf, ...['глицилглицин', 'парацетамол', 'звено кевлара'].map((s2, i) => (d.got[i] ? '✓ ' : '· ') + s2)].join('\n'), '#1b1610', '#eef7ee', 460);
  };
})();
