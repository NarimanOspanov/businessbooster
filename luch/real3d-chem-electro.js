// «Как в жизни» для химии: «Электрохимия» (labs/chem-electro) и «ОВР» (labs/chem-redox).
// Белый лабораторный поднос на столе, стеклянная посуда с растворами верного цвета, пластинки металлов,
// гальванический элемент с солевым мостиком, электролизёр, гвозди в пробирках, модель молекулы и весы зарядов.
// Сцены строятся из window.LUCH_REAL() опыта; быстрые значения (минуты, дни, граммы) — из LUCH_REAL.live() в onFrame.
(() => {
  const SC = window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {};
  const live = () => { try { return window.LUCH_REAL.live ? window.LUCH_REAL.live() : null; } catch (e) { return null; } };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (x, n) => { let s = (Math.round(x * 10 ** n) / 10 ** n).toFixed(n); if (/^-0(\.0+)?$/.test(s)) s = s.slice(1); return s.replace('.', ',').replace('-', '−'); };
  const ox = n => n > 0 ? '+' + n : n < 0 ? '−' + (-n) : '0';
  // детерминированный «случай»: сцена перестраивается, а точки должны стоять на тех же местах
  const rnd = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const hexs = c => '#' + c.toString(16).padStart(6, '0');
  // плавные величины между перестройками сцены (наклон весов, цвет раствора)
  const mem = {};

  // ---------- общие детали ----------
  function H(kit) {
    const { T, at, box, cyl, mesh, keep, grad, glowTex, textTex, clickable, toon, C } = kit;
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    const glassMat = (color = 0xd8eef8, opacity = 0.24) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, transparent: true, opacity, side: T.DoubleSide, depthWrite: false }));
    const ownMat = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, ...o }));
    const spr = (map, color, opacity, add) => new T.Sprite(keep(new T.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending })));
    const glow = (color, size, opacity) => { const s = spr(glowTex(), color, opacity, true); s.scale.setScalar(size); return s; };
    const flat = (w, h, tex) => new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: keep(tex), transparent: true })));
    const hitBox = (w, h, d) => new T.Mesh(keep(new T.BoxGeometry(w, h, d)), keep(new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })));
    const ball = (r, color, o = {}) => mesh(new T.SphereGeometry(r, o.seg || 18, o.seg2 || 12), color, { hull: o.hull ?? true, edges: false, matOpt: o.matOpt, shadow: o.shadow });
    // цилиндр от точки a до точки b
    function rodAB(parent, a, b, r, color, o = {}) {
      const dv = b.clone().sub(a), L = dv.length();
      const m = cyl(r, L, color, { edges: false, ...o });
      m.quaternion.setFromUnitVectors(v3(0, 1, 0), dv.normalize());
      return at(m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, parent);
    }
    // текст на холсте, который можно перерисовать (табло, таблетки)
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
    // табло с текстом, который меняется в onFrame (строки через \n)
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
    // бумажная наклейка с надписью (на стекле, на подносе)
    function sticker(w, h, txt, fg = '#1b1610', bg = '#fffaf0', pw = 256) {
      const ph = Math.round(pw * h / w), k = canvasTex(pw, ph);
      const draw = (t, f, b) => {
        k.x.clearRect(0, 0, pw, ph); k.x.fillStyle = b; const r = ph * 0.18;
        k.x.beginPath(); k.x.roundRect ? k.x.roundRect(2, 2, pw - 4, ph - 4, r) : k.x.rect(2, 2, pw - 4, ph - 4); k.x.fill();
        k.x.strokeStyle = '#1b1610'; k.x.lineWidth = 4; k.x.stroke();
        drawLines(k.x, pw, ph, String(t).split('\n'), f); k.tex.needsUpdate = true;
      };
      draw(txt, fg, bg);
      const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: k.tex, transparent: true })));
      m.userData.set = draw; return m;
    }
    // «таблетка» над деталью: всегда смотрит на зрителя, можно перерисовать
    function pill(parent, x, y, z, txt, fg = '#1b1610', bg = '#fff6e6', hgt = 3.2) {
      const lines = String(txt).split('\n'), mc = document.createElement('canvas').getContext('2d');
      let mw = 0; lines.forEach((l, i) => { mc.font = `700 ${i ? 38 : 50}px "IBM Plex Mono", monospace`; mw = Math.max(mw, mc.measureText(l).width); });
      const pw = Math.max(128, Math.ceil(mw + 60)), ph = 72 * lines.length + 8, k = canvasTex(pw, ph);
      const m = new T.Sprite(keep(new T.SpriteMaterial({ map: k.tex, transparent: true, depthTest: false, depthWrite: false })));
      m.renderOrder = 6; m.center.set(0.5, 0);
      let cur = null;
      const set = (t, f = fg, b = bg) => {
        const key = t + f + b; if (key === cur) return; cur = key;
        const ls = String(t).split('\n');
        k.x.clearRect(0, 0, pw, ph);
        let w = 0; ls.forEach((l, i) => { k.x.font = `700 ${i ? 38 : 50}px "IBM Plex Mono", monospace`; w = Math.max(w, k.x.measureText(l).width); });
        w = Math.min(pw - 6, w + 34);
        k.x.fillStyle = b; k.x.strokeStyle = '#1b1610'; k.x.lineWidth = 5;
        k.x.beginPath(); const x0 = (pw - w) / 2; if (k.x.roundRect) k.x.roundRect(x0, 3, w, ph - 6, 26); else k.x.rect(x0, 3, w, ph - 6); k.x.fill(); k.x.stroke();
        const lh = (ph - 8) / ls.length;
        ls.forEach((l, i) => { k.x.fillStyle = f; k.x.font = `700 ${i ? 38 : 50}px "IBM Plex Mono", monospace`; k.x.textAlign = 'center'; k.x.textBaseline = 'middle'; k.x.fillText(l, pw / 2, 4 + lh * (i + 0.5) + 2); });
        k.tex.needsUpdate = true;
      };
      set(txt);
      m.scale.set(hgt * pw / 72, hgt * ph / 72, 1);
      at(m, x, y, z, parent);
      return { m, set };
    }
    // кнопка на приборе: колпачок со значком сверху
    function button(parent, x, y, z, label, color, key, w = 4.2) {
      const b = new T.Group(); at(b, x, y, z, parent);
      at(box(w, 1.4, 3.6, color), 0, 0.7, 0, b);
      const top = flat(w * 0.82, 2.9, textTex(label, '#ffffff', hexs(color), 128, 96));
      top.rotation.x = -Math.PI / 2; at(top, 0, 1.42, 0, b);
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
      const wall = new T.Mesh(keep(new T.CylinderGeometry(r, r * 0.97, h, 40, 1, true)), glassMat(0xd8eef8, 0.22)); at(wall, 0, h / 2, 0, g);
      wall.add(new T.Mesh(wall.geometry, kit.hullMat));
      at(cyl(r * 0.97, 0.6, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.45 } }), 0, 0.3, 0, g);
      const rim = mesh(new T.TorusGeometry(r, 0.22, 6, 40), 0xeef6fb, { edges: false, shadow: false }); rim.rotation.x = Math.PI / 2; at(rim, 0, h, 0, g);
      // носик
      const sp = mesh(new T.TorusGeometry(0.9, 0.22, 6, 12, Math.PI), 0xeef6fb, { edges: false }); sp.rotation.set(Math.PI / 2, 0, Math.PI / 2); at(sp, -r - 0.2, h, 0, g);
      const a = 0.5;
      for (let k = 1; k <= 5; k++) { const m = box(k % 2 ? 1.1 : 2, 0.16, 0.1, 0x6f8098, { edges: false, shadow: false }); m.rotation.y = a; at(m, Math.sin(a) * (r + 0.05), h * k / 6.5, Math.cos(a) * (r + 0.05), g); }
      return { g, r, h, wall };
    }
    // жидкость: цилиндр единичной высоты, высоту и цвет можно менять каждый кадр
    function liquid(parent, x, y0, z, r, color, opacity = 0.62) {
      const mat = ownMat(color, { transparent: true, opacity, depthWrite: false });
      const m = new T.Mesh(keep(new T.CylinderGeometry(r, r * 0.97, 1, 40)), mat);
      at(m, x, y0, z, parent);
      const set = (hgt, yb = y0) => { m.visible = hgt > 0.05; m.scale.y = Math.max(0.05, hgt); m.position.y = yb + Math.max(0.05, hgt) / 2; };
      return { m, mat, set };
    }
    // пробирка: открытая трубка с круглым дном
    function testTube(parent, x, y0, z, r, hh) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const wg = keep(new T.CylinderGeometry(r, r, hh - r, 28, 1, true));
      const wall = new T.Mesh(wg, glassMat(0xd8eef8, 0.22)); at(wall, 0, r + (hh - r) / 2, 0, g); wall.add(new T.Mesh(wg, kit.hullMat));
      const bg = keep(new T.SphereGeometry(r, 28, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2));
      const bot = new T.Mesh(bg, glassMat(0xd8eef8, 0.22)); at(bot, 0, r, 0, g); bot.add(new T.Mesh(bg, kit.hullMat));
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
    // колба с круглым дном и горлом
    function flask(parent, x, y0, z, R, neck, o = {}) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const sg = keep(new T.SphereGeometry(R, 32, 20));
      const bulb = new T.Mesh(sg, glassMat(0xd8eef8, 0.2)); at(bulb, 0, R, 0, g); bulb.add(new T.Mesh(sg, kit.hullMat));
      const ng = keep(new T.CylinderGeometry(R * 0.28, R * 0.3, neck, 24, 1, true));
      const nk = new T.Mesh(ng, glassMat(0xd8eef8, 0.22)); at(nk, 0, R * 1.9 + neck / 2, 0, g); nk.add(new T.Mesh(ng, kit.hullMat));
      if (o.ring !== false) at(cyl(R * 0.85, 1.2, 0x5b4a3a, { r2: R * 0.85 }), 0, 0.6, 0, g);
      return { g, top: R * 1.9 + neck, R };
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
          b.m.visible = i < k && st.top > 1.5; if (!b.m.visible) return;
          const ph = kit.reduce ? b.ph : (t * st.speed + b.ph) % 1;
          b.m.scale.setScalar(st.big * (0.5 + 0.8 * ph));
          b.m.position.set(Math.cos(b.a) * b.rr + 0.3 * Math.sin(t * 5 + i), 0.4 + ph * (st.top - 0.9), Math.sin(b.a) * b.rr);
        });
      });
      return { g, set(a, top, big = 0.5, speed = 0.6) { Object.assign(st, { amt: a, top, big, speed }); } };
    }
    // клубы газа/дыма: поднимаются и тают
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
    // спиртовка: стеклянный корпус, латунная горловина, фитиль, пламя
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
        at(cyl(0.7 * s, hgt * 0.55, 0xfff1a8, { r2: 0.05, edges: false, hull: false, shadow: false, matOpt: { emissive: 0xffd24a, emissiveIntensity: 1 } }), 0, hgt * 0.28, 0, f);
        at(glow(0xff9a40, hgt * 2.2, 0.55), 0, hgt * 0.45, 0, f);
        at(new T.PointLight(0xffa040, 22 * s, 40, 1.4), 0, hgt * 0.5, 0, f);
        if (!kit.reduce) kit.onFrame((dt, t) => { f.scale.set(1 + 0.06 * Math.sin(t * 17), 1 + 0.1 * Math.sin(t * 11) + 0.05 * Math.sin(t * 29), 1 + 0.06 * Math.cos(t * 15)); });
      } else at(cyl(2 * s, 2.8 * s, 0xbfe3f2, { r2: 1.6 * s, matOpt: { transparent: true, opacity: 0.55 } }), 0, 7.3 * s, 0, g);
      return g;
    }
    // лабораторный штатив с лапкой
    function stand(parent, x, z, Hh, arms) {
      at(box(12, 1.2, 9, C.DARK), x, 0.6, z, parent);
      at(cyl(0.65, Hh, C.STEEL, { edges: false }), x, 1.2 + Hh / 2, z, parent);
      arms.forEach(a => {
        const p0 = v3(x, a.y, z), p1 = v3(a.to.x, a.y, a.to.z);
        rodAB(parent, p0, p1, 0.42, C.STEEL);
        at(box(2.2, 2.2, 2.2, C.DARK), x, a.y, z, parent);
        at(box(2.6, 2.4, 2.6, 0x3b4a66), p1.x, a.y, p1.z, parent);
      });
    }
    // провод по точкам; огоньки бегут от первой точки к последней (flow > 0)
    let dashT = null;
    function dashTex() {
      if (dashT) return dashT;
      const k = canvasTex(64, 8); k.x.fillStyle = '#ffd166'; k.x.fillRect(8, 0, 16, 8);
      dashT = k.tex; dashT.wrapS = T.RepeatWrapping; return dashT;
    }
    function wire(pts, color, flow = 0, r = 0.85) {
      const curve = new T.CatmullRomCurve3(pts, false, 'centripetal');
      const segs = Math.max(30, Math.round(curve.getLength() * 1.4));
      kit.root.add(mesh(new T.TubeGeometry(curve, segs, r, 10), color, { hull: true, edges: false }));
      if (flow > 1e-6) {
        const tex = keep(dashTex().clone()); tex.needsUpdate = true; tex.repeat.set(Math.max(1, curve.getLength() / 10), 1);
        const sl = new T.Mesh(keep(new T.TubeGeometry(curve, segs, r * 1.1, 10)), keep(new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })));
        sl.renderOrder = 2; kit.root.add(sl);
        const sp = Math.min(3, 0.6 + 1.6 * Math.sqrt(flow));
        if (!kit.reduce) kit.onFrame(dt => { tex.offset.x -= sp * dt; });
      }
      return curve;
    }
    // зажим-«крокодил» на верх электрода
    function clip(parent, x, y, z, color) {
      const g = new T.Group(); at(g, x, y, z, parent);
      at(box(2.4, 2.6, 2.2, color), 0, 1.3, 0, g); at(box(1.2, 1.4, 2.4, C.STEEL), 0, -0.4, 0, g);
      return v3(x, y + 2.6, z);
    }
    // бегущие огоньки по кривой (электроны, ионы)
    function stream(parent, curve, n, color, speed = 0.25, r = 0.55) {
      const geo = keep(new T.SphereGeometry(1, 12, 8)), mat = keep(new T.MeshBasicMaterial({ color })), ds = [];
      for (let i = 0; i < n; i++) {
        const m = new T.Mesh(geo, mat); m.scale.setScalar(r); parent.add(m);
        const gl = glow(color, r * 6, 0.55); m.add(gl); gl.scale.setScalar(6); ds.push(m);
      }
      const st = { k: n, sp: speed, dir: 1 };
      kit.onFrame((dt, t) => {
        ds.forEach((m, i) => {
          m.visible = i < st.k; if (!m.visible) return;
          let u = kit.reduce ? (i + 0.5) / n : (t * st.sp + i / n) % 1; if (st.dir < 0) u = 1 - u;
          m.position.copy(curve.getPointAt(u));
        });
      });
      return { set(k, dir = 1, sp) { st.k = k; st.dir = dir; if (sp != null) st.sp = sp; } };
    }
    // HTML-подпись, значение которой можно менять в onFrame
    function liveTag(p, name, value, hot) {
      kit.tag(p, name, value, hot);
      const els = document.querySelectorAll('.rl-view .rl-lbl'), el = els[els.length - 1], i = el && el.querySelector('i');
      let cur = value;
      return v => { if (i && v !== cur) { cur = v; i.textContent = v; } };
    }
    return { v3, glassMat, ownMat, spr, glow, flat, hitBox, ball, rodAB, screen, sticker, pill, button, tray, beaker, liquid, testTube, tubeLiquid, flask, bubbles, puffs, spirit, stand, wire, clip, stream, liveTag, canvasTex };
  }

  // =====================================================================================
  // ЭЛЕКТРОХИМИЯ
  // =====================================================================================

  // ===== 1. Ряд активности: пять стаканов с растворами, пластинка на держателе, поднос с пластинками =====
  SC['chel-series'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const ty = h.tray(g, 0, 2, 122, 78);
    const X = [-42, -21, 0, 21, 42], BZ = -10, R = 7.4, BH = 18, LV = 11.5;
    let curX = null, curPlate = null;
    d.sols.forEach((s, i) => {
      const x = X[i], cur = d.at === i;
      const bk = h.beaker(g, x, ty, BZ, R, BH); clickable(bk.g, 'bk' + i);
      const lq = h.liquid(g, x, ty + 0.6, BZ, R - 0.45, s.col, 0.3 + s.a * 0.75); lq.set(LV);
      const lab = h.sticker(10, 3.8, s.f); at(lab, x, ty + 15, BZ + R + 0.08, g);
      // карточка с результатом для выбранной пластинки
      const txt = s.own ? 'своя соль' : s.tested ? (s.r ? 'реакция ✓' : 'нет') : '?', bg = s.own ? '#dfe3ea' : s.tested ? (s.r ? '#b8f0c8' : '#e8ecf4') : '#fff6e6';
      const card = h.sticker(12, 4.6, txt, '#1b1610', bg); card.rotation.x = -Math.PI / 2; at(card, x, ty + 0.12, BZ + R + 6, g);
      if (cur) {
        curX = x;
        // держатель поперёк стакана и пластинка в растворе
        at(box(2 * R + 5, 1.2, 2.4, C.WOOD2), x, ty + BH + 0.6, BZ, g);
        const pg = new T.Group(); at(pg, x, ty, BZ, g); clickable(pg, 'out'); curPlate = pg;
        at(box(4.6, 23, 0.7, d.pcol), 0, 1.4 + 11.5, 0, pg);
        at(box(5.6, 2.6, 2.6, 0x3b6fd8), 0, 1.4 + 23 - 0.4, 0, pg);
        const tt = h.sticker(3.6, 2.4, d.plate, '#1b1610', '#fffaf0', 128); at(tt, 0, 1.4 + 18.5, 0.4, pg);
        if (s.r && s.ion === 'H') {
          const bub = h.bubbles(g, x, ty + 0.8, BZ, 3.2, 16); bub.set(1, LV - 0.6, 0.45, 0.75);
          const bub2 = h.bubbles(pg, 0, 2, 0, 2.2, 8); bub2.set(1, LV - 2.2, 0.32, 1.1);
        } else if (s.r) {
          // налёт вытесненного металла на погружённой части
          const dc = s.dep, coat = box(4.95, LV - 1.6, 1.05, dc, { edges: false }); at(coat, 0, 1.6 + (LV - 1.6) / 2, 0, pg);
          coat.material = h.ownMat(dc, { transparent: true, opacity: 0 });
          const bits = [];
          for (let k = 0; k < 22; k++) {
            const side = k % 2 ? 1 : -1, y = 2 + rnd(k + 7) * (LV - 3), xx = (rnd(k + 3) - 0.5) * 4.4;
            const b = s.ion === 'Ag' ? cyl(0.18, 1.6 + rnd(k) * 1.4, dc, { r2: 0.02, edges: false, hull: false }) : h.ball(0.35 + rnd(k + 5) * 0.35, dc === 0xd9824f ? 0xa85a30 : dc, { hull: false, seg: 8, seg2: 6 });
            if (s.ion === 'Ag') b.rotation.x = side * (1.1 + rnd(k + 9) * 0.6);
            at(b, xx, y, side * 0.7, pg); b.scale.setScalar(0.01); bits.push(b);
          }
          const col0 = new T.Color(s.col), col1 = new T.Color(s.mix);
          let t0 = null;
          kit.onFrame((dt, t) => {
            if (t0 === null) t0 = t;
            const f = kit.reduce ? 1 : clamp((t - t0) / 3.5, 0, 1);
            coat.material.opacity = 0.92 * f; bits.forEach((b, k) => b.scale.setScalar(Math.max(0.01, clamp(f * 1.6 - k / 30, 0, 1))));
            lq.mat.color.copy(col0).lerp(col1, f);
          });
        }
        tag(v3(x, ty + BH + 10, BZ), d.plate + ' (E° ' + d.Ep + ' В) в ' + s.f, s.own ? 'своя соль — без изменений' : s.r ? (s.ion === 'H' ? 'пузырьки H₂ — реакция идёт' : 'налёт металла — реакция идёт') : 'реакции нет', s.r);
      }
    });
    // поднос с пластинками спереди
    const PZ = 25, PX = [-27, -15, -3, 9];
    at(box(46, 1, 20, 0xdfe5ec), -9, ty + 0.5, PZ, g);
    d.plates.forEach((p, i) => {
      if (p.p === d.plate && d.at !== null) {
        const e = h.sticker(4.6, 13, 'в\nстакане', '#8b96ad', '#eef1f4', 96); e.rotation.x = -Math.PI / 2; at(e, PX[i], ty + 1.06, PZ, g); return;
      }
      const sel = p.p === d.plate, pg = new T.Group(); at(pg, PX[i], ty + 1 + (sel ? 1.6 : 0), PZ, g); clickable(pg, 'pl-' + p.p);
      at(box(4.6, 0.6, 14, p.col), 0, 0.3, 0, pg);
      const lab = h.sticker(3.6, 2.6, p.p, '#1b1610', sel ? '#ffd166' : '#fffaf0', 128); lab.rotation.x = -Math.PI / 2; at(lab, 0, 0.62, 3.6, pg);
      if (sel) { at(h.glow(0xffd166, 18, 0.35), 0, 1, 0, pg); curPlate = curPlate || pg; }
    });
    // пинцет рядом с подносом
    const tw = new T.Group(); at(tw, 20, ty + 0.6, PZ + 2, g); tw.rotation.y = 0.3;
    at(box(1, 0.5, 14, C.STEEL), -0.8, 0, 0, tw).rotation.y = 0.05; at(box(1, 0.5, 14, C.STEEL), 0.8, 0, 0, tw).rotation.y = -0.05;
    // журнал опытов
    const jb = new T.Group(); at(jb, 41, ty, PZ); jb.rotation.y = -0.25;
    at(box(22, 1.2, 16, 0x3b6fd8), 0, 0.6, 0, jb);
    const page = h.sticker(20, 14, `Опыты: ${d.n} из 16\nреакций: ${d.found}`, '#1b1610', '#fffaf0', 320); page.rotation.x = -Math.PI / 2; at(page, 0, 1.25, 0, jb);
    if (curX === null) tag(v3(PX[d.plates.findIndex(p => p.p === d.plate)], ty + 6, PZ), 'Пластинка ' + d.plate, 'E° = ' + d.Ep + ' В · в стакан!');
  };

  // ===== 2. Гальванический элемент: два полуэлемента, солевой мостик, вольтметр, ключ и лампочка =====
  SC['chel-cell'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, placeOn, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const ty = h.tray(g, 0, 0, 122, 82);
    const BZ = -6, R = 10, BH = 22, LV = 15, side = [{ k: 'L', x: -21, ex: -26.5 }, { k: 'R', x: 21, ex: 26.5 }];
    const tops = {};
    side.forEach(sd => {
      const m = d[sd.k];
      const bk = h.beaker(g, sd.x, ty, BZ, R, BH);
      const lq = h.liquid(g, sd.x, ty + 0.6, BZ, R - 0.45, m.sol, 0.3 + m.sa * 0.75); lq.set(LV);
      const lab = h.sticker(10, 3.4, m.salt); at(lab, sd.x + 2, ty + 18.6, BZ + R + 0.08, g);
      // пластинка-электрод
      const el = new T.Group(); at(el, sd.ex, ty, BZ, g); clickable(el, 'el' + sd.k);
      at(box(6, 27, 0.8, m.col), 0, 1.5 + 13.5, 0, el);
      const st = h.sticker(3.6, 2.6, m.m, '#1b1610', '#fffaf0', 128); at(st, 0, 1.5 + 21, 0.45, el);
      tops[sd.k] = h.clip(g, sd.ex, ty + 28.5, BZ, sd.k === d.an ? 0x2f6fd8 : 0xe0473a);
      // на катоде при замкнутой цепи оседает металл
      if (d.closed && d.an && d.an !== sd.k) {
        const bits = [];
        for (let k = 0; k < 18; k++) { const b = h.ball(0.35 + rnd(k + 2) * 0.3, m.dep, { hull: false, seg: 8, seg2: 6 }); at(b, (rnd(k) - 0.5) * 5.4, 2.5 + rnd(k + 4) * (LV - 4), (k % 2 ? 1 : -1) * 0.55, el); b.scale.setScalar(0.01); bits.push(b); }
        let t0 = null;
        kit.onFrame((dt, t) => { if (t0 === null) t0 = t; const f = kit.reduce ? 1 : clamp((t - t0) / 6, 0, 1); bits.forEach((b, k) => b.scale.setScalar(Math.max(0.01, clamp(f * 1.5 - k / 26, 0, 1)))); });
      }
      const role = d.an ? (d.an === sd.k ? 'анод (−)' : 'катод (+)') : '';
      tag(v3(sd.x + (sd.k === 'L' ? -8 : 10), ty + BH + 2, BZ + 8), m.m + ' | ' + m.salt, role || 'E° ' + m.E + ' В', false);
    });
    // солевой мостик: перевёрнутая U-трубка с гелем KNO₃
    const bg = new T.Group(); at(bg, 0, d.bridge ? 0 : 13, d.bridge ? 0 : 2, g); clickable(bg, 'bridge');
    const by0 = ty + 6, pts = [v3(-14.5, by0, BZ), v3(-14.5, ty + 24, BZ), v3(-12, ty + 30, BZ), v3(0, ty + 31.5, BZ), v3(12, ty + 30, BZ), v3(14.5, ty + 24, BZ), v3(14.5, by0, BZ)];
    const bc = new T.CatmullRomCurve3(pts, false, 'centripetal');
    const gl = new T.Mesh(kit.keep(new T.TubeGeometry(bc, 80, 1.7, 14)), h.glassMat(0xd8eef8, 0.3)); bg.add(gl); gl.add(new T.Mesh(gl.geometry, kit.hullMat));
    bg.add(new T.Mesh(kit.keep(new T.TubeGeometry(bc, 80, 1.25, 10)), h.ownMat(0xf2f5fa, { transparent: true, opacity: 0.75, depthWrite: false })));
    at(cyl(1.5, 1.4, 0xffffff, { edges: false }), -14.5, by0 - 0.3, BZ, bg); at(cyl(1.5, 1.4, 0xffffff, { edges: false }), 14.5, by0 - 0.3, BZ, bg);
    const bs = h.sticker(6, 2.4, 'KNO₃', '#1b1610', '#fffaf0', 128); at(bs, 0, ty + 33.6, BZ + 0.2, bg);
    if (d.closed) {
      // ионы в мостике: K⁺ идут к катоду, NO₃⁻ — к аноду
      const toCat = d.an === 'L' ? 1 : -1;
      h.stream(bg, bc, 5, 0xc89cf0, 0.12, 0.5).set(5, toCat);
      h.stream(bg, bc, 5, 0xffa040, 0.12, 0.5).set(5, -toCat);
    }
    // ключ и лампочка спереди, вольтметр сзади посередине
    const kn = kit.knife({ closed: d.sw, click: 'sw' }); const kN = placeOn(kn, v3(-12, ty, 26), 0, 'sw');
    const bl = kit.bulb({ glow: d.glow * 1.1, value: '' }); const bN = placeOn(bl, v3(14, ty, 26), 0, 'lamp');
    const chain = [
      [tops.L, v3(-29, ty + 31, BZ + 3), v3(-34, ty + 14, 8), v3(-30, ty + 3, 22), v3(-22, ty + 2.5, 26), kN.tin],
      [kN.tout, v3(-1, ty + 2.4, 27), bN.tin],
      [bN.tout, v3(26, ty + 2.5, 24), v3(33, ty + 4, 18), v3(35, ty + 15, 6), v3(29, ty + 31, BZ + 3), tops.R],
    ];
    const cols = [C.WIRE.minus, C.WIRE.mid, C.WIRE.plus];
    chain.forEach((p, i) => { const pp = d.an === 'R' ? p.slice().reverse() : p; h.wire(pp, d.an === 'R' ? cols[2 - i] : cols[i], d.closed ? 1 : 0); });
    // цифровой вольтметр: «+» к правой пластинке
    const vm = new T.Group(); at(vm, 0, ty, -31);
    at(box(18, 1.4, 12, C.DARK), 0, 0.7, 0, vm);
    const body = new T.Group(); at(body, 0, 1.4, 0, vm); body.rotation.x = -0.25;
    at(box(16, 22, 5, 0xf2c94c), 0, 11, 0, body);
    const ok = d.E >= 1.5 - 1e-9;
    const scr = h.screen(12.4, 5.4, d.Etxt, ok ? '#86e0a8' : '#e8ecf4'); at(scr, 0, 17, 2.56, body);
    const knob = cyl(3.2, 1.2, 0x2c3240); knob.rotation.x = Math.PI / 2; at(knob, 0, 9.5, 2.9, body);
    at(box(0.6, 0.3, 2.6, 0xffffff, { edges: false }), 0, 9.5, 3.6, body).rotation.z = 0.6;
    at(cyl(1, 1.4, 0x26324a), -4, 3.5, 2.8, body).rotation.x = Math.PI / 2; at(cyl(1, 1.4, 0xe0473a), 4, 3.5, 2.8, body).rotation.x = Math.PI / 2;
    vm.updateMatrixWorld(true);
    const sB = v3(-4, 3.5, 3.6).applyMatrix4(body.matrixWorld), sR = v3(4, 3.5, 3.6).applyMatrix4(body.matrixWorld);
    h.wire([sB, v3(-6, ty + 2, -24), v3(-16, ty + 3, -22), v3(-28, ty + 18, -14), v3(-27.5, ty + 33, BZ - 1), tops.L.clone().add(v3(0, 0, -0.6))], 0x2a2f3a, 0, 0.55);
    h.wire([sR, v3(6, ty + 2, -24), v3(16, ty + 3, -22), v3(28, ty + 18, -14), v3(27.5, ty + 33, BZ - 1), tops.R.clone().add(v3(0, 0, -0.6))], 0xe0473a, 0, 0.55);
    tag(v3(0, ty + 27, -31), 'Вольтметр', d.Etxt, ok);
    tag(v3(14, ty + 22, 26), 'Лампочка', d.glow > 0 ? 'горит' : d.bridge ? (d.sw ? 'не горит' : 'ключ разомкнут') : 'мостик поднят', d.glow > 0);
  };

  // ===== 3. Электролиз: стакан (или тигель с расплавом), графитовые электроды, источник тока =====
  SC['chel-ely'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const ty = h.tray(g, 4, 2, 112, 78);
    const melt = d.ely === 'melt', BX = 10, BZ = -6, R = 13, BH = melt ? 18 : 24, LV = melt ? 13 : 16.5, xc = BX - 6.5, xa = BX + 6.5;
    const vessel = new T.Group(); at(vessel, 0, 0, 0, g); clickable(vessel, 'ely');
    let y0 = ty, lq;
    if (melt) {
      // электропечь-плитка и фарфоровый тигель с раскалённым расплавом
      at(box(34, 6, 30, 0x3b4a66), BX, ty + 3, BZ, vessel); at(box(32, 0.6, 28, 0x4a5b7c), BX, ty + 6.3, BZ, vessel);
      at(box(1.4, 1.4, 0.6, 0xff4a3a, { edges: false, matOpt: { emissive: 0xff3a2a, emissiveIntensity: 1 } }), BX - 13, ty + 3.2, BZ + 15.1, vessel);
      y0 = ty + 6.6;
      const cr = h.ownMat(0xf4f1ea), cw = new T.Mesh(kit.keep(new T.CylinderGeometry(R, R * 0.82, BH, 40, 1, true)), h.ownMat(0xf4f1ea, { side: T.DoubleSide }));
      at(cw, BX, y0 + BH / 2, BZ, vessel); cw.add(new T.Mesh(cw.geometry, kit.hullMat));
      at(cyl(R * 0.82, 0.8, 0xf4f1ea, { mat: cr }), BX, y0 + 0.4, BZ, vessel);
      lq = h.liquid(vessel, BX, y0 + 0.8, BZ, R * 0.95, 0xff8a3c, 0.95); lq.set(LV); lq.mat.emissive = new T.Color(0xff5a10); lq.mat.emissiveIntensity = 0.55;
      at(h.glow(0xff7a2a, 40, 0.45), BX, y0 + LV + 2, BZ, vessel);
      at(new T.PointLight(0xff7a3a, 30, 60, 1.4), BX, y0 + LV + 6, BZ, vessel);
      const tl = h.sticker(16, 3.2, 'расплав NaCl · 800 °C', '#1b1610', '#fffaf0', 320); at(tl, BX, ty + 3, BZ + 15.06, vessel);
    } else {
      h.beaker(vessel, BX, ty, BZ, R, BH);
      lq = h.liquid(vessel, BX, ty + 0.6, BZ, R - 0.45, d.sol, 0.3 + d.a * 0.75); lq.set(LV);
      const tl = h.sticker(11, 3.4, d.f); at(tl, BX, ty + 21, BZ + R + 0.08, vessel);
    }
    // крышка-планка с двумя графитовыми стержнями
    const ytop = y0 + BH;
    at(box(2 * R + 6, 1.6, 6, 0xe8ecf4), BX, ytop + 0.8, BZ, g);
    for (const x of [xc, xa]) { at(cyl(1.2, 30, 0x3b4150, { seg: 16 }), x, ytop - 13, BZ, g); }
    const pC = h.clip(g, xc, ytop + 2, BZ, 0x2f6fd8), pA = h.clip(g, xa, ytop + 2, BZ, 0xe0473a);
    // катод: налёт меди / капли натрия; раствор у катода малиновеет (фенолфталеин + OH⁻)
    const coat = cyl(1, LV - 1.2, 0xc8743f, { edges: false, seg: 16 }); at(coat, xc, y0 + 1.6 + (LV - 1.2) / 2 - 0.6, BZ, g); coat.visible = false;
    const setCoat = m => { coat.visible = d.cat === 'Cu' && m > 0.0005; const r = 1.22 + 1.6 * clamp(m, 0, 1.3) / 1.3; coat.scale.set(r, 1, r); };
    const naDrops = [];
    if (d.cat === 'Na') for (let i = 0; i < 7; i++) { const b = h.ball(0.9 + rnd(i) * 0.4, 0xdfe4ea, { seg: 12, seg2: 8 }); b.scale.y = 0.5; at(b, xc - 3 - rnd(i + 3) * 7, y0 + LV + 1.1, BZ + (rnd(i + 6) - 0.5) * 12, g); b.visible = false; naDrops.push(b); }
    let pink = null;
    if (d.cat === 'H2') { pink = new T.Mesh(kit.keep(new T.CylinderGeometry(6, 6, LV - 1.5, 24)), h.ownMat(0xe0408f, { transparent: true, opacity: 0, depthWrite: false })); at(pink, xc - 1.5, y0 + 1.2 + (LV - 1.5) / 2, BZ, g); }
    const col0 = new T.Color(d.sol);
    // пузырьки газа у электродов
    const bubC = d.cat === 'H2' ? h.bubbles(g, xc, y0 + 1, BZ, 1.8, 14, 0xffffff) : null;
    const bubA = h.bubbles(g, xa, y0 + 1, BZ, 1.8, d.an === 'O2' ? 8 : 14, d.an === 'Cl2' ? 0xe6f27a : 0xffffff);
    const cl = d.an === 'Cl2' ? h.puffs(g, xa + 2, ytop + 1.5, BZ, { n: 6, color: 0xd8e86a, spread: 7, rise: 9, size: 5, op: 0.55, amt: 0 }) : null;
    // источник постоянного тока: табло, кнопка «сеть», ▲▼ — сила тока
    const SX = -34, SZ = 14, sg = new T.Group(); at(sg, SX, ty, SZ, g);
    at(box(26, 16, 15, 0x3b4a66), 0, 8, 0, sg); at(box(24, 1.2, 13, 0x4a5b7c), 0, 16.6, 0, sg);
    const scr = h.screen(14, 7, '', '#86e0a8', 320, 160); at(scr, -3.5, 9.5, 7.56, sg);
    const pw = new T.Group(); at(pw, 8, 9.5, 7.5, sg); clickable(pw, 'run');
    const pb = cyl(2.6, 1.6, d.run ? 0x3fae5a : 0xe0473a); pb.rotation.x = Math.PI / 2; at(pb, 0, 0, 0.8, pw);
    at(h.flat(3.4, 3.4, kit.textTex('⏻', '#ffffff', d.run ? '#3fae5a' : '#e0473a', 96, 96)), 0, 0, 1.62, pw);
    if (d.run) at(h.glow(0x3fae5a, 9, 0.45), 0, 0, 2, pw);
    h.button(sg, -6, 17.2, 2.5, '▲', 0x3fae5a, 'i+'); h.button(sg, -1, 17.2, 2.5, '▼', 0xe0473a, 'i-');
    h.button(sg, 6.5, 17.2, 2.5, '0', 0x8b96ad, 'reset');
    const tm = v3(SX - 6, ty + 18, SZ - 4), tp = v3(SX + 6, ty + 18, SZ - 4);
    at(cyl(1.3, 2.4, 0x26324a), tm.x, tm.y - 0.6, tm.z); at(cyl(1.3, 2.4, 0xe0473a), tp.x, tp.y - 0.6, tp.z);
    const sm = h.sticker(2.4, 2.4, '−', '#ffffff', '#26324a', 64); sm.rotation.x = -Math.PI / 2; at(sm, tm.x, ty + 16.92, tm.z + 3, g);
    const spl = h.sticker(2.4, 2.4, '+', '#ffffff', '#e0473a', 64); spl.rotation.x = -Math.PI / 2; at(spl, tp.x, ty + 16.92, tp.z + 3, g);
    // электроны: от «−» к катоду, от анода к «+»
    h.wire([tm.clone().setY(tm.y + 0.6), v3(SX - 6, ty + 23, SZ - 6), v3(xc - 10, ytop + 5, BZ - 2), v3(xc - 1, ytop + 6, BZ), pC], C.WIRE.minus, d.run ? d.I : 0);
    h.wire([pA, v3(xa + 1, ytop + 7, BZ - 2), v3(BX, ytop + 8, BZ - 12), v3(xc - 12, ytop + 3, BZ - 10), v3(SX + 6, ty + 23, SZ - 6), tp.clone().setY(tp.y + 0.6)], C.WIRE.plus, d.run ? d.I : 0);
    // фенолфталеин в капельнице
    if (d.cat === 'H2') {
      const dr = new T.Group(); at(dr, 42, ty, 22, g);
      at(cyl(3, 7, 0x8a5a2a, { matOpt: { transparent: true, opacity: 0.85 } }), 0, 3.5, 0, dr); at(cyl(1, 2.4, 0xf2f2f2), 0, 8.2, 0, dr); at(cyl(1.6, 2.4, 0xe0408f, { r2: 1.2 }), 0, 10.4, 0, dr);
      const s = h.sticker(6.2, 2.4, 'фенолфт.', '#1b1610', '#fffaf0', 160); at(s, 0, 3.6, 3.06, dr);
    }
    const gas = { O2: 'O₂', Cl2: 'Cl₂' }[d.an], catName = { Cu: 'медь Cu', H2: 'водород H₂', Na: 'натрий Na' }[d.cat];
    const fm = L => d.cat === 'Cu' || d.cat === 'Na' ? fmt(L.mass, 3) + ' г ' + d.cat : fmt(L.Vc * 1000, 0) + ' мл H₂';
    const L0 = live() || { t: 0, mass: 0, Vc: 0, Va: 0 };
    const setSrc = h.liveTag(v3(SX, ty + 21, SZ), 'Источник тока', fmt(d.I, 1) + ' А · ' + L0.t + ' мин', d.run);
    const setC = h.liveTag(v3(xc - 6, ytop + 12, BZ - 8), 'Катод (−) · ' + catName, fm(L0), false);
    const setA = h.liveTag(v3(xa + 16, ytop + 4, BZ + 4), 'Анод (+) · ' + gas, fmt(L0.Va * 1000, 0) + ' мл ' + gas, false);
    kit.onFrame(() => {
      const L = live() || L0, run = !!L.run;
      scr.userData.set(fmt(d.I, 1) + ' А\n' + L.t + ' мин', run ? '#ffb547' : '#86e0a8');
      setSrc(fmt(d.I, 1) + ' А · ' + L.t + ' мин'); setC(fm(L)); setA(fmt(L.Va * 1000, 0) + ' мл ' + gas);
      setCoat(L.mass);
      naDrops.forEach((b, i) => { b.visible = d.cat === 'Na' && L.mass > 0 && i < Math.min(7, 1 + Math.floor(L.mass)); });
      if (d.cat === 'Cu' && !melt) { lq.mat.opacity = (0.3 + d.a * 0.75) * clamp(1 - L.mass / 6.4, 0.45, 1); lq.mat.color.copy(col0).lerp(new T.Color(0xdfe7ee), clamp(L.mass / 6.4, 0, 0.6)); }
      if (pink) pink.material.opacity = clamp(L.t / 10, 0, 0.42);
      if (bubC) bubC.set(run ? 1 : L.t > 0 ? 0.25 : 0, LV - 0.8, 0.42, run ? 0.9 : 0);
      bubA.set(run ? 1 : L.t > 0 ? 0.2 : 0, LV - 0.8, d.an === 'O2' ? 0.38 : 0.45, run ? 0.8 : 0);
      if (cl) cl.set(run || L.t > 0 ? clamp(L.t / 30, 0.25, 1) : 0);
    });
  };

  // ===== 4. Коррозия: штатив с четырьмя пробирками, гвозди, цинк, медь, краска, календарь =====
  SC['chel-cor'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const ty = h.tray(g, 0, 4, 122, 76);
    const TX = [-30, -10, 10, 30], TZ = -10, TR = 3.6, THH = 30, y0 = ty + 1.4, steel = new T.Color(0x9aa3ae), rustC = new T.Color(0x9a4a1c);
    // деревянный штатив для пробирок
    at(box(82, 1.4, 12, C.WOOD2), 0, ty + 0.7, TZ, g);
    at(box(82, 1.2, 12, C.WOOD), 0, ty + 17, TZ, g);
    for (const x of [-40, 40]) at(box(2, 17, 12, C.WOOD2), x, ty + 8.6, TZ, g);
    const tubes = d.envs.map((e, i) => {
      const x = TX[i], act = e.id === d.env, tg = new T.Group(); at(tg, x, 0, TZ, g); clickable(tg, 'env-' + e.id);
      h.testTube(tg, 0, y0, 0, TR, THH);
      at(h.hitBox(2 * TR + 1, THH, 2 * TR + 1), 0, y0 + THH / 2, 0, tg);
      const lv = 18;
      if (e.water) {
        const lq = h.tubeLiquid(tg, TR, lv, e.salt ? 0xcfe3f2 : 0x8fc6ea, e.salt ? 0.45 : 0.42); lq.g.position.y = y0;
        if (!e.o2) { const oil = cyl(TR * 0.88, 3, 0xe6c25a, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.8 } }); at(oil, 0, y0 + lv + 1.5, 0, tg); }
        if (e.salt) for (let k = 0; k < 6; k++) at(box(0.6, 0.6, 0.6, 0xffffff, { edges: false }), (rnd(k + 40) - 0.5) * 3, y0 + 1 + rnd(k) * 0.6, (rnd(k + 41) - 0.5) * 3, tg);
      } else {
        // хлорид кальция поглощает влагу
        for (let k = 0; k < 16; k++) at(h.ball(0.8 + rnd(k) * 0.4, 0xf2f4f6, { seg: 8, seg2: 6 }), (rnd(k + 60) - 0.5) * 4.2, y0 + 1 + rnd(k + 61) * 4, (rnd(k + 62) - 0.5) * 4.2, tg);
      }
      if (!e.water || !e.o2) at(cyl(TR + 0.5, 3.4, 0x5b4a3a, { r2: TR + 1 }), 0, y0 + THH + 0.8, 0, tg);
      // гвоздь
      const paint = act && d.paint, nm = h.ownMat(paint ? 0x4f7bd6 : 0x9aa3ae);
      const nail = new T.Group(); at(nail, 0, y0 + 0.7, 0, tg);
      at(mesh(new T.CylinderGeometry(0.55, 0.05, 2.2, 12), 0, { mat: nm, edges: false, hull: true }), 0, 1.1, 0, nail);
      at(mesh(new T.CylinderGeometry(0.55, 0.55, 19, 12), 0, { mat: nm, edges: false, hull: true }), 0, 2.2 + 9.5, 0, nail);
      at(mesh(new T.CylinderGeometry(1.5, 1.5, 0.6, 18), 0, { mat: nm, edges: false, hull: true }), 0, 21.5, 0, nail);
      // пятна ржавчины на мокрой части, хлопья на дне
      const wetTop = e.water ? lv - 1 : 20, spots = [];
      for (let k = 0; k < 40; k++) {
        const a = rnd(k + i * 50) * Math.PI * 2, yy = 1.5 + rnd(k + 7 + i * 50) * (wetTop - 2);
        const s = h.ball(0.35 + rnd(k + 3) * 0.45, rnd(k + 5) > 0.5 ? 0x9a4a1c : 0xc0652a, { hull: false, seg: 8, seg2: 6 }); s.scale.y = 0.7;
        at(s, Math.cos(a) * 0.5, yy, Math.sin(a) * 0.5, nail); s.visible = false; spots.push(s);
      }
      const flakes = [];
      for (let k = 0; k < 10; k++) { const f = box(0.7, 0.25, 0.7, 0xb35a24, { edges: false }); at(f, (rnd(k + 90) - 0.5) * 4, y0 + 0.9, (rnd(k + 91) - 0.5) * 4, tg); f.visible = false; flakes.push(f); }
      // цинк или медь, прикрученные к гвоздю
      let zn = null;
      if (act && d.contact === 'zn') { zn = box(2.4, 6, 0.6, 0xa7b4c3); at(zn, 1.1, y0 + 8, 0.2, tg); for (let k = 0; k < 3; k++) at(mesh(new T.TorusGeometry(0.75, 0.15, 6, 16), 0xc6ccd6, { edges: false }), 0, y0 + 6.2 + k * 1.8, 0, tg).rotation.x = Math.PI / 2; }
      if (act && d.contact === 'cu') {
        const pts = []; for (let k = 0; k <= 80; k++) { const a = k / 80 * Math.PI * 2 * 5; pts.push(v3(Math.cos(a) * 0.9, 6 + k / 80 * 7, Math.sin(a) * 0.9)); }
        pts.push(v3(1.4, 15, 0.4), v3(2.4, 19, 0.6));
        at(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 200, 0.24, 6), 0xd9824f, { edges: false }), 0, y0, 0, tg);
      }
      const znWhite = [];
      if (zn) for (let k = 0; k < 14; k++) { const b = h.ball(0.3 + rnd(k) * 0.25, 0xf6f7f9, { hull: false, seg: 6, seg2: 5 }); at(b, 1.1 + (rnd(k + 1) - 0.5) * 2.2, y0 + 5.4 + rnd(k + 2) * 5.2, 0.6, tg); b.visible = false; znWhite.push(b); }
      // наклейка на штативе
      const st = h.sticker(13, 3.4, e.short, '#1b1610', act ? '#ffd166' : '#fffaf0', 192); at(st, x, ty + 17, TZ + 6.08, g);
      return { e, act, nm, spots, flakes, zn, znWhite, wetTop };
    });
    // поднос с цинком, медью и краской
    const PZ = 26;
    const dish = (x, key, label) => { const dg = new T.Group(); at(dg, x, ty, PZ, g); clickable(dg, key); at(cyl(7, 1, 0xdfe5ec, { seg: 30 }), 0, 0.5, 0, dg); const s = h.sticker(7, 2.6, label, '#1b1610', '#fffaf0', 160); at(s, 0, 0.6, 7.06, dg); return dg; };
    const dz = dish(-34, 'zn', 'цинк');
    if (d.contact !== 'zn') at(box(2.6, 0.6, 9, 0xa7b4c3), 0, 1.3, 0, dz).rotation.y = 0.5;
    const dc = dish(-17, 'cu', 'медь');
    if (d.contact !== 'cu') { const t = mesh(new T.TorusGeometry(3.4, 0.35, 8, 40), 0xd9824f, { edges: false }); t.rotation.x = Math.PI / 2; at(t, 0, 1.4, 0, dc); const t2 = mesh(new T.TorusGeometry(2.8, 0.35, 8, 40), 0xd9824f, { edges: false }); t2.rotation.x = Math.PI / 2; at(t2, 0, 2, 0, dc); }
    // банка краски с кисточкой
    const pg = new T.Group(); at(pg, 1, ty, PZ, g); clickable(pg, 'paint');
    at(cyl(5, 8, 0xc6ccd6), 0, 4, 0, pg); at(cyl(4.6, 0.4, 0x4f7bd6, { edges: false }), 0, 8.1, 0, pg);
    const ps = h.sticker(7, 3, 'краска', '#ffffff', '#4f7bd6', 160); at(ps, 0, 4, 5.03, pg);
    const br = new T.Group(); at(br, 1.5, 9, 0, pg); br.rotation.z = -0.5;
    at(box(1.2, 10, 0.8, 0xc98f55), 0, 5, 0, br); at(box(2.2, 3, 1, d.paint ? 0x4f7bd6 : 0x2c3240), 0, 0, 0, br);
    // календарь-таймер: «день N», кнопка пуск/пауза
    const cg = new T.Group(); at(cg, 28, ty, PZ - 1); cg.rotation.y = -0.3;
    at(box(20, 1.4, 12, C.DARK), 0, 0.7, 0, cg);
    const cb = new T.Group(); at(cb, 0, 1.4, -1, cg); cb.rotation.x = -0.35;
    at(box(18, 11, 3.6, 0xf3f4f6), 0, 5.5, 0, cb); at(box(18, 2.6, 3.8, 0xe0473a), 0, 9.9, 0, cb);
    const cs = h.screen(14, 6, '', '#1b1610', 320, 140); cs.material.map.needsUpdate = true; at(cs, 0, 4.6, 1.85, cb);
    const go = new T.Group(); at(go, 6.5, 11.4, 0, cb); clickable(go, 'run');
    at(cyl(2, 1, C.DARK), 0, 0.5, 0, go); at(cyl(1.6, d.run ? 0.8 : 1.6, d.run ? 0x3fae5a : 0xe0473a), 0, d.run ? 1.4 : 1.8, 0, go);
    clickable(cb, 'run');
    const act = tubes.find(t => t.act), L0 = live() || { days: d.days || 0 };
    const rustOf = (t, days) => Math.min(100, 2.5 * t.e.rate * (t.act ? d.f : 1) * days);
    const znOf = days => d.contact === 'zn' ? Math.min(100, 2.5 * act.e.rate * 1.2 * days) : 0;
    const name = act.e.name + (d.paint ? ' · краска' : d.contact === 'zn' ? ' · цинк' : d.contact === 'cu' ? ' · медь' : '');
    const val = days => 'ржавчина ' + fmt(rustOf(act, days), 0) + ' %' + (d.contact === 'zn' ? ' · Zn −' + fmt(znOf(days), 0) + ' %' : '');
    const setT = h.liveTag(v3(TX[d.envs.findIndex(e => e.id === d.env)], y0 + THH + 6, TZ), name, val(L0.days), rustOf(act, L0.days) > 0);
    const setD = h.liveTag(v3(28, ty + 18, PZ - 2), 'Прошло', 'день ' + L0.days, false);
    kit.onFrame(() => {
      const L = live() || L0, days = L.days ?? 0;
      cs.userData.set('день ' + days, '#1b1610');
      setT(val(days)); setD('день ' + days);
      tubes.forEach(t => {
        const r = rustOf(t, days), n = Math.round(r * 0.4);
        t.spots.forEach((s, k) => { s.visible = k < n; });
        t.flakes.forEach((f, k) => { f.visible = k < Math.round(r / 10); });
        if (!(t.act && d.paint)) t.nm.color.copy(steel).lerp(rustC, r / 100 * 0.55);
        if (t.zn) { const z = znOf(days); t.zn.scale.set(1 - z / 100 * 0.5, 1 - z / 100 * 0.3, 1); t.znWhite.forEach((b, k) => { b.visible = k < Math.round(z / 6); }); }
      });
    });
  };

  // =====================================================================================
  // ОВР
  // =====================================================================================
  const ATOMC = { H: 0xeef2f8, O: 0xe5533f, N: 0x4d7cf0, C: 0x4f586d, S: 0xe6c63a, Cl: 0x5fc46a, Na: 0xb88cf0, K: 0xd58cf0, Mn: 0xa06ad0, Fe: 0xc58a5c, Zn: 0x9aa7bd, Cu: 0xd9895b, Al: 0xb5c0d3 };
  const ATOMR = { H: 1.5, O: 2, N: 2.1, C: 2.1, S: 2.5, Cl: 2.4, Na: 2.6, K: 2.9, Mn: 2.6, Fe: 2.6, Zn: 2.4, Cu: 2.4, Al: 2.5 };
  // положения атомов модели молекулы (центр — искомый атом)
  function molLayout(f) {
    const td = [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]].map(p => p.map(c => c / Math.sqrt(3)));
    if (f === 'Cl2') return { at: [['Cl', -2.3, 0, 0, 1], ['Cl', 2.3, 0, 0, 1]], bonds: [[0, 1]] };
    if (f === 'NH3') return { at: [['N', 0, 1, 0, 1], ...[0, 1, 2].map(k => { const a = k * 2.094; return ['H', Math.cos(a) * 3.4, -0.6, Math.sin(a) * 3.4, 0]; })], bonds: [[0, 1], [0, 2], [0, 3]] };
    if (f === 'H2SO4') { const O = td.map(p => ['O', p[0] * 4.4, p[1] * 4.4, p[2] * 4.4, 0]); return { at: [['S', 0, 0, 0, 1], ...O, ['H', O[0][1] * 1.55, O[0][2] * 1.55 + 1, O[0][3] * 1.55, 0], ['H', O[1][1] * 1.55, O[1][2] * 1.55 + 1, O[1][3] * 1.55, 0]], bonds: [[0, 1], [0, 2], [0, 3], [0, 4], [1, 5], [2, 6]] }; }
    if (f === 'KMnO4') { const O = td.map(p => ['O', p[0] * 4.4, p[1] * 4.4, p[2] * 4.4, 0]); return { at: [['Mn', 0, 0, 0, 1], ...O, ['K', O[1][1] * 2.2, O[1][2] * 2.2, O[1][3] * 2.2, 0]], bonds: [[0, 1], [0, 2], [0, 3], [0, 4], [2, 5]] }; }
    return { at: [['O', -8.6, -1.6, 0, 0], ['Fe', -4.4, 0.6, 0, 1], ['O', 0, -1.6, 0, 0], ['Fe', 4.4, 0.6, 0, 1], ['O', 8.6, -1.6, 0, 0]], bonds: [[0, 1], [1, 2], [2, 3], [3, 4]] };
  }

  // ===== 5. Степень окисления: склянки с веществами, модель молекулы с таблетками, весы зарядов, шкала x =====
  SC['chel-ox'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const ty = h.tray(g, 0, 2, 122, 80);
    // склянки с веществами в заднем ряду
    const RX = [-44, -22, 0, 22, 44], RZ = -26;
    d.cmps.forEach((c, i) => {
      const x = RX[i], sel = i === d.cmp, rg = new T.Group(); at(rg, x, ty, RZ, g); clickable(rg, 'c-' + i);
      if (sel) { at(cyl(8, 0.6, 0xffd166, { edges: false }), 0, 0.3, 0, rg); at(h.glow(0xffd166, 22, 0.25), 0, 6, 0, rg); }
      if (c.k === 'Cl2') {
        const fl = h.flask(rg, 0, 0.6, 0, 5.4, 6);
        at(h.ball(5.1, 0xc8e05a, { hull: false, matOpt: { transparent: true, opacity: 0.55 } }), 0, 0.6 + 5.4, 0, rg);
        at(cyl(1.6, 2.6, 0xeef6fb, { r2: 1.9 }), 0, 0.6 + fl.top + 0.6, 0, rg);
      } else if (c.k === 'NH3' || c.k === 'H2SO4') {
        const bc = c.k === 'NH3' ? 0xd8eef8 : 0xcfd8de;
        at(cyl(4.4, 12, bc, { matOpt: { transparent: true, opacity: 0.45, depthWrite: false } }), 0, 0.6 + 6, 0, rg);
        at(cyl(4.1, 8, c.k === 'NH3' ? 0xe6f2fa : 0xf4f1e0, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.6, depthWrite: false } }), 0, 0.6 + 4.2, 0, rg);
        at(cyl(1.8, 3, bc, { r2: 2.2, matOpt: { transparent: true, opacity: 0.6 } }), 0, 0.6 + 13.4, 0, rg);
        at(cyl(2.4, 2.4, c.k === 'NH3' ? 0x2f6fd8 : 0xeef6fb, { r2: 2 }), 0, 0.6 + 15.8, 0, rg);
      } else if (c.k === 'KMnO4') {
        const bk = h.beaker(rg, 0, 0.6, 0, 5, 11);
        const lq = h.liquid(rg, 0, 1.2, 0, 4.6, 0x7a1f9c, 0.85); lq.set(7.5);
        for (let k = 0; k < 7; k++) at(box(0.8, 0.5, 0.6, 0x3a0a4a, { edges: false }), (rnd(k) - 0.5) * 6, 1.3, (rnd(k + 2) - 0.5) * 6, rg);
      } else {
        at(cyl(6.4, 1.2, 0xeef6fb, { r2: 6.8, matOpt: { transparent: true, opacity: 0.6 } }), 0, 1.2, 0, rg);
        at(mesh(new T.SphereGeometry(4.6, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0xa0401f, { hull: true, edges: false }), 0, 1.6, 0, rg).scale.y = 0.55;
      }
      const s = h.sticker(9.6, 3.2, c.f + (c.found ? ' ✓' : ''), '#1b1610', c.found ? '#b8f0c8' : sel ? '#ffd166' : '#fffaf0', 200); s.rotation.x = -Math.PI / 2; at(s, 0, 0.12, 8, rg);
    });
    // модель молекулы на подставке; над атомами — таблетки степеней окисления
    const MX = -18, MZ = 4, MY = ty + 21;
    at(cyl(5, 1.2, C.DARK), MX, ty + 0.6, MZ, g); at(cyl(0.5, 15, C.STEEL, { edges: false }), MX, ty + 8.5, MZ, g);
    const mol = new T.Group(); at(mol, MX, MY, MZ, g); mol.scale.setScalar(1.7);
    const lay = molLayout(d.k), atoms = [];
    const xc = d.found ? '#86e0a8' : '#ffb547';
    lay.at.forEach(([s, x, y, z, isX]) => {
      const b = h.ball(ATOMR[s], ATOMC[s], { seg: 22, seg2: 16 }); at(b, x, y, z, mol);
      const p = h.pill(g, 0, 0, 0, isX ? (d.found ? ox(d.x) + ' ✓' : 'x = ' + ox(d.x)) : ox(d.known[s]), isX ? '#1b1610' : '#1b1610', isX ? xc : '#fff6e6', 3.2);
      if (isX) p.m.renderOrder = 8; atoms.push({ b, p, r: ATOMR[s] * 1.7 });
    });
    lay.bonds.forEach(([a, b]) => { const A = v3(...lay.at[a].slice(1, 4)), B = v3(...lay.at[b].slice(1, 4)); h.rodAB(mol, A, B, 0.55, 0xd9dfe9); });
    const wp = new T.Vector3();
    kit.onFrame((dt, t) => {
      mol.rotation.y = kit.reduce ? 0.5 : 0.5 + Math.sin(t * 0.35) * 0.6;
      mol.updateMatrixWorld(true);
      atoms.forEach(a => { a.b.getWorldPosition(wp); a.p.m.position.set(wp.x, wp.y + a.r + 0.4, wp.z); });
    });
    // весы зарядов: слева плюсы, справа минусы
    const BX = 28, BZ = 4, BY = ty + 22;
    at(box(26, 1.6, 12, C.DARK), BX, ty + 0.8, BZ, g); at(cyl(1, 20, C.STEEL, { edges: false }), BX, ty + 11, BZ, g);
    at(cyl(1.6, 2.4, C.BRASS), BX, BY, BZ, g);
    const beam = new T.Group(); at(beam, BX, BY, BZ, g);
    at(box(34, 1, 1.4, C.BRASS), 0, 0, 0, beam);
    const needle = box(0.5, 8, 0.5, 0xe0473a, { edges: false }); at(needle, 0, -4, 0.9, beam);
    const pans = [-1, 1].map(k => {
      const pg = new T.Group(); at(pg, BX + k * 16, BY, BZ, g);
      for (const [dx, dz] of [[-4, -3], [4, -3], [0, 4]]) h.rodAB(pg, v3(0, 0, 0), v3(dx, -9, dz), 0.12, 0x6f8098);
      at(cyl(5.4, 0.6, 0xc6ccd6, { r2: 5.6 }), 0, -9.3, 0, pg);
      const n = k < 0 ? d.pos : d.neg, col = k < 0 ? 0x5fb4e8 : 0xe0603a;
      for (let j = 0; j < n; j++) at(cyl(2.6, 0.7, col, { seg: 20 }), (j % 2 ? 0.3 : -0.3), -8.6 + j * 0.75, 0, pg);
      return pg;
    });
    const target = -clamp(d.sum, -8, 8) * 0.045;
    if (mem.oxTilt == null || mem.oxK !== d.k) mem.oxTilt = target; mem.oxK = d.k;
    kit.onFrame((dt) => {
      mem.oxTilt += (target - mem.oxTilt) * (kit.reduce ? 1 : Math.min(1, dt * 4));
      const a = mem.oxTilt; beam.rotation.z = a;
      pans.forEach((p, i) => { const k = i ? 1 : -1; p.position.set(BX + k * 16 * Math.cos(a), BY + k * 16 * Math.sin(a), BZ); });
    });
    const sl = h.sticker(4.4, 2.4, '+', '#ffffff', '#3b8fd0', 64); at(sl, BX - 7, ty + 1.62, BZ + 6.06, g);
    const sr = h.sticker(4.4, 2.4, '−', '#ffffff', '#c0452a', 64); at(sr, BX + 7, ty + 1.62, BZ + 6.06, g);
    // шкала x: деления нажимаются, ползунок, кнопка «Записать»
    const SZ = 30, SX0 = -44, SX1 = 30, xs = v => SX0 + (v + 4) / 12 * (SX1 - SX0);
    at(box(SX1 - SX0 + 8, 1.4, 7, 0xf2ead8), (SX0 + SX1) / 2, ty + 0.7, SZ, g);
    at(box(SX1 - SX0, 0.3, 1, 0x8b96ad, { edges: false }), (SX0 + SX1) / 2, ty + 1.5, SZ - 1.5, g);
    for (let v = -4; v <= 8; v++) {
      const tg = new T.Group(); at(tg, xs(v), ty + 1.4, SZ, g); clickable(tg, 'x:' + v);
      at(h.hitBox(5.6, 3, 7), 0, 1, 0, tg);
      at(box(0.35, 0.2, 2.4, 0x1b1610, { edges: false, shadow: false }), 0, 0.1, -1.4, tg);
      const s = h.sticker(4.2, 2.6, ox(v), v === d.x ? '#1b1610' : '#4a5468', v === 0 ? '#fff6e6' : '#f2ead8', 96); s.rotation.x = -Math.PI / 2; at(s, 0, 0.12, 1.4, tg);
    }
    const mk = new T.Group(); at(mk, xs(d.x), ty + 1.4, SZ - 1.5, g); clickable(mk, 'x:' + d.x);
    at(cyl(1.9, 2.2, d.found ? 0x3fae5a : 0xffb547), 0, 1.1, 0, mk);
    const rb = new T.Group(); at(rb, 42, ty, SZ); clickable(rb, 'rec');
    at(box(14, 3, 8, d.found ? 0x3fae5a : 0xe8ecf4), 0, 1.5, 0, rb);
    const rl = h.sticker(12, 5, d.found ? 'записано ✓' : 'записать x', d.found ? '#ffffff' : '#1b1610', d.found ? '#3fae5a' : '#ffd166', 220); rl.rotation.x = -Math.PI / 2; at(rl, 0, 3.05, 0, rb);
    tag(v3(-8, ty + 7, 30), d.name, 'ищем x у ' + d.u + ' · найдено ' + d.nf + ' из 5', d.found);
    tag(v3(BX, ty + 30, BZ), 'Сумма зарядов', 'Σ = ' + ox(d.sum) + (d.sum === 0 ? ' ✓' : ''), d.sum === 0);
  };

  // ===== 6. Окислитель и восстановитель: настоящая реакция, таблетки степеней окисления, бегущие электроны =====
  SC['chel-rx'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const ty = h.tray(g, 0, 2, 122, 80);
    const f = d.total ? clamp(d.moved / d.total, 0, 1) : 0, P = [];
    const AS = 1.4, app = new T.Group(); at(app, d.rx === 2 ? 8 : 0, 1 - AS, -2, g); app.scale.setScalar(AS); app.updateMatrixWorld(true);
    const W = p => app.localToWorld(p.clone());
    const g0 = new T.Group(), g1 = new T.Group(); at(g0, 0, 0, 0, app); at(g1, 0, 0, 0, app); clickable(g0, 'g0'); clickable(g1, 'g1');
    const grp = [g0, g1];
    if (d.rx === 0) {
      // Zn + CuSO₄: цинковая пластинка в синем растворе; медь оседает, раствор светлеет
      const BX = 0, BZ = -4, R = 12, BH = 22, LV = 15;
      h.beaker(g1, BX, ty, BZ, R, BH);
      const lq = h.liquid(g1, BX, ty + 0.6, BZ, R - 0.45, 0x2f86e0, 0.7); lq.set(LV);
      lq.mat.color.copy(new T.Color(0x2f86e0).lerp(new T.Color(0xdfe7ee), f)); lq.mat.opacity = 0.7 - 0.38 * f;
      const s = h.sticker(10, 3.4, 'CuSO₄'); at(s, BX + 3, ty + 18.5, BZ + R + 0.08, g1);
      at(box(2 * R + 5, 1.2, 2.4, C.WOOD2), BX, ty + BH + 0.6, BZ - 4, app);
      at(box(5.6, 28, 0.9, 0xa7b4c3), BX - 5, ty + 1.4 + 14, BZ - 4, g0);
      at(box(6.6, 2.6, 2.6, 0x3b6fd8), BX - 5, ty + 1.4 + 27.6, BZ - 4, g0);
      const zs = h.sticker(3.6, 2.6, 'Zn', '#1b1610', '#fffaf0', 128); at(zs, BX - 5, ty + 21, BZ - 3.5, g0);
      if (f > 0) {
        const coat = box(5.9, LV - 2, 1.15, 0xc8743f, { edges: false }); coat.material = h.ownMat(0xc8743f, { transparent: true, opacity: 0.35 + 0.6 * f }); at(coat, BX - 5, ty + 2 + (LV - 2) / 2, BZ - 4, g0);
        for (let k = 0; k < Math.round(14 * f); k++) at(h.ball(0.5 + rnd(k) * 0.4, 0xa85a30, { hull: false, seg: 8, seg2: 6 }), BX + (rnd(k + 1) - 0.5) * 16, ty + 1.3, BZ + (rnd(k + 2) - 0.5) * 16, g1);
      }
      P.push(v3(BX - 5, ty + 32, BZ - 4), v3(BX + 6, ty + LV + 2, BZ));
    } else if (d.rx === 1) {
      // Na + Cl₂: колба с жёлто-зелёным хлором, натрий в ложечке горит, белый дым NaCl
      const FX = 0, FZ = -6, FR = 12;
      const fl = h.flask(g1, FX, ty, FZ, FR, 9);
      const gas = h.ball(FR - 0.4, 0xc8e05a, { hull: false, matOpt: { transparent: true, opacity: 0.55 * (1 - f) + 0.06, depthWrite: false } }); at(gas, FX, ty + FR, FZ, g1);
      const s = h.sticker(7, 3, 'Cl₂'); at(s, FX, ty + FR, FZ + FR + 0.1, g1);
      // ложечка через пробку
      at(cyl(FR * 0.34, 2.6, 0x5b4a3a, { r2: FR * 0.38 }), FX, ty + fl.top + 0.4, FZ, app);
      at(cyl(0.3, 22, C.STEEL, { edges: false }), FX, ty + fl.top - 6, FZ, g0);
      at(cyl(0.3, 4, C.STEEL, { edges: false }), FX, ty + fl.top + 6, FZ, g0);
      at(cyl(2, 1, C.STEEL, { r2: 2.4 }), FX, ty + FR - 1, FZ, g0);
      at(box(2.2, 1.4, 1.8, 0xd8dce4), FX, ty + FR, FZ, g0);
      const burn = f > 0 && f < 1;
      if (burn) {
        at(h.glow(0xffd23a, 16, 0.85), FX, ty + FR + 2, FZ, g0); at(new T.PointLight(0xffc840, 40, 50, 1.4), FX, ty + FR + 3, FZ, g0);
        const fs = cyl(1.3, 4.5, 0xffd23a, { r2: 0.05, edges: false, hull: false, shadow: false, matOpt: { emissive: 0xffb81a, emissiveIntensity: 1, transparent: true, opacity: 0.9 } }); at(fs, FX, ty + FR + 3, FZ, g0);
        if (!kit.reduce) kit.onFrame((dt, t) => { fs.scale.set(1 + 0.1 * Math.sin(t * 17), 1 + 0.18 * Math.sin(t * 11), 1); });
      }
      if (f > 0) {
        h.puffs(app, FX, ty + FR + 1, FZ, { n: 7, color: 0xffffff, spread: 10, rise: 9, size: 5, op: 0.35 + 0.4 * f });
        for (let k = 0; k < Math.round(16 * f); k++) at(box(0.7, 0.5, 0.7, 0xffffff, { edges: false }), FX + (rnd(k + 4) - 0.5) * 12, ty + 2.2 + rnd(k) * 1.4, FZ + (rnd(k + 5) - 0.5) * 12, g1);
      }
      P.push(v3(FX - 1, ty + FR + 6, FZ + 2), v3(FX + 7, ty + FR + 5, FZ));
      P[0] = v3(FX, ty + fl.top + 9, FZ);
    } else {
      // CuO + H₂: горизонтальная трубка на штативе, чёрный CuO краснеет, на холодном конце капли воды
      const TZ = -6, TY = ty + 13, X0 = -18, X1 = 26;
      const tg = new T.Group(); at(tg, 0, 0, 0, app);
      const tube = new T.Mesh(kit.keep(new T.CylinderGeometry(2.6, 2.6, X1 - X0, 28, 1, true)), h.glassMat(0xd8eef8, 0.26)); tube.rotation.z = Math.PI / 2; at(tube, (X0 + X1) / 2, TY, TZ, tg); tube.add(new T.Mesh(tube.geometry, kit.hullMat));
      h.stand(app, 18, TZ - 12, 18, [{ y: TY, to: v3(18, 0, TZ) }]);
      // порошок
      const pw = mesh(new T.CylinderGeometry(2.2, 2.2, 12, 20, 1, false, 0, Math.PI), 0x1b1b1f, { edges: false, hull: false }); pw.rotation.set(0, 0, Math.PI / 2); pw.rotation.x = Math.PI; at(pw, 4, TY - 0.6, TZ, g0); pw.scale.set(1, 1, 0.55);
      pw.material = h.ownMat(new T.Color(0x1b1b1f).lerp(new T.Color(0xc8743f), f).getHex());
      at(h.hitBox(14, 6, 6), 4, TY, TZ, g0);
      h.spirit(app, 4, ty, TZ, f > 0 && f < 1, 1);
      if (f > 0) for (let k = 0; k < Math.round(8 * f); k++) at(h.ball(0.4 + rnd(k) * 0.3, 0xcfe8ff, { hull: false, seg: 8, seg2: 6, matOpt: { transparent: true, opacity: 0.85 } }), 16 + rnd(k + 3) * 8, TY - 1.8 + rnd(k + 4) * 0.6, TZ + (rnd(k + 5) - 0.5) * 2.4, app);
      // колба-генератор водорода слева, газоотводная трубка
      const fl = h.flask(g1, -38, ty, TZ, 8, 6);
      const lq = h.ball(7.4, 0xdfe7ee, { hull: false, matOpt: { transparent: true, opacity: 0.35, depthWrite: false } }); at(lq, -38, ty + 7, TZ, g1); lq.scale.y = 0.6;
      for (let k = 0; k < 6; k++) at(h.ball(1 + rnd(k) * 0.5, 0x9aa7bd, { seg: 8, seg2: 6 }), -38 + (rnd(k + 1) - 0.5) * 7, ty + 2, TZ + (rnd(k + 2) - 0.5) * 7, g1);
      const s = h.sticker(6, 3, 'H₂'); at(s, -38, ty + 8, TZ + 8.1, g1);
      at(cyl(2.4, 2.4, 0x5b4a3a, { r2: 2.8 }), -38, ty + fl.top + 0.6, TZ, g1);
      h.wire([v3(-38, ty + fl.top + 1.8, TZ), v3(-38, ty + fl.top + 5, TZ), v3(-30, TY + 3, TZ), v3(-22, TY, TZ), v3(X0 + 2, TY, TZ)].map(W), 0xc0452a, 0, 0.9 * AS);
      at(cyl(2.8, 2.4, 0x5b4a3a), X0 + 1, TY, TZ, app).rotation.z = Math.PI / 2;
      const bb = h.bubbles(g1, -38, ty + 1, TZ, 4, 8); bb.set(f < 1 ? 0.8 : 0.3, 6, 0.4, 0.6);
      P.push(v3(4, TY + 5, TZ), v3(-38, ty + fl.top + 7, TZ));
    }
    P.forEach((p, i) => { P[i] = W(p); });
    // таблетки степеней окисления над участниками
    const pills = d.g.map((gg, gi) => {
      const st = d.st.filter((v, k) => d.ai[k] === gi), changed = st.some(v => v !== gg.from), done = st.every(v => v === gg.to) && changed;
      const txt = gg.sp + ': ' + st.map(ox).join(' · ') + '\nбыло ' + ox(gg.from);
      const p = h.pill(g, P[gi].x, P[gi].y, P[gi].z, txt, '#1b1610', done ? '#b8f0c8' : changed ? '#ffd166' : d.sel === gi ? "#bfe9f5" : "#fff6e6", 3.4);
      if (d.sel === gi) at(h.glow(0x72d4e8, 22, 0.5), P[gi].x, P[gi].y - 3, P[gi].z, g);
      return p;
    });
    // электроны бегут от отдающего к принимающему
    const don = d.dd.findIndex(v => v > 0), acc = d.dd.findIndex(v => v < 0);
    if (don >= 0 && acc >= 0) {
      const A = P[don].clone().add(v3(0, -1, 0)), B = P[acc].clone().add(v3(0, -1, 0)), M = A.clone().lerp(B, 0.5).add(v3(0, 9, 4));
      const cv = new T.QuadraticBezierCurve3(A, M, B);
      at(mesh(new T.TubeGeometry(cv, 40, 0.18, 6), 0x72d4e8, { edges: false, matOpt: { transparent: true, opacity: 0.45 } }), 0, 0, 0, g);
      h.stream(g, cv, Math.min(8, d.dd[don]), 0x72d4e8, 0.35, 0.6).set(Math.min(8, d.dd[don]), 1);
    }
    // карточки ролей перед участниками
    const CX = [-20, 20];
    d.g.forEach((gg, gi) => {
      const role = d.roles[gi], cg = new T.Group(); at(cg, CX[gi], ty, 28, g); clickable(cg, 'slot' + gi);
      at(box(26, 1, 8, role ? 0x3fae5a : 0xe8ecf4), 0, 0.5, 0, cg);
      const s = h.sticker(24, 6, gg.sp + ' — ' + (role ? (role === 'ox' ? 'окислитель' : 'восстановитель') : 'роль?'), role ? '#ffffff' : '#1b1610', role ? '#3fae5a' : '#fff6e6', 360);
      s.rotation.x = -Math.PI / 2; at(s, 0, 1.05, 0, cg);
    });
    tag(v3(18, ty + 36, -28), d.plain, d.found ? 'разобрана ✓' : d.ready ? 'как в продуктах — назовите роли' : 'перенесено ' + d.moved + ' e⁻', d.found || d.ready);
  };

  // ===== 7. Электронный баланс: весы электронов (бруски-«порции» e⁻), реакция в приборе сзади =====
  SC['chel-bal'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const ty = h.tray(g, 0, 2, 122, 80);
    // реакция сзади: идёт, когда баланс сошёлся
    const RZ = -24, on = d.ok || d.found;
    if (d.eq === 0) {
      const fl = h.flask(g, -8, ty, RZ, 9, 7);
      if (!on) at(h.ball(8.6, 0xe8f4ff, { hull: false, matOpt: { transparent: true, opacity: 0.18, depthWrite: false } }), -8, ty + 9, RZ, g);
      at(cyl(0.3, 16, C.STEEL, { edges: false }), -8, ty + fl.top - 4, RZ, g); at(cyl(1.8, 0.8, C.STEEL, { r2: 2.2 }), -8, ty + 9, RZ, g);
      at(box(2.4, 1, 2.4, 0xb5c0d3), -8, ty + 9.8, RZ, g);
      const s = h.sticker(6, 2.6, 'O₂'); at(s, -8, ty + 6, RZ + 9.1, g);
      if (on) { at(h.glow(0xffffff, 26, 0.95), -8, ty + 11, RZ, g); at(new T.PointLight(0xf0f4ff, 50, 70, 1.3), -8, ty + 12, RZ, g); h.puffs(g, -8, ty + 11, RZ, { n: 7, color: 0xffffff, spread: 9, rise: 8, size: 5, op: 0.6 }); }
    } else {
      // трубка с порошком над спиртовкой; газ входит слева
      const TY = ty + 13, X0 = -26, X1 = 10;
      const tube = new T.Mesh(kit.keep(new T.CylinderGeometry(2.6, 2.6, X1 - X0, 28, 1, true)), h.glassMat(0xd8eef8, 0.26)); tube.rotation.z = Math.PI / 2; at(tube, (X0 + X1) / 2, TY, RZ, g); tube.add(new T.Mesh(tube.geometry, kit.hullMat));
      h.stand(g, 4, RZ - 10, 18, [{ y: TY, to: v3(4, 0, RZ) }]);
      const c0 = d.eq === 1 ? 0xa0401f : 0x1b1b1f, c1 = d.eq === 1 ? 0x6f7782 : 0xc8743f;
      const pw = mesh(new T.CylinderGeometry(2.2, 2.2, 12, 20, 1, false, 0, Math.PI), on ? c1 : c0, { edges: false, hull: false }); pw.rotation.set(Math.PI, 0, Math.PI / 2); pw.scale.set(1, 1, 0.55); at(pw, -8, TY - 0.6, RZ, g);
      h.spirit(g, -8, ty, RZ, true, 1);
      const s = h.sticker(9, 3, d.eq === 1 ? 'Fe₂O₃' : 'CuO'); at(s, -8, TY + 4.4, RZ + 0.2, g);
      h.wire([v3(-46, ty + 1.2, RZ), v3(-40, TY + 1, RZ), v3(X0 - 2, TY, RZ)], 0xc0452a, on ? 1 : 0, 0.9);
      const gs = h.sticker(7, 3, d.eq === 1 ? 'CO' : 'NH₃'); gs.rotation.x = -Math.PI / 2; at(gs, -44, ty + 0.12, RZ + 5, g);
      if (on && d.eq === 1) { const fs = cyl(1.2, 4, 0x5aa8ff, { r2: 0.05, edges: false, hull: false, shadow: false, matOpt: { emissive: 0x3a8cff, emissiveIntensity: 1, transparent: true, opacity: 0.8 } }); fs.rotation.z = -Math.PI / 2; at(fs, X1 + 2, TY, RZ, g); at(h.glow(0x5aa8ff, 10, 0.6), X1 + 2, TY, RZ, g); }
      if (on && d.eq === 2) for (let k = 0; k < 6; k++) at(h.ball(0.45, 0xcfe8ff, { hull: false, seg: 8, seg2: 6 }), 4 + rnd(k) * 5, TY - 1.8, RZ + (rnd(k + 1) - 0.5) * 2, g);
    }
    // весы электронов
    const BX = 0, BZ = 10, BY = ty + 26, ARM = 22;
    at(box(30, 1.6, 12, C.DARK), BX, ty + 0.8, BZ, g); at(cyl(1.1, 24, C.STEEL, { edges: false }), BX, ty + 13, BZ, g);
    at(cyl(1.8, 2.6, C.BRASS), BX, BY, BZ, g);
    const beam = new T.Group(); at(beam, BX, BY, BZ, g);
    at(box(2 * ARM + 4, 1.1, 1.5, C.BRASS), 0, 0, 0, beam);
    at(box(0.5, 9, 0.5, 0xe0473a, { edges: false }), 0, 4.6, 0.95, beam);
    const sideDef = [
      { k: 'a', n: d.a, e: d.red.e, col: 0x72d4e8, lab: '−' + d.red.e + 'e⁻', sym: d.red.s },
      { k: 'b', n: d.b, e: d.ox.e, col: 0xffb547, lab: '+' + d.ox.e + 'e⁻', sym: d.ox.s },
    ];
    const UH = 1.05;
    const pans = sideDef.map((sd, i) => {
      const k = i ? 1 : -1, pg = new T.Group(); at(pg, BX + k * ARM, BY, BZ, g);
      for (const [dx, dz] of [[-5, -3.5], [5, -3.5], [0, 5]]) h.rodAB(pg, v3(0, 0, 0), v3(dx, -12, dz), 0.12, 0x6f8098);
      at(cyl(7, 0.6, 0xc6ccd6, { r2: 7.3 }), 0, -12.3, 0, pg);
      const stack = new T.Group(); at(stack, 0, -12, 0, pg); clickable(stack, sd.k + '-');
      for (let j = 0; j < sd.n; j++) {
        const hh = sd.e * UH, yb = j * sd.e * UH;
        at(box(7.6, hh - 0.15, 7.6, sd.col), 0, yb + hh / 2, 0, stack);
        const s = h.sticker(6.4, Math.min(hh - 0.4, 2.6), sd.lab, '#1b1610', '#fffaf0', 160); at(s, 0, yb + hh / 2, 3.86, stack);
      }
      return pg;
    });
    const A = d.A, B = d.B, target = clamp((B - A) / Math.max(A, B, 1), -1, 1) * 0.22;
    if (mem.balTilt == null || mem.balEq !== d.eq) mem.balTilt = target; mem.balEq = d.eq;
    kit.onFrame((dt) => {
      mem.balTilt += (target - mem.balTilt) * (kit.reduce ? 1 : Math.min(1, dt * 3));
      const a = mem.balTilt; beam.rotation.z = a;
      pans.forEach((p, i) => { const k = i ? 1 : -1; p.position.set(BX + k * ARM * Math.cos(a), BY + k * ARM * Math.sin(a), BZ); });
    });
    // лотки с запасными брусками
    sideDef.forEach((sd, i) => {
      const x = i ? 50 : -50, lg = new T.Group(); at(lg, x, ty, 26, g); clickable(lg, sd.k + '+');
      at(box(14, 1.2, 14, 0x3b4a66), 0, 0.6, 0, lg);
      for (const [dx, dz] of [[-3.6, -3], [3.6, -3], [0, 3.4]]) at(box(5.6, sd.e * 0.8, 5.6, sd.col), dx, 1.2 + sd.e * 0.4, dz, lg);
      const s = h.sticker(12, 3.6, '+ ' + sd.sym + ' ' + sd.lab, '#1b1610', '#fff6e6', 260); at(s, 0, 0.6, 7.06, lg);
    });
    const eqTxt = on ? d.fin : d.sk;
    tag(v3(BX - ARM - 4, BY + 4 + Math.max(d.A, 6) * UH * 0.2, BZ), d.red.lab, d.a + ' × ' + d.red.e + ' = ' + d.A + ' e⁻', d.A === d.B);
    tag(v3(BX + ARM + 4, BY + 4 + Math.max(d.B, 6) * UH * 0.2, BZ), d.ox.lab, d.b + ' × ' + d.ox.e + ' = ' + d.B + ' e⁻', d.A === d.B);
    tag(v3(d.eq === 0 ? -8 : -8, ty + 28, RZ), on ? 'Реакция идёт' : 'Реакция', eqTxt, on);
  };
})();
