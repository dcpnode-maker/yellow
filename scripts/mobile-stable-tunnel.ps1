param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^https://')]
  [string]$PublicUrl,

  [Parameter(Mandatory = $true)]
  [ValidateRange(1, 65535)]
  [int]$LocalPort,

  [string]$TunnelName = "yellow-mobile",
  [switch]$InstallService
)

$ErrorActionPreference = "Stop"

$uri = [Uri]$PublicUrl
if ($uri.Scheme -ne "https" -or [string]::IsNullOrWhiteSpace($uri.Host)) {
  throw "PublicUrl must be an absolute HTTPS URL."
}

$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if ($null -eq $cloudflared) {
  throw "cloudflared is not installed. Install it, authenticate this Windows user with 'cloudflared tunnel login', then rerun this script."
}

$configRoot = Join-Path $env:USERPROFILE ".cloudflared"
$configPath = Join-Path $configRoot "yellow-mobile.yml"
New-Item -ItemType Directory -Path $configRoot -Force | Out-Null

$hostname = $uri.Host
$service = "http://127.0.0.1:$LocalPort"
$config = @"
tunnel: $TunnelName
credentials-file: $configRoot\$TunnelName.json
ingress:
  - hostname: $hostname
    service: $service
  - service: http_status:404
"@

Set-Content -LiteralPath $configPath -Value $config -Encoding UTF8

Write-Host "Stable Yellow mobile tunnel config written:"
Write-Host "  $configPath"
Write-Host ""
Write-Host "One-time Cloudflare setup, if not already done:"
Write-Host "  cloudflared tunnel create $TunnelName"
Write-Host "  cloudflared tunnel route dns $TunnelName $hostname"
Write-Host ""
Write-Host "Run the tunnel:"
Write-Host "  cloudflared tunnel --config `"$configPath`" run $TunnelName"
Write-Host ""
Write-Host "Build the Android shell against the stable URL:"
Write-Host "  `$env:YELLOW_PUBLIC_URL = '$PublicUrl'"
Write-Host "  gradle --no-daemon clean assembleDebug"

if ($InstallService) {
  Write-Host ""
  Write-Host "Installing cloudflared as a Windows service for this stable tunnel..."
  & $cloudflared.Source service install --config $configPath
}
