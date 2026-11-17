// «Как в жизни» для темы «Статика: равновесие тел» (labs/phys-statics): картонная пластина на гвоздике штатива с отвесом,
// балка на двух опорах с весами, кронштейн с тросом и фонарём, шарик в чаше / на куполе / на столе, ванька-встанька,
// шкаф на наклонной доске с упором, башенный кран с противовесом.
// Сцены строятся из window.LUCH_REAL() опыта; плавное движение (качание пластины, шарик, наклон доски, тележка крана) —
// из window.LUCH_REAL.live() каждый кадр. Набор деталей kit — из /luch/real3d.js.
(() => {
  const SC = (window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {});
  const IRON = 0x4a5468, ROD = 0xb9c0cc, ORANGE = 0xffb547, ROPE = 0xd9c08a, LOAD = 0x7d8799, CARD = 0xe3cfa6,
    PENCIL = 0x2f6fd8, RED = 0xe0473a, GREEN = 0x86e0a8, YELLOW = 0xf2c94c, TEAL = 0x2b6d7c, STEEL = 0xc6ccd6;
  const DEGR = Math.PI / 180;
  const fmt = (x, n = 1) => (Math.round(x * 10 ** n) / 10 ** n).toFixed(n).replace('.', ',').replace('-', '−');
  const nf = x => Math.abs(x - Math.round(x)) < 1e-9 ? String(Math.round(x)) : fmt(x, 1);
  const live = () => { try { return (window.LUCH_REAL && window.LUCH_REAL.live && window.LUCH_REAL.live()) || {}; } catch (e) { return {}; } };
  // последняя созданная подпись: её значение и место меняем каждый кадр, не перестраивая сцену
  const lastTag = () => { const l = document.querySelectorAll('.rl-view .rl-lbl'); return l[l.length - 1] || null; };
  function liveTag(kit, p, name, value, hot) {
    kit.tag(p, name, value, hot);
    const el = lastTag(), i = el && el.querySelector('i');
    let shown = value;
    return { p, el, set(v, h) { if (i && v !== shown) { shown = v; i.textContent = v; } if (el && h !== undefined) el.classList.toggle('hot', !!h); } };
  }

  // ---------- общие детали ----------
  function canvasTex(kit, w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    draw(x, w, h);
    const t = new kit.T.CanvasTexture(c); t.colorSpace = kit.T.SRGBColorSpace; t.anisotropy = 4; return kit.keep(t);
  }
  function plane(kit, w, h, tex) {
    const { T, keep } = kit;
    return new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: tex })));
  }
  const textPlate = (kit, txt, w, h, fg = '#1b1610', bg = '#f7f3ea') => plane(kit, w, h, kit.keep(kit.textTex(txt, fg, bg, Math.round(64 * w / h), 64)));
  // плоская фигура в плоскости XY, вытянутая по z
  function slab(kit, pts, depth, color, o) {
    const { T } = kit, s = new T.Shape();
    pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    const g = new T.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 16 }); g.translate(0, 0, -depth / 2);
    return kit.mesh(g, color, o);
  }
  // стержень/нить между двумя точками; свой материал, чтобы менять цвет на ходу
  function rodPiece(kit, r, color, parent) {
    const { T, keep } = kit;
    const mat = keep(new T.MeshToonMaterial({ color, gradientMap: kit.grad }));
    const m = new T.Mesh(keep(new T.CylinderGeometry(r, r, 1, 10)), mat); m.castShadow = true;
    (parent || kit.root).add(m);
    const Y1 = new T.Vector3(0, 1, 0), d = new T.Vector3();
    m.span = (a, b) => {
      d.copy(b).sub(a); const L = d.length(); m.visible = L > 0.05; if (!m.visible) return;
      m.position.copy(a).addScaledVector(d, 0.5); m.scale.set(1, L, 1); m.quaternion.setFromUnitVectors(Y1, d.normalize());
    };
    m.color = hex => mat.color.setHex(hex);
    return m;
  }
  const ball = (kit, r, color) => kit.mesh(new kit.T.SphereGeometry(r, 28, 18), color, { edges: false, hull: true });
  function standBase(kit, x, z, len) {
    const { at, box, cyl } = kit;
    at(box(18, 2, 18, IRON), x, 1, z);
    at(cyl(1.1, len, ROD, { edges: false }), x, 2 + len / 2, z);
  }

  // =====================================================================================
  // 1. Центр тяжести: штатив с гвоздиком, картонная пластина с отверстиями, отвес; линии карандашом
  SC['statics-cg'] = (kit, d) => {
    const { T, at, box, cyl, clickable, v3 } = kit;
    const s = 0.42, PY = 92, SX = 52, p = d.holes[d.hole];
    const Lc = (x, y) => [(x - p[0]) * s, -(y - p[1]) * s];
    // штатив: лапка тянется к гвоздику
    const st = new T.Group(); at(st, 0, 0, 0); clickable(st, 'pin');
    standBase(kit, SX, -6, PY + 8); st.add(...kit.root.children.slice(-2));
    const arm = cyl(0.8, SX, ROD, { edges: false }); arm.rotation.z = Math.PI / 2; at(arm, SX / 2, PY + 5, -6, st);
    at(box(3, 3, 3, IRON), SX, PY + 5, -6, st);
    at(box(1.4, 5, 1.4, IRON), 0, PY + 2.5, -6, st);
    const pin = cyl(0.45, 9, 0xe8ecf4, { edges: false }); pin.rotation.x = Math.PI / 2; at(pin, 0, PY, -1.8, st);
    // пластина: дырки настоящие; поворачивается вокруг гвоздика
    const pg = new T.Group(); at(pg, 0, PY, 0);
    const sh = new T.Shape();
    d.pts.forEach((q, i) => { const [x, y] = Lc(q[0], q[1]); i ? sh.lineTo(x, y) : sh.moveTo(x, y); });
    d.holes.forEach(q => { const [x, y] = Lc(q[0], q[1]); const hp = new T.Path(); hp.absarc(x, y, 1.3, 0, Math.PI * 2, true); sh.holes.push(hp); });
    const geo = new T.ExtrudeGeometry(sh, { depth: 0.8, bevelEnabled: false, curveSegments: 18 }); geo.translate(0, 0, -0.4);
    const plate = kit.mesh(geo, CARD, { edgeAngle: 40 }); at(plate, 0, 0, 0, pg); clickable(plate, 'plate');
    const ring = kit.mesh(new T.TorusGeometry(1.7, 0.28, 8, 20), ORANGE, { edges: false, matOpt: { emissive: ORANGE, emissiveIntensity: 0.3 } }); at(ring, 0, 0, 0.5, pg);
    // линии по отвесу — только на картоне
    (d.lines || []).forEach(r => {
      const [x1, y1] = Lc(r[0], r[1]), [x2, y2] = Lc(r[2], r[3]), L = Math.hypot(x2 - x1, y2 - y1); if (L < 0.2) return;
      [0.46, -0.46].forEach(z => { const b = box(L, 0.32, 0.06, PENCIL, { edges: false, shadow: false }); b.rotation.z = Math.atan2(y2 - y1, x2 - x1); at(b, (x1 + x2) / 2, (y1 + y2) / 2, z, pg); });
    });
    let cgTag = null, cgL = null;
    if (d.cg) {
      cgL = Lc(d.cg[0], d.cg[1]);
      [0.5, -0.5].forEach(z => { const m = cyl(1.1, 0.12, RED, { edges: false, hull: false, matOpt: { emissive: RED, emissiveIntensity: 0.3 } }); m.rotation.x = Math.PI / 2; at(m, cgL[0], cgL[1], z, pg); });
    }
    // отвес: нить с гвоздика, конус-грузик
    const bobY = 12;
    const str = rodPiece(kit, 0.12, 0xe8ecf4); str.span(v3(0, PY, 1.4), v3(0, bobY + 2.2, 1.4));
    const bob = cyl(0.05, 4.4, LOAD, { r2: 1.6, seg: 18 }); at(bob, 0, bobY, 1.4);
    kit.tag(v3(0, bobY - 3, 1.4), 'Отвес', '');
    kit.tag(v3(SX, PY + 12, -6), d.name, (d.lines || []).length ? (d.cg ? 'ЦТ найден' : 'линия проведена') : 'нажмите — отверстие', !!d.cg);
    if (d.cg) cgTag = liveTag(kit, v3(0, 0, 0), 'Центр тяжести', '', false);
    const w = new T.Vector3();
    const pose = () => {
      pg.rotation.z = -(live().th || 0);
      if (cgTag) { pg.updateWorldMatrix(true, false); w.set(cgL[0], cgL[1] + 1.4, 0.6); pg.localToWorld(w); cgTag.p.copy(w); }
    };
    pose(); kit.onFrame(pose);
  };

  // =====================================================================================
  // 2. Балка 1 м на двух опорах-призмах, под опорами весы с табло; чугунные грузы 20 Н и 10 Н
  SC['statics-beam'] = (kit, d) => {
    const { at, box, clickable, v3, C } = kit;
    const X = cm => -45 + cm * 0.9, BY = 17;
    [[0, 'A', d.NA], [100, 'B', d.NB]].forEach(([cm, n, N]) => {
      const x = X(cm);
      at(box(16, 7, 14, 0x3b4a66), x, 3.5, 0); at(box(18, 1, 16, 0xa9b4c9), x, 7.5, 0);
      const scr = textPlate(kit, d.show ? fmt(N) + ' Н' : '? Н', 10, 3.4, d.show ? '#86e0a8' : '#8b96ad', '#0e1520'); at(scr, x, 3.8, 7.03);
      at(slab(kit, [[-4.5, 0], [4.5, 0], [0, 9]], 10, IRON), x, 8, 0);
      kit.tag(v3(x + (cm ? 6 : -6), 0.5, 10), 'Весы ' + n, d.show ? 'N = ' + fmt(N) + ' Н' : 'закрыты', d.show);
    });
    at(box(96, 2.6, 8, C.WOOD), 0, BY + 1.3, 0);
    for (let c = 0; c <= 100; c += 10) at(box(0.25, 1.3, 0.08, 0x5a3a1e, { edges: false, shadow: false }), X(c), BY + 0.75, 4.05);
    const top = BY + 2.6, stack = Math.abs(d.xa - d.xb) < 10;
    const block = (w, h, dd, P, key, x, y0) => {
      const g = new kit.T.Group(); at(g, x, y0, 0); clickable(g, key);
      at(box(w, h, dd, LOAD), 0, h / 2, 0, g);
      const lp = textPlate(kit, P + ' Н', w * 0.8, Math.min(h * 0.6, 2.4), '#f7f3ea', '#4a5468'); at(lp, 0, h / 2, dd / 2 + 0.03, g);
      return g;
    };
    block(5.6, 4.6, 6, 20, 'la-next', X(d.xa), top);
    block(4.4, 3.2, 5, 10, 'lb-next', X(d.xb), stack ? top + 4.6 : top);
    kit.tag(v3(X(d.xa) - 4, top + 7, 3), 'Груз 20 Н', d.xa + ' см');
    kit.tag(v3(X(d.xb) + 4, (stack ? top + 7.8 : top) + 5, 3), 'Груз 10 Н', d.xb + ' см');
    kit.tag(v3(0, BY + 4, -6), 'Балка 10 Н', '100 см');
  };

  // =====================================================================================
  // 2. Кронштейн: стена, стержень на шарнире, трос с датчиком силы к одному из креплений, фонарь 20 Н
  SC['statics-bracket'] = (kit, d) => {
    const { T, at, box, cyl, clickable, v3 } = kit;
    const WX = -44, HY = 30, px = 1.3, ex = WX + 60 * px, xl = WX + d.xl * px;
    const ay = a => HY + 60 * px * Math.tan(a * DEGR), AY = ay(d.ang);
    // кирпичная стена (лицом к зрителю справа)
    at(box(6, 124, 44, 0x8a6f5c), WX - 3, 62, 0);
    for (let y = 6; y < 124; y += 6) at(box(0.1, 0.25, 44, 0x5e4a3c, { edges: false, shadow: false }), WX + 0.02, y, 0);
    // крепления троса
    d.angs.forEach(a => {
      const g = new T.Group(); at(g, WX, ay(a), 0); clickable(g, 'ang-' + a);
      at(box(1, 4, 3, a === d.ang ? 0xa9b4c9 : IRON), 0.5, 0, 0, g);
      const b = cyl(0.6, 1.4, a === d.ang ? 0xe8ecf4 : 0x6c7a96, { edges: false }); b.rotation.z = Math.PI / 2; at(b, 1.4, 0, 0, g);
      kit.tag(v3(WX + 1, ay(a) + 3, 2.5), '', a + '°', a === d.ang);
    });
    // шарнир и стержень
    at(box(2, 6, 4, IRON), WX + 1, HY, 0);
    const hp = cyl(0.7, 5, 0xe8ecf4, { edges: false }); hp.rotation.x = Math.PI / 2; at(hp, WX + 1.2, HY, 0);
    const rod = cyl(0.8, ex - WX, 0xa9b4c9); rod.rotation.z = Math.PI / 2; at(rod, (WX + ex) / 2, HY, 0);
    for (let c = 10; c <= 60; c += 10) at(box(0.2, 0.2, 1.7, 0x3a4762, { edges: false, shadow: false }), WX + c * px, HY + 0.8, 0);
    // трос и датчик
    const A = v3(WX + 1.5, AY, 0), E = v3(ex, HY, 0);
    const rope = rodPiece(kit, 0.32, d.over ? RED : ROPE); rope.span(E, A);
    const sp = A.clone().lerp(E, 0.3), sen = box(1.8, 6, 1.8, TEAL); sen.position.copy(sp); sen.quaternion.setFromUnitVectors(v3(0, 1, 0), E.clone().sub(A).normalize()); kit.root.add(sen);
    // фонарь
    const lamp = new T.Group(); at(lamp, xl, HY, 0); clickable(lamp, 'lamp+'); lamp.scale.setScalar(1.6);
    at(kit.mesh(new T.TorusGeometry(0.8, 0.22, 8, 16), ROD, { edges: false }), 0, -1, 0, lamp);
    at(cyl(0.2, 2.4, ROD, { edges: false, hull: false }), 0, -2.6, 0, lamp);
    at(cyl(1.4, 1.6, 0x2c3240, { r2: 0.7, seg: 4 }), 0, -4.4, 0, lamp);
    at(box(3.4, 4.6, 3.4, 0xffd166, { matOpt: { emissive: 0xffc23a, emissiveIntensity: 0.7 } }), 0, -7.5, 0, lamp);
    at(box(4, 0.8, 4, 0x2c3240), 0, -10.2, 0, lamp);
    lamp.add(new T.PointLight(0xffc860, 18, 40, 1.4)); lamp.children[lamp.children.length - 1].position.set(0, -7.5, 0);
    const mid = A.clone().lerp(E, 0.55); kit.tag(v3(mid.x + 2, mid.y + 3, 3), 'Трос', 'T = ' + fmt(d.T) + ' Н' + (d.over ? ' > 30!' : ''), d.over);
    kit.tag(v3(xl, HY - 20, 4), 'Фонарь 20 Н', 'x = ' + d.xl + ' см');
  };

  // =====================================================================================
  // 3. Виды равновесия: деревянная чаша / купол / ровная доска со стальным шариком; ванька-встанька
  SC['statics-kinds'] = (kit, d) => {
    const { T, at, box, clickable, v3, C } = kit;
    const s = 0.34, Yb = 380, KB = 0.0035, RB = 16, R3 = RB * s, DEP = 34;
    if (d.sh3 === 'toy') return toy(kit, d, 0.55);
    const ySurf = u => d.sh3 === 'bowl' ? 300 - KB * u * u : d.sh3 === 'dome' ? 232 + KB * Math.min(150, Math.abs(u)) ** 2 : 300;
    const ySl = u => d.sh3 === 'bowl' ? -2 * KB * u : d.sh3 === 'dome' ? 2 * KB * Math.max(-150, Math.min(150, u)) : 0;
    const ext = d.sh3 === 'bowl' ? 160 : d.sh3 === 'dome' ? 150 : 172;
    const pts = [[-ext * s, 0]];
    if (d.sh3 === 'flat') pts.push([-ext * s, (Yb - 300) * s], [ext * s, (Yb - 300) * s]);
    else for (let u = -ext; u <= ext; u += 6) pts.push([u * s, (Yb - ySurf(u)) * s]);
    pts.push([ext * s, 0]);
    const blk = slab(kit, pts, DEP, C.WOOD2, { edgeAngle: 25 }); at(blk, 0, 0, 0); clickable(blk, 'k-next');
    if (d.sh3 === 'flat') [-1, 1].forEach(k => at(box(2, 3, DEP, IRON), k * (ext * s), (Yb - 300) * s + 1.5, 0));
    // уровень покоя центра шарика
    const yr = ((d.sh3 === 'dome' ? 232 : 300) - RB);
    at(box(2 * ext * s, 0.25, 0.25, 0x72d4e8, { edges: false, shadow: false, matOpt: { emissive: 0x72d4e8, emissiveIntensity: 0.6 } }), 0, (Yb - yr) * s, DEP / 2 + 0.4);
    // шарик с полоской — видно, как катится
    const bg = new T.Group(); at(bg, 0, 0, 0); clickable(bg, 'push');
    at(ball(kit, R3, STEEL), 0, 0, 0, bg);
    at(kit.mesh(new T.TorusGeometry(R3 * 1.0, 0.18, 8, 28), 0x7d8799, { edges: false }), 0, 0, 0, bg);
    const nameT = { bowl: 'Чаша', dome: 'Купол', flat: 'Стол' }[d.sh3];
    kit.tag(v3(-ext * s + 6, 2, DEP / 2), nameT, 'нажмите — дальше');
    const bTag = liveTag(kit, v3(0, 0, 0), 'Шарик', 'покой');
    let acc = 1;
    const pose = dt => {
      const Lv = live(), u = Lv.u || 0;
      let x, y;
      if (Lv.off) { x = CXu(u); y = Yb - RB - (Lv.drop || 0); }
      else { const sl = ySl(u), N = Math.sqrt(1 + sl * sl); x = CXu(u + RB * sl / N); y = ySurf(u) - RB / N; }
      bg.position.set(x, (Yb - y) * s, 0);
      bg.rotation.z = -(u / RB);
      bTag.p.set(x, (Yb - y) * s + R3 + 2, 2);
      acc += dt || 0;
      if (acc > 0.12) { acc = 0; const dh = (yr - y) / 10; bTag.set(Math.abs(dh) < 0.05 ? 'ЦТ на уровне покоя' : 'ЦТ ' + (dh > 0 ? 'выше' : 'ниже') + ' на ' + fmt(Math.abs(dh)) + ' см'); }
    };
    function CXu(v) { return v * s; }
    pose(1); kit.onFrame(dt => pose(dt));
  };
  function toy(kit, d, s) {
    const { T, at, cyl, clickable, v3 } = kit;
    const R = 46 * s, tg = new T.Group(); at(tg, 0, R, 0); clickable(tg, 'toy-tilt');
    const bot = kit.mesh(new T.SphereGeometry(R, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), RED, { edges: false, hull: true }); at(bot, 0, 0, 0, tg);
    at(cyl(R, 0.4, 0xffd166, { edges: false, hull: false }), 0, 0.2, 0, tg);
    const body = kit.mesh(new T.CylinderGeometry(24 * s, R, 50 * s, 32), 0xff8a73, { edges: false, hull: true }); at(body, 0, 25 * s, 0, tg);
    at(ball(kit, 26 * s, 0xffd9b0), 0, 74 * s, 0, tg);
    const cap = kit.mesh(new T.SphereGeometry(26.6 * s, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2.6), RED, { edges: false }); at(cap, 0, 74 * s, 0, tg);
    [-1, 1].forEach(k => at(ball(kit, 0.75, 0x1b1610), k * 2.2, 74 * s + 0.6, 26 * s - 0.6, tg));
    // свинцовый груз: в донышке или в голове
    const wy = d.toy === 'low' ? -26 * s : 82 * s;
    at(cyl(d.toy === 'low' ? 6 : 4.4, 2.2, IRON), 0, wy, 0, tg);
    if (d.toy !== 'low') at(cyl(4.6, 2.4, IRON), 0, 86 * s, 0, tg);
    // центр тяжести — красная бусина на тонкой спице сбоку, чтобы было видно снаружи
    const ay = d.toy === 'low' ? 20 : -30;
    const cg = ball(kit, 1, RED); at(cg, 0, -ay * s, R + 1.4, tg);
    at(cyl(0.12, R + 1.4, ROD, { edges: false, hull: false }), 0, -ay * s, (R + 1.4) / 2, tg).rotation.x = Math.PI / 2;
    // точка опоры
    const sup = kit.mesh(new T.ConeGeometry(1.2, 2, 3), 0x72d4e8, { edges: false }); sup.rotation.x = Math.PI; at(sup, 0, 0.9, R + 3);
    kit.tag(v3(24, 6, 0), d.toy === 'low' ? 'Груз внизу' : 'Груз в голове', d.toy === 'low' ? 'ЦТ ниже центра донышка' : 'ЦТ выше центра донышка');
    const pose = () => { const ph = live().phi || 0; tg.position.x = R * ph; tg.rotation.z = -ph; sup.position.x = R * ph; };
    pose(); kit.onFrame(pose);
  }

  // =====================================================================================
  // 4. Шкаф (или куб) на наклонной доске с упором; стойка поднимает конец доски; вертикаль через ЦТ
  SC['statics-slope'] = (kit, d) => {
    const { T, at, box, cyl, clickable, v3, C } = kit;
    const s = 0.3, o = d.o, px = d.px, Hx = (92 - 260) * s, Hy = 22 * s, Ls = d.L * s;
    const bw = o.b * px * s, hh = o.h * px * s, b0 = (d.xc - o.b * px / 2) * s, dep = d.obj === 'cube' ? bw : 13;
    at(box(5, Hy, 20, IRON), Hx - 1.6, Hy / 2, 0);
    const bg = new T.Group(); at(bg, Hx, Hy, 0);
    at(box(Ls, 2.4, 20, C.WOOD), Ls / 2, -1.2, 0, bg);
    for (let k = 1; k < 11; k++) at(box(0.15, 0.06, 19, 0x8a5a30, { edges: false, shadow: false }), k * 30 * s, 0.03, 0, bg);
    at(box(2, 2, 20, IRON), b0 - 1, 1, 0, bg);
    // тело на доске: поворачивается вокруг нижнего края у упора
    const og = new T.Group(); at(og, b0, 0, 0, bg); clickable(og, 'reset4');
    if (d.obj === 'cube') at(box(bw, hh, dep, 0x3b6fd8), bw / 2, hh / 2, 0, og);
    else {
      at(box(bw, hh, dep, C.WOOD2), bw / 2, hh / 2, 0, og);
      at(box(0.12, hh - 1.2, 0.1, 0x8a5a30, { edges: false, shadow: false }), bw / 2, hh / 2, dep / 2 + 0.05, og);
      [-0.7, 0.7].forEach(k => at(box(0.3, 1.4, 0.3, 0xe9d9a8, { edges: false }), bw / 2 + k, hh * 0.7, dep / 2 + 0.15, og));
      if (d.obj === 'tallw') at(box(bw + 0.2, 26 * px * s * 0.42, dep + 0.2, IRON), bw / 2, 17 * px * s * 0.42, 0, og);
    }
    const cgL = v3(bw / 2, o.hc * px * s, dep / 2 + 0.4);
    at(ball(kit, 0.9, RED), cgL.x, cgL.y, cgL.z, og);
    // стойка и кольцо
    const post = box(1.8, 1, 1.8, 0x6c7a96); at(post, 0, 0, 0);
    at(box(10, 1.2, 10, IRON), 0, 0.6, 0).name = 'postBase';
    const postBase = kit.root.children[kit.root.children.length - 1];
    const ringG = new T.Group(); at(ringG, 0, 0, 0); clickable(ringG, 'lift');
    at(kit.mesh(new T.TorusGeometry(1.6, 0.5, 10, 24), ORANGE, { edges: false, matOpt: { emissive: ORANGE, emissiveIntensity: 0.3 } }), 0, 0, 0, ringG);
    // вертикаль через центр тяжести
    const plumb = rodPiece(kit, 0.16, GREEN);
    const foot = ball(kit, 0.6, GREEN); kit.root.add(foot);
    const aTag = liveTag(kit, v3(Hx + 12, 6, 9), 'Наклон', 'α = 0°');
    kit.tag(v3(Hx + Ls * 0.6, 2, -9), d.o.n || '', 'нажмите — поставить');
    const w = new T.Vector3();
    let acc = 1;
    const pose = dt => {
      const Lv = live(), a = (Lv.al || 0) * DEGR, ca = Math.cos(a), sa = Math.sin(a);
      bg.rotation.z = a; og.rotation.z = Lv.beta || 0;
      const exx = Hx + Ls * ca, eyy = Hy + Ls * sa;
      const ptop = eyy - 2 * ca; post.position.set(exx - 1, ptop / 2, 0); post.scale.y = Math.max(0.1, ptop);
      postBase.position.set(exx - 1, 0.6, 0);
      ringG.position.set(exx + 0.6, eyy + 2.6, 10.6);
      og.updateWorldMatrix(true, false); w.copy(cgL); og.localToWorld(w);
      const fy = Hy + (w.x - Hx) * Math.tan(a), t = (w.x - Hx) / ca, inside = t >= b0 - 1e-6 && t <= b0 + bw + 1e-6 && (Lv.beta || 0) < 1e-3;
      plumb.visible = foot.visible = !Lv.fallen;
      if (!Lv.fallen) { plumb.span(w, v3(w.x, fy, w.z)); foot.position.set(w.x, fy, w.z); plumb.color(inside ? GREEN : RED); foot.material.color && foot.material.color.setHex(inside ? GREEN : RED); }
      aTag.p.set(Hx + 16, Hy + 4, 9);
      acc += dt || 0;
      if (acc > 0.1) { acc = 0; aTag.set('α = ' + Math.round(Lv.al || 0) + '°' + (Lv.fallen ? ' · упал' : (Lv.beta || 0) > 1e-3 ? ' · падает' : ''), Lv.fallen || (Lv.beta || 0) > 1e-3); }
    };
    // у бусины-основания свой материал, чтобы красить её отдельно
    foot.material = kit.keep(new T.MeshToonMaterial({ color: GREEN, gradientMap: kit.grad }));
    pose(1); kit.onFrame(dt => pose(dt));
  };

  // =====================================================================================
  // 4. Башенный кран: опоры ±2,5 м, решётчатая башня, стрела и противострела, противовес, тележка с грузом
  SC['statics-crane'] = (kit, d) => {
    const { T, at, box, clickable, v3 } = kit;
    const k = 3.6, cx = -20, X = m => cx + m * k, TOP = 94, fall = d.fall || 0, pivX = fall ? X(2.5 * fall) : 0;
    const pg = new T.Group(); at(pg, pivX, 0, 0);
    const cg = new T.Group(); at(cg, -pivX, 0, 0, pg);
    const A = (o, x, y, z, par) => at(o, x, y, z, par || cg);
    // основание с опорами
    A(box(6 * k, 1.6, 6, IRON), cx, 0.8, 0); A(box(6, 1.6, 6 * k, IRON), cx, 0.8, 0);
    [-2.5, 2.5].forEach(m => A(box(3, 1, 3, 0x2c3240), X(m), 0.5, 0));
    // башня: стойки и раскосы
    [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]].forEach(([dx, dz]) => A(box(0.6, TOP - 1.6, 0.6, YELLOW, { edges: false }), cx + dx, 1.6 + (TOP - 1.6) / 2, dz));
    for (let y = 4, i = 0; y < TOP - 2; y += 5, i++) { const b = box(0.35, 5.2, 0.3, 0xa37f1c, { edges: false, shadow: false }); b.rotation.z = i % 2 ? 0.6 : -0.6; A(b, cx, y + 2.5, 1.85); const b2 = b.clone(); A(b2, cx, y + 2.5, -1.85); }
    A(box(4.4, 2, 4.4, YELLOW), cx, TOP, 0);
    // кабина, оголовок, стрела
    A(box(4.2, 4, 4.2, 0xe8ecf4), cx + 4.3, TOP - 3, 2.4);
    A(box(1.4, 14, 1.4, YELLOW), cx, TOP + 8, 0);
    A(box(31 * k, 2.2, 2.2, YELLOW), (X(-9) + X(22)) / 2, TOP + 1.6, 0);
    const tieA = rodPiece(kit, 0.15, 0xc8d2e3, cg), tieB = rodPiece(kit, 0.15, 0xc8d2e3, cg);
    tieA.span(v3(cx, TOP + 15, 0), v3(X(-9), TOP + 2.7, 0)); tieB.span(v3(cx, TOP + 15, 0), v3(X(15), TOP + 2.7, 0));
    // противовес: бетонные блоки по 30 кН
    const cwG = new T.Group(); A(cwG, X(-7), 0, 0); clickable(cwG, 'wc-next');
    A(box(7, 0.6, 5, IRON), 0, TOP + 0.2, 0, cwG);
    for (let i = 0; i < d.wc / 30; i++) A(box(6, 3.6, 5, 0x9aa3b2), 0, TOP - 2 - i * 3.8, 0, cwG);
    // тележка, крюк, груз
    const tr = new T.Group(); A(tr, 0, TOP, 0); clickable(tr, 'tr+');
    A(box(4, 1.4, 3.4, IRON), 0, -0.3, 0, tr);
    const hookY = d.P ? 14 : TOP - 22;
    const cable = rodPiece(kit, 0.14, 0xc8d2e3, cg);
    const hook = kit.mesh(new T.TorusGeometry(0.9, 0.25, 8, 16, Math.PI * 1.5), ROD, { edges: false }); A(hook, 0, hookY - 1, 0);
    let load = null;
    if (d.P) { load = new T.Group(); A(load, 0, 0, 0); clickable(load, 'p-toggle'); A(box(11, 6, 6, 0x3b6fd8), 0, 6 + 3, 0, load); const lp = textPlate(kit, '20 кН', 6, 2.2, '#f7f3ea', '#2c56b0'); A(lp, 0, 9, 3.05, load); }
    // общий центр тяжести: вертикаль до земли
    const cgLine = rodPiece(kit, 0.22, GREEN); const cgBall = ball(kit, 1.1, RED); kit.root.add(cgBall);
    cgBall.material = kit.keep(new T.MeshToonMaterial({ color: GREEN, gradientMap: kit.grad }));
    kit.tag(v3(X(-7), TOP - 4 - Math.max(1, d.wc / 30) * 3.8, 3), 'Противовес', d.wc + ' кН');
    const tTag = liveTag(kit, v3(0, 0, 0), d.P ? 'Груз 20 кН' : 'Крюк', 'вылет 0 м');
    const gTag = liveTag(kit, v3(0, 0, 0), 'Общий ЦТ', 'x = 0 м');
    if (fall) kit.tag(v3(cx, 30, 10), fall > 0 ? 'Опрокинулся вперёд' : 'Опрокинулся назад', 'поднимите кран', true);
    let acc = 1;
    const pose = dt => {
      const Lv = live(), xt = X(Lv.xt || 4);
      tr.position.x = xt; hook.position.x = xt; if (load) load.position.x = xt;
      cable.span(v3(xt, TOP - 1, 0), v3(xt, hookY, 0));
      pg.rotation.z = -fall * (Lv.ct || 0);
      const gx = X(Lv.xc || 0), col = Lv.ok && !fall ? GREEN : RED;
      cgLine.visible = cgBall.visible = !fall;
      if (!fall) { cgLine.span(v3(gx, 0.2, 7), v3(gx, 40, 7)); cgLine.color(col); cgBall.position.set(gx, 40, 7); cgBall.material.color.setHex(col); }
      tTag.p.set(xt + 5, d.P ? 18 : hookY + 2, 3); gTag.p.set(gx, 44, 7);
      acc += dt || 0;
      if (acc > 0.12) { acc = 0; tTag.set('вылет ' + nf(Lv.xt || 4) + ' м'); gTag.set('x = ' + fmt(Lv.xc || 0, 2) + ' м', !(Lv.ok)); }
    };
    pose(1); kit.onFrame(dt => pose(dt));
  };
})();
