param(
  [string]$Container = "yellow-public-demo-postgres-1",
  [string]$Database = "yellow_public_demo",
  [string]$DeployRole = "yellow_deploy"
)

$ErrorActionPreference = "Stop"

function Invoke-Docker {
  param([Parameter(ValueFromRemainingArguments = $true)][object[]]$Args)
  $dockerArgs = @()
  foreach ($arg in $Args) {
    if ($arg -is [array]) {
      foreach ($item in $arg) { $dockerArgs += [string]$item }
    } else {
      $dockerArgs += [string]$arg
    }
  }
  & docker @dockerArgs
  if ($LASTEXITCODE -ne 0) { throw "docker $($dockerArgs -join ' ') failed with exit code $LASTEXITCODE" }
}

$sql = @'
BEGIN;
SELECT set_config('app.tenant_id', '6d9b7ce2-2d14-5576-b8c3-80f06501a603', true);

WITH coded AS (
  SELECT id,
         CASE
           WHEN confirmation_no IN ('L3R-FU-0030','L3R-FU-0031','L3R-FU-0032','L3R-FU-0033') THEN 'MICE'
           WHEN confirmation_no IN ('L3R-FU-0034','L3R-FU-0035','L3R-FU-0036','L3R-FU-0037') THEN 'SOCIAL'
           WHEN lower(channel_code) IN ('booking.com','airbnb','expedia','agoda') THEN 'OTA_RETAIL'
           WHEN lower(channel_code) IN ('direct','website','web') THEN 'RETAIL'
           ELSE 'TRANSIENT'
         END AS market_code,
         CASE
           WHEN confirmation_no IN ('L3R-FU-0030','L3R-FU-0031','L3R-FU-0032','L3R-FU-0033') THEN 'CORP'
           WHEN confirmation_no IN ('L3R-FU-0034','L3R-FU-0035','L3R-FU-0036','L3R-FU-0037') THEN 'TRAVEL_TRADE'
           WHEN lower(channel_code) = 'booking.com' THEN 'BOOKING'
           WHEN lower(channel_code) = 'airbnb' THEN 'AIRBNB'
           WHEN lower(channel_code) = 'expedia' THEN 'EXPEDIA'
           WHEN lower(channel_code) = 'agoda' THEN 'AGODA'
           WHEN lower(channel_code) IN ('direct','website','web') THEN 'WEBSITE'
           ELSE upper(regexp_replace(channel_code, '[^A-Za-z0-9]+', '_', 'g'))
         END AS source_code
  FROM reservation
  WHERE tenant_id='6d9b7ce2-2d14-5576-b8c3-80f06501a603'::uuid
    AND property_node='6081b544-22a1-534f-a86d-bb1ae0519e14'::uuid
)
UPDATE reservation AS reservation
SET market_code = coded.market_code,
    source_code = coded.source_code
FROM coded
WHERE reservation.id = coded.id
  AND reservation.tenant_id='6d9b7ce2-2d14-5576-b8c3-80f06501a603'::uuid
  AND reservation.property_node='6081b544-22a1-534f-a86d-bb1ae0519e14'::uuid
  AND (reservation.market_code IS DISTINCT FROM coded.market_code
       OR reservation.source_code IS DISTINCT FROM coded.source_code);

COMMIT;

SELECT channel_code, market_code, source_code, count(*)::int AS reservations
FROM reservation
WHERE tenant_id='6d9b7ce2-2d14-5576-b8c3-80f06501a603'::uuid
  AND property_node='6081b544-22a1-534f-a86d-bb1ae0519e14'::uuid
GROUP BY channel_code, market_code, source_code
ORDER BY reservations DESC, channel_code, market_code, source_code;
'@

$tempSql = "/tmp/yellow-public-commercial-codes.sql"
$localTemp = Join-Path $env:TEMP "yellow-public-commercial-codes.sql"
Set-Content -LiteralPath $localTemp -Value $sql -Encoding UTF8
try {
  Invoke-Docker @("cp", $localTemp, "$($Container):$tempSql")
  Invoke-Docker @("exec", $Container, "psql", "-U", $DeployRole, "-d", $Database, "-v", "ON_ERROR_STOP=1", "-f", $tempSql)
} finally {
  Remove-Item -LiteralPath $localTemp -Force -ErrorAction SilentlyContinue
}
