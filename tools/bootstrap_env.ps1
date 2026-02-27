[CmdletBinding()]
param(
    [string]$VenvRoot = "",
    [string]$ProjectKey = "portfolio_tracker_dev",
    [string]$BasePython = "",
    [switch]$Recreate,
    [switch]$WriteLock,
    [switch]$InstallPreCommit
)

$ErrorActionPreference = "Stop"

function Test-Executable {
    param([string]$Command, [string[]]$Args)
    try {
        & $Command @Args *> $null
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    }
}

function Resolve-BasePython {
    param([string]$Preferred)

    if ($Preferred) {
        return @{ mode = "path"; value = $Preferred }
    }

    if (Test-Executable -Command "py" -Args @("-3", "--version")) {
        return @{ mode = "launcher"; value = "py" }
    }

    if (Test-Executable -Command "python" -Args @("--version")) {
        return @{ mode = "path"; value = "python" }
    }

    throw "No usable base Python found. Install Python 3.11+ first, then rerun with -BasePython <python.exe> if needed."
}

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

if ($resolvedVenvRoot -match "OneDrive") {
    throw "Venv root must be outside OneDrive. Current value: $resolvedVenvRoot"
}

$venvPath = Join-Path $resolvedVenvRoot $ProjectKey
$pythonPath = Join-Path $venvPath "Scripts\python.exe"
$requirementsLock = Join-Path $projectRoot "requirements-lock.txt"
$requirementsBase = Join-Path $projectRoot "requirements.txt"

try {
    New-Item -ItemType Directory -Path $resolvedVenvRoot -Force | Out-Null
} catch {
    throw "Cannot create venv root '$resolvedVenvRoot'. Set -VenvRoot or LIFE_VENV_ROOT to a writable local path."
}

if ($Recreate -and (Test-Path $venvPath)) {
    Write-Host "[bootstrap] Removing existing venv: $venvPath"
    Remove-Item -Recurse -Force $venvPath
}

if (-not (Test-Path $pythonPath)) {
    $base = Resolve-BasePython -Preferred $BasePython
    Write-Host "[bootstrap] Creating venv at: $venvPath"
    if ($base.mode -eq "launcher") {
        & py -3 -m pip install --user virtualenv
        & py -3 -m virtualenv $venvPath
    } else {
        & $base.value -m pip install --user virtualenv
        & $base.value -m virtualenv $venvPath
    }
}

if (-not (Test-Path $pythonPath)) {
    throw "Venv creation failed. Missing interpreter: $pythonPath"
}

& $pythonPath -m pip install --upgrade pip

if (Test-Path $requirementsLock) {
    Write-Host "[bootstrap] Installing dependencies from requirements-lock.txt"
    & $pythonPath -m pip install -r $requirementsLock
} elseif (Test-Path $requirementsBase) {
    Write-Host "[bootstrap] Installing dependencies from requirements.txt"
    & $pythonPath -m pip install -r $requirementsBase
} else {
    throw "No requirements file found in project root."
}

if ($InstallPreCommit -and (Test-Path (Join-Path $projectRoot ".pre-commit-config.yaml"))) {
    Write-Host "[bootstrap] Installing pre-commit hooks"
    & $pythonPath -m pip install pre-commit
    Push-Location $projectRoot
    try {
        & $pythonPath -m pre_commit install --install-hooks
    } finally {
        Pop-Location
    }
}

if ($WriteLock) {
    Write-Host "[bootstrap] Writing requirements-lock.txt"
    & $pythonPath -m pip freeze | Out-File -FilePath $requirementsLock -Encoding utf8
}

Write-Host ""
Write-Host "[bootstrap] Completed"
Write-Host "Project root : $projectRoot"
Write-Host "Venv root    : $resolvedVenvRoot"
Write-Host "Python       : $pythonPath"
Write-Host ""
Write-Host "Session usage:"
Write-Host "  `$env:LIFE_VENV_ROOT = '$resolvedVenvRoot'"
Write-Host "  .\\tools\\project_python.ps1 --version"
