"""Document template, page decorations, cover page and TOC wiring — the parts
of docs/generate_manual.py that aren't section content, factored out so
build_report.py can stay a thin list of sections.
"""
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    BaseDocTemplate, Frame, NextPageTemplate, PageBreak, PageTemplate, Paragraph, Spacer,
)
from reportlab.platypus.tableofcontents import TableOfContents

from common.styles import INK, MUTED, RULE, styles

PAGE_W, PAGE_H = LETTER
MARGIN = 0.85 * 72  # 0.85 inch in points, avoids importing `inch` twice


def cover_page(c: canvas.Canvas, doc):
    c.saveState()
    c.setFillColor(INK)
    c.rect(0, PAGE_H - 0.35 * 72, PAGE_W, 0.35 * 72, fill=1, stroke=0)
    c.restoreState()


def make_body_page(title, version):
    def body_page(c: canvas.Canvas, doc):
        c.saveState()
        c.setStrokeColor(RULE)
        c.setLineWidth(0.5)
        c.line(MARGIN, PAGE_H - 0.62 * 72, PAGE_W - MARGIN, PAGE_H - 0.62 * 72)
        c.setFont("Helvetica", 8)
        c.setFillColor(MUTED)
        c.drawString(MARGIN, PAGE_H - 0.55 * 72, title)
        c.drawRightString(PAGE_W - MARGIN, PAGE_H - 0.55 * 72, f"v{version}")
        c.line(MARGIN, 0.55 * 72, PAGE_W - MARGIN, 0.55 * 72)
        c.drawCentredString(PAGE_W / 2, 0.4 * 72, str(doc.page - 1))
        c.restoreState()
    return body_page


class ReportDocTemplate(BaseDocTemplate):
    """Feeds TableOfContents its (level, text, page) entries as each heading
    is laid out, via the notify() hook platypus calls for every flowable —
    the only way the TOC's second build pass learns real page numbers."""

    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph):
            style = flowable.style.name
            if style == "H1":
                self.notify("TOCEntry", (0, flowable.getPlainText(), self.page - 1))
            elif style == "H2":
                self.notify("TOCEntry", (1, flowable.getPlainText(), self.page - 1))


def build_doc(out_path, title, version, story):
    doc = ReportDocTemplate(
        str(out_path), pagesize=LETTER,
        leftMargin=MARGIN, rightMargin=MARGIN, topMargin=72, bottomMargin=0.8 * 72,
        title=title, author="Compressor Simulator Project",
    )
    cover_frame = Frame(0, 0, PAGE_W, PAGE_H, id="cover")
    body_frame = Frame(MARGIN, 0.8 * 72, PAGE_W - 2 * MARGIN, PAGE_H - 1.8 * 72, id="body")
    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[cover_frame], onPage=cover_page),
        PageTemplate(id="body", frames=[body_frame], onPage=make_body_page(title, version)),
    ])
    # multiBuild: TOC needs a first pass to discover page numbers, then a
    # second pass to render itself with those numbers filled in.
    doc.multiBuild(story)


def cover(title, subtitle, meta_lines):
    story = [
        Spacer(1, 2.0 * 72),
        Paragraph(title, styles["CoverTitle"]),
        Spacer(1, 0.15 * 72),
        Paragraph(subtitle, styles["CoverSub"]),
        Spacer(1, 0.5 * 72),
    ]
    for line in meta_lines:
        story.append(Paragraph(line, styles["CoverMeta"]))
    story.append(Spacer(1, 1.6 * 72))
    story.append(NextPageTemplate("body"))
    story.append(PageBreak())
    return story


def toc_page():
    story = [Paragraph("Contents", ParagraphStyle("TOCTitle", parent=styles["H1"]))]
    toc = TableOfContents()
    toc.levelStyles = [
        ParagraphStyle("TOCLevel0", parent=styles["TOCEntry"], fontName="Helvetica-Bold",
                       leftIndent=0, firstLineIndent=0),
        ParagraphStyle("TOCLevel1", parent=styles["TOCEntry"], fontSize=9.5, leading=16,
                       leftIndent=18, firstLineIndent=0, textColor=MUTED),
    ]
    story.append(toc)
    story.append(PageBreak())
    return story
