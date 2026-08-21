#import "../../template.typ": *

= Purpose and Scope

This simulator exists to exercise and validate PLC control and sequencing logic against
realistic process behaviour, to support operator and engineer familiarisation, and to allow
fault conditions — loss of lube oil, cooler trips, blocked discharge, sensor failures — to be
injected repeatably and safely, without risk to personnel or equipment. Sequences that would
otherwise require real thermal and pressure time constants to play out (minutes to tens of
minutes) can be exercised in the same real time, because the model runs no faster or slower
than the physical process it represents.

*What this is not.* It is not a performance prediction tool, not a rod-load or mechanical
design tool, and not a pulsation study. It is not validated against real performance data from
an Ariel JGH/4 or a CAT G3516LE — no such data was supplied during development. It must not be
used to guarantee machine performance.

*Nominal basis.* The simulator represents a generic three-stage reciprocating compressor
package, parameterised to represent an Ariel JGH/4-class machine driven by a CAT G3516LE-class
gas engine. "Class" is doing real work in that sentence: several parameters (most importantly
the clearance fraction — @sec-equations) were back-solved to hit a plausible design point in
the absence of real machine data, not measured from the actual machines. This scoping
statement exists to prevent the model from being applied outside the purpose it was built for:
exercising and validating PLC logic.

The application itself contains *no control logic* — no timers, no permissives, no state
machines, no PID loops, no alarm evaluation. It produces the pressures, temperatures, flows,
and speeds a real skid would produce in response to commands; deciding what those values mean
is entirely the job of the PLC under test. Unlike its Simulink predecessor, this application
does not bundle a reference PLC sequencer of its own — see @sec-verification for what that
means for how this simulator is used.
