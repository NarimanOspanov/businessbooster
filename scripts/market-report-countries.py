# -*- coding: utf-8 -*-
# Четыре страны рядом: Казахстан, Узбекистан, Кыргызстан, Россия.
# Числа собраны из открытых источников и НЕ приведены к одной методике —
# каждая строка подписана своим источником, иначе сравнение врало бы.
import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                                PageBreak, KeepTogether)

OUT = "C:/Users/nariman_ospanov/Downloads/bbooster/docs/rynok-4-strany-2026-09.pdf"
FONTS = "C:/Windows/Fonts/"
pdfmetrics.registerFont(TTFont("Body", FONTS + "segoeui.ttf"))
pdfmetrics.registerFont(TTFont("Bold", FONTS + "segoeuib.ttf"))
pdfmetrics.registerFont(TTFont("Semi", FONTS + "seguisb.ttf"))

INK = colors.HexColor("#0c2b31")
TEAL = colors.HexColor("#0f9aa8")
TEAL_D = colors.HexColor("#0b6f7a")
MIST = colors.HexColor("#eef8f9")
LINE = colors.HexColor("#d9edef")
DIM = colors.HexColor("#4a6b72")

st = {
 "h1": ParagraphStyle("h1", fontName="Bold", fontSize=25, leading=29, textColor=INK, spaceAfter=4),
 "sub": ParagraphStyle("sub", fontName="Body", fontSize=11.5, leading=16, textColor=DIM, spaceAfter=16),
 "h2": ParagraphStyle("h2", fontName="Bold", fontSize=15, leading=19, textColor=INK,
                      spaceBefore=15, spaceAfter=7),
 "p": ParagraphStyle("p", fontName="Body", fontSize=10.5, leading=15.5, textColor=INK, spaceAfter=7),
 "small": ParagraphStyle("small", fontName="Body", fontSize=9, leading=13, textColor=DIM, spaceAfter=5),
 "cell": ParagraphStyle("cell", fontName="Body", fontSize=9.5, leading=12.5, textColor=INK),
 "cellb": ParagraphStyle("cellb", fontName="Semi", fontSize=9.5, leading=12.5, textColor=INK),
 "cellh": ParagraphStyle("cellh", fontName="Semi", fontSize=9.5, leading=12.5, textColor=colors.white),
}

def table(head, rows, widths, aligns=None):
    data = [[Paragraph(h, st["cellh"]) for h in head]]
    for r in rows:
        data.append([Paragraph(str(c), st["cellb"] if i == 0 else st["cell"]) for i, c in enumerate(r)])
    t = Table(data, colWidths=[w * mm for w in widths], repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, MIST]),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
    ]
    for col in (aligns or []):
        style.append(("ALIGN", (col, 0), (col, -1), "RIGHT"))
    t.setStyle(TableStyle(style))
    return t

def bars(rows, title, unit, color):
    top = max(v for _, v in rows)
    data = [[Paragraph("Страна", st["cellh"]), Paragraph(unit, st["cellh"]), ""]]
    for name, v in rows:
        bar = Table([[""]], colWidths=[(86 * v / top) * mm], rowHeights=[4.4 * mm])
        bar.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), color)]))
        data.append([Paragraph(name, st["cell"]),
                     Paragraph(("%g" % v).replace(".", ","), st["cellb"]), bar])
    t = Table(data, colWidths=[38 * mm, 22 * mm, 90 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("LEFTPADDING", (2, 0), (2, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, MIST]),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE),
    ]))
    return KeepTogether([Paragraph(title, st["h2"]), t])

doc = SimpleDocTemplate(OUT, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                        topMargin=18 * mm, bottomMargin=16 * mm,
                        title="Казахстан, Узбекистан, Кыргызстан, Россия: рынки клиник",
                        author="Ответ · otvet.mobi")
S = []
S.append(Paragraph("Четыре рынка рядом", st["h1"]))
S.append(Paragraph("Казахстан, Узбекистан, Кыргызстан и Россия: сколько частных клиник, "
                   "какая доля рынка у частной медицины и где ИИ-ресепшен имеет смысл "
                   "раньше. Собрано 1 сентября 2026 по открытым источникам.", st["sub"]))

S.append(Paragraph("Сколько частной медицины", st["h2"]))
S.append(table(
    ["Страна", "Население,<br/>млн", "Частных клиник", "На 100 тыс.<br/>жителей", "Источник числа"],
    [["Узбекистан", "37,5", "≈ 9 000", "24", "Госкомстат и Минздрав РУз, конец 2024"],
     ["Казахстан", "20,3", "≈ 5 500<br/>только стоматологий", "27", "24.kz со ссылкой на Минздрав, июнь 2026:<br/>6 418 стоматологий, 85% частные.<br/>Медцентры сверх этого не сосчитаны"],
     ["Россия", "146,0", "≈ 13 200", "9", "исследование РБК: сетевые клиники, 2024"],
     ["Кыргызстан", "7,2", "86 в Бишкеке", "8*", "Sputnik со ссылкой на Минздрав, 2019;<br/>единого реестра нет"]],
    [30, 22, 30, 26, 66], aligns=[1, 2, 3]))
