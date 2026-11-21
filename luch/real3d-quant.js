// «Как в жизни» для темы «Кванты и свет» (labs/phys-quant): вакуумный фотоэлемент с лампой-монохроматором, источником
// и микроамперметром (электроны летят от катода к аноду); лампа 1 Вт с фотонами-пакетами, счётчиком и столбиками
// энергии и импульса; рубиновый лазер с атомами, спиральной лампой накачки, зеркалами и измерителем мощности;
// вакуумная камера с электронной пушкой, щелями, датчиком и экраном, на котором копятся вспышки электронов.
// Сцены строятся из window.LUCH_REAL() опыта; быстро меняющееся (атомы лазера, точки на экране) — из LUCH_REAL.live().
(() => {
  const SC = (window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {});
  const Y0 = 0.4; // верх тёмного сукна на столе
  const ORANGE = 0xffb547, CYAN = 0x72d4e8, RAIL = 0x3b4a66, GLASS = 0xcfe6f2, PANEL = 0x3b4a66, RUBY = 0xff4d5e;
  const METALS = { Cs: { col: 0xe0c77a, A: 1.9 }, Na: { col: 0xc9ced8, A: 2.3 }, Zn: { col: 0x93a6bd, A: 4.2 } };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const f = (x, d = 1) => { let s = (Math.round(x * 10 ** d) / 10 ** d).toFixed(d); if (/^-0(\.0+)?$/.test(s)) s = s.slice(1); return s.replace('.', ',').replace('-', '−'); };
  const num = s => parseInt(String(s).slice(1), 16) || 0;
  const live = () => { try { return (window.LUCH_REAL && window.LUCH_REAL.live && window.LUCH_REAL.live()) || {}; } catch (e) { return {}; } };
  function wlColor(nm) {
    if (nm < 380) return '#8c7ae0';
    if (nm > 780) return '#7a3030';
    let r = 0, g = 0, b = 0;
    if (nm < 440) { r = (440 - nm) / 60; b = 1; } else if (nm < 490) { g = (nm - 440) / 50; b = 1; } else if (nm < 510) { g = 1; b = (510 - nm) / 20; }
    else if (nm < 580) { r = (nm - 510) / 70; g = 1; } else if (nm < 645) { r = 1; g = (645 - nm) / 65; } else r = 1;
    const k = nm < 420 ? 0.35 + 0.65 * (nm - 380) / 40 : nm > 700 ? 0.35 + 0.65 * (780 - nm) / 80 : 1;
    return '#' + [r, g, b].map(v => Math.round(255 * Math.pow(v * k, 0.8)).toString(16).padStart(2, '0')).join('');
  }

  // ---------- общие детали ----------
  function felt(kit) { kit.at(kit.box(126, Y0, 90, 0x2a2f3a, { edges: false }), 0, Y0 / 2, 3); }
  const lastTag = () => { const l = document.querySelectorAll('.rl-view .rl-lbl'); return l[l.length - 1] || null; };
  // подпись, значение которой меняется каждый кадр без перестройки сцены
  function liveTag(kit, p, name, value, hot) {
    kit.tag(p, name, value, hot);
    const el = lastTag(), i = el && el.querySelector('i');
    let shown = value, sh = !!hot;
    return { set(v, h) { if (i && v !== shown) { shown = v; i.textContent = v; } if (el && h !== undefined && !!h !== sh) { sh = !!h; el.classList.toggle('hot', sh); } } };
  }
  function glow(kit, col, size, op = 0.8) {
    const { T } = kit;
    const s = new T.Sprite(kit.keep(new T.SpriteMaterial({ map: kit.glowTex(), color: col, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: op })));
    s.scale.setScalar(size); s.renderOrder = 5; return s;
  }
  const glassMat = (kit, col = GLASS, op = 0.16) => kit.keep(new kit.T.MeshToonMaterial({ color: col, gradientMap: kit.grad, transparent: true, opacity: op, depthWrite: false, side: kit.T.DoubleSide }));
  const basic = (kit, col, op = 1, add) => kit.keep(new kit.T.MeshBasicMaterial({ color: col, transparent: op < 1 || !!add, opacity: op, depthWrite: !(op < 1 || add), blending: add ? kit.T.AdditiveBlending : kit.T.NormalBlending }));
  // стержень между двумя точками
  function rod(kit, a, b, r, col, o = {}) {
    const { T, cyl } = kit; const d = b.clone().sub(a), L = d.length(); if (L < 0.01) return null;
    const m = cyl(r, L, col, { edges: false, hull: r >= 0.5, ...o });
    m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
    kit.root.add(m); return m;
  }
  // светлый цилиндр-луч от a к b (радиусы ra → rb)
  function ray(kit, a, b, ra, rb, col, op, add = true) {
    const { T, keep } = kit; const d = b.clone().sub(a), L = d.length(); if (L < 0.05) return null;
    const m = new T.Mesh(keep(new T.CylinderGeometry(rb, ra, L, 24, 1, true)), keep(new T.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, side: T.DoubleSide, blending: add ? T.AdditiveBlending : T.NormalBlending })));
    m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); m.renderOrder = 3;
    kit.root.add(m); return m;
  }
  // надписи на прозрачном фоне (на столе, на кнопках)
  const texC = {};
  function labelTex(T, txt, col, w, h) {
    const key = txt + col + w + 'x' + h; if (texC[key]) return texC[key];
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    let fs = Math.round(h * 0.66); x.font = `700 ${fs}px "Golos Text", sans-serif`;
    const tw = x.measureText(txt).width; if (tw > w * 0.9) { fs = Math.floor(fs * w * 0.9 / tw); x.font = `700 ${fs}px "Golos Text", sans-serif`; }
    x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, w / 2, h / 2 + 2);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; texC[key] = t; return t;
  }
  function flatLabel(kit, txt, col, w, h, flat) {
    const { T, keep } = kit;
    const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: labelTex(T, txt, col, Math.round(96 * w / h), 96), transparent: true, depthWrite: false })));
    if (flat) m.rotation.x = -Math.PI / 2;
    return m;
  }
  // табло прибора, которое можно перерисовывать каждый кадр
  function liveScreen(kit, w, h, pw, ph, draw) {
    const { T, keep } = kit;
    const c = document.createElement('canvas'); c.width = pw; c.height = ph; const x = c.getContext('2d');
    const t = keep(new T.CanvasTexture(c)); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
    const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: t })));
    const redraw = (...a) => { draw(x, pw, ph, ...a); t.needsUpdate = true; };
    return { m, x, redraw };
  }
  function digits(x, w, h, txt, col) {
    x.fillStyle = '#0e1520'; x.fillRect(0, 0, w, h);
    let fs = Math.round(h * 0.6); x.font = `600 ${fs}px "IBM Plex Mono", monospace`;
    const tw = x.measureText(txt).width; if (tw > w * 0.88) { fs = Math.floor(fs * w * 0.88 / tw); x.font = `600 ${fs}px "IBM Plex Mono", monospace`; }
    x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, w / 2, h / 2 + 2);
  }
  // плоская стрелка-кнопка, смотрит по dir ('left' | 'right')
  function arrowBtn(kit, x, y, z, dir, key, s = 1) {
    const { T, at, cyl, clickable } = kit;
    const a = new T.Group(); at(a, x, y, z);
    const c = cyl(1.3 * s, 2.4 * s, ORANGE, { r2: 0, seg: 16 });
    c.rotation.z = dir === 'left' ? Math.PI / 2 : -Math.PI / 2;
    a.add(c); clickable(a, key);
    if (!kit.reduce) { const p0 = a.position.clone(), v = dir === 'left' ? -1 : 1; kit.onFrame((dt, t) => { a.position.x = p0.x + v * 0.35 * Math.sin(t * 4); }); }
    return a;
  }
  // пара стрелок «меньше / больше» с подписью шага между ними
  function stepper(kit, x, z, kDn, kUp, label, w = 10) {
    arrowBtn(kit, x - w / 2, Y0 + 1.6, z, 'left', kDn);
    arrowBtn(kit, x + w / 2, Y0 + 1.6, z, 'right', kUp);
    kit.at(flatLabel(kit, label, '#e8ecf4', w - 4.4, 2.2, true), x, Y0 + 0.12, z);
  }
  // кнопка-клавиша на столе: нажатая светится
  function key3(kit, x, z, w, label, on, key) {
    const { T, at, box, clickable } = kit;
    const g = new T.Group(); at(g, x, Y0, z);
    at(box(w + 1.4, 1.2, 7.4, 0x2c3240), 0, 0.6, 0, g);
    at(box(w, on ? 1.2 : 2, 6, on ? ORANGE : PANEL, on ? { matOpt: { emissive: 0xff9a2e, emissiveIntensity: 0.35 } } : {}), 0, on ? 1.8 : 2.2, 0, g);
    at(flatLabel(kit, label, on ? '#1b1610' : '#e8ecf4', w - 1, 2.6, true), 0, on ? 2.45 : 3.25, 0, g);
    clickable(g, key);
    return g;
  }
  // пул светящихся точек (фотоны, электроны)
  function pool(kit, n, col, size, op = 0.95) {
    const { T, keep } = kit;
    const mat = keep(new T.SpriteMaterial({ map: kit.glowTex(), color: col, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false }));
    const a = [];
    for (let i = 0; i < n; i++) { const s = new T.Sprite(mat); s.scale.setScalar(size); s.visible = false; s.renderOrder = 6; kit.root.add(s); a.push(s); }
    return a;
  }

  // =====================================================================================
  // 1. Фотоэффект: лампа-монохроматор светит на катод вакуумного фотоэлемента; источник и микроамперметр
  SC['quant-photo'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, v3, C } = kit;
    felt(kit);
    const TY = Y0 + 17, TZ = -6, XC = -15, XA = 15, G = XA - XC - 1.6;
    const uv = d.lam < 380, col = uv ? 0x8c7ae0 : num(d.col), Ek = Math.max(0, d.Ek || 0), U = d.U || 0, fl = clamp((d.flux || 0) / 100, 0, 1);
    // подставки и стеклянная колба без воздуха
    [-13, 13].forEach(x => {
      at(box(10, 1.4, 13, C.WOOD), x, Y0 + 0.7, TZ);
      at(box(2.6, TY - 9 - Y0 - 1.4, 2.6, C.WOOD2), x, Y0 + 1.4 + (TY - 9 - Y0 - 1.4) / 2, TZ);
      at(box(4, 1.2, 12, C.WOOD2), x, TY - 9.4, TZ);
    });
    const tube = new T.Mesh(keep(new T.CapsuleGeometry(9, 32, 10, 36)), glassMat(kit, GLASS, 0.15));
    tube.rotation.z = Math.PI / 2; tube.renderOrder = 1; at(tube, 0, TY, TZ);
    // катод — изогнутая пластина металла, вогнутая сторона смотрит на анод
    const cath = mesh(new T.CylinderGeometry(8, 8, 13, 24, 1, true, 1.5 * Math.PI - 0.62, 1.24), METALS[d.metal] ? METALS[d.metal].col : num(d.mcol), { edges: false, matOpt: { side: T.DoubleSide } });
    at(cath, XC + 8, TY, TZ);
    rod(kit, v3(XC - 0.2, TY, TZ), v3(-26, TY, TZ), 0.35, C.STEEL, { hull: false });
    at(box(1.2, 12, 7, 0xa9b4c9), XA, TY, TZ);
    rod(kit, v3(XA + 0.6, TY, TZ), v3(26, TY, TZ), 0.35, C.STEEL, { hull: false });
    [-27, 27].forEach(x => { const t = cyl(1.5, 2.6, C.DARK, { seg: 16 }); t.rotation.z = Math.PI / 2; at(t, x, TY, TZ); });
    const tC = v3(-28.4, TY, TZ), tA = v3(28.4, TY, TZ);
    // источник напряжения и микроамперметр за колбой
    const sN = kit.placeOn(kit.supply(Math.round(U * 100) / 100, 'В'), v3(-30, Y0, -34), 0, 'src');
    const aN = kit.placeOn(kit.meter({ kind: 'A', val: d.I || 0, max: 0.8, value: '' }), v3(28, Y0, -33), 0, 'am');
    const I = d.I || 0;
    kit.cable(sN.tout, aN.tin, C.WIRE.plus, I);
    kit.cable(aN.tout, tA, C.WIRE.mid, I, { lift: 3 });
    kit.cable(tC, sN.tin, C.WIRE.minus, I, { lift: 3 });
    stepper(kit, -40, -22, 'u--', 'u++', '±0,5 В');
    stepper(kit, -22, -22, 'u-', 'u+', '±0,05 В');
    // лампа с монохроматором перед колбой, светит на катод
    const Lp = v3(6, TY, 30), aim = v3(XC + 1.4, TY, TZ), dir = aim.clone().sub(Lp), th = Math.atan2(-dir.z, dir.x);
    const lg = new T.Group(); lg.position.copy(Lp); lg.rotation.y = th; kit.root.add(lg);
    at(box(16, 10, 10, PANEL), -4, 0, 0, lg);
    const noz = cyl(2.4, 5, C.DARK, { seg: 20 }); noz.rotation.z = Math.PI / 2; at(noz, 6.5, 0, 0, lg);
    const lens = cyl(2, 0.5, fl > 0 ? col : 0x3a4762, { seg: 20, edges: false, matOpt: fl > 0 ? { emissive: col, emissiveIntensity: 0.9 } : {} }); lens.rotation.z = Math.PI / 2; at(lens, 9.1, 0, 0, lg);
    const scr = new T.Mesh(keep(new T.PlaneGeometry(9, 4)), keep(new T.MeshBasicMaterial({ map: keep(kit.textTex(d.lam + ' нм', uv ? '#c9bcff' : '#86e0a8', '#0e1520', 256, 110)) })));
    scr.rotation.y = -Math.PI / 2; at(scr, -12.06, 1.5, 0, lg);
    const kn = cyl(1.6, 1.4, 0xd9dfe9, { seg: 18 }); kn.rotation.z = Math.PI / 2; at(kn, -12.6, -2.6, 0, lg);
    const hc = v3(-4, 0, 0).applyAxisAngle(v3(0, 1, 0), th).add(Lp);
    at(box(4.4, TY - 5 - Y0, 4.4, C.DARK), hc.x, Y0 + (TY - 5 - Y0) / 2, hc.z);
    stepper(kit, 14, 44, 'lam--', 'lam++', '±50 нм');
    stepper(kit, 30, 44, 'lam-', 'lam+', '±5 нм');
    const exit = v3(9.4, 0, 0).applyAxisAngle(v3(0, 1, 0), th).add(Lp);
    if (fl > 0) {
      ray(kit, exit, aim, 1.6, 3.6, col, 0.06 + 0.26 * fl);
      const sp = glow(kit, col, 6 + 6 * fl, 0.9); sp.position.copy(exit); kit.root.add(sp);
      const sp2 = glow(kit, col, 7, 0.35 + 0.4 * fl); sp2.position.copy(aim); kit.root.add(sp2);
    }
    // запасные катоды на подносе: нажмите — поставить в колбу
    at(box(31, 1.2, 13, C.WOOD2), -44, Y0 + 0.6, 22);
    ['Cs', 'Na', 'Zn'].forEach((k, i) => {
      const x = -54 + i * 10, g = new T.Group(); at(g, x, Y0 + 1.2, 22);
      if (k === d.metal) {
        at(box(7.4, 0.2, 9.4, 0x1d2433, { edges: false }), 0, 0.1, 0, g);
        at(flatLabel(kit, 'в колбе', '#8b96ad', 7, 2.2, true), 0, 0.25, 0, g);
      } else {
        at(box(7, 0.8, 9, METALS[k].col), 0, 0.4, 0, g);
        at(flatLabel(kit, k, '#1b1610', 5, 2.6, true), 0, 0.85, -1.4, g);
        at(flatLabel(kit, f(METALS[k].A, 1) + ' эВ', '#1b1610', 6, 1.8, true), 0, 0.85, 2.2, g);
        clickable(g, 'metal-' + k);
      }
    });
    // фотоны летят в катод, электроны — от катода к аноду
    const ph = pool(kit, 18, uv ? 0xc9bcff : col, 1.8), el = pool(kit, 70, CYAN, 1.9);
    const dirN = aim.clone().sub(exit), LB = dirN.length(); dirN.normalize();
    const P = [], E = [];
    const reach = Ek <= 0 ? 0 : U >= 0 ? G : Math.min(G, Ek * G / Math.max(1e-6, -U));
    if (kit.reduce) {
      if (fl > 0) for (let i = 0; i < 4; i++) { ph[i].visible = true; ph[i].position.copy(exit).addScaledVector(dirN, LB * (i + 0.5) / 4); }
      if (fl > 0 && Ek > 0) for (let i = 0; i < 10; i++) { el[i].visible = true; el[i].position.set(XC + 1.6 + reach * (i + 0.5) / 10, TY + ((i * 37) % 11 - 5) * 0.9, TZ + ((i * 53) % 9 - 4) * 0.8); }
    } else {
      let sp = 0, se = 0; const s = 30, acc = s * s * U / (2 * G);
      kit.onFrame(dt => {
        sp += dt * fl * 14;
        while (sp >= 1) { sp -= 1; if (P.length < ph.length) P.push({ u: 0, o: v3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 0) }); }
        for (const p of P) p.u += dt * 38;
        for (let i = P.length - 1; i >= 0; i--) if (P[i].u >= LB) { P.splice(i, 1); if (Ek > 0 && Math.random() < 0.8) se += 1; }
        while (se >= 1) { se -= 1; if (E.length < el.length) E.push({ x: XC + 1.6, y: TY + (Math.random() - 0.5) * 10, z: TZ + (Math.random() - 0.5) * 8, v: s * Math.sqrt(Math.max(0.03, Math.random() * Ek)) }); }
        for (const e of E) { e.v += acc * dt; e.x += e.v * dt; }
        for (let i = E.length - 1; i >= 0; i--) if (E[i].x > XA - 0.7 || E[i].x < XC + 1.4) E.splice(i, 1);
        ph.forEach((m, i) => { const p = P[i]; m.visible = !!p; if (p) m.position.copy(exit).addScaledVector(dirN, p.u).add(p.o); });
        el.forEach((m, i) => { const e = E[i]; m.visible = !!e; if (e) m.position.set(e.x, e.y, e.z); });
      });
    }
    tag(v3(Lp.x, TY + 9, Lp.z), 'Лампа · монохроматор', `λ = ${d.lam} нм · ${d.range}`, uv);
    tag(v3(XC - 2, TY + 11, TZ), 'Катод · ' + d.metal, `A = ${f(d.A, 1)} эВ`);
    tag(v3(4, TY + 13, TZ), Ek > 0 ? 'Электроны' : 'Электронов нет', Ek > 0 ? `Eк max = ${f(Ek, 2)} эВ` : `λ больше λкр = ${d.lamR} нм`, Ek <= 0);
    tag(v3(-30, Y0 + 24, -34), 'Источник', `U = ${f(U, 2)} В`);
    tag(v3(28, Y0 + 17, -33), 'Микроамперметр', `I = ${f(I, 3)} мкА`, !!d.done);
    tag(v3(-44, Y0 + 6, 22), 'Катоды', 'нажмите — сменить');
  };

  // =====================================================================================
  // 2. Фотон: лампа 1 Вт, пакеты-фотоны летят по скамье в счётчик; столбики энергии и импульса; шкала спектра
  SC['quant-photon'] = (kit, d) => {
    const { T, at, box, cyl, keep, tag, clickable, v3, C } = kit;
    felt(kit);
    const PY = Y0 + 14, col = num(d.col), X0 = -38, X1 = 40;
    at(box(86, 1.6, 6, RAIL), 0, Y0 + 0.8, 0);
    // лампа 1 Вт
    const lg = new T.Group(); at(lg, -49, 0, 0);
    at(box(4.4, PY - 6 - Y0, 4.4, C.DARK), 0, Y0 + (PY - 6 - Y0) / 2, 0, lg);
    at(box(14, 12, 12, PANEL), 0, PY, 0, lg);
    const nz = cyl(3, 4, C.DARK, { seg: 20 }); nz.rotation.z = Math.PI / 2; at(nz, 9, PY, 0, lg);
    const ln = cyl(2.6, 0.5, col, { seg: 20, edges: false, matOpt: { emissive: col, emissiveIntensity: 0.9 } }); ln.rotation.z = Math.PI / 2; at(ln, 11.2, PY, 0, lg);
    const hl = glow(kit, col, 10, 0.85); hl.position.set(11.8, PY, 0); lg.add(hl);
    at(flatLabel(kit, '1 Вт', '#e8ecf4', 8, 3, true), 0, PY + 6.06, 0, lg);
    // счётчик фотонов
    const cg = new T.Group(); at(cg, 47, 0, 0);
    at(box(4.4, PY - 8 - Y0, 4.4, C.DARK), 0, Y0 + (PY - 8 - Y0) / 2, 0, cg);
    at(box(12, 16, 14, 0x2c3240), 0, PY, 0, cg);
    const ap = cyl(3.4, 0.6, 0x0b0e14, { seg: 24, edges: false }); ap.rotation.z = Math.PI / 2; at(ap, -6.1, PY, 0, cg);
    const scr = new T.Mesh(keep(new T.PlaneGeometry(10.4, 4.6)), keep(new T.MeshBasicMaterial({ map: keep(kit.textTex(d.Ntxt, d.ok ? '#86e0a8' : '#e8ecf4', '#0e1520', 320, 130)) })));
    at(scr, 0, PY + 2.4, 7.06, cg);
    at(flatLabel(kit, 'фотонов/с', '#8b96ad', 9, 2, false), 0, PY - 2.4, 7.06, cg);
    const flash = glow(kit, col, 8, 0); flash.position.set(-6.6, PY, 0); cg.add(flash);
    // столбики: энергия одного фотона и его импульс
    const column = (x, frac, c) => {
      at(cyl(3.4, 1.4, C.DARK), x, Y0 + 0.7, -26);
      const gl = new T.Mesh(keep(new T.CylinderGeometry(2.2, 2.2, 30, 24, 1, true)), glassMat(kit, GLASS, 0.2)); at(gl, x, Y0 + 16.4, -26);
      const h = Math.max(0.3, 30 * clamp(frac, 0, 1));
      at(cyl(1.8, h, c, { edges: false, matOpt: { emissive: c, emissiveIntensity: 0.25 } }), x, Y0 + 1.4 + h / 2, -26);
      for (let k = 1; k < 4; k++) at(box(1.4, 0.15, 0.3, 0xe8ecf4, { edges: false, shadow: false }), x + 2.4, Y0 + 1.4 + k * 7.5, -26);
    };
    column(-16, d.E / 12.4, ORANGE); column(0, d.pk, CYAN);
    // шкала спектра 100…1000 нм с ползунком
    const sx = nm => -50 + (nm - 100) / 900 * 100;
    at(box(106, 1, 9, C.WOOD2), 0, Y0 + 0.5, 28);
    {
      const c = document.createElement('canvas'); c.width = 900; c.height = 32; const x = c.getContext('2d');
      for (let i = 0; i < 900; i++) { x.fillStyle = wlColor(100 + i); x.fillRect(i, 0, 1, 32); }
      const t = keep(new T.CanvasTexture(c)); t.colorSpace = T.SRGBColorSpace;
      const st = new T.Mesh(keep(new T.PlaneGeometry(100, 4)), keep(new T.MeshBasicMaterial({ map: t }))); st.rotation.x = -Math.PI / 2; at(st, 0, Y0 + 1.03, 27);
    }
    [['УФ', 240], ['видимый свет', 580], ['ИК', 890]].forEach(([s, nm]) => at(flatLabel(kit, s, '#e8ecf4', s.length > 3 ? 14 : 5, 2, true), sx(nm), Y0 + 1.05, 30.8));
    const mk = new T.Group(); at(mk, sx(d.lam), Y0 + 1, 27);
    at(cyl(1.5, 2.6, ORANGE, { seg: 18 }), 0, 1.5, 0, mk);
    at(box(0.4, 0.3, 5, 0x1b1610, { edges: false, shadow: false }), 0, 0.1, 0, mk);
    stepper(kit, -30, 38, 'l2-10', 'l2+10', '±10 нм');
    stepper(kit, -14, 38, 'l2-', 'l2+', '±1 нм');
    // светофильтры-карточки: быстрый выбор длины волны
    [400, 530, 650].forEach((nm, i) => {
      const on = d.lam === nm, g = new T.Group(); at(g, 8 + i * 12, Y0, 40);
      at(box(9, 1, 4, C.DARK), 0, 0.5, 0, g);
      at(box(8, 6, 0.8, num(wlColor(nm)), on ? { matOpt: { emissive: num(wlColor(nm)), emissiveIntensity: 0.5 } } : {}), 0, 4, 0, g);
      at(flatLabel(kit, nm + ' нм', '#1b1610', 7, 2, false), 0, 4, 0.45, g);
      if (on) { const h = glow(kit, num(wlColor(nm)), 9, 0.5); h.position.set(0, 4, 0.6); g.add(h); }
      clickable(g, 'p-' + nm);
    });
    // фотоны: волновые пакеты в масштабе длины волны
    const lp = clamp(d.lam / 55, 2, 18), Lpk = lp * 2.2, A = 2.4, pts = [];
    for (let i = 0; i <= 90; i++) { const u = i / 90, x = -Lpk / 2 + u * Lpk; pts.push(v3(x, A * Math.sin(Math.PI * u) * Math.sin(2 * Math.PI * x / lp), 0)); }
    const geo = keep(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 180, 0.34, 6)), mat = basic(kit, col);
    const gm = keep(new T.SpriteMaterial({ map: kit.glowTex(), color: col, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false }));
    const pk = [];
    for (let i = 0; i < 14; i++) {
      const g = new T.Group(); g.add(new T.Mesh(geo, mat)); const s = new T.Sprite(gm); s.scale.set(Lpk * 0.9, 7, 1); g.add(s);
      g.visible = false; at(g, X0, PY, 0); pk.push(g);
    }
    if (kit.reduce) [0.2, 0.55, 0.85].forEach((u, i) => { pk[i].visible = true; pk[i].position.x = X0 + u * (X1 - X0); });
    else {
      let sp = 0.6, fk = 0; const F = [], rate = d.N / 1e18 * 0.9;
      kit.onFrame(dt => {
        sp += dt * rate;
        while (sp >= 1) { sp -= 1; if (F.length < pk.length) F.push(X0 + Lpk / 2); }
        for (let i = 0; i < F.length; i++) F[i] += dt * 26;
        for (let i = F.length - 1; i >= 0; i--) if (F[i] >= X1 + Lpk / 2) { F.splice(i, 1); fk = 1; }
        pk.forEach((g, i) => { g.visible = i < F.length; if (g.visible) g.position.x = F[i]; });
        fk = Math.max(0, fk - dt * 3); flash.material.opacity = fk;
      });
    }
    tag(v3(-49, PY + 10, 0), 'Лампа 1 Вт', `λ = ${d.lam} нм · ${d.range}`);
    tag(v3(47, PY + 11, 0), 'Счётчик фотонов', d.Ntxt + ' в секунду', !!d.ok);
    tag(v3(-16, Y0 + 34, -26), 'Энергия фотона', `E = ${f(d.E, 2)} эВ`);
    tag(v3(0, Y0 + 34, -26), 'Импульс', `p = ${d.ptxt} кг·м/с`);
    tag(v3(sx(d.lam), Y0 + 6, 27), 'Шкала спектра', `${d.lam} нм`);
  };

  // =====================================================================================
  // 3. Лазер: кристалл рубина с атомами, спиральная лампа накачки, зеркала резонатора, измеритель мощности
  const ORD = (() => { const a = Array.from({ length: 42 }, (_, i) => i); let s = 11; for (let i = a.length - 1; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; })();
  SC['quant-laser'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, v3, C } = kit;
    felt(kit);
    const RY = Y0 + 16, MX = 34, pump = clamp((d.pump || 0) / 100, 0, 1);
    at(box(96, 1.6, 8, RAIL), 0, Y0 + 0.8, 0);
    // держатели кристалла
    [-20, 20].forEach(x => { at(box(4, RY - 4 - Y0 - 1.6, 3, C.DARK), x, Y0 + 1.6 + (RY - 4 - Y0 - 1.6) / 2, 0); at(box(5, 1, 5, C.STEEL), x, RY - 4.2, 0); });
    // кристалл рубина
    const rodG = new T.Mesh(keep(new T.CylinderGeometry(4, 4, 58, 36)), glassMat(kit, RUBY, 0.22)); rodG.rotation.z = Math.PI / 2; rodG.renderOrder = 1; at(rodG, 0, RY, 0);
    [-29, 29].forEach(x => { const e = cyl(4.05, 0.3, 0xff8a96, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.5 } }); e.rotation.z = Math.PI / 2; at(e, x, RY, 0); });
    // атомы хрома: оранжевые — на уровне 2, серые — на уровне 1
    const geoA = keep(new T.SphereGeometry(0.9, 14, 10));
    const mEx = keep(new T.MeshToonMaterial({ color: ORANGE, gradientMap: kit.grad, emissive: 0xff9a2e, emissiveIntensity: 0.6 })), mGr = keep(new T.MeshToonMaterial({ color: 0x56627d, gradientMap: kit.grad }));
    const atoms = [], halos = [];
    for (let r = 0; r < 3; r++) for (let i = 0; i < 14; i++) {
      const a = r * 2 * Math.PI / 3 + i * 0.5, p = v3(-26 + i * 4 + (r - 1) * 1.2, RY + Math.cos(a) * 2.2, Math.sin(a) * 2.2);
      const m = new T.Mesh(geoA, mGr); m.position.copy(p); kit.root.add(m); atoms.push(m);
      const h = glow(kit, ORANGE, 3.2, 0.55); h.position.copy(p); h.visible = false; kit.root.add(h); halos.push(h);
    }
    // спиральная лампа-вспышка вокруг кристалла
    const hp = []; for (let i = 0; i <= 360; i++) { const a = i / 360 * Math.PI * 2 * 9; hp.push(v3(-26 + i / 360 * 52, RY + Math.cos(a) * 7.2, Math.sin(a) * 7.2)); }
    const fmat = keep(new T.MeshBasicMaterial({ color: pump > 0 ? 0xfff3c4 : 0x9aa3b2, transparent: true, opacity: 0.55 }));
    const helix = new T.Mesh(keep(new T.TubeGeometry(new T.CatmullRomCurve3(hp), 720, 0.6, 8)), fmat); kit.root.add(helix);
    const fl = [-16, 0, 16].map(x => { const s = glow(kit, 0xfff1c0, 16, 0); s.position.set(x, RY, 0); kit.root.add(s); return s; });
    const h0 = hp[0], h1 = hp[hp.length - 1];
    rod(kit, h0, v3(h0.x - 2, Y0 + 5, h0.z + 6), 0.35, C.STEEL, { hull: false }); rod(kit, h1, v3(h1.x + 2, Y0 + 5, h1.z + 6), 0.35, C.STEEL, { hull: false });
    // блок накачки
    const sN = kit.placeOn(kit.supply(d.pump, '%'), v3(-36, Y0, 32), 0, 'pump');
    kit.cable(sN.tout, v3(h1.x + 2, Y0 + 5, h1.z + 6), C.WIRE.plus, pump * 0.6, { lift: 4 });
    kit.cable(sN.tin, v3(h0.x - 2, Y0 + 5, h0.z + 6), C.WIRE.minus, pump * 0.6, { lift: 4 });
    stepper(kit, -36, 45, 'pump-', 'pump+', '±5 %');
    // зеркала резонатора: глухое слева, полупрозрачное справа
    [-MX, MX].forEach((x, i) => {
      const g = new T.Group(); at(g, x, 0, 0);
      at(box(5, 1.2, 7, C.DARK), 0, Y0 + 2.2, 0, g);
      const ph = RY - 6.4 - Y0 - 2.8; at(cyl(0.6, ph, C.STEEL, { edges: false }), 0, Y0 + 2.8 + ph / 2, 0, g);
      const ring = mesh(new T.TorusGeometry(6, 0.8, 10, 32), C.DARK, { edges: false }); ring.rotation.y = Math.PI / 2; at(ring, 0, RY, 0, g);
      if (d.mirrors) {
        const disc = i === 0 ? cyl(5.6, 0.9, 0xdfe6f0, { seg: 36, matOpt: { emissive: 0x8fa0b8, emissiveIntensity: 0.25 } })
          : mesh(new T.CylinderGeometry(5.6, 5.6, 0.9, 36), 0, { mat: glassMat(kit, 0xc8d1e2, 0.5), edges: false });
        disc.rotation.z = Math.PI / 2; at(disc, 0, RY, 0, g);
      }
      clickable(g, 'mir');
    });
    if (!d.mirrors) [-8, 6].forEach((x, i) => {
      const g = new T.Group(); at(g, x, Y0, 22);
      at(box(9, 0.8, 9, C.WOOD2), 0, 0.4, 0, g);
      at(cyl(4.4, 0.8, i === 0 ? 0xdfe6f0 : 0xc8d1e2, { seg: 32 }), 0, 1.2, 0, g);
      at(flatLabel(kit, i === 0 ? '100 %' : '95 %', '#1b1610', 5, 1.8, true), 0, 1.65, 0, g);
      clickable(g, 'mir');
    });
    // луч и измеритель мощности
    const beamC = ray(kit, v3(MX + 0.5, RY, 0), v3(54, RY, 0), 0.45, 0.45, 0xff6b6b, 0, false);
    const beamG = ray(kit, v3(MX + 0.5, RY, 0), v3(54, RY, 0), 1.4, 1.4, 0xff3b3b, 0);
    const dot = glow(kit, 0xff4d4d, 6, 0); dot.position.set(54.2, RY, 0); kit.root.add(dot);
    const pm = new T.Group(); at(pm, 58, 0, 0);
    at(box(4, RY - 5 - Y0, 4, C.DARK), 0, Y0 + (RY - 5 - Y0) / 2, 0, pm);
    at(box(7, 10, 11, 0x2c3240), 0, RY, 0, pm);
    const pa = cyl(3.6, 0.5, 0x0b0e14, { seg: 24, edges: false }); pa.rotation.z = Math.PI / 2; at(pa, -3.6, RY, 0, pm);
    const disp = liveScreen(kit, 9, 4.2, 256, 120, (x, w, h, txt, ok) => digits(x, w, h, txt, ok ? '#86e0a8' : '#e8ecf4'));
    at(disp.m, 0, RY + 1.6, 5.56, pm);
    // фотоны в резонаторе и спонтанные фотоны
    const cav = pool(kit, 48, 0xff4d4d, 1.6), spn = pool(kit, 6, 0xff7a7a, 1.4);
    const tR = liveTag(kit, v3(0, RY + 11, 0), 'Кристалл рубина', 'уровень 2: 0 %');
    const tP = liveTag(kit, v3(58, RY + 9, 0), 'Измеритель', '0 мВт');
    let nShown = -1, lastTxt = '';
    const tick = (dt, t) => {
      const L = live(), n2 = clamp(L.n2 || 0, 0, 1), q = Math.max(0, L.q || 0), P = Math.max(0, L.P || 0);
      const nEx = Math.round(n2 * 42);
      if (nEx !== nShown) { nShown = nEx; const ex = new Set(ORD.slice(0, nEx)); atoms.forEach((m, i) => { const on = ex.has(i); m.material = on ? mEx : mGr; halos[i].visible = on; }); }
      const fk = kit.reduce ? 1 : 0.75 + 0.25 * Math.sin(t * 27) * Math.sin(t * 19);
      fmat.opacity = pump > 0 ? 0.35 + 0.6 * pump * fk : 0.5;
      fl.forEach(s => { s.material.opacity = 0.55 * pump * fk; });
      const nph = Math.min(cav.length, Math.round(q * 160));
      cav.forEach((s, i) => {
        s.visible = i < nph; if (!s.visible) return;
        const sp = 0.09 + (i % 7) * 0.006, ph = ((kit.reduce ? 0 : t) * sp * 10 + i * 0.137) % 2, u = ph < 1 ? ph : 2 - ph;
        s.position.set(-28 + u * 56, RY + (((i * 37) % 47) / 47 - 0.5) * 5, (((i * 53) % 41) / 41 - 0.5) * 5);
      });
      const cyc = Math.floor(t / 0.7), k = (t % 0.7) / 0.7, ns = kit.reduce ? 0 : Math.round(n2 * 6);
      spn.forEach((s, i) => {
        s.visible = i < ns; if (!s.visible) return;
        const a = atoms[ORD[(i * 5 + cyc) % Math.max(1, nEx)] ?? 0].position, ang = (i * 2.4 + cyc * 1.7) % 6.28;
        s.position.set(a.x + Math.cos(ang) * 3 * k, a.y + Math.sin(ang) * 14 * k, a.z + Math.cos(ang * 1.3) * 14 * k);
        s.material.opacity = 1 - k;
      });
      const op = P > 0.5 ? clamp(P / 60, 0.15, 1) : 0;
      if (beamC) beamC.material.opacity = op * 0.95; if (beamG) beamG.material.opacity = op * 0.4; dot.material.opacity = op;
      const ok = P >= (d.need || 30), txt = f(P, P < 1 ? 2 : 1) + ' мВт';
      if (txt + ok !== lastTxt) { lastTxt = txt + ok; disp.redraw(txt, ok); }
      tR.set(`уровень 2: ${Math.round(n2 * 100)} %` + (d.nth < 1 ? ` · порог ${Math.round(d.nth * 100)} %` : ''), d.nth < 1 && n2 >= d.nth - 0.005);
      tP.set('луч ' + txt, ok);
    };
    tick(0, 0);
    kit.onFrame(tick);
    // выбор схемы уровней
    key3(kit, 8, 36, 11, '2 уровня', d.lv === 2, 'lv-2');
    key3(kit, 22, 36, 11, '3 уровня', d.lv === 3, 'lv-3');
    tag(v3(15, Y0 + 6, 36), 'Схема уровней', d.lv === 3 ? 'три — инверсия возможна' : 'две — инверсии нет', d.lv === 2);
    tag(v3(-36, Y0 + 24, 32), 'Лампа накачки', `накачка ${d.pump} %`);
    tag(d.mirrors ? v3(-MX, RY + 9, 0) : v3(-1, Y0 + 6, 22), d.mirrors ? 'Зеркала' : 'Зеркала сняты', d.mirrors ? '100 % и 95 %' : 'нажмите — поставить', !d.mirrors);
  };

  // =====================================================================================
  // 4. Волны и частицы: вакуумная камера, электронная пушка, щели, датчик, экран и счётчик по полоскам
  SC['quant-wave'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, tag, clickable, v3, C } = kit;
    felt(kit);
    const CY = Y0 + 16, ZG = -29, ZM = -6, ZS = 34.5, SW = 26, SH = 20;
    const two = d.slits === 2, coh = two && !d.det, SX = two ? [-1.6, 1.6] : [0];
    // стеклянная камера на опорах
    [-30, 20].forEach(z => at(box(22, 2, 6, C.DARK), 0, Y0 + 1, z));
    const ch = box(28, 26, 76, GLASS, { matOpt: { transparent: true, opacity: 0.1, depthWrite: false }, shadow: false }); ch.renderOrder = 1; at(ch, 0, Y0 + 2 + 13, -4);
    // электронная пушка: нить накала и ускоряющий анод
    const gun = cyl(3.2, 9, C.DARK, { seg: 24 }); gun.rotation.x = Math.PI / 2; at(gun, 0, CY, -36);
    const an = mesh(new T.TorusGeometry(2.6, 0.5, 10, 24), C.STEEL, { edges: false }); at(an, 0, CY, ZG - 0.6);
    const fil = glow(kit, 0xffa04a, 5, 0.9); fil.position.set(0, CY, -31.2); kit.root.add(fil);
    const tb = cyl(1.4, 3, C.DARK, { seg: 16 }); tb.rotation.x = Math.PI / 2; at(tb, 0, CY - 6, -42.6);
    rod(kit, v3(0, CY - 3.2, -38), v3(0, CY - 6, -41.4), 0.35, C.STEEL, { hull: false });
    // источник ускоряющего напряжения
    const sN = kit.placeOn(kit.supply(d.U, 'В'), v3(-40, Y0, 6), 0, 'src');
    kit.cable(sN.tout, v3(1.2, CY - 6, -44.2), C.WIRE.plus, 0, { lift: 4 });
    kit.cable(sN.tin, v3(-1.2, CY - 6, -44.2), C.WIRE.minus, 0, { lift: 4 });
    stepper(kit, -46, 22, 'U4-10', 'U4+10', '±10 В');
    stepper(kit, -32, 22, 'U4-1', 'U4+1', '±1 В');
    // преграда со щелями
    const mg = new T.Group(); at(mg, 0, CY, ZM);
    const edgesX = [-SW / 2]; SX.forEach(x => edgesX.push(x - 0.5, x + 0.5)); edgesX.push(SW / 2);
    for (let i = 0; i < edgesX.length; i += 2) { const w = edgesX[i + 1] - edgesX[i]; if (w > 0.05) at(box(w, 22, 0.8, 0xa9b4c9, { edges: w > 1 }), (edgesX[i] + edgesX[i + 1]) / 2, 0, 0, mg); }
    at(box(SW + 1, 1.4, 1.4, C.DARK), 0, 11.6, 0, mg); at(box(SW + 1, 1.4, 1.4, C.DARK), 0, -11.6, 0, mg);
    SX.forEach(x => { const s = glow(kit, CYAN, 3, 0.35); s.position.set(x, 0, 0.6); mg.add(s); });
    clickable(mg, 'slits');
    // датчик у щелей
    const dg = new T.Group(); at(dg, 7, CY + 8, ZM + 3);
    at(box(3.4, 2.6, 3.4, 0x2c3240), 0, 0, 0, dg);
    const lensD = cyl(1.1, 0.8, d.det ? 0xff5a3c : 0x56627d, { seg: 16, edges: false, matOpt: d.det ? { emissive: 0xff3c1e, emissiveIntensity: 0.9 } : {} }); lensD.rotation.x = Math.PI / 2; at(lensD, -1.2, -0.8, -1.9, dg);
    const dGlow = glow(kit, 0xff5a3c, 5, d.det ? 0.6 : 0); dGlow.position.set(-1.2, -0.8, -2.4); dg.add(dGlow);
    clickable(dg, 'det');
    // экран с люминофором
    at(box(SW + 2, SH + 2, 0.6, C.DARK), 0, CY, ZS - 0.4);
    const scr = liveScreen(kit, SW, SH, 520, 400, () => {});
    scr.x.fillStyle = '#07110f'; scr.x.fillRect(0, 0, 520, 400); scr.redraw();
    at(scr.m, 0, CY, ZS);
    const hitF = glow(kit, CYAN, 3.5, 0); kit.root.add(hitF);
    // монитор: счётчик по полоскам и предсказание волны
    const mon = new T.Group(); at(mon, 40, 0, -4); mon.rotation.y = -0.4;
    at(box(8, 1.2, 7, C.DARK), 0, Y0 + 0.6, 0, mon); at(box(2, 12, 2, C.DARK), 0, Y0 + 7, -1, mon);
    at(box(31, 19, 1.6, 0x2c3240), 0, Y0 + 21, -1, mon);
    const pd = d.pd || [];
    const hist = liveScreen(kit, 28.6, 16.6, 400, 232, (x, w, h, bins) => {
      x.fillStyle = '#0e1520'; x.fillRect(0, 0, w, h);
      const n = bins.length || 1, bw = (w - 24) / n, mx = Math.max(1, ...bins), base = h - 22;
      x.fillStyle = '#ffb547'; bins.forEach((c, i) => { if (c) { const bh = c / mx * (base - 14); x.fillRect(12 + i * bw, base - bh, Math.max(1, bw - 1), bh); } });
      if (pd.length) { x.strokeStyle = 'rgba(232,236,244,.85)'; x.lineWidth = 2; x.setLineDash([5, 4]); x.beginPath(); pd.forEach((v, i) => { const px = 12 + (i + 0.5) * (w - 24) / pd.length, py = base - v * (base - 14); i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke(); x.setLineDash([]); }
      x.fillStyle = '#26324a'; x.fillRect(12, base, w - 24, 2);
      x.fillStyle = '#8b96ad'; x.font = '500 15px "IBM Plex Mono", monospace'; x.textAlign = 'left'; x.fillText('−400 мкм', 12, h - 4); x.textAlign = 'right'; x.fillText('+400 мкм', w - 12, h - 4); x.textAlign = 'center'; x.fillText('0', w / 2, h - 4);
    });
    at(hist.m, 0, Y0 + 21, -0.18, mon);
    // кнопки режима
    key3(kit, 22, 42, 11, 'Быстро', !!d.fast, 'fast');
    key3(kit, 36, 42, 12, 'Очистить', false, 'clr');
    // волновые фронты (по одному электрону), поток (быстро), вспышки на экране
    const ringGeo = keep(new T.RingGeometry(0.93, 1, 56, 1, Math.PI, Math.PI)), rings = [];
    for (let i = 0; i < 8; i++) { const r = new T.Mesh(ringGeo, keep(new T.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending }))); r.rotation.x = -Math.PI / 2; r.visible = false; r.renderOrder = 4; kit.root.add(r); rings.push(r); }
    const stream = pool(kit, 14, CYAN, 1.5);
    const tS = liveTag(kit, v3(0, CY + SH / 2 + 3, ZS), 'Экран', 'электронов: 0');
    const toScr = (sx, sy) => [((250 - sy) / 0.275 + 400) / 800, (sx - 408) / 54]; // точка схемы → доли экрана (поперёк полос, вдоль)
    let lastN = -1, lastH = -1, hk = 0, histT = 0;
    const tick = (dt, t) => {
      const L = live(), n = L.n | 0, P = L.pts || [];
      if (n < lastN) { scr.x.fillStyle = '#07110f'; scr.x.fillRect(0, 0, 520, 400); lastN = 0; }
      if (n > lastN) {
        const k = Math.min(n - Math.max(0, lastN), P.length / 2), x = scr.x;
        x.fillStyle = '#8ff3ff';
        for (let i = P.length / 2 - k; i < P.length / 2; i++) { const [u, v] = toScr(P[2 * i], P[2 * i + 1]); x.fillRect(u * 520 - 1.5, (1 - v) * 400 - 1.5, 3, 3); }
        if (k > 0) { scr.redraw(); if (!d.fast) { const [u, v] = toScr(P[P.length - 2], P[P.length - 1]); hitF.position.set(-SW / 2 + u * SW, CY - SH / 2 + v * SH, ZS + 0.3); hk = 1; } }
        lastN = n;
      }
      hk = Math.max(0, hk - dt * 3); hitF.material.opacity = hk;
      histT -= dt; if (n !== lastH && histT <= 0) { lastH = n; histT = 0.25; hist.redraw(L.bins || []); }
      tS.set(`электронов: ${n}`, n >= 1000 && coh);
      // волны
      let ri = 0, flashD = false;
      if (!d.fast) for (const fe of (L.fl || [])) {
        const k = fe.k;
        if (k < 0.45) { if (ri < rings.length) { const r = rings[ri++]; r.visible = true; r.position.set(0, CY, ZG); r.scale.setScalar(1 + k / 0.45 * 22); r.material.opacity = 0.7; } }
        else if (k < 1) {
          const srcs = coh ? SX : [two ? (fe.y < 0 ? SX[1] : SX[0]) : 0];
          if (d.det && k < 0.55) flashD = true;
          for (const sx of srcs) if (ri < rings.length) { const r = rings[ri++]; r.visible = true; r.position.set(sx, CY, ZM + 0.5); r.scale.setScalar(0.6 + (k - 0.45) / 0.55 * 40); r.material.opacity = Math.max(0, 0.7 - (k - 0.45)); }
        }
      }
      for (; ri < rings.length; ri++) rings[ri].visible = false;
      if (d.det) dGlow.material.opacity = flashD ? 1 : 0.5;
      stream.forEach((s, i) => {
        s.visible = !!d.fast && !kit.reduce; if (!s.visible) return;
        const u = ((t * 1.6 + i / stream.length) % 1);
        s.position.set(Math.sin(i * 7.3) * 1.2 * u, CY + Math.cos(i * 3.1) * 1.2 * u, ZG + u * (ZM - ZG));
      });
    };
    tick(0, 0);
    kit.onFrame(tick);
    const ok = Math.abs(d.lam - 0.05) / 0.05 <= 0.006;
    tag(v3(0, CY + 6, -36), 'Электронная пушка', `λ = ${f(d.lam, 4)} нм`, ok);
    tag(v3(-40, Y0 + 24, 6), 'Ускоряющее U', `${d.U} В`);
    tag(v3(0, CY + 14, ZM), two ? 'Две щели' : 'Одна щель', 'нажмите — сменить');
    tag(v3(7, CY + 12, ZM + 3), 'Датчик', d.det ? 'следит — полос нет' : 'выключен', d.det);
    tag(v3(40, Y0 + 33, -4), 'По полоскам', coh ? `Δx = ${f(d.dx, 0)} мкм` : 'полос нет');
  };
})();
