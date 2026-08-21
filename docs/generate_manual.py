"""
Builds docs/CompressorSim-User-Manual.pdf from the content below.

Run:  .venv\\Scripts\\python.exe docs\\generate_manual.py

Pure-Python (reportlab) rather than a Chromium/wkhtmltopdf pipeline — no
extra native binaries to install alongside the app's existing PyInstaller
build tooling. Re-run any time the content below changes; the PDF itself
is a build artifact, not something to hand-edit.
"""
import datetime
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table,
    TableStyle, NextPageTemplate, PageBreak, ListFlowable, ListItem, KeepTogether,
)
from reportlab.platypus.tableofcontents import TableOfContents

OUT = Path(__file__).resolve().parent / "CompressorSim-User-Manual.pdf"
VERSION = "0.5.0"
DATE = datetime.date.today().strftime("%B %-d, %Y") if False else datetime.date.today().strftime("%B %d, %Y")

INK = colors.HexColor("#1a1d21")
ACCENT = colors.HexColor("#0e7a5f")
MUTED = colors.HexColor("#6b7280")
RULE = colors.HexColor("#d8dbe0")
WARN_BG = colors.HexColor("#fdf3e0")
WARN_BORDER = colors.HexColor("#b8860b")
NOTE_BG = colors.HexColor("#eef6f3")
NOTE_BORDER = ACCENT
CODE_BG = colors.HexColor("#f2f3f5")

styles = getSampleStyleSheet()

styles.add(ParagraphStyle(
    "Body", parent=styles["Normal"], fontName="Helvetica", fontSize=10,
    leading=14.5, spaceAfter=8, textColor=INK,
))
styles.add(ParagraphStyle(
    "H1", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=17,
    leading=21, spaceBefore=6, spaceAfter=10, textColor=INK, outlineLevel=0,
))
styles.add(ParagraphStyle(
    "H2", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=12.5,
    leading=16, spaceBefore=14, spaceAfter=6, textColor=ACCENT, outlineLevel=1,
))
styles.add(ParagraphStyle(
    "H3", parent=styles["Heading3"], fontName="Helvetica-Bold", fontSize=10.5,
    leading=14, spaceBefore=8, spaceAfter=4, textColor=INK,
))
styles.add(ParagraphStyle(
    "Mono", parent=styles["Normal"], fontName="Courier", fontSize=9,
    leading=13, textColor=INK, backColor=CODE_BG, borderPadding=6,
    leftIndent=2, spaceAfter=8,
))
styles.add(ParagraphStyle(
    "Caption", parent=styles["Normal"], fontName="Helvetica-Oblique", fontSize=8.5,
    leading=11, textColor=MUTED,
))
styles.add(ParagraphStyle(
    "TOCEntry", parent=styles["Normal"], fontName="Helvetica", fontSize=10.5,
    leading=20, textColor=INK,
))
styles.add(ParagraphStyle(
    "CoverTitle", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=30,
    leading=36, alignment=TA_CENTER, textColor=INK,
))
styles.add(ParagraphStyle(
    "CoverSub", parent=styles["Normal"], fontName="Helvetica", fontSize=14,
    leading=20, alignment=TA_CENTER, textColor=MUTED,
))
styles.add(ParagraphStyle(
    "CoverMeta", parent=styles["Normal"], fontName="Helvetica", fontSize=10,
    leading=16, alignment=TA_CENTER, textColor=MUTED,
))


def note_table(text, bg=NOTE_BG, border=NOTE_BORDER, label="NOTE"):
    p = Paragraph(f"<b>{label}.</b> {text}", styles["Body"])
    t = Table([[p]], colWidths=[6.3 * inch])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("BOX", (0, 0), (-1, -1), 0.75, border),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


def warn(text):
    return note_table(text, bg=WARN_BG, border=WARN_BORDER, label="IMPORTANT")


def bullets(items, bullet="•"):
    return ListFlowable(
        [ListItem(Paragraph(i, styles["Body"]), leftIndent=6) for i in items],
        bulletType="bullet", bulletFontName="Helvetica", bulletFontSize=8,
        start=bullet, leftIndent=16, spaceBefore=2, spaceAfter=8,
    )


