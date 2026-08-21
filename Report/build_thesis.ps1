# Builds output/CompressorSim-Thesis.pdf from the Typst source in typst/.
# Run from anywhere: powershell -File build_thesis.ps1
$ErrorActionPreference = "Stop"
$reportDir = $PSScriptRoot
$out = Join-Path $reportDir "output\CompressorSim-Thesis.pdf"
New-Item -ItemType Directory -Force -Path (Join-Path $reportDir "output") | Out-Null

Push-Location (Join-Path $reportDir "typst")
try {
    typst compile --root .. --font-path fonts main.typ $out
    Write-Output "wrote $out"
} finally {
    Pop-Location
}
