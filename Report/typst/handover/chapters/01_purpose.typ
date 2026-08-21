#import "../../template.typ": *

= Purpose and Scope <sec-purpose>

#note(label: "WHAT THIS IS")[
  This application simulates a *generic three-stage reciprocating gas compressor package* — a
  positive-displacement machine, not a centrifugal, screw, or other rotodynamic compressor, and
  not a performance-sizing tool. @sec-background and @sec-quickstart establish, in a page or two,
  everything a first-time reader needs to know about that machine before going further.
]

This simulator exists to exercise and validate PLC control and sequencing logic against
realistic process behaviour, to support operator and engineer familiarisation, and to allow
fault conditions — loss of lube oil, cooler trips, blocked discharge, sensor failures — to be
injected repeatably and safely, without risk to personnel or equipment. Sequences that would
otherwise require real thermal and pressure time constants to play out (minutes to tens of
minutes) can be exercised in the same real time, because the model runs no faster or slower than
the physical process it represents.

This is not a performance-prediction tool, a rod-load or mechanical design tool, or a pulsation
study, and it is not validated against real machine performance data — none was supplied during
development, so it should not be used to guarantee machine performance.

The simulator represents a generic three-stage reciprocating compressor package built to a
plausible design point rather than measured from a specific real machine. Several parameters —
most importantly the clearance fraction (@sec-equations, eq. 4) — were back-solved to hit that
design point in the absence of real performance data. This is the basis for the "generic, not
validated" framing used throughout the rest of this document.

The application contains no control logic of its own: no timers, permissives, state machines,
PID loops, or alarm evaluation. It produces a plausible simulated process response representative
of the skid behavior required for PLC logic testing — the pressures, temperatures, flows, and
speeds that follow from the commands it receives; deciding what those values mean is the job of
the PLC under test. This application, unlike its predecessor, does not bundle a reference PLC sequencer —
@sec-running explains what that means in practice for operating it.

== How to Use This Report

This document serves two different readers, and neither needs to read it cover to cover before
starting work. Pick the path below that matches the job at hand; each links back to the other
where the detail actually lives.

#data-table(
  ([If you are writing the PLC program], [If you are validating the simulator's process model]),
  (
    ([
      + @sec-purpose --- Purpose and Scope
      + @sec-background --- Reader Background / Common Ground
      + @sec-quickstart --- PLC Engineer Quick Start
      + @sec-process --- Process Description
      + @opc-connection --- OPC UA / CODESYS Connection
      + @sec-roadmap --- PLC Development Roadmap
      + @sec-plc-interface --- PLC/Simulator Interface
      + Appendix A --- Signal / Tag List
      + @sec-running --- Operating Walkthrough
      + @sec-faults --- Fault Injection
      + @sec-commissioning --- PLC Validation / Commissioning Tests
      + @troubleshooting --- Troubleshooting
      + (refer to @sec-equations only when detailed process behaviour needs explaining)
    ],
    [
      + @sec-purpose --- Purpose and Scope
      + @sec-process --- Process Description
      + @sec-equations --- Governing Equations
      + @sec-constants --- Constants and Design Point
      + @sec-limitations --- Assumptions and Limitations
      + @sec-verification --- Verification Summary
      + Appendix C --- Verification Detail
    ]),
  )
)

Either way, @sec-equations through @sec-verification (Part I) remain the design-basis reference —
detailed, and deliberately not a prerequisite for starting PLC development.
