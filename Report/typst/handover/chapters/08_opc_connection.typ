#import "../../template.typ": *

= Connecting to a PLC over OPC UA <opc-connection>

With no PLC connected, the simulator runs on its own — the compressor train sits stopped and
blown down, and every command tile in the Overrides dock is live and editable (@fig-hmi-stopped
shows this state).

#fig("/images/opc/fig01_hmi_home_compressor_train_stopped.png",
  [Compressor Simulator with no PLC connected: the compressor train stopped and
   blown down, all suction/discharge ESD and blowdown valves in their fail-safe
   position, and the Overrides dock open and editable on the right.])

== The OPC UA Endpoint in `config.yaml`

The endpoint is set under `opcua:` in the editable config
(`%LOCALAPPDATA%\CompressorSim\config.yaml`, @installation):

```yaml
opcua:
  endpoint: "opc.tcp://localhost:4840"
  namespace_uri: "urn:symbolset:Device:Application:Symbol Set"
  browse_path_prefix: ["{ns}:Symbol Set", "{ns}:GVL_PLC"]
  watchdog_timeout_s: 2.0
  node_addressing: "auto"
```

For a PLC on the same machine, leave `endpoint` at `opc.tcp://localhost:4840`. For a PLC on
another device — a networked CODESYS PC or a physical panel — change the host, e.g.
`opc.tcp://172.20.10.2:4840`. `node_addressing: "auto"` (the default) searches the server's whole
address space for the simulator's known tag names and needs no `namespace_uri` or
`browse_path_prefix` configuration for a standard CODESYS target; those two keys, and
`node_id_pattern`, exist only for non-standard servers or as a manual override. The app needs to
be restarted after any change to `endpoint` (or any other `opcua:` key) in `config.yaml`, since
there is no live endpoint-switching control in the current UI.

== Opening the Connect to a PLC Dialog

Click the settings icon next to the connection status in the header to open
*Connect to a PLC*. The dialog shows the current connection state, a _Where is the
PLC?_ choice, and an Advanced section (collapsed by default) for tag-discovery
settings.

#fig("/images/opc/fig02_hmi_connect_to_plc_dialog.png",
  [The Connect to a PLC dialog in its default, not-connected state.])

== This Computer

Selecting *This computer* targets a CODESYS runtime running on the same machine as
the simulator, at `opc.tcp://localhost:4840` — the common case for bench testing.

#fig("/images/opc/fig03_hmi_connect_to_plc_local_option.png",
  ["This computer" selected as the PLC location.])

Clicking *Connect* establishes the link. Once connected, the dialog shows the live
status and endpoint, and the header's OPC UA indicator and endpoint text update to
match — here the engine has already been started and is running at 75% speed,
driven entirely by the PLC.

#fig("/images/opc/fig04_hmi_connect_to_plc_connected_state.png",
  [Connected to a local CODESYS runtime. The dialog shows "Connected — this
   computer"; the header's connection dot and endpoint reflect the same state.])

== Another Device on the Network

For a physical panel or a separate PC, select *Another device on the network* and
either type its IP address directly or click *Scan my network* to discover OPC UA
servers advertising themselves on the local subnet.

#fig("/images/opc/fig06_hmi_connect_to_plc_network_scan_results.png",
  [Results of Scan my network: OPC UA servers discovered on the local subnet, each
   listed with its hostname and IP address.])

Selecting a discovered server fills in its address automatically.

#fig("/images/opc/fig07_hmi_connect_to_plc_selected_network_server.png",
  [A discovered server's address populated into the connection field after
   selecting it from the scan results.])

Clicking *Connect* links to that remote CODESYS runtime the same way as the local
case, just at a routable IP address instead of localhost.

#fig("/images/opc/fig08_hmi_connect_to_plc_connected_remote_codesys.png",
  [Connected to a remote CODESYS runtime at 172.20.10.2 — the dialog and header
   both reflect the non-localhost endpoint.])

== Confirming the Link Is Up

Once connected, every tile that used to accept manual input in the Overrides dock is grayed out
and shows the PLC's own commanded value instead — a banner across the top of the dock states
this explicitly.

#fig("/images/opc/fig05_hmi_home_opc_connected_readonly_overrides.png",
  [Overrides dock once connected: "OPC UA connected — the PLC is driving. These are
   read-only indicators," with every tile reflecting the PLC's commanded value
   (Speed command 75%, Bypass command 100%, etc.) instead of accepting input.])

