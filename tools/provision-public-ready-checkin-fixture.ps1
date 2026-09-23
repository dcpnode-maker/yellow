param(
  [string]$BaseUrl = "http://127.0.0.1:3010",
  [string]$PropertyId = "6081b544-22a1-534f-a86d-bb1ae0519e14",
  [string]$ReservationId = "9f483430-d582-5364-ba49-55d9e651cf77",
  [string]$SpaceId = "53bc519b-ec3d-5841-af9e-ca49cdfa5af0",
  [string]$ActorId = "9f90d3e9-94f9-54de-95ec-35bd00b99b15",
  [string]$PgContainer = "yellow-public-demo-postgres-1",
  [string]$PgUser = "yellow_deploy",
  [string]$PgDatabase = "yellow_public_demo"
)

$ErrorActionPreference = "Stop"

$login = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/demo:enter"
$headers = @{
  authorization = "Bearer $($login.accessToken)"
  "content-type" = "application/json"
  "idempotency-key" = "order634-ready-checkin-primary-folio-v1"
}

Invoke-RestMethod `
  -Method Post `
  -Headers $headers `
  -Uri "$BaseUrl/api/v1/properties/$PropertyId/reservations/$ReservationId/primary-folio" `
  -Body "{}" | Out-Null

$sql = @"
UPDATE public.unit_condition
   SET condition = 'inspected',
       updated_at = date_trunc('milliseconds', clock_timestamp()),
       updated_by = '$ActorId'::uuid
 WHERE space_id = '$SpaceId'::uuid
   AND tenant_id = '6d9b7ce2-2d14-5576-b8c3-80f06501a603'::uuid
   AND condition <> 'inspected';
"@

docker exec -i $PgContainer psql -U $PgUser -d $PgDatabase -v ON_ERROR_STOP=1 -c $sql | Out-String | Write-Host

$readiness = Invoke-RestMethod `
  -Headers @{ authorization = "Bearer $($login.accessToken)" } `
  -Uri "$BaseUrl/api/v1/properties/$PropertyId/reservations/$ReservationId/check-in/readiness"

$readiness | ConvertTo-Json -Depth 10

if ($readiness.canCheckIn -ne $true -or $readiness.blockers.Count -ne 0) {
  throw "Ready check-in fixture did not become check-in ready."
}
