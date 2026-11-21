// «Как в жизни» для темы «Опора и движение» (labs/bio-body), как в кабинете биологии: скелет человека на стойке
// с колёсиками и баночки краски по отделам, кость в разрезе; модель руки на штативе — кости, локтевой сустав,
// бицепс и трицепс, гантели на стойке и весы на подъёмном столике; парта, стул, ученик-манекен с позвоночником,
// ростомер и аптечка; тренажёр первой помощи — карточки травм и подносы с шиной, бинтом, косынкой, холодом.
// Сцены строятся из window.LUCH_REAL() опыта; плавный угол в локте и силы мышц — из window.LUCH_REAL.live().
// Набор деталей kit — из /luch/real3d.js.
(() => {
  const SC = (window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {});
  const IVORY = 0xe9dfc6, IVORY_D = 0xcdbf9f, CART = 0x9fd3e6, MUSCLE = 0xc97a88, MUSCLE_ON = 0xff5f5f, TENDON = 0xf3eee2,
    SKIN = 0xd9b99a, HAIR = 0x3a2a20, SHIRT = 0x34507a, PANTS = 0x2a3550, SHOE = 0x1f2a40, STEEL = 0xc6ccd6, IRON = 0x4a5468,
    ORANGE = 0xffb547, GREEN = 0x86e0a8, RED = 0xff6b5a, CYAN = 0x72d4e8, GLASS = 0xdfeef6;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const fr = (x, n = 1) => (Math.round(x * 10 ** n) / 10 ** n).toFixed(n).replace('.', ',');
  const hex = c => (typeof c === 'number' ? c : parseInt(String(c || '#999999').slice(1), 16));
  const live = () => { try { return (window.LUCH_REAL && window.LUCH_REAL.live && window.LUCH_REAL.live()) || {}; } catch (e) { return {}; } };
  const follow = (cur, tgt, dt, k = 9) => (Math.abs(tgt - cur) < 0.05 ? tgt : cur + (tgt - cur) * Math.min(1, dt * k));
  // последняя созданная подпись: её значение и место меняем каждый кадр, не перестраивая сцену
  const lastTag = () => { const l = document.querySelectorAll('.rl-view .rl-lbl'); return l[l.length - 1] || null; };
  function liveTag(kit, p, name, value, hot) {
    kit.tag(p, name, value, hot);
    const el = lastTag(), i = el && el.querySelector('i');
    let shown = value;
    return { p, set(v) { if (i && v !== shown) { shown = v; i.textContent = v; } }, hot(on) { if (el) el.classList.toggle('hot', !!on); } };
  }

  // ---------- материалы и простые детали ----------
  const mat = (kit, color, o = {}) => kit.keep(new kit.T.MeshToonMaterial({ color, gradientMap: kit.grad, side: kit.T.DoubleSide, ...o }));
  function rodM(kit, a, b, r, m, o = {}) {
    const { T } = kit, d = b.clone().sub(a), L = Math.max(0.01, d.length());
    const g = kit.mesh(new T.CylinderGeometry(o.r2 ?? r, r, L, o.seg || 14), 0, { mat: m, edges: false, hull: !!o.hull, shadow: o.shadow });
    g.position.copy(a).addScaledVector(d, 0.5); g.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
    return g;
  }
  function ball(kit, r, m, x, y, z, parent, sc) {
    const s = kit.mesh(new kit.T.SphereGeometry(r, 18, 12), 0, { mat: m, edges: false });
    if (sc) s.scale.set(sc[0], sc[1], sc[2]);
    return kit.at(s, x, y, z, parent);
  }
  // трубчатая кость: тело и два утолщённых конца
  function longBone(kit, g, a, b, r, m) {
    g.add(rodM(kit, a, b, r, m));
    ball(kit, r * 1.55, m, a.x, a.y, a.z, g); ball(kit, r * 1.45, m, b.x, b.y, b.z, g);
  }
  function canvasTex(kit, w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    draw(x, w, h);
    const t = new kit.T.CanvasTexture(c); t.colorSpace = kit.T.SRGBColorSpace; t.anisotropy = 4; return kit.keep(t);
  }
  function plane(kit, w, h, tex, transparent) {
    const { T, keep } = kit;
    return new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: tex, transparent: !!transparent, depthWrite: !transparent })));
  }
  const textPlate = (kit, txt, w, h, fg = '#1b1610', bg = '#f7f3ea') => plane(kit, w, h, kit.keep(kit.textTex(txt, fg, bg, Math.round(64 * w / h), 64)));
  function wrapText(x, txt, maxW) {
    const out = []; let cur = '';
    for (const w of String(txt).split(' ')) { const t = cur ? cur + ' ' + w : w; if (cur && x.measureText(t).width > maxW) { out.push(cur); cur = w; } else cur = t; }
    if (cur) out.push(cur); return out;
  }
  // пунктир (линия взгляда)
  function dashed(kit, a, b, col, r = 0.22) {
    const { T, keep } = kit, d = b.clone().sub(a), L = d.length(); if (L < 0.2) return;
    const dn = d.clone().normalize(), q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dn);
    const geo = keep(new T.CylinderGeometry(r, r, 1.6, 6, 1)), m = keep(new T.MeshBasicMaterial({ color: col }));
    for (let s = 0; s + 1.6 <= L; s += 2.8) { const c = new T.Mesh(geo, m); c.quaternion.copy(q); c.position.copy(a).addScaledVector(dn, s + 0.8); kit.root.add(c); }
  }

  // =====================================================================================
  // 1. Скелет человека на стойке; 13 костей (групп) раскрашиваются по отделам, баночки краски — кисти
  SC['body-skeleton'] = (kit, d) => {
    const { T, at, box, cyl, clickable, v3 } = kit;
    const SX = -14, SZ = -8, k = 0.3, Y0 = 7;
    const p = (xs, ys, z = 0) => v3((xs - 345) * k, (400 - ys) * k + Y0, z);
    const sk = new T.Group(); at(sk, SX, 0, SZ);
    // стойка: пятилучевое основание на колёсиках, штанга, крюк над черепом, держатель таза
    const st = mat(kit, IRON), chrome = mat(kit, STEEL);
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2 + 0.3, arm = box(13, 1.2, 2, IRON, { edges: false }); arm.rotation.y = -a; at(arm, Math.cos(a) * 6.5, 1.6, -10 + Math.sin(a) * 6.5, sk);
      ball(kit, 1.1, mat(kit, 0x22262e), Math.cos(a) * 12.5, 1.1, -10 + Math.sin(a) * 12.5, sk);
    }
    at(cyl(2, 2.4, IRON), 0, 2.4, -10, sk);
    sk.add(rodM(kit, v3(0, 3, -10), v3(0, 120, -10), 0.75, chrome, { hull: true }));
    sk.add(rodM(kit, v3(0, 120, -10.6), v3(0, 120, 0.6), 0.6, chrome));
    sk.add(rodM(kit, v3(0, 120, 0), v3(0, 114.2, 0), 0.3, st));
    sk.add(rodM(kit, v3(0, (400 - 226) * k + Y0, -10), v3(0, (400 - 226) * k + Y0, -4.5), 0.5, chrome));
    const zS = ys => { const t = (ys - 100) / 138; return -4 + 1.3 * Math.cos(t * 1.6 * Math.PI * 2); };
    const bones = d.bones || [], depts = d.depts || [], dc = {}; depts.forEach(q => { dc[q.k] = q; });
    const groups = {}, pulse = [];
    bones.forEach((b, i) => {
      const g = new T.Group(); sk.add(g); clickable(g, 'bone' + i);
      const col = b.p && dc[b.p] ? hex(dc[b.p].c) : IVORY, sel = d.sel === i;
      const m = mat(kit, col, sel ? { emissive: ORANGE, emissiveIntensity: 0.45 } : b.bad ? { emissive: 0xff2a1a, emissiveIntensity: 0.4 } : {});
      if ((sel || b.bad) && !kit.reduce) pulse.push(m);
      groups[b.id] = { g, m, i, b };
    });
    const G = id => groups[id] || { g: new T.Group(), m: mat(kit, IVORY) };
    const dark = mat(kit, 0x2a2018), disc = mat(kit, CART);
    // череп: мозговой отдел, лицо, глазницы, челюсть с зубами
    { const { g, m } = G('skull');
      ball(kit, 6.3, m, 0, p(0, 64).y, 0.4, g, [1, 1.05, 1.15]);
      ball(kit, 4.4, m, 0, p(0, 84).y, 2.2, g, [1, 0.95, 0.95]);
      ball(kit, 3.4, m, 0, p(0, 92).y, 2.6, g, [1.05, 0.55, 0.95]);
      [-1, 1].forEach(s => ball(kit, 1.55, dark, s * 2.4, p(0, 70).y, 5.9, g, [1, 0.9, 0.5]));
      ball(kit, 0.8, dark, 0, p(0, 78).y, 6.4, g, [0.8, 1.2, 0.5]);
      at(box(4.2, 0.9, 0.6, 0xfbf6e8, { edges: false }), 0, p(0, 88).y, 6.1, g); }
    // позвоночник: позвонки, межпозвоночные диски (хрящ), остистые отростки, крестец
    { const { g, m } = G('spine');
      for (let ys = 100; ys < 212; ys += 8) {
        const y = p(0, ys).y, z = zS(ys), r = 1.2 + (ys - 100) / 112 * 0.9;
        const vb = kit.mesh(new T.CylinderGeometry(r, r, 1.7, 14), 0, { mat: m, edges: false }); at(vb, 0, y, z, g);
        const sp = kit.mesh(new T.BoxGeometry(0.7, 0.9, 2.2), 0, { mat: m, edges: false }); sp.rotation.x = 0.5; at(sp, 0, y - 0.3, z - r - 0.8, g);
        at(kit.mesh(new T.CylinderGeometry(r * 0.95, r * 0.95, 0.55, 14), 0, { mat: disc, edges: false }), 0, y - 1.15, z, g);
      }
      g.add(rodM(kit, p(345, 238, zS(238) - 0.6), p(345, 212, zS(212)), 2.3, m, { r2: 3, seg: 16 })); }
    // рёбра: 10 пар дуг от позвоночника к грудине, нижние короче
    const RR = [24, 32, 38, 42, 44, 45, 45, 44, 41, 37];
    { const { g, m } = G('ribs');
      RR.forEach((r0, i) => {
        const ys = 118 + i * 8 + 4, R = r0 * k, rz = R * 0.72, gap = i < 7 ? 0.5 : 1.3 + (i - 7) * 0.35;
        const rg = new T.Group(); rg.scale.z = 0.72; rg.rotation.x = 0.32;
        const tor = kit.mesh(new T.TorusGeometry(R, 0.42, 6, 34, Math.PI * 2 - gap), 0, { mat: m, edges: false });
        tor.rotation.x = -Math.PI / 2; tor.rotation.z = -Math.PI / 2 + gap / 2; rg.add(tor);
        at(rg, 0, p(0, ys).y, zS(ys) + rz, g);
      }); }
    // грудина
    const zSt = zS(150) + 2 * RR[4] * k * 0.72 * 0.93;
    { const { g, m } = G('sternum');
      const sb = kit.mesh(new T.BoxGeometry(2.6, 16, 1), 0, { mat: m, edges: false }); sb.rotation.x = -0.18; at(sb, 0, p(0, 148).y, zSt - 0.6, g);
      ball(kit, 1.5, m, 0, p(0, 120).y, zSt + 0.6, g, [1.3, 1, 0.6]); }
    [-1, 1].forEach(s => {
      // ключицы
      G('clavicle').g.add(rodM(kit, p(345 + s * 5, 114, zSt + 0.8), p(345 + s * 40, 111, -2.5), 0.75, G('clavicle').m));
      // лопатки: плоские треугольники на спине
      { const { g, m } = G('scapula'), sh = new T.Shape(), a = p(345 + s * 30, 116), b = p(345 + s * 46, 115), c = p(345 + s * 40, 158);
        sh.moveTo(a.x, a.y); sh.lineTo(b.x, b.y); sh.lineTo(c.x, c.y); sh.closePath();
        const sc = kit.mesh(new T.ExtrudeGeometry(sh, { depth: 0.8, bevelEnabled: true, bevelSize: 0.4, bevelThickness: 0.3, bevelSegments: 1 }), 0, { mat: m, edges: false }); at(sc, 0, 0, -4.6, g); }
      // плечевая кость с головкой
      { const { g, m } = G('humerus'); longBone(kit, g, p(345 + s * 43, 121, -1.2), p(345 + s * 50, 174, -0.4), 1.05, m); ball(kit, 2, m, (s * 41) * k, p(0, 118).y, -1.6, g); }
      // кости предплечья: лучевая и локтевая
      { const { g, m } = G('forearm'); longBone(kit, g, p(345 + s * 47, 182, -0.6), p(345 + s * 53, 226, 0.4), 0.55, m); longBone(kit, g, p(345 + s * 55, 181, 0.4), p(345 + s * 61, 224, -0.2), 0.5, m); }
      // кисть: запястье, пясть, пальцы
      { const { g, m } = G('hand'), hc = p(345 + s * 58, 240, 0);
        const palm = kit.mesh(new T.BoxGeometry(3.6, 4.6, 1.1), 0, { mat: m, edges: false }); palm.rotation.z = s * 0.12; at(palm, hc.x, hc.y, hc.z, g);
        for (let f = 0; f < 4; f++) { const fx = hc.x + s * (-1.2 + f * 0.85); g.add(rodM(kit, v3(fx, hc.y - 2.2, 0), v3(fx + s * 0.25, hc.y - 6 + Math.abs(f - 1.5) * 0.5, 0.5), 0.32, m)); }
        g.add(rodM(kit, v3(hc.x - s * 1.8, hc.y - 0.8, 0.3), v3(hc.x - s * 3, hc.y - 4.2, 1.6), 0.36, m)); }
      // бедренная кость: головка уходит в таз
      { const { g, m } = G('femur'); longBone(kit, g, p(345 + s * 22, 243, 0), p(345 + s * 16, 300, 0.4), 1.25, m); g.add(rodM(kit, p(345 + s * 22, 243, 0), p(345 + s * 17, 238, -0.4), 0.9, m)); ball(kit, 1.8, m, s * 17 * k, p(0, 237).y, -0.4, g); }
      // голень: большеберцовая, малоберцовая, надколенник
      { const { g, m } = G('shin'); longBone(kit, g, p(345 + s * 16, 308, 0.2), p(345 + s * 15, 378, 0), 0.95, m); longBone(kit, g, p(345 + s * 23, 310, -0.6), p(345 + s * 22, 376, -0.4), 0.42, m);
        ball(kit, 1.15, m, s * 16 * k, p(0, 302).y, 2.2, g, [1, 1.2, 0.55]); }
      // стопа: пяточная кость, плюсна и пальцы — вперёд
      { const { g, m } = G('foot'), fy = p(0, 392).y, fx = s * 17 * k;
        ball(kit, 1.3, m, fx, fy + 0.4, -1, g, [1, 1, 1.3]);
        const ft = kit.mesh(new T.BoxGeometry(3.4, 1.4, 5.5), 0, { mat: m, edges: false }); ft.rotation.x = 0.25; at(ft, fx + s * 0.5, fy + 0.4, 2.2, g);
        for (let f = 0; f < 5; f++) g.add(rodM(kit, v3(fx - s * 0.9 + s * f * 0.65, fy - 0.1, 4.6), v3(fx - s * 1 + s * f * 0.75, fy - 0.5, 6.6 - f * 0.25), 0.28, m)); }
    });
    // таз: чаша из двух тазовых костей, запирательные отверстия
    { const { g, m } = G('pelvis'), c = p(345, 224, -1);
      const bowl = kit.mesh(new T.CylinderGeometry(10, 5.5, 11, 30, 1, true), 0, { mat: m, edges: false }); bowl.scale.z = 0.62; at(bowl, c.x, c.y, c.z, g);
      [-1, 1].forEach(s => { const ring = kit.mesh(new T.TorusGeometry(1.5, 0.55, 8, 18), 0, { mat: m, edges: false }); ring.rotation.y = s * 0.5; at(ring, s * 3.6, p(0, 238).y, 1.8, g); }); }
    if (pulse.length) kit.onFrame((dt, t) => { const v = 0.3 + 0.25 * Math.sin(t * 4.5); pulse.forEach(q => { q.emissiveIntensity = v; }); });

    // баночки с краской — кисти отделов; ластик
    const row = [...depts.map(q => ({ key: 'd-' + q.k, c: hex(q.c), n: q.n, on: d.brush === q.k })), { key: 'erase', n: 'Ластик', on: d.brush === 'erase', erase: true }];
    const X0 = -51, DX = 16, JZ = 34;
    at(box(116, 1, 13, kit.C.WOOD2), X0 + DX * 3, 0.5, JZ);
    row.forEach((q, i) => {
      const g = new T.Group(); at(g, X0 + i * DX, 1, JZ); clickable(g, q.key);
      if (q.erase) {
        const er = new T.Group(); at(er, 0, 0, 0, g); if (q.on) { er.position.y = 3; er.rotation.z = 0.35; }
        at(box(7, 2.6, 4, 0xf2a0b4), 0, 1.3, 0, er); at(box(3.4, 2.7, 4.1, 0x3b6fd8, { edges: false }), 1.8, 1.3, 0, er);
      } else {
        at(cyl(3.6, 6, GLASS, { edges: false, matOpt: { transparent: true, opacity: 0.45 } }), 0, 3, 0, g);
        at(cyl(3.3, 3.8, q.c, { edges: false, hull: false, matOpt: q.on ? { emissive: q.c, emissiveIntensity: 0.4 } : {} }), 0, 2, 0, g);
        at(cyl(3.75, 0.6, 0x5d6677, { edges: false }), 0, 6.1, 0, g);
        // кисть торчит из выбранной баночки
        if (q.on) {
          const br = new T.Group(); at(br, 0.6, 3, 0.4, g); br.rotation.z = -0.18; br.rotation.x = 0.12;
          at(cyl(0.45, 13, 0xc98f55, { edges: false }), 0, 7, 0, br); at(cyl(0.55, 1.6, STEEL, { edges: false }), 0, 0.2, 0, br);
          at(cyl(0.5, 2.4, q.c, { edges: false, hull: false, r2: 0.2 }), 0, -1.6, 0, br);
        }
      }
      const pl = textPlate(kit, q.n, 11, 2.2, '#1b1610', q.on ? '#ffd166' : '#f7f3ea'); pl.rotation.x = -0.5; at(pl, 0, 0.9, 5.6, g);
    });
    // трубчатая кость в разрезе на подставке
    { const g = new T.Group(); at(g, 46, 0, -18); g.rotation.y = -0.5;
      at(box(30, 1.6, 9, kit.C.WOOD2), 0, 0.8, 0, g);
      [-10, 10].forEach(x => at(box(1.4, 3, 1.4, IRON, { edges: false }), x, 3, 0, g));
      const cut = new T.Group(); at(cut, 0, 6, 0, g); cut.rotation.z = Math.PI / 2;
      const half = (r, L, col, z) => { const m = kit.mesh(new T.CylinderGeometry(r, r, L, 24, 1, false, 0, Math.PI), 0, { mat: mat(kit, col), edges: false }); m.rotation.y = Math.PI / 2; at(m, 0, 0, z, cut); return m; };
      half(2.4, 20, IVORY, 0); half(1.5, 15, 0xe9d84f, 0.05);
      [-1, 1].forEach(s => { const e = kit.mesh(new T.SphereGeometry(3.3, 20, 12, 0, Math.PI), 0, { mat: mat(kit, 0xffc27a), edges: false }); e.rotation.y = Math.PI / 2; at(e, 0, s * 10.6, 0.06, cut);
        const cap = kit.mesh(new T.SphereGeometry(3.4, 20, 12, 0, Math.PI, 0, Math.PI / 2.2), 0, { mat: mat(kit, CART), edges: false }); cap.rotation.y = Math.PI / 2; if (s < 0) cap.rotation.x = Math.PI; at(cap, 0, s * 10.9, 0, cut); });
      const peri = kit.mesh(new T.CylinderGeometry(2.55, 2.55, 18, 24, 1, true, Math.PI, Math.PI), 0, { mat: mat(kit, GREEN, { transparent: true, opacity: 0.55 }), edges: false }); peri.rotation.y = Math.PI / 2; at(peri, 0, 0, 0, cut); }

    // подписи
    const brushName = d.brush === 'erase' ? 'ластик' : d.brush && dc[d.brush] ? dc[d.brush].n.toLowerCase() : 'не выбрана';
    kit.tag(v3(X0 + DX * 3, 12, JZ + 2), 'Кисть', brushName, !!d.brush && d.brush !== 'erase');
    kit.tag(v3(SX, 126, SZ), 'Скелет', d.placed === bones.length ? `верно ${d.right} из ${bones.length}` : `раскрашено ${d.placed} из ${bones.length}`, d.placed === bones.length && d.right === bones.length);
    kit.tag(v3(46, 12, -18), 'Кость в разрезе', 'хрящ · губчатое · мозг');
    if (d.sel >= 0 && bones[d.sel] && groups[bones[d.sel].id]) {
      const b = bones[d.sel], gg = groups[b.id].g; sk.updateMatrixWorld(true);
      const bb = new T.Box3().setFromObject(gg), c = bb.getCenter(new T.Vector3());
      kit.tag(v3(c.x + (c.x > SX ? 6 : -6), bb.max.y + 3, c.z + 4), b.n, b.p && dc[b.p] ? 'отдел: ' + dc[b.p].n.toLowerCase() : 'отдел не выбран', b.bad);
    }
  };

  // =====================================================================================
  // 2. Модель руки на штативе: плечевая кость, предплечье на шарнире-локте, бицепс и трицепс; гантели и весы
  SC['body-arm'] = (kit, d) => {
    const { T, at, box, cyl, clickable, v3 } = kit;
    const K = 130, EX = -6, EY = 56, AL = 0.33 * K, hold = d.mode !== 'push', mass = d.mass || 0;
    const P = q => v3(EX + q[0] * K, EY + q[1] * K, 0);
    const bm = mat(kit, IVORY), bmD = mat(kit, IVORY_D), cart = mat(kit, CART), tm = mat(kit, TENDON), chrome = mat(kit, STEEL);
    // штатив: тяжёлое основание, штанга, лапка держит плечевой сустав
    at(box(20, 2.4, 16, IRON), -38, 1.2, 0);
    kit.root.add(rodM(kit, v3(-38, 2.4, 0), v3(-38, 106, 0), 1, chrome, { hull: true }));
    at(box(4.4, 4, 4.4, IRON), -38, EY + 0.31 * K + 2, 0);
    kit.root.add(rodM(kit, v3(-38, EY + 0.31 * K + 2, 0), v3(-15, EY + 0.31 * K + 2, -2.4), 0.8, chrome));
    // лопатка и плечевая кость
    { const sh = new T.Shape(); sh.moveTo(-14, EY + 0.33 * K); sh.lineTo(-3.5, EY + 0.34 * K); sh.lineTo(-10, EY + 0.21 * K); sh.closePath();
      at(kit.mesh(new T.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }), 0, { mat: bmD, edges: false }), 0, 0, -3.2); }
    const hum = new T.Group(); at(hum, 0, 0, 0);
    longBone(kit, hum, P([0, 0.29]), P([0, 0.03]), 1.25, bm); ball(kit, 3.2, bm, EX, EY + 0.305 * K, -0.4, hum);
    [-1, 1].forEach(s => ball(kit, 1.3, bm, EX, EY + 0.02 * K, s * 1.4, hum));
    // локтевой сустав: хрящевой шарнир — нажать, чтобы разогнуть
    const elbow = new T.Group(); at(elbow, EX, EY, 0); clickable(elbow, 'unbend');
    { const hinge = kit.mesh(new T.CylinderGeometry(2.1, 2.1, 4.2, 20), 0, { mat: cart, edges: false }); hinge.rotation.x = Math.PI / 2; at(hinge, 0, 0, 0, elbow);
      const pin = kit.mesh(new T.CylinderGeometry(0.5, 0.5, 6, 10), 0, { mat: chrome, edges: false }); pin.rotation.x = Math.PI / 2; at(pin, 0, 0, 0, elbow); }
    // предплечье: поворачивается в локте; лучевая и локтевая кости, локтевой отросток, кисть
    const fore = new T.Group(); at(fore, EX, EY, 0); clickable(fore, 'bend');
    longBone(kit, fore, v3(0.8, 0.03 * K, 0.6), v3(0.8, -0.28 * K, 0.6), 0.75, bm);
    longBone(kit, fore, v3(-0.7, 0.03 * K, -0.6), v3(-0.7, -0.28 * K, -0.6), 0.65, bm);
    const olec = ball(kit, 1.5, bm, -0.9, 0.025 * K, -0.2, fore);
    { const palm = kit.mesh(new T.BoxGeometry(3.6, 0.095 * K, 3), 0, { mat: mat(kit, SKIN), edges: false }); at(palm, 0, -0.32 * K, 0, fore);
      const fist = kit.mesh(new T.SphereGeometry(2.4, 16, 12), 0, { mat: mat(kit, SKIN), edges: false }); at(fist, 1.2, -AL, 0, fore);
      at(kit.mesh(new T.SphereGeometry(1.6, 16, 12), 0, { mat: mat(kit, ORANGE, { emissive: ORANGE, emissiveIntensity: 0.3 }), edges: false }), -2.6, -AL + 1, 2.6, fore); }
    // гантель в кулаке
    let dumb = null;
    const dumbbell = (m, parent, x, y, z) => {
      const g = new T.Group(); at(g, x, y, z, parent);
      const r = 2 + 0.38 * m, w = 0.8 + 0.12 * m;
      const bar = kit.mesh(new T.CylinderGeometry(0.55, 0.55, 7 + 2 * w, 12), 0, { mat: chrome, edges: false }); bar.rotation.x = Math.PI / 2; at(bar, 0, 0, 0, g);
      [-1, 1].forEach(s => { const pl = cyl(r, w, 0x3a4256, { seg: 24 }); pl.rotation.x = Math.PI / 2; at(pl, 0, 0, s * (3.2 + w / 2), g); });
      const lb = textPlate(kit, m + ' кг', 3.2, 1.3, '#f7f3ea', '#3a4256'); at(lb, 0, 0, 3.2 + w + 0.06, g);
      return g;
    };
    if (hold && mass > 0) { dumb = dumbbell(mass, fore, 1.2, -AL, 0); clickable(dumb, 'mass'); }
    // мышцы: веретено брюшка между сухожилиями; цвет и свечение — от силы
    const muscle = (key) => {
      const m = mat(kit, MUSCLE, { emissive: 0xff2a1a, emissiveIntensity: 0 });
      const belly = kit.mesh(new T.SphereGeometry(1, 22, 14), 0, { mat: m, edges: false }); at(belly, 0, 0, 0); clickable(belly, key);
      const t1 = rodM(kit, v3(0, 0, 0), v3(0, 1, 0), 0.38, tm), t2 = rodM(kit, v3(0, 0, 0), v3(0, 1, 0), 0.38, tm); kit.root.add(t1); kit.root.add(t2);
      const Y1 = v3(0, 1, 0), dv = v3(0, 0, 0);
      const span = (o, a, b) => { dv.copy(b).sub(a); const L = dv.length(); o.visible = L > 0.05; if (!o.visible) return; o.position.copy(a).addScaledVector(dv, 0.5); o.scale.set(1, L, 1); o.quaternion.setFromUnitVectors(Y1, dv.normalize()); };
      return {
        m, set(A, B, c0, c1, F, z) {
          const a = A.clone().lerp(B, c0), b = A.clone().lerp(B, c1); a.z = b.z = z;
          span(t1, A, a); span(t2, b, B);
          const L = a.distanceTo(b), lsvg = A.distanceTo(B) * 440 / K, w = clamp(9 * 125 / lsvg, 6, 16) / 440 * K;
          belly.position.copy(a).lerp(b, 0.5); belly.scale.set(w, L / 2, w * 0.9);
          belly.quaternion.setFromUnitVectors(Y1, dv.copy(b).sub(a).normalize());
          const kk = clamp(F / 700, 0, 1);
          m.color.setHex(F > 0 ? MUSCLE_ON : MUSCLE); m.emissiveIntensity = F > 0 ? 0.12 + 0.4 * kk : 0;
        },
      };
    };
    const bic = muscle('biceps'), tri = muscle('triceps');
    // весы: на столе (режим «держать») или на подъёмном столике под кистью (режим «давить вниз»)
    const sc = new T.Group(); clickable(sc, 'mode');
    const jack = new T.Group(); at(jack, 0, 0, 0, sc);
    at(box(12, 1.6, 10, IRON), 0, 0.8, 0, jack);
    const col = cyl(1.2, 1, STEEL, { edges: false }); at(col, 0, 1.6, 0, jack);
    const top = new T.Group(); at(top, 0, 0, 0, sc);
    at(box(11, 1.2, 9, 0xe8ecf4), 0, 0.6, 0, top); at(box(10, 1.4, 8, 0xd9dfe9), 0, 1.9, 0, top);
    const scr = plane(kit, 5, 2, kit.keep(kit.textTex((hold ? 0 : mass) + ' кг', '#86e0a8', '#0e1520', 200, 80))); at(scr, 0, 1.4, 4.56, top);
    if (hold) { at(sc, 30, 0, 26); sc.rotation.y = -0.3; jack.visible = false; } else at(sc, EX + 1.2, 0, 0);
    // стойка с гантелями 1, 2, 5, 10 кг: нажать — взять в руку; табличка «0 кг» — пустая рука
    const rack = new T.Group(); at(rack, 34, 0, -4); rack.rotation.y = -0.45;
    at(box(34, 1.4, 10, kit.C.WOOD2), 0, 0.7, 0, rack);
    [1, 2, 5, 10].forEach((m, i) => {
      const x = -12 + i * 8.6, slot = new T.Group(); at(slot, x, 0, 0, rack); clickable(slot, 'm-' + m);
      [-3.2, 3.2].forEach(z => at(box(1.2, 4, 1.2, IRON, { edges: false }), 0, 3.4, z, slot));
      if (!(hold && m === mass)) dumbbell(m, slot, 0, 4.4 + 0.38 * m * 0.5, 0);
      const pl = textPlate(kit, m + ' кг', 5, 1.6, '#1b1610', m === mass ? '#ffd166' : '#f7f3ea'); pl.rotation.x = -0.6; at(pl, 0, 1.5, 5.2, slot);
    });
    { const z0 = new T.Group(); at(z0, -21, 0, 0, rack); clickable(z0, 'm-0'); const pl = textPlate(kit, '0 кг', 5, 2, '#1b1610', mass === 0 ? '#ffd166' : '#f7f3ea'); pl.rotation.x = -0.9; at(pl, 0, 1.6, 0, z0); }
    // подписи
    const bTag = liveTag(kit, v3(0, 0, 0), 'Бицепс', '…'), tTag = liveTag(kit, v3(0, 0, 0), 'Трицепс', '…'), eTag = liveTag(kit, v3(EX - 10, EY + 4, 4), 'Локоть', '…');
    const lTag = liveTag(kit, v3(0, 0, 0), hold ? (mass > 0 ? 'Гантель ' + mass + ' кг' : 'Пустая рука') : 'Весы', hold ? (mass > 0 ? 'вес ' + fr(mass * 9.8, 0) + ' Н' : 'гантели на стойке') : 'давит ' + mass + ' кг');
    kit.tag(v3(36, 14, -4), 'Гантели', 'нажмите — в руку');
    const hw = v3(0, 0, 0), ow = v3(0, 0, 0), iw = v3(0, 0, 0);
    let ac = clamp(live().angle || 170, 35, 180), acc = 1;
    const pose = dt => {
      const Lv = live(), tgt = clamp(Lv.angle || 170, 35, 180);
      ac = kit.reduce ? tgt : follow(ac, tgt, dt);
      const a = ac * Math.PI / 180, u = [Math.sin(a), Math.cos(a)];
      fore.rotation.z = Math.PI - a; fore.updateMatrixWorld(true);
      iw.set(0, -0.04 * K, 0.8).applyMatrix4(fore.matrixWorld);
      ow.copy(olec.position).applyMatrix4(fore.matrixWorld);
      hw.set(1.2, -AL, 0).applyMatrix4(fore.matrixWorld);
      bic.set(P([0.02, 0.29]), iw, 0.12, 0.8, Lv.Fb || 0, 1.4);
      tri.set(P([-0.025, 0.27]), ow, 0.1, 0.82, Lv.Ft || 0, -0.6);
      if (!hold) { const h = Math.max(4, hw.y - 2.4 - 3.2); col.scale.y = Math.max(0.1, h - 1.6); col.position.y = 1.6 + (h - 1.6) / 2; top.position.y = h; sc.position.x = hw.x; }
      const bm2 = P([0.03 + 0.5 * 0.02 * u[0], 0.16]);
      bTag.p.set(Math.max(bm2.x, EX) + 10, EY + 0.2 * K, 2);
      tTag.p.set(EX - 14, EY + 0.17 * K, -2);
      lTag.p.set(hw.x + (hold ? 6 : 10), hold ? hw.y - 4 - 0.38 * mass : hw.y - 4, 3);
      acc += dt;
      if (acc > 0.12) {
        acc = 0; const W = mass * 9.8, F = (Lv.Fb || 0) + (Lv.Ft || 0);
        bTag.set(Lv.Fb > 0 ? Math.round(Lv.Fb) + ' Н' + (W > 0 && hold ? ' · ×' + fr(F / W) : '') : 'отдых'); bTag.hot(Lv.Fb > 0);
        tTag.set(Lv.Ft > 0 ? Math.round(Lv.Ft) + ' Н' + (W > 0 && !hold ? ' · ×' + fr(F / W) : '') : 'отдых'); tTag.hot(Lv.Ft > 0);
        eTag.set(Math.round(Lv.angle || ac) + '°');
      }
    };
    pose(1); kit.onFrame(dt => pose(dt));
  };

  // =====================================================================================
  // 3а. Парта под рост: стул, стол, ученик-манекен (прозрачная рубашка, позвоночник), тетрадь, ростомер, аптечка
  SC['body-desk'] = (kit, d) => {
    const { T, at, box, cyl, clickable, v3 } = kit;
    const s = 0.72, XO = 36, H = d.H || 155, g = d.g || {};
    const W = (x, y, z = 0) => v3((x - XO) * s, y * s, z * s);
    const V = a => (a && a.length === 2 ? a : [0, 0]);
    const hip = V(g.hip), knee = V(g.knee), sh = V(g.sh), head = V(g.head), eye = V(g.eye), book = V(g.book), sole = g.sole || 0, hr = g.hr || 9;
    const okC = d.ok && d.ok.c, okD = d.ok && d.ok.d, okE = d.ok && d.ok.e;
    // стул: сиденье (нажать — выше), ножки, спинка
    const seatX0 = -10.5, seatX1 = 0.2 * H, ch = d.chair;
    const chair = new T.Group(); at(chair, 0, 0, 0); clickable(chair, 'chair');
    at(box((seatX1 - seatX0) * s, 2.4 * s, 38 * s, 0x56627d), (((seatX0 + seatX1) / 2) - XO) * s, (ch - 1.2) * s, 0, chair);
    [[seatX0 + 2, -16], [seatX0 + 2, 16], [seatX1 - 2, -16], [seatX1 - 2, 16]].forEach(([x, z]) => chair.add(rodM(kit, W(x, 0, z), W(x, ch - 2.4, z), 0.9 * s, mat(kit, 0x8a93a6))));
    const backH = 0.26 * H;
    [-16, 16].forEach(z => chair.add(rodM(kit, W(seatX0 + 1, ch, z), W(seatX0 - 1, ch + backH, z), 0.9 * s, mat(kit, 0x8a93a6))));
    { const bp = box(2 * s, 16 * s, 34 * s, 0x56627d); bp.rotation.z = 0.08; at(bp, (seatX0 - 0.6 - XO) * s, (ch + backH - 9) * s, 0, chair); }
    // стол: столешница (нажать — выше), боковины, тетрадь
    const dX = g.deskX || 32, dk = d.desk, D1 = dX + 55;
    const desk = new T.Group(); at(desk, 0, 0, 0); clickable(desk, 'desk');
    at(box(55 * s, 2.6 * s, 70 * s, 0xc98f55), ((dX + D1) / 2 - XO) * s, (dk - 1.3) * s, 0, desk);
    [-33, 33].forEach(z => { at(box(40 * s, 2.4 * s, 1.6 * s, 0x6b7894), ((dX + D1) / 2 + 4 - XO) * s, (dk - 6) * s, z * s, desk); desk.add(rodM(kit, W(D1 - 6, 0, z), W(D1 - 6, dk - 2.6, z), 1.1 * s, mat(kit, 0x6b7894))); desk.add(rodM(kit, W(dX + 12, 0, z), W(dX + 12, dk - 2.6, z), 1.1 * s, mat(kit, 0x6b7894))); });
    { const nb = new T.Group(); at(nb, (book[0] + 4 - XO) * s, dk * s, 0);
      at(box(21 * s, 0.6 * s, 15 * s, 0x3b6fd8), 0, 0.3 * s, 0, nb);
      const pg = plane(kit, 20 * s, 14 * s, canvasTex(kit, 256, 180, (x, w, h) => { x.fillStyle = '#f7f3ea'; x.fillRect(0, 0, w, h); x.strokeStyle = '#b9c8e6'; x.lineWidth = 2; for (let y = 24; y < h; y += 18) { x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); } x.strokeStyle = '#1b2537'; x.lineWidth = 2.5; for (let r = 0; r < 4; r++) { x.beginPath(); x.moveTo(16, 40 + r * 18); for (let q = 16; q < 200; q += 12) x.lineTo(q, 40 + r * 18 - (q % 24 ? 4 : 0)); x.stroke(); } }));
      pg.rotation.x = -Math.PI / 2; at(pg, 0, 0.65 * s, 0, nb); }
    // ученик: ноги, туловище в прозрачной рубашке, позвоночник, руки, шея, голова (нажать — дальше от тетради)
    const skin = mat(kit, SKIN), pants = mat(kit, PANTS), shoe = mat(kit, SHOE), shirt = mat(kit, SHIRT, { transparent: true, opacity: 0.42, depthWrite: false });
    const lr = 0.035 * H;
    const ankle = [knee[0] - 1, sole + 3.5];
    [-6, 6].forEach(z => {
      kit.root.add(rodM(kit, W(hip[0], hip[1], z), W(knee[0], knee[1], z), lr * s, pants));
      ball(kit, lr * s, pants, (knee[0] - XO) * s, knee[1] * s, z * s);
      kit.root.add(rodM(kit, W(knee[0], knee[1], z), W(ankle[0], ankle[1], z), lr * 0.8 * s, pants));
      at(box((0.12 * H + 8) * s, 4 * s, 9 * s, SHOE), (ankle[0] + 0.06 * H - XO) * s, (sole + 2) * s, z * s);
    });
    ball(kit, lr * 1.25 * s, pants, (hip[0] - XO) * s, hip[1] * s, 0, null, [1, 1, 1.6]);
    // туловище — эллиптическая капсула от таза до плеч
    { const a = W(hip[0], hip[1]), b = W(sh[0], sh[1]), dv = b.clone().sub(a), L = dv.length(), tr = new T.Group();
      tr.position.copy(a).addScaledVector(dv, 0.5); tr.quaternion.setFromUnitVectors(v3(0, 1, 0), dv.clone().normalize()); kit.root.add(tr);
      const cap = new T.Mesh(kit.keep(new T.CapsuleGeometry(0.065 * H * s, Math.max(0.1, L - 0.065 * H * s * 1.2), 6, 18)), shirt); cap.scale.z = 1.5; cap.renderOrder = 2; tr.add(cap); }
    // позвоночник: изгибы как на схеме; при сутулости грудной изгиб растёт и краснеет
    { const dx = sh[0] - hip[0], dy = sh[1] - hip[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux, bk = 0.035 * H;
      const K3 = 2.1, sl = g.slouch || 0, kyph = (4 + sl * 0.45) / K3, lord = Math.max(0, 5 - sl * 0.25) / K3;
      const Pp = (t, o) => [hip[0] + dx * t + nx * (bk + o), hip[1] + dy * t + ny * (bk + o)];
      const c = [Pp(0, 0), Pp(0.25, -lord), Pp(0.62, kyph), Pp(1, 0)];
      const bz = t => { const m = 1 - t; return [0, 1].map(j => m * m * m * c[0][j] + 3 * m * m * t * c[1][j] + 3 * m * t * t * c[2][j] + t * t * t * c[3][j]); };
      const bad = sl > 6, vm = mat(kit, bad ? 0xff8a73 : IVORY, bad ? { emissive: 0xff2a1a, emissiveIntensity: 0.25 } : {}), sp = new T.Group(); kit.root.add(sp); clickable(sp, 'spine');
      const N = 16;
      for (let i = 0; i < N; i++) {
        const t0 = i / N, t1 = (i + 0.72) / N, p0 = bz(t0), p1 = bz(t1);
        sp.add(rodM(kit, W(p0[0], p0[1]), W(p1[0], p1[1]), (1.9 - i * 0.05) * s, vm));
        const pq = bz((i + 0.86) / N); ball(kit, 1.1 * s, mat(kit, CART), (pq[0] - XO) * s, pq[1] * s, 0, sp);
      }
      if (bad) kit.tag(W(c[2][0] - 8, c[2][1], 0), 'Спина', 'сутулится', true); }
    // руки: плечо к локтю на столе, предплечье к тетради
    { const Lu = 0.18 * H, ey = dk + 2, ddy = sh[1] - ey;
      const elb = ddy < Lu ? [sh[0] + Math.sqrt(Math.max(0, Lu * Lu - ddy * ddy)) * 0.9, ey] : [sh[0] + 3, sh[1] - Lu];
      const hand = [book[0] - 4, ey];
      [-1, 1].forEach(sd => {
        const zs = sd * 0.1 * H, ze = sd * 0.085 * H, zh = sd * 6;
        kit.root.add(rodM(kit, W(sh[0], sh[1], zs), W(elb[0], elb[1], ze), 0.025 * H * s, mat(kit, 0x3f5f8f)));
        ball(kit, 0.025 * H * s, mat(kit, 0x3f5f8f), (elb[0] - XO) * s, elb[1] * s, ze * s);
        kit.root.add(rodM(kit, W(elb[0], elb[1], ze), W(hand[0], hand[1], zh), 0.02 * H * s, skin));
        ball(kit, 0.024 * H * s, skin, (hand[0] - XO) * s, hand[1] * s, zh * s);
      });
      [-1, 1].forEach(sd => ball(kit, 0.03 * H * s, mat(kit, SHIRT), (sh[0] - XO) * s, sh[1] * s, sd * 0.1 * H * s)); }
    // шея и голова
    kit.root.add(rodM(kit, W(sh[0], sh[1]), W(head[0], head[1]), hr * 0.35 * s, skin));
    const hd = new T.Group(); at(hd, (head[0] - XO) * s, head[1] * s, 0); clickable(hd, 'eye');
    ball(kit, hr * s, skin, 0, 0, 0, hd, [1, 1.08, 0.92]);
    { const hair = kit.mesh(new T.SphereGeometry(hr * 1.06 * s, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), 0, { mat: mat(kit, HAIR), edges: false }); hair.rotation.z = 0.5; at(hair, -0.5 * s, 0.6 * s, 0, hd); }
    { const ex = eye[0] - head[0], ey2 = eye[1] - head[1], el = Math.hypot(ex, ey2) || 1, f = Math.sqrt(Math.max(1, hr * hr * 0.9 - 9)) / el;
      [-1, 1].forEach(sd => ball(kit, 0.9 * s, mat(kit, 0x1b1610), ex * f * s, ey2 * f * s, sd * 3 * s, hd)); }
    // линия взгляда до тетради
    dashed(kit, W(eye[0], eye[1], 0), W(book[0] + 4, dk + 0.8, 0), okE ? 0x86e0a8 : 0xff8a73);
    // ростомер у стены: нажать — другой рост ученика
    { const rg = new T.Group(); at(rg, -62, 0, -26); clickable(rg, 'height');
      at(box(14, 1.6, 10, kit.C.WOOD2), 0, 0.8, 0, rg);
      const Hs = 180 * s, tex = canvasTex(kit, 96, 1024, (x, w, h) => { x.fillStyle = '#f1e3c2'; x.fillRect(0, 0, w, h); x.strokeStyle = '#3b3320'; x.fillStyle = '#3b3320'; x.font = '700 30px "IBM Plex Mono", monospace'; x.textAlign = 'right';
        for (let c = 0; c <= 180; c += 5) { const y = h - c / 180 * h; x.lineWidth = c % 10 ? 2 : 4; x.beginPath(); x.moveTo(0, y); x.lineTo(c % 10 ? 22 : 40, y); x.stroke(); if (c % 20 === 0 && c) x.fillText(String(c), w - 6, y + 10); } });
      at(box(6, Hs, 1.4, 0xf1e3c2), 0, Hs / 2 + 1.6, 0, rg);
      const face = plane(kit, 5.6, Hs, tex); at(face, 0, Hs / 2 + 1.6, 0.72, rg);
      at(box(9, 0.9, 7, ORANGE, { edges: false, matOpt: { emissive: ORANGE, emissiveIntensity: 0.4 } }), 1.5, H * s + 1.6, 3, rg);
      kit.tag(v3(-62, H * s + 6, -23), 'Рост', H + ' см'); }
    // аптечка — перейти к травмам
    { const ak = new T.Group(); at(ak, 54, 0, 36); ak.rotation.y = -0.4; clickable(ak, 'v-inj');
      at(box(16, 9, 9, 0xf4f6fa), 0, 4.5, 0, ak);
      at(box(8, 2.4, 0.4, 0xe0473a, { edges: false }), 0, 4.8, 4.6, ak); at(box(2.4, 8, 0.4, 0xe0473a, { edges: false }), 0, 4.8, 4.6, ak);
      at(box(7, 1, 2, 0x5d6677), 0, 9.5, 0, ak);
      kit.tag(v3(54, 14, 36), 'Аптечка', 'травмы →'); }
    // подписи
    kit.tag(W(seatX1 + 6, ch, 22), 'Стул', ch + ' см · ' + (okC ? 'ok' : d.lowC ? 'низко' : 'высоко'), !okC);
    kit.tag(W(D1 - 4, dk + 2, 34), 'Стол', dk + ' см · ' + (okD ? 'ok' : d.lowD ? 'низко' : 'высоко'), !okD);
    kit.tag(W((eye[0] + book[0]) / 2 + 6, (eye[1] + dk) / 2 + 6, 0), 'Глаза — тетрадь', d.eye + ' см', !okE);
    if ((g.raise || 0) > 2) kit.tag(W(head[0], head[1] + hr + 8, 0), 'Плечи', 'подняты', true);
  };

  // =====================================================================================
  // 3б. Тренажёр первой помощи: 4 карточки травм на подставках, 6 подносов с помощью (шина, бинт, косынка, холод…)
  SC['body-aid'] = (kit, d) => {
    const { T, at, box, cyl, clickable, v3 } = kit;
    const inj = d.injs || [], aids = d.aids || [], all = !!d.all, cur = d.inj;
    // карточки травм
    inj.forEach((q, i) => {
      const x = -48 + i * 32, sel = cur === i, frame = sel ? '#ffb547' : all ? (q.ok ? '#86e0a8' : '#ff8a73') : '#3a4762';
      const g = new T.Group(); at(g, x, 0, -24); clickable(g, 'inj' + i);
      at(box(26, 1.6, 7, kit.C.WOOD2), 0, 0.8, 0, g);
      const board = new T.Group(); at(board, 0, sel ? 3 : 1.6, -1, g); board.rotation.x = -0.22;
      at(box(27, 22, 1, sel ? ORANGE : 0x2a3550), 0, 11, 0, board);
      const tex = canvasTex(kit, 512, 416, (x2, w, h) => {
        x2.fillStyle = '#f7f3ea'; x2.fillRect(0, 0, w, h); x2.strokeStyle = frame; x2.lineWidth = 18; x2.strokeRect(9, 9, w - 18, h - 18);
        x2.fillStyle = '#e0473a'; x2.fillRect(34, 34, 40, 12); x2.fillRect(48, 20, 12, 40);
        x2.fillStyle = '#1b1610'; x2.font = '700 40px "Golos Text", sans-serif';
        const nm = wrapText(x2, q.n, w - 120); nm.forEach((l, k) => x2.fillText(l, 90, 58 + k * 44));
        x2.fillStyle = '#4a5468'; x2.font = '500 30px "Golos Text", sans-serif';
        wrapText(x2, q.s, w - 70).slice(0, 5).forEach((l, k) => x2.fillText(l, 34, 58 + nm.length * 44 + 30 + k * 36));
        if (q.a) { x2.fillStyle = all ? (q.ok ? '#2f9e5a' : '#d9442e') : '#2b6d7c'; x2.beginPath(); x2.arc(w - 60, h - 60, 36, 0, 7); x2.fill(); x2.fillStyle = '#fff'; x2.font = '700 44px "Golos Text", sans-serif'; x2.textAlign = 'center'; x2.fillText(q.a, w - 60, h - 45); }
      });
      const face = plane(kit, 25, 20, tex); at(face, 0, 11, 0.52, board);
    });
    // подносы с первой помощью
    const used = cur >= 0 && inj[cur] ? inj[cur].j : -1;
    aids.forEach((q, k) => {
      const x = -38 + (k % 3) * 38, z = 8 + Math.floor(k / 3) * 26, on = used === q.j;
      const g = new T.Group(); at(g, x, 0, z); clickable(g, 'aid' + q.j);
      at(box(34, 1.2, 22, on ? 0x2b6d7c : 0x3a4762), 0, 0.6, 0, g);
      if (on) at(box(35, 0.4, 23, CYAN, { edges: false, matOpt: { emissive: CYAN, emissiveIntensity: 0.5 } }), 0, 0.2, 0, g);
      const tex = canvasTex(kit, 384, 384, (x2, w, h) => {
        x2.fillStyle = on ? '#e3f6fb' : '#f7f3ea'; x2.fillRect(0, 0, w, h);
        x2.fillStyle = '#2b6d7c'; x2.font = '700 72px "Golos Text", sans-serif'; x2.fillText(q.L, 24, 80);
        x2.fillStyle = '#1b1610'; x2.font = '500 33px "Golos Text", sans-serif';
        wrapText(x2, q.t, w - 44).slice(0, 7).forEach((l, i) => x2.fillText(l, 24, 136 + i * 38));
      });
      const card = plane(kit, 15, 15, tex); card.rotation.x = -Math.PI / 2; at(card, -8, 1.3, 0, g);
      // предмет на подносе
      const it = new T.Group(); at(it, 8.5, 1.2, 0, g);
      const roll = (col, r = 2.2, L = 4.5, x2 = 0, z2 = 0) => { const c = cyl(r, L, col, { seg: 20 }); c.rotation.x = Math.PI / 2; at(c, x2, r, z2, it); };
      const ice = (x2, z2) => { at(box(6, 1.8, 4.5, 0x6fb6e8), x2, 0.9, z2, it); at(box(5, 0.4, 3.5, 0xd8f0ff, { edges: false }), x2, 1.9, z2, it); };
      const sling = (x2, z2) => { const sh = new T.Shape(); sh.moveTo(-5, 0); sh.lineTo(5, 0); sh.lineTo(0, 6); sh.closePath(); const m = kit.mesh(new T.ShapeGeometry(sh), 0, { mat: mat(kit, 0xf4f6fa), edges: false }); m.rotation.x = -Math.PI / 2; at(m, x2, 0.15, z2 + 3, it); };
      if (q.j === 0) { at(box(3, 0.8, 16, kit.C.WOOD), -2, 0.4, 0, it); at(box(3, 0.8, 16, kit.C.WOOD), 2, 0.4, 0, it); sling(4, -6); }
      else if (q.j === 1) { roll(0xf4f6fa, 2.2, 4.5, -3, -3); at(box(5, 0.5, 5, 0xffffff), 3, 0.25, 4, it); at(box(4, 0.3, 4, 0xf2c4c4, { edges: false }), 3, 0.6, 4, it); }
      else if (q.j === 2) { sling(0, -2); ice(2, 5); }
      else if (q.j === 3) { roll(0xe2c49a, 2.4, 5, -2.5, -3); ice(3, 4); }
      else if (q.j === 4) { const bowl = kit.mesh(new T.CylinderGeometry(5.5, 3.6, 3.4, 24, 1, true), 0, { mat: mat(kit, 0xb9c0cc), edges: false }); at(bowl, 0, 1.7, 0, it); at(cyl(5, 0.3, 0xff9a5a, { edges: false, hull: false, matOpt: { emissive: 0xff7a3a, emissiveIntensity: 0.3 } }), 0, 2.6, 0, it); }
      else { at(box(6, 2, 8, 0xe9dfc6), 0, 1, 0, it); }
    });
    // парта — вернуться к посадке
    { const g = new T.Group(); at(g, 62, 0, -2); g.rotation.y = -0.6; clickable(g, 'v-desk');
      at(box(10, 0.8, 7, 0xc98f55), 0, 9, 0, g); [[-4, -3], [4, -3], [-4, 3], [4, 3]].forEach(([x2, z2]) => at(box(0.6, 9, 0.6, 0x6b7894, { edges: false }), x2, 4.5, z2, g));
      at(box(5, 0.6, 5, 0x56627d), 0, 5, 7, g); [[-2, 5], [2, 5], [-2, 9], [2, 9]].forEach(([x2, z2]) => at(box(0.5, 5, 0.5, 0x8a93a6, { edges: false }), x2, 2.5, z2, g));
      kit.tag(v3(62, 14, -2), 'Парта', d.deskOk ? '✓ готова' : 'не готова', !d.deskOk); }
    // подписи
    const placed = inj.filter(q => q.a).length, right = inj.filter(q => q.ok).length;
    if (cur >= 0 && inj[cur]) kit.tag(v3(-48 + cur * 32, 30, -24), 'Травма ' + (cur + 1), used >= 0 ? 'помощь выбрана' : 'выберите поднос', true);
    kit.tag(v3(0, 6, 46), 'Первая помощь', all ? `верно ${right} из ${inj.length}` : `выбрано ${placed} из ${inj.length}`, all && right === inj.length);
  };
})();