def numbered(items):
    return ListFlowable(
        [ListItem(Paragraph(i, styles["Body"]), leftIndent=6) for i in items],
        bulletType="1", leftIndent=18, spaceBefore=2, spaceAfter=8,
    )


def kv_table(rows, col_widths=(1.6 * inch, 4.7 * inch)):
    data = [[Paragraph(f"<b>{k}</b>", styles["Body"]), Paragraph(v, styles["Body"])] for k, v in rows]
    t = Table(data, colWidths=list(col_widths))
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, RULE),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t


story = []

# ---------------------------------------------------------------- COVER ----
story.append(Spacer(1, 2.0 * inch))
story.append(Paragraph("Compressor Simulator", styles["CoverTitle"]))
story.append(Spacer(1, 0.15 * inch))
story.append(Paragraph("User Manual", styles["CoverSub"]))
story.append(Spacer(1, 0.5 * inch))
story.append(Paragraph("Ariel JGH/4 &middot; CAT G3516LE &middot; Spartan REMVue 500S", styles["CoverMeta"]))
story.append(Paragraph("Enerflex Unit 070438 &nbsp;—&nbsp; Project PN17481", styles["CoverMeta"]))
story.append(Spacer(1, 1.6 * inch))
story.append(Paragraph(f"Version {VERSION} &nbsp;&bull;&nbsp; {DATE}", styles["CoverMeta"]))
story.append(NextPageTemplate("body"))
story.append(PageBreak())

# -------------------------------------------------------------- TOC --------
# Real, auto-paginating TOC (reportlab's TableOfContents flowable, fed by
# ManualDocTemplate.afterFlowable below via notify('TOCEntry', ...)) rather
# than hand-typed page numbers, which drift out of sync the moment a
# paragraph reflows onto a different page.
# A distinct style name ("TOCTitle", not "H1") so ManualDocTemplate.after
# Flowable() below doesn't feed the TOC's own title into itself as an entry.
story.append(Paragraph("Contents", ParagraphStyle("TOCTitle", parent=styles["H1"])))
toc = TableOfContents()
toc.levelStyles = [
    ParagraphStyle("TOCLevel0", parent=styles["TOCEntry"], fontName="Helvetica-Bold",
                   leftIndent=0, firstLineIndent=0),
    ParagraphStyle("TOCLevel1", parent=styles["TOCEntry"], fontSize=9.5, leading=16,
                   leftIndent=18, firstLineIndent=0, textColor=MUTED),
]
story.append(toc)
story.append(PageBreak())

# ============================================================ 1. WHAT ======
story.append(Paragraph("1. What this is", styles["H1"]))
story.append(Paragraph(
    "Compressor Simulator is a desktop application that models a three-stage reciprocating gas "
    "compressor package and exposes it over OPC UA, so a real PLC — CODESYS on a laptop, or a "
    "physical control panel — can be connected and its control logic exercised against realistic "
    "process behaviour without touching real machinery.", styles["Body"]))
story.append(Paragraph(
    "The application contains <b>no control logic</b>. It produces pressures, temperatures, flows and "
    "speeds in response to the commands it receives; it does not decide what those values mean, does "
    "not run permissives or timers, and does not evaluate alarms. All of that is the PLC's job, exactly "
    "as it would be against the real unit. This is the entire point of the tool: whatever passes here is "
    "exercising the actual control logic under test, not a simplified stand-in for it.", styles["Body"]))
story.append(Paragraph("Reference machine", styles["H3"]))
story.append(kv_table([
    ("Compressor", "Ariel JGH/4, three-stage reciprocating"),
    ("Driver", "Caterpillar G3516LE gas engine"),
    ("Panel", "Spartan Controls REMVue 500S"),
    ("Unit", "Enerflex 070438, project PN17481"),
]))
story.append(Spacer(1, 4))
story.append(Paragraph(
    "The app is always the OPC UA <i>client</i>; CODESYS's built-in OPC UA server is what it connects "
    "to. This direction is deliberate — CODESYS's own OPC UA client requires separate licensing on "
    "some versions, so having the simulator be the client is the configuration that works everywhere "
    "without extra cost.", styles["Body"]))

