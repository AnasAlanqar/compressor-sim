"""Section 4 — Simulator features, built from images/features/fig19-fig28.
Each figure was inspected directly before writing its caption.
"""
from pathlib import Path

from common.styles import figure, kv_table, styles
from reportlab.platypus import Paragraph, Spacer

IMG = Path(__file__).resolve().parent.parent / "images" / "features"


def build():
    story = []
    story.append(Paragraph("4. Simulator features", styles["H1"]))
    story.append(Paragraph(
        "The right-hand tool dock exposes three tabs, available whether or not a PLC is connected, "
        "plus a full-screen Engineering Trends view opened from the header:", styles["Body"]))
    story.append(kv_table([
        ("Overrides", "Manual control panel; read-only PLC command echo once a PLC is connected."),
        ("Faults", "Fault injection panel for testing PLC fault handling."),
        ("Tags", "Full flat table of every OPC UA tag and its current value."),
        ("Engineering Trends", "Full-screen strip charts of key tags, opened via a header button."),
    ], col_widths=(1.5 * 72, 4.8 * 72)))
    story.append(Paragraph(
        "The app also supports a dark theme (toggled via the “theme” button in the header), shown "
        "below with the unit running at rated speed under PLC control.", styles["Body"]))
    story.append(figure(IMG / "fig20_hmi_home_dark_theme_running.png",
                         "Compressor Simulator in dark theme, unit running under PLC control: all "
                         "three stages RUN, coolers ON, discharge pressures building stage over stage "
                         "(ST1 117 psig, ST2 364 psig, ST3 1071 psig), engine at 850 rpm. The "
                         "connection banner at top right (“Connection is closed”) is a stale artifact "
                         "of this particular capture, not a normal running state."))

    story.append(Paragraph("4.1 Overrides — status feedback and always-live inputs", styles["H2"]))
    story.append(Paragraph(
        "Beyond the Engine and Valves groups shown earlier (Section 3), the Overrides dock also has a "
        "read-only status block reflecting sensor/feedback tags the PLC does not command, and a "
        "separate group of operator/ECU pushbuttons that stay live and editable even while a PLC is "
        "connected.", styles["Body"]))
    story.append(figure(IMG / "fig23_hmi_status_feedback_readonly.png",
                         "Status feedback (read-only): cooler run feedback (RS_4011, RS_4012), engine "
                         "jacket-water temperature (TT_2014), and engine oil pressure (PT_1007)."))
    story.append(Paragraph(
        "The Tier 1 operator inputs — unit shutdown, local/remote stop, remote ESD, CAT alarm/fail-SD "
        "— stay live regardless of PLC connection state, matching the real unit where these are "
        "hardwired straight into the PLC's I/O rather than routed through an upstream system.",
        styles["Body"]))
    story.append(figure(IMG / "fig24_hmi_operator_ecu_inputs_always_live.png",
                         "Operator / ECU inputs (always live): unit shutdown (PB_5001), local stop "
                         "(PB_5003), remote stop (PB_5004), remote ESD (ESD_5002), CAT alarm (XA_6002), "
                         "CAT fail SD (XS_6003)."))

    story.append(Paragraph("4.2 Faults", styles["H2"]))
    story.append(Paragraph(
        "The Faults tab is grouped by subsystem, with a single <b>Clear all faults</b> control at the "
        "top. Faults are applied instantly and independently of Reset (Section 8 of the user manual) — "
        "clearing one is a separate, explicit action.", styles["Body"]))
    story.append(figure(IMG / "fig21_hmi_faults_tab_engine_process.png",
                         "Engine faults — low lube oil pressure, slow lube build, engine fails to "
                         "start, mag pickup (speed signal) fault, and an overspeed bias slider — "
                         "followed by the start of the Process group (blocked discharge, valve stuck)."))
    story.append(figure(IMG / "fig26_hmi_faults_cylinder_bias_cooler_scrubber.png",
                         "Cylinder temperature bias per cylinder (1-4), cooler motor trip switches, "
                         "and Tier 2 scrubber-level switches (suction, ST2, ST3, fuel-gas)."))
    story.append(figure(IMG / "fig25_hmi_tags_vibration_oil_lubricator_tier2.png",
                         "Further Tier 2 discrete faults: vibration trips (compressor frame, engine, "
                         "skid/piping), oil/jacket-water low-level switches, fuel-gas pressure low, "
                         "and cylinder lubricator no-flow (banks 1-2)."))
    story.append(figure(IMG / "fig27_hmi_faults_signal_freeze_invalid_link_drop.png",
                         "Signal freeze/invalid controls for every analog tag, a Link drop switch "
                         "(suspends OPC UA writes to exercise the PLC's own watchdog), and the start "
                         "of the Instrumentation group (signal lag, signal noise)."))
    story.append(figure(IMG / "fig22_hmi_faults_tab_instrumentation_boundary_conditions.png",
                         "Instrumentation faults (signal lag, signal noise) and the Boundary "
                         "Conditions panel — source pressure, pipeline pressure, suction temperature, "
                         "ambient temperature — for changing the process's external conditions."))

    story.append(Paragraph("4.3 Tags", styles["H2"]))
    story.append(Paragraph(
        "The Tags tab lists every OPC UA tag the simulator exposes and its live current value, useful "
        "for confirming exactly what a connected PLC is seeing without cross-referencing the P&amp;ID "
        "or Overrides dock tag by tag.", styles["Body"]))
    story.append(figure(IMG / "fig28_hmi_tags_tab_live_values_list.png",
                         "Tags tab: a flat, alphabetically-ordered list of tag names and live values "
                         "(discrete switches as true/false, analogs with engineering units)."))

    story.append(Paragraph("4.4 Engineering Trends", styles["H2"]))
    story.append(Paragraph(
        "The full-screen Engineering Trends view (opened via the header's <b>Engineering Trends</b> "
        "button) plots up to twelve tags at once against a rolling buffer, sampled at 10&nbsp;Hz on the "
        "simulation's own time base. Each pen can be toggled independently; the dashed lines mark "
        "configured engineering limits for reference and, as the on-screen note states, are not "
        "simulator alarms — the simulator itself does not evaluate alarms (Section 1).", styles["Body"]))
    story.append(figure(IMG / "fig19_hmi_engineering_trends_pressures.png",
                         "Engineering Trends with four pressure pens selected (suction, ST1 discharge, "
                         "ST2 discharge, final discharge) over a 30-minute rolling window, ramping up "
                         "during a startup."))
    story.append(Paragraph(
        "The time-window buttons (1m/5m/15m/30m), zoom controls, and Live Follow toggle let a trend be "
        "either watched live or paused and dragged to inspect a specific transient.", styles["Body"]))

    story.append(Spacer(1, 4))
    return story
