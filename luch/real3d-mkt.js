// «Как в жизни» для темы «Молекулярная физика» (labs/phys-mkt): стеклянный сосуд 1 л с азотом на нагревателе,
// молекулы-шарики, манометр и баллончик подкачки; баллон на весах с компрессором, манометром на вентиле и стойкой
// баллонов с разными газами; стеклянный цилиндр с поршнем (термостат, груз или упоры, горелка) и доска с графиком p(V).
// Сцены строятся из window.LUCH_REAL() опыта; дрожащий манометр и струя компрессора — из LUCH_REAL.live() в onFrame.
(() => {
  const SC = window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {};
  const live = () => { try { return (window.LUCH_REAL && window.LUCH_REAL.live && window.LUCH_REAL.live()) || {}; } catch (e) { return {}; } };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (x, n = 0) => { let s = (Math.round(x * 10 ** n) / 10 ** n).toFixed(n); if (/^-0(\.0+)?$/.test(s)) s = s.slice(1); return s.replace('.', ',').replace('-', '−'); };
  const nf = x => fmt(x, Math.abs(x - Math.round(x)) < 1e-9 ? 0 : (Math.abs(x * 10 - Math.round(x * 10)) < 1e-9 ? 1 : 2));
  const rnd = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const smooth = t => t * t * (3 - 2 * t);
  const now = () => performance.now() / 1000;
  const mem = {};                     // что было до перестройки сцены (молекулы, положение поршня)
  // цвет «горячести», как на схеме: синий → голубой → янтарный → красный
  const STOPS = [[74, 143, 224], [114, 212, 232], [255, 181, 71], [255, 90, 60]];
  const hcol = (T, u) => {
    u = clamp(u, 0, 1) * (STOPS.length - 1); const i = Math.min(STOPS.length - 2, Math.floor(u)), f = u - i;
    const c = STOPS[i].map((v, k) => (v + (STOPS[i + 1][k] - v) * f) / 255);
    return new T.Color(c[0], c[1], c[2]).convertSRGBToLinear();
  };
  // подпись, у которой значение меняется каждый кадр (без перестройки сцены)
  const lastTag = () => { const l = document.querySelectorAll('.rl-view .rl-lbl'); return l[l.length - 1] || null; };
  function liveTag(kit, p, name, value, hot) {
    kit.tag(p, name, value, hot);
    const el = lastTag(), i = el && el.querySelector('i');
    let shown = value, hs = !!hot;
    return { set(v, h) { if (i && v !== shown) { shown = v; i.textContent = v; } if (el && h != null && !!h !== hs) { hs = !!h; el.classList.toggle('hot', hs); } } };
  }

  // ---------- общие детали ----------
  function H(kit) {
    const { T, at, box, cyl, mesh, keep, grad, glowTex, textTex, clickable, toon, C } = kit;
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    const glassMat = (color = 0xd8eef8, opacity = 0.24) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, transparent: true, opacity, side: T.DoubleSide, depthWrite: false }));
    const ownMat = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, ...o }));
    const spr = (map, color, opacity, add) => new T.Sprite(keep(new T.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending })));
    const glow = (color, size, opacity) => { const s = spr(glowTex(), color, opacity, true); s.scale.setScalar(size); return s; };
    const flat = (w, h, tex) => new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: keep(tex), transparent: true })));
    const label = (w, h, txt, fg = '#1b1610', bg = '#fff6e6') => flat(w, h, textTex(txt, fg, bg, Math.round(64 * w / h), 64));
    const hitBox = (w, h, d) => new T.Mesh(keep(new T.BoxGeometry(w, h, d)), keep(new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })));
    function rodAB(parent, a, b, r, color, o = {}) {
      const dv = b.clone().sub(a), L = dv.length();
      const m = cyl(r, L, color, { edges: false, ...o });
      m.quaternion.setFromUnitVectors(v3(0, 1, 0), dv.normalize());
      return at(m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, parent);
    }
    // шланг по точкам (возвращает кривую — по ней можно пускать «порции» газа)
    function hose(parent, pts, r, color) {
      const curve = new T.CatmullRomCurve3(pts, false, 'centripetal');
      at(mesh(new T.TubeGeometry(curve, Math.max(24, Math.round(curve.getLength())), r, 10), color, { hull: true, edges: false }), 0, 0, 0, parent);
      return curve;
    }
    // табло: текст можно менять каждый кадр (строки через \n)
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
    // кнопка: колпачок с надписью сверху; on — нажатая (ниже и светлее)
    function button(parent, x, y, z, txt, color, key, w = 4.2, on = false) {
      const b = new T.Group(); at(b, x, y, z, parent);
      const hh = on ? 0.8 : 1.4;
      at(box(w, hh, 3.6, color), 0, hh / 2, 0, b);
      const top = flat(w * 0.86, 2.9, textTex(txt, on ? '#1b1610' : '#ffffff', on ? '#fff6e6' : '#' + color.toString(16).padStart(6, '0'), Math.round(96 * w / 3.6), 96));
      top.rotation.x = -Math.PI / 2; at(top, 0, hh + 0.02, 0, b);
      clickable(b, key); return b;
    }
    // пульт: деревянная планка с кнопками [текст, цвет, ключ, ширина, нажата]
    function panel(parent, x, z, keys, ry = 0) {
      const g = new T.Group(); at(g, x, 0, z, parent); g.rotation.y = ry;
      const gap = 1.4, wsum = keys.reduce((s, k) => s + (k[3] || 6) + gap, -gap);
      at(box(wsum + 4, 2.2, 7, C.WOOD2), 0, 1.1, 0, g);
      let cx = -wsum / 2;
      for (const [t, col, key, w = 6, on] of keys) { button(g, cx + w / 2, 2.2, 0, t, col, key, w, on); cx += w + gap; }
      return g;
    }
    // таблички «сделано»
    function flags(parent, x, z, list) {
      const g = new T.Group(); at(g, x, 0, z, parent);
      const w = 20, n = list.length;
      list.forEach(([t, ok], i) => {
        const xx = (i - (n - 1) / 2) * (w + 2);
        at(box(w, 1.2, 6.5, 0x3b4a66), xx, 0.6, 0, g);
        const pl = label(w - 2.5, 4.6, (ok ? '✓ ' : '') + t, ok ? '#0e2a18' : '#e8ecf4', ok ? '#86e0a8' : '#26324a'); pl.rotation.x = -Math.PI / 2; at(pl, xx, 1.22, 0, g);
      });
      return g;
    }
    // пламя: капля-спрайт, светлое ядро; колышется
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
    function flame(parent, x, y, z, hgt) {
      const g = new T.Group(); at(g, x, y, z, parent);
      const s = spr(flameTex('#d8f0ff', '#4a9cff'), 0xffffff, 0.94, false); s.center.set(0.5, 0.04); s.scale.set(hgt * 0.5, hgt, 1); at(s, 0, 0, 0, g);
      at(glow(0x6ab0ff, hgt * 2.4, 0.5), 0, hgt * 0.35, 0, g);
      at(new T.PointLight(0x6ab0ff, 30, 60, 1.3), 0, hgt * 0.5, 0, g);
      if (!kit.reduce) kit.onFrame((dt, t) => { const f = 1 + 0.13 * Math.sin(t * 13) + 0.06 * Math.sin(t * 29); s.scale.set(hgt * 0.5 * (1 + 0.08 * Math.sin(t * 17)), hgt * f, 1); });
      return g;
    }
    // газовая горелка Бунзена; hgt — высота пламени (0 — выключена)
    function bunsen(parent, x, z, hgt) {
      const g = new T.Group(); at(g, x, 0, z, parent);
      at(cyl(4, 1.2, C.DARK, { seg: 24 }), 0, 0.6, 0, g);
      at(cyl(1.0, 7.4, C.STEEL, { seg: 16 }), 0, 4.9, 0, g);
      at(cyl(1.45, 1.8, C.BRASS, { seg: 16 }), 0, 2.6, 0, g);
      const hs = cyl(0.7, 4, C.STEEL, { seg: 12 }); hs.rotation.z = Math.PI / 2; at(hs, -2.6, 2, 0, g);
      at(cyl(1.2, 0.5, C.DARK, { seg: 16 }), 0, 8.6, 0, g);
      if (hgt > 0) flame(g, 0, 8.9, 0, hgt);
      return g;
    }
    // стеклянный термометр: шарик, столбик, шкала (к зрителю), зелёная метка
    function thermo(parent, x, y0, z, len, lo, hi, v, o = {}) {
      const g = new T.Group(); at(g, x, y0, z, parent);
      at(new T.Mesh(keep(new T.SphereGeometry(1.0, 16, 12)), toon(0xe0473a)), 0, 0, 0, g);
      at(cyl(0.72, len, 0xeef6fb, { matOpt: { transparent: true, opacity: 0.55 } }), 0, len / 2 + 0.5, 0, g);
      at(box(1.05, len - 1.6, 0.1, 0xfffaf0, { edges: false, shadow: false }), 0, len / 2 + 0.7, -0.34, g);
      const col = cyl(0.3, 1, 0xe0473a, { edges: false, hull: false, shadow: false }); at(col, 0, 1, 0.05, g);
      const span = len - 2.2, n = Math.round((hi - lo) / 10);
      for (let k = 0; k <= n; k++) at(box(k % 5 === 0 ? 1.2 : 0.7, 0.13, 0.1, 0x1b1610, { edges: false, shadow: false }), 0.36, 1.1 + span * k / n, 0.64, g);
      if (o.mark != null) at(box(1.9, 0.3, 0.4, 0x2fbf5a, { edges: false, shadow: false }), 0, 1.1 + span * (o.mark - lo) / (hi - lo), 0.55, g);
      const f = clamp((v - lo) / (hi - lo), 0, 1), hh = 0.3 + span * f; col.scale.y = hh; col.position.y = 0.8 + hh / 2;
      return { g, top: y0 + len + 1 };
    }
    // стрелочный манометр (циферблат к +z): шкала 240°, зоны [от, до, цвет], метки [значение, цвет]; set(значение)
    function gauge(parent, x, y, z, r, o) {
      const g = new T.Group(); at(g, x, y, z, parent);
      const body = cyl(r + 0.6, 2.4, 0x3a3f4c, { seg: 40 }); body.rotation.x = Math.PI / 2; at(body, 0, 0, 0, g);
      const ring = mesh(new T.TorusGeometry(r + 0.4, 0.45, 8, 40), C.STEEL, { edges: false, hull: true }); at(ring, 0, 0, 1.25, g);
      const c = document.createElement('canvas'); c.width = c.height = 256; const cx = c.getContext('2d');
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace;
      const a0 = Math.PI * 5 / 6, sw = Math.PI * 4 / 3, ang = v => a0 + sw * clamp(v / o.max, 0, 1.04);
      let cur = null;
      const set = val => {
        const k = Math.round(clamp(val / o.max, 0, 1.04) * 600); if (k === cur) return; cur = k;
        cx.fillStyle = '#f7f3ea'; cx.fillRect(0, 0, 256, 256);
        for (const [v1, v2, col] of o.zones || []) { cx.strokeStyle = col; cx.lineWidth = 14; cx.beginPath(); cx.arc(128, 128, 98, ang(v1), ang(v2)); cx.stroke(); }
        cx.strokeStyle = '#1b1610'; cx.lineWidth = 3; cx.beginPath(); cx.arc(128, 128, 106, a0, a0 + sw); cx.stroke();
        for (let v = 0; v <= o.max + 1e-9; v += o.minor) {
          const major = Math.abs(v / o.major - Math.round(v / o.major)) < 1e-6, a = ang(v), l = major ? 18 : 10;
          cx.lineWidth = major ? 4 : 2; cx.beginPath(); cx.moveTo(128 + Math.cos(a) * 106, 128 + Math.sin(a) * 106); cx.lineTo(128 + Math.cos(a) * (106 - l), 128 + Math.sin(a) * (106 - l)); cx.stroke();
          if (major) { cx.fillStyle = '#1b1610'; cx.font = '600 21px "IBM Plex Mono", monospace'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(String(Math.round(v)), 128 + Math.cos(a) * 70, 128 + Math.sin(a) * 70); }
        }
        for (const [v, col] of o.marks || []) { const a = ang(v); cx.strokeStyle = col; cx.lineWidth = 6; cx.beginPath(); cx.moveTo(128 + Math.cos(a) * 110, 128 + Math.sin(a) * 110); cx.lineTo(128 + Math.cos(a) * 84, 128 + Math.sin(a) * 84); cx.stroke(); }
        cx.fillStyle = '#4a5876'; cx.font = '700 24px "Golos Text", sans-serif'; cx.textAlign = 'center'; cx.fillText(o.unit, 128, 196);
        const a = ang(val);
        cx.strokeStyle = val > (o.danger ?? Infinity) ? '#ff2a1a' : '#c0392b'; cx.lineWidth = 6; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(128, 128); cx.lineTo(128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92); cx.stroke();
        cx.fillStyle = '#1b1610'; cx.beginPath(); cx.arc(128, 128, 11, 0, 7); cx.fill();
        tex.needsUpdate = true;
      };
      set(o.val || 0);
      const face = new T.Mesh(keep(new T.CircleGeometry(r, 48)), keep(new T.MeshBasicMaterial({ map: tex }))); at(face, 0, 0, 1.22, g);
      return { g, set };
    }
    return { v3, glassMat, ownMat, spr, glow, flat, label, hitBox, rodAB, hose, screen, button, panel, flags, flame, bunsen, thermo, gauge };
  }

  // ===== 1. «Идеальный газ»: стеклянный сосуд 1 л на нагревателе, молекулы, манометр, баллончик с азотом =====
  SC['mkt-ideal'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const X = -12, Z = -4, W = 32, HG = 26, D = 22;
    // нагреватель: корпус, раскалённая решётка (ярче при большей T)
    const heat = clamp((d.T - 100) / 800, 0, 1);
    const ht = new T.Group(); at(ht, X, 0, Z, g); clickable(ht, 'T+');
    at(box(W + 6, 5.6, D + 6, 0x3b4a66), 0, 2.8, 0, ht);
    at(box(W + 4, 0.6, D + 4, 0x4a5b7c), 0, 5.9, 0, ht);
    const coilMat = keep(new T.MeshBasicMaterial({ color: new T.Color(0x454e62).lerp(new T.Color(0xff5a2a), heat) }));
    for (let k = -3; k <= 3; k++) { const rr = new T.Mesh(keep(new T.BoxGeometry(W - 2, 0.35, 0.9)), coilMat); at(rr, 0, 6.3, k * 3, ht); }
    if (heat > 0.05) { at(h.glow(0xff6a2a, 30, 0.15 + 0.4 * heat), 0, 8, 0, ht); at(new T.PointLight(0xff7a3a, 10 + 30 * heat, 50, 1.4), 0, 9, 0, ht); }
    const hs = h.screen(10, 3.4, d.T + ' K', '#ffb547'); at(hs, -W / 2 + 4, 2.9, D / 2 + 3.06, ht);
    const knob = cyl(1.8, 1.6, 0xd9dfe9, { seg: 18 }); knob.rotation.x = Math.PI / 2; at(knob, W / 2 - 3, 2.9, D / 2 + 3.8, ht);
    // сосуд: толстое стекло, стальная крышка со штуцером
    const Y0 = 6.6, yb = Y0 + 0.6;
    at(box(W + 1.6, 0.6, D + 1.6, C.STEEL), X, Y0 + 0.3, Z, g);
    const vessel = mesh(new T.BoxGeometry(W, HG, D), 0, { mat: h.glassMat(0xd8eef8, 0.2), edges: true, shadow: false }); at(vessel, X, yb + HG / 2, Z, g);
    at(box(W + 1.6, 1.2, D + 1.6, C.STEEL), X, yb + HG + 0.6, Z, g);
    at(cyl(1.2, 2.6, C.BRASS, { seg: 16 }), X + W / 2 - 4, yb + HG + 2.5, Z, g);
    const lbl = h.label(12, 3, '1 л · N₂', '#1b1610', '#e8f2f8'); at(lbl, X - W / 2 + 7, yb + HG - 3, Z + D / 2 + 0.05, g);
    // молекулы: N шариков, у каждой своя скорость (цвет — как быстро летит)
    const sp0 = Math.sqrt(d.T / 300);
    if (!mem.mol) mem.mol = [];
    while (mem.mol.length < d.N) {
      const i = mem.mol.length, u = rnd(i + 3) * Math.PI * 2, w = rnd(i + 7) * 2 - 1, s = Math.sqrt(1 - w * w);
      mem.mol.push({ x: rnd(i + 11), y: rnd(i + 13), z: rnd(i + 17), vx: Math.cos(u) * s, vy: w, vz: Math.sin(u) * s, f: 0.45 + 1.1 * rnd(i + 19) });
    }
    const geo = keep(new T.SphereGeometry(0.75, 12, 8)), IW = W - 2, IH = HG - 2, ID = D - 2;
    const mols = mem.mol.slice(0, d.N).map(m => {
      const s = new T.Mesh(geo, h.ownMat(0xffffff)); s.material.color.copy(hcol(T, (m.f * sp0 - 0.3) / 1.9)); s.castShadow = false;
      at(s, 0, 0, 0, g); return s;
    });
    // манометр на стойке, трубка от штуцера крышки
    const GX = 26, GY = 26, GZ = -6;
    at(box(9, 1.2, 8, C.DARK), GX, 0.6, GZ, g);
    at(cyl(0.7, GY - 1, C.STEEL, { edges: false }), GX, GY / 2, GZ - 2.2, g);
    const ga = h.gauge(g, GX, GY, GZ, 7.5, { max: 400, major: 100, minor: 25, unit: 'кПа', marks: [[d.p0, '#8b96ad'], [2 * d.p0, '#2fbf5a']], val: d.pk });
    ga.g.rotation.y = -0.35;
    h.hose(g, [v3(X + W / 2 - 4, yb + HG + 3.6, Z), v3(X + W / 2 - 2, yb + HG + 8, Z), v3(GX - 6, GY + 6, GZ - 3), v3(GX, GY + 8.2, GZ - 1.6)], 0.5, 0x2a2f3a);
    // баллончик с азотом: подкачать молекул
    const nb = new T.Group(); at(nb, -50, 0, -22, g); clickable(nb, 'N+');
    at(cyl(4, 22, 0x2b303b, { seg: 28 }), 0, 11, 0, nb);
    at(new T.Mesh(keep(new T.SphereGeometry(4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)), h.ownMat(0x2b303b)), 0, 22, 0, nb);
    at(cyl(1, 3, C.BRASS, { seg: 12 }), 0, 27, 0, nb);
    at(box(3.4, 1.6, 1.6, C.BRASS), 1.6, 28.4, 0, nb);
    const nl = h.label(6, 2.6, 'N₂', '#e8ecf4', '#2b303b'); at(nl, 0, 13, 4.05, nb);
    h.hose(g, [v3(-46.8, 28.4, -22), v3(-40, 31, -18), v3(X - W / 2 + 3, yb + HG + 6, Z), v3(X - W / 2 + 4, yb + HG + 1.2, Z)], 0.45, 0x5d6a86);
    at(cyl(1.1, 1.4, C.BRASS, { seg: 12 }), X - W / 2 + 4, yb + HG + 1.4, Z, g);
    // пульт и таблички
    h.panel(g, X + 2, 30, [['N −', 0x3a7bd5, 'N-'], ['N +', 0x3a7bd5, 'N+'], ['T −', 0xe0473a, 'T-'], ['T +', 0xe0473a, 'T+'], ['сброс', 0x5d6a86, 'reset', 8]]);
    h.flags(g, 35, 36, [['числом N', d.byN], ['нагревом T', d.byT]]);
    // подписи
    kit.tag(v3(X - 6, yb + HG + 6, Z), 'Сосуд 1 л', 'N = ' + d.N + ' точек');
    kit.tag(v3(-50, 34, -22), 'Азот', '+10 точек');
    kit.tag(v3(X - W / 2 - 4, 8, Z + D / 2 + 3), 'Нагреватель', d.T + ' K', d.T !== 300);
    const pTag = liveTag(kit, v3(GX, GY + 11, GZ), 'Манометр', fmt(d.pk, 1) + ' кПа', d.atGoal);
    kit.tag(v3(35, 4, 40), 'Цель', fmt(2 * d.p0, 1) + ' кПа');
    // анимация: молекулы летают и отскакивают от стенок, манометр дрожит от ударов
    const spd = 13 * sp0 * (kit.reduce ? 0 : 1);
    let shown = null;
    const pose = dt => {
      mem.mol.slice(0, d.N).forEach((m, i) => {
        if (dt) {
          const k = spd * m.f * dt;
          m.x += m.vx * k / IW; m.y += m.vy * k / IH; m.z += m.vz * k / ID;
          if (m.x < 0) { m.x = -m.x; m.vx = Math.abs(m.vx); } else if (m.x > 1) { m.x = 2 - m.x; m.vx = -Math.abs(m.vx); }
          if (m.y < 0) { m.y = -m.y; m.vy = Math.abs(m.vy); } else if (m.y > 1) { m.y = 2 - m.y; m.vy = -Math.abs(m.vy); }
          if (m.z < 0) { m.z = -m.z; m.vz = Math.abs(m.vz); } else if (m.z > 1) { m.z = 2 - m.z; m.vz = -Math.abs(m.vz); }
        }
        mols[i].position.set(X - IW / 2 + m.x * IW, yb + 1 + m.y * IH, Z - ID / 2 + m.z * ID);
      });
      const L = live(), pm = kit.reduce || L.pm == null ? d.pk : L.pm;
      ga.set(pm);
      const s = fmt(pm, 1); if (s !== shown) { shown = s; pTag.set(s + ' кПа', d.atGoal); }
    };
    pose(0); kit.onFrame(pose);
  };

  // ===== 2. «Менделеев — Клапейрон»: баллон на весах, компрессор со шлангом, манометр на вентиле, стойка газов =====
  SC['mkt-mend'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    // весы
    const X = -14, Z = 0;
    at(box(26, 3, 22, 0x3b4a66), X, 1.5, Z, g);
    at(box(22, 0.8, 18, C.STEEL), X, 3.4, Z, g);
    const ws = h.screen(12, 3.2, fmt(d.mass, 2) + ' кг', '#86e0a8'); at(ws, X, 1.6, Z + 11.05, g);
    // баллон: размер по объёму, цвет по газу, полоса с формулой
    const r = 3.4 + d.V * 0.08, hb = 13 + d.V * 0.6, y0 = 3.8;
    const cy = new T.Group(); at(cy, X, y0, Z, g); clickable(cy, 'gas');
    at(cyl(r, hb, d.col, { seg: 32 }), 0, hb / 2, 0, cy);
    at(new T.Mesh(keep(new T.SphereGeometry(r, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2)), h.ownMat(d.col)), 0, hb, 0, cy);
    at(cyl(r * 1.02, 1.2, 0x2c3240, { seg: 32, edges: false }), 0, 0.6, 0, cy);
    const band = h.label(r * 1.5, Math.min(5, r * 0.8), d.f, d.txt, d.colS); at(band, 0, hb * 0.55, r + 0.05, cy);
    const top = hb + r;
    at(cyl(r * 0.32, 2.2, C.BRASS, { seg: 16 }), 0, top + 1, 0, cy);
    at(box(3.2, 2.4, 2.4, C.BRASS), 0, top + 3.2, 0, cy);
    const hw = cyl(1.6, 0.6, 0x2c3240, { seg: 16 }); at(hw, 0, top + 4.8, 0, cy);
    const ga = h.gauge(cy, -6.2, top + 3.2, 0.6, 3.6, { max: 25, major: 5, minor: 1, unit: 'МПа', zones: [[d.pNeed - d.tol, d.pNeed + d.tol, '#2fbf5a'], [20, 25, '#e0473a']], danger: 20, val: d.p });
    const sideIn = cyl(0.5, 2, C.BRASS, { seg: 10 }); sideIn.rotation.z = Math.PI / 2; at(sideIn, 2.4, top + 3.2, 0, cy);
    const sideL = cyl(0.5, 2.6, C.BRASS, { seg: 10 }); sideL.rotation.z = Math.PI / 2; at(sideL, -2.8, top + 3.2, 0, cy);
    // компрессор: корпус, мотор, маховик (крутится, пока качает), ресивер
    const KX = 28, KZ = -8;
    const kp = new T.Group(); at(kp, KX, 0, KZ, g); clickable(kp, 'p10');
    at(cyl(5, 22, 0xe0473a, { seg: 28 }), 0, 6.5, 0, kp).rotation.z = Math.PI / 2;
    for (const s of [-1, 1]) at(box(2, 1.6, 10, C.DARK), s * 8, 0.8, 0, kp);
    at(box(9, 7, 8, 0x3b4a66), -4, 15, 0, kp);
    at(cyl(2.4, 9, 0x2c3240, { seg: 20 }), 5, 15, 0, kp).rotation.z = Math.PI / 2;
    const wheel = new T.Group(); at(wheel, 10.4, 15, 0, kp);
    const wd = cyl(4.2, 1.2, 0x9aa3b2, { seg: 24 }); wd.rotation.z = Math.PI / 2; at(wd, 0, 0, 0, wheel);
    for (let k = 0; k < 3; k++) { const sp = box(0.6, 7.6, 0.8, 0x2c3240, { edges: false }); sp.rotation.x = k * Math.PI / 3; at(sp, 0.7, 0, 0, wheel); }
    const kpScr = h.screen(7, 2.6, 'ν ' + d.nu, '#86e0a8'); at(kpScr, -4, 15.5, 4.05, kp);
    // шланг от компрессора к вентилю и «порции» газа в нём
    const vIn = v3(X + 3.4, y0 + top + 3.2, Z);
    const curve = h.hose(g, [v3(KX - 4, 18.5, KZ), v3(KX - 6, 26, KZ + 2), v3(X + 14, y0 + top + 8, Z + 3), v3(X + 7, y0 + top + 4, Z + 1), vIn], 0.6, 0x2a2f3a);
    const puffs = [0, 1, 2, 3, 4].map(() => { const s = h.glow(d.col === 0x2b303b ? 0xa9b4c9 : d.col, 3.2, 0.9); at(s, 0, 0, 0, g); s.visible = false; return s; });
    // стойка с баллонами других газов: нажать — новый пустой баллон
    d.gases.forEach((q, i) => {
      const gx = -52, gz = -30 + i * 10, sel = q.k === d.gas;
      const sg = new T.Group(); at(sg, gx, 0, gz, g); clickable(sg, 'g-' + q.k);
      at(box(8, 1, 8, C.DARK), 0, 0.5, 0, sg);
      if (!sel) {
        at(cyl(2.6, 15, q.col, { seg: 20 }), 0, 8.5, 0, sg);
        at(new T.Mesh(keep(new T.SphereGeometry(2.6, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)), h.ownMat(q.col)), 0, 16, 0, sg);
        at(cyl(0.7, 2, C.BRASS, { seg: 10 }), 0, 19.4, 0, sg);
      } else at(h.hitBox(6, 18, 6), 0, 9, 0, sg);
      const pl = h.label(7, 2.4, q.f, sel ? '#1b1610' : '#e8ecf4', sel ? '#ffd166' : '#26324a'); pl.rotation.x = -Math.PI / 2; at(pl, 0, 1.05, 2.2, sg);
    });
    at(box(1, 22, 44, C.WOOD2), -57, 11, -15, g);
    // объёмы: таблички на столе (новый пустой баллон другого объёма)
    d.vols.forEach((v, i) => {
      const tx = -40 + i * 9, sel = v === d.V, tl = new T.Group(); at(tl, tx, 0, 32, g); clickable(tl, 'v-' + v);
      at(box(8, sel ? 0.8 : 1.4, 6, sel ? 0xffd166 : 0x3b4a66), 0, sel ? 0.4 : 0.7, 0, tl);
      const pl = h.label(7, 3.4, v + ' л', sel ? '#1b1610' : '#e8ecf4', sel ? '#ffd166' : '#3b4a66'); pl.rotation.x = -Math.PI / 2; at(pl, 0, sel ? 0.82 : 1.42, 0, tl);
    });
    // термометр в комнате и кнопки t −/+
    const th = h.thermo(g, 4, 3, -26, 26, -40, 60, d.tc, { mark: 27 });
    at(box(8, 2.4, 6, C.WOOD2), 4, 1.2, -26, g);
    h.panel(g, 2, -14, [['t −', 0x3a7bd5, 't-', 5], ['t +', 0xe0473a, 't+', 5]]);
    // пульт компрессора
    h.panel(g, 26, 22, [['+10 моль', 0x2fbf5a, 'p10', 10], ['+50', 0x2fbf5a, 'p50', 6], ['−10', 0x5d6a86, 'm10', 6], ['выпустить', 0xe0473a, 'empty', 11]]);
    h.flags(g, 26, 40, [['кислород O₂', d.o2], ['гелий He', d.he]]);
    // подписи
    kit.tag(v3(X - r - 3, y0 + hb * 0.6, Z), 'Баллон', d.V + ' л · ' + d.f);
    kit.tag(v3(X - 6.2, y0 + top + 8.5, Z), 'Манометр', fmt(d.p, 2) + ' МПа', d.ok || d.p > 20);
    kit.tag(v3(X, 4, Z + 13), 'Весы', fmt(d.mass, 2) + ' кг');
    kit.tag(v3(KX, 26, KZ), 'Компрессор', 'ν = ' + d.nu + ' моль');
    kit.tag(v3(4, th.top + 3, -26), 'Термометр', d.tc + ' °C = ' + (d.tc + 273) + ' K', d.tc !== 27);
    kit.tag(v3(-52, 24, -15), 'Газы', 'новый баллон');
    // анимация: пока компрессор качает — крутится маховик и бегут порции газа
    const pose = (dt, t) => {
      const on = !kit.reduce && (live().pumpT || 0) > 0;
      if (on) wheel.rotation.x += dt * 14;
      puffs.forEach((s, i) => { s.visible = on; if (on) s.position.copy(curve.getPointAt(((t || 0) * 0.9 + i / puffs.length) % 1)); });
    };
    pose(0, 0); kit.onFrame(pose);
  };

  // ===== 3. «Изопроцессы»: цилиндр с поршнем (термостат / груз / упоры), горелка или лёд, манометр, доска p(V) =====
  const MC = { T: '#1f8fb0', P: '#d98a12', V: '#7a52d6' };
  function pvTex(T, keep, d) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 400; const x = c.getContext('2d');
    x.fillStyle = '#f7f3ea'; x.fillRect(0, 0, 512, 400);
    const X0 = 64, Y0 = 350, kx = 54, ky = 0.8, gx = V => X0 + V * kx, gy = p => Y0 - p * ky;
    x.strokeStyle = '#d9d2c0'; x.lineWidth = 1.5;
    for (let v = 1; v <= 8; v++) { x.beginPath(); x.moveTo(gx(v), Y0); x.lineTo(gx(v), gy(400)); x.stroke(); }
    for (let p = 100; p <= 400; p += 100) { x.beginPath(); x.moveTo(X0, gy(p)); x.lineTo(gx(8), gy(p)); x.stroke(); }
    x.strokeStyle = '#1b1610'; x.lineWidth = 3; x.beginPath(); x.moveTo(X0, gy(410)); x.lineTo(X0, Y0); x.lineTo(gx(8.3), Y0); x.stroke();
    x.fillStyle = '#1b1610'; x.font = '600 20px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let v = 2; v <= 8; v += 2) x.fillText(String(v), gx(v), Y0 + 20);
    x.textAlign = 'right'; for (let p = 100; p <= 400; p += 100) x.fillText(String(p), X0 - 8, gy(p));
    x.font = '700 21px "Golos Text", sans-serif'; x.textAlign = 'left'; x.fillText('p, кПа', X0 + 8, 18); x.textAlign = 'right'; x.fillText('V, л', 500, Y0 - 16);
    // изотерма 300 K пунктиром
    x.setLineDash([6, 6]); x.strokeStyle = 'rgba(31,143,176,.55)'; x.lineWidth = 2; x.beginPath();
    for (let v = 0.75; v <= 8.001; v += 0.05) { const p = 300 / v; if (p > 410) continue; v === 0.75 || p > 400 ? x.moveTo(gx(v), gy(p)) : x.lineTo(gx(v), gy(p)); }
    x.stroke(); x.setLineDash([]);
    // пройденные участки
    const seg = (pts, col) => { x.strokeStyle = col; x.lineWidth = 6; x.lineCap = 'round'; x.beginPath(); pts.forEach(([v, p], i) => i ? x.lineTo(gx(v), gy(p)) : x.moveTo(gx(v), gy(p))); x.stroke(); };
    const rT = d.rng.T, rP = d.rng.P, rV = d.rng.V;
    if (rT[0] !== rT[1]) { const pts = []; for (let v = rT[0]; v <= rT[1] + 1e-9; v += 0.05) pts.push([v, 300 / v]); pts.push([rT[1], 300 / rT[1]]); seg(pts, MC.T); }
    if (rP[0] !== rP[1]) seg([[rP[0], 100], [rP[1], 100]], MC.P);
    if (rV[0] !== rV[1]) seg([[3, rV[0]], [3, rV[1]]], MC.V);
    // цели и начало
    const ring = (v, p, col, ok) => { x.strokeStyle = col; x.lineWidth = 4; x.beginPath(); x.arc(gx(v), gy(p), 11, 0, 7); x.stroke(); if (ok) { x.fillStyle = '#2fbf5a'; x.beginPath(); x.arc(gx(v), gy(p), 7, 0, 7); x.fill(); } };
    ring(1, 300, MC.T, d.isoT); ring(4.5, 100, MC.P, d.isoP); ring(3, 200, MC.V, d.isoV);
    x.fillStyle = '#1b1610'; x.beginPath(); x.arc(gx(3), gy(100), 6, 0, 7); x.fill();
    // текущее состояние
    x.fillStyle = MC[d.mode]; x.strokeStyle = '#1b1610'; x.lineWidth = 3; x.beginPath(); x.arc(gx(d.V), gy(Math.min(d.p, 410)), 11, 0, 7); x.fill(); x.stroke();
    x.font = '700 22px "Golos Text", sans-serif'; x.textAlign = 'right'; x.fillStyle = MC[d.mode]; x.fillText(d.name + ': ' + d.law, 500, 26);
    const t = keep(new T.CanvasTexture(c)); t.colorSpace = T.SRGBColorSpace; return t;
  }
  SC['mkt-iso'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const X = -22, Z = 0, R = 7, K = 3, Y0 = 13, yb = Y0 + 0.8, HW = 8 * K + 3;   // K — единиц на литр
    // опора: в термостате — подставка в баке, иначе — треножник над горелкой
    if (d.mode === 'T') {
      const tank = mesh(new T.BoxGeometry(26, 30, 24), 0, { mat: h.glassMat(0xd8eef8, 0.18), edges: true, shadow: false }); at(tank, X, 15, Z, g);
      const water = new T.Mesh(keep(new T.BoxGeometry(25.4, 26, 23.4)), h.ownMat(0x4f9fe0, { transparent: true, opacity: 0.28, depthWrite: false })); at(water, X, 13.2, Z, g);
      at(box(12, Y0 - 0.2, 12, 0x5d6a86), X, (Y0 - 0.2) / 2, Z, g);
      const th = new T.Group(); at(th, X - 17, 0, Z + 6, g);
      at(box(7, 9, 7, 0xe8ecf4), 0, 4.5, 0, th);
      const sc = h.screen(5.6, 2.4, '300 K', '#86e0a8'); at(sc, 0, 6.2, 3.55, th);
      at(cyl(0.4, 10, C.STEEL, { edges: false }), 4.2, 14, -2, th).rotation.z = -0.5;
    } else {
      const ringY = Y0 - 0.6, rg = mesh(new T.TorusGeometry(R + 2.2, 0.6, 8, 40), 0x3a3f4c, { edges: false, hull: true }); rg.rotation.x = Math.PI / 2; at(rg, X, ringY, Z, g);
      for (const a of [Math.PI / 6, Math.PI * 5 / 6, Math.PI * 1.5]) h.rodAB(g, v3(X + Math.cos(a) * (R + 2.2), ringY, Z + Math.sin(a) * (R + 2.2)), v3(X + Math.cos(a) * (R + 8), 0.3, Z + Math.sin(a) * (R + 8)), 0.6, 0x3a3f4c);
      const f = (d.T - 300) / 400;
      if (f < -0.001) {
        // охлаждение: поднос со льдом под цилиндром
        const ic = new T.Group(); at(ic, X, 0, Z, g); clickable(ic, 'dn');
        at(box(14, 1.6, 12, 0x8fc8e8, { matOpt: { transparent: true, opacity: 0.7 } }), 0, 0.8, 0, ic);
        for (let i = 0; i < 7; i++) { const cb = box(2.6, 2.4, 2.6, 0xe6f6ff, { matOpt: { transparent: true, opacity: 0.85 } }); cb.rotation.y = rnd(i) * 1.5; at(cb, (rnd(i + 3) - 0.5) * 9, 2.6 + (i % 2) * 1.4, (rnd(i + 9) - 0.5) * 7, ic); }
        at(h.glow(0x9fd8ff, 16, 0.3 - f * 0.4), 0, 6, 0, ic);
      } else clickable(h.bunsen(g, X, Z, f > 0.001 ? 2.5 + 6 * f : 0), 'up');
    }
    // цилиндр: металлическое дно, стекло, шкала литров
    at(cyl(R + 1.2, 1.6, C.STEEL, { seg: 32 }), X, Y0, Z, g);
    const wall = new T.Mesh(keep(new T.CylinderGeometry(R + 0.5, R + 0.5, HW, 40, 1, true)), h.glassMat(0xd8eef8, 0.22)); at(wall, X, yb + HW / 2, Z, g);
    const topR = mesh(new T.TorusGeometry(R + 0.6, 0.45, 8, 40), C.STEEL, { edges: false, hull: true }); topR.rotation.x = Math.PI / 2; at(topR, X, yb + HW, Z, g);
    for (let v = 1; v <= 8; v++) {
      at(box(v % 2 ? 0.9 : 1.8, 0.16, 0.1, 0x6f8098, { edges: false, shadow: false }), X - 3, yb + v * K, Z + R + 0.55, g);
      if (v % 2 === 0) at(h.label(2.6, 1.3, v + ' л', '#1b1610', '#e8f2f8'), X - 5.6, yb + v * K, Z + R + 0.7, g);
    }
    // газ и молекулы: цвет — температура
    const heatU = (d.T - 100) / 600;
    const gasMat = h.ownMat(0x72d4e8, { transparent: true, opacity: 0.16, depthWrite: false }); gasMat.color.copy(hcol(T, heatU));
    const gas = new T.Mesh(keep(new T.CylinderGeometry(R - 0.1, R - 0.1, 1, 36)), gasMat); at(gas, X, yb, Z, g);
    const N = 24, mGeo = keep(new T.SphereGeometry(0.75, 12, 8)), mMat = h.ownMat(0xffb547); mMat.color.copy(hcol(T, heatU));
    if (!mem.cyl) mem.cyl = Array.from({ length: N }, (_, i) => { const a = rnd(i + 50) * Math.PI * 2, r = Math.sqrt(rnd(i + 70)) * (R - 1.2), u = rnd(i + 90) * Math.PI * 2, w = rnd(i + 110) * 2 - 1; return { x: Math.cos(a) * r, z: Math.sin(a) * r, y: 0.08 + rnd(i + 30) * 0.84, vx: Math.cos(u) * Math.sqrt(1 - w * w), vy: w, vz: Math.sin(u) * Math.sqrt(1 - w * w) }; });
    const mols = mem.cyl.map(() => { const s = new T.Mesh(mGeo, mMat); s.castShadow = false; at(s, X, yb, Z, g); return s; });
    // поршень со штоком; сверху — ручка (изотерма), груз (изобара) или упоры (изохора)
    const pis = new T.Group(); at(pis, X, 0, Z, g);
    if (d.mode === 'T') clickable(pis, 'dn');
    at(cyl(R - 0.05, 2, 0x8b96ad, { seg: 32 }), 0, 1, 0, pis);
    at(cyl(R + 0.02, 0.6, 0x3a3f4c, { seg: 32, edges: false }), 0, 0.4, 0, pis);
    at(cyl(0.8, 9, C.STEEL, { edges: false }), 0, 2 + 4.5, 0, pis);
    if (d.mode === 'T') {
      at(box(14, 2.2, 2.8, 0x72d4e8), 0, 12, 0, pis);
      for (const s of [-1, 1]) at(cyl(1.3, 3, 0x72d4e8, { seg: 16 }), s * 7, 12, 0, pis).rotation.x = Math.PI / 2;
    } else if (d.mode === 'P') {
      at(cyl(5, 5, 0x2c3240, { seg: 24 }), 0, 13.5, 0, pis);
      at(h.label(5, 1.8, 'груз', '#e8ecf4', '#2c3240'), 0, 13.5, 5.05, pis);
    } else {
      at(cyl(2, 1.2, 0x5d6a86, { seg: 16 }), 0, 11.5, 0, pis);
      // упоры, зажатые на краю цилиндра над поршнем
      const sy = yb + 3 * K + 2.6;
      for (const s of [-1, 1]) {
        at(box(3, 2, 4, 0xc3a8ff), X + s * (R - 1), sy + 1, Z, g);
        at(box(1.6, 5, 4, 0xc3a8ff), X + s * (R + 1.3), sy + 0.5, Z, g);
      }
    }
    // манометр сбоку, трубка ко дну цилиндра
    const GX = -2, GY = 20, GZ = 10;
    at(box(8, 1.2, 7, C.DARK), GX, 0.6, GZ - 2, g);
    at(cyl(0.6, GY - 1, C.STEEL, { edges: false }), GX, GY / 2, GZ - 3, g);
    const ga = h.gauge(g, GX, GY, GZ, 6, { max: 400, major: 100, minor: 25, unit: 'кПа', marks: [[d.target, MC[d.mode]]], val: d.p });
    ga.g.rotation.y = -0.3;
    h.hose(g, [v3(X + R + 1, Y0 + 0.2, Z), v3(X + R + 5, Y0, Z + 2), v3(GX - 3, GY - 4, GZ - 2), v3(GX, GY - 6.6, GZ - 1)], 0.45, 0x2a2f3a);
    // доска с графиком p(V) на мольберте
    const bd = new T.Group(); at(bd, 30, 0, -16, g); bd.rotation.y = -0.18;
    for (const s of [-1, 1]) h.rodAB(bd, v3(s * 16, 0.3, 4), v3(s * 14, 40, 0), 0.6, C.WOOD2);
    h.rodAB(bd, v3(0, 0.3, -8), v3(0, 38, 0), 0.6, C.WOOD2);
    at(box(42, 33, 1.2, C.WOOD2), 0, 24, 0, bd);
    at(new T.Mesh(keep(new T.PlaneGeometry(40, 31.25)), keep(new T.MeshBasicMaterial({ map: pvTex(T, keep, d) }))), 0, 24, 0.62, bd);
    at(box(42, 1, 3, C.WOOD2), 0, 7.2, 1.2, bd);
    // пульт: процесс и шаг
    const t = d.mode === 'T';
    h.panel(g, -14, 30, [['T = const', 0x1f8fb0, 'mT', 9, d.mode === 'T'], ['p = const', 0xd98a12, 'mP', 9, d.mode === 'P'], ['V = const', 0x7a52d6, 'mV', 9, d.mode === 'V'],
      [t ? 'V −' : 'T −', 0x3a7bd5, 'dn', 5.5], [t ? 'V +' : 'T +', 0xe0473a, 'up', 5.5], ['сброс', 0x5d6a86, 'reset', 7]]);
    h.flags(g, 30, 40, [['T = const', d.isoT], ['p = const', d.isoP], ['V = const', d.isoV]]);
    // подписи
    kit.tag(v3(X, yb + HW + 14, Z), d.name, d.law);
    kit.tag(v3(X - R - 6, yb + 4, Z + 4), 'Газ', 'V = ' + nf(d.V) + ' л · T = ' + d.T + ' K', d.T !== 300);
    kit.tag(v3(GX, GY + 9, GZ), 'Манометр', fmt(d.p, 1) + ' кПа');
    kit.tag(v3(30, 44, -16), 'График p(V)', d.done + ' из 3');
    if (d.mode !== 'T') kit.tag(v3(X + 9, 4, Z + 9), d.T > 300 ? 'Горелка' : d.T < 300 ? 'Лёд' : 'Горелка', d.T > 300 ? 'греет' : d.T < 300 ? 'охлаждает' : 'выкл');
    else kit.tag(v3(X - 17, 11, Z + 6), 'Термостат', '300 K');
    // анимация: поршень едет к новому объёму, молекулы летают тем быстрее, чем выше T
    const V0 = mem.V != null && mem.mode === d.mode ? mem.V : d.V, t0 = now(); mem.V = V0; mem.mode = d.mode;
    const sp = 9 * Math.sqrt(d.T / 300) * (kit.reduce ? 0 : 1);
    const pose = dt => {
      const k = kit.reduce ? 1 : clamp((now() - t0) / 0.35, 0, 1), V = V0 + (d.V - V0) * smooth(k); mem.V = V;
      const hg = V * K;
      gas.scale.y = hg; gas.position.y = yb + hg / 2;
      pis.position.y = yb + hg;
      mem.cyl.forEach((m, i) => {
        if (dt) {
          m.x += m.vx * sp * dt; m.z += m.vz * sp * dt; m.y += m.vy * sp * dt / Math.max(3, hg);
          const rr = Math.hypot(m.x, m.z), lim = R - 1.3;
          if (rr > lim) { const nx = m.x / rr, nz = m.z / rr, dot = m.vx * nx + m.vz * nz; if (dot > 0) { m.vx -= 2 * dot * nx; m.vz -= 2 * dot * nz; } m.x = nx * lim; m.z = nz * lim; }
          if (m.y < 0.03) { m.y = 0.03; m.vy = Math.abs(m.vy); } if (m.y > 0.97) { m.y = 0.97; m.vy = -Math.abs(m.vy); }
        }
        mols[i].position.set(X + m.x, yb + 0.7 + m.y * Math.max(0.2, hg - 1.4), Z + m.z);
      });
    };
    pose(0); kit.onFrame(pose);
  };
})();
