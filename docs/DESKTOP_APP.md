# Desktop app — build & troubleshooting (Windows)

Everything here runs on the Windows laptop. You should never need to come
back to a Linux/Ubuntu box for any of this.

There are two different things people mean by "install this app" — keep
them separate:

- **You, building a release** — needs Python + Node + Inno Setup, one time,
  on your machine. Produces one file.
- **Everyone else, using the app** — needs nothing. They get the one file
  you built, double-click it, Next → Next → Finish.

---

## One-time setup (only on the machine that builds releases)

1. Install [Python 3.10+](https://www.python.org/downloads/) — tick "Add
   python.exe to PATH" during install.
2. Install [Node.js LTS](https://nodejs.org/).
3. Install [Inno Setup](https://jrsoftware.org/isinfo.php) (free) — this
   gives you the `iscc` command used to build the installer.
4. Download the **WebView2 Evergreen Standalone Installer (x64)** from
   [Microsoft's WebView2 page](https://developer.microsoft.com/microsoft-edge/webview2/)
   and save it as:
   ```
   redist\MicrosoftEdgeWebview2Setup.exe
   ```
   (create the `redist` folder yourself — it's gitignored, not part of the
   repo, because it's a ~130 MB third-party binary you should get straight
   from Microsoft rather than trust from anywhere else.)
5. In the repo root:
   ```powershell
   python -m venv .venv
   .venv\Scripts\Activate.ps1
   pip install -r requirements-build.txt
   ```

You only redo step 5 if `requirements-build.txt` changes. Steps 1-4 are
truly one-time.

## Building a release

Every time you want a new `.exe` to hand out:

```powershell
.venv\Scripts\Activate.ps1
.\build.ps1
```

This does three things in order:
1. `npm run build` in `frontend/` — builds the React UI.
2. PyInstaller — bundles Python + the backend + the built UI into
   `dist\CompressorSim\CompressorSim.exe` (a folder, not a single file —
   this is intentional, see `compressor_sim.spec`'s comment).
3. `iscc installer.iss` — wraps that folder into
   `installer_output\CompressorSim-Setup-<version>.exe`.
4. Zips that installer into
   `installer_output\CompressorSim-Setup-<version>.zip`.

**`installer_output\CompressorSim-Setup-<version>.zip` is the one file you
send to everyone else** — over WhatsApp, email, cloud drive, or a USB stick.
The recipient saves it, extracts it, and gets exactly one
`CompressorSim-Setup-<version>.exe` to double-click. Nothing under `dist\` or
`build\` needs to leave your machine.

**Do not send the bare `.exe`.** Transfer channels — WhatsApp Desktop and
browser downloads especially — run a downloaded file through Chromium's
download manager, which first reserves the destination name with an empty
0-byte file, then renames the real bytes into place afterward. The reservation
already owns the name, so the real installer arrives as
`CompressorSim-Setup-<version> (1).exe` and a 0-byte, generic-icon
`CompressorSim-Setup-<version>.exe` is left sitting beside it. Sending the
`.zip` sidesteps this entirely: a zip is an ordinary document these channels
don't mangle, and it extracts to a single clean installer.

After a successful installation, Setup removes the exact installer file that
the user launched. This keeps a Desktop download from remaining beside the
`Compressor Simulator` shortcut. It does not remove the containing folder or
any other downloaded files. If Windows launched a numbered copy such as
`... (1).exe`, cleanup also removes the unnumbered sibling only when it matches
the CompressorSim setup naming scheme and is exactly zero bytes.

If `iscc` is unavailable, `build.ps1` stops with an error instead of reporting
a successful distributable build. Install Inno Setup 6 or add `iscc.exe` to
PATH, then run the build again.

### Bumping the version

Edit `#define MyAppVersion "0.1.0"` at the top of `installer.iss` before
building a new release. That's the only place the version lives.

## Testing without installing

You don't have to build the installer to try a build:
```powershell
dist\CompressorSim\CompressorSim.exe
```
Runs exactly like the installed app, just from the build folder.

## Where things live once installed

- App files: `%LOCALAPPDATA%\Programs\Compressor Simulator\`
- Editable config (OPC UA endpoint, sim parameters): `%LOCALAPPDATA%\CompressorSim\config.yaml`
  — **not** the repo's `backend\config.yaml`. That one is only the
  bundled *default*, copied into the writable location above the first
  time the app runs. Edit the `%LOCALAPPDATA%` one to change the PLC
  endpoint; the app never touches its own bundled copy.
- Logs: `%LOCALAPPDATA%\CompressorSim\logs\app.log` (rotates, keeps last 3)

## Troubleshooting

**App window never opens / closes immediately**
Read `%LOCALAPPDATA%\CompressorSim\logs\app.log` first — the app has no
console window, so this file is the only place errors go.

**"Windows protected your PC" (SmartScreen) on first run**
Expected — the installer isn't code-signed (that costs ~$200-450/yr, see
below). Click "More info" → "Run anyway." Tell whoever you send it to in
advance so it doesn't look broken.

**Message box: "could not start its window... WebView2 Runtime"**
The installer should have silently installed WebView2 already. If you
still see this: manually run `redist\MicrosoftEdgeWebview2Setup.exe`
(or download it fresh from Microsoft), then relaunch the app. Windows 11
ships WebView2 built in, so this should only ever happen on older Windows
10 builds.

**"Another instance is already running" but no window is visible**
A previous run crashed without releasing its lock in an unusual way (this
should self-heal — the app checks whether the previous process is
actually still alive before refusing to start). If it ever happens, open
Task Manager, end any `CompressorSim.exe` process, and relaunch.

**Build fails partway through PyInstaller**
Check `build\compressor_sim\warn-compressor_sim.txt` for the specific
missing-module warning. The usual suspects, already handled but worth
knowing about if a future dependency change breaks them:
- `asyncua` ships extra data files (`compressor_sim.spec` already collects
  them via `collect_data_files("asyncua")`) — if a future asyncua update
  adds new required data outside that mechanism, you'd see a
  `FileNotFoundError` at runtime, not at build time.
- `numpy` occasionally needs `--collect-submodules numpy` on some
  PyInstaller/numpy version combinations — add it to `compressor_sim.spec`'s
  `hiddenimports` if you hit a `ModuleNotFoundError` for a numpy submodule
  specifically in the frozen build but not in dev.

**Build from a "dirty" Python environment pulls in 200+ MB of junk**
Build from the dedicated `.venv` created in setup step 5, not your regular
Python install. Anything importable from the environment PyInstaller runs
in gets scanned and can get pulled in.

## Code signing (optional, not needed yet)

Without a code-signing certificate, every install triggers the SmartScreen
warning above and some antivirus engines flag unsigned PyInstaller
binaries more aggressively. Fine for internal/demo use. If this ever goes
to a client site and the warning becomes a problem, an OV certificate
(~$200-450/yr, e.g. via Sectigo/DigiCert or a reseller) removes it — ask
if you want the exact procurement + `signtool` steps when that's actually
needed.

## What's not built yet

- The OPC UA endpoint is currently only changeable by hand-editing
  `%LOCALAPPDATA%\CompressorSim\config.yaml` and restarting the app — no
  in-app "switch endpoint" UI yet (that's Part B of the packaging plan:
  connection profiles, live switching, a `/discover` tool for mapping tags
  on a real PLC panel).
- The HMI is still the original UI, not the ISA-101-style redesign
  (Part C of the plan).

Both are separate follow-up work, not required for the app to run as a
packaged desktop app today.
