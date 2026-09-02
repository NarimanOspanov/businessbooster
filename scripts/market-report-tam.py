# -*- coding: utf-8 -*-
# TAM / SAM / SOM по четырём странам. Считается из числа частных клиник и
# нашей же цены; все допущения вынесены в таблицу, чтобы их можно было
# оспорить по одному, а не спорить с итогом целиком.
import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                                PageBreak, KeepTogether)

OUT = "C:/Users/nariman_ospanov/Downloads/bbooster/docs/tam-sam-som-2026-09.pdf"
F = "C:/Windows/Fonts/"
pdfmetrics.registerFont(TTFont("Body", F + "segoeui.ttf"))
pdfmetrics.registerFont(TTFont("Bold", F + "segoeuib.ttf"))
pdfmetrics.registerFont(TTFont("Semi", F + "seguisb.ttf"))

INK = colors.HexColor("#0c2b31"); TEAL = colors.HexColor("#0f9aa8")
TEAL_D = colors.HexColor("#0b6f7a"); MIST = colors.HexColor("#eef8f9")
LINE = colors.HexColor("#d9edef"); DIM = colors.HexColor("#4a6b72")

st = {
 "h1": ParagraphStyle("h1", fontName="Bold", fontSize=25, leading=29, textColor=INK, spaceAfter=4),
 "sub": ParagraphStyle("sub", fontName="Body", fontSize=11.5, leading=16, textColor=DIM, spaceAfter=16),
 "h2": ParagraphStyle("h2", fontName="Bold", fontSize=15, leading=19, textColor=INK, spaceBefore=15, spaceAfter=7),
 "p": ParagraphStyle("p", fontName="Body", fontSize=10.5, leading=15.5, textColor=INK, spaceAfter=7),
 "small": ParagraphStyle("small", fontName="Body", fontSize=9, leading=13, textColor=DIM, spaceAfter=5),
 "cell": ParagraphStyle("cell", fontName="Body", fontSize=9.5, leading=12.5, textColor=INK),
 "cellb": ParagraphStyle("cellb", fontName="Semi", fontSize=9.5, leading=12.5, textColor=INK),
 "cellh": ParagraphStyle("cellh", fontName="Semi", fontSize=9.5, leading=12.5, textColor=colors.white),
 "big": ParagraphStyle("big", fontName="Bold", fontSize=13, leading=16, textColor=INK),
}

KURS = 500
# страна: клиник, ARPU в долларах в месяц, доля обслуживаемых
DATA = [("Казахстан", 5455, 50, 0.60), ("Узбекистан", 9000, 35, 0.60),
        ("Россия", 13200, 70, 0.50), ("Кыргызстан", 300, 30, 0.60)]

def money(v):
    return ("%,d" % v).replace(",", " ") if False else "{:,.0f}".format(v).replace(",", " ")

def tbl(head, rows, widths, right=()):
    data = [[Paragraph(h, st["cellh"]) for h in head]]
    for r in rows:
        data.append([Paragraph(str(c), st["cellb"] if i == 0 else st["cell"]) for i, c in enumerate(r)])
    t = Table(data, colWidths=[w * mm for w in widths], repeatRows=1)
    s = [("BACKGROUND", (0, 0), (-1, 0), INK), ("VALIGN", (0, 0), (-1, -1), "TOP"),
         ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
         ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, MIST]),
         ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE), ("BOX", (0, 0), (-1, -1), 0.6, LINE)]
    for c in right:
        s.append(("ALIGN", (c, 0), (c, -1), "RIGHT"))
    t.setStyle(TableStyle(s))
    return t

doc = SimpleDocTemplate(OUT, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                        topMargin=18 * mm, bottomMargin=16 * mm,
                        title="TAM, SAM и SOM по четырём странам", author="Ответ · otvet.mobi")
S = []
S.append(Paragraph("Сколько здесь денег", st["h1"]))
S.append(Paragraph("Ёмкость рынка ИИ-ресепшена в Казахстане, Узбекистане, России и "
                   "Кыргызстане, посчитанная от числа частных клиник и нашей же цены. "
                   "1 сентября 2026.", st["sub"]))

