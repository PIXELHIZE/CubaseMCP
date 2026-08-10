param(
  [string]$OutputRoot = "artifacts",
  [switch]$SkipRuntime
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$package = Get-Content -Raw -LiteralPath (Join-Path $repoRoot "package.json") | ConvertFrom-Json
$artifactRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $OutputRoot))
$stageDir = Join-Path $artifactRoot "stage\CubaseMCP"
if (-not $SkipRuntime) {
  & (Join-Path $PSScriptRoot "package-runtime.ps1") -OutputRoot $OutputRoot
}
if (-not (Test-Path -LiteralPath $stageDir)) { throw "Runtime stage does not exist: $stageDir" }
New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null
$zipPath = Join-Path $artifactRoot "cubase-mcp-$($package.version)-win-x64.zip"
if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
Compress-Archive -Path (Join-Path $stageDir "*") -DestinationPath $zipPath -CompressionLevel Optimal
Write-Output $zipPath

