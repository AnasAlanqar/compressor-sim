#import "../../template.typ": *

#part[Part II --- Using the Simulator]

= Installation <installation>

The application is distributed as a single zipped installer,
`CompressorSim-Setup-<version>.zip`. No other files or runtime need to be
downloaded separately — the installer bundles everything the app needs except the
Microsoft Edge WebView2 Runtime, which it installs automatically on first run if the
machine doesn't already have it.

== Extract the Installer

Start with the zip file wherever it was downloaded to — the desktop, in this
walkthrough.

#fig("/images/installation/a desktop that has the file zipped .png",
  [The downloaded installer archive on the desktop, before extraction.])

Right-click the zip file and choose *Extract All…* from the context menu.

#fig("/images/installation/a picture that shows the zipped file's menu where the extract all command is pointed out by an arrow.png",
  [Right-click context menu on the zip file, with Extract All… selected.])

This produces a folder next to the zip file with the same name. The installer
executable is inside it.

#fig("/images/installation/pciture that has the zipped and the extracted folder below it .png",
  [The zip file and the resulting extracted folder shown together on the desktop.])

#fig("/images/installation/picture that shows the installer in the folder.png",
  [Inside the extracted folder: the installer executable, CompressorSim-Setup-<version>.exe.])

== Run the Installer

Double-click the installer executable to launch it. Because this build is not code-signed,
Windows shows a Microsoft Defender SmartScreen warning the first time it runs — this is expected
for any unsigned installer, not a sign something is wrong.

#fig("/images/installation/the microsoft defender smartscreen  and it has an arrow on the more info snetence.png",
  [SmartScreen's initial warning. Click "More info" to reveal the run-anyway option.])

#fig("/images/installation/still the smartscreen but now after we clicked the more info and the run anyway button appeared  s.png",
  [After clicking "More info," SmartScreen identifies the app and publisher and
   reveals the "Run anyway" button.])

Click *Run anyway*. The Inno Setup installer wizard opens; step through it with the
default options (Next → Next → Install → Finish). The install runs per-user and
does not require administrator rights.

#fig("/images/installation/after the run anyway button is clicked then the installer page appeared and the next steps are next  till it finishes.png",
  [The installer wizard's destination-folder step. Defaults are appropriate for
   almost all installs; click Next through the remaining pages to finish.])

- Leave "Create a desktop shortcut" checked if you want one.
- At least 92.1 MB of free disk space is required, per the installer's own check.

== First Launch

Once installation finishes, a Compressor Simulator shortcut appears on the desktop
(and in the Start menu).

#fig("/images/installation/desktop again with the app shortcut on it .png",
  [The desktop after installation completes, showing the new Compressor Simulator
   shortcut alongside the original installer files.])

Double-clicking the shortcut opens the application window. The simulation starts
running immediately with default boundary conditions and no PLC connected — the
P&ID, live instrument readouts, and the Overrides/Faults/Tags tool dock on the
right are all visible and interactive before any OPC UA link is made.

#fig("/images/installation/after you double click on the application  the compressor window appear .png",
  [Compressor Simulator on first launch: the ARIEL JGH/4 P&ID with the compressor
   train stopped and blown down, and the Overrides tool dock open on the right.]) <fig-hmi-stopped>

== Where Things Live Once Installed

#kv-table((
  ("App files", "%LOCALAPPDATA%\\Programs\\Compressor Simulator\\"),
  ("Editable config", "%LOCALAPPDATA%\\CompressorSim\\config.yaml — not the bundled default installed with the app. This file is copied from the bundled default the first time the app runs; edit this copy to change the PLC endpoint or any other parameter. The app never touches its own bundled copy."),
  ("Logs", "%LOCALAPPDATA%\\CompressorSim\\logs\\app.log (rotates, keeps the last 3 files)"),
))

Installation is now complete. Connecting this instance to a PLC over OPC UA is
covered in @opc-connection.
