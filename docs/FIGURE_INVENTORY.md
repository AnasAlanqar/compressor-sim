# Figure inventory — handover report

Every image asset found in the repo (`docs/`, `Report/`, `assets/`, `frontend/public/`,
`.local/`, and similarly named directories), what it shows, and where (if anywhere) it is used
in `docs/Compressor_Simulator_Handover_Report.md`. Compiled by opening each candidate file and
comparing it against the current application (this repo is mid-restyle — branch
`feat/hmi-isa101-restyle` — so several older captures no longer match the running UI).

## Usable — used in the report

All of the following are current (captured against the present HMI, per `Report/report_figures_context.md` and this review), well-captioned by their own filenames, and are referenced directly in the handover report with real relative paths.

### Installation (`Report/images/installation/`) — Part II.1

| Filename | Shows | Used as |
|---|---|---|
| `a desktop that has the file zipped .png` | Downloaded installer zip on the desktop | Fig. — installer archive before extraction |
| `a picture that shows the zipped file's menu where the extract all command is pointed out by an arrow.png` | Right-click context menu, "Extract All…" highlighted | Fig. — extracting the archive |
| `pciture that has the zipped and the extracted folder below it .png` | Zip and resulting extracted folder together | Fig. — extracted folder |
| `picture that shows the installer in the folder.png` | Installer `.exe` inside the extracted folder | Fig. — installer executable located |
| `the microsoft defender smartscreen  and it has an arrow on the more info snetence.png` | SmartScreen warning, "More info" highlighted | Fig. — SmartScreen first warning |
| `still the smartscreen but now after we clicked the more info and the run anyway button appeared  s.png` | SmartScreen after "More info," "Run anyway" visible | Fig. — SmartScreen run-anyway |
| `after the run anyway button is clicked then the installer page appeared and the next steps are next  till it finishes.png` | Inno Setup wizard, destination-folder step | Fig. — installer wizard |
| `desktop again with the app shortcut on it .png` | Desktop after install, new shortcut present | Fig. — post-install desktop |
| `after you double click on the application  the compressor window appear .png` | App on first launch: P&ID stopped/blown down, Overrides dock open | Fig. — first launch |

### OPC UA connection (`Report/images/opc/`) — Part II.2

