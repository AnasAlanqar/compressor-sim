#import "../../template.typ": *

#heading(numbering: none, outlined: true)[Abstract]

This report covers Compressor Simulator: a design basis for the process model it implements
(Part I), and an operating manual for the packaged desktop application (Part II), followed by
reference appendices (Part III).

This application is a from-scratch reimplementation of an earlier Simulink/CODESYS
hardware-in-the-loop model, built to the same design point and now packaged as a standalone
desktop application. Notable differences between the two are called out where relevant.

The simulator represents a generic three-stage reciprocating compressor package built to a
plausible design point, but not validated against real machine performance data. It contains no
control logic of its own — sequencing, permissives, and alarm evaluation are entirely the
responsibility of the PLC under test, connected over OPC UA. Part II documents installing the
application, making that connection, operating the interface, running a session end to end, and
injecting faults to exercise a PLC's fault handling.