# ============================================================ 2. INSTALL ===
story.append(Paragraph("2. Installing", styles["H1"]))
story.append(Paragraph(
    "You should have received one file: <font face=\"Courier\">CompressorSim-Setup-"
    f"{VERSION}.zip</font>. Save it, then right-click it and choose "
    "<i>Extract All</i>. Inside is a single file — <font face=\"Courier\">CompressorSim-Setup-"
    f"{VERSION}.exe</font> — which is the entire installer. Nothing else needs to be downloaded "
    "or copied alongside it.", styles["Body"]))
story.append(numbered([
    "Extract the zip, then double-click the installer inside it.",
    "Click through the setup wizard (Next → Next → Install → Finish). The install runs "
    "per-user and does not require administrator rights.",
    "Leave “Create a desktop shortcut” checked if you want one.",
    "On first run only, if the Microsoft Edge WebView2 Runtime isn't already on the machine, the "
    "installer silently installs it before launching the app — this is a one-time system component, "
    "not part of Compressor Simulator itself, and most Windows 10/11 machines already have it.",
]))

# ============================================================ 3. FIRST =====
story.append(Paragraph("3. First launch", styles["H1"]))
story.append(Paragraph(
    "Launch Compressor Simulator from the Start menu or the desktop shortcut. A single window opens "
    "with the P&amp;ID diagram, live gauges, and the connection controls across the top. The simulation "
    "starts running immediately using default boundary conditions — no PLC connection is required "
    "to watch the process animate, and it's a reasonable way to confirm the install worked before "
    "wiring up a PLC.", styles["Body"]))
story.append(Paragraph(
    "The app keeps its own settings (connection profiles, last-used endpoint) in "
    "<font face=\"Courier\">%LOCALAPPDATA%\\CompressorSim</font>, separate from the install directory. "
    "Uninstalling and reinstalling does not erase these unless you delete that folder yourself.",
    styles["Body"]))

# ============================================================ 4. CONNECT ===
story.append(Paragraph("4. Connecting to a PLC", styles["H1"]))
story.append(Paragraph(
    "Click the small settings icon next to the connection status in the header to open "
    "<b>Connect to a PLC</b>.", styles["Body"]))

story.append(Paragraph("4.1 Where is the PLC?", styles["H2"]))
story.append(bullets([
    "<b>This computer</b> — select this if CODESYS is running on the same laptop as the simulator "
    "(the common case for bench testing). Connects to <font face=\"Courier\">localhost:4840</font>.",
    "<b>Another device on the network</b> — select this for a physical panel or a separate PC. "
    "Type its IP address, or click <b>Scan my network</b> to have the app look for OPC UA servers on "
    "the local subnet automatically.",
]))
story.append(Paragraph("Click <b>Connect</b>. That's the entire procedure for the vast majority of setups.", styles["Body"]))

story.append(Paragraph("4.2 How tags are found (usually nothing to do here)", styles["H2"]))
story.append(Paragraph(
    "By default the app searches the PLC's entire tag tree for every tag it needs by name, so you do "
    "not need to know or supply a namespace, browse path, or node ID. This is the <b>Automatic</b> mode "
    "under the Advanced section, and it is the right choice for essentially every CODESYS project.",
    styles["Body"]))
story.append(Paragraph(
    "The Advanced section only needs attention if the PLC exposes its tags somewhere Automatic can't "
    "reach — for example, a non-standard OPC UA server, or a CODESYS project where Symbol "
    "Configuration is not published (see Troubleshooting, section 9).", styles["Body"]))
story.append(Table([[Paragraph(
    "<b>Automatic</b> (default) &mdash; search the whole tag tree by name, nothing to configure.<br/>"
    "<b>Browse path</b> &mdash; walk a specific namespace + Global Variable List (GVL) name; use "
    "<i>Discover</i> to browse the PLC's tree visually and pick the right one.<br/>"
    "<b>Node ID pattern</b> &mdash; build each tag's OPC UA NodeId directly from a string pattern, for "
    "servers that don't expose a walkable Objects tree.", styles["Body"])]], colWidths=[6.3 * inch]))
story.append(Spacer(1, 6))

story.append(Paragraph("4.3 Saved PLCs (connection profiles)", styles["H2"]))
story.append(Paragraph(
    "If you regularly connect to more than one PLC — a bench unit and a site panel, for instance "
    "— use <b>Save as…</b> to store the current settings under a name. Saved PLCs appear as "
    "chips you can click to switch targets instantly without re-entering an address.", styles["Body"]))

