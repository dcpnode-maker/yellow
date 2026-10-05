[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [ValidateSet('oneplus10r','oneplus11r','nord5')]
  [string]$Worker,

  [Parameter(Mandatory)]
  [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
  [string]$ApiKeyFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ports = @{ oneplus10r = 11435; oneplus11r = 11436; nord5 = 11437 }
$localPort = $ports[$Worker]
$endpoint = "http://127.0.0.1:$localPort"
$apiKey = (Get-Content -LiteralPath $ApiKeyFile -Raw).Trim()
if ([string]::IsNullOrWhiteSpace($apiKey)) {
  throw 'The phone worker API-key file is empty.'
}

$headers = @{ Authorization = "Bearer $apiKey" }
$health = Invoke-WebRequest -UseBasicParsing -Uri "$endpoint/health" -Headers $headers -TimeoutSec 5
$models = Invoke-WebRequest -UseBasicParsing -Uri "$endpoint/v1/models" -Headers $headers -TimeoutSec 5

if ($health.StatusCode -ne 200 -or $models.StatusCode -ne 200) {
  throw 'The authenticated phone worker probe did not return HTTP 200.'
}

[pscustomobject]@{
  action = 'phone-worker-probe'
  worker = $Worker
  endpoint = $endpoint
  health_status = [int]$health.StatusCode
  models_status = [int]$models.StatusCode
  authenticated = $true
  public_bind = $false
  secret_printed = $false
} | ConvertTo-Json -Compress
