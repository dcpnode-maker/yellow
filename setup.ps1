[CmdletBinding()]
param([switch]$DbOnly)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
Set-Location $root

function Require-Command([string]$Name, [string]$Instruction) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) { throw "Missing $Name. $Instruction" }
}
function Assert-Exit([string]$Operation) {
    if ($LASTEXITCODE -ne 0) { throw "$Operation failed (exit code $LASTEXITCODE)." }
}

function Invoke-Compose {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $false)][AllowEmptyString()][string]$StandardInput
    )
    $previousDeployPassword = $env:YELLOW_DEPLOY_DATABASE_PASSWORD
    $previousRuntimePassword = $env:YELLOW_RUNTIME_DATABASE_PASSWORD
    $previousRegistrarPassword = $env:YELLOW_EXTENSION_REGISTRAR_DATABASE_PASSWORD
    try {
        $env:YELLOW_DEPLOY_DATABASE_PASSWORD = $script:DeployPassword
        $env:YELLOW_RUNTIME_DATABASE_PASSWORD = $script:RuntimePassword
        $env:YELLOW_EXTENSION_REGISTRAR_DATABASE_PASSWORD = $script:RegistrarPassword
        if ($PSBoundParameters.ContainsKey('StandardInput')) {
            $StandardInput | & docker compose @Arguments
        } else {
            & docker compose @Arguments
        }
    } finally {
        $env:YELLOW_DEPLOY_DATABASE_PASSWORD = $previousDeployPassword
        $env:YELLOW_RUNTIME_DATABASE_PASSWORD = $previousRuntimePassword
        $env:YELLOW_EXTENSION_REGISTRAR_DATABASE_PASSWORD = $previousRegistrarPassword
    }
}

Require-Command docker 'Install Docker Desktop or Docker Engine with the Compose plugin.'
Require-Command bun 'Install Bun 1.3.14 from https://bun.sh/docs/installation.'
Require-Command python 'Install CPython 3.12+ and add python to PATH.'
docker compose version *> $null; Assert-Exit 'Docker Compose prerequisite check'
docker info *> $null; Assert-Exit 'Docker daemon prerequisite check'
python -c 'import psycopg2' *> $null
if ($LASTEXITCODE -ne 0) { throw 'Missing psycopg2. Install psycopg2-binary==2.9.12 for the Python invariant referee.' }

