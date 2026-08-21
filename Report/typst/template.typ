// Thesis-style template: cover page, roman-numbered front matter (Abstract,
// Contents, List of Figures), then arabic-numbered chapters with numbered
// headings, a running header/footer, and consistent figure/table styling.

#let ink = rgb("#000000")
#let accent = rgb("#000000")
#let muted = rgb("#000000")
#let rule-color = rgb("#000000")

// Flips true only while a #part(...) divider heading is being emitted, so the
// level-1 show rule below can render it as a centered, standalone divider
// page (like a LaTeX \part page) instead of a normal chapter heading.
#let is-part-divider = state("is-part-divider", false)

#let thesis(
  title: "",
  subtitle: "",
  meta: (),
  version: "",
  abstract: [],
  chapters: [],
  has_figures: true,
  intro: none,
) = {
  set document(title: title, author: "Compressor Simulator Project")
  set text(font: "Latin Modern Roman", size: 10.5pt, fill: ink, lang: "en")
  set par(justify: true, leading: 0.65em)
  set math.equation(numbering: "(1)")
  show math.equation: set text(font: "Latin Modern Math")

  show raw: set text(font: "Latin Modern Mono", size: 9.5pt)
  show link: set text(fill: accent)

  // ---- heading style -------------------------------------------------
  set heading(numbering: "1.1")
  show heading.where(level: 1): it => context {
    if is-part-divider.get() {
      pagebreak(weak: true)
      v(1fr)
      align(center)[
        #text(size: 24pt, weight: "bold", fill: ink, font: "Latin Modern Roman")[#it.body]
      ]
      v(1fr)
    } else {
      pagebreak(weak: true)
      v(4pt)
      set text(size: 20pt, weight: "bold", fill: ink, font: "Latin Modern Roman")
      block(it, above: 0pt, below: 18pt)
    }
  }
  show heading.where(level: 2): it => {
    set text(size: 13pt, weight: "bold", fill: accent, font: "Latin Modern Roman")
    block(it, above: 16pt, below: 8pt)
  }
  show heading.where(level: 3): it => {
    set text(size: 11pt, weight: "bold", fill: ink, font: "Latin Modern Roman")
    block(it, above: 10pt, below: 6pt)
  }

  // ---- figure / caption style -----------------------------------------
  show figure.caption: it => {
    set text(size: 8.5pt, style: "italic", fill: muted)
    align(center)[*#it.supplement #context it.counter.display(it.numbering).* #it.body]
  }
  set figure(gap: 10pt)

  // ---- cover page --------------------------------------------------
  set page(paper: "us-letter", margin: (x: 1in, top: 1in, bottom: 1in), numbering: none)
  v(2.2in)
  align(center)[
    #text(size: 30pt, weight: "bold", font: "Latin Modern Roman")[#title]
    #v(6pt)
    #text(size: 15pt, fill: muted, font: "Latin Modern Roman")[#subtitle]
    #v(0.5in)
    #for line in meta [
      #text(size: 10.5pt, fill: muted)[#line] \
    ]
    #v(1.2in)
    #if version != "" [
      #text(size: 10.5pt, fill: muted)[Version #version]
    ]
    #if intro != none [
      #v(1in)
      #block(width: 5.2in)[
        #set text(size: 9.5pt, fill: muted)
        #set par(justify: true)
        #intro
      ]
    ]
  ]
  pagebreak()

  // ---- front matter: roman numerals ---------------------------------
  set page(
    numbering: "i",
    header: none,
    footer: context [
      #set text(size: 8pt, fill: muted)
      #align(center)[#counter(page).display("i")]
    ],
  )
  counter(page).update(1)

  abstract

  heading(numbering: none, outlined: true)[Contents]
  outline(title: none, depth: 3)
  pagebreak()

  if has_figures {
    heading(numbering: none, outlined: true)[List of Figures]
    outline(title: none, target: figure.where(kind: image))
    pagebreak()
  }

  // ---- body: arabic numerals, running header -------------------------
  set page(
    numbering: "1",
    header: context [
      #set text(size: 8pt, fill: muted)
      #grid(
        columns: (1fr, 1fr),
        align(left)[#title],
        align(right)[#if version != "" [v#version]],
      )
      #v(-6pt)
      #line(length: 100%, stroke: 0.5pt + rule-color)
    ],
    footer: context [
      #line(length: 100%, stroke: 0.5pt + rule-color)
      #v(-6pt)
      #align(center)[#counter(page).display("1")]
    ],
  )
  counter(page).update(1)

  chapters
}

// ---- small content helpers reused across chapters --------------------

#let note(body, label: "NOTE", bg: rgb("#ffffff"), border: black) = {
  block(
    fill: bg,
    stroke: (left: 2pt + border),
    inset: 10pt,
    radius: 2pt,
    width: 100%,
  )[*#label.* #body]
}

#let warn(body) = note(body, label: "IMPORTANT", bg: rgb("#ffffff"), border: black)
#let todo(body) = note(body, label: "TODO", bg: rgb("#ffffff"), border: black)

#let kv-table(rows) = table(
  columns: (1.4in, 1fr),
  stroke: (bottom: 0.4pt + rule-color),
  inset: 6pt,
  ..rows.map(((k, v)) => (strong(k), v)).flatten()
)

#let data-table(header, rows) = table(
  columns: header.len(),
  stroke: none,
  inset: 6pt,
  table.header(..header.map(strong)),
  table.hline(stroke: 0.4pt + rule-color),
  ..rows.flatten()
)

#let fig(path, caption, width: 80%) = figure(
  image(path, width: width),
  caption: caption,
)

#let part(title) = {
  is-part-divider.update(true)
  heading(numbering: none, outlined: true)[#title]
  is-part-divider.update(false)
}
