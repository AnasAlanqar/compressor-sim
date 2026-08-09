"""
Fault injection state — APP_SPEC.md section 5.

Local to the app, never exposed on OPC UA (the logic under test must not be
able to clear its own faults). Extends physics.Flt (which covers only
lube_low, lube_slow, mag_pickup, overspeed_offset, disch_blocked,
valve_stuck, engine_fail_start — the subset consumed directly inside
physics.py's derivative equations) to the full fault table. The remaining
faults are applied at the layer named in section 5's implementation note:
temp bias and signal freeze/invalid at the tags.py instrumentation
boundary, cooler trip in command interpretation (tags.effective_cmd), link
drop in opcua_link.py.
"""
from dataclasses import dataclass, field

from . import physics as ph


@dataclass
class Flt(ph.Flt):
    # cylinder temp bias, deg F offset — keys 'cyl1'..'cyl4'
    temp_bias: dict = field(default_factory=dict)
    # canonical AI tag names (tags.py's _AI_MAP), held at last value
    signal_freeze: set = field(default_factory=set)
    # canonical AI tag names, driven out of transmitter range
    signal_invalid: set = field(default_factory=set)
    # motor numbers {1, 2} — CMD_4011/4012
    cooler_trip: set = field(default_factory=set)
    # suspends OPC UA writes, exercising the watchdog (opcua_link.py)
    link_drop: bool = False

    # ---- Tier 2 discrete fault inputs, tags.py's tier2_fault_tags() ----
    # every field below is a simple "true while armed" toggle, no dynamics,
    # driven straight from the fault panel — no compressor_lite counterpart
    # and not in the section 4 tag map (which only covers the points
    # PN17481_IO_List_5.xls documents); numbers here are invented but
    # follow the same ISA-style prefixes as the rest of the tag map.
    scrubber_level_hi: set = field(default_factory=set)   # {1,2,3,4} — LSH_7001-7004
    vibration_trip: set = field(default_factory=set)      # {1,2,3} — VSH_7011-7013
    oil_jw_level_lo: set = field(default_factory=set)     # {1,2,3} — LSL_7021-7023
    fuel_gas_press_lo: bool = False                       # PSL_7031
    lubricator_no_flow: set = field(default_factory=set)  # {1,2} — FSL_7041-7042

    def clear(self):
        """Reset every fault. Never touched by APP_SPEC.md 6.1's Reset —
        that's a separate explicit action on the fault panel."""
        d = Flt()
        for f in self.__dataclass_fields__:
            setattr(self, f, getattr(d, f))
