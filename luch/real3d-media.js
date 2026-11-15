// «Как в жизни» для темы «Ток в разных средах» (labs/phys-media): проволока над спиртовкой,
// модель кристалла с p–n-переходом, ванна с медным купоросом, газоразрядная трубка с насосом.
// Сцены строятся из window.LUCH_REAL() опыта; нажатия уходят в window.LUCH_REAL.click(key).
(() => {
  const SC = window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {};
  const live = () => { try { return window.LUCH_REAL.live ? window.LUCH_REAL.live() : null; } catch (e) { return null; } };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (x, n) => (Math.round(x * 10 ** n) / 10 ** n).toFixed(n).replace('.', ',');
  // детерминированный «случай»: сцена перестраивается, а точки должны стоять на тех же местах
  const rnd = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

  // ---------- общие детали ----------
  function H(kit) {
    const { T, at, box, cyl, keep, grad, glowTex, textTex, clickable, C } = kit;
    const glassMat = (color = 0xcfe6f2, opacity = 0.26) => new T.MeshToonMaterial({ color, gradientMap: grad, transparent: true, opacity, side: T.DoubleSide, depthWrite: false });
    const glow = (color, size, opacity) => {
      const s = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity }));
      s.scale.setScalar(size); return s;
    };
    const flat = (w, h, tex) => new T.Mesh(keep(new T.PlaneGeometry(w, h)), new T.MeshBasicMaterial({ map: keep(tex), transparent: true }));
    // табло, текст которого можно менять в onFrame
    function screen(w, h, txt, fg = '#86e0a8', pw = 300, ph = 120) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph; const x = c.getContext('2d');
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace;
      let cur = null;
      const set = (t, col = fg) => {
        if (cur === t + col) return; cur = t + col;
        x.fillStyle = '#0e1520'; x.fillRect(0, 0, pw, ph); x.fillStyle = col;
        let fs = Math.round(ph * 0.6); x.font = `600 ${fs}px "IBM Plex Mono", monospace`;
        const tw = x.measureText(t).width; if (tw > pw * 0.88) { fs = Math.floor(fs * pw * 0.88 / tw); x.font = `600 ${fs}px "IBM Plex Mono", monospace`; }
        x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, pw / 2, ph / 2 + 2); tex.needsUpdate = true;
      };
      set(txt);
      const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), new T.MeshBasicMaterial({ map: tex }));
      m.userData.set = set; return m;
    }
    // кнопка на приборе: колпачок с надписью сверху
    function button(parent, x, y, z, label, color, key, w = 4.4) {
      const b = new T.Group(); at(b, x, y, z, parent);
      at(box(w, 1.6, 4, color), 0, 0.8, 0, b);
      const top = flat(w * 0.8, 3.2, textTex(label, '#ffffff', '#' + color.toString(16).padStart(6, '0'), 128, 96));
      top.rotation.x = -Math.PI / 2; at(top, 0, 1.62, 0, b);
      clickable(b, key); return b;
    }
    // спиртовка: стеклянный корпус со спиртом, латунная горловина, фитиль, пламя (или колпачок)
    function spirit(parent, x, y, z, on, power = 1, s = 1) {
      const g = new T.Group(); at(g, x, y, z, parent);
      at(cyl(4.4 * s, 5.2 * s, 0xbfe3f2, { r2: 3 * s, matOpt: { transparent: true, opacity: 0.6 } }), 0, 2.6 * s, 0, g);
      at(cyl(4 * s, 2.6 * s, 0x8fc6ff, { r2: 3.5 * s, edges: false, hull: false, matOpt: { transparent: true, opacity: 0.7 } }), 0, 1.4 * s, 0, g);
      at(cyl(1.7 * s, 1.6 * s, C.BRASS), 0, 6 * s, 0, g);
      at(cyl(0.55 * s, 1.4 * s, 0xf4efe2, { hull: false }), 0, 7.4 * s, 0, g);
      let flame = null;
      if (on) {
        flame = new T.Group(); at(flame, 0, 7.9 * s, 0, g);
        const hgt = (4 + 6 * power) * s;
        at(cyl(1.5 * s, hgt, 0xff8a2a, { r2: 0.05, edges: false, hull: false, shadow: false, matOpt: { emissive: 0xff6a10, emissiveIntensity: 0.9, transparent: true, opacity: 0.85 } }), 0, hgt / 2, 0, flame);
        at(cyl(0.8 * s, hgt * 0.55, 0xfff1a8, { r2: 0.05, edges: false, hull: false, shadow: false, matOpt: { emissive: 0xffd24a, emissiveIntensity: 1 } }), 0, hgt * 0.28, 0, flame);
        at(glow(0xff9a40, hgt * 2.2, 0.6), 0, hgt * 0.45, 0, flame);
        at(new T.PointLight(0xffa040, 25 * s, 40, 1.4), 0, hgt * 0.5, 0, flame);
      } else {
        at(cyl(2.1 * s, 3 * s, 0xbfe3f2, { r2: 1.7 * s, matOpt: { transparent: true, opacity: 0.55 } }), 0, 7.6 * s, 0, g);
      }
      return { g, flame };
    }
    // стрелочный манометр: круглая шкала со стрелкой
    function gaugeTex(frac, lab, marks) {
      const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
      x.fillStyle = '#f7f3ea'; x.beginPath(); x.arc(128, 128, 124, 0, 7); x.fill();
      x.strokeStyle = '#1b1610'; x.lineWidth = 8; x.stroke();
      const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
      x.lineWidth = 4; x.beginPath(); x.arc(128, 128, 96, a0, a1); x.stroke();
      marks.forEach(([f, t]) => {
        const a = a0 + (a1 - a0) * f; x.lineWidth = 4; x.beginPath(); x.moveTo(128 + Math.cos(a) * 96, 128 + Math.sin(a) * 96); x.lineTo(128 + Math.cos(a) * 78, 128 + Math.sin(a) * 78); x.stroke();
        x.fillStyle = '#1b1610'; x.font = '600 22px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, 128 + Math.cos(a) * 58, 128 + Math.sin(a) * 58);
      });
      x.fillStyle = '#1b1610'; x.font = '700 26px "Golos Text", sans-serif'; x.textAlign = 'center'; x.fillText(lab, 128, 200);
      const a = a0 + (a1 - a0) * clamp(frac, 0, 1);
      x.strokeStyle = '#c0392b'; x.lineWidth = 7; x.lineCap = 'round'; x.beginPath(); x.moveTo(128, 128); x.lineTo(128 + Math.cos(a) * 88, 128 + Math.sin(a) * 88); x.stroke();
      x.fillStyle = '#1b1610'; x.beginPath(); x.arc(128, 128, 12, 0, 7); x.fill();
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
    }
    // точка (электрон, ион, молекула) — светящаяся сфера без контура
    const dotGeo = keep(new T.SphereGeometry(1, 12, 8)), dotMats = {};
    const dot = (parent, color, r) => {
      const m = new T.Mesh(dotGeo, dotMats[color] || (dotMats[color] = new T.MeshBasicMaterial({ color })));
      m.scale.setScalar(r); parent.add(m); return m;
    };
    return { glassMat, glow, flat, screen, button, spirit, gaugeTex, dot };
  }
  const flicker = (kit, flame, base = 1) => {
    if (!flame || kit.reduce) return;
    kit.onFrame((dt, t) => { flame.scale.set(base * (1 + 0.06 * Math.sin(t * 17)), base * (1 + 0.1 * Math.sin(t * 11) + 0.05 * Math.sin(t * 29)), base * (1 + 0.06 * Math.cos(t * 15))); });
  };

  // ===== 1. Металлы: проволока над спиртовкой, источник, амперметр, термометр на штативе =====
  SC['media-metal'] = (kit, d) => {
    const { T, at, box, cyl, mesh, toon, v3, tag, clickable, cable, C, placeOn } = kit, h = H(kit);
    const src = kit.supply(d.U); src.g.userData.click = 'ucycle';
    const sN = placeOn(src, v3(-44, 0, -20), 0, 'src');
    const am = kit.meter({ kind: 'A', val: d.I, max: d.I > 3 ? 6 : 3, value: d.Itxt });
    const aN = placeOn(am, v3(-14, 0, 26), 0, 'am');
    // доска со стойками-изоляторами и проволокой
    const g = new T.Group(); at(g, 0, 0, 0);
    const xa = -22, xb = 34, xm = (xa + xb) / 2, z = -8, wy = 21;
    at(box(68, 2.4, 16, C.WOOD2), xm, 1.2, z, g);
    for (const x of [xa, xb]) {
      at(cyl(1.7, 17, 0x2c3240), x, 2.4 + 8.5, z, g);
      at(box(3.6, 3.4, 3.6, C.BRASS), x, wy, z, g);
    }
    const pa = kit.post(g, xa, z, wy + 1.7), pb = kit.post(g, xb, z, wy + 1.7);
    // проволока: цвет металла; немного темнеет (окалина) при нагреве
    const col = new T.Color(d.mat === 'cu' ? 0xd98a4e : 0xa9b2c3);
    if (d.t > 60) col.lerp(new T.Color(d.mat === 'cu' ? 0x8a3f22 : 0x6f7685), clamp((d.t - 60) / 400, 0, 0.55));
    const wire = mesh(new T.CylinderGeometry(0.6, 0.6, xb - xa, 18), 0, { mat: toon(col.getHex()), hull: true, edges: false });
    wire.rotation.z = Math.PI / 2; at(wire, xm, wy, z, g);
    // невидимая «толстая» зона нажатия по проволоке
    const hit = mesh(new T.CylinderGeometry(2.6, 2.6, xb - xa - 4, 10), 0, { mat: new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), edges: false, shadow: false });
    hit.rotation.z = Math.PI / 2; at(hit, xm, wy, z, g); clickable(hit, d.mat === 'cu' ? 'm:nich' : 'm:cu');
    if (d.t < 0) { // иней на холодной проволоке
      const fr = mesh(new T.CylinderGeometry(0.6 + clamp(-d.t / 100, 0.2, 1) * 0.9, 0.6 + clamp(-d.t / 100, 0.2, 1) * 0.9, xb - xa - 5, 14), 0, { hull: true, mat: new T.MeshToonMaterial({ color: 0xf4fbff, gradientMap: kit.grad, transparent: true, opacity: clamp(0.35 - d.t / 160, 0.4, 0.85), depthWrite: false }), edges: false, shadow: false });
      fr.rotation.z = Math.PI / 2; at(fr, xm, wy, z, g);
    }
    // спиртовка под серединой проволоки: пламя тем больше, чем горячее проволока
    const heat = clamp((d.t - 20) / 280, 0, 1);
    const sp = h.spirit(g, xm, 2.4, z, d.t > 20, heat, 1.05); clickable(sp.g, 't+10'); flicker(kit, sp.flame);
    // термометр на штативе, шарик касается проволоки
    const tx = 20, tz = z - 2.6;
    at(box(10, 1.4, 8, C.DARK), tx, 0.7, -27, g);
    at(cyl(0.7, 46, C.STEEL, { edges: false }), tx, 23.4, -27, g);
    const arm = cyl(0.55, tz + 27, C.STEEL, { edges: false }); arm.rotation.x = Math.PI / 2; at(arm, tx, 40, (tz - 27) / 2, g);
    at(box(2.6, 2.6, 2.6, C.DARK), tx, 40, tz, g);
    const ty0 = wy + 1.2, tl = 22;
    at(cyl(0.95, tl, 0xeef6fb, { matOpt: { transparent: true, opacity: 0.75 } }), tx, ty0 + tl / 2 + 0.6, tz, g);
    at(new T.Mesh(kit.keep(new T.SphereGeometry(1.35, 16, 12)), toon(0xe0473a)), tx, ty0, tz, g);
    const colH = 1 + 17 * clamp((d.t + 100) / 400, 0, 1);
    at(cyl(0.42, colH, 0xe0473a, { edges: false, hull: false }), tx, ty0 + 1 + colH / 2, tz + 0.55, g);
    for (let k = 0; k <= 4; k++) at(box(1.2, 0.18, 0.1, 0x1b1610, { edges: false, shadow: false }), tx + 1.2, ty0 + 1 + 17 * k / 4, tz + 0.9, g);
    // сосуд Дьюара с жидким азотом — охлаждение
    const dw = new T.Group(); at(dw, 46, 0, 12); clickable(dw, 't-10');
    at(cyl(6, 15, 0xdfe6ee), 0, 7.5, 0, dw);
    at(cyl(4.4, 0.6, 0x1b2230, { hull: false }), 0, 15.1, 0, dw);
    at(box(1.6, 4, 1.4, 0x9aa3b2), 6.8, 9, 0, dw);
    const mist = h.glow(0xeaf6ff, 12, 0.5); at(mist, 0, 18, 0, dw);
    if (!kit.reduce) kit.onFrame((dt, t) => { mist.position.y = 18 + 1.5 * Math.sin(t * 1.3); mist.material.opacity = 0.35 + 0.15 * Math.sin(t * 2.1); });
    // провода: + → амперметр → правый конец → проволока → левый конец → −
    g.updateMatrixWorld(true);
    cable(sN.tout, aN.tin, C.WIRE.plus, d.I);
    cable(aN.tout, pb, C.WIRE.mid, d.I, { lift: 6 });
    cable(pa, sN.tin, C.WIRE.minus, d.I, { lift: 6 });
    tag(v3(-44, 25, -20), 'Источник', d.Utxt);
    tag(v3(-14, 17, 26), 'Амперметр', d.Itxt);
    tag(v3(-2, 26, z), d.matName, 'R = ' + d.Rtxt, d.ok);
    tag(v3(tx, ty0 + tl + 3, tz), 'Термометр', d.ttxt);
    tag(v3(46, 21, 12), 'Азот', '−10 °C');
  };

  // ===== 2. Полупроводники: модель кристалла на подставке, батарейка, миллиамперметр, лампочка =====
  SC['media-semi'] = (kit, d) => {
    const { T, at, box, cyl, mesh, toon, v3, tag, clickable, cable, C, placeOn } = kit, h = H(kit);
    const g = new T.Group(); at(g, 0, 0, 0);
    const z0 = -14, py = 12, top = py + 2, SX = 5.6, SZ = 4.2, XM = 27, HW = 28, DZ = 24;
    at(box(68, 2.4, 28, C.WOOD2), 0, 1.2, z0, g);
    for (const x of [-29.6, 29.6]) at(box(3.2, py - 2.4, 18, C.DARK), x, 2.4 + (py - 2.4) / 2, z0, g);
    const TC = { p: 0xe9b36a, n: 0x7cc4dc, i: 0x8f9bb3 }, TN = { p: 'p-тип', n: 'n-тип', i: 'чистый' }, TB = { p: '#e9a64a', n: '#5fb8d6', i: '#8f9bb3' };
    at(box(HW, 2, DZ, TC[d.tL]), -HW / 2, py + 1, z0, g);
    at(box(HW, 2, DZ, TC[d.tR]), HW / 2, py + 1, z0, g);
    // таблички «p-тип / n-тип» на стойках за кристаллом
    [[-HW / 2, d.tL], [HW / 2, d.tR]].forEach(([x, t]) => {
      const zb = z0 - DZ / 2 - 0.6;
      at(box(1, top + 4, 1, C.DARK), x, (top + 4) / 2 + 1.2, zb - 0.9, g);
      at(box(13, 5.4, 0.8, 0xfff6e6), x, top + 6.4, zb - 0.4, g);
      at(h.flat(12, 4.6, kit.textTex(TN[t], '#1b1610', TB[t], 256, 98)), x, top + 6.4, zb + 0.05, g);
    });
    // латунные электроды на концах пластины
    for (const x of [-HW - 1.3, HW + 1.3]) at(box(2.6, 3.4, DZ, C.BRASS), x, top + 0.4, z0, g);
    const pL = kit.post(g, -HW - 1.3, z0, top + 2.1), pR = kit.post(g, HW + 1.3, z0, top + 2.1);
    // атомы 10×5 и связи между ними
    const AX = c => (c - 4.5) * SX, AZ = r => z0 + (r - 2) * SZ, ay = top + 1.9;
    const bondMat = toon(0x5d6a86);
    for (let r = 0; r < 5; r++) { const b = mesh(new T.CylinderGeometry(0.36, 0.36, 9 * SX, 6), 0, { mat: bondMat, edges: false, shadow: false }); b.rotation.z = Math.PI / 2; at(b, 0, ay, AZ(r), g); }
    for (let c = 0; c < 10; c++) { const b = mesh(new T.CylinderGeometry(0.36, 0.36, 4 * SZ, 6), 0, { mat: bondMat, edges: false, shadow: false }); b.rotation.x = Math.PI / 2; at(b, AX(c), ay, z0, g); }
    const AC = { s: 0x9aa6bd, p: 0x3f9be0, b: 0xf0a040 }, ag = new T.SphereGeometry(1.75, 18, 12);
    const grid = d.grid || '';
    for (let i = 0; i < 50; i++) {
      const k = grid[i] || 's', c = i % 10, r = (i / 10) | 0;
      const a = mesh(ag, 0, { mat: toon(AC[k]), hull: true, edges: false }); at(a, AX(c), ay, AZ(r), g); clickable(a, 'a' + i);
    }
    // p–n-переход: узкий в прямом включении, широкий запирающий слой в обратном
    if (d.pn) {
      const w = d.mode === 'rev' ? 14 : 1.8;
      at(box(w, 2.3, DZ + 0.6, 0xffd54a, { edges: false, shadow: false, matOpt: { transparent: true, opacity: d.mode === 'rev' ? 0.55 : 0.7, depthWrite: false } }), 0, py + 1, z0, g);
    }
    // спиртовка под кристаллом — нагрев до 150 °C
    const sp = h.spirit(g, 0, 2.4, z0 + 3, d.hot, 0.05, 0.66); clickable(sp.g, 'hot'); flicker(kit, sp.flame);
    // носители: электроны (голубые) от фосфора, дырки (оранжевые кольца) от бора, пары при нагреве
    const car = [], holeGeo = kit.keep(new T.TorusGeometry(0.95, 0.34, 6, 16)), holeMat = new T.MeshBasicMaterial({ color: 0xffb547 });
    for (let i = 0; i < 50; i++) {
      const k = grid[i]; if (k !== 'p' && k !== 'b') continue;
      const c = i % 10, r = (i / 10) | 0, side = c < 5 ? -1 : 1;
      car.push({ e: k === 'p', side, hx: clamp(AX(c) + (rnd(i) - 0.5) * 3.6, side < 0 ? -XM : 1.4, side < 0 ? -1.4 : XM), hz: AZ(r) + SZ / 2 });
    }
    if (d.hot) for (const side of [-1, 1]) for (let j = 0; j < 2; j++) {
      const hx = side * (6 + rnd(j * 7 + side * 3) * 18), hz = z0 - 8 + rnd(j * 3 + side) * 16;
      car.push({ e: true, side, hx, hz }, { e: false, side, hx: hx + side * 2, hz: hz + 2 });
    }
    const cy = ay + 2.6;
    car.forEach((c, i) => {
      if (c.e) c.m = h.dot(g, 0x72d4e8, 0.95);
      else { c.m = new T.Mesh(holeGeo, holeMat); c.m.rotation.x = Math.PI / 2; g.add(c.m); }
      c.x = c.hx; c.m.position.set(c.hx, cy, c.hz); c.ph = i * 1.7;
    });
    const flow = (d.mode === 'fwd' || d.mode === 'ohm') && d.I > 0.05, eDir = d.plusLeft ? -1 : 1;
    const sp2 = d.mode === 'fwd' ? 11 : 6;
    kit.onFrame((dt, t) => {
      for (const c of car) {
        let x = c.x, zz = c.hz;
        if (kit.reduce) { x = c.hx; }
        else if (flow) { x += (c.e ? eDir : -eDir) * sp2 * dt; if (x < -XM) x = XM; if (x > XM) x = -XM; zz += Math.sin(t * 2 + c.ph) * 0.4; }
        else {
          let tx = c.hx;
          if (d.mode === 'rev') tx = c.side < 0 ? -XM + (c.hx + XM) * ((XM - 7) / XM) : XM - (XM - c.hx) * ((XM - 7) / XM);
          x += (tx - x) * Math.min(1, dt * 3); x += Math.sin(t * 3 + c.ph) * 0.02; zz += Math.cos(t * 2.4 + c.ph) * 0.35;
        }
        c.x = x; c.m.position.set(x, cy, zz);
      }
    });
    // батарейка: «+» смотрит туда, куда её повернули
    const bat = kit.cells(1, 1.5); bat.g.userData.click = 'pol';
    const bN = placeOn(bat, v3(-28, 0, 22), d.plusLeft ? Math.PI : 0, 'bat');
    const am = kit.meter({ kind: 'A', val: d.I, max: 40, value: d.Itxt, label: 'Миллиамперметр' });
    const aN = placeOn(am, v3(4, 0, 28), 0, 'am');
    const lamp = kit.bulb({ glow: clamp(d.I / 30, 0, 1.2), value: '' });
    const lN = placeOn(lamp, v3(38, 0, 14), 0, 'lamp');
    g.updateMatrixWorld(true);
    const leftT = d.plusLeft ? bN.tout : bN.tin, rightT = d.plusLeft ? bN.tin : bN.tout;
    const Iw = d.I > 0.05 ? d.I / 10 : 0;
    // провода по ходу тока: от «+» к «−»
    const legs = [[leftT, pL, { lift: 5 }], [rightT, aN.tin, {}], [aN.tout, lN.tin, {}], [lN.tout, pR, { lift: 5 }]];
    legs.forEach(([a, b, o], k) => {
      const first = d.plusLeft ? k === 0 : k === 1;
      const col = first ? C.WIRE.plus : (d.plusLeft ? k === 1 : k === 0) ? C.WIRE.minus : C.WIRE.mid;
      (d.plusLeft ? k === 0 : k !== 0) ? cable(a, b, col, Iw, o) : cable(b, a, col, Iw, o);
    });
    // банки с примесями: какая открыта — той и заменяем атомы
    const JARS = [['P', 'Фосфор', 0x3f9be0], ['B', 'Бор', 0xf0a040], ['Si', 'Кремний', 0x9aa6bd]];
    JARS.forEach(([k, name, colr], j) => {
      const x = 42 + j * 9, zj = -30, jg = new T.Group(); at(jg, x, 0, zj); clickable(jg, 'mode:' + k);
      const on = d.sel === k;
      if (on) at(cyl(4.6, 0.3, 0xffd166, { edges: false, hull: false, shadow: false }), 0, 0.15, 0, jg);
      at(new T.Mesh(kit.keep(new T.CylinderGeometry(3.2, 3.2, 8, 24, 1, true)), h.glassMat(0xd8eef8, 0.35)), 0, 4.3, 0, jg);
      at(cyl(3.2, 0.5, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.5 } }), 0, 0.5, 0, jg);
      at(cyl(2.8, 3.4, colr, { edges: false }), 0, 2.4, 0, jg);
      const lid = cyl(3.5, 1.3, C.DARK); at(lid, on ? -1.5 : 0, on ? 10.2 : 8.9, on ? -1 : 0, jg); if (on) lid.rotation.z = 0.5;
      const lab = h.flat(4.6, 3, kit.textTex(k, '#1b1610', '#fff6e6', 128, 84)); at(lab, 0, 5.6, 3.25, jg);
    });
    const si = JARS.findIndex(j => j[0] === d.sel);
    tag(v3(0, 24, z0 - 6), 'Кристалл', ({ p: 'p', n: 'n', i: 'i' })[d.tL] + ' | ' + ({ p: 'p', n: 'n', i: 'i' })[d.tR] + (d.pn ? (d.mode === 'fwd' ? ' · прямое' : ' · обратное') : ''), d.pn && d.mode === 'fwd');
    tag(v3(-28, 17, 22), 'Батарейка', d.plusLeft ? '«+» слева' : '«+» справа');
    tag(v3(4, 17, 28), 'Миллиамперметр', d.Itxt);
    if (si >= 0) tag(v3(42 + si * 9, 14, -30), 'Примесь', JARS[si][1]);
  };

  // ===== 3. Электролиз: стеклянная ванна с CuSO₄, катод и медный анод, источник, амперметр, весы, таймер =====
  SC['media-elec'] = (kit, d) => {
    const { T, at, box, cyl, mesh, toon, v3, tag, clickable, cable, C, placeOn } = kit, h = H(kit);
    const g = new T.Group(); at(g, 0, 0, 0);
    const bx = 6, bz = -10, BW = 40, BH = 22, BD = 20, lvl = 16.5;
    // ванна: стекло без крышки
    const gm = h.glassMat(0xd8eef8, 0.3), none = new T.MeshBasicMaterial({ visible: false });
    const tank = mesh(new T.BoxGeometry(BW, BH, BD), 0, { mat: [gm, gm, none, gm, gm, gm], shadow: false }); at(tank, bx, BH / 2, bz, g);
    at(box(BW + 1, 0.6, BD + 1, 0xbfdcea, { edges: false }), bx, 0.3, bz, g);
    const sol = mesh(new T.BoxGeometry(BW - 1, lvl - 0.6, BD - 1), 0, { mat: new T.MeshToonMaterial({ color: 0x2a86e8, gradientMap: kit.grad, transparent: true, opacity: 0.62, depthWrite: false }), edges: false, shadow: false });
    at(sol, bx, 0.6 + (lvl - 0.6) / 2, bz, g);
    // электроды на поперечных планках
    const xc = bx - 10, xa = bx + 10;
    for (const x of [xc, xa]) at(box(2.6, 1.6, BD + 4, C.DARK), x, BH + 0.8, bz, g);
    at(box(0.8, 23, 12, C.STEEL), xc, 3 + 11.5, bz, g);
    const cat = new T.Group(); at(cat, xc, 0, bz, g); clickable(cat, 'new');
    at(box(3, 26, 13, 0x000000, { edges: false, shadow: false, matOpt: { transparent: true, opacity: 0, depthWrite: false } }), 0, 14, 0, cat);
    at(box(1.6, 23, 12, 0xc27a45), xa, 3 + 11.5, bz, g);
    const pC = kit.post(g, xc, bz, 26), pA = kit.post(g, xa, bz, 26);
    // слой меди на катоде (растёт с массой)
    const coat = mesh(new T.BoxGeometry(1, lvl - 3.4, 1), 0, { mat: toon(0xc8743f), edges: false }); at(coat, xc, 3 + (lvl - 3.4) / 2, bz, g);
    const setCoat = m => { const th = 0.18 + 2.4 * clamp(m, 0, 1.2) / 1.2; coat.visible = m > 0.0005; coat.scale.set(0.8 + 2 * th, 1, 12 + 2 * th); };
    setCoat(d.mass < 0 ? 0 : d.mass);
    // ионы в растворе: Cu²⁺ (голубые) к катоду, SO₄²⁻ (жёлтые) к аноду
    const ions = [];
    for (let i = 0; i < 22; i++) {
      const cu = i % 2 === 0, m = h.dot(g, cu ? 0x8fd0ff : 0xffd54a, cu ? 0.75 : 0.9);
      ions.push({ cu, m, x: xc + 1.5 + rnd(i) * 17, y: 2 + rnd(i + 40) * (lvl - 4), z: bz - 8 + rnd(i + 80) * 16, ph: i * 1.3 });
    }
    const flashes = [];
    for (let i = 0; i < 4; i++) { const f = h.glow(0xffd166, 4, 0); at(f, xc + 1, 8, bz, g); flashes.push({ f, t: -9 }); }
    let fi = 0;
    // источник тока с кнопками ▲▼
    const src = kit.supply(d.I, 'А'); const sN = placeOn(src, v3(-40, 0, -18), 0, 'src');
    h.button(src.g, -4, 17.2, 3.4, '▲', 0x3fae5a, 'I+'); h.button(src.g, 2.6, 17.2, 3.4, '▼', 0xe0473a, 'I-');
    const am = kit.meter({ kind: 'A', val: d.running ? d.I : 0, max: 3, value: d.running ? d.Itxt : '0 А' });
    const aN = placeOn(am, v3(-24, 0, 26), 0, 'am');
    // электронные весы: сколько меди осело на катоде
    const sc = new T.Group(); at(sc, 8, 0, 28);
    at(box(20, 4, 15, 0xe8ecf4), 0, 2, 0, sc);
    at(cyl(6.2, 0.8, C.STEEL), 0, 4.4, -1.5, sc);
    at(box(14, 3.6, 1, 0x2c3240), 0, 2.2, 7.6, sc);
    const sTxt = m => '+' + fmt(m, 3) + ' г', ok = m => Math.abs(m - 0.5) <= 0.01;
    const scr = h.screen(12.4, 3, sTxt(Math.max(0, d.mass)), ok(d.mass) ? '#86e0a8' : '#e8ecf4'); at(scr, 0, 2.2, 8.12, sc);
    // таймер с кнопками ▲▼ и «Пуск»
    const tg = new T.Group(); at(tg, 40, 0, 14);
    at(box(18, 8, 11, 0x3b4a66), 0, 4, 0, tg);
    at(box(16.4, 1, 9.4, 0x4a5b7c), 0, 8.5, 0, tg);
    const tscr = h.screen(12, 4.4, d.tm + ' мин', d.running ? '#ffb547' : '#e8ecf4'); at(tscr, -1.2, 4.2, 5.55, tg);
    h.button(tg, -5.4, 9, 1.5, '▲', 0x3fae5a, 't+', 3.6); h.button(tg, -1.2, 9, 1.5, '▼', 0xe0473a, 't-', 3.6);
    const go = new T.Group(); at(go, 5, 9, 0, tg); clickable(go, 'run');
    at(cyl(2.2, 1.2, C.DARK), 0, 0.6, 0, go);
    at(cyl(3, d.running ? 1 : 2, d.running ? 0x3fae5a : 0xe0473a), 0, d.running ? 1.6 : 2.2, 0, go);
    // провода: + → амперметр → анод; катод → −
    g.updateMatrixWorld(true);
    const Iw = d.running ? d.I : 0;
    cable(sN.tout, aN.tin, C.WIRE.plus, Iw, { lift: 4 });
    cable(aN.tout, pA, C.WIRE.mid, Iw, { lift: 8 });
    cable(pC, sN.tin, C.WIRE.minus, Iw, { lift: 8 });
    kit.onFrame((dt, t) => {
      const L = live() || {}, run = !!L.running;
      if (L.mass != null) { setCoat(L.mass); scr.userData.set(sTxt(L.mass), ok(L.mass) && !run ? '#86e0a8' : '#e8ecf4'); }
      if (L.tm != null) tscr.userData.set(fmt(L.tm, run ? 1 : 0) + ' мин', run ? '#ffb547' : '#e8ecf4');
      if (kit.reduce) return;
      const v = 3 + 4 * d.I;
      for (const p of ions) {
        if (run) {
          p.x += (p.cu ? -v : v) * dt;
          if (p.cu && p.x < xc + 1.2) { const f = flashes[fi++ % flashes.length]; f.t = t; f.f.position.set(xc + 1, p.y, p.z); p.x = xa - 1.4; }
          if (!p.cu && p.x > xa - 1.4) p.x = xc + 1.6;
        }
        p.m.position.set(p.x + Math.sin(t * 1.7 + p.ph) * 0.3, p.y + Math.cos(t * 1.3 + p.ph) * 0.3, p.z + Math.sin(t * 1.1 + p.ph * 2) * 0.3);
      }
      for (const f of flashes) f.f.material.opacity = clamp(1 - (t - f.t) / 0.4, 0, 1) * 0.9;
    });
    tag(v3(-40, 25, -18), 'Источник', d.Itxt);
    tag(v3(-24, 17, 26), 'Амперметр', d.running ? d.Itxt : '0 А');
    tag(v3(bx, 30, bz), 'Ванна', d.running ? 'CuSO₄ · идёт электролиз' : 'CuSO₄ · катод − · анод +', d.running);
    tag(v3(8, 9, 28), 'Весы · катод', d.running ? 'взвешиваем…' : sTxt(d.mass));
    tag(v3(40, 15, 14), 'Таймер', d.tm + ' мин');
  };

  // ===== 4. Газы и вакуум: трубка с нитью и пластиной, насос с манометром, источник ВН, УФ-лампа =====
  SC['media-gas'] = (kit, d) => {
    const { T, at, box, cyl, mesh, toon, v3, tag, clickable, cable, C, placeOn } = kit, h = H(kit);
    const g = new T.Group(); at(g, 0, 0, 0);
    const ty = 19, tz = -8, half = 30, R = 5.6;
    const vac = d.gas === 'vac', self = d.regime === 'self';
    // подставки-ложементы
    for (const x of [-18, 18]) { at(box(4, ty - R + 0.4, 12, C.WOOD2), x, (ty - R + 0.4) / 2, tz, g); at(box(4.4, 1.2, 13, C.WOOD), x, ty - R - 0.2, tz, g); }
    // стеклянная трубка
    const tube = new T.Mesh(kit.keep(new T.CylinderGeometry(R, R, 2 * half, 40, 1, true)), h.glassMat(0xd8eef8, 0.24));
    tube.rotation.z = Math.PI / 2; at(tube, 0, ty, tz, g);
    for (const s of [-1, 1]) {
      const cap = cyl(R + 0.4, 3.2, C.STEEL); cap.rotation.z = Math.PI / 2; at(cap, s * (half + 1.4), ty, tz, g);
      const ring = cyl(R + 0.15, 0.8, 0xbfdcea, { edges: false }); ring.rotation.z = Math.PI / 2; at(ring, s * (half - 0.4), ty, tz, g);
    }
    // отросток к насосу
    at(cyl(1.3, 5, 0xd8eef8, { matOpt: { transparent: true, opacity: 0.5 } }), 6, ty + R + 2, tz, g);
    // нить накала (слева) и пластина (справа)
    const fx = -25, hot = vac && d.heat;
    const fp = []; for (let k = 0; k <= 10; k++) fp.push(v3(fx + (k % 2 ? 0.9 : -0.9), ty - 3.2 + k * 0.64, tz));
    const fil = new T.Mesh(kit.keep(new T.TubeGeometry(new T.CatmullRomCurve3(fp), 60, 0.24, 6)), new T.MeshBasicMaterial({ color: hot ? 0xffc04a : 0x8b96ad }));
    g.add(fil);
    for (const zz of [-0.6, 0.6]) { const l = cyl(0.22, half - 25 + 1.5, C.STEEL, { edges: false, hull: false }); l.rotation.z = Math.PI / 2; at(l, -(half + 25) / 2 - 0.5, ty + (zz < 0 ? -3.2 : 3.2), tz, g); }
    if (hot) { at(h.glow(0xffa040, 9, 0.8), fx, ty, tz, g); at(new T.PointLight(0xffa040, 18, 30, 1.4), fx, ty, tz, g); }
    const plate = cyl(4, 0.6, C.STEEL); plate.rotation.z = Math.PI / 2; at(plate, 26, ty, tz, g);
    const pl = cyl(0.25, half - 26, C.STEEL, { edges: false, hull: false }); pl.rotation.z = Math.PI / 2; at(pl, (half + 26) / 2, ty, tz, g);
    // клеммы: у нити две (накал), у пластины одна
    const fA = kit.post(g, -half - 1.4, tz - 2.4, ty + R - 0.2), fB = kit.post(g, -half - 1.4, tz + 2.4, ty + R - 0.2);
    const pP = kit.post(g, half + 1.4, tz, ty + R + 0.4);
    // знаки полярности у электродов
    const lS = d.pol ? '−' : '+', rS = d.pol ? '+' : '−';
    at(h.flat(3.4, 3.4, kit.textTex(lS, '#ffd166', '#1b1610', 96, 96)), -half - 1.4, ty - 2, tz + R + 0.5, g);
    at(h.flat(3.4, 3.4, kit.textTex(rS, '#ffd166', '#1b1610', 96, 96)), half + 1.4, ty - 2, tz + R + 0.5, g);
    // свечение тлеющего разряда: ярче при большем токе
    if (self) {
      const op = clamp(0.25 + d.I / 30, 0.25, 0.9);
      const gl = new T.Mesh(kit.keep(new T.CylinderGeometry(R - 0.5, R - 0.5, 2 * half - 8, 32, 1, true)), new T.MeshBasicMaterial({ color: 0xff7ad0, transparent: true, opacity: op * 0.55, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
      gl.rotation.z = Math.PI / 2; at(gl, 0, ty, tz, g);
      const cx = d.pol ? fx + 2 : 24;
      const cg = h.glow(0xffd1f0, 11, op); at(cg, cx, ty, tz, g);
      at(new T.PointLight(0xff7ad0, 30 * op, 70, 1.3), 0, ty, tz + 4, g);
      if (!kit.reduce) kit.onFrame((dt, t) => { gl.material.opacity = op * (0.5 + 0.06 * Math.sin(t * 23) + 0.04 * Math.sin(t * 7)); });
    }
    // частицы в трубке: молекулы, электроны, ионы
    const nMol = { air100: 26, air1: 12, air01: 5, vac: 0 }[d.gas] || 0, mol = [];
    for (let i = 0; i < nMol; i++) { const m = h.dot(g, 0x9aa3b2, 0.45); mol.push({ m, x: -22 + rnd(i) * 44, y: ty - 4 + rnd(i + 9) * 8, z: tz - 3.5 + rnd(i + 19) * 7, ph: i }); }
    const pool = [];
    for (let i = 0; i < 46; i++) { const e = i % 2 === 0; const m = h.dot(g, e ? 0x72d4e8 : 0xff8a73, e ? 0.42 : 0.6); m.visible = false; pool.push({ m, e, live: false }); }
    const plusRight = d.pol, U = d.U;
    let rate = 0; if (self) rate = 26; else if (!vac && d.ion) rate = { air100: 12, air1: 6, air01: 4 }[d.gas] || 4;
    const thermo = vac && d.heat, go = d.pol && U > 0;
    const spawn = (e, x, y, z, life, k) => { const p = pool.find(q => !q.live && q.e === e); if (!p) return; Object.assign(p, { live: true, x, y, z, age: 0, life, k: k || '' }); p.m.visible = true; };
    let acc = 0, accT = 0;
    kit.onFrame((dt, t) => {
      for (const q of mol) q.m.position.set(q.x + Math.sin(t * 1.4 + q.ph) * 0.8, q.y + Math.cos(t * 1.1 + q.ph) * 0.5, q.z + Math.sin(t * 0.9 + q.ph * 2) * 0.5);
      if (kit.reduce) return;
      acc += rate * dt;
      while (acc >= 1) {
        acc -= 1;
        const x = self ? -20 + Math.random() * 40 : -8 + Math.random() * 16, y = ty - 3 + Math.random() * 6, z = tz - 3 + Math.random() * 6;
        spawn(true, x, y, z, U > 0 ? 6 : 1); spawn(false, x + 0.6, y + 0.5, z, U > 0 ? 6 : 1);
      }
      if (thermo) { accT += 12 * dt; while (accT >= 1) { accT -= 1; spawn(true, fx + 1, ty - 2.5 + Math.random() * 5, tz - 1 + Math.random() * 2, go ? 6 : 0.8, 't'); } }
      const ve = 8 + 12 * U, vi = 3 + 4 * U;
      for (const p of pool) {
        if (!p.live) continue;
        p.age += dt;
        if (p.k === 't') { if (go) p.x += (10 + 14 * U) * dt; else p.x = fx + 1 + 2.4 * Math.sin(Math.PI * clamp(p.age / p.life, 0, 1)); }
        else if (U > 0) { const right = p.e ? plusRight : !plusRight; p.x += (right ? 1 : -1) * (p.e ? ve : vi) * dt; }
        if (p.age > p.life || p.x < -25.5 || p.x > 25.6) { p.live = false; p.m.visible = false; continue; }
        p.m.position.set(p.x, p.y + Math.sin(p.age * 9 + p.x) * 0.15, p.z);
      }
    });
    // источник высокого напряжения: ▲▼ и переключатель полярности
    const src = kit.supply(d.U, 'кВ'); const sN = placeOn(src, v3(-44, 0, -28), 0, 'src');
    src.g.children[0].material = toon(0x8a3b3b);
    h.button(src.g, -6, 17.2, 3.4, '▲', 0x3fae5a, 'U+', 4); h.button(src.g, -1.2, 17.2, 3.4, '▼', 0xe0473a, 'U-', 4);
    h.button(src.g, 4.2, 17.2, 3.4, '⇄', 0x3b6fd8, 'pol', 4.6);
    // микроамперметр-цифровой
    const mg = new T.Group(); at(mg, 26, 0, 24);
    at(box(16, 10, 10, 0xf2c94c), 0, 5, 0, mg);
    const msc = h.screen(12.4, 4.4, d.Itxt, d.I > 0 ? '#86e0a8' : '#e8ecf4'); at(msc, 0, 6, 5.06, mg);
    at(cyl(1.1, 2, 0xe0473a), -5, 11, -2.5, mg); at(cyl(1.1, 2, 0x26324a), 5, 11, -2.5, mg);
    mg.updateMatrixWorld(true);
    const mIn = v3(-5, 12, -2.5).applyMatrix4(mg.matrixWorld), mOut = v3(5, 12, -2.5).applyMatrix4(mg.matrixWorld);
    // УФ-лампа (ионизатор) перед трубкой
    const ug = new T.Group(); at(ug, 0, 0, 8); clickable(ug, 'ion');
    for (const x of [-6, 6]) at(box(1.4, 6, 1.4, C.DARK), x, 3, 0, ug);
    at(box(16, 4, 5, 0x3a2a5a), 0, 7.6, 0, ug);
    const ul = cyl(1.2, 13, d.ion ? 0xd9b8ff : 0x6c5a8a, { edges: false, matOpt: d.ion ? { emissive: 0xb48cff, emissiveIntensity: 1 } : {} }); ul.rotation.z = Math.PI / 2; at(ul, 0, 9.9, -0.6, ug);
    if (d.ion) {
      const uv = h.glow(0xb48cff, 18, 0.7); at(uv, 0, 11, -1.5, ug);
      at(new T.PointLight(0xb48cff, 22, 40, 1.4), 0, 12, -3, ug);
      if (!kit.reduce) kit.onFrame((dt, t) => { uv.material.opacity = 0.55 + 0.15 * Math.sin(t * 6); });
    }
    // насос с манометром
    const pg = new T.Group(); at(pg, 44, 0, -26); clickable(pg, 'gcycle');
    at(box(20, 2, 12, C.DARK), 0, 1, 0, pg);
    const mot = cyl(4.6, 12, 0x3fae5a); mot.rotation.z = Math.PI / 2; at(mot, -2, 7.4, 0, pg);
    at(box(6, 9, 8, 0x2f8a48), 6.5, 6.5, 0, pg);
    at(cyl(1, 4, C.STEEL), 6.5, 13, 0, pg);
    const frac = { air100: 1, air1: 0.6, air01: 0.35, vac: 0 }[d.gas] ?? 1;
    const gauge = cyl(4.4, 1.4, 0xe8ecf4); gauge.rotation.x = Math.PI / 2; at(gauge, -2, 17.5, 1, pg);
    at(box(1.2, 4, 1.2, C.STEEL), -2, 13, 0, pg);
    const face = h.flat(7.8, 7.8, h.gaugeTex(frac, 'кПа', [[0, '0'], [0.35, '0,1'], [0.6, '1'], [1, '100']])); at(face, -2, 17.5, 1.75, pg);
    pg.updateMatrixWorld(true);
    cable(v3(6, ty + R + 4.5, tz), v3(6.5, 15, 0).applyMatrix4(pg.matrixWorld), 0x3a2a24, 0, { r: 1.2, lift: 3, arch: 1 });
    // накал: батарея → рубильник → нить
    const hb = kit.cells(2, 3); const hN = placeOn(hb, v3(-30, 0, 32), 0, 'hb');
    const kn = kit.knife({ closed: d.heat, click: 'heat' }); const kN = placeOn(kn, v3(-50, 0, 10), Math.PI / 2, 'kn');
    // провода
    g.updateMatrixWorld(true);
    const Ihv = d.I > 1e-4 ? Math.max(0.05, d.I / 10) : 0, Ih = hot ? 0.6 : 0;
    const cath = d.pol ? fA : pP, anod = d.pol ? pP : fA;
    cable(sN.tout, mIn, C.WIRE.plus, Ihv, { lift: 5 });
    cable(mOut, anod, C.WIRE.mid, Ihv, { lift: 6 });
    cable(cath, sN.tin, C.WIRE.minus, Ihv, { lift: 6 });
    cable(hN.tout, kN.tin, 0x3fae5a, Ih);
    cable(kN.tout, fB, 0x3fae5a, Ih, { lift: 6 });
    cable(fA, hN.tin, 0x2a2f3a, Ih, { lift: 3 });
    tag(v3(-44, 26, -28), 'Источник', d.Utxt);
    tag(v3(0, ty + R + 9, tz), 'Трубка', d.gasTxt + ' · ' + d.rtxt, self);
    tag(v3(26, 15, 24), 'Ток', d.Itxt);
    tag(v3(0, 16, 8), 'УФ-ионизатор', d.ion ? 'вкл' : 'выкл', d.ion);
    tag(v3(-50, 12, 10), 'Накал', d.heat ? 'вкл' : 'выкл', d.heat);
  };
})();
