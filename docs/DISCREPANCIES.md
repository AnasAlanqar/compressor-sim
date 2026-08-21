# Discrepancies — `1st_draft_report.pdf` vs. this application's source

Internal review document, not for client handover. Every place a value stated in
`Report/1st_draft_report.pdf` (the earlier Simulink/CODESYS HIL report) differs from what
`backend/app/physics.py` + `backend/config.yaml` actually implement. The app's value is
authoritative in every row below — none of these were "corrected" in
`Compressor_Simulator_Physics_Reference.md`, which uses the app's values throughout.

The vast majority of parameters checked (gas constants, all four valve flow coefficients, all
three cooling lookup tables, all lubrication pressures, all valve rates, all speed ramp rates,
the design-point acceptance values themselves) matched exactly between the two documents. What
follows is the complete list of what did not.

| # | Quantity | PDF value | App value | Found at |
|---|---|---|---|---|
| 1 | "Slow lube build" fault time constant | 90 s (`1/90` block, PDF Fig. 30, p. 36) | 900 s | `backend/config.yaml` line 64, `oil.tau_oil_slow` |
| 2 | "Engine fails to start" fault speed clamp | 400 rpm (PDF Fig. 31 constant, p. 36; checkbox label "Clamps at 400 rpm," PDF Fig. 29, p. 35) | 550 rpm | `backend/app/physics.py` line 293; `backend/config.yaml`'s comment on `faults.py` |
| 3 | "Overspeed sensor bias" fault mechanism | Fixed +100 rpm offset applied by a checkbox toggle (PDF Fig. 31 constant "100", p. 36) | Continuous slider, arbitrary rpm offset, no fixed default magnitude | `backend/app/physics.py` `Flt.overspeed_offset: float`; `docs/APP_SPEC.md` §5 table |
| 4 | "Cylinder temp sensor bias" fault mechanism | Single shared magnitude field (default 50 °F, PDF Fig. 29) applied identically to both T1 and T2 outputs by one checkbox | Per-cylinder independent offsets (`cyl1`–`cyl4`), no shared "magnitude" field, no stated default | `backend/app/faults.py` `Flt.temp_bias: dict` |
| 5 | "Stuck bypass valve" fault scope | Bypass valve only (PDF Fig. 29 checkbox: "Stuck Bypass Valve") | Any of the 5 valves (`byp`, `suc`, `sesd`, `desd`, `bdv`) | `backend/app/physics.py` `Flt.valve_stuck: str`; `docs/APP_SPEC.md` §5 |
| 6 | "Cooler motor trip" fault scope | Both fans tripped together as one fault (PDF Fig. 33: single `ft_cooler_trip` forces `n_fans_faulted` to 0) | Per-motor, independently (`{1}`, `{2}`, or `{1,2}`) | `backend/app/faults.py` `Flt.cooler_trip: set`; `tests/test_faults.py::test_cooler_trip_partial` |
| 7 | "Signal freeze" fault scope | Discharge pressure ($P_d$) only (PDF Fig. 29 checkbox: "Signal Freeze (Pd)"; PDF Fig. 33 shows one dedicated sample-and-hold circuit) | Any analog tag, selected as a set (`signal_freeze: set`) | `backend/app/tags.py` `Instrumentation.apply()` |
| 8 | "Signal invalid" fault | Not present — the PDF's fault list has exactly 10 entries (confirmed by the "ten raw → faulted signal pairs" text, PDF p. 34) and none of them is a range-invalidation fault | Present — drives any selected analog tag out of its transmitter range | `backend/app/faults.py` `Flt.signal_invalid: set`; `docs/APP_SPEC.md` §5 |
| 9 | Compressor mass flow equation | No capacity-multiplier term (PDF eq. 5, p. 11: $\dot m_{comp} = V_{disp}\rho_s\, VE\,(N/60)\,\text{gate}$) | Previously included a $K_{cap}$ multiplier, default 1.0 (numerically inert). Removed 2026-08-20 — no documented purpose was ever found (Open Question #1); the app's equation now matches the PDF's form exactly | `backend/app/physics.py` line ~239 |
| 10 | PLC sequencer / startup-shutdown state machine | Present — the PDF documents a full CODESYS ST sequencer (`PLC_PRG`) bundled with the Simulink model, including step tables, timer constants (`T_PURGE`, `T_BLOWDOWN_MAX`, etc.), and a USD-vs-normal-stop state diagram (PDF Part II §0.10, pp. 43–51) | Absent by design — this application supplies no sequencer at all; every timer and permissive belongs to whatever real PLC is connected | `docs/APP_SPEC.md` §1, §4.6, §9 |
| 11 | Verification test count / tooling | 34 self-tests, MATLAB (`run_tests.m` + `verify_*.m` scripts), PDF §0.10.5, p. 50 | 86 tests, pytest — different tool, different (larger, non-overlapping) implementation, not a like-for-like re-run of the same 34 | `tests/*.py`; see `Compressor_Simulator_Handover_Report.md` §6 |

## Notes on items intentionally *not* listed as discrepancies

- **$P_{oil}$ initial condition / units representation.** The PDF's equation (15) bakes an
  atmospheric offset (101325 Pa) into the lube-oil pressure state so it reads as a true
  absolute pressure, with an initial condition of 101325 Pa. This app's `P_oil` state is
  represented directly in gauge Pa with an initial condition of 0. Both represent the same
  physical starting condition (0 psig oil pressure at $t=0$) — this is a unit-representation
  choice, not a value discrepancy, and the physics reference does not flag it as one.
- **Design-point values, all core gas/flow/valve/cooling/lubrication constants.** Checked
  individually against the PDF's Part I (equations, symbol table) and Part II §0.4/§0.5
  (cooling and lubrication subsystem descriptions) — every one matched to the precision stated
  in both documents. Not tabulated above since there is nothing to report.
- **The 550 rpm engine-fail-start clamp (item 2) is plausibly the *more correct* value**, not
  an error: it matches `N_RUN_PERMIT = 550 rpm` from the PDF's own sequencer constants table
  (PDF p. 49, cross-referenced to the REMVue 500S Operating Philosophy), i.e. it clamps speed
  to exactly the running-permit threshold rather than an arbitrary lower number. Flagged here
  regardless, per your instruction to report every numeric difference rather than only the
  ones that look like errors.
