// «Как в жизни» для тем «Химическая связь» (labs/chem-bonds) и «Валентность и формулы» (labs/chem-valence):
// учебный кабинет с настоящими моделями. Шаростержневые наборы (атомы — шары по стандарту CPK с отверстиями под связи),
// модели кристаллических решёток на подставках и рядом — образцы настоящих веществ в баночках и баллонах.
// Сцены строятся из window.LUCH_REAL() опыта; температура печи — из LUCH_REAL.live() в onFrame.
(() => {
  const SC = window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {};
  const live = () => { try { return window.LUCH_REAL.live ? window.LUCH_REAL.live() : null; } catch (e) { return null; } };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (x, n) => { let s = (Math.round(x * 10 ** n) / 10 ** n).toFixed(n); if (/^-0(\.0+)?$/.test(s)) s = s.slice(1); return s.replace('.', ',').replace('-', '−'); };
  // детерминированный «случай»: сцена перестраивается, а точки должны стоять на тех же местах
  const rnd = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const ease = x => x * x * (3 - 2 * x);
  const SUBD = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
  const lowF = s => String(s).replace(/([A-Za-z)])(\d+)/g, (m, a, dg) => a + dg.replace(/\d/g, x => SUBD[x]));
  const hexs = c => '#' + c.toString(16).padStart(6, '0');
  const ROM = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  const nowS = () => performance.now() / 1000;
  // плавные величины между перестройками сцены (сближение атомов, сдвиг слоя, перелёт электрона)
  const mem = {};
  const TY = 1.2; // верх подноса
  // настоящий шаг времени (kit ограничивает dt до 0,05 с, а на медленной графике кадров мало)
  const realDt = () => { let l = null; return t => { const d = l == null ? 0 : Math.min(0.3, t - l); l = t; return d; }; };

  // цвета атомов по стандарту CPK (как в школьных наборах) и радиусы шаров (в длинах связи)
  const ACOL = { H: 0xf2f2ee, C: 0x2b2d33, N: 0x3263e0, O: 0xe0352b, Cl: 0x3cc04a, Na: 0x8d55dc, Mg: 0xb9c0cc, Ca: 0xd9cfae,
    Al: 0xc9a9a6, P: 0xf08a1e, Fe: 0xd2702e, S: 0xf0d02c, Cu: 0xc87533, I: 0x6b2f8f, Si: 0xdcc394 };
  const RAD = { H: 0.55, C: 0.8, N: 0.78, O: 0.75, Cl: 0.95, Na: 0.98, Mg: 0.92, Ca: 0.98, Al: 0.9, P: 0.88, Fe: 0.9, S: 0.88, Cu: 0.9 };
  const SUPQ = q => q === 0 ? '' : (Math.abs(q) > 1 ? String(Math.abs(q)).replace(/\d/g, x => ({ '2': '²', '3': '³' })[x] || x) : '') + (q > 0 ? '⁺' : '⁻');

  // ---------- общие детали ----------
  function H(kit) {
    const { T, at, box, cyl, mesh, keep, grad, glowTex, textTex, clickable, toon, C } = kit;
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    const v2 = (x, y) => new T.Vector2(x, y);
    const Y1 = v3(0, 1, 0), Z1 = v3(0, 0, 1), X1 = v3(1, 0, 0);
    const glassMat = (color = 0xd8eef8, opacity = 0.26) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, transparent: true, opacity, side: T.DoubleSide, depthWrite: false }));
    const ownMat = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, ...o }));
    const spr = (map, color, opacity, add) => new T.Sprite(keep(new T.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending })));
    const glow = (color, size, opacity) => { const s = spr(glowTex(), color, opacity, true); s.scale.setScalar(size); return s; };
    // мягкое свечение, заметное и на белом подносе (без сложения цветов)
    const soft = (color, size, opacity) => { const s = spr(glowTex(), color, opacity, false); s.scale.setScalar(size); return s; };
    const acryl = ownMat(0xdff3ff, { transparent: true, opacity: 0.45, depthWrite: false });
    // шары одного радиуса делят геометрию; контур — «оболочка» постоянной толщины
    const geoS = new Map();
    const sphGeo = r => { const k = Math.round(r * 100); if (!geoS.has(k)) geoS.set(k, keep(new T.SphereGeometry(r, r > 2 ? 26 : 16, r > 2 ? 18 : 12))); return geoS.get(k); };
    function ball(parent, color, r, x, y, z, o = {}) {
      const m = new T.Mesh(sphGeo(r), o.mat || toon(color, o.matOpt)); m.castShadow = o.shadow !== false; m.receiveShadow = true;
      if (o.hull !== false) m.add(new T.Mesh(m.geometry, kit.hullMat));
      return at(m, x, y, z, parent);
    }
    const atomBall = (parent, el, r, x, y, z, o) => ball(parent, ACOL[el] ?? 0xcccccc, r, x, y, z, o);
    // электроны-бусинки: без контура, светятся
    const beadGeo = keep(new T.SphereGeometry(1, 12, 8));
    const beadMats = {};
    const beadMat = col => beadMats[col] || (beadMats[col] = keep(new T.MeshBasicMaterial({ color: col })));
    function bead(parent, col, r) { const m = new T.Mesh(beadGeo, beadMat(col)); m.scale.setScalar(r); parent.add(m); return m; }
    // стержень единичной длины вдоль Y: place(a, b) — поставить между точками
    const stickG = new Map();
    function stick(parent, r, color, o = {}) {
      const k = Math.round(r * 100) + (o.closed ? 'c' : '');
      if (!stickG.has(k)) stickG.set(k, keep(new T.CylinderGeometry(r, r, 1, 12, 1, !o.closed)));
      const m = new T.Mesh(stickG.get(k), o.mat || toon(color, o.matOpt)); m.castShadow = o.shadow !== false;
      if (o.hull !== false) m.add(new T.Mesh(m.geometry, kit.hullMat));
      parent.add(m);
      m.userData.place = (a, b) => {
        const dv = b.clone().sub(a), L = dv.length();
        if (L < 1e-3) { m.visible = false; return; }
        m.visible = true; m.scale.set(1, L, 1); m.quaternion.setFromUnitVectors(Y1, dv.multiplyScalar(1 / L));
        m.position.copy(a).add(b).multiplyScalar(0.5);
      };
      return m;
    }
    const perpOf = dir => { const p = new T.Vector3().crossVectors(dir, Z1); if (p.lengthSq() < 0.01) p.crossVectors(dir, X1); return p.normalize(); };
    // связь из n параллельных палочек
    function bondSticks(parent, n, r, color, sep) {
      const ss = []; for (let k = 0; k < n; k++) ss.push(stick(parent, r, color));
      const set = (a, b) => {
        const p = perpOf(b.clone().sub(a).normalize());
        ss.forEach((s, k) => { const off = p.clone().multiplyScalar((k - (n - 1) / 2) * sep); s.userData.place(a.clone().add(off), b.clone().add(off)); });
      };
      return { ss, set };
    }
    // табличка/табло на холсте
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
      if (o.border) { x.strokeStyle = o.border; x.lineWidth = o.bw || 6; x.beginPath(); x.roundRect((o.bw || 6) / 2, (o.bw || 6) / 2, pw - (o.bw || 6), ph - (o.bw || 6), o.round || 8); x.stroke(); }
      const lh = ph / lines.length;
      lines.forEach((ln, i) => {
        const t = typeof ln === 'string' ? { t: ln } : ln;
        let fs = Math.round(lh * (t.k || 0.62)); const font = s => `${t.w || 600} ${s}px ${t.mono === false ? '"Golos Text", sans-serif' : '"IBM Plex Mono", monospace'}`;
        x.font = font(fs); const tw = x.measureText(t.t).width; if (tw > pw * 0.9) { fs = Math.floor(fs * pw * 0.9 / tw); x.font = font(fs); }
        x.fillStyle = t.c || fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t.t, pw / 2, lh * (i + 0.5) + 2);
      });
    };
    // бумажная наклейка с надписью
    const sticker = (w, h, txt, fg = '#1b1610', bg = '#fff6e6') => canvasPlane(w, h, Math.round(110 * w / h), 110, (x, a, b) => textLines(x, a, b, String(txt).split('\n'), fg, bg, { round: 14 }));
    // табличка на подносе, наклонена к зрителю
    function plaque(parent, x, z, w, hh, lines, fg = '#1b1610', bg = '#fff6e6', y = TY + 0.05) {
      const m = canvasPlane(w, hh, Math.round(90 * w / hh * Math.max(1, lines.length * 0.7)), Math.round(90 * Math.max(1, lines.length * 0.7)), (cx, a, b) => textLines(cx, a, b, lines, fg, bg, { round: 12 }));
      m.rotation.x = -1.0; at(m, x, y + hh * 0.42, z, parent); return m;
    }
    // «таблетка» над деталью: всегда смотрит на зрителя
    function pill(parent, x, y, z, txt, fg = '#1b1610', bg = '#fff6e6', hgt = 2.6) {
      const lines = String(txt).split('\n'), mc = document.createElement('canvas').getContext('2d');
      let mw = 0; lines.forEach((l, i) => { mc.font = `700 ${i ? 40 : 50}px "IBM Plex Mono", monospace`; mw = Math.max(mw, mc.measureText(l).width); });
      const pw = Math.max(110, Math.ceil(mw + 56)), ph = 70 * lines.length + 8;
      const c = document.createElement('canvas'); c.width = pw; c.height = ph; const k = c.getContext('2d');
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace;
      const m = new T.Sprite(keep(new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false })));
      m.renderOrder = 6; m.center.set(0.5, 0);
      let w = 0; lines.forEach((l, i) => { k.font = `700 ${i ? 40 : 50}px "IBM Plex Mono", monospace`; w = Math.max(w, k.measureText(l).width); });
      w = Math.min(pw - 6, w + 34);
      k.fillStyle = bg; k.strokeStyle = '#1b1610'; k.lineWidth = 5;
      k.beginPath(); const x0 = (pw - w) / 2; k.roundRect(x0, 3, w, ph - 6, 24); k.fill(); k.stroke();
      const lh = (ph - 8) / lines.length;
      lines.forEach((l, i) => { k.fillStyle = fg; k.font = `700 ${i ? 40 : 50}px "IBM Plex Mono", monospace`; k.textAlign = 'center'; k.textBaseline = 'middle'; k.fillText(l, pw / 2, 4 + lh * (i + 0.5) + 2); });
      tex.needsUpdate = true;
      m.scale.set(hgt * pw / 70, hgt * ph / 70, 1);
      return at(m, x, y, z, parent);
    }
    // кнопка-клавиша с надписью сверху
    function button(parent, x, y, z, label, color, key, w = 4.2, d = 3.6, fg = '#ffffff') {
      const b = new T.Group(); at(b, x, y, z, parent);
      at(box(w, 1.4, d, color), 0, 0.7, 0, b);
      const top = new T.Mesh(keep(new T.PlaneGeometry(w * 0.9, d * 0.8)), keep(new T.MeshBasicMaterial({ map: keep(textTex(label, fg, hexs(color), Math.round(64 * w / d * 1.6), 100)), transparent: true })));
      top.rotation.x = -Math.PI / 2; at(top, 0, 1.42, 0, b);
      clickable(b, key); return b;
    }
    // белый лабораторный поднос
    function tray(g, w = 124, d = 84, z = 4) {
      at(box(w, TY, d, 0xf3f5f8), 0, TY / 2, z, g);
      at(box(w, 1.5, 1.2, 0xe2e7ee), 0, TY + 0.75, z - d / 2 + 0.6, g); at(box(w, 1.5, 1.2, 0xe2e7ee), 0, TY + 0.75, z + d / 2 - 0.6, g);
      at(box(1.2, 1.5, d - 2.4, 0xe2e7ee), -w / 2 + 0.6, TY + 0.75, z, g); at(box(1.2, 1.5, d - 2.4, 0xe2e7ee), w / 2 - 0.6, TY + 0.75, z, g);
    }
    const ring = (parent, x, z, r, col = 0xffd166, y = TY) => at(cyl(r, 0.25, col, { edges: false, hull: false, shadow: false }), x, y + 0.13, z, parent);
    // ---------- посуда и образцы ----------
    function glassWall(g, r, hh, y0 = 0, col = 0xd8eef8, op = 0.3) {
      const w = new T.Mesh(keep(new T.CylinderGeometry(r, r, hh, 28, 1, true)), glassMat(col, op)); at(w, 0, y0 + hh / 2, 0, g); w.add(new T.Mesh(w.geometry, kit.hullMat)); return w;
    }
    // склянка с узким горлом
    function bottle(parent, x, z, o = {}) {
      const g = new T.Group(); at(g, x, TY, z, parent);
      const r = o.r || 3.2, hh = o.h || 9;
      glassWall(g, r, hh, 0, o.brown ? 0x8a5a2a : 0xd8eef8, o.brown ? 0.62 : 0.3);
      at(cyl(r, 1.6, 0xd8eef8, { r2: 1.3, edges: false, matOpt: { transparent: true, opacity: 0.4 } }), 0, hh + 0.8, 0, g);
      at(cyl(1.5, 1.8, o.cap ?? 0x2c3240, { seg: 16 }), 0, hh + 2.4, 0, g);
      if (o.liq != null) at(cyl(r - 0.35, hh * 0.7, o.liq, { edges: false, hull: false, matOpt: { transparent: true, opacity: o.brown ? 0.92 : 0.7 } }), 0, 0.3 + hh * 0.35, 0, g);
      if (o.label) at(sticker(r * 1.5, 2.6, o.label, o.lfg, o.lbg), 0, hh * 0.5, r + 0.08, g);
      return { g, top: TY + hh + 3.3 };
    }
    // широкая банка с крышкой; fill(g, r, hh) кладёт содержимое
    function jar(parent, x, z, o = {}) {
      const g = new T.Group(); at(g, x, TY, z, parent);
      const r = o.r || 3.4, hh = o.h || 6.5;
      glassWall(g, r, hh);
      at(cyl(r - 0.1, 0.5, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.45 } }), 0, 0.25, 0, g);
      at(cyl(r + 0.3, 1.3, o.cap ?? 0x2c3240, { seg: 24 }), 0, hh + 0.65, 0, g);
      if (o.fill) o.fill(g, r - 0.45, hh);
      if (o.label) at(sticker(r * 1.45, 2.4, o.label, o.lfg, o.lbg), 0, hh * 0.62, r + 0.08, g);
      return { g, top: TY + hh + 1.3 };
    }
    // газовый баллон с вентилем
    function gasCyl(parent, x, z, col, o = {}) {
      const g = new T.Group(); at(g, x, TY, z, parent);
      const r = o.r || 2.5, hh = o.h || 12;
      at(cyl(r + 0.4, 1.2, 0x2c3240, { seg: 20 }), 0, 0.6, 0, g);
      at(cyl(r, hh, col, { seg: 28 }), 0, 1.2 + hh / 2, 0, g);
      at(mesh(new T.SphereGeometry(r, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), col, { hull: true, edges: false }), 0, 1.2 + hh, 0, g);
      at(cyl(0.8, 1.8, C.BRASS, { seg: 12 }), 0, 1.2 + hh + r + 0.4, 0, g);
      at(cyl(1.3, 0.45, 0x2c3240, { seg: 16 }), 0, 1.2 + hh + r + 1.4, 0, g);
      const out = cyl(0.4, 1.6, C.BRASS, { seg: 10 }); out.rotation.z = Math.PI / 2; at(out, 0.9, 1.2 + hh + r + 0.4, 0, g);
      if (o.label) at(sticker(r * 1.25, 2.2, o.label, o.lfg ?? '#ffe14a', o.lbg ?? hexs(col)), 0, 1.2 + hh * 0.62, r + 0.12, g);
      return { g, top: TY + 1.2 + hh + r + 1.7 };
    }
    // плоскодонная колба с газом и пробкой
    function flaskGas(parent, x, z, col, op, label) {
      const g = new T.Group(); at(g, x, TY, z, parent);
      const prof = [v2(0.001, 0), v2(2.6, 0), v2(3.7, 1.6), v2(3.9, 3.6), v2(3.3, 5.6), v2(1.3, 7.2), v2(1.2, 10), v2(1.5, 10.2)];
      const geo = keep(new T.LatheGeometry(prof, 32)); const w = new T.Mesh(geo, glassMat(0xd8eef8, 0.25)); g.add(w); w.add(new T.Mesh(geo, kit.hullMat));
      const gin = keep(new T.LatheGeometry(prof.slice(0, 6).map(p => v2(Math.max(0.001, p.x - 0.3), p.y + 0.15)).concat([v2(1.0, 9.4), v2(0.001, 9.4)]), 32));
      g.add(new T.Mesh(gin, ownMat(col, { transparent: true, opacity: op, depthWrite: false })));
      at(cyl(1.25, 2.2, 0x5a4636, { r2: 1.45, seg: 16 }), 0, 10.6, 0, g);
      if (label) at(sticker(4.4, 2.3, label), 0, 3.4, 3.98, g);
      return { g, top: TY + 11.8 };
    }
    // стакан с водой
    function waterGlass(parent, x, z, label) {
      const g = new T.Group(); at(g, x, TY, z, parent);
      const r = 3.3, hh = 8;
      glassWall(g, r, hh, 0, 0xd8eef8, 0.22);
      at(cyl(r - 0.1, 0.5, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.45 } }), 0, 0.25, 0, g);
      at(cyl(r - 0.3, 5.2, 0x7cc4ee, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.55 } }), 0, 0.5 + 2.6, 0, g);
      const rim = mesh(new T.TorusGeometry(r, 0.2, 6, 32), 0xeef6fb, { edges: false }); rim.rotation.x = Math.PI / 2; at(rim, 0, hh, 0, g);
      if (label) at(sticker(4.2, 2.2, label), 0, 6.6, r + 0.08, g);
      return { g, top: TY + hh };
    }
    // часовое стекло на подносе
    function dish(parent, x, z, r = 4.4) {
      const g = new T.Group(); at(g, x, TY, z, parent);
      const geo = keep(new T.LatheGeometry([v2(0.001, 0.2), v2(r * 0.6, 0.25), v2(r, 1.2), v2(r + 0.15, 1.35)], 32));
      const w = new T.Mesh(geo, glassMat(0xd8eef8, 0.42)); g.add(w); w.add(new T.Mesh(geo, kit.hullMat));
      return g;
    }
    // кристаллики-кубики
    function cubes(parent, n, s, col, spread, y0, seed = 1, o = {}) {
      for (let j = 0; j < n; j++) {
        const c = box(s * (0.75 + 0.5 * rnd(j + seed)), s * (0.75 + 0.5 * rnd(j + seed + 3)), s * (0.75 + 0.5 * rnd(j + seed + 5)), col, o);
        c.rotation.set(o.flatRot ? 0 : rnd(j + seed + 7) * 0.8, rnd(j + seed + 9) * 3, o.flatRot ? 0 : rnd(j + seed + 11) * 0.6);
        const a = rnd(j + seed + 13) * Math.PI * 2, rr = Math.sqrt(rnd(j + seed + 17)) * spread;
        at(c, Math.cos(a) * rr, y0 + s * 0.45 + (o.stack ? Math.floor(j / 5) * s * 0.8 : 0), Math.sin(a) * rr, parent);
      }
    }
    // пламя спиртовки
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
      at(glow(glowCol, hgt * 2.2, 0.4), 0, hgt * 0.35, 0, g);
      if (!kit.reduce) kit.onFrame((dt, t) => { s.scale.set(hgt * 0.5 * (1 + 0.08 * Math.sin(t * 17)), hgt * (1 + 0.12 * Math.sin(t * 13) + 0.05 * Math.sin(t * 29)), 1); });
      return g;
    }
    // пары (йод): клубы поднимаются и тают
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
    // молоток: начало координат — центр бойка, ручка уходит в −x
    function hammer(parent) {
      const g = new T.Group(); parent.add(g);
      at(box(3, 2.6, 5.2, C.STEEL), 0, 0, 0, g);
      const hd = cyl(0.75, 16, C.WOOD, { seg: 12 }); hd.rotation.z = Math.PI / 2; at(hd, -9, 0, 0, g);
      return g;
    }
    // шаростержневая модель молекулы: def = { a: [[эл, x, y, z]], b: [[i, j, кратность]] }, k — длина связи
    function molModel(parent, def, k, o = {}) {
      const g = new T.Group(); parent.add(g);
      const P = def.a.map(([, x, y, z]) => v3(x * k, y * k, z * k));
      def.a.forEach(([el], i) => atomBall(g, el, (RAD[el] || 0.8) * k * (o.rk || 0.4), P[i].x, P[i].y, P[i].z, { shadow: o.shadow }));
      (def.b || []).forEach(([i, j, n]) => bondSticks(g, n || 1, k * (o.sr || 0.07), o.stick ?? 0xd9d4c4, k * 0.18).set(P[i], P[j]));
      return g;
    }
    return { v3, v2, Y1, Z1, X1, glassMat, ownMat, spr, glow, soft, acryl, ball, atomBall, bead, beadMat, stick, bondSticks, perpOf, canvasPlane, textLines, sticker, plaque, pill,
      button, tray, ring, bottle, jar, gasCyl, flaskGas, waterGlass, dish, cubes, flame, steam, hammer, molModel };
  }

  // образец простого/сложного вещества в посуде: вода, соль, газы в баллонах, металлы
  function vessel(kit, h, parent, f, x, z) {
    const { T, at, box, cyl, mesh } = kit;
    const L = lowF(f);
    switch (f) {
      case 'H2O': return h.waterGlass(parent, x, z, L);
      case 'O3': return h.flaskGas(parent, x, z, 0x8fc4ff, 0.42, L);
      case 'Fe': return h.jar(parent, x, z, { label: L, fill: (g, r) => { for (let j = 0; j < 6; j++) { const n = cyl(0.3, 5.2, 0x8c939e, { seg: 8, edges: false }); n.rotation.set(Math.PI / 2 - 0.15, rnd(j + 2) * 3, 0.2); at(n, (rnd(j) - 0.5) * r, 0.7 + j * 0.42, (rnd(j + 5) - 0.5) * r * 0.6, g); } } });
      case 'NaCl': return h.jar(parent, x, z, { label: L, fill: (g, r) => h.cubes(g, 12, 1.05, 0xf6f8fa, r * 0.62, 0.5, 3, { stack: true }) });
      case 'N2': return h.gasCyl(parent, x, z, 0x24272e, { label: L });
      case 'CO2': return h.gasCyl(parent, x, z, 0x45484f, { label: L, lfg: '#ffffff' });
      case 'Cu': {
        const g = new T.Group(); at(g, x, TY, z, parent);
        at(cyl(3.4, 0.6, 0xd8dee8, { seg: 24 }), 0, 0.3, 0, g);
        for (let j = 0; j < 5; j++) { const t = mesh(new T.TorusGeometry(2.4, 0.32, 8, 30), 0xc87533, { hull: true, edges: false }); t.rotation.x = Math.PI / 2; at(t, 0, 1.0 + j * 0.62, 0, g); }
        at(h.sticker(4, 2, L), 0, 0.9, 3.5, g).rotation.x = -0.6;
        return { g, top: TY + 4.6 };
      }
      case 'CH4': return h.gasCyl(parent, x, z, 0xc8352b, { label: L, lfg: '#ffffff' });
      case 'O2': return h.gasCyl(parent, x, z, 0x3f8fe0, { label: L, lfg: '#1b1610' });
      case 'H2SO4': return h.bottle(parent, x, z, { brown: true, liq: 0x6a3a14, label: L });
      default: return h.jar(parent, x, z, { label: L });
    }
  }

  // молекулы (в длинах связи)
  const T4 = [[0, 1, 0], [0.943, -0.333, 0], [-0.471, -0.333, 0.816], [-0.471, -0.333, -0.816]];
  const MDEF = {
    H2O: { a: [['O', 0, 0.2, 0], ['H', 0.79, -0.41, 0], ['H', -0.79, -0.41, 0]], b: [[0, 1, 1], [0, 2, 1]] },
    O3: { a: [['O', 0, 0.3, 0], ['O', 0.87, -0.2, 0], ['O', -0.87, -0.2, 0]], b: [[0, 1, 2], [0, 2, 1]] },
    O2: { a: [['O', -0.55, 0, 0], ['O', 0.55, 0, 0]], b: [[0, 1, 2]] },
    N2: { a: [['N', -0.55, 0, 0], ['N', 0.55, 0, 0]], b: [[0, 1, 3]] },
    CO2: { a: [['C', 0, 0, 0], ['O', -1.05, 0, 0], ['O', 1.05, 0, 0]], b: [[0, 1, 2], [0, 2, 2]] },
    CH4: { a: [['C', 0, 0, 0], ...T4.map(p => ['H', p[0], p[1], p[2]])], b: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]] },
    H2SO4: { a: [['S', 0, 0, 0], ...T4.map(p => ['O', p[0] * 1.05, p[1] * 1.05, p[2] * 1.05]), ['H', -0.471 * 1.05 - 0.7, -0.333 * 1.05 - 0.45, 0.816 * 1.05], ['H', -0.471 * 1.05 - 0.7, -0.333 * 1.05 - 0.45, -0.816 * 1.05]],
      b: [[0, 1, 2], [0, 2, 2], [0, 3, 1], [0, 4, 1], [3, 5, 1], [4, 6, 1]] },
  };
  // кристаллики: ионный куб и металл — кусочек решётки
  (() => {
    const a = [], b = [];
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) a.push([(i + j + k) % 2 ? 'Cl' : 'Na', i - 0.5, j - 0.5, k - 0.5]);
    a.forEach((p, i) => a.forEach((q, j) => { if (j > i && Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) + Math.abs(p[3] - q[3]) === 1) b.push([i, j, 1]); }));
    MDEF.NaCl = { a, b };
    const mk = (el, extra) => { const A = []; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) A.push([el, (i - 0.5) * 1.3, (j - 0.5) * 1.3, (k - 0.5) * 1.3]); extra.forEach(p => A.push([el, p[0] * 1.3, p[1] * 1.3, p[2] * 1.3])); const B = []; A.slice(0, 8).forEach((p, i) => A.slice(0, 8).forEach((q, j) => { if (j > i && Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) + Math.abs(p[3] - q[3]) < 1.31) B.push([i, j, 1]); })); return { a: A, b: B }; };
    MDEF.Fe = mk('Fe', [[0, 0, 0]]);
    MDEF.Cu = mk('Cu', [[0.5, 0, 0], [-0.5, 0, 0], [0, 0.5, 0], [0, -0.5, 0], [0, 0, 0.5], [0, 0, -0.5]]);
  })();

  // ===== 1. Ковалентная связь: атомы из набора сближаются, общая пара светится между ними =====
  const RCOV = { H: 5.2, Cl: 7.4, O: 6.6, N: 6.6 };
  SC['chmo-cov'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    // сзади: настоящие вещества — какая молекула собирается
    d.mols.forEach((mo, i) => {
      const x = -40 + i * 20, z = -27, jg = new T.Group(); at(jg, 0, 0, 0, g); clickable(jg, 'mol' + i);
      if (mo.cur) h.ring(jg, x, z, 5.6);
      if (mo.id === 'H2') h.gasCyl(jg, x, z, 0x2e6b3a, { label: 'H₂', lfg: '#ff6a5a' });
      else if (mo.id === 'Cl2') h.flaskGas(jg, x, z, 0xc8e04a, 0.5, 'Cl₂');
      else if (mo.id === 'HCl') h.bottle(jg, x, z, { liq: 0xe8f2ee, label: 'HCl' });
      else if (mo.id === 'H2O') h.waterGlass(jg, x, z, 'H₂O');
      else h.gasCyl(jg, x, z, 0x24272e, { label: 'N₂' });
      h.plaque(jg, x, z + 6.6, 9, 2.6, [(mo.done ? '✓ ' : '') + mo.f], '#1b1610', mo.done ? '#86e0a8' : mo.cur ? '#ffd166' : '#fff6e6');
    });

    // подставка с прорезью: каждый атом на прозрачном штырьке
    const SZ = 6, CY = 24, yb = TY + 2.2;
    const mg = new T.Group(); at(mg, 0, 0, SZ, g); mg.rotation.y = 0.5; // ось молекулы поперёк взгляда
    at(box(62, 2.2, 9, C.WOOD2), 0, TY + 1.1, 0, mg);
    at(box(56, 0.2, 1.6, 0x3a2a1c, { edges: false }), 0, yb + 0.02, 0, mg);
    const n = d.atoms.length, tri = n === 3;
    const R = d.atoms.map(a => RCOV[a.s] || 4);
    const caps = d.links.map(l => tri ? 1 : Math.min(d.atoms[l.a].u, d.atoms[l.b].u));
    const tgt = d.links.map(l => l.n > 0 ? R[l.a] + R[l.b] + 7.5 : R[l.a] + R[l.b] + (tri ? 15 : 20));
    const keyL = li => 'cov:' + d.mol + ':' + li;
    d.links.forEach((l, li) => { if (mem[keyL(li)] === undefined || kit.reduce) mem[keyL(li)] = tgt[li]; });
    const DIR2 = [v3(0.79, -0.61, 0), v3(-0.79, -0.61, 0)];
    const posOf = Ls => tri
      ? (() => { const O = v3(0, CY + 4, 0); return [O, O.clone().addScaledVector(DIR2[0], Ls[0]), O.clone().addScaledVector(DIR2[1], Ls[1])]; })()
      : [v3(-Ls[0] / 2, CY, 0), v3(Ls[0] / 2, CY, 0)];
    const P0 = posOf(tgt);
    // направления на соседей (не меняются при сближении)
    const nb = d.atoms.map((a, i) => d.links.map((l, li) => ({ l, li, j: l.a === i ? l.b : l.b === i ? l.a : -1 })).filter(x => x.j >= 0)
      .map(x => ({ ...x, dir: P0[x.j].clone().sub(P0[i]).normalize() })));
    const ORANGE = 0xffa62b, CYAN = 0x5fd8f0, LONE = 0xe8ecf4;
    const ags = [], rods = [], pucks = [], pulses = [];
    d.atoms.forEach((a, i) => {
      const ag = new T.Group(); at(ag, P0[i].x, P0[i].y, P0[i].z, mg); clickable(ag, 'at' + i); ags.push(ag);
      h.atomBall(ag, a.s, R[i], 0, 0, 0);
      if (d.sel === i) { const rg = kit.mesh(new T.TorusGeometry(R[i] + 2.4, 0.4, 8, 40), 0xffd166, { edges: false, hull: false }); ag.add(rg); }
      // неспаренные электроны — у «отверстий» в сторону соседа
      nb[i].forEach(x => {
        const free = caps[x.li] - x.l.n; if (free <= 0) return;
        const p1 = h.perpOf(x.dir), p2 = new T.Vector3().crossVectors(x.dir, p1).normalize();
        for (let k = 0; k < free; k++) {
          const ang = free === 1 ? 0 : k * Math.PI * 2 / free + 0.5, rr = free === 1 ? 0 : 2.3;
          const p = x.dir.clone().multiplyScalar(R[i] + 1.3).addScaledVector(p1, Math.cos(ang) * rr).addScaledVector(p2, Math.sin(ang) * rr);
          const b = h.bead(ag, ORANGE, 1.0); b.position.copy(p);
          const gl = h.soft(0xffb547, 6, 0.7); gl.position.copy(p); ag.add(gl); pulses.push(gl);
        }
      });
      // неподелённые пары — с другой стороны
      const lone = (a.v - a.u) / 2;
      let dirs = [];
      if (nb[i].length === 1) { const u = nb[i][0].dir; dirs = [u.clone().negate(), v3(0, 1, 0), v3(0, 0, 1)]; }
      else if (nb[i].length === 2) { const b0 = nb[i][0].dir.clone().add(nb[i][1].dir).negate().normalize(); dirs = [b0.clone().add(v3(0, 0, 0.95)).normalize(), b0.clone().add(v3(0, 0, -0.95)).normalize()]; }
      dirs.slice(0, lone).forEach(dv => {
        const p = h.perpOf(dv);
        for (const s of [-0.95, 0.95]) { const b = h.bead(ag, LONE, 0.85); b.position.copy(dv.clone().multiplyScalar(R[i] + 1.1).addScaledVector(p, s)); }
      });
      // электронов вокруг атома
      const neg = d.complete && d.polar ? (i === d.neg ? 'δ−\n' : 'δ+\n') : '';
      h.pill(ag, 0, R[i] + 3.0, 0, neg + a.around + ' e⁻' + (a.ok ? ' ✓' : ''), '#1b1610', a.ok ? '#86e0a8' : '#fff6e6', 2.6);
      // прозрачный штырёк и шайба в прорези
      rods.push(h.stick(mg, 0.6, 0, { mat: h.acryl, hull: false, shadow: false }));
      pucks.push(at(cyl(1.8, 0.8, 0x3b4a66, { seg: 18 }), P0[i].x, yb + 0.4, 0, mg));
    });
    // связи: палочки и общие пары
    const bonds = d.links.map((l, li) => {
      if (!l.n) return null;
      const st = h.bondSticks(mg, l.n, 0.7, 0xd9d4c4, 2.2);
      const prs = [];
      for (let k = 0; k < l.n; k++) prs.push([h.bead(mg, CYAN, 1.1), h.bead(mg, CYAN, 1.1)]);
      const cloud = h.soft(0x7fe4f8, 15 + 4 * l.n, 0.7); mg.add(cloud);
      const sh = d.complete && d.polar ? (l.b === d.neg ? 0.1 : l.a === d.neg ? -0.1 : 0) : 0;
      return { l, st, prs, cloud, sh };
    });
    const Ls = d.links.map((l, li) => mem[keyL(li)]);
    const apply = t => {
      const P = posOf(Ls);
      P.forEach((p, i) => { ags[i].position.copy(p); rods[i].userData.place(v3(p.x, yb, p.z), v3(p.x, p.y - R[i] + 0.4, p.z)); pucks[i].position.x = p.x; pucks[i].position.z = p.z; });
      bonds.forEach(B => {
        if (!B) return;
        const A = P[B.l.a], Bp = P[B.l.b]; B.st.set(A, Bp);
        const ax = Bp.clone().sub(A).normalize(), p1 = h.perpOf(ax), p2 = new T.Vector3().crossVectors(ax, p1).normalize();
        const mid = A.clone().lerp(Bp, 0.5 + B.sh);
        B.cloud.position.copy(mid); B.cloud.material.opacity = 0.42 + 0.14 * Math.sin(t * 3);
        B.prs.forEach((pr, k) => {
          const ang = t * 1.6 + k * Math.PI * 2 / B.l.n, ro = B.l.n > 1 ? 2.4 : 1.6;
          const off = p1.clone().multiplyScalar(Math.cos(ang) * ro).addScaledVector(p2, Math.sin(ang) * ro);
          pr[0].position.copy(mid).addScaledVector(ax, 1.1).add(off); pr[1].position.copy(mid).addScaledVector(ax, -1.1).add(off);
        });
      });
      pulses.forEach((p, k) => { p.material.opacity = 0.45 + 0.35 * Math.sin(t * 4 + k); });
    };
    apply(0);
    const rdt = realDt();
    kit.onFrame((dt, t) => {
      const rd = rdt(t);
      d.links.forEach((l, li) => { Ls[li] += (tgt[li] - Ls[li]) * Math.min(1, rd * 3.5); mem[keyL(li)] = Ls[li]; });
      apply(kit.reduce ? 0 : t);
    });
    // легенда и кнопка
    const lg = h.canvasPlane(26, 9, 520, 180, (x, a, b) => {
      x.fillStyle = '#fff6e6'; x.beginPath(); x.roundRect(2, 2, a - 4, b - 4, 18); x.fill(); x.strokeStyle = '#1b1610'; x.lineWidth = 4; x.stroke();
      [['#ffa62b', 'неспаренный e⁻'], ['#5fd8f0', 'общая пара'], ['#c9ced8', 'неподелённая пара']].forEach(([c, t], k) => {
        const y = 34 + k * 56; x.fillStyle = c; x.strokeStyle = '#1b1610'; x.lineWidth = 3;
        x.beginPath(); x.arc(40, y, 13, 0, 7); x.fill(); x.stroke(); if (k === 2) { x.beginPath(); x.arc(72, y, 13, 0, 7); x.fill(); x.stroke(); }
        x.fillStyle = '#1b1610'; x.font = '600 34px "Golos Text", sans-serif'; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(t, 100, y + 2);
      });
    });
    lg.rotation.x = -1.0; at(lg, -40, TY + 3.8, 30, g);
    h.button(g, 40, TY, 31, 'Разъединить', 0x3b4a66, 'unbond', 20, 6);
    const nOk = d.atoms.filter(a => a.ok).length;
    tag(v3(0, CY + (tri ? 20 : 17), SZ), `${d.f} · ${d.name}`, d.complete ? `${d.st} · ${d.polar ? 'полярная' : 'неполярная'}` : `завершено ${nOk} из ${n}`, d.complete);
  };

  // ===== 2. Ионная связь: металл отдаёт электрон неметаллу, ионы притягиваются =====
  const RN = { Na: 8.0, Mg: 7.0, Cl: 5.6, O: 5.0 }, RI = { Na: 4.8, Mg: 3.9, Cl: 8.2, O: 7.0 }, OUT0 = { Na: 1, Mg: 2, Cl: 7, O: 6 };
  SC['chmo-ion'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    // сзади: баночки с ионными веществами
    d.cmps.forEach((c, i) => {
      const x = -26 + i * 26, z = -27, jg = new T.Group(); at(jg, 0, 0, 0, g); clickable(jg, 'cmp' + i);
      if (c.cur) h.ring(jg, x, z, 5.4);
      if (c.id === 'NaCl') h.jar(jg, x, z, { label: 'NaCl', fill: (gg, r) => h.cubes(gg, 12, 1.05, 0xf6f8fa, r * 0.62, 0.5, 3, { stack: true }) });
      else if (c.id === 'MgO') h.jar(jg, x, z, { label: 'MgO', fill: (gg, r) => at(cyl(r, 2.4, 0xfbfbf8, { r2: r * 0.55, edges: false }), 0, 1.7, 0, gg) });
      else h.jar(jg, x, z, { label: 'MgCl₂', fill: (gg, r) => h.cubes(gg, 10, 1.2, 0xe4eef4, r * 0.6, 0.5, 9, { stack: true, matOpt: { transparent: true, opacity: 0.85 } }) });
      h.plaque(jg, x, z + 6.4, 9, 2.6, [(c.done ? '✓ ' : '') + c.f], '#1b1610', c.done ? '#86e0a8' : c.cur ? '#ffd166' : '#fff6e6');
    });
    // спереди: простые вещества, из которых получают соль — совсем другие по свойствам
    const met = d.atoms.find(a => a.metal).s, non = d.atoms.find(a => !a.metal).s;
    if (met === 'Na') h.jar(g, -52, 30, { label: 'Na', cap: 0x6a4a2a, fill: (gg, r) => { at(cyl(r, 4.2, 0xf4e6a8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.55 } }), 0, 2.6, 0, gg); h.cubes(gg, 4, 1.3, 0xb9c0c8, r * 0.5, 0.5, 21); } });
    else { const mg = new T.Group(); at(mg, -52, TY, 30, g); at(cyl(3.8, 0.5, 0xd8dee8, { seg: 24 }), 0, 0.25, 0, mg); const cl = mesh(new T.TorusGeometry(2.4, 0.5, 6, 30), 0xc9ced8, { hull: true, edges: false }); cl.rotation.x = Math.PI / 2; cl.scale.z = 2.4; at(cl, 0, 1.8, 0, mg); at(h.sticker(3.6, 2, 'Mg'), 0, 0.9, 4, mg).rotation.x = -0.6; }
    if (non === 'Cl') h.flaskGas(g, 46, 26, 0xc8e04a, 0.5, 'Cl₂'); else h.gasCyl(g, 46, 24, 0x3f8fe0, { label: 'O₂', lfg: '#1b1610' });
    h.button(g, 0, TY, 33, 'Заново', 0x3b4a66, 'reion', 12, 5);

    // подставка с атомами на штырьках
    const SZ = 4, CY = 25, yb = TY + 2.2, n = d.atoms.length;
    const mg = new T.Group(); at(mg, 0, 0, SZ, g); mg.rotation.y = 0.45; // ось поперёк взгляда
    at(box(84, 2.2, 9, C.WOOD2), 0, TY + 1.1, 0, mg);
    at(box(78, 0.2, 1.6, 0x3a2a1c, { edges: false }), 0, yb + 0.02, 0, mg);
    const rad = d.atoms.map(a => a.metal ? RN[a.s] + (RI[a.s] - RN[a.s]) * (OUT0[a.s] - a.outer) / OUT0[a.s] : RN[a.s] + (RI[a.s] - RN[a.s]) * (a.outer - OUT0[a.s]) / (8 - OUT0[a.s]));
    const xs0 = n === 2 ? [-21, 21] : [-38, 0, 38];
    const xs1 = n === 2 ? (() => { const x0 = -(rad[0] + rad[1] + 0.6) / 2; return [x0, x0 + rad[0] + rad[1] + 0.6]; })() : [-(rad[0] + rad[1] + 0.6), 0, rad[1] + rad[2] + 0.6];
    const kJ = 'ionJ:' + d.cmp, kO = 'ionO:' + d.cmp;
    if (mem[kJ] === undefined || kit.reduce) mem[kJ] = d.complete ? 1 : 0;
    if (!d.complete) mem[kJ] = 0;
    // перелёт электрона: кто отдал, кто принял с прошлой перестройки
    const prev = mem[kO], outs = d.atoms.map(a => a.outer);
    let fl = null;
    if (prev && prev.length === n && !kit.reduce) {
      const iM = d.atoms.findIndex((a, i) => a.metal && outs[i] < prev[i]), iN = d.atoms.findIndex((a, i) => !a.metal && outs[i] > prev[i]);
      if (iM >= 0 && iN >= 0) mem.ionFly = { cmp: d.cmp, iM, iN, t0: nowS() };
    }
    mem[kO] = outs;
    if (mem.ionFly && mem.ionFly.cmp === d.cmp && nowS() - mem.ionFly.t0 < 1.0) fl = mem.ionFly;
    const ags = [], rods = [], pucks = [], rings = [];
    let hidden = null;
    d.atoms.forEach((a, i) => {
      const ag = new T.Group(); at(ag, xs0[i], CY, 0, mg); clickable(ag, 'io' + i); ags.push(ag);
      h.atomBall(ag, a.s, rad[i], 0, 0, 0);
      if (a.q) { const gl = h.soft(a.q > 0 ? 0xff9a7a : 0x7ab8ff, rad[i] * 3.6, 0.45); ag.add(gl); }
      // внешний электронный слой: кольцо и электроны на нём
      const rg = new T.Group(); ag.add(rg); rings.push(rg);
      const cnt = a.metal && a.outer === 0 ? 8 : a.outer, rr = rad[i] + (a.metal && a.outer === 0 ? 2.0 : 3.4);
      const tor = mesh(new T.TorusGeometry(rr, 0.22, 6, 56), 0x9fb3cc, { edges: false, hull: false, shadow: false }); rg.add(tor);
      for (let k = 0; k < cnt; k++) {
        const own = a.metal ? a.outer > 0 : k < OUT0[a.s];
        const col = a.metal && a.outer === 0 ? 0xb8c2d2 : own && !a.metal ? 0xe8ecf4 : 0xffa62b;
        const b = h.bead(rg, col, 0.95); const an = k * Math.PI * 2 / cnt + Math.PI / 2; b.position.set(Math.cos(an) * rr, Math.sin(an) * rr, 0);
        if (fl && fl.iN === i && k === cnt - 1) hidden = b;
      }
      const lab = a.s + SUPQ(a.q);
      h.pill(ag, 0, rr + 1.8, 0, lab + (a.ok ? ' ✓' : ''), '#1b1610', a.q > 0 ? '#ffd2c6' : a.q < 0 ? '#cfe2ff' : '#fff6e6', 2.8);
      rods.push(h.stick(mg, 0.6, 0, { mat: h.acryl, hull: false, shadow: false }));
      pucks.push(at(cyl(1.8, 0.8, 0x3b4a66, { seg: 18 }), xs0[i], yb + 0.4, 0, mg));
    });
    if (hidden) hidden.visible = false;
    const spark = h.bead(mg, 0xffb547, 1.1), sparkG = h.soft(0xffb547, 7, 0.9); mg.add(sparkG);
    const trail = [0, 1, 2].map(k => { const s = h.soft(0xffb547, 5 - k, 0.55 - k * 0.14); mg.add(s); return s; });
    const showSpark = v => { spark.visible = sparkG.visible = v; trail.forEach(s => { s.visible = v; }); };
    showSpark(false);
    const place = t => {
      const j = ease(clamp(mem[kJ], 0, 1));
      ags.forEach((ag, i) => {
        const x = xs0[i] + (xs1[i] - xs0[i]) * j; ag.position.x = x;
        rods[i].userData.place(v3(x, yb, 0), v3(x, CY - rad[i] + 0.4, 0)); pucks[i].position.x = x;
        rings[i].rotation.z = kit.reduce ? 0 : t * (d.atoms[i].metal ? 0.5 : -0.35);
      });
      if (fl) {
        const f = (nowS() - fl.t0) / 0.9;
        if (f >= 1) { showSpark(false); if (hidden) hidden.visible = true; fl = null; return; }
        showSpark(true);
        const A = ags[fl.iM].position.clone().add(v3(0, rad[fl.iM] + 3.4, 0)), B = ags[fl.iN].position.clone().add(v3(0, rad[fl.iN] + 3.4, 0));
        const at3 = u => A.clone().lerp(B, u).add(v3(0, Math.sin(Math.PI * u) * 12, 3 * Math.sin(Math.PI * u)));
        const e = ease(clamp(f, 0, 1)), p = at3(e);
        spark.position.copy(p); sparkG.position.copy(p);
        trail.forEach((s, k) => s.position.copy(at3(Math.max(0, e - 0.05 * (k + 1)))));
      }
    };
    place(0);
    const rdt = realDt();
    kit.onFrame((dt, t) => {
      const rd = rdt(t);
      if (d.complete && mem[kJ] < 1 && !(fl)) mem[kJ] = Math.min(1, mem[kJ] + rd * 1.4);
      place(t);
    });
    const name = d.name.replace(/ \(.*\)/, '');
    tag(v3(0, CY + 21, SZ), `${d.f} · ${name}`, d.complete ? `${d.atoms.map(a => a.s + SUPQ(a.q)).join(' + ')} · ионная связь` : `перенесено ${d.moved} e⁻`, d.complete);
  };

  // ===== 3. Металлическая связь: модель решётки с электронным газом и кусок металла в цепи с лампой =====
  SC['chmo-met'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, cable, placeOn, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const MX = -30, MZ = 2, sp = 5.6, nx = 6, nz = 2;
    const yb = TY + 2.4, W = nx * sp, HB = 2 * sp, D = nz * sp + 1;
    at(box(40, 2.4, 18, C.WOOD2), MX, TY + 1.2, MZ, g);
    // два прозрачных блока: нижние ряды и верхние (их сдвигают молотком)
    const low = new T.Group(), up = new T.Group(); at(low, MX, yb, MZ, g); at(up, MX, yb + HB, MZ, g);
    const blk = (grp, col) => { const b = box(W, HB, D, col, { mat: h.glassMat(0xcfe8ff, 0.16), shadow: false }); at(b, 0, HB / 2, 0, grp); };
    blk(low); blk(up);
    const ions = [];
    for (const [grp, j0] of [[low, 0], [up, 2]]) for (let i = 0; i < nx; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < nz; k++) {
      const x = (i - (nx - 1) / 2) * sp, y = (j + 0.5) * sp, z = (k - (nz - 1) / 2) * sp;
      const na = (i + j + j0 + k) % 2 === 0;
      const m = d.metal ? h.ball(grp, 0xd9895b, 2.05, x, y, z) : h.ball(grp, na ? ACOL.Na : ACOL.Cl, na ? 1.55 : 2.35, x, y, z);
      ions.push({ m, x, y, z, ph: rnd(i * 7 + j * 3 + k + j0 * 11) * 6 });
    }
    // электронный газ (только в металле): дрейф к «плюсу» при токе
    const els = [];
    if (d.metal) for (const grp of [low, up]) for (let e = 0; e < 18; e++) {
      const s = els.length, b = h.bead(grp, 0x6fe0ff, 0.42), gl = h.glow(0x6fe0ff, 2.2, 0.75); grp.add(gl);
      els.push({ b, gl, x0: rnd(s + 1) * W, y0: rnd(s + 2), z0: rnd(s + 3), vx: (rnd(s + 4) - 0.5) * 7, vy: 0.4 + rnd(s + 5), vz: 0.3 + rnd(s + 6) * 0.6 });
    }
    // молоток у модели
    const hm = h.hammer(g); clickable(hm, 'hammer3');
    const rest = { p: v3(MX - 4, TY + 1.3, 19), rz: 0 }, hit = { p: v3(MX - W / 2 - 1.6, yb + HB * 1.5, MZ), rz: 0 };
    hm.position.copy(rest.p);
    const kS = 'metS', kC = 'metC';
    const tgtS = d.cracked ? (mem[kS] ?? d.shift) : d.shift;
    if (mem[kS] === undefined || kit.reduce || mem.metSample !== d.metal) { mem[kS] = d.shift; mem[kC] = d.cracked ? 1 : 0; }
    if (!d.cracked) mem[kC] = 0;
    if (mem.metSample === d.metal && (mem.metShiftSeen !== d.shift || mem.metCrSeen !== d.cracked) && (d.shift || d.cracked) && !kit.reduce) mem.metHit = nowS();
    mem.metSample = d.metal; mem.metShiftSeen = d.shift; mem.metCrSeen = d.cracked;
    const amp = d.metal ? 0.06 + 0.5 * (d.temp - 20) / 500 : 0.06, drift = d.metal ? 6 * d.I / 100 : 0;
    const tri = (v, a) => { const u = ((v % (2 * a)) + 2 * a) % (2 * a); return u < a ? u : 2 * a - u; };
    const rdt = realDt();
    const frame = (dt, t) => {
      const rd = rdt(t);
      if (!kit.reduce) {
        mem[kS] += (tgtS - mem[kS]) * Math.min(1, rd * 6);
        if (d.cracked) mem[kC] = Math.min(1, mem[kC] + rd * 2.5);
      }
      const c = ease(mem[kC]);
      up.position.set(MX + mem[kS] * sp + (d.cracked ? 1.5 * c : 0), yb + HB + 3.2 * c, MZ); up.rotation.z = -0.13 * c;
      ions.forEach(o => { const a = kit.reduce ? 0 : amp; o.m.position.set(o.x + a * Math.sin(t * 13 + o.ph), o.y + a * Math.sin(t * 11 + o.ph * 2), o.z + a * Math.cos(t * 12 + o.ph)); });
      els.forEach(e => {
        const tt = kit.reduce ? 0 : t;
        const x = (((e.x0 + (e.vx + drift) * tt) % W) + W) % W - W / 2;
        e.b.position.set(x, 0.6 + tri(e.y0 * (HB - 1.2) + e.vy * 3 * tt, HB - 1.2), -D / 2 + 0.6 + tri(e.z0 * (D - 1.2) + e.vz * 3 * tt, D - 1.2));
        e.gl.position.copy(e.b.position);
      });
      // удар молотком
      const ht = mem.metHit ? nowS() - mem.metHit : 9;
      if (ht < 1.1) { const u = ht < 0.45 ? ease(ht / 0.45) : ht < 0.6 ? 1 : 1 - ease((ht - 0.6) / 0.5); hm.position.copy(rest.p).lerp(hit.p, u); hm.rotation.z = 0.5 * Math.sin(Math.PI * u) * (ht < 0.45 ? 1 : 0.2); }
      else { hm.position.copy(rest.p); hm.rotation.z = 0; }
    };
    frame(0, 0); kit.onFrame(frame);

    // справа: настоящая цепь — батарея, ключ, образец в зажимах, лампа, амперметр
    const HX = 32, HZ = 8, sY = 14;
    at(box(28, 2, 10, C.WOOD2), HX, TY + 1, HZ, g);
    for (const s of [-1, 1]) { at(cyl(1.1, sY - TY - 2.6, 0x2c3240, { seg: 14 }), HX + s * 11, (TY + 2 + sY - 0.6) / 2, HZ, g); at(box(3, 2.2, 3.4, C.BRASS), HX + s * 11, sY, HZ, g); at(cyl(0.9, 1.6, C.BRASS, { seg: 10 }), HX + s * 11, sY + 1.9, HZ, g); }
    const hT = clamp((d.temp - 20) / 500, 0, 1);
    const sample = new T.Group(); at(sample, HX, sY, HZ, g); clickable(sample, d.metal ? 's-ion' : 's-metal');
    if (d.metal) {
      const col = new T.Color(0xc87533).lerp(new T.Color(0xd2502a), hT * 0.6).getHex();
      at(box(24, 1.2, 2.4, col, { matOpt: hT > 0.55 ? { emissive: 0xff3a10, emissiveIntensity: (hT - 0.55) * 1.2 } : undefined }), 0, 0, 0, sample);
    } else at(box(22, 3, 3.6, 0xf1f5f9, { matOpt: { transparent: true, opacity: 0.88 } }), 0, 0, 0, sample);
    // спиртовка под образцом
    const lg = new T.Group(); at(lg, HX, TY + 2, HZ, g); clickable(lg, 't+');
    const body = mesh(new T.SphereGeometry(3.2, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), 0xd8eef8, { mat: h.glassMat(0xd8eef8, 0.35), hull: true, edges: false }); body.scale.y = 0.9; at(body, 0, 2.3, 0, lg);
    at(cyl(3, 2.3, 0xbfe0f5, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.55 } }), 0, 1.15, 0, lg);
    at(cyl(1.2, 1.4, C.STEEL), 0, 5.6, 0, lg); at(cyl(0.4, 0.9, 0xf2ead2, { edges: false }), 0, 6.7, 0, lg);
    if (d.metal && d.temp > 20) h.flame(g, HX, TY + 2 + 7.0, HZ, 3 + 3.6 * hT, '#d8f0ff', '#4a9cff', 0x6ab0ff);
    h.button(g, HX - 6, TY, HZ + 9, '−100°', 0x3b6fd8, 't-', 7, 4.2);
    h.button(g, HX + 6, TY, HZ + 9, '+100°', 0xe0473a, 't+', 7, 4.2);
    const cells = placeOn(kit.cells(2, 3), v3(30, 0, -26), 0, 'bat');
    const kn = placeOn(kit.knife({ closed: d.volt, click: 'volt' }), v3(0, 0, 30), 0, 'sw');
    const bl = placeOn(kit.bulb({ glow: d.I / 100 * 1.1, value: '' }), v3(53, 0, -6), 0, 'lamp');
    const am = placeOn(kit.meter({ kind: 'A', val: d.I / 100, max: 1, value: '' }), v3(23, 0, 31), 0, 'A');
    const I = d.I > 0 ? 0.3 + 0.5 * d.I / 100 : 0;
    const L = v3(HX - 11, sY + 2.7, HZ), R = v3(HX + 11, sY + 2.7, HZ);
    cable(cells.tout, bl.tin, C.WIRE.plus, I, { r: 0.55 });
    cable(bl.tout, R, C.WIRE.mid, I, { r: 0.55, lift: 4 });
    cable(L, kn.tout, C.WIRE.mid, I, { r: 0.55, lift: 4 });
    cable(kn.tin, am.tin, C.WIRE.mid, I, { r: 0.55, lift: 5, via: [v3(-4, 1.4, 22), v3(10, 1.4, 21)] });
    cable(am.tout, cells.tin, C.WIRE.minus, I, { r: 0.55, lift: 4, via: [v3(28, 1.4, 22), v3(14, 1.4, 0), v3(10, 1.4, -14)] });
    // выбор образца и новый образец
    h.button(g, -54, TY, 34, 'Медь', d.metal ? 0x2f9e55 : 0x3b4a66, 's-metal', 10, 4.6);
    h.button(g, -42, TY, 34, 'NaCl', d.metal ? 0x3b4a66 : 0x2f9e55, 's-ion', 10, 4.6);
    h.button(g, -28, TY, 34, 'Новый', 0x6b7280, 'fresh', 11, 4.6);
    tag(v3(MX, yb + HB * 2 + 6, MZ), d.metal ? 'Модель меди' : 'Модель NaCl', d.cracked ? 'раскололся!' : d.metal ? (d.shift ? 'слой сдвинут — связь цела' : 'ионы + электронный газ') : 'ионы, свободных e⁻ нет', d.cracked);
    tag(v3(HX, sY + 6, HZ), d.metal ? 'Медь' : 'Кристалл NaCl', d.metal ? `${d.temp} °C` : 'не проводит');
    tag(bl.tagAt, 'Лампа', d.I > 0 ? `ток ${d.I} %` : d.volt ? 'не горит' : 'ключ разомкнут', d.I > 0);
  };

  // ===== 4. Кристаллические решётки: модели на подставках, образцы в часовых стёклах, печь, лампа-пробник, молоток =====
  const TORD = ['ion', 'atom', 'mol', 'met'], TN = { ion: 'ионная', atom: 'атомная', mol: 'молекулярная', met: 'металлическая' };
  const SCOL = { nacl: 0xf6f8fa, cao: 0xe9e2cc, diamond: 0xcfeaf7, quartz: 0xe8f0f6, ice: 0xbfe3f5, iodine: 0x4a4258, cu: 0xc87533, fe: 0x8c939e };
  const MCOL = { nacl: 0xffb070, cao: 0xffc890, diamond: 0xffe6b0, quartz: 0xffd8a0, ice: 0x7cc4ee, iodine: 0x5a2a6a, cu: 0xffa040, fe: 0xffc070 };
  function sampleObj(kit, h, parent, id, s) {
    const { T, at, box, cyl, mesh } = kit;
    const g = new T.Group(); parent.add(g); g.scale.setScalar(s);
    if (id === 'nacl') h.cubes(g, 6, 1.0, SCOL.nacl, 1.6, 0, 1);
    else if (id === 'cao') for (let j = 0; j < 4; j++) { const m = mesh(new T.IcosahedronGeometry(0.9 + rnd(j) * 0.4, 0), SCOL.cao, { edgeAngle: 50 }); m.rotation.set(rnd(j + 1) * 3, rnd(j + 2) * 3, 0); at(m, (rnd(j + 3) - 0.5) * 3, 0.8, (rnd(j + 4) - 0.5) * 2.4, g); }
    else if (id === 'diamond') { const m = mesh(new T.OctahedronGeometry(1.5), SCOL.diamond, { matOpt: { transparent: true, opacity: 0.8, emissive: 0x6ab8e0, emissiveIntensity: 0.25 } }); m.scale.y = 1.15; at(m, 0, 1.6, 0, g); }
    else if (id === 'quartz') { const pr = cyl(0.8, 3.2, SCOL.quartz, { seg: 6, matOpt: { transparent: true, opacity: 0.75 } }); at(pr, 0, 1.6, 0, g); at(cyl(0.8, 1.4, SCOL.quartz, { r2: 0.01, seg: 6, matOpt: { transparent: true, opacity: 0.75 } }), 0, 3.9, 0, g); g.children.forEach(c => { c.rotation.z = 0.25; }); const p2 = cyl(0.55, 2.2, SCOL.quartz, { seg: 6, matOpt: { transparent: true, opacity: 0.75 } }); p2.rotation.z = -0.5; at(p2, 1.3, 1.1, 0.4, g); }
    else if (id === 'ice') { const m = box(2.6, 2.4, 2.6, SCOL.ice, { matOpt: { transparent: true, opacity: 0.7 } }); m.rotation.y = 0.4; at(m, 0, 1.2, 0, g); }
    else if (id === 'iodine') for (let j = 0; j < 7; j++) { const m = box(1.1, 0.3, 0.7, SCOL.iodine, { matOpt: { emissive: 0x2a1a3a, emissiveIntensity: 0.3 } }); m.rotation.set(rnd(j) * 0.6, rnd(j + 1) * 3, rnd(j + 2) * 0.6); at(m, (rnd(j + 3) - 0.5) * 2.6, 0.3 + rnd(j + 4) * 0.4, (rnd(j + 5) - 0.5) * 2.2, g); }
    else if (id === 'cu') { const m = box(3.2, 0.5, 2.2, SCOL.cu); at(m, 0, 0.25, 0, g); const n2 = mesh(new T.IcosahedronGeometry(0.7, 0), 0xb8652a, { edgeAngle: 50 }); at(n2, 0.8, 0.9, 0.3, g); }
    else { const sh = cyl(0.5, 3.6, SCOL.fe, { seg: 10 }); sh.rotation.z = Math.PI / 2; at(sh, 0.2, 0.55, 0, g); const hd = cyl(1.0, 0.8, SCOL.fe, { seg: 6 }); hd.rotation.z = Math.PI / 2; at(hd, -1.9, 1.0, 0, g); }
    return g;
  }
  // модели решёток
  function latModel(kit, h, parent, type) {
    const { T } = kit, v3 = h.v3;
    const g = new T.Group(); parent.add(g);
    const STK = 0xc9ced8;
    if (type === 'ion') {
      const s = 4.0;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) { const na = (i + j + k) % 2; h.ball(g, na ? ACOL.Na : ACOL.Cl, na ? 0.95 : 1.45, (i - 1) * s, (j - 1) * s, (k - 1) * s, { shadow: false }); }
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
        const A = (a - 1) * s, B = (b - 1) * s;
        h.stick(g, 0.2, STK, { hull: false, shadow: false }).userData.place(v3(-s, A, B), v3(s, A, B));
        h.stick(g, 0.2, STK, { hull: false, shadow: false }).userData.place(v3(A, -s, B), v3(A, s, B));
        h.stick(g, 0.2, STK, { hull: false, shadow: false }).userData.place(v3(A, B, -s), v3(A, B, s));
      }
      return { g, half: s + 1.5 };
    }
    if (type === 'atom') {
      const a = 10, P = [];
      for (const [x, y, z] of [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5], [0.5, 0.5, 1], [0.5, 1, 0.5], [1, 0.5, 0.5],
        [0.25, 0.25, 0.25], [0.75, 0.75, 0.25], [0.75, 0.25, 0.75], [0.25, 0.75, 0.75]]) P.push(v3((x - 0.5) * a, (y - 0.5) * a, (z - 0.5) * a));
      P.forEach(p => h.ball(g, ACOL.C, 0.95, p.x, p.y, p.z, { shadow: false }));
      P.forEach((p, i) => P.forEach((q, j) => { if (j > i && Math.abs(p.distanceTo(q) - a * 0.433) < 0.1) h.stick(g, 0.28, STK, { hull: false, shadow: false }).userData.place(p, q); }));
      return { g, half: a / 2 + 1 };
    }
    if (type === 'mol') {
      // лёд: «гофрированные» шестиугольники молекул воды в два слоя
      const s = 4.0, O = [];
      const hex = (cx, cz) => { for (let k = 0; k < 6; k++) { const an = k * Math.PI / 3 + Math.PI / 6; O.push(v3(cx + Math.cos(an) * s, (k % 2 ? 0.7 : -0.7), cz + Math.sin(an) * s)); } };
      hex(-s * 0.866, 0); hex(s * 0.866, 0);
      const uniq = []; O.forEach(p => { if (!uniq.some(q => q.distanceTo(p) < 0.5)) uniq.push(p); });
      const layers = [uniq.map(p => p.clone().add(v3(0, -3.2, 0))), uniq.map(p => v3(p.x, -p.y + 3.2, p.z))];
      const all = layers[0].concat(layers[1]), B = [];
      all.forEach((p, i) => all.forEach((q, j) => { if (j > i && p.distanceTo(q) < s * 1.15) B.push([p, q]); }));
      layers[0].forEach(p => { if (p.y > -3.2) { const q = layers[1].find(r => Math.abs(r.x - p.x) < 0.1 && Math.abs(r.z - p.z) < 0.1); if (q) B.push([p, q]); } });
      all.forEach(p => h.ball(g, ACOL.O, 1.1, p.x, p.y, p.z, { shadow: false }));
      B.forEach(([p, q], k) => {
        h.stick(g, 0.16, 0x9aa3b2, { hull: false, shadow: false }).userData.place(p, q);
        const hp = p.clone().lerp(q, k % 2 ? 0.3 : 0.7); h.ball(g, ACOL.H, 0.6, hp.x, hp.y, hp.z, { shadow: false });
      });
      return { g, half: 5.5 };
    }
    // металл: гранецентрированная кубическая (медь)
    const a = 9.5, P = [];
    for (const [x, y, z] of [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5], [0.5, 0.5, 1], [0.5, 1, 0.5], [1, 0.5, 0.5]]) P.push(v3((x - 0.5) * a, (y - 0.5) * a, (z - 0.5) * a));
    P.forEach(p => h.ball(g, 0xd9895b, 1.7, p.x, p.y, p.z, { shadow: false }));
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) if (Math.abs(P[i].distanceTo(P[j]) - a) < 0.1) h.stick(g, 0.18, STK, { hull: false, shadow: false }).userData.place(P[i], P[j]);
    for (let k = 0; k < 10; k++) { const e = h.glow(0x6fe0ff, 2, 0.6); e.position.set((rnd(k) - 0.5) * a, (rnd(k + 9) - 0.5) * a, (rnd(k + 19) - 0.5) * a); g.add(e); }
    return { g, half: a / 2 + 1.7 };
  }
  SC['chmo-lat'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, cable, placeOn, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    // сзади: модели решёток на подставках — это и «ящики» для сортировки
    TORD.forEach((tp, k) => {
      const x = -45 + k * 30, z = -27, sg = new T.Group(); at(sg, x, TY, z, g); clickable(sg, 'cl-' + tp);
      at(box(24, 2, 14, C.WOOD2), 0, 1, 0, sg);
      const M = latModel(kit, h, sg, tp), ph = 2.6; M.g.scale.setScalar(1.2); M.half *= 1.2;
      at(cyl(1.3, ph, 0, { mat: h.acryl, hull: false, edges: false, shadow: false }), 0, 2 + ph / 2, 0, sg);
      M.g.position.set(0, 2 + ph + M.half, 0); M.g.rotation.y = 0.35;
      const names = d.subs.filter(s => s.placed === tp).map(s => s.short);
      const pl = h.canvasPlane(22, 5.2, 440, 104, (x2, a, b) => h.textLines(x2, a, b, [{ t: TN[tp], w: 700 }, { t: names.length ? names.join(', ') : '—', k: 0.5 }], '#1b1610', names.length ? '#c9f0d6' : '#fff6e6', { round: 12 }));
      pl.rotation.x = -0.75; at(pl, 0, 2.6, 7.4, sg);
    });
    // спереди: образцы в часовых стёклах
    d.subs.forEach((s, i) => {
      const x = -45.5 + i * 13, z = 34, sg = new T.Group(); at(sg, 0, 0, 0, g); clickable(sg, 'sub' + i);
      if (s.cur) h.ring(sg, x, z, 5.4);
      const dg = h.dish(sg, x, z, 4.3);
      if (!s.placed) { const o = sampleObj(kit, h, dg, s.id, 0.85); o.position.y = 0.3; }
      else at(cyl(0.9, 0.3, 0x2f9e55, { edges: false, hull: false }), 0, 0.4, 0, dg);
      h.plaque(sg, x, z + 5.6, 10.5, 2.4, [(s.placed ? '✓ ' : '') + s.short], '#1b1610', s.placed ? '#86e0a8' : s.cur ? '#ffd166' : '#fff6e6');
    });
    // печь с тиглем
    const FX = -20, FZ = 4, fh = 9;
    const fg = new T.Group(); at(fg, FX, TY, FZ, g);
    at(cyl(8, fh, 0x5a6478, { seg: 32 }), 0, fh / 2, 0, fg);
    at(cyl(5.2, 0.4, 0x2c3240, { edges: false, seg: 28 }), 0, fh + 0.2, 0, fg);
    const coil = new T.Mesh(kit.keep(new T.TorusGeometry(4.6, 0.32, 6, 36)), kit.keep(new T.MeshBasicMaterial({ color: d.heat ? 0xff5a2a : 0x6a5048 }))); coil.rotation.x = Math.PI / 2; at(coil, 0, fh + 0.45, 0, fg);
    const cr = new T.Group(); at(cr, 0, fh - 1.4, 0, fg);
    const cgeo = kit.keep(new T.LatheGeometry([h.v2(0.001, 0), h.v2(2.3, 0), h.v2(3.6, 4.2), h.v2(3.9, 4.4)], 28));
    const cm = new T.Mesh(cgeo, kit.toon(0xf4f1ea, { side: T.DoubleSide })); cr.add(cm); cm.add(new T.Mesh(cgeo, kit.hullMat));
    const s = d.s;
    let solid = null, melt = null;
    if (d.melted) { melt = cyl(2.9, 0.5, MCOL[s.id], { edges: false, hull: false, matOpt: { emissive: MCOL[s.id], emissiveIntensity: s.tm > 500 ? 0.7 : 0.1 } }); at(melt, 0, 2.6, 0, cr); }
    else {
      if (d.hitK === 'crumb') { for (let j = 0; j < 9; j++) { const c = box(0.6, 0.5, 0.6, SCOL[s.id]); c.rotation.y = rnd(j) * 3; at(c, (rnd(j + 1) - 0.5) * 3, 1.0 + rnd(j + 2) * 0.3, (rnd(j + 3) - 0.5) * 3, cr); } }
      else { solid = sampleObj(kit, h, cr, s.id, 0.8); solid.position.y = 0.6; if (d.hitK === 'flat') solid.scale.set(1.15, 0.35, 1.15); }
    }
    const crGlow = h.glow(0xff8a3a, 12, 0); at(crGlow, FX, TY + fh + 2, FZ, g);
    // табло температуры
    at(box(10, 5.4, 1.6, C.DARK), FX, TY + 4.4, FZ + 8.3, g);
    const scr = h.canvasPlane(8.6, 3.6, 300, 126); at(scr, FX, TY + 4.6, FZ + 9.12, g);
    let shown = null;
    const showT = T0 => { const tx = fmt(T0, 0) + ' °C'; if (tx === shown) return; shown = tx; scr.userData.draw((x2, a, b) => h.textLines(x2, a, b, [tx], T0 > 500 ? '#ffb070' : '#86e0a8', '#0e1520')); };
    h.button(g, FX - 6, TY, FZ + 15, d.heat ? 'Стоп' : 'Нагрев', d.heat ? 0xe0473a : 0x2f9e55, 'heat', 9, 4.4);
    h.button(g, FX + 6, TY, FZ + 15, 'Остудить', 0x3b6fd8, 'cool', 10, 4.4);
    // пары йода
    const vap = h.steam(g, FX, TY + fh + 2, FZ, { n: 8, spread: 5, size: 5, rise: 16, op: 0.6, amt: 0, color: 0x9a4ac8 });
    // лампа-пробник: батарейка, лампа, два угольных электрода в тигле
    const bat = placeOn(kit.cells(1, 1.5), v3(44, 0, 20), 0, 'bat');
    const bl = placeOn(kit.bulb({ glow: d.lamp ? 1 : 0, value: '', click: 'tok' }), v3(46, 0, -2), 0, 'lamp');
    clickable(bl.g, 'tok');
    const PX = FX + 10, PZ = FZ - 6;
    at(box(5, 1, 5, C.DARK), PX, TY + 0.5, PZ, g);
    at(cyl(0.6, 18, C.STEEL, { edges: false }), PX, TY + 9.5, PZ, g);
    h.stick(g, 0.45, C.STEEL).userData.place(v3(PX, TY + 17, PZ), v3(FX + 1, TY + 17, FZ));
    at(box(4.4, 1.6, 1.6, 0x2c3240), FX, TY + 17, FZ, g);
    const eA = v3(FX - 1.2, TY + 17.8, FZ), eB = v3(FX + 1.2, TY + 17.8, FZ);
    for (const e of [eA, eB]) at(cyl(0.35, 10, 0x2c2e33, { edges: false, seg: 10 }), e.x, TY + 12.6, e.z, g);
    const I = d.lamp ? 0.5 : 0;
    cable(bat.tout, bl.tin, C.WIRE.plus, I, { r: 0.5 });
    cable(bl.tout, eB, C.WIRE.mid, I, { r: 0.5, lift: 4 });
    cable(eA, bat.tin, C.WIRE.minus, I, { r: 0.5, lift: 4 });
    // молоток
    const hm = h.hammer(g); clickable(hm, 'hit');
    const rest = v3(12, TY + 1.3, 22), strike = v3(FX + 2.4, TY + fh + 4.5, FZ);
    hm.position.copy(rest); hm.rotation.y = Math.PI;
    kit.onFrame((dt, t) => {
      const Lv = live() || {}, T0 = Lv.T ?? -30;
      showT(T0);
      const hot = clamp((T0 - 500) / 1500, 0, 1);
      crGlow.material.opacity = 0.75 * hot; coil.material.color.setHex(Lv.heat ?? d.heat ? (Math.sin(t * 6) > -0.6 ? 0xff5a2a : 0xff7a3a) : 0x6a5048);
      vap.set(s.id === 'iodine' && T0 > 40 ? clamp((T0 - 40) / 80, 0.3, 1) : 0);
      const ht = (performance.now() - d.hitT) / 1000;
      if (ht >= 0 && ht < 1.3 && !kit.reduce) { const u = ht < 0.5 ? ease(ht / 0.5) : ht < 0.65 ? 1 : 1 - ease((ht - 0.65) / 0.6); hm.position.copy(rest).lerp(strike, u); hm.rotation.z = -0.6 * Math.sin(Math.PI * u) * (ht < 0.5 ? 1 : 0.3); }
      else { hm.position.copy(rest); hm.rotation.z = 0; }
    });
    tag(v3(FX, TY + 22, FZ), `${s.name} ${s.f}`, d.tm != null ? `tпл ${s.id === 'diamond' ? '≈ ' : ''}${fmt(d.tm, 0)} °C` + (d.melted ? ' · жидк.' : '') : 'tпл = ?', d.melted);
    tag(bl.tagAt, 'Лампа', d.lampTested ? (d.lamp ? 'горит — проводит' : 'не горит') : 'нажмите — проверить', d.lamp);
    tag(v3(0, 30, -30), 'Решётки', `${d.placed} из ${d.subs.length} разложено`);
  };

  // ===== 5. Валентность: атом из набора с N отверстиями, палочки-связи с водородом =====
  const VDIR = {
    1: [[1, 0, 0]],
    2: [[0.79, -0.61, 0], [-0.79, -0.61, 0]],
    3: [[0.81, -0.38, 0.45], [-0.81, -0.38, 0.45], [0, -0.38, -0.93]],
    4: [[0, 1, 0], [0.81, -0.333, 0.47], [-0.81, -0.333, 0.47], [0, -0.333, -0.943]],
  };
  const VR = { Cl: 7.8, O: 7.0, N: 7.2, C: 7.5 };
  SC['chmo-val'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const AX = 0, AY = 27, AZ = 2, R = VR[d.el] || 7, RH = 4, SL = 4.6;
    // подставка и штырёк
    at(cyl(8, 2, C.WOOD2, { seg: 32 }), AX, TY + 1, AZ, g);
    at(cyl(0.8, AY - R - TY - 2 + 0.6, 0, { mat: h.acryl, hull: false, edges: false, shadow: false }), AX, (TY + 2 + AY - R + 0.6) / 2, AZ, g);
    const mol = new T.Group(); at(mol, AX, AY, AZ, g);
    const atm = new T.Group(); mol.add(atm); clickable(atm, 'hbin');
    h.atomBall(atm, d.el, R, 0, 0, 0);
    const dirs = VDIR[d.v].map(p => v3(p[0], p[1], p[2]).normalize());
    const free = [];
    dirs.forEach((dv, k) => {
      // отверстие под связь
      const hole = cyl(1.4, 0.5, 0x15171c, { edges: false, hull: false, shadow: false }); hole.quaternion.setFromUnitVectors(h.Y1, dv); hole.position.copy(dv).multiplyScalar(R - 0.12); atm.add(hole);
      if (k < d.nH) {
        const hg = new T.Group(); mol.add(hg); clickable(hg, 'hin-' + k);
        h.stick(hg, 0.7, 0xd9d4c4).userData.place(dv.clone().multiplyScalar(R - 0.6), dv.clone().multiplyScalar(R + SL + RH * 0.6));
        const hp = dv.clone().multiplyScalar(R + SL + RH); h.atomBall(hg, 'H', RH, hp.x, hp.y, hp.z);
      } else if (!d.sat) {
        const mk = new T.Group(); mk.quaternion.setFromUnitVectors(h.Y1, dv); mk.position.copy(dv).multiplyScalar(R + 0.1); atm.add(mk);
        const tr = kit.mesh(new T.TorusGeometry(1.9, 0.38, 8, 28), 0xffa62b, { edges: false, hull: false, matOpt: { emissive: 0xff8a00, emissiveIntensity: 0.5 } }); tr.rotation.x = Math.PI / 2; mk.add(tr);
        const st = h.stick(mk, 0.5, 0xffa62b, { closed: true }); st.userData.place(v3(0, -0.3, 0), v3(0, 2.2, 0));
        free.push(mk);
      }
    });
    if (!kit.reduce) kit.onFrame((dt, t) => { mol.rotation.y = 0.35 * Math.sin(t * 0.5); free.forEach((f, k) => { f.scale.setScalar(1 + 0.12 * Math.sin(t * 5 + k)); }); });
    // лоток с атомами водорода и палочками
    const tg = new T.Group(); at(tg, 40, TY, 14, g); clickable(tg, 'hbin');
    at(box(18, 1, 13, C.WOOD), 0, 0.5, 0, tg);
    for (const [x, z, w, dd] of [[0, -6.1, 18, 0.8], [0, 6.1, 18, 0.8], [-8.6, 0, 0.8, 13], [8.6, 0, 0.8, 13]]) at(box(w, 3, dd, C.WOOD2), x, 1.5, z, tg);
    [[-4.5, -2.6], [0, -2.6], [4.5, -2.6], [-4.5, 2.4], [0, 2.4]].forEach(([x, z]) => {
      h.atomBall(tg, 'H', 2.0, x, 3, z);
      const hl = cyl(0.7, 0.3, 0x15171c, { edges: false, hull: false, shadow: false }); at(hl, x, 5, z, tg);
    });
    for (let k = 0; k < 4; k++) { const st = cyl(0.35, 6, 0xd9d4c4, { seg: 8, edges: false }); st.rotation.z = Math.PI / 2; st.rotation.y = 0.2 * k; at(st, 4.6, 1.4 + k * 0.1, 3.4 - k * 0.3, tg); }
    h.plaque(tg, 0, 8.4, 12, 2.6, ['+ H'], '#1b1610', '#fff6e6', 0);
    // слева сзади: атомы-заготовки Cl, O, N, C
    d.ans.forEach((a, i) => {
      const x = -48, z = -26 + i * 11, eg = new T.Group(); at(eg, x, TY, z, g); clickable(eg, 'el-' + a.s);
      if (a.s === d.el) h.ring(eg, 0, 0, 4.6, 0xffd166, 0);
      at(cyl(2.2, 1.6, C.WOOD2, { seg: 20 }), 0, 0.8, 0, eg);
      h.atomBall(eg, a.s, 3.1, 0, 1.6 + 2.9, 0);
      h.plaque(eg, 7.6, 0.6, 7.4, 2.4, [a.ok ? `${a.s} · ${ROM[a.v]} ✓` : a.s], '#1b1610', a.ok ? '#86e0a8' : a.s === d.el ? '#ffd166' : '#fff6e6', 0);
    });
    // клавиши ответа I–IV
    [1, 2, 3, 4].forEach((v, k) => h.button(g, -21 + k * 14, TY, 34, ROM[v], d.done && v === d.v ? 0x2f9e55 : 0x3b4a66, 'v-' + v, 10, 5.6));
    // настоящее вещество: что получилось
    const SX = 40, SZ = -22;
    if (d.el === 'Cl') h.bottle(g, SX, SZ, { liq: 0xe8f2ee, label: d.sat ? 'HCl' : '?' });
    else if (d.el === 'O') h.waterGlass(g, SX, SZ, d.sat ? 'H₂O' : '?');
    else if (d.el === 'N') h.bottle(g, SX, SZ, { liq: 0xeef6fb, label: d.sat ? 'NH₃' : '?', cap: 0x3b6fd8 });
    else { // метан: газовая горелка с синим пламенем
      const bg = new T.Group(); at(bg, SX, TY, SZ, g);
      at(cyl(3.2, 1.2, C.DARK, { seg: 24 }), 0, 0.6, 0, bg); at(cyl(0.9, 7, C.STEEL, { seg: 14 }), 0, 4.7, 0, bg); at(cyl(1.3, 1.2, C.BRASS, { seg: 14 }), 0, 2.4, 0, bg);
      if (d.sat) h.flame(g, SX, TY + 8.3, SZ, 6, '#cfe6ff', '#2f6fff', 0x5a8cff);
      at(h.sticker(5, 2.2, d.sat ? 'CH₄' : '?'), 0, 0.9, 3.4, bg).rotation.x = -0.5;
    }
    const nOk = d.ans.filter(a => a.ok).length;
    tag(v3(AX, AY + R + (d.v === 4 && d.nH ? 15 : 7), AZ), `${d.el} · ${d.eln}`, d.sat ? `${lowF(d.f)} · ${d.name}` : `присоединено H: ${d.nH}`, d.sat);
    tag(v3(-48, 14, -32), 'Найдено', `${nOk} из 4`);
  };

  // ===== 6. Составляем формулу: атомы из лотков, палочки-связи, пока не останется свободных отверстий =====
  const FR = { Na: 5.0, Ca: 5.0, Al: 4.8, C: 4.6, P: 4.7, Fe: 4.8, S: 4.7, Mg: 4.8, O: 4.0, Cl: 4.4, N: 4.2 };
  const FSAMP = { Na2O: [0xf4f2ea, 'p'], CaCl2: [0xf6f8fa, 'c'], Al2O3: [0xfbfbf8, 'p'], CO2: [0x45484f, 'g'], P2O5: [0xfbfbf8, 'p'], FeCl3: [0x8a4a1c, 'c'], SO3: [0xf2f2ea, 'c'], Mg3N2: [0xe2e0a0, 'p'] };
  SC['chmo-fml'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const rA = FR[d.a] || 3.5, rB = FR[d.b] || 3.1, spA = Math.max(12.5, rA * 2 + 3.5), spB = Math.max(12.5, rB * 2 + 3.5);
    const ZA = -9, ZB = 14;
    const PA = Array.from({ length: d.x }, (_, i) => v3((i - (d.x - 1) / 2) * spA, TY + rA, ZA));
    const PB = Array.from({ length: d.y }, (_, j) => v3((j - (d.y - 1) / 2) * spB, TY + rB, ZB));
    // распределяем единицы валентности: A0 A0 A0 A1 … ↔ B0 B0 B1 B1 …
    const ua = [], ub = [];
    PA.forEach((_, i) => { for (let k = 0; k < d.va; k++) ua.push(i); });
    PB.forEach((_, j) => { for (let k = 0; k < d.vb; k++) ub.push(j); });
    const m = Math.min(ua.length, ub.length), pairs = {};
    for (let k = 0; k < m; k++) { const key = ua[k] + '-' + ub[k]; pairs[key] = (pairs[key] || 0) + 1; }
    const freeA = PA.map((_, i) => ua.slice(m).filter(x => x === i).length), freeB = PB.map((_, j) => ub.slice(m).filter(x => x === j).length);
    Object.entries(pairs).forEach(([key, n]) => { const [i, j] = key.split('-').map(Number); h.bondSticks(g, n, 0.65, 0xd9d4c4, 1.9).set(PA[i], PB[j]); });
    const glows = [];
    const stubs = (grp, p, r, nf, back) => {
      for (let k = 0; k < nf; k++) {
        const an = (k - (nf - 1) / 2) * 0.55, dv = v3(Math.sin(an), 1, back ? -0.35 : 0.35).normalize();
        const a = p.clone().addScaledVector(dv, r - 0.4), b = p.clone().addScaledVector(dv, r + 3.4);
        h.stick(grp, 0.55, 0xffa62b, { closed: true }).userData.place(a, b);
        const gl = h.glow(0xffb547, 4.6, 0.8); gl.position.copy(b); grp.add(gl); glows.push(gl);
      }
    };
    PA.forEach((p, i) => { const ag = new T.Group(); at(ag, 0, 0, 0, g); clickable(ag, 'la-' + i); h.atomBall(ag, d.a, rA, p.x, p.y, p.z); stubs(ag, p, rA, freeA[i], true); });
    PB.forEach((p, j) => { const bg = new T.Group(); at(bg, 0, 0, 0, g); clickable(bg, 'lb-' + j); h.atomBall(bg, d.b, rB, p.x, p.y, p.z); stubs(bg, p, rB, freeB[j], false); });
    if (glows.length && !kit.reduce) kit.onFrame((dt, t) => glows.forEach((gl, k) => { gl.material.opacity = 0.5 + 0.4 * Math.sin(t * 5 + k); }));
    // лотки с атомами
    const tray2 = (x, el, r, v, key) => {
      const tg = new T.Group(); at(tg, x, TY, 30, g); clickable(tg, key);
      at(box(16, 1, 12, C.WOOD), 0, 0.5, 0, tg);
      for (const [px, pz, w, dd] of [[0, -5.6, 16, 0.8], [0, 5.6, 16, 0.8], [-7.6, 0, 0.8, 12], [7.6, 0, 0.8, 12]]) at(box(w, 2.6, dd, C.WOOD2), px, 1.3, pz, tg);
      const rr = Math.min(r * 0.7, 2.6);
      [[-3.6, -2.4], [3.6, -2.4], [0, 2.6]].forEach(([px, pz]) => h.atomBall(tg, el, rr, px, 1 + rr, pz));
      h.plaque(tg, 0, 7.6, 11, 2.6, [`+ ${el} · ${ROM[v]}`], '#1b1610', '#fff6e6', 0);
    };
    tray2(-48, d.a, rA, d.va, 'binA'); tray2(48, d.b, rB, d.vb, 'binB');
    // доска с формулой и счётом связей
    const bg = new T.Group(); at(bg, 0, TY, -29, g);
    for (const s of [-1, 1]) at(box(1.2, 18, 1.2, C.DARK), s * 22, 9, 0, bg);
    at(box(42, 13, 0.8, 0x2f4a3a), 0, 11.5, 0, bg);
    const okCol = d.ok ? '#86e0a8' : d.eq ? '#ffd166' : '#ffb0a0';
    const bd = h.canvasPlane(40, 11.6, 640, 186, (x2, a, b) => h.textLines(x2, a, b, [{ t: lowF(d.f), k: 0.8, w: 700, c: '#ffffff' }, { t: `${d.a}: ${d.x}·${ROM[d.va]} = ${d.A}    ${d.b}: ${d.y}·${ROM[d.vb]} = ${d.B}`, k: 0.62, c: okCol }], '#ffffff', '#2f4a3a'));
    at(bd, 0, 11.5, 0.45, bg);
    h.button(g, -29, TY, -24, '‹', 0x2f6fd8, 'prev', 7, 6);
    h.button(g, 29, TY, -24, '›', 0x2f6fd8, 'next', 7, 6);
    // образец вещества
    const fk = d.good, [col, kind] = FSAMP[fk] || [0xf4f2ea, 'p'], lab = d.foundCur ? lowF(fk) : '?';
    if (kind === 'g') h.gasCyl(g, 52, -24, col, { label: lab, lfg: '#ffffff' });
    else h.jar(g, 52, -24, { label: lab, fill: (gg, r) => kind === 'p' ? at(cyl(r, 2.4, col, { r2: r * 0.55, edges: false }), 0, 1.7, 0, gg) : h.cubes(gg, 10, 1.1, col, r * 0.6, 0.5, 5, { stack: true }) });
    const fr = Math.abs(d.A - d.B);
    tag(v3(-22, 10, 27), d.name, d.ok ? `${lowF(d.f)} ✓ свободных связей нет` : d.eq ? `можно сократить на ${d.g}` : `свободных связей: ${fr}`, d.ok);
    tag(v3(-50, 14, -24), 'Задание', `${d.nf} из 3 формул`);
  };

  // ===== 7. Простые и сложные вещества: две полки, баночки с веществами и модель выбранного =====
  SC['chmo-sub'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.tray(g);
    const SY = TY + 2.4;
    const shelf = (cx, k, title) => {
      const sg = new T.Group(); at(sg, cx, 0, -28, g); clickable(sg, 'box-' + k);
      for (const s of [-1, 1]) at(box(1.6, 24, 11, C.WOOD2), s * 26, TY + 12, 0, sg);
      at(box(52, 1.2, 11, C.WOOD), 0, SY - 0.6, 0, sg);
      at(box(52, 1.2, 11, C.WOOD), 0, TY + 23.4, 0, sg);
      at(box(52, 24, 0.8, 0xe9dcc4), 0, TY + 12, -5.2, sg);
      at(box(34, 5, 0.8, k === 's' ? 0x2f6fd8 : 0xc05a2a), 0, TY + 26.6, 4.6, sg);
      const sign = h.canvasPlane(32, 4.4, 520, 72, (x2, a, b) => h.textLines(x2, a, b, [{ t: title, w: 700, k: 0.8 }], '#ffffff', k === 's' ? '#2f6fd8' : '#c05a2a', { round: 10 }));
      at(sign, 0, TY + 26.6, 5.05, sg);
      return sg;
    };
    shelf(-30, 's', 'ПРОСТЫЕ'); shelf(30, 'c', 'СЛОЖНЫЕ');
    const ns = d.subs.filter(s => s.pl === 's').length, nc = d.subs.filter(s => s.pl === 'c').length;
    const slots = { s: 0, c: 0 };
    d.subs.forEach((s, i) => {
      const vg = new T.Group(); at(vg, 0, 0, 0, g); clickable(vg, 'card-' + s.f);
      if (s.pl) {
        const k = slots[s.pl]++, x = (s.pl === 's' ? -30 : 30) - 20 + k * 10, z = -27;
        vg.position.y = SY - TY; vessel(kit, h, vg, s.f, x, z);
      } else {
        const x = -49.5 + i * 11, z = 31;
        if (d.sel === s.f) h.ring(vg, x, z, 4.8);
        vessel(kit, h, vg, s.f, x, z);
      }
    });
    // поворотный столик с моделью выбранного вещества
    const TX = 0, TZ = 4;
    at(cyl(9, 1.6, C.WOOD2, { seg: 36 }), TX, TY + 0.8, TZ, g);
    const top = new T.Group(); at(top, TX, TY + 1.6, TZ, g);
    at(cyl(8, 0.8, 0xe2e7ee, { seg: 36 }), 0, 0.4, 0, top);
    const sel = d.subs.find(s => s.f === d.sel);
    if (sel && MDEF[sel.f]) {
      const def = MDEF[sel.f];
      const k = { H2SO4: 8, CH4: 10, H2O: 10, O2: 10, N2: 10, O3: 9, CO2: 9, NaCl: 9, Cu: 8, Fe: 8 }[sel.f] || 9;
      const M = h.molModel(top, def, k, { rk: 0.42, sr: 0.07 });
      const box3 = new T.Box3().setFromObject(M);
      const lift = 0.8 + 3 - box3.min.y;
      at(cyl(0.5, 3 + 0.4, 0, { mat: h.acryl, hull: false, edges: false, shadow: false }), 0, 0.8 + 1.7, 0, top);
      M.position.y = lift;
      const atoms = {}; def.a.forEach(([el]) => { atoms[el] = (atoms[el] || 0) + 1; });
      tag(v3(TX, TY + 2.4 + lift + (box3.max.y - box3.min.y) + 4, TZ), `${lowF(sel.f)} · ${sel.name}`, sel.pl ? (sel.pl === 's' ? 'простое ✓' : 'сложное ✓') : 'модель: ' + Object.entries(atoms).map(([e, n]) => e + (n > 1 && !['NaCl', 'Fe', 'Cu'].includes(sel.f) ? '×' + n : '')).join(' + '), !!sel.pl);
    } else {
      h.plaque(g, TX, TZ + 10, 22, 3.6, ['Нажмите на баночку'], '#1b1610', '#fff6e6');
    }
    if (!kit.reduce) kit.onFrame((dt, t) => { top.rotation.y = t * 0.45; });
    tag(v3(-30, TY + 31, -28), 'Простые', `${ns} шт.`);
    tag(v3(30, TY + 31, -28), 'Сложные', `${nc} шт.`);
  };
})();
