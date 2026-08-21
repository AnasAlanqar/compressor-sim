#import "../template.typ": *

#heading(numbering: none, outlined: true)[Appendix A — Reference Tag List] <tag-reference>

The tags below are the ones referenced directly by this report's figures and text
(@opc-connection, @features), transcribed from the CODESYS `GVL_PLC` global
variable list and the simulator's own Tags tab. This is not the simulator's
complete OPC UA symbol set — see @features's Tags tab for that.

#data-table(
  ([Tag], [Description]),
  (
    ([`CMD_4001`], [Auxiliary lube solenoid]),
    ([`CMD_4003`], [CAT idle/rated-speed selection]),
    ([`CMD_4004`], [Blowdown solenoid (energized = closed)]),
    ([`CMD_4005`], [CAT engine start command]),
    ([`CMD_4006`], [CAT ESD healthy signal]),
    ([`CMD_4008`], [Driven-equipment-ready signal]),
    ([`CMD_4009`], [Suction ESD solenoid (energized = open)]),
    ([`SC_3001`], [Engine speed command, 0-100%]),
    ([`FC_3002`], [Bypass valve command, 0-100%]),
    ([`FC_3003`], [Suction valve command, 0-100%]),
    ([`PT_1001` / `1002` / `1003` / `1006`], [Suction / ST1 / ST2 / Final discharge pressure]),
    ([`PT_1005` / `1007`], [Oil pressure / Engine oil pressure]),
    ([`TT_2001` / `2004` / `2005` / `2013` / `2014`], [Oil temp / Cyl 1 temp / Cyl 2 temp / Aftercooler temp / Engine JW temp]),
    ([`ST_1008`], [Engine speed, rpm]),
    ([`RS_4011` / `4012`], [Cooler motor 1 / 2 run feedback]),
    ([`LSH_7001`–`7004`], [Suction / ST2 / ST3 / fuel-gas scrubber high level (Tier 2)]),
    ([`VSH_7011`–`7013`], [Compressor-frame / engine / skid-piping vibration trip (Tier 2)]),
    ([`LSL_7021`–`7023`], [Compressor oil / engine oil / engine JW level low (Tier 2)]),
    ([`PSL_7031`], [Fuel-gas pressure low (Tier 2)]),
    ([`FSL_7041` / `7042`], [Cylinder lubricator bank 1 / 2 no-flow (Tier 2)]),
    ([`PB_5001` / `5003` / `5004`], [Unit shutdown / local stop / remote stop (Tier 1, always live)]),
    ([`ESD_5002`], [Remote ESD (Tier 1, always live)]),
    ([`XA_6002`], [CAT ADEM engine alarm (Tier 1, always live)]),
    ([`XS_6003`], [CAT ADEM engine shutdown (Tier 1, always live)]),
  )
)
