// «Как в жизни» для темы «Электромагнитная индукция» (/labs/phys-induction/).
// Сцены: опыт Фарадея (катушка, магнит, гальванометр), генератор (рамка между полюсами, ручка, кольца и щётки, лампа),
// трансформатор (сердечник из пластин, две обмотки, источник, вольтметры, лампа), электромагнитные волны
// (генератор с передающим диполем и приёмный диполь с лампочкой). Описание — window.LUCH_REAL(),
// то, что меняется каждый кадр (положение магнита, угол рамки, фаза), берём из window.LUCH_REAL.live().
(() => {
  const SC = (window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {});
  const live = () => { try { const f = window.LUCH_REAL && window.LUCH_REAL.live; return f ? f() : null; } catch (e) { return null; } };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const CU = 0xd9894a, CU2 = 0xa85f2c, RED = 0xe0473a, BLUE = 0x3b7fd8, AMBER = 0xffb547, CYAN = 0x72d4e8;
  const num = (x, n = 1) => { let s = (Math.round(x * 10 ** n) / 10 ** n).toFixed(n); if (/^-0(\.0+)?$/.test(s)) s = s.slice(1); return s.replace('.', ',').replace('-', '−'); };
  const sgn = x => (x > 0.05 ? '+' : '') + num(x, 1);

  // бегущие огоньки по проводу, скорость и направление задаём сами (для переменного тока — туда-обратно)
  function flow(kit, curve, r = 0.95) {
    const { T, keep } = kit;
    const c = document.createElement('canvas'); c.width = 64; c.height = 8; const x = c.getContext('2d');
    x.fillStyle = '#ffd166'; x.fillRect(8, 0, 16, 8);
    const tex = keep(new T.CanvasTexture(c)); tex.wrapS = T.RepeatWrapping; tex.colorSpace = T.SRGBColorSpace;
    tex.repeat.set(Math.max(1, curve.getLength() / 12), 1);
    const mat = keep(new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
    const m = new T.Mesh(keep(new T.TubeGeometry(curve, Math.max(30, Math.round(curve.getLength() * 1.4)), r * 1.08, 10)), mat);
    m.renderOrder = 2; kit.root.add(m);
    return { set(v, dt) { mat.opacity = clamp(Math.abs(v) * 2.5, 0, 1); if (!kit.reduce) tex.offset.x -= v * dt; } };
  }
  // подпись, у которой можно менять значение на лету
  function liveTag(kit, p, name, value, hot) {
    kit.tag(p, name, value, hot);
    const all = document.querySelectorAll('.rl-lbl'), el = all[all.length - 1];
    let last = value;
    return { p, set(v) { if (v === last || !el) return; last = v; const i = el.querySelector('i'); if (i) i.textContent = v; } };
  }
  // шкала с нулём посередине (гальванометр, вольтметр переменного тока)
  function zeroDial(kit, letter, lim, unit) {
    const { T, keep } = kit;
    const c = document.createElement('canvas'); c.width = 256; c.height = 150; const x = c.getContext('2d');
    x.fillStyle = '#f7f3ea'; x.fillRect(0, 0, 256, 150);
    x.strokeStyle = '#1b1610'; x.lineWidth = 6; x.strokeRect(3, 3, 250, 144);
    const cx = 128, cy = 138, r = 104;
    x.lineWidth = 3; x.beginPath(); x.arc(cx, cy, r, -Math.PI / 2 - Math.PI / 3, -Math.PI / 2 + Math.PI / 3); x.stroke();
    for (let k = -10; k <= 10; k++) {
      const a = -Math.PI / 2 + k * 6 * Math.PI / 180, l = k % 5 ? 10 : 20;
      x.strokeStyle = k === 0 ? '#c0392b' : '#1b1610'; x.lineWidth = k % 5 ? 2 : 3.5;
      x.beginPath(); x.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); x.lineTo(cx + Math.cos(a) * (r - l), cy + Math.sin(a) * (r - l)); x.stroke();
    }
    x.fillStyle = '#1b1610'; x.textAlign = 'center'; x.font = '600 17px "IBM Plex Mono", monospace';
    const lab = [['−' + lim, -10], ['0', 0], ['+' + lim, 10]];
    for (const [t, k] of lab) { const a = -Math.PI / 2 + k * 6 * Math.PI / 180; x.fillText(t, cx + Math.cos(a) * (r + 2) * 0.78, cy + Math.sin(a) * (r + 2) * 0.78 + 4); }
    x.font = '700 34px "Golos Text", sans-serif'; x.textAlign = 'left'; x.fillText(letter, 16, 136);
    if (unit) { x.font = '500 15px "Golos Text", sans-serif'; x.textAlign = 'right'; x.fillText(unit, 240, 136); }
    const t = keep(new T.CanvasTexture(c)); t.colorSpace = T.SRGBColorSpace; return t;
  }
  // стрелочный прибор с нулём посередине: корпус, шкала, стрелка на оси, клеммы сверху
  function zeroMeter(kit, o) {
    const { T, at, box, cyl, keep } = kit;
    const g = new T.Group(), w = o.w || 28, h = o.h || 19, dp = 10;
    at(box(w + 3, 2, dp + 3, 0x2c3240), 0, 1, 0, g);
    at(box(w, h, dp, o.body || 0xe8ecf4), 0, 2 + h / 2, 0, g);
    const fw = w - 3.6, fh = fw * 150 / 256;
    const face = new T.Mesh(keep(new T.PlaneGeometry(fw, fh)), new T.MeshBasicMaterial({ map: zeroDial(kit, o.letter, o.lim, o.unit) }));
    const fy = 2 + h - 1.6 - fh / 2; at(face, 0, fy, dp / 2 + 0.06, g);
    // стрелка
    const s = fw / 256, piv = new T.Group(); at(piv, 0, fy - fh / 2 + 12 * s, dp / 2 + 0.25, g);
    const nl = 96 * s;
    const nd = new T.Mesh(keep(new T.BoxGeometry(0.42, nl, 0.12)), new T.MeshBasicMaterial({ color: 0xc0392b })); at(nd, 0, nl / 2, 0, piv);
    at(new T.Mesh(keep(new T.CylinderGeometry(1.1, 1.1, 0.3, 16)), new T.MeshBasicMaterial({ color: 0x1b1610 })), 0, 0, 0.1, piv).rotation.x = Math.PI / 2;
    // стекло-рамка
    at(box(w - 1.2, 1, 1, 0x9aa3b2, { edges: false }), 0, 2 + h - 0.6, dp / 2 + 0.3, g);
    const tA = new T.Vector3(-w / 2 + 4, 2 + h + 2.2, -1.5), tB = new T.Vector3(w / 2 - 4, 2 + h + 2.2, -1.5);
    at(cyl(1.2, 2.2, RED), tA.x, 2 + h + 1.1, tA.z, g); at(cyl(1.2, 2.2, 0x26324a), tB.x, 2 + h + 1.1, tB.z, g);
    at(cyl(1.7, 0.6, 0xc6ccd6, { seg: 6 }), tA.x, 2 + h + 0.3, tA.z, g); at(cyl(1.7, 0.6, 0xc6ccd6, { seg: 6 }), tB.x, 2 + h + 0.3, tB.z, g);
    return { g, piv, tA, tB, top: 2 + h + 2.2 };
  }
  const world = (g, p) => { g.updateMatrixWorld(true); return p.clone().applyMatrix4(g.matrixWorld); };
  function letterTex(kit, t, bg) { return kit.textTex(t, '#1b1610', bg, 64, 64); }

  // =============================== Опыт Фарадея ===============================
  SC['ind-faraday'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, clickable, C, cable, post, keep, toon } = kit;
    const K = 0.243, CX = 18, CZ = -6, L = 34, x0 = CX - L / 2, x1 = CX + L / 2, AY = 12.2, RI = 6.6;
    const mxTo = mx => CX + (mx - 330) * K;
    // катушка на подставке
    const cg = new T.Group(); at(cg, 0, 0, 0); clickable(cg, 'turns');
    at(box(L + 4, 1.2, 28, C.WOOD2), CX, 0.6, -4, cg);
    const tube = mesh(new T.CylinderGeometry(RI, RI, L + 1, 36, 1, true), 0, { mat: toon(0xe3c99a, { side: T.DoubleSide }), edges: false });
    tube.rotation.z = Math.PI / 2; at(tube, CX, AY, CZ, cg);
    const layer = mesh(new T.CylinderGeometry(7.9, 7.9, L - 2.4, 40, 1, true), 0, { mat: toon(CU2, { side: T.DoubleSide }), edges: false });
    layer.rotation.z = Math.PI / 2; at(layer, CX, AY, CZ, cg);
    const prof = [[RI, -0.7], [11, -0.7], [11, 0.7], [RI, 0.7], [RI, -0.7]].map(([r, y]) => new T.Vector2(r, y));
    for (const fx of [x0 + 0.7, x1 - 0.7]) { const fl = mesh(new T.LatheGeometry(prof, 44), 0x3a3f4c, { hull: false }); fl.rotation.z = Math.PI / 2; at(fl, fx, AY, CZ, cg); }
    // витки: медный провод спиралью, чем больше N — тем гуще
    const nt = d.N <= 100 ? 9 : d.N <= 200 ? 14 : 22, pts = [], xa = x0 + 1.9, xb = x1 - 1.9, M = nt * 20;
    for (let k = 0; k <= M; k++) { const a = k / M * nt * Math.PI * 2; pts.push(v3(xa + (xb - xa) * k / M, AY + Math.sin(a) * 8.2, CZ + Math.cos(a) * 8.2)); }
    at(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), M * 2, d.N > 200 ? 0.5 : 0.6, 8), CU, { edges: false, hull: true }), 0, 0, 0, cg);
    // выводы катушки к клеммам на подставке
    const pA = post(cg, CX - 9, 7.5, 1.2), pB = post(cg, CX + 9, 7.5, 1.2);
    cable(v3(xa, AY, CZ + 8.2), pA, CU, 0, { r: 0.4, lift: 0.5 });
    cable(v3(xb, AY, CZ + 8.2), pB, CU, 0, { r: 0.4, lift: 0.5 });
    // направляющая, по которой ездит магнит
    at(box(62, 6, 6, C.WOOD), -31, 3, CZ);
    at(box(2, 3, 6, C.WOOD2), -61, 7.5, CZ);
    // полосовой магнит
    const mg = new T.Group(); at(mg, mxTo(110), 0, CZ); clickable(mg, 'mag');
    const nR = d.pol > 0, cR = nR ? RED : BLUE, cL = nR ? BLUE : RED;
    at(box(16, 5, 4.2, cL), -8, 8.5, 0, mg); at(box(16, 5, 4.2, cR), 8, 8.5, 0, mg);
    for (const [xx, isN] of [[-12.5, !nR], [12.5, nR]]) {
      const tx = keep(letterTex(kit, isN ? 'N' : 'S', isN ? '#e0473a' : '#3b7fd8'));
      const top = new T.Mesh(keep(new T.PlaneGeometry(3.6, 3.6)), new T.MeshBasicMaterial({ map: tx })); top.rotation.x = -Math.PI / 2; at(top, xx, 11.03, 0, mg);
      const fr = new T.Mesh(keep(new T.PlaneGeometry(3.6, 3.6)), new T.MeshBasicMaterial({ map: tx })); at(fr, xx, 8.5, 2.13, mg);
    }
    // гальванометр с нулём посередине
    const gm = zeroMeter(kit, { letter: 'G', lim: 10, unit: 'дел.' }); at(gm.g, -10, 0, 30);
    const gA = world(gm.g, gm.tA), gB = world(gm.g, gm.tB);
    const w1 = flow(kit, cable(pA, gA, C.WIRE.plus, 0, { lift: 4 }));
    const w2 = flow(kit, cable(gB, pB, C.WIRE.minus, 0, { lift: 4 }));
    // полюс, который появляется у катушки (правило Ленца)
    const pole = {};
    for (const k of ['N', 'S']) {
      const sp = new T.Sprite(new T.SpriteMaterial({ map: keep(letterTex(kit, k, k === 'N' ? '#e0473a' : '#3b7fd8')), depthTest: false }));
      sp.scale.setScalar(4.2); sp.visible = false; sp.renderOrder = 5; at(sp, x0 - 2.5, AY + 13, CZ); pole[k] = sp;
    }
    const magTag = liveTag(kit, v3(mxTo(110) - 6, 14, CZ), 'Магнит', 'к катушке ' + (nR ? 'N' : 'S'));
    kit.tag(v3(CX + 10, 25, CZ), 'Катушка', d.N + ' витков');
    const gTag = liveTag(kit, v3(-10, 25, 30), 'Гальванометр', '0 дел.', false);
    kit.onFrame(dt => {
      const s = live(); if (!s) return;
      const x = mxTo(s.mx); mg.position.x = x; magTag.p.x = x - 6;
      gm.piv.rotation.z = -clamp(s.nd, -11, 11) * 6 * Math.PI / 180;
      w1.set(s.I * 0.35, dt); w2.set(s.I * 0.35, dt);
      const big = Math.abs(s.I) > 0.5;
      pole.N.visible = big && s.I > 0; pole.S.visible = big && s.I < 0;
      gTag.set(sgn(Math.round(s.nd * 10) / 10) + ' дел.');
    });
  };

  // =============================== Генератор ===============================
  SC['ind-generator'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, clickable, C, cable, keep, bulb, placeOn } = kit;
    // весь генератор повёрнут так, чтобы линия «N → S» шла поперёк взгляда: рамка видна между полюсами
    const G = new T.Group(); at(G, -4, 0, -6); G.rotation.y = 0.5;
    const W = p => world(G, p);
    at(box(62, 2.4, 30, C.WOOD2), 0, 1.2, 0, G);
    const Y0 = 2.4, FY0 = 10, FY1 = 27, HW = 11.5;
    // полюса магнита и ярмо
    at(box(7, 26, 12, RED), -19.5, Y0 + 13, 0, G); at(box(7, 26, 12, BLUE), 19.5, Y0 + 13, 0, G);
    at(box(46, 5, 5, 0x5d6a86), 0, Y0 + 2.5, -9, G);
    at(box(7, 5, 3.5, 0x5d6a86), -19.5, Y0 + 2.5, -6.2, G); at(box(7, 5, 3.5, 0x5d6a86), 19.5, Y0 + 2.5, -6.2, G);
    for (const [xx, k, col] of [[-19.5, 'N', '#e0473a'], [19.5, 'S', '#3b7fd8']]) {
      const tx = keep(letterTex(kit, k, col));
      const fr = new T.Mesh(keep(new T.PlaneGeometry(5, 5)), new T.MeshBasicMaterial({ map: tx })); at(fr, xx, Y0 + 19, 6.06, G);
      const tp = new T.Mesh(keep(new T.PlaneGeometry(5, 5)), new T.MeshBasicMaterial({ map: tx })); tp.rotation.x = -Math.PI / 2; at(tp, xx, Y0 + 26.03, 2.5, G);
    }
    // латунный мост с верхним подшипником
    at(box(46, 1.8, 3, C.BRASS), 0, Y0 + 26.9, -4, G);
    at(box(3.6, 1.8, 4.4, C.BRASS), 0, Y0 + 26.9, -1.2, G);
    at(cyl(1.7, 2.2, C.BRASS), 0, Y0 + 26.9, 0, G);
    // нижний подшипник
    at(cyl(2.2, 1.2, C.DARK), 0, Y0 + 0.6, 0, G);
    // вращающаяся часть: ось, рамка, кольца, ручка
    const rot = new T.Group(); at(rot, 0, 0, 0, G); clickable(rot, 'turns');
    at(cyl(0.7, 31, C.STEEL, { edges: false }), 0, Y0 + 15.5, 0, rot);
    const t = d.N <= 10 ? 1.1 : d.N <= 20 ? 1.5 : d.N <= 50 ? 2 : 2.6;
    at(box(2 * HW + t, t, t, CU), 0, FY1, 0, rot); at(box(2 * HW + t, t, t, CU), 0, FY0, 0, rot);
    at(box(t, FY1 - FY0, t, CU), -HW, (FY0 + FY1) / 2, 0, rot); at(box(t, FY1 - FY0, t, CU), HW, (FY0 + FY1) / 2, 0, rot);
    // бандажи из изоленты — рамка намотана из многих витков
    for (const [xx, yy, w, h] of [[-HW, FY0 + 4, t + 0.3, 1.2], [HW, FY1 - 4, t + 0.3, 1.2], [-6, FY1, 1.2, t + 0.3], [6, FY0, 1.2, t + 0.3], [-HW, FY1 - 4, t + 0.3, 1.2], [HW, FY0 + 4, t + 0.3, 1.2]]) at(box(w, h, t + 0.3, 0x2c3240, { edges: false }), xx, yy, 0, rot);
    at(box(1, FY0 - Y0 - 5.6, 1, CU, { edges: false }), 1, (FY0 + Y0 + 5.6) / 2, 1, rot);
    at(cyl(2.7, 1.5, CU), 0, Y0 + 2.4, 0, rot); at(cyl(1.6, 1.3, 0x2c3240), 0, Y0 + 3.8, 0, rot); at(cyl(2.7, 1.5, CU), 0, Y0 + 5.2, 0, rot);
    const crank = new T.Group(); at(crank, 0, Y0 + 30.4, 0, rot); clickable(crank, 'crank');
    at(cyl(1.6, 1.6, C.DARK), 0, 0, 0, crank); at(box(10, 1.2, 2, C.DARK), 5, 0, 0, crank); at(cyl(1.1, 4.4, RED), 10, 2.8, 0, crank);
    // щётки на изолирующей колодке и клеммы на краю подставки
    at(box(9, 7.6, 1.6, 0x2c3240), 0, Y0 + 3.8, 6.2, G);
    at(box(1.8, 1.1, 3.2, 0x1e1e22), -1.6, Y0 + 2.4, 3.9, G); at(box(1.8, 1.1, 3.2, 0x1e1e22), 1.6, Y0 + 5.2, 3.9, G);
    const pA = kit.post(G, -6, 12, Y0), pB = kit.post(G, 6, 12, Y0);
    const bA = W(pA), bB = W(pB);
    cable(W(v3(-2.5, Y0 + 7.6, 6.2)), bA, 0x2a2f3a, 0, { r: 0.45, lift: 1 }); cable(W(v3(2.5, Y0 + 7.6, 6.2)), bB, 0x2a2f3a, 0, { r: 0.45, lift: 1 });
    // лампа и вольтметр переменного тока
    const gl = d.n > 0 ? Math.round(Math.min(1.6, (d.Urms / 220) ** 2) * 100) / 100 : 0;
    const bp = bulb({ glow: gl, value: d.Urms + ' В' }), bN = placeOn(bp, v3(40, 0, 26), 0, 'lamp');
    const vlim = d.Em <= 100 ? 100 : d.Em <= 400 ? 400 : 1000;
    const vm = zeroMeter(kit, { letter: 'V', lim: vlim, unit: 'В', body: 0xe6c14a }); at(vm.g, -30, 0, 30);
    const vA = world(vm.g, vm.tA), vB = world(vm.g, vm.tB);
    const ws = [cable(bA, bN.tin, C.WIRE.plus, 0, { lift: 3 }), cable(bB, bN.tout, C.WIRE.minus, 0, { lift: 3 }),
      cable(bA, vA, C.WIRE.plus, 0, { lift: 3, r: 0.7 }), cable(bB, vB, C.WIRE.minus, 0, { lift: 3, r: 0.7 })].map((c, i) => flow(kit, c, i > 1 ? 0.7 : 0.95));
    // мерцание лампы: мгновенная мощность ∝ sin²
    const L0 = [];
    bN.g.traverse(o => { if (o.isPointLight) L0.push([o, 'intensity', o.intensity]); else if (o.isSprite) L0.push([o.material, 'opacity', o.material.opacity]); else if (o.isMesh && o.material && o.material.emissiveIntensity > 0) L0.push([o.material, 'emissiveIntensity', o.material.emissiveIntensity]); });
    kit.tag(W(v3(4, Y0 + 36, 0)), 'Ручка', `${d.n} об/с · ${d.f} Гц`, d.f === 50);
    kit.tag(W(v3(-19.5, Y0 + 27, 2)), 'Рамка', d.N + ' витков');
    kit.tag(bN.tagAt, 'Лампа 220 В', gl > 1.25 ? 'перегрузка!' : 'U = ' + d.Urms + ' В', gl > 1.25);
    const eTag = liveTag(kit, v3(-30, vm.top + 3, 30), 'ℰₘ = ' + d.Em + ' В', 'e = 0 В', d.ok);
    kit.onFrame((dt, tt) => {
      const s = live(); th = s ? s.th : th + (kit.reduce ? 0 : 2 * Math.PI * d.n / 100 * dt);
      rot.rotation.y = th - Math.PI / 2;
      const sn = Math.sin(th), e = d.Em * sn;
      vm.piv.rotation.z = -clamp(e / vlim, -1.1, 1.1) * 60 * Math.PI / 180;
      const v = d.n > 0 ? 1.6 * sn : 0; ws.forEach(w => w.set(v, dt));
      const k = d.n > 0 ? 0.35 + 0.65 * sn * sn : 1; for (const [o, p, b] of L0) o[p] = b * k;
      eTag.set('e = ' + Math.round(e) + ' В');
    });
  };

  // =============================== Трансформатор ===============================
  SC['ind-transformer'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, clickable, C, cable, post, keep, bulb, meter, placeOn, textTex } = kit;
    at(box(58, 2, 26, C.WOOD2), 0, 1, -6);
    const Y0 = 2, H = 32, W = 42, LW = 7, ZC = -8, DZ = 8;
    // сердечник из стальных пластин: чередуем два оттенка
    const core = new T.Group(); at(core, 0, 0, ZC);
    const np = 8, pt = DZ / np;
    for (let i = 0; i < np; i++) {
      const z = -DZ / 2 + pt * (i + 0.5), col = i % 2 ? 0x5a6582 : 0x4a5470, o = { edgeAngle: 20 };
      at(box(W, LW, pt * 0.96, col, o), 0, Y0 + LW / 2, z, core); at(box(W, LW, pt * 0.96, col, o), 0, Y0 + H - LW / 2, z, core);
      at(box(LW, H - 2 * LW, pt * 0.96, col, o), -W / 2 + LW / 2, Y0 + H / 2, z, core); at(box(LW, H - 2 * LW, pt * 0.96, col, o), W / 2 - LW / 2, Y0 + H / 2, z, core);
    }
    for (const xx of [-W / 2 + 2, W / 2 - 2]) for (const yy of [Y0 + 2.2, Y0 + H - 2.2]) { const b = cyl(1, 0.8, C.BRASS, { seg: 6 }); b.rotation.x = Math.PI / 2; at(b, xx, yy, DZ / 2 + 0.4, core); }
    // поток в сердечнике — стрелки, длина ∝ |Ф|, направление — знак Ф
    const arrows = [];
    const am = keep(new T.MeshBasicMaterial({ color: AMBER }));
    const arrow = (x, y, z, dir) => {
      const hold = new T.Group(); at(hold, x, y, z);
      at(new T.Mesh(keep(new T.CylinderGeometry(0.45, 0.45, 3.4, 10)), am), 0, -1, 0, hold);
      at(new T.Mesh(keep(new T.ConeGeometry(1.3, 2.4, 14)), am), 0, 1.6, 0, hold);
      arrows.push({ hold, dir });
    };
    arrow(-8, Y0 + H + 1.4, ZC, 1); arrow(8, Y0 + H + 1.4, ZC, 1);
    arrow(-5, Y0 + LW / 2, ZC + DZ / 2 + 1.4, -1); arrow(5, Y0 + LW / 2, ZC + DZ / 2 + 1.4, -1);
    // обмотки
    const lg = Math.log(2200 / 6);
    function coil(xc, N, key) {
      const g = new T.Group(); at(g, xc, 0, ZC); clickable(g, key);
      const f = Math.log(N / 6) / lg, r = 6.2 + 2.2 * f, nr = Math.round(4 + 12 * f);
      const y0 = Y0 + LW + 1, y1 = Y0 + H - LW - 1;
      at(cyl(r, y1 - y0, CU), 0, (y0 + y1) / 2, 0, g);
      for (let k = 0; k < nr; k++) at(cyl(r + 0.12, 0.32, CU2, { edges: false, hull: false }), 0, y0 + 0.8 + (y1 - y0 - 1.6) * k / Math.max(1, nr - 1), 0, g);
      at(cyl(r + 1.3, 0.9, 0x2c3240), 0, y0 - 0.45, 0, g); at(cyl(r + 1.3, 0.9, 0x2c3240), 0, y1 + 0.45, 0, g);
      return { g, r, y0, y1 };
    }
    const lx = -W / 2 + LW / 2, rx = W / 2 - LW / 2;
    const c1 = coil(lx, d.N1, 'n1'), c2 = coil(rx, d.N2, 'n2');
    // клеммы обмоток на подставке
    const p1a = post(kit.root, lx - 5, 4.5, Y0), p1b = post(kit.root, lx + 5, 4.5, Y0), p2a = post(kit.root, rx - 5, 4.5, Y0), p2b = post(kit.root, rx + 5, 4.5, Y0);
    cable(v3(lx - 2, c1.y1 - 1, ZC + c1.r), p1a, CU, 0, { r: 0.4, lift: 0.6 }); cable(v3(lx + 2, c1.y0 + 1, ZC + c1.r), p1b, CU, 0, { r: 0.4, lift: 0.6 });
    cable(v3(rx - 2, c2.y1 - 1, ZC + c2.r), p2a, CU, 0, { r: 0.4, lift: 0.6 }); cable(v3(rx + 2, c2.y0 + 1, ZC + c2.r), p2b, CU, 0, { r: 0.4, lift: 0.6 });
    // источник: переменный ~ или постоянный =
    const sg = new T.Group(); at(sg, -46, 0, -16); clickable(sg, 'acdc');
    at(box(20, 13, 14, 0x3b4a66), 0, 6.5, 0, sg); at(box(18.4, 1, 12.4, 0x4a5b7c), 0, 13.4, 0, sg);
    const scr = new T.Mesh(keep(new T.PlaneGeometry(13, 5)), new T.MeshBasicMaterial({ map: keep(textTex((d.ac ? '~ ' : '= ') + d.U1 + ' В', d.ac ? '#ffd166' : '#72d4e8', '#0e1520', 280, 108)) }));
    at(scr, -1.5, 8.5, 7.05, sg);
    at(box(5, 2.6, 0.6, 0x2c3240), 5.5, 3.6, 7.2, sg);
    const lev = new T.Group(); at(lev, 5.5, 3.6, 7.5, sg); lev.rotation.z = d.ac ? -0.6 : 0.6;
    at(box(0.8, 3.6, 0.8, 0xd9dfe9), 0, 1.6, 0, lev);
    const sA = v3(-46 + 5, 15.4, -19), sB = v3(-46 - 5, 15.4, -19);
    at(cyl(1.2, 2, RED), sA.x, 14.4, sA.z); at(cyl(1.2, 2, 0x26324a), sB.x, 14.4, sB.z);
    // вольтметры и лампа
    const rng = U => U <= 15 ? 15 : U <= 250 ? 250 : U <= 1500 ? 1500 : 5000;
    const v1 = meter({ kind: 'V', val: d.U1, max: rng(d.U1), value: '' }), v1N = placeOn(v1, v3(-38, 0, 30), 0, 'v1');
    const v2 = meter({ kind: 'V', val: d.U2, max: rng(d.U2), value: '' }), v2N = placeOn(v2, v3(14, 0, 32), 0, 'v2');
    const gl = Math.round(Math.min(1.6, (d.U2 / 12) ** 2) * 100) / 100, over = d.U2 > 15;
    const bp = bulb({ glow: gl, value: '' }), bN = placeOn(bp, v3(46, 0, 12), 0, 'lamp');
    const I1 = d.ac ? 0 : 1;
    const wp = [cable(sA, p1a, C.WIRE.plus, I1, { lift: 4 }), cable(p1b, sB, C.WIRE.minus, I1, { lift: 3 })];
    cable(v1N.tin, p1a, C.WIRE.probeR, 0, { r: 0.6, lift: 5, arch: 1 }); cable(v1N.tout, p1b, C.WIRE.probeB, 0, { r: 0.6, lift: 5, arch: 1 });
    const ws = [cable(p2b, bN.tin, C.WIRE.plus, 0, { lift: 3 }), cable(bN.tout, p2a, C.WIRE.minus, 0, { lift: 3 })];
    cable(v2N.tin, p2a, C.WIRE.probeR, 0, { r: 0.6, lift: 5, arch: 1 }); cable(v2N.tout, p2b, C.WIRE.probeB, 0, { r: 0.6, lift: 5, arch: 1 });
    const fP = d.ac ? wp.map(c => flow(kit, c)) : [], fS = d.ac && d.U2 > 0 ? ws.map(c => flow(kit, c)) : [];
    kit.tag(v3(-46, 17, -16), 'Источник', d.ac ? '~ 50 Гц' : '= постоянный');
    kit.tag(v3(lx, Y0 + H + 4, ZC), 'Первичная', 'N₁ = ' + d.N1);
    kit.tag(v3(rx, Y0 + H + 4, ZC), 'Вторичная', 'N₂ = ' + d.N2);
    kit.tag(v1N.tagAt, 'Вольтметр', 'U₁ = ' + d.U1 + ' В');
    kit.tag(v2N.tagAt, 'Вольтметр', 'U₂ = ' + d.U2txt + ' В', d.hit);
    kit.tag(bN.tagAt, 'Лампа 12 В', d.U2 === 0 ? 'не горит' : over ? 'перекал!' : 'горит', over);
    let ph = 0;
    kit.onFrame((dt) => {
      const s = live(); ph = s ? s.ph : ph + (kit.reduce ? 0 : Math.PI * dt);
      const f = d.ac ? Math.cos(ph) : 1, a = Math.max(0.06, Math.abs(f));
      arrows.forEach(ar => {
        ar.hold.rotation.z = ar.dir * (f >= 0 ? 1 : -1) > 0 ? -Math.PI / 2 : Math.PI / 2;
        ar.hold.scale.setScalar(a);
      });
      const sn = Math.sin(ph);
      fP.forEach(w => w.set(1.4 * sn, dt)); fS.forEach(w => w.set(1.4 * sn, dt));
    });
  };

  // =============================== Электромагнитные волны ===============================
  function nmColor(nm) {
    let r = 0, g = 0, b = 0;
    if (nm < 440) { r = -(nm - 440) / 60; b = 1; } else if (nm < 490) { g = (nm - 440) / 50; b = 1; } else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
    else if (nm < 580) { r = (nm - 510) / 70; g = 1; } else if (nm < 645) { r = 1; g = -(nm - 645) / 65; } else r = 1;
    return (Math.round(clamp(r, 0, 1) * 255) << 16) | (Math.round(clamp(g, 0, 1) * 255) << 8) | Math.round(clamp(b, 0, 1) * 255);
  }
  SC['ind-waves'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, clickable, C, keep, textTex, glowTex, toon, baseBlock } = kit;
    const TX = -40, RX = 40, ZW = -10, YW = 24;
    // генератор-передатчик
    const gg = new T.Group(); at(gg, TX, 0, -6);
    at(box(26, 12, 16, 0x3b4a66), 0, 6, 0, gg); at(box(24.4, 1, 14.4, 0x4a5b7c), 0, 12.5, 0, gg);
    const scr = new T.Mesh(keep(new T.PlaneGeometry(14, 5.2)), new T.MeshBasicMaterial({ map: keep(textTex(d.ftxt, '#86e0a8', '#0e1520', 300, 112)) }));
    at(scr, -3.5, 7.6, 8.05, gg);
    const knob = (x, key, col) => { const k = cyl(2, 1.8, col, { seg: 18 }); k.rotation.x = Math.PI / 2; at(k, x, 3.4, 8.8, gg); clickable(k, key); return k; };
    knob(-7, 'e-', 0xd9dfe9); knob(-0.5, 'e+', 0xd9dfe9);
    const pad = (x, key, col, txt) => {
      const p = new T.Group(); at(p, x, 13, 3.5, gg); clickable(p, key);
      at(box(7, 1.4, 6, col), 0, 0.7, 0, p);
      const t = new T.Mesh(keep(new T.PlaneGeometry(6, 3)), new T.MeshBasicMaterial({ map: keep(textTex(txt, '#ffffff', col === BLUE ? '#3b7fd8' : '#e0473a', 160, 80)) }));
      t.rotation.x = -Math.PI / 2; at(t, 0, 1.43, 0, p);
    };
    pad(-6, 'e-1', BLUE, 'ν ÷10'); pad(5, 'e+1', RED, 'ν ×10');
    // передающий диполь на изоляторе
    const dipole = (x, gap, ball) => {
      const g = new T.Group(); at(g, x, 0, ZW);
      at(cyl(0.65, 9.6, C.STEEL, { edges: false }), 0, YW - gap / 2 - 4.8, 0, g); at(cyl(0.65, 9.6, C.STEEL, { edges: false }), 0, YW + gap / 2 + 4.8, 0, g);
      if (ball) for (const yy of [YW - gap / 2 - 9.6, YW + gap / 2 + 9.6]) at(mesh(new T.SphereGeometry(1.2, 16, 12), C.STEEL, { hull: true, edges: false }), 0, yy, 0, g);
      return g;
    };
    at(cyl(1.3, 2.6, 0xf3f4f6), TX, 13.3, ZW);
    dipole(TX, 1.6, true);
    at(box(2.4, 1.4, 2.4, 0x2c3240), TX, YW, ZW);
    // приёмник: подставка, стойка, диполь с лампочкой в разрыве
    const rg = new T.Group(); at(rg, RX, 0, ZW);
    const y0 = baseBlock(rg, 14, 12);
    at(cyl(0.9, 11.4 - y0, C.DARK), 0, (y0 + 11.4) / 2, 0, rg); at(cyl(1.3, 2.4, 0xf3f4f6), 0, 12.6, 0, rg);
    dipole(RX, 3.2, false);
    const glow = Math.round(1.5 * Math.exp(-(((d.e - 8) / 0.3) ** 2)) * 100) / 100;
    const glass = new T.Mesh(keep(new T.SphereGeometry(1.9, 24, 16)), keep(new T.MeshToonMaterial({ color: glow > 0.05 ? 0xfff1b8 : 0xdfe8ef, gradientMap: kit.grad, transparent: true, opacity: glow > 0.05 ? 0.95 : 0.6, emissive: 0xffc23a, emissiveIntensity: Math.min(1, glow) })));
    glass.add(new T.Mesh(glass.geometry, kit.hullMat)); at(glass, RX, YW, ZW);
    let halo = null, light = null;
    if (glow > 0.05) {
      halo = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color: 0xffd27a, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: Math.min(1, 0.3 + glow * 0.5) }));
      halo.scale.setScalar(9 + 12 * glow); at(halo, RX, YW, ZW);
      light = new T.PointLight(0xffc860, 40 * glow, 60, 1.2); at(light, RX, YW + 1, ZW + 2);
    }
    // волна: бегущие кольца в плоскости, где излучает диполь, и векторы E (вверх-вниз) и B (поперёк)
    const lamS = clamp(300 * Math.pow(0.86, d.e - 4), 34, 300) * 0.2, k = 2 * Math.PI / lamS;
    const col = new T.Color(d.col === 'vis' ? nmColor(d.nm) : d.col);
    const R = RX - TX + 8, A = 0.5;
    const ring = new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide,
      uniforms: { k: { value: k }, ph: { value: 0 }, col: { value: col }, R: { value: R } },
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float k; uniform float ph; uniform vec3 col; uniform float R; varying vec2 vP; void main(){ float r = length(vP); float w = pow(0.5 + 0.5 * sin(k * r - ph), 8.0); float f = smoothstep(2.0, 8.0, r) * (1.0 - smoothstep(R * 0.8, R, r)); gl_FragColor = vec4(col, w * f * 0.6); }' });
    keep(ring);
    const disc = new T.Mesh(keep(new T.CircleGeometry(R, 72, -A, 2 * A)), ring); disc.rotation.x = -Math.PI / 2; disc.renderOrder = 3; at(disc, TX, YW, ZW);
    at(cyl(0.25, RX - TX - 6, 0x8b96ad, { edges: false, hull: false }), 0, YW, ZW).rotation.z = Math.PI / 2;
    const eGeo = keep(new T.BoxGeometry(0.55, 1, 0.55)); eGeo.translate(0, 0.5, 0);
    const bGeo = keep(new T.BoxGeometry(0.5, 0.5, 1)); bGeo.translate(0, 0, 0.5);
    const eMat = keep(new T.MeshBasicMaterial({ color: AMBER })), bMat = keep(new T.MeshBasicMaterial({ color: CYAN }));
    const bars = [];
    for (let x = TX + 5; x <= RX - 4; x += 2.2) {
      const e = new T.Mesh(eGeo, eMat), b = new T.Mesh(bGeo, bMat); at(e, x, YW, ZW); at(b, x, YW, ZW); e.renderOrder = b.renderOrder = 4;
      bars.push({ e, b, r: x - TX });
    }
    kit.tag(v3(TX - 6, 15, 2), d.radio ? 'Передатчик' : 'Источник', d.ftxt);
    kit.tag(v3(0, YW + 10, ZW), 'Волна · ' + d.band, 'λ = ' + d.lamtxt);
    kit.tag(v3(RX + 4, 12, ZW + 6), 'Приёмник · диполь 1,5 м', glow > 0.3 ? 'лампа горит' : glow > 0.05 ? 'еле светит' : 'нет приёма', glow > 0.3);
    let ph = 0;
    kit.onFrame((dt) => {
      const s = live(); ph = s ? s.wph : ph + (kit.reduce ? 0 : 3 * dt);
      ring.uniforms.ph.value = ph;
      for (const q of bars) { const v = Math.sin(k * q.r - ph); q.e.scale.y = v * 8 || 0.001; q.b.scale.z = v * 7 || 0.001; }
      if (halo) { const p = 0.75 + 0.25 * Math.abs(Math.sin(k * (RX - TX) - ph)); halo.material.opacity = Math.min(1, 0.3 + glow * 0.5) * p; light.intensity = 40 * glow * p; }
    });
  };
})();
