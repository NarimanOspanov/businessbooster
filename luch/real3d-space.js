// «Как в жизни» для темы «Космос: спутники и невесомость» (labs/phys-space): настольные модели —
// глобус с горой Ньютона и следами выстрелов, глобус с орбитами и спутником, лифт-тренажёр с весами,
// макет космодрома с ракетой, морем и посадочной площадкой.
// Описание сцены приходит из window.LUCH_REAL() опыта; положения (ядро, спутник, кабина, ракета) — из window.LUCH_REAL.live() каждый кадр.
(() => {
  const SC = (window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {});
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const live = () => { try { const f = window.LUCH_REAL && window.LUCH_REAL.live; return f ? f() : null; } catch (e) { return null; } };
  const TAU = Math.PI * 2;
  const num = (x, n) => { let s = (Math.round(x * 10 ** n) / 10 ** n).toFixed(n); if (/^-0(\.0+)?$/.test(s)) s = s.slice(1); return s.replace('.', ','); };

  // ---------- общие детали темы ----------
  function tools(kit) {
    const { T, at, box, cyl, mesh, keep, v3, C } = kit;
    const own = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: kit.grad, ...o }));
    const basic = (color, o = {}) => keep(new T.MeshBasicMaterial({ color, ...o }));
    function plate(txt, w, h, fg = '#1b1610', bg = '#f7f3ea') {
      const t = keep(kit.textTex(txt, fg, bg, Math.round(64 * w / h), 64));
      return new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: t })));
    }
    function screen(w, h, pw = 288, ph = 192) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph;
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace;
      const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: tex })));
      return { m, c, x: c.getContext('2d'), tex, W: pw, H: ph };
    }
    function button(parent, x, y, z, txt, key, o = {}) {
      const b = new T.Group(); at(b, x, y, z, parent);
      const w = o.w || 5, h = o.h || 3.4;
      at(box(w, h, 1.4, o.col || 0xe8ecf4), 0, 0, 0, b);
      const p = plate(txt, w - 0.9, h - 1, o.fg || '#1b1610', o.bg || '#e8ecf4'); at(p, 0, 0, 0.72, b);
      kit.clickable(b, key); return b;
    }
    function rod(col, r = 0.22) {
      const m = cyl(r, 1, col, { edges: false, hull: false, seg: 8 }); const up = v3(0, 1, 0), dv = v3(0, 0, 0);
      return { m, set(a, b) { dv.copy(b).sub(a); const l = dv.length(); if (l < 1e-4) { m.visible = false; return; } m.visible = true; m.position.copy(a).addScaledVector(dv, 0.5); m.quaternion.setFromUnitVectors(up, dv.multiplyScalar(1 / l)); m.scale.set(1, l, 1); } };
    }
    function console3(x, z, w, title) {
      const g = new T.Group(); at(g, x, 0, z);
      at(box(w, 12, 9, 0x3b4a66), 0, 6, 0, g);
      if (title) { const p = plate(title, w - 4, 2.2, '#fff6e6', '#3b4a66'); p.rotation.x = -Math.PI / 2; at(p, 0, 12.05, -2.4, g); }
      return g;
    }
    function earthMat(w = 512, h = 256) {
      const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
      x.fillStyle = '#2f6fb0'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#4c9a62';
      const blobs = [[0.12, 0.32, 0.09, 0.14], [0.2, 0.62, 0.06, 0.16], [0.47, 0.3, 0.1, 0.1], [0.52, 0.58, 0.07, 0.16], [0.7, 0.3, 0.16, 0.12], [0.84, 0.66, 0.06, 0.06], [0.62, 0.45, 0.05, 0.05], [0.33, 0.42, 0.04, 0.08]];
      for (const [cx, cy, rx, ry] of blobs) { x.beginPath(); x.ellipse(cx * w, cy * h, rx * w, ry * h, 0.3, 0, TAU); x.fill(); }
      x.fillStyle = '#f4f8fb'; x.fillRect(0, 0, w, h * 0.07); x.fillRect(0, h * 0.93, w, h * 0.07);
      const t = keep(new T.CanvasTexture(c)); t.colorSpace = T.SRGBColorSpace;
      return own(0xffffff, { map: t });
    }
    // глобус на подставке; o.back — держатель сзади (чтобы не мешал траекториям в плоскости z = Z)
    function globe(X, Y, Z, R, o = {}) {
      const g = new T.Group(); at(g, X, 0, Z);
      at(cyl(9, 1.6, C.WOOD2, { seg: 32 }), 0, 0.8, o.back ? -o.back : 0, g);
      if (o.back) {
        at(cyl(1.1, Y, C.BRASS), 0, Y / 2 + 1.6, -o.back, g);
        const arm = cyl(0.9, o.back - R + 0.6, C.BRASS); arm.rotation.x = Math.PI / 2; at(arm, 0, Y, -(o.back + R) / 2 - 0.3, g);
      } else at(cyl(1.2, Y - R - 1.6, C.BRASS), 0, 1.6 + (Y - R - 1.6) / 2, 0, g);
      const spin = new T.Group(); at(spin, 0, Y, 0, g);
      spin.add(mesh(new T.SphereGeometry(R, 48, 32), 0, { mat: earthMat(), hull: true, edges: false }));
      return { g, spin };
    }
    return { own, basic, plate, screen, button, rod, console3, globe };
  }
  const COL = { fell: 0xff8a73, orbit: 0x86e0a8, ellipse: 0x72d4e8, far: 0xc9a2ff, esc: 0xffd166 };

  // =====================================================================================
  // Урок 1: пушка Ньютона — глобус, гора с пушкой, следы выстрелов в вертикальной плоскости, пульт скорости
  SC['space-cannon'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const RG = 20, EY = 40, Z = -6, SS = RG / (d.RE || 0.9);
    const P = (x, y) => v3(x * SS, EY + y * SS, Z);
    const gl = K.globe(0, EY, Z, RG, { back: 30 });
    // гора и пушка на вершине
    const mt = mesh(new T.ConeGeometry(4.2, SS - RG + 2.2, 24), 0x7a6a58, { hull: true, edges: false }); at(mt, 0, EY + RG - 2.2 + (SS - RG + 2.2) / 2, Z);
    const cap = mesh(new T.ConeGeometry(1.5, 1.3, 16), 0xeef4f8, { edges: false }); at(cap, 0, EY + SS - 0.62, Z);
    const gun = new T.Group(); at(gun, 0, EY + SS + 0.6, Z); clickable(gun, 'fire');
    const br = cyl(0.7, 4.4, 0x3a4152, { seg: 14 }); br.rotation.z = Math.PI / 2; at(br, 1.5, 0.4, 0, gun);
    at(box(3, 1, 2, 0x8a5a30), -0.4, -0.3, 0, gun);
    for (const s of [-1, 1]) { const w = cyl(0.9, 0.4, 0x5b3a1e, { seg: 14 }); w.rotation.x = Math.PI / 2; at(w, -0.6, -0.4, s * 1.2, gun); }
    // следы выстрелов
    (d.shots || []).forEach(sh => {
      const pts = sh.p.filter(p => Math.hypot(p[0], p[1]) <= 2.4).map(p => P(p[0], p[1]));
      if (pts.length < 2) return;
      const curve = new T.CatmullRomCurve3(pts);
      const tube = mesh(new T.TubeGeometry(curve, Math.max(20, pts.length * 3), 0.32, 6), 0, { mat: K.own(COL[sh.res] || 0xffb547), edges: false, hull: false, shadow: false });
      kit.root.add(tube);
      if (sh.res === 'fell') { const e = pts[pts.length - 1]; at(mesh(new T.SphereGeometry(0.8, 10, 8), COL.fell, { edges: false }), e.x, e.y, e.z); }
    });
    // ядро
    const ball = mesh(new T.SphereGeometry(1.1, 16, 12), 0x2b2f3a, { hull: true, edges: false }); kit.root.add(ball); ball.visible = false;
    // пульт: v −, v +, огонь
    const pu = K.console3(36, 30, 34, 'скорость ядра');
    const vs = K.plate(d.vtxt, 12, 4.2, '#ffb547', '#0e1520'); at(vs, -9.5, 7.5, 4.56, pu);
    K.button(pu, 2, 7.5, 4.7, 'v −', 'v-01', { w: 6.4, h: 4.2 }); K.button(pu, 9, 7.5, 4.7, 'v +', 'v+01', { w: 6.4, h: 4.2 });
    K.button(pu, 0, 2.6, 4.7, d.fly ? 'летит…' : 'Огонь', 'fire', { w: 14, h: 3.6, col: 0xe0473a, bg: '#e0473a', fg: '#ffffff' });
    const last = (d.shots || [])[(d.shots || []).length - 1];
    tag(v3(0, EY + SS + 6, Z), 'Гора Ньютона', 'v = ' + d.vtxt);
    tag(v3(-RG - 4, EY - 6, Z), 'Земля', 'R = 6400 км');
    if (last) tag(v3(36, 15, 30), 'Выстрел ' + last.v + ' км/с', { fell: 'упало', orbit: 'облетело по окружности', ellipse: 'эллипс', far: 'далёкий эллипс', esc: 'улетело навсегда' }[last.res], last.res === 'orbit' || last.res === 'esc');
    kit.onFrame(() => {
      const L = live(); if (!L) return;
      ball.visible = !!L.on; if (L.on) { const p = P(L.x, L.y); ball.position.copy(p); }
    });
  };

  // =====================================================================================
  // Урок 2: орбиты — глобус (ось вертикальна, смотрим как с полюса), кольца МКС/GPS/ГСО, спутник, город, луч связи, пульт
  SC['space-orbits'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const RG = 10, EY = 34, KR = 34, rr = RG + KR * d.rd;
    const gl = K.globe(0, EY, 0, RG);
    // город на экваторе (на вращающемся глобусе)
    const city = mesh(new T.ConeGeometry(0.9, 2.4, 10), 0xff8a73, { edges: false }); city.rotation.x = -Math.PI / 2; at(city, 0, 0, -RG - 0.8, gl.spin);
    // кольца-ориентиры и текущая орбита
    (d.rings || []).forEach(r => {
      const R = RG + KR * r.f, t = new T.Mesh(kit.keep(new T.TorusGeometry(R, 0.14, 6, 128)), K.basic(0x8b96ad, { transparent: true, opacity: 0.55 })); t.rotation.x = Math.PI / 2; at(t, 0, EY, 0);
      const p = K.plate(r.n, 4.6, 2, '#1b1610', '#e8ecf4'); p.rotation.x = -Math.PI / 2; at(p, R * 0.7071 + 1.5, EY + 0.1, R * 0.7071 + 1.5);
    });
    const orbit = new T.Mesh(kit.keep(new T.TorusGeometry(rr, 0.3, 8, 160)), K.own(0x72d4e8)); orbit.rotation.x = Math.PI / 2; at(orbit, 0, EY, 0);
    // спутник
    const sat = new T.Group(); kit.root.add(sat); clickable(sat, 'launch2');
    at(box(2.2, 2.2, 2.2, 0xd9c08a), 0, 0, 0, sat);
    for (const s of [-1, 1]) { at(box(0.3, 0.3, 1.6, C.STEEL, { edges: false }), 0, 0, s * 1.9, sat); at(box(1.8, 0.2, 3.6, 0x3b6fd8), 0, 0, s * 4.4, sat); }
    const dish = mesh(new T.ConeGeometry(1, 0.8, 14, 1, true), 0xe8ecf4, { edges: false }); dish.rotation.z = Math.PI / 2; at(dish, -1.6, 0, 0, sat);
    const beam = K.rod(0x86e0a8, 0.15); kit.root.add(beam.m);
    // пульт: высота и запуск; таблички задач
    const pu = K.console3(-40, 36, 34, 'высота орбиты');
    const hs = K.plate(d.htxt, 13, 4.2, '#72d4e8', '#0e1520'); at(hs, -9, 7.5, 4.56, pu);
    K.button(pu, 3, 7.5, 4.7, 'h −', 'h-', { w: 6.4, h: 4.2 }); K.button(pu, 10.2, 7.5, 4.7, 'h +', 'h+', { w: 6.4, h: 4.2 });
    K.button(pu, 0, 2.6, 4.7, 'Вывести на орбиту', 'launch2', { w: 22, h: 3.6, col: 0xe0473a, bg: '#e0473a', fg: '#ffffff' });
    [['net', 'Интернет'], ['tv', 'Телевидение'], ['nav', 'Навигация']].forEach(([k, n], i) => {
      const on = d.mission === k, done = (d.ok || []).includes(k), g = new T.Group(); at(g, 18 + i * 15, 0, 40); clickable(g, 'mis-' + k);
      at(box(13, on ? 1.4 : 0.8, 6, on ? 0xffd166 : C.WOOD2), 0, on ? 0.7 : 0.4, 0, g);
      const p = K.plate((done ? '✓ ' : '') + n, 12, 3.4, on ? '#1b1610' : '#5d6573', on ? '#ffd166' : '#f7f3ea'); p.rotation.x = -Math.PI / 2; at(p, 0, on ? 1.45 : 0.85, 0, g);
    });
    const satTag = v3(0, EY + 5, 0);
    tag(satTag, 'Спутник · h = ' + d.htxt, 'T = ' + d.Ttxt);
    tag(v3(0, EY + RG + 4, 0), 'Земля', 'оборот за 24 ч');
    tag(v3(33, 6, 40), 'Задача', { net: 'интернет с малой задержкой', tv: 'ТВ над одним регионом', nav: 'навигация' }[d.mission]);
    const cw = v3(), tmp = v3();
    kit.onFrame(() => {
      const L = live(); if (!L) return;
      gl.spin.rotation.y = L.aE;
      sat.position.set(rr * Math.cos(L.aS), EY, -rr * Math.sin(L.aS)); sat.rotation.y = L.aS;
      satTag.set(sat.position.x, EY + 5, sat.position.z);
      city.getWorldPosition(cw);
      if (L.vis) beam.set(sat.position, cw); else beam.m.visible = false;
      void tmp;
    });
  };

  // =====================================================================================
  // Урок 3: лифт-тренажёр — каркас шахты, кабина с весами и человеком, яблоко, табло, пульт
  SC['space-lift'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const X = -22, Z = -6, PX = 2.2, H = 74, CW = 18, CH = 22;
    // шахта: четыре стойки, верхняя рама, блок
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) at(box(1.4, H, 1.4, 0x6c7a96), X + sx * (CW / 2 + 1.6), H / 2, Z + sz * (CW / 2 + 1.6));
    at(box(CW + 6, 1.6, CW + 6, 0x4a5875), X, H, Z);
    const pul = cyl(2.4, 1.2, C.BRASS); pul.rotation.x = Math.PI / 2; at(pul, X, H - 2.6, Z);
    at(box(CW + 6, 1, CW + 6, 0x4a5875), X, 0.5, Z);
    for (let f = 0; f <= 5; f++) { const p = K.plate(f * 4 + ' м', 4.4, 1.8, '#e8ecf4', '#3b4a66'); at(p, X - CW / 2 - 4.4, 1 + f * 4 * PX + CH / 2, Z + CW / 2 + 1.7); }
    // кабина
    const cab = new T.Group(); at(cab, X, 1, Z); clickable(cab, 'cab');
    at(box(CW, 1, CW, 0x2c3240), 0, 0.5, 0, cab);
    at(box(CW, 1, CW, 0x2c3240), 0, CH - 0.5, 0, cab);
    at(box(CW, CH, 0.6, 0x24344f), 0, CH / 2, -CW / 2 + 0.3, cab);
    const glass = K.own(0x9cc4e8, { transparent: true, opacity: 0.18, depthWrite: false });
    for (const s of [-1, 1]) at(box(0.4, CH - 2, CW, 0, { mat: glass, edges: true, shadow: false }), s * (CW / 2 - 0.2), CH / 2, 0, cab);
    // весы и экранчик
    at(box(7, 0.8, 5, 0xe8ecf4), 0, 1.4, 1, cab);
    const ss = K.screen(3.4, 1.4, 160, 64); ss.m.rotation.x = -Math.PI / 2; at(ss.m, 0, 1.82, 2.3, cab);
    // человек
    const man = new T.Group(); at(man, 0, 1.8, 0.6, cab);
    for (const s of [-1, 1]) at(cyl(0.6, 6.6, 0x2c3240, { seg: 10 }), s * 1, 3.3, 0, man);
    at(cyl(1.7, 6.4, 0x3b6fd8, { seg: 14 }), 0, 9.6, 0, man);
    at(mesh(new T.SphereGeometry(1.6, 16, 12), 0xf0c9a0, { hull: true, edges: false }), 0, 14.6, 0, man);
    const arms = [];
    for (const s of [-1, 1]) { const a = new T.Group(); at(a, s * 2.1, 12.4, 0, man); at(cyl(0.5, 5.6, 0x3b6fd8, { seg: 8 }), 0, -2.8, 0, a); arms.push({ a, s }); }
    // яблоко
    const apple = mesh(new T.SphereGeometry(0.9, 14, 10), 0xe0473a, { hull: true, edges: false }); at(apple, 6, 1.9, 4, cab);
    // трос
    const rope1 = K.rod(0xd9c08a, 0.25), rope2 = K.rod(0xd9c08a, 0.25); kit.root.add(rope1.m); kit.root.add(rope2.m);
    // табло весов
    const bd = new T.Group(); at(bd, 28, 0, -30);
    for (const x of [-11, 11]) at(box(3, 9, 3, C.DARK), x, 4.5, 0, bd);
    at(box(34, 21, 5, 0x2c3240), 0, 19, 0, bd);
    const sc = K.screen(31, 18.2, 384, 226); at(sc.m, 0, 19, 2.56, bd);
    // пульт
    const pu = K.console3(30, 30, 40, 'поездка');
    K.button(pu, -12, 6, 4.7, 'Вверх', 'up', { w: 10, h: 4.4 }); K.button(pu, -1, 6, 4.7, 'Вниз', 'down', { w: 10, h: 4.4 });
    K.button(pu, 12, 6, 4.7, 'Падение', 'drop', { w: 13, h: 4.4, col: 0xe0473a, bg: '#e0473a', fg: '#ffffff' });
    const cabTag = v3(X, CH + 6, Z);
    tag(cabTag, 'Кабина с весами', d.run === 'drop' ? 'свободное падение' : d.run ? 'едет' : 'нажмите — поехать', d.run === 'drop');
    tag(v3(28, 33, -30), 'Показания весов', 'масса 50 кг');
    tag(v3(30, 15, 30), 'Пульт', '');
    const hist = []; let tick = 0, tt = 0;
    kit.onFrame((dt, t) => {
      const L = live(); if (!L) return;
      const y = 1 + L.y * PX; cab.position.y = y; cabTag.y = y + CH + 5;
      const wl = L.n < 0.05;
      arms.forEach(({ a, s }) => { a.rotation.z = s * (wl ? 2.4 : 0.15); });
      apple.position.y = wl ? 9 + (kit.reduce ? 0 : Math.sin(t * 2) * 0.6) : 1.9;
      const top = v3(X, H - 2.6, Z), roof = v3(X, y + CH, Z);
      if (L.free) { const mid = top.clone().lerp(roof, 0.5); mid.x += 5; rope1.set(top, mid); rope2.set(mid, roof); }
      else { rope1.set(top, roof); rope2.m.visible = false; }
      tt += dt; if (tt > 0.05) { tt = 0; hist.push(L.kg); if (hist.length > 160) hist.shift(); }
      if ((tick++ & 1) && tick > 2) return;
      { const x = ss.x; x.fillStyle = '#0c1a14'; x.fillRect(0, 0, ss.W, ss.H); x.fillStyle = '#86e0a8'; x.font = '600 44px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(Math.round(L.kg) + ' кг', ss.W / 2, ss.H / 2 + 2); ss.tex.needsUpdate = true; }
      const s = sc, x = s.x, w = s.W, h = s.H;
      x.fillStyle = '#0e1520'; x.fillRect(0, 0, w, h);
      x.fillStyle = wl ? '#86e0a8' : L.kg > 52 ? '#ff8a73' : '#ffb547'; x.font = '700 40px "IBM Plex Mono", monospace'; x.textAlign = 'left'; x.textBaseline = 'top';
      x.fillText(Math.round(L.kg) + ' кг', 16, 12);
      x.fillStyle = '#c8d2e3'; x.font = '600 24px "IBM Plex Mono", monospace'; x.fillText('n = ' + num(L.n, 1) + ' g   a = ' + num(L.a, 1) + ' м/с²', 16, 62);
      const gx = 20, gy = 100, gw = w - 40, gh = h - 116, Y = k => gy + gh - gh * clamp(k, 0, 220) / 220;
      x.strokeStyle = 'rgba(160,185,230,.2)'; x.lineWidth = 1; x.strokeRect(gx, gy, gw, gh);
      x.strokeStyle = '#2e9e4f'; x.setLineDash([6, 5]); x.beginPath(); x.moveTo(gx, Y(50)); x.lineTo(gx + gw, Y(50)); x.stroke(); x.setLineDash([]);
      if (hist.length > 1) { x.strokeStyle = '#ffb547'; x.lineWidth = 3; x.beginPath(); hist.forEach((k, i) => { const px = gx + gw * (i + 160 - hist.length) / 159, py = Y(k); i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke(); }
      s.tex.needsUpdate = true;
    });
  };

  // =====================================================================================
  // Урок 4: космодром — стартовый стол с башней, ракета (1 или 2 ступени), море, посадочная площадка, табло Δv, пульт.
  // Положения берём из той же функции полёта, что и схема: x, y схемы → x, y макета.
  SC['space-rocket'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const Z = -10, MX = sx => -32 + (sx - 110) * 0.2, MY = sy => (378 - sy) * 0.26, SCL = 0.26;
    // суша и море на макете
    at(box(84, 0.8, 50, 0x5d7a5a), -28, 0.4, Z);
    const sea = new T.Mesh(kit.keep(new T.BoxGeometry(56, 0.6, 50)), K.own(0x2f6fb0, { transparent: true, opacity: 0.9 })); at(sea, 42, 0.3, Z);
    // стартовый стол и башня
    at(box(10, 1.4, 10, 0x4a5875), MX(110), 1.5, Z);
    const tw = new T.Group(); at(tw, MX(110) - 4.6, 0, Z);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) at(box(0.5, 38, 0.5, 0x6c7a96, { edges: false }), sx * 1.2, 19.8, sz * 1.2, tw);
    for (let k = 0; k < 8; k++) at(box(2.9, 0.4, 2.9, 0x6c7a96, { edges: false }), 0, 4 + k * 4.6, 0, tw);
    // посадочная площадка
    const lp = cyl(5.4, 0.8, 0x4a5875, { seg: 32 }); at(lp, MX(236), 1.2, Z);
    const xm = K.plate('X', 4, 4, '#fff6e6', '#4a5875'); xm.rotation.x = -Math.PI / 2; at(xm, MX(236), 1.65, Z);
    // орбита
    const ob = cyl(0.25, 70, 0x86e0a8, { edges: false, hull: false, seg: 8 }); ob.rotation.z = Math.PI / 2; ob.material = K.basic(0x86e0a8, { transparent: true, opacity: 0.6 }); at(ob, 30, MY(82), Z);
    // модели ракеты (в единицах схемы: ширина 16, низ — у начала координат)
    const W = 16;
    const nozzle = g => { at(cyl(5, 4, 0x3a4152, { r2: 3.5, seg: 14 }), 0, -2, 0, g); };
    const fins = g => { for (let k = 0; k < 4; k++) { const f = box(1, 10, 6, 0x2c3240); f.rotation.y = k * Math.PI / 2; f.position.set(Math.cos(k * Math.PI / 2) * 9, 5, -Math.sin(k * Math.PI / 2) * 9); f.rotation.y = -k * Math.PI / 2; g.add(f); } };
    const flame = g => { const f = mesh(new T.ConeGeometry(5, 26, 14), 0, { mat: K.basic(0xffb547, { transparent: true, opacity: 0.85 }), edges: false, shadow: false }); f.rotation.x = Math.PI; at(f, 0, -16, 0, g); const c = mesh(new T.ConeGeometry(2.6, 14, 12), 0, { mat: K.basic(0xfff1c2), edges: false, shadow: false }); c.rotation.x = Math.PI; at(c, 0, -10, 0, g); return [f, c]; };
    const fairing = (g, y0) => { at(cyl(W / 2, 24, 0xeef1f6, { seg: 24 }), 0, y0 + 12, 0, g); at(mesh(new T.ConeGeometry(W / 2, 20, 24), 0xd8dde6, { hull: true, edges: false }), 0, y0 + 34, 0, g); };
    function model(kind) {
      const g = new T.Group(), inner = new T.Group(); g.add(inner); inner.scale.setScalar(SCL); kit.root.add(g);
      let legs = null;
      if (kind === 'one') { at(cyl(W / 2, 92, 0xeef1f6, { seg: 24 }), 0, 46, 0, inner); at(cyl(W / 2 + 0.2, 5, 0x2c3240, { seg: 24 }), 0, 70, 0, inner); at(mesh(new T.ConeGeometry(W / 2, 20, 24), 0xd8dde6, { hull: true, edges: false }), 0, 102, 0, inner); nozzle(inner); fins(inner); }
      if (kind === 'two' || kind === 's1') { at(cyl(W / 2, 62, 0xeef1f6, { seg: 24 }), 0, 31, 0, inner); at(cyl(W / 2 + 0.2, 5, 0x2c3240, { seg: 24 }), 0, 47.5, 0, inner); nozzle(inner); }
      if (kind === 's1') { legs = new T.Group(); inner.add(legs); for (let k = 0; k < 4; k++) { const l = box(1.4, 14, 1.4, 0x2c3240); const a = k * Math.PI / 2 + Math.PI / 4; l.position.set(Math.cos(a) * 9, 3, -Math.sin(a) * 9); l.rotation.set(Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5); legs.add(l); } }
      if (kind === 'two') { at(cyl(W / 2, 4, 0x3a4152, { seg: 24 }), 0, 64, 0, inner); fairing(inner, 66); fins(inner); }
      if (kind === 's2') { fairing(inner, 0); at(cyl(4, 3, 0x3a4152, { r2: 3, seg: 14 }), 0, -1.5, 0, inner); }
      const fl = flame(inner);
      return { g, legs, fl };
    }
    const main = { one: model('one'), two: model('two'), s2: model('s2') }, s1 = model('s1');
    clickable(main.one.g, 'launch'); clickable(main.two.g, 'launch');
    const splashes = [0, 1].map(() => { const r = new T.Mesh(kit.keep(new T.TorusGeometry(3, 0.4, 6, 24)), K.basic(0xbfe6ff)); r.rotation.x = Math.PI / 2; kit.root.add(r); r.visible = false; return r; });
    const put = (m, o) => {
      if (!o || o.hide) { m.g.visible = false; return; }
      m.g.visible = true; m.g.position.set(MX(o.x), Math.max(0.6, MY(o.y)) + (o.y >= 371 ? 1.6 : 0), Z); m.g.rotation.z = -o.ang * Math.PI / 180;
      m.fl.forEach(f => { f.visible = !!o.flame; });
      if (m.legs) m.legs.visible = !!o.legs;
    };
    // табло Δv
    const bd = new T.Group(); at(bd, 40, 0, -38);
    for (const x of [-9, 9]) at(box(3, 9, 3, C.DARK), x, 4.5, 0, bd);
    at(box(28, 18, 5, 0x2c3240), 0, 17.5, 0, bd);
    const sc = K.screen(25, 15.4, 320, 200); at(sc.m, 0, 17.5, 2.56, bd);
    // пульт
    const pu = K.console3(-20, 34, 56, 'ракета');
    const B = (x, y, txt, key, on, w = 11) => K.button(pu, x, y, 4.7, txt, key, { w, h: 4, col: on ? 0xffd166 : 0xe8ecf4, bg: on ? '#ffd166' : '#e8ecf4' });
    B(-21, 8, '1 ступень', 'st-1', d.st === 1); B(-9, 8, '2 ступени', 'st-2', d.st === 2); B(3, 8, 'Груз 1 т', 'pay-1', d.pay === 1); B(15, 8, 'Груз 2 т', 'pay-2', d.pay === 2);
    B(-12, 3, d.land ? 'Посадка: да' : 'Посадка: нет', 'land', d.land, 16);
    K.button(pu, 12, 3, 4.7, d.fly ? 'полёт…' : 'Пуск', 'launch', { w: 16, h: 4, col: 0xe0473a, bg: '#e0473a', fg: '#ffffff' });
    const rTag = v3(MX(110), 36, Z);
    tag(rTag, d.st === 1 ? 'Одна ступень' : 'Две ступени', d.fly ? 'полёт' : d.res === 'orbit' ? 'спутник на орбите' : d.res === 'fail' ? 'не хватило скорости' : 'нажмите — пуск', d.res === 'orbit');
    tag(v3(MX(236), 6, Z), 'Посадочная площадка', d.land ? 'ступень вернётся' : 'не используется');
    tag(v3(30, MY(82) + 3, Z), 'Орбита', '7,9 км/с');
    let tick = 0;
    kit.onFrame(() => {
      const L = live(); if (!L) return;
      const pad = { x: 110, y: 372, ang: 0, sc: 1, kind: d.st === 1 ? 'one' : 'two', flame: false };
      const m = d.fly ? L.main : pad;
      for (const k of ['one', 'two', 's2']) { if (m && m.kind === k) put(main[k], m); else main[k].g.visible = false; }
      if (d.fly && m && !m.hide) rTag.set(MX(m.x), MY(m.y) + 12, Z); else rTag.set(MX(110), 36, Z);
      const s = d.fly ? L.s1 : (L.landed ? { x: 236, y: 372, ang: 0, sc: 1, kind: 's1', legs: true, flame: false } : null);
      put(s1, s);
      splashes[0].visible = !!(d.fly && L.splash1 && L.s1); if (splashes[0].visible) splashes[0].position.set(MX(L.s1.x), 0.8, Z);
      splashes[1].visible = !!(d.fly && L.splash2 && L.main); if (splashes[1].visible) splashes[1].position.set(MX(L.main.x), 0.8, Z);
      if ((tick++ & 1) && tick > 2) return;
      const x = sc.x, w = sc.W, h = sc.H, v = L.v || 0;
      x.fillStyle = '#0e1520'; x.fillRect(0, 0, w, h);
      x.fillStyle = v >= 9.4 ? '#86e0a8' : '#ffb547'; x.font = '700 40px "IBM Plex Mono", monospace'; x.textAlign = 'left'; x.textBaseline = 'top';
      x.fillText('Δv = ' + num(v, 1) + ' км/с', 16, 14);
      const bx = 16, by = 92, bw = w - 32, bh = 34;
      x.strokeStyle = '#3a4762'; x.lineWidth = 2; x.strokeRect(bx, by, bw, bh);
      x.fillRect(bx + 2, by + 2, (bw - 4) * clamp(v / 12, 0, 1), bh - 4);
      const m9 = bx + bw * 9.4 / 12; x.strokeStyle = '#ff8a73'; x.lineWidth = 4; x.beginPath(); x.moveTo(m9, by - 8); x.lineTo(m9, by + bh + 8); x.stroke();
      x.fillStyle = '#ff8a73'; x.font = '600 20px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.fillText('9,4 нужно', m9, by + bh + 14);
      sc.tex.needsUpdate = true;
    });
  };
})();
