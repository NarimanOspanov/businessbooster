# -*- coding: utf-8 -*-
# Отчёт по городам: сколько медорганизаций и стоматологий, сколько на сто тысяч
# жителей и что из этого следует для «Ответа». Данные — справочник medelement,
# 1 сентября 2026; население — оценки 2024-2025 годов.
import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                                PageBreak, KeepTogether)

OUT = "C:/Users/nariman_ospanov/Downloads/bbooster/docs/rynok-klinik-kz-2026-09.pdf"

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

# город: (население тыс., всего медорганизаций, стоматологий)
# None — справочник такой страницы не отдаёт
CITIES = [
    ("Алматы",            2230, None, 693),
    ("Астана",            1500,  973, None),
    ("Шымкент",           1250,  563, None),
    ("Актобе",             560,  222, None),
    ("Караганда",          500,  200, None),
    ("Тараз",              400,  116,   22),
    ("Атырау",             380,  159, None),
    ("Павлодар",           340,  159, None),
    ("Уральск",            340, None,   77),
    ("Кызылорда",          260,  108,   33),
    ("Костанай",           250,  113,   41),
    ("Актау",              250,  141,   46),
    ("Петропавловск",      220,   72,   25),
]

styles = {
    "h1": ParagraphStyle("h1", fontName="Bold", fontSize=26, leading=30, textColor=INK, spaceAfter=4),
    "sub": ParagraphStyle("sub", fontName="Body", fontSize=11.5, leading=16, textColor=DIM, spaceAfter=18),
    "h2": ParagraphStyle("h2", fontName="Bold", fontSize=15, leading=19, textColor=INK,
                         spaceBefore=16, spaceAfter=7),
    "p": ParagraphStyle("p", fontName="Body", fontSize=10.5, leading=15.5, textColor=INK, spaceAfter=7),
    "small": ParagraphStyle("small", fontName="Body", fontSize=9, leading=13, textColor=DIM, spaceAfter=5),
    "cell": ParagraphStyle("cell", fontName="Body", fontSize=9.5, leading=12.5, textColor=INK),
    "cellb": ParagraphStyle("cellb", fontName="Semi", fontSize=9.5, leading=12.5, textColor=INK),
}

def per100k(count, pop):
    return None if count is None else round(count / (pop / 100.0), 1)

def bar_table(rows, value_key, title, unit, color):
    """Горизонтальные полосы прямо в таблице: без графической библиотеки,
    зато печатается одинаково везде."""
    vals = [r[value_key] for r in rows if r[value_key] is not None]
    top = max(vals) if vals else 1
    data = [[Paragraph("Город", styles["cellb"]), Paragraph(unit, styles["cellb"]), ""]]
    for r in rows:
        v = r[value_key]
        if v is None:
            data.append([Paragraph(r["city"], styles["cell"]),
                         Paragraph("нет данных", styles["small"]), ""])
            continue
        width = 88 * v / top
        bar = Table([[""]], colWidths=[width * mm], rowHeights=[4.2 * mm])
        bar.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), color),
                                 ("LINEBELOW", (0, 0), (-1, -1), 0, colors.white)]))
        data.append([Paragraph(r["city"], styles["cell"]),
                     Paragraph(("%g" % v).replace(".", ","), styles["cellb"]), bar])
    t = Table(data, colWidths=[38 * mm, 20 * mm, 92 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Semi"),
        ("FONTSIZE", (0, 0), (-1, 0), 9.5),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("LEFTPADDING", (2, 0), (2, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, MIST]),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE),
    ]))
    return KeepTogether([Paragraph(title, styles["h2"]), t])

rows = []
for city, pop, med, dent in CITIES:
    rows.append({"city": city, "pop": pop, "med": med, "dent": dent,
                 "med100": per100k(med, pop), "dent100": per100k(dent, pop)})

doc = SimpleDocTemplate(OUT, pagesize=A4,
                        leftMargin=18 * mm, rightMargin=18 * mm,
                        topMargin=18 * mm, bottomMargin=16 * mm,
                        title="Рынок клиник Казахстана по городам",
                        author="Ответ · otvet.mobi")
S = []

S.append(Paragraph("Рынок клиник Казахстана", styles["h1"]))
S.append(Paragraph("Сколько медицинских организаций и стоматологий в городах, "
                   "как густо они стоят на сто тысяч жителей и где из этого "
                   "получается рынок для ИИ-ресепшена. Собрано 1 сентября 2026.", styles["sub"]))

# --- сводная таблица ---
head = ["Город", "Население,<br/>тыс.", "Медорганизаций", "Стоматологий",
        "Медорг.<br/>на 100 тыс.", "Стомат.<br/>на 100 тыс."]
