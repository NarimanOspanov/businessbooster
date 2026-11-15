// «Как в жизни» для темы «Колебания и волны» (labs/phys-waves): нитяной маятник с транспортиром и табло энергии,
// маятник с линейкой и секундомером, груз на пружине с мотором и резонансной кривой, волна на шнуре, звук и эхо.
// Описание сцены приходит из window.LUCH_REAL() опыта; быстрое состояние (угол, смещение, время волны) — из
// window.LUCH_REAL.live() каждый кадр, поэтому 3D движется ровно так же, как схема.
(() => {
  const SC = (window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {});
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const live = () => { try { const f = window.LUCH_REAL && window.LUCH_REAL.live; return f ? f() : null; } catch (e) { return null; } };
  const TAU = Math.PI * 2, PI = Math.PI, G = 9.81;
  const MONO = '"IBM Plex Mono", monospace';
  const f = (x, n = 1) => (Math.round(x * 10 ** n) / 10 ** n).toFixed(n).replace('.', ',').replace('-', '−');
  const nf = x => f(x, Math.abs(x - Math.round(x)) < 1e-9 ? 0 : Math.abs(x * 10 - Math.round(x * 10)) < 1e-9 ? 1 : 2);
  const ORANGE = 0xffb547, CYAN = 0x4cc3e0, RED = 0xe0473a, PANEL = 0x3b4a66, IRON = 0x3a3f4c;

  // ---------- общие детали этой темы ----------
  function tools(kit) {
    const { T, at, box, cyl, mesh, keep, C } = kit;
    const own = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: kit.grad, ...o }));
    const basic = (color, o = {}) => keep(new T.MeshBasicMaterial({ color, ...o }));
    const sphere = (r, col, o = {}) => mesh(new T.SphereGeometry(r, 28, 20), col, { hull: true, edges: false, ...o });
    // провод-трубка по точкам (мировые координаты)
    function wire(pts, col, r = 0.6) {
      const curve = new T.CatmullRomCurve3(pts, false, 'centripetal');
      kit.root.add(mesh(new T.TubeGeometry(curve, Math.max(24, Math.round(curve.getLength() * 1.2)), r, 8), col, { hull: true, edges: false }));
      return curve;
    }
    function plate(txt, w, h, fg = '#1b1610', bg = '#f7f3ea') {
      const t = keep(kit.textTex(txt, fg, bg, Math.round(64 * w / h), 64));
      return new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: t })));
    }
    // экран, который перерисовывается каждый кадр
    function screen(w, h, pw = 320, ph = 200) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph;
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace;
      const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: tex })));
      return { m, c, x: c.getContext('2d'), tex, W: pw, H: ph };
    }
    // картинка, нарисованная один раз (шкалы, журнал)
    function drawn(geo, pw, ph, draw, o = {}) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph; const x = c.getContext('2d');
      draw(x, pw, ph);
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      return new T.Mesh(keep(geo), keep(new T.MeshBasicMaterial({ map: tex, transparent: !!o.transparent, side: o.side || T.FrontSide, depthWrite: !o.transparent })));
    }
    // лабораторный штатив: тяжёлое основание, стойка
    function stand(x, z, h, parent) {
      at(box(14, 1.8, 11, IRON), x, 0.9, z + 2, parent);
      at(cyl(0.8, h, C.STEEL, { edges: false }), x, 1.8 + h / 2, z, parent);
      at(cyl(1.3, 1.4, C.STEEL, { seg: 6 }), x, 2.5, z, parent);
      return 1.8 + h;
    }
    // муфта на стойке
    function boss(x, y, z, parent) {
      at(box(3.2, 3.2, 3.2, IRON), x, y, z, parent);
      const s = cyl(0.5, 2.6, C.BRASS, { edges: false }); s.rotation.x = PI / 2; at(s, x, y, z + 2.6, parent);
      at(cyl(0.9, 0.8, C.BRASS, { seg: 10 }), x, y, z + 3.9, parent).rotation.x = PI / 2;
    }
    function button(parent, x, y, z, txt, key, o = {}) {
      const w = o.w || 5, h = o.h || 3.4, col = o.col ?? 0xe8ecf4, g = new T.Group(); at(g, x, y, z, parent);
      at(box(w, h, 1.6, col), 0, 0, 0, g);
      const p = plate(txt, w * 0.82, h * 0.7, o.fg || '#1b1610', o.bg || '#e8ecf4'); at(p, 0, 0, 0.82, g);
      kit.clickable(g, key); return g;
    }
    // тонкий стержень/нить между двумя точками, двигается каждый кадр
    function link(r, col, o = {}) {
      const m = cyl(r, 1, col, { edges: false, hull: false, seg: o.seg || 8 }); kit.root.add(m);
      const up = new T.Vector3(0, 1, 0), dir = new T.Vector3();
      return { m, set(a, b) { dir.subVectors(b, a); const L = dir.length() || 1e-3; m.position.copy(a).addScaledVector(dir, 0.5); m.scale.set(1, L, 1); m.quaternion.setFromUnitVectors(up, dir.multiplyScalar(1 / L)); } };
    }
    // стрелка вдоль +y внутри группы (группу поворачиваем куда нужно)
    function arrow(col) {
      const g = new T.Group();
      const sh = cyl(0.45, 1, col, { edges: false, seg: 10 }), hd = cyl(1.15, 2.4, col, { r2: 0.01, edges: false, seg: 14 });
      g.add(sh); g.add(hd);
      return { g, set(L) { if (L < 0.6) { g.visible = false; return; } g.visible = true; sh.scale.y = L; sh.position.y = L / 2; hd.position.y = L + 1.2; } };
    }
    // табло на подставке: пульт с кнопками спереди, наклонный экран сзади
    function board(x, z, w, sh, pw, ph) {
      const g = new T.Group(); at(g, x, 0, z);
      at(box(w, 4.4, 9, PANEL), 0, 2.2, 0, g);
      at(box(w + 0.4, 0.6, 9.4, 0x2c3240), 0, 4.5, 0, g);
      const pn = new T.Group(); at(pn, 0, 4.4, -2.8, g); pn.rotation.x = -0.1;
      at(box(w, sh + 2.4, 1.8, 0x2c3240), 0, (sh + 2.4) / 2, 0, pn);
      const scr = screen(w - 3, sh, pw, ph); at(scr.m, 0, (sh + 2.4) / 2, 0.95, pn);
      return { g, scr, top: 4.4 + (sh + 2.4) * Math.cos(0.1) };
    }
    return { own, basic, sphere, wire, plate, screen, drawn, stand, boss, button, link, arrow, board };
  }

  // =====================================================================================
  // Урок 1: нитяной маятник на штативе, транспортир, табло энергии с кнопками
  function protractor(x, W, H, amp) {
    const c = W / 2, R = W / 2 - 6;
    x.clearRect(0, 0, W, H);
    x.fillStyle = 'rgba(246,240,224,0.78)'; x.beginPath(); x.moveTo(c - R, c); x.arc(c, c, R, 0, PI); x.closePath(); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.0)';
    if (amp > 0.5) {   // сектор размаха
      const a = amp * PI / 180;
      x.fillStyle = 'rgba(142,91,216,0.20)'; x.beginPath(); x.moveTo(c, c); x.arc(c, c, R, PI / 2 - a, PI / 2 + a); x.closePath(); x.fill();
    }
    x.strokeStyle = '#1b1610'; x.lineWidth = 5; x.beginPath(); x.arc(c, c, R, 0, PI); x.stroke();
    x.lineWidth = 3; x.beginPath(); x.arc(c, c, R * 0.42, 0, PI); x.stroke();
    x.fillStyle = '#1b1610'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `600 24px ${MONO}`;
    for (let a = -90; a <= 90; a += 5) {
      const s = Math.sin(a * PI / 180), co = Math.cos(a * PI / 180), big = a % 10 === 0, l = big ? 30 : 16;
      x.lineWidth = big ? 4 : 2.5; x.beginPath(); x.moveTo(c + s * R, c + co * R); x.lineTo(c + s * (R - l), c + co * (R - l)); x.stroke();
      if (big && Math.abs(a) <= 80) x.fillText(String(Math.abs(a)), c + s * (R - 52), c + co * (R - 52));
    }
    x.setLineDash([10, 10]); x.strokeStyle = '#5d6573'; x.lineWidth = 3; x.beginPath(); x.moveTo(c, c); x.lineTo(c, c + R); x.stroke(); x.setLineDash([]);
    if (amp > 0.5) {
      const a = amp * PI / 180; x.strokeStyle = '#8e5bd8'; x.lineWidth = 6;
      for (const s of [-1, 1]) { x.beginPath(); x.moveTo(c + Math.sin(s * a) * R * 0.42, c + Math.cos(a) * R * 0.42); x.lineTo(c + Math.sin(s * a) * R, c + Math.cos(a) * R); x.stroke(); }
    }
  }
  SC['waves-pendulum'] = (kit, d) => {
    const { T, at, box, cyl, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const PX = 0, PY = 44, PZ = -10, LU = 34 * d.l, BR = 3.6, m = d.m, l = d.l;

    // штатив с горизонтальной штангой
    K.stand(-26, PZ, PY + 3);
    at(box(31, 1.4, 1.4, C.STEEL), -11.5, PY + 1.8, PZ);
    K.boss(-26, PY + 1.8, PZ);
    at(box(2.6, 1.6, 2.6, IRON), PX, PY + 0.9, PZ);
    const axle = cyl(0.45, 3.6, C.BRASS, { edges: false }); axle.rotation.x = PI / 2; at(axle, PX, PY, PZ);

    // транспортир за нитью (нижняя половина круга)
    const PR = 18;
    const prot = K.drawn(new T.CircleGeometry(PR, 64, PI, PI), 512, 512, (x, W, H) => protractor(x, W, H, d.run ? d.amp : 0), { transparent: true, side: T.DoubleSide });
    at(prot, PX, PY, PZ - 1.1);
    const rim = new T.Mesh(kit.keep(new T.TorusGeometry(PR, 0.3, 6, 48, PI)), K.own(0xe9e2cf)); rim.rotation.z = PI; at(rim, PX, PY, PZ - 1.1);
    at(box(2 * PR + 0.6, 0.7, 0.5, 0xe9e2cf), PX, PY - 0.35, PZ - 1.1);

    // маятник: нить и шар; группа качается вокруг оси подвеса
    const arm = new T.Group(); at(arm, PX, PY, PZ);
    at(cyl(0.14, LU - BR, 0xf3eee0, { edges: false, hull: false, seg: 6 }), 0, -(LU - BR) / 2, 0, arm);
    at(cyl(0.5, 1.2, C.BRASS, { edges: false }), 0, -LU + BR + 0.3, 0, arm);
    const ball = K.sphere(BR, 0xd6dbe6); at(ball, 0, -LU, 0, arm); clickable(ball, 'pull');
    at(K.sphere(BR * 0.3, 0xffffff, { hull: false }), -BR * 0.4, -LU + BR * 0.45, BR * 0.62, arm);
    const ar = K.arrow(0x34b8d8); at(ar.g, 0, -LU, 0.6, arm);

    // табло энергии с кнопками
    const B = K.board(16, 30, 34, 14, 380, 165);
    K.button(B.g, -11.2, 2.2, 4.6, '30°', 'pull', { w: 6.4, col: ORANGE, bg: '#ffb547' });
    K.button(B.g, -3.7, 2.2, 4.6, d.paused ? '▶' : '❚❚', 'freeze', { w: 6.4, col: d.paused ? 0x3fae5a : RED, bg: d.paused ? '#3fae5a' : '#e0473a', fg: '#ffffff' });
    K.button(B.g, 3.8, 2.2, 4.6, '⅛T', 'step', { w: 6.4, col: 0x3b6fd8, bg: '#3b6fd8', fg: '#ffffff' });
    K.button(B.g, 11.3, 2.2, 4.6, 'сброс', 'reset', { w: 6.4 });

    const E = m * G * l * (1 - Math.cos((d.run ? d.amp : 0) * PI / 180));
    tag(v3(-26, PY + 5, PZ), 'Маятник', 'l = ' + nf(l) + ' м · ' + nf(m) + ' кг');
    tag(v3(PX + 23, PY + 1, PZ - 1), 'Транспортир', d.run ? 'размах ' + d.amp + '°' : 'груз в покое');
    tag(v3(45, B.top - 5, 27), 'Табло энергии', d.run ? 'E = ' + f(E, 2) + ' Дж' : 'E = 0', d.snapK && d.snapP);

    const s = B.scr, Emax = 1.5;
    function draw(Ep, Ek) {
      const x = s.x, w = s.W, h = s.H;
      x.fillStyle = '#0e1520'; x.fillRect(0, 0, w, h);
      x.textBaseline = 'middle'; x.font = `600 21px ${MONO}`;
      [['Eп', Ep, '#ffb547'], ['Eк', Ek, '#72d4e8'], ['E', Ep + Ek, '#86e0a8']].forEach(([n, v, c], k) => {
        const y = 24 + k * 34;
        x.fillStyle = c; x.textAlign = 'left'; x.fillText(n, 12, y);
        x.fillStyle = '#1a2438'; x.fillRect(54, y - 10, 186, 20);
        x.fillStyle = c; x.fillRect(54, y - 10, 186 * clamp(v / Emax, 0, 1), 20);
        x.textAlign = 'right'; x.fillText(f(v, 2) + ' Дж', w - 10, y);
      });
      const tot = Ep + Ek, pk = tot > 1e-6 ? Math.round(Ek / tot * 100) : 0;
      x.font = `500 16px ${MONO}`; x.textAlign = 'left'; x.fillStyle = '#a9b4c9';
      x.fillText(tot > 1e-6 ? `кин. ${pk} % · пот. ${100 - pk} %${d.paused ? ' · стоп-кадр' : ''}` : 'груз висит: энергии колебаний нет', 12, h - 30);
      x.fillStyle = d.snapK ? '#86e0a8' : '#5d6573'; x.fillText(`Eк≥90% ${d.snapK ? '✓' : '—'}`, 12, h - 10);
      x.fillStyle = d.snapP ? '#86e0a8' : '#5d6573'; x.fillText(`Eп≥90% ${d.snapP ? '✓' : '—'}`, 160, h - 10);
      s.tex.needsUpdate = true;
    }
    let last = null;
    kit.onFrame(() => {
      const Lv = live(), th = Lv ? Lv.th : 0, om = Lv ? Lv.om : 0;
      arm.rotation.z = th;
      const v = l * om;
      ar.set(Math.abs(v) * 5 > 0.8 ? BR + Math.abs(v) * 5 : 0); ar.g.rotation.z = v >= 0 ? -PI / 2 : PI / 2;
      const key = th.toFixed(4) + om.toFixed(4); if (key === last) return; last = key;
      draw(m * G * l * (1 - Math.cos(th)), m * v * v / 2);
    });
  };

  // =====================================================================================
  // Урок 2: маятник с меняющейся длиной нити, линейка 2 м, секундомер, журнал замеров
  SC['waves-period'] = (kit, d) => {
    const { T, at, box, cyl, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const PX = 0, PY = 54, PZ = -12, KL = 22, r = 1.6 + d.mass * 4.8, LU = d.l * KL;

    K.stand(-28, PZ, PY + 3);
    at(box(42, 1.4, 1.4, C.STEEL), -7, PY + 1.8, PZ);
    K.boss(-28, PY + 1.8, PZ);
    at(box(2.6, 1.6, 2.6, IRON), PX, PY + 0.9, PZ);
    const axle = cyl(0.45, 3.6, C.BRASS, { edges: false }); axle.rotation.x = PI / 2; at(axle, PX, PY, PZ);
    // катушка, на которую наматывают нить
    const reel = cyl(1.4, 1.2, 0xd38b4a, { seg: 18 }); reel.rotation.x = PI / 2; at(reel, PX + 3.4, PY + 0.9, PZ + 1.4);

    const arm = new T.Group(); at(arm, PX, PY, PZ);
    const tl = Math.max(0.3, LU - r);
    at(cyl(0.14, tl, 0xf3eee0, { edges: false, hull: false, seg: 6 }), 0, -tl / 2, 0, arm);
    const ball = K.sphere(r, 0xd6dbe6); at(ball, 0, -LU, 0, arm); clickable(ball, 'mass');
    const mp = K.plate(Math.round(d.mass * 1000) + ' г', r * 1.25, r * 0.55, '#1b1610', '#d6dbe6'); at(mp, 0, -LU, r + 0.05, arm);

    // метровая линейка 2 м, висит на штанге
    const RX = 12;
    at(box(3.8, 44.6, 0.8, 0xf1e3c2), RX, PY - 22, PZ);
    const ruler = K.drawn(new T.PlaneGeometry(3.6, 44), 96, 1056, (x, W, H) => {
      x.fillStyle = '#f1e3c2'; x.fillRect(0, 0, W, H); x.fillStyle = '#1b1610'; x.strokeStyle = '#1b1610';
      x.font = `700 22px ${MONO}`; x.textAlign = 'right'; x.textBaseline = 'middle';
      for (let q = 0; q <= 40; q++) { const y = q / 40 * H, big = q % 5 === 0; x.lineWidth = big ? 4 : 2; x.beginPath(); x.moveTo(0, y); x.lineTo(big ? 34 : 18, y); x.stroke();
        if (q % 10 === 0 && q > 0 && q < 40) x.fillText(nf(q / 20), W - 6, y); }
      x.fillText('2 м', W - 6, H - 16); x.fillText('0', W - 6, 14);
    });
    at(ruler, RX, PY - 22, PZ + 0.42);
    // отметка длины нити
    const mk = Math.max(1, RX - 2 - (r + 1));
    at(box(mk, 0.45, 0.45, ORANGE, { edges: false }), RX - 2 - mk / 2, PY - LU, PZ + 0.6);
    at(cyl(0.9, 1.4, ORANGE, { r2: 0.01, seg: 3, edges: false }), RX - 2.2, PY - LU, PZ + 0.6).rotation.z = -PI / 2;

    // пульт длины нити
    const ctl = new T.Group(); at(ctl, -14, 0, 8);
    at(box(20, 5, 8, PANEL), 0, 2.5, 0, ctl);
    const lp = K.plate('нить', 6, 2.4, '#fff6e6', '#3b4a66'); at(lp, -5.6, 2.6, 4.02, ctl);
    K.button(ctl, 1.6, 2.5, 4.4, 'l −', 'l-', { w: 5 });
    K.button(ctl, 7.2, 2.5, 4.4, 'l +', 'l+', { w: 5 });

    // секундомер на подставке
    const sw = new T.Group(); at(sw, 30, 0, 20);
    at(box(18, 1.6, 10, IRON), 0, 0.8, 0, sw);
    at(box(3, 3.4, 3, IRON), 0, 3.2, -1, sw);
    const bd = new T.Group(); at(bd, 0, 12.6, -1, sw); bd.rotation.x = -0.14; clickable(bd, 'meas');
    const cs = cyl(9, 3.6, 0x2c3240, { seg: 40 }); cs.rotation.x = PI / 2; at(cs, 0, 0, 0, bd);
    const face = cyl(8, 0.4, 0xf3efe2, { seg: 40, edges: false }); face.rotation.x = PI / 2; at(face, 0, 0, 1.9, bd);
    const S = K.screen(12.4, 7, 300, 170); at(S.m, 0, 0.4, 2.14, bd);
    at(cyl(1.3, 2.4, C.STEEL, { edges: false }), 0, 10, 0, bd);
    at(cyl(1.9, 1.2, d.meas ? 0x3fae5a : RED), 0, 11.6, 0, bd);
    const ring = new T.Mesh(kit.keep(new T.TorusGeometry(1.4, 0.35, 6, 16)), K.own(C.STEEL)); at(ring, 0, 13, 0, bd);
    const sb = cyl(1, 2, C.STEEL, { edges: false }); sb.rotation.z = -0.8; at(sb, 6.6, 6.6, 0, bd);
    K.button(sw, 6.4, 3.3, 3.4, '×5', 'sp', { w: 4.6, h: 3, col: d.speed === 5 ? ORANGE : 0xe8ecf4, bg: d.speed === 5 ? '#ffb547' : '#e8ecf4' });

    // журнал замеров на столе
    const jr = new T.Group(); at(jr, -2, 0.2, 30); jr.rotation.x = -1.05;
    at(box(25, 13, 0.5, 0x9a6332), 0, 6.5, -0.3, jr);
    at(box(6, 1.4, 1.2, C.STEEL), 0, 12.4, 0.3, jr);
    K.link(0.45, 0x9a6332).set(v3(-2, 0, 21.6), v3(-2, 5.6, 25.4));
    const jt = K.drawn(new T.PlaneGeometry(23, 10.6), 460, 212, (x, W, H) => {
      x.fillStyle = '#f7f3ea'; x.fillRect(0, 0, W, H);
      x.strokeStyle = 'rgba(59,111,216,.35)'; x.lineWidth = 2; for (let k = 1; k < 6; k++) { x.beginPath(); x.moveTo(0, k * 38); x.lineTo(W, k * 38); x.stroke(); }
      x.fillStyle = '#5d6573'; x.font = `600 22px ${MONO}`; x.textBaseline = 'middle'; x.textAlign = 'left';
      x.fillText('журнал замеров', 14, 20);
      const rs = d.res || [];
      if (!rs.length) { x.fillText('пока пусто', 14, 66); }
      rs.slice().reverse().forEach(([ll, nu], k) => { const ok = Math.abs(nu - 1) < 0.01 || Math.abs(nu - 0.5) < 0.005; x.fillStyle = ok ? '#2e9e4f' : '#1b1610'; x.font = `600 26px ${MONO}`; x.fillText(`l ${f(ll, 2)} м → ν ${f(nu, 3)} Гц`, 14, 64 + k * 40); });
    });
    at(jt, 0, 6.1, 0.01, jr);

    const last = d.res && d.res.length ? d.res[d.res.length - 1] : null, hot = last && (Math.abs(last[1] - 1) < 0.01 || Math.abs(last[1] - 0.5) < 0.005);
    tag(v3(RX, PY + 4.5, PZ), 'Нить', 'l = ' + f(d.l, 2) + ' м');
    tag(v3(-9, PY - LU + 2, PZ), 'Груз', Math.round(d.mass * 1000) + ' г');
    tag(v3(30, 25, 19), 'Секундомер', d.meas ? 'считаем…' : last ? 'ν = ' + f(last[1], 3) + ' Гц' : '10 колебаний', !d.meas && hot);

    let lastKey = '';
    function drawWatch(Lv) {
      const M = Lv && Lv.meas, t = M ? M.t : last ? last[2] : 0;
      const key = d.meas ? f(t, 2) + (M ? M.n : '') : 'x'; if (key === lastKey) return; lastKey = key;
      const x = S.x, w = S.W, h = S.H;
      x.fillStyle = '#c9d6b4'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#1b1610'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = `700 60px ${MONO}`; x.fillText(f(t, 2), w / 2 - 14, 62);
      x.font = `700 26px ${MONO}`; x.fillText('с', w - 34, 72);
      x.font = `600 22px ${MONO}`;
      x.fillText(M ? `колебаний ${M.n} из 10` : last ? `ν = 10 / ${f(last[2], 2)}` : 'нажмите — пуск', w / 2, 126);
      x.fillText(M ? `×${d.speed}` : last ? `= ${f(last[1], 3)} Гц` : '10 колебаний', w / 2, 152);
      S.tex.needsUpdate = true;
    }
    kit.onFrame(() => { const Lv = live(); arm.rotation.z = Lv ? Lv.th : 0; drawWatch(Lv); });
  };

  // =====================================================================================
  // Урок 3: груз на пружине, точку подвеса двигает мотор с кулисой; шкала размаха, пульт, резонансная кривая
  const RZ = { m: 0.5, k: 12.6, a: 0.02, beta: 0.5 };
  const Ass = nu => { const w0 = Math.sqrt(RZ.k / RZ.m), w = TAU * nu; return w0 * w0 * RZ.a / Math.hypot(w0 * w0 - w * w, 2 * RZ.beta * w); };
  SC['waves-res'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const KM = 120, ra = RZ.a * KM, WY = 52, CZ = -5.6, MY = 18, SL = 20;

    K.stand(-24, -12, 57);
    at(box(30, 1.4, 1.4, C.STEEL), -10, WY + 5.4, -12);
    K.boss(-24, WY + 5.4, -12);
    // мотор под штангой, колесо с пальцем спереди
    at(box(3, 1.2, 3, IRON), 0, WY + 4.4, -12);
    at(box(10, 8, 7, PANEL), 0, WY, -11.5);
    for (let k = 0; k < 4; k++) at(box(0.4, 6, 0.3, 0x2c3240, { edges: false, shadow: false }), 5.05, WY, -14 + k * 1.6).rotation.y = PI / 2;
    const shaft = cyl(0.6, 1.4, C.STEEL, { edges: false }); shaft.rotation.x = PI / 2; at(shaft, 0, WY, -7.6);
    const wg = new T.Group(); at(wg, 0, WY, -7.2);
    const disk = cyl(4.4, 0.9, 0xd9dfe9, { seg: 32 }); disk.rotation.x = PI / 2; at(disk, 0, 0, 0, wg);
    for (let k = 0; k < 3; k++) { const h = cyl(0.8, 1, 0x5d6573, { edges: false, hull: false, seg: 12 }); h.rotation.x = PI / 2; at(h, Math.sin(k * TAU / 3 + 1) * 2.6, Math.cos(k * TAU / 3 + 1) * 2.6, 0.06, wg); }
    const pin = cyl(0.55, 2.4, ORANGE, { edges: false }); pin.rotation.x = PI / 2; at(pin, 0, -ra, 1.4, wg);
    // кулиса: рамка с прорезью, по которой ходит палец, и шток вниз
    const yk = new T.Group(); at(yk, 0, WY, CZ);
    for (const s of [-1, 1]) at(box(12, 0.5, 0.6, C.STEEL), 0, s * 0.8, 0, yk);
    for (const s of [-1, 1]) at(box(0.6, 2.1, 0.6, C.STEEL), s * 6, 0, 0, yk);
    at(cyl(0.45, 9.3, C.STEEL, { edges: false }), 0, -5.4, 0, yk);
    // направляющая штока, держится за мотор
    at(box(2.6, 1.8, 2.6, IRON), 0, WY - 6.5, CZ);
    at(box(1, 1, 3.2, IRON), 0, WY - 6.5, -8.4);
    at(box(1, 3.4, 1, IRON), 0, WY - 4.5, -9.5);

    // пружина: витки от верха (y = 0) вниз до −SL; при движении растягиваем по y
    const pts = [v3(0, 0, 0)], N = 300, turns = 9;
    for (let k = 0; k <= N; k++) { const a = k / N * turns * TAU; pts.push(v3(Math.sin(a) * 2, -1.4 - (SL - 2.8) * k / N, Math.cos(a) * 2)); }
    pts.push(v3(0, -SL, 0));
    const sp = new T.Group(); at(sp, 0, WY - 10, CZ);
    at(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 420, 0.26, 6), 0xc6ccd6, { hull: true, edges: false }), 0, 0, 0, sp);
    // груз 0,5 кг с крючком
    const ms = new T.Group(); at(ms, 0, MY, CZ);
    at(cyl(3.2, 8, 0xd8b04a, { seg: 32 }), 0, 0, 0, ms);
    for (const y of [-2, 2]) at(cyl(3.26, 0.35, 0xa8862e, { edges: false, hull: false, seg: 32 }), 0, y, 0, ms);
    at(cyl(0.3, 1.4, C.STEEL, { edges: false }), 0, 4.6, 0, ms);
    const pl = K.plate('0,5 кг', 4, 1.6, '#1b1610', '#d8b04a'); at(pl, 0, 0, 3.24, ms);

    // шкала размаха (см) на держателе от стойки
    at(box(15, 1, 1, C.STEEL), -16.5, MY + 13, -12);
    at(box(1, 1, 6.4, C.STEEL), -9, MY + 13, -9.2);
    at(box(6.4, 31, 0.6, 0xf1e3c2), -9, MY, CZ - 0.6);
    const sc = K.drawn(new T.PlaneGeometry(6, 30), 120, 600, (x, W, H) => {
      x.fillStyle = '#f1e3c2'; x.fillRect(0, 0, W, H); x.strokeStyle = '#1b1610'; x.fillStyle = '#1b1610';
      x.font = `700 22px ${MONO}`; x.textAlign = 'left'; x.textBaseline = 'middle';
      const py = cm => H / 2 - cm * 1.2 / 30 * H;
      for (let cm = -12; cm <= 12; cm++) { const big = cm % 5 === 0; x.lineWidth = big ? 4 : 2; x.beginPath(); x.moveTo(W, py(cm)); x.lineTo(W - (big ? 40 : 20), py(cm)); x.stroke(); if (big && cm) x.fillText(String(Math.abs(cm)), 6, py(cm)); }
      x.setLineDash([8, 8]); x.lineWidth = 3; x.beginPath(); x.moveTo(0, H / 2); x.lineTo(W, H / 2); x.stroke(); x.setLineDash([]);
      x.fillText('0', 6, H / 2 - 16); x.font = `600 18px ${MONO}`; x.fillText('см', 6, 18);
    });
    at(sc, -9, MY, CZ - 0.28);
    const env = [-1, 1].map(() => { const b = box(5.6, 0.5, 0.7, ORANGE, { edges: false }); at(b, -9, MY, CZ + 0.2); return b; });

    // пульт мотора
    const pu = new T.Group(); at(pu, -38, 0, 16);
    at(box(22, 9, 12, PANEL), 0, 4.5, 0, pu);
    const dsp = K.plate('ν ' + f(d.nu, 2) + ' Гц', 18, 3.6, '#86e0a8', '#0e1520'); at(dsp, 0, 6.5, 6.02, pu);
    K.button(pu, -6.5, 2.6, 6.4, 'ν −', 'nu-', { w: 5.4, h: 3 });
    K.button(pu, -0.4, 2.6, 6.4, 'ν +', 'nu+', { w: 5.4, h: 3 });
    K.button(pu, 6.4, 2.6, 6.4, '×4', 'sp', { w: 5.4, h: 3, col: d.speed === 4 ? ORANGE : 0xe8ecf4, bg: d.speed === 4 ? '#ffb547' : '#e8ecf4' });
    K.wire([v3(-38, 6, 10), v3(-36, 1, 4), v3(-26, 1, -3), v3(-22.4, 4, -10.6), v3(-22.4, WY + 3, -10.6), v3(-6, WY + 3.4, -10.6), v3(-5.2, WY, -10.6)], 0x2c3240, 0.45);

    // резонансная кривая на экране самописца
    const B = K.board(40, 20, 30, 17.6, 360, 230);
    K.button(B.g, -6.5, 2.2, 4.6, 'Записать', 'rec', { w: 12, col: RED, bg: '#e0473a', fg: '#ffffff' });
    K.button(B.g, 7.5, 2.2, 4.6, 'Очистить', 'clear', { w: 11 });

    tag(v3(0, WY + 9.5, -8), 'Мотор', 'ν = ' + f(d.nu, 2) + ' Гц' + (d.speed === 4 ? ' · ×4' : ''));
    tag(v3(-38, 10, 16), 'Пульт мотора', 'k = 12,6 Н/м · m = 0,5 кг');
    tag(v3(-9, MY + 17, CZ), 'Размах', d.set ? f(d.A, 1) + ' см' : 'раскачивается…', d.set);
    tag(v3(64, B.top - 5, 17), 'Резонансная кривая', `точек ${d.pts.length} из 4`, d.peak);

    const S = B.scr, X = nu => 46 + (nu - 0.2) / 1.4 * 296, Y = a => 192 - Math.min(a, 0.125) / 0.12 * 160;
    let tick = 0;
    function drawPlot(A) {
      const x = S.x, w = S.W, h = S.H;
      x.fillStyle = '#0e1520'; x.fillRect(0, 0, w, h);
      x.strokeStyle = '#5d6a86'; x.lineWidth = 2; x.beginPath(); x.moveTo(X(0.2), 26); x.lineTo(X(0.2), 192); x.lineTo(X(1.6), 192); x.stroke();
      x.fillStyle = '#8b96ad'; x.font = `500 15px ${MONO}`; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let k = 0; k <= 7; k++) { const nu = 0.2 + k * 0.2; x.beginPath(); x.moveTo(X(nu), 192); x.lineTo(X(nu), 198); x.stroke(); x.fillText(f(nu, 1), X(nu), 210); }
      x.textAlign = 'right'; for (let a = 0; a <= 0.12; a += 0.04) { x.beginPath(); x.moveTo(X(0.2) - 5, Y(a)); x.lineTo(X(0.2), Y(a)); x.stroke(); x.fillText(f(a * 100, 0), X(0.2) - 8, Y(a)); }
      x.textAlign = 'left'; x.fillText('см', 8, 14); x.textAlign = 'right'; x.fillText('ν мотора, Гц', w - 8, 14);
      if (d.done) { x.strokeStyle = 'rgba(134,224,168,.75)'; x.setLineDash([6, 6]); x.beginPath(); for (let nu = 0.2; nu <= 1.6001; nu += 0.01) { const px = X(nu), py = Y(Ass(nu)); nu === 0.2 ? x.moveTo(px, py) : x.lineTo(px, py); } x.stroke(); x.setLineDash([]); }
      x.strokeStyle = 'rgba(114,212,232,.5)'; x.setLineDash([3, 5]); x.beginPath(); x.moveTo(X(d.nu), 192); x.lineTo(X(d.nu), 26); x.stroke(); x.setLineDash([]);
      for (const [nu, a] of d.pts) { x.fillStyle = '#ffb547'; x.strokeStyle = '#04070d'; x.lineWidth = 2; x.beginPath(); x.arc(X(nu), Y(a), 7, 0, TAU); x.fill(); x.stroke(); }
      x.strokeStyle = '#72d4e8'; x.lineWidth = 3; x.beginPath(); x.arc(X(d.nu), Y(A), 8, 0, TAU); x.stroke();
      S.tex.needsUpdate = true;
    }
    kit.onFrame(() => {
      const Lv = live(), ph = Lv ? Lv.ph : 0, xm = Lv ? Lv.x : 0, A = Lv ? Lv.A : 0;
      const ys = -ra * Math.cos(ph);
      wg.rotation.z = ph;
      yk.position.y = WY + ys;
      const top = WY - 10 + ys, my = MY - xm * KM;
      sp.position.y = top; sp.scale.y = clamp((top - (my + 4)) / SL, 0.1, 3);
      ms.position.y = my;
      env[0].position.y = MY + A * KM; env[1].position.y = MY - A * KM; env.forEach(b => (b.visible = A > 0.002));
      if (!(tick++ % 3)) drawPlot(A);
    });
  };

  // =====================================================================================
  // Урок 4: шнур между вибратором и блоком с грузами; поперечная волна — бусины шнура, продольная — витки пружины
  SC['waves-cord'] = (kit, d) => {
    const { T, at, box, cyl, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const X0 = -46, KL = 16, Lm = d.L, CY = 13, CZ = -4, N = Lm * 10, A = 4.2, v = d.v, nu = d.nu, lam = v / nu, trans = d.mode === 'trans';
    const ampL = Math.min(12 / 72, 0.14 * lam) * KL;
    const disp = (xm, t) => { const tt = t - xm / v; return tt < 0 ? 0 : Math.sin(TAU * nu * tt); };

    // вибратор: корпус на основании, шток с зажимом шнура
    const vb = new T.Group(); at(vb, -54, 0, CZ);
    at(box(12, 1.6, 11, IRON), 0, 0.8, 0, vb);
    at(box(9, 15, 8, PANEL), 0, 9.1, 0, vb);
    at(box(9.2, 1.2, 8.2, 0x2c3240), 0, 16.2, 0, vb);
    at(box(0.4, 8, 3.2, 0x14181f, { edges: false }), 4.55, CY, 0, vb);
    const vp = K.plate('вибратор', 7.6, 2, '#fff6e6', '#3b4a66'); at(vp, 0, 5, 4.02, vb);
    const pin = new T.Group(); at(pin, -47.5, CY, CZ);
    const pr = cyl(0.6, 4.6, C.STEEL, { edges: false }); pr.rotation.z = PI / 2; at(pr, 0, 0, 0, pin);
    at(box(1.4, 2, 2, C.BRASS), 1.8, 0, 0, pin);

    // шнур / пружина
    const beads = [];
    if (trans) {
      const geo = kit.keep(new T.SphereGeometry(0.85, 12, 10)), geoR = kit.keep(new T.SphereGeometry(1.35, 16, 12));
      for (let i = 0; i <= N; i++) {
        const red = i === 20, m = new T.Mesh(red ? geoR : geo, kit.toon(red ? RED : CYAN)); m.castShadow = true;
        m.add(new T.Mesh(red ? geoR : geo, kit.hullMat)); at(m, X0 + i / 10 * KL, CY, CZ); beads.push(m);
      }
    } else {
      const geo = kit.keep(new T.TorusGeometry(2.4, 0.3, 6, 20)), geoR = kit.keep(new T.TorusGeometry(2.5, 0.5, 6, 20));
      for (let i = 0; i <= N; i++) {
        const red = i === 20, m = new T.Mesh(red ? geoR : geo, kit.toon(red ? RED : CYAN)); m.castShadow = true; m.rotation.y = PI / 2;
        m.add(new T.Mesh(red ? geoR : geo, kit.hullMat)); at(m, X0 + i / 10 * KL, CY, CZ); beads.push(m);
      }
    }
    // дальний конец: блок на штативе и подвес с грузами (больше грузов — шнур туже)
    K.stand(58, CZ - 2.8, CY + 1);
    const ax = cyl(0.4, 3, C.STEEL, { edges: false }); ax.rotation.x = PI / 2; at(ax, 58, CY - 1.8, CZ - 1.4);
    const pul = cyl(1.8, 1, IRON, { seg: 24 }); pul.rotation.x = PI / 2; at(pul, 58, CY - 1.8, CZ);
    const end = K.link(0.25, 0xf3eee0); const endB = v3(58, CY, CZ);
    const hang = new T.Group(); at(hang, 59.8, 0, CZ); clickable(hang, 'med');
    const nW = d.med === 'taut' ? 4 : 1, wy0 = 2.4;
    at(cyl(0.25, CY - 1.8 - wy0 - 0.4, 0xf3eee0, { edges: false, hull: false }), 0, (CY - 1.8 + wy0 + 0.4) / 2, 0, hang);
    at(cyl(2.2, 0.5, C.STEEL, { seg: 20 }), 0, wy0 - 0.4, 0, hang);
    for (let k = 0; k < nW; k++) at(cyl(2.2, 1.2, 0x8b93a1, { seg: 20 }), 0, wy0 + 0.6 + k * 1.3, 0, hang);
    at(cyl(0.35, nW * 1.3 + 1.2, C.STEEL, { edges: false }), 0, wy0 + (nW * 1.3) / 2, 0, hang);

    // рулетка вдоль шнура
    at(box(100, 0.7, 4.4, 0xf1e3c2), X0 + 48, 0.35, 9);
    const rl = K.drawn(new T.PlaneGeometry(98, 4.2), 2352, 100, (x, W, H) => {
      x.fillStyle = '#f2c94c'; x.fillRect(0, 0, W, H); x.strokeStyle = '#1b1610'; x.fillStyle = '#1b1610';
      const px = mm => (mm * KL + 1) / 98 * W;
      x.font = `700 40px ${MONO}`; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let k = 0; k <= Lm * 10; k++) { const big = k % 10 === 0, half = k % 5 === 0; x.lineWidth = big ? 5 : 3; x.beginPath(); x.moveTo(px(k / 10), 0); x.lineTo(px(k / 10), big ? 46 : half ? 32 : 18); x.stroke(); if (big) x.fillText(k / 10 + (k === Lm * 10 ? ' м' : ''), px(k / 10) + (k === Lm * 10 ? -40 : k ? 0 : 16), 74); }
      x.fillStyle = '#e0473a'; x.beginPath(); x.moveTo(px(2) - 16, H); x.lineTo(px(2) + 16, H); x.lineTo(px(2), H - 26); x.fill();
    });
    rl.rotation.x = -PI / 2; at(rl, X0 + 48, 0.72, 9);
    // флажок фронта волны
    const flag = new T.Group(); at(flag, X0, 0.7, 12.4);
    at(cyl(0.25, 9, 0x2c3240, { edges: false }), 0, 4.5, 0, flag);
    at(box(4, 2.6, 0.25, ORANGE), 2, 7.6, 0, flag);
    // скобка длины волны
    const by = trans ? CY + A + 4 : CY + 5.5;
    const br = new T.Group(); at(br, 0, by, CZ);
    const bar = box(1, 0.45, 0.45, ORANGE, { edges: false }); at(bar, 0, 0, 0, br);
    const bE = [-1, 1].map(() => { const e = box(0.45, 2.6, 0.45, ORANGE, { edges: false }); at(e, 0, 0, 0, br); return e; });

    // генератор вибратора
    const gn = new T.Group(); at(gn, -36, 0, 26);
    at(box(22, 10, 12, PANEL), 0, 5, 0, gn);
    const gd = K.plate('ν ' + nf(nu) + ' Гц · T ' + nf(1 / nu) + ' с', 19, 3.4, '#86e0a8', '#0e1520'); at(gd, 0, 7.6, 6.02, gn);
    K.button(gn, -7.4, 3, 6.4, 'ν −', 'nu-', { w: 5, h: 3 });
    K.button(gn, -1.8, 3, 6.4, 'ν +', 'nu+', { w: 5, h: 3 });
    K.button(gn, 6, 3, 6.4, trans ? 'попереч.' : 'продольн.', 'mode', { w: 8.4, h: 3, col: 0x3b6fd8, bg: '#3b6fd8', fg: '#ffffff' });
    K.wire([v3(-38, 6, 20), v3(-44, 1, 14), v3(-52, 1, 6), v3(-54, 1.6, 1.6)], 0x2c3240, 0.45);

    const hit = (d.hits || []).includes(d.med);
    tag(v3(-54, 20, CZ), 'Вибратор', 'ν = ' + nf(nu) + ' Гц · T = ' + nf(1 / nu) + ' с');
    tag(v3(58, CY + 3.5, CZ - 2.8), 'Шнур', (d.med === 'soft' ? 'мягкий' : 'тугой') + ' · v = ' + nf(v) + ' м/с', hit);
    const lp = v3(X0 + 48, by + 2, CZ);
    tag(lp, 'Длина волны', 'λ = ' + nf(lam) + ' м', Math.abs(lam - 1) < 1e-9);
    tag(v3(X0 + 32, 1.2, 10.6), 'Красная частица', 'качается на месте');

    kit.onFrame(() => {
      const Lv = live(), t = Lv && isFinite(Lv.wt) ? Lv.wt : 30;
      for (let i = 0; i <= N; i++) {
        const xm = i / 10, s = disp(xm, t);
        if (trans) beads[i].position.set(X0 + xm * KL, CY + s * A, CZ); else beads[i].position.set(X0 + xm * KL + s * ampL, CY, CZ);
      }
      const s0 = disp(0, t);
      if (trans) pin.position.set(-47.5, CY + s0 * A, CZ); else pin.position.set(-47.5 + s0 * ampL, CY, CZ);
      end.set(beads[N].position, endB);
      const front = v * t;
      flag.visible = front < Lm; flag.position.x = X0 + Math.min(front, Lm) * KL;
      // скобка между соседними горбами (сгущениями), как на схеме
      const off = trans ? 0.25 : 0; let xa = null;
      const n0 = Math.max(0, Math.floor(nu * t - off - Lm * nu / v) - 1);
      for (let n = n0; n < n0 + 60; n++) { const xx = v * (t - (off + n) / nu); if (xx < 0) break; if (xx + lam <= Math.min(front, Lm) + 1e-9) xa = xx; }
      if (xa !== null && xa + lam <= Lm) {
        const a = X0 + xa * KL, b = a + lam * KL;
        br.visible = true; bar.scale.x = b - a; bar.position.x = (a + b) / 2; bE[0].position.x = a; bE[1].position.x = b;
        lp.set((a + b) / 2, by + 1.6, CZ);
      } else { br.visible = false; lp.set(X0 + 48, by + 1.6, CZ); }
    });
  };

  // =====================================================================================
  // Урок 5: генератор → динамик → (звуковые волны) → микрофон → осциллограф; макет «эхо в горах» с человеком и скалой
  SC['waves-sound'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit;
    const K = tools(kit);
    const nu = d.nu, lam = d.lam, vol = d.vol / 100;
    const audible = nu >= 20 && nu <= 20000;
    const range = nu < 20 ? 'инфразвук — не слышим' : nu > 20000 ? 'ультразвук — не слышим' : 'слышим · тон ' + (nu < 250 ? 'низкий' : nu <= 2000 ? 'средний' : 'высокий');

    // ---- макет местности ----
    const BZ = -28, manX = -30, KD = 0.28, cX = manX + 4 + d.d * KD;
    at(box(100, 1.4, 20, 0x7aa35a), 14, 0.7, BZ);
    at(box(100.2, 0.5, 20.2, 0x5f8446, { edges: false }), 14, 0.25, BZ);
    for (let k = 0; k < 7; k++) at(cyl(0.9, 1.2, 0x5f8446, { r2: 0.05, seg: 5, edges: false }), -20 + k * 12 + (k % 2) * 5, 2, BZ - 6 + (k % 3) * 5);
    // рулетка от человека до скалы
    at(box(Math.max(1, cX - 2 - manX), 0.2, 1.4, 0xf2c94c), (manX + cX - 2) / 2, 1.5, BZ + 7.4);
    // человек: нажмите — хлопок
    const man = new T.Group(); at(man, manX, 1.4, BZ); man.scale.setScalar(1.35); clickable(man, 'clap');
    for (const s of [-1, 1]) at(cyl(0.45, 3.6, 0x2c3240, { edges: false }), 0, 1.8, s * 0.6, man);
    at(cyl(1.05, 4, 0x3b6fd8), 0, 5.6, 0, man);
    at(K.sphere(1.15, 0xf0c8a0), 0, 8.8, 0, man);
    for (const s of [-1, 1]) { const a = cyl(0.35, 3, 0x3b6fd8, { edges: false }); a.rotation.z = -1.2; a.rotation.x = s * 0.3; at(a, 1.3, 6.8, s * 0.55, man); }
    at(K.sphere(0.5, 0xf0c8a0, { hull: false }), 2.7, 7.4, 0, man);
    const hb = new T.Mesh(kit.keep(new T.BoxGeometry(6, 11, 6)), K.basic(0, { transparent: true, opacity: 0, depthWrite: false })); at(hb, 0, 5.5, 0, man);
    // скала
    const cl = new T.Group(); at(cl, cX, 1.4, BZ);
    at(box(12, 14, 14, 0x8a8f99), 4, 7, 0, cl);
    const c2 = box(9, 7, 11, 0x9aa0aa); c2.rotation.y = 0.2; at(c2, 4.5, 17.2, -1, cl);
    const c3 = box(5.5, 3.6, 7, 0x7d838d); c3.rotation.y = -0.3; at(c3, 3.6, 22.4, -1.5, cl);
    for (const [x, y, z] of [[-2.1, 4, 3], [-2.1, 10, -2]]) at(box(0.4, 3, 4, 0x6c727c, { edges: false }), x, y, z, cl);
    // фронт звука: дуги идут к скале (оранжевые) и обратно (сиреневые)
    const arcs = [1.6, 2.8, 4].map(r => { const m = new T.Mesh(kit.keep(new T.TorusGeometry(r, 0.24, 6, 24, PI)), K.basic(ORANGE, { transparent: true, opacity: 0.9, depthWrite: false })); m.renderOrder = 3; at(m, manX, 8, BZ); return m; });
    const arcOut = new T.Color(ORANGE), arcBack = new T.Color(0xb48cff);
    // табло времени эха
    const tm = new T.Group(); at(tm, manX - 1, 1.4, BZ - 7);
    at(box(11, 4.8, 3, IRON), 0, 2.4, 0, tm);
    const TS = K.screen(9.8, 3.8, 260, 100); at(TS.m, 0, 2.4, 1.52, tm);
    // кнопки расстояния до скалы
    const dc = new T.Group(); at(dc, 14, 0, -13.5);
    at(box(17, 4.4, 5, PANEL), 0, 2.2, 0, dc);
    const dl = K.plate('скала', 5, 2, '#fff6e6', '#3b4a66'); at(dl, 0, 2.3, 2.52, dc);
    K.button(dc, -5.6, 2.2, 2.9, '◄', 'd-', { w: 4.4, h: 3.2 });
    K.button(dc, 5.6, 2.2, 2.9, '►', 'd+', { w: 4.4, h: 3.2 });

    // ---- генератор звука ----
    const gn = new T.Group(); at(gn, -44, 0, 14);
    at(box(22, 11, 12, PANEL), 0, 5.5, 0, gn);
    const gd = K.plate(d.nuTxt + ' Гц', 13, 4, '#86e0a8', '#0e1520'); at(gd, -3.4, 8, 6.02, gn);
    const kn = new T.Group(); at(kn, 7, 8, 6.2, gn);
    const kb = cyl(2.2, 1.4, 0xd9dfe9, { seg: 22 }); kb.rotation.x = PI / 2; at(kb, 0, 0, 0.5, kn);
    at(box(0.5, 2, 0.4, RED, { edges: false }), 0, 1.2, 1.3, kn);
    kn.rotation.z = 2.3 - 4.6 * vol;
    K.button(gn, -7.4, 2.8, 6.4, 'ν −', 'f-', { w: 5, h: 3 });
    K.button(gn, -1.8, 2.8, 6.4, 'ν +', 'f+', { w: 5, h: 3 });
    K.button(gn, 5.6, 2.8, 6.4, '▶ тон', 'play', { w: 7.6, h: 3, col: 0x3fae5a, bg: '#3fae5a', fg: '#ffffff' });

    // ---- динамик (смотрит на микрофон, +x) ----
    const spk = new T.Group(); at(spk, -14, 0, 12);
    at(box(8, 15, 9, 0x9a6332), 0, 7.5, 0, spk);
    at(box(0.4, 14, 8, 0x2c2622, { edges: false }), 4.05, 7.5, 0, spk);
    const sur = new T.Mesh(kit.keep(new T.TorusGeometry(3.5, 0.45, 8, 28)), K.own(0x3a3430)); sur.rotation.y = PI / 2; at(sur, 4.2, 9, 0, spk);
    const cone = new T.Group(); at(cone, 3.4, 9, 0, spk);
    const cg = kit.mesh(new T.CylinderGeometry(3.2, 1.1, 1.8, 28, 1, true), 0, { mat: K.own(0x4a4440, { side: T.DoubleSide }), edges: false }); cg.rotation.z = -PI / 2; at(cg, 0, 0, 0, cone);
    at(K.sphere(1.1, 0x5a524c, { hull: false }), -0.4, 0, 0, cone);
    const tw = cyl(1.1, 0.6, 0x3a3430); tw.rotation.z = PI / 2; at(tw, 4.3, 3.2, 0, spk);
    K.wire([v3(-38, 6, 8.2), v3(-30, 1, 6), v3(-20, 1, 7), v3(-18, 4, 9)], 0x2c3240, 0.45);

    // ---- волны в воздухе, линейка и скобка λ ----
    const XS = -9, SPAN = 31, KS = 20, sp = clamp(lam * KS, 1.3, 400), NR = Math.min(24, Math.floor(SPAN / sp) + 2);
    const rings = [];
    for (let k = 0; k < NR; k++) { const m = new T.Mesh(kit.keep(new T.TorusGeometry(3.4, 0.22, 6, 32)), K.basic(ORANGE, { transparent: true, opacity: 0, depthWrite: false })); m.rotation.y = PI / 2; m.renderOrder = 3; at(m, XS, 9, 12); rings.push(m); }
    at(box(SPAN + 1, 0.6, 3.2, 0xf1e3c2), XS + SPAN / 2, 0.3, 19.5);
    const rs = K.drawn(new T.PlaneGeometry(SPAN + 1, 3), 640, 62, (x, W, H) => {
      x.fillStyle = '#f1e3c2'; x.fillRect(0, 0, W, H); x.strokeStyle = '#1b1610'; x.fillStyle = '#1b1610';
      const px = mm => (mm * KS + 0.5) / (SPAN + 1) * W; x.font = `700 20px ${MONO}`; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let k = 0; k <= 15; k++) { const big = k % 5 === 0; x.lineWidth = big ? 3 : 2; x.beginPath(); x.moveTo(px(k / 10), 0); x.lineTo(px(k / 10), big ? 26 : 14); x.stroke(); if (big) x.fillText(k ? nf(k / 10) + (k === 15 ? ' м' : '') : '0', px(k / 10) + (k ? (k === 15 ? -16 : 0) : 8), 44); }
    });
    rs.rotation.x = -PI / 2; at(rs, XS + SPAN / 2, 0.62, 19.5);
    const bl = Math.min(lam * KS, SPAN), fits = lam * KS <= SPAN;
    if (bl >= 0.3) {
      at(box(bl, 0.4, 0.4, ORANGE, { edges: false }), XS + bl / 2, 2.4, 18.6);
      at(box(0.4, 2, 0.4, ORANGE, { edges: false }), XS, 2.4, 18.6);
      if (fits) at(box(0.4, 2, 0.4, ORANGE, { edges: false }), XS + bl, 2.4, 18.6);
    }

    // ---- микрофон и осциллограф ----
    const mic = new T.Group(); at(mic, 24, 0, 12);
    at(cyl(3.2, 0.9, IRON), 0, 0.45, 0, mic);
    at(cyl(0.4, 8, C.STEEL, { edges: false }), 0, 4.8, 0, mic);
    const cap = mesh(new T.CapsuleGeometry(1.3, 2.6, 6, 16), 0x3a3f4c, { hull: true, edges: false }); cap.rotation.z = PI / 2; at(cap, -0.6, 9, 0, mic);
    for (let k = 0; k < 3; k++) { const r = new T.Mesh(kit.keep(new T.TorusGeometry(1.36, 0.1, 4, 20)), K.basic(0x8b93a1)); r.rotation.y = PI / 2; at(r, -2.2 + k * 0.8, 9, 0, mic); }
    const sc = new T.Group(); at(sc, 52, 0, 22);
    for (const [x, z] of [[-10, -5], [10, -5], [-10, 5], [10, 5]]) at(box(2.4, 1, 2.4, 0x2c3240), x, 0.5, z, sc);
    at(box(25, 15, 13, 0x56657e), 0, 8.5, 0, sc);
    at(box(18.6, 12, 0.6, 0x1b1f28), -2.4, 8.8, 6.6, sc);
    const OS = K.screen(17.4, 10.8, 300, 186); at(OS.m, -2.4, 8.8, 6.95, sc);
    for (const y of [12, 6.4]) { const k = cyl(1.4, 1.2, 0xd9dfe9, { seg: 16 }); k.rotation.x = PI / 2; at(k, 9.6, y, 6.8, sc); }
    K.wire([v3(24, 1, 15.6), v3(30, 1, 20), v3(38, 1, 26), v3(41, 4, 28)], 0x2c3240, 0.45);

    const tE = 2 * d.d / 340;
    tag(v3(-44, 13, 14), 'Генератор', d.nuTxt + ' Гц · ' + d.vol + ' %', Math.abs(lam - 0.5) < 1e-6);
    tag(v3(-14, 17.5, 12), 'Динамик', range, audible && vol > 0);
    tag(v3(XS + Math.max(bl, 6) / 2 + 4, 1, 23), 'Длина волны', 'λ = ' + nf(Math.round(lam * 1000) / 1000) + ' м' + (fits ? '' : ' — длиннее линейки'), Math.abs(lam - 0.5) < 1e-6);
    tag(v3(cX + 4, 26.5, BZ), 'Скала', 's = ' + d.d + ' м', d.d === 170);
    tag(v3(manX - 1, 8, BZ - 7), 'Эхо', d.pulse ? 'звук летит…' : d.echoT !== null ? 'через ' + f(d.echoT, 2) + ' с' : 'нажмите на человека', d.echo && d.d === 170 && !d.pulse);

    let tsKey = '', tick = 0;
    function drawTimer(pt) {
      const txt = pt !== null ? 't = ' + f(Math.min(pt, tE), 2) + ' с' : d.echoT !== null ? 'эхо ' + f(d.echoT, 2) + ' с' : '0,00 с';
      if (txt === tsKey) return; tsKey = txt;
      const x = TS.x; x.fillStyle = '#0e1520'; x.fillRect(0, 0, TS.W, TS.H);
      x.fillStyle = pt !== null ? '#ffb547' : d.echo && d.d === 170 ? '#86e0a8' : '#c3a8ff'; x.font = `700 44px ${MONO}`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(txt, TS.W / 2, TS.H / 2 + 2); TS.tex.needsUpdate = true;
    }
    function drawScope(t) {
      const x = OS.x, w = OS.W, h = OS.H, cy = h / 2 + 6;
      x.fillStyle = '#06261a'; x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(140,255,190,.13)'; x.lineWidth = 1;
      for (let i = 1; i < 10; i++) { x.beginPath(); x.moveTo(w * i / 10, 0); x.lineTo(w * i / 10, h); x.stroke(); }
      for (let j = 1; j < 6; j++) { x.beginPath(); x.moveTo(0, h * j / 6); x.lineTo(w, h * j / 6); x.stroke(); }
      x.strokeStyle = '#86e0a8'; x.lineWidth = 3.2; x.shadowColor = '#86e0a8'; x.shadowBlur = 8; x.beginPath();
      for (let i = 0; i <= 200; i++) { const px = i / 200 * w, py = cy - vol * 58 * Math.sin(TAU * 3 * i / 200 - t); i ? x.lineTo(px, py) : x.moveTo(px, py); }
      x.stroke(); x.shadowBlur = 0;
      x.fillStyle = 'rgba(200,255,220,.85)'; x.font = `600 17px ${MONO}`; x.textAlign = 'left'; x.textBaseline = 'top';
      x.fillText('ν = ' + d.nuTxt + ' Гц · 3 периода', 8, 6);
      OS.tex.needsUpdate = true;
    }
    kit.onFrame((dt, t) => {
      const Lv = live(), pt = Lv && Lv.pt !== null && Lv.pt !== undefined ? Lv.pt : null, tt = kit.reduce ? 0.6 : t;
      // диффузор
      cone.position.x = 3.4 + (kit.reduce ? 0 : 0.55 * vol * Math.sin(TAU * Math.min(nu, 8) * tt));
      // сгущения воздуха: кольца бегут от динамика, расстояние между ними — λ (в масштабе линейки)
      rings.forEach((m, k) => {
        const p = ((tt * 0.6 + k) * sp) % (NR * sp), xx = XS + p;
        m.position.x = xx; m.material.opacity = xx > XS + SPAN ? 0 : vol * 0.85 * (1 - 0.6 * p / SPAN);
      });
      // хлопок и эхо
      if (pt === null) arcs.forEach(a => (a.visible = false));
      else {
        const way = 340 * pt, out = way <= d.d, dist = out ? way : 2 * d.d - way, x0 = manX + 2.5, x1 = cX - 2.2;
        const xx = x0 + clamp(dist / d.d, 0, 1) * (x1 - x0);
        arcs.forEach((a, k) => { a.visible = true; a.position.x = xx; a.rotation.z = out ? -PI / 2 : PI / 2; a.material.color.copy(out ? arcOut : arcBack); a.material.opacity = 0.95 - k * 0.22; });
      }
      drawTimer(pt);
      if (!(tick++ % 2)) drawScope(kit.reduce ? 0 : tt * 2.4);
    });
  };
})();
