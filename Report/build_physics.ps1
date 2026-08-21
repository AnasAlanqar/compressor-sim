# Builds docs/Compressor_Simulator_Physics_Reference.pdf from the Typst
# source in typst/physics/. Run from anywhere: powershell -File build_physics.ps1
$ErrorActionPreference = "Stop"
$reportDir = $PSScriptRoot
$out = Join-Path $reportDir "..\docs\Compressor_Simulator_Physics_Reference.pdf"

Push-Location (Join-Path $reportDir "typst\physics")
try {
    typst compile --root ..\.. --font-path ..\fonts main.typ $out
    Write-Output "wrote $out"
} finally {
    Pop-Location
}
