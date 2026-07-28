param([string]$OutputRoot = "artifacts")

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$artifactRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $OutputRoot))
if (-not (Test-Path -LiteralPath $artifactRoot)) { throw "Artifact directory does not exist: $artifactRoot" }
$files = Get-ChildItem -LiteralPath $artifactRoot -File |
  Where-Object { $_.Extension -in @(".zip", ".msi", ".json") } |
  Sort-Object Name
$lines = foreach ($file in $files) {
  $hash = Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256
  "$($hash.Hash.ToLowerInvariant())  $($file.Name)"
}
$output = Join-Path $artifactRoot "SHA256SUMS.txt"
Set-Content -LiteralPath $output -Value $lines -Encoding utf8
Write-Output $output

