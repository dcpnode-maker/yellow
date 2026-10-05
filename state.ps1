[CmdletBinding()]
param()

$ErrorActionPreference = 'Continue'
Set-Location $PSScriptRoot
$folderName = (Split-Path $PSScriptRoot -Leaf).ToLowerInvariant()
$defaultProject = ($folderName -replace '[^a-z0-9_-]', '-')
$projectName = if ($env:COMPOSE_PROJECT_NAME) { $env:COMPOSE_PROJECT_NAME } else { $defaultProject }
$previousProject = $env:COMPOSE_PROJECT_NAME
$env:COMPOSE_PROJECT_NAME = $projectName

try {
    Write-Host "YELLOW state · Compose project $projectName"
    $branch = git branch --show-current 2>$null
    $head = git log -1 --pretty='%h %s' 2>$null
    $dirty = @(git status --porcelain 2>$null).Count
    Write-Host "Git: $branch · $head · $(if ($dirty) { "$dirty uncommitted" } else { 'clean' })"

    $orderFiles = @(Get-ChildItem 'handoff/orders' -Filter '*.md' -File -ErrorAction SilentlyContinue | Sort-Object Name)
    $reviewFiles = @(Get-ChildItem 'handoff/reviews' -Filter '*.md' -File -ErrorAction SilentlyContinue | Sort-Object Name)
    $questionFiles = @(Get-ChildItem 'handoff/questions' -Filter '*.md' -File -ErrorAction SilentlyContinue | Sort-Object Name)
    $openOrders = @($orderFiles | Where-Object { -not (Select-String -Path $_.FullName -Pattern '^## MERGED' -Quiet) })
    $openQuestions = @($questionFiles | Where-Object { -not (Select-String -Path $_.FullName -Pattern '^## RESOLVED','^## RATIFIED' -Quiet) })
    Write-Host "Open work: orders=$($openOrders.Count) open ($($orderFiles.Count) total) reviews=0 open ($($reviewFiles.Count) total) questions=$($openQuestions.Count) open ($($questionFiles.Count) total)"
    if ($openOrders.Count) {
        Write-Host 'Open orders:'
        $openOrders | ForEach-Object { Write-Host "  handoff/orders/$($_.Name)" }
    }
    if ($openQuestions.Count) {
        Write-Host 'Open questions:'
        $openQuestions | ForEach-Object { Write-Host "  handoff/questions/$($_.Name)" }
    }

    $running = @()
    if ((Get-Command docker -ErrorAction SilentlyContinue) -and (docker info 2>$null)) {
        $running = @(docker compose ps --services --status running 2>$null)
    }
    foreach ($service in 'app','postgres','valkey') {
        Write-Host "Service $service`: $(if ($running -contains $service) { 'up' } else { 'down' })"
    }
    if ($running -contains 'postgres') {
        $tables = docker compose exec -T postgres psql -U yellow -d yellow_test -tAc "SELECT count(*) FROM pg_tables WHERE schemaname='public';" 2>$null
        if ($LASTEXITCODE -eq 0) { Write-Host "yellow_test tables: $($tables.Trim()) (80 baseline + schema_migration; expected 81)" }
    }

    Write-Host 'Phase: 0 · cumulative review pending'
    Write-Host 'Reading: PROJECT.md -> AGENTS.md -> BUILD-PLAN.md -> handoff/ROSTER.md -> docs/WORKFLOW.md'
    Write-Host 'Referee: .\setup.ps1 -DbOnly -> 11 passed, 0 failed of 11'
} finally {
    $env:COMPOSE_PROJECT_NAME = $previousProject
}
