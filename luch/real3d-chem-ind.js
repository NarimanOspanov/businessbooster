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
    const sg = new T.Group(); at(sg, 47, 0, -22, g); sg.rotation.y = 0.3;
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
    tag(v3(px - 20, 17.5, pz - 4), 'Манометр · термометр', `${d.P} атм · ${d.T} °C`);
    tag(v3(tx, B + 5, tz), 'Катализатор', d.cat ? (nh3 ? 'Fe — в колонне' : 'V₂O₅ — в аппарате') : 'на лотке, не загружен', !d.cat);
  };

  // =====================================================================================
  // ===== «Металлургия Казахстана»: карта-рельеф с флажками городов, слитки металлов, макет цеха выбранного металла =====
  SC['chin-metal'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, toon, C } = kit, h = H(kit), v3 = h.v3, v2 = h.v2;
    const g = new T.Group(); at(g, 0, 0, 10);
    const mx = lon => -62 + (lon - 46.6) * 1.95, mz = lat => -42 + (55.4 - lat) * 2.7;
    const MT = s => d.metals.find(x => x.s === s);
    const cityName = id => (d.cities.find(c => c.id === id) || {}).name || '';
    // ---- карта ----
    at(box(87, 3, 49, C.WOOD2), -22.5, 1.5, -20.5, g);
    const water = 0x4f9fd8, TOP = 4.6;
    const sea = new T.Shape(); [[46.7, 46.5], [48.6, 46.6], [49.1, 46.4], [51.2, 47.0], [53.2, 46.2], [53.0, 45.3], [51.0, 45.0], [51.3, 44.5], [50.3, 44.4], [51.3, 43.2], [52.8, 42.9], [52.4, 41.7], [52.2, 40.6], [46.7, 40.6]]
      .forEach(([lo, la], i) => i ? sea.lineTo(mx(lo), -mz(la)) : sea.moveTo(mx(lo), -mz(la)));
    const seaM = mesh(new T.ExtrudeGeometry(sea, { depth: 0.3, bevelEnabled: false }), water, { edges: false }); seaM.rotation.x = -Math.PI / 2; at(seaM, 0, 3, 0, g);
    const shape = new T.Shape(); d.kz.forEach(([lo, la], i) => i ? shape.lineTo(mx(lo), -mz(la)) : shape.moveTo(mx(lo), -mz(la)));
    const land = mesh(new T.ExtrudeGeometry(shape, { depth: 1.6, bevelEnabled: false }), 0xd8c58a, { edges: true, edgeAngle: 60 }); land.rotation.x = -Math.PI / 2; at(land, 0, 3, 0, g);
    // горы на юго-востоке и востоке
    [[78.5, 43.4, 3.2], [80.2, 43.2, 2.6], [76.6, 43.5, 2.4], [84.5, 49.4, 3], [86, 49.2, 2.4], [82.8, 49.0, 2]].forEach(([lo, la, s], i) => {
      at(cyl(s * 0.9, s * 1.3, 0x9a8a6a, { r2: 0.1, seg: 7 }), mx(lo), TOP + s * 0.65, mz(la), g);
      at(cyl(s * 0.32, s * 0.45, 0xf4f6f8, { r2: 0.05, seg: 7, edges: false }), mx(lo), TOP + s * 1.3 - s * 0.22, mz(la), g);
    });
    // озеро Балхаш и Иртыш
    const lake = mesh(new T.CylinderGeometry(1, 1, 0.3, 28), water, { edges: false }); lake.scale.set(6.5, 1, 1.2); lake.rotation.y = 0.22; at(lake, mx(76), TOP + 0.05, mz(46.3), g);
    const irt = [[86.2, 47.6], [84, 48.6], [82.6, 49.95], [80.2, 50.4], [78.5, 51.4], [76.95, 52.29], [75.5, 53.3], [74.5, 54.1], [73.6, 54.9]].map(([lo, la]) => v3(mx(lo), TOP + 0.15, mz(la)));
    at(new T.Mesh(keep(new T.TubeGeometry(new T.CatmullRomCurve3(irt), 60, 0.4, 6)), h.ownMat(water)), 0, 0, 0, g);
    h.sign(g, -60, -2.5, 6.2, 8, 2, [{ t: 'Каспий', w: 500 }], { bg: '#dcecf8' });
    // ---- города: флажок, табличка, мини-завод у верно размещённого металла ----
    const OFF = { ast: [-4.6, -2.6], tem: [3.6, 2.6], pav: [3.4, -2.6], bal: [-3.5, 2.6], jez: [0, 3.2], ukg: [1, 3.2], akt: [0, 3.2], atr: [0, 3.2], alm: [0, 3.2] };
    const sel = d.sel && !d.mp[d.sel] ? d.sel : null;
    d.cities.forEach(c => {
      const x = mx(c.lon), z = mz(c.lat), on = Object.keys(d.mp).filter(s => d.mp[s] === c.id);
      const pg = new T.Group(); at(pg, x, TOP, z, g);
      at(cyl(0.28, 4.4, 0x3a4256, { edges: false, hull: false }), 0, 2.2, 0, pg);
      const fl = box(2.4, 1.5, 0.15, on.length ? 0x2fbf5a : sel ? 0xffb547 : 0xe8ecf4, { edges: true }); fl.rotation.y = AZ; at(fl, Math.sin(AZ + Math.PI / 2) * 1.2, 3.7, Math.cos(AZ + Math.PI / 2) * 1.2, pg);
      at(h.ball(0.55, 0x1b1610, { hull: false }), 0, 0.2, 0, pg);
      const hit = h.hitBox(5, 7, 5); at(hit, 0, 3, 0, pg); clickable(hit, 'city-' + c.id);
      const o = OFF[c.id] || [0, 3];
      h.sign(g, x + o[0] * 1.15, z + o[1] * 1.1, TOP + 2.4, 10.5, 2.4, [{ t: c.name, w: 600 }], { post: false, bg: on.length ? '#d9f5e2' : '#fffaf0' });
      on.forEach((s, i) => {
        const M = MT(s), fx = x - 2.8 - i * 3.6, fz = z + 0.6;
        at(box(2.8, 2, 2.2, 0x6b7690), fx, TOP + 1, fz, g);
        at(cyl(0.35, 4, 0x8a5a48, { edges: false }), fx + 0.8, TOP + 2, fz - 0.6, g);
        at(box(1.8, 0.8, 1, M.c, { matOpt: { emissive: M.c, emissiveIntensity: 0.2 } }), fx, TOP + 2.4, fz + 0.2, g);
        h.smoke(g, fx + 0.8, TOP + 4.2, fz - 0.6, { n: 4, size: 1.6, rise: 5, spread: 1, op: 0.45, speed: 0.3, seed: i + x });
      });
    });
    // ---- слитки-карточки металлов ----
    d.metals.forEach((M, i) => {
      const x = -54 + i * 13.5, z = 12, placed = !!d.mp[M.s], isSel = d.sel === M.s;
      const sg = new T.Group(); at(sg, x, 0, z, g);
      at(box(11.5, 1.2, 9, isSel ? 0xfff4dc : 0xe8ecf4), 0, 0.6, 0, sg);
      const ing = mesh(new T.CylinderGeometry(1.8, 2.5, 2.1, 4), M.c, { edges: true, matOpt: { emissive: M.c, emissiveIntensity: 0.12 } });
      ing.rotation.y = Math.PI / 4; ing.scale.set(1.5, 1, 1); at(ing, 0, 2.25, -1.4, sg);
      if (isSel && !kit.reduce) kit.onFrame((dt, t) => { ing.position.y = 3.6 + 0.6 * Math.sin(t * 3); });
      if (isSel) h.ring(sg, 0, 1.3, -1.4, 4.4);
      const pl = h.label(10.4, 3.6, [{ t: `${M.s} · ${M.name.split(' ')[0]}`, s: 0.7 }, { t: placed ? '✓ ' + cityName(d.mp[M.s]) : 'руда ' + M.ore, s: 0.62, w: 500, c: placed ? '#1d7a3e' : '#4a556c' }], { bg: placed ? '#d9f5e2' : '#fffaf0' });
      pl.rotation.x = -0.75; at(pl, 0, 2.2, 2.8, sg);
      const hit = h.hitBox(11.5, 6, 9); at(hit, 0, 3, 0, sg); clickable(hit, 'mc-' + M.s);
    });
    // ---- макет цеха выбранного металла ----
    const S0 = d.sel || 'Fe', M0 = MT(S0), placed0 = d.mp[S0];
    at(box(38, 2, 52, 0x8d97a6), 44, 1, -12, g);
    const B = 2, gr = new T.Group(); at(gr, 0, 0, 0, g);
    const lbl = (x, z, y, txt) => h.sign(gr, x, z, y, 12, 2.6, [{ t: txt, w: 600 }], { bg: '#fffaf0' });
    const molten = (x, y, z, r) => { at(cyl(r, 0.35, 0xff8a2a, { edges: false, hull: false, matOpt: { emissive: 0xff6a1a, emissiveIntensity: 0.9 } }), x, y, z, gr); at(h.glow(0xff8a3a, r * 4, 0.55), x, y + 1, z, gr); };
    const ladle = (x, z, s = 1) => {
      const pts = [v2(0, 0), v2(3 * s, 0), v2(3.7 * s, 5 * s), v2(4.1 * s, 5.4 * s), v2(3.9 * s, 5.6 * s)];
      at(mesh(new T.LatheGeometry(pts, 24), 0x3a4256, { edges: false, hull: true, matOpt: { side: T.DoubleSide } }), x, B + 1.2, z, gr);
      at(box(8 * s, 1.2, 6 * s, C.DARK), x, B + 0.6, z, gr);
      molten(x, B + 1.2 + 4.8 * s, z, 3.5 * s);
    };
    const bath = (x, z, w, dd, sol, plates) => {
      at(box(w, 4, dd, 0x4a5568), x, B + 2, z, gr);
      at(box(w - 1, 0.3, dd - 1, sol, { edges: false, matOpt: { transparent: true, opacity: 0.85, emissive: sol, emissiveIntensity: 0.15 } }), x, B + 3.7, z, gr);
      [-1, 1].forEach(k => { const b = cyl(0.35, w, 0xd8894e, { edges: false }); b.rotation.z = Math.PI / 2; at(b, x, B + 6.2, z + k * (dd / 2 - 0.6), gr); });
      for (let i = 0; i < plates.n; i++) { const an = i % 2 === 0; at(box(an ? 0.5 : 0.25, 4.8, dd - 1.8, an ? plates.a : plates.c, { edges: true }), x - w / 2 + 1.4 + i * (w - 2.8) / (plates.n - 1), B + 4, z, gr); }
    };
    const stack = (x, z, col, n = 3) => { for (let l = 0; l < n; l++) for (let k = 0; k < 3; k++) { const b = box(l % 2 ? 1.8 : 5, 1, l % 2 ? 5 : 1.8, col, { matOpt: { emissive: col, emissiveIntensity: 0.1 } }); at(b, x + (l % 2 ? (k - 1) * 1.9 : 0), B + 0.5 + l, z + (l % 2 ? 0 : (k - 1) * 1.9), gr); } };
    const acidTower = (x, z) => { const t = h.vessel(gr, x, z, 3.2, 18, 0xc9d1dc, { y0: B + 2 }); lbl(x, z + 5, 6, 'SO₂ → H₂SO₄'); return t; };
    let mainTop = 20, mainAt = v3(40, 0, -24), proc = '';
    if (S0 === 'Fe') {
      proc = 'Доменный цех и сталь';
      const pts = [v2(0, 0), v2(6, 0), v2(6, 4), v2(7.2, 11), v2(6.2, 22), v2(3.8, 31), v2(3.8, 33), v2(0, 33)];
      const fx = 36, fz = -26;
      at(mesh(new T.LatheGeometry(pts, 32), 0x8a5a48, { edges: false, hull: true }), fx, B, fz, gr);
      [[4, 6.3], [11, 7.5], [18, 6.9], [26, 5.2]].forEach(([y, r]) => { const t = mesh(new T.TorusGeometry(r, 0.35, 6, 36), 0x3a4256, { edges: false }); t.rotation.x = Math.PI / 2; at(t, fx, B + y, fz, gr); });
      at(cyl(2.4, 3, C.DARK, { r2: 3.4 }), fx, B + 34.5, fz, gr);
      [-1, 1].forEach(k => h.pipe(gr, [v3(fx + k * 2.4, B + 33, fz), v3(fx + k * 2.4, B + 39, fz), v3(fx + k * 5, B + 39, fz)], 0.7, 0x7d8697));
      const bus = mesh(new T.TorusGeometry(8.6, 0.8, 8, 36), 0x7d8697, { edges: false }); bus.rotation.x = Math.PI / 2; at(bus, fx, B + 8, fz, gr);
      // воздухонагреватели
      [[55, -34], [60, -27]].forEach(([x, z]) => h.vessel(gr, x, z, 2.8, 18, 0xa8a090, { y0: B, bottom: false, domeK: 0.8 }));
      h.pipe(gr, [v3(55, B + 14, -34), v3(46, B + 14, -32), v3(fx + 6, B + 8, fz - 4)], 0.8, 0x7d8697);
      // наклонный мост и скип с шихтой
      const a0 = v3(50, B, -14), a1 = v3(fx + 2, B + 35, fz + 1);
      [-1, 1].forEach(k => h.rodAB(gr, v3(a0.x + k * 0.8, a0.y, a0.z + k * 1.2), v3(a1.x + k * 0.8, a1.y, a1.z + k * 1.2), 0.3, C.DARK));
      for (let i = 1; i < 6; i++) { const p = a0.clone().lerp(a1, i / 6); at(cyl(0.25, p.y - B, C.DARK, { edges: false }), p.x, B + (p.y - B) / 2, p.z, gr); }
      const skip = new T.Group(); gr.add(skip);
      at(box(3, 2, 2.8, 0x3a4256), 0, 0.8, 0, skip);
      for (let i = 0; i < 6; i++) at(h.ball(0.5, [0x2a2a2a, 0x9a5a3a, 0xe8e2d0][i % 3], { hull: false, shadow: false }), (rnd(i) - 0.5) * 2, 1.9, (rnd(i + 3) - 0.5) * 2, skip);
      kit.onFrame((dt, t) => { const ph = kit.reduce ? 0.4 : (t * 0.12) % 1, k = ph < 0.55 ? ease(ph / 0.55) : 1 - ease((ph - 0.55) / 0.45); skip.position.lerpVectors(a0, a1, k * 0.94); skip.position.y += 0.6; });
      lbl(44, -18.5, 6, 'шихта: руда, кокс, известняк');
      // лётка → желоб → ковш
      const tp = v3(fx + Math.sin(AZ) * 6.3, B + 2.4, fz + Math.cos(AZ) * 6.3);
      h.rodAB(gr, tp, v3(41.5, B + 6.6, -12.5), 0.55, 0xff8a2a, { matOpt: { emissive: 0xff6a1a, emissiveIntensity: 0.9 }, hull: false });
      ladle(42, -11);
      lbl(34, -7, 5, 'ковш: чугун 1450 °C');
      // конвертер: качается, из горловины искры
      const cv = new T.Group(); at(cv, 55, B + 8, -8, gr);
      [-1, 1].forEach(k => { at(box(1.4, 8, 2, 0x3a4256), 55 + k * 6, B + 4, -8, gr); });
      const cvb = new T.Group(); cv.add(cvb);
      at(mesh(new T.LatheGeometry([v2(0, -6), v2(3.6, -6), v2(4.8, -2), v2(4.8, 2), v2(3, 5.5), v2(2.1, 6.5), v2(1.9, 6.4)], 28), 0x5a6378, { edges: false, hull: true, matOpt: { side: T.DoubleSide } }), 0, 0, 0, cvb);
      const tr = cyl(0.8, 12.2, C.DARK, { edges: false }); tr.rotation.z = Math.PI / 2; at(tr, 0, 0, 0, cv);
      at(h.glow(0xffc070, 7, 0.7), 0, 6.8, 0, cvb);
      const sparks = []; for (let i = 0; i < 12; i++) { const s = new T.Mesh(keep(new T.SphereGeometry(0.28, 6, 4)), h.basic(0xffd27a)); cvb.add(s); sparks.push({ s, a: rnd(i + 70) * 6.28, v: 3 + rnd(i + 71) * 4, ph: rnd(i + 72) }); }
      kit.onFrame((dt, t) => {
        cvb.rotation.x = kit.reduce ? 0.15 : 0.25 * Math.sin(t * 0.6);
        sparks.forEach(p => { const k = kit.reduce ? p.ph : (t * 0.9 + p.ph) % 1; p.s.position.set(Math.cos(p.a) * k * 3, 6.6 + k * p.v * 1.4 - k * k * 4, Math.sin(p.a) * k * 3); });
      });
      at(cyl(0.25, 10, C.STEEL, { edges: false }), 55, B + 21, -8, gr);
      lbl(55, -1, 4.5, 'конвертер: чугун → сталь');
      // прокатный стан: раскалённая полоса бежит сквозь валки
      [34, 44].forEach(x => {
        [-3.2, 3.2].forEach(dz => at(box(1.4, 8, 1.4, 0x3a4256), x, B + 4, 6 + dz, gr));
        at(box(1.6, 1.4, 8, 0x3a4256), x, B + 8.6, 6, gr);
        [B + 2.4, B + 4.8].forEach(y => { const r = cyl(1.1, 5.2, C.STEEL, { seg: 18 }); r.rotation.x = Math.PI / 2; at(r, x, y, 6, gr); });
      });
      const strip = box(10, 0.6, 4, 0xff7a3a, { edges: false, matOpt: { emissive: 0xff5a1a, emissiveIntensity: 0.7 } }); at(strip, 30, B + 3.6, 6, gr);
      kit.onFrame((dt, t) => { const k = kit.reduce ? 0.4 : (t * 0.15) % 1; strip.position.x = 26 + k * 32; strip.scale.y = strip.position.x > 44 ? 0.5 : strip.position.x > 34 ? 0.75 : 1; strip.scale.x = strip.position.x > 44 ? 1.5 : 1; });
      const coil = cyl(3, 4, 0x9aa4b4, { seg: 24 }); coil.rotation.x = Math.PI / 2; at(coil, 58, B + 3, 6, gr);
      lbl(39, 12.5, 4.2, 'прокат: лист и рулон');
      mainTop = 40; mainAt = v3(fx, 0, fz);
    } else if (S0 === 'Cu') {
      proc = 'Медеплавильный завод';
      at(box(18, 8, 9, 0x9a4f3a), 37, B + 4, -26, gr);
      for (let i = 0; i < 3; i++) { at(box(2.4, 2, 0.3, 0xffa040, { edges: false, matOpt: { emissive: 0xff7a2a, emissiveIntensity: 1 } }), 31 + i * 6, B + 3, -21.4, gr); at(h.glow(0xff8a3a, 6, 0.4), 31 + i * 6, B + 3, -20.8, gr); }
      at(cyl(1.2, 8, 0x6e3527), 30, B + 12, -28, gr);
      h.pipe(gr, [v3(44, B + 8, -27), v3(44, B + 14, -27), v3(55, B + 14, -33), v3(55, B + 20, -33)], 0.8, 0x7d8697);
      acidTower(55, -33);
      lbl(37, -18.5, 5, 'плавка Cu₂S + O₂');
      ladle(31, -12, 0.8);
      bath(46, -6, 22, 7, 0x3f8fd9, { n: 11, a: 0xc8743e, c: 0xe8a070 });
      bath(46, 4, 22, 7, 0x3f8fd9, { n: 11, a: 0xc8743e, c: 0xe8a070 });
      lbl(46, 10.5, 4.2, 'электролиз: медь 99,99 %');
      stack(58, -14, 0xe8925a, 3);
      mainTop = 16; mainAt = v3(37, 0, -26);
    } else if (S0 === 'Al') {
      proc = 'Электролизный цех';
      at(box(6, 9, 6, 0x3b4a66), 30, B + 4.5, -28, gr); lbl(30, -22, 11.5, 'выпрямитель тока');
      // опора ЛЭП
      const px = 57, pz = -33, legs = [[-2, -2], [2, -2], [-2, 2], [2, 2]];
      legs.forEach(([a, b]) => h.rodAB(gr, v3(px + a, B, pz + b), v3(px + a * 0.25, B + 22, pz + b * 0.25), 0.25, 0x5a6378));
      at(box(10, 0.5, 0.5, 0x5a6378), px, B + 20, pz, gr);
      h.pipe(gr, [v3(px - 5, B + 19.6, pz), v3(30, B + 11, -28)], 0.15, 0x1b1610);
      for (let i = 0; i < 4; i++) {
        const x = 32 + i * 7.5, z = -12;
        at(box(6.4, 4, 9, 0x5a6378), x, B + 2, z, gr);
        at(box(5.6, 0.3, 8.2, 0x2a2420, { edges: false }), x, B + 4.05, z, gr);
        at(h.glow(0xff8a3a, 6, 0.4), x, B + 4.4, z, gr);
        [-2, 2].forEach(dz => { at(box(4, 2.6, 2.6, 0x2a2a2a), x, B + 5.2, z + dz, gr); at(cyl(0.25, 4, C.STEEL, { edges: false }), x, B + 8.4, z + dz, gr); });
        at(box(6.4, 0.6, 0.6, 0xc6ccd6), x, B + 10.4, z, gr);
      }
      const bb = cyl(0.5, 26, 0xc6ccd6, { edges: false }); bb.rotation.z = Math.PI / 2; at(bb, 43, B + 10.6, -12, gr);
      h.pipe(gr, [v3(30, B + 9, -28), v3(30, B + 10.6, -12), v3(30.5, B + 10.6, -12)], 0.5, 0xc6ccd6);
      lbl(43, -4.5, 4.2, 'Al₂O₃ в криолите, 950 °C');
      ladle(34, 4, 0.75);
      stack(52, 5, 0xc8d0dc, 4);
      lbl(52, 12, 4.2, 'алюминий в чушках');
      mainTop = 14; mainAt = v3(43, 0, -12);
    } else if (S0 === 'Zn') {
      proc = 'Цинковый завод';
      const rf = h.vessel(gr, 33, -28, 4, 12, 0x9a6a50, { y0: B + 2 });
      at(h.glow(0xff8a3a, 10, 0.5), 33, B + 8, -24, gr);
      lbl(33, -20.5, 5, 'обжиг ZnS → ZnO');
      h.pipe(gr, [v3(33, rf.top, -28), v3(33, rf.top + 3, -28), v3(55, rf.top + 3, -33), v3(55, B + 22, -33)], 0.8, 0x7d8697);
      acidTower(55, -33);
      // бак выщелачивания с мешалкой
      at(cyl(4.2, 7, 0x7d8697, { seg: 28 }), 44, B + 3.5, -18, gr);
      at(cyl(3.8, 0.3, 0xcfe6f0, { edges: false, hull: false }), 44, B + 6.9, -18, gr);
      const st = new T.Group(); at(st, 44, B + 6, -18, gr);
      at(cyl(0.2, 6, C.STEEL, { edges: false }), 0, 1.5, 0, st); at(box(4, 0.3, 0.8, C.STEEL), 0, -1, 0, st);
      at(box(2, 1.8, 2, 0x3b4a66), 44, B + 11, -18, gr);
      if (!kit.reduce) kit.onFrame((dt, t) => { st.rotation.y = t * 3; });
      lbl(44, -12.5, 4.5, 'ZnO + H₂SO₄ → ZnSO₄');
      bath(44, -2, 22, 7, 0xcfe6f0, { n: 11, a: 0x4a4f5a, c: 0x9fb4d9 });
      lbl(44, 4.2, 4.2, 'электролиз ZnSO₄');
      stack(57, 9, 0x9fb4d9, 3);
      mainTop = 18; mainAt = v3(44, 0, -18);
    } else {
      proc = 'Завод ферросплавов';
      for (let i = 0; i < 26; i++) at(h.ball(0.9 + rnd(i) * 0.5, i % 3 ? 0x2f3a33 : 0x1b1d20, { hull: false }), 31 + (rnd(i + 5) - 0.5) * 7, B + 0.6 + rnd(i + 6) * 2 * (1 - Math.abs(rnd(i + 5) - 0.5)), -10 + (rnd(i + 7) - 0.5) * 7, gr);
      lbl(31, -4, 4.5, 'хромит FeCr₂O₄ + кокс');
      at(cyl(9, 7, 0x9a4f3a, { seg: 30 }), 44, B + 3.5, -24, gr);
      at(cyl(9.4, 1.4, 0x5a6378, { seg: 30 }), 44, B + 7.7, -24, gr);
      const arcs = [];
      [0, 2.09, 4.19].forEach(a => {
        const x = 44 + Math.cos(a) * 4, z = -24 + Math.sin(a) * 4;
        at(cyl(1.3, 16, 0x2a2a2a, { seg: 16 }), x, B + 14, z, gr);
        at(box(3.4, 1.6, 3.4, 0xd8b04a), x, B + 18, z, gr);
        const gl = h.glow(0x9fd0ff, 7, 0.6); at(gl, x, B + 7.4, z, gr); arcs.push(gl);
      });
      at(new T.PointLight(0xbfe0ff, 30, 50, 1.3), 44, B + 12, -24, gr);
      if (!kit.reduce) kit.onFrame((dt, t) => arcs.forEach((a, i) => { a.material.opacity = 0.4 + 0.35 * Math.abs(Math.sin(t * 17 + i * 2)); }));
      lbl(44, -13.5, 5, 'руднотермическая печь');
      ladle(55, -6, 0.8);
      for (let i = 0; i < 14; i++) at(h.ball(1 + rnd(i + 30) * 0.4, 0xa8b0bc, { hull: false, seg: 6, seg2: 4 }), 50 + (rnd(i + 31) - 0.5) * 6, B + 0.7, 7 + (rnd(i + 32) - 0.5) * 5, gr);
      lbl(50, 12, 4.2, 'феррохром');
      mainTop = 22; mainAt = v3(44, 0, -24);
    }
    // табличка макета
    const yt = (S0 === 'Fe' ? 0 : 0);
    h.sign(g, 33, 17, 8 + yt, 15, 4.6, [{ t: `${M0.s} · ${proc}`, s: 0.62 }, { t: M0.eq, s: 0.6, w: 600 }, { t: placed0 ? M0.plant : 'город — найдите на карте', s: 0.5, w: 500, c: placed0 ? '#1d7a3e' : '#8a5a20' }], { pw: 384 });
    const mOut = d.ore * M0.Mm / M0.Mo;
    tag(v3(mainAt.x, mainTop + 3, mainAt.z + 10), proc, `${d.ore} т ${M0.ore} → ${fmt(mOut, 1)} т ${M0.s}`);
    tag(v3(-22, 8, -30), 'Карта Казахстана', `на месте ${Object.keys(d.mp).length} из ${d.metals.length} · ошибок ${d.wrong}`, Object.keys(d.mp).length === d.metals.length);
  };

  // =====================================================================================
  // ===== «Удобрения: считаем дозу»: грядка пшеницы, мешки N/P/K, весы с совком и кнопками, бочка Либиха =====
  SC['chin-fert'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, toon, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 8);
    // память: колосья растут плавно от прежней высоты
    const prevY = mem.fert ? mem.fert.cur() : d.y, t0 = now();
    mem.fert = { cur: () => prevY + (d.y - prevY) * ease(clamp((now() - t0) / 1.4, 0, 1)) };
    const yNow = () => mem.fert.cur();
    // ---- грядка ----
    const fx = -12, fz = -20, FW = 64, FD = 30;
    at(box(FW + 3, 5, FD + 3, 0x7a5a3a), fx, 2.5, fz, g);
    at(box(FW, 0.6, FD, 0x4a3727, { edges: false }), fx, 5.1, fz, g);
    for (let r = 0; r < 5; r++) at(box(FW - 2, 0.5, 1.6, 0x5a4330, { edges: false, shadow: false }), fx, 5.5, fz - FD / 2 + 3 + r * (FD - 6) / 4, g);
    // гранулы удобрений на почве: сколько внесено и каких
    const tot = d.F.reduce((s, F) => s + (d.fert[F.id] || 0), 0);
    let gi = 0;
    d.F.forEach(F => { const n = Math.round((d.fert[F.id] || 0) / 6); for (let i = 0; i < n && gi < 160; i++, gi++) at(h.ball(0.32, F.c, { hull: false, shadow: false, seg: 6, seg2: 4 }), fx + (rnd(gi + 500) - 0.5) * (FW - 3), 5.55, fz + (rnd(gi + 600) - 0.5) * (FD - 3), g); });
    // пшеница: 5 рядов по 12 растений
    const over = d.over.length > 0, stemCol = d.ok ? 0x5fbf5a : over ? 0xb8a040 : d.y < 0.6 ? 0xb8b26a : 0x8ccf7a, earCol = over ? 0xc9a24a : 0xe6c63a;
    const plants = [];
    const stemG = keep(new T.CylinderGeometry(0.16, 0.24, 1, 6)), earG = keep(new T.SphereGeometry(0.55, 10, 8)), leafG = keep(new T.BoxGeometry(0.15, 1, 0.7));
    const stemM = h.ownMat(stemCol), earM = h.ownMat(earCol), leafM = h.ownMat(stemCol);
    for (let r = 0; r < 5; r++) for (let i = 0; i < 12; i++) {
      const p = new T.Group(); at(p, fx - FW / 2 + 4 + i * (FW - 8) / 11 + (rnd(r * 12 + i) - 0.5) * 1.5, 5.6, fz - FD / 2 + 3 + r * (FD - 6) / 4, g);
      const st = new T.Mesh(stemG, stemM); p.add(st);
      const ear = new T.Mesh(earG, earM); ear.add(new T.Mesh(earG, kit.hullMat)); p.add(ear);
      const lf = [0, 1].map(k => { const l = new T.Mesh(leafG, leafM); l.rotation.z = k ? 0.7 : -0.7; p.add(l); return l; });
      plants.push({ p, st, ear, lf, k: 0.9 + rnd(r * 12 + i + 50) * 0.2, ph: rnd(r * 12 + i + 90) * 6 });
    }
    kit.onFrame((dt, t) => {
      const y = yNow(), hh = 2.5 + 15 * y;
      plants.forEach(q => {
        const H0 = hh * q.k; q.st.scale.y = H0; q.st.position.y = H0 / 2;
        q.ear.visible = y > 0.3; q.ear.scale.set(1, 1.6 + 1.6 * y, 1); q.ear.position.y = H0 + 0.6 + 0.6 * y;
        q.lf.forEach((l, k) => { l.scale.y = 2 + 3 * y; l.position.set(k ? -0.6 : 0.6, H0 * 0.35, 0); });
        q.p.rotation.z = kit.reduce ? 0 : 0.06 * Math.sin(t * 1.3 + q.ph);
      });
    });
    h.sign(g, fx - FW / 2 + 6, fz + FD / 2 + 3, 4.5, 14, 3.2, ['Пшеница · 1 га', { t: 'норма N 60 · P₂O₅ 40 · K₂O 30 кг', s: 0.5, w: 500 }], { pw: 320 });
    // ---- мешки ----
    d.F.forEach((F, i) => {
      const x = -52 + i * 12, z = 20, isSel = d.sel === F.id, kg = d.fert[F.id] || 0;
      const sg = new T.Group(); at(sg, x, 0, z, g);
      const body = mesh(new T.CylinderGeometry(3.4, 4.3, 10, 4), 0xf1ece0, { edges: true }); body.rotation.y = Math.PI / 4; at(body, 0, 5, 0, sg);
      at(cyl(1.2, 1.6, 0xe8e2d0, { r2: 0.5, edges: false }), 0, 10.8, 0, sg);
      const band = mesh(new T.CylinderGeometry(3.52, 3.62, 1.2, 4, 1, true), F.c, { edges: false, matOpt: { side: T.DoubleSide } }); band.rotation.y = Math.PI / 4; at(band, 0, 9, 0, sg);
      const lb = h.label(4.6, 5.4, [{ t: F.f, s: 0.75 }, { t: F.name, s: 0.55, w: 500 }, { t: [F.N && 'N ' + F.N, F.P && 'P₂O₅ ' + F.P, F.K && 'K₂O ' + F.K].filter(Boolean).join(' · ') + ' %', s: 0.5, w: 600, c: '#4a556c' }], { bg: '#fffaf0', pw: 256 });
      lb.rotation.x = -0.05; at(lb, 0, 5, 3.0, sg);
      if (kg) { const b = h.label(5, 1.9, ['+' + kg + ' кг'], { bg: '#ffb547' }); b.rotation.y = AZ * 0.5; at(b, 0, 13.4, 0, sg); }
      if (isSel) h.ring(sg, 0, 0.4, 0, 5.8);
      const hit = h.hitBox(7, 12, 7); at(hit, 0, 6, 0, sg); clickable(hit, 'sk-' + F.id);
    });
    // ---- весы: совок с выбранным удобрением, табло и кнопки ----
    const SF = d.F.find(F => F.id === d.sel) || d.F[0], skg = d.fert[SF.id] || 0;
    const wx = 22, wz = 24;
    at(box(18, 4, 13, 0xe8ecf4), wx, 2, wz, g);
    at(box(14, 0.8, 9, C.STEEL), wx, 4.5, wz - 1.5, g);
    const pan = mesh(new T.CylinderGeometry(5, 3.6, 2.6, 28, 1, true), 0xc6ccd6, { edges: false, matOpt: { side: T.DoubleSide } }); at(pan, wx, 6.2, wz - 1.5, g);
    at(cyl(3.6, 0.3, 0xc6ccd6, { edges: false, hull: false }), wx, 5, wz - 1.5, g);
    const pile = Math.min(1, skg / 150);
    if (skg) at(cyl(4.2 * (0.6 + 0.4 * pile), 0.6 + 2.4 * pile, SF.c, { r2: 1.2, edges: false, seg: 20 }), wx, 5.3 + (0.6 + 2.4 * pile) / 2, wz - 1.5, g);
    const scr = h.screen(10, 3.2, `${SF.name}: ${skg} кг/га`, '#86e0a8', 360); scr.rotation.x = -0.5; at(scr, wx - 3, 3.4, wz + 6.6, g);
    h.key(g, wx + 4.6, 3.2, wz + 4.4, '−10', 0x4f6fa8, 'f-', 3.6, 3);
    h.key(g, wx + 8.4, 3.2, wz + 4.4, '+10', 0x3d9a5a, 'f+', 3.6, 3);
    h.key(g, 36, 0, 30, 'очистить\nполе', 0x8a5a48, 'freset', 7, 5);
    // ---- бочка Либиха: вода держится до самой короткой доски ----
    const bx = 44, bz = -16, BR = 7, BH = 14, NS = 18;
    const rel = { N: d.rel.N, P: d.rel.P, K: d.rel.K }, special = { 0: 'N', 1: 'P', 2: 'K' };
    const minRel = Math.min(1, rel.N, rel.P, rel.K);
    at(cyl(BR + 0.3, 1, 0x7a5232), bx, 0.5, bz, g);
    for (let i = 0; i < NS; i++) {
      const a = AZ - 0.42 + i * Math.PI * 2 / NS, key0 = special[i];
      const r0 = key0 ? clamp(rel[key0], 0.04, 1.5) : 1, hs = BH * r0;
      const c = key0 ? (Math.abs(rel[key0] - 1) <= 0.1 + 1e-9 ? 0x5fbf5a : rel[key0] > 1.1 ? 0xe06a5a : 0xc58a5c) : 0xa8743e;
      const s = box(2.4, hs, 0.8, c); s.rotation.y = a; at(s, bx + Math.sin(a) * BR, 1 + hs / 2, bz + Math.cos(a) * BR, g);
      if (key0) { const l = h.label(2.2, 1.6, [{ N: 'N', P: 'P₂O₅', K: 'K₂O' }[key0]], { bg: '#fffaf0', pw: 128 }); l.rotation.y = a; at(l, bx + Math.sin(a) * (BR + 0.45), 1 + Math.min(hs - 1, 3), bz + Math.cos(a) * (BR + 0.45), g); }
    }
    [2.5, 9].forEach(y => { const t = mesh(new T.TorusGeometry(BR + 0.5, 0.3, 6, 40), 0x3a4256, { edges: false }); t.rotation.x = Math.PI / 2; at(t, bx, y, bz, g); });
    at(cyl(BR - 0.3, 0.6, 0x7a5232, { edges: false }), bx, 1.3, bz, g);
    const wl = h.liquid(g, bx, 1.6, bz, BR - 0.6, 0x4f9fe0, 0.75); wl.set(Math.max(0.1, BH * minRel - 0.6));
    // вода переливается через короткую доску
    if (minRel < 0.98) {
      const kmin = ['N', 'P', 'K'].reduce((a, k) => rel[k] < rel[a] ? k : a, 'N'), ia = { N: 0, P: 1, K: 2 }[kmin], a = AZ - 0.42 + ia * Math.PI * 2 / NS;
      const top = 1 + BH * clamp(rel[kmin], 0.04, 1.5);
      const sx = bx + Math.sin(a) * (BR + 0.8), sz2 = bz + Math.cos(a) * (BR + 0.8);
      const fall = new T.Mesh(keep(new T.CylinderGeometry(0.5, 0.9, top, 10)), h.ownMat(0x4f9fe0, { transparent: true, opacity: 0.7, depthWrite: false })); at(fall, sx, top / 2, sz2, g);
      const pud = mesh(new T.CylinderGeometry(3, 3, 0.15, 24), 0x4f9fe0, { edges: false, matOpt: { transparent: true, opacity: 0.6 } }); at(pud, sx + Math.sin(a) * 2, 0.1, sz2 + Math.cos(a) * 2, g);
    }
    // ---- подписи ----
    tag(v3(fx, 26, fz + 8), 'Поле пшеницы', `урожай ${Math.round(d.y * 100)} % от возможного`, d.ok);
    tag(v3(wx, 11, wz + 8), 'Весы · ' + SF.f, `${skg} кг/га`);
    tag(v3(bx, BH + 8, bz + 8), 'Бочка Либиха', `N ${fmt(d.n.N, 0)}/60 · P₂O₅ ${fmt(d.n.P, 0)}/40 · K₂O ${fmt(d.n.K, 0)}/30`, d.ok);
    if (over) tag(v3(fx + 20, 20, fz + 16), 'Избыток', d.over.map(k => ({ N: 'N', P: 'P₂O₅', K: 'K₂O' })[k]).join(', ') + ': вымывание, ожог корней', true);
  };

  // =====================================================================================
  // ===== «Загрязнение воздуха и воды»: город-макет — ТЭЦ с трубой, частный сектор, дорога с машинами,
  // ===== медный завод со стоком в реку, датчики воздуха и воды, туча с дождём, пульт мер =====
  SC['chin-city'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const on = k => d.on.includes(k), B = 2;
    const mixC = (a, b, k) => new T.Color(a).lerp(new T.Color(b), clamp(k, 0, 1)).getHex();
    at(box(126, 2, 70, 0x9db08a), 0, 1, -5, g);
    // ---- река ----
    const dirt = clamp((d.cu / 3) * 0.6 + (d.ph < 6.5 ? 0.4 * (6.5 - d.ph) / 3.7 : 0), 0, 1);
    at(box(126, 0.5, 8, mixC(0x3f8fc4, 0x5a5a28, dirt), { edges: false, matOpt: { transparent: true, opacity: 0.9 } }), 0, B + 0.1, 24, g);
    [-1, 1].forEach(k => at(box(126, 0.8, 0.8, 0x7a8a6a, { edges: false }), 0, B + 0.2, 24 + k * 4.4, g));
    if (dirt > 0.05) { const pl = mesh(new T.CylinderGeometry(1, 1, 0.2, 28), 0x9bbf3a, { edges: false, matOpt: { transparent: true, opacity: dirt * (on('dilute') ? 0.45 : 0.75) } }); pl.scale.set(on('dilute') ? 16 : 8, 1, 3); at(pl, 46, B + 0.45, 24, g); }
    const rHit = h.hitBox(126, 2, 8); at(rHit, 0, B + 1, 24, g); clickable(rHit, 'o-river');
    // ---- дорога и машины ----
    at(box(126, 0.3, 8, 0x3a3f4c, { edges: false }), 0, B + 0.15, 8, g);
    for (let i = 0; i < 13; i++) at(box(4, 0.06, 0.4, 0xf4f6f8, { edges: false, shadow: false }), -58 + i * 9.6, B + 0.33, 8, g);
    const carAmt = d.src.no2car / 1.2;
    [[0xe5533f, 6, 1, 0], [0x4d7cf0, 10, -1, 0.35], [0xf2c94c, 6, 1, 0.65]].forEach(([col, z, dir, ph], i) => {
      const car = new T.Group(); g.add(car);
      at(box(7, 2.2, 3.6, col), 0, B + 1.6, 0, car); at(box(4, 1.8, 3.2, 0xd8eef8, { edges: true }), -0.4, B + 3.5, 0, car);
      [[-2.3, -1.9], [2.3, -1.9], [-2.3, 1.9], [2.3, 1.9]].forEach(([wx, wz]) => { const w = cyl(1, 0.7, 0x1b1610, { seg: 12, edges: false }); w.rotation.x = Math.PI / 2; at(w, wx, B + 1, wz, car); });
      h.smoke(car, -4, B + 1.2, 0, { n: 5, size: 1.8, rise: 4, spread: 1.2, op: 0.5, amt: carAmt, color: 0x8a7a6a, wind: -6, seed: i * 7 });
      kit.onFrame((dt, t) => { const k = kit.reduce ? ph : (t * 0.05 + ph) % 1; car.position.set(dir * (-60 + k * 120), 0, z); car.rotation.y = dir > 0 ? 0 : Math.PI; });
    });
    const roadHit = h.hitBox(126, 4, 8); at(roadHit, 0, B + 2, 8, g); clickable(roadHit, 'o-road');
    // ---- ТЭЦ на угле ----
    const tg = new T.Group(); at(tg, 0, 0, 0, g);
    at(box(22, 12, 12, 0x6b7690), -44, B + 6, -24, tg);
    at(box(14, 6, 10, 0x5a6378), -44, B + 15, -24, tg);
    for (let i = 0; i < 4; i++) at(box(3, 3, 0.3, 0xffd27a, { edges: false, matOpt: { emissive: 0xffb547, emissiveIntensity: 0.6 } }), -52 + i * 5.4, B + 6, -17.9, tg);
    for (let i = 0; i < 22; i++) at(h.ball(1 + rnd(i) * 0.6, 0x1b1d20, { hull: false, seg: 6, seg2: 4 }), -56 + (rnd(i + 1) - 0.5) * 8, B + 0.5 + rnd(i + 2) * 1.6, -10 + (rnd(i + 3) - 0.5) * 6, tg);
    const sH = on('stack') ? 50 : 30, sx = -28, sz = -28;
    at(cyl(2.6, sH, 0xd8dde4, { r2: 1.7, seg: 20 }), sx, B + sH / 2, sz, tg);
    [0.55, 0.8].forEach(f => { const r = 2.6 - 0.9 * f + 0.15; at(cyl(r, sH * 0.07, 0xc94f43, { r2: r - 0.07, seg: 20, edges: false }), sx, B + sH * f, sz, tg); });
    h.pipe(tg, [v3(-33, B + 10, -24), v3(sx, B + 10, -24), v3(sx, B + 10, sz + 2.2)], 1, 0x7d8697);
    const tecAmt = d.so2 + d.src.pmtec + 0.3;
    h.smoke(tg, sx, B + sH + 1, sz, { n: 10, size: 4.5, rise: 18, spread: 3, op: 0.7, amt: Math.min(1.6, tecAmt / 1.6), color: mixC(0x9aa3b5, 0xc9b56a, d.so2 / 2.4), wind: 10, speed: 0.18 });
    if (on('scrub')) { h.vessel(tg, -22, -16, 3, 12, 0x5fbf7a, { y0: B + 1 }); h.sign(tg, -16, -11, 6, 10, 2.4, [{ t: 'сероочистка', w: 600 }], { bg: '#d9f5e2' }); }
    if (on('filter')) { at(box(7, 8, 8, 0x5fbf7a), -36, B + 4, -12, tg); for (let i = 0; i < 4; i++) at(box(0.3, 7, 7.4, 0x2a3142, { edges: false }), -38.4 + i * 1.6, B + 4.2, -12, tg); h.sign(tg, -36, -6, 4, 10, 2.4, [{ t: 'электрофильтр', w: 600 }], { bg: '#d9f5e2' }); }
    const tHit = h.hitBox(30, 20, 20); at(tHit, -42, B + 10, -22, tg); clickable(tHit, 'o-tec');
    // ---- частный сектор ----
    const hg = new T.Group(); at(hg, 0, 0, 0, g);
    for (let i = 0; i < 6; i++) {
      const x = -6 + (i % 3) * 10, z = -26 + Math.floor(i / 3) * 10;
      at(box(7, 5, 6, [0xe8d8b0, 0xd8c0a0, 0xe0e8f0][i % 3]), x, B + 2.5, z, hg);
      const roof = mesh(new T.CylinderGeometry(4.3, 4.3, 7.4, 3), 0x8a4b3a, { edges: true }); roof.rotation.z = Math.PI / 2; roof.scale.set(1, 1, 0.75);
      at(roof, x, B + 6.6, z, hg);
      at(box(1.2, 4, 1.2, 0x6e3527), x + 2, B + 8, z - 1, hg);
      at(box(1.6, 1.6, 0.2, 0xffd27a, { edges: false, matOpt: { emissive: 0xffb547, emissiveIntensity: 0.5 } }), x - 1.5, B + 2.6, z + 3.05, hg);
      h.smoke(hg, x + 2, B + 10.2, z - 1, { n: 5, size: 2.2, rise: 8, spread: 1.4, op: 0.65, amt: d.src.pmhome / 1.5, color: 0x59606d, wind: 4, seed: i * 3 });
    }
    if (on('gas')) {
      h.pipe(hg, [v3(-12, B + 3, -4), v3(20, B + 3, -4)], 0.45, 0xf2c94c);
      for (let i = 0; i < 5; i++) at(cyl(0.25, 3, 0x5a6378, { edges: false }), -12 + i * 8, B + 1.5, -4, hg);
      h.sign(hg, 23, -6, 5, 9, 2.4, [{ t: 'газ в дома', w: 600 }], { bg: '#fff2c4' });
    }
    const hHit = h.hitBox(32, 12, 22); at(hHit, 4, B + 6, -21, hg); clickable(hHit, 'o-homes');
    // ---- медный завод и сток ----
    const fg = new T.Group(); at(fg, 0, 0, 0, g);
    at(box(18, 9, 12, 0x6b7690), 38, B + 4.5, -16, fg);
    for (let i = 0; i < 3; i++) { const r = mesh(new T.CylinderGeometry(3.4, 3.4, 12, 3), 0x5a6378, { edges: true }); r.rotation.x = Math.PI / 2; at(r, 32.5 + i * 5.6, B + 10.5, -16, fg); }
    at(cyl(1.2, 14, 0x8a5a48), 45, B + 7, -20, fg);
    h.smoke(fg, 45, B + 14.5, -20, { n: 5, size: 2.4, rise: 8, op: 0.4, amt: 0.6, color: 0xb0b6c0, seed: 40 });
    const outlet = [v3(38, B + 1, -10), v3(38, B + 1, 4), v3(38, B + 0.6, 20.5)];
    h.pipe(fg, outlet, 0.9, 0x6b7690);
    h.flow(fg, outlet, on('treat') ? 0x9fd8ff : 0x9bbf3a, 6, { r: 1.05, speed: 6 });
    if (on('treat')) { [[52, -18], [52, -8]].forEach(([x, z]) => { at(cyl(4, 3, 0x7d8697, { seg: 28 }), x, B + 1.5, z, fg); at(cyl(3.6, 0.3, 0xf2f4f6, { edges: false, hull: false }), x, B + 2.95, z, fg); }); h.sign(fg, 56, -1, 4.5, 11, 2.4, [{ t: 'очистка стоков', w: 600 }], { bg: '#d9f5e2' }); }
    if (on('dilute')) { const wp = [v3(58, B + 8, 2), v3(58, B + 1, 2), v3(38.9, B + 1, 2)]; at(cyl(3, 8, 0x8fbfe0), 58, B + 4, 2, fg); h.pipe(fg, wp, 0.6, 0x4f9fe0); h.sign(fg, 50, 0, 11, 13, 2.4, [{ t: 'вода для разбавления', w: 600 }], { bg: '#fff2c4' }); }
    const fHit = h.hitBox(20, 14, 14); at(fHit, 38, B + 7, -16, fg); clickable(fHit, 'o-factory');
    // ---- датчики ----
    const bad = v => v > 1.0001;
    const airBad = bad(d.so2) || bad(d.no2) || bad(d.pm);
    at(cyl(0.4, 14, 0x5a6378, { edges: false }), -20, B + 7, 0, g);
    at(box(9, 7, 1.2, 0x2a3142), -20, B + 15, 0, g).rotation.y = AZ;
    const sa = h.screen(8.2, 6.2, `SO₂ ${fmt(d.so2, 2)}\nNO₂ ${fmt(d.no2, 2)}\nпыль ${fmt(d.pm, 2)}`, airBad ? '#ff8a73' : '#86e0a8', 300); sa.rotation.y = AZ; at(sa, -20 + Math.sin(AZ) * 0.65, B + 15, Math.cos(AZ) * 0.65, g);
    at(cyl(0.4, 9, 0x5a6378, { edges: false }), 16, B + 4.5, 17, g);
    at(box(9, 5, 1.2, 0x2a3142), 16, B + 10, 17, g).rotation.y = AZ;
    const wBad = bad(d.cu) || d.ph < 6.5 || d.ph > 8.5;
    const sw = h.screen(8.2, 4.2, `Cu²⁺ ${fmt(d.cu, 2)}\npH ${fmt(d.ph, 1)}`, wBad ? '#ff8a73' : '#86e0a8', 300); sw.rotation.y = AZ; at(sw, 16 + Math.sin(AZ) * 0.65, B + 10, 17 + Math.cos(AZ) * 0.65, g);
    at(h.ball(1.3, 0xe5533f), 16, B + 0.8, 23, g);
    // ---- туча и дождь ----
    const cg = new T.Group(); at(cg, 14, 46, -16, g);
    const cloudCol = mixC(0xeef2f8, 0x8a8a7a, clamp((5.6 - d.rain) / 1.4, 0, 1));
    for (let i = 0; i < 9; i++) at(h.ball(4 + rnd(i + 200) * 3, cloudCol, { hull: false, shadow: false }), (i - 4) * 4.4, rnd(i + 201) * 2.5, (rnd(i + 202) - 0.5) * 6, cg);
    if (d.rain < 5.3) {
      const dropM = h.basic(mixC(0x72d4e8, 0xff8a73, (5.6 - d.rain) / 1.2)), dg = keep(new T.CylinderGeometry(0.15, 0.15, 1.8, 4));
      const drops = []; for (let i = 0; i < 40; i++) { const m = new T.Mesh(dg, dropM); cg.add(m); drops.push({ m, x: (rnd(i + 300) - 0.5) * 38, z: (rnd(i + 301) - 0.5) * 10, ph: rnd(i + 302) }); }
      kit.onFrame((dt, t) => drops.forEach(p => { const k = kit.reduce ? p.ph : (t * 0.8 + p.ph) % 1; p.m.position.set(p.x, -3 - k * 46, p.z); }));
    }
    // ---- пульт мер ----
    at(box(116, 3, 11, 0x3b4a66), 0, 1.5, 39, g);
    d.M.forEach((x, i) => h.key(g, -48 + i * 16, 3, 39, `${x.name}\n${x.cost} ед.`, on(x.k) ? 0x2f9a5a : 0x5a6680, 'm-' + x.k, 14.4, 7.4, on(x.k)));
    // ---- подписи ----
    tag(v3(-28, B + sH + 6, -28), 'ТЭЦ на угле', `SO₂ ${fmt(d.so2, 2)} · пыль ${fmt(d.src.pmtec, 2)} × нормы`, bad(d.so2));
    tag(v3(4, B + 14, -24), 'Частный сектор', `сажа ${fmt(d.src.pmhome, 2)} × нормы`, d.src.pmhome > 1);
    tag(v3(38, B + 20, -16), 'Медный завод', `Cu²⁺ ${fmt(d.cu, 2)} × нормы · pH ${fmt(d.ph, 1)}`, wBad);
    tag(v3(26, 52, -16), 'Дождь', `pH ≈ ${fmt(d.rain, 1)}${d.rain < 5 ? ' · кислотный' : ''}`, d.rain < 5);
    tag(v3(0, 8, 42), 'Пульт мер', `бюджет ${d.spent} из ${d.budget} ед. · в норме ${d.good} из 5`, d.ok);
  };

  // =====================================================================================
  // ===== «Парниковый эффект»: лампа-«Солнце», глобус с атмосферой и молекулами, свет и ИК-лучи,
  // ===== градусник, гора с ледником, баллоны CO₂ и CH₄ с манометрами, пульт эпох =====
  SC['chin-gh'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, toon, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const G = v3(0, 24, -8), ER = 10, SR = 14.5;
    // ---- лампа ----
    const L = v3(-44, 36, -24);
    at(box(12, 1.6, 10, C.DARK), -46, 0.8, -26, g);
    at(cyl(0.8, 34, C.STEEL, { edges: false }), -46, 18, -26, g);
    const lampG = new T.Group(); at(lampG, L.x, L.y, L.z, g); lampG.lookAt(G);
    const refl = mesh(new T.CylinderGeometry(6, 2.6, 6, 28, 1, true), 0xe8ecf4, { edges: false, matOpt: { side: T.DoubleSide } }); refl.rotation.x = Math.PI / 2; at(refl, 0, 0, 1, lampG);
    at(h.ball(2.6, 0xfff3b0, { hull: false, matOpt: { emissive: 0xffe08a, emissiveIntensity: 1 } }), 0, 0, 2.5, lampG);
    at(h.glow(0xffe08a, 22, 0.75), 0, 0, 3, lampG);
    at(new T.PointLight(0xffe0a0, 60, 120, 1.1), 0, 0, 4, lampG);
    const lHit = h.hitBox(12, 12, 12); at(lHit, L.x, L.y, L.z, g); clickable(lHit, 'o-sun');
    // ---- глобус ----
    at(cyl(7, 1.6, C.DARK, { seg: 28 }), G.x, 0.8, G.z, g);
    at(cyl(0.9, G.y - ER, C.BRASS, { edges: false }), G.x, (G.y - ER) / 2, G.z, g);
    const ec = document.createElement('canvas'); ec.width = 512; ec.height = 256; const ex = ec.getContext('2d');
    ex.fillStyle = '#2f78c8'; ex.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 26; i++) { ex.fillStyle = ['#4f9a4a', '#7aa84a', '#b89a5a'][i % 3]; ex.beginPath(); ex.ellipse(rnd(i + 900) * 512, 50 + rnd(i + 901) * 150, 16 + rnd(i + 902) * 40, 10 + rnd(i + 903) * 26, rnd(i + 904) * 3, 0, 7); ex.fill(); }
    ex.fillStyle = '#f4f6f8'; ex.fillRect(0, 0, 512, 14); ex.fillRect(0, 242, 512, 14);
    const etex = keep(new T.CanvasTexture(ec)); etex.colorSpace = T.SRGBColorSpace;
    const earth = new T.Mesh(keep(new T.SphereGeometry(ER, 40, 28)), h.ownMat(0xffffff, { map: etex }));
    earth.add(new T.Mesh(earth.geometry, kit.hullMat)); at(earth, G.x, G.y, G.z, g); earth.rotation.z = 0.41;
    const eHit = h.hitBox(ER * 1.6, ER * 1.6, ER * 1.6); at(eHit, G.x, G.y, G.z, g); clickable(eHit, 'o-ground');
    // атмосфера: тем гуще и голубее, чем больше воздействие
    const shell = new T.Mesh(keep(new T.SphereGeometry(SR, 40, 28)), h.ownMat(0x72d4e8, { transparent: true, opacity: clamp(0.08 + 0.05 * d.f, 0.06, 0.35), depthWrite: false })); at(shell, G.x, G.y, G.z, g);
    // молекулы в атмосфере
    const molG = new T.Group(); at(molG, G.x, G.y, G.z, g);
    const nC = Math.round(d.co2 / 28), nM = Math.round(d.ch4 / 300);
    const place = i => { const u = rnd(i + 700) * 2 - 1, a = rnd(i + 701) * Math.PI * 2, rr = ER + 1.6 + rnd(i + 702) * (SR - ER - 2.4), s = Math.sqrt(1 - u * u); return v3(Math.cos(a) * s * rr, u * rr, Math.sin(a) * s * rr); };
    for (let i = 0; i < nC; i++) { const m = new T.Group(); m.position.copy(place(i)); m.rotation.set(rnd(i + 710) * 3, rnd(i + 711) * 3, 0); molG.add(m); at(h.ball(0.55, 0x4f586d, { hull: false, shadow: false, seg: 8, seg2: 6 }), 0, 0, 0, m); [-1, 1].forEach(k => at(h.ball(0.5, 0xe5533f, { hull: false, shadow: false, seg: 8, seg2: 6 }), k * 0.9, 0, 0, m)); }
    for (let i = 0; i < nM; i++) { const m = new T.Group(); m.position.copy(place(i + 100)); molG.add(m); at(h.ball(0.6, 0x4f586d, { hull: false, shadow: false, seg: 8, seg2: 6 }), 0, 0, 0, m); [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]].forEach(([a, b, c]) => at(h.ball(0.36, 0xeef2f8, { hull: false, shadow: false, seg: 6, seg2: 4 }), a * 0.55, b * 0.55, c * 0.55, m)); }
    const sHit = h.hitBox(SR * 2, 4, SR * 2); at(sHit, G.x, G.y + SR - 2, G.z, g); clickable(sHit, 'o-gas');
    if (!kit.reduce) kit.onFrame((dt, t) => { earth.rotation.y = t * 0.15; molG.rotation.y = t * 0.05; });
    // ---- лучи: жёлтые — свет к Земле, красные — ИК от Земли; часть ИК молекулы возвращают вниз ----
    const toL = L.clone().sub(G).normalize(), NP = 34, pg = keep(new T.SphereGeometry(0.85, 8, 6)), mY = h.basic(0xffd36b), mR = h.basic(0xff6a4a), mB = h.basic(0xffa080);
    const ph = [];
    for (let i = 0; i < NP; i++) {
      const n = toL.clone().add(v3(rnd(i + 800) - 0.5, rnd(i + 801) - 0.5, rnd(i + 802) - 0.5).multiplyScalar(1.5)).normalize();
      const n2 = n.clone().add(v3(rnd(i + 803) - 0.5, rnd(i + 804) - 0.5, rnd(i + 805) - 0.5).multiplyScalar(0.5)).normalize();
      const m = new T.Mesh(pg, mY); g.add(m);
      const tail = new T.Mesh(pg, mY); tail.scale.setScalar(0.6); g.add(tail);
      ph.push({ m, tail, n, n2, abs: rnd(i + 806) < d.pa, o: i / NP });
    }
    const pos = (q, k, out) => {
      if (k < 0.35) return [out.lerpVectors(L, G.clone().addScaledVector(q.n, ER), k / 0.35), mY];
      const s = (k - 0.35) / 0.65, P = G.clone().addScaledVector(q.n, ER);
      if (!q.abs) return [out.copy(P).addScaledVector(q.n, s * 34), mR];
      if (s < 0.5) return [out.copy(P).addScaledVector(q.n, s * 2 * (SR - ER)), mR];
      return [out.lerpVectors(G.clone().addScaledVector(q.n, SR), G.clone().addScaledVector(q.n2, ER), (s - 0.5) * 2), mB];
    };
    kit.onFrame((dt, t) => ph.forEach((q, i) => {
      const k = kit.reduce ? (i % 3) * 0.3 + 0.1 : (t * 0.22 + q.o) % 1;
      q.m.material = pos(q, k, q.m.position)[1];
      q.tail.material = pos(q, Math.max(0, k - 0.012), q.tail.position)[1];
    }));
    // ---- градусник ----
    const tx = 42, tz = -14, TH = 34;
    at(box(8, 1.4, 6, C.DARK), tx, 0.7, tz, g);
    const tg = new T.Group(); at(tg, tx, 0, tz, g); tg.rotation.y = AZ * 0.6;
    at(box(8, TH + 4, 1, 0xfffaf0), 0, 1.4 + (TH + 4) / 2, 0, tg);
    at(new T.Mesh(keep(new T.SphereGeometry(2, 16, 12)), toon(0xe0473a)), 0, 4.6, 0.9, tg);
    at(cyl(0.9, TH - 4, 0xeef6fb, { matOpt: { transparent: true, opacity: 0.6 } }), 0, 4.6 + (TH - 4) / 2, 0.9, tg);
    const yT = Tc => 6.8 + clamp((Tc - 10) / 10, 0, 1) * (TH - 8);
    const y10 = yT(10) - 1, SH = yT(20) - yT(10) + 2;
    const sc = h.canvasPlane(4, SH, 96, (x, W, Hh) => { x.fillStyle = '#1b1610'; x.font = `700 30px ${MONO}`; x.textAlign = 'left'; x.textBaseline = 'middle'; for (let v = 10; v <= 20; v++) { const y = Hh * (1 - (yT(v) - y10) / SH); x.fillRect(0, y - 2, v % 2 ? 14 : 24, 4); if (v % 2 === 0) x.fillText(String(v), 30, y); } });
    at(sc, 2.9, y10 + SH / 2, 0.55, tg);
    const colM = cyl(0.5, 1, 0xe0473a, { edges: false, hull: false }); at(colM, 0, 6, 1.2, tg);
    const prevT = mem.gh ? mem.gh.cur() : d.T, tt0 = now();
    mem.gh = { cur: () => prevT + (d.T - prevT) * ease(clamp((now() - tt0) / 1.2, 0, 1)) };
    kit.onFrame(() => { const v = mem.gh.cur(), hh = Math.max(0.5, yT(v) - 5.6); colM.scale.y = hh; colM.position.y = 5.6 + hh / 2; });
    const thHit = h.hitBox(8, TH + 4, 4); at(thHit, tx, 1.4 + (TH + 4) / 2, tz, g); clickable(thHit, 'o-therm');
    // ---- гора с ледником ----
    const mx0 = 40, mz0 = 22, snow = clamp(1 - d.dT / 4, 0.04, 1);
    at(box(22, 2, 16, 0x7a8a6a), mx0, 1, mz0, g);
    at(cyl(9, 16, 0x7a6a5a, { r2: 0.3, seg: 9 }), mx0, 10, mz0, g);
    at(cyl(6, 10, 0x8a7a6a, { r2: 0.3, seg: 8 }), mx0 - 7, 7, mz0 + 3, g);
    const hs = 15.4 * 0.55 * snow;
    at(cyl(9 * hs / 16 + 0.25, hs, 0xf4f8fc, { r2: 0.32, seg: 9 }), mx0, 18 - hs / 2, mz0, g);
    if (d.dT > 0.8) { const s2 = clamp((d.dT - 0.8) / 2, 0.2, 1); at(cyl(3 * s2 + 1, 0.2, 0x4f9fe0, { edges: false, hull: false }), mx0 + 7, 2.15, mz0 + 6, g); }
    const iHit = h.hitBox(20, 18, 16); at(iHit, mx0, 9, mz0, g); clickable(iHit, 'o-ice');
    // ---- баллоны и пульт ----
    const fracC = (d.co2 - 250) / 750, fracM = (d.ch4 - 700) / 2300;
    [['CO₂', -44, 0x3a3f4c, fracC, 'ppm', [[0, '250'], [0.5, '625'], [1, '1000']]], ['CH₄', -30, 0xc94f43, fracM, 'ppb', [[0, '700'], [0.5, '1850'], [1, '3000']]]].forEach(([f, x, col, fr, u, marks]) => {
      const z = 20;
      h.vessel(g, x, z, 3.4, 16, col, { y0: 0.3, bottom: false, domeK: 0.8 });
      at(cyl(0.6, 3, C.BRASS, { edges: false }), x, 19.5, z, g);
      const lb = h.label(4.6, 2.6, [f], { bg: '#fffaf0' }); lb.rotation.y = AZ; at(lb, x + Math.sin(AZ) * 3.45, 9, z + Math.cos(AZ) * 3.45, g);
      const dl = h.dial(g, x + 2.6, 21.5, z + 2.6, 2.6, u, marks, fr); dl.g.rotation.y = AZ;
    });
    at(box(96, 3, 10, 0x3b4a66), 0, 1.5, 40, g);
    [['pre-1750', '1750', 280, 722], ['pre-1960', '1960', 315, 1250], ['pre-now', 'сегодня', 420, 1900]].forEach(([k, t, c, m], i) => h.key(g, -40 + i * 10, 3, 40, t, 0x6a5a8a, k, 9, 6, d.co2 === c && d.ch4 === m));
    [['c-', '▼ CO₂', 0x4f6fa8], ['c+', '▲ CO₂', 0xd0603a], ['m-', '▼ CH₄', 0x4f6fa8], ['m+', '▲ CH₄', 0xd0603a]].forEach(([k, t, c], i) => h.key(g, -2 + i * 10 + (i > 1 ? 4 : 0), 3, 40, t, c, k, 9, 6));
    // ---- подписи ----
    tag(v3(G.x - 4, G.y + SR + 5, G.z), 'Атмосфера', `CO₂ ${d.co2} ppm · CH₄ ${d.ch4} ppb`);
    tag(v3(tx, TH + 8, tz), 'Градусник Земли', `${fmt(d.T, 1)} °C · ΔT +${fmt(d.dT, 2)} °C`, d.dT > 1.5);
    tag(v3(mx0, 20, mz0), 'Ледник', snow > 0.8 ? 'почти целый' : snow > 0.5 ? 'отступает' : 'тает быстро', snow <= 0.5);
    tag(v3(L.x, L.y + 8, L.z), 'Лампа-«Солнце»', 'видимый свет');
    tag(v3(-37, 28, 20), 'Баллоны', d.seen ? 'сегодняшний состав ✓' : 'поставьте «сегодня»', d.seen);
  };

  // =====================================================================================
  // ===== «Зелёная химия»: две установки синтеза рядом — баки реагентов, реактор с мешалкой,
  // ===== бак продукта и бочка отходов, табло атомной экономии; таблички продуктов =====
  SC['chin-green'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const B = 2;
    d.routes.forEach((R, i) => {
      const ox = i ? 34 : -34, act = d.route === i, picked = d.picked === i;
      const ig = new T.Group(); at(ig, ox, 0, -8, g); ig.scale.setScalar(1.22);
      at(box(54, 2, 46, act ? 0xa6b3c4 : 0x8d97a6), 0, 1, 0, ig);
      if (act) [[0, -23, 54, 0.6], [0, 23, 54, 0.6], [-27, 0, 0.6, 46], [27, 0, 0.6, 46]].forEach(([x, z, w, dd]) => at(box(w, 0.4, dd, 0xffd166, { edges: false, matOpt: { emissive: 0xffd166, emissiveIntensity: 0.6 } }), x, B + 0.2, z, ig));
      const mxR = R.re.reduce((s, r) => s + r.m, 0), mW = R.ws.reduce((s, w) => s + w.m, 0), nR = R.re.length;
      // реагенты
      R.re.forEach((r, k) => {
        const x = (k - (nR - 1) / 2) * 13, z = -15;
        h.vessel(ig, x, z, 3.4, 10, 0x9fb8d9, { y0: B + 1.5 });
        h.sign(ig, x + 1, z + 5, 4, 9.5, 3.6, [{ t: r.f, s: 0.7 }, { t: fmt(r.m, r.m % 1 ? 1 : 0) + ' г', s: 0.55, w: 500 }], { post: false, pw: 256 });
        const pts = [v3(x, B + 15, z), v3(x, B + 18, z), v3(x * 0.3, B + 18, -4), v3(0, B + 16.5, -2)];
        h.pipe(ig, pts, 0.45, 0x8a94a8);
        const fl = h.flow(ig, pts, 0x72d4e8, 5, { r: 0.6, speed: 9, on: false });
        kit.onFrame(() => { const lv = live(); fl.set(!!(lv && lv.route === i && lv.p < 0.55)); });
      });
      // реактор
      const rv = h.vessel(ig, 0, -2, 5.5, 11, 0xc9d1dc, { y0: B + 2 });
      const wx = Math.sin(AZ) * 5.6, wz = -2 + Math.cos(AZ) * 5.6;
      at(box(3.6, 7, 0.4, 0xd8eef8, { edges: true, matOpt: { transparent: true, opacity: 0.45 } }), wx, B + 9, wz, ig).rotation.y = AZ;
      const liq = at(box(3.2, 3.4, 0.45, 0x5fb4d9, { edges: false, matOpt: { emissive: 0x5fb4d9, emissiveIntensity: 0.3 } }), wx + Math.sin(AZ) * 0.1, B + 7.2, wz + Math.cos(AZ) * 0.1, ig); liq.rotation.y = AZ;
      at(box(2.4, 2, 2.4, 0x3b4a66), 0, rv.top + 1, -2, ig);
      const stir = new T.Group(); at(stir, 0, rv.top + 2, -2, ig); at(cyl(0.3, 2.4, C.STEEL, { edges: false }), 0, 1.2, 0, stir); at(box(3, 0.4, 0.6, 0xd8b04a), 0, 2.4, 0, stir);
      const jacket = mesh(new T.TorusGeometry(5.9, 0.6, 8, 32), 0x7d8697, { edges: false }); jacket.rotation.x = Math.PI / 2; at(jacket, 0, B + 5, -2, ig);
      const heat = h.glow(0xff8a3a, 16, 0); at(heat, 0, B + 5, -2, ig);
      kit.onFrame((dt, t) => { const lv = live(), run = lv && lv.route === i; stir.rotation.y = kit.reduce ? 0 : t * (run ? 9 : 1.2); heat.material.opacity = run ? 0.55 : 0; liq.material.color.setHex(run ? 0x86e0a8 : 0x5fb4d9); });
      const rHit = h.hitBox(12, 20, 12); at(rHit, 0, B + 9, -2, ig); clickable(rHit, 'run-' + i);
      // табло
      const scr = h.screen(10, 4.4, R.ran ? `АЭ ${fmt(R.ae, 1)} %\nE ${fmt(mW / R.pr.m, 2)}` : 'АЭ ?\nнажми реактор', R.ran ? (R.ae > 99 ? '#86e0a8' : R.ae > 60 ? '#ffb547' : '#ff8a73') : '#8b96ad', 300);
      at(cyl(0.3, 9, 0x5a6378, { edges: false }), 13, B + 4.5, -5, ig);
      at(box(11, 5.2, 0.8, 0x2a3142), 13, B + 11, -5, ig).rotation.y = AZ;
      scr.rotation.y = AZ; at(scr, 13 + Math.sin(AZ) * 0.45, B + 11, -5 + Math.cos(AZ) * 0.45, ig);
      // продукт: бак со смотровым стеклом
      const fP = R.pr.m / mxR, fW = mW / mxR;
      h.vessel(ig, -12, 11, 4, 9, 0xe8f4ec, { y0: B + 1 });
      at(mesh(new T.CylinderGeometry(4.1, 4.1, 1.4, 28, 1, true), 0x2fbf5a, { edges: false, matOpt: { side: T.DoubleSide } }), -12, B + 9, 11, ig);
      at(box(1.6, 8, 0.3, 0xd8eef8, { edges: true, matOpt: { transparent: true, opacity: 0.5 } }), -12 + Math.sin(AZ) * 4.1, B + 5.5, 11 + Math.cos(AZ) * 4.1, ig).rotation.y = AZ;
      const pl = at(box(1.3, 1, 0.35, 0x2fbf5a, { edges: false, matOpt: { emissive: 0x2fbf5a, emissiveIntensity: 0.3 } }), -12 + Math.sin(AZ) * 4.25, B + 1.6, 11 + Math.cos(AZ) * 4.25, ig); pl.rotation.y = AZ;
      // бочка отходов
      at(cyl(3.6, 8, 0x5a6378, { seg: 24 }), 12, B + 4, 11, ig);
      [2, 6].forEach(y => { const t = mesh(new T.TorusGeometry(3.7, 0.25, 6, 28), 0x3a4256, { edges: false }); t.rotation.x = Math.PI / 2; at(t, 12, B + y, 11, ig); });
      const piles = []; for (let k = 0; k < 10; k++) { const b = h.ball(0.9, 0x9a9a7a, { hull: false, shadow: false, seg: 6, seg2: 4 }); at(b, 12 + (rnd(k + i * 9) - 0.5) * 4, B + 8.4 + (k > 5 ? 0.8 : 0), 11 + (rnd(k + i * 9 + 3) - 0.5) * 4, ig); piles.push(b); }
      h.pipe(ig, [v3(-4, B + 3, 1), v3(-12, B + 3, 6.5)], 0.5, 0x8a94a8);
      h.pipe(ig, [v3(4, B + 3, 1), v3(12, B + 3, 7)], 0.5, 0x8a94a8);
      kit.onFrame(() => {
        const lv = live(), run = lv && lv.route === i, k = run ? ease(clamp((lv.p - 0.5) / 0.5, 0, 1)) : R.ran ? 1 : 0;
        const ph = 0.2 + 7.4 * fP * k; pl.scale.y = Math.max(0.05, ph); pl.position.y = B + 1.6 + ph / 2;
        piles.forEach((b, j) => { b.visible = fW > 0 && k > j / 10 && j < Math.ceil(fW * 14); });
      });
      h.sign(ig, -12, 17.5, 3.4, 11, 3, [{ t: 'продукт ' + R.pr.f, s: 0.55 }, { t: fmt(R.pr.m, 0) + ' г', s: 0.5, w: 500 }], { post: false, bg: '#d9f5e2', pw: 256 });
      h.sign(ig, 12, 17.5, 3.4, 11, 3, [{ t: R.ws.length ? 'отходы ' + R.ws.map(w => w.f).join(' + ') : 'отходов нет', s: 0.55 }, { t: R.ws.length ? fmt(mW, mW % 1 ? 1 : 0) + ' г' : 'бочка пуста ✓', s: 0.5, w: 500 }], { post: false, bg: '#eceff4', pw: 256 });
      h.sign(ig, -20, -4, 9, 12, 4.4, [{ t: 'путь ' + (i + 1), s: 0.55, c: '#8a5a20' }, { t: R.name, s: 0.55 }, { t: R.cond, s: 0.42, w: 500 }], { pw: 320 });
      if (picked) h.sign(ig, 0, 20, 3.5, 13, 3, ['✓ зелёный путь'], { post: false, bg: '#86e0a8' });
      else if (d.picked === null && d.routes[0].ran && d.routes[1].ran) h.key(ig, 0, B, 19, 'Этот путь\nзеленее', 0x2f9a5a, 'pick-' + i, 11, 5);
      tag(v3(ox, B + 26, -4), 'Путь ' + (i + 1) + ': ' + R.name, R.ran ? `атомная экономия ${fmt(R.ae, 1)} %` : 'нажмите на реактор', R.ran && R.ae > 99);
    });
    at(box(66, 3, 9, 0x3b4a66), 0, 1.5, 39, g);
    d.targets.forEach((nm, i) => h.key(g, -21 + i * 21, 3, 39, nm, d.tgt === i ? 0x3d7bd9 : 0x5a6680, 't-' + i, 19, 6, d.tgt === i));
    tag(v3(0, 8, 42), 'Продукт: ' + d.name + ' ' + d.f, `зелёных путей выбрано ${d.nPicked} из 3`, d.nPicked === 3);
  };
})();
