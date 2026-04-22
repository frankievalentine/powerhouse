# Windows platform preflight for powerhouse

$ErrorActionPreference = 'Stop'

$build = [System.Environment]::OSVersion.Version.Build

# Windows 10 version 1809 (build 17763) is the minimum for winget and modern tooling
if ($build -lt 17763) {
    throw "Windows 10 version 1809 (build 17763) or later is required."
}

function Test-Command($Name) {
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Install-GitIfMissing() {
    if (Test-Command git) {
        return
    }

    Write-Host "git is required but not found. Attempting to install..."

    if (Test-Command winget) {
        Write-Host "Installing Git via winget..."
        & winget install --id Git.Git --accept-source-agreements --accept-package-agreements --exact
        # Refresh PATH so the current session can find git
        $env:PATH = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
        if (Test-Command git) {
            Write-Host "Git installed successfully."
            return
        }
    }

    if (Test-Command scoop) {
        Write-Host "Installing Git via scoop..."
        & scoop install git
        # Scoop typically updates PATH immediately in the current session via shims
        if (Test-Command git) {
            Write-Host "Git installed successfully."
            return
        }
    }

    throw @"
git is required to install powerhouse and could not be installed automatically.

Please install git manually:
  - winget:   winget install --id Git.Git
  - scoop:    scoop install git
  - Download: https://git-scm.com/download/win

After installing git, re-run the powerhouse installer.
"@
}

$winget = Get-Command winget -ErrorAction SilentlyContinue
$scoop = Get-Command scoop -ErrorAction SilentlyContinue

if (-not $winget -and -not $scoop) {
    Write-Warning "Neither winget nor scoop was found."
    Write-Warning "winget is recommended and comes pre-installed on Windows 11 and modern Windows 10."
    Write-Warning "Install winget from the Microsoft Store, or install scoop from https://scoop.sh"
}

Install-GitIfMissing
