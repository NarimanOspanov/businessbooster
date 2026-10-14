// Улучшение фото внешним сервисом (ImageEnhancer) — первым шагом полировки
// постов Instagram, до обработки нейросетью (polish.js). Ключ — переменная
// окружения IMAGE_ENHANCER_API_KEY; адрес можно сменить IMAGE_ENHANCER_URL.
// Нет ключа, ошибка или непонятный ответ — фото идёт дальше как было.
//
//   curl -X POST "$URL" --form "original_preview_image=@image.jpg" --form "api_key=$KEY"
//
// Без ключа сервис отвечает 401 {"error":true,"message":"Get credit failed"}.
// Удачный ответ: JSON {"edited_image":{"image":"<base64 JPEG>", "image_id",
// "mask", "watermark_mask"}} — берём edited_image.image. Про запас принимаем и
// картинку напрямую (image/*), другой JSON с base64 / data:-URI или ссылкой.

const URL_DEFAULT = "https://imageenhancer-cfeqfqcff3hzeed9.northeurope-01.azurewebsites.net/enhance";

function apiKey() { return (process.env.IMAGE_ENHANCER_API_KEY || "").trim(); }
function available() { return !!apiKey(); }

const isImage = (b) => b && b.length > 1000 &&
  ((b[0] === 0xff && b[1] === 0xd8) || (b[0] === 0x89 && b[1] === 0x50) || (b.slice(8, 12).toString() === "WEBP"));

// Ищем в JSON картинку: строку base64 / data:-URI или ссылку http(s).
function findInJson(j, depth) {
  if (depth > 4 || j == null) return null;
  if (typeof j === "string") {
    const s = j.trim();
    if (/^https?:\/\//i.test(s)) return { url: s };
    const m = s.match(/^data:image\/[a-z+]+;base64,(.+)$/i);
    const b64 = m ? m[1] : s.length > 2000 && /^[A-Za-z0-9+/=\s]+$/.test(s) ? s : null;
    if (b64) { const b = Buffer.from(b64, "base64"); if (isImage(b)) return { buf: b }; }
    return null;
  }
  if (Array.isArray(j)) { for (const v of j) { const r = findInJson(v, depth + 1); if (r) return r; } return null; }
  if (typeof j === "object") {
    // Сначала поля с говорящими именами, потом остальные.
    const keys = Object.keys(j).sort((a, b) => (/image|img|result|output|enhanced|url|data|file/i.test(b) ? 1 : 0) - (/image|img|result|output|enhanced|url|data|file/i.test(a) ? 1 : 0));
    for (const k of keys) { const r = findInJson(j[k], depth + 1); if (r) return r; }
  }
  return null;
}

async function enhance(buf) {
  const key = apiKey();
  if (!key || !buf) return { buf: buf, ok: false, why: "нет ключа" };
  const form = new FormData();
  form.append("original_preview_image", new Blob([buf], { type: "image/jpeg" }), "image.jpg");
  form.append("api_key", key);
  const r = await fetch(process.env.IMAGE_ENHANCER_URL || URL_DEFAULT, { method: "POST", body: form, signal: AbortSignal.timeout(90000) });
  const type = String(r.headers.get("content-type") || "");
  const body = Buffer.from(await r.arrayBuffer());
  if (!r.ok) throw new Error("enhancer " + r.status + ": " + body.toString().slice(0, 160));
  if (/^image\//i.test(type) || isImage(body)) return { buf: body, ok: true };
  let j = null;
  try { j = JSON.parse(body.toString()); } catch { /* не JSON */ }
  if (j && j.error) throw new Error("enhancer: " + String(j.message || JSON.stringify(j)).slice(0, 160));
  // Известный формат: {"edited_image":{"image":"<base64 JPEG>","image_id":…,"mask":…,"watermark_mask":…}}.
  // Маски (PNG) не нужны — берём только image.
  const ei = j && j.edited_image && j.edited_image.image;
  if (typeof ei === "string") {
    const b = Buffer.from(ei.replace(/^data:image\/[a-z+]+;base64,/i, ""), "base64");
    if (isImage(b)) return { buf: b, ok: true };
  }
  const hit = j ? findInJson(j, 0) : null;
  if (hit && hit.buf) return { buf: hit.buf, ok: true };
  if (hit && hit.url) {
    const g = await fetch(hit.url, { signal: AbortSignal.timeout(60000) });
    const b = Buffer.from(await g.arrayBuffer());
    if (g.ok && isImage(b)) return { buf: b, ok: true };
    throw new Error("enhancer: по ссылке не картинка (" + g.status + ")");
  }
  throw new Error("enhancer: непонятный ответ " + type + " " + body.toString().slice(0, 160));
}

// Все фото поста, по 3 одновременно; сбой одного — это фото без улучшения.
async function enhanceAll(bufs) {
  const out = bufs.slice();
  const stat = { ok: 0, failed: 0, errors: [] };
  for (let i = 0; i < bufs.length; i += 3) {
    await Promise.all(bufs.slice(i, i + 3).map(async (b, k) => {
      try {
        const r = await enhance(b);
        if (r.ok) { out[i + k] = r.buf; stat.ok++; }
      } catch (e) {
        stat.failed++;
        if (stat.errors.length < 3) stat.errors.push(e.message);
      }
    }));
  }
  return { bufs: out, stat: stat };
}

module.exports = { available, enhance, enhanceAll };
