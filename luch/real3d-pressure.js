// «Как в жизни» для темы «Давление» (labs/phys-pressure): фигурка туриста в лотке со снегом, бак с датчиком
// давления и U-образным манометром, гора-макет с трубкой Торричелли и барометром-анероидом, штатив с
// динамометром над отливным сосудом, аквариум с кубиками из разных материалов.
// Сцены строятся из window.LUCH_REAL() опыта; падение кубика (меняется каждый кадр) — из window.LUCH_REAL.live().
(() => {
  const SC = window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {};
  const live = () => { try { return window.LUCH_REAL.live ? window.LUCH_REAL.live() : null; } catch (e) { return null; } };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (x, n = 1) => (Math.round(x * 10 ** n) / 10 ** n).toFixed(n).replace('.', ',');
  const nf = x => fmt(x, Math.abs(x - Math.round(x)) < 1e-9 ? 0 : 1);
  const big = x => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const hex = s => parseInt(String(s).replace('#', ''), 16);
  const ease = (cur, tg, dt, k = 5) => Math.abs(tg - cur) < 1e-3 ? tg : cur + (tg - cur) * Math.min(1, dt * k);
  const rnd = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  // показанные значения переживают перестройку сцены — так столбики и стрелки плавно доезжают до нового числа
  const shown = {};

  // ---------- общие детали ----------
  function H(kit) {
    const { T, at, box, cyl, mesh, keep, grad, textTex, C } = kit;
    const glassMat = (color = 0xcfe6f2, opacity = 0.22) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, transparent: true, opacity, side: T.DoubleSide, depthWrite: false }));
    const liqMat = (color, opacity = 0.45) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, transparent: true, opacity, depthWrite: false }));
    const flat = (w, h, tex, o = {}) => new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: keep(tex), transparent: true, ...o })));
    // холст → текстура
    function canvasTex(w, h, draw) {
      const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
      draw(x, w, h); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
    }
    // палочка между двумя точками (нога, рука, шланг-трубка, подвес)
    function limb(parent, a, b, r, color, o = {}) {
      const dir = b.clone().sub(a), len = dir.length();
      const m = cyl(r, len, color, { seg: 14, ...o });
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize());
      parent.add(m); return m;
    }
    // стрелка силы вдоль +y; setLen меняет длину, rotation.z = π — вниз
    function arrow(parent, color, len = 5, r = 0.45) {
      const g = new T.Group(); (parent || kit.root).add(g);
      const sh = cyl(r, 1, color, { seg: 12, edges: false }); g.add(sh);
      const hd = cyl(r * 2.6, 2, color, { r2: 0.02, seg: 14, edges: false }); g.add(hd);
      g.userData.setLen = L => { L = Math.max(2.2, L); const s = L - 2; sh.scale.y = Math.max(0.01, s); sh.position.y = s / 2; hd.position.y = s + 1; };
      g.userData.setLen(len); return g;
    }
    // открытый сверху стеклянный бак с жидкостью
    function tank(parent, x, z, W, D, Hw, Hl, liqCol, liqOp, base = 1.2) {
      const g = new T.Group(); at(g, x, 0, z, parent);
      at(box(W + 2.4, base, D + 2.4, C.DARK), 0, base / 2, 0, g);
      const gm = glassMat(), none = keep(new T.MeshBasicMaterial({ visible: false }));
      const glass = mesh(new T.BoxGeometry(W, Hw, D), 0, { mat: [gm, gm, none, gm, gm, gm], shadow: false });
      glass.renderOrder = 3; at(glass, 0, base + Hw / 2, 0, g);
      // уголки каркаса
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) at(box(0.9, Hw, 0.9, 0x3a4152, { shadow: false }), sx * W / 2, base + Hw / 2, sz * D / 2, g);
      let liq = null;
      if (Hl > 0) {
        liq = mesh(new T.BoxGeometry(W - 0.6, Hl, D - 0.6), 0, { mat: liqMat(liqCol, liqOp), edges: false, shadow: false });
        liq.renderOrder = 1; at(liq, 0, base + Hl / 2, 0, g);
        const top = new T.Mesh(keep(new T.PlaneGeometry(W - 0.6, D - 0.6)), liqMat(new T.Color(liqCol).lerp(new T.Color(0xffffff), 0.35).getHex(), Math.min(0.9, liqOp + 0.2)));
        top.rotation.x = -Math.PI / 2; top.renderOrder = 2; at(top, 0, base + Hl + 0.02, 0, g);
        const ln = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([a, b]) => new T.Vector3(a * (W - 0.6) / 2, base + Hl + 0.05, b * (D - 0.6) / 2));
        g.add(new T.Line(keep(new T.BufferGeometry().setFromPoints(ln)), keep(new T.LineBasicMaterial({ color: new T.Color(liqCol).multiplyScalar(0.6) }))));
      }
      return { g, liq, top: base + Hl, rim: base + Hw };
    }
    // табличка-текст на подставке
    function plate(parent, x, y, z, w, h, txt, fg = '#1b1610', bg = '#fff6e6') {
      const g = new T.Group(); at(g, x, y, z, parent);
      at(box(w + 0.6, h + 0.6, 0.5, 0x3a2e22), 0, 0, 0, g);
      at(flat(w, h, textTex(txt, fg, bg, Math.round(64 * w / h), 64)), 0, 0, 0.27, g);
      return g;
    }
    return { glassMat, liqMat, flat, canvasTex, limb, arrow, tank, plate };
  }

  // ===== 1. Давление твёрдых тел: фигурка туриста в лотке со снегом, линейка глубины =====
  SC['pressure-solid'] = (kit, d) => {
    const { T, at, box, cyl, mesh, toon, v3, tag, clickable, C } = kit, h = H(kit);
    const FS = 1.3, K = 34 * FS / 175, Ys = 13;                // фигурка 34·1,3 = 175 см; верх снега
    const g = new T.Group(); at(g, 0, 0, 0);
    // лоток: дно, стенки, снег
    at(box(80, 1, 48, C.WOOD2), 0, 0.5, 0, g);
    at(box(80, 14, 2, C.WOOD), 0, 7, 23, g); at(box(80, 14, 2, C.WOOD), 0, 7, -23, g);
    at(box(2, 14, 44, C.WOOD), -39, 7, 0, g); at(box(2, 14, 44, C.WOOD), 39, 7, 0, g);
    at(box(76, 12, 44, 0xf4f8fc, { edges: false }), 0, 7, 0, g);
    // комочки снега
    for (let i = 0; i < 26; i++) {
      const x = -34 + rnd(i) * 68, z = -19 + rnd(i + 40) * 38; if (Math.abs(x) < 12 && z > -10) continue;
      const s = mesh(new T.SphereGeometry(0.8 + rnd(i + 9) * 0.9, 10, 6), 0xffffff, { edges: false, shadow: false }); s.scale.y = 0.35; at(s, x, Ys, z, g);
    }
    // линейка глубины на передней стенке: 0 — уровень снега, вниз до 50 см
    const rl = h.flat(5, 13, h.canvasTex(100, 260, (x, w, hh) => {
      x.fillStyle = '#f1e3c2'; x.fillRect(0, 0, w, hh); x.strokeStyle = '#1b1610'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, w - 3, hh - 3);
      x.fillStyle = '#1b1610'; x.font = '600 22px "IBM Plex Mono", monospace'; x.textBaseline = 'middle';
      for (let c = 0; c <= 50; c += 5) { const y = (1 + c * K) * 20; x.fillRect(0, y - 1.5, c % 10 ? 18 : 30, 3); if (c % 10 === 0) x.fillText(String(c), 40, y + (c === 0 ? 9 : 0)); }
      x.font = '600 18px "Golos Text", sans-serif'; x.fillText('см', 40, hh - 16);
    }));
    at(rl, 30, 7.5, 24.05, g);
    const mark = at(box(1.8, 0.6, 0.8, 0xe0473a), 27.2, Ys, 24.3, g);
    // фигурка
    const fig = new T.Group(); at(fig, 0, Ys, 2, g); fig.scale.setScalar(FS); clickable(fig, 'one');
    const shoe = d.shoe, fx = shoe === 'shoes' ? 3.2 : shoe === 'skis' ? 2.4 : 2;
    const footwear = (x, y, z, rot = 0) => {
      const f = new T.Group(); at(f, x, y, z, fig); f.rotation.x = rot; clickable(f, 'shoe');
      if (shoe === 'boots') at(box(2.4, 2, 4.4, 0xffb547), 0, 1, 0.7, f);
      else {
        at(box(2.2, 1.8, 3.8, 0x3a4762), 0, 1.4, 0.4, f);
        if (shoe === 'shoes') {
          const p = cyl(1, 0.5, 0x3b4b69, { seg: 22 }); p.scale.set(2.6, 1, 5.4); at(p, 0, 0.25, 0.6, f);
          for (const zz of [-2.5, 0.6, 3.7]) at(box(4.4, 0.2, 0.3, 0x8b96ad, { edges: false }), 0, 0.55, zz, f);
        } else {
          at(box(1.8, 0.5, 28, 0xff8a73), 0, 0.25, 1.5, f);
          const tip = box(1.8, 0.5, 3.4, 0xff8a73); tip.rotation.x = -0.5; at(tip, 0, 0.95, 16.8, f);
        }
      }
      return f;
    };
    const hipY = 15, skin = 0xf2c9a0, leg = 0x5c6f96, coat = 0x72d4e8;
    footwear(-fx, 0, 0); h.limb(fig, v3(-fx, 1.6, 0.4), v3(-1.7, hipY, 0), 1.3, leg);
    if (d.one) {
      const knee = v3(1.9, 10.5, 4.6), foot = v3(1.9, 6.4, 1.2);
      h.limb(fig, v3(1.7, hipY, 0), knee, 1.3, leg); h.limb(fig, knee, foot, 1.2, leg);
      at(mesh(new T.SphereGeometry(1.3, 12, 8), leg, { edges: false }), knee.x, knee.y, knee.z, fig);
      footwear(1.9, 5, 0.6, -0.25);
    } else { footwear(fx, 0, 0); h.limb(fig, v3(fx, 1.6, 0.4), v3(1.7, hipY, 0), 1.3, leg); }
    at(cyl(3.3, 12, coat, { r2: 3.5 }), 0, hipY + 6, 0, fig);
    at(cyl(3.42, 1, 0x2c3240, { edges: false }), 0, hipY + 1, 0, fig);
    for (const s of [-1, 1]) { h.limb(fig, v3(s * 3.6, 25.5, 0), v3(s * 5.4, 18.5, 1.6), 1.05, coat); at(mesh(new T.SphereGeometry(1.1, 12, 8), skin, { hull: true, edges: false }), s * 5.5, 17.9, 1.7, fig); }
    at(mesh(new T.SphereGeometry(2.9, 22, 16), skin, { hull: true, edges: false }), 0, 30.2, 0, fig);
    for (const s of [-1, 1]) at(mesh(new T.SphereGeometry(0.35, 8, 6), 0x1b1610, { edges: false, shadow: false }), s * 1, 30.6, 2.7, fig);
    at(cyl(3, 2, 0xff8a73, { r2: 2.1 }), 0, 32.4, 0, fig);
    at(mesh(new T.SphereGeometry(1, 12, 8), 0xfff6e6, { hull: true, edges: false }), 0, 34, 0, fig);
    // рюкзак: тем больше, чем тяжелее
    const L = d.load, pk = new T.Group(); clickable(pk, 'pack');
    const pw = L ? 5.4 + L * 0.1 : 4.6, ph = L ? 6.5 + L * 0.2 : 6, pd = L ? 2.6 + L * 0.11 : 0.8;
    at(pk, 0, 21.5, -3.4 - pd / 2, fig);
    at(box(pw, ph, pd, 0x86e0a8), 0, 0, 0, pk);
    at(box(pw * 0.8, ph * 0.3, 0.6, 0x5fbf86), 0, ph * 0.12, -pd / 2 - 0.3, pk);
    for (const s of [-1, 1]) at(box(0.8, 9, 0.6, 0x2c3240, { edges: false }), s * 2, 1.5, pd / 2 + 0.3, pk);
    // вес — оранжевая стрелка вниз
    const wa = h.arrow(fig, 0xffb547, 2.2 + d.F / 100 * 1.1, 0.4); wa.rotation.z = Math.PI; at(wa, 9, 27, 0, fig);
    // след в снегу: тёмная ямка, обводка зелёная (держит) или красная (проваливается)
    const fw = shoe === 'shoes' ? 6.4 : shoe === 'skis' ? 2.6 : 3, fl = shoe === 'shoes' ? 11 : shoe === 'skis' ? 32 : 5;
    const fz = 2 + (shoe === 'skis' ? 3 : 0.8) * FS, pitW = ((d.one ? fw : fw + 2 * fx) + 1.2) * FS, pitX = d.one ? -fx * FS : 0;
    const pit = at(box(pitW, 0.06, (fl + 1.2) * FS, 0x9fb3cc, { edges: false, shadow: false }), pitX, Ys + 0.03, fz, g);
    const ring = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([a, b]) => v3(pitX + a * (pitW / 2 + 0.3), Ys + 0.1, fz + b * ((fl / 2 + 0.6) * FS + 0.3)));
    g.add(new T.Line(kit.keep(new T.BufferGeometry().setFromPoints(ring)), kit.keep(new T.LineBasicMaterial({ color: d.sink ? 0xe0473a : 0x2f9e57 }))));
    // проваливание: плавно, как в опыте
    if (shown.sv === undefined || shown.scene !== 'solid') shown.sv = d.sv; shown.scene = 'solid';
    const head = v3(0, 0, 2), packAt = v3(-17, 0, -4);
    const put = () => {
      const s = shown.sv * K; fig.position.y = Ys - s; mark.position.y = Ys - s;
      pit.visible = shown.sv > 1.5; head.y = Ys - s + 47; packAt.y = Ys - s + 26;
    };
    put();
    kit.onFrame(dt => { shown.sv = kit.reduce ? d.sv : ease(shown.sv, d.sv, dt, 4); put(); });
    tag(head, 'Турист', `F = ${big(d.F)} Н`);
    tag(packAt, 'Рюкзак', L + ' кг');
    tag(v3(-14, Ys + 1, shoe === 'skis' ? 24 : 13), d.shoeName, `S = ${fmt(d.Sa, 2)} м²`);
    tag(v3(17, Ys + 1, 10), 'Давление', `p = ${fmt(d.p, 1)} кПа`, d.sink);
    tag(v3(30, 15, 24), 'Ямка', `${fmt(d.sv, 0)} см`);
  };

  // ===== 2. Давление в жидкости: бак, датчик с плёнкой на штативе, U-образный манометр =====
  SC['pressure-liquid'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit, h = H(kit);
    const tx = -12, tz = -8, W = 40, D = 20, base = 1.5, Hl = 30, ys = base + Hl;     // 10 единиц = 1 м
    const tk = h.tank(null, tx, tz, W, D, 33, Hl, hex(d.col), 0.45, base);
    // шкала глубины на передней стенке
    const sc = h.flat(5, 32, h.canvasTex(100, 640, (x, w, hh) => {
      x.fillStyle = 'rgba(241,227,194,.92)'; x.fillRect(0, 0, w, hh); x.strokeStyle = '#1b1610'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, w - 3, hh - 3);
      x.fillStyle = '#1b1610'; x.font = '600 24px "IBM Plex Mono", monospace'; x.textBaseline = 'middle';
      for (let k = 0; k <= 6; k++) { const y = (2 + 5 * k) * 20; x.fillRect(0, y - 2, k % 2 ? 22 : 36, 4); if (k % 2 === 0) x.fillText(k / 2 + ' м', 42, y); }
    }));
    at(sc, tx + 16.5, base + 16, tz + D / 2 + 0.08, null);
    // табличка жидкости на подставке бака — нажать, чтобы сменить
    const pl = h.plate(null, tx - 10, 0.9 + 0.2, tz + D / 2 + 1.5, 13, 2.2, `${d.liqName} · ${big(d.rho)} кг/м³`); pl.scale.y = 0.75; clickable(pl, 'liq');
    // штатив за баком: стойка, кронштейн, муфта с винтом
    const sx = tx - 2, sz = tz - D / 2 - 7, armY = 40;
    at(box(12, 1.4, 8, C.DARK), sx, 0.7, sz, null);
    at(cyl(0.7, armY + 1.6, C.STEEL, { edges: false }), sx, 1.4 + (armY + 1.6) / 2, sz, null);
    at(box(2.6, 2.6, 2.6, C.DARK), sx, armY, sz, null);
    const arm = cyl(0.55, tz - sz, C.STEEL, { edges: false }); arm.rotation.x = Math.PI / 2; at(arm, sx, armY, (sz + tz) / 2, null);
    const cl = new T.Group(); at(cl, sx, armY, tz, null); clickable(cl, 'hcycle');
    at(box(2.8, 2.8, 2.8, C.DARK), 0, 0, 0, cl);
    const knob = cyl(1.2, 1.6, 0xe0473a, { seg: 14 }); knob.rotation.z = Math.PI / 2; at(knob, 2.2, 0, 0, cl);
    // датчик: воронка с красной плёнкой; ось поворота проходит через центр плёнки — глубина та же
    const yp = ys - d.h * 10;
    at(cyl(0.45, armY + 3 - (yp + 7.5), C.STEEL, { edges: false }), sx, (armY + 3 + yp + 7.5) / 2, tz, null);
    const fork = new T.Group(); at(fork, sx, yp, tz, null); fork.scale.setScalar(1.25); clickable(fork, 'hcycle');
    at(box(8.4, 0.7, 0.9, C.STEEL, { edges: false }), 0, 6, 0, fork);
    for (const s of [-1, 1]) { at(box(0.7, 6, 0.9, C.STEEL, { edges: false }), s * 3.9, 3, 0, fork); const b = cyl(0.6, 0.9, C.BRASS, { seg: 6 }); b.rotation.z = Math.PI / 2; at(b, s * 4.1, 0, 0, fork); }
    const pr = new T.Group(); at(pr, sx, yp, tz, null); pr.scale.setScalar(1.25); clickable(pr, 'or');
    pr.rotation.x = [0, -Math.PI / 2, Math.PI][d.or || 0];
    at(cyl(3.1, 0.5, 0xe0473a, { seg: 26 }), 0, 0.25, 0, pr);
    at(cyl(3.3, 3, 0xe8ecf4, { r2: 1.1, seg: 26 }), 0, 2, 0, pr);
    at(cyl(0.65, 2, C.STEEL), 0, 4.4, 0, pr);
    const ax = cyl(0.35, 7.6, C.STEEL, { edges: false }); ax.rotation.z = Math.PI / 2; at(ax, 0, 0, 0, pr);
    pr.updateMatrixWorld(true);
    const n0 = v3(0, 5.3, 0).applyMatrix4(pr.matrixWorld), n1 = v3(0, 8.5, 0).applyMatrix4(pr.matrixWorld);
    // U-образный манометр на дощечке
    const mx = 34, mz = 8, y0 = 19, k = 0.3;                 // уровень меняется на 0,3 на каждый кПа (с каждой стороны)
    at(box(16, 1.2, 7, C.WOOD2), mx, 0.6, mz, null);
    at(box(14, 34, 1.2, 0xf1e3c2), mx, 1.2 + 17, mz, null);
    const msc = h.flat(5, 26, h.canvasTex(120, 624, (x, w, hh) => {
      x.fillStyle = '#1b1610'; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let v = -40; v <= 40; v += 5) { const y = (32 - (y0 + k * v)) * 24; if (y < 6 || y > hh - 6) continue; x.fillRect(v % 10 ? 40 : 28, y - 1.5, v % 10 ? 40 : 64, 3); }
      x.font = '600 26px "IBM Plex Mono", monospace';
      for (let v = 0; v <= 40; v += 10) { const y = (32 - (y0 + k * v)) * 24; if (y > 14) x.fillText(String(v), 60, y - 16); }
      x.font = '700 24px "Golos Text", sans-serif'; x.fillText('кПа', 60, hh - 22);
    }));
    at(msc, mx, 19, mz + 0.65, null);
    const gm = h.glassMat(0xe6f4fb, 0.32), redM = h.liqMat(0xe0473a, 0.9);
    for (const s of [-1, 1]) { const tb = mesh(new T.CylinderGeometry(0.95, 0.95, 26, 18, 1, true), 0, { mat: gm, edges: false, hull: true, shadow: false }); tb.renderOrder = 3; at(tb, mx + s * 3.5, 19, mz + 1.7, null); }
    const bend = mesh(new T.TorusGeometry(3.5, 0.95, 10, 28, Math.PI), 0, { mat: gm, edges: false, shadow: false }); bend.rotation.z = Math.PI; bend.renderOrder = 3; at(bend, mx, 6, mz + 1.7, null);
    const bendL = mesh(new T.TorusGeometry(3.5, 0.7, 10, 28, Math.PI), 0, { mat: redM, edges: false, shadow: false }); bendL.rotation.z = Math.PI; at(bendL, mx, 6, mz + 1.7, null);
    const colL = mesh(new T.CylinderGeometry(0.7, 0.7, 1, 14), 0, { mat: redM, edges: false, shadow: false }), colR = colL.clone();
    at(colL, mx - 3.5, 6, mz + 1.7, null); at(colR, mx + 3.5, 6, mz + 1.7, null);
    const clipsY = [10, 28]; for (const cy of clipsY) at(box(9.6, 0.8, 0.6, C.STEEL, { edges: false }), mx, cy, mz + 2.75, null);
    // резиновый шланг: от горлышка датчика вверх из бака и к левому колену манометра
    const hose = [n0, n1, v3(sx + 6.5, yp + 4, tz + 1.5), v3(sx + 6.5, ys + 4, tz + 1.5), v3(sx + 5, 37, tz + 2), v3(10, 41, -1), v3(mx - 3.5, 37, mz + 1.7), v3(mx - 3.5, 32.4, mz + 1.7)];
    at(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(hose, false, 'centripetal'), 120, 0.6, 8), 0xb5523b, { hull: true, edges: false }), 0, 0, 0, null);
    if (shown.scene !== 'liquid') shown.p = d.p; shown.scene = 'liquid';
    const put = () => {
      const dl = k * shown.p, a = y0 - dl, b = y0 + dl;      // давление со стороны датчика опускает левый столбик
      colL.scale.y = a - 6; colL.position.y = (a + 6) / 2; colR.scale.y = b - 6; colR.position.y = (b + 6) / 2;
    };
    put();
    kit.onFrame(dt => { shown.p = kit.reduce ? d.p : ease(shown.p, d.p, dt, 4); put(); });
    tag(v3(sx, tk.rim + 1, tz + 4), 'Датчик', `h = ${fmt(d.h, 1)} м · ${['вниз', 'вбок', 'вверх'][d.or || 0]}`);
    tag(v3(mx, 37, mz), 'Манометр', `${fmt(d.p, 1)} кПа`);
    tag(v3(tx - 19, base + 8, tz + D / 2), d.liqName, `ρ = ${big(d.rho)} кг/м³`);
  };

  // ===== 3. Атмосферное давление: гора-макет с альпинистом, трубка Торричелли, барометр-анероид =====
  SC['pressure-atm'] = (kit, d) => {
    const { T, at, box, cyl, mesh, toon, v3, tag, clickable, keep, C } = kit, h = H(kit);
    // макет горы: 1 единица высоты = 250 м
    const MX = -36, MZ = -10, B0 = 1.4, KH = 0.004, R0 = 21, HT = 7010 * KH;
    const mg = new T.Group(); at(mg, 0, 0, 0); clickable(mg, 'plnext');
    at(box(46, B0, 40, C.WOOD2), MX, B0 / 2, MZ, mg);
    // гранёный конус с неровными склонами (одинаковый сдвиг для совпадающих вершин — без щелей)
    const g0 = new T.CylinderGeometry(0.5, R0, HT, 9, 6), geo = g0.toNonIndexed(); g0.dispose();
    const pos = geo.attributes.position, col = [];
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) + HT / 2, key = Math.round(pos.getX(i) * 10) * 7 + Math.round(pos.getZ(i) * 10) * 13 + Math.round(y * 10) * 3;
      const f = 1 + (y > 0.5 && y < HT - 0.5 ? (rnd(key) - 0.5) * 0.12 : 0);
      pos.setX(i, pos.getX(i) * f); pos.setZ(i, pos.getZ(i) * f);
      const c = new T.Color(y < 5 ? 0x5f9a52 : y < 19 ? 0x7d8799 : 0xf4f8fc); if (y >= 5 && y < 8) c.lerp(new T.Color(0x5f9a52), 0.4); col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new T.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
    at(mesh(geo, 0, { mat: toon(0xffffff, { vertexColors: true }), edgeAngle: 50 }), MX, B0 + HT / 2, MZ, mg);
    // высотная рейка за горой
    const pole = h.flat(5, HT + 2, h.canvasTex(100, Math.round((HT + 2) * 20), (x, w, hh) => {
      x.fillStyle = '#f1e3c2'; x.fillRect(0, 0, w, hh); x.strokeStyle = '#1b1610'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, w - 3, hh - 3);
      x.fillStyle = '#1b1610'; x.font = '600 22px "IBM Plex Mono", monospace'; x.textBaseline = 'middle';
      for (let km = 0; km <= 7; km++) { const y = hh - (1 + km * 1000 * KH) * 20; x.fillRect(0, y - 1.5, 26, 3); x.fillText(km + (km === 7 ? ' км' : ''), 32, y); }
    }));
    at(box(5.6, HT + 2.6, 0.8, 0x3a2e22), MX + 17, B0 + (HT + 2) / 2, MZ - 14.6, null);
    at(pole, MX + 17, B0 + (HT + 2) / 2, MZ - 14.15, null);
    // точка на склоне на высоте H (сторона к зрителю)
    const th = 0.55, onSlope = (H, out = 0.6) => { const y = H * KH, r = (0.5 + (R0 - 0.5) * (1 - y / HT)) * 0.95 + out; return v3(MX + Math.sin(th) * r, B0 + y, MZ + Math.cos(th) * r); };
    [0, 800, 1690, 2260, 4979, 7010].forEach(Hp => { const p = onSlope(Hp, 0.3); at(mesh(new T.SphereGeometry(0.6, 10, 8), 0x72d4e8, { hull: true, edges: false }), p.x, p.y, p.z, mg); });
    // альпинист с флажком (плавно идёт к новой высоте)
    const cg = new T.Group(); at(cg, 0, 0, 0); clickable(cg, 'up');
    at(cyl(0.9, 2.8, 0xff8a73), 0, 1.4, 0, cg);
    at(mesh(new T.SphereGeometry(0.85, 12, 8), 0xf2c9a0, { hull: true, edges: false }), 0, 3.5, 0, cg);
    at(box(1.4, 1.8, 0.9, 0x86e0a8), 0, 1.8, -1.1, cg);
    at(cyl(0.16, 6, C.STEEL, { edges: false }), 1.3, 3, 0, cg);
    at(box(2.4, 1.4, 0.15, 0xffb547), 2.5, 5.3, 0, cg);
    if (shown.scene !== 'atm') { shown.H = d.H; shown.mm = d.mm; } shown.scene = 'atm';
    // трубка Торричелли в чашке со ртутью, на штативе, со шкалой в мм
    const TX = 12, TZ = -10, km = 0.042, ym0 = 2.6, tTop = ym0 + 850 * km;
    at(cyl(7.6, 3, 0xeef2f6, { seg: 36 }), TX, 1.5, TZ, null);
    at(cyl(7, 0.6, 0xaeb8c9, { seg: 36, edges: false, matOpt: { emissive: 0x2a3140, emissiveIntensity: 0.4 } }), TX, ym0 - 0.3, TZ, null);
    const gmat = h.glassMat(0xe6f4fb, 0.3);
    const tube = mesh(new T.CylinderGeometry(1.35, 1.35, tTop - 1.2, 20, 1, true), 0, { mat: gmat, edges: false, hull: true, shadow: false }); tube.renderOrder = 3; at(tube, TX, (tTop + 1.2) / 2, TZ, null);
    const cap = mesh(new T.SphereGeometry(1.35, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0, { mat: gmat, edges: false, shadow: false }); cap.renderOrder = 3; at(cap, TX, tTop, TZ, null);
    const hgM = toon(0xb9c2d0, { emissive: 0x2a3140, emissiveIntensity: 0.3 });
    const hg = mesh(new T.CylinderGeometry(1, 1, 1, 16), 0, { mat: hgM, edges: false, shadow: false }); at(hg, TX, ym0, TZ, null);
    const men = mesh(new T.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, { mat: hgM, edges: false, shadow: false }); men.scale.y = 0.45; at(men, TX, ym0, TZ, null);
    // штатив и шкала
    at(box(10, 1.2, 8, C.DARK), TX + 10, 0.6, TZ - 3, null);
    at(cyl(0.6, tTop + 2, C.STEEL, { edges: false }), TX + 12, (tTop + 2) / 2 + 1.2, TZ - 3, null);
    for (const yy of [10, tTop - 3]) { at(box(12.4, 1, 1, C.DARK), TX + 6.2, yy, TZ - 1.5, null); at(box(3.4, 2, 3.4, C.DARK), TX, yy, TZ, null); }
    const ruler = h.flat(4.4, tTop - ym0, h.canvasTex(110, Math.round((tTop - ym0) * 24), (x, w, hh) => {
      x.fillStyle = '#f1e3c2'; x.fillRect(0, 0, w, hh); x.strokeStyle = '#1b1610'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, w - 3, hh - 3);
      x.fillStyle = '#1b1610'; x.font = '600 20px "IBM Plex Mono", monospace'; x.textBaseline = 'middle';
      for (let v = 0; v <= 850; v += 50) { const y = hh - v * km * 24; x.fillRect(0, y - 1.5, v % 100 ? 14 : 24, 3); if (v % 200 === 0 && v) x.fillText(String(v), 30, y); }
      const y76 = hh - 760 * km * 24; x.fillStyle = '#2f9e57'; for (let xx = 0; xx < w; xx += 14) x.fillRect(xx, y76 - 2, 8, 4); x.font = '700 20px "IBM Plex Mono", monospace'; x.fillText('760', 52, y76 - 14);
      x.fillStyle = '#1b1610'; x.font = '600 18px "Golos Text", sans-serif'; x.fillText('мм', 30, 18);
    }));
    at(box(5, tTop - ym0 + 0.6, 0.6, 0x3a2e22), TX + 4.4, (tTop + ym0) / 2, TZ - 0.6, null);
    at(ruler, TX + 4.4, (tTop + ym0) / 2, TZ - 0.25, null);
    // воздух давит на открытую ртуть в чашке
    const al = 3 + 4 * d.mm / 760;
    for (const dx of [-4.6, 4.6]) { const a = h.arrow(null, 0x72d4e8, al, 0.35); a.rotation.z = Math.PI; at(a, TX + dx, ym0 + al + 0.2, TZ + 3, null); }
    // барометр-анероид: латунный корпус, шкала 300–800 мм рт. ст., стрелка
    const BX = 26, BY = 10, BZ = 20, bg = new T.Group(); at(bg, BX, 0, BZ, null);
    at(box(7, 1.2, 6, C.DARK), 0, 0.6, 0, bg); at(box(1.6, BY - 7, 1.6, C.DARK), 0, 1.2 + (BY - 7.6) / 2, -0.6, bg);
    const cs = cyl(8, 3, C.BRASS, { seg: 40 }); cs.rotation.x = Math.PI / 2; at(cs, 0, BY, 0, bg);
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, fr = mm => clamp((mm - 300) / 500, 0, 1.03);
    const face = new T.Mesh(keep(new T.CircleGeometry(7.1, 48)), keep(new T.MeshBasicMaterial({ map: keep(h.canvasTex(320, 320, (x) => {
      x.fillStyle = '#f7f3ea'; x.beginPath(); x.arc(160, 160, 158, 0, 7); x.fill();
      x.strokeStyle = '#1b1610'; x.lineWidth = 4; x.beginPath(); x.arc(160, 160, 128, a0, a1); x.stroke();
      x.fillStyle = '#1b1610'; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let v = 300; v <= 800; v += 25) {
        const a = a0 + (a1 - a0) * fr(v), big2 = v % 100 === 0; x.lineWidth = big2 ? 4 : 2;
        x.beginPath(); x.moveTo(160 + Math.cos(a) * 128, 160 + Math.sin(a) * 128); x.lineTo(160 + Math.cos(a) * (big2 ? 104 : 114), 160 + Math.sin(a) * (big2 ? 104 : 114)); x.stroke();
        if (big2) { x.font = '600 24px "IBM Plex Mono", monospace'; x.fillText(String(v), 160 + Math.cos(a) * 82, 160 + Math.sin(a) * 82); }
      }
      const a76 = a0 + (a1 - a0) * fr(760); x.strokeStyle = '#2f9e57'; x.lineWidth = 7; x.beginPath(); x.arc(160, 160, 136, a76 - 0.03, a76 + 0.03); x.stroke();
      x.font = '700 22px "Golos Text", sans-serif'; x.fillText('БАРОМЕТР', 160, 214); x.font = '600 18px "Golos Text", sans-serif'; x.fillText('мм рт. ст.', 160, 240);
    })) })));
    at(face, 0, BY, 1.55, bg);
    const nd = new T.Group(); at(nd, 0, BY, 1.75, bg);
    at(box(6, 0.4, 0.15, 0xc0392b, { edges: false, shadow: false }), 2.4, 0, 0, nd);
    at(cyl(0.6, 0.4, 0x1b1610, { edges: false }), 0, 0, 0.1, nd).rotation.x = Math.PI / 2;
    const ring = mesh(new T.TorusGeometry(7.6, 0.45, 8, 40), C.BRASS, { edges: false }); at(ring, 0, BY, 1.6, bg);
    clickable(bg, 'up');
    const climberTop = v3(0, 0, 0);
    const put = () => {
      const p = onSlope(shown.H); cg.position.copy(p); climberTop.copy(p).add(v3(0, 6.6, 0));
      const top = ym0 + shown.mm * km; hg.scale.y = top - ym0 + 1.2; hg.position.y = (top + ym0 - 1.2) / 2; men.position.y = top;
      nd.rotation.z = -(a0 + (a1 - a0) * fr(shown.mm));
    };
    put();
    kit.onFrame(dt => {
      shown.H = kit.reduce ? d.H : ease(shown.H, d.H, dt, 4); shown.mm = kit.reduce ? d.mm : ease(shown.mm, d.mm, dt, 4); put();
    });
    tag(climberTop, 'Альпинист', `${big(d.H)} м${d.place ? ' · ' + d.place : ''}`, d.ok);
    tag(v3(TX, ym0 + d.mm * km + 2, TZ), 'Ртуть', `${big(d.mm)} мм`);
    tag(v3(TX, tTop + 2.5, TZ), 'Пустота');
    tag(v3(BX, BY + 9.5, BZ), 'Барометр', `${fmt(d.kpa, 1)} кПа`);
  };

  // ===== 4. Закон Архимеда: штатив, динамометр с цилиндром, отливной сосуд, стаканчик =====
  SC['pressure-arch'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, clickable, C } = kit, h = H(kit);
    // приборы небольшие — вся установка собирается как обычно и затем увеличивается в SCL раз
    const SCL = 1.45, n0 = kit.root.children.length, tag = (p, ...a) => kit.tag(p.multiplyScalar(SCL), ...a);
    const VX = -2, VZ = -4, VR = 7, VH = 15, Ys = 12, CR = 2.4, CH = 7, BCOL = { al: 0xc3cbd8, st: 0x7d8799 };
    const lc = hex(d.col);
    // отливной сосуд: стекло, жидкость до носика, носик
    const gm = h.glassMat(0xe6f4fb, 0.26);
    const vg = mesh(new T.CylinderGeometry(VR, VR, VH, 40, 1, true), 0, { mat: gm, edges: false, hull: true, shadow: false }); vg.renderOrder = 3; at(vg, VX, VH / 2, VZ, null);
    at(cyl(VR, 0.6, 0xdfe8ef, { seg: 40, edges: false }), VX, 0.3, VZ, null);
    const lq = mesh(new T.CylinderGeometry(VR - 0.3, VR - 0.3, Ys - 0.6, 40), 0, { mat: h.liqMat(lc, 0.45), edges: false, shadow: false }); lq.renderOrder = 1; at(lq, VX, 0.6 + (Ys - 0.6) / 2, VZ, null);
    const sf = new T.Mesh(kit.keep(new T.CircleGeometry(VR - 0.3, 40)), h.liqMat(new T.Color(lc).lerp(new T.Color(0xffffff), 0.35).getHex(), 0.6)); sf.rotation.x = -Math.PI / 2; sf.renderOrder = 2; at(sf, VX, Ys + 0.02, VZ, null);
    const spA = v3(VX + VR - 0.2, Ys, VZ), spB = v3(VX + VR + 4.6, Ys - 1.6, VZ);
    h.limb(kit.root, spA, spB, 0.8, 0xcfe6f2, { edges: false });
    // табличка жидкости — нажать, чтобы сменить
    const pl = h.plate(null, VX, 1.6, VZ + VR + 2.6, 11, 2.2, `${d.liqName} · ${big(d.rho)} кг/м³`); clickable(pl, 'liq');
    at(box(1, 1.6, 1, 0x3a2e22), VX, 0.5, VZ + VR + 2.3, null);
    // стаканчик под носиком: уровень = вытесненный объём (сечение цилиндра·глубина / сечение стаканчика)
    const BX = VX + VR + 6, BR = 3.6, BH = 9, inner = BR - 0.3, fullH = CR * CR * CH / (inner * inner);
    const bgl = mesh(new T.CylinderGeometry(BR, BR, BH, 30, 1, true), 0, { mat: gm, edges: false, hull: true, shadow: false }); bgl.renderOrder = 3; at(bgl, BX, BH / 2, VZ, null);
    at(cyl(BR, 0.5, 0xdfe8ef, { seg: 30, edges: false }), BX, 0.25, VZ, null);
    for (const [v, t] of [[50, '50'], [100, '100']]) {
      const yy = 0.5 + fullH * v / 100; at(box(1.6, 0.16, 0.1, 0x1b1610, { edges: false, shadow: false }), BX - 0.8, yy, VZ + BR + 0.05, null);
      at(h.flat(2.2, 1.1, kit.textTex(t, '#1b1610', 'rgba(0,0,0,0)', 128, 64)), BX + 1.3, yy, VZ + BR + 0.08, null);
    }
    const bl = mesh(new T.CylinderGeometry(inner, inner, 1, 30), 0, { mat: h.liqMat(lc, 0.7), edges: false, shadow: false }); bl.renderOrder = 1; at(bl, BX, 0.5, VZ, null);
    const stream = mesh(new T.CylinderGeometry(0.35, 0.35, 1, 10), 0, { mat: h.liqMat(lc, 0.75), edges: false, shadow: false }); at(stream, spB.x + 0.5, 0, VZ, null);
    // цилиндр: над водой зазор до 4, дальше погружается на долю f
    const bottom = d.tr < 37 ? Ys + (37 - d.tr) / 37 * 4 : Ys - (d.tr - 37) / 50 * CH, cTop = bottom + CH;
    const cyG = new T.Group(); at(cyG, VX, bottom, VZ, null); clickable(cyG, 'lower');
    at(cyl(CR, CH, BCOL[d.body], { seg: 30 }), 0, CH / 2, 0, cyG);
    at(cyl(CR * 0.55, 0.5, C.STEEL, { seg: 18 }), 0, CH + 0.25, 0, cyG);
    const eye = mesh(new T.TorusGeometry(0.55, 0.18, 6, 14), C.STEEL, { edges: false }); at(eye, 0, CH + 1, 0, cyG);
    // динамометр: верх корпуса так, чтобы крючок с нитью держал цилиндр; пружина растянута на F
    const F = d.F, yT = cTop + 18 + F, dyn = new T.Group(); at(dyn, VX, yT, VZ, null); clickable(dyn, 'lower');
    at(box(4.8, 14, 1.8, 0xe8ecf4), 0, -7, 0, dyn);
    const dsc = h.flat(4.2, 12, h.canvasTex(84, 240, (x, w, hh) => {
      x.fillStyle = '#26324a'; x.fillRect(4, 0, 30, hh);
      x.fillStyle = '#1b1610'; x.font = '600 18px "IBM Plex Mono", monospace'; x.textBaseline = 'middle';
      for (let n = 0; n <= 10; n++) { const y = (1 + n) * 20; x.fillRect(40, y - 1.5, n % 5 ? 10 : 18, 3); if (n % 2 === 0) x.fillText(String(n), 62, y); }
      x.font = '700 16px "Golos Text", sans-serif'; x.fillText('Н', 64, 6 + 4);
    }));
    at(dsc, 0, -7, 0.92, dyn);
    const yP = -2 - F, pts = [];
    for (let i = 0; i <= 140; i++) { const a = i / 140 * Math.PI * 2 * 9; pts.push(v3(-1.27 + Math.cos(a) * 0.55, -0.6 + (yP + 0.6) * i / 140, 1.25 + Math.sin(a) * 0.25)); }
    at(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 280, 0.1, 5), C.STEEL, { edges: false, shadow: false }), 0, 0, 0, dyn);
    at(box(3.6, 0.4, 0.5, 0xe0473a, { edges: false }), 0.3, yP, 1.4, dyn);
    at(cyl(0.3, 13, C.STEEL, { edges: false }), 0, yP - 6.5, 0, dyn);
    const hook = mesh(new T.TorusGeometry(0.6, 0.18, 6, 14, Math.PI * 1.4), C.STEEL, { edges: false }); hook.rotation.z = Math.PI * 1.2; at(hook, 0, yP - 13.6, 0, dyn);
    at(mesh(new T.TorusGeometry(0.8, 0.22, 6, 14), C.STEEL, { edges: false }), 0, 1.1, 0, dyn);
    h.limb(kit.root, v3(VX, yT + yP - 14.2, VZ), v3(VX, cTop + 1.4, VZ), 0.08, 0x1b1610, { edges: false, hull: false });
    // штатив с лапкой, на которой висит динамометр
    const SX = VX - 16, armY = yT + 2;
    at(box(10, 1.4, 12, C.DARK), SX, 0.7, VZ, null);
    at(cyl(0.7, armY + 3, C.STEEL, { edges: false }), SX, 1.4 + (armY + 3) / 2, VZ, null);
    at(box(2.6, 2.6, 2.6, C.DARK), SX, armY, VZ, null);
    const arm = cyl(0.5, VX - SX + 1, C.STEEL, { edges: false }); arm.rotation.z = Math.PI / 2; at(arm, (SX + VX) / 2 + 0.5, armY, VZ, null);
    at(box(1, 1.6, 1, C.DARK), VX, armY - 0.6, VZ, null);
    // силы на цилиндр: вес вниз (оранжевая), Архимед вверх (голубая)
    const cmid = bottom + CH / 2;
    const aP = h.arrow(null, 0xffb547, 1.3 * d.P + 1, 0.35); aP.rotation.z = Math.PI; at(aP, VX + 4.6, cmid, VZ + 1, null);
    if (d.Fa > 0.02) at(h.arrow(null, 0x72d4e8, 1.3 * d.Fa + 1, 0.35), VX - 4.6, cmid, VZ + 1, null);
    // запасной цилиндр на столе — нажать, чтобы поменять
    const other = d.body === 'al' ? 'st' : 'al', sp = new T.Group(); at(sp, -26, 0, 16, null); clickable(sp, 'swap');
    const sb = cyl(CR, CH, BCOL[other], { seg: 30 }); sb.rotation.z = Math.PI / 2; at(sb, 0, CR, 0, sp);
    const se = mesh(new T.TorusGeometry(0.55, 0.18, 6, 14), C.STEEL, { edges: false }); se.rotation.y = Math.PI / 2; at(se, CH / 2 + 0.7, CR, 0, sp);
    // уровень в стаканчике доезжает до нового объёма; пока растёт — течёт струйка
    if (shown.scene !== 'arch') shown.vs = d.Vs; shown.scene = 'arch';
    const put = (flow) => {
      const lv = Math.max(0.02, fullH * shown.vs / 100); bl.scale.y = lv; bl.position.y = 0.5 + lv / 2;
      const top = spB.y - 0.2, bot = 0.5 + lv; stream.visible = flow; stream.scale.y = top - bot; stream.position.y = (top + bot) / 2;
    };
    put(false);
    kit.onFrame(dt => {
      const was = shown.vs; shown.vs = kit.reduce ? d.Vs : (d.Vs > was ? Math.min(d.Vs, was + dt * 60) : ease(was, d.Vs, dt, 6));
      put(shown.vs > was + 1e-4);
    });
    const G = new T.Group(); G.scale.setScalar(SCL);
    kit.root.children.slice(n0).forEach(o => G.add(o)); kit.root.add(G);
    tag(v3(VX, yT + 3, VZ), 'Динамометр', `${fmt(F, 2)} Н`);
    tag(v3(VX + 8, cmid + 3, VZ + 1), d.bodyName, `P = ${fmt(d.P, 2)} Н`);
    if (d.Fa > 0.02) tag(v3(VX - 9, cmid + 1, VZ + 1), 'Сила Архимеда', `${fmt(d.Fa, 2)} Н`);
    tag(v3(BX + 2, 0, VZ + 6), 'Стаканчик', `${nf(d.Vs)} см³`);
    tag(v3(-26, 5, 16), 'Запасной', d.body === 'al' ? 'сталь' : 'алюминий');
  };

  // ===== 5. Плавание тел: аквариум, кубик 10 см, лоток с кубиками из разных материалов =====
  function cube(kit, h, key, color, s) {
    const { T, at, box, mesh, C } = kit, g = new T.Group();
    const tr = key === 'ice' || key === 'plex';
    const m = box(s, s, s, color, tr ? { mat: h.liqMat(color, key === 'ice' ? 0.78 : 0.7) } : {});
    if (tr) { m.renderOrder = 2; m.castShadow = false; }
    at(m, 0, s / 2, 0, g);
    if (key === 'pine') for (const y of [0.3, 0.55, 0.8]) at(box(s * 0.86, 0.14, 0.05, 0xa87a3e, { edges: false, shadow: false }), 0, s * y, s / 2 + 0.03, g);
    if (key === 'cork') for (let i = 0; i < 9; i++) at(box(0.35, 0.35, 0.05, 0x8a6236, { edges: false, shadow: false }), (rnd(i) - 0.5) * s * 0.8, s * (0.1 + rnd(i + 5) * 0.8), s / 2 + 0.03, g);
    if (key === 'ice') at(box(s * 0.12, s * 0.5, 0.05, 0xffffff, { edges: false, shadow: false }), -s * 0.25, s * 0.6, s / 2 + 0.03, g);
    if (key === 'steel' || key === 'al') at(box(s * 0.7, 0.12, 0.05, key === 'steel' ? 0x9aa3b2 : 0xe8ecf4, { edges: false, shadow: false }), 0, s * 0.82, s / 2 + 0.03, g);
    return g;
  }
  SC['pressure-float'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit, h = H(kit);
    const Lv = live() || { fy: 96, ys: 176, yb: 386, A: 56, top: 96, k: 0 };
    const KS = 8 / Lv.A, S = 8, TX = 0, TZ = -8, W = 40, D = 20, base = 1.2;
    const Hl = (Lv.yb - Lv.ys) * KS, Hw = (Lv.yb - Lv.ys + 40) * KS, merc = d.fl === 'merc';
    const tk = h.tank(null, TX, TZ, W, D, Hw, Hl, hex(d.col), merc ? 0.9 : 0.45, base);
    const surf = base + Hl;
    const pl = h.plate(null, TX, 0.75, TZ + D / 2 + 1.7, 14, 2.2, `${d.liqName} · ${big(d.rho)} кг/м³`); pl.scale.y = 0.6; clickable(pl, 'liq');
    // кубик в аквариуме (высота — из опыта каждый кадр)
    const cg = new T.Group(); at(cg, TX, 0, TZ, null); clickable(cg, 'cube');
    cg.add(cube(kit, h, d.fb, hex(d.bodyCol), S));
    if (d.mode === 'held') {   // щипцы держат кубик над жидкостью
      for (const s of [-1, 1]) {
        at(box(0.6, 3, 2.4, C.STEEL), s * (S / 2 + 0.3), S / 2, 0, cg);
        h.limb(cg, v3(s * (S / 2 + 0.3), S / 2 + 1.4, 0), v3(s * 0.8, S + 7, 0), 0.32, C.STEEL, { edges: false });
        h.limb(cg, v3(s * 0.8, S + 7, 0), v3(s * 1.4, S + 12, 0), 0.6, 0xe0473a, { edges: false });
      }
      at(mesh(new T.SphereGeometry(0.7, 10, 8), C.STEEL, { edges: false }), 0, S + 7, 0, cg);
    }
    // силы: Fт вниз, FA вверх (длины как на схеме опыта)
    const aT = h.arrow(cg, 0xffb547, 4, 0.35); aT.rotation.z = Math.PI; aT.position.set(S / 2 + 2.4, S / 2, 1);
    const aA = h.arrow(cg, 0x72d4e8, 4, 0.35); aA.position.set(-S / 2 - 2.4, S / 2, 1);
    const len = rho => (10 + 46 * Math.sqrt(rho / 13600)) * KS;
    aT.userData.setLen(len(d.bodyRho));
    // круги на воде, когда кубик входит в жидкость
    const rip = mesh(new T.TorusGeometry(1, 0.12, 6, 40), 0xffffff, { edges: false, shadow: false, matOpt: { transparent: true, opacity: 0.8 } });
    rip.rotation.x = Math.PI / 2; rip.visible = false; at(rip, TX, surf + 0.1, TZ, null);
    // лоток с кубиками спереди: выбранного нет на месте
    at(box(70, 1.4, 12, C.WOOD2), 0, 0.7, 23, null);
    at(box(70, 3, 1, C.WOOD), 0, 1.5, 29.4, null);
    d.bodies.forEach((b, i) => {
      const x = -29.2 + i * 11.7;
      at(h.flat(10.6, 2.2, kit.textTex(b.n, '#1b1610', '#fff6e6', 300, 62)), x, 1.6, 29.95, null);
      if (b.k === d.fb) { at(box(S + 0.6, 0.1, S + 0.6, 0x8b6a45, { edges: false, shadow: false }), x, 1.45, 22.5, null); return; }
      const c = cube(kit, h, b.k, hex(b.c), S); at(c, x, 1.4, 22.5, null); clickable(c, 'fb-' + b.k);
    });
    const cubeTag = v3(0, 0, 0);
    if (shown.scene !== 'float') shown.cross = null; shown.scene = 'float';
    let ripT = -1;
    const put = (t) => {
      const L2 = live() || Lv;
      let y = base + (L2.yb - L2.fy - L2.A) * KS;
      if (d.mode === 'rest' && d.out === 'float' && !kit.reduce) y += 0.12 * Math.sin(t * 2.2);
      cg.position.y = y; cubeTag.set(TX, y + S + (d.mode === 'held' ? 13 : 2), TZ);
      const k = clamp((surf - y) / S, 0, 1);
      aA.visible = k > 0.01; if (k > 0.01) aA.userData.setLen(len(d.rho * k));
      const under = y < surf;
      if (shown.cross !== null && under && !shown.cross && d.mode !== 'held') ripT = t;
      shown.cross = under;
      if (ripT >= 0 && !kit.reduce) { const u = (t - ripT) / 1.2; if (u > 1) { rip.visible = false; ripT = -1; } else { rip.visible = true; rip.scale.setScalar(S * 0.7 + u * 12); rip.material.opacity = 0.8 * (1 - u); } }
    };
    put(0);
    kit.onFrame((dt, t) => put(t));
    tag(cubeTag, d.bodyName, `ρ = ${big(d.bodyRho)} кг/м³`);
    tag(v3(TX - W / 2 + 2, base + 6, TZ + D / 2), d.liqName, `ρ = ${big(d.rho)} кг/м³`);
    if (d.mode === 'rest') {
      const OUT = { float: 'плавает', sink: 'тонет', hover: 'плавает внутри' };
      tag(v3(TX + W / 2 + 4, 4, TZ + D / 2), 'Итог', OUT[d.out] + (d.out === 'float' && d.k != null ? ` · под жидк. ${Math.round(d.k * 100)}%` : ''), true);
    }
  };
})();
