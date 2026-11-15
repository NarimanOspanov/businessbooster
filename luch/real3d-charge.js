// «Как в жизни» для темы «Электрический заряд» (labs/phys-charge): школьные приборы по электростатике.
// Сцены строятся из window.LUCH_REAL() опыта; нажатия — через clickable → LUCH_REAL.click(key) → act(key).
(() => {
  const SC = (window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {});
  const PI = Math.PI;
  const mem = {};                       // переживает перестройку сцены: углы, положения — для плавного движения
  const nowS = () => performance.now() / 1000;
  const ease = (cur, tgt, dt, k) => cur + (tgt - cur) * Math.min(1, dt * k);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // значки зарядов «+» / «−» (спрайты всегда смотрят в камеру)
  function signMaker(kit) {
    const { T, keep } = kit, mats = {};
    const make = plus => {
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
      x.fillStyle = plus ? '#ff8a73' : '#7fc4ff'; x.strokeStyle = '#1b1610'; x.lineWidth = 5;
      x.beginPath(); x.arc(32, 32, 27, 0, PI * 2); x.fill(); x.stroke();
      x.fillStyle = '#1b1610'; x.fillRect(17, 28, 30, 8); if (plus) x.fillRect(28, 17, 8, 30);
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace;
      return keep(new T.SpriteMaterial({ map: tex }));
    };
    return (plus, size = 2.2) => {
      const k = plus ? 'p' : 'n'; if (!mats[k]) mats[k] = make(plus);
      const s = new T.Sprite(mats[k]); s.scale.setScalar(size); s.renderOrder = 3; return s;
    };
  }
  // маленький значок-бейдж с текстом (✓ у разобранных образцов)
  function badge(kit, txt, fg, bg, size = 3) {
    const { T, keep } = kit;
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    x.fillStyle = bg; x.strokeStyle = '#1b1610'; x.lineWidth = 5; x.beginPath(); x.arc(32, 32, 27, 0, PI * 2); x.fill(); x.stroke();
    x.fillStyle = fg; x.font = '700 34px "Golos Text", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, 32, 35);
    const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace;
    const s = new T.Sprite(keep(new T.SpriteMaterial({ map: tex }))); s.scale.setScalar(size); s.renderOrder = 3; return s;
  }
  const glass = (kit, color, opacity) => kit.keep(new kit.T.MeshToonMaterial({ color, gradientMap: kit.grad, transparent: true, opacity, side: kit.T.DoubleSide, depthWrite: false }));
  const sphere = (kit, r, color, o = {}) => kit.mesh(new kit.T.SphereGeometry(r, 28, 20), color, { hull: true, edges: false, ...o });
  // лабораторный штатив: тяжёлое основание и стойка
  function standRod(kit, g, x, z, h) {
    const { at, box, cyl, C } = kit;
    at(box(12, 1.6, 9, 0x3a3f4c), x, 0.8, z, g);
    at(cyl(0.75, h, C.STEEL, { edges: false }), x, 1.6 + h / 2, z - 2, g);
    at(cyl(1.2, 1.4, C.STEEL, { seg: 6 }), x, 2.3, z - 2, g);
  }

  // ===================== Урок 1. Электризация трением =====================
  // палочка в лапке штатива, ткань (мех/шёлк), лёгкая гильза на шёлковой нити, вторая палочка на столе
  SC['charge-rub'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const sign = signMaker(kit);
    const R = 1.5, HL = 13, WL = 43, SY = 17, X0 = -45;        // палочка: ручка HL + рабочая часть WL, ось на высоте SY
    const look = {
      eb: { body: 0x2a2d36, cloth: 0x8a6a48, glass: false },
      gl: { body: 0xbfe6f2, cloth: 0xa796cf, glass: true },
    };
    // палочка: группа вдоль +x от начала ручки
    function stick(kind, q, big) {
      const g = new T.Group(), r = big ? R : R * 0.9;
      const h = cyl(r * 1.08, HL, 0x5d6a86); h.rotation.z = PI / 2; at(h, HL / 2, 0, 0, g);
      for (let k = 0; k < 3; k++) { const b = cyl(r * 1.14, 0.5, 0x48536b, { edges: false, hull: false }); b.rotation.z = PI / 2; at(b, 2.5 + k * 3.6, 0, 0, g); }
      const w = look[kind].glass ? mesh(new T.CylinderGeometry(r, r, WL, 24), 0, { mat: glass(kit, look[kind].body, 0.55), edges: false, hull: true })
        : cyl(r, WL, look[kind].body);
      w.rotation.z = PI / 2; at(w, HL + WL / 2, 0, 0, g);
      const tip = look[kind].glass ? mesh(new T.SphereGeometry(r, 20, 14), 0, { mat: glass(kit, look[kind].body, 0.55), edges: false, hull: true }) : sphere(kit, r, look[kind].body);
      at(tip, HL + WL, 0, 0, g);
      if (look[kind].glass) { const hl = box(WL - 4, 0.15, 0.4, 0xffffff, { edges: false, shadow: false }); at(hl, HL + WL / 2, r * 0.75, r * 0.35, g); }
      const n = Math.abs(q);
      for (let i = 0; i < n; i++) {
        const row = i % 2, col = Math.floor(i / 2), cols = Math.ceil(n / 2);
        const x = HL + 4 + (cols > 1 ? col * (WL - 8) / (cols - 1) : (WL - 8) / 2) + (row ? 1.2 : 0);
        const s = sign(q > 0, big ? 2.6 : 2.1); at(s, x, row ? r * 0.2 : r + 0.6, row ? r + 0.6 : 0.2, g);
      }
      return g;
    }
    // ткань: мех — ворсистый лоскут, шёлк — тонкий платок со складкой
    function cloth(kind, q) {
      const g = new T.Group(), col = look[kind].cloth;
      if (kind === 'eb') {
        at(box(11, 1.8, 8.5, col), 0, 0.9, 0, g);
        for (let i = 0; i < 18; i++) { const t = cyl(0.55, 1.6, 0x6e5034, { r2: 0.05, edges: false, hull: false, seg: 5 }); t.rotation.z = (i % 3 - 1) * 0.35; at(t, -4.4 + (i % 6) * 1.8, 2.4, -3 + Math.floor(i / 6) * 3, g); }
      } else {
        at(box(12, 0.5, 9, col), 0, 0.25, 0, g);
        const f = box(12, 0.5, 4, 0xbcaee0); f.rotation.x = 0.35; at(f, 0, 1, -2.6, g);
      }
      const n = Math.min(8, Math.abs(q));
      for (let i = 0; i < n; i++) at(sign(q > 0, 2), -3.6 + (i % 4) * 2.4, kind === 'eb' ? 3.6 : 1.9, -1.4 + Math.floor(i / 4) * 2.8, g);
      return g;
    }
    const cur = d.pair, oth = cur === 'eb' ? 'gl' : 'eb', q = d[cur];

    // штатив с лапкой держит палочку за ручку
    const st = new T.Group(); at(st, 0, 0, 0);
    standRod(kit, st, X0 + 6, -7, SY + 6);
    at(box(1.2, 1.2, 9, C.STEEL), X0 + 6, SY, -4.2, st);
    at(box(3.2, 1, 3.6, 0x3a3f4c), X0 + 6, SY + R + 0.6, 0, st); at(box(3.2, 1, 3.6, 0x3a3f4c), X0 + 6, SY - R - 0.6, 0, st);
    at(cyl(0.5, 4.8, C.BRASS, { edges: false }), X0 + 6, SY, 1.9, st);
    const sg = stick(cur, q, true); at(sg, X0, SY, 0); clickable(sg, 'rubOnce');

    // ткань: лежит на столе; при трении обхватывает палочку и ездит вдоль неё
    const CX = 20, CZ = 20;
    const cl = cloth(cur, -q); at(cl, CX, 0, CZ); clickable(cl, 'rubOnce');
    const wrap = new T.Group(); at(wrap, 0, SY, 0);
    const wcyl = cyl(R + 1.4, 8, look[cur].cloth); wcyl.rotation.z = PI / 2; at(wcyl, 0, 0, 0, wrap);
    if (cur === 'eb') for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2, t = cyl(0.45, 1.3, 0x6e5034, { r2: 0.05, edges: false, hull: false, seg: 5 }); t.rotation.x = a; at(t, -3 + (i % 4) * 2, Math.cos(a) * (R + 2.1), Math.sin(a) * (R + 2.1), wrap); }
    wrap.visible = false;
    const spark = new T.Sprite(new T.SpriteMaterial({ map: kit.glowTex(), color: 0xffe696, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0 }));
    kit.keep(spark.material); spark.scale.setScalar(12); at(spark, 0, SY, 0);

    // гильза из фольги на шёлковой нити, штатив справа
    const HX = 24, Lth = 17, HY = SY + Lth + 1.6;
    standRod(kit, null, 40, 2, HY + 1);
    at(box(17, 1, 1, kit.C.STEEL), (HX + 38) / 2, HY + 0.4, 0);
    at(cyl(0.5, 1.6, kit.C.BRASS, { edges: false }), HX, HY - 0.6, 0);
    const piv = new T.Group(); at(piv, HX, HY - 1.2, 0);
    at(cyl(0.12, Lth - 1.2, 0xeeeeee, { edges: false, hull: false, shadow: false }), 0, -(Lth - 1.2) / 2, 0, piv);
    const sl = new T.Group(); at(sl, 0, -Lth - 0.2, 0, piv);
    at(cyl(1.3, 3.4, 0xd9d2b4), 0, 0, 0, sl);
    at(cyl(1.35, 0.4, 0xf5efd5, { edges: false, hull: false }), 0, 1.5, 0, sl);
    if (d.ans) at(sign(d.ans === '+', 1.8), 0, 0.2, 2, sl);
    clickable(sl, 'sleeve');

    // вторая палочка лежит на подставках у края стола со своей тканью
    const sp = new T.Group(); at(sp, 0, 0, 0); clickable(sp, 'swap');
    at(box(3, 1.4, 4, kit.C.WOOD2), -32, 0.7, 36, sp); at(box(3, 1.4, 4, kit.C.WOOD2), 12, 0.7, 36, sp);
    at(stick(oth, d[oth], false), -38, 1.4 + R, 36, sp);
    const c2 = cloth(oth, -d[oth]); c2.scale.setScalar(0.8); at(c2, -48, 0, 22, sp);

    tag(v3(-10, SY + 6, 0), d.name, d.qtxt, Math.abs(q) >= 8);
    tag(v3(CX, 6, CZ), d.cloth, d.ctxt);
    tag(v3(HX + 6, HY + 3, 0), 'Гильза', d.word);
    tag(v3(-8, 5, 36), d.name2, d.q2txt);

    // анимация: нить с гильзой качается к своему углу, ткань трёт палочку после каждого «потереть»
    if (mem.rubPair !== cur) { mem.rubPair = cur; mem.rubs = d.rubs; }
    if (d.rubs > mem.rubs) mem.rubT = nowS();
    mem.rubs = d.rubs;
    if (mem.th === undefined) mem.th = d.th;
    mem.thv = mem.thv || 0;
    const xa = X0 + HL + 6, xb = X0 + HL + WL - 6;
    kit.onFrame((dt, t) => {
      const tgt = d.th;
      if (kit.reduce) mem.th = tgt;
      else { mem.thv += ((tgt - mem.th) * 22 - mem.thv * 4.5) * dt; mem.th += mem.thv * dt; }
      piv.rotation.z = (mem.th + (kit.reduce ? 0 : Math.sin(t * 1.3) * 0.6)) * PI / 180;
      const age = mem.rubT ? nowS() - mem.rubT : 99, on = age < 1.4 && !kit.reduce;
      wrap.visible = on; cl.visible = !on;
      if (on) {
        const u = 0.5 - 0.5 * Math.cos(age * PI * 3.2);
        wrap.position.x = xa + (xb - xa) * u;
        spark.position.x = wrap.position.x; spark.material.opacity = 0.25 + 0.35 * Math.abs(Math.sin(age * 23));
      } else spark.material.opacity = 0;
    });
  };

  // ===================== Урок 2. Проводники и диэлектрики =====================
  // два электроскопа (стеклянный корпус, стержень, листочки, шкала), перемычка с изолирующей ручкой, лоток образцов
  SC['charge-cond'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const sign = signMaker(kit);
    const XA = -30, XB = 30, Z = 0, BY = 31, HY = 13, LEAF = 8.5;
    const leafA = q => Math.min(46, 3.8 * Math.abs(q));
    // шкала углов за листочками
    function scaleTex() {
      const c = document.createElement('canvas'); c.width = 256; c.height = 160; const x = c.getContext('2d');
      x.fillStyle = 'rgba(247,243,234,.92)'; x.beginPath(); x.moveTo(128, 6); x.arc(128, 6, 150, PI * 0.22, PI * 0.78); x.closePath(); x.fill();
      x.strokeStyle = '#1b1610'; x.lineWidth = 3; x.stroke();
      x.fillStyle = '#1b1610'; x.font = '600 16px "IBM Plex Mono", monospace'; x.textAlign = 'center';
      for (let a = -40; a <= 40; a += 10) {
        const r = (90 - a) * PI / 180, ca = Math.cos(r), sa = Math.sin(r), L = a % 20 ? 10 : 18;
        x.lineWidth = a % 20 ? 2 : 3; x.beginPath(); x.moveTo(128 + ca * 146, 6 + sa * 146); x.lineTo(128 + ca * (146 - L), 6 + sa * (146 - L)); x.stroke();
        if (!(a % 20)) x.fillText(String(Math.abs(a)), 128 + ca * 116, 6 + sa * 116 + 5);
      }
      const t = kit.keep(new T.CanvasTexture(c)); t.colorSpace = T.SRGBColorSpace; return t;
    }
    const sTex = scaleTex();
    function scope(x, q, key) {
      const g = new T.Group(); at(g, x, 0, Z);
      at(cyl(9.5, 2, C.WOOD2, { seg: 32 }), 0, 1, 0, g);
      at(cyl(8.6, 1.2, 0x3a3f4c, { seg: 32 }), 0, 2.6, 0, g);
      const jar = mesh(new T.CylinderGeometry(8, 8, 19, 40, 1, true), 0, { mat: glass(kit, 0xe6f4fb, 0.13), edges: false, hull: false, shadow: false });
      at(jar, 0, 12.7, 0, g);
      at(cyl(8.4, 1.4, 0x3a3f4c, { seg: 32 }), 0, 22.7, 0, g);
      at(cyl(2.6, 3, 0x1f2229), 0, 24.6, 0, g);                       // пробка-изолятор
      at(cyl(0.55, BY - HY, C.STEEL, { edges: false }), 0, (BY + HY) / 2, 0, g);
      const ball = sphere(kit, 2.6, 0xd6dce6); at(ball, 0, BY, 0, g);
      const sc = new T.Mesh(kit.keep(new T.PlaneGeometry(16, 10)), kit.keep(new T.MeshBasicMaterial({ map: sTex, transparent: true, opacity: 0.7 })));
      at(sc, 0, HY + 0.6 - 5, -3.2, g);
      at(box(1.4, 1.2, 1.2, C.BRASS), 0, HY, 0, g);
      const mk = s => { const p = new T.Group(); at(p, 0, HY, 0.3, g); at(box(2.4, LEAF, 0.12, 0xf2c94c, { edges: true }), 0, -LEAF / 2, 0, p); p.userData.s = s; return p; };
      const l1 = mk(-1), l2 = mk(1);
      const n = Math.round(Math.abs(q) / 3), plus = q > 0;
      for (let i = 0; i < Math.min(4, n); i++) { const a = (-55 + i * 37) * PI / 180; at(sign(plus, 2.2), Math.sin(a) * 4, BY + Math.cos(a) * 4, 1.4, g); }
      if (n > 0) for (const p of [l1, l2]) at(sign(plus, 1.8), 0, -LEAF * 0.7, 0.6, p);
      clickable(g, key);
      return [l1, l2];
    }
    const LA = scope(XA, d.qA, 'recharge'), LB = scope(XB, d.qB, 'bridge');

    // перемычка из проверяемого материала с изолирующей ручкой посередине
    const rod = new T.Group(); at(rod, 0, 0, 0); clickable(rod, 'bridge');
    const len = XB - XA - 5.2;
    const body = cyl(1, len, d.col); body.rotation.z = PI / 2; at(body, 0, 0, 0, rod);
    at(box(5.5, 3.4, 3.4, 0x26324a), 0, 0, 0, rod);
    for (let k = -1; k <= 1; k++) at(box(0.5, 3.6, 3.6, 0x3a4762, { edges: false }), k * 1.6, 0, 0, rod);
    at(cyl(1.1, 7, 0x26324a), 0, 3.8, 0, rod);                        // держатель
    // подставки, на которых перемычка лежит, пока не соединяет
    const RZ = 22;
    at(box(3, 1.2, 4, C.WOOD2), -20, 0.6, RZ); at(box(3, 1.2, 4, C.WOOD2), 20, 0.6, RZ);
    // бегущие электроны по перемычке-проводнику
    const els = [];
    if (d.flow) for (let k = 0; k < 6; k++) { const s = sign(false, 2.2); at(s, 0, 1.9, 0.6, rod); els.push(s); }

    // лоток с образцами материалов
    const TZ = 39;
    at(box(104, 1.4, 9, C.WOOD2), 0, 0.7, TZ);
    d.tray.forEach((m, i) => {
      const x = -43 + i * 17.2;
      at(box(14, 0.4, 6, 0x9a6634, { edges: false }), x, 1.45, TZ);
      if (m.k === d.mat) { at(box(14, 0.2, 6, 0xffd166, { edges: false, matOpt: { transparent: true, opacity: 0.55 } }), x, 1.7, TZ); return; }
      const g = new T.Group(); at(g, x, 2.7, TZ); clickable(g, 'mat-' + m.k);
      const s = cyl(0.9, 11, m.col); s.rotation.z = PI / 2; at(s, 0, 0, 0, g);
      if (m.s) at(badge(kit, '✓', '#0e1520', '#86e0a8', 2.6), 6.5, 2.4, 0, g);
      else if (m.t) at(badge(kit, '?', '#0e1520', '#ffd166', 2.6), 6.5, 2.4, 0, g);
    });

    tag(v3(XA, BY + 4, Z), 'Электроскоп A', d.Atxt);
    tag(v3(XB, BY + 4, Z), 'Электроскоп B', d.Btxt, Math.abs(d.qB) > 0.4);
    const rodTag = v3(0, 9, RZ);
    tag(rodTag, 'Перемычка · ' + d.matName, d.bridged ? (d.stuck ? 'заряд не идёт' : d.flow ? 'электроны идут к B' : 'соединяет') : 'не соединяет', d.flow);
    tag(v3(48, 5, TZ), 'Образцы', 'разобрано ' + d.sorted + '/6');

    // анимация: листочки и перемычка плавно приходят к своему положению, электроны бегут A → B
    if (mem.aA === undefined) { mem.aA = leafA(d.qA); mem.aB = leafA(d.qB); mem.up = d.bridged ? 1 : 0; }
    kit.onFrame((dt, t) => {
      const k = kit.reduce ? 1e3 : 5;
      mem.aA = ease(mem.aA, leafA(d.qA), dt, k); mem.aB = ease(mem.aB, leafA(d.qB), dt, k);
      for (const p of LA) p.rotation.z = p.userData.s * -mem.aA * PI / 180;
      for (const p of LB) p.rotation.z = p.userData.s * -mem.aB * PI / 180;
      mem.up = kit.reduce ? (d.bridged ? 1 : 0) : clamp(mem.up + (d.bridged ? 1 : -1) * dt * 2.2, 0, 1);
      const u = mem.up * mem.up * (3 - 2 * mem.up);
      rod.position.set(0, 2.4 + (BY - 2.4) * u + Math.sin(u * PI) * 6, RZ + (Z - RZ) * u);
      rodTag.set(0, rod.position.y + 7, rod.position.z);
      els.forEach((s, i) => {
        const ph = kit.reduce ? i / 6 : (t * 0.8 + i / 6) % 1, xx = -len / 2 + 1 + ph * (len - 2);
        s.position.x = xx; s.visible = Math.abs(xx) > 3.6;
      });
    });
  };

  // ===================== Урок 3. Электрическое поле =====================
  // заряженный шар на изолирующей стойке с бумажным султаном, источник высокого напряжения,
  // лёгкий пробный шарик «+» на нити на передвижном штативе, линейка расстояний
  SC['charge-field'] = (kit, d) => {
    const { T, box, cyl, mesh, v3, clickable, C } = kit;
    const sign = signMaker(kit);
    const OX = 8, OZ = 10;                                            // вся установка сдвинута к центру площадки
    const F = new T.Group(); kit.at(F, OX, 0, OZ);
    const at = (o, x, y, z, p) => kit.at(o, x, y, z, p || F);
    const tag = (p, ...a) => { p.x += OX; p.z += OZ; kit.tag(p, ...a); return p; };
    const SX = -42, SY = 24, SR = 4.5, U = 2.5, PZ = 0, RZ = 10;   // U — единиц сцены на 1 см
    const pos = d.Qs > 0;
    // шар на стеклянной стойке
    const sg = new T.Group(); at(sg, SX, 0, 0); clickable(sg, 'src');
    at(cyl(5, 1.8, 0x3a3f4c, { seg: 32 }), 0, 0.9, 0, sg);
    at(mesh(new T.CylinderGeometry(1.1, 1.1, SY - SR - 1.6, 20), 0, { mat: glass(kit, 0xcfe6f2, 0.55), edges: false, hull: true }), 0, 1.8 + (SY - SR - 1.8) / 2, 0, sg);
    at(cyl(1.6, 1, C.STEEL), 0, SY - SR - 0.2, 0, sg);
    at(sphere(kit, SR, 0xd6dce6), 0, SY, 0, sg);
    const n = Math.round(d.Qm * 2);
    for (let i = 0; i < n; i++) {                                     // значки на стороне шара, обращённой к зрителю
      const a = 0.62 - 1.1 + 2.2 * (i + 0.5) / n, b = [0.15, 0.75, -0.45][i % 3], rr = SR + 0.5;
      at(sign(pos, 1.6), Math.sin(a) * Math.cos(b) * rr, SY + Math.sin(b) * rr, Math.cos(a) * Math.cos(b) * rr, sg);
    }
    // бумажный султан сверху: полоски расходятся сильнее при большем |Q|
    at(cyl(0.35, 3, C.STEEL, { edges: false }), 0, SY + SR + 1.2, 0, sg);
    const strips = [], spread = (14 + 11 * d.Qm) * PI / 180;
    for (let i = 0; i < 12; i++) {
      const p = new T.Group(); at(p, 0, SY + SR + 2.6, 0, sg); p.rotation.y = i / 12 * PI * 2;
      const s = new T.Group(); at(s, 0, 0, 0, p);
      at(box(0.6, 6, 0.08, i % 2 ? 0xfff6e6 : 0xf2d27a, { edges: true, shadow: false }), 0, 3, 0, s);
      s.userData.base = spread; strips.push(s);
    }
    // источник высокого напряжения: табло, кнопки «−»/«+», переключатель знака
    const hv = new T.Group(); at(hv, -30, 0, 27);
    at(box(26, 12, 12, 0x3b4a66), 0, 6, 0, hv); at(box(24, 1, 10, 0x4a5b7c), 0, 12.5, 0, hv);
    const scr = new T.Mesh(kit.keep(new T.PlaneGeometry(14, 5)), kit.keep(new T.MeshBasicMaterial({ map: kit.keep(kit.textTex((pos ? '+' : '−') + String(d.Qm.toFixed(1)).replace('.', ',') + ' нКл', pos ? '#ff8a73' : '#7fc4ff', '#0e1520', 300, 110)) })));
    at(scr, -3.5, 8, 6.05, hv);
    const bm = new T.Group(); at(bm, 6, 8.6, 6.4, hv); clickable(bm, 'q-');
    const bmc = cyl(1.8, 1.2, 0x2f6fd8); bmc.rotation.x = PI / 2; at(bmc, 0, 0, 0, bm); at(box(2, 0.5, 0.3, 0xffffff, { edges: false }), 0, 0, 0.7, bm);
    const bp = new T.Group(); at(bp, 10.5, 8.6, 6.4, hv); clickable(bp, 'q+');
    const bpc = cyl(1.8, 1.2, 0xe0473a); bpc.rotation.x = PI / 2; at(bpc, 0, 0, 0, bp); at(box(2, 0.5, 0.3, 0xffffff, { edges: false }), 0, 0, 0.7, bp); at(box(0.5, 2, 0.3, 0xffffff, { edges: false }), 0, 0, 0.7, bp);
    const sw = new T.Group(); at(sw, 8, 3.4, 6.2, hv); clickable(sw, 'qsign');
    at(box(8, 2.6, 0.6, 0x1f2229), 0, 0, 0, sw); at(box(3.4, 2, 1.2, pos ? 0xe0473a : 0x2f6fd8), pos ? 1.9 : -1.9, 0, 0.6, sw);
    at(cyl(1.2, 2.4, 0xe0473a), -8, 14.2, -2, hv);
    F.updateMatrixWorld(true);
    const w = (x, y, z) => v3(x + OX, y, z + OZ);
    kit.cable(v3(-8, 15.4, -2).applyMatrix4(hv.matrixWorld), w(SX - 1.5, SY - SR + 0.6, 1.2), 0xe0473a, 0, { r: 0.5, lift: 2, via: [w(-46, 1.2, 16), w(SX - 3, 1.2, 4)] });
    // линейка вдоль стола от центра шара
    {
      const c = document.createElement('canvas'); c.width = 1024; c.height = 96; const x = c.getContext('2d');
      x.fillStyle = '#f1e3c2'; x.fillRect(0, 0, 1024, 96); x.fillStyle = '#1b1610'; x.font = '600 26px "IBM Plex Mono", monospace'; x.textAlign = 'center';
      const px = cm => (cm + 1) / 32 * 1024;
      for (let k = 0; k <= 30; k++) { const w = k % 5 ? 2 : 4, h = k % 5 ? 22 : 40; x.fillRect(px(k) - w / 2, 0, w, h); if (!(k % 5)) x.fillText(String(k), px(k), 72); }
      x.font = '600 20px "IBM Plex Mono", monospace'; x.fillText('см', px(31) - 4, 72);
      const tex = kit.keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace;
      at(box(32 * U, 0.6, 5, 0xf1e3c2), SX - U + 16 * U, 0.3, RZ);
      const pl = new T.Mesh(kit.keep(new T.PlaneGeometry(32 * U, 5)), kit.keep(new T.MeshBasicMaterial({ map: tex })));
      pl.rotation.x = -PI / 2; at(pl, SX - U + 16 * U, 0.62, RZ);
    }
    // передвижной штатив с пробным шариком на нити
    const Lth = 11, PY = SY;
    const car = new T.Group(); at(car, 0, 0, 0);
    standRod(kit, car, 0, -10, PY + Lth + 1);
    at(box(1, 1, 12.5, C.STEEL), 0, PY + Lth + 1.4, -5.2, car);
    const piv = new T.Group(); at(piv, 0, PY + Lth + 0.9, PZ, car);
    at(cyl(0.1, Lth - 1.2, 0xeeeeee, { edges: false, hull: false, shadow: false }), 0, -(Lth - 1.2) / 2, 0, piv);
    const pb = sphere(kit, 1.2, 0xff8a73); at(pb, 0, -Lth, 0, piv);
    at(sign(true, 1.6), 0, -Lth + 0.4, 1.6, piv);
    // стрелка силы на пробный заряд (оранжевая), длина растёт как логарифм силы
    const arr = new T.Group(); at(arr, 0, -Lth, 0, piv);
    const fl = clamp(3 + 3 * Math.log10(Math.max(1, d.E) / 100), 2, 9);
    const dir = pos ? 1 : -1;
    const sh = cyl(0.4, fl, 0xffb547, { edges: false }); sh.rotation.z = -dir * PI / 2; at(sh, dir * (1.6 + fl / 2), 0, 0, arr);
    const hd = cyl(1.1, 2.2, 0xffb547, { r2: 0, edges: false }); hd.rotation.z = -dir * PI / 2; at(hd, dir * (1.6 + fl + 1.1), 0, 0, arr);
    // ползунок на линейке со стрелками «ближе» / «дальше»
    const sl = new T.Group(); at(sl, 0, 0, RZ);
    at(box(3, 1.6, 6, 0xe0473a), 0, 1.4, 0, sl); at(box(0.4, 0.2, 5.6, 0xffffff, { edges: false }), 0, 2.3, 0, sl);
    const near = new T.Group(); at(near, -4.6, 1.6, 0, sl); clickable(near, 'near');
    const nc = cyl(1.5, 3, 0x3fae5a, { r2: 0 }); nc.rotation.z = PI / 2; at(nc, 0, 0, 0, near);
    const far = new T.Group(); at(far, 4.6, 1.6, 0, sl); clickable(far, 'far');
    const fc = cyl(1.5, 3, 0x3fae5a, { r2: 0 }); fc.rotation.z = -PI / 2; at(fc, 0, 0, 0, far);

    tag(v3(SX, SY + SR + 11, 0), 'Заряженный шар', d.Qtxt);
    const pTag = tag(v3(0, PY + Lth + 4, 0), 'Пробный заряд', d.Etxt, d.ok), rTag = tag(v3(0, 3, RZ + 2), 'Расстояние', d.rtxt);

    // поворот нити: «+» шар отталкивает пробный «+», «−» притягивает; шарик стоит точно на r
    const ang = clamp(3 + 7 * Math.log10(Math.max(1, d.E) / 100), 2, 22) * PI / 180 * (pos ? 1 : -1);
    const bx = SX + d.r * U;
    if (mem.fx === undefined) { mem.fx = bx; mem.fa = ang; }
    kit.onFrame((dt, t) => {
      const k = kit.reduce ? 1e3 : 4;
      mem.fx = ease(mem.fx, bx, dt, k); mem.fa = ease(mem.fa, ang, dt, k);
      const a = mem.fa + (kit.reduce ? 0 : Math.sin(t * 1.7) * 0.012);
      car.position.x = mem.fx - Math.sin(a) * Lth; piv.rotation.z = a; arr.rotation.z = -a;
      sl.position.x = mem.fx;
      pTag.x = car.position.x + OX; rTag.x = mem.fx + OX;
      strips.forEach((s, i) => { s.rotation.x = -(s.userData.base + (kit.reduce ? 0 : Math.sin(t * 3 + i * 1.9) * 0.05)); });
    });
  };
})();