S.append(Paragraph("Из чего считаем", st["h2"]))
S.append(Paragraph("Наша цена в Казахстане — 9 000 ₸ абонплаты плюс 150 ₸ за минуту. "
                   "Клиника с полусотней принятых звонков платит около 24 750 ₸ в месяц, "
                   "то есть примерно 50 долларов. От этой цифры и пляшем.", st["p"]))
S.append(tbl(["Допущение", "Значение", "Откуда"],
  [["Клиник в стране", "5 455 / 9 000 / 13 200 / 300",
    "Казахстан — 6 418 стоматологий, 85% частные<br/>(Минздрав через 24.kz, июнь 2026);<br/>остальные — предыдущий отчёт"],
   ["Наш счёт в месяц", "50 $ Казахстан, 35 $ Узбекистан,<br/>70 $ Россия, 30 $ Кыргызстан",
    "Казахстан — наш тариф; остальные — <b>допущение</b><br/>по покупательной способности"],
   ["Кого реально обслужим", "60% клиник, в России 50%",
    "<b>допущение</b>: часть клиник — лаборатории и<br/>кабинеты без записи по телефону, часть уже<br/>с колл-центром"],
   ["Наша доля", "2% от обслуживаемых",
    "<b>допущение</b>: реалистичный горизонт двух-трёх лет<br/>для небольшой команды"],
   ["Валовая маржа", "62%", "измерено на своих звонках: минута стоит 57 ₸"]],
  [34, 52, 62], right=()))
S.append(Spacer(1, 3 * mm))
S.append(Paragraph("Жирным помечено то, что мы предполагаем, а не измерили. Спорить "
                   "стоит именно с этими четырьмя строками — итог пересчитается сам.",
                   st["small"]))

S.append(PageBreak())
S.append(Paragraph("Ёмкость по странам", st["h2"]))
rows = []
tot_tam = tot_sam = tot_som = 0
som_rows = []
for name, n, arpu, share in DATA:
    tam = n * arpu * 12
    sam_n = round(n * share); sam = sam_n * arpu * 12
    som_n = round(sam_n * 0.02); som = som_n * arpu * 12
    tot_tam += tam; tot_sam += sam; tot_som += som
    som_rows.append((name, som_n, som))
    rows.append([name, "{} × {} $".format(n, arpu), "$ " + money(tam),
                 "{} клиник<br/>$ {}".format(sam_n, money(sam)),
                 "{} клиник<br/>$ {}".format(som_n, money(som))])
S.append(tbl(["Страна", "Клиник × счёт", "TAM, $ в год", "SAM, в год", "SOM 2%, в год"],
             rows, [28, 30, 32, 34, 34], right=(2,)))
S.append(Spacer(1, 3 * mm))
S.append(Paragraph("TAM — если бы подключились все. SAM — те, кого мы физически можем "
                   "обслужить. SOM — два процента от них, то есть то, на что можно "
                   "рассчитывать всерьёз.", st["small"]))

S.append(Spacer(1, 6 * mm))
S.append(Paragraph("Что такое эти два процента в клиниках и в тенге", st["h2"]))
srows = []
for name, som_n, som in som_rows:
    srows.append([name, "{} клиник".format(som_n),
                  money(som * KURS / 12) + " ₸ в месяц",
                  money(som * KURS) + " ₸ в год",
                  money(som * KURS * 0.62) + " ₸ в год"])
S.append(tbl(["Страна", "Клиентов", "Выручка в месяц", "Выручка в год", "Валовая прибыль"],
             srows, [28, 26, 36, 36, 36], right=(1, 2, 3, 4)))
S.append(Spacer(1, 3 * mm))
S.append(Paragraph("Итого по четырём странам: {} клиник, {} ₸ в месяц, {} ₸ выручки в год. "
                   "По курсу 500 ₸ за доллар.".format(
                       sum(r[1] for r in som_rows), money(tot_som * KURS / 12), money(tot_som * KURS)),
                   st["p"]))

