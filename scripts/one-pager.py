# -*- coding: utf-8 -*-
# Одностраничник для рассылки. Картинкой, а не PDF: в мессенджере она
# открывается сразу, без скачивания. Из неё же собирается PDF — для тех,
# кому удобнее файл.
import os
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.lib.utils import ImageReader

ROOT = "C:/Users/nariman_ospanov/Downloads/bbooster/"
PNG = ROOT + "docs/otvet-one-pager.png"
PDF = ROOT + "docs/otvet-one-pager.pdf"
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
d.text((M + 22, 72), "W", font=bold(36), fill=WHITE)
d.text((M + 84, 76), "Welcome365", font=bold(38), fill=INK)
site = "otvet.mobi"
sw = d.textlength(site, font=semi(30))
d.text((W - M - sw, 84), site, font=semi(30), fill=DIM)
link(W - M - sw - 8, 76, W - M + 8, 124, "https://otvet.mobi")

# --- плашка «для кого» ---
tag = "ИИ-РЕСЕПШЕН ДЛЯ СТОМАТОЛОГИЙ И МЕДЦЕНТРОВ"
tw = d.textlength(tag, font=semi(24))
d.rounded_rectangle([M, 176, M + tw + 56, 232], radius=28, fill=MIST)
d.ellipse([M + 26, 198, M + 40, 212], fill=TEAL)
d.text((M + 52, 191), tag, font=semi(24), fill=TEAL_D)

# --- заголовок ---
y = 276
y = draw_block("ИИ принимает звонки, записывает на приём и сам звонит пациентам",
               bold(66), M, y, CW, INK, 82)

# --- подзаголовок ---
y += 18
y = draw_block("Отвечает, когда ответить некому. Напоминает о приёме накануне "
               "и возвращает тех, кто давно не был.",
               body(32), M, y, CW, DIM, 46)

# --- четыре пункта ---
y += 34
POINTS = [
    ("Круглосуточно, без выходных",
     "Пациент с болью в одиннадцать вечера дозванивается, а не слушает гудки"),
    ("Отвечает как обученный консультант",
     "По вашему прайсу и расписанию, на любом языке"),
    ("Записывает на приём",
     "Смотрит свободное время в вашей CRM через API. Подключаем быстро — и с интеграцией, и без неё"),
    ("Вы слышите каждый разговор",
     "Запись и расшифровка по репликам в личном кабинете"),
    ("Напоминает о приёме накануне",
     "Звонит за день и уточняет, в силе ли визит. Не придёт — успеете отдать время другому"),
    ("Возвращает тех, кто давно не был",
     "Обзванивает базу: плановый осмотр, гигиена, акция. Кто согласился — записан"),
]
for title, sub in POINTS:
    d.ellipse([M + 4, y + 14, M + 20, y + 30], fill=TEAL)
    d.text((M + 44, y), title, font=semi(34), fill=INK)
    y += 46
    y = draw_block(sub, body(28), M + 44, y, CW - 44, DIM, 38)
    y += 26

# Исходящие звонки пока подключаются отдельно — говорим это на самой странице,
# чтобы продавец не обещал того, что включается не сразу.
y += 4
d.text((M + 44, y), "Два последних пункта — исходящие звонки, подключаем по запросу",
       font=body(26), fill=TEAL_D)
y += 46

# --- цена ---
y += 8
box_h = 196
d.rounded_rectangle([M, y, W - M, y + box_h], radius=28, fill=MIST)
# Две половины цены разведены к краям: между ними плюс, и видно, что это
# сумма постоянной части и переменной, а не одна цифра рядом с другой.
d.text((M + 48, y + 34), "9 000 ₸", font=bold(58), fill=INK)
d.text((M + 48, y + 104), "в месяц — аренда номера,", font=body(28), fill=DIM)
d.text((M + 48, y + 140), "кабинет и поддержка", font=body(28), fill=DIM)

plus_x = M + 400
d.text((plus_x, y + 44), "+", font=bold(52), fill=TEAL)

right_x = M + 486
d.text((right_x, y + 34), "150 ₸", font=bold(58), fill=INK)
d.text((right_x, y + 104), "за минуту разговора", font=body(28), fill=DIM)
y += box_h + 40

# --- призыв: послушать вживую ---
cta_h = 232
d.rounded_rectangle([M, y, W - M, y + cta_h], radius=28, fill=TEAL_D)
d.text((M + 44, y + 32), "Позвоните и послушайте сами", font=semi(34), fill=WHITE)
d.text((M + 44, y + 88), "+7 727 312 28 37", font=bold(58), fill=WHITE)
link(M + 36, y + 80, M + 44 + d.textlength("+7 727 312 28 37", font=bold(58)) + 10,
     y + 160, "tel:+77273122837")
d.text((M + 44, y + 174), "Ответит тот же ассистент, что будет отвечать вашим пациентам",
       font=body(26), fill=(190, 230, 234))
y += cta_h + 46

# --- подвал ---
d.line([M, y, W - M, y], fill=(219, 234, 236), width=2)
y += 26
d.text((M, y), "otvet.mobi", font=semi(30), fill=INK)
link(M - 6, y - 6, M + d.textlength("otvet.mobi", font=semi(30)) + 6, y + 44,
     "https://otvet.mobi")
right = "+7 702 941 06 25 · Алматы"
rw = d.textlength(right, font=body(30))
d.text((W - M - rw, y), right, font=body(30), fill=DIM)
phone_w = d.textlength("+7 702 941 06 25", font=body(30))
link(W - M - rw - 6, y - 6, W - M - rw + phone_w + 6, y + 44, "tel:+77029410625")

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
c.setTitle("Welcome365 — ИИ-ресепшен для стоматологий и медцентров")
c.drawImage(ImageReader(img), 0, 0, width=PW, height=PH)
for x0, y0, x1, y1, url in LINKS:
    rect = (x0 * K, PH - y1 * K, x1 * K, PH - y0 * K)   # у PDF ось Y снизу
    c.linkURL(url, rect, relative=0, thickness=0)
c.showPage()
c.save()
print("высота:", img.height, "| ссылок в PDF:", len(LINKS))
print("готово:", PNG, os.path.getsize(PNG), "байт;", PDF, os.path.getsize(PDF), "байт")
