param(
  [string]$OutputRoot = "artifacts",
  [string]$NodeRuntimeDir = $env:CUBASE_MCP_NODE_RUNTIME_DIR
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$artifactRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $OutputRoot))
$stageRoot = Join-Path $artifactRoot "stage"
$stageDir = Join-Path $stageRoot "CubaseMCP"
if (-not $artifactRoot.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "OutputRoot must stay inside the repository: $artifactRoot"
}
if (Test-Path -LiteralPath $stageRoot) {
  $resolvedStage = [System.IO.Path]::GetFullPath($stageRoot)
  if (-not $resolvedStage.StartsWith($artifactRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to replace unexpected staging path: $resolvedStage"
  }
  Remove-Item -LiteralPath $resolvedStage -Recurse -Force
}

& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw "TypeScript build failed." }

New-Item -ItemType Directory -Path $stageDir -Force | Out-Null
foreach ($directory in @("dist", "docs")) {
  Copy-Item -LiteralPath (Join-Path $repoRoot $directory) -Destination $stageDir -Recurse
}
New-Item -ItemType Directory -Path (Join-Path $stageDir "cubase-remote-script") -Force | Out-Null
Copy-Item -Path (Join-Path $repoRoot "src\cubase-remote-script\*") -Destination (Join-Path $stageDir "cubase-remote-script") -Recurse
foreach ($file in @("package.json", "package-lock.json", "README.md", "LICENSE", "NOTICE", "THIRD_PARTY_LICENSES.md")) {
  Copy-Item -LiteralPath (Join-Path $repoRoot $file) -Destination $stageDir
}
Copy-Item -LiteralPath (Join-Path $repoRoot "installer\cubase-mcp.cmd") -Destination $stageDir

Push-Location $stageDir
try {
  & npm.cmd ci --omit=dev
  if ($LASTEXITCODE -ne 0) { throw "Production dependency install failed." }
} finally {
  Pop-Location
}

if ([string]::IsNullOrWhiteSpace($NodeRuntimeDir)) {
  $nodeCommand = Get-Command node -ErrorAction Stop
  $NodeRuntimeDir = Split-Path -Parent $nodeCommand.Source
}
$nodeRoot = (Resolve-Path -LiteralPath $NodeRuntimeDir).Path
$nodeExe = Join-Path $nodeRoot "node.exe"
if (-not (Test-Path -LiteralPath $nodeExe)) { throw "node.exe was not found in $nodeRoot" }
Copy-Item -LiteralPath $nodeExe -Destination $stageDir
$nodeLicense = @("LICENSE", "LICENSE.txt") |
  ForEach-Object { Join-Path $nodeRoot $_ } |
  Where-Object { Test-Path -LiteralPath $_ } |
  Select-Object -First 1
if ($nodeLicense) {
  Copy-Item -LiteralPath $nodeLicense -Destination (Join-Path $stageDir "NODE_LICENSE")
} else {
  Set-Content -LiteralPath (Join-Path $stageDir "NODE_RUNTIME_NOTICE.txt") -Value "Node.js runtime license must be supplied by the release job before distribution."
}

Write-Output $stageDir