S.append(PageBreak())
S.append(Paragraph("Как это читать", st["h2"]))
S.append(Paragraph("<b>Казахстан — 65 клиник.</b> Это то, ради чего сейчас идёт работа: "
                   "1,63 млн ₸ в месяц, 19,5 млн в год, из них около 12 млн валовой "
                   "прибыли. Один продавец, закрывающий пять-шесть клиник в месяц, "
                   "приходит к этому за год. Цифра не выглядит фантастикой — и в этом "
                   "её ценность.", st["p"]))
S.append(Paragraph("И это <b>только стоматологии</b>. Медцентры, диагностика и врачебные "
                   "кабинеты сюда не вошли — по Костанаю их оказалось вдвое больше, чем "
                   "стоматологий. То есть казахстанский TAM выше написанного, просто мы "
                   "пока не знаем насколько.", st["p"]))
S.append(Paragraph("<b>Узбекистан примерно вровень с Казахстаном</b> — 108 клиник против "
                   "65, но счёт ниже, поэтому в деньгах разрыв меньше: 1,89 млн ₸ против "
                   "1,63 млн в месяц. И это при том, что казахстанские 65 — только "
                   "стоматологии, а узбекские 108 — клиники вообще. Считать эти рынки "
                   "равными по размеру ближе к правде, чем ставить один выше другого.",
                   st["p"]))
S.append(Paragraph("<b>Россия одна даёт больше, чем три остальные страны вместе</b> — "
                   "4,6 млн ₸ в месяц. Но два процента российского рынка стоят дороже, "
                   "чем два процента казахстанского: там уже есть готовые сервисы, и "
                   "внимание клиники придётся покупать.", st["p"]))
S.append(Paragraph("<b>Кыргызстан — не рынок, а довесок.</b> Четыре клиники и 60 тысяч "
                   "тенге в месяц. Заходить туда имеет смысл только потому, что это "
                   "дёшево и рядом, а не ради денег.", st["p"]))

S.append(Paragraph("Где эта модель может врать", st["h2"]))
S.append(Paragraph("<b>Счёт в 50 долларов держится на 2,1 минуты среднего разговора.</b> "
                   "Если клиники окажутся разговорчивее, выручка вырастет, но вырастет "
                   "и себестоимость — маржа останется около 62%, а вот счёт клиники "
                   "может оказаться для неё слишком большим.", st["p"]))
S.append(Paragraph("<b>Два процента — это выбор, а не прогноз.</b> При хорошем сарафане "
                   "в небольшом городе доля бывает выше десяти процентов: Костанай — это "
                   "87 организаций, и десять из них дают 11%. При плохом старте не будет "
                   "и одного процента.", st["p"]))
S.append(Paragraph("<b>Числа клиник — нижние границы, и это уже проверено.</b> Первую "
                   "версию расчёта мы строили на коммерческом справочнике: он показывал "
                   "по Казахстану 2 173 стоматологии против настоящих 6 418. Ошибка была "
                   "почти втрое, и в одну сторону — вниз. Российские и кыргызские числа "
                   "собраны так же и, скорее всего, занижены не меньше.", st["p"]))
S.append(Paragraph("<b>Цены за пределами Казахстана — предположение.</b> Мы не продали "
                   "ни одной подписки в Узбекистане, России и Кыргызстане и не проверяли "
                   "там ни телефонию, ни готовность платить.", st["p"]))

def footer(c, d):
    c.saveState(); c.setFont("Body", 8); c.setFillColor(DIM)
    c.drawString(18 * mm, 10 * mm, "Ответ · otvet.mobi · расчёт от 1 сентября 2026")
    c.drawRightString(A4[0] - 18 * mm, 10 * mm, "%d" % d.page)
    c.restoreState()

doc.build(S, onFirstPage=footer, onLaterPages=footer)
print("готово:", OUT, os.path.getsize(OUT), "байт")
