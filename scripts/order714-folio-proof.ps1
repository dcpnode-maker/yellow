param(
    [string]$Suffix = ((Get-Date -Format 'yyyyMMddHHmmss') + '_' + (Get-Random -Minimum 1000 -Maximum 9999))
)

$ErrorActionPreference = 'Stop'
$container = 'yellow-public-demo-postgres-1'
$appContainer = 'yellow-public-demo-app-1'
$sourceDatabase = 'yellow_public_demo'
$port = '55432'

if ($Suffix -cnotmatch '^[a-z0-9_]{4,40}$') { throw 'Invalid proof suffix' }
$proofDatabase = "yellow_order714_proof_$Suffix"
if ($proofDatabase.Length -gt 63) { throw 'Proof database identifier is too long' }

function Invoke-ProofPsql([string]$Database, [string]$Statement) {
    $result = @(& docker exec $container psql -U yellow_deploy -d $Database -X -A -t -q -v ON_ERROR_STOP=1 -c $Statement 2>&1)
    if ($LASTEXITCODE -ne 0) { throw "PostgreSQL proof operation failed for $Database" }
    return @($result | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
}

function Get-ContainerEnvironment([string]$Name) {
    $json = & docker inspect --format '{{json .Config.Env}}' $Name 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $json) { throw "Expected container unavailable: $Name" }
    $result = @{}
    foreach ($line in ($json | ConvertFrom-Json)) {
        $separator = $line.IndexOf('=')
        if ($separator -gt 0) { $result[$line.Substring(0, $separator)] = $line.Substring($separator + 1) }
    }
    return $result
}

$publishedPort = @(& docker port $container 5432/tcp 2>$null)
if ($LASTEXITCODE -ne 0 -or $publishedPort.Count -ne 1 -or $publishedPort[0] -cne "127.0.0.1:$port") {
    throw 'PostgreSQL service port differs from the reviewed loopback endpoint'
}
$postgresEnvironment = Get-ContainerEnvironment $container
$appEnvironment = Get-ContainerEnvironment $appContainer
if ($postgresEnvironment['POSTGRES_DB'] -cne $sourceDatabase -or
    $postgresEnvironment['POSTGRES_USER'] -cne 'yellow_deploy' -or
    [string]::IsNullOrWhiteSpace($postgresEnvironment['POSTGRES_PASSWORD'])) {
    throw 'Existing PostgreSQL service identity differs from the reviewed target'
}
$runtimeOriginal = [Uri]$appEnvironment['YELLOW_RUNTIME_DATABASE_URL']
if ($runtimeOriginal.Scheme -cne 'postgres' -or $runtimeOriginal.Host -cne 'postgres' -or
    $runtimeOriginal.Port -ne 5432 -or $runtimeOriginal.AbsolutePath -cne "/$sourceDatabase" -or
    $runtimeOriginal.UserInfo -cnotmatch '^yellow_runtime:[^:]+$' -or
    $runtimeOriginal.Query -ne '' -or $runtimeOriginal.Fragment -ne '') {
    throw 'Existing runtime identity differs from the reviewed target'
}

$sourceIdentity = @(Invoke-ProofPsql $sourceDatabase 'SELECT current_database(), session_user;')
if ($sourceIdentity.Count -ne 1 -or $sourceIdentity[0] -cne "$sourceDatabase|yellow_deploy") {
    throw 'Source database identity check failed'
}
$existing = @(Invoke-ProofPsql postgres "SELECT count(*) FROM pg_database WHERE datname = '$proofDatabase';")
if ($existing.Count -ne 1 -or $existing[0] -cne '0') { throw 'Proof database already exists; refusing reuse' }

Write-Output "Creating fresh isolated proof database: $proofDatabase"
Invoke-ProofPsql postgres "CREATE DATABASE $proofDatabase TEMPLATE template0 OWNER yellow_deploy;" | Out-Null
$created = @(Invoke-ProofPsql postgres "SELECT datname, pg_get_userbyid(datdba) FROM pg_database WHERE datname = '$proofDatabase';")
if ($created.Count -ne 1 -or $created[0] -cne "$proofDatabase|yellow_deploy") {
    throw 'Created database identity check failed; proof database preserved'
}