| Filename | Shows | Used as |
|---|---|---|
| `fig01_hmi_home_compressor_train_stopped.png` | Home screen, no PLC connected, train stopped/blown down | Fig. — disconnected state |
| `fig02_hmi_connect_to_plc_dialog.png` | "Connect to a PLC" dialog, default state | Fig. — connect dialog |
| `fig02b_hmi_connect_to_plc_network_scan_results_alt.png` | Alternate network-scan result set | Not used (redundant with fig06; kept as spare, per the context doc's own note) |
| `fig03_hmi_connect_to_plc_local_option.png` | "This computer" selected | Fig. — local connection mode |
| `fig04_hmi_connect_to_plc_connected_state.png` | Connected locally, engine running at 75% under PLC control | Fig. — connected (local) |
| `fig05_hmi_home_opc_connected_readonly_overrides.png` | Overrides dock read-only banner once connected | Fig. — read-only overrides |
| `fig06_hmi_connect_to_plc_network_scan_results.png` | Network scan results, 3 discovered servers | Fig. — network scan |
| `fig07_hmi_connect_to_plc_selected_network_server.png` | Scanned server address populated into the field | Fig. — server selected |
| `fig08_hmi_connect_to_plc_connected_remote_codesys.png` | Connected to remote CODESYS at 172.20.10.2 | Fig. — connected (remote) |
| `fig09_codesys_ide_communication_settings.png` | CODESYS IDE Communication Settings tab | Fig. — CODESYS communication settings |
| `fig10_codesys_login_button_tooltip.png` | CODESYS Login (Alt+F8) toolbar button | Fig. — CODESYS login control |
| `fig11_windows_search_codesys_control_win_v3.png` | Windows Start-menu search for the runtime | Fig. — launching the runtime |
| `fig12_codesys_runtime_console_log_opcua_started.png` | Runtime console confirming OPC UA server started | Fig. — runtime log confirmation |
| `fig13_codesys_device_user_login_prompt.png` | CODESYS device-user login prompt | Fig. — device login |
| `fig14_codesys_ide_online_application_running.png` | Device/Application both green (connected/running) | Fig. — application online |
| `fig15_codesys_gvl_plc_tag_list_cat_start_selected.png` | GVL_PLC tag list, CMD_4005 selected, FALSE | Fig. — before-force tag state |
| `fig16_hmi_home_cat_start_off_stopped.png` | HMI at the same moment: CMD_4005 off, engine stopped | Fig. — before-force HMI state |
| `fig17_codesys_gvl_plc_cat_start_true.png` | CMD_4005 forced TRUE in CODESYS | Fig. — after-force tag state |
| `fig18_hmi_home_cat_start_true_from_plc.png` | HMI reflecting CMD_4005 TRUE from the PLC | Fig. — after-force HMI state (proof of live link) |

### Operator interface / features (`Report/images/features/`) — Part II.3

| Filename | Shows | Used as |
|---|---|---|
| `fig20_hmi_home_dark_theme_running.png` | Dark theme, unit running under PLC control, all stages RUN | Fig. — home screen, running, dark theme |
| `fig23_hmi_status_feedback_readonly.png` | Status Feedback (read-only) panel | Fig. — status feedback panel |
| `fig24_hmi_operator_ecu_inputs_always_live.png` | Operator/ECU inputs, always-live panel | Fig. — always-live operator inputs |
| `fig21_hmi_faults_tab_engine_process.png` | Faults tab — Engine and Process groups | Fig. — engine/process faults |
| `fig26_hmi_faults_cylinder_bias_cooler_scrubber.png` | Cylinder temp bias, cooler trip, scrubber-level faults | Fig. — cylinder/cooler/scrubber faults |
| `fig25_hmi_tags_vibration_oil_lubricator_tier2.png` | Tier 2 vibration/oil-level/lubricator faults | Fig. — Tier 2 protective faults |
| `fig27_hmi_faults_signal_freeze_invalid_link_drop.png` | Signal freeze/invalid matrix, Link drop, Instrumentation | Fig. — signal freeze/invalid/link drop |
| `fig22_hmi_faults_tab_instrumentation_boundary_conditions.png` | Signal lag/noise, Boundary Conditions sliders | Fig. — instrumentation & boundary conditions |
| `fig28_hmi_tags_tab_live_values_list.png` | Tags tab, full flat tag list | Fig. — Tags tab |
| `fig19_hmi_engineering_trends_pressures.png` | Engineering Trends, 4 pressure pens over 30 min | Fig. — Engineering Trends |

### CODESYS symbol publishing / device security (`Report/images/`, top level) — Part II.2

Added by the user for this revision; verified against the predecessor report's Part III §0.4–0.6
(`Report/1st_draft_report.pdf`, pp. 54–57), which documents the same dialogs with the same
non-default values (`CommunicationMode = ALL`, `Activation = ACTIVATED`; Runtime Security Policy:
Optional encryption, Code Signing = All, Optional user management, anonymous login enabled).

| Filename | Shows | Used as |
|---|---|---|
| `12_codesys_project_overview.png` | CODESYS Devices tree with symbol publishing configured + Communication Settings tab | Fig. — CODESYS project/device tree overview |
| `12_codesys_security_settings_menu.png` | Device menu → Security Settings… menu location | Fig. — Device Security Settings menu |
| `12_codesys_device_security_settings.png` | Device Security Settings dialog: `CommunicationMode = ALL`, `Activation = ACTIVATED` | Fig. — Device Security Settings dialog |
| `12_codesys_runtime_security_policy_menu.png` | Device menu → Change Runtime Security Policy… menu location | Fig. — Runtime Security Policy menu |
| `12_codesys_runtime_security_policy.png` | Runtime Security Policy dialog: Optional encryption, Code Signing = All, Optional user management, anonymous login | Fig. — Runtime Security Policy dialog |

### PLC sequencer reference (`Report/images/`, top level) — Part II.4

| Filename | Shows | Used as |
|---|---|---|
| `11_plc_sequencer_state_diagram.png` | The predecessor Simulink/CODESYS rig's full sequencer state machine (READY/PURGE/BLOWDOWN/.../RUNNING/SHUTDOWN/USD) | Fig. — reference-only sequencer diagram in "Running the Simulator," captioned to make clear this application implements none of it |

**Total usable, current figures: 42** (9 installation + 18 OPC/CODESYS + 10 features + 5 CODESYS
symbol/security + 1 sequencer diagram, minus 1 spare = 42; the spare `fig02b` is listed but
intentionally not placed in the report body).

## Not used — stale or superseded

| Filename | Path | Why excluded |
|---|---|---|
| `dark.png` | `docs/hmi/` | Older HMI layout (top alarm banner, right-hand Trends panel) superseded by the current ISA-101-style restyle shown in the `features/` and `opc/` captures above. Opened and confirmed it does not match the running app. |
| `light.png` | `docs/hmi/` | Same superseded layout, light theme. Not used for the same reason. |
| `legacy.png` | `docs/hmi/` | Filename self-identifies as legacy; same superseded layout as above. |
| `screen-all.png`, `screen-app.png`, `screen-current.png`, `screen-fresh.png`, `screen-revised.png`, `screen-trends.png` | `.local/` | Ad hoc developer working screenshots taken during the HMI restyle (`.local/` is a scratch/working directory, not a documentation asset directory). Superseded by the curated, captioned figures in `Report/images/`. |
| `icon_source.png` | `assets/` | Application icon source art (used to build `assets/icon.ico`), not a screenshot — not relevant to any report section. |

## Missing figures

None. Every section of the handover report that needs a figure has one available in
`Report/images/`; no `[MISSING FIGURE: ...]` markers were required.

One gap exists but is intentionally *not* filled with a screenshot: no figure documents a full
run/unload/stop cycle end-to-end on a single screen (Part II.4, "Running the Simulator"), since
that is a multi-minute transient better described in prose against the existing P&ID figures
than captured as a single static image — the section instead opens with the predecessor
sequencer state diagram for context. If a future revision wants a live-cycle screenshot, the
natural candidate is a two-panel before/after pair (stopped vs. running, both already available
as fig01 and fig20) rather than a new capture.
