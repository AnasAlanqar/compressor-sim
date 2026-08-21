#import "../../template.typ": *

= Assumptions and Limitations <sec-limitations>

Stated plainly, so nothing here needs to be discovered by inspection later.

#data-table(
  ([Limitation], [Why acceptable for this purpose], [What it rules out]),
  (
    ([Compressibility factor $Z=1$ (ideal gas) throughout],
     [The purpose is PLC logic testing, not a performance guarantee, and no gas composition analysis was supplied],
     [Any use as a performance-prediction tool; density is optimistic by roughly 10–15% at the discharge end for a typical natural gas at design conditions]),
    ([No choked-flow model — all valve flows use the subsonic orifice form],
     [Blowdown and USD sequences still take real, non-zero time, which is what exercises the PLC's timeout logic],
     [Precise vent-rate or depressurisation-timing validation; the blowdown valve likely vents faster in the model than a real choked vent would]),
    ([No cylinder thermal mass — discharge temperatures are algebraic targets filtered by a generic lag, not a derived thermal model],
     [The PLC only sees the resulting temperature signal, not the mechanism producing it],
     [Any claim that the ~45 s cylinder lag time constant corresponds to a real cylinder's actual thermal time constant]),
    ([No heat-exchanger model — cooler outlets are lookup tables with no UA, air-side flow, or approach temperature],
     [The PLC only ever sees fan status and outlet temperature],
     [Sizing or performance evaluation of the actual air coolers]),
    ([No engine torque or load coupling — speed is a commanded trajectory, not a torque-balance result],
     [Sequencing logic tests speed setpoints and ramp timing, not load response],
     [Any claim that engine speed behaviour under real compressor load (governor droop) is represented]),
    ([No in-cylinder valve dynamics, no pulsation, no rod load],
     [Out of scope for a control-logic test rig by design],
     [Mechanical design, rod-load, or pulsation studies — these belong in a dedicated mechanical analysis]),
    ([No gas composition analysis supplied — $R_(s p)$, $n$ are assumed values, not derived from an actual gas analysis],
     [Consistent, repeatable behaviour is what a logic test rig needs, not exact real-gas fidelity],
     [Confidence that discharge temperature or density values would match a specific real gas stream]),
    ([Clearance fraction $C = 0.078$ was back-solved to close the design point, not sourced from vendor performance data],
     [This is the single largest fitted parameter in the model],
     [Any claim of validated fidelity to the reference machine — this is why the package is framed as a generic three-stage compressor throughout this document]),
    ([No PLC sequencer bundled with this application (unlike its Simulink/CODESYS predecessor)],
     [Sequencing logic under test is supplied by the real PLC being validated, exactly as intended],
     [Standalone demonstration of a full startup/shutdown sequence without an external PLC connected]),
  )
)
