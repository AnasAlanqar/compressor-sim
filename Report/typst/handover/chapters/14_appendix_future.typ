#import "../../template.typ": *

#heading(numbering: none, outlined: true)[Appendix B --- Future Improvements]

#data-table(
  ([Improvement], [Data or input needed]),
  (
    ([Real-gas compressibility (Z-factor) in place of the ideal-gas assumption],
     [A gas composition analysis for the actual process stream]),
    ([A choked-flow model at the blowdown valve],
     [None beyond implementation effort — the physical criterion (critical pressure ratio) is well established]),
    ([Cylinder thermal mass — replace the algebraic discharge-temperature target with a genuine lag driven by an estimated thermal mass],
     [An estimate of effective cylinder thermal mass, or acceptance of a further-fitted time constant]),
    ([A UA-based heat-exchanger model to replace the cooler lookup tables],
     [Fan/cooler performance curves and ambient design conditions for the actual air coolers]),
    ([Engine torque/load coupling with governor droop],
     [The reference engine's governor droop characteristic]),
    ([Validation of the clearance fraction and valve flow coefficients against real performance curves],
     [Vendor performance data for the reference compressor and engine — currently absent]),
    ([Rod load and pulsation analysis],
     [*Explicitly out of scope for this simulator* — belongs in a dedicated mechanical study]),
  )
)
