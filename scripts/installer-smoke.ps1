param(
  [Parameter(Mandatory = $true)][string]$MsiPath,
  [string]$InstallDir = "$env:LOCALAPPDATA\Programs\Cubase MCP"
)

$ErrorActionPreference = "Stop"
$resolvedMsi = (Resolve-Path -LiteralPath $MsiPath).Path
$logRoot = Join-Path $env:TEMP "cubase-mcp-installer-smoke"
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
$installLog = Join-Path $logRoot "install.log"
$uninstallLog = Join-Path $logRoot "uninstall.log"

$install = Start-Process msiexec.exe -ArgumentList @("/i", "`"$resolvedMsi`"", "/qn", "/norestart", "/l*v", "`"$installLog`"") -Wait -PassThru
if ($install.ExitCode -ne 0) { throw "MSI install failed with exit code $($install.ExitCode). See $installLog" }
try {
  foreach ($relative in @("node.exe", "dist\server.js", "cubase-mcp.cmd", "LICENSE", "NOTICE")) {
    $path = Join-Path $InstallDir $relative
    if (-not (Test-Path -LiteralPath $path)) { throw "Installed file is missing: $path" }
  }
  & (Join-Path $InstallDir "node.exe") --check (Join-Path $InstallDir "dist\server.js")
  if ($LASTEXITCODE -ne 0) { throw "Installed server entry point failed node --check." }
} finally {
  $uninstall = Start-Process msiexec.exe -ArgumentList @("/x", "`"$resolvedMsi`"", "/qn", "/norestart", "/l*v", "`"$uninstallLog`"") -Wait -PassThru
  if ($uninstall.ExitCode -ne 0) { throw "MSI uninstall failed with exit code $($uninstall.ExitCode). See $uninstallLog" }
}
Write-Output "MSI install/uninstall smoke passed."
