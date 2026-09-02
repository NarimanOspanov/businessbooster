# -*- coding: utf-8 -*-
# Одностраничник для рассылки. Картинкой, а не PDF: в мессенджере она
# открывается сразу, без скачивания. Из неё же собирается PDF — для тех,
# кому удобнее файл.
import os, sys
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.lib.utils import ImageReader

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import leaflet_text as T          # тексты общие с печатной листовкой

ROOT = "C:/Users/nariman_ospanov/Downloads/bbooster/"
PNG = ROOT + "docs/reception365-one-pager.png"
PDF = ROOT + "docs/reception365-one-pager.pdf"
FONTS = "C:/Windows/Fonts/"

W, H = 1080, 2400            # холст с запасом, внизу обрежем по содержимому
INK = (12, 43, 49)
TEAL = (15, 154, 168)
TEAL_D = (11, 111, 122)
MIST = (238, 248, 249)
DIM = (74, 107, 114)
WHITE = (255, 255, 255)

def f(name, size):
    return ImageFont.truetype(FONTS + name, size)

bold = lambda s: f("segoeuib.ttf", s)
semi = lambda s: f("seguisb.ttf", s)
body = lambda s: f("segoeui.ttf", s)

img = Image.new("RGB", (W, H), WHITE)
d = ImageDraw.Draw(img)

# Кликабельные области PDF: координаты в пикселях картинки, потом пересчитаем.
LINKS = []
def link(x0, y0, x1, y1, url):
    LINKS.append((x0, y0, x1, y1, url))

def wrap(text, font, width):
    words, lines, cur = text.split(), [], ""
    for w in words:
        probe = (cur + " " + w).strip()
        if d.textlength(probe, font=font) <= width:
            cur = probe
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines

def draw_block(text, font, x, y, width, fill, leading):
    for line in wrap(text, font, width):
        d.text((x, y), line, font=font, fill=fill)
        y += leading
    return y

M = 72                      # поле
CW = W - 2 * M              # рабочая ширина

# --- шапка ---
d.rounded_rectangle([M, 60, M + 64, 124], radius=18, fill=TEAL)
d.text((M + 24, 72), "R", font=bold(36), fill=WHITE)
d.text((M + 84, 76), T.BRAND, font=bold(38), fill=INK)
site = T.SITE
sw = d.textlength(site, font=semi(30))
d.text((W - M - sw, 84), site, font=semi(30), fill=DIM)
link(W - M - sw - 8, 76, W - M + 8, 124, T.SITE)

# --- плашка «для кого» ---
tag = T.TAG
tw = d.textlength(tag, font=semi(24))
d.rounded_rectangle([M, 176, M + tw + 56, 232], radius=28, fill=MIST)
d.ellipse([M + 26, 198, M + 40, 212], fill=TEAL)
d.text((M + 52, 191), tag, font=semi(24), fill=TEAL_D)

# --- заголовок ---
y = 276
y = draw_block(T.H1, bold(66), M, y, CW, INK, 82)

# --- подзаголовок ---
y += 18
y = draw_block(T.SUB, body(32), M, y, CW, DIM, 46)

# --- четыре пункта ---
y += 34
POINTS = T.POINTS
for title, sub in POINTS:
    d.ellipse([M + 4, y + 14, M + 20, y + 30], fill=TEAL)
    d.text((M + 44, y), title, font=semi(34), fill=INK)
    y += 46
    y = draw_block(sub, body(28), M + 44, y, CW - 44, DIM, 38)
    y += 26

# Исходящие звонки пока подключаются отдельно — говорим это на самой странице,
# чтобы продавец не обещал того, что включается не сразу.
y += 4
d.text((M + 44, y), T.OUTBOUND_NOTE, font=body(26), fill=TEAL_D)
y += 46

