// «Как в жизни» для биологии «Как живёт растение» (labs/bio-plantlife): водные культуры — пять банок с растениями на подоконнике и бутылки с солями N, P, K, Mg;
// элодея в стакане под настольной лампой с термостатом, пачкой соды и доской «что ограничивает»; потометр с побегом, окно день/ночь, вентилятор,
// термогигрометр и лупа с устьицем; питомник — лоток с образцами, две грядки (вегетативное / семенное), лейка и потомство.
// Сцены строятся из window.LUCH_REAL() опыта; набор деталей kit — из /luch/real3d.js.
(() => {
  const SC = (window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {});
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (x, n) => { let s = (Math.round(x * 10 ** n) / 10 ** n).toFixed(n); if (/^-0(\.0+)?$/.test(s)) s = s.slice(1); return s.replace('.', ',').replace('-', '−'); };
  const rnd = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const now = () => performance.now() / 1000;
  const mem = {};
  const FONT = '"Golos Text", "IBM Plex Sans", sans-serif', MONO = '"IBM Plex Mono", monospace';
  const HEALTHY = 0x5fbf6a, STEM = 0x4ea65a, VEIN = 0x2f7a3a, ROOT = 0xe8dcc0, CORK = 0x8a6a48, SOIL = 0x5a3f2c, SILL = 0xeef0f2;

  // свет в комнате: ночью гасим общий свет (сцены, где ночи нет, возвращают 1)
  const LIGHT0 = new WeakMap();
  function room(kit, k) {
    const sc = kit.root.parent; if (!sc) return;
    sc.children.forEach(o => {
      if (!(o.isHemisphereLight || o.isDirectionalLight)) return;
      if (!LIGHT0.has(o)) LIGHT0.set(o, o.intensity);
      o.intensity = LIGHT0.get(o) * k;
    });
  }

  // ---------- общие детали ----------
  function H(kit) {
    const { T, at, box, cyl, mesh, keep, grad, glowTex, textTex, clickable } = kit;
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    const glassMat = (color = 0xd8eef8, opacity = 0.24) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, transparent: true, opacity, side: T.DoubleSide, depthWrite: false }));
    const ownMat = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, ...o }));
    const basic = (color, o = {}) => keep(new T.MeshBasicMaterial({ color, ...o }));
    const spr = (map, color, opacity, add) => new T.Sprite(keep(new T.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending })));
    const glow = (color, size, opacity) => { const s = spr(glowTex(), color, opacity, true); s.scale.setScalar(size); return s; };
    const ball = (r, color, o = {}) => mesh(new T.SphereGeometry(r, o.seg || 18, o.seg2 || 12), color, { hull: o.hull ?? true, edges: false, matOpt: o.matOpt, mat: o.mat, shadow: o.shadow });
    // стержень между двумя точками
    function rod(parent, a, b, r, color, o = {}) {
      const dv = b.clone().sub(a), L = dv.length(); if (L < 0.01) return null;
      const m = cyl(r, L, color, { edges: false, hull: false, ...o });
      m.quaternion.setFromUnitVectors(v3(0, 1, 0), dv.normalize());
      return at(m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, parent);
    }
    // плоскость с холстом (этикетки, табло, доска)
    function canvasPlane(w, h, pw, draw, o = {}) {
      const ph = Math.round(pw * h / w), c = document.createElement('canvas'); c.width = pw; c.height = ph;
      const x = c.getContext('2d'), tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: tex, transparent: true, side: o.side || T.FrontSide })));
      if (draw) { draw(x, pw, ph); tex.needsUpdate = true; }
      return m;
    }
    const rr = (x, x0, y0, w, h, r) => { x.beginPath(); if (x.roundRect) x.roundRect(x0, y0, w, h, r); else x.rect(x0, y0, w, h); };
    function fitText(x, t, cx, cy, maxW, size, weight = 700, font = FONT, color = '#1b1610', align = 'center') {
      let fs = size; x.font = `${weight} ${fs}px ${font}`;
      const tw = x.measureText(t).width; if (tw > maxW) { fs = Math.floor(fs * maxW / tw); x.font = `${weight} ${fs}px ${font}`; }
      x.fillStyle = color; x.textAlign = align; x.textBaseline = 'middle'; x.fillText(t, cx, cy);
    }
    function wrapLines(x, t, maxW) {
      const out = []; let cur = '';
      for (const w of t.split(' ')) { const s = cur ? cur + ' ' + w : w; if (cur && x.measureText(s).width > maxW) { out.push(cur); cur = w; } else cur = s; }
      if (cur) out.push(cur); return out;
    }
    // лист: «приплюснутый эллипсоид» от основания (0) к кончику (+x); yaw — поворот вокруг стебля, tilt — подъём
    function leaf(parent, len, w, mat, yaw, tilt, o = {}) {
      const p = new T.Group(); p.rotation.set(0, yaw, tilt); parent.add(p);
      const g = new T.SphereGeometry(1, 18, 10); g.scale(len / 2, o.th || 0.35, w / 2); g.translate(len / 2, 0, 0);
      const m = mesh(g, 0, { mat, hull: o.hull ?? true, edges: false }); p.add(m);
      if (o.vein !== false) { const v = new T.Mesh(keep(new T.BoxGeometry(len * 0.86, 0.08, Math.max(0.12, w * 0.05))), basic(VEIN)); v.position.set(len * 0.47, (o.th || 0.35) * 0.92, 0); p.add(v); }
      return { p, m, len, w };
    }
    // стеклянная банка / стакан
    function beaker(parent, x, y0, z, r, h, o = {}) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const wall = new T.Mesh(keep(new T.CylinderGeometry(r, r * 0.97, h, 44, 1, true)), glassMat(0xd8eef8, o.op ?? 0.22)); at(wall, 0, h / 2, 0, g);
      wall.add(new T.Mesh(wall.geometry, kit.hullMat));
      at(cyl(r * 0.97, 0.6, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.45 } }), 0, 0.3, 0, g);
      const rim = mesh(new T.TorusGeometry(r, 0.24, 6, 44), 0xeef6fb, { edges: false, shadow: false }); rim.rotation.x = Math.PI / 2; at(rim, 0, h, 0, g);
      if (o.marks) { const a = 0.45; for (let k = 1; k <= 5; k++) { const m = box(k % 2 ? 1.1 : 2, 0.16, 0.1, 0x6f8098, { edges: false, shadow: false }); m.rotation.y = a; at(m, Math.sin(a) * (r + 0.05), h * k / 6.5, Math.cos(a) * (r + 0.05), g); } }
      return g;
    }
    function liquid(parent, x, y0, z, r, color, opacity, hgt) {
      const m = new T.Mesh(keep(new T.CylinderGeometry(r, r * 0.97, hgt, 40)), ownMat(color, { transparent: true, opacity, depthWrite: false }));
      return at(m, x, y0 + hgt / 2, z, parent);
    }
    function ring(parent, x, y, z, r, color = 0xffd166, th = 0.45) {
      const m = new T.Mesh(keep(new T.TorusGeometry(r, th, 6, 44)), basic(color));
      m.rotation.x = Math.PI / 2; return at(m, x, y, z, parent);
    }
    // кнопка на приборе: колпачок со значком сверху
    function button(parent, x, y, z, txt, color, key, w = 4.2) {
      const b = new T.Group(); at(b, x, y, z, parent);
      at(box(w, 1.4, 3.6, color), 0, 0.7, 0, b);
      const hx = '#' + color.toString(16).padStart(6, '0');
      const top = new T.Mesh(keep(new T.PlaneGeometry(w * 0.86, 2.9)), basic(0xffffff, { map: keep(textTex(txt, '#ffffff', hx, Math.round(96 * w / 3.2), 96)) }));
      top.rotation.x = -Math.PI / 2; at(top, 0, 1.42, 0, b);
      clickable(b, key); return b;
    }
    // табло с тёмным фоном и светлым текстом (строки через \n)
    function screen(w, h, txt, fg = '#86e0a8', pw = 320) {
      return canvasPlane(w, h, pw, (x, W, Hh) => {
        x.fillStyle = '#0e1520'; x.fillRect(0, 0, W, Hh);
        const ls = String(txt).split('\n'), lh = Hh / ls.length;
        ls.forEach((l, i) => fitText(x, l, W / 2, lh * (i + 0.5) + 2, W * 0.9, Math.round(lh * 0.64), 600, MONO, fg));
      });
    }
    let puffT = null;
    function puffTex() {
      if (puffT) return puffT;
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
      const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.5, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 64, 64); puffT = keep(new T.CanvasTexture(c)); return puffT;
    }
    // открытый конус света вдоль a→b
    function cone(parent, a, b, ra, rb, color, op) {
      const dv = b.clone().sub(a), L = dv.length(); if (L < 0.05) return null;
      const m = new T.Mesh(keep(new T.CylinderGeometry(Math.max(0.01, rb), Math.max(0.01, ra), L, 36, 1, true)),
        basic(color, { transparent: true, opacity: op, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending }));
      m.position.copy(a).addScaledVector(dv, 0.5); m.quaternion.setFromUnitVectors(v3(0, 1, 0), dv.normalize()); m.renderOrder = 2;
      parent.add(m); return m;
    }
    return { v3, glassMat, ownMat, basic, spr, glow, ball, rod, canvasPlane, rr, fitText, wrapLines, leaf, beaker, liquid, ring, button, screen, puffTex, cone };
  }

  // =====================================================================================
  // ===== Урок 1. Водные культуры: пять банок на подоконнике, бутылки с солями, записка с признаками =====
  SC['bpl-min'] = (kit, d) => {
    const { T, at, box, cyl, keep, tag, clickable } = kit, h = H(kit), v3 = h.v3;
    room(kit, 1);
    const g = new T.Group(); at(g, 0, 0, 0);
    // подоконник
    at(box(132, 1.2, 30, SILL), 0, 0.6, -8, g);
    // память: когда банку вылечили — листья зеленеют за полторы секунды
    const M = mem.min || { fixed: d.jars.map(J => J.fixed), t: d.jars.map(() => -99) };
    d.jars.forEach((J, j) => { if (J.fixed && !M.fixed[j]) M.t[j] = now(); if (!J.fixed) M.t[j] = -99; M.fixed[j] = J.fixed; });
    mem.min = M;
    const healK = j => { const J = d.jars[j]; if (!J.def) return 1; if (!J.fixed) return 0; return kit.reduce ? 1 : clamp((now() - M.t[j]) / 1.5, 0, 1); };
    const HSC = { N: 0.7, P: 0.64, K: 0.9, Mg: 0.92 };
    const anims = [];
    const R = 7.5, BH = 18, Y = 1.2, HS = 22, TT = [0.26, 0.46, 0.66, 0.86], LEN = [9, 8, 6.6, 4.6];
    const cH = new T.Color(HEALTHY);
    d.jars.forEach((J, j) => {
      const x = -48 + j * 24, z = -8, sel = d.jsel === j;
      const jg = new T.Group(); at(jg, x, Y, z, g); clickable(jg, 'jar-' + j);
      h.beaker(jg, 0, 0, 0, R, BH);
      const sick = J.def && !J.fixed;
      h.liquid(jg, 0, 0.6, 0, R - 0.45, sick ? 0x4f8fb0 : 0x5fb4d9, 0.32, BH - 3.6);
      // крышка с пробкой — держит растение
      at(cyl(R + 0.4, 0.8, 0x3a4762), 0, BH + 0.4, 0, jg);
      at(cyl(2.2, 2.2, CORK, { r2: 2.6 }), 0, BH + 1.1, 0, jg);
      // бумажная этикетка на банке
      const lb = h.canvasPlane(6.4, 4, 160, (c, W, Hh) => {
        c.fillStyle = '#fffaf0'; h.rr(c, 3, 3, W - 6, Hh - 6, 12); c.fill(); c.strokeStyle = '#1b1610'; c.lineWidth = 5; c.stroke();
        h.fitText(c, j ? J.lbl : 'К', W / 2, Hh / 2 + 2, W * 0.8, Hh * 0.66, 800, FONT, j ? '#1b1610' : '#2f7a3a');
      });
      at(lb, 0, 6.5, R + 0.1, jg);
      if (sel) h.ring(g, x, Y + 0.15, z, R + 2.2);
      // корни в растворе
      const rg = new T.Group(); at(rg, 0, BH - 0.2, 0, jg);
      [[0, 0, 0, 0, -13, 0], [0, -2, 0, -3.6, -10, 1], [0, -2, 0, 3.4, -10.5, -1], [0, -6, 0, -2.3, -12, -1.6], [0, -6, 0, 2.2, -12.4, 1.5], [0, -9, 0, 1.2, -13, 2]]
        .forEach(([a, b, c, e, f, k], i) => h.rod(rg, v3(a, b, c), v3(e, f, k), i ? 0.2 : 0.28, ROOT));
      // побег
      const pg = new T.Group(); at(pg, 0, BH + 2.2, 0, jg);
      const sg = new T.Group(); pg.add(sg);
      const stemMat = h.ownMat(J.def ? J.cols[3] : STEM);
      at(kit.mesh(new T.CylinderGeometry(0.45, 0.6, HS, 12), 0, { mat: stemMat, hull: true, edges: false }), 0, HS / 2, 0, sg);
      const bud = at(h.ball(1, 0x86d07a), 0, HS, 0, pg); bud.scale.y = 1.4;
      const leaves = TT.map((tt, i) => {
        const c0 = J.def ? J.cols[i] : HEALTHY, mat = h.ownMat(c0);
        const lf = h.leaf(pg, LEN[i], LEN[i] * 0.55, mat, (i % 2 ? 0 : Math.PI) + 0.5 + i * 0.25, 0.42);
        const extra = [];
        // калий: обожжённые бурые края нижних листьев
        if (J.def === 'K' && i < 2) {
          const bm = h.ownMat(0x8a4a1e, { transparent: true, opacity: 1 });
          const g2 = new T.SphereGeometry(1, 14, 8); g2.scale(LEN[i] * 0.2, 0.42, LEN[i] * 0.3); g2.translate(LEN[i] * 0.86, 0, 0);
          lf.p.add(new T.Mesh(keep(g2), bm)); extra.push(bm);
        }
        // магний: жилки зелёные, между ними жёлто
        if (J.def === 'Mg' && i < 2) {
          const vm = h.basic(0x2f8a3a, { transparent: true, opacity: 1 });
          [0.3, 0.55, 0.78].forEach(s => [-1, 1].forEach(sd => {
            const v = new T.Mesh(keep(new T.BoxGeometry(LEN[i] * 0.24, 0.08, 0.16)), vm);
            v.position.set(LEN[i] * (s + 0.06), 0.34, sd * LEN[i] * 0.09); v.rotation.y = -sd * 0.7; lf.p.add(v);
          }));
          extra.push(vm);
        }
        return { lf, mat, c0: new T.Color(c0), tt, extra };
      });
      const apply = k => {
        const hs = J.def ? HSC[J.def] + (1 - HSC[J.def]) * k : 1;
        sg.scale.y = hs; bud.position.y = HS * hs;
        leaves.forEach(L => {
          L.lf.p.position.y = HS * hs * L.tt; L.lf.p.scale.setScalar(0.72 + 0.28 * hs);
          L.mat.color.copy(L.c0).lerp(cH, k);
          L.extra.forEach(m => { m.opacity = 1 - k; m.visible = k < 0.99; });
        });
        if (J.def) stemMat.color.set(J.cols[3]).lerp(new T.Color(STEM), k);
        rg.scale.y = J.def === 'P' ? 0.5 + 0.5 * k : 1;
      };
      apply(healK(j));
      if (J.def && J.fixed && healK(j) < 1) anims.push(() => apply(healK(j)));
      // невидимая «ручка» побольше — по банке легко попасть
      const hit = new T.Mesh(keep(new T.BoxGeometry(18, 46, 18)), h.basic(0xffffff, { transparent: true, opacity: 0, depthWrite: false })); at(hit, 0, 23, 0, jg);
      tag(v3(x, Y + BH + 2.2 + HS + 4, z), j ? 'Банка ' + J.lbl : 'Контроль', !J.def ? 'полный раствор' : J.fixed ? '+' + J.sym + ' · здорова' : 'больна', sel);
    });
    if (anims.length) kit.onFrame(() => anims.forEach(f => f()));
    // бутылки с солями
    d.els.forEach((E, i) => {
      const x = -36 + i * 24, z = 24, sel = d.bsel === E.k;
      const bg = new T.Group(); at(bg, x, sel ? 3 : 0, z, g); clickable(bg, 'el-' + E.k);
      at(cyl(4, 11, 0xf3f4f6, { seg: 24 }), 0, 5.5, 0, bg);
      at(cyl(1.8, 2.2, 0xf3f4f6, { r2: 1.6, seg: 18 }), 0, 12.1, 0, bg);
      at(cyl(2, 2, E.c, { seg: 18 }), 0, 14.2, 0, bg);
      const lb = h.canvasPlane(6.6, 6.4, 200, (c, W, Hh) => {
        c.fillStyle = '#fffaf0'; h.rr(c, 3, 3, W - 6, Hh - 6, 14); c.fill(); c.strokeStyle = '#1b1610'; c.lineWidth = 5; c.stroke();
        c.fillStyle = '#' + E.c.toString(16).padStart(6, '0'); c.fillRect(8, 8, W - 16, Hh * 0.16);
        h.fitText(c, E.sym, W / 2, Hh * 0.5, W * 0.8, Hh * 0.4, 800, MONO, '#1b1610');
        h.fitText(c, E.salt, W / 2, Hh * 0.8, W * 0.84, Hh * 0.16, 700, FONT, '#3a3020');
      });
      at(lb, 0, 5.6, 4.06, bg);
      if (sel) { h.ring(g, x, 0.2, z, 6.2); at(h.glow(0xffd166, 16, 0.35), 0, 7, 0, bg); }
      tag(v3(x, (sel ? 3 : 0) + 18, z), E.sym, E.salt, sel);
    });
    // записка-«домик» с признаками выбранного растения
    const card = new T.Group(); at(card, 0, 0, 43, g);
    const note = h.canvasPlane(64, 10, 900, (c, W, Hh) => {
      c.fillStyle = '#fffaf0'; h.rr(c, 4, 4, W - 8, Hh - 8, 18); c.fill(); c.strokeStyle = '#1b1610'; c.lineWidth = 6; c.stroke();
      c.font = `600 34px ${FONT}`; const ls = h.wrapLines(c, d.note, W * 0.92).slice(0, 3), lh = (Hh - 20) / Math.max(2, ls.length);
      ls.forEach((l, i) => h.fitText(c, l, W / 2, 10 + lh * (i + 0.5), W * 0.94, 34, 600, FONT, '#1b1610'));
    });
    note.rotation.x = -0.9; at(note, 0, 4.2, 0, card);
    const back = box(64, 0.4, 10, 0xd9cdb4, { edges: false }); back.rotation.x = 0.9; at(back, 0, 4, -4.4, card);
    tag(v3(0, 10, 43), 'Вылечено', `${d.healed} из 4 · ошибок ${d.mist}`, d.healed === 4);
  };

  // ===== Урок 2. Элодея в стакане под настольной лампой =====
  SC['bpl-photo'] = (kit, d) => {
    const { T, at, box, cyl, keep, tag, clickable, cable } = kit, h = H(kit), v3 = h.v3;
    room(kit, 0.85);
    const g = new T.Group(); at(g, 0, 0, 0);
    const BX = 20, BZ = -2, R = 10, BH = 30, WL = 26, L = d.L / 100;
    // стакан с водой, песком и элодеей
    h.beaker(g, BX, 0, BZ, R, BH, { marks: true });
    const wc = new T.Color(0x2a6a8a).lerp(new T.Color(0x3a8aa0), d.soda / 3);
    h.liquid(g, BX, 0.6, BZ, R - 0.45, wc.getHex(), 0.4, WL - 0.6);
    at(cyl(R - 0.5, 2.4, 0x8a7a58, { edges: false, hull: false }), BX, 1.8, BZ, g);
    const top = v3(BX - 1.5, 23, BZ);
    const elo = new T.Group(); at(elo, 0, 0, 0, g); clickable(elo, 'elodea');
    h.rod(elo, v3(BX + 0.5, 2.6, BZ), v3(BX + 1, 12, BZ), 0.42, 0x3f8f4c);
    h.rod(elo, v3(BX + 1, 12, BZ), top, 0.42, 0x3f8f4c);
    const lm = h.ownMat(HEALTHY);
    for (let y = 4; y < 22.5; y += 2.1) {
      const k = (y - 2.6) / (23 - 2.6), cx = y < 12 ? BX + 0.5 + (y - 2.6) / 9.4 * 0.5 : BX + 1 - (y - 12) / 11 * 2.5;
      const wg = new T.Group(); at(wg, cx, y, BZ, elo);
      for (let s = 0; s < 3; s++) h.leaf(wg, 2.6 - k * 0.6, 0.9, lm, s * 2.094 + y * 0.7, 0.55, { hull: false, vein: false, th: 0.14 });
    }
    at(h.ball(0.6, 0xa7dc94, { hull: false }), top.x, top.y + 0.2, top.z, elo);
    // пузырьки кислорода из среза стебля: темп — B в минуту
    const bub = [], bm = h.basic(0xffffff, { transparent: true, opacity: 0.75, depthWrite: false }), bg = keep(new T.SphereGeometry(1, 10, 8));
    for (let i = 0; i < 12; i++) { const m = new T.Mesh(bg, bm); m.visible = false; at(m, top.x, top.y, top.z, g); bub.push(m); }
    if (d.B > 0) {
      const period = 60 / d.B, rise = 1.6;
      kit.onFrame((dt, t) => {
        bub.forEach((m, j) => {
          const age = kit.reduce ? j * 0.3 : (t % period) + j * period;
          m.visible = age < rise && (!kit.reduce || j < Math.min(6, Math.ceil(d.B / 8)));
          if (!m.visible) return;
          const k = age / rise;
          m.position.set(top.x + Math.sin(age * 5 + j) * 0.3, top.y + 0.8 + k * (WL - top.y - 0.6), top.z);
          m.scale.setScalar(0.35 + 0.3 * k);
        });
      });
    }
    // термометр в стакане
    const tx = BX + 6, tz = BZ + 4.5;
    at(cyl(0.7, 30, 0xeef6fb, { matOpt: { transparent: true, opacity: 0.6 } }), tx, 18, tz, g);
    const col = Math.max(0.6, 26 * clamp(d.temp, 0, 45) / 45);
    at(cyl(0.32, col, 0xe0473a, { edges: false, hull: false }), tx, 3.4 + col / 2, tz, g);
    at(h.ball(1.1, 0xe0473a), tx, 3, tz, g);
    // нагреватель с термостатом
    const hx = BX - 5.5, hz = BZ - 5;
    at(cyl(0.9, 22, 0x3a4762), hx, 14, hz, g);
    if (d.temp > 22) at(h.glow(0xff8a3c, 6, clamp((d.temp - 22) / 18, 0.15, 0.6)), hx, 6, hz, g);
    const th = new T.Group(); at(th, 46, 0, 18, g);
    at(box(14, 7, 9, 0x3b4a66), 0, 3.5, 0, th);
    const scr = h.screen(10, 4, `${d.temp} °C`, d.temp > 32 ? '#ff8a73' : '#86e0a8'); at(scr, 0, 3.8, 4.56, th);
    h.button(th, -3.4, 7, 0, '−', 0x3b6fd8, 'cold', 4.2);
    h.button(th, 3.4, 7, 0, '+', 0xe0473a, 'warm', 4.2);
    cable(v3(hx, 25, hz), v3(46, 4, 13.5), 0x2c3240, 0, { r: 0.5, lift: 4 });
    // настольная лампа: чем ближе, тем ярче
    const LX = BX - R - 3 - d.dist * 0.85, LY = 15;
    const lamp = new T.Group(); at(lamp, 0, 0, 0, g);
    at(box(11, 1.6, 10, 0x2c3240), LX - 8, 0.8, BZ, lamp);
    h.rod(lamp, v3(LX - 8, 1.6, BZ), v3(LX - 8, LY + 4, BZ), 0.55, 0x56627d, { hull: true });
    h.rod(lamp, v3(LX - 8, LY + 4, BZ), v3(LX - 3, LY + 1, BZ), 0.55, 0x56627d, { hull: true });
    const shade = cyl(1.8, 6, 0x8b96ad, { r2: 4.6, seg: 24 }); shade.rotation.z = -Math.PI / 2; at(shade, LX - 1, LY, BZ, lamp);
    const bulbC = new T.Color(0x6a5a3a).lerp(new T.Color(0xfff2b0), L);
    at(h.ball(2, bulbC.getHex(), { matOpt: { emissive: 0xffc23a, emissiveIntensity: 0.4 + 0.6 * L } }), LX + 1.4, LY, BZ, lamp);
    at(h.glow(0xffd27a, 12 + 14 * L, 0.3 + 0.55 * L), LX + 2, LY, BZ, lamp);
    at(new T.PointLight(0xffc860, 20 + 50 * L, 90, 1.2), LX + 3, LY, BZ, g);
    h.cone(g, v3(LX + 2.5, LY, BZ), v3(BX, 14, BZ), 4, R + 1, 0xffd36b, 0.04 + 0.2 * L);
    clickable(lamp, 'near');
    h.button(g, LX - 10.6, 1.6, BZ + 2.2, '←', 0x3b6fd8, 'far', 3.6);
    h.button(g, LX - 5.4, 1.6, BZ + 2.2, '→', 0x3fae5a, 'near', 3.6);
    // рулетка от лампы до стакана
    const x0 = LX + 1.4, x1 = BX - R, rz = BZ + 14;
    if (x1 - x0 > 1) {
      at(box(x1 - x0, 0.3, 2.6, 0xf2c94c, { edges: true }), (x0 + x1) / 2, 0.15, rz, g);
      for (let k = 0; k <= d.dist; k += 5) at(box(0.25, 0.08, k % 10 ? 1 : 1.8, 0x3a2e22, { edges: false, shadow: false }), x1 - k * 0.85, 0.34, rz - 0.4, g);
    }
    // пачка соды: ложка — больше CO₂
    const sd = new T.Group(); at(sd, 46, 0, -16, g); clickable(sd, 'soda');
    at(box(8, 11, 5.5, 0xf3f4f6), 0, 5.5, 0, sd);
    at(box(8.1, 3, 5.6, 0xf07c1e, { edges: false }), 0, 9.2, 0, sd);
    const sl = h.canvasPlane(7, 5, 200, (c, W, Hh) => { h.fitText(c, 'СОДА', W / 2, Hh * 0.32, W * 0.86, Hh * 0.36, 800, FONT, '#c0392b'); h.fitText(c, 'NaHCO₃', W / 2, Hh * 0.74, W * 0.86, Hh * 0.26, 700, MONO, '#1b1610'); });
    at(sl, 0, 4.8, 2.8, sd);
    for (let i = 0; i < 3; i++) at(h.ball(0.7, i < d.soda ? 0xffffff : 0x56627d, { hull: false }), -2.6 + i * 2.6, 11.6, 0, sd);
    const sp = box(1, 0.4, 7, 0xc6ccd6); sp.rotation.y = 0.4; at(sp, 7, 0.4, 1, sd);
    // кувшин со свежей водой
    const jg = new T.Group(); at(jg, -2, 0, 30, g); clickable(jg, 'fresh');
    h.beaker(jg, 0, 0, 0, 5, 13);
    h.liquid(jg, 0, 0.6, 0, 4.6, 0x5fb4e0, 0.35, 9);
    const hd = kit.mesh(new T.TorusGeometry(3, 0.5, 8, 20, Math.PI), 0xd8eef8, { edges: false }); hd.rotation.z = -Math.PI / 2; at(hd, 5, 7, 0, jg);
    // доска «что ограничивает»
    const bd = new T.Group(); at(bd, -16, 0, -36, g); clickable(bd, 'limits');
    at(box(1.4, 26, 1.4, 0x8a6a48), -17, 13, 0, bd); at(box(1.4, 26, 1.4, 0x8a6a48), 17, 13, 0, bd);
    at(box(36, 21, 1, 0x3a2e22), 0, 17, 0, bd);
    const rows = [['свет', d.rL, 'L'], ['CO₂', d.rC, 'C'], ['тепло', d.rT, 'T']];
    const brd = h.canvasPlane(34, 19, 680, (c, W, Hh) => {
      c.fillStyle = '#1f3a2c'; c.fillRect(0, 0, W, Hh);
      h.fitText(c, 'что ограничивает', W / 2, Hh * 0.12, W * 0.9, Hh * 0.1, 700, FONT, '#e8ecf4');
      rows.forEach(([s, v, k], i) => {
        const y = Hh * (0.32 + i * 0.2), lim = d.lim === k, cc = lim ? '#ffb547' : '#9fe0f0';
        h.fitText(c, s, W * 0.04, y, W * 0.2, Hh * 0.1, 700, FONT, cc, 'left');
        c.fillStyle = 'rgba(255,255,255,.15)'; h.rr(c, W * 0.25, y - Hh * 0.045, W * 0.56, Hh * 0.09, 8); c.fill();
        c.fillStyle = cc; h.rr(c, W * 0.25, y - Hh * 0.045, Math.max(6, W * 0.56 * clamp(v / 50, 0, 1)), Hh * 0.09, 8); c.fill();
        h.fitText(c, String(Math.round(v)), W * 0.95, y, W * 0.12, Hh * 0.1, 700, MONO, cc, 'right');
      });
      h.fitText(c, 'пуз./мин, если бы мешал только он', W / 2, Hh * 0.91, W * 0.9, Hh * 0.07, 500, FONT, '#c3cbdb');
    });
    at(brd, 0, 17, 0.55, bd);
    const limN = { L: 'свет', C: 'CO₂', T: 'тепло' }[d.lim];
    tag(v3(LX, LY + 9, BZ), 'Лампа', `${d.dist} см · свет ${d.L}%`, d.lim === 'L');
    tag(v3(BX, BH + 5, BZ), 'Элодея', `${d.B} пуз./мин`, d.B >= 40);
    tag(v3(46, 13, 18), 'Термостат', `${d.temp} °C`, d.lim === 'T');
    tag(v3(46, 15, -16), 'Сода', `${d.soda} из 3 ложек`, d.lim === 'C');
    tag(v3(-16, 30, -36), 'Ограничивает', limN, true);
  };

  // ===== Урок 3. Потометр: побег в трубке с водой, пузырёк в капилляре, окно, вентилятор, термогигрометр, лупа =====
  SC['bpl-transp'] = (kit, d) => {
    const { T, at, box, cyl, keep, tag, clickable } = kit, h = H(kit), v3 = h.v3;
    room(kit, d.night ? 0.42 : 1);
    const g = new T.Group(); at(g, 0, 0, 0);
    const PX = -10, PZ = 6, CY = 4.4;
    // доска-основание с линейкой
    at(box(72, 2, 16, 0xc98f55), 10, 1, 4, g);
    at(box(54, 0.3, 3.4, 0xf1e3c2, { edges: true }), 19, 2.15, PZ + 3.4, g);
    for (let k = 0; k <= 26; k++) at(box(0.25, 0.08, k % 2 ? 1 : 1.9, 0x3a2e22, { edges: false, shadow: false }), 44 - k * 1.92, 2.34, PZ + 2.6 + (k % 2 ? 0.4 : 0), g);
    const nums = h.canvasPlane(54, 1.6, 1200, (c, W, Hh) => { for (let k = 0; k <= 130; k += 20) h.fitText(c, String(k), W * (1 - (k / 130) * (50 / 54)) - W * 2 / 54, Hh / 2, 60, Hh * 0.9, 600, MONO, '#3a2e22'); });
    nums.rotation.x = -Math.PI / 2; at(nums, 19, 2.33, PZ + 4.5, g);
    // трубки: вертикальная с побегом и горизонтальный капилляр
    const tube = new T.Group(); at(tube, 0, 0, 0, g); clickable(tube, 'tube');
    const gm = h.glassMat(0xd8eef8, 0.3), wm = h.ownMat(0x2a6a8a, { transparent: true, opacity: 0.6, depthWrite: false });
    const vt = new T.Mesh(keep(new T.CylinderGeometry(1.4, 1.4, 14, 20, 1, true)), gm); at(vt, PX, CY + 7, PZ, tube); vt.add(new T.Mesh(vt.geometry, kit.hullMat));
    at(new T.Mesh(keep(new T.CylinderGeometry(1.05, 1.05, 14, 16)), wm), PX, CY + 7, PZ, tube);
    const ht = new T.Mesh(keep(new T.CylinderGeometry(0.9, 0.9, 56, 16, 1, true)), gm); ht.rotation.z = Math.PI / 2; at(ht, PX + 28, CY, PZ, tube); ht.add(new T.Mesh(ht.geometry, kit.hullMat));
    const hw = new T.Mesh(keep(new T.CylinderGeometry(0.6, 0.6, 56, 12)), wm); hw.rotation.z = Math.PI / 2; at(hw, PX + 28, CY, PZ, tube);
    at(h.ball(1.5, 0xd8eef8, { mat: gm, hull: true }), PX, CY, PZ, tube);
    at(cyl(1.9, 2.6, 0x2c2f38, { r2: 2.2 }), PX, CY + 15.2, PZ, g);
    // штатив держит трубку
    at(cyl(0.6, 30, kit.C.STEEL, { edges: false }), PX - 9, 17, PZ - 4, g);
    h.rod(g, v3(PX - 9, 13, PZ - 4), v3(PX, 13, PZ), 0.4, kit.C.STEEL);
    at(box(3.4, 2.4, 3.4, 0x3b4a66), PX, 13, PZ, g);
    // пузырёк воздуха ползёт к растению
    const bub = kit.mesh(new T.SphereGeometry(1, 16, 10), 0, { mat: h.basic(0x0e1520, { transparent: true, opacity: 0.85 }), hull: true, edges: false });
    bub.scale.set(1.5, 0.55, 0.55); at(bub, 44, CY, PZ, g);
    const M = mem.transp || (mem.transp = { bpos: 0 });
    // побег
    const SY = CY + 16.5, TOP = 52;
    at(kit.mesh(new T.CylinderGeometry(0.5, 0.7, TOP - SY, 12), STEM, { hull: true, edges: false }), PX, (SY + TOP) / 2, PZ, g);
    const bud = at(h.ball(1, 0x86d07a), PX, TOP, PZ, g); bud.scale.y = 1.4;
    const TN = [[282, 38], [258, 37], [232, 34], [206, 31], [180, 27], [156, 22]];
    const lm = h.ownMat(HEALTHY), alive = [];
    TN.forEach(([ny, len], i) => {
      const y = SY + 3 + (300 - ny - 18) / 126 * (TOP - SY - 6), yaw = (i % 2 ? 0 : Math.PI) + 0.5 + i * 0.35;
      if (d.leaves[i]) {
        const lg = new T.Group(); at(lg, PX, y, PZ, g); clickable(lg, 'lf-' + i);
        const L = h.leaf(lg, len * 0.24, len * 0.24 * 0.5, lm, yaw, 0.28);
        alive.push({ x: PX + Math.cos(yaw) * L.len * 0.5, y: y + 0.8, z: PZ - Math.sin(yaw) * L.len * 0.5 });
      } else at(h.ball(0.55, 0x8a6a48, { hull: false }), PX + Math.cos(yaw) * 0.6, y, PZ - Math.sin(yaw) * 0.6, g);
    });
    // пар над листьями
    const nv = Math.min(18, Math.round(d.E * 3)), puffs = [];
    for (let i = 0; i < nv && alive.length; i++) { const s = h.spr(h.puffTex(), 0xc3e6f4, 0, false); g.add(s); puffs.push({ s, p: alive[i % alive.length], ph: i / Math.max(1, nv), dx: (rnd(i + 3) - 0.5) * 3 }); }
    const wsp = [0, 6, 14][d.wind] || 0;
    // вентилятор
    const fan = new T.Group(); at(fan, -44, 0, 16, g); clickable(fan, 'wind');
    at(cyl(4.5, 1.2, 0x3a4762), 0, 0.6, 0, fan);
    at(cyl(0.6, 12, kit.C.STEEL, { edges: false }), 0, 7, 0, fan);
    at(box(4, 3.6, 3.6, 0x3a4762), -1, 14, 0, fan);
    const cage = kit.mesh(new T.TorusGeometry(6, 0.3, 6, 40), 0x8b96ad, { edges: false }); cage.rotation.y = Math.PI / 2; at(cage, 2, 14, 0, fan);
    const blades = new T.Group(); at(blades, 1.8, 14, 0, fan);
    for (let i = 0; i < 3; i++) { const bl = new T.Group(); bl.rotation.x = i * 2.094; blades.add(bl); const b = box(0.4, 5, 2.4, d.wind ? 0x72d4e8 : 0xc6ccd6); b.rotation.y = 0.35; at(b, 0, 3, 0, bl); }
    at(h.ball(0.9, 0x3a4762), 2.3, 14, 0, fan);
    const streaks = [];
    for (let i = 0; i < (d.wind ? 2 + 2 * d.wind : 0); i++) { const m = new T.Mesh(keep(new T.BoxGeometry(4 + 2 * d.wind, 0.18, 0.18)), h.basic(0x72d4e8, { transparent: true, opacity: 0.6, depthWrite: false })); g.add(m); streaks.push({ m, ph: i * 0.37, y: 9 + (i * 5.3) % 12, z: 16 - (i * 3.1) % 10 }); }
    // окно: день — солнце, ночь — луна
    const win = new T.Group(); at(win, -36, 0, -40, g); clickable(win, 'night');
    at(box(32, 2, 4, SILL), 0, 5, 1, win);
    [[-15, 19], [15, 19]].forEach(([x]) => at(box(2, 28, 2, 0xf3f4f6), x, 19, 0, win));
    at(box(32, 2, 2, 0xf3f4f6), 0, 33, 0, win); at(box(1, 26, 1, 0xf3f4f6), 0, 19, 0.2, win);
    at(new T.Mesh(keep(new T.PlaneGeometry(28, 26)), h.basic(d.night ? 0x0e1834 : 0x8fd0ff)), 0, 19, -0.4, win);
    if (d.night) {
      at(h.ball(2.6, 0xd8dcea, { hull: false, matOpt: { emissive: 0xd8dcea, emissiveIntensity: 0.6 } }), 6, 26, -0.1, win);
      at(h.ball(2.4, 0x0e1834, { hull: false, edges: false }), 7.4, 26.8, 0.4, win);
      for (let i = 0; i < 7; i++) at(h.ball(0.22, 0xffffff, { hull: false }), -12 + rnd(i) * 24, 10 + rnd(i + 5) * 20, -0.2, win);
    } else {
      at(h.ball(3, 0xffd36b, { matOpt: { emissive: 0xffc23a, emissiveIntensity: 0.6 } }), -6, 26, 0, win);
      at(h.glow(0xffd36b, 16, 0.7), -6, 26, 0.5, win);
    }
    // термогигрометр с кнопками
    const st = new T.Group(); at(st, 38, 0, 30, g);
    at(box(18, 9, 6, 0xe8ecf4), 0, 4.5, 0, st);
    const scr = h.screen(15, 6, `${d.temp} °C\n${d.hum} %`, '#86e0a8'); at(scr, 0, 4.6, 3.06, st);
    h.button(st, -6.6, 9, 0, '+°', 0xe0473a, 'hot', 3.6);
    h.button(st, -2.2, 9, 0, '−°', 0x3b6fd8, 'coolt', 3.6);
    h.button(st, 2.2, 9, 0, 'суше', 0xf07c1e, 'dry', 3.6);
    h.button(st, 6.6, 9, 0, 'влажн', 0x2f9e8f, 'wet', 3.6);
    // кнопка «вернуть листья» на доске
    if (d.n < 6) h.button(g, 34, 2, -1.5, '↺ листья', 0x3fae5a, 'leaves', 8);
    // лупа: устьице ×400
    const lp = new T.Group(); at(lp, 22, 0, -28, g); clickable(lp, 'stoma');
    at(cyl(3.6, 1, 0x3a4762), 0, 0.5, 0, lp); at(cyl(0.5, 10, kit.C.STEEL, { edges: false }), 0, 5.5, 0, lp);
    const rim = kit.mesh(new T.TorusGeometry(7.4, 0.8, 10, 48), 0x2c3240, { edges: false }); at(rim, 0, 17, 0, lp);
    const gap = 1 + 5 * d.st;
    const lens = h.canvasPlane(14.6, 14.6, 420, (c, W) => {
      const s = W / 156, cx = W / 2, cy = W / 2;
      c.save(); c.beginPath(); c.arc(cx, cy, W / 2, 0, 7); c.clip();
      c.fillStyle = '#cfe6c8'; c.fillRect(0, 0, W, W);
      c.strokeStyle = '#8fb08a'; c.lineWidth = 3; [[10, 30, 50, 20, 70, 40], [90, 45, 120, 22, 150, 36], [8, 120, 46, 134, 66, 116], [96, 118, 116, 136, 150, 126]].forEach(p => { c.beginPath(); c.moveTo(p[0] * s, p[1] * s); c.lineTo(p[2] * s, p[3] * s); c.lineTo(p[4] * s, p[5] * s); c.stroke(); });
      [-1, 1].forEach(sd => {
        const gx = cx + sd * (13 + gap) * s;
        c.fillStyle = '#2f6a35'; c.strokeStyle = '#1b3a1e'; c.lineWidth = 3; c.beginPath(); c.ellipse(gx, cy, 13 * s, 34 * s, 0, 0, 7); c.fill(); c.stroke();
        c.fillStyle = '#86e0a8'; for (let q = 0; q < 4; q++) { c.beginPath(); c.arc(gx + sd * 3 * s, cy - 18 * s + q * 12 * s, 2.6 * s, 0, 7); c.fill(); }
      });
      c.fillStyle = '#05080e'; c.beginPath(); c.ellipse(cx, cy, gap * s, 26 * s, 0, 0, 7); c.fill();
      if (d.st > 0.5) { c.fillStyle = 'rgba(195,230,244,.85)'; for (let i = 0; i < 6; i++) { const a = i * 1.1; c.beginPath(); c.arc(cx + Math.cos(a) * 24 * s, cy - 30 * s + Math.sin(a) * 10 * s, 3 * s, 0, 7); c.fill(); } }
      c.restore();
    });
    at(lens, 0, 17, 0.2, lp);
    const back = lens.clone(); back.rotation.y = Math.PI; at(back, 0, 17, -0.2, lp);
    // анимация: лопасти, ветер, пар, пузырёк
    kit.onFrame((dt, t) => {
      if (kit.reduce) { bub.position.x = 44 - M.bpos * 50; return; }
      blades.rotation.x += wsp * dt;
      M.bpos = (M.bpos + d.E * dt * 0.06) % 1;
      bub.position.x = 44 - M.bpos * 50;
      streaks.forEach(s => { const k = (t * (0.5 + 0.4 * d.wind) + s.ph) % 1; s.m.position.set(-38 + k * 24, s.y, s.z); s.m.material.opacity = 0.6 * (1 - k); });
      puffs.forEach(q => {
        const k = (t / 2.2 + q.ph) % 1;
        q.s.position.set(q.p.x + q.dx * (0.4 + k) + d.wind * 5 * k, q.p.y + k * 8, q.p.z);
        q.s.scale.setScalar(1.6 + 2.4 * k); q.s.material.opacity = 0.7 * Math.sin(Math.PI * k);
      });
    });
    if (kit.reduce) puffs.forEach((q, i) => { const k = (i % 4) / 4 + 0.15; q.s.position.set(q.p.x + q.dx * k, q.p.y + k * 8, q.p.z); q.s.scale.setScalar(2.4); q.s.material.opacity = 0.5; });
    const ok = d.E >= 5 || (d.hi && d.E <= 0.5);
    tag(v3(26, 7, PZ), 'Потометр', `${fmt(d.E, 2)} мл/ч`, ok);
    tag(v3(PX, TOP + 4, PZ), 'Побег', `листьев ${d.n} из 6`);
    tag(v3(-36, 36, -40), d.night ? 'Ночь' : 'День', d.night ? 'устьица закрыты' : 'устьица открыты');
    tag(v3(-44, 22, 16), 'Вентилятор', 'ветер: ' + d.windName, d.wind > 0);
    tag(v3(38, 13, 30), 'Воздух', `${d.temp} °C · ${d.hum} %`);
    tag(v3(22, 27, -28), 'Устьице ×400', d.st > 0.5 ? 'щель открыта' : 'щель закрыта');
  };

  // ===== Урок 4. Питомник: лоток с образцами, две грядки, лейка, потомство =====
  function sample(kit, h, id, c) {
    const { T, at, box, cyl } = kit, v3 = h.v3, g = new T.Group();
    const dish = () => at(cyl(3.4, 0.5, 0xf3f4f6, { seg: 24 }), 0, 0.25, 0, g);
    if (id === 'potato') {
      const b = at(h.ball(1, 0xd9b070), 0, 2.2, 0, g); b.scale.set(3.2, 2.1, 2.4);
      [[-1.2, 3.6, 1.6], [1.4, 3.4, 1.2], [0.4, 3.9, -1.2]].forEach(([x, y, z]) => at(h.ball(0.3, 0x6a4a24, { hull: false }), x, y, z, g));
      h.rod(g, v3(1.4, 3.9, 1.2), v3(2.4, 5.6, 1.6), 0.3, 0xb8d880);
    } else if (id === 'tulip') {
      const pts = [[0, 0], [2.6, 0.4], [3, 1.8], [2.2, 3.4], [0.9, 4.8], [0.2, 5.6]].map(([x, y]) => new T.Vector2(x, y));
      at(kit.mesh(new T.LatheGeometry(pts, 24), 0xc99a6a, { hull: true, edges: false }), 0, 0.3, 0, g);
      h.rod(g, v3(0, 5.6, 0), v3(0, 7.4, 0), 0.4, 0x86d07a);
      [-1, 0, 1].forEach(s => h.rod(g, v3(s * 0.8, 0.4, 0), v3(s * 1.6, -0.2, 0.6), 0.15, ROOT));
    } else if (id === 'straw') {
      const lm = h.ownMat(HEALTHY);
      const ro = new T.Group(); at(ro, -2.2, 0.4, 0, g);
      for (let i = 0; i < 3; i++) h.leaf(ro, 2.4, 1.6, lm, i * 2.094, 0.5, { hull: false });
      h.rod(g, v3(-1.4, 0.8, 0), v3(2.4, 0.6, 0.4), 0.18, 0xc96a5a);
      const d2 = new T.Group(); at(d2, 2.8, 0.4, 0.4, g);
      for (let i = 0; i < 3; i++) h.leaf(d2, 1.5, 1, lm, i * 2.094 + 0.5, 0.6, { hull: false, vein: false });
      at(h.ball(0.6, 0xe0574f), -2.2, 1.6, 1.4, g);
    } else if (id === 'violet') {
      h.beaker(g, 0, 0, 0, 2.2, 4.6);
      h.liquid(g, 0, 0.6, 0, 1.9, 0x5fb4d9, 0.4, 3.2);
      h.rod(g, v3(0, 1.4, 0), v3(0.6, 6.4, 0), 0.2, 0x4ea65a);
      const lf = new T.Group(); at(lf, 0.6, 6.4, 0, g); h.leaf(lf, 3.6, 3, h.ownMat(0x3f8f4c), 0.3, 0.4);
      [-1, 1].forEach(s => h.rod(g, v3(0, 1.4, 0), v3(s * 0.9, 0.7, 0.3), 0.1, ROOT));
    } else if (id === 'graft') {
      at(cyl(0.9, 4, 0x7a5a3a, { edges: false }), 0, 2, 0, g);
      at(cyl(0.65, 4, 0x9a7a4a, { edges: false }), 0, 5.6, 0, g);
      at(cyl(1, 1.4, 0xe8ecf4, { edges: false }), 0, 4, 0, g);
      const lf = new T.Group(); at(lf, 0, 6.4, 0, g); h.leaf(lf, 2.6, 1.4, h.ownMat(HEALTHY), 0.6, 0.5, { hull: false });
      at(h.ball(0.4, 0x86d07a, { hull: false }), 0, 7.7, 0, g);
    } else if (id === 'aseed') {
      dish(); at(h.ball(1.9, c), -0.9, 2.3, -0.6, g);
      h.rod(g, v3(-0.9, 4, -0.6), v3(-0.6, 5, -0.6), 0.15, 0x5a3a1e);
      const s = at(h.ball(0.5, 0x4a2c18, { hull: false }), 1.8, 0.85, 1, g); s.scale.set(1, 0.6, 1.6);
    } else if (id === 'sunfl') {
      dish();
      [[-1, 0.3], [0.8, -0.6], [0.4, 1.2]].forEach(([x, z], i) => { const s = at(h.ball(0.55, 0x1c1c1c, { hull: false }), x, 0.85, z, g); s.scale.set(1, 0.6, 1.9); s.rotation.y = i; });
    } else {
      dish();
      [[-1, 0.2], [1, -0.4]].forEach(([x, z], i) => { const s = at(h.ball(0.7, 0xf2ead0), x, 0.9, z, g); s.scale.set(1, 0.4, 1.6); s.rotation.y = i * 0.8; });
    }
    return g;
  }
  SC['bpl-repro'] = (kit, d) => {
    const { T, at, box, cyl, keep, tag, clickable } = kit, h = H(kit), v3 = h.v3;
    room(kit, 1);
    const g = new T.Group(); at(g, 0, 0, 0);
    const BZ = 12, BW = 52, BD = 28;
    const bedX = b => (b ? 29 : -29);
    // грядки
    d.beds.forEach((B, b) => {
      const bx = bedX(b), bg = new T.Group(); at(bg, bx, 0, BZ, g); clickable(bg, 'bed-' + b);
      at(box(BW, 5, 1.6, 0xb47944), 0, 2.5, -BD / 2, bg); at(box(BW, 5, 1.6, 0xb47944), 0, 2.5, BD / 2, bg);
      at(box(1.6, 5, BD, 0xb47944), -BW / 2, 2.5, 0, bg); at(box(1.6, 5, BD, 0xb47944), BW / 2, 2.5, 0, bg);
      at(box(BW - 1.6, 3.6, BD - 1.6, SOIL, { edges: false }), 0, 1.8, 0, bg);
      for (let i = 0; i < 4; i++) at(box(BW - 3, 0.3, 1, 0x6a4a34, { edges: false, shadow: false }), 0, 3.7, -9 + i * 6, bg);
      const hx = '#' + B.c.toString(16).padStart(6, '0');
      const sign = h.canvasPlane(22, 4.4, 500, (c, W, Hh) => { c.fillStyle = '#fffaf0'; h.rr(c, 3, 3, W - 6, Hh - 6, 14); c.fill(); c.strokeStyle = hx; c.lineWidth = 8; c.stroke(); h.fitText(c, B.name + (b ? ' (половое)' : ''), W / 2, Hh / 2 + 2, W * 0.9, Hh * 0.56, 800, FONT, '#1b1610'); });
      at(box(1, 8, 1, 0x8a6a48), -9, 4, BD / 2 + 1.4, bg); at(box(1, 8, 1, 0x8a6a48), 9, 4, BD / 2 + 1.4, bg);
      at(sign, 0, 7, BD / 2 + 2, bg);
      const nb = d.items.filter(it => it.bin === b).length, okb = d.items.filter(it => it.bin === b && it.ok).length;
      tag(v3(bx, 14, BZ + BD / 2), B.name, `${nb} обр.` + (d.full ? ` · верно ${okb}` : '') + (d.grown ? (b ? ' · дети разные' : ' · дети-копии') : ''), d.csel >= 0);
    });
    // лоток для образцов
    at(box(104, 1.2, 15, 0xf1f3f5), 0, 0.6, -28, g);
    at(box(104, 1.6, 0.8, 0xf1f3f5), 0, 1.4, -35.1, g); at(box(104, 1.6, 0.8, 0xf1f3f5), 0, 1.4, -20.9, g);
    // память: момент «вырастить» — ростки поднимаются
    const M = mem.repro || (mem.repro = { grown: false, t: -99 });
    if (d.grown && !M.grown) M.t = now();
    M.grown = d.grown;
    const growK = () => kit.reduce ? 1 : clamp((now() - M.t) / 0.9, 0, 1);
    const sprouts = [];
    const cnt = [0, 0];
    d.items.forEach((it, c) => {
      let x, y = 0, z;
      if (it.bin >= 0) { const k = cnt[it.bin]++; x = bedX(it.bin) - 18 + (k % 4) * 12; z = BZ - 6 + Math.floor(k / 4) * 12; y = 3.6; }
      else { x = -45.5 + c * 13; z = -28; y = 1.2; }
      const sel = d.csel === c;
      const ig = sample(kit, h, it.id, it.c); at(ig, x, y + (sel ? 3 : 0), z, g); clickable(ig, 'it-' + c);
      const hit = new T.Mesh(keep(new T.BoxGeometry(8, 8, 8)), h.basic(0xffffff, { transparent: true, opacity: 0, depthWrite: false })); at(hit, 0, 3, 0, ig);
      if (sel) { h.ring(g, x, y + 0.2, z, 5); at(h.glow(0xffd166, 14, 0.3), x, y + 5, z, g); }
      if (d.full && it.bin >= 0) h.ring(g, x, y + 0.15, z, 4.4, it.ok ? 0x86e0a8 : 0xff8a73, 0.35);
      // карточка с названием
      const cd = h.canvasPlane(10.6, 3.4, 300, (cx, W, Hh) => {
        cx.fillStyle = '#fffaf0'; h.rr(cx, 2, 2, W - 4, Hh - 4, 10); cx.fill(); cx.strokeStyle = sel ? '#ffb547' : '#1b1610'; cx.lineWidth = sel ? 6 : 3; cx.stroke();
        it.name.forEach((l, i) => h.fitText(cx, l, W / 2, Hh * (0.3 + i * 0.42), W * 0.9, Hh * 0.34, i ? 500 : 700, FONT, '#1b1610'));
      });
      cd.rotation.x = -1.0; at(cd, x, y + 1.4, z + 5, g);
      // потомство: три ростка за образцом
      if (d.grown && it.bin >= 0) {
        for (let j = 0; j < 3; j++) {
          const sg = new T.Group(); at(sg, x - 3.6 + j * 3.6, y, z - 4.6, g);
          at(cyl(0.22, 3, STEM, { edges: false, hull: false }), 0, 1.5, 0, sg);
          at(h.ball(1.1, it.kids ? it.kids[j] : it.c), 0, 3.4, 0, sg);
          const lf = new T.Group(); at(lf, 0, 2, 0, sg); h.leaf(lf, 1.4, 0.8, h.ownMat(HEALTHY), j * 1.7, 0.5, { hull: false, vein: false });
          sprouts.push(sg);
        }
      }
      if (sel) tag(v3(x, y + 13, z), it.short, it.bin >= 0 ? 'на грядке · выбран' : 'выбран', true);
    });
    if (sprouts.length) {
      const set = () => { const k = growK(); sprouts.forEach(s => { s.scale.setScalar(Math.max(0.01, k)); }); };
      set(); if (growK() < 1) kit.onFrame(set);
    }
    // лейка
    const can = new T.Group(); at(can, 60, 0, 36, g); clickable(can, 'grow');
    at(cyl(4.2, 8, 0x3fae5a, { seg: 28 }), 0, 4, 0, can);
    at(cyl(4.3, 0.8, 0x2f8a4a, { seg: 28 }), 0, 8.2, 0, can);
    h.rod(can, v3(-3.4, 2.4, 0), v3(-10, 9, 0), 0.6, 0x3fae5a, { hull: true });
    at(cyl(1.4, 1.2, 0x2f8a4a, { r2: 1.8 }), -10.4, 9.4, 0, can).rotation.z = 0.8;
    const hd = kit.mesh(new T.TorusGeometry(3.2, 0.55, 8, 20, Math.PI), 0x2f8a4a, { edges: false }); hd.rotation.z = -Math.PI / 2; at(hd, 3.4, 5.4, 0, can);
    if (d.full && !d.grown) h.ring(g, 60, 0.2, 36, 6.2);
    tag(v3(60, 14, 36), 'Лейка', d.grown ? 'потомство выросло' : d.full ? 'вырастить потомство' : `разложено ${d.placed} из 8`, d.full && !d.grown);
  };
})();
