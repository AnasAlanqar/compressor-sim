#import "../template.typ": thesis

#thesis(
  title: "Compressor Simulator",
  subtitle: "Physics and Process Reference",
  version: "0.6.3-pilot",
  has_figures: false,
  meta: (
    "Ariel JGH/4 · CAT G3516LE · Spartan REMVue 500S",
    "Prepared for Maikana Automation",
  ),
  abstract: include "chapters/00_abstract.typ",
  chapters: [
    #include "chapters/01_purpose.typ"
    #include "chapters/02_process.typ"
    #include "chapters/03_equations.typ"
    #include "chapters/04_constants.typ"
    #include "chapters/05_limitations.typ"
    #include "chapters/06_verification.typ"
    #include "chapters/07_future.typ"
    #include "chapters/08_signals.typ"
  ],
)
