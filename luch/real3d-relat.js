// «Как в жизни» для темы «Теория относительности» (labs/phys-relat): настольные модели —
// трасса с воротами А и Б, ракета с фонарём, световой импульс и «призрак Галилея», секундомер; две пары световых часов
// (на подставке «Земля» и на тележке-ракете) с бегающим фотоном и следом-зигзагом; кубик на постаменте, который
// превращается в энергию и по ЛЭП зажигает окна макета города, столбик «электроэнергия страны за год».
// Описание сцены приходит из window.LUCH_REAL() опыта; положения (ракета, свет, фотоны, вспышка) — из window.LUCH_REAL.live() каждый кадр.
(() => {
  const SC = (window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {});
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const live = () => { try { const f = window.LUCH_REAL && window.LUCH_REAL.live; return f ? f() : null; } catch (e) { return null; } };
  const TAU = Math.PI * 2;
  const num = (x, n) => { let s = (Math.round(x * 10 ** n) / 10 ** n).toFixed(n); if (/^-0(\.0+)?$/.test(s)) s = s.slice(1); return s.replace('.', ','); };

  // ---------- общие детали темы ----------
  function tools(kit) {
    const { T, at, box, cyl, keep, v3 } = kit;
    const own = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: kit.grad, ...o }));
    const basic = (color, o = {}) => keep(new T.MeshBasicMaterial({ color, ...o }));
    function plate(txt, w, h, fg = '#1b1610', bg = '#f7f3ea') {
      const t = keep(kit.textTex(txt, fg, bg, Math.round(64 * w / h), 64));
      return new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: t })));
    }
    function screen(w, h, pw = 320, ph = 160) {
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
    function rod(col, r = 0.22, mat) {
      const m = cyl(r, 1, col, { edges: false, hull: false, seg: 8, ...(mat ? { mat } : {}) }); const up = v3(0, 1, 0), dv = v3(0, 0, 0);
      return { m, set(a, b) { dv.copy(b).sub(a); const l = dv.length(); if (l < 1e-4) { m.visible = false; return; } m.visible = true; m.position.copy(a).addScaledVector(dv, 0.5); m.quaternion.setFromUnitVectors(up, dv.multiplyScalar(1 / l)); m.scale.set(1, l, 1); } };
    }
    function console3(x, z, w, title) {
      const g = new T.Group(); at(g, x, 0, z);
      at(box(w, 12, 9, 0x3b4a66), 0, 6, 0, g);
      if (title) { const p = plate(title, w - 4, 2.2, '#fff6e6', '#3b4a66'); p.rotation.x = -Math.PI / 2; at(p, 0, 12.05, -2.4, g); }
      return g;
    }
    // табло на двух ножках, экран смотрит на зрителя (+z)
    function board(x, z, w, h, pw, ph, y0 = 9) {
      const g = new T.Group(); at(g, x, 0, z);
      for (const sx of [-1, 1]) at(box(2.4, y0, 2.4, kit.C.DARK), sx * (w / 2 - 3), y0 / 2, 0, g);
      at(box(w + 3, h + 3, 4, 0x2c3240), 0, y0 + h / 2, 0, g);
      const s = screen(w, h, pw, ph); at(s.m, 0, y0 + h / 2, 2.06, g);
      return { g, s, top: y0 + h + 1.5 };
    }
    const glow = (color, size, opacity = 1) => { const s = new T.Sprite(keep(new T.SpriteMaterial({ map: kit.glowTex(), color, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity }))); s.scale.setScalar(size); s.renderOrder = 3; return s; };
    // доска «космос»: тёмная с точками-звёздами
    function spaceTex(w, h, seed = 7) {
      const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
      x.fillStyle = '#121a2c'; x.fillRect(0, 0, w, h);
      let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < w * h / 900; i++) { x.fillStyle = `rgba(200,214,236,${(0.25 + r() * 0.6).toFixed(2)})`; x.beginPath(); x.arc(r() * w, r() * h, 0.6 + r() * 1.4, 0, TAU); x.fill(); }
      const t = keep(new T.CanvasTexture(c)); t.colorSpace = T.SRGBColorSpace; return t;
    }
    function text(s, lines) {
      // lines: [[txt, color, size, x, y, align]]
      const x = s.x; x.fillStyle = '#0e1520'; x.fillRect(0, 0, s.W, s.H);
      for (const [t, col, fs, px, py, al] of lines) { x.fillStyle = col; x.font = `600 ${fs}px "IBM Plex Mono", monospace`; x.textAlign = al || 'left'; x.textBaseline = 'middle'; x.fillText(t, px, py); }
      s.tex.needsUpdate = true;
    }
    return { own, basic, plate, screen, button, rod, console3, board, glow, spaceTex, text };
  }

  // =====================================================================================
  // Урок 1: постулаты — тёмная трасса со звёздами, ворота А и Б (300 000 км), ракета на штанге с фонарём,
  // световой импульс (всегда c) и пунктирный «призрак Галилея» (c ± v), секундомер-табло с замерами, пульт
  SC['relat-post'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const Z = -4, XA = -45, XB = 45, RY = 13, FX = f => XA + f * (XB - XA);
    // трасса
    at(box(136, 1.6, 18, 0x1a2232), 0, 0.8, Z);
    const sky = new T.Mesh(kit.keep(new T.PlaneGeometry(134, 16)), kit.keep(new T.MeshBasicMaterial({ map: K.spaceTex(1072, 128) }))); sky.rotation.x = -Math.PI / 2; at(sky, 0, 1.62, Z);
    at(box(136, 0.6, 0.8, C.STEEL, { edges: false }), 0, 1.9, Z + 3.2);
    // линейка 300 000 км
    at(box(XB - XA, 0.3, 0.6, 0x8b96ad, { edges: false }), 0, 1.75, Z + 7.2);
    for (const x of [XA, XB]) at(box(0.6, 0.3, 2.4, 0x8b96ad, { edges: false }), x, 1.75, Z + 7.2);
    const rl = K.plate('L = 300 000 км', 26, 2.6, '#e8ecf4', '#1a2232'); rl.rotation.x = -Math.PI / 2; at(rl, 0, 1.8, Z + 10.4);
    // ворота с лампами
    const lamps = [];
    [[XA, 'А'], [XB, 'Б']].forEach(([x, n]) => {
      for (const s of [-1, 1]) at(box(1.6, 24, 1.6, 0x8a96b0), x, 1.6 + 12, Z + s * 7);
      at(box(1.6, 1.6, 15.6, 0x8a96b0), x, 25.6 + 0.8, Z);
      const lm = K.own(0x26324a); at(box(3, 2.2, 3, 0, { mat: lm }), x, 28.5, Z);
      const gl = K.glow(0x86e0a8, 9, 0.9); at(gl, x, 28.5, Z); gl.visible = false;
      const p = K.plate(n, 3.2, 3.2, '#1b1610', '#fff6e6'); at(p, x, 22.6, Z + 0.9);
      lamps.push({ lm, gl });
    });
    // ракета: нос с фонарём смотрит туда, куда светит фонарь
    const rk = new T.Group(); kit.root.add(rk); clickable(rk, 'run');
    const body = new T.Group(); rk.add(body);
    const tube = cyl(2.2, 11, 0xc8d1e2, { seg: 20 }); tube.rotation.z = Math.PI / 2; at(tube, -6.5, 0, 0, body);
    const nose = mesh(new T.ConeGeometry(2.2, 4.4, 20), 0xe8ecf4, { hull: true, edges: false }); nose.rotation.z = -Math.PI / 2; at(nose, -0.8, 0, 0, body);
    const win = mesh(new T.SphereGeometry(0.9, 12, 8), 0x72d4e8, { edges: false }); at(win, -5, 0.6, 2, body);
    for (let k = 0; k < 4; k++) { const f = box(3.2, 0.5, 2.6, 0x56627d); const a = k * Math.PI / 2; f.position.set(-11, Math.cos(a) * 2.6, Math.sin(a) * 2.6); f.rotation.x = a; body.add(f); }
    const noz = cyl(1.5, 1.6, 0x3a4152, { r2: 1.1, seg: 14 }); noz.rotation.z = Math.PI / 2; at(noz, -12.6, 0, 0, body);
    const lampM = K.own(0x56627d); const lamp = box(1.4, 1.4, 1.4, 0, { mat: lampM }); at(lamp, -1.6, 2.6, 0, body);
    const beamGl = K.glow(0xffd36b, 7, 0.9); at(beamGl, 0.4, 0, 0, body); beamGl.visible = false;
    // штанга-держатель ракеты, скользит по рельсу
    const stand = new T.Group(); rk.add(stand);
    at(cyl(0.45, RY - 1.9, C.STEEL, { seg: 8 }), -6, -(RY - 1.9) / 2, 3.2 - 0, stand);
    at(box(3, 0.8, 2, C.DARK), -6, -(RY - 1.9) + 0.1, 3.2, stand);
    // свет и Галилей
    const beam = K.rod(0xffd36b, 0.35, K.basic(0xffd36b, { transparent: true, opacity: 0.55 })); kit.root.add(beam.m);
    const pulse = new T.Group(); kit.root.add(pulse);
    pulse.add(mesh(new T.SphereGeometry(1.1, 14, 10), 0, { mat: K.basic(0xfff6c8), edges: false, shadow: false }));
    pulse.add(K.glow(0xffd36b, 10, 1));
    const ghost = new T.Mesh(kit.keep(new T.SphereGeometry(2, 12, 8)), K.basic(0xff8a73, { wireframe: true, transparent: true, opacity: 0.8 })); kit.root.add(ghost);
    // секундомер-табло с замерами
    const bd = K.board(0, -34, 46, 20, 460, 200, 8);
    // пульт
    const pu = K.console3(0, 34, 66, 'ракета и фонарь');
    const vs = K.plate('v = ' + d.btxt, 13, 4.2, '#ffb547', '#0e1520'); at(vs, -24, 7.5, 4.56, pu);
    K.button(pu, -12.5, 7.5, 4.7, 'v −', 'b1-', { w: 7, h: 4.2 }); K.button(pu, -4.5, 7.5, 4.7, 'v +', 'b1+', { w: 7, h: 4.2 });
    const on = k => ({ col: k ? 0xffd166 : 0xe8ecf4, bg: k ? '#ffd166' : '#e8ecf4' });
    K.button(pu, 8, 7.5, 4.7, 'Фонарь →', 'dirF', { w: 12, h: 4.2, ...on(d.dir === 1) }); K.button(pu, 21.5, 7.5, 4.7, '← Фонарь', 'dirB', { w: 12, h: 4.2, ...on(d.dir === -1) });
    K.button(pu, 0, 2.6, 4.7, d.fly ? 'замер…' : 'Пуск', 'run', { w: 24, h: 3.6, col: 0xe0473a, bg: '#e0473a', fg: '#ffffff' });
    const rTag = v3(XA, RY + 6, Z), pTag = v3(XA, RY + 4, Z);
    tag(rTag, 'Ракета', 'v = ' + d.btxt + (d.b > 0 ? (d.dir === 1 ? ', фонарь вперёд' : ', фонарь назад') : ', стоит'));
    tag(pTag, 'Свет', 'c');
    tag(v3(0, bd.top + 2, -34), 'Секундомер А → Б', 'Галилей ждёт ' + d.galT + ' с', !!d.shot);
    const [h0, hF, hB] = d.has || [];
    tag(v3(0, 15, 34), 'Замеры', `стоит ${h0 ? '✓' : '—'} · вперёд ${hF ? '✓' : '—'} · назад ${hB ? '✓' : '—'}`, h0 && hF && hB);
    let tick = 0, lastSw = -1;
    kit.onFrame(() => {
      const L = live(); if (!L) return;
      // ракета
      const xr = FX(L.xe), dirR = L.d === -1 ? -1 : 1;
      rk.visible = Math.abs(xr) <= 66;
      rk.position.set(xr, RY, Z); body.rotation.y = dirR === 1 ? 0 : Math.PI; stand.position.x = dirR === 1 ? 0 : 12;
      rTag.set(clamp(xr, -60, 60), RY + 6, Z);
      const lit = L.lt >= 0;
      lampM.color.setHex(lit ? 0xffd36b : 0x56627d); beamGl.visible = lit && rk.visible;
      // свет
      if (L.px !== null) { const x = FX(L.px); pulse.visible = true; pulse.position.set(x, RY, Z); beam.set(v3(XA, RY, Z), v3(x, RY, Z)); pTag.set(x, RY + 4, Z); }
      else { pulse.visible = false; beam.m.visible = false; pTag.set(XA, RY + 4, Z); }
      if (L.gx !== null) { ghost.visible = true; ghost.position.set(FX(L.gx), RY, Z); ghost.rotation.y += 0.03; } else ghost.visible = false;
      // ворота
      const g = [L.lt >= 0, L.lt >= L.T1 - 1e-6];
      lamps.forEach((l, i) => { l.lm.color.setHex(g[i] ? 0x86e0a8 : 0x26324a); l.gl.visible = g[i]; });
      // табло
      if (L.sw === lastSw && (tick++ & 7)) return; lastSw = L.sw;
      const s = bd.s, x = s.x;
      K.text(s, [['СЕКУНДОМЕР А → Б', '#8b96ad', 20, 18, 22], [num(L.sw, 3) + ' с', '#86e0a8', 54, 18, 66], ['Галилей: ' + d.galT + ' с', '#ff8a73', 22, 442, 66, 'right']]);
      x.strokeStyle = '#26324a'; x.lineWidth = 2; x.beginPath(); x.moveTo(14, 98); x.lineTo(446, 98); x.stroke();
      const rs = (d.runs || []).slice(-4);
      if (!rs.length) { x.fillStyle = '#8b96ad'; x.font = '600 20px "IBM Plex Mono", monospace'; x.textAlign = 'left'; x.fillText('замеров пока нет', 18, 124); }
      rs.forEach((r, i) => {
        const y = 120 + i * 22; x.font = '600 18px "IBM Plex Mono", monospace'; x.textBaseline = 'middle';
        x.fillStyle = '#e8ecf4'; x.textAlign = 'left'; x.fillText(r.b + 'c ' + (r.b === '0,00' ? 'стоит' : r.d === 1 ? 'вперёд' : 'назад'), 18, y);
        x.fillStyle = '#86e0a8'; x.fillText('1,000 с', 220, y);
        x.fillStyle = '#ff8a73'; x.textAlign = 'right'; x.fillText('Г: ' + r.tg + ' с', 442, y);
      });
      s.tex.needsUpdate = true;
    });
  };

  // =====================================================================================
  // Урок 2: световые часы — пара зеркал на подставке «Земля» и такая же пара на тележке-ракете, которая едет по рельсу;
  // фотон бегает между зеркалами, за движущимися часами тянется след-зигзаг; табло t и τ, пульт скорости
  SC['relat-clock'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const S = 0.25, HC = 120 * S, Y0 = 8, Z = -4;       // масштаб схемы → макет; зеркала на высоте Y0 и Y0 + HC
    const XR = -48, XL = -22, XW = 240 * S;               // часы «Земля»; рельс движущихся часов: XL … XL + XW
    const mirror = (g, y) => { at(cyl(5.4, 0.9, 0xa9b4c9, { seg: 28 }), 0, y, 0, g); at(cyl(5.6, 0.4, 0x56627d, { seg: 28 }), 0, y + (y > Y0 ? 0.65 : -0.65), 0, g); };
    function clockPair(g) {
      at(cyl(0.6, HC + 2, C.BRASS, { seg: 10 }), -6.2, Y0 + HC / 2, 0, g);
      at(box(7, 0.8, 1, C.BRASS), -3, Y0 + HC + 1, 0, g); at(box(7, 0.8, 1, C.BRASS), -3, Y0 - 1, 0, g);
      mirror(g, Y0 - 0.2); mirror(g, Y0 + HC + 0.2);
      const ph = new T.Group(); g.add(ph);
      ph.add(mesh(new T.SphereGeometry(0.9, 12, 8), 0, { mat: K.basic(0xfff6c8), edges: false, shadow: false }));
      ph.add(K.glow(0xffd36b, 7, 1));
      return ph;
    }
    // «Земля»: подставка
    const earth = new T.Group(); at(earth, XR, 0, Z); clickable(earth, 't0');
    at(cyl(8, 2, 0x4c7a5a, { seg: 28 }), 0, 1, 0, earth);
    at(box(8, Y0 - 3.2, 6, C.WOOD2), 0, 2 + (Y0 - 3.2) / 2 - 0.2, 0, earth);
    const ph0 = clockPair(earth);
    const path0 = K.rod(0xffd36b, 0.15, K.basic(0xffd36b, { transparent: true, opacity: 0.3 })); earth.add(path0.m); path0.set(v3(0, Y0, 0), v3(0, Y0 + HC, 0));
    // рельс и тележка-ракета
    at(box(XW + 16, 1.4, 12, 0x1a2232), XL + XW / 2, 0.7, Z);
    for (const s of [-1, 1]) at(box(XW + 16, 0.6, 0.8, C.STEEL, { edges: false }), XL + XW / 2, 1.7, Z + s * 3.6);
    const cart = new T.Group(); kit.root.add(cart);
    at(box(13, 2.4, 10, 0xc8d1e2), 0, 3.2, 0, cart);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const w = cyl(1, 0.8, C.DARK, { seg: 12 }); w.rotation.x = Math.PI / 2; at(w, sx * 4.5, 2, sz * 4, cart); }
    const nose = mesh(new T.ConeGeometry(1.7, 4, 16), 0xe0473a, { hull: true, edges: false }); nose.rotation.z = -Math.PI / 2; at(nose, 8.5, 3.2, 0, cart);
    at(box(4, Y0 - 4.4, 5, 0x8a96b0), 0, 4.4 + (Y0 - 4.4) / 2, 0, cart);
    const ph1 = clockPair(cart);
    const glass = K.own(0x9cc4e8, { transparent: true, opacity: 0.14, depthWrite: false });
    at(box(15, HC + 6, 11, 0, { mat: glass, edges: true, shadow: false }), 0, Y0 + HC / 2, 0, cart);
    // след-зигзаг (в координатах макета)
    const NMAX = 200, pos = new Float32Array(NMAX * 3), lg = kit.keep(new T.BufferGeometry());
    lg.setAttribute('position', new T.BufferAttribute(pos, 3));
    const trail = new T.Line(lg, kit.keep(new T.LineBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.85 }))); kit.root.add(trail);
    // табло
    const b0 = K.board(XR, -36, 26, 12, 320, 150, 6), b1 = K.board(XL + XW / 2, -36, 40, 12, 480, 144, 6);
    // пульт
    const pu = K.console3(4, 34, 74, 'скорость ракеты');
    const vs = K.plate('v = ' + d.btxt, 15, 4.2, '#ffb547', '#0e1520'); at(vs, -26, 7.5, 4.56, pu);
    K.button(pu, -11, 7.5, 4.7, '−0,01c', 'b2--', { w: 9.5, h: 4.2 }); K.button(pu, -0.5, 7.5, 4.7, '−0,001c', 'b2-', { w: 10.5, h: 4.2 });
    K.button(pu, 10.5, 7.5, 4.7, '+0,001c', 'b2+', { w: 10.5, h: 4.2 }); K.button(pu, 21.5, 7.5, 4.7, '+0,01c', 'b2++', { w: 9.5, h: 4.2 });
    K.button(pu, 0, 2.6, 4.7, 'Сброс часов', 't0', { w: 20, h: 3.6, col: 0x72d4e8, bg: '#72d4e8' });
    tag(v3(XR, Y0 + HC + 5, Z), 'Часы на Земле', 'тик 1 нс');
    const cTag = v3(XL, Y0 + HC + 7, Z);
    tag(cTag, 'Часы в ракете', 'γ = ' + d.gtxt, d.ok);
    let tick = 0;
    kit.onFrame(() => {
      const L = live(); if (!L) return;
      const P = L.g * L.T0, t = L.t, vx = L.b * L.CV;   // всё в единицах схемы
      const zz = u => Y0 + HC * (1 - Math.abs(1 - 2 * u));
      ph0.position.set(0, zz((t % L.T0) / L.T0), 0);
      const raw = vx * t, shift = ((raw % L.W) + L.W) % L.W - raw, P0 = Math.floor(t / P) * P;
      const xm = XL + (raw + shift) * S;
      cart.position.set(xm, 0, Z); cTag.set(xm, Y0 + HC + 7, Z);
      ph1.position.set(0, zz((((t % P) + P) % P) / P), 0);
      // след: вершины зигзага от прошлого тика до фотона, обрезаем у начала рельса
      let n = 0;
      const push = (sx, y) => { const x = XL + (sx + shift) * S; if (x < XL - 6 || n >= NMAX) return; pos[n * 3] = x; pos[n * 3 + 1] = y; pos[n * 3 + 2] = Z; n++; };
      for (let k = P0 - P, i = 0; k <= t + 1e-9 && i < NMAX - 2; k += P / 2, i++) push(vx * k, Math.round((k - P0 + P) / (P / 2)) % 2 ? Y0 + HC : Y0);
      push(raw, zz((((t % P) + P) % P) / P));
      lg.setDrawRange(0, n); lg.attributes.position.needsUpdate = true; trail.visible = n > 1;
      if ((tick++ & 7)) return;
      K.text(b0.s, [['ЗЕМЛЯ', '#8b96ad', 22, 160, 30, 'center'], ['t = ' + L.ttxt + ' нс', '#86e0a8', 40, 160, 96, 'center']]);
      K.text(b1.s, [['РАКЕТА (вид с Земли)', '#8b96ad', 22, 240, 28, 'center'], ['τ = ' + L.tautxt + ' нс', '#ffb547', 40, 240, 80, 'center'], ['γ = ' + d.gtxt + '   v = ' + d.btxt, d.ok ? '#86e0a8' : '#c8d2e3', 22, 240, 122, 'center']]);
    });
  };

  // =====================================================================================
  // Урок 3: E = mc² — металлический кубик на постаменте (размер по массе), вспышка превращения, ЛЭП к макету города,
  // окна города загораются по доле годового потребления, столбик «страна за год», табло энергии, пульт массы
  SC['relat-emc'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const PX = -42, PZ = 2, PY = 12;
    // постамент
    at(cyl(9, 2, 0x2a3348, { seg: 28 }), PX, 1, PZ);
    at(cyl(6, PY - 2, 0x3a4762, { seg: 28 }), PX, 2 + (PY - 2) / 2, PZ);
    const side = d.m > 0 ? (12 + 58 * Math.cbrt(d.m / 10)) * 0.25 : 0;
    const cube = new T.Group(); at(cube, PX, PY, PZ); clickable(cube, 'conv');
    let cubeM = null;
    if (side > 0) {
      cubeM = box(side, side, side, 0x7d8db0); at(cubeM, 0, side / 2, 0, cube); cubeM.rotation.y = 0.35;
      if (d.conv) { const gh = new T.Mesh(kit.keep(new T.BoxGeometry(side, side, side)), K.basic(0x8b96ad, { wireframe: true, transparent: true, opacity: 0.35 })); gh.rotation.y = 0.35; at(gh, 0, side / 2, 0, cube); }
      // невидимая «мишень» для нажатия, чтобы кубик ловился и после превращения
      const hitM = new T.Mesh(kit.keep(new T.BoxGeometry(Math.max(side, 6), Math.max(side, 6), Math.max(side, 6))), K.basic(0, { transparent: true, opacity: 0, depthWrite: false })); at(hitM, 0, Math.max(side, 6) / 2, 0, cube);
    }
    const flash = K.glow(0xffd36b, 10, 0); at(flash, PX, PY + side / 2, PZ);
    const rays = [];
    for (let i = 0; i < 12; i++) { const r = K.rod(0xffd36b, 0.3, K.basic(0xffd36b, { transparent: true, opacity: 0 })); kit.root.add(r.m); r.m.visible = false; rays.push({ r, a: i / 12 * TAU, e: (i % 3 - 1) * 0.5 }); }
    // ЛЭП: опоры и провод к городу
    const CX = 26, CZ = 6;
    for (const x of [-22, 2]) { at(box(1.2, 22, 1.2, 0x6c7a96), x, 11, PZ); at(box(7, 0.8, 0.8, 0x6c7a96), x, 21, PZ); }
    kit.cable(v3(PX + 6, PY - 2, PZ), v3(CX - 20, 2, CZ), 0x2a2f3a, d.conv ? 1 : 0, { r: 0.5, lift: 6, via: [v3(-22, 21.5, PZ), v3(2, 21.5, PZ)] });
    // город: основа и дома
    at(box(40, 1.2, 30, 0x5d7a5a), CX, 0.6, CZ);
    const houses = [];
    let s = 5; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) {
      const h = 4 + rnd() * 9, x = CX - 15 + i * 7.5, z = CZ - 10.5 + j * 7;
      at(box(5, h, 5, rnd() > 0.5 ? 0xc8d1e2 : 0xa9b4c9), x, 1.2 + h / 2, z);
      const wm = K.own(0x3a4152); const w = box(3.4, h * 0.7, 0.3, 0, { mat: wm, edges: false }); at(w, x, 1.2 + h / 2, z + 2.6);
      houses.push({ wm, ord: rnd() });
    }
    houses.sort((a, b) => a.ord - b.ord);
    // столбик «электроэнергия страны за год»: метка «1 год» на середине
    const TX = 58, TZ = -20, TH = 44;
    at(cyl(4.6, 1.6, C.DARK, { seg: 24 }), TX, 0.8, TZ);
    const tubeG = new T.Mesh(kit.keep(new T.CylinderGeometry(3.4, 3.4, TH, 24, 1, true)), K.own(0x9cc4e8, { transparent: true, opacity: 0.18, depthWrite: false, side: T.DoubleSide })); at(tubeG, TX, 1.6 + TH / 2, TZ);
    const fillM = K.own(0xffd36b, { emissive: 0x6a4a10 });
    const fill = cyl(3, 1, 0, { mat: fillM, edges: false, hull: false, seg: 24 }); at(fill, TX, 1.6, TZ); fill.visible = false;
    at(box(9, 0.6, 0.6, 0xe8ecf4, { edges: false }), TX, 1.6 + TH / 2, TZ + 3.4);
    const yl = K.plate('1 год', 6, 2.2, '#1b1610', '#fff6e6'); at(yl, TX - 7.6, 1.6 + TH / 2, TZ + 3.5);
    // табло энергии
    const bd = K.board(-6, -36, 44, 20, 440, 200, 7);
    K.text(bd.s, [['E = mc² = ' + d.Etxt, '#e8ecf4', 28, 18, 30], ['= ' + d.kwh, '#72d4e8', 24, 18, 76], ['как взрыв ' + d.kt, '#ff8a73', 24, 18, 120], ['как сжечь ' + d.coal, '#a9b4c9', 24, 18, 164]]);
    // пульт
    const pu = K.console3(-4, 34, 64, 'масса');
    const ms = K.plate('m = ' + d.mtxt, 14, 4.2, '#ffb547', '#0e1520'); at(ms, -22.5, 7.5, 4.56, pu);
    K.button(pu, -9.5, 7.5, 4.7, '1 г', 'm1g', { w: 6.5, h: 4.2 }); K.button(pu, -2, 7.5, 4.7, '1 кг', 'm1', { w: 7, h: 4.2 });
    K.button(pu, 7.5, 7.5, 4.7, '−0,1 кг', 'm-', { w: 10, h: 4.2 }); K.button(pu, 18.5, 7.5, 4.7, '+0,1 кг', 'm+', { w: 10, h: 4.2 });
    K.button(pu, 0, 2.6, 4.7, 'Превратить', 'conv', { w: 22, h: 3.6, col: 0xe0473a, bg: '#e0473a', fg: '#ffffff' });
    tag(v3(PX, PY + side + 5, PZ), 'Кубик · m = ' + d.mtxt, d.conv ? 'стало энергией' : 'нажмите — превратить', d.conv);
    tag(v3(CX, 17, CZ), 'Страна за год', d.conv ? d.ftxt + ' годового' : 'ждёт превращения', d.conv && d.ok);
    tag(v3(-6, bd.top + 2, -36), 'Энергия покоя', d.Etxt);
    const o = v3(PX, PY + side / 2, PZ), q = v3(), q2 = v3();
    kit.onFrame(() => {
      const L = live(); if (!L) return;
      const k = d.conv ? L.k : 0, anim = d.conv && k < 1;
      if (cubeM) { const sc = d.conv ? Math.max(0.001, 1 - k) : 1; cubeM.scale.setScalar(sc); cubeM.visible = sc > 0.01; cubeM.position.y = side * sc / 2; }
      flash.material.opacity = anim ? 1 - k : 0; flash.scale.setScalar(10 + 60 * k);
      rays.forEach(({ r, a, e }) => {
        if (!anim) { r.m.visible = false; return; }
        const r1 = 3 + k * 10, r2 = 6 + k * 34, dx = Math.cos(a), dz = Math.sin(a);
        r.set(q.set(o.x + dx * r1, o.y + e * r1, o.z + dz * r1), q2.set(o.x + dx * r2, o.y + e * r2, o.z + dz * r2));
        r.m.material.opacity = 1 - k;
      });
      const f = d.conv ? d.frac * k : 0, nLit = Math.round(clamp(f, 0, 1) * houses.length);
      houses.forEach((h, i) => h.wm.color.setHex(i < nLit ? (f > 1.0001 && i % 2 ? 0xffb547 : 0xffd166) : 0x3a4152));
      const fh = clamp(f / 2, 0, 1) * TH;
      fill.visible = fh > 0.05; fill.scale.y = Math.max(0.01, fh); fill.position.y = 1.6 + fh / 2;
      fillM.color.setHex(f > 2 ? 0xff8a73 : 0xffd36b);
    });
  };
})();
