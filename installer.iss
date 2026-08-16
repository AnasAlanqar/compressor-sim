; Inno Setup script — produces the single file everyone but you ever needs
; to see: CompressorSim-Setup-<version>.exe. Double-click, Next, Next,
; Finish, desktop shortcut, launch. No Python, no Node, no terminal.
;
; Build with Inno Setup (https://jrsoftware.org/isinfo.php, free):
;   iscc installer.iss
; build.ps1 runs this automatically if `iscc` is on PATH after the
; PyInstaller step succeeds — see that script.
;
; Per-user install (PrivilegesRequired=lowest): plant/office laptops often
; don't hand out admin rights, and this app needs none.

#define MyAppName "Compressor Simulator"
#define MyAppVersion "0.5.0"
#define MyAppExeName "CompressorSim.exe"
#define MyAppPublisher "Anas Alanqar"

[Setup]
AppId={{A5016499-0F6F-4213-95E3-705663EE06D8}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\CompressorSim
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir=installer_output
OutputBaseFilename=CompressorSim-Setup-{#MyAppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupIconFile=assets\icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"

[Files]
; The PyInstaller onedir build — run build.ps1 (or `pyinstaller compressor_sim.spec`) first.
Source: "dist\CompressorSim\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; WebView2 Evergreen Standalone Installer (~130 MB) — download once from
; https://developer.microsoft.com/microsoft-edge/webview2/ ("Evergreen
; Standalone Installer", x64) and drop it at redist\MicrosoftEdgeWebview2Setup.exe.
; Not fetched automatically: it's a large third-party binary you should get
; and verify from Microsoft directly rather than have committed to the repo.
Source: "redist\MicrosoftEdgeWebview2Setup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall skipifsourcedoesntexist; Check: WebView2Missing

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{tmp}\MicrosoftEdgeWebview2Setup.exe"; Parameters: "/silent /install"; StatusMsg: "Installing Microsoft Edge WebView2 Runtime..."; Check: WebView2Missing; Flags: waituntilterminated skipifdoesntexist
Filename: "{app}\{#MyAppExeName}"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent

[Code]
// The Evergreen Runtime's own well-known "pv" (product version) registry
// value, present once installed — same detection Microsoft's own
// deployment docs use. If detection is ever wrong, the bootstrapper is
// idempotent and just no-ops when already current, so a false positive
// here costs a few seconds, not a broken install.
function WebView2Missing: Boolean;
var
  Version: String;
  Found: Boolean;
begin
  Found := RegQueryStringValue(HKLM64, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version);
  if not Found then
    Found := RegQueryStringValue(HKCU, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version);
  Result := not Found;
end;
