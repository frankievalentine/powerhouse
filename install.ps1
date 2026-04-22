#Requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments = @()
)

$ErrorActionPreference = 'Stop'

if ($env:POWERHOUSE_DRY_RUN -eq "1") {
    $Arguments += "--dry-run"
}

$PowerhouseRepo = "https://github.com/frankievalentine/powerhouse"
$ManagedRuntime = Join-Path $env:LOCALAPPDATA 'powerhouse\runtime'

function Refresh-Path() {
    $env:PATH = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}

function Test-Command($Name) {
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Write-Info($Message) {
    Write-Host "$Message"
}

function Write-Step($Message) {
    Write-Host "$Message"
}

function Write-Success($Message) {
    Write-Host "$Message"
}

function Write-Warn($Message) {
    Write-Host "$Message"
}

function Write-ErrorAndExit($Message) {
    Write-Error "$Message"
    exit 1
}

function Sync-ManagedRuntime($SourceRoot, $RuntimeDir) {
    $resolvedSource = (Resolve-Path $SourceRoot).Path
    try {
        $resolvedRuntime = (Resolve-Path $RuntimeDir).Path
    } catch {
        $resolvedRuntime = $null
    }

    if ($resolvedSource -eq $resolvedRuntime) {
        return $SourceRoot
    }

    $tempDir = Join-Path $env:TEMP "powerhouse-runtime.$([Guid]::NewGuid().ToString('N').Substring(0,8))"
    $null = New-Item -ItemType Directory -Force -Path $tempDir

    robocopy $SourceRoot $tempDir /E /XD node_modules /NP /NFL /NDL /NJH /NJS | Out-Null
    $global:LASTEXITCODE = 0

    if (Test-Path $RuntimeDir) {
        Remove-Item -Recurse -Force $RuntimeDir
    }
    $null = New-Item -ItemType Directory -Force -Path (Split-Path $RuntimeDir)
    Move-Item -Path $tempDir -Destination $RuntimeDir
    return $RuntimeDir
}

# --- Detect if running via irm ... | iex ---
$isPiped = -not $MyInvocation.MyCommand.Path

if ($isPiped) {
    if (Get-Command powerhouse -ErrorAction SilentlyContinue) {
        Write-Host "powerhouse is already installed. Running: powerhouse update"
        & powerhouse update @Arguments
        exit
    }

    # Attempt to install git if it's missing, since we need it to clone the repo.
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        if (Get-Command winget -ErrorAction SilentlyContinue) {
            Write-Host "git is required. Installing Git via winget..."
            & winget install --id Git.Git --accept-source-agreements --accept-package-agreements --exact
            Refresh-Path
        } elseif (Get-Command scoop -ErrorAction SilentlyContinue) {
            Write-Host "git is required. Installing Git via scoop..."
            & scoop install git
        }
    }

    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Error @"
git is required to install powerhouse and could not be installed automatically.

Please install git manually:
  - winget:   winget install --id Git.Git
  - scoop:    scoop install git
  - Download: https://git-scm.com/download/win

After installing git, re-run the powerhouse installer.
"@
        exit 1
    }

    Write-Host "Cloning powerhouse to $ManagedRuntime ..."
    if (Test-Path $ManagedRuntime) {
        Remove-Item -Recurse -Force $ManagedRuntime
    }
    $null = New-Item -ItemType Directory -Force -Path (Split-Path $ManagedRuntime)
    & git clone --depth 1 $PowerhouseRepo $ManagedRuntime
    & powershell -ExecutionPolicy Bypass -File "$ManagedRuntime\install.ps1" @Arguments
    exit
}

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# --- Main ---
Write-Host ""
Write-Host "powerhouse setup"
Write-Host "AI-native workstation setup"
Write-Host ""

$ManagedRoot = $RootDir

Write-Info "Platform: win32"
Write-Info "Shell: powershell"

# Already installed check
if ((Test-Command powerhouse) -or (Test-Path $ManagedRuntime)) {
    Write-Info "powerhouse is already installed on this machine."
    if ($Host.UI.RawUI -and -not $isPiped) {
        $choice = Read-Host "Run 'powerhouse update' to sync, or continue to re-install? [update/reinstall/cancel]"
        switch ($choice.ToLower()) {
            "update" { 
                Write-Info "Running: powerhouse update"
                & powerhouse update @Arguments
                exit
            }
            "reinstall" { 
                Write-Info "Continuing with full re-install..."
            }
            default {
                Write-Info "Cancelled."
                exit 0
            }
        }
    } else {
        Write-Info "Non-interactive shell detected - running 'powerhouse update' to sync."
        & powerhouse update @Arguments
        exit
    }
}

Write-Step "Preparing Windows prerequisites"
& "$RootDir\scripts\platform\windows.ps1"
Write-Success "Windows prerequisites ready"

if (-not (Test-Command git)) {
    Write-Warn "git is not installed yet; the selected harness can install it."
}

if (-not (Test-Command bun)) {
    Write-Step "Installing Bun"
    powershell -c "irm bun.sh/install.ps1 | iex"
    # Refresh PATH in case Bun just added itself
    Refresh-Path
    if (-not (Test-Command bun)) {
        Write-ErrorAndExit "Bun installation failed"
    }
    Write-Success "Bun installed"
} else {
    Write-Success "Bun already available"
}

Write-Step "Preparing managed runtime"
$ManagedRoot = Sync-ManagedRuntime -SourceRoot $RootDir -RuntimeDir $ManagedRuntime
Write-Info "Managed runtime: $ManagedRoot"

Write-Step "Installing workspace dependencies"
Push-Location $ManagedRoot
& bun install
Pop-Location
Write-Success "Workspace dependencies installed"

Write-Step "Installing powerhouse command wrapper"
& "$RootDir\scripts\bootstrap\install-wrapper.ps1" -RootDir $ManagedRoot
Write-Success "Wrapper installed"

Write-Step "Configuring shell startup"
& "$RootDir\scripts\bootstrap\configure-shell.ps1" -BinDir (Join-Path $env:LOCALAPPDATA 'powerhouse\bin')
Write-Success "Shell startup configured"

Write-Info "Handing off to the interactive setup CLI"
& bun "$ManagedRoot\packages\cli\src\index.ts" setup @Arguments
