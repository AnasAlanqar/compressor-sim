"""Shared reportlab styles and small helpers used by every section module.

Adapted from docs/generate_manual.py's style set so the report and the user
manual share one visual language. Kept separate from that file because this
report has its own document (multi-section engineering report vs. a single
user-facing manual) and will grow its own helpers (figures with numbered
captions, data tables) that the manual doesn't need.
"""
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Image, KeepTogether, ListFlowable, ListItem, Paragraph, Spacer, Table, TableStyle,
)

INK = colors.HexColor("#1a1d21")
ACCENT = colors.HexColor("#0e7a5f")
MUTED = colors.HexColor("#6b7280")
RULE = colors.HexColor("#d8dbe0")
NOTE_BG = colors.HexColor("#eef6f3")
NOTE_BORDER = ACCENT
WARN_BG = colors.HexColor("#fdf3e0")
WARN_BORDER = colors.HexColor("#b8860b")
CODE_BG = colors.HexColor("#f2f3f5")

styles = getSampleStyleSheet()

styles.add(ParagraphStyle(
    "Body", parent=styles["Normal"], fontName="Helvetica", fontSize=10,
    leading=14.5, spaceAfter=8, textColor=INK,
))
styles.add(ParagraphStyle(
    "H1", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=17,
    leading=21, spaceBefore=6, spaceAfter=10, textColor=INK, outlineLevel=0,
))
styles.add(ParagraphStyle(
    "H2", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=12.5,
    leading=16, spaceBefore=14, spaceAfter=6, textColor=ACCENT, outlineLevel=1,
))
styles.add(ParagraphStyle(
    "H3", parent=styles["Heading3"], fontName="Helvetica-Bold", fontSize=10.5,
    leading=14, spaceBefore=8, spaceAfter=4, textColor=INK,
))
styles.add(ParagraphStyle(
    "Mono", parent=styles["Normal"], fontName="Courier", fontSize=9,
    leading=13, textColor=INK, backColor=CODE_BG, borderPadding=6,
    leftIndent=2, spaceAfter=8,
))
styles.add(ParagraphStyle(
    "Caption", parent=styles["Normal"], fontName="Helvetica-Oblique", fontSize=8.5,
    leading=11, textColor=MUTED, alignment=TA_CENTER, spaceBefore=4, spaceAfter=14,
))
styles.add(ParagraphStyle(
    "TOCEntry", parent=styles["Normal"], fontName="Helvetica", fontSize=10.5,
    leading=20, textColor=INK,
))
styles.add(ParagraphStyle(
    "CoverTitle", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=30,
    leading=36, alignment=TA_CENTER, textColor=INK,
))
styles.add(ParagraphStyle(
    "CoverSub", parent=styles["Normal"], fontName="Helvetica", fontSize=14,
    leading=20, alignment=TA_CENTER, textColor=MUTED,
))
styles.add(ParagraphStyle(
    "CoverMeta", parent=styles["Normal"], fontName="Helvetica", fontSize=10,
    leading=16, alignment=TA_CENTER, textColor=MUTED,
))

_figure_counter = {"n": 0}


def reset_figure_counter():
    _figure_counter["n"] = 0


def note_table(text, bg=NOTE_BG, border=NOTE_BORDER, label="NOTE"):
    p = Paragraph(f"<b>{label}.</b> {text}", styles["Body"])
    t = Table([[p]], colWidths=[6.3 * inch])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("BOX", (0, 0), (-1, -1), 0.75, border),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


def warn(text):
    return note_table(text, bg=WARN_BG, border=WARN_BORDER, label="IMPORTANT")


def todo(text):
    """Flags content not yet supplied, instead of inventing it."""
    return note_table(text, bg=colors.HexColor("#fdeaea"), border=colors.HexColor("#c0392b"), label="TODO")


def bullets(items, bullet="•"):
    return ListFlowable(
        [ListItem(Paragraph(i, styles["Body"]), leftIndent=6) for i in items],
        bulletType="bullet", bulletFontName="Helvetica", bulletFontSize=8,
        start=bullet, leftIndent=16, spaceBefore=2, spaceAfter=8,
    )


def numbered(items):
    return ListFlowable(
        [ListItem(Paragraph(i, styles["Body"]), leftIndent=6) for i in items],
        bulletType="1", leftIndent=18, spaceBefore=2, spaceAfter=8,
    )


def kv_table(rows, col_widths=(1.6 * inch, 4.7 * inch)):
    data = [[Paragraph(f"<b>{k}</b>", styles["Body"]), Paragraph(v, styles["Body"])] for k, v in rows]
    t = Table(data, colWidths=list(col_widths))
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, RULE),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t


def data_table(header, rows, col_widths=None):
    """A table with units-bearing headers, for simulation/test data."""
    data = [[Paragraph(f"<b>{h}</b>", styles["Body"]) for h in header]]
    data += [[Paragraph(str(c), styles["Body"]) for c in row] for row in rows]
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (0, -1), 0.4, RULE),
        ("LINEBELOW", (0, 0), (-1, 0), 1, INK),
        ("LINEBELOW", (0, -1), (-1, -1), 0.4, RULE),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t


def figure(image_path, caption, width=5.6 * inch):
    """A numbered figure: image + auto-numbered caption below it, kept together
    on one page. Numbering is global across the whole report (resets only via
    reset_figure_counter(), which build_report.py does not call between
    sections, so figures number continuously front-to-back)."""
    _figure_counter["n"] += 1
    n = _figure_counter["n"]
    img = Image(str(image_path))
    img._restrictSize(width, 9 * inch)
    cap = Paragraph(f"<b>Figure {n}.</b> {caption}", styles["Caption"])
    return KeepTogether([img, cap])


def spacer(h=8):
    return Spacer(1, h)
