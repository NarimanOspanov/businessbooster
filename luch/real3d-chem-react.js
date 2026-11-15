// «Как в жизни» для тем «Химические реакции» (labs/chem-equations) и «Скорость и равновесие» (labs/chem-kinetics):
// белый лабораторный поднос, стеклянная посуда с растворами, пузырьки газа, осадок, пламя, весы, шприцы и ампулы.
// Сцены строятся из window.LUCH_REAL() опыта; быстрые значения (ход опыта, показания весов, концентрации) —
// из LUCH_REAL.live() в onFrame.
(() => {
  const SC = window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {};
  const live = () => { try { return window.LUCH_REAL.live ? window.LUCH_REAL.live() : null; } catch (e) { return null; } };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (x, n) => { let s = (Math.round(x * 10 ** n) / 10 ** n).toFixed(n); if (/^-0(\.0+)?$/.test(s)) s = s.slice(1); return s.replace('.', ',').replace('-', '−'); };
  const rnd = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const ease = x => x * x * (3 - 2 * x);
  const SUBD = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
  const lowF = s => String(s).replace(/([A-Za-z)])(\d+)/g, (m, a, dg) => a + dg.replace(/\d/g, x => SUBD[x]));
  const hexN = s => typeof s === 'number' ? s : parseInt(String(s).slice(1), 16);
  const TY = 1.2; // верх подноса

  // ---------- общие детали ----------
  function H(kit) {
    const { T, at, box, cyl, mesh, keep, grad, glowTex, textTex, clickable, toon, C } = kit;
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    const v2 = (x, y) => new T.Vector2(x, y);
    const glassMat = (color = 0xd8eef8, opacity = 0.26) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, transparent: true, opacity, side: T.DoubleSide, depthWrite: false }));
    const ownMat = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, ...o }));
    const spr = (map, color, opacity, add) => new T.Sprite(keep(new T.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending })));
    const glow = (color, size, opacity) => { const s = spr(glowTex(), color, opacity, true); s.scale.setScalar(size); return s; };
    const flat = (w, h, tex) => new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: keep(tex), transparent: true })));
    function rodAB(parent, a, b, r, color, o = {}) {
      const dv = b.clone().sub(a), L = dv.length();
      const m = cyl(r, L, color, { edges: false, ...o });
      m.quaternion.setFromUnitVectors(v3(0, 1, 0), dv.normalize());
      return at(m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, parent);
    }
    // табличка/табло на холсте: draw(ctx, w, h) или текст строками
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
      if (o.border) { x.strokeStyle = o.border; x.lineWidth = o.bw || 6; x.beginPath(); x.roundRect(o.bw / 2 || 3, o.bw / 2 || 3, pw - (o.bw || 6), ph - (o.bw || 6), o.round || 8); x.stroke(); }
      const lh = ph / lines.length;
      lines.forEach((ln, i) => {
        const t = typeof ln === 'string' ? { t: ln } : ln;
        let fs = Math.round(lh * (t.k || 0.62)); const font = s => `${t.w || 600} ${s}px ${t.mono === false ? '"Golos Text", sans-serif' : '"IBM Plex Mono", monospace'}`;
        x.font = font(fs); const tw = x.measureText(t.t).width; if (tw > pw * 0.9) { fs = Math.floor(fs * pw * 0.9 / tw); x.font = font(fs); }
        x.fillStyle = t.c || fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t.t, pw / 2, lh * (i + 0.5) + 2);
      });
    };
    function screen(w, h, txt, fg = '#86e0a8', pw = 320, ph = 120, bg = '#0e1520') {
      const m = canvasPlane(w, h, pw, ph);
      let cur = null;
      m.userData.set = (t, col = fg) => { t = String(t); if (cur === t + col) return; cur = t + col; m.userData.draw((x, a, b) => textLines(x, a, b, t.split('\n'), col, bg)); };
      m.userData.set(txt); return m;
    }
    // кнопка с надписью сверху
    function button(parent, x, y, z, label, color, key, w = 4.2, d = 3.6, fg = '#ffffff') {
      const b = new T.Group(); at(b, x, y, z, parent);
      at(box(w, 1.4, d, color), 0, 0.7, 0, b);
      const top = flat(w * 0.88, d * 0.78, textTex(label, fg, '#' + color.toString(16).padStart(6, '0'), Math.round(64 * w / d * 1.6), 100));
      top.rotation.x = -Math.PI / 2; at(top, 0, 1.42, 0, b);
      clickable(b, key); return b;
    }
    // пламя (спиртовка, лучинка)
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
      if (!kit.reduce) kit.onFrame((dt, t) => { s.scale.set(hgt * 0.5 * (1 + 0.08 * Math.sin(t * 17)), hgt * (1 + 0.12 * Math.sin(t * 13) + 0.05 * Math.sin(t * 29)), 1); });
      return g;
    }
    // дым/пар: клубы поднимаются и тают
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
    // пузырьки в жидкости
    function bubbles(parent, x, y0, z, r, n = 8) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const geo = keep(new T.SphereGeometry(1, 10, 8)), mat = keep(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }));
      const bs = [];
      for (let i = 0; i < n; i++) { const m = new T.Mesh(geo, mat); m.visible = false; g.add(m); bs.push({ m, ph: rnd(i + 11), a: rnd(i + 21) * Math.PI * 2, rr: Math.sqrt(rnd(i + 31)) * r }); }
      const st = { amt: 0, top: 5, big: 0.5, speed: 0.6, rf: null };
      kit.onFrame((dt, t) => {
        const k = Math.round(st.amt * n);
        bs.forEach((b, i) => {
          b.m.visible = i < k && st.top > 1.2; if (!b.m.visible) return;
          const ph = kit.reduce ? b.ph : (t * st.speed + b.ph) % 1, y = 0.4 + ph * (st.top - 0.9);
          const rr = st.rf ? Math.min(b.rr, st.rf(y)) : b.rr;
          b.m.scale.setScalar(st.big * (0.4 + 0.9 * ph));
          b.m.position.set(Math.cos(b.a) * rr + 0.3 * Math.sin(t * 5 + i), y, Math.sin(b.a) * rr);
        });
      });
      return { g, set(a, top, big = 0.5, speed = 0.6) { Object.assign(st, { amt: a, top, big, speed }); }, shape(f) { st.rf = f; } };
    }
    // жидкость: цилиндр единичной высоты
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
      wall.add(new T.Mesh(wall.geometry, kit.hullMat));
      at(cyl(r * 0.97, 0.6, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.45 } }), 0, 0.3, 0, g);
      const rim = mesh(new T.TorusGeometry(r, 0.22, 6, 40), 0xeef6fb, { edges: false }); rim.rotation.x = Math.PI / 2; at(rim, 0, h, 0, g);
      const a = 0.35;
      for (let k = 1; k <= 5; k++) { const m = box(k % 2 ? 1.1 : 2, 0.16, 0.1, 0x6f8098, { edges: false, shadow: false }); m.rotation.y = a; at(m, Math.sin(a) * (r + 0.05), h * k / 6.5, Math.cos(a) * (r + 0.05), g); }
      return { g, r, h };
    }
    // термометр: шарик, столбик, шкала
    function thermo(parent, x, y0, z, len, lo, hi, v) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      at(new T.Mesh(keep(new T.SphereGeometry(1.0, 16, 12)), toon(0xe0473a)), 0, 0, 0, g);
      at(cyl(0.72, len, 0xeef6fb, { matOpt: { transparent: true, opacity: 0.55 } }), 0, len / 2 + 0.6, 0, g);
      at(box(1.0, len - 1.6, 0.1, 0xfffaf0, { edges: false, shadow: false }), 0, len / 2 + 0.8, -0.34, g);
      const col = cyl(0.3, 1, 0xe0473a, { edges: false, hull: false, shadow: false }); at(col, 0, 1, 0.05, g);
      const span = len - 2.4, n = Math.round((hi - lo) / 10);
      for (let k = 0; k <= n; k++) at(box(k % 5 === 0 ? 1.2 : 0.7, 0.14, 0.1, 0x1b1610, { edges: false, shadow: false }), 0.35, 1.2 + span * k / n, 0.64, g);
      const set = t => { const f = clamp((t - lo) / (hi - lo), 0, 1), hh = 0.3 + span * f; col.scale.y = hh; col.position.y = 0.9 + hh / 2; };
      set(v); return { g, set, top: y0 + len + 1 };
    }
    // лабораторный штатив: основание, стержень, лапки к точкам
    function stand(parent, x, z, Hh, arms) {
      at(box(11, 1.2, 8, C.DARK), x, TY + 0.6, z, parent);
      at(cyl(0.65, Hh, C.STEEL, { edges: false }), x, TY + 1.2 + Hh / 2, z, parent);
      arms.forEach(a => {
        rodAB(parent, v3(x, a.y, z), v3(a.to.x, a.y, a.to.z), 0.42, C.STEEL);
        at(box(2.2, 2.2, 2.2, C.DARK), x, a.y, z, parent);
        if (a.ring) { const rg = mesh(new T.TorusGeometry(a.ring, 0.45, 8, 28), 0x3b4a66, { edges: false, hull: true }); rg.rotation.x = Math.PI / 2; at(rg, a.to.x, a.y, a.to.z, parent); }
        else at(box(2.6, 2.4, 2.6, 0x3b4a66), a.to.x, a.y, a.to.z, parent);
      });
    }
    // электроплитка
    function hotplate(parent, x, z, o = {}) {
      const w = o.w || 26, dd = o.d || 22, hb = 5, R = o.r || 9.5, g = new T.Group(); at(g, x, TY, z, parent);
      for (const [fx, fz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) at(cyl(1, 0.8, C.DARK, { edges: false }), fx * (w / 2 - 2.2), 0.4, fz * (dd / 2 - 2.2), g);
      at(box(w, hb, dd, 0x3b4a66), 0, 0.8 + hb / 2, 0, g);
      const top = 0.8 + hb;
      at(cyl(R, 1.0, o.cool ? 0xcfe8f6 : 0x2c3240), 0, top + 0.5, 0, g);
      const ringMat = keep(new T.MeshBasicMaterial({ color: o.on ? 0xff5a2a : o.cool ? 0x8fd0ff : 0x454e62 }));
      [R * 0.4, R * 0.7].forEach(rr => { const tr = new T.Mesh(keep(new T.TorusGeometry(rr, 0.26, 6, 36)), ringMat); tr.rotation.x = Math.PI / 2; at(tr, 0, top + 1.02, 0, g); });
      const lamp = new T.Mesh(keep(new T.SphereGeometry(0.8, 12, 8)), keep(new T.MeshBasicMaterial({ color: o.on ? 0xff4a3a : o.cool ? 0x5fb4ff : 0x5a2a2a })));
      at(lamp, -w / 2 + 3, 0.8 + hb * 0.55, dd / 2 + 0.2, g);
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
      const wall = new T.Mesh(geo, glassMat(0xd8eef8, 0.3)); g.add(wall); wall.add(new T.Mesh(geo, kit.hullMat));
      const lm = ownMat(o.color ?? 0xcfe2f0, { transparent: true, opacity: o.op ?? 0.7, depthWrite: false });
      const ri = r - 0.3;
      const bot = new T.Mesh(keep(new T.SphereGeometry(ri, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), lm); at(bot, 0, r, 0, g);
      const body = new T.Mesh(keep(new T.CylinderGeometry(ri, ri, 1, 24)), lm); at(body, 0, r, 0, g);
      const set = lv => { bot.visible = lv > 0.3; const hb = lv - r; body.visible = hb > 0.05; if (body.visible) { body.scale.y = hb; body.position.y = r + hb / 2; } };
      set(o.level ?? 0);
      return { g, r, h, ri, mat: lm, set };
    }
    // коническая колба (Эрленмейера)
    function flask(parent, x, y0, z, R, h, rn) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const hc = h * 0.62;
      const geo = keep(new T.LatheGeometry([v2(0.001, 0), v2(R - 0.9, 0), v2(R, 0.9), v2(rn, hc), v2(rn, h), v2(rn + 0.4, h + 0.2)], 40));
      const wall = new T.Mesh(geo, glassMat(0xd8eef8, 0.26)); g.add(wall); wall.add(new T.Mesh(geo, kit.hullMat));
      const rAt = y => y < 0.9 ? R : y < hc ? R + (rn - R) * (y - 0.9) / (hc - 0.9) : rn;
      const fill = (level, color, op = 0.6) => {
        const mat = ownMat(color, { transparent: true, opacity: op, depthWrite: false });
        const m = new T.Mesh(keep(new T.CylinderGeometry(rAt(level) - 0.35, R - 0.5, level - 0.3, 36)), mat); at(m, 0, 0.3 + (level - 0.3) / 2, 0, g);
        return { m, mat };
      };
      return { g, R, h, rn, rAt, fill, top: y0 + h };
    }
    // шприц: собран вдоль +y (носик внизу), set(f) — поршень 0..1
    function syringe(parent, L, r, gasCol) {
      const g = new T.Group(); parent.add(g);
      at(cyl(0.55, 1.6, 0xeef6fb, { edges: false }), 0, 0.8, 0, g);
      at(cyl(r, 0.5, 0xd8eef8, { r2: r, matOpt: { transparent: true, opacity: 0.5 } }), 0, 1.75, 0, g);
      const bw = new T.Mesh(keep(new T.CylinderGeometry(r, r, L, 28, 1, true)), glassMat(0xd8eef8, 0.24)); at(bw, 0, 1.5 + L / 2, 0, g); bw.add(new T.Mesh(bw.geometry, kit.hullMat));
      at(box(r * 2 + 5, 0.8, r * 1.6, 0xeef6fb), 0, 1.5 + L, 0, g);
      for (let k = 1; k < 10; k++) at(box(k % 5 ? 0.9 : 1.8, 0.14, 0.12, 0x2c3240, { edges: false, shadow: false }), 0, 1.5 + L * k / 10, r + 0.05, g);
      const gm = ownMat(gasCol ?? 0xffffff, { transparent: true, opacity: gasCol == null ? 0 : 0.3, depthWrite: false });
      const gas = new T.Mesh(keep(new T.CylinderGeometry(r - 0.3, r - 0.3, 1, 24)), gm); at(gas, 0, 2, 0, g);
      const pg = new T.Group(); at(pg, 0, 2, 0, g);
      at(cyl(r - 0.15, 1.4, 0x2c3240, { seg: 24 }), 0, 0.7, 0, pg);
      at(cyl(0.55, L + 1, 0xeef6fb, { edges: false }), 0, 1.4 + (L + 1) / 2, 0, pg);
      at(cyl(r + 0.6, 0.7, 0xeef6fb, { seg: 24 }), 0, L + 2.6, 0, pg);
      const set = f => { const y = 2 + clamp(f, 0, 1) * (L - 2); pg.position.y = y; gas.scale.y = Math.max(0.05, y - 2); gas.position.y = 2 + (y - 2) / 2; };
      set(0);
      return { g, set, gas, gm, L };
    }
    // шланг по точкам
    function hose(parent, pts, r = 0.6, color = 0x3a2a24) {
      const curve = new T.CatmullRomCurve3(pts, false, 'centripetal');
      return at(mesh(new T.TubeGeometry(curve, 60, r, 8), color, { hull: true, edges: false }), 0, 0, 0, parent);
    }
    // склянка с раствором и этикеткой
    function bottle(parent, x, z, col, label, o = {}) {
      const g = new T.Group(); at(g, x, TY, z, parent);
      const r = o.r || 3.6, hh = o.h || 10;
      const wall = new T.Mesh(keep(new T.CylinderGeometry(r, r, hh, 28, 1, true)), glassMat(o.brown ? 0x9a6a3a : 0xd8eef8, o.brown ? 0.55 : 0.3)); at(wall, 0, hh / 2, 0, g); wall.add(new T.Mesh(wall.geometry, kit.hullMat));
      at(cyl(r, 1.6, 0xd8eef8, { r2: 1.4, edges: false, matOpt: { transparent: true, opacity: 0.4 } }), 0, hh + 0.8, 0, g);
      at(cyl(1.6, 1.8, o.cap || 0x2c3240, { seg: 16 }), 0, hh + 2.4, 0, g);
      if (col != null) { const lq = cyl(r - 0.35, hh * 0.72, col, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.8 } }); at(lq, 0, 0.3 + hh * 0.36, 0, g); }
      if (label) { const lb = canvasPlane(r * 1.7, hh * 0.38, 200, 96, (x, a, b) => textLines(x, a, b, [label], '#1b1610', '#fff6e6')); at(lb, 0, hh * 0.45, r + 0.06, g); }
      return { g, top: TY + hh + 3.3 };
    }
    // чашка Петри / фарфоровая чашка
    function dish(parent, x, z, r, col = 0xd8eef8, op = 0.45) {
      const g = new T.Group(); at(g, x, TY, z, parent);
      at(cyl(r, 0.4, col, { edges: false, matOpt: { transparent: op < 1, opacity: op } }), 0, 0.2, 0, g);
      const wall = new T.Mesh(keep(new T.CylinderGeometry(r, r, 1.6, 36, 1, true)), op < 1 ? glassMat(col, op * 0.7) : toon(col, { side: T.DoubleSide })); at(wall, 0, 0.8, 0, g); wall.add(new T.Mesh(wall.geometry, kit.hullMat));
      return { g, top: TY + 0.4 };
    }
    // кнопочная табличка-признак: плоская клавиша с надписью
    function key(parent, x, z, w, d, label, color, keyName, fg = '#ffffff') {
      const b = new T.Group(); at(b, x, TY, z, parent);
      at(box(w, 1.6, d, color), 0, 0.8, 0, b);
      const top = canvasPlane(w * 0.92, d * 0.8, Math.round(70 * w / d * 1.4), 112, (cx, a, bb) => textLines(cx, a, bb, [label], fg, '#' + color.toString(16).padStart(6, '0')));
      top.rotation.x = -Math.PI / 2; at(top, 0, 1.62, 0, b);
      clickable(b, keyName); return b;
    }
    // подсветка выбранного: жёлтое кольцо на подносе
    const ring = (parent, x, z, r, col = 0xffd166) => { const m = cyl(r, 0.25, col, { edges: false, hull: false, shadow: false }); return at(m, x, TY + 0.13, z, parent); };
    return { v3, v2, glassMat, ownMat, spr, glow, flat, rodAB, canvasPlane, textLines, screen, button, flame, steam, bubbles, liquid, beaker, thermo, stand, hotplate, tray, tube, flask, syringe, hose, bottle, dish, key, ring };
  }
  const mixC = (T, a, b, t) => new T.Color(hexN(a)).lerp(new T.Color(hexN(b)), clamp(t, 0, 1));

  // ===== 1. Признаки реакций: пробирка в лапке штатива, пробирка с реактивом, банки опытов, клавиши признаков =====
  SC['chre-signs'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    // полка с банками опытов (сзади)
    const sh = new T.Group(); at(sh, -4, TY, -27, g);
    at(box(70, 1.2, 12, 0xdfe4ec), 0, 0.6, 0, sh);
    d.exps.forEach((e, i) => {
      const x = -28 + i * 14, jg = new T.Group(); at(jg, x, 1.2, 0, sh); clickable(jg, 'e-' + i);
      if (e.cur) at(cyl(5, 0.25, 0xffd166, { edges: false, hull: false, shadow: false }), 0, 0.15, 0, jg);
      if (e.id === 'mg') {
        at(cyl(2.6, 1.2, 0x3b4a66), 0, 0.6, 0, jg);
        const coil = mesh(new T.TorusGeometry(2.4, 0.5, 8, 28), 0xc9ced8, { edges: false, hull: true }); coil.rotation.x = Math.PI / 2; coil.scale.z = 2.2; at(coil, 0, 2.6, 0, jg);
      } else if (e.id === 'sug') {
        const w = new T.Mesh(kit.keep(new T.CylinderGeometry(3.3, 3.3, 7, 24, 1, true)), h.glassMat(0xd8eef8, 0.32)); at(w, 0, 3.5, 0, jg); w.add(new T.Mesh(w.geometry, kit.hullMat));
        for (let j = 0; j < 9; j++) { const c = box(1.4, 1.4, 1.4, 0xf6f6f2, { edges: false }); c.rotation.set(rnd(j) * 3, rnd(j + 4) * 3, 0); at(c, (rnd(j + 7) - 0.5) * 3.4, 0.9 + Math.floor(j / 3) * 1.3, (rnd(j + 9) - 0.5) * 3.4, jg); }
        at(cyl(3.6, 1.2, 0x2c3240), 0, 7.4, 0, jg);
      } else h.bottle(jg, 0, 0, hexN(e.c), null, { r: 3.2, h: 8, brown: e.id === 'iod' }).g.position.y = 0;
      const lb = h.canvasPlane(11, 3, 220, 60, (x, a, b) => h.textLines(x, a, b, [(e.done ? '✓ ' : '') + e.short], '#1b1610', e.done ? '#86e0a8' : e.cur ? '#ffd166' : '#fff6e6', { round: 10 }));
      lb.rotation.x = -0.6; at(lb, 0, 0.8, 5.6, jg);
    });
    tag(v3(30, TY + 13, -27), 'Опыты', d.nDone + ' из 5 разобрано');

    // клавиши признаков (спереди)
    d.signs.forEach((s, i) => {
      const right = d.done && s.k === d.sign;
      h.key(g, -46 + i * 18.4, 37, 16.4, 6.4, s.t, right ? 0x2f9e55 : 0x3b4a66, 's-' + s.k);
    });

    const L0 = live() || {}, p0 = L0.p ?? (d.ran ? 1 : 0);
    if (d.kind === 'flame') {
      // спиртовка, керамическая плитка, щипцы с магниевой лентой
      const bx = 6, bz = 4;
      const bg = new T.Group(); at(bg, bx, TY, bz, g);
      const body = mesh(new T.SphereGeometry(6, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.62), 0xd8eef8, { mat: h.glassMat(0xd8eef8, 0.35), hull: true, edges: false }); body.scale.y = 0.9; at(body, 0, 4.2, 0, bg);
      at(cyl(5.6, 4.4, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.35 } }), 0, 2.2, 0, bg);
      at(cyl(4.6, 3.6, 0xbfe0f5, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.6 } }), 0, 2.2, 0, bg);
      at(cyl(2.2, 2.4, C.STEEL), 0, 9.6, 0, bg); at(cyl(0.7, 1.6, 0xf2ead2, { edges: false }), 0, 11.4, 0, bg);
      const fy = TY + 12;
      h.flame(g, bx, fy, bz, 9, '#d8f0ff', '#4a9cff', 0x6ab0ff);
      const tile = new T.Group(); at(tile, -4, TY, 22, g);
      at(box(18, 0.9, 14, 0xf7f3ea), 0, 0.45, 0, tile);
      const powder = cyl(4.6, 1.4, 0xffffff, { r2: 0.8 }); at(powder, 0, 0.9 + 0.7, 0, tile);
      // щипцы: ручка в начале координат, лента продолжает щипцы по +x
      const tg = new T.Group(); clickable(tg, 'reag'); g.add(tg);
      [-0.7, 0.7].forEach(s => { const r = box(18, 0.5, 0.8, C.STEEL); r.rotation.y = s * 0.04; at(r, 9, 0, s, tg); });
      at(box(5, 1.4, 2.8, 0x2c3240), 1.5, 0, 0, tg);
      const rib = box(9, 0.25, 1.4, 0xc9ced8); at(rib, 22.5, 0, 0, tg);
      const rest = { p: v3(-44, TY + 1.2, 14), ry: 0.25, rz: 0 };
      const fire = v3(bx - 0.5, fy + 6, bz);
      const flash = h.glow(0xffffff, 34, 0); at(flash, fire.x, fire.y, fire.z, g);
      const light = new T.PointLight(0xffffff, 0, 120, 1.1); at(light, fire.x, fire.y + 4, fire.z, g);
      const smoke = h.steam(g, fire.x, fire.y + 2, fire.z, { n: 8, spread: 6, size: 5, rise: 18, op: 0.55, amt: 0, color: 0xf4f4f4 });
      const rz = -0.35, tip = v3(27, 0, 0).applyEuler(new T.Euler(0, 0, rz)), inPos = fire.clone().sub(tip);
      kit.onFrame(() => {
        const Lv = live() || {}, p = Lv.p ?? p0;
        const a = ease(clamp(p / 0.15, 0, 1)), back = ease(clamp((p - 0.86) / 0.12, 0, 1)), k = a * (1 - back);
        tg.position.copy(rest.p).lerp(inPos, k); tg.rotation.set(0, rest.ry * (1 - k), rz * k);
        const burn = clamp((p - 0.15) / 0.68, 0, 1), on = p > 0.15 && p < 0.86;
        rib.scale.x = Math.max(0.12, 1 - burn * 0.88); rib.position.x = 18 + 9 * rib.scale.x / 2;
        const fl = on ? 0.75 + 0.25 * Math.sin(p * 90) : 0;
        flash.material.opacity = fl * 0.85; light.intensity = fl * 70;
        smoke.set(on ? 1 : p >= 0.86 && p < 1 ? 0.4 : 0);
        const pw = clamp((p - 0.25) / 0.7, 0, 1); powder.visible = pw > 0.02; powder.scale.set(0.3 + 0.7 * pw, 0.3 + 0.7 * pw, 0.3 + 0.7 * pw); powder.position.y = 0.9 + 0.7 * powder.scale.y;
      });
      tag(v3(bx, TY + 26, bz), 'Спиртовка', d.done ? '✓ ' + d.signT : d.ran ? 'что заметили?' : 'внесите ленту в пламя', d.done);
      tag(v3(-34, TY + 6, 16), 'Магниевая лента', d.ran ? 'нажмите — ещё раз' : 'нажмите — в пламя');
      tag(v3(-4, TY + 5, 22), 'Плитка', d.ran ? 'белый порошок MgO' : null);
      return;
    }

    // штатив с пробиркой
    const tx = 2, tz = 8, y0 = TY + 6, R = 3.4, TH = 28;
    h.stand(g, 18, -6, 38, [{ y: y0 + 22, to: v3(tx, 0, tz) }]);
    at(cyl(R + 0.9, 2.2, 0x3b4a66, { seg: 20 }), tx, y0 + 22, tz, g);
    const lvA = 9, lvB = d.B.solid ? 0 : 6;
    const mt = h.tube(g, tx, y0, tz, R, TH, { color: hexN(d.A.c), op: 0.6, level: lvA });
    clickable(mt.g, 'reag');
    const fin = d.liq1 || d.A.c;
    const bub = h.bubbles(g, tx, y0 + 0.6, tz, R - 1.3, 16);
    const foam = cyl(R - 0.35, 1, 0xf6f8fb, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.85 } }); at(foam, tx, y0, tz, g); foam.visible = false;
    // осадок: хлопья опускаются на дно
    const flakes = [];
    if (d.sign === 'prec') for (let i = 0; i < 30; i++) {
      const f = box(0.8, 0.5, 0.8, 0x5aa7ee, { edges: false, shadow: false }); f.rotation.set(rnd(i) * 3, rnd(i + 2) * 3, 0); at(f, 0, 0, 0, mt.g);
      const a = rnd(i + 5) * 6.28, rr = Math.sqrt(rnd(i + 6)) * (R - 1);
      flakes.push({ f, x: Math.cos(a) * rr, z: Math.sin(a) * rr, y1: 4 + rnd(i + 8) * 10, y2: 0.9 + rnd(i + 9) * 2.2 * (1 - rr / R), dl: rnd(i + 10) * 0.3 });
    }
    // пробирка с реактивом в подставке слева
    const holder = box(7, 4, 7, 0x3b4a66); at(holder, -28, TY + 2, 12, g);
    const rg = new T.Group(); g.add(rg); clickable(rg, 'reag');
    const RH = 18, rr = 2.5;
    const rt = h.tube(rg, 0, 0, 0, rr, RH, { color: hexN(d.B.c), op: 0.8, level: d.B.solid ? 0 : 10 });
    const crystals = [];
    if (d.B.solid) for (let i = 0; i < 9; i++) {
      const c = box(1.1, 1.1, 1.1, 0xf6f6f2, { edges: false }); c.rotation.set(rnd(i) * 3, rnd(i + 1) * 3, 0); at(c, 0, 0, 0, g);
      crystals.push({ c, ix: (rnd(i + 3) - 0.5) * 2, iy: 1 + Math.floor(i / 3) * 1.1, iz: (rnd(i + 4) - 0.5) * 2, bx: (rnd(i + 5) - 0.5) * 3, by: 0.9 + rnd(i + 6) * 1.4, bz: (rnd(i + 7) - 0.5) * 3, dl: rnd(i + 8) * 0.4 });
    }
    const rest = v3(-28, TY + 1.5, 12), th = 1.95;
    const M = v3(tx - 1.2, y0 + TH + 1.6, tz), inPos = M.clone().sub(v3(RH * Math.sin(th), RH * Math.cos(th), 0));
    const stream = cyl(0.42, 1, hexN(d.B.c), { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.85 } }); at(stream, tx - 0.6, 0, tz, g); stream.visible = false;
    const cA = hexN(d.A.c);
    kit.onFrame((dt, t) => {
      const Lv = live() || {}, p = Lv.p ?? p0, ran = d.ran;
      const a = ease(clamp(p / 0.14, 0, 1)), pour = clamp((p - 0.14) / 0.18, 0, 1), back = ease(clamp((p - 0.34) / 0.14, 0, 1)), k = ran ? a * (1 - back) : 0;
      rg.position.copy(rest).lerp(inPos, k); rg.rotation.z = -th * k;
      rt.set(d.B.solid ? 0 : ran ? 10 * (1 - pour) : 10);
      const lv = lvA + lvB * (ran ? pour : 0); mt.set(lv);
      stream.visible = ran && !d.B.solid && pour > 0 && pour < 1 && !kit.reduce;
      if (stream.visible) { const yb = y0 + lv, ytop = M.y - 0.6; stream.scale.y = ytop - yb; stream.position.y = (ytop + yb) / 2; }
      // цвет раствора
      let col = cA, op = 0.6;
      if (ran) {
        if (d.sign === 'color') { col = mixC(T, d.A.c, fin, (p - 0.2) / 0.35).getHex(); op = 0.6 + 0.32 * clamp((p - 0.2) / 0.35, 0, 1); }
        else if (d.sign === 'prec' || d.sign === 'gas') col = mixC(T, d.A.c, fin, (p - 0.15) / 0.3).getHex();
      }
      mt.mat.color.setHex(col); mt.mat.opacity = op;
      // газ: бурные пузырьки и пена
      if (d.sign === 'gas') {
        const fz = ran ? Math.sin(Math.PI * clamp((p - 0.16) / 0.84, 0, 1)) : 0;
        bub.set(ran && p > 0.16 ? (p < 1 ? 1 : 0.12) : 0, lv - 0.3, 0.45, p < 1 ? 1.4 : 0.6);
        foam.visible = fz > 0.03; foam.scale.y = 4.5 * fz; foam.position.y = y0 + lv + 2.25 * fz;
      }
      if (d.sign === 'prec') flakes.forEach(f => {
        const s = clamp((p - 0.22 - f.dl) / 0.45, 0, 1); f.f.visible = ran && p > 0.2 + f.dl * 0.4;
        f.f.position.set(f.x, f.y1 + (f.y2 - f.y1) * ease(s), f.z);
      });
      if (d.B.solid) {
        rg.updateMatrixWorld(true);
        crystals.forEach(c => {
          const fall = clamp((p - 0.18 - c.dl * 0.3) / 0.16, 0, 1), dis = clamp((p - 0.4) / 0.55, 0, 1);
          if (!ran || p < 0.18 - 0.001 + c.dl * 0.0) { c.c.position.copy(v3(c.ix, c.iy, c.iz).applyMatrix4(rg.matrixWorld)); c.c.scale.setScalar(1); c.c.visible = true; return; }
          const from = v3(c.ix * 0.3, RH - 0.5, c.iz * 0.3).applyMatrix4(rg.matrixWorld), to = v3(tx + c.bx * 0.5, y0 + c.by, tz + c.bz * 0.5);
          c.c.position.copy(fall < 1 && p < 0.34 ? from.lerp(to, fall) : to);
          c.c.scale.setScalar(Math.max(0.01, 1 - dis)); c.c.visible = dis < 0.99;
        });
      }
    });
    tag(v3(tx + 11, y0 + 9, tz + 6), d.name, d.done ? '✓ ' + d.signT : d.ran ? 'что изменилось?' : 'добавьте реактив', d.done);
    tag(v3(-28, TY + 23, 12), capF(d.B.s), d.ran ? 'нажмите — повторить' : 'нажмите — долить');
  };
  const capF = s => s[0].toUpperCase() + s.slice(1);

  // ===== 2. Уравнения реакций: модели молекул в чашках, плитки коэффициентов, доска с уравнением =====
  const ACOL = { H: 0xeef2f8, C: 0x4f586d, N: 0x4d7cf0, O: 0xe5533f, Cl: 0x5fc46a, Al: 0xb5c0d3, Fe: 0xc58a5c, Mg: 0x7ad1b5 };
  const ARAD = { H: 0.85, C: 1.3, N: 1.25, O: 1.25, Cl: 1.5, Al: 1.6, Fe: 1.6, Mg: 1.55 };
  const tri = (c, l, r) => [[c, 0, 0, 0], [l, r, 0, 0], [l, -r / 2, 0, r * 0.866], [l, -r / 2, 0, -r * 0.866]];
  const MOL = {
    H2: [['H', -0.75, 0, 0], ['H', 0.75, 0, 0]], O2: [['O', -1.1, 0, 0], ['O', 1.1, 0, 0]], N2: [['N', -1.05, 0, 0], ['N', 1.05, 0, 0]], Cl2: [['Cl', -1.4, 0, 0], ['Cl', 1.4, 0, 0]],
    H2O: [['O', 0, 0, 0], ['H', -1.35, 0, 0.95], ['H', 1.35, 0, 0.95]], Mg: [['Mg', 0, 0, 0]], Al: [['Al', 0, 0, 0]], Fe: [['Fe', 0, 0, 0]],
    MgO: [['Mg', -1.25, 0, 0], ['O', 1.25, 0, 0]], AlCl3: tri('Al', 'Cl', 2.7), FeCl3: tri('Fe', 'Cl', 2.7),
    CH4: [['C', 0, 0, 0], ['H', 0, 1.8, 0], ['H', 1.7, -0.6, 0], ['H', -0.85, -0.6, 1.47], ['H', -0.85, -0.6, -1.47]],
    CO2: [['C', 0, 0, 0], ['O', -2.1, 0, 0], ['O', 2.1, 0, 0]], NH3: [['N', 0, 0.25, 0], ['H', 1.55, -0.35, 0], ['H', -0.78, -0.35, 1.34], ['H', -0.78, -0.35, -1.34]],
  };
  SC['chre-equation'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, toon, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const sub = [...d.l, ...d.r], nl = d.l.length;
    const DR = 10, gapP = 6, gapA = 18;
    const xs = []; let cur = 0;
    sub.forEach((f, i) => { if (i > 0) cur += i === nl ? gapA : gapP; xs.push(cur + DR); cur += 2 * DR; });
    const off = cur / 2; for (let i = 0; i < xs.length; i++) xs[i] -= off;
    const sph = keep(new T.SphereGeometry(1, 18, 12)), mols = [];
    const molecule = (f, s) => {
      const m = new T.Group(), A = MOL[f] || [['C', 0, 0, 0]];
      A.forEach(([el, x, y, z]) => { const a = new T.Mesh(sph, toon(ACOL[el] || 0xcccccc)); a.add(new T.Mesh(sph, kit.hullMat)); a.scale.setScalar(ARAD[el] || 1.3); a.castShadow = true; at(a, x, y, z, m); });
      for (let i = 1; i < A.length; i++) { const p = A.length === 2 ? A[0] : A[0]; h.rodAB(m, v3(p[1], p[2], p[3]), v3(A[i][1], A[i][2], A[i][3]), 0.32, 0x9aa3b2, { hull: false }); }
      m.scale.setScalar(s); return m;
    };
    sub.forEach((f, i) => {
      const x = xs[i], z = -2, k = d.k[i];
      const ds = h.dish(g, x, z, DR, 0xd8eef8, 0.45);
      const cols = k <= 1 ? 1 : k <= 4 ? 2 : 3, rows = Math.ceil(k / cols), s = k <= 1 ? 1.5 : k <= 4 ? 1.0 : 0.72, sp = k <= 4 ? 8.6 : 6.2;
      for (let j = 0; j < k; j++) {
        const c = j % cols, r = Math.floor(j / cols), nIn = Math.min(cols, k - r * cols);
        const mx = (c - (nIn - 1) / 2) * sp, mz = (r - (rows - 1) / 2) * sp;
        const m = molecule(f, s); at(m, x + mx, ds.top + 2.1 * s + 0.4, z + mz, g); m.rotation.y = rnd(i * 10 + j) * 6; mols.push({ m, ph: rnd(j + i * 7) * 6 });
      }
      // плитка коэффициента
      const tz = 25;
      at(box(14.5, 2.2, 10.5, 0xfafbfd), x, TY + 1.1, tz, g);
      const top = h.canvasPlane(14, 10, 300, 210, (cx, a, b) => {
        cx.fillStyle = '#fafbfd'; cx.fillRect(0, 0, a, b);
        cx.textAlign = 'center'; cx.textBaseline = 'middle';
        cx.font = '700 104px "IBM Plex Mono", monospace'; cx.fillStyle = k > 1 ? '#e08a00' : '#c4cad6'; cx.fillText(String(k), a / 2, 70);
        let fs = 64; cx.font = `600 ${fs}px "IBM Plex Mono", monospace`; const tw = cx.measureText(lowF(f)).width; if (tw > a * 0.9) { fs = Math.floor(fs * a * 0.9 / tw); cx.font = `600 ${fs}px "IBM Plex Mono", monospace`; }
        cx.fillStyle = '#1b1610'; cx.fillText(lowF(f), a / 2, 156);
      });
      top.rotation.x = -Math.PI / 2; at(top, x, TY + 2.22, tz, g);
      h.button(g, x - 10, TY, tz + 2, '−', 0xe0473a, 'km-' + i, 4.4, 5);
      h.button(g, x + 10, TY, tz + 2, '+', 0x3fae5a, 'kp-' + i, 4.4, 5);
      // «+» между веществами одной стороны
      if (i > 0 && i !== nl) { const px = x - DR - gapP / 2; at(box(3.4, 0.5, 0.9, 0x3b4a66), px, TY + 0.25, -2, g); at(box(0.9, 0.5, 3.4, 0x3b4a66), px, TY + 0.25, -2, g); }
    });
    // стрелка реакции
    const ax = xs[nl] - DR - gapA / 2;
    at(box(9, 0.6, 1.4, 0x3b4a66), ax - 1.6, TY + 0.3, -2, g);
    const head = cyl(2.2, 3.6, 0x3b4a66, { r2: 0, seg: 3 }); head.rotation.z = -Math.PI / 2; at(head, ax + 4.6, TY + 1.0, -2, g);
    // доска с уравнением и подсчётом атомов
    const bd = new T.Group(); at(bd, 0, TY, -31, g);
    at(box(3, 20, 3, C.DARK), -46, 10, 0, bd); at(box(3, 20, 3, C.DARK), 46, 10, 0, bd);
    at(box(98, 21, 1.6, 0x26324a), 0, 13, 0, bd);
    const okCol = d.ok ? '#86e0a8' : d.bal ? '#ffd166' : '#ff8a73';
    const eqTxt = sub.map((f, i) => (d.k[i] > 1 ? d.k[i] : '') + lowF(f)).reduce((s, x, i) => s + (i === 0 ? '' : i === nl ? ' → ' : ' + ') + x, '');
    const board = h.canvasPlane(94, 18, 1040, 200, (cx, a, b) => {
      cx.fillStyle = '#132018'; cx.fillRect(0, 0, a, b); cx.strokeStyle = okCol; cx.lineWidth = 8; cx.strokeRect(4, 4, a - 8, b - 8);
      h.textLines(cx, a, 120, [{ t: eqTxt, k: 0.62 }], '#f2f5f0');
      const els = d.els, wcell = (a - 40) / els.length;
      els.forEach((el, i) => {
        const L = d.L[el] || 0, R = d.R[el] || 0, eq = L === R, x = 20 + wcell * (i + 0.5);
        cx.font = '600 44px "IBM Plex Mono", monospace'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
        cx.fillStyle = eq ? '#86e0a8' : '#ff8a73'; cx.fillText(`${el}: ${L} ${eq ? '=' : '≠'} ${R}`, x, 156);
      });
    });
    at(board, 0, 13, 0.85, bd);
    h.button(g, -53, TY, -21, '‹', 0x5d6b88, 'prev', 7, 6);
    h.button(g, 53, TY, -21, '›', 0x5d6b88, 'next', 7, 6);
    h.key(g, 52, 38, 12, 5, 'все по 1', 0x5d6b88, 'reset');
    if (d.ok) at(h.glow(0x86e0a8, 50, 0.25), 0, TY + 12, -29, g);
    if (!kit.reduce) kit.onFrame((dt, t) => { for (const q of mols) q.m.rotation.y = q.ph + t * 0.4; });
    tag(v3(0, TY + 27, -31), capF(d.name), d.ok ? '✓ уравнено' : d.bal ? 'атомов поровну — сократите' : 'атомов не поровну', d.ok);
    tag(v3(-50, TY + 8, 30), 'Коэффициенты', 'уравнено ' + d.found + ' из 3');
  };

  // ===== 3. Закон сохранения массы: колба с кислотой и пробиркой мела на электронных весах =====
  SC['chre-mass'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const f2 = v => fmt(v, 2) + ' г';
    // весы
    const SX = -10, SZ = 4, sg = new T.Group(); at(sg, SX, TY, SZ, g);
    [[-15, -11], [15, -11], [-15, 11], [15, 11]].forEach(([x, z]) => at(cyl(1, 0.5, C.DARK, { edges: false }), x, 0.25, z, sg));
    at(box(36, 5, 28, 0x34405a), 0, 3, 0, sg);
    at(box(31, 0.4, 5, 0x232b3d, { edges: false }), 0, 5.6, 11, sg);
    const disp = h.screen(15, 3.6, '', '#86e0a8', 300, 72, '#0c1a14'); at(disp, -4, 3, 14.06, sg);
    h.button(sg, 10, 5.5, 10.5, 'опыт', 0x3fae5a, 'flask', 6, 3.2);
    at(cyl(2, 1.4, C.STEEL), 0, 6.2, -1, sg); at(cyl(14, 0.8, C.STEEL, { seg: 44 }), 0, 7.3, -1, sg);
    const panY = TY + 7.7;
    // колба
    const FX = SX, FZ = SZ - 1, R = 10, FH = 26, rn = 3.2;
    const fl = h.flask(g, FX, panY, FZ, R, FH, rn); clickable(fl.g, 'flask');
    const acid = fl.fill(7, 0xcfe4f2, 0.55);
    const bub = h.bubbles(fl.g, 0, 0.4, 0, R - 2.5, 18); bub.shape(y => fl.rAt(y) - 1.2);
    // пробирка с мелом внутри колбы
    const vt = new T.Group(); at(vt, 2.6, 0.5, 0, fl.g);
    h.tube(vt, 0, 0, 0, 1.4, 10.5, { level: 0 });
    const n = Math.round(d.m * 10), chalk = [];
    for (let i = 0; i < n; i++) {
      const c = kit.mesh(new T.IcosahedronGeometry(0.62, 0), 0xf4f4f0, { edgeAngle: 20 }); c.rotation.set(rnd(i) * 3, rnd(i + 1) * 3, 0); at(c, 0, 0, 0, fl.g);
      const a = rnd(i + 4) * 6.28, rr = 1.5 + rnd(i + 5) * 4.5;
      chalk.push({ c, ix: (rnd(i + 2) - 0.5) * 1.2, iy: 0.9 + i * 0.85, bx: Math.cos(a) * rr - 1, bz: Math.sin(a) * rr, dl: rnd(i + 6) * 0.06 });
    }
    // пробка
    const stop = new T.Group(); clickable(stop, 'stop');
    at(cyl(rn + 0.3, 3.2, 0x9c3b2e, { r2: rn + 1.0 }), 0, 1.6, 0, stop);
    if (d.shut) at(stop, FX, fl.top - 1.4, FZ, g);
    else { at(stop, -46, TY + rn + 1, 22, g); stop.rotation.x = Math.PI / 2; }
    const gasOut = h.steam(g, FX, fl.top + 1, FZ, { n: 8, spread: 5, size: 6, rise: 18, op: 0.7, amt: 0, color: 0xeef2f6 });
    // банка с мелом и кнопки массы
    const jx = 32, jz = -16;
    const jw = new T.Mesh(kit.keep(new T.CylinderGeometry(4.4, 4.4, 8, 24, 1, true)), h.glassMat(0xd8eef8, 0.32)); at(jw, jx, TY + 4, jz, g); jw.add(new T.Mesh(jw.geometry, kit.hullMat));
    at(cyl(4.4, 0.5, 0xd8eef8, { edges: false, matOpt: { transparent: true, opacity: 0.4 } }), jx, TY + 0.25, jz, g);
    for (let i = 0; i < 12; i++) { const c = kit.mesh(new T.IcosahedronGeometry(1.0, 0), 0xf4f4f0, { edgeAngle: 20 }); c.rotation.set(rnd(i) * 3, rnd(i + 3) * 3, 0); at(c, jx + (rnd(i + 7) - 0.5) * 5, TY + 1.4 + Math.floor(i / 5) * 1.5, jz + (rnd(i + 8) - 0.5) * 5, g); }
    const jl = h.canvasPlane(7, 2.6, 240, 90, (x, a, b) => h.textLines(x, a, b, ['мел ' + fmt(d.m, 1) + ' г'], '#1b1610', '#fff6e6')); at(jl, jx, TY + 5.5, jz + 4.46, g);
    h.button(g, jx - 4, TY, jz + 8.5, '−', 0xe0473a, 'm-', 4.4, 4);
    h.button(g, jx + 4, TY, jz + 8.5, '+', 0x3fae5a, 'm+', 4.4, 4);
    // записи
    const nb = new T.Group(); at(nb, 36, TY, 16, g);
    at(box(28, 0.8, 18, 0xfbf8ef), 0, 0.4, 0, nb);
    const lines = [{ t: 'ЗАПИСИ', k: 0.5, c: '#8a6a2a' }];
    lines.push(d.closed != null ? { t: 'закрыта: ' + fmt(250 + d.closed, 2) + ' → ' + fmt(250 + d.closed, 2), c: '#1f7a43' } : { t: 'закрыта: —', c: '#8b96ad' });
    lines.push(d.open != null ? { t: 'открыта: ' + fmt(250 + d.open, 2) + ' → ' + fmt(250 + d.open - d.gasOpen, 2), c: '#b5422e' } : { t: 'открыта: —', c: '#8b96ad' });
    if (d.ansGas != null) lines.push({ t: 'газ CO₂: ' + f2(d.ansGas) + ' ✓', c: '#1f7a43' });
    const page = h.canvasPlane(27, 17, 560, 352, (x, a, b) => { x.fillStyle = '#fbf8ef'; x.fillRect(0, 0, a, b); x.strokeStyle = '#c9d6ea'; x.lineWidth = 2; for (let y = 80; y < b; y += 68) { x.beginPath(); x.moveTo(20, y); x.lineTo(a - 20, y); x.stroke(); } h.textLines(x, a, Math.min(b, 88 * lines.length), lines, '#1b1610'); });
    page.rotation.x = -Math.PI / 2; at(page, 0, 0.82, 0, nb);
    h.key(g, 36, 33, 18, 5, 'новый опыт', 0x5d6b88, 'new');
    // варианты ответа
    if (d.opts) d.opts.forEach((v, i) => { const x = -36 + i * 15; h.key(g, x, 35, 13, 6, fmt(v, 2) + ' г', 0xfff6e6, 'a-' + i, '#1b1610'); });
    const L0 = live() || {}, p0 = L0.p ?? (d.ph === 'end' ? 1 : 0), r0 = L0.reading ?? d.reading ?? d.before;
    kit.onFrame(() => {
      const Lv = live() || {}, p = d.ph === 'ready' ? 0 : Lv.p ?? p0, rd = Lv.reading ?? r0;
      disp.userData.set(f2(rd), rd < d.before - 0.001 ? '#ffb547' : '#86e0a8');
      const tip = ease(clamp(p / 0.12, 0, 1)); vt.rotation.z = 0.08 + tip * 1.25;
      vt.position.set(2.6 - tip * 1.2, 0.5 + tip * 0.5, 0);
      vt.updateMatrixWorld(true);
      const dis = clamp((p - 0.18) / 0.75, 0, 1);
      chalk.forEach(c => {
        const fall = clamp((p - 0.06 - c.dl) / 0.12, 0, 1);
        const from = v3(c.ix * 0.6, c.iy, 0).applyMatrix4(vt.matrix), to = v3(c.bx, 0.9, c.bz);
        c.c.position.copy(from.lerp(to, ease(fall)));
        c.c.scale.setScalar(Math.max(0.01, 1 - dis)); c.c.visible = dis < 0.99;
      });
      const act = p > 0.12 && p < 0.97 ? Math.sin(Math.PI * clamp((p - 0.12) / 0.85, 0, 1)) : 0;
      bub.set(act > 0.02 ? 0.4 + 0.6 * act : 0, 6.6, 0.5, 1.3);
      gasOut.set(d.shut ? 0 : act * 0.9);
    });
    tag(v3(SX + 17, TY + 7, SZ + 8), 'Весы', d.ph === 'run' ? 'реакция…' : f2(d.reading ?? d.before), d.ph === 'end' && !d.shut);
    tag(v3(FX, fl.top + 6, FZ), 'Колба · HCl', d.shut ? 'закрыта пробкой' : 'открыта', !d.shut);
    tag(v3(jx, TY + 13, jz), 'Мел CaCO₃', fmt(d.m, 1) + ' г');
    if (d.opts) tag(v3(-21, TY + 4, 34), 'Сколько газа улетело?', 'выберите ответ', true);
    else tag(v3(36, TY + 3, 6), 'Записи', null);
  };

  // ===== 4. Типы реакций: четыре настоящих опыта-ящика и карточка с уравнением =====
  const TCOL = { comb: 0xffe2a0, dec: 0xc4dafc, sub: 0xbfe9c8, exc: 0xf6c3d3 };
  SC['chre-types'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, cable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const XS = [-45, -15, 15, 45], SZ = -14;
    d.types.forEach((ty, i) => {
      const x = XS[i], st = new T.Group(); at(st, x, TY, SZ, g); clickable(st, 'box-' + ty.k);
      at(box(27, 1.4, 24, TCOL[ty.k]), 0, 0.7, 0, st);
      const lb = h.canvasPlane(25, 3.4, 600, 82, (cx, a, b) => h.textLines(cx, a, b, [ty.name.toUpperCase() + (d.cnt[ty.k] ? ' · ' + d.cnt[ty.k] : '')], '#1b1610', '#fff6e6', { round: 12 }));
      lb.rotation.x = -0.7; at(lb, 0, 1.6, 13.4, st);
      const Y = 1.4;
      if (ty.k === 'comb') {
        // гашение извести: фарфоровая чашка с CaO и водой, пар
        const ch = new T.Group(); at(ch, -2, Y, 1, st);
        const bowl = mesh(new T.SphereGeometry(7, 28, 14, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), 0xf7f5ee, { mat: kit.toon(0xf7f5ee, { side: T.DoubleSide }), hull: true, edges: false }); at(bowl, 0, 6.2, 0, ch);
        at(cyl(5.4, 0.8, 0xe8f2f8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.7 } }), 0, 2.4, 0, ch);
        for (let j = 0; j < 7; j++) { const c = mesh(new T.IcosahedronGeometry(1.2, 0), 0xfbfbf6, { edgeAngle: 20 }); c.rotation.set(rnd(j) * 3, rnd(j + 2) * 3, 0); at(c, (rnd(j + 4) - 0.5) * 6, 2.9, (rnd(j + 5) - 0.5) * 6, ch); }
        h.steam(st, -2, Y + 4, 1, { n: 6, spread: 5, size: 4, rise: 13, op: 0.5 });
        const bk = h.beaker(st, 8, Y, -6, 3, 7); at(cyl(2.8, 4, 0x8fc6ea, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.55 } }), 0, 2.3, 0, bk.g);
      } else if (ty.k === 'dec') {
        // электролиз воды: стакан, две перевёрнутые пробирки (H₂ вдвое больше O₂), батарейка
        const bk = h.beaker(st, -2, Y, 1, 7.5, 12);
        const w = h.liquid(st, -2, Y + 0.6, 1, 7.1, 0x8fc6ea, 0.45); w.set(9.5);
        const tubes = [[-5, 7], [1, 3.5]];
        tubes.forEach(([tx, gasH]) => {
          const tt = h.tube(st, tx, Y + 18, 1, 1.6, 16, { level: 0 }); tt.g.rotation.x = Math.PI;
          at(cyl(1.3, 16 - gasH, 0x8fc6ea, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.45 } }), tx, Y + 2 + (16 - gasH) / 2, 1, st);
          at(box(0.6, 3, 0.6, 0x3a3f4c, { edges: false }), tx, Y + 2, 1, st);
          const bb = h.bubbles(st, tx, Y + 2.5, 1, 0.6, 5); bb.set(1, 14 - gasH, 0.35, 0.9);
        });
        const bat = new T.Group(); at(bat, 7.5, Y, -7, st);
        at(box(7, 5, 4, 0x2c3240), 0, 2.5, 0, bat); at(box(7, 1.2, 4.1, 0xffb547, { edges: false }), 0, 4, 0, bat);
        at(cyl(0.7, 1, 0xe0473a), -2, 5.5, 0, bat); at(cyl(0.7, 1, 0x3b4a66), 2, 5.5, 0, bat);
        st.updateMatrixWorld(true); g.updateMatrixWorld(true);
        const W = p => p.clone().applyMatrix4(st.matrixWorld);
        h.hose(st, [v3(5.5, Y + 6, -7), v3(2, Y + 15, -4), v3(-4, Y + 14, 4.5), v3(-5, Y + 3.5, 1.4)], 0.32, 0xe0473a);
        h.hose(st, [v3(9.5, Y + 6, -7), v3(6, Y + 16, -2), v3(2, Y + 14, 4.5), v3(1, Y + 3.5, 1.4)], 0.32, 0x26324a);
        void W;
      } else if (ty.k === 'sub') {
        // железный гвоздь в растворе медного купороса покрывается медью
        h.beaker(st, -1, Y, 1, 7, 13);
        const w = h.liquid(st, -1, Y + 0.6, 1, 6.6, 0x3f86d8, 0.6); w.set(9.5);
        const nail = new T.Group(); at(nail, -1, Y + 0.8, 1, st); nail.rotation.z = -0.32;
        at(cyl(0.55, 11, 0xc8643a, { edges: false }), 0, 5.5, 0, nail);
        at(cyl(0.6, 6.5, 0x8e96a3, { edges: false }), 0, 13.6, 0, nail);
        at(cyl(1.5, 0.6, 0x8e96a3), 0, 17.1, 0, nail);
        at(cyl(0.55, 0.9, 0xc8643a, { r2: 0.02, edges: false }), 0, -0.3, 0, nail);
        for (let j = 0; j < 6; j++) at(box(0.7, 0.4, 0.7, 0xc8643a, { edges: false }), -1 + (rnd(j) - 0.5) * 7, Y + 0.9, 1 + (rnd(j + 3) - 0.5) * 7, st);
      } else {
        // обмен: пробирка с голубым осадком Cu(OH)₂ и склянка щёлочи
        const hold = box(9, 3, 6, 0x3b4a66); at(hold, -3, Y + 1.5, 1, st);
        const tt = h.tube(st, -3, Y + 3, 1, 2.4, 17, { color: 0x9cc8ee, op: 0.55, level: 10 });
        for (let j = 0; j < 16; j++) { const f = box(0.75, 0.5, 0.75, 0x5aa7ee, { edges: false }); f.rotation.set(rnd(j) * 3, rnd(j + 1) * 3, 0); const a = rnd(j + 3) * 6.28, rr = Math.sqrt(rnd(j + 4)) * 1.4; at(f, Math.cos(a) * rr, 0.8 + rnd(j + 5) * 1.8 * (1 - rr / 2.4), Math.sin(a) * rr, tt.g); }
        h.bottle(st, 7, -4, 0xe4ecf4, 'NaOH', { r: 3, h: 8 });
      }
      tag(v3(x, TY + 22, SZ), ty.name, ty.sch);
    });
    // карточка с уравнением на подставке
    const cg = new T.Group(); at(cg, 0, TY, 24, g);
    at(box(52, 2, 6, C.WOOD2), 0, 1, 0, cg);
    const card = h.canvasPlane(48, 13, 1100, 300, (cx, a, b) => {
      cx.fillStyle = '#fffdf6'; cx.beginPath(); cx.roundRect(4, 4, a - 8, b - 8, 24); cx.fill(); cx.strokeStyle = '#1b1610'; cx.lineWidth = 6; cx.stroke();
      if (d.card) h.textLines(cx, a, b, [{ t: d.card, k: 0.58 }, { t: d.cond, k: 0.4, c: '#6a7385', mono: false, w: 500 }], '#1b1610');
      else h.textLines(cx, a, b, [{ t: 'Все карточки разложены ✓', k: 0.4, c: '#1f7a43' }], '#1b1610');
    });
    card.rotation.x = -0.55; at(card, 0, 7.6, -0.6, cg);
    const back = box(48.6, 13.6, 0.5, 0xd9dee6); back.rotation.x = -0.55; at(back, 0, 7.4, -1.0, cg);
    tag(v3(40, TY + 3, 34), 'Карточка', 'разложено ' + d.placed + ' из ' + d.total, d.placed === d.total);
  };

  // ===== 5. Скорость реакции: две одинаковые колбы в водяных банях, газ собирается в шприцы =====
  SC['chre-rate'] = (kit, d) => {
    const { T, at, box, cyl, tag, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const setups = [{ x: -36, cA: 0.2, cB: 0.2, T: 20, ratio: 1, ref: true }, { x: 6, cA: d.cA, cB: d.cB, T: d.T, ratio: d.ratio }];
    const SY = TY + 31, SZ = -28;
    const sy = setups.map((s, i) => {
      const hp = h.hotplate(g, s.x, -2, { on: s.T > 20, cool: s.T < 20, w: 30, d: 26, r: 12 });
      const by = hp.top, BR = 12.5;
      h.beaker(g, s.x, by, -2, BR, 15);
      const bw = h.liquid(g, s.x, by + 0.6, -2, BR - 0.4, s.T >= 60 ? 0xf0a080 : s.T <= 0 ? 0xb8e2f6 : 0x8fc6ea, 0.32); bw.set(10.5);
      if (s.T <= 10) for (let j = 0; j < 6; j++) { const c = box(2.6, 2.2, 2.6, 0xeef8ff, { matOpt: { transparent: true, opacity: 0.85 } }); c.rotation.set(rnd(j) * 0.6, rnd(j + 2) * 3, 0); const a = j / 6 * 6.28 + 0.4; at(c, s.x + Math.cos(a) * 10, by + 10, -2 + Math.sin(a) * 10, g); }
      if (s.T >= 60) h.steam(g, s.x, by + 12, -2, { n: 6, spread: 14, size: 5, rise: 12, op: 0.4 });
      const fl = h.flask(g, s.x, by + 0.6, -2, 8, 21, 2.4);
      const sum = s.cA + s.cB, col = mixC(T, 0x72d4e8, 0xffb547, s.cB / sum).getHex();
      fl.fill(6.5, col, clamp(0.25 + 0.55 * sum / 1.6, 0.25, 0.8));
      const bub = h.bubbles(fl.g, 0, 0.5, 0, 6, 16); bub.shape(y => fl.rAt(y) - 1);
      const lg = Math.log2(Math.max(1, s.ratio)), amt = clamp(0.12 + 0.11 * lg, 0.08, 1);
      bub.set(amt, 6, 0.4, 0.5 + 0.12 * lg);
      at(cyl(2.8, 3, 0x9c3b2e, { r2: 3.3 }), s.x, fl.top + 0.3, -2, g);
      const th = h.thermo(g, s.x + 9, by + 1.4, 4, 24, 0, 100, s.T);
      at(box(2, 2, 3.6, 0x3b4a66), s.x + 9, by + 15.2, 6.2, g);
      // шприц на подставке сзади (носик слева)
      const sx0 = s.x - (s.ref ? 12 : 4), syr = h.syringe(g, 18, 2.6); syr.g.position.set(sx0, SY, SZ); syr.g.rotation.z = -Math.PI / 2;
      at(box(2, SY - TY - 2.6, 2, C.DARK), sx0 + 5, (SY + TY) / 2 - 1.3, SZ, g); at(box(2, SY - TY - 2.6, 2, C.DARK), sx0 + 17, (SY + TY) / 2 - 1.3, SZ, g);
      at(box(18, 1, 6, C.DARK), sx0 + 11, TY + 0.5, SZ, g);
      h.hose(g, [v3(s.x, fl.top + 1.8, -2), v3(s.x, fl.top + 6, -5), v3(sx0 - 6, SY - 2, SZ + 6), v3(sx0 - 3, SY, SZ), v3(sx0 + 0.2, SY, SZ)], 0.55);
      const period = clamp(6 / s.ratio, 0.35, 120);
      return { syr, period, i };
    });
    kit.onFrame((dt, t) => sy.forEach(q => q.syr.set(kit.reduce ? clamp(0.9 / q.period * 1.5, 0.08, 0.95) : ((t / q.period) % 1.15) / 1.0)));
    // табло-секундомер: время набора 50 мл газа
    const bx = 44, bz = -10, bg = new T.Group(); at(bg, bx, TY, bz, g); bg.rotation.y = 0.4;
    at(box(26, 1.4, 12, C.DARK), 0, 0.7, 0, bg);
    const bd = new T.Group(); at(bd, 0, 1.4, -1, bg); bd.rotation.x = -0.35;
    at(box(24, 12, 4, 0x3b4a66), 0, 6, 0, bd);
    const four = Math.abs(d.ratio - 4) < 1e-6, tm = s => fmt(clamp(6 / s, 0, 999), 6 / s < 10 ? 2 : 0) + ' с';
    const scr = h.screen(21, 10, 'исходная ' + tm(1) + '\nопыт ' + tm(d.ratio) + '\nскорость ×' + fmt(d.ratio, d.ratio >= 10 ? 0 : d.ratio < 1 ? 3 : 2).replace(/,?0+$/, ''), four ? '#86e0a8' : '#ffd166', 360, 180);
    at(scr, 0, 6, 2.06, bd);
    h.key(g, bx, 6, 16, 5, 'исходные', 0x5d6b88, 'r0');
    // склянки A и B с кнопками
    [['A', d.cA, 0x72d4e8, 30, 'a'], ['B', d.cB, 0xffb547, 48, 'b']].forEach(([n, c, col, x, k]) => {
      h.bottle(g, x, 18, col, n + ' ' + fmt(c, 1) + ' М', { r: 4, h: 10 });
      h.button(g, x - 4, TY, 27.5, '−', 0xe0473a, k + '-', 4.4, 4);
      h.button(g, x + 4, TY, 27.5, '+', 0x3fae5a, k + '+', 4.4, 4);
    });
    // кнопки температуры у плитки опыта
    h.key(g, 6 - 7, 22, 11, 4.6, '−10 °C', 0x3b6fd8, 't-');
    h.key(g, 6 + 7, 22, 11, 4.6, '+10 °C', 0xe0473a, 't+');
    tag(v3(-36, TY + 29, -2), 'Исходная', '0,2 · 0,2 М · 20 °C');
    tag(v3(6, TY + 29, -2), 'Опыт', fmt(d.cA, 1) + ' · ' + fmt(d.cB, 1) + ' М · ' + d.T + ' °C', d.fc && d.fT);
    tag(v3(bx, TY + 18, bz), 'Скорость', '×' + fmt(d.ratio, d.ratio >= 10 ? 0 : 2), four);
  };

  // ===== 6. Катализаторы: колба с H₂O₂, чашки с добавками, тлеющая лучинка, корзины, диаграмма энергии =====
  SC['chre-cat'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const FX = -8, FZ = -6, R = 10.5, FH = 28, rn = 3.2;
    const fl = h.flask(g, FX, TY, FZ, R, FH, rn); clickable(fl.g, 'clr');
    const lv = 9; fl.fill(lv, 0xdbeef8, 0.5);
    const ad = d.ad, strong = ad && ad.id === 'raw' ? 2 : ad && ad.id === 'mno2' ? 1 : 0;
    const addMesh = (a, parent, x, y, z, s = 1) => {
      let m;
      if (a.id === 'mno2') m = cyl(3.6 * s, 1.0 * s, 0x2e2f36, { r2: 1.8 * s });
      else if (a.id === 'sand') m = cyl(3.8 * s, 1.2 * s, 0xd8b97a, { r2: 1.6 * s });
      else { m = cyl(3.2 * s, 1.0 * s, hexN(a.col), { seg: 20 }); m.scale.x = 1.25; }
      return at(m, x, y + (a.id === 'mno2' || a.id === 'sand' ? 0.5 : 0.5) * s, z, parent);
    };
    if (ad) addMesh(ad, fl.g, 0, 0.3, 0, 0.9);
    const bub = h.bubbles(fl.g, 0, 0.6, 0, R - 2.5, 24); bub.shape(y => fl.rAt(y) - 1.2);
    bub.set(strong === 2 ? 1 : strong ? 0.8 : 0.06, lv - 0.4, strong ? 0.55 : 0.4, strong === 2 ? 1.8 : strong ? 1.2 : 0.4);
    // пена кислорода поднимается в горло
    const foam = [];
    if (strong) {
      const top = strong === 2 ? FH + 1.5 : FH * 0.78;
      for (let i = 0; i < 34; i++) { const y = lv + (top - lv) * i / 33, rr = fl.rAt(y) - 0.6; const s = new T.Mesh(kit.keep(new T.SphereGeometry(1, 12, 8)), h.ownMat(0xf7f9fc, { transparent: true, opacity: 0.92 })); at(s, (rnd(i) - 0.5) * rr, y, (rnd(i + 3) - 0.5) * rr, fl.g); foam.push({ s, r: Math.min(2.4, rr * 0.7 + 0.6), ph: rnd(i + 5) * 6 }); }
    }
    // лучинка над горлом
    h.stand(g, FX + 18, FZ - 10, 40, [{ y: TY + FH + 6, to: v3(FX + 10, 0, FZ) }]);
    const sp = box(16, 0.8, 0.8, 0xd6a35e); at(sp, FX + 3.5, TY + FH + 6, FZ, g);
    const tipX = FX - 4.5, tipY = TY + FH + 6;
    at(box(1.2, 0.9, 0.9, 0x2c2420), tipX, tipY, FZ, g);
    if (strong) h.flame(g, tipX - 0.4, tipY + 0.3, FZ, 7, '#ffe9a0', '#ff7a1a', 0xff8a3c);
    else { const gl = h.glow(0xff5a1a, 5, 0.9); at(gl, tipX, tipY, FZ, g); if (!kit.reduce) kit.onFrame((dt, t) => { gl.material.opacity = 0.6 + 0.3 * Math.sin(t * 3); }); h.steam(g, tipX, tipY + 1, FZ, { n: 4, spread: 1.5, size: 1.6, rise: 9, op: 0.35, color: 0xcfd4dc }); }
    // чашки с добавками
    d.adds.forEach((a, i) => {
      const x = -50 + i * 14, z = 24, dg = new T.Group(); at(dg, 0, 0, 0, g); clickable(dg, 'ad-' + i);
      const cur = d.inFlask === i;
      if (cur) h.ring(dg, x, z, 7.2);
      h.dish(dg, x, z, 5.4, 0xd8eef8, 0.45);
      if (!cur && !a.sorted) addMesh(a, dg, x, TY + 0.4, z, 0.95);
      const lb = h.canvasPlane(13, 4.4, 300, 100, (cx, w, hh) => h.textLines(cx, w, hh, [a.name, { t: a.sub, k: 0.45, mono: false, w: 500 }], '#1b1610', a.tested ? '#fff6e6' : '#e6eaf0', { round: 12 }));
      lb.rotation.x = -0.75; at(lb, x, TY + 1.6, z + 8.2, dg);
    });
    // корзины
    const bask = { yes: [36, -14, 0x3fae5a, 'КАТАЛИЗАТОР'], no: [36, 10, 0x8b96ad, 'НЕ УСКОРЯЕТ'] };
    for (const [k, [x, z, col, nm]] of Object.entries(bask)) {
      const bg = new T.Group(); at(bg, x, TY, z, g); clickable(bg, k);
      at(box(24, 0.8, 18, 0xf8fafc), 0, 0.4, 0, bg);
      at(box(24, 5, 1, col), 0, 2.5, -8.5, bg); at(box(24, 5, 1, col), 0, 2.5, 8.5, bg); at(box(1, 5, 16, col), -11.5, 2.5, 0, bg); at(box(1, 5, 16, col), 11.5, 2.5, 0, bg);
      const lb = h.canvasPlane(20, 3, 500, 76, (cx, w, hh) => h.textLines(cx, w, hh, [nm], '#ffffff', '#' + col.toString(16).padStart(6, '0'))); at(lb, 0, 2.6, 9.05, bg);
      d.adds.filter(a => a.sorted === k).forEach((a, j) => addMesh(a, bg, -6 + (j % 2) * 11, 0.8, -3 + Math.floor(j / 2) * 7, 0.75));
    }
    // диаграмма энергии на доске
    const eb = new T.Group(); at(eb, -42, TY, -27, g);
    at(box(2, 16, 2, C.DARK), -15, 8, 0, eb); at(box(2, 16, 2, C.DARK), 15, 8, 0, eb);
    const dia = h.canvasPlane(32, 18, 640, 360, (cx, w, hh) => {
      cx.fillStyle = '#fbfaf5'; cx.fillRect(0, 0, w, hh); cx.strokeStyle = '#1b1610'; cx.lineWidth = 6; cx.strokeRect(3, 3, w - 6, hh - 6);
      const y = E => 120 - E * 1.6 + 60, x0 = 40, x1 = w - 30;
      cx.lineWidth = 3; cx.beginPath(); cx.moveTo(x0, 40); cx.lineTo(x0, hh - 30); cx.lineTo(x1, hh - 30); cx.stroke();
      const curve = (Ea, col, dash) => { cx.strokeStyle = col; cx.lineWidth = 6; cx.setLineDash(dash ? [14, 10] : []); cx.beginPath(); cx.moveTo(x0 + 10, y(0)); cx.lineTo(180, y(0)); cx.bezierCurveTo(250, y(0), 250, y(Ea), 320, y(Ea)); cx.bezierCurveTo(390, y(Ea), 390, y(-98), 460, y(-98)); cx.lineTo(x1 - 10, y(-98)); cx.stroke(); cx.setLineDash([]); };
      curve(75, '#8b96ad', !!(ad && ad.cat));
      if (ad && ad.cat) curve(d.Ea, '#2f9e55', false);
      cx.fillStyle = '#1b1610'; cx.font = '600 26px "IBM Plex Mono", monospace'; cx.textAlign = 'left'; cx.fillText('2H₂O₂', x0 + 12, y(0) - 14); cx.textAlign = 'right'; cx.fillText('2H₂O + O₂', x1 - 12, y(-98) - 14);
      cx.textAlign = 'center'; cx.fillStyle = ad && ad.cat ? '#2f9e55' : '#c77800'; cx.font = '700 30px "IBM Plex Mono", monospace'; cx.fillText('Eₐ = ' + d.Ea + ' кДж/моль', w / 2, 34);
    });
    at(dia, 0, 12, 1.05, eb); at(box(33, 19, 1.6, 0x26324a), 0, 12, 0, eb);
    if (!kit.reduce && foam.length) kit.onFrame((dt, t) => { for (const f of foam) f.s.scale.setScalar(f.r * (0.85 + 0.15 * Math.sin(t * 4 + f.ph))); });
    else foam.forEach(f => f.s.scale.setScalar(f.r));
    const ns = k => d.adds.filter(a => a.sorted === k).length;
    tag(v3(FX, TY + FH + 14, FZ), 'H₂O₂ 3%', ad ? ad.name + (ad.id === 'raw' || ad.id === 'boiled' ? ' (' + ad.sub.split(' ')[0] + ')' : '') + (strong ? ' · бурно, O₂↑' : ' · почти без пузырьков') : 'без добавки', !!strong);
    tag(v3(FX + 20, TY + FH + 4, FZ - 6), 'Лучинка', strong ? 'вспыхнула!' : 'тлеет', !!strong);
    tag(v3(36, TY + 8, -14), 'Катализатор', ns('yes') + ' шт');
    tag(v3(36, TY + 8, 10), 'Не ускоряет', ns('no') + ' шт');
  };

  // ===== 7. Химическое равновесие: запаянная ампула N₂O₄/NO₂ в бане 25 °C, секундомер, табло скоростей =====
  // молекулы в сосуде: NO₂ — бурые шарики, N₂O₄ — светлые пары
  function moleculeCloud(kit, h, parent, maxS, maxP, box3) {
    const { T, keep, toon } = kit;
    const geo = keep(new T.SphereGeometry(1, 10, 8)), mB = toon(0xc8693a), mA = toon(0xc8d0de);
    const singles = [], pairs = [];
    for (let i = 0; i < maxS; i++) { const m = new T.Mesh(geo, mB); m.scale.setScalar(0.62); parent.add(m); singles.push({ m, u: [rnd(i + 1), rnd(i + 2), rnd(i + 3)], ph: rnd(i + 4) * 6 }); }
    for (let i = 0; i < maxP; i++) { const p = new T.Group(); [-0.55, 0.55].forEach(x => { const m = new T.Mesh(geo, mA); m.scale.setScalar(0.58); m.position.x = x; p.add(m); }); parent.add(p); pairs.push({ m: p, u: [rnd(i + 51), rnd(i + 52), rnd(i + 53)], ph: rnd(i + 54) * 6 }); }
    return (nS, nP, t, b = box3) => {
      const j = (q, k) => kit.reduce ? 0 : 0.5 * Math.sin(t * (1.3 + k * 0.4) + q.ph * (k + 1));
      const place = (q, i, vis) => { q.m.visible = vis; if (!vis) return; const a = q.u[0] * 6.283, rr = Math.sqrt(q.u[2]) * b.r; q.m.position.set(Math.cos(a) * rr + j(q, 0), b.y0 + q.u[1] * (b.h) + j(q, 1), Math.sin(a) * rr + j(q, 2)); q.m.rotation.y = q.ph + t * 0.5; };
      singles.forEach((q, i) => place(q, i, i < nS));
      pairs.forEach((q, i) => place(q, i, i < nP));
    };
  }
  const brownOp = c => clamp(c / 0.12 * 0.75, 0, 0.85);
  function ampoule(kit, h, parent, x, y0, z, r, len, startCol, startOp) {
    const { T, at, keep } = kit;
    const g = new T.Group(); at(g, x, y0, z, parent);
    const pts = []; for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + i / 8 * Math.PI / 2; pts.push(h.v2(Math.max(0.001, Math.cos(a) * r), r + Math.sin(a) * r)); }
    for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; pts.push(h.v2(Math.max(0.5, Math.cos(a) * r), len - r + Math.sin(a) * r)); }
    pts.push(h.v2(0.5, len + 2.6)); pts.push(h.v2(0.001, len + 3));
    const geo = keep(new T.LatheGeometry(pts, 28));
    const wall = new T.Mesh(geo, h.glassMat(0xe4f2fa, 0.3)); g.add(wall); wall.add(new T.Mesh(geo, kit.hullMat));
    const gm = h.ownMat(0xa0552a, { transparent: true, opacity: startOp, depthWrite: false });
    const gas = new T.Mesh(keep(new T.CapsuleGeometry(r - 0.4, len - 2 * r, 8, 20)), gm); at(gas, 0, len / 2, 0, g);
    return { g, gm };
  }
  SC['chre-equil'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const BX = -14, BZ = -4, BR = 13;
    h.beaker(g, BX, TY, BZ, BR, 18);
    const w = h.liquid(g, BX, TY + 0.6, BZ, BR - 0.4, 0x8fc6ea, 0.3); w.set(14);
    h.thermo(g, BX + 9, TY + 1.4, BZ + 5, 24, 0, 100, 25);
    const amp = ampoule(kit, h, g, BX - 1, TY + 2, BZ, 4.4, 24, 0xa0552a, d.start === 'B' ? 0.8 : 0);
    h.stand(g, BX - 2, BZ - 18, 38, [{ y: TY + 22, to: v3(BX - 1, 0, BZ), ring: 1.5 }]);
    const cloud = moleculeCloud(kit, h, amp.g, 26, 13, { r: 3.0, y0: 1.6, h: 20.5 });
    // штатив с запасными ампулами (старт N₂O₄ / NO₂)
    const rk = new T.Group(); at(rk, 34, TY, -24, g);
    at(box(24, 1.2, 10, 0xdfe4ec), 0, 0.6, 0, rk); at(box(24, 1, 10, 0xdfe4ec), 0, 10, 0, rk);
    [[-6, 0.6], [6, 0.6]].forEach(([x]) => { at(box(1, 10, 1, 0xb9c2d0), x - 6, 5.3, -4, rk); at(box(1, 10, 1, 0xb9c2d0), x + 6, 5.3, -4, rk); });
    [['A', -6, 0, 'N₂O₄'], ['B', 6, 0.8, 'NO₂']].forEach(([k, x, op, nm]) => {
      const sg = new T.Group(); at(sg, x, 0, 0, rk); clickable(sg, 's' + k);
      if (d.start === k) h.ring(sg, 0, 0, 4.4);
      else ampoule(kit, h, sg, 0, 1.2, 0, 2.6, 13, 0xa0552a, op);
      const lb = h.canvasPlane(9, 3, 220, 74, (cx, a, b) => h.textLines(cx, a, b, ['старт ' + nm], '#1b1610', d.start === k ? '#ffd166' : '#fff6e6', { round: 10 })); lb.rotation.x = -0.5; at(lb, 0, 1.6, 5.8, sg);
    });
    // секундомер
    const sw = new T.Group(); at(sw, -40, TY, 26, g); sw.rotation.y = 0.35; clickable(sw, 'play');
    at(box(20, 1.4, 11, C.DARK), 0, 0.7, 0, sw);
    const sb = new T.Group(); at(sb, 0, 1.4, -1, sw); sb.rotation.x = -0.4;
    at(box(18, 9, 4, 0x3b4a66), 0, 4.5, 0, sb);
    const tscr = h.screen(15, 6, '', '#ffd166', 300, 120); at(tscr, 0, 4.5, 2.06, sb);
    at(cyl(2, 1, C.DARK), 6, 9.5, 0, sb); at(cyl(1.4, d.play ? 0.8 : 1.6, d.play ? 0xffb547 : 0x3fae5a), 6, d.play ? 10.4 : 10.8, 0, sb);
    // табло скоростей и кнопка «Равновесие!»
    const rb = new T.Group(); at(rb, 20, TY, 16, g); rb.rotation.y = 0.3;
    at(box(30, 1.4, 14, C.DARK), 0, 0.7, 0, rb);
    const pn = new T.Group(); at(pn, 0, 1.4, -3, rb); pn.rotation.x = -0.3;
    at(box(28, 18, 3, 0x26324a), 0, 9, 0, pn);
    const bars = [[-7, 0x72d4e8, 'v→'], [0, 0xffb547, 'v←']].map(([x, col, nm]) => {
      at(box(4.2, 13, 0.4, 0x0e1520, { edges: false }), x, 9.5, 1.6, pn);
      const b = box(3.4, 1, 0.6, col, { edges: false }); at(b, x, 3.5, 1.8, pn);
      const lb = h.canvasPlane(5, 2, 120, 48, (cx, a, bb) => h.textLines(cx, a, bb, [nm], '#e8ecf4', '#26324a')); at(lb, x, 1.8, 1.56, pn);
      return b;
    });
    const cscr = h.screen(9, 12, '', '#e8ecf4', 160, 220, '#0e1520'); at(cscr, 8.5, 9.5, 1.56, pn);
    const mk = h.key(rb, 0, 4.5, 22, 4.6, d.f3[d.start] ? 'равновесие ✓' : 'равновесие!', d.f3[d.start] ? 0x2f9e55 : 0xc77800, 'mk');
    mk.position.y = 1.4;
    const vlog = v => v <= 0 ? 0 : clamp((Math.log10(v) + 5) / 4.2, 0.02, 1);
    const L0 = live() || { t: 0, a: d.start === 'A' ? 0.05 : 0, b: d.start === 'A' ? 0 : 0.1, vf: 0, vb: 0 };
    kit.onFrame((dt, t) => {
      const Lv = live() || L0;
      amp.gm.opacity = brownOp(Lv.b);
      cloud(Math.round(Lv.b * 240), Math.round(Lv.a * 240), t);
      tscr.userData.set('t = ' + fmt(Lv.t, 2) + ' с');
      [Lv.vf, Lv.vb].forEach((v, i) => { const f = vlog(v) * 12; bars[i].scale.y = Math.max(0.05, f); bars[i].position.y = 3.5 + f / 2; });
      cscr.userData.set('NO₂\n' + fmt(Lv.b, 3) + '\nN₂O₄\n' + fmt(Lv.a, 3), Lv.eq ? '#86e0a8' : '#e8ecf4');
    });
    tag(v3(BX, TY + 33, BZ), 'Ампула · 25 °C', 'старт ' + (d.start === 'A' ? 'N₂O₄' : 'NO₂'));
    tag(v3(22, TY + 23, 11), 'v→ и v←', d.eq ? 'равны' : 'не равны', d.eq);
    tag(v3(-40, TY + 14, 25), 'Секундомер', d.play ? 'идёт' : 'пауза');
    tag(v3(34, TY + 15, -24), 'Отмечено', 'N₂O₄ ' + (d.f3.A ? '✓' : '—') + ' · NO₂ ' + (d.f3.B ? '✓' : '—'), d.f3.A && d.f3.B);
  };

  // ===== 8. Принцип Ле Шателье: шприц со смесью NO₂/N₂O₄ в одной из трёх бань, пульт =====
  SC['chre-lc'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const TS = [0, 25, 80], XS = [-40, -6, 30], BZ = -6, BR = 11;
    let syrAt = null;
    TS.forEach((Tb, i) => {
      const x = XS[i], bg = new T.Group(); at(bg, 0, 0, 0, g); clickable(bg, 'bath-' + i);
      let by = TY;
      if (Tb === 80) by = h.hotplate(bg, x, BZ, { on: true, w: 26, d: 24, r: 10.5 }).top;
      h.beaker(bg, x, by, BZ, BR, 14);
      const w = h.liquid(bg, x, by + 0.6, BZ, BR - 0.4, Tb === 0 ? 0xb8e2f6 : Tb === 80 ? 0xf0a080 : 0x8fc6ea, 0.32); w.set(10);
      if (Tb === 0) for (let j = 0; j < 6; j++) { const c = box(2.6, 2.2, 2.6, 0xeef8ff, { matOpt: { transparent: true, opacity: 0.85 } }); c.rotation.set(rnd(j) * 0.6, rnd(j + 2) * 3, 0); const a = j / 6 * 6.28 + 0.3; at(c, x + Math.cos(a) * 7.5, by + 10, BZ + Math.sin(a) * 7.5, bg); }
      if (Tb === 80) h.steam(bg, x, by + 12, BZ, { n: 6, spread: 12, size: 5, rise: 12, op: 0.4 });
      if (d.T === Tb) { syrAt = { x, by }; h.ring(bg, x, BZ, BR + 2.2); }
      tag(v3(x, by + 2, BZ + 14), Tb === 0 ? 'Лёд' : Tb === 25 ? 'Вода' : 'Горячая', Tb + ' °C', d.T === Tb);
    });
    // шприц вертикально в бане, на штативе
    const L = 30, r = 3.6, sx = syrAt.x - 2, sy = syrAt.by + 8;
    const syr = h.syringe(g, L, r, 0xa0552a); syr.g.position.set(sx, sy, BZ);
    at(cyl(1.2, 1.4, 0x2c3240), sx, sy + 0.2, BZ, g);
    h.stand(g, sx + 1, BZ - 17, sy + L + 2 - TY, [{ y: sy + L - 4, to: v3(sx, 0, BZ), ring: r + 0.5 }]);
    const f = d.V / 2; syr.set(f);
    const gasH = 2 + f * (L - 2) - 2;
    const cloud = moleculeCloud(kit, h, syr.g, 30, 16, { r: 2.4, y0: 2.4, h: Math.max(1, gasH - 1.2) });
    // доска со смещением
    const bd = new T.Group(); at(bd, -22, TY, -33, g);
    at(box(2, 18, 2, C.DARK), -34, 9, 0, bd); at(box(2, 18, 2, C.DARK), 34, 9, 0, bd);
    at(box(72, 13, 1.6, 0x26324a), 0, 13, 0, bd);
    const sh = d.dir > 0 ? { t: 'смещается вправо →  N₂O₄ → 2NO₂', c: '#ffb547' } : d.dir < 0 ? { t: '← смещается влево  2NO₂ → N₂O₄', c: '#72d4e8' } : { t: 'равновесие установилось', c: '#86e0a8' };
    const ok = k => d.f4[k] ? '✓' : '—';
    const board = h.canvasPlane(70, 12, 980, 168, (cx, a, b) => h.textLines(cx, a, b, [{ t: 'N₂O₄ ⇌ 2NO₂   ΔH = +57 кДж', c: '#f2f5f0' }, sh, { t: `вправо: температурой ${ok('T')} · давлением ${ok('P')} · концентрацией ${ok('C')}`, k: 0.45, c: '#c8d1e2' }], '#f2f5f0', '#132018'));
    at(board, 0, 13, 0.85, bd);
    // пульт
    const pz = 33;
    at(box(118, 1.2, 12, 0x3b4a66), 0, TY + 0.6, pz, g);
    [['сжать ↓', 'v-', 0x3b6fd8], ['растянуть ↑', 'v+', 0x3b6fd8], ['+N₂O₄', 'addA', 0x8b96ad], ['+NO₂', 'addB', 0xa0552a], ['−NO₂', 'rmB', 0x6b4a3a], ['катализатор', 'cat', 0x2f9e55], ['сброс', 'rs', 0x5d6b88]].forEach(([lb, k, col], i) => {
      const b = h.key(g, -50 + i * 16.6, pz, 15, 7, lb, col, k); b.position.y = TY + 1.2;
    });
    const L0 = live() || { cB: 0.02, nA: 0.04, nB: 0.02 };
    kit.onFrame((dt, t) => {
      const Lv = live() || L0;
      syr.gm.opacity = 0.08 + brownOp(Lv.cB);
      cloud(Math.min(30, Math.round(Lv.nB * 260)), Math.min(16, Math.round(Lv.nA * 260)), t);
    });
    tag(v3(sx + 8, sy + L + 4, BZ), 'Шприц', 'V = ' + fmt(d.V, 2).replace(/,?0+$/, '') + ' л · ' + d.T + ' °C', d.dir !== 0);
    tag(v3(-52, TY + 22, -33), 'Смещение', d.dir > 0 ? 'вправо →' : d.dir < 0 ? '← влево' : 'равновесие', d.dir !== 0);
  };
})();
