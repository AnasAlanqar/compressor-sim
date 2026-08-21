#import "template.typ": thesis

#thesis(
  title: "Compressor Simulator",
  subtitle: "Technical Report",
  version: "0.6.3-pilot",
  meta: (
    "Ariel JGH/4 · CAT G3516LE · Spartan REMVue 500S",
    "Enerflex Unit 070438 — Project PN17481",
  ),
  abstract: include "chapters/00_abstract.typ",
  chapters: [
    #include "chapters/01_introduction.typ"
    #include "chapters/02_system_overview.typ"
    #include "chapters/03_installation.typ"
    #include "chapters/04_opc_connection.typ"
    #include "chapters/05_features.typ"
    #include "chapters/06_discussion.typ"
    #include "chapters/07_conclusion.typ"
    #include "chapters/08_appendix.typ"
  ],
)
