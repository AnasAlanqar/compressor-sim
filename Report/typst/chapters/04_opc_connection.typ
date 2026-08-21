#import "../template.typ": *

= Connecting to a PLC over OPC UA <opc-connection>

With no PLC connected, the simulator runs on its own — the compressor train sits
stopped and blown down, and every command tile in the Overrides dock is live and
editable.

#fig("/images/opc/fig01_hmi_home_compressor_train_stopped.png",
  [Compressor Simulator with no PLC connected: the compressor train stopped and
   blown down, all suction/discharge ESD and blowdown valves in their fail-safe
   position, and the Overrides dock open and editable on the right.])

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

== Once Connected: Overrides Become Read-Only

With a PLC connected, every tile that used to accept manual input in the Overrides
dock is grayed out and shows the PLC's own commanded value instead — a banner
across the top of the dock states this explicitly. The PLC is now the only thing
driving the simulation; the simulator no longer accepts manual commands for
anything the PLC owns.

#fig("/images/opc/fig05_hmi_home_opc_connected_readonly_overrides.png",
  [Overrides dock once connected: "OPC UA connected — the PLC is driving. These are
   read-only indicators," with every tile reflecting the PLC's commanded value
   (Speed command 75%, Bypass command 100%, etc.) instead of accepting input.])

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
