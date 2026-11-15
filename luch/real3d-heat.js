// «Как в жизни» для тем «Количество теплоты» (labs/phys-heatq) и «Агрегатные состояния» (labs/phys-phase):
// плитки со стаканами воды и масла, топливо на весах под кастрюлей, калориметр с кувшином и бруском,
// стакан со льдом на плитке-холодильнике и график, кастрюля и макет горы с барометром, психрометр и гигрометр.
// Сцены строятся из window.LUCH_REAL() опыта; быстрые значения (температуры, граммы) — из LUCH_REAL.live() в onFrame.
(() => {
  const SC = window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {};
  const live = full => { try { return window.LUCH_REAL.live ? window.LUCH_REAL.live(full) : null; } catch (e) { return null; } };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (x, n) => { let s = (Math.round(x * 10 ** n) / 10 ** n).toFixed(n); if (/^-0(\.0+)?$/.test(s)) s = s.slice(1); return s.replace('.', ',').replace('-', '−'); };
  const kJ = x => fmt(x / 1000, x < 100000 ? 1 : 0) + ' кДж';
  const rnd = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const now = () => performance.now() / 1000;
  // для анимации «налили из кувшина» между перестройками сцены
  let balMp = null, pourAt = -9;

  // ---------- общие детали ----------
  function H(kit) {
    const { T, at, box, cyl, mesh, keep, grad, glowTex, textTex, clickable, toon, C } = kit;
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    const glassMat = (color = 0xd8eef8, opacity = 0.26) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, transparent: true, opacity, side: T.DoubleSide, depthWrite: false }));
    const ownMat = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, ...o }));
    const spr = (map, color, opacity, add) => new T.Sprite(keep(new T.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending })));
    const glow = (color, size, opacity) => { const s = spr(glowTex(), color, opacity, true); s.scale.setScalar(size); return s; };
    const flat = (w, h, tex) => new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: keep(tex), transparent: true })));
    const hitBox = (w, h, d) => new T.Mesh(keep(new T.BoxGeometry(w, h, d)), keep(new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })));
    // цилиндр от точки a до точки b
    function rodAB(parent, a, b, r, color, o = {}) {
      const dv = b.clone().sub(a), L = dv.length();
      const m = cyl(r, L, color, { edges: false, ...o });
      m.quaternion.setFromUnitVectors(v3(0, 1, 0), dv.normalize());
      return at(m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, parent);
    }
    // табло с текстом, который меняется в onFrame (строки через \n)
    function screen(w, h, txt, fg = '#86e0a8', pw = 320, ph = 120) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph; const x = c.getContext('2d');
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace;
      let cur = null;
      const set = (t, col = fg) => {
        t = String(t); if (cur === t + col) return; cur = t + col;
        x.fillStyle = '#0e1520'; x.fillRect(0, 0, pw, ph); x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle';
        const lines = t.split('\n'), lh = ph / lines.length;
        lines.forEach((ln, i) => {
          let fs = Math.round(lh * 0.64); x.font = `600 ${fs}px "IBM Plex Mono", monospace`;
          const tw = x.measureText(ln).width; if (tw > pw * 0.9) { fs = Math.floor(fs * pw * 0.9 / tw); x.font = `600 ${fs}px "IBM Plex Mono", monospace`; }
          x.fillText(ln, pw / 2, lh * (i + 0.5) + 2);
        });
        tex.needsUpdate = true;
      };
      set(txt);
      const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: tex })));
      m.userData.set = set; return m;
    }
    // кнопка на приборе: колпачок со значком сверху
    function button(parent, x, y, z, label, color, key, w = 4.2) {
      const b = new T.Group(); at(b, x, y, z, parent);
      at(box(w, 1.4, 3.6, color), 0, 0.7, 0, b);
      const top = flat(w * 0.82, 2.9, textTex(label, '#ffffff', '#' + color.toString(16).padStart(6, '0'), 128, 96));
      top.rotation.x = -Math.PI / 2; at(top, 0, 1.42, 0, b);
      clickable(b, key); return b;
    }
    // пламя: капля-спрайт (снизу привязана к точке), внутри светлое ядро; колышется
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
    function flame(parent, x, y, z, hgt, inner, outer, glowCol, spread = 0) {
      const g = new T.Group(); at(g, x, y, z, parent);
      const tex = flameTex(inner, outer), parts = [];
      const offs = spread ? [[0, 0, 1], [-spread, spread * 0.4, 0.68], [spread, -spread * 0.3, 0.74], [spread * 0.3, spread * 0.8, 0.6]] : [[0, 0, 1]];
      offs.forEach(([dx, dz, k], i) => {
        const s = spr(tex, 0xffffff, 0.94, false); s.center.set(0.5, 0.04); s.scale.set(hgt * 0.5 * k, hgt * k, 1);
        at(s, dx, 0, dz, g); parts.push({ s, k, ph: i * 2.1 });
      });
      at(glow(glowCol, hgt * 2.4, 0.5), 0, hgt * 0.35, 0, g);
      at(new T.PointLight(glowCol, 40, 60, 1.3), 0, hgt * 0.5, 0, g);
      if (!kit.reduce) kit.onFrame((dt, t) => {
        for (const p of parts) {
          const f = 1 + 0.13 * Math.sin(t * 13 + p.ph) + 0.06 * Math.sin(t * 29 + p.ph * 3);
          p.s.scale.set(hgt * 0.5 * p.k * (1 + 0.08 * Math.sin(t * 17 + p.ph)), hgt * p.k * f, 1);
        }
      });
      return g;
    }
    // пар/туман: мягкие клубы поднимаются и тают
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
      const st = { amt: o.amt ?? 1, wind: o.wind || 0, rise: o.rise ?? 14 };
      kit.onFrame((dt, t) => {
        for (const p of ps) {
          const ph = kit.reduce ? 0.15 + p.ph * 0.7 : (t * (o.speed || 0.35) + p.ph) % 1;
          p.s.position.set(p.dx * (0.6 + ph) + st.wind * ph, ph * st.rise, p.dz * (0.6 + ph));
          p.s.scale.setScalar((o.size || 4) * (0.6 + ph * 1.4));
          p.s.material.opacity = st.amt * (o.op ?? 0.55) * Math.sin(Math.PI * ph);
        }
      });
      return { g, set(a, wind) { st.amt = a; if (wind != null) st.wind = wind; } };
    }
    // пузырьки в жидкости
    function bubbles(parent, x, y0, z, r, n = 8) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      const geo = keep(new T.SphereGeometry(1, 10, 8)), mat = keep(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }));
      const bs = [];
      for (let i = 0; i < n; i++) { const m = new T.Mesh(geo, mat); m.visible = false; g.add(m); bs.push({ m, ph: rnd(i + 11), a: rnd(i + 21) * Math.PI * 2, rr: Math.sqrt(rnd(i + 31)) * r }); }
      const st = { amt: 0, top: 5, big: 0.5, speed: 0.6 };
      kit.onFrame((dt, t) => {
        const k = Math.round(st.amt * n);
        bs.forEach((b, i) => {
          b.m.visible = i < k && st.top > 1.5; if (!b.m.visible) return;
          const ph = kit.reduce ? b.ph : (t * st.speed + b.ph) % 1;
          b.m.scale.setScalar(st.big * (0.4 + 0.9 * ph));
          b.m.position.set(Math.cos(b.a) * b.rr + 0.3 * Math.sin(t * 5 + i), 0.4 + ph * (st.top - 0.9), Math.sin(b.a) * b.rr);
        });
      });
      return { g, set(a, top, big = 0.5, speed = 0.6) { Object.assign(st, { amt: a, top, big, speed }); } };
    }
    // жидкость: цилиндр единичной высоты, высоту и цвет можно менять каждый кадр
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
      for (let k = 1; k <= 6; k++) { const m = box(k % 2 ? 1.1 : 2, 0.16, 0.1, 0x6f8098, { edges: false, shadow: false }); m.rotation.y = a; at(m, Math.sin(a) * (r + 0.05), h * k / 7, Math.cos(a) * (r + 0.05), g); }
      return { g, r, h };
    }
    // стеклянный термометр: шарик, столбик, шкала (к зрителю), метка
    function thermo(parent, x, y0, z, len, lo, hi, v, o = {}) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      at(new T.Mesh(keep(new T.SphereGeometry(1.15, 16, 12)), toon(0xe0473a)), 0, 0, 0, g);
      at(cyl(0.82, len, 0xeef6fb, { matOpt: { transparent: true, opacity: 0.55 } }), 0, len / 2 + 0.6, 0, g);
      at(box(1.15, len - 1.6, 0.1, 0xfffaf0, { edges: false, shadow: false }), 0, len / 2 + 0.8, -0.38, g);
      const col = cyl(0.34, 1, 0xe0473a, { edges: false, hull: false, shadow: false }); at(col, 0, 1, 0.05, g);
      const span = len - 2.4, n = Math.round((hi - lo) / 10);
      for (let k = 0; k <= n; k++) at(box(k % 5 === 0 ? 1.3 : 0.8, 0.14, 0.1, 0x1b1610, { edges: false, shadow: false }), 0.4, 1.2 + span * k / n, 0.72, g);
      if (o.mark != null) at(box(2.1, 0.32, 0.4, 0x2fbf5a, { edges: false, shadow: false }), 0, 1.2 + span * (o.mark - lo) / (hi - lo), 0.6, g);
      const set = t => { const f = clamp((t - lo) / (hi - lo), 0, 1), hh = 0.3 + span * f; col.scale.y = hh; col.position.y = 0.9 + hh / 2; };
      set(v); return { g, set, top: y0 + len + 1 };
    }
    // лабораторный штатив: основание, стержень, лапки к точкам
    function stand(parent, x, z, Hh, arms) {
      at(box(11, 1.2, 8, C.DARK), x, 0.6, z, parent);
      at(cyl(0.65, Hh, C.STEEL, { edges: false }), x, 1.2 + Hh / 2, z, parent);
      arms.forEach(a => {
        const p0 = v3(x, a.y, z), p1 = v3(a.to.x, a.y, a.to.z);
        rodAB(parent, p0, p1, 0.42, C.STEEL);
        at(box(2.2, 2.2, 2.2, C.DARK), x, a.y, z, parent);
        at(box(2.6, 2.4, 2.6, 0x3b4a66), p1.x, a.y, p1.z, parent);
      });
    }
    // электроплитка: корпус, чугунный диск с кольцами; on — кольца раскалены, cool — диск в инее
    function hotplate(parent, x, z, o = {}) {
      const w = o.w || 26, dd = o.d || 22, hb = 6, R = o.r || 8.5, g = new T.Group(); at(g, x, 0, z, parent);
      for (const [fx, fz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) at(cyl(1, 0.8, C.DARK, { edges: false }), fx * (w / 2 - 2.2), 0.4, fz * (dd / 2 - 2.2), g);
      at(box(w, hb, dd, o.body || 0x3b4a66), 0, 0.8 + hb / 2, 0, g);
      at(box(w - 1.4, 0.6, dd - 1.4, 0x4a5b7c), 0, 0.8 + hb + 0.3, 0, g);
      const top = 0.8 + hb + 0.6;
      at(cyl(R, 1.2, o.cool ? 0xcfe8f6 : 0x2c3240), 0, top + 0.6, 0, g);
      const ringMat = keep(new T.MeshBasicMaterial({ color: o.on ? 0xff5a2a : o.cool ? 0x8fd0ff : 0x454e62 }));
      [R * 0.35, R * 0.6, R * 0.85].forEach(rr => { const tr = new T.Mesh(keep(new T.TorusGeometry(rr, 0.28, 6, 36)), ringMat); tr.rotation.x = Math.PI / 2; at(tr, 0, top + 1.22, 0, g); });
      const lamp = new T.Mesh(keep(new T.SphereGeometry(0.9, 12, 8)), keep(new T.MeshBasicMaterial({ color: o.on ? 0xff4a3a : o.cool ? 0x5fb4ff : 0x5a2a2a })));
      at(lamp, -w / 2 + 3, 0.8 + hb * 0.55, dd / 2 + 0.2, g);
      const knob = cyl(2, 1.6, 0xd9dfe9, { seg: 18 }); knob.rotation.x = Math.PI / 2; at(knob, w / 2 - 4, 0.8 + hb * 0.5, dd / 2 + 0.7, g);
      at(box(0.5, 1.6, 0.4, 0x2c3240, { edges: false }), w / 2 - 4, 0.8 + hb * 0.5 + 0.5, dd / 2 + 1.55, g);
      if (o.on) { at(glow(0xff6a2a, R * 3, 0.45), 0, top + 2, 0, g); at(new T.PointLight(0xff7a3a, 22, 40, 1.4), 0, top + 3, 0, g); }
      if (o.cool) at(glow(0x9fd8ff, R * 3, 0.35), 0, top + 2, 0, g);
      return { g, top: top + 1.5, w, dd, knob };
    }
    // круглая шкала (гигрометр, барометр), стрелку можно двигать каждый кадр
    function dial(parent, x, y, z, r, unit, marks, frac) {
      const g = new T.Group(); at(g, x, y, z, parent);
      const body = cyl(r, 1.8, 0xe8ecf4, { seg: 36 }); body.rotation.x = Math.PI / 2; at(body, 0, 0, 0, g);
      const ring = mesh(new T.TorusGeometry(r, 0.45, 8, 40), C.BRASS, { edges: false, hull: true }); at(ring, 0, 0, 0.95, g);
      const c = document.createElement('canvas'); c.width = c.height = 256; const cx = c.getContext('2d');
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace;
      let cur = null;
      const set = f => {
        f = clamp(f, 0, 1); const k = Math.round(f * 400); if (k === cur) return; cur = k;
        cx.fillStyle = '#f7f3ea'; cx.fillRect(0, 0, 256, 256);
        const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
        cx.strokeStyle = '#1b1610'; cx.lineWidth = 4; cx.beginPath(); cx.arc(128, 128, 100, a0, a1); cx.stroke();
        marks.forEach(([mf, t]) => {
          const a = a0 + (a1 - a0) * mf; cx.lineWidth = 4; cx.beginPath(); cx.moveTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100); cx.lineTo(128 + Math.cos(a) * 82, 128 + Math.sin(a) * 82); cx.stroke();
          cx.fillStyle = '#1b1610'; cx.font = '600 22px "IBM Plex Mono", monospace'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(t, 128 + Math.cos(a) * 62, 128 + Math.sin(a) * 62);
        });
        for (let i = 0; i <= 20; i++) { const a = a0 + (a1 - a0) * i / 20; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100); cx.lineTo(128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92); cx.stroke(); }
        cx.fillStyle = '#1b1610'; cx.font = '700 28px "Golos Text", sans-serif'; cx.textAlign = 'center'; cx.fillText(unit, 128, 204);
        const a = a0 + (a1 - a0) * f;
        cx.strokeStyle = '#c0392b'; cx.lineWidth = 7; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(128, 128); cx.lineTo(128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92); cx.stroke();
        cx.fillStyle = '#1b1610'; cx.beginPath(); cx.arc(128, 128, 11, 0, 7); cx.fill();
        tex.needsUpdate = true;
      };
      set(frac);
      const face = new T.Mesh(keep(new T.PlaneGeometry(r * 1.8, r * 1.8)), keep(new T.MeshBasicMaterial({ map: tex }))); at(face, 0, 0, 0.92, g);
      return { g, set };
    }
    return { v3, glassMat, ownMat, spr, glow, flat, hitBox, rodAB, screen, button, flame, steam, bubbles, liquid, beaker, thermo, stand, hotplate, dial };
  }
  // вода: голубая холодная, к кипятку теплеет (без жёлтых полутонов)
  const wcol = (T, t, lo, hi) => new T.Color(0x4f9fe0).lerp(new T.Color(0xff9a5a), clamp((t - lo) / (hi - lo), 0, 1) * 0.42);
  const capName = s => s[0].toUpperCase() + s.slice(1);

  // ===== «Удельная теплоёмкость»: две плитки, стаканы с жидкостями, термометры на штативах, секундомер =====
  SC['heat-cap'] = (kit, d) => {
    const { T, at, box, v3, tag, clickable, C } = kit, h = H(kit);
    const g = new T.Group(); at(g, 0, 0, 0);
    const hotC = new T.Color(0xff7a4a);
    const parts = d.side.map((s, i) => {
      const x = i ? 25 : -25, z = -2;
      const hp = h.hotplate(g, x, z, { on: s.on }); clickable(hp.g, 'p' + i);
      const scr = h.screen(10, 3.2, '', '#86e0a8'); at(scr, x - 1, 3.8, z + hp.dd / 2 + 0.06, g);
      const by = hp.top, R = 8.5, BH = 24;
      const bk = h.beaker(g, x, by, z, R, BH); clickable(bk.g, 's' + i);
      // уровень: масса одна, а объём V = m/ρ — масло стоит выше воды
      const V = d.m / s.rho * 1e6, lvl = clamp(V / 700, 0.04, 0.95) * (BH - 1.5);
      const base = new T.Color(s.col), lq = h.liquid(g, x, by + 0.6, z, R - 0.45, s.col, 0.62); lq.set(lvl);
      const tint = t => lq.mat.color.copy(base).lerp(hotC, clamp((t - 20) / 60, 0, 1) * 0.5);
      const tx = x + 3.3, tz = z - 3;
      const th = h.thermo(g, tx, by + 1.6, tz, 27, 0, 100, s.T ?? 20, { mark: d.tStop });
      h.stand(g, x + 9, z - 18, 34, [{ y: by + 23, to: v3(tx, 0, tz) }]);
      const bub = h.bubbles(g, x - 1.5, by + 0.6, z + 1, R - 3, 8);
      const st = h.steam(g, x, by + lvl + 1, z, { n: 5, spread: 7, size: 3.6, rise: 13, op: 0.45, amt: 0 });
      tag(v3(x - 2, by + 31, z - 3), capName(s.name) + ' · ' + d.mg + ' г', s.on ? 'нагрев…' : s.Ttxt + ' · ' + s.Qtxt, s.on || s.T >= d.tStop);
      return { s, scr, th, tint, bub, st, lvl };
    });
    // секундомер-табло: время работы каждой плитки, кнопка «пуск» сверху — обе плитки
    const sw = new T.Group(); at(sw, 0, 0, 30); sw.rotation.y = 0.45; clickable(sw, 'both');
    at(box(28, 1.6, 12, C.DARK), 0, 0.8, 0, sw);
    const bd = new T.Group(); at(bd, 0, 1.6, -1, sw); bd.rotation.x = -0.42;
    at(box(26, 11, 4, 0x3b4a66), 0, 5.5, 0, bd);
    const ss = h.screen(22.5, 8, '', '#ffd166', 360, 128); at(ss, 0, 5.5, 2.06, bd);
    const anyOn = d.side.some(s => s.on);
    at(kit.cyl(2.2, 1.2, C.DARK), 9, 11.6, 0, bd); at(kit.cyl(1.6, anyOn ? 0.8 : 1.6, anyOn ? 0x3fae5a : 0xe0473a), 9, anyOn ? 12.6 : 13, 0, bd);
    tag(v3(16, 6, 36), 'Секундомер', 'плитки по ' + d.P + ' Вт');
    const t0 = d.side.map(s => s.T ?? 20);
    kit.onFrame(() => {
      const Lv = live() || {};
      parts.forEach((p, i) => {
        const t = Lv.T ? Lv.T[i] : t0[i], Q = Lv.Q ? Lv.Q[i] : 0, on = Lv.on ? Lv.on[i] : p.s.on;
        p.th.set(t); p.tint(t);
        p.scr.userData.set(kJ(Q), on ? '#ffb547' : '#86e0a8');
        p.bub.set(on && t > 32 ? 0.75 : 0, p.lvl - 0.8, 0.32, 0.55);
        p.st.set(clamp((t - 38) / 30, 0, 1) * 0.55);
      });
      const tm = i => fmt((Lv.Q ? Lv.Q[i] : 0) / d.P, 0).padStart(4) + ' с';
      ss.userData.set('слева ' + tm(0) + '\nсправа' + tm(1));
    });
  };

  // ===== «Сгорание топлива»: весы с топливом, треножник с кастрюлей, термометр, счётчик Q, полка с образцами =====
  const FLAME = { solid: ['#ffe9a0', '#ff7a1a', 0xff8a3c], coal: ['#ffc070', '#ff4a1a', 0xff5a2a], liquid: ['#d8f0ff', '#4a9cff', 0x6ab0ff], petrol: ['#ffe9a0', '#ff8a2a', 0xff9a3c], gas: ['#e0f4ff', '#3a8cff', 0x5aa8ff], h2: ['#f2fbff', '#9fd0ff', 0xbfe0ff] };
  SC['heat-fuel'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, cable, C } = kit, h = H(kit);
    const g = new T.Group(); at(g, 0, 0, 0);
    const pz = -1;                                  // центр чаши весов и кастрюли
    // весы
    const sc = new T.Group(); at(sc, 0, 0, 2, g); clickable(sc, 'burn');
    at(box(32, 4, 30, 0xe8ecf4), 0, 2, 0, sc);
    at(cyl(2.4, 0.8, C.STEEL, { edges: false }), 0, 4.4, pz - 2, sc);
    at(cyl(10.5, 0.8, C.STEEL), 0, 5, pz - 2, sc);
    const py = 5.4;
    const sScr = h.screen(13, 3.2, '', '#86e0a8'); at(sScr, -2, 2, 15.06, sc);
    [['−5', -12.5, 'mf-5', 0xe0473a], ['−1', -8, 'mf-1', 0xe0473a], ['+1', 8, 'mf+1', 0x3fae5a], ['+5', 12.5, 'mf+5', 0x3fae5a]].forEach(([l, x, k, c]) => h.button(sc, x, 4, 11.6, l, c, k, 4));
    // топливо на чаше
    const fz = pz - 2, pieces = [];
    let fTop = py + 1, liqTop = null;
    if (d.kind === 'solid') {
      const rows = [6, 4, 3, 2], first = [0, 6, 10, 13];
      for (let j = 0; j < 15; j++) {
        const row = j < 6 ? 0 : j < 10 ? 1 : j < 13 ? 2 : 3, c = j - first[row], x = (c - (rows[row] - 1) / 2) * 3.2, y = py + 1.05 + row * 2;
        let m;
        if (d.fuel === 'wood') { m = cyl(1.05, 7, d.col, { seg: 10 }); m.rotation.x = Math.PI / 2; m.rotation.y = (rnd(j) - 0.5) * 0.25; }
        else if (d.fuel === 'peat') { m = box(2.8, 1.9, 5.6, d.col); m.rotation.y = (rnd(j) - 0.5) * 0.4; }
        else { m = mesh(new T.IcosahedronGeometry(1.45, 0), d.col, { edgeAngle: 20 }); m.rotation.set(rnd(j) * 3, rnd(j + 5) * 3, 0); }
        at(m, x, y, fz + (rnd(j + 2) - 0.5) * 1.2, sc); pieces.push(m);
      }
      fTop = py + 1.05 + Math.min(3, Math.ceil(d.mf / 10) > 13 ? 3 : Math.ceil(d.mf / 10) > 10 ? 2 : Math.ceil(d.mf / 10) > 6 ? 1 : 0) * 2 + 1;
    } else if (d.kind === 'liquid') {
      at(cyl(6.2, 2.6, C.STEEL, { r2: 6.8 }), 0, py + 1.3, fz, sc);
      const lt = cyl(6.1, 0.3, d.col, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.85 } }); at(lt, 0, py + 2, fz, sc); pieces.push(lt);
      liqTop = lt; fTop = py + 2.4;
    } else {
      // баллон с газом и горелка со шлангом
      const bx = -6.2, bz = fz - 2.5, gc = new T.Color(d.col).multiplyScalar(0.75).getHex();
      at(cyl(3, 10, gc), bx, py + 5, bz, sc);
      at(new T.Mesh(kit.keep(new T.SphereGeometry(3, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)), kit.toon(gc)), bx, py + 10, bz, sc);
      at(cyl(0.8, 2, C.BRASS), bx, py + 13.6, bz, sc); at(cyl(1.6, 0.6, C.DARK), bx, py + 14.4, bz, sc);
      at(cyl(1.6, 2.6, C.DARK), 2.5, py + 1.3, fz + 1, sc); at(cyl(2.3, 0.8, C.BRASS, { seg: 16 }), 2.5, py + 3, fz + 1, sc);
      sc.updateMatrixWorld(true);
      cable(v3(bx, py + 13.6, bz).applyMatrix4(sc.matrixWorld), v3(2.5 - 1.8, py + 1.4, fz + 1).applyMatrix4(sc.matrixWorld), 0x3a2a24, 0, { r: 0.55, lift: 1.5, via: [v3(bx + 4, py + 9, bz + 2).applyMatrix4(sc.matrixWorld)] });
      fTop = py + 3.4;
    }
    // треножник и кастрюля
    const ringY = 29, ringR = 12.5;
    const ring = mesh(new T.TorusGeometry(ringR, 0.6, 8, 40), 0x3a3f4c, { edges: false, hull: true }); ring.rotation.x = Math.PI / 2; at(ring, 0, ringY, pz, g);
    for (const a of [Math.PI / 6, Math.PI * 5 / 6, Math.PI * 1.5]) h.rodAB(g, v3(Math.cos(a) * ringR, ringY, pz + Math.sin(a) * ringR), v3(Math.cos(a) * 25, 0.3, pz + Math.sin(a) * 25), 0.6, 0x3a3f4c);
    const potY = ringY + 0.6, PR = 12, PH = 13;
    const pot = mesh(new T.CylinderGeometry(PR, PR * 0.98, PH, 40, 1, true), 0, { mat: kit.toon(0xc6ccd6, { side: T.DoubleSide }), hull: true }); at(pot, 0, potY + PH / 2, pz, g);
    at(cyl(PR * 0.98, 0.7, 0x9aa3b2, { edges: false }), 0, potY + 0.35, pz, g);
    const prim = mesh(new T.TorusGeometry(PR, 0.4, 6, 40), 0xdfe3ea, { edges: false }); prim.rotation.x = Math.PI / 2; at(prim, 0, potY + PH, pz, g);
    for (const s of [-1, 1]) at(box(4, 1, 2.4, 0x2c3240), s * (PR + 2), potY + PH - 2, pz, g);
    const water = h.liquid(g, 0, potY + 0.7, pz, PR - 0.4, 0x5fb4d9, 0.82); water.set(9.5);
    const bub = h.bubbles(g, 0, potY + 0.7, pz, PR - 3, 10);
    const st = h.steam(g, -1, potY + PH + 1, pz, { n: 8, spread: 12, size: 6, rise: 16, op: 0.6, amt: 0 });
    // цифровой термометр с щупом в кастрюле
    const tg = new T.Group(); at(tg, -24, 0, 30, g);
    at(box(16, 5, 10, 0xf2c94c), 0, 2.5, 0, tg);
    const tScr = h.screen(13, 3.4, '', '#86e0a8'); at(tScr, 0, 2.6, 5.06, tg);
    const tip = v3(5, potY + 2.5, pz - 4), hnd = v3(6.5, potY + PH + 6, pz - 6);
    h.rodAB(g, tip, hnd, 0.35, C.STEEL); at(box(1.6, 3.4, 1.6, C.DARK), hnd.x, hnd.y + 1.4, hnd.z, g);
    tg.updateMatrixWorld(true);
    cable(v3(0, 5, -4).applyMatrix4(tg.matrixWorld), hnd.clone().add(v3(0, 3.1, 0)), 0x2a2f3a, 0, { r: 0.5, lift: 3 });
    // счётчик выделившейся теплоты: табло и полоса до «нужно»
    const qg = new T.Group(); at(qg, 44, 0, 12, g);
    at(box(20, 8, 10, 0x3b4a66), 0, 4, 0, qg);
    const qScr = h.screen(16, 3.6, '', '#ffb547'); at(qScr, 0, 4.4, 5.06, qg);
    at(box(17, 1, 2.6, 0x0e1520), 0, 8.5, 1, qg);
    const fill = box(1, 1.1, 2.2, 0xffb547, { edges: false }); at(fill, -8.5, 8.6, 1, qg);
    const mark = 1 / 1.4; at(box(0.5, 2, 3.2, 0x3fae5a, { edges: false }), -8.5 + 17 * mark, 8.9, 1, qg);
    // полка с образцами топлива
    const shelf = new T.Group(); at(shelf, -52, 0, 0, g); shelf.rotation.y = Math.PI / 2;
    at(box(48, 1.2, 10, C.WOOD2), 0, 0.6, 0, shelf);
    d.fuels.forEach((f, i) => {
      const x = -20.5 + i * 6.8, jg = new T.Group(); at(jg, x, 1.2, 0, shelf); clickable(jg, 'fuel-' + f.k);
      const on = f.k === d.fuel;
      if (on) at(cyl(3.1, 0.3, 0xffd166, { edges: false, hull: false, shadow: false }), 0, 0.15, 0, jg);
      if (f.kind === 'gas') {
        at(cyl(2, 6, f.col), 0, 3, 0, jg); at(new T.Mesh(kit.keep(new T.SphereGeometry(2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)), kit.toon(f.col)), 0, 6, 0, jg); at(cyl(0.6, 1.4, C.BRASS), 0, 8.4, 0, jg);
      } else if (f.kind === 'liquid') {
        at(cyl(2, 5, 0xd8eef8, { matOpt: { transparent: true, opacity: 0.45 } }), 0, 2.5, 0, jg);
        at(cyl(1.8, 3.6, f.col, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.85 } }), 0, 1.9, 0, jg);
        at(cyl(0.9, 2, 0xd8eef8, { matOpt: { transparent: true, opacity: 0.45 } }), 0, 6, 0, jg); at(cyl(1, 0.9, C.DARK), 0, 7.4, 0, jg);
      } else {
        at(new T.Mesh(kit.keep(new T.CylinderGeometry(2.4, 2.4, 5.4, 22, 1, true)), h.glassMat(0xd8eef8, 0.3)), 0, 2.7, 0, jg);
        at(cyl(2.2, 3.6, f.col, { edges: false }), 0, 1.8, 0, jg);
        at(cyl(2.6, 1, C.DARK), on ? -1.2 : 0, on ? 6.4 : 5.9, on ? -0.8 : 0, jg);
      }
      const lab = h.flat(5.6, 2, kit.textTex(f.n, '#1b1610', on ? '#ffd166' : '#fff6e6', 192, 68)); lab.rotation.x = -0.5; at(lab, 0, 0.9, 3.9, jg);
    });
    // пламя
    if (d.burning) {
      const fl = d.kind === 'solid' ? (d.fuel === 'coal' ? FLAME.coal : FLAME.solid) : d.kind === 'liquid' ? (d.fuel === 'petrol' ? FLAME.petrol : FLAME.liquid) : (d.fuel === 'h2' ? FLAME.h2 : FLAME.gas);
      const fx = d.kind === 'gas' ? 2.5 : 0, fzW = 2 + (d.kind === 'gas' ? fz + 1 : fz);
      const hgt = d.kind === 'solid' ? (d.fuel === 'coal' ? 11 : 17) : d.kind === 'liquid' ? 15 : 14;
      h.flame(g, fx, fTop, fzW, hgt, fl[0], fl[1], fl[2], d.kind === 'gas' ? 0 : 2.6);
      if (d.kind === 'solid') at(h.glow(0xff5a1a, 18, 0.55), 0, py + 3, fz + 2, g);
    }
    tag(v3(0, potY + PH + 9, pz), 'Кастрюля · ' + d.M + ' кг воды', d.burning ? 'нагрев…' : d.Ttxt, !d.burning && d.T >= 100);
    tag(v3(-2, 6, 19), 'Весы · ' + d.short, d.burning ? 'горит…' : d.lefttxt, d.burning);
    tag(v3(44, 13, 12), 'Выделилось Q', 'нужно ' + d.needTxt);
    tag(v3(-52, 11, 2), 'Топливо', 'q = ' + d.qtxt);
    const left0 = d.left ?? d.mf;
    kit.onFrame(() => {
      const Lv = live() || {}, left = Lv.left ?? left0, t = Lv.T ?? d.T ?? 20, Q = Lv.Q ?? 0;
      if (pieces.length && d.kind === 'solid') { const n = Math.ceil(clamp(left, 0, 150) / 10 - 1e-9); pieces.forEach((m, j) => { m.visible = j < n; }); }
      if (liqTop) { const k = clamp(left / 150, 0, 1); liqTop.visible = left > 0.05; liqTop.position.y = py + 0.4 + 2.1 * Math.max(0.15, k); }
      sScr.userData.set(fmt(left, left < 10 && left > 0 ? 1 : 0) + ' г');
      tScr.userData.set(fmt(t, t >= 100 || t <= 20.05 ? 0 : 1) + ' °C', t >= 100 ? '#86e0a8' : '#e8ecf4');
      water.mat.color.copy(wcol(T, t, 10, 100));
      bub.set(t > 70 ? (t >= 100 ? 1 : 0.5) : 0, 9, t >= 100 ? 0.7 : 0.4, t >= 100 ? 1 : 0.6);
      st.set(t >= 100 ? (Lv.burning ? 1 : 0.35) : t > 60 ? 0.2 : 0);
      qScr.userData.set('Q ' + kJ(Q));
      const f = clamp(Q / (d.needQ * 1.4), 0, 1); fill.visible = f > 0.002; fill.scale.x = Math.max(0.01, 17 * f); fill.position.x = -8.5 + 17 * f / 2;
    });
  };

  // ===== «Тепловой баланс»: калориметр, термометр, кувшин с горячей водой или брусок на нитке =====
  SC['heat-bal'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, C } = kit, h = H(kit);
    const g = new T.Group(); at(g, 0, 0, 0);
    const cx = 4, cz = -2, water = d.mode === 'water';
    // калориметр: внешний стакан, изолирующее кольцо, внутренний алюминиевый стакан
    const cg = new T.Group(); at(cg, cx, 0, cz, g);
    const outer = mesh(new T.CylinderGeometry(13, 13, 16, 44, 1, true), 0, { mat: kit.toon(0xc6ccd6, { side: T.DoubleSide }), hull: true }); at(outer, 0, 8, 0, cg);
    at(cyl(13, 0.8, 0x9aa3b2, { edges: false }), 0, 0.4, 0, cg);
    at(cyl(10.2, 1.2, C.DARK), 0, 1.4, 0, cg);
    const inner = mesh(new T.CylinderGeometry(10, 10, 13.8, 40, 1, true), 0, { mat: kit.toon(0xe3e7ee, { side: T.DoubleSide }), hull: true }); at(inner, 0, 2 + 6.9, 0, cg);
    at(cyl(10, 0.6, 0xe3e7ee, { edges: false }), 0, 2.3, 0, cg);
    const lid = mesh(new T.RingGeometry(10.05, 13.3, 44), 0, { mat: kit.toon(0x2c3240, { side: T.DoubleSide }) }); lid.rotation.x = -Math.PI / 2; at(lid, 0, 15.9, 0, cg);
    const wl = mw => 1.2 + 11.5 * mw / 850;
    const wat = h.liquid(g, cx, 2.6, cz, 9.6, 0x5fb4d9, 0.72); wat.set(wl(d.mw));
    // мешалка
    h.rodAB(g, v3(cx - 6, 3.4, cz - 4), v3(cx - 9.5, 22, cz - 6.5), 0.3, C.STEEL);
    const st0 = mesh(new T.TorusGeometry(2.4, 0.3, 6, 24), C.STEEL, { edges: false }); st0.rotation.x = Math.PI / 2; at(st0, cx - 6, 3.4, cz - 4, g);
    at(new T.Mesh(kit.keep(new T.SphereGeometry(0.8, 10, 8)), kit.toon(C.DARK)), cx - 9.5, 22.4, cz - 6.5, g);
    // термометр и штатив (во втором режиме — ещё лапка с нитью)
    const tx = cx + 5.5, tz = cz - 4.5;
    const th = h.thermo(g, tx, 3.4, tz, 24, 0, 100, d.Tw ?? 20, { mark: water ? d.tNeed : null });
    const armY = 28;
    h.stand(g, cx + 19, cz - 18, water ? 26 : 30, water ? [{ y: 23, to: v3(tx, 0, tz) }] : [{ y: 23, to: v3(tx, 0, tz) }, { y: armY, to: v3(cx - 1, 0, cz + 3) }]);
    const bubS = h.steam(g, cx, wl(d.mw) + 4, cz, { n: 4, spread: 8, size: 3.4, rise: 10, op: 0.35, amt: 0 });
    let jugApi = null, blockApi = null;
    // кувшин с горячей водой
    const jp = new T.Group(); at(jp, -24, 0, 4, g); clickable(jp, 'jug');
    {
      const body = new T.Mesh(kit.keep(new T.CylinderGeometry(6, 6.3, 15, 36, 1, true)), h.glassMat(0xd8eef8, 0.3)); at(body, 0, 7.5, 0, jp); body.add(new T.Mesh(body.geometry, kit.hullMat));
      at(cyl(6.2, 0.6, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.5 } }), 0, 0.3, 0, jp);
      const rim = mesh(new T.TorusGeometry(6, 0.3, 6, 36), 0xeef6fb, { edges: false }); rim.rotation.x = Math.PI / 2; at(rim, 0, 15, 0, jp);
      const hd = mesh(new T.TorusGeometry(4.2, 0.75, 8, 20, Math.PI), 0xffb547, { edges: false, hull: true }); hd.rotation.z = Math.PI / 2; at(hd, -6, 8.5, 0, jp);
      const sp = cyl(1.6, 4, 0xd8eef8, { r2: 0.9, matOpt: { transparent: true, opacity: 0.5 } }); sp.rotation.z = -0.9; at(sp, 7, 14.4, 0, jp);
      const jw = h.liquid(jp, 0, 0.6, 0, 5.6, 0xff8a73, 0.7);
      const jst = h.steam(jp, 0, 15.5, 0, { n: 4, spread: 6, size: 3.2, rise: 10, op: 0.4, amt: water ? 0.8 : 0.4 });
      jugApi = { jw, jst };
    }
    // поток: из носика в калориметр (поза «наклонён»)
    const stream = new T.Mesh(kit.keep(new T.TubeGeometry(new T.CatmullRomCurve3([v3(0.6, 19.2, 4), v3(1.2, 14, 3.4), v3(1.6, wl(d.mw) + 2.6, 3)]), 20, 0.55, 8)), kit.keep(new T.MeshBasicMaterial({ color: 0xff8a73, transparent: true, opacity: 0.8 })));
    stream.visible = false; g.add(stream);
    // мерный стакан на 50 г
    const mc = new T.Group(); at(mc, -24, 0, 24, g); clickable(mc, 'cup50');
    h.beaker(mc, 0, 0, 0, 3.6, 8);
    h.liquid(mc, 0, 0.6, 0, 3.3, 0xff8a73, 0.7).set(4.2);
    const lab = h.flat(4.4, 2, kit.textTex('50 г', '#1b1610', '#fff6e6', 128, 58)); at(lab, 0, 5.8, 3.75, mc);
    // поднос с брусками
    const tr = new T.Group(); at(tr, 34, 0, 16, g);
    at(box(28, 1.2, 12, C.WOOD2), 0, 0.6, 0, tr);
    d.mets.forEach((m, i) => {
      const x = -9 + i * 9, sel = !water && m.k === d.met;
      const bg = new T.Group(); at(bg, x, 1.2, 0, tr); clickable(bg, 'blk-' + m.k);
      if (!sel) at(box(6, 4, 4.4, m.col), 0, 2, -1, bg);
      else at(box(6.4, 0.2, 4.8, 0x8a6a40, { edges: false }), 0, 0.1, -1, bg);
      if (water && m.k === d.met) at(cyl(4.2, 0.25, 0xffd166, { edges: false, hull: false, shadow: false }), 0, 0.13, -1, bg);
      const l = h.flat(7.6, 2.2, kit.textTex(m.name, '#1b1610', '#fff6e6', 220, 64)); l.rotation.x = -0.6; at(l, 0, 0.5, 3.6, bg);
    });
    // брусок на нитке
    if (!water) {
      const s = Math.cbrt(d.mb / 0.5), bw = 7 * s, bh = 5 * s, bdp = 5 * s;
      const bx = cx - 1, bz = cz + 3, y0 = 24 - bh / 2, y1 = 2.6 + bh / 2;
      const blk = new T.Group(); at(blk, bx, y0, bz, g); clickable(blk, 'drop');
      const bmat = h.ownMat(d.metCol);
      at(mesh(new T.BoxGeometry(bw, bh, bdp), 0, { mat: bmat }), 0, 0, 0, blk);
      at(cyl(0.5, 0.8, C.STEEL, { edges: false }), 0, bh / 2 + 0.4, 0, blk);
      const thr = cyl(0.12, 1, 0xf4efe2, { edges: false, hull: false, shadow: false }); at(thr, bx, 26, bz, g);
      const base = new T.Color(d.metCol), hot = new T.Color(0xff6a3c);
      blockApi = drop => {
        const y = y0 + (y1 - y0) * drop * drop; blk.position.y = y;
        const top = y + bh / 2 + 0.8, L = armY - top; thr.scale.y = Math.max(0.1, L); thr.position.y = top + L / 2;
      };
      blockApi(d.inW ? 1 : 0);
      tag(v3(bx - 3, 31, bz), capName(d.metName) + ' · ' + d.mbg + ' г', d.Tb == null ? 'теплообмен…' : d.Tbtxt, d.Tb == null);
      blockApi.tint = t => bmat.color.copy(base).lerp(hot, clamp((t - 20) / 80, 0, 1) * 0.4);
    }
    // анимация «налили» — если масса долитой воды выросла с прошлой перестройки
    if (water && balMp != null && d.mp > balMp) pourAt = now();
    balMp = water ? d.mp : null;
    const jug0 = d.jug;
    tag(v3(cx + 7, 16, cz + 12), 'Калориметр · ' + d.mw + ' г', d.Tw == null ? 'теплообмен…' : d.Twtxt, d.ok);
    if (water) tag(v3(-24, 21, 4), 'Кувшин · ' + d.t2 + ' °C', 'осталось ' + d.jug + ' г');
    else tag(v3(34, 9, 16), 'Бруски · ' + d.tb0 + ' °C', 'нажми — другой');
    kit.onFrame((dt, t) => {
      const Lv = live() || {};
      const Tw = Lv.Tw ?? d.Tw ?? 20;
      th.set(Tw); wat.mat.color.copy(wcol(T, Tw, 10, 90));
      bubS.set(clamp((Tw - 30) / 30, 0, 1) * 0.6);
      const jug = Lv.jug != null ? Lv.jug * 1000 : jug0;
      jugApi.jw.set(13.4 * clamp(jug / 500, 0, 1));
      if (water) {
        const mw = d.mw + (Lv.mp != null ? Lv.mp * 1000 - d.mp : 0); wat.set(wl(mw));
        // поза кувшина: перетаскивание на схеме (tilt) или короткий налив по нажатию
        const since = t - pourAt, kp = since >= 0 && since < 1.3 ? Math.sin(Math.PI * since / 1.3) : 0;
        const k = kit.reduce ? (kp > 0 || (Lv.tilt || 0) > 0.25 ? 1 : 0) : Math.max(kp * 1.1, clamp(((Lv.tilt || 0) - 0.05) / 0.3, 0, 1));
        const kk = clamp(k, 0, 1);
        jp.position.set(-24 + 8 * kk, 18 * kk, 4); jp.rotation.z = -1.05 * kk;
        stream.visible = kk > 0.9 && jug > 0.5;
      } else if (blockApi) {
        const drop = Lv.drop ?? (d.inW ? 1 : 0); blockApi(drop); blockApi.tint(Lv.Tb ?? d.Tb ?? 100);
      }
    });
  };

  // ===== «Плавление»: стакан со льдом на плитке нагрева/охлаждения, термометр, датчик с графиком =====
  SC['heat-melt'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, cable, C } = kit, h = H(kit);
    const g = new T.Group(); at(g, 0, 0, 0);
    const px = -16, pz = -2, heat = d.mode === 'heat', cool = d.mode === 'cool';
    const hp = h.hotplate(g, px, pz, { on: heat, cool, w: 30, d: 28 }); clickable(hp.g, 'plate');
    clickable(hp.knob, 'pcycle');
    h.button(hp.g, -10.5, 7.4, 11.4, '▲', 0xe0473a, 'heat'); h.button(hp.g, -5.5, 7.4, 11.4, '▼', 0x3b6fd8, 'cool'); h.button(hp.g, 9, 7.4, 11.4, '■', 0x5d6a86, 'stop');
    const pScr = h.screen(12, 3.2, heat ? 'нагрев ' + d.P + ' Вт' : cool ? 'холод ' + d.P + ' Вт' : 'выкл · ' + d.P + ' Вт', heat ? '#ffb547' : cool ? '#8fd0ff' : '#e8ecf4'); at(pScr, px - 1, 3.8, pz + 14.06, g);
    const by = hp.top, R = 8.5, BH = 21;
    const bk = h.beaker(g, px, by, pz, R, BH); clickable(bk.g, 'plate');
    const y0 = by + 0.6, WMAX = 9;
    const wat = h.liquid(g, px, y0, pz, R - 0.45, 0x5fb4d9, 0.6);
    // лёд: кубики (сначала) или слой льда снизу (вода замёрзла на холодной плите)
    const iceMat = h.ownMat(0xe4f5ff, { transparent: true, opacity: 0.82 });
    const cubes = [];
    for (let k = 0; k < 9; k++) {
      const L = Math.floor(k / 3), j = k % 3, a = j * Math.PI * 2 / 3 + L * 0.9;
      const m = mesh(new T.BoxGeometry(4, 4, 4), 0, { mat: iceMat }); m.rotation.y = rnd(k) * 1.5; m.rotation.z = (rnd(k + 4) - 0.5) * 0.2;
      at(m, px + Math.cos(a) * 3.1, y0 + 2 + L * 4.1, pz + Math.sin(a) * 3.1, g); cubes.push({ m, L, a });
    }
    const slab = mesh(new T.CylinderGeometry(R - 0.5, R - 0.55, 1, 40), 0, { mat: iceMat, hull: false }); at(slab, px, y0, pz, g);
    const frost = new T.Mesh(kit.keep(new T.CylinderGeometry(R + 0.25, R * 0.97 + 0.25, 11, 40, 1, true)), h.glassMat(0xf4fbff, 0.4)); at(frost, px, by + 5.5, pz, g);
    const tx = px + 3.6, tz = pz - 3.8;
    const th = h.thermo(g, tx, by + 1.4, tz, 26, -30, 50, d.t ?? -20, { mark: 0 });
    h.stand(g, px - 9, pz - 20, 32, [{ y: by + 21, to: v3(tx, 0, tz) }]);
    const mist = h.steam(g, px, by - 1, pz, { n: 7, spread: 22, size: 6, rise: 4, op: 0.5, color: 0xdff2ff, amt: cool ? 1 : 0, speed: 0.25 });
    const shimmer = h.steam(g, px, by + BH, pz, { n: 4, spread: 6, size: 3.4, rise: 10, op: 0.35, amt: 0 });
    // датчик температуры с экраном: график t(время)
    const mg = new T.Group(); at(mg, 26, 0, -6, g); mg.rotation.y = 0.5;
    at(box(12, 1.2, 9, C.DARK), 0, 0.6, 0, mg);
    at(box(3, 9, 2.4, C.DARK), 0, 5.6, -1.5, mg);
    const fr = new T.Group(); at(fr, 0, 9.5, -1, mg); fr.rotation.x = -0.22;
    at(box(33, 22, 1.6, 0x26324a), 0, 9, 0, fr);
    const gc = document.createElement('canvas'); gc.width = 512; gc.height = 336; const gx = gc.getContext('2d');
    const gtex = kit.keep(new T.CanvasTexture(gc)); gtex.colorSpace = T.SRGBColorSpace;
    at(new T.Mesh(kit.keep(new T.PlaneGeometry(31, 20.3)), kit.keep(new T.MeshBasicMaterial({ map: gtex }))), 0, 9, 0.82, fr);
    // щуп датчика в стакане
    const pt = v3(px - 3.5, by + 2, pz + 1.5), ph = v3(px - 6.5, by + BH + 5, pz + 2.5);
    h.rodAB(g, pt, ph, 0.32, C.STEEL); at(box(1.5, 3, 1.5, 0xf2c94c), ph.x, ph.y + 1.3, ph.z, g);
    mg.updateMatrixWorld(true);
    cable(ph.clone().add(v3(0, 2.8, 0)), v3(0, 2, -3).applyMatrix4(mg.matrixWorld), 0x2a2f3a, 0, { r: 0.5, lift: 2 });
    function drawGraph(Lv) {
      const W = 512, Hh = 336, x0 = 54, x1 = 494, yT = 26, yB = 290;
      gx.fillStyle = '#0e1520'; gx.fillRect(0, 0, W, Hh);
      const tau = Lv.tau || 0, tMaxG = Math.max(120, Math.ceil(tau * 1.12 / 60) * 60);
      const X = s => x0 + (x1 - x0) * s / tMaxG, Y = v => yB - (yB - yT) * (v + 25) / 70;
      gx.font = '600 22px "IBM Plex Mono", monospace'; gx.textBaseline = 'middle';
      for (const v of [-20, 0, 20, 40]) {
        gx.strokeStyle = v === 0 ? '#5d6a86' : '#26324a'; gx.lineWidth = v === 0 ? 2 : 1; gx.setLineDash(v === 0 ? [] : [4, 5]);
        gx.beginPath(); gx.moveTo(x0, Y(v)); gx.lineTo(x1, Y(v)); gx.stroke();
        gx.fillStyle = '#8b96ad'; gx.textAlign = 'right'; gx.fillText((v > 0 ? '+' : '') + String(v).replace('-', '−'), x0 - 8, Y(v));
      }
      gx.setLineDash([]);
      const stp = tMaxG <= 600 ? 60 : tMaxG <= 1200 ? 120 : 300;
      gx.textAlign = 'center';
      for (let s = 0; s <= tMaxG; s += stp) gx.fillText(String(s / 60), X(s), yB + 18);
      gx.textAlign = 'right'; gx.fillText('мин', x1, yB + 36 > Hh - 6 ? Hh - 10 : yB + 36);
      const pts = (Lv.pts || []).concat([[tau, Lv.t, Lv.ph === 'mix' ? 1 : 0]]);
      gx.lineJoin = 'round';
      for (let i = 1; i < pts.length; i++) {
        const mix = pts[i][2];
        gx.strokeStyle = mix ? '#86e0a8' : '#ffb547'; gx.lineWidth = mix ? 6 : 4;
        gx.beginPath(); gx.moveTo(X(pts[i - 1][0]), Y(pts[i - 1][1])); gx.lineTo(X(pts[i][0]), Y(pts[i][1])); gx.stroke();
      }
      gx.fillStyle = '#e8ecf4'; gx.beginPath(); gx.arc(X(tau), Y(Lv.t), 7, 0, 7); gx.fill();
      gx.fillStyle = '#e8ecf4'; gx.textAlign = 'left'; gx.font = '700 30px "IBM Plex Mono", monospace'; gx.fillText(fmt(Lv.t, 1) + ' °C', x0 + 10, yT + 10);
      gtex.needsUpdate = true;
    }
    const st0 = { t: d.t ?? -20, liq: d.liq ?? 0, tau: 0, ph: 'solid', pts: [] };
    let lastDraw = -9;
    kit.onFrame((dt, tt) => {
      const Lv = live() || st0, t = Lv.t ?? st0.t, liq = Lv.liq ?? st0.liq;
      th.set(t);
      // вода и лёд
      const n = Math.ceil(9 * (1 - liq) - 1e-9), last = clamp(9 * (1 - liq) - (n - 1), 0.35, 1);
      if (d.melted) {
        const hi = (1 - liq) * 9.8; slab.visible = hi > 0.05; slab.scale.y = Math.max(0.05, hi); slab.position.y = y0 + Math.max(0.05, hi) / 2;
        wat.set(liq * WMAX, y0 + hi); cubes.forEach(c => { c.m.visible = false; });
      } else {
        slab.visible = false; wat.set(liq * WMAX);
        const wTop = y0 + liq * WMAX, b0 = liq > 0 ? Math.max(y0, wTop - 3.4) : y0;
        cubes.forEach((c, k) => { c.m.visible = k < n; const s = k === n - 1 ? last : 1; c.m.scale.setScalar(s); c.m.position.y = b0 + 2 * s + c.L * 4.1; });
      }
      wat.mat.color.copy(wcol(T, t, 0, 60));
      frost.visible = t < -0.5;
      shimmer.set(t > 25 ? 0.4 : 0);
      if (tt - lastDraw > 0.3) { lastDraw = tt; const full = live(true); drawGraph(full || { ...st0, t }); }
    });
    const modeTxt = heat ? 'нагрев ' + d.P + ' Вт' : cool ? 'охлаждение ' + d.P + ' Вт' : 'выключена';
    tag(v3(px - 19, 9, pz + 4), 'Плитка', modeTxt, heat);
    tag(v3(tx - 1.5, by + 30, tz), 'Стакан · ' + d.m * 1000 + ' г', d.run ? (heat ? 'нагрев…' : 'охлаждение…') : d.ttxt + ' · лёд ' + d.iceg + ' г');
    tag(v3(24, 32, -9), 'Датчик · t(время)', 'зелёное — 0 °C');
  };

  // ===== «Испарение и кипение»: плитка с кастрюлей, крышка, вентилятор, термометр, барометр, макет горы =====
  SC['heat-boil'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, cable, C } = kit, h = H(kit);
    const g = new T.Group(); at(g, 0, 0, 0);
    const sx = -6, sz = -4;
    const hp = h.hotplate(g, sx, sz, { on: d.on, w: 32, d: 28, r: 11 }); clickable(hp.g, 'stove'); clickable(hp.knob, 'p2cycle');
    const pScr = h.screen(12, 3.2, d.P + ' Вт', d.on ? '#ffb547' : '#e8ecf4'); at(pScr, sx - 1, 3.8, sz + 14.06, g);
    const potY = hp.top, PR = 12, PH = 13;
    const pot = mesh(new T.CylinderGeometry(PR, PR * 0.98, PH, 40, 1, true), 0, { mat: kit.toon(0xc6ccd6, { side: T.DoubleSide }), hull: true }); at(pot, sx, potY + PH / 2, sz, g);
    at(cyl(PR * 0.98, 0.7, 0x9aa3b2, { edges: false }), sx, potY + 0.35, sz, g);
    const prim = mesh(new T.TorusGeometry(PR, 0.4, 6, 40), 0xdfe3ea, { edges: false }); prim.rotation.x = Math.PI / 2; at(prim, sx, potY + PH, sz, g);
    for (const s of [-1, 1]) at(box(4, 1, 2.4, 0x2c3240), sx + s * (PR + 2), potY + PH - 2, sz, g);
    const WMAX = 10;
    const water = h.liquid(g, sx, potY + 0.7, sz, PR - 0.4, 0x5fb4d9, 0.82);
    const bub = h.bubbles(g, sx, potY + 0.7, sz, PR - 3, 12);
    // крышка: на кастрюле или лежит рядом
    const lg = new T.Group(); clickable(lg, 'lid');
    at(cyl(PR + 0.6, 0.7, 0xdfe3ea), 0, 0.35, 0, lg); at(cyl(1.4, 1.6, C.DARK), 0, 1.5, 0, lg);
    if (d.lid) at(lg, sx, potY + PH + 0.1, sz, g);
    else { at(lg, 23, 0, 2, g); }
    const lidY = potY + PH + 0.1;
    const st = h.steam(g, sx, potY + PH + 1, sz, { n: 9, spread: 14, size: 6, rise: 17, op: 0.62, amt: 0 });
    const leak = h.steam(g, sx + PR, potY + PH + 0.6, sz, { n: 4, spread: 3, size: 3, rise: 7, op: 0.5, amt: 0 });
    // вентилятор: дует вдоль +x над кастрюлей
    const fg = new T.Group(); at(fg, -46, 0, 14, g); fg.rotation.y = 0.42; clickable(fg, 'fan');
    at(cyl(5, 1.2, 0x3b4a66), 0, 0.6, 0, fg); at(cyl(0.7, 17, C.STEEL, { edges: false }), 0, 9, 0, fg);
    const mot = cyl(2.6, 5, 0x3b4a66); mot.rotation.z = Math.PI / 2; at(mot, -2.4, 19, 0, fg);
    const guard = mesh(new T.TorusGeometry(7.4, 0.35, 6, 36), 0x9aa3b2, { edges: false }); guard.rotation.y = Math.PI / 2; at(guard, 1.2, 19, 0, fg);
    const blades = new T.Group(); at(blades, 1, 19, 0, fg);
    for (let k = 0; k < 3; k++) { const bl = new T.Group(); bl.rotation.x = k * Math.PI * 2 / 3; blades.add(bl); const b = box(0.5, 6, 2.6, d.fan ? 0x72d4e8 : 0x8b96ad); b.rotation.y = 0.35; at(b, 0, 3.4, 0, bl); }
    at(cyl(1.2, 1.4, C.DARK), 1.2, 19, 0, fg).rotation.z = Math.PI / 2;
    const wind = h.steam(fg, 7, 19, 0, { n: 6, spread: 6, size: 3, rise: 0, wind: 26, op: 0.28, color: 0xbfe8ff, amt: d.fan ? 1 : 0, speed: 0.7 });
    // цифровой термометр с щупом: температура и сколько выкипело
    const tg = new T.Group(); at(tg, -20, 0, 32, g);
    at(box(22, 7, 10, 0xf2c94c), 0, 3.5, 0, tg);
    const tScr = h.screen(19, 5.4, '', '#e8ecf4', 360, 120); at(tScr, 0, 3.6, 5.06, tg);
    const tip = v3(sx + 6, potY + 2.5, sz - 3), hnd = v3(sx + 7, potY + PH + 7, sz - 5);
    h.rodAB(g, tip, hnd, 0.35, C.STEEL); at(box(1.6, 3.4, 1.6, C.DARK), hnd.x, hnd.y + 1.4, hnd.z, g);
    tg.updateMatrixWorld(true);
    cable(v3(0, 7, -4).applyMatrix4(tg.matrixWorld), hnd.clone().add(v3(0, 3.1, 0)), 0x2a2f3a, 0, { r: 0.5, lift: 3 });
    // барометр-анероид
    const bg = new T.Group(); at(bg, 34, 0, 28, g); clickable(bg, 'lcycle');
    at(box(9, 1.2, 6, C.WOOD2), 0, 0.6, 0, bg); at(box(1.6, 5, 1.6, C.DARK), 0, 3.6, -1, bg);
    h.dial(bg, 0, 11, 0, 6, 'кПа', [[0, '30'], [1 / 3, '55'], [2 / 3, '80'], [1, '105']], (d.p - 30) / 75);
    // макет горы с флажками-местами
    const mx = 40, mz = -25;
    const mt = new T.Group(); at(mt, mx, 0, mz, g);
    at(box(30, 2, 22, C.WOOD2), 0, 1, 0, mt);
    at(box(7, 0.5, 21, 0x3f8fd8, { edges: false }), -11.2, 2.25, 0, mt);
    const cone = mesh(new T.ConeGeometry(11.5, 22, 9), 0x7d8f5f, { edgeAngle: 50 }); at(cone, 1, 13, -1, mt);
    const cap = mesh(new T.ConeGeometry(4.4, 8.4, 9), 0xf4f7fb, { edgeAngle: 50 }); at(cap, 1, 13 + 11 - 4.2 + 0.05, -1, mt);
    const ANG = { atyrau: -1.15, astana: -0.35, almaty: 0.35, shym: 1.0, khan: 0 };
    d.locs.forEach(o => {
      const hn = clamp(o.h / 7010, 0, 1), on = o.k === d.loc, a = ANG[o.k] ?? 0;
      const y = 2 + 22 * hn, rr = o.k === 'atyrau' ? 9.6 : 11.5 * (1 - hn) + 0.5;
      const fx = 1 + Math.sin(a) * rr, fz = -1 + Math.cos(a) * rr;
      const fgp = new T.Group(); at(fgp, fx, y, fz, mt); clickable(fgp, 'loc-' + o.k);
      at(cyl(0.2, on ? 6 : 4.4, C.BRASS, { edges: false, hull: false }), 0, on ? 3 : 2.2, 0, fgp);
      at(box(on ? 3.2 : 2.4, on ? 2 : 1.5, 0.15, on ? 0xffb547 : 0xe8ecf4), on ? 1.7 : 1.3, on ? 5 : 3.6, 0, fgp);
      at(h.hitBox(4, 7, 4), 0.8, 3, 0, fgp);
    });
    tag(v3(sx, potY + PH + 12, sz), 'Кастрюля · вода', 'кипит при ' + d.tbtxt);
    tag(v3(mx + 1, 30, mz - 1), 'Место · ' + d.name, d.hm + ' м');
    tag(v3(34, 19, 28), 'Барометр', d.ptxt);
    if (d.fan) tag(v3(-46, 29, 14), 'Вентилятор', 'дует', true);
    kit.onFrame((dt, t) => {
      const Lv = live() || {}, T2 = Lv.T ?? 20, m2 = Lv.m2 ?? d.m0, boiling = !!Lv.boiling;
      const lvl = WMAX * clamp(m2 / d.m0, 0, 1.2);
      water.set(lvl); water.mat.color.copy(wcol(T, T2, 15, 100));
      bub.set(T2 > d.tb - 15 ? (boiling ? 1 : 0.35) : 0, lvl, boiling ? 0.8 : 0.4, boiling ? 1.1 : 0.6);
      const evap = clamp((T2 - 35) / 60, 0, 1) * 0.35;
      st.set(d.lid ? 0 : boiling ? 1 : evap, d.fan ? 18 : 0);
      leak.set(d.lid && boiling ? 0.9 : 0);
      if (d.lid) lg.position.y = lidY + (boiling && !kit.reduce ? 0.35 + 0.35 * Math.sin(t * 22) : 0);
      if (d.fan && !kit.reduce) blades.rotation.x += dt * 16;
      tScr.userData.set(fmt(T2, 1) + ' °C\nвыкипело ' + fmt((Lv.boilM || 0) * 1000, 0) + ' г', boiling ? '#86e0a8' : '#e8ecf4');
    });
  };

  // ===== «Влажность воздуха»: увлажнитель, окно, психрометр, гигрометр, стакан с термометром и миска со льдом =====
  SC['heat-hum'] = (kit, d) => {
    const { T, at, box, cyl, mesh, v3, tag, clickable, cable, C } = kit, h = H(kit);
    const g = new T.Group(); at(g, 0, 0, 0);
    // стена с окном (сзади справа)
    const wz = -37, wg = new T.Group(); at(wg, 0, 0, wz, g); clickable(wg, 'window');
    const WALL = 0xd9cdb8;
    at(box(12, 26, 2, WALL), 12, 13, 0, wg); at(box(12, 26, 2, WALL), 54, 13, 0, wg);
    at(box(30, 7, 2, WALL), 33, 3.5, 0, wg); at(box(30, 4, 2, WALL), 33, 24, 0, wg);
    at(box(31, 1.4, 4, 0xf4f4f4), 33, 7.2, 1.2, wg);
    const sky = new T.Mesh(kit.keep(new T.PlaneGeometry(30, 15)), kit.keep(new T.MeshBasicMaterial({ color: 0x24406a }))); at(sky, 33, 14.5, -3, wg);
    for (let i = 0; i < 14; i++) at(new T.Mesh(kit.keep(new T.SphereGeometry(0.35, 6, 4)), kit.keep(new T.MeshBasicMaterial({ color: 0xffffff }))), 19.5 + rnd(i) * 27, 8 + rnd(i + 7) * 13, -2.6, wg);
    const frame = (parent, w, hh) => { at(box(w, 1, 1, 0xf4f4f4), 0, hh / 2, 0, parent); at(box(w, 1, 1, 0xf4f4f4), 0, -hh / 2, 0, parent); at(box(1, hh, 1, 0xf4f4f4), -w / 2, 0, 0, parent); at(box(1, hh, 1, 0xf4f4f4), w / 2, 0, 0, parent); };
    const fixed = new T.Group(); at(fixed, 40.5, 14.5, 0, wg); frame(fixed, 15, 15);
    at(new T.Mesh(kit.keep(new T.PlaneGeometry(14, 14)), h.glassMat(0xbfe3f2, 0.35)), 0, 0, 0, fixed);
    const hinge = new T.Group(); at(hinge, 18, 14.5, 0, wg); hinge.rotation.y = d.vent ? -1.1 : 0;
    const sash = new T.Group(); at(sash, 7.5, 0, 0, hinge); frame(sash, 15, 15);
    at(new T.Mesh(kit.keep(new T.PlaneGeometry(14, 14)), h.glassMat(0xbfe3f2, 0.35)), 0, 0, 0, sash);
    at(box(0.8, 2.4, 0.8, C.BRASS), 6, 0, 0.8, sash);
    const cold = h.steam(g, 33, 12, wz + 3, { n: 6, spread: 12, size: 5, rise: 3, op: 0.4, color: 0xcfe8ff, amt: d.vent ? 1 : 0, speed: 0.3 });
    // увлажнитель
    const hg = new T.Group(); at(hg, -42, 0, 4, g); clickable(hg, 'hum');
    at(cyl(7, 3, 0xe8ecf4, { r2: 6.6 }), 0, 1.5, 0, hg);
    at(cyl(6.2, 8, 0x9fd0ef, { r2: 5.4, matOpt: { transparent: true, opacity: 0.55 } }), 0, 7, 0, hg);
    at(cyl(5.2, 5, 0x5fb4d9, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.6 } }), 0, 5.5, 0, hg);
    at(cyl(5.4, 1.4, 0xe8ecf4), 0, 11.7, 0, hg); at(cyl(1.6, 2.6, 0xe8ecf4, { r2: 1.2 }), 0, 13.6, 0, hg);
    at(new T.Mesh(kit.keep(new T.SphereGeometry(0.7, 10, 8)), kit.keep(new T.MeshBasicMaterial({ color: d.hum ? 0x3fe07a : 0x2a3a30 }))), 0, 1.8, 6.95, hg);
    const mist = h.steam(hg, 0, 15, 0, { n: 10, spread: 4, size: 6, rise: 18, op: 0.9, amt: d.hum ? 1 : 0, speed: 0.45 });
    // психрометр: сухой и влажный термометры на доске, фитиль в стаканчике с водой
    const psx = -16, psz = -23;
    at(box(20, 1.4, 8, C.DARK), psx, 0.7, psz, g);
    at(box(17, 30, 1, 0xf1e3c2), psx, 1.4 + 15, psz - 1, g);
    const dry = h.thermo(g, psx - 4, 9, psz, 19, 0, 40, d.T3), wet = h.thermo(g, psx + 4, 9, psz, 19, 0, 40, d.tw ?? d.T3);
    at(cyl(1.5, 2.6, 0xffffff, { seg: 14 }), psx + 4, 9, psz, g);
    at(box(0.9, 4.5, 0.4, 0xffffff, { edges: false }), psx + 4, 5.8, psz + 0.9, g);
    const pc = h.beaker(g, psx + 4, 1.4, psz + 1.6, 2.2, 4.4); h.liquid(g, psx + 4, 2, psz + 1.6, 1.9, 0x5fb4d9, 0.6).set(2.8);
    at(h.flat(6, 1.8, kit.textTex('сухой', '#1b1610', '#f1e3c2', 160, 48)), psx - 4, 30.2, psz - 0.45, g);
    at(h.flat(6, 1.8, kit.textTex('мокрый', '#1b1610', '#f1e3c2', 160, 48)), psx + 4, 30.2, psz - 0.45, g);
    // гигрометр
    const hyg = new T.Group(); at(hyg, 8, 0, -24, g);
    at(box(9, 1.2, 6, C.WOOD2), 0, 0.6, 0, hyg); at(box(1.6, 6, 1.6, C.DARK), 0, 4.2, -1, hyg);
    const dl = h.dial(hyg, 0, 13, 0, 6.6, 'φ, %', [[0, '0'], [0.2, '20'], [0.4, '40'], [0.6, '60'], [0.8, '80'], [1, '100']], (d.phi ?? 30) / 100);
    // стакан с водой, термометр-щуп с кнопками ▼▲, миска со льдом
    const gx = 22, gz = 14;
    const gb = h.beaker(g, gx, 0, gz, 5, 12); clickable(gb.g, 'g-1');
    const gw = h.liquid(g, gx, 0.6, gz, 4.6, 0x5fb4d9, 0.6); gw.set(8.6); gw.mat.color.copy(wcol(T, d.Tg, 0, 40));
    const nIce = d.Tg < d.T3 - 0.4 ? Math.min(3, Math.ceil((d.T3 - d.Tg) / 8)) : 0;
    const iceMat = h.ownMat(0xe4f5ff, { transparent: true, opacity: 0.85 });
    for (let k = 0; k < nIce; k++) { const c = mesh(new T.BoxGeometry(2.6, 2.6, 2.6), 0, { mat: iceMat }); c.rotation.y = k * 0.7; at(c, gx - 1.6 + k * 1.6, 8.2, gz + (k % 2 ? 1.2 : -1), g); }
    if (d.fogged) {
      at(new T.Mesh(kit.keep(new T.CylinderGeometry(5.12, 4.97, 11.6, 40, 1, true)), h.glassMat(0xf4f8fb, 0.42)), gx, 6, gz, g);
      const dg = kit.keep(new T.SphereGeometry(1, 8, 6)), dm = kit.keep(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
      for (let i = 0; i < 26; i++) { const a = -0.9 + rnd(i + 300) * 2.6, y = 1 + rnd(i + 400) * 10, m = new T.Mesh(dg, dm); m.scale.setScalar(0.22 + rnd(i + 500) * 0.25); at(m, gx + Math.sin(a) * 5.15, y, gz + Math.cos(a) * 5.15, g); }
    }
    const dt0 = new T.Group(); at(dt0, 38, 0, 24, g);
    at(box(14, 5, 9, 0xf2c94c), 0, 2.5, 0, dt0);
    const gScr = h.screen(11, 3, fmt(d.Tg, 1) + ' °C', d.fogged ? '#86e0a8' : '#e8ecf4'); at(gScr, 0, 2.5, 4.56, dt0);
    h.button(dt0, -3.2, 5, -1, '▼', 0x3b6fd8, 'g-1'); h.button(dt0, 3.2, 5, -1, '▲', 0xe0473a, 'g+1');
    const ptip = v3(gx + 2, 2.4, gz - 1.5), phd = v3(gx + 3, 16, gz - 3);
    h.rodAB(g, ptip, phd, 0.3, C.STEEL); at(box(1.4, 3, 1.4, C.DARK), phd.x, phd.y + 1.2, phd.z, g);
    dt0.updateMatrixWorld(true);
    cable(v3(-5.5, 5, -3).applyMatrix4(dt0.matrixWorld), phd.clone().add(v3(0, 2.7, 0)), 0x2a2f3a, 0, { r: 0.45, lift: 2 });
    const bowl = new T.Group(); at(bowl, 6, 0, 26, g); clickable(bowl, 'g-1');
    at(cyl(4.4, 3, 0xe8ecf4, { r2: 6 }), 0, 1.5, 0, bowl);
    for (let k = 0; k < 4; k++) { const c = mesh(new T.BoxGeometry(2.4, 2.4, 2.4), 0, { mat: iceMat }); c.rotation.y = k * 0.8; at(c, -1.6 + (k % 2) * 3.2, 3.2, -1.2 + (k > 1 ? 2.4 : 0), bowl); }
    // пар в воздухе: точки, сколько — по ρ; туман при насыщении
    const dotGeo = kit.keep(new T.SphereGeometry(0.42, 8, 6)), dotMat = kit.keep(new T.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.8 }));
    const dots = [];
    for (let i = 0; i < 70; i++) { const m = new T.Mesh(dotGeo, dotMat); m.visible = false; g.add(m); dots.push({ m, x: -54 + rnd(i) * 108, y: 6 + rnd(i + 100) * 22, z: -26 + rnd(i + 200) * 56, ph: i * 1.7 }); }
    const haze = h.spr((() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return kit.keep(new T.CanvasTexture(c)); })(), 0xe8f2fa, 0, false);
    haze.scale.set(130, 50, 1); at(haze, 0, 16, 0, g);
    tag(v3(-42, 22, 4), 'Увлажнитель', d.hum ? 'работает' : 'выключен', d.hum);
    tag(v3(psx, 32, psz), 'Психрометр', d.changing ? 'меняется…' : 'сухой ' + d.T3txt + ' · мокрый ' + d.twtxt);
    tag(v3(8, 23, -24), 'Гигрометр', d.changing ? 'φ меняется…' : 'φ = ' + d.phi + ' %', !d.changing && d.comfortNow);
    tag(v3(gx, 15, gz), 'Стакан', d.Tgtxt + (d.fogged ? ' · запотел' : ''), d.fogged);
    tag(v3(33, 27, wz), 'Окно', d.vent ? 'открыто · −10 °C' : 'закрыто', d.vent);
    kit.onFrame((dt, t) => {
      const Lv = live() || {}, rho = Lv.rho ?? 4, phi = Lv.phi ?? d.phi ?? 30, tw = Lv.tw ?? d.tw ?? d.T3;
      dry.set(d.T3); wet.set(tw); dl.set(phi / 100);
      const nd = clamp(Math.round(rho * 3.2), 0, dots.length);
      dots.forEach((p, i) => { p.m.visible = i < nd; if (!p.m.visible) return; const w = kit.reduce ? 0 : t; p.m.position.set(p.x + 2 * Math.sin(w * 0.7 + p.ph), p.y + 1.5 * Math.cos(w * 0.6 + p.ph * 1.3), p.z + 2 * Math.sin(w * 0.5 + p.ph * 2)); });
      haze.material.opacity = Lv.fog ? 0.32 : 0;
    });
  };
})();
