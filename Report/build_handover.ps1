# Builds Report/Compressor_Simulator_Handover_Report.pdf from the Typst
# source in typst/handover/. Run from anywhere: powershell -File build_handover.ps1
$ErrorActionPreference = "Stop"
$reportDir = $PSScriptRoot
$out = Join-Path $reportDir "Compressor_Simulator_Handover_Report.pdf"

Push-Location (Join-Path $reportDir "typst\handover")
try {
    typst compile --root ..\.. --font-path ..\fonts main.typ $out
    Write-Output "wrote $out"
} finally {
    Pop-Location
}
