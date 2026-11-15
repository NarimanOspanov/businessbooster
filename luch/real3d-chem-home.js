// «Как в жизни» для химии: «Химия дома» (labs/chem-home) и «Еда и здоровье» (labs/chem-food).
// Кухонный стол: таз со стиркой и лупа с мицеллой, банки с индикаторной бумагой и шкала pH, флаконы бытовой химии
// и мысленный опыт с табличкой, штатив с пробирками и реактивами, титрование сока йодом, таблетки и монитор крови.
// Сцены строятся из window.LUCH_REAL() опыта; плавные переходы между перестройками — через память mem.
(() => {
  const SC = window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {};
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (x, n) => { let s = (Math.round(x * 10 ** n) / 10 ** n).toFixed(n); if (/^-0(\.0+)?$/.test(s)) s = s.slice(1); return s.replace('.', ',').replace('-', '−'); };
  // детерминированный «случай»: сцена перестраивается, а точки должны стоять на тех же местах
  const rnd = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const hexs = c => '#' + c.toString(16).padStart(6, '0');
  const now = () => performance.now() / 1000;
  const ease = k => k * k * (3 - 2 * k);
  // память между перестройками сцены: что было раньше (для анимации «капнули», «поднялось»)
  const mem = {};
  const FONT = '"Golos Text", "IBM Plex Sans", sans-serif', MONO = '"IBM Plex Mono", monospace';

  // ---------- общие детали ----------
  function H(kit) {
    const { T, at, box, cyl, mesh, keep, grad, glowTex, textTex, clickable, toon, C } = kit;
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    const v2 = (x, y) => new T.Vector2(x, y);
    const glassMat = (color = 0xd8eef8, opacity = 0.24) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, transparent: true, opacity, side: T.DoubleSide, depthWrite: false }));
    const ownMat = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, ...o }));
    const basic = (color, o = {}) => keep(new T.MeshBasicMaterial({ color, ...o }));
    const spr = (map, color, opacity, add) => new T.Sprite(keep(new T.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending })));
    const glow = (color, size, opacity) => { const s = spr(glowTex(), color, opacity, true); s.scale.setScalar(size); return s; };
    const ball = (r, color, o = {}) => mesh(new T.SphereGeometry(r, o.seg || 18, o.seg2 || 12), color, { hull: o.hull ?? true, edges: false, matOpt: o.matOpt, mat: o.mat, shadow: o.shadow });
    const hitBox = (w, h, d) => new T.Mesh(keep(new T.BoxGeometry(w, h, d)), basic(0xffffff, { transparent: true, opacity: 0, depthWrite: false }));
    function rodAB(parent, a, b, r, color, o = {}) {
      const dv = b.clone().sub(a), L = dv.length();
      const m = cyl(r, L, color, { edges: false, ...o });
      m.quaternion.setFromUnitVectors(v3(0, 1, 0), dv.normalize());
      return at(m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, parent);
    }
    // плоскость с холстом: draw(ctx, pw, ph) можно вызывать снова (табло, шкалы, этикетки)
    function canvasPlane(w, h, pw, draw, o = {}) {
      const ph = Math.round(pw * h / w), c = document.createElement('canvas'); c.width = pw; c.height = ph;
      const x = c.getContext('2d'), tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: tex, transparent: true, side: o.side || T.FrontSide, depthWrite: o.depthWrite ?? true })));
      m.userData.draw = fn => { x.clearRect(0, 0, pw, ph); fn(x, pw, ph); tex.needsUpdate = true; };
      if (draw) m.userData.draw(draw);
      return m;
    }
    const rr = (x, x0, y0, w, h, r) => { x.beginPath(); if (x.roundRect) x.roundRect(x0, y0, w, h, r); else x.rect(x0, y0, w, h); };
    // текст, вписанный по ширине
    function fitText(x, t, cx, cy, maxW, size, weight = 700, font = FONT, color = '#1b1610') {
      let fs = size; x.font = `${weight} ${fs}px ${font}`;
      const tw = x.measureText(t).width; if (tw > maxW) { fs = Math.floor(fs * maxW / tw); x.font = `${weight} ${fs}px ${font}`; }
      x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, cx, cy);
    }
    // бумажная этикетка: строки текста, по желанию — пиктограммы опасности снизу
    function label(w, h, lines, o = {}) {
      return canvasPlane(w, h, o.pw || 256, (x, pw, ph) => {
        x.fillStyle = o.bg || '#fffaf0'; rr(x, 3, 3, pw - 6, ph - 6, ph * 0.12); x.fill();
        x.strokeStyle = o.stroke || '#1b1610'; x.lineWidth = 5; x.stroke();
        if (o.band) { x.fillStyle = o.band; x.fillRect(6, ph * 0.08, pw - 12, ph * 0.2); }
        const n = lines.length, top = o.pics && o.pics.length ? ph * 0.68 : ph * 0.94, lh = (top - ph * 0.06) / n;
        lines.forEach((l, i) => {
          const big = typeof l === 'object' ? l : { t: l };
          fitText(x, big.t, pw / 2, ph * 0.06 + lh * (i + 0.5), pw * 0.86, Math.round(lh * (big.s || 0.62)), big.w || 700, big.mono ? MONO : FONT, big.c || o.fg || '#1b1610');
        });
        if (o.pics) o.pics.forEach((p, i) => picto(x, pw / 2 + (i - (o.pics.length - 1) / 2) * ph * 0.3, ph * 0.83, ph * 0.13, p));
      });
    }
    // пиктограмма опасности: красный ромб, внутри знак
    function picto(x, cx, cy, s, type) {
      x.save(); x.translate(cx, cy);
      x.beginPath(); x.moveTo(0, -s); x.lineTo(s, 0); x.lineTo(0, s); x.lineTo(-s, 0); x.closePath();
      x.fillStyle = '#fff'; x.fill(); x.strokeStyle = '#e0303a'; x.lineWidth = s * 0.2; x.stroke();
      x.strokeStyle = '#0b1019'; x.fillStyle = '#0b1019'; x.lineWidth = s * 0.14; x.lineCap = 'round';
      if (type === 'exc') { x.beginPath(); x.moveTo(0, -s * 0.5); x.lineTo(0, s * 0.12); x.stroke(); x.beginPath(); x.arc(0, s * 0.38, s * 0.09, 0, 7); x.fill(); }
      if (type === 'cor') { x.beginPath(); x.moveTo(-s * 0.45, -s * 0.3); x.lineTo(-s * 0.1, -s * 0.3); x.moveTo(s * 0.1, -s * 0.3); x.lineTo(s * 0.45, -s * 0.3); x.moveTo(-s * 0.5, s * 0.35); x.lineTo(s * 0.5, s * 0.35); x.stroke(); x.beginPath(); x.arc(-s * 0.27, 0, s * 0.08, 0, 7); x.arc(s * 0.27, 0.02, s * 0.08, 0, 7); x.fill(); }
      if (type === 'env') { x.beginPath(); x.moveTo(-s * 0.45, s * 0.35); x.quadraticCurveTo(0, -s * 0.05, s * 0.45, s * 0.35); x.moveTo(-s * 0.2, -s * 0.5); x.lineTo(-s * 0.2, 0); x.stroke(); }
      x.restore();
    }
    // табло с текстом, который меняется в onFrame
    function screen(w, h, txt, fg = '#86e0a8', pw = 320) {
      let cur = null;
      const m = canvasPlane(w, h, pw);
      m.userData.set = (t, col = fg) => {
        t = String(t); if (cur === t + col) return; cur = t + col;
        m.userData.draw((x, W, Hh) => {
          x.fillStyle = '#0e1520'; x.fillRect(0, 0, W, Hh);
          const ls = t.split('\n'), lh = Hh / ls.length;
          ls.forEach((l, i) => fitText(x, l, W / 2, lh * (i + 0.5) + 2, W * 0.9, Math.round(lh * 0.64), 600, MONO, col));
        });
      };
      m.userData.set(txt); return m;
    }
    // кнопка на приборе: колпачок со значком сверху
    function button(parent, x, y, z, txt, color, key, w = 4.2) {
      const b = new T.Group(); at(b, x, y, z, parent);
      at(box(w, 1.4, 3.6, color), 0, 0.7, 0, b);
      const top = new T.Mesh(keep(new T.PlaneGeometry(w * 0.82, 2.9)), keep(new T.MeshBasicMaterial({ map: keep(textTex(txt, '#ffffff', hexs(color), 128, 96)) })));
      top.rotation.x = -Math.PI / 2; at(top, 0, 1.42, 0, b);
      clickable(b, key); return b;
    }
    // кольцо-подсветка под выбранной вещью
    function ring(parent, x, y, z, r, color = 0xffd166, th = 0.45) {
      const m = new T.Mesh(keep(new T.TorusGeometry(r, th, 6, 44)), basic(color));
      m.rotation.x = Math.PI / 2; return at(m, x, y, z, parent);
    }
    // стеклянный стакан с делениями; o.spout — носик
    function beaker(parent, x, y0, z, r, h, o = {}) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const wall = new T.Mesh(keep(new T.CylinderGeometry(r, r * 0.97, h, 44, 1, true)), glassMat(0xd8eef8, o.op ?? 0.22)); at(wall, 0, h / 2, 0, g);
      wall.add(new T.Mesh(wall.geometry, kit.hullMat));
      at(cyl(r * 0.97, 0.6, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.45 } }), 0, 0.3, 0, g);
      const rim = mesh(new T.TorusGeometry(r, 0.24, 6, 44), 0xeef6fb, { edges: false, shadow: false }); rim.rotation.x = Math.PI / 2; at(rim, 0, h, 0, g);
      if (o.spout !== false) { const sp = mesh(new T.TorusGeometry(0.9, 0.24, 6, 12, Math.PI), 0xeef6fb, { edges: false }); sp.rotation.set(Math.PI / 2, 0, Math.PI / 2); at(sp, -r - 0.2, h, 0, g); }
      if (o.marks !== false) { const a = 0.45; for (let k = 1; k <= 5; k++) { const m = box(k % 2 ? 1.1 : 2, 0.16, 0.1, 0x6f8098, { edges: false, shadow: false }); m.rotation.y = a; at(m, Math.sin(a) * (r + 0.05), h * k / 6.5, Math.cos(a) * (r + 0.05), g); } }
      return { g, r, h };
    }
    // жидкость: цилиндр единичной высоты, высоту и цвет можно менять каждый кадр
    function liquid(parent, x, y0, z, r, color, opacity = 0.62, r2) {
      const mat = ownMat(color, { transparent: true, opacity, depthWrite: false });
      const m = new T.Mesh(keep(new T.CylinderGeometry(r2 ?? r, r * 0.97, 1, 40)), mat);
      at(m, x, y0, z, parent);
      const set = (hgt, yb = y0) => { m.visible = hgt > 0.05; m.scale.y = Math.max(0.05, hgt); m.position.y = yb + Math.max(0.05, hgt) / 2; };
      return { m, mat, set };
    }
    // пробирка с круглым дном и жидкостью; возвращает { g, liq, mat }
    function testTube(parent, x, y0, z, r, hh, lh, color, op = 0.8) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const wg = keep(new T.CylinderGeometry(r, r, hh - r, 28, 1, true));
      const wall = new T.Mesh(wg, glassMat(0xd8eef8, 0.24)); at(wall, 0, r + (hh - r) / 2, 0, g); wall.add(new T.Mesh(wg, kit.hullMat));
      const bg = keep(new T.SphereGeometry(r, 28, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2));
      const bot = new T.Mesh(bg, glassMat(0xd8eef8, 0.24)); at(bot, 0, r, 0, g); bot.add(new T.Mesh(bg, kit.hullMat));
      const lip = mesh(new T.TorusGeometry(r + 0.1, 0.22, 6, 28), 0xeef6fb, { edges: false, shadow: false }); lip.rotation.x = Math.PI / 2; at(lip, 0, hh, 0, g);
      const mat = ownMat(color, { transparent: true, opacity: op, depthWrite: false });
      const lq = new T.Group(); at(lq, 0, 0, 0, g);
      if (lh > 0) {
        at(new T.Mesh(keep(new T.SphereGeometry(r * 0.86, 20, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), mat), 0, r, 0, lq);
        at(new T.Mesh(keep(new T.CylinderGeometry(r * 0.86, r * 0.86, Math.max(0.1, lh - r), 20)), mat), 0, r + Math.max(0.1, lh - r) / 2, 0, lq);
      }
      return { g, mat, lq };
    }
    // бутылка-«тело вращения»: дно, плечи, горлышко, крышка
    function bottle(parent, x, z, o) {
      const g = new T.Group(); at(g, x, o.y || 0, z, parent);
      const r = o.r, h = o.h, rn = o.rn ?? r * 0.35, sh = o.sh ?? 0.7;
      const pts = [v2(0, 0), v2(r - 0.5, 0), v2(r, 0.5), v2(r, h * sh), v2(r * 0.78, h * (sh + 0.1)), v2(rn, h * (sh + 0.18)), v2(rn, h)];
      const geo = new T.LatheGeometry(pts, 32);
      if (o.glass) {
        const body = new T.Mesh(keep(geo), glassMat(o.glassCol || 0xd8eef8, o.glassOp ?? 0.3)); body.add(new T.Mesh(geo, kit.hullMat)); at(body, 0, 0, 0, g);
        if (o.liq != null) {
          const lh = h * (o.fill ?? 0.6);
          at(new T.Mesh(keep(new T.CylinderGeometry(r * 0.9, r * 0.9, lh, 28)), ownMat(o.liq, { transparent: true, opacity: o.liqOp ?? 0.8, depthWrite: false })), 0, 0.4 + lh / 2, 0, g);
        }
      } else at(mesh(geo, o.color, { edges: false, hull: true }), 0, 0, 0, g);
      if (o.cap !== false) at(cyl(rn + 0.35, o.capH || 2, o.cap ?? 0xe8ecf4, { seg: 18 }), 0, h + (o.capH || 2) / 2, 0, g);
      if (o.label) { const lb = o.label; at(lb, 0, h * (o.labelY ?? 0.36), r + 0.08, g); }
      return g;
    }
    // клубы газа/пара: поднимаются и тают
    let puffT = null;
    function puffTex() {
      if (puffT) return puffT;
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
      const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.5, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 64, 64); puffT = keep(new T.CanvasTexture(c)); return puffT;
    }
    function cloud(parent, x, y, z, o = {}) {
      const n = o.n || 8, ps = [], g = new T.Group(); at(g, x, y, z, parent);
      for (let i = 0; i < n; i++) { const s = spr(puffTex(), o.color ?? 0xffffff, 0, false); g.add(s); ps.push({ s, ph: i / n, dx: (rnd(i + 3) - 0.5) * (o.spread ?? 6), dz: (rnd(i + 9) - 0.5) * (o.spread ?? 6) }); }
      const st = { amt: o.amt ?? 1 };
      kit.onFrame((dt, t) => {
        for (const p of ps) {
          const ph = kit.reduce ? 0.2 + p.ph * 0.6 : (t * (o.speed || 0.3) + p.ph) % 1;
          p.s.position.set(p.dx * (0.6 + ph * (o.grow ?? 1)), ph * (o.rise ?? 12), p.dz * (0.6 + ph * (o.grow ?? 1)));
          p.s.scale.setScalar((o.size || 4) * (0.6 + ph * 1.4));
          p.s.material.opacity = st.amt * (o.op ?? 0.55) * Math.sin(Math.PI * ph);
        }
      });
      return { g, set(a) { st.amt = a; } };
    }
    // пузырьки в жидкости
    function bubbles(parent, x, y0, z, r, n = 8, o = {}) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const geo = keep(new T.SphereGeometry(1, 10, 8)), mat = basic(o.color ?? 0xffffff, { transparent: true, opacity: 0.8, depthWrite: false });
      const bs = [];
      for (let i = 0; i < n; i++) { const m = new T.Mesh(geo, mat); m.visible = false; g.add(m); bs.push({ m, ph: rnd(i + 11), a: rnd(i + 21) * Math.PI * 2, rr: Math.sqrt(rnd(i + 31)) * r }); }
      const st = { amt: o.amt ?? 0, top: o.top ?? 5, big: o.big ?? 0.5, speed: o.speed ?? 0.6 };
      kit.onFrame((dt, t) => {
        const k = Math.round(st.amt * n);
        bs.forEach((b, i) => {
          b.m.visible = i < k && st.top > 0.6; if (!b.m.visible) return;
          const ph = kit.reduce ? b.ph : (t * st.speed + b.ph) % 1;
          b.m.scale.setScalar(st.big * (0.4 + 0.9 * ph));
          b.m.position.set(Math.cos(b.a) * b.rr + 0.3 * Math.sin(t * 5 + i), 0.3 + ph * (st.top - 0.6), Math.sin(b.a) * b.rr);
        });
      });
      return { g, set(a, top = st.top, big = st.big, speed = st.speed) { Object.assign(st, { amt: a, top, big, speed }); } };
    }
    // белый лабораторный поднос
    function tray(parent, x, z, w, d, color = 0xf1f3f5) {
      at(box(w, 1, d, color), x, 0.5, z, parent);
      at(box(w, 1.4, 0.8, color), x, 1.2, z - d / 2 + 0.4, parent); at(box(w, 1.4, 0.8, color), x, 1.2, z + d / 2 - 0.4, parent);
      at(box(0.8, 1.4, d, color), x - w / 2 + 0.4, 1.2, z, parent); at(box(0.8, 1.4, d, color), x + w / 2 - 0.4, 1.2, z, parent);
      return 1;
    }
    // штатив: основание, стержень, лапки к точкам
    function stand(parent, x, z, Hh, arms) {
      at(box(12, 1.2, 9, C.DARK), x, 0.6, z, parent);
      at(cyl(0.65, Hh, C.STEEL, { edges: false }), x, 1.2 + Hh / 2, z, parent);
      arms.forEach(a => {
        rodAB(parent, v3(x, a.y, z), v3(a.to.x, a.y, a.to.z), 0.42, C.STEEL);
        at(box(2.2, 2.2, 2.2, C.DARK), x, a.y, z, parent);
        at(box(a.w || 2.6, 2.4, a.w || 2.6, 0x3b4a66), a.to.x, a.y, a.to.z, parent);
      });
    }
    // падающая капля: старт в t0, из a в b за dur секунд
    function fallingDrop(parent, a, b, color, t0, dur = 0.45, r = 0.6) {
      const d = ball(r, color, { hull: false, shadow: false }); d.scale.y = 1.35; d.visible = false; at(d, a.x, a.y, a.z, parent);
      kit.onFrame(() => {
        const k = (now() - t0) / dur; d.visible = !kit.reduce && k >= 0 && k < 1;
        if (d.visible) d.position.lerpVectors(a, b, k * k);
      });
      return d;
    }
    return { v3, v2, glassMat, ownMat, basic, spr, glow, ball, hitBox, rodAB, canvasPlane, rr, fitText, label, picto, screen, button, ring, beaker, liquid, testTube, bottle, cloud, bubbles, tray, stand, fallingDrop };
  }

  // =====================================================================================
  // ===== «Как мыло снимает жир»: таз с тканью и пятном, ионы кальция, пипетка, сода, лупа =====
  SC['chho-wash'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, toon, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const bx = -4, bz = -2, R = 17, BH = 20, WY = 15.4;
    // память: смена условий (средство/вода) — «новый таз»
    const sig = d.agent + d.hard;
    const M = mem.wash && mem.wash.sig === sig ? mem.wash : { sig, drops: 0, clean: false, dropAt: -9, liftAt: -9 };
    if (d.drops > M.drops) M.dropAt = now();
    if (d.clean && !M.clean) M.liftAt = now();
    M.drops = d.drops; M.clean = d.clean; mem.wash = M;
    // таз
    const bk = h.beaker(g, bx, 0, bz, R, BH, { spout: false, marks: false });
    const hardW = d.hard && !d.soda;
    const water = h.liquid(g, bx, 0.6, bz, R - 0.5, hardW ? 0x9cbfcc : 0x5fb4e0, 0.38); water.set(WY - 0.6);
    // ткань на дне
    const fab = new T.Group(); at(fab, bx, 0.6, bz + 1, g);
    at(box(24, 1, 13, 0xc9b79a), 0, 0.5, 0, fab);
    for (let i = 0; i < 9; i++) at(box(0.3, 0.06, 13, 0xa8977a, { edges: false, shadow: false }), -10.5 + i * 2.6, 1.03, 0, fab);
    // капля жира + молекулы на ней
    const k = d.mic / d.need;
    const drop = new T.Group(); at(drop, bx, 0, bz + 1, g);
    const fatMat = h.ownMat(0xe8b93a);
    const fat = new T.Mesh(keep(new T.SphereGeometry(1, 32, 20)), fatMat); fat.add(new T.Mesh(fat.geometry, kit.hullMat)); fat.castShadow = true;
    let rx, ry, rz, cy;
    if (d.clean) { rx = ry = rz = 4.6; cy = 9; } else { rx = 7.5 - 1.8 * k; rz = 5.5 - 0.8 * k; ry = 1.8 + 2.2 * k; cy = 1.6 + ry * 0.8; }
    fat.scale.set(rx, ry, rz); at(fat, 0, 0, 0, drop);
    if (!d.clean && d.mic === 0) at(h.ball(1, 0xb08a2a, { hull: false, shadow: false }), bx, 1.62, bz + 1, g).scale.set(9, 0.12, 6);
    // молекулы-«головастики»: головка — к воде, хвост — в жир
    const headG = keep(new T.SphereGeometry(0.62, 12, 8)), tailG = keep(new T.CylinderGeometry(0.17, 0.12, 2.2, 6));
    const headM = toon(d.aCol), tailM = toon(0xf4ecd6);
    const tadpole = (parent, p, n) => {
      const t = new T.Group(); t.position.copy(p); t.quaternion.setFromUnitVectors(v3(0, 1, 0), n);
      const hd = new T.Mesh(headG, headM); hd.add(new T.Mesh(headG, kit.hullMat)); at(hd, 0, 0, 0, t);
      at(new T.Mesh(tailG, tailM), 0, -1.4, 0, t); parent.add(t); return t;
    };
    // точки на поверхности: Фибоначчи по сфере (целиком) или по верхней половине (капля на ткани)
    const N = d.need, order = []; for (let i = 0; i < N / 2; i++) { order.push(i); order.push(N - 1 - i); }
    for (let n = 0; n < d.mic; n++) {
      const j = order[n], f = (j + 0.5) / N;
      const yy = d.clean ? 1 - 2 * f : 1 - f * 0.92, ph = j * 2.39996;
      const rad = Math.sqrt(Math.max(0, 1 - yy * yy)), dir = v3(Math.cos(ph) * rad, yy, Math.sin(ph) * rad);
      const p = v3(dir.x * rx, dir.y * ry, dir.z * rz), nn = v3(dir.x / rx, dir.y / ry, dir.z / rz).normalize();
      tadpole(drop, p.add(nn.clone().multiplyScalar(2.2)), nn);
    }
    // свободные молекулы в воде
    const freeMol = [];
    for (let i = 0; i < Math.min(d.extra, 16); i++) {
      const a = rnd(i + 40) * Math.PI * 2, r = 6 + rnd(i + 41) * 8.5, n = v3(rnd(i + 42) - 0.5, rnd(i + 43) - 0.5, rnd(i + 44) - 0.5).normalize();
      const t = tadpole(g, v3(bx + Math.cos(a) * r, 5 + rnd(i + 45) * 8, bz + Math.sin(a) * r), n); t.scale.setScalar(0.8); freeMol.push({ t, y: t.position.y, ph: i });
    }
    // ионы Ca²⁺ — зелёные шарики-«таблички»
    const caTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d');
      x.fillStyle = '#9fd27a'; x.strokeStyle = '#1b1610'; x.lineWidth = 6; x.beginPath(); x.arc(48, 48, 42, 0, 7); x.fill(); x.stroke();
      h.fitText(x, 'Ca²⁺', 48, 50, 74, 34, 800, FONT, '#0b1019');
      const t = keep(new T.CanvasTexture(c)); t.colorSpace = T.SRGBColorSpace; return t;
    })();
    const ions = [];
    for (let i = 0; i < d.caFree; i++) {
      const a = rnd(i + 1) * Math.PI * 2, r = 6 + rnd(i + 2) * 8.5;
      const s = h.spr(caTex, 0xffffff, 1, false); s.scale.setScalar(2.6);
      at(s, bx + Math.cos(a) * r, 4 + rnd(i + 3) * 9, bz + Math.sin(a) * r, g); ions.push({ s, y: s.position.y, ph: i * 1.7 });
    }
    // хлопья кальциевого мыла на поверхности
    const flakes = [];
    for (let i = 0; i < d.flakes; i++) {
      const a = rnd(i + 60) * Math.PI * 2, r = 4 + rnd(i + 61) * 11;
      const f = mesh(new T.IcosahedronGeometry(1, 0), 0xb4bac6, { edgeAngle: 20 }); f.scale.set(2.3, 0.55, 1.6); f.rotation.y = rnd(i + 62) * 3;
      at(f, bx + Math.cos(a) * r, WY - 0.1, bz + Math.sin(a) * r, g); flakes.push({ f, a, r, ph: i });
    }
    // осадок CaCO₃ у стенок
    for (let i = 0; i < d.caOut; i++) {
      const a = (i / Math.max(1, d.caOut)) * Math.PI * 2 + rnd(i + 70) * 0.4;
      at(h.ball(0.75, 0xf2f4f8, { shadow: false }), bx + Math.cos(a) * 14.5, 1.2, bz + Math.sin(a) * 14.5, g);
    }
    // пена: появляется только от свободных молекул (мыло в жёсткой воде не пенится)
    const foam = [];
    const nFoam = clamp(Math.round(d.free / 3), 0, 16);
    for (let i = 0; i < nFoam; i++) {
      const a = rnd(i + 80) * Math.PI * 2, r = 9 + rnd(i + 81) * 6.5;
      const b = h.ball(0.7 + rnd(i + 82) * 0.8, 0xffffff, { matOpt: { transparent: true, opacity: 0.85 }, shadow: false });
      at(b, bx + Math.cos(a) * r, WY + 0.2, bz + Math.sin(a) * r, g); foam.push(b);
    }
    // рябь от капли
    const rip = new T.Mesh(keep(new T.TorusGeometry(1, 0.12, 6, 40)), h.basic(0xe8f6ff, { transparent: true, opacity: 0 })); rip.rotation.x = Math.PI / 2; at(rip, bx + 6, WY + 0.05, bz - 3, g);
    // штатив с пипеткой над тазом
    const px = bx + 6, pz = bz - 3, pTip = 21;
    h.stand(g, px, -27, 33, [{ y: 27, to: v3(px, 0, pz), w: 2.2 }]);
    const pip = new T.Group(); at(pip, px, 0, pz, g); clickable(pip, 'drop');
    at(cyl(0.75, 7, 0xd8eef8, { r2: 0.75, matOpt: { transparent: true, opacity: 0.45 } }), 0, pTip + 4.6, 0, pip);
    at(cyl(0.25, 1.2, 0xd8eef8, { r2: 0.75, matOpt: { transparent: true, opacity: 0.55 } }), 0, pTip + 0.6, 0, pip);
    at(cyl(0.6, 3.5, d.aCol, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.85 } }), 0, pTip + 3, 0, pip);
    const bulb = h.ball(1.5, 0xe06a4a); bulb.scale.y = 1.5; at(bulb, 0, pTip + 9.4, 0, pip);
    pip.add(at(h.hitBox(6, 14, 6), 0, pTip + 5, 0, new T.Group()));
    h.fallingDrop(g, v3(px, pTip, pz), v3(px, WY, pz), d.aCol, M.dropAt, 0.45, 0.55);
    // средство: брусок хозяйственного мыла в мыльнице и флакон СМС
    const sp = new T.Group(); at(sp, 34, 0, 26, g); clickable(sp, 'ag-soap');
    at(box(12, 1, 8, 0x8fd0c8), 0, 0.5, 0, sp);
    for (let i = -2; i <= 2; i++) at(box(0.6, 0.6, 7, 0x6fb0a8, { edges: false }), i * 2.2, 1.3, 0, sp);
    at(box(9, 3, 5.4, 0xc9894a), 0, 3.1, 0, sp);
    const sl = h.canvasPlane(7, 2.2, 256, (x, W, Hh) => { h.fitText(x, '72%', W / 2, Hh / 2, W * 0.8, Hh * 0.8, 800, FONT, '#5a3410'); }); sl.rotation.x = -Math.PI / 2; at(sl, 0, 4.62, 0, sp);
    if (d.agent === 'soap') h.ring(sp, 0, 0.2, 0, 8.4);
    const sy = new T.Group(); at(sy, 48, 0, 14, g); clickable(sy, 'ag-syn');
    h.bottle(sy, 0, 0, { r: 3.6, h: 13, rn: 1.2, color: 0xb88cf0, cap: 0x5a3aa8, capH: 2.4, label: h.label(5.6, 4.6, ['СМС', { t: 'для посуды', s: 0.45 }], { bg: '#f6f0ff' }) });
    if (d.agent === 'syn') h.ring(sy, 0, 0.2, 0, 5);
    // кувшины: жёсткая и мягкая вода
    const jug = (x, z, hard, key) => {
      const jg = new T.Group(); at(jg, x, 0, z, g); clickable(jg, key);
      const b = new T.Mesh(keep(new T.CylinderGeometry(4.6, 5, 13, 32, 1, true)), h.glassMat(0xd8eef8, 0.3)); b.add(new T.Mesh(b.geometry, kit.hullMat)); at(b, 0, 6.5, 0, jg);
      at(cyl(4.9, 0.5, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.5 } }), 0, 0.25, 0, jg);
      h.liquid(jg, 0, 0.5, 0, 4.4, hard ? 0x9cbfcc : 0x5fb4e0, 0.55).set(9);
      const hd = mesh(new T.TorusGeometry(3.4, 0.6, 8, 20, Math.PI), 0x4a556c, { edges: false, hull: true }); hd.rotation.z = Math.PI / 2; at(hd, -4.8, 7, 0, jg);
      const lb = h.label(7.4, 3.4, [hard ? 'жёсткая' : 'мягкая', { t: hard ? 'Ca²⁺, Mg²⁺' : 'дождевая', s: 0.45 }], { bg: hard ? '#e4f0e0' : '#e4f2fb' }); lb.rotation.y = 0.5; at(lb, 2.4, 5, 4.4, jg);
      if (d.hard === hard) h.ring(jg, 0, 0.2, 0, 6.2);
    };
    jug(-46, -12, true, 'w-hard'); jug(-46, 6, false, 'w-soft');
    // пачка соды
    const so = new T.Group(); at(so, -30, 0, 28, g); clickable(so, 'soda');
    const used = d.soda || !d.hard;
    at(box(8, 10, 5, 0xe8ecf4), 0, 5, 0, so);
    at(box(8.1, 2.6, 5.1, 0x4d7cf0, { edges: false }), 0, 7.2, 0, so);
    const sod = h.canvasPlane(7.6, 6.6, 256, (x, W, Hh) => {
      x.fillStyle = '#4d7cf0'; x.fillRect(0, Hh * 0.08, W, Hh * 0.34); h.fitText(x, 'СОДА', W / 2, Hh * 0.25, W * 0.8, Hh * 0.26, 800, FONT, '#fff');
      h.fitText(x, 'Na₂CO₃', W / 2, Hh * 0.62, W * 0.8, Hh * 0.2, 700, MONO, '#1b1610'); h.fitText(x, 'стиральная', W / 2, Hh * 0.84, W * 0.8, Hh * 0.14, 600, FONT, '#4a556c');
    }); at(sod, 0, 5.4, 2.56, so);
    if (d.soda) { const lid = box(8, 0.5, 5, 0xd9dfe9); lid.rotation.x = -1.1; at(lid, 0, 11.3, -3.4, so); at(h.ball(1, 0xf7f7f2, { shadow: false }), 0, 10.2, 0, so).scale.set(3, 0.5, 2); }
    else at(box(8.2, 0.5, 5.2, 0xd9dfe9), 0, 10.25, 0, so);
    // лупа: увеличенная мицелла (головастики вокруг жира)
    const lu = new T.Group(); at(lu, 40, 0, -14, g); lu.rotation.y = 0.3;
    at(cyl(5, 1.2, C.DARK), 0, 0.6, 0, lu);
    at(cyl(0.6, 6.5, C.BRASS, { edges: false }), 0, 4, 0, lu);
    const LR = 9, LY = 16.5;
    const rim = mesh(new T.TorusGeometry(LR, 0.9, 10, 48), C.BRASS, { edges: false, hull: true }); at(rim, 0, LY, 0, lu);
    const face = h.canvasPlane(LR * 2, LR * 2, 384, (x, W) => {
      const c = W / 2, s = W / 2 / 9.4;
      x.save(); x.beginPath(); x.arc(c, c, c - 2, 0, 7); x.clip();
      x.fillStyle = hardW ? '#cfe3ea' : '#cdeaf8'; x.fillRect(0, 0, W, W);
      const fy = d.clean ? c : W * 0.74, frx = d.clean ? 3.2 * s : (5.4 - 1.2 * k) * s, fry = d.clean ? 3.2 * s : (1.6 + 1.6 * k) * s;
      if (!d.clean) { x.fillStyle = '#c9b79a'; x.fillRect(0, fy + fry - 4, W, W); x.fillStyle = '#a8977a'; for (let i = 0; i < 12; i++) x.fillRect(i * W / 12, fy + fry - 4, 3, W); }
      x.fillStyle = '#e8b93a'; x.strokeStyle = '#1b1610'; x.lineWidth = 4; x.beginPath(); x.ellipse(c, fy, frx, fry, 0, 0, 7); x.fill(); x.stroke();
      if (d.clean) h.fitText(x, 'жир', c, fy, frx * 1.4, 34, 700, FONT, '#5a4310');
      const mol = (hx, hy, ang, L) => {
        x.strokeStyle = '#4a3a1a'; x.lineWidth = 3.5; x.lineJoin = 'round'; x.beginPath();
        const ux = Math.cos(ang), uy = Math.sin(ang), qx = -uy, qy = ux; x.moveTo(hx + ux * 8, hy + uy * 8);
        for (let j = 1; j <= 5; j++) { const sd = 8 + j * (L - 8) / 5, w = j % 2 ? 5 : -5; x.lineTo(hx + ux * sd + qx * w, hy + uy * sd + qy * w); }
        x.stroke(); x.fillStyle = hexs(d.aCol); x.lineWidth = 3; x.strokeStyle = '#1b1610'; x.beginPath(); x.arc(hx, hy, 8.5, 0, 7); x.fill(); x.stroke();
      };
      for (let n = 0; n < d.mic; n++) {
        const j = order[n], th = d.clean ? -Math.PI / 2 + j / N * Math.PI * 2 : Math.PI + (j + 0.5) / N * Math.PI;
        const ex = c + frx * Math.cos(th), ey = fy + fry * Math.sin(th);
        let nx = Math.cos(th) / frx, ny = Math.sin(th) / fry; const l = Math.hypot(nx, ny); nx /= l; ny /= l;
        mol(ex + nx * 30, ey + ny * 30, Math.atan2(-ny, -nx), 36);
      }
      // ионы кальция и хлопья
      for (let i = 0; i < Math.min(d.caFree, 6); i++) { const px2 = W * (0.15 + 0.7 * rnd(i + 90)), py2 = W * (0.12 + 0.3 * rnd(i + 91)); x.fillStyle = '#9fd27a'; x.strokeStyle = '#1b1610'; x.lineWidth = 3; x.beginPath(); x.arc(px2, py2, 15, 0, 7); x.fill(); x.stroke(); h.fitText(x, 'Ca', px2, py2 + 1, 24, 16, 800, FONT, '#0b1019'); }
      for (let i = 0; i < Math.min(d.flakes, 6); i++) { const px2 = W * (0.14 + 0.72 * rnd(i + 95)), py2 = W * (0.08 + 0.06 * rnd(i + 96)); x.fillStyle = '#7d8698'; x.strokeStyle = '#1b1610'; x.lineWidth = 3; x.beginPath(); x.arc(px2, py2, 9, 0, 7); x.fill(); x.stroke(); x.strokeStyle = '#4a556c'; x.lineWidth = 3; x.beginPath(); x.moveTo(px2 - 34, py2); x.lineTo(px2 - 28, py2 - 4); x.lineTo(px2 - 22, py2); x.lineTo(px2 - 16, py2 - 4); x.lineTo(px2 - 10, py2); x.moveTo(px2 + 10, py2); x.lineTo(px2 + 16, py2 - 4); x.lineTo(px2 + 22, py2); x.lineTo(px2 + 28, py2 - 4); x.lineTo(px2 + 34, py2); x.stroke(); }
      x.restore();
      x.fillStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.ellipse(c - W * 0.18, c - W * 0.2, W * 0.16, W * 0.08, -0.6, 0, 7); x.fill();
    }); at(face, 0, LY, 0.2, lu);
    const back = new T.Mesh(keep(new T.CircleGeometry(LR, 40)), h.basic(0x2c3240)); back.rotation.y = Math.PI; at(back, 0, LY, -0.2, lu);
    at(cyl(0.9, 3, C.BRASS, { edges: false }), 0, LY - LR - 1.2, 0, lu);
    // подписи
    tag(v3(bx, BH + 4, bz - 6), 'Таз · ' + (d.hard ? (d.soda ? 'вода смягчена' : 'жёсткая вода') : 'мягкая вода'), 'капель ' + d.drops + (d.hard ? ' из ' + d.limit : ''), d.hard && d.drops > d.limit);
    tag(v3(bx - 2, 3, bz + 16), 'Жир на ткани', d.clean ? 'отстирано!' : 'облеплен ' + d.mic + ' из ' + d.need, d.clean);
    tag(v3(40, 28, -14), 'Лупа · ' + d.aName, d.clean ? 'мицелла' : d.flakes ? 'мыло в хлопьях: ' + d.flakes * 2 : 'молекулы на жире');
    tag(v3(-30, 13, 28), 'Сода', d.soda ? 'добавлена' : 'смягчает воду');
    // анимация
    const y0 = d.clean && M.liftAt > now() - 2 ? 1.6 + 2.6 : cy;
    kit.onFrame((dt, t) => {
      const tn = now();
      // подъём капли, когда мицелла оторвалась от ткани
      if (d.clean) { const kk = kit.reduce ? 1 : clamp((tn - M.liftAt) / 1.6, 0, 1); drop.position.y = y0 + (cy - y0) * ease(kk) + (kit.reduce ? 0 : 0.4 * Math.sin(t * 1.3)); drop.rotation.y = kit.reduce ? 0 : t * 0.25; }
      else drop.position.y = cy;
      if (kit.reduce) return;
      ions.forEach(o => { o.s.position.y = o.y + 0.5 * Math.sin(t * 1.4 + o.ph); });
      flakes.forEach(o => { const a = o.a + t * 0.05; o.f.position.x = bx + Math.cos(a) * o.r; o.f.position.z = bz + Math.sin(a) * o.r; o.f.position.y = WY - 0.1 + 0.12 * Math.sin(t * 2 + o.ph); });
      freeMol.forEach(o => { o.t.position.y = o.y + 0.6 * Math.sin(t * 1.1 + o.ph); o.t.rotation.y += dt * 0.4; });
      const kr = (tn - M.dropAt - 0.45) / 0.7;
      rip.material.opacity = kr > 0 && kr < 1 ? 0.9 * (1 - kr) : 0; rip.scale.setScalar(0.5 + 9 * clamp(kr, 0, 1));
    });
  };

  // =====================================================================================
  // ===== «Кислоты и щёлочи на кухне»: банки на подносе, индикаторная бумага, наклонная шкала pH =====
  SC['chho-ph'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const JZ = -16, JX = i => -42 + i * 14, JR = 4.6, JH = 12;
    const M = mem.ph || { tested: {} };
    const dipAt = {};
    d.jars.forEach(j => { if (j.tested && !M.tested[j.k]) dipAt[j.k] = now(); });
    M.tested = {}; d.jars.forEach(j => { M.tested[j.k] = j.tested; }); mem.ph = M;
    h.tray(g, 0, JZ, 104, 18);
    const strips = [];
    d.jars.forEach((j, i) => {
      const x = JX(i), jg = new T.Group(); at(jg, x, 1, JZ, g); clickable(jg, 'jar-' + i);
      const bk = h.beaker(jg, 0, 0, 0, JR, JH, { spout: false, marks: false, op: 0.26 });
      h.liquid(jg, 0, 0.6, 0, JR - 0.4, j.liq, Math.max(0.35, j.op * 0.85)).set(7);
      // крышка: на банке, у проверенной — рядом на подносе
      if (!j.tested) { at(cyl(JR + 0.5, 1.4, 0x4a556c, { seg: 24 }), 0, JH + 0.7, 0, jg); }
      else { const lid = cyl(JR + 0.5, 1.4, 0x4a556c, { seg: 24 }); at(lid, -1, 0.7, -JR - 1.8, jg); }
      const lb = h.label(6.6, 2.8, [j.sh], { bg: '#fffaf0' }); at(lb, 0, 4.8, JR + 0.1, jg);
      // наклейка «pH» на подносе перед банкой
      const c = j.ph != null ? hexs(d.phc[j.ph]) : '#d9dfe9';
      const st = h.canvasPlane(7, 3.2, 224, (x, W, Hh) => {
        x.fillStyle = c; h.rr(x, 3, 3, W - 6, Hh - 6, 16); x.fill(); x.strokeStyle = '#1b1610'; x.lineWidth = 5; x.stroke();
        const dark = j.ph != null && (j.ph >= 9 || j.ph <= 1);
        h.fitText(x, j.ph != null ? 'pH ' + j.ph + (j.placed ? ' ✓' : '') : 'pH ?', W / 2, Hh / 2 + 2, W * 0.86, Hh * 0.62, 800, MONO, dark ? '#fff' : '#1b1610');
      }); st.rotation.x = -1.0; at(st, 0, 1.6, JR + 3.2, jg);
      if (d.sel === i) h.ring(jg, 0, 0.15, 0, JR + 1.3);
      // индикаторная полоска в банке
      if (j.tested) {
        const sg = new T.Group(); at(sg, 1.6, 0, 0.6, jg); sg.rotation.z = -0.12;
        at(box(1.5, 9, 0.18, 0xf7f3e6, { edges: false }), 0, 10.5, 0, sg);
        at(box(1.52, 6, 0.2, d.phc[j.ph], { edges: false }), 0, 3, 0, sg);
        strips.push({ sg, t0: dipAt[j.k] ?? -9 });
      }
    });
    // реквизит за подносом: половинка лимона, пачка соды, кусок мыла
    const lem = new T.Group(); at(lem, JX(0) - 2, 0, JZ - 14, g);
    const lh = new T.Mesh(keep(new T.SphereGeometry(4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)), h.ownMat(0xf2d23a)); lh.add(new T.Mesh(lh.geometry, kit.hullMat)); lh.rotation.x = -Math.PI / 2 + 0.25; at(lh, 0, 3.6, 0, lem);
    const lc = h.canvasPlane(7.6, 7.6, 192, (x, W) => {
      x.fillStyle = '#f2d23a'; x.beginPath(); x.arc(W / 2, W / 2, W / 2 - 2, 0, 7); x.fill();
      x.fillStyle = '#fbe98a'; x.beginPath(); x.arc(W / 2, W / 2, W / 2 - 12, 0, 7); x.fill();
      x.strokeStyle = '#f6f0c8'; x.lineWidth = 5; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; x.beginPath(); x.moveTo(W / 2, W / 2); x.lineTo(W / 2 + Math.cos(a) * (W / 2 - 12), W / 2 + Math.sin(a) * (W / 2 - 12)); x.stroke(); }
      x.strokeStyle = '#1b1610'; x.lineWidth = 4; x.beginPath(); x.arc(W / 2, W / 2, W / 2 - 2, 0, 7); x.stroke();
    }); lc.rotation.x = 0.25; at(lc, 0, 3.6, 0.06, lem);
    const sb = new T.Group(); at(sb, JX(4), 0, JZ - 14, g);
    at(box(7, 9, 4, 0xf2f4f8), 0, 4.5, 0, sb); const sbl = h.label(6.8, 3.6, ['СОДА', { t: 'пищевая', s: 0.45 }], { bg: '#ffffff', band: '#e0473a' }); at(sbl, 0, 5.4, 2.06, sb);
    const so = new T.Group(); at(so, JX(5) + 1, 0, JZ - 13, g);
    at(box(7, 2.6, 4.4, 0xb6e0f0), 0, 1.3, 0, so); at(box(5.6, 0.8, 3.4, 0xffffff, { edges: false }), 0, 3, 0, so);
    // упаковка индикаторной бумаги
    const pk = new T.Group(); at(pk, 55, 0, 30, g); pk.rotation.y = 0.3;
    at(box(8, 2, 12, 0xf2f4f8), 0, 1, 0, pk);
    const pkl = h.canvasPlane(7.4, 11.4, 160, (x, W, Hh) => {
      x.fillStyle = '#fff'; x.fillRect(0, 0, W, Hh); h.fitText(x, 'pH 0–14', W / 2, Hh * 0.08, W * 0.8, Hh * 0.07, 800, MONO);
      d.phc.forEach((c, i) => { x.fillStyle = hexs(c); x.fillRect(W * 0.18, Hh * 0.15 + i * Hh * 0.055, W * 0.3, Hh * 0.05); h.fitText(x, String(i), W * 0.66, Hh * 0.175 + i * Hh * 0.055, W * 0.3, Hh * 0.045, 700, MONO); });
      h.fitText(x, 'индикатор', W / 2, Hh * 0.97, W * 0.86, Hh * 0.05, 700);
    }); pkl.rotation.x = -Math.PI / 2; at(pkl, 0, 2.05, 0, pk);
    // наклонная шкала pH
    const X0 = -52.5, CW = 7, SZ = 16;
    const sg = new T.Group(); at(sg, 0, 0, SZ, g);
    at(box(110, 1.2, 15, C.WOOD2), 0, 0.6, 0, sg);
    const board = new T.Group(); at(board, 0, 1.2, -2, sg); board.rotation.x = -0.62;
    at(box(108, 10, 1.2, 0xf2f4f8), 0, 5, -0.6, board);
    const scl = h.canvasPlane(105, 9, 1400, (x, W, Hh) => {
      const cw = W / 15;
      d.phc.forEach((c, p) => { x.fillStyle = hexs(c); x.fillRect(p * cw, 0, cw + 1, Hh * 0.72); h.fitText(x, String(p), p * cw + cw / 2, Hh * 0.36, cw * 0.8, Hh * 0.42, 800, MONO, p >= 9 || p <= 1 ? '#fff' : '#0b1019'); });
      x.strokeStyle = '#1b1610'; x.lineWidth = 5; x.strokeRect(2, 2, W - 4, Hh * 0.72 - 2);
      x.fillStyle = '#4a556c'; h.fitText(x, 'кислая среда', cw * 3.5, Hh * 0.87, cw * 6, Hh * 0.2, 700, FONT, '#c0392b'); h.fitText(x, 'нейтр.', cw * 7.5, Hh * 0.87, cw * 1.1, Hh * 0.18, 700, FONT, '#2f8a3a'); h.fitText(x, 'щелочная среда', cw * 11.5, Hh * 0.87, cw * 6, Hh * 0.2, 700, FONT, '#3a4ab4');
    }); at(scl, 0, 5, 0.02, board);
    // полочка у основания шкалы: на ней — поставленные банки
    at(box(108, 0.8, 4.2, C.WOOD), 0, 1.6, 2.2, sg);
    d.jars.forEach((j, i) => {
      if (!j.placed) return;
      const mg = new T.Group(); at(mg, X0 + (j.ph + 0.5) * CW, 2, 2.2, sg);
      const w = new T.Mesh(keep(new T.CylinderGeometry(1.9, 1.8, 4.2, 20, 1, true)), h.glassMat(0xd8eef8, 0.3)); w.add(new T.Mesh(w.geometry, kit.hullMat)); at(w, 0, 2.1, 0, mg);
      at(cyl(1.7, 2.6, j.liq, { edges: false, hull: false, matOpt: { transparent: true, opacity: Math.max(0.45, j.op) } }), 0, 1.3, 0, mg);
      at(cyl(2.1, 0.7, 0x4a556c, { seg: 18 }), 0, 4.55, 0, mg);
    });
    // кнопки-зоны впереди
    const zones = [['z-a', 'кислая', -28, 47, 0xef6a4a], ['z-n', '7', 0, 6.4, 0x5fbf4a], ['z-b', 'щелочная', 28, 47, 0x4a64c4]];
    zones.forEach(([k, t, x, w, c]) => {
      const zg = new T.Group(); at(zg, x, 0, SZ + 13, g); clickable(zg, k);
      at(box(w, 1.6, 6, c), 0, 0.8, 0, zg);
      const tp = h.canvasPlane(w * 0.96, 5.4, Math.max(160, Math.round(w * 14)), (cx, W, Hh) => { h.fitText(cx, t, W / 2, Hh / 2 + 2, W * 0.9, Hh * 0.62, 800, FONT, '#ffffff'); }); tp.rotation.x = -Math.PI / 2; at(tp, 0, 1.62, 0, zg);
    });
    const sj = d.sel != null ? d.jars[d.sel] : null;
    if (sj) tag(v3(JX(d.sel), JH + 6, JZ), sj.name, sj.ph != null ? 'pH ≈ ' + sj.ph + (sj.placed ? ' · на шкале' : '') : 'проверьте', sj.placed);
    tag(v3(-46, 12, SZ - 4), 'Шкала pH', 'на шкале ' + d.nPlaced + ' из ' + d.jars.length, d.nPlaced === d.jars.length);
    tag(v3(55, 6, 30), 'Индикатор', 'проверено ' + d.nTested + ' из ' + d.jars.length);
    kit.onFrame(() => {
      const tn = now();
      strips.forEach(s => { const k = kit.reduce ? 1 : clamp((tn - s.t0) / 0.7, 0, 1); s.sg.position.y = 9 * (1 - ease(k)); });
    });
  };

  // =====================================================================================
  // ===== «Что нельзя смешивать»: флаконы на полке, стакан мысленного опыта, табличка с вердиктом =====
  SC['chho-safe'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const BZ = -18, BXp = i => -45 + i * 18;
    const pair = d.last ? d.last.pair : [];
    // полка
    at(box(116, 1.4, 16, C.WOOD2), 0, 0.7, BZ, g);
    at(box(116, 14, 1.4, C.WOOD), 0, 7, BZ - 8.6, g);
    const lab = (b, w, hh) => h.label(w, hh, [b.l[0], b.l[1], { t: b.f, mono: true, s: 0.55, c: '#2a3550' }], { pics: b.pic.length ? b.pic : null, pw: 256 });
    d.bottles.forEach((b, i) => {
      const x = BXp(i), bg = new T.Group(); at(bg, x, 1.4, BZ, g); clickable(bg, 'bt-' + i);
      const sel = d.sel === i, lit = pair.includes(i);
      const body = new T.Group(); at(body, 0, sel ? 2 : 0, 0, bg);
      if (b.k === 'bl') { // канистра отбеливателя с ручкой
        at(box(10, 13, 6.5, b.c), 0, 6.5, 0, body);
        at(cyl(1.4, 2, b.c), 2.5, 14, 0, body); at(cyl(1.7, 1.8, 0xf2f4f8, { seg: 18 }), 2.5, 15.6, 0, body);
        const hd = mesh(new T.TorusGeometry(2.4, 0.8, 8, 16, Math.PI), b.c, { edges: false, hull: true }); at(hd, -2, 13, 0, body);
        at(lab(b, 8.4, 8.6), 0, 6.4, 3.3, body);
      } else if (b.k === 'wc') { // «утёнок» с изогнутым носиком
        at(box(8.6, 13, 5.6, b.c), 0, 6.5, 0, body);
        at(cyl(1.6, 3, b.c, { r2: 1.3 }), 0, 14.5, 0, body);
        const nk = cyl(0.9, 4.4, b.c, { r2: 0.5 }); nk.rotation.z = -1.0; at(nk, 1.8, 17.2, 0, body);
        at(cyl(1.2, 0.8, 0xe8ecf4), 0, 16.2, 0, body);
        at(lab(b, 7.6, 8.6), 0, 6.4, 2.85, body);
      } else if (b.k === 'am') { // аптечный флакон тёмного стекла
        h.bottle(body, 0, 0, { r: 3, h: 10, rn: 1.1, glass: true, glassCol: 0x8a5a2a, glassOp: 0.7, liq: 0xdfe6ee, fill: 0.55, cap: 0xf2f4f8, capH: 1.8, label: lab(b, 5.4, 6), labelY: 0.32 });
      } else if (b.k === 'pipe') { // гранулы/гель для труб, крышка с защитой от детей
        h.bottle(body, 0, 0, { r: 4.2, h: 12, rn: 1.8, color: b.c, cap: 0x2c3240, capH: 3, label: lab(b, 7, 6.8), labelY: 0.32 });
        for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5; at(box(0.3, 2.6, 0.3, 0x4a556c, { edges: false }), Math.cos(a) * 2.2, 13.5, Math.sin(a) * 2.2, body); }
      } else if (b.k === 'vin') { // стеклянная бутылка уксуса
        h.bottle(body, 0, 0, { r: 3.2, h: 16, rn: 1, sh: 0.55, glass: true, liq: b.c, liqOp: 0.55, fill: 0.48, cap: 0xc0392b, capH: 1.6, label: lab(b, 5.6, 6), labelY: 0.25 });
      } else { // пачка соды
        at(box(8, 11, 4.4, 0xf7f7f2), 0, 5.5, 0, body);
        at(box(8.1, 2.4, 4.5, 0xe0473a, { edges: false }), 0, 9.2, 0, body);
        at(lab(b, 7.4, 7), 0, 4.6, 2.26, body);
      }
      if (sel || lit) h.ring(bg, 0, 0.1, 0, 6.8, sel ? 0xffd166 : d.last.v === 'danger' ? 0xff5a4a : 0xffb547);
      if (sel && !kit.reduce) kit.onFrame((dt, t) => { body.position.y = 2 + 0.4 * Math.sin(t * 3); });
    });
    // стакан мысленного опыта
    const R = d.last, cx = 0, cz = 16;
    const mg = new T.Group(); at(mg, cx, 0, cz, g); clickable(mg, 'clear');
    const bk = h.beaker(mg, 0, 0, 0, 6.5, 13);
    const mixCol = R ? (R.gas === 'cl' ? 0xd9e8a0 : R.gas === 'boil' ? 0xcfe0e8 : R.gas === 'smoke' ? 0xe8ecf4 : 0xc8e6f5) : 0xc8e6f5;
    const lq = h.liquid(mg, 0, 0.6, 0, 6, mixCol, 0.5); lq.set(R ? 6 : 0);
    const st = h.label(6.2, 2, [R ? 'мысленно!' : 'пусто'], { bg: '#fff6e6' }); at(st, 0, 9.6, 6.6, mg);
    if (R) {
      const gas = R.gas;
      if (gas === 'cl') { h.cloud(mg, 0, 12, 0, { n: 12, color: 0xb8d830, size: 8, rise: 16, spread: 10, op: 0.95, speed: 0.2 }); at(h.glow(0xc8e05a, 22, 0.35), 0, 16, 0, mg); }
      if (gas === 'cla') h.cloud(mg, 0, 12, 0, { n: 12, color: 0xd0e0b0, size: 7.5, rise: 15, spread: 10, op: 0.9, speed: 0.2 });
      if (gas === 'smoke') h.cloud(mg, 0, 13, 0, { n: 9, color: 0xffffff, size: 5, rise: 14, spread: 7, op: 0.7, speed: 0.25 });
      if (gas === 'smell') h.cloud(mg, 0, 13, 0, { n: 6, color: 0xe8ecf4, size: 4, rise: 12, spread: 6, op: 0.35, speed: 0.25 });
      if (gas === 'boil' || gas === 'warm') h.cloud(mg, 0, 13, 0, { n: 8, color: 0xffffff, size: 4.5, rise: 13, spread: 7, op: gas === 'boil' ? 0.6 : 0.3, speed: 0.4 });
      if (gas === 'co2' || gas === 'boil' || gas === 'smoke') h.bubbles(mg, 0, 0.6, 0, 4.5, 14, { amt: 1, top: 6, big: gas === 'boil' ? 0.7 : 0.45, speed: gas === 'boil' ? 1.4 : 0.8 });
      if (gas === 'co2') { for (let i = 0; i < 7; i++) at(h.ball(0.9 + rnd(i) * 0.5, 0xffffff, { matOpt: { transparent: true, opacity: 0.9 }, shadow: false }), Math.cos(i) * 3.6, 6.8, Math.sin(i) * 3.6, mg); }
      // брызги при бурной нейтрализации
      if (gas === 'boil' && !kit.reduce) {
        const sp = []; for (let i = 0; i < 8; i++) { const b = h.ball(0.35, 0xcfe0e8, { hull: false, shadow: false }); at(b, 0, 7, 0, mg); sp.push({ b, a: i * 0.785, ph: rnd(i + 5) }); }
        kit.onFrame((dt, t) => sp.forEach(o => { const k = (t * 0.9 + o.ph) % 1; o.b.position.set(Math.cos(o.a) * 9 * k, 7 + 12 * k - 16 * k * k, Math.sin(o.a) * 9 * k); }));
      }
      // красный знак «нельзя» у опасной смеси
      if (R.v === 'danger') {
        const sg = new T.Group(); at(sg, 11, 0, 3, mg); sg.rotation.y = 0.3; sg.scale.setScalar(1.35);
        at(cyl(0.4, 9, C.STEEL, { edges: false }), 0, 4.5, 0, sg); at(cyl(2, 0.6, C.DARK), 0, 0.3, 0, sg);
        const sn = h.canvasPlane(6.4, 6.4, 256, (x, W) => {
          x.fillStyle = '#e0303a'; x.beginPath(); x.arc(W / 2, W / 2, W / 2 - 6, 0, 7); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 12; x.beginPath(); x.arc(W / 2, W / 2, W / 2 - 18, 0, 7); x.stroke();
          x.strokeStyle = '#1b1610'; x.lineWidth = 6; x.beginPath(); x.arc(W / 2, W / 2, W / 2 - 4, 0, 7); x.stroke();
          x.fillStyle = '#fff'; x.fillRect(W * 0.2, W * 0.42, W * 0.6, W * 0.16);
        }, { side: T.DoubleSide }); at(sn, 0, 11, 0, sg);
      }
    }
    // табличка с вердиктом
    const VC = { danger: ['#e0303a', '#fff', 'НЕЛЬЗЯ СМЕШИВАТЬ'], useless: ['#ffb547', '#1b1610', 'БЕСПОЛЕЗНО'], warn: ['#f2c63a', '#1b1610', 'ОСТОРОЖНО'], none: ['#5fbf4a', '#fff', 'НЕТ РЕАКЦИИ'] };
    const bd = new T.Group(); at(bd, -31, 0, 22, g); bd.rotation.y = 0.32; bd.scale.setScalar(1.2);
    at(box(2, 1, 6, C.DARK), -11, 0.5, 0, bd); at(box(2, 1, 6, C.DARK), 11, 0.5, 0, bd);
    at(cyl(0.45, 6, C.STEEL, { edges: false }), -11, 3.5, 0, bd); at(cyl(0.45, 6, C.STEEL, { edges: false }), 11, 3.5, 0, bd);
    at(box(31, 17, 1, 0xf2f4f8), 0, 14, -0.2, bd);
    const nm = i => d.bottles[i].l.join(' ');
    const card = h.canvasPlane(30, 16, 900, (x, W, Hh) => {
      x.fillStyle = '#fffdf6'; x.fillRect(0, 0, W, Hh);
      if (!R) {
        x.fillStyle = '#26324a'; x.fillRect(0, 0, W, Hh * 0.24); h.fitText(x, 'МЫСЛЕННЫЙ ОПЫТ', W / 2, Hh * 0.12, W * 0.9, Hh * 0.13, 800, FONT, '#fff');
        h.fitText(x, d.sel != null ? 'Выбран: ' + nm(d.sel) : 'Нажмите два флакона подряд', W / 2, Hh * 0.42, W * 0.9, Hh * 0.1, 700);
        h.fitText(x, 'здесь появится результат', W / 2, Hh * 0.58, W * 0.9, Hh * 0.08, 600, FONT, '#4a556c');
        h.fitText(x, 'По-настоящему бытовую химию не смешивают!', W / 2, Hh * 0.82, W * 0.92, Hh * 0.075, 800, FONT, '#c0392b');
        return;
      }
      const [bg, fg, t] = VC[R.v];
      x.fillStyle = bg; x.fillRect(0, 0, W, Hh * 0.26);
      if (R.v === 'danger') { h.picto(x, Hh * 0.13, Hh * 0.13, Hh * 0.09, 'exc'); h.picto(x, W - Hh * 0.13, Hh * 0.13, Hh * 0.09, 'exc'); }
      h.fitText(x, t, W / 2, Hh * 0.135, W * 0.72, Hh * 0.15, 900, FONT, fg);
      h.fitText(x, nm(R.pair[0]) + ' + ' + nm(R.pair[1]), W / 2, Hh * 0.37, W * 0.92, Hh * 0.085, 700, FONT, '#4a556c');
      h.fitText(x, R.eq, W / 2, Hh * 0.54, W * 0.94, Hh * 0.1, 700, MONO, '#1b1610');
      const words = R.note.split(' '), lines = ['']; words.forEach(w => { const tl = (lines[lines.length - 1] + ' ' + w).trim(); if (tl.length > 44 && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = tl; });
      lines.slice(0, 2).forEach((l, i) => h.fitText(x, l, W / 2, Hh * (0.72 + i * 0.12), W * 0.92, Hh * 0.075, 600, FONT, '#1b1610'));
    }); at(card, 0, 14, 0.32, bd);
    // счётчик найденных опасных смесей: красные ромбы
    const cg = new T.Group(); at(cg, 36, 0, 22, g); cg.rotation.y = 0.3;
    at(box(24, 1.2, 9, C.WOOD2), 0, 0.6, 0, cg);
    at(box(22, 6.5, 1, 0xf2f4f8), 0, 4.5, -2.5, cg);
    const cnt = h.canvasPlane(21, 6, 640, (x, W, Hh) => {
      for (let i = 0; i < d.total; i++) {
        const cx2 = W * (0.14 + i * 0.24), on = i < d.found;
        x.save(); x.translate(cx2, Hh * 0.45); x.rotate(Math.PI / 4); x.fillStyle = on ? '#e0303a' : '#e8ecf4'; x.strokeStyle = on ? '#1b1610' : '#9aa3b2'; x.lineWidth = 6; x.fillRect(-Hh * 0.24, -Hh * 0.24, Hh * 0.48, Hh * 0.48); x.strokeRect(-Hh * 0.24, -Hh * 0.24, Hh * 0.48, Hh * 0.48); x.restore();
        h.fitText(x, on ? '!' : '?', cx2, Hh * 0.46, Hh * 0.4, Hh * 0.36, 900, FONT, on ? '#fff' : '#9aa3b2');
      }
    }); at(cnt, 0, 4.5, -1.95, cg);
    if (d.sel != null) tag(v3(BXp(d.sel), 22, BZ), nm(d.sel), 'выбран · нажмите второй');
    tag(v3(cx, 22, cz), R ? 'Мысленный опыт' : 'Стакан', R ? R.t.toLowerCase() : 'только мысленно', R && R.v === 'danger');
    tag(v3(36, 10, 22), 'Опасные смеси', 'найдено ' + d.found + ' из ' + d.total, d.found === d.total);
  };

  // =====================================================================================
  // ===== «Белки, жиры, углеводы»: штатив с пробирками A–F, реактивы, фильтровальная бумага, лотки =====
  SC['chho-bju'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const RZ = -14, TXp = i => -32 + i * 10, TR = 1.8, TH = 17;
    const RGC = { iod: 0x8a4a1a, biu: 0x3f8fd6, pap: 0xf7f5ee };
    const M = mem.bju || { last: {}, col: {} };
    const anim = {};
    d.tubes.forEach((s, i) => { if (s.last && s.last !== M.last[s.k] && s.last !== 'pap') anim[s.k] = { t0: now(), from: M.col[s.k] ?? s.col, rg: s.last }; });
    d.tubes.forEach(s => { M.last[s.k] = s.last; M.col[s.k] = s.col; }); mem.bju = M;
    // деревянный штатив для пробирок
    const rk = new T.Group(); at(rk, -7, 0, RZ, g);
    at(box(64, 1.4, 16, C.WOOD2), 0, 0.7, 3, rk);
    at(box(64, 1.4, 7, C.WOOD), 0, 5.2, 0, rk);
    at(box(1.4, 4, 7, C.WOOD2), -31.3, 3.4, 0, rk); at(box(1.4, 4, 7, C.WOOD2), 31.3, 3.4, 0, rk);
    const tubeObjs = [];
    d.tubes.forEach((s, i) => {
      const x = TXp(i);
      // кружки результатов перед пробиркой: йод · Cu(OH)₂ · бумага
      const chip = h.canvasPlane(8.4, 2.6, 300, (cx, W, Hh) => {
        const C3 = [['#1d2470', 'I'], ['#7b3aa8', 'Cu'], ['#d9b84a', 'Б']];
        s.res.forEach((r, j) => {
          const px = W * (0.18 + j * 0.32), py = Hh / 2;
          cx.beginPath(); cx.arc(px, py, Hh * 0.38, 0, 7); cx.fillStyle = r > 0 ? C3[j][0] : r < 0 ? '#c8d1e2' : '#f7f3ea'; cx.fill(); cx.lineWidth = 5; cx.strokeStyle = '#1b1610'; cx.stroke();
          h.fitText(cx, r > 0 ? '+' : r < 0 ? '−' : '·', px, py + 2, Hh * 0.6, Hh * 0.62, 900, FONT, r > 0 ? '#fff' : '#4a556c');
        });
      }); chip.rotation.x = -1.1; at(chip, x + 7, 1.5, 8.5, rk);
      if (s.bin) return;
      const sel = d.sel === i;
      const tg = new T.Group(); at(tg, x, sel ? 4 : 1.4, RZ, g); clickable(tg, 'tube-' + i);
      const tt = h.testTube(tg, 0, 0, 0, TR, TH, 9.5, s.col, s.op);
      const lb = h.label(2.8, 2.8, [s.k], { bg: '#fffaf0' }); at(lb, 0, 12.5, TR + 0.08, tg);
      tg.add(at(h.hitBox(5, TH + 2, 5), 0, TH / 2, 0, new T.Group()));
      if (sel) h.ring(g, x, 6, RZ, TR + 0.9);
      if (anim[s.k]) tubeObjs.push({ s, tt, x, y: sel ? 4 : 1.4, a: anim[s.k] });
    });
    // реактивы справа
    const rx = 40, rzs = { iod: -20, biu: -6, pap: 8 };
    d.rgs.forEach(r => {
      const z = rzs[r.k], on = d.rg === r.k, rg = new T.Group(); at(rg, rx, 0, z, g); clickable(rg, 'rg-' + r.k);
      const lift = on ? 1.2 : 0, body = new T.Group(); at(body, 0, lift, 0, rg);
      if (r.k === 'iod') {
        h.bottle(body, 0, 0, { r: 3.2, h: 9, rn: 1.1, glass: true, glassCol: 0x7a3a12, glassOp: 0.75, liq: 0x6a2a0a, fill: 0.6, cap: false, label: h.label(5.4, 3.4, ['йод', { t: 'I₂', mono: true }]), labelY: 0.42 });
        at(cyl(1.3, 1.6, 0x2c3240), 0, 9.8, 0, body); const bl = h.ball(1.3, 0x2c3240); bl.scale.y = 1.6; at(bl, 0, 11.8, 0, body);
      } else if (r.k === 'biu') {
        h.bottle(body, -2.2, 0, { r: 2.4, h: 8, rn: 0.9, glass: true, liq: 0x3f8fd6, liqOp: 0.8, fill: 0.6, cap: 0x2c3240, capH: 1.4, label: h.label(4, 2.6, [{ t: 'CuSO₄', mono: true }]), labelY: 0.4 });
        h.bottle(body, 2.6, 0, { r: 2.4, h: 8, rn: 0.9, glass: true, liq: 0xeef2f6, liqOp: 0.5, fill: 0.6, cap: 0x2c3240, capH: 1.4, label: h.label(4, 2.6, [{ t: 'NaOH', mono: true }]), labelY: 0.4 });
      } else {
        for (let k = 0; k < 6; k++) at(cyl(5, 0.3, 0xf7f5ee, { seg: 32, edges: false }), (rnd(k) - 0.5) * 0.6, 0.2 + k * 0.32, (rnd(k + 3) - 0.5) * 0.6, body);
        const pl = h.label(6, 2.2, ['бумага'], { bg: '#fffaf0' }); pl.rotation.x = -Math.PI / 2; at(pl, 0, 2.2, 0, body);
      }
      if (on) h.ring(rg, 0, 0.15, 0, 6.2, 0x72d4e8);
    });
    // пятно на фильтровальной бумаге у выбранной пробы
    const ss = d.sel != null ? d.tubes[d.sel] : null;
    if (ss && ss.last === 'pap') {
      const pos = ss.res[2] > 0;
      const pp = h.canvasPlane(13, 13, 256, (x, W) => {
        x.fillStyle = '#f7f5ee'; x.beginPath(); x.arc(W / 2, W / 2, W / 2 - 3, 0, 7); x.fill(); x.strokeStyle = '#1b1610'; x.lineWidth = 4; x.stroke();
        const gr = x.createRadialGradient(W / 2, W / 2, 4, W / 2, W / 2, W * 0.26);
        gr.addColorStop(0, pos ? 'rgba(217,184,74,.75)' : 'rgba(200,209,226,.35)'); gr.addColorStop(1, pos ? 'rgba(217,184,74,.25)' : 'rgba(200,209,226,0)');
        x.fillStyle = gr; x.beginPath(); x.ellipse(W / 2, W / 2, W * 0.27, W * 0.23, 0.4, 0, 7); x.fill();
        h.fitText(x, ss.k, W / 2, W * 0.86, W * 0.2, W * 0.1, 800);
      }); pp.rotation.x = -Math.PI / 2; at(pp, 22, 0.08, 6, g);
      tag(v3(22, 2, 8), 'Бумага · ' + ss.k, pos ? 'пятно не высыхает' : 'пятно высохло', pos);
    }
    // лотки впереди
    const BINS = [['b', 'БЕЛКИ', 0xb88cf0, -36], ['z', 'ЖИРЫ', 0xf2d24a, -4], ['u', 'УГЛЕВОДЫ', 0x72d4e8, 28]];
    BINS.forEach(([k, t, c, x]) => {
      const bg = new T.Group(); at(bg, x, 0, 24, g); clickable(bg, 'bin-' + k);
      const W = 28, D = 14;
      at(box(W, 0.8, D, 0xe8ecf4), 0, 0.4, 0, bg);
      at(box(W, 2.6, 0.8, 0xe8ecf4), 0, 1.3, -D / 2 + 0.4, bg); at(box(W, 2.6, 0.8, c), 0, 1.3, D / 2 - 0.4, bg);
      at(box(0.8, 2.6, D, 0xe8ecf4), -W / 2 + 0.4, 1.3, 0, bg); at(box(0.8, 2.6, D, 0xe8ecf4), W / 2 - 0.4, 1.3, 0, bg);
      const fl = h.canvasPlane(W - 2, 2.2, 600, (cx, Wp, Hp) => h.fitText(cx, t, Wp / 2, Hp / 2 + 2, Wp * 0.9, Hp * 0.75, 900, FONT, '#1b1610')); at(fl, 0, 1.3, D / 2 + 0.02, bg);
      const inside = d.tubes.filter(s => s.bin === k);
      inside.forEach((s, j) => {
        const lz = -4 + j * 4.2, tt = h.testTube(bg, 0, 0, 0, 1.3, 12, 5, s.col, s.op);
        tt.g.rotation.z = -Math.PI / 2; tt.g.position.set(-12, 2.2, lz);
        const nl = h.label(11, 2.6, [s.k + ' · ' + s.name], { bg: '#fffaf0', pw: 400 }); nl.rotation.x = -Math.PI / 2; at(nl, 6.6, 0.85, lz, bg);
      });
    });
    const sT = ss ? ss : null;
    if (sT && !sT.bin) tag(v3(TXp(d.sel), TH + 8, RZ), 'Проба ' + sT.k, d.selTxt || 'не проверена');
    const cur = d.rgs.find(r => r.k === d.rg);
    tag(v3(rx, 16, rzs[d.rg]), 'Реактив', cur.sh);
    tag(v3(-52, 6, 12), 'Лотки', 'разложено ' + d.nPlaced + ' из ' + d.tubes.length, d.nPlaced === d.tubes.length);
    // анимация: капля реактива падает в пробирку, раствор меняет цвет
    tubeObjs.forEach(o => {
      const a = o.a, top = v3(o.x, o.y + TH + 6, RZ), sur = v3(o.x, o.y + 9.5, RZ);
      h.fallingDrop(g, top, sur, RGC[a.rg], a.t0, 0.5, 0.5);
      const c0 = new kit.T.Color(a.from), c1 = new kit.T.Color(o.s.col);
      o.tt.mat.color.copy(c0);
      kit.onFrame(() => { const k = kit.reduce ? 1 : clamp((now() - a.t0 - 0.5) / 0.9, 0, 1); o.tt.mat.color.copy(c0).lerp(c1, ease(k)); });
    });
  };

  // =====================================================================================
  // ===== «Витамины: сколько C в соке»: штатив с бюреткой йода, колба на мешалке, соки, счётчик, диаграмма =====
  SC['chho-vit'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const FX = 2, FZ = -4;
    const M = mem.vit && mem.vit.vs === d.vs ? mem.vit : { vs: d.vs, drops: d.drops, blue: d.blue, dropAt: -9, blueAt: -9 };
    if (d.drops > M.drops) M.dropAt = now();
    if (d.blue && !M.blue) M.blueAt = now();
    M.drops = d.drops; M.blue = d.blue; mem.vit = M;
    // магнитная мешалка
    const ms = new T.Group(); at(ms, FX, 0, FZ, g);
    at(box(20, 3.6, 17, 0xeef1f5), 0, 1.8, 0, ms);
    at(cyl(7.5, 0.3, 0xd9dfe9, { edges: false }), 0, 3.75, 0, ms);
    const kn = cyl(1.6, 1.4, C.DARK, { seg: 18 }); kn.rotation.x = Math.PI / 2; at(kn, 5.5, 1.8, 8.9, ms);
    at(h.ball(0.5, 0x3fae5a, { hull: false }), -6, 1.8, 8.6, ms);
    // коническая колба
    const y0 = 3.9, FR = 7.6, NR = 2.2;
    const pts = [h.v2(0, 0), h.v2(FR - 0.6, 0), h.v2(FR, 0.6), h.v2(FR, 1.2), h.v2(NR, 11.5), h.v2(NR, 15.5), h.v2(NR + 0.5, 15.9)];
    const fgeo = keep(new T.LatheGeometry(pts, 40));
    const flask = new T.Mesh(fgeo, h.glassMat(0xd8eef8, 0.24)); flask.add(new T.Mesh(fgeo, kit.hullMat)); at(flask, FX, y0, FZ, g);
    const LH = 4.6, rTop = FR - (FR - NR) * (LH - 1.2) / (11.5 - 1.2);
    const jc = new T.Color(d.jc).lerp(new T.Color(0xf6efe0), 0.35), blueC = new T.Color(0x1f2f8f);
    const lq = h.liquid(g, FX, y0 + 0.3, FZ, FR - 0.4, 0, 0.7, rTop - 0.3); lq.set(LH);
    lq.mat.color.copy(d.blue ? blueC : jc);
    const bar = h.ball(1, 0xf2f4f8, { hull: true }); bar.scale.set(2.2, 0.45, 0.6); at(bar, FX, y0 + 0.9, FZ, g);
    const spot = new T.Mesh(keep(new T.CircleGeometry(1, 28)), h.basic(0x8a4a1a, { transparent: true, opacity: 0, depthWrite: false })); spot.rotation.x = -Math.PI / 2; at(spot, FX, y0 + 0.3 + LH + 0.05, FZ, g);
    // штатив и бюретка с йодом
    const bTop = 54, bBot = 27, tip = 21.5;
    h.stand(g, FX + 14, FZ - 14, 56, [{ y: 46, to: v3(FX, 0, FZ), w: 2.4 }, { y: 31, to: v3(FX, 0, FZ), w: 2.4 }]);
    const bw = new T.Mesh(keep(new T.CylinderGeometry(1.1, 1.1, bTop - bBot, 24, 1, true)), h.glassMat(0xd8eef8, 0.3)); bw.add(new T.Mesh(bw.geometry, kit.hullMat)); at(bw, FX, (bTop + bBot) / 2, FZ, g);
    for (let k = 0; k <= 10; k++) at(box(k % 5 ? 0.8 : 1.4, 0.12, 0.1, 0x1b1610, { edges: false, shadow: false }), FX + 0.4, bTop - 2 - k * 2.3, FZ + 1.12, g);
    const iod = h.liquid(g, FX, bBot, FZ, 0.85, 0x8a4a1a, 0.88);
    const lvl = n => (bTop - bBot - 3) * (1 - clamp(n / 40, 0, 1) * 0.85);
    iod.set(lvl(d.drops));
    at(cyl(1.1, 1.6, 0xd8eef8, { r2: 1.1, matOpt: { transparent: true, opacity: 0.4 } }), FX, bBot - 0.8, FZ, g);
    // кран — нажимается
    const tap = new T.Group(); at(tap, FX, 24.5, FZ, g); clickable(tap, 'd1');
    at(cyl(0.9, 3, 0xd8eef8, { matOpt: { transparent: true, opacity: 0.5 } }), 0, 0, 0, tap);
    const hd = box(5.4, 0.9, 1.1, 0xe06a4a); at(hd, 0, 0, 1.1, tap);
    at(cyl(0.5, 3, 0xd8eef8, { r2: 0.9, matOpt: { transparent: true, opacity: 0.5 } }), FX, tip + 0.6, FZ, g);
    tap.add(at(h.hitBox(7, 6, 5), 0, 0, 0, new T.Group()));
    h.fallingDrop(g, v3(FX, tip - 0.6, FZ), v3(FX, y0 + LH + 0.3, FZ), 0x8a4a1a, M.dropAt, 0.45, 0.5);
    // баночка крахмала
    const sj = new T.Group(); at(sj, -16, 0, 14, g);
    h.bottle(sj, 0, 0, { r: 3, h: 6, rn: 2.2, sh: 0.8, glass: true, liq: 0xf6f3ea, liqOp: 0.95, fill: 0.6, cap: 0x4a556c, capH: 1.4, label: h.label(5, 2.4, ['крахмал']), labelY: 0.42 });
    // соки
    const JZp = i => -24 + i * 12;
    d.juices.forEach((j, i) => {
      const jg = new T.Group(); at(jg, -42, 0, JZp(i), g); clickable(jg, 'ju-' + i);
      if (j.k === 'bo') { // кипячёный: в маленькой кастрюльке
        const pot = new T.Mesh(keep(new T.CylinderGeometry(4.4, 4.2, 6, 32, 1, true)), kit.toon(0xc6ccd6, { side: T.DoubleSide })); pot.add(new T.Mesh(pot.geometry, kit.hullMat)); at(pot, 0, 3, 0, jg);
        at(cyl(4.2, 0.5, 0x9aa3b2, { edges: false }), 0, 0.25, 0, jg);
        at(cyl(4, 0.3, j.c, { edges: false, hull: false }), 0, 4.6, 0, jg);
        const hd2 = box(6, 0.8, 1.2, C.DARK); at(hd2, 7, 5.4, 0, jg);
        const lb = h.label(6, 2.6, [j.sh]); at(lb, 0, 2.6, 4.45, jg);
      } else {
        h.bottle(jg, 0, 0, { r: 3.2, h: 12, rn: 1.2, glass: true, liq: j.c, liqOp: 0.85, fill: 0.62, cap: j.k === 'cu' ? 0x5a2a4a : 0xf2a33a, capH: 1.6, label: h.label(5.6, 3, [j.sh]), labelY: 0.62 });
      }
      if (d.vs === i) h.ring(jg, 0, 0.15, 0, 5.4);
      const rs = h.label(5.8, 2.4, [j.n ? j.n + ' кап. ✓' : '—'], { bg: j.n ? '#e2f6e8' : '#f2f4f8', pw: 220 }); rs.rotation.x = -1.0; at(rs, 6.6, 1.2, 1, jg);
    });
    // счётчик капель с кнопками +1 / +5
    const cg = new T.Group(); at(cg, 26, 0, 20, g); cg.rotation.y = 0.35;
    at(box(18, 5, 10, 0x3b4a66), 0, 2.5, 0, cg);
    const scr = h.screen(14, 3.4, '', '#ffd166'); at(scr, 0, 2.6, 5.06, cg);
    h.button(cg, -4.5, 5, 0, '+1', 0xe06a4a, 'd1', 5); h.button(cg, 4.5, 5, 0, '+5', 0xd08a2a, 'd5', 5);
    // диаграмма мг C в 100 мл
    const dg = new T.Group(); at(dg, 44, 0, -18, g); dg.rotation.y = 0.2;
    at(box(28, 1.4, 8, C.WOOD2), 0, 0.7, 0, dg);
    const PH = 20;
    at(box(28, PH, 0.8, 0xf2f4f8), 0, 1.4 + PH / 2, -3.6, dg);
    const top = v => 1.4 + 2.2 + (PH - 6.5) * clamp(v / 150, 0, 1);
    const panel = h.canvasPlane(27, PH - 0.6, 720, (x, W, Hh) => {
      const sy = Hh / (PH - 0.6), y = v => Hh - (top(v) - 1.4 - 0.3) * sy;
      x.fillStyle = '#fff'; x.fillRect(0, 0, W, Hh);
      h.fitText(x, 'мг витамина C в 100 мл', W / 2, Hh * 0.06, W * 0.9, Hh * 0.055, 800);
      x.strokeStyle = '#c8d1e2'; x.lineWidth = 2; [0, 50, 100, 150].forEach(v => { x.beginPath(); x.moveTo(W * 0.08, y(v)); x.lineTo(W * 0.97, y(v)); x.stroke(); h.fitText(x, String(v), W * 0.045, y(v), W * 0.07, Hh * 0.035, 600, MONO, '#4a556c'); });
      d.juices.forEach((j, i) => { const bx = W * (0.2 + i * 0.22); h.fitText(x, j.n ? String(j.mg) : '?', bx, j.n ? y(j.mg) - Hh * 0.05 : y(0) - Hh * 0.05, W * 0.18, Hh * 0.05, 800, MONO, j.n ? '#1b1610' : '#9aa3b2'); h.fitText(x, j.sh, bx, Hh * 0.965, W * 0.2, Hh * 0.04, 700, FONT, '#4a556c'); });
    }); at(panel, 0, 1.4 + PH / 2, -3.18, dg);
    d.juices.forEach((j, i) => {
      if (!j.n) return;
      const bx = -13.5 + 27 * (0.2 + i * 0.22), hh2 = top(j.mg) - 1.7;
      at(box(3.6, hh2, 2.4, j.c), bx, 1.4 + hh2 / 2, -1.8, dg);
    });
    tag(v3(FX, bTop + 4, FZ), 'Бюретка · йод I₂', 'капель ' + d.drops);
    tag(v3(FX - 8, 14, FZ + 6), 'Колба · ' + d.jsh, d.blue ? 'синий — конец!' : d.drops ? 'йод исчезает' : '10 мл + крахмал', d.blue);
    tag(v3(44, 25, -18), 'Витамин C', 'измерено ' + d.nMeas + ' из ' + d.juices.length, d.nMeas === d.juices.length);
    kit.onFrame((dt, t) => {
      const tn = now();
      scr.userData.set('капель ' + d.drops, d.blue ? '#9fb0ff' : '#ffd166');
      if (!kit.reduce) { bar.rotation.y = t * 6; }
      // капля йода расплывается бурым пятном и исчезает — витамин C его съедает
      const k = (tn - M.dropAt - 0.45) / 0.9;
      if (!kit.reduce && k > 0 && k < 1 && !(d.blue && tn - M.blueAt < 2)) { spot.material.opacity = 0.75 * (1 - k); spot.scale.setScalar(0.6 + 4 * k); } else spot.material.opacity = 0;
      if (d.blue) { const kb = kit.reduce ? 1 : clamp((tn - M.blueAt - 0.45) / 1.2, 0, 1); lq.mat.color.copy(jc).lerp(blueC, ease(kb)); lq.mat.opacity = 0.7 + 0.22 * ease(kb); }
    });
  };

  // =====================================================================================
  // ===== «Как работают лекарства»: линейка дня с таблетками, «желудок», монитор крови, часы, сигнальные лампы =====
  SC['chho-med'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const P = d.pk, KE = Math.LN2 / P.half;
    const conc = t => { let c = 0; for (const p of d.pills) { const dd = t - p; if (dd > 0) c += P.A * (Math.exp(-KE * dd) - Math.exp(-P.ka * dd)); } return c; };
    // линейка дня 6:00–24:00
    const RZ = 26, XA = -45, XB = 45, hx = hr => XA + (hr - P.t0) * (XB - XA) / (P.t1 - P.t0);
    const rl = new T.Group(); at(rl, 0, 0, RZ, g);
    at(box(98, 1.6, 12, C.WOOD), 0, 0.8, 0, rl);
    const sc = h.canvasPlane(96, 11, 1600, (x, W, Hh) => {
      const X = hr => (hx(hr) + 48) / 96 * W;
      x.fillStyle = 'rgba(134,224,168,.35)'; x.fillRect(X(P.w0), 0, X(P.w1) - X(P.w0), Hh * 0.42);
      h.fitText(x, 'нужно действие ' + P.w0 + ':00–' + P.w1 + ':00', (X(P.w0) + X(P.w1)) / 2, Hh * 0.2, W * 0.5, Hh * 0.2, 700, FONT, '#2f6a3a');
      for (let hr = P.t0; hr <= P.t1; hr++) {
        x.fillStyle = '#1b1610'; x.fillRect(X(hr) - 2, Hh * 0.45, 4, hr % 2 ? Hh * 0.12 : Hh * 0.2);
        if (hr % 2 === 0) h.fitText(x, hr + ':00', X(hr), Hh * 0.8, W * 0.05, Hh * 0.22, 700, MONO);
      }
    }); sc.rotation.x = -Math.PI / 2; at(sc, 0, 1.62, 0, rl);
    // невидимые ячейки часов — нажать, чтобы выпить таблетку
    for (let hr = P.t0; hr < P.t1; hr++) { const hb = h.hitBox(4.6, 2.4, 11); at(hb, hx(hr), 1.6, 0, rl); clickable(hb, 'h-' + hr); }
    // таблетки на линейке
    const capG = keep(new T.CapsuleGeometry(0.9, 1.8, 4, 12)), cnt = {};
    d.pills.forEach((p, i) => {
      const k = cnt[p] = (cnt[p] || 0) + 1;
      const pg = new T.Group(); at(pg, hx(p), 2.5 + (k - 1) * 1.9, -3, rl); clickable(pg, 'pill-' + i);
      const half1 = new T.Mesh(capG, kit.toon(k > 1 ? 0xffb547 : 0xf2f4f8)); half1.add(new T.Mesh(capG, kit.hullMat)); half1.rotation.z = Math.PI / 2; half1.castShadow = true; at(half1, 0, 0, 0, pg);
      at(box(0.2, 1.9, 1.9, 0xe06a4a, { edges: false, shadow: false }), 0, 0, 0, pg);
      pg.add(at(h.hitBox(4, 3, 4), 0, 0, 0, new T.Group()));
    });
    // блистер: выдавленные ячейки = выпитые таблетки
    const bl = new T.Group(); at(bl, 52, 0, 6, g); bl.rotation.y = 0.3; clickable(bl, 'undo');
    at(box(9, 0.6, 14, 0xcfd6e0), 0, 0.3, 0, bl);
    for (let i = 0; i < P.max; i++) {
      const used = i < d.n, z = -4.8 + i * 3.2;
      if (!used) { const b = h.ball(1.2, 0xe8ecf4, { matOpt: { transparent: true, opacity: 0.7 }, shadow: false }); b.scale.set(1.5, 0.6, 1); at(b, 0, 0.6, z, bl); at(box(2.6, 0.9, 1.4, 0xf2f4f8, { edges: false }), 0, 0.8, z, bl); }
      else { const b = h.ball(1.2, 0x9aa3b2, { shadow: false }); b.scale.set(1.5, 0.15, 1); at(b, 0, 0.62, z, bl); }
    }
    // «желудок»: стакан с кислым соком, таблетка тонет и шипит
    const SX = -40, SZ = -6;
    const sg = new T.Group(); at(sg, SX, 0, SZ, g);
    h.beaker(sg, 0, 0, 0, 6.5, 14);
    const acid = h.liquid(sg, 0, 0.6, 0, 6, 0xf4b6a6, 0.5); acid.set(9);
    const sl = h.label(6.4, 2.2, ['желудок · HCl']); at(sl, 0, 3.4, 6.6, sg);
    const tab = new T.Mesh(capG, kit.toon(0xf2f4f8)); tab.add(new T.Mesh(capG, kit.hullMat)); tab.rotation.z = Math.PI / 2; tab.visible = false; at(tab, 0, 8, 0, sg);
    const fz = h.bubbles(sg, 0, 0.6, 0, 1.6, 12, { amt: 0, top: 9, big: 0.35, speed: 1.1 });
    // монитор «концентрация в крови»
    const mo = new T.Group(); at(mo, 6, 0, -22, g); mo.rotation.y = 0.22;
    at(box(16, 1.2, 9, C.DARK), 0, 0.6, 0, mo); at(box(2.4, 8, 2, C.DARK), 0, 5, -1, mo);
    at(box(54, 32, 2, 0x2c3240), 0, 24, 0, mo);
    const W2 = 51, H2 = 29, PW = 1020, PHh = Math.round(PW * H2 / W2);
    const base = document.createElement('canvas'); base.width = PW; base.height = PHh;
    {
      const x = base.getContext('2d'), L = PW * 0.08, Rr = PW * 0.97, Tp = PHh * 0.1, Bt = PHh * 0.86;
      const X = t => L + (t - P.t0) / (P.t1 - P.t0) * (Rr - L), Y = c => Bt - Math.min(c, 20) / 20 * (Bt - Tp);
      x.fillStyle = '#0e1520'; x.fillRect(0, 0, PW, PHh);
      x.fillStyle = 'rgba(255,90,74,.22)'; x.fillRect(L, Y(20), Rr - L, Y(P.hi) - Y(20));
      x.fillStyle = 'rgba(134,224,168,.16)'; x.fillRect(L, Y(P.hi), Rr - L, Y(P.lo) - Y(P.hi));
      x.strokeStyle = 'rgba(255,181,71,.6)'; x.setLineDash([6, 8]); x.lineWidth = 3; x.strokeRect(X(P.w0), Y(20), X(P.w1) - X(P.w0), Y(0) - Y(20)); x.setLineDash([]);
      x.strokeStyle = '#8b96ad'; x.lineWidth = 3; x.beginPath(); x.moveTo(L, Tp); x.lineTo(L, Bt); x.lineTo(Rr, Bt); x.stroke();
      for (let c = 0; c <= 20; c += 5) h.fitText(x, String(c), L * 0.55, Y(c), L * 0.7, PHh * 0.05, 600, MONO, '#8b96ad');
      for (let t = P.t0; t <= P.t1; t += 3) h.fitText(x, t + ':00', X(t), Bt + PHh * 0.06, PW * 0.08, PHh * 0.05, 600, MONO, '#8b96ad');
      h.fitText(x, 'опасно', Rr - PW * 0.06, Y(P.hi) - PHh * 0.035, PW * 0.1, PHh * 0.045, 700, FONT, '#ff8a73');
      h.fitText(x, 'действует', Rr - PW * 0.08, Y(P.lo) - PHh * 0.035, PW * 0.14, PHh * 0.045, 700, FONT, '#86e0a8');
      h.fitText(x, 'мг/л в крови', L + PW * 0.09, Tp - PHh * 0.04, PW * 0.18, PHh * 0.045, 700, FONT, '#c8d1e2');
      x.strokeStyle = d.toxic ? '#ff8a73' : '#72d4e8'; x.lineWidth = 6; x.lineJoin = 'round'; x.beginPath();
      for (let i = 0; i <= 360; i++) { const t = P.t0 + i * (P.t1 - P.t0) / 360, c = conc(t); i ? x.lineTo(X(t), Y(c)) : x.moveTo(X(t), Y(c)); }
      x.stroke();
      d.pills.forEach(p => { x.fillStyle = '#f2f4f8'; x.beginPath(); x.arc(X(p), Bt, 9, 0, 7); x.fill(); });
      base.userData = { X, Y };
    }
    const scr = h.canvasPlane(W2, H2, PW); at(scr, 0, 24, 1.05, mo);
    let lastT = -1;
    const drawMon = tc => {
      if (Math.abs(tc - lastT) < 0.04) return; lastT = tc;
      scr.userData.draw((x, W, Hh) => {
        x.drawImage(base, 0, 0);
        const { X, Y } = base.userData, c = conc(tc);
        x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 3; x.beginPath(); x.moveTo(X(tc), Hh * 0.1); x.lineTo(X(tc), Hh * 0.86); x.stroke();
        x.fillStyle = c >= P.hi ? '#ff5a4a' : c >= P.lo ? '#86e0a8' : '#c8d1e2'; x.beginPath(); x.arc(X(tc), Y(c), 12, 0, 7); x.fill();
        const hh = Math.floor(tc), mm = Math.floor((tc % 1) * 60);
        h.fitText(x, String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + '  ' + fmt(c, 1) + ' мг/л', W * 0.62, Hh * 0.05, W * 0.5, Hh * 0.06, 700, MONO, '#ffd166');
      });
    };
    // настольные часы
    const ck = new T.Group(); at(ck, -36, 0, -26, g);
    at(box(12, 1.2, 6, C.WOOD2), 0, 0.6, 0, ck);
    const cb = cyl(6, 2.4, 0xd9b04a, { seg: 36 }); cb.rotation.x = Math.PI / 2; at(cb, 0, 7.6, 0, ck);
    const cf = h.canvasPlane(10.4, 10.4, 256, (x, W) => {
      x.fillStyle = '#fffaf0'; x.beginPath(); x.arc(W / 2, W / 2, W / 2 - 2, 0, 7); x.fill();
      for (let i = 1; i <= 12; i++) { const a = i / 12 * Math.PI * 2 - Math.PI / 2; h.fitText(x, String(i), W / 2 + Math.cos(a) * W * 0.38, W / 2 + Math.sin(a) * W * 0.38 + 2, W * 0.12, W * 0.1, 700, MONO); }
    }); at(cf, 0, 7.6, 1.25, ck);
    const hand = (len, w, col) => { const p = new T.Group(); at(p, 0, 7.6, 1.4, ck); at(box(w, len, 0.2, col, { edges: false, shadow: false }), 0, len / 2, 0, p); return p; };
    const hH = hand(2.8, 0.5, 0x1b1610), hM = hand(4, 0.32, 0x1b1610);
    // сигнальные лампы: не действует / действует / опасно
    const lp = new T.Group(); at(lp, -20, 0, 8, g); lp.rotation.y = 0.3;
    at(box(16, 5, 6, 0x3b4a66), 0, 2.5, 0, lp);
    const LC = [[0x8b96ad, 'мало'], [0x3fd07a, 'норма'], [0xff4a3a, 'опасно']];
    const lamps = LC.map(([c, t], i) => {
      const x = -5 + i * 5;
      const m = new T.Mesh(keep(new T.SphereGeometry(1.4, 16, 10)), h.basic(c)); at(m, x, 5.6, 0, lp);
      const gl = h.glow(c, 7, 0); at(gl, x, 5.8, 0.5, lp);
      const lb = h.canvasPlane(4.6, 1.6, 160, (cx, W, Hh) => h.fitText(cx, t, W / 2, Hh / 2 + 2, W * 0.9, Hh * 0.7, 700, FONT, '#ffffff')); at(lb, x, 2.4, 3.04, lp);
      return { m, gl, c: new T.Color(c) };
    });
    tag(v3(6, 44, -22), 'Концентрация в крови', d.n ? 'мин ' + fmt(d.mn, 1) + ' · пик ' + fmt(d.mx, 1) + ' мг/л' : 'таблеток нет', d.ok);
    tag(v3(-40, 4, RZ + 4), 'Таблетки', d.n + ' из ' + P.max + (d.toxic ? ' · передозировка' : d.ok ? ' · в норме' : ''), d.toxic);
    tag(v3(SX, 17, SZ), 'Желудок', 'таблетка растворяется');
    const sorted = d.pills.slice().sort((a, b) => a - b);
    kit.onFrame((dt, t) => {
      const tc = kit.reduce ? (P.w0 + P.w1) / 2 : P.t0 + (t * 1.25) % (P.t1 - P.t0);
      drawMon(tc);
      const c = conc(tc), zi = c >= P.hi ? 2 : c >= P.lo ? 1 : 0;
      lamps.forEach((L, i) => { L.m.material.color.copy(L.c).multiplyScalar(i === zi ? 1 : 0.25); L.gl.material.opacity = i === zi ? 0.7 : 0; });
      hM.rotation.z = -(tc % 1) * Math.PI * 2; hH.rotation.z = -((tc % 12) / 12) * Math.PI * 2;
      // последняя выпитая таблетка: тонет и растворяется за ~1,2 ч модельного времени
      let p = null; for (const q of sorted) if (tc >= q && tc - q < 1.2) p = q;
      if (p == null) { tab.visible = false; fz.set(0); }
      else { const k = (tc - p) / 1.2; tab.visible = true; tab.position.y = 9.2 - 7.8 * Math.min(1, k * 3); tab.scale.setScalar(Math.max(0.15, 1 - k)); fz.set(1 - k, 9, 0.35, 1.1); fz.g.position.y = 0.6; }
    });
  };
})();
