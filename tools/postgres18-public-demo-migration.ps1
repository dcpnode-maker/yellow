param(
  [Parameter(Mandatory = $true)]
  [string]$DumpPath,

  [string]$PostgresImage = "postgres:18.6-alpine",
  [string]$ProofContainer = "yellow-pg18-proof",
  [string]$ProofVolume = "yellow-pg18-migration-proof",
  [int]$ProofPort = 55433,

  [string]$DatabaseName = "yellow_public_demo",
  [string]$DeployRole = "yellow_deploy",
  [string]$ProofPassword = "yellow_proof",

  [switch]$ResetProof,
  [switch]$Cutover
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $DumpPath)) {
  throw "Dump not found: $DumpPath"
}

function Invoke-Docker {
  param([Parameter(ValueFromRemainingArguments = $true)][object[]]$Args)
  $dockerArgs = @()
  foreach ($arg in $Args) {
    if ($arg -is [array]) {
      foreach ($item in $arg) {
        $dockerArgs += [string]$item
      }
    } else {
      $dockerArgs += [string]$arg
    }
  }
  & docker @dockerArgs
  if ($LASTEXITCODE -ne 0) {
    throw "docker $($dockerArgs -join ' ') failed with exit code $LASTEXITCODE"
  }
}

function Wait-PostgresReady {
  param([string]$Container, [string]$Role, [string]$Db)
  for ($i = 0; $i -lt 60; $i++) {
    & docker exec $Container pg_isready -U $Role -d $Db *> $null
    if ($LASTEXITCODE -eq 0) { return }
    Start-Sleep -Seconds 1
  }
  & docker logs $Container --tail 120
  throw "PostgreSQL container did not become ready: $Container"
}

function Start-ProofPostgres18 {
  if ($ResetProof) {
    & docker rm -f $ProofContainer *> $null
    & docker volume rm $ProofVolume *> $null
  }

  $existingContainer = & docker ps -a --filter "name=^/$ProofContainer$" --format "{{.Names}}"
  if ($existingContainer -eq $ProofContainer) {
    Invoke-Docker @("start", $ProofContainer) | Out-Null
    Wait-PostgresReady -Container $ProofContainer -Role $DeployRole -Db $DatabaseName
    return
  }

  $existingVolume = & docker volume ls --format "{{.Name}}" | Where-Object { $_ -eq $ProofVolume }
  if (-not $existingVolume) {
    Invoke-Docker @("volume", "create", $ProofVolume) | Out-Null
  }

  # PostgreSQL 18 Docker images expect the mount at /var/lib/postgresql, not
  # /var/lib/postgresql/data. This preserves major-version-specific data dirs.
  Invoke-Docker @(
    "run",
    "-d",
    "--name", $ProofContainer,
    "-e", "POSTGRES_USER=$DeployRole",
    "-e", "POSTGRES_PASSWORD=$ProofPassword",
    "-e", "POSTGRES_DB=$DatabaseName",
    "-p", "127.0.0.1:$($ProofPort):5432",
    "-v", "$($ProofVolume):/var/lib/postgresql",
    $PostgresImage
  ) | Out-Null

  Wait-PostgresReady -Container $ProofContainer -Role $DeployRole -Db $DatabaseName
}

function Initialize-YellowRoles {
  $sql = @"
do `$`$
begin
  if not exists (select 1 from pg_roles where rolname = 'yellow_owner') then
    create role yellow_owner noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'app_role') then
    create role app_role noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'yellow_runtime') then
    create role yellow_runtime login password 'yellow_runtime_proof';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'yellow_extension_registrar') then
    create role yellow_extension_registrar login password 'yellow_extension_registrar_proof';
  end if;
end
`$`$;
grant app_role to yellow_runtime;
grant yellow_owner to yellow_deploy;
"@
  Invoke-Docker @(
    "exec", $ProofContainer,
    "psql",
    "-U", $DeployRole,
    "-d", $DatabaseName,
    "-v", "ON_ERROR_STOP=1",
    "-c", $sql
  )
}

function Restore-Dump {
  Invoke-Docker @("cp", $DumpPath, "$($ProofContainer):/tmp/yellow_public_demo.dump")
  Invoke-Docker @(
    "exec", $ProofContainer,
    "pg_restore",
    "-U", $DeployRole,
    "-d", $DatabaseName,
    "--clean",
    "--if-exists",
    "/tmp/yellow_public_demo.dump"
  )
}

function Invoke-ProofChecks {
  $countQuery = @"
select 'tenant' as table_name, count(*)::text from tenant
union all select 'reservation', count(*)::text from reservation
union all select 'reservation_segment', count(*)::text from reservation_segment
union all select 'folio', count(*)::text from folio
union all select 'posting_line', count(*)::text from posting_line
union all select 'journal', count(*)::text from journal
union all select 'space_occupancy', count(*)::text from space_occupancy
union all select 'outbox', count(*)::text from outbox
order by table_name;
"@

  $safetyQuery = @"
select 'rls_disabled_tenant_tables' as check_name, count(*)::text as value
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and exists (
    select 1
    from information_schema.columns col
    where col.table_schema = 'public'
      and col.table_name = c.relname
      and col.column_name = 'tenant_id'
  )
  and not c.relrowsecurity
union all
select 'public_views_without_security_invoker', count(*)::text
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'v'
  and not coalesce((
    select bool_or(option_value = 'true')
    from pg_options_to_table(c.reloptions)
    where option_name = 'security_invoker'
  ), false)
union all
select 'invalid_indexes', count(*)::text from pg_index where not indisvalid
union all
select 'invalid_constraints', count(*)::text from pg_constraint where not convalidated;
"@

  Invoke-Docker @(
    "exec", $ProofContainer,
    "psql",
    "-U", $DeployRole,
    "-d", $DatabaseName,
    "-v", "ON_ERROR_STOP=1",
    "-c", "select version();",
    "-c", $countQuery,
    "-c", $safetyQuery
  )
}

if ($Cutover) {
  throw "Cutover intentionally requires a separate reviewed command. This script currently proves PostgreSQL 18 restore safety only."
}

Invoke-Docker @("pull", $PostgresImage)
Start-ProofPostgres18
Initialize-YellowRoles
Restore-Dump
Invoke-ProofChecks

Write-Host "PostgreSQL 18 proof restore complete. Live database was not modified."
