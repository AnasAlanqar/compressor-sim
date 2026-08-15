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

$iscc = Get-Command iscc.exe -ErrorAction SilentlyContinue
if (-not $iscc) {
    Write-Host "==> iscc not found on PATH - skipping installer." -ForegroundColor Yellow
    Write-Host "    Install Inno Setup (https://jrsoftware.org/isinfo.php) to build" -ForegroundColor Yellow
    Write-Host "    CompressorSim-Setup.exe, the single file to hand out to other users." -ForegroundColor Yellow
    exit 0
}

Write-Host "==> iscc installer.iss" -ForegroundColor Cyan
& $iscc.Path "installer.iss"
if ($LASTEXITCODE -ne 0) {
    throw "iscc failed with exit code $LASTEXITCODE"
}

$setup = Get-ChildItem "installer_output\CompressorSim-Setup-*.exe" | Select-Object -First 1
if (-not $setup) {
    throw "iscc finished but no installer_output\CompressorSim-Setup-*.exe was found"
}

Write-Host "==> installer built: $($setup.FullName)" -ForegroundColor Green
Write-Host "    This is the one file to send to everyone else." -ForegroundColor Green
