# Open questions — Physics Reference handover

Values, assumptions, or behaviours I could not determine from `backend/app/physics.py`,
`backend/config.yaml`, `docs/APP_SPEC.md`, the test suite, or `1st_draft_report.pdf`. Please
fill these in (or tell me the answer and I'll fold it into the report) before this goes to the
client.

1. ~~**What is $K_{cap}$ for?**~~ **Resolved.** No documented purpose was ever found, so it has
   been removed from `backend/app/physics.py` and `backend/config.yaml` (it was numerically
   inert at 1.0, so this changes no model behaviour; `pytest tests/` still shows 86 passed).
   See Discrepancy #9.

2. **Gas composition / real-gas properties.** Both this app and the predecessor Simulink model
   use $R_{sp}=345.5$ J/(kg·K) and $n=1.2693$ as assumed constants, with no supplied gas
   analysis behind them (the predecessor report says as much explicitly). Is there a target gas
   composition for this package (e.g. from a process design basis) that these should eventually
   be checked against, or are they intentionally generic placeholders indefinitely?

3. **Standalone sequencer demonstration.** This application deliberately ships no PLC
   sequencer — a real design decision, correctly documented in `APP_SPEC.md`, and I've reported
   it as intentional (Discrepancy #10) rather than a gap. But the predecessor Simulink/CODESYS
   rig *did* bundle one, purely to demonstrate startup/shutdown sequencing without a separate
   PLC connected. Does Maikana's client need that same standalone-demonstration capability from
   this application, or is "connect a real PLC to see sequencing" the accepted expectation going
   forward? I did not want to guess at a requirement change of this size.

4. **Choked-flow and vent-rate accuracy — is a number needed?** The physics reference states
   that no choked-flow model exists and that blowdown/USD vent rates are therefore
   "approximate," per your instructions and the predecessor report's own framing. Neither
   document quantifies *how much* faster the model vents versus a real choked vent. If you have
   (or want) an order-of-magnitude estimate for the client-facing document, I did not attempt to
   derive one — it would require assuming a specific gas composition and orifice geometry
   neither document supplies.

5. **Confirm the compressibility-factor error estimate is acceptable to keep.** The physics
   reference repeats the predecessor report's estimate that $Z\approx0.85$–0.90 at 1150 psig /
   245 °F, making density optimistic by "roughly 10–15%." This is a generic natural-gas estimate,
   not something either codebase computes — I carried it over because you explicitly asked for
   this section to quantify the Z=1 error, and it is the only sourced estimate available. Flag
   if you'd rather this number came from an actual gas analysis instead of a rule-of-thumb.

6. **Verification test count framing.** The physics reference reports "86 tests, pytest, all
   passing" as this app's own verification, and separately notes the predecessor's "34
   self-tests, MATLAB" as a different, non-comparable suite (Discrepancy #11). Confirm this
   framing — no test-by-test mapping between the two suites exists, so I did not attempt to
   claim coverage parity or superiority in either direction.

7. ~~**Client-facing document formatting.**~~ **Resolved.** The physics-only Markdown deliverable
   has been superseded by a single three-part handover document
   (`docs/Compressor_Simulator_Handover_Report.md`), matching the predecessor PDF's Part I/II/III
   structure and typeset to `Report/Compressor_Simulator_Handover_Report.pdf` via the Typst
   pipeline at `Report/typst/handover/` (numbered equations, table of contents, list of figures,
   running header, title page). The old physics-only `.md`/`.pdf` were deleted rather than kept
   alongside the new document.