data = [[Paragraph(h, styles["cellb"]) for h in head]]
for r in rows:
    def f(v):
        return "—" if v is None else ("%g" % v).replace(".", ",")
    data.append([
        Paragraph(r["city"], styles["cellb"]),
        Paragraph(f(r["pop"]), styles["cell"]),
        Paragraph(f(r["med"]), styles["cell"]),
        Paragraph(f(r["dent"]), styles["cell"]),
        Paragraph(f(r["med100"]), styles["cell"]),
        Paragraph(f(r["dent100"]), styles["cell"]),
    ])
t = Table(data, colWidths=[36 * mm, 22 * mm, 28 * mm, 26 * mm, 26 * mm, 26 * mm], repeatRows=1)
t.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), INK),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
    ("TOPPADDING", (0, 0), (-1, -1), 5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, MIST]),
    ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE),
    ("BOX", (0, 0), (-1, -1), 0.6, LINE),
]))
S.append(t)
S.append(Spacer(1, 4 * mm))
S.append(Paragraph("Прочерк — справочник не отдаёт такую страницу по этому городу, "
                   "а не «ноль клиник».", styles["small"]))

S.append(PageBreak())

S.append(bar_table(sorted([r for r in rows], key=lambda r: -(r["med"] or 0)),
                   "med", "Медорганизаций в городе", "штук", TEAL))
S.append(Spacer(1, 6 * mm))
S.append(bar_table(sorted([r for r in rows], key=lambda r: -(r["med100"] or 0)),
                   "med100", "На сто тысяч жителей", "штук", TEAL_D))

S.append(PageBreak())
S.append(Paragraph("Что из этого следует", styles["h2"]))

S.append(Paragraph("<b>Небольшой город можно пройти целиком.</b> Астана и Шымкент — "
                   "самые крупные рынки в штуках, и по плотности Астана тоже первая "
                   "(64,9 на сто тысяч). Но дальше разрыв невелик: Актау 56,4, Павлодар "
                   "46,8, Костанай 45,2 — то есть клиник на душу в небольших городах "
                   "почти столько же. В маленьком городе "
                   "клиник меньше, но и обойти их все реально: Костанай — это 87 "
                   "частных организаций, неделя работы одного человека с телефоном. "
                   "Астану так не обойдёшь.", styles["p"]))

S.append(Paragraph("<b>Стоматологии — примерно треть рынка.</b> Там, где справочник "
                   "отдаёт обе цифры, стоматологии занимают от 19% (Тараз) до 36% "
                   "(Костанай) всех медорганизаций. Значит фокус только на стоматологиях "
                   "сужает рынок втрое, а разговор с медцентром идёт по тому же сценарию: "
                   "у них те же пропущенные звонки и те же неявки.", styles["p"]))

S.append(Paragraph("<b>Сколько это денег.</b> При абонплате 9 000 ₸ и 150 ₸ за минуту "
                   "средняя клиника с полусотней принятых звонков платит около "
                   "24 750 ₸ в месяц. Тогда один только Костанай — это 87 организаций × "
                   "24 750 ₸ ≈ 2,2 млн ₸ в месяц, если бы подключились все. Реально "
                   "рассчитывать на несколько процентов: десять клиник в городе — "
                   "это 250 тысяч в месяц с одного небольшого города.", styles["p"]))

S.append(Paragraph("<b>Где начинать.</b> Города-миллионники дают объём, но там дороже "
                   "внимание: клиника в Алматы получает десяток похожих предложений в "
                   "месяц. Города на 200–400 тысяч — Костанай, Петропавловск, Кызылорда, "
                   "Актау, Уральск — позволяют пройти рынок целиком, получить первые "
                   "отзывы и уже с ними идти в Алматы и Астану.", styles["p"]))

S.append(Paragraph("Чего эти цифры не говорят", styles["h2"]))
S.append(Paragraph("Это счётчик одного справочника, а не перепись. По Костанаю мы "
                   "проверили руками: medelement показывает 41 стоматологию, а 32top "
                   "в том же городе — 55. Разница около трети, и она в одну сторону: "
                   "справочники недосчитывают. Так что таблицу стоит читать как нижнюю "
                   "границу, а не как точное число.", styles["p"]))
S.append(Paragraph("Государственные больницы и поликлиники в счёт попадают, но нам они "
                   "не покупатели: своей записью они не распоряжаются. В Костанае из "
                   "113 организаций справочника после чистки осталось 87 частных — "
                   "примерно три четверти. Тот же коэффициент разумно держать в уме и "
                   "для остальных городов.", styles["p"]))
S.append(Paragraph("Население — оценки 2024–2025 годов, округлены до десятков тысяч. "
                   "Для плотности этого достаточно, для чего-то более точного — нет.",
                   styles["small"]))

def footer(canvas, doc_):
    canvas.saveState()
    canvas.setFont("Body", 8)
    canvas.setFillColor(DIM)
    canvas.drawString(18 * mm, 10 * mm, "Ответ · otvet.mobi · данные medelement, 1 сентября 2026")
    canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, "%d" % doc_.page)
    canvas.restoreState()

doc.build(S, onFirstPage=footer, onLaterPages=footer)
print("готово:", OUT, os.path.getsize(OUT), "байт")
