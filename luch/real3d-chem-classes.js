// «Как в жизни» для темы «Классы веществ» (labs/chem-classes): белый лабораторный поднос и стеклянная посуда.
// Оксиды — склянки с веществами, ящики классов и горение элемента в банке с кислородом; кислоты и соли —
// модель «шарики на палочках» (единицы валентности), склянки-цели, лакмус и выпаривание соли; основания —
// пробирки в штативе и склянки с индикаторами; генетические ряды металла и неметалла — горение в ложке,
// растворение оксида в воде с индикатором, нейтрализация из бюретки и кристаллы соли в фарфоровой чашке.
// Сцены строятся из window.LUCH_REAL() опыта; время последнего действия — из LUCH_REAL.live() в onFrame.
(() => {
  const SC = window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {};
  const live = () => { try { return window.LUCH_REAL.live ? window.LUCH_REAL.live() : null; } catch (e) { return null; } };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rnd = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const ease = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const SUBD = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
  const low = s => String(s).replace(/\d/g, d => SUBD[d]);
  const elemsOf = f => [...new Set(String(f).match(/[A-Z][a-z]?/g) || [])];
  const ROM = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI'];
  const TY = 1.2; // верх подноса
  const IND_ACID = 0xe0464a, LITMUS = 0x8a5cc8, LITMUS_ALK = 0x3b6fe0, PHPH = 0xd8287a;

  // ---------- общие детали ----------
  function H(kit) {
    const { T, at, box, cyl, mesh, keep, grad, glowTex, textTex, clickable, toon, C } = kit;
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    const v2 = (x, y) => new T.Vector2(x, y);
    const glassMat = (color = 0xd8eef8, opacity = 0.26) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, transparent: true, opacity, side: T.DoubleSide, depthWrite: true }));
    // контур стекла: стенка рисуется после содержимого и пишет глубину, поэтому тёмная «оболочка»
    // видна только по силуэту, а не изнутри через прозрачную переднюю стенку
    const hullT = keep(kit.hullMat.clone()); hullT.transparent = true;
    const glassy = m => { m.renderOrder = 1; const hm = new T.Mesh(m.geometry, hullT); hm.renderOrder = 2; m.add(hm); return m; };
    const ownMat = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, ...o }));
    const spr = (map, color, opacity, add) => new T.Sprite(keep(new T.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending })));
    const glow = (color, size, opacity) => { const s = spr(glowTex(), color, opacity, true); s.scale.setScalar(size); return s; };
    const flat = (w, h, tex) => new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: keep(tex), transparent: true })));
    const hexs = c => '#' + c.toString(16).padStart(6, '0');
    function rodAB(parent, a, b, r, color, o = {}) {
      const dv = b.clone().sub(a), L = dv.length();
      const m = cyl(r, L, color, { edges: false, ...o });
      m.quaternion.setFromUnitVectors(v3(0, 1, 0), dv.normalize());
      return at(m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, parent);
    }
    function canvasTex(pw, ph) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph;
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      return { c, x: c.getContext('2d'), tex };
    }
    // табличка на холсте: draw(ctx, w, h)
    function canvasPlane(w, h, pw, ph, draw) {
      const k = canvasTex(pw, ph);
      const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: k.tex, transparent: true })));
      m.userData.draw = fn => { k.x.clearRect(0, 0, pw, ph); fn(k.x, pw, ph); k.tex.needsUpdate = true; };
      if (draw) m.userData.draw(draw);
      return m;
    }
    const textLines = (x, pw, ph, lines, fg, bg, o = {}) => {
      if (bg) { x.fillStyle = bg; if (o.round) { x.beginPath(); x.roundRect(2, 2, pw - 4, ph - 4, o.round); x.fill(); } else x.fillRect(0, 0, pw, ph); }
      if (o.border) { x.strokeStyle = o.border; x.lineWidth = o.bw || 6; x.beginPath(); x.roundRect((o.bw || 6) / 2, (o.bw || 6) / 2, pw - (o.bw || 6), ph - (o.bw || 6), o.round || 8); x.stroke(); }
      const ws = lines.map(l => typeof l === 'string' ? { t: l } : l), tot = ws.reduce((s, l) => s + (l.k2 || 1), 0);
      let y = 0;
      ws.forEach(t => {
        const lh = ph * (t.k2 || 1) / tot;
        let fs = Math.round(lh * (t.k || 0.62)); const font = s => `${t.w || 600} ${s}px ${t.mono === false ? '"Golos Text", sans-serif' : '"IBM Plex Mono", monospace'}`;
        x.font = font(fs); const tw = x.measureText(t.t).width; if (tw > pw * 0.9) { fs = Math.floor(fs * pw * 0.9 / tw); x.font = font(fs); }
        x.fillStyle = t.c || fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t.t, pw / 2, y + lh / 2 + 2);
        y += lh;
      });
    };
    function screen(w, h, lines, pw = 420, ph = 120, bg = '#0e1520') {
      const m = canvasPlane(w, h, pw, ph);
      m.userData.draw((x, a, b) => textLines(x, a, b, lines, '#e8ecf4', bg));
      return m;
    }
    // кнопка с надписью сверху
    function button(parent, x, y, z, label, color, key, w = 4.2, d = 3.6, fg = '#ffffff') {
      const b = new T.Group(); at(b, x, y, z, parent);
      at(box(w, 1.4, d, color), 0, 0.7, 0, b);
      const top = flat(w * 0.88, d * 0.78, textTex(label, fg, hexs(color), Math.round(64 * w / d * 1.6), 100));
      top.rotation.x = -Math.PI / 2; at(top, 0, 1.42, 0, b);
      clickable(b, key); return b;
    }
    // плоская клавиша-табличка с надписью
    function key(parent, x, z, w, d, lines, color, keyName, fg = '#ffffff') {
      const b = new T.Group(); at(b, x, TY, z, parent);
      at(box(w, 1.6, d, color), 0, 0.8, 0, b);
      const top = canvasPlane(w * 0.92, d * 0.8, Math.round(70 * w / d * 1.4), 112, (cx, a, bb) => textLines(cx, a, bb, [].concat(lines), fg, hexs(color)));
      top.rotation.x = -Math.PI / 2; at(top, 0, 1.62, 0, b);
      if (keyName) clickable(b, keyName); return b;
    }
    // карточка на подносе (чуть приподнята к зрителю)
    function card(parent, x, z, w, d, lines, fg = '#1b1610', bg = '#fff6e6', tilt = 0.5) {
      const m = canvasPlane(w, d, Math.round(64 * w / d * 2), 128, (cx, a, b) => textLines(cx, a, b, lines, fg, bg, { round: 18, border: '#1b1610', bw: 5 }));
      m.rotation.x = -Math.PI / 2 + tilt; at(m, x, TY + 0.2 + Math.sin(tilt) * d / 2, z, parent);
      return m;
    }
    // «таблетка» над деталью: спрайт, всегда смотрит на зрителя
    function pill(parent, x, y, z, txt, fg = '#1b1610', bg = '#fff6e6', hgt = 3.0) {
      const lines = String(txt).split('\n'), mc = document.createElement('canvas').getContext('2d');
      let mw = 0; lines.forEach((l, i) => { mc.font = `700 ${i ? 38 : 50}px "IBM Plex Mono", monospace`; mw = Math.max(mw, mc.measureText(l).width); });
      const pw = Math.max(128, Math.ceil(mw + 60)), ph = 72 * lines.length + 8, k = canvasTex(pw, ph);
      const m = new T.Sprite(keep(new T.SpriteMaterial({ map: k.tex, transparent: true, depthTest: false, depthWrite: false })));
      m.renderOrder = 6; m.center.set(0.5, 0);
      let w = 0; lines.forEach((l, i) => { k.x.font = `700 ${i ? 38 : 50}px "IBM Plex Mono", monospace`; w = Math.max(w, k.x.measureText(l).width); });
      w = Math.min(pw - 6, w + 34);
      k.x.fillStyle = bg; k.x.strokeStyle = '#1b1610'; k.x.lineWidth = 5;
      k.x.beginPath(); const x0 = (pw - w) / 2; if (k.x.roundRect) k.x.roundRect(x0, 3, w, ph - 6, 26); else k.x.rect(x0, 3, w, ph - 6); k.x.fill(); k.x.stroke();
      const lh = (ph - 8) / lines.length;
      lines.forEach((l, i) => { k.x.fillStyle = fg; k.x.font = `700 ${i ? 38 : 50}px "IBM Plex Mono", monospace`; k.x.textAlign = 'center'; k.x.textBaseline = 'middle'; k.x.fillText(l, pw / 2, 4 + lh * (i + 0.5) + 2); });
      k.tex.needsUpdate = true;
      m.scale.set(hgt * pw / 72, hgt * ph / 72, 1);
      return at(m, x, y, z, parent);
    }
    // буква на шарике-атоме: спрайт без фона
    function letter(parent, x, y, z, txt, size, fg = '#0b1019') {
      const k = canvasTex(128, 128); k.x.font = `700 ${txt.length > 1 ? 62 : 80}px "IBM Plex Mono", monospace`;
      k.x.fillStyle = fg; k.x.textAlign = 'center'; k.x.textBaseline = 'middle'; k.x.fillText(txt, 64, 68); k.tex.needsUpdate = true;
      const s = new T.Sprite(keep(new T.SpriteMaterial({ map: k.tex, transparent: true, depthWrite: false })));
      s.renderOrder = 4; s.scale.setScalar(size);
      return at(s, x, y, z, parent);
    }
    // пламя (спиртовка, ложка с горящим веществом)
    function flameTex(inner, outer) {
      const k = canvasTex(64, 128), x = k.x;
      const drop = (s, col, blur) => {
        x.save(); x.translate(32, 122); x.scale(s, s); x.beginPath();
        x.moveTo(0, -114); x.bezierCurveTo(8, -84, 24, -52, 22, -26); x.bezierCurveTo(20, -6, 10, 0, 0, 0);
        x.bezierCurveTo(-10, 0, -20, -6, -22, -26); x.bezierCurveTo(-24, -52, -8, -84, 0, -114); x.closePath();
        x.shadowColor = col; x.shadowBlur = blur; x.fillStyle = col; x.fill(); x.restore();
      };
      drop(1, outer, 9); drop(0.55, inner, 6); k.tex.needsUpdate = true;
      return k.tex;
    }
    function flame(parent, x, y, z, hgt, inner, outer, glowCol) {
      const g = new T.Group(); at(g, x, y, z, parent);
      const s = spr(flameTex(inner, outer), 0xffffff, 0.94, false); s.center.set(0.5, 0.04); s.scale.set(hgt * 0.5, hgt, 1); at(s, 0, 0, 0, g);
      // пламя рисуем поверх стекла банки, иначе стенка его гасит
      s.material.depthTest = false; s.renderOrder = 3;
      const gl = glow(glowCol, hgt * 2.2, 0.45); at(gl, 0, hgt * 0.35, 0, g);
      g.userData.k = 1;
      if (!kit.reduce) kit.onFrame((dt, t) => { const k = g.userData.k; s.scale.set(hgt * 0.5 * k * (1 + 0.08 * Math.sin(t * 17)), hgt * k * (1 + 0.12 * Math.sin(t * 13) + 0.05 * Math.sin(t * 29)), 1); });
      else s.scale.set(hgt * 0.5, hgt, 1);
      return g;
    }
    // дым/пар: клубы поднимаются и тают
    let puffT = null;
    function puffTex() {
      if (puffT) return puffT;
      const k = canvasTex(64, 64), gr = k.x.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.5, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      k.x.fillStyle = gr; k.x.fillRect(0, 0, 64, 64); k.tex.needsUpdate = true; puffT = k.tex; return puffT;
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
          const ph = kit.reduce ? b.ph : (t * st.speed + b.ph) % 1;
          b.m.scale.setScalar(st.big * (0.4 + 0.9 * ph));
          b.m.position.set(Math.cos(b.a) * b.rr + 0.3 * Math.sin(t * 5 + i), 0.4 + ph * (st.top - 0.9), Math.sin(b.a) * b.rr);
        });
      });
      return { g, set(a, top, big = 0.5, speed = 0.6) { Object.assign(st, { amt: a, top, big, speed }); } };
    }
    // жидкость: цилиндр единичной высоты (высоту и цвет можно менять каждый кадр)
    function liquid(parent, x, y0, z, r, color, opacity = 0.62) {
      const mat = ownMat(color, { transparent: true, opacity, depthWrite: false });
      const m = new T.Mesh(keep(new T.CylinderGeometry(r, r * 0.97, 1, 40)), mat);
      at(m, x, y0, z, parent);
      const set = (hgt, yb = y0) => { m.visible = hgt > 0.05; m.scale.y = Math.max(0.05, hgt); m.position.y = yb + Math.max(0.05, hgt) / 2; };
      return { m, mat, set };
    }
    // стеклянный стакан с делениями
    function beaker(parent, x, y0, z, r, h) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const wall = new T.Mesh(keep(new T.CylinderGeometry(r, r * 0.97, h, 40, 1, true)), glassMat(0xd8eef8, 0.24)); at(wall, 0, h / 2, 0, g);
      glassy(wall);
      at(cyl(r * 0.97, 0.6, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.45 } }), 0, 0.3, 0, g);
      const rim = mesh(new T.TorusGeometry(r, 0.22, 6, 40), 0xeef6fb, { edges: false }); rim.rotation.x = Math.PI / 2; at(rim, 0, h, 0, g);
      const sp = mesh(new T.TorusGeometry(0.9, 0.22, 6, 12, Math.PI), 0xeef6fb, { edges: false }); sp.rotation.set(Math.PI / 2, 0, Math.PI / 2); at(sp, -r - 0.2, h, 0, g);
      const a = 0.35;
      for (let k = 1; k <= 5; k++) { const m = box(k % 2 ? 1.1 : 2, 0.16, 0.1, 0x6f8098, { edges: false, shadow: false }); m.rotation.y = a; at(m, Math.sin(a) * (r + 0.05), h * k / 6.5, Math.cos(a) * (r + 0.05), g); }
      return { g, r, h };
    }
    // белый лабораторный поднос с бортиком
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
      const wall = new T.Mesh(geo, glassMat(0xd8eef8, o.glass ?? 0.3)); g.add(wall); glassy(wall);
      const lm = ownMat(o.color ?? 0xcfe2f0, { transparent: true, opacity: o.op ?? 0.7, depthWrite: false });
      const ri = r - 0.3;
      const bot = new T.Mesh(keep(new T.SphereGeometry(ri, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), lm); at(bot, 0, r, 0, g);
      const body = new T.Mesh(keep(new T.CylinderGeometry(ri, ri, 1, 24)), lm); at(body, 0, r, 0, g);
      const set = lv => { bot.visible = lv > 0.3; const hb = lv - r; body.visible = hb > 0.05; if (body.visible) { body.scale.y = hb; body.position.y = r + hb / 2; } };
      set(o.level ?? 0);
      return { g, r, h, ri, mat: lm, set };
    }
    // склянка с раствором и этикеткой
    function bottle(parent, x, z, col, label, o = {}) {
      const g = new T.Group(); at(g, x, o.y ?? TY, z, parent);
      const r = o.r || 3.6, hh = o.h || 10;
      const wall = new T.Mesh(keep(new T.CylinderGeometry(r, r, hh, 28, 1, true)), glassMat(o.brown ? 0x9a6a3a : 0xd8eef8, o.brown ? 0.55 : 0.3)); at(wall, 0, hh / 2, 0, g); glassy(wall);
      at(cyl(r, 0.5, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.45 } }), 0, 0.25, 0, g);
      at(cyl(r, 1.6, 0xd8eef8, { r2: 1.4, edges: false, matOpt: { transparent: true, opacity: 0.4 } }), 0, hh + 0.8, 0, g);
      at(cyl(1.6, 1.8, o.cap || 0x2c3240, { seg: 16 }), 0, hh + 2.4, 0, g);
      if (col != null) { const lq = cyl(r - 0.35, hh * (o.fill ?? 0.72), col, { edges: false, hull: false, matOpt: { transparent: true, opacity: o.op ?? 0.8 } }); at(lq, 0, 0.5 + hh * (o.fill ?? 0.72) / 2, 0, g); }
      if (label) { const lb = canvasPlane(r * 1.7, hh * 0.38, 200, 96, (x, a, b) => textLines(x, a, b, [].concat(label), '#1b1610', '#fff6e6')); at(lb, 0, hh * 0.45, r + 0.06, g); }
      return { g, top: (o.y ?? TY) + hh + 3.3 };
    }
    // широкогорлая склянка с веществом: порошок, куски, гранулы, жидкость, газ
    function jar(parent, x, y, z, o = {}) {
      const g = new T.Group(); at(g, x, y, z, parent);
      const r = o.r || 3.2, hh = o.h || 7.5, col = o.col ?? 0xf4f1e8;
      const wall = new T.Mesh(keep(new T.CylinderGeometry(r, r, hh, 28, 1, true)), glassMat(0xd8eef8, 0.3)); at(wall, 0, hh / 2, 0, g); glassy(wall);
      at(cyl(r, 0.5, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.5 } }), 0, 0.25, 0, g);
      if (o.kind === 'gas') {
        const lid = cyl(r + 0.6, 0.5, 0xd8eef8, { matOpt: { transparent: true, opacity: 0.55 } }); at(lid, 0, hh + 0.25, 0, g);
        at(cyl(r - 0.2, hh - 0.6, o.tint ?? 0xeaf3fa, { edges: false, hull: false, shadow: false, matOpt: { transparent: true, opacity: 0.18, depthWrite: false } }), 0, 0.5 + (hh - 0.6) / 2, 0, g);
      } else {
        at(cyl(r + 0.25, 1.6, o.cap ?? 0x2c3240, { seg: 24 }), 0, hh + 0.8, 0, g);
        const fh = hh * (o.fill ?? 0.45), ri = r - 0.35;
        if (o.kind === 'liquid') at(cyl(ri, fh, col, { edges: false, hull: false, matOpt: { transparent: true, opacity: o.op ?? 0.55, depthWrite: false } }), 0, 0.5 + fh / 2, 0, g);
        else if (o.kind === 'powder') { at(cyl(ri, fh, col, { edges: false, hull: false }), 0, 0.5 + fh / 2, 0, g); at(cyl(ri * 0.7, 0.9, col, { r2: 0.4, edges: false, hull: false }), 0, 0.5 + fh + 0.45, 0, g); }
        else {
          // куски / гранулы / кристаллы
          at(cyl(ri, fh * 0.5, col, { edges: false, hull: false }), 0, 0.5 + fh * 0.25, 0, g);
          for (let i = 0; i < 9; i++) {
            const a = rnd(i + (o.seed || 0)) * Math.PI * 2, rr = Math.sqrt(rnd(i + 5)) * (ri - 0.9), yy = 0.5 + fh * 0.5 + rnd(i + 9) * fh * 0.5;
            const p = o.kind === 'pellets' ? mesh(new T.SphereGeometry(0.75, 10, 6), col, { hull: true, edges: false }) : box(o.kind === 'crystals' ? 0.5 : 1.3, o.kind === 'crystals' ? 1.6 : 1.0, o.kind === 'crystals' ? 0.5 : 1.1, col, { edges: false });
            if (o.kind === 'pellets') p.scale.y = 0.45; else p.rotation.set(rnd(i + 2) * 3, rnd(i + 4) * 3, rnd(i + 6) * 3);
            at(p, Math.cos(a) * rr, yy, Math.sin(a) * rr, g);
          }
        }
      }
      if (o.label) { const lb = canvasPlane(r * 1.55, hh * 0.34, 220, 96, (x, a, b) => textLines(x, a, b, [].concat(o.label), '#1b1610', '#fff6e6', { round: 10 })); at(lb, 0, hh * 0.66, r + 0.06, g); }
      return { g, top: y + hh + 1.6 };
    }
    // фарфоровая чашка
    function dish(parent, x, y, z, r, depth = 2.4) {
      const g = new T.Group(); at(g, x, y, z, parent);
      const pts = []; for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI / 2; pts.push(v2(Math.max(0.001, Math.sin(a) * r), depth - Math.cos(a) * depth)); }
      pts.push(v2(r + 0.35, depth + 0.2));
      const geo = keep(new T.LatheGeometry(pts, 32));
      const m = new T.Mesh(geo, toon(0xf6f4ee, { side: T.DoubleSide })); m.castShadow = true; g.add(m); m.add(new T.Mesh(geo, kit.hullMat));
      return { g, r, depth };
    }
    // спиртовка: стеклянный корпус, латунная горловина, фитиль, пламя
    function spirit(parent, x, y, z, s = 1) {
      const g = new T.Group(); at(g, x, y, z, parent);
      at(cyl(4.2 * s, 5 * s, 0xbfe3f2, { r2: 2.9 * s, matOpt: { transparent: true, opacity: 0.6 } }), 0, 2.5 * s, 0, g);
      at(cyl(3.8 * s, 2.4 * s, 0x8fc6ff, { r2: 3.4 * s, edges: false, hull: false, matOpt: { transparent: true, opacity: 0.7 } }), 0, 1.3 * s, 0, g);
      at(cyl(1.6 * s, 1.5 * s, C.BRASS), 0, 5.7 * s, 0, g);
      at(cyl(0.5 * s, 1.3 * s, 0xf4efe2, { hull: false }), 0, 7 * s, 0, g);
      const fl = flame(g, 0, 7.4 * s, 0, 7 * s, '#fff1a8', '#ff8a2a', 0xff9a40);
      const light = new T.PointLight(0xffa040, 0, 40, 1.4); at(light, 0, 11 * s, 0, g);
      const set = k => { fl.visible = k > 0.02; fl.userData.k = Math.max(0.05, k); light.intensity = 22 * k; };
      set(0);
      return { g, set, top: y + 7.4 * s };
    }
    // штатив: основание, стержень, лапки к точкам
    function stand(parent, x, z, Hh, arms) {
      at(box(11, 1.2, 8, C.DARK), x, TY + 0.6, z, parent);
      at(cyl(0.65, Hh, C.STEEL, { edges: false }), x, TY + 1.2 + Hh / 2, z, parent);
      arms.forEach(a => {
        rodAB(parent, v3(x, a.y, z), v3(a.to.x, a.y, a.to.z), 0.42, C.STEEL);
        at(box(2.2, 2.2, 2.2, C.DARK), x, a.y, z, parent);
        at(box(2.6, 2.4, 2.6, 0x3b4a66), a.to.x, a.y, a.to.z, parent);
      });
    }
    // подсветка выбранного: жёлтое кольцо на подносе
    const ring = (parent, x, z, r, col = 0xffd166, y = TY) => at(cyl(r, 0.25, col, { edges: false, hull: false, shadow: false }), x, y + 0.13, z, parent);
    // пульсирующее свечение («сюда»)
    function beacon(parent, x, y, z, r, col = 0xffd166) {
      const m = new T.Mesh(keep(new T.RingGeometry(r * 0.78, r, 40)), keep(new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthWrite: false, side: T.DoubleSide })));
      m.rotation.x = -Math.PI / 2; at(m, x, y + 0.16, z, parent);
      if (!kit.reduce) kit.onFrame((dt, t) => { const k = 0.5 + 0.5 * Math.sin(t * 4); m.material.opacity = 0.35 + 0.55 * k; m.scale.setScalar(1 + 0.06 * k); });
      return m;
    }
    // банка для сжигания: стеклянный цилиндр с толстым дном
    function gasJar(parent, x, y0, z, r, hh) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      at(cyl(r + 0.8, 0.9, 0xd8eef8, { matOpt: { transparent: true, opacity: 0.5 } }), 0, 0.45, 0, g);
      const wall = new T.Mesh(keep(new T.CylinderGeometry(r, r, hh, 36, 1, true)), glassMat(0xd8eef8, 0.24)); at(wall, 0, 0.9 + hh / 2, 0, g); glassy(wall);
      const rim = mesh(new T.TorusGeometry(r, 0.3, 6, 36), 0xeef6fb, { edges: false }); rim.rotation.x = Math.PI / 2; at(rim, 0, 0.9 + hh, 0, g);
      const fog = new T.Mesh(keep(new T.CylinderGeometry(r - 0.3, r - 0.3, hh - 0.4, 32)), keep(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })));
      at(fog, 0, 0.9 + (hh - 0.4) / 2 + 0.1, 0, g);
      return { g, top: y0 + 0.9 + hh, fog };
    }
    // ложка для сжигания веществ: чашечка, стержень, диск-крышка, кольцо
    function spoon(parent, diskR) {
      const g = new T.Group(); parent.add(g);
      const pts = [v2(0.001, 0), v2(1.3, 0.1), v2(1.8, 0.8), v2(1.9, 1.1)];
      const cg = keep(new T.LatheGeometry(pts, 20));
      const cup = new T.Mesh(cg, toon(C.STEEL, { side: T.DoubleSide })); g.add(cup); cup.add(new T.Mesh(cg, kit.hullMat));
      rodAB(g, v3(1.6, 1, 0), v3(0, 3.2, 0), 0.26, C.STEEL);
      rodAB(g, v3(0, 3.2, 0), v3(0, 26, 0), 0.28, C.STEEL);
      at(cyl(diskR, 0.7, 0x9aa3b4, { seg: 32 }), 0, 13, 0, g);
      const hr = mesh(new T.TorusGeometry(1.4, 0.3, 8, 20), C.STEEL, { edges: false, hull: true }); at(hr, 0, 27.3, 0, g);
      return { g, diskY: 13 - 0.35 };
    }
    // бюретка: длинная трубка с делениями, кран и носик
    function burette(parent, x, z, yTip, len, col) {
      const g = new T.Group(); at(g, x, yTip, z, parent);
      at(cyl(0.18, 2, 0xd8eef8, { r2: 0.6, edges: false, matOpt: { transparent: true, opacity: 0.6 } }), 0, 1, 0, g);
      at(box(1.6, 1.4, 1.6, 0x3b4a66), 0, 2.7, 0, g); at(box(3.6, 0.5, 0.6, 0x3b4a66), 0, 2.7, 0.8, g);
      const r = 0.95, y0 = 3.4;
      const wall = new T.Mesh(keep(new T.CylinderGeometry(r, r, len, 20, 1, true)), glassMat(0xd8eef8, 0.32)); at(wall, 0, y0 + len / 2, 0, g); glassy(wall);
      for (let k = 1; k < 12; k++) at(box(k % 5 ? 0.6 : 1.1, 0.12, 0.1, 0x2c3240, { edges: false, shadow: false }), 0.3, y0 + len * k / 12, r + 0.04, g);
      const lq = new T.Mesh(keep(new T.CylinderGeometry(r - 0.25, r - 0.25, 1, 16)), ownMat(col ?? 0xe6eef4, { transparent: true, opacity: 0.6, depthWrite: false }));
      at(lq, 0, y0, 0, g);
      const set = f => { lq.visible = f > 0.01; const hh = Math.max(0.05, (len - 0.6) * f); lq.scale.y = hh; lq.position.y = y0 + 0.2 + hh / 2; };
      set(0);
      return { g, set, top: yTip + y0 + len };
    }
    // треножник с фарфоровой чашкой над спиртовкой
    function tripod(parent, x, z, Hh) {
      const g = new T.Group(); at(g, x, TY, z, parent);
      const rr = mesh(new T.TorusGeometry(6.2, 0.4, 8, 32), 0x3a3f4c, { edges: false, hull: true }); rr.rotation.x = Math.PI / 2; at(rr, 0, Hh, 0, g);
      for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.5; rodAB(g, v3(Math.cos(a) * 6.2, Hh, Math.sin(a) * 6.2), v3(Math.cos(a) * 8.4, 0, Math.sin(a) * 8.4), 0.38, 0x3a3f4c); }
      at(box(12, 0.25, 12, 0x8a909c, { edges: true }), 0, Hh + 0.5, 0, g);
      at(box(6, 0.28, 6, 0xd8d4c8, { edges: false }), 0, Hh + 0.65, 0, g);
      const ds = dish(g, 0, Hh + 0.8, 0, 5.4, 2.4);
      return { g, dishY: TY + Hh + 0.8, ds };
    }
    // кристаллы соли в чашке: растут по f 0..1
    function crystals(parent, x, y, z, rMax, col, n = 16) {
      const ps = [];
      for (let i = 0; i < n; i++) {
        const a = rnd(i + 41) * Math.PI * 2, rr = Math.sqrt(rnd(i + 43)) * rMax, s = 0.6 + rnd(i + 47) * 0.7;
        const c = box(s, s * (0.8 + rnd(i + 49) * 0.6), s, col, { edges: true }); c.rotation.set(rnd(i + 51) * 0.6, rnd(i + 53) * 3, rnd(i + 55) * 0.6);
        at(c, x + Math.cos(a) * rr, y + 0.35 + (1 - rr / rMax) * 0.3, z + Math.sin(a) * rr, parent); ps.push({ c, d: rnd(i + 57) * 0.5 });
      }
      const set = f => ps.forEach(p => { const k = clamp((f - p.d) / 0.5, 0, 1); p.c.visible = k > 0.01; p.c.scale.setScalar(Math.max(0.01, k)); });
      set(1); return { set };
    }
    // промывалка: пластиковая бутылка с изогнутым носиком
    function washBottle(parent, x, z) {
      const g = new T.Group(); at(g, x, TY, z, parent);
      at(cyl(3.6, 10, 0xf2f6fa, { matOpt: { transparent: true, opacity: 0.85 } }), 0, 5, 0, g);
      at(cyl(3.1, 6.5, 0xbfe0f5, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.55 } }), 0, 3.5, 0, g);
      at(cyl(1.8, 1.8, 0x3b6fd8, { seg: 16 }), 0, 10.9, 0, g);
      rodAB(g, v3(0, 11.6, 0), v3(0, 15, 0), 0.32, 0xf2f6fa); rodAB(g, v3(0, 15, 0), v3(-4.2, 13.4, 0), 0.32, 0xf2f6fa);
      return g;
    }
    // баллон с газом (кислород — голубой, углекислый газ — чёрный)
    function cylinder(parent, x, z, col, txt) {
      const g = new T.Group(); at(g, x, TY, z, parent);
      at(cyl(3, 11, col), 0, 5.5, 0, g);
      const dm = mesh(new T.SphereGeometry(3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), col, { hull: true, edges: false }); at(dm, 0, 11, 0, g);
      at(cyl(0.9, 2, C.BRASS), 0, 14.2, 0, g); at(box(2.6, 0.9, 0.9, C.BRASS), 0.9, 14.6, 0, g);
      const lb = canvasPlane(4, 2.6, 160, 104, (cx, a, b) => textLines(cx, a, b, [txt], col === 0x2c3240 ? '#fff6e6' : '#1b1610', null));
      at(lb, 0, 7, 3.05, g);
      return g;
    }
    // склянка-капельница: корпус, пипетка с резиновой грушей (её можно поднимать)
    function dropper(parent, x, z, col, op, label) {
      const g = new T.Group(); at(g, x, TY, z, parent);
      const r = 3.2, hh = 7.5;
      const wall = new T.Mesh(keep(new T.CylinderGeometry(r, r, hh, 28, 1, true)), glassMat(0xd8eef8, 0.3)); at(wall, 0, hh / 2, 0, g); glassy(wall);
      at(cyl(r - 0.3, hh * 0.6, col, { edges: false, hull: false, matOpt: { transparent: true, opacity: op, depthWrite: false } }), 0, 0.3 + hh * 0.3, 0, g);
      at(cyl(r, 1.4, 0xd8eef8, { r2: 1.2, edges: false, matOpt: { transparent: true, opacity: 0.4 } }), 0, hh + 0.7, 0, g);
      const lb = canvasPlane(r * 1.7, 2.6, 240, 84, (cx, a, b) => textLines(cx, a, b, [label], '#1b1610', '#fff6e6', { round: 10 })); at(lb, 0, hh * 0.52, r + 0.06, g);
      const pip = new T.Group(); at(pip, 0, hh + 1.4, 0, g);
      at(cyl(1.25, 1, 0x2c3240, { seg: 16 }), 0, 0.5, 0, pip);
      at(cyl(0.35, 8, 0xd8eef8, { r2: 0.35, edges: false, matOpt: { transparent: true, opacity: 0.6 } }), 0, -3, 0, pip);
      const bulb = mesh(new T.SphereGeometry(1.25, 16, 12), 0xd8452e, { hull: true, edges: false }); bulb.scale.y = 1.5; at(bulb, 0, 2.4, 0, pip);
      return { g, pip, top: TY + hh + 6 };
    }
    return { v3, v2, glassMat, ownMat, spr, glow, flat, rodAB, canvasPlane, textLines, screen, button, key, card, pill, letter, flame, steam, bubbles, liquid, beaker, tray, tube, bottle, jar, dish, spirit, stand, ring, beacon, gasJar, spoon, burette, tripod, crystals, washBottle, cylinder, dropper };
  }
  const mixC = (T, a, b, t) => new T.Color(a).lerp(new T.Color(b), clamp(t, 0, 1));

  // =====================================================================================
  // 1. ОКСИДЫ: склянки спереди, три ящика сзади, банка с кислородом и ложкой посередине
  // =====================================================================================
  const LOOK = {
    Na2O: { kind: 'powder', col: 0xf4f1e8 }, CO2: { kind: 'gas', tint: 0xeef4f8 }, NaOH: { kind: 'pellets', col: 0xfafaf6 },
    CaO: { kind: 'lumps', col: 0xefece2 }, SO3: { kind: 'crystals', col: 0xf8f8f8 }, CaCO3: { kind: 'lumps', col: 0xf6f3ea },
    CuO: { kind: 'powder', col: 0x26221f }, O2: { kind: 'gas', tint: 0xe6f0ff }, P2O5: { kind: 'powder', col: 0xfbfbf8 },
    H2SO4: { kind: 'liquid', col: 0xe6eef2, op: 0.5, fill: 0.55 },
  };
  // как получают оксид горением простого вещества в кислороде
  const BURN = {
    Na2O: { el: 0xd8dde4, prod: 0xf6f3ea, fl: ['#fff6c0', '#ffb820'], gl: 0xffc840, eq: '4Na + O₂ → 2Na₂O', how: 'натрий горит жёлтым пламенем', smoke: 0.35 },
    CaO: { el: 0xc9ccd0, prod: 0xf6f3ea, fl: ['#ffd8b0', '#ff5a2a'], gl: 0xff6a3a, eq: '2Ca + O₂ → 2CaO', how: 'кальций горит кирпично-красным', smoke: 0.4 },
    CuO: { el: 0xd9824f, prod: 0x221e1c, fl: null, gl: 0xff7a2a, eq: '2Cu + O₂ → 2CuO', how: 'медь раскаляется и чернеет', smoke: 0 },
    CO2: { el: 0x2a2626, prod: null, fl: null, gl: 0xff5020, eq: 'C + O₂ → CO₂', how: 'уголь тлеет ярко, получается газ', smoke: 0 },
    SO3: { el: 0xf2d23a, prod: null, fl: ['#d8e6ff', '#3a6cff'], gl: 0x5a8cff, eq: 'S + O₂ → SO₂, 2SO₂ + O₂ → 2SO₃', how: 'сера горит синим пламенем', smoke: 0.15 },
    P2O5: { el: 0xb5452e, prod: 0xfbfbf8, fl: ['#ffffff', '#ffd23a'], gl: 0xffffff, eq: '4P + 5O₂ → 2P₂O₅', how: 'фосфор горит ослепительно, белый дым', smoke: 1 },
  };
  const ELN = { Na: 'Na', O: 'O', H: 'H', Ca: 'Ca', C: 'C', S: 'S', Cu: 'Cu', P: 'P' };
  SC['chcl-oxides'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const BX = { b: -40, a: 0, n: 40 }, BZ = -25, BW = 36, BD = 15;
    const BC = { b: 0x3b6fe0, a: 0xe0464a, n: 0x6f7a90 }, BN = { b: 'ОСНОВНЫЕ ОКСИДЫ', a: 'КИСЛОТНЫЕ ОКСИДЫ', n: 'НЕ ОКСИДЫ' };
    const cnt = { b: 0, a: 0, n: 0 };
    d.items.forEach(it => { if (it.at) cnt[it.at]++; });
    for (const k of ['b', 'a', 'n']) {
      const bg = new T.Group(); at(bg, BX[k], TY, BZ, g); clickable(bg, 'box-' + k);
      at(box(BW, 1, BD, 0xf9fafc), 0, 0.5, 0, bg);
      at(box(BW, 6, 0.8, BC[k]), 0, 3, -BD / 2 + 0.4, bg);
      at(box(BW, 3.4, 0.8, BC[k]), 0, 1.7, BD / 2 - 0.4, bg);
      at(box(0.8, 4.6, BD - 1.6, BC[k]), -BW / 2 + 0.4, 2.3, 0, bg); at(box(0.8, 4.6, BD - 1.6, BC[k]), BW / 2 - 0.4, 2.3, 0, bg);
      const st = h.canvasPlane(BW * 0.8, 2.6, 420, 60, (x, a, b) => h.textLines(x, a, b, [{ t: BN[k], k: 0.7 }], '#ffffff', null));
      at(st, 0, 1.8, BD / 2 + 0.05, bg);
      if (d.sel && !d.items.find(i => i.f === d.sel).at) h.beacon(bg, 0, 1, 0, 8, 0xffd166);
    }
    tag(v3(BX.b, TY + 9, BZ), 'Основные оксиды', cnt.b + ' шт.');
    tag(v3(BX.a, TY + 9, BZ), 'Кислотные оксиды', cnt.a + ' шт.');
    tag(v3(BX.n, TY + 9, BZ), 'Не оксиды', cnt.n + ' шт.');

    // склянки: спереди — неразобранные, в ящиках — разобранные
    const inBin = { b: 0, a: 0, n: 0 };
    d.items.forEach((it, i) => {
      const sel = d.sel === it.f, L = LOOK[it.f] || { kind: 'powder' };
      let x, y, z;
      if (it.at) { const j = inBin[it.at]++; x = BX[it.at] - 12.6 + j * 8.4; y = TY + 1; z = BZ; }
      else { x = -54 + i * 10; y = TY; z = 22; }
      const jg = new T.Group(); at(jg, x, y, z, g); clickable(jg, 'jar-' + it.f);
      const body = new T.Group(); jg.add(body);
      h.jar(body, 0, 0, 0, { ...L, seed: i * 7, label: low(it.f) });
      if (!it.at) h.card(jg, 0, 9, 9.4, 4.6, [{ t: low(it.f), k: 0.7, k2: 1.3 }, { t: it.name, k: 0.62, mono: false, w: 500 }], '#1b1610', sel ? '#ffe9b0' : '#fff6e6', 0.55).position.y -= TY;
      if (sel) {
        h.ring(jg, 0, 0, 4.4, 0xffd166, it.at ? 1 - TY + TY : 0).position.y = 0.14;
        if (!it.at) { if (kit.reduce) body.position.y = 2; else kit.onFrame((dt, t) => { body.position.y = 2 + 0.5 * Math.sin(t * 3); }); }
      }
    });

    // банка с кислородом и ложкой: как получают выбранный оксид
    const gx = 50, gz = 22, JR = 5.4, JH = 15;
    const gj = h.gasJar(g, gx, TY, gz, JR, JH);
    const sp = h.spoon(g, JR + 1.2);
    sp.g.position.set(gx, gj.top + 0.35 - sp.diskY, gz);
    const cupY = sp.g.position.y + 0.9;
    const B = d.sel ? BURN[d.sel] : null, sel = d.sel ? d.items.find(i => i.f === d.sel) : null;
    if (B) {
      const o2 = h.canvasPlane(5.6, 2.6, 200, 92, (x, a, b) => h.textLines(x, a, b, ['O₂'], '#1b1610', '#e8f2ff', { round: 12 }));
      at(o2, gx, TY + 4, gz + JR + 0.08, g);
      const blob = kit.mesh(new T.SphereGeometry(1.15, 16, 10), 0, { mat: h.ownMat(B.el, { emissive: 0x000000 }), hull: true, edges: false });
      blob.scale.y = 0.7; at(blob, gx, cupY + 0.5, gz, g);
      const fl = B.fl ? h.flame(g, gx, cupY + 0.6, gz, 10, B.fl[0], B.fl[1], B.gl) : null;
      const em = h.glow(B.gl, 16, 0); at(em, gx, cupY + 0.9, gz, g);
      const light = new T.PointLight(B.gl, 0, 60, 1.2); at(light, gx, cupY + 5, gz, g);
      const smoke = B.smoke ? h.steam(g, gx, cupY + 2, gz, { n: 8, spread: 4.5, size: 3.6, rise: JH - 5, op: 0.6 * B.smoke, amt: 0, color: 0xf6f6f6 }) : null;
      const prodC = B.prod ?? B.el;
      let t0 = null;
      kit.onFrame((dt, t) => {
        if (t0 === null) t0 = t;
        const s = kit.reduce ? 9 : t - t0, burn = clamp((s - 0.5) / 4, 0, 1), on = s > 0.5 && s < 4.8;
        const k = on ? Math.min(1, (s - 0.5) * 3, (4.8 - s) * 2.5) : 0;
        if (fl) { fl.visible = k > 0.02; fl.userData.k = Math.max(0.05, k); }
        em.material.opacity = k * (B.fl ? 0.7 : 0.9); light.intensity = k * (B.gl === 0xffffff ? 160 : 70);
        if (smoke) smoke.set(on ? 1 : 0);
        gj.fog.material.opacity = 0.42 * B.smoke * B.smoke * ease(burn);
        blob.material.color.copy(mixC(T, B.el, prodC, burn));
        blob.material.emissive.setHex(B.fl ? 0x000000 : 0xff4a10); blob.material.emissiveIntensity = B.fl ? 0 : k * 0.9;
        const gone = B.prod == null ? 1 - 0.85 * burn : 1;
        blob.scale.set(gone, 0.7 * gone, gone);
      });
      tag(v3(gx, gj.top + 3, gz + 6), 'Горение в кислороде', B.eq, true);
    } else {
      const els = sel ? elemsOf(sel.f) : [];
      const why = !sel ? 'возьмите склянку' : els.length === 1 ? 'простое вещество' : `${els.length} элемента: ${els.join(', ')}`;
      tag(v3(gx, gj.top + 3, gz + 6), sel ? low(sel.f) + ' — не из горения' : 'Ложка для сжигания', why);
    }
  };

  // =====================================================================================
  // 2 и 4. КИСЛОТЫ и СОЛИ: доска с моделью «атомы и связи», чашки с деталями, склянки-цели, опыт справа
  // =====================================================================================
  function saltCol(c, r) {
    if (r === 'S') return c === 'Cu' || c === 'Fe' ? 0x2a2626 : 0xf2ecc8;
    if (c === 'Cu') return r === 'Cl' ? 0x3fb6a0 : r === 'CO3' ? 0x3faa7a : r === 'PO4' ? 0x52b8c0 : 0x2f86e0;
    if (c === 'Fe') return r === 'Cl' ? 0xb8722a : r === 'NO3' ? 0xd8c8e8 : 0xe8d27a;
    return 0xfafaf6;
  }
  function builder(kit, d) {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const Cc = d.C, Rr = d.R;
    // деревянная доска с двумя желобками
    const BXc = -14, BW = 70, ZT = -9, ZB = 8, yb = TY + 1.6 + 3.3;
    at(box(BW, 1.6, 32, C.WOOD), BXc, TY + 0.8, -0.5, g);
    at(box(BW - 4, 0.3, 3, C.WOOD2, { edges: false }), BXc, TY + 1.7, ZT, g); at(box(BW - 4, 0.3, 3, C.WOOD2, { edges: false }), BXc, TY + 1.7, ZB, g);
    const U = Math.max(d.A, d.B, 1), u = Math.min(8, 60 / U), x0 = BXc - U * u / 2;
    // подписи-счёт на краях доски
    const cnt = (z, txt) => { const m = h.canvasPlane(40, 2.6, 640, 42, (x, a, b) => h.textLines(x, a, b, [txt], '#3a2414', null)); m.rotation.x = -Math.PI / 2; at(m, BXc, TY + 1.62, z, g); };
    cnt(-15, `${Cc.s} (${ROM[Cc.v]}) · ${d.x} × ${Cc.v} = ${d.A}`);
    cnt(14, `${low(Rr.s)} (${ROM[Rr.v]}) · ${d.y} × ${Rr.v} = ${d.B}`);
    // связи
    const both = Math.min(d.A, d.B), OR = 0xff9a2a;
    for (let k = 0; k < U; k++) {
      const x = x0 + (k + 0.5) * u;
      if (k < both) h.rodAB(g, v3(x, yb, ZT), v3(x, yb, ZB), 0.42, d.eq ? 0x3fbf6a : 0xc8d1e2, { hull: true });
      else if (k < d.A) { h.rodAB(g, v3(x, yb, ZT), v3(x, yb, ZT + 6), 0.42, OR, { hull: true }); at(kit.mesh(new T.SphereGeometry(0.75, 12, 8), OR, { hull: true, edges: false }), x, yb, ZT + 6.4, g); }
      else if (k < d.B) { h.rodAB(g, v3(x, yb, ZB), v3(x, yb, ZB - 6), 0.42, OR, { hull: true }); at(kit.mesh(new T.SphereGeometry(0.75, 12, 8), OR, { hull: true, edges: false }), x, yb, ZB - 6.4, g); }
    }
    // атомы водорода / металла
    const cam = v3(1, 0.85, 1).normalize();
    for (let i = 0; i < d.x; i++) {
      const xc = x0 + (i * Cc.v + Cc.v / 2) * u, rb = Math.min(3.2, Cc.v * u / 2 - 0.35);
      const ag = new T.Group(); at(ag, xc, yb, ZT, g); clickable(ag, 'la');
      at(kit.mesh(new T.SphereGeometry(rb, 24, 16), Cc.col, { hull: true, edges: false }), 0, 0, 0, ag);
      if (rb > 1.3) h.letter(ag, cam.x * rb * 1.02, cam.y * rb * 1.02, cam.z * rb * 1.02, Cc.s, rb * 1.25);
    }
    // кислотные остатки: бруски с наклейкой
    for (let i = 0; i < d.y; i++) {
      const xc = x0 + (i * Rr.v + Rr.v / 2) * u, w = Rr.v * u - 0.7;
      const rg = new T.Group(); at(rg, xc, yb, ZB, g); clickable(rg, 'lb');
      at(box(w, 4.4, 5, Rr.col), 0, 0, 0, rg);
      if (w > 3) { const st = h.canvasPlane(w * 0.9, 2.6, Math.round(110 * w / 2.6 * 0.5), 60, (x, a, b) => h.textLines(x, a, b, [low(Rr.s)], '#0b1019', null)); st.rotation.x = -Math.PI / 2; at(st, 0, 2.22, 0, rg);
        const st2 = h.canvasPlane(w * 0.9, 2.6, Math.round(110 * w / 2.6 * 0.5), 60, (x, a, b) => h.textLines(x, a, b, [low(Rr.s)], '#0b1019', null)); at(st2, 0, 0, 2.52, rg); }
    }
    // табло с формулой сзади
    const okc = d.ok ? (d.bad ? '#ffb547' : '#86e0a8') : d.eq ? '#ffb547' : '#e8ecf4';
    const sub = d.ok ? (d.bad ? d.name + ' — в воде не существует' : d.name) : d.eq ? 'уравнено, но индексы можно сократить' : 'есть свободные связи';
    const bd = new T.Group(); at(bd, BXc, TY, -29, g);
    at(box(1.2, 12, 1.2, C.DARK), -21, 6, 0, bd); at(box(1.2, 12, 1.2, C.DARK), 21, 6, 0, bd);
    at(box(44, 12, 1, 0x1a2232), 0, 12, 0, bd);
    const sc = h.screen(42, 10.4, [{ t: low(d.f), k: 0.8, k2: 1.6, c: okc }, { t: sub, k: 0.6, mono: false, w: 500, c: okc }], 520, 128); at(sc, 0, 12, 0.52, bd);
    tag(v3(BXc, TY + 22, -29), d.acid ? 'Формула кислоты' : 'Формула соли', d.ok ? (d.bad ? 'такой соли нет' : '✓ верно') : d.eq ? 'сократите' : 'уравняйте', d.ok && !d.bad);

    // чашки с деталями спереди
    const cb = h.dish(g, -46, TY, 30, 6, 2.2); clickable(cb.g, 'binA');
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4, rr = i === 3 ? 0 : 2.6; at(kit.mesh(new T.SphereGeometry(1.7, 18, 12), Cc.col, { hull: true, edges: false }), -46 + Math.cos(a) * rr, TY + 1.4 + (i === 3 ? 1.6 : 0), 30 + Math.sin(a) * rr, cb.g.parent).userData.click = 'binA'; }
    // все шарики в чашке — часть нажимаемой чашки
    const cbHit = new T.Group(); at(cbHit, -46, TY, 30, g); clickable(cbHit, 'binA'); at(box(12, 4, 12, 0, { mat: new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), edges: false, shadow: false }), 0, 2, 0, cbHit);
    const rbx = -14;
    const lt = new T.Group(); at(lt, rbx, TY, 30, g); clickable(lt, 'binB');
    at(box(16, 1, 11, 0xf7f9fb), 0, 0.5, 0, lt);
    at(box(16, 2.4, 0.6, 0xc9d1da), 0, 1.6, -5.2, lt); at(box(16, 2.4, 0.6, 0xc9d1da), 0, 1.6, 5.2, lt); at(box(0.6, 2.4, 10, 0xc9d1da), -7.7, 1.6, 0, lt); at(box(0.6, 2.4, 10, 0xc9d1da), 7.7, 1.6, 0, lt);
    for (let i = 0; i < 3; i++) { const bw = Math.min(4.6, 2 + Rr.v * 1.1); at(box(bw, 2.2, 3, Rr.col), -4.4 + i * 4.4, 2.1, (i % 2 ? 1.6 : -1.6), lt); }
    const arrowKey = (x, txt, k) => h.key(g, x, 40.5, 7, 5, [{ t: txt, k: 0.95, w: 700 }], 0x3b4a66, k);
    if (!d.acid) { arrowKey(-52, '‹', 'cprev'); arrowKey(-40, '›', 'cnext'); }
    arrowKey(rbx - 6, '‹', 'rprev'); arrowKey(rbx + 6, '›', 'rnext');
    tag(v3(-46, TY + 8, 30), d.acid ? 'Водород H' : `${cap(Cc.name)} ${Cc.s}`, 'валентность ' + ROM[Cc.v]);
    tag(v3(rbx, TY + 8, 30), 'Остаток ' + low(Rr.s), 'валентность ' + ROM[Rr.v]);

    // полка со склянками-целями
    const nGot = d.found.filter(f => f.got).length;
    at(box(36, 1.2, 10, 0xdfe4ec), 44, TY + 0.6, -24, g);
    d.found.forEach((f, i) => {
      const x = 33 + i * 11, fc = f.f.match(/^[A-Z][a-z]?/)[0], rc = f.f.replace(/^[A-Z][a-z]?\d?\(?/, '').replace(/\)?\d?$/, '');
      const lab = [{ t: f.got ? low(f.f) : '?', k: 0.72, k2: 1.2 }, { t: f.name.split(' ')[0], k: 0.66, mono: false, w: 500 }];
      if (d.acid) h.bottle(g, x, -24, f.got ? 0xe6eef2 : null, lab, { r: 3.6, h: 10, y: TY + 1.2, op: 0.55, cap: f.got ? 0x2f9e55 : 0x6f7a90 });
      else h.jar(g, x, TY + 1.2, -24, { kind: f.got ? 'crystals' : 'gas', col: saltCol(fc, rc), tint: 0xf4f6f8, r: 3.6, h: 9, seed: i * 5, label: lab, cap: f.got ? 0x2f9e55 : 0x6f7a90 });
    });
    tag(v3(44, TY + 18, -24), d.acid ? 'Нужные кислоты' : 'Нужные соли', `собрано ${nGot} из ${d.found.length}`, nGot === d.found.length);

    // опыт справа: лакмус в пробирке (кислоты) или выпаривание раствора соли (соли)
    if (d.acid) {
      const sx = 44, sz = 16;
      at(box(14, 1.2, 8, 0xf4f6f9), sx, TY + 0.6, sz, g);
      at(box(14, 1, 8, 0xf4f6f9), sx, TY + 11, sz, g);
      at(box(1, 10, 8, 0xf4f6f9), sx - 6.5, TY + 6, sz, g); at(box(1, 10, 8, 0xf4f6f9), sx + 6.5, TY + 6, sz, g);
      const tb = h.tube(g, sx - 3, TY + 1.2, sz, 2.4, 20, { color: LITMUS, op: 0.8, level: 9 });
      const tw = h.tube(g, sx + 3, TY + 1.2, sz, 2.4, 20, { color: LITMUS, op: 0.8, level: 9 });
      const okA = d.ok;
      if (okA) {
        let t0 = null;
        kit.onFrame((dt, t) => { if (t0 === null) t0 = t; const f = kit.reduce ? 1 : ease((t - t0) / 1.6); tb.mat.color.copy(mixC(T, LITMUS, IND_ACID, f)); });
      }
      h.pill(g, sx - 3, TY + 23, sz, okA ? low(d.f) : '?', '#1b1610', okA ? '#ffd0d0' : '#fff6e6', 2.4);
      h.pill(g, sx + 3, TY + 23, sz, 'H₂O', '#1b1610', '#fff6e6', 2.4);
      tag(v3(sx, TY + 30, sz), 'Лакмус', okA ? 'в кислоте красный' : 'в воде фиолетовый', okA);
    } else {
      const sx = 46, sz = 16;
      const tp = h.tripod(g, sx, sz, 11);
      const lamp = h.spirit(g, sx, TY, sz, 0.8);
      const can = d.ok && !d.bad, col = saltCol(Cc.s, Rr.s);
      const sol = h.liquid(g, sx, tp.dishY + 0.3, sz, 4, col === 0xfafaf6 ? 0xdfeaf2 : col, 0.55); sol.m.geometry = kit.keep(new T.CylinderGeometry(4.6, 2.6, 1, 32));
      const cr = can ? h.crystals(g, sx, tp.dishY, sz, 3.4, col) : null;
      const vap = h.steam(g, sx, tp.dishY + 2, sz, { n: 6, spread: 4, size: 3, rise: 10, op: 0.5, amt: 0 });
      let t0 = null;
      kit.onFrame((dt, t) => {
        if (t0 === null) t0 = t;
        const s = kit.reduce || !can ? 9 : t - t0, f = clamp(s / 3.5, 0, 1);
        lamp.set(can && s < 3.8 ? 1 : 0); vap.set(can && s < 3.5 ? 1 : 0);
        sol.set(can ? 1.8 * (1 - f) : 0, tp.dishY + 0.3); if (cr) cr.set(f);
      });
      tag(v3(sx, TY + 17, sz + 4), 'Выпаривание', can ? 'кристаллы ' + low(d.f) : d.bad ? 'соль в воде не существует' : 'соберите формулу', can);
    }
  }
  const cap = s => s[0].toUpperCase() + s.slice(1);
  SC['chcl-acids'] = builder;
  SC['chcl-salts'] = builder;

  // =====================================================================================
  // 3. ОСНОВАНИЯ И ИНДИКАТОРЫ: штатив с пробирками А, Б, В, склянки-капельницы, таблица окрасок
  // =====================================================================================
  SC['chcl-bases'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const TX = [-28, -8, 12], TZ = -2, RT = 2.8, TH = 24, LV = 12;
    // белый пластиковый штатив
    at(box(60, 1, 9, 0xf4f6f9), -8, TY + 0.5, TZ, g);
    at(box(60, 1, 9, 0xf4f6f9), -8, TY + 15, TZ, g);
    at(box(1.2, 14, 9, 0xf4f6f9), -37.4, TY + 8, TZ, g); at(box(1.2, 14, 9, 0xf4f6f9), 21.4, TY + 8, TZ, g);
    const live0 = live() || { si: -1, age: 1e9 };
    d.tubes.forEach((tu, i) => {
      const x = TX[i];
      at(cyl(RT + 0.3, 0.12, 0x2c3240, { edges: false, hull: false, shadow: false }), x, TY + 15.55, TZ, g);
      const fin = tu.col ?? 0xdde9f2, op = tu.col ? 0.85 : 0.35;
      const t = h.tube(g, x, TY + 1, TZ, RT, TH, { color: fin, op, level: LV, glass: 0.16 });
      clickable(t.g, 'tube-' + i);
      h.pill(g, x, TY + TH + 3, TZ, ['А', 'Б', 'В'][i] + '\n' + (tu.ind ? tu.cn : 'без индикатора'), '#1b1610', d.sel ? '#ffe9b0' : '#fff6e6', 3.6);
      if (d.sel) h.beacon(g, x, TY + 1, TZ, 4.4);
      // капля: пипетка над пробиркой, окраска расходится сверху вниз
      if (live0.si === i && live0.age < 2.5 && tu.ind) {
        const ic = d.inds.find(x2 => x2.k === tu.ind);
        const pip = new T.Group(); at(pip, x, TY + TH + 4, TZ, g);
        at(cyl(0.35, 8, 0xd8eef8, { r2: 0.35, edges: false, matOpt: { transparent: true, opacity: 0.6 } }), 0, 0, 0, pip);
        at(cyl(1.25, 1, 0x2c3240, { seg: 16 }), 0, 4.5, 0, pip);
        const bl = kit.mesh(new T.SphereGeometry(1.25, 16, 12), 0xd8452e, { hull: true, edges: false }); bl.scale.y = 1.5; at(bl, 0, 6.4, 0, pip);
        const drop = kit.mesh(new T.SphereGeometry(0.45, 10, 8), ic ? ic.stock : 0xffffff, { hull: false, edges: false }); at(drop, x, 0, TZ, g);
        const top = h.liquid(g, x, TY + 1 + LV - 4, TZ, RT - 0.35, ic ? ic.stock : fin, 0.8);
        top.set(0);
        t.mat.color.setHex(0xdde9f2); t.mat.opacity = 0.35;
        kit.onFrame(() => {
          const L = live() || { age: 9 }, a = L.si === i ? L.age : 9;
          const s = kit.reduce ? 9 : a;
          pip.visible = s < 1.6; drop.visible = s < 0.9;
          drop.position.y = TY + TH + 0.5 - (TH - LV + 0.5) * clamp(s / 0.9, 0, 1) ** 2;
          const f = clamp((s - 0.8) / 1.2, 0, 1);
          top.set(f < 1 && s > 0.8 ? 1 + (LV - 3) * f : 0, TY + 1 + LV - 1 - (LV - 3) * f);
          if (tu.col != null) top.mat.color.setHex(tu.col);
          t.mat.color.copy(mixC(T, 0xdde9f2, fin, f)); t.mat.opacity = 0.35 + (op - 0.35) * f;
        });
      }
      // табличка-ответ
      const ok = d.verified, lb = tu.lab;
      h.key(g, x, 13, 15, 5.4, [lb || 'ответ ?'], ok ? 0x2f9e55 : lb ? 0x3b4a66 : 0x9aa3b4, 'tag-' + i);
    });

    // склянки с индикаторами справа
    d.inds.forEach((ic, j) => {
      const z = -20 + j * 15, x = 44, sel = d.sel === ic.k;
      const dr = h.dropper(g, x, z, ic.stock, ic.k === 'ph' ? 0.25 : 0.8, ic.name);
      clickable(dr.g, 'ind-' + ic.k);
      if (sel) {
        h.ring(g, x, z, 4.6);
        if (kit.reduce) dr.pip.position.y += 6; else { const y0 = dr.pip.position.y; kit.onFrame((dt, t) => { dr.pip.position.y = y0 + 6 + 0.5 * Math.sin(t * 3); }); }
      }
    });
    const si = d.inds.find(x => x.k === d.sel);
    tag(v3(44, TY + 22, -20), 'Индикаторы', si ? 'взят ' + si.name + ' → пробирка' : 'нажмите склянку', !!si);

    // таблица окрасок
    const tb = h.canvasPlane(22, 15, 440, 300, (x, W, Hh) => {
      x.fillStyle = '#fffaf0'; x.beginPath(); x.roundRect(2, 2, W - 4, Hh - 4, 16); x.fill(); x.strokeStyle = '#1b1610'; x.lineWidth = 5; x.stroke();
      x.fillStyle = '#1b1610'; x.font = '600 26px "Golos Text", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      const cols = ['кислота', 'вода', 'щёлочь'], rows = [['лакмус', '#e0464a', '#8a5cc8', '#3b6fe0'], ['м.-оранж', '#e8506a', '#f08a2a', '#f2d23a'], ['ф.-фталеин', null, null, '#d8287a']];
      cols.forEach((c, i) => x.fillText(c, 175 + i * 92, 44));
      rows.forEach((r, j) => {
        const y = 110 + j * 70; x.textAlign = 'left'; x.fillStyle = '#1b1610'; x.fillText(r[0], 18, y); x.textAlign = 'center';
        for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(175 + i * 92, y, 24, 0, Math.PI * 2); x.fillStyle = r[i + 1] || '#f4f6f8'; x.fill(); x.lineWidth = 3; x.strokeStyle = '#1b1610'; x.stroke(); }
      });
    });
    tb.rotation.x = -Math.PI / 2 + 0.3; at(tb, -48, TY + 2.4, 20, g);
    at(box(20, 1.2, 1.6, 0x3b4a66), -48, TY + 0.6, 26.6, g);
    h.washBottle(g, -50, -24);
    h.key(g, -18, 32, 16, 6, ['Промыть'], 0x2f86e0, 'wash');
    h.key(g, 30, 30, 18, 6, [d.verified ? '✓ Верно' : 'Проверить'], d.verified ? 0x2f9e55 : 0xe08a2a, 'verify');
    if (d.verified) tag(v3(30, TY + 6, 30), 'Проверка', 'все растворы определены', true);
  };

  // =====================================================================================
  // 5 и 6. ГЕНЕТИЧЕСКИЕ РЯДЫ: Ca → CaO → Ca(OH)₂ → CaCl₂ и P → P₂O₅ → H₃PO₄ → Na₃PO₄
  // =====================================================================================
  const ROWCFG = [
    { el: 0xc9ccd0, kind: 'lumps', prod: 0xf6f3ea, fl: ['#ffd8b0', '#ff5a2a'], gl: 0xff6a3a, smoke: 0.4,
      ind: 'фенолфталеин', c1: PHPH, c2: 0xe8f0f4, c2op: 0.35, turb: 0xf2f2ee, salt: 0xfafaf6, title: 'РЯД МЕТАЛЛА', other: 'Ряд неметалла',
      saw: ['кальций в банке', 'кальций горит красным', 'щёлочь: фенолфталеин малиновый', 'нейтрализация: окраска пропала'] },
    { el: 0xb5452e, kind: 'powder', prod: 0xfbfbf8, fl: ['#ffffff', '#ffd23a'], gl: 0xffffff, smoke: 1,
      ind: 'лакмус', c1: IND_ACID, c2: LITMUS_ALK, c2op: 0.8, turb: null, salt: 0xfafaf6, title: 'РЯД НЕМЕТАЛЛА', other: 'Ряд металла',
      saw: ['красный фосфор', 'фосфор горит, белый дым', 'кислота: лакмус красный', 'соль: лакмус синий'] },
  ];
  function rowScene(kit, d) {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3, cf = ROWCFG[d.row];
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const P = d.prog, N = d.nodes, SZ = -6;
    const XS = [-48, -24, 4, 34];
    const L0 = live() || { age: 1e9 }, age0 = L0.age, recent = age0 < 9 && !kit.reduce;
    const ageNow = () => { const L = live(); return kit.reduce ? 99 : L ? L.age : 99; };
    // 0. склянка с простым веществом
    h.jar(g, XS[0], TY, SZ, { kind: cf.kind, col: cf.el, r: 4.2, h: 9, seed: 3, label: low(N[0].f) });
    // 1. банка для сжигания с ложкой
    const JR = 5.2, JH = 14, gj = h.gasJar(g, XS[1], TY, SZ, JR, JH);
    const sp = h.spoon(g, JR + 1.2); sp.g.position.set(XS[1], gj.top + 0.35 - sp.diskY, SZ);
    const cupY = sp.g.position.y + 0.9;
    const blob = kit.mesh(new T.SphereGeometry(1.15, 16, 10), 0, { mat: h.ownMat(P >= 1 ? cf.prod : cf.el), hull: true, edges: false });
    blob.scale.y = 0.7; at(blob, XS[1], cupY + 0.5, SZ, g);
    blob.visible = d.row === 0 ? P < 2 : P < 1;
    if (P >= 1) { const o2 = h.canvasPlane(5.6, 2.6, 200, 92, (x, a, b) => h.textLines(x, a, b, ['O₂'], '#1b1610', '#e8f2ff', { round: 12 })); at(o2, XS[1], TY + 4, SZ + JR + 0.08, g); }
    // фосфорный ангидрид — белый туман в банке, пока его не растворили
    gj.fog.material.opacity = d.row === 1 && P === 1 ? 0.42 : 0;
    // 2. стакан под бюреткой
    const BR = 5.6, BH = 13, bk = h.beaker(g, XS[2], TY, SZ, BR, BH);
    h.stand(g, XS[2] + 2, SZ - 13, 40, [{ y: TY + 33, to: v3(XS[2], 0, SZ) }]);
    const reag3 = d.steps[2].r;
    const bu = h.burette(g, XS[2], SZ, TY + BH + 2, 22, 0xe6eef2);
    bu.set(P >= 3 ? 0.55 : 0);
    if (P >= 3) { const bl = h.canvasPlane(4.4, 2.2, 200, 100, (x, a, b) => h.textLines(x, a, b, [low(reag3)], '#1b1610', '#fff6e6', { round: 10 })); at(bl, XS[2] + 1.6, TY + BH + 18, SZ + 1.05, g); }
    const LV = 8, sol = h.liquid(g, XS[2], TY + 0.6, SZ, BR - 0.4, P >= 3 ? cf.c2 : cf.c1, P >= 3 ? cf.c2op : 0.82);
    sol.set(P >= 2 ? LV : 0);
    const turb = cf.turb && P >= 2 ? cyl(BR - 0.6, 0.9, cf.turb, { edges: false, hull: false }) : null;
    if (turb) at(turb, XS[2], TY + 1.05, SZ, g);
    const drops = kit.mesh(new T.SphereGeometry(0.4, 10, 8), 0xe6eef2, { hull: false, edges: false }); at(drops, XS[2], 0, SZ, g); drops.visible = false;
    // 3. треножник с фарфоровой чашкой и спиртовкой
    const tp = h.tripod(g, XS[3], SZ, 11), lamp = h.spirit(g, XS[3], TY, SZ, 0.8);
    const cr = P >= 3 ? h.crystals(g, XS[3], tp.dishY, SZ, 3.4, cf.salt) : null;
    const dsol = h.liquid(g, XS[3], tp.dishY + 0.3, SZ, 4, 0xdfeaf2, 0.55); dsol.m.geometry = kit.keep(new T.CylinderGeometry(4.6, 2.6, 1, 32)); dsol.set(0);
    const vap = h.steam(g, XS[3], tp.dishY + 2, SZ, { n: 6, spread: 4, size: 3, rise: 10, op: 0.5, amt: 0 });

    // формулы над местами ряда
    N.forEach((n, i) => {
      const got = i <= P, y = [TY + 15, TY + 34, TY + 44, TY + 22][i];
      if (i === P + 1) return;
      h.pill(g, XS[i], y, SZ, (got ? low(n.f) : '?') + '\n' + n.cl, '#1b1610', got ? (i === 3 ? '#b8f0c8' : '#fff6e6') : '#e3e7ee', 4);
    });
    // стрелки на подносе
    for (let i = 0; i < 3; i++) {
      const done = i < P, act = i === P, x = (XS[i] + XS[i + 1]) / 2;
      const ar = h.canvasPlane(12, 5, 300, 125, (cx, W, Hh) => {
        const col = done ? '#2f9e55' : act ? '#e08a2a' : '#9aa3b4';
        cx.strokeStyle = col; cx.fillStyle = col; cx.lineWidth = 9; cx.beginPath(); cx.moveTo(20, 92); cx.lineTo(258, 92); cx.stroke();
        cx.beginPath(); cx.moveTo(282, 92); cx.lineTo(244, 70); cx.lineTo(244, 114); cx.closePath(); cx.fill();
        cx.font = '700 46px "IBM Plex Mono", monospace'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
        cx.fillText(done ? '+' + low(d.steps[i].r) : act ? '+ ?' : '', 150, 38);
      });
      ar.rotation.x = -Math.PI / 2; at(ar, x, TY + 0.2, 13, g);
    }
    // активное место ряда светится и нажимается
    if (P < 3) {
      const ax = XS[P + 1], r = P === 0 ? 7.5 : P === 1 ? 7.6 : 8.6;
      h.beacon(g, ax, TY, SZ, r, d.selR ? 0x72d4e8 : 0xffd166);
      const hit = new T.Mesh(kit.keep(new T.CylinderGeometry(r, r, 26, 20)), kit.keep(new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })));
      at(hit, ax, TY + 13, SZ, g); clickable(hit, 'st');
      if (P === 2) clickable(bk.g, 'st'); if (P === 1) clickable(bk.g, 'st'); if (P === 0) clickable(gj.g, 'st');
    }

    // реактивы спереди
    d.reag.forEach((r, i) => {
      const x = -50 + i * 20, z = 28, sel = d.selR === r.k;
      const rg = new T.Group(); at(rg, x, 0, z, g); clickable(rg, 'rg-' + r.k);
      const body = new T.Group(); rg.add(body);
      if (r.k === 'O2') h.cylinder(body, 0, 0, 0x5fb4ff, 'O₂');
      else if (r.k === 'CO2') h.cylinder(body, 0, 0, 0x2c3240, 'CO₂');
      else if (r.k === 'H2O') h.washBottle(body, 0, 0);
      else if (r.k === 'NaCl') h.jar(body, 0, TY, 0, { kind: 'crystals', col: 0xfafaf6, r: 3.6, h: 8, seed: 11, label: 'NaCl' });
      else h.bottle(body, 0, 0, 0xe6eef2, low(r.k), { r: 3.4, h: 10, op: 0.5, cap: r.k === 'NaOH' ? 0x3b6fd8 : 0xd8452e });
      h.card(rg, 0, 9.5, 12, 4.4, [{ t: low(r.k), k: 0.7, k2: 1.3 }, { t: r.name, k: 0.62, mono: false, w: 500 }], '#1b1610', sel ? '#ffe9b0' : '#fff6e6', 0.55).position.y -= 0;
      if (sel) { h.ring(rg, 0, 0, 5); if (kit.reduce) body.position.y = 2; else kit.onFrame((dt, t) => { body.position.y = 2 + 0.5 * Math.sin(t * 3); }); }
    });

    // табло ряда сзади и переключатель ряда
    // табличка-переключатель ряда (стоит сзади справа)
    const sw = new T.Group(); at(sw, 50, TY, -28, g); clickable(sw, 'row');
    at(box(18, 1.2, 6, C.DARK), 0, 0.6, 0, sw);
    const pl = new T.Group(); at(pl, 0, 1.2, 0, sw); pl.rotation.x = -0.3;
    at(box(20, 11, 1, 0x3b4a66), 0, 5.5, 0, pl);
    const sc = h.screen(19, 10, [{ t: cf.title + (P >= 3 ? ' ✓' : ''), k: 0.55, mono: false, c: P >= 3 ? '#86e0a8' : '#8b96ad' }, { t: '⇄ ' + cf.other, k: 0.62, mono: false, k2: 1.3 }, { t: `там пройдено ${d.other} из 3`, k: 0.5, mono: false, w: 500, c: '#ffd166' }], 380, 200, '#2a3550');
    at(sc, 0, 5.5, 0.52, pl);

    // подписи
    const step = d.steps[Math.min(P, 2)];
    if (P < 3) {
      const sr = d.reag.find(r => r.k === d.selR);
      tag(v3(XS[P + 1], [TY + 34, TY + 44, TY + 22][P], SZ), `? ${N[P + 1].cl}`, sr ? `добавить ${low(sr.k)} — нажмите сюда` : 'какой нужен реактив?', !!sr);
    }
    if (P > 0) tag(P >= 3 ? v3(XS[3] - 4, TY + 4, SZ + 10) : v3(XS[P], TY + (P === 1 ? 19 : 17), SZ + 4), P >= 3 ? 'Ряд пройден' : 'Сделано', d.steps[P - 1].eq, P >= 3);
    tag(v3(-50, TY + 18, 28), 'Реактивы', d.selR ? 'взят ' + low(d.selR) : 'возьмите нужный');

    // анимация последнего шага: горение, растворение, нейтрализация и выпаривание
    if (!recent || P === 0) return;
    const stp = P - 1;
    if (stp === 0) {
      const fl = h.flame(g, XS[1], cupY + 0.6, SZ, 10, cf.fl[0], cf.fl[1], cf.gl);
      const em = h.glow(cf.gl, 16, 0); at(em, XS[1], cupY + 1, SZ, g);
      const light = new T.PointLight(cf.gl, 0, 60, 1.2); at(light, XS[1], cupY + 5, SZ, g);
      const smoke = h.steam(g, XS[1], cupY + 2, SZ, { n: 8, spread: 4.5, size: 3.6, rise: JH - 5, op: 0.6 * cf.smoke, amt: 0, color: 0xf6f6f6 });
      kit.onFrame(() => {
        const s = ageNow(), burn = clamp((s - 0.3) / 4, 0, 1), on = s > 0.3 && s < 4.6;
        const k = on ? Math.min(1, (s - 0.3) * 3, (4.6 - s) * 2.5) : 0;
        fl.visible = k > 0.02; fl.userData.k = Math.max(0.05, k);
        em.material.opacity = k * 0.7; light.intensity = k * (cf.gl === 0xffffff ? 160 : 80);
        smoke.set(on ? 1 : 0);
        blob.material.color.copy(mixC(T, cf.el, cf.prod, burn));
        if (d.row === 1) { gj.fog.material.opacity = 0.42 * ease(burn); blob.visible = s < 4.4; const k2 = 1 - 0.85 * burn; blob.scale.set(k2, 0.7 * k2, k2); }
      });
    } else if (stp === 1) {
      // вода из промывалки льётся в стакан, затем окраска индикатора
      const wb = h.washBottle(g, XS[2] - 10, SZ);
      const strm = cyl(0.35, 1, 0xbfe0f5, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.8 } }); at(strm, XS[2] - 3, 0, SZ, g);
      kit.onFrame(() => {
        const s = ageNow(), pour = clamp((s - 0.5) / 1.6, 0, 1), on = s > 0.5 && s < 2.1;
        const lift = Math.min(1, s * 2, Math.max(0, (3 - s) * 2));
        wb.visible = s < 3; wb.position.set(XS[2] - 10 + 2 * lift, TY + 8 * lift, SZ); wb.rotation.z = -0.9 * lift;
        strm.visible = on; if (on) { const yb = TY + 0.6 + LV * pour, yt = TY + BH + 3; strm.scale.y = yt - yb; strm.position.y = (yt + yb) / 2; }
        sol.set(LV * pour);
        const c = clamp((s - 2.2) / 1.6, 0, 1);
        sol.mat.color.copy(mixC(T, 0xdfeaf2, cf.c1, c)); sol.mat.opacity = 0.4 + 0.42 * c;
        if (turb) turb.scale.y = Math.max(0.05, 1 - c * 0.5);
        blob.visible = d.row === 0 && s < 0.5;
        if (d.row === 1) gj.fog.material.opacity = 0.42 * (1 - clamp(s / 1.5, 0, 1));
      });
    } else {
      // капли из бюретки, окраска меняется, затем раствор выпаривают
      const bub = h.bubbles(g, XS[2], TY + 0.8, SZ, BR - 2, 8);
      kit.onFrame((dt, t) => {
        const s = ageNow(), drip = clamp(s / 3, 0, 1);
        bu.set(1 - 0.45 * drip);
        drops.visible = s < 3; drops.position.y = TY + BH + 1.5 - ((t * 2.2) % 1) * (BH - LV + 1);
        bub.set(s < 3 ? 0.6 : 0, LV - 0.4, 0.35, 1);
        sol.mat.color.copy(mixC(T, cf.c1, cf.c2, clamp((s - 0.6) / 2.2, 0, 1))); sol.mat.opacity = 0.82 + (cf.c2op - 0.82) * clamp((s - 0.6) / 2.2, 0, 1);
        const ev = clamp((s - 3.4) / 4, 0, 1), hot = s > 3.2 && s < 7.6;
        lamp.set(hot ? 1 : 0); vap.set(hot ? 1 : 0);
        dsol.set(s > 3.2 ? 1.8 * (1 - ev) : 0, tp.dishY + 0.3); if (cr) cr.set(ev);
      });
    }
  }
  SC['chcl-rowm'] = rowScene;
  SC['chcl-rown'] = rowScene;
})();
