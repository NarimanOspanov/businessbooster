// «Как в жизни» для тем «Импульс» (labs/phys-momentum) и «Работа и энергия» (labs/phys-energy):
// тележка на треке с датчиком скорости и табло импульса, две тележки с пластилином или пружиной (и вариант с табло энергии и теплом),
// модель ракеты на натянутой струне, ящик с динамометром и лебёдкой, два подъёмника (рабочий и мотор),
// гиря на полке штатива и тележка с полосами энергии, падение мяча в трубе с насосом и полосами энергии.
// Описание сцены — из window.LUCH_REAL() опыта; быстрые величины (положения, скорость, энергия) — из window.LUCH_REAL.live() каждый кадр.
(() => {
  const SC = (window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {});
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const live = () => { try { const f = window.LUCH_REAL && window.LUCH_REAL.live; return (f && f()) || null; } catch (e) { return null; } };
  const TAU = Math.PI * 2;
  const num = (x, n) => { let s = (Math.round(x * 10 ** n) / 10 ** n).toFixed(n); if (/^-0(\.0+)?$/.test(s)) s = s.slice(1); return s.replace('.', ',').replace('-', '−'); };
  const nf = x => num(x, Math.abs(x - Math.round(x)) < 1e-9 ? 0 : Math.abs(x * 10 - Math.round(x * 10)) < 1e-9 ? 1 : 2);
  const big = x => String(Math.round(Math.abs(x))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const mem = {}; // что было до перестройки сцены: где стояла тележка, высота гири, сдвиг ящика
  const ease = (cur, to, dt, k = 6) => { const c = cur + (to - cur) * Math.min(1, dt * k); return Math.abs(to - c) < 1e-3 ? to : c; };
  const MONO = '"IBM Plex Mono", monospace';

  // подпись, у которой значение меняется каждый кадр без перестройки сцены
  function liveTag(kit, p, name, value, hot) {
    kit.tag(p, name, value, hot);
    const l = document.querySelectorAll('.rl-lbl'), el = l[l.length - 1], i = el && el.querySelector('i');
    let shown = value;
    return { p, set(v) { if (i && v !== shown) { shown = v; i.textContent = v; } } };
  }

  // ---------- общие детали ----------
  function tools(kit) {
    const { T, at, box, cyl, mesh, keep, v3, C } = kit;
    const own = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: kit.grad, ...o }));
    const basic = (color, o = {}) => keep(new T.MeshBasicMaterial({ color, ...o }));
    const W = (g, p) => { g.updateMatrixWorld(true); return p.clone().applyMatrix4(g.matrixWorld); };
    function plate(txt, w, h, fg = '#1b1610', bg = '#f7f3ea') {
      const t = keep(kit.textTex(txt, fg, bg, Math.round(64 * w / h), 64));
      return new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: t })));
    }
    // экран с холстом: перерисовывается по требованию
    function screen(w, h, pw = 288, ph = 192) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph;
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: tex })));
      return { m, c, x: c.getContext('2d'), tex, W: pw, H: ph };
    }
    // табло на двух стойках у дальнего края стола
    function board(x, z, w, h, pw, ph, y0 = 9) {
      const g = new T.Group(); at(g, x, 0, z);
      for (const s of [-1, 1]) { at(box(3, y0, 3, C.DARK), s * (w / 2 - 5), y0 / 2, 0, g); at(box(6, 1, 6, 0x3a3f4c), s * (w / 2 - 5), 0.5, 0, g); }
      at(box(w + 2, h + 2, 4, 0x2c3240), 0, y0 + h / 2, 0, g);
      const s = screen(w - 1, h - 1, pw, ph); at(s.m, 0, y0 + h / 2, 2.06, g);
      return { g, s, top: y0 + h + 1 };
    }
    // стрелка вдоль +x: set(len); для «влево» повернуть группу на π по y
    function arrow(col, r = 0.5) {
      const g = new T.Group(), hd = r * 4.4;
      const sh = cyl(r, 1, col, { edges: false, hull: false }); sh.rotation.z = Math.PI / 2; g.add(sh);
      const head = cyl(r * 2.5, hd, col, { r2: 0, edges: false, seg: 18 }); head.rotation.z = -Math.PI / 2; g.add(head);
      return { g, set(len) { const l = Math.max(0.01, len - hd); sh.scale.y = l; sh.position.x = l / 2; head.position.x = l + hd / 2; g.visible = len > hd * 0.8; } };
    }
    // нить/стержень между двумя точками
    function rod(col, r = 0.22) {
      const m = cyl(r, 1, col, { edges: false, hull: false, seg: 8 }); const up = v3(0, 1, 0), dv = v3(0, 0, 0);
      return { m, set(a, b) { dv.copy(b).sub(a); const l = dv.length(); if (l < 1e-4) { m.visible = false; return; } m.visible = true; m.position.copy(a).addScaledVector(dv, 0.5); m.quaternion.setFromUnitVectors(up, dv.multiplyScalar(1 / l)); m.scale.set(1, l, 1); } };
    }
    // пружина вдоль +x из витков-колец
    function spring(turns, r, wire, col) {
      const g = new T.Group(), rings = [];
      for (let k = 0; k < turns; k++) { const m = mesh(new T.TorusGeometry(r, wire, 6, 20), col, { edges: false, hull: true }); m.rotation.y = Math.PI / 2; m.rotation.x = 0.28; g.add(m); rings.push(m); }
      return { g, set(len) { rings.forEach((m, k) => { m.position.x = (k + 0.5) / turns * len; }); } };
    }
    // кнопка на пульте (обращена к зрителю)
    function button(parent, x, y, z, txt, key, o = {}) {
      const b = new T.Group(); at(b, x, y, z, parent);
      const w = o.w || 5, h = o.h || 3.4;
      at(box(w, h, 1.4, o.col || 0xe8ecf4), 0, 0, 0, b);
      const p = plate(txt, w - 0.9, h - 1, o.fg || '#1b1610', o.bg || '#e8ecf4'); at(p, 0, 0, 0.72, b);
      kit.clickable(b, key); return b;
    }
    const RED = { col: 0xe0473a, bg: '#e0473a', fg: '#ffffff' }, GREEN = { col: 0x3fae5a, bg: '#3fae5a', fg: '#ffffff' }, YEL = { col: 0xffd166, bg: '#ffd166' };
    // пульт: корпус-брусок у переднего края
    function pult(x, z, w, h) { const g = new T.Group(); at(g, x, 0, z); at(box(w, h, 9, 0x3b4a66), 0, h / 2, 0, g); at(box(w + 0.6, 0.8, 9.4, 0x2c3240), 0, h + 0.2, 0, g); return g; }
    // табличка-индикатор на пульте (тёмная, светящиеся цифры)
    function lcd(parent, x, y, txt, w, col = '#ffb547') { const p = plate(txt, w, 4, col, '#0e1520'); at(p, x, y, 4.56, parent); return p; }
    // рельс-трек вдоль x: верх рельса y = 4
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
    // тележка: корпус, колёса (крутятся), гири сверху; центр в (0,0,0), низ колёс на y = 4
    function cart(len, col, n) {
      const g = new T.Group(), rw = 1.5, yW = 4 + rw, wheels = [];
      at(box(len, 3.6, 7, col), 0, yW + 2.4, 0, g);
      at(box(len - 2, 0.6, 7.4, 0x2c3240), 0, yW + 0.9, 0, g);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const w = new T.Group(); at(w, sx * (len / 2 - 2.6), yW, sz * 4.1, g);
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
    // световые ворота поперёк трека с табло скорости на передней стойке
    function gate(x, z, y0 = 0) {
      const g = new T.Group(); at(g, x, y0, z);
      for (const s of [-1, 1]) { at(box(1.6, 1, 3.6, C.DARK), 0, 0.5, s * 8, g); at(box(1.2, 17, 1.2, 0x3a3f4c), 0, 9.5, s * 8, g); at(box(2.2, 2.2, 1.6, 0xe0473a), 0, 10, s * 7, g); }
      at(box(1.4, 1.4, 17.4, 0x3a3f4c), 0, 18.4, 0, g);
      const lp = lamp(1.1, 0x3fff8a); at(lp, 0, 19.9, 0, g);
      at(box(10, 5, 1.6, 0x1b1f28), 0, 14, 9.4, g);
      const s = screen(9.2, 4.2, 230, 105); at(s.m, 0, 14, 10.22, g);
      return { g, lp, s };
    }
    // полоса энергии: столбик, set(h)
    function column(parent, x, z, w, col) {
      const m = box(w, 1, w, col); at(m, x, 0, z, parent);
      return { m, set(h) { const hh = Math.max(0.02, h); m.scale.y = hh; m.position.y = hh / 2 + 0.6; m.visible = h > 0.03; } };
    }
    // экран-цифры: крупное число по центру
    function digits(s, txt, col = '#86e0a8', size = 0.62) {
      const x = s.x; x.fillStyle = '#0c1a14'; x.fillRect(0, 0, s.W, s.H);
      let fs = Math.round(s.H * size); x.font = `600 ${fs}px ${MONO}`;
      const tw = x.measureText(txt).width; if (tw > s.W * 0.9) { fs = Math.floor(fs * s.W * 0.9 / tw); x.font = `600 ${fs}px ${MONO}`; }
      x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = col; x.shadowBlur = 8; x.fillText(txt, s.W / 2, s.H / 2 + 3); x.shadowBlur = 0;
      s.tex.needsUpdate = true;
    }
    // плитка выбора на столе (масса, вид удара): клик → key
    function tile(x, z, txt, key, on, w = 10) {
      const g = new T.Group(); at(g, x, 0, z); kit.clickable(g, key);
      at(box(w, on ? 1.4 : 0.8, 7, on ? 0xffd166 : C.WOOD2), 0, on ? 0.7 : 0.4, 0, g);
      const p = plate(txt, w - 1.6, 3.6, on ? '#1b1610' : '#5d6573', on ? '#ffd166' : '#f7f3ea'); p.rotation.x = -Math.PI / 2; at(p, 0, on ? 1.45 : 0.85, 0, g);
      return g;
    }
    // метки линейки вдоль переднего края трека: X(k) для k = 0..n
    function ticks(X, n, z, y, step = 1, labels) {
      for (let k = 0; k <= n; k += step) {
        const bigT = labels && labels.includes(k);
        at(box(0.3, bigT ? 1.2 : 0.7, 0.12, 0x1b1610, { edges: false, shadow: false }), X(k), y - (bigT ? 0.2 : 0.45), z);
      }
      (labels || []).forEach(k => { const p = plate(k + ' м', 4.6, 2, '#1b1610', '#f1e3c2'); p.rotation.x = -1.1; at(p, X(k), 0.9, z + 3.4); });
    }
    return { own, basic, W, plate, screen, board, arrow, rod, spring, button, pult, lcd, track, cart, lamp, gate, column, digits, tile, ticks, RED, GREEN, YEL };
  }

  // холст: заливка и рамка
  function clear(s, bg = '#0e1520') { const x = s.x; x.fillStyle = bg; x.fillRect(0, 0, s.W, s.H); return x; }
  function text(x, t, X, Y, col, size, align = 'left', w = 600) { x.fillStyle = col; x.font = `${w} ${size}px ${MONO}`; x.textAlign = align; x.textBaseline = 'middle'; x.fillText(t, X, Y); }
  function harrow(x, x0, x1, y, col, w = 8) {
    if (Math.abs(x1 - x0) < 2) return;
    const s = Math.sign(x1 - x0), hl = Math.min(18, Math.abs(x1 - x0) * 0.6);
    x.strokeStyle = col; x.lineWidth = w; x.lineCap = 'round'; x.beginPath(); x.moveTo(x0, y); x.lineTo(x1 - s * hl, y); x.stroke();
    x.fillStyle = col; x.beginPath(); x.moveTo(x1, y); x.lineTo(x1 - s * hl, y - w * 1.3); x.lineTo(x1 - s * hl, y + w * 1.3); x.closePath(); x.fill();
  }

  // =====================================================================================
  // Импульс, урок 1: тележка с гирями на треке, световые ворота с датчиком скорости, табло p = m·v, плитки масс, пульт
  SC['en-impulse'] = (kit, d) => {
    const { T, at, box, cyl, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const Z = -4, XL = -47, XR = 47, KV = 5, CL = 18;
    K.track(-60, 60, Z, { stopL: true, stopR: true });
    for (let k = -50; k <= 50; k += 10) at(box(0.3, k % 50 ? 0.7 : 1.2, 0.12, 0x1b1610, { edges: false, shadow: false }), k, 2.9, Z + 5.27);
    const ms = d.masses || [1, 2, 3, 4, 6], next = ms[(ms.indexOf(d.m) + 1) % ms.length];
    const ct = K.cart(CL, 0x5d7fb8, d.m - 1); clickable(ct.g, 'm-' + next);
    let x = clamp(mem.ix ?? 0, XL, XR), dist = mem.idist || 0;
    at(ct.g, x, 0, Z);
    const pl = K.plate(d.m + ' кг', 7, 2.4); at(pl, 0, ct.yB, 3.56, ct.g);
    // стрелки: скорость (голубая) и импульс (оранжевая) над тележкой
    const neg = d.v < 0;
    const vA = K.arrow(0x3fb6d6, 0.45), pA = K.arrow(0xffb547, 0.7);
    at(vA.g, 0, ct.top + 2.6, 0, ct.g); at(pA.g, 0, ct.top + 6.4, 0, ct.g);
    if (neg) { vA.g.rotation.y = Math.PI; pA.g.rotation.y = Math.PI; }
    vA.set(d.v ? 3 + Math.abs(d.v) * 2.2 : 0); pA.set(d.p ? 2 + Math.abs(d.p) * 0.72 : 0);
    // световые ворота в середине трека
    const gt = K.gate(0, Z);
    K.digits(gt.s, nf(Math.abs(d.v)) + ' м/с');
    // табло импульса: шкала −36…36, цели 12 и −6
    const bd = K.board(30, -33, 40, 21, 480, 252);
    { const x = clear(bd.s), W = bd.s.W, hit = d.p === 12 || d.p === -6;
      text(x, 'p = m · v', 20, 30, '#a9b4c9', 26);
      text(x, `${d.m} кг × ${d.v < 0 ? '(' + nf(d.v) + ')' : nf(d.v)} м/с`, 20, 72, '#e8ecf4', 30);
      text(x, '= ' + nf(d.p) + ' кг·м/с', 20, 116, hit ? '#86e0a8' : '#ffb547', 40, 'left', 700);
      const z0 = W / 2, k = (W - 60) / 72, y = 196;
      x.strokeStyle = '#8b96ad'; x.lineWidth = 2; x.beginPath(); x.moveTo(30, y); x.lineTo(W - 30, y); x.stroke();
      for (let p = -36; p <= 36; p += 6) { x.beginPath(); x.moveTo(z0 + p * k, y - 6); x.lineTo(z0 + p * k, y + 6); x.stroke(); }
      for (const [p, ok] of [[12, (d.hits || []).length >= 2], [-6, d.neg]]) { x.strokeStyle = '#86e0a8'; x.setLineDash([5, 4]); x.beginPath(); x.moveTo(z0 + p * k, y - 30); x.lineTo(z0 + p * k, y + 14); x.stroke(); x.setLineDash([]); text(x, (p > 0 ? '' : '−') + Math.abs(p) + (ok ? ' ✓' : ''), z0 + p * k, y + 30, '#86e0a8', 20, 'center'); }
      text(x, '0', z0, y + 30, '#8b96ad', 18, 'center');
      harrow(x, z0, z0 + d.p * k, y - 14, '#ffb547', 7);
      text(x, '12 кг·м/с: ' + ((d.hits || []).length ? d.hits.map(m => m + ' кг').join(', ') : '—'), W - 20, 30, '#86e0a8', 20, 'right');
      bd.s.tex.needsUpdate = true; }
    // плитки масс
    ms.forEach((m, k) => K.tile(-52 + k * 11.5, 25, m + ' кг', 'm-' + m, m === d.m));
    // пульт скорости
    const pu = K.pult(34, 27, 36, 9);
    K.lcd(pu, -10, 4.6, 'v = ' + nf(d.v) + ' м/с', 13, '#72d4e8');
    const bo = { w: 6.4, h: 4.6 };
    K.button(pu, 0.8, 4.6, 4.7, 'v −', 'v-', bo); K.button(pu, 8, 4.6, 4.7, 'v +', 'v+', bo); K.button(pu, 15.1, 4.6, 4.7, 'Стоп', 'v0', { ...bo, ...K.RED });

    const ctTag = v3(x, ct.top + 12, Z);
    tag(ctTag, 'Тележка ' + d.m + ' кг', d.v ? (neg ? 'едет влево' : 'едет вправо') : 'стоит');
    tag(v3(30, bd.top + 1, -33), 'Импульс', 'p = ' + nf(d.p) + ' кг·м/с', d.p === 12 || d.p === -6);
    tag(v3(0, 22, Z), 'Датчик скорости', nf(d.v) + ' м/с');
    tag(v3(-30, 4, 25), 'Масса', 'нажмите плитку');

    kit.onFrame((dt) => {
      if (d.v && !kit.reduce) {
        x += d.v * KV * dt; dist += d.v * KV * dt;
        if (x > XR) x = XL; else if (x < XL) x = XR;
      }
      mem.ix = x; mem.idist = dist;
      ct.g.position.x = x; ctTag.x = x; ct.spin(dist);
      gt.lp.material.emissiveIntensity = Math.abs(x) < CL / 2 && d.v ? 1 : 0;
    });
  };

  // =====================================================================================
  // Импульс, урок 2: две тележки на треке 10 м, пластилин или пружина, табло Σp до и после, пульт скоростей
  SC['en-collide'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const Z = -4, PPM = 10, X = x => -50 + x * PPM, CL = 9.6, LIM = 56;
    K.track(-64, 64, Z, { stopL: true, stopR: true });
    K.ticks(X, 10, Z + 5.27, 3.3, 1, [0, 5, 10]);
    const mk = (m, col, key) => {
      const c = K.cart(CL, col, m - 1); clickable(c.g, key); at(c.g, 0, 0, Z);
      at(box(8.8, 3, 0.8, 0x1b1f28), 0, c.yB, 3.9, c.g);
      const s = K.screen(8.2, 2.5, 196, 60); at(s.m, 0, c.yB, 4.32, c.g);
      const a = K.arrow(col === 0x3fa6c4 ? 0x72d4e8 : 0xc3a8ff, 0.45); at(a.g, 0, c.top + 2.6, 0, c.g); a.set(0);
      return { ...c, s, a, m };
    };
    const c1 = mk(d.m1, 0x3fa6c4, 'm1'), c2 = mk(d.m2, 0x9a7fd8, 'm2');
    // пластилин на второй тележке или пружина на первой
    let spr = null, pad = null;
    if (d.mode === 'stick') {
      const blob = mesh(new T.SphereGeometry(1.5, 16, 12), 0xd9a35f, { hull: true, edges: false }); blob.scale.set(0.55, 1, 1.2); at(blob, -CL / 2 - 0.2, c2.yB, 0, c2.g);
    } else {
      const sg = new T.Group(); at(sg, CL / 2, c1.yB, 0, c1.g);
      spr = K.spring(4, 1.3, 0.22, 0xc8d2e3); sg.add(spr.g);
      pad = box(0.5, 3, 3.6, 0xa9b4c9); sg.add(pad);
    }
    // табло импульсов до и после
    const bd = K.board(30, -33, 42, 22, 504, 264);
    { const x = clear(bd.s), Wd = bd.s.W, z0 = 230, kp = 6.2;
      const row = (y, lab, p1, p2, col) => {
        text(x, lab, 14, y + 22, '#a9b4c9', 30, 'left', 700);
        harrow(x, z0, z0 + p1 * kp, y, '#72d4e8', 7); harrow(x, z0, z0 + p2 * kp, y + 22, '#c3a8ff', 7); harrow(x, z0, z0 + (p1 + p2) * kp, y + 50, col, 12);
        text(x, 'p₁ ' + nf(p1), Wd - 14, y, '#72d4e8', 24, 'right'); text(x, 'p₂ ' + nf(p2), Wd - 14, y + 24, '#c3a8ff', 24, 'right'); text(x, 'Σ ' + nf(p1 + p2), Wd - 14, y + 54, col, 32, 'right', 700);
      };
      x.strokeStyle = '#8b96ad'; x.lineWidth = 2; x.beginPath(); x.moveTo(z0, 14); x.lineTo(z0, 230); x.stroke();
      row(24, 'до', d.m1 * d.v1, d.m2 * d.v2, '#ffb547');
      if (d.res) row(132, 'после', d.m1 * d.res.u1, d.m2 * d.res.u2, '#86e0a8');
      else { text(x, 'после', 14, 156, '#a9b4c9', 30, 'left', 700); text(x, 'удара ещё не было', z0 + 16, 158, '#8b96ad', 26); }
      text(x, 'кг·м/с · вправо — плюс', Wd - 14, 248, '#8b96ad', 18, 'right');
      bd.s.tex.needsUpdate = true; }
    // вид удара
    K.tile(-50, 25, 'пластилин', 'stick', d.mode === 'stick', 14);
    K.tile(-34, 25, 'пружина', 'elastic', d.mode === 'elastic', 14);
    // пульт: скорости и пуск
    const pu = K.pult(26, 27, 48, 13);
    const bo = { w: 6.2, h: 4.2 };
    K.lcd(pu, -15.5, 9.4, 'v₁ = ' + nf(d.v1), 13, '#72d4e8');
    K.button(pu, -5.6, 9.4, 4.7, 'v₁ −', 'v1-', bo); K.button(pu, 1, 9.4, 4.7, 'v₁ +', 'v1+', bo);
    K.button(pu, 9.4, 9.4, 4.7, 'v₂ −', 'v2-', bo); K.button(pu, 16, 9.4, 4.7, 'v₂ +', 'v2+', bo);
    K.lcd(pu, -15.5, 3.8, 'v₂ = ' + nf(d.v2), 13, '#c3a8ff');
    K.button(pu, -2.3, 3.8, 4.7, d.run ? 'Едут…' : 'Пуск', 'go', { w: 9, h: 4.2, ...(d.run ? K.GREEN : K.RED) });
    K.button(pu, 9, 3.8, 4.7, 'Сброс', 'reset', { w: 9, h: 4.2 });

    const t1 = liveTag(kit, v3(0, c1.top + 19, Z), 'Тележка ' + d.m1 + ' кг', 'v = ' + nf(d.v1) + ' м/с');
    const t2 = liveTag(kit, v3(0, c2.top + 7, Z), 'Тележка ' + d.m2 + ' кг', 'v = ' + nf(d.v2) + ' м/с');
    const P = d.m1 * d.v1 + d.m2 * d.v2;
    tag(v3(30, bd.top + 1, -33), 'Сумма импульсов', d.res ? 'до ' + nf(P) + ' · после ' + nf(d.m1 * d.res.u1 + d.m2 * d.res.u2) : 'до удара ' + nf(P) + ' кг·м/с', !!d.res && ((d.mode === 'stick' && d.stick) || (d.mode === 'elastic' && d.eq)));
    tag(v3(-42, 5, 25), 'Удар', d.mode === 'stick' ? 'сцепка: едут вместе' : 'упругий: разлетаются');

    let tick = 0;
    const show = (c, u) => K.digits(c.s, c.m + ' кг · ' + nf(Math.round(u * 100) / 100) + ' м/с', '#86e0a8', 0.6);
    kit.onFrame(() => {
      const Lv = live(); if (!Lv) return;
      const a = clamp(X(Lv.x1) + CL / 2 + 0.2, -LIM, LIM), b = clamp(X(Lv.x2) + CL / 2 + 0.2, -LIM, LIM);
      c1.g.position.x = a; c2.g.position.x = b; t1.p.x = a; t2.p.x = b;
      c1.spin(Lv.x1 * PPM); c2.spin(Lv.x2 * PPM);
      const u1 = Lv.u1, u2 = Lv.u2;
      for (const [c, u] of [[c1, u1], [c2, u2]]) { c.a.g.rotation.y = u < 0 ? Math.PI : 0; c.a.set(Math.abs(u) > 0.01 ? 3 + Math.abs(u) * 2.2 : 0); }
      if (spr) { const gap = clamp(b - a - CL - 0.6, 0.5, 2.6); spr.set(gap); pad.position.x = gap; }
      t1.set('v = ' + nf(Math.round(u1 * 100) / 100) + ' м/с'); t2.set('v = ' + nf(Math.round(u2 * 100) / 100) + ' м/с');
      if ((tick++ & 3) && tick > 4) return;
      show(c1, u1); show(c2, u2);
    });
  };

  // =====================================================================================
  // Импульс (10 класс): упругий и неупругий удар — две тележки, пластилин или пружина, табло импульса и энергии, вспышка тепла
  SC['en-impact'] = (kit, d) => {
    const { T, at, box, mesh, v3, tag, clickable, keep } = kit;
    const K = tools(kit);
    const Z = -4, PPM = 10, X = x => -50 + x * PPM, CL = 9.6, LIM = 56;
    K.track(-64, 64, Z, { stopL: true, stopR: true });
    K.ticks(X, 10, Z + 5.27, 3.3, 1, [0, 5, 10]);
    const mk = (m, col, acol, key) => {
      const c = K.cart(CL, col, m - 1); clickable(c.g, key); at(c.g, 0, 0, Z);
      at(box(8.8, 3, 0.8, 0x1b1f28), 0, c.yB, 3.9, c.g);
      const s = K.screen(8.2, 2.5, 196, 60); at(s.m, 0, c.yB, 4.32, c.g);
      const a = K.arrow(acol, 0.45); at(a.g, 0, c.top + 2.6, 0, c.g); a.set(0);
      return { ...c, s, a, m };
    };
    const c1 = mk(d.m1, 0x3fa6c4, 0x72d4e8, 'm1'), c2 = mk(d.m2, 0x9a7fd8, 0xc3a8ff, 'm2');
    const stick = d.mode === 'stick';
    let spr = null, pad = null, blob = null;
    if (stick) { blob = mesh(new T.SphereGeometry(1.5, 16, 12), 0xd9a35f, { hull: true, edges: false }); blob.scale.set(0.55, 1, 1.2); at(blob, -CL / 2 - 0.2, c2.yB, 0, c2.g); }
    else { const sg = new T.Group(); at(sg, CL / 2, c1.yB, 0, c1.g); spr = K.spring(4, 1.3, 0.22, 0xc8d2e3); sg.add(spr.g); pad = box(0.5, 3, 3.6, 0xa9b4c9); sg.add(pad); }
    // вспышка тепла в точке неупругого удара
    const glow = new T.Sprite(keep(new T.SpriteMaterial({ map: kit.glowTex(), color: 0xff8a3c, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0 })));
    glow.visible = false; at(glow, 0, c2.yB + 1, Z + 1);

    // табло: импульс пары и кинетическая энергия до и после
    const bd = K.board(30, -33, 42, 22, 504, 264), r = d.res;
    { const x = clear(bd.s), Wd = bd.s.W, z0 = 250;
      const P1 = r ? d.m1 * r.u1 + d.m2 * r.u2 : null, kp = 150 / Math.max(1, Math.abs(d.P));
      text(x, 'ИМПУЛЬС, кг·м/с', 14, 18, '#8b96ad', 18, 'left', 600);
      x.strokeStyle = '#8b96ad'; x.lineWidth = 2; x.beginPath(); x.moveTo(z0, 30); x.lineTo(z0, 104); x.stroke();
      const prow = (y, lab, P, col) => { text(x, lab, 14, y, '#a9b4c9', 26, 'left', 700); if (Math.abs(P) > 1e-6) harrow(x, z0, z0 + P * kp, y, col, 11); else { x.fillStyle = col; x.beginPath(); x.arc(z0, y, 7, 0, TAU); x.fill(); } text(x, 'Σ ' + nf(P), Wd - 14, y, col, 28, 'right', 700); };
      prow(48, 'до', d.P, '#ffb547');
      if (r) prow(90, 'после', P1, '#86e0a8'); else { text(x, 'после', 14, 90, '#a9b4c9', 26, 'left', 700); text(x, 'удара ещё не было', z0 - 60, 90, '#8b96ad', 22); }
      x.fillStyle = '#26324a'; x.fillRect(10, 114, Wd - 20, 2);
      text(x, 'КИНЕТИЧЕСКАЯ ЭНЕРГИЯ, Дж', 14, 134, '#8b96ad', 18, 'left', 600);
      const bx = 150, kE = 230 / Math.max(1, d.E0);
      text(x, 'до', 14, 166, '#a9b4c9', 26, 'left', 700);
      x.fillStyle = '#ffb547'; x.fillRect(bx, 154, Math.max(2, d.E0 * kE), 24); text(x, nf(d.E0), Wd - 14, 166, '#ffb547', 26, 'right', 700);
      text(x, 'после', 14, 214, '#a9b4c9', 26, 'left', 700);
      if (r) {
        const w1 = r.E1 * kE, wq = r.Q * kE;
        x.fillStyle = '#86e0a8'; x.fillRect(bx, 202, w1, 24);
        if (wq > 0.5) { x.fillStyle = '#ff8a73'; x.fillRect(bx + w1, 202, wq, 24); x.fillStyle = '#5a2f2a'; for (let k = 0; k < wq; k += 9) x.fillRect(bx + w1 + k, 202, 3, 24); }
        text(x, nf(r.E1) + (r.Q > 0.005 ? ' + ' + nf(r.Q) : ''), Wd - 14, 214, '#86e0a8', 24, 'right', 700);
      } else text(x, 'удара ещё не было', bx, 214, '#8b96ad', 22);
      x.fillStyle = '#86e0a8'; x.fillRect(bx, 242, 14, 14); text(x, 'Eк', bx + 20, 250, '#8b96ad', 18);
      x.fillStyle = '#ff8a73'; x.fillRect(bx + 64, 242, 14, 14); text(x, 'тепло и деформация', bx + 84, 250, '#8b96ad', 18);
      bd.s.tex.needsUpdate = true; }
    // вид удара
    K.tile(-50, 25, 'неупругий', 'stick', stick, 14);
    K.tile(-34, 25, 'упругий', 'elastic', !stick, 14);
    // пульт: скорости и пуск
    const pu = K.pult(26, 27, 48, 13), bo = { w: 6.2, h: 4.2 };
    K.lcd(pu, -15.5, 9.4, 'v₁ = ' + nf(d.v1), 13, '#72d4e8');
    K.button(pu, -5.6, 9.4, 4.7, 'v₁ −', 'v1-', bo); K.button(pu, 1, 9.4, 4.7, 'v₁ +', 'v1+', bo);
    K.button(pu, 9.4, 9.4, 4.7, 'v₂ −', 'v2-', bo); K.button(pu, 16, 9.4, 4.7, 'v₂ +', 'v2+', bo);
    K.lcd(pu, -15.5, 3.8, 'v₂ = ' + nf(d.v2), 13, '#c3a8ff');
    K.button(pu, -2.3, 3.8, 4.7, d.run ? 'Едут…' : 'Пуск', 'go', { w: 9, h: 4.2, ...(d.run ? K.GREEN : K.RED) });
    K.button(pu, 9, 3.8, 4.7, 'Сброс', 'reset', { w: 9, h: 4.2 });

    const t1 = liveTag(kit, v3(0, c1.top + 19, Z), 'Тележка ' + d.m1 + ' кг', 'v = ' + nf(d.v1) + ' м/с');
    const t2 = liveTag(kit, v3(0, c2.top + 7, Z), 'Тележка ' + d.m2 + ' кг', 'v = ' + nf(d.v2) + ' м/с');
    const okNow = !!r && ((r.mode === 'stick' && (d.half || d.zero)) || (r.mode === 'elastic' && d.cmp));
    tag(v3(30, bd.top + 1, -33), 'Энергия', r ? 'Eк ' + nf(d.E0) + ' → ' + nf(r.E1) + ' Дж' + (r.Q > 0.005 ? ' · тепло ' + nf(r.Q) : '') : 'Eк до удара ' + nf(d.E0) + ' Дж', okNow);
    tag(v3(-42, 5, 25), 'Удар', stick ? 'неупругий: слипаются' : 'упругий: разлетаются');
    const hTag = stick ? liveTag(kit, v3(0, c2.top + 2, Z + 6), 'Тепло', r ? nf(r.Q) + ' Дж' : 'после удара') : null;
    if (hTag) { const l = document.querySelectorAll('.rl-lbl'); hTag.el = l[l.length - 1]; if (hTag.el) hTag.el.style.visibility = 'hidden'; }

    let tick = 0;
    const show = (c, u) => K.digits(c.s, c.m + ' кг · ' + nf(Math.round(u * 100) / 100) + ' м/с', '#86e0a8', 0.6);
    kit.onFrame(() => {
      const Lv = live(); if (!Lv) return;
      const a = clamp(X(Lv.x1) + CL / 2 + 0.2, -LIM, LIM), b = clamp(X(Lv.x2) + CL / 2 + 0.2, -LIM, LIM);
      c1.g.position.x = a; c2.g.position.x = b; t1.p.x = a; t2.p.x = b;
      c1.spin(Lv.x1 * PPM); c2.spin(Lv.x2 * PPM);
      const u1 = Lv.u1, u2 = Lv.u2;
      for (const [c, u] of [[c1, u1], [c2, u2]]) { c.a.g.rotation.y = u < 0 ? Math.PI : 0; c.a.set(Math.abs(u) > 0.01 ? 3 + Math.abs(u) * 2.2 : 0); }
      if (spr) { const gap = clamp(b - a - CL - 0.6, 0.5, 2.6); spr.set(gap); pad.position.x = gap; }
      const hot = stick && Lv.heat >= 0, k = hot && !kit.reduce ? clamp(1 - Lv.heat / 1.4, 0, 1) : 0;
      glow.visible = hot; if (hot) { glow.position.x = b - CL / 2; glow.material.opacity = 0.3 + 0.65 * k; glow.scale.setScalar(7 + 12 * k); }
      if (blob) blob.scale.x = hot ? 0.22 : 0.55;
      if (hTag) { hTag.p.x = b - CL / 2; if (hTag.el) hTag.el.style.visibility = hot ? '' : 'hidden'; }
      t1.set('v = ' + nf(Math.round(u1 * 100) / 100) + ' м/с'); t2.set('v = ' + nf(Math.round(u2 * 100) / 100) + ' м/с');
      if ((tick++ & 3) && tick > 4) return;
      show(c1, u1); show(c2, u2);
    });
  };

  // =====================================================================================
  // Импульс, урок 3: модель ракеты на натянутой струне, баллончик топлива, облако газа, табло импульсов, пульт
  SC['en-jet'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const Z = -6, YW = 25, X0 = -26, KR = 0.03, XMAX = 30, flown = d.fly || !!d.last;
    // стойки и струна
    for (const sx of [-58, 58]) {
      at(cyl(4, 1.4, C.DARK), sx, 0.7, Z); at(cyl(0.8, YW + 2, C.STEEL, { edges: false }), sx, (YW + 2) / 2 + 1.4, Z);
      at(box(3, 2.4, 2.4, 0x3a3f4c), sx, YW, Z);
    }
    const wire = cyl(0.18, 116, 0xdfe5ee, { edges: false, hull: false, seg: 6 }); wire.rotation.z = Math.PI / 2; at(wire, 0, YW, Z);
    // уловитель из поролона
    at(box(4, 9, 9, 0xf0c94a), 51, YW - 5, Z); at(box(1, 10, 10, 0x3a3f4c), 53.5, YW - 5, Z);
    // ракета: корпус, нос, стабилизаторы, сопло; висит на двух кольцах
    const rk = new T.Group(); at(rk, X0, YW - 6, Z); clickable(rk, 'fire');
    const L = 22, R = 3;
    { const b = cyl(R, L, 0xe9edf3, { seg: 32 }); b.rotation.z = Math.PI / 2; rk.add(b);
      const n = cyl(R, 8, 0xe0473a, { r2: 0.2, seg: 32 }); n.rotation.z = -Math.PI / 2; at(n, L / 2 + 4, 0, 0, rk);
      const w = cyl(1.3, 0.4, 0x3c6f8a, { seg: 20 }); w.rotation.x = Math.PI / 2; at(w, 5, 0.6, R - 0.05, rk);
      for (let k = 0; k < 4; k++) { const f = new T.Group(); f.rotation.x = k * Math.PI / 2 + Math.PI / 4; at(f, -L / 2 + 2.5, 0, 0, rk); at(box(5, 0.5, 4, 0xe0473a), 0, 0, R + 1.6, f); }
      const nz = cyl(2.2, 3, 0x5d6a86, { r2: 1.4, seg: 24 }); nz.rotation.z = Math.PI / 2; at(nz, -L / 2 - 1.4, 0, 0, rk);
      for (const sx of [-6, 6]) { at(cyl(0.3, 3.4, C.STEEL, { edges: false }), sx, R + 1.6, 0, rk); const ring = mesh(new T.TorusGeometry(0.9, 0.3, 8, 18), C.STEEL, { edges: false }); ring.rotation.y = Math.PI / 2; at(ring, sx, 6, 0, rk); }
      // топливо: оранжевая секция у хвоста, длина по массе газа (до запуска)
      if (!flown) { const fl = 2 + d.mg / 500 * 9; const f = cyl(R + 0.08, fl, 0xffb547, { seg: 32 }); f.rotation.z = Math.PI / 2; at(f, -L / 2 + 0.6 + fl / 2, 0, 0, rk); }
      const lb = K.plate(d.M + ' кг', 7, 2); at(lb, 1, -1.2, R + 0.02, rk); }
    // облако газа
    const puffs = [];
    if (flown) {
      const r = 1.2 + Math.sqrt(d.last ? d.last.mg : d.mg) * 0.16;
      for (let i = 0; i < 12; i++) {
        const m = new T.Mesh(kit.keep(new T.SphereGeometry(r * (0.7 + (i % 3) * 0.2), 14, 10)), K.own(i % 2 ? 0xff8a73 : 0xffb547, { transparent: true, opacity: 0.7, depthWrite: false }));
        at(m, 0, YW - 6, Z); puffs.push({ m, a: Math.sin(i * 12.99) * 0.5 + 0.5, b: Math.sin(i * 78.2), c: Math.cos(i * 37.7) });
      }
    }
    // стрелки импульсов: ракета вправо, газ влево, одной длины
    const pg = (d.last ? d.last.mg * d.last.ug : d.mg * d.ug);
    const aR = K.arrow(0x72d4e8, 0.55), aG = K.arrow(0xffb547, 0.55); aG.g.rotation.y = Math.PI;
    at(aR.g, 0, -8, 0, rk); kit.root.add(aG.g); aG.g.position.set(0, YW - 14, Z);
    const alen = 5 + pg / 1.5e6 * 16; aR.set(flown ? alen : 0); aG.set(flown ? alen : 0);
    // табло
    const bd = K.board(-6, -34, 46, 20, 552, 240, 30);
    { const x = clear(bd.s), Wd = bd.s.W, v = d.last ? d.last.v : d.v, mg = d.last ? d.last.mg : d.mg, ug = d.last ? d.last.ug : d.ug, ok = d.last && Math.abs(d.last.v - d.vNeed) < 1e-6;
      text(x, `газ: ${mg} кг × ${big(ug)} м/с = ${big(mg * ug)}`, 18, 32, '#ffb547', 26);
      text(x, `ракета: ${d.M} кг × ${nf(v)} м/с = ${big(d.M * v)}`, 18, 74, '#72d4e8', 26);
      const z0 = Wd / 2, kp = (Wd / 2 - 40) / 1.5e6;
      x.strokeStyle = '#8b96ad'; x.lineWidth = 2; x.beginPath(); x.moveTo(z0, 104); x.lineTo(z0, 182); x.stroke();
      if (flown) { harrow(x, z0, z0 + d.M * v * kp, 124, '#72d4e8', 9); harrow(x, z0, z0 - mg * ug * kp, 162, '#ffb547', 9); }
      text(x, flown ? `сумма: ${big(d.M * v)} − ${big(mg * ug)} = 0` : 'до старта всё покоится: p = 0', 18, 212, '#e8ecf4', 24);
      text(x, 'цель ' + d.vNeed + ' м/с' + (ok ? ' ✓' : ''), Wd - 18, 212, '#86e0a8', 24, 'right', 700);
      bd.s.tex.needsUpdate = true; }
    // пульт
    const pu = K.pult(28, 28, 46, 13), bo = { w: 6.6, h: 4.2 };
    K.lcd(pu, -14, 9.4, 'mг = ' + d.mg + ' кг', 16);
    K.button(pu, -1.6, 9.4, 4.7, 'mг −', 'mg-', bo); K.button(pu, 5.4, 9.4, 4.7, 'mг +', 'mg+', bo);
    K.lcd(pu, -14, 3.8, 'vг = ' + d.ug + ' м/с', 16);
    K.button(pu, -1.6, 3.8, 4.7, 'vг −', 'ug-', bo); K.button(pu, 5.4, 3.8, 4.7, 'vг +', 'ug+', bo);
    K.button(pu, 15.6, 9.4, 4.7, d.fly ? 'Летит…' : 'Запуск', 'fire', { w: 11, h: 4.2, ...(d.fly ? K.GREEN : K.RED) });
    K.button(pu, 15.6, 3.8, 4.7, 'Сброс', 'reset', { w: 11, h: 4.2 });

    const v = d.last ? d.last.v : d.v;
    const rkTag = v3(X0, YW + 6, Z);
    tag(rkTag, 'Ракета ' + d.M + ' кг', flown ? 'v = ' + nf(v) + ' м/с' : 'нажмите — запуск', !!d.last && Math.abs(v - d.vNeed) < 1e-6);
    const gTag = v3(X0 - 16, YW - 9, Z);
    tag(gTag, 'Газ', (d.last ? d.last.mg : d.mg) + ' кг · ' + big(d.last ? d.last.ug : d.ug) + ' м/с');
    tag(v3(-6, bd.top + 1, -34), 'Сумма импульсов', '0 кг·м/с');

    const ug = d.last ? d.last.ug : d.ug;
    kit.onFrame(() => {
      const Lv = live() || { lt: 0 };
      const t = flown ? Lv.lt : 0;
      const rx = X0 + Math.min(XMAX - X0, v * KR * t);
      rk.position.x = rx; rkTag.x = rx;
      const gd = Math.min(32, ug * t * 0.011);
      aG.g.position.x = X0 - L / 2 - 4 - gd * 0.6; gTag.x = X0 - L / 2 - 6 - gd * 0.6;
      puffs.forEach((p, i) => {
        const s = 1 + gd / 32 * 1.6, f = i / puffs.length;
        p.m.position.set(X0 - L / 2 - 3 - gd * (0.35 + 0.65 * f), YW - 6 + p.b * 2.2 * s, Z + p.c * 2.6 * s);
        p.m.scale.setScalar(0.6 + 0.8 * gd / 32 + p.a * 0.3);
        p.m.material.opacity = 0.75 - 0.4 * gd / 32;
      });
    });
  };

  // =====================================================================================
  // Энергия, урок 1: ящик 80 кг на доске, динамометр, верёвка на барабан лебёдки, линейка 0…6 м, график F(s), пульт
  SC['en-work'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const Z = -4, PPM = 11, X = s => -50 + s * PPM, CW = 14, CH = 12, YB = 2;
    // доска-пол с линейкой
    at(box(102, YB, 24, C.WOOD2), -11, YB / 2, Z);
    at(box(98, 0.2, 2.4, 0xf1e3c2, { edges: false }), -11, YB + 0.1, Z + 10.4);
    for (let k = 0; k <= 12; k++) { const s = k / 2; at(box(0.3, 0.12, k % 2 ? 1 : 2, 0x1b1610, { edges: false, shadow: false }), X(s), YB + 0.26, Z + 10.4 - (k % 2 ? 0.6 : 0.2)); }
    for (let s = 0; s <= 6; s++) { const p = K.plate(s + ' м', 4.2, 1.8, '#1b1610', '#f1e3c2'); p.rotation.x = -1.1; at(p, X(s), 1.2, Z + 13.8); }
    // линия старта
    at(box(0.5, 0.14, 22, 0x3fae5a, { edges: false, shadow: false }), X(0), YB + 0.08, Z);
    at(cyl(0.3, 9, 0x3fae5a, { edges: false }), X(0), YB + 4.5, Z - 11); const sf = K.plate('старт', 5, 2, '#ffffff', '#3fae5a'); at(sf, X(0) + 2.8, YB + 8, Z - 11);
    // ящик
    const cr = new T.Group(); clickable(cr, 'pull');
    at(box(CW, CH, 12, 0xb07a42), 0, CH / 2, 0, cr);
    for (const s of [-1, 1]) { const dg = box(0.9, Math.hypot(CW, CH) - 2, 0.4, 0x7a5228, { edges: false }); dg.rotation.z = s * Math.atan2(CW, CH); at(dg, 0, CH / 2, 6.1, cr); }
    for (const [w, h, x, y] of [[CW, 1.2, 0, 0.6], [CW, 1.2, 0, CH - 0.6], [1.2, CH, -CW / 2 + 0.6, CH / 2], [1.2, CH, CW / 2 - 0.6, CH / 2]]) at(box(w, h, 0.5, 0x8a5c2e, { edges: false }), x, y, 6.15, cr);
    const lb = K.plate('80 кг', 5.6, 2.4, '#fff2dc', '#7a5228'); at(lb, 0, CH / 2, 6.5, cr);
    // динамометр на передней стенке ящика
    const yR = 6, dyn = new T.Group(); at(dyn, CW / 2, yR, 0, cr);
    at(box(1.2, 1.4, 1.4, C.STEEL), 0.6, 0, 0, dyn);
    { const tb = cyl(1.3, 10, 0xe8ecf4); tb.rotation.z = Math.PI / 2; at(tb, 6.2, 0, 0, dyn);
      for (let k = 0; k <= 6; k++) at(box(0.14, k % 2 ? 0.5 : 0.9, 0.12, 0x1b1610, { edges: false, shadow: false }), 2 + k * 1.4, 0.95, 1.1, dyn);
      const pin = box(0.5, 2.9, 2.9, 0xe0473a, { edges: false }); at(pin, 2 + clamp(d.F, 0, 300) / 300 * 8.4, 0, 0, dyn);
      const rr = cyl(0.35, 2.4, C.STEEL, { edges: false }); rr.rotation.z = Math.PI / 2; at(rr, 12.4, 0, 0, dyn);
      at(new T.Mesh(kit.keep(new T.TorusGeometry(0.8, 0.22, 6, 16)), K.own(C.STEEL)), 14.2, 0, 0, dyn); }
    const hook = v3(CW / 2 + 15, yR + YB, Z);
    // сила F — оранжевая стрелка над динамометром
    const fA = K.arrow(0xffb547, 0.55); at(fA.g, CW / 2 + 1, yR + 3.6, 0, cr); fA.set(d.F ? 4 + d.F * 0.045 : 0);
    let cur = Math.min(mem.ws ?? d.s, d.s); if (mem.wF !== d.F) cur = d.s; mem.wF = d.F;
    at(cr, X(cur) + CW / 2, YB, Z);
    // путь s — голубая стрелка вдоль переднего края
    const sA = K.arrow(0x3fb6d6, 0.42); at(sA.g, X(0), YB + 0.6, Z + 7.6);
    // лебёдка с ручкой
    const wn = new T.Group(); at(wn, 56, 0, Z); clickable(wn, 'pull');
    at(box(10, 1.2, 14, C.DARK), 0, 0.6, 0, wn);
    for (const s of [-1, 1]) at(box(5, 9, 1, 0x3b4a66), 0, 5.7, s * 4.6, wn);
    const drum = new T.Group(); at(drum, 0, yR + YB - 2.4, 0, wn);
    { const dr = cyl(2.2, 8, 0xd9dfe9); dr.rotation.x = Math.PI / 2; drum.add(dr);
      for (const s of [-1, 1]) { const f = cyl(3.2, 0.5, C.STEEL); f.rotation.x = Math.PI / 2; at(f, 0, 0, s * 3.8, drum); }
      at(box(0.5, 4.6, 8.2, 0x8b93a1, { edges: false }), 0, 0, 0, drum);
      for (let k = 0; k < 3; k++) { const w = cyl(2.32, 0.5, 0xe9d9a8, { edges: false, hull: false }); w.rotation.x = Math.PI / 2; at(w, 0, 0, -1 + k * 0.7, drum); } }
    const crank = new T.Group(); at(crank, 0, yR + YB - 2.4, 5.4, wn);
    { const ax = cyl(0.5, 1.6, C.STEEL, { edges: false }); ax.rotation.x = Math.PI / 2; crank.add(ax);
      at(box(0.8, 5, 0.6, C.STEEL), 0, 2.2, 0.6, crank);
      const h = cyl(0.7, 3, 0xe0473a); h.rotation.x = Math.PI / 2; at(h, 0, 4.4, 2, crank); }
    const rope = K.rod(0xe9d9a8, 0.24); kit.root.add(rope.m);
    const drumTop = v3(56, yR + YB - 0.2, Z);
    // график F(s): площадь прямоугольника — работа
    const bd = K.board(28, -33, 40, 22, 480, 264);
    { const x = clear(bd.s), gx = 70, gy = 222, gw = 340, gh = 160, Xs = s => gx + gw * s / 6, Yf = F => gy - gh * F / 300, A = d.F * d.s;
      x.strokeStyle = 'rgba(160,185,230,.2)'; x.lineWidth = 1.5;
      for (let F = 0; F <= 300; F += 100) { x.beginPath(); x.moveTo(gx, Yf(F)); x.lineTo(gx + gw, Yf(F)); x.stroke(); text(x, String(F), gx - 8, Yf(F), '#8b96ad', 17, 'right', 500); }
      for (let s = 0; s <= 6; s += 2) text(x, String(s), Xs(s), gy + 18, '#8b96ad', 17, 'center', 500);
      if (d.s > 0 && d.F > 0) { x.fillStyle = 'rgba(255,181,71,.35)'; x.fillRect(gx, Yf(d.F), Xs(d.s) - gx, gy - Yf(d.F)); x.strokeStyle = '#ffb547'; x.lineWidth = 2; x.strokeRect(gx, Yf(d.F), Xs(d.s) - gx, gy - Yf(d.F)); }
      x.strokeStyle = '#ffb547'; x.lineWidth = 3; if (!d.s) x.setLineDash([8, 6]); x.beginPath(); x.moveTo(gx, Yf(d.F)); x.lineTo(gx + gw, Yf(d.F)); x.stroke(); x.setLineDash([]);
      x.strokeStyle = '#a9b4c9'; x.lineWidth = 2; x.beginPath(); x.moveTo(gx, Yf(320)); x.lineTo(gx, gy); x.lineTo(gx + gw + 10, gy); x.stroke();
      text(x, 'F, Н', gx + 6, 22, '#a9b4c9', 18); text(x, 's, м', gx + gw + 14, gy - 16, '#a9b4c9', 18, 'right');
      text(x, 'A = F · s = ' + nf(A) + ' Дж', gx + gw, 26, d.hit ? '#86e0a8' : '#e8ecf4', 26, 'right', 700);
      bd.s.tex.needsUpdate = true; }
    // пульт
    const pu = K.pult(22, 33, 50, 9), bo = { w: 7.4, h: 4.6 };
    K.lcd(pu, -16.6, 4.6, 'F = ' + d.F + ' Н', 13);
    K.button(pu, -5.8, 4.6, 4.7, 'F −', 'F-', bo); K.button(pu, 2, 4.6, 4.7, 'F +', 'F+', bo);
    K.button(pu, 11.6, 4.6, 4.7, 'Тянуть', 'pull', { w: 9.6, h: 4.6, ...K.RED });
    K.button(pu, 20.4, 4.6, 4.7, 'Сброс', 'reset', { w: 7.4, h: 4.6 });

    const weak = d.F <= d.Fstuck;
    const crTag = v3(X(cur) + CW / 2, CH + YB + 8, Z);
    tag(crTag, 'Ящик 80 кг', weak && d.F > 0 && d.stuck && !d.s ? 'не сдвинулся: s = 0' : 's = ' + nf(d.s) + ' м', weak && d.stuck && !d.s);
    const dTag = v3(X(cur) + CW + 8, yR + YB + 7, Z);
    tag(dTag, 'Динамометр', 'F = ' + d.F + ' Н', weak && d.F > 0);
    tag(v3(28, bd.top + 1, -33), 'Работа', 'A = ' + nf(d.F * d.s) + ' Дж', d.hit);
    tag(v3(56, 15, Z), 'Лебёдка', 'нажмите — тянуть');

    kit.onFrame((dt, t) => {
      cur =cur < d.s ? Math.min(d.s, cur + dt * 1.4) : d.s; mem.ws = cur;
      let jig = 0;
      if (weak && d.F > 0 && d.stuck && !kit.reduce) jig = Math.sin(t * 40) * 0.06;
      const cx = X(cur) + CW / 2 + jig;
      cr.position.x = cx; crTag.x = cx; dTag.x = cx + CW / 2 + 8;
      rope.set(v3(cx, 0, 0).add(hook), drumTop);
      sA.set(cur > 0.05 ? cur * PPM : 0);
      const ang = -cur * PPM / 2.2; drum.rotation.z = ang; crank.rotation.z = ang;
    });
  };

  // =====================================================================================
  // Энергия, урок 2: два подъёмника с грузом 1000 Н на 12 м — рабочий с ручной лебёдкой (200 Вт) и мотор; секундомер, пульт
  SC['en-power'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const ZT = -18, HK = 2.3, Y0 = 1.2, YP = Y0 + 12 * HK + 8.6;
    const yLoad = h => Y0 + h * HK;
    function tower(x) {
      const g = new T.Group(); at(g, x, 0, ZT);
      at(box(16, 1.2, 12, C.DARK), 0, 0.6, 0, g);
      for (const s of [-1, 1]) at(box(1.4, YP + 2, 1.4, 0x56657e), s * 6.4, (YP + 2) / 2 + 1.2, 0, g);
      for (let k = 1; k < 5; k++) { const dg = box(0.4, 15.4, 0.4, 0x46536a, { edges: false }); dg.rotation.z = (k % 2 ? 1 : -1) * 0.69; at(dg, 0, k * (YP / 5), -0.9, g); }
      at(box(15, 1.6, 2.4, 0x56657e), 0, YP + 2.6, 0, g);
      const pul = new T.Group(); at(pul, 0, YP, 0, g);
      { const wh = cyl(2.6, 1.2, C.STEEL, { seg: 24 }); wh.rotation.x = Math.PI / 2; pul.add(wh); at(box(0.4, 4.4, 1.3, 0x8b93a1, { edges: false }), 0, 0, 0, pul); }
      at(box(1, 3, 2, 0x3a3f4c), 0, YP + 1.4, 0, g);
      // груз 1000 Н
      const ld = new T.Group(); at(ld, -2.6, Y0, 0, g);
      at(box(8, 6, 7, 0x6c7488), 0, 3, 0, ld);
      const lp = K.plate('1000 Н', 6.4, 2.2, '#fff6e6', '#3a4050'); at(lp, 0, 3, 3.56, ld);
      at(new T.Mesh(kit.keep(new T.TorusGeometry(0.8, 0.22, 6, 16)), K.own(C.STEEL)), 0, 6.8, 0, ld);
      const r1 = K.rod(0xe9d9a8, 0.22); g.add(r1.m);
      return { g, pul, ld, r1 };
    }
    // финишная линия 12 м
    const L = tower(-30), R = tower(16);
    at(box(70, 0.3, 0.3, 0x3fae5a, { edges: false }), -7, yLoad(12), ZT + 6.4);
    // линейка высоты
    const rg = new T.Group(); at(rg, -7, 0, ZT);
    at(box(3, 1, 3, C.DARK), 0, 0.5, 0, rg); at(box(1.6, 12 * HK + 1, 0.6, 0xf1e3c2), 0, Y0 + 6 * HK, 0, rg);
    for (let k = 0; k <= 12; k++) at(box(k % 2 ? 0.7 : 1.2, 0.16, 0.12, 0x1b1610, { edges: false, shadow: false }), -0.2, yLoad(k), 0.34, rg);
    for (const k of [0, 4, 8, 12]) { const p = K.plate(k + ' м', 4.4, 2, '#1b1610', '#f1e3c2'); at(p, 3.4, yLoad(k), 0.4, rg); }
    // слева: ручная лебёдка и рабочий
    const wl = new T.Group(); at(wl, -42, 0, -4);
    at(box(8, 1.2, 9, C.DARK), 0, 0.6, 0, wl); for (const s of [-1, 1]) at(box(4, 6, 0.8, 0x3b4a66), 0, 4, s * 3.4, wl);
    const dL = new T.Group(); at(dL, 0, 5, 0, wl); { const c = cyl(1.8, 6, 0xd9dfe9); c.rotation.x = Math.PI / 2; dL.add(c); at(box(0.4, 3.8, 6.2, 0x8b93a1, { edges: false }), 0, 0, 0, dL); }
    const crk = new T.Group(); at(crk, 0, 5, 4.4, wl);
    { at(box(0.7, 4.4, 0.5, C.STEEL), 0, 2, 0, crk); const h = cyl(0.6, 2.4, 0xe0473a); h.rotation.x = Math.PI / 2; at(h, 0, 4, 1.2, crk); }
    // рабочий: стоит перед лебёдкой, крутит ручку
    const man = new T.Group(); at(man, -42, 0, 8);
    for (const s of [-1, 1]) at(cyl(0.9, 7, 0x2c3e66), s * 1.3, 3.5, 0, man);
    at(box(5, 6.4, 3, 0x3fa6c4), 0, 10.2, 0, man);
    at(mesh(new T.SphereGeometry(2, 18, 12), 0xf2c9a0, { hull: true, edges: false }), 0, 15.4, 0, man);
    at(cyl(2.2, 1, 0xffb547, { r2: 1.6 }), 0, 16.9, 0, man);
    const arm = K.rod(0x3fa6c4, 0.7); kit.root.add(arm.m);
    const shoulder = v3(-42, 12, 8);
    // справа: мотор с барабаном
    const mt = new T.Group(); at(mt, 32, 0, -4);
    at(box(16, 1.2, 10, C.DARK), 0, 0.6, 0, mt);
    for (const s of [-1, 1]) at(box(0.8, 6, 6, 0x3b4a66), -2 + s * 3.4, 4, 0, mt);
    const dR = new T.Group(); at(dR, -2, 5, 0, mt); { const c = cyl(1.8, 6, 0xd9dfe9); c.rotation.z = Math.PI / 2; dR.add(c); at(box(6.2, 3.8, 0.4, 0x8b93a1, { edges: false }), 0, 0, 0, dR); }
    { const body = cyl(3.4, 7, 0x3c6f8a, { seg: 24 }); body.rotation.z = Math.PI / 2; at(body, 6, 4.6, 0, mt);
      for (let k = 0; k < 5; k++) { const r = cyl(3.7, 0.4, 0x2d5a72, { edges: false, seg: 24 }); r.rotation.z = Math.PI / 2; at(r, 3.4 + k * 1.3, 4.6, 0, mt); }
      const np = K.plate(d.N + ' Вт', 6, 2.2, '#1b1610', '#ffd166'); at(np, 6, 4.6, 3.75, mt); }
    const led = new T.Mesh(kit.keep(new T.SphereGeometry(0.6, 12, 8)), K.own(0x4a5240, { emissive: 0x3fe07a, emissiveIntensity: d.run ? 1 : 0 })); at(led, 9.6, 8.4, 0, mt);
    // верёвки от блоков к барабанам
    const rL = K.rod(0xe9d9a8, 0.22), rR = K.rod(0xe9d9a8, 0.22); kit.root.add(rL.m); kit.root.add(rR.m);
    rL.set(v3(-30 + 2.6, YP, ZT), v3(-42, 6.8, -4)); rR.set(v3(16 + 2.6, YP, ZT), v3(30, 6.8, -4));
    // секундомер
    const sw = new T.Group(); at(sw, -6, 0, 22);
    at(box(22, 9, 8, 0x2c3240), 0, 4.5, 0, sw); at(box(22.4, 1, 8.4, 0x46536a), 0, 9.5, 0, sw);
    const ss = K.screen(18, 6, 300, 100); at(ss.m, 0, 5.2, 4.06, sw);
    // пульт
    const pu = K.pult(34, 28, 40, 9), bo = { w: 8, h: 4.6 };
    K.lcd(pu, -12.6, 4.6, 'N = ' + d.N + ' Вт', 13);
    K.button(pu, -1.6, 4.6, 4.7, '− 250', 'N-', bo); K.button(pu, 6.8, 4.6, 4.7, '+ 250', 'N+', bo);
    K.button(pu, 15.6, 4.6, 4.7, d.run ? '…' : 'Поднять', 'go', { w: 8.6, h: 4.6, ...(d.run ? K.GREEN : K.RED) });
    clickable(mt, 'go');

    const tW = liveTag(kit, v3(-30, Y0 + 12, ZT), 'Рабочий 200 Вт', 'h = 0 м');
    const tM = liveTag(kit, v3(16, Y0 + 12, ZT), 'Мотор ' + d.N + ' Вт', 'h = 0 м');
    tag(v3(-7, 3, ZT + 8), 'Работа', 'A = 1000 Н × 12 м = 12 000 Дж');
    const fin = d.fin;
    tag(v3(-6, 11, 22), 'Секундомер', fin ? 'подъём ' + nf(fin.t) + ' с, рабочий: ' + nf(fin.hw) + ' м' : 'мотору нужно t = A / N', d.ok);

    let tick = 0;
    const place = (T0, h) => { const y = yLoad(h); T0.ld.position.y = y; T0.r1.set(v3(-2.6, y + 7.6, 0), v3(-2.6, YP, 0)); T0.pul.rotation.z = h * HK / 2.6; };
    kit.onFrame(() => {
      const Lv = live() || { tt: 0, hr: 0, hw: 0 };
      place(L, Lv.hw); place(R, Lv.hr);
      tW.p.y = yLoad(Lv.hw) + 12; tM.p.y = yLoad(Lv.hr) + 12;
      tW.set('h = ' + num(Lv.hw, 1) + ' м'); tM.set('h = ' + num(Lv.hr, 1) + ' м');
      dL.rotation.z = Lv.hw * HK / 1.8; crk.rotation.z = Lv.hw * HK / 1.8 * 0.5; dR.rotation.x = -Lv.hr * HK / 1.8;
      // рука рабочего держит ручку
      crk.updateMatrixWorld(true); const hp = v3(0, 4, 0.8).applyMatrix4(crk.matrixWorld); arm.set(shoulder, hp);
      if ((tick++ & 1) && tick > 2) return;
      K.digits(ss, num(Lv.tt, 1) + ' с', d.ok && !Lv.run ? '#86e0a8' : '#86e0a8');
    });
  };

  // =====================================================================================
  // Энергия, урок 3: гиря на полке штатива с линейкой 0…10 м, тележка 16 кг на треке с воротами, полосы Eп и Eк
  SC['en-kinpot'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const SX = -46, SZ = -14, HK = 2.8, Y0 = 1.6;
    // штатив: основание, стойка-линейка, полка на муфте
    const st = new T.Group(); at(st, SX, 0, SZ);
    at(box(16, 1.6, 12, C.DARK), 0, 0.8, 0, st);
    at(cyl(0.8, 10 * HK + 6, C.STEEL, { edges: false }), -5, (10 * HK + 6) / 2 + 1.6, 0, st);
    at(box(2.2, 10 * HK + 1, 0.6, 0xf1e3c2), -2.6, Y0 + 5 * HK, 0.8, st);
    for (let k = 0; k <= 10; k++) at(box(k % 2 ? 0.7 : 1.3, 0.16, 0.12, 0x1b1610, { edges: false, shadow: false }), -2.4, Y0 + k * HK, 1.14, st);
    for (const k of [0, 2, 4, 6, 8, 10]) { const p = K.plate(k + ' м', 4, 1.8, '#1b1610', '#f1e3c2'); at(p, -7.4, Y0 + k * HK, 0.9, st); }
    let hc = mem.kh ?? d.h;
    const sh = new T.Group(); at(sh, 0, Y0 + hc * HK, 0, st);
    at(box(3, 3, 3, 0x3a3f4c), -5, -1.2, 0, sh);
    at(box(12, 0.8, 9, 0x8b93a1), 2.2, -0.4, 0, sh);
    // гиря
    const r = 2.2 + d.m * 0.45, kb = new T.Group(); at(kb, 2.6, r, 0, sh); clickable(kb, 'h+');
    kb.add(mesh(new T.SphereGeometry(r, 26, 18), 0x4a5468, { hull: true, edges: false }));
    { const hd = mesh(new T.TorusGeometry(r * 0.55, 0.45, 8, 20, Math.PI), 0x4a5468, { edges: false, hull: true }); at(hd, 0, r * 0.75, 0, kb); }
    const kp = K.plate(d.m + ' кг', 3.6, 1.6, '#fff6e6', '#2c3240'); at(kp, 0, -0.2, r + 0.05, kb);
    // плитки масс гири
    (d.masses || [2, 3, 4]).forEach((m, k) => K.tile(-56 + k * 11, 22, m + ' кг', 'm-' + m, m === d.m));
    // трек и тележка 16 кг
    const Z = 2, XL = -10, XR = 52, KV = 4, CL = 16;
    K.track(-20, 62, Z, { stopL: true, stopR: true });
    const ct = K.cart(CL, 0xf0a347, 3);
    const cpl = K.plate(d.mc + ' кг', 6, 2.2); at(cpl, 0, ct.yB, 3.56, ct.g);
    let x = clamp(mem.kx ?? 6, XL, XR), dist = mem.kdist || 0;
    at(ct.g, x, 0, Z); clickable(ct.g, 'v+');
    const vA = K.arrow(0xffb547, 0.5); at(vA.g, CL / 2, ct.yB + 2.6, 0, ct.g); vA.set(d.v ? 3 + d.v * 1.4 : 0);
    const gt = K.gate(30, Z); K.digits(gt.s, d.v + ' м/с');
    // полосы энергии: Eп и Eк, шкала 0…400 Дж
    const EK = 28 / 400, bg = new T.Group(); at(bg, -4, 0, -30);
    at(box(26, 1.2, 10, C.DARK), 0, 0.6, 0, bg);
    at(box(1, 32, 1, 0x3a3f4c), -12, 16, -3.6, bg);
    at(box(26, 32, 0.6, 0x1b2232), 0, 16.6, -4.4, bg);
    for (const E of [0, 100, 200, 300, 400]) { at(box(25, 0.18, 0.2, E === 200 ? 0x3fae5a : 0x46536a, { edges: false, shadow: false }), 0, 1.2 + E * EK, -3.9, bg); }
    { const p = K.plate('200 Дж', 6, 1.8, '#ffffff', '#3fae5a'); at(p, 9.6, 1.2 + 200 * EK + 1.4, -3.8, bg); }
    const cP = K.column(bg, -5, 0, 6, 0x72d4e8), cK = K.column(bg, 5, 0, 6, 0xffb547);
    const capK = box(6.4, 0.8, 6.4, 0xe0473a); at(capK, 5, 1.2 + 400 * EK + 0.4, 0, bg); capK.visible = d.Ek > 400;
    at(box(26, 3, 1.2, 0x2c3240), 0, 1.5, 5.6, bg);
    for (const [t, xx] of [['Eп', -5], ['Eк', 5]]) { const p = K.plate(t, 5, 2.4); at(p, xx, 1.6, 6.22, bg); }
    // пульт
    const pu = K.pult(34, 28, 40, 9), bo = { w: 6.6, h: 4.6 };
    K.button(pu, -15.6, 4.6, 4.7, 'h −', 'h-', bo); K.button(pu, -8.4, 4.6, 4.7, 'h +', 'h+', bo);
    K.lcd(pu, 0, 4.6, `h ${nf(d.h)} · v ${d.v}`, 8.6, '#e8ecf4');
    K.button(pu, 8.4, 4.6, 4.7, 'v −', 'v-', bo); K.button(pu, 15.6, 4.6, 4.7, 'v +', 'v+', bo);

    const kbTag = v3(SX + 2.6, Y0 + hc * HK + 2 * r + 5, SZ);
    tag(kbTag, 'Гиря ' + d.m + ' кг', 'h = ' + nf(d.h) + ' м · Eп = ' + nf(d.Ep) + ' Дж', d.ep && d.Ep === 200);
    const ctTag = v3(x, ct.top + 8, Z);
    tag(ctTag, 'Тележка ' + d.mc + ' кг', 'v = ' + d.v + ' м/с · Eк = ' + nf(d.Ek) + ' Дж', d.ek && d.Ek === 200);
    tag(v3(-4, 36, -30), 'Энергия', 'Eп ' + nf(d.Ep) + ' · Eк ' + nf(d.Ek) + ' Дж');
    tag(v3(-45, 4, 22), 'Масса гири', 'нажмите плитку');

    let eP = mem.eP ?? d.Ep, eK = mem.eK ?? d.Ek;
    kit.onFrame((dt) => {
      hc = ease(hc, d.h, dt); mem.kh = hc; sh.position.y = Y0 + hc * HK; kbTag.y = Y0 + hc * HK + 2 * r + 5;
      eP = ease(eP, d.Ep, dt); eK = ease(eK, d.Ek, dt); mem.eP = eP; mem.eK = eK;
      cP.set(Math.min(400, eP) * EK); cK.set(Math.min(400, eK) * EK); cP.m.position.y += 0.6; cK.m.position.y += 0.6;
      if (d.v && !kit.reduce) { x += d.v * KV * dt; dist += d.v * KV * dt; if (x > XR) x = XL; }
      mem.kx = x; mem.kdist = dist;
      ct.g.position.x = x; ctTag.x = x; ct.spin(dist);
      gt.lp.material.emissiveIntensity = Math.abs(x - 30) < CL / 2 && d.v ? 1 : 0;
    });
  };

  // =====================================================================================
  // Энергия, урок 4: стеклянная труба с линейкой, электромагнит держит мяч 2 кг, насос откачивает воздух, датчик у дна, полосы энергии
  SC['en-cons'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const TX = -24, TZ = -12, HK = 3.1, Y0 = 2, BR = 1.8, TH = 10 * HK + 7;
    const yB = h => Y0 + BR + h * HK;   // центр мяча; h — высота низа мяча над дном
    // основание и труба
    at(cyl(8, 2, C.WOOD2, { seg: 36 }), TX, 1, TZ);
    at(cyl(5.4, 1.4, 0x3a3f4c, { seg: 36 }), TX, Y0 + 0.2, TZ);
    at(cyl(5.4, 1.4, 0x3a3f4c, { seg: 36 }), TX, Y0 + TH, TZ);
    const tube = new T.Mesh(kit.keep(new T.CylinderGeometry(4.6, 4.6, TH, 36, 1, true)), K.own(0xcfe6f2, { transparent: true, opacity: 0.22, side: T.DoubleSide, depthWrite: false }));
    at(tube, TX, Y0 + TH / 2, TZ);
    for (const s of [-1, 1]) { const e = cyl(0.12, TH, 0xffffff, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.5 } }); at(e, TX + s * 3.2, Y0 + TH / 2, TZ + 3.3); }
    // клапан наверху: открыт, когда в трубе воздух
    const vl = cyl(1.2, 2.2, d.air ? 0x3fae5a : 0xe0473a); at(vl, TX + 2.6, Y0 + TH + 1.6, TZ);
    // линейка справа от трубы
    const rx = TX + 7.4;
    at(box(2.4, 10 * HK + 1, 0.6, 0xf1e3c2), rx, Y0 + 5 * HK, TZ + 1);
    for (let k = 0; k <= 10; k++) at(box(k % 2 ? 0.7 : 1.3, 0.16, 0.12, 0x1b1610, { edges: false, shadow: false }), rx - 0.3, Y0 + k * HK, TZ + 1.34);
    for (const k of [0, 2, 4, 6, 8, 10]) { const p = K.plate(k + ' м', 4, 1.8, '#1b1610', '#f1e3c2'); at(p, rx + 3.6, Y0 + k * HK, TZ + 1.1); }
    // старт: зелёная метка и электромагнит на штанге
    at(box(3, 0.3, 0.3, 0x3fae5a, { edges: false }), rx - 0.4, Y0 + d.h0 * HK, TZ + 1.5);
    const top = Y0 + TH, mgY = yB(d.h0) + BR + 0.9;
    at(cyl(0.4, Math.max(0.5, top - mgY - 1.2), C.STEEL, { edges: false }), TX, (top + mgY + 1.2) / 2, TZ);
    at(cyl(1.6, 1.8, 0xb5442e, { seg: 20 }), TX, mgY + 0.3, TZ);
    // мяч
    const ball = new T.Group(); clickable(ball, 'drop');
    ball.add(mesh(new T.SphereGeometry(BR, 24, 16), 0xff8a73, { hull: true, edges: false }));
    { const s = new T.Mesh(kit.keep(new T.TorusGeometry(BR * 1.01, 0.1, 6, 28)), K.basic(0x9b3b2a)); s.rotation.x = Math.PI / 2; ball.add(s); }
    at(ball, TX, yB(d.h0), TZ);
    // след: «призраки» мяча
    const ghosts = [];
    for (let i = 0; i < 30; i++) { const g = new T.Mesh(kit.keep(new T.TorusGeometry(BR, 0.1, 6, 20)), K.basic(0xffb547, { transparent: true, opacity: 0.45 })); g.rotation.x = Math.PI / 2; g.visible = false; at(g, TX, 0, TZ); ghosts.push(g); }
    const vA = K.arrow(0xffb547, 0.45); vA.g.rotation.z = -Math.PI / 2; at(vA.g, TX + 4.4, 0, TZ + 4); vA.set(0);
    // датчик скорости у дна (кольцо с табло)
    const ring = mesh(new T.TorusGeometry(5.4, 0.7, 8, 32), 0x3a3f4c, { edges: false, hull: true }); ring.rotation.x = Math.PI / 2; at(ring, TX, Y0 + 4.6, TZ);
    at(box(9, 4.6, 1.4, 0x1b1f28), TX, Y0 + 4.6, TZ + 6.2);
    const ds = K.screen(8.4, 3.8, 210, 95); at(ds.m, TX, Y0 + 4.6, TZ + 6.92);
    // насос со шлангом
    const pm = new T.Group(); at(pm, -50, 0, -4); clickable(pm, 'air');
    at(box(12, 8, 9, 0x56657e), 0, 4, 0, pm); at(box(12.4, 1, 9.4, 0x46536a), 0, 8.4, 0, pm);
    const gauge = cyl(2.6, 0.8, 0xf7f3ea, { seg: 28 }); gauge.rotation.x = Math.PI / 2; at(gauge, -2.4, 4.6, 4.6, pm);
    const ndl = box(0.3, 2.2, 0.2, 0xe0473a, { edges: false }); ndl.geometry.translate(0, 1, 0); ndl.rotation.z = d.air ? -0.9 : 0.9; at(ndl, -2.4, 4.6, 5.1, pm);
    const pled = new T.Mesh(kit.keep(new T.SphereGeometry(0.6, 12, 8)), K.own(0x4a5240, { emissive: 0x3fe07a, emissiveIntensity: d.air ? 0 : 1 })); at(pled, 3.6, 6, 4.6, pm);
    const ppl = K.plate(d.air ? 'воздух' : 'вакуум', 5, 1.8, '#ffffff', d.air ? '#5d6573' : '#2e9e4f'); at(ppl, 3.4, 3.2, 4.56, pm);
    { const pts = [v3(-44, 5, -4), v3(-38, 3, -6), v3(-32, 2.6, -10), v3(TX - 5.2, Y0 + 1.2, TZ)]; kit.root.add(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 40, 0.9, 8), 0x2c3240, { hull: true, edges: false })); }
    // полосы энергии: Eп, Eк, сумма, тепло; 200 Дж = 24 ед.
    const EK = 24 / 200, bg = new T.Group(); at(bg, 20, 0, -28);
    at(box(36, 1.2, 10, C.DARK), 0, 0.6, 0, bg);
    at(box(36, 30, 0.6, 0x1b2232), 0, 15.6, -4.4, bg); at(box(36, 3, 1.2, 0x2c3240), 0, 1.5, 5.6, bg);
    for (const E of [0, 50, 100, 150, 200]) at(box(35, 0.18, 0.2, E === 200 ? 0x5d6a86 : 0x46536a, { edges: false, shadow: false }), 0, 1.2 + E * EK, -3.9, bg);
    const e0 = box(35, 0.3, 0.3, 0x86e0a8, { edges: false }); at(e0, 0, 1.2 + d.E0 * EK, -3.6, bg);
    const cols = [['Eп', 0x72d4e8], ['Eк', 0xffb547], ['Eп + Eк', 0x86e0a8], ['тепло', 0xff8a73]].map(([t, c], i) => {
      const xx = -12.6 + i * 8.4, cl = K.column(bg, xx, 0, 5.6, c);
      const p = K.plate(t, 7.8, 2.4, '#1b1610', '#f7f3ea'); at(p, xx, 1.6, 6.22, bg);
      return cl;
    });
    // пульт
    const pu = K.pult(34, 28, 44, 13), bo = { w: 6.6, h: 4.2 };
    K.lcd(pu, -13, 9.4, 'h = ' + nf(d.h0) + ' м', 13);
    K.button(pu, -2.2, 9.4, 4.7, 'h −', 'h0-', bo); K.button(pu, 5, 9.4, 4.7, 'h +', 'h0+', bo);
    K.button(pu, 14.6, 9.4, 4.7, d.fall ? 'Летит…' : 'Бросить', 'drop', { w: 10.6, h: 4.2, ...(d.fall ? K.GREEN : K.RED) });
    K.button(pu, -12, 3.8, 4.7, d.air ? 'Воздух: да' : 'Воздух: нет', 'air', { w: 15, h: 4.2, ...(d.air ? K.YEL : {}) });
    K.button(pu, 3, 3.8, 4.7, 'Сброс', 'reset', { w: 9, h: 4.2 });

    const bTag = liveTag(kit, v3(TX - 9, yB(d.h0) + 6, TZ), 'Мяч 2 кг', 'h = ' + nf(d.h0) + ' м');
    const eTag = liveTag(kit, v3(20, 34, -28), 'Энергия', 'Eп + Eк = ' + nf(d.E0) + ' Дж');
    tag(v3(-54, 10, 0), 'Насос', d.air ? 'в трубе воздух' : 'воздух откачан', !d.air);
    const land = d.land;
    tag(v3(TX + 13, Y0 + 1, TZ + 9), 'Датчик у дна', land ? 'v = ' + num(land.v, 1) + ' м/с' : 'скорость удара', d.ok && land && !land.air);

    let tick = 0;
    kit.onFrame(() => {
      const Lv = live(); if (!Lv) return;
      const y = yB(Lv.y); ball.position.y = y; bTag.p.y = y + 6;
      if (!kit.reduce && Lv.vel > 0) ball.rotation.z -= 0.05;
      const tr = Lv.trail || [];
      ghosts.forEach((g, i) => { const on = i < tr.length && (Lv.fall || !!land); g.visible = on; if (on) g.position.y = yB(tr[i]); });
      vA.set(Lv.vel > 0.05 ? 2 + Lv.vel * 0.7 : 0); vA.g.position.y = y;
      cols[0].set(clamp(Lv.Ep, 0, 230) * EK); cols[1].set(clamp(Lv.Ek, 0, 230) * EK); cols[2].set(clamp(Lv.Ep + Lv.Ek, 0, 230) * EK); cols[3].set(clamp(Lv.lost, 0, 230) * EK);
      cols.forEach(c => { c.m.position.y += 0.6; });
      bTag.set('h = ' + num(Lv.y, 1) + ' м · v = ' + num(Lv.vel, 1) + ' м/с');
      eTag.set('Eп ' + Math.round(Lv.Ep) + ' + Eк ' + Math.round(Lv.Ek) + (d.air ? ' + тепло ' + Math.round(Lv.lost) : '') + ' Дж');
      if ((tick++ & 1) && tick > 2) return;
      K.digits(ds, land && !Lv.fall ? num(land.v, 1) + ' м/с' : num(Lv.vel, 1) + ' м/с', land && d.ok && !land.air ? '#86e0a8' : '#ffb547');
    });
  };
})();
