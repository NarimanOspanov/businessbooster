// «Как в жизни» для темы «Электростатика» (labs/phys-estatic): закон Кулона, поле двух зарядов, плоский конденсатор.
// Сцены строятся из window.LUCH_REAL() опыта; нажатия на детали → window.LUCH_REAL.click(key) → act(key) опыта.
(() => {
  const SC = window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {};
  const POS = 0xe8553f, NEG = 0x3d86d8, GLASS = 0xcfe6f2, EBON = 0x2c3240, ORANGE = 0xffa53a;
  const mem = {};                                  // переживает перестройку сцены: прошлые углы стрелок, кэш холстов

  // ---------- общие детали ----------
  const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function tex(kit, c) { const t = kit.keep(new kit.T.CanvasTexture(c)); t.colorSpace = kit.T.SRGBColorSpace; t.anisotropy = 4; return t; }
  // значок заряда «+» / «−»: кружок с тёмным контуром
  function signCanvas(plus) {
    const k = plus ? 'sgP' : 'sgN'; if (mem[k]) return mem[k];
    const c = canvasOf(64, 64), x = c.getContext('2d');
    x.fillStyle = plus ? '#ff8a73' : '#7fc4ff'; x.strokeStyle = '#1b1610'; x.lineWidth = 5;
    x.beginPath(); x.arc(32, 32, 26, 0, 7); x.fill(); x.stroke();
    x.fillStyle = '#1b1610'; x.fillRect(17, 28.5, 30, 7); if (plus) x.fillRect(28.5, 17, 7, 30);
    return (mem[k] = c);
  }
  function sign(kit, plus, p, s = 2, parent, onTop) {
    const { T } = kit;
    const m = kit.keep(new T.SpriteMaterial({ map: tex(kit, signCanvas(plus)), transparent: true, depthTest: !onTop }));
    const sp = new T.Sprite(m); sp.scale.setScalar(s); if (onTop) sp.renderOrder = 5;
    return kit.at(sp, p.x, p.y, p.z, parent);
  }
  const ball = (kit, r, color, o = {}) => kit.mesh(new kit.T.SphereGeometry(r, 28, 20), color, { hull: true, edges: false, ...o });
  // стрелка-вектор: стержень + наконечник, из точки from по направлению dir
  // front: рисовать поверх прозрачной жидкости (стрелка внутри ванны остаётся яркой)
  function arrow(kit, from, dir, len, color, r = 0.45, parent, front) {
    const { T, cyl, at } = kit, g = new T.Group(), head = Math.min(len * 0.45, r * 5), mo = { edges: false, matOpt: front ? { emissive: color, emissiveIntensity: 0.45, transparent: true, opacity: 1 } : { emissive: color, emissiveIntensity: 0.35 } };
    if (len - head > 0.05) at(cyl(r, len - head, color, mo), 0, (len - head) / 2, 0, g);
    at(cyl(r * 2.6, head, color, { ...mo, r2: 0 }), 0, len - head / 2, 0, g);
    g.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.clone().normalize());
    if (front) g.traverse(o => { o.renderOrder = 4; });
    return at(g, from.x, from.y, from.z, parent);
  }
  // провод по своим точкам (без огоньков тока)
  function wire(kit, pts, color, r = 0.6) {
    const { T } = kit, curve = new T.CatmullRomCurve3(pts, false, 'centripetal');
    const m = kit.mesh(new T.TubeGeometry(curve, Math.max(24, Math.round(curve.getLength() * 1.2)), r, 8), color, { hull: true, edges: false });
    kit.root.add(m); return curve;
  }
  // клеммы-«кнопки» со стрелкой (на тележке, у пробного шарика)
  function knob(kit, p, dir, key, color = 0x3b6fd8) {
    const { T } = kit, g = new T.Group();
    arrow(kit, new T.Vector3(0, 0, 0), dir, 3.2, color, 0.55, g);
    kit.at(g, p.x, p.y, p.z); kit.clickable(g, key);
    return g;
  }
  // бегущие штрихи по светящейся линии (поле): своя текстура, сдвигаем в onFrame
  function dashCanvas() {
    if (mem.dash) return mem.dash;
    const c = canvasOf(64, 8), x = c.getContext('2d');
    x.fillStyle = 'rgba(255,209,102,.35)'; x.fillRect(0, 0, 64, 8); x.fillStyle = '#fff1b8'; x.fillRect(6, 0, 22, 8);
    return (mem.dash = c);
  }
  function glowLine(kit, pts, r, flows) {
    const { T } = kit, curve = new T.CatmullRomCurve3(pts, false, 'centripetal'), L = curve.getLength();
    const t = tex(kit, dashCanvas()); t.wrapS = T.RepeatWrapping; t.repeat.set(Math.max(1, L / 7), 1);
    const m = new T.Mesh(kit.keep(new T.TubeGeometry(curve, Math.max(16, Math.round(L * 1.5)), r, 6)),
      kit.keep(new T.MeshBasicMaterial({ map: t, color: 0xffd166, transparent: true, opacity: 0.9, depthWrite: false })));
    m.renderOrder = 3; kit.root.add(m); flows.push(t);
    return curve;
  }
  // стрелочный электрометр: корпус-барабан со стеклом, шкала, стрелка, клемма сверху; стрелка качается к новому положению
  function dialCanvas(signed, max, txt) {
    const c = canvasOf(256, 256), x = c.getContext('2d');
    x.fillStyle = '#f7f3ea'; x.beginPath(); x.arc(128, 128, 126, 0, 7); x.fill();
    const cx = 128, cy = 150, r = 100, a0 = -Math.PI / 2 - 1.05, a1 = -Math.PI / 2 + 1.05;
    x.strokeStyle = '#1b1610'; x.lineWidth = 3; x.beginPath(); x.arc(cx, cy, r, a0, a1); x.stroke();
    for (let k = 0; k <= 10; k++) {
      const a = a0 + (a1 - a0) * k / 10, l = k % 5 ? 10 : 20;
      x.lineWidth = k % 5 ? 2 : 4; x.beginPath(); x.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); x.lineTo(cx + Math.cos(a) * (r - l), cy + Math.sin(a) * (r - l)); x.stroke();
    }
    x.fillStyle = '#1b1610'; x.font = '700 22px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const lab = signed ? ['−', '0', '+'] : ['0', String(max / 2), String(max)];
    [0, 5, 10].forEach((k, i) => { const a = a0 + (a1 - a0) * k / 10; x.fillText(lab[i], cx + Math.cos(a) * (r - 36), cy + Math.sin(a) * (r - 36)); });
    if (signed) { x.fillStyle = 'rgba(61,134,216,.25)'; x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, r - 2, a0, -Math.PI / 2); x.fill(); x.fillStyle = 'rgba(232,85,63,.22)'; x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, r - 2, -Math.PI / 2, a1); x.fill(); }
    x.fillStyle = '#1b1610'; x.font = '600 20px "Golos Text", sans-serif'; x.fillText(txt, cx, cy + 46);
    return c;
  }
  function electrometer(kit, at3, o) {
    const { T, at, cyl, box, C } = kit, g = new T.Group();
    at(box(14, 2, 10, C.WOOD2), 0, 1, 0, g);                         // подставка
    at(cyl(1.2, 5, EBON), 0, 4.5, 0, g);
    const body = cyl(8, 5, 0x9aa3b2, { seg: 40 }); body.rotation.x = Math.PI / 2; at(body, 0, 15, 0, g);
    at(kit.mesh(new T.TorusGeometry(7.75, 0.55, 8, 40), C.BRASS, { hull: false, edges: false }), 0, 15, 2.6, g);
    const face = new T.Mesh(kit.keep(new T.CircleGeometry(7.3, 40)), kit.keep(new T.MeshBasicMaterial({ map: tex(kit, dialCanvas(o.signed, o.max || 100, o.unit)) })));
    at(face, 0, 15, 2.56, g);
    // стрелка: ось чуть ниже центра (как на шкале), поворот вокруг z
    const piv = new T.Group(); at(piv, 0, 15 - 7.3 * 22 / 128, 2.9, g);
    at(box(0.35, 6.2, 0.2, 0xc0392b, { edges: false }), 0, 3.1, 0, piv);
    at(cyl(0.6, 0.4, EBON, { edges: false }), 0, 0, 0.1, piv).rotation.x = Math.PI / 2;
    const glass = new T.Mesh(kit.keep(new T.CircleGeometry(7.6, 40)), kit.keep(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false })));
    at(glass, 0, 15, 3.2, g);
    // клемма-стержень с шариком сверху и клемма корпуса сбоку
    at(cyl(0.5, 4, C.STEEL, { edges: false }), 0, 25, 0, g); at(ball(kit, 1.1, C.STEEL), 0, 27.6, 0, g);
    at(cyl(1, 2, 0x26324a), 6.5, 2.8, 3, g);
    if (o.click) kit.clickable(g, o.click);
    at(g, at3.x, 0, at3.z); g.rotation.y = o.rotY || 0; g.updateMatrixWorld(true);
    // стрелка: плавно, с лёгким перелётом, от прошлого положения к новому
    const target = Math.max(-1.08, Math.min(1.08, o.f)) * 1.05, key = 'ang' + o.id;
    let a = mem[key] ?? 0, v = 0;
    piv.rotation.z = -a;
    if (kit.reduce) { a = target; piv.rotation.z = -a; mem[key] = a; }
    else kit.onFrame(dt => { v += ((target - a) * 60 - v * 7) * dt; a += v * dt; piv.rotation.z = -a; mem[key] = a; });
    return { g, top: new T.Vector3(0, 27.6, 0).applyMatrix4(g.matrixWorld), gnd: new T.Vector3(6.5, 3.8, 3).applyMatrix4(g.matrixWorld) };
  }
  // табло датчика: значение и подпись в две строки
  function lcdCanvas(big, small, col) {
    const c = canvasOf(320, 150), x = c.getContext('2d');
    x.fillStyle = '#0e1520'; x.fillRect(0, 0, 320, 150);
    x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle';
    let fs = 60; x.font = `600 ${fs}px "IBM Plex Mono", monospace`; const w = x.measureText(big).width; if (w > 290) { fs = Math.floor(fs * 290 / w); x.font = `600 ${fs}px "IBM Plex Mono", monospace`; }
    x.fillText(big, 160, 58); x.font = '500 28px "Golos Text", sans-serif'; x.fillStyle = '#9fb0c8'; x.fillText(small, 160, 118);
    return c;
  }
  // линейка: холст с делениями (см или мм)
  function rulerCanvas(n, every, label) {
    const k = 'rul' + n + every; if (mem[k]) return mem[k];
    const c = canvasOf(1024, 72), x = c.getContext('2d');
    x.fillStyle = '#f1e3c2'; x.fillRect(0, 0, 1024, 72); x.strokeStyle = '#3a2e22'; x.fillStyle = '#3a2e22';
    x.font = '600 22px "IBM Plex Mono", monospace'; x.textAlign = 'center';
    for (let i = 0; i <= n; i++) {
      const px = 12 + (1000 * i) / n, big = i % every === 0;
      x.lineWidth = big ? 3 : 1.5; x.beginPath(); x.moveTo(px, 0); x.lineTo(px, big ? 30 : 16); x.stroke();
      if (big) x.fillText(String(i), px, 56);
    }
    x.font = '600 18px "Golos Text", sans-serif'; x.textAlign = 'right'; x.fillText(label, 1018, 64);
    return (mem[k] = c);
  }
  function ruler(kit, x0, len, z, y, n, every, label, w = 4) {
    const { T } = kit, full = len * 1024 / 1000;
    const pl = new T.Mesh(kit.keep(new T.PlaneGeometry(full, w)), kit.keep(new T.MeshBasicMaterial({ map: tex(kit, rulerCanvas(n, every, label)) })));
    pl.rotation.x = -Math.PI / 2; kit.at(pl, x0 - len * 12 / 1000 + full / 2, y, z);
    return pl;
  }

  // ===================== Урок 1. Закон Кулона =====================
  // Длинная стеклянная ванна, по дну — рейка с сантиметровой линейкой. Левый шар на изолирующей стойке закреплён,
  // правый — на тележке с датчиком силы; кабель от датчика к табло перед ванной. Ванна пустая (вакуум, насос) или
  // с керосином/водой. Оранжевые стрелки — силы F₁₂ и F₂₁ (равны и противоположны).
  SC['estatic-coul'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, v3, C } = kit;
    const X0 = -42, PPC = 1.7, H = 15, RB = 3.3, ZR = -4, x2 = X0 + d.r * PPC;
    // ванна: стекло, рамка-уголок, дно
    const tx0 = -55, tx1 = 51, tz0 = -15, tz1 = 7, TH = 25, tcx = (tx0 + tx1) / 2, tcz = (tz0 + tz1) / 2, TW = tx1 - tx0, TD = tz1 - tz0;
    at(box(TW, 1, TD, 0x7d8899), tcx, 0.5, tcz);
    const glass = kit.mesh(new T.BoxGeometry(TW - 0.4, TH, TD - 0.4), 0, { mat: kit.toon(GLASS, { transparent: true, opacity: 0.16, depthWrite: false }), shadow: false });
    at(glass, tcx, 1 + TH / 2, tcz);
    const frame = new T.Group(); at(frame, 0, 0, 0);
    for (const [x, z] of [[tx0, tz0], [tx1, tz0], [tx0, tz1], [tx1, tz1]]) at(box(1, TH, 1, 0x56607a), x, 1 + TH / 2, z, frame);
    for (const z of [tz0, tz1]) at(box(TW, 1, 1, 0x56607a), tcx, 1 + TH, z, frame);
    for (const x of [tx0, tx1]) at(box(1, 1, TD, 0x56607a), x, 1 + TH, tcz, frame);
    at(box(TW, 1.6, 1, 0x56607a), tcx, 1.8, tz1, frame);
    // табличка «среда» на передней раме
    const plq = new T.Mesh(kit.keep(new T.PlaneGeometry(22, 4.4)), kit.keep(new T.MeshBasicMaterial({ map: kit.keep(kit.textTex('Среда: ' + d.medName, '#1b1610', '#ffd166', 400, 80)) })));
    at(plq, -34, 2.3, tz1 + 0.56, frame);
    clickable(frame, 'med');
    // жидкость
    if (d.med !== 'vac') {
      const col = d.med === 'ker' ? 0xf2cf6a : 0x5fb4e8, LH = 21;
      const liq = kit.mesh(new T.BoxGeometry(TW - 0.8, LH, TD - 0.8), 0, { mat: kit.toon(col, { transparent: true, opacity: d.med === 'ker' ? 0.2 : 0.22, depthWrite: false }), shadow: false, edges: false });
      at(liq, tcx, 1 + LH / 2, tcz); liq.renderOrder = 1;
      const surf = new T.Mesh(kit.keep(new T.PlaneGeometry(TW - 0.8, TD - 0.8)), kit.keep(new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, depthWrite: false })));
      surf.rotation.x = -Math.PI / 2; at(surf, tcx, 1 + LH + 0.02, tcz); surf.renderOrder = 2;
      if (!kit.reduce) kit.onFrame((dt, t) => { surf.position.y = 1 + LH + 0.02 + Math.sin(t * 1.6) * 0.12; });
    } else {
      // вакуум: стеклянная крышка и шланг к насосу за ванной
      at(kit.mesh(new T.BoxGeometry(TW + 1, 0.8, TD + 1), 0, { mat: kit.toon(GLASS, { transparent: true, opacity: 0.3, depthWrite: false }), shadow: false }), tcx, 1.4 + TH, tcz);
      at(cyl(1.4, 2, C.STEEL), 30, 2.8 + TH, -6);
      const pump = new T.Group(); at(pump, 36, 0, -30);
      at(box(14, 9, 9, 0x3b6fd8), 0, 4.5, 0, pump); at(cyl(3, 8, 0x2c3240), -2, 13, 0, pump);
      at(box(4, 2, 4, 0x2c3240), 4.5, 10, 0, pump);
      const fan = cyl(2.6, 0.6, C.STEEL, { seg: 6 }); fan.rotation.x = Math.PI / 2; at(fan, 3, 5, 4.8, pump);
      if (!kit.reduce) kit.onFrame(dt => { fan.rotation.y += dt * 9; });
      wire(kit, [v3(30, 3.8 + TH, -6), v3(30, 9 + TH, -10), v3(34, 14, -26), v3(34, 17.2, -30)], 0x30343c, 0.9);
    }
    // рейка с линейкой (0 — центр левого шара)
    at(box(100, 1.4, 7, 0x3a3f4c), -2, 1.7, ZR);
    ruler(kit, X0, 50 * PPC, ZR + 1.6, 2.42, 50, 5, 'см', 3.6);
    // стойка: основание, изолирующий стеклянный столбик, шар; знак заряда поверх шара
    const stand = (x, q, key, base) => {
      const g = new T.Group(); at(g, x, 0, ZR);
      if (base) at(cyl(3, 1.2, EBON), 0, 3, 0, g);
      at(cyl(0.85, H - RB - 3.4, GLASS), 0, 3.4 + (H - RB - 3.4) / 2, 0, g);
      at(cyl(1.1, 0.8, C.BRASS), 0, H - RB - 0.2, 0, g);
      const col = new T.Color(C.STEEL).lerp(new T.Color(q > 0 ? POS : NEG), 0.55).getHex();
      at(ball(kit, RB, col), 0, H, 0, g);
      sign(kit, q > 0, v3(0, H, 0), 3.4, g, true);
      clickable(g, key); return g;
    };
    stand(X0, d.q1, 'b1', true);
    // тележка с датчиком силы и стрелками «ближе / дальше»
    const cart = new T.Group(); at(cart, x2, 0, ZR);
    at(box(8, 2.6, 7, 0x3b6fd8), 0, 3.7, 0, cart); at(box(0.5, 0.2, 7.2, 0xe0473a, { edges: false }), 0, 2.5, 0.2, cart);
    at(box(4.4, 2.4, 4.4, 0xe6c14a), 0, 6.2, 0, cart);
    stand(x2, d.q2, 'q2s', false);
    knob(kit, v3(x2 - 5.2, 3.7, ZR + 2), v3(-1, 0, 0), 'near');
    knob(kit, v3(x2 + 5.2, 3.7, ZR + 2), v3(1, 0, 0), 'far');
    // силы
    const Fa = Math.abs(d.F);
    if (Fa > 1e-6) {
      const len = Math.max(3, Math.min(16, 6 + 5 * Math.log10(Fa / 0.05))), s = d.F > 0 ? 1 : -1;
      const a2 = arrow(kit, v3(x2 + s * (RB + 0.4), H, ZR), v3(s, 0, 0), len, ORANGE, 0.6, null, true);
      const a1 = arrow(kit, v3(X0 - s * (RB + 0.4), H, ZR), v3(-s, 0, 0), len, ORANGE, 0.6, null, true);
      if (!kit.reduce) kit.onFrame((dt, t) => { const k = 1 + 0.08 * Math.sin(t * 4); a1.scale.set(1, k, 1); a2.scale.set(1, k, 1); });
    }
    // табло датчика силы перед ванной + кабель через борт
    const disp = new T.Group(); at(disp, -32, 0, 34); disp.rotation.y = 0.35;
    at(box(24, 14, 9, 0xe8ecf4), 0, 7, 0, disp); at(box(24, 1, 10, 0x9aa3b2), 0, 0.5, 0, disp);
    const scr = new T.Mesh(kit.keep(new T.PlaneGeometry(20, 9.4)), kit.keep(new T.MeshBasicMaterial({ map: tex(kit, lcdCanvas(Fa > 1e-6 ? d.Ftxt : '0 Н', Fa < 1e-6 ? 'сил нет' : d.F > 0 ? 'отталкиваются' : 'притягиваются', '#86e0a8')) })));
    at(scr, 0, 7.6, 4.55, disp);
    disp.updateMatrixWorld(true);
    const dIn = v3(8, 11, -4.5).applyMatrix4(disp.matrixWorld);
    // кабель датчика: по дну ванны вдоль рейки, вверх по левой стенке, через борт и к табло
    wire(kit, [v3(x2, 3.4, ZR + 3.6), v3(x2 - 3, 1.6, ZR + 5.6), v3(Math.max(tx0 + 6, x2 - 12), 1.6, ZR + 6), v3(tx0 + 2.5, 1.8, ZR + 6), v3(tx0 + 1.6, TH, ZR + 6), v3(tx0, TH + 3, ZR + 6), v3(tx0 - 2.5, TH - 2, ZR + 7), v3(tx0 - 3, 4, ZR + 10), v3(dIn.x - 6, 1.2, dIn.z - 10), dIn.clone().add(v3(0, 2, -3)), dIn], 0x2c3240, 0.55);
    // подписи
    const sq = q => (q > 0 ? '+' : '−') + String(Math.abs(q)).replace('.', ',') + ' мкКл';
    tag(v3(X0, H + 6, ZR), 'Шар q₁', sq(d.q1));
    tag(v3(x2, H + 6, ZR), 'Шар q₂', sq(d.q2));
    tag(v3((X0 + x2) / 2, 3, tz1 + 3), 'r', d.rtxt);
    tag(v3(14, TH + 4, tz0), d.medName, 'ε = ' + d.eps);
    tag(v3(-32, 17, 34), 'Датчик силы', Fa > 1e-6 ? d.Ftxt : '0 Н', d.F < 0 && d.med === 'ker' && Math.abs(Fa - 0.4) <= 0.012);
  };

  // ===================== Урок 2. Напряжённость и потенциал =====================
  // Планшет с «картой потенциала» (тёплое — φ > 0, холодное — φ < 0, пунктир — эквипотенциали), две заряженные сферы
  // на изолирующих стойках, светящиеся силовые линии в плоскости центров, пробный шарик на ручке со стрелками
  // E₁, E₂ и E, электрометр показывает потенциал шарика.
  const S2 = 0.2, HY = 12, SR = 3.4;                       // 1 px схемы = 0,2 ед.; высота центров; радиус сфер
  const wx = sx => (sx - 260) * S2, wz = sy => (sy - 270) * S2;
  function srcs(d) { return [{ x: 170, y: 270, q: d.qm }, { x: 350, y: 270, q: d.pair === 'same' ? d.qm : -d.qm }]; }
  function fieldAt(ss, x, y) {
    let ex = 0, ey = 0, phi = 0;
    for (const s of ss) { const dx = x - s.x, dy = y - s.y, du = Math.hypot(dx, dy) || 1e-6, r = du / 1000, Em = 9 * s.q / (r * r); ex += Em * dx / du; ey += Em * dy / du; phi += 9 * s.q / r; }
    return { ex, ey, E: Math.hypot(ex, ey), phi };
  }
  function heatCanvas(d) {
    const key = 'heat' + d.pair + d.qm; if (mem[key]) return mem[key];
    const W = 448, Hh = 248, c = canvasOf(W, Hh), x = c.getContext('2d'), ss = srcs(d);
    x.fillStyle = '#26324a'; x.fillRect(0, 0, W, Hh);
    const sx = i => -20 + (i + 0.5) * 560 / W, sy = j => 115 + (j + 0.5) * 310 / Hh, step = 40 * d.qm / 2, lvl = new Array(W * Hh);
    const img = x.getImageData(0, 0, W, Hh), px = img.data;
    for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
      const f = fieldAt(ss, sx(i), sy(j)), a = 0.7 * Math.tanh(Math.abs(f.phi) / (130 * d.qm)), o = (j * W + i) * 4;
      const tc = f.phi >= 0 ? [255, 120, 95] : [90, 165, 255];
      for (let k = 0; k < 3; k++) px[o + k] = px[o + k] * (1 - a) + tc[k] * a;
      lvl[j * W + i] = Math.abs(f.phi) > 9 * step ? null : Math.floor(f.phi / step + 0.5);
    }
    for (let j = 0; j < Hh - 1; j++) for (let i = 0; i < W - 1; i++) {
      const v = lvl[j * W + i]; if (v === null) continue;
      const r = lvl[j * W + i + 1], dn = lvl[(j + 1) * W + i];
      if (((r !== null && r !== v) || (dn !== null && dn !== v)) && ((i + j) % 4 < 2)) { const o = (j * W + i) * 4; px[o] = 226; px[o + 1] = 232; px[o + 2] = 242; }
    }
    x.putImageData(img, 0, 0);
    x.strokeStyle = 'rgba(232,236,244,.35)'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, W - 3, Hh - 3);
    return (mem[key] = c);
  }
  function fieldLines(d) {
    const key = 'lines' + d.pair + d.qm; if (mem[key]) return mem[key];
    const ss = srcs(d), out = [];
    const inside = (x, y) => x > -16 && x < 536 && y > 120 && y < 420;
    for (const s of ss) {
      if (s.q < 0) continue;
      const n = d.pair === 'same' ? 14 : 18;
      for (let k = 0; k < n; k++) {
        const a = (k + 0.5) / n * Math.PI * 2;
        let x = s.x + Math.cos(a) * 16, y = s.y + Math.sin(a) * 16; const pts = [[x, y]];
        for (let i = 0; i < 500; i++) {
          const f = fieldAt(ss, x, y); if (f.E < 1e-9) break;
          x += f.ex / f.E * 3; y += f.ey / f.E * 3;
          if (!inside(x, y)) break;
          if (ss.some(o => o !== s && Math.hypot(x - o.x, y - o.y) < 15)) { pts.push([x, y]); break; }
          if (i % 3 === 2) pts.push([x, y]);
        }
        if (pts.length > 3) out.push(pts);
      }
    }
    return (mem[key] = out);
  }
  SC['estatic-field'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, v3, C } = kit;
    const ss = srcs(d);
    // планшет с картой потенциала
    at(box(114, 1, 64, C.WOOD2), 0, 0.5, 0);
    const map = new T.Mesh(kit.keep(new T.PlaneGeometry(112, 62)), kit.keep(new T.MeshBasicMaterial({ map: tex(kit, heatCanvas(d)) })));
    map.rotation.x = -Math.PI / 2; at(map, 0, 1.03, 0);
    // сферы на стойках
    ss.forEach((s, i) => {
      const g = new T.Group(); at(g, wx(s.x), 1, wz(s.y));
      at(cyl(3.2, 1.2, EBON), 0, 0.6, 0, g);
      at(cyl(0.7, HY - SR - 1, GLASS), 0, 1 + (HY - SR - 1) / 2, 0, g);
      const col = new T.Color(C.STEEL).lerp(new T.Color(s.q > 0 ? POS : NEG), 0.6).getHex();
      at(ball(kit, SR, col), 0, HY - 1, 0, g);
      sign(kit, s.q > 0, v3(0, HY - 1, 0), 3, g, true);
      clickable(g, 'src');
    });
    // силовые линии: бегут от «+» к «−» (или наружу)
    const flows = [];
    for (const L of fieldLines(d)) glowLine(kit, L.map(([x, y]) => v3(wx(x), 1 + HY - 1, wz(y))), 0.3, flows);
    if (!kit.reduce) kit.onFrame(dt => { for (const t of flows) t.offset.x -= dt * 0.9; });
    // пробный шарик на ручке
    const xp = wx(d.px), zp = wz(d.py), yb = HY;
    const pg = new T.Group(); at(pg, xp, 1, zp);
    at(cyl(2.6, 1, EBON), 0, 0.5, 0, pg); at(cyl(0.45, yb - 2, 0xe0473a), 0, 1 + (yb - 2) / 2, 0, pg);
    at(ball(kit, 1.5, 0xf2f5fa), 0, yb - 1 + 0.4, 0, pg);
    const halo = new T.Sprite(kit.keep(new T.SpriteMaterial({ map: kit.glowTex(), color: 0xffffff, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.5 })));
    halo.scale.setScalar(6); at(halo, 0, yb - 0.6, 0, pg);
    if (!kit.reduce) kit.onFrame((dt, t) => { halo.material.opacity = 0.35 + 0.25 * Math.sin(t * 3); });
    knob(kit, v3(xp - 4.4, 2, zp), v3(-1, 0, 0), 'mvL', 0x56607a); knob(kit, v3(xp + 4.4, 2, zp), v3(1, 0, 0), 'mvR', 0x56607a);
    knob(kit, v3(xp, 2, zp - 4.4), v3(0, 0, -1), 'mvU', 0x56607a); knob(kit, v3(xp, 2, zp + 4.4), v3(0, 0, 1), 'mvD', 0x56607a);
    // векторы в точке шарика: E₁ и E₂ тонкие, E — толстая оранжевая
    const P = v3(xp, yb + 0.4, zp), L0 = E => Math.max(2.5, Math.min(16, (14 + 20 * Math.log10(Math.max(E, 1) / 100)) * S2 * 1.2));
    [[d.E1, ss[0].q], [d.E2, ss[1].q]].forEach(([e, q]) => { const E = Math.hypot(e[0], e[1]); if (E >= 1) arrow(kit, P, v3(e[0], 0, e[1]), L0(E), q > 0 ? POS : NEG, 0.28); });
    const ex = d.E1[0] + d.E2[0], ey = d.E1[1] + d.E2[1], E = Math.hypot(ex, ey);
    if (E >= 1) { const a = arrow(kit, P, v3(ex, 0, ey), L0(E), ORANGE, 0.55); if (!kit.reduce) kit.onFrame((dt, t) => { a.scale.setScalar(1 + 0.06 * Math.sin(t * 4)); }); }
    // электрометр: потенциал шарика относительно «земли»
    const em = electrometer(kit, v3(-42, 0, 41), { signed: true, f: Math.tanh(d.phi / (450 * d.qm)), unit: 'φ, В', id: 'f', rotY: 0.35 });
    // провод электрометра: вниз к переднему краю планшета и по нему к ручке шарика
    wire(kit, [em.top, em.top.clone().add(v3(4, 3, -2)), v3(em.top.x + 10, 4, 36), v3((em.top.x + xp) / 2 + 4, 1.6, 33.5), v3(xp, 1.4, Math.min(33, zp + 8)), v3(xp, 1.4, zp + 3.4), v3(xp, 2.6, zp + 0.6)], 0x30343c, 0.35);
    wire(kit, [em.gnd, em.gnd.clone().add(v3(3, 0, 2)), v3(-26, 0.8, 47), v3(-14, 0.8, 47)], 0x3fae5a, 0.45);
    at(box(3, 1.4, 3, 0x3fae5a), -12.6, 0.7, 47);
    // подписи
    const qs = q => (q > 0 ? '+' : '−') + String(Math.abs(q)).replace('.', ',') + ' нКл';
    tag(v3(wx(ss[0].x), HY + 5, wz(ss[0].y)), 'q₁', qs(ss[0].q));
    tag(v3(wx(ss[1].x), HY + 5, wz(ss[1].y)), 'q₂', qs(ss[1].q));
    tag(v3(xp, yb + 4.5, zp), 'Пробный шарик', 'E = ' + d.Etxt, d.pair === 'same' ? d.fe : d.fp);
    tag(v3(-42, 31, 41), 'Электрометр', 'φ = ' + d.phitxt);
  };

  // ===================== Урок 3. Конденсаторы =====================
  // Разборный конденсатор: два диска на изолирующих стойках, правый — на тележке по рейке с миллиметровой линейкой.
  // Источник 12 В через рубильник, электрометр на пластинах, диэлектрики (парафин, слюда) лежат рядом или стоят в зазоре,
  // разрядник на ручке. Знаки «+/−» на пластинах — по заряду, светящиеся линии поля бегут от «+» к «−».
  SC['estatic-cap'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, v3, C, placeOn } = kit;
    const ZR = -6, XL = -16, G = d.d * 2.2, XR = XL + G, R = Math.sqrt(d.Sa / Math.PI) * 2.0, HC = R + 9;
    // рейка с линейкой в мм (0 — левая пластина)
    at(box(44, 1.6, 6, 0x3a3f4c), XL + 14, 0.8, ZR);
    ruler(kit, XL, 12 * 2.2, ZR + 1.3, 1.62, 12, 2, 'мм', 3.2);
    const plate = (x, cart, key) => {
      const g = new T.Group(); at(g, x, 0, ZR);
      if (cart) { at(box(6, 2.4, 7, 0x3b6fd8), 0, 2.8, 0, g); at(box(0.5, 0.2, 7.2, 0xe0473a, { edges: false }), 0, 1.7, 0.2, g); }
      else at(box(5, 2.4, 7, EBON), 0, 2.8, 0, g);
      at(cyl(0.8, HC - R - 4, GLASS), 0, 4 + (HC - R - 4) / 2, 0, g);
      const disc = cyl(R, 0.9, 0xc6ccd6, { seg: 48 }); disc.rotation.z = Math.PI / 2; at(disc, 0, HC, 0, g);
      const rim = kit.mesh(new T.TorusGeometry(R, 0.35, 8, 48), C.BRASS, { hull: false, edges: false }); rim.rotation.y = Math.PI / 2; at(rim, 0, HC, 0, g);
      at(cyl(0.9, 2, C.BRASS), 0, HC + R + 1, 0, g);                 // клемма сверху
      if (key) clickable(g, key);
      return v3(x, HC + R + 2, ZR);
    };
    const tL = plate(XL, false), tR = plate(XR, true);
    knob(kit, v3(XR - 1, 2.8, ZR + 5.2), v3(-1, 0, 0), 'd-'); knob(kit, v3(XR + 1, 2.8, ZR + 5.2), v3(1, 0, 0), 'd+');
    // диэлектрик: в зазоре, если выбран; остальные лежат на столе — нажмите, чтобы сменить
    const DCOL = { par: 0xf3ecd2, mic: 0xc9925a };
    if (d.diel !== 'air') {
      const s = kit.mesh(new T.BoxGeometry(Math.max(0.6, G - 0.9), R * 1.7, R * 1.7), 0, { mat: kit.toon(DCOL[d.diel], { transparent: true, opacity: d.diel === 'mic' ? 0.6 : 0.78, depthWrite: false }) });
      at(s, (XL + XR) / 2, HC, ZR); clickable(s, 'diel');
      at(box(Math.max(0.6, G - 0.9), 2.2, 3, 0x8b5a2b), (XL + XR) / 2, HC + R * 0.85 + 1.1, ZR); // ручка
    }
    const shelf = new T.Group(); at(shelf, -8, 0, 24);
    let sx = -8;
    for (const k of ['par', 'mic']) {
      if (k === d.diel) continue;
      const sl = kit.mesh(new T.BoxGeometry(14, 1.2, 14), 0, { mat: kit.toon(DCOL[k], { transparent: true, opacity: 0.88 }) });
      at(sl, sx, 0.6, 0, shelf); sx += 17;
    }
    clickable(shelf, 'diel');
    // знаки заряда на пластинах
    const qn = d.q, nq = qn > 0 ? Math.max(1, Math.min(18, Math.round(4 * Math.sqrt(qn / 0.25)))) : 0;
    const signs = [];
    for (let i = 0; i < nq; i++) {
      const a = i / nq * Math.PI * 2 + 0.3, rr = R * (i % 2 ? 0.45 : 0.75);
      const y = HC + Math.sin(a) * rr, z = ZR + Math.cos(a) * rr;
      signs.push(sign(kit, true, v3(XR + 0.9, y, z), 2.1), sign(kit, false, v3(XL + 0.9, y, z), 2.1));
    }
    if (nq && !kit.reduce && mem.capQ !== qn) { let t0 = 0; signs.forEach(s => s.scale.setScalar(0.01)); kit.onFrame(dt => { t0 = Math.min(1, t0 + dt * 2.2); const k = 2.1 * (1 - Math.pow(1 - t0, 3)); signs.forEach(s => s.scale.setScalar(Math.max(0.01, k))); }); }
    mem.capQ = qn;
    // поле внутри: однородные линии от «+» (правая) к «−» (левая)
    if (d.U > 0.01 && G > 2.5) {
      const n = Math.max(1, Math.min(16, Math.round(d.E / 1000))), flows = [], cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
      for (let i = 0; i < n; i++) {
        const cx = (i % cols + 0.5) / cols - 0.5, cy = (Math.floor(i / cols) + 0.5) / rows - 0.5;
        const y = HC + cy * R * 1.2, z = ZR + cx * R * 1.2;
        glowLine(kit, [v3(XR - 0.6, y, z), v3((XL + XR) / 2, y, z), v3(XL + 0.6, y, z)], 0.2, flows);
      }
      if (!kit.reduce) kit.onFrame(dt => { for (const t of flows) t.offset.x -= dt * 0.8; });
    }
    // источник и рубильник
    const src = kit.supply(12); const sN = placeOn(src, v3(40, 0, -26), 0, 'src');
    const kn = kit.knife({ closed: d.conn, click: 'key' }); const kN = placeOn(kn, v3(42, 0, 4), Math.PI / 2, 'key');
    wire(kit, [sN.tin, sN.tin.clone().add(v3(0, 4, 0)), v3(20, 4, -24), v3(XL, HC + R + 8, ZR - 6), tL.clone().add(v3(0, 3, 0)), tL], kit.C.WIRE.minus, 0.9);
    kit.cable(sN.tout, kN.tout, kit.C.WIRE.plus, 0, { lift: 4 });
    wire(kit, [kN.tin, kN.tin.clone().add(v3(0, 4, 0)), v3(30, 8, 10), v3(XR + 6, HC + R + 8, ZR + 2), tR.clone().add(v3(0, 3, 0)), tR], kit.C.WIRE.plus, 0.9);
    // электрометр на пластинах: стержень — к «+», корпус — к «−»
    const em = electrometer(kit, v3(-38, 0, 22), { signed: false, max: 100, f: Math.min(d.U, 104) / 100 * 2 - 1, unit: 'U, В', id: 'c', rotY: 0.45 });
    wire(kit, [em.top, em.top.clone().add(v3(2, 5, -3)), v3((em.top.x + tR.x) / 2, Math.max(em.top.y, tR.y) + 6, (em.top.z + tR.z) / 2), tR.clone().add(v3(0, 3, 0)), tR], 0xe0473a, 0.45);
    wire(kit, [em.gnd, em.gnd.clone().add(v3(2, -2, 0)), v3(-26, 0.8, 8), v3(XL - 4, 0.8, ZR + 5), v3(XL - 2.5, 1.6, ZR + 3.6)], 0x2a2f3a, 0.45);
    // разрядник: две ручки из эбонита и латунная дуга с шариками
    const dg = new T.Group(); at(dg, 18, 0, 32); dg.rotation.y = -0.3;
    const arc = kit.mesh(new T.TorusGeometry(6, 0.4, 8, 32, Math.PI), C.BRASS, { hull: true, edges: false }); arc.rotation.x = -Math.PI / 2; at(arc, 0, 1.2, 0, dg);
    at(ball(kit, 1.2, C.BRASS), 6, 1.2, 0, dg); at(ball(kit, 1.2, C.BRASS), -6, 1.2, 0, dg);
    const h = cyl(0.9, 9, EBON); h.rotation.x = Math.PI / 2; at(h, 0, 1.2, 9.5, dg);
    clickable(dg, 'dis');
    // подписи
    tag(v3(40, 24, -26), 'Источник', '12 В');
    tag(v3(42, 12, 4), 'Ключ', d.conn ? 'замкнут' : 'разомкнут', d.conn);
    tag(v3(XL - 4, HC + R + 6, ZR), 'Конденсатор', d.Ctxt + ' · ' + d.qtxt);
    tag(v3((XL + XR) / 2, HC - R - 1.5, ZR + R * 0.6), d.diel === 'air' ? 'Воздух' : d.dielName + ' · ε = ' + d.eps, 'd = ' + d.dtxt);
    tag(v3(-38, 31, 22), 'Электрометр', 'U = ' + d.Utxt, !d.conn && d.q > 0 && Math.abs(d.U - 36) <= 0.72);
    tag(v3(18, 5, 32), 'Разрядник');
  };
})();
