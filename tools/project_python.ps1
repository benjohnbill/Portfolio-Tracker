[CmdletBinding(PositionalBinding = $false)]
param(
    [string]$VenvRoot = "",
    [string]$ProjectKey = "portfolio_tracker_dev",
    [Parameter(Position = 0, ValueFromRemainingArguments = $true)]
    [string[]]$PyArgs
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

function Resolve-DynamicVenvRoot {
    if ($VenvRoot) { return $VenvRoot }
    if ($env:LIFE_VENV_ROOT) { return $env:LIFE_VENV_ROOT }

    # 1. Search for .venvs_hub upwards from project root
    $current = $projectRoot
    while ($current) {
        $candidate = Join-Path $current ".venvs_hub"
        if (Test-Path $candidate) { return $candidate }
        $parent = Split-Path $current -Parent
        if ($parent -eq $current) { break }
        $current = $parent
    }

    # 2. Fallback to drive root \.venvs_hub
    $driveRootCandidate = Join-Path (Split-Path $projectRoot -Qualifer) "\.venvs_hub"
    if (Test-Path $driveRootCandidate) { return $driveRootCandidate }

    # 3. Last resort: $HOME\.venvs_hub (if not OneDrive)
    $homeCandidate = Join-Path $env:USERPROFILE ".venvs_hub"
    if ($homeCandidate -notmatch "OneDrive") { return $homeCandidate }

    # 4. Final safety fallback for Windows
    return "C:\.venvs_hub"
}

$resolvedVenvRoot = Resolve-DynamicVenvRoot
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
