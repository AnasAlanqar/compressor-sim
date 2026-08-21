"""Section 1 — Introduction. Sourced from README.md / docs/APP_SPEC.md, not
invented: the reference machine, architecture and no-control-logic design
intent are project facts, not report-writer prose."""
from common.styles import bullets, kv_table, styles
from reportlab.platypus import Paragraph, Spacer


def build():
    story = []
    story.append(Paragraph("1. Introduction", styles["H1"]))

    story.append(Paragraph(
        "Compressor Simulator is a desktop application that models the process response of a "
        "three-stage reciprocating gas compressor package and exposes that model over OPC UA, so a "
        "real PLC — CODESYS running on a laptop, or a physical control panel — can be connected and "
        "its control logic exercised against realistic process behaviour without touching real "
        "machinery.", styles["Body"]))

    story.append(Paragraph(
        "The application contains no control logic of its own: no timers, no permissives, no state "
        "machines, no PID loops, no alarm evaluation. It produces the pressures, temperatures, flows "
        "and speeds a real skid would produce in response to the commands it receives; deciding what "
        "those values mean, running the startup/shutdown sequence, and evaluating alarms and trips is "
        "the PLC's job, exactly as it would be against the physical unit. This division is deliberate: "
        "whatever passes here is exercising the actual control logic under test, not a simplified "
        "stand-in for it.", styles["Body"]))

    story.append(Paragraph("1.1 Reference machine", styles["H2"]))
    story.append(kv_table([
        ("Compressor", "Ariel JGH/4, three-stage reciprocating"),
        ("Driver", "Caterpillar G3516LE gas engine"),
        ("Panel", "Spartan Controls REMVue 500S"),
        ("Unit", "Enerflex 070438, project PN17481"),
    ]))

    story.append(Paragraph("1.2 Architecture", styles["H2"]))
    story.append(Paragraph(
        "The application is split into a browser-based front end and a Python backend running in the "
        "same desktop process (via a WebView shell). The front end renders an animated P&amp;ID, live "
        "gauges and trend charts, driven by a 10&nbsp;Hz WebSocket state push from the backend. The "
        "backend runs a fixed-step physics integrator (RK4, 20&nbsp;ms step) that produces the process "
        "state, and an OPC UA client (asyncua) that reads PLC commands into that model and writes the "
        "model's measurements back out to the PLC.", styles["Body"]))
    story.append(bullets([
        "<b>Front end</b> — React + TypeScript + Vite, rendered inside a native window via pywebview.",
        "<b>Backend</b> — FastAPI + asyncio, hosting the physics loop and the OPC UA client.",
        "<b>PLC link</b> — the simulator is always the OPC UA <i>client</i>; the PLC (CODESYS or a "
        "physical panel) runs the OPC UA <i>server</i>. This direction is deliberate — CODESYS's own "
        "OPC UA client requires separate licensing on some versions, so having the simulator act as "
        "client is the configuration that works everywhere without extra cost.",
    ]))

    story.append(Paragraph("1.3 Purpose of this document", styles["H2"]))
    story.append(Paragraph(
        "This report walks through installing the packaged desktop build, connecting it to a PLC over "
        "OPC UA, and the simulator's operating features (manual overrides, fault injection, trending). "
        "Sections on OPC UA connection and feature walkthroughs are being completed alongside this "
        "document as supporting screenshots become available; installation is covered in full in "
        "Section 2.", styles["Body"]))

    story.append(Spacer(1, 4))
    return story
