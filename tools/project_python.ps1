[CmdletBinding(PositionalBinding = $false)]
param(
    [string]$VenvRoot = "",
    [string]$ProjectKey = "portfolio_tracker_dev",
    [Parameter(Position = 0, ValueFromRemainingArguments = $true)]
    [string[]]$PyArgs
)

$ErrorActionPreference = "Stop"

$defaultVenvRoot = Join-Path $env:USERPROFILE ".venvs_hub"
if ($env:USERPROFILE -match "[^\u0000-\u007F]") {
    $defaultVenvRoot = "C:\venvs_hub"
}
$resolvedVenvRoot = if ($VenvRoot) { $VenvRoot } elseif ($env:LIFE_VENV_ROOT) { $env:LIFE_VENV_ROOT } else { $defaultVenvRoot }
$pythonPath = Join-Path (Join-Path $resolvedVenvRoot $ProjectKey) "Scripts\python.exe"

if (-not (Test-Path $pythonPath)) {
    throw "Project python not found: $pythonPath`nRun .\\tools\\bootstrap_env.ps1 first."
}

if ($PyArgs.Count -eq 0) {
    & $pythonPath --version
    Write-Output $pythonPath
    exit $LASTEXITCODE
}

& $pythonPath @PyArgs
exit $LASTEXITCODE
