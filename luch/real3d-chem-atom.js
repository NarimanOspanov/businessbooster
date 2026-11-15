// «Как в жизни» для тем «Атомы и молекулы» (labs/chem-atoms) и «Строение атома» (labs/chem-atomst):
// учебный кабинет химии. Модель атома на подставке (ядро из красных протонов и серых нейтронов, проволочные
// кольца-оболочки с электронами), лотки с частицами и счётчик, таблица Менделеева на стойке, образцы элементов
// в прозрачных кубиках, ампулах и колбах с подсветкой, витрина металлов со знаками, набор шаростержневых моделей,
// рычажные весы с разновесом, изотопы на весах и счётчик Гейгера, смесь изотопов хлора.
// Сцены строятся из window.LUCH_REAL() опыта; быстрые значения (угол коромысла, вспышки) — из LUCH_REAL.live().
(() => {
  const SC = window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {};
  const live = () => { try { return window.LUCH_REAL.live ? window.LUCH_REAL.live() : null; } catch (e) { return null; } };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rnd = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const SUBD = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
  const SUPD = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻' };
  const low = s => String(s).replace(/\d/g, d => SUBD[d]);
  const sup = s => String(s).replace(/[0-9+-]/g, c => SUPD[c]);
  const EL = ['', 'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne', 'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca'];
  const ELN = ['', 'Водород', 'Гелий', 'Литий', 'Бериллий', 'Бор', 'Углерод', 'Азот', 'Кислород', 'Фтор', 'Неон', 'Натрий', 'Магний', 'Алюминий', 'Кремний', 'Фосфор', 'Сера', 'Хлор', 'Аргон', 'Калий', 'Кальций'];
  const S_BLOCK = { 1: 1, 2: 1, 3: 1, 4: 1, 11: 1, 12: 1, 19: 1, 20: 1 };
  const P_COL = 0xe5533f, N_COL = 0xa9b4c9, E_COL = 0x52c8e6, WIRE = 0x7d889c;
  const TY = 0.4; // верх зелёного настольного коврика
  // атомы в шаростержневых моделях (как в школьном наборе)
  const AT = { H: { c: 0xf2f4f8, r: 1.45 }, C: { c: 0x353a46, r: 2.1 }, N: { c: 0x3f6fe0, r: 2.05 }, O: { c: 0xe0473a, r: 2.05 }, S: { c: 0xf0cc30, r: 2.4 }, Fe: { c: 0xc58a5c, r: 2.7 } };
  // образцы простых веществ Z = 1…20: газ в колбе с подсветкой, металл под керосином, кубик, куски, порошок
  const LOOK = {
    1: { k: 'gas', c: 0xc77cff }, 2: { k: 'gas', c: 0xffae78 }, 3: { k: 'oil', c: 0xc9c9c2 }, 4: { k: 'cube', c: 0xa9afb6 }, 5: { k: 'lump', c: 0x45454e },
    6: { k: 'lump', c: 0x2a2a30 }, 7: { k: 'gas', c: 0xb48cff }, 8: { k: 'gas', c: 0x8fc8ff }, 9: { k: 'gas', c: 0xe6dc6a, tint: 1 }, 10: { k: 'gas', c: 0xff5a2a },
    11: { k: 'oil', c: 0xd6d8dc }, 12: { k: 'cube', c: 0xcfd3d8 }, 13: { k: 'cube', c: 0xdde1e6 }, 14: { k: 'lump', c: 0x6c7488 }, 15: { k: 'powder', c: 0xb5452e },
    16: { k: 'powder', c: 0xf2d23a }, 17: { k: 'gas', c: 0xc8e04a, tint: 1 }, 18: { k: 'gas', c: 0xb070ff }, 19: { k: 'oil', c: 0xd2d2ca }, 20: { k: 'oil', c: 0xdcdad0 },
  };
  // направление на камеру по умолчанию: плоскость модели атома чуть повёрнута к зрителю
  const CAM_AZ = 0.62, CAM_EL = 0.34;

  // ---------- общие детали ----------
  function H(kit) {
    const { T, at, box, cyl, mesh, keep, grad, clickable, toon, C } = kit;
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    const v2 = (x, y) => new T.Vector2(x, y);
    const hexs = c => '#' + c.toString(16).padStart(6, '0');
    const glassMat = (color = 0xd8eef8, opacity = 0.26) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, transparent: true, opacity, side: T.DoubleSide, depthWrite: true }));
    const hullT = keep(kit.hullMat.clone()); hullT.transparent = true;
    const glassy = m => { m.renderOrder = 1; const hm = new T.Mesh(m.geometry, hullT); hm.renderOrder = 2; m.add(hm); return m; };
    const ownMat = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, ...o }));
    const hitMat = keep(new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true, opacity: 0 }));
    const spr = (map, color, opacity, add) => new T.Sprite(keep(new T.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending })));
    let gT = null;
    const glowT = () => {
      if (gT) return gT;
      const k = canvasTex(64, 64), gr = k.x.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      k.x.fillStyle = gr; k.x.fillRect(0, 0, 64, 64); k.tex.needsUpdate = true; gT = k.tex; return gT;
    };
    const glow = (color, size, opacity) => { const s = spr(glowT(), color, opacity, true); s.scale.setScalar(size); return s; };
    function canvasTex(pw, ph) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph;
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      return { c, x: c.getContext('2d'), tex };
    }
    function canvasPlane(w, h, pw, ph, draw) {
      const k = canvasTex(pw, ph);
      const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: k.tex, transparent: true })));
      m.userData.draw = fn => { k.x.clearRect(0, 0, pw, ph); fn(k.x, pw, ph); k.tex.needsUpdate = true; };
      if (draw) m.userData.draw(draw);
      return m;
    }
    const textLines = (x, pw, ph, lines, fg, bg, o = {}) => {
      if (bg) { x.fillStyle = bg; if (o.round) { x.beginPath(); x.roundRect(2, 2, pw - 4, ph - 4, o.round); x.fill(); } else x.fillRect(0, 0, pw, ph); }
      if (o.border) { const bw = o.bw || 6; x.strokeStyle = o.border; x.lineWidth = bw; x.beginPath(); x.roundRect(bw / 2, bw / 2, pw - bw, ph - bw, o.round || 8); x.stroke(); }
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
    // «таблетка» с текстом, всегда смотрит на зрителя
    function pill(parent, x, y, z, txt, fg = '#1b1610', bg = '#fff6e6', hgt = 2.6) {
      const k = canvasTex(8, 8), font = '700 50px "IBM Plex Mono", monospace';
      k.x.font = font; const w = Math.ceil(k.x.measureText(txt).width + 44), pw = Math.max(96, w), ph = 80;
      k.c.width = pw; k.c.height = ph; const cx = k.x;
      cx.fillStyle = bg; cx.strokeStyle = '#1b1610'; cx.lineWidth = 5; cx.beginPath(); cx.roundRect(3, 3, pw - 6, ph - 6, 30); cx.fill(); cx.stroke();
      cx.font = font; cx.fillStyle = fg; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(txt, pw / 2, ph / 2 + 3); k.tex.needsUpdate = true;
      const m = new T.Sprite(keep(new T.SpriteMaterial({ map: k.tex, transparent: true, depthTest: false, depthWrite: false })));
      m.renderOrder = 6; m.center.set(0.5, 0); m.scale.set(hgt * pw / ph, hgt, 1);
      return at(m, x, y, z, parent);
    }
    // буква/число спрайтом без фона
    function letter(parent, x, y, z, txt, size, fg = '#0b1019', o = {}) {
      const k = canvasTex(128, 128); k.x.font = `700 ${txt.length > 2 ? 46 : txt.length > 1 ? 62 : 80}px "IBM Plex Mono", monospace`;
      if (o.halo) { k.x.lineWidth = 12; k.x.strokeStyle = o.halo; k.x.lineJoin = 'round'; k.x.textAlign = 'center'; k.x.textBaseline = 'middle'; k.x.strokeText(txt, 64, 68); }
      k.x.fillStyle = fg; k.x.textAlign = 'center'; k.x.textBaseline = 'middle'; k.x.fillText(txt, 64, 68); k.tex.needsUpdate = true;
      const s = new T.Sprite(keep(new T.SpriteMaterial({ map: k.tex, transparent: true, depthWrite: false, depthTest: !o.top })));
      s.renderOrder = o.top ? 5 : 4; s.scale.setScalar(size);
      return at(s, x, y, z, parent);
    }
    function rodAB(parent, a, b, r, color, o = {}) {
      const dv = b.clone().sub(a), L = dv.length();
      const m = cyl(r, L, color, { edges: false, ...o });
      m.quaternion.setFromUnitVectors(v3(0, 1, 0), dv.normalize());
      return at(m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, parent);
    }
    const sgeo = {};
    const sphereGeo = r => sgeo[r] || (sgeo[r] = keep(new T.SphereGeometry(r, 18, 12)));
    // шарик в мультяшном стиле с контуром по силуэту (геометрия общая)
    function ball(parent, x, y, z, r, col, o = {}) {
      const m = new T.Mesh(sphereGeo(r), o.mat || toon(col, o.matOpt));
      m.castShadow = o.shadow !== false; m.add(new T.Mesh(m.geometry, kit.hullMat));
      return at(m, x, y, z, parent);
    }
    // плоская клавиша с надписью сверху
    function key(parent, x, z, w, dd, lines, color, keyName, o = {}) {
      const b = new T.Group(); at(b, x, o.y ?? TY, z, parent);
      at(box(w, 1.6, dd, color), 0, 0.8, 0, b);
      const top = canvasPlane(w * 0.9, dd * 0.8, Math.round(70 * w / dd * 1.4), 112, (cx, a, bb) => textLines(cx, a, bb, [].concat(lines), o.fg || '#ffffff', hexs(color)));
      top.rotation.x = -Math.PI / 2; at(top, 0, 1.62, 0, b);
      if (o.on) at(box(w + 1.2, 0.5, dd + 1.2, 0xffd166, { edges: false }), 0, 0.25, 0, b);
      if (keyName) clickable(b, keyName); return b;
    }
    // табличка на ножке, чуть откинута назад, лицом к зрителю (+z)
    function plate(parent, x, z, w, hh, lines, o = {}) {
      const g = new T.Group(); at(g, x, o.y ?? TY, z, parent);
      at(box(w * 0.6, 0.8, 3, o.foot ?? 0x2c3240), 0, 0.4, -0.6, g);
      const pw = Math.round(Math.min(1024, 90 * w)), ph = Math.round(pw * hh / w);
      const pl = canvasPlane(w, hh, pw, ph, (cx, a, b) => o.draw ? o.draw(cx, a, b) : textLines(cx, a, b, lines, o.fg || '#1b1610', o.bg || '#fff6e6', { round: 16, border: '#1b1610', bw: 5 }));
      const back = box(w + 0.4, hh + 0.4, 0.4, o.foot ?? 0x2c3240, { edges: false });
      const tilt = o.tilt ?? 0.22;
      const hold = new T.Group(); at(hold, 0, 0.8, 0, g); hold.rotation.x = -tilt;
      at(back, 0, hh / 2 + 0.2, -0.25, hold); at(pl, 0, hh / 2 + 0.2, 0, hold);
      g.userData.plane = pl; g.userData.top = (o.y ?? TY) + 0.8 + hh * Math.cos(tilt);
      return g;
    }
    // тёмный прибор с экраном на передней стенке
    function screenBox(parent, x, z, w, hh, dd, lines, o = {}) {
      const g = new T.Group(); at(g, x, o.y ?? TY, z, parent);
      at(box(w, hh, dd, o.body ?? 0x2c3240), 0, hh / 2, 0, g);
      const pw = Math.round(Math.min(1024, 70 * w)), ph = Math.round(pw * (hh - 1.6) / (w - 1.6));
      const sc = canvasPlane(w - 1.6, hh - 1.6, pw, ph, (cx, a, b) => o.draw ? o.draw(cx, a, b) : textLines(cx, a, b, lines, o.fg || '#86e0a8', '#0e1520'));
      at(sc, 0, hh / 2, dd / 2 + 0.05, g);
      g.userData.screen = sc;
      return g;
    }
    // пульсирующее кольцо «сюда»
    function beacon(parent, x, y, z, r, col = 0xffd166) {
      const m = new T.Mesh(keep(new T.RingGeometry(r * 0.78, r, 40)), keep(new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthWrite: false, side: T.DoubleSide })));
      m.rotation.x = -Math.PI / 2; at(m, x, y + 0.16, z, parent);
      if (!kit.reduce) kit.onFrame((dt, t) => { const k = 0.5 + 0.5 * Math.sin(t * 4); m.material.opacity = 0.35 + 0.55 * k; m.scale.setScalar(1 + 0.06 * k); });
      return m;
    }
    // зелёный настольный коврик кабинета
    function mat(g) {
      at(box(126, TY, 90, 0x3f6e5c, { edges: false }), 0, TY / 2, 4, g);
      at(box(126, 0.12, 0.6, 0x5f9078, { edges: false, shadow: false }), 0, TY + 0.06, -40.6, g);
      at(box(126, 0.12, 0.6, 0x5f9078, { edges: false, shadow: false }), 0, TY + 0.06, 48.6, g);
    }

    // ----- ядро: протоны и нейтроны плотно упакованы (раскладка не зависит от времени) -----
    function nucPts(p, n) {
      const N = p + n, pts = [];
      for (let i = 0; i < N; i++) {
        const f = (i + 0.5) / N, r = N === 1 ? 0 : Math.cbrt(f) * Math.cbrt(N) * 0.62;
        const yy = 1 - 2 * f, rr = Math.sqrt(Math.max(0, 1 - yy * yy)), a = i * 2.39996;
        pts.push({ x: Math.cos(a) * rr * r, y: yy * r, z: Math.sin(a) * rr * r, isP: Math.floor((i + 1) * p / N) > Math.floor(i * p / N) });
      }
      for (let it = 0; it < 70; it++) {
        for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
          const a = pts[i], b = pts[j]; let dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z; const dd = Math.hypot(dx, dy, dz) || 1e-3;
          if (dd < 1) { const k = (1 - dd) / 2 / dd; dx *= k; dy *= k; dz *= k; a.x -= dx; a.y -= dy; a.z -= dz; b.x += dx; b.y += dy; b.z += dz; }
        }
        for (const q of pts) { q.x *= 0.97; q.y *= 0.97; q.z *= 0.97; }
      }
      return pts;
    }
    function nucleus(parent, p, n, rb, o = {}) {
      const g = new T.Group(); parent.add(g);
      const pts = nucPts(p, n), d = rb * 2 * 0.96, balls = [];
      let R = rb;
      pts.forEach((q, i) => {
        const b = ball(g, q.x * d, q.y * d, q.z * d, rb, q.isP ? P_COL : N_COL, { shadow: o.shadow });
        balls.push({ b, x: q.x * d, y: q.y * d, z: q.z * d, ph: rnd(i + 3) * 6.28 });
        R = Math.max(R, Math.hypot(q.x * d, q.y * d, q.z * d) + rb);
      });
      if (o.jitter && !kit.reduce) kit.onFrame((dt, t) => { for (const q of balls) { const j = o.jitter * Math.sin(t * 9 + q.ph); q.b.position.set(q.x + j, q.y + j * 0.6, q.z - j * 0.5); } });
      return { g, R, balls };
    }
    // ----- модель атома на подставке: ядро в центре, проволочные кольца, электроны бегут по кольцам -----
    function atom(parent, x, z, o) {
      const g = new T.Group(); at(g, x, TY, z, parent);
      const nu0 = new T.Group();
      const nuc = nucleus(nu0, o.p, o.n, o.rb || 1.15, { jitter: o.jitter });
      const R = Math.max(2.2, nuc.R), nR = Math.max(1, o.rings);
      const ringR = k => R + (o.r0 ?? 3.6) + k * (o.dr ?? 4.3);
      const Rmax = ringR(nR - 1), Y = o.Y ?? Rmax + 6;
      // подставка: тяжёлое основание, стойка до ядра
      at(cyl(Rmax * 0.42, 1.6, 0x2c3240, { seg: 40 }), 0, 0.8, 0, g);
      at(cyl(Rmax * 0.34, 0.5, C.WOOD2, { seg: 40, edges: false }), 0, 1.85, 0, g);
      at(cyl(0.55, Y - 1.6, C.STEEL, { edges: false }), 0, 1.6 + (Y - 1.6) / 2 - R * 0.4, 0, g);
      const pl = new T.Group(); at(pl, 0, Y, 0, g);
      const dir = v3(Math.sin(CAM_AZ) * Math.cos(CAM_EL), Math.sin(CAM_EL), Math.cos(CAM_AZ) * Math.cos(CAM_EL));
      pl.quaternion.setFromUnitVectors(v3(0, 0, 1), dir);
      pl.add(nu0);
      // проволочная рамка, на которой держатся кольца
      rodAB(pl, v3(0, -Rmax - 0.4, 0), v3(0, -R + 0.2, 0), 0.16, WIRE, { hull: false });
      rodAB(pl, v3(0, R - 0.2, 0), v3(0, Rmax + 0.4, 0), 0.16, WIRE, { hull: false });
      const rings = [], rgs = [];
      for (let k = 0; k < nR; k++) {
        const rm = ownMat(o.ringCol ? o.ringCol(k) : WIRE, { emissive: 0x000000 });
        const tr = new T.Mesh(keep(new T.TorusGeometry(ringR(k), 0.26, 8, 96)), rm); tr.castShadow = true; tr.add(new T.Mesh(tr.geometry, kit.hullMat)); pl.add(tr);
        rings.push(tr);
        if (o.ringKey) { const hg = new T.Group(); pl.add(hg); hg.add(new T.Mesh(keep(new T.TorusGeometry(ringR(k), 1.5, 6, 64)), hitMat)); clickable(hg, o.ringKey(k)); }
        const rg = new T.Group(); pl.add(rg); rgs.push(rg);
        const cnt = (o.sh || [])[k] || 0, es = [];
        for (let j = 0; j < cnt; j++) {
          const a = j * Math.PI * 2 / cnt + k * 0.3 + Math.PI / 2, eg = new T.Group(); at(eg, Math.cos(a) * ringR(k), Math.sin(a) * ringR(k), 0, rg);
          ball(eg, 0, 0, 0, o.er || 0.85, o.eCol ?? E_COL);
          if (o.eKey) clickable(eg, o.eKey(k));
          es.push(eg);
        }
        rg.userData.es = es;
      }
      if (!kit.reduce) kit.onFrame((dt, t) => { rgs.forEach((rg, k) => { rg.rotation.z = t * (0.85 / (k + 1)) * (k % 2 ? -1 : 1); }); });
      return { g, pl, Y, R, Rmax, ringR, rings, rgs, nuc, top: Y + Rmax };
    }
    // лоток с частицами: кучка шариков, табличка спереди
    function tray(parent, x, z, col, rb, lines, keyName, n = 7) {
      const g = new T.Group(); at(g, x, TY, z, parent);
      at(box(12, 1, 9.5, 0xf4f6f9), 0, 0.5, 0, g);
      at(box(12, 2.6, 0.6, 0xdfe5ec), 0, 1.8, -4.45, g); at(box(12, 1.8, 0.6, 0xdfe5ec), 0, 1.4, 4.45, g);
      at(box(0.6, 2.6, 8.3, 0xdfe5ec), -5.7, 1.8, 0, g); at(box(0.6, 2.6, 8.3, 0xdfe5ec), 5.7, 1.8, 0, g);
      for (let i = 0; i < n; i++) {
        const a = i * 2.39996 + 0.4, r = i ? Math.min(3.4, 1.4 + i * 0.35) : 0, up = i > 4 ? 1 : 0;
        ball(g, Math.cos(a) * r * (up ? 0.45 : 1), 1 + rb + up * rb * 1.5, Math.sin(a) * r * 0.75 * (up ? 0.45 : 1), rb, col);
      }
      const lb = canvasPlane(11, 1.9, 600, 104, (cx, a, b) => textLines(cx, a, b, [].concat(lines), '#1b1610', '#fff6e6'));
      at(lb, 0, 1.25, 4.8, g);
      if (keyName) clickable(g, keyName);
      return g;
    }
    // таблица Менделеева (первые 20 элементов, короткая форма) на стойке у задней стены
    function board(parent, x, z, hiZ, o = {}) {
      const W = o.w || 44, Hh = W * 0.58, y0 = o.y0 ?? 7, g = new T.Group(); at(g, x, TY, z, parent);
      for (const sx of [-1, 1]) { at(box(1.4, y0 + Hh * 0.5, 1.4, C.DARK), sx * (W / 2 - 3), (y0 + Hh * 0.5) / 2, -0.6, g); at(box(3, 0.8, 7, C.DARK), sx * (W / 2 - 3), 0.4, 0, g); }
      at(box(W + 1.6, Hh + 1.6, 1, C.WOOD2), 0, y0 + Hh / 2, 0, g);
      const pw = 1024, ph = Math.round(pw * Hh / W);
      const pl = canvasPlane(W, Hh, pw, ph, (cx, a, b) => {
        cx.fillStyle = '#f7f3e8'; cx.fillRect(0, 0, a, b);
        cx.fillStyle = '#1b1610'; cx.font = '700 40px "Golos Text", sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
        cx.fillText('ПЕРИОДИЧЕСКАЯ СИСТЕМА ЭЛЕМЕНТОВ', a / 2, 40);
        const top = 104, left = 50, cw = (a - left - 14) / 8, ch = (b - top - 14) / 4;
        cx.font = '600 24px "IBM Plex Mono", monospace'; cx.fillStyle = '#6b5a44';
        ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'].forEach((r, i) => cx.fillText(r, left + cw * (i + 0.5), 86));
        for (let r = 0; r < 4; r++) cx.fillText(String(r + 1), 26, top + ch * (r + 0.5));
        const pos = z => z === 1 ? [0, 0] : z === 2 ? [7, 0] : z <= 10 ? [z - 3, 1] : z <= 18 ? [z - 11, 2] : [z - 19, 3];
        for (let zz = 1; zz <= 20; zz++) {
          const [c, r] = pos(zz), X = left + c * cw, Yy = top + r * ch, hot = zz === hiZ;
          cx.fillStyle = hot ? '#ffd166' : S_BLOCK[zz] ? '#f6cdd3' : '#f8e6a6';
          cx.fillRect(X + 3, Yy + 3, cw - 6, ch - 6);
          cx.strokeStyle = hot ? '#d0421c' : '#1b1610'; cx.lineWidth = hot ? 9 : 3; cx.strokeRect(X + 3, Yy + 3, cw - 6, ch - 6);
          cx.fillStyle = '#1b1610'; cx.textAlign = 'left'; cx.font = '600 22px "IBM Plex Mono", monospace'; cx.fillText(String(zz), X + 12, Yy + 22);
          cx.textAlign = 'center'; cx.font = `700 ${ch * 0.42 | 0}px "IBM Plex Mono", monospace`; cx.fillText(EL[zz], X + cw / 2, Yy + ch * 0.5);
          cx.font = `500 ${Math.min(17, ch * 0.16) | 0}px "Golos Text", sans-serif`; cx.fillStyle = '#3a2c1c'; cx.fillText(ELN[zz], X + cw / 2, Yy + ch * 0.82);
        }
      });
      at(pl, 0, y0 + Hh / 2, 0.52, g);
      return { g, top: y0 + Hh + 1, H: Hh, y0 };
    }
    // прозрачный кубик-витрина
    function acrylic(parent, s, y = 0) {
      const m = new T.Mesh(keep(new T.BoxGeometry(s, s, s)), glassMat(0xe6f4fb, 0.2)); m.renderOrder = 1;
      m.add(new T.LineSegments(keep(new T.EdgesGeometry(m.geometry)), kit.edgeMat));
      return at(m, 0, y + s / 2, 0, parent);
    }
    // образец простого вещества
    function sample(parent, x, z, look, o = {}) {
      const g = new T.Group(); at(g, x, o.y ?? TY, z, parent);
      const s = o.s || 1, top = { v: 0 };
      if (look.k === 'gas') {
        // круглая колба на подставке с лампой: светится разрядом своего цвета
        at(cyl(4.4 * s, 2 * s, 0x2c3240, { seg: 32 }), 0, s, 0, g);
        at(cyl(3 * s, 0.4 * s, 0xfff4d0, { edges: false, hull: false, matOpt: { emissive: 0xffe9a8, emissiveIntensity: 0.8 } }), 0, 2.2 * s, 0, g);
        const R = 4.6 * s, cy = 2.4 * s + R;
        const fl = new T.Mesh(keep(new T.SphereGeometry(R, 28, 20)), glassMat(0xe6f4fb, 0.22)); at(fl, 0, cy, 0, g); glassy(fl);
        const gas = new T.Mesh(keep(new T.SphereGeometry(R * 0.93, 24, 16)), keep(new T.MeshBasicMaterial({ color: look.c, transparent: true, opacity: look.tint ? 0.42 : 0.3, depthWrite: false })));
        at(gas, 0, cy, 0, g);
        at(cyl(1.3 * s, 4 * s, 0xe6f4fb, { matOpt: { transparent: true, opacity: 0.35 } }), 0, cy + R + 1.4 * s, 0, g);
        at(cyl(1.5 * s, 1.6 * s, 0x8a5a3a, { r2: 1.25 * s }), 0, cy + R + 3.6 * s, 0, g);
        const gl = glow(look.c, R * 3.6, look.tint ? 0.35 : 0.75); at(gl, 0, cy, 0, g);
        const li = new T.PointLight(look.c, look.tint ? 6 : 16, 34, 1.6); at(li, 0, cy, 0, g);
        if (!kit.reduce) kit.onFrame((dt, t) => { const k = 0.85 + 0.15 * Math.sin(t * 2.3 + x); gl.material.opacity = (look.tint ? 0.35 : 0.75) * k; });
        top.v = cy + R + 4.4 * s;
      } else if (look.k === 'oil') {
        // кусочки металла под слоем керосина в банке
        const r = 3.6 * s, hh = 8 * s;
        const wall = new T.Mesh(keep(new T.CylinderGeometry(r, r, hh, 28, 1, true)), glassMat(0xe6f4fb, 0.28)); at(wall, 0, hh / 2, 0, g); glassy(wall);
        at(cyl(r, 0.5 * s, 0xe6f4fb, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.5 } }), 0, 0.25 * s, 0, g);
        at(cyl(r - 0.35, hh * 0.68, 0xf2d88a, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.38, depthWrite: false } }), 0, 0.5 * s + hh * 0.34, 0, g);
        for (let i = 0; i < 4; i++) { const p = box(1.8 * s, 1.1 * s, 1.5 * s, look.c, { edges: true }); p.rotation.set(rnd(i + 2) * 0.6, rnd(i + 4) * 3, rnd(i + 6) * 0.4); at(p, (i % 2 ? 1 : -1) * 1.1 * s, 1.1 * s + (i > 1 ? 1 : 0) * s, (i < 2 ? -1 : 0.8) * 0.9 * s, g); }
        at(cyl(r + 0.3, 1.4 * s, 0x2c3240, { seg: 28 }), 0, hh + 0.7 * s, 0, g);
        top.v = hh + 1.4 * s;
      } else if (look.k === 'hg') {
        // ртуть только в запаянной ампуле
        at(cyl(2.6 * s, 1 * s, 0x2c3240), 0, 0.5 * s, 0, g);
        const pts = []; const r = 1.5 * s, hh = 8 * s;
        for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + i / 8 * Math.PI / 2; pts.push(v2(Math.max(0.001, Math.cos(a) * r), r + Math.sin(a) * r)); }
        pts.push(v2(r, hh)); pts.push(v2(r * 0.5, hh + 1.2 * s)); pts.push(v2(0.3 * s, hh + 3 * s)); pts.push(v2(0.001, hh + 3.3 * s));
        const geo = keep(new T.LatheGeometry(pts, 24));
        const amp = new T.Mesh(geo, glassMat(0xe6f4fb, 0.3)); at(amp, 0, 1 * s, 0, g); glassy(amp);
        const hgm = new T.Mesh(keep(new T.SphereGeometry(r * 0.85, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), ownMat(0xd8dde6, { emissive: 0x8090a0, emissiveIntensity: 0.25 }));
        at(hgm, 0, 1 * s + r, 0, g);
        at(cyl(r * 0.85, 1.2 * s, 0xd8dde6, { edges: false, hull: false, matOpt: { emissive: 0x8090a0, emissiveIntensity: 0.25 } }), 0, 1 * s + r + 0.6 * s, 0, g);
        ball(g, 0, 1 * s + r + 1.35 * s, 0, r * 0.82, 0xe8ecf2, { matOpt: { emissive: 0x8090a0, emissiveIntensity: 0.3 } }).scale.y = 0.3;
        top.v = hh + 4.4 * s;
      } else {
        // кубик металла / куски / порошок в прозрачном кубе
        const S = 6.4 * s;
        at(box(S + 1, 0.8 * s, S + 1, 0x2c3240), 0, 0.4 * s, 0, g);
        acrylic(g, S, 0.8 * s);
        const y0 = 0.8 * s;
        if (look.k === 'cube') {
          const m = box(3.3 * s, 3.3 * s, 3.3 * s, look.c, { matOpt: { emissive: look.c, emissiveIntensity: 0.12 } }); m.rotation.y = 0.5; at(m, 0, y0 + 1.65 * s, 0, g);
          const hl = box(3.0 * s, 0.1, 0.5 * s, 0xffffff, { edges: false, shadow: false, matOpt: { transparent: true, opacity: 0.55 } }); hl.rotation.y = 0.5; at(hl, -0.3 * s, y0 + 3.32 * s, 0.4 * s, g);
        } else if (look.k === 'lump') {
          for (let i = 0; i < 5; i++) { const p = box((1.2 + rnd(i + 1)) * s, (0.9 + rnd(i + 2) * 0.8) * s, (1.1 + rnd(i + 3)) * s, look.c); p.rotation.set(rnd(i + 5) * 0.8, rnd(i + 6) * 3, rnd(i + 7) * 0.8); at(p, (rnd(i + 8) - 0.5) * 3.2 * s, y0 + (0.7 + (i > 2 ? 1 : 0)) * s, (rnd(i + 9) - 0.5) * 3.2 * s, g); }
        } else {
          at(cyl(2.6 * s, 1.2 * s, 0xf4f1e8, { edges: false }), 0, y0 + 0.6 * s, 0, g);
          at(cyl(2.3 * s, 1.6 * s, look.c, { r2: 0.6 * s, edges: false }), 0, y0 + 2 * s, 0, g);
        }
        top.v = y0 + S;
      }
      g.userData.top = (o.y ?? TY) + top.v;
      return g;
    }
    // знак радиационной опасности (трилистник)
    function trefoilTex() {
      const k = canvasTex(256, 256), x = k.x;
      x.fillStyle = '#ffd21f'; x.beginPath(); x.moveTo(128, 8); x.lineTo(250, 236); x.lineTo(6, 236); x.closePath(); x.fill();
      x.lineWidth = 10; x.strokeStyle = '#1b1610'; x.stroke();
      x.fillStyle = '#1b1610'; const cx = 128, cy = 162;
      [90, 210, 330].forEach(a => { const r = a * Math.PI / 180; x.beginPath(); x.arc(cx, cy, 62, r - Math.PI / 6, r + Math.PI / 6); x.arc(cx, cy, 16, r + Math.PI / 6, r - Math.PI / 6, true); x.closePath(); x.fill(); });
      x.beginPath(); x.arc(cx, cy, 10, 0, Math.PI * 2); x.fill();
      k.tex.needsUpdate = true; return k.tex;
    }
    // шаростержневая модель: атомы-шары, связи-стержни (двойная — два стержня, тройная — три)
    function molecule(parent, syms, pos, bonds, s, o = {}) {
      const g = new T.Group(); parent.add(g);
      const P = pos.map(p => v3(p[0] * s, p[1] * s, p[2] * s));
      for (const [i, j, ord] of bonds) {
        const a = P[i], b = P[j], dv = b.clone().sub(a).normalize();
        let pr = new T.Vector3().crossVectors(dv, v3(0, 0, 1)); if (pr.length() < 0.2) pr = new T.Vector3().crossVectors(dv, v3(0, 1, 0)); pr.normalize();
        const offs = ord === 1 ? [0] : ord === 2 ? [-0.55, 0.55] : [-0.8, 0, 0.8], r = (ord === 1 ? 0.42 : 0.3) * s;
        for (const of of offs) rodAB(g, a.clone().addScaledVector(pr, of * s), b.clone().addScaledVector(pr, of * s), r, 0xd9dee8, { hull: true });
      }
      syms.forEach((sy, i) => {
        const A = AT[sy] || AT.C, bg = new T.Group(); at(bg, P[i].x, P[i].y, P[i].z, g);
        ball(bg, 0, 0, 0, A.r * s, A.c);
        if (o.click) clickable(bg, o.click(sy));
      });
      let minY = 0; P.forEach((p, i) => { minY = Math.min(minY, p.y - (AT[syms[i]] || AT.C).r * s); });
      let minX = 0, maxX = 0; P.forEach((p, i) => { const r = (AT[syms[i]] || AT.C).r * s; minX = Math.min(minX, p.x - r); maxX = Math.max(maxX, p.x + r); });
      return { g, minY, w: maxX - minX };
    }
    return { v3, v2, hexs, glassMat, glassy, ownMat, hitMat, spr, glow, canvasTex, canvasPlane, textLines, pill, letter, rodAB, ball, key, plate, screenBox, beacon, mat, nucleus, atom, tray, board, acrylic, sample, trefoilTex, molecule };
  }

  // =====================================================================================
  // 1. «ХИМИЧЕСКИЙ ЭЛЕМЕНТ» и «ПРОТОНЫ, НЕЙТРОНЫ, ЭЛЕКТРОНЫ»: модель атома, лотки с частицами,
  //    счётчик, таблица Менделеева с подсвеченным элементом, образец простого вещества
  // =====================================================================================
  function buildAtom(kit, d, mode) {
    const { T, at, tag, clickable } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.mat(g);
    const sh = d.sh || [], AX = -12, AZ = -8;
    const A = h.atom(g, AX, AZ, { p: d.p, n: d.n, sh, rings: Math.max(1, sh.length), rb: 1.5, r0: 4.6, dr: 5.2, er: 1.05, jitter: d.p + d.n > 1 ? 0.09 : 0 });
    // мягкий ореол: нейтральный атом — спокойный, ион — тёплый
    if (d.q !== 0 && d.p) at(h.glow(d.q > 0 ? 0xff8a5a : 0x5ab0ff, A.Rmax * 2.6, 0.18), AX, TY + A.Y, AZ, g);
    const qs = d.q === 0 ? '0' : (d.q > 0 ? '+' : '−') + Math.abs(d.q);
    tag(v3(AX, TY + A.top + 2, AZ), d.p ? (d.ion || d.s) + ' · ' + d.name.toLowerCase() : 'Нет ядра', `A = ${d.A} · заряд ${qs}`, d.p > 0 && d.q === 0);

    // лотки с частицами и клавиши «−»
    const TZ = 30, TX = [-46, -30, -14];
    h.tray(g, TX[0], TZ, P_COL, 1.05, ['p⁺ · протоны'], 'tray-p');
    h.tray(g, TX[1], TZ, N_COL, 1.05, ['n⁰ · нейтроны'], 'tray-n');
    h.tray(g, TX[2], TZ, E_COL, 0.75, ['e⁻ · электроны'], 'tray-e', 9);
    [['−p', 'p-', 0xc24a3a], ['−n', 'n-', 0x6f7a90], ['−e', 'e-', 0x2f8fb0]].forEach(([t, k, c], i) => h.key(g, TX[i], 42, 7, 5, [{ t, k: 0.8, w: 700 }], c, k));
    // счётчик частиц
    const cnt = h.screenBox(g, 6, 34, 18, 9, 7, [], {
      draw: (x, a, b) => {
        x.fillStyle = '#0e1520'; x.fillRect(0, 0, a, b);
        const row = (lab, v, col, i) => { const y = b * (0.19 + i * 0.31); x.font = '700 124px "IBM Plex Mono", monospace'; x.textBaseline = 'middle'; x.textAlign = 'left'; x.fillStyle = col; x.fillText(lab, 40, y + 4); x.textAlign = 'right'; x.fillStyle = '#e8ecf4'; x.fillText(String(v), a - 40, y + 4); };
        row('p⁺', d.p, '#ff8a73', 0); row('n⁰', d.n, '#c3ccdb', 1); row('e⁻', d.e, '#72d4e8', 2);
      },
    });
    cnt.rotation.x = -0.12;
    h.key(g, 6, 44.5, 12, 4.4, [{ t: mode === 'element' ? 'Заново' : 'Сброс', k: 0.66, mono: false, w: 600 }], 0x3b4a66, 'reset');
    // таблица Менделеева у задней стены
    const bd = h.board(g, 32, -32, d.p, { w: 46 });
    tag(v3(32, TY + bd.top + 2, -32), 'Таблица', d.p ? `Z = ${d.p} · ${d.s}` : 'номер = число протонов', false);
    // образец простого вещества (элемент задают протоны)
    const sx = mode === 'element' ? 46 : 50, sz = mode === 'element' ? 14 : 6;
    if (d.p && LOOK[d.p]) {
      const smp = h.sample(g, sx, sz, LOOK[d.p], { s: 1 });
      h.plate(g, sx, sz + 9.5, 12, 4.2, [{ t: d.s, k: 0.78, k2: 1.2 }, { t: d.name, k: 0.62, mono: false, w: 600 }], { tilt: 0.5 });
      if (mode === 'element') tag(v3(sx, smp.userData.top + 2, sz), 'Образец', d.name.toLowerCase(), false);
    } else {
      at(kit.box(9, 0.8, 9, 0x2c3240), sx, TY + 0.4, sz, g);
      h.plate(g, sx, sz + 9.5, 12, 4.2, [{ t: '?', k: 0.8 }], { tilt: 0.5 });
    }
    // «Протоны, нейтроны, электроны»: карточки-цели на подставке
    if (mode === 'particles' && d.targets) {
      d.targets.forEach((t, i) => {
        const x = 25 + i * 14.5, pl = h.plate(g, x, 34, 13.5, 6.4, [{ t: t.nm, k: 0.6, mono: false, w: 600 }, { t: t.got ? '✓ собран' : 'нейтральный', k: 0.55, mono: false, w: 500, c: t.got ? '#1d7a3e' : '#6b5a44' }], { bg: t.got ? '#d6f5df' : '#fff6e6', tilt: 0.3 });
        if (t.got) at(kit.box(13.6, 0.4, 3.4, 0x3fbf6a, { edges: false }), x, TY + 0.2, 33.4, g);
      });
      const ng = d.targets.filter(t => t.got).length;
      tag(v3(39.5, TY + 11, 34), 'Собрать', `${ng} из ${d.targets.length}`, ng === d.targets.length);
    }
  }
  SC['chat-element'] = (kit, d) => buildAtom(kit, d, 'element');
  SC['chat-particles'] = (kit, d) => buildAtom(kit, d, 'particles');

  // =====================================================================================
  // 2. «ЗНАКИ ЭЛЕМЕНТОВ»: витрина металлов в два яруса, плитки со знаками на подносе
  // =====================================================================================
  const METAL = { 'Железо': { k: 'cube', c: 0x8d939c }, 'Медь': { k: 'cube', c: 0xd9824f }, 'Серебро': { k: 'cube', c: 0xe4e7ec }, 'Золото': { k: 'cube', c: 0xf2c53d },
    'Ртуть': { k: 'hg' }, 'Свинец': { k: 'cube', c: 0x646b78 }, 'Цинк': { k: 'cube', c: 0xb3becb }, 'Алюминий': { k: 'cube', c: 0xd5dae1 } };
  SC['chat-symbols'] = (kit, d) => {
    const { T, at, box, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.mat(g);
    // двухъярусная витрина
    const TIER = [{ z: -25, y: 7 }, { z: -10, y: 2.6 }], XS = [-33, -11, 11, 33];
    at(box(96, TIER[0].y, 13, C.WOOD2), 0, TY + TIER[0].y / 2, TIER[0].z, g);
    at(box(96, TIER[1].y, 13, C.WOOD), 0, TY + TIER[1].y / 2, TIER[1].z, g);
    at(box(98, 16, 1.2, C.WOOD2), 0, TY + 8, -32, g);
    const plates = [];
    d.cards.forEach((c, i) => {
      const t = TIER[i >> 2], x = XS[i % 4], y = TY + t.y, z = t.z;
      const cg = new T.Group(); at(cg, 0, 0, 0, g); clickable(cg, 'card-' + i);
      h.sample(cg, x, z - 3, METAL[c.name] || { k: 'cube', c: 0xb0b6c0 }, { y, s: 1.05 });
      if (c.ok) {
        const tl = new T.Group(); at(tl, x + 7.4, y, z - 1, cg); tl.rotation.set(-0.3, -0.25, 0);
        at(box(5.4, 5.4, 1.1, 0xf2f4f8), 0, 2.9, 0, tl);
        const f = h.canvasPlane(4.8, 4.8, 160, 160, (cx, a, b) => h.textLines(cx, a, b, [{ t: c.s, k: 0.7, w: 700 }], '#0b1019', null)); at(f, 0, 2.9, 0.58, tl);
      }
      const pl = h.plate(cg, x - 1.5, z + 3.6, 15, 5, c.ok ? [{ t: c.name, k: 0.74, mono: false, w: 700 }, { t: `${c.s} «${c.pr}»`, k: 0.7 }] : [{ t: c.name, k: 0.8, mono: false, w: 700 }],
        { y, bg: c.ok ? '#d6f5df' : '#fff6e6', tilt: 0.35 });
      plates.push(pl.userData.plane);
      // невидимая зона нажатия на всё место образца
      at(new T.Mesh(kit.keep(new T.BoxGeometry(20, 12, 12)), h.hitMat), x, y + 6, z, cg);
      if (d.sel && !c.ok) h.beacon(cg, x, y, z - 2, 5.2);
    });
    const nOk = d.cards.filter(c => c.ok).length;
    tag(v3(0, TY + 24, -28), 'Витрина металлов', `разложено ${nOk} из ${d.cards.length}`, nOk === d.cards.length);
    // поднос с плитками-знаками
    at(box(100, 1.2, 13, 0xe9edf2), 0, TY + 0.6, 24, g);
    at(box(100, 1.6, 0.8, 0xc9d1da), 0, TY + 1.4, 30.1, g); at(box(100, 1.6, 0.8, 0xc9d1da), 0, TY + 1.4, 17.9, g);
    d.order.forEach((s, i) => {
      if (!d.tiles.includes(s)) return;
      const x = -42 + i * 12, sel = d.sel === s;
      const tg = new T.Group(); at(tg, x, TY + 1.2, 24, g); clickable(tg, 'tile-' + s);
      const body = new T.Group(); tg.add(body);
      at(box(7.6, 1.8, 7.6, 0xf2f4f8), 0, 0.9, 0, body);
      const top = h.canvasPlane(6.8, 6.8, 200, 200, (cx, a, b) => h.textLines(cx, a, b, [{ t: s, k: 0.72, w: 700 }], '#0b1019', null));
      top.rotation.x = -Math.PI / 2; at(top, 0, 1.82, 0, body);
      const fr = h.canvasPlane(6.8, 1.5, 300, 66, (cx, a, b) => h.textLines(cx, a, b, [{ t: s, k: 0.8, w: 700 }], '#0b1019', null)); at(fr, 0, 0.9, 3.82, body);
      if (sel) {
        h.beacon(tg, 0, 0.1, 0, 5.8);
        if (kit.reduce) body.position.y = 2.4; else kit.onFrame((dt, t) => { body.position.y = 2.4 + 0.6 * Math.sin(t * 3); });
        tag(v3(x, TY + 9, 24), 'Знак ' + s, 'нажмите на образец', true);
      }
    });
    h.key(g, 52, 41, 14, 4.6, [{ t: 'Заново', k: 0.66, mono: false, w: 600 }], 0x3b4a66, 'reset');
    // ошибка — табличка вспыхивает красным
    kit.onFrame(() => {
      const L = live(), b = L && L.bad;
      plates.forEach((p, i) => { const k = b && b.i === i && b.age < 0.9 ? 1 - b.age / 0.9 : 0; p.material.color.setRGB(1, 1 - 0.6 * k, 1 - 0.6 * k); });
    });
  };

  // =====================================================================================
  // 3. «ХИМИЧЕСКАЯ ФОРМУЛА»: набор атомов, доска сборки с моделями молекул, табличка с формулой
  // =====================================================================================
  // объёмные координаты атомов в том же порядке, что и в опыте
  const MG = {
    H2: [[-2.3, 0, 0], [2.3, 0, 0]], O2: [[-2.7, 0, 0], [2.7, 0, 0]], N2: [[-2.6, 0, 0], [2.6, 0, 0]],
    O3: [[-4.6, -1.5, 0], [0, 1.4, 0], [4.6, -1.5, 0]],
    H2O: [[0, 1.3, 0], [-3.9, -1.6, 0], [3.9, -1.6, 0]],
    H2O2: [[-3.9, 3.2, 0], [-2.4, 0, 0], [2.4, 0, 0], [3.9, 0, 3.2]],
    CO: [[-2.5, 0, 0], [2.5, 0, 0]], CO2: [[-5.2, 0, 0], [0, 0, 0], [5.2, 0, 0]],
    CH4: [[0, 0, 0], [2.42, 2.42, 2.42], [2.42, -2.42, -2.42], [-2.42, 2.42, -2.42], [-2.42, -2.42, 2.42]],
    NH3: [[0, 1.1, 0], [0, -1.1, 3.9], [3.38, -1.1, -1.95], [-3.38, -1.1, -1.95]],
  };
  const BUILD = ['H', 'C', 'N', 'O'];
  SC['chat-formula'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.mat(g);
    // набор атомов: коробка с четырьмя отделениями
    const KX = -32, KZ = 30;
    at(box(56, 1.4, 15, 0x3b4a66), KX, TY + 0.7, KZ, g);
    BUILD.forEach((s, i) => {
      const x = KX - 21 + i * 14, cg = new T.Group(); at(cg, x, TY + 1.4, KZ, g); clickable(cg, 'atom-' + s);
      at(box(13, 0.4, 13, 0xe9edf2, { edges: false }), 0, 0.2, 0, cg);
      at(box(0.6, 3, 13, 0x2c3a54), -6.6, 1.5, 0, cg); if (i === 3) at(box(0.6, 3, 13, 0x2c3a54), 6.6, 1.5, 0, cg);
      at(box(13, 3, 0.6, 0x2c3a54), 0, 1.5, -6.6, cg); at(box(13, 2.2, 0.6, 0x2c3a54), 0, 1.1, 6.6, cg);
      const A = AT[s], left = d.left[s], cols = 3;
      for (let j = 0; j < left; j++) {
        const cx = (j % cols - 1) * 3.6, cz = (Math.floor(j / cols) - 1) * 3.6, r = Math.min(A.r * 0.78, 1.6);
        h.ball(cg, cx, 0.4 + r + (j >= 9 ? r * 1.6 : 0), cz, r, A.c);
      }
      if (!left) at(box(10, 0.1, 10, 0xd0d6de, { edges: false, shadow: false }), 0, 0.42, 0, cg);
      const lb = h.canvasPlane(12, 2, 520, 86, (cx, a, b) => h.textLines(cx, a, b, [`${s} · осталось ${left}`], '#ffffff', '#2c3a54'));
      at(lb, 0, 1.1, 6.95, cg);
    });
    tag(v3(KX, TY + 9, KZ - 4), 'Набор атомов', 'нажмите — взять атом', false);
    // доска сборки
    const BX = 4, BZ = -2, BW = 64, BD = 22;
    at(box(BW, 1.6, BD, C.WOOD), BX, TY + 0.8, BZ, g);
    at(box(BW - 3, 0.1, BD - 3, 0xd8a86e, { edges: false, shadow: false }), BX, TY + 1.62, BZ, g);
    const y0 = TY + 1.6;
    if (d.mol) {
      const M = MG[d.mol.key] || MG.H2O, k = d.k;
      const probe = new T.Group(); const pm = h.molecule(probe, d.mol.a, M, d.mol.b, 1); const w0 = pm.w;
      const gap = 5, s = Math.min(2.1, (BW - 4) / (k * w0 + (k - 1) * gap));
      let x = BX - (k * w0 + (k - 1) * gap) * s / 2 + w0 * s / 2;
      for (let i = 0; i < k; i++) {
        const mg = new T.Group(); at(mg, x, 0, BZ, g);
        const hy = 6 + 5 * s;
        at(cyl(2.2, 0.8, 0x2c3240, { seg: 20 }), 0, y0 + 0.4, 0, mg);
        at(cyl(0.3, hy - 0.8, C.STEEL, { edges: false }), 0, y0 + 0.8 + (hy - 0.8) / 2 - 1, 0, mg);
        const rot = new T.Group(); at(rot, 0, y0 + hy, 0, mg);
        h.molecule(rot, d.mol.a, M, d.mol.b, s, { click: sy => 'in-' + sy });
        if (!kit.reduce) kit.onFrame((dt, t) => { rot.rotation.y = t * 0.5 + i * 0.8; rot.position.y = y0 + hy + 0.4 * Math.sin(t * 1.3 + i); });
        x += (w0 + gap) * s;
      }
      tag(v3(BX, TY + 30, BZ), 'Молекула', d.mol.name + (k > 1 ? ` × ${k}` : ''), true);
    } else if (d.tot) {
      // атомы россыпью: не соединяются, если такой молекулы нет в справочнике
      let i = 0;
      for (const s of BUILD) for (let j = 0; j < d.c[s]; j++, i++) {
        const col = i % 8, row = Math.floor(i / 8), A = AT[s];
        const bg = new T.Group(); at(bg, BX - 26 + col * 7.4 + (row % 2) * 3.4, y0 + A.r, BZ - 6 + row * 6, g); clickable(bg, 'in-' + s);
        h.ball(bg, 0, 0, 0, A.r, A.c);
        if (!kit.reduce) { const ph = i * 1.7; kit.onFrame((dt, t) => { bg.position.y = y0 + A.r + 0.25 * Math.abs(Math.sin(t * 2 + ph)); }); }
      }
      tag(v3(BX, TY + 12, BZ), 'Поле сборки', 'атомы россыпью', false);
    } else {
      const hint = h.canvasPlane(40, 6, 800, 120, (cx, a, b) => h.textLines(cx, a, b, [{ t: 'положите сюда атомы', k: 0.5, mono: false, w: 500 }], '#7a5534', null));
      hint.rotation.x = -Math.PI / 2; at(hint, BX, y0 + 0.1, BZ, g);
    }
    // табличка с формулой у задней стены
    const fz = -33, fx = 4;
    at(kit.box(1.4, 9, 1.4, C.DARK), fx - 17, TY + 4.5, fz, g); at(kit.box(1.4, 9, 1.4, C.DARK), fx + 17, TY + 4.5, fz, g);
    at(kit.box(42, 13, 1, 0x1a2232), fx, TY + 14, fz, g);
    const F = d.tot ? (d.mol && d.k > 1 ? d.k : '') + low(d.f) : '—', ok = !!d.mol;
    const sc = h.canvasPlane(40, 11.4, 840, 240, (cx, a, b) => h.textLines(cx, a, b, [{ t: F, k: 0.82, k2: 1.7, c: ok ? '#86e0a8' : '#e8ecf4' }, { t: d.mol ? d.mol.name : d.tot ? 'такой молекулы нет в справочнике' : 'соберите молекулу', k: 0.6, mono: false, w: 500, c: ok ? '#86e0a8' : '#aab4c8' }], '#e8ecf4', '#0e1520'));
    at(sc, fx, TY + 14, fz + 0.52, g);
    tag(v3(fx, TY + 23, fz), 'Формула', d.tot ? F : 'пусто', ok);
    // что нужно собрать
    h.plate(g, 46, -24, 14, 9.5, [{ t: 'Собрать', k: 0.6, mono: false, w: 700 }, ...d.built.map(b => ({ t: `${low(b.f)} ${b.got ? '✓' : '·'}`, k: 0.66, c: b.got ? '#1d7a3e' : '#1b1610' }))], { tilt: 0.3 });
    // коэффициент и очистка
    [1, 2, 3].forEach((k, i) => h.key(g, 22 + i * 10, 41, 8, 5, [{ t: '×' + k, k: 0.8, w: 700 }], d.k === k ? 0x2f9e55 : 0x3b4a66, 'k' + k, { on: d.k === k }));
    h.key(g, 55, 41, 12, 5, [{ t: 'Очистить', k: 0.6, mono: false, w: 600 }], 0x6f7a90, 'clear');
  };

  // =====================================================================================
  // 4. «ОТНОСИТЕЛЬНАЯ МАССА»: рычажные весы, модель частицы на левой чашке, гирьки-«единицы» на правой
  // =====================================================================================
  const TD = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(v => v.map(c => c / Math.sqrt(3)));
  const MASSMOL = {
    O: { a: ['O'], p: [[0, 0, 0]], b: [] }, Fe: { a: ['Fe'], p: [[0, 0, 0]], b: [] },
    H2O: { a: ['O', 'H', 'H'], p: MG.H2O, b: [[0, 1, 1], [0, 2, 1]] }, O2: { a: ['O', 'O'], p: MG.O2, b: [[0, 1, 2]] },
    CH4: { a: ['C', 'H', 'H', 'H', 'H'], p: MG.CH4, b: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]] },
    NH3: { a: ['N', 'H', 'H', 'H'], p: MG.NH3, b: [[0, 1, 1], [0, 2, 1], [0, 3, 1]] },
    CO2: { a: ['O', 'C', 'O'], p: MG.CO2, b: [[0, 1, 2], [1, 2, 2]] },
    H2SO4: { a: ['S', 'O', 'O', 'O', 'O', 'H', 'H'], p: [[0, 0, 0], ...TD.map(v => v.map(c => c * 4.3)), TD[0].map(c => c * 7.4), TD[2].map(c => c * 7.4)], b: [[0, 1, 1], [0, 3, 1], [0, 2, 2], [0, 4, 2], [1, 5, 1], [3, 6, 1]] },
  };
  const WSZ = { 1: [0.85, 1.7], 2: [1.0, 2.0], 5: [1.2, 2.5], 10: [1.45, 3.0], 20: [1.7, 3.5], 50: [2.1, 4.3] };
  SC['chat-mass'] = (kit, d) => {
    const { T, at, box, cyl, mesh, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.mat(g);
    const BX = -6, BZ = -6, PY = TY + 30, ARM = 23, HANG = 15;
    // гиря: латунный цилиндр с головкой
    const weight = (parent, v, x, y, z) => {
      const [r, hh] = WSZ[v], wg = new T.Group(); at(wg, x, y, z, parent);
      at(cyl(r, hh, C.BRASS, { seg: 24 }), 0, hh / 2, 0, wg);
      at(cyl(r * 0.45, r * 0.5, C.BRASS, { seg: 16 }), 0, hh + r * 0.15, 0, wg);
      h.ball(wg, 0, hh + r * 0.55, 0, r * 0.42, C.BRASS);
      const lb = h.canvasPlane(r * 1.5, hh * 0.5, 120, 70, (cx, a, b) => h.textLines(cx, a, b, [{ t: String(v), k: 0.8, w: 700 }], '#3a2a08', null));
      at(lb, 0, hh * 0.45, r + 0.04, wg);
      return wg;
    };
    // основание, колонка, шкала стрелки
    at(box(36, 2.4, 13, C.DARK), BX, TY + 1.2, BZ, g);
    for (const sx of [-1, 1]) at(cyl(1.3, 0.8, 0x1b1610), BX + sx * 15, TY + 0.4, BZ + 4.5, g);
    at(cyl(1.3, PY - TY - 2.4, C.STEEL, { edges: false }), BX, TY + 2.4 + (PY - TY - 2.4) / 2, BZ, g);
    const scl = h.canvasPlane(12, 4.6, 360, 138, (x, a, b) => {
      x.fillStyle = '#fff6e6'; x.beginPath(); x.roundRect(2, 2, a - 4, b - 4, 14); x.fill(); x.strokeStyle = '#1b1610'; x.lineWidth = 4; x.stroke();
      for (let k = -4; k <= 4; k++) { const xx = a / 2 + k * 38; x.strokeStyle = k === 0 ? '#2f9e55' : '#1b1610'; x.lineWidth = k === 0 ? 8 : 4; x.beginPath(); x.moveTo(xx, 10); x.lineTo(xx, k % 2 ? 46 : 64); x.stroke(); }
    });
    at(scl, BX, TY + 7.2, BZ + 1.5, g);
    at(box(13, 5.4, 0.6, C.DARK), BX, TY + 7.2, BZ + 1.1, g);
    // коромысло с призмой, стрелкой и крючками
    const beam = new T.Group(); at(beam, BX, PY, BZ, g);
    at(box(ARM * 2 + 2, 2.2, 2, C.BRASS), 0, 0, 0, beam);
    for (const sx of [-1, 1]) at(box(3, 3, 2.6, C.BRASS), sx * ARM, 0, 0, beam);
    at(box(3, 2.4, 2, C.DARK), 0, 0, 0, beam);
    at(cyl(0.3, PY - TY - 9, 0xd0421c, { edges: false }), 0, -(PY - TY - 9) / 2, 1.4, beam);
    for (const sx of [-1, 1]) at(cyl(0.9, 1.4, C.STEEL, { seg: 12 }), sx * ARM, -0.4, 0, beam);
    // чашки висят на нитях и остаются горизонтальными
    const pans = [-1, 1].map(sx => {
      const pg = new T.Group(); g.add(pg);
      const pts = []; for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; pts.push(h.v2(Math.max(0.001, Math.sin(a) * 7.5), 1.6 - Math.cos(a) * 1.6)); }
      const geo = kit.keep(new T.LatheGeometry(pts, 36));
      const dish = new T.Mesh(geo, kit.toon(C.STEEL, { side: T.DoubleSide })); dish.castShadow = true; dish.add(new T.Mesh(geo, kit.hullMat)); at(dish, 0, -HANG, 0, pg);
      for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + 0.5; h.rodAB(pg, v3(0, -0.6, 0), v3(Math.cos(a) * 7.2, -HANG + 1.6, Math.sin(a) * 7.2), 0.09, 0x3a3f4c, { hull: false }); }
      return { pg, sx };
    });
    const place = ang => {
      const a = -ang * Math.PI / 180; beam.rotation.z = a;
      pans.forEach(p => p.pg.position.set(BX + p.sx * ARM * Math.cos(a), PY + p.sx * ARM * Math.sin(a) - 0.4, BZ));
    };
    const L0 = live(); place(L0 && isFinite(L0.ang) ? L0.ang : 0);
    kit.onFrame(() => { const L = live(); if (L && isFinite(L.ang)) place(L.ang); });
    // левая чашка: модель частицы
    const MM = MASSMOL[d.sub] || MASSMOL.H2O, isAtom = MM.a.length === 1;
    const lm = new T.Group(); at(lm, 0, -HANG + 0.2, 0, pans[0].pg);
    const ms = isAtom ? 1.7 : d.sub === 'H2SO4' ? 0.78 : 1.0;
    const mol = h.molecule(lm, MM.a, MM.p, MM.b, ms); mol.g.position.y = -mol.minY;
    if (!kit.reduce) kit.onFrame((dt, t) => { mol.g.rotation.y = t * 0.4; });
    // правая чашка: гирьки (большие в центре, остальные вокруг, лишние сверху)
    const rp = new T.Group(); at(rp, 0, -HANG + 0.25, 0, pans[1].pg);
    const ring = [[0, 0]].concat([0, 1, 2, 3, 4, 5].map(k => [Math.cos(k / 6 * Math.PI * 2 + 0.3) * 4.3, Math.sin(k / 6 * Math.PI * 2 + 0.3) * 4.3]));
    d.w.forEach((v, i) => {
      const base = i < 7 ? i : i - 7, [x, z] = ring[base], below = i < 7 ? 0 : WSZ[d.w[base]][1] + WSZ[d.w[base]][0] * 0.55;
      const wg = weight(rp, v, x, below, z); clickable(wg, 'pw-' + i);
    });
    // разновес в футляре: нажмите на гирьку — положить на правую чашку
    const CX = 40, CZ = 30;
    at(box(32, 3, 13, C.WOOD2), CX, TY + 1.5, CZ, g);
    at(box(30, 0.3, 11, 0x9a2a3a, { edges: false }), CX, TY + 3.05, CZ, g);
    const lid = box(32, 0.8, 13, C.WOOD); lid.rotation.x = -1.25; at(lid, CX, TY + 6.6, CZ - 8.6, g);
    d.wt.forEach((v, i) => {
      const x = CX - 12.5 + i * 5;
      const wg = weight(g, v, x, TY + 3.1, CZ); clickable(wg, 'w-' + v);
      const nb = h.canvasPlane(4.4, 2, 120, 56, (cx, a, b) => h.textLines(cx, a, b, [{ t: String(v), k: 0.8, w: 700 }], '#fff6e6', null)); at(nb, x, TY + 1.5, CZ + 6.55, g);
    });
    // пинцет рядом с разновесом
    const tw = new T.Group(); at(tw, CX + 2, TY + 0.4, CZ - 10.5, g); tw.rotation.y = 0.15;
    h.rodAB(tw, v3(-8, 0.3, -0.5), v3(6, 0.3, -0.15), 0.25, C.STEEL); h.rodAB(tw, v3(-8, 0.3, 0.5), v3(6, 0.3, 0.15), 0.25, C.STEEL);
    tag(v3(CX, TY + 9, CZ), 'Разновес', d.full ? 'на чашке нет места' : 'нажмите — положить', false);
    // выбор частицы и снятие гирек
    h.key(g, -52, 41, 6, 5, [{ t: '‹', k: 0.95, w: 700 }], 0x3b4a66, 'prev');
    h.plate(g, -39.5, 40, 15, 4.6, [{ t: low(d.sub), k: 0.75, w: 700 }], { tilt: 0.6 });
    h.key(g, -27, 41, 6, 5, [{ t: '›', k: 0.95, w: 700 }], 0x3b4a66, 'next');
    h.key(g, -10, 41, 16, 5, [{ t: 'Снять гирьки', k: 0.55, mono: false, w: 600 }], 0x6f7a90, 'wclear');
    // справочник Ar у задней стены
    h.plate(g, 42, -26, 18, 12, [], { tilt: 0.25, draw: (x, a, b) => {
      x.fillStyle = '#fff6e6'; x.beginPath(); x.roundRect(2, 2, a - 4, b - 4, 16); x.fill(); x.strokeStyle = '#1b1610'; x.lineWidth = 5; x.stroke();
      x.fillStyle = '#1b1610'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '700 110px "IBM Plex Mono", monospace'; x.fillText('Ar', a / 2, b * 0.15);
      [['H', 1], ['C', 12], ['N', 14], ['O', 16], ['S', 32], ['Fe', 56]].forEach(([s, v], i) => {
        const cx = a * (i % 2 ? 0.74 : 0.27), cy = b * (0.35 + Math.floor(i / 2) * 0.22);
        x.font = '700 96px "IBM Plex Mono", monospace'; x.fillText(`${s} ${v}`, cx, cy);
      });
    } });
    // подписи
    const sideT = d.bal ? 'равновесие' : d.side > 0 ? 'слева тяжелее' : 'справа тяжелее';
    tag(v3(BX + 6, TY + 4, BZ + 7), 'Весы', sideT, d.bal);
    tag(v3(BX - ARM, PY - HANG + 9, BZ), low(d.sub) + ' · ' + d.name, `${isAtom ? 'Ar' : 'Mr'} = ${d.Mr ?? '?'}`, d.Mr != null);
    tag(v3(BX + ARM, PY - HANG + 9, BZ), 'Гирьки', d.w.length ? `${d.w.join(' + ')} = ${d.sum}` : '0', false);
  };

  // =====================================================================================
  // 5. «ИЗОТОПЫ»: ядро на лабораторных весах, найденные изотопы рядом, счётчик Гейгера, смесь хлора
  // =====================================================================================
  SC['chat-isotopes'] = (kit, d) => {
    const { T, at, box, cyl, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.mat(g);
    // электронные весы: корпус, табло «A», платформа, часовое стекло с ядром
    const scale = (x, z, w, nucP, nucN, txt, o = {}) => {
      const sg = new T.Group(); at(sg, x, TY, z, g);
      const hb = o.hb || 3.6;
      at(box(w, hb, w * 0.8, 0xe9edf2), 0, hb / 2, 0, sg);
      at(cyl(w * 0.34, 0.6, C.STEEL, { seg: 32 }), 0, hb + 0.3, -w * 0.06, sg);
      const dw = w * 0.6, sc = h.canvasPlane(dw, hb * 0.6, 300, Math.round(300 * hb * 0.6 / dw), (cx, a, b) => h.textLines(cx, a, b, [{ t: txt, k: 0.7, w: 700 }], o.fg || '#86e0a8', '#0e1520'));
      at(sc, 0, hb / 2, w * 0.4 + 0.05, sg);
      let nuc = null;
      if (nucP) { const ng = new T.Group(); at(ng, 0, 0, -w * 0.06, sg); nuc = h.nucleus(ng, nucP, nucN, o.rb || 1.1); ng.position.y = hb + 0.6 + nuc.R; }
      return { sg, top: hb + 0.6 + (nuc ? nuc.R * 2 : 0), nuc };
    };
    // главное ядро
    const MX = -6, MZ = 6;
    const main = scale(MX, MZ, 22, d.z, d.n, `A = ${d.A}`, { hb: 4.4, rb: 1.75 });
    tag(v3(MX, TY + main.top + 3, MZ), 'Изотоп ' + sup(d.A) + d.s, d.name, !!d.st);
    // карточка изотопа
    const unstable = !d.st;
    h.plate(g, 20, -10, 16, 11.4, [], { tilt: 0.25, draw: (x, a, b) => {
      x.fillStyle = '#fff6e6'; x.beginPath(); x.roundRect(2, 2, a - 4, b - 4, 18); x.fill(); x.strokeStyle = unstable ? '#d08a1a' : '#2f9e55'; x.lineWidth = 8; x.stroke();
      x.fillStyle = '#1b1610'; x.textBaseline = 'middle'; x.textAlign = 'right'; x.font = '700 64px "IBM Plex Mono", monospace';
      x.fillText(String(d.A), a * 0.42, b * 0.2); x.fillStyle = '#c23a2a'; x.fillText(String(d.z), a * 0.42, b * 0.48);
      x.fillStyle = '#1b1610'; x.textAlign = 'left'; x.font = '700 170px "IBM Plex Mono", monospace'; x.fillText(d.s, a * 0.44, b * 0.36);
      x.textAlign = 'center'; x.font = '600 52px "Golos Text", sans-serif'; x.fillText(d.name, a / 2, b * 0.7);
      x.font = '600 44px "Golos Text", sans-serif'; x.fillStyle = unstable ? '#b06a00' : '#1d7a3e'; x.fillText(unstable ? 'радиоактивен · T½ ' + (d.hl || '?') : 'стабилен', a / 2, b * 0.87);
    } });
    if (unstable) {
      const sg = new T.Group(); at(sg, MX - 14, TY, MZ + 8, g);
      at(box(3, 0.8, 3, C.DARK), 0, 0.4, 0, sg); at(cyl(0.25, 5, C.STEEL, { edges: false }), 0, 3, 0, sg);
      const sp = new T.Mesh(kit.keep(new T.PlaneGeometry(6, 6)), kit.keep(new T.MeshBasicMaterial({ map: h.trefoilTex(), transparent: true, side: T.DoubleSide })));
      at(sp, 0, 8, 0.2, sg); sp.rotation.y = 0.3;
    }
    // нейтроны: лоток и клавиша «−n»
    h.tray(g, -46, 22, N_COL, 1.05, ['n⁰ · нейтроны'], 'tray-n');
    h.key(g, -46, 32.5, 9, 4.6, [{ t: '−n', k: 0.8, w: 700 }], 0x6f7a90, 'n2-');
    // выбор элемента
    ['H', 'C', 'Cl'].forEach((s, i) => h.key(g, -50 + i * 10, 42, 8.4, 5, [{ t: s, k: 0.8, w: 700 }], d.s === s ? 0x2f9e55 : 0x3b4a66, 'iso-' + s, { on: d.s === s }));
    // найденные изотопы этого элемента — рядом на маленьких весах
    const sl = d.slots || [], sx0 = -6 - (sl.length - 1) * 8.5;
    sl.forEach((t, i) => {
      const x = sx0 + i * 17, z = -27;
      const m = scale(x, z, 12, t.got ? d.z : 0, t.got ? t.A - d.z : 0, sup(t.A) + d.s, { hb: 2.6, rb: 0.72, fg: t.got ? '#86e0a8' : '#56627d' });
      if (!t.got) h.letter(m.sg, 0, 5.2, -0.7, '?', 3.2, '#8b96ad', { halo: '#0e1520' });
      if (t.cur) h.beacon(g, x, TY, z, 8.2, 0xffd166);
      if (t.got && !t.st) { const tf = new T.Mesh(kit.keep(new T.PlaneGeometry(2.6, 2.6)), kit.keep(new T.MeshBasicMaterial({ map: h.trefoilTex(), transparent: true }))); at(tf, 4.2, 1.4, 4.85, m.sg); }
    });
    tag(v3(-6, TY + 13, -27), 'Найдено', `${d.nf} из 8`, d.nf === 8);
    // счётчик Гейгера: корпус, стрелочный прибор, лампочка, щуп на проводе у ядра
    const GX = 22, GZ = 32, gg = new T.Group(); at(gg, GX, TY, GZ, g); gg.rotation.y = -0.25;
    at(box(14, 7, 8, 0xf2c230), 0, 3.5, 0, gg);
    at(box(14.4, 0.8, 8.4, 0x2c3240), 0, 0.4, 0, gg);
    const dial = h.canvasPlane(8, 4.6, 320, 184, (x, a, b) => {
      x.fillStyle = '#fff6e6'; x.beginPath(); x.roundRect(2, 2, a - 4, b - 4, 12); x.fill(); x.strokeStyle = '#1b1610'; x.lineWidth = 4; x.stroke();
      for (let k = 0; k <= 10; k++) { const an = Math.PI * (1.15 + k * 0.07), r1 = b * 0.82, r2 = k % 5 ? b * 0.7 : b * 0.62; x.beginPath(); x.moveTo(a / 2 + Math.cos(an) * r1, b * 0.95 + Math.sin(an) * r1); x.lineTo(a / 2 + Math.cos(an) * r2, b * 0.95 + Math.sin(an) * r2); x.stroke(); }
      x.fillStyle = '#1b1610'; x.font = '600 26px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.fillText('имп/с', a / 2, b * 0.82);
    });
    at(dial, -1.6, 4.2, 4.03, gg);
    const ndl = new T.Group(); at(ndl, -1.6, 2.2, 4.12, gg);
    at(box(0.22, 3.4, 0.1, 0xd0421c, { edges: false, shadow: false }), 0, 1.7, 0, ndl);
    const led = h.ball(gg, 5, 5.6, 4.1, 0.8, 0x5a2a2a, { matOpt: { emissive: 0xff3a2a, emissiveIntensity: 0 } });
    led.material = h.ownMat(0x7a2a2a, { emissive: 0xff3a2a, emissiveIntensity: 0 });
    at(cyl(0.9, 1, 0x2c3240), 5, 2.6, 4.2, gg).rotation.x = Math.PI / 2;
    // щуп: трубка с решёткой, направлена на ядро
    const PX = MX + 15, PY = TY + 5.6, PZ = MZ + 8;
    const probe = new T.Group(); at(probe, PX, PY, PZ, g);
    const pr = cyl(1.1, 9, 0x3b4a66); pr.rotation.z = Math.PI / 2; at(pr, 0, 0, 0, probe);
    const pc = cyl(1.15, 1.2, 0xc6ccd6, { seg: 16 }); pc.rotation.z = Math.PI / 2; at(pc, -4.9, 0, 0, probe);
    probe.rotation.y = -Math.atan2(MZ - PZ, MX - PX) + Math.PI;
    at(box(3, 1.2 + PY - TY - 1.5, 2, C.DARK), PX + 1.5, TY + (PY - TY) / 2 - 0.4, PZ, g);
    kit.cable(v3(PX + 4.5, PY, PZ), v3(GX - 7, TY + 3, GZ - 1), 0x2c3240, 0, { r: 0.45, arch: 1, lift: 3 });
    const click = h.pill(g, GX + 4, TY + 12, GZ, 'щёлк', '#1b1610', '#ffd166', 2.4); click.visible = false;
    const flash = h.glow(0xfff2a0, 6, 0); at(flash, PX - 5, PY, PZ, g);
    // скорость счёта: распад идёт тем чаще, чем короче период полураспада; у стабильного — только фон
    const hl = String(d.hl || ''), rate = !unstable ? 0.35 : /мин/.test(hl) ? 5 : /с$|⁻/.test(hl) ? 9 : /000/.test(hl) ? 1.4 : /лет/.test(hl) ? 1.8 : /год/.test(hl) ? 2.6 : 3;
    let tick = 0, seed = 1, nd = 0;
    kit.onFrame((dt, t) => {
      if (kit.reduce) { ndl.rotation.z = 0.9 - rate * 0.12; return; }
      seed = (seed * 16807) % 2147483647; const u = seed / 2147483647;
      if (u < rate * dt) tick = 0.09;
      tick = Math.max(0, tick - dt);
      const on = tick > 0;
      led.material.emissiveIntensity = on ? 1.6 : 0; click.visible = on;
      flash.material.opacity = on ? 0.8 : 0;
      nd += ((0.95 - Math.min(9, rate) * 0.15 - (on ? 0.12 : 0)) - nd) * Math.min(1, dt * 6);
      ndl.rotation.z = nd;
    });
    tag(v3(GX + 8, TY + 9, GZ + 3), 'Счётчик Гейгера', unstable ? 'щёлкает: распад' : 'только фон', false);
    // смесь изотопов хлора: два мерных цилиндра с шариками-атомами и табло средней массы
    const MXc = 46, MZc = -8, f = d.mix / 100;
    [[0, f, 0x9fd86a, '³⁵Cl'], [10, 1 - f, 0x4f9a3a, '³⁷Cl']].forEach(([dx, fr, col, lab], i) => {
      const x = MXc - 5 + dx, cg = new T.Group(); at(cg, x, TY, MZc, g);
      at(cyl(4, 1, 0x2c3240, { seg: 24 }), 0, 0.5, 0, cg);
      const wall = new T.Mesh(kit.keep(new T.CylinderGeometry(3, 3, 22, 28, 1, true)), h.glassMat(0xe6f4fb, 0.25)); at(wall, 0, 12, 0, cg); h.glassy(wall);
      const lv = Math.max(0.05, 20 * fr);
      if (fr > 0.004) at(cyl(2.7, lv, col, { edges: false, matOpt: { transparent: true, opacity: 0.85 } }), 0, 1 + lv / 2, 0, cg);
      for (let k = 1; k < 10; k++) at(box(k % 5 ? 0.7 : 1.3, 0.12, 0.1, 0x2c3240, { edges: false, shadow: false }), 1.2, 1 + k * 2, 3.02, cg);
      h.pill(cg, 0, 24.5, 0, `${lab} ${Math.round(fr * 100)} %`, '#1b1610', '#fff6e6', 2.1);
    });
    const md = h.screenBox(g, MXc, MZc + 11, 18, 7, 5, [{ t: `Ar = ${d.avg}`, k: 0.7, k2: 1.4, c: d.ok ? '#86e0a8' : '#ffb547' }, { t: 'в таблице 35,5', k: 0.55, mono: false, w: 500, c: '#aab4c8' }]);
    md.rotation.y = -0.2;
    [['−5', 'mix-5'], ['−1', 'mix-1'], ['+1', 'mix+1'], ['+5', 'mix+5']].forEach(([t, k], i) => h.key(g, 36 + i * 7.6, 24, 6.6, 4.6, [{ t, k: 0.75, w: 700 }], 0x3b4a66, k));
    tag(v3(MXc, TY + 31, MZc), 'Смесь хлора', `Ar = ${d.avg}`, d.ok);
  };

  // =====================================================================================
  // 6. «ЭЛЕКТРОННЫЕ ОБОЛОЧКИ»: большая модель с четырьмя кольцами, заполнение по опыту, вспышка при переходе
  // =====================================================================================
  SC['chat-shells'] = (kit, d) => {
    const { T, at, box, tag, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0); h.mat(g);
    const AX = -8, AZ = -8;
    const ringCol = k => d.ok ? 0x3fbf6a : d.sh[k] >= d.caps[k] ? 0x5b7fb0 : WIRE;
    const A = h.atom(g, AX, AZ, { p: d.z, n: d.n, sh: d.sh, rings: 4, r0: 4.2, dr: 4.6, ringKey: k => 'sh-' + k, eKey: k => 'e3-' + k, er: 0.95, ringCol });
    // номера уровней на кольцах
    for (let k = 0; k < 4; k++) { const a = Math.PI * 1.25, r = A.ringR(k) + 1.6; h.letter(A.pl, Math.cos(a) * r, Math.sin(a) * r, 0.3, String(k + 1), 2.6, '#fff6e6', { halo: '#1b1610' }); }
    h.letter(A.pl, 0, 0, A.R + 0.6, d.s, Math.max(3.2, A.R * 1.3), '#fff6e6', { halo: '#1b1610', top: true });
    const capt = d.ok ? `${d.sh.slice(0, d.sh.findLastIndex(v => v > 0) + 1).join(' · ')} ✓` : d.left > 0 ? `ещё ${d.left} e⁻` : 'что-то не так';
    tag(v3(AX, TY + A.top + 2, AZ), `${d.name} · +${d.z}`, capt, d.ok);
    // табло уровней
    const lv = h.screenBox(g, 42, -16, 20, 15, 6, [], { draw: (x, a, b) => {
      x.fillStyle = '#0e1520'; x.fillRect(0, 0, a, b);
      x.font = '600 66px "Golos Text", sans-serif'; x.fillStyle = '#8b96ad'; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText('УРОВЕНЬ · e⁻', 40, b * 0.1);
      d.sh.forEach((v, k) => {
        const y = b * (0.28 + k * 0.165); x.font = '700 108px "IBM Plex Mono", monospace'; x.textAlign = 'left'; x.fillStyle = '#e8ecf4'; x.fillText(String(k + 1), 40, y);
        x.textAlign = 'right'; x.fillStyle = v >= d.caps[k] ? '#86e0a8' : '#e8ecf4'; x.fillText(`${v} из ${d.caps[k]}`, a - 40, y);
      });
      x.textAlign = 'center'; x.font = '600 74px "Golos Text", sans-serif'; x.fillStyle = d.left ? '#ffb547' : d.ok ? '#86e0a8' : '#e8ecf4'; x.fillText(`осталось ${d.left}`, a / 2, b * 0.93);
    } });
    lv.rotation.y = -0.3;
    // лоток с электронами
    h.tray(g, -46, 28, E_COL, 0.8, [`e⁻ · осталось ${d.left}`], 'et', Math.max(0, Math.min(9, d.left)));
    // выбор элемента и очистка
    d.opts.forEach((o, i) => h.key(g, -22 + i * 11, 42, 9, 5, [{ t: o.s + (o.got ? ' ✓' : ''), k: 0.7, w: 700 }], o.z === d.z ? 0x2f9e55 : 0x3b4a66, 'z-' + o.z, { on: o.z === d.z }));
    h.key(g, 30, 42, 14, 5, [{ t: 'Очистить', k: 0.6, mono: false, w: 600 }], 0x6f7a90, 'clear');
    // вспышка: электрон занял место на кольце; переход на ближний уровень — атом испускает свет
    const fl = h.glow(0x9ff0ff, 10, 0); A.pl.add(fl);
    const ph = h.glow(0xfff0a0, 7, 0); g.add(ph);
    const base = A.rings.map(r => r.material.emissive.getHex());
    kit.onFrame((dt, t) => {
      const L = live(), F = L && L.fl;
      A.rings.forEach((r, k) => { r.material.emissive.setHex(base[k]); r.material.emissiveIntensity = 0; });
      fl.material.opacity = 0; ph.material.opacity = 0;
      if (!F || F.age > 1.2 || F.k == null || F.k > 3) return;
      const k = F.k, e = 1 - F.age / 1.2;
      A.rings[k].material.emissive.setHex(F.dir === 'down' ? 0xffd166 : 0x52c8e6); A.rings[k].material.emissiveIntensity = 0.9 * e;
      const es = A.rgs[k].userData.es, last = es[es.length - 1];
      if (last) { last.getWorldPosition(fl.position); A.pl.worldToLocal(fl.position); fl.material.opacity = 0.9 * e; fl.scale.setScalar(6 + 10 * (1 - e)); }
      if (F.dir === 'down' && !kit.reduce) {
        // квант света вылетает наружу
        const p0 = new T.Vector3(); (last || A.pl).getWorldPosition(p0);
        const s = F.age / 1.2; ph.position.set(p0.x + 40 * s, p0.y + 10 * s, p0.z + 24 * s); ph.material.opacity = 0.95 * (1 - s); ph.material.color.setHex(F.col || 0xfff0a0);
      }
    });
  };
})();
