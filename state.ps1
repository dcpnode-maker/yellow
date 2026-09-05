[CmdletBinding()]
param()

$ErrorActionPreference = 'Continue'
Set-Location $PSScriptRoot
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
$folderName = (Split-Path $PSScriptRoot -Leaf).ToLowerInvariant()
$defaultProject = ($folderName -replace '[^a-z0-9_-]', '-')
$projectName = if ($env:COMPOSE_PROJECT_NAME) { $env:COMPOSE_PROJECT_NAME } else { $defaultProject }
$previousProject = $env:COMPOSE_PROJECT_NAME
$env:COMPOSE_PROJECT_NAME = $projectName
$reportComplete = $false

try {
    Write-Host "YELLOW state $([char]0x00B7) Compose project $projectName"
    $branch = git branch --show-current 2>$null
    $head = git log -1 --pretty='%h %s' 2>$null
    $dirty = @(git status --porcelain 2>$null).Count
    Write-Host "Git: $branch $([char]0x00B7) $head $([char]0x00B7) $(if ($dirty) { "$dirty uncommitted" } else { 'clean' })"

    $orderFiles = @(Get-ChildItem 'handoff/orders' -Filter '*.md' -File -ErrorAction SilentlyContinue | Sort-Object Name)
    $reviewFiles = @(Get-ChildItem 'handoff/reviews' -Filter '*.md' -File -ErrorAction SilentlyContinue | Sort-Object Name)
    $questionFiles = @(Get-ChildItem 'handoff/questions' -Filter '*.md' -File -ErrorAction SilentlyContinue | Sort-Object Name)
    $historicalUnclosed = @($orderFiles | Where-Object { -not (Select-String -Path $_.FullName -Pattern '^## MERGED' -Quiet) })
    $statusPath = if ($env:YELLOW_PROJECT_STATUS_FILE) { $env:YELLOW_PROJECT_STATUS_FILE } else { 'docs/PROJECT-STATUS.md' }
    $statusText = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $statusPath).Path, $utf8NoBom)
    function Read-StatusField([string]$Name) {
        $match = [regex]::Match($statusText, "(?m)^<!-- $([regex]::Escape($Name)): (.*) -->$")
        if (-not $match.Success) { throw "Missing project status field: $Name" }
        return $match.Groups[1].Value
    }
    $statusSchema = Read-StatusField 'status-schema'
    $currentPhase = Read-StatusField 'current-phase'
    $currentTask = Read-StatusField 'current-task'
    $currentLifecycle = Read-StatusField 'current-lifecycle'
    $parsedPhase = 0
    if ($statusSchema -ne 'yellow-project-status/v1' -or
        -not [int]::TryParse($currentPhase, [ref]$parsedPhase) -or
        -not $currentTask -or -not $currentLifecycle) {
        throw 'Invalid docs/PROJECT-STATUS.md metadata'
    }
    $currentOrderFiles = @((Read-StatusField 'current-order-files').Split(';'))
    foreach ($currentOrderFile in $currentOrderFiles) {
        if (-not $currentOrderFile -or -not (Test-Path -LiteralPath $currentOrderFile)) {
            throw "Current order file is missing: $currentOrderFile"
        }
    }
    $openQuestions = @($questionFiles | Where-Object {
        $isResponse = $_.Name -match '^\d+-ARCHITECT-RESPONSE\.md$'
        $number = $_.BaseName.Split('-')[0]
        $response = Join-Path 'handoff/questions' "$number-ARCHITECT-RESPONSE.md"
        -not $isResponse -and
            -not (Select-String -Path $_.FullName -Pattern '^## RESOLVED','^## RATIFIED' -Quiet) -and
            -not (Test-Path -LiteralPath $response)
    })
    Write-Host "Current task: $currentTask"
    Write-Host "Lifecycle: $currentLifecycle"
    Write-Host 'Current order files:'
    $currentOrderFiles | ForEach-Object { Write-Host "  $_" }
    Write-Host "Historical records: orders=$($orderFiles.Count) total ($($historicalUnclosed.Count) lack legacy MERGED marker) reviews=$($reviewFiles.Count) total questions=$($openQuestions.Count) without legacy resolution marker ($($questionFiles.Count) total)"

    $running = @()
    if ((Get-Command docker -ErrorAction SilentlyContinue) -and (docker info 2>$null)) {
        $running = @(docker compose ps --services --status running 2>$null)
    }
    foreach ($service in 'app','postgres','valkey') {
        Write-Host "Service $service`: $(if ($running -contains $service) { 'up' } else { 'down' })"
    }
    if ($running -contains 'postgres') {
        $tables = docker compose exec -T postgres psql -U yellow_deploy -d yellow_test -tAc "SELECT count(*) FROM pg_tables WHERE schemaname='public';" 2>$null
        if ($LASTEXITCODE -eq 0) { Write-Host "yellow_test public tables: $($tables.Trim()) (validate against the PROJECT-STATUS migration frontier)" }
    }

    Write-Host "Phase: $currentPhase $([char]0x00B7) $currentLifecycle"
    Write-Host 'Reading: PROJECT.md -> AGENTS.md -> BUILD-PLAN.md -> handoff/ROSTER.md -> docs/WORKFLOW.md'
    Write-Host 'Referee: .\setup.ps1 -DbOnly -> 11 passed, 0 failed of 11'
    $reportComplete = $true
} catch {
    Write-Error -Message "YELLOW state report failed: $($_.Exception.Message)" -ErrorAction Continue
    throw
} finally {
    $env:COMPOSE_PROJECT_NAME = $previousProject
}

# Optional native probes (for example, Docker installed without a running daemon)
# must not leak their status from an otherwise successful report to the caller.
if ($reportComplete) {
    $global:LASTEXITCODE = 0
}