story.append(Paragraph("4.4 Once connected", styles["H2"]))
story.append(Paragraph(
    "The status dot turns green and the header shows the connected endpoint. From this point the PLC "
    "is driving the simulation: every command the PLC writes (speed, valve positions, discrete outputs) "
    "is applied to the physics model, and every measurement the model produces (pressures, temperatures, "
    "flows) is written back to the PLC every 100&nbsp;ms. The Overrides panel (section 6) becomes "
    "read-only, showing what the PLC is actually commanding rather than accepting manual input.",
    styles["Body"]))
story.append(Paragraph(
    "A watchdog independently proves the PLC connection is alive (not just that the last read/write "
    "call happened to succeed). If the link genuinely drops, the app falls back to fail-safe values "
    "the same way a real hardwired I/O loss would present, and the status area shows the error.",
    styles["Body"]))
story.append(Paragraph("Click <b>Disconnect</b> to release the PLC and return to manual control.", styles["Body"]))

# ============================================================ 5. SCREEN ====
story.append(Paragraph("5. Reading the screen", styles["H1"]))
story.append(Paragraph("5.1 Header", styles["H2"]))
story.append(bullets([
    "Connection status dot and simulation clock (seconds since last reset).",
    "<b>Run / Pause</b> — freezes the physics integration; useful to inspect a transient state.",
    "<b>Reset</b> — restarts the simulation from a chosen initial condition (section 8).",
    "OPC UA connection status, endpoint, and the settings gear (section 4).",
]))

story.append(Paragraph("5.2 Process diagram (P and ID)", styles["H2"]))
story.append(Paragraph(
    "An animated process &amp; instrumentation diagram showing the three compression stages, scrubbers, "
    "coolers, and valves, with live gauge readouts at each instrument point. Values that breach a "
    "configured alarm setpoint are shown in the alarm colour — this coloring is a display "
    "convenience only; the simulator does not evaluate or act on alarms itself.", styles["Body"]))

story.append(Paragraph("5.3 Footer readouts", styles["H2"]))
story.append(Paragraph(
    "The four large numbers along the bottom — suction pressure, final discharge pressure, engine "
    "speed, and mass flow — are the “read it from across the room” summary of unit state.",
    styles["Body"]))

story.append(Paragraph("5.4 Tabs", styles["H2"]))
story.append(kv_table([
    ("Overrides", "Manual control panel (section 6) and read-only PLC command echo."),
    ("Trends", "Live-streamed strip charts of key tags, with alarm setpoint lines."),
    ("Faults", "Fault injection panel for testing PLC fault handling (section 7)."),
    ("Tags", "Full flat table of every OPC UA tag and its current value — useful for confirming "
             "exactly what the PLC is seeing."),
], col_widths=(1.3 * inch, 5.0 * inch)))

# ============================================================ 6. MANUAL ====
story.append(Paragraph("6. Manual control (no PLC connected)", styles["H1"]))
story.append(Paragraph(
    "With OPC UA disconnected, nothing is driving the unit but you. The Overrides tab stands in for "
    "the PLC — every input a real control program would normally generate automatically (engine start, "
    "speed command, valve positions, ESDs, cooler motors) is instead a tile or slider you operate by "
    "hand. This is the fastest way to see the process model actually respond to something, before a "
    "PLC is ever wired up — and it's a useful way to sanity-check a fault (section 7) behaves as "
    "expected before relying on it to test real control logic.", styles["Body"]))
story.append(Paragraph(
    "The Tier&nbsp;1 operator inputs (unit shutdown, local/remote stop, remote ESD, CAT engine alarm/"
    "failure) stay live even while a PLC is connected — on the real unit these are hardwired "
    "straight into the PLC's I/O, never routed through an upstream system, so the simulator models them "
    "the same way.", styles["Body"]))

story.append(Paragraph("6.1 A quick demo — bring the unit up by hand", styles["H2"]))
story.append(Paragraph(
    "This is not the compressor's certified startup sequence — that logic lives entirely in the PLC, "
    "deliberately kept out of this app (section 1). It's simply a walkthrough that pushes the process "
    "model through a representative start, so you can watch the P&amp;ID gauges and Trends tab respond "
    "before a PLC is ever in the loop.", styles["Body"]))