# The source command is schema-only. A single target transaction prevents partial
# restoration; neither command touches source data or cluster-wide roles.
$restore = "set -o pipefail; pg_dump -U yellow_deploy -d $sourceDatabase --schema-only --no-comments | psql -U yellow_deploy -d $proofDatabase -X -q -1 -v ON_ERROR_STOP=1"
& docker exec $container sh -c $restore 2>$null
if ($LASTEXITCODE -ne 0) { throw 'Schema-only restore failed; proof database preserved' }

$isolation = @(Invoke-ProofPsql $proofDatabase 'SELECT current_database(), session_user, (SELECT count(*) FROM public.tenant), (SELECT count(*) FROM public.schema_migration);')
if ($isolation.Count -ne 1 -or $isolation[0] -cne "$proofDatabase|yellow_deploy|0|0") {
    throw 'Post-restore isolation check failed; proof database preserved'
}
Write-Output 'Schema-only restore verified: exact database, deploy role, zero tenants, zero migration rows.'

$deployPassword = $postgresEnvironment['POSTGRES_PASSWORD']
$deployEncoded = [Uri]::EscapeDataString($deployPassword)
$deployUrl = "postgres://yellow_deploy:$deployEncoded@127.0.0.1:$port/$proofDatabase"
$runtimeUrl = "postgres://$($runtimeOriginal.UserInfo)@127.0.0.1:$port/$proofDatabase"
if ($deployUrl -ceq $runtimeUrl) { throw 'Deploy and runtime URLs must be distinct' }

$previous = @{}
foreach ($name in @('YELLOW_DEPLOY_DATABASE_URL','YELLOW_RUNTIME_DATABASE_URL','YELLOW_FOLIO_TRANSFERS_URL','YELLOW_REQUIRE_FOLIO_TRANSFERS')) {
    $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
try {
    $env:YELLOW_DEPLOY_DATABASE_URL = $deployUrl
    $env:YELLOW_RUNTIME_DATABASE_URL = $runtimeUrl
    $env:YELLOW_FOLIO_TRANSFERS_URL = $runtimeUrl
    $env:YELLOW_REQUIRE_FOLIO_TRANSFERS = '1'

    $identityCode = @'
import { SQL } from "bun";
for (const [name, expectedRole] of [["YELLOW_DEPLOY_DATABASE_URL", "yellow_deploy"], ["YELLOW_RUNTIME_DATABASE_URL", "yellow_runtime"]]) {
  const db = new SQL(process.env[name]);
  try {
    const rows = await db`SELECT current_database() AS database, session_user AS role`;
    if (rows.length !== 1 || rows[0].database !== process.env.YELLOW_PROOF_DATABASE || rows[0].role !== expectedRole) throw new Error("proof URL identity mismatch");
    console.log(`${expectedRole}: exact proof database verified`);
  } finally { await db.close(); }
}
'@
    $env:YELLOW_PROOF_DATABASE = $proofDatabase
    $identityOutput = @(& bun -e $identityCode 2>&1)
    if ($LASTEXITCODE -ne 0) { throw 'Deploy/runtime authentication or exact-database check failed; proof database preserved' }
    $identityOutput | ForEach-Object { Write-Output $_ }

    Write-Output 'Running required folio transfer and additional-window suite against the isolated proof database.'
    $testOutput = @(& bun test tests/financial-folio-transfers.integration.test.ts 2>&1)
    $testStatus = $LASTEXITCODE
    $testOutput | ForEach-Object {
        $safe = [string]$_
        $safe = $safe.Replace($deployPassword, '[REDACTED]')
        $safe = $safe.Replace($runtimeOriginal.UserInfo, '[REDACTED]')
        Write-Output $safe
    }
    if ($testStatus -ne 0) { throw 'Required folio transfer and additional-window suite failed; proof database preserved' }
    Write-Output "Proof passed; isolated database retained for review: $proofDatabase"
} finally {
    foreach ($name in $previous.Keys) {
        [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process')
    }
    Remove-Item Env:YELLOW_PROOF_DATABASE -ErrorAction SilentlyContinue
}
