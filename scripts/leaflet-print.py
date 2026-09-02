# -*- coding: utf-8 -*-
# Печатная листовка A5 (148x210 мм) и раскладка «две на A4» для офисного
# принтера.
#
# Почему A5, а не A4: это стандартный флаер — дешевле всего в типографии,
# помещается в папку и на стойку ресепшена, и режется из A4 ровно пополам,
# без обрезков. Фон белый до самого края, цветные блоки не выходят в срез,
# поэтому вылеты (bleed) не нужны: типография режет по формату, и белая
# полоска от смещения ножа никак не видна.
#
# Макет считается в точках при 300 dpi, а рисуется с запасом (SS), чтобы на
# бумаге мелкий шрифт не сыпался.
import os, sys
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.lib.utils import ImageReader

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import leaflet_text as T

ROOT = "C:/Users/nariman_ospanov/Downloads/bbooster/"
PNG = ROOT + "docs/reception365-listovka-a5.png"
PDF_A5 = ROOT + "docs/reception365-listovka-a5.pdf"
PDF_2UP = ROOT + "docs/reception365-listovka-a4-2up.pdf"
FONTS = "C:/Windows/Fonts/"

SS = 2                      # во столько раз рисуем крупнее: итог 600 dpi
W, H = 1748, 2480           # A5 при 300 dpi
M = 120                     # поле ~10 мм
CW = W - 2 * M

INK = (12, 43, 49)
TEAL = (15, 154, 168)
TEAL_D = (11, 111, 122)
MIST = (238, 248, 249)
DIM = (74, 107, 114)
WHITE = (255, 255, 255)
RULE = (150, 180, 186)

img = Image.new("RGB", (W * SS, H * SS), WHITE)
d = ImageDraw.Draw(img)

def f(name, size):
    return ImageFont.truetype(FONTS + name, int(round(size * SS)))

bold = lambda s: f("segoeuib.ttf", s)
semi = lambda s: f("seguisb.ttf", s)
body = lambda s: f("segoeui.ttf", s)

# Всё ниже пишется в координатах 300 dpi, а на холст ложится через эти обёртки.
def text(xy, s, font, fill):
    d.text((xy[0] * SS, xy[1] * SS), s, font=font, fill=fill)

def tlen(s, font):
    return d.textlength(s, font=font) / SS

def rrect(box, radius, fill):
    d.rounded_rectangle([v * SS for v in box], radius=radius * SS, fill=fill)

def ellipse(box, fill):
    d.ellipse([v * SS for v in box], fill=fill)

def line(box, fill, width):
    d.line([v * SS for v in box], fill=fill, width=int(width * SS))

LINKS = []
def link(x0, y0, x1, y1, url):
    LINKS.append((x0, y0, x1, y1, url))

def wrap(s, font, width):
    words, lines, cur = s.split(), [], ""
    for w in words:
        probe = (cur + " " + w).strip()
        if tlen(probe, font) <= width:
            cur = probe
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines

def block(s, font, x, y, width, fill, leading):
    for ln in wrap(s, font, width):
        text((x, y), ln, font, fill)
        y += leading
    return y

# --- шапка ---
rrect([M, 118, M + 96, 214], 26, TEAL)
text((M + 30, 134), "R", bold(54), WHITE)
text((M + 124, 140), T.BRAND, bold(58), INK)
sw = tlen(T.SITE, semi(40))
text((W - M - sw, 152), T.SITE, semi(40), DIM)
link(W - M - sw - 10, 140, W - M + 10, 208, T.SITE)

# --- плашка «для кого» ---
tw = tlen(T.TAG, semi(31))
rrect([M, 268, M + tw + 96, 344], 38, MIST)
ellipse([M + 40, 296, M + 60, 316], TEAL)
text((M + 76, 285), T.TAG, semi(31), TEAL_D)

# --- заголовок ---
y = 404
y = block(T.H1, bold(88), M, y, CW, INK, 108)

# --- пункты ---
y += 30
for title, sub in T.POINTS_PRINT:
    ellipse([M + 6, y + 20, M + 30, y + 44], TEAL)
    text((M + 62, y), title, semi(50), INK)
    y += 66
    y = block(sub, body(40), M + 62, y, CW - 62, DIM, 54)
    y += 22