# --- цена ---
y += 8
box_h = 196
d.rounded_rectangle([M, y, W - M, y + box_h], radius=28, fill=MIST)
# Две половины цены разведены к краям: между ними плюс, и видно, что это
# сумма постоянной части и переменной, а не одна цифра рядом с другой.
d.text((M + 48, y + 34), T.PRICE_FIX, font=bold(58), fill=INK)
d.text((M + 48, y + 104), T.PRICE_FIX_SUB[0], font=body(28), fill=DIM)
d.text((M + 48, y + 140), T.PRICE_FIX_SUB[1], font=body(28), fill=DIM)

plus_x = M + 400
d.text((plus_x, y + 44), "+", font=bold(52), fill=TEAL)

right_x = M + 486
d.text((right_x, y + 34), T.PRICE_VAR, font=bold(58), fill=INK)
d.text((right_x, y + 104), T.PRICE_VAR_SUB, font=body(28), fill=DIM)
y += box_h + 14
d.text((M + 48, y), T.SPEED, font=semi(28), fill=TEAL_D)
y += 52

# --- призыв: послушать вживую ---
cta_h = 232
d.rounded_rectangle([M, y, W - M, y + cta_h], radius=28, fill=TEAL_D)
d.text((M + 44, y + 32), T.CTA_TITLE, font=semi(34), fill=WHITE)
d.text((M + 44, y + 88), T.DEMO_PHONE, font=bold(58), fill=WHITE)
link(M + 36, y + 80, M + 44 + d.textlength(T.DEMO_PHONE, font=bold(58)) + 10,
     y + 160, T.DEMO_TEL)
d.text((M + 44, y + 174), T.CTA_SUB, font=body(26), fill=(190, 230, 234))
y += cta_h + 46

# --- место для промокода ---
# Листовку раздают агенты, и каждый вписывает сюда свой код от руки: по нему
# потом видно, чья это заявка. Печатать код нельзя — он у всех разный.
promo = T.PROMO
d.text((M, y), promo, font=semi(28), fill=INK)
pw = d.textlength(promo, font=semi(28))
d.line([M + pw + 18, y + 34, W - M, y + 34], fill=(150, 180, 186), width=2)
y += 62

# --- подвал ---
d.line([M, y, W - M, y], fill=(219, 234, 236), width=2)
y += 26
d.text((M, y), T.SITE, font=semi(30), fill=INK)
link(M - 6, y - 6, M + d.textlength(T.SITE, font=semi(30)) + 6, y + 44, T.SITE)
right = T.SALES_PHONE
rw = d.textlength(right, font=body(30))
d.text((W - M - rw, y), right, font=body(30), fill=DIM)
phone_w = d.textlength(T.SALES_PHONE, font=body(30))
link(W - M - rw - 6, y - 6, W - M - rw + phone_w + 6, y + 44, T.SALES_TEL)

# Обрезаем по последней нарисованной строке: так одностраничник всегда
# заканчивается там, где кончается текст, а не там, где кончился холст.
img = img.crop((0, 0, W, y + 78))
img = img  # холст уже обрезан
img.save(PNG, "PNG", optimize=True)

# PDF рисуем поверх той же картинки и накрываем ссылки прозрачными областями:
# в мессенджере по ним открывается сайт и набирается номер.
K = 0.5                                   # пиксель картинки -> пункт PDF
PW, PH = W * K, img.height * K
c = rl_canvas.Canvas(PDF, pagesize=(PW, PH))
c.setTitle("Reception365 — ИИ-ресепшен для стоматологий и медцентров")
c.drawImage(ImageReader(img), 0, 0, width=PW, height=PH)
for x0, y0, x1, y1, url in LINKS:
    rect = (x0 * K, PH - y1 * K, x1 * K, PH - y0 * K)   # у PDF ось Y снизу
    c.linkURL(url, rect, relative=0, thickness=0)
c.showPage()
c.save()
print("высота:", img.height, "| ссылок в PDF:", len(LINKS))
print("готово:", PNG, os.path.getsize(PNG), "байт;", PDF, os.path.getsize(PDF), "байт")