S.append(Spacer(1, 3 * mm))
S.append(Paragraph("* по Кыргызстану — только Бишкек, на его собственное население. "
                   "Числа в этой таблице получены разными способами и не приведены "
                   "к одной методике: узбекское и казахстанское — государственный учёт, "
                   "российское — отраслевое исследование сетевых клиник, кыргызское — "
                   "новостная заметка семилетней давности. И считают они разное: по "
                   "Казахстану это только стоматологии, по остальным — клиники вообще. "
                   "Сравнивать можно по порядку величины, но не как точные измерения.",
                   st["small"]))

S.append(Spacer(1, 5 * mm))
S.append(bars([("Казахстан", 27), ("Узбекистан", 24), ("Россия", 9), ("Кыргызстан", 8)],
              "Частных клиник на сто тысяч жителей", "штук", TEAL))

S.append(PageBreak())
S.append(Paragraph("Что различает эти рынки", st["h2"]))

S.append(Paragraph("<b>Узбекистан растёт быстрее всех.</b> С 2017 года число частных "
                   "клиник и лабораторий выросло втрое — до девяти тысяч, и на частный "
                   "сектор приходится 30% всей системы здравоохранения. Отдельно важно "
                   "для нас: <b>91% стоматологических услуг в стране оказывают частники</b>. "
                   "Это ровно наша аудитория, и её там больше, чем в Казахстане, при "
                   "вдвое большем населении.", st["p"]))

S.append(Paragraph("<b>Казахстан оказался плотнее, чем мы думали.</b> Только "
                   "стоматологий в стране 6 418, и 85% из них частные — это 5 455 "
                   "клиник, наших прямых покупателей, не считая медцентров. По "
                   "стоматологиям на душу населения Казахстан обходит Узбекистан. "
                   "Плюс частная медицина держит 35% рынка медуслуг, страна двуязычная, "
                   "а телефония и номера у нас уже проверены живыми звонками.", st["p"]))

S.append(Paragraph("<b>Россия крупнее всех в деньгах и теснее всех в конкуренции.</b> "
                   "Одни только двадцать крупнейших сетей — это 666 клиник и 16,8 млн "
                   "визитов в год. Там уже работают десятки голосовых сервисов, интеграции "
                   "с медицинскими системами и колл-центры на аутсорсе. Заходить туда "
                   "с одним номером и без имени дорого.", st["p"]))

S.append(Paragraph("<b>Кыргызстан маленький и непрозрачный.</b> Единого реестра частных "
                   "клиник нет — это признали и Минюст, и Минздрав. Восемьдесят шесть "
                   "клиник в Бишкеке означают, что весь рынок страны сопоставим с одним "
                   "средним казахстанским областным центром.", st["p"]))

S.append(Paragraph("Что это значит для нас", st["h2"]))
S.append(Paragraph("<b>Первый по привлекательности — Узбекистан, но не первый по порядку.</b> "
                   "Клиник там больше, стоматология почти вся частная, конкурентов среди "
                   "голосовых сервисов меньше, чем в России. Мешают три вещи: язык — "
                   "нужен узбекский, а не только русский; телефония — местные номера и SIP "
                   "мы не проверяли; и оплата — тарифы придётся считать в сумах и с местным "
                   "средним чеком.", st["p"]))
S.append(Paragraph("<b>Порядок, который выглядит разумным:</b> доделать Казахстан до "
                   "десятка платящих клиник и отзывов, следом Узбекистан как ближайший "
                   "по устройству и самый ёмкий, Кыргызстан — попутно, он маленький и "
                   "стоит недорого. Россия — только с готовым продуктом и историями "
                   "клиентов, иначе это трата денег на внимание.", st["p"]))

S.append(Paragraph("Чего мы не знаем", st["h2"]))
S.append(Paragraph("<b>Числа по России и Кыргызстану почти наверняка занижены так же, "
                   "как были занижены наши казахстанские.</b> Первую версию этого отчёта "
                   "мы строили на счётчике коммерческого справочника, и по Казахстану он "
                   "показывал 3 800 клиник против настоящих 6 418 одних только "
                   "стоматологий. Российские 13 200 — это сетевые клиники из отраслевого "
                   "исследования, то есть заведомо часть рынка; кыргызские 86 — данные "
                   "2019 года по одному городу.", st["p"]))
S.append(Paragraph("Ни в одной из четырёх стран нет открытого реестра частных клиник с "
                   "телефонами — то, что мы делали по Костанаю руками, придётся повторять "
                   "в каждом городе. По Узбекистану и Кыргызстану у нас нет ни одного "
                   "проверенного звонком номера, а значит нет и подтверждения, что вечером "
                   "там не берут трубку так же, как в Казахстане. Это первое, что стоит "
                   "проверить, прежде чем считать эти рынки своими.", st["p"]))
S.append(Paragraph("Население — оценки 2025 года. Данные по Кыргызстану устарели на семь "
                   "лет и приведены только чтобы показать масштаб.", st["small"]))

def footer(c, d):
    c.saveState(); c.setFont("Body", 8); c.setFillColor(DIM)
    c.drawString(18 * mm, 10 * mm, "Ответ · otvet.mobi · открытые источники, 1 сентября 2026")
    c.drawRightString(A4[0] - 18 * mm, 10 * mm, "%d" % d.page)
    c.restoreState()

doc.build(S, onFirstPage=footer, onLaterPages=footer)
print("готово:", OUT, os.path.getsize(OUT), "байт")
