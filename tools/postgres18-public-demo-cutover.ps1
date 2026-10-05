param(
  [string]$SourceDir = "D:\Yellow\git-live-order611-source-v2",
  [string]$RuntimeDir = "D:\Yellow\runtime",
  [string]$EnvPath = "D:\Yellow\runtime\yellow-public-demo.env",
  [string]$ProjectName = "yellow-public-demo",
  [string]$DatabaseName = "yellow_public_demo",
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

function Read-YellowEnv {
  param([string]$Path)
  $map = @{}
  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line.Trim().Length -eq 0 -or $line.TrimStart().StartsWith("#")) { continue }
    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { continue }
    $map[$line.Substring(0, $idx)] = $line.Substring($idx + 1)
  }
  return $map
}

function ComposeArgs {
  return @(
    "compose",
    "--env-file", $EnvPath,
    "-f", (Join-Path $SourceDir "docker-compose.yml"),
    "-f", (Join-Path $RuntimeDir "yellow-public-demo.compose.yml"),
    "-f", (Join-Path $RuntimeDir "yellow-public-demo-tunnel.compose.yml"),
    "-p", $ProjectName
  )
}

function Wait-PostgresReady {
  param([string]$Container)
  for ($i = 0; $i -lt 90; $i++) {
    & docker exec $Container pg_isready -U $DeployRole -d $DatabaseName *> $null
    if ($LASTEXITCODE -eq 0) { return }
    Start-Sleep -Seconds 1
  }
  & docker logs $Container --tail 120
  throw "PostgreSQL did not become ready: $Container"
}

function Initialize-YellowRoles {
  param([hashtable]$Env)
  $runtimePassword = ($Env["YELLOW_RUNTIME_DATABASE_PASSWORD"] -replace "'", "''")
  $registrarPassword = ($Env["YELLOW_EXTENSION_REGISTRAR_DATABASE_PASSWORD"] -replace "'", "''")
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
    create role yellow_runtime login password '$runtimePassword';
  else
    alter role yellow_runtime login password '$runtimePassword';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'yellow_extension_registrar') then
    create role yellow_extension_registrar login password '$registrarPassword';
  else
    alter role yellow_extension_registrar login password '$registrarPassword';
  end if;
end
`$`$;
grant app_role to yellow_runtime;
grant yellow_owner to yellow_deploy;
"@
  Invoke-Docker @("exec", "yellow-public-demo-postgres-1", "psql", "-U", $DeployRole, "-d", $DatabaseName, "-v", "ON_ERROR_STOP=1", "-c", $sql)
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
  Invoke-Docker @("exec", "yellow-public-demo-postgres-1", "psql", "-U", $DeployRole, "-d", $DatabaseName, "-v", "ON_ERROR_STOP=1", "-c", "select version();", "-c", $countQuery, "-c", $safetyQuery)
}

if (-not (Test-Path -LiteralPath $EnvPath)) { throw "Env file not found: $EnvPath" }
if (-not (Test-Path -LiteralPath (Join-Path $SourceDir "docker-compose.yml"))) { throw "Source compose not found: $SourceDir" }

$envMap = Read-YellowEnv -Path $EnvPath
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = "D:\Yellow\backups\postgres18-cutover-$stamp"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
$dumpPath = Join-Path $backupDir "yellow-public-demo-before-pg18.dump"

Invoke-Docker @("exec", "yellow-public-demo-postgres-1", "pg_dump", "-U", $DeployRole, "-d", $DatabaseName, "-Fc", "-f", "/tmp/yellow-public-demo-before-pg18.dump")
Invoke-Docker @("cp", "yellow-public-demo-postgres-1:/tmp/yellow-public-demo-before-pg18.dump", $dumpPath)

Invoke-Docker @((ComposeArgs) + @("stop", "app", "postgres"))
Invoke-Docker @((ComposeArgs) + @("up", "-d", "--force-recreate", "postgres"))
Wait-PostgresReady -Container "yellow-public-demo-postgres-1"
Initialize-YellowRoles -Env $envMap
Invoke-Docker @("cp", $dumpPath, "yellow-public-demo-postgres-1:/tmp/yellow-public-demo-before-pg18.dump")
Invoke-Docker @("exec", "yellow-public-demo-postgres-1", "pg_restore", "-U", $DeployRole, "-d", $DatabaseName, "--clean", "--if-exists", "/tmp/yellow-public-demo-before-pg18.dump")
Invoke-ProofChecks
Invoke-Docker @((ComposeArgs) + @("up", "-d", "--build", "app", "tunnel"))

Write-Host "PostgreSQL 18 public-demo cutover complete. Backup dump: $dumpPath"
