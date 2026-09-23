param(
  [Parameter(Mandatory = $true)][string]$SourceContainer,
  [Parameter(Mandatory = $true)][string]$RollbackContainer,
  [Parameter(Mandatory = $true)][string]$ReplacementContainer,
  [Parameter(Mandatory = $true)][string]$ReplacementImage
)

$ErrorActionPreference = "Stop"

foreach ($name in @($SourceContainer, $RollbackContainer, $ReplacementContainer)) {
  if ($name -notmatch '^yellow-order[0-9]+-app(?:-rollback-d[0-9]+)?$') {
    throw "Refusing an unexpected local app container name."
  }
}
if ($ReplacementImage -notmatch '^yellow-order[0-9]+-app:[a-f0-9]{7,40}$') {
  throw "Refusing an unexpected local app image name."
}

$allNames = docker ps -a --format "{{.Names}}"
if ($allNames -notcontains $SourceContainer) { throw "Source app container is absent." }
if ($allNames -contains $RollbackContainer) { throw "Rollback container name already exists." }
if ($allNames -contains $ReplacementContainer) { throw "Replacement container name already exists." }

$source = (docker inspect $SourceContainer | ConvertFrom-Json)[0]
$network = $source.NetworkSettings.Networks.PSObject.Properties.Name | Select-Object -First 1
if (-not $network) { throw "Source app has no attached network." }

$environmentArguments = @()
foreach ($entry in $source.Config.Env) {
  $environmentArguments += "--env"
  $environmentArguments += $entry
}
$runArguments = @(
  "run", "-d", "--name", $ReplacementContainer,
  "--network", $network,
  "--publish", "127.0.0.1:3000:3000",
  "--health-cmd", "wget -q -O /dev/null http://127.0.0.1:3000/health",
  "--health-interval", "3s", "--health-timeout", "3s", "--health-retries", "30"
) + $environmentArguments + @($ReplacementImage)

docker stop --time 20 $SourceContainer | Out-Null
docker rename $SourceContainer $RollbackContainer
try {
  & docker @runArguments | Out-Null
  $healthy = $false
  for ($attempt = 0; $attempt -lt 40; $attempt += 1) {
    Start-Sleep -Milliseconds 500
    $state = docker inspect $ReplacementContainer --format "{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}"
    if ($state -eq "running|healthy") { $healthy = $true; break }
    if ($state -like "exited*" -or $state -like "dead*") { break }
  }
  if (-not $healthy) { throw "Replacement app did not become healthy." }
  $health = (Invoke-WebRequest -UseBasicParsing -TimeoutSec 10 "http://127.0.0.1:3000/health").Content
  if ($health -ne '{"status":"ok"}') { throw "Replacement app returned an unexpected health body." }
  Write-Output "CUTOVER=healthy"
} catch {
  $exactReplacement = docker ps -a --format "{{.Names}}" | Where-Object { $_ -eq $ReplacementContainer }
  if ($exactReplacement) { docker rm -f $ReplacementContainer 2>$null | Out-Null }
  docker rename $RollbackContainer $SourceContainer
  docker start $SourceContainer | Out-Null
  throw
}
