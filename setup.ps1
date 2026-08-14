[CmdletBinding()]
param(
    [switch]$DbOnly
)

$ErrorActionPreference = 'Stop'
$project = $PSScriptRoot

function Require-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Missing prerequisite: $Name"
    }
}

Require-Command git
Require-Command docker
Require-Command python

if (-not $DbOnly -and -not (Test-Path (Join-Path $project '.git'))) {
    git -C $project init -b main
    git -C $project add -A
    git -C $project -c user.name='Yellow Project Setup' -c user.email='setup@yellow.local' commit -m 'chore: initialize Yellow project'
}

docker info | Out-Null
docker compose -f (Join-Path $project 'docker-compose.yml') up -d

$ready = $false
foreach ($attempt in 1..40) {
    docker exec yellow-postgres pg_isready -U yellow -d yellow_dev *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
}
if (-not $ready) { throw 'PostgreSQL did not become ready.' }

docker exec yellow-postgres psql -U yellow -d yellow_dev -v ON_ERROR_STOP=1 `
    -c 'DROP DATABASE IF EXISTS yellow_test;' -c 'CREATE DATABASE yellow_test;' | Out-Host
Get-Content (Join-Path $project 'migrations/0001_init.sql') -Raw |
    docker exec -i yellow-postgres psql -U yellow -d yellow_test -v ON_ERROR_STOP=1 | Out-Host
Get-Content (Join-Path $project 'tests/seed_fixture.sql') -Raw |
    docker exec -i yellow-postgres psql -U yellow -d yellow_test -v ON_ERROR_STOP=1 | Out-Host

$previousDsn = $env:YELLOW_DSN
$previousEncoding = $env:PYTHONIOENCODING
try {
    $env:YELLOW_DSN = 'dbname=yellow_test user=yellow password=yellow host=127.0.0.1 port=5442'
    $env:PYTHONIOENCODING = 'utf-8'
    Push-Location $project
    python tests/run_invariants.py yellow_test
    if ($LASTEXITCODE -ne 0) { throw "Invariant battery failed (exit code $LASTEXITCODE)." }
} finally {
    Pop-Location
    $env:YELLOW_DSN = $previousDsn
    $env:PYTHONIOENCODING = $previousEncoding
}

Write-Host "Setup complete. Start each Codex session with: .\state.ps1"
