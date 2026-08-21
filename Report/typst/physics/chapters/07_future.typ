#import "../../template.typ": *

= Future Improvements

#data-table(
  ([Improvement], [Data or input needed]),
  (
    ([Real-gas compressibility (Z-factor) in place of the ideal-gas assumption],
     [A gas composition analysis for the actual process stream]),
    ([A choked-flow model at the blowdown valve],
     [None beyond implementation effort — the physical criterion (critical pressure ratio) is well established; would improve vent-rate and depressurisation-timing fidelity]),
    ([Cylinder thermal mass — replace the algebraic discharge-temperature target with a genuine lag driven by an estimated thermal mass, rather than the current two-stage abstraction],
     [An estimate of effective cylinder thermal mass, or acceptance of a further-fitted time constant]),
    ([A UA-based heat-exchanger model to replace the cooler lookup tables],
     [Fan/cooler performance curves and ambient design conditions for the actual air coolers specified for this package]),
    ([Engine torque/load coupling with governor droop],
     [The CAT G3516LE ADEM A3 governor's droop characteristic]),
    ([Validation of the clearance fraction and valve flow coefficients against real Ariel and CAT performance curves],
     [Ariel JGH/4 and CAT G3516LE performance data — currently absent, which is why $C=0.078$ is fitted rather than sourced]),
    ([Rod load and pulsation analysis],
     [*Explicitly out of scope for this simulator.* This belongs in a dedicated mechanical study; a control-logic test rig has no need for it, and this document should not be read as implying one is planned as an extension of this model]),
    ([Reconcile this application's lack of a bundled reference PLC sequencer against the predecessor Simulink/CODESYS rig's approach, if standalone startup/shutdown demonstration (without an external PLC) becomes a requirement],
     [A decision on whether that capability is needed for this application, or remains the connected PLC's sole responsibility as currently designed]),
  )
)
