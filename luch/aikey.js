// «Свой ключ ИИ»: ученик вставляет ключ Gemini / OpenAI / Anthropic — наставник на сайте отвечает за его счёт.
// Ключ хранится только в этом браузере (localStorage 'oe-ai') и уходит заголовком в запросы к наставнику; сервер его не сохраняет.
// Использование: <div id="aikey"></div><script src="/luch/aikey.js"></script>
(() => {
  const box = document.getElementById('aikey'); if (!box) return;
  const P = {
    gemini: { name: 'Google Gemini', free: true, url: 'https://aistudio.google.com/apikey', how: 'Войдите в Google AI Studio → «Create API key» → скопируйте ключ. Бесплатно, карта не нужна.' },
    openai: { name: 'OpenAI', url: 'https://platform.openai.com/api-keys', how: 'platform.openai.com → API keys → «Create new secret key». Оплата по факту использования.' },
    anthropic: { name: 'Anthropic Claude', url: 'https://console.anthropic.com/settings/keys', how: 'console.anthropic.com → API Keys → «Create Key». Оплата по факту использования.' },
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const css = document.createElement('style');
  css.textContent = `.aik h4{margin:0 0 6px;font:600 12px/1 var(--font-mono,monospace);letter-spacing:.14em;text-transform:uppercase;color:var(--muted,#8b96ad)}
    .aik p{margin:0 0 12px;color:var(--muted,#8b96ad);font-size:14px}
    .aik .seg{display:inline-flex;flex-wrap:wrap;border:1px solid var(--line,#26324a);border-radius:12px;overflow:hidden;margin-bottom:10px}
    .aik .seg button{all:unset;cursor:pointer;padding:8px 12px;font-size:13px;font-weight:600}.aik .seg button[aria-checked="true"]{background:var(--fg,#e8ecf4);color:var(--bg,#0b1019)}
    .aik .seg button:focus-visible,.aik .b:focus-visible{outline:2px solid var(--accent,#ffb547);outline-offset:2px}
    .aik .seg .fr{font-size:10px;font-weight:700;color:#1b1206;background:#86e0a8;border-radius:6px;padding:1px 5px;margin-left:5px;vertical-align:1px}
    .aik .row{display:flex;gap:8px;flex-wrap:wrap}
    .aik input{flex:1;min-width:200px;height:42px;padding:0 12px;border-radius:12px;border:1px solid var(--line,#26324a);background:var(--bg,#0b1019);color:var(--fg,#e8ecf4);font:500 14px var(--font-mono,monospace)}
    .aik input:focus{outline:2px solid var(--accent,#ffb547);border-color:transparent}
    .aik .b{all:unset;cursor:pointer;padding:10px 14px;border-radius:12px;border:1px solid var(--line,#26324a);background:var(--surface-2,#1a2438);font-weight:600;font-size:14px}
    .aik .b.pri{background:var(--accent,#ffb547);color:#1b1206;border-color:var(--accent,#ffb547)}
    .aik .how{font-size:13px;color:var(--muted,#8b96ad);margin:8px 0 0}.aik .how a{color:var(--accent,#ffb547)}
    .aik .st{margin-top:10px;font-size:14px;min-height:20px}.aik .st.ok{color:#86e0a8}.aik .st.er{color:#ff8a73}`;
  document.head.appendChild(css);
  let cur = null; try { cur = JSON.parse(localStorage.getItem('oe-ai') || 'null'); } catch (e) {}
  let prov = (cur && cur.p) || 'gemini';
  function draw(status, cls) {
    const has = cur && cur.k;
    box.className = (box.className.replace(/\baik\b/, '') + ' aik').trim();
    box.innerHTML = `<h4>Свой ключ ИИ</h4>
      <p>${has ? `Наставник отвечает через ваш ключ ${esc(P[cur.p].name)} — без ограничений по количеству вопросов.` : 'Подключите свой ключ — и наставник будет отвечать за ваш счёт, без дневных ограничений. С ключом Gemini это бесплатно.'} Ключ хранится только в этом браузере.</p>
      <div class="seg" role="radiogroup" aria-label="Чей ключ">${Object.entries(P).map(([k, v]) => `<button type="button" role="radio" data-p="${k}" aria-checked="${prov === k}">${v.name}${v.free ? '<span class="fr">бесплатно</span>' : ''}</button>`).join('')}</div>
      <div class="row"><input id="aikIn" type="password" autocomplete="off" spellcheck="false" placeholder="${has && cur.p === prov ? '•••• ключ сохранён ••••' : 'Вставьте ключ'}" aria-label="Ключ ${esc(P[prov].name)}">
        <button class="b pri" type="button" id="aikSave">Сохранить и проверить</button>${has ? '<button class="b" type="button" id="aikDel">Убрать ключ</button>' : ''}</div>
      <p class="how">Где взять: <a href="${P[prov].url}" target="_blank" rel="noopener">${esc(P[prov].url.replace('https://', ''))}</a> — ${esc(P[prov].how)}</p>
      <div class="st ${cls || ''}" role="status">${status || ''}</div>`;
    box.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { prov = b.dataset.p; draw(); });
    box.querySelector('#aikSave').onclick = save;
    const del = box.querySelector('#aikDel'); if (del) del.onclick = () => { try { localStorage.removeItem('oe-ai'); } catch (e) {} cur = null; draw('Ключ убран — наставник снова работает через Open School AI.', 'ok'); };
  }
  async function save() {
    const k = box.querySelector('#aikIn').value.trim();
    if (!k) { draw('Вставьте ключ.', 'er'); return; }
    draw('Проверяю ключ…');
    try {
      const r = await fetch('/api/tutor', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-User-AI': prov, 'X-User-Key': k },
        body: JSON.stringify({ page: '/me', lang: 'ru', context: 'Проверка ключа', messages: [{ role: 'user', content: 'Ответь одним словом: «Готово».' }] }) });
      const t = await r.text();
      if (!r.ok || /ключ ИИ|Не получилось/.test(t)) { draw(/лимит/.test(t) ? 'У ключа закончился лимит — попробуйте позже или другой ключ.' : 'Ключ не подошёл. Проверьте, что скопировали его целиком.', 'er'); return; }
      cur = { p: prov, k }; try { localStorage.setItem('oe-ai', JSON.stringify(cur)); } catch (e) {}
      draw('Готово! Ключ работает — наставник теперь отвечает через ' + P[prov].name + '.', 'ok');
    } catch (e) { draw('Нет связи — попробуйте ещё раз.', 'er'); }
  }
  draw();
  if (location.hash === '#ai') setTimeout(() => box.scrollIntoView({ behavior: 'smooth', block: 'center' }), 600);
})();
