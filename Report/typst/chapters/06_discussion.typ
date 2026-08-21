#import "../template.typ": *

= Discussion

The installation walkthrough (@installation) and OPC UA connection walkthrough
(@opc-connection) together establish that a new user can go from a distributed zip
file to a PLC-driven simulation with no steps left to guesswork: every dialog,
warning, and console message a first-time user actually encounters is documented
and screenshotted, including the unsigned-installer SmartScreen detour, which is
easy to mistake for a broken build if it isn't explained in advance.

The verification test in @verify-link is the report's strongest evidence, not
just its most detailed figure pair. Forcing `CMD_4005` directly in the CODESYS GVL
and watching it propagate to the simulator's read-only HMI indicator, with no
interaction with the simulator itself, rules out the two most common false
positives when troubleshooting an OPC UA integration: a link that *looks* connected
in the UI but isn't actually carrying live data, and a link that only carries data
in one direction. Because this test also showed the engine remaining STOPPED
immediately after the force — correctly, since `CMD_4005` alone doesn't satisfy the
rest of the start sequence — it additionally reinforces the report's central
architectural claim from @intro-background: the simulator has no sequencing logic
of its own, so a single command tag moving does not, by itself, start anything.

The feature survey in @features is comprehensive for the Faults and Tags tabs,
where every subsection was covered from a real screenshot, but several figures
(fig21–fig27) are cropped panel views rather than full application screenshots.
This keeps each figure legible at report scale, but means the report does not show
where each panel sits within the overall window layout the way @opc-connection's
full-window figures do — a reader relying solely on this report would need the live
app open alongside it to place a given fault control in context on first use.
