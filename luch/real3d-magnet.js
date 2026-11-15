// «Как в жизни» для темы «Магнитное поле» (labs/phys-magnet): полосовой магнит с компасом и опилками,
// опыт Эрстеда (провод сквозь картон), электромагнит со скрепками, модель электродвигателя.
// Сцены строятся из window.LUCH_REAL() опыта; набор деталей kit — из /luch/real3d.js.
(() => {
  const SC = (window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {});
  const RED = 0xe0473a, BLUE = 0x2f6fd8, GREY = 0x9aa3b2, COPPER = 0xd98a4e, IRON = 0x7d8696, PAPER = 0xf4efe2, CARD = 0xd9c49a, PLAST = 0x3b4a66, CLIP = 0xc3cbd8;
  const mem = {}; // углы стрелок между перестройками сцены — стрелка доворачивается, а не прыгает
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const hash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };

  // ---------- текстуры (общие, живут всю сессию) ----------
  let faceT = null, dashT = null;
  function faceTex(T) {
    if (faceT) return faceT;
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    x.fillStyle = '#f7f3ea'; x.beginPath(); x.arc(128, 128, 126, 0, 7); x.fill();
    x.strokeStyle = '#1b1610'; x.lineCap = 'round';
    for (let k = 0; k < 36; k++) {
      const a = k / 36 * Math.PI * 2, l = k % 9 === 0 ? 22 : k % 3 === 0 ? 14 : 8;
      x.lineWidth = k % 9 === 0 ? 5 : 2.5; x.beginPath(); x.moveTo(128 + Math.sin(a) * 120, 128 - Math.cos(a) * 120); x.lineTo(128 + Math.sin(a) * (120 - l), 128 - Math.cos(a) * (120 - l)); x.stroke();
    }
    x.font = '700 34px "Golos Text", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    [['С', 0, '#c0392b'], ['В', 90, '#1b1610'], ['Ю', 180, '#1b1610'], ['З', 270, '#1b1610']].forEach(([t, d, col]) => {
      const a = d * Math.PI / 180; x.fillStyle = col; x.fillText(t, 128 + Math.sin(a) * 80, 130 - Math.cos(a) * 80);
    });
    faceT = new T.CanvasTexture(c); faceT.colorSpace = T.SRGBColorSpace; return faceT;
  }
  function dashTex(T) {
    if (dashT) return dashT;
    const c = document.createElement('canvas'); c.width = 64; c.height = 8; const x = c.getContext('2d');
    x.fillStyle = '#ffd166'; x.fillRect(8, 0, 16, 8);
    dashT = new T.CanvasTexture(c); dashT.wrapS = T.RepeatWrapping; dashT.colorSpace = T.SRGBColorSpace; return dashT;
  }
  // табличка-буква (полюс магнита): квадрат с буквой, лежит в плоскости XY
  function letter(kit, txt, fg, bg, size) {
    const { T, keep } = kit;
    return new T.Mesh(keep(new T.PlaneGeometry(size, size)), keep(new T.MeshBasicMaterial({ map: keep(kit.textTex(txt, fg, bg, 128, 128)) })));
  }

  // ---------- провод по своим точкам, с бегущими огоньками тока (как kit.cable) ----------
  function flowWire(kit, pts, col, I, r = 0.95) {
    const { T, mesh, keep } = kit;
    const curve = new T.CatmullRomCurve3(pts, false, 'centripetal');
    const segs = Math.max(30, Math.round(curve.getLength() * 1.4));
    kit.root.add(mesh(new T.TubeGeometry(curve, segs, r, 10), col, { hull: true, edges: false }));
    if (I > 1e-6) {
      const tex = keep(dashTex(T).clone()); tex.needsUpdate = true; tex.repeat.set(Math.max(1, curve.getLength() / 12), 1);
      const sl = new T.Mesh(keep(new T.TubeGeometry(curve, segs, r * 1.08, 10)), keep(new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })));
      sl.renderOrder = 2; kit.root.add(sl);
      const sp = Math.min(3.2, 0.5 + 2.2 * Math.sqrt(I));
      if (!kit.reduce) kit.onFrame(dt => { tex.offset.x -= sp * dt; });
    }
    return curve;
  }
  // огоньки тока, бегущие по кривой (обмотка, вертикальный провод)
  function runDots(kit, curve, n, speed, sign, parent, rad = 0.5) {
    const { T, keep } = kit;
    const geo = keep(new T.SphereGeometry(rad, 10, 8)), mat = keep(new T.MeshBasicMaterial({ color: 0xffd166 }));
    const ds = [];
    for (let i = 0; i < n; i++) { const m = new T.Mesh(geo, mat); m.renderOrder = 3; (parent || kit.root).add(m); ds.push(m); }
    const L = curve.getLength() || 1;
    let u0 = 0;
    const place = () => ds.forEach((m, i) => { let u = (u0 + i / n) % 1; if (u < 0) u += 1; m.position.copy(curve.getPointAt(sign > 0 ? u : 1 - u)); });
    place();
    if (!kit.reduce) kit.onFrame(dt => { u0 = (u0 + speed * dt / L) % 1; place(); });
  }

  // ---------- компас: латунный корпус, шкала, стрелка (красный конец — N), стекло ----------
  // a — угол стрелки на схеме опыта (x вправо, y вниз = к зрителю): N-конец смотрит в (cos a, 0, sin a)
  function compass(kit, R, a, key, stand) {
    const { T, at, cyl, mesh, keep, C } = kit;
    const g = new T.Group(), q = R / 5;
    let y0 = 0;
    if (stand) { // подставка: ножка-диск, стойка, чашка
      at(cyl(3.4, 0.9, C.DARK), 0, 0.45, 0, g);
      at(cyl(0.6, stand, C.STEEL, { edges: false }), 0, 0.9 + stand / 2, 0, g);
      at(cyl(2.3, 0.7, C.DARK), 0, stand + 1.2, 0, g);
      y0 = stand + 1.55;
    }
    const c = new T.Group(); at(c, 0, y0, 0, g); c.scale.setScalar(q);
    at(cyl(5.5, 1.8, C.BRASS, { seg: 40 }), 0, 0.9, 0, c);
    const face = new T.Mesh(keep(new T.CircleGeometry(4.95, 48)), keep(new T.MeshBasicMaterial({ map: faceTex(T) })));
    face.rotation.x = -Math.PI / 2; at(face, 0, 1.82, 0, c);
    at(cyl(0.28, 0.8, C.STEEL, { edges: false, hull: false }), 0, 2.2, 0, c);
    const nd = new T.Group(); at(nd, 0, 2.6, 0, c);
    const half = (sgn, col) => {
      const sh = new T.Shape(); sh.moveTo(sgn * 4.4, 0); sh.lineTo(0, 0.75); sh.lineTo(0, -0.75); sh.closePath();
      const m = mesh(new T.ExtrudeGeometry(sh, { depth: 0.32, bevelEnabled: false }), col, { edgeAngle: 20 });
      m.rotation.x = -Math.PI / 2; at(m, 0, -0.16, 0, nd);
    };
    half(1, RED); half(-1, 0xeef1f5);
    at(new T.Mesh(keep(new T.SphereGeometry(0.5, 14, 10)), kit.toon(C.BRASS)), 0, 0.25, 0, nd);
    at(cyl(5.05, 0.12, 0xdff2fb, { matOpt: { transparent: true, opacity: 0.18, depthWrite: false }, edges: false, hull: false, shadow: false }), 0, 3.35, 0, c);
    const rim = mesh(new T.TorusGeometry(5.25, 0.38, 8, 48), C.BRASS, { edges: false }); rim.rotation.x = Math.PI / 2; at(rim, 0, 3.35, 0, c);
    // плавный поворот стрелки к нужному углу (с небольшим качанием, как у настоящей)
    const st = mem[key] || (mem[key] = { a, v: 0 });
    nd.rotation.y = -st.a;
    kit.onFrame(dt => {
      if (kit.reduce) { st.a = a; st.v = 0; }
      else { st.v += (wrap(a - st.a) * 26 - st.v * 4.2) * dt; st.a += st.v * dt; }
      nd.rotation.y = -st.a;
    });
    g.userData.top = y0 + 3.7 * q;
    return g;
  }

  // скрепка: стальная проволока «стадионом», плоскость XY
  function clipGeo(T) {
    const pts = [], w = 0.62, h = 1.55;
    for (let k = 0; k < 24; k++) { const t = k / 24 * Math.PI * 2, s = Math.sin(t); pts.push(new T.Vector3(w * Math.cos(t), (h - w) * Math.sign(s) + w * s, 0)); }
    return new T.TubeGeometry(new T.CatmullRomCurve3(pts, true), 48, 0.13, 6, true);
  }
  // стрелка-сила или стрелка поля: стержень + конус, смотрит по +y
  function arrow(kit, len, col, r = 0.45) {
    const { T, at, cyl } = kit;
    const g = new T.Group(), o = { edges: false, matOpt: { emissive: col, emissiveIntensity: 0.35 } };
    at(cyl(r, len, col, o), 0, len / 2, 0, g);
    at(cyl(r * 2.6, r * 5.5, col, { ...o, r2: 0.01 }), 0, len + r * 2.75, 0, g);
    return g;
  }
  // последняя созданная подпись (чтобы обновлять её значение каждый кадр, не перестраивая сцену)
  const lastTag = () => { const l = document.querySelectorAll('.rl-view .rl-lbl'); return l[l.length - 1] || null; };

  // =====================================================================================
  // 1. Постоянные магниты: полосовой магнит на листе бумаги, компас на подставке, банка с опилками
  SC['magnet-perm'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, v3, C } = kit;
    const s = 0.34, X = x => (x - 260) * s, Z = y => (y - 205) * s;
    at(box(118, 0.3, 86, PAPER), 0, 0.15, 0);
    // поле магнита — как в опыте: два «заряда» у концов, ось y схемы вниз = к зрителю
    const qx = [260 + d.n * 66, 260 - d.n * 66];
    const B = (x, y) => { let bx = 0, by = 0; [1, -1].forEach((q, i) => { const dx = x - qx[i], dy = y - 205, d2 = dx * dx + dy * dy + 30, d3 = d2 * Math.sqrt(d2); bx += q * dx / d3; by += q * dy / d3; }); return [bx, by]; };
    // полосовой магнит: две половины; маркировка стёрта, пока ученик не ответил верно
    const hl = 80 * s, dep = 36 * s, hgt = 5.6, yb = 0.3 + hgt / 2;
    const nRight = d.n > 0;
    [-1, 1].forEach(side => {
      const isN = (side > 0) === nRight, col = d.ok ? (isN ? RED : BLUE) : GREY;
      const h = at(box(hl, hgt, dep, col), side * hl / 2, yb, 0); clickable(h, side < 0 ? 'ansL' : 'ansR');
      const lt = letter(kit, d.ok ? (isN ? 'N' : 'S') : '?', d.ok ? '#ffffff' : '#2c3240', d.ok ? (isN ? '#e0473a' : '#2f6fd8') : '#9aa3b2', 6.4);
      lt.rotation.x = -Math.PI / 2; at(lt, side * hl * 0.55, yb + hgt / 2 + 0.03, 0);
    });
    at(box(hl * 2 - 3, 0.12, 0.6, 0xffffff, { edges: false, shadow: false, matOpt: { transparent: true, opacity: 0.35 } }), 0, yb + hgt / 2 + 0.07, -dep / 2 + 1.1);
    // железные опилки на бумаге: выстраиваются вдоль линий поля, гуще у полюсов
    if (d.fil) {
      const geo = keep(new T.BoxGeometry(1.45, 0.2, 0.26)), pts = [];
      for (let i = 0, x = 6; x <= 514; x += 8.5, i++) for (let j = 0, y = 46; y <= 388; y += 8.5, j++) {
        const px = x + (hash(i, j) - 0.5) * 6, py = y + (hash(j, i) - 0.5) * 6;
        if (Math.abs(px - 260) < 86 && Math.abs(py - 205) < 24 || Math.abs(X(px)) > 58 || Math.abs(Z(py)) > 42) continue;
        const [bx, by] = B(px, py), b = Math.hypot(bx, by); if (!b) continue;
        const op = clamp(0.25 + 0.22 * Math.log10(b / 2e-6), 0.1, 0.95);
        if (hash(i + 7, j + 3) > op) continue;
        pts.push([X(px), Z(py), Math.atan2(by, bx), 0.6 + 0.6 * op]);
      }
      const im = new T.InstancedMesh(geo, kit.toon(0x3a3f4c), pts.length), o = new T.Object3D();
      pts.forEach((p, k) => { o.position.set(p[0], 0.42, p[1]); o.rotation.set(0, -p[2], 0); o.scale.set(p[3], 1, 1); o.updateMatrix(); im.setMatrixAt(k, o.matrix); });
      im.instanceMatrix.needsUpdate = true; im.receiveShadow = true; at(im, 0, 0, 0);
    }
    // магнитные линии: от N к S, со стрелками
    if (d.lines) {
      const lm = keep(new T.MeshBasicMaterial({ color: 0x2aa7c9 })), cg = keep(new T.ConeGeometry(0.7, 1.8, 10));
      for (let i = 0; i < 16; i++) {
        const a = (i + 0.5) / 16 * 2 * Math.PI;
        let x = qx[0] + 5 * Math.cos(a), y = 205 + 5 * Math.sin(a);
        const P = [v3(X(x), 0.75, Z(y))];
        for (let k = 1; k < 900; k++) {
          const [bx, by] = B(x, y), b = Math.hypot(bx, by) || 1;
          x += 3 * bx / b; y += 3 * by / b;
          if (Math.abs(X(x)) > 57 || Math.abs(Z(y)) > 41.5) break;
          if (k % 3 === 0) P.push(v3(X(x), 0.75, Z(y)));
          if (Math.hypot(x - qx[1], y - 205) < 5) break;
        }
        if (P.length < 4) continue;
        const cur = new T.CatmullRomCurve3(P);
        at(new T.Mesh(keep(new T.TubeGeometry(cur, P.length * 2, 0.22, 6)), lm), 0, 0, 0);
        for (const f of [0.3, 0.7]) {
          const p = cur.getPointAt(f), t = cur.getTangentAt(f);
          if (Math.abs(p.x) < hl + 1 && Math.abs(p.z) < dep / 2 + 1) continue;
          const cn = new T.Mesh(cg, lm); cn.position.copy(p); cn.quaternion.setFromUnitVectors(v3(0, 1, 0), t); kit.root.add(cn);
        }
      }
    }
    // компас на подставке
    const ccx = clamp(X(d.cx), -52, 52), ccz = clamp(Z(d.cy), -36, 38);
    const cp = compass(kit, 6.2, d.a, 'perm', 1.2); at(cp, ccx, 0.3, ccz); clickable(cp, 'cmove');
    // банка с опилками (солонка)
    const jar = new T.Group(); at(jar, -50, 0, -34); clickable(jar, 'fil');
    at(cyl(3.4, 8, 0xdff2fb, { matOpt: { transparent: true, opacity: 0.35, depthWrite: false } }), 0, 4, 0, jar);
    at(cyl(3.0, 4.2, 0x4a4f5c, { edges: false, hull: false }), 0, 2.2, 0, jar);
    at(cyl(3.6, 1.6, C.STEEL), 0, 8.8, 0, jar);
    for (let k = 0; k < 6; k++) at(cyl(0.35, 0.1, C.DARK, { edges: false, hull: false }), Math.cos(k) * 1.8, 9.65, Math.sin(k) * 1.8, jar);
    // север
    const nm = arrow(kit, 9, 0x3fae5a, 0.45); nm.rotation.x = -Math.PI / 2; at(nm, 50, 0.8, 34);
    const nl = letter(kit, 'С', '#ffffff', '#3fae5a', 4); nl.rotation.x = -Math.PI / 2; at(nl, 50, 0.45, 38.5);
    tag(v3(0, 8, 0), 'Магнит', d.ok ? (nRight ? 'N справа' : 'N слева') : `слева ${d.visL ? '✓' : '—'} · справа ${d.visR ? '✓' : '—'}`, d.ok);
    tag(v3(ccx, cp.userData.top + 1.5, ccz), 'Компас', d.ntxt);
    tag(v3(-50, 12, -34), 'Опилки', d.fil ? 'убрать' : 'насыпать');
  };

  // =====================================================================================
  // 2. Опыт Эрстеда: вертикальный провод сквозь горизонтальный картон, компас на картоне, источник, ключ
  SC['magnet-wire'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, v3, supply, knife, placeOn, cable, C } = kit;
    const k = 2.2, bx = 10, bz = -2, by = 10, run = d.on && d.I > 0, Iw = run ? d.I : 0;
    // основание-планка, ножки, картон
    at(box(16, 2.4, 60, C.WOOD2), bx, 1.2, bz + 17);
    [Math.PI / 6, Math.PI * 5 / 6, Math.PI * 1.5].forEach(a => {
      const lx = bx + Math.cos(a) * 31, lz = bz + Math.sin(a) * 31;
      at(cyl(2, 0.8, C.DARK), lx, 0.4, lz); at(cyl(0.6, by - 0.6, C.STEEL, { edges: false }), lx, by / 2, lz);
    });
    const board = at(cyl(37.5, 0.6, CARD, { seg: 80 }), bx, by, bz); clickable(board, 'fil');
    const yt = by + 0.3;
    const ringM = keep(new T.MeshBasicMaterial({ color: 0x8a6f45, transparent: true, opacity: 0.55 }));
    [4, 8, 12, 16].forEach(r => {
      const rg = new T.Mesh(keep(new T.RingGeometry(r * k - 0.14, r * k + 0.14, 80)), ringM); rg.rotation.x = -Math.PI / 2; at(rg, bx, yt + 0.02, bz);
      const lt = letter(kit, r + ' см', '#6b5433', '#d9c49a', 3.4); lt.scale.set(1.4, 0.7, 1); lt.rotation.x = -Math.PI / 2; at(lt, bx + r * k * 0.72 + 1.6, yt + 0.03, bz + r * k * 0.72 + 1.2);
    });
    // север на картоне
    const nm = arrow(kit, 5, 0x3fae5a, 0.32); nm.rotation.x = -Math.PI / 2; at(nm, bx, yt + 0.3, bz - 29.5);
    const nl = letter(kit, 'С', '#ffffff', '#3fae5a', 2.8); nl.rotation.x = -Math.PI / 2; at(nl, bx + 3.4, yt + 0.05, bz - 28.5);
    // провод: медный стержень от планки сквозь картон вверх, клеммы снизу (на планке) и сверху
    const wy0 = 2.4, wy1 = 36;
    at(cyl(0.8, wy1 - wy0, COPPER), bx, (wy0 + wy1) / 2, bz);
    const ws = at(cyl(1.6, 1.2, C.DARK), bx, yt + 0.6, bz); clickable(ws, 'wire');
    const wclick = at(cyl(2.2, wy1 - wy0, 0xffffff, { edges: false, hull: false, shadow: false, matOpt: { transparent: true, opacity: 0, depthWrite: false } }), bx, (wy0 + wy1) / 2, bz); clickable(wclick, 'wire');
    at(cyl(1.3, 2.4, C.BRASS), bx, wy1 + 1.2, bz); at(cyl(1.8, 0.9, C.STEEL, { seg: 6 }), bx, wy1 + 0.2, bz);
    const top = v3(bx, wy1 + 2.4, bz);
    at(box(1.8, 0.35, 42, COPPER), bx, wy0 + 0.17, bz + 21);
    const bg = new T.Group(); at(bg, bx, 0, bz + 42);
    const botP = kit.post(bg, 0, 0, wy0).clone().add(v3(bx, 0, bz + 42)); // нижняя клемма на планке
    // ток по проводу: огоньки вверх (ток «к нам» — вид сверху) или вниз
    if (run) runDots(kit, new T.LineCurve3(v3(bx, wy0 + 0.5, bz), v3(bx, wy1 - 0.5, bz)), 6, 8 + 7 * Math.sqrt(d.I), d.dir, null, 0.55);
    // магнитные линии вокруг провода — окружность со стрелками (правило буравчика)
    if (run) {
      const lm = keep(new T.MeshBasicMaterial({ color: 0x2aa7c9 }));
      const rr = 6 * k, ring = new T.Mesh(keep(new T.TorusGeometry(rr, 0.2, 6, 96)), lm); ring.rotation.x = Math.PI / 2; at(ring, bx, yt + 0.5, bz);
      for (let i = 0; i < 4; i++) {
        const th = i * Math.PI / 2 + Math.PI / 4, px = bx + rr * Math.cos(th), pz = bz + rr * Math.sin(th);
        const t = v3(d.dir * Math.sin(th), 0, -d.dir * Math.cos(th));
        const cn = new T.Mesh(keep(new T.ConeGeometry(0.75, 2, 10)), lm); cn.position.set(px, yt + 0.5, pz); cn.quaternion.setFromUnitVectors(v3(0, 1, 0), t); kit.root.add(cn);
      }
    }
    // опилки: без тока лежат как попало, с током выстраиваются кольцами
    if (d.fil) {
      const geo = keep(new T.BoxGeometry(1.1, 0.16, 0.22)), pts = [];
      if (run) {
        const rmax = clamp(Math.sqrt(d.I) * 5.5, 2, 15);
        for (let r = 1.6, i = 0; r <= 15.5; r += 0.55, i++) {
          const n = Math.round(r * 9), aligned = r <= rmax;
          for (let j = 0; j < n; j++) {
            const th = (j + hash(i, j)) / n * 2 * Math.PI, rr = (r + (hash(j, i) - 0.5) * 0.5) * k;
            const op = aligned ? clamp(0.95 - r / (rmax + 2), 0.25, 0.95) : 0.1;
            if (hash(i + 3, j + 5) > op + 0.15) continue;
            pts.push([bx + rr * Math.cos(th), bz + rr * Math.sin(th), aligned ? th + Math.PI / 2 : hash(j, i + 9) * 6.3]);
          }
        }
      } else for (let i = 0; i < 380; i++) {
        const r = (1.4 + 14.4 * Math.sqrt(hash(i, 1))) * k, th = hash(i, 2) * 6.3;
        pts.push([bx + r * Math.cos(th), bz + r * Math.sin(th), hash(i, 3) * 6.3]);
      }
      const im = new T.InstancedMesh(geo, kit.toon(0x3a3f4c), pts.length), o = new T.Object3D();
      pts.forEach((p, i) => { o.position.set(p[0], yt + 0.1, p[1]); o.rotation.set(0, -p[2], 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
      im.instanceMatrix.needsUpdate = true; at(im, 0, 0, 0);
    }
    // компас на картоне
    const cx = bx + d.x * k, cz = bz + d.y * k;
    const cp = compass(kit, 4, d.a, 'wire', 0); at(cp, cx, yt, cz); clickable(cp, 'ccycle');
    // источник тока и ключ
    const src = supply(d.I, 'А'); src.g.userData.click = 'icycle';
    const sN = placeOn(src, v3(-44, 0, -26), 0, 'src');
    const kn = knife({ closed: d.on, click: 'key' }); const kN = placeOn(kn, v3(-34, 0, 32), 0, 'key');
    const pP = sN.tout, pM = sN.tin;
    // маршрут к верхней клемме — над картоном, снаружи от его края
    const topRoute = P => [P, P.clone().add(v3(0, 6, 0)), v3(-27, 38, -23), v3(bx - 8, 43, bz - 5), v3(bx, 41.5, bz), top];
    const botRoute = K => [K, K.clone().add(v3(0, 3, 0)), v3(-14, 1.4, 48), v3(2, 1.4, 49), v3(bx, 9, botP.z + 2), botP];
    if (d.dir > 0) { // + → ключ → низ провода → вверх → верх → −
      cable(pP, kN.tin, C.WIRE.plus, Iw);
      flowWire(kit, botRoute(kN.tout), C.WIRE.mid, Iw);
      flowWire(kit, topRoute(pM).reverse(), C.WIRE.minus, Iw);
    } else {       // + → верх провода → вниз → низ → ключ → −
      flowWire(kit, topRoute(pP), C.WIRE.plus, Iw);
      flowWire(kit, botRoute(kN.tout).reverse(), C.WIRE.mid, Iw);
      cable(kN.tin, pM, C.WIRE.minus, Iw);
    }
    tag(v3(-44, 25, -26), 'Источник тока', 'I = ' + String(d.I).replace('.', ',') + ' А');
    tag(v3(-34, 12, 32), 'Ключ', d.on ? 'замкнут' : 'разомкнут');
    tag(v3(bx, wy1 + 4, bz), 'Провод', run ? (d.dir > 0 ? 'ток вверх ↑' : 'ток вниз ↓') : 'тока нет');
    tag(v3(cx, yt + 4.5, cz), 'Компас', d.atxt, d.ok);
  };

  // ---------- общая цепь урока 3 и 4: батарейка (переворачивается), ключ, реостат; концы — к прибору ----------
  // forward = ток идёт от левой клеммы батарейки в левый вход прибора (pL), из pR — через реостат и ключ обратно
  function circuit(kit, d, pL, pR, I, forward) {
    const { v3, cells, knife, rheostat, placeOn, cable, C } = kit;
    const bat = cells(2, 3); bat.g.userData.click = 'flip';
    const bN = placeOn(bat, v3(-34, 0, 36), forward ? Math.PI : 0, 'bat'); // «+» слева, когда ток идёт «вперёд»
    const bL = forward ? bN.tout : bN.tin, bR = forward ? bN.tin : bN.tout;
    const kN = placeOn(knife({ closed: d.on, click: 'key' }), v3(4, 0, 39), 0, 'key');
    const rN = placeOn(rheostat({ f: clamp(1 - d.I / 3.2, 0.05, 1), value: 'I = ' + String(d.I).replace('.', ',') + ' А', click: 'icycle' }), v3(36, 0, 36), Math.PI, 'rh');
    const seg = [[bL, pL, C.WIRE.plus], [pR, rN.tin, C.WIRE.mid], [rN.tout, kN.tout, C.WIRE.mid], [kN.tin, bR, C.WIRE.minus]];
    seg.forEach(([a, b, col], i) => {
      const c = forward ? col : (i === 0 ? C.WIRE.minus : i === 3 ? C.WIRE.plus : col);
      if (forward) cable(a, b, c, I); else cable(b, a, c, I);
    });
    kit.tag(v3(-34, 18, 36), 'Батарея', forward ? '«+» слева' : '«+» справа');
    kit.tag(v3(4, 11, 39), 'Ключ', d.on ? 'замкнут' : 'разомкнут');
    kit.tag(v3(36, 17, 36), 'Реостат', 'I = ' + String(d.I).replace('.', ',') + ' А');
  }

  // =====================================================================================
  // 3. Электромагнит: катушка на подставке, железный сердечник, скрепки, компас у правого торца
  SC['magnet-coil'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, v3, post, C } = kit;
    const run = d.on && d.I > 0, I = run ? d.I : 0;
    const g = new T.Group(); at(g, 0, 0, -8);
    const yc = 24, x0 = -18, x1 = 18, Rw = 6.2;
    at(box(46, 2.4, 22, C.WOOD2), 0, 1.2, 0, g);
    const hs = yc - 7.5 - 2.4; at(box(3, hs, 10, C.WOOD), x0 - 0.5, 2.4 + hs / 2, 0, g); at(box(3, hs, 10, C.WOOD), x1 + 0.5, 2.4 + hs / 2, 0, g);
    // каркас катушки и щёчки
    const tube = cyl(5.5, x1 - x0, CARD, { seg: 32 }); tube.rotation.z = Math.PI / 2; at(tube, 0, yc, 0, g);
    [[-1, 'ansL'], [1, 'ansR']].forEach(([sd, key]) => {
      const ch = at(box(1.2, 15, 15, PLAST), sd * (x1 + 0.6), yc, 0, g); clickable(ch, key);
      if (!d.core) { const h = cyl(3.7, 1.3, 0x161b26, { edges: false }); h.rotation.z = Math.PI / 2; at(h, sd * (x1 + 0.62), yc, 0, g); }
      if (d.ns) {
        const isN = (sd < 0) === (d.ns === 'L');
        const lt = letter(kit, isN ? 'N' : 'S', '#ffffff', isN ? '#e0473a' : '#2f6fd8', 3.6); at(lt, sd * (x1 + 0.6), yc + 4.6, 7.55, g);
      }
    });
    // обмотка: медная проволока спиралью, число витков на рисунке = N/10 (как на схеме)
    const nT = Math.max(3, Math.round(d.N / 10)), sp = (x1 - x0 - 0.8) / nT, wr = clamp(sp * 0.32, 0.25, 0.7);
    class Helix extends T.Curve { getPoint(t, o = new T.Vector3()) { const th = 2 * Math.PI * nT * t; return o.set(x0 + 0.4 + (x1 - x0 - 0.8) * t, yc + Rw * Math.sin(th), Rw * Math.cos(th)); } }
    const hx = new Helix();
    const wind = mesh(new T.TubeGeometry(hx, nT * 28, wr, 8), COPPER, { hull: true, edges: false }); at(wind, 0, 0, 0, g); clickable(wind, 'ncycle');
    if (run) runDots(kit, hx, Math.min(60, nT * 2), 18 + 10 * Math.sqrt(d.I), d.dir, g, wr + 0.25);
    // выводы обмотки к клеммам на подставке
    const tL = post(g, -13, 8, 2.4), tR = post(g, 13, 8, 2.4);
    const lead = (p, q) => at(mesh(new T.TubeGeometry(new T.CatmullRomCurve3([p, p.clone().add(v3(0, -2, 1.5)), v3(q.x * 0.9 + p.x * 0.1, 8, 7), q]), 30, 0.4, 6), COPPER, { hull: true, edges: false }), 0, 0, 0, g);
    lead(v3(x0 + 0.4, yc, Rw), tL); lead(v3(x1 - 0.4, yc, Rw), tR);
    // сердечник: в катушке или лежит на подставке спереди
    const core = new T.Group(); clickable(core, 'core');
    const cr = cyl(3.4, 56, IRON, { seg: 28 }); cr.rotation.z = Math.PI / 2; at(cr, 0, 0, 0, core);
    const cap = cyl(3.45, 0.5, 0x5a6272, { seg: 28, edges: false }); cap.rotation.z = Math.PI / 2; at(cap, 27.8, 0, 0, core);
    if (d.core) at(core, 0, yc, 0, g);
    else { at(core, 0, 3.6 + 3.4, -18, g); at(box(6, 3.6, 4, C.WOOD), -18, 1.8, -18, g); at(box(6, 3.6, 4, C.WOOD), 18, 1.8, -18, g); } // вынут: лежит за катушкой
    // скрепки: висят цепочками на торцах (сердечника или катушки), остальные — в лотке
    const cgeo = clipGeo(T);
    const n = d.clips | 0, CS = 1.35, yTop = d.core ? yc - 3.4 : yc - Rw - wr, ex = d.core ? 22.8 : 14.5;
    const cols = [[0, -2.2], [0, 2.2], [3, -2.2], [3, 2.2], [0, 0], [3, 0]];
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1, kk = i >> 1, col = Math.floor(kk / 4), row = kk % 4;
      const [dx, dz] = cols[col % 6];
      const m = mesh(cgeo, CLIP, { edges: false }); m.scale.setScalar(CS);
      m.rotation.y = row % 2 ? Math.PI / 2 : 0; m.rotation.z = (hash(i, 1) - 0.5) * 0.12;
      at(m, side * (ex + (d.core ? dx : dx * 0.4)), yTop - 1.95 - row * 3.6, dz * (d.core ? 1 : 0.6), g);
    }
    const tray = new T.Group(); at(tray, -46, 0, 4);
    at(box(16, 0.6, 14, 0x5d6a86), 0, 0.3, 0, tray);
    [[0, 7, 16, 1], [0, -7, 16, 1], [8, 0, 1, 14], [-8, 0, 1, 14]].forEach(([x, z, w, dd]) => at(box(w, 2, dd, 0x5d6a86), x, 1, z, tray));
    for (let i = 0; i < 40 - n; i++) {
      const m = mesh(cgeo, CLIP, { edges: false });
      m.scale.setScalar(1.35); m.rotation.set(-Math.PI / 2, 0, hash(i, 4) * 6.3); at(m, (hash(i, 5) - 0.5) * 12, 0.75 + (i % 3) * 0.28, (hash(i, 6) - 0.5) * 10, tray);
    }
    // компас на подставке у правого торца
    const cp = compass(kit, 4.4, d.a, 'coil', 17); at(cp, 44, 0, -8);
    circuit(kit, d, tL.clone().add(v3(0, 0, -8)), tR.clone().add(v3(0, 0, -8)), I, d.dir > 0);
    tag(v3(0, yc + 10, -8), 'Катушка', d.N + ' витков' + (d.core ? ' · сердечник' : ''));
    tag(v3(-46, 6, 4), 'Скрепки', n ? 'поднято ' + n : 'все в лотке', n >= 15);
  };

  // =====================================================================================
  // 4. Электродвигатель: рамка на оси между полюсами магнита, коллектор, щётки, батарейка, ключ, реостат
  SC['magnet-motor'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, v3, C } = kit;
    const SCL = 1.4, gz = -14, W = (x, y, z) => v3(x * SCL, y * SCL, z * SCL + gz);
    const g = new T.Group(); at(g, 0, 0, gz); g.scale.setScalar(SCL);
    const ya = 16, Rf = 9;
    // магнит: стальное основание и два полюса (красный N, синий S)
    const mg = new T.Group(); at(mg, 0, 0, 0, g); clickable(mg, 'pol');
    at(box(42, 3, 20, 0x5d6a86), 0, 1.5, 0, mg);
    [-1, 1].forEach(sd => {
      const isN = (sd < 0) === (d.pol > 0);
      at(box(8, 22, 20, isN ? RED : BLUE), sd * 17, 14, 0, mg);
      const lt = letter(kit, isN ? 'N' : 'S', '#ffffff', isN ? '#e0473a' : '#2f6fd8', 5.5); at(lt, sd * 17, 19, 10.03, mg);
      const lt2 = letter(kit, isN ? 'N' : 'S', '#ffffff', isN ? '#e0473a' : '#2f6fd8', 5.5); lt2.rotation.x = -Math.PI / 2; at(lt2, sd * 17, 25.03, 0, mg);
    });
    // стойки-подшипники и ось
    at(box(3.4, ya + 1.6, 2.4, C.WOOD2), 0, (ya + 1.6) / 2, -13, g); at(box(3.4, ya + 1.6, 2.4, C.WOOD2), 0, (ya + 1.6) / 2, 16.5, g);
    at(box(8, 1.2, 6, C.WOOD2), 0, 0.6, -13, g); at(box(8, 1.2, 6, C.WOOD2), 0, 0.6, 16.5, g);
    // ротор: рамка из медного провода, ось, коллектор (или сплошное кольцо)
    const rot = new T.Group(); at(rot, 0, ya, 0, g); clickable(rot, 'nudge');
    const ax = cyl(0.6, 35, C.STEEL, { edges: false }); ax.rotation.x = Math.PI / 2; at(ax, 0, 0, 2.5, rot);
    [-1, 1].forEach(sd => { const s = cyl(0.75, 16, COPPER, { edges: false }); s.rotation.x = Math.PI / 2; at(s, sd * Rf, 0, 0, rot); });
    [-1, 1].forEach(sz => { const b = cyl(0.75, 2 * Rf, COPPER, { edges: false }); b.rotation.z = Math.PI / 2; at(b, 0, 0, sz * 8, rot); });
    at(box(1.6, 1.6, 15, 0xe8d9b0), 0, 0, 0, rot);
    [-1, 1].forEach(sd => at(mesh(new T.TubeGeometry(new T.CatmullRomCurve3([v3(sd * Rf, 0, 8), v3(sd * 5, 0, 9), v3(sd * 1.95, 0, 10.4)]), 16, 0.35, 6), COPPER, { hull: true, edges: false }), 0, 0, 0, rot));
    const cm = new T.Group(); at(cm, 0, 0, 11.6, rot); clickable(cm, 'comm');
    if (d.comm) {
      [0.22, Math.PI + 0.22].forEach(t0 => { const h = mesh(new T.CylinderGeometry(1.95, 1.95, 3, 24, 1, false, t0, Math.PI - 0.44), C.BRASS, { hull: true, edges: false }); h.rotation.x = Math.PI / 2; at(h, 0, 0, 0, cm); });
      const ins = cyl(1.6, 3.05, 0x2c3240, { edges: false, hull: false }); ins.rotation.x = Math.PI / 2; at(ins, 0, 0, 0, cm);
    } else { const r = cyl(1.95, 3, C.BRASS, { seg: 28 }); r.rotation.x = Math.PI / 2; at(r, 0, 0, 0, cm); }
    // щётки: графитовые бруски на пружинах, держатели с клеммами
    const term = [];
    [-1, 1].forEach(sd => {
      at(box(3, 1.6, 2.4, 0x3a3a40), sd * 3.45, ya, 11.6, g);
      at(box(2.6, 0.45, 1.6, C.BRASS), sd * 6.2, ya, 11.6, g);
      at(box(1.8, ya + 2, 2, 0x2c3240), sd * 8.2, (ya + 2) / 2, 11.6, g);
      at(box(4, 1, 4, 0x2c3240), sd * 8.2, 0.5, 11.6, g);
      const p = kit.post(g, sd * 8.2, 11.6, ya + 2); term.push(W(p.x, p.y, p.z));
    });
    // силы Ампера на стороны рамки (оранжевые стрелки, всегда вертикальны: поле магнита горизонтально)
    const fA = arrow(kit, 3 + 2.4 * d.I, 0xffb547, 0.42), fB = arrow(kit, 3 + 2.4 * d.I, 0xffb547, 0.42);
    at(fA, 0, 0, 0, g); at(fB, 0, 0, 0, g); fA.visible = fB.visible = false;
    // ротор крутится вместе с опытом: угол берём у опыта каждый кадр
    const live = () => (window.LUCH_REAL && window.LUCH_REAL.live ? window.LUCH_REAL.live() : null);
    tag(W(17, 26, -2), 'Рамка', '0 об/мин');
    const tEl = lastTag(), tI = tEl && tEl.querySelector('i');
    let shown = '', acc = 1;
    const pose = (L, dt) => {
      if (!L) return;
      const phi = L.phi, c = Math.cos(phi), s = Math.sin(phi);
      rot.rotation.z = phi;
      let cur = 0;
      if (L.on) cur = !d.comm ? d.dir : Math.abs(c) < 0.08 ? 0 : d.dir * Math.sign(c);
      const fa = d.pol * cur;
      fA.visible = fB.visible = cur !== 0;
      fA.position.set(Rf * c, ya + Rf * s + fa * 1.2, 0); fA.rotation.z = fa > 0 ? 0 : Math.PI;
      fB.position.set(-Rf * c, ya - Rf * s - fa * 1.2, 0); fB.rotation.z = fa > 0 ? Math.PI : 0;
      acc += dt;
      if (tI && acc > 0.25) { acc = 0; const txt = L.rpm + ' об/мин' + (Math.abs(L.om) < 0.3 ? ' · стоит' : L.om < 0 ? ' · по часовой' : ' · против'); if (txt !== shown) { shown = txt; tI.textContent = txt; } }
    };
    pose(live(), 1);
    kit.onFrame(dt => pose(live(), dt));
    circuit(kit, d, term[0], term[1], d.on ? d.I : 0, d.dir > 0);
    tag(W(-17, 26, -2), 'Магнит', d.pol > 0 ? 'N слева · S справа' : 'S слева · N справа');
    tag(W(8.2, 21.5, 11.6), 'Коллектор', d.comm ? 'два полукольца' : 'сплошное кольцо');
  };
})();
