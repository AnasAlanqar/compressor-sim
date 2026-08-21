# Builds the Windows desktop app end to end: frontend -> PyInstaller onedir
# bundle -> single-file installer (installer.iss). Run from the repo root,
# in a venv with requirements-build.txt installed, with Inno Setup's `iscc`
# on PATH (https://jrsoftware.org/isinfo.php, free - or `choco install
# innosetup`).
#
#   python -m venv .venv
#   .venv\Scripts\Activate.ps1
#   pip install -r requirements-build.txt
#   .\build.ps1
#
# Output for you (this script): dist\CompressorSim\CompressorSim.exe - the
# raw onedir bundle, useful for a quick test run without installing anything.
# Output for everyone else: installer_output\CompressorSim-Setup-<version>.exe
# - the one file to hand out. Double-click, Next, Next, Finish, desktop icon,
# launch. No Python, no Node, no terminal, no admin rights required.

$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
Set-Location $root

Write-Host "==> npm run build (frontend)" -ForegroundColor Cyan
Push-Location (Join-Path $root "frontend")
try {
    npm install
    npm run build
} finally {
    Pop-Location
}
if (-not (Test-Path (Join-Path $root "frontend\dist\index.html"))) {
    throw "frontend build did not produce frontend\dist\index.html"
}

Write-Host "==> pyinstaller --clean compressor_sim.spec" -ForegroundColor Cyan
pyinstaller --clean --noconfirm compressor_sim.spec
if ($LASTEXITCODE -ne 0) {
    throw "pyinstaller failed with exit code $LASTEXITCODE"
}

$exe = Join-Path $root "dist\CompressorSim\CompressorSim.exe"
if (-not (Test-Path $exe)) {
    throw "build finished but $exe was not produced"
}

Write-Host "==> built: $exe" -ForegroundColor Green

# Keep the distributable directory unambiguous: it must contain only the
# installer produced by this build, never historical setup executables that
# someone could accidentally copy together to a user's Desktop.
$installerOutput = Join-Path $root "installer_output"
New-Item -ItemType Directory -Force -Path $installerOutput | Out-Null
Get-ChildItem -LiteralPath $installerOutput -Filter "CompressorSim-Setup-*.exe" -File |
    Remove-Item -Force
# The zip is the artifact you actually hand out (see below). Clear stale ones
# too, so installer_output never accumulates old versions.
Get-ChildItem -LiteralPath $installerOutput -Filter "CompressorSim-Setup-*.zip" -File |
    Remove-Item -Force

$iscc = Get-Command iscc.exe -ErrorAction SilentlyContinue
if (-not $iscc) {
    $knownIscc = Join-Path $env:LOCALAPPDATA "Programs\Inno Setup 6\ISCC.exe"
    if (Test-Path -LiteralPath $knownIscc) {
        $iscc = Get-Item -LiteralPath $knownIscc
    } else {
        throw "iscc.exe not found. Install Inno Setup 6 or add it to PATH; no distributable installer was produced."
    }
}
$isccPath = if ($iscc -is [System.IO.FileInfo]) { $iscc.FullName } else { $iscc.Path }

Write-Host "==> iscc installer.iss" -ForegroundColor Cyan
$installerStaging = Join-Path ([System.IO.Path]::GetTempPath()) ("CompressorSimInstallerBuild-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $installerStaging | Out-Null
& $isccPath ("/O" + $installerStaging) "installer.iss"
if ($LASTEXITCODE -ne 0) {
    throw "iscc failed with exit code $LASTEXITCODE"
}

$stagedSetups = @(Get-ChildItem -LiteralPath $installerStaging -Filter "CompressorSim-Setup-*.exe" -File)
if ($stagedSetups.Count -ne 1) {
    throw "expected exactly one staged installer in $installerStaging, found $($stagedSetups.Count)"
}
Move-Item -LiteralPath $stagedSetups[0].FullName -Destination $installerOutput
Remove-Item -LiteralPath $installerStaging -Recurse -Force

$setups = @(Get-ChildItem -LiteralPath $installerOutput -Filter "CompressorSim-Setup-*.exe" -File)
if ($setups.Count -ne 1) {
    throw "expected exactly one installer in $installerOutput, found $($setups.Count)"
}
$setup = $setups[0]

Write-Host "==> installer built: $($setup.FullName)" -ForegroundColor Green

# Wrap the single installer in a zip and hand THAT out — never the bare .exe.
#
# Why: transfer channels (WhatsApp Desktop, browser downloads, cloud sync) run
# the file through Chromium's download manager, which reserves the destination
# name with an empty 0-byte file, streams the real bytes to a temp file, then
# renames it into place. The reservation already holds the name, so the real
# installer lands as "CompressorSim-Setup-<ver> (1).exe" while a 0-byte,
# generic-icon "CompressorSim-Setup-<ver>.exe" is left behind. WhatsApp is
# also openly hostile to bare .exe attachments. A .zip is an ordinary document
# none of these channels mangle: it transfers as one file, and extracting it
# yields exactly one installer with no 0-byte sibling and no "(1)".
$zipPath = Join-Path $installerOutput ($setup.BaseName + ".zip")
Compress-Archive -LiteralPath $setup.FullName -DestinationPath $zipPath -Force
$zip = Get-Item -LiteralPath $zipPath

Write-Host "==> distributable built: $($zip.FullName)" -ForegroundColor Green
Write-Host "    This zip is the one file to send to everyone else (WhatsApp, email, etc.)." -ForegroundColor Green
Write-Host "    They save it, extract it, and get exactly one CompressorSim-Setup-*.exe." -ForegroundColor Green
