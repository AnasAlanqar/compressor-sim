#import "../../template.typ": *

= The Operator Interface <sec-interface>

The right-hand tool dock exposes three tabs, available whether or not a PLC is
connected, plus a full-screen Engineering Trends view opened from the header:

#kv-table((
  ("Overrides", "Manual control panel; read-only PLC command echo once a PLC is connected."),
  ("Faults", "Fault injection panel for testing PLC fault handling (@sec-faults)."),
  ("Tags", "Full flat table of every OPC UA tag and its current value."),
  ("Engineering Trends", "Full-screen strip charts of key tags, opened via a header button."),
))

The app also supports a dark theme (toggled via the "theme" button in the header),
shown below with the unit running at rated speed under PLC control.

#fig("/images/features/fig20_hmi_home_dark_theme_running.png",
  [Compressor Simulator in dark theme, unit running under PLC control: all three
   stages RUN, coolers ON, discharge pressures building stage over stage (ST1 117
   psig, ST2 364 psig, ST3 1071 psig), engine at 850 rpm.]) <fig-hmi-running>

== Overrides — Status Feedback and Always-Live Inputs

Beyond the Engine and Valves groups shown earlier (@opc-connection), the Overrides
dock also has a read-only status block reflecting sensor/feedback tags the PLC does
not command, and a separate group of operator/ECU pushbuttons that stay live and
editable even while a PLC is connected.

#fig("/images/features/fig23_hmi_status_feedback_readonly.png",
  [Status feedback (read-only): cooler run feedback (RS_4011, RS_4012), engine
   jacket-water temperature (TT_2014), and engine oil pressure (PT_1007).])

The Tier 1 operator inputs — unit shutdown, local/remote stop, remote ESD, CAT
alarm/fail-SD — stay live regardless of PLC connection state, matching the real
unit where these are hardwired straight into the PLC's I/O rather than routed
through an upstream system.

#fig("/images/features/fig24_hmi_operator_ecu_inputs_always_live.png",
  [Operator / ECU inputs (always live): unit shutdown (PB_5001), local stop
   (PB_5003), remote stop (PB_5004), remote ESD (ESD_5002), CAT alarm (XA_6002),
   CAT fail SD (XS_6003).], width: 40%)

== Faults

The Faults tab is grouped by subsystem, with a single *Clear all faults* control at
the top. Faults are applied instantly and independently of Reset — clearing one is
a separate, explicit action. The complete fault table is @sec-faults.

#fig("/images/features/fig21_hmi_faults_tab_engine_process.png",
  [Engine faults — low lube oil pressure, slow lube build, engine fails to start,
   mag pickup (speed signal) fault, and an overspeed bias slider — followed by the
   start of the Process group (blocked discharge, valve stuck).])

#fig("/images/features/fig26_hmi_faults_cylinder_bias_cooler_scrubber.png",
  [Cylinder temperature bias per cylinder (1-4), cooler motor trip switches, and
   Tier 2 scrubber-level switches (suction, ST2, ST3, fuel-gas).], width: 26%)

#fig("/images/features/fig25_hmi_tags_vibration_oil_lubricator_tier2.png",
  [Further Tier 2 discrete faults: vibration trips (compressor frame, engine,
   skid/piping), oil/jacket-water low-level switches, fuel-gas pressure low, and
   cylinder lubricator no-flow (banks 1-2).], width: 28%)

#fig("/images/features/fig27_hmi_faults_signal_freeze_invalid_link_drop.png",
  [Signal freeze/invalid controls for every analog tag, a Link drop switch
   (suspends OPC UA writes to exercise the PLC's own watchdog), and the start of
   the Instrumentation group (signal lag, signal noise).], width: 25%)

#fig("/images/features/fig22_hmi_faults_tab_instrumentation_boundary_conditions.png",
  [Instrumentation faults (signal lag, signal noise) and the Boundary Conditions
   panel — source pressure, pipeline pressure, suction temperature, ambient
   temperature — for changing the process's external conditions.])

== Tags

The Tags tab lists every OPC UA tag the simulator exposes and its live current
value, useful for confirming exactly what a connected PLC is seeing without
cross-referencing the P&ID or Overrides dock tag by tag.

#fig("/images/features/fig28_hmi_tags_tab_live_values_list.png",
  [Tags tab: a flat, alphabetically-ordered list of tag names and live values
   (discrete switches as true/false, analogs with engineering units).], width: 27%)

== Engineering Trends

The full-screen Engineering Trends view (opened via the header's *Engineering
Trends* button) plots up to twelve tags at once against a rolling buffer, sampled
at 10 Hz on the simulation's own time base. Each pen can be toggled independently;
the dashed lines mark configured engineering limits for reference and, as the
on-screen note states, are not simulator alarms — the simulator itself does not
evaluate alarms (@sec-purpose).

#fig("/images/features/fig19_hmi_engineering_trends_pressures.png",
  [Engineering Trends with four pressure pens selected (suction, ST1 discharge,
   ST2 discharge, final discharge) over a 30-minute rolling window, ramping up
   during a startup.])

The time-window buttons (1m/5m/15m/30m), zoom controls, and Live Follow toggle let
a trend be either watched live or paused and dragged to inspect a specific
transient.