story.append(numbered([
    "In the header, set the Reset dropdown to <b>Reset — blown down</b> and click <b>Reset</b>. The "
    "unit starts at atmospheric pressure, all valves at their fail-safe position, engine stopped.",
    "Open the <b>Overrides</b> tab.",
    "In <i>Engine</i>, switch on <b>CAT ESD healthy</b> and <b>Driven equip. ready</b>, and in "
    "<i>Valves</i> switch on <b>Suction ESD</b>, <b>Discharge ESD</b>, and <b>Blowdown</b>. On the "
    "real unit these permissives are supplied by other parts of the control system; here, you're "
    "supplying them directly so the rest of the demo has somewhere to go. The Blowdown tile matters "
    "more than it looks: it fails <i>open</i>, so until you switch it on, the blowdown valve is wide "
    "open and vents suction gas straight to atmosphere — nothing you do downstream will build any "
    "pressure until it's closed.",
    "Optional: switch on <b>Auxiliary lube</b> to bring oil pressure up on the prelube curve before "
    "the engine actually turns — otherwise oil pressure stays at zero until the engine starts "
    "cranking, then ramps up on its own regardless. Doesn't affect whether the engine starts, only "
    "whether you see this ramp on the way there.",
    "Switch on <b>CAT start</b>. Watch the Speed readout in the footer climb toward idle "
    "(650&nbsp;rpm) as the engine comes up.",
    "Drag the <b>Bypass command</b> slider up toward 75%. It fails open at 0% — raising the slider is "
    "what closes it — and closing the bypass is what lets suction gas actually go somewhere instead of "
    "recirculating straight back to suction.",
    "Drag the <b>Suction command</b> slider up from 0%. It fails closed at 0%, so raising it opens "
    "the suction valve — watch the Suction readout (footer) and PT_1001 on the P&amp;ID begin to "
    "rise as gas enters the first stage. (This is the step that needed Blowdown closed in step 3 — "
    "otherwise the pressure you're building here just vents straight back out.)",
    "Switch on <b>Idle / rated speed</b> and raise the <b>Speed command</b> slider. Discharge "
    "pressure and flow build across all three stages as the engine comes up toward rated speed — this "
    "is easiest to watch on the <b>Trends</b> tab.",
    "Switch on the <b>Cooler motor</b> tiles once discharge or oil temperatures climb, and watch the "
    "corresponding temperature readouts respond.",
]))
story.append(Paragraph(
    "From here, try the <b>Faults</b> tab (section 7) — with no PLC connected there's nothing to catch "
    "a fault you inject, so this is the clearest way to see exactly what each one does to the process "
    "before you ever need a PLC to react to it.", styles["Body"]))

# ============================================================ 7. FAULTS ====
story.append(Paragraph("7. Injecting faults", styles["H1"]))
story.append(Paragraph(
    "The Faults tab is the primary reason to run this simulator instead of watching a healthy process "
    "animate: it lets you provoke the exact abnormal conditions a PLC's control logic is supposed to "
    "catch, and watch whether it actually does.", styles["Body"]))
story.append(bullets([
    "<b>Lube system</b> — low oil pressure, slow prelube ramp, magnetic pickup (speed signal) loss.",
    "<b>Overspeed offset</b> — bias the reported engine speed high, to test overspeed trip logic "
    "without actually running the model past a safe point.",
    "<b>Discharge blockage</b> — partially or fully block final discharge flow.",
    "<b>Valve stuck</b> — freeze bypass, suction, discharge ESD, or blowdown valve in place.",
    "<b>Engine fail to start</b>, <b>cylinder temperature bias</b>, <b>signal freeze / invalid</b> on "
    "any analog input, <b>cooler motor trip</b>, and <b>link drop</b> (suspends OPC UA writes to "
    "exercise the PLC's own watchdog detection).",
    "<b>Tier 2 discrete inputs</b> — scrubber high level, vibration trip, oil/JW low level, low "
    "fuel gas pressure, lubricator no-flow — simple armed/not-armed switches with no dynamics "
    "behind them, for exercising shutdown logic keyed off a single discrete point.",
]))
story.append(Paragraph(
    "Faults are applied instantly and independently of the Reset action — clearing a fault is a "
    "separate, explicit step on the Faults panel, so a reset never silently masks a fault you're in the "
    "middle of testing.", styles["Body"]))
