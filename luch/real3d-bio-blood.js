// «Как в жизни» для биологии «Кровь и сердце» (labs/bio-blood): центрифуга с пробиркой крови, микроскоп и увеличенный мазок-модель с клетками;
// анатомическая модель сердца в разрезе на подставке (камеры сжимаются, створчатые и полулунные клапаны открываются, кровь течёт) с монитором пульса;
// настоящий тонометр на руке-тренажёре (манжета, груша с винтом, манометр, фонендоскоп); прививочный кабинет (флаконы, шприцы, модель лимфоцита с антителами, возбудитель, календарь дней).
// Сцены строятся из window.LUCH_REAL() опыта; быстрые значения (фаза сердца, давление в манжете, тоны, ход центрифуги) — из LUCH_REAL.live() в onFrame.
(() => {
  const SC = window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {};
  const live = () => { try { return window.LUCH_REAL.live ? window.LUCH_REAL.live() : null; } catch (e) { return null; } };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (x, n) => (Math.round(x * 10 ** n) / 10 ** n).toFixed(n).replace('.', ',');
  const rnd = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const hexs = c => '#' + c.toString(16).padStart(6, '0');
  const TY = 1.2; // верх светлого коврика
  const BLUE = 0x5b7fd6, RED = 0xe0555d, MUSC = 0x8e3642, CUT = 0xb5525e, CREAM = 0xf1e3c8, SKIN = 0xe2b393;
  const CTC = { rbc: 0xff6b6b, wbc: 0xb48cff, plt: 0xffb547 }, CTN = { rbc: 'Эритроцит', wbc: 'Лейкоцит', plt: 'Тромбоцит' };

  // ---------- общие детали ----------
  function H(kit) {
    const { T, at, box, cyl, mesh, keep, grad, glowTex, clickable } = kit;
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    const v2 = (x, y) => new T.Vector2(x, y);
    const ownMat = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, ...o }));
    const glassMat = (color = 0xd8eef8, opacity = 0.24) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, transparent: true, opacity, side: T.DoubleSide, depthWrite: false }));
    const spr = (map, color, opacity, add) => new T.Sprite(keep(new T.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending })));
    const glow = (color, size, opacity) => { const s = spr(glowTex(), color, opacity, true); s.scale.setScalar(size); return s; };
    const hitBox = (w, hh, d) => new T.Mesh(keep(new T.BoxGeometry(w, hh, d)), keep(new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })));
    const ball = (r, color, o = {}) => mesh(new T.SphereGeometry(r, o.seg || 18, o.seg2 || 12), color, { hull: o.hull ?? true, edges: false, mat: o.mat });
    const tube = (pts, r, color, o = {}) => {
      const curve = new T.CatmullRomCurve3(pts, false, 'centripetal');
      const m = mesh(new T.TubeGeometry(curve, Math.max(24, Math.round(curve.getLength() * 1.5)), r, 12), color, { edges: false, hull: o.hull ?? true, mat: o.mat });
      m.userData.curve = curve; return m;
    };
    function canvasTex(pw, ph) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph;
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      return { c, x: c.getContext('2d'), tex };
    }
    function drawLines(x, pw, ph, lines, col, weight = 600, k = 0.62) {
      const lh = ph / lines.length;
      lines.forEach((ln, i) => {
        let fs = Math.round(lh * k); x.font = `${weight} ${fs}px "Golos Text", sans-serif`;
        const tw = x.measureText(ln).width; if (tw > pw * 0.88) { fs = Math.floor(fs * pw * 0.88 / tw); x.font = `${weight} ${fs}px "Golos Text", sans-serif`; }
        x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ln, pw / 2, lh * (i + 0.5) + 2);
      });
    }
    // бумажная наклейка / карточка
    function sticker(w, hh, txt, fg = '#1b1610', bg = '#fffaf0', pw = 256) {
      const ph = Math.round(pw * hh / w), k = canvasTex(pw, ph);
      k.x.fillStyle = bg; k.x.beginPath(); if (k.x.roundRect) k.x.roundRect(3, 3, pw - 6, ph - 6, Math.min(pw, ph) * 0.14); else k.x.rect(3, 3, pw - 6, ph - 6); k.x.fill();
      k.x.strokeStyle = '#1b1610'; k.x.lineWidth = 5; k.x.stroke();
      drawLines(k.x, pw, ph, String(txt).split('\n'), fg);
      return new T.Mesh(keep(new T.PlaneGeometry(w, hh)), keep(new T.MeshBasicMaterial({ map: k.tex, transparent: true })));
    }
    function floorLabel(parent, x, z, w, hh, txt, fg, bg) { const s = sticker(w, hh, txt, fg, bg, Math.round(Math.min(512, 110 * w / hh))); s.rotation.x = -Math.PI / 2; return at(s, x, TY + 0.08, z, parent); }
    // «таблетка» с номером, всегда смотрит на зрителя
    function pill(parent, x, y, z, txt, fg = '#1b1610', bg = '#fff6e6', hgt = 2.6) {
      const mc = document.createElement('canvas').getContext('2d'); mc.font = '700 50px "IBM Plex Mono", monospace';
      const mw = mc.measureText(txt).width, pw = Math.max(96, Math.ceil(mw + 56)), ph = 80, k = canvasTex(pw, ph);
      const m = new T.Sprite(keep(new T.SpriteMaterial({ map: k.tex, transparent: true, depthTest: false, depthWrite: false })));
      m.renderOrder = 6;
      k.x.fillStyle = bg; k.x.strokeStyle = '#1b1610'; k.x.lineWidth = 6;
      const w = Math.min(pw - 6, Math.max(ph - 6, mw + 34)), x0 = (pw - w) / 2;
      k.x.beginPath(); if (k.x.roundRect) k.x.roundRect(x0, 3, w, ph - 6, 34); else k.x.rect(x0, 3, w, ph - 6); k.x.fill(); k.x.stroke();
      k.x.fillStyle = fg; k.x.font = '700 50px "IBM Plex Mono", monospace'; k.x.textAlign = 'center'; k.x.textBaseline = 'middle'; k.x.fillText(txt, pw / 2, ph / 2 + 2);
      k.tex.needsUpdate = true;
      m.scale.set(hgt * pw / ph, hgt, 1);
      return at(m, x, y, z, parent);
    }
    // клавиша на коврике с надписью сверху
    function key(parent, x, z, w, d, label, color, keyName, on) {
      const b = new T.Group(); at(b, x, TY, z, parent);
      at(box(w, on ? 1 : 1.6, d, color), 0, on ? 0.5 : 0.8, 0, b);
      const top = sticker(w * 0.94, d * 0.8, label, '#ffffff', hexs(color), Math.round(Math.min(512, 90 * w / d * 1.4)));
      top.rotation.x = -Math.PI / 2; at(top, 0, (on ? 1 : 1.6) + 0.03, 0, b);
      if (on) { const r = mesh(new T.TorusGeometry(Math.max(w, d) * 0.58, 0.25, 6, 40), 0xffd166, { edges: false }); r.rotation.x = Math.PI / 2; r.scale.set(1, d / w, 1); at(r, 0, 0.3, 0, b); }
      if (keyName) clickable(b, keyName);
      return b;
    }
    // светлый коврик кабинета биологии
    function mat(g, w = 128, d = 88, z = 4) {
      at(box(w, TY, d, 0xe9eef0), 0, TY / 2, z, g);
      at(box(w, 1.2, 1, 0xcfd8dc), 0, TY + 0.6, z - d / 2 + 0.5, g); at(box(w, 1.2, 1, 0xcfd8dc), 0, TY + 0.6, z + d / 2 - 0.5, g);
    }
    // табло: текст меняется в onFrame
    function screen(w, hh, pw = 320, ph = 120) {
      const k = canvasTex(pw, ph); let cur = null;
      const m = new T.Mesh(keep(new T.PlaneGeometry(w, hh)), keep(new T.MeshBasicMaterial({ map: k.tex })));
      m.userData.set = (t, col = '#86e0a8') => { t = String(t); if (cur === t + col) return; cur = t + col; k.x.fillStyle = '#0e1520'; k.x.fillRect(0, 0, pw, ph); drawLines(k.x, pw, ph, t.split('\n'), col, 600, 0.6); k.tex.needsUpdate = true; };
      m.userData.k = k;
      return m;
    }
    const ring = (parent, x, y, z, r, col = 0xffd166) => { const m = mesh(new T.TorusGeometry(r, 0.3, 6, 40), col, { edges: false }); m.rotation.x = Math.PI / 2; return at(m, x, y, z, parent); };
    return { v3, v2, ownMat, glassMat, spr, glow, hitBox, ball, tube, canvasTex, drawLines, sticker, floorLabel, pill, key, mat, screen, ring };
  }

  // ===================== Урок 1: из чего состоит кровь =====================
  // эритроцит — двояковогнутый диск (тор + тонкая середина), лицом к зрителю (ось z)
  function rbc(kit, parent, x, y, r, z = 0.6) {
    const { T, at, mesh } = kit;
    const g = new T.Group(); at(g, x, y, z, parent);
    g.add(mesh(new T.TorusGeometry(r * 0.66, r * 0.34, 8, 22), 0xe46a6f, { edges: false }));
    const c = mesh(new T.CylinderGeometry(r * 0.66, r * 0.66, r * 0.28, 22), 0xf2a3a5, { edges: false }); c.rotation.x = Math.PI / 2; g.add(c);
    return g;
  }
  function wbc(kit, h, parent, x, y, kind, s) {
    const { T, at } = kit;
    const g = new T.Group(); at(g, x, y, 0.6, parent);
    if (kind === 'lymph') {
      const b = h.ball(12 * s, 0xdcd3ee, { hull: false }); b.scale.z = 0.5; g.add(b);
      at(h.ball(9.2 * s, 0x5e3f8c, { hull: false }), s, 0, 3.4 * s, g);
    } else {
      const b = h.ball(15 * s, 0xece4f4, { hull: false }); b.scale.z = 0.5; g.add(b);
      [[-5, 2, 4.4], [1, -4, 4.2], [6, 3, 4]].forEach(([dx, dy, r]) => at(h.ball(r * s, 0x6d4f9c, { hull: false }), dx * s, dy * s, 5 * s, g));
    }
    return g;
  }
  function plt(kit, h, parent, x, y, s) {
    const { T, at } = kit;
    const g = new T.Group(); at(g, x, y, 0.6, parent);
    [[-3, 2, 2.3], [2.5, 3, 1.8], [1, -2.5, 2.1], [-3.5, -3.5, 1.5]].forEach(([dx, dy, r]) => at(h.ball(r * s, 0x8d6bb8, { hull: false }), dx * s, dy * s, 0, g));
    return g;
  }

  SC['blood-comp'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.mat(g);
    const spinning = d.spun && !d.sep;

    // --- настольная центрифуга ---
    const CX = -46, CZ = -10;
    const cg = new T.Group(); at(cg, CX, TY, CZ, g); clickable(cg, 'spin');
    at(cyl(13.4, 1.2, 0x9aa6b8), 0, 0.6, 0, cg);
    at(cyl(13, 9, 0xe8ecf2), 0, 5.6, 0, cg);
    at(cyl(11.4, 0.5, 0x3a4252, { edges: false, hull: false }), 0, 10.2, 0, cg);
    const rotor = new T.Group(); at(rotor, 0, 10.6, 0, cg);
    at(cyl(2.2, 1.6, C.STEEL), 0, 0, 0, rotor);
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2, arm = box(8, 0.8, 1.8, 0xb7c0cc, { edges: false }); arm.rotation.y = a; at(arm, Math.cos(a) * 4.5, 0, -Math.sin(a) * 4.5, rotor);
      const ho = cyl(1.5, 2.6, 0x56627d, { seg: 14 }); at(ho, Math.cos(a) * 8.4, 0.4, -Math.sin(a) * 8.4, rotor);
      const cap = cyl(1.2, 0.8, k === 0 && spinning ? 0xa3202c : k === 2 && spinning ? 0xd8eef8 : 0x3a4252, { seg: 12, edges: false }); at(cap, Math.cos(a) * 8.4, 2, -Math.sin(a) * 8.4, rotor);
    }
    const lid = new T.Mesh(keep(new T.SphereGeometry(12, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2)), h.glassMat(0xbfe3f5, 0.28)); lid.scale.y = 0.38; at(lid, 0, 10.2, 0, cg);
    const scr = h.screen(9, 3.4); at(scr, -2, 6, 13.06, cg);
    const btn = cyl(1.5, 1, spinning ? 0x3fae5a : 0xe0473a, { seg: 16 }); btn.rotation.x = Math.PI / 2; at(btn, 6.5, 6, 13.2, cg);
    const hum = h.glow(0x86e0a8, 6, 0); at(hum, 6.5, 6, 14, cg);
    at(h.hitBox(28, 16, 28), 0, 8, 0, cg);

    // --- штатив с пробиркой ---
    const RX = -22, RZ = -18;
    const rg = new T.Group(); at(rg, RX, TY, RZ, g); clickable(rg, 'tube');
    at(box(14, 1.2, 7, 0xf2f2f2), 0, 0.6, 0, rg); at(box(14, 1.2, 7, 0xf2f2f2), 0, 7, 0, rg);
    [-6.4, 6.4].forEach(x => at(box(1.2, 7.6, 7, 0xf2f2f2), x, 3.8, 0, rg));
    [-3.6, 0, 3.6].forEach(x => at(cyl(1.9, 0.3, 0x56627d, { edges: false, hull: false }), x, 7.65, 0, rg));
    if (!spinning) {
      const tg = new T.Group(); at(tg, 0, 1.2, 0, rg);
      const r = 1.6, hh = 20;
      const wall = new T.Mesh(keep(new T.CylinderGeometry(r, r, hh - r, 24, 1, true)), h.glassMat(0xd8eef8, 0.24)); at(wall, 0, r + (hh - r) / 2, 0, tg); wall.add(new T.Mesh(wall.geometry, kit.hullMat));
      const bot = new T.Mesh(keep(new T.SphereGeometry(r, 24, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), h.glassMat(0xd8eef8, 0.24)); at(bot, 0, r, 0, tg);
      at(cyl(r + 0.3, 1.6, 0xe0473a, { seg: 18 }), 0, hh + 0.6, 0, tg); // крышка пробирки
      const rr = r * 0.85, full = 15;
      const layer = (y0, y1, col, op) => { const m = new T.Mesh(keep(new T.CylinderGeometry(rr, rr, y1 - y0, 20)), h.ownMat(col, { transparent: true, opacity: op })); at(m, 0, (y0 + y1) / 2, 0, tg); return m; };
      at(new T.Mesh(keep(new T.SphereGeometry(rr, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), h.ownMat(0x9c1f2a)), 0, r, 0, tg);
      if (!d.sep) layer(r, full, 0xa3202c, 0.95);
      else {
        const yr = r + (full - r) * 0.44;
        layer(r, yr, 0x9c1f2a, 0.95); layer(yr, yr + 0.45, 0xf4efe6, 1); layer(yr + 0.45, full, 0xefcf6a, 0.8);
        const br = box(0.3, full - yr - 0.5, 0.2, 0xefcf6a, { edges: false, shadow: false }); at(br, 3.4, (yr + full) / 2 + 0.2, 0, tg);
        const br2 = box(0.3, yr - r, 0.2, 0xff6b6b, { edges: false, shadow: false }); at(br2, 3.4, (r + yr) / 2, 0, tg);
      }
      at(h.hitBox(5, 22, 5), 0, 11, 0, tg);
    }

    // --- микроскоп ---
    const MX = -6, MZ = -20;
    const mg = new T.Group(); at(mg, MX, TY, MZ, g); mg.rotation.y = 0.2;
    const DK = 0x2c3240, WH = 0xe8ecf4;
    at(box(14, 2.2, 17, WH), 0, 1.1, 0, mg);
    at(box(4.2, 22, 5, WH), 0, 12, -5.5, mg);
    const arm = box(4.2, 4, 12, WH); arm.rotation.x = 0.35; at(arm, 0, 24, -1.5, mg);
    at(box(13, 1.1, 11, DK), 0, 11.6, 1.5, mg);
    at(box(9, 0.25, 3.2, 0xd8eef8, { edges: false }), 0, 12.3, 1.5, mg);
    at(box(3.4, 0.06, 2.4, 0xd98a96, { edges: false, shadow: false }), 0.6, 12.46, 1.5, mg);
    const lamp = cyl(1.6, 1.4, 0xfff1b8, { matOpt: { emissive: 0xffe08a, emissiveIntensity: 0.9 } }); at(lamp, 0, 3, 1.5, mg);
    at(h.glow(0xfff1b8, 7, 0.6), 0, 3.6, 1.5, mg);
    at(cyl(2.4, 2.6, DK), 0, 8.8, 1.5, mg);
    const turret = cyl(3.4, 1.6, DK); at(turret, 0, 19.6, 1.5, mg);
    [[0, 0.3], [2, 0.8], [-2, 0.8]].forEach(([dx, dz]) => at(cyl(0.9, 4.5, C.STEEL, { r2: 0.7 }), dx, 16.6, 1.5 + dz, mg));
    const body = cyl(1.7, 11, WH); body.rotation.x = -0.45; at(body, 0, 25, 3.6, mg);
    const eye = cyl(1.3, 3, DK); eye.rotation.x = -0.45; at(eye, 0, 30.4, 6.2, mg);
    [-1, 1].forEach(sx => { const kn = cyl(2.4, 1.4, DK, { seg: 18 }); kn.rotation.z = Math.PI / 2; at(kn, sx * 2.9, 9, -5.5, mg); });

    // --- увеличенный мазок: круглая модель поля зрения на мольберте ---
    const s = 0.17, FR = 20.4;
    const outer = new T.Group(); at(outer, 33, TY + 25, -2, g); outer.rotation.y = -0.25;
    const fb = new T.Group(); outer.add(fb); fb.rotation.x = -0.28;
    const legs = [[-8, -1], [8, -1]];
    legs.forEach(([x]) => { const l = box(1.4, 30, 1.4, C.WOOD2); l.rotation.z = x < 0 ? 0.12 : -0.12; at(l, x, -12, -2.5, fb); });
    const back = cyl(FR + 1.6, 1.4, 0x2a3550); back.rotation.x = Math.PI / 2; at(back, 0, 0, -0.3, fb);
    const face = cyl(FR, 0.3, 0xf6ebe6, { edges: false, hull: false }); face.rotation.x = Math.PI / 2; at(face, 0, 0, 0.5, fb);
    const cells = d.cells || [];
    // фоновые эритроциты (детерминированно, мимо отмеченных клеток)
    const bg = [];
    for (let i = 0; bg.length < 40 && i < 1200; i++) {
      const a = rnd(i * 3 + 1) * 6.283, rr = Math.sqrt(rnd(i * 3 + 2)) * 112, x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      if (cells.some(c => Math.hypot(c[0] - x, c[1] - y) < (c[2] === 'wbc' ? 30 : 23))) continue;
      if (bg.some(o => Math.hypot(o[0] - x, o[1] - y) < 17)) continue;
      bg.push([x, y, 8 + rnd(i * 3 + 3) * 1.6]);
    }
    bg.forEach(([x, y, r]) => rbc(kit, fb, x * s, -y * s, r * s));
    const lab = d.lab || [], all = cells.length && lab.every(Boolean);
    let selRing = null;
    cells.forEach(([x, y, type, kind], i) => {
      const cx = x * s, cy = -y * s, cg2 = new T.Group(); at(cg2, 0, 0, 0, fb); clickable(cg2, 'tg' + i);
      if (type === 'rbc') rbc(kit, cg2, cx, cy, 9 * s); else if (type === 'wbc') wbc(kit, h, cg2, cx, cy, kind, s); else plt(kit, h, cg2, cx, cy, s);
      at(h.hitBox(6.5, 6.5, 3), cx, cy, 1, cg2);
      const a = lab[i], txt = String(i + 1) + (all ? (a === type ? ' ✓' : ' ✗') : '');
      h.pill(cg2, cx + 2.6, cy + 2.6, 2.5, txt, a ? '#1b1610' : '#e8ecf4', a ? hexs(CTC[a]) : '#1a2438', 2.4);
      if (i === d.cur) { selRing = kit.mesh(new T.TorusGeometry(3.6, 0.32, 8, 40), 0xffb547, { edges: false, matOpt: { emissive: 0xffb547, emissiveIntensity: 0.7 } }); at(selRing, cx, cy, 1.2, fb); }
    });
    // пробирка → центрифуга, мигание выбранной клетки
    kit.onFrame((dt, t) => {
      const L = live() || {}, el = L.spinMs ?? 1e9;
      const on = spinning && el < 1800;
      if (on && !kit.reduce) rotor.rotation.y -= dt * 30 * clamp(el / 400, 0.15, 1) * clamp((1800 - el) / 400, 0.1, 1);
      hum.material.opacity = on ? 0.6 : 0;
      scr.userData.set(on ? '3000 об/мин' : d.sep ? 'ГОТОВО' : 'СТОП', on ? '#ffd166' : d.sep ? '#86e0a8' : '#e8ecf4');
      if (selRing) { const k = kit.reduce ? 1 : 1 + 0.12 * Math.sin(t * 6); selRing.scale.setScalar(k); }
    });

    // --- кнопки типов ---
    const cur = d.cur >= 0 ? lab[d.cur] : null;
    h.key(g, -50, 38, 15, 7, 'Центрифуга', 0x3b4a66, 'spin', d.spun);
    [['rbc', -30], ['wbc', -12], ['plt', 6]].forEach(([k, x]) => h.key(g, x, 38, 16, 7, CTN[k], CTC[k], 'ct-' + k, cur === k));
    h.key(g, 24, 38, 13, 7, 'Сбросить', 0x56627d, 'reset');

    // --- подписи ---
    tag(v3(CX, TY + 16, CZ), 'Центрифуга', d.spun ? (d.sep ? 'кровь разделена' : 'крутит…') : 'нажмите — разделить', spinning);
    tag(v3(RX, TY + 25, RZ), 'Пробирка с кровью', spinning ? 'в центрифуге' : d.sep ? 'плазма 55 % · клетки 45 %' : `крови в теле ≈ ${d.vol} л`, d.sep);
    tag(v3(MX, TY + 34, MZ), 'Микроскоп', '×900');
    outer.updateMatrixWorld(true);
    const top = v3(0, FR + 2, 0).applyMatrix4(fb.matrixWorld);
    tag(top, d.cur >= 0 ? `Клетка ${d.cur + 1}` : 'Мазок крови', d.cur >= 0 ? (cur ? CTN[cur].toLowerCase() : 'кто это?') : (d.placed === 6 ? `верно ${d.right} из 6` : `определено ${d.placed} из 6`), d.placed === 6 && d.right === 6);
  };

  // ===================== Урок 2: сердце — модель в разрезе =====================
  const PHN = { as: 'Систола предсердий', vs: 'Систола желудочков', d: 'Общая пауза' };
  const PHC = { as: '#72d4e8', vs: '#ff8a73', d: '#86e0a8' };
  const FLOW_ON = { as: ['ra2rv', 'la2lv'], vs: ['vcs', 'vci', 'pvs', 'pvi', 'rv2pa', 'lv2ao'], d: ['vcs', 'vci', 'pvs', 'pvi', 'ra2rv', 'la2lv'] };
  const CH = { ra: { c: [-13.5, 46], r: [6.5, 6.2], col: BLUE }, la: { c: [13.5, 46], r: [6.5, 6.2], col: RED }, rv: { c: [-10.5, 25], r: [8, 10], col: BLUE }, lv: { c: [11.5, 24], r: [6.8, 10.5], col: RED } };
  const NECK = { r: [-16, -10], l: [9, 15] };
  const OUT = [[0, 56.5], [-7, 57.5], [-16, 57], [-22.5, 52], [-23.5, 42], [-22, 30], [-20, 18], [-14, 9], [-5, 5], [6, 2.5], [15, 6], [21, 14], [24, 26], [23.5, 38], [23, 48], [19, 56], [8, 57.5], [0, 56.5]];

  SC['blood-heart'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, C } = kit, h = H(kit), v3 = h.v3, v2 = h.v2;
    const g = new T.Group(); at(g, 0, 0, 0); h.mat(g);
    const HX = -14, HZ = -12, SC0 = 0.82;
    // подставка
    at(box(34, 2.4, 20, C.WOOD2), HX, TY + 1.2, HZ - 2, g);
    at(h.sticker(16, 3.2, 'СЕРДЦЕ ЧЕЛОВЕКА · РАЗРЕЗ', '#1b1610', '#f4e7c8', 400), HX, TY + 1.4, HZ + 8.05, g);
    at(cyl(0.9, 8, C.BRASS), HX + 1, TY + 6, HZ - 5, g);
    const hg = new T.Group(); at(hg, HX, TY + 5, HZ, g); hg.scale.setScalar(SC0);

    // объём сердца сзади (задняя половина) и плоскость разреза с полостями
    const halfGeo = r => new T.SphereGeometry(1, r || 36, 20, Math.PI, Math.PI);
    const backBody = new T.Mesh(keep(halfGeo(44)), h.ownMat(MUSC, { side: T.DoubleSide })); backBody.scale.set(21.5, 25, 12); at(backBody, 0.5, 30.5, -0.05, hg);
    const outPts = new T.SplineCurve(OUT.map(p => v2(p[0], p[1]))).getPoints(140);
    const line = new T.LineLoop(keep(new T.BufferGeometry().setFromPoints(outPts.map(p => v3(p.x, p.y, 0.08)))), kit.edgeMat); hg.add(line);
    const plateMat = h.ownMat(CUT, { side: T.DoubleSide });
    let plate = null, lastKey = '';
    const ell = (A, s) => [A.c[0], A.c[1], A.r[0] * s, A.r[1] * s];
    function cav(A, sa, V, sv, nx0, nx1) {
      const pts = [], [ax, ay, arx, ary] = ell(A, sa), [vx, vy, vrx, vry] = ell(V, sv), N = 40;
      const aR = -Math.acos(clamp((nx1 - ax) / arx, -1, 1)), aL = -Math.acos(clamp((nx0 - ax) / arx, -1, 1)) + 2 * Math.PI;
      for (let i = 0; i <= N; i++) { const a = aR + (aL - aR) * i / N; pts.push(v2(ax + Math.cos(a) * arx, ay + Math.sin(a) * ary)); }
      const bL = Math.acos(clamp((nx0 - vx) / vrx, -1, 1)), bR = Math.acos(clamp((nx1 - vx) / vrx, -1, 1)) + 2 * Math.PI;
      for (let i = 0; i <= N; i++) { const b = bL + (bR - bL) * i / N; pts.push(v2(vx + Math.cos(b) * vrx, vy + Math.sin(b) * vry)); }
      return pts;
    }
    function buildPlate(sa, sv) {
      const k = sa.toFixed(3) + '|' + sv.toFixed(3); if (k === lastKey) return; lastKey = k;
      const sh = new T.Shape(outPts);
      sh.holes.push(new T.Path(cav(CH.ra, sa, CH.rv, sv, NECK.r[0], NECK.r[1])), new T.Path(cav(CH.la, sa, CH.lv, sv, NECK.l[0], NECK.l[1])));
      const geo = new T.ShapeGeometry(sh, 6);
      if (plate) { plate.geometry.dispose(); plate.geometry = geo; } else { plate = new T.Mesh(geo, plateMat); plate.receiveShadow = true; hg.add(plate); }
    }
    keep({ dispose() { if (plate) plate.geometry.dispose(); } });
    buildPlate(1, 1);
    // полости: задние полуэллипсоиды цвета крови
    const cavs = {};
    Object.entries(CH).forEach(([k, A]) => {
      const cg = new T.Group(); at(cg, A.c[0], A.c[1], 0, hg); clickable(cg, 'pp-' + k);
      const m = new T.Mesh(keep(halfGeo(28)), h.ownMat(A.col, { side: T.DoubleSide })); m.scale.set(A.r[0], A.r[1], 5.5); cg.add(m);
      cavs[k] = m;
    });
    // горловины между предсердием и желудочком
    [['r', BLUE], ['l', RED]].forEach(([s, col]) => { const [a, b] = NECK[s]; at(box(b - a, 9, 0.4, col, { edges: false }), (a + b) / 2, 37, -3.2, hg); });
    // створчатые клапаны: по две створки на петлях
    const leaves = [];
    [['r', 'pp-tri'], ['l', 'pp-mit']].forEach(([s, keyName]) => {
      const [a, b] = NECK[s], vg = new T.Group(); at(vg, 0, 0, 0, hg); clickable(vg, keyName);
      const L = (b - a) / 2 + 0.5;
      [[a, 1], [b, -1]].forEach(([x, dir]) => {
        const hinge = new T.Group(); at(hinge, x, 39.5, -1.2, vg);
        const lf = box(L, 0.6, 2.6, CREAM, { edges: true }); at(lf, dir * L / 2, 0, 0, hinge);
        leaves.push({ hinge, dir });
      });
      at(h.hitBox(b - a + 2, 8, 4), (a + b) / 2, 37, -1, vg);
    });
    // сосуды
    const AO = [v3(4, 40, -6), v3(4, 57, -6)], AO2 = [v3(4, 61, -6), v3(4, 64, -6), v3(9, 70, -7), v3(18, 71, -8), v3(25, 65, -9), v3(26.5, 52, -10), v3(26.5, 40, -10)];
    const PA = [v3(-4, 40, -4), v3(-4, 57, -4)], PA2 = [v3(-4, 61, -4), v3(-4, 64, -4), v3(-9, 68.5, -3.5), v3(-19, 69, -3), v3(-31, 67, -2)];
    const VCS = [v3(-42, 50, -3), v3(-30, 50, -3), v3(-19, 49, -3)], VCI = [v3(-42, 41, -3), v3(-30, 41, -3), v3(-19, 42.5, -3)];
    const PVS = [v3(42, 50, -3), v3(30, 50, -3), v3(19, 49, -3)], PVI = [v3(42, 41, -3), v3(30, 41, -3), v3(19, 42.5, -3)];
    const vessel = (pts, r, col, keyName) => { const vg = new T.Group(); hg.add(vg); clickable(vg, keyName); const m = h.tube(pts, r, col); vg.add(m); return m; };
    vessel(AO, 3.2, RED, 'pp-ao'); const ao2 = vessel(AO2, 3.2, RED, 'pp-ao');
    vessel(PA, 2.8, BLUE, 'pp-pa'); const pa2 = vessel(PA2, 2.8, BLUE, 'pp-pa');
    const vcs = vessel(VCS, 2.6, BLUE, 'pp-vc'), vci = vessel(VCI, 2.6, BLUE, 'pp-vc');
    const pvs = vessel(PVS, 2.2, RED, 'pp-pv'), pvi = vessel(PVI, 2.2, RED, 'pp-pv');
    // «окошки» у корня аорты и лёгочной артерии: в стекле видны полулунные клапаны
    const cusps = [];
    const slg = new T.Group(); hg.add(slg); clickable(slg, 'pp-sl');
    [[4, -6, 3.2], [-4, -4, 2.8]].forEach(([x, z, r]) => {
      const wall = new T.Mesh(keep(new T.CylinderGeometry(r + 0.2, r + 0.2, 4, 24, 1, true)), h.glassMat(0xf4d8dc, 0.3)); at(wall, x, 59, z, slg);
      [57, 61].forEach(y => { const t = mesh(new T.TorusGeometry(r + 0.2, 0.35, 6, 24), CREAM, { edges: false }); t.rotation.x = Math.PI / 2; at(t, x, y, z, slg); });
      for (let i = 0; i < 3; i++) {
        const a = i * 2 * Math.PI / 3 + 0.4, gy = new T.Group(); at(gy, x + Math.cos(a) * r * 0.95, 57.6, z + Math.sin(a) * r * 0.95, slg); gy.rotation.y = Math.PI - a;
        const gz = new T.Group(); gy.add(gz);
        at(box(r * 0.95, 0.3, r * 1.0, CREAM, { edges: true }), r * 0.475, 0, 0, gz);
        cusps.push(gz);
      }
      at(h.hitBox(2 * r + 2, 5, 2 * r + 2), x, 59, z, slg);
    });
    // бегущая кровь по сосудам — светлые точки-«рукава»
    const dotTex = (() => { const k = h.canvasTex(64, 16); k.x.clearRect(0, 0, 64, 16); k.x.fillStyle = '#ffffff'; k.x.beginPath(); k.x.arc(20, 8, 5, 0, 7); k.x.fill(); return k.tex; })();
    const sleeves = {};
    const sleeve = (name, m, r, col) => {
      const tex = keep(dotTex.clone()); tex.wrapS = T.RepeatWrapping; tex.needsUpdate = true;
      const curve = m.userData.curve; tex.repeat.set(Math.max(1, curve.getLength() / 5), 1);
      const sm = new T.Mesh(keep(new T.TubeGeometry(curve, 40, r * 1.06, 12)), keep(new T.MeshBasicMaterial({ map: tex, color: col, transparent: true, depthWrite: false })));
      sm.renderOrder = 2; sm.visible = false; hg.add(sm); sleeves[name] = { sm, tex };
    };
    sleeve('vcs', vcs, 2.6, 0xc9d8ff); sleeve('vci', vci, 2.6, 0xc9d8ff); sleeve('pvs', pvs, 2.2, 0xffd0d0); sleeve('pvi', pvi, 2.2, 0xffd0d0);
    sleeve('rv2pa', pa2, 2.8, 0xc9d8ff); sleeve('lv2ao', ao2, 3.2, 0xffd0d0);
    // частицы крови внутри полостей
    const P = {
      vcs: [v3(-19, 49, -2), v3(-14, 46, -2)], vci: [v3(-19, 42.5, -2), v3(-14, 45, -2)],
      pvs: [v3(19, 49, -2), v3(14, 46, -2)], pvi: [v3(19, 42.5, -2), v3(14, 45, -2)],
      ra2rv: [v3(-13.5, 46, -2), v3(-13, 38, -2), v3(-11, 27, -2)], la2lv: [v3(13.5, 46, -2), v3(12, 38, -2), v3(11.5, 26, -2)],
      rv2pa: [v3(-11, 21, -2), v3(-6, 29, -2.5), v3(-4, 40, -4), v3(-4, 61, -4)], lv2ao: [v3(12, 19, -2), v3(7, 29, -3), v3(4, 40, -6), v3(4, 61, -6)],
    };
    const curves = {}, parts = {};
    const pg = keep(new T.SphereGeometry(0.85, 10, 8));
    const pmB = h.ownMat(0xa9c0ff), pmR = h.ownMat(0xffc2c2);
    Object.entries(P).forEach(([k, pts]) => {
      curves[k] = new T.CatmullRomCurve3(pts); parts[k] = [];
      const red = ['pvs', 'pvi', 'la2lv', 'lv2ao'].includes(k);
      for (let i = 0; i < 5; i++) { const m = new T.Mesh(pg, red ? pmR : pmB); m.visible = false; hg.add(m); parts[k].push(m); }
    });

    // монитор пульса
    const MX = 40, MZ = 12;
    const mon = new T.Group(); at(mon, MX, TY, MZ, g); mon.rotation.y = -0.35;
    at(box(8, 1, 6, 0x2c3240), 0, 0.5, 0, mon); at(box(2, 5, 2, 0x2c3240), 0, 3.5, -1, mon);
    at(box(26, 17, 3, 0x3b4a66), 0, 14.5, -1, mon);
    const scr = h.screen(23, 14, 368, 224); at(scr, 0, 14.5, 0.55, mon);
    const drawMon = (L) => {
      const k = scr.userData.k, x = k.x, W = 368, Hh = 224;
      x.fillStyle = '#0e1520'; x.fillRect(0, 0, W, Hh);
      x.textAlign = 'left'; x.textBaseline = 'alphabetic';
      x.fillStyle = '#86e0a8'; x.font = '700 30px "IBM Plex Mono", monospace'; x.fillText('ЧСС ' + d.hr, 16, 40);
      x.font = '500 18px "Golos Text", sans-serif'; x.fillStyle = '#8b96ad'; x.fillText('уд/мин · ' + (d.play ? 'идёт' : 'пауза'), 190, 38);
      x.fillStyle = PHC[L.ph] || '#e8ecf4'; x.font = '600 24px "Golos Text", sans-serif'; x.fillText(PHN[L.ph] || '', 16, 84);
      const X0 = 16, Wb = W - 32, Y = 112; let xx = X0;
      [['as', L.sa], ['vs', L.sv], ['d', L.dp]].forEach(([p, len]) => { const w = len / L.T * Wb; x.globalAlpha = p === L.ph ? 1 : 0.35; x.fillStyle = PHC[p]; x.fillRect(xx, Y, Math.max(0, w - 3), 16); xx += w; });
      x.globalAlpha = 1; const cx = X0 + L.pos / L.T * Wb; x.fillStyle = '#e8ecf4'; x.fillRect(cx - 2, Y - 8, 4, 32);
      x.font = '500 17px "Golos Text", sans-serif'; x.fillStyle = '#c9d3e6';
      x.fillText('створчатые: ' + (L.ph === 'vs' ? 'закрыты' : 'открыты'), 16, 172); x.fillText('полулунные: ' + (L.ph === 'vs' ? 'открыты' : 'закрыты'), 16, 202);
      k.tex.needsUpdate = true;
    };
    // кнопки
    h.key(g, -40, 40, 15, 7, d.play ? 'Пауза' : 'Пуск', d.play ? 0x56627d : 0x3fae5a, 'play');
    h.key(g, -22, 40, 15, 7, 'Фаза ›', 0x3b4a66, 'step');
    h.key(g, -4, 40, 11, 7, '−5', 0x2f6fd8, 'hr-');
    h.key(g, 10, 40, 11, 7, '+5', 0xe0473a, 'hr+');

    // анимация: сжатие камер, клапаны, кровь
    let avA = null, slA = null, lastMon = '';
    const frame = (dt, t) => {
      const L = live(); if (!L || !L.ph || !L.T) return;
      const u = clamp(L.u, 0, 1), sq = Math.sin(Math.PI * u);
      const sa = L.ph === 'as' ? 1 - 0.1 * sq : 1, sv = L.ph === 'vs' ? 1 - 0.12 * sq : 1;
      buildPlate(sa, sv);
      ['ra', 'la'].forEach(k => cavs[k].scale.set(CH[k].r[0] * sa, CH[k].r[1] * sa, 5.5));
      ['rv', 'lv'].forEach(k => cavs[k].scale.set(CH[k].r[0] * sv, CH[k].r[1] * sv, 5.5));
      const avT = L.ph === 'vs' ? 0.22 : 1.3, slT = L.ph === 'vs' ? 1.35 : 0.08;
      const kk = kit.reduce || avA === null ? 1 : Math.min(1, dt * 14);
      avA = avA === null ? avT : avA + (avT - avA) * kk; slA = slA === null ? slT : slA + (slT - slA) * kk;
      leaves.forEach(l => { l.hinge.rotation.z = -l.dir * avA; });
      cusps.forEach(c => { c.rotation.z = slA; });
      const on = FLOW_ON[L.ph] || [], spd = L.ph === 'd' ? 0.45 : 1.1;
      Object.entries(parts).forEach(([k, arr]) => {
        const act = on.includes(k);
        arr.forEach((m, i) => { m.visible = act; if (act) m.position.copy(curves[k].getPointAt((((L.tc * spd + i / 5) % 1) + 1) % 1)); });
      });
      Object.entries(sleeves).forEach(([k, s]) => { s.sm.visible = on.includes(k); if (s.sm.visible && !kit.reduce) s.tex.offset.x -= dt * (L.ph === 'd' ? 0.6 : 1.6); });
      const mk = L.ph + Math.round(L.pos / L.T * 120);
      if (mk !== lastMon) { lastMon = mk; drawMon(L); }
    };
    kit.onFrame(frame);
    frame(0, 0);

    // подписи
    hg.updateMatrixWorld(true);
    const W = (x, y, z = 0) => hg.localToWorld(v3(x, y, z));
    tag(W(-36, 54, -3), 'Полые вены', 'от тела');
    tag(W(37, 54, -3), 'Лёгочные вены', 'из лёгких');
    tag(W(22, 76, -8), 'Аорта', 'к телу');
    tag(W(-26, 73, -3), 'Лёгочная артерия', 'в лёгкие');
    tag(v3(MX, TY + 26, MZ), 'Монитор', `пульс ${d.hr} уд/мин`, !!d.done);
    const PART = { ra: [-13.5, 46], la: [13.5, 46], rv: [-10.5, 25], lv: [11.5, 24], tri: [-13, 39], mit: [12, 39], sl: [0, 62], ao: [12, 72], pa: [-12, 70], vc: [-30, 46], pv: [30, 46] };
    const PNAME = { ra: 'Правое предсердие', la: 'Левое предсердие', rv: 'Правый желудочек', lv: 'Левый желудочек', tri: 'Трёхстворчатый клапан', mit: 'Двустворчатый клапан', sl: 'Полулунные клапаны', ao: 'Аорта', pa: 'Лёгочная артерия', vc: 'Полые вены', pv: 'Лёгочные вены' };
    if (d.part && PART[d.part]) tag(W(PART[d.part][0], PART[d.part][1] + 4, 1), PNAME[d.part], 'выбрано', true);
    else tag(W(0, 6, 2), 'Модель сердца', d.phase ? PHN[d.phase] : 'нажмите на камеру');
  };

  // ===================== Урок 3: тонометр на руке-тренажёре =====================
  const dialA = v => (135 + clamp(v, 0, 300) / 300 * 270) * Math.PI / 180;
  SC['blood-bp'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.mat(g);
    const AY = TY + 7.4, AZ = -2;
    // рука-тренажёр: плечо, локоть, предплечье, кисть
    const arm = new T.Group(); at(arm, 0, 0, 0, g);
    const up = cyl(7, 44, SKIN, { r2: 7.3 }); up.rotation.z = Math.PI / 2; at(up, -36, AY, AZ, arm);
    at(h.ball(7.3, SKIN), -58, AY, AZ, arm);
    at(h.ball(6.6, SKIN), -14, AY - 0.6, AZ, arm);
    const fo = cyl(4.6, 36, SKIN, { r2: 6.2 }); fo.rotation.z = Math.PI / 2; at(fo, 4, AY - 1.4, AZ, arm);
    const hand = h.ball(1, SKIN, { hull: false }); hand.scale.set(6.5, 2.4, 4.8); at(hand, 26, TY + 3.2, AZ, arm);
    for (let i = 0; i < 4; i++) { const f = cyl(0.9, 6, SKIN, { seg: 10 }); f.rotation.z = Math.PI / 2; at(f, 34, TY + 2.4, AZ - 3 + i * 2, arm); }
    const th = cyl(1, 5, SKIN, { seg: 10 }); th.rotation.set(0, 0.9, Math.PI / 2); at(th, 28, TY + 3, AZ + 5, arm);
    at(box(16, 1.4, 14, 0xb9c3cf), -14, TY + 0.7, AZ, g); // валик под локтем
    // артерия: красная линия по руке (как на учебном тренажёре), пульсирует
    const artMatA = h.ownMat(0xb5303c, { emissive: 0xff2a3a, emissiveIntensity: 0 }), artMatB = h.ownMat(0xb5303c, { emissive: 0xff2a3a, emissiveIntensity: 0 });
    at(h.tube([v3(-58, AY + 7.1, AZ), v3(-46, AY + 7.05, AZ)], 0.45, 0, { hull: false, mat: artMatA }), 0, 0, 0, g);
    at(h.tube([v3(-26, AY + 7.05, AZ), v3(-14, AY + 6.4, AZ), v3(4, AY + 4.6, AZ), v3(18, AY + 3.4, AZ)], 0.45, 0, { hull: false, mat: artMatB }), 0, 0, 0, g);
    // манжета
    const cuffG = new T.Group(); at(cuffG, -36, AY, AZ, g); clickable(cuffG, 'cuff');
    const cuff = cyl(7.6, 16, 0x3f5a8a); cuff.rotation.z = Math.PI / 2; cuffG.add(cuff);
    const velcro = box(14, 0.6, 3, 0x2c4064, { edges: false }); at(velcro, 0, 7.8, 0, cuffG);
    at(h.hitBox(18, 18, 18), 0, 0, 0, cuffG);
    // груша с винтом-клапаном
    const BX = -44, BZ = 26;
    const bulbG = new T.Group(); at(bulbG, BX, TY + 4, BZ, g); clickable(bulbG, 'bulb');
    const bulb = h.ball(1, 0x2a2f3a, { hull: false }); bulb.scale.set(6, 4, 4); bulbG.add(bulb);
    const neck = cyl(1.2, 4, 0x56627d, { seg: 12 }); neck.rotation.z = Math.PI / 2; at(neck, 7.5, 0, 0, bulbG);
    at(h.hitBox(13, 8, 8), 0, 0, 0, bulbG);
    const valveG = new T.Group(); at(valveG, BX + 10, TY + 4, BZ, g); clickable(valveG, 'valve');
    const screw = cyl(1.8, 1.6, d.valve ? 0x86e0a8 : C.STEEL, { seg: 16 }); screw.rotation.z = Math.PI / 2; valveG.add(screw);
    at(h.hitBox(4, 5, 5), 0, 0, 0, valveG);
    const pf = h.pill(valveG, 0, 3.8, 0, d.valve ? 'спуск' : 'винт', d.valve ? '#1b1610' : '#e8ecf4', d.valve ? '#86e0a8' : '#1a2438', 2);
    // манометр на подставке
    const MX = -6, MZ = -28;
    const mg = new T.Group(); at(mg, MX, TY, MZ, g); mg.rotation.y = 0.3; clickable(mg, 'dial');
    at(box(10, 1.6, 7, 0x2c3240), 0, 0.8, 0, mg); at(cyl(0.8, 5, C.STEEL, { edges: false }), 0, 4, 0, mg);
    const caseM = cyl(10.5, 3.4, 0x3b4a66, { seg: 40 }); caseM.rotation.x = Math.PI / 2; at(caseM, 0, 16.5, 0, mg);
    const bez = mesh(new T.TorusGeometry(10.3, 0.6, 8, 40), C.STEEL, { edges: false }); at(bez, 0, 16.5, 1.7, mg);
    const dk = h.canvasTex(512, 512);
    const face = new T.Mesh(keep(new T.CircleGeometry(9.8, 48)), keep(new T.MeshBasicMaterial({ map: dk.tex }))); at(face, 0, 16.5, 1.75, mg);
    const glassF = new T.Mesh(keep(new T.CircleGeometry(9.9, 48)), h.glassMat(0xe8f4ff, 0.12)); at(glassF, 0, 16.5, 2.1, mg);
    let lastV = null;
    const drawDial = v => {
      const x = dk.x, c = 256, R = 238;
      x.fillStyle = '#eef1f6'; x.fillRect(0, 0, 512, 512);
      x.strokeStyle = '#1a2438'; x.fillStyle = '#1a2438'; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let p = 0; p <= 300; p += 10) {
        const a = dialA(p), r1 = p % 50 ? R - 22 : R - 42;
        x.lineWidth = p % 50 ? 3 : 7; x.beginPath(); x.moveTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1); x.lineTo(c + Math.cos(a) * (R - 6), c + Math.sin(a) * (R - 6)); x.stroke();
        if (p % 50 === 0) { x.font = '600 36px "IBM Plex Mono", monospace'; x.fillText(String(p), c + Math.cos(a) * (R - 78), c + Math.sin(a) * (R - 78)); }
      }
      [['ms', '#ff4b4b'], ['md', '#3f6fd8']].forEach(([k, col]) => { if (d[k] !== null && d[k] !== undefined) { const a = dialA(d[k]); x.fillStyle = col; x.beginPath(); x.arc(c + Math.cos(a) * (R - 14), c + Math.sin(a) * (R - 14), 13, 0, 7); x.fill(); } });
      x.fillStyle = '#1a2438'; x.font = '700 54px "IBM Plex Mono", monospace'; x.fillText(String(Math.round(v)), c, c + 110);
      x.font = '500 26px "Golos Text", sans-serif'; x.fillStyle = '#56627d'; x.fillText('мм рт. ст.', c, c + 152);
      const a = dialA(v); x.strokeStyle = '#d83a2a'; x.lineWidth = 9; x.lineCap = 'round'; x.beginPath(); x.moveTo(c - Math.cos(a) * 30, c - Math.sin(a) * 30); x.lineTo(c + Math.cos(a) * (R - 30), c + Math.sin(a) * (R - 30)); x.stroke();
      x.fillStyle = '#1a2438'; x.beginPath(); x.arc(c, c, 16, 0, 7); x.fill();
      dk.tex.needsUpdate = true;
    };
    drawDial(0);
    mg.updateMatrixWorld(true);
    const mBottom = v3(0, 6.2, 0).applyMatrix4(mg.matrixWorld);
    // резиновые трубки: манжета → груша, манжета → манометр
    const RUB = 0x2a2f3a;
    at(h.tube([v3(-42, AY + 7.6, AZ), v3(-46, AY + 9, AZ + 8), v3(-52, TY + 6, BZ - 6), v3(-50, TY + 4, BZ - 1), v3(BX - 5.6, TY + 4, BZ)], 0.6, RUB), 0, 0, 0, g);
    at(h.tube([v3(-31, AY + 7.6, AZ), v3(-27, AY + 9, AZ - 10), v3(-14, TY + 2, -22), v3(mBottom.x - 2, TY + 1.4, mBottom.z + 3), mBottom.clone().setY(TY + 2), mBottom], 0.6, RUB), 0, 0, 0, g);
    // фонендоскоп: головка на локтевом сгибе, трубки, оливы
    const SX = -20, SYc = AY + 7.6;
    const stG = new T.Group(); at(stG, SX, SYc, AZ, g); clickable(stG, 'steth');
    at(cyl(2.6, 1.2, C.STEEL, { seg: 24 }), 0, 0, 0, stG); at(cyl(1.8, 0.4, 0x9aa6bd, { edges: false }), 0, 0.8, 0, stG);
    at(cyl(0.6, 3, C.STEEL, { edges: false }), 0, 2.2, 0, stG);
    const toneGlow = h.glow(0xffb547, 12, 0); at(toneGlow, 0, 1.5, 0, stG);
    const tukK = h.canvasTex(256, 112); tukK.x.fillStyle = '#ffb547'; tukK.x.strokeStyle = '#1b1610'; tukK.x.lineWidth = 8;
    tukK.x.beginPath(); if (tukK.x.roundRect) tukK.x.roundRect(6, 6, 244, 100, 50); else tukK.x.rect(6, 6, 244, 100); tukK.x.fill(); tukK.x.stroke();
    tukK.x.fillStyle = '#1b1610'; tukK.x.font = '700 60px "Golos Text", sans-serif'; tukK.x.textAlign = 'center'; tukK.x.textBaseline = 'middle'; tukK.x.fillText('тук!', 128, 60);
    const tuk = new T.Sprite(keep(new T.SpriteMaterial({ map: tukK.tex, transparent: true, depthTest: false, depthWrite: false }))); tuk.renderOrder = 7; tuk.scale.set(7, 3, 1); tuk.visible = false; at(tuk, 0, 9, 0, stG);
    at(h.hitBox(7, 6, 7), 0, 1, 0, stG);
    const ST = 0x56627d;
    at(h.tube([v3(SX, SYc + 3.6, AZ), v3(SX + 2, SYc + 5, AZ - 6), v3(SX + 12, TY + 3, -16), v3(4, TY + 1.4, -18)], 0.55, ST), 0, 0, 0, g);
    at(h.tube([v3(4, TY + 1.4, -18), v3(10, TY + 1.4, -23), v3(14, TY + 1.4, -30)], 0.45, C.STEEL), 0, 0, 0, g);
    at(h.tube([v3(4, TY + 1.4, -18), v3(12, TY + 1.4, -18), v3(20, TY + 1.4, -22)], 0.45, C.STEEL), 0, 0, 0, g);
    at(h.ball(0.9, 0x2a2f3a), 14, TY + 1.4, -30, g); at(h.ball(0.9, 0x2a2f3a), 20, TY + 1.4, -22, g);
    // карточка пациента на планшете
    const card = new T.Group(); at(card, 34, TY, -18, g); clickable(card, 'newp');
    at(box(18, 0.8, 23, 0x8a5a33), 0, 0.4, 0, card); at(box(6, 0.8, 2, C.STEEL), 0, 1, -10, card);
    const ms = d.ms ?? '—', md = d.md ?? '—';
    const st = h.sticker(16, 20, `${d.name}\nверхнее: ${ms}\nнижнее: ${md}\n${d.okS && d.okD ? 'точно ✓' : 'карта пациента'}`, '#1b1610', d.okS && d.okD ? '#c9f0d4' : '#fffaf0', 320);
    st.rotation.x = -Math.PI / 2; at(st, 0, 0.85, 0.5, card);
    // кнопки
    h.key(g, -50, 40, 14, 7, 'Накачать', 0x3b4a66, 'pump');
    h.key(g, -33, 40, 14, 7, d.valve ? 'Стоп' : 'Спуск', d.valve ? 0x3fae5a : 0x56627d, 'valve', d.valve);
    h.key(g, -14, 40, 18, 7, 'Первый тон', 0xd84a4a, 'mk-s', d.ms !== null && d.ms !== undefined);
    h.key(g, 7, 40, 18, 7, 'Тоны исчезли', 0x3f6fd8, 'mk-d', d.md !== null && d.md !== undefined);
    h.key(g, 28, 40, 18, 7, 'Новый пациент', 0x56627d, 'newp');
    // анимация: манжета дышит, стрелка, тоны, пульс артерии
    kit.onFrame((dt, t) => {
      const L = live(); if (!L || L.cuff === undefined) return;
      const v = L.cuff, infl = Math.min(10, v / 22);
      cuff.scale.set(1 + infl * 0.028, 1, 1 + infl * 0.028); velcro.position.y = 7.8 + infl * 0.21;
      if (lastV !== Math.round(v)) { lastV = Math.round(v); drawDial(v); }
      const pulse = kit.reduce ? 0.4 : Math.max(0, 1 - (L.beat || 0) * 4);
      artMatA.emissiveIntensity = 0.15 + 0.6 * pulse;
      artMatB.emissiveIntensity = L.open ? 0.15 + 0.6 * pulse : 0;
      artMatB.color.setHex(L.open ? 0xb5303c : 0x6a3a42);
      toneGlow.material.opacity = L.tone ? 0.85 : 0; tuk.visible = !!L.tone;
    });
    // подписи
    tag(v3(MX, TY + 30, MZ), 'Манометр', d.valve ? `спуск ${d.rate} мм рт. ст./с` : 'клапан закрыт', d.valve);
    tag(v3(-36, AY + 12, AZ), 'Манжета', 'груша — накачать');
    tag(v3(SX + 2, SYc + 8, AZ + 2), 'Фонендоскоп', 'слушает тоны');
    tag(v3(34, TY + 4, -18), 'Пациент', d.name, d.okS && d.okD);
  };

  // ===================== Урок 4: прививочный кабинет =====================
  SC['blood-imm'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.mat(g);
    const VACC = 0x72d4e8, SERC = 0xb48cff, GOLD = 0xffb547;
    // карточки пациентов
    [['Асель', 'корь', d.ok0], ['Тимур', 'столбняк', d.ok1]].forEach(([nm, ill, ok], i) => {
      const x = -52 + i * 16, sel = d.ipt === i, cg = new T.Group(); at(cg, x, TY, -26, g); clickable(cg, 'ip-' + i);
      at(box(12, 1.2, 5, sel ? 0xffd166 : 0x56627d), 0, 0.6, 0, cg);
      const fr = box(12, 16, 0.8, 0xf4efe2); fr.rotation.x = -0.12; at(fr, 0, 9, -0.6, cg);
      const s = h.sticker(10.6, 14.4, `${nm}\n${ill}\n${ok ? 'защита ✓' : '—'}`, '#1b1610', ok ? '#c9f0d4' : sel ? '#fff1c9' : '#fffaf0', 240);
      s.rotation.x = -0.12; at(s, 0, 9, -0.1, cg);
      at(h.hitBox(12, 17, 3), 0, 8.5, 0, cg);
    });
    // модель лимфоцита на подставке, вокруг — антитела
    const LX = -8, LZ = -14, LY = TY + 17;
    at(cyl(6, 1.4, C.WOOD2), LX, TY + 0.7, LZ, g); at(cyl(0.7, 9, C.BRASS, { edges: false }), LX, TY + 5, LZ, g);
    const cell = h.ball(8, 0xdcd3ee, { seg: 32, seg2: 24 }); at(cell, LX, LY, LZ, g);
    at(h.ball(6.3, 0x5e3f8c, { seg: 28, seg2: 20, hull: false }), LX + 0.6, LY + 0.4, LZ + 2.4, g);
    const yGeo = { stem: keep(new T.CylinderGeometry(0.28, 0.28, 2, 8)), arm: keep(new T.CylinderGeometry(0.25, 0.25, 1.7, 8)) };
    const yMat = h.ownMat(GOLD);
    const Y = () => {
      const y = new T.Group();
      const st = new T.Mesh(yGeo.stem, yMat); st.position.y = -1; y.add(st);
      [-1, 1].forEach(sx => { const a = new T.Mesh(yGeo.arm, yMat); a.rotation.z = -sx * 0.6; a.position.set(sx * 0.48, 0.7, 0); y.add(a); });
      return y;
    };
    const nAb = Math.round(clamp(d.aV, 0, 5) / 5 * 22);
    const abs = [];
    for (let i = 0; i < nAb; i++) {
      const y = Y(); g.add(y);
      abs.push({ y, a: rnd(i + 5) * 6.283, b: (rnd(i + 9) - 0.5) * 2.2, r: 11 + rnd(i + 13) * 4, sp: 0.15 + rnd(i + 17) * 0.2, sp2: rnd(i + 19) * 6.28 });
    }
    // клетки памяти
    if (d.mem) [[-6, 4], [5, 6], [-1, 9]].forEach(([dx, dz]) => { const m = h.ball(2.4, 0xc9b8f0); at(m, LX + dx, TY + 2.6, LZ + dz, g); at(h.ball(1.6, 0x5e3f8c, { hull: false }), LX + dx + 0.2, TY + 2.9, LZ + dz + 1, g); });
    // возбудитель
    const PX = 26, PZ = -14, PY = TY + 15;
    const pg = new T.Group(); at(pg, PX, PY, PZ, g); clickable(pg, 'virus');
    at(cyl(5, 1.4, C.WOOD2), PX, TY + 0.7, PZ, g); at(cyl(0.6, PY - TY - 6, C.BRASS, { edges: false }), PX, TY + (PY - TY - 6) / 2 + 1, PZ, g);
    const dead = d.prot;
    const spin = new T.Group(); pg.add(spin);
    if (d.long) {
      const core = h.ball(5, dead ? 0x9aa3b2 : 0xff8a73, { seg: 26, seg2: 18 }); spin.add(core);
      for (let i = 0; i < 26; i++) {
        const a = rnd(i + 31) * 6.283, b = Math.acos(2 * rnd(i + 37) - 1), n = v3(Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a));
        const sp = cyl(0.3, 1.8, dead ? 0x6f7a8c : 0xd8443a, { edges: false, hull: false, seg: 6 }); sp.quaternion.setFromUnitVectors(v3(0, 1, 0), n); sp.position.copy(n.clone().multiplyScalar(5.6)); spin.add(sp);
        const tip = h.ball(0.45, dead ? 0x6f7a8c : 0xffd0c0, { hull: false, seg: 8, seg2: 6 }); tip.position.copy(n.clone().multiplyScalar(6.6)); spin.add(tip);
      }
    } else {
      const rod = cyl(2, 9, dead ? 0x9aa3b2 : 0x9c6b3f, { seg: 20 }); rod.rotation.z = Math.PI / 2; spin.add(rod);
      [-4.5, 4.5].forEach(x => { const e = h.ball(2, dead ? 0x9aa3b2 : 0x9c6b3f); e.position.x = x; spin.add(e); });
      for (let i = 0; i < 6; i++) { const m = h.ball(0.6, dead ? 0x6f7a8c : 0x3a2418, { hull: false, seg: 8, seg2: 6 }); m.position.set(-6 + i * 2.4, 3.4 + Math.sin(i) * 0.8, 1.5 * Math.cos(i * 2)); spin.add(m); }
      // ржавый гвоздь
      const nail = cyl(0.45, 11, 0x8a4a2a, { seg: 8 }); nail.rotation.set(0, 0.5, Math.PI / 2); at(nail, PX + 10, TY + 0.9, PZ + 8, g);
      const hd = cyl(1.3, 0.5, 0x8a4a2a, { seg: 12 }); hd.rotation.set(0, 0.5, Math.PI / 2); at(hd, PX + 10 - Math.cos(0.5) * 5.6, TY + 1.3, PZ + 8 + Math.sin(0.5) * 5.6, g);
    }
    if (dead) for (let i = 0; i < 7; i++) {
      const a = i / 7 * 6.283, n = v3(Math.cos(a), Math.sin(a) * 0.8, 0.6).normalize();
      const y = Y(); y.quaternion.setFromUnitVectors(v3(0, -1, 0), n); y.position.copy(n.clone().multiplyScalar(d.long ? 7.6 : 4.2)); spin.add(y);
    } else at(h.glow(0xff5a40, 22, 0.35), 0, 0, 0, pg);
    at(h.hitBox(14, 14, 14), 0, 0, 0, pg);
    // флаконы на лотке
    at(box(30, 1, 14, 0xd7dde4), -40, TY + 0.5, 14, g);
    const vial = (x, col, keyName, label, on) => {
      const vg = new T.Group(); at(vg, x, TY + 1, 10, g); clickable(vg, keyName);
      const wall = new T.Mesh(keep(new T.CylinderGeometry(2.4, 2.4, 6, 24, 1, true)), h.glassMat(0xd8eef8, 0.3)); at(wall, 0, 3, 0, vg);
      const lq = new T.Mesh(keep(new T.CylinderGeometry(2.1, 2.1, 4, 20)), h.ownMat(col, { transparent: true, opacity: 0.7 })); at(lq, 0, 2.1, 0, vg);
      at(cyl(1.4, 1.4, 0xd7dde4, { seg: 16 }), 0, 6.7, 0, vg); at(cyl(1.8, 1.2, col, { seg: 16 }), 0, 7.9, 0, vg);
      at(h.sticker(4.4, 2.4, label, '#1b1610', '#fffaf0', 200), 0, 3, 2.45, vg);
      at(h.hitBox(6, 10, 6), 0, 4.5, 0, vg);
      if (on) h.ring(g, x, TY + 1.1, 10, 4);
      // шприц на лотке, если введено
      if (on) {
        const sg = new T.Group(); at(sg, x, TY + 2.2, 17.5, g); sg.rotation.y = 0.15; clickable(sg, keyName);
        const barrel = new T.Mesh(keep(new T.CylinderGeometry(1, 1, 8, 16, 1, true)), h.glassMat(0xeef6fb, 0.4)); barrel.rotation.z = Math.PI / 2; sg.add(barrel);
        const fill = cyl(0.85, 5, col, { edges: false, hull: false }); fill.rotation.z = Math.PI / 2; at(fill, 1.4, 0, 0, sg);
        const plg = cyl(0.3, 6, 0xf4f4f4, { edges: false }); plg.rotation.z = Math.PI / 2; at(plg, -6, 0, 0, sg);
        const ndl = cyl(0.12, 5, C.STEEL, { edges: false, hull: false }); ndl.rotation.z = Math.PI / 2; at(ndl, 6.5, 0, 0, sg);
      }
    };
    vial(-48, VACC, 'vac', 'вакцина', d.vac.on); vial(-32, SERC, 'ser', 'сыворотка', d.ser.on);
    // календарь дней: бумажная лента
    const RX0 = -14, RX1 = 56, RZ = 28, dx = day => RX0 + day / d.D * (RX1 - RX0);
    at(box(RX1 - RX0 + 4, 0.3, 8, 0xfbf6e8), (RX0 + RX1) / 2, TY + 0.15, RZ, g);
    const band = d.band || '';
    for (let i = 0; i < d.D; i++) if (band[i] === '1') at(box(dx(i + 1) - dx(i) + 0.02, 0.06, 2.4, 0x86e0a8, { edges: false, shadow: false }), (dx(i) + dx(i + 1)) / 2, TY + 0.33, RZ - 1.6, g);
    if (!d.prot) { const ex = d.long ? Math.min(d.D, d.V + 12) : d.D; at(box(dx(ex) - dx(d.V), 0.06, 2.4, 0xff8a73, { edges: false, shadow: false }), (dx(d.V) + dx(ex)) / 2, TY + 0.34, RZ + 1.4, g); }
    const stepT = d.D > 30 ? 5 : 1, stepL = d.D > 30 ? 10 : 5;
    for (let dd = 0; dd <= d.D; dd += stepT) {
      at(box(0.25, 0.1, dd % stepL ? 1.4 : 2.6, 0x3a2e22, { edges: false, shadow: false }), dx(dd), TY + 0.36, RZ + 2.6, g);
      if (dd % stepL === 0) h.floorLabel(g, dx(dd), RZ + 5.6, 4, 2, String(dd), '#1b1610', '#fbf6e8');
    }
    const flag = (day, col, txt, y = 7) => {
      const x = dx(day);
      at(cyl(0.22, y, 0x56627d, { edges: false, hull: false }), x, TY + y / 2, RZ - 0.4, g);
      h.pill(g, x, TY + y + 1.4, RZ - 0.4, txt, '#1b1610', hexs(col), 2.2);
    };
    flag(d.V, 0xff8a73, d.long ? 'вирус' : 'токсин', 9);
    if (d.vac.on) flag(d.vac.day, VACC, 'В ' + d.vac.day, 5);
    if (d.ser.on) flag(d.ser.day, SERC, 'С ' + d.ser.day, 3);
    // кнопки: сдвиг дня
    const st = d.long ? 5 : 1;
    h.key(g, -54, 40, 13, 7, `В −${st}`, 0x2f8fa8, 'vac-');
    h.key(g, -40, 40, 13, 7, `В +${st}`, 0x2f8fa8, 'vac+');
    h.key(g, -24, 40, 13, 7, `С −${st}`, 0x7d5cc4, 'ser-');
    h.key(g, -10, 40, 13, 7, `С +${st}`, 0x7d5cc4, 'ser+');
    // анимация: антитела парят вокруг клетки, возбудитель медленно вращается
    kit.onFrame((dt, t) => {
      const tt = kit.reduce ? 0 : t;
      abs.forEach(o => {
        const a = o.a + tt * o.sp;
        o.y.position.set(LX + Math.cos(a) * o.r, LY + o.b * 4 + Math.sin(tt * 1.3 + o.sp2) * 0.8, LZ + Math.sin(a) * o.r);
        o.y.rotation.set(tt * 0.7 + o.sp2, tt * 0.5, o.sp2);
      });
      spin.rotation.y = tt * 0.35;
    });
    // подписи
    const status = d.ok ? 'защищён(а)' : d.prot ? 'не заболеет, но ненадолго' : 'заболеет';
    tag(v3(-52 + d.ipt * 16, TY + 20, -26), d.name, d.ill + ' · ' + status, d.ok);
    tag(v3(LX, LY + 11, LZ), 'Лимфоцит', `антитела в день ${d.V}: ${fmt(d.aV, 2)}${d.mem ? ' · память' : ''}`, d.aV >= 1);
    tag(v3(PX, PY + 9, PZ), d.long ? 'Вирус кори' : 'Бактерия столбняка', d.prot ? 'обезврежен антителами' : `действует с дня ${d.V}`, !d.prot);
    tag(v3(-48, TY + 12, 10), 'Вакцина', d.vac.on ? `день ${d.vac.day}` : 'нажмите — ввести', d.vac.on);
    tag(v3(-32, TY + 12, 10), 'Сыворотка', d.ser.on ? `день ${d.ser.day}` : 'нажмите — ввести', d.ser.on);
    tag(v3((RX0 + RX1) / 2, TY + 2, RZ + 8), 'Календарь', `дни 0–${d.D} · зелёное — защита`);
  };
})();
