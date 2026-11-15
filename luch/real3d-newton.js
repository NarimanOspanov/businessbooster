// «Как в жизни» для темы «Законы Ньютона» (labs/phys-newton): шайба на трёх поверхностях с пусковой пружиной,
// тележка с лебёдкой, динамометром и световыми воротами, две тележки с пружиной и датчиками силы,
// учебная модель «Земля — корабль» на штанге с линейкой, мяч на нити на гладком круглом столе.
// Описание сцены приходит из window.LUCH_REAL() опыта; положения (шайба, тележки, угол мяча) — из window.LUCH_REAL.live() каждый кадр.
(() => {
  const SC = (window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {});
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const live = () => { try { const f = window.LUCH_REAL && window.LUCH_REAL.live; return f ? f() : null; } catch (e) { return null; } };
  const TAU = Math.PI * 2;
  const num = (x, n) => { let s = (Math.round(x * 10 ** n) / 10 ** n).toFixed(n); if (/^-0(\.0+)?$/.test(s)) s = s.slice(1); return s.replace('.', ','); };
  const nf = x => num(x, Math.abs(x - Math.round(x)) < 1e-9 ? 0 : Math.abs(x * 10 - Math.round(x * 10)) < 1e-9 ? 1 : 2);
  const mem = {}; // положения между перестройками сцены — корабль доезжает, а не прыгает

  // ---------- общие детали темы ----------
  function tools(kit) {
    const { T, at, box, cyl, mesh, keep, v3, C } = kit;
    const own = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: kit.grad, ...o }));
    const basic = (color, o = {}) => keep(new T.MeshBasicMaterial({ color, ...o }));
    const W = (g, p) => { g.updateMatrixWorld(true); return p.clone().applyMatrix4(g.matrixWorld); };
    // табличка с текстом
    function plate(txt, w, h, fg = '#1b1610', bg = '#f7f3ea') {
      const t = keep(kit.textTex(txt, fg, bg, Math.round(64 * w / h), 64));
      return new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: t })));
    }
    // экран, который перерисовывается каждый кадр
    function screen(w, h, pw = 288, ph = 192) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph;
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace;
      const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: tex })));
      return { m, c, x: c.getContext('2d'), tex, W: pw, H: ph };
    }
    // материал с нарисованной повторяющейся текстурой (ковёр, лёд, дырочки воздушного стола)
    function texMat(draw, pw, ph, rx, ry, color = 0xffffff, o = {}) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph; draw(c.getContext('2d'), pw, ph);
      const t = keep(new T.CanvasTexture(c)); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry);
      return own(color, { map: t, ...o });
    }
    // стрелка силы/скорости вдоль +x; set(len) — длина
    function arrow(col, r = 0.5) {
      const g = new T.Group(), hd = r * 4.4;
      const sh = cyl(r, 1, col, { edges: false, hull: false }); sh.rotation.z = Math.PI / 2; g.add(sh);
      const head = cyl(r * 2.5, hd, col, { r2: 0, edges: false, seg: 18 }); head.rotation.z = -Math.PI / 2; g.add(head);
      return { g, set(len) { const l = Math.max(0.01, len - hd); sh.scale.y = l; sh.position.x = l / 2; head.position.x = l + hd / 2; g.visible = len > hd * 0.8; } };
    }
    // нить/стержень между двумя точками (в координатах родителя)
    function rod(col, r = 0.22) {
      const m = cyl(r, 1, col, { edges: false, hull: false, seg: 8 }); const up = v3(0, 1, 0), dv = v3(0, 0, 0);
      return { m, set(a, b) { dv.copy(b).sub(a); const l = dv.length(); if (l < 1e-4) return; m.position.copy(a).addScaledVector(dv, 0.5); m.quaternion.setFromUnitVectors(up, dv.multiplyScalar(1 / l)); m.scale.set(1, l, 1); } };
    }
    // пружина вдоль +x из витков-колец: set(len) — длина (сжатие только сдвигает витки)
    function spring(turns, r, wire, col) {
      const g = new T.Group(), geo = new T.TorusGeometry(r, wire, 6, 24), rings = [];
      for (let k = 0; k < turns; k++) { const m = mesh(k ? geo.clone() : geo, col, { edges: false, hull: true }); m.rotation.y = Math.PI / 2; m.rotation.x = 0.28; g.add(m); rings.push(m); }
      return { g, set(len) { rings.forEach((m, k) => { m.position.x = (k + 0.5) / turns * len; }); } };
    }
    // кнопка: корпус и надпись, обращена к зрителю (+z)
    function button(parent, x, y, z, txt, key, o = {}) {
      const b = new T.Group(); at(b, x, y, z, parent);
      const w = o.w || 5, h = o.h || 3.4;
      at(box(w, h, 1.4, o.col || 0xe8ecf4), 0, 0, 0, b);
      const p = plate(txt, w - 0.9, h - 1, o.fg || '#1b1610', o.bg || '#e8ecf4'); at(p, 0, 0, 0.72, b);
      kit.clickable(b, key); return b;
    }
    // рельс-трек вдоль x: верх рельса y = 4; o.stopL / o.stopR — упоры на концах
    function track(x0, x1, z, o = {}) {
      const g = new T.Group(), L = x1 - x0; at(g, (x0 + x1) / 2, 0, z);
      for (const x of [-L / 2 + 4, L / 2 - 4]) { at(box(4, 1.2, 15, C.DARK), x, 0.6, 0, g); for (const s of [-1, 1]) at(cyl(0.9, 0.5, C.STEEL, { seg: 6 }), x, 1.45, s * 6, g); }
      at(box(L, 2.8, 10, 0xaab3c2), 0, 2.6, 0, g);
      for (const zz of [-3.2, 3.2]) at(box(L, 0.1, 0.9, 0x6b7384, { edges: false, shadow: false }), 0, 4.03, zz, g);
      at(box(L - 3, 1.4, 0.2, 0xf1e3c2, { edges: false }), 0, 2.6, 5.1, g);
      if (o.stopL) { at(box(2, 4.4, 10, 0x3a3f4c), -L / 2 + 1, 6.2, 0, g); at(box(0.8, 2.6, 6, 0xe0473a), -L / 2 + 2.4, 6.6, 0, g); }
      if (o.stopR) { at(box(2, 4.4, 10, 0x3a3f4c), L / 2 - 1, 6.2, 0, g); at(box(0.8, 2.6, 6, 0xe0473a), L / 2 - 2.4, 6.6, 0, g); }
      return g;
    }
    // тележка: корпус, четыре колеса (крутятся), гири сверху; начало координат — центр, низ колёс на y = 4
    function cart(len, col, n) {
      const g = new T.Group(), rw = 1.5, yW = 4 + rw, wheels = [];
      at(box(len, 3.6, 7, col), 0, yW + 2.4, 0, g);
      at(box(len - 2, 0.6, 7.4, 0x2c3240), 0, yW + 0.9, 0, g);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const w = new T.Group(); at(w, sx * (len / 2 - 3), yW, sz * 4.1, g);
        const t = cyl(rw, 1, 0x2b3346, { seg: 20 }); t.rotation.x = Math.PI / 2; w.add(t);
        const hb = cyl(0.6, 1.2, C.STEEL, { seg: 10 }); hb.rotation.x = Math.PI / 2; w.add(hb);
        at(box(0.4, rw * 1.6, 1.22, 0x8b93a1, { edges: false, shadow: false }), 0, 0, 0, w);
        wheels.push(w);
      }
      const top = yW + 4.2, per = Math.max(1, Math.floor((len - 1) / 4.2));
      for (let i = 0; i < n; i++) {
        const row = Math.floor(i / per), c = i % per;
        at(box(3.6, 1.6, 5.6, 0x9aa4b6), -len / 2 + 2.6 + c * 4.2 + (len - 1 - per * 4.2) / 2, top + 0.8 + row * 1.7, 0, g);
      }
      return { g, wheels, rw, yB: yW + 2.4, top: top + Math.ceil(n / per) * 1.7, spin(x) { for (const w of wheels) w.rotation.z = -x / rw; } };
    }
    const lamp = (r, on) => mesh(new T.SphereGeometry(r, 16, 10), 0, { mat: own(0x4a5240, { emissive: on, emissiveIntensity: 0 }), hull: true, edges: false });
    return { own, basic, W, plate, screen, texMat, arrow, rod, spring, button, track, cart, lamp };
  }

  // ---------- рисунки текстур ----------
  const rnd = (i) => { const s = Math.sin(i * 127.1 + 31.7) * 43758.5453; return s - Math.floor(s); };
  function drawCarpet(x, w, h) {
    x.fillStyle = '#8a3b4a'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 520; i++) { const px = rnd(i) * w, py = rnd(i + 900) * h; x.strokeStyle = i % 3 ? '#6e2b39' : '#a8525f'; x.lineWidth = 2; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 3, py + 5); x.stroke(); }
  }
  function drawIce(x, w, h) {
    const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#cdeefa'); g.addColorStop(1, '#a9dcf0'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 2;
    for (let i = 0; i < 14; i++) { const px = rnd(i) * w, py = rnd(i + 50) * h; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 40 + rnd(i + 7) * 50, py + 8 + rnd(i + 9) * 14); x.stroke(); }
  }
  function drawAir(x, w, h) {
    x.fillStyle = '#3a4f7a'; x.fillRect(0, 0, w, h); x.fillStyle = '#16203a';
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.beginPath(); x.arc(w * (i + 0.5) / 4, h * (j + 0.5) / 4, 3.2, 0, TAU); x.fill(); }
  }
  function drawEarth(x, w, h) {
    x.fillStyle = '#2f6fb0'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#4c9a62';
    const blobs = [[0.12, 0.32, 0.09, 0.14], [0.2, 0.62, 0.06, 0.16], [0.47, 0.3, 0.1, 0.1], [0.52, 0.58, 0.07, 0.16], [0.7, 0.3, 0.16, 0.12], [0.84, 0.66, 0.06, 0.06], [0.62, 0.45, 0.05, 0.05]];
    for (const [cx, cy, rx, ry] of blobs) { x.beginPath(); x.ellipse(cx * w, cy * h, rx * w, ry * h, 0.3, 0, TAU); x.fill(); }
    x.fillStyle = '#c9a25a'; x.beginPath(); x.ellipse(0.5 * w, 0.4 * h, 0.04 * w, 0.04 * h, 0, 0, TAU); x.fill();
    x.fillStyle = '#f4f8fb'; x.fillRect(0, 0, w, h * 0.07); x.fillRect(0, h * 0.93, w, h * 0.07);
  }

  // =====================================================================================
  // Урок 1: инерция — доска с покрытием (ковёр / лёд / воздушный стол), пусковая пружина, шайба, датчик скорости
  SC['newton-inertia'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const PPM = 12, X0 = -24, BZ = -6, BL = 120, SW = 22;
    at(box(BL, 2.4, 28, C.WOOD2), 0, 1.2, BZ);
    let top = 2.4;
    if (d.surf === 'carpet') { at(box(BL - 4, 1.2, SW, 0, { mat: K.texMat(drawCarpet, 128, 128, 18, 3.4) }), 0, top + 0.6, BZ); top += 1.2; }
    else if (d.surf === 'ice') { at(box(BL - 4, 1.4, SW, 0, { mat: K.texMat(drawIce, 256, 128, 6, 1.5) }), 0, top + 0.7, BZ); top += 1.4; }
    else { at(box(BL - 4, 2.4, SW, 0, { mat: K.texMat(drawAir, 64, 64, 58, 11) }), 0, top + 1.2, BZ); top += 2.4; }
    // воздуходувка с гофрированным шлангом (на подушке гудит и крутит крыльчатку)
    const air = d.surf === 'air', fan = new T.Group();
    { const bl = new T.Group(); at(bl, -40, 0, -32); clickable(bl, 'sf-air');
      at(box(16, 11, 10, 0x56657e), 0, 5.5, 0, bl); at(box(16.4, 1, 10.4, 0x46536a), 0, 11.4, 0, bl);
      at(new T.Mesh(kit.keep(new T.TorusGeometry(3.8, 0.45, 8, 28)), K.own(C.STEEL)), -2.5, 5.8, 5.1, bl);
      at(fan, -2.5, 5.8, 5.2, bl);
      for (let k = 0; k < 4; k++) { const b = box(6.6, 1.2, 0.2, 0x2c3240, { edges: false }); b.rotation.z = k * Math.PI / 4; fan.add(b); }
      const led = mesh(new T.SphereGeometry(0.7, 12, 8), 0, { mat: K.own(air ? 0x3fe07a : 0x4a5240, air ? { emissive: 0x2fd06a, emissiveIntensity: 1 } : {}), hull: true, edges: false }); at(led, 5, 8, 5.1, bl);
      const pl = K.plate(air ? 'ВКЛ' : 'выкл', 4.4, 2, '#fff6e6', air ? '#2e9e4f' : '#5d6573'); at(pl, 5, 4.4, 5.06, bl);
      const pts = [v3(-40 + 8, 5.5, -32), v3(-26, 4, -30), v3(-16, 3, -24), v3(-8, top - 1, BZ - 14), v3(-8, top - 1, BZ - SW / 2 - 0.2)];
      kit.root.add(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 60, 1.3, 10), 0x3a3f4c, { hull: true, edges: false }));
      for (let k = 1; k < 12; k++) { const p = new T.CatmullRomCurve3(pts).getPoint(k / 12); at(cyl(1.45, 0.4, 0x2c3240, { edges: false, hull: false }), p.x, p.y, p.z); }
    }
    // шайба (на подушке парит над столом)
    const pk = new T.Group(); clickable(pk, 'puck');
    const py = top + 0.9 + (air ? 0.6 : 0);
    at(cyl(4.2, 1.8, 0x1d2230, { seg: 32 }), 0, 0, 0, pk);
    at(cyl(4.24, 0.3, 0xffb547, { seg: 32, edges: false }), 0, 0.82, 0, pk);
    at(cyl(1.4, 0.32, 0xfff1d2, { seg: 20, edges: false, hull: false }), 0, 0.99, 0, pk);
    at(pk, X0, py, BZ);
    const cushion = new T.Mesh(kit.keep(new T.CylinderGeometry(5, 5, 0.6, 28, 1, true)), K.basic(0xbfe6ff, { transparent: true, opacity: air ? 0.35 : 0, depthWrite: false }));
    at(cushion, 0, -1.2, 0, pk);
    const vA = K.arrow(0x3fb6d6, 0.42); at(vA.g, 0, 3.4, 0, pk);
    const fA = K.arrow(0xe0473a, 0.42); fA.g.rotation.y = Math.PI; at(fA.g, -4.6, 0, 0, pk);
    vA.set(0); fA.set(0);
    // пусковая пружина (уезжает влево вместе с началом отсчёта, когда шайба далеко)
    const ln = new T.Group(); at(ln, 0, 0, BZ);
    at(box(3, 9, 12, 0x4a5875), X0 - 18, top + 4.5, 0, ln);
    at(box(1.4, 1.4, 12.4, C.STEEL), X0 - 18, top + 9.4, 0, ln);
    const spr = K.spring(8, 1.5, 0.28, 0x72d4e8); spr.set(11.7); at(spr.g, X0 - 16.5, py, 0, ln);
    at(box(0.8, 4, 6, 0xa9b4c9), X0 - 4.8, py, 0, ln);
    clickable(ln, 'puck');
    // метки расстояния: флажки «0 м, 1 м…» вдоль заднего края доски
    const marks = [];
    for (let i = 0; i < 11; i++) {
      const g = new T.Group(); at(g, 0, 0, BZ);
      at(cyl(0.3, 8, C.STEEL, { edges: false }), 0, 6.4, -12.8, g);
      at(box(0.3, 0.06, SW, 0x1b1610, { edges: false, shadow: false }), 0, top + 0.04, 0, g);
      const c = document.createElement('canvas'); c.width = 128; c.height = 64;
      const tex = kit.keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace;
      const fl = new T.Mesh(kit.keep(new T.PlaneGeometry(7, 3.5)), K.basic(0xffffff, { map: tex, side: T.DoubleSide })); at(fl, 3.6, 8.4, -12.8, g);
      marks.push({ g, c, tex, k: null });
    }
    const markText = (m, k) => { const x = m.c.getContext('2d'); x.fillStyle = '#f7f3ea'; x.fillRect(0, 0, 128, 64); x.strokeStyle = '#1b1610'; x.lineWidth = 6; x.strokeRect(3, 3, 122, 58); x.fillStyle = '#1b1610'; x.font = '700 36px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(k + ' м', 64, 34); m.tex.needsUpdate = true; m.k = k; };
    // датчик скорости с экраном v(t)
    const mon = new T.Group(); at(mon, 30, 0, -33);
    for (const x of [-12, 12]) at(box(3, 8, 3, C.DARK), x, 4, 0, mon);
    at(box(36, 21, 5, 0x2c3240), 0, 18, 0, mon);
    const scr = K.screen(32, 17.4, 384, 210); at(scr.m, 0, 18, 2.56, mon);
    // плитки поверхностей спереди
    const SURF = [['carpet', 'ковёр', drawCarpet, 128, 128], ['ice', 'лёд', drawIce, 256, 128], ['air', 'подушка', drawAir, 64, 64]];
    SURF.forEach(([id, name, dr, pw, ph], k) => {
      const g = new T.Group(); at(g, -44 + k * 15, 0, 24); clickable(g, 'sf-' + id);
      const on = d.surf === id;
      if (on) at(box(13, 0.6, 13, 0xffd166), 0, 0.3, 0, g);
      at(box(11, 1.2, 11, 0, { mat: K.texMat(dr, pw, ph, id === 'air' ? 5 : 1.4, id === 'air' ? 5 : 1.4) }), 0, on ? 1.2 : 0.6, 0, g);
      const p = K.plate(name, 11, 2.6, on ? '#1b1610' : '#5d6573', on ? '#ffd166' : '#f7f3ea'); p.rotation.x = -1.1; at(p, 0, 0.9, 7.4, g);
    });

    const pkTag = v3(X0, py + 9, BZ);
    tag(pkTag, 'Шайба', d.moving ? (air ? 'едет, ΣF = 0' : 'едет, тормозит трение') : d.away ? 'нажмите — вернуть' : 'нажмите — толкнуть', d.moving && air);
    tag(v3(-29, 7, 24), 'Поверхность', d.surfName + ' · μ = ' + num(d.mu, 2));
    tag(v3(30, 31, -33), 'Датчик скорости', d.airRun ? '3 с без изменений' : 'график v(t)', d.airRun);
    if (air) tag(v3(-40, 14, -32), 'Воздуходувка', 'воздушная подушка');

    let tick = 0, fanA = 0;
    kit.onFrame((dt, t) => {
      const Lv = live(); if (!Lv) return;
      const px = X0 + (Lv.x - Lv.cam) * PPM;
      pk.position.x = px; pkTag.x = px;
      if (air && !kit.reduce) { pk.position.y = py + 0.12 * Math.sin(t * 9); cushion.material.opacity = 0.25 + 0.12 * Math.sin(t * 13); }
      vA.set(Lv.v > 0 ? 3 + Lv.v * 3.2 : 0);
      fA.set(Lv.v > 0 && d.mu > 0 ? 7 : 0);
      ln.position.x = -Lv.cam * PPM; ln.visible = X0 - 19 - Lv.cam * PPM > -BL / 2 - 2;
      // флажки метров
      const k0 = Math.max(0, Math.ceil(Lv.cam + (-BL / 2 + 3 - X0) / PPM));
      marks.forEach((m, i) => {
        const k = k0 + i, x = X0 + (k - Lv.cam) * PPM;
        m.g.visible = x <= BL / 2 - 3; m.g.position.x = x;
        if (m.g.visible && m.k !== k) markText(m, k);
      });
      if (air && !kit.reduce) { fanA += dt * 22; fan.rotation.z = fanA; }
      // экран датчика скорости
      if ((tick++ & 1) && tick > 2) return;
      const s = scr, x = s.x, w = s.W, h = s.H;
      x.fillStyle = '#06261a'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#86e0a8'; x.font = '700 30px "IBM Plex Mono", monospace'; x.textBaseline = 'top'; x.textAlign = 'left';
      x.fillText('v = ' + num(Lv.v, 2) + ' м/с', 14, 10);
      const gx = 44, gy = 56, gw = w - 60, gh = h - 82;
      x.strokeStyle = 'rgba(140,255,190,.16)'; x.lineWidth = 1; x.font = '500 16px "IBM Plex Mono", monospace'; x.fillStyle = 'rgba(200,255,220,.7)'; x.textAlign = 'right'; x.textBaseline = 'middle';
      for (let v = 0; v <= 4; v++) { const y = gy + gh - gh * v / 4; x.beginPath(); x.moveTo(gx, y); x.lineTo(gx + gw, y); x.stroke(); x.fillText(String(v), gx - 8, y); }
      x.textAlign = 'right'; x.textBaseline = 'top'; x.fillText('t, последние 6 с', gx + gw, gy + gh + 6);
      const pts = (Lv.hist || []).map(p => [gx + gw * (1 - (Lv.simT - p.t) / 6), gy + gh - gh * Math.min(p.v, 4) / 4]);
      if (pts.length > 1) { x.strokeStyle = '#72d4e8'; x.lineWidth = 3.4; x.shadowColor = '#72d4e8'; x.shadowBlur = 8; x.beginPath(); pts.forEach(([a, b], k) => k ? x.lineTo(a, b) : x.moveTo(a, b)); x.stroke(); x.shadowBlur = 0; }
      s.tex.needsUpdate = true;
    });
  };

  // =====================================================================================
  // Урок 2: F = ma — трек, тележка с гирями, динамометр, нить на барабан лебёдки, световые ворота «старт» и «1 м», секундомер, пульт
  SC['newton-second'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const PPM = 60, XS = -30, Z = -4;
    K.track(-56, 46, Z, { stopL: true });
    // шкала между воротами: каждые 10 см
    for (let k = 0; k <= 10; k++) at(box(0.3, k % 5 ? 0.7 : 1.3, 0.12, 0x1b1610, { edges: false, shadow: false }), XS + k * 6, 3.2 - (k % 5 ? 0.35 : 0.65) + 0.7, Z + 5.27);
    // световые ворота
    const gates = [];
    for (const [x, name] of [[XS, 'старт'], [XS + PPM, '1 м']]) {
      const g = new T.Group(); at(g, x, 0, Z);
      for (const s of [-1, 1]) { at(box(1.6, 1, 3.6, C.DARK), 0, 0.5, s * 8, g); at(box(1.2, 17, 1.2, 0x3a3f4c), 0, 9.5, s * 8, g); at(box(2.2, 2.2, 1.6, 0xe0473a), 0, 9, s * 7, g); }
      at(box(1.4, 1.4, 17.4, 0x3a3f4c), 0, 18.4, 0, g);
      const lp = K.lamp(1.1, 0x3fff8a); at(lp, 0, 19.9, 0, g);
      const pl = K.plate(name, 6, 2.2); pl.rotation.x = -1.1; at(pl, 0, 0.8, 11.4, g);
      gates.push({ g, lp });
    }
    // тележка с гирями и динамометром на носу
    const n = Math.round((d.m - 0.5) / 0.5), CL = 18;
    const ct = K.cart(CL, 0x4c7fd1, n); clickable(ct.g, 'm-'); at(ct.g, XS - CL / 2, 0, Z);
    const yS = ct.yB;
    at(box(1.6, 0.8, 0.8, C.STEEL), CL / 2 + 0.6, yS, 0, ct.g);
    const dyn = new T.Group(); at(dyn, CL / 2 + 1.4, yS, 0, ct.g);
    { const tb = cyl(1.25, 10, 0xe8ecf4); tb.rotation.z = Math.PI / 2; at(tb, 5, 0, 0, dyn);
      for (let k = 0; k <= 10; k++) at(box(0.14, k % 5 ? 0.5 : 0.9, 0.12, 0x1b1610, { edges: false, shadow: false }), 1 + k * 0.8, 0.9, 1.05, dyn);
      const pin = box(0.5, 2.9, 2.9, 0xe0473a, { edges: false }); at(pin, 1 + clamp(d.F, 0, 10) * 0.8, 0, 0, dyn);
      const rr = cyl(0.35, 2.6, C.STEEL, { edges: false }); rr.rotation.z = Math.PI / 2; at(rr, 11.2, 0, 0, dyn);
      at(new T.Mesh(kit.keep(new T.TorusGeometry(0.8, 0.22, 6, 16)), K.own(C.STEEL)), 13.1, 0, 0, dyn); }
    const hookL = v3(CL / 2 + 1.4 + 13.9, yS, 0);
    // лебёдка: барабан наматывает нить
    const wn = new T.Group(); at(wn, 56, 0, Z); clickable(wn, 'go');
    at(box(12, 1.2, 14, C.DARK), 0, 0.6, 0, wn);
    for (const s of [-1, 1]) at(box(6, 8.4, 1, 0x3b4a66), 0, 5.4, s * 4.6, wn);
    const drum = new T.Group(); at(drum, 0, yS - 2.6, 0, wn);
    { const dr = cyl(2.2, 8, 0xd9dfe9); dr.rotation.x = Math.PI / 2; drum.add(dr);
      for (const s of [-1, 1]) { const f = cyl(3.2, 0.5, C.STEEL); f.rotation.x = Math.PI / 2; at(f, 0, 0, s * 3.8, drum); }
      at(box(0.5, 4.6, 8.2, 0x8b93a1, { edges: false }), 0, 0, 0, drum);
      for (let k = 0; k < 4; k++) { const w = cyl(2.32, 0.5, 0xe9d9a8, { edges: false, hull: false }); w.rotation.x = Math.PI / 2; at(w, 0, 0, -1.2 + k * 0.7, drum); } }
    at(box(8, 7, 7, 0x3fae5a), 0, 3.5 + 1.2, -9, wn);
    const ax = cyl(0.6, 6, C.STEEL, { edges: false }); ax.rotation.x = Math.PI / 2; at(ax, 0, yS - 2.6, -5, wn);
    const str = K.rod(0xe9d9a8, 0.2); kit.root.add(str.m);
    const drumTop = v3(56, yS - 0.4, Z);
    // секундомер, к нему провода от ворот
    const sw = new T.Group(); at(sw, -6, 0, 25);
    at(box(24, 10, 9, 0x2c3240), 0, 5, 0, sw); at(box(24.4, 1, 9.4, 0x46536a), 0, 10.5, 0, sw);
    const ss = K.screen(20, 6.4, 320, 102); at(ss.m, 0, 6, 4.56, sw);
    const sl = K.plate('секундомер · 1 м', 12, 1.8, '#fff6e6', '#2c3240'); at(sl, 0, 1.8, 4.56, sw);
    for (const [k, gx] of [[0, -6], [1, 6]]) kit.cable(K.W(sw, v3(gx, 10.2, -3)), v3(gates[k].g.position.x, 1, Z + 9), 0x2c3240, 0, { r: 0.45, lift: 2 });
    // пульт лебёдки: F −, F +, Пуск
    const pu = new T.Group(); at(pu, 32, 0, 27);
    at(box(38, 9, 9, 0x3b4a66), 0, 4.5, 0, pu);
    const fs = K.plate('F = ' + nf(d.F) + ' Н', 12, 4.2, '#ffb547', '#0e1520'); at(fs, -11.4, 4.6, 4.56, pu);
    const bo = { w: 7, h: 4.8 };
    K.button(pu, -0.6, 4.6, 4.7, 'F −', 'f-', bo); K.button(pu, 7.2, 4.6, 4.7, 'F +', 'f+', bo);
    K.button(pu, 15, 4.6, 4.7, d.run ? '…' : 'Пуск', 'go', { ...bo, col: d.run ? 0x3fae5a : 0xe0473a, bg: d.run ? '#3fae5a' : '#e0473a', fg: '#ffffff' });
    kit.cable(K.W(pu, v3(12, 9, -3)), K.W(wn, v3(-3, 7, -9)), 0x2c3240, 0, { r: 0.5, lift: 2 });
    // гири по 0,5 кг
    const wt = new T.Group(); at(wt, -46, 0, 25); clickable(wt, 'm+');
    at(box(14, 1.2, 10, C.WOOD2), 0, 0.6, 0, wt);
    for (let k = 0; k < 4; k++) at(box(3.6, 1.6, 5.6, 0x9aa4b6), -4.8 + (k % 3) * 4.6 + (k > 2 ? 2.3 : 0), 2 + (k > 2 ? 1.7 : 0), 0, wt);
    const wl = K.plate('+0,5 кг', 8, 2.2); wl.rotation.x = -1.1; at(wl, 0, 0.6, 6.4, wt);

    const ctTag = v3(XS - CL / 2, ct.top + 4, Z);
    tag(ctTag, 'Тележка', nf(d.m) + ' кг · нажмите — снять гирю');
    tag(v3(56, 17, Z), 'Лебёдка', 'F = ' + nf(d.F) + ' Н');
    const L = d.last, okRun = L && L.a === '1,50';
    tag(v3(-6, 14, 25), 'Секундомер', L ? `${nf(L.m)} кг, ${nf(L.F)} Н: ${L.t} с → a = ${L.a} м/с²` : 'заезд на 1 м', okRun);
    tag(v3(32, 12, 27), 'Пульт', 'a = F / m = ' + num(d.a, 2) + ' м/с²', Math.abs(d.a - 1.5) < 1e-6);
    tag(v3(-46, 7, 25), 'Гири', 'нажмите — догрузить');

    let tick = 0;
    kit.onFrame(() => {
      const Lv = live(); if (!Lv) return;
      const fx = XS + Lv.s * PPM;
      ct.g.position.x = fx - CL / 2; ctTag.x = fx - CL / 2; ct.spin(Lv.s * PPM);
      drum.rotation.z = -Lv.s * PPM / 2.2;
      const hk = v3(fx - CL / 2, 0, Z).add(hookL); str.set(hk, drumTop);
      gates[0].lp.material.emissiveIntensity = Lv.run || Lv.s > 0 ? 1 : 0;
      gates[1].lp.material.emissiveIntensity = Lv.s >= 0.999 ? 1 : 0;
      if ((tick++ & 1) && tick > 2) return;
      const x = ss.x; x.fillStyle = '#0c1a14'; x.fillRect(0, 0, ss.W, ss.H);
      x.fillStyle = '#86e0a8'; x.font = '600 66px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.shadowColor = '#86e0a8'; x.shadowBlur = 10; x.fillText(num(Lv.t, 2) + ' с', ss.W / 2, ss.H / 2 + 3); x.shadowBlur = 0;
      ss.tex.needsUpdate = true;
    });
  };

  // =====================================================================================
  // Урок 3: третий закон — две тележки на треке, пружина между ними, датчики силы на бортах, таблички с парами масс
  SC['newton-third'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const PPM = 56, Z = -4, CW = 0.256 * PPM;
    K.track(-60, 60, Z, { stopL: true, stopR: true });
    const mk = (m, col, side) => {
      const c = K.cart(CW, col, m - 1); clickable(c.g, 'fire'); at(c.g, 0, 0, Z);
      // датчик силы на боковом борту: табло к зрителю
      at(box(9.6, 3, 0.8, 0x1b1f28), 0, c.yB + 0.9, 3.9, c.g);
      const s = K.screen(8.8, 2.4, 176, 48); at(s.m, 0, c.yB + 0.9, 4.32, c.g);
      // упорная площадка датчика со стороны пружины
      at(box(0.8, 3.4, 4.6, 0x2c3240), side * (CW / 2 + 0.4), c.yB, 0, c.g);
      return { ...c, s };
    };
    const cL = mk(d.mL, 0x2f8aa0, 1), cR = mk(d.mR, 0xc98a3e, -1);
    // пружина на левой тележке
    const sg = new T.Group(); at(sg, CW / 2 + 0.8, cL.yB, 0, cL.g);
    const spr = K.spring(5, 1.5, 0.24, 0xc8d2e3); sg.add(spr.g);
    const pad = box(0.6, 3.6, 4.4, 0xa9b4c9); sg.add(pad);
    // скорость после толчка — стрелки над тележками
    const aL = K.arrow(0x72d4e8, 0.5), aR = K.arrow(0xffb547, 0.5);
    aL.g.rotation.y = Math.PI; at(aL.g, 0, cL.top + 3, 0, cL.g); at(aR.g, 0, cR.top + 3, 0, cR.g); aL.set(0); aR.set(0);
    // таблички пар масс
    [[1, 2], [1, 3], [2, 2], [3, 1]].forEach(([a, b], k) => {
      const on = d.mL === a && d.mR === b, g = new T.Group(); at(g, -30 + k * 20, 0, 26); clickable(g, `pr-${a}-${b}`);
      at(box(16, on ? 1.4 : 0.8, 6, on ? 0xffd166 : C.WOOD2), 0, on ? 0.7 : 0.4, 0, g);
      const p = K.plate(`${a} и ${b} кг`, 14, 4, on ? '#1b1610' : '#5d6573', on ? '#ffd166' : '#f7f3ea'); p.rotation.x = -Math.PI / 2; at(p, 0, on ? 1.45 : 0.85, 0, g);
    });

    const tL = v3(0, cL.top + 9, Z), tR = v3(0, cR.top + 9, Z);
    const sp = d.sep;
    tag(tL, 'Тележка ' + d.mL + ' кг', sp ? 'v = ' + num(sp.vL, 2) + ' м/с' : 'с пружиной');
    tag(tR, 'Тележка ' + d.mR + ' кг', sp ? 'v = ' + num(sp.vR, 2) + ' м/с' : d.run ? 'толчок…' : 'нажмите — толкнуть');
    tag(v3(0, 1, Z + 18), 'Датчики силы', sp ? 'оба ' + num(sp.F, 1) + ' Н' : 'сила толчка', !!sp);

    const nat = d.nat * PPM; let tick = 0;
    const show = (s, F) => { const x = s.x; x.fillStyle = '#0c1a14'; x.fillRect(0, 0, s.W, s.H); x.fillStyle = '#86e0a8'; x.font = '600 40px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(num(F, 1) + ' Н', s.W / 2, s.H / 2 + 2); s.tex.needsUpdate = true; };
    kit.onFrame(() => {
      const Lv = live(); if (!Lv) return;
      const lr = Lv.xL * PPM, rl = Lv.xR * PPM;
      cL.g.position.x = lr - CW / 2; cR.g.position.x = rl + CW / 2; tL.x = cL.g.position.x; tR.x = cR.g.position.x;
      cL.spin(lr); cR.spin(rl);
      const len = Math.max(1, Math.min(nat, rl - lr) - 1.6);
      spr.set(len); pad.position.x = len;
      aL.set(Math.abs(Lv.vL) > 0.01 ? 4 + Math.abs(Lv.vL) * 12 : 0); aR.set(Math.abs(Lv.vR) > 0.01 ? 4 + Math.abs(Lv.vR) * 12 : 0);
      if ((tick++ & 1) && tick > 2) return;
      const F = Lv.F > 0.05 ? Lv.F : 0; show(cL.s, F); show(cR.s, F);
    });
  };

  // =====================================================================================
  // Урок 4: всемирное тяготение — учебная модель: глобус на подставке, штанга с линейкой R…6R, корабль на каретке, стрелка силы, табло и пульт
  function gravTex(kit, d) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 300; const x = c.getContext('2d');
    x.fillStyle = '#0e1520'; x.fillRect(0, 0, 512, 300);
    x.fillStyle = '#ffb547'; x.font = '700 46px "IBM Plex Mono", monospace'; x.textBaseline = 'top'; x.textAlign = 'left';
    x.fillText('F = ' + d.Ftxt, 18, 14);
    x.fillStyle = '#86e0a8'; x.font = '600 26px "IBM Plex Mono", monospace';
    x.fillText('g = ' + d.gtxt, 18, 72); x.fillText('h = ' + d.hkm + ' км', 300, 72);
    const gx = 60, gy = 120, gw = 430, gh = 140, X = r => gx + gw * (r - 1) / 5, Y = f => gy + gh - gh * f;
    x.strokeStyle = 'rgba(160,185,230,.25)'; x.lineWidth = 1.5; x.fillStyle = '#8b96ad'; x.font = '500 18px "IBM Plex Mono", monospace';
    for (let r = 1; r <= 6; r++) { x.beginPath(); x.moveTo(X(r), gy); x.lineTo(X(r), gy + gh); x.stroke(); x.textAlign = 'center'; x.fillText(r === 1 ? 'R' : r + 'R', X(r), gy + gh + 8); }
    for (const [f, t] of [[1, 'F₀'], [0.25, 'F₀/4'], [0, '0']]) { x.beginPath(); x.moveTo(gx, Y(f)); x.lineTo(gx + gw, Y(f)); x.stroke(); x.textAlign = 'right'; x.fillText(t, gx - 6, Y(f) - 9); }
    x.strokeStyle = '#ffb547'; x.lineWidth = 3.5; x.beginPath();
    for (let r = 1; r <= 6.001; r += 0.05) { const p = [X(r), Y(1 / (r * r))]; r === 1 ? x.moveTo(...p) : x.lineTo(...p); } x.stroke();
    x.fillStyle = '#ffb547'; x.strokeStyle = '#04070d'; x.lineWidth = 3; x.beginPath(); x.arc(X(d.r), Y(1 / (d.r * d.r)), 9, 0, TAU); x.fill(); x.stroke();
    const t = kit.keep(new kit.T.CanvasTexture(c)); t.colorSpace = kit.T.SRGBColorSpace; return t;
  }
  SC['newton-gravity'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const RU = 11, EX = -36, EY = 20, Z = 4, sx = r => EX + RU + 3 + (r - 1) * RU;   // у поверхности корабль стоит с зазором 3
    // глобус на подставке с наклонённой осью
    const gb = new T.Group(); at(gb, EX, 0, Z);
    at(cyl(8, 1.6, C.WOOD2, { seg: 32 }), 0, 0.8, 0, gb);
    at(cyl(1.2, EY - RU - 1, C.BRASS), 0, 1.6 + (EY - RU - 1) / 2, 0, gb);
    const tilt = new T.Group(); at(tilt, 0, EY, 0, gb); tilt.rotation.z = 0.41;
    const arc = new T.Mesh(kit.keep(new T.TorusGeometry(RU + 1.2, 0.45, 8, 48, Math.PI)), K.own(C.BRASS)); arc.rotation.z = Math.PI / 2; tilt.add(arc);
    at(cyl(0.35, 2 * RU + 4, C.STEEL, { edges: false }), 0, 0, 0, tilt);
    const spin = new T.Group(); tilt.add(spin);
    spin.add(mesh(new T.SphereGeometry(RU, 48, 32), 0, { mat: K.texMat(drawEarth, 512, 256, 1, 1), hull: true, edges: false }));
    clickable(gb, 'r1');
    // штанга со стойками и линейкой
    const x0 = EX + RU + 0.2, x1 = sx(6.3);
    const bar = cyl(0.5, x1 - x0, C.STEEL, { edges: false }); bar.rotation.z = Math.PI / 2; at(bar, (x0 + x1) / 2, EY, Z);
    for (const x of [sx(2.2), x1 - 1]) { at(cyl(3, 1, C.DARK), x, 0.5, Z); at(cyl(0.7, EY - 1, C.STEEL, { edges: false }), x, (EY - 1) / 2 + 1, Z); at(box(2, 1.6, 1.6, C.DARK), x, EY - 0.6, Z); }
    at(box(sx(6.2) - sx(1) + 6, 1, 6, 0xf1e3c2), (sx(1) + sx(6.2)) / 2, 0.5, Z + 9);
    for (let r = 1; r <= 6; r += 0.5) {
      const big = r % 1 === 0; at(box(0.35, 0.1, big ? 3 : 1.6, 0x1b1610, { edges: false, shadow: false }), sx(r), 1.05, Z + 7.4 + (big ? 0 : -0.7));
      if (big) { const p = K.plate(r === 1 ? 'R' : r + 'R', 4.6, 2.4, '#1b1610', '#f1e3c2'); p.rotation.x = -Math.PI / 2; at(p, sx(r), 1.06, Z + 10.4); }
    }
    // корабль на каретке; над ним — флажок со стрелкой силы к центру Земли
    const sc = { 500: 0.85, 1000: 1, 2000: 1.2 }[d.mc] || 1;
    const cr = new T.Group(); at(cr, sx(mem.r4 ?? d.r), EY, Z); clickable(cr, 'r+');
    at(box(3, 2.2, 2.2, 0x3a3f4c), 0, 0, 0, cr);
    const body = new T.Group(); body.scale.setScalar(sc); cr.add(body);
    at(box(4.4, 4, 4, 0xd6dbe5), 0, -3.6, 0, body);
    for (const s of [-1, 1]) { at(box(0.5, 0.5, 2.2, C.STEEL), 0, -3.6, s * 3, body); at(box(3.6, 0.3, 5, 0x3b6fd8), 0, -3.6, s * 6.4, body); for (let k = -1; k <= 1; k++) at(box(3.62, 0.32, 0.12, 0xa9c4f0, { edges: false }), 0, -3.6, s * 6.4 + k * 1.6, body); }
    at(cyl(1.6, 1, 0xd6dbe5, { r2: 0.3 }), 0, -6.1, 0, body);
    const lt = mesh(new T.SphereGeometry(0.6, 12, 8), 0, { mat: K.own(0xffb547, { emissive: 0xffb547, emissiveIntensity: 0.8 }), hull: true, edges: false }); at(lt, 2.3, -3.6, 0, body);
    at(cyl(0.22, 14, C.STEEL, { edges: false }), 0, 8, 0, cr);
    const fA = K.arrow(0xffb547, 0.6); fA.g.rotation.y = Math.PI; at(fA.g, 0, 15.4, 0, cr);
    const plumb = cyl(0.12, 1, 0x8b96ad, { edges: false, hull: false }); kit.root.add(plumb);
    const mark = cyl(1.1, 0.5, 0xe0473a, { r2: 0, seg: 3 }); mark.rotation.x = -Math.PI / 2; kit.root.add(mark);
    // табло с силой и графиком F(r)
    const tb = new T.Group(); at(tb, 30, 0, -32);
    for (const x of [-11, 11]) at(box(3, 9, 3, C.DARK), x, 4.5, 0, tb);
    at(box(34, 21, 5, 0x2c3240), 0, 19, 0, tb);
    const scr = new T.Mesh(kit.keep(new T.PlaneGeometry(31, 18.2)), K.basic(0xffffff, { map: gravTex(kit, d) })); at(scr, 0, 19, 2.56, tb);
    // пульт: r −, r +, r = R и массы корабля
    const pu = new T.Group(); at(pu, -44, 0, 34);
    at(box(36, 12, 9, 0x3b4a66), 0, 6, 0, pu);
    K.button(pu, -11.6, 8.8, 4.7, 'r −', 'r-', { w: 8, h: 4.4 }); K.button(pu, -2.6, 8.8, 4.7, 'r +', 'r+', { w: 8, h: 4.4 }); K.button(pu, 8.6, 8.8, 4.7, 'r = R', 'r1', { w: 11, h: 4.4 });
    (d.masses || [500, 1000, 2000]).forEach((m, k) => { const on = m === d.mc; K.button(pu, -11 + k * 11, 3.2, 4.7, m + ' кг', 'mc-' + m, { w: 10, h: 4.4, col: on ? 0xffd166 : 0xe8ecf4, bg: on ? '#ffd166' : '#e8ecf4' }); });

    const crTag = v3(sx(d.r), EY + 20, Z);
    tag(v3(EX - 13, EY - 2, Z), 'Земля', 'M = 6·10²⁴ кг');
    tag(crTag, 'Корабль ' + d.mc + ' кг', 'r = ' + nf(d.r) + 'R');
    tag(v3(30, 32, -32), 'Сила тяготения', 'F = ' + d.Ftxt, Math.abs(d.r - 1) < 1e-6 || Math.abs(d.r - 2) < 1e-6);
    tag(v3(-44, 13, 34), 'Пульт', 'r от центра Земли');

    let cur = mem.r4 ?? d.r;
    const place = () => {
      const x = sx(cur); cr.position.x = x; crTag.x = x;
      fA.set(3 + 15 / (cur * cur));
      plumb.position.set(x, (EY - 6.5 * sc + 1) / 2, Z); plumb.scale.y = Math.max(0.1, EY - 6.5 * sc - 1);
      mark.position.set(x, 1.3, Z + 6.9);
    };
    place();
    kit.onFrame((dt) => {
      cur += (d.r - cur) * Math.min(1, dt * 6); if (Math.abs(d.r - cur) < 0.002) cur = d.r; mem.r4 = cur; place();
      if (!kit.reduce) spin.rotation.y += dt * 0.25;
    });
  };

  // =====================================================================================
  // Урок 5: движение по окружности — гладкий круглый стол, ось с датчиком натяжения, нить, мяч; обрыв — мяч летит по касательной
  SC['newton-circle'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const PPM = 24, CX = -16, CZ = 2, DR = 40, BR = 2.4, yT = 1.6, yB = yT + BR, Rr = d.r * PPM;
    at(cyl(DR, yT, 0xdfe8ef, { seg: 64 }), CX, yT / 2, CZ);
    const ring = new T.Mesh(kit.keep(new T.TorusGeometry(Rr, 0.16, 6, 96)), K.basic(0x8b96ad, { transparent: true, opacity: 0.7 })); ring.rotation.x = Math.PI / 2; at(ring, CX, yT + 0.05, CZ);
    // ось с подшипником и датчиком натяжения
    const ax = new T.Group(); at(ax, CX, 0, CZ);
    at(cyl(3, 1, C.DARK), 0, yT + 0.5, 0, ax);
    at(cyl(1.1, 9, C.STEEL), 0, yT + 5, 0, ax);
    at(cyl(2, 1.2, C.BRASS), 0, yB, 0, ax);
    const hot = d.broke || d.F > d.Fmax * 0.85;
    at(box(6, 4, 5, 0x2c3240), 0, yT + 11.5, 0, ax);
    const fs = K.plate(d.broke ? 'обрыв' : num(d.F, 2) + ' Н', 5.2, 2.4, hot ? '#ff8a73' : '#86e0a8', '#0c1a14'); at(fs, 0, yT + 11.5, 2.56, ax);
    // рука: нить и мяч, крутится вокруг оси
    const arm = new T.Group(); at(arm, CX, 0, CZ);
    const sc = cyl(0.2, Math.max(0.5, Rr - BR - 1.8), hot ? 0xe0473a : 0xe9d9a8, { edges: false, seg: 8 }); sc.rotation.z = Math.PI / 2; at(sc, 1.8 + (Rr - BR - 1.8) / 2, yB, 0, arm);
    const ball = new T.Group(); at(ball, Rr, yB, 0, arm);
    ball.add(mesh(new T.SphereGeometry(BR, 28, 18), 0xd9483b, { hull: true, edges: false }));
    const seam = new T.Mesh(kit.keep(new T.TorusGeometry(BR * 1.005, 0.12, 6, 32)), K.basic(0xf3b0a8)); ball.add(seam);
    const vA = K.arrow(0x3fb6d6, 0.45); vA.g.rotation.y = -Math.PI / 2; at(vA.g, Rr, yB + 3.4, 0, arm); vA.set(3 + d.v * 1.6);
    const aA = K.arrow(0xffb547, 0.45); aA.g.rotation.y = Math.PI; at(aA.g, Rr - 0.6, yB + 3.4, 0, arm); aA.set(Math.min(Rr - 4, 3 + Math.sqrt(d.a) * 1.4));
    arm.visible = !d.broke;
    // после обрыва: обрывок нити, след по касательной, улетающий мяч
    let fb = null;
    if (d.broke && d.fly) {
      const st = cyl(0.2, 3, 0xe9d9a8, { edges: false, seg: 8 }); st.rotation.z = Math.PI / 2 - 0.25; at(st, CX + 2.8, yB - 0.3, CZ);
      const f = d.fly, p0 = v3(CX + f.x * PPM, 0, CZ + f.z * PPM), u = v3(f.ux, 0, f.uz).normalize();
      for (let k = 0; k < 16; k++) { const p = p0.clone().addScaledVector(u, 3 + k * 4.2); if (Math.abs(p.x) > 68 || p.z > 52 || p.z < -44) break; const dd = box(2.2, 0.08, 0.45, 0x3fb6d6, { edges: false, shadow: false }); dd.rotation.y = -Math.atan2(u.z, u.x); at(dd, p.x, Math.hypot(p.x - CX, p.z - CZ) < DR ? yT + 0.06 : 0.06, p.z); }
      fb = new T.Group(); fb.add(mesh(new T.SphereGeometry(BR, 28, 18), 0xd9483b, { hull: true, edges: false })); at(fb, p0.x, yB, p0.z); clickable(fb, 'home5');
      fb.userData.p0 = p0; fb.userData.u = u;
    }
    // пульт: v −, v +, длина нити, вернуть мяч
    const pu = new T.Group(); at(pu, 42, 0, 26);
    at(box(40, 12, 9, 0x3b4a66), 0, 6, 0, pu);
    const vs = K.plate('v = ' + nf(d.v) + ' м/с', 17, 4.2, '#72d4e8', '#0e1520'); at(vs, -9.5, 8.8, 4.56, pu);
    K.button(pu, 5, 8.8, 4.7, 'v −', 'v-', { w: 7.6, h: 4.4 }); K.button(pu, 13.6, 8.8, 4.7, 'v +', 'v+', { w: 7.6, h: 4.4 });
    [0.5, 1, 1.5].forEach((r, k) => { const on = r === d.r; K.button(pu, -14.8 + k * 8.4, 3.2, 4.7, nf(r) + ' м', 'r5-' + r, { w: 7.6, h: 4.4, col: on ? 0xffd166 : 0xe8ecf4, bg: on ? '#ffd166' : '#e8ecf4' }); });
    K.button(pu, 12.4, 3.2, 4.7, '↺ мяч', 'home5', { w: 10, h: 4.4, col: d.broke ? 0xe0473a : 0xe8ecf4, bg: d.broke ? '#e0473a' : '#e8ecf4', fg: d.broke ? '#ffffff' : '#1b1610' });

    tag(v3(CX, yT + 17, CZ), 'Датчик натяжения', d.broke ? 'нить порвалась' : 'F = ' + num(d.F, 2) + ' Н из ' + d.Fmax, hot);
    tag(v3(42, 15, 26), 'Мяч ' + nf(d.mb) + ' кг', 'a = v²/r = ' + num(d.a, 1) + ' м/с²', d.atMax && !d.broke);
    if (d.broke) tag(v3(CX + (d.fly ? d.fly.x * PPM : 0), 8, CZ + (d.fly ? d.fly.z * PPM : 0)), 'По касательной', 'нажмите ↺ мяч');

    kit.onFrame(() => {
      const Lv = live(); if (!Lv) return;
      if (!Lv.broke) { arm.rotation.y = -Lv.ang; ball.rotation.x = Lv.ang * Rr / BR; return; }
      if (!fb) return;
      const p = fb.userData.p0.clone().addScaledVector(fb.userData.u, d.v * PPM * Lv.ft);
      const off = Math.abs(p.x) > 70 || p.z > 54 || p.z < -46;
      fb.visible = !off; if (off) return;
      fb.position.set(p.x, Math.hypot(p.x - CX, p.z - CZ) < DR ? yB : BR, p.z);
      fb.rotation.z = -d.v * PPM * Lv.ft / BR;
    });
  };
})();
