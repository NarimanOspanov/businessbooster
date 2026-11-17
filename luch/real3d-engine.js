// «Как в жизни» для тем «Тепловые двигатели» (labs/phys-engines) и «Термодинамика» (labs/phys-thermo):
// модель ДВС в разрезе на стенде, котёл с паровой турбинкой и генератором с прожекторами, машинка на дороге до аула
// с мерной колбой топлива и табло энергии, цилиндр с поршнем на горелке (упоры или груз), цилиндр с грузами и графиком p(V),
// медные бруски с тепловым насосом, машина Карно между нагревателем и холодильником с табло цикла,
// электростанция, ветряк, машины и дом с тепловым насосом (урок «Тепловые машины и экология»).
// Сцены строятся из window.LUCH_REAL() опыта; быстрые значения (угол вала, обороты, температуры) — из LUCH_REAL.live() в onFrame.
(() => {
  const SC = window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {};
  const live = () => { try { return window.LUCH_REAL.live ? window.LUCH_REAL.live() : null; } catch (e) { return null; } };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (x, n = 1) => { let s = (Math.round(x * 10 ** n) / 10 ** n).toFixed(n); if (/^-0(\.0+)?$/.test(s)) s = s.slice(1); return s.replace('.', ',').replace('-', '−'); };
  const big = x => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const rnd = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const tri = z => { const m = ((z % 2) + 2) % 2; return 1 - Math.abs(m - 1); };
  const now = () => performance.now() / 1000;
  const MONO = '"IBM Plex Mono", monospace', BODY = '"Golos Text", system-ui, sans-serif';
  // память между перестройками сцены: чтобы поршень и брусок доезжали плавно, а не прыгали
  const mem = {};

  // ---------- общие детали ----------
  function H(kit) {
    const { T, at, box, cyl, mesh, keep, grad, glowTex, textTex, clickable, toon, C } = kit;
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    // масштаб и сдвиг всей сцены (вызывается в конце): новые детали уходят в группу W, подписи пересчитываются
    const n0 = kit.root.children.length, tagPts = [], XF = { s: 1, dx: 0, dz: 0, W: null };
    const tag = (p, ...a) => { tagPts.push(p); kit.tag(p, ...a); return p; };
    function fin(sc, dx = 0, dz = 0) {
      const W = new T.Group(); W.position.set(dx, 0, dz); W.scale.setScalar(sc);
      kit.root.children.slice(n0).forEach(c => W.add(c)); kit.root.add(W);
      Object.assign(XF, { s: sc, dx, dz, W });
      tagPts.forEach(p => p.set(p.x * sc + dx, p.y * sc, p.z * sc + dz));
    }
    const wx = x => x * XF.s + XF.dx;
    const layer = () => XF.W || kit.root;
    const glassMat = (color = 0xd8eef8, opacity = 0.26) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, transparent: true, opacity, side: T.DoubleSide, depthWrite: false }));
    const ownMat = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, ...o }));
    const spr = (map, color, opacity, add) => new T.Sprite(keep(new T.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending })));
    const glow = (color, size, opacity) => { const s = spr(glowTex(), color, opacity, true); s.scale.setScalar(size); return s; };
    const flat = (w, h, tex) => new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: keep(tex), transparent: true })));
    const hitBox = (w, h, d) => new T.Mesh(keep(new T.BoxGeometry(w, h, d)), keep(new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })));
    function rodAB(parent, a, b, r, color, o = {}) {
      const dv = b.clone().sub(a), L = dv.length();
      const m = cyl(r, L, color, { edges: false, ...o });
      m.quaternion.setFromUnitVectors(v3(0, 1, 0), dv.normalize());
      return at(m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, parent);
    }
    // ломаная труба с круглыми коленами
    function pipe(parent, pts, r, color) {
      for (let i = 1; i < pts.length; i++) rodAB(parent, pts[i - 1], pts[i], r, color);
      for (let i = 1; i < pts.length - 1; i++) at(new T.Mesh(keep(new T.SphereGeometry(r * 1.12, 14, 10)), toon(color)), pts[i].x, pts[i].y, pts[i].z, parent);
    }
    // холст-табло: draw(ctx, w, h) рисует, upd() — заново
    function canvasPlane(w, h, pw, ph, draw) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph; const x = c.getContext('2d');
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: tex })));
      m.userData.upd = (...a) => { draw(x, pw, ph, ...a); tex.needsUpdate = true; };
      m.userData.upd();
      return m;
    }
    // табло с текстом, который меняется в onFrame (строки через \n)
    function screen(w, h, txt, fg = '#86e0a8', pw = 320, ph = 120) {
      let cur = null;
      const m = canvasPlane(w, h, pw, ph, () => {});
      const c = m.material.map.image, x = c.getContext('2d');
      const set = (t, col = fg) => {
        t = String(t); if (cur === t + col) return; cur = t + col;
        x.fillStyle = '#0e1520'; x.fillRect(0, 0, pw, ph); x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle';
        const lines = t.split('\n'), lh = ph / lines.length;
        lines.forEach((ln, i) => {
          let fs = Math.round(lh * 0.64); x.font = `600 ${fs}px ${MONO}`;
          const tw = x.measureText(ln).width; if (tw > pw * 0.9) { fs = Math.floor(fs * pw * 0.9 / tw); x.font = `600 ${fs}px ${MONO}`; }
          x.fillText(ln, pw / 2, lh * (i + 0.5) + 2);
        });
        m.material.map.needsUpdate = true;
      };
      set(txt); m.userData.set = set; return m;
    }
    // кнопка: колпачок с надписью сверху
    function button(parent, x, y, z, label, color, key, w = 4.2, d = 3.6) {
      const b = new T.Group(); at(b, x, y, z, parent);
      at(box(w, 1.4, d, color), 0, 0.7, 0, b);
      const top = flat(w * 0.86, d * 0.8, textTex(label, '#ffffff', '#' + color.toString(16).padStart(6, '0'), 192, Math.round(192 * d / w)));
      top.rotation.x = -Math.PI / 2; at(top, 0, 1.42, 0, b);
      clickable(b, key); return b;
    }
    // пламя: капля-спрайт, колышется
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
    function flame(parent, x, y, z, hgt, inner = '#d8f0ff', outer = '#4a9cff', glowCol = 0x6ab0ff, spread = 0) {
      const g = new T.Group(); at(g, x, y, z, parent);
      const tex = flameTex(inner, outer), parts = [];
      const offs = spread ? [[0, 0, 1], [-spread, spread * 0.4, 0.72], [spread, -spread * 0.3, 0.78], [spread * 0.3, spread * 0.8, 0.64], [-spread * 0.5, -spread * 0.7, 0.7]] : [[0, 0, 1]];
      offs.forEach(([dx, dz, k], i) => {
        const s = spr(tex, 0xffffff, 0.94, false); s.center.set(0.5, 0.04); s.scale.set(hgt * 0.5 * k, hgt * k, 1);
        at(s, dx, 0, dz, g); parts.push({ s, k, ph: i * 2.1 });
      });
      at(glow(glowCol, hgt * 2.4, 0.5), 0, hgt * 0.35, 0, g);
      const light = at(new T.PointLight(glowCol, 40, 60, 1.3), 0, hgt * 0.5, 0, g);
      const st = { k: 1 };
      kit.onFrame((dt, t) => {
        for (const p of parts) {
          const f = kit.reduce ? 1 : 1 + 0.13 * Math.sin(t * 13 + p.ph) + 0.06 * Math.sin(t * 29 + p.ph * 3);
          p.s.scale.set(hgt * 0.5 * p.k * st.k, hgt * p.k * f * st.k, 1);
        }
      });
      return { g, light, set(k) { st.k = k; g.visible = k > 0.02; } };
    }
    let puffT = null;
    function puffTex() {
      if (puffT) return puffT;
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
      const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.5, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 64, 64); puffT = keep(new T.CanvasTexture(c)); return puffT;
    }
    // пар/дым: клубы поднимаются (или летят по dir) и тают
    function steam(parent, x, y, z, o = {}) {
      const n = o.n || 7, ps = [], g = new T.Group(); at(g, x, y, z, parent);
      for (let i = 0; i < n; i++) { const s = spr(puffTex(), o.color ?? 0xffffff, 0, false); g.add(s); ps.push({ s, ph: i / n, dx: (rnd(i + 3) - 0.5) * (o.spread ?? 6), dz: (rnd(i + 9) - 0.5) * (o.spread ?? 6) }); }
      const st = { amt: o.amt ?? 1 }, dir = o.dir || [0, 1, 0];
      kit.onFrame((dt, t) => {
        for (const p of ps) {
          const ph = kit.reduce ? 0.15 + p.ph * 0.7 : (t * (o.speed || 0.35) + p.ph) % 1, L = ph * (o.rise ?? 14);
          p.s.position.set(p.dx * (0.6 + ph) + dir[0] * L, dir[1] * L + (o.lift || 0) * ph * ph, p.dz * (0.6 + ph) + dir[2] * L);
          p.s.scale.setScalar((o.size || 4) * (0.6 + ph * 1.4));
          p.s.material.opacity = st.amt * (o.op ?? 0.55) * Math.sin(Math.PI * ph);
        }
      });
      return { g, set(a) { st.amt = a; } };
    }
    // стеклянный термометр
    function thermo(parent, x, y0, z, len, lo, hi, v) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      at(new T.Mesh(keep(new T.SphereGeometry(1.15, 16, 12)), toon(0xe0473a)), 0, 0, 0, g);
      at(cyl(0.82, len, 0xeef6fb, { matOpt: { transparent: true, opacity: 0.55 } }), 0, len / 2 + 0.6, 0, g);
      at(box(1.15, len - 1.6, 0.1, 0xfffaf0, { edges: false, shadow: false }), 0, len / 2 + 0.8, -0.38, g);
      const col = cyl(0.34, 1, 0xe0473a, { edges: false, hull: false, shadow: false }); at(col, 0, 1, 0.05, g);
      const span = len - 2.4, n = Math.round((hi - lo) / 10);
      for (let k = 0; k <= n; k++) at(box(k % 5 === 0 ? 1.3 : 0.8, 0.14, 0.1, 0x1b1610, { edges: false, shadow: false }), 0.4, 1.2 + span * k / n, 0.72, g);
      const set = t => { const f = clamp((t - lo) / (hi - lo), 0, 1), hh = 0.3 + span * f; col.scale.y = hh; col.position.y = 0.9 + hh / 2; };
      set(v); return { g, set };
    }
    // круглая шкала (манометр), стрелку двигаем каждый кадр
    function dial(parent, x, y, z, r, unit, marks, frac, red) {
      const g = new T.Group(); at(g, x, y, z, parent);
      const body = cyl(r, 1.8, 0xe8ecf4, { seg: 36 }); body.rotation.x = Math.PI / 2; at(body, 0, 0, 0, g);
      const ring = mesh(new T.TorusGeometry(r, 0.45, 8, 40), C.BRASS, { edges: false, hull: true }); at(ring, 0, 0, 0.95, g);
      let cur = null;
      const face = canvasPlane(r * 1.8, r * 1.8, 256, 256, () => {}); at(face, 0, 0, 0.92, g);
      const cx = face.material.map.image.getContext('2d');
      const set = f => {
        f = clamp(f, 0, 1); const k = Math.round(f * 400); if (k === cur) return; cur = k;
        cx.fillStyle = '#f7f3ea'; cx.fillRect(0, 0, 256, 256);
        const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
        if (red != null) { cx.strokeStyle = '#e0473a'; cx.lineWidth = 12; cx.beginPath(); cx.arc(128, 128, 94, a0 + (a1 - a0) * red, a1); cx.stroke(); }
        cx.strokeStyle = '#1b1610'; cx.lineWidth = 4; cx.beginPath(); cx.arc(128, 128, 100, a0, a1); cx.stroke();
        marks.forEach(([mf, t]) => {
          const a = a0 + (a1 - a0) * mf; cx.lineWidth = 4; cx.beginPath(); cx.moveTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100); cx.lineTo(128 + Math.cos(a) * 82, 128 + Math.sin(a) * 82); cx.stroke();
          cx.fillStyle = '#1b1610'; cx.font = `600 24px ${MONO}`; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(t, 128 + Math.cos(a) * 62, 128 + Math.sin(a) * 62);
        });
        for (let i = 0; i <= 20; i++) { const a = a0 + (a1 - a0) * i / 20; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100); cx.lineTo(128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92); cx.stroke(); }
        cx.fillStyle = '#1b1610'; cx.font = `700 28px ${BODY}`; cx.textAlign = 'center'; cx.fillText(unit, 128, 204);
        const a = a0 + (a1 - a0) * f;
        cx.strokeStyle = '#c0392b'; cx.lineWidth = 7; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(128, 128); cx.lineTo(128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92); cx.stroke();
        cx.fillStyle = '#1b1610'; cx.beginPath(); cx.arc(128, 128, 11, 0, 7); cx.fill();
        face.material.map.needsUpdate = true;
      };
      set(frac);
      return { g, set };
    }
    // мольберт-стойка для табло: доска w×h, низ на высоте y0, повернута к зрителю на rotY
    function easel(parent, x, z, w, h, y0, rotY = 0.3) {
      const g = new T.Group(); at(g, x, 0, z, parent); g.rotation.y = rotY;
      for (const s of [-1, 1]) { at(box(1.6, y0 + h + 1, 1.6, C.WOOD2), s * (w / 2 - 1.5), (y0 + h + 1) / 2, -1.6, g); at(box(3.4, 1, 7, C.WOOD2), s * (w / 2 - 1.5), 0.5, -1, g); }
      at(box(w + 2, h + 2, 1.4, 0x3b4a66), 0, y0 + h / 2, -0.4, g);
      return { g, face: (m) => { at(m, 0, y0 + h / 2, 0.34, g); return m; } };
    }
    // спиртовка/газовая горелка: корпус, фитиль, пламя
    function burner(parent, x, z, o = {}) {
      const g = new T.Group(); at(g, x, 0, z, parent);
      at(cyl(4.2, 1.2, C.DARK), 0, 0.6, 0, g);
      at(cyl(1.6, 5.4, 0x8a96b0), 0, 3.9, 0, g);
      at(cyl(2.3, 1.2, C.BRASS, { seg: 16 }), 0, 7.2, 0, g);
      const knob = cyl(1.1, 1.6, 0xe0473a); knob.rotation.z = Math.PI / 2; at(knob, 2.3, 2.2, 0, g);
      const fl = flame(g, 0, 7.8, 0, o.h || 7, '#e8f6ff', '#3a8cff', 0x5aa8ff, o.spread || 0);
      return { g, fl, top: 7.8 };
    }
    // треножник с сеткой
    function tripod(parent, x, z, y, r) {
      const ring = mesh(new T.TorusGeometry(r, 0.5, 8, 40), 0x3a3f4c, { edges: false, hull: true }); ring.rotation.x = Math.PI / 2; at(ring, x, y, z, parent);
      for (const a of [Math.PI / 6, Math.PI * 5 / 6, Math.PI * 1.5]) rodAB(parent, v3(x + Math.cos(a) * r, y, z + Math.sin(a) * r), v3(x + Math.cos(a) * (r + 5), 0.3, z + Math.sin(a) * (r + 5)), 0.5, 0x3a3f4c);
      at(box(r * 2.2, 0.3, r * 2.2, 0x9aa3b2, { edges: false }), x, y + 0.6, z, parent);
      return y + 0.75;
    }
    // цилиндр с газом и поршнем: стеклянная стенка, газ (цвет по T), молекулы, поршень со штоком и площадкой
    function gasCyl(parent, x, y0, z, o = {}) {
      const R = o.r || 6.5, Hc = o.h || 30, n = o.n || 22, g = new T.Group(); at(g, x, y0, z, parent);
      at(cyl(R + 1.3, 1.4, C.STEEL), 0, 0.7, 0, g);
      const wall = new T.Mesh(keep(new T.CylinderGeometry(R, R, Hc, 40, 1, true)), glassMat(0xd8eef8, 0.2)); at(wall, 0, 1.4 + Hc / 2, 0, g);
      wall.add(new T.Mesh(wall.geometry, kit.hullMat));
      const rim = mesh(new T.TorusGeometry(R, 0.3, 6, 40), 0xeef6fb, { edges: false }); rim.rotation.x = Math.PI / 2; at(rim, 0, 1.4 + Hc, 0, g);
      for (let k = 1; k <= 7; k++) { const m = box(k % 2 ? 1.1 : 2, 0.16, 0.1, 0x6f8098, { edges: false, shadow: false }); m.rotation.y = 0.5; at(m, Math.sin(0.5) * (R + 0.05), 1.4 + Hc * k / 8, Math.cos(0.5) * (R + 0.05), g); }
      const gasMat = ownMat(0x9aa6bd, { transparent: true, opacity: 0.4, depthWrite: false });
      const gas = new T.Mesh(keep(new T.CylinderGeometry(R - 0.25, R - 0.25, 1, 36)), gasMat); at(gas, 0, 1.4, 0, g);
      const mg = keep(new T.SphereGeometry(0.42, 8, 6)), mm = keep(new T.MeshBasicMaterial({ color: 0xffffff }));
      const mols = []; for (let i = 0; i < n; i++) { const m = new T.Mesh(mg, mm); g.add(m); mols.push({ m, a: rnd(i + 1) * 6.283, rr: Math.sqrt(rnd(i + 7)) * (R - 1.2), v: rnd(i + 13) * 2, b: rnd(i + 19) * 2 - 1, w: (rnd(i + 23) - 0.5) * 2 }); }
      const pg = new T.Group(); at(pg, 0, 1.4, 0, g);
      at(cyl(R - 0.12, 2.6, 0x8a96b0), 0, 1.3, 0, pg);
      for (const yy of [0.7, 1.5]) at(cyl(R - 0.06, 0.25, 0x2c3240, { edges: false, hull: false }), 0, yy, 0, pg);
      const rodL = o.rod ?? 6;
      if (rodL > 0) { at(cyl(0.75, rodL, C.STEEL, { edges: false }), 0, 2.6 + rodL / 2, 0, pg); at(cyl(3.6, 0.8, C.STEEL), 0, 2.6 + rodL + 0.4, 0, pg); }
      const st = { hgt: 10, sp: 0.3 };
      const set = hgt => { st.hgt = hgt; gas.scale.y = hgt; gas.position.y = 1.4 + hgt / 2; pg.position.y = 1.4 + hgt; };
      const lo = new T.Color(0x4f8fe0), mid = new T.Color(0x9aa6bd), hi = new T.Color(0xef6a3c);
      const setT = (Tk, a, b) => {
        const f = clamp((Tk - a) / (b - a), 0, 1);
        gasMat.color.copy(f < 0.5 ? lo.clone().lerp(mid, f * 2) : mid.clone().lerp(hi, (f - 0.5) * 2));
        st.sp = 0.25 * Math.sqrt(Math.max(Tk, 30) / 300);
      };
      kit.onFrame((dt, t) => {
        const tt = kit.reduce ? 0 : t;
        for (const p of mols) {
          const a = p.a + p.w * st.sp * tt * 3;
          p.m.position.set(Math.cos(a) * p.rr, 1.4 + 0.6 + tri(p.v + p.b * st.sp * tt * 1.6) * Math.max(0.1, st.hgt - 1.2), Math.sin(a) * p.rr);
        }
      });
      set(o.hgt || 10);
      return { g, pg, set, setT, R, Hc, platY: 2.6 + rodL + 0.8, st };
    }
    return { v3, tag, fin, wx, layer, glassMat, ownMat, spr, glow, flat, hitBox, rodAB, pipe, canvasPlane, screen, button, flame, steam, thermo, dial, easel, burner, tripod, gasCyl };
  }
  const ease = (cur, target, dt, k = 6) => cur + (target - cur) * (1 - Math.exp(-k * dt));

  // =====================================================================================
  // ДВС: учебная модель в разрезе на стенде
  // =====================================================================================
  const STROKES = ['впуск', 'сжатие', 'рабочий ход', 'выпуск'];
  const SCOL = ['#7fc4ff', '#72d4e8', '#ffb547', '#8b96ad'];
  function drawStrokes(x, W, H, a, k, win, info) {
    x.fillStyle = '#0e1520'; x.fillRect(0, 0, W, H);
    const cx = 100, cy = H / 2 + 4, R = 78;
    const P = (ang, r) => [cx + r * Math.sin(ang * Math.PI / 180), cy - r * Math.cos(ang * Math.PI / 180)];
    for (let s = 0; s < 4; s++) {
      x.beginPath(); x.moveTo(cx, cy);
      x.arc(cx, cy, R, (s * 90 + 1 - 90) * Math.PI / 180, (s * 90 + 89 - 90) * Math.PI / 180); x.closePath();
      x.globalAlpha = s === k ? 0.85 : 0.22; x.fillStyle = SCOL[s]; x.fill(); x.globalAlpha = 1;
      const [tx, ty] = P(s * 90 + 45, R * 0.6);
      x.fillStyle = s === k ? '#0e1520' : '#a9b4c9'; x.font = `700 26px ${MONO}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(s + 1), tx, ty);
    }
    x.strokeStyle = '#ff8a73'; x.lineWidth = 8; x.lineCap = 'round'; x.beginPath();
    x.arc(cx, cy, R + 10, (win[0] / 2 - 90) * Math.PI / 180, (win[1] / 2 - 90) * Math.PI / 180); x.stroke();
    const [px, py] = P(a / 2, R + 6);
    x.strokeStyle = '#e8ecf4'; x.lineWidth = 5; x.beginPath(); x.moveTo(cx, cy); x.lineTo(px, py); x.stroke();
    x.fillStyle = '#e8ecf4'; x.beginPath(); x.arc(cx, cy, 7, 0, 7); x.fill();
    x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    const tx = 196, fit = (t, px, wgt, fam, w) => { x.font = `${wgt} ${px}px ${fam}`; const m = x.measureText(t).width; if (m > w) x.font = `${wgt} ${Math.floor(px * w / m)}px ${fam}`; };
    x.fillStyle = '#8b96ad'; x.font = `600 22px ${BODY}`; x.fillText('такт', tx, 46);
    x.fillStyle = SCOL[k]; x.font = `700 64px ${MONO}`; x.fillText(String(k + 1), tx, 108);
    fit(STROKES[k], 32, 700, BODY, W - tx - 10); x.fillText(STROKES[k], tx, 146);
    x.fillStyle = '#ff8a73'; x.font = `600 22px ${BODY}`; x.fillText('— искра', tx, 186);
    x.fillStyle = '#e8ecf4'; fit(info, 24, 600, BODY, W - tx - 10); x.fillText(info, tx, 222);
  }
  SC['eng-ice'] = (kit, d) => {
    const { T, at, box, cyl, mesh, clickable, keep, toon, C } = kit, h = H(kit), v3 = h.v3, tag = h.tag;
    const OX = -16, OZ = -6;
    const g = new T.Group(); at(g, OX, 0, OZ);
    const Cy = 14.5, r = 5, l = 15, HEAD = 38.5, BORE = 5.8;
    // стенд: плинтус и задняя доска
    at(box(52, 3, 26, C.WOOD2), 0, 1.5, 0, g);
    at(box(48, 48, 1.6, 0xcfd6e2), 0, 27, -11.6, g);
    at(box(49, 1.2, 2.2, C.WOOD2), 0, 51.4, -11.6, g);
    const plate = h.flat(20, 2.4, kit.textTex('модель ДВС в разрезе', '#2c2416', '#d8b04a', 512, 62)); at(plate, 0, 1.6, 13.06, g);
    // задняя опора вала, вал, маховик
    const ped = box(5, Cy - 3, 3, C.DARK); at(ped, 0, 3 + (Cy - 3) / 2, -9, g);
    const brg = cyl(2.4, 3.4, C.STEEL); brg.rotation.x = Math.PI / 2; at(brg, 0, Cy, -9, g);
    const shaft = cyl(1.1, 8, C.STEEL, { edges: false }); shaft.rotation.x = Math.PI / 2; at(shaft, 0, Cy, -6, g);
    const fw = new T.Group(); at(fw, 0, Cy, -5.4, g); clickable(fw, 'turn');
    const disc = cyl(10.4, 1.6, 0x3a4762, { seg: 40 }); disc.rotation.x = Math.PI / 2; at(disc, 0, 0, 0, fw);
    const frim = mesh(new T.TorusGeometry(10.4, 1.3, 10, 48), 0xa9b4c9, { edges: false, hull: true }); at(frim, 0, 0, 0, fw);
    for (let s = 0; s < 6; s++) { const sp = box(1.4, 8.6, 0.6, 0x8a96b0, { edges: false }); sp.rotation.z = s * Math.PI / 3; sp.position.set(-Math.sin(s * Math.PI / 3) * 5, Math.cos(s * Math.PI / 3) * 5, 0.9); fw.add(sp); }
    at(new T.Mesh(keep(new T.SphereGeometry(1.1, 12, 8)), toon(0xffb547)), 0, 9.6, 1, fw);
    // кривошип: щёки, противовес, шейка
    const cr = new T.Group(); at(cr, 0, Cy, 0, g);
    at(box(3.6, r + 3.4, 1.2, 0xd9dfe9), 0, r / 2 - 0.4, -2.6, cr);
    const cw = cyl(4.6, 1.2, 0x6c7890, { seg: 28 }); cw.rotation.x = Math.PI / 2; cw.scale.set(1, 1, 0.6); at(cw, 0, -2.2, -2.6, cr);
    const hub = cyl(1.8, 1.4, C.STEEL); hub.rotation.x = Math.PI / 2; at(hub, 0, 0, -2.6, cr);
    const cpin = cyl(1.2, 3.4, C.STEEL); cpin.rotation.x = Math.PI / 2; at(cpin, 0, r, -0.9, cr);
    // шатун
    const rod = new T.Group(); at(rod, 0, 0, 0.1, g);
    at(box(1.8, l - 2.4, 1.1, 0xc6ccd6), 0, 0, 0, rod);
    const eye1 = cyl(1.9, 1.3, 0xc6ccd6); eye1.rotation.x = Math.PI / 2; at(eye1, 0, -l / 2, 0, rod);
    const eye2 = cyl(1.4, 1.3, 0xc6ccd6); eye2.rotation.x = Math.PI / 2; at(eye2, 0, l / 2, 0, rod);
    // поршень
    const pis = new T.Group(); at(pis, 0, 0, 0, g);
    at(cyl(BORE, 5.5, 0xa9b4c9, { seg: 36 }), 0, 0.25, 0, pis);
    for (const yy of [1.6, 2.4]) at(cyl(BORE + 0.05, 0.3, 0x2c3240, { edges: false, hull: false }), 0, yy, 0, pis);
    // цилиндр: прозрачная гильза, задняя половина блока, красные плоскости разреза
    const GY0 = 21;
    const glass = new T.Mesh(keep(new T.CylinderGeometry(6.0, 6.0, HEAD - GY0, 40, 1, true)), h.glassMat(0xd8eef8, 0.18)); at(glass, 0, (HEAD + GY0) / 2, 0, g);
    glass.add(new T.Mesh(glass.geometry, kit.hullMat));
    const shellMat = toon(0x6c7890, { side: T.DoubleSide });
    const shell = mesh(new T.CylinderGeometry(8.2, 8.2, HEAD - GY0, 32, 1, true, Math.PI / 2, Math.PI), 0, { mat: shellMat, edges: false }); at(shell, 0, (HEAD + GY0) / 2, 0, g);
    for (const s of [-1, 1]) {
      at(box(2, HEAD - GY0, 0.25, 0xd94a3a, { edges: false }), s * 7.15, (HEAD + GY0) / 2, 0.05, g);
      for (let k = 0; k < 5; k++) at(box(2.6, 0.6, 5, 0x56627d, { edges: false }), s * 9.4, GY0 + 2.5 + k * 3.4, -3, g);
    }
    // головка: задняя половина + разрез
    at(box(20, 5, 6.5, 0x56627d), 0, HEAD + 2.5, -3.25, g);
    at(box(20, 5, 0.25, 0xd94a3a, { edges: false }), 0, HEAD + 2.5, 0.05, g);
    // газ в цилиндре
    const gasMat = h.ownMat(0x7fc4ff, { transparent: true, opacity: 0.3, depthWrite: false });
    const gas = new T.Mesh(keep(new T.CylinderGeometry(5.7, 5.7, 1, 36)), gasMat); at(gas, 0, 30, 0, g);
    const burnLight = at(new T.PointLight(0xff9a3c, 0, 50, 1.4), 0, HEAD - 3, 4, g);
    const burnGlow = h.glow(0xffb547, 18, 0); at(burnGlow, 0, HEAD - 4, 1, g);
    // клапаны: тарелка, стержень, пружина, кулачки распредвала
    const valves = [-3.2, 3.2].map((vx, i) => {
      const vg = new T.Group(); at(vg, vx, HEAD, 0.8, g);
      const vh = mesh(new T.CylinderGeometry(0.55, 2.1, 0.9, 24), 0x8b96ad, { hull: true }); at(vh, 0, 0.45, 0, vg);
      at(cyl(0.38, 8.2, C.STEEL, { edges: false }), 0, 4.6, 0, vg);
      at(cyl(1.05, 0.5, 0x8a96b0), 0, 8.3, 0, vg);
      const guide = cyl(0.8, 3.2, C.BRASS, { edges: false }); at(guide, vx, HEAD + 2.6, 0.8, g);
      const pts = []; for (let k = 0; k <= 60; k++) { const a = k / 60 * Math.PI * 2 * 4; pts.push(v3(Math.cos(a) * 1.3, k / 60, Math.sin(a) * 1.3)); }
      const spring = mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 120, 0.18, 6), 0x9aa3b2, { edges: false }); at(spring, vx, HEAD + 5, 0.8, g); spring.scale.y = 3.3;
      const cam = new T.Group(); at(cam, vx, HEAD + 10.1, 0.8, g);
      const base = cyl(1.3, 1.6, 0x8a96b0); base.rotation.z = Math.PI / 2; at(base, 0, 0, 0, cam);
      const lobe = cyl(0.9, 1.6, 0x8a96b0); lobe.rotation.z = Math.PI / 2; at(lobe, 0, 1.85, 0, cam);
      return { vg, vh, spring, cam, peak: i ? 630 : 90 };
    });
    const camShaft = cyl(0.55, 13, C.STEEL, { edges: false }); camShaft.rotation.z = Math.PI / 2; at(camShaft, 0, HEAD + 10.1, 0.8, g);
    for (const s of [-1, 1]) at(box(1.6, 5.6, 1.6, 0x56627d), s * 7, HEAD + 7.8, -0.4, g);
    // свеча зажигания
    const plug = new T.Group(); at(plug, 0, HEAD + 5, -1.6, g); clickable(plug, 'plug');
    at(cyl(1.25, 1.2, C.STEEL, { seg: 6 }), 0, 0.6, 0, plug);
    at(cyl(0.8, 7.6, 0xf4f1e8), 0, 5, 0, plug);
    for (const yy of [6.4, 7.3, 8.2]) at(cyl(0.95, 0.35, 0xf4f1e8, { edges: false }), 0, yy, 0, plug);
    at(cyl(0.45, 1.4, 0x8a96b0), 0, 9.5, 0, plug);
    at(cyl(0.9, 1.6, 0xe0473a), 0, 10.6, 0, plug);
    at(h.hitBox(5, 13, 5), 0, 5, 0, plug);
    at(cyl(0.3, 1.2, C.STEEL, { edges: false }), 0, HEAD - 0.4, -1.6, g);
    const spark = h.glow(0xfff3b0, 9, 0); at(spark, 0, HEAD - 0.9, -1.2, g);
    const sparkLight = at(new T.PointLight(0xfff0b0, 0, 40, 1.4), 0, HEAD - 1, 2, g);
    // впуск (воздушный фильтр) и выпуск (глушитель)
    h.pipe(g, [v3(-10, HEAD + 2.6, -2), v3(-17, HEAD + 2.6, -2)], 1.5, 0x7fa7c9);
    const filt = cyl(3.4, 4.6, 0x4f8fe0); filt.rotation.z = Math.PI / 2; at(filt, -19.6, HEAD + 2.6, -2, g);
    const capF = cyl(3.6, 0.6, 0x2c3240); capF.rotation.z = Math.PI / 2; at(capF, -22.1, HEAD + 2.6, -2, g);
    h.pipe(g, [v3(10, HEAD + 2.6, -2), v3(15, HEAD + 2.6, -2), v3(15, 30, -2), v3(17, 30, -2)], 1.4, 0x8b7a6a);
    const muf = cyl(2.8, 9, 0x6c6258); muf.rotation.z = Math.PI / 2; at(muf, 21.5, 30, -2, g);
    const tail = cyl(0.8, 2.6, 0x6c6258); tail.rotation.z = Math.PI / 2; at(tail, 27, 30, -2, g);
    const smoke = h.steam(g, 28.5, 30, -2, { n: 6, spread: 2.5, size: 3, rise: 10, dir: [1, 0.25, 0], lift: 4, speed: 0.9, op: 0.6, color: 0x9aa3b2, amt: 0 });
    const inFlow = h.steam(g, -24, HEAD + 2.6, -2, { n: 4, spread: 1.5, size: 1.6, rise: 5, dir: [1, 0, 0], speed: 1.2, op: 0.55, color: 0x8fc8ff, amt: 0 });
    // табло тактов на мольберте
    const ea = h.easel(kit.root, 37, 0, 30, 20, 6, 0.35);
    const info = () => d.running ? 'работает сам' : `подряд ${d.streak} из ${d.need}`;
    const board = ea.face(h.canvasPlane(28, 18, 390, 251, (x, W, Hh, a = 0, k = 0) => drawStrokes(x, W, Hh, a, k, d.win, info())));
    // пульт: стартер и искра
    const pn = new T.Group(); at(pn, -6, 0, 20);
    at(box(24, 2.4, 9, C.DARK), 0, 1.2, 0, pn);
    h.button(pn, -5.5, 2.4, 0, d.running ? 'стоп' : 'стартер', d.running ? 0xe0473a : d.starter ? 0x2a8a46 : 0x3fae5a, 'starter', 9, 5);
    h.button(pn, 5.5, 2.4, 0, 'искра', d.running ? 0x5d6a86 : 0xe08a2a, 'spark', 9, 5);
    if (d.starter && !d.running) at(h.glow(0x86e0a8, 10, 0.6), -5.5, 5, 0, pn);
    kit.cable(v3(OX, HEAD + 16.5, OZ - 1.6), v3(OX + 9, 50, OZ - 10.6), 0xe0473a, 0, { r: 0.45, lift: 2, arch: 1 });
    tag(v3(OX + 3, HEAD + 19, OZ - 1.6), 'Свеча', d.running ? 'зажигание' : 'нажать — искра');
    tag(v3(OX - 17, Cy - 2, OZ - 5), 'Маховик', d.running ? 'крутится сам' : 'нажать — +45°');
    tag(v3(OX - 25, HEAD + 4, OZ - 2), 'Впуск', 'смесь');
    tag(v3(OX + 27, 33, OZ - 2), 'Выпуск', 'выхлоп');
    tag(v3(37, 29, 0), 'Такты', d.running ? 'двигатель работает' : `вспышек ${d.streak} из ${d.need}`, d.running);
    h.fin(1.18, 2, 4);
    let lastA = -1, lastK = -1;
    kit.onFrame(() => {
      const Lv = live() || { phi: 0, a: 0, k: 0, inL: 0, exL: 0, gas: 'mix', gcol: 0x7fc4ff, gop: 0.28 };
      const th = Lv.phi * Math.PI / 180, sn = Math.sin(th), cs = Math.cos(th);
      fw.rotation.z = -th; cr.rotation.z = -th;
      const sx = r * sn, sy = Cy + r * cs, pin = Cy + r * cs + Math.sqrt(l * l - r * r * sn * sn);
      rod.position.set(sx / 2, (sy + pin) / 2, 0.1); rod.rotation.z = Math.atan2(sx, pin - sy);
      pis.position.y = pin + 0.25;
      const top = pin + 3.25, hg = Math.max(0.2, HEAD - top);
      gas.scale.y = hg; gas.position.y = top + hg / 2;
      gasMat.color.setHex(Lv.gcol); gasMat.opacity = Lv.gop;
      const burn = Lv.gas === 'burn';
      burnLight.intensity = burn ? 80 * Lv.gop : 0; burnGlow.material.opacity = burn ? 0.8 * Lv.gop : 0;
      [Lv.inL, Lv.exL].forEach((L, i) => {
        const v = valves[i], lift = L * 0.16;
        v.vg.position.y = HEAD - lift;
        v.spring.scale.y = 3.3 - lift;
        v.cam.rotation.x = (Lv.phi - v.peak) / 2 * Math.PI / 180 + Math.PI;
        v.vh.material = toon(L > 1 ? (i ? 0xffb547 : 0x7fc4ff) : 0x8b96ad);
      });
      spark.material.opacity = Lv.flash ? 1 : 0; sparkLight.intensity = Lv.flash ? 70 : 0;
      smoke.set(Lv.exL > 0.5 && (Lv.fired || Lv.running) ? 1 : 0);
      inFlow.set(Lv.inL > 0.5 ? 1 : 0);
      const ar = Math.round(Lv.a);
      if (ar !== lastA || Lv.k !== lastK) { lastA = ar; lastK = Lv.k; board.userData.upd(Lv.a, Lv.k); }
    });
  };

  // =====================================================================================
  // Паровая турбина: котёл на топке, задвижка, сопло, диск с лопатками, генератор, 4 прожектора
  // =====================================================================================
  SC['eng-turb'] = (kit, d) => {
    const { T, at, box, cyl, mesh, clickable, keep, toon, cable, C } = kit, h = H(kit), v3 = h.v3, tag = h.tag;
    const BX = -42, BZ = -8;
    // топка
    const fb = new T.Group(); at(fb, BX, 0, BZ); clickable(fb, 'burner');
    at(box(20, 9, 18, 0x4a3a36), 0, 4.5, 0, fb);
    at(box(12, 5.5, 0.4, 0x1a1210, { edges: false }), 0, 4.2, 9.05, fb);
    at(box(13, 0.8, 1, 0x2c3240), 0, 7.4, 9.3, fb);
    const fire = h.flame(fb, 0, 1.8, 7.2, 5.2, '#ffe9a0', '#ff7a1a', 0xff8a3c, 2.6);
    fire.set(d.burner > 0 ? 0.35 + 0.65 * d.burner / 100 : 0);
    if (d.burner > 0) at(h.glow(0xff7a2a, 16, 0.35 + 0.4 * d.burner / 100), 0, 4.5, 9.6, fb);
    const dial0 = cyl(1.6, 1.2, 0xd9dfe9, { seg: 18 }); dial0.rotation.x = Math.PI / 2; at(dial0, 7.5, 4.5, 9.4, fb);
    // котёл
    const BY = 9, BR = 8, BH = 18;
    at(cyl(BR, BH, 0xb54a3a, { seg: 36 }), BX, BY + BH / 2, BZ);
    for (const yy of [BY + 1, BY + BH - 1]) at(cyl(BR + 0.3, 0.8, 0x8a3a2e, { edges: false }), BX, yy, BZ);
    const dome = mesh(new T.SphereGeometry(BR, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), 0xb54a3a, { hull: true, edges: false }); dome.scale.y = 0.45; at(dome, BX, BY + BH, BZ);
    const topY = BY + BH + BR * 0.45;
    // водомерное стекло
    at(cyl(0.7, 12, 0xd8eef8, { matOpt: { transparent: true, opacity: 0.5 } }), BX + 5.2, BY + 8, BZ + 6.4);
    at(cyl(0.55, 7, 0x4f9fe0, { edges: false, hull: false }), BX + 5.2, BY + 5.5, BZ + 6.4);
    for (const yy of [BY + 2, BY + 14]) at(box(1.6, 1, 1.6, C.BRASS), BX + 5.2, yy, BZ + 6.4);
    // манометр
    const man = h.dial(kit.root, BX - 3.2, BY + 12.5, BZ + BR + 0.7, 4, 'атм', [[0, '0'], [0.5, '8'], [1, '16']], 0, 15 / 16);
    // предохранительный клапан
    at(cyl(0.9, 3, C.BRASS), BX + 4, topY + 0.6, BZ - 2);
    at(cyl(1.5, 1.2, C.BRASS, { seg: 16 }), BX + 4, topY + 2.4, BZ - 2);
    const vent = h.steam(kit.root, BX + 4, topY + 3.2, BZ - 2, { n: 7, spread: 3, size: 4.5, rise: 16, speed: 0.8, op: 0.7, amt: 0 });
    // паропровод: вверх, к зрителю, вправо к соплу
    const PY = 40, PZ = 10.6, TX = -4, TY = 17, TR = 11;
    h.pipe(kit.root, [v3(BX, topY - 1, BZ), v3(BX, PY, BZ), v3(BX, PY, PZ), v3(TX, PY, PZ)], 1.2, 0x8a96b0);
    const steamOn = d.valve > 0;
    // задвижка с маховичком
    const VX = -24, vk = new T.Group(); at(vk, VX, PY, PZ); clickable(vk, 'valve');
    at(box(4.4, 4.4, 4, C.BRASS), 0, 0, 0, vk);
    at(cyl(0.45, 4, C.STEEL, { edges: false }), 0, 4, 0, vk);
    const hw = new T.Group(); at(hw, 0, 6.2, 0, vk); hw.rotation.y = d.valve / 100 * Math.PI * 3;
    const wheel = mesh(new T.TorusGeometry(3, 0.42, 8, 32), 0xe0473a, { edges: false, hull: true }); wheel.rotation.x = Math.PI / 2; at(wheel, 0, 0, 0, hw);
    for (let s = 0; s < 3; s++) { const sp = box(6, 0.5, 0.5, 0xe0473a, { edges: false }); sp.rotation.y = s * Math.PI / 3; at(sp, 0, 0, 0, hw); }
    at(h.hitBox(8, 10, 8), 0, 3, 0, vk);
    // сопло вниз к переднему краю диска
    at(cyl(1.2, 2.5, 0x8a96b0), TX, PY - 1.2, PZ);
    const noz = cyl(0.5, 4.2, 0xa9b4c9, { r2: 1.2 }); at(noz, TX, PY - 4.6, PZ);
    const jetMat = h.ownMat(0xffffff, { transparent: true, opacity: 0, depthWrite: false });
    const jet = new T.Mesh(keep(new T.CylinderGeometry(0.7, 0.35, 1, 12)), jetMat);
    const jetTop = PY - 6.7, jetBot = TY + 1; jet.scale.y = jetTop - jetBot; at(jet, TX, (jetTop + jetBot) / 2, PZ, kit.root);
    const exh = h.steam(kit.root, TX, TY - 2, TR + 1, { n: 6, spread: 4, size: 4, rise: 9, dir: [0, -0.2, 1], lift: 6, speed: 0.6, op: 0.5, amt: 0 });
    // турбина: диск с лопатками на валу вдоль x
    for (const px of [TX - 6, TX + 5]) { at(box(3, TY - 1, 6, C.DARK), px, (TY - 1) / 2, 0); const br = cyl(2, 3.2, C.STEEL); br.rotation.z = Math.PI / 2; at(br, px, TY, 0); }
    at(box(26, 1.4, 12, C.DARK), TX + 12, 0.7, 0);
    const shaft = cyl(0.9, 30, C.STEEL, { edges: false }); shaft.rotation.z = Math.PI / 2; at(shaft, TX + 8, TY, 0);
    const wh = new T.Group(); at(wh, TX, TY, 0); clickable(wh, 'valve');
    const dk = cyl(8.6, 1.6, 0x8a96b0, { seg: 40 }); dk.rotation.z = Math.PI / 2; at(dk, 0, 0, 0, wh);
    const hubm = cyl(2.4, 3, C.STEEL); hubm.rotation.z = Math.PI / 2; at(hubm, 0, 0, 0, wh);
    for (let i = 0; i < 24; i++) {
      const bg = new T.Group(); bg.rotation.x = i * Math.PI * 2 / 24; wh.add(bg);
      const bl = box(2.2, 2.8, 0.6, 0xd8e2ee, { edges: true }); bl.rotation.y = 0.6; at(bl, 0, 9.9, 0, bg);
    }
    at(new T.Mesh(keep(new T.SphereGeometry(0.8, 10, 8)), toon(0xffb547)), 0.9, 6, 0, wh);
    // кожух сверху-сзади (половина кольца)
    const casing = mesh(new T.CylinderGeometry(12.6, 12.6, 4, 36, 1, true, Math.PI / 2, Math.PI), 0, { mat: toon(0x56627d, { side: T.DoubleSide }), edges: false });
    casing.rotation.z = Math.PI / 2; at(casing, TX, TY, 0);
    // генератор
    const GX0 = TX + 13, GL = 13, GR = 6.4;
    const gen = new T.Group(); at(gen, GX0 + GL / 2, TY, 0);
    const gb = cyl(GR, GL, 0x2f6a8a, { seg: 32 }); gb.rotation.z = Math.PI / 2; at(gb, 0, 0, 0, gen);
    for (const fx of [-5.6, 5.6]) { const fn = cyl(GR + 0.4, 0.7, 0x24546e, { edges: false }); fn.rotation.z = Math.PI / 2; at(fn, fx, 0, 0, gen); }
    for (const s of [-1, 1]) { const cap = cyl(GR - 0.6, 0.8, 0x3b4a66); cap.rotation.z = Math.PI / 2; at(cap, s * (GL / 2 + 0.3), 0, 0, gen); }
    for (const s of [-1, 1]) at(box(3, TY - GR + 1, 9, C.DARK), s * 4, -(TY - GR + 1) / 2 - GR + 1, 0, gen);
    const scr = h.screen(9.6, 4.2, '', '#86e0a8', 320, 140); at(scr, 0, 0, GR + 0.1, gen);
    at(box(10.6, 5.2, 0.4, 0x2c3240), 0, 0, GR - 0.12, gen);
    const tA = kit.post(gen, -2.4, -1.5, GR - 0.4), tB = kit.post(gen, 2.4, -1.5, GR - 0.4);
    gen.updateMatrixWorld(true);
    // прожекторы на штанге
    const LX = [34, 41, 48, 55], LY = 25, LZ = -12;
    for (const px of [30.5, 58.5]) { at(box(4, 1.2, 6, C.DARK), px, 0.6, LZ); at(cyl(0.8, LY, C.STEEL, { edges: false }), px, LY / 2, LZ); }
    const bar = cyl(0.8, 29, C.STEEL, { edges: false }); bar.rotation.z = Math.PI / 2; at(bar, 44.5, LY, LZ);
    const nOn = d.lamp.filter(Boolean).length;
    const lamps = LX.map((lx, i) => {
      const on = d.lamp[i], lg = new T.Group(); at(lg, lx, LY, LZ); clickable(lg, 'lamp' + i);
      at(box(1.2, 2.4, 1.2, C.DARK), 0, -1.6, 0, lg);
      const head = new T.Group(); at(head, 0, -4, 0.4, lg); head.rotation.x = 0.35;
      const refl = mesh(new T.CylinderGeometry(3, 1.6, 3.4, 24, 1, true), 0, { mat: toon(0x3b4a66, { side: T.DoubleSide }), edges: false, hull: true }); refl.rotation.x = Math.PI / 2; at(refl, 0, 0, 0, head);
      const back = cyl(1.6, 0.6, 0x2c3240); back.rotation.x = Math.PI / 2; at(back, 0, 0, -1.9, head);
      const bmat = h.ownMat(on ? 0xfff1b8 : 0xdfe8ef, { emissive: 0xffc23a, emissiveIntensity: 0, transparent: true, opacity: 0.9 });
      const bulb = new T.Mesh(keep(new T.SphereGeometry(1.7, 20, 14)), bmat); at(bulb, 0, 0, -0.2, head);
      const halo = h.glow(0xffd27a, 14, 0); at(halo, 0, 0, 1.5, head);
      const light = at(new T.PointLight(0xffc860, 0, 70, 1.2), 0, 0, 4, head);
      at(h.hitBox(5, 9, 6), 0, -3, 0, lg);
      // выключатель под лампой
      const sw = box(1.8, 1, 1.2, on ? 0x3fae5a : 0xe0473a); at(sw, 0, -1.4, 1.2, lg);
      return { on, bmat, halo, light };
    });
    // провода от генератора к штанге
    const busA = v3(30.5, LY - 2, LZ + 1.2), busB = v3(30.5, LY - 4, LZ + 1.2);
    cable(tA.clone().applyMatrix4(gen.matrixWorld), busA, kit.C.WIRE.plus, d.spin && nOn ? nOn : 0, { lift: 6, arch: 1 });
    cable(tB.clone().applyMatrix4(gen.matrixWorld), busB, kit.C.WIRE.minus, d.spin && nOn ? nOn : 0, { lift: 4, arch: 1 });
    tag(v3(BX - 12, 7, BZ + 4), 'Котёл', `огонь ${d.burner} %`, d.burner > 0);
    tag(v3(VX + 9, PY + 3, PZ), 'Задвижка', `${d.valve} %`);
    tag(v3(TX, TY + 14, -2), 'Турбина', 'пар → лопатки');
    tag(v3(GX0 + GL / 2, TY + 9, 0), 'Генератор', d.ok ? '50 Гц держится' : 'нужно 50 Гц', d.ok);
    tag(v3(44.5, LY + 4, LZ), 'Прожекторы', `${nOn} из 4 · по 1 кВт`);
    h.fin(1.02, 4, 12);
    let rot = 0;
    kit.onFrame((dt, t) => {
      const Lv = live() || { p: 1, rpm: 0, vent: false, hold: 0, f: 0, flow: 0 };
      rot += (kit.reduce ? 0 : Lv.rpm / 3000 * 430 * Math.PI / 180 * dt);
      wh.rotation.x = -rot;
      man.set(clamp(Lv.p / 16, 0, 1));
      vent.set(Lv.vent ? 1 : 0);
      const fl = Lv.flow; jetMat.opacity = steamOn && fl > 0.01 ? clamp(0.25 + fl * 0.5, 0.25, 0.75) : 0;
      jet.scale.x = jet.scale.z = 0.6 + clamp(fl, 0, 1.5);
      exh.set(steamOn && fl > 0.01 ? clamp(fl, 0.2, 1) : 0);
      const band = Math.abs(Lv.rpm - 3000) <= 150;
      scr.userData.set(`${fmt(Lv.f, 1)} Гц\n${big(Lv.rpm)} об/мин` + (Lv.hold > 0.05 && !d.ok ? `\nдержим ${fmt(Math.min(Lv.hold, d.hold), 1)} с` : ''), band ? '#86e0a8' : '#ffb547');
      const b = (Lv.rpm / 3000) ** 2;
      lamps.forEach(L => {
        const k = L.on ? Math.min(1.4, b) : 0;
        L.bmat.emissiveIntensity = Math.min(1, k * 0.9); L.halo.material.opacity = k > 0.03 ? Math.min(1, 0.3 + k * 0.5) : 0;
        L.halo.scale.setScalar(10 + 12 * k); L.light.intensity = 50 * k;
      });
    });
  };

  // =====================================================================================
  // КПД: дорога до аула, машинка, двигатель на подставке, колба с топливом на весах, табло энергии
  // =====================================================================================
  function drawEnergy(x, W, H, d) {
    x.fillStyle = '#0e1520'; x.fillRect(0, 0, W, H);
    x.textBaseline = 'middle'; x.textAlign = 'left';
    x.fillStyle = '#e8ecf4'; x.font = `700 26px ${BODY}`; x.fillText('Энергия топлива', 22, 32);
    x.fillStyle = '#86e0a8'; x.font = `700 30px ${MONO}`; x.textAlign = 'right'; x.fillText(`η = ${Math.round(d.eta * 100)} %`, W - 20, 32); x.textAlign = 'left';
    const bw = W - 44, rows = [['Q₁ — сгорело', d.Q1, 1, '#ffb547'], ['A — работа', d.A, d.eta, '#86e0a8'], ['Q₂ — потери', d.Q2, 1 - d.eta, '#ff8a73']];
    rows.forEach(([lab, val, f, col], i) => {
      const y = 78 + i * 62;
      x.fillStyle = '#26324a'; x.fillRect(22, y + 12, bw, 20);
      x.fillStyle = col; x.fillRect(22, y + 12, bw * f, 20);
      x.font = `600 20px ${BODY}`; x.fillStyle = '#a9b4c9'; x.fillText(lab, 22, y - 4);
      x.font = `600 21px ${MONO}`; x.fillStyle = col; x.textAlign = 'right'; x.fillText(val, W - 22, y - 4); x.textAlign = 'left';
    });
  }
  SC['eng-eff'] = (kit, d) => {
    const { T, at, box, cyl, mesh, clickable, keep, toon, C } = kit, h = H(kit), v3 = h.v3, tag = h.tag;
    // дорога вдоль переднего края
    const RZ = 31, X0 = -54, X1 = 54, km = d.km * 1000, sx = s => X0 + (X1 - X0) * s / km;
    at(box(118, 0.5, 9, 0x4a5262), 0, 0.25, RZ);
    for (let x = -56; x < 58; x += 6) at(box(3, 0.08, 0.6, 0xf2f2e8, { edges: false, shadow: false }), x + 1.5, 0.54, RZ);
    for (let s = 0; s <= 2000; s += 500) {
      at(box(0.4, 0.1, 2.2, 0xe8ecf4, { edges: false }), sx(s), 0.56, RZ + 5);
      const lb = h.flat(6, 2, kit.textTex(s ? fmt(s / 1000, 1) + ' км' : '0', '#e8ecf4', '#4a5262', 192, 64)); lb.rotation.x = -Math.PI / 2; at(lb, sx(s), 0.6, RZ + 7.4);
    }
    // аул: юрта и флажок
    const AX = sx(d.D);
    const yurt = new T.Group(); at(yurt, AX + 6, 0, RZ - 13);
    at(cyl(6, 5, 0xf4efe2, { seg: 28 }), 0, 2.5, 0, yurt);
    const roof = cyl(6.4, 3.4, 0xe9e1cc, { r2: 1.4, seg: 28 }); at(roof, 0, 6.7, 0, yurt);
    at(cyl(1.5, 0.6, 0xb54a3a, { seg: 20 }), 0, 8.6, 0, yurt);
    at(box(2.6, 3.6, 0.4, 0xd94a3a), 0, 1.8, 6, yurt);
    at(cyl(6.05, 0.6, 0xb54a3a, { edges: false, hull: false }), 0, 3.6, 0, yurt);
    at(cyl(0.3, 12, C.STEEL, { edges: false }), AX, 6, RZ - 5.5);
    const flagM = box(5, 3, 0.2, 0x3fae5a); at(flagM, AX + 2.6, 10.4, RZ - 5.5);
    // точка, где кончится топливо
    if (d.runs || d.driving || d.arrived) {
      const rx = sx(Math.min(d.range, km));
      at(cyl(0.25, 6, 0xe8ecf4, { edges: false }), rx, 3, RZ - 4.8);
      at(box(3, 2, 0.2, d.col), rx + 1.5, 5, RZ - 4.8);
    }
    // машинка
    const car = new T.Group(); at(car, sx(0), 0, RZ); clickable(car, 'go');
    at(box(11, 3, 5.6, 0xffb547), 0, 2.9, 0, car);
    at(box(6, 2.6, 5.2, 0xffb547), -0.8, 5.6, 0, car);
    at(box(6.1, 1.8, 5.3, 0x2c3a52, { edges: false }), -0.8, 5.7, 0, car);
    at(box(0.4, 1, 1.2, 0xfff1b8), 5.6, 3.4, 1.8, car); at(box(0.4, 1, 1.2, 0xfff1b8), 5.6, 3.4, -1.8, car);
    const wheels = [];
    for (const wx of [-3.4, 3.4]) for (const wz of [-2.9, 2.9]) { const w = new T.Group(); at(w, wx, 1.6, wz, car); const tyre = cyl(1.6, 1.2, 0x23262e); tyre.rotation.x = Math.PI / 2; w.add(tyre); const hub = cyl(0.7, 1.3, C.STEEL, { edges: false }); hub.rotation.x = Math.PI / 2; w.add(hub); const sp = box(2.4, 0.4, 1.32, 0x9aa3b2, { edges: false }); w.add(sp); wheels.push(w); }
    at(h.hitBox(14, 9, 8), 0, 4, 0, car);
    const puff = h.steam(car, -6.5, 2, 0, { n: 5, spread: 1.5, size: 2.6, rise: 7, dir: [-1, 0.2, 0], lift: 3, speed: 0.9, op: 0.55, color: 0x9aa3b2, amt: 0 });
    // двигатель на подставке
    const diesel = d.eng === 'diesel';
    const eg = new T.Group(); at(eg, -32, 0, -14); clickable(eg, 'ecycle'); eg.rotation.y = 0.25; eg.scale.setScalar(1.4);
    at(box(22, 3, 14, C.WOOD2), 0, 1.5, 0, eg);
    const BW = diesel ? 17 : 14, BHt = diesel ? 10 : 8;
    at(box(BW, BHt, 8, diesel ? 0x56627d : 0x8a96b0), 0, 3 + BHt / 2, 0, eg);
    const nCyl = diesel ? 4 : 4;
    for (let i = 0; i < nCyl; i++) { const cx = -BW / 2 + BW / (2 * nCyl) + i * BW / nCyl; at(box(BW / nCyl - 0.8, 2.6, 7, d.col), cx, 3 + BHt + 1.3, 0, eg); at(cyl(0.6, 1.6, diesel ? 0x2c3240 : 0xf4f1e8), cx, 3 + BHt + 3.4, 0, eg); }
    const fly = cyl(4, 1.4, 0x3a4762, { seg: 28 }); fly.rotation.z = Math.PI / 2; at(fly, BW / 2 + 1, 6.5, 0, eg);
    const ep = h.flat(12, 2.6, kit.textTex(diesel ? 'ДИЗЕЛЬ' : 'БЕНЗИН', '#1b1610', '#' + d.col.toString(16).padStart(6, '0'), 384, 84)); at(ep, 0, 3 + BHt / 2, 4.06, eg);
    // весы с мерной колбой
    const sg = new T.Group(); at(sg, -2, 0, -2); sg.rotation.y = 0.1; sg.scale.setScalar(1.3);
    at(box(22, 3.6, 16, 0xe8ecf4), 0, 1.8, 0, sg);
    at(cyl(5.4, 0.6, C.STEEL), 0, 3.9, -2.2, sg);
    const sscr = h.screen(9, 2.8, `${d.mf} г`, '#86e0a8', 300, 92); sscr.rotation.x = -0.25; at(sscr, 0, 2.2, 8.1, sg);
    [['−10', -8.4, 'mf-10', 0xe0473a], ['−1', -4.2, 'mf-1', 0xe0473a], ['+1', 4.2, 'mf+1', 0x3fae5a], ['+10', 8.4, 'mf+10', 0x3fae5a]].forEach(([lb, x, k, c]) => h.button(sg, x, 3.6, 5.4, lb, c, k, 3.6, 3));
    const FR = 3.8, FH = 16, FY = 4.2;
    const fwall = new T.Mesh(keep(new T.CylinderGeometry(FR, FR, FH, 32, 1, true)), h.glassMat(0xd8eef8, 0.24)); at(fwall, 0, FY + FH / 2, -2.2, sg);
    fwall.add(new T.Mesh(fwall.geometry, kit.hullMat));
    for (let k = 1; k <= 8; k++) at(box(k % 2 ? 1 : 1.8, 0.14, 0.1, 0x6f8098, { edges: false, shadow: false }), 0.6, FY + FH * k / 9, -2.2 + FR + 0.05, sg);
    const fmat = h.ownMat(d.col, { transparent: true, opacity: 0.75, depthWrite: false });
    const fuel = new T.Mesh(keep(new T.CylinderGeometry(FR - 0.3, FR - 0.3, 1, 32)), fmat); at(fuel, 0, FY, -2.2, sg);
    const setFuel = g => { const hh = clamp(g / 200, 0, 1) * (FH - 1); fuel.visible = hh > 0.05; fuel.scale.y = Math.max(0.05, hh); fuel.position.y = FY + 0.2 + Math.max(0.05, hh) / 2; };
    setFuel(d.mf);
    // табло энергии
    const ea = h.easel(kit.root, 34, -8, 32, 21, 6, 0.4);
    ea.face(h.canvasPlane(30, 19, 420, 266, (x, W, Hh) => drawEnergy(x, W, Hh, d)));
    tag(v3(-32, 28, -14), 'Двигатель', `${d.name} · η ${Math.round(d.eta * 100)} %`);
    tag(v3(-2, 31, -4), 'Топливо', `${d.mf} г`);
    tag(v3(AX + 6, 14, RZ - 13), 'Аул', `${fmt(d.D / 1000, 0)} км · F = ${d.F} Н`);
    const carTag = v3(sx(0), 9, RZ);
    tag(carTag, 'Машина', d.driving ? 'едет…' : d.arrived ? 'доехала' : 'нажать — поехали');
    h.fin(1, 0, 0);
    let wa = 0, px = sx(0);
    kit.onFrame((dt) => {
      const Lv = live() || { pos: 0, left: d.mf, driving: false };
      const nx = sx(Lv.pos); wa -= (nx - px) / 1.6; px = nx;
      car.position.x = nx; carTag.x = h.wx(nx);
      wheels.forEach(w => { w.rotation.z = wa; });
      setFuel(Lv.left);
      puff.set(Lv.driving ? 1 : 0);
      if (Lv.driving) sscr.userData.set(`${fmt(Math.max(0, Lv.left), 1)} г`, '#ffb547'); else sscr.userData.set(`${d.mf} г`);
    });
  };

  // =====================================================================================
  // Первый закон: цилиндр на треножнике над горелкой, упоры или груз, манометр, табло энергии
  // =====================================================================================
  SC['eng-first'] = (kit, d) => {
    const { T, at, box, cyl, clickable, C } = kit, h = H(kit), v3 = h.v3, tag = h.tag;
    const CX = -14, CZ = -4, K = 0.75;
    const bur = h.burner(kit.root, CX, CZ, { h: 6 }); clickable(bur.g, 'q50');
    const y0 = h.tripod(kit.root, CX, CZ, 15, 8.5);
    const m = mem.first || (mem.first = { hg: d.V * K, q: d.Q, fl: -9 });
    if (d.Q > m.q) m.fl = now(); m.q = d.Q;
    const gc = h.gasCyl(kit.root, CX, y0, CZ, { r: 7, h: 28, n: 24, rod: d.fix ? 5 : 6, hgt: m.hg });
    clickable(gc.g, 'mode');
    gc.setT(d.T, 240, 380);
    // начальный уровень — пунктирная метка
    at(box(2.6, 0.2, 0.2, 0x8b96ad, { edges: false }), CX + 7.6, y0 + 1.4 + d.V0 * K, CZ + 1.8);
    if (d.fix) {
      // латунные упоры над и под поршнем (сквозь стенку)
      const ys = [y0 + 1.4 + d.V0 * K - 0.5, y0 + 1.4 + d.V0 * K + 3.1];
      for (const yy of ys) for (const s of [-1, 1]) { const pinM = cyl(0.5, 4, C.BRASS); pinM.rotation.z = Math.PI / 2; at(pinM, CX + s * 7.6, yy, CZ); at(cyl(0.9, 0.6, C.BRASS), CX + s * 9.6, yy, CZ).rotation.z = Math.PI / 2; }
    } else {
      // груз на площадке штока
      const wt = new T.Group(); at(wt, 0, gc.platY, 0, gc.pg);
      at(cyl(4.2, 4, 0x3a3f4c, { seg: 28 }), 0, 2, 0, wt);
      at(cyl(1.2, 1.6, 0x3a3f4c), 0, 4.8, 0, wt);
      const lb = h.flat(5.6, 1.6, kit.textTex('груз', '#e8ecf4', '#3a3f4c', 192, 56)); at(lb, 0, 2, 4.22, wt);
    }
    // манометр сбоку (трубка от дна)
    h.pipe(kit.root, [v3(CX + 7.6, y0 + 0.8, CZ), v3(CX + 12, y0 + 0.8, CZ), v3(CX + 12, y0 + 8, CZ)], 0.45, C.BRASS);
    const man = h.dial(kit.root, CX + 12, y0 + 12, CZ + 0.6, 3.6, 'кПа', [[0, '0'], [0.5, '100'], [1, '200']], 0.5);
    man.g.rotation.y = 0.3;
    // табло с цифрами
    const ea = h.easel(kit.root, 22, -8, 28, 19, 4, 0.4);
    const scr = ea.face(h.screen(26, 17.6, '', '#e8ecf4', 420, 284));
    const pn = new T.Group(); at(pn, 14, 0, 10); pn.rotation.y = 0.25;
    at(box(26, 2.4, 8, C.DARK), 0, 1.2, 0, pn);
    h.button(pn, -8, 2.4, 0, '+50 Дж', 0xe0473a, 'q50', 7, 4.4);
    h.button(pn, 0, 2.4, 0, '−50 Дж', 0x3a7fd0, 'qm50', 7, 4.4);
    h.button(pn, 8, 2.4, 0, 'заново', 0x5d6a86, 'reset', 7, 4.4);
    tag(v3(CX, y0 + 1.4 + d.V * K + (d.fix ? 12 : 17), CZ), d.fix ? 'Упоры' : 'Груз', d.fix ? 'V = const · нажать' : 'p = const · нажать');
    tag(v3(CX - 11, 3, CZ + 4), 'Горелка', 'нажать — +50 Дж', now() - m.fl < 1.2);
    tag(v3(CX + 12, y0 + 18, CZ), 'Манометр', d.ptxt);
    tag(v3(22, 26, -8), '1 моль гелия', d.Ttxt);
    h.fin(1.4, 4, 6);
    scr.userData.set(`Q  = ${d.Q > 0 ? '+' : ''}${d.Q} Дж\nΔU = ${d.dUtxt}\nA  = ${d.Atxt}\nV = ${d.Vtxt}`);
    kit.onFrame((dt) => {
      const Lv = live() || { V: d.V, T: d.T, p: 100 };
      m.hg = ease(m.hg, Lv.V * K, dt, 5); gc.set(m.hg);
      gc.setT(Lv.T, 240, 380);
      man.set(Lv.p / 200);
      bur.fl.set(now() - m.fl < 1.2 ? 1 : 0);
    });
  };

  // =====================================================================================
  // Работа газа: цилиндр с грузами (1 груз = 50 кПа), горелка и лёд, упоры, график p(V)
  // =====================================================================================
  function drawPV(x, W, H, d) {
    x.fillStyle = '#0e1520'; x.fillRect(0, 0, W, H);
    const X = V => 56 + V * 9.2, Y = p => H - 40 - p * 0.58;
    x.lineWidth = 1;
    for (let V = 0; V <= 40; V += 5) { x.strokeStyle = V % 10 ? '#1c2638' : '#26324a'; x.beginPath(); x.moveTo(X(V), Y(0)); x.lineTo(X(V), Y(400)); x.stroke(); }
    for (let p = 0; p <= 400; p += 50) { x.strokeStyle = p % 100 ? '#1c2638' : '#26324a'; x.beginPath(); x.moveTo(X(0), Y(p)); x.lineTo(X(40), Y(p)); x.stroke(); }
    x.fillStyle = '#8b96ad'; x.font = `500 15px ${MONO}`; x.textAlign = 'center';
    for (let V = 0; V <= 40; V += 10) x.fillText(String(V), X(V), Y(0) + 18);
    x.textAlign = 'right'; for (let p = 0; p <= 400; p += 100) x.fillText(String(p), X(0) - 6, Y(p) + 5);
    x.strokeStyle = '#a9b4c9'; x.lineWidth = 2; x.beginPath(); x.moveTo(X(0), Y(400)); x.lineTo(X(0), Y(0)); x.lineTo(X(40), Y(0)); x.stroke();
    x.fillStyle = '#e8ecf4'; x.font = `600 16px ${BODY}`; x.textAlign = 'left'; x.fillText('p, кПа', X(0) + 6, Y(400) + 12); x.textAlign = 'right'; x.fillText('V, л', X(40), Y(0) - 8);
    x.setLineDash([5, 5]); x.strokeStyle = '#8b96ad'; x.lineWidth = 1.2; x.beginPath();
    for (let V = 7.5; V <= 40.001; V += 0.5) { const yy = Y(3000 / V); V === 7.5 ? x.moveTo(X(V), yy) : x.lineTo(X(V), yy); } x.stroke(); x.setLineDash([]);
    const P = d.path;
    for (let i = 1; i < P.length; i++) {
      const [Va, pa] = P[i - 1], [Vb, pb] = P[i]; if (Va === Vb) continue;
      x.globalAlpha = 0.28; x.fillStyle = Vb > Va ? '#86e0a8' : '#ff8a73';
      x.beginPath(); x.moveTo(X(Va), Y(pa)); x.lineTo(X(Vb), Y(pb)); x.lineTo(X(Vb), Y(0)); x.lineTo(X(Va), Y(0)); x.closePath(); x.fill(); x.globalAlpha = 1;
    }
    if (P.length > 1) { x.strokeStyle = '#ffb547'; x.lineWidth = 3.5; x.lineJoin = 'round'; x.beginPath(); P.forEach(([V, p], i) => i ? x.lineTo(X(V), Y(p)) : x.moveTo(X(V), Y(p))); x.stroke(); }
    for (const [pt, lb] of [[[10, 300], '1'], [[30, 100], '2']]) { x.strokeStyle = '#ffb547'; x.lineWidth = 2.5; x.beginPath(); x.arc(X(pt[0]), Y(pt[1]), 7, 0, 7); x.stroke(); x.fillStyle = '#ffb547'; x.font = `700 20px ${MONO}`; x.textAlign = 'left'; x.fillText(lb, X(pt[0]) + 9, Y(pt[1]) - 9); }
    x.fillStyle = '#e8ecf4'; x.strokeStyle = '#04070d'; x.lineWidth = 2; x.beginPath(); x.arc(X(d.V), Y(d.p), 8, 0, 7); x.fill(); x.stroke();
    x.textAlign = 'right'; x.font = `700 22px ${MONO}`; x.fillStyle = d.A >= 0 ? '#86e0a8' : '#ff8a73'; x.fillText(`A = ${d.Atxt}`, W - 16, 26);
  }
  SC['eng-work'] = (kit, d) => {
    const { T, at, box, cyl, mesh, clickable, keep, C } = kit, h = H(kit), v3 = h.v3, tag = h.tag;
    const CX = -22, CZ = -2, K = 0.62;
    const bur = h.burner(kit.root, CX, CZ, { h: 6 }); clickable(bur.g, 'w-heat');
    const y0 = h.tripod(kit.root, CX, CZ, 15, 8.5);
    const m = mem.work || (mem.work = { hg: d.V * K, V: d.V, p: d.p, heat: -9, cool: -9 });
    if (d.V > m.V || d.p > m.p) m.heat = now();
    if (d.V < m.V || d.p < m.p) m.cool = now();
    m.V = d.V; m.p = d.p;
    const gc = h.gasCyl(kit.root, CX, y0, CZ, { r: 7, h: 27, n: 22, rod: 3, hgt: m.hg });
    clickable(gc.g, 'w-lock');
    gc.setT(d.T, 150, 600);
    // грузы: по 50 кПа
    const nW = Math.max(0, Math.round(d.p / 50));
    for (let i = 0; i < nW; i++) {
      const wd = cyl(4.6 - i * 0.12, 1.3, i % 2 ? 0x4a505e : 0x3a3f4c, { seg: 28 }); at(wd, 0, gc.platY + 0.65 + i * 1.36, 0, gc.pg);
    }
    const lbW = h.flat(6, 1.5, kit.textTex(`${nW} × 50 кПа`, '#e8ecf4', '#3a3f4c', 220, 56)); at(lbW, 0, gc.platY + 0.7, 4.62, gc.pg);
    // упоры: держат поршень там, где он стоит
    // упоры: латунные штифты над и под поршнем; сняты — лежат на столе
    const stops = new T.Group(); at(stops, CX, 0, CZ); clickable(stops, 'w-lock');
    const pinPair = (parent, y) => { for (const s of [-1, 1]) { const pinM = cyl(0.55, 4.4, C.BRASS); pinM.rotation.z = Math.PI / 2; at(pinM, s * 7.6, y, 0, parent); const hd = cyl(1, 0.7, C.BRASS); hd.rotation.z = Math.PI / 2; at(hd, s * 9.8, y, 0, parent); } };
    if (d.lock) { pinPair(stops, 0); pinPair(stops, -3.9); at(h.hitBox(22, 6, 6), 0, -2, 0, stops); }
    else {
      const tr = new T.Group(); at(tr, CX - 4, 0, CZ + 13); clickable(tr, 'w-lock');
      at(box(9, 0.8, 5, C.WOOD2), 0, 0.4, 0, tr);
      for (let i = 0; i < 4; i++) { const pinM = cyl(0.55, 4.4, C.BRASS); pinM.rotation.z = Math.PI / 2; at(pinM, 0, 1.35, -1.6 + i * 1.1, tr); }
    }
    // лёд в ванночке справа от цилиндра
    const ice = new T.Group(); at(ice, CX + 20, 0, CZ + 10); clickable(ice, 'w-cool');
    const tray = mesh(new T.CylinderGeometry(6, 5.2, 3, 28, 1, true), 0, { mat: kit.toon(0x7fa7c9, { side: T.DoubleSide }), edges: false, hull: true }); at(tray, 0, 1.5, 0, ice);
    at(cyl(5.2, 0.4, 0x7fa7c9, { edges: false }), 0, 0.2, 0, ice);
    for (let i = 0; i < 7; i++) { const cube = box(2, 2, 2, 0xdff4ff, { matOpt: { transparent: true, opacity: 0.85 } }); cube.rotation.set(rnd(i) * 2, rnd(i + 3) * 2, 0); at(cube, Math.cos(i * 0.9) * (i ? 3 : 0), 2.4 + (i % 2) * 0.6, Math.sin(i * 0.9) * (i ? 3 : 0), ice); }
    const coldGlow = h.glow(0x8fd0ff, 22, 0); at(coldGlow, -10, 18, -10, ice);
    // график p(V)
    const ea = h.easel(kit.root, 18, -8, 36, 26, 4, 0.4);
    ea.face(h.canvasPlane(34, 24.6, 440, 320, (x, W, Hh) => drawPV(x, W, Hh, d)));
    clickable(ea.g, 'home');
    tag(v3(CX, y0 + 1.4 + d.V * K + 6 + nW * 1.36 + 3, CZ), 'Грузы', `p = ${d.p} кПа`);
    tag(v3(CX - 10, y0 + 6, CZ), d.lock ? 'Упоры' : 'Цилиндр', d.lock ? 'V = const' : `V = ${d.V} л`);
    tag(v3(CX, 9, CZ + 6), 'Горелка', 'нагреть', now() - m.heat < 1.2);
    tag(v3(CX + 20, 7, CZ + 10), 'Лёд', 'охладить');
    tag(v3(18, 33, -8), 'График p(V)', d.at2 ? 'газ в точке 2' : 'нажать — в точку 1', d.ok);
    h.fin(1.3, 4, 6);
    kit.onFrame((dt) => {
      const Lv = live() || { V: d.V, T: d.T };
      m.hg = ease(m.hg, Lv.V * K, dt, 5); gc.set(m.hg);
      gc.setT(Lv.T, 150, 600);
      stops.position.y = y0 + 1.4 + m.hg + 3.2;
      bur.fl.set(now() - m.heat < 1.2 ? 1 : 0);
      coldGlow.material.opacity = now() - m.cool < 1.2 ? 0.5 : 0;
    });
  };

  // =====================================================================================
  // Второй закон: два медных бруска на пенопласте, термометры, тепловой насос со шлангами
  // =====================================================================================
  SC['eng-second'] = (kit, d) => {
    const { T, at, box, cyl, mesh, clickable, keep, toon, C } = kit, h = H(kit), v3 = h.v3, tag = h.tag;
    const bx = cx => 6 + (cx - d.touch) * 0.18;
    const m = mem.second || (mem.second = { x: bx(d.cx) });
    const HX = -14, BW = 20, BHh = 14, BD = 14, BZ = 4, PAD = 2;
    const cu = new T.Color(0xc98a5a), cold = new T.Color(0x6f9fd8), hotc = new T.Color(0xff5a22);
    const hcol = Tk => { const f = clamp((Tk - 293) / 60, 0, 1); return f < 0.25 ? cu.clone().lerp(cold, (0.25 - f) * 1.6) : cu.clone().lerp(hotc, (f - 0.25) * 0.75); };
    const block = (x, key) => {
      const g = new T.Group(); at(g, x, 0, BZ); if (key) clickable(g, key);
      at(box(BW + 1, PAD, BD + 2, 0xf4f1e8), 0, PAD / 2, 0, g);
      const mat = h.ownMat(0xc98a5a);
      const b = box(BW, BHh, BD, 0, { mat }); at(b, 0, PAD + BHh / 2, 0, g);
      const hot = h.glow(0xff7a2a, 30, 0); at(hot, 0, PAD + BHh / 2, BD / 2 + 0.6, g);
      const scr = h.screen(9, 2.8, '', '#e8ecf4', 300, 92); at(scr, 0, PAD + BHh / 2, BD / 2 + 0.06, g);
      const th = h.thermo(g, BW / 2 - 3.4, PAD + BHh - 2, -BD / 2 + 3, 16, -10, 100, 20);
      // теплообменник шланга сверху
      at(box(8, 0.8, 6, 0x9aa3b2), -2, PAD + BHh + 0.4, 0, g);
      return { g, mat, scr, th, hot };
    };
    const L = block(HX, null), R = block(m.x, 'contact');
    // насос
    const pg = new T.Group(); at(pg, -45, 0, -8); pg.rotation.y = 0.6; clickable(pg, 'pump');
    at(box(22, 13, 10, d.pump ? 0x2c6a4a : 0x3b4a66), 0, 6.5, 0, pg);
    const grill = cyl(4, 0.6, 0x2c3240, { seg: 24 }); grill.rotation.x = Math.PI / 2; at(grill, -5, 7, 5.1, pg);
    const fan = new T.Group(); at(fan, -5, 7, 5.5, pg);
    for (let k = 0; k < 3; k++) { const bl = box(0.9, 3.4, 0.2, 0xa9b4c9, { edges: false }); bl.rotation.z = k * 2.094; bl.position.set(Math.sin(k * 2.094) * -1.6, Math.cos(k * 2.094) * 1.6, 0); fan.add(bl); }
    const pscr = h.screen(10, 5.2, '', '#86e0a8', 300, 156); at(pscr, 5, 7, 5.06, pg);
    at(new T.Mesh(keep(new T.SphereGeometry(0.8, 12, 8)), new T.MeshBasicMaterial({ color: d.pump ? 0x3fe07a : 0x5a2a2a })), -9.5, 11.5, 5.1, pg);
    const plab = h.flat(14, 1.8, kit.textTex('тепловой насос', '#e8ecf4', '#2c3240', 420, 54)); at(plab, 0, 12, 5.06, pg);
    // сетевой удлинитель на столе
    at(box(12, 2, 4.5, 0xf4f1e8), -50, 1, -29);
    for (let k = 0; k < 3; k++) at(cyl(1.1, 0.3, 0xd9dfe9, { edges: false }), -53.5 + k * 3.5, 2.15, -29);
    at(box(2.4, 2.4, 2, 0x2c3240), -50, 3.3, -27.4);
    pg.updateMatrixWorld(true);
    const PW = (x, y, z) => v3(x, y, z).applyMatrix4(pg.matrixWorld);
    kit.cable(v3(-50, 4.4, -27), PW(-11, 3, -2), 0x2c3240, d.pump ? 1 : 0, { lift: 3, arch: 1, r: 0.5 });
    // шланги: горячий к левому, холодный к правому (правый перестраиваем, когда брусок едет)
    const hy = PAD + BHh + 0.9;
    kit.cable(PW(11, 9, 0), v3(HX - 2, hy, BZ), 0xd94a3a, d.pump ? 2 : 0, { lift: 6, r: 0.9 });
    const tubeMat = toon(0x3a7fd0);
    let tube = null, tubeX = null;
    const mkTube = x => {
      if (tube) { tube.parent && tube.parent.remove(tube); tube.geometry.dispose(); }
      const a = PW(11, 5, 0), b = v3(x - 2, hy, BZ);
      const mid = a.clone().lerp(b, 0.5); mid.y = Math.max(a.y, b.y) + 6;
      tube = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([a, v3(a.x, a.y + 3, a.z + 3), mid, v3(b.x, b.y + 3, b.z - 2), b]), 40, 0.9, 8), tubeMat);
      tube.castShadow = true; h.layer().add(tube); tubeX = x;
    };
    mkTube(m.x);
    kit.keep({ dispose() { if (tube) tube.geometry.dispose(); } });
    const flow = h.glow(0xffb547, 14, 0); at(flow, HX + BW / 2 + 0.5, PAD + BHh / 2, BZ + BD / 2 + 0.8);
    tag(v3(HX + 1, 31, BZ), 'Левый брусок', 'медь · 2000 Дж/К');
    const rTag = v3(m.x + 7, 26, BZ);
    tag(rTag, 'Правый брусок', d.contact ? 'нажать — развести' : 'нажать — свести');
    tag(v3(-50, 12, -8), 'Насос', d.pump ? 'работает' : 'нажать — включить', d.pump);
    h.fin(1.15, 2, 8);
    kit.onFrame((dt, t) => {
      const Lv = live() || { Th: 353, Tc: 293, cx: d.cx, pump: false, W: 0, Qp: 0, contact: false };
      m.x = ease(m.x, bx(Lv.cx), dt, 7);
      R.g.position.x = m.x; rTag.x = h.wx(m.x + 7);
      if (Math.abs(m.x - tubeX) > 0.15) mkTube(m.x);
      L.mat.color.copy(hcol(Lv.Th)); R.mat.color.copy(hcol(Lv.Tc));
      L.th.set(Lv.Th - 273.15); R.th.set(Lv.Tc - 273.15);
      L.scr.userData.set(fmt(Lv.Th - 273.15, 1) + ' °C'); R.scr.userData.set(fmt(Lv.Tc - 273.15, 1) + ' °C');
      L.hot.material.opacity = clamp((Lv.Th - 320) / 60, 0, 0.5); R.hot.material.opacity = clamp((Lv.Tc - 320) / 60, 0, 0.5);
      const touching = Lv.contact && Math.abs(m.x - bx(d.touch)) < 0.6 && Math.abs(Lv.Th - Lv.Tc) > 0.3;
      flow.material.opacity = touching ? 0.45 + (kit.reduce ? 0 : 0.25 * Math.sin(t * 6)) : 0;
      if (Lv.pump && !kit.reduce) fan.rotation.z -= dt * 14;
      pscr.userData.set(`работа ${fmt(Lv.W / 1000, 2)} кДж\nвзял ${fmt(Lv.Qp / 1000, 2)} кДж`, Lv.pump ? '#86e0a8' : '#a9b4c9');
    });
  };

  // =====================================================================================
  // Цикл Карно: нагреватель, теплоизолирующая подставка, холодильник; цилиндр переезжает по этапам; табло p–V
  // =====================================================================================
  const R8 = 8.31;
  function carnotGeo(T1, T2) {
    const r = Math.pow(T1 / T2, 1.5), V1 = 10, V2 = 20, V3 = V2 * r, V4 = V1 * r;
    return { V1, V2, V3, V4, p1: R8 * T1 / V1, p2: R8 * T1 / V2, p3: R8 * T2 / V3, p4: R8 * T2 / V4 };
  }
  function stagePt(g, T1, T2, k, f) {
    let V, Tt;
    if (k >= 4) { k = 0; f = 0; }
    if (k === 0) { V = g.V1 * Math.pow(g.V2 / g.V1, f); Tt = T1; }
    else if (k === 1) { V = g.V2 * Math.pow(g.V3 / g.V2, f); Tt = T1 * Math.pow(g.V2 / V, 2 / 3); }
    else if (k === 2) { V = g.V3 * Math.pow(g.V4 / g.V3, f); Tt = T2; }
    else { V = g.V4 * Math.pow(g.V1 / g.V4, f); Tt = T2 * Math.pow(g.V4 / V, 2 / 3); }
    return { V, T: Tt, p: R8 * Tt / V };
  }
  const CCOL = ['#ff8a73', '#a9b4c9', '#72d4e8', '#a9b4c9'];
  const CNAME = ['1→2 изотерма T₁', '2→3 адиабата', '3→4 изотерма T₂', '4→1 адиабата'];
  function drawCarnot(x, W, H, d, g, cur, k) {
    x.fillStyle = '#0e1520'; x.fillRect(0, 0, W, H);
    const Vmax = g.V3 * 1.1, pmax = g.p1 * 1.12, X = V => 46 + V / Vmax * (W - 70), Y = p => H - 34 - p / pmax * (H - 92);
    x.strokeStyle = '#a9b4c9'; x.lineWidth = 2; x.beginPath(); x.moveTo(X(0), Y(pmax)); x.lineTo(X(0), Y(0)); x.lineTo(X(Vmax), Y(0)); x.stroke();
    x.fillStyle = '#e8ecf4'; x.font = `600 17px ${BODY}`; x.textAlign = 'left'; x.fillText('p', X(0) + 6, Y(pmax) + 14); x.textAlign = 'right'; x.fillText('V', X(Vmax), Y(0) - 8);
    const pts = [];
    for (let s = 0; s < 4; s++) { for (let i = 0; i <= 40; i++) { const q = stagePt(g, d.T1, d.T2, s, i / 40); pts.push([X(q.V), Y(q.p)]); } }
    x.globalAlpha = 0.18; x.fillStyle = '#ffb547'; x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); x.fill(); x.globalAlpha = 1;
    for (let s = 0; s < 4; s++) {
      x.strokeStyle = CCOL[s]; x.lineWidth = s === k ? 5 : 2.5; x.beginPath();
      for (let i = 0; i <= 40; i++) { const [a, b] = pts[s * 41 + i]; i ? x.lineTo(a, b) : x.moveTo(a, b); } x.stroke();
    }
    [[g.V1, g.p1], [g.V2, g.p2], [g.V3, g.p3], [g.V4, g.p4]].forEach(([V, p], i) => { x.fillStyle = '#e8ecf4'; x.beginPath(); x.arc(X(V), Y(p), 4, 0, 7); x.fill(); x.font = `700 17px ${MONO}`; x.textAlign = 'left'; x.fillText(String(i + 1), X(V) + (i === 0 ? -16 : 7), Y(p) + (i === 2 ? 18 : -7)); });
    x.fillStyle = '#ffb547'; x.strokeStyle = '#04070d'; x.lineWidth = 2; x.beginPath(); x.arc(X(cur.V), Y(cur.p), 8, 0, 7); x.fill(); x.stroke();
    x.textAlign = 'right'; x.font = `700 22px ${MONO}`; x.fillStyle = '#86e0a8'; x.fillText(`η = ${fmt(d.eta, 1)} %`, W - 14, 28);
    x.font = `600 16px ${BODY}`; x.fillStyle = k >= 0 ? CCOL[k] : '#8b96ad'; x.fillText(k >= 0 ? CNAME[k] : `A = ${d.A} Дж за цикл`, W - 14, 54);
  }
  SC['eng-carnot'] = (kit, d) => {
    const { T, at, box, cyl, mesh, clickable, keep, toon, C } = kit, h = H(kit), v3 = h.v3, tag = h.tag;
    const g = carnotGeo(d.T1, d.T2), Vmax = g.V3 * 1.1;
    const ST = [-40, -18, 4], SZ = 2, TOP = 6;
    // нагреватель
    const heat = new T.Group(); at(heat, ST[0], 0, SZ);
    at(box(17, TOP - 1, 15, 0x3b4a66), 0, (TOP - 1) / 2, 0, heat);
    at(box(15, 1, 13, 0xd94a3a, { matOpt: { emissive: 0xff4a1a, emissiveIntensity: clamp((d.T1 - 300) / 900, 0.15, 0.8) } }), 0, TOP - 0.5, 0, heat);
    at(h.glow(0xff6a2a, 26, 0.5), 0, TOP + 1, 0, heat);
    const hs = h.screen(8, 2.6, `T₁ = ${d.T1} K`, '#ffb547', 300, 96); at(hs, 0, 2.6, 7.56, heat);
    h.button(heat, -5.4, 0, 9.6, '−50', 0x5d6a86, 't1m', 3.6, 2.6); h.button(heat, 5.4, 0, 9.6, '+50', 0xe0473a, 't1p', 3.6, 2.6);
    // теплоизоляция
    const ins = new T.Group(); at(ins, ST[1], 0, SZ);
    at(box(15, TOP, 13, 0xe9d8a6), 0, TOP / 2, 0, ins);
    for (let k = 0; k < 3; k++) at(box(15.2, 0.3, 13.2, 0xd2bd84, { edges: false }), 0, 1.5 + k * 1.6, 0, ins);
    // холодильник
    const cool = new T.Group(); at(cool, ST[2], 0, SZ);
    at(box(17, TOP - 1, 15, 0x3b4a66), 0, (TOP - 1) / 2, 0, cool);
    at(box(15, 1, 13, 0x8fd0ff, { matOpt: { emissive: 0x3a8cff, emissiveIntensity: 0.25 } }), 0, TOP - 0.5, 0, cool);
    at(h.glow(0x9fd8ff, 22, 0.35), 0, TOP + 1, 0, cool);
    const cs = h.screen(8, 2.6, `T₂ = ${d.T2} K`, '#8fd0ff', 300, 96); at(cs, 0, 2.6, 7.56, cool);
    h.button(cool, -5.4, 0, 9.6, '−10', 0x3a7fd0, 't2m', 3.6, 2.6); h.button(cool, 5.4, 0, 9.6, '+10', 0x5d6a86, 't2p', 3.6, 2.6);
    // цилиндр на подвижной подставке
    const car = new T.Group(); at(car, ST[1], TOP, SZ); clickable(car, 'run');
    const gc = h.gasCyl(car, 0, 0, 0, { r: 5.4, h: 25, n: 20, rod: 3 });
    at(h.hitBox(14, 34, 14), 0, 15, 0, car);
    const wt = cyl(3, 2.4, 0x3a3f4c, { seg: 24 }); at(wt, 0, gc.platY + 1.2, 0, gc.pg);
    const qUp = h.glow(0xffb547, 14, 0), qDn = h.glow(0x8fd0ff, 14, 0); at(qUp, 0, 3, 0, car); at(qDn, 0, 3, 0, car);
    // табло p–V
    const ea = h.easel(kit.root, 34, -8, 32, 24, 5, 0.4);
    const board = ea.face(h.canvasPlane(30, 22.6, 420, 316, (x, W, Hh, cur = stagePt(g, d.T1, d.T2, 0, 0), k = -1) => drawCarnot(x, W, Hh, d, g, cur, k)));
    tag(v3(ST[0] - 12, 0, SZ + 6), 'Нагреватель', `T₁ = ${d.T1} K`, true);
    tag(v3(ST[2] + 4, 4, SZ + 12), 'Холодильник', `T₂ = ${d.T2} K`);
    tag(v3(ST[1] - 2, 3, SZ + 10), 'Теплоизоляция');
    const cTag = v3(ST[1] + 8, 30, SZ);
    tag(cTag, 'Цилиндр', d.run ? 'цикл идёт' : 'нажать — цикл', d.run);
    tag(v3(34, 34, -8), 'Табло p–V', `η = ${fmt(d.eta, 1)} %`, d.ok);
    h.fin(1.15, 4, 10);
    const station = k => (k === 0 ? ST[0] : k === 2 ? ST[2] : ST[1]);
    let lastKey = '';
    kit.onFrame((dt) => {
      const Lv = live() || { ph: 0, run: false, k: -1, V: 10, T: d.T1, p: g.p1 };
      const run = Lv.run, k = run ? Math.min(3, Math.floor(Lv.ph)) : -1, f = run ? Lv.ph - Math.floor(Lv.ph) : 0;
      let xPos = ST[1], lift = 0;
      if (run) {
        const prev = k === 0 ? ST[1] : station(k - 1), to = station(k), s = clamp(f / 0.18, 0, 1), sm = s * s * (3 - 2 * s);
        xPos = prev + (to - prev) * sm; lift = prev !== to ? Math.sin(Math.PI * s) * 2.5 : 0;
      }
      car.position.set(xPos, TOP + lift, SZ); cTag.x = h.wx(xPos + 8);
      gc.set(3 + 19.5 * (Lv.V / Vmax)); gc.setT(Lv.T, Math.min(250, d.T2), Math.max(700, d.T1));
      const onSt = run && f > 0.18;
      qUp.material.opacity = onSt && k === 0 ? 0.7 : 0; qDn.material.opacity = onSt && k === 2 ? 0.7 : 0;
      const key = (run ? Lv.ph.toFixed(3) : 'idle') + k;
      if (key !== lastKey) { lastKey = key; board.userData.upd(run ? { V: Lv.V, p: Lv.p } : stagePt(g, d.T1, d.T2, 0, 0), k); }
    });
  };

  // =====================================================================================
  // Тепловые машины и экология: электростанция с трубой и градирней, ветряк, машина, грузовик, дом с тепловым насосом,
  // табло «куда уходит энергия». Нажатие на модель выбирает вариант (в опыте — LUCH_REAL.click).
  // =====================================================================================
  function drawEco(x, W, H, d) {
    x.fillStyle = '#0e1520'; x.fillRect(0, 0, W, H);
    x.textBaseline = 'middle'; x.textAlign = 'left';
    x.fillStyle = '#e8ecf4'; x.font = `700 24px ${BODY}`; x.fillText(d.name, 20, 30);
    if (d.gridName && (d.mode === 'ev' || d.mode === 'pump')) { x.fillStyle = '#8b96ad'; x.font = `500 17px ${BODY}`; x.fillText('сеть: ' + d.gridName, 20, 58); }
    const bw = W - 40;
    const bar = (y, lab, val, f, col) => {
      x.fillStyle = '#26324a'; x.fillRect(20, y + 12, bw, 18);
      x.fillStyle = col; x.fillRect(20, y + 12, bw * clamp(f, 0, 1), 18);
      x.font = `600 18px ${BODY}`; x.fillStyle = '#a9b4c9'; x.textAlign = 'left'; x.fillText(lab, 20, y - 3);
      x.font = `600 19px ${MONO}`; x.fillStyle = col; x.textAlign = 'right'; x.fillText(val, W - 20, y - 3); x.textAlign = 'left';
    };
    if (d.mode === 'pump') {
      x.fillStyle = '#86e0a8'; x.font = `700 22px ${MONO}`; x.textAlign = 'right'; x.fillText(`×${d.cop} · предел ×${fmt(d.copMax, 1)}`, W - 20, 58); x.textAlign = 'left';
      bar(94, 'электричество', '100', 1 / 3, '#ffd36b');
      bar(146, 'тепло с улицы', '200', 2 / 3, '#4f8fe0');
      bar(198, 'в дом', '300 кВт·ч', 1, '#ff8a73');
      x.fillStyle = '#8b96ad'; x.font = `500 16px ${BODY}`; x.fillText(d.plantLoss > 10 ? `на станции впустую ≈ ${d.plantLoss} кВт·ч` : 'на станции почти без потерь', 20, 248);
    } else {
      x.fillStyle = '#86e0a8'; x.font = `700 24px ${MONO}`; x.textAlign = 'right'; x.fillText(`η = ${d.eta} %`, W - 20, 58);
      x.font = `600 16px ${BODY}`; x.fillStyle = '#ff8a73'; x.textAlign = 'left'; x.fillText(d.carnot != null ? `предел Карно ${d.carnot} %` : d.hidden ? 'предел Карно: ?' : 'предела Карно нет', 20, d.gridName && d.mode === 'ev' ? 80 : 58);
      bar(102, 'на входе', '100 кВт·ч', 1, '#ffb547');
      bar(152, d.out, String(d.use), d.use / 100, '#86e0a8');
      bar(202, 'тепло впустую', String(d.waste), d.waste / 100, '#ff6a4a');
      if (d.carnot != null) { const cx = 20 + bw * d.carnot / 100; x.strokeStyle = '#ff8a73'; x.setLineDash([6, 5]); x.lineWidth = 3; x.beginPath(); x.moveTo(cx, 158); x.lineTo(cx, 190); x.stroke(); x.setLineDash([]); }
    }
    x.fillStyle = '#c8d1e2'; x.font = `600 18px ${BODY}`; x.textAlign = 'left'; x.fillText(d.co2txt + ' пользы', 20, H - 20);
  }
  SC['eng-eco'] = (kit, d) => {
    const { T, at, box, cyl, clickable, C } = kit, h = H(kit), v3 = h.v3, tag = h.tag;
    const sel = id => d.pick === id;
    const glowSel = (parent, on, y = 0.3, size = 22) => { if (on) at(h.glow(0xffb547, size, 0.45), 0, y, 0, parent); };
    const plantSel = d.group === 'power', fuelGrid = d.mode === 'ev' || d.mode === 'pump', gridFuel = fuelGrid && d.grid !== 'wind';
    // ---- электростанция: корпус, труба, градирня (у простой газовой турбины градирни нет)
    const P = new T.Group(); at(P, -36, 0, -16); clickable(P, 'plant');
    at(box(26, 1, 20, 0x56627d), 0, 0.5, 0, P);
    at(box(14, 10, 10, 0x8a96b0), -4, 6, 2, P);
    at(box(14.4, 1.2, 10.4, 0x3b4a66), -4, 11.4, 2, P);
    const pk = plantSel ? d.pick : gridFuel && d.grid === 'gas' ? 'ccgt' : 'coal';
    const chimH = pk === 'coal' ? 26 : 18;
    at(cyl(1.6, chimH, 0xd9dfe9, { r2: 1.2 }), 4, chimH / 2 + 1, -5, P);
    for (let k = 1; k <= 2; k++) at(cyl(1.62 - k * 0.12, 1, 0xe0473a, { edges: false }), 4, chimH * (0.55 + k * 0.18), -5, P);
    if (pk !== 'gt') at(cyl(6.2, 14, 0xc8d1e2, { r2: 4.4, seg: 32 }), -7, 8, -5, P);
    if (pk !== 'coal') { const tb = cyl(2.6, 9, 0x3fae5a); tb.rotation.z = Math.PI / 2; at(tb, 6, 3.6, 5, P); }
    else for (let i = 0; i < 4; i++) at(box(2.2, 1.6, 2.2, 0x23262e), 8 + (i % 2) * 2.4, 1.8 + Math.floor(i / 2) * 1.6, 6, P);
    at(h.hitBox(28, 30, 22), 0, 14, 0, P);
    glowSel(P, plantSel || gridFuel, 0.6, 34);
    h.steam(P, 4, chimH + 1, -5, { n: 7, spread: 2.5, size: 3.2, rise: 14, speed: 0.3, op: 0.5, color: 0x8b96ad, amt: plantSel || gridFuel ? clamp(d.co2, 0.25, 1) : 0.15 });
    if (pk !== 'gt') h.steam(P, -7, 15, -5, { n: 8, spread: 5, size: 5, rise: 12, speed: 0.25, op: 0.55, color: 0xffffff, amt: plantSel ? clamp(d.wastePer / 1.8, 0.3, 1) : 0.35 });
    else h.steam(P, 4, chimH + 1, -5, { n: 5, spread: 2, size: 4, rise: 8, speed: 0.5, op: 0.3, color: 0xff8a73, amt: 0.8 }); // горячий выхлоп
    // ---- ветряк: нажатие меняет источник электричества
    const Wt = new T.Group(); at(Wt, -8, 0, -30); clickable(Wt, 'gcycle');
    at(cyl(0.9, 30, 0xeef6fb, { r2: 0.55 }), 0, 15, 0, Wt);
    at(box(2.4, 2, 4, 0xeef6fb), 0, 30.5, 0.6, Wt);
    const rot = new T.Group(); at(rot, 0, 30.5, 2.8, Wt);
    for (let k = 0; k < 3; k++) { const bl = box(1.3, 13, 0.4, 0xffffff); bl.position.set(Math.sin(k * 2.094) * 6.5, Math.cos(k * 2.094) * 6.5, 0); bl.rotation.z = -k * 2.094; rot.add(bl); }
    at(h.hitBox(16, 40, 8), 0, 22, 0, Wt);
    glowSel(Wt, fuelGrid && d.grid === 'wind', 0.4, 18);
    // ---- машина: бензиновая или электромобиль
    const ev = sel('ev'), Cg = new T.Group(); at(Cg, -12, 0, 24); clickable(Cg, 'cars');
    at(box(12, 3, 6, ev ? 0x3fae5a : 0xffb547), 0, 3, 0, Cg);
    at(box(6.4, 2.6, 5.4, ev ? 0x3fae5a : 0xffb547), -0.6, 5.8, 0, Cg);
    at(box(6.5, 1.8, 5.5, 0x2c3a52, { edges: false }), -0.6, 5.9, 0, Cg);
    for (const wx of [-3.6, 3.6]) for (const wz of [-3.1, 3.1]) { const ty = cyl(1.6, 1.2, 0x23262e); ty.rotation.x = Math.PI / 2; at(ty, wx, 1.6, wz, Cg); }
    at(h.hitBox(14, 9, 8), 0, 4, 0, Cg);
    glowSel(Cg, sel('car') || ev, 0.3, 20);
    h.steam(Cg, -6.6, 2, 0, { n: 5, spread: 1.4, size: 2.4, rise: 6, dir: [-1, 0.2, 0], lift: 3, speed: 0.8, op: 0.5, color: 0x9aa3b2, amt: ev ? 0 : sel('car') ? 1 : 0.3 });
    if (ev) { const ch = at(box(2, 7, 2, 0xe8ecf4), 9, 3.5, 0, Cg); at(box(2.2, 1.4, 0.4, 0x3fae5a, { edges: false }), 0, 2, 1.1, ch); }
    // ---- грузовик
    const Tr = new T.Group(); at(Tr, 14, 0, 26); clickable(Tr, 'o-truck');
    at(box(13, 8, 7, 0xe8ecf4), -3, 5.4, 0, Tr);
    at(box(5, 6, 7, 0x3b6fd8), 6.4, 4.4, 0, Tr);
    at(box(5.1, 2, 6.4, 0x2c3a52, { edges: false }), 6.6, 6, 0, Tr);
    for (const wx of [-6, -1, 6.4]) for (const wz of [-3.4, 3.4]) { const ty = cyl(1.7, 1.2, 0x23262e); ty.rotation.x = Math.PI / 2; at(ty, wx, 1.7, wz, Tr); }
    at(cyl(0.4, 5, C.STEEL, { edges: false }), 4, 10, -3, Tr);
    at(h.hitBox(18, 12, 9), 0, 5, 0, Tr);
    glowSel(Tr, sel('truck'), 0.3, 24);
    h.steam(Tr, 4, 12.5, -3, { n: 5, spread: 1.4, size: 2.6, rise: 7, speed: 0.6, op: 0.5, color: 0x8b96ad, amt: sel('truck') ? 1 : 0.3 });
    // ---- дом с тепловым насосом (наружный блок с вентилятором)
    const Ho = new T.Group(); at(Ho, 14, 0, -22); clickable(Ho, 'o-pump');
    at(box(14, 10, 12, 0xf4efe2), 0, 5, 0, Ho);
    const roof = cyl(10.4, 6, 0xb54a3a, { r2: 0.01, seg: 4 }); roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.86); at(roof, 0, 13, 0, Ho);
    at(box(3, 5, 0.3, 0x8a5a3a), -3, 2.5, 6.1, Ho); at(box(3.4, 3, 0.3, 0x9fd8ff, { edges: false }), 3, 6, 6.1, Ho);
    const hp = new T.Group(); at(hp, 10, 0, 2, Ho);
    at(box(5, 5, 3, 0xe8ecf4), 0, 2.5, 0, hp);
    const fan = cyl(1.8, 0.3, 0x2c3240, { seg: 24 }); fan.rotation.x = Math.PI / 2; at(fan, 0, 2.6, 1.55, hp);
    const blades = new T.Group(); at(blades, 0, 2.6, 1.75, hp);
    for (let k = 0; k < 3; k++) { const b = box(0.5, 3, 0.15, 0x8a96b0, { edges: false }); b.rotation.z = k * 2.094; blades.add(b); }
    at(h.hitBox(24, 18, 16), 3, 8, 0, Ho);
    glowSel(Ho, sel('pump'), 0.3, 26);
    if (sel('pump')) at(h.glow(0xff8a5a, 14, 0.5), 3, 6, 6.4, Ho);
    // ---- табло «куда уходит энергия»
    const ea = h.easel(kit.root, 42, 8, 30, 21, 5, 0.4);
    ea.face(h.canvasPlane(28, 19.6, 420, 294, (x, Wd, Hd) => drawEco(x, Wd, Hd, d)));
    // ---- подписи
    const pName = { coal: 'Угольная ТЭС', gt: 'Газовая турбина', ccgt: 'Парогазовая' }[pk];
    tag(v3(-36, chimH + 6, -16), pName, plantSel ? `η ${d.eta} %` : 'нажать — станции', plantSel);
    tag(v3(-8, 40, -30), 'Ветряк', fuelGrid ? 'сеть: ' + d.gridName : 'откуда ток', fuelGrid && d.grid === 'wind');
    tag(v3(-12, 10, 24), ev ? 'Электромобиль' : 'Бензиновый', sel('car') || ev ? `η ${d.eta} %` : 'нажать', sel('car') || ev);
    tag(v3(14, 14, 26), 'Дизельный грузовик', sel('truck') ? `η ${d.eta} %` : 'нажать', sel('truck'));
    tag(v3(16, 18, -22), 'Тепловой насос', sel('pump') ? `тепла ×${d.cop}` : 'нажать', sel('pump'));
    tag(v3(42, 31, 8), 'Табло', d.co2txt, d.ok);
    h.fin(1, 0, 0);
    kit.onFrame((dt, t) => {
      if (kit.reduce) return;
      rot.rotation.z = -t * (fuelGrid && d.grid === 'wind' ? 1.6 : 0.6);
      blades.rotation.z = -t * (sel('pump') ? 9 : 1.5);
    });
  };
})();
