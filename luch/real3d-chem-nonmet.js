// «Как в жизни» для темы «Неметаллы» (labs/chem-nonmet): белый лабораторный поднос, прозрачная посуда,
// растворы и газы верного цвета. Галогены вытесняют друг друга в штативе пробирок, лестница степеней окисления серы,
// колонна синтеза аммиака со шкалами, белый и красный фосфор на медной пластине над горелкой,
// карбонат/силикат/хлорид с соляной кислотой и известковой водой.
// Сцены строятся из window.LUCH_REAL() опыта; нагрев пластины (температуры образцов) — из LUCH_REAL.live() в onFrame.
(() => {
  const SC = window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {};
  const live = () => { try { return window.LUCH_REAL.live ? window.LUCH_REAL.live() : null; } catch (e) { return null; } };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (x, n) => { let s = (Math.round(x * 10 ** n) / 10 ** n).toFixed(n); if (/^-0(\.0+)?$/.test(s)) s = s.slice(1); return s.replace('.', ',').replace('-', '−'); };
  const rnd = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const ease = x => x * x * (3 - 2 * x);
  const now = () => performance.now() / 1000;
  const hexs = c => '#' + c.toString(16).padStart(6, '0');
  const TY = 1.2; // верх подноса
  // что было в прошлой перестройке сцены: новое (только что налитое) показываем с анимацией
  const mem = {};
  // контур стекла: тоньше и светлее чёрного контура деталей, чтобы пробирки не казались тёмными внутри
  let ghMat = null;
  const GH = kit => ghMat || (ghMat = new kit.T.ShaderMaterial({ side: kit.T.BackSide, transparent: true, depthWrite: false,
    vertexShader: 'void main(){ vec3 p = position + normal * 0.2; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
    fragmentShader: 'void main(){ gl_FragColor = vec4(0.36, 0.42, 0.50, 0.5); }' }));
  // контур рисуем раньше растворов, иначе дальняя стенка ложится поверх цвета жидкости
  const GHM = (kit, geo) => { const m = new kit.T.Mesh(geo, GH(kit)); m.renderOrder = -1; return m; };

  // ---------- общие детали ----------
  function H(kit) {
    const { T, at, box, cyl, mesh, keep, grad, glowTex, clickable, toon, C } = kit;
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    const v2 = (x, y) => new T.Vector2(x, y);
    const glassMat = (color = 0xd8eef8, opacity = 0.26) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, transparent: true, opacity, side: T.DoubleSide, depthWrite: false }));
    const ownMat = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, ...o }));
    const spr = (map, color, opacity, add) => new T.Sprite(keep(new T.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending })));
    const glow = (color, size, opacity) => { const s = spr(glowTex(), color, opacity, true); s.scale.setScalar(size); return s; };
    const hitBox = (w, h, d) => new T.Mesh(keep(new T.BoxGeometry(w, h, d)), keep(new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })));
    const ball = (r, color, o = {}) => mesh(new T.SphereGeometry(r, o.seg || 16, o.seg2 || 12), color, { hull: o.hull ?? true, edges: false, matOpt: o.matOpt, shadow: o.shadow });
    function rodAB(parent, a, b, r, color, o = {}) {
      const dv = b.clone().sub(a), L = dv.length();
      const m = cyl(r, L, color, { edges: false, ...o });
      m.quaternion.setFromUnitVectors(v3(0, 1, 0), dv.normalize());
      return at(m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, parent);
    }
    function canvasPlane(w, h, pw, ph, draw) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph; const x = c.getContext('2d');
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: tex, transparent: true })));
      m.userData.draw = fn => { x.clearRect(0, 0, pw, ph); fn(x, pw, ph); tex.needsUpdate = true; };
      if (draw) m.userData.draw(draw);
      return m;
    }
    const textLines = (x, pw, ph, lines, fg, bg, o = {}) => {
      if (bg) { x.fillStyle = bg; x.beginPath(); x.roundRect(2, 2, pw - 4, ph - 4, o.round ?? 10); x.fill(); }
      if (o.border) { x.strokeStyle = o.border; x.lineWidth = o.bw || 6; x.beginPath(); x.roundRect(o.bw / 2 || 3, o.bw / 2 || 3, pw - (o.bw || 6), ph - (o.bw || 6), o.round ?? 10); x.stroke(); }
      const lh = ph / lines.length;
      lines.forEach((ln, i) => {
        const t = typeof ln === 'string' ? { t: ln } : ln;
        let fs = Math.round(lh * (t.k || 0.62)); const font = s => `${t.w || 600} ${s}px ${t.mono === false ? '"Golos Text", sans-serif' : '"IBM Plex Mono", monospace'}`;
        x.font = font(fs); const tw = x.measureText(t.t).width; if (tw > pw * 0.88) { fs = Math.floor(fs * pw * 0.88 / tw); x.font = font(fs); }
        x.fillStyle = t.c || fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t.t, pw / 2, lh * (i + 0.5) + 2);
      });
    };
    // наклейка/табличка с надписью (лицом к зрителю)
    const label = (parent, x, y, z, w, h, lines, fg = '#1b1610', bg = '#fff6e6', o = {}) => {
      const m = canvasPlane(w, h, Math.round(110 * w / h), 110, (cx, a, b) => textLines(cx, a, b, Array.isArray(lines) ? lines : [lines], fg, bg, o));
      if (o.tilt) m.rotation.x = -o.tilt;
      return at(m, x, y, z, parent);
    };
    function screen(w, h, txt, fg = '#86e0a8', pw = 320, ph = 120, bg = '#0e1520') {
      const m = canvasPlane(w, h, pw, ph);
      let cur = null;
      m.userData.set = (t, col = fg) => { t = String(t); if (cur === t + col) return; cur = t + col; m.userData.draw((x, a, b) => textLines(x, a, b, t.split('\n'), col, bg, { round: 6 })); };
      m.userData.set(txt); return m;
    }
    // клавиша на подносе с надписью сверху
    function key(parent, x, z, w, d, lbl, color, keyName, fg = '#ffffff') {
      const b = new T.Group(); at(b, x, TY, z, parent);
      at(box(w, 1.6, d, color), 0, 0.8, 0, b);
      const top = canvasPlane(w * 0.92, d * 0.8, Math.round(70 * w / d * 1.4), 112, (cx, a, bb) => textLines(cx, a, bb, [lbl], fg, hexs(color)));
      top.rotation.x = -Math.PI / 2; at(top, 0, 1.62, 0, b);
      clickable(b, keyName); return b;
    }
    // знак опасности (ромб, как на склянках): '!' — вредно, 'tox' — ядовито, 'cor' — разъедает, 'fire' — горит
    function hazard(parent, x, y, z, kind, s = 3.2) {
      return at(canvasPlane(s, s, 128, 128, (cx) => {
        cx.save(); cx.translate(64, 64); cx.rotate(Math.PI / 4);
        cx.fillStyle = '#ffffff'; cx.fillRect(-40, -40, 80, 80); cx.strokeStyle = '#d42a1e'; cx.lineWidth = 9; cx.strokeRect(-40, -40, 80, 80);
        cx.restore(); cx.fillStyle = '#111'; cx.strokeStyle = '#111';
        if (kind === 'tox') {
          cx.beginPath(); cx.arc(64, 54, 15, 0, 7); cx.fill(); cx.fillRect(56, 62, 16, 12);
          cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(58, 54, 4.2, 0, 7); cx.arc(70, 54, 4.2, 0, 7); cx.fill();
          cx.lineWidth = 5; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(44, 74); cx.lineTo(84, 90); cx.moveTo(84, 74); cx.lineTo(44, 90); cx.stroke();
        } else if (kind === 'cor') {
          cx.fillRect(40, 84, 48, 6);
          cx.beginPath(); cx.moveTo(46, 40); cx.lineTo(60, 40); cx.lineTo(56, 66); cx.lineTo(50, 66); cx.closePath(); cx.fill();
          cx.beginPath(); cx.moveTo(70, 40); cx.lineTo(84, 40); cx.lineTo(80, 66); cx.lineTo(74, 66); cx.closePath(); cx.fill();
          cx.beginPath(); cx.arc(53, 76, 3.5, 0, 7); cx.arc(77, 76, 3.5, 0, 7); cx.fill();
        } else if (kind === 'fire') {
          cx.beginPath(); cx.moveTo(64, 34); cx.bezierCurveTo(80, 56, 86, 66, 80, 80); cx.bezierCurveTo(74, 92, 54, 92, 48, 80); cx.bezierCurveTo(42, 66, 54, 60, 56, 48); cx.bezierCurveTo(60, 56, 64, 58, 64, 34); cx.fill(); cx.fillRect(42, 90, 44, 5);
        } else { cx.fillRect(59, 38, 10, 34); cx.beginPath(); cx.arc(64, 84, 6, 0, 7); cx.fill(); }
      }), x, y, z, parent);
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
    function flame(parent, x, y, z, hgt, inner, outer, glowCol) {
      const g = new T.Group(); at(g, x, y, z, parent);
      const s = spr(flameTex(inner, outer), 0xffffff, 0.94, false); s.center.set(0.5, 0.04); s.scale.set(hgt * 0.5, hgt, 1); at(s, 0, 0, 0, g);
      at(glow(glowCol, hgt * 2.2, 0.45), 0, hgt * 0.35, 0, g);
      if (!kit.reduce) kit.onFrame((dt, t) => { s.scale.set(hgt * 0.5 * (1 + 0.08 * Math.sin(t * 17 + x)), hgt * (1 + 0.12 * Math.sin(t * 13 + x) + 0.05 * Math.sin(t * 29)), 1); });
      return g;
    }
    let puffT = null;
    function puffTex() {
      if (puffT) return puffT;
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
      const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.5, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 64, 64); puffT = keep(new T.CanvasTexture(c)); return puffT;
    }
    // дым/пар: клубы поднимаются и тают
    function steam(parent, x, y, z, o = {}) {
      const n = o.n || 7, ps = [], g = new T.Group(); at(g, x, y, z, parent);
      for (let i = 0; i < n; i++) { const s = spr(puffTex(), o.color ?? 0xffffff, 0, false); g.add(s); ps.push({ s, ph: i / n, dx: (rnd(i + 3) - 0.5) * (o.spread ?? 6), dz: (rnd(i + 9) - 0.5) * (o.spread ?? 6) }); }
      const st = { amt: o.amt ?? 1 };
      kit.onFrame((dt, t) => {
        for (const p of ps) {
          const ph = kit.reduce ? 0.15 + p.ph * 0.7 : (t * (o.speed || 0.35) + p.ph) % 1;
          p.s.position.set(p.dx * (0.6 + ph) + (o.drift || 0) * ph, ph * (o.rise ?? 14), p.dz * (0.6 + ph));
          p.s.scale.setScalar((o.size || 4) * (0.6 + ph * 1.4));
          p.s.material.opacity = st.amt * (o.op ?? 0.55) * Math.sin(Math.PI * ph);
        }
      });
      return { g, set(a) { st.amt = a; } };
    }
    // пузырьки в жидкости
    function bubbles(parent, x, y0, z, r, n = 8) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const geo = keep(new T.SphereGeometry(1, 10, 8)), mat = keep(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }));
      const bs = [];
      for (let i = 0; i < n; i++) { const m = new T.Mesh(geo, mat); m.visible = false; g.add(m); bs.push({ m, ph: rnd(i + 11), a: rnd(i + 21) * Math.PI * 2, rr: Math.sqrt(rnd(i + 31)) * r }); }
      const st = { amt: 0, top: 5, big: 0.5, speed: 0.6 };
      kit.onFrame((dt, t) => {
        const k = Math.round(st.amt * n);
        bs.forEach((b, i) => {
          b.m.visible = i < k && st.top > 1.2; if (!b.m.visible) return;
          const ph = kit.reduce ? b.ph : (t * st.speed + b.ph) % 1, y = 0.4 + ph * (st.top - 0.9);
          b.m.scale.setScalar(st.big * (0.4 + 0.9 * ph));
          b.m.position.set(Math.cos(b.a) * b.rr + 0.3 * Math.sin(t * 5 + i), y, Math.sin(b.a) * b.rr);
        });
      });
      return { g, set(a, top, big = 0.5, speed = 0.6) { Object.assign(st, { amt: a, top, big, speed }); } };
    }
    // стакан
    function beaker(parent, x, y0, z, r, h) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const wall = new T.Mesh(keep(new T.CylinderGeometry(r, r * 0.97, h, 40, 1, true)), glassMat(0xd8eef8, 0.24)); at(wall, 0, h / 2, 0, g);
      wall.add(GHM(kit, wall.geometry));
      at(cyl(r * 0.97, 0.6, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.45 } }), 0, 0.3, 0, g);
      const rim = mesh(new T.TorusGeometry(r, 0.22, 6, 40), 0xeef6fb, { edges: false }); rim.rotation.x = Math.PI / 2; at(rim, 0, h, 0, g);
      for (let k = 1; k <= 5; k++) { const m = box(k % 2 ? 1.1 : 2, 0.16, 0.1, 0x6f8098, { edges: false, shadow: false }); m.rotation.y = 0.35; at(m, Math.sin(0.35) * (r + 0.05), h * k / 6.5, Math.cos(0.35) * (r + 0.05), g); }
      return { g, r, h };
    }
    function liquid(parent, x, y0, z, r, color, opacity = 0.62) {
      const mat = ownMat(color, { transparent: true, opacity, depthWrite: false });
      const m = new T.Mesh(keep(new T.CylinderGeometry(r, r * 0.97, 1, 40)), mat);
      at(m, x, y0, z, parent);
      const set = (hgt, yb = y0) => { m.visible = hgt > 0.05; m.scale.y = Math.max(0.05, hgt); m.position.y = yb + Math.max(0.05, hgt) / 2; };
      return { m, mat, set };
    }
    // белый лабораторный поднос
    function tray(g, w = 124, d = 84, z = 4) {
      at(box(w, TY, d, 0xf3f5f8), 0, TY / 2, z, g);
      at(box(w, 1.5, 1.2, 0xe2e7ee), 0, TY + 0.75, z - d / 2 + 0.6, g); at(box(w, 1.5, 1.2, 0xe2e7ee), 0, TY + 0.75, z + d / 2 - 0.6, g);
      at(box(1.2, 1.5, d - 2.4, 0xe2e7ee), -w / 2 + 0.6, TY + 0.75, z, g); at(box(1.2, 1.5, d - 2.4, 0xe2e7ee), w / 2 - 0.6, TY + 0.75, z, g);
    }
    // пробирка с круглым дном и жидкостью (уровень от дна)
    function tube(parent, x, y0, z, r, h, o = {}) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const pts = []; for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + i / 8 * Math.PI / 2; pts.push(v2(Math.max(0.001, Math.cos(a) * r), r + Math.sin(a) * r)); }
      pts.push(v2(r, h)); pts.push(v2(r + 0.3, h + 0.15));
      const geo = keep(new T.LatheGeometry(pts, 28));
      const wall = new T.Mesh(geo, glassMat(0xd8eef8, 0.3)); g.add(wall); wall.add(GHM(kit, geo));
      const lm = ownMat(o.color ?? 0xcfe2f0, { transparent: true, opacity: o.op ?? 0.7, depthWrite: false });
      const ri = r - 0.3;
      const bot = new T.Mesh(keep(new T.SphereGeometry(ri, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), lm); at(bot, 0, r, 0, g);
      const body = new T.Mesh(keep(new T.CylinderGeometry(ri, ri, 1, 24)), lm); at(body, 0, r, 0, g);
      const set = lv => { bot.visible = lv > 0.3; const hb = lv - r; body.visible = hb > 0.05; if (body.visible) { body.scale.y = hb; body.position.y = r + hb / 2; } };
      set(o.level ?? 0);
      return { g, r, h, ri, mat: lm, set };
    }
    // склянка с раствором и этикеткой
    function bottle(parent, x, z, col, lbl, o = {}) {
      const g = new T.Group(); at(g, x, o.y ?? TY, z, parent);
      const r = o.r || 3.6, hh = o.h || 10;
      const wall = new T.Mesh(keep(new T.CylinderGeometry(r, r, hh, 28, 1, true)), glassMat(o.brown ? 0x9a6a3a : 0xd8eef8, o.brown ? 0.55 : 0.3)); at(wall, 0, hh / 2, 0, g); wall.add(GHM(kit, wall.geometry));
      at(cyl(r, 0.5, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.4 } }), 0, 0.25, 0, g);
      at(cyl(r, 1.6, 0xd8eef8, { r2: 1.4, edges: false, matOpt: { transparent: true, opacity: 0.4 } }), 0, hh + 0.8, 0, g);
      if (o.open !== true) at(cyl(1.6, 1.8, o.cap || 0x2c3240, { seg: 16 }), 0, hh + 2.4, 0, g);
      if (col != null) { const lq = cyl(r - 0.35, hh * (o.fill ?? 0.72), col, { edges: false, hull: false, matOpt: { transparent: true, opacity: o.op ?? 0.8 } }); at(lq, 0, 0.5 + hh * (o.fill ?? 0.72) / 2, 0, g); }
      if (lbl) label(g, 0, hh * 0.45, r + 0.06, r * 1.8, hh * 0.36, lbl);
      if (o.haz) hazard(g, 0, hh * 0.45 + hh * 0.36, r + 0.1, o.haz, r * 0.9);
      return { g, top: (o.y ?? TY) + hh + 3.3 };
    }
    // баночка с порошком/кристаллами
    function jar(parent, x, y, z, col, o = {}) {
      const g = new T.Group(); at(g, x, y, z, parent);
      const r = o.r || 2.8, hh = o.h || 6;
      const wall = new T.Mesh(keep(new T.CylinderGeometry(r, r, hh, 24, 1, true)), glassMat(0xd8eef8, 0.32)); at(wall, 0, hh / 2, 0, g); wall.add(GHM(kit, wall.geometry));
      at(cyl(r, 0.4, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.4 } }), 0, 0.2, 0, g);
      at(cyl(r - 0.3, hh * 0.45, col, { r2: r - 0.6, edges: false, hull: false }), 0, 0.4 + hh * 0.225, 0, g);
      if (o.crystals) for (let i = 0; i < 6; i++) { const c = box(0.9, 0.9, 0.9, col, { edges: false }); c.rotation.set(rnd(i + o.crystals) * 3, rnd(i + 2) * 3, 0); at(c, (rnd(i + 5) - 0.5) * (r - 0.8) * 1.6, 0.4 + hh * 0.45 + 0.2, (rnd(i + 8) - 0.5) * (r - 0.8) * 1.6, g); }
      at(cyl(r + 0.25, 1.1, o.cap || 0x3b4a66, { seg: 20 }), 0, hh + 0.55, 0, g);
      return { g, top: y + hh + 1.1 };
    }
    // круглая шкала со стрелкой
    function dial(parent, x, y, z, r, unit, marks, frac, o = {}) {
      const g = new T.Group(); at(g, x, y, z, parent);
      const body = cyl(r, 1.8, 0xe8ecf4, { seg: 36 }); body.rotation.x = Math.PI / 2; at(body, 0, 0, 0, g);
      const ring = mesh(new T.TorusGeometry(r, 0.45, 8, 40), o.ring ?? C.BRASS, { edges: false, hull: true }); at(ring, 0, 0, 0.95, g);
      const c = document.createElement('canvas'); c.width = c.height = 256; const cx = c.getContext('2d');
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace;
      const f = clamp(frac, 0, 1);
      cx.fillStyle = '#f7f3ea'; cx.fillRect(0, 0, 256, 256);
      const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
      if (o.band) { cx.strokeStyle = '#86e0a8'; cx.lineWidth = 14; cx.beginPath(); cx.arc(128, 128, 92, a0 + (a1 - a0) * o.band[0], a0 + (a1 - a0) * o.band[1]); cx.stroke(); }
      cx.strokeStyle = '#1b1610'; cx.lineWidth = 4; cx.beginPath(); cx.arc(128, 128, 100, a0, a1); cx.stroke();
      marks.forEach(([mf, t]) => {
        const a = a0 + (a1 - a0) * mf; cx.lineWidth = 4; cx.beginPath(); cx.moveTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100); cx.lineTo(128 + Math.cos(a) * 82, 128 + Math.sin(a) * 82); cx.stroke();
        cx.fillStyle = '#1b1610'; cx.font = '600 21px "IBM Plex Mono", monospace'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(t, 128 + Math.cos(a) * 62, 128 + Math.sin(a) * 62);
      });
      for (let i = 0; i <= 20; i++) { const a = a0 + (a1 - a0) * i / 20; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100); cx.lineTo(128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92); cx.stroke(); }
      cx.fillStyle = '#1b1610'; cx.font = '700 26px "Golos Text", sans-serif'; cx.textAlign = 'center'; cx.fillText(unit, 128, 196);
      if (o.value) { cx.fillStyle = '#c0392b'; cx.font = '700 26px "IBM Plex Mono", monospace'; cx.fillText(o.value, 128, 226); }
      const a = a0 + (a1 - a0) * f;
      cx.strokeStyle = '#c0392b'; cx.lineWidth = 7; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(128, 128); cx.lineTo(128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92); cx.stroke();
      cx.fillStyle = '#1b1610'; cx.beginPath(); cx.arc(128, 128, 11, 0, 7); cx.fill();
      const face = new T.Mesh(keep(new T.PlaneGeometry(r * 1.8, r * 1.8)), keep(new T.MeshBasicMaterial({ map: tex }))); at(face, 0, 0, 0.92, g);
      return { g };
    }
    // газовая горелка (Бунзена): основание, трубка, муфта воздуха, кран
    function burner(parent, x, z, o = {}) {
      const g = new T.Group(); at(g, x, TY, z, parent);
      at(cyl(4.4, 1.2, C.DARK), 0, 0.6, 0, g);
      at(cyl(1.3, o.h || 9, 0x8a96b0), 0, 1.2 + (o.h || 9) / 2, 0, g);
      at(cyl(1.7, 2.2, C.BRASS, { seg: 16 }), 0, 3.2, 0, g);
      const knob = cyl(0.9, 2, 0xe0473a); knob.rotation.z = Math.PI / 2; at(knob, 2.6, 1.6, 0, g);
      const hose = cyl(0.7, 6, 0xc0392b, { edges: false }); hose.rotation.x = Math.PI / 2; at(hose, -3.6, 1, 2.5, g);
      return { g, top: TY + 1.2 + (o.h || 9) };
    }
    // штатив: основание, стержень
    const ring = (parent, x, z, r, col = 0xffd166) => at(cyl(r, 0.25, col, { edges: false, hull: false, shadow: false }), x, TY + 0.13, z, parent);
    return { v3, v2, glassMat, ownMat, spr, glow, hitBox, ball, rodAB, canvasPlane, textLines, label, screen, key, hazard, flame, steam, bubbles, beaker, liquid, tray, tube, bottle, jar, dial, burner, ring };
  }
  const mixC = (T, a, b, t) => new T.Color(a).lerp(new T.Color(b), clamp(t, 0, 1));

  // ===== 1. Галогены: штатив 3×3 пробирок, склянки с галогенной водой и солями, образцы простых веществ =====
  // цвет водного раствора и слоя гексана по свободному галогену
  const AQ = { Cl: 0xdbe98c, Br: 0xf0a43c, I: 0x9a5524 };
  const ORG = { Cl: 0xe8f2b0, Br: 0xe8641e, I: 0x8e3cc8 };
  const SALTC = 0xe6f2fa;
  SC['chnm-hal'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const CX = [-8, 8, 24], RZ = [-22, -4, 14], y0 = TY + 1.4, R = 2.4, TH = 20;
    // штатив: дно, три планки с отверстиями, стойки
    at(box(52, 1.4, 48, 0xe9edf3), 8, TY + 0.7, -4, g);
    RZ.forEach(z => {
      at(box(52, 0.8, 4.2, 0xffffff), 8, y0 + 13.5, z, g);
      for (const sx of [-25, 25]) at(box(1.4, 13.5, 1.4, 0xcfd6e2), 8 + sx, y0 + 6.75, z, g);
    });
    const prev = mem.hal, prevOn = prev ? prev.on : null, t0 = now();
    const on = d.tubes.filter(t => t.on).map(t => t.r + '-' + t.c);
    mem.hal = { on };
    let anim = null;
    d.tubes.forEach(tb => {
      const x = CX[tb.c], z = RZ[tb.r], k = tb.r + '-' + tb.c;
      const fresh = tb.on && prevOn && !prevOn.includes(k);
      const tu = h.tube(g, x, y0, z, R, TH, { color: SALTC, op: 0.35, level: 7 });
      const hb = h.hitBox(7, TH + 4, 7); at(hb, 0, TH / 2, 0, tu.g); clickable(tu.g, 't-' + k);
      if (d.last === k) h.ring(g, x, z, 3.6);
      const ri = tu.ri, org = new T.Mesh(kit.keep(new T.CylinderGeometry(ri, ri, 1, 24)), h.ownMat(ORG[tb.out] || SALTC, { transparent: true, opacity: 0.85, depthWrite: false }));
      org.visible = false; at(org, 0, 0, 0, tu.g);
      const setState = p => { // p: 0 — только соль, 1 — опыт закончен
        const lv = 7 + 3 * clamp(p * 1.6, 0, 1), f = clamp((p - 0.15) / 0.6, 0, 1);
        tu.set(lv); tu.mat.color.copy(mixC(T, SALTC, AQ[tb.out], f)); tu.mat.opacity = 0.35 + 0.45 * f;
        const lay = 2.4 * clamp((p - 0.35) / 0.4, 0, 1); org.visible = lay > 0.05; org.scale.y = Math.max(0.05, lay); org.position.y = lv + lay / 2;
      };
      if (!tb.on) return;
      if (fresh && !kit.reduce) anim = { x, z, set: setState, col: AQ[HKEY(d, tb.r)] }; else setState(1);
      if (fresh && kit.reduce) setState(1);
    });
    // пипетка капает галогенную воду в только что выбранную пробирку
    if (anim) {
      anim.set(0);
      const pg = new T.Group(); at(pg, anim.x, y0 + TH + 2, anim.z, g);
      const glass = new T.Mesh(kit.keep(new T.CylinderGeometry(0.7, 0.25, 9, 16, 1, true)), h.glassMat(0xd8eef8, 0.4)); at(glass, 0, 4.5, 0, pg);
      at(cyl(0.55, 5, anim.col, { edges: false, hull: false, r2: 0.6, matOpt: { transparent: true, opacity: 0.85 } }), 0, 4.5, 0, pg);
      at(h.ball(1.4, 0x2c3240), 0, 10, 0, pg);
      const drop = h.ball(0.45, anim.col, { hull: false }); at(drop, anim.x, 0, anim.z, g);
      kit.onFrame(() => {
        const p = clamp((now() - t0) / 2, 0, 1);
        anim.set(p); pg.visible = p < 0.95; pg.position.y = y0 + TH + 2 + 3 * ease(clamp((p - 0.75) / 0.2, 0, 1));
        const ph = (now() - t0) * 2.6 % 1; drop.visible = p < 0.7; drop.position.y = y0 + TH + 1.8 - ph * (TH - 9);
      });
    }
    // склянки с галогенной водой (слева, по строкам) и с растворами солей (сзади, по столбцам)
    d.hal.forEach((gl, r) => {
      const b = h.bottle(g, -40, RZ[r], AQ[gl.k], [gl.s + ' (вода)'], { r: 3.4, h: 9, brown: gl.k === 'I', haz: gl.k === 'I' ? null : '!' });
      if (gl.k === 'I') h.hazard(b.g, 0, 8.5, 3.5, '!', 3);
    });
    // полочка с растворами солей над задним краем штатива: каждая склянка — над своим столбцом
    at(box(60, 1, 7, 0xdfe4ec), 8, TY + 15.5, -34, g);
    for (const sx of [-28, 28]) at(box(1.4, 15, 1.4, 0xcfd6e2), 8 + sx, TY + 7.5, -34, g);
    d.salt.forEach((s, c) => h.bottle(g, CX[c], -34, SALTC, [s], { r: 3, h: 8, op: 0.35, y: TY + 16 }));
    h.bottle(g, 48, -26, 0xf4f6f8, ['гексан'], { r: 3, h: 9, op: 0.3, haz: 'fire' });
    // простые вещества-галогены: F₂ баллон, Cl₂ колба с газом, Br₂ ампула, I₂ кристаллы на часовом стекле
    const SX = [-42, -24, -6, 12], SZ = 34;
    const OCOL = { F: 0xefe6a0, Cl: 0xb9d65a, Br: 0xc0502a, I: 0x5a2f80 };
    ['F', 'Cl', 'Br', 'I'].forEach((k, i) => {
      const sg = new T.Group(); at(sg, SX[i], TY, SZ, g); clickable(sg, 'o-' + k);
      const hb = h.hitBox(11, 14, 10); at(hb, 0, 7, 0, sg);
      const pos = d.order.indexOf(k);
      if (pos >= 0) at(cyl(5, 0.25, d.orderOk ? 0x86e0a8 : 0xffd166, { edges: false, hull: false, shadow: false }), 0, 0.15, 0, sg);
      if (k === 'F') {
        at(cyl(2.4, 11, 0xcfd6e2), 0, 5.5, 0, sg); at(h.ball(2.4, 0xcfd6e2, { hull: false }), 0, 11, 0, sg);
        at(cyl(2.45, 2, OCOL.F, { edges: false }), 0, 7, 0, sg); at(cyl(0.8, 2, C.BRASS), 0, 13.6, 0, sg);
        h.hazard(sg, 0, 4, 2.6, 'tox', 2.6);
      } else if (k === 'Cl') {
        const fl = new T.Mesh(kit.keep(new T.SphereGeometry(4, 24, 16)), h.ownMat(OCOL.Cl, { transparent: true, opacity: 0.45, depthWrite: false })); at(fl, 0, 4.3, 0, sg);
        fl.add(GHM(kit, fl.geometry));
        at(cyl(1.3, 4, 0xd8eef8, { matOpt: { transparent: true, opacity: 0.4 } }), 0, 9.5, 0, sg); at(cyl(1.5, 1.6, 0x8a5a3a, { r2: 1.2 }), 0, 11.8, 0, sg);
        at(cyl(2.6, 0.6, 0x3b4a66), 0, 0.3, 0, sg);
        h.hazard(sg, 0, 4, 4.3, 'tox', 2.6);
      } else if (k === 'Br') {
        at(cyl(2.6, 0.8, 0x3b4a66), 0, 0.4, 0, sg);
        const amp = new T.Mesh(kit.keep(new T.CylinderGeometry(1.8, 1.8, 7, 20, 1, true)), h.glassMat(0xd8eef8, 0.35)); at(amp, 0, 4.6, 0, sg); amp.add(GHM(kit, amp.geometry));
        at(cyl(1.55, 3.6, OCOL.Br, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.92 } }), 0, 2.9, 0, sg);
        at(cyl(1.6, 3.2, 0xd8763c, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.35 } }), 0, 6.4, 0, sg);
        at(cyl(1.8, 3, 0xd8eef8, { r2: 0.3, edges: false, matOpt: { transparent: true, opacity: 0.4 } }), 0, 9.6, 0, sg);
        h.hazard(sg, 0, 4.4, 2.1, 'cor', 2.6);
      } else {
        const dish = mesh(new T.SphereGeometry(5, 28, 8, 0, Math.PI * 2, Math.PI * 0.72, Math.PI * 0.28), 0xd8eef8, { mat: h.glassMat(0xd8eef8, 0.45), hull: true, edges: false }); at(dish, 0, 5, 0, sg);
        for (let j = 0; j < 9; j++) { const c = box(1.2, 0.5, 0.8, OCOL.I, { edges: false }); c.rotation.set(0, rnd(j + 3) * 3, rnd(j) * 0.4); at(c, (rnd(j + 7) - 0.5) * 4, 0.9 + rnd(j + 1) * 0.4, (rnd(j + 9) - 0.5) * 4, sg); }
        const vap = h.steam(sg, 0, 1.4, 0, { n: 4, spread: 3, size: 2.4, rise: 5, op: 0.35, color: 0xb070e0, speed: 0.2 });
        vap.set(1);
      }
      // номер в ряду активности
      const nb = h.label(sg, 0, 1.2, 5.6, 4.2, 2.6, [pos >= 0 ? String(pos + 1) : k + '₂'], '#1b1610', pos >= 0 ? (d.orderOk ? '#86e0a8' : '#ffd166') : '#fff6e6', { tilt: 0.9 });
      nb.position.y = 1.0;
    });
    h.key(g, 36, 30, 18, 6, 'Очистить ряд', 0x3b4a66, 'oclr');
    h.key(g, 36, 39, 18, 6, 'Новые пробирки', 0x3b4a66, 'hreset');
    // подписи
    if (d.last) {
      const [r, c] = d.last.split('-').map(Number), tb = d.tubes.find(t => t.r === r && t.c === c);
      tag(v3(CX[c], y0 + TH + 6, RZ[r]), d.hal[r].s + ' + ' + d.salt[c], tb.re ? `${d.hal[r].k}₂ вытеснил ${tb.out}₂` : 'нет реакции', tb.re);
    }
    tag(v3(8, y0 + 18, -26), 'Штатив', `реакций ${d.found} из 3 · опытов ${d.n}/9`, d.found === 3);
    tag(v3(-15, TY + 15, SZ), 'Ряд активности', d.orderOk ? 'F₂ > Cl₂ > Br₂ > I₂ ✓' : d.order.length ? d.order.map(k => k + '₂').join(' > ') + ' > …' : 'нажмите: первым — самый активный', d.orderOk);
  };
  const HKEY = (d, r) => d.hal[r].k;

  // ===== 2. Сера: лестница степеней окисления, образцы веществ, горение серы, раствор KMnO₄ =====
  const SUL = {
    H2S: { kind: 'gas', col: 0xf2f4e0, haz: 'tox' }, ZnS: { kind: 'jar', col: 0xf4f2ea }, S: { kind: 'dish', col: 0xf2d43a },
    SO2: { kind: 'gas', col: 0xf4f6f6, haz: 'tox' }, Na2SO3: { kind: 'jar', col: 0xfbfbf6, cr: 1 }, SO3: { kind: 'amp', col: 0xf6f6f0, haz: 'cor' },
    H2SO4: { kind: 'bottle', col: 0xeef2f4, haz: 'cor' }, BaSO4: { kind: 'jar', col: 0xffffff },
  };
  const SHELF = [{ v: 6, k: 0, role: 'только окислитель' }, { v: 4, k: 1, role: 'окисл. и восст.' }, { v: 0, k: 2, role: 'окисл. и восст.' }, { v: -2, k: 3, role: 'только восстановитель' }];
  SC['chnm-sul'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    // вещество: собирается вокруг (0,0,0) группы, вернёт высоту
    const sample = (parent, f, k) => {
      const s = SUL[k];
      if (s.kind === 'gas') {
        const fl = new T.Mesh(kit.keep(new T.SphereGeometry(2.6, 20, 14)), h.glassMat(0xd8eef8, 0.32)); at(fl, 0, 2.7, 0, parent); fl.add(GHM(kit, fl.geometry));
        at(cyl(0.9, 2.6, 0xd8eef8, { matOpt: { transparent: true, opacity: 0.4 } }), 0, 6, 0, parent); at(cyl(1.1, 1.3, 0x8a5a3a, { r2: 0.9 }), 0, 7.6, 0, parent);
        at(cyl(1.8, 0.4, 0x3b4a66), 0, 0.2, 0, parent);
        h.hazard(parent, 0, 2.6, 2.75, 'tox', 2.2); return 8.3;
      }
      if (s.kind === 'dish') {
        const dsh = mesh(new T.CylinderGeometry(3.2, 2.4, 1.6, 28, 1, true), 0xf7f3ea, { hull: true, edges: false, mat: kit.toon(0xf7f3ea, { side: T.DoubleSide }) }); at(dsh, 0, 0.8, 0, parent);
        at(cyl(2.4, 0.3, 0xf7f3ea, { edges: false, hull: false }), 0, 0.15, 0, parent);
        for (let j = 0; j < 7; j++) at(h.ball(0.9 + rnd(j) * 0.4, s.col, { hull: false }), (rnd(j + 2) - 0.5) * 3, 1.4, (rnd(j + 4) - 0.5) * 3, parent);
        return 2.4;
      }
      if (s.kind === 'amp') {
        at(cyl(2.2, 0.6, 0x3b4a66), 0, 0.3, 0, parent);
        const a = new T.Mesh(kit.keep(new T.CylinderGeometry(1.6, 1.6, 6, 20, 1, true)), h.glassMat(0xd8eef8, 0.35)); at(a, 0, 3.6, 0, parent); a.add(GHM(kit, a.geometry));
        for (let j = 0; j < 6; j++) { const n = box(0.3, 2.4, 0.3, s.col, { edges: false }); n.rotation.set(rnd(j) - 0.5, rnd(j + 1) * 3, rnd(j + 2) - 0.5); at(n, (rnd(j + 3) - 0.5) * 1.6, 2.1, (rnd(j + 4) - 0.5) * 1.6, parent); }
        at(cyl(1.6, 2.4, 0xd8eef8, { r2: 0.25, edges: false, matOpt: { transparent: true, opacity: 0.4 } }), 0, 7.8, 0, parent);
        h.hazard(parent, 0, 4.4, 1.7, 'cor', 2); return 9;
      }
      if (s.kind === 'bottle') {
        const b = h.bottle(parent, 0, 0, s.col, null, { r: 2.4, h: 6.5, y: 0, op: 0.55, haz: 'cor' }); return 9.5;
      }
      h.jar(parent, 0, 0, 0, s.col, { r: 2.4, h: 5.5, crystals: s.cr ? 3 : 0 }); return 6.6;
    };
    // лестница: ступеньки слева (−2) вверх направо (+6)
    // ступеньки поднимаются влево: стенки-подступенки смотрят на зрителя (+x), верхняя — +6
    const STEP = { [-2]: { x: 36, hgt: 5 }, 0: { x: 12, hgt: 11 }, 4: { x: -12, hgt: 17 }, 6: { x: -36, hgt: 23 } };
    const SZ = -16, SD = 18;
    SHELF.forEach(sh => {
      const st = STEP[sh.v], sg = new T.Group(); at(sg, st.x, TY, SZ, g); clickable(sg, 'shelf-' + sh.k);
      at(box(23.6, st.hgt, SD, sh.v === 0 ? 0xf6e7a0 : 0xf2f4f8), 0, st.hgt / 2, 0, sg);
      at(box(23.6, 0.6, SD, d.sel !== null ? 0x72d4e8 : 0xe6c63a), 0, st.hgt + 0.3, 0, sg);
      const ph = Math.min(st.hgt - 0.8, 8), pl = h.canvasPlane(19, ph, 360, Math.round(360 * ph / 19), (x, a, b) => h.textLines(x, a, b, [{ t: 'S ' + (sh.v > 0 ? '+' + sh.v : sh.v < 0 ? '−2' : '0'), k: 0.7, w: 700 }, { t: sh.role, k: 0.42, mono: false }], '#1b1610', '#ffd166', { round: 12 }));
      at(pl, 0, st.hgt / 2, SD / 2 + 0.05, sg);
      // вещества на ступеньке
      const here = d.cards.map((c, i) => ({ c, i })).filter(o => o.c.v === sh.v);
      here.forEach((o, j) => { const pg = new T.Group(); at(pg, (j - (here.length - 1) / 2) * 7.4, st.hgt + 0.6, -1, sg); const hh = sample(pg, o.c.f, o.c.k); h.label(pg, 0, 1.4, 3.3, 6, 2.2, [o.c.f], '#1b1610', '#86e0a8', { tilt: 0.2 }); });
    });
    // лоток с невыставленными веществами (спереди)
    at(box(108, 0.8, 13, 0xe2e7ee), 0, TY + 0.4, 30, g);
    let selX = null;
    d.cards.forEach((c, i) => {
      if (c.v !== null) return;
      const x = -45 + i * 12.9, pg = new T.Group(); at(pg, x, TY + 0.8, 30, g); clickable(pg, 'card-' + i);
      const hb = h.hitBox(10, 12, 11); at(hb, 0, 6, 0, pg);
      const sel = d.sel === i, inner = new T.Group(); pg.add(inner);
      sample(inner, c.f, c.k);
      h.label(pg, 0, 1.2, 4.6, 8.6, 2.6, [c.f], '#1b1610', sel ? '#ffd166' : '#fff6e6', { tilt: 0.7 });
      if (sel) { selX = x; at(cyl(5, 0.25, 0xffd166, { edges: false, hull: false, shadow: false }), 0, 0.15, 0, pg); if (!kit.reduce) kit.onFrame((dt, t) => { inner.position.y = 1.2 + Math.sin(t * 5) * 0.6; }); else inner.position.y = 1.2; }
    });
    // демонстрации: сера горит синим пламенем в банке с кислородом (когда S на месте),
    // раствор KMnO₄ обесцвечивается сернистым газом (когда SO₂ на месте)
    const has = k => d.cards.some(c => c.k === k && c.v !== null);
    const prev = mem.sul || {}, t0 = now(); mem.sul = { S: has('S'), SO2: has('SO2') };
    {
      const bx = -52, bz = 12, jg = new T.Group(); at(jg, bx, TY, bz, g);
      const wall = new T.Mesh(kit.keep(new T.CylinderGeometry(4.2, 4.2, 14, 28, 1, true)), h.glassMat(0xd8eef8, 0.24)); at(wall, 0, 7, 0, jg); wall.add(GHM(kit, wall.geometry));
      at(cyl(4.2, 0.5, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.4 } }), 0, 0.25, 0, jg);
      at(cyl(5, 0.8, 0x9aa3b2), 0, 14.6, 0, jg);
      at(cyl(0.3, 10, C.STEEL, { edges: false }), 0, 10, 0, jg);
      const spoon = mesh(new T.SphereGeometry(1.4, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), C.STEEL, { hull: true, edges: false, mat: kit.toon(C.STEEL, { side: T.DoubleSide }) }); at(spoon, 0, 5.4, 0, jg);
      if (has('S')) {
        at(h.ball(0.9, 0xd8a020, { hull: false }), 0, 4.6, 0, jg);
        h.flame(jg, 0, 4.8, 0, 4.2, '#c8dcff', '#3a56ff', 0x4a6cff);
        h.steam(jg, 0, 8, 0, { n: 5, spread: 3, size: 2.4, rise: 5, op: 0.25, color: 0xeef2ff }).set(1);
      } else at(h.ball(1.0, 0xf2d43a, { hull: false }), 0, 4.8, 0, jg);
      tag(v3(bx, TY + 18, bz), 'O₂ + S', has('S') ? 'синее пламя → SO₂' : 'сера не горит');
      // KMnO₄
      const kx = 53, kz = 12;
      at(box(9, 4, 9, 0x3b4a66), kx, TY + 2, kz, g);
      const tu = h.tube(g, kx, TY + 4, kz, 2.4, 18, { color: 0x8e2a8e, op: 0.85, level: 10 });
      const done = has('SO2'), fresh = done && prev.SO2 === false;
      const setK = f => { tu.mat.color.copy(mixC(T, 0x8e2a8e, 0xf2eaf2, f)); tu.mat.opacity = 0.85 - 0.5 * f; };
      if (fresh && !kit.reduce) {
        const bub = h.bubbles(g, kx, TY + 4.6, kz, 1.2, 8);
        kit.onFrame(() => { const p = clamp((now() - t0) / 2.4, 0, 1); setK(ease(p)); bub.set(p < 1 ? 1 : 0, 9.4, 0.4, 1.2); });
      } else setK(done ? 1 : 0);
      if (done) { const gas = cyl(0.3, 14, 0xeef2f4, { edges: false }); at(gas, kx, TY + 4 + 10, kz, g); }
      tag(v3(kx, TY + 24, kz), 'KMnO₄', done ? 'обесцвечен SO₂' : 'малиновый', done);
    }
    tag(v3(0, TY + 31, SZ), 'Лестница серы', `на ступеньках ${d.placed} из 8`, d.placed === 8);
    if (selX !== null) tag(v3(selX, TY + 16, 30), 'Выбрано ' + d.cards[d.sel].f, 'на какую ступеньку?', true);
  };

  // ===== 3. Синтез аммиака: баллоны N₂ и H₂, колонна с катализатором, шкалы T и P, фенолфталеин и «дым без огня» =====
  SC['chnm-nh3'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const x = d.x / 100, sp = clamp(d.v, 0.02, 3), made = d.v >= 0.05 && x > 0.004; // без катализатора аммиак почти не образуется
    // баллоны: азот — чёрный с жёлтой надписью, водород — тёмно-зелёный с красной
    const gasCyl = (cx, cz, body, txt, fg) => {
      const cg = new T.Group(); at(cg, cx, TY, cz, g);
      at(cyl(3.6, 20, body), 0, 10, 0, cg); at(h.ball(3.6, body, { hull: false }), 0, 20, 0, cg);
      at(cyl(1.1, 3, C.BRASS), 0, 24, 0, cg); at(cyl(1.4, 1.2, 0x2c3240, { seg: 8 }), 0, 25.6, 0, cg);
      const lb = h.canvasPlane(4.2, 14, 60, 200, (c2, a, b) => { c2.save(); c2.translate(a / 2, b / 2); c2.rotate(-Math.PI / 2); c2.fillStyle = fg; c2.font = '700 40px "Golos Text", sans-serif'; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.fillText(txt, 0, 0); c2.restore(); });
      at(lb, 0, 10.5, 3.62, cg);
      return cg;
    };
    gasCyl(-54, -26, 0x22252c, 'АЗОТ', '#ffd23a');
    gasCyl(-44, -32, 0x1f5a34, 'ВОДОРОД', '#ff4a3a');
    // колонна синтеза
    const KX = -6, KZ = -18, KB = TY + 5, KH = 26, KR = 7;
    const kg = new T.Group(); at(kg, KX, 0, KZ, g);
    for (const a of [0.6, 2.7, 4.8]) at(cyl(0.7, KB - TY, C.DARK, { edges: false }), Math.cos(a) * 5, TY + (KB - TY) / 2, Math.sin(a) * 5, kg);
    at(cyl(KR + 0.6, 2.4, 0x8a96b0), 0, KB + 1.2, 0, kg);
    const wall = new T.Mesh(kit.keep(new T.CylinderGeometry(KR, KR, KH, 40, 1, true)), h.glassMat(0xd8eef8, 0.2)); at(wall, 0, KB + 2.4 + KH / 2, 0, kg); wall.add(GHM(kit, wall.geometry));
    at(cyl(KR + 0.6, 2.4, 0x8a96b0), 0, KB + 3.6 + KH, 0, kg);
    at(cyl(KR + 0.2, 3, 0x8a96b0, { r2: 2 }), 0, KB + 6.3 + KH, 0, kg);
    for (const yy of [KB + 2.4, KB + 2.4 + KH]) for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; at(cyl(0.45, 2.8, 0x5a6680, { seg: 6, edges: false }), Math.cos(a) * (KR + 0.3), yy, Math.sin(a) * (KR + 0.3), kg); }
    // стяжки
    for (const a of [0.8, 2.4, 3.9, 5.5]) at(cyl(0.3, KH, 0x5a6680, { edges: false, hull: false }), Math.cos(a) * (KR + 0.6), KB + 2.4 + KH / 2, Math.sin(a) * (KR + 0.6), kg);
    // корзина катализатора (пористое железо)
    const cb = new T.Group(); at(cb, 0, KB + 2.4 + KH * 0.42, 0, kg); clickable(cb, 'cat');
    const hb = h.hitBox(KR * 2 + 2, 8, KR * 2 + 2); at(hb, 0, 0, 0, cb);
    if (d.cat) {
      at(cyl(KR - 0.6, 6, 0x6a707c, { seg: 32 }), 0, 0, 0, cb);
      for (let j = 0; j < 40; j++) { const a = rnd(j) * 6.28, rr = Math.sqrt(rnd(j + 3)) * (KR - 1.4); at(box(0.9, 0.9, 0.9, rnd(j + 6) > 0.5 ? 0x4a4f58 : 0x8a6a50, { edges: false }), Math.cos(a) * rr, 3.2, Math.sin(a) * rr, cb); }
    } else {
      const rg = mesh(new T.TorusGeometry(KR - 0.6, 0.35, 6, 40), 0x5a6680, { edges: false, hull: true }); rg.rotation.x = Math.PI / 2; at(rg, 0, -3, 0, cb);
      const rg2 = rg.clone(); at(rg2, 0, 3, 0, cb);
    }
    // молекулы в колонне: доля NH₃ = выход; движутся тем быстрее, чем больше скорость реакции
    const N = 30, nN = Math.round(N * x), nN2 = Math.round((N - nN) / 4);
    const mats = { N: h.ownMat(0x4d7cf0), H: h.ownMat(0xeef2f8) };
    const sg = kit.keep(new T.SphereGeometry(1, 12, 8));
    const atom = (p, el, r, ox, oy, oz) => { const m = new T.Mesh(sg, mats[el]); m.scale.setScalar(r); m.position.set(ox, oy, oz); p.add(m); };
    const mols = [];
    for (let i = 0; i < N; i++) {
      const mg = new T.Group(), type = i < nN ? 'nh3' : i < nN + nN2 ? 'n2' : 'h2';
      if (type === 'nh3') { atom(mg, 'N', 0.85, 0, 0, 0); atom(mg, 'H', 0.45, -0.8, -0.45, 0.3); atom(mg, 'H', 0.45, 0.8, -0.45, 0.3); atom(mg, 'H', 0.45, 0, -0.45, -0.85); }
      else if (type === 'n2') { atom(mg, 'N', 0.7, -0.55, 0, 0); atom(mg, 'N', 0.7, 0.55, 0, 0); }
      else { atom(mg, 'H', 0.45, -0.35, 0, 0); atom(mg, 'H', 0.45, 0.35, 0, 0); }
      kg.add(mg);
      const a = rnd(i + 1) * 6.28, rr = Math.sqrt(rnd(i + 2)) * (KR - 1.6);
      let y = KB + 4 + rnd(i + 3) * (KH - 4); if (d.cat && Math.abs(y - (KB + 2.4 + KH * 0.42)) < 4) y += 8 * (rnd(i + 9) > 0.5 ? 1 : -1);
      mols.push({ mg, a, rr, y: clamp(y, KB + 3.5, KB + KH), ph: rnd(i + 4) * 6.28, w: rnd(i + 5) * 2 - 1 });
    }
    kit.onFrame((dt, t) => {
      const tt = kit.reduce ? 0 : t * (0.5 + sp * 0.7);
      for (const m of mols) {
        const a = m.a + m.w * tt * 0.6, rr = m.rr;
        m.mg.position.set(Math.cos(a) * rr + Math.sin(tt * 2 + m.ph) * 0.5, m.y + Math.sin(tt * 1.7 + m.ph) * 1.2, Math.sin(a) * rr);
        m.mg.rotation.set(tt + m.ph, tt * 0.7, 0);
      }
    });
    // трубы: баллоны → верх колонны, низ колонны → сборник NH₃
    const pipe = (pts, col = 0x8a96b0) => { for (let i = 0; i + 1 < pts.length; i++) h.rodAB(g, pts[i], pts[i + 1], 0.6, col); pts.forEach((p, i) => { if (i > 0 && i < pts.length - 1) at(h.ball(0.75, col, { hull: false }), p.x, p.y, p.z, g); }); };
    const topY = KB + 7.8 + KH;
    pipe([v3(-54, TY + 26.4, -26), v3(-54, topY + 2, -26), v3(-44, topY + 2, -26)]);
    pipe([v3(-44, TY + 26.4, -32), v3(-44, topY + 2, -32), v3(-44, topY + 2, -26), v3(KX, topY + 2, KZ - 0), v3(KX, topY - 0.2, KZ)]);
    const FX = 34, FZ = -18, OY = KB + 1, outPts = [v3(KX + KR + 0.6, OY, KZ), v3(FX, OY, KZ), v3(FX, TY + 13, FZ)];
    pipe(outPts, 0x7f8ba3);
    // поток: огоньки-молекулы бегут по трубам со скоростью реакции
    const flowGeo = kit.keep(new T.SphereGeometry(0.55, 8, 6)), flowMat = kit.keep(new T.MeshBasicMaterial({ color: 0x9ec0ff }));
    const path = new T.CatmullRomCurve3(outPts, false, 'catmullrom', 0);
    const inPath = new T.CatmullRomCurve3([v3(-44, topY + 2, -26), v3(KX, topY + 2, KZ), v3(KX, topY - 0.2, KZ)], false, 'catmullrom', 0);
    const flows = [];
    for (let i = 0; i < 8; i++) { const m = new T.Mesh(flowGeo, flowMat); g.add(m); flows.push({ m, ph: i / 8, p: i < 5 ? path : inPath }); }
    kit.onFrame((dt, t) => { for (const f of flows) { const u = kit.reduce ? f.ph : (t * 0.12 * Math.min(sp, 2) + f.ph) % 1; f.m.visible = d.v >= 0.05; f.m.position.copy(f.p.getPointAt(u)); } });
    // фенолфталеин с водой: краснеет от аммиака
    const fx = FX, fz = FZ;
    const fb = h.beaker(g, fx, TY, fz, 5.4, 11);
    const fcol = made ? mixC(T, 0xf0dce8, 0xd6246e, clamp(x / 0.3, 0.25, 1)).getHex() : 0xeef4f8;
    const lq = h.liquid(g, fx, TY + 0.6, fz, 5, fcol, made ? 0.78 : 0.4); lq.set(7);
    const bub = h.bubbles(g, fx, TY + 0.8, fz, 1.2, 8); bub.set(d.v >= 0.05 ? 0.6 : 0, 6.5, 0.4, 0.4 + 0.3 * Math.min(sp, 2));
    // «дым без огня»: открытая склянка конц. HCl рядом с выходом аммиака
    h.bottle(g, 50, 4, 0xeef2f4, ['HCl конц.'], { r: 3, h: 9, open: true, op: 0.45, haz: 'cor' });
    const smoke = h.steam(g, 43, TY + 12, -7, { n: 9, spread: 10, size: 4.4, rise: 9, op: 0.6, speed: 0.25, drift: -2 });
    smoke.set(made ? clamp(0.3 + x * 2.5, 0, 1) : 0);
    // пульт: шкалы T и P, кнопки, табло выхода
    const PZ = 22, panel = new T.Group(); at(panel, 0, TY, PZ, g);
    at(box(60, 14, 3, 0x3b4a66), 0, 7, 0, panel);
    for (const sx of [-27, 27]) at(box(3, 1, 8, 0x2c3240), sx, 0.5, 0, panel);
    h.dial(panel, -18, 7.6, 1.6, 5.4, '°C', [[0, '200'], [0.2, '300'], [0.4, '400'], [0.6, '500'], [0.8, '600'], [1, '700']], (d.T - 200) / 500, { value: d.T + ' °C', band: [0.3, 0.6] });
    h.dial(panel, 18, 7.6, 1.6, 5.4, 'МПа', [[0, '0'], [1 / 3, '10'], [2 / 3, '20'], [1, '30']], d.P / 30, { value: d.P + ' МПа', band: [0.5, 1] });
    const scr = h.screen(14, 7, `NH₃ ${fmt(d.x, 1)} %\nv = ${fmt(d.v, 2)}`, d.ok ? '#86e0a8' : '#ffd166'); at(scr, 0, 8.4, 1.56, panel);
    // тонкие трубки от колонны к шкалам
    h.rodAB(g, v3(KX - KR, KB + 10, KZ), v3(-18, TY + 13.2, PZ - 1.5), 0.25, 0x5a6680);
    h.rodAB(g, v3(KX + KR, KB + 14, KZ), v3(18, TY + 13.2, PZ - 1.5), 0.25, 0x5a6680);
    h.key(g, -24, 33, 10, 5.4, 'T −25°', 0x2f6fb0, 'T-'); h.key(g, -12, 33, 10, 5.4, 'T +25°', 0xc0392b, 'T+');
    h.key(g, 12, 33, 10, 5.4, 'P −1', 0x2f6fb0, 'P-'); h.key(g, 24, 33, 10, 5.4, 'P +1', 0xc0392b, 'P+');
    h.key(g, 0, 41, 18, 5.4, d.cat ? 'Убрать Fe' : 'Вставить Fe', d.cat ? 0x5a6680 : 0x2f9e55, 'cat');
    // подписи
    tag(v3(KX, topY + 5, KZ), 'Колонна синтеза', d.cat ? 'катализатор Fe' : 'без катализатора — почти стоит', !d.cat);
    tag(v3(0, TY + 17, PZ), 'Выход NH₃', `${fmt(d.x, 1)} % · скорость ${fmt(d.v, 2)}`, d.ok);
    tag(v3(fx, TY + 14, fz), 'Фенолфталеин', made ? 'малиновый: NH₃ — основание' : 'бесцветный');
    tag(v3(50, TY + 15, 4), 'Дым без огня', made ? 'NH₃ + HCl → NH₄Cl' : '');
  };

  // ===== 4. Фосфор: медная пластина на подставках, белый и красный фосфор, горелка, колба с лакмусом =====
  const PX = { w: 105, r: 355 }, MID = 230, IGN = { w: 40, r: 260 };
  const wx = X => (X - MID) * 0.26;
  const heatCol = (T, t) => { const k = clamp((t - 20) / 400, 0, 1); return new T.Color(`rgb(${Math.round(196 + 59 * k)},${Math.round(122 - 40 * k)},${Math.round(74 - 30 * k)})`); };
  SC['chnm-p'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const PY = TY + 20, PZ = -4, PL = 340 * 0.26;
    // подставки пластины
    for (const sx of [-1, 1]) {
      const px = sx * (PL / 2 + 2);
      at(box(8, 1, 8, C.DARK), px, TY + 0.5, PZ, g);
      at(cyl(0.7, PY - TY - 1, C.STEEL, { edges: false }), px, TY + (PY - TY) / 2, PZ, g);
      at(box(4, 2, 4, 0x3b4a66), px, PY - 1.2, PZ, g);
    }
    // пластина из полос: цвет от температуры в каждой точке
    const segs = [];
    for (let k = 0; k < 34; k++) {
      const X = 60 + k * 10 + 5, mat = h.ownMat(0xc47a4a);
      const m = new T.Mesh(kit.keep(new T.BoxGeometry(PL / 34 + 0.02, 0.8, 9)), mat); m.castShadow = true; m.receiveShadow = true;
      at(m, wx(X), PY, PZ, g); segs.push({ X, mat });
    }
    const outline = new T.LineSegments(kit.keep(new T.EdgesGeometry(kit.keep(new T.BoxGeometry(PL, 0.8, 9)))), kit.edgeMat); at(outline, 0, PY, PZ, g);
    // отметка середины
    at(box(0.5, 3, 0.5, d.centred ? 0x2f9e55 : 0x8b96ad, { edges: false }), 0, PY - 2, PZ + 4.8, g);
    h.label(g, 0, PY - 4.4, PZ + 4.9, 7, 1.8, ['середина'], d.centred ? '#ffffff' : '#1b1610', d.centred ? '#2f9e55' : '#fff6e6');
    // образцы
    const L0 = live() || {};
    const st = {};
    for (const s of ['w', 'r']) {
      const sx = wx(PX[s]), sgp = new T.Group(); at(sgp, sx, PY + 0.4, PZ, g);
      if (d.gone[s]) { at(cyl(1.8, 0.15, 0xdcdcd4, { edges: false, hull: false }), 0, 0.08, 0, sgp); }
      else if (s === 'w') {
        const pel = h.ball(1.8, 0xefe8c8); pel.scale.y = 0.55; at(pel, 0, 0.9, 0, sgp);
        const gl = h.glow(0x9dff9a, 9, 0.35); at(gl, 0, 1.2, 0, sgp); st.wGlow = gl;
      } else {
        const pile = cyl(2.4, 1.6, 0xb8382c, { r2: 0.6 }); at(pile, 0, 0.8, 0, sgp);
      }
      if (d.lit[s]) {
        h.flame(sgp, 0, 1, 0, 7, '#fff3c4', '#ffb547', 0xffa040);
        h.steam(sgp, 0, 6, 0, { n: 9, spread: 6, size: 5, rise: 18, op: 0.7, speed: 0.4 }).set(1);
        at(new T.PointLight(0xffb060, 30, 50, 1.4), 0, 5, 0, sgp);
      }
      // цифровой термометр-щуп перед образцом
      const sc = h.screen(10, 3.6, '20 °C', '#86e0a8'); at(sc, sx, PY - 7, PZ + 8, g);
      at(box(11, 4.4, 1, 0x2c3240), sx, PY - 7, PZ + 7.4, g);
      at(cyl(0.6, PY - 9.2 - TY, C.STEEL, { edges: false }), sx, TY + (PY - 9.2 - TY) / 2, PZ + 7.2, g);
      at(box(5, 0.8, 4, C.DARK), sx, TY + 0.4, PZ + 7.2, g);
      h.rodAB(g, v3(sx + 3, PY - 5, PZ + 7), v3(sx + 1.2, PY + 0.5, PZ + 2), 0.18, 0x2c3240);
      st[s] = sc;
    }
    // горелка под пластиной
    const bx = wx(d.xb), bu = h.burner(g, bx, PZ, { h: 9 }); clickable(bu.g, 'burner');
    const bhb = h.hitBox(10, 12, 10); at(bhb, 0, 6, 0, bu.g);
    if (d.pow > 0) {
      const s = 0.6 + d.pow / 100 * 1.15;
      h.flame(g, bx, bu.top, PZ, Math.min(PY - bu.top - 0.2, 5.6 * s), '#d8f0ff', '#3a8cff', 0x5aa8ff);
      at(new T.PointLight(0x6aa8ff, 10 + d.pow / 5, 40, 1.4), bx, bu.top + 3, PZ, g);
    }
    // хранение: белый фосфор под водой в банке, красный — на спичечном коробке
    {
      const jg = new T.Group(); at(jg, -46, TY, -28, g);
      const w = new T.Mesh(kit.keep(new T.CylinderGeometry(4, 4, 9, 28, 1, true)), h.glassMat(0x8a6a40, 0.5)); at(w, 0, 4.5, 0, jg); w.add(GHM(kit, w.geometry));
      at(cyl(3.7, 6.5, 0x9cc8e8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.45 } }), 0, 3.5, 0, jg);
      for (let j = 0; j < 4; j++) { const st2 = cyl(0.6, 3.6, 0xefe8c8, { edges: false }); st2.rotation.z = Math.PI / 2; st2.rotation.y = j; at(st2, (rnd(j) - 0.5) * 2, 0.9 + j * 0.7, (rnd(j + 2) - 0.5) * 2, jg); }
      at(cyl(4.3, 1.4, 0x3b4a66), 0, 9.7, 0, jg);
      h.label(jg, 0, 6.2, 4.06, 6, 2, ['P белый'], '#1b1610', '#fff6e6');
      h.hazard(jg, -2.8, 2.6, 3.9, 'tox', 2.6); h.hazard(jg, 2.8, 2.6, 3.9, 'fire', 2.6);
      const mb = new T.Group(); at(mb, 46, TY, -28, g);
      at(box(9, 3, 6, 0xe8d9b0), 0, 1.5, 0, mb);
      at(box(9.02, 2.2, 0.3, 0x8a2a20, { edges: false }), 0, 1.5, 3.05, mb);
      at(box(4, 0.6, 3, 0xf2e2c0), -1.5, 3.3, 0, mb);
      for (let j = 0; j < 4; j++) { const mt = box(5, 0.35, 0.35, 0xe6c68a, { edges: false }); at(mt, 1.5, 3.3 + 0.3 * j, -1 + j * 0.6, mb); at(h.ball(0.4, 0xa02818, { hull: false }), 4.2, 3.3 + 0.3 * j, -1 + j * 0.6, mb); }
      h.label(mb, 0, 1.5, 3.25, 6, 1.6, ['P красный'], '#ffffff', '#8a2a20');
    }
    // колба с водой и лакмусом (справа спереди)
    const FX = 48, FZ = 24, fg = new T.Group(); at(fg, FX, TY, FZ, g); clickable(fg, 'flask');
    {
      const R = 6, hh = 15, hc = hh * 0.6, rn = 1.8;
      const geo = kit.keep(new T.LatheGeometry([h.v2(0.001, 0), h.v2(R - 0.9, 0), h.v2(R, 0.9), h.v2(rn, hc), h.v2(rn, hh), h.v2(rn + 0.4, hh + 0.2)], 40));
      const wall = new T.Mesh(geo, h.glassMat(0xd8eef8, 0.26)); fg.add(wall); wall.add(GHM(kit, geo));
      const lv = 5, rAt = y => R + (rn - R) * (y - 0.9) / (hc - 0.9);
      at(cyl(R - 0.5, lv - 0.3, d.acid ? 0xe0504a : 0x8a6ad0, { r2: rAt(lv) - 0.4, edges: false, hull: false, matOpt: { transparent: true, opacity: 0.75 } }), 0, 0.3 + (lv - 0.3) / 2, 0, fg);
      at(h.hitBox(12, 16, 12), 0, 8, 0, fg);
      if (d.oxide && !d.acid) h.steam(fg, 0, hh, 0, { n: 6, spread: 4, size: 3.4, rise: 6, op: 0.5, speed: 0.3 }).set(1);
    }
    // кнопки
    h.key(g, -42, 36, 9, 5.4, '◀', 0x3b4a66, 'b-'); h.key(g, -31, 36, 9, 5.4, '▶', 0x3b4a66, 'b+');
    h.key(g, -16, 36, 11, 5.4, 'Пламя −', 0x2f6fb0, 'f-'); h.key(g, -3, 36, 11, 5.4, 'Пламя +', 0xc0392b, 'f+');
    h.key(g, 16, 36, 16, 5.4, 'Новые образцы', 0x3b4a66, 'preset');
    // нагрев — каждый кадр из живого состояния опыта
    kit.onFrame((dt, t) => {
      const L = live() || L0; if (!L.Ts) return;
      for (const sgm of segs) sgm.mat.color.copy(heatCol(T, 20 + (L.Tmax - 20) * Math.exp(-Math.abs(sgm.X - L.xb) / 90)));
      for (const s of ['w', 'r']) {
        const txt = L.gone[s] ? 'сгорел' : L.lit[s] ? 'горит!' : Math.round(L.Ts[s]) + ' °C';
        st[s].userData.set(txt, L.lit[s] ? '#ffb547' : L.gone[s] ? '#8b96ad' : L.Ts[s] > IGN[s] * 0.75 ? '#ffd166' : '#86e0a8');
      }
      if (st.wGlow) st.wGlow.material.opacity = kit.reduce ? 0.3 : 0.22 + 0.14 * Math.sin(t * 2.2);
    });
    const stTxt = s => d.gone[s] ? 'сгорел' : d.lit[s] ? 'горит!' : `воспл. ≈ ${IGN[s]} °C`;
    tag(v3(wx(PX.w), PY + 9, PZ), 'Белый P', stTxt('w'), d.lit.w);
    tag(v3(wx(PX.r), PY + 9, PZ), 'Красный P', stTxt('r'), d.lit.r);
    tag(v3(bx, TY + 3, PZ + 6), 'Горелка', d.pow ? `пламя ${d.pow} % · ${d.Tmax} °C` : 'выкл. — нажмите', d.pow > 0);
    tag(v3(FX, TY + 18, FZ), 'Вода + лакмус', d.acid ? 'красный: H₃PO₄' : d.oxide ? 'нажмите — растворить P₂O₅' : 'фиолетовый');
    if (d.fair) tag(v3(0, PY + 14, PZ - 6), 'Честный опыт', 'белый вспыхнул первым', true);
  };

  // ===== 5. Углерод и кремний: пробирки A, B, C, соляная кислота, известковая вода, этикетки, образцы минералов =====
  SC['chnm-c'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const TXs = [-20, 0, 20], TZ = -2, y0 = TY + 1.6, R = 2.9, TH = 24, LV = 11;
    const prev = mem.c || {}, t0 = now();
    mem.c = { res: d.res.slice(), cloudy: d.cloudy };
    // штатив
    at(box(54, 1.6, 14, 0xe9edf3), 0, TY + 0.8, TZ, g);
    at(box(54, 1.2, 8, 0xffffff), 0, y0 + 14, TZ, g);
    for (const sx of [-26, 26]) at(box(1.6, 14, 1.6, 0xcfd6e2), sx, y0 + 7, TZ, g);
    at(box(54, 7, 1.2, 0xffffff), 0, TY + 4.6, TZ + 7.4, g);
    const TL = ['A', 'B', 'C'];
    let drop = null;
    TXs.forEach((x, i) => {
      const tu = h.tube(g, x, y0, TZ, R, TH, { color: 0xcfe3f0, op: 0.35, level: LV });
      clickable(tu.g, 't5-' + i); at(h.hitBox(8, TH + 4, 8), 0, TH / 2, 0, tu.g);
      const res = d.res[i], fresh = res !== null && prev.res && prev.res[i] === null && !kit.reduce;
      if (res === 0) { // карбонат: газ CO₂
        const b = h.bubbles(g, x, y0 + 0.6, TZ, R - 1.2, 14);
        const foam = cyl(R - 0.35, 1, 0xf6f8fb, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.8 } }); at(foam, x, y0 + LV + 0.5, TZ, g);
        kit.onFrame(() => { const p = fresh ? clamp((now() - t0 - 0.6) / 1.5, 0, 1) : 1; b.set(p > 0 ? 1 : 0, LV - 0.3, 0.5, 1.3); foam.scale.y = 0.4 + 1.2 * p; foam.visible = p > 0; });
      } else if (res === 1) { // силикат: студенистый осадок H₂SiO₃
        const gel = [];
        for (let j = 0; j < 12; j++) { const m = h.ball(1.1 + rnd(j) * 0.4, 0xf2f4f6, { hull: false, matOpt: { transparent: true, opacity: 0.62, depthWrite: false } }); at(m, x + (rnd(j + 3) - 0.5) * 2.2, y0 + 1.3 + (j % 6) * 1.3, TZ + (rnd(j + 5) - 0.5) * 2.2, g); gel.push(m); }
        kit.onFrame(() => { const p = fresh ? clamp((now() - t0 - 0.6) / 1.6, 0, 1) : 1; gel.forEach((m, j) => { const s = clamp(p * 1.5 - j / 18, 0, 1); m.visible = s > 0.02; m.scale.setScalar(Math.max(0.01, ease(s))); }); });
      }
      if (fresh) drop = { x };
      // место для этикетки на штативе
      const sl = new T.Group(); at(sl, x, TY + 4.6, TZ + 8.1, g); clickable(sl, 'slot-' + i);
      at(h.hitBox(14, 7, 2), 0, 0, 0, sl);
      h.label(sl, 0, 0, 0, 13, 4.4, d.lab[i] ? [d.lab[i]] : ['?'], '#1b1610', d.lab[i] ? '#86e0a8' : d.sel5 !== null ? '#ffd166' : '#eef1f5', { border: d.lab[i] ? null : '#8b96ad', bw: 4 });
      h.label(g, x, y0 + 16.4, TZ + 4.05, 3, 2.4, [TL[i]], '#ffffff', '#3b4a66');
      if (d.lime === i) { at(cyl(R + 0.1, 3, 0x8a5a3a, { r2: R - 0.4 }), x, y0 + TH + 0.6, TZ, g); }
    });
    // соляная кислота: склянка с пипеткой
    const hx = -46, hz = -4;
    h.bottle(g, hx, hz, 0xeef2f4, ['HCl'], { r: 4, h: 11, op: 0.4, haz: 'cor', open: true });
    const pip = new T.Group(); at(pip, hx, TY + 14, hz, g);
    const pgl = new T.Mesh(kit.keep(new T.CylinderGeometry(0.7, 0.25, 9, 16, 1, true)), h.glassMat(0xd8eef8, 0.4)); at(pgl, 0, 0, 0, pip);
    at(h.ball(1.4, 0xc0392b), 0, 5.4, 0, pip);
    if (drop) {
      const dr = h.ball(0.45, 0xdfeef6, { hull: false }); at(dr, drop.x, 0, TZ, g);
      kit.onFrame(() => {
        const p = clamp((now() - t0) / 1.8, 0, 1), k = ease(clamp(p / 0.25, 0, 1)) * (1 - ease(clamp((p - 0.75) / 0.25, 0, 1)));
        pip.position.set(hx + (drop.x - hx) * k, TY + 14 + (y0 + TH + 6 - TY - 14) * k, hz + (TZ - hz) * k);
        const ph = (now() - t0) * 2.8 % 1; dr.visible = p > 0.25 && p < 0.75; dr.position.y = y0 + TH + 1 - ph * (TH - LV);
      });
    }
    // известковая вода
    const LX = 46, LZ = -2;
    const lg = new T.Group(); at(lg, LX, 0, LZ, g); clickable(lg, 'lime');
    h.beaker(lg, 0, TY, 0, 5.4, 13);
    const lq = h.liquid(lg, 0, TY + 0.6, 0, 5, 0xdfeef6, 0.35); lq.set(8);
    at(h.hitBox(12, 14, 12), 0, TY + 7, 0, lg);
    const freshCloud = d.cloudy && prev.cloudy === false && !kit.reduce;
    const setCloud = f => { lq.mat.color.copy(mixC(T, 0xdfeef6, 0xf4f4f0, f)); lq.mat.opacity = 0.35 + 0.55 * f; };
    if (d.lime !== null) {
      const x = TXs[d.lime], top = y0 + TH + 2.1;
      const pts = [v3(x, top, TZ), v3(x, top + 6, TZ), v3(LX, top + 6, LZ), v3(LX, TY + 2.5, LZ)];
      for (let i = 0; i + 1 < pts.length; i++) h.rodAB(g, pts[i], pts[i + 1], 0.45, 0xd8eef8, { matOpt: { transparent: true, opacity: 0.6 } });
      [pts[1], pts[2]].forEach(p => at(h.ball(0.5, 0xd8eef8, { hull: false, matOpt: { transparent: true, opacity: 0.6 } }), p.x, p.y, p.z, g));
      if (d.cloudy) {
        const b = h.bubbles(lg, 0, TY + 2.4, 0, 0.8, 8);
        kit.onFrame(() => { const p = freshCloud ? clamp((now() - t0) / 2.4, 0, 1) : 1; setCloud(ease(p)); b.set(1, 6, 0.5, 0.9); });
      } else setCloud(0);
    } else setCloud(0);
    // этикетки на подносе
    d.labs.forEach((l, k) => {
      if (l.used) return;
      const x = -20 + k * 20, lb = new T.Group(); at(lb, x, TY, 32, g); clickable(lb, 'lab-' + k);
      at(box(16, 0.5, 6, 0xffffff), 0, 0.25, 0, lb);
      const pl = h.canvasPlane(15, 5.2, 300, 104, (cx, a, b) => h.textLines(cx, a, b, [l.f], '#1b1610', d.sel5 === k ? '#ffd166' : '#fff6e6')); pl.rotation.x = -Math.PI / 2; at(pl, 0, 0.52, 0, lb);
      if (d.sel5 === k) { at(cyl(9, 0.2, 0xffd166, { edges: false, hull: false, shadow: false }), 0, 0.1, 0, lb); if (!kit.reduce) kit.onFrame((dt, t) => { lb.position.y = TY + 0.6 + Math.sin(t * 5) * 0.4; }); }
    });
    // образцы: формы углерода, кварц и мрамор (сзади)
    at(box(96, 1, 10, 0x3b4a66), 0, TY + 0.5, -30, g);
    const MX = [-38, -19, 0, 19, 38], MZ = -30, my = TY + 1;
    { const cg = new T.Group(); at(cg, MX[0], my, MZ, g); for (let j = 0; j < 5; j++) { const c = box(2 + rnd(j) * 1.4, 1.6 + rnd(j + 1), 2 + rnd(j + 2), 0x1c1d22); c.rotation.set(rnd(j + 3), rnd(j + 4) * 3, rnd(j + 5)); at(c, (rnd(j + 6) - 0.5) * 4, 1, (rnd(j + 7) - 0.5) * 3, cg); } }
    { const gp = cyl(3, 1.2, 0x5a5f68, { seg: 6 }); at(gp, MX[1], my + 0.6, MZ, g); const p2 = cyl(2.6, 1, 0x6a707a, { seg: 6 }); p2.rotation.y = 0.3; at(p2, MX[1] + 0.4, my + 1.7, MZ, g); }
    { const dm = mesh(new T.OctahedronGeometry(2.6), 0xe6f8ff, { edges: true, matOpt: { transparent: true, opacity: 0.75 } }); dm.scale.y = 1.2; at(dm, MX[2], my + 3.2, MZ, g); at(h.glow(0xffffff, 6, 0.4), MX[2], my + 3.6, MZ + 1, g); }
    { for (let j = 0; j < 3; j++) { const q = cyl(1 + j * 0.2, 5 - j, 0xf2f6fa, { seg: 6, r2: 0.2, matOpt: { transparent: true, opacity: 0.8 } }); q.rotation.z = (j - 1) * 0.35; at(q, MX[3] + (j - 1) * 1.8, my + 2.4, MZ, g); } }
    { for (let j = 0; j < 6; j++) { const m = box(1.8, 1.4, 1.6, 0xf6f4ee); m.rotation.set(rnd(j), rnd(j + 1) * 3, 0); at(m, MX[4] + (rnd(j + 2) - 0.5) * 5, my + 0.8 + (j > 3 ? 1 : 0), MZ + (rnd(j + 3) - 0.5) * 4, g); } }
    [['уголь', 'C'], ['графит', 'C'], ['алмаз', 'C'], ['кварц', 'SiO₂'], ['мрамор', 'CaCO₃']].forEach(([n, f], i) => h.label(g, MX[i], TY + 0.6, MZ + 5.2, 12, 3.2, [n + ' ' + f], '#1b1610', '#fff6e6', { tilt: 0.6 }));
    // подписи
    const RES = ['газ CO₂', 'студенистый осадок', 'без изменений'];
    TXs.forEach((x, i) => tag(v3(x, y0 + TH + (d.lime === i ? 9 : 4), TZ), 'Пробирка ' + TL[i], d.res[i] === null ? 'нажмите — капнуть HCl' : RES[d.res[i]], d.res[i] !== null && d.res[i] !== 2));
    tag(v3(LX, TY + 18, LZ), 'Ca(OH)₂', d.cloudy ? 'помутнела: CaCO₃↓' : 'прозрачная', d.cloudy);
    tag(v3(hx, TY + 22, hz), 'HCl', null);
  };
})();
