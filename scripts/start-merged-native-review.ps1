[CmdletBinding()]
param([Parameter(Mandatory)][string]$DatabasePassword)

# Order442/Q200: one source-exact, loopback-only synthetic Windows preview.
$ErrorActionPreference = 'Stop'
$sourceRoot = Split-Path $PSScriptRoot -Parent
$git = 'C:\Users\astha\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe'
$bun = 'C:\Users\astha\.bun\bin\bun.exe'
$pg = 'E:\yellow\toolchains\postgresql-16.15\pgsql\bin\psql.exe'
$python = 'C:\Users\astha\AppData\Local\Programs\Python\Python313\python.exe'
$revision = 'b5ef70842b658183f7b5b4c650c8e78c7a0b513d'
$runtimeRoot = 'D:\Yellow\runtime'
$appRoot = Join-Path $runtimeRoot 'main-b5ef708'
$control = Join-Path $runtimeRoot 'order442-review'
$reviewDb = 'yellow_order442_review'
$refereeDb = 'yellow_order442_invariants'

function Check-Exit([string]$Operation) { if ($LASTEXITCODE -ne 0) { throw "$Operation failed; inspect private local logs" } }
function Sql([string]$Db,[string]$Statement) {
    $value = @(& $pg -h 127.0.0.1 -p 55503 -U yellow_deploy -d $Db -X -A -t -v ON_ERROR_STOP=1 -c $Statement)
    Check-Exit 'PostgreSQL operation'
    return $value
}
function New-Secret { return [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant() }
function Private-File([string]$Path,[string]$Text) {
    [IO.File]::WriteAllText($Path,$Text,[Text.UTF8Encoding]::new($false))
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    $acl = Get-Acl -LiteralPath $Path
    $acl.SetAccessRuleProtection($true,$false)
    foreach ($rule in @($acl.Access)) { [void]$acl.RemoveAccessRuleAll($rule) }
    $acl.SetOwner([Security.Principal.NTAccount]::new($identity))
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity,'FullControl','Allow'))
    Set-Acl -LiteralPath $Path -AclObject $acl
    $actual = Get-Acl -LiteralPath $Path
    if (-not $actual.AreAccessRulesProtected -or @($actual.Access).Count -ne 1 -or $actual.Owner -ne $identity) { throw 'Private file ACL verification failed' }
}

