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
#define MyAppVersion "0.6.3-pilot"
#define MyAppExeName "CompressorSim.exe"
#define MyAppPublisher "Anas Alanqar"

[Setup]
AppId={{A5016499-0F6F-4213-95E3-705663EE06D8}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\Compressor Simulator
UsePreviousAppDir=no
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
DisableDirPage=auto
DisableReadyPage=yes
DisableFinishedPage=yes
PrivilegesRequired=lowest
OutputDir=installer_output
OutputBaseFilename=CompressorSim-Setup-{#MyAppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupIconFile=assets\icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName}
Uninstallable=yes
CreateUninstallRegKey=yes
CloseApplications=yes
RestartApplications=no
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

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
; The one and only Desktop item created by this installer. Because this is
; strictly a per-user install, {userdesktop} is deterministic and cannot
; alternate between the user and common Desktop across upgrades.
Name: "{userdesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\{#MyAppExeName}"

[Run]
Filename: "{tmp}\MicrosoftEdgeWebview2Setup.exe"; Parameters: "/silent /install"; StatusMsg: "Installing Microsoft Edge WebView2 Runtime..."; Check: WebView2Missing; Flags: waituntilterminated skipifdoesntexist
; Launch immediately after a normal interactive install. DisableFinishedPage
; above means Setup closes without leaving an extra final confirmation page.
Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Flags: nowait skipifsilent

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

// Setup cannot remove the source executable while its bootstrap process still
// has that file open. After a successful install (ssDone), start a hidden,
// short-lived cleanup process. It retries deletion of the exact {srcexe} path
// only; it never uses a wildcard or touches the containing directory. The
// temporary cleanup script removes itself when finished.
procedure DeleteSourceInstallerAfterSuccess;
var
  InstallerPath: String;
  EscapedInstallerPath: String;
  CleanupScript: String;
  ScriptBody: String;
  ResultCode: Integer;
begin
  InstallerPath := ExpandConstant('{srcexe}');
  Log('Scheduling deletion of source installer: ' + InstallerPath);
  EscapedInstallerPath := InstallerPath;
  StringChangeEx(EscapedInstallerPath, '''', '''''', True);

  CleanupScript := ExpandConstant('{localappdata}\Temp\CompressorSim-Installer-Cleanup-') +
    GetDateTimeString('yyyymmddhhnnss', '-', ':') + '.ps1';
  ScriptBody :=
    '$installerPath = ''' + EscapedInstallerPath + '''' + #13#10 +
    '$sourceItem = Get-Item -LiteralPath $installerPath -ErrorAction SilentlyContinue' + #13#10 +
    'if ($null -ne $sourceItem) {' + #13#10 +
    '  $sourceStem = [System.IO.Path]::GetFileNameWithoutExtension($sourceItem.Name)' + #13#10 +
    '  $sourceDirectory = $sourceItem.DirectoryName' + #13#10 +
    '  $legacyCandidates = @()' + #13#10 +
    '  if ($sourceStem -match ''^(CompressorSim-Setup-[A-Za-z0-9._-]+) \([0-9]+\)$'') {' + #13#10 +
    '    $legacyCandidates += [System.IO.Path]::Combine($sourceDirectory, $Matches[1] + ''.exe'')' + #13#10 +
    '    $legacyCandidates += [System.IO.Path]::Combine($sourceDirectory, $Matches[1])' + #13#10 +
    '  }' + #13#10 +
    '  foreach ($candidate in $legacyCandidates) {' + #13#10 +
    '    if ($candidate -ne $installerPath) {' + #13#10 +
    '      $candidateItem = Get-Item -LiteralPath $candidate -Force -ErrorAction SilentlyContinue' + #13#10 +
    '      if (($null -ne $candidateItem) -and (-not $candidateItem.PSIsContainer) -and ($candidateItem.Length -eq 0)) {' + #13#10 +
    '        Remove-Item -LiteralPath $candidateItem.FullName -Force -ErrorAction SilentlyContinue' + #13#10 +
    '      }' + #13#10 +
    '    }' + #13#10 +
    '  }' + #13#10 +
    '}' + #13#10 +
    'for ($attempt = 0; $attempt -lt 30; $attempt++) {' + #13#10 +
    '  Start-Sleep -Milliseconds 500' + #13#10 +
    '  Remove-Item -LiteralPath $installerPath -Force -ErrorAction SilentlyContinue' + #13#10 +
    '  if (-not (Test-Path -LiteralPath $installerPath)) { break }' + #13#10 +
    '}' + #13#10 +
    'Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue' + #13#10;

  if SaveStringToFile(CleanupScript, ScriptBody, False) then
  begin
    if not Exec(
      ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
      '-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + CleanupScript + '"',
      '', SW_HIDE, ewNoWait, ResultCode) then
      Log('Could not start installer cleanup process. Error code: ' + IntToStr(ResultCode));
  end
  else
    Log('Could not write installer cleanup script: ' + CleanupScript);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssDone then
    DeleteSourceInstallerAfterSuccess;
end;