text((M + 62, y), T.OUTBOUND_NOTE_PRINT, body(36), TEAL_D)
y += 56

# --- цена ---
box_h = 250
rrect([M, y, W - M, y + box_h], 38, MIST)
text((M + 62, y + 44), T.PRICE_FIX, bold(80), INK)
text((M + 62, y + 148), T.PRICE_FIX_SUB[0], body(38), DIM)
text((M + 62, y + 196), T.PRICE_FIX_SUB[1], body(38), DIM)
text((M + 640, y + 58), "+", bold(70), TEAL)
text((M + 780, y + 44), T.PRICE_VAR, bold(80), INK)
text((M + 780, y + 148), T.PRICE_VAR_SUB, body(38), DIM)
y += box_h + 18
text((M + 62, y), T.SPEED, semi(40), TEAL_D)
y += 66

# --- призыв: послушать вживую ---
cta_h = 292
rrect([M, y, W - M, y + cta_h], 38, TEAL_D)
text((M + 62, y + 42), T.CTA_TITLE, semi(46), WHITE)
text((M + 62, y + 116), T.DEMO_PHONE, bold(80), WHITE)
link(M + 52, y + 106, M + 62 + tlen(T.DEMO_PHONE, bold(80)) + 14, y + 216, T.DEMO_TEL)
text((M + 62, y + 228), T.CTA_SUB, body(34), (190, 230, 234))
y += cta_h + 46

# --- место для промокода: агент вписывает свой код от руки ---
text((M, y), T.PROMO, semi(40), INK)
pw = tlen(T.PROMO, semi(40))
line([M + pw + 24, y + 48, W - M, y + 48], RULE, 3)
y += 76

# --- подвал ---
line([M, y, W - M, y], (219, 234, 236), 3)
y += 36
text((M, y), T.SITE, semi(40), INK)
link(M - 8, y - 8, M + tlen(T.SITE, semi(40)) + 8, y + 60, T.SITE)
rw = tlen(T.SALES_PHONE, body(40))
text((W - M - rw, y), T.SALES_PHONE, body(40), DIM)
link(W - M - rw - 8, y - 8, W - M + 8, y + 60, T.SALES_TEL)
bottom = y + 56

img.save(PNG, "PNG", optimize=True)

# --- PDF ---
MM = 72 / 25.4
A5 = (148 * MM, 210 * MM)                 # 419.5 x 595.3 pt
A4L = (297 * MM, 210 * MM)

def put_links(c, ox, oy, page_h, k):
    for x0, y0, x1, y1, url in LINKS:
        c.linkURL(url, (ox + x0 * k, oy + page_h - y1 * k,
                        ox + x1 * k, oy + page_h - y0 * k), relative=0, thickness=0)

K = A5[0] / W                              # пиксель макета -> пункт PDF
reader = ImageReader(img)

c = rl_canvas.Canvas(PDF_A5, pagesize=A5)
c.setTitle("Reception365 — листовка A5")
c.drawImage(reader, 0, 0, width=A5[0], height=A5[1])
put_links(c, 0, 0, A5[1], K)
c.showPage(); c.save()

# Две листовки на A4: печатаешь на офисном принтере и режешь по средней линии.
c = rl_canvas.Canvas(PDF_2UP, pagesize=A4L)
c.setTitle("Reception365 — листовка A5, две на A4")
ox = (A4L[0] - 2 * A5[0]) / 2
oy = (A4L[1] - A5[1]) / 2
for i in (0, 1):
    x = ox + i * A5[0]
    c.drawImage(reader, x, oy, width=A5[0], height=A5[1])
    put_links(c, x, oy, A5[1], K)
c.setStrokeColorRGB(.78, .84, .85)
c.setLineWidth(.4)
c.setDash(3, 4)
c.line(A4L[0] / 2, 0, A4L[0] / 2, A4L[1])   # линия реза
c.showPage(); c.save()

print("низ содержимого:", bottom, "из", H, "| запас снизу:", H - bottom, "px (300 dpi)")
print("ссылок:", len(LINKS))
for p in (PNG, PDF_A5, PDF_2UP):
    print("готово:", p, os.path.getsize(p), "байт")
