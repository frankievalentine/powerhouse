param(
    [Parameter(Mandatory = $true)]
    [string]$BinDir
)

$ErrorActionPreference = 'Stop'

$startMarker = "# >>> powerhouse shell setup >>>"
$endMarker = "# <<< powerhouse shell setup <<<"

function Get-ProfilePath {
    # Prefer PowerShell 7+ profile if it exists or the directory exists
    $ps7Dir = Join-Path $HOME 'Documents\PowerShell'
    $ps7Profile = Join-Path $ps7Dir 'Microsoft.PowerShell_profile.ps1'

    # Fallback to Windows PowerShell profile
    $ps5Dir = Join-Path $HOME 'Documents\WindowsPowerShell'
    $ps5Profile = Join-Path $ps5Dir 'Microsoft.PowerShell_profile.ps1'

    if (Test-Path $ps7Profile) {
        return $ps7Profile
    }

    if (Test-Path $ps7Dir) {
        return $ps7Profile
    }

    if (Test-Path $ps5Profile) {
        return $ps5Profile
    }

    if (Test-Path $ps5Dir) {
        return $ps5Profile
    }

    # Default to PowerShell 7+ location
    return $ps7Profile
}

$profilePath = Get-ProfilePath
$profileDir = Split-Path $profilePath

if (-not (Test-Path $profileDir)) {
    $null = New-Item -ItemType Directory -Force -Path $profileDir
}

function Remove-ExistingBlock($Path) {
    if (-not (Test-Path $Path)) {
        return
    }

    $content = Get-Content -Path $Path -Raw -ErrorAction SilentlyContinue
    if (-not $content) {
        return
    }

    $pattern = "(?s)$([regex]::Escape($startMarker)).*$([regex]::Escape($endMarker))\r?\n?"
    $newContent = [regex]::Replace($content, $pattern, "").TrimEnd()
    Set-Content -Path $Path -Value $newContent -NoNewline -Encoding UTF8
}

Remove-ExistingBlock -Path $profilePath

$block = @"

$startMarker
`$env:PATH = "$BinDir;`$env:PATH"
$endMarker
"@

Add-Content -Path $profilePath -Value $block -Encoding UTF8

Write-Host "Updated PowerShell profile at $profilePath"