$authorityDirectory = Join-Path $root '.yellow'
$authorityFile = Join-Path $authorityDirectory 'runtime-database-authority.env'
[IO.Directory]::CreateDirectory($authorityDirectory) | Out-Null
if (-not (Test-Path -LiteralPath $authorityFile)) {
    $deployBytes = New-Object byte[] 48
    $runtimeBytes = New-Object byte[] 48
    $registrarBytes = New-Object byte[] 48
    [Security.Cryptography.RandomNumberGenerator]::Fill($deployBytes)
    [Security.Cryptography.RandomNumberGenerator]::Fill($runtimeBytes)
    [Security.Cryptography.RandomNumberGenerator]::Fill($registrarBytes)
    $script:DeployPassword = [Convert]::ToBase64String($deployBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
    $script:RuntimePassword = [Convert]::ToBase64String($runtimeBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
    $script:RegistrarPassword = [Convert]::ToBase64String($registrarBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
    [Array]::Clear($deployBytes, 0, $deployBytes.Length)
    [Array]::Clear($runtimeBytes, 0, $runtimeBytes.Length)
    [Array]::Clear($registrarBytes, 0, $registrarBytes.Length)
    $temporaryAuthorityFile = Join-Path $authorityDirectory ("runtime-database-authority.{0}.tmp" -f [Guid]::NewGuid().ToString('N'))
    try {
        [IO.File]::WriteAllText(
            $temporaryAuthorityFile,
            "YELLOW_DEPLOY_DATABASE_PASSWORD=$($script:DeployPassword)`nYELLOW_RUNTIME_DATABASE_PASSWORD=$($script:RuntimePassword)`nYELLOW_EXTENSION_REGISTRAR_DATABASE_PASSWORD=$($script:RegistrarPassword)`n",
            [Text.UTF8Encoding]::new($false)
        )
        Move-Item -LiteralPath $temporaryAuthorityFile -Destination $authorityFile
    } finally {
        Remove-Item -LiteralPath $temporaryAuthorityFile -Force -ErrorAction SilentlyContinue
    }
}
$authorityItem = Get-Item -LiteralPath $authorityFile -Force
if ($authorityItem.PSIsContainer -or ($authorityItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    throw 'Local database authority path must be one regular, non-reparse-point file.'
}
$currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$authorityAcl = Get-Acl -LiteralPath $authorityFile
$authorityRules = @($authorityAcl.Access)
$authorityAclExact = $authorityAcl.Owner -eq $currentIdentity -and
    $authorityAcl.AreAccessRulesProtected -and $authorityRules.Count -eq 1 -and
    $authorityRules[0].IdentityReference.Value -eq $currentIdentity -and
    $authorityRules[0].AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow -and
    (($authorityRules[0].FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -eq
      [Security.AccessControl.FileSystemRights]::FullControl)
if (-not $authorityAclExact) {
    $authorityAcl.SetAccessRuleProtection($true, $false)
    foreach ($rule in @($authorityAcl.Access)) { $authorityAcl.RemoveAccessRuleAll($rule) }
    $authorityAcl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new(
        $currentIdentity,
        [Security.AccessControl.FileSystemRights]::FullControl,
        [Security.AccessControl.AccessControlType]::Allow
    ))
    Set-Acl -LiteralPath $authorityFile -AclObject $authorityAcl
}
$authorityLines = @(Get-Content -LiteralPath $authorityFile)
if (
    ($authorityLines.Count -ne 2 -and $authorityLines.Count -ne 3) -or
    $authorityLines[0] -notmatch '^YELLOW_DEPLOY_DATABASE_PASSWORD=([A-Za-z0-9_-]{43,256})$' -or
    $authorityLines[1] -notmatch '^YELLOW_RUNTIME_DATABASE_PASSWORD=([A-Za-z0-9_-]{43,256})$'
) {
    throw 'Local database authority file is malformed.'
}
$script:DeployPassword = $authorityLines[0].Substring('YELLOW_DEPLOY_DATABASE_PASSWORD='.Length)
$script:RuntimePassword = $authorityLines[1].Substring('YELLOW_RUNTIME_DATABASE_PASSWORD='.Length)
if ($script:DeployPassword -eq $script:RuntimePassword) { throw 'Local database authority passwords must be distinct.' }
if ($authorityLines.Count -eq 2) {
    $registrarBytes = New-Object byte[] 48
    [Security.Cryptography.RandomNumberGenerator]::Fill($registrarBytes)
    $script:RegistrarPassword = [Convert]::ToBase64String($registrarBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
    [Array]::Clear($registrarBytes, 0, $registrarBytes.Length)
    $temporaryAuthorityFile = Join-Path $authorityDirectory ("runtime-database-authority.{0}.tmp" -f [Guid]::NewGuid().ToString('N'))
    $backupAuthorityFile = Join-Path $authorityDirectory ("runtime-database-authority.{0}.backup" -f [Guid]::NewGuid().ToString('N'))
    try {
        [IO.File]::WriteAllText(
            $temporaryAuthorityFile,
            "YELLOW_DEPLOY_DATABASE_PASSWORD=$($script:DeployPassword)`nYELLOW_RUNTIME_DATABASE_PASSWORD=$($script:RuntimePassword)`nYELLOW_EXTENSION_REGISTRAR_DATABASE_PASSWORD=$($script:RegistrarPassword)`n",
            [Text.UTF8Encoding]::new($false)
        )
        [IO.File]::Replace($temporaryAuthorityFile, $authorityFile, $backupAuthorityFile)
    } finally {
        Remove-Item -LiteralPath $temporaryAuthorityFile -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $backupAuthorityFile -Force -ErrorAction SilentlyContinue
    }
    $upgradedAcl = Get-Acl -LiteralPath $authorityFile
    if ($upgradedAcl.Owner -ne $currentIdentity -or -not $upgradedAcl.AreAccessRulesProtected) {
        throw 'Upgraded local database authority file did not retain owner-only ACLs.'
    }
    $authorityLines = @(Get-Content -LiteralPath $authorityFile)
}
if (
    $authorityLines.Count -ne 3 -or
    $authorityLines[0] -notmatch '^YELLOW_DEPLOY_DATABASE_PASSWORD=([A-Za-z0-9_-]{43,256})$' -or
    $authorityLines[1] -notmatch '^YELLOW_RUNTIME_DATABASE_PASSWORD=([A-Za-z0-9_-]{43,256})$' -or
    $authorityLines[2] -notmatch '^YELLOW_EXTENSION_REGISTRAR_DATABASE_PASSWORD=([A-Za-z0-9_-]{43,256})$'
) {
    throw 'Local database authority file is malformed.'
}
$script:RegistrarPassword = $authorityLines[2].Substring('YELLOW_EXTENSION_REGISTRAR_DATABASE_PASSWORD='.Length)
if ($script:DeployPassword -eq $script:RegistrarPassword -or $script:RuntimePassword -eq $script:RegistrarPassword) {
    throw 'Local database authority passwords must be pairwise distinct.'
}

$folderName = (Split-Path $root -Leaf).ToLowerInvariant()
$defaultProject = ($folderName -replace '[^a-z0-9_-]', '-')
$env:COMPOSE_PROJECT_NAME = if ($env:COMPOSE_PROJECT_NAME) { $env:COMPOSE_PROJECT_NAME } else { $defaultProject }
$env:YELLOW_APP_PORT = if ($env:YELLOW_APP_PORT) { $env:YELLOW_APP_PORT } else { '3000' }
$env:YELLOW_POSTGRES_PORT = if ($env:YELLOW_POSTGRES_PORT) { $env:YELLOW_POSTGRES_PORT } else { '5442' }
$env:YELLOW_VALKEY_PORT = if ($env:YELLOW_VALKEY_PORT) { $env:YELLOW_VALKEY_PORT } else { '6389' }

Write-Host "Compose project $($env:COMPOSE_PROJECT_NAME) · ports app=$($env:YELLOW_APP_PORT) postgres=$($env:YELLOW_POSTGRES_PORT) valkey=$($env:YELLOW_VALKEY_PORT)"
Invoke-Compose -Arguments @('up', '--detach', 'postgres', 'valkey') | Out-Host; Assert-Exit 'Starting PostgreSQL and Valkey'

$ready = $false
foreach ($attempt in 1..40) {
    $postmaster = Invoke-Compose -Arguments @('exec', '-T', 'postgres', 'cat', '/proc/1/comm') 2> $null
    $finalPostmaster = $LASTEXITCODE -eq 0 -and $postmaster.Trim() -eq 'postgres'
    # Use the explicit array form so PowerShell cannot consume pg_isready's `-d`
    # as an abbreviated common `-Debug` parameter on Invoke-Compose.
    Invoke-Compose -Arguments @('exec', '-T', 'postgres', 'pg_isready', '-U', 'yellow_deploy', '-d', 'yellow_dev') *> $null
    $databaseReady = $LASTEXITCODE -eq 0
    if ($databaseReady -and $finalPostmaster) { $ready = $true; break }
    Start-Sleep -Seconds 1
}
if (-not $ready) { throw 'PostgreSQL did not become ready. Run: docker compose logs postgres' }

$devUrl = "postgres://yellow_deploy:$($script:DeployPassword)@127.0.0.1:$($env:YELLOW_POSTGRES_PORT)/yellow_dev"
$testUrl = "postgres://yellow_deploy:$($script:DeployPassword)@127.0.0.1:$($env:YELLOW_POSTGRES_PORT)/yellow_test"
$previousDeployUrl = $env:YELLOW_DEPLOY_DATABASE_URL
$previousRuntimePassword = $env:YELLOW_RUNTIME_DATABASE_PASSWORD
$previousRegistrarPassword = $env:YELLOW_EXTENSION_REGISTRAR_DATABASE_PASSWORD
$previousDsn = $env:YELLOW_DSN
$previousEncoding = $env:PYTHONIOENCODING
$previousTokenSecret = $env:YELLOW_TOKEN_SECRET
try {
    $env:YELLOW_DEPLOY_DATABASE_URL = $devUrl
    $env:YELLOW_RUNTIME_DATABASE_PASSWORD = $script:RuntimePassword
    $env:YELLOW_EXTENSION_REGISTRAR_DATABASE_PASSWORD = $script:RegistrarPassword
    bun scripts/provision-local-database-authority.ts | Out-Host; Assert-Exit 'Provisioning local database authority'
    $env:YELLOW_RUNTIME_DATABASE_PASSWORD = $null
    $env:YELLOW_EXTENSION_REGISTRAR_DATABASE_PASSWORD = $null
    bun scripts/migrate.ts | Out-Host; Assert-Exit 'Migrating yellow_dev'
    bun scripts/seed.ts | Out-Host; Assert-Exit 'Seeding yellow_dev'

    Invoke-Compose -Arguments @('exec', '-T', 'postgres', 'psql', '-U', 'yellow_deploy', '-d', 'postgres',
        '-v', 'ON_ERROR_STOP=1', '-c', 'DROP DATABASE IF EXISTS yellow_test WITH (FORCE)',
        '-c', 'CREATE DATABASE yellow_test OWNER yellow_deploy') | Out-Host
    Assert-Exit 'Recreating yellow_test'

    $env:YELLOW_DEPLOY_DATABASE_URL = $testUrl
    bun scripts/migrate.ts | Out-Host; Assert-Exit 'Migrating yellow_test'
    $fixtureSql = Get-Content (Join-Path $root 'tests/seed_fixture.sql') -Raw
    Invoke-Compose -Arguments @('exec', '-T', 'postgres', 'psql', '-U', 'yellow_deploy', '-d', 'yellow_test',
        '-v', 'ON_ERROR_STOP=1') -StandardInput $fixtureSql | Out-Host
    Assert-Exit 'Loading the invariant fixture'

    $tables = Invoke-Compose -Arguments @('exec', '-T', 'postgres', 'psql', '-U', 'yellow_deploy', '-d', 'yellow_test',
        '-tAc', "SELECT count(*) FROM pg_tables WHERE schemaname='public';")
    Assert-Exit 'Counting public tables'
    $tables = $tables.Trim()
    if ($tables -ne '87') { throw "yellow_test has $tables public tables; expected 87 (80 baseline + tx_code_route + 2 kernel consumer + api_idempotency + payment operation + provider receipt + schema_migration)." }
    Write-Host 'yellow_test tables: 87 (80 baseline + tx_code_route + 2 kernel consumer + api_idempotency + payment operation + provider receipt + schema_migration)'

    $env:YELLOW_DSN = "dbname=yellow_test user=yellow_deploy password=$($script:DeployPassword) host=127.0.0.1 port=$($env:YELLOW_POSTGRES_PORT)"
    $env:PYTHONIOENCODING = 'utf-8'
    python tests/run_invariants.py yellow_test | Out-Host; Assert-Exit 'Invariant referee'

    if (-not $DbOnly) {
        if (-not $DbOnly -and -not $env:YELLOW_TOKEN_SECRET) {
            $tokenSecretBytes = New-Object byte[] 48
            [Security.Cryptography.RandomNumberGenerator]::Fill($tokenSecretBytes)
            $env:YELLOW_TOKEN_SECRET = [Convert]::ToBase64String($tokenSecretBytes)
            [Array]::Clear($tokenSecretBytes, 0, $tokenSecretBytes.Length)
            Write-Host 'Generated an ephemeral local JWT signing secret for this setup invocation.'
        }
        Invoke-Compose -Arguments @('up', '--detach', 'app') | Out-Host; Assert-Exit 'Starting the application'
        $healthy = $false
        foreach ($attempt in 1..30) {
            try {
                $response = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$($env:YELLOW_APP_PORT)/health"
                if ($response.StatusCode -eq 200 -and $response.Content -eq '{"status":"ok"}') { $healthy = $true; break }
            } catch { }
            Start-Sleep -Seconds 1
        }
        if (-not $healthy) { throw "Application health failed on port $($env:YELLOW_APP_PORT)." }
        Write-Host "app health: 200 {`"status`":`"ok`"}"
    }
} finally {
    $env:YELLOW_DEPLOY_DATABASE_URL = $previousDeployUrl
    $env:YELLOW_RUNTIME_DATABASE_PASSWORD = $previousRuntimePassword
    $env:YELLOW_EXTENSION_REGISTRAR_DATABASE_PASSWORD = $previousRegistrarPassword
    $env:YELLOW_DSN = $previousDsn
    $env:PYTHONIOENCODING = $previousEncoding
    $env:YELLOW_TOKEN_SECRET = $previousTokenSecret
}

Write-Host 'Setup complete. Start each Codex session with: .\state.ps1'
