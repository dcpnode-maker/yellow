[CmdletBinding()]
param(
    [ValidateSet('gemini-3.1-pro-preview', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite')]
    [string]$Model = 'gemini-3.8-flash'
)

$ErrorActionPreference = 'Stop'

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$gooseDesktop = 'E:\yellow\goose\v1.51.0\dist-windows\Goose.exe'

if (-not (Test-Path -LiteralPath $gooseDesktop)) {
    throw "Pinned Goose Desktop is missing: $gooseDesktop"
}

$geminiKey = [Environment]::GetEnvironmentVariable('YELLOW_GEMINI_GOOSE_API_KEY', 'Process')
if ([string]::IsNullOrWhiteSpace($geminiKey)) {
    $geminiKey = [Environment]::GetEnvironmentVariable('YELLOW_GEMINI_GOOSE_API_KEY', 'User')
}
if ([string]::IsNullOrWhiteSpace($geminiKey)) {
    throw 'Gemini is configured but the private YELLOW_GEMINI_GOOSE_API_KEY credential is not enrolled.'
}

$env:GOOGLE_API_KEY = $geminiKey
$env:GOOSE_PROVIDER = 'google'
$env:GOOSE_MODEL = $Model
$env:GOOSE_TELEMETRY_ENABLED = 'false'

Write-Host "Starting Goose with Google Gemini: $Model"
Start-Process -FilePath $gooseDesktop -WorkingDirectory $repo
