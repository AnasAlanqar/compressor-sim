"""Builds Report/output/CompressorSim-Report.pdf from sections/*.

Run:  ..\\.venv\\Scripts\\python.exe build_report.py     (from the Report/ folder)
  or: .venv\\Scripts\\python.exe Report\\build_report.py  (from the repo root)

Same pure-Python reportlab approach as docs/generate_manual.py — no
Quarto/LaTeX/Pandoc toolchain to install. Add a new section by dropping a
sNN_name.py module in sections/ (exposing a build() -> list[Flowable]) and
listing it in SECTIONS below.
"""
import sys
from pathlib import Path

REPORT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(REPORT_DIR))

from common.layout import build_doc, cover, toc_page
from common.styles import reset_figure_counter

from sections import s01_introduction, s02_installation, s03_opc_connection, s04_features

VERSION = "0.6.3-pilot"
TITLE = "Compressor Simulator — Technical Report"
OUT = REPORT_DIR / "output" / "CompressorSim-Report.pdf"

SECTIONS = [
    s01_introduction,
    s02_installation,
    s03_opc_connection,
    s04_features,
]


def main():
    reset_figure_counter()
    story = []
    story += cover(
        "Compressor Simulator",
        "Technical Report",
        [
            "Ariel JGH/4 &middot; CAT G3516LE &middot; Spartan REMVue 500S",
            "Enerflex Unit 070438 &nbsp;—&nbsp; Project PN17481",
            f"Version {VERSION}",
        ],
    )
    story += toc_page()
    for module in SECTIONS:
        story += module.build()

    OUT.parent.mkdir(parents=True, exist_ok=True)
    build_doc(OUT, TITLE, VERSION, story)
    print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
