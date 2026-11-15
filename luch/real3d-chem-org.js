// «Как в жизни» для химии: «Кислородсодержащие органические вещества» (labs/chem-oxyorg) и «Полимеры» (labs/chem-polymers).
// Белый лабораторный поднос, прозрачная посуда, спиртовка, растворы верного цвета; модели молекул из шариков,
// образцы пластмасс и волокон, штатив с резиновой полоской и грузом, контейнеры для сортировки и бак флотации.
// Сцены строятся из window.LUCH_REAL() опыта; быстрые значения (температура, ход реакции, растяжение) — из LUCH_REAL.live() в onFrame.
(() => {
  const SC = window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {};
  const live = () => { try { return window.LUCH_REAL.live ? window.LUCH_REAL.live() : null; } catch (e) { return null; } };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (x, n) => { let s = (Math.round(x * 10 ** n) / 10 ** n).toFixed(n); if (/^-0(\.0+)?$/.test(s)) s = s.slice(1); return s.replace('.', ',').replace('-', '−'); };
  // детерминированный «случай»: сцена перестраивается, а детали должны стоять на тех же местах
  const rnd = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const hexs = c => '#' + c.toString(16).padStart(6, '0');
  // память между перестройками сцены (растущая цепь, хлопья во флотации)
  const mem = {};

  // ---------- общие детали ----------
  function H(kit) {
    const { T, at, box, cyl, mesh, keep, grad, glowTex, textTex, clickable, C } = kit;
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    const glassMat = (color = 0xd8eef8, opacity = 0.24) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, transparent: true, opacity, side: T.DoubleSide, depthWrite: false }));
    const ownMat = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, ...o }));
    const spr = (map, color, opacity, add) => new T.Sprite(keep(new T.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending })));
    const glow = (color, size, opacity) => { const s = spr(glowTex(), color, opacity, true); s.scale.setScalar(size); return s; };
    const flat = (w, h, tex) => new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: keep(tex), transparent: true })));
    const ball = (r, color, o = {}) => mesh(new T.SphereGeometry(r, o.seg || 18, o.seg2 || 12), color, { hull: o.hull ?? true, edges: false, matOpt: o.matOpt, shadow: o.shadow });
    const glassy = (geo, color = 0xd8eef8, op = 0.22) => { const m = new T.Mesh(keep(geo), glassMat(color, op)); m.add(new T.Mesh(m.geometry, kit.hullMat)); return m; };
    // цилиндр от точки a до точки b
    function rodAB(parent, a, b, r, color, o = {}) {
      const dv = b.clone().sub(a), L = dv.length();
      const m = cyl(r, L, color, { edges: false, ...o });
      m.quaternion.setFromUnitVectors(v3(0, 1, 0), dv.normalize());
      return at(m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, parent);
    }
    function canvasTex(pw, ph) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph;
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace;
      return { c, x: c.getContext('2d'), tex };
    }
    function drawLines(x, pw, ph, lines, col, weight = 600) {
      const lh = ph / lines.length;
      lines.forEach((ln, i) => {
        let fs = Math.round(lh * 0.64); x.font = `${weight} ${fs}px "IBM Plex Mono", monospace`;
        const tw = x.measureText(ln).width; if (tw > pw * 0.88) { fs = Math.floor(fs * pw * 0.88 / tw); x.font = `${weight} ${fs}px "IBM Plex Mono", monospace`; }
        x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ln, pw / 2, lh * (i + 0.5) + 2);
      });
    }
    // табло с текстом
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
    // бумажная наклейка с надписью
    function sticker(w, h, txt, fg = '#1b1610', bg = '#fffaf0', pw = 256) {
      const ph = Math.round(pw * h / w), k = canvasTex(pw, ph);
      k.x.clearRect(0, 0, pw, ph); k.x.fillStyle = bg; const r = ph * 0.18;
      k.x.beginPath(); k.x.roundRect ? k.x.roundRect(2, 2, pw - 4, ph - 4, r) : k.x.rect(2, 2, pw - 4, ph - 4); k.x.fill();
      k.x.strokeStyle = '#1b1610'; k.x.lineWidth = 4; k.x.stroke();
      drawLines(k.x, pw, ph, String(txt).split('\n'), fg); k.tex.needsUpdate = true;
      return new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: k.tex, transparent: true })));
    }
    // наклейка, лежащая на подносе
    function floorSticker(parent, x, y, z, w, hh, txt, fg, bg, pw) { const s = sticker(w, hh, txt, fg, bg, pw); s.rotation.x = -Math.PI / 2; return at(s, x, y + 0.06, z, parent); }
    // кнопка: колпачок со значком сверху
    function button(parent, x, y, z, label, color, key, w = 4.2, d = 3.6) {
      const b = new T.Group(); at(b, x, y, z, parent);
      at(box(w, 1.4, d, color), 0, 0.7, 0, b);
      const top = flat(w * 0.86, d * 0.8, textTex(label, '#ffffff', hexs(color), Math.round(128 * w / 4.2), 96));
      top.rotation.x = -Math.PI / 2; at(top, 0, 1.42, 0, b);
      clickable(b, key); return b;
    }
    // табличка-переключатель на подносе (режим опыта)
    function modeSign(parent, x, y, z, label, on, key, w = 13) {
      const b = new T.Group(); at(b, x, y, z, parent);
      at(box(w, 1.2, 5, on ? 0x2f6fd8 : 0xdfe5ec), 0, 0.6, 0, b);
      const s = flat(w * 0.9, 4.2, textTex(label, on ? '#ffffff' : '#1b1610', on ? '#2f6fd8' : '#dfe5ec', 256, 80)); s.rotation.x = -Math.PI / 2; at(s, 0, 1.22, 0, b);
      clickable(b, key); return b;
    }
    // белый лабораторный поднос-плитка; возвращает высоту верха
    function tray(parent, x, z, w, d) {
      at(box(w, 1, d, 0xf1f3f5), x, 0.5, z, parent);
      const nx = Math.floor(w / 12), nz = Math.floor(d / 12);
      for (let i = 1; i < nx; i++) at(box(0.25, 0.06, d - 0.6, 0xc9d1da, { edges: false, shadow: false }), x - w / 2 + i * w / nx, 1.03, z, parent);
      for (let i = 1; i < nz; i++) at(box(w - 0.6, 0.06, 0.25, 0xc9d1da, { edges: false, shadow: false }), x, 1.03, z - d / 2 + i * d / nz, parent);
      return 1;
    }
    // стеклянный стакан с делениями
    function beaker(parent, x, y0, z, r, h) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const wall = glassy(new T.CylinderGeometry(r, r * 0.97, h, 40, 1, true)); at(wall, 0, h / 2, 0, g);
      at(cyl(r * 0.97, 0.6, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.45 } }), 0, 0.3, 0, g);
      const rim = mesh(new T.TorusGeometry(r, 0.22, 6, 40), 0xeef6fb, { edges: false, shadow: false }); rim.rotation.x = Math.PI / 2; at(rim, 0, h, 0, g);
      const a = 0.5;
      for (let k = 1; k <= 5; k++) { const m = box(k % 2 ? 1.1 : 2, 0.16, 0.1, 0x6f8098, { edges: false, shadow: false }); m.rotation.y = a; at(m, Math.sin(a) * (r + 0.05), h * k / 6.5, Math.cos(a) * (r + 0.05), g); }
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
    // пробирка: открытая трубка с круглым дном
    function testTube(parent, x, y0, z, r, hh) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const wall = glassy(new T.CylinderGeometry(r, r, hh - r, 28, 1, true)); at(wall, 0, r + (hh - r) / 2, 0, g);
      const bot = glassy(new T.SphereGeometry(r, 28, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)); at(bot, 0, r, 0, g);
      const rim = mesh(new T.TorusGeometry(r + 0.1, 0.25, 6, 28), 0xeef6fb, { edges: false }); rim.rotation.x = Math.PI / 2; at(rim, 0, hh, 0, g);
      return { g, r, hh };
    }
    // жидкость в пробирке: полусфера + столбик до уровня lv (от дна)
    function tubeLiquid(parent, r, lv, color, opacity) {
      const mat = ownMat(color, { transparent: true, opacity, depthWrite: false }), g = new T.Group(); parent.add(g);
      const rr = r * 0.88;
      at(new T.Mesh(keep(new T.SphereGeometry(rr, 24, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), mat), 0, r, 0, g);
      if (lv > r) at(new T.Mesh(keep(new T.CylinderGeometry(rr, rr, lv - r, 24)), mat), 0, r + (lv - r) / 2, 0, g);
      return { g, mat };
    }
    // слой жидкости в пробирке от y0 до y1 (над дном)
    function tubeLayer(parent, r, y0, y1, color, opacity) {
      const mat = ownMat(color, { transparent: true, opacity, depthWrite: false });
      return { m: at(new T.Mesh(keep(new T.CylinderGeometry(r * 0.88, r * 0.88, y1 - y0, 24)), mat), 0, (y0 + y1) / 2, 0, parent), mat };
    }
    // колба с круглым дном и горлом
    function flask(parent, x, y0, z, R, neck) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const bulb = glassy(new T.SphereGeometry(R, 32, 20), 0xd8eef8, 0.2); at(bulb, 0, R, 0, g);
      const nk = glassy(new T.CylinderGeometry(R * 0.28, R * 0.3, neck, 24, 1, true)); at(nk, 0, R * 1.9 + neck / 2, 0, g);
      return { g, top: R * 1.9 + neck, R };
    }
    // коническая колба (Эрленмейера): профиль вращения
    function erlen(parent, x, y0, z, R, hb, rn, hn) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const pts = [v3(0.01, 0, 0), v3(R - 0.8, 0, 0), v3(R, 0.8, 0), v3(rn, hb, 0), v3(rn, hb + hn, 0)].map(p => new T.Vector2(p.x, p.y));
      const wall = glassy(new T.LatheGeometry(pts, 40), 0xd8eef8, 0.22); g.add(wall);
      const rim = mesh(new T.TorusGeometry(rn + 0.15, 0.3, 6, 24), 0xeef6fb, { edges: false }); rim.rotation.x = Math.PI / 2; at(rim, 0, hb + hn, 0, g);
      // радиус стенки на высоте y
      const rAt = y => y <= 0.8 ? R : y >= hb ? rn : R + (rn - R) * (y - 0.8) / (hb - 0.8);
      return { g, rAt, top: hb + hn };
    }
    // склянка с реактивом: тело, плечики, горло, крышка, этикетка
    function bottle(parent, x, y0, z, o = {}) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const r = o.r || 3.6, h = o.h || 9, gc = o.glass ?? 0xd8eef8;
      const wall = glassy(new T.CylinderGeometry(r, r, h, 28, 1, true), gc, o.op ?? 0.32); at(wall, 0, h / 2, 0, g);
      at(cyl(r, 0.5, gc, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.5 } }), 0, 0.25, 0, g);
      const sh = glassy(new T.CylinderGeometry(r * 0.42, r, r * 0.7, 28, 1, true), gc, o.op ?? 0.32); at(sh, 0, h + r * 0.35, 0, g);
      if (o.liq != null) { const lq = liquid(g, 0, 0.5, 0, r * 0.92, o.liq, o.lop ?? 0.6); lq.set(h * (o.fill ?? 0.62)); }
      at(cyl(r * 0.46, 2.2, o.cap ?? 0x2c3240), 0, h + r * 0.7 + 1.1, 0, g);
      if (o.label) { const s = sticker(r * 1.7, o.lh || r * 1.1, o.label, o.fg || '#1b1610', o.bg || '#fffaf0', 200); at(s, 0, h * 0.5, r + 0.06, g); }
      return { g, top: h + r * 0.7 + 2.2 };
    }
    // пузырьки в жидкости
    function bubbles(parent, x, y0, z, r, n = 8, color = 0xffffff) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const geo = keep(new T.SphereGeometry(1, 10, 8)), mat = keep(new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false }));
      const bs = [];
      for (let i = 0; i < n; i++) { const m = new T.Mesh(geo, mat); m.visible = false; g.add(m); bs.push({ m, ph: rnd(i + 11), a: rnd(i + 21) * Math.PI * 2, rr: Math.sqrt(rnd(i + 31)) * r }); }
      const st = { amt: 0, top: 5, big: 0.5, speed: 0.6 };
      kit.onFrame((dt, t) => {
        const k = Math.round(st.amt * n);
        bs.forEach((b, i) => {
          b.m.visible = i < k && st.top > 1.2; if (!b.m.visible) return;
          const ph = kit.reduce ? b.ph : (t * st.speed + b.ph) % 1;
          b.m.scale.setScalar(st.big * (0.5 + 0.8 * ph));
          b.m.position.set(Math.cos(b.a) * b.rr + 0.3 * Math.sin(t * 5 + i), 0.4 + ph * (st.top - 0.9), Math.sin(b.a) * b.rr);
        });
      });
      return { g, set(a, top, big = 0.5, speed = 0.6) { Object.assign(st, { amt: a, top, big, speed }); } };
    }
    // клубы пара/газа: поднимаются и тают
    let puffT = null;
    function puffTex() {
      if (puffT) return puffT;
      const k = canvasTex(64, 64), gr = k.x.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.5, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      k.x.fillStyle = gr; k.x.fillRect(0, 0, 64, 64); puffT = k.tex; return puffT;
    }
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
    // спиртовка: стеклянный корпус со спиртом, латунная горловина, фитиль, пламя (или колпачок)
    function spirit(parent, x, y, z, on, s = 1, key) {
      const g = new T.Group(); at(g, x, y, z, parent); if (key) clickable(g, key);
      at(cyl(4.2 * s, 5 * s, 0xbfe3f2, { r2: 2.9 * s, matOpt: { transparent: true, opacity: 0.6 } }), 0, 2.5 * s, 0, g);
      at(cyl(3.8 * s, 2.4 * s, 0x8fc6ff, { r2: 3.4 * s, edges: false, hull: false, matOpt: { transparent: true, opacity: 0.7 } }), 0, 1.3 * s, 0, g);
      at(cyl(1.6 * s, 1.5 * s, C.BRASS), 0, 5.7 * s, 0, g);
      at(cyl(0.5 * s, 1.3 * s, 0xf4efe2, { hull: false }), 0, 7 * s, 0, g);
      if (on) {
        const f = new T.Group(); at(f, 0, 7.5 * s, 0, g);
        const hgt = 8 * s;
        at(cyl(1.4 * s, hgt, 0xff8a2a, { r2: 0.05, edges: false, hull: false, shadow: false, matOpt: { emissive: 0xff6a10, emissiveIntensity: 0.9, transparent: true, opacity: 0.85 } }), 0, hgt / 2, 0, f);
        at(cyl(0.7 * s, hgt * 0.55, 0xfff1a8, { r2: 0.05, edges: false, hull: false, shadow: false, matOpt: { emissive: 0xffd24a, emissiveIntensity: 1 } }), 0, hgt * 0.28, 0, f);
        at(glow(0xff9a40, hgt * 2.2, 0.55), 0, hgt * 0.45, 0, f);
        at(new T.PointLight(0xffa040, 22 * s, 40, 1.4), 0, hgt * 0.5, 0, f);
        if (!kit.reduce) kit.onFrame((dt, t) => { f.scale.set(1 + 0.06 * Math.sin(t * 17), 1 + 0.1 * Math.sin(t * 11) + 0.05 * Math.sin(t * 29), 1 + 0.06 * Math.cos(t * 15)); });
      } else at(cyl(2 * s, 2.8 * s, 0xbfe3f2, { r2: 1.6 * s, matOpt: { transparent: true, opacity: 0.55 } }), 0, 7.3 * s, 0, g);
      return g;
    }
    // маленькое пламя-огонёк (на нити, на фитиле)
    function smallFlame(parent, x, y, z, hgt, col = 0xff8a2a) {
      const f = new T.Group(); at(f, x, y, z, parent);
      at(cyl(hgt * 0.22, hgt, col, { r2: 0.04, edges: false, hull: false, shadow: false, matOpt: { emissive: col, emissiveIntensity: 0.9, transparent: true, opacity: 0.88 } }), 0, hgt / 2, 0, f);
      at(cyl(hgt * 0.1, hgt * 0.5, 0xfff1a8, { r2: 0.03, edges: false, hull: false, shadow: false, matOpt: { emissive: 0xffd24a, emissiveIntensity: 1 } }), 0, hgt * 0.25, 0, f);
      at(glow(0xff9a40, hgt * 3, 0.6), 0, hgt * 0.45, 0, f);
      if (!kit.reduce) kit.onFrame((dt, t) => { f.scale.set(1 + 0.1 * Math.sin(t * 19), 1 + 0.16 * Math.sin(t * 13) + 0.06 * Math.sin(t * 31), 1); });
      return f;
    }
    // лабораторный штатив: основание, стойка, лапки до точек {y, to:{x,z}}
    function stand(parent, x, z, Hh, arms) {
      at(box(12, 1.2, 9, C.DARK), x, 0.6 + 1, z, parent);
      at(cyl(0.65, Hh, C.STEEL, { edges: false }), x, 2.2 + Hh / 2, z, parent);
      arms.forEach(a => {
        const p0 = v3(x, a.y, z), p1 = v3(a.to.x, a.y, a.to.z);
        rodAB(parent, p0, p1, 0.42, C.STEEL);
        at(box(2.2, 2.2, 2.2, C.DARK), x, a.y, z, parent);
        if (a.ring) { const rg = mesh(new T.TorusGeometry(a.ring, 0.35, 6, 24), 0x3b4a66, { edges: false }); rg.rotation.x = Math.PI / 2; at(rg, p1.x, a.y, p1.z, parent); }
        else at(box(a.w || 2.6, 2.4, 2.6, 0x3b4a66), p1.x, a.y, p1.z, parent);
      });
    }
    // HTML-подпись, значение которой можно менять в onFrame
    function liveTag(p, name, value, hot) {
      kit.tag(p, name, value, hot);
      const els = document.querySelectorAll('.rl-view .rl-lbl'), el = els[els.length - 1], i = el && el.querySelector('i');
      let cur = value;
      return v => { if (i && v !== cur) { cur = v; i.textContent = v; } };
    }
    // участок стола в увеличенном масштабе: локальные координаты как обычно (верх подноса y = ty), W() — в мировые
    function zone(parent, x, z, sc, ty = 1) {
      const zg = new T.Group(); at(zg, x, ty * (1 - sc), z, parent); zg.scale.setScalar(sc);
      zg.userData.W = (a, b, c) => v3(x + a * sc, ty * (1 - sc) + b * sc, z + c * sc); return zg;
    }
    // выбранная деталь: подсветка снизу
    const halo = (parent, x, y, z, size = 16) => at(glow(0xffd166, size, 0.4), x, y, z, parent);
    return { v3, glassMat, ownMat, spr, glow, flat, ball, glassy, rodAB, canvasTex, screen, sticker, floorSticker, button, modeSign, tray, beaker, liquid,
      testTube, tubeLiquid, tubeLayer, flask, erlen, bottle, bubbles, puffs, spirit, smallFlame, stand, liveTag, halo, zone };
  }

  // цвет: смесь двух
  const mixC = (T, a, b, k) => new T.Color(a).lerp(new T.Color(b), clamp(k, 0, 1));

  // модель молекулы из шариков: атомы {p, r, c}, связи [i, j, двойная?]
  function molecule(kit, h, parent, atoms, bonds) {
    const { T, at } = kit;
    atoms.forEach(a => { a.m = at(h.ball(a.r, a.c, { seg: 16, seg2: 12 }), a.p.x, a.p.y, a.p.z, parent); });
    bonds.forEach(([i, j, dbl, col]) => {
      const a = atoms[i].p, b = atoms[j].p;
      if (!dbl) { h.rodAB(parent, a, b, 0.42, col ?? 0xc8d1e2); return; }
      const dv = b.clone().sub(a), n = new T.Vector3(0, 0, 1).cross(dv).normalize().multiplyScalar(0.55);
      if (n.lengthSq() < 1e-6) n.set(0.55, 0, 0);
      h.rodAB(parent, a.clone().add(n), b.clone().add(n), 0.32, col ?? 0x72d4e8); h.rodAB(parent, a.clone().sub(n), b.clone().sub(n), 0.32, col ?? 0x72d4e8);
    });
  }
  const CC = 0x4f586d, HC = 0xeef2f8, OC = 0xe5604f;

  // =====================================================================================
  // СПИРТЫ, АЛЬДЕГИДЫ, КИСЛОТЫ, ЭФИРЫ
  // =====================================================================================

  // ===== 1. Спирты: модель молекулы, пробирка в лапке над спиртовкой, вода, Cu(OH)₂, термометр =====
  SC['chor-alc'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const ty = h.tray(g, 0, 2, 124, 80);
    // --- модель молекулы на подставке ---
    const MX = -36, MZ = 4, MY = ty + 19, MS = 1.5;
    const base = new T.Group(); at(base, MX, ty, MZ, g); base.scale.setScalar(MS); clickable(base, 'next');
    at(cyl(7, 1.4, C.WOOD2), 0, 0.7, 0, base); at(cyl(0.45, 17, C.STEEL, { edges: false }), 0, 1.4 + 8.5, 0, base);
    const mol = new T.Group(); at(mol, 0, MY - ty, 0, base);
    const n = d.oh.length, atoms = [], bonds = [], cs = [];
    for (let i = 0; i < n; i++) { const p = v3((i - (n - 1) / 2) * 5, n === 1 ? 0 : (i % 2 ? 1.6 : -1.6), 0); cs.push(atoms.length); atoms.push({ p, r: 1.9, c: CC }); if (i) bonds.push([cs[i - 1], cs[i]]); }
    const CAND = [[0, 1, 0], [0, -1, 0], [0, 0.35, 0.94], [0, 0.35, -0.94], [0, -0.35, 0.94], [0, -0.35, -0.94], [-1, 0.3, 0], [1, 0.3, 0], [-1, -0.3, 0], [1, -0.3, 0]].map(a => v3(...a).normalize());
    for (let i = 0; i < n; i++) {
      const c = atoms[cs[i]].p, used = [];
      if (i) used.push(atoms[cs[i - 1]].p.clone().sub(c).normalize()); if (i < n - 1) used.push(v3((i + 1 - (n - 1) / 2) * 5, (i + 1) % 2 ? 1.6 : -1.6, 0).sub(c).normalize());
      const pick = () => { let best = null, bs = -9; for (const q of CAND) { const s = used.length ? Math.min(...used.map(u => q.angleTo(u))) : 1; if (s > bs + 1e-6) { bs = s; best = q; } } used.push(best); return best; };
      if (d.oh[i]) {
        const up = n === 1 || i % 2 === 1, dir = v3(0, up ? 1 : -1, 0); used.push(dir);
        const op = c.clone().addScaledVector(dir, 4), oi = atoms.length; atoms.push({ p: op, r: 1.7, c: OC }); bonds.push([cs[i], oi]);
        const hp = op.clone().add(v3(1.8, up ? 1.1 : -1.1, 0.9)), hi = atoms.length; atoms.push({ p: hp, r: 1.05, c: HC }); bonds.push([oi, hi]);
        at(h.glow(0xffb547, 9, 0.45), op.x, op.y, op.z, mol);
      }
      const nh = 4 - (i > 0) - (i < n - 1) - d.oh[i];
      for (let k = 0; k < nh; k++) { const q = pick(), hi = atoms.length; atoms.push({ p: c.clone().addScaledVector(q, 3.1), r: 1.05, c: HC }); bonds.push([cs[i], hi]); }
    }
    molecule(kit, h, mol, atoms, bonds);
    if (!kit.reduce) kit.onFrame((dt, t) => { mol.rotation.y = 0.45 * Math.sin(t * 0.5); });
    const card = h.floorSticker(g, MX, ty, MZ + 19, 26, 7, d.cond + '\nt кип = ' + (d.seen ? d.bp + ' °C' : '?'), '#1b1610', '#fffaf0', 360);
    tag(v3(MX, ty + (MY - ty) * MS + 14, MZ), d.name + ' ' + d.f, d.poly ? 'групп –OH: ' + d.oh.filter(x => x).length : 'одноатомный');

    // --- штатив, пробирка, спиртовка ---
    const R = h.zone(g, 8, -6, 1.45), W = R.userData.W, TX = 0, TZ = 0, TR = 2.6, THH = 23, TY0 = ty + 14;
    const heat = d.act === 'heat';
    h.stand(R, TX, TZ - 10, 40, [{ y: TY0 + 17, to: { x: TX, z: TZ } }]);
    const tb = h.testTube(R, TX, TY0, TZ, TR, THH);
    let lvTop = 9;
    if (d.act === 'water') {
      if (d.layers) { h.tubeLiquid(tb.g, TR, 8, 0x5fb4d9, 0.45); h.tubeLayer(tb.g, TR, 8, 15, 0xf0dfa8, 0.5); at(cyl(TR * 0.9, 0.12, 0xffffff, { edges: false, hull: false }), 0, 8, 0, tb.g); }
      else h.tubeLiquid(tb.g, TR, 15, 0xa6d3ee, 0.42);
      lvTop = 15;
    } else if (d.act === 'cu') {
      if (d.poly) h.tubeLiquid(tb.g, TR, 13, 0x2563eb, 0.88);
      else {
        h.tubeLiquid(tb.g, TR, 3.2, 0x5fa8e0, 0.95); h.tubeLayer(tb.g, TR, 3.2, 13, 0xbfe0f4, 0.35);
        for (let k = 0; k < 9; k++) at(h.ball(0.35 + rnd(k) * 0.3, 0x6cb8ea, { hull: false, seg: 8, seg2: 6 }), (rnd(k + 2) - 0.5) * 3, 3.6 + rnd(k + 5) * 7, (rnd(k + 9) - 0.5) * 3, tb.g);
      }
      lvTop = 13;
    } else h.tubeLiquid(tb.g, TR, 9, 0xd7ecf7, 0.35);
    h.spirit(R, TX, ty, TZ, heat, 1, 'heat');
    let setT = null;
    if (heat) {
      // термометр в пробирке: красный столбик, голубая риска 100 °C
      const th = new T.Group(); at(th, TX + 0.9, TY0 + 1.6, TZ + 0.4, R);
      at(cyl(0.45, 34, 0xeef6fb, { edges: false, matOpt: { transparent: true, opacity: 0.5 } }), 0, 17, 0, th);
      at(h.ball(0.75, 0xe0473a, { seg: 12, seg2: 8 }), 0, 0.5, 0, th);
      const col = cyl(0.22, 1, 0xe0473a, { edges: false, hull: false }); at(col, 0, 0, 0, th);
      const K = 31 / 300, y100 = 1 + 100 * K;
      at(cyl(0.6, 0.18, 0x3aa0d8, { edges: false, hull: false }), 0, y100, 0, th);
      for (let k = 0; k <= 3; k++) at(cyl(0.52, 0.1, 0x6f8098, { edges: false, hull: false }), 0, 1 + k * 100 * K, 0, th);
      const bub = h.bubbles(tb.g, 0, 0.6, 0, 1.4, 10); const vap = h.puffs(R, TX, TY0 + THH + 1, TZ, { n: 5, spread: 4, rise: 9, size: 3.4, op: 0.5, amt: 0 });
      setT = h.liveTag(W(TX + 1, TY0 + 37, TZ), 'Термометр', '20 °C');
      kit.onFrame(() => {
        const L = live() || {}, Tc = L.T ?? 20, hgt = 1 + Tc * K;
        col.scale.y = hgt; col.position.y = 0.5 + hgt / 2;
        bub.set(L.boiling ? 1 : 0, lvTop - 0.6, 0.38, 0.9); vap.set(L.boiling ? 1 : 0);
        setT(fmt(Tc, 0) + ' °C' + (L.boiling ? ' · кипит' : ''));
      });
    }
    const res = {
      none: ['Пробирка', 'выберите опыт'],
      heat: ['Нагревание · горит спирт', 't кип = ' + d.bp + ' °C'],
      water: ['+ вода', d.layers ? 'два слоя' : 'один слой — смешался'],
      cu: ['+ Cu(OH)₂', d.poly ? 'ярко-синий раствор' : 'голубой осадок не изменился'],
    }[d.act];
    tag(W(TX + 4, ty + 3, TZ + 9), res[0], res[1], (d.act === 'water' && d.layers) || (d.act === 'cu' && d.poly));

    // --- промывалка с водой и склянка со свежим Cu(OH)₂ ---
    const wb = new T.Group(); at(wb, 32, ty, -8, g); wb.scale.setScalar(1.3); clickable(wb, 'water');
    at(cyl(4, 11, 0xf4f7fb, { matOpt: { transparent: true, opacity: 0.78 } }), 0, 5.5, 0, wb);
    const wl = h.liquid(wb, 0, 0.3, 0, 3.7, 0x8fc6ea, 0.55); wl.set(7);
    at(cyl(1.6, 2, 0xe0473a), 0, 12, 0, wb);
    h.rodAB(wb, v3(0, 12.6, 0), v3(0, 16, 0), 0.35, 0xf4f7fb); h.rodAB(wb, v3(0, 16, 0), v3(-4, 13.5, 0), 0.32, 0xf4f7fb);
    const ws = h.sticker(5.4, 2.6, 'H₂O'); at(ws, 0, 5, 4.06, wb);
    if (d.act === 'water') h.halo(wb, 0, 1, 0, 18);
    const cu = h.bottle(g, 47, ty, -8, { r: 3.6, h: 9, liq: 0x4a9be0, lop: 0.85, fill: 0.55, cap: 0x3b6fd8, label: 'Cu(OH)₂' });
    cu.g.scale.setScalar(1.3); clickable(cu.g, 'cu');
    if (d.act === 'cu') h.halo(cu.g, 0, 1, 0, 18);
    // карточка целей
    const G = [['bp', 'кипит выше 100 °C'], ['layers', 'не смешался с водой'], ['blue', 'многоатомный']];
    h.floorSticker(g, 36, ty, 24, 40, 13, G.map(([k, s]) => (d.got[k] ? '✓ ' : '· ') + s).join('\n'), '#1b1610', '#eef7ee', 420);
  };

  // ===== 2. Альдегиды: штатив с пробирками A, B, C, проба в водяной бане, реактивы, бирки =====
  SC['chor-ald'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const ty = h.tray(g, 0, 2, 124, 80);
    // --- деревянный штатив для пробирок ---
    const R1 = h.zone(g, -34, -6, 1.3), RX = 0, RZ = 0, XS = [-11, 0, 11];
    at(box(36, 1.4, 10, C.WOOD2), RX, ty + 0.7, RZ, R1);
    at(box(36, 1.2, 10, C.WOOD), RX, ty + 9, RZ, R1);
    for (const sx of [-17, 17]) at(box(1.4, 9, 9, C.WOOD2), RX + sx, ty + 4.9, RZ, R1);
    XS.forEach((dx, i) => {
      const sel = d.sel === i, tg = new T.Group(); at(tg, RX + dx, ty + 1.6 + (sel ? 5 : 0), RZ, R1); clickable(tg, 't' + i);
      const tb = h.testTube(tg, 0, 0, 0, 2.3, 20); h.tubeLiquid(tb.g, 2.3, 8, 0xd7ecf7, 0.35);
      const lt = h.sticker(2.8, 2.6, 'ABC'[i], '#1b1610', sel ? '#ffd166' : '#fffaf0', 96); at(lt, 0, 14, 2.4, tg);
      if (d.labs[i]) { const s = h.sticker(7.2, 2.4, d.labs[i], '#1b1610', '#e8f3ff', 220); at(s, 0, 17.6, 2.45, tg); }
      if (sel) h.halo(tg, 0, 6, 0, 14);
    });
    tag(R1.userData.W(RX - 6, ty + 3, RZ + 8), 'Пробирка ' + 'ABC'[d.sel], d.cur ? 'бирка: ' + d.cur : 'без подписи');
    // --- проба: водяная баня на треноге над спиртовкой или пробирка в держателе ---
    const R2 = h.zone(g, 10, -6, 1.3), W = R2.userData.W, SX = 0, SZ = 0, heat = d.rg === 'cut' || d.rg === 'ag', TR = 2.6;
    let tubeG, tubeY0;
    h.stand(R2, SX - 8, SZ - 12, 46, [{ y: heat ? ty + 34 : ty + 21, to: { x: SX, z: SZ } }]);
    if (heat) {
      // тренога с сеткой, стакан с водой
      const gy = ty + 15.5;
      for (let k = 0; k < 3; k++) { const a = k * 2.094 + 0.5; h.rodAB(R2, v3(SX + Math.cos(a) * 10, ty, SZ + Math.sin(a) * 10), v3(SX + Math.cos(a) * 8, gy, SZ + Math.sin(a) * 8), 0.4, C.DARK); }
      const rg = kit.mesh(new T.TorusGeometry(8, 0.45, 6, 32), C.DARK, { edges: false }); rg.rotation.x = Math.PI / 2; at(rg, SX, gy, SZ, R2);
      at(box(17, 0.3, 17, 0x8b96ad, { edges: false }), SX, gy + 0.45, SZ, R2);
      at(cyl(4, 0.32, 0xe8ecf4, { edges: false, hull: false }), SX, gy + 0.65, SZ, R2);
      h.spirit(R2, SX, ty, SZ, !d.done, 0.95);
      h.beaker(R2, SX, gy + 0.6, SZ, 7, 14);
      const wq = h.liquid(R2, SX, gy + 1.2, SZ, 6.6, 0x9fd0ee, 0.35); wq.set(9.5);
      const st = h.puffs(R2, SX, gy + 11, SZ, { n: 6, spread: 9, rise: 10, size: 4, op: 0.45, amt: d.done ? 0 : 1 });
      tubeY0 = gy + 2.4;
      const bw = h.bubbles(R2, SX + 3.2, gy + 1.2, SZ, 2, 8); bw.set(d.done ? 0 : 0.8, 8.5, 0.4, 0.9);
    } else {
      at(box(9, 5, 9, C.WOOD2), SX, ty + 2.5, SZ, R2);
      h.spirit(R2, SX + 15, ty, SZ + 6, false, 0.8);
      tubeY0 = ty + 1.4;
    }
    tubeG = new T.Group(); at(tubeG, SX, tubeY0, SZ, R2);
    h.testTube(tubeG, 0, 0, 0, TR, 26);
    const LV = 11;
    let upd = null;
    if (d.rg) {
      const sub = d.sub, rg = d.rg;
      if (rg === 'ag') {
        const lq = h.tubeLiquid(tubeG, TR, LV, 0xd7ecf7, 0.3);
        if (sub === 2) {
          // серебро оседает на стенке, куда доставал раствор
          const mir = new T.Mesh(kit.keep(new T.CylinderGeometry(TR * 0.95, TR * 0.95, LV + 1.5 - TR, 28, 1, true)), h.ownMat(0xdfe4ea, { transparent: true, opacity: 0, side: T.DoubleSide, emissive: 0x9aa3af, emissiveIntensity: 0.35 }));
          at(mir, 0, TR + (LV + 1.5 - TR) / 2, 0, tubeG);
          const mb = new T.Mesh(kit.keep(new T.SphereGeometry(TR * 0.95, 24, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), mir.material); at(mb, 0, TR, 0, tubeG);
          const shine = box(0.5, LV - 3, 0.1, 0xffffff, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0 } }); at(shine, -0.9, TR + (LV - 3) / 2 + 0.5, TR + 0.05, tubeG);
          upd = ph => { mir.material.opacity = 0.97 * ph; shine.material.opacity = 0.8 * ph; };
        }
      } else {
        const blue = 0x6cb8ea;
        if (sub === 1) {
          const lq = h.tubeLiquid(tubeG, TR, LV, 0x2563eb, 0.4);
          upd = ph => { lq.mat.color.copy(mixC(T, 0x9fd0f0, 0x2563eb, ph)); lq.mat.opacity = 0.4 + 0.5 * ph; };
        } else {
          const pr = h.tubeLiquid(tubeG, TR, 3.4, blue, 0.95); const top = h.tubeLayer(tubeG, TR, 3.4, LV, 0xbfe0f4, 0.3);
          if (rg === 'cut') upd = ph => {
            if (sub === 0) pr.mat.color.copy(mixC(T, blue, 0x232326, (ph - 0.25) / 0.5));
            else { pr.mat.color.copy(ph < 0.5 ? mixC(T, blue, 0xe3c449, (ph - 0.15) / 0.35) : mixC(T, 0xe3c449, 0xb5442c, (ph - 0.5) / 0.35)); top.mat.color.copy(mixC(T, 0xbfe0f4, 0xe9e1c8, ph)); }
          };
        }
      }
      if (upd) { const f = upd; kit.onFrame(() => { const L = live() || {}; f(kit.reduce ? 1 : clamp(L.ph ?? 1, 0, 1)); }); }
      const bub = heat && !d.done ? h.bubbles(tubeG, 0, 0.6, 0, 1.3, 6) : null; if (bub) bub.set(0.7, LV - 0.6, 0.3, 0.8);
      const RG = { cu: 'Cu(OH)₂', cut: 'Cu(OH)₂ + t', ag: 'Ag₂O (NH₃) + t' };
      tag(W(SX + 2, tubeY0 + 30, SZ), 'Проба ' + 'ABC'[d.sel] + ' + ' + RG[rg], d.done ? ({ cu: sub === 1 ? 'ярко-синий раствор' : 'осадок не изменился', cut: sub === 1 ? 'синий, осадка нет' : sub === 0 ? 'осадок почернел: CuO' : 'кирпично-красный Cu₂O', ag: sub === 2 ? 'серебряное зеркало' : 'без изменений' })[rg] : 'идёт опыт…', d.done && ((rg === 'ag' && sub === 2) || (rg === 'cut' && sub === 2) || (rg === 'cu' && sub === 1)));
    } else tag(W(SX + 2, tubeY0 + 30, SZ), 'Пробирка для пробы', 'выберите реактив');
    // --- реактивы ---
    const R3 = [{ k: 'r-cu', lab: 'Cu(OH)₂', liq: 0x4a9be0, cap: 0x3b6fd8, x: 31 }, { k: 'r-cut', lab: 'Cu(OH)₂\n+ нагрев', liq: 0x4a9be0, cap: 0xe0473a, x: 42 }, { k: 'r-ag', lab: 'Ag₂O\n+ NH₃', liq: 0xe8eef4, cap: 0x2c3240, x: 53, glass: 0x8a5a2b }];
    R3.forEach(r => {
      const b = h.bottle(g, r.x, ty, -12, { r: 3.8, h: 10, liq: r.liq, lop: 0.8, fill: 0.55, cap: r.cap, glass: r.glass, op: r.glass ? 0.6 : 0.32, label: r.lab, lh: 4.6 });
      b.g.scale.setScalar(1.15); clickable(b.g, r.k); if (d.rg === r.k.slice(2)) h.halo(b.g, 0, 1, 0, 16);
    });
    // --- бирки для подписи выбранной пробирки ---
    d.names.forEach((nm, k) => {
      const lb = new T.Group(); at(lb, -30 + k * 18, ty, 24, g); clickable(lb, 'l' + k);
      at(box(15, 0.8, 6, d.cur === nm ? 0xffd166 : 0xe8f3ff), 0, 0.4, 0, lb);
      const s = h.flat(13.6, 4.6, kit.textTex(nm, '#1b1610', d.cur === nm ? '#ffd166' : '#e8f3ff', 256, 86)); s.rotation.x = -Math.PI / 2; at(s, 0, 0.82, 0, lb);
      at(cyl(0.6, 0.3, 0x8b96ad, { edges: false }), -6.4, 0.95, 0, lb);
    });
    const done = d.right === 3;
    tag(v3(-12, ty + 6, 24), 'Бирки', d.labelled === 3 ? (done ? 'все верно ✓' : 'есть ошибка') : 'подписано ' + d.labelled + ' из 3', done);
  };

  // ===== 3. Карбоновые кислоты: весы с содой, колба с уксусом и шариком, лакмус =====
  SC['chor-acid'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const ty = h.tray(g, 0, 2, 124, 80);
    // --- электронные весы и часовое стекло с содой ---
    const BX = -36, BZ = 2, sg = new T.Group(); at(sg, BX, ty, BZ, g);
    at(box(26, 4, 22, 0xe8ecf4), 0, 2, 0, sg);
    at(box(26, 0.6, 7, 0xcfd6df), 0, 4.3, 7.5, sg);
    at(cyl(7.5, 0.6, C.STEEL), 0, 4.3, -3.5, sg);
    const scr = h.screen(12, 3.4, d.mst + ' г', '#86e0a8', 320, 90); at(scr, 0, 2.2, 11.06, sg);
    [['s--', '−1', 0xe0473a], ['s-', '−0,1', 0xe58a6a], ['s+', '+0,1', 0x6fbf73], ['s++', '+1', 0x3fae5a]].forEach(([k, l, c], i) => h.button(sg, -9.3 + i * 6.2, 4.6, 7.5, l, c, k, 5.4, 4.6));
    const dish = kit.mesh(new T.SphereGeometry(7, 28, 8, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.38), 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.45, side: T.DoubleSide } });
    at(dish, 0, 11.7, -3.5, sg);
    if (d.st === 'none' && d.ms > 0) {
      const r = 1.6 + Math.sqrt(d.ms) * 1.3;
      at(cyl(r, r * 0.6, 0xf7f8fa, { r2: 0.3 }), 0, 4.8 + r * 0.3, -3.5, sg);
    }
    tag(v3(BX, ty + 16, BZ - 3), 'Сода NaHCO₃', d.mst + ' г');
    // --- колба с уксусом, шарик на горле ---
    const FX = 6, FZ = -4, R = 12, HB = 17, RN = 2.7, HN = 7;
    const fl = h.erlen(g, FX, ty, FZ, R, HB, RN, HN); clickable(fl.g, 'flask');
    const lvl = 2 + d.mv * 0.085;
    const lq = h.liquid(fl.g, 0, 0.3, 0, fl.rAt(0.5) - 0.7, 0xeed99a, 0.55, fl.rAt(lvl) - 0.5); lq.set(lvl - 0.3);
    const foam = h.liquid(fl.g, 0, lvl, 0, fl.rAt(lvl) - 0.5, 0xfbf7ec, 0.85, fl.rAt(lvl + 4) - 0.5); foam.set(0);
    const bub = h.bubbles(fl.g, 0, 0.6, 0, 7, 22); bub.set(0, lvl, 0.5, 0.9);
    const exS = d.st === 'done' && d.exS;
    if (exS) at(cyl(3 + Math.sqrt(parseFloat(d.exS.replace(',', '.'))) * 1.5, 1.4, 0xf7f8fa, { r2: 1.5 }), 0, 1.0, 0, fl.g);
    const ny = fl.top;
    at(cyl(RN + 0.55, 1.6, 0xd94a3a, { edges: false }), 0, ny - 0.6, 0, fl.g);
    const bal = new T.Group(); at(bal, 0, ny, 0, fl.g);
    const bm = h.ball(1, 0xff5c5c, { seg: 24, seg2: 16, matOpt: { transparent: true, opacity: 0.9 } }); bal.add(bm);
    const knot = cyl(0.9, 1.6, 0xd94a3a, { edges: false, r2: 0.6 }); bal.add(knot);
    if (d.st === 'none') { bal.rotation.z = -2.2; bm.scale.set(2, 3.4, 2); bm.position.y = 2.8; knot.position.y = 0.6; }
    const Vfull = d.Vmax;
    const setV = h.liveTag(v3(FX, ty + HB + HN + 14, FZ), 'Шарик: CO₂', d.st === 'none' ? 'пустой' : d.V + ' л', d.st === 'done' && d.ok);
    kit.onFrame((dt, t) => {
      const L = live() || {}, p = d.st === 'none' ? 0 : d.st === 'done' ? 1 : (L.p ?? 0), V = d.st === 'done' ? Vfull : (L.V ?? 0);
      if (d.st !== 'none') {
        const Rb = 2.4 + 8 * Math.sqrt(Math.max(0, V) / 2.6);
        bm.scale.set(Rb, Rb * 1.12, Rb); bm.position.y = Rb * 1.05; knot.position.y = 0.6;
        setV(fmt(V, 2) + ' л');
      }
      const run = d.st === 'run';
      foam.set(run ? 4 * (1 - p) + 0.6 : 0, lvl); bub.set(run ? 1 : 0, lvl, 0.55, 1.2);
    });
    const txt = d.st === 'none' ? 'нажмите — смешать' : d.st === 'run' ? 'шипит: выделяется CO₂' : d.ok ? 'прореагировало всё ✓' : d.exA ? 'осталась кислота ' + d.exA + ' г' : 'осталась сода ' + d.exS + ' г';
    tag(v3(FX + 4, ty + 3, FZ + 15), 'Колба: уксус 9 % · ' + d.mv + ' г', txt, d.st === 'done' && d.ok);
    // --- склянка с уксусом и кнопки ---
    const vb = h.bottle(g, 38, ty, -14, { r: 4.2, h: 12, liq: 0xf2e3a8, lop: 0.5, fill: 0.7, cap: 0xe0a33a, label: 'Уксус\n9 %', lh: 4.8 });
    clickable(vb.g, 'v+');
    h.button(g, 33, ty, -2, '−10', 0xe0473a, 'v-', 6, 4.4); h.button(g, 41, ty, -2, '+10', 0x3fae5a, 'v+', 6, 4.4);
    // --- лакмусовая бумажка на плитке ---
    const lit = d.st === 'none' || d.st === 'run' || d.exA ? 0xe0473a : d.exS ? 0x3b6fd8 : 0x8a5ab8;
    at(box(22, 0.6, 14, 0xffffff), 38, ty + 0.3, 20, g);
    at(box(3.6, 0.15, 11, 0xf2ead8, { edges: false }), 32, ty + 0.68, 20, g);
    at(box(3.6, 0.17, 6, lit, { edges: false }), 32, ty + 0.7, 22.5, g);
    at(cyl(1.6, 0.4, lit, { edges: false, matOpt: { transparent: true, opacity: 0.7 } }), 32, ty + 0.75, 15.5, g);
    h.floorSticker(g, 42, ty + 0.6, 20, 11, 4.2, 'лакмус', '#1b1610', '#fffaf0', 160);
    tag(v3(32, ty + 4, 21), 'Лакмус', d.st === 'none' || d.st === 'run' || d.exA ? 'красный: кислота' : d.exS ? 'синий: избыток соды' : 'фиолетовый: нейтрально', d.st === 'done' && d.ok);
  };

  // фруктовые значки запаха
  function fruitIcon(kit, h, parent, smell) {
    const { T, at, cyl } = kit, f = new T.Group(); parent.add(f);
    if (/банан/.test(smell)) {
      const b = kit.mesh(new T.TorusGeometry(2.6, 0.75, 10, 20, Math.PI * 0.75), 0xf2cf3a, { hull: true, edges: false }); b.rotation.z = Math.PI * 1.1; at(b, 0, 1.5, 0, f);
      at(cyl(0.3, 0.8, 0x5a4a2a, { edges: false }), -1.4, -0.4, 0, f);
    } else if (/ананас/.test(smell)) {
      const b = h.ball(1.8, 0xd9a23a, { seg: 16, seg2: 12 }); b.scale.y = 1.4; at(b, 0, 0, 0, f);
      for (let k = 0; k < 5; k++) { const l = cyl(0.5, 2.6, 0x3fae5a, { r2: 0.02, edges: false }); l.rotation.z = (k - 2) * 0.35; at(l, (k - 2) * 0.35, 3.4, 0, f); }
    } else if (/яблок/.test(smell)) {
      at(h.ball(2, 0xd94a3a, { seg: 16, seg2: 12 }), 0, 0, 0, f); at(cyl(0.2, 1.2, 0x5a4a2a, { edges: false }), 0, 2.2, 0, f);
    } else if (/фрукт|груш/.test(smell)) {
      at(h.ball(1.8, 0x9ccf4a, { seg: 16, seg2: 12 }), 0, -0.3, 0, f); at(h.ball(1.2, 0x9ccf4a, { seg: 14, seg2: 10 }), 0, 1.6, 0, f);
    } else return null;
    return f;
  }
  // волнистые струйки запаха над пробиркой
  function aroma(kit, parent, x, y, z) {
    const { T, at, keep } = kit, g = new T.Group(), ls = []; at(g, x, y, z, parent);
    for (let k = 0; k < 3; k++) {
      const pts = []; for (let i = 0; i <= 20; i++) pts.push(new T.Vector3((k - 1) * 1.8 + 0.8 * Math.sin(i * 0.6 + k), i * 0.45, 0));
      const m = new T.Mesh(keep(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 40, 0.18, 6)), keep(new T.MeshBasicMaterial({ color: 0x86c06a, transparent: true, opacity: 0.8, depthWrite: false })));
      g.add(m); ls.push(m);
    }
    kit.onFrame((dt, t) => ls.forEach((m, k) => { const ph = kit.reduce ? 0.5 : (t * 0.35 + k / 3) % 1; m.position.y = ph * 3; m.material.opacity = 0.85 * Math.sin(Math.PI * ph); }));
    return g;
  }

  // ===== 4. Сложные эфиры (колба на спиртовке) и жиры (модель триглицерида, стакан, NaOH) =====
  SC['chor-est'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const ty = h.tray(g, 0, 2, 124, 80);
    h.modeSign(g, 34, ty, 30, 'Эфиры', d.mode === 'ester', 'm-ester'); h.modeSign(g, 49, ty, 30, 'Жиры', d.mode === 'fat', 'm-fat');
    const G = ['банан', 'ананас', 'масло', 'мыло'];
    h.floorSticker(g, -38, ty, 30, 34, 5.6, 'Цели: ' + G.map((s, i) => (d.gk[i] ? '✓' : '·') + s).join(' '), '#1b1610', '#eef7ee', 440);
    if (d.mode === 'ester') {
      // склянки кислоты и спирта, капельница с H₂SO₄
      const ab = h.bottle(g, -46, ty, -10, { r: 4.4, h: 12, liq: 0xf0e2b8, lop: 0.5, fill: 0.6, glass: 0x9a6a3a, op: 0.55, cap: 0x2c3240, label: d.acid + '\n' + d.acidN, lh: 5 });
      clickable(ab.g, 'acid');
      const lb = h.bottle(g, -32, ty, -10, { r: 4.4, h: 12, liq: 0xcfe6f6, lop: 0.4, fill: 0.6, cap: 0x3b6fd8, label: d.alc + '\n' + d.alcN.replace(' спирт', ''), lh: 5 });
      clickable(lb.g, 'alc');
      const hs = h.bottle(g, -38, ty, 10, { r: 2.6, h: 6, liq: 0xf4f1e6, lop: 0.4, fill: 0.5, cap: 0xe0473a, label: 'H₂SO₄', lh: 2 });
      at(cyl(0.9, 3, 0x2c3240, { r2: 0.4 }), -38, ty + hs.top + 1.2, 10, g);
      tag(v3(-39, ty + 24, -10), d.acid + ' + ' + d.alc, 'кислота + спирт');
      // колба с обратным воздушным холодильником над спиртовкой
      const R = h.zone(g, 6, -6, 1.3), W = R.userData.W, FX = 0, FZ = 0, Rf = 7.5, FY = ty + 14;
      const run = d.syn === 'run', done = d.syn === 'done';
      h.stand(R, FX - 6, FZ - 11, 50, [{ y: FY + 17, to: { x: FX, z: FZ } }]);
      const fk = h.flask(R, FX, FY, FZ, Rf, 6); clickable(fk.g, 'syn');
      const tube = h.glassy(new T.CylinderGeometry(0.9, 0.9, 22, 16, 1, true)); at(tube, 0, fk.top + 11, 0, fk.g);
      const lmat = h.ownMat(0xd7ecf7, { transparent: true, opacity: 0.45, depthWrite: false });
      const lb2 = new T.Mesh(kit.keep(new T.SphereGeometry(Rf * 0.92, 28, 14, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45)), lmat); at(lb2, 0, Rf, 0, fk.g);
      const yTop = Rf - Rf * 0.92 * Math.cos(Math.PI * 0.45), rTop = Rf * 0.92 * Math.sin(Math.PI * 0.45);
      at(new T.Mesh(kit.keep(new T.CircleGeometry(rTop, 28)), lmat), 0, Rf + Rf * 0.92 * Math.cos(Math.PI * 0.55), 0, fk.g).rotation.x = -Math.PI / 2;
      const est = new T.Mesh(kit.keep(new T.CylinderGeometry(rTop * 0.98, rTop * 0.92, 1.4, 28)), h.ownMat(0xf3dc95, { transparent: true, opacity: 0, depthWrite: false }));
      at(est, 0, Rf + Rf * 0.92 * Math.cos(Math.PI * 0.55) - 0.6, 0, fk.g);
      h.spirit(R, FX, ty, FZ, run, 1);
      const bub = h.bubbles(fk.g, 0, 1.2, 0, 3.5, 12); const vap = h.puffs(fk.g, 0, fk.top + 22, 0, { n: 4, spread: 3, rise: 6, size: 2.6, op: 0.4, amt: 0 });
      kit.onFrame(() => {
        const L = live() || {}, p = done ? 1 : run ? (L.syn ?? 0) : 0;
        est.material.opacity = 0.85 * p; bub.set(run ? 1 : 0, 5.6, 0.4, 0.9); vap.set(run ? 0.8 : 0);
      });
      tag(W(FX + 2, fk.top + FY + 24, FZ), 'Нагрев с H₂SO₄', run ? 'идёт синтез…' : done ? 'эфир готов' : 'нажмите на колбу', done);
      // продукт: пробирка с пробкой, запах
      const PX = 36, PZ = -2;
      at(box(14, 1.2, 8, C.WOOD2), PX, ty + 0.6, PZ, g);
      const pt = h.testTube(g, PX, ty + 1.2, PZ, 2.4, 18);
      if (done) {
        h.tubeLiquid(pt.g, 2.4, 5, 0xd7ecf7, 0.35); h.tubeLayer(pt.g, 2.4, 5, 9, 0xf3dc95, 0.85);
        aroma(kit, g, PX, ty + 21, PZ);
        const ic = fruitIcon(kit, h, g, d.smell); if (ic) { ic.scale.setScalar(1.7); ic.position.set(PX + 12, ty + 16, PZ); if (!kit.reduce) kit.onFrame((dt, t) => { ic.rotation.y = t * 0.8; }); }
        tag(v3(PX + 4, ty + 4, PZ + 10), d.ef + ' · ' + d.en, 'запах: ' + d.smell, true);
      } else tag(v3(PX + 4, ty + 4, PZ + 10), 'Продукт', 'появится здесь');
      h.floorSticker(g, 2, ty, 18, 54, 6, d.acid + ' + ' + d.alc + ' ⇄ ' + d.ef + ' + H₂O', '#1b1610', '#fffaf0', 560);
      return;
    }
    // ---- жиры: модель триглицерида ----
    const F = h.zone(g, -50, -8, 1.25), MX = 0, MZ = 0, YS = [ty + 29, ty + 20, ty + 11];
    at(box(58, 1.4, 12, C.WOOD2), MX + 26, ty + 0.7, MZ, F);
    at(cyl(0.45, 28, C.STEEL, { edges: false }), MX, ty + 1.4 + 14, MZ - 3.2, F);
    for (const y of [YS[0], YS[2]]) h.rodAB(F, v3(MX, y, MZ - 3.2), v3(MX, y, MZ - 1.2), 0.35, C.STEEL);
    const gl = [];
    YS.forEach((y, r) => {
      const fa = d.fa[r], tg = new T.Group(); at(tg, 0, 0, 0, F); clickable(tg, 'fa' + r);
      const atoms = [{ p: v3(MX, y, MZ), r: 1.8, c: CC }, { p: v3(MX + 4, y, MZ), r: 1.4, c: OC }, { p: v3(MX + 8, y, MZ), r: 1.6, c: CC }, { p: v3(MX + 8, y + 3.6, MZ), r: 1.3, c: OC }];
      const bonds = [[0, 1], [1, 2], [2, 3, true, 0xc8d1e2]];
      // хвост: зигзаг, у двойных связей излом
      const N = Math.min(16, fa.C - 1), kinks = fa.db === 0 ? [] : fa.db === 1 ? [7] : [7, 10];
      let bx = MX + 8, bz = 0, ang = 0, prev = 2;
      for (let k = 0; k < N; k++) {
        if (kinks.includes(k)) ang += 0.45;
        bx += 2.6 * Math.cos(ang); bz += 2.6 * Math.sin(ang);
        const zz = k % 2 ? 0.9 : -0.9, i = atoms.length;
        atoms.push({ p: v3(bx, y + zz, MZ + bz), r: 1.05, c: CC });
        bonds.push([prev, i, kinks.includes(k), kinks.includes(k) ? 0x72d4e8 : undefined]); prev = i;
      }
      molecule(kit, h, tg, atoms, bonds);
      const s = h.sticker(13, 2.6, fa.name, fa.db ? '#0b5f7a' : '#1b1610', fa.db ? '#dff5fb' : '#fffaf0', 260); at(s, MX + 19, y - 3.4, MZ + 1.6, tg);
      gl.push(atoms[0].p);
    });
    h.rodAB(F, gl[0], gl[2], 0.5, 0xc8d1e2);
    tag(F.userData.W(MX + 20, ty + 37, MZ), d.ff + ' · M ' + d.M, 'непредельных остатков: ' + d.uns, d.liquid);
    // стакан: жир, масло или мыло с глицерином
    const BX = 30, BZ = -6, bk = h.beaker(g, BX, ty, BZ, 8.5, 16); clickable(bk.g, 'build');
    if (d.soap) {
      const q = h.liquid(g, BX, ty + 0.6, BZ, 8, 0xdfeedd, 0.4); q.set(7);
      const sb = box(9, 3.4, 5.6, 0xa8d8b9); at(sb, BX, ty + 8.4, BZ, g);
      const sl = h.flat(7, 2.4, kit.textTex('мыло', '#1b1610', '#a8d8b9', 160, 56)); at(sl, BX, ty + 8.4, BZ + 2.82, g);
      const fb = h.bubbles(g, BX, ty + 6.5, BZ, 6, 14); fb.set(1, 5, 0.6, 0.25);
      tag(v3(BX, ty + 22, BZ), 'Омыление', 'мыло + глицерин', true);
    } else if (d.built) {
      if (d.liquid) {
        const q = h.liquid(g, BX, ty + 0.6, BZ, 8, 0xe9c46a, 0.7); q.set(8);
        if (!kit.reduce) kit.onFrame((dt, t) => { q.m.rotation.z = 0.02 * Math.sin(t * 2); });
      } else { at(cyl(7.9, 7.4, 0xf1ead2, { edges: false }), BX, ty + 4.3, BZ, g); }
      tag(v3(BX, ty + 22, BZ), 'Жир при 20 °C', d.liquid ? 'жидкий — масло' : 'твёрдый', d.liquid);
    } else tag(v3(BX, ty + 22, BZ), 'Стакан', 'нажмите — собрать жир');
    // щёлочь
    const nb = h.bottle(g, 48, ty, -10, { r: 3.8, h: 10, liq: 0xf2f4f8, lop: 0.4, fill: 0.6, cap: 0x2c3240, label: 'NaOH', lh: 2.6 });
    clickable(nb.g, 'sap');
    h.floorSticker(g, 0, ty, 18, 56, 6, d.soap ? 'жир + 3NaOH → глицерин + 3 соли (мыло)' : 'глицерин + 3 кислоты → жир + 3H₂O', '#1b1610', '#fffaf0', 560);
  };

  // =====================================================================================
  // ПОЛИМЕРЫ
  // =====================================================================================

  // ===== 5. Пластмассы: банки с мономерами, образцы, растущая цепь-модель, табло n и M =====
  SC['chor-poly'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const ty = h.tray(g, 0, 2, 124, 80);
    const cur = d.monos.find(m => m.k === d.mono);
    // заместитель: шарик или кольцо бензола
    const subst = (parent, X, col, p, s = 1) => {
      if (!X) { at(h.ball(0.9 * s, HC, { seg: 10, seg2: 8 }), p.x, p.y, p.z, parent); return; }
      if (X === 'C₆H₅') { const r = kit.mesh(new T.TorusGeometry(1.5 * s, 0.45 * s, 8, 6), col, { hull: true, edges: false }); at(r, p.x, p.y + 0.6 * s, p.z, parent); return; }
      at(h.ball((X === 'Cl' ? 1.5 : 1.3) * s, col, { seg: 14, seg2: 10 }), p.x, p.y, p.z, parent);
    };
    // мономер: C=C с заместителем
    const monoModel = (parent, M, s = 1) => {
      at(h.ball(1.2 * s, CC, { seg: 12, seg2: 8 }), -1.6 * s, 0, 0, parent); at(h.ball(1.2 * s, CC, { seg: 12, seg2: 8 }), 1.6 * s, 0, 0, parent);
      h.rodAB(parent, v3(-1.6 * s, 0.4 * s, 0), v3(1.6 * s, 0.4 * s, 0), 0.25 * s, 0x72d4e8); h.rodAB(parent, v3(-1.6 * s, -0.4 * s, 0), v3(1.6 * s, -0.4 * s, 0), 0.25 * s, 0x72d4e8);
      h.rodAB(parent, v3(1.6 * s, 0, 0), v3(2.4 * s, 2 * s, 0), 0.22 * s, 0xc8d1e2); subst(parent, M.X, M.c, v3(2.4 * s, 2.4 * s, 0), s);
    };
    // --- банки с мономерами и образцы изделий ---
    const SAMPLE = {
      eth: p => { const b = box(7, 0.4, 8, 0xeef4fb, { matOpt: { transparent: true, opacity: 0.75 } }); b.rotation.set(0.15, 0.3, 0.08); at(b, 0, 1, 0, p); const b2 = box(5, 0.4, 5, 0xeef4fb, { matOpt: { transparent: true, opacity: 0.75 } }); b2.rotation.set(-0.2, -0.4, 0.1); at(b2, 0.8, 1.6, -0.6, p); },
      pro: p => { at(box(7, 3.6, 5.6, 0xf6efe0, { matOpt: { transparent: true, opacity: 0.85 } }), 0, 1.8, 0, p); at(box(7.4, 0.7, 6, 0xffb547), 0, 3.95, 0, p); },
      vc: p => { const t = cyl(1.8, 8, 0x9aa3b5, { seg: 20 }); t.rotation.z = Math.PI / 2; at(t, 0, 1.8, 0, p); const e = cyl(1.2, 8.1, 0x3b4150, { edges: false, hull: false, seg: 16 }); e.rotation.z = Math.PI / 2; at(e, 0, 1.8, 0, p); },
      sty: p => { at(cyl(2.6, 6, 0xffffff, { r2: 2.6, seg: 20 }), 0, 3, 0, p); at(cyl(2.4, 0.2, 0xe8ecf4, { r2: 1.8, edges: false, hull: false }), 0, 6.05, 0, p); at(cyl(1.7, 6, 0xffffff, { r2: 2.6, edges: false, hull: false, seg: 20 }), 0, 3, 0, p); },
    };
    d.monos.forEach((M, i) => {
      const x = -48 + i * 13, sel = M.k === d.mono, jg = new T.Group(); at(jg, x, ty, -22, g); clickable(jg, 'mo-' + M.k);
      const jw = h.glassy(new T.CylinderGeometry(4.6, 4.6, 12, 28, 1, true), 0xd8eef8, 0.22); at(jw, 0, 6, 0, jg);
      at(cyl(4.6, 0.5, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.5 } }), 0, 0.25, 0, jg);
      at(cyl(4.9, 1.6, M.c), 0, 12.8, 0, jg);
      for (let k = 0; k < 3; k++) { const mg = new T.Group(); at(mg, (k - 1) * 1.6, 2.4 + k * 3, (k % 2 ? 1 : -1) * 0.8, jg); mg.rotation.set(rnd(k + i) * 2, rnd(k + 7) * 3, 0); monoModel(mg, M, 0.55); }
      const s = h.sticker(8, 3.6, M.ab + '\n' + M.name, '#1b1610', sel ? '#ffd166' : '#fffaf0', 200); at(s, 0, 8.6, 4.66, jg);
      const sp = new T.Group(); at(sp, x, ty, -6, g); clickable(sp, 'mo-' + M.k); SAMPLE[M.k](sp);
      if (sel) { h.halo(jg, 0, 1, 0, 18); h.halo(sp, 0, 1, 0, 14); }
    });
    tag(v3(-48 + d.monos.findIndex(m => m.k === d.mono) * 13, ty + 20, -22), 'Мономер ' + cur.name, d.f);
    // --- цепь на подставке ---
    const CZ = h.zone(g, -14, 12, 1.25), X0 = 0, Y0 = ty + 12, Z0 = 0, DX = 3.4;
    at(box(54, 1.4, 10, C.WOOD2), 24, ty + 0.7, Z0, CZ);
    for (const x of [8, 40]) at(cyl(0.4, Y0 - ty - 2, C.STEEL, { edges: false }), x, ty + 1.4 + (Y0 - ty - 2) / 2, Z0, CZ);
    const chain = new T.Group(); at(chain, 0, 0, 0, CZ);
    at(h.ball(1.4, 0x5a6680, { seg: 14, seg2: 10 }), X0 - 3, Y0 - 1, Z0, chain);
    const rt = h.flat(2, 2, kit.textTex('R', '#ffffff', '#5a6680', 64, 64)); at(rt, X0 - 3, Y0 - 1, Z0 + 1.45, chain);
    const prevN = mem.poly && mem.poly.mono === d.mono ? mem.poly.n : d.chain; mem.poly = { mono: d.mono, n: d.chain };
    const units = [];
    let last = v3(X0 - 3, Y0 - 1, Z0);
    for (let u = 0; u < d.chain; u++) {
      const ug = new T.Group(); at(ug, 0, 0, 0, chain); units.push(ug);
      const a = v3(X0 + u * 2 * DX, Y0 + 1.2, Z0), b = v3(X0 + (u * 2 + 1) * DX, Y0 - 1, Z0);
      h.rodAB(ug, last, a, 0.35, 0xc8d1e2); h.rodAB(ug, a, b, 0.35, 0xc8d1e2);
      at(h.ball(1.2, CC, { seg: 12, seg2: 8 }), a.x, a.y, a.z, ug); at(h.ball(1.2, CC, { seg: 12, seg2: 8 }), b.x, b.y, b.z, ug);
      h.rodAB(ug, b, v3(b.x, b.y - 2.4, b.z + 1.2), 0.25, 0xc8d1e2); subst(ug, cur.X, cur.c, v3(b.x, b.y - 3.2, b.z + 1.6));
      last = b;
    }
    // скобки звена и активный конец
    if (d.chain) {
      for (const sx of [X0 - 1.6, X0 + DX + 1.7]) { at(box(0.35, 8, 0.35, 0xffb547, { edges: false }), sx, Y0 - 1.4, Z0 + 2.6, chain); at(box(1, 0.35, 0.35, 0xffb547, { edges: false }), sx + (sx < X0 ? 0.5 : -0.5), Y0 + 2.4, Z0 + 2.6, chain); at(box(1, 0.35, 0.35, 0xffb547, { edges: false }), sx + (sx < X0 ? 0.5 : -0.5), Y0 - 5.2, Z0 + 2.6, chain); }
    }
    const endP = last.clone().add(v3(1.8, 0, 0));
    const eg = h.glow(0xffb547, 6, 0.8); at(eg, endP.x, endP.y, endP.z, chain); const ed = h.ball(0.6, 0xffb547, { hull: false, seg: 10, seg2: 8, matOpt: { emissive: 0xffb547, emissiveIntensity: 0.8 } }); at(ed, endP.x, endP.y, endP.z, chain);
    // следующий мономер ждёт у конца цепи
    let nx = null;
    if (d.chain < d.max) {
      nx = new T.Group(); at(nx, endP.x + 4.5, Y0 + 4.5, Z0, CZ); clickable(nx, 'add'); monoModel(nx, cur, 0.9);
      at(h.glow(0x72d4e8, 9, 0.3), 0, 0, 0, nx);
    }
    const t0 = { v: null }, newU = d.chain > prevN ? units[units.length - 1] : null;
    kit.onFrame((dt, t) => {
      const p = kit.reduce ? 1 : 0.5 + 0.5 * Math.sin(t * 4); eg.material.opacity = 0.45 + 0.45 * p;
      if (nx && !kit.reduce) { nx.position.y = Y0 + 4.5 + 0.8 * Math.sin(t * 2.2); nx.rotation.y = 0.4 * Math.sin(t * 1.3); }
      if (newU) { if (t0.v === null) t0.v = t; const k = kit.reduce ? 1 : clamp((t - t0.v) / 0.6, 0, 1); newU.position.set(4 * (1 - k), 5 * (1 - k), 0); }
    });
    const sub = d.chain ? 'R–(' + d.unit.replace(/^–|–$/g, '') + ')' + (d.chain > 1 ? String(d.chain).replace(/\d/g, c => '₀₁₂₃₄₅₆₇₈₉'[c]) : '') + '–•' : 'R• — инициатор';
    tag(CZ.userData.W(18, Y0 + 9, Z0), d.poly + ' (' + d.ab + ')', d.chain + ' зв. · ' + sub, d.ok);
    // --- табло n и M, кнопки ---
    const PX = 40, PZ = -18, pg = new T.Group(); at(pg, PX, ty, PZ, g);
    at(box(26, 1.2, 12, C.DARK), 0, 0.6, 0, pg);
    const body = new T.Group(); at(body, 0, 1.2, -2, pg); body.rotation.x = -0.25;
    at(box(24, 12, 3, 0x3b4a66), 0, 6, 0, body);
    const scr = h.screen(21, 9, 'n = ' + d.nT + '\nM = ' + d.Mp + ' г/моль', d.ok ? '#86e0a8' : '#e8ecf4', 420, 170); at(scr, 0, 6.2, 1.56, body);
    h.button(pg, -8, 1.2, 4, '−n', 0xe0473a, 'n-', 6, 3.6); h.button(pg, 0, 1.2, 4, '+n', 0x3fae5a, 'n+', 6, 3.6); h.button(pg, 8, 1.2, 4, 'сброс', 0x8b96ad, 'clr', 6, 3.6);
    tag(v3(PX, ty + 18, PZ), 'M = n · M(мономера)', d.ok ? 'цель достигнута ✓' : 'цель: ПВХ, 62 500', d.ok);
  };

  // ===== 6. Волокна: мотки на подносе, три ящика, проба на огонь, лупа =====
  const FCOL = { cotton: 0xf7f5ef, wool: 0xe6d6b4, kapron: 0xeef4fb, viscose: 0xdfe9f5, flax: 0xd2c19a, lavsan: 0xd8e4ee, silk: 0xfff3d6, acetate: 0xefe6f5, nitron: 0xf3e2d6 };
  function lensTex(kit, kind, id) {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    x.fillStyle = '#f4f7fb'; x.fillRect(0, 0, 256, 256);
    const col = hexs(FCOL[id] || 0xdddddd), dark = '#55607a';
    x.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const y = 30 + i * 38, a = (i % 2 ? -1 : 1) * 0.12;
      x.save(); x.translate(128, y); x.rotate(a); x.translate(-128, 0);
      x.lineWidth = kind === 'prot' && id === 'wool' ? 20 : kind === 'cell' && id !== 'viscose' ? 16 : 13;
      x.strokeStyle = dark; x.beginPath(); x.moveTo(-10, 0); x.lineTo(266, 0); x.stroke();
      x.lineWidth -= 4; x.strokeStyle = col === '#f7f5ef' ? '#fbfaf5' : col; x.beginPath(); x.moveTo(-10, 0); x.lineTo(266, 0); x.stroke();
      x.strokeStyle = dark; x.lineWidth = 2;
      if (id === 'wool') for (let k = 0; k < 14; k++) { x.beginPath(); x.arc(k * 20, 0, 8, -1.2, 1.2); x.stroke(); }          // чешуйки
      else if (id === 'cotton') for (let k = 0; k < 9; k++) { x.beginPath(); x.moveTo(k * 30, -6); x.lineTo(k * 30 + 14, 6); x.stroke(); } // извитая лента
      else if (id === 'flax') for (let k = 0; k < 6; k++) { x.beginPath(); x.moveTo(k * 46, -7); x.lineTo(k * 46, 7); x.stroke(); }     // «коленца»
      else if (id === 'viscose' || id === 'acetate') { x.beginPath(); x.moveTo(0, -2); x.lineTo(256, -2); x.moveTo(0, 2); x.lineTo(256, 2); x.stroke(); } // бороздки
      else { x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, -3); x.lineTo(256, -3); x.stroke(); }  // гладкий блеск
      x.restore();
    }
    const t = kit.keep(new kit.T.CanvasTexture(c)); t.colorSpace = kit.T.SRGBColorSpace; return t;
  }
  SC['chor-fib'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const ty = h.tray(g, 0, 2, 124, 80);
    // моток волокна: тор и пара витков
    const hank = (parent, F, s = 1) => {
      const col = FCOL[F.id] || 0xeeeeee, shiny = F.kind === 'syn' || F.id === 'silk' || F.id === 'viscose';
      for (let k = 0; k < 3; k++) { const tr = kit.mesh(new T.TorusGeometry(2.4 * s, (0.9 - k * 0.15) * s, 8, 24), col, { hull: true, edges: false, matOpt: shiny ? { emissive: 0x334455, emissiveIntensity: 0.12 } : undefined }); tr.rotation.set(Math.PI / 2 + (k - 1) * 0.25, 0, k * 0.5); at(tr, 0, 1.1 * s, 0, parent); }
      if (F.id === 'wool') for (let k = 0; k < 6; k++) at(h.ball(0.7 * s, col, { hull: false, seg: 8, seg2: 6 }), Math.cos(k) * 2.4 * s, 1.6 * s, Math.sin(k) * 2.4 * s, parent);
    };
    // --- три ящика ---
    const BXS = [-36, 0, 36], BZ = -20;
    d.bins.forEach((B, i) => {
      const bg = new T.Group(); at(bg, BXS[i], ty, BZ, g); clickable(bg, 'bin-' + B.id);
      at(box(30, 1, 14, C.WOOD2), 0, 0.5, 0, bg);
      at(box(30, 7, 1, C.WOOD), 0, 4, 6.5, bg); at(box(30, 7, 1, C.WOOD), 0, 4, -6.5, bg); at(box(1, 7, 14, C.WOOD), -14.5, 4, 0, bg); at(box(1, 7, 14, C.WOOD), 14.5, 4, 0, bg);
      const s = h.sticker(18, 4.6, B.name + '\n' + B.sub, '#1b1610', '#fffaf0', 300); at(s, 0, 4.4, 7.06, bg);
      d.fibers.filter(F => F.bin === B.id).forEach((F, j) => { const p = new T.Group(); at(p, -9 + (j % 3) * 9, 1, -2.6 + Math.floor(j / 3) * 5, bg); hank(p, F, 0.75); });
      if (d.sel) h.halo(bg, 0, 2, 0, 22);
    });
    tag(v3(0, ty + 18, BZ - 4), 'Разложено ' + d.placed + ' из ' + d.fibers.length, d.wrong ? 'ошибок: ' + d.wrong : 'есть ли полимер в природе?', d.placed === d.fibers.length);
    // --- мотки на подносе (каждый на своём месте) ---
    d.fibers.forEach((F, i) => {
      if (F.bin) return;
      const x = -48 + (i % 3) * 13, z = 4 + Math.floor(i / 3) * 11, sel = d.sel === F.id;
      const fg = new T.Group(); at(fg, x, ty + (sel ? 3 : 0), z, g); clickable(fg, 'fb-' + F.id);
      hank(fg, F);
      const s = h.sticker(9.6, 2.6, F.name, '#1b1610', sel ? '#ffd166' : '#fffaf0', 220); s.rotation.x = -Math.PI / 2; at(s, 0, 0.1 - (sel ? 3 : 0) + 0.06, 4, fg);
      if (sel) h.halo(fg, 0, -1, 0, 14);
    });
    if (d.sel) tag(v3(-48 + (d.fibers.findIndex(F => F.id === d.sel) % 3) * 13, ty + 9, 4 + Math.floor(d.fibers.findIndex(F => F.id === d.sel) / 3) * 11), d.selName, 'нажмите на ящик');
    // --- проба на огонь: плитка, спиртовка, пинцет с нитью ---
    const PX = 30, PZ = 12;
    at(box(30, 0.8, 18, 0xf4f1ea), PX, ty + 0.4, PZ, g);
    h.spirit(g, PX - 7, ty + 0.8, PZ - 2, true, 0.9, 'burn');
    const tw = new T.Group(); at(tw, PX + 6, ty + 13, PZ - 2, g); tw.rotation.z = 0.12;
    at(box(14, 0.5, 0.9, C.STEEL), -5, 0.4, 0.5, tw); at(box(14, 0.5, 0.9, C.STEEL), -5, -0.4, -0.5, tw);
    if (d.sel) {
      const F = d.fibers.find(f => f.id === d.sel);
      const piece = cyl(0.45, 4, FCOL[F.id], { edges: false }); piece.rotation.z = Math.PI / 2; at(piece, -13, 0, 0, tw);
      if (d.burnOn) h.smallFlame(g, PX - 7.6, ty + 12.4, PZ - 2, 4.5, d.res === 'black' ? 0xff7a1a : 0xffa030);
      if (d.burned) {
        const RX = PX + 8, RZ = PZ + 4;
        if (d.res === 'ash') for (let k = 0; k < 7; k++) { const a = box(1 + rnd(k) * 1.2, 0.2, 0.8 + rnd(k + 3), 0x9aa0a8, { edges: false }); a.rotation.y = rnd(k + 5) * 3; at(a, RX + (rnd(k + 1) - 0.5) * 4, ty + 0.95, RZ + (rnd(k + 2) - 0.5) * 3, g); }
        else if (d.res === 'crumb') for (let k = 0; k < 4; k++) at(kit.mesh(new T.DodecahedronGeometry(0.7 + rnd(k) * 0.5), 0x1d1f24, { hull: true, edges: false }), RX + (k - 1.5) * 1.3, ty + 1.3, RZ + (rnd(k + 4) - 0.5) * 1.6, g);
        else at(h.ball(1, d.res === 'light' ? 0xe8e2cf : d.res === 'dark' ? 0x4a3a2a : 0x1d1f24, { seg: 14, seg2: 10 }), RX, ty + 1.8, RZ, g);
      }
      const RES = { ash: 'серый пепел', crumb: 'чёрный хрупкий комочек', light: 'твёрдый светлый шарик', dark: 'твёрдый тёмный шарик', black: 'твёрдый чёрный шарик' };
      tag(v3(PX + 6, ty + 5, PZ + 8), 'Проба на огонь', d.burned ? 'запах: ' + d.smell + ' · ' + RES[d.res] : 'нажмите на спиртовку', d.burned);
      // лупа на подставке над образцом
      const lg = new T.Group(); at(lg, 2, ty, 28, g); lg.rotation.y = 0.35;
      at(cyl(3, 1, C.DARK), 0, 0.5, 0, lg); at(cyl(0.4, 10, C.STEEL, { edges: false }), 0, 5.5, 0, lg);
      const ring = kit.mesh(new T.TorusGeometry(5, 0.6, 8, 32), 0x2c3240, { edges: false }); at(ring, 0, 15.5, 0, lg);
      const lens = new T.Mesh(kit.keep(new T.CircleGeometry(4.7, 32)), kit.keep(new T.MeshBasicMaterial({ map: lensTex(kit, F.kind, F.id) }))); at(lens, 0, 15.5, 0.05, lg);
      tag(v3(2, ty + 3, 33), 'Под лупой', F.id === 'wool' ? 'волос с чешуйками' : F.id === 'cotton' ? 'плоская извитая лента' : F.id === 'flax' ? 'нить с коленцами' : F.kind === 'cell' || F.kind === 'ac' ? 'нить с бороздками' : 'гладкая блестящая нить');
    } else tag(v3(PX, ty + 20, PZ - 2), 'Проба на огонь', 'сначала выберите моток');
  };

  // ===== 7. Каучук и резина: штатив с полоской и грузом, линейка, сера, печь вулканизации =====
  SC['chor-rub'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const ty = h.tray(g, 0, 2, 124, 80);
    const SX = 4, SZ = -10, YT = ty + 52, L0 = 6.5;
    h.stand(g, SX - 12, SZ - 2, 58, [{ y: YT + 2.4, to: { x: SX, z: SZ }, w: 7 }]);
    at(box(14, 1.6, 3, 0x2c3240), SX + 3, YT + 0.4, SZ, g);
    // полоска: единичная коробка, тянется по высоте
    const COL = { raw: 0xc9a06a, soft: 0x4a4f5c, hard: 0x34373f, ebon: 0x18191d }[d.k];
    const strip = new T.Group(); at(strip, SX, YT - 0.4, SZ, g);
    const band = box(4.6, 1, 1.1, COL); strip.add(band);
    const dots = [], nd = Math.min(28, d.cross);
    for (let q = 0; q < nd; q++) { const m = box(0.55, 0.35, 0.2, 0xe6c63a, { edges: false, hull: false }); strip.add(m); dots.push({ m, u: (q * 0.618034 + 0.13) % 1, x: (rnd(q) - 0.5) * 3.6 }); }
    const hook = new T.Group(); g.add(hook);
    at(box(5.4, 1.4, 2, C.STEEL), 0, 0, 0, hook);
    const hk = kit.mesh(new T.TorusGeometry(0.9, 0.25, 6, 16, Math.PI * 1.5), C.STEEL, { edges: false }); at(hk, 0, -1.8, 0, hook);
    // груз 1 кг
    const wt = new T.Group(); clickable(wt, 'pull');
    at(cyl(3.2, 6, 0x6f7a8e, { seg: 24 }), 0, -3.6 - 3, 0, wt); at(cyl(0.6, 2.4, C.STEEL, { edges: false }), 0, -1.6, 0, wt);
    const ws = h.sticker(4.4, 2, '1 кг', '#1b1610', '#fffaf0', 128); at(ws, 0, -6.6, 3.26, wt);
    if (d.hung) hook.add(wt); else { at(wt, SX + 16, ty + 9.6, SZ + 8, g); }
    // линейка ×1…×6
    const RX = SX + 5.4;
    at(box(2.6, 40, 0.6, 0xfff3c4), RX, YT - 20, SZ, g);
    for (let k = 1; k <= 6; k++) {
      const y = YT - L0 * k; at(box(1.4, 0.2, 0.2, 0x1b1610, { edges: false, hull: false }), RX - 0.4, y, SZ + 0.35, g);
      const s = h.sticker(2.4, 1.6, '×' + k, '#1b1610', '#fff3c4', 96); at(s, RX + 0.1, y + 1, SZ + 0.32, g);
    }
    const yMax = YT - L0 * Math.min(6, d.max); at(box(3.4, 0.3, 0.3, 0xe0473a, { edges: false }), RX, yMax, SZ + 0.4, g);
    if (d.rest > 1.001) at(box(3.4, 0.4, 0.4, 0xffb547, { edges: false }), RX, YT - L0 * d.rest, SZ + 0.5, g);
    const setL = h.liveTag(v3(SX - 8, YT - 6, SZ + 2), d.stName + (d.vulc ? ' · S ' + d.sp + ' %' : d.sp ? ' + S ' + d.sp + ' %' : ''), '×1,00', d.passed);
    kit.onFrame(() => {
      const L = live() || {}, lam = L.lam ?? 1, len = L0 * lam, w = 1 / Math.sqrt(lam);
      band.scale.set(w, len, w); band.position.y = -len / 2;
      dots.forEach(o => o.m.position.set(o.x * w, -len * (0.04 + 0.92 * o.u), 0.6 * w));
      hook.position.set(SX, YT - 0.4 - len - 0.6, SZ);
      setL('×' + fmt(lam, 2) + ' · мостиков ' + d.cross);
    });
    // --- ступка: каучук с серой, банка серы, кнопки ---
    const MX = -38, MZ = 8;
    const pts = []; for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI / 2; pts.push(new T.Vector2(1 + 7 * Math.sin(a), 6 - 6 * Math.cos(a))); }
    const bowl = kit.mesh(new T.LatheGeometry(pts, 32), 0xf4f1ea, { hull: true, edges: false, matOpt: { side: T.DoubleSide } }); at(bowl, MX, ty, MZ, g);
    const lump = h.ball(3.4, d.vulc ? COL : 0xc9a06a, { seg: 16, seg2: 10 }); lump.scale.y = 0.6; at(lump, MX, ty + 2.6, MZ, g); clickable(lump, 'mix');
    if (d.sp > 0 && !d.vulc) { const r = 1 + Math.sqrt(d.sp) * 0.8; at(cyl(r, r * 0.7, 0xf2d43a, { r2: 0.2 }), MX + 1.2, ty + 3.4 + r * 0.35, MZ + 0.6, g); }
    const jar = h.bottle(g, -48, ty, -12, { r: 4, h: 9, liq: 0xf2d43a, lop: 0.95, fill: 0.7, cap: 0x2c3240, label: 'S\nсера', lh: 4.4 });
    clickable(jar.g, 's+');
    h.button(g, -42, ty, 24, '−1 % S', 0xe0473a, 's-', 9, 4.4); h.button(g, -31, ty, 24, '+1 % S', 0x3fae5a, 's+', 9, 4.4);
    tag(v3(MX, ty + 10, MZ), 'Смесь: каучук + сера', d.sp + ' %' + (d.vulc ? ' · сшита' : ''));
    // --- печь вулканизации 140 °C ---
    const OX = 36, OZ = 6, og = new T.Group(); at(og, OX, ty, OZ, g); clickable(og, 'vulc');
    at(box(22, 9, 16, 0x3b4a66), 0, 4.5, 0, og);
    at(box(18, 0.8, 12, d.vulc ? 0xd8642a : 0x2c3240, { matOpt: d.vulc ? { emissive: 0xff5a10, emissiveIntensity: 0.5 } : undefined }), 0, 9.4, 0, og);
    if (d.vulc) { at(h.glow(0xff7a2a, 22, 0.35), 0, 10, 0, og); const sm = box(8, 0.6, 3, COL); at(sm, 0, 10.1, 0, og); }
    const sc = h.screen(10, 3.6, d.vulc ? '140 °C ✓' : 'выкл', d.vulc ? '#ffb547' : '#8b96ad', 300, 100); at(sc, -3, 5, 8.06, og);
    const kb = cyl(1.6, 1, 0x2c3240); kb.rotation.x = Math.PI / 2; at(kb, 6.5, 5, 8.3, og);
    tag(v3(OX, ty + 15, OZ), 'Вулканизация 140 °C', d.vulc ? 'готово ✓' : d.sp ? 'нажмите на печь' : 'сначала добавьте серу', d.vulc);
    if (d.passed) tag(v3(SX + 10, YT + 6, SZ), 'Результат', 'резина вернулась ✓', true);
  };

  // ===== 8. Переработка: контейнеры и предметы с кодами; дробилка, бак флотации, гранулы =====
  function codeTex(kit, code, ab) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#fffaf0'; x.beginPath(); x.roundRect ? x.roundRect(4, 4, 120, 120, 18) : x.rect(4, 4, 120, 120); x.fill(); x.strokeStyle = '#1b1610'; x.lineWidth = 5; x.stroke();
    x.lineWidth = 7; x.lineJoin = 'round'; x.beginPath(); x.moveTo(64, 16); x.lineTo(108, 88); x.lineTo(20, 88); x.closePath(); x.stroke();
    x.fillStyle = '#1b1610'; x.font = '700 40px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(code, 64, 64);
    x.font = '700 22px "IBM Plex Mono", monospace'; x.fillText(ab, 64, 108);
    const t = kit.keep(new kit.T.CanvasTexture(c)); t.colorSpace = kit.T.SRGBColorSpace; return t;
  }
  SC['chor-rec'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const ty = h.tray(g, 0, 2, 124, 80);
    h.modeSign(g, 32, ty, 32, 'Сортировка', d.mode === 'sort', 'm-sort', 16); h.modeSign(g, 50, ty, 32, 'Флотация', d.mode === 'float', 'm-float', 16);
    const goal = 'Сортировка ' + d.sorted + '/7 · ПЭТ ' + (d.okA ? '✓' : '—') + ' · ПП ' + (d.okB ? '✓' : '—');
    h.floorSticker(g, -34, ty, 32, 44, 5, goal, '#1b1610', '#eef7ee', 460);
    // предметы
    const ITEM = {
      bottle: p => { const b = h.glassy(new T.CylinderGeometry(2.4, 2.4, 9, 20, 1, true), 0x9fd4f0, 0.45); at(b, 0, 4.5, 0, p); at(cyl(2.4, 0.4, 0x9fd4f0, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.5 } }), 0, 0.2, 0, p); at(cyl(1, 2.6, 0x9fd4f0, { r2: 2.4, edges: false, matOpt: { transparent: true, opacity: 0.5 } }), 0, 10.3, 0, p); at(cyl(1.1, 1.2, 0x2f6fd8), 0, 12.2, 0, p); return 9; },
      shampoo: p => { const b = box(5, 9, 3, 0xf4f6fa); at(b, 0, 4.5, 0, p); at(cyl(0.9, 2, 0xe0473a), 0, 10, 0, p); at(box(2.6, 0.8, 0.8, 0xe0473a), 0.8, 11.2, 0, p); return 9; },
      pipe: p => { const t = cyl(2, 9, 0x9aa3b5, { seg: 20 }); t.rotation.z = Math.PI / 2; at(t, 0, 2, 0, p); const e = cyl(1.4, 9.1, 0x3b4150, { edges: false, hull: false, seg: 16 }); e.rotation.z = Math.PI / 2; at(e, 0, 2, 0, p); return 4; },
      bag: p => { const b = box(6.4, 8, 0.6, 0xf4f7fb, { matOpt: { transparent: true, opacity: 0.8 } }); b.rotation.set(-0.15, 0.1, 0.05); at(b, 0, 4.3, 0, p); for (const sx of [-1.8, 1.8]) { const hd = kit.mesh(new T.TorusGeometry(1.1, 0.3, 6, 12, Math.PI), 0xf4f7fb, { edges: false }); at(hd, sx, 8.4, -0.6, p); } return 9; },
      box: p => { at(box(7, 3.6, 5.4, 0xf6efe0, { matOpt: { transparent: true, opacity: 0.85 } }), 0, 1.8, 0, p); at(box(7.4, 0.7, 5.8, 0x6fbf73), 0, 3.95, 0, p); return 4.3; },
      cup: p => { at(cyl(2.6, 6, 0xffffff, { r2: 2.6, seg: 20 }), 0, 3, 0, p); at(cyl(1.7, 6, 0xffffff, { r2: 2.6, edges: false, hull: false, seg: 20 }), 0, 3, 0, p); at(cyl(2.4, 0.2, 0xd8dee8, { r2: 1.8, edges: false, hull: false }), 0, 6.05, 0, p); return 6; },
      chips: p => { const b = h.ball(1, 0xd94a3a, { seg: 16, seg2: 12 }); b.scale.set(3.4, 4.6, 1.2); at(b, 0, 4.6, 0, p); at(box(6, 0.6, 1.4, 0xc8ced6), 0, 9.1, 0, p); at(box(6, 0.6, 1.4, 0xc8ced6), 0, 0.3, 0, p); return 9; },
    };
    if (d.mode === 'sort') {
      const BCOL = { pet: 0x3b82f6, po: 0xf2c94c, hard: 0x8b96ad }, BXS = [-30, 4, 38];
      d.bins.forEach((B, i) => {
        const bg = new T.Group(); at(bg, BXS[i], ty, -18, g); clickable(bg, 'bin-' + B.id);
        at(box(24, 16, 15, BCOL[B.id]), 0, 8, 0, bg);
        at(box(25, 1, 5, BCOL[B.id]), 0, 16.5, -6.2, bg);
        at(box(22, 0.4, 13, 0x1d2333, { edges: false }), 0, 16.1, 0.5, bg);
        const s = h.sticker(16, 5, B.name + '\n' + B.sub, '#1b1610', '#fffaf0', 300); at(s, 0, 9, 7.56, bg);
        for (const sx of [-9, 9]) { const wh = cyl(1.6, 1.2, 0x2c3240); wh.rotation.z = Math.PI / 2; at(wh, sx, 1.6, 7.6, bg); }
        d.items.filter(I => I.bin === B.id).forEach((I, j) => { const p = new T.Group(); at(p, -7 + j * 5, 13, (j % 2) * 2, bg); p.scale.setScalar(0.55); ITEM[I.id](p); p.rotation.z = (j % 2 ? 0.3 : -0.3); });
        if (d.isel) h.halo(bg, 0, 4, 8, 22);
      });
      d.items.forEach((I, i) => {
        if (I.bin) return;
        const sel = d.isel === I.id, x = -48 + i * 14.5, ig = new T.Group(); at(ig, x, ty + (sel ? 3 : 0), 12, g); clickable(ig, 'it-' + I.id);
        ITEM[I.id](ig);
        const ct = h.flat(4.6, 4.6, codeTex(kit, I.code, I.ab)); ct.rotation.x = -Math.PI / 2; at(ct, 0, 0.08 - (sel ? 3 : 0), 6.6, ig);
        if (sel) h.halo(ig, 0, 0, 0, 16);
      });
      const si = d.items.find(I => I.id === d.isel);
      tag(v3(4, ty + 22, -18), 'Контейнеры', 'разложено ' + d.sorted + ' из 7', d.sorted === 7);
      if (si) tag(v3(-48 + d.items.indexOf(si) * 14.5, ty + 18, 12), si.name, 'код ' + si.code + ' · ' + si.ru);
      else if (d.sorted < 7) tag(v3(-4, ty + 14, 12), 'Предметы', 'выберите предмет');
      return;
    }
    // ---- флотация ----
    // дробилка с бункером и кучка хлопьев
    const DX = -42, DZ = -14, dg = new T.Group(); at(dg, DX, ty, DZ, g);
    at(box(14, 12, 12, 0x5a6680), 0, 6, 0, dg);
    at(cyl(8, 6, 0x8b96ad, { r2: 4, seg: 4 }), 0, 15, 0, dg).rotation.y = Math.PI / 4;
    const bt = new T.Group(); at(bt, 1, 17, 0, dg); bt.rotation.z = 0.5; ITEM.bottle(bt);
    at(box(5, 1, 6, 0x3b4a66), 0, 2, 8, dg).rotation.x = 0.4;
    for (let k = 0; k < 14; k++) { const f = box(1.4, 0.3, 1, rnd(k) < 0.6 ? 0x72d4e8 : rnd(k) < 0.8 ? 0xe8ecf4 : 0xffb547, { edges: false }); f.rotation.y = rnd(k + 3) * 3; at(f, DX + (rnd(k + 1) - 0.5) * 6, ty + 0.4 + rnd(k + 2) * 0.8, DZ + 13 + (rnd(k + 4) - 0.5) * 4, g); }
    tag(v3(DX, ty + 22, DZ), 'Дробилка', 'бутылки → хлопья');
    // мешок с гранулами
    const GX = -44, GZ = 18;
    at(cyl(5, 7, 0xcdb88a, { r2: 4.4, seg: 10 }), GX, ty + 3.5, GZ, g);
    for (let k = 0; k < 16; k++) at(h.ball(0.6, 0x72d4e8, { hull: false, seg: 8, seg2: 6 }), GX + (rnd(k) - 0.5) * 6, ty + 7.2, GZ + (rnd(k + 9) - 0.5) * 6, g);
    h.floorSticker(g, GX, ty, GZ + 7.5, 10, 2.6, 'гранулы', '#1b1610', '#fffaf0', 160);
    // бак
    const TX = 4, TZ = -4, TW = 34, TH = 20, TD = 18, TB = ty + 1.2;
    at(box(TW + 2, 1.2, TD + 2, C.DARK), TX, ty + 0.6, TZ, g);
    const tank = h.glassy(new T.BoxGeometry(TW, TH, TD), 0xd8eef8, 0.18); at(tank, TX, TB + TH / 2, TZ, g);
    const k = clamp((d.rho - 0.8) / 0.62, 0, 1), lc = mixC(T, 0x9fd0ee, 0x6fb0c8, k);
    const LH = TH - 3;
    const lq = new T.Mesh(kit.keep(new T.BoxGeometry(TW - 0.6, LH, TD - 0.6)), h.ownMat(lc.getHex(), { transparent: true, opacity: 0.35, depthWrite: false })); at(lq, TX, TB + LH / 2, TZ, g);
    const surf = TB + LH, bot = TB + 0.4;
    // хлопья плывут к своей высоте; позиции помним между перестройками
    mem.flk = mem.flk && mem.flk.length === d.flakes.length ? mem.flk : d.flakes.map(() => null);
    const FL = d.flakes.map((kk, i) => {
      let m;
      if (kk === 'pet') m = box(1.8, 0.3, 1.3, 0x72d4e8, { edges: false });
      else if (kk === 'pp') m = box(2.8, 0.25, 0.7, 0xffb547, { edges: false });
      else m = kit.mesh(new T.TorusGeometry(0.8, 0.28, 6, 14), 0xf4f6fa, { edges: false, hull: true });
      if (kk === 'hdpe') m.rotation.x = Math.PI / 2; else m.rotation.y = rnd(i + 4) * 3;
      const x = TX - TW / 2 + 3 + rnd(i + 1) * (TW - 6), z = TZ - TD / 2 + 3 + rnd(i + 7) * (TD - 6);
      const side = d.sides[kk];
      const tgt = side === 'up' ? surf - 0.25 - (i % 3) * 0.25 : side === 'down' ? bot + 0.2 + (i % 4) * 0.35 : (surf + bot) / 2 + ((i * 13) % 8) - 4;
      const y0 = mem.flk[i] ?? (bot + 0.3 + (i % 4) * 0.3);
      at(m, x, y0, z, g); return { m, tgt, i };
    });
    kit.onFrame((dt, t) => FL.forEach(f => {
      let y = f.m.position.y; const dd = f.tgt - y;
      y = kit.reduce || Math.abs(dd) < 0.05 ? f.tgt : y + Math.sign(dd) * Math.min(Math.abs(dd), (3 + Math.abs(dd) * 1.5) * dt);
      f.m.position.y = y + (Math.abs(f.tgt - surf) < 1 && !kit.reduce ? 0.12 * Math.sin(t * 2 + f.i) : 0); mem.flk[f.i] = y;
    }));
    tag(v3(TX, TB + TH + 4, TZ), d.liq, 'ρ = ' + d.rhoT + ' г/см³');
    // табло плотности, кнопки, сачок
    const PX = 36, PZ = -14, pg = new T.Group(); at(pg, PX, ty, PZ, g);
    at(box(20, 1.2, 12, C.DARK), 0, 0.6, 0, pg);
    const body = new T.Group(); at(body, 0, 1.2, -2.5, pg); body.rotation.x = -0.25;
    at(box(18, 10, 3, 0x3b4a66), 0, 5, 0, body);
    const scr = h.screen(16, 7.6, 'ρ = ' + d.rhoT + '\n' + d.kinds.map(q => q.name + ' ' + q.rs).join('  '), '#86e0a8', 420, 200); at(scr, 0, 5.2, 1.56, body);
    h.button(pg, -4.5, 1.2, 3.6, '−0,01', 0xe0473a, 'r-', 7.6, 3.8); h.button(pg, 4.5, 1.2, 3.6, '+0,01', 0x3fae5a, 'r+', 7.6, 3.8);
    const net = new T.Group(); at(net, TX + 8, TB + TH + 0.5, TZ + TD / 2 - 5, g); clickable(net, 'skim'); net.rotation.y = -0.3;
    const rg = kit.mesh(new T.TorusGeometry(4, 0.35, 6, 24), 0x3b4a66, { edges: false }); rg.rotation.x = Math.PI / 2; at(rg, 0, 0, 0, net);
    at(cyl(3.8, 0.15, 0xe8ecf4, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.6 } }), 0, 0, 0, net);
    const hd = cyl(0.4, 14, C.WOOD2, { edges: false }); hd.rotation.z = Math.PI / 2; at(hd, 11, 0, 0, net);
    // снятое — в кювете
    const KX = 34, KZ = 14;
    at(box(16, 1.6, 11, 0xffffff), KX, ty + 0.8, KZ, g);
    if (d.skim) {
      d.skim.up.forEach((nm, j) => { for (let q = 0; q < 4; q++) { const kk = d.kinds.find(z => z.name === nm).k; const m = kk === 'pp' ? box(2.6, 0.25, 0.7, 0xffb547, { edges: false }) : kk === 'pet' ? box(1.8, 0.3, 1.3, 0x72d4e8, { edges: false }) : kit.mesh(new T.TorusGeometry(0.8, 0.28, 6, 14), 0xf4f6fa, { edges: false }); if (kk === 'hdpe') m.rotation.x = Math.PI / 2; m.rotation.y = rnd(q + j * 5) * 3; at(m, KX - 5 + j * 5 + (rnd(q + 1) - 0.5) * 3, ty + 1.9, KZ + (rnd(q + 3) - 0.5) * 6, g); } });
      tag(v3(KX, ty + 9, KZ), 'Сняли: ' + (d.skim.up.join(', ') || 'ничего'), 'на дне: ' + (d.skim.down.join(', ') || 'ничего'), d.skim.ok);
    } else tag(v3(TX + 20, TB + TH + 2, TZ + TD / 2 - 5), 'Сачок', 'снять всплывшее');
  };
})();
