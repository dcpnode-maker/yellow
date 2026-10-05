[CmdletBinding()]
param(
    [ValidateSet('web', 'headless')]
    [string]$Mode = 'web',

    [string]$Prompt = '',

    [ValidateRange(1024, 65535)]
    [int]$Port = 20131
)

$ErrorActionPreference = 'Stop'

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$dshRoot = 'E:\yellow\dsh\0.1.5-rc.2'
$dsh = Join-Path $dshRoot 'node_modules\.bin\dsh.cmd'
$pilotRoot = Join-Path $repo '.git\yellow-continuity\dsh-pilot'
$dshHome = Join-Path $pilotRoot 'home'
$patch = Join-Path $pilotRoot 'multi-provider-readonly.patch.yml'

if (-not (Test-Path -LiteralPath $dsh)) {
    throw "Pinned DSH is missing: $dsh"
}
if (-not (Test-Path -LiteralPath $patch)) {
    throw "DSH provider patch is missing: $patch"
}

$geminiKey = [Environment]::GetEnvironmentVariable('YELLOW_GEMINI_DSH_API_KEY', 'Process')
if ([string]::IsNullOrWhiteSpace($geminiKey)) {
    $geminiKey = [Environment]::GetEnvironmentVariable('YELLOW_GEMINI_DSH_API_KEY', 'User')
}
if (-not [string]::IsNullOrWhiteSpace($geminiKey)) {
    $env:YELLOW_GEMINI_DSH_API_KEY = $geminiKey
}

$env:DSH_HOME = $dshHome

if ($Mode -eq 'web') {
    Write-Host 'Starting DSH on loopback. Select Yellow Gemini or Yellow OmniRoute in the model picker.'
    Write-Host 'Gemini availability:' ($(if ($geminiKey) { 'credential present' } else { 'credential not enrolled' }))
    & $dsh --profile web --patch $patch --host 127.0.0.1 --port $Port
    exit $LASTEXITCODE
}

if ([string]::IsNullOrWhiteSpace($Prompt)) {
    throw 'Headless mode requires -Prompt.'
}

& $dsh --profile headless --patch $patch $Prompt
exit $LASTEXITCODE

