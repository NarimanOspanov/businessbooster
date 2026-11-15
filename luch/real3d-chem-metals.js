// «Как в жизни» для темы «Металлы» (labs/chem-metals): белый лабораторный поднос, стеклянная посуда,
// щелочные металлы в кристаллизаторе, жёсткая вода на плитке, пробирки с осадками, плавильная печь и испытание слитка.
// Сцены строятся из window.LUCH_REAL() опыта; быстрые значения (ход реакции, кипячение, окисление Fe(OH)₂) —
// из LUCH_REAL.live() в onFrame.
(() => {
  const SC = window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {};
  const live = () => { try { return window.LUCH_REAL.live ? window.LUCH_REAL.live() : null; } catch (e) { return null; } };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (x, n) => { let s = (Math.round(x * 10 ** n) / 10 ** n).toFixed(n); if (/^-0(\.0+)?$/.test(s)) s = s.slice(1); return s.replace('.', ',').replace('-', '−'); };
  const rnd = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const ease = x => x * x * (3 - 2 * x);
  const hexN = s => typeof s === 'number' ? s : parseInt(String(s).slice(1), 16);
  const TY = 1.2; // верх подноса
  const memo = {}; // прошлое состояние сцены — чтобы показать, куда только что капнули

  // ---------- общие детали ----------
  function H(kit) {
    const { T, at, box, cyl, mesh, keep, grad, glowTex, clickable, toon, C } = kit;
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    const v2 = (x, y) => new T.Vector2(x, y);
    const glassMat = (color = 0xd8eef8, opacity = 0.26) => keep(new T.MeshToonMaterial({ color: color === 0xd8eef8 ? 0xe6f3fb : color, gradientMap: grad, transparent: true, opacity, side: T.DoubleSide, depthWrite: false }));
    // контур стекла: тёмная линия только по силуэту (камера ортографическая — взгляд вдоль z вида)
    const gHull = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide,
      vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vN; void main(){ float a = 1.0 - smoothstep(0.16, 0.34, abs(vN.z)); gl_FragColor = vec4(0.106, 0.086, 0.063, a * 0.85); }' }));
    const ownMat = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, ...o }));
    const spr = (map, color, opacity, add) => new T.Sprite(keep(new T.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending })));
    const glow = (color, size, opacity) => { const s = spr(glowTex(), color, opacity, true); s.scale.setScalar(size); return s; };
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
      if (bg) { x.fillStyle = bg; if (o.round) { x.beginPath(); x.roundRect(2, 2, pw - 4, ph - 4, o.round); x.fill(); } else x.fillRect(0, 0, pw, ph); }
      const lh = ph / lines.length;
      lines.forEach((ln, i) => {
        const t = typeof ln === 'string' ? { t: ln } : ln;
        let fs = Math.round(lh * (t.k || 0.62)); const font = s => `${t.w || 600} ${s}px ${t.mono === false ? '"Golos Text", sans-serif' : '"IBM Plex Mono", monospace'}`;
        x.font = font(fs); const tw = x.measureText(t.t).width; if (tw > pw * 0.9) { fs = Math.floor(fs * pw * 0.9 / tw); x.font = font(fs); }
        x.fillStyle = t.c || fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t.t, pw / 2, lh * (i + 0.5) + 2);
      });
    };
    const plate = (w, hh, lines, fg = '#1b1610', bg = '#fff6e6', pw = 240) => canvasPlane(w, hh, pw, Math.round(pw * hh / w), (x, a, b) => textLines(x, a, b, lines, fg, bg, { round: 10 }));
    function screen(w, hh, txt, fg = '#86e0a8', pw = 320, ph = 120, bg = '#0e1520') {
      const m = canvasPlane(w, hh, pw, ph);
      let cur = null;
      m.userData.set = (t, col = fg) => { t = String(t); if (cur === t + col) return; cur = t + col; m.userData.draw((x, a, b) => textLines(x, a, b, t.split('\n'), col, bg)); };
      m.userData.set(txt); return m;
    }
    // пламя (спиртовка, горящий металл)
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
      const st = { k: 1 };
      if (!kit.reduce) kit.onFrame((dt, t) => { s.scale.set(hgt * 0.5 * st.k * (1 + 0.08 * Math.sin(t * 17)), hgt * st.k * (1 + 0.12 * Math.sin(t * 13) + 0.05 * Math.sin(t * 29)), 1); });
      g.userData.size = k => { st.k = k; if (kit.reduce) s.scale.set(hgt * 0.5 * k, hgt * k, 1); };
      return g;
    }
    let puffT = null;
    function puffTex() {
      if (puffT) return puffT;
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
      const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.5, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 64, 64); puffT = keep(new T.CanvasTexture(c)); return puffT;
    }
    function steam(parent, x, y, z, o = {}) {
      const n = o.n || 7, ps = [], g = new T.Group(); at(g, x, y, z, parent);
      for (let i = 0; i < n; i++) { const s = spr(puffTex(), o.color ?? 0xffffff, 0, false); g.add(s); ps.push({ s, ph: i / n, dx: (rnd(i + 3) - 0.5) * (o.spread ?? 6), dz: (rnd(i + 9) - 0.5) * (o.spread ?? 6) }); }
      const st = { amt: o.amt ?? 1 };
      kit.onFrame((dt, t) => {
        for (const p of ps) {
          const ph = kit.reduce ? 0.15 + p.ph * 0.7 : (t * (o.speed || 0.35) + p.ph) % 1;
          p.s.position.set(p.dx * (0.6 + ph), ph * (o.rise ?? 14), p.dz * (0.6 + ph));
          p.s.scale.setScalar((o.size || 4) * (0.6 + ph * 1.4));
          p.s.material.opacity = st.amt * (o.op ?? 0.55) * Math.sin(Math.PI * ph);
        }
      });
      return { g, set(a) { st.amt = a; } };
    }
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
    // стеклянный стакан с делениями
    function beaker(parent, x, y0, z, r, h) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const wall = new T.Mesh(keep(new T.CylinderGeometry(r, r * 0.97, h, 40, 1, true)), glassMat(0xd8eef8, 0.24)); at(wall, 0, h / 2, 0, g);
      wall.add(new T.Mesh(wall.geometry, gHull));
      at(cyl(r * 0.97, 0.6, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.45 } }), 0, 0.3, 0, g);
      const rim = mesh(new T.TorusGeometry(r, 0.22, 6, 40), 0xeef6fb, { edges: false, shadow: false }); rim.rotation.x = Math.PI / 2; at(rim, 0, h, 0, g);
      const a = 0.35;
      for (let k = 1; k <= 5; k++) { const m = box(k % 2 ? 1.1 : 2, 0.16, 0.1, 0x6f8098, { edges: false, shadow: false }); m.rotation.y = a; at(m, Math.sin(a) * (r + 0.05), h * k / 6.5, Math.cos(a) * (r + 0.05), g); }
      return { g, r, h };
    }
    // электроплитка
    function hotplate(parent, x, z, o = {}) {
      const w = o.w || 26, dd = o.d || 22, hb = 5, R = o.r || 9.5, g = new T.Group(); at(g, x, TY, z, parent);
      for (const [fx, fz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) at(cyl(1, 0.8, C.DARK, { edges: false }), fx * (w / 2 - 2.2), 0.4, fz * (dd / 2 - 2.2), g);
      at(box(w, hb, dd, 0x3b4a66), 0, 0.8 + hb / 2, 0, g);
      const top = 0.8 + hb;
      at(cyl(R, 1.0, 0x2c3240), 0, top + 0.5, 0, g);
      const ringMat = keep(new T.MeshBasicMaterial({ color: o.on ? 0xff5a2a : 0x454e62 }));
      [R * 0.4, R * 0.7].forEach(rr => { const tr = new T.Mesh(keep(new T.TorusGeometry(rr, 0.26, 6, 36)), ringMat); tr.rotation.x = Math.PI / 2; at(tr, 0, top + 1.02, 0, g); });
      const lamp = new T.Mesh(keep(new T.SphereGeometry(0.8, 12, 8)), keep(new T.MeshBasicMaterial({ color: o.on ? 0xff4a3a : 0x5a2a2a })));
      at(lamp, -w / 2 + 3, 0.8 + hb * 0.55, dd / 2 + 0.2, g);
      const knob = cyl(1.3, 1.2, 0xe2e7ee, { seg: 16 }); knob.rotation.x = Math.PI / 2; at(knob, w / 2 - 3.4, 0.8 + hb * 0.55, dd / 2 + 0.5, g);
      if (o.on) { at(glow(0xff6a2a, R * 3, 0.4), 0, top + 2, 0, g); at(new T.PointLight(0xff7a3a, 18, 40, 1.4), 0, top + 3, 0, g); }
      return { g, top: TY + top + 1.0, w, dd };
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
      const wall = new T.Mesh(geo, glassMat(0xd8eef8, 0.3)); g.add(wall); wall.add(new T.Mesh(geo, gHull));
      const lm = ownMat(o.color ?? 0xcfe2f0, { transparent: true, opacity: o.op ?? 0.7, depthWrite: false });
      const ri = r - 0.3;
      const bot = new T.Mesh(keep(new T.SphereGeometry(ri, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), lm); at(bot, 0, r, 0, g);
      const body = new T.Mesh(keep(new T.CylinderGeometry(ri, ri, 1, 24)), lm); at(body, 0, r, 0, g);
      const set = lv => { bot.visible = lv > 0.3; const hb = lv - r; body.visible = hb > 0.05; if (body.visible) { body.scale.y = hb; body.position.y = r + hb / 2; } };
      set(o.level ?? 0);
      return { g, r, h, ri, mat: lm, set };
    }
    // склянка с раствором и этикеткой (cap — пробка или резиновая груша пипетки)
    function bottle(parent, x, z, col, label, o = {}) {
      const g = new T.Group(); at(g, x, TY, z, parent);
      const r = o.r || 3.6, hh = o.h || 10;
      const wall = new T.Mesh(keep(new T.CylinderGeometry(r, r, hh, 28, 1, true)), glassMat(o.brown ? 0x9a6a3a : 0xd8eef8, o.brown ? 0.55 : 0.3)); at(wall, 0, hh / 2, 0, g); wall.add(new T.Mesh(wall.geometry, gHull));
      at(cyl(r, 1.6, 0xd8eef8, { r2: 1.4, edges: false, matOpt: { transparent: true, opacity: 0.4 } }), 0, hh + 0.8, 0, g);
      if (o.dropper) {
        at(cyl(1.5, 1.2, 0x2c3240, { seg: 16 }), 0, hh + 2.0, 0, g);
        at(cyl(0.45, 6, 0xeef6fb, { edges: false, matOpt: { transparent: true, opacity: 0.6 } }), 0, hh + 1, 0, g);
        const bulb = mesh(new T.SphereGeometry(1.5, 16, 12), 0xc0504d, { hull: true, edges: false }); bulb.scale.y = 1.5; at(bulb, 0, hh + 4.2, 0, g);
      } else at(cyl(1.6, 1.8, o.cap || 0x2c3240, { seg: 16 }), 0, hh + 2.4, 0, g);
      if (col != null) { const lq = cyl(r - 0.35, hh * 0.72, col, { edges: false, hull: false, matOpt: { transparent: true, opacity: o.op ?? 0.8 } }); at(lq, 0, 0.3 + hh * 0.36, 0, g); }
      if (label) { const lb = canvasPlane(r * 1.7, hh * 0.38, 200, 96, (x, a, b) => textLines(x, a, b, [label], '#1b1610', '#fff6e6')); at(lb, 0, hh * 0.45, r + 0.06, g); }
      return { g, top: TY + hh + (o.dropper ? 6.5 : 3.3) };
    }
    // банка с крышкой (порошок, кусочки)
    function jar(parent, x, z, r, hh, o = {}) {
      const g = new T.Group(); at(g, x, TY, z, parent);
      const wall = new T.Mesh(keep(new T.CylinderGeometry(r, r, hh, 28, 1, true)), glassMat(0xd8eef8, 0.3)); at(wall, 0, hh / 2, 0, g); wall.add(new T.Mesh(wall.geometry, gHull));
      at(cyl(r, 0.5, 0xd8eef8, { edges: false, matOpt: { transparent: true, opacity: 0.4 } }), 0, 0.25, 0, g);
      if (o.liq != null) at(cyl(r - 0.3, hh * (o.liqH || 0.62), o.liq, { edges: false, hull: false, matOpt: { transparent: true, opacity: o.liqOp ?? 0.35, depthWrite: false } }), 0, 0.5 + hh * (o.liqH || 0.62) / 2, 0, g);
      if (o.lid !== false) at(cyl(r + 0.4, 1.6, o.lid || 0x3a4762, { seg: 24 }), 0, hh + 0.8, 0, g);
      return { g, top: TY + hh + 1.6 };
    }
    function key(parent, x, z, w, d, label, color, keyName, fg = '#ffffff') {
      const b = new T.Group(); at(b, x, TY, z, parent);
      at(box(w, 1.6, d, color), 0, 0.8, 0, b);
      const top = canvasPlane(w * 0.92, d * 0.8, Math.round(70 * w / d * 1.4), 112, (cx, a, bb) => textLines(cx, a, bb, [label], fg, '#' + color.toString(16).padStart(6, '0')));
      top.rotation.x = -Math.PI / 2; at(top, 0, 1.62, 0, b);
      clickable(b, keyName); return b;
    }
    // штатив для пробирок: основание, две стойки, верхняя планка с прорезями
    function rack(parent, x, z, xs, r) {
      const w = (Math.max(...xs) - Math.min(...xs)) + 4 * r + 6, cx = (Math.max(...xs) + Math.min(...xs)) / 2;
      const g = new T.Group(); at(g, x + cx, TY, z, parent);
      at(box(w, 1.4, 11, C.WOOD), 0, 0.7, 0, g);
      at(box(1.6, 15, 3, C.WOOD2), -w / 2 + 0.8, 7.5, 0, g); at(box(1.6, 15, 3, C.WOOD2), w / 2 - 0.8, 7.5, 0, g);
      const yb = 14;
      at(box(w, 1.2, 3, C.WOOD), 0, yb, -(r + 1.6), g); at(box(w, 1.2, 3, C.WOOD), 0, yb, r + 1.6, g);
      const lx = [-w / 2, ...xs.map(v => v - cx), w / 2];
      for (let i = 0; i < lx.length - 1; i++) { const a = lx[i] + (i ? r + 0.4 : 0), b = lx[i + 1] - (i < lx.length - 2 ? r + 0.4 : 0); if (b - a > 0.3) at(box(b - a, 1.2, 2 * r + 0.4, C.WOOD), (a + b) / 2, yb, 0, g); }
      return { g, yTop: TY + yb + 0.6, front: z + r + 3.1, cx: x + cx };
    }
    // хлопья осадка внутри пробирки (локально в её группе)
    function flakesIn(parent, n, ri, ylo, yhi, col, seed) {
      const arr = [];
      for (let i = 0; i < n; i++) {
        const f = box(0.95, 0.5, 0.95, col, { edges: false, shadow: false }); f.rotation.set(rnd(seed + i) * 3, rnd(seed + i + 4) * 3, 0);
        const a = rnd(seed + i + 7) * 6.28, rr = Math.sqrt(rnd(seed + i + 50)) * (ri - 0.7), y = ylo + (yhi - ylo) * Math.pow(rnd(seed + i + 90), 1.7);
        at(f, Math.cos(a) * rr, y, Math.sin(a) * rr, parent); arr.push({ f, y, ph: rnd(seed + i + 30) * 6.28 });
      }
      return arr;
    }
    // пипетка над пробиркой: капля падает в раствор
    function dropAnim(parent, x, yTip, z, yLiq, col) {
      const g = new T.Group(); at(g, x, yTip, z, parent);
      at(cyl(0.55, 9, 0xeef6fb, { r2: 0.25, edges: false, matOpt: { transparent: true, opacity: 0.55 } }), 0, 4.5, 0, g);
      at(cyl(0.38, 5, col, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.8 } }), 0, 3.5, 0, g);
      const bulb = mesh(new T.SphereGeometry(1.4, 16, 12), 0xc0504d, { hull: true, edges: false }); bulb.scale.y = 1.6; at(bulb, 0, 10.6, 0, g);
      const drop = mesh(new T.SphereGeometry(0.55, 12, 8), col, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.9 } }); at(drop, 0, 0, 0, g);
      let t0 = null;
      g.visible = !kit.reduce;
      kit.onFrame((dt, t) => {
        if (kit.reduce) return;
        if (t0 == null) t0 = t;
        const k = t - t0;
        g.visible = k < 1.5;
        bulb.scale.set(1 - 0.25 * Math.sin(Math.PI * clamp(k / 0.5, 0, 1)), 1.6, 1);
        const f = clamp((k - 0.35) / 0.4, 0, 1); drop.visible = k > 0.25 && f < 1;
        drop.position.y = -(yTip - yLiq) * f * f;
      });
      return g;
    }
    const ring = (parent, x, z, r, col = 0xffd166, y = TY) => { const m = cyl(r, 0.3, col, { edges: false, hull: false, shadow: false }); return at(m, x, y + 0.15, z, parent); };
    // кольцо-подсветка вокруг выбранной пробирки
    const halo = (parent, x, y, z, r) => { const m = new T.Mesh(keep(new T.TorusGeometry(r, 0.45, 8, 32)), keep(new T.MeshBasicMaterial({ color: 0xffd166 }))); m.rotation.x = Math.PI / 2; return at(m, x, y, z, parent); };
    return { v3, v2, gHull, glassMat, ownMat, spr, glow, rodAB, canvasPlane, textLines, plate, screen, flame, steam, bubbles, beaker, hotplate, tray, tube, bottle, jar, key, rack, flakesIn, dropAnim, ring, halo };
  }
  const mixC = (T, a, b, t) => new T.Color(hexN(a)).lerp(new T.Color(hexN(b)), clamp(t, 0, 1));
  // подпись, значение которой меняется на лету (кипячение, окисление)
  function liveTag(kit, p, name, value, hot) {
    kit.tag(p, name, value || ' ', hot);
    const els = document.querySelectorAll('.rl-lbl'), el = els[els.length - 1];
    let cur = value;
    return v => { if (v === cur || !el) return; cur = v; const i = el.querySelector('i'); if (i) i.textContent = v; };
  }
  // спиртовка
  function spiritLamp(kit, h, g, x, z) {
    const { T, at, cyl, mesh, C } = kit;
    const bg = new T.Group(); at(bg, x, TY, z, g);
    const body = mesh(new T.SphereGeometry(6, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.62), 0xd8eef8, { mat: h.glassMat(0xd8eef8, 0.35), hull: true, edges: false }); body.scale.y = 0.9; at(body, 0, 4.2, 0, bg);
    at(cyl(5.6, 4.4, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.35 } }), 0, 2.2, 0, bg);
    at(cyl(4.6, 3.6, 0xbfe0f5, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.6 } }), 0, 2.2, 0, bg);
    at(cyl(2.2, 2.4, C.STEEL), 0, 9.6, 0, bg); at(cyl(0.7, 1.6, 0xf2ead2, { edges: false }), 0, 11.4, 0, bg);
    return TY + 12;
  }

  // ===== 1. Щелочные металлы: кристаллизатор с водой и фенолфталеином, банки с Li/Na/K под керосином, окраска пламени =====
  const FLAME = { Li: ['#ffd0dc', '#e0204a', 0xff3060], Na: ['#fff6c0', '#ffb300', 0xffc020], K: ['#f0e2ff', '#9a5cff', 0xb07cff] };
  SC['chme-alkali'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const info = {}; d.info.forEach(x => { info[x.k] = x; });
    // кристаллизатор
    const DX = -8, DZ = 7, R = 25, DH = 9, WL = 5.6;
    const dg = new T.Group(); at(dg, DX, TY, DZ, g);
    const wall = new T.Mesh(keep(new T.CylinderGeometry(R, R * 0.97, DH, 64, 1, true)), h.glassMat(0xd8eef8, 0.24)); at(wall, 0, DH / 2, 0, dg); wall.add(new T.Mesh(wall.geometry, h.gHull));
    at(cyl(R * 0.97, 0.5, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.45 } }), 0, 0.25, 0, dg);
    const rim = mesh(new T.TorusGeometry(R, 0.3, 6, 64), 0xeef6fb, { edges: false, shadow: false }); rim.rotation.x = Math.PI / 2; at(rim, 0, DH, 0, dg);
    const wMat = h.ownMat(0xbfe0f4, { transparent: true, opacity: 0.45, depthWrite: false });
    at(new T.Mesh(keep(new T.CylinderGeometry(R - 0.5, R * 0.97 - 0.5, WL, 64)), wMat), 0, 0.5 + WL / 2, 0, dg);
    const ySurf = 0.5 + WL + 0.05;
    // кусочек металла и его «хвост»
    const busy = d.busy, pc = new T.Group(); at(pc, 0, ySurf, 0, dg); pc.visible = !!busy;
    let lump = null;
    if (busy === 'Li') { lump = box(3.2, 1.7, 2.7, 0xcfd5de); at(lump, 0, 0.4, 0, pc); }
    else if (busy) { lump = mesh(new T.SphereGeometry(2.1, 20, 14), 0xeef1f6, { hull: true, edges: false }); at(lump, 0, 0.8, 0, pc); }
    const pinkMat = keep(new T.MeshBasicMaterial({ color: 0xe0368f, transparent: true, opacity: 0.4, depthWrite: false }));
    const trail = new T.Mesh(keep(new T.CircleGeometry(1, 32)), pinkMat); trail.rotation.x = -Math.PI / 2; at(trail, 0, ySurf + 0.02, 0, dg); trail.visible = !!busy;
    const rip = new T.Mesh(keep(new T.TorusGeometry(1, 0.08, 4, 40)), keep(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }))); rip.rotation.x = Math.PI / 2; at(rip, 0, 0.05, 0, pc);
    const fizz = h.steam(pc, 0, 0.8, 0, { n: 7, spread: 3, size: 2.2, rise: 6, op: 0.6, amt: busy ? 1 : 0, speed: 1.4 });
    let kFlame = null, kLight = null;
    if (busy === 'K') { kFlame = h.flame(pc, 0, 1.4, 0, 9, FLAME.K[0], FLAME.K[1], FLAME.K[2]); kLight = new T.PointLight(0xb07cff, 30, 50, 1.4); at(kLight, 0, 5, 0, pc); }
    const L0 = live() || {};
    kit.onFrame((dt, t) => {
      const Lv = live() || L0, p = busy ? (Lv.p ?? 0) : 0, s = kit.reduce ? 0.6 : t;
      const pinkNow = Math.min(1, (d.pink || 0) + (busy ? 0.34 * p : 0));
      const pk = Math.min(1, pinkNow * 2.4); wMat.color.copy(mixC(T, 0xbfe0f4, 0xe0368f, pk * 0.92)); wMat.opacity = 0.45 + 0.33 * pk;
      if (!busy) return;
      let x, z;
      if (busy === 'Li') { x = 3 * Math.sin(s * 1.4); z = 2.5 * Math.cos(s * 1.1); }
      else if (busy === 'Na') { x = 13 * Math.sin(s * 3.8) * Math.cos(s * 2.4); z = 9 * Math.sin(s * 2.9); }
      else { x = 15 * Math.sin(s * 5.9); z = 11 * Math.sin(s * 4.3 + 1); }
      pc.position.set(x, ySurf, z);
      const sz = Math.max(0.25, 1 - p * 0.85); lump.scale.setScalar(sz); lump.rotation.y = s * (busy === 'Li' ? 0.6 : 3);
      trail.position.set(x, ySurf + 0.02, z); trail.scale.setScalar(2.5 + 9 * p); pinkMat.opacity = 0.25 + 0.2 * Math.sin(Math.PI * p);
      const rp = kit.reduce ? 0.5 : (t * 1.8) % 1; rip.scale.setScalar(1.5 + 4 * rp); rip.material.opacity = 0.6 * (1 - rp);
      fizz.set(p < 1 ? 1 : 0);
      if (kFlame) { kFlame.userData.size(0.5 + 0.5 * sz); kLight.intensity = 30 * sz; }
    });
    // банки с металлами под керосином
    const JX = { Li: -48, Na: -33, K: -18 }, JZ = -29;
    Object.keys(JX).forEach((k, i) => {
      const jg = new T.Group(); at(jg, JX[k], 0, JZ, g); clickable(jg, k);
      h.jar(jg, 0, 0, 5.6, 10, { liq: 0xe7c873, liqOp: 0.3, liqH: 0.7, lid: 0x8a95a8 });
      for (let q = 0; q < 3; q++) { const pcs = box(1.8 - q * 0.2, 1.2, 1.6, info[k].piece, { edges: true }); pcs.rotation.y = rnd(i * 5 + q) * 3; at(pcs, (rnd(i + q * 3) - 0.5) * 4, TY + 1.2 + (q === 2 ? 1.2 : 0), (rnd(i + q * 7) - 0.5) * 4, jg); }
      const ok = d.tested.includes(k), cur = busy === k;
      const lb = h.plate(7.6, 3.6, [{ t: (ok ? '✓ ' : '') + k, k: 0.7 }], '#1b1610', cur ? '#ffd166' : ok ? '#86e0a8' : '#fff6e6'); at(lb, 0, TY + 5.4, 5.7, jg);
      if (cur) h.ring(jg, 0, 0, 6.8);
    });
    // спиртовка с проволочкой: окраска пламени последнего металла
    const fk = busy || d.last, LX = 34, LZ = -14;
    const fy = spiritLamp(kit, h, g, LX, LZ);
    const fc = fk ? FLAME[fk] : ['#d8f0ff', '#4a9cff', 0x6ab0ff];
    h.flame(g, LX, fy, LZ, fk ? 11 : 8, fc[0], fc[1], fc[2]);
    if (fk) at(new T.PointLight(fc[2], 24, 50, 1.4), LX, fy + 6, LZ, g);
    const loopP = v3(LX - 0.4, fy + 3.2, LZ);
    const hand = v3(LX + 20, TY + 4, LZ + 14);
    h.rodAB(g, hand, loopP, 0.16, 0xb8bec8, { hull: false });
    const lp = mesh(new T.TorusGeometry(0.8, 0.16, 6, 20), 0xb8bec8, { edges: false }); at(lp, loopP.x, loopP.y, loopP.z, g);
    const handle = h.rodAB(g, hand, v3(LX + 30, TY + 1.4, LZ + 21), 0.8, C.WOOD2, { hull: true });
    at(box(5, 2.6, 4, 0x3b4a66), LX + 30, TY + 1.3, LZ + 21, g);
    if (fk) at(h.glow(fc[2], 6, 0.6), loopP.x, loopP.y, loopP.z, g);
    // клавиши
    ['Li', 'Na', 'K'].forEach((k, i) => h.key(g, -44 + i * 11, 37, 9.5, 5.4, k, d.tested.includes(k) ? 0x2f9e55 : 0x3b4a66, k));
    h.key(g, 44, 37, 18, 5.4, 'свежая вода', 0x5d6b88, 'water');
    // подписи
    const cur = busy ? info[busy] : null;
    tag(v3(DX + 34, TY + 3, DZ + 20), 'Вода + фенолфталеин', cur ? cur.how : d.pink > 0 ? 'малиновая: щёлочь ' + (info[d.last] ? info[d.last].hyd : '') : 'бесцветная', !!busy);
    tag(v3(-33, TY + 17, JZ), 'Li · Na · K под керосином', busy ? 'реагирует ' + busy : 'проверено ' + d.tested.length + ' из 3 · нажмите', false);
    tag(v3(LX, fy + 16, LZ), 'Окраска пламени', fk ? fk + ': ' + info[fk].flame : 'пламя спиртовки', false);
  };

  // ===== 2. Жёсткая вода: стакан с ионами на плитке, мыло, сода, тестер жёсткости =====
  SC['chme-hard'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, clickable } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const PX = -4, PZ = 0;
    const hp = h.hotplate(g, PX, PZ, { w: 32, d: 28, r: 13, on: d.heat }); clickable(hp.g, 'plate');
    const R = 12, BH = 28, WL = 21, y0 = hp.top;
    const bk = h.beaker(g, PX, y0, PZ, R, BH);
    const wMat = h.ownMat(0xcfe8f6, { transparent: true, opacity: 0.38, depthWrite: false });
    at(new T.Mesh(keep(new T.CylinderGeometry(R - 0.45, R * 0.97 - 0.45, WL, 40)), wMat), 0, 0.6 + WL / 2, 0, bk.g);
    // ионы Ca²⁺ (оранжевые) и Mg²⁺ (зелёные)
    const sph = keep(new T.SphereGeometry(0.85, 14, 10)), ions = [];
    for (let i = 0; i < 16; i++) {
      const isMg = i >= 12, m = new T.Mesh(sph, kit.toon(isMg ? 0x3fbf7a : 0xffa53a)); m.add(new T.Mesh(sph, kit.hullMat));
      const a = rnd(i + 3) * 6.28, rr = Math.sqrt(rnd(i + 5)) * (R - 2.5);
      ions.push({ m, isMg, idx: isMg ? i - 12 : i, x: Math.cos(a) * rr, z: Math.sin(a) * rr, y: 4 + rnd(i + 8) * (WL - 7), ph: rnd(i + 9) * 6.28 });
      at(m, 0, 0, 0, bk.g);
    }
    // накипь CaCO₃ на дне
    const sed = cyl(R - 0.7, 1, 0xf4f6f8, { edges: false, hull: false }); at(sed, 0, 0.6, 0, bk.g);
    const bub = h.bubbles(bk.g, 0, 0.8, 0, R - 2.5, 20);
    const st = h.steam(g, PX, y0 + BH, PZ, { n: 8, spread: 10, size: 5, rise: 16, op: 0.5, amt: d.heat ? 1 : 0 });
    // мыльная проба: пена или хлопья
    const foam = [], flk = [];
    if (d.soap) {
      for (let i = 0; i < 14; i++) { const f = mesh(new T.SphereGeometry(1.6, 12, 10), 0xfafcff, { hull: true, edges: false }); const a = rnd(i + 40) * 6.28, rr = Math.sqrt(rnd(i + 41)) * (R - 2.6); at(f, Math.cos(a) * rr, 0, Math.sin(a) * rr, bk.g); foam.push({ f, ph: rnd(i + 42) * 6.28, dy: rnd(i + 43) }); }
      for (let i = 0; i < 18; i++) { const f = box(1.4, 0.4, 1.0, 0xa9b2bf, { edges: false }); f.rotation.set(rnd(i + 60) * 3, rnd(i + 61) * 3, 0); const a = rnd(i + 62) * 6.28, rr = Math.sqrt(rnd(i + 63)) * (R - 2.2); at(f, Math.cos(a) * rr, WL - 1.5 - rnd(i + 64) * 6, Math.sin(a) * rr, bk.g); flk.push({ f, ph: rnd(i + 65) * 6.28, y: 0 }); flk[i].y = flk[i].f.position.y; }
    }
    // мыльный раствор
    const sb = new T.Group(); g.add(sb); clickable(sb, 'soap');
    h.bottle(sb, -42, -8, 0xe9d27a, 'мыло', { r: 4.2, h: 12, dropper: true, op: 0.6 });
    // сода с ложкой
    const jg = new T.Group(); g.add(jg); clickable(jg, 'soda');
    const SX = 34, SZ = -12;
    h.jar(jg, SX, SZ, 5.5, 9, { lid: false });
    at(cyl(5.1, 5.5, 0xf6f7f9, { edges: false, hull: false }), SX, TY + 3.2, SZ, jg);
    const heap = cyl(5, 2.2, 0xf6f7f9, { r2: 1.2, edges: false }); at(heap, SX, TY + 7, SZ, jg);
    h.rodAB(jg, v3(SX + 1, TY + 7.5, SZ), v3(SX + 8, TY + 15, SZ + 3), 0.4, 0xb8bec8, { hull: true });
    const lb = h.plate(8, 3, ['Na₂CO₃']); at(lb, SX, TY + 4.2, SZ + 5.6, jg);
    // тестер жёсткости
    const tg = new T.Group(); at(tg, 34, TY, 18, g);
    at(box(14, 1.2, 9, 0x3b4a66), 0, 0.6, 0, tg);
    at(box(12, 10, 4, 0x34405a), 0, 6.2, -1.5, tg);
    at(cyl(0.5, 7, 0xb8bec8, { edges: false }), 4.5, 14, -1.5, tg);
    at(box(1.6, 2, 1.6, 0x34405a), 4.5, 11.6, -1.5, tg);
    const scr = h.screen(10.4, 6, '', '#86e0a8', 300, 172, '#0c1a14'); at(scr, 0, 6.6, 0.56, tg);
    // клавиши
    h.key(g, -32, 37, 18, 5.4, d.heat ? 'выключить' : 'кипятить', d.heat ? 0xc0504d : 0xe07a2e, 'plate');
    h.key(g, -12, 37, 18, 5.4, '+0,5 ммоль соды', 0x5d6b88, 'soda');
    h.key(g, 46, 37, 14, 5.4, 'заново', 0x5d6b88, 'reset');
    const L0 = live() || {};
    const tB = liveTag(kit, v3(PX, y0 + BH + 4, PZ), '1 л воды', ' ', false);
    const tP = liveTag(kit, v3(PX - 14, TY + 9, PZ + 14), 'Плитка', ' ', d.heat);
    kit.tag(v3(-42, TY + 22, -8), 'Мыльный раствор', d.soap ? 'капнули в стакан' : 'нажмите — капнуть');
    kit.tag(v3(SX, TY + 19, SZ), 'Сода Na₂CO₃', fmt(d.soda, 1) + ' ммоль из 2');
    kit.onFrame((dt, t) => {
      const Lv = live() || L0, Hh = Lv.H ?? d.H ?? 4, Ca = Lv.Ca ?? 3, Mg = Lv.Mg ?? 1, f = Lv.f ?? d.f ?? 0, rem = Lv.removed ?? 0, s = kit.reduce ? 0 : t;
      const nCa = Math.round(Ca * 4), nMg = Math.round(Mg * 4);
      const amp = d.heat ? 1.2 : 0.5, sp = d.heat ? 2.2 : 0.6;
      ions.forEach(o => {
        o.m.visible = o.idx < (o.isMg ? nMg : nCa);
        if (o.m.visible) o.m.position.set(o.x + amp * Math.sin(s * sp + o.ph), o.y + amp * Math.cos(s * sp * 0.8 + o.ph), o.z + amp * Math.sin(s * sp * 0.7 + o.ph * 2));
      });
      const sh = rem > 0 ? 0.3 + rem * 0.5 : 0; sed.visible = sh > 0; sed.scale.y = Math.max(0.05, sh); sed.position.y = 0.6 + Math.max(0.05, sh) / 2;
      bub.set(d.heat ? 1 : 0, WL, 0.75, 1.5);
      const soft = 1 - Hh / 4;
      foam.forEach((q, i) => { const on = i < Math.round(2 + 12 * soft); q.f.visible = on; q.f.scale.setScalar(0.6 + 0.6 * soft + 0.1 * Math.sin(s * 2 + q.ph)); q.f.position.y = WL + 0.8 + q.dy * 1.4 * soft; });
      flk.forEach((q, i) => { q.f.visible = i < Math.round(Hh * 4.5); q.f.position.y = q.y + 0.4 * Math.sin(s * 0.8 + q.ph); });
      wMat.opacity = 0.38 + (d.soap ? 0.12 * Hh / 4 : 0);
      scr.userData.set('жёсткость\n' + fmt(Hh, 1) + ' ммоль/л', Hh < 1e-9 ? '#86e0a8' : '#ffb547');
      tB(d.soap ? (Hh > 1e-9 ? 'мыло: серые хлопья' : 'мыло: пышная пена') : 'Ca²⁺ ' + fmt(Ca, 1) + ' · Mg²⁺ ' + fmt(Mg, 1) + ' ммоль');
      tP(d.heat ? 'кипит · ' + Math.round(f * 100) + ' %' : f >= 1 ? 'прокипячено — накипь CaCO₃' : 'нажмите — кипятить');
    });
  };

  // ===== 3. Алюминий: две пробирки с AlCl₃ в штативе, склянки NaOH и HCl с пипетками, Al + кислота/щёлочь =====
  SC['chme-al'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const TX = [-14, 14], TZ = 0, R = 3.4, TH = 30, y0 = TY + 1.4;
    const rk = h.rack(g, 0, TZ, TX, R);
    const prev = memo.al; memo.al = d.t.map(x => ({ naoh: x.naoh, hcl: x.hcl }));
    d.t.forEach((x, i) => {
      const lvl = Math.min(TH - 4, 9 + (x.naoh + x.hcl) * 1.5);
      const col = mixC(T, 0xdfe8f2, 0xf7f9fb, x.precip).getHex();
      const tb = h.tube(g, TX[i], y0, TZ, R, TH, { color: col, op: 0.3 + 0.45 * x.precip, level: lvl });
      clickable(tb.g, 'tube' + i);
      const fl = h.flakesIn(tb.g, Math.round(x.precip * 40), tb.ri, 1.2, Math.max(2, lvl * (0.45 + 0.4 * x.precip)), 0xf4f7fa, i * 31);
      if (x.precip > 0.01) at(cyl(tb.ri - 0.1, lvl * 0.7, 0xffffff, { edges: false, hull: false, shadow: false, matOpt: { transparent: true, opacity: 0.25 + 0.45 * x.precip, depthWrite: false } }), 0, R + lvl * 0.35 - 1.6, 0, tb.g);
      if (!kit.reduce) kit.onFrame((dt, t) => fl.forEach(q => { q.f.position.y = q.y + 0.25 * Math.sin(t * 0.9 + q.ph); }));
      if (d.sel === i) h.halo(g, TX[i], rk.yTop + 0.3, TZ, R + 0.9);
      // плашка с порциями на штативе
      const pl = h.plate(10.5, 3.6, [{ t: 'NaOH ' + fmt(x.naoh, 1), c: '#1f5fa8' }, { t: 'HCl ' + fmt(x.hcl, 1), c: '#b5422e' }], '#1b1610', '#fff6e6', 200);
      at(pl, TX[i], TY + 0.7, rk.front + 0.06, g);
      if (x.peak) { const st = h.plate(3, 3, [{ t: '★', k: 0.9, c: '#e0a000' }], '#1b1610', 'rgba(0,0,0,0)', 64); at(st, TX[i] + R + 2.2, y0 + TH - 2, TZ + 0.5, g); }
      // кнопки порций
      h.key(g, TX[i] - 5.6, 25, 10, 4.6, '+NaOH', 0x3b6fb0, 'naoh-' + i);
      h.key(g, TX[i] + 5.6, 25, 10, 4.6, '+HCl', 0xb5503e, 'hcl-' + i);
      // капля из пипетки — в ту пробирку, куда только что добавили
      if (prev && prev[i]) {
        const which = x.naoh > prev[i].naoh ? 'naoh' : x.hcl > prev[i].hcl ? 'hcl' : null;
        if (which) h.dropAnim(g, TX[i], y0 + TH + 3, TZ, y0 + lvl, which === 'naoh' ? 0xcfe4f5 : 0xeef2f6);
      }
      const st = x.b <= 0 ? 'раствор AlCl₃' : x.b < 3 ? 'Al(OH)₃↓ растёт' : Math.abs(x.b - 3) < 1e-9 ? 'Al(OH)₃↓ — больше всего' : x.b < 4 ? 'осадок растворяется' : 'Na[Al(OH)₄] — прозрачно';
      tag(v3(TX[i], y0 + TH + 4, TZ), 'Пробирка ' + (i + 1) + (x.peak ? ' ★' : ''), st, d.sel === i);
    });
    // склянки с пипетками
    const nb = new T.Group(); g.add(nb); clickable(nb, 'naoh');
    h.bottle(nb, -42, 6, 0xcfe4f5, 'NaOH', { r: 4.4, h: 12, dropper: true, op: 0.55 });
    const hb = new T.Group(); g.add(hb); clickable(hb, 'hcl');
    h.bottle(hb, 42, 6, 0xeef2f6, 'HCl', { r: 4.4, h: 12, dropper: true, op: 0.5 });
    tag(v3(-42, TY + 24, 6), 'NaOH', 'нажмите — в пробирку ' + (d.sel + 1));
    tag(v3(42, TY + 24, 6), 'HCl', 'нажмите — в пробирку ' + (d.sel + 1));
    // сзади: гранулы Al в кислоте и в щёлочи — в обеих водород
    const bx = 34, bz = -27;
    at(box(26, 1.2, 8, 0x3b4a66), bx, TY + 0.6, bz, g);
    [['HCl', 0xeef2f6, -6], ['NaOH', 0xcfe4f5, 6]].forEach(([nm, c, ox], i) => {
      const tb = h.tube(g, bx + ox, TY + 1.2, bz, 2.4, 17, { color: c, op: 0.5, level: 10 });
      const gr = mesh(new T.IcosahedronGeometry(1.1, 0), 0xc8d0da, { edgeAngle: 20 }); at(gr, 0.2, 1.6, 0, tb.g);
      const bb = h.bubbles(tb.g, 0, 1.4, 0, 1.0, 10); bb.set(1, 9.6, 0.35, 0.9);
      const lp = h.plate(9, 2.6, ['Al + ' + nm]); lp.rotation.x = -0.5; at(lp, bx + ox, TY + 1.6, bz + 5.2, g);
    });
    tag(v3(bx, TY + 22, bz), 'Al + кислота / Al + щёлочь', 'в обеих H₂↑');
    h.key(g, 46, 38, 14, 5.4, 'заново', 0x5d6b88, 'reset');
  };

  // ===== 4. Железо: три пробирки А, Б, В, NaOH с пипеткой, таблички-подписи, справочные качественные реакции =====
  SC['chme-fe'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const TX = [-22, 0, 22], TZ = -4, R = 3.4, TH = 30, y0 = TY + 1.4, LET = ['А', 'Б', 'В'];
    const rk = h.rack(g, 0, TZ, TX, R);
    const prev = memo.fe; memo.fe = d.t.map(x => x.dose);
    const oxs = [];
    d.t.forEach((x, i) => {
      const lvl = Math.min(TH - 4, 11 + x.dose * 1.6);
      const tb = h.tube(g, TX[i], y0, TZ, R, TH, { color: hexN(x.sol), op: x.solOp + 0.25, level: lvl });
      clickable(tb.g, 'tube' + i);
      if (x.precip) {
        const fl = h.flakesIn(tb.g, 34, tb.ri, 1.2, lvl * 0.75, hexN(x.pr), i * 23);
        // взвесь
        at(cyl(tb.ri - 0.1, lvl * 0.6, hexN(x.pr), { edges: false, hull: false, shadow: false, matOpt: { transparent: true, opacity: 0.35, depthWrite: false } }), 0, R + lvl * 0.3 - 1, 0, tb.g);
        if (!kit.reduce) kit.onFrame((dt, t) => fl.forEach(q => { q.f.position.y = q.y + 0.25 * Math.sin(t * 0.9 + q.ph); }));
        if (x.ion === 'fe2') { // Fe(OH)₂ сверху буреет на воздухе
          const ox = cyl(tb.ri - 0.05, 1, 0x8b4513, { edges: false, hull: false, shadow: false, matOpt: { transparent: true, opacity: 0.3, depthWrite: false } });
          at(ox, 0, lvl, 0, tb.g); ox.visible = false; oxs.push({ i, ox, lvl });
        }
      }
      if (d.sel === i) h.halo(g, TX[i], rk.yTop + 0.3, TZ, R + 0.9);
      const lt = h.plate(4, 3.4, [{ t: LET[i], k: 0.8 }], '#1b1610', '#fff6e6', 80); at(lt, TX[i], TY + 0.8, rk.front + 0.06, g);
      // табличка-подпись (нажать — сменить)
      h.key(g, TX[i], 14, 12, 5, x.label ? x.labelName : '?', x.label ? (d.ok ? 0x2f9e55 : 0xfff6e6) : 0x3b4a66, 'lab' + i, x.label && !d.ok ? '#1b1610' : '#ffffff');
      h.key(g, TX[i], 25, 12, 4.6, '+NaOH', 0x3b6fb0, 'naoh-' + i);
      if (prev && x.dose > prev[i]) h.dropAnim(g, TX[i], y0 + TH + 3, TZ, y0 + lvl, 0xcfe4f5);
      tag(v3(TX[i], y0 + TH + 4, TZ), 'Пробирка ' + LET[i], x.dose > 0 ? x.obsShort : x.solShort, d.sel === i || d.ok);
    });
    if (oxs.length) kit.onFrame(() => {
      const Lv = live() || {}, oxa = Lv.ox || [];
      oxs.forEach(o => { const k = oxa[o.i] || 0; o.ox.visible = k > 0.02; const hh = 1 + 6 * k; o.ox.scale.y = hh; o.ox.position.y = o.lvl - hh / 2; o.ox.material.opacity = 0.25 + 0.5 * k; });
    });
    // NaOH с пипеткой
    const nb = new T.Group(); g.add(nb); clickable(nb, 'naoh');
    h.bottle(nb, -46, 8, 0xcfe4f5, 'NaOH', { r: 4.4, h: 12, dropper: true, op: 0.55 });
    tag(v3(-46, TY + 24, 8), 'NaOH', 'нажмите — в пробирку ' + LET[d.sel]);
    // справочный штатив: качественные реакции
    const bx = 38, bz = -29, refs = [[0xb0102a, 'Fe³⁺+KSCN'], [0x1d3c9e, 'Fe²⁺+K₃[Fe(CN)₆]'], [0x21409c, 'Fe³⁺+K₄[Fe(CN)₆]']];
    at(box(30, 1.2, 8, 0x3b4a66), bx, TY + 0.6, bz, g);
    refs.forEach(([c, nm], i) => {
      const x = bx - 9.5 + i * 9.5;
      h.tube(g, x, TY + 1.2, bz, 2.2, 15, { color: c, op: 0.88, level: 9 });
      const lp = h.plate(9, 2.4, [nm], '#1b1610', '#fff6e6', 260); lp.rotation.x = -0.6; at(lp, x, TY + 1.5, bz + 5, g);
    });
    tag(v3(bx + 8, TY + 17, bz), 'Качественные реакции', 'красный и синий — для справки');
    h.key(g, 46, 38, 14, 5.4, 'заново', 0x5d6b88, 'reset');
  };

  // ===== 5. Сплавы: плавильная печь с тиглем, банки добавок, весы со слитком и магнит, полка заказов =====
  SC['chme-alloy'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    // печь
    const FX = -10, FZ = -8, FW = 26, FH = 18, FD = 24;
    const fg = new T.Group(); at(fg, FX, TY, FZ, g); clickable(fg, 'cast');
    at(box(FW, FH, FD, 0x4a4f5e), 0, FH / 2, 0, fg);
    at(box(FW - 4, 0.6, FD - 4, 0x2a2e38), 0, FH + 0.3, 0, fg);
    for (let k = 0; k < 3; k++) at(box(FW + 0.4, 0.5, FD + 0.4, 0x2c3240, { edges: false }), 0, 3 + k * 5, 0, fg);
    const win = new T.Mesh(keep(new T.PlaneGeometry(10, 5)), keep(new T.MeshBasicMaterial({ color: 0xff7a2a }))); at(win, -4, 8, FD / 2 + 0.05, fg);
    const disp = h.screen(8, 3, Math.round(d.tC) + ' °C', '#ffb547', 220, 82); at(disp, 7, 12, FD / 2 + 0.06, fg);
    // тигель и расплав
    const cg = new T.Group(); at(cg, 0, FH - 6, 0, fg);
    at(cyl(7.4, 9, 0x5b4a44, { r2: 8.4, seg: 32 }), 0, 4.5, 0, cg);
    const melt = new T.Mesh(keep(new T.CylinderGeometry(7.4, 7.4, 0.4, 32)), keep(new T.MeshBasicMaterial({ color: hexN(d.melt) }))); at(melt, 0, 9.1, 0, cg);
    const crim = mesh(new T.TorusGeometry(7.9, 0.6, 8, 32), 0x4a3a34, { edges: false, hull: true }); crim.rotation.x = Math.PI / 2; at(crim, 0, 9.1, 0, cg);
    at(h.glow(0xff8a3c, 26, 0.45), 0, 10, 0, cg);
    at(new T.PointLight(0xff8a3c, 40, 60, 1.4), 0, 14, 0, cg);
    const specks = [];
    let j = 0;
    d.adds.forEach(a => { const n = Math.min(8, Math.round(a.amt / a.step * 1.4)); for (let i = 0; i < n; i++, j++) { const s = box(0.9, 0.5, 0.9, hexN(a.col), { edges: false }); const an = rnd(j + 5) * 6.28, rr = Math.sqrt(rnd(j + 6)) * 6; at(s, Math.cos(an) * rr, 9.4, Math.sin(an) * rr, cg); specks.push({ s, an, rr, ph: rnd(j + 7) * 6 }); } });
    const fume = h.steam(cg, 0, 9, 0, { n: 6, spread: 8, size: 4, rise: 12, op: 0.18, color: 0xffe0c0 });
    kit.onFrame((dt, t) => {
      const s = kit.reduce ? 0 : t;
      melt.position.y = 9.1 + 0.05 * Math.sin(s * 3);
      specks.forEach(q => { const a = q.an + s * 0.3; q.s.position.set(Math.cos(a) * q.rr, 9.4 + 0.1 * Math.sin(s * 2 + q.ph), Math.sin(a) * q.rr); q.s.rotation.y = s + q.ph; });
      win.material.color.setRGB(1, 0.45 + 0.08 * Math.sin(s * 4), 0.16);
    });
    tag(v3(FX, TY + FH + 14, FZ), 'Тигель: ' + d.baseName.toLowerCase() + ' ' + fmt(d.main, 1) + ' %', 'по составу: ' + d.clsName, false);
    // банки с добавками
    const JZ = 20;
    d.adds.forEach((a, i) => {
      const x = -46 + i * 14, jg = new T.Group(); at(jg, x, 0, JZ, g); clickable(jg, 'add-' + a.k);
      h.jar(jg, 0, 0, 5, 9, { lid: 0x3a4762 });
      for (let q = 0; q < 7; q++) { const c = a.k === 'C' ? mesh(new T.IcosahedronGeometry(0.9, 0), hexN(a.col), { edgeAngle: 20 }) : box(1.6, 1.0, 1.6, hexN(a.col)); c.rotation.set(rnd(i * 9 + q) * 3, rnd(i * 9 + q + 1) * 3, 0); at(c, (rnd(i * 9 + q + 2) - 0.5) * 5.4, TY + 1.2 + Math.floor(q / 3) * 1.3, (rnd(i * 9 + q + 3) - 0.5) * 5.4, jg); }
      const lb = h.plate(8.4, 4.4, [{ t: a.s + ' +' + fmt(a.step, a.step < 1 ? 1 : 0) + ' %', k: 0.5 }, { t: fmt(a.amt, a.amt % 1 ? 1 : 0) + ' %', c: a.amt > 0 ? '#c46a00' : '#8b96ad', k: 0.55 }]); at(lb, 0, TY + 5, 5.1, jg);
    });
    tag(v3(-46 + (d.adds.length - 1) * 7, TY + 18, JZ), 'Добавки', d.adds.map(a => a.s + ' ' + fmt(a.amt, a.amt % 1 ? 1 : 0)).join(' · ') + ' %');
    // весы со слитком: плотность; магнит
    const WX = 22, WZ = 14, wg = new T.Group(); at(wg, WX, TY, WZ, g);
    [[-9, -6], [9, -6], [-9, 6], [9, 6]].forEach(([x, z]) => at(cyl(0.9, 0.5, C.DARK, { edges: false }), x, 0.25, z, wg));
    at(box(22, 4, 16, 0x34405a), 0, 2.5, 0, wg);
    at(cyl(1.6, 1.2, C.STEEL), 0, 5, -1, wg); at(box(16, 0.7, 11, C.STEEL), 0, 5.9, -1, wg);
    const sc = h.screen(14, 3.2, d.ingot ? 'ρ ' + d.dens + ' г/см³' : '— г/см³', '#86e0a8', 300, 68, '#0c1a14'); at(sc, 0, 2.5, 8.06, wg);
    if (d.ingot) {
      const ing = cyl(4.2, 3, hexN(d.ingotCol), { r2: 3.3, seg: 4 }); ing.rotation.y = Math.PI / 4; ing.scale.set(1.7, 1, 1); at(ing, 0, 7.75, -1, wg);
      at(box(5, 0.2, 0.8, 0xffffff, { edges: false, hull: false, shadow: false, matOpt: { transparent: true, opacity: 0.35 } }), -1, 9.3, -2, wg);
    }
    // магнит на стойке
    // стойка с направляющей; магнит висит на ползунке
    const mg = new T.Group(); at(mg, 44, TY, 13, g);
    at(box(8, 1.2, 8, 0x3b4a66), 2, 0.6, 0, mg);
    at(cyl(0.6, 12, C.STEEL, { edges: false }), 4, 7.2, 0, mg);
    const rail = cyl(0.45, 20, C.STEEL, { edges: false }); rail.rotation.z = Math.PI / 2; at(rail, -6, 12.6, 0, mg);
    at(box(1.6, 1.6, 1.6, C.DARK), 4, 12.6, 0, mg);
    const mh = new T.Group(); at(mh, 0, 0, 0, mg);
    at(box(2.4, 2, 2, C.DARK), 0, 12.6, 0, mh);
    at(cyl(0.3, 3.4, C.STEEL, { edges: false }), 0, 10.4, 0, mh);
    const hs = new T.Group(); at(hs, -1, 7.8, 0, mh);
    const hsT = mesh(new T.TorusGeometry(2.4, 0.9, 10, 24, Math.PI), 0xd8382f, { hull: true, edges: false }); hsT.rotation.set(0, 0, -Math.PI / 2); at(hsT, 0, 0, 0, hs);
    [-2.4, 2.4].forEach(z => { const p = cyl(0.9, 2.4, 0xd6dbe4, { edges: false }); p.rotation.z = Math.PI / 2; at(p, -1.2, z, 0, hs); });
    hs.rotation.x = Math.PI / 2;
    const magnetic = !!(d.ingot && d.magnetic);
    // магнит тянется к слитку, если тот притягивается
    const far = 0, near = -(44 - WX - 9.4); // кончики полюсов у правого края слитка
    kit.onFrame((dt, t) => {
      if (!d.ingot) { mh.position.x = far; return; }
      const k = kit.reduce ? 1 : clamp(t % 4 / 1.2, 0, 1);
      mh.position.x = magnetic ? near * ease(clamp(k * 1.3, 0, 1)) : near * 0.55 * Math.sin(Math.PI * k);
    });
    tag(v3(WX + 4, TY + 16, WZ), 'Слиток', d.ingot ? d.ingotName + (magnetic ? ' · магнит притягивает' : ' · не магнитится') : 'печь — «Отлить»', !!d.ingot);
    // полка заказов
    const OX = 30, OZ = -26, og = new T.Group(); at(og, OX, TY, OZ, g);
    at(box(50, 2, 12, 0xdfe4ec), 0, 1, 0, og);
    d.orders.forEach((o, i) => {
      const x = -18.75 + i * 12.5, sg = new T.Group(); at(sg, x, 2, 0, og);
      at(cyl(4.6, 0.6, o.done ? 0x86e0a8 : 0xc4cad6, { edges: false }), 0, 0.3, -1, sg);
      if (o.done) {
        if (o.id === 'castiron') { const k = mesh(new T.SphereGeometry(4, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0x4a4e58, { hull: true, edges: false, matOpt: { side: T.DoubleSide } }); at(k, 0, 4.6, -1, sg); const rr = mesh(new T.TorusGeometry(4, 0.4, 6, 28), 0x3a3e48, { edges: false }); rr.rotation.x = Math.PI / 2; at(rr, 0, 4.6, -1, sg); [-4.4, 4.4].forEach(hx => at(box(1.2, 0.6, 2, 0x3a3e48), hx, 4.6, -1, sg)); }
        else if (o.id === 'stainless') { const bl = box(8, 0.4, 2, 0xdfe5ee); bl.rotation.set(0, 0.3, 0.5); at(bl, 1, 3.6, -1, sg); const hd = box(3.4, 1.1, 1.3, 0x22262e); hd.rotation.set(0, 0.3, 0.5); at(hd, -3.4, 1.4, 0.3, sg); }
        else if (o.id === 'bronze') { const pts = [h.v2(0.001, 7), h.v2(1.6, 6.8), h.v2(2.2, 5.6), h.v2(2.6, 3), h.v2(3.6, 1.2), h.v2(4.2, 0.6), h.v2(4.2, 0.2)]; const b = mesh(new T.LatheGeometry(pts, 28), 0xb8803e, { hull: true, edges: false, matOpt: { side: T.DoubleSide } }); at(b, 0, 0.6, -1, sg); const lp = mesh(new T.TorusGeometry(0.9, 0.3, 6, 16), 0xa06a30, { edges: false }); at(lp, 0, 8.2, -1, sg); }
        else { const wing = box(9, 0.6, 3.6, 0xb9c3cf); wing.rotation.set(0.15, 0.4, 0.35); at(wing, 0, 3.4, -1, sg); at(box(0.8, 3, 0.8, C.STEEL), 0, 1.6, -1, sg); }
      } else { const q = h.plate(4, 4, [{ t: '?', k: 0.8, c: '#8b96ad' }], '#8b96ad', 'rgba(0,0,0,0)', 64); at(q, 0, 3, -1, sg); }
      const lb = h.plate(11.4, 2.8, [(o.done ? '✓ ' : '○ ') + o.short], '#1b1610', o.done ? '#86e0a8' : '#fff6e6', 260); lb.rotation.x = -0.5; at(lb, 0, 0.4, 5.4, sg);
    });
    tag(v3(OX, TY + 16, OZ), 'Заказы', d.ndone + ' из 4 выполнено', d.ndone === 4);
    // клавиши: основа, отлить, заново
    ['Fe', 'Cu', 'Al'].forEach((b, i) => h.key(g, -46 + i * 10.5, 38, 9.5, 5.4, b, d.base === b ? 0x2f9e55 : 0x3b4a66, 'base-' + b));
    h.key(g, -8, 38, 16, 5.4, 'отлить', 0xe07a2e, 'cast');
    h.key(g, 46, 38, 14, 5.4, 'заново', 0x5d6b88, 'reset');
  };
})();
