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
$wix = Get-Command wix -ErrorAction SilentlyContinue
if (-not $wix) {
  $dotnetTools = Join-Path $env:USERPROFILE ".dotnet\tools"
  $candidate = Join-Path $dotnetTools "wix.exe"
  if (Test-Path -LiteralPath $candidate) { $wix = Get-Item -LiteralPath $candidate }
}
if (-not $wix) { throw "WiX CLI is required. Install with: dotnet tool install --global wix --version 6.0.2" }
New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null
$msiPath = Join-Path $artifactRoot "cubase-mcp-$($package.version)-win-x64.msi"
& $wix.Source build (Join-Path $repoRoot "installer\Product.wxs") `
  -arch x64 `
  -d "StageDir=$stageDir" `
  -d "Version=$($package.version)" `
  -o $msiPath
if ($LASTEXITCODE -ne 0) { throw "WiX MSI build failed." }
Write-Output $msiPath
