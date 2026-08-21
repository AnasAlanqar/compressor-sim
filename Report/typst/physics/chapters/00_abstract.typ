#import "../../template.typ": *

#heading(numbering: none, outlined: true)[Abstract]

This document reports the physics implemented in Compressor Simulator's process model —
governing equations, parameter values, and their justification — for an audience of process
and mechanical engineers evaluating the tool. It supersedes, for this application, the earlier
_Reciprocating Gas Compressor Hardware-in-the-Loop Simulator_ report (August 6, 2026), which
described a Simulink plant model driven by a CODESYS sequencer. This application is a
separate, from-scratch Python implementation of the same physical model, built to the same
design point; a companion document, `DISCREPANCIES.md`, lists every place the two
implementations' parameter values differ.

The simulator represents a generic three-stage reciprocating compressor package, parameterised
to the class of an Ariel JGH/4 compressor driven by a CAT G3516LE gas engine, but not validated
against real performance data from those specific machines. It contains no control logic of
its own — sequencing, permissives, and alarm evaluation are entirely the responsibility of the
PLC under test. This report states plainly what the model does and does not represent, so it
is not misapplied outside the purpose it was built for: exercising and validating PLC control
logic.
