// «Как в жизни» для темы «Строение атома» (labs/phys-atom): опыт Резерфорда как настольная установка
// (свинцовый источник α-частиц на рельсе, увеличенная модель атома золота — «пудинг» Томсона или ядро с орбитами,
// кольцевой экран из сульфида цинка со вспышками, пульт), музейная модель атома на подставке с лотками протонов,
// нейтронов и электронов и карточкой элемента, «лестница» уровней энергии водорода с электроном, лампа, трубка
// с водородом и кювета холодного газа, призма-спектроскоп и экран со спектром.
// Сцены строятся из window.LUCH_REAL() опыта; полёт частиц, вспышки и фотон — из LUCH_REAL.live() каждый кадр.
// Набор деталей kit — из /luch/real3d.js.
(() => {
  const SC = (window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {});
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const ease = p => p < 0 ? 0 : p > 1 ? 1 : p * p * (3 - 2 * p);
  const live = () => { try { return (window.LUCH_REAL && window.LUCH_REAL.live && window.LUCH_REAL.live()) || {}; } catch (e) { return {}; } };
  const fmt = (x, n = 0) => {
    if (!isFinite(x)) return '∞';
    let s = (Math.round(x * 10 ** n) / 10 ** n).toFixed(n);
    if (/^-0(\.0+)?$/.test(s)) s = s.slice(1);
    return s.replace('.', ',').replace('-', '−');
  };
  const P_COL = 0xe5533f, N_COL = 0xa9b4c9, E_COL = 0x52c8e6, GOLD = 0xffb547, CYAN = 0x72d4e8, WARN = 0xff8a73, WHITE = 0xe8ecf4, WIRE = 0x7d889c, DARK = 0x2c3240;
  const CAM_AZ = 0.62, CAM_EL = 0.5; // плоскость моделей чуть повёрнута к зрителю (камера движка: az 0.62)
  const EN = n => -13.6 / (n * n);
  const LAM = (hi, lo) => 1239.84 / (EN(hi) - EN(lo));
  const BALMER = [3, 4, 5, 6].map(k => LAM(k, 2));
  const isVis = l => l >= 380 && l <= 750;
  // длина волны (нм) → цвет, как на схеме (по Дэну Брутону)
  function wl(l) {
    let r = 0, g = 0, b = 0;
    if (l < 440) { r = -(l - 440) / 60; b = 1; } else if (l < 490) { g = (l - 440) / 50; b = 1; } else if (l < 510) { g = 1; b = -(l - 510) / 20; }
    else if (l < 580) { r = (l - 510) / 70; g = 1; } else if (l < 645) { r = 1; g = -(l - 645) / 65; } else r = 1;
    let f = 1; if (l < 420) f = 0.35 + 0.65 * (l - 380) / 40; else if (l > 700) f = 0.35 + 0.65 * (750 - l) / 50;
    const c = v => Math.round(255 * Math.pow(clamp(v * f, 0, 1), 0.8));
    return `rgb(${c(r)},${c(g)},${c(b)})`;
  }
  const colorName = l => l < 380 ? 'ультрафиолет' : l < 450 ? 'фиолетовый' : l < 485 ? 'синий' : l < 500 ? 'голубой' : l < 565 ? 'зелёный' : l < 590 ? 'жёлтый' : l < 625 ? 'оранжевый' : l <= 750 ? 'красный' : 'инфракрасный';
  // пучок, отложенный до следующего пучка: после одиночного выстрела на схеме старые следы остаются
  let beamMemo = null;

  // ---------- общие детали ----------
  function H(kit) {
    const { T, at, box, cyl, keep, toon, clickable } = kit;
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    const hexs = c => '#' + c.toString(16).padStart(6, '0');
    const geos = {};
    const sph = r => geos[r] || (geos[r] = keep(new T.SphereGeometry(r, 20, 14)));
    function ball(parent, x, y, z, r, col, o = {}) {
      const m = new T.Mesh(sph(r), o.mat || toon(col, o.matOpt));
      m.castShadow = o.shadow !== false; m.add(new T.Mesh(m.geometry, kit.hullMat));
      return at(m, x, y, z, parent);
    }
    const hitMat = keep(new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true, opacity: 0 }));
    const glassMat = (color, opacity) => keep(new T.MeshToonMaterial({ color, gradientMap: kit.grad, transparent: true, opacity, side: T.DoubleSide, depthWrite: false }));
    function glow(col, size, op = 0.8) {
      const s = new T.Sprite(keep(new T.SpriteMaterial({ map: kit.glowTex(), color: col, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: op })));
      s.scale.setScalar(size); return s;
    }
    function canvasPlane(w, h, pw, ph, draw) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph;
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: tex, transparent: true })));
      draw(c.getContext('2d'), pw, ph); tex.needsUpdate = true;
      return m;
    }
    // надпись спрайтом с тёмной обводкой (всегда к зрителю)
    function textSprite(txt, hgt, fg = '#e8ecf4') {
      const c = document.createElement('canvas'), x = c.getContext('2d'), font = '600 56px "IBM Plex Mono", monospace';
      x.font = font; const w = Math.ceil(x.measureText(txt).width) + 28; c.width = w; c.height = 84;
      x.font = font; x.lineWidth = 12; x.lineJoin = 'round'; x.strokeStyle = '#04070d'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.strokeText(txt, w / 2, 44); x.fillStyle = fg; x.fillText(txt, w / 2, 44);
      const t = keep(new T.CanvasTexture(c)); t.colorSpace = T.SRGBColorSpace;
      const s = new T.Sprite(keep(new T.SpriteMaterial({ map: t, transparent: true, depthWrite: false })));
      s.scale.set(hgt * w / 84, hgt, 1); s.renderOrder = 4; return s;
    }
    // плоская клавиша пульта с надписью сверху
    function key(x, z, w, dd, label, color, keyName, on) {
      const g = new T.Group(); at(g, x, 0, z);
      at(box(w, 1.6, dd, color), 0, 0.8, 0, g);
      const pw = Math.round(64 * w), ph = Math.round(64 * dd * 0.8 / 0.92);
      const top = canvasPlane(w * 0.92, dd * 0.8, pw, ph, (cx, a, b) => {
        cx.fillStyle = hexs(color); cx.fillRect(0, 0, a, b);
        let fs = Math.round(b * 0.5); const font = s => `700 ${s}px "Golos Text", sans-serif`;
        cx.font = font(fs); const tw = cx.measureText(label).width; if (tw > a * 0.88) { fs = Math.floor(fs * a * 0.88 / tw); cx.font = font(fs); }
        cx.fillStyle = '#ffffff'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(label, a / 2, b / 2 + 2);
      });
      top.rotation.x = -Math.PI / 2; at(top, 0, 1.62, 0, g);
      if (on) at(box(w + 1.2, 0.5, dd + 1.2, 0xffd166, { edges: false }), 0, 0.25, 0, g);
      clickable(g, keyName); return g;
    }
    function rodAB(parent, a, b, r, color, o = {}) {
      const dv = b.clone().sub(a), L = dv.length();
      const m = o.basic ? new T.Mesh(keep(new T.CylinderGeometry(r, r, L, 10)), keep(new T.MeshBasicMaterial({ color, transparent: true, opacity: o.op ?? 0.6, depthWrite: false, blending: o.add ? T.AdditiveBlending : T.NormalBlending })))
        : cyl(r, L, color, { edges: false, ...o });
      m.quaternion.setFromUnitVectors(v3(0, 1, 0), dv.normalize());
      return at(m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, parent);
    }
    function liveTag(p, name, value, hot) {
      kit.tag(p, name, value, hot);
      const l = document.querySelectorAll('.rl-view .rl-lbl'), el = l[l.length - 1] || null, i = el && el.querySelector('i');
      let shown = value;
      return { p, el, set(v) { if (i && v !== shown) { shown = v; i.textContent = v; } } };
    }
    // плоскость, повёрнутая к камере по умолчанию
    function facing(parent, x, y, z) {
      const g = new T.Group(); at(g, x, y, z, parent);
      g.quaternion.setFromUnitVectors(v3(0, 0, 1), v3(Math.sin(CAM_AZ) * Math.cos(CAM_EL), Math.sin(CAM_EL), Math.cos(CAM_AZ) * Math.cos(CAM_EL)));
      return g;
    }
    return { v3, hexs, ball, hitMat, glassMat, glow, canvasPlane, textSprite, key, rodAB, liveTag, facing };
  }

  // ---------- ядро: протоны и нейтроны плотно упакованы ----------
  const rnd = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
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

  // положение частицы на траектории к моменту tau (как на схеме)
  function posAt(p, tau) {
    const P = p.pts; if (tau <= 0) return { i: 0, x: P[0][0], y: P[0][1] };
    let lo = 0, hi = P.length - 1;
    if (tau >= P[hi][2]) return { i: hi, x: P[hi][0], y: P[hi][1] };
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (P[mid][2] <= tau) lo = mid; else hi = mid; }
    const k = (tau - P[lo][2]) / (P[hi][2] - P[lo][2] || 1);
    return { i: lo + 1, x: P[lo][0] + (P[hi][0] - P[lo][0]) * k, y: P[lo][1] + (P[hi][1] - P[lo][1]) * k };
  }

  // =====================================================================================
  // 1. Опыт Резерфорда: источник на рельсе, увеличенный атом золота, кольцевой экран, пульт
  SC['atomst-rutherford'] = (kit, d) => {
    const { T, at, box, cyl, keep, clickable, C } = kit;
    const h = H(kit), v3 = h.v3, G = d.geo;
    const s = 0.17, Y = 20, CX = 6, CZ = -6, Rw = G.R * s, ra = G.ra * s;
    const thom = d.mdl === 'thom';
    // кольцевой экран на ножках: стекло, покрытое сульфидом цинка
    const scr = new T.Mesh(keep(new T.CylinderGeometry(Rw, Rw, 10, 96, 1, true)), h.glassMat(0xd9f2e4, 0.2)); at(scr, CX, Y, CZ);
    for (const dy of [-5, 5]) { const rim = kit.mesh(new T.TorusGeometry(Rw, 0.35, 8, 96), DARK, { edges: false, hull: false }); rim.rotation.x = Math.PI / 2; at(rim, CX, Y + dy, CZ); }
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.3; at(box(1, Y - 5, 1, DARK), CX + Math.cos(a) * Rw, (Y - 5) / 2, CZ + Math.sin(a) * Rw); }
    // атом на тонкой стойке
    const atom = new T.Group(); at(atom, CX, Y, CZ); clickable(atom, 'model');
    at(cyl(5, 1.2, DARK, { seg: 32 }), CX, 0.6, CZ);
    at(cyl(0.45, Y - (thom ? ra : 1.4) - 1.2, C.STEEL, { edges: false }), CX, 1.2 + (Y - (thom ? ra : 1.4) - 1.2) / 2, CZ);
    const orbits = [];
    if (thom) {
      const pud = new T.Mesh(keep(new T.SphereGeometry(ra, 40, 28)), h.glassMat(0xff9aa8, 0.38)); atom.add(pud);
      atom.add(h.glow(0xff9aa8, ra * 2.4, 0.18));
      for (let i = 0; i < 14; i++) {
        const yy = 1 - 2 * (i + 0.5) / 14, rr = Math.sqrt(1 - yy * yy), a = i * 2.39996, R = ra * 0.74;
        h.ball(atom, Math.cos(a) * rr * R, yy * R, Math.sin(a) * rr * R, 0.95, E_COL);
      }
    } else {
      atom.add(new T.Mesh(keep(new T.SphereGeometry(ra, 32, 20)), h.glassMat(CYAN, 0.05)));
      h.ball(atom, 0, 0, 0, 1.3, GOLD, { matOpt: { emissive: GOLD, emissiveIntensity: 0.6 } });
      atom.add(h.glow(GOLD, 7, 0.9));
      for (let i = 0; i < 3; i++) {
        const og = new T.Group(); atom.add(og); og.rotation.set(Math.PI / 2 + (i - 1) * 0.65, i * 1.05, 0);
        const tor = new T.Mesh(keep(new T.TorusGeometry(ra - 1.5, 0.12, 6, 96)), keep(new T.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.35, depthWrite: false }))); og.add(tor);
        const e = h.ball(og, ra - 1.5, 0, 0, 0.8, E_COL); orbits.push({ e, R: ra - 1.5, sp: 0.6 + i * 0.25, ph: i * 2 });
      }
    }
    // невидимая «ручка» поменьше атома: чтобы клик по центру сменил модель, а края можно было тянуть
    atom.add(new T.Mesh(keep(new T.SphereGeometry(ra * 0.7, 12, 8)), h.hitMat));
    // ось пучка через центр атома
    h.rodAB(null, v3(-46, Y, CZ), v3(CX + ra + 6, Y, CZ), 0.12, 0x8b96ad, { basic: true, op: 0.4 });
    // источник α-частиц: свинцовый короб с трубкой-коллиматором на рельсе; сдвиг по рельсу — прицельное расстояние b
    const gz = CZ - (d.b / G.fm) * s;
    at(box(4, 1.2, 36, DARK), -50, 0.6, CZ - 11);
    for (let k = 0; k <= 6; k++) at(box(5, 0.15, 0.3, 0xf1e3c2, { edges: false, shadow: false }), -50, 1.25, CZ - k * 50 / G.fm * s);
    const gun = new T.Group(); at(gun, -50, 0, gz); clickable(gun, 'one');
    at(box(5, Y - 5, 5, 0x3a3f4c), 0, 1.2 + (Y - 5 - 1.2) / 2, 0, gun);
    at(box(10, 8, 9, 0x5d6a86), 0, Y, 0, gun);
    const col = cyl(1.3, 6, C.BRASS, { seg: 16 }); col.rotation.z = Math.PI / 2; at(col, 8, Y, 0, gun);
    at(cyl(0.5, 0.4, GOLD, { edges: false, hull: false, matOpt: { emissive: GOLD, emissiveIntensity: 0.8 } }), 11.1, Y, 0, gun).rotation.z = Math.PI / 2;
    // линия прицела
    const aimLine = h.rodAB(null, v3(-39, Y, gz), v3(CX + 7, Y, gz), 0.18, GOLD, { basic: true, op: 0.45 });
    // траектории и частицы
    const fly = new T.Group(); kit.root.add(fly);
    const matA = keep(new T.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.95 }));
    const matO = keep(new T.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.2, depthWrite: false }));
    const heads = []; for (let i = 0; i < 52; i++) { const sp = h.glow(GOLD, 2.8, 1); sp.visible = false; kit.root.add(sp); heads.push(sp); }
    const flashes = []; for (let i = 0; i < 180; i++) { const sp = h.glow(WHITE, 2, 0.6); sp.visible = false; kit.root.add(sp); flashes.push(sp); }
    let curFl = null, items = [];
    const mkLine = (p, cur) => {
      const arr = new Float32Array(p.pts.length * 3);
      p.pts.forEach((q, i) => { arr[i * 3] = CX + q[0] * s; arr[i * 3 + 1] = Y; arr[i * 3 + 2] = CZ + q[1] * s; });
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(arr, 3));
      const ln = new T.Line(g, matA); ln.visible = false; fly.add(ln);
      return { p, ln, g, cur };
    };
    const rebuild = fl => {
      items.forEach(it => { fly.remove(it.ln); it.g.dispose(); }); items = [];
      if (beamMemo && beamMemo !== fl) beamMemo.forEach(p => items.push(mkLine(p, false)));
      (fl || []).forEach(p => items.push(mkLine(p, true)));
    };
    // подписи
    const L0 = live();
    const cntTxt = c => c ? `${c.n} шт · прямо ${c.s} · 10–90° ${c.m} · назад ${c.k}` : '—';
    const lastTxt = l => l ? `${fmt(l.th)}° при b = ${l.b} фм` : 'нажмите на пушку';
    kit.tag(v3(-50, Y + 7, gz), 'Источник α', `b = ${d.b} фм`);
    kit.tag(v3(CX, Y + (thom ? ra + 2 : ra), CZ), thom ? 'Модель Томсона' : 'Ядерная модель', thom ? '«пудинг с изюмом»' : `угол для b: ${d.th}°`);
    const tC = h.liveTag(v3(CX + Rw * 0.75, Y + 7, CZ - Rw * 0.75), 'Экран ZnS', cntTxt(L0.cnt));
    const tL = h.liveTag(v3(CX + Rw * 0.7, Y + 2, CZ + Rw * 0.75), 'Одна частица', lastTxt(L0.last), !!(L0.last && L0.last.th > 90));
    // пульт
    [['thom', 'Томсон', thom], ['nuc', 'Ядро', !thom], ['beam', 'Пучок'], ['one', 'Одна'], ['b-', 'b −'], ['b+', 'b +'], ['reset', 'Сброс']].forEach(([k, lab, on], i) =>
      h.key(-45 + i * 15, 42, 12, 7, lab, k === 'beam' || k === 'one' ? 0xc8483a : k === 'reset' ? 0x5d6a86 : 0x2f6fd8, k, on));
    let w = 0;
    const pose = dt => {
      w += kit.reduce ? 0 : dt;
      orbits.forEach(o => { const a = w * o.sp * 2 + o.ph; o.e.position.set(Math.cos(a) * o.R, Math.sin(a) * o.R, 0); });
      const L = live(); if (!L.fl) return;
      aimLine.visible = !L.firing;
      if (L.fl !== curFl) { curFl = L.fl; if (curFl.length > 1) beamMemo = curFl; rebuild(curFl); }
      let hi = 0;
      const head = (q) => { if (hi >= heads.length) return; const sp = heads[hi++]; sp.visible = true; sp.position.set(CX + q.x * s, Y, CZ + q.y * s); };
      for (const it of items) {
        const p = it.p, flying = it.cur && L.firing && !p.done, tau = (L.bt - (p.delay || 0)) * G.SPD;
        if (p.aim) {
          it.ln.visible = p === L.aim; if (!it.ln.visible) continue;
          it.ln.material = matA;
          if (flying) { const q = posAt(p, tau); it.g.setDrawRange(0, q.i); if (tau > 0) head(q); }
          else it.g.setDrawRange(0, Infinity);
        } else if (flying) {
          if (tau <= 0) { it.ln.visible = false; continue; }
          const q = posAt(p, tau); it.ln.visible = true; it.ln.material = matA;
          it.g.setDrawRange(Math.max(0, q.i - 8), Math.min(q.i, 8)); head(q);
        } else if (p.done && L.trails > 0) { it.ln.visible = true; it.ln.material = matO; it.g.setDrawRange(0, Infinity); }
        else it.ln.visible = false;
      }
      for (let j = hi; j < heads.length; j++) heads[j].visible = false;
      // вспышки на экране
      const now = performance.now(), mk = L.marks || [], n0 = Math.max(0, mk.length - flashes.length);
      flashes.forEach((f, j) => {
        const m = mk[n0 + j]; if (!m) { f.visible = false; return; }
        const a = Math.atan2(m.y - G.cy, m.x - G.cx), age = kit.reduce ? 2 : (now - m.t) / 900;
        f.visible = true; f.position.set(CX + Math.cos(a) * (Rw - 0.4), Y, CZ + Math.sin(a) * (Rw - 0.4));
        f.material.color.setHex(m.c === 'k' ? WARN : m.c === 'm' ? CYAN : WHITE);
        f.scale.setScalar(age < 1 ? 5 - 3 * age : 1.8); f.material.opacity = age < 1 ? 1 - 0.4 * age : 0.6;
      });
      tC.set(cntTxt(L.cnt)); tL.set(lastTxt(L.last));
      if (tL.el) tL.el.classList.toggle('hot', !!(L.last && L.last.th > 90));
    };
    pose(0); kit.onFrame(pose);
  };

  // =====================================================================================
  // 2. Модель атома: ядро и проволочные слои на подставке, лотки с частицами, карточка элемента
  SC['atomst-model'] = (kit, d) => {
    const { T, at, box, cyl, keep, clickable, C } = kit;
    const h = H(kit), v3 = h.v3;
    const AX = 18, AZ = -10, Y = 28, ringR = k => 9.5 + k * 4.6;
    // подставка
    at(cyl(9, 1.6, DARK, { seg: 40 }), AX, 0.8, AZ);
    at(cyl(7.4, 0.5, C.WOOD2, { seg: 40, edges: false }), AX, 1.85, AZ);
    at(cyl(0.6, Y - ringR(3) - 2, C.STEEL, { edges: false }), AX, 2 + (Y - ringR(3) - 2) / 2, AZ);
    const pl = h.facing(null, AX, Y, AZ);
    // ядро
    const nu = new T.Group(); pl.add(nu);
    const pts = nucPts(d.Z, d.N), rb = 1.25, dd = rb * 2 * 0.96, balls = [];
    pts.forEach((q, i) => { const b = h.ball(nu, q.x * dd, q.y * dd, q.z * dd, rb, q.isP ? P_COL : N_COL); balls.push({ b, x: q.x * dd, y: q.y * dd, z: q.z * dd, ph: rnd(i + 3) * 6.28 }); });
    // проволочная рамка и четыре слоя; занятые — ярче
    h.rodAB(pl, v3(0, -ringR(3) - 0.4, 0), v3(0, -ringR(0) + 1, 0), 0.16, WIRE, { hull: false });
    const rgs = [];
    for (let k = 0; k < 4; k++) {
      const on = k < d.sh.length;
      const tr = new T.Mesh(keep(new T.TorusGeometry(ringR(k), on ? 0.28 : 0.18, 8, 96)), on ? kit.toon(WIRE) : keep(new T.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.18, depthWrite: false })));
      if (on) tr.add(new T.Mesh(tr.geometry, kit.hullMat));
      pl.add(tr);
      const rg = new T.Group(); pl.add(rg); rgs.push(rg);
      const cnt = d.sh[k] || 0;
      for (let j = 0; j < cnt; j++) { const a = j * Math.PI * 2 / cnt + k * 0.4 + Math.PI / 2; h.ball(rg, Math.cos(a) * ringR(k), Math.sin(a) * ringR(k), 0, 0.85, E_COL, { matOpt: { emissive: E_COL, emissiveIntensity: 0.25 } }); }
      if (cnt) { const sp = h.textSprite(String(cnt), 2.2, '#a9e6f2'); at(sp, Math.cos(-0.95) * ringR(k) + 1.6, Math.sin(-0.95) * ringR(k) - 1.2, 0.5, pl); }
    }
    if (!kit.reduce) kit.onFrame((dt, t) => {
      rgs.forEach((rg, k) => { rg.rotation.z = t * (0.5 / (k + 1)) * (k % 2 ? -1 : 1); });
      for (const q of balls) { const j = 0.12 * Math.sin(t * 9 + q.ph); q.b.position.set(q.x + j, q.y + j * 0.6, q.z - j * 0.5); }
    });
    // лотки с частицами: нажатие на лоток добавляет частицу, клавиши «+ / −» рядом
    const tray = (z, col, r, label, k) => {
      const g = new T.Group(); at(g, -46, 0, z); clickable(g, k + '+');
      at(box(14, 1, 11, 0xf4f6f9), 0, 0.5, 0, g);
      at(box(14, 2.6, 0.6, 0xdfe5ec), 0, 1.8, -5.2, g); at(box(14, 1.8, 0.6, 0xdfe5ec), 0, 1.4, 5.2, g);
      at(box(0.6, 2.6, 9.8, 0xdfe5ec), -6.7, 1.8, 0, g); at(box(0.6, 2.6, 9.8, 0xdfe5ec), 6.7, 1.8, 0, g);
      for (let i = 0; i < 8; i++) {
        const a = i * 2.39996 + 0.4, rr = i ? Math.min(3.8, 1.5 + i * 0.4) : 0, up = i > 4 ? 1 : 0;
        h.ball(g, Math.cos(a) * rr * (up ? 0.45 : 1), 1 + r + up * r * 1.5, Math.sin(a) * rr * 0.75 * (up ? 0.45 : 1), r, col);
      }
      const lb = h.canvasPlane(13, 2.2, 640, 108, (x, pw, ph) => { x.fillStyle = '#fff6e6'; x.fillRect(0, 0, pw, ph); x.fillStyle = '#1b1610'; x.font = '700 56px "Golos Text", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(label, pw / 2, ph / 2 + 3); });
      at(lb, 0, 1.4, 5.55, g);
      h.key(-32, z - 2.2, 6, 4.4, '+', 0x3fae5a, k + '+');
      h.key(-32, z + 2.6, 6, 4.4, '−', 0xc8483a, k + '-');
    };
    tray(-24, P_COL, 1.2, 'протоны p⁺', 'Z');
    tray(-6, N_COL, 1.2, 'нейтроны n', 'N');
    tray(12, E_COL, 0.85, 'электроны e⁻', 'E');
    // карточка элемента на подставке, как клетка таблицы Менделеева
    const q = d.Z - d.E, A = d.Z + d.N;
    const card = new T.Group(); at(card, -8, 0, 26);
    at(box(12, 0.8, 4, DARK), 0, 0.4, -0.6, card);
    const hold = new T.Group(); at(hold, 0, 0.8, 0, card); hold.rotation.x = -0.25;
    at(box(17, 15, 0.5, DARK, { edges: false }), 0, 7.7, -0.3, hold);
    const face = h.canvasPlane(16.6, 14.6, 620, 545, (x, pw, ph) => {
      x.fillStyle = q === 0 ? '#fff6e6' : '#ffe9cf'; x.fillRect(0, 0, pw, ph);
      x.strokeStyle = '#1b1610'; x.lineWidth = 10; x.strokeRect(5, 5, pw - 10, ph - 10);
      x.fillStyle = '#1b1610'; x.textBaseline = 'middle';
      x.font = '700 58px "IBM Plex Mono", monospace'; x.textAlign = 'left'; x.fillText(String(d.Z), 34, 64);
      x.textAlign = 'right'; x.fillText(String(A), pw - 34, 64);
      x.textAlign = 'center'; x.font = '700 190px "IBM Plex Mono", monospace'; x.fillText(d.sym, pw / 2, 220);
      x.font = '600 52px "Golos Text", sans-serif'; x.fillText(`${d.name}-${A}`, pw / 2, 360);
      x.font = '600 40px "IBM Plex Mono", monospace'; x.fillStyle = '#5a4a36'; x.fillText(`${d.Z} p · ${d.N} n · ${d.E} e`, pw / 2, 430);
      x.fillStyle = q === 0 ? '#2e7d4f' : '#c0392b'; x.font = '700 40px "Golos Text", sans-serif';
      x.fillText(q === 0 ? 'нейтральный атом' : `ион, заряд ${q > 0 ? '+' : '−'}${Math.abs(q)}e`, pw / 2, 495);
    });
    at(face, 0, 7.7, 0.02, hold);
    h.key(14, 34, 12, 7, 'Сброс', 0x5d6a86, 'reset');
    // подписи
    kit.tag(v3(AX, Y + ringR(3) + 3, AZ), `${d.name}-${A}`, q === 0 ? 'нейтральный атом' : `ион ${q > 0 ? '+' : '−'}${Math.abs(q)}e`, q === 0);
    kit.tag(v3(AX + 4, Y - 6, AZ + 6), 'Ядро', `${d.Z} p + ${d.N} n`);
    kit.tag(v3(-8, 17, 26), 'Цели', d.goals.map(g => g[0] + (g[1] ? ' ✓' : ' —')).join(' · '), d.goals.every(g => g[1]));
  };

  // =====================================================================================
  // 3. Спектры: «лестница» уровней водорода, источники света, призма и экран со спектром
  SC['atomst-spectra'] = (kit, d) => {
    const { T, at, box, cyl, keep, clickable, C } = kit;
    const h = H(kit), v3 = h.v3;
    const LX = -34, LZ = -10, ly = y => 3 + (330 - y) * 0.18, lev = n => ly(d.LY[n]);
    // стойка лестницы
    at(box(36, 1.6, 10, DARK), LX, 0.8, LZ);
    const top = ly(d.y0) + 3;
    for (const sx of [-1, 1]) at(box(1.6, top, 1.6, 0x3a3f4c), LX + sx * 16, top / 2 + 1.6, LZ - 3);
    // граница E = 0 — штрихи
    for (let i = 0; i < 8; i++) at(box(2.2, 0.35, 0.35, 0x8b96ad, { edges: false }), LX - 12.6 + i * 3.6, ly(d.y0), LZ);
    { const sp = h.textSprite('∞ · 0 эВ', 1.7, '#8b96ad'); at(sp, LX + 22, ly(d.y0), LZ); }
    // уровни: стальные перекладины, текущая — оранжевая; нажатие переводит электрон
    for (let n = 1; n <= 6; n++) {
      const g = new T.Group(); at(g, LX, lev(n), LZ); clickable(g, 'lv-' + n);
      const on = n === d.n;
      const rod = cyl(on ? 0.55 : 0.42, 28, on ? GOLD : C.STEEL, { seg: 12, edges: false, ...(on ? { matOpt: { emissive: GOLD, emissiveIntensity: 0.35 } } : {}) }); rod.rotation.z = Math.PI / 2; g.add(rod);
      const hit = new T.Mesh(keep(new T.CylinderGeometry(n >= 4 ? 1.3 : 1.8, n >= 4 ? 1.3 : 1.8, 32, 8)), h.hitMat); hit.rotation.z = Math.PI / 2; g.add(hit);
      const a = h.textSprite(`n = ${n}`, 1.8, on ? '#ffb547' : '#a9b4c9'); at(a, -19.5, 0, 0, g);
      const b = h.textSprite(`${fmt(EN(n), 2)} эВ`, 1.6, '#8b96ad'); at(b, 21.5, 0, 0, g);
    }
    // стрелки найденных переходов вниз
    d.lines.slice(0, 9).forEach(([from, to, lam], i) => {
      const c = isVis(lam) ? new T.Color(wl(lam)).getHex() : 0x5d6a86, x = LX - 12 + i * 1.5;
      h.rodAB(null, v3(x, lev(from), LZ + 1.2), v3(x, lev(to) + 1.2, LZ + 1.2), 0.22, c, { basic: true, op: 0.95 });
      const cone = new T.Mesh(keep(new T.ConeGeometry(0.6, 1.4, 10)), keep(new T.MeshBasicMaterial({ color: c }))); cone.rotation.z = Math.PI; at(cone, x, lev(to) + 0.7, LZ + 1.2);
    });
    // электрон
    const eX = LX + 3, el = h.ball(null, eX, lev(d.n) + 1.9, LZ, 1.5, E_COL, { matOpt: { emissive: E_COL, emissiveIntensity: 0.35 } });
    const eg = h.glow(CYAN, 6, 0.5); kit.root.add(eg);
    // источники света на скамье: лампа накаливания, трубка с водородом, кювета с холодным водородом
    const PR = v3(36, 11, -16);
    const LAMP = v3(4, 12, -27), TUBE = v3(4, 12, -12);
    const lampOn = d.mode !== 'emit', tubeOn = d.mode === 'emit';
    at(box(50, 1.4, 26, C.WOOD2), 18, 0.7, -19);
    const lamp = new T.Group(); at(lamp, LAMP.x, 0, LAMP.z); clickable(lamp, 'cont');
    at(cyl(3, 1.6, DARK, { seg: 24 }), 0, 2.2, 0, lamp); at(cyl(0.5, 7, C.STEEL, { edges: false }), 0, 6.5, 0, lamp);
    at(cyl(1.4, 2, C.BRASS, { seg: 16 }), 0, 10, 0, lamp);
    h.ball(lamp, 0, LAMP.y, 0, 2.8, lampOn ? 0xfff0b0 : 0xe8e4d8, { matOpt: lampOn ? { emissive: 0xffd27a, emissiveIntensity: 0.9 } : {} });
    if (lampOn) { const gw = h.glow(0xffd27a, 16, 0.75); at(gw, 0, LAMP.y, 0, lamp); }
    const tube = new T.Group(); at(tube, TUBE.x, 0, TUBE.z); clickable(tube, 'emit');
    at(box(6, 1.6, 4, DARK), 0, 2.2, 0, tube);
    at(cyl(1.1, 14, tubeOn ? 0xe7a0ff : 0xd8eef8, { seg: 16, edges: false, matOpt: tubeOn ? { emissive: 0xd77cff, emissiveIntensity: 0.9, transparent: true, opacity: 0.9 } : { transparent: true, opacity: 0.45 } }), 0, 10, 0, tube);
    at(cyl(1.5, 1.6, C.STEEL, { seg: 16 }), 0, 3.8, 0, tube); at(cyl(1.5, 1.6, C.STEEL, { seg: 16 }), 0, 17.6, 0, tube);
    if (tubeOn) { const gw = h.glow(0xd77cff, 14, 0.7); at(gw, 0, 11, 0, tube); }
    const CU = LAMP.clone().lerp(PR, 0.38);
    const cuv = new T.Group(); at(cuv, CU.x, 0, CU.z); clickable(cuv, 'abs');
    at(box(5, 1.6, 5, DARK), 0, 2.2, 0, cuv); at(cyl(0.4, CU.y - 6, C.STEEL, { edges: false }), 0, 3 + (CU.y - 6) / 2, 0, cuv);
    const cg = cyl(2.4, 6, 0xd8eef8, { seg: 20, edges: false, matOpt: { transparent: true, opacity: d.mode === 'abs' ? 0.55 : 0.3 } }); cg.rotation.z = Math.PI / 2; cg.rotation.y = -Math.atan2(PR.z - LAMP.z, PR.x - LAMP.x); at(cg, 0, CU.y, 0, cuv);
    // призма на столике и экран со спектром
    at(cyl(2.4, PR.y - 6, DARK, { seg: 16 }), PR.x, 1.4 + (PR.y - 6 - 1.4) / 2, PR.z);
    const prism = new T.Mesh(keep(new T.CylinderGeometry(4.2, 4.2, 9, 3)), h.glassMat(0xbfe3ff, 0.45)); prism.add(new T.LineSegments(keep(new T.EdgesGeometry(prism.geometry)), kit.edgeMat)); at(prism, PR.x, PR.y, PR.z);
    const SX = 22, SZ = 24, SW = 46, SH = 11, SY = 5.5;
    at(box(SW + 1.6, SH + 1.6, 0.8, DARK), SX, SY + SH / 2, SZ - 0.5);
    for (const sx of [-1, 1]) { at(box(1.4, SY, 1.4, DARK), SX + sx * (SW / 2 - 3), SY / 2, SZ - 0.5); at(box(3, 0.8, 6, DARK), SX + sx * (SW / 2 - 3), 0.4, SZ - 0.5); }
    const PW = 1024, PH = Math.round(1024 * SH / SW), x0 = 40, x1 = PW - 40, y0 = 62, y1 = PH - 58;
    const XS = l => x0 + (l - 380) / 370 * (x1 - x0);
    const title = { cont: 'Сплошной спектр (нить лампы)', emit: 'Спектр испускания водорода', abs: 'Спектр поглощения водорода' }[d.mode];
    const scr = h.canvasPlane(SW, SH, PW, PH, (x, pw, ph) => {
      x.fillStyle = '#0e1520'; x.fillRect(0, 0, pw, ph);
      x.fillStyle = '#e8ecf4'; x.font = '600 32px "Golos Text", sans-serif'; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(title, x0, 32);
      if (d.mode === 'emit') {
        x.fillStyle = '#05080d'; x.fillRect(x0, y0, x1 - x0, y1 - y0);
        d.lines.forEach(([, , lam]) => { if (!isVis(lam)) return; const c = wl(lam), X = XS(lam); x.globalAlpha = 0.3; x.fillStyle = c; x.fillRect(X - 13, y0, 26, y1 - y0); x.globalAlpha = 1; x.fillRect(X - 5, y0, 10, y1 - y0); });
      } else {
        const g = x.createLinearGradient(x0, 0, x1, 0); for (let l = 380; l <= 750; l += 10) g.addColorStop((l - 380) / 370, wl(l));
        x.fillStyle = g; x.fillRect(x0, y0, x1 - x0, y1 - y0);
        if (d.mode === 'abs') { x.fillStyle = '#05080d'; BALMER.forEach(l => x.fillRect(XS(l) - 5, y0, 10, y1 - y0)); }
      }
      x.strokeStyle = '#26324a'; x.lineWidth = 3; x.strokeRect(x0, y0, x1 - x0, y1 - y0);
      x.fillStyle = '#8b96ad'; x.font = '500 26px "IBM Plex Mono", monospace'; x.textAlign = 'center';
      [400, 500, 600, 700].forEach(l => { x.fillRect(XS(l) - 1.5, y1, 3, 12); x.fillText(l + (l === 700 ? ' нм' : ''), XS(l), y1 + 32); });
    });
    at(scr, SX, SY + SH / 2, SZ);
    const scrAt = lam => v3(SX - SW / 2 + XS(lam) / PW * SW, SY + SH - (y0 + y1) / 2 / PH * SH, SZ + 0.1);
    // свет: от источника в призму, из призмы веером на экран
    const src = d.mode === 'emit' ? TUBE : LAMP;
    h.rodAB(null, src, PR, 0.35, d.mode === 'emit' ? 0xe7a0ff : 0xfff3c4, { basic: true, op: 0.45, add: true });
    if (d.mode === 'emit') d.lines.forEach(([, , lam]) => { if (isVis(lam)) h.rodAB(null, PR, scrAt(lam), 0.22, new T.Color(wl(lam)).getHex(), { basic: true, op: 0.55, add: true }); });
    else [400, 450, 500, 550, 600, 650, 700].forEach(l => h.rodAB(null, PR, scrAt(l), 0.2, new T.Color(wl(l)).getHex(), { basic: true, op: 0.35, add: true }));
    // фотон: летит из атома в спектроскоп (испускание) или от лампы к атому (поглощение)
    const dots = []; for (let i = 0; i < 6; i++) { const sp = h.glow(WHITE, i ? 2.2 - i * 0.25 : 3.4, i ? 0.7 : 1); sp.visible = false; kit.root.add(sp); dots.push(sp); }
    const A = new T.Vector3(), B = new T.Vector3();
    const pose = () => {
      const ph = live().photon;
      let ey = lev(d.n) + 1.9;
      if (ph) {
        const k = clamp(ph.t, 0, 1);
        ey = ly(ph.y0) + (ly(ph.y1) - ly(ph.y0)) * ease(Math.min(1, k * 2.5)) + 1.9;
        const eAt = v3(eX + 1.5, ly(ph.y1) + 1.9, LZ);
        if (ph.out) { A.copy(eAt); B.copy(PR); } else { A.copy(LAMP); B.copy(eAt); }
        const col = isVis(ph.lam) ? new T.Color(wl(ph.lam)) : new T.Color(0xc3a8ff);
        dots.forEach((sp, i) => {
          const f = k - i * 0.03; sp.visible = f > 0 && f < 1;
          if (!sp.visible) return;
          sp.position.copy(A).lerp(B, f); sp.position.y += Math.sin(f * 40) * 0.9;
          sp.material.color.copy(col);
        });
      } else dots.forEach(sp => { sp.visible = false; });
      el.position.y = ey; eg.position.set(eX, ey, LZ);
    };
    pose(); kit.onFrame(pose);
    // пульт
    [['cont', 'Сплошной', d.mode === 'cont'], ['emit', 'Испускание', d.mode === 'emit'], ['abs', 'Поглощение', d.mode === 'abs'], ['up', 'Вверх'], ['down', 'Вниз'], ['reset', 'Сброс']].forEach(([k, lab, on], i) =>
      h.key(-45 + i * 15, 42, 12, 7, lab, i < 3 ? 0x2f6fd8 : k === 'reset' ? 0x5d6a86 : 0x3fae5a, k, on));
    // подписи
    const vis = d.lines.filter(l => isVis(l[2])).length;
    kit.tag(v3(LX, top + 3, LZ - 3), 'Атом водорода', `n = ${d.n} · ${fmt(EN(d.n), 2)} эВ`);
    kit.tag(v3(SX, SY + SH + 3, SZ), 'Экран спектроскопа', d.mode === 'emit' ? `видимых линий: ${vis} из 4` : d.mode === 'abs' ? 'тёмные линии водорода' : 'все цвета подряд', vis >= 4 || d.mode === 'abs');
    kit.tag(v3(PR.x, PR.y + 7, PR.z), 'Призма', d.last ? `${d.last.to < d.last.from ? 'испущен' : 'поглощён'} ${fmt(d.last.lam)} нм · ${colorName(d.last.lam)}` : 'фотонов ещё не было');
    kit.tag(v3(d.mode === 'emit' ? TUBE.x : LAMP.x, (d.mode === 'emit' ? 20 : LAMP.y + 5), d.mode === 'emit' ? TUBE.z : LAMP.z), d.mode === 'emit' ? 'Трубка с водородом' : d.mode === 'abs' ? 'Лампа + холодный водород' : 'Лампа накаливания', 'светит');
  };
})();