if ((Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)) { throw 'Port3000 already belongs to a process; refusing replacement' }
if ((Test-Path -LiteralPath $appRoot) -or (Test-Path -LiteralPath $control)) { throw 'This first-provision command never overwrites existing runtime directories' }
if ((& $bun --version).Trim() -ne '1.3.14') { throw 'Unexpected native Bun version' }
foreach ($identityFile in @('package.json','bun.lock','bunfig.toml')) {
    & $git -C $sourceRoot diff --exit-code $revision -- $identityFile | Out-Null
    Check-Exit 'Source/dependency identity'
}
[IO.Directory]::CreateDirectory($control) | Out-Null
$archive = Join-Path $control 'merged-main-source.zip'
& $git -C $sourceRoot archive --format=zip "--output=$archive" $revision
Check-Exit 'Exact main archive'
Expand-Archive -LiteralPath $archive -DestinationPath $appRoot
New-Item -ItemType Junction -Path (Join-Path $appRoot 'node_modules') -Target (Join-Path $sourceRoot 'node_modules') | Out-Null
$env:PGPASSWORD = $DatabasePassword
$env:PGCONNECT_TIMEOUT = '5'
$env:TEMP = 'D:\Yellow\temp'
$env:TMP = 'D:\Yellow\temp'
try {
    $version = @(Sql 'postgres' 'SHOW server_version_num;')[0]
    if ($version -ne '160015') { throw 'Expected native PostgreSQL16.15' }
    $catalogue = @(Sql 'yellow_order434_production' "SELECT (SELECT count(*) FROM schema_migration)||'|'||(SELECT count(*) FROM pg_tables WHERE schemaname='public')||'|'||(SELECT count(*) FROM tenant);")[0]
    if ($catalogue -ne '77|127|0') { throw 'Template is not the pristine77/127 zero-tenant proof source' }
    $active = @(Sql 'postgres' "SELECT count(*) FROM pg_stat_activity WHERE datname='yellow_order434_production';")[0]
    if ($active -ne '0') { throw 'Template currently has clients; do not force disconnect them' }
    $existing = @(Sql 'postgres' "SELECT count(*) FROM pg_database WHERE datname IN ('$reviewDb','$refereeDb');")[0]
    if ($existing -ne '0') { throw 'Preview target database already exists; refusing replacement' }
    Sql 'postgres' "CREATE DATABASE $reviewDb TEMPLATE yellow_order434_production OWNER yellow_deploy;" | Out-Null
    Sql 'postgres' "CREATE DATABASE $refereeDb TEMPLATE yellow_order434_production OWNER yellow_deploy;" | Out-Null
    $operator = New-Secret
    $approver = New-Secret
    $jwt = New-Secret
    $appEnv = Join-Path $control 'app.env'
    $seedEnv = Join-Path $control 'seed.env'
    Private-File $seedEnv "YELLOW_DEPLOY_DATABASE_URL=postgres://yellow_deploy:${DatabasePassword}@127.0.0.1:55503/$reviewDb`nYELLOW_REVIEW_PASSWORD=$operator`nYELLOW_REVIEW_APPROVER_PASSWORD=$approver`n"
    $appLines = @(
        'NODE_ENV=production','HOST=127.0.0.1','PORT=3000',"YELLOW_BUILD_SHA=$revision",
        'YELLOW_OPERATOR_WORKBENCH=1','YELLOW_LOCAL_REVIEW_PREFILL=1',
        'YELLOW_LOCAL_REVIEW_TENANT=yellow-demo','YELLOW_LOCAL_REVIEW_EMAIL=operator@yellow.local',
        "YELLOW_LOCAL_REVIEW_PASSWORD=$operator","YELLOW_TOKEN_SECRET=$jwt",
        "YELLOW_RUNTIME_DATABASE_URL=postgres://yellow_runtime:${DatabasePassword}@127.0.0.1:55503/$reviewDb",
        "YELLOW_EXTENSION_REGISTRAR_DATABASE_URL=postgres://yellow_extension_registrar:${DatabasePassword}@127.0.0.1:55503/$reviewDb",
        'YELLOW_HOLD_EXPIRY_WORKER=1','YELLOW_AVAILABILITY_PROJECTION_WORKER=1',
        'YELLOW_PICKUP_TASK_WORKER=1','YELLOW_RESERVATION_ARRIVAL_ROLL_WORKER=1',
        'YELLOW_RESERVATION_DEPARTURE_ROLL_WORKER=1','YELLOW_BUSINESS_DAY_ROLL_WORKER=1'
    )
    Private-File $appEnv (($appLines -join "`n")+"`n")
    Push-Location $appRoot
    try {
        foreach ($targetDb in @($reviewDb,$refereeDb)) {
            $env:YELLOW_DEPLOY_DATABASE_URL="postgres://yellow_deploy:${DatabasePassword}@127.0.0.1:55503/$targetDb"
            & $bun scripts/migrate.ts *> (Join-Path $control "$targetDb-migration.log")
            Check-Exit 'Canonical migration checksum verification'
        }
        $env:YELLOW_DEPLOY_DATABASE_URL=$null
        & $bun "--env-file=$seedEnv" scripts/seed.ts *> (Join-Path $control 'seed.log')
        Check-Exit 'Canonical review seed'
        & $bun "--env-file=$seedEnv" scripts/seed-review.ts *> (Join-Path $control 'review-seed.log')
        Check-Exit 'Synthetic review seed'
        & $pg -h 127.0.0.1 -p 55503 -U yellow_deploy -d $refereeDb -X -v ON_ERROR_STOP=1 -f tests/seed_fixture.sql *> (Join-Path $control 'referee-fixture.log')
        Check-Exit 'Referee fixture'
        $env:YELLOW_DSN="dbname=$refereeDb user=yellow_deploy password=$DatabasePassword host=127.0.0.1 port=55503"
        $env:PYTHONIOENCODING='utf-8'
        & $python tests/run_invariants.py $refereeDb *> (Join-Path $control 'referee.log')
        Check-Exit '11-invariant referee'
        $referee = Get-Content -LiteralPath (Join-Path $control 'referee.log') -Raw
        if ($referee -notmatch '11 passed, 0 failed of 11') { throw 'Canonical referee did not report11/11' }
        foreach ($name in @('YELLOW_DSN','YELLOW_DEPLOY_DATABASE_URL','PGPASSWORD','YELLOW_REVIEW_PASSWORD','YELLOW_REVIEW_APPROVER_PASSWORD','YELLOW_HOSTED_DEPOSIT_WORKBENCH','YELLOW_HOSTED_PROVIDER_ONLY','YELLOW_OPERATOR_ALLOW_NON_LOOPBACK')) {
            [Environment]::SetEnvironmentVariable($name,$null,'Process')
        }
        $process = Start-Process -FilePath $bun -ArgumentList @("--env-file=$appEnv",'src/server.ts') -WorkingDirectory $appRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $control 'app.stdout.log') -RedirectStandardError (Join-Path $control 'app.stderr.log') -PassThru
        $ready = $null
        foreach ($attempt in 1..30) {
            try { $ready=Invoke-RestMethod 'http://127.0.0.1:3000/ready' -TimeoutSec 2; if($ready.status -eq 'ready'){break} } catch { }
            if ($process.HasExited) { throw 'Native app exited; inspect app.stderr.log' }
            Start-Sleep -Milliseconds 500
        }
        if ($ready.status -ne 'ready' -or $ready.target -ne 'yellow_runtime_database' -or $ready.build.revision -ne $revision -or $ready.build.expectedMigrationFrontier -ne 77) { throw 'Exact-source local readiness failed' }
        $login = Invoke-RestMethod 'http://127.0.0.1:3000/api/v1/auth/local:login' -Method Post -ContentType 'application/json' -Body (@{tenant='yellow-demo';email='operator@yellow.local';password=$operator} | ConvertTo-Json) -TimeoutSec 10
        if ($login.tokenType -ne 'Bearer' -or -not $login.accessToken) { throw 'Synthetic review login failed' }
        $receipt = @{source=$revision;sourceArchiveSha256=(Get-FileHash -LiteralPath $archive).Hash;port=3000;database=$reviewDb;postgresPort=55503;pid=$process.Id;startedUtc=$process.StartTime.ToUniversalTime().ToString('o');referee='11/11';ready=$ready;loginVerified=$true;usesWsl=$false;usesDocker=$false;dependencyJunction=(Join-Path $sourceRoot 'node_modules')}
        [IO.File]::WriteAllText((Join-Path $control 'receipt.json'),($receipt | ConvertTo-Json -Depth 8),[Text.UTF8Encoding]::new($false))
        [pscustomobject]@{Url='http://127.0.0.1:3000';Revision=$revision;Pid=$process.Id;Database=$reviewDb;Referee='11/11';LoginVerified=$true;CredentialsPrefilled=$true}
    } finally { Pop-Location }
} finally {
    $env:PGPASSWORD=$null
    $env:YELLOW_DSN=$null
    $env:YELLOW_DEPLOY_DATABASE_URL=$null
}