On the log side, `app.log` records the connection lifecycle; a successful connect and any link
loss are both written there, which is the place to check when the UI status alone is ambiguous
(@troubleshooting).

== What Happens on Link Loss

The app increments a watchdog counter every 500 ms; if the peer's counter (or, on the app's own
side, the OPC UA server's time source) stops advancing for `watchdog_timeout_s` (2.0 s by
default), the link is declared failed and every command tag reverts to its documented fail value
(the complete list is Appendix A):

#data-table(
  ([Command], [Fail value], [Physical result]),
  (
    ([`SC_3001` (speed)], [0], [Speed command drops to zero]),
    ([`FC_3002` (bypass)], [0], [Bypass valve *opens* (fails open)]),
    ([`FC_3003` (suction valve)], [0], [Suction valve *closes* (fails closed)]),
    ([`CMD_4004` (blowdown solenoid)], [off], [Blowdown valve *opens* (fails open)]),
    ([All remaining discrete command tags], [off], [ESDs close, cooler/lube commands drop, start command drops]),
  )
)

"All remaining discrete command tags" above means every command tag not listed individually:
`CMD_4005`, `CMD_4006`, `CMD_4008`, `CMD_4009`, `CMD_4010`, `CMD_4001`, `CMD_4003`, `CMD_4011`,
`CMD_4012`.

This mirrors a real fail-safe package: on loss of signal, the ESDs shut and the blowdown opens,
venting the unit (@sec-process's mass-accumulation asymmetry governs how that unfolds). Operator
pushbuttons (`PB_5001`, `PB_5003`, `PB_5004`, `ESD_5002`) stay live and unaffected by link state,
since on the real unit these are hardwired to the PLC, not routed through this link.

== The CODESYS Side: Bringing the Runtime Online

The screenshots above are of the simulator; connecting also requires a CODESYS
runtime actually running and serving OPC UA. This is the walkthrough for a CODESYS
Control Win V3 runtime on a bench laptop.

+ Launch the *CODESYS Control Win V3 - x64* runtime (search for it from the Start
  menu if it isn't already running as a tray application).
+ Open the CODESYS IDE project and check *Communication Settings* under the Device
  node — this shows the gateway and the target device (here, DESKTOP-KC0FH83,
  reached via localhost:1217), confirming the IDE can see the runtime before
  attempting to log in.
+ Click *Login* (Alt+F8) on the toolbar to connect the IDE to the running
  application.

#fig("/images/opc/fig11_windows_search_codesys_control_win_v3.png",
  [Launching the CODESYS Control Win V3 - x64 runtime from Windows search.])

#fig("/images/opc/fig09_codesys_ide_communication_settings.png",
  [The CODESYS IDE's Communication Settings tab, showing the gateway (Gateway-1,
   localhost:1217) and the active target device, DESKTOP-KC0FH83.])

#fig("/images/opc/fig10_codesys_login_button_tooltip.png",
  [The Login (Alt+F8) toolbar button, which connects the IDE to the running
   application on the target device.])

The runtime's own console confirms its OPC UA server started and which endpoint
it's listening on — this is the endpoint the simulator's Connect to a PLC dialog
needs to reach.

#fig("/images/opc/fig12_codesys_runtime_console_log_opcua_started.png",
  [CODESYS Control Win V3 console log at startup: "OPC UA Server Started,"
   listening at `opc.tcp://DESKTOP-KC0FH83:4840`.])

Logging in for the first time prompts for device-user credentials before the IDE is
allowed to view or download to the device.

#fig("/images/opc/fig13_codesys_device_user_login_prompt.png",
  [CODESYS's Device User Login prompt, requesting credentials with sufficient
   rights to view the Device object.])

Once logged in, the Devices tree shows the device as connected and the application
as running (both highlighted green), confirming the PLC program is actually
executing and not just downloaded.

#fig("/images/opc/fig14_codesys_ide_online_application_running.png",
  [CODESYS IDE online: "Device [connected]" and "Application [run]" both shown in
   green in the Devices tree.])

The full CODESYS engineering-environment procedure — installing the runtime, configuring the
project, the complete login sequence — is documented in the predecessor report,
`Report/1st_draft_report.pdf`, Part II §0.10, and is not reproduced here.

== Symbol Publishing and Device Security Settings

