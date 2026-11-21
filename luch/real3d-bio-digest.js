// «Как в жизни» для биологии: «Дыхание и питание» (labs/bio-digest). Сцены: модель лёгких Дондерса под колоколом, водяной спирометр и самописец
// со спирограммой; анатомическая модель пищеварительного тракта на стенде, флаконы соков и тарелка с обедом, пробирки «всосалось»;
// прилавок с продуктами и табло суточного меню; модель нефрона на стенде, колбы с веществами, мерный цилиндр мочи, бутылка воды и лампа-«жара».
// Сцены строятся из window.LUCH_REAL() опыта; объём лёгких и спирограмма — из window.LUCH_REAL.live() каждый кадр.
(() => {
  const SC = window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {};
  const live = () => { try { const f = window.LUCH_REAL && window.LUCH_REAL.live; return f ? f() : null; } catch (e) { return null; } };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (x, n) => (Math.round(x * 10 ** n) / 10 ** n).toFixed(n).replace('.', ',');
  const rnd = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const now = () => performance.now() / 1000;
  const ease = k => k * k * (3 - 2 * k);
  const mem = {};
  const FONT = '"Golos Text", "IBM Plex Sans", sans-serif', MONO = '"IBM Plex Mono", monospace';

  // ---------- общие детали ----------
  function H(kit) {
    const { T, at, box, cyl, mesh, keep, grad, glowTex, clickable } = kit;
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    const v2 = (x, y) => new T.Vector2(x, y);
    const glassMat = (color = 0xd8eef8, opacity = 0.24) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, transparent: true, opacity, side: T.DoubleSide, depthWrite: false }));
    const ownMat = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, ...o }));
    const basic = (color, o = {}) => keep(new T.MeshBasicMaterial({ color, ...o }));
    const glow = (color, size, opacity) => { const s = new T.Sprite(keep(new T.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending }))); s.scale.setScalar(size); return s; };
    const ball = (r, color, o = {}) => mesh(new T.SphereGeometry(r, o.seg || 18, o.seg2 || 12), color, { hull: o.hull ?? true, edges: false, matOpt: o.matOpt, mat: o.mat, shadow: o.shadow });
    const blob = (parent, x, y, z, sx, sy, sz, color, o = {}) => { const b = ball(1, color, { seg: 28, seg2: 18, ...o }); b.scale.set(sx, sy, sz); return at(b, x, y, z, parent); };
    const hitBox = (w, h, d) => new T.Mesh(keep(new T.BoxGeometry(w, h, d)), basic(0xffffff, { transparent: true, opacity: 0, depthWrite: false }));
    function rodAB(parent, a, b, r, color, o = {}) {
      const dv = b.clone().sub(a), L = dv.length();
      const m = cyl(r, L, color, { edges: false, ...o });
      m.quaternion.setFromUnitVectors(v3(0, 1, 0), dv.normalize());
      return at(m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, parent);
    }
    // трубка по точкам: плавная (Catmull-Rom) или ломаная
    function tube(parent, pts, r, color, o = {}) {
      let curve;
      if (o.poly) { curve = new T.CurvePath(); for (let i = 1; i < pts.length; i++) curve.add(new T.LineCurve3(pts[i - 1], pts[i])); }
      else curve = new T.CatmullRomCurve3(pts, false, 'centripetal');
      const geo = new T.TubeGeometry(curve, o.segs || Math.max(40, Math.round(curve.getLength() * 3)), r, o.radial || 12);
      const m = mesh(geo, color, { edges: false, hull: o.hull ?? true, mat: o.mat, shadow: o.shadow });
      at(m, 0, 0, 0, parent); m.userData.curve = curve; return m;
    }
    function canvasPlane(w, h, pw, draw, o = {}) {
      const ph = Math.round(pw * h / w), c = document.createElement('canvas'); c.width = pw; c.height = ph;
      const x = c.getContext('2d'), tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: tex, transparent: true, side: o.side || T.FrontSide })));
      m.userData.draw = fn => { x.clearRect(0, 0, pw, ph); fn(x, pw, ph); tex.needsUpdate = true; };
      if (draw) m.userData.draw(draw);
      return m;
    }
    const rr = (x, x0, y0, w, h, r) => { x.beginPath(); if (x.roundRect) x.roundRect(x0, y0, w, h, r); else x.rect(x0, y0, w, h); };
    function fitText(x, t, cx, cy, maxW, size, weight = 700, font = FONT, color = '#1b1610', align = 'center') {
      let fs = size; x.font = `${weight} ${fs}px ${font}`;
      const tw = x.measureText(t).width; if (tw > maxW) { fs = Math.floor(fs * maxW / tw); x.font = `${weight} ${fs}px ${font}`; }
      x.fillStyle = color; x.textAlign = align; x.textBaseline = 'middle'; x.fillText(t, cx, cy);
    }
    // бумажная карточка с 1–3 строками
    function card(w, h, lines, o = {}) {
      return canvasPlane(w, h, o.pw || 256, (x, pw, ph) => {
        x.fillStyle = o.bg || '#fffaf0'; rr(x, 3, 3, pw - 6, ph - 6, ph * 0.14); x.fill();
        x.strokeStyle = o.stroke || '#1b1610'; x.lineWidth = 5; x.stroke();
        const n = lines.length, lh = (ph - 12) / n;
        lines.forEach((l, i) => { const L = typeof l === 'object' ? l : { t: l }; fitText(x, L.t, pw / 2, 6 + lh * (i + 0.5), pw * 0.88, Math.round(lh * (L.s || 0.62)), L.w || 700, L.mono ? MONO : FONT, L.c || '#1b1610'); });
      }, o);
    }
    // табло: текст меняется на лету
    function screen(w, h, pw = 320) {
      let cur = null;
      const m = canvasPlane(w, h, pw);
      m.userData.set = (t, col = '#86e0a8') => {
        t = String(t); if (cur === t + col) return; cur = t + col;
        m.userData.draw((x, W, Hh) => {
          x.fillStyle = '#0e1520'; x.fillRect(0, 0, W, Hh);
          const ls = t.split('\n'), lh = Hh / ls.length;
          ls.forEach((l, i) => fitText(x, l, W / 2, lh * (i + 0.5) + 2, W * 0.9, Math.round(lh * 0.64), 600, MONO, col));
        });
      };
      return m;
    }
    function button(parent, x, y, z, txt, color, key, w = 4.2) {
      const b = new T.Group(); at(b, x, y, z, parent);
      at(box(w, 1.4, 3.6, color), 0, 0.7, 0, b);
      const top = canvasPlane(w * 0.82, 2.9, 128, (c, W, Hh) => { c.fillStyle = '#' + color.toString(16).padStart(6, '0'); c.fillRect(0, 0, W, Hh); fitText(c, txt, W / 2, Hh / 2 + 2, W * 0.86, Hh * 0.7, 800, FONT, '#ffffff'); });
      top.rotation.x = -Math.PI / 2; at(top, 0, 1.42, 0, b);
      clickable(b, key); return b;
    }
    function ring(parent, x, y, z, r, color = 0xffd166, th = 0.45) {
      const m = new T.Mesh(keep(new T.TorusGeometry(r, th, 6, 44)), basic(color));
      m.rotation.x = Math.PI / 2; return at(m, x, y, z, parent);
    }
    // тело вращения из профиля [[r, y], …]: стекло или непрозрачное
    function lathe(parent, x, y, z, prof, color, o = {}) {
      const geo = new T.LatheGeometry(prof.map(p => v2(p[0], p[1])), o.seg || 36);
      let m;
      if (o.glass) { m = new T.Mesh(keep(geo), glassMat(color, o.op ?? 0.26)); m.add(new T.Mesh(geo, kit.hullMat)); }
      else m = mesh(geo, color, { edges: false, hull: true, matOpt: o.matOpt });
      return at(m, x, y, z, parent);
    }
    // жидкость единичной высоты: высоту можно менять каждый кадр
    function liquid(parent, x, y0, z, r, color, opacity = 0.62, r2) {
      const mat = ownMat(color, { transparent: true, opacity, depthWrite: false });
      const m = new T.Mesh(keep(new T.CylinderGeometry(r2 ?? r, r, 1, 36)), mat);
      at(m, x, y0, z, parent);
      const set = hgt => { m.visible = hgt > 0.05; m.scale.y = Math.max(0.05, hgt); m.position.y = y0 + Math.max(0.05, hgt) / 2; };
      return { m, mat, set };
    }
    // мерный цилиндр с делениями
    function cylinderGlass(parent, x, z, r, hh, marks) {
      const g = new T.Group(); at(g, x, 0, z, parent);
      at(cyl(r + 1.6, 1, 0xdfe8ef, { seg: 6 }), 0, 0.5, 0, g);
      const w = new T.Mesh(keep(new T.CylinderGeometry(r, r, hh, 36, 1, true)), glassMat(0xd8eef8, 0.22)); w.add(new T.Mesh(w.geometry, kit.hullMat)); at(w, 0, 1 + hh / 2, 0, g);
      const lip = mesh(new T.TorusGeometry(r, 0.22, 6, 36), 0xeef6fb, { edges: false, shadow: false }); lip.rotation.x = Math.PI / 2; at(lip, 0, 1 + hh, 0, g);
      for (let k = 1; k <= marks; k++) at(box(k % 2 ? 1 : 1.8, 0.14, 0.1, 0x4f5f78, { edges: false, shadow: false }), 0, 1 + hh * k / marks * 0.92, r + 0.05, g);
      return g;
    }
    // наклонная табличка-ценник на столе
    function easel(parent, x, z, w, h, plane, tilt = -0.9) {
      const g = new T.Group(); at(g, x, 0, z, parent);
      at(box(w + 0.6, 0.6, 2.4, 0x3a3f4c), 0, 0.3, 0, g);
      plane.rotation.x = tilt; at(plane, 0, 0.6 + Math.sin(-tilt) * h / 2 * 0.98, 0.2, g);
      return g;
    }
    // точка на ломаной (как в схеме)
    function polyAt(P, q) {
      let L = 0; const seg = [];
      for (let i = 1; i < P.length; i++) { const d = P[i].distanceTo(P[i - 1]); seg.push(d); L += d; }
      let s = clamp(q, 0, 1) * L;
      for (let i = 0; i < seg.length; i++) { if (s <= seg[i] || i === seg.length - 1) return P[i].clone().lerp(P[i + 1], seg[i] ? clamp(s / seg[i], 0, 1) : 0); s -= seg[i]; }
      return P[P.length - 1].clone();
    }
    return { v3, v2, glassMat, ownMat, basic, glow, ball, blob, hitBox, rodAB, tube, canvasPlane, rr, fitText, card, screen, button, ring, lathe, liquid, cylinderGlass, easel, polyAt };
  }

  // =====================================================================================
  // ===== «Лёгкие и дыхание»: модель Дондерса (колокол, шарики-лёгкие, резиновая мембрана-диафрагма), спирометр, самописец =====
  SC['dig-breath'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const kOf = u => clamp((u - d.umin) / (d.umax - d.umin), 0, 1);
    const L0 = live() || { u: 0, spiro: [], flow: 0 };
    // --- модель Дондерса на кольцевой подставке ---
    const jx = -36, jz = 4, RY = 12;
    const st = new T.Group(); at(st, jx, 0, jz, g);
    const rg = mesh(new T.TorusGeometry(12.6, 0.7, 8, 48), C.STEEL, { edges: false }); rg.rotation.x = Math.PI / 2; at(rg, 0, RY, 0, st);
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3 + 0.5; h.rodAB(st, v3(Math.cos(a) * 12.6, RY, Math.sin(a) * 12.6), v3(Math.cos(a) * 14.5, 0, Math.sin(a) * 14.5), 0.55, C.STEEL); }
    // стеклянный колокол
    h.lathe(st, 0, RY, 0, [[12, 0], [12, 20], [11.4, 24], [9, 28], [4.5, 30.6], [3.3, 31.4], [3.3, 33]], 0xd8eef8, { glass: true, op: 0.2 });
    at(cyl(3.6, 3.2, 0x8a3a30, { r2: 3.9 }), 0, RY + 34.4, 0, st); // резиновая пробка
    // трахея и бронхи — стеклянные трубки
    const glassT = { mat: h.glassMat(0xe8f6ff, 0.55), hull: true, shadow: false };
    h.tube(st, [v3(0, RY + 39, 0), v3(0, RY + 22, 0)], 0.8, 0xe8f6ff, glassT);
    h.tube(st, [v3(0, RY + 22.4, 0), v3(-2.2, RY + 20.5, 0), v3(-5.4, RY + 17.5, 0)], 0.65, 0xe8f6ff, glassT);
    h.tube(st, [v3(0, RY + 22.4, 0), v3(2.2, RY + 20.5, 0), v3(5.4, RY + 17.5, 0)], 0.65, 0xe8f6ff, glassT);
    // шарики-лёгкие
    const lungs = new T.Group(); at(lungs, 0, 0, 0, st); clickable(lungs, 'calm');
    const balls = [-1, 1].map(s => {
      at(cyl(0.9, 1.6, 0xd9707e, { edges: false }), s * 5.5, RY + 17, 0, lungs);
      const b = h.blob(lungs, s * 5.6, RY + 12, 0, 4, 4, 4, 0xf08a9a); return b;
    });
    // мембрана-диафрагма и ручка
    const memG = kit.keep(new T.SphereGeometry(1, 40, 10, 0, Math.PI * 2, 0, Math.PI / 2));
    const memb = new T.Mesh(memG, h.ownMat(0xc0504a, { side: T.DoubleSide })); memb.castShadow = true; at(memb, 0, RY, 0, st);
    const rim = mesh(new T.TorusGeometry(12.1, 0.5, 6, 48), 0x8a3a30, { edges: false }); rim.rotation.x = Math.PI / 2; at(rim, 0, RY, 0, st);
    const handle = new T.Group(); at(handle, 0, RY, 0, st); clickable(handle, 'pull');
    at(cyl(0.45, 4, C.STEEL, { edges: false }), 0, -2, 0, handle);
    at(h.ball(1.5, 0x3b6fd8), 0, -4.4, 0, handle);
    handle.add(at(h.hitBox(5, 7, 5), 0, -3, 0, new T.Group()));
    // стрелки воздуха над трубкой
    const arrow = new T.Group(); at(arrow, 0, RY + 44, 0, st);
    const cone = mesh(new T.ConeGeometry(1.3, 2.6, 16), 0x72d4e8, { edges: false, shadow: false }); at(cone, 0, 0, 0, arrow);
    const inM = h.basic(0x72d4e8), outM = h.basic(0xb48cff); cone.material = inM;
    // --- водяной спирометр ---
    const sx = 2, sz = -12, VS = 3.2;
    const sp = new T.Group(); at(sp, sx, 0, sz, g);
    at(cyl(8.6, 1, C.DARK), 0, 0.5, 0, sp);
    at(cyl(8, 18, 0x4a78b0, { seg: 40 }), 0, 10, 0, sp);
    at(cyl(7.6, 0.4, 0x5fb4e0, { edges: false, hull: false }), 0, 18.9, 0, sp);
    const bell = new T.Group(); at(bell, 0, 0, 0, sp);
    at(cyl(7, 17, 0xe8ecf4, { seg: 40 }), 0, -8.5, 0, bell);
    at(cyl(7.2, 0.8, 0xc6ccd6, { seg: 40 }), 0, 0.4, 0, bell);
    at(box(6, 0.6, 0.6, 0xe0473a), 10.8, 0.4, 0, bell); // указатель
    // шкала объёма
    const scl = h.canvasPlane(3.4, 7 * VS, 128, (x, W, Hh) => {
      x.fillStyle = '#fffaf0'; x.fillRect(0, 0, W, Hh); x.strokeStyle = '#1b1610'; x.lineWidth = 3; x.strokeRect(1, 1, W - 2, Hh - 2);
      for (let v = 0; v <= 7; v++) { const y = Hh - v / 7 * Hh; x.fillStyle = '#1b1610'; x.fillRect(0, y - 2, W * 0.35, 4); if (v && v < 7) h.fitText(x, String(v), W * 0.68, y, W * 0.5, 34, 700, MONO); }
      for (let v = 0.5; v < 7; v += 1) { const y = Hh - v / 7 * Hh; x.fillRect(0, y - 1, W * 0.2, 2); }
    });
    at(box(3.8, 7 * VS + 1, 0.6, 0x3a3f4c), 14.6, 19 + 7 * VS / 2 - 0.2, -0.4, sp);
    at(scl, 14.6, 19 + 7 * VS / 2 - 0.2, 0.0, sp);
    at(cyl(0.4, 19, C.STEEL, { edges: false }), 14.6, 9.5, -0.4, sp);
    // табло объёма на баке
    const scr = h.screen(8, 3.2, 256); at(scr, 0, 9, 8.4, sp); scr.userData.set('V = ' + fmt(d.frc + L0.u, 2) + ' л', '#e8ecf4');
    // мундштук (спокойное дыхание)
    const mp = new T.Group(); at(mp, -6, 0, 9, sp); clickable(mp, 'auto');
    const mt = cyl(0.9, 7, 0xeef6fb, { edges: false }); mt.rotation.x = Math.PI / 2; at(mt, 0, 14, 0, mp);
    const mo = cyl(1.5, 2.4, 0x3b6fd8, { r2: 1.1 }); mo.rotation.x = Math.PI / 2; at(mo, 0, 14, 4.4, mp);
    mp.add(at(h.hitBox(5, 5, 10), 0, 14, 1.5, new T.Group()));
    if (d.auto) h.ring(sp, -6, 0.3, 13, 3.2);
    // шланг от спирометра к трахее
    kit.cable(v3(sx - 8, 16, sz), v3(jx, RY + 39.5, jz), 0x5a6a80, 0, { r: 0.75, lift: 2, arch: 1 });
    // --- самописец со спирограммой ---
    const kx = 38, kz = 10, PW = 24, PH = 15, PY = 4;
    const ky = new T.Group(); at(ky, kx, 0, kz, g);
    at(box(PW + 10, 2.4, 12, 0x3b4a66), 0, 1.2, -2, ky);
    const drums = [-1, 1].map(s => { const dr = cyl(2.2, PH + 1, 0xdfe3ea, { seg: 24 }); at(dr, s * (PW / 2 + 1.2), PY + PH / 2 + 0.2, -1.6, ky); return dr; });
    drums.forEach(dr => { for (let i = 0; i < 4; i++) at(box(0.25, PH + 1.1, 0.25, 0x6f8098, { edges: false, shadow: false }), Math.cos(i * 1.57) * 2.2, 0, Math.sin(i * 1.57) * 2.2, dr); });
    const VMAX = 6.5;
    const paper = h.canvasPlane(PW, PH, 640);
    at(paper, 0, PY + PH / 2, 0.7, ky);
    at(box(PW + 0.6, PH + 0.6, 0.4, 0xfffaf0, { edges: true }), 0, PY + PH / 2, 0.3, ky);
    const pen = new T.Group(); at(pen, PW / 2 + 0.6, 0, 1.4, ky);
    at(box(5, 0.5, 0.5, 0x2c3240), 2.2, 0, 0, pen); at(h.ball(0.6, 0xe0473a, { hull: false }), -0.2, 0, 0, pen);
    const drawPaper = L => {
      paper.userData.draw((x, W, Hh) => {
        const Y = v => Hh * (1 - v / VMAX);
        x.fillStyle = '#fffaf0'; x.fillRect(0, 0, W, Hh);
        x.fillStyle = 'rgba(255,138,115,.16)'; x.fillRect(0, Y(d.rv), W, Hh - Y(d.rv));
        x.strokeStyle = 'rgba(60,80,110,.25)'; x.lineWidth = 1.5;
        for (let v = 1; v < VMAX; v++) { x.beginPath(); x.moveTo(0, Y(v)); x.lineTo(W, Y(v)); x.stroke(); }
        for (let i = 1; i < 16; i++) { x.beginPath(); x.moveTo(i * W / 16, 0); x.lineTo(i * W / 16, Hh); x.stroke(); }
        x.setLineDash([8, 8]); x.strokeStyle = '#56627d'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, Y(d.frc)); x.lineTo(W, Y(d.frc)); x.stroke(); x.setLineDash([]);
        h.fitText(x, 'остаточный объём', W / 2, (Y(d.rv) + Hh) / 2, W * 0.6, 22, 600, FONT, '#c0503a');
        const sp2 = (L && L.spiro) || [], n = sp2.length, step = W / Math.max(2, d.maxs - 1);
        if (n > 1) {
          x.strokeStyle = '#1b5fd0'; x.lineWidth = 4; x.lineJoin = 'round'; x.beginPath();
          sp2.forEach((V, i) => { const px = W - (n - 1 - i) * step, py = Y(V); i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke();
        }
        if (d.vcDone && L) {
          const y1 = Y(d.frc + L.hiU), y2 = Y(d.frc + L.loU), bx = 40;
          x.strokeStyle = '#1f9a55'; x.lineWidth = 4; x.beginPath(); x.moveTo(bx - 10, y1); x.lineTo(bx + 10, y1); x.moveTo(bx, y1); x.lineTo(bx, y2); x.moveTo(bx - 10, y2); x.lineTo(bx + 10, y2); x.stroke();
          x.fillStyle = '#ffffff'; h.rr(x, bx + 16, (y1 + y2) / 2 - 22, 190, 44, 10); x.fill(); x.strokeStyle = '#1f9a55'; x.stroke();
          h.fitText(x, 'ЖЁЛ ≈ ' + fmt(d.vc, 1) + ' л', bx + 111, (y1 + y2) / 2 + 1, 176, 30, 800, FONT, '#1f9a55');
        }
        x.strokeStyle = '#1b1610'; x.lineWidth = 4; x.strokeRect(2, 2, W - 4, Hh - 4);
      });
    };
    drawPaper(L0);
    // --- каждый кадр: объём лёгких, мембрана, шарики, колокол, перо ---
    let acc = 1, sm = L0.u;
    kit.onFrame((dt, t) => {
      const L = live(); if (!L) return;
      sm = kit.reduce ? L.u : sm + (L.u - sm) * Math.min(1, dt * 18);
      const k = kOf(sm), V = d.frc + sm;
      const dy = 3.6 - 8.8 * k; memb.scale.set(11.9, Math.abs(dy) < 0.06 ? 0.06 : dy, 11.9);
      handle.position.y = RY + dy;
      const s = 0.62 + 0.55 * k; balls.forEach(b => { b.scale.setScalar(4 * s); b.position.y = RY + 16.4 - 4 * s; });
      bell.position.y = 19 + V * VS - 0.4;
      pen.position.y = PY + PH * clamp(V / VMAX, 0, 1);
      const fl = L.flow || 0;
      arrow.visible = Math.abs(fl) > 0.06;
      if (arrow.visible) { cone.rotation.z = fl > 0 ? Math.PI : 0; cone.material = fl > 0 ? inM : outM; arrow.position.y = RY + 44 + (kit.reduce ? 0 : ((t * 2) % 1) * (fl > 0 ? -2 : 2)); }
      scr.userData.set('V = ' + fmt(V, 2) + ' л', d.vcDone ? '#86e0a8' : '#e8ecf4');
      if (!kit.reduce) drums.forEach(dr => { dr.rotation.y -= dt * 0.8; });
      acc += dt; if (acc > 0.07) { acc = 0; drawPaper(L); }
    });
    tag(v3(jx, RY + 47, jz), 'Модель лёгких', d.auto ? 'спокойное дыхание' : 'мембрана — диафрагма');
    tag(v3(sx, 46, sz), 'Спирометр', d.vcDone ? 'ЖЁЛ ≈ ' + fmt(d.vc, 1) + ' л' : d.peak ? 'теперь — макс. выдох' : 'объём лёгких');
    tag(v3(kx, PY + PH + 4, kz), 'Спирограмма', d.vcDone ? 'измерено' : 'запись идёт', d.vcDone);
  };

  // =====================================================================================
  // ===== «Пищеварение: путь обеда»: анатомическая модель на стенде, флаконы соков, тарелка, пробирки «всосалось» =====
  const SX = sx => (sx - 295) * 0.26, SY = sy => 62 - (sy - 100) * 0.17, OZ = -17;
  const P = (sx, sy, dz = 0) => [SX(sx), SY(sy), OZ + dz];
  SC['dig-tract'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const V = (sx, sy, dz) => v3(...P(sx, sy, dz));
    const g = new T.Group(); at(g, 0, 0, 0);
    // --- стенд: доска с силуэтом тела ---
    const BW = 64, BY0 = 6, BY1 = SY(46);
    at(box(BW + 6, 3, 12, C.WOOD2), 0, 1.5, -21, g);
    at(box(BW, BY1 - BY0, 1.6, 0x2c3a52), 0, (BY0 + BY1) / 2, -22, g);
    const sil = h.canvasPlane(BW - 2, BY1 - BY0 - 2, 512, (x, W, Hh) => {
      const cx = sx => (SX(sx) + (BW - 2) / 2) / (BW - 2) * W, cy = sy => (BY1 - 1 - SY(sy)) / (BY1 - BY0 - 2) * Hh;
      x.fillStyle = 'rgba(244,214,190,.22)'; x.strokeStyle = 'rgba(244,214,190,.75)'; x.lineWidth = 4;
      x.beginPath(); x.ellipse(cx(282), cy(98), cx(318) - cx(282), cy(140) - cy(98), 0, 0, Math.PI * 2); x.fill(); x.stroke();
      x.beginPath(); x.moveTo(cx(266), cy(134)); x.lineTo(cx(266), cy(150)); x.quadraticCurveTo(cx(196), cy(152), cx(186), cy(186)); x.lineTo(cx(184), cy(410));
      x.lineTo(cx(406), cy(410)); x.lineTo(cx(404), cy(186)); x.quadraticCurveTo(cx(394), cy(152), cx(300), cy(150)); x.lineTo(cx(300), cy(134)); x.fill(); x.stroke();
    });
    at(sil, 0, (BY0 + BY1) / 2, -21.1, g);
    // --- органы ---
    const organ = key => { const o = new T.Group(); at(o, 0, 0, 0, g); clickable(o, key); return o; };
    const lv = organ('o-liver'); h.blob(lv, ...P(244, 194, 0), 12, 6.4, 4.4, 0x8a3b3b).rotation.z = 0.18; h.blob(lv, ...P(262, 228, 2), 1.9, 1.3, 1.3, 0x6fa055);
    const mo = organ('o-mouth'); h.blob(mo, ...P(280, 118, 2), 4.4, 1.8, 2.6, 0xc0606c);
    at(box(5.4, 0.5, 1, 0xf4f0e6, { edges: false }), ...P(280, 115, 4.2), mo); at(box(5.4, 0.5, 1, 0xf4f0e6, { edges: false }), ...P(280, 121, 4.2), mo);
    const es = organ('o-eso'); h.tube(es, [V(280, 124, 0), V(281, 142, -0.5), V(296, 158, 0), V(311, 170, 0), V(320, 182, 0)], 1.1, 0xe4a39a);
    const panc = organ('o-panc'); h.blob(panc, ...P(342, 250, -1.4), 8.2, 1.6, 2.2, 0xe2b866).rotation.z = 0.15;
    const sto = organ('o-stomach'); h.blob(sto, ...P(342, 205, 0.5), 7, 5.2, 4, 0xd98a80).rotation.z = -0.55;
    const du = organ('o-duod'); h.tube(du, [V(312, 230, 0), V(292, 234, 0.5), V(281, 247, 1), V(284, 261, 1), V(300, 267, 0.5), V(318, 266, 0), V(328, 260, 0)], 1.3, 0xf0b0a8);
    // протоки печени и поджелудочной
    h.tube(g, [V(262, 230, 2), V(272, 240, 2), V(283, 248, 2)], 0.3, 0xc9d84f, { hull: false });
    const lg = organ('o-large'); h.tube(lg, [V(214, 360, 0), V(214, 292, 0), V(218, 279, 0), V(230, 276, 0), V(370, 276, 0), V(382, 279, 0), V(386, 290, 0), V(386, 356, 0), V(378, 372, 0), V(340, 380, 0), V(314, 384, 0), V(306, 394, 0)], 2.3, 0xc89272);
    // гаустры — перетяжки толстой кишки
    [[214, 338], [214, 314], [214, 296], [250, 276], [290, 276], [330, 276], [386, 306], [386, 334]].forEach(([x, y]) => { const r = mesh(new T.TorusGeometry(2.3, 0.28, 6, 20), 0x9a6a50, { edges: false, shadow: false }); if (x === 214 || x === 386) r.rotation.x = Math.PI / 2; else r.rotation.y = Math.PI / 2; at(r, ...P(x, y, 0), lg); });
    const si = organ('o-small');
    h.tube(si, [V(326, 262, 2), V(336, 280, 2.5), V(352, 290, 3), V(352, 300, 3), V(300, 301, 3.5), V(242, 300, 3), V(232, 308, 3.5), V(242, 316, 3.5), V(300, 317, 4), V(352, 316, 3.5), V(361, 325, 3.5), V(352, 334, 3.5), V(300, 335, 4), V(242, 334, 3.5), V(232, 342, 3.5), V(242, 350, 3.5), V(222, 352, 2)], 1.25, 0xe8a7a0);
    // --- соки на органах: цветные булавки ---
    const SPOTXY = { mouth: [302, 116], stomach: [370, 198], duod: [324, 252], small: [366, 312], large: [392, 344] };
    const spotJ = {};
    d.juice.forEach((j, c) => { if (j.at >= 0) (spotJ[d.spots[j.at]] = spotJ[d.spots[j.at]] || []).push(c); });
    Object.keys(spotJ).forEach(sid => {
      const [ax, ay] = SPOTXY[sid];
      spotJ[sid].forEach((c, k) => {
        const j = d.juice[c], base = V(ax, ay + k * 10, 1), head = base.clone().add(v3(3.2, 0, 4));
        h.rodAB(g, base, head, 0.22, C.STEEL);
        at(h.ball(1.05, j.c), head.x, head.y, head.z, g);
        if (d.all) h.ring(g, head.x, head.y - 1.3, head.z, 1.5, j.ok ? 0x86e0a8 : 0xff8a73, 0.32);
      });
      const names = spotJ[sid].map(c => d.juice[c].sh + (d.all ? (d.juice[c].ok ? ' ✓' : ' ✗') : '')).join(', ');
      const [ax2, ay2] = SPOTXY[sid];
      tag(V(ax2 + 14, ay2 - 2, 5), d.spotName[d.spots.indexOf(sid)], names, d.all && spotJ[sid].some(c => !d.juice[c].ok));
    });
    // --- флаконы соков ---
    d.juice.forEach((j, c) => {
      const fx = -22 + c * 12, fz = 31, sel = d.sel === c, placed = j.at >= 0;
      const fg = new T.Group(); at(fg, fx, sel ? 1.2 : 0, fz, g); clickable(fg, 'j' + c);
      h.lathe(fg, 0, 0, 0, [[0, 0], [3, 0], [3.2, 0.4], [3.2, 6.4], [2.2, 7.8], [1.2, 8.4], [1.2, 9.4]], 0xd8eef8, { glass: true, op: 0.3 });
      const lq = h.liquid(fg, 0, 0.4, 0, 2.9, j.c, 0.78); lq.set(placed ? 1.4 : 5.6);
      at(cyl(1.5, 1.6, 0x2c3240, { seg: 18 }), 0, 10.2, 0, fg);
      const bulb = h.ball(1.2, 0x2c3240); bulb.scale.y = 1.4; at(bulb, 0, 12.2, 0, fg);
      const lb = h.card(5.6, 3, [j.sh], { bg: placed ? '#e6e9ef' : '#fffaf0' }); at(lb, 0, 3.6, 3.25, fg);
      fg.add(at(h.hitBox(7, 14, 7), 0, 7, 0, new T.Group()));
      if (sel) { h.ring(g, fx, 0.3, fz, 4.4); at(h.glow(j.c, 14, 0.5), fx, 7, fz, g); }
    });
    // --- тарелка с обедом и путь комка ---
    const px = -44, pz = 26;
    const pl = new T.Group(); at(pl, px, 0, pz, g); clickable(pl, 'step');
    h.lathe(pl, 0, 0, 0, [[0, 0], [5, 0], [6.5, 0.6], [9, 1.6], [9.2, 1.9]], 0xf4f4f0);
    pl.add(at(h.hitBox(18, 6, 18), 0, 3, 0, new T.Group()));
    const BOL = { mouth: [280, 118, 4], eso: [300, 154, 2], stomach: [344, 206, 5], duod: [292, 250, 3], small: [300, 318, 6], large: [384, 330, 4], out: [306, 398, 3] };
    const posOf = loc => loc === 'plate' ? v3(px, 3, pz) : V(...BOL[loc]);
    const M = mem.tract && d.pos >= mem.tract.pos && d.pos - mem.tract.pos <= 1 ? mem.tract : { pos: d.pos, loc: d.loc, t: -9 };
    const from = M.pos !== d.pos ? posOf(M.loc) : posOf(d.loc), to = posOf(d.loc);
    const t0 = M.pos !== d.pos ? now() : M.t;
    mem.tract = { pos: d.pos, loc: d.loc, t: t0 };
    const rest = 1 - (d.abs[0] + d.abs[1] + d.abs[2]) / 300;
    const showBolus = d.loc !== 'out' || rest > 0.01;
    if (d.loc === 'plate') {
      at(box(4, 2.4, 3, 0xd9b680), px - 3, 2.6, pz - 1, g); h.blob(g, px + 2.5, 2.4, pz + 1, 2.6, 1.2, 2, 0xb0524a); h.blob(g, px - 0.5, 2.2, pz + 3.2, 2.2, 0.8, 1.4, 0xf3e08a);
    }
    if (showBolus && d.loc !== 'plate') {
      const bol = h.ball(1, d.loc === 'out' ? 0x8a6a3a : 0xd9b680); bol.scale.setScalar(1.2 + 1.8 * rest); at(bol, to.x, to.y, to.z, g);
      const gl = h.glow(0xffb547, 7, 0.55); at(gl, to.x, to.y, to.z, g);
      kit.onFrame(() => {
        const k = kit.reduce ? 1 : clamp((now() - t0) / 0.7, 0, 1), e = ease(k);
        bol.position.lerpVectors(from, to, e); bol.position.y += Math.sin(Math.PI * k) * 3; gl.position.copy(bol.position);
      });
      tag(to.clone().add(v3(0, 3.5, 0)), 'Обед', d.locName);
    }
    tag(v3(px, 8, pz), 'Тарелка', d.pos < 0 ? 'нажмите — съесть' : d.pos >= 6 ? 'нажмите — заново' : 'нажмите — дальше');
    // --- пробирки «всосалось» ---
    const NAMES = ['углев.', 'белки', 'жиры'], COL = [0x72d4e8, 0xff8a73, 0xffb547];
    d.abs.forEach((a, i) => {
      const tx = 44 + i * 7, tz = 20;
      const cg = h.cylinderGlass(g, tx, tz, 2, 14, 4);
      const lq = h.liquid(g, tx, 1, tz, 1.8, COL[i], 0.75); lq.set(Math.max(0, 13 * a / 100));
      const lb = h.card(5.6, 2.4, [NAMES[i]]); h.easel(g, tx, tz + 5.2, 5.6, 2.4, lb);
      void cg;
    });
    at(box(24, 1, 6, 0x3a3f4c), 51, 0.5, 20, g);
    tag(v3(51, 19, 20), 'Всосалось в кровь', `у ${d.abs[0]} % · б ${d.abs[1]} % · ж ${d.abs[2]} %`, d.abs.every(a => a >= 99));
    if (d.sel >= 0) tag(v3(-22 + d.sel * 12, 16, 31), d.juice[d.sel].sh, 'нажмите отдел на модели', true);
  };

  // =====================================================================================
  // ===== «Питание и витамины»: прилавок с продуктами, ценники, табло меню на день =====
  function foodModel(kit, h, g, i) {
    const { T, at, box, cyl } = kit, v3 = h.v3;
    const bowl = (col, fill, top) => { h.lathe(g, 0, 0, 0, [[0, 0], [2, 0], [3.6, 1.2], [4.4, 3.2], [4.5, 3.5]], col); if (fill) h.blob(g, 0, 3, 0, 3.9, top || 0.9, 3.9, fill); };
    switch (i) {
      case 0: [-1.4, 1.4].forEach((x, k) => { const s = new T.Group(); at(s, x, 3, 0, g); s.rotation.z = k ? -0.25 : 0.25; at(box(1, 5.4, 5.4, 0xe9cf9a), 0, 0, 0, s); at(box(1.1, 5.6, 0.5, 0x9a5a2a, { edges: false }), 0, 0, 2.7, s); at(box(1.1, 0.5, 5.6, 0x9a5a2a, { edges: false }), 0, 2.7, 0, s); }); break; // хлеб
      case 1: bowl(0xf2f2ee, 0x8a5a32, 1.1); for (let k = 0; k < 10; k++) at(h.ball(0.35, 0x6a4020, { hull: false, shadow: false }), Math.cos(k * 2.4) * rnd(k) * 3, 3.9, Math.sin(k * 2.4) * rnd(k) * 3, g); break; // гречка
      case 2: bowl(0xf2f2ee, 0xf3e08a, 1.8); at(h.ball(0.7, 0xffd84a, { hull: false }), 0.6, 4.8, 0.4, g); break; // пюре
      case 3: h.blob(g, 0, 1.6, 0, 4.4, 1.6, 2.8, 0xf2c8a0).rotation.y = 0.4; break; // курица
      case 4: h.blob(g, 0, 1.6, 0, 4, 1.6, 3, 0x9a3a2e); at(box(6.6, 0.4, 0.6, 0xf4e6d0, { edges: false }), 0, 3.05, 0.4, g); break; // говядина
      case 5: [-1.6, 1.6].forEach(x => h.blob(g, x, 2.4, 0, 1.7, 2.3, 1.7, 0xf6ead2)); break; // яйца
      case 6: h.lathe(g, 0, 0, 0, [[0, 0], [2.2, 0], [2.6, 7]], 0xd8eef8, { glass: true, op: 0.3 }); { const l = h.liquid(g, 0, 0.2, 0, 2.15, 0xffffff, 0.95, 2.45); l.set(5.6); } break; // молоко
      case 7: bowl(0x7fa8d8, null); for (let k = 0; k < 9; k++) at(h.ball(1 + rnd(k + 3) * 0.4, 0xfbfaf4, { shadow: false }), Math.cos(k * 2.1) * rnd(k + 5) * 2.4, 3.4 + rnd(k + 7) * 0.6, Math.sin(k * 2.1) * rnd(k + 5) * 2.4, g); break; // творог
      case 8: { const c = cyl(1.3, 8, 0xf07c1e, { r2: 0.15 }); c.rotation.z = Math.PI / 2; at(c, 0.6, 1.4, 0, g); [-0.5, 0, 0.5].forEach(a => { const l = cyl(0.2, 3, 0x4f9a3a, { edges: false }); l.rotation.z = Math.PI / 2 + a; at(l, -4.6, 1.4 + a * 1.4, 0, g); }); } break; // морковь
      case 9: h.blob(g, 0, 3.4, 0, 3.6, 3.3, 3.6, 0xa8d878); for (let k = 0; k < 5; k++) { const l = h.blob(g, Math.cos(k * 1.26) * 2.4, 2.6, Math.sin(k * 1.26) * 2.4, 2.2, 2.6, 0.6, 0x7fc05a); l.rotation.y = -k * 1.26 + Math.PI / 2; } break; // капуста
      case 10: h.blob(g, 0, 3.2, 0, 2.6, 3.2, 2.6, 0xe0302a); at(cyl(0.35, 1.8, 0x3f8a2a, { edges: false }), 0, 6.8, 0, g); break; // перец
      case 11: at(h.ball(3.1, 0xf59a1e, { seg: 24 }), 0, 3.1, 0, g); at(h.ball(0.4, 0x3f8a2a, { hull: false }), 0, 6.1, 0, g); break; // апельсин
      case 12: h.blob(g, 0, 3, 0, 3.1, 2.8, 3.1, 0xd84a3a); at(cyl(0.2, 1.8, 0x5a3a20, { edges: false }), 0.2, 6.2, 0, g); { const l = h.blob(g, 1, 6.2, 0, 1, 0.3, 0.5, 0x4f9a3a); l.rotation.z = 0.4; } break; // яблоко
      case 13: [[-2, 0], [2, 0.4], [0, -2.6]].forEach(([x, z]) => h.blob(g, x, 1.6, z, 2.1, 1.6, 1.8, 0xd8a050)); break; // баурсаки
      case 14: h.lathe(g, 0, 0, 0, [[0, 0], [1.9, 0], [2.1, 0.5], [2.1, 6.5], [1.4, 8.2], [0.8, 9.4], [0.8, 10]], 0x5a2a18); at(cyl(1, 1.2, 0xe0302a, { seg: 16 }), 0, 10.6, 0, g); at(cyl(2.16, 2.4, 0xe0302a, { edges: false }), 0, 4, 0, g); break; // газировка
      default: { const p = box(6.4, 8, 2.2, 0xf2c230); p.rotation.x = -0.25; at(p, 0, 4.2, -0.6, g); const st = box(6.5, 2.6, 2.3, 0xe0302a, { edges: false }); st.rotation.x = -0.25; at(st, 0, 4.6, -0.5, g); } // чипсы
    }
  }
  SC['dig-food'] = (kit, d) => {
    const { T, at, box, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const M = mem.food || { cnt: d.cnt.slice() }, pop = {};
    d.cnt.forEach((n, i) => { if (n > (M.cnt[i] || 0)) pop[i] = now(); });
    mem.food = { cnt: d.cnt.slice() };
    // прилавок-полки: 4 ряда по 4 продукта
    const CX = c => -42 + c * 26, CZ = r => -12 + r * 15;
    d.foods.forEach((f, i) => {
      const c = i % 4, r = Math.floor(i / 4), x = CX(c), z = CZ(r), n = d.cnt[i];
      at(box(20, 0.6, 12, n ? 0xffe2a8 : 0xe9ecf1), x, 0.3, z, g);
      const it = new T.Group(); at(it, x - 3, 0.6, z - 1, g); clickable(it, 'food-' + i);
      foodModel(kit, h, it, i);
      it.add(at(h.hitBox(11, 10, 10), 0, 5, 0, new T.Group()));
      if (pop[i] && !kit.reduce) { const t0 = pop[i]; kit.onFrame(() => { const k = clamp((now() - t0) / 0.45, 0, 1); it.scale.setScalar(1 + 0.25 * Math.sin(Math.PI * k)); }); }
      // ценник: название, ккал, витамины, ×n
      const lines = [{ t: f.n, s: 0.7 }, { t: `${f.kcal} ккал${f.vc ? ' · C' : ''}${f.va ? ' · A' : ''}`, s: 0.6, w: 600 }];
      const pc = h.card(8, 4.2, lines, { bg: n ? '#fff1d0' : '#fffaf0' }); const ez = h.easel(g, x - 3, z + 4.6, 8, 4.2, pc); clickable(ez, 'food-' + i);
      if (n) {
        const badge = h.card(3.6, 2.6, [{ t: '×' + n, s: 0.8, c: '#a05a00' }], { bg: '#ffd166', pw: 128 }); badge.rotation.x = -0.5; at(badge, x + 5.5, 7.4, z, g);
        h.button(g, x + 6.5, 0.6, z + 3.2, '−', 0x56627d, 'minus-' + i, 3.6);
      }
    });
    // табло меню на день
    const bx = 0, bz = -38;
    at(box(84, 26, 2, 0x2c3240), bx, 17, bz, g);
    at(box(3, 4, 3, C.DARK), bx - 36, 2, bz, g); at(box(3, 4, 3, C.DARK), bx + 36, 2, bz, g);
    const Tt = d.T, okc = ok => ok ? '#86e0a8' : '#ff8a73';
    const rows = [
      ['Энергия', `${Tt.kcal} ккал`, '2400–3000', d.ok.e, Tt.kcal ? okc(d.ok.e) : '#e8ecf4'],
      ['Белки', `${Tt.p} г`, 'от 75 г', d.ok.p, okc(d.ok.p)],
      ['Жиры', `${Tt.fatPct} % энергии`, 'до 35 %', d.ok.fat, Tt.kcal ? okc(d.ok.fat) : '#e8ecf4'],
      ['Витамин C', `${Tt.vc} мг`, 'от 70 мг', d.ok.vc, okc(d.ok.vc)],
      ['Витамин A', `${Tt.va} мкг`, 'от 700 мкг', d.ok.va, okc(d.ok.va)],
    ];
    const board = h.canvasPlane(80, 22, 900, (x, W, Hh) => {
      x.fillStyle = '#0e1520'; x.fillRect(0, 0, W, Hh);
      h.fitText(x, 'Меню на день', 24, 30, W * 0.5, 34, 800, FONT, '#e8ecf4', 'left');
      h.fitText(x, `выполнено ${d.right} из 5`, W - 24, 30, W * 0.4, 30, 700, MONO, d.right === 5 ? '#86e0a8' : '#ffb547', 'right');
      // полоса энергии по веществам
      const ex = v => 24 + clamp(v / 4000, 0, 1) * (W - 48), by = 62;
      x.fillStyle = '#1a2438'; x.fillRect(24, by, W - 48, 22);
      x.fillStyle = 'rgba(134,224,168,.25)'; x.fillRect(ex(2400), by, ex(3000) - ex(2400), 22);
      let x0 = 24; [[Tt.p * 4, '#ff8a73'], [Tt.fat * 9, '#ffb547'], [Tt.carb * 4, '#72d4e8']].forEach(([e, c]) => { const w = clamp(e / 4000, 0, 1) * (W - 48); x.fillStyle = c; x.fillRect(x0, by + 4, Math.min(w, W - 24 - x0), 14); x0 += w; });
      rows.forEach((r, k) => {
        const y = 118 + k * 30;
        h.fitText(x, r[0], 24, y, 200, 24, 600, FONT, '#c9d1e0', 'left');
        h.fitText(x, r[1], 330, y, 260, 26, 700, MONO, r[4], 'left');
        h.fitText(x, 'норма ' + r[2], W - 70, y, 280, 22, 500, FONT, '#8b96ad', 'right');
        h.fitText(x, r[3] ? '✓' : '✗', W - 30, y, 30, 26, 800, FONT, r[3] ? '#86e0a8' : '#ff8a73');
      });
    });
    at(board, bx, 17, bz + 1.05, g);
    // мусорная корзина — очистить меню
    const bin = new T.Group(); at(bin, 60, 0, 30, g); clickable(bin, 'reset');
    h.lathe(bin, 0, 0, 0, [[0, 0], [3.4, 0], [4.4, 9], [4.6, 9.4]], 0x6f8098);
    at(h.hitBox(10, 10, 10), 0, 5, 0, bin);
    tag(v3(60, 12, 30), 'Очистить', 'всё меню');
    tag(v3(bx, 32, bz), 'Энергия за день', `${Tt.kcal} ккал`, d.right === 5);
  };

  // =====================================================================================
  // ===== «Выделение: почка-фильтр»: модель нефрона на стенде, колбы веществ, мерный цилиндр, вода и лампа-«жара» =====
  const NX = sx => (sx - 392) * 0.3, NY = sy => 66 - (sy - 110) * 0.17, NZ = -19;
  const TUB = [[340, 140], [366, 126], [394, 140], [380, 162], [408, 178], [420, 196], [420, 330], [436, 346], [452, 330], [452, 212], [470, 192], [492, 202], [482, 222], [500, 230], [500, 388]];
  const BLOOD = [[284, 122], [306, 134], [318, 140], [330, 152], [352, 178], [406, 198], [406, 346], [436, 366], [420, 386], [286, 386]];
  SC['dig-excr'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const N = (p, dz = 0) => v3(NX(p[0]), NY(p[1]), NZ + dz);
    // стенд
    at(box(80, 3, 12, C.WOOD2), 0, 1.5, -22, g);
    at(box(76, NY(96) - 8, 1.6, 0x2c3a52), 0, 8 + (NY(96) - 8) / 2, -24, g);
    const tub = TUB.map(p => N(p)), blood = BLOOD.map(p => N(p, -1.6)), back = BLOOD.slice(5).map(p => N(p, -1.6));
    // кровеносный капилляр и каналец
    h.tube(g, blood, 1.1, 0xc4505c, { poly: true, radial: 10 });
    const tubM = h.ownMat(0xe9d84f, { transparent: true, opacity: 0.42, depthWrite: false });
    h.tube(g, tub.slice(0, -2), 1.6, 0xe9d84f, { poly: true, mat: tubM, hull: false, shadow: false });
    h.tube(g, tub.slice(-3), 2.3, 0xe9d84f, { poly: true, mat: tubM, hull: false, shadow: false });
    // капсула и клубочек
    const cc = N([318, 140]);
    const cap = new T.Mesh(kit.keep(new T.SphereGeometry(4.6, 32, 20)), h.glassMat(0xf0e080, 0.3)); cap.add(new T.Mesh(cap.geometry, kit.hullMat)); at(cap, cc.x, cc.y, cc.z, g);
    const knot = []; for (let k = 0; k <= 60; k++) { const a = k / 60 * Math.PI * 2; knot.push(v3(cc.x + Math.sin(3 * a) * 2.4 + Math.cos(a) * 0.8, cc.y + Math.cos(2 * a) * 2.2, cc.z + Math.sin(5 * a) * 1.8)); }
    h.tube(g, knot, 0.45, 0xe04050, { hull: false });
    // частицы веществ
    const pgeo = kit.keep(new T.SphereGeometry(0.75, 12, 8));
    const parts = [];
    d.subs.forEach((s, i) => {
      for (let j = 0; j < 3; j++) {
        const m = new T.Mesh(pgeo, kit.toon(s.c)); m.add(new T.Mesh(pgeo, kit.hullMat)); g.add(m);
        parts.push({ m, i, j, s });
      }
    });
    const place = (pp, t) => {
      const s = pp.s, q = ((t / 7) + pp.i / 6 + pp.j / 3) % 1;
      let p;
      if (s.fi === true) {
        if (s.re === 'blood') p = q < 0.45 ? h.polyAt(tub, 0.75 * q) : h.polyAt(back, (q - 0.45) / 0.55);
        else if (s.re === 'urine') p = h.polyAt(tub, q);
        else p = h.polyAt(tub, Math.min(q, 0.3));
      } else if (s.fi === false) p = h.polyAt(blood, q);
      else p = h.polyAt(blood, Math.min(q, 0.12));
      pp.m.position.set(p.x + (pp.j - 1) * 0.5, p.y + ((pp.i % 3) - 1) * 0.5, p.z + 0.3 * (pp.j - 1));
    };
    parts.forEach(pp => place(pp, 1.3));
    kit.onFrame((dt, t) => { if (!kit.reduce) parts.forEach(pp => place(pp, t)); });
    // --- мерный цилиндр мочи ---
    const ux = 44, uz = -6, UH = 26;
    h.cylinderGlass(g, ux, uz, 3.8, UH, 6);
    const ul = h.liquid(g, ux, 1, uz, 3.6, 0xe9d84f, 0.7);
    const uk = d.flood ? 1.06 : clamp(d.urine / 3, 0, 1);
    ul.set(UH * Math.min(1, uk) * 0.92);
    const ucard = h.card(7, 3, ['0–3 л в сутки', { t: '1,2–1,8 — норма', s: 0.5, w: 500 }]); h.easel(g, ux, uz + 7, 7, 3, ucard);
    kit.cable(N(TUB[TUB.length - 1]).add(v3(0, 0, 0)), v3(ux, UH + 3, uz), 0xe9d84f, 0, { r: 0.7, lift: 1, arch: 1 });
    if (d.flood) { const fl = h.blob(g, ux, 0.6, uz + 4, 6, 0.2, 4, 0xe9d84f, { hull: false, matOpt: { transparent: true, opacity: 0.6 } }); void fl; }
    // --- колбы с веществами ---
    d.subs.forEach((s, i) => {
      const fx = -40 + i * 16, fz = 30;
      const fg = new T.Group(); at(fg, fx, 0, fz, g); clickable(fg, 'sub-' + i);
      h.lathe(fg, 0, 0, 0, [[0, 0], [4.4, 0], [4.6, 0.6], [1.6, 7.4], [1.5, 9.6], [1.8, 10]], 0xd8eef8, { glass: true, op: 0.28 });
      const lq = h.lathe(fg, 0, 0.3, 0, [[0, 0], [4.1, 0], [4.25, 0.4], [2.7, 4.2], [0, 4.2]], s.c, { matOpt: { transparent: true, opacity: 0.8 } }); void lq;
      fg.add(at(h.hitBox(10, 12, 10), 0, 6, 0, new T.Group()));
      const a1 = s.fi === null ? '?' : s.fi ? 'да' : 'нет', a2 = s.fi !== true ? '—' : s.re === null ? '?' : s.re === 'blood' ? 'в кровь' : 'в мочу';
      const col = s.ok === null ? '#1b1610' : s.ok ? '#1f8a4a' : '#c0392b';
      const lb = h.card(12, 6.4, [{ t: s.name + (s.ok === null ? '' : s.ok ? ' ✓' : ' ✗'), s: 0.7, c: col }, { t: 'в капсулу: ' + a1, s: 0.56, w: 600 }, { t: 'из канальца: ' + a2, s: 0.56, w: 600 }], { bg: s.ok === false ? '#ffe8e2' : '#fffaf0' });
      const ez = h.easel(g, fx, fz + 8, 12, 6.4, lb); clickable(ez, 'sub-' + i);
    });
    // --- вода: бутылка и кнопки ---
    const wx = -54, wz = 2;
    const wb = new T.Group(); at(wb, wx, 0, wz, g); clickable(wb, 'more');
    h.lathe(wb, 0, 0, 0, [[0, 0], [3.6, 0], [3.8, 0.6], [3.8, 13], [2.4, 15.4], [1.4, 16.6], [1.4, 18]], 0xcfe8f6, { glass: true, op: 0.3 });
    const wl = h.liquid(wb, 0, 0.5, 0, 3.5, 0x5fb4e0, 0.6); wl.set(12.5 * clamp(d.drink / 4, 0, 1));
    at(cyl(1.7, 1.6, 0x3b6fd8, { seg: 16 }), 0, 18.8, 0, wb);
    wb.add(at(h.hitBox(8, 20, 8), 0, 10, 0, new T.Group()));
    at(box(14, 1.2, 6, 0x3a3f4c), wx, 0.6, wz + 9, g);
    h.button(g, wx - 3.4, 1.2, wz + 9, '−', 0x56627d, 'less', 4.6);
    h.button(g, wx + 3.4, 1.2, wz + 9, '+', 0x3b6fd8, 'more', 4.6);
    // --- лампа «жара» ---
    const lx = -54, lz = -30;
    const lamp = new T.Group(); at(lamp, lx, 0, lz, g); clickable(lamp, 'hot');
    at(cyl(4.4, 1.2, C.DARK), 0, 0.6, 0, lamp);
    h.rodAB(lamp, v3(0, 1, 0), v3(0, 22, 0), 0.5, C.STEEL);
    h.rodAB(lamp, v3(0, 22, 0), v3(8, 26, 4), 0.5, C.STEEL);
    const shade = h.lathe(lamp, 8, 21, 4, [[1.2, 5], [3, 3.6], [5.4, 0.4], [5.6, 0]], d.hot ? 0xff8a3c : 0x8b96ad); void shade;
    const bulbM = h.ball(2, d.hot ? 0xfff1b8 : 0xdfe8ef, { matOpt: d.hot ? { emissive: 0xffa040, emissiveIntensity: 1 } : undefined }); at(bulbM, 8, 21.4, 4, lamp);
    lamp.add(at(h.hitBox(14, 28, 12), 4, 13, 2, new T.Group()));
    if (d.hot) {
      const gl = h.glow(0xffa040, 30, 0.75); at(gl, lx + 8, 20, lz + 4, g);
      at(new T.PointLight(0xffb060, 60, 90, 1.2), lx + 8, 19, lz + 4, g);
      kit.onFrame((dt, t) => { gl.material.opacity = 0.6 + 0.15 * Math.sin(t * 3); });
    }
    tag(N([318, 120], 2), 'Капсула', 'клубочек — фильтр');
    tag(N([452, 250], 2), 'Каналец', 'возврат в кровь');
    tag(N([286, 386], 0), 'Кровь', 'в вену →');
    tag(v3(ux, UH + 6, uz), 'Моча за сутки', d.flood ? '180 л — вода не возвращается!' : d.primary ? fmt(d.urine, 1) + ' л' : 'не образуется', d.flood || (d.hot && d.primary && (d.urine < 1.2 || d.urine > 1.8)));
    tag(v3(wx, 23, wz), 'Питьё', fmt(d.drink, 2) + ' л в день');
    tag(v3(lx + 4, 31, lz), d.hot ? 'Жара +40 °C' : 'Лампа-«жара»', d.hot ? 'пот — +1 л потерь' : 'выключена', d.hot);
  };
})();
