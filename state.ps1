[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$project = $PSScriptRoot
Push-Location $project
try {
    Write-Host "YELLOW — project state · $((Get-Date).ToUniversalTime().ToString('yyyy-MM-dd HH:mm UTC'))"
    Write-Host "`nGit"
    Write-Host "  branch  $(git branch --show-current)"
    Write-Host "  head    $(git log -1 --pretty='%h %s')"
    $dirty = @(git status --porcelain).Count
    Write-Host "  $(if ($dirty) { "uncommitted: $dirty file(s)" } else { 'clean' })"

    Write-Host "`nOpen work"
    $orders = @(Get-ChildItem 'handoff/orders' -Filter '*.md' -ErrorAction SilentlyContinue).Count
    $reviews = @(Get-ChildItem 'handoff/reviews' -Filter '*.md' -ErrorAction SilentlyContinue).Count
    $questions = @(Get-ChildItem 'handoff/questions' -Filter '*.md' -ErrorAction SilentlyContinue).Count
    Write-Host "  orders $orders · reviews $reviews · open questions $questions"

    Write-Host "`nServices"
    $containers = @(docker ps --format '{{.Names}}')
    foreach ($container in 'yellow-postgres','yellow-valkey') {
        Write-Host "  $(if ($containers -contains $container) { 'up' } else { 'down' })      $container"
    }
    if ($containers -contains 'yellow-postgres') {
        $tables = docker exec yellow-postgres psql -U yellow -d yellow_test -tAc "SELECT count(*) FROM pg_tables WHERE schemaname='public';" 2>$null
        Write-Host "  yellow_test tables: $tables (expect 80)"
    }
    Write-Host "`nReading order: PROJECT.md → AGENTS.md → BUILD-PLAN.md → handoff/ROSTER.md → docs/WORKFLOW.md"
    Write-Host "Referee: .\setup.ps1 -DbOnly"
} finally { Pop-Location }
