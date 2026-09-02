# -*- coding: utf-8 -*-
# Одностраничник для рассылки. Картинкой, а не PDF: в мессенджере она
# открывается сразу, без скачивания. Из неё же собирается PDF — для тех,
# кому удобнее файл.
import os
from PIL import Image, ImageDraw, ImageFont

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
d.text((M + 20, 72), "О", font=bold(38), fill=WHITE)
d.text((M + 84, 76), "Ответ", font=bold(38), fill=INK)
site = "otvet.mobi"
d.text((W - M - d.textlength(site, font=semi(30)), 84), site, font=semi(30), fill=DIM)

# --- плашка «для кого» ---
tag = "ИИ-АВТООТВЕТЧИК ДЛЯ СТОМАТОЛОГИЙ И МЕДЦЕНТРОВ"
tw = d.textlength(tag, font=semi(24))
d.rounded_rectangle([M, 176, M + tw + 56, 232], radius=28, fill=MIST)
d.ellipse([M + 26, 198, M + 40, 212], fill=TEAL)
d.text((M + 52, 191), tag, font=semi(24), fill=TEAL_D)

# --- заголовок ---
y = 276
y = draw_block("ИИ берёт трубку, отвечает и записывает на свободное время",
               bold(66), M, y, CW, INK, 82)

# --- подзаголовок ---
y += 18
y = draw_block("Отвечает тогда, когда ответить некому: вечером после закрытия, "
               "в выходные, в обед и пока администратор говорит по другой линии.",
               body(32), M, y, CW, DIM, 46)

# --- четыре пункта ---
y += 34
POINTS = [
    ("Круглосуточно, без выходных",
     "Пациент с болью в одиннадцать вечера дозванивается, а не слушает гудки"),
    ("Отвечает как обученный консультант",
     "По вашему прайсу и расписанию, на любом языке. Чего не знает — не выдумывает"),
    ("Записывает в вашу программу",
     "Смотрит свободное время. Нет программы — заявка приходит в Telegram или в нашу CRM"),
    ("Вы слышите каждый разговор",
     "Запись и расшифровка по репликам в личном кабинете"),
]
for title, sub in POINTS:
    d.ellipse([M + 4, y + 14, M + 20, y + 30], fill=TEAL)
    d.text((M + 44, y), title, font=semi(34), fill=INK)
    y += 46
    y = draw_block(sub, body(28), M + 44, y, CW - 44, DIM, 38)
    y += 26

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
d.text((right_x, y + 104), "за минуту разговора.", font=body(28), fill=DIM)
d.text((right_x, y + 140), "Платите только за принятые", font=body(28), fill=DIM)
y += box_h + 40

# --- призыв: послушать вживую ---
cta_h = 232
d.rounded_rectangle([M, y, W - M, y + cta_h], radius=28, fill=TEAL_D)
d.text((M + 44, y + 32), "Позвоните и послушайте сами", font=semi(34), fill=WHITE)
d.text((M + 44, y + 88), "+7 727 312 28 37", font=bold(58), fill=WHITE)
d.text((M + 44, y + 174), "Ответит тот же ассистент, что будет отвечать вашим пациентам",
       font=body(26), fill=(190, 230, 234))
y += cta_h + 46

# --- подвал ---
d.line([M, y, W - M, y], fill=(219, 234, 236), width=2)
y += 26
d.text((M, y), "otvet.mobi", font=semi(30), fill=INK)
right = "+7 702 941 06 25 · Алматы"
d.text((W - M - d.textlength(right, font=body(30)), y), right, font=body(30), fill=DIM)

# Обрезаем по последней нарисованной строке: так одностраничник всегда
# заканчивается там, где кончается текст, а не там, где кончился холст.
img = img.crop((0, 0, W, y + 78))
img.save(PNG, "PNG", optimize=True)
img.convert("RGB").save(PDF, "PDF", resolution=150.0)
print("высота:", img.height)
print("готово:", PNG, os.path.getsize(PNG), "байт;", PDF, os.path.getsize(PDF), "байт")
