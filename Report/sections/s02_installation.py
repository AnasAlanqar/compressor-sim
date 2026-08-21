"""Section 2 — Installation walkthrough, built from the screenshots in
images/installation/. Each figure below was inspected directly (not just
matched by filename) to confirm what it actually shows before writing a
caption for it.

The photos show installer build CompressorSim-Setup-0.6.3-pilot, an
unsigned (Inno Setup) build — hence the Microsoft Defender SmartScreen
detour in steps 4-5, which is expected for any unsigned installer and not
a defect in the app itself.
"""
from pathlib import Path

from common.styles import bullets, figure, numbered, styles, warn
from reportlab.platypus import Paragraph, Spacer

IMG = Path(__file__).resolve().parent.parent / "images" / "installation"


def build():
    story = []
    story.append(Paragraph("2. Installing the desktop application", styles["H1"]))
    story.append(Paragraph(
        "The application is distributed as a single zipped installer, "
        "<font face=\"Courier\">CompressorSim-Setup-&lt;version&gt;.zip</font>. No other files or "
        "runtime need to be downloaded separately — the installer bundles everything the app needs "
        "except the Microsoft Edge WebView2 Runtime, which it installs automatically on first run if "
        "the machine doesn't already have it.", styles["Body"]))

    story.append(Paragraph("2.1 Extract the installer", styles["H2"]))
    story.append(Paragraph(
        "Start with the zip file wherever it was downloaded to — the desktop, in this walkthrough.",
        styles["Body"]))
    story.append(figure(IMG / "a desktop that has the file zipped .png",
                         "The downloaded installer archive on the desktop, before extraction."))
    story.append(Paragraph(
        "Right-click the zip file and choose <b>Extract All…</b> from the context menu.", styles["Body"]))
    story.append(figure(IMG / "a picture that shows the zipped file's menu where the extract all command is pointed out by an arrow.png",
                         "Right-click context menu on the zip file, with Extract All… selected."))
    story.append(Paragraph(
        "This produces a folder next to the zip file with the same name. The installer executable is "
        "inside it.", styles["Body"]))
    story.append(figure(IMG / "pciture that has the zipped and the extracted folder below it .png",
                         "The zip file and the resulting extracted folder shown together on the desktop."))
    story.append(figure(IMG / "picture that shows the installer in the folder.png",
                         "Inside the extracted folder: the installer executable, "
                         "CompressorSim-Setup-0.6.3-pilot.exe."))

    story.append(Paragraph("2.2 Run the installer", styles["H2"]))
    story.append(Paragraph("Double-click the installer executable to launch it.", styles["Body"]))
    story.append(warn(
        "Because this build is not code-signed, Windows will show a Microsoft Defender SmartScreen "
        "warning the first time it runs. This is expected for any unsigned installer, not a sign "
        "something is wrong — proceed past it as shown below."))
    story.append(figure(IMG / "the microsoft defender smartscreen  and it has an arrow on the more info snetence.png",
                         "SmartScreen's initial warning. Click “More info” to reveal the run-anyway option."))
    story.append(figure(IMG / "still the smartscreen but now after we clicked the more info and the run anyway button appeared  s.png",
                         "After clicking “More info,” SmartScreen identifies the app and publisher "
                         "and reveals the “Run anyway” button."))
    story.append(Paragraph(
        "Click <b>Run anyway</b>. The Inno Setup installer wizard opens; step through it with the "
        "default options (Next → Next → Install → Finish). The install runs per-user and "
        "does not require administrator rights.", styles["Body"]))
    story.append(figure(IMG / "after the run anyway button is clicked then the installer page appeared and the next steps are next  till it finishes.png",
                         "The installer wizard's destination-folder step. Defaults are appropriate for "
                         "almost all installs; click Next through the remaining pages to finish."))
    story.append(bullets([
        "Leave “Create a desktop shortcut” checked if you want one.",
        "At least 92.1 MB of free disk space is required, per the installer's own check.",
    ]))

    story.append(Paragraph("2.3 First launch", styles["H2"]))
    story.append(Paragraph(
        "Once installation finishes, a Compressor Simulator shortcut appears on the desktop (and in the "
        "Start menu).", styles["Body"]))
    story.append(figure(IMG / "desktop again with the app shortcut on it .png",
                         "The desktop after installation completes, showing the new Compressor Simulator "
                         "shortcut alongside the original installer files."))
    story.append(Paragraph(
        "Double-clicking the shortcut opens the application window. The simulation starts running "
        "immediately with default boundary conditions and no PLC connected — the P&amp;ID, live "
        "instrument readouts, and the Overrides/Faults/Tags tool dock on the right are all visible "
        "and interactive before any OPC UA link is made.", styles["Body"]))
    story.append(figure(IMG / "after you double click on the application  the compressor window appear .png",
                         "Compressor Simulator on first launch: the ARIEL JGH/4 P&ID with the compressor "
                         "train stopped and blown down, and the Overrides tool dock open on the right."))

    story.append(Paragraph(
        "Installation is now complete. Connecting this instance to a PLC over OPC UA is covered in "
        "Section 3.", styles["Body"]))

    story.append(Spacer(1, 4))
    return story
