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

Require-Command docker 'Install Docker Desktop or Docker Engine with the Compose plugin.'
Require-Command bun 'Install Bun 1.3.14 from https://bun.sh/docs/installation.'
Require-Command python 'Install CPython 3.12+ and add python to PATH.'
docker compose version *> $null; Assert-Exit 'Docker Compose prerequisite check'
docker info *> $null; Assert-Exit 'Docker daemon prerequisite check'
python -c 'import psycopg2' *> $null
if ($LASTEXITCODE -ne 0) { throw 'Missing psycopg2. Install psycopg2-binary==2.9.12 for the Python invariant referee.' }

$folderName = (Split-Path $root -Leaf).ToLowerInvariant()
$defaultProject = ($folderName -replace '[^a-z0-9_-]', '-')
$env:COMPOSE_PROJECT_NAME = if ($env:COMPOSE_PROJECT_NAME) { $env:COMPOSE_PROJECT_NAME } else { $defaultProject }
$env:YELLOW_APP_PORT = if ($env:YELLOW_APP_PORT) { $env:YELLOW_APP_PORT } else { '3000' }
$env:YELLOW_POSTGRES_PORT = if ($env:YELLOW_POSTGRES_PORT) { $env:YELLOW_POSTGRES_PORT } else { '5442' }
$env:YELLOW_VALKEY_PORT = if ($env:YELLOW_VALKEY_PORT) { $env:YELLOW_VALKEY_PORT } else { '6389' }

Write-Host "Compose project $($env:COMPOSE_PROJECT_NAME) · ports app=$($env:YELLOW_APP_PORT) postgres=$($env:YELLOW_POSTGRES_PORT) valkey=$($env:YELLOW_VALKEY_PORT)"
docker compose up -d postgres valkey | Out-Host; Assert-Exit 'Starting PostgreSQL and Valkey'

$ready = $false
foreach ($attempt in 1..40) {
    $postmaster = docker compose exec -T postgres cat /proc/1/comm 2> $null
    $finalPostmaster = $LASTEXITCODE -eq 0 -and $postmaster.Trim() -eq 'postgres'
    docker compose exec -T postgres pg_isready -U yellow -d yellow_dev *> $null
    $databaseReady = $LASTEXITCODE -eq 0
    if ($databaseReady -and $finalPostmaster) { $ready = $true; break }
    Start-Sleep -Seconds 1
}
if (-not $ready) { throw 'PostgreSQL did not become ready. Run: docker compose logs postgres' }

$devUrl = "postgres://yellow:yellow@127.0.0.1:$($env:YELLOW_POSTGRES_PORT)/yellow_dev"
$testUrl = "postgres://yellow:yellow@127.0.0.1:$($env:YELLOW_POSTGRES_PORT)/yellow_test"
$previousDatabaseUrl = $env:DATABASE_URL
$previousDsn = $env:YELLOW_DSN
$previousEncoding = $env:PYTHONIOENCODING
try {
    $env:DATABASE_URL = $devUrl
    bun scripts/migrate.ts | Out-Host; Assert-Exit 'Migrating yellow_dev'
    bun scripts/seed.ts | Out-Host; Assert-Exit 'Seeding yellow_dev'

    docker compose exec -T postgres psql -U yellow -d postgres -v ON_ERROR_STOP=1 `
        -c 'DROP DATABASE IF EXISTS yellow_test WITH (FORCE)' -c 'CREATE DATABASE yellow_test' | Out-Host
    Assert-Exit 'Recreating yellow_test'

    $env:DATABASE_URL = $testUrl
    bun scripts/migrate.ts | Out-Host; Assert-Exit 'Migrating yellow_test'
    Get-Content (Join-Path $root 'tests/seed_fixture.sql') -Raw |
        docker compose exec -T postgres psql -U yellow -d yellow_test -v ON_ERROR_STOP=1 | Out-Host
    Assert-Exit 'Loading the invariant fixture'

    $tables = docker compose exec -T postgres psql -U yellow -d yellow_test -tAc "SELECT count(*) FROM pg_tables WHERE schemaname='public';"
    Assert-Exit 'Counting public tables'
    $tables = $tables.Trim()
    if ($tables -ne '85') { throw "yellow_test has $tables public tables; expected 85 (80 baseline + tx_code_route + 2 kernel consumer + api_idempotency + schema_migration)." }
    Write-Host 'yellow_test tables: 85 (80 baseline + tx_code_route + 2 kernel consumer + api_idempotency + schema_migration)'

    $env:YELLOW_DSN = "dbname=yellow_test user=yellow password=yellow host=127.0.0.1 port=$($env:YELLOW_POSTGRES_PORT)"
    $env:PYTHONIOENCODING = 'utf-8'
    python tests/run_invariants.py yellow_test | Out-Host; Assert-Exit 'Invariant referee'

    if (-not $DbOnly) {
        docker compose up -d app | Out-Host; Assert-Exit 'Starting the application'
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
    $env:DATABASE_URL = $previousDatabaseUrl
    $env:YELLOW_DSN = $previousDsn
    $env:PYTHONIOENCODING = $previousEncoding
}

Write-Host 'Setup complete. Start each Codex session with: .\state.ps1'
