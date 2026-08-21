#import "../template.typ": thesis

#thesis(
  title: "Compressor Simulator",
  subtitle: "Technical Report",
  version: "",
  meta: (
    "Prepared by: Anas Alanqar",
    "Prepared for: Maikana Automation",
    "August 20, 2026",
  ),
  intro: [
    This report opens with a Quick Start for automation/PLC engineers new to this simulator, then
    has three parts: Part I is the design basis for the process model (purpose, equations,
    constants, limitations, verification); Part II is the operating manual for the packaged
    desktop application and the PLC-facing interface (installation, PLC connection, development
    roadmap, tag interface, operator interface, running a session, fault injection, commissioning
    and acceptance testing, troubleshooting); Part III is reference appendices (signal/tag list,
    future improvements, verification detail).
  ],
  abstract: include "chapters/00_abstract.typ",
  chapters: [
    #include "chapters/01_purpose.typ"
    #include "chapters/01a_reader_background.typ"
    #include "chapters/01b_plc_quickstart.typ"
    #include "chapters/02_process.typ"
    #include "chapters/03_equations.typ"
    #include "chapters/04_constants.typ"
    #include "chapters/05_limitations.typ"
    #include "chapters/06_verification.typ"
    #include "chapters/07_installation.typ"
    #include "chapters/08_opc_connection.typ"
    #include "chapters/08a_plc_roadmap.typ"
    #include "chapters/08b_plc_interface.typ"
    #include "chapters/09_operator_interface.typ"
    #include "chapters/10_running.typ"
    #include "chapters/11_faults.typ"
    #include "chapters/11a_commissioning.typ"
    #include "chapters/12_troubleshooting.typ"
    #include "chapters/13_appendix_tags.typ"
    #include "chapters/14_appendix_future.typ"
    #include "chapters/15_appendix_verification.typ"
  ],
)