story.append(Paragraph(
    "The boundary condition panel on the same tab (source pressure, pipeline pressure, suction "
    "temperature, ambient temperature) lets you change the process's external conditions, e.g. to test "
    "startup against a cold suction line or a high pipeline backpressure.", styles["Body"]))

# ============================================================ 8. RESET =====
story.append(Paragraph("8. Resetting the simulation", styles["H1"]))
story.append(Paragraph(
    "The Reset control in the header offers two starting states:", styles["Body"]))
story.append(kv_table([
    ("Blown down", "Unit at atmospheric pressure throughout, valves closed, engine stopped — the "
                   "state after a full shutdown and blowdown sequence."),
    ("Pressurised", "Unit already pressurised and idling — useful for testing load/unload logic "
                    "without waiting through a full startup sequence each time."),
], col_widths=(1.3 * inch, 5.0 * inch)))
story.append(Paragraph(
    "Reset does not clear active faults or disconnect an active OPC UA link — only the process "
    "state itself.", styles["Body"]))

# ============================================================ 9. TROUBLE ===
story.append(Paragraph("9. Troubleshooting", styles["H1"]))

story.append(Paragraph("“Couldn't find the compressor tags on this server”", styles["H2"]))
story.append(Paragraph(
    "Automatic mode connected to the PLC but couldn't find the tag names it expects anywhere in the "
    "tree. This almost always means one of the following:", styles["Body"]))
story.append(numbered([
    "This is the wrong PLC/endpoint for this unit.",
    "The CODESYS project's <b>Symbol Configuration</b> is not published. In CODESYS: right-click the "
    "PLC project → Application → Symbol Configuration → tick the GVL(s) that hold the "
    "compressor's tags → rebuild and download to the controller. Without a published Symbol "
    "Configuration, CODESYS's OPC UA server exposes nothing for the app to browse, regardless of "
    "addressing mode.",
    "The variable names in the PLC project don't match the app's canonical tag names (e.g. "
    "<font face=\"Courier\">PT_1001</font>, <font face=\"Courier\">CMD_4005</font>). Automatic mode "
    "matches by exact name, anywhere in the tree — it doesn't require a specific GVL name or "
    "folder structure, but the tag names themselves must match.",
]))

story.append(Paragraph("Connect fails immediately / “couldn't connect”", styles["H2"]))
story.append(bullets([
    "Confirm the PLC's OPC UA server is running and its port (default 4840) isn't blocked by a firewall "
    "between the two machines.",
    "For “Another device on the network”, confirm the IP address is current — DHCP leases "
    "change. Use <b>Scan my network</b> to re-discover it.",
    "Only one OPC UA client can usually hold certain session types at a time — confirm no other "
    "tool (e.g. UaExpert) is already connected to the same PLC.",
]))

story.append(Paragraph("A previous namespace / browse-path setting is stuck", styles["H2"]))
story.append(Paragraph(
    "If this machine ran an older version of the app before Automatic mode existed, a saved connection "
    "profile from that time may still have <b>Find tags by</b> set to “Browse path” with a "
    "namespace URI or GVL name that no longer matches. Open the Advanced section under the connection "
    "settings and switch <b>Find tags by</b> back to <b>Automatic</b>, then Save.", styles["Body"]))

story.append(Paragraph("Watchdog shows “stale”", styles["H2"]))
story.append(Paragraph(
    "The app independently confirms the PLC connection is alive by polling the server's own clock and "
    "requiring it to actually advance — a call that “succeeds” with a frozen or "
    "cached value does not count. A stale watchdog means the underlying network path or PLC has "
    "actually stopped responding, not a display glitch; the app will force a fail-safe disconnect "
    "shortly after if it doesn't recover.", styles["Body"]))

