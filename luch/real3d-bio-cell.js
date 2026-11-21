// «Как в жизни» для биологии «Строение клетки» (labs/bio-cellst): стол кабинета биологии с микроскопом.
// Осмос — флаконы 0 / 0,9 / 5 %, солонка и промывалка, стёкла с кровью и луком, увеличенная модель клетки в капле
// (эритроцит набухает, лопается, сморщивается; у клетки лука мембрана отходит от стенки, вода бежит капельками);
// амёба в чашке Петри, игла, микропипетка с ядром и календарь суток; музейная модель растительной клетки в разрезе
// (стенка, мембрана, цитоплазма, ядро, вакуоль, хлоропласты, митохондрии, рибосомы) с лампой и карточками работ;
// модели растительной и животной клеток и три лотка для признаков.
// Сцены строятся из window.LUCH_REAL() опыта; объём клетки и ток воды при осмосе — из LUCH_REAL.live() в onFrame.
(() => {
  const SC = window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {};
  const live = () => { try { return window.LUCH_REAL.live ? window.LUCH_REAL.live() : null; } catch (e) { return null; } };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rnd = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const hexs = c => '#' + c.toString(16).padStart(6, '0');
  const TY = 0.8; // верх светлого коврика на столе
  const COL = { wall: 0xc9b36a, mem: 0x86e0a8, cyt: 0xcfe3c8, vac: 0x8f7fd8, nuc: 0xffb547, nucl: 0xc97a12, chl: 0x3fa34d, gran: 0x1d5a27, mit: 0xff8a73, crist: 0x8a2f1f, rib: 0xf4f6fa };

  // ---------- общие детали ----------
  function H(kit) {
    const { T, at, box, cyl, mesh, keep, grad, clickable, toon } = kit;
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    const v2 = (x, y) => new T.Vector2(x, y);
    const ownMat = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, ...o }));
    const glassMat = (color = 0xd8eef8, opacity = 0.24) => ownMat(color, { transparent: true, opacity, side: T.DoubleSide, depthWrite: false });
    const clear = (color, opacity) => ownMat(color, { transparent: true, opacity, depthWrite: false });
    const hitMat = keep(new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    const hitBox = (w, hh, d) => new T.Mesh(keep(new T.BoxGeometry(w, hh, d)), hitMat);
    const hitBall = r => new T.Mesh(keep(new T.SphereGeometry(r, 12, 8)), hitMat);
    const sgeo = {};
    const sphereGeo = r => sgeo[r] || (sgeo[r] = keep(new T.SphereGeometry(r, 20, 14)));
    const unit = keep(new T.SphereGeometry(1, 28, 16));
    // шарик с контуром по силуэту (у мелких контур не нужен)
    function ball(parent, x, y, z, r, col, o = {}) {
      const m = new T.Mesh(sphereGeo(r), o.mat || toon(col, o.matOpt));
      m.castShadow = o.shadow !== false; m.receiveShadow = true;
      if (o.hull ?? r >= 1) m.add(new T.Mesh(m.geometry, kit.hullMat));
      return at(m, x, y, z, parent);
    }
    // эллипсоид: геометрия сжата заранее, чтобы контур был ровной толщины
    function ellipsoid(parent, x, y, z, a, b, c, col, o = {}) {
      const geo = keep(new T.SphereGeometry(1, 24, 14).scale(a, b, c));
      const m = new T.Mesh(geo, o.mat || toon(col, o.matOpt));
      m.castShadow = o.shadow !== false; m.receiveShadow = true;
      if (o.hull !== false) m.add(new T.Mesh(geo, kit.hullMat));
      return at(m, x, y, z, parent);
    }
    function rodAB(parent, a, b, r, color, o = {}) {
      const dv = b.clone().sub(a), L = dv.length();
      const m = cyl(r, L, color, { edges: false, ...o });
      m.quaternion.setFromUnitVectors(v3(0, 1, 0), dv.normalize());
      return at(m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, parent);
    }
    // замкнутое кольцо-эллипс (тонопласт, обвод клетки)
    function ellRing(parent, x, y, z, rx, rz, r, col) {
      const pts = []; for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2; pts.push(v3(Math.cos(a) * rx, 0, Math.sin(a) * rz)); }
      const m = new T.Mesh(keep(new T.TubeGeometry(new T.CatmullRomCurve3(pts, true), 96, r, 6, true)), keep(new T.MeshBasicMaterial({ color: col })));
      return at(m, x, y, z, parent);
    }
    function canvasTex(pw, ph) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph;
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      return { c, x: c.getContext('2d'), tex };
    }
    function drawLines(x, pw, ph, lines, col, weight = 600, k = 0.6) {
      const lh = ph / lines.length;
      lines.forEach((ln, i) => {
        let fs = Math.round(lh * k); x.font = `${weight} ${fs}px "IBM Plex Mono", monospace`;
        const tw = x.measureText(ln).width; if (tw > pw * 0.88) { fs = Math.floor(fs * pw * 0.88 / tw); x.font = `${weight} ${fs}px "IBM Plex Mono", monospace`; }
        x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ln, pw / 2, lh * (i + 0.5) + 2);
      });
    }
    function rrect(x, a, b, w, hh, r) { x.beginPath(); if (x.roundRect) x.roundRect(a, b, w, hh, r); else x.rect(a, b, w, hh); }
    // бумажная наклейка с текстом (строки через \n)
    function sticker(w, hh, txt, fg = '#1b1610', bg = '#fffaf0', pw = 256) {
      const ph = Math.max(32, Math.round(pw * hh / w)), k = canvasTex(pw, ph);
      k.x.fillStyle = bg; rrect(k.x, 3, 3, pw - 6, ph - 6, Math.min(ph, pw) * 0.16); k.x.fill();
      k.x.strokeStyle = '#1b1610'; k.x.lineWidth = 5; k.x.stroke();
      drawLines(k.x, pw, ph, String(txt).split('\n'), fg);
      return new T.Mesh(keep(new T.PlaneGeometry(w, hh)), keep(new T.MeshBasicMaterial({ map: k.tex, transparent: true })));
    }
    // наклейка, лежащая на столе
    function floorLabel(parent, x, z, w, hh, txt, fg, bg, y = TY) { const s = sticker(w, hh, txt, fg, bg, Math.round(Math.min(512, 64 * w / hh * 1.6))); s.rotation.x = -Math.PI / 2; return at(s, x, y + 0.08, z, parent); }
    // табло: тёмный экран с зелёным текстом
    function screen(w, hh, txt, fg = '#86e0a8', pw = 320, ph = 160) {
      const k = canvasTex(pw, ph);
      k.x.fillStyle = '#0e1520'; k.x.fillRect(0, 0, pw, ph); drawLines(k.x, pw, ph, String(txt).split('\n'), fg);
      return new T.Mesh(keep(new T.PlaneGeometry(w, hh)), keep(new T.MeshBasicMaterial({ map: k.tex })));
    }
    // клавиша на столе с надписью сверху; off — серая (сейчас не действует)
    function key(parent, x, z, w, d, label, color, keyName, o = {}) {
      const b = new T.Group(); at(b, x, TY, z, parent);
      const col = o.off ? 0x8b96ad : color;
      at(box(w, 1.6, d, col), 0, 0.8, 0, b);
      const top = sticker(w * 0.94, d * 0.84, label, o.fg || '#ffffff', hexs(col), Math.round(Math.min(512, 90 * w / d * 1.4)));
      top.rotation.x = -Math.PI / 2; at(top, 0, 1.62, 0, b);
      if (o.on) at(box(w + 1.2, 0.5, d + 1.2, 0xffd166, { edges: false }), 0, 0.25, 0, b);
      if (keyName) clickable(b, keyName);
      return b;
    }
    // плоское кольцо на столе — «выбрано»
    function ring(parent, x, z, r, col = 0xffd166, y = TY) {
      const m = new T.Mesh(keep(new T.RingGeometry(r * 0.8, r, 40)), keep(new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false })));
      m.rotation.x = -Math.PI / 2; at(m, x, y + 0.12, z, parent);
      if (!kit.reduce) kit.onFrame((dt, t) => { m.material.opacity = 0.55 + 0.4 * Math.sin(t * 4); });
      return m;
    }
    const glow = (color, size, opacity) => {
      const s = new T.Sprite(keep(new T.SpriteMaterial({ map: kit.glowTex(), color, transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending })));
      s.scale.setScalar(size); return s;
    };
    // светлый коврик на столе
    function desk(g) { at(box(128, TY, 88, 0xe4ebe2, { edges: true }), 0, TY / 2, 4, g); }
    // подставка-постамент музейной модели
    function pedestal(g, x, z, w, d, hh = 5) { at(box(w, hh, d, 0x2c3240), x, TY + hh / 2, z, g); at(box(w + 1.2, 0.8, d + 1.2, 0x3a4762), x, TY + 0.4, z, g); return TY + hh; }
    return { v3, v2, ownMat, glassMat, clear, hitBox, hitBall, sphereGeo, unit, ball, ellipsoid, rodAB, ellRing, canvasTex, sticker, floorLabel, screen, key, ring, glow, desk, pedestal };
  }

  // школьный световой микроскоп (s — масштаб); slideCol — цвет препарата на стекле
  function microscope(kit, h, parent, x, z, s, slideCol) {
    const { T, at, box, cyl, C } = kit, v3 = h.v3;
    const g = new T.Group(); at(g, x, TY, z, parent); g.scale.setScalar(s);
    const BODY = 0x2c3a5a;
    at(box(14, 2, 16, BODY), 0, 1, 0, g);
    at(box(4.4, 20, 4.4, BODY), 0, 11, -6, g);
    h.rodAB(g, v3(0, 20, -6), v3(0, 25, -1), 2.2, BODY, { edges: true });
    at(box(12, 1, 11, 0x1f2533), 0, 10, 1.5, g);
    at(box(9.5, 0.3, 3.2, 0xd8eef8, { edges: false, matOpt: { transparent: true, opacity: 0.7 } }), 0, 10.65, 1.5, g);
    if (slideCol != null) at(cyl(1.2, 0.2, slideCol, { edges: false, hull: false }), 0, 10.85, 1.5, g);
    at(box(1, 0.5, 3.6, C.STEEL), -3.6, 10.8, 1.5, g); at(box(1, 0.5, 3.6, C.STEEL), 3.6, 10.8, 1.5, g);
    // тубус, револьвер с объективами, окуляр
    h.rodAB(g, v3(0, 14.5, 1.5), v3(0, 27, -1.5), 1.9, 0xe8ecf4);
    at(cyl(3, 1.4, 0x3a4762), 0, 14, 1.5, g);
    at(cyl(0.8, 2.6, C.STEEL, { r2: 0.6 }), 0, 12.2, 1.5, g);
    h.rodAB(g, v3(0, 27, -1.5), v3(0, 31, -2.5), 1.4, 0x1b1f28);
    // винты фокуса
    [-1, 1].forEach(sx => { const k = cyl(2, 1.4, 0x3a4762, { seg: 18 }); k.rotation.z = Math.PI / 2; at(k, sx * 3, 13, -6, g); });
    // подсветка под столиком
    at(cyl(1.8, 0.6, 0xfff2c0, { edges: false, matOpt: { emissive: 0xffe08a, emissiveIntensity: 0.8 } }), 0, 6.5, 1.5, g);
    at(h.glow(0xffe08a, 6, 0.5), 0, 7, 1.5, g);
    at(h.hitBox(14, 32, 16), 0, 16, 0, g);
    return g;
  }

  // ===================== Урок 1. Мембрана: осмос в капле на стекле =====================
  SC['bio-osmo'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, toon, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.desk(g);
    const blood = d.cell === 'blood';
    // микроскоп: нажать — новая клетка на стекле
    const ms = microscope(kit, h, g, -46, -20, 1.05, blood ? 0xcf3a44 : 0x9b4fb8); clickable(ms, 'fresh');
    // увеличенная модель: капля раствора на подставке, в ней клетка
    const DX = 10, DZ = -8, DR = 27;
    at(cyl(DR + 2, 3, 0x2c3240), DX, TY + 1.5, DZ, g);
    const wcol = new T.Color(0xbfe3f2).lerp(new T.Color(0xf2e2a0), clamp(d.c / 5, 0, 1));
    at(new T.Mesh(keep(new T.CylinderGeometry(DR, DR, 1.6, 56)), h.clear(wcol.getHex(), 0.55)), DX, TY + 3.8, DZ, g);
    const rim = mesh(new T.TorusGeometry(DR, 0.4, 8, 72), 0xeef6fb, { edges: false, hull: false }); rim.rotation.x = Math.PI / 2; at(rim, DX, TY + 4.6, DZ, g);
    const Y0 = TY + 4.6;
    h.floorLabel(g, DX, DZ + DR + 4.5, 26, 3.4, 'капля раствора · ×400', '#1b1610', '#fffaf0');
    // крупинки соли в растворе
    const grains = [], ggeo = keep(new T.BoxGeometry(0.8, 0.8, 0.8)), gmat = toon(0xffb547);
    const ns = Math.round(d.c * 7);
    for (let i = 0; i < ns; i++) {
      const a = rnd(i + 1) * Math.PI * 2, rr = 15 + rnd(i + 50) * (DR - 17), m = new T.Mesh(ggeo, gmat);
      m.rotation.set(rnd(i + 3) * 3, rnd(i + 4) * 3, 0);
      const x0 = DX + Math.cos(a) * rr, z0 = DZ + Math.sin(a) * rr; at(m, x0, Y0 - 0.3, z0, g); grains.push({ m, x0, z0, ph: rnd(i + 9) * 6.28 });
    }
    // клетка
    const cg = new T.Group(); at(cg, DX, Y0, DZ, g);
    let apply = () => {};
    const wr = { rx: 12, rz: 12 };
    if (blood && d.burst) {
      // гемолиз: обрывки мембраны и облачко гемоглобина
      at(h.glow(0xd0343e, 34, 0.45), 0, 1.5, 0, cg);
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2 + rnd(i) * 0.6, rr = 10 + rnd(i + 20) * 6;
        const sh = mesh(new T.TorusGeometry(4, 0.4, 6, 14, 1 + rnd(i + 30)), 0xe8a0a4, { edges: false, hull: false });
        sh.rotation.set(Math.PI / 2, 0, a + rnd(i + 40)); at(sh, Math.cos(a) * rr, 0.8, Math.sin(a) * rr, cg);
      }
      for (let i = 0; i < 26; i++) { const a = rnd(i + 60) * 6.28, rr = 4 + rnd(i + 61) * 17; h.ball(cg, Math.cos(a) * rr, 0.6, Math.sin(a) * rr, 0.45, 0xd0343e, { hull: false }); }
    } else if (blood) {
      // эритроцит: двояковогнутый диск; набухает в шар, сморщивается с шипиками
      const prof = [[0.01, -0.9], [2, -1], [4.5, -1.6], [7, -2.2], [8.6, -1.6], [9, 0], [8.6, 1.6], [7, 2.2], [4.5, 1.6], [2, 1], [0.01, 0.9]].map(p => h.v2(p[0], p[1]));
      const rbc = mesh(new T.LatheGeometry(prof, 48), 0xcf3a44, { hull: true, edges: false }); at(rbc, 0, 2.4, 0, cg);
      const spikes = [];
      for (let i = 0; i < 18; i++) {
        const sp = new T.Group(); sp.rotation.y = -i / 18 * Math.PI * 2; at(sp, 0, 2.4, 0, cg);
        const cn = mesh(new T.ConeGeometry(0.7, 2.2, 8), 0xcf3a44, { edges: false, hull: false }); cn.rotation.z = -Math.PI / 2; at(cn, 9.4, 0, 0, sp); spikes.push(cn);
      }
      apply = V => {
        const sx = Math.sqrt(V), sy = 1 + Math.max(0, V - 1) * 3, amp = clamp((0.92 - V) / 0.2, 0, 1);
        rbc.scale.set(sx, sy, sx); rbc.position.y = 2.4 * sy;
        spikes.forEach(s => { s.visible = amp > 0.05; s.scale.setScalar(Math.max(0.05, amp)); s.position.x = 8.8 * sx + 0.8; s.parent.position.y = 2.4; });
        wr.rx = wr.rz = 9 * sx + 3;
      };
    } else {
      // клетка кожицы лука: стенка из целлюлозы, под ней протопласт с фиолетовой вакуолью и ядром
      const W = 32, D = 18, WH = 5, th = 1.4, wg = new T.Group(); cg.add(wg);
      at(box(W + th, WH, th, COL.wall), 0, WH / 2, -D / 2, wg); at(box(W + th, WH, th, COL.wall), 0, WH / 2, D / 2, wg);
      at(box(th, WH, D, COL.wall), -W / 2, WH / 2, 0, wg); at(box(th, WH, D, COL.wall), W / 2, WH / 2, 0, wg);
      // обрывки стенок соседних клеток
      const nb = h.clear(COL.wall, 0.5);
      [[-W / 2 - 5, -D / 2, 10, th], [W / 2 + 5, D / 2, 10, th], [-6, -D / 2 - 4, th, 8], [8, D / 2 + 4, th, 8]].forEach(([x, z, w, dd]) => at(box(w, WH * 0.7, dd, COL.wall, { mat: nb, edges: false }), x, WH * 0.35, z, cg));
      const proto = new T.Mesh(keep(new T.BoxGeometry(W - th - 0.4, 3.6, D - th - 0.4)), h.clear(COL.mem, 0.38)); at(proto, 0, 2, 0, cg);
      const protoE = new T.Mesh(h.unit, h.clear(COL.mem, 0.45)); at(protoE, 0, 2, 0, cg);
      const vmat = h.clear(0x9b4fb8, 0.4), vac = new T.Mesh(h.unit, vmat); at(vac, 2, 2.2, 0, cg);
      const nuc = h.ball(cg, 0, 2.4, 0, 1.6, COL.nuc);
      apply = (V, press) => {
        const s = Math.sqrt(Math.min(1, V)), plas = V < 0.97;
        proto.visible = !plas; protoE.visible = plas;
        protoE.scale.set((W / 2 - 1) * s * 1.04, 1.9, (D / 2 - 1) * s * 1.04);
        vac.scale.set((W / 2 - 5) * s, 1.5, (D / 2 - 3.2) * s); vac.position.x = 2.5 * s;
        vmat.opacity = clamp(0.35 + (1 - V) * 0.9, 0.35, 0.85);
        nuc.position.x = -(W / 2 - 3.6) * s;
        wg.scale.set(1 + press * 0.05, 1, 1 + press * 0.09);
        wr.rx = W / 2 + 3; wr.rz = D / 2 + 3;
      };
    }
    // капельки воды: внутрь клетки или наружу
    const drops = [], dgeo = keep(new T.SphereGeometry(0.6, 10, 8)), dmat = keep(new T.MeshBasicMaterial({ color: 0x2e8fc4 }));
    for (let i = 0; i < 12; i++) { const m = new T.Mesh(dgeo, dmat); m.visible = false; g.add(m); drops.push({ m, a: i / 12 * Math.PI * 2 + 0.26 }); }
    kit.onFrame((dt, t) => {
      const L = live() || {}, V = L.V ?? 1, flow = L.flow ?? 0, press = L.press ?? 0;
      apply(V, press);
      const k = Math.abs(flow) > 0.015 && !d.burst ? clamp(Math.round(Math.abs(flow) * 40), 4, 12) : 0;
      drops.forEach((p, i) => {
        p.m.visible = i < k; if (!p.m.visible) return;
        const ph = kit.reduce ? 0.5 : (t * 0.7 + i * 0.37) % 1, u = flow > 0 ? 1 - ph : ph, f = 1 + 0.55 * u;
        p.m.position.set(DX + Math.cos(p.a) * wr.rx * f, Y0 + 1.2, DZ + Math.sin(p.a) * wr.rz * f);
      });
      if (!kit.reduce) grains.forEach(q => { q.m.position.x = q.x0 + Math.sin(t * 1.1 + q.ph) * 0.5; q.m.position.z = q.z0 + Math.cos(t * 0.9 + q.ph) * 0.5; });
    });
    // флаконы с растворами
    const BOT = [['s0', 0, '0 %\nвода', 0xcfeaf6], ['s09', 0.9, '0,9 %\nфизраствор', 0xdbeef0], ['s5', 5, '5 %\nрассол', 0xf2e2a0]];
    BOT.forEach(([k, c, lab, col], i) => {
      const x = -8 + i * 15, z = 32, bg = new T.Group(); at(bg, x, TY, z, g); clickable(bg, k);
      const wall = new T.Mesh(keep(new T.CylinderGeometry(3.6, 3.6, 10, 32, 1, true)), h.glassMat(0xd8eef8, 0.3)); at(wall, 0, 5, 0, bg);
      at(cyl(3.3, 7, col, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.7 } }), 0, 3.6, 0, bg);
      at(cyl(1.7, 3, 0xd8eef8, { r2: 1.5, edges: false, hull: false, matOpt: { transparent: true, opacity: 0.5 } }), 0, 11.5, 0, bg);
      at(cyl(1.8, 1.6, 0x3b6fd8), 0, 13.6, 0, bg);
      at(h.sticker(6.4, 4, lab), 0, 4.4, 3.65, bg);
      at(h.hitBox(8, 15, 8), 0, 7.5, 0, bg);
      if (Math.abs(d.c - c) < 0.05) h.ring(g, x, z, 5.6);
    });
    // солонка — солонее, промывалка с водой — преснее
    const sh = new T.Group(); at(sh, 40, TY, 30, g); clickable(sh, 'sUp');
    at(cyl(2.6, 8, 0xf4f4f0), 0, 4, 0, sh); at(cyl(2.7, 2, C.STEEL, { r2: 2.2 }), 0, 9, 0, sh);
    for (let i = 0; i < 5; i++) at(cyl(0.3, 0.2, 0x2c3240, { edges: false, hull: false }), Math.cos(i * 1.26) * 1.1, 10.05, Math.sin(i * 1.26) * 1.1, sh);
    at(h.sticker(4.6, 2.6, 'соль'), 0, 4, 2.65, sh); at(h.hitBox(6, 12, 6), 0, 6, 0, sh);
    const wb = new T.Group(); at(wb, 53, TY, 30, g); clickable(wb, 'sDn');
    at(cyl(3.4, 10, 0xe8f4fa, { matOpt: { transparent: true, opacity: 0.85 } }), 0, 5, 0, wb); at(cyl(1.4, 1.6, 0x2f9e55), 0, 10.8, 0, wb);
    h.rodAB(wb, v3(0, 11.4, 0), v3(0, 14, 1.2), 0.35, 0xe8f4fa); h.rodAB(wb, v3(0, 14, 1.2), v3(0, 13, 4.5), 0.3, 0xe8f4fa);
    at(h.sticker(5.2, 2.6, 'вода'), 0, 5, 3.45, wb); at(h.hitBox(8, 15, 8), 0, 7.5, 1, wb);
    // стёкла с препаратами: кровь и лук
    [['blood', 16, 'Кровь', 0xcf3a44], ['onion', 30, 'Лук', 0x9b4fb8]].forEach(([k, z, lab, col]) => {
      const sg = new T.Group(); at(sg, -44, TY, z, g); clickable(sg, k);
      at(box(16, 0.5, 6, 0xd8eef8, { matOpt: { transparent: true, opacity: 0.75 } }), 0, 0.25, 0, sg);
      if (k === 'blood') at(cyl(2.4, 0.15, col, { edges: false, hull: false }), -2, 0.55, 0, sg);
      else at(box(5, 0.15, 3, col, { edges: false }), -2, 0.55, 0, sg);
      const lb = h.sticker(5.4, 3.6, lab); lb.rotation.x = -Math.PI / 2; at(lb, 4.6, 0.6, 0, sg);
      at(h.hitBox(16, 3, 7), 0, 1.5, 0, sg);
      if (d.cell === k) h.ring(g, -44, z, 9.5);
    });
    // подписи
    tag(v3(DX, blood && !d.burst ? 22 : 16, DZ), d.name, d.burst ? 'лопнула — гемолиз' : d.state, d.burst || /набухла|отошла/.test(d.state));
    tag(v3(25, 20, 32), 'Раствор', 'соли ' + d.cTxt);
    const ok = x => x ? '✓' : '—';
    tag(v3(-46, 40, -20), 'Наблюдения', `лопнула ${ok(d.obs.lysis)} · тургор ${ok(d.obs.turgor)} · плазмолиз ${ok(d.obs.plasm)}`, d.obs.lysis && d.obs.turgor && d.obs.plasm);
  };

  // ===================== Урок 2. Ядро: опыт с амёбой =====================
  // амёба: полупрозрачное тело и ложноножки, гранулы, ядро, сократительная вакуоль
  function amoeba(kit, h, parent, x, z, r, o = {}) {
    const { T, at, keep } = kit;
    const g = new T.Group(); at(g, x, TY + 1.4 + r * 0.3, z, parent);
    const dead = !!o.dead, weak = o.weak || 0, seed = o.seed || 1;
    const col = dead ? 0x8a7f68 : new T.Color(0xb9dcb4).lerp(new T.Color(0xc9c29a), weak).getHex();
    const mat = h.clear(col, dead ? 0.75 : 0.58);
    const body = new T.Mesh(h.unit, mat); body.scale.set(r, r * 0.32, r); g.add(body);
    const rim = h.ellRing(g, 0, 0, 0, r, r, Math.max(0.12, r * 0.025), dead ? 0x5a5040 : 0x5d8f63);
    const pods = [];
    if (!dead) for (let i = 0; i < 5; i++) { const m = new T.Mesh(h.unit, mat); g.add(m); pods.push({ m, a: i * 1.257 + rnd(seed * 7 + i) * 0.9, ph: rnd(seed * 3 + i) * 6.28, sp: 0.5 + rnd(seed + i * 5) * 0.6 }); }
    const ng = dead ? 16 : 9;
    for (let i = 0; i < ng; i++) { const a = rnd(seed * 13 + i) * 6.28, rr = Math.sqrt(rnd(seed * 17 + i)) * r * 0.6; h.ball(g, Math.cos(a) * rr, 0, Math.sin(a) * rr, Math.max(0.2, r * (dead ? 0.045 : 0.03)), dead ? 0x3d372b : 0x6f9a76, { hull: false }); }
    for (let i = 0; i < (o.food || 0); i++) { const a = rnd(seed * 7 + i * 5 + 40) * 6.28, rr = Math.sqrt(rnd(seed * 9 + i)) * r * 0.5; h.ball(g, Math.cos(a) * rr, 0.2, Math.sin(a) * rr, Math.max(0.35, r * 0.09), 0x5fbf6a, { hull: false }); }
    let cv = null;
    if (!dead && weak < 0.5) cv = h.ball(g, -r * 0.35, r * 0.1, r * 0.25, Math.max(0.4, r * 0.1), 0xe8f4ff, { hull: false, mat: h.clear(0xe8f4ff, 0.8) });
    if (o.nuc) { const np = o.np || [r * 0.18, -r * 0.08]; h.ball(g, np[0], r * 0.12, np[1], Math.max(1, r * 0.18), COL.nuc); }
    if (o.click) { at(h.hitBall(r * 1.2), 0, 0, 0, g); kit.clickable(g, o.click); }
    kit.onFrame((dt, t) => {
      const w = 1 - weak * 0.9;
      pods.forEach(p => {
        const ext = kit.reduce ? 0.7 : 0.62 + 0.25 * Math.sin(t * p.sp + p.ph), dd = r * (0.15 + (ext - 0.15) * w);
        p.m.position.set(Math.cos(p.a) * dd, 0, Math.sin(p.a) * dd); p.m.scale.set(r * 0.42, r * 0.26, r * 0.42);
      });
      if (cv && !kit.reduce) cv.scale.setScalar(0.6 + 0.4 * Math.abs(Math.sin(t * 0.9 + seed)));
    });
    return g;
  }
  SC['bio-amoeba'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.desk(g);
    microscope(kit, h, g, -56, -30, 0.85, 0xb9dcb4);
    // чашка Петри с каплей воды и водорослями
    const DX = -8, DZ = -4, DR = 29, R3 = 12;
    at(cyl(DR + 1, 0.8, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.5 } }), DX, TY + 0.4, DZ, g);
    at(new T.Mesh(keep(new T.CylinderGeometry(DR + 1, DR + 1, 4, 64, 1, true)), h.glassMat(0xd8eef8, 0.3)), DX, TY + 2, DZ, g);
    const rim = mesh(new T.TorusGeometry(DR + 1, 0.3, 6, 72), 0xeef6fb, { edges: false, hull: false }); rim.rotation.x = Math.PI / 2; at(rim, DX, TY + 4, DZ, g);
    at(new T.Mesh(keep(new T.CylinderGeometry(DR, DR, 1.2, 56)), h.clear(0xbfe3f2, 0.35)), DX, TY + 1.4, DZ, g);
    for (let i = 0; i < 22; i++) { const a = rnd(i + 80) * 6.28, rr = 4 + Math.sqrt(rnd(i + 81)) * (DR - 6); h.ball(g, DX + Math.cos(a) * rr, TY + 2.1, DZ + Math.sin(a) * rr, 0.7, 0x5fbf6a, { hull: false }); }
    h.floorLabel(g, DX, DZ + DR + 4.5, 24, 3.4, 'чашка Петри · ×100', '#1b1610', '#fffaf0');
    const ok = x => x ? '✓' : '—';
    if (!d.cut) {
      amoeba(kit, h, g, DX, DZ, R3, { nuc: true, np: [d.nk[0] * R3, d.nk[1] * R3], food: 3, seed: 3 });
      // игла над амёбой и линия будущего разреза
      const xs = DX + d.k * R3, nd = new T.Group(); at(nd, xs, 0, DZ, g); clickable(nd, 'cut');
      at(new T.Mesh(keep(new T.BoxGeometry(0.3, 9, 2 * R3 + 10)), keep(new T.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.22, depthWrite: false }))), 0, TY + 5, 0, nd);
      at(box(0.4, 0.3, 2 * R3 + 10, 0xffd166, { edges: false }), 0, TY + 9.6, 0, nd);
      at(cyl(0.05, 10, C.STEEL, { r2: 0.4, edges: false, hull: false }), 0, TY + 14, 0, nd);
      at(cyl(1.2, 11, 0x3a4762), 0, TY + 24.5, 0, nd); at(cyl(1.5, 1.4, C.BRASS), 0, TY + 19.4, 0, nd);
      at(h.hitBox(5, 26, 5), 0, TY + 17, 0, nd);
      tag(v3(xs, TY + 33, DZ), 'Игла', `слева ${d.fL} · справа ${d.fR}`);
      tag(v3(DX - 10, 13, DZ + 10), 'Амёба', 'целая · ядро — оранжевое');
    } else {
      d.pieces.forEach((p, i) => {
        const bx = DX + (p.side === 'L' ? -13 : 13), n = Math.min(p.count, 4), o = 6.5;
        let off = [[0, 0]];
        if (n === 2) off = [[-o * 0.7, -o * 0.6], [o * 0.7, o * 0.6]];
        if (n >= 3) { off = [[-o, -o * 0.7], [o, o * 0.7], [o, -o * 0.7]]; if (n === 4) off.push([-o, o * 0.7]); }
        const r = R3 * 0.91 * Math.sqrt(Math.max(0.05, p.area)) * (p.count > 2 ? 0.62 : p.count > 1 ? 0.72 : 1);
        const weak = p.nuc ? 0 : clamp(d.day / 3, 0, 1);
        off.forEach((q, k) => amoeba(kit, h, g, bx + q[0], DZ + q[1], r, { nuc: p.nuc, dead: p.dead, weak, seed: 5 + i * 4 + k, food: p.nuc ? 2 : 0 }));
        const lab = p.dead ? 'погибла' : p.nuc ? (p.trans ? 'ядро пересажено' : 'с ядром, живёт') : weak > 0.5 ? 'без ядра, слабеет' : 'без ядра';
        tag(v3(bx, 14, DZ - 4), p.side === 'L' ? 'Слева' : 'Справа', lab + (p.count > 1 ? ` · амёб ${p.count}` : ''), !p.dead && p.trans);
      });
    }
    // микропипетка с ядром другой амёбы на штативе
    const PX = 38, PZ = -22;
    at(box(12, 1.2, 9, C.DARK), PX, TY + 0.6, PZ, g);
    at(cyl(0.6, 30, C.STEEL, { edges: false }), PX + 3, TY + 15.6, PZ - 2, g);
    at(box(2.4, 2.4, 2.4, C.DARK), PX + 3, TY + 24, PZ - 2, g);
    const pg = new T.Group(); at(pg, PX - 2, TY + 24, PZ + 1, g); clickable(pg, 'trans');
    const tip = v3(-12, -12, 8), top = v3(4, 6, -3);
    h.rodAB(pg, tip, top, 0.55, 0xd9ecf5, { matOpt: { transparent: true, opacity: 0.8 } });
    h.rodAB(pg, top, top.clone().add(v3(1.2, 1.8, -0.7)), 1.1, 0xe0473a);
    const hasNuc = d.can || !d.cut;
    if (hasNuc) h.ball(pg, tip.x * 0.85, tip.y * 0.85, tip.z * 0.85, 1.1, COL.nuc);
    at(h.hitBox(10, 22, 10), -4, -3, 3, pg);
    tag(v3(PX, TY + 34, PZ), 'Пипетка', !d.cut ? 'ядро другой амёбы' : d.can ? (d.late ? 'поздно: часть ослабла' : 'пересадить ядро') : 'пересаживать некому', d.cut && d.can && !d.late);
    // перекидной календарь суток
    const CX = 44, CZ = 4, cg = new T.Group(); at(cg, CX, TY, CZ, g);
    at(box(14, 1, 6, C.DARK), 0, 0.5, 0, cg);
    const hold = new T.Group(); at(hold, 0, 1, 0, cg); hold.rotation.x = -0.25;
    at(box(14, 13, 1, 0xf4f1ea), 0, 6.5, 0, hold);
    at(h.screen(12, 9, `СУТКИ\n${d.day} из ${d.days}`, d.day >= d.days ? '#ffd166' : '#86e0a8'), 0, 6, 0.55, hold);
    [-4, 0, 4].forEach(x => at(cyl(0.5, 1.6, C.STEEL, { edges: false }), x, 13.2, 0, hold).rotation.z = Math.PI / 2);
    tag(v3(CX, 20, CZ), 'Дневник', `гибель ${ok(d.death)} · спасение ${ok(d.rescue)}`, d.death && d.rescue);
    // клавиши
    h.key(g, -30, 37, 9, 7, '←', 0x3b6fd8, 'kL', { off: d.cut });
    h.key(g, -15, 37, 16, 7, 'Разрезать', 0xe0473a, 'cut', { off: d.cut });
    h.key(g, 0, 37, 9, 7, '→', 0x3b6fd8, 'kR', { off: d.cut });
    h.key(g, 38, 18, 10, 7, '+1 сутки', 0x2f9e55, 'd1', { off: !d.cut || d.day >= d.days });
    h.key(g, 51, 18, 10, 7, '+3 суток', 0x2f9e55, 'd3', { off: !d.cut || d.day >= d.days });
    h.key(g, 46, 37, 14, 7, 'Заново', 0x56627d, 'again');
  };

  // ===================== Растительная и животная клетки: музейные модели =====================
  // растительная клетка в разрезе: передняя и правая стенки срезаны, видно всё внутри
  // o.click — органоиды кликабельны (ключи 'o-…'); o.starch — зёрна крахмала; o.lit — свет лампы; o.ok — найденные органоиды
  const PL = { nuc: [-13.5, -8.5], vac: [6, 2], chl: [[-20, 0], [-2, -14], [15, -14], [20.5, 9], [-18, 13.5]], mit: [[-8, -1], [-1, 14], [20.5, -3]], rib: [-14, 7], cyt: [11, 14.5] };
  function plantCell(kit, h, parent, x, y, z, s, o = {}) {
    const { T, at, box, cyl, mesh, keep, clickable } = kit, v3 = h.v3;
    const g = new T.Group(); at(g, x, y, z, parent); g.scale.setScalar(s);
    const W = 52, D = 38, WH = 14, LOW = 4.5, th = 2.2, ok = o.ok || {};
    const click = (obj, id) => { if (o.click) clickable(obj, 'o-' + id); return obj; };
    at(box(W, 1.2, D, 0xb8a35c), 0, 0.6, 0, g);
    at(box(W, WH, th, COL.wall), 0, WH / 2, -D / 2 + th / 2, g);
    at(box(th, WH, D - th, COL.wall), -W / 2 + th / 2, WH / 2, th / 2, g);
    at(box(W - th, LOW, th, COL.wall), th / 2, LOW / 2, D / 2 - th / 2, g);
    at(box(th, LOW, D - 2 * th, COL.wall), W / 2 - th / 2, LOW / 2, 0, g);
    // мембрана — тонкая зелёная плёнка под стенкой
    const mm = { edges: false, hull: false };
    at(box(W - 2 * th, WH - 1.6, 0.4, COL.mem, mm), 0, (WH - 1.6) / 2 + 1.2, -D / 2 + th + 0.2, g);
    at(box(0.4, WH - 1.6, D - 2 * th, COL.mem, mm), -W / 2 + th + 0.2, (WH - 1.6) / 2 + 1.2, 0, g);
    at(box(W - 2 * th, LOW - 0.6, 0.4, COL.mem, mm), 0, (LOW - 0.6) / 2 + 1.2, D / 2 - th - 0.2, g);
    at(box(0.4, LOW - 0.6, D - 2 * th, COL.mem, mm), W / 2 - th - 0.2, (LOW - 0.6) / 2 + 1.2, 0, g);
    // цитоплазма
    const cyt = new T.Mesh(keep(new T.BoxGeometry(W - 2 * th - 0.8, 6, D - 2 * th - 0.8)), h.clear(COL.cyt, ok.cyt ? 0.6 : 0.45)); at(cyt, 0, 4.2, 0, g); click(cyt, 'cyt');
    const CY = 7.4;
    // вакуоль с клеточным соком
    const vg = new T.Group(); at(vg, PL.vac[0], CY, PL.vac[1], g); click(vg, 'vac');
    at(new T.Mesh(keep(new T.SphereGeometry(1, 32, 18).scale(12, 5, 10)), h.clear(COL.vac, ok.vac ? 0.62 : 0.48)), 0, 0, 0, vg);
    h.ellRing(vg, 0, 0, 0, 12, 10, 0.25, 0xb6a9f0);
    if (o.click) at(h.hitBall(10), 0, 1, 0, vg);
    // ядро с ядрышком
    const ng = new T.Group(); at(ng, PL.nuc[0], CY + 0.4, PL.nuc[1], g); click(ng, 'nuc');
    h.ball(ng, 0, 0, 0, 5, COL.nuc); h.ball(ng, 1.6, 3.4, 1.2, 1.9, COL.nucl);
    for (let i = 0; i < 6; i++) { const a = i * 1.05, b = 0.5 + rnd(i) * 0.6; h.ball(ng, Math.cos(a) * Math.cos(b) * 5, Math.sin(b) * 5, Math.sin(a) * Math.cos(b) * 5, 0.35, 0x8a5a10, { hull: false }); }
    if (o.click) at(h.hitBall(5.8), 0, 0, 0, ng);
    // хлоропласты с гранами
    const chlMat = o.lit ? h.ownMat(COL.chl, { emissive: 0x3fcf5a, emissiveIntensity: 0.35 }) : null;
    const chl = [];
    PL.chl.forEach(([cx, cz], i) => {
      const cg = new T.Group(); at(cg, cx, CY + 0.3, cz, g); cg.rotation.y = (i * 37 % 80 - 40) * Math.PI / 180; click(cg, 'chl');
      h.ellipsoid(cg, 0, 0, 0, 3.4, 1.5, 2, COL.chl, { mat: chlMat || undefined });
      [-1.8, 0, 1.8].forEach(gx => at(cyl(0.7, 0.6, COL.gran, { edges: false, hull: false }), gx, 1.3, 0, cg));
      if (o.click) at(h.hitBall(3.8), 0, 0.5, 0, cg);
      chl.push(cg);
    });
    // митохондрии с кристами
    const mit = [];
    PL.mit.forEach(([mx, mz], i) => {
      const mg = new T.Group(); at(mg, mx, CY + 0.2, mz, g); mg.rotation.y = (i * 50 - 30) * Math.PI / 180; click(mg, 'mit');
      const mat = h.ownMat(COL.mit, { emissive: 0xff5a3c, emissiveIntensity: 0 });
      const cap = mesh(new T.CapsuleGeometry(1.3, 3.2, 6, 16), COL.mit, { mat, edges: false, hull: true }); cap.rotation.z = Math.PI / 2; mg.add(cap);
      [-1.4, 0, 1.4].forEach(cx2 => { const r2 = mesh(new T.TorusGeometry(1.32, 0.13, 6, 20), COL.crist, { edges: false, hull: false }); r2.rotation.y = Math.PI / 2; at(r2, cx2, 0, 0, mg); });
      if (o.click) at(h.hitBall(3.4), 0, 0, 0, mg);
      mit.push({ mg, mat });
    });
    // рибосомы — горстка мелких зёрен
    const rg = new T.Group(); at(rg, PL.rib[0], CY + 0.2, PL.rib[1], g); click(rg, 'rib');
    for (let i = 0; i < 16; i++) { const a = rnd(i + 20) * 6.28, rr = Math.sqrt(rnd(i + 21)) * 3; h.ball(rg, Math.cos(a) * rr, rnd(i + 22) * 0.6, Math.sin(a) * rr, 0.5, COL.rib, { hull: false }); }
    if (o.click) at(h.hitBall(3.8), 0, 0, 0, rg);
    // зёрна крахмала
    if (o.starch) [[-6, 8], [-3, 10], [-9, 12], [12, -8], [-4, -9]].forEach(([sx, sz], i) => h.ellipsoid(g, sx, CY - 0.6, sz, 1.4, 0.9, 1.1, 0xf6f2e4, { hull: true }).rotation.y = i);
    g.updateMatrixWorld(true);
    const world = (lx, ly, lz) => v3(lx, ly, lz).applyMatrix4(g.matrixWorld);
    return { g, chl, mit, rg, CY, world };
  }
  // животная клетка: мягкая мембрана-купол без стенки, ядро, митохондрии, клеточный центр, гликоген, мелкие вакуоли
  function animalCell(kit, h, parent, x, y, z, s) {
    const { T, at, mesh, keep, cyl } = kit;
    const g = new T.Group(); at(g, x, y, z, parent); g.scale.setScalar(s);
    const A = 20, B = 16;
    at(new T.Mesh(keep(new T.CylinderGeometry(1, 1, 1.2, 56).scale(A, 1, B)), h.ownMat(0xf0c8c4)), 0, 0.6, 0, g);
    at(new T.Mesh(keep(new T.SphereGeometry(1, 40, 18, 0, Math.PI * 2, 0, Math.PI / 2).scale(A, 10, B)), h.clear(0xf3b2b6, 0.3)), 0, 1.2, 0, g);
    h.ellRing(g, 0, 1.3, 0, A, B, 0.35, 0xef7a80);
    h.ball(g, -3, 5, -2, 4.6, COL.nuc); h.ball(g, -1.6, 8.2, -1, 1.7, COL.nucl);
    [[8, 4.5, 3, 0.4], [-11, 4, 5, -0.6], [3, 4, -9, 1.2]].forEach(([mx, my, mz, ry]) => {
      const mg = new T.Group(); at(mg, mx, my, mz, g); mg.rotation.y = ry;
      const cap = mesh(new T.CapsuleGeometry(1.2, 3, 6, 14), COL.mit, { edges: false, hull: true }); cap.rotation.z = Math.PI / 2; mg.add(cap);
      [-1.2, 0, 1.2].forEach(cx2 => { const r2 = mesh(new T.TorusGeometry(1.22, 0.12, 6, 18), COL.crist, { edges: false, hull: false }); r2.rotation.y = Math.PI / 2; at(r2, cx2, 0, 0, mg); });
    });
    // клеточный центр: две центриоли под прямым углом
    const cc = new T.Group(); at(cc, 7, 4.5, -5, g);
    at(cyl(0.6, 2.6, 0x3b6fd8, { seg: 9 }), 0, 0, 0, cc); const c2 = cyl(0.6, 2.6, 0x3b6fd8, { seg: 9 }); c2.rotation.z = Math.PI / 2; at(c2, 1.4, 0.8, 0, cc);
    // гликоген — тёмно-розовые зёрнышки
    for (let i = 0; i < 14; i++) { const a = rnd(i + 70) * 6.28, rr = Math.sqrt(rnd(i + 71)) * 3; h.ball(g, 6 + Math.cos(a) * rr, 2.6 + rnd(i + 72), 8 + Math.sin(a) * rr, 0.5, 0xa8325a, { hull: false }); }
    // мелкие вакуоли и рибосомы
    h.ball(g, -10, 3.5, -6, 1.4, 0xb6a9f0, { mat: h.clear(COL.vac, 0.6), hull: false }); h.ball(g, 12, 3, -3, 1.1, 0xb6a9f0, { mat: h.clear(COL.vac, 0.6), hull: false });
    for (let i = 0; i < 16; i++) { const a = rnd(i + 90) * 6.28, rr = 6 + rnd(i + 91) * 9; h.ball(g, Math.cos(a) * rr, 2.2 + rnd(i + 92) * 1.5, Math.sin(a) * rr * 0.75, 0.4, COL.rib, { hull: false }); }
    return g;
  }

  // ===================== Урок 3. Органоиды: кто чем занят =====================
  SC['bio-organ'] = (kit, d) => {
    const { T, at, box, cyl, keep, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.desk(g);
    const ok = {}; d.matched.forEach(k => ok[k] = true);
    const lit = d.light > 0;
    const top = h.pedestal(g, -6, -12, 60, 44);
    const P = plantCell(kit, h, g, -6, top, -12, 1, { click: true, lit, ok });
    // найденные органоиды подписаны
    const tagAt = { nuc: [PL.nuc[0], 15, PL.nuc[1]], vac: [PL.vac[0], 13, PL.vac[1]], chl: [PL.chl[1][0], 11, PL.chl[1][1]], mit: [PL.mit[0][0], 11, PL.mit[0][1]], rib: [PL.rib[0], 10, PL.rib[1]], cyt: [PL.cyt[0], 9, PL.cyt[1]] };
    d.matched.forEach(k => { const p = tagAt[k]; if (p) tag(P.world(p[0], p[1], p[2]), d.names[k], '✓', true); });
    // анимация: митохондрии «дышат», хлоропласты на свету выделяют кислород, рибосомы собирают цепочку белка
    const bub = [];
    if (ok.chl && lit) {
      const bgeo = keep(new T.SphereGeometry(0.45, 8, 6)), bmat = keep(new T.MeshBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.85 }));
      P.chl.forEach((cg, i) => { for (let k = 0; k < 2; k++) { const m = new T.Mesh(bgeo, bmat); cg.add(m); bub.push({ m, ph: k * 0.5 + i * 0.13 }); } });
    }
    const chain = [];
    if (ok.rib) for (let i = 0; i < 8; i++) chain.push(h.ball(P.rg, 3.5 + i * 0.9, 1.2 + (i % 2) * 0.6, -1 + (i % 3) * 0.4, 0.4, 0xffb547, { hull: false }));
    kit.onFrame((dt, t) => {
      if (ok.mit) P.mit.forEach((m, i) => { m.mat.emissiveIntensity = kit.reduce ? 0.3 : 0.15 + 0.35 * Math.abs(Math.sin(t * 2 + i)); });
      bub.forEach(b => { const ph = kit.reduce ? 0.5 : (t * 0.5 + b.ph) % 1; b.m.position.set(0.6, 1.6 + ph * 7, 0); b.m.visible = ph < 0.95; });
      if (chain.length) { const n = kit.reduce ? chain.length : Math.ceil(((t / 2.4) % 1) * chain.length); chain.forEach((c, i) => c.visible = i < n); }
    });
    // настольная лампа: нажать — свет вкл/выкл
    const LX = 46, LZ = -30, lg = new T.Group(); at(lg, LX, TY, LZ, g); clickable(lg, 'light');
    at(cyl(5, 1.4, 0x2c3240), 0, 0.7, 0, lg);
    h.rodAB(lg, v3(0, 1.4, 0), v3(-4, 26, 2), 0.7, C.STEEL);
    h.rodAB(lg, v3(-4, 26, 2), v3(-16, 30, 9), 0.7, C.STEEL);
    // абажур смотрит на модель клетки (раструб — вниз по оси −y)
    const HP = v3(-18, 28.5, 10), dir = v3(-6 - LX, top + 8, -12 - LZ).sub(HP).normalize();
    const head = cyl(4.6, 6, 0x3b6fd8, { r2: 1.6 }); head.quaternion.setFromUnitVectors(v3(0, -1, 0), dir); at(head, HP.x, HP.y, HP.z, lg);
    const BP = HP.clone().addScaledVector(dir, 2.6);
    h.ball(lg, BP.x, BP.y, BP.z, 2, lit ? 0xfff1b8 : 0xdfe8ef, { matOpt: lit ? { emissive: 0xffc23a, emissiveIntensity: 0.9 } : undefined });
    if (lit) {
      at(h.glow(0xffd27a, 22, 0.75), BP.x, BP.y, BP.z, lg);
      at(new T.PointLight(0xffe0a0, 45 * d.light / 70, 120, 1.1), BP.x, BP.y - 1, BP.z, lg);
      // луч света к модели
      const bm = keep(new T.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.12, depthWrite: false }));
      const beam = new T.Mesh(keep(new T.ConeGeometry(16, 26, 32, 1, true)), bm); beam.quaternion.setFromUnitVectors(v3(0, -1, 0), dir);
      const CP = HP.clone().addScaledVector(dir, 15); at(beam, CP.x, CP.y, CP.z, lg);
    }
    at(h.hitBox(26, 34, 18), -9, 17, 6, lg);
    tag(v3(LX - 18, 38, LZ + 10), 'Лампа', lit ? `свет ${d.light} %` : 'выключена', lit);
    // табло: сколько сахара делается и тратится
    const sx = 50, sz = 2, sb = new T.Group(); at(sb, sx, TY, sz, g);
    at(box(16, 11, 7, 0x2c3240), 0, 5.5, 0, sb);
    at(h.screen(14, 8.4, `сахар\n+${d.prod} −${d.use}`, d.net >= 0 ? '#86e0a8' : '#ff8a73'), 0, 5.6, 3.55, sb);
    tag(v3(sx, 15, sz), 'Сахар в клетке', d.net >= 0 ? 'хватает' : 'тратится запас', d.net >= 0);
    // карточки с работами
    d.jobs.forEach((j, i) => {
      const x = -45 + i * 18, z = 33, done = !!ok[j.id], sel = d.sel === j.id;
      const cg = new T.Group(); at(cg, x, TY + (sel ? 1.6 : 0), z, g); if (!done) clickable(cg, 'j-' + j.id);
      at(box(16, 0.6, 10, done ? 0x2f9e55 : sel ? 0xffd166 : 0x3a4762), 0, 0.3, 0, cg);
      const st = h.sticker(15, 9, j.lines.join('\n'), '#1b1610', done ? '#c9f0d4' : '#fffaf0', 320); st.rotation.x = -Math.PI / 2; at(st, 0, 0.65, 0, cg);
      at(h.hitBox(16, 3, 10), 0, 1, 0, cg);
      if (sel) h.ring(g, x, z, 11);
    });
    h.key(g, 52, 18, 14, 7, 'Сначала', 0x56627d, 'clear3');
    tag(v3(-6, 24, -12), 'Модель клетки', `найдено ${d.matched.length} из 6`, d.matched.length === 6);
  };

  // ===================== Урок 4. Клетки растений и животных =====================
  SC['bio-compare'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.desk(g);
    const t1 = h.pedestal(g, -36, -18, 40, 30);
    plantCell(kit, h, g, -36, t1, -18, 0.66, { starch: true, lit: true });
    const t2 = h.pedestal(g, 36, -18, 40, 30);
    animalCell(kit, h, g, 36, t2, -18, 0.85);
    tag(v3(-36, 22, -18), 'Растительная', 'стенка · хлоропласты · вакуоль');
    tag(v3(36, 20, -18), 'Животная', 'без стенки · клеточный центр');
    // карточка-признак на подставке; нажать — другая карточка
    const cs = new T.Group(); at(cs, 0, TY, -10, g); if (d.cur) clickable(cs, 'skip');
    at(box(12, 1, 5, 0x2c3240), 0, 0.5, 0, cs);
    const hold = new T.Group(); at(hold, 0, 1, 0, cs); hold.rotation.x = -0.3;
    at(box(26, 11, 0.6, 0x2c3240), 0, 5.6, -0.4, hold);
    at(h.sticker(25, 10, d.cur || 'Все признаки\nразложены', d.cur ? '#1b1610' : '#1d5a27', d.cur ? '#fff6e6' : '#c9f0d4', 480), 0, 5.6, 0, hold);
    at(h.hitBox(26, 13, 6), 0, 6.5, 0, hold);
    tag(v3(0, 18, -10), 'Признак', d.cur ? `${d.n + 1} из ${d.tot}` + (d.miss ? ` · ошибок ${d.miss}` : '') : `все ${d.tot} ✓`, !d.cur);
    // три лотка: только у растительной / у обеих / только у животной
    const TR = [['plant', -38, 'только у растительной', 0x5fbf6a, '#c9f0d4'], ['both', 0, 'у обеих', 0xffd166, '#fff1c2'], ['animal', 38, 'только у животной', 0xef7a80, '#ffd9db']];
    TR.forEach(([z0, x, title, col, bg]) => {
      const z = 22, W = 34, D = 20, tg = new T.Group(); at(tg, x, TY, z, g); if (d.cur) clickable(tg, 'z-' + z0);
      at(box(W, 1, D, 0xf3f5f8), 0, 0.5, 0, tg);
      at(box(W, 2, 1, col), 0, 1, -D / 2, tg); at(box(W, 2, 1, col), 0, 1, D / 2, tg);
      at(box(1, 2, D, col), -W / 2, 1, 0, tg); at(box(1, 2, D, col), W / 2, 1, 0, tg);
      const lb = h.sticker(W - 2, 4, title, '#1b1610', bg, 420); lb.rotation.x = -Math.PI / 2; at(lb, 0, 0.1, D / 2 + 3.2, tg);
      (d.placed[z0] || []).forEach((txt, i) => {
        const cx = (i % 2 ? 7.6 : -7.6), cz = -6 + Math.floor(i / 2) * 5.2;
        const st = h.sticker(14.6, 4.4, txt, '#1b1610', '#fffaf0', 300); st.rotation.x = -Math.PI / 2; at(st, cx, 1.1 + i * 0.01, cz, tg);
      });
      at(h.hitBox(W, 4, D), 0, 2, 0, tg);
    });
    h.key(g, 0, 40, 20, 6, 'Другая карточка', 0x3b6fd8, 'skip', { off: d.left < 2 });
    h.key(g, 52, 40, 14, 6, 'Сначала', 0x56627d, 'clear4');
  };
})();
