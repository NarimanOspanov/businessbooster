// «Как в жизни» для химии: «Кислород, водород, вода» (labs/chem-oxy) и «Вещества и смеси» (labs/chem-subst).
// Белый лабораторный поднос, прозрачная посуда, спиртовки, штативы, растворы и пламя верного цвета.
// Сцены строятся из window.LUCH_REAL() опыта; быстрые значения (доля газа, мл, ход опыта) — из LUCH_REAL.live() в onFrame.
(() => {
  const SC = window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {};
  const live = () => { try { return window.LUCH_REAL.live ? window.LUCH_REAL.live() : null; } catch (e) { return null; } };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (x, n) => (Math.round(x * 10 ** n) / 10 ** n).toFixed(n).replace('.', ',');
  const rnd = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const ease = x => x * x * (3 - 2 * x);
  const hexN = s => typeof s === 'number' ? s : parseInt(String(s).slice(1), 16);
  const hexs = c => '#' + c.toString(16).padStart(6, '0');
  const nowS = () => performance.now() / 1000;
  const TY = 1.2; // верх подноса
  // память между перестройками сцены: вспышки при пробе, капли после фильтрования
  const mem = {};

  // ---------- общие детали ----------
  function H(kit) {
    const { T, at, box, cyl, mesh, keep, grad, glowTex, textTex, clickable, toon, C } = kit;
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    const v2 = (x, y) => new T.Vector2(x, y);
    const glassMat = (color = 0xd8eef8, opacity = 0.24) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, transparent: true, opacity, side: T.DoubleSide, depthWrite: false }));
    const ownMat = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, ...o }));
    const spr = (map, color, opacity, add) => new T.Sprite(keep(new T.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending })));
    const glow = (color, size, opacity) => { const s = spr(glowTex(), color, opacity, true); s.scale.setScalar(size); return s; };
    const hitBox = (w, h, d) => new T.Mesh(keep(new T.BoxGeometry(w, h, d)), keep(new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })));
    const ball = (r, color, o = {}) => mesh(new T.SphereGeometry(r, o.seg || 16, o.seg2 || 12), color, { hull: o.hull ?? true, edges: false, matOpt: o.matOpt, shadow: o.shadow, mat: o.mat });
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
    function drawLines(x, pw, ph, lines, col, weight = 600, k = 0.64) {
      const lh = ph / lines.length;
      lines.forEach((ln, i) => {
        let fs = Math.round(lh * k); x.font = `${weight} ${fs}px "IBM Plex Mono", monospace`;
        const tw = x.measureText(ln).width; if (tw > pw * 0.88) { fs = Math.floor(fs * pw * 0.88 / tw); x.font = `${weight} ${fs}px "IBM Plex Mono", monospace`; }
        x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ln, pw / 2, lh * (i + 0.5) + 2);
      });
    }
    // табло: текст меняется в onFrame (строки через \n)
    function screen(w, h, txt, fg = '#86e0a8', pw = 320, ph = 120) {
      const k = canvasTex(pw, ph); let cur = null;
      const set = (t, col = fg) => {
        t = String(t); if (cur === t + col) return; cur = t + col;
        k.x.fillStyle = '#0e1520'; k.x.fillRect(0, 0, pw, ph); drawLines(k.x, pw, ph, t.split('\n'), col); k.tex.needsUpdate = true;
      };
      set(txt);
      const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: k.tex })));
      m.userData.set = set; return m;
    }
    // бумажная наклейка
    function sticker(w, h, txt, fg = '#1b1610', bg = '#fffaf0', pw = 256) {
      const ph = Math.round(pw * h / w), k = canvasTex(pw, ph);
      k.x.fillStyle = bg; k.x.beginPath(); k.x.roundRect ? k.x.roundRect(3, 3, pw - 6, ph - 6, ph * 0.18) : k.x.rect(3, 3, pw - 6, ph - 6); k.x.fill();
      k.x.strokeStyle = '#1b1610'; k.x.lineWidth = 5; k.x.stroke();
      drawLines(k.x, pw, ph, String(txt).split('\n'), fg);
      return new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: k.tex, transparent: true })));
    }
    // наклейка, лежащая на подносе
    function floorLabel(parent, x, z, w, h, txt, fg, bg) { const s = sticker(w, h, txt, fg, bg); s.rotation.x = -Math.PI / 2; return at(s, x, TY + 0.08, z, parent); }
    // «таблетка», всегда смотрит на зрителя
    function pill(parent, x, y, z, txt, fg = '#1b1610', bg = '#fff6e6', hgt = 3.2) {
      const lines = String(txt).split('\n'), mc = document.createElement('canvas').getContext('2d');
      let mw = 0; lines.forEach((l, i) => { mc.font = `700 ${i ? 38 : 50}px "IBM Plex Mono", monospace`; mw = Math.max(mw, mc.measureText(l).width); });
      const pw = Math.max(128, Math.ceil(mw + 60)), ph = 72 * lines.length + 8, k = canvasTex(pw, ph);
      const m = new T.Sprite(keep(new T.SpriteMaterial({ map: k.tex, transparent: true, depthTest: false, depthWrite: false })));
      m.renderOrder = 6; m.center.set(0.5, 0);
      k.x.fillStyle = bg; k.x.strokeStyle = '#1b1610'; k.x.lineWidth = 5;
      const w = Math.min(pw - 6, mw + 34), x0 = (pw - w) / 2;
      k.x.beginPath(); if (k.x.roundRect) k.x.roundRect(x0, 3, w, ph - 6, 26); else k.x.rect(x0, 3, w, ph - 6); k.x.fill(); k.x.stroke();
      const lh = (ph - 8) / lines.length;
      lines.forEach((l, i) => { k.x.fillStyle = fg; k.x.font = `700 ${i ? 38 : 50}px "IBM Plex Mono", monospace`; k.x.textAlign = 'center'; k.x.textBaseline = 'middle'; k.x.fillText(l, pw / 2, 4 + lh * (i + 0.5) + 2); });
      k.tex.needsUpdate = true;
      m.scale.set(hgt * pw / 72, hgt * ph / 72, 1);
      return at(m, x, y, z, parent);
    }
    // клавиша на подносе с надписью сверху
    function key(parent, x, z, w, d, label, color, keyName, fg = '#ffffff') {
      const b = new T.Group(); at(b, x, TY, z, parent);
      at(box(w, 1.6, d, color), 0, 0.8, 0, b);
      const top = sticker(w * 0.94, d * 0.84, label, fg, hexs(color), Math.round(Math.min(512, 90 * w / d * 1.4)));
      top.rotation.x = -Math.PI / 2; at(top, 0, 1.62, 0, b);
      if (keyName) clickable(b, keyName);
      return b;
    }
    // белый лабораторный поднос с бортиками
    function tray(g, w = 124, d = 84, z = 4) {
      at(box(w, TY, d, 0xf3f5f8), 0, TY / 2, z, g);
      at(box(w, 1.5, 1.2, 0xe2e7ee), 0, TY + 0.75, z - d / 2 + 0.6, g); at(box(w, 1.5, 1.2, 0xe2e7ee), 0, TY + 0.75, z + d / 2 - 0.6, g);
      at(box(1.2, 1.5, d - 2.4, 0xe2e7ee), -w / 2 + 0.6, TY + 0.75, z, g); at(box(1.2, 1.5, d - 2.4, 0xe2e7ee), w / 2 - 0.6, TY + 0.75, z, g);
    }
    // стеклянный стакан/банка; o.marks — деления, o.spout — носик
    function beaker(parent, x, y0, z, r, h, o = {}) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const wall = new T.Mesh(keep(new T.CylinderGeometry(r, r * 0.98, h, 40, 1, true)), glassMat(0xd8eef8, o.op ?? 0.22)); at(wall, 0, h / 2, 0, g);
      if (r < 4) wall.add(new T.Mesh(wall.geometry, kit.hullMat));
      at(cyl(r * 0.97, 0.6, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.45 } }), 0, 0.3, 0, g);
      const rim = mesh(new T.TorusGeometry(r, 0.24, 6, 40), 0xeef6fb, { edges: false, shadow: false }); rim.rotation.x = Math.PI / 2; at(rim, 0, h, 0, g);
      if (r >= 4) { const br = new T.Mesh(kit.keep(new T.TorusGeometry(r, 0.14, 6, 40)), kit.keep(new T.MeshBasicMaterial({ color: 0x5d7088 }))); br.rotation.x = Math.PI / 2; at(br, 0, 0.1, 0, g);
        [-1, 1].forEach(sx => { const e = box(0.18, h, 0.18, 0xa9c4d8, { edges: false, hull: false, shadow: false }); at(e, sx * r * 0.99, h / 2, 0, g); }); }
      if (o.spout) { const sp = mesh(new T.TorusGeometry(0.9, 0.22, 6, 12, Math.PI), 0xeef6fb, { edges: false }); sp.rotation.set(Math.PI / 2, 0, Math.PI / 2); at(sp, -r - 0.2, h, 0, g); }
      if (o.marks !== false) { const a = 0.5; for (let k = 1; k <= 5; k++) { const m = box(k % 2 ? 1.1 : 2, 0.16, 0.1, 0x6f8098, { edges: false, shadow: false }); m.rotation.y = a; at(m, Math.sin(a) * (r + 0.05), h * k / 6.5, Math.cos(a) * (r + 0.05), g); } }
      return { g, r, h, wall };
    }
    // жидкость: цилиндр единичной высоты
    function liquid(parent, x, y0, z, r, color, opacity = 0.62) {
      const mat = ownMat(color, { transparent: true, opacity, depthWrite: false });
      const m = new T.Mesh(keep(new T.CylinderGeometry(r, r * 0.98, 1, 40)), mat);
      at(m, x, y0, z, parent);
      const set = (hgt, yb = y0) => { m.visible = hgt > 0.05; m.scale.y = Math.max(0.05, hgt); m.position.y = yb + Math.max(0.05, hgt) / 2; };
      return { m, mat, set };
    }
    // пробирка: открытая трубка с круглым дном (дно в y = 0)
    function testTube(parent, x, y0, z, r, hh) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const wg = keep(new T.CylinderGeometry(r, r, hh - r, 28, 1, true));
      const wall = new T.Mesh(wg, glassMat(0xd8eef8, 0.24)); at(wall, 0, r + (hh - r) / 2, 0, g); wall.add(new T.Mesh(wg, kit.hullMat));
      const bg = keep(new T.SphereGeometry(r, 28, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2));
      const bot = new T.Mesh(bg, glassMat(0xd8eef8, 0.24)); at(bot, 0, r, 0, g); bot.add(new T.Mesh(bg, kit.hullMat));
      const rim = mesh(new T.TorusGeometry(r + 0.1, 0.25, 6, 28), 0xeef6fb, { edges: false }); rim.rotation.x = Math.PI / 2; at(rim, 0, hh, 0, g);
      return { g, r, hh };
    }
    // жидкость в пробирке до уровня lv от дна
    function tubeLiquid(parent, r, lv, color, opacity) {
      const mat = ownMat(color, { transparent: true, opacity, depthWrite: false }), g = new T.Group(); parent.add(g);
      const rr = r * 0.86;
      at(new T.Mesh(keep(new T.SphereGeometry(rr, 24, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), mat), 0, r, 0, g);
      if (lv > r) at(new T.Mesh(keep(new T.CylinderGeometry(rr, rr, lv - r, 24)), mat), 0, r + (lv - r) / 2, 0, g);
      return { g, mat };
    }
    // коническая колба
    function cflask(parent, x, y0, z, R, h, rn) {
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
      return { g, fill, top: y0 + h };
    }
    // круглая колба с горлом
    function rflask(parent, x, y0, z, R, neck) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const sg = keep(new T.SphereGeometry(R, 32, 20));
      const bulb = new T.Mesh(sg, glassMat(0xd8eef8, 0.22)); at(bulb, 0, R, 0, g); bulb.add(new T.Mesh(sg, kit.hullMat));
      const ng = keep(new T.CylinderGeometry(R * 0.3, R * 0.32, neck, 24, 1, true));
      const nk = new T.Mesh(ng, glassMat(0xd8eef8, 0.24)); at(nk, 0, R * 1.9 + neck / 2, 0, g); nk.add(new T.Mesh(ng, kit.hullMat));
      return { g, top: R * 1.9 + neck, R };
    }
    function bubbles(parent, x, y0, z, r, n = 8, color = 0xffffff) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const geo = keep(new T.SphereGeometry(1, 10, 8)), mat = keep(new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false }));
      const bs = [];
      for (let i = 0; i < n; i++) { const m = new T.Mesh(geo, mat); m.visible = false; g.add(m); bs.push({ m, ph: rnd(i + 11), a: rnd(i + 21) * Math.PI * 2, rr: Math.sqrt(rnd(i + 31)) * r }); }
      const st = { amt: 0, top: 5, big: 0.5, speed: 0.6, y0: 0.4 };
      kit.onFrame((dt, t) => {
        const k = Math.round(st.amt * n);
        bs.forEach((b, i) => {
          b.m.visible = i < k && st.top > st.y0 + 0.8; if (!b.m.visible) return;
          const ph = kit.reduce ? b.ph : (t * st.speed + b.ph) % 1;
          b.m.scale.setScalar(st.big * (0.5 + 0.8 * ph));
          b.m.position.set(Math.cos(b.a) * b.rr + 0.25 * Math.sin(t * 5 + i), st.y0 + ph * (st.top - st.y0 - 0.4), Math.sin(b.a) * b.rr);
        });
      });
      return { g, set(a, top, big = 0.5, speed = 0.6, y0 = 0.4) { Object.assign(st, { amt: a, top, big, speed, y0 }); } };
    }
    let puffT = null;
    function puffTex() {
      if (puffT) return puffT;
      const k = canvasTex(64, 64), gr = k.x.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.5, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      k.x.fillStyle = gr; k.x.fillRect(0, 0, 64, 64); puffT = k.tex; return puffT;
    }
    // клубы пара/дыма
    function puffs(parent, x, y, z, o = {}) {
      const n = o.n || 6, ps = [], g = new T.Group(); at(g, x, y, z, parent);
      for (let i = 0; i < n; i++) { const s = spr(puffTex(), o.color ?? 0xffffff, 0, false); g.add(s); ps.push({ s, ph: i / n, dx: (rnd(i + 3) - 0.5) * (o.spread ?? 6), dz: (rnd(i + 9) - 0.5) * (o.spread ?? 6) }); }
      const st = { amt: o.amt ?? 1 };
      kit.onFrame((dt, t) => {
        for (const p of ps) {
          const ph = kit.reduce ? 0.15 + p.ph * 0.7 : (t * (o.speed || 0.3) + p.ph) % 1;
          p.s.position.set(p.dx * (0.6 + ph), ph * (o.rise ?? 10), p.dz * (0.6 + ph));
          p.s.scale.setScalar((o.size || 4) * (0.6 + ph * 1.3));
          p.s.material.opacity = st.amt * (o.op ?? 0.5) * Math.sin(Math.PI * ph);
        }
      });
      return { g, set(a) { st.amt = a; } };
    }
    // пламя-спрайт с внутренним ядром (сера, лучинка, магний, фосфор)
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
    function flame(parent, x, y, z, hgt, inner, outer, glowCol, gl = 0.45) {
      const g = new T.Group(); at(g, x, y, z, parent);
      const s = spr(flameTex(inner, outer), 0xffffff, 0.95, false); s.center.set(0.5, 0.04); s.scale.set(hgt * 0.5, hgt, 1); at(s, 0, 0, 0, g);
      at(glow(glowCol, hgt * 2.2, gl), 0, hgt * 0.35, 0, g);
      if (!kit.reduce) kit.onFrame((dt, t) => { s.scale.set(hgt * 0.5 * (1 + 0.08 * Math.sin(t * 17)), hgt * (1 + 0.12 * Math.sin(t * 13) + 0.05 * Math.sin(t * 29)), 1); });
      return g;
    }
    // спиртовка: стеклянный корпус, латунная горловина, фитиль, пламя или колпачок
    function spirit(parent, x, y, z, on, s = 1) {
      const g = new T.Group(); at(g, x, y, z, parent);
      at(cyl(4.2 * s, 5 * s, 0xbfe3f2, { r2: 2.9 * s, matOpt: { transparent: true, opacity: 0.6 } }), 0, 2.5 * s, 0, g);
      at(cyl(3.8 * s, 2.4 * s, 0x8fc6ff, { r2: 3.4 * s, edges: false, hull: false, matOpt: { transparent: true, opacity: 0.7 } }), 0, 1.3 * s, 0, g);
      at(cyl(1.6 * s, 1.5 * s, C.BRASS), 0, 5.7 * s, 0, g);
      at(cyl(0.5 * s, 1.3 * s, 0xf4efe2, { hull: false }), 0, 7 * s, 0, g);
      if (on) {
        const f = new T.Group(); at(f, 0, 7.5 * s, 0, g);
        const hgt = 8 * s;
        at(cyl(1.4 * s, hgt, 0xff8a2a, { r2: 0.05, edges: false, hull: false, shadow: false, matOpt: { emissive: 0xff6a10, emissiveIntensity: 0.9, transparent: true, opacity: 0.85 } }), 0, hgt / 2, 0, f);
        at(cyl(0.7 * s, hgt * 0.55, 0x9fd3ff, { r2: 0.05, edges: false, hull: false, shadow: false, matOpt: { emissive: 0x6ab0ff, emissiveIntensity: 0.8 } }), 0, hgt * 0.28, 0, f);
        at(glow(0xff9a40, hgt * 2.2, 0.55), 0, hgt * 0.45, 0, f);
        at(new T.PointLight(0xffa040, 22 * s, 40, 1.4), 0, hgt * 0.5, 0, f);
        if (!kit.reduce) kit.onFrame((dt, t) => { f.scale.set(1 + 0.06 * Math.sin(t * 17), 1 + 0.1 * Math.sin(t * 11) + 0.05 * Math.sin(t * 29), 1 + 0.06 * Math.cos(t * 15)); });
      } else at(cyl(2 * s, 2.8 * s, 0xbfe3f2, { r2: 1.6 * s, matOpt: { transparent: true, opacity: 0.55 } }), 0, 7.3 * s, 0, g);
      return g;
    }
    // штатив с лапками (основание на подносе)
    function stand(parent, x, z, Hh, arms) {
      at(box(12, 1.2, 9, C.DARK), x, TY + 0.6, z, parent);
      at(cyl(0.65, Hh, C.STEEL, { edges: false }), x, TY + 1.2 + Hh / 2, z, parent);
      arms.forEach(a => {
        rodAB(parent, v3(x, a.y, z), v3(a.to.x, a.y, a.to.z), 0.42, C.STEEL);
        at(box(2.2, 2.2, 2.2, C.DARK), x, a.y, z, parent);
        if (a.ring) { const rg = mesh(new T.TorusGeometry(a.ring, 0.42, 8, 28), 0x3b4a66, { edges: false, hull: true }); rg.rotation.x = Math.PI / 2; at(rg, a.to.x, a.y, a.to.z, parent); }
        else if (a.clamp !== false) at(box(2.6, 2.4, 2.6, 0x3b4a66), a.to.x, a.y, a.to.z, parent);
      });
    }
    // трубка (стекло, резина, провод) по точкам
    function pipe(parent, pts, r = 0.55, color = 0xcfe6f2) {
      const curve = new T.CatmullRomCurve3(pts, false, 'catmullrom', 0.05);
      parent.add(mesh(new T.TubeGeometry(curve, Math.max(24, Math.round(curve.getLength() * 1.5)), r, 10), color, { hull: true, edges: false }));
      return curve;
    }
    let dashT = null;
    function dashTex() {
      if (dashT) return dashT;
      const k = canvasTex(64, 8); k.x.fillStyle = '#ffd166'; k.x.fillRect(8, 0, 16, 8);
      dashT = k.tex; dashT.wrapS = T.RepeatWrapping; return dashT;
    }
    function wire(pts, color, flow = 0, r = 0.75) {
      const curve = new T.CatmullRomCurve3(pts, false, 'centripetal');
      const segs = Math.max(30, Math.round(curve.getLength() * 1.4));
      kit.root.add(mesh(new T.TubeGeometry(curve, segs, r, 10), color, { hull: true, edges: false }));
      if (flow > 1e-6) {
        const tex = keep(dashTex().clone()); tex.needsUpdate = true; tex.repeat.set(Math.max(1, curve.getLength() / 10), 1);
        const sl = new T.Mesh(keep(new T.TubeGeometry(curve, segs, r * 1.1, 10)), keep(new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })));
        sl.renderOrder = 2; kit.root.add(sl);
        if (!kit.reduce) kit.onFrame(dt => { tex.offset.x -= 1.4 * dt; });
      }
      return curve;
    }
    // точки, бегущие по кривой (газ по трубкам)
    function stream(parent, curve, n, color, speed = 0.3, r = 0.35) {
      const geo = keep(new T.SphereGeometry(1, 10, 8)), mat = keep(new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false })), ds = [];
      for (let i = 0; i < n; i++) { const m = new T.Mesh(geo, mat); m.scale.setScalar(r); parent.add(m); ds.push(m); }
      const st = { k: 0 };
      kit.onFrame((dt, t) => { ds.forEach((m, i) => { m.visible = i < st.k; if (!m.visible) return; const u = kit.reduce ? (i + 0.5) / n : (t * speed + i / n) % 1; m.position.copy(curve.getPointAt(u)); }); });
      return { set(k) { st.k = k; } };
    }
    // подпись со значением, которое меняется в onFrame
    function liveTag(p, name, value, hot) {
      kit.tag(p, name, value || ' ', hot);
      const els = document.querySelectorAll('.rl-view .rl-lbl'), el = els[els.length - 1], i = el && el.querySelector('i');
      let cur = value;
      return v => { if (i && v !== cur) { cur = v; i.textContent = v; } };
    }
    // кольцо-подсветка на подносе
    const ring = (parent, x, z, r, col = 0xffd166) => at(cyl(r, 0.25, col, { edges: false, hull: false, shadow: false }), x, TY + 0.13, z, parent);
    const ringT = (parent, x, z, r, col = 0x2f9e55, y = TY + 0.4) => { const m = new T.Mesh(keep(new T.TorusGeometry(r, 0.45, 8, 40)), keep(new T.MeshBasicMaterial({ color: col }))); m.rotation.x = Math.PI / 2; return at(m, x, y, z, parent); };
    // фарфоровая чашечка/блюдце
    function dish(parent, x, z, r, col = 0xf7f5f0) {
      const g = new T.Group(); at(g, x, TY, z, parent);
      const geo = keep(new T.LatheGeometry([v2(0.001, 0), v2(r * 0.55, 0), v2(r * 0.62, 0.25), v2(r, 1.3), v2(r + 0.25, 1.45)], 32));
      const m = new T.Mesh(geo, toon(col, { side: T.DoubleSide })); m.castShadow = true; g.add(m); m.add(new T.Mesh(geo, kit.hullMat));
      return g;
    }
    return { v3, v2, glassMat, ownMat, spr, glow, hitBox, ball, rodAB, canvasTex, drawLines, screen, sticker, floorLabel, pill, key, tray, beaker, liquid, testTube, tubeLiquid, cflask, rflask, bubbles, puffs, flame, spirit, stand, pipe, wire, stream, liveTag, ring, ringT, dish };
  }
  const mixC = (T, a, b, t) => new T.Color(hexN(a)).lerp(new T.Color(hexN(b)), clamp(t, 0, 1));
  const lowF = s => String(s).replace(/(\d)/g, x => '₀₁₂₃₄₅₆₇₈₉'[+x]);

  // =====================================================================================
  // ===== Кислород и горение: две банки, ложечка для сжигания, вещества на блюдцах =====
  const NAME1 = { splint: 'Лучинка', C: 'Уголь', S: 'Сера', Fe: 'Железо', Mg: 'Магний' };
  const SHORT1 = { splint: { air: 'только тлеет', O2: 'вспыхнула!' }, C: { air: 'тлеет', O2: 'горит добела' }, S: { air: 'бледное пламя', O2: 'ярко-синее пламя' },
    Fe: { air: 'не горит', O2: 'горит, искры!' }, Mg: { air: 'белое пламя', O2: 'ещё ярче' } };
  const GLC = { O: 0xffa040, W: 0xfff4dc, B: 0x7a6cff };
  // вещество для ложечки и для блюдца; hot — цвет каления
  function item1(kit, h, it, hot, len = 16) {
    const { T, at, box, cyl, mesh, C } = kit, g = new T.Group();
    const em = hot ? { emissive: hexN(hot), emissiveIntensity: 0.9 } : undefined;
    if (it === 'splint') {
      at(box(0.8, len, 0.8, 0xd9b07a), 0, len / 2, 0, g);
      at(h.ball(0.7, hot ? hexN(hot) : 0x3a2a20, { matOpt: hot ? em : undefined }), 0, 0.1, 0, g);
    } else if (it === 'C') {
      for (let i = 0; i < 4; i++) { const m = mesh(new T.DodecahedronGeometry(0.9 + rnd(i) * 0.4), hot ? 0x6a3a2a : 0x26262a, { hull: true, edges: false, matOpt: em }); m.rotation.set(rnd(i + 2) * 3, rnd(i + 3) * 3, 0); at(m, (rnd(i + 5) - 0.5) * 2, 0.8 + (i > 2 ? 0.9 : 0), (rnd(i + 7) - 0.5) * 2, g); }
    } else if (it === 'S') {
      at(cyl(1.7, 1.3, 0xf2d43a, { r2: 0.5, edges: false, matOpt: em }), 0, 0.65, 0, g);
    } else if (it === 'Fe') {
      const pts = []; for (let i = 0; i <= 80; i++) { const a = i / 80 * Math.PI * 10; pts.push(new T.Vector3(Math.cos(a) * 1.1, i / 80 * 7, Math.sin(a) * 1.1)); }
      at(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 160, 0.22, 6), hot ? 0xffd08a : 0x8a929c, { hull: true, edges: false, matOpt: em }), 0, 0, 0, g);
      at(box(0.4, 3, 0.4, 0xd9b07a), 0, -1.5, 0, g); // спичка-запал
    } else if (it === 'Mg') {
      const m = box(0.3, 7, 1.2, hot ? 0xffffff : 0xc9ced8, { matOpt: em }); m.rotation.z = 0.12; at(m, 0, 3.5, 0, g);
    }
    return g;
  }
  SC['chlb-burn'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const JX = { A: -32, B: -4 }, JZ = -6, JR = 8, JH = 28;
    // банки
    ['A', 'B'].forEach(j => {
      const jg = new T.Group(); at(jg, JX[j], TY, JZ, g); clickable(jg, 'j-' + j);
      h.beaker(jg, 0, 0, 0, JR, JH, { marks: false, op: 0.2 });
      at(cyl(JR - 0.4, 1.2, 0xe8d9b0, { edges: false, hull: false }), 0, 0.9, 0, jg); // слой песка на дне
      if (d.jar !== j || d.it === 'splint') { if (d.jar !== j) at(cyl(JR + 1, 0.5, 0xc9a26b), 0, JH + 0.25, 0, jg); }
      const rv = d.rev[j], lab = (j === 'A' ? 'А' : 'Б') + '\n' + (rv ? (rv === 'O2' ? 'O₂' : 'воздух') : '?');
      at(h.sticker(6.4, 5.2, lab, '#1b1610', rv === 'O2' ? '#c9f0d4' : '#fffaf0'), 0, 7, JR + 0.1, jg);
      if (d.jarSel === j) h.ring(g, JX[j], JZ, JR + 2.4);
      at(h.hitBox(JR * 2, JH, JR * 2), 0, JH / 2, 0, jg);
    });
    // вещества на блюдцах
    const POS = { splint: [14, 22], C: [27, 22], S: [40, 22], Fe: [20, 35], Mg: [33, 35] };
    Object.entries(POS).forEach(([it, [x, z]]) => {
      const ig = new T.Group(); at(ig, x, 0, z, g); clickable(ig, 'i-' + it);
      h.dish(ig, 0, 0, 5);
      if (d.it !== it) {
        const m = item1(kit, h, it);
        if (it === 'splint' || it === 'Mg' || it === 'Fe') { m.rotation.z = Math.PI / 2; at(m, it === 'splint' ? 7 : 3.5, TY + 1.6, 0, ig); }
        else at(m, 0, TY + 0.4, 0, ig);
      }
      if (d.found[it]) h.ringT(g, x, z, 5.8);
      at(h.hitBox(10, 6, 10), 0, TY + 3, 0, ig);
      h.floorLabel(g, x, z + 6.4, 7, 2.4, NAME1[it], '#1b1610', d.found[it] ? '#c9f0d4' : '#fffaf0');
    });
    // спиртовка — поджигать вещества
    h.spirit(g, -52, TY, 30, true);
    // ложечка: в банке или лежит на подносе
    const sg = new T.Group(); g.add(sg);
    const spoon = (parent, withCup) => {
      at(cyl(0.32, 26, C.STEEL, { edges: false }), 0, 13, 0, parent);
      if (withCup) { at(cyl(1.9, 1.1, C.STEEL, { r2: 2.2 }), 0, -0.2, 0, parent); }
      at(box(0.9, 0.9, 5, C.STEEL), 0, 26, 2.2, parent);
    };
    const P = new T.Group();
    if (d.it) {
      clickable(sg, 'out');
      sg.position.set(JX[d.jar], TY + 10, JZ);
      if (d.it === 'splint') { const s = item1(kit, h, 'splint', d.fx && d.fx.em, 26); s.rotation.z = 0.12; P.add(s); sg.add(P); }
      else {
        spoon(sg, d.it !== 'Fe');
        at(cyl(JR + 1, 0.5, 0xc9a26b), 0, JH - 9.75, 0, sg);
        const s = item1(kit, h, d.it, d.fx && d.fx.em); at(s, 0, d.it === 'Fe' ? -7.2 : 0.3, 0, sg);
        if (d.it === 'Fe') at(mesh(new T.TorusGeometry(0.7, 0.18, 6, 12), C.STEEL, { edges: false }), 0, -0.2, 0, sg);
      }
      at(h.hitBox(5, 30, 5), 0, 13, 0, sg);
      // эффект горения
      const fx = d.fx, eg = new T.Group(); at(eg, 0, d.it === 'Fe' ? -4 : d.it === 'splint' ? 0 : 1.2, 0, sg);
      const glc = GLC[fx.glow] || 0xffa040;
      if (fx.fl) h.flame(eg, 0, d.it === 'splint' ? 0.4 : 0.2, 0, fx.fl * 0.55, fx.core, fx.c, glc, 0.5);
      const gl = h.glow(glc, fx.gr * 0.32, 0.6); at(gl, 0, 1, 0, eg);
      const light = new T.PointLight(glc, fx.gr * 1.1, 70, 1.3); at(light, 0, 2, 0, eg);
      const sparks = [];
      if (fx.sp) {
        const geo = kit.keep(new T.SphereGeometry(1, 8, 6)), mat = kit.keep(new T.MeshBasicMaterial({ color: 0xffe9a8 }));
        for (let i = 0; i < 28; i++) { const m = new T.Mesh(geo, mat); eg.add(m); const a = rnd(i + 40) * 6.28, up = 0.2 + rnd(i + 41) * 0.8; sparks.push({ m, dx: Math.cos(a) * (1 - up * 0.5), dy: up, dz: Math.sin(a) * (1 - up * 0.5), ph: rnd(i + 42), sp: 5 + rnd(i + 43) * 3 }); }
        // капли окалины на песке
        for (let i = 0; i < 6; i++) { const b = h.ball(0.45, 0x2a2420, { hull: false }); at(b, JX[d.jar] + (rnd(i + 60) - 0.5) * 8, TY + 1.7, JZ + (rnd(i + 61) - 0.5) * 8, g); b.userData.k = i; sparks.push({ drop: b }); }
      }
      const smoke = d.it === 'Mg' ? h.puffs(eg, 0, 2, 0, { n: 6, spread: 6, rise: 14, size: 4, op: 0.4, color: 0xf4f4f4, amt: 0 }) : null;
      eg.visible = false;
      kit.onFrame((dt, t) => {
        const L = live() || {}, el = (L.el ?? 1e4) / 1000, k = kit.reduce ? 1 : ease(clamp(el / 0.6, 0, 1));
        sg.position.y = TY + 10 + (1 - k) * 22;
        eg.visible = k > 0.85;
        const fl = kit.reduce ? 1 : 1 + 0.12 * Math.sin(t * 19) + 0.08 * Math.sin(t * 7);
        gl.scale.setScalar(fx.gr * 0.32 * fl); light.intensity = fx.gr * 1.1 * fl;
        sparks.forEach((s, i) => {
          if (s.drop) { s.drop.visible = el > 1.2 + s.drop.userData.k * 0.5; return; }
          const ph = kit.reduce ? s.ph : (t * 1.3 + s.ph) % 1;
          s.m.position.set(s.dx * ph * s.sp, s.dy * ph * s.sp * 0.8 - ph * ph * 5, s.dz * ph * s.sp);
          s.m.scale.setScalar(0.32 * (1 - ph) + 0.05);
        });
        if (smoke) smoke.set(clamp(el / 1.5, 0, 1));
      });
    } else {
      // пустая ложечка лежит на подносе
      sg.position.set(-24, TY + 1.2, 32); sg.rotation.set(0, 0.3, Math.PI / 2);
      spoon(sg, true);
    }
    // подписи
    const jv = j => d.jar === j ? NAME1[d.it] + ': ' + SHORT1[d.it][d.gas] : d.rev[j] ? (d.rev[j] === 'O2' ? 'кислород' : 'воздух') : 'что внутри?';
    tag(v3(JX.A, TY + JH + (d.jar === 'A' ? 22 : 4), JZ), 'Банка А', jv('A'), d.jar === 'A' && d.gas === 'O2');
    tag(v3(JX.B, TY + JH + (d.jar === 'B' ? 22 : 4), JZ), 'Банка Б', jv('B'), d.jar === 'B' && d.gas === 'O2');
    const n = ['splint', 'C', 'S', 'Fe'].filter(k => d.found[k]).length;
    tag(v3(26, TY + 9, 26), 'Вещества', `в O₂ проверено ${n} из 4`, n === 4);
  };

  // ===== Водород: прибор Zn + HCl, пробирка вверх дном, проба у пламени, трубка с CuO =====
  SC['chlb-hydro'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const GX = -26, GZ = -6, Hp = TY + 27, Yc = TY + 14, GL = 0xcfe6f2;
    // прибор: широкая пробирка в штативе, цинк, кислота, капельная воронка
    h.stand(g, GX, GZ - 11, 30, [{ y: TY + 16, to: v3(GX, 0, GZ) }]);
    const gen = new T.Group(); at(gen, GX, 0, GZ, g); clickable(gen, 'acid');
    h.testTube(gen, 0, TY + 2, 0, 3.4, 18);
    for (let i = 0; i < 7; i++) at(h.ball(0.95, 0x8b96ad, { seg: 8, seg2: 6 }), (rnd(i) - 0.5) * 3.4, TY + 3.2 + (i > 3 ? 1.1 : 0), (rnd(i + 3) - 0.5) * 3.4, gen);
    if (d.wet) { const lq = h.tubeLiquid(gen, 3.4, 8, 0xd6f0b8, 0.5); lq.g.position.y = TY + 2; }
    const bub = h.bubbles(gen, 0, TY + 3.5, 0, 2.2, 12);
    at(cyl(3.6, 2.6, 0x7a3a2a, { r2: 3.9 }), 0, TY + 21.2, 0, gen);
    // капельная воронка с краном
    const fx = -1.4;
    at(cyl(0.45, 5, GL, { edges: false }), fx, TY + 24.8, 0, gen);
    const tap = box(2.6, 1.1, 1.1, d.acid ? 0x3fae5a : 0xe0473a); at(tap, fx, TY + 27.6, 0, gen);
    at(cyl(0.6, 2.4, GL, { r2: 2.6, edges: false }), fx, TY + 29.4, 0, gen);
    const fun = new T.Mesh(kit.keep(new T.CylinderGeometry(2.6, 2.6, 6, 28, 1, true)), h.glassMat(0xd8eef8, 0.3)); at(fun, fx, TY + 33.6, 0, gen); fun.add(new T.Mesh(fun.geometry, kit.hullMat));
    at(cyl(2.3, d.acid ? 3 : 4.6, 0xc8eaa0, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.6 } }), fx, TY + 30.6 + (d.acid ? 1.5 : 2.3), 0, gen);
    at(cyl(1.4, 1.4, 0x7a3a2a), fx, TY + 37.2, 0, gen);
    at(h.hitBox(9, 38, 9), 0, TY + 19, 0, gen);
    const drop = h.ball(0.35, 0xc8eaa0, { hull: false }); at(drop, fx, TY + 26, 0, gen); drop.visible = false;
    // газоотводные трубки
    const ox = GX + 1.4;
    h.pipe(g, [v3(ox, TY + 22.5, GZ), v3(ox, Hp - 1.2, GZ), v3(ox + 1.2, Hp, GZ), v3(-3.2, Hp, GZ), v3(-2, Hp, GZ), v3(8, Hp, GZ)], 0.55, GL);
    h.pipe(g, [v3(-2, Hp, GZ), v3(-2, Hp + 5, GZ)], 0.55, GL);
    const outTip = new T.Group(); at(outTip, -2, Hp + 3, GZ, g); clickable(outTip, 'z-out'); at(h.hitBox(5, 8, 5), 0, 0, 0, outTip);
    // резиновый шланг с зажимом
    h.pipe(g, [v3(7, Hp, GZ), v3(14, Hp, GZ)], 0.9, 0x6a2a24);
    const cl = new T.Group(); at(cl, 10.5, Hp, GZ, g); clickable(cl, 'clamp');
    at(box(1.2, d.clamp ? 4.4 : 2.6, 3.4, d.clamp ? 0x3fae5a : 0xe0473a), 0, 0, 0, cl);
    at(box(1.4, 0.8, 4.2, C.STEEL), 0, d.clamp ? 2.3 : 1.4, 0, cl); at(box(1.4, 0.8, 4.2, C.STEEL), 0, d.clamp ? -2.3 : -1.4, 0, cl);
    at(h.hitBox(6, 8, 6), 0, 0, 0, cl);
    h.pipe(g, [v3(13, Hp, GZ), v3(16, Hp, GZ), v3(17.2, Hp - 1.2, GZ), v3(17.2, Yc + 1, GZ), v3(18.4, Yc, GZ), v3(20, Yc, GZ)], 0.55, GL);
    // трубка с оксидом меди над спиртовкой
    const ct = new T.Mesh(kit.keep(new T.CylinderGeometry(1.9, 1.9, 28, 28, 1, true)), h.glassMat(0xd8eef8, 0.28)); ct.rotation.z = Math.PI / 2; at(ct, 33, Yc, GZ, g); ct.add(new T.Mesh(ct.geometry, kit.hullMat));
    at(cyl(1.0, 1.2, 0x7a3a2a), 19.6, Yc, GZ, g).rotation.z = Math.PI / 2;
    const cuM = h.ownMat(0x1d1d1d), cuo = box(11, 1.1, 2.6, 0x1d1d1d, { edges: false, mat: cuM }); at(cuo, 31, Yc - 1.2, GZ, g);
    const drops = []; for (let i = 0; i < 5; i++) { const b = h.ball(0.35, 0x9fd8f0, { hull: false }); at(b, 40 + i * 1.2, Yc + (rnd(i) - 0.3) * 1.6, GZ + (rnd(i + 4) - 0.5) * 2, g); b.visible = false; drops.push(b); }
    h.stand(g, 50, GZ - 11, 18, [{ y: Yc, to: v3(46, 0, GZ) }]);
    const ht = new T.Group(); at(ht, 31, 0, GZ, g); clickable(ht, 'heat'); h.spirit(ht, 0, TY, 0, d.heat); at(h.hitBox(9, 12, 9), 0, TY + 6, 0, ht);
    const sGas = h.stream(g, new T.CatmullRomCurve3([v3(ox, TY + 22.5, GZ), v3(ox, Hp, GZ), v3(-2, Hp, GZ), v3(-2, Hp + 5, GZ)]), 7, 0xffffff, 0.45);
    const sCu = h.stream(g, new T.CatmullRomCurve3([v3(-2, Hp, GZ), v3(16, Hp, GZ), v3(17.2, Yc, GZ), v3(46, Yc, GZ)]), 9, 0xffffff, 0.35);
    // спиртовка для пробы
    const LX = -50, LZ = 16;
    const pl = new T.Group(); at(pl, LX, 0, LZ, g); clickable(pl, 'z-lamp'); h.spirit(pl, 0, TY, 0, true); at(h.hitBox(10, 16, 10), 0, TY + 8, 0, pl);
    // штатив-подставка для пробирок
    const RX = 50, RZ = 26;
    const rk = new T.Group(); at(rk, RX, TY, RZ, g); clickable(rk, 'z-home');
    at(box(16, 1.2, 7, C.WOOD2), 0, 0.6, 0, rk); at(box(16, 1, 7, C.WOOD), 0, 9, 0, rk);
    [-7, 7].forEach(x => at(box(1.2, 8, 6, C.WOOD2), x, 4.8, 0, rk));
    [-4, 0, 4].forEach(x => at(cyl(1.9, 1.1, 0x5a3a22, { edges: false, hull: false }), x, 9.1, 0, rk));
    at(h.hitBox(16, 12, 8), 0, 6, 0, rk);
    // пробирка-приёмник
    const TR = 1.7, TH = 16;
    const tb = new T.Group(); g.add(tb); clickable(tb, 'flip');
    const tt = h.testTube(tb, 0, 0, 0, TR, TH);
    const gm = h.ownMat(0xeaf4ff, { transparent: true, opacity: 0, depthWrite: false });
    const gas = new T.Mesh(kit.keep(new T.CylinderGeometry(TR - 0.3, TR - 0.3, TH - 2, 20)), gm); at(gas, 0, TH / 2 + 1, 0, tt.g);
    at(h.hitBox(5, TH + 2, 5), 0, TH / 2, 0, tb);
    let tp;
    if (d.tube === 'out') { tp = d.up ? [-2, Hp + 5.4, GZ] : [-2, Hp + 2 + TH, GZ]; }
    else if (d.tube === 'lamp') { tp = d.up ? [LX + 1, TY + 17.2, LZ] : [LX + 1, TY + 17.2 + TH, LZ]; }
    else { tp = d.up ? [RX, TY + 1.6, RZ] : [RX, TY + 1.6 + TH, RZ]; }
    tb.position.set(...tp); if (!d.up) tb.rotation.x = Math.PI;
    if (d.tube === 'lamp') { tb.rotation.z = d.up ? -0.25 : 0.25; const hd = box(10, 1, 1.6, C.WOOD2); at(hd, 5, TH * 0.75, 0, tb); }
    if (d.tube === 'out') h.stand(g, -2, GZ - 11, 52, [{ y: Hp + 2 + TH * 0.7, to: v3(-2, 0, GZ) }]);
    else h.stand(g, -2, GZ - 11, 52, [{ y: Hp + 2 + TH * 0.7, to: v3(-2, 0, GZ - 4), clamp: false }]);
    // хлопок при пробе
    const popNew = mem.pops != null && d.pops > mem.pops; mem.pops = d.pops;
    if (popNew) mem.popT = nowS();
    const loud = d.last2 === 'лающий хлопок', quiet = d.last2 === 'глухой хлопок';
    const fl = h.glow(loud ? 0xffb050 : 0x9fc8ff, loud ? 40 : 16, 0); at(fl, LX + 1, TY + 18, LZ, g);
    const fLight = new T.PointLight(loud ? 0xffb050 : 0x9fc8ff, 0, 80, 1.2); at(fLight, LX + 1, TY + 20, LZ, g);
    const boom = (loud || quiet) ? h.pill(g, LX + 14, TY + 22, LZ + 4, loud ? 'ГАВ!' : 'пах…', '#1b1610', loud ? '#ffb547' : '#c9e6ff', loud ? 4.4 : 3) : null;
    if (boom) boom.visible = false;
    kit.onFrame((dt, t) => {
      const L = live() || {}, fH = L.fH ?? 0, cu = L.cu ?? 0, acid = L.acid ?? d.acid;
      gm.opacity = 0.05 + 0.4 * fH; gm.color.setHex(fH > 0.93 ? 0xd9f7e4 : 0xeaf4ff);
      bub.set(acid ? 1 : 0, 7.5, 0.5, 1.1);
      if (acid && !kit.reduce) { drop.visible = true; drop.position.y = TY + 26 - ((t * 1.6) % 1) * 15; } else drop.visible = false;
      sGas.set(acid ? 7 : 0); sCu.set(acid && d.clamp ? 9 : 0);
      cuM.color.copy(mixC(T, 0x1d1d1d, 0xc0603a, cu));
      drops.forEach((b, i) => { b.visible = cu > 0.15 + i * 0.15; });
      if (mem.popT && boom !== undefined) {
        const e = nowS() - mem.popT, k = e < 1.6 ? Math.max(0, 1 - e / (loud ? 0.5 : 0.35)) : 0;
        fl.material.opacity = k; fLight.intensity = k * (loud ? 160 : 40);
        if (boom) boom.visible = e < 2.2;
      }
      setH(`H₂ ${Math.round(fH * 100)} %`);
      setCu(cu >= 1 ? 'Cu + капли H₂O' : cu > 0.005 ? `CuO → Cu ${Math.round(cu * 100)} %` : d.heat && d.clamp ? 'ждём водород' : 'чёрный оксид');
    });
    tag(v3(GX - 4, TY + 42, GZ), 'Zn + HCl', d.acid ? 'кислота течёт' : 'кран закрыт', d.acid);
    const tTop = d.tube === 'out' ? v3(-2, Hp + TH + 6, GZ) : d.tube === 'lamp' ? v3(LX + 1, TY + 17 + TH + 2, LZ) : v3(RX, TY + 20, RZ);
    const setH = h.liveTag(tTop, d.up ? 'Пробирка ↑' : 'Пробирка ↓', 'H₂ 0 %');
    tag(v3(LX, TY + (d.tube === 'lamp' ? 8 : 20), LZ + 4), 'Проба', d.last2 || 'поднесите пробирку', quiet);
    const setCu = h.liveTag(v3(33, Yc + 8, GZ), 'CuO', '', d.cuDone);
  };

  // ===== Вода: электролизёр Гофмана, источник тока, стакан с лакмусом и вещества =====
  const RXI = { Na: 'Na', CaO: 'CaO', P2O5: 'P₂O₅', Cu: 'Cu' };
  SC['chlb-water'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const HX = -38, OX = -22, MX = -30, Z = -10, yb = TY + 9, yt = TY + 45, KM = (yt - yb - 2) / 40, R = 2.3;
    // подставка, штатив
    at(box(26, 2.4, 8, C.DARK), MX, TY + 1.2, Z, g);
    h.stand(g, MX, Z - 10, 48, [{ y: TY + 32, to: v3(HX, 0, Z) }, { y: TY + 32, to: v3(OX, 0, Z) }]);
    // трубки с газом и водой
    const WC = 0x7fc4e8;
    const parts = {};
    [['H', HX, 'tH', 0xffffff], ['O', OX, 'tO', 0xffd0c8]].forEach(([k, x, key, gc]) => {
      const tw = new T.Mesh(kit.keep(new T.CylinderGeometry(R, R, yt - yb, 28, 1, true)), h.glassMat(0xd8eef8, 0.26)); at(tw, x, (yt + yb) / 2, Z, g); tw.add(new T.Mesh(tw.geometry, kit.hullMat));
      at(cyl(R, 1, 0xd8eef8, { r2: 0.7, matOpt: { transparent: true, opacity: 0.4 } }), x, yt + 0.5, Z, g);
      at(cyl(0.55, 3, 0xcfe6f2, { edges: false }), x, yt + 2.5, Z, g);
      const vg = new T.Group(); at(vg, x, yt + 2.6, Z, g); clickable(vg, key);
      at(box(3.8, 1.2, 1.4, 0xffb547), 0, 0, 0, vg); at(cyl(0.9, 1.6, 0xffb547), 0, 0, 0, vg).rotation.x = Math.PI / 2;
      at(h.hitBox(7, 6, 6), 0, 0, 0, vg);
      for (let ml = 5; ml <= 40; ml += 5) { const m = box(ml % 10 ? 1.1 : 2, 0.16, 0.1, 0x3b4a66, { edges: false, shadow: false }); at(m, x, yt - 1 - ml * KM, Z + R + 0.05, g); }
      const w = h.liquid(g, x, yb, Z, R - 0.3, WC, 0.45);
      const gm = h.ownMat(gc, { transparent: true, opacity: 0.18, depthWrite: false });
      const gs = new T.Mesh(kit.keep(new T.CylinderGeometry(R - 0.3, R - 0.3, 1, 24)), gm); g.add(gs);
      // электрод и пробка снизу
      at(cyl(R + 0.4, 3, 0x2c3240), x, TY + 5.5 + 1, Z, g);
      at(box(1.4, 4, 0.3, 0xb8c0cc, { edges: false }), x, yb + 2.4, Z, g);
      const bb = h.bubbles(g, x, yb + 2, Z, 1.2, k === 'H' ? 12 : 7);
      parts[k] = { w, gs, bb, x };
    });
    // нижняя перемычка и средняя трубка с запасом воды
    const br = cyl(1.3, OX - HX, 0xd8eef8, { edges: false, matOpt: { transparent: true, opacity: 0.5 } }); br.rotation.z = Math.PI / 2; at(br, MX, yb + 1.4, Z, g);
    const mt = new T.Mesh(kit.keep(new T.CylinderGeometry(1, 1, TY + 47 - yb, 20, 1, true)), h.glassMat(0xd8eef8, 0.3)); at(mt, MX, (TY + 47 + yb) / 2, Z, g); mt.add(new T.Mesh(mt.geometry, kit.hullMat));
    const bulb = new T.Mesh(kit.keep(new T.SphereGeometry(4.6, 24, 16)), h.glassMat(0xd8eef8, 0.26)); at(bulb, MX, TY + 51, Z, g); bulb.add(new T.Mesh(bulb.geometry, kit.hullMat));
    const mw = h.liquid(g, MX, yb, Z, 0.7, WC, 0.5);
    const bw = new T.Mesh(kit.keep(new T.SphereGeometry(4.2, 20, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), h.ownMat(WC, { transparent: true, opacity: 0.45, depthWrite: false })); at(bw, MX, TY + 51, Z, g);
    // источник тока
    const SX = 2, SZ = 24;
    const sp = new T.Group(); at(sp, SX, TY, SZ, g); clickable(sp, 'cur');
    at(box(18, 8, 11, 0x3b4a66), 0, 4, 0, sp);
    const scr = h.screen(9, 3.6, fmt(d.I, 1) + ' А', d.on ? '#86e0a8' : '#56688f'); at(scr, -3, 4.6, 5.55, sp);
    at(box(4, 2, 1.2, d.on ? 0x3fae5a : 0xe0473a), 5, 4.6, 5.6, sp);
    at(cyl(1.1, 1.6, 0x1b1d22), -5, 8.8, -2.5, sp); at(cyl(1.1, 1.6, 0xd83a2e), 5, 8.8, -2.5, sp);
    at(h.sticker(3, 1.8, '−'), -5, 8.05, 0, sp).rotation.x = -Math.PI / 2; at(h.sticker(3, 1.8, '+'), 5, 8.05, 0, sp).rotation.x = -Math.PI / 2;
    at(h.hitBox(18, 10, 12), 0, 5, 0, sp);
    h.wire([v3(SX - 5, TY + 9.6, SZ - 2.5), v3(SX - 8, TY + 6, SZ - 10), v3(-24, TY + 1.2, 6), v3(HX, TY + 1.2, Z + 5), v3(HX, TY + 4.5, Z + 2.5)], 0x2a2c33, d.on ? 1 : 0);
    h.wire([v3(SX + 5, TY + 9.6, SZ - 2.5), v3(SX + 2, TY + 6, SZ - 12), v3(-14, TY + 1.2, 4), v3(OX, TY + 1.2, Z + 5), v3(OX, TY + 4.5, Z + 2.5)], 0xd83a2e, d.on ? 1 : 0);
    // проба газа лучинкой — вспышка у крана
    const testNew = mem.tests != null && d.tests > mem.tests; mem.tests = d.tests;
    if (testNew) { mem.testT = nowS(); mem.testK = d.lastTest; }
    const tk = mem.testK, tx = tk === 'o' ? OX : HX;
    const tfl = h.glow(tk === 'o' ? 0xfff2c0 : 0xffb050, 22, 0); at(tfl, tx, yt + 6, Z, g);
    const tpl = tk ? h.pill(g, tx, yt + 9, Z, tk === 'o' ? 'вспыхнула!' : 'хлопок!', '#1b1610', '#ffd166', 2.6) : null;
    if (tpl) tpl.visible = false;
    if (tk) { const lu = new T.Group(); at(lu, tx + 1.5, yt + 5, Z + 1, g); const s = box(0.6, 12, 0.6, 0xd9b07a); s.rotation.z = -0.9; at(s, 4.5, 3, 0, lu); lu.visible = false; tfl.userData.lu = lu; }
    // стакан с водой и лакмусом
    const CX = 24, CZ = -8, CR = 9, CH = 18, CL = 12;
    const cup = new T.Group(); at(cup, CX, TY, CZ, g); clickable(cup, 'fresh');
    h.beaker(cup, 0, 0, 0, CR, CH);
    const lq = h.liquid(cup, 0, 0.6, 0, CR - 0.4, 0x8a5cc7, 0.55); lq.set(CL - 0.6, 0.6);
    const it = d.cupIt, eff = new T.Group(); cup.add(eff);
    let na = null, cao = [], pp = [], cuP = [], steam = null, nb = null;
    if (it === 'Na') { na = h.ball(1.3, 0xcfd6e2); at(na, 0, CL + 0.4, 0, eff); nb = h.puffs(eff, 0, CL + 1, 0, { n: 5, spread: 2, rise: 5, size: 2, op: 0.5, amt: 0 }); }
    if (it === 'CaO') { for (let i = 0; i < 5; i++) { const m = mesh(new T.DodecahedronGeometry(1.3), 0xf2efe6, { hull: true, edges: false }); at(m, (rnd(i) - 0.5) * 8, 1.6, (rnd(i + 5) - 0.5) * 8, eff); cao.push(m); } steam = h.puffs(eff, 0, CH, 0, { n: 6, spread: 8, rise: 12, size: 5, op: 0.5, amt: 0 }); }
    if (it === 'P2O5') for (let i = 0; i < 24; i++) { const m = box(0.6, 0.6, 0.6, 0xf5f7fb, { edges: false }); at(m, (rnd(i) - 0.5) * 12, CL, (rnd(i + 2) - 0.5) * 12, eff); pp.push({ m, k: rnd(i + 9) }); }
    if (it === 'Cu') for (let i = 0; i < 3; i++) { const m = box(2.4, 0.6, 1.6, 0xc0652a); m.rotation.y = rnd(i) * 3; at(m, (i - 1) * 3, 1.0, (rnd(i + 4) - 0.5) * 3, eff); cuP.push(m); }
    const fizz = h.bubbles(cup, 0, 1, 0, 5, 10);
    // вещества на блюдцах
    const DX = { Na: 12, CaO: 25, P2O5: 38, Cu: 51 }, DZ = 26;
    Object.entries(DX).forEach(([k, x]) => {
      const ig = new T.Group(); at(ig, x, 0, DZ, g); clickable(ig, 'cup-' + k);
      h.dish(ig, 0, 0, 5);
      if (k === 'Na') { at(box(2.2, 1.6, 2.2, 0xcfd6e2), 0, TY + 1.2, 0, ig); at(box(1.6, 1.2, 1.4, 0xb9c1cf), 1.8, TY + 1, 1, ig); }
      if (k === 'CaO') for (let i = 0; i < 4; i++) at(mesh(new T.DodecahedronGeometry(1.1), 0xf2efe6, { hull: true, edges: false }), (rnd(i + 30) - 0.5) * 4, TY + 1.4, (rnd(i + 31) - 0.5) * 4, ig);
      if (k === 'P2O5') at(cyl(2.6, 1.4, 0xfbfcfe, { r2: 0.6, edges: false }), 0, TY + 1.1, 0, ig);
      if (k === 'Cu') for (let i = 0; i < 3; i++) { const m = box(2.2, 0.5, 1.4, 0xc0652a); m.rotation.y = i; at(m, (i - 1) * 1.6, TY + 0.9 + i * 0.2, (rnd(i) - 0.5) * 2, ig); }
      at(h.hitBox(10, 6, 10), 0, TY + 3, 0, ig);
      if (d.f[k]) h.ringT(g, x, DZ, 5.8);
      h.floorLabel(g, x, DZ + 6.4, 6.4, 2.4, RXI[k], '#1b1610', d.cupIt === k ? '#ffd166' : d.f[k] ? '#c9f0d4' : '#fffaf0');
    });
    // стакан со льдом: лёд плавает
    const ice = new T.Group(); at(ice, 50, TY, -26, g);
    h.beaker(ice, 0, 0, 0, 4.5, 11, { marks: false });
    const iw = h.liquid(ice, 0, 0.6, 0, 4.1, WC, 0.45); iw.set(7.4, 0.6);
    const ic = box(4.2, 3.2, 4.2, 0xe6f6ff, { matOpt: { transparent: true, opacity: 0.85 } }); ic.rotation.y = 0.4; at(ic, 0, 0.6 + 7.4 - 1.2, 0, ice);
    h.floorLabel(g, 50, -19, 9, 2.4, 'лёд плавает', '#1b1610', '#fffaf0');
    kit.onFrame((dt, t) => {
      const L = live() || {}, vH = L.vH ?? 0, vO = vH / 2, on = L.on ?? d.on;
      [['H', vH], ['O', vO]].forEach(([k, v]) => {
        const p = parts[k], gy = yt - 0.4 - v * KM;
        p.w.set(Math.max(0.1, gy - yb), yb);
        p.gs.visible = v > 0.05; p.gs.scale.y = Math.max(0.05, yt - 0.4 - gy); p.gs.position.set(p.x, (gy + yt - 0.4) / 2, Z);
        p.bb.set(on ? 1 : 0, gy - yb - 2, 0.35, 1.2);
      });
      const rl = TY + 47 + Math.min(8, vH * 0.3);
      mw.set(Math.min(TY + 47, rl) - yb, yb); bw.visible = rl > TY + 47.2; bw.scale.y = clamp((rl - TY - 47) / 4.2, 0.05, 1); bw.position.y = TY + 51 - 4.2 * (1 - bw.scale.y);
      setH(`${fmt(vH, 1)} мл`); setO(`${fmt(vO, 1)} мл`);
      if (mem.testT) { const e = nowS() - mem.testT; tfl.material.opacity = e < 1.5 ? Math.max(0, 1 - e / 1.2) : 0; if (tpl) tpl.visible = e < 2; if (tfl.userData.lu) tfl.userData.lu.visible = e < 2; }
      // стакан
      const el = (L.cupEl ?? 1e5) / 1000, k = it ? clamp(el / 1.5, 0, 1) : 0;
      lq.mat.color.copy(mixC(T, 0x8a5cc7, d.cupCol ?? 0x8a5cc7, k));
      if (na) { const a = kit.reduce ? 0.6 : el * 2.6, live1 = el < 5; na.visible = live1; na.scale.setScalar(Math.max(0.2, 1 - el / 5.5)); na.position.set(Math.cos(a) * 5, CL + 0.4, Math.sin(a * 1.3) * 4); nb.g.position.copy(na.position); nb.set(live1 ? 1 : 0); fizz.set(0, 0); }
      if (cao.length) { cao.forEach(m => m.scale.setScalar(Math.max(0.35, 1 - k * 0.6))); steam.set(el < 6 ? 1 - el / 6 : 0); fizz.set(el < 4 ? 0.6 : 0, CL - 1, 0.45, 1.2); }
      if (pp.length) { pp.forEach(p => { const f = clamp((el - p.k * 0.8) / 3, 0, 1); p.m.visible = f < 1; p.m.position.y = CL - f * 8; p.m.scale.setScalar(1 - f * 0.9); }); fizz.set(el < 3 ? 0.5 : 0, CL - 1, 0.4, 1.2); }
      if (!na && !cao.length && !pp.length) fizz.set(0, 0);
    });
    const setH = h.liveTag(v3(HX - 5, yt - 12, Z + 3), 'H₂ · катод −', '', !!(d.f.h && d.f.full));
    const setO = h.liveTag(v3(OX + 6, yt - 20, Z + 3), 'O₂ · анод +', '', !!d.f.o);
    tag(v3(SX, TY + 13, SZ), 'Источник тока', d.on ? 'включён' : 'выключен', d.on);
    tag(v3(CX, TY + CH + 4, CZ), 'Вода + лакмус', it ? d.prod : 'фиолетовый', !!it && it !== 'Cu');
  };

  // ===== Состав воздуха: колокол над водой с фосфором и модель из 100 молекул =====
  const G4 = { N2: { c: 0x4d7cf0, n: 'N₂' }, O2: { c: 0xe5533f, n: 'O₂' }, Ar: { c: 0xb88cf0, n: 'Ar' }, CO2: { c: 0x9aa6bd, n: 'CO₂' } };
  const AIM4 = { N2: 78, O2: 21, Ar: 1, CO2: 0 };
  SC['chlb-air'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const BX = -32, BZ = -6, WL = TY + 8.5, BR = 9.5, BB = TY + 2, BT = TY + 32, PART = (BT - WL) / 5;
    // стеклянная ванна с водой
    const tw = new T.Mesh(kit.keep(new T.BoxGeometry(42, 12, 30)), h.glassMat(0xd8eef8, 0.16)); at(tw, BX, TY + 6, BZ, g);
    [[0, -15, 42, 0.5], [0, 15, 42, 0.5], [-21, 0, 0.5, 30], [21, 0, 0.5, 30]].forEach(([x, z, w, dd]) => at(box(w, 0.6, dd, 0xa9c4d8, { edges: false, shadow: false }), BX + x, TY + 12, BZ + z, g));
    [[-21, -15], [21, -15], [-21, 15], [21, 15]].forEach(([x, z]) => at(box(0.5, 12, 0.5, 0xa9c4d8, { edges: false, shadow: false }), BX + x, TY + 6, BZ + z, g));
    at(box(41, 8.4 - 1.2, 29, 0x7fc4e8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.38, depthWrite: false } }), BX, TY + 0.6 + (WL - TY - 0.6) / 2, BZ, g);
    // колокол
    const bell = new T.Group(); at(bell, BX, 0, BZ, g); clickable(bell, 'ign');
    const bw = new T.Mesh(kit.keep(new T.CylinderGeometry(BR, BR, BT - BB, 36, 1, true)), h.glassMat(0xd8eef8, 0.2)); at(bw, 0, (BT + BB) / 2, 0, bell);
    [-1, 1].forEach(sx => at(box(0.2, BT - BB, 0.2, 0xa9c4d8, { edges: false, hull: false, shadow: false }), sx * BR, (BT + BB) / 2, 0, bell));
    const dome = new T.Mesh(kit.keep(new T.SphereGeometry(BR, 36, 12, 0, Math.PI * 2, 0, Math.PI / 2)), h.glassMat(0xd8eef8, 0.22)); dome.scale.y = 0.45; at(dome, 0, BT, 0, bell);
    at(cyl(2.4, 3, 0xd8eef8, { matOpt: { transparent: true, opacity: 0.4 } }), 0, BT + BR * 0.45 + 1, 0, bell);
    at(cyl(2.6, 2.6, 0x7a5a44, { r2: 3 }), 0, BT + BR * 0.45 + 3.4, 0, bell);
    for (let k = 0; k <= 4; k++) { const m = new T.Mesh(kit.keep(new T.TorusGeometry(BR + 0.12, 0.16, 6, 40)), kit.keep(new T.MeshBasicMaterial({ color: 0xffb547 }))); m.rotation.x = Math.PI / 2; at(m, 0, WL + k * PART, 0, bell); }
    at(h.hitBox(BR * 2, BT - BB + 8, BR * 2), 0, (BT + BB) / 2 + 4, 0, bell);
    // фосфор в фарфоровой чашечке на подставке
    const PY = WL + 7;
    at(cyl(0.35, PY - TY - 1, C.STEEL, { edges: false }), 0, (PY + TY) / 2, 0, bell);
    const cupG = new T.Group(); at(cupG, 0, PY - TY - 0.1, 0, bell); h.dish(cupG, 0, 0, 2.4);
    if (d.bp === 0) at(cyl(1.2, 0.8, 0xc2453a, { r2: 0.4, edges: false }), 0, TY + 0.6, 0, cupG);
    else at(cyl(1.4, 0.4, 0xe6e1d4, { edges: false }), 0, TY + 0.4, 0, cupG);
    const inW = h.liquid(g, BX, BB, BZ, BR - 0.3, 0x7fc4e8, 0.4);
    const fl = d.bp === 1 ? h.flame(g, BX, PY + 1.2, BZ, 6, '#ffffff', '#fff3c4', 0xfff4dc, 0.7) : null;
    const lt = d.bp === 1 ? new T.PointLight(0xfff4dc, 50, 60, 1.2) : null; if (lt) at(lt, BX, PY + 4, BZ, g);
    const smk = new T.Mesh(kit.keep(new T.CylinderGeometry(BR - 0.5, BR - 0.5, 1, 32)), h.ownMat(0xf5f7fb, { transparent: true, opacity: 0, depthWrite: false })); g.add(smk);
    const pf = h.puffs(g, BX, PY + 2, BZ, { n: 7, spread: 9, rise: BT - PY - 2, size: 5, op: 0.5, color: 0xf5f7fb, amt: 0 });
    kit.onFrame(() => {
      const L = live() || {}, bp = L.bp ?? d.bp, bt = (L.bt ?? 0) / 1000, rise = L.rise ?? (d.bp === 3 ? 1 : 0);
      const iw = WL + rise * PART; inW.set(iw - BB, BB);
      let sm = 0; if (bp === 1) sm = Math.min(1, bt / 1.5) * 0.55; else if (bp === 2) sm = 0.55 * Math.max(0, 1 - bt / 2.5);
      smk.material.opacity = sm; smk.scale.y = BT + BR * 0.3 - iw; smk.position.set(BX, (BT + BR * 0.3 + iw) / 2, BZ);
      pf.set(bp === 1 ? 1 : bp === 2 ? sm : 0);
      setB(bp === 0 ? 'фосфор не горит' : bp === 1 ? 'горит, белый дым P₂O₅' : bp === 2 ? 'остывает, вода поднимается' : d.ans ? 'вода поднялась на 1 из 5 частей' : 'на сколько частей поднялась вода?');
    });
    // клавиши опыта
    if (d.bp === 0) h.key(g, BX, 28, 30, 6, 'Поджечь фосфор', 0xe08a00, 'ign');
    if (d.bp === 3) {
      ['1/2', '1/5', '1/10', '4/5'].forEach((v, i) => {
        const ok = d.ans && v === '1/5', bad = d.pick === v && v !== '1/5';
        h.key(g, BX - 18 + i * 12, 27, 10.4, 6, v, ok ? 0x2f9e55 : bad ? 0xe0473a : 0x3b4a66, 'ans-' + v);
      });
      h.key(g, BX, 38, 22, 5, 'Повторить', 0x56688f, 'again');
    }
    const setB = h.liveTag(v3(BX, TY + 13, BZ + 17), 'Колокол', '', d.ans);
    // модель: коробка со 100 молекулами
    const MX = 32, MZ = -16;
    at(box(42, 1.2, 26, 0xe8edf3), MX, TY + 0.6, MZ, g);
    [[0, -13], [0, 13]].forEach(([x, z]) => at(box(42, 2.4, 0.8, 0x56688f), MX + x, TY + 1.2, MZ + z, g));
    [[-21, 0], [21, 0]].forEach(([x, z]) => at(box(0.8, 2.4, 26, 0x56688f), MX + x, TY + 1.2, MZ + z, g));
    const sph = kit.keep(new T.SphereGeometry(1, 12, 8));
    const cell = k => { const c = (k * 37) % 100; return [MX - 18 + (c % 10) * 4, MZ - 10.8 + Math.floor(c / 10) * 2.4]; };
    let k = 0;
    const atom = (x, z, r, col) => { const m = new T.Mesh(sph, kit.toon(col)); m.scale.setScalar(r); m.castShadow = true; at(m, x, TY + 1.2 + r, z, g); };
    ['N2', 'O2', 'Ar', 'CO2'].forEach(gs => {
      for (let i = 0; i < d.cnt[gs] && k < 100; i++, k++) {
        const [x, z] = cell(k), c = G4[gs].c;
        if (gs === 'Ar') atom(x, z, 0.9, c);
        else if (gs === 'CO2') { atom(x - 1.1, z, 0.55, 0xe5533f); atom(x + 1.1, z, 0.55, 0xe5533f); atom(x, z, 0.65, 0x4f586d); }
        else { atom(x - 0.6, z, 0.7, c); atom(x + 0.6, z, 0.7, c); }
      }
    });
    for (; k < 100; k++) { const [x, z] = cell(k); at(cyl(0.6, 0.15, 0xc4ccd8, { edges: false, hull: false, shadow: false }), x, TY + 1.3, z, g); }
    // клавиши газов
    ['N2', 'O2', 'Ar', 'CO2'].forEach((gs, i) => {
      const x = 13 + i * 13, ok = d.cnt[gs] === AIM4[gs] && d.match;
      const pl = new T.Group(); at(pl, x, TY, 9, g);
      at(box(11.4, 1.4, 6, G4[gs].c), 0, 0.7, 0, pl);
      const st = h.sticker(10.6, 5.2, G4[gs].n + '\n' + d.cnt[gs], '#1b1610', ok ? '#c9f0d4' : d.sel === gs ? '#ffd166' : '#fffaf0'); st.rotation.x = -Math.PI / 2; at(st, 0, 1.42, 0, pl);
      [[-1, -2.9, 17], [1, 2.9, 17], [-10, -2.9, 23.5], [10, 2.9, 23.5]].forEach(([dv, dx, z]) => h.key(g, x + dx, z, 5.4, 5, (dv > 0 ? '+' : '−') + Math.abs(dv), dv > 0 ? 0x2f9e55 : 0xc0453a, `st:${gs}:${dv}`));
    });
    const sum = d.cnt.N2 + d.cnt.O2 + d.cnt.Ar + d.cnt.CO2;
    tag(v3(MX, TY + 6, MZ - 12), 'Модель воздуха', d.model ? '✓ 78 N₂ · 21 O₂ · 1 Ar' : `всего ${sum} из 100`, d.model);
  };

  // =====================================================================================
  // ===== Чистое вещество или смесь: 8 образцов, два лотка, лупа с частицами =====
  const LCG = seed => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  // частицы под лупой (как в схеме опыта), холст 256×256 = поле 100×100
  function drawLupa(x, view) {
    const S = 2.56, r = LCG(view.length * 977 + view.charCodeAt(0) * 31 + 5);
    const C0 = (cx, cy, rr, col, st) => { x.beginPath(); x.arc(cx * S, cy * S, rr * S, 0, 7); x.fillStyle = col; x.fill(); if (st) { x.strokeStyle = st; x.lineWidth = 2; x.stroke(); } };
    const W = (cx, cy, a) => { C0(cx + 4.6 * Math.cos(a + 0.91), cy + 4.6 * Math.sin(a + 0.91), 2.1, '#f2f4f8'); C0(cx + 4.6 * Math.cos(a - 0.91), cy + 4.6 * Math.sin(a - 0.91), 2.1, '#f2f4f8'); C0(cx, cy, 3.5, '#e5534b'); };
    const pair = (cx, cy, a, c, rr) => { const dx = Math.cos(a) * rr * 0.8, dy = Math.sin(a) * rr * 0.8; C0(cx - dx, cy - dy, rr, c); C0(cx + dx, cy + dy, rr, c); };
    const grid = (st, jit, fn) => { let i = 0; for (let y = st / 2; y < 100; y += st) for (let xx = st / 2; xx < 100; xx += st) fn(xx + (r() - .5) * st * jit, y + (r() - .5) * st * jit, i++); };
    x.fillStyle = '#0b1019'; x.fillRect(0, 0, 256, 256);
    if (view === 'water') grid(13, .35, (a, b) => W(a, b, r() * 6.28));
    if (view === 'tap') grid(13, .35, (a, b, i) => i % 9 === 4 ? C0(a, b, 3.4, '#7ddc8a') : i % 9 === 7 ? C0(a, b, 2.6, '#a78bfa') : W(a, b, r() * 6.28));
    if (view === 'milk') { grid(13, .35, (a, b) => W(a, b, r() * 6.28)); for (const [a, b, rr] of [[30, 34, 11], [68, 58, 13], [38, 74, 8]]) C0(a, b, rr, '#f5dc8a', '#c9a94a'); }
    if (view === 'air') grid(24, .5, (a, b, i) => i === 6 ? C0(a, b, 3.4, '#c7ccd6') : i % 4 === 1 ? pair(a, b, r() * 6.28, '#e5534b', 3) : pair(a, b, r() * 6.28, '#6fa8ff', 3));
    if (view === 'salt') { let j = 0; for (let y = 6; y < 100; y += 11, j++) for (let a = 6, i = 0; a < 100; a += 11, i++) (i + j) % 2 ? C0(a, y, 2.6, '#a78bfa') : C0(a, y, 4, '#7ddc8a'); }
    if (view === 'copper') { let j = 0; for (let y = 5; y < 104; y += 9.5, j++) for (let a = j % 2 ? 10.5 : 5; a < 104; a += 11) C0(a, y, 5, '#e08a4f', '#a85a2a'); }
    if (view === 'sugar') grid(21, .3, (a, b) => { const q = r() * 6.28; for (let k = 0; k < 6; k++) C0(a + 5.5 * Math.cos(q + k * 1.047), b + 5.5 * Math.sin(q + k * 1.047), 2.2, k % 3 ? '#f2c46d' : '#e5534b'); });
    if (view === 'granite') { const seeds = [[20, 25, 0], [70, 18, 1], [55, 60, 2], [18, 78, 1], [85, 80, 0], [40, 45, 0]], col = ['#d9dde6', '#e7a99a', '#3d3a45'];
      let j = 0; for (let y = 4; y < 100; y += 8.5, j++) for (let a = j % 2 ? 8 : 4; a < 100; a += 8.5) { let bi = 0, bd = 1e9; seeds.forEach((s, k) => { const dd = (s[0] - a) ** 2 + (s[1] - y) ** 2; if (dd < bd) { bd = dd; bi = k; } }); C0(a, y, 3.7, col[seeds[bi][2]]); } }
  }
  function sample(kit, h, id, parent) {
    const { T, at, box, cyl, mesh } = kit;
    if (id === 'dist' || id === 'tap' || id === 'milk') {
      h.beaker(parent, 0, 0, 0, 3.4, 9, { marks: false });
      const l = h.liquid(parent, 0, 0.6, 0, 3.0, id === 'milk' ? 0xf7f3ea : id === 'tap' ? 0x9fd0e2 : 0x8fcbe8, id === 'milk' ? 0.95 : 0.4); l.set(6.2, 0.6);
      if (id === 'tap') for (let i = 0; i < 6; i++) at(box(0.3, 0.3, 0.3, i % 2 ? 0x7ddc8a : 0xa78bfa, { edges: false, hull: false }), (rnd(i) - 0.5) * 4, 1.5 + rnd(i + 2) * 4.5, (rnd(i + 3) - 0.5) * 4, parent);
    } else if (id === 'air') {
      h.rflask(parent, 0, 0, 0, 3.6, 3.4); at(cyl(1.15, 1.6, 0x7a3a2a, { r2: 1.3 }), 0, 3.6 * 1.9 + 3.6, 0, parent);
    } else if (id === 'salt' || id === 'sugar') {
      h.beaker(parent, 0, 0, 0, 3.4, 7, { marks: false });
      if (id === 'salt') { at(cyl(3.0, 3, 0xf7f9fc, { r2: 1.4, edges: false }), 0, 2.1, 0, parent); for (let i = 0; i < 5; i++) { const c = box(0.8, 0.8, 0.8, 0xffffff, { edges: false }); c.rotation.set(rnd(i) * 3, rnd(i + 1) * 3, 0); at(c, (rnd(i + 4) - 0.5) * 2.4, 3.6 + rnd(i + 6), (rnd(i + 5) - 0.5) * 2.4, parent); } }
      else for (let i = 0; i < 6; i++) { const c = box(1.7, 1.7, 1.7, 0xfbf7ee); c.rotation.y = rnd(i) * 2; at(c, ((i % 3) - 1) * 1.9, 1.5 + Math.floor(i / 3) * 1.8, (rnd(i + 2) - 0.5) * 1.2, parent); }
    } else if (id === 'copper') {
      const pts = []; for (let i = 0; i <= 120; i++) { const a = i / 120 * Math.PI * 8; pts.push(new T.Vector3(Math.cos(a) * 2.6, 0.7 + i / 120 * 4.2, Math.sin(a) * 2.6)); }
      at(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 240, 0.42, 8), 0xd9824a, { hull: true, edges: false }), 0, 0, 0, parent);
    } else if (id === 'granite') {
      const rk = mesh(new T.DodecahedronGeometry(3.4, 0), 0xb9a59a, { hull: true, edges: true }); rk.scale.set(1.1, 0.75, 0.95); rk.rotation.set(0.3, 0.5, 0.1); at(rk, 0, 2.6, 0, parent);
      for (let i = 0; i < 16; i++) { const a = rnd(i + 70) * 6.28, b = rnd(i + 71) * 1.2; const s = box(0.8, 0.8, 0.8, [0x3d3a45, 0xe7a99a, 0xeef1f5][i % 3], { edges: false, hull: false }); at(s, Math.cos(a) * 3.1 * Math.cos(b - 0.5), 2.6 + Math.sin(b - 0.3) * 2.2, Math.sin(a) * 2.9 * Math.cos(b - 0.5), parent); }
    }
  }
  SC['chlb-pure'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    // лотки
    const BIN = { P: { x: -30, col: 0x72d4e8, base: 0xe3f5fa, label: 'Чистое вещество' }, M: { x: 30, col: 0xffb547, base: 0xfdeed8, label: 'Смесь' } };
    Object.entries(BIN).forEach(([k, b]) => {
      const bg = new T.Group(); at(bg, b.x, TY, 26, g); clickable(bg, 'to' + k);
      at(box(54, 0.8, 18, b.base, { edges: false }), 0, 0.4, 0, bg);
      at(box(54, 2, 0.9, b.col), 0, 1, -8.6, bg); at(box(54, 2, 0.9, b.col), 0, 1, 8.6, bg);
      at(box(0.9, 2, 18, b.col), -26.6, 1, 0, bg); at(box(0.9, 2, 18, b.col), 26.6, 1, 0, bg);
      at(h.hitBox(54, 4, 18), 0, 2, 0, bg);
      h.floorLabel(g, b.x, 38.5, 30, 3.6, b.label, '#1b1610', '#' + b.col.toString(16));
    });
    // образцы
    d.items.forEach((it, i) => {
      const sg = new T.Group(); clickable(sg, 'it-' + i);
      let x, z;
      if (it.bin) { x = BIN[it.bin].x - 18 + it.slot * 12; z = 26; } else { x = -49 + i * 14; z = -10; }
      at(sg, x, TY + (it.bin ? 0.8 : 0), z, g);
      sample(kit, h, it.id, sg);
      at(h.hitBox(9, 12, 9), 0, 6, 0, sg);
      if (!it.bin) h.floorLabel(g, x, z + 6.2, 11, 2.4, it.short, '#1b1610', d.sel === i ? '#ffd166' : '#fffaf0');
      if (d.sel === i) {
        h.ring(g, x, z, 5.4);
        if (!kit.reduce) kit.onFrame((dt, t) => { sg.position.y = TY + (it.bin ? 0.8 : 0) + 0.8 + 0.6 * Math.sin(t * 4); });
        else sg.position.y += 1;
      }
    });
    // лупа на подставке
    const LX = 0, LZ = -30, LY = TY + 21, LR = 10;
    at(cyl(5, 1.2, C.DARK), LX, TY + 0.6, LZ, g);
    at(cyl(0.7, LY - LR - TY - 1, C.STEEL, { edges: false }), LX, (LY - LR + TY + 1) / 2, LZ, g);
    const fr = mesh(new T.TorusGeometry(LR + 0.6, 0.9, 10, 48), 0x2c3240, { hull: true, edges: false }); at(fr, LX, LY, LZ, g);
    const k = h.canvasTex(256, 256);
    if (d.view) drawLupa(k.x, d.view); else { k.x.fillStyle = '#0b1019'; k.x.fillRect(0, 0, 256, 256); h.drawLines(k.x, 256, 256, ['', 'нажмите', 'на образец', ''], '#8b96ad'); }
    k.tex.needsUpdate = true;
    const lens = new T.Mesh(kit.keep(new T.CircleGeometry(LR, 48)), kit.keep(new T.MeshBasicMaterial({ map: k.tex }))); at(lens, LX, LY, LZ + 0.1, g);
    at(new T.Mesh(kit.keep(new T.CircleGeometry(LR, 48)), kit.keep(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08 }))), LX, LY, LZ + 0.3, g);
    const sh = new T.Mesh(kit.keep(new T.RingGeometry(LR * 0.55, LR * 0.75, 24, 1, 2.2, 0.7)), kit.keep(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 }))); at(sh, LX, LY, LZ + 0.35, g);
    tag(v3(LX, LY + LR + 3, LZ), 'Лупа', d.selName || 'какие частицы?');
    const nP = d.items.filter(x => x.bin === 'P').length, nM = d.items.filter(x => x.bin === 'M').length;
    tag(v3(-30, TY + 12, 26), 'Чистое вещество', `${nP} из 4`, nP === 4);
    tag(v3(30, TY + 12, 26), 'Смесь', `${nM} из 4`, nM === 4);
  };

  // ===== Физические и химические явления: шесть опытов, журнал наблюдений, клавиши ответа =====
  function wrapText(s, max) { const out = []; let line = ''; for (const w of s.split(' ')) { if ((line + ' ' + w).trim().length > max && line) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); } if (line) out.push(line); return out; }
  SC['chlb-phen'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const AX = -10, AZ = -6;
    const ap = new T.Group(); at(ap, AX, 0, AZ, g); clickable(ap, 'app');
    at(h.hitBox(30, 30, 26), 0, 15, 0, ap);
    const upd = [];
    const L0 = () => (live() || {}).p ?? (d.fin ? 1 : 0);
    if (d.ph === 'ice') {
      h.dish(ap, 0, 0, 11);
      const pud = cyl(1, 0.3, 0x8fcbe8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.55 } }); at(pud, 0, TY + 0.7, 0, ap);
      const cube = box(9, 8, 9, 0xdff3ff, { matOpt: { transparent: true, opacity: 0.85 } }); cube.rotation.y = 0.35; at(cube, 0, 0, 0, ap);
      const drips = []; for (let i = 0; i < 3; i++) { const b = h.ball(0.35, 0xbfe6ff, { hull: false }); ap.add(b); drips.push(b); }
      const th = new T.Group(); at(th, 16, TY, 6, ap); at(box(3, 14, 1, 0xfffaf0), 0, 7, 0, th); at(cyl(0.5, 10, 0xe0473a, { edges: false }), 0, 7, 0.6, th); at(h.ball(0.9, 0xe0473a), 0, 1.8, 0.6, th);
      upd.push((p, t) => {
        const s = Math.pow(1 - p, 0.6); cube.visible = s > 0.04; cube.scale.setScalar(Math.max(0.04, s)); cube.position.y = TY + 1.4 + 4 * s;
        pud.scale.set(2 + 8 * p, 1, 2 + 8 * p);
        drips.forEach((b, i) => { b.visible = p > 0.05 && p < 1 && !kit.reduce; const ph = (t * 1.3 + i / 3) % 1; b.position.set((i - 1) * 4 * s, TY + 1.4 + 8 * s * (1 - ph), 4.6 * s); });
      });
      h.floorLabel(g, AX + 16, AZ + 11, 10, 2.4, 'в комнате +22 °C', '#1b1610', '#fffaf0');
    }
    if (d.ph === 'soda' || d.ph === 'sugar') {
      const soda = d.ph === 'soda';
      h.beaker(ap, 0, TY, 0, 7.5, 17);
      const lv = soda ? 7 : 10;
      const lq = h.liquid(ap, 0, TY + 0.6, 0, 7.1, soda ? 0xeef3f6 : 0x8fcbe8, soda ? 0.4 : 0.42); lq.set(lv, TY + 0.6);
      h.floorLabel(g, AX, AZ + 10.5, 11, 2.4, soda ? 'уксус' : 'вода', '#1b1610', '#fffaf0');
      if (soda) {
        const foam = cyl(7.0, 1, 0xf6f8fb, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.9 } }); at(foam, 0, 0, 0, ap);
        const bb = h.bubbles(ap, 0, TY + 0.8, 0, 5.5, 16);
        const sp = new T.Group(); at(sp, 6, TY + 22, 0, ap);
        const rod = box(14, 0.6, 1, C.STEEL); at(rod, 7, 0, 0, sp);
        const bowl = mesh(new T.SphereGeometry(2, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0xc8d1e2, { hull: true, edges: false }); at(bowl, -1, 0.6, 0, sp);
        const pw = cyl(1.8, 0.8, 0xffffff, { r2: 0.6, edges: false }); at(pw, -1, 0.9, 0, sp);
        upd.push((p, t) => {
          const s = clamp(p / 0.12, 0, 1); sp.rotation.z = -1.1 * s; sp.visible = p < 0.3; pw.visible = s < 0.8;
          const k = clamp((p - 0.12) / 0.88, 0, 1), f = Math.sin(Math.min(1, k * 1.4) * Math.PI / 2) * (1 - Math.max(0, k - 0.75) * 2.2), fh = 8 * Math.max(0, f);
          foam.visible = fh > 0.1; foam.scale.y = Math.max(0.05, fh); foam.position.y = TY + 0.6 + lv + fh / 2;
          bb.set(k > 0 && k < 1 ? 1 : 0, lv, 0.45, 1.3);
        });
      } else {
        const cube = box(3.2, 3.2, 3.2, 0xfbf7ee); ap.add(cube);
        const dots = []; for (let i = 0; i < 36; i++) { const b = box(0.35, 0.35, 0.35, 0xffcf7a, { edges: false, hull: false, shadow: false }); ap.add(b); dots.push({ b, a: rnd(i) * 6.28, r: Math.sqrt(rnd(i + 1)) * 6.4, y: rnd(i + 2) }); }
        upd.push(p => {
          const fall = clamp(p / 0.18, 0, 1), dis = clamp((p - 0.18) / 0.82, 0, 1), s = 1 - dis;
          cube.visible = s > 0.05; cube.scale.setScalar(Math.max(0.05, s)); cube.rotation.y = fall * 1.2;
          cube.position.y = fall < 1 ? TY + 26 - (26 - 2.2) * fall * fall : TY + 0.6 + 1.6 * s;
          dots.forEach(q => { q.b.visible = dis > 0; const r = q.r * dis; q.b.position.set(Math.cos(q.a) * r, TY + 1 + q.y * (lv - 1) * dis, Math.sin(q.a) * r); });
        });
      }
    }
    if (d.ph === 'bend') {
      at(box(40, 1.6, 10, C.WOOD2), 0, TY + 0.8, 0, ap);
      const segs = [], N = 12; for (let i = 0; i < N; i++) { const m = cyl(0.55, 1, 0xd9824a, { edges: false }); ap.add(m); segs.push(m); }
      const joints = []; for (let i = 0; i <= N; i++) { const b = h.ball(0.55, 0xd9824a, { hull: false }); ap.add(b); joints.push(b); }
      upd.push(p => {
        const pts = []; for (let k = 0; k <= N; k++) { const a = Math.PI * k / N; pts.push(v3(-16 + k * 32 / N + (-14 * Math.cos(a) - (-16 + k * 32 / N)) * p, TY + 2.2 + 14 * Math.sin(a) * p, 0)); }
        joints.forEach((b, i) => b.position.copy(pts[i]));
        segs.forEach((m, i) => { const a = pts[i], b = pts[i + 1], dv = b.clone().sub(a), L = dv.length(); m.scale.y = Math.max(0.01, L); m.quaternion.setFromUnitVectors(v3(0, 1, 0), dv.normalize()); m.position.copy(a.clone().add(b).multiplyScalar(0.5)); });
      });
    }
    if (d.ph === 'rust') {
      h.beaker(ap, 0, TY, 0, 7.5, 17, { marks: false });
      const lq = h.liquid(ap, 0, TY + 0.6, 0, 7.1, 0x8fcbe8, 0.42); lq.set(9, TY + 0.6);
      const nail = new T.Group(); at(nail, 0, TY + 9, 0, ap); nail.rotation.z = -0.55;
      const nm = h.ownMat(0x9aa3ad);
      const body = new T.Mesh(kit.keep(new T.CylinderGeometry(0.55, 0.55, 15, 12)), nm); nail.add(body); body.add(new T.Mesh(body.geometry, kit.hullMat));
      const head = new T.Mesh(kit.keep(new T.CylinderGeometry(1.4, 1.4, 0.6, 16)), nm); at(head, 0, 7.6, 0, nail); head.add(new T.Mesh(head.geometry, kit.hullMat));
      const tip = new T.Mesh(kit.keep(new T.ConeGeometry(0.55, 1.6, 12)), nm); tip.rotation.z = Math.PI; at(tip, 0, -8.3, 0, nail);
      const spots = []; for (let i = 0; i < 22; i++) { const s = box(0.7 + rnd(i) * 0.6, 0.5, 0.7, 0xc4612b, { edges: false, hull: false }); at(s, (rnd(i + 1) - 0.5) * 1.1, -7 + rnd(i + 2) * 13, (rnd(i + 3) - 0.5) * 1.1, nail); s.visible = false; spots.push({ s, k: rnd(i + 5) }); }
      const scr = h.screen(9, 4, 'день 1', '#ffd166'); at(scr, 14, TY + 8, 6, ap); at(box(10, 5, 1, 0x3b4a66), 14, TY + 8, 5.4, ap); at(box(1, 6, 1, 0x3b4a66), 14, TY + 3, 5.4, ap);
      upd.push(p => {
        nm.color.copy(mixC(T, 0x9aa3ad, 0xa8552a, p)); lq.mat.color.copy(mixC(T, 0x8fcbe8, 0xc9a17a, p * 0.7));
        spots.forEach(s => { s.s.visible = s.k < p; });
        scr.userData.set('день ' + (1 + Math.round(p * 13)), '#ffd166');
      });
    }
    if (d.ph === 'heat') {
      h.spirit(ap, 0, TY, 0, true);
      const pg = new T.Group(); at(pg, 0, TY + 17, 0, ap);
      at(box(14, 0.6, 7, 0xd9824a), 0, 0, 0, pg);
      const blk = box(1, 0.2, 1, 0x231c1a, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0 } }); at(blk, 0, 0.42, 0, pg);
      const blkB = box(1, 0.2, 1, 0x231c1a, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0 } }); at(blkB, 0, -0.42, 0, pg);
      // тигельные щипцы
      h.rodAB(ap, v3(6, TY + 17.5, 1.2), v3(24, TY + 24, 3), 0.45, C.STEEL); h.rodAB(ap, v3(6, TY + 17.5, -1.2), v3(24, TY + 24, -3), 0.45, C.STEEL);
      upd.push(p => {
        const k = clamp(p * 1.15, 0, 1), w = 0.3 + 0.7 * p;
        [blk, blkB].forEach(b => { b.scale.set(14 * w, 1, 7 * Math.min(1, w + 0.2)); b.material.opacity = k * 0.95; });
      });
    }
    kit.onFrame((dt, t) => { const p = kit.reduce ? L0() : L0(); upd.forEach(f => f(p, t)); });
    // журнал наблюдений
    const nb = new T.Group(); at(nb, 38, TY, -16, g);
    at(box(1, 14, 1, C.DARK), -10, 7, -1.2, nb); at(box(1, 14, 1, C.DARK), 10, 7, -1.2, nb);
    const lines = d.fin ? wrapText(d.see, 26) : [d.playing ? 'Идёт опыт…' : 'Нажмите на установку,', d.playing ? '' : 'чтобы провести опыт.'];
    const pw = 420, ph = 300, k = h.canvasTex(pw, ph);
    k.x.fillStyle = '#fffaf0'; k.x.fillRect(0, 0, pw, ph); k.x.strokeStyle = '#1b1610'; k.x.lineWidth = 8; k.x.strokeRect(4, 4, pw - 8, ph - 8);
    k.x.fillStyle = '#c9d1da'; for (let y = 76; y < ph - 10; y += 34) k.x.fillRect(20, y + 22, pw - 40, 2);
    k.x.fillStyle = '#1b1610'; k.x.font = '700 30px "IBM Plex Mono", monospace'; k.x.textAlign = 'center'; k.x.fillText('Наблюдение', pw / 2, 44);
    k.x.font = '500 23px "IBM Plex Mono", monospace'; k.x.fillStyle = d.fin ? '#8a3a00' : '#56627d';
    lines.slice(0, 6).forEach((l, i) => k.x.fillText(l, pw / 2, 96 + i * 34));
    k.tex.needsUpdate = true;
    const pad = new T.Mesh(kit.keep(new T.PlaneGeometry(24, 17)), kit.keep(new T.MeshBasicMaterial({ map: k.tex }))); pad.rotation.x = -0.35; at(pad, 0, 11, 0, nb);
    at(box(24.6, 17.6, 0.6, 0x3b4a66), 0, 11, -0.4, nb).rotation.x = -0.35;
    // клавиши
    h.key(g, -42, 20, 18, 6, 'Провести опыт', 0x2f9e55, 'run');
    const right = d.chem;
    h.key(g, -14, 22, 20, 6, 'Физическое', right === false ? 0x2f9e55 : 0x3b6fd0, 'phys');
    h.key(g, 10, 22, 20, 6, 'Химическое', right === true ? 0x2f9e55 : 0xd0702a, 'chem');
    h.key(g, 36, 22, 14, 6, 'Дальше ›', 0x56688f, 'nextp');
    d.shorts.forEach((s, i) => {
      const x = -50 + i * 20, cur = i === d.i, ok = d.ans[i];
      h.key(g, x, 35, 18, 6, (ok ? '✓ ' : '') + s, cur ? 0xe08a00 : ok ? 0x2f9e55 : 0x3b4a66, 'tile-' + i);
    });
    const st = d.chem != null ? '✓ ' + (d.chem ? 'химическое' : 'физическое') : d.fin ? 'физическое или химическое?' : d.playing ? 'идёт опыт…' : 'нажмите — провести';
    tag(v3(AX, TY + 30, AZ), d.name, st, d.chem != null);
  };

  // ===== Разделение смесей: магнит, вода, фильтр в воронке, колба, выпаривание на спиртовке =====
  SC['chlb-sep'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3, v2 = h.v2;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const s = d.s;
    const GR = { iron: 0x4b5260, sand: 0xd8b779, salt: 0xf4f7fb };
    const grains = (parent, x, y0, z, r, hgt, types, n, seed) => {
      for (let i = 0; i < n; i++) {
        const tp = types[i % types.length], a = rnd(seed + i) * 6.28, rr = Math.sqrt(rnd(seed + i + 50)) * r, y = y0 + rnd(seed + i + 90) * hgt * (1 - rr / r * 0.5);
        const m = tp === 'salt' ? box(0.55, 0.55, 0.55, GR.salt, { edges: false, hull: false }) : h.ball(tp === 'iron' ? 0.3 : 0.38, GR[tp], { hull: false, seg: 6, seg2: 4 });
        at(m, x + Math.cos(a) * rr, y, z + Math.sin(a) * rr, parent);
      }
    };
    // стакан со смесью
    const MX = -44, MZ = 2;
    const mb = new T.Group(); at(mb, MX, 0, MZ, g); clickable(mb, 'filter');
    h.beaker(mb, 0, TY, 0, 6, 13);
    const sol = ['iron', 'sand'].filter(k => s.mix[k]).concat(s.mix.salt && !s.mix.water ? ['salt'] : []);
    if (sol.length) { const hh = s.mix.water ? 1.6 : 3; at(cyl(5.5, hh, s.mix.sand ? 0xb89a62 : 0x3a3f4a, { edges: false, hull: false }), 0, TY + 0.6 + hh / 2, 0, mb); grains(mb, 0, TY + 0.6 + hh, 0, 5, 0.6, sol, 40, 3); }
    if (s.mix.water) { const l = h.liquid(mb, 0, TY + 0.6, 0, 5.6, 0x8fcbe8, 0.42); l.set(8.5, TY + 0.6); }
    at(h.hitBox(13, 15, 13), 0, TY + 7, 0, mb);
    // кувшин с водой
    const JX = -42, JZ = -24;
    const jg = new T.Group(); at(jg, JX, 0, JZ, g); clickable(jg, 'water');
    h.beaker(jg, 0, TY, 0, 5, 13, { marks: false });
    const jl = h.liquid(jg, 0, TY + 0.6, 0, 4.6, 0x5fb4d9, 0.55); jl.set(9, TY + 0.6);
    const hd = mesh(new T.TorusGeometry(3.2, 0.6, 8, 20, Math.PI), 0xd8eef8, { edges: false, hull: true }); hd.rotation.z = -Math.PI / 2; at(hd, 5, TY + 8, 0, jg);
    at(h.hitBox(13, 15, 11), 0, TY + 7, 0, jg);
    // магнит-подкова на листке бумаги
    const GX = -30, GZ = 30;
    at(box(14, 0.15, 10, 0xffffff, { edges: false }), GX, TY + 0.1, GZ, g);
    const mg = new T.Group(); at(mg, GX, TY + 0.2, GZ, g); clickable(mg, 'magnet');
    const arc = mesh(new T.TorusGeometry(3.4, 1.3, 10, 24, Math.PI), 0xe5534b, { hull: true, edges: false }); at(arc, 0, 6.5, 0, mg);
    [-3.4, 3.4].forEach(x => { at(box(2.6, 4, 2.6, 0xe5534b), x, 4.5, 0, mg); at(box(2.6, 2.2, 2.6, 0xc8d1e2), x, 1.3, 0, mg); });
    if (s.mag) for (let i = 0; i < 40; i++) { const side = i % 2 ? 1 : -1; const m = box(0.4, 0.4, 0.4, 0x3a3f4a, { edges: false, hull: false }); m.rotation.set(rnd(i) * 3, rnd(i + 1) * 3, 0); at(m, side * 3.4 + (rnd(i + 2) - 0.5) * 3.4, 0.2 + rnd(i + 3) * 1.2, (rnd(i + 4) - 0.5) * 3.4, mg); }
    at(h.hitBox(11, 10, 5), 0, 5, 0, mg);
    // штатив с кольцом, воронка с фильтром, колба
    const FX = 4, FZ = -6;
    h.stand(g, FX, FZ - 12, 34, [{ y: TY + 27.5, to: v3(FX, 0, FZ), ring: 5.6 }]);
    const fun = new T.Group(); at(fun, FX, TY + 14, FZ, g);
    const fgeo = kit.keep(new T.LatheGeometry([v2(0.55, 0), v2(0.55, 7), v2(6.6, 14), v2(6.9, 14.2)], 32));
    const fw = new T.Mesh(fgeo, h.glassMat(0xd8eef8, 0.28)); fun.add(fw); fw.add(new T.Mesh(fgeo, kit.hullMat));
    const pgeo = kit.keep(new T.LatheGeometry([v2(0.05, 8.2), v2(5.9, 13.9)], 24));
    at(new T.Mesh(pgeo, h.ownMat(0xf6f2e6, { side: T.DoubleSide })), 0, 0, 0, fun);
    if (s.filt.sand || s.filt.iron) { at(cyl(2.6, 2.2, s.filt.sand ? 0xc9a868 : 0x4b5260, { r2: 3.2, edges: false, hull: false }), 0, 9.6, 0, fun); grains(fun, 0, 10.6, 0, 2.6, 0.4, ['sand', 'iron'].filter(k => s.filt[k]), 16, 11); }
    const fl = h.cflask(g, FX, TY, FZ, 7.5, 16, 1.9);
    const flq = s.flask.water ? fl.fill(5, 0x8fcbe8, 0.5) : null;
    const flg = new T.Group(); at(flg, FX, 0, FZ, g); clickable(flg, 'dish'); at(h.hitBox(15, 16, 15), 0, TY + 8, 0, flg);
    const funHit = new T.Group(); at(funHit, FX, 0, FZ, g); clickable(funHit, 'filter'); at(h.hitBox(13, 9, 13), 0, TY + 24, 0, funHit);
    // капли после фильтрования
    if (s.flask.water && mem.sepWas === false) mem.dripT = nowS();
    mem.sepWas = !!s.flask.water;
    const dr = []; for (let i = 0; i < 3; i++) { const b = h.ball(0.4, 0x8fcbe8, { hull: false }); at(b, FX, TY + 14, FZ, g); b.visible = false; dr.push(b); }
    // треножник, фарфоровая чашка, спиртовка
    const EX = 36, EZ = -4, EY = TY + 18;
    for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.5; h.rodAB(g, v3(EX + Math.cos(a) * 6, EY, EZ + Math.sin(a) * 6), v3(EX + Math.cos(a) * 8, TY, EZ + Math.sin(a) * 8), 0.4, C.STEEL); }
    const tr = mesh(new T.TorusGeometry(6, 0.45, 8, 28), C.STEEL, { edges: false, hull: true }); tr.rotation.x = Math.PI / 2; at(tr, EX, EY, EZ, g);
    at(box(13, 0.3, 13, 0x8a929c, { edges: false }), EX, EY + 0.4, EZ, g);
    const dg = new T.Group(); at(dg, EX, EY + 0.55, EZ, g);
    const dgeo = kit.keep(new T.LatheGeometry([v2(0.001, 0), v2(2.5, 0.05), v2(5, 1.4), v2(6.6, 3.4), v2(7, 3.6)], 32));
    const dm = new T.Mesh(dgeo, kit.toon(0xf7f5f0, { side: T.DoubleSide })); dm.castShadow = true; dg.add(dm); dm.add(new T.Mesh(dgeo, kit.hullMat));
    const dl = cyl(1, 0.2, 0x8fcbe8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.6 } }); at(dl, 0, 1, 0, dg);
    const cr = []; if (s.dish.salt) for (let i = 0; i < 30; i++) { const a = rnd(i + 200) * 6.28, r = Math.sqrt(rnd(i + 201)) * 4; const m = box(0.6, 0.6, 0.6, 0xf9fbfe); m.rotation.y = rnd(i) * 2; at(m, Math.cos(a) * r, 0.6 + r * 0.25, Math.sin(a) * r, dg); cr.push(m); }
    const dHit = new T.Group(); at(dHit, EX, 0, EZ, g); clickable(dHit, 'dish'); at(h.hitBox(15, 5, 15), 0, EY + 2, 0, dHit);
    const lp = new T.Group(); at(lp, EX, 0, EZ, g); clickable(lp, 'lamp'); h.spirit(lp, 0, TY, 0, s.burner); at(h.hitBox(9, 14, 9), 0, TY + 7, 0, lp);
    const stm = h.puffs(g, EX, EY + 4, EZ, { n: 6, spread: 6, rise: 12, size: 4, op: 0.5, amt: 0 });
    kit.onFrame((dt, t) => {
      const L = live() || {}, heat = L.heat ?? s.heat;
      const w = s.dish.water ? 1 - heat : 0;
      dl.visible = w > 0.02; dl.scale.set(2 + 4.4 * Math.max(0.3, w), 1, 2 + 4.4 * Math.max(0.3, w)); dl.position.y = 0.4 + 2.4 * w;
      const nVis = s.dish.water ? Math.round(4 + 26 * heat) : 30; cr.forEach((m, i) => { m.visible = i < nVis; });
      stm.set(s.burner && s.dish.water ? 1 : 0);
      const e = mem.dripT ? nowS() - mem.dripT : 99;
      dr.forEach((b, i) => { b.visible = e < 3.5 && !kit.reduce; const ph = (t * 1.6 + i / 3) % 1; b.position.y = TY + 14 - ph * 8; });
    });
    // кнопка «Заново» и итоги
    h.key(g, 50, 38, 16, 6, 'Заново', 0x56688f, 'reset');
    [['Железо', d.iron, -6], ['Песок', d.sand, 12], ['Соль', d.salt, 30]].forEach(([n, ok, x]) => h.floorLabel(g, x, 38, 15, 4, (ok ? '✓ ' : '') + n, '#1b1610', ok ? '#86e0a8' : '#fffaf0'));
    tag(v3(MX, TY + 17, MZ), 'Смесь', sol.length || s.mix.water ? (s.mix.water ? (s.mix.salt ? 'соль растворилась' : 'вода') : ['iron', 'sand', 'salt'].filter(k => s.mix[k]).length + ' вещества') : 'пусто');
    tag(v3(GX, TY + 11, GZ), 'Магнит', s.mag ? 'железо отделено' : 'железо в смеси', d.iron);
    tag(v3(FX, TY + 34, FZ), 'Фильтр', s.filt.sand ? (s.filt.iron ? 'песок + железо' : 'песок отделён') : 'пустой', d.sand);
    tag(v3(EX, EY + 9, EZ), 'Чашка', s.dish.water ? (s.burner ? 'выпаривание…' : 'раствор соли') : s.dish.salt ? 'кристаллы соли' : 'пусто', d.salt);
    tag(v3(EX + 4, TY + 4, EZ + 9), 'Спиртовка', s.burner ? 'горит' : 'погашена');
  };

  // ===== Безопасность в лаборатории: стол с шестью нарушениями =====
  SC['chlb-rules'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const HZ = { food: [-46, 22, 9], goggles: [-28, 34, 6], spirit: [-20, 6, 5.5], tube: [2, 0, 9], nolabel: [26, 12, 5], glass: [40, 28, 6], edge: [56, 41, 4.6], ext: [-54, -28, 5], kit: [50, -26, 7] };
    const grp = id => { const [x, z] = HZ[id], o = new T.Group(); at(o, x, TY, z, g); clickable(o, 'hz-' + id); return o; };
    // сосед за столом
    const nb = new T.Group(); at(nb, 22, 0, -48, g);
    at(cyl(7, 26, 0xf3f5f8, { r2: 5.6 }), 0, 9, 0, nb); at(cyl(2, 3, 0xf0c8a0), 0, 23, 0, nb);
    at(h.ball(5, 0xf0c8a0), 0, 29, 0, nb); const hair = mesh(new T.SphereGeometry(5.3, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2.2), 0x3a2a20, { hull: true, edges: false }); at(hair, 0, 29.6, -0.4, nb);
    [-1.8, 1.8].forEach(x => at(h.ball(0.6, 0x1b1610, { hull: false }), x, 29.6, 4.6, nb));
    tag(v3(22, 38, -48), 'Сосед', null);
    // плакат со знаками опасности
    const pst = new T.Group(); at(pst, -24, TY, -36, g);
    at(box(1, 22, 1, C.DARK), -15, 11, 0, pst); at(box(1, 22, 1, C.DARK), 15, 11, 0, pst);
    const k = h.canvasTex(512, 256), x = k.x;
    x.fillStyle = '#fffaf0'; x.fillRect(0, 0, 512, 256); x.strokeStyle = '#1b1610'; x.lineWidth = 8; x.strokeRect(4, 4, 504, 248);
    const dia = (cx, draw) => { x.save(); x.translate(cx, 120); x.rotate(Math.PI / 4); x.fillStyle = '#fff'; x.strokeStyle = '#d8433a'; x.lineWidth = 12; x.fillRect(-56, -56, 112, 112); x.strokeRect(-56, -56, 112, 112); x.restore(); x.save(); x.translate(cx, 120); x.fillStyle = '#1b1610'; draw(); x.restore(); };
    dia(96, () => { x.beginPath(); x.moveTo(0, -42); x.bezierCurveTo(26, -10, 26, 22, 0, 34); x.bezierCurveTo(-26, 22, -26, -10, 0, -42); x.fill(); x.fillRect(-30, 36, 60, 7); });
    dia(256, () => { x.beginPath(); x.arc(0, -10, 24, 0, 7); x.fill(); x.fillRect(-14, 6, 28, 18); x.fillStyle = '#fff'; x.beginPath(); x.arc(-9, -10, 7, 0, 7); x.arc(9, -10, 7, 0, 7); x.fill(); x.fillStyle = '#1b1610'; x.lineWidth = 9; x.strokeStyle = '#1b1610'; x.beginPath(); x.moveTo(-34, 30); x.lineTo(34, 44); x.moveTo(34, 30); x.lineTo(-34, 44); x.stroke(); });
    dia(416, () => { x.fillRect(-7, -38, 14, 48); x.beginPath(); x.arc(0, 26, 8, 0, 7); x.fill(); });
    x.font = '700 28px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.fillStyle = '#1b1610'; x.fillText('ОГОНЬ', 96, 240); x.fillText('ЯД', 256, 240); x.fillText('ОПАСНО', 416, 240);
    k.tex.needsUpdate = true;
    const pl = new T.Mesh(kit.keep(new T.PlaneGeometry(30, 15)), kit.keep(new T.MeshBasicMaterial({ map: k.tex }))); at(pl, 0, 14, 0.6, pst); at(box(30.8, 15.8, 0.8, 0x3b4a66), 0, 14, 0, pst);
    // еда и чай
    const fo = grp('food');
    at(box(10, 1.2, 7, 0xd9a35f), -2, 0.6, 0, fo); at(box(10.6, 0.5, 7.4, 0xf2cf4a), -2, 1.45, 0, fo); at(box(10.4, 0.4, 7.2, 0x7cc443), -2, 1.9, 0, fo); at(box(10, 1.4, 7, 0xe8b26a), -2, 2.8, 0, fo);
    at(cyl(2.6, 5, 0xeef1f6, { r2: 3 }), 6, 2.5, 0, fo); at(cyl(2.5, 0.3, 0x8a4a1c, { edges: false, hull: false }), 6, 4.6, 0, fo);
    const hdl = mesh(new T.TorusGeometry(1.4, 0.4, 6, 14), 0xeef1f6, { edges: false, hull: true }); at(hdl, 9, 2.8, 0, fo);
    h.puffs(fo, 6, 5.2, 0, { n: 4, spread: 1.6, rise: 6, size: 2, op: 0.45 });
    at(h.hitBox(18, 7, 10), 1, 3.5, 0, fo);
    // защитные очки (всё правильно)
    const go = grp('goggles');
    [-2.2, 2.2].forEach(xx => { const l = mesh(new T.TorusGeometry(1.8, 0.45, 8, 20), 0x2a8fa8, { edges: false, hull: true }); l.rotation.x = -1.2; at(l, xx, 1.1, 0, go); at(cyl(1.6, 0.2, 0x9fe0f0, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.5 } }), xx, 1.1, 0, go).rotation.x = 0.37; });
    h.rodAB(go, v3(-4, 0.9, 0), v3(-6, 0.5, -3), 0.3, 0x2c3240); h.rodAB(go, v3(4, 0.9, 0), v3(6, 0.5, -3), 0.3, 0x2c3240);
    at(h.hitBox(12, 4, 7), 0, 1.5, 0, go);
    // открытая бутыль спирта, крышка рядом
    const sp = grp('spirit');
    at(cyl(2.6, 8, 0xd8eef8, { matOpt: { transparent: true, opacity: 0.45 } }), 0, 4, 0, sp); at(cyl(2.3, 6, 0xeaf6ff, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.5 } }), 0, 3.2, 0, sp);
    at(cyl(1, 2.6, 0xd8eef8, { r2: 0.9, matOpt: { transparent: true, opacity: 0.5 } }), 0, 9.3, 0, sp);
    at(h.sticker(4, 2.4, 'спирт'), 0, 4, 2.62, sp);
    at(cyl(1.1, 1.2, 0xe5534b), 4, 0.6, 1.5, sp);
    at(h.hitBox(10, 11, 7), 1, 5.5, 0, sp);
    // спиртовка и пробирка в держателе
    const tb = grp('tube'); h.spirit(tb, 0, 0, 0, true);
    const ok = !!d.found.tube;
    // отверстие — к соседу (нарушение) или вправо, где никого нет (исправлено)
    const tt = new T.Group(); at(tt, 0, 15.2, 0, tb);
    tt.quaternion.setFromUnitVectors(v3(0, 1, 0), (ok ? v3(1, 0.85, 0.15) : v3(0.38, 0.8, -0.92)).normalize());
    const tu = h.testTube(tt, 0, 0, 0, 1.4, 16);
    h.tubeLiquid(tu.g, 1.4, 4, 0x8fcbe8, 0.7);
    at(box(3.4, 1.6, 3.4, C.WOOD2), 0, 11, 0, tt); at(box(10, 1, 1.4, C.WOOD2), 6.5, 11, 0, tt);
    at(h.hitBox(10, 22, 10), 0, 10, 0, tb);
    // склянка без этикетки
    const nl = grp('nolabel');
    at(cyl(2.6, 7.5, 0x6b4a2a, { matOpt: { transparent: true, opacity: 0.85 } }), 0, 3.75, 0, nl); at(cyl(1.1, 2.2, 0x6b4a2a, { matOpt: { transparent: true, opacity: 0.85 } }), 0, 8.6, 0, nl); at(cyl(1.4, 1.4, 0x3b4a66), 0, 10.3, 0, nl);
    at(h.sticker(3, 3, '?', '#f1ece0', '#6b4a2a'), 0, 4, 2.62, nl);
    at(h.hitBox(7, 12, 7), 0, 6, 0, nl);
    // осколки стекла
    const gl = grp('glass');
    for (let i = 0; i < 6; i++) { const m = mesh(new T.TetrahedronGeometry(1.2 + rnd(i) * 0.8), 0xd8eef8, { hull: true, edges: false, matOpt: { transparent: true, opacity: 0.7 } }); m.rotation.set(rnd(i + 1) * 3, rnd(i + 2) * 3, rnd(i + 3) * 3); at(m, (rnd(i + 4) - 0.5) * 8, 0.6, (rnd(i + 5) - 0.5) * 6, gl); }
    at(h.hitBox(11, 3, 9), 0, 1.5, 0, gl);
    // стакан на краю
    const ed = grp('edge');
    h.beaker(ed, 0, 0, 0, 3.4, 8, { marks: false }); const el = h.liquid(ed, 0, 0.6, 0, 3, 0xa78bfa, 0.6); el.set(4.4, 0.6);
    at(h.hitBox(8, 10, 8), 0, 5, 0, ed);
    // огнетушитель и аптечка (всё правильно)
    const ex = grp('ext');
    at(cyl(3, 16, 0xd8433a), 0, 8, 0, ex); at(cyl(1.2, 2, 0x2c3240), 0, 17, 0, ex); at(box(4, 1, 1.2, 0x2c3240), 1.4, 18.4, 0, ex);
    h.pipe(ex, [v3(0.8, 17.5, 0), v3(3.6, 16, 1.5), v3(3.6, 8, 3)], 0.45, 0x2c3240);
    at(h.sticker(4, 5, 'ОУ', '#1b1610', '#fff6e6'), 0, 9, 3.05, ex);
    at(h.hitBox(8, 20, 8), 0, 10, 0, ex);
    const ki = grp('kit');
    at(box(11, 7, 7, 0xeef1f6), 0, 3.5, 0, ki); at(box(6, 1.6, 0.2, 0xd8433a, { edges: false }), 0, 3.6, 3.55, ki); at(box(1.6, 6, 0.2, 0xd8433a, { edges: false }), 0, 3.6, 3.56, ki);
    at(box(4, 1, 1, 0x3b4a66), 0, 7.4, 0, ki);
    at(h.hitBox(12, 9, 8), 0, 4, 0, ki);
    // найденные нарушения: зелёные кольца с номерами, подсказка — жёлтое кольцо
    Object.entries(d.found).forEach(([id, n]) => {
      const [x, z, r] = HZ[id]; h.ringT(g, x, z, r);
      h.pill(g, x + r * 0.7, TY + 2, z + r * 0.7, String(n), '#1b1610', '#86e0a8', 2.8);
    });
    if (d.hint && HZ[d.hint]) {
      const [x, z, r] = HZ[d.hint], hr = h.ringT(g, x, z, r + 1, 0xffd166, TY + 0.6);
      if (!kit.reduce) kit.onFrame((dt, t) => { hr.scale.setScalar(1 + 0.12 * Math.sin(t * 8)); });
    }
    h.key(g, -8, 41, 18, 5, 'Подсказка', 0xe08a00, 'tip');
    h.key(g, 14, 41, 14, 5, 'Заново', 0x56688f, 'rehaz');
    const n = Object.keys(d.found).length;
    tag(v3(-24, TY + 28, -36), 'Нарушения', `найдено ${n} из 6`, n === 6);
    if (ok) tag(v3(2, TY + 22, 0), 'Пробирка', 'отверстием от людей', true);
  };
})();
