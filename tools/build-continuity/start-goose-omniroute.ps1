param(
    [string]$Model = "openrouter/poolside/laguna-s-2.1:free",
    [switch]$NoLaunch
)

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$privateRoot = Join-Path $repo ".git\yellow-omniroute"
$envFile = Join-Path $privateRoot "data\.env"
$gooseDesktop = "E:\yellow\goose\v1.51.0\dist-windows\Goose.exe"

if ($Model -notmatch ":free$") {
    throw "Hosted Goose routes must be explicit :free models. Refusing '$Model'."
}
if (-not (Test-Path -LiteralPath $envFile)) {
    throw "Private OmniRoute environment is missing: $envFile"
}

$private = @{}
foreach ($line in Get-Content -LiteralPath $envFile) {
    if ($line -match '^([^#=]+)=(.*)$') {
        $private[$matches[1]] = $matches[2].Trim('"')
    }
}
if (-not $private.ContainsKey("OMNIROUTE_API_KEY")) {
    throw "OMNIROUTE_API_KEY is missing from private runtime state."
}

$baseUrl = "http://127.0.0.1:20129"
$healthUrl = "$baseUrl/api/health/ping"
try {
    $null = Invoke-WebRequest -UseBasicParsing -Uri $healthUrl -TimeoutSec 3
} catch {
    $python = (Get-Command python -ErrorAction Stop).Source
    $logDir = Join-Path $privateRoot "logs"
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    Start-Process -FilePath $python -WindowStyle Hidden -WorkingDirectory $repo `
        -ArgumentList @("tools/build-continuity/omniroute.py", "--serve", "--port", "20129") `
        -RedirectStandardOutput (Join-Path $logDir "server.stdout.log") `
        -RedirectStandardError (Join-Path $logDir "server.stderr.log")
    $ready = $false
    foreach ($attempt in 1..20) {
        Start-Sleep -Milliseconds 500
        try {
            $null = Invoke-WebRequest -UseBasicParsing -Uri $healthUrl -TimeoutSec 2
            $ready = $true
            break
        } catch {}
    }
    if (-not $ready) {
        throw "OmniRoute did not become healthy on loopback port 20129."
    }
}

$env:GOOSE_PROVIDER = "openai"
$env:GOOSE_MODEL = $Model
$env:OPENAI_HOST = $baseUrl
$env:OPENAI_API_KEY = $private["OMNIROUTE_API_KEY"]
$env:GOOSE_TELEMETRY_ENABLED = "false"

Write-Host "Yellow Goose is routed through OmniRoute: $Model"
Write-Host "Gateway: $baseUrl (loopback only)"

if (-not $NoLaunch) {
    if (-not (Test-Path -LiteralPath $gooseDesktop)) {
        throw "Goose Desktop is missing: $gooseDesktop"
    }
    Start-Process -FilePath $gooseDesktop -WorkingDirectory $repo
}
