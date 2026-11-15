// «Как в жизни» для темы «Измерения и единицы» (labs/phys-measure):
// линейка с карандашом/болтом и лупой, маятник на штативе с секундомером, рычажные весы с гирями,
// мензурка, термометр в стакане и спидометр с лупой у шкалы, эталоны СИ с карточками и множителями.
// Сцены строятся из window.LUCH_REAL() опыта; плавное движение (маятник, коромысло, секундомер) — из LUCH_REAL.live().
(() => {
  const SC = window.LUCH_REAL_SCENES = window.LUCH_REAL_SCENES || {};
  const live = () => { try { return (window.LUCH_REAL && window.LUCH_REAL.live && window.LUCH_REAL.live()) || {}; } catch (e) { return {}; } };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (x, n = 0) => { let s = (Math.round(x * 10 ** n) / 10 ** n).toFixed(n); if (/^-0(\.0+)?$/.test(s)) s = s.slice(1); return s.replace('.', ',').replace('-', '−'); };
  const smooth = t => t * t * (3 - 2 * t);
  const mem = {};
  const lastTag = () => { const l = document.querySelectorAll('.rl-view .rl-lbl'); return l[l.length - 1] || null; };
  function liveTag(kit, p, name, value, hot) {
    kit.tag(p, name, value, hot);
    const el = lastTag(), i = el && el.querySelector('i');
    let shown = value, hs = !!hot;
    return { p, set(v, h) { if (i && v !== shown) { shown = v; i.textContent = v; } if (el && h != null && !!h !== hs) { hs = !!h; el.classList.toggle('hot', hs); } } };
  }

  function H(kit) {
    const { T, at, box, cyl, keep, grad, textTex, clickable } = kit;
    const v3 = (x, y, z) => new T.Vector3(x, y, z);
    const ownMat = (color, o = {}) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, ...o }));
    const glassMat = (color = 0xd8eef8, opacity = 0.26) => keep(new T.MeshToonMaterial({ color, gradientMap: grad, transparent: true, opacity, side: T.DoubleSide, depthWrite: false }));
    const flat = (w, h, tex, transparent = true) => new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: keep(tex), transparent })));
    const label = (w, h, txt, fg = '#1b1610', bg = '#fff6e6') => flat(w, h, textTex(txt, fg, bg, Math.round(64 * w / h), 64));
    const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h); const t = keep(new T.CanvasTexture(c)); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; };
    function rodAB(parent, a, b, r, color, o = {}) {
      const dv = b.clone().sub(a), L = dv.length();
      const m = cyl(r, L, color, { edges: false, ...o });
      m.quaternion.setFromUnitVectors(v3(0, 1, 0), dv.normalize());
      return at(m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, parent);
    }
    function screen(w, h, txt, fg = '#86e0a8', pw = 320, ph = 120, bg = '#0e1520') {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph; const x = c.getContext('2d');
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace;
      let cur = null;
      const set = (t, col = fg) => {
        t = String(t); if (cur === t + col) return; cur = t + col;
        x.fillStyle = bg; x.fillRect(0, 0, pw, ph); x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle';
        const lines = t.split('\n'), lh = ph / lines.length;
        lines.forEach((ln, i) => {
          let fs = Math.round(lh * (i ? 0.56 : 0.66)); x.font = `600 ${fs}px "IBM Plex Mono", monospace`;
          const tw = x.measureText(ln).width; if (tw > pw * 0.9) { fs = Math.floor(fs * pw * 0.9 / tw); x.font = `600 ${fs}px "IBM Plex Mono", monospace`; }
          x.fillText(ln, pw / 2, lh * (i + 0.5) + 2);
        });
        tex.needsUpdate = true;
      };
      set(txt);
      const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: tex })));
      m.userData.set = set; return m;
    }
    function button(parent, x, y, z, txt, color, key, w = 4.2, d = 3.6) {
      const b = new T.Group(); at(b, x, y, z, parent);
      at(box(w, 1.4, d, color), 0, 0.7, 0, b);
      const top = flat(w * 0.88, d * 0.8, textTex(txt, '#ffffff', '#' + color.toString(16).padStart(6, '0'), Math.round(96 * w / d), 96), false);
      top.rotation.x = -Math.PI / 2; at(top, 0, 1.42, 0, b);
      clickable(b, key); return b;
    }
    // тетрадь: открытый разворот, текст на правой странице
    function notebook(parent, x, z, rotY, lines, key) {
      const g = new T.Group(); at(g, x, 0, z, parent); g.rotation.y = rotY; if (key) clickable(g, key);
      at(box(26, 0.8, 17, 0x3a6fb5), 0, 0.4, 0, g);
      at(box(12.4, 0.5, 16, 0xfbf7ec, { edges: false }), -6.4, 1.05, 0, g); at(box(12.4, 0.5, 16, 0xfbf7ec, { edges: false }), 6.4, 1.05, 0, g);
      const tex = canvasTex(256, 330, (c, w, h) => {
        c.fillStyle = '#fbf7ec'; c.fillRect(0, 0, w, h);
        c.strokeStyle = '#b9d0ea'; c.lineWidth = 2; for (let y = 34; y < h; y += 30) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
        c.strokeStyle = '#e7a0a0'; c.beginPath(); c.moveTo(22, 0); c.lineTo(22, h); c.stroke();
        lines.forEach((ln, i) => {
          const [t, col] = Array.isArray(ln) ? ln : [ln, '#22325a'];
          let fs = 23; c.font = `600 ${fs}px "IBM Plex Mono", monospace`; const tw = c.measureText(t).width; if (tw > w - 34) { fs = Math.floor(fs * (w - 34) / tw); c.font = `600 ${fs}px "IBM Plex Mono", monospace`; }
          c.fillStyle = col; c.textBaseline = 'alphabetic'; c.fillText(t, 28, 58 + i * 60);
        });
      });
      const pg = flat(12, 15.4, tex, false); pg.rotation.x = -Math.PI / 2; at(pg, 6.4, 1.32, 0, g);
      const lt = canvasTex(256, 330, (c, w, h) => { c.fillStyle = '#fbf7ec'; c.fillRect(0, 0, w, h); c.strokeStyle = '#b9d0ea'; c.lineWidth = 2; for (let y = 34; y < h; y += 30) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } c.fillStyle = '#22325a'; c.font = '700 30px "Golos Text", sans-serif'; c.textAlign = 'center'; c.fillText('Измерения', w / 2, 70); });
      const pl = flat(12, 15.4, lt, false); pl.rotation.x = -Math.PI / 2; at(pl, -6.4, 1.32, 0, g);
      at(cyl(0.35, 14, 0x2c3240, { edges: false }), 9.5, 1.7, 9.6, g).rotation.z = Math.PI / 2;
      return g;
    }
    // лупа на стойке: диск с картинкой, рамка, ручка к стойке
    function magnifier(parent, x, y, z, r, tex, armDx = 1, rotY = 0.55, rodH = y) {
      const g = new T.Group(); at(g, x, y, z, parent); g.rotation.y = rotY;
      const fr = kit.mesh(new T.TorusGeometry(r, 0.6, 10, 44), 0x2c3240, { edges: false, hull: true }); at(fr, 0, 0, 0, g);
      at(new T.Mesh(keep(new T.CircleGeometry(r, 44)), keep(new T.MeshBasicMaterial({ map: tex }))), 0, 0, 0.05, g);
      at(new T.Mesh(keep(new T.CircleGeometry(r, 44)), keep(new T.MeshBasicMaterial({ color: 0xdff2fb, transparent: true, opacity: 0.12, depthWrite: false }))), 0, 0, 0.12, g);
      const arm = cyl(0.45, 6, 0x9aa3b2, { edges: false }); arm.rotation.z = Math.PI / 2; at(arm, armDx * (r + 3), 0, 0, g);
      g.updateMatrixWorld(true);
      const end = v3(armDx * (r + 6), 0, 0).applyMatrix4(g.matrixWorld);
      at(cyl(3.4, 1, kit.C.DARK), end.x, 0.5, end.z, parent);
      at(cyl(0.45, rodH + 2, 0x9aa3b2, { edges: false }), end.x, (rodH + 2) / 2, end.z, parent);
      return g;
    }
    return { v3, ownMat, glassMat, flat, label, canvasTex, rodAB, screen, button, notebook, magnifier };
  }

  // ---------- линейка: 15 см, ноль в 6 мм от края, деления через price мм ----------
  const S6 = 0.6, RW = 7;                           // 1 мм = 0,6 ед.; ширина линейки
  function rulerTex(h, price) {
    const PX = 12;                                  // пикселей на мм
    return h.canvasTex(162 * PX, Math.round(RW / S6 * PX), (c, w, hh) => {
      c.fillStyle = '#e9dcb4'; c.fillRect(0, 0, w, hh);
      c.fillStyle = 'rgba(160,120,60,.08)'; for (let i = 0; i < 40; i++) c.fillRect(0, i * hh / 40, w, 1);
      c.strokeStyle = '#1d2433'; c.fillStyle = '#1d2433'; c.textAlign = 'center'; c.textBaseline = 'middle';
      for (let i = 0; i <= 150; i += price) {
        const x = (6 + i) * PX, L = i % 10 === 0 ? 46 : i % 5 === 0 ? 32 : 20;
        c.lineWidth = i % 10 === 0 ? 3 : 2; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, L); c.stroke();
        if (i % 10 === 0) { c.font = '700 34px "IBM Plex Mono", monospace'; c.fillText(String(i / 10), x, 74); }
      }
      c.font = '600 22px "Golos Text", sans-serif'; c.textAlign = 'right'; c.fillStyle = '#5b6478';
      c.fillText('см · цена деления 1 ' + (price === 10 ? 'см' : 'мм'), w - 20, hh - 18);
    });
  }
  function ruler(kit, h, parent, x0, z0, price) {    // x0 — где ноль; задний край линейки — z0
    const { T, at, box } = kit;
    const g = new T.Group(); at(g, x0, 0, z0, parent);
    at(box(162 * S6, 0.7, RW, 0xe0cfa0), (75 - 6 + 6) * S6, 0.35, RW / 2, g);
    const top = h.flat(162 * S6, RW, rulerTex(h, price), false); top.rotation.x = -Math.PI / 2; at(top, (81 - 6) * S6, 0.71, RW / 2, g);
    return g;
  }

  // ===== «Длина» и «Погрешность»: предмет, линейка, лупа, тетрадь =====
  SC['meas-len'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const pencil = d.obj.name === 'карандаш', mm = d.obj.mm, X0 = pencil ? -48 : -34;
    const OR = pencil ? 1.4 : 2.6, OZ = -0.6 - OR;
    const xm = m => X0 + m * S6, tipX = xm(mm);
    // предмет
    const ob = new T.Group(); at(ob, 0, OR, OZ, g);
    const along = (r, a, b, col, o = {}) => { const m = cyl(r, (b - a) * S6, col, o); m.rotation.z = -Math.PI / 2; at(m, xm((a + b) / 2), 0, 0, ob); return m; };
    if (pencil) {
      along(1.3, 0, 8, 0xf29bb0, { seg: 18 });
      along(1.42, 8, 12, 0xc8d1e2, { seg: 18 });
      const body = along(1.4, 12, mm - 18, 0xf2b134, { seg: 6 }); body.rotation.x = Math.PI / 6;
      const lb = h.label(7, 1.3, 'HB · 2M', '#5a3d05', '#f2b134'); lb.rotation.x = -Math.PI / 2; at(lb, xm(40), 1.42, 0, ob);
      along(1.4, mm - 18, mm - 6, 0xe8c99a, { r2: 0.55, seg: 18 });
      along(0.55, mm - 6, mm, 0x2b2f3a, { r2: 0.03, seg: 12 });
    } else {
      const hd = along(2.6, 0, 8, 0xaab4c6, { seg: 6 }); hd.rotation.x = Math.PI / 6;
      along(1.5, 8, mm, 0xc3cbd9, { seg: 18 });
      for (let m = 10; m < mm - 1; m += 1.5) { const r = mesh(new T.TorusGeometry(1.5, 0.16, 5, 18), 0x7e889c, { edges: false }); r.rotation.y = Math.PI / 2; at(r, xm(m), 0, 0, ob); }
    }
    // линейка (ноль сдвинут на off мм от левого конца предмета)
    const zeroX = xm(d.off);
    ruler(kit, h, g, zeroX, -0.6, d.price);
    at(box(0.3, 0.2, 1.6, d.aligned ? 0x2fbf5a : 0xe0473a, { edges: false, shadow: false }), X0, 0.1, -0.6 - OR * 2 - 1.2, g);
    // бегунок — выставленное показание
    if (d.read > 0) {
      const rx = zeroX + d.read * S6;
      at(box(1.4, 1.6, RW + 1.2, 0xe0473a, { matOpt: { transparent: true, opacity: 0.85 } }), rx, 0.8, -0.6 + RW / 2, g);
      at(box(0.25, 0.1, RW + 1.2, 0xffffff, { edges: false, shadow: false }), rx, 1.65, -0.6 + RW / 2, g);
    }
    // интервалы «показание ± погрешность» (урок про погрешность)
    if (d.kind === 'error') [[d.recCm, 10, 0xffb547, 'см', 7.5], [d.recMm, 1, 0x2fbf5a, 'мм', 10.5]].forEach(([rec, c, col, t, y]) => {
      if (rec == null) return;
      const a = xm(rec - c / 2), b = xm(rec + c / 2);
      at(box(Math.max(0.5, b - a), 0.5, 0.5, col, { edges: false }), (a + b) / 2, y, OZ, g);
      for (const e of [a, b]) at(box(0.4, 2, 0.5, col, { edges: false }), e, y - 0.75, OZ, g);
      const l = h.label(6.6, 1.8, '± ' + (c === 10 ? '0,5 см' : '0,05 см'), '#1b1610', '#' + col.toString(16).padStart(6, '0')); at(l, b + 4.2, y, OZ, g);
    });
    // лупа над концом предмета: увеличенный вид сверху ×5
    const lc = h.canvasTex(512, 512, (c, w) => {
      const pxmm = 44, cx = w / 2, ty = 210;   // кончик предмета — в центре по x; линейка ниже ty
      c.fillStyle = '#c98f55'; c.fillRect(0, 0, w, w);
      c.fillStyle = '#e9dcb4'; c.fillRect(0, ty + 30, w, w);
      c.strokeStyle = '#1d2433'; c.fillStyle = '#1d2433'; c.textAlign = 'center'; c.textBaseline = 'middle';
      for (let i = 0; i <= 150; i += d.price) {
        const x = cx + (d.off + i - mm) * pxmm; if (x < -60 || x > w + 60) continue;
        const L = i % 10 === 0 ? 110 : i % 5 === 0 ? 80 : 52;
        c.lineWidth = i % 10 === 0 ? 6 : 4; c.beginPath(); c.moveTo(x, ty + 30); c.lineTo(x, ty + 30 + L); c.stroke();
        if (i % 10 === 0) { c.font = '700 64px "IBM Plex Mono", monospace'; c.fillText(String(i / 10), x, ty + 200); }
      }
      if (d.read > 0) { const x = cx + (d.off + d.read - mm) * pxmm; c.fillStyle = 'rgba(224,71,58,.85)'; c.fillRect(x - 5, ty + 26, 10, 230); }
      // предмет сверху
      const ow = OR / S6 * pxmm;
      if (pencil) {
        c.fillStyle = '#e8c99a'; c.beginPath(); c.moveTo(cx - 12 * pxmm, ty - ow); c.lineTo(cx, ty); c.lineTo(cx - 12 * pxmm, ty + ow); c.closePath(); c.fill(); c.lineWidth = 5; c.strokeStyle = '#1b1610'; c.stroke();
        c.fillStyle = '#2b2f3a'; c.beginPath(); c.moveTo(cx - 6 * pxmm, ty - ow * 0.4); c.lineTo(cx, ty); c.lineTo(cx - 6 * pxmm, ty + ow * 0.4); c.closePath(); c.fill();
      } else {
        const sw = 1.5 / S6 * pxmm; c.fillStyle = '#c3cbd9'; c.fillRect(-10, ty - sw, cx + 10, sw * 2); c.lineWidth = 5; c.strokeStyle = '#1b1610'; c.strokeRect(-10, ty - sw, cx + 10, sw * 2);
        c.strokeStyle = '#7e889c'; c.lineWidth = 4; for (let x = cx - 8; x > 0; x -= 1.5 * pxmm) { c.beginPath(); c.moveTo(x, ty - sw); c.lineTo(x - 0.6 * pxmm, ty + sw); c.stroke(); }
      }
      c.setLineDash([14, 10]); c.strokeStyle = '#1aa6c4'; c.lineWidth = 4; c.beginPath(); c.moveTo(cx, ty); c.lineTo(cx, ty + 160); c.stroke(); c.setLineDash([]);
      c.fillStyle = 'rgba(14,21,32,.75)'; c.fillRect(w - 110, 18, 92, 46); c.fillStyle = '#fff6e6'; c.font = '700 34px "IBM Plex Mono", monospace'; c.fillText('×5', w - 64, 42);
    });
    const LX = clamp(tipX, -30, 40);
    h.magnifier(g, LX, 22, -16, 9, lc, 1, 0.5);
    h.rodAB(g, v3(tipX, 0.4, OZ), v3(LX, 13, -16), 0.08, 0x1aa6c4, { hull: false, shadow: false, matOpt: { transparent: true, opacity: 0.6 } });
    // кнопки: подвинуть линейку
    const mv = new T.Group(); at(mv, -38, 0, 19, g); mv.rotation.y = 0.15;
    at(box(30, 2, 9, C.WOOD2), 0, 1, 0, mv);
    [['◀ 5 мм', 'r-5', -10.5], ['◀ 1', 'r-1', -3.5], ['1 ▶', 'r+1', 3.5], ['5 мм ▶', 'r+5', 10.5]].forEach(([t, k, x]) => h.button(mv, x, 2, 0, t, 0x3a7bd5, k, x === -3.5 || x === 3.5 ? 5.4 : 7.4, 5));
    // тетрадь и кнопки показания
    const cmS = v => d.price === 10 ? fmt(v / 10, 0) + ' см' : fmt(v / 10, 1) + ' см';
    let lines;
    if (d.kind === 'units') lines = [['Длина карандаша', '#5b6478'], d.rec != null ? ['L = ' + cmS(d.rec) + ' ✓', '#1f8a4c'] : 'L = ?', ['выставлено:', '#5b6478'], cmS(d.read)];
    else lines = [['Длина болта', '#5b6478'], d.recCm != null ? ['L = ' + fmt(d.recCm / 10, 0) + '±0,5 см', '#b07a10'] : '1 см: ?', d.recMm != null ? ['L = ' + fmt(d.recMm / 10, 1) + '±0,05 см', '#1f8a4c'] : '1 мм: ?', ['выставлено: ' + cmS(d.read), '#5b6478']];
    h.notebook(g, 34, 20, -0.25, lines, d.kind === 'units' ? 'recLen' : 'recErr');
    const rp = new T.Group(); at(rp, 34, 0, 36, g); rp.rotation.y = -0.25;
    at(box(30, 2, 7, C.WOOD2), 0, 1, 0, rp);
    const rb = d.kind === 'units' ? [['−1 мм', 'rd-1'], ['+1 мм', 'rd+1'], ['+1 см', 'rd+10']] : [['− ' + (d.price === 10 ? '1 см' : '1 мм'), 'rd-'], ['+ ' + (d.price === 10 ? '1 см' : '1 мм'), 'rd+']];
    rb.forEach(([t, k], i) => h.button(rp, (i - (rb.length - 1) / 2) * 9.4, 2, 0, t, 0xe08a2a, k, 8.4, 4.6));
    // другая линейка (погрешность): нажать — взять её
    if (d.kind === 'error') {
      const other = d.price === 10 ? 1 : 10, og = new T.Group(); at(og, 0, 0, 0, g); clickable(og, other === 1 ? 'ru-mm' : 'ru-cm');
      const r2 = ruler(kit, h, og, -40, -34, other); r2.rotation.y = 0.03;
      kit.tag(v3(42, 3, -30), 'Линейка в ' + (other === 1 ? 'мм' : 'см'), 'нажми — взять');
    }
    // подписи
    kit.tag(v3(xm(mm * 0.45), 6, OZ), pencil ? 'Карандаш' : 'Болт', d.aligned ? 'ноль у края ✓' : 'ноль не у края', d.aligned);
    kit.tag(v3(LX + 4, 34, -16), 'Лупа ×5', 'конец ' + (pencil ? 'карандаша' : 'болта'));
    kit.tag(v3(34, 6, 18), 'Тетрадь', 'нажми — записать', d.kind === 'units' ? d.rec != null : d.recCm != null && d.recMm != null);
    kit.tag(v3(-38, 6, 19), 'Линейка', 'подвинуть ноль');
  };

  // ===== «Время»: маятник 1 м на штативе, секундомер, тетрадь =====
  SC['meas-time'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const PX = -14, PZ = -14, PY = 64, LEN = 50, AMP = 9 * Math.PI / 180;
    // штатив
    at(box(24, 2, 16, 0x4a5468), PX - 12, 1, PZ);
    at(cyl(1, 66, 0xb9c0cc, { edges: false }), PX - 20, 34, PZ);
    at(box(3.4, 3.4, 3.4, 0x4a5468), PX - 20, PY + 1, PZ);
    const arm = cyl(0.7, 20, 0xb9c0cc, { edges: false }); arm.rotation.z = Math.PI / 2; at(arm, PX - 10, PY + 1, PZ);
    at(box(2.4, 2.4, 2.4, 0x2c3240), PX, PY + 0.6, PZ);
    // маятник: нить и шарик качаются в плоскости x–y
    const pend = new T.Group(); at(pend, PX, PY, PZ, g);
    at(cyl(0.1, LEN, 0xf4efe2, { edges: false, hull: false }), 0, -LEN / 2, 0, pend);
    const ball = mesh(new T.SphereGeometry(3.4, 22, 16), 0xffb547, { hull: true, edges: false }); at(ball, 0, -LEN - 3.4, 0, pend);
    at(cyl(0.4, 1, C.BRASS, { edges: false }), 0, -LEN - 0.1, 0, pend);
    // дуга размаха и метки «край»
    const arc = mesh(new T.TorusGeometry(LEN + 3.4, 0.16, 4, 40, AMP * 2), 0x8b96ad, { edges: false, hull: false, shadow: false }); arc.rotation.z = -Math.PI / 2 - AMP; at(arc, PX, PY, PZ, g);
    for (const s of [-1, 1]) at(box(0.4, 3, 0.4, 0xe0473a, { edges: false }), PX + s * (LEN + 3.4) * Math.sin(AMP), PY - (LEN + 3.4) * Math.cos(AMP), PZ, g);
    at(box(26, 0.3, 0.3, 0x8b96ad, { edges: false, shadow: false }), PX, 0.2, PZ + 4, g);
    // секундомер на подставке: лицо к зрителю, кнопка сверху — старт/стоп, сбоку — сброс
    const SWX = 26, SWZ = 16; const sw = new T.Group(); at(sw, SWX, 12, SWZ, g); sw.rotation.y = -0.3; sw.scale.setScalar(1.3);
    const body = new T.Group(); at(body, 0, 0, 0, sw); body.rotation.x = 0.87;
    at(cyl(9.5, 3, 0x2c3240, { seg: 40 }), 0, 0, 0, body);
    const rim = mesh(new T.TorusGeometry(9.5, 0.6, 8, 40), 0xc6ccd6, { edges: false, hull: true }); rim.rotation.x = Math.PI / 2; at(rim, 0, 1.5, 0, body);
    const face = h.canvasTex(256, 256, (c, w) => { c.fillStyle = '#eef1f6'; c.beginPath(); c.arc(w / 2, w / 2, w / 2, 0, 7); c.fill(); c.strokeStyle = '#1b1610'; for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, r1 = 122, r2 = i % 5 ? 112 : 100; c.lineWidth = i % 5 ? 2 : 4; c.beginPath(); c.moveTo(128 + Math.sin(a) * r1, 128 - Math.cos(a) * r1); c.lineTo(128 + Math.sin(a) * r2, 128 - Math.cos(a) * r2); c.stroke(); } });
    const fc = new T.Mesh(keep(new T.CircleGeometry(8.6, 40)), keep(new T.MeshBasicMaterial({ map: face }))); fc.rotation.x = -Math.PI / 2; at(fc, 0, 1.52, 0, body);
    const scr = h.screen(11, 5.2, '', '#86e0a8', 330, 156); scr.rotation.x = -Math.PI / 2; at(scr, 0, 1.56, 0.8, body);
    const hand = box(0.35, 0.1, 6.5, 0xe0473a, { edges: false, shadow: false }); const hp = new T.Group(); at(hp, 0, 1.62, 0, body); at(hand, 0, 0, -3.2, hp);
    const crown = new T.Group(); at(crown, 0, 0, -10.2, body); clickable(crown, 'sw');
    at(cyl(0.8, 2, C.STEEL, { edges: false }), 0, 0, 0, crown).rotation.x = Math.PI / 2;
    at(cyl(1.7, 1.6, d.run ? 0x3fae5a : 0xffb547, { seg: 18 }), 0, 0, -1.6, crown).rotation.x = Math.PI / 2;
    const rs = new T.Group(); at(rs, 7.5, 0, -7.5, body); rs.rotation.y = Math.PI / 4; clickable(rs, 'swReset');
    at(cyl(1.1, 2.2, 0xe0473a, { seg: 14 }), 0, 0, -1, rs).rotation.x = Math.PI / 2;
    clickable(body, 'sw');
    // подставка
    at(box(15, 1.6, 12, C.WOOD2), SWX, 0.8, SWZ + 2, g).rotation.y = -0.3;
    h.rodAB(g, v3(SWX, 1.6, SWZ + 2), v3(SWX, 7, SWZ), 1.3, C.WOOD2);
    // тетрадь
    h.notebook(g, -30, 24, 0.2, [['10 колебаний', '#5b6478'], d.tRec != null ? ['t = ' + fmt(d.tRec, 2) + ' с ✓', '#1f8a4c'] : 't = ?', d.tRec != null ? ['T = ' + fmt(d.tRec / 10, 2) + ' с', '#1f8a4c'] : ['T = t / 10', '#5b6478'], ['нажми — записать', '#5b6478']], 'recTime');
    // подписи
    kit.tag(v3(PX + 10, 30, PZ), 'Маятник', 'нить 1 м');
    const sTag = liveTag(kit, v3(SWX + 14, 14, SWZ), 'Секундомер', d.run ? 'идёт' : 'нажми — старт', d.run);
    kit.tag(v3(-30, 5, 24), 'Тетрадь', d.tRec != null ? 'записано' : 'нажми — записать', d.tRec != null);
    let lastS = '';
    const pose = () => {
      const Lv = live(), ph = Lv.ph || 0;
      pend.rotation.z = kit.reduce ? 0 : AMP * Math.cos(2 * Math.PI * ph / d.T);
      const el = Lv.el || 0, n = Lv.n || 0;
      hp.rotation.y = -(el % 60) / 60 * Math.PI * 2;
      const s = fmt(el, 2) + ' с\nколебаний: ' + n;
      if (s !== lastS) { lastS = s; scr.userData.set(s, Lv.run ? '#86e0a8' : '#ffd166'); sTag.set(Lv.run ? 'идёт · ' + n + ' кол.' : el ? 'стоп · ' + n + ' кол.' : 'нажми — старт', Lv.run); }
    };
    pose(); kit.onFrame(pose);
  };

  // ===== «Масса»: рычажные весы, яблоко, гири из ящика =====
  const wR = m => 0.8 + 0.3 * Math.log2(m), wH = m => 1.4 + 0.42 * Math.log2(m);
  function weight(kit, h, m) {
    const { T, at, cyl } = kit, g = new T.Group(), r = wR(m), hh = wH(m);
    at(cyl(r, hh, 0xd4b257, { seg: 22 }), 0, hh / 2, 0, g);
    at(cyl(r * 0.32, r * 0.5, 0xd4b257, { seg: 12 }), 0, hh + r * 0.25, 0, g);
    at(kit.mesh(new T.SphereGeometry(r * 0.42, 12, 8), 0xd4b257, { edges: false, hull: true }), 0, hh + r * 0.62, 0, g);
    const l = h.label(r * 1.5, Math.min(hh * 0.6, r * 0.75), String(m), '#3a2a05', '#d4b257'); at(l, 0, hh / 2, r + 0.03, g);
    g.userData.h = hh + r; return g;
  }
  SC['meas-mass'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const BX = 0, BZ = -10, PY = 40, ARM = 28, HANG = 24;
    // основание и колонка
    at(box(46, 3, 16, 0x3b4a66), BX, 1.5, BZ, g);
    for (const s of [-1, 1]) at(cyl(1.4, 1, C.DARK), BX + s * 20, 0.5, BZ + 6, g);
    at(box(4, PY - 3, 4, 0x56627d), BX, 3 + (PY - 3) / 2 - 1, BZ, g);
    at(box(6, 3, 5, 0x3b4a66), BX, PY - 2, BZ, g);
    // шкала стрелки
    const st = h.canvasTex(256, 96, (c, w, hh) => { c.fillStyle = '#f7f3ea'; c.fillRect(0, 0, w, hh); c.strokeStyle = '#1b1610'; for (let k = -3; k <= 3; k++) { const x = w / 2 + k * 32; c.lineWidth = k ? 3 : 6; c.strokeStyle = k ? '#1b1610' : '#2fbf5a'; c.beginPath(); c.moveTo(x, 6); c.lineTo(x, k ? 44 : 64); c.stroke(); } });
    at(h.flat(14, 5.2, st, false), BX, 8.4, BZ + 2.6, g);
    // коромысло со стрелкой
    const beam = new T.Group(); at(beam, BX, PY, BZ + 0.4, g);
    at(box(ARM * 2 + 4, 1.4, 1.6, 0xa9b4c9), 0, 0, 0, beam);
    at(box(1, 0.7, 2, 0x56627d, { edges: false }), 0, 0.9, 0, beam);
    for (const s of [-1, 1]) at(cyl(0.9, 2, C.BRASS, { seg: 12 }), s * ARM, 0.4, 0, beam).rotation.x = Math.PI / 2;
    at(box(0.5, PY - 9, 0.4, 0xe0473a, { edges: false }), 0, -(PY - 9) / 2, 2.2, beam);
    at(mesh(new T.SphereGeometry(1.4, 14, 10), C.BRASS, { edges: false, hull: true }), 0, 0, 1.2, beam);
    // чаши
    const pan = s => {
      const pg = new T.Group(); at(pg, 0, 0, BZ + 0.4, g);
      const fy = -HANG, rr = 10.4, rimY = fy + 0.4;
      at(cyl(9.8, 0.8, 0xc6ccd6, { r2: 10.4, seg: 40 }), 0, fy, 0, pg);
      const rim = mesh(new T.TorusGeometry(rr, 0.3, 6, 40), 0xa9b4c9, { edges: false }); rim.rotation.x = Math.PI / 2; at(rim, 0, rimY, 0, pg);
      for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + 0.5; h.rodAB(pg, v3(0, -0.6, 0), v3(Math.cos(a) * rr, rimY, Math.sin(a) * rr), 0.09, 0x8b96ad, { hull: false, shadow: false }); }
      at(mesh(new T.TorusGeometry(0.8, 0.22, 6, 14), 0x8b96ad, { edges: false }), 0, 0.2, 0, pg);
      return { pg, floor: fy + 0.4 };
    };
    const L = pan(-1), Rp = pan(1);
    // яблоко на левой чаше
    const prof = []; for (let i = 0; i <= 16; i++) { const t = i / 16 * Math.PI; prof.push(new T.Vector2(Math.max(0.05, Math.sin(t) * 4 * (1 - 0.18 * Math.cos(t))), -Math.cos(t) * 3.7)); }
    const apple = new T.Group(); at(apple, 0, L.floor + 3.6, 0, L.pg);
    at(mesh(new T.LatheGeometry(prof, 28), 0xd9483b, { hull: true, edges: false }), 0, 0, 0, apple);
    at(cyl(0.22, 2, 0x6b4a2a, { edges: false, hull: false }), 0, 4, 0, apple);
    const lf = mesh(new T.SphereGeometry(1, 10, 6), 0x4c9a62, { edges: false }); lf.scale.set(1.7, 0.35, 0.8); at(lf, 1.3, 4.1, 0, apple);
    // гири на правой чаше: крупная в центре, остальные по кругу
    const pan2 = d.pan.slice().sort((a, b) => d.weights[b] - d.weights[a]);
    pan2.forEach((i, k) => {
      const m = d.weights[i], wg = weight(kit, h, m); clickable(wg, 'w' + i);
      const a = (k - 1) / 8 * Math.PI * 2 + 0.3, r = k ? 6.2 : 0;
      at(wg, Math.cos(a) * r, Rp.floor, Math.sin(a) * r, Rp.pg);
    });
    // ящик с гирями
    const bx = new T.Group(); at(bx, 0, 0, 24, g);
    at(box(64, 2.4, 13, C.WOOD2), 0, 1.2, 0, bx);
    const lid = box(64, 12, 0.8, C.WOOD); lid.rotation.x = -0.25; at(lid, 0, 7, -8, bx);
    const lt = h.label(22, 2.6, 'Набор гирь, г', '#1b1610', '#e9dcb4'); lt.rotation.x = -0.25; at(lt, 0, 9, -7.5, bx);
    d.weights.forEach((m, i) => {
      const x = -28 + i * 7;
      at(cyl(wR(m) + 0.4, 0.2, 0x1b1610, { edges: false, hull: false, shadow: false }), x, 2.42, 0, bx);
      if (d.pan.includes(i)) return;
      const wg = weight(kit, h, m); clickable(wg, 'w' + i); at(wg, x, 2.4, 0, bx);
    });
    // подписи
    const mR = d.pan.reduce((s, i) => s + d.weights[i], 0), eq = mR === d.apple;
    kit.tag(v3(BX, PY + 6, BZ), 'Весы', eq ? 'равновесие' : mR < d.apple ? 'тяжелее яблоко' : 'тяжелее гири', eq);
    kit.tag(v3(-ARM - 4, 30, BZ), 'Яблоко', d.got ? d.apple + ' г ✓' : '? г', d.got);
    kit.tag(v3(ARM + 4, 30, BZ), 'Гири на чаше', mR + ' г');
    kit.tag(v3(-24, 9, 26), 'Набор гирь', 'нажми — на чашу');
    // коромысло качается к равновесию (угол — из опыта)
    const pose = () => {
      const Lv = live(), th = -(Lv.tilt || 0) * Math.PI / 180;
      beam.rotation.z = th;
      L.pg.position.set(BX - ARM * Math.cos(th), PY - ARM * Math.sin(th), BZ + 0.4);
      Rp.pg.position.set(BX + ARM * Math.cos(th), PY + ARM * Math.sin(th), BZ + 0.4);
    };
    pose(); kit.onFrame(pose);
  };

  // ===== «Цена деления»: мензурка, термометр в стакане, спидометр; лупа у активной шкалы =====
  SC['meas-scale'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const I = Object.fromEntries(d.insts.map(x => [x.id, x]));
    const price = x => x.label / x.div;
    mem.v = mem.v || {};
    const anim = {};
    d.insts.forEach(x => { anim[x.id] = { from: mem.v[x.id] ?? x.v, to: x.v }; mem.v[x.id] = x.v; });
    const t0 = performance.now() / 1000, cur = id => { const a = anim[id], k = kit.reduce ? 1 : clamp((performance.now() / 1000 - t0) / 0.35, 0, 1); return a.from + (a.to - a.from) * smooth(k); };
    const pos = { cyl: [-40, -8], thermo: [-2, -10], speed: [36, -8] };
    const pad = (id) => { const [x, z] = pos[id]; at(cyl(14, 0.3, d.inst === id ? 0xffd166 : 0x8a6a40, { edges: false, hull: false, shadow: false }), x, 0.15, z, g); };
    ['cyl', 'thermo', 'speed'].forEach(pad);
    // --- мензурка: 0–200 мл, 1 мл = 0,2 ед.
    const Ic = I.cyl, [cxp, czp] = pos.cyl, CY0 = 2.2, KC = 0.2, CR = 5.2;
    const cg = new T.Group(); at(cg, cxp, 0, czp, g); clickable(cg, 'in-cyl');
    at(cyl(8, 1.2, 0x3b4a66, { seg: 6 }), 0, 0.6, 0, cg);
    at(cyl(CR, 1, 0xd8eef8, { edges: false, matOpt: { transparent: true, opacity: 0.5 } }), 0, 1.7, 0, cg);
    const cw = new T.Mesh(keep(new T.CylinderGeometry(CR, CR, 44, 40, 1, true)), h.glassMat(0xd8eef8, 0.2)); at(cw, 0, CY0 + 22, 0, cg);
    for (const yy of [CY0, CY0 + 22]) { const rg = mesh(new T.TorusGeometry(CR, 0.18, 5, 40), 0xc9dbe6, { edges: false }); rg.rotation.x = Math.PI / 2; at(rg, 0, yy, 0, cg); }
    const crim = mesh(new T.TorusGeometry(CR, 0.3, 6, 40), 0xeef6fb, { edges: false }); crim.rotation.x = Math.PI / 2; at(crim, 0, CY0 + 44, 0, cg);
    const wMat = h.ownMat(0x5fb4d9, { transparent: true, opacity: 0.6, depthWrite: false });
    const water = new T.Mesh(keep(new T.CylinderGeometry(CR - 0.25, CR - 0.25, 1, 36)), wMat); at(water, 0, CY0, 0, cg);
    const men = mesh(new T.TorusGeometry(CR - 0.5, 0.35, 6, 36), 0xa8e2f5, { edges: false, hull: false, shadow: false }); men.rotation.x = Math.PI / 2; at(men, 0, CY0, 0, cg);
    const cTex = h.canvasTex(160, 1024, (c, w, hh) => {
      c.clearRect(0, 0, w, hh); c.strokeStyle = '#1d3b66'; c.fillStyle = '#1d3b66'; c.textBaseline = 'middle'; c.font = '700 40px "IBM Plex Mono", monospace';
      const yv = v => hh - 12 - (hh - 24) * v / 200;
      
      for (let v = 0; v <= 200; v += price(Ic)) { const big = v % Ic.label === 0; c.lineWidth = big ? 6 : 3; c.beginPath(); c.moveTo(4, yv(v)); c.lineTo(big ? 70 : 38, yv(v)); c.stroke(); if (big && v) c.fillText(String(v), 78, yv(v)); }
      c.font = '600 30px "Golos Text", sans-serif'; c.fillText('мл', 82, 30);
    });
    const cs = h.flat(4.4, 200 * KC * 1024 / 1000, cTex); at(cs, -1.2, CY0 + 100 * KC, CR + 0.06, cg);
    // --- термометр в стакане воды: −20…50 °C
    const It = I.thermo, [txp, tzp] = pos.thermo, TY0 = 3, TS = 42, ty = v => TY0 + 2 + TS * (v - It.min) / (It.max - It.min);
    const tg = new T.Group(); at(tg, txp, 0, tzp, g); clickable(tg, 'in-thermo');
    const bw = new T.Mesh(keep(new T.CylinderGeometry(6.5, 6.2, 13, 36, 1, true)), h.glassMat(0xd8eef8, 0.22)); at(bw, 0, 6.5, 0, tg); bw.add(new T.Mesh(bw.geometry, kit.hullMat));
    at(cyl(6.2, 0.6, 0xd8eef8, { edges: false, hull: false, matOpt: { transparent: true, opacity: 0.45 } }), 0, 0.3, 0, tg);
    const twMat = h.ownMat(0x5fb4d9, { transparent: true, opacity: 0.55, depthWrite: false });
    at(new T.Mesh(keep(new T.CylinderGeometry(6, 5.8, 9.5, 36)), twMat), 0, 0.6 + 4.75, 0, tg);
    const tb = new T.Group(); at(tb, 0, 0, 0, tg);
    const boardTex = h.canvasTex(192, 1024, (c, w, hh) => {
      c.fillStyle = '#f7f3ea'; c.fillRect(0, 0, w, hh); c.strokeStyle = '#1d2433'; c.fillStyle = '#1d2433'; c.textBaseline = 'middle'; c.font = '700 40px "IBM Plex Mono", monospace';
      const yv = v => hh - 30 - (hh - 60) * (v - It.min) / (It.max - It.min);
      for (let v = It.min; v <= It.max; v += price(It)) { const big = v % It.label === 0; c.lineWidth = big ? 5 : 3; c.beginPath(); c.moveTo(96, yv(v)); c.lineTo(big ? 140 : 120, yv(v)); c.stroke(); if (big) c.fillText(v < 0 ? '−' + -v : String(v), 140, yv(v) + 2); }
      c.font = '700 34px "Golos Text", sans-serif'; c.fillText('°C', 20, 30);
    });
    const tbH = TS / (1 - 60 / 1024);
    at(box(5.4, tbH + 3, 0.5, 0xe7dcb8), 0.8, TY0 + 2 + TS / 2, -0.6, tb);
    const brd = h.flat(5, tbH, boardTex, false); at(brd, 0.8, TY0 + 2 + TS / 2, -0.33, tb);
    at(cyl(0.75, TS + 5, 0xf4f7fb, { matOpt: { transparent: true, opacity: 0.6 } }), -0.8, TY0 + 2 + (TS + 5) / 2 - 2, 0.3, tb);
    at(mesh(new T.SphereGeometry(1.3, 16, 12), 0xe2483b, { edges: false, hull: true }), -0.8, TY0, 0.3, tb);
    const tcol = cyl(0.36, 1, 0xe2483b, { edges: false, hull: false, shadow: false }); at(tcol, -0.8, TY0, 0.35, tb);
    // штатив термометра
    at(box(8, 1, 6, 0x4a5468), txp + 10, 0.5, tzp - 3, g);
    at(cyl(0.6, 52, 0xb9c0cc, { edges: false }), txp + 10, 26, tzp - 3, g);
    h.rodAB(g, v3(txp + 10, 46, tzp - 3), v3(txp - 0.8, 46, tzp - 0.6), 0.4, 0xb9c0cc);
    at(box(2.4, 2.4, 2.4, 0x3b4a66), txp - 0.8, 46, tzp - 0.4, g);
    // --- спидометр: приборная панель
    const Is = I.speed, [sxp, szp] = pos.speed, SR = 12, SYC = 17, spA = v => (210 - v / 160 * 240) * Math.PI / 180;
    const sg = new T.Group(); at(sg, sxp, 0, szp, g); clickable(sg, 'in-speed');
    at(box(22, 3, 14, 0x2c3240), 0, 1.5, 0, sg);
    const dash = new T.Group(); at(dash, 0, 3, -2, sg); dash.rotation.x = -0.18;
    at(box(30, 30, 5, 0x26324a), 0, SYC - 3, -1.5, dash);
    const ring = mesh(new T.TorusGeometry(SR + 0.6, 0.7, 10, 48), 0xc6ccd6, { edges: false, hull: true }); at(ring, 0, SYC - 3, 1.3, dash);
    const dTex = h.canvasTex(512, 512, (c, w) => {
      c.fillStyle = '#121a28'; c.beginPath(); c.arc(256, 256, 256, 0, 7); c.fill();
      c.strokeStyle = '#e8ecf4'; c.fillStyle = '#e8ecf4'; c.textAlign = 'center'; c.textBaseline = 'middle';
      for (let v = 0; v <= Is.max; v += price(Is)) { const a = spA(v), big = v % Is.label === 0, r1 = 236, r2 = big ? 196 : 214; c.lineWidth = big ? 7 : 3; c.beginPath(); c.moveTo(256 + r1 * Math.cos(a), 256 - r1 * Math.sin(a)); c.lineTo(256 + r2 * Math.cos(a), 256 - r2 * Math.sin(a)); c.stroke(); if (big) { c.font = '700 38px "IBM Plex Mono", monospace'; c.fillText(String(v), 256 + 158 * Math.cos(a), 256 - 158 * Math.sin(a)); } }
      c.font = '600 32px "Golos Text", sans-serif'; c.fillStyle = '#8b96ad'; c.fillText('км/ч', 256, 360);
    });
    at(new T.Mesh(keep(new T.CircleGeometry(SR, 48)), keep(new T.MeshBasicMaterial({ map: dTex }))), 0, SYC - 3, 1.05, dash);
    const ndl = new T.Group(); at(ndl, 0, SYC - 3, 1.5, dash);
    at(box(0.55, SR - 1, 0.25, 0xff6a4a, { edges: false, matOpt: { emissive: 0xff4a2a, emissiveIntensity: 0.4 } }), 0, (SR - 1) / 2 - 1.5, 0, ndl);
    at(cyl(1.2, 0.6, 0x3a4762, { seg: 16 }), 0, SYC - 3, 1.7, dash).rotation.x = Math.PI / 2;
    // --- лупа у активной шкалы (мензурка и термометр)
    let lensDraw = null;
    const lc = document.createElement('canvas'); lc.width = lc.height = 512; const lx = lc.getContext('2d');
    const ltex = keep(new T.CanvasTexture(lc)); ltex.colorSpace = T.SRGBColorSpace;
    const lin = (v, Ix, bg, tickCol, indicator) => {
      const c = lx, pxu = 512 / (Ix.label * 0.9), cy = 256, p = price(Ix);
      c.fillStyle = bg; c.fillRect(0, 0, 512, 512);
      indicator(c, cy);
      c.strokeStyle = tickCol; c.fillStyle = tickCol; c.textBaseline = 'middle'; c.textAlign = 'left';
      for (let x = Math.ceil((v - Ix.label) / p) * p; x <= v + Ix.label; x += p) {
        if (x < Ix.min || x > Ix.max) continue;
        const y = cy - (x - v) * pxu, big = Math.abs(x % Ix.label) < 1e-9;
        c.lineWidth = big ? 9 : 5; c.beginPath(); c.moveTo(Ix.id === 'cyl' ? 40 : 230, y); c.lineTo((Ix.id === 'cyl' ? 40 : 230) + (big ? 150 : 80), y); c.stroke();
        if (big) { c.font = '700 64px "IBM Plex Mono", monospace'; c.fillText(x < 0 ? '−' + -x : String(x), Ix.id === 'cyl' ? 210 : 390, y + 4); }
      }
      c.fillStyle = 'rgba(14,21,32,.75)'; c.fillRect(398, 18, 96, 46); c.fillStyle = '#fff6e6'; c.font = '700 34px "IBM Plex Mono", monospace'; c.textAlign = 'center'; c.fillText('×3', 446, 42);
      ltex.needsUpdate = true;
    };
    let lens = null;
    if (d.inst === 'cyl') {
      lens = h.magnifier(g, cxp + 16, 20, czp + 6, 8, ltex, 1, 0.45, 50);
      lensDraw = v => lin(v, Ic, '#cfe6f2', '#1d3b66', (c, cy) => { c.fillStyle = '#4f9fe0'; c.fillRect(0, cy, 512, 512); c.strokeStyle = '#a8e2f5'; c.lineWidth = 8; c.beginPath(); c.moveTo(0, cy - 20); c.quadraticCurveTo(256, cy + 16, 512, cy - 20); c.stroke(); c.fillStyle = '#cfe6f2'; c.beginPath(); c.moveTo(0, cy - 20); c.quadraticCurveTo(256, cy + 16, 512, cy - 20); c.lineTo(512, cy); c.lineTo(0, cy); c.fill(); });
    } else if (d.inst === 'thermo') {
      lens = h.magnifier(g, txp + 19, 26, tzp + 11, 8, ltex, 1, 0.4, 50);
      lensDraw = v => lin(v, It, '#f7f3ea', '#1d2433', (c, cy) => { c.fillStyle = '#f4f7fb'; c.fillRect(70, 0, 110, 512); c.fillStyle = '#e2483b'; c.fillRect(100, cy, 50, 512); c.strokeStyle = '#1b1610'; c.lineWidth = 4; c.strokeRect(70, -10, 110, 540); });
    }
    // кнопки ▼ ▲
    const cp = new T.Group(); at(cp, -2, 0, 26, g);
    at(box(28, 2.2, 9, C.WOOD2), 0, 1.1, 0, cp);
    const un = I[d.inst].unit;
    h.button(cp, -6.5, 2.2, 0, '▼ 1 ' + un, 0x3a7bd5, 'v-1', 11, 5.4);
    h.button(cp, 6.5, 2.2, 0, '▲ 1 ' + un, 0xe08a2a, 'v+1', 11, 5.4);
    // подписи: у активного — цель
    const tg2 = (id, p) => { const x = I[id]; kit.tag(p, x.name + (x.hit ? ' ✓' : ''), d.inst === id ? 'цель ' + x.target + ' ' + x.unit : 'нажми — выбрать', x.hit); };
    tg2('cyl', v3(cxp - 9, 30, czp)); tg2('thermo', v3(txp - 7, 40, tzp)); tg2('speed', v3(sxp, 37, szp - 3));
    // анимация: вода, столбик, стрелка подъезжают к новому значению
    let lastLens = null;
    const pose = () => {
      const vc = cur('cyl'), vt = cur('thermo'), vs = cur('speed');
      const hc = Math.max(0.05, vc * KC); water.scale.y = hc; water.position.y = CY0 + hc / 2; water.visible = vc > 0.2; men.position.y = CY0 + hc; men.visible = vc > 0.2;
      const top = ty(vt), hh = top - TY0; tcol.scale.y = hh; tcol.position.y = TY0 + hh / 2;
      twMat.color.set(0x5fb4d9).lerp(new T.Color(0xff9a5a), clamp((vt - 10) / 50, 0, 1) * 0.5);
      ndl.rotation.z = spA(vs) - Math.PI / 2;
      if (lens) {
        const v = d.inst === 'cyl' ? vc : vt;
        lens.position.y = d.inst === 'cyl' ? CY0 + vc * KC : ty(vt);
        if (v !== lastLens) { lastLens = v; lensDraw(v); }
      }
    };
    pose(); kit.onFrame(pose);
  };

  // ===== «СИ»: эталоны метра, килограмма и секунды, карточка на мольберте, колода, множители =====
  SC['meas-si'] = (kit, d) => {
    const { T, at, box, cyl, mesh, keep, clickable, C } = kit, h = H(kit), v3 = h.v3;
    const g = new T.Group(); at(g, 0, 0, 0);
    const card = d.cards[d.card], tgt = card.to;
    const padC = on => on ? 0xffd166 : 0x8a6a40;
    // метр: X-образный брус в стеклянном футляре
    const mz = -26, mx = -38;
    at(box(38, 2, 9, C.WOOD2), mx, 1, mz, g);
    at(box(39, 0.3, 10, padC(tgt === 'м'), { edges: false, shadow: false }), mx, 2.15, mz, g);
    for (const s of [-1, 1]) at(cyl(0.9, 6, C.STEEL, { edges: false }), mx + s * 13, 3.3, mz, g).rotation.x = Math.PI / 2;
    at(box(34, 1.8, 1.8, 0xd9dde6), mx, 5.1, mz, g);
    at(box(34, 0.6, 3.2, 0xc3c9d4, { edges: false }), mx, 5.1, mz, g);
    for (const s of [-1, 1]) at(box(0.2, 0.1, 2.2, 0x1b1610, { edges: false, shadow: false }), mx + s * 15, 6.05, mz, g);
    const mc = new T.Mesh(keep(new T.BoxGeometry(37, 8, 8)), h.glassMat(0xd8eef8, 0.18)); at(mc, mx, 6, mz, g); mc.add(new T.Mesh(mc.geometry, kit.hullMat));
    const ml = h.label(8, 2.4, '1 м', '#1b1610', '#fff6e6'); at(ml, mx, 1, mz + 4.55, g);
    // килограмм: цилиндр под двумя колпаками
    const kx = 28, kz = -28;
    at(cyl(7, 1.6, C.WOOD2, { seg: 32 }), kx, 0.8, kz, g);
    at(cyl(7.2, 0.3, padC(tgt === 'кг'), { edges: false, hull: false, shadow: false }), kx, 1.75, kz, g);
    at(cyl(3.2, 0.8, 0xc6ccd6, { seg: 28 }), kx, 2.2, kz, g);
    at(cyl(2.3, 4.6, 0xd9dde6, { seg: 28 }), kx, 4.9, kz, g);
    for (const [r, hh] of [[4.6, 11], [5.8, 13.5]]) {
      const bj = new T.Mesh(keep(new T.CylinderGeometry(r, r, hh, 32, 1, true)), h.glassMat(0xd8eef8, 0.16)); at(bj, kx, 1.6 + hh / 2, kz, g);
      const dome = new T.Mesh(keep(new T.SphereGeometry(r, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2)), h.glassMat(0xd8eef8, 0.16)); at(dome, kx, 1.6 + hh, kz, g);
      if (r > 5) { bj.add(new T.Mesh(bj.geometry, kit.hullMat)); at(cyl(0.9, 1.4, C.DARK), kx, 1.6 + hh + r + 0.5, kz, g); }
    }
    const kl = h.label(7, 2.4, '1 кг', '#1b1610', '#fff6e6'); at(kl, kx, 0.8, kz + 7.05, g);
    // секунда: часы на подставке, секундная стрелка идёт по-настоящему
    const cx = 51, cz = 2;
    const ck = new T.Group(); at(ck, cx, 0, cz, g); ck.rotation.y = -0.3;
    at(box(14, 2, 8, C.WOOD2), 0, 1, 0, ck);
    at(box(15, 0.3, 9, padC(tgt === 'с'), { edges: false, shadow: false }), 0, 2.15, 0, ck);
    at(box(3, 8, 3, 0x56627d), 0, 6, 0, ck);
    const cb = cyl(8, 3, 0x3b4a66, { seg: 40 }); cb.rotation.x = Math.PI / 2; at(cb, 0, 18, 0, ck);
    const cf = h.canvasTex(256, 256, (c, w) => { c.fillStyle = '#f7f3ea'; c.beginPath(); c.arc(128, 128, 128, 0, 7); c.fill(); c.strokeStyle = '#1b1610'; c.fillStyle = '#1b1610'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '700 26px "IBM Plex Mono", monospace'; for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2; c.lineWidth = i % 5 ? 2 : 5; c.beginPath(); c.moveTo(128 + Math.sin(a) * 122, 128 - Math.cos(a) * 122); c.lineTo(128 + Math.sin(a) * (i % 5 ? 112 : 102), 128 - Math.cos(a) * (i % 5 ? 112 : 102)); c.stroke(); if (i % 15 === 0) c.fillText(String(i || 60), 128 + Math.sin(a) * 80, 128 - Math.cos(a) * 80); } c.font = '600 22px "Golos Text", sans-serif'; c.fillText('секунды', 128, 168); });
    at(new T.Mesh(keep(new T.CircleGeometry(7.2, 48)), keep(new T.MeshBasicMaterial({ map: cf }))), 0, 18, 1.55, ck);
    const sh = new T.Group(); at(sh, 0, 18, 1.75, ck);
    at(box(0.4, 6.4, 0.15, 0xe0473a, { edges: false, shadow: false }), 0, 2.4, 0, sh);
    at(cyl(0.6, 0.3, 0xe0473a, { edges: false }), 0, 0, 0.1, sh).rotation.x = Math.PI / 2;
    // мольберт с карточкой
    const ez = -12, eg = new T.Group(); at(eg, -2, 0, ez, g); eg.rotation.y = 0.3;
    for (const s of [-1, 1]) h.rodAB(eg, v3(s * 19.5, 0, 3), v3(s * 18.3, 31, -2), 0.7, C.WOOD2);
    h.rodAB(eg, v3(0, 0, -9), v3(0, 28, -2.5), 0.6, C.WOOD2);
    const ok = card.ok;
    const bt = h.canvasTex(800, 480, (c, w, hh) => {
      c.fillStyle = '#1f3a2e'; c.fillRect(0, 0, w, hh); c.strokeStyle = '#8a6a40'; c.lineWidth = 18; c.strokeRect(9, 9, w - 18, hh - 18);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#f4f1e8'; c.font = '700 92px "IBM Plex Mono", monospace';
      const txt = card.q + ' = ' + (ok ? card.ans : '?') + ' ' + card.to; let fs = 92; const tw = c.measureText(txt).width; if (tw > w - 150) { fs = Math.floor(92 * (w - 150) / tw); c.font = `700 ${fs}px "IBM Plex Mono", monospace`; }
      c.fillStyle = ok ? '#86e0a8' : '#f4f1e8'; c.fillText(txt, w / 2, 170);
      c.font = '600 40px "IBM Plex Mono", monospace'; c.fillStyle = ok ? '#86e0a8' : '#ffd166';
      c.fillText(ok ? card.mul : 'какой множитель?', w / 2, 290);
      c.font = '500 30px "Golos Text", sans-serif'; c.fillStyle = '#c9d6cf';
      c.fillText('кило- ×1000 · санти- ×0,01 · милли- ×0,001', w / 2, 380);
      c.fillText('1 мин = 60 с · 1 ч = 3600 с · 1 т = 1000 кг', w / 2, 425);
    });
    const brd = new T.Group(); at(brd, 0, 19, -0.3, eg); brd.rotation.x = -0.16;
    at(box(35, 21.6, 1, 0x8a6a40), 0, 0, -0.6, brd);
    at(h.flat(34, 20.4, bt, false), 0, 0, -0.05, brd);
    at(box(38, 1, 2.4, C.WOOD2), 0, -11, 0.6, brd);
    // колода карточек
    d.cards.forEach((k, i) => {
      const x = -42 + i * 16.8, sel = i === d.card, kg = new T.Group(); at(kg, x, sel ? 1.2 : 0, 18, g); clickable(kg, 'card' + i);
      at(box(14, 0.6, 9, sel ? 0xffd166 : k.ok ? 0x86e0a8 : 0x3b4a66), 0, 0.3, 0, kg);
      const t = h.label(12.4, 7.4, k.q + (k.ok ? ' ✓' : ''), k.ok ? '#0e2a18' : '#1b1610', k.ok ? '#dff6e7' : '#fff6e6'); t.rotation.x = -Math.PI / 2; at(t, 0, 0.62, 0, kg);
      if (sel) at(cyl(0.6, 1.2, 0xffd166, { edges: false }), 0, -0.6, 0, kg);
    });
    // клавиши множителей
    const fp = new T.Group(); at(fp, 0, 0, 34, g);
    at(box(92, 2.2, 10, C.WOOD2), 0, 1.1, 0, fp);
    d.factors.forEach((f, i) => h.button(fp, -36 + i * 18, 2.2, 0, f.t, 0xe08a2a, 'f-' + f.k, 15.6, 6.4));
    // подписи
    const n = d.cards.filter(k => k.ok).length;
    kit.tag(v3(mx, 12, mz), 'Метр', 'эталон длины', tgt === 'м');
    kit.tag(v3(kx - 9, 22, kz), 'Килограмм', 'эталон массы', tgt === 'кг');
    kit.tag(v3(cx + 3, 31, cz), 'Секунда', 'эталон времени', tgt === 'с');
    kit.tag(v3(-2, 33, ez), 'Перевод в СИ', n + ' из ' + d.cards.length, n === d.cards.length);
    kit.onFrame(() => { const s = Date.now() / 1000; sh.rotation.z = kit.reduce ? 0 : -((s % 60) / 60) * Math.PI * 2; });
  };
})();
