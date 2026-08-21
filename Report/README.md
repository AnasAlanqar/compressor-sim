# Compressor Simulator — Technical Report

- **`typst/handover/`** — **the current client deliverable.** The three-part
  Handover Report (Part I — Design Basis: Purpose, Process, Equations,
  Constants, Limitations, Verification; Part II — Using the Simulator:
  Installation, OPC UA Connection, Operator Interface, Running the Simulator,
  Fault Injection, Troubleshooting; Part III — Appendices: Signal/Tag List,
  Future Improvements, Verification Detail), built with
  [Typst](https://typst.app/), sharing `images/` with the other builds below.
  Builds straight to `Compressor_Simulator_Handover_Report.pdf` in this
  folder via `build_handover.ps1`. Markdown source of truth:
  `docs/Compressor_Simulator_Handover_Report.md` — keep both in sync by hand
  if content changes.
- **`typst/`** (the thesis chapters directly under `typst/`) and
  **`typst/physics/`** — superseded by `typst/handover/`, which merges and
  supersedes both (installation/OPC/features content from the former, the
  physics content from the latter). Left in place as source material/history,
  not actively maintained.
- **`sections/` + `build_report.py`** — the earliest flat technical report,
  built with Python/reportlab. Kept as-is, not maintained.

## Build the handover report (Typst)

```powershell
powershell -File build_handover.ps1
```

or directly:

```powershell
cd typst\handover
typst compile --root ..\.. main.typ ..\..\Compressor_Simulator_Handover_Report.pdf
```

Output: `Compressor_Simulator_Handover_Report.pdf` in this folder — regenerate any time
`typst/handover/chapters/*.typ` changes. `docs/Compressor_Simulator_Handover_Report.md` is the
Markdown source of truth this was typeset from.

## Build the thesis report (Typst)

Typst is a single lightweight binary (already installed on this machine via
winget — no LaTeX/TinyTeX/Pandoc toolchain needed) that produces genuinely
thesis-quality typesetting: numbered headings, a real table of contents and
list of figures, auto-numbered figures, and working cross-references
(`@label` → "Section 4.6" etc.) — all resolved natively, not hand-typed.

```powershell
powershell -File build_thesis.ps1
```

or directly:

```powershell
cd typst
typst compile --root .. main.typ ..\output\CompressorSim-Thesis.pdf
```

Output: `output/CompressorSim-Thesis.pdf` (gitignored, a build artifact —
regenerate any time chapter content or images change).

### Structure

```
Report/
  build_thesis.ps1
  typst/
    main.typ               entry point — assembles abstract + chapters via thesis()
    template.typ            cover page, roman-numeral front matter, TOC, List of
                             Figures, heading/figure styling, kv-table()/data-table()/
                             note()/warn()/todo()/fig() helpers
    chapters/
      00_abstract.typ
      01_introduction.typ    Background, Objectives, Scope
      02_system_overview.typ Reference Machine, Architecture
      03_installation.typ    uses images/installation/*.png
      04_opc_connection.typ  uses images/opc/*.png
      05_features.typ        uses images/features/*.png
      06_discussion.typ
      07_conclusion.typ       Future Improvements
      08_appendix.typ         Appendix A — tag reference table
  images/
    installation/  opc/  features/     shared by both builds
  output/           build artifact, gitignored
```

### Adding a chapter

1. Create `typst/chapters/NN_name.typ`, starting with
   `#import "../template.typ": *`, then a `= Chapter Title <label>` heading
   (the `<label>` lets other chapters cross-reference it with `@label`).
2. Use the template helpers: `#fig(path, caption)` (auto-numbered, path is
   root-relative starting with `/images/...` since Typst resolves relative
   paths against the *calling file*, not the project root), `#kv-table(...)`,
   `#data-table(header, rows)`, `#note[...]`, `#warn[...]`, `#todo[...]`.
3. Add `#include "chapters/NN_name.typ"` to the `chapters:` list in `main.typ`.

**Gotcha:** `//` inside plain text (e.g. a URL like `opc.tcp://host:4840`) is
parsed as a Typst line comment and silently eats the rest of the line —
always wrap such text in backticks (`` `opc.tcp://host:4840` ``) so it's raw
text instead.

## Rules for content

- Don't invent technical values, tag names, or UI copy — pull them from the
  running app, `docs/APP_SPEC.md`, `docs/DESKTOP_APP.md`, or a screenshot.
  If something's missing, use `#todo[...]` rather than guessing.
- Every figure gets a caption and is referenced from the surrounding text.
- Keep terminology consistent with the app itself (tag names like `PT_1001`,
  section names like "Overrides"/"Faults"/"Tags" as they appear in the UI).

## Build the physics reference (Typst)

```powershell
powershell -File build_physics.ps1
```

or directly:

```powershell
cd typst\physics
typst compile --root ..\.. main.typ ..\..\..\docs\Compressor_Simulator_Physics_Reference.pdf
```

Output: `docs/Compressor_Simulator_Physics_Reference.pdf` — regenerate any
time `typst/physics/chapters/*.typ` changes. `docs/Compressor_Simulator_Physics_Reference.md`
is the Markdown source of truth this was typeset from; keep both in sync by
hand if content changes.

## Build the flat report (reportlab, legacy)

```powershell
..\.venv\Scripts\python.exe build_report.py
```

See `sections/*.py` and `common/` for that pipeline's structure — same rules
as above, just Python function calls instead of Typst markup.
