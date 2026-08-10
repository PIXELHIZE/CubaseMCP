param([string]$OutputRoot = "artifacts")

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$artifactRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $OutputRoot))
if (-not (Test-Path -LiteralPath $artifactRoot)) { throw "Artifact directory does not exist: $artifactRoot" }
$files = Get-ChildItem -LiteralPath $artifactRoot -File |
  Where-Object { $_.Extension -in @(".zip", ".msi", ".json") } |
  Sort-Object Name
$lines = foreach ($file in $files) {
  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  $stream = $null
  try {
    $stream = [System.IO.File]::OpenRead($file.FullName)
    $hashBytes = $sha256.ComputeHash($stream)
    $hash = [System.BitConverter]::ToString($hashBytes).Replace("-", "").ToLowerInvariant()
  } finally {
    if ($null -ne $stream) { $stream.Dispose() }
    $sha256.Dispose()
  }
  "$hash  $($file.Name)"
}
$output = Join-Path $artifactRoot "SHA256SUMS.txt"
Set-Content -LiteralPath $output -Value $lines -Encoding utf8
Write-Output $output
