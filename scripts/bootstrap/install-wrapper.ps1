param(
    [Parameter(Mandatory = $true)]
    [string]$RootDir,

    [string]$BinDir = (Join-Path $env:LOCALAPPDATA 'powerhouse\bin')
)

$ErrorActionPreference = 'Stop'

$null = New-Item -ItemType Directory -Force -Path $BinDir

$cmdContent = @"
@echo off
bun "$RootDir\packages\cli\src\index.ts" %*
"@

Set-Content -Path "$BinDir\powerhouse.cmd" -Value $cmdContent -Encoding ASCII

$psContent = @"
# powerhouse wrapper
& bun "$RootDir\packages\cli\src\index.ts" `@args
"@

Set-Content -Path "$BinDir\powerhouse.ps1" -Value $psContent -Encoding UTF8

Write-Host "Installed wrapper at $BinDir\powerhouse.cmd"

# Add to user PATH if not already present
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($userPath -notlike "*$BinDir*") {
    [Environment]::SetEnvironmentVariable('Path', "$userPath;$BinDir", 'User')
    Write-Host "Added $BinDir to user PATH. Restart your terminal to use 'powerhouse' directly."
}
