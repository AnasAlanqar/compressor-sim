#import "../../template.typ": *

#part[Part III --- Appendices]

#heading(numbering: none, outlined: true)[Appendix A --- Signal / Tag List] <app-tags>

Full OPC UA tag list, in both directions, as an instrument list rather than a software
interface. Direction is stated from the PLC's point of view. Every analog value is
range-clamped before being written to the PLC; optional per-signal first-order lag (0.3-2 s) and
Gaussian noise are available per tag, off by default (@sec-faults, Signal Freeze/Invalid).

== Commands In (PLC → Simulator)

#data-table(
  ([Tag], [Description], [Range], [Fail value]),
  (
    ([`SC_3001`], [Engine speed command], [0-100%], [0]),
    ([`FC_3002`], [Bypass valve command], [0-100%], [0 (valve opens)]),
    ([`FC_3003`], [Suction valve command], [0-100%], [0 (valve closes)]),
    ([`CMD_4001`], [Auxiliary lube solenoid], [discrete], [off]),
    ([`CMD_4003`], [CAT idle / rated speed select], [discrete], [off]),
    ([`CMD_4004`], [Blowdown solenoid (energised = closed)], [discrete], [off (valve opens)]),
    ([`CMD_4005`], [CAT engine start command], [discrete], [off]),
    ([`CMD_4006`], [CAT ESD (energised = healthy)], [discrete], [off]),
    ([`CMD_4008`], [Driven-equipment-ready], [discrete], [off]),
    ([`CMD_4009`], [Suction ESD solenoid (energised = open)], [discrete], [off]),
    ([`CMD_4010`], [Discharge ESD solenoid], [discrete], [off]),
    ([`CMD_4011`/`4012`], [Cooler motor 1 / 2 run], [discrete], [off]),
  )
)

== Measurements Out (Simulator → PLC)

#data-table(
  ([Tag], [Description], [Range]),
  (
    ([`PT_1001`], [Suction pressure], [0-60 psig]),
    ([`PT_1002`/`1003`/`1004`/`1006`], [Stage 1/2/3/final discharge pressure], [0-300 / 0-1000 / 0-2000 / 0-2000 psig]),
    ([`PT_1005`], [Compressor oil pressure], [0-200 psig]),
    ([`PT_1007`], [Engine oil pressure], [0-150 psig]),
    ([`ST_1008`], [Engine speed], [0-2000 rpm]),
    ([`TT_2001`], [Compressor oil temperature], [0-500 °F]),
    ([`TT_2004`-`2007`], [Cylinder 1-4 discharge temperature], [0-500 °F]),
    ([`TT_2009`-`2012`], [Packing temperatures 1-4], [0-500 °F]),
    ([`TT_2013`], [Aftercooler temperature], [0-500 °F]),
    ([`TT_2014`], [Engine jacket-water temperature], [0-300 °F]),
    ([`ZS_2001`-`2008`], [Valve open/closed limit switches], [discrete]),
    ([`PS_2009`], [Oil pressure healthy (> 10 psig)], [discrete]),
    ([`ST_2010`], [Engine running (> 300 rpm)], [discrete]),
    ([`WD_6001`], [Heartbeat counter, increments every 500 ms], [0-32767]),
    ([`PB_5001`/`5003`/`5004`, `ESD_5002`], [Operator pushbuttons / remote ESD (always live)], [discrete]),
    ([`XA_6002`/`XS_6003`], [CAT ADEM engine alarm / shutdown status], [discrete]),
    ([`RS_4011`/`4012`], [Cooler motor 1 / 2 run feedback], [discrete]),
  )
)

== Tier 2 Discrete Faults (not in the PN17481 I/O list — `docs/APP_SPEC.md` §4.8)

#data-table(
  ([Tag], [Description]),
  (
    ([`LSH_7001`-`7004`], [Suction / ST2 / ST3 / fuel-gas scrubber level high]),
    ([`VSH_7011`-`7013`], [Compressor-frame / engine / skid-piping vibration trip]),
    ([`LSL_7021`-`7023`], [Compressor oil / engine oil / engine JW level low]),
    ([`PSL_7031`], [Fuel-gas pressure low]),
    ([`FSL_7041`/`7042`], [Cylinder lubricator bank 1 / 2 no-flow]),
  )
)

Alarm and trip setpoints (used only to colour the P&ID and draw trend lines — the simulator never
evaluates them) live in `backend/config.yaml`'s `alarms:` block; the full extended-tag rationale
is in `docs/APP_SPEC.md` §4.8.