If the target is a CODESYS soft-PLC, its Symbol Configuration needs to be published for the
connection to work — the simulator's `node_addressing: "auto"` mode locates tags by browsing the
server's exposed symbol set, and an unpublished symbol set means none of the compressor tags are
visible over OPC UA even though the application logic is running correctly. A Download to the
PLC regenerates its address space and invalidates any node references the client cached from
before the Download; reconnecting (or restarting the simulator) afterward makes it re-discover
tags rather than hold stale references. This is a general OPC UA characteristic, not specific to
CODESYS, and applies the same way to a physical panel's OPC UA server after a program change.

The device tree of a CODESYS Control Win project (Device --- PLC Logic --- Application ---
Communication Manager --- OPC UA Server) is where the Symbol Publishing object controlling which
global variables are exposed as OPC UA nodes lives, alongside the Communication Settings tab used
earlier to confirm the gateway and target device.

#fig("/images/12_codesys_project_overview.png",
  [CODESYS Devices tree for a project with symbol publishing configured, and the Communication
   Settings tab showing the active target device.])

Two device-level settings gate every OPC UA client — this application included — and both
default to values that *block* connections, so both must be changed explicitly on a fresh
CODESYS install:

+ *Device Security Settings* (Device menu --- Security Settings…): `CommunicationMode` must be
  set to `ALL` (the default restricts which channels are permitted and blocks external client
  connections) and `Activation` must be set to `ACTIVATED` (this also defaults to a
  connection-blocking state).

#fig("/images/12_codesys_security_settings_menu.png",
  [Menu location for Device Security Settings, under the Device dropdown.])

#fig("/images/12_codesys_device_security_settings.png",
  [Device Security Settings dialog with the two required non-default values:
   `CommunicationMode = ALL`, `Activation = ACTIVATED`, under `CmpOPCUAServer`.])

+ *Runtime Security Policy* (Device menu --- Change Runtime Security Policy…): encryption set to
  *Optional*, *Code Signing = All*, user management set to *Optional*, and *Allow anonymous
  login* enabled — anonymous login lets a registered OPC UA client connect without credentials
  even if user management is otherwise on.

#fig("/images/12_codesys_runtime_security_policy_menu.png",
  [Menu location for the Runtime Security Policy, under the Device dropdown.])

#fig("/images/12_codesys_runtime_security_policy.png",
  [Runtime Security Policy dialog: Optional encryption, Code Signing = All, Optional user
   management, Allow anonymous login enabled.])

Both device-level settings default to values that block connections, so the runtime can appear to
start normally while silently refusing every incoming OPC UA client, including this application.
If the app cannot connect and `app.log` shows no response from an endpoint that is otherwise
reachable, these two dialogs are the first place to check.

== Verifying the Link: Forcing a Tag from the PLC Side <verify-link>

The clearest proof the OPC UA link is actually live — not just "connected" in
name — is changing a value in CODESYS and watching it move on the simulator's HMI.
`CMD_4005` (CAT engine start command) in the `GVL_PLC` global variable list is a
convenient one to force, since it drives a visible indicator on the P&ID.

#fig("/images/opc/fig15_codesys_gvl_plc_tag_list_cat_start_selected.png",
  [GVL_PLC in the CODESYS IDE with CMD_4005 ("CAT engine start command") selected,
   currently FALSE.])

#fig("/images/opc/fig16_hmi_home_cat_start_off_stopped.png",
  [Simulator HMI immediately before the force: CMD_4005 is still FALSE on the PLC
   side, and the header shows the engine STOPPED.])

Forcing `CMD_4005` to TRUE in CODESYS (right-click the value → Force Value, or set
it directly in a running application) writes the change to the PLC's own memory —
from there the simulator picks it up over the OPC UA link exactly as it would from
real control logic.

#fig("/images/opc/fig17_codesys_gvl_plc_cat_start_true.png",
  [CMD_4005 forced to TRUE in the CODESYS GVL_PLC watch view.])

#fig("/images/opc/fig18_hmi_home_cat_start_true_from_plc.png",
  [The simulator HMI shortly after the force: CMD_4005 is now TRUE, sourced
   entirely from the PLC-side change — nothing was clicked in the simulator itself.
   The engine still reports STOPPED here, since the start command alone doesn't
   spin the engine without the rest of the sequence (ESD healthy, driven-equipment
   ready, idle/rated-speed selection) also being asserted.])

This is the same mechanism used to test control logic: whatever a real PLC program
forces or computes onto its outputs is what the simulator reacts to, tag by tag.
