#import "../template.typ": *

#heading(numbering: none, outlined: true)[Abstract]

Compressor Simulator is a desktop application that models the process response of a
three-stage reciprocating gas compressor package and exposes that model over OPC UA,
so a real programmable logic controller (PLC) — CODESYS running on a laptop, or a
physical control panel — can be connected and its control logic exercised against
realistic process behaviour without touching real machinery. The application
deliberately contains no control logic of its own: it produces the pressures,
temperatures, flows and speeds a real skid would produce, and leaves sequencing,
permissives and alarm evaluation entirely to the PLC under test.

This report documents the reference machine and software architecture the simulator
is built against, walks through installing the packaged desktop build, demonstrates
connecting it to a CODESYS PLC over OPC UA — including a live, bidirectional
verification test — and surveys the simulator's operating features: manual overrides,
fault injection, and live trending. It closes with a discussion of what the
included walkthroughs demonstrate and a set of concrete improvements identified for
future revisions.
