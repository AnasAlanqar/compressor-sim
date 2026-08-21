#import "../../template.typ": *

= Troubleshooting <troubleshooting>

*App window never opens, or closes immediately.* Read
`%LOCALAPPDATA%\CompressorSim\logs\app.log` first — the app has no console window, so this file
is the only place startup errors go.

*"Windows protected your PC" (SmartScreen) on first run.* Expected — the installer is not
code-signed. Click "More info" → "Run anyway" (@installation).

*Message box: "could not start its window... WebView2 Runtime."* The installer should have
silently installed WebView2 already. If this still appears, install it manually from Microsoft's
WebView2 page and relaunch. Windows 11 ships WebView2 built in, so this should only occur on
older Windows 10 builds.

*"Another instance is already running" but no window is visible.* A previous run crashed without
releasing its lock in an unusual way (the app checks whether the previous process is actually
still alive before refusing to start, so this should self-heal). If it persists, open Task
Manager, end any `CompressorSim.exe` process, and relaunch.

*OPC UA endpoint unreachable.* The Connect to a PLC dialog will not reach "Connected." Confirm
the endpoint in `config.yaml` (@opc-connection) is correct, that the target CODESYS runtime or
panel is actually running its OPC UA server, and that the machine is reachable on the network
(for a remote target, try _Scan my network_ to confirm it is visible at all). `app.log` records
the underlying connection failure.

*Tags not found on an otherwise-reachable server.* The app connects but reports missing tags,
e.g. _"couldn't find the compressor tags on this server (N missing, e.g. ...). Is this the right
PLC, and is its Symbol Configuration published?"_ This means the CODESYS project's Symbol
Configuration has not been published, so the tag names the simulator looks for are not visible in
the server's browsable address space — publish it and reconnect.

*Stale behaviour after a PLC program change.* If a CODESYS project was re-Downloaded to the
runtime after the simulator connected, its OPC UA address space and node references may have
changed underneath the existing connection (@opc-connection). Reconnect (or restart the app) to
force it to re-discover tags rather than hold references into the address space as it existed
before the Download.

== First-Time PLC Engineer: Likely Early Mistakes

*Runtime not actually started.* A CODESYS project can be open and downloaded in the IDE without
the runtime application actually running (@opc-connection shows "Application [run]" in green as
the thing to check) --- a stopped application still leaves the OPC UA server up, so the connection
can succeed while nothing responds to commands.

*Symbol Configuration not published.* The single most common "connects but no tags" cause
(@opc-connection, @troubleshooting above) --- easy to miss because the connection itself succeeds.

*Device security settings left at default.* Both `CommunicationMode` and `Activation` default to
values that block external OPC UA clients (@opc-connection, "Symbol Publishing and Device
Security Settings"); a fresh CODESYS install needs both changed explicitly.

*Simulator connected before the day's project Download.* Reconnect after every Download
(@opc-connection) --- an existing connection can hold stale node references silently rather than
failing outright.

*Command appears "locked."* Once a PLC is connected, the Overrides dock becomes read-only by
design (@sec-interface) --- this is not a bug, and is the expected state whenever a PLC is
actively driving the simulation.

*Wrong command polarity assumed.* Writing `TRUE` to `CMD_4009` expecting the suction ESD to close,
or driving `FC_3002` to 100% expecting the bypass to open, produces the opposite of the intended
result --- see @sec-plc-interface, "Important: Command Polarity."

*Blowdown or bypass behaviour misunderstood.* Expecting discharge pressure to collapse the moment
blowdown opens is the most common first-read misunderstanding of this simulator's process model
--- see @sec-plc-interface, "Blowdown," and the underlying mechanism in @sec-process.

*Simulator appears stuck at rest because one required command is missing.* The permissive chain in
@sec-running has several prerequisites (ESD healthy, driven-equipment-ready, etc.) before speed or
valve commands do anything visible --- a single missing upstream command can make the whole chain
appear unresponsive.

*Speed does not increase despite a start command.* Usually means one of the engine-start
prerequisites (@sec-running, step 2) is not actually asserted, not that the command itself failed.

*Pressures do not behave as expected.* Often traced to the suction/discharge/bypass valve path
being in an unintended state --- confirm all relevant valve commands and limit switches
(@sec-plc-interface cheat sheet) before assuming a physics issue.

*PLC logic waits indefinitely.* Check the Faults tab (@sec-faults) --- an injected fault (e.g.
slow lube build) can be the reason a permissive never crosses its threshold, not a logic error.

*Heartbeat not actually supervised.* Reading `WD_6001` without checking that it changes over time
gives no protection against a stalled link --- see @sec-plc-interface, "Watchdog and Communication
Supervision."
