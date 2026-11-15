// «Как в жизни» для химии: «Химическое производство» (labs/chem-industry) и «Химия и экология» (labs/chem-eco).
// Настольные макеты, как в музее или учебном кабинете: колонна синтеза аммиака и контактный аппарат с пультом,
// карта-рельеф Казахстана с заводами и макет цеха выбранного металла, грядка с мешками удобрений, весами и бочкой Либиха,
// город-макет с ТЭЦ, домами, дорогой, заводом и рекой, Земля под лампой с атмосферой и ледником, две установки синтеза.
// Сцены строятся из window.LUCH_REAL() опыта; ход реакции (зелёная химия) — из LUCH_REAL.live() в onFrame.
(() => {
  const SC = window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {};
  const live = () => { try { return window.LUCH_REAL.live ? window.LUCH_REAL.live() : null; } catch (e) { return null; } };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (x, n) => { let s = (Math.round(x * 10 ** n) / 10 ** n).toFixed(n); if (/^-0(\.0+)?$/.test(s)) s = s.slice(1); return s.replace('.', ',').replace('-', '−'); };
  const rnd = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const hexs = c => '#' + c.toString(16).padStart(6, '0');
  const now = () => performance.now() / 1000;
  const ease = k => k * k * (3 - 2 * k);
  const mem = {};
  const AZ = 0.62; // камера смотрит с этого азимута: таблички поворачиваем к ней
  const FONT = '"Golos Text", "IBM Plex Sans", sans-serif', MONO = '"IBM Plex Mono", monospace';

  // ---------- общие детали ----------
  function H(kit) {
    const { T, at, box, cyl, mesh, keep, grad, glowTex, clickable, toon, C } = kit;
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
    // плоскость с холстом: draw(ctx, pw, ph) можно вызывать снова
    function canvasPlane(w, h, pw, draw, o = {}) {
      const ph = Math.round(pw * h / w), c = document.createElement('canvas'); c.width = pw; c.height = ph;
      const x = c.getContext('2d'), tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: tex, transparent: true, side: o.side || T.FrontSide })));
      m.userData.draw = fn => { x.clearRect(0, 0, pw, ph); fn(x, pw, ph); tex.needsUpdate = true; };
      if (draw) m.userData.draw(draw);
      return m;
    }
    const rr = (x, x0, y0, w, h, r) => { x.beginPath(); if (x.roundRect) x.roundRect(x0, y0, w, h, r); else x.rect(x0, y0, w, h); };
    function fitText(x, t, cx, cy, maxW, size, weight = 700, font = FONT, color = '#1b1610', align = 'center') {
      let fs = size; x.font = `${weight} ${fs}px ${font}`;
      const tw = x.measureText(t).width; if (tw > maxW) { fs = Math.floor(fs * maxW / tw); x.font = `${weight} ${fs}px ${font}`; }
      x.fillStyle = color; x.textAlign = align; x.textBaseline = 'middle'; x.fillText(t, cx, cy);
    }
    // табличка: строки текста (строка — текст или { t, s, c, w, mono })
    function label(w, h, lines, o = {}) {
      return canvasPlane(w, h, o.pw || 256, (x, pw, ph) => {
        x.fillStyle = o.bg || '#fffaf0'; rr(x, 3, 3, pw - 6, ph - 6, ph * 0.14); x.fill();
        x.strokeStyle = o.stroke || '#1b1610'; x.lineWidth = 5; x.stroke();
        if (o.band) { x.fillStyle = o.band; x.fillRect(7, 7, pw - 14, ph * 0.16); }
        const n = lines.length, top = o.band ? ph * 0.2 : ph * 0.06, lh = (ph * 0.95 - top) / n;
        lines.forEach((l, i) => {
          const L = typeof l === 'object' ? l : { t: l };
          fitText(x, L.t, pw / 2, top + lh * (i + 0.5), pw * 0.88, Math.round(lh * (L.s || 0.66)), L.w || 700, L.mono ? MONO : FONT, L.c || o.fg || '#1b1610');
        });
      });
    }
    // табличка на ножке, повёрнутая к зрителю
    function sign(parent, x, z, y, w, hh, lines, o = {}) {
      const g = new T.Group(); at(g, x, 0, z, parent);
      if (o.post !== false) at(cyl(0.3, y - hh / 2 + 0.2, o.postCol ?? 0x5a6378, { edges: false, hull: false }), 0, (y - hh / 2 + 0.2) / 2, 0, g);
      const p = label(w, hh, lines, o); p.rotation.y = o.ry ?? AZ; at(p, 0, y, 0, g);
      const back = new T.Mesh(keep(new T.PlaneGeometry(w, hh)), basic(0x3a4256)); back.rotation.y = (o.ry ?? AZ) + Math.PI; at(back, 0, y, 0, g);
      back.position.x -= Math.sin(o.ry ?? AZ) * 0.05; back.position.z -= Math.cos(o.ry ?? AZ) * 0.05;
      return { g, p };
    }
    // табло с текстом, который меняется в onFrame (строки через \n)
    function screen(w, h, txt, fg = '#86e0a8', pw = 320) {
      let cur = null;
      const m = canvasPlane(w, h, pw);
      m.userData.set = (t, col = fg) => {
        t = String(t); if (cur === t + col) return; cur = t + col;
        m.userData.draw((x, W, Hh) => {
          x.fillStyle = '#0e1520'; x.fillRect(0, 0, W, Hh);
          const ls = t.split('\n'), lh = Hh / ls.length;
          ls.forEach((l, i) => fitText(x, l, W / 2, lh * (i + 0.5) + 2, W * 0.9, Math.round(lh * 0.62), 600, MONO, col));
        });
      };
      m.userData.set(txt); return m;
    }
    // клавиша пульта с надписью сверху; on — горит
    function key(parent, x, y, z, txt, color, k, w = 6, d = 4.4, on = false) {
      const b = new T.Group(); at(b, x, y, z, parent);
      at(box(w + 0.8, 0.8, d + 0.8, 0x1f2533), 0, 0.4, 0, b);
      at(box(w, 1.3, d, color, { matOpt: on ? { emissive: color, emissiveIntensity: 0.35 } : undefined }), 0, 1.3, 0, b);
      const top = canvasPlane(w * 0.92, d * 0.84, 192, (x, W, Hh) => {
        x.fillStyle = hexs(color); x.fillRect(0, 0, W, Hh);
        const ls = String(txt).split('\n'), lh = Hh / ls.length;
        ls.forEach((l, i) => fitText(x, l, W / 2, lh * (i + 0.5) + 2, W * 0.9, Math.round(lh * (ls.length > 1 ? 0.7 : 0.6)), 700, FONT, '#ffffff'));
      });
      top.rotation.x = -Math.PI / 2; at(top, 0, 1.97, 0, b);
      if (on) { const l = new T.Mesh(keep(new T.SphereGeometry(0.42, 10, 8)), basic(0x9dffb8)); at(l, w / 2 - 0.7, 2.1, -d / 2 + 0.7, b); }
      clickable(b, k); return b;
    }
    function ring(parent, x, y, z, r, color = 0xffd166, th = 0.45) {
      const m = new T.Mesh(keep(new T.TorusGeometry(r, th, 6, 44)), basic(color));
      m.rotation.x = Math.PI / 2; return at(m, x, y, z, parent);
    }
    // жидкость: цилиндр единичной высоты
    function liquid(parent, x, y0, z, r, color, opacity = 0.62, o = {}) {
      const mat = ownMat(color, { transparent: true, opacity, depthWrite: false, ...(o.emissive ? { emissive: color, emissiveIntensity: o.emissive } : {}) });
      const m = new T.Mesh(keep(new T.CylinderGeometry(r, r * 0.97, 1, o.seg || 40)), mat);
      at(m, x, y0, z, parent);
      const set = (hgt, yb = y0) => { m.visible = hgt > 0.05; m.scale.y = Math.max(0.05, hgt); m.position.y = yb + Math.max(0.05, hgt) / 2; };
      return { m, mat, set };
    }
    // клубы дыма/пара
    let puffT = null;
    function puffTex() {
      if (puffT) return puffT;
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
      const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.5, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 64, 64); puffT = keep(new T.CanvasTexture(c)); return puffT;
    }
    function smoke(parent, x, y, z, o = {}) {
      const n = o.n || 8, ps = [], g = new T.Group(); at(g, x, y, z, parent);
      for (let i = 0; i < n; i++) { const s = spr(puffTex(), o.color ?? 0xffffff, 0, false); g.add(s); ps.push({ s, ph: i / n, dx: (rnd(i + 3 + (o.seed || 0)) - 0.5) * (o.spread ?? 4), dz: (rnd(i + 9 + (o.seed || 0)) - 0.5) * (o.spread ?? 4) }); }
      const st = { amt: o.amt ?? 1, wind: o.wind ?? 0 };
      kit.onFrame((dt, t) => {
        for (const p of ps) {
          const ph = kit.reduce ? 0.15 + p.ph * 0.7 : (t * (o.speed || 0.25) + p.ph) % 1;
          p.s.position.set(p.dx * (0.5 + ph) + st.wind * ph, ph * (o.rise ?? 14), p.dz * (0.5 + ph) - st.wind * 0.3 * ph);
          p.s.scale.setScalar((o.size || 4) * (0.5 + ph * 1.6) * (0.7 + 0.3 * Math.min(2, st.amt)));
          p.s.material.opacity = Math.min(1, st.amt) * (o.op ?? 0.6) * Math.sin(Math.PI * Math.min(1, ph * 1.3));
        }
      });
      return { g, set(a) { st.amt = a; } };
    }
    // пламя
    function flameTex(inner, outer) {
      const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d');
      const drop = (s, col, blur) => {
        x.save(); x.translate(32, 122); x.scale(s, s); x.beginPath();
        x.moveTo(0, -114); x.bezierCurveTo(8, -84, 24, -52, 22, -26); x.bezierCurveTo(20, -6, 10, 0, 0, 0);
        x.bezierCurveTo(-10, 0, -20, -6, -22, -26); x.bezierCurveTo(-24, -52, -8, -84, 0, -114); x.closePath();
        x.shadowColor = col; x.shadowBlur = blur; x.fillStyle = col; x.fill(); x.restore();
      };
      drop(1, outer, 9); drop(0.55, inner, 6);
      const t = keep(new T.CanvasTexture(c)); t.colorSpace = T.SRGBColorSpace; return t;
    }
    function flame(parent, x, y, z, hgt, o = {}) {
      const g = new T.Group(); at(g, x, y, z, parent);
      const tex = flameTex(o.inner || '#fff3b0', o.outer || '#ff8a2a'), parts = [], sp = o.spread || 0;
      const offs = sp ? [[0, 0, 1], [-sp, sp * 0.4, 0.7], [sp, -sp * 0.3, 0.75], [sp * 0.3, sp * 0.8, 0.6]] : [[0, 0, 1]];
      offs.forEach(([dx, dz, k], i) => { const s = spr(tex, 0xffffff, 0.95, false); s.center.set(0.5, 0.04); s.scale.set(hgt * 0.5 * k, hgt * k, 1); at(s, dx, 0, dz, g); parts.push({ s, k, ph: i * 2.1 }); });
      at(glow(o.glow ?? 0xff7a2a, hgt * 2.2, 0.45), 0, hgt * 0.35, 0, g);
      if (o.light !== false) at(new T.PointLight(o.glow ?? 0xff7a2a, 30, 50, 1.3), 0, hgt * 0.5, 0, g);
      if (!kit.reduce) kit.onFrame((dt, t) => { for (const p of parts) { const f = 1 + 0.13 * Math.sin(t * 13 + p.ph) + 0.06 * Math.sin(t * 29 + p.ph * 3); p.s.scale.set(hgt * 0.5 * p.k, hgt * p.k * f, 1); } });
      return g;
    }
    // круглая шкала; стрелку можно двигать каждый кадр
    function dial(parent, x, y, z, r, unit, marks, frac, o = {}) {
      const g = new T.Group(); at(g, x, y, z, parent);
      const body = cyl(r, 1.6, o.body ?? 0xe8ecf4, { seg: 36 }); body.rotation.x = Math.PI / 2; at(body, 0, 0, 0, g);
      const rim = mesh(new T.TorusGeometry(r, 0.4, 8, 40), o.rim ?? C.BRASS, { edges: false, hull: true }); at(rim, 0, 0, 0.85, g);
      const c = document.createElement('canvas'); c.width = c.height = 256; const cx = c.getContext('2d');
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace;
      let cur = null;
      const set = f => {
        f = clamp(f, 0, 1); const k = Math.round(f * 400); if (k === cur) return; cur = k;
        cx.fillStyle = '#f7f3ea'; cx.fillRect(0, 0, 256, 256);
        const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
        if (o.zone) { cx.strokeStyle = 'rgba(47,191,90,.55)'; cx.lineWidth = 16; cx.beginPath(); cx.arc(128, 128, 92, a0 + (a1 - a0) * o.zone[0], a0 + (a1 - a0) * o.zone[1]); cx.stroke(); }
        cx.strokeStyle = '#1b1610'; cx.lineWidth = 4; cx.beginPath(); cx.arc(128, 128, 100, a0, a1); cx.stroke();
        marks.forEach(([mf, t]) => {
          const a = a0 + (a1 - a0) * mf; cx.lineWidth = 4; cx.beginPath(); cx.moveTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100); cx.lineTo(128 + Math.cos(a) * 82, 128 + Math.sin(a) * 82); cx.stroke();
          cx.fillStyle = '#1b1610'; cx.font = '600 24px "IBM Plex Mono", monospace'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(t, 128 + Math.cos(a) * 60, 128 + Math.sin(a) * 60);
        });
        for (let i = 0; i <= 20; i++) { const a = a0 + (a1 - a0) * i / 20; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100); cx.lineTo(128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92); cx.stroke(); }
        cx.fillStyle = '#1b1610'; cx.font = '700 30px "Golos Text", sans-serif'; cx.textAlign = 'center'; cx.fillText(unit, 128, 204);
        const a = a0 + (a1 - a0) * f;
        cx.strokeStyle = '#c0392b'; cx.lineWidth = 7; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(128, 128); cx.lineTo(128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92); cx.stroke();
        cx.fillStyle = '#1b1610'; cx.beginPath(); cx.arc(128, 128, 11, 0, 7); cx.fill();
        tex.needsUpdate = true;
      };
      set(frac);
      const face = new T.Mesh(keep(new T.PlaneGeometry(r * 1.8, r * 1.8)), keep(new T.MeshBasicMaterial({ map: tex }))); at(face, 0, 0, 0.82, g);
      return { g, set };
    }
    // труба по точкам: колена — шарики
    function pipe(parent, pts, r, color) {
      for (let i = 0; i < pts.length - 1; i++) rodAB(parent, pts[i], pts[i + 1], r, color, { hull: true });
      for (let i = 1; i < pts.length - 1; i++) at(ball(r * 1.18, color, { hull: false }), pts[i].x, pts[i].y, pts[i].z, parent);
    }
    // бегущие «порции» по трубе: видно, куда идёт поток
    function flow(parent, pts, color, n, o = {}) {
      const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + pts[i].distanceTo(pts[i - 1]));
      const tot = L[L.length - 1], geo = keep(new T.SphereGeometry(o.r || 0.95, 10, 8)), mat = basic(color);
      const bs = []; for (let i = 0; i < n; i++) { const m = new T.Mesh(geo, mat); parent.add(m); bs.push(m); }
      const st = { speed: o.speed ?? 8, on: o.on ?? true };
      const pos = (s, out) => { let i = 1; while (i < L.length - 1 && L[i] < s) i++; const k = (s - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]); return out.lerpVectors(pts[i - 1], pts[i], clamp(k, 0, 1)); };
      kit.onFrame((dt, t) => { bs.forEach((m, i) => { m.visible = st.on; if (!st.on) return; const s = kit.reduce ? (i + 0.5) * tot / n : (t * st.speed + i * tot / n) % tot; pos(s, m.position); }); });
      return { set(on, speed) { st.on = on; if (speed != null) st.speed = speed; }, mat };
    }
    // вертикальный аппарат: обечайка, купол сверху, ножки
    function vessel(parent, x, z, r, hh, color, o = {}) {
      const g = new T.Group(); at(g, x, 0, z, parent);
      const y0 = o.y0 ?? 3;
      if (y0 > 0.5) for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; at(cyl(0.55, y0, C.DARK, { edges: false }), Math.cos(a) * r * 0.7, y0 / 2, Math.sin(a) * r * 0.7, g); }
      at(cyl(r, hh, color, { seg: 32 }), 0, y0 + hh / 2, 0, g);
      const dome = mesh(new T.SphereGeometry(r, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2), color, { hull: true, edges: false }); dome.scale.y = o.domeK ?? 0.45; at(dome, 0, y0 + hh, 0, g);
      if (o.bottom !== false) { const bd = mesh(new T.SphereGeometry(r, 28, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), color, { hull: true, edges: false }); bd.scale.y = 0.3; at(bd, 0, y0, 0, g); }
      [0.02, 0.98].forEach(f => { const t = mesh(new T.TorusGeometry(r + 0.15, 0.32, 6, 36), C.DARK, { edges: false }); t.rotation.x = Math.PI / 2; at(t, 0, y0 + hh * f, 0, g); });
      return { g, top: y0 + hh + r * (o.domeK ?? 0.45), y0 };
    }
    return { v3, v2, glassMat, ownMat, basic, spr, glow, ball, hitBox, rodAB, canvasPlane, rr, fitText, label, sign, screen, key, ring, liquid, smoke, flame, dial, pipe, flow, vessel };
  }
  // цвет нагрева: тёмно-синий → оранжевый
  const heatCol = (T, Tc) => new T.Color(0x36507a).lerp(new T.Color(0xff7a2a), clamp((Tc - 300) / 400, 0, 1));

  // =====================================================================================
  // ===== «Аммиак и серная кислота»: колонна синтеза или контактный аппарат, компрессор, подогреватель,
  // ===== конденсатор или поглотительная башня, пульт с манометром и термометром, экран с графиком выхода =====
  SC['chin-rx'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, toon, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const nh3 = d.pl === 'nh3', PIPE = 0x9aa4b4, GAS_IN = 0x7fb8ff, PROD = nh3 ? 0xb88cf0 : 0xffb547;
    // память: плавные стрелки при смене режима
    const Pv = mem.rx && mem.rx.pl === d.pl ? mem.rx : null;
    let fromT = d.T, fromP = d.P, t0 = -9;
    if (Pv && (Pv.T !== d.T || Pv.P !== d.P)) { fromT = Pv.T; fromP = Pv.P; t0 = now(); }
    else if (Pv) { fromT = Pv.fromT; fromP = Pv.fromP; t0 = Pv.t0; }
    const R = mem.rx = { pl: d.pl, T: d.T, P: d.P, fromT, fromP, t0 };
    // макетная доска
    at(box(120, 2, 64, 0x8d97a6), 0, 1, -8, g);
    for (let k = -5; k <= 5; k++) at(box(0.25, 0.05, 64, 0x7a8494, { edges: false, shadow: false }), k * 11, 2.03, -8, g);
    const B = 2;

    // ---- сырьё: газгольдеры N₂ и H₂ или серная печь ----
    if (nh3) {
      [['N₂', -26, 0x6f9be0], ['H₂', -14, 0xe06f6f]].forEach(([f, z, col]) => {
        const t = h.vessel(g, -50, z, 4.2, 13, 0xdfe5ee, { y0: B + 2 });
        at(box(8.2, 2.6, 0.2, col, { edges: false }), -50 + Math.sin(AZ) * 4.3, B + 10, z + Math.cos(AZ) * 4.3, g).rotation.y = AZ;
        const lb = h.label(5.6, 2.6, [f], { bg: hexs(col), fg: '#fff', stroke: '#1b1610' }); lb.rotation.y = AZ; at(lb, -50 + Math.sin(AZ) * 4.45, B + 10, z + Math.cos(AZ) * 4.45, g);
        h.pipe(g, [v3(-46, B + 4, z), v3(-42, B + 4, z), v3(-42, B + 4, -6)], 0.7, PIPE);
      });
      h.pipe(g, [v3(-42, B + 4, -6), v3(-42, B + 4, -2), v3(-38.5, B + 4, -2)], 0.8, PIPE);
    } else {
      // печь: кирпичная кладка с окном, внутри горит сера
      const fx = -48, fz = -20;
      at(box(15, 12, 13, 0x9a4f3a), fx, B + 6, fz, g);
      for (let r = 0; r < 5; r++) at(box(15.1, 0.18, 13.1, 0x6e3527, { edges: false, shadow: false }), fx, B + 2 + r * 2.2, fz, g);
      at(box(7, 5, 0.6, 0x1b1610), fx + 1, B + 4.5, fz + 6.4, g);
      h.flame(g, fx + 1, B + 2.2, fz + 5.2, 4.6, { spread: 1.2 });
      at(cyl(1.6, 7, 0x6e3527), fx - 4, B + 15.5, fz - 3, g);
      // кучка серы
      for (let i = 0; i < 18; i++) at(h.ball(0.9 + rnd(i) * 0.5, 0xf2d43a, { hull: false }), fx + 3 + (rnd(i + 4) - 0.5) * 7, B + 0.6 + rnd(i + 8) * 1.2, fz + 10 + (rnd(i + 2) - 0.5) * 4, g);
      h.sign(g, fx - 5, fz + 10, 5.5, 9, 3.4, ['S + O₂ → SO₂', { t: 'печь', s: 0.5, w: 500 }], { post: true });
      h.pipe(g, [v3(fx + 7.5, B + 9, fz), v3(-42, B + 9, fz), v3(-42, B + 4, fz), v3(-42, B + 4, -2), v3(-38.5, B + 4, -2)], 0.8, PIPE);
    }

    // ---- компрессор: цилиндр, маховик крутится тем быстрее, чем выше давление ----
    const cpx = -33, cpz = -2;
    at(box(16, 2, 10, C.DARK), cpx, B + 1, cpz, g);
    const cylC = cyl(3.2, 10, 0x5f7fa8, { seg: 24 }); cylC.rotation.z = Math.PI / 2; at(cylC, cpx - 1, B + 5.5, cpz, g);
    for (let i = 0; i < 5; i++) { const f = cyl(3.7, 0.4, 0x4a6890, { edges: false, seg: 24 }); f.rotation.z = Math.PI / 2; at(f, cpx - 5 + i * 2, B + 5.5, cpz, g); }
    at(box(5, 5, 6, 0x3b4a66), cpx + 6, B + 4.5, cpz + 3, g);
    const fly = new T.Group(); at(fly, cpx + 6, B + 5.8, cpz - 3.4, g);
    const wheel = mesh(new T.TorusGeometry(3.4, 0.6, 8, 28), C.DARK, { edges: false, hull: true }); at(wheel, 0, 0, 0, fly);
    for (let k = 0; k < 4; k++) { const sp = box(6.4, 0.5, 0.5, 0x5a6378, { edges: false }); sp.rotation.z = k * Math.PI / 4; at(sp, 0, 0, 0, fly); }
    at(cyl(0.8, 1.6, C.STEEL, { edges: false }), 0, 0, 0, fly).rotation.x = Math.PI / 2;
    const spin = 1.5 + 5 * Math.log10(1 + d.P / d.Pmax * 9);
    if (!kit.reduce) kit.onFrame((dt, t) => { fly.rotation.z = -t * spin; });
    const cHit = h.hitBox(16, 10, 10); at(cHit, cpx, B + 5, cpz, g); clickable(cHit, 'p+');

    // ---- подогреватель: спираль светится по температуре ----
    const hx = -18, hz = -2;
    at(box(7, 14, 7, 0x4a5568), hx, B + 7, hz, g);
    at(box(5.4, 10, 0.3, 0x1b1610), hx + Math.sin(AZ) * 0.1, B + 7.5, hz + 3.55, g);
    const hc = heatCol(T, d.T);
    const coilPts = []; for (let k = 0; k <= 90; k++) { const a = k / 90 * Math.PI * 2 * 7; coilPts.push(v3(Math.cos(a) * 1.8, 3 + k / 90 * 9, Math.sin(a) * 1.8 * 0.4)); }
    const coil = new T.Mesh(keep(new T.TubeGeometry(new T.CatmullRomCurve3(coilPts), 240, 0.28, 6)), h.basic(hc)); at(coil, hx, B, hz + 3.2, g);
    at(h.glow(hc.getHex(), 12 * clamp((d.T - 250) / 450, 0.2, 1), 0.5), hx, B + 8, hz + 4.5, g);
    h.pipe(g, [v3(-27.5, B + 5.5, -2), v3(hx - 3.5, B + 5.5, hz)], 0.8, PIPE);

    // ---- колонна / контактный аппарат: стальная обечайка с окном, внутри слои катализатора ----
    const cx = 0, cz = -16, r = nh3 ? 7 : 9, ch = nh3 ? 44 : 34, y0 = B + 5;
    const col = new T.Group(); at(col, cx, 0, cz, g);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; at(cyl(0.7, y0 - B + 1, C.DARK, { edges: false }), Math.cos(a) * r * 0.75, B + (y0 - B) / 2, Math.sin(a) * r * 0.75, col); }
    const gap = 1.5, shellMat = h.ownMat(0xb8c0cc, { side: T.DoubleSide });
    at(new T.Mesh(keep(new T.CylinderGeometry(r, r, ch, 40, 1, true, AZ + gap / 2, Math.PI * 2 - gap)), shellMat), 0, y0 + ch / 2, 0, col);
    const inner = new T.Mesh(keep(new T.CylinderGeometry(r - 0.4, r - 0.4, ch, 40, 1, true, AZ + gap / 2 + 0.2, Math.PI * 2 - gap - 0.4)), h.basic(heatCol(T, d.T).multiplyScalar(0.55), { side: T.BackSide }));
    at(inner, 0, y0 + ch / 2, 0, col);
    at(new T.Mesh(keep(new T.CylinderGeometry(r + 0.05, r + 0.05, ch, 24, 1, true, AZ - gap / 2, gap)), h.glassMat(0xd8eef8, 0.16)), 0, y0 + ch / 2, 0, col);
    const top = mesh(new T.SphereGeometry(r, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0xb8c0cc, { hull: true, edges: false }); top.scale.y = 0.4; at(top, 0, y0 + ch, 0, col);
    const bot = mesh(new T.SphereGeometry(r, 32, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0xb8c0cc, { hull: true, edges: false }); bot.scale.y = 0.25; at(bot, 0, y0, 0, col);
    [0, 0.5, 1].forEach(f => { const t = mesh(new T.TorusGeometry(r + 0.2, 0.45, 6, 40), 0x7d8697, { edges: false }); t.rotation.x = Math.PI / 2; at(t, 0, y0 + ch * f, 0, col); });
    // слои катализатора
    const nb = nh3 ? 3 : 4, catCol = nh3 ? 0x6d6f7a : 0xc88a2e;
    for (let i = 0; i < nb; i++) {
      const by = y0 + ch * (0.16 + i * (0.72 / (nb - 1))) - 2;
      const grid = new T.Mesh(keep(new T.CylinderGeometry(r - 0.5, r - 0.5, 0.35, 32)), h.ownMat(0x3a4256)); at(grid, 0, by, 0, col);
      if (d.cat) {
        at(cyl(r - 0.6, 3, catCol, { edges: false, hull: false }), 0, by + 1.7, 0, col);
        for (let k = 0; k < 14; k++) { const a = rnd(k + i * 20) * Math.PI * 2, rr = Math.sqrt(rnd(k + i * 20 + 7)) * (r - 1.6); at(h.ball(0.55, nh3 ? 0x8a8c96 : 0xe0a040, { hull: false, shadow: false }), Math.cos(a) * rr, by + 3.2, Math.sin(a) * rr, col); }
      }
    }
    // молекулы поднимаются: голубые — исходные газы, цветные — продукт
    const NM = 30, share = clamp(d.out / 100, 0, 1), mg = keep(new T.SphereGeometry(0.62, 10, 8)), mA = h.basic(GAS_IN), mP = h.basic(PROD);
    const mols = []; for (let i = 0; i < NM; i++) { const m = new T.Mesh(mg, mA); col.add(m); mols.push({ m, a: rnd(i + 5) * Math.PI * 2, rr: Math.sqrt(rnd(i + 15)) * (r - 1.4), ph: rnd(i + 25) }); }
    const vRise = (18 + d.T / 25) / 228 * 0.8;
    kit.onFrame((dt, t) => {
      mols.forEach((q, i) => {
        const ph = kit.reduce ? q.ph : (t * vRise + q.ph) % 1, y = y0 + 1 + ph * (ch - 2);
        q.m.position.set(Math.cos(q.a + ph * 2) * q.rr, y, Math.sin(q.a + ph * 2) * q.rr);
        const isP = ((i * 0.618) % 1) < share * clamp(ph * 1.6, 0, 1); q.m.material = isP ? mP : mA; q.m.scale.setScalar(isP ? 1.25 : 1);
      });
    });
    const colHit = h.hitBox(r * 2, ch, r * 2); at(colHit, 0, y0 + ch / 2, 0, col); clickable(colHit, 'cat');
    h.pipe(g, [v3(hx, B + 14, hz), v3(hx, B + 16, hz), v3(-10, B + 16, hz), v3(-10, y0 + 3, cz), v3(-r + 0.2, y0 + 3, cz)], 0.8, PIPE);
    const topY = y0 + ch + r * 0.4;
    // лоток с катализатором (когда его вынули из колонны)
    const tx = 13, tz = 2;
    at(box(10, 1, 7, 0x5a6378), tx, B + 0.5, tz, g);
    [[-4.6, 0, 0.8, 7], [4.6, 0, 0.8, 7], [0, -3.1, 10, 0.8], [0, 3.1, 10, 0.8]].forEach(([dx, dz, w, dd]) => at(box(w, 1.4, dd, 0x5a6378), tx + dx, B + 1.4, tz + dz, g));
    if (!d.cat) for (let k = 0; k < 26; k++) at(h.ball(0.6, nh3 ? 0x8a8c96 : 0xe0a040, { hull: false }), tx + (rnd(k + 40) - 0.5) * 8, B + 1.6 + rnd(k + 41) * 0.6, tz + (rnd(k + 42) - 0.5) * 5, g);
    const trayHit = h.hitBox(11, 4, 8); at(trayHit, tx, B + 2, tz, g); clickable(trayHit, 'cat');

    // ---- после колонны: конденсатор с жидким NH₃ или поглотительная башня ----
    const sx = 27, sz = -12;
    let sepTop;
    if (nh3) {
      const sv = h.vessel(g, sx, sz, 5, 22, 0xc9d1dc, { y0: B + 3 }); sepTop = sv.top;
      // охлаждающая рубашка: синие витки
      const cp = []; for (let k = 0; k <= 120; k++) { const a = k / 120 * Math.PI * 2 * 6; cp.push(v3(Math.cos(a) * 5.5, B + 8 + k / 120 * 14, Math.sin(a) * 5.5)); }
      at(new T.Mesh(keep(new T.TubeGeometry(new T.CatmullRomCurve3(cp), 300, 0.35, 6)), h.ownMat(0x4f9fe0)), sx, 0, sz, g);
      // смотровое стекло и уровень жидкого аммиака
      const lv = clamp(d.out / 40, 0, 1);
      const wx = sx + Math.sin(AZ) * 5.3, wz = sz + Math.cos(AZ) * 5.3;
      at(box(3, 16, 0.6, 0x2a3142), wx, B + 13, wz, g).rotation.y = AZ;
      const win = at(box(2, 14.5, 0.4, 0xd8eef8, { edges: false, matOpt: { transparent: true, opacity: 0.35 } }), wx + Math.sin(AZ) * 0.2, B + 13, wz + Math.cos(AZ) * 0.2, g); win.rotation.y = AZ;
      if (lv > 0.02) { const lq = at(box(1.8, 14 * lv, 0.45, PROD, { edges: false, matOpt: { emissive: PROD, emissiveIntensity: 0.25 } }), wx + Math.sin(AZ) * 0.3, B + 6 + 7 * lv, wz + Math.cos(AZ) * 0.3, g); lq.rotation.y = AZ; }
      // кран и сборник
      h.pipe(g, [v3(sx, B + 3, sz), v3(sx, B + 1.6, sz), v3(sx + 8, B + 1.6, sz), v3(sx + 8, B + 6, sz)], 0.6, PIPE);
      h.vessel(g, sx + 8, sz + 7, 3, 6, 0xeef2f7, { y0: 2.2, domeK: 0.3 });
      h.pipe(g, [v3(sx + 8, B + 6, sz), v3(sx + 8, B + 10, sz), v3(sx + 8, B + 10, sz + 7)], 0.5, PIPE);
      // возврат непрореагировавшего газа к компрессору
      const back = [v3(sx - 5.2, B + 22, sz), v3(sx - 9, B + 22, sz), v3(sx - 9, B + 1.2, sz + 14), v3(-38, B + 1.2, sz + 14), v3(-38, B + 1.2, -2), v3(-38, B + 3.4, -2)];
      h.pipe(g, back, 0.6, 0x6fb6c8);
      h.flow(g, back, 0x9fe8ff, 10, { r: 0.7, speed: 6 });
      tag(v3(sx, sepTop + 3, sz), 'Конденсатор', 'NH₃ (ж) · кипит при −33 °C');
    } else {
      const sv = h.vessel(g, sx, sz, 5.5, 30, 0xc9d1dc, { y0: B + 3 }); sepTop = sv.top;
      const acid = d.abs === 'acid';
      const wx = sx + Math.sin(AZ) * 5.8, wz = sz + Math.cos(AZ) * 5.8;
      at(box(3.4, 20, 0.6, 0x2a3142), wx, B + 16, wz, g).rotation.y = AZ;
      const win = at(box(2.4, 18.5, 0.4, 0xd8eef8, { edges: false, matOpt: { transparent: true, opacity: 0.3 } }), wx + Math.sin(AZ) * 0.2, B + 16, wz + Math.cos(AZ) * 0.2, g); win.rotation.y = AZ;
      // насадка (кольца) и жидкость: кислота льётся сверху, вода — бурлит
      for (let k = 0; k < 9; k++) { const t = mesh(new T.TorusGeometry(0.55, 0.2, 6, 12), 0xd9c9a8, { edges: false }); t.rotation.set(rnd(k) * 3, rnd(k + 1) * 3, 0); at(t, wx + Math.sin(AZ) * 0.5 + (rnd(k + 3) - 0.5) * 1.6 * Math.cos(AZ), B + 16 + (rnd(k + 5) - 0.3) * 12, wz + Math.cos(AZ) * 0.5 - (rnd(k + 3) - 0.5) * 1.6 * Math.sin(AZ), g); }
      const lqc = acid ? 0xe6c63a : 0x5fb4d9;
      const lq = at(box(2.2, 6, 0.45, lqc, { edges: false, matOpt: { emissive: lqc, emissiveIntensity: 0.2 } }), wx + Math.sin(AZ) * 0.3, B + 10, wz + Math.cos(AZ) * 0.3, g); lq.rotation.y = AZ;
      // хвостовая труба: при воде — белый кислотный туман
      at(cyl(1.2, 10, 0x9aa4b4), sx, sepTop + 4, sz, g);
      const mist = h.smoke(g, sx, sepTop + 9, sz, { n: 10, size: 5, rise: 16, spread: 4, op: 0.75, amt: acid ? 0.12 : 1.3, color: 0xf4f6f8 });
      // бак олеума/кислоты
      h.vessel(g, sx + 9, sz + 8, 3.2, 7, acid ? 0xd9c26a : 0x9fc3df, { y0: 2.2, domeK: 0.3 });
      h.pipe(g, [v3(sx, B + 3, sz), v3(sx, B + 1.6, sz), v3(sx + 9, B + 1.6, sz), v3(sx + 9, B + 1.6, sz + 8)], 0.6, PIPE);
      const tHit = h.hitBox(12, 32, 12); at(tHit, sx, B + 18, sz, g); clickable(tHit, 'abs');
      tag(v3(sx, sepTop + 15, sz), 'Поглотитель', acid ? '98 % H₂SO₄ → олеум' : 'вода: кислотный туман!', !acid);
    }
    const outPts = [v3(cx, y0 + ch + r * 0.4 - 0.5, cz), v3(cx, topY + 3, cz), v3(sx, topY + 3, cz), v3(sx, topY + 3, sz), v3(sx, sepTop - 0.5, sz)];
    h.pipe(g, outPts, 0.8, PIPE);
    // поток газа: в колонну — голубой, из колонны — цвет продукта
    const inPts = [v3(-38.5, B + 4, -2), v3(-27.5, B + 5.5, -2), v3(hx - 3.5, B + 5.5, hz), v3(hx, B + 16, hz), v3(-10, B + 16, hz), v3(-10, y0 + 3, cz), v3(-r + 0.2, y0 + 3, cz)];
    const fspeed = 4 + 6 * Math.log10(1 + d.P / d.Pmax * 9);
    h.flow(g, inPts, GAS_IN, 12, { r: 0.95, speed: fspeed });
    h.flow(g, outPts, d.out > 2 ? PROD : GAS_IN, 12, { r: 0.95, speed: fspeed });

    // ---- пульт: манометр, термометр, табло, клавиши ----
    const pz = 30, px = -4;
    at(box(70, 6, 13, 0x3b4a66), px, 3, pz, g);
    at(box(70, 12, 3, 0x334058), px, 11.5, pz - 5, g);
    at(box(71, 0.8, 14, 0x2a3142), px, 6.4, pz, g);
    const lerp = (a, b, k) => a + (b - a) * k;
    const pMan = h.dial(g, px - 26, 11.5, pz - 3.4, 4.6, 'атм', nh3 ? [[0, '0'], [0.3, '300'], [0.6, '600'], [1, '1000']] : [[0, '0'], [0.5, '5'], [1, '10']], R.fromP / d.Pmax, { zone: nh3 ? [0, 0.3] : null });
    const tMan = h.dial(g, px - 14, 11.5, pz - 3.4, 4.6, '°C', [[0, '300'], [0.25, '400'], [0.5, '500'], [0.75, '600'], [1, '700']], (R.fromT - 300) / 400);
    kit.onFrame(() => { const k = kit.reduce ? 1 : ease(clamp((now() - R.t0) / 0.8, 0, 1)); pMan.set(lerp(R.fromP, d.P, k) / d.Pmax); tMan.set((lerp(R.fromT, d.T, k) - 300) / 400); });
    const scr = h.screen(19, 8.5, `${nh3 ? 'NH₃' : 'SO₃'} на выходе\n${fmt(d.out, 1)} %\nцель ${d.goal} %`, d.ok ? '#86e0a8' : '#ffb547', 360);
    at(scr, px + 4, 11.5, pz - 3.42, g);
    const ky = 6.8, kz = pz + 2.5;
    h.key(g, px - 30, ky, kz, 'NH₃', 0x3d7bd9, 'pl-nh3', 5.4, 4.4, nh3);
    h.key(g, px - 23.6, ky, kz, 'SO₃', 0xc98a2e, 'pl-so3', 5.4, 4.4, !nh3);
    h.key(g, px - 14, ky, kz, '−10 °C', 0x4f6fa8, 't-', 6);
    h.key(g, px - 7, ky, kz, '+10 °C', 0xd0603a, 't+', 6);
    h.key(g, px + 2.5, ky, kz, '−P', 0x4f6fa8, 'p-', 5);
    h.key(g, px + 8.5, ky, kz, '+P', 0xd0603a, 'p+', 5);
    h.key(g, px + 18, ky, kz, 'катали-\nзатор', 0x5a8a5a, 'cat', 7, 4.4, d.cat);
    if (!nh3) h.key(g, px + 26.5, ky, kz, 'поглоти-\nтель', 0x8a7a3a, 'abs', 7, 4.4, d.abs === 'acid');
    // отметки «режим найден»
    [['NH₃', d.okN, px + 18], ['SO₃', d.okS, px + 26]].forEach(([s, ok, x]) => {
      const lb = h.label(7, 2.4, [(ok ? '✓ ' : '· ') + s], { bg: ok ? '#d9f5e2' : '#e8ecf4', fg: ok ? '#1d7a3e' : '#6a7488', stroke: '#1b1610' });
      at(lb, x, 13.5, pz - 3.45, g);
    });

    // ---- экран оператора: график выхода от температуры ----
    const sg = new T.Group(); at(sg, 47, 0, -22, g); sg.rotation.y = -0.35;
    at(box(3, 1, 6, C.DARK), 0, B + 0.5, 0, sg);
    at(cyl(0.6, 12, C.DARK, { edges: false }), 0, B + 6, 0, sg);
    at(box(32, 22, 1.4, 0x1f2533), 0, B + 22, 0, sg);
    const plot = h.canvasPlane(30, 20, 600, (x, W, Hh) => {
      x.fillStyle = '#0e1520'; x.fillRect(0, 0, W, Hh);
      const x0 = 70, x1 = W - 22, py0 = Hh - 56, py1 = 46;
      const X = Tc => x0 + (Tc - 300) / 400 * (x1 - x0), Y = v => py0 - v / 100 * (py0 - py1);
      x.lineWidth = 1.5; x.strokeStyle = '#26324a'; x.font = `500 18px ${MONO}`; x.fillStyle = '#8b96ad'; x.textAlign = 'right'; x.textBaseline = 'middle';
      for (let v = 0; v <= 100; v += 25) { x.beginPath(); x.moveTo(x0, Y(v)); x.lineTo(x1, Y(v)); x.stroke(); x.fillText(String(v), x0 - 8, Y(v)); }
      x.textAlign = 'center'; x.textBaseline = 'top';
      for (let Tc = 300; Tc <= 700; Tc += 100) x.fillText(String(Tc), X(Tc), py0 + 8);
      x.fillText('температура, °C', (x0 + x1) / 2, py0 + 30);
      h.fitText(x, nh3 ? 'Выход NH₃, %' : 'Превращение SO₂, %', W / 2, 22, W * 0.9, 24, 700, FONT, '#e8ecf4');
      x.setLineDash([10, 7]); x.strokeStyle = '#86e0a8'; x.lineWidth = 2; x.beginPath(); x.moveTo(x0, Y(d.goal)); x.lineTo(x1, Y(d.goal)); x.stroke();
      x.fillStyle = '#86e0a8'; x.textAlign = 'right'; x.textBaseline = 'bottom'; x.fillText('цель ' + d.goal + ' %', x1, Y(d.goal) - 4);
      const curve = (j, col, w, dash) => { x.setLineDash(dash); x.strokeStyle = col; x.lineWidth = w; x.beginPath(); d.curve.forEach((p, i) => { const px2 = X(300 + i * 20), py2 = Y(p[j]); i ? x.lineTo(px2, py2) : x.moveTo(px2, py2); }); x.stroke(); };
      curve(0, '#72d4e8', 3, [10, 7]); curve(1, '#ffb547', 4.5, []);
      x.setLineDash([]);
      x.fillStyle = '#72d4e8'; x.textAlign = 'left'; x.textBaseline = 'top'; x.font = `500 17px ${FONT}`; x.fillText('- - равновесие', x0 + 6, py1 - 8);
      x.fillStyle = '#ffb547'; x.fillText('— на выходе', x0 + 150, py1 - 8);
      x.beginPath(); x.arc(X(d.T), Y(d.out), 11, 0, 7); x.fillStyle = d.ok ? '#86e0a8' : '#ffb547'; x.fill(); x.lineWidth = 3; x.strokeStyle = '#04070d'; x.stroke();
    });
    at(plot, 0, B + 22, 0.75, sg);

    // ---- подписи ----
    tag(v3(cx, topY + 6, cz), nh3 ? 'Колонна синтеза' : 'Контактный аппарат', `${fmt(d.out, 1)} % · равновесие ${fmt(d.xeq, 1)} %`, d.ok);
    tag(v3(px - 26, 17, pz - 4), 'Манометр', `${d.P} атм`);
    tag(v3(px - 12, 17, pz - 4), 'Термометр', `${d.T} °C`);
    tag(v3(tx, B + 5, tz), 'Катализатор', d.cat ? (nh3 ? 'Fe — в колонне' : 'V₂O₅ — в аппарате') : 'на лотке, не загружен', !d.cat);
  };
})();