story.append(Paragraph("App won't open / window never appears", styles["H2"]))
story.append(bullets([
    "This almost always means the Microsoft Edge WebView2 Runtime is missing or failed to install. "
    "Re-run the installer, or install the WebView2 Runtime directly from Microsoft.",
    "Check the log file at <font face=\"Courier\">%LOCALAPPDATA%\\CompressorSim\\logs\\app.log</font> "
    "for the specific error — the app has no console window, so this file is the only place a "
    "startup failure is recorded.",
]))

story.append(Paragraph("Two copies won't both connect to the same PLC", styles["H2"]))
story.append(Paragraph(
    "This is intentional. Two simulator instances writing the same PLC tags at once would put the PLC "
    "into a nondeterministic state, so the app only allows a single running instance per machine.",
    styles["Body"]))

# ============================================================ 10. UNINSTALL
story.append(Paragraph("10. Uninstalling", styles["H1"]))
story.append(Paragraph(
    "Use <b>Settings → Apps → Compressor Simulator → Uninstall</b>, or the "
    "“Uninstall Compressor Simulator” shortcut created in the Start menu alongside the app.",
    styles["Body"]))
story.append(Paragraph(
    "Saved connection profiles and logs live under "
    "<font face=\"Courier\">%LOCALAPPDATA%\\CompressorSim</font> and are not removed automatically; "
    "delete that folder by hand if you want a completely clean slate before reinstalling.",
    styles["Body"]))

story.append(Spacer(1, 20))
story.append(Paragraph(
    "This document accompanies the packaged desktop build of Compressor Simulator and is not a "
    "substitute for the project's engineering specification.", styles["Caption"]))


# --------------------------------------------------------------- LAYOUT ----
PAGE_W, PAGE_H = LETTER
MARGIN = 0.85 * inch


def cover_page(c: canvas.Canvas, doc):
    c.saveState()
    c.setFillColor(INK)
    c.rect(0, PAGE_H - 0.35 * inch, PAGE_W, 0.35 * inch, fill=1, stroke=0)
    c.restoreState()


def body_page(c: canvas.Canvas, doc):
    c.saveState()
    c.setStrokeColor(RULE)
    c.setLineWidth(0.5)
    c.line(MARGIN, PAGE_H - 0.62 * inch, PAGE_W - MARGIN, PAGE_H - 0.62 * inch)
    c.setFont("Helvetica", 8)
    c.setFillColor(MUTED)
    c.drawString(MARGIN, PAGE_H - 0.55 * inch, "Compressor Simulator — User Manual")
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - 0.55 * inch, f"v{VERSION}")
    c.line(MARGIN, 0.55 * inch, PAGE_W - MARGIN, 0.55 * inch)
    c.drawCentredString(PAGE_W / 2, 0.4 * inch, str(doc.page - 1))
    c.restoreState()


class ManualDocTemplate(BaseDocTemplate):
    """Feeds TableOfContents its (level, text, page) entries as each
    heading is actually laid out, via the notify() hook platypus calls
    for every flowable — the only way the TOC's second build pass learns
    real page numbers instead of the guesses a hand-typed TOC would need."""

    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph):
            style = flowable.style.name
            # self.page - 1 to match body_page()'s footer numbering, which
            # skips the unnumbered cover page.
            if style == "H1":
                self.notify("TOCEntry", (0, flowable.getPlainText(), self.page - 1))
            elif style == "H2":
                self.notify("TOCEntry", (1, flowable.getPlainText(), self.page - 1))


doc = ManualDocTemplate(
    str(OUT), pagesize=LETTER,
    leftMargin=MARGIN, rightMargin=MARGIN, topMargin=1.0 * inch, bottomMargin=0.8 * inch,
    title="Compressor Simulator User Manual", author="Compressor Simulator Project",
)
cover_frame = Frame(0, 0, PAGE_W, PAGE_H, id="cover")
body_frame = Frame(MARGIN, 0.8 * inch, PAGE_W - 2 * MARGIN, PAGE_H - 1.8 * inch, id="body")
doc.addPageTemplates([
    PageTemplate(id="cover", frames=[cover_frame], onPage=cover_page),
    PageTemplate(id="body", frames=[body_frame], onPage=body_page),
])

# multiBuild, not build: the TOC flowable needs a first pass to discover
# every heading's real page number, then a second pass to render itself
# with those numbers filled in.
doc.multiBuild(story)
print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB)")
