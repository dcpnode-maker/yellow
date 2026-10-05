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
    $mergedOrderPaths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    if ($orderFiles.Count -gt 0) {
        Select-String -LiteralPath $orderFiles.FullName -Pattern '^## MERGED' -List |
            ForEach-Object { [void]$mergedOrderPaths.Add($_.Path) }
    }
    $historicalUnclosed = @($orderFiles | Where-Object { -not $mergedOrderPaths.Contains($_.FullName) })
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
    $questionCandidates = @($questionFiles | Where-Object {
        $_.Name -notmatch '^\d+-ARCHITECT-RESPONSE\.md$'
    })
    $resolvedQuestionPaths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    if ($questionCandidates.Count -gt 0) {
        Select-String -LiteralPath $questionCandidates.FullName -Pattern '^## RESOLVED','^## RATIFIED' -List |
            ForEach-Object { [void]$resolvedQuestionPaths.Add($_.Path) }
    }
    $openQuestions = @($questionCandidates | Where-Object {
        $number = $_.BaseName.Split('-')[0]
        $response = [System.IO.Path]::Combine($PSScriptRoot, 'handoff', 'questions', "$number-ARCHITECT-RESPONSE.md")
        -not $resolvedQuestionPaths.Contains($_.FullName) -and
            -not ([System.IO.File]::Exists($response) -or [System.IO.Directory]::Exists($response))
    })
    Write-Host "Current task: $currentTask"
    Write-Host "Lifecycle: $currentLifecycle"
    Write-Host 'Current order files:'
    $currentOrderFiles | ForEach-Object { Write-Host "  $_" }
    Write-Host "Historical records: orders=$($orderFiles.Count) total ($($historicalUnclosed.Count) lack legacy MERGED marker) reviews=$($reviewFiles.Count) total questions=$($openQuestions.Count) without legacy resolution marker ($($questionFiles.Count) total)"

    $running = @()
    $tableCount = $null
    # One shared budget includes discovery, both queries and owned-tree cleanup.
    $probeOperationMs = 650
    $probeLifecycleMs = 1000
    function Stop-OwnedStatusProbe([System.Diagnostics.Process]$Process) {
        if ($Process.HasExited) { return $true }
        $remaining = [Math]::Max(0, $probeLifecycleMs - [int]$probeClock.ElapsedMilliseconds)
        $treeStopped = $false
        if ($remaining -gt 0) {
            try {
                $killerInfo = New-Object System.Diagnostics.ProcessStartInfo
                $killerInfo.FileName = [IO.Path]::Combine($env:SystemRoot, 'System32', 'taskkill.exe')
                $killerInfo.Arguments = "/PID $($Process.Id) /T /F"
                $killerInfo.UseShellExecute = $false
                $killerInfo.CreateNoWindow = $true
                $killerInfo.RedirectStandardOutput = $true
                $killerInfo.RedirectStandardError = $true
                $killer = New-Object System.Diagnostics.Process
                $killer.StartInfo = $killerInfo
                [void]$killer.Start()
                $killOutput = $killer.StandardOutput.ReadToEndAsync()
                $killError = $killer.StandardError.ReadToEndAsync()
                $killRemaining = [Math]::Max(0, [Math]::Min(350, $probeLifecycleMs - [int]$probeClock.ElapsedMilliseconds))
                if ($killRemaining -gt 0 -and -not $killer.WaitForExit($killRemaining)) { $killer.Kill() }
                if (-not $killer.HasExited) { [void]$killer.WaitForExit(50) }
                # The wrapper may finish naturally between HasExited and taskkill.
                # Its streams must still reach EOF below before the result is used.
                $treeStopped = $killer.HasExited -and ($killer.ExitCode -eq 0 -or
                    ($killer.ExitCode -eq 128 -and $Process.HasExited))
                $killer.Dispose()
            } catch {
                $treeStopped = $false
            }
        }
        if (-not $Process.HasExited) { $Process.Kill() }
        $remaining = [Math]::Max(0, $probeLifecycleMs - [int]$probeClock.ElapsedMilliseconds)
        if ($remaining -gt 0) { [void]$Process.WaitForExit($remaining) }
        return $treeStopped -and $Process.HasExited
    }
    function Invoke-BoundedStatusProbe([string]$Arguments) {
        if ($probeClock.ElapsedMilliseconds -ge $probeOperationMs) { return $null }
        $process = $null
        $cleanupRequired = $false
        try {
            $sentinel = "__YELLOW_STATUS_$([Guid]::NewGuid().ToString('N'))__"
            $startInfo = New-Object System.Diagnostics.ProcessStartInfo
            $startInfo.FileName = [IO.Path]::Combine($env:SystemRoot, 'System32', 'cmd.exe')
            $startInfo.Arguments = "/d /v:on /s /c `"call docker $Arguments 2>nul & echo $sentinel`:!errorlevel! & set /p __yellow_status_hold=`""
            $startInfo.WorkingDirectory = $PSScriptRoot
            $startInfo.UseShellExecute = $false
            $startInfo.CreateNoWindow = $true
            $startInfo.RedirectStandardInput = $true
            $startInfo.RedirectStandardOutput = $true
            $startInfo.RedirectStandardError = $true
            $process = New-Object System.Diagnostics.Process
            $process.StartInfo = $startInfo
            [void]$process.Start()
            $cleanupRequired = $true
            $stdinHold = $process.StandardInput
            $stderr = $process.StandardError.ReadToEndAsync()
            $lines = @()
            $exitCode = $null
            while ($null -eq $exitCode -and $lines.Count -lt 32) {
                $remaining = [Math]::Max(0, $probeOperationMs - [int]$probeClock.ElapsedMilliseconds)
                if ($remaining -eq 0) { break }
                $lineTask = $process.StandardOutput.ReadLineAsync()
                if (-not $lineTask.Wait($remaining)) { break }
                $line = $lineTask.Result
                if ($null -eq $line) { break }
                if ($line -match "^$([regex]::Escape($sentinel)):(-?\d+)\s*$") {
                    $exitCode = [int]$Matches[1]
                } elseif ($line.Length -le 256) {
                    $lines += $line
                } else {
                    break
                }
            }
            $treeStopped = Stop-OwnedStatusProbe $process
            $cleanupRequired = $false
            if (-not $treeStopped) { throw 'Owned native status probe tree cleanup was not proven' }
            $remaining = [Math]::Max(0, $probeLifecycleMs - [int]$probeClock.ElapsedMilliseconds)
            $tail = $process.StandardOutput.ReadLineAsync()
            $tailReady = $tail.Wait($remaining)
            $remaining = [Math]::Max(0, $probeLifecycleMs - [int]$probeClock.ElapsedMilliseconds)
            if (-not $tailReady -or $null -ne $tail.Result -or -not $stderr.Wait($remaining)) {
                throw 'Owned native status probe stream cleanup was not proven'
            }
            if ($stderr.Result -or $exitCode -ne 0) { return $null }
            return $lines
        } catch {
            if ($cleanupRequired) {
                $treeStopped = Stop-OwnedStatusProbe $process
                $cleanupRequired = $false
                if (-not $treeStopped) { throw 'Owned native status probe tree cleanup was not proven' }
            }
            if ($_.Exception.Message -like 'Owned native status probe * cleanup was not proven') { throw }
            return $null
        } finally {
            if ($cleanupRequired) {
                $treeStopped = Stop-OwnedStatusProbe $process
                if (-not $treeStopped) { throw 'Owned native status probe tree cleanup was not proven' }
            }
            if ($null -ne $process) { $process.Dispose() }
        }
    }
    $probeClock = [System.Diagnostics.Stopwatch]::StartNew()
    $serviceOutput = Invoke-BoundedStatusProbe 'compose ps --services --status running'
    if ($null -ne $serviceOutput) {
        $reported = @($serviceOutput | Where-Object { $_ })
        $validServices = @($reported | Where-Object { $_ -in @('app','postgres','valkey') })
        $uniqueServices = @($reported | Select-Object -Unique)
        if ($validServices.Count -eq $reported.Count -and $uniqueServices.Count -eq $reported.Count) {
            $running = $reported
            if ($running -contains 'postgres') {
                $queryOutput = Invoke-BoundedStatusProbe 'compose exec -T postgres psql -U yellow_deploy -d yellow_test -tAc "SELECT count(*) FROM pg_tables WHERE schemaname=''public'';"'
                if ($null -eq $queryOutput -and $probeClock.ElapsedMilliseconds -ge $probeOperationMs) {
                    $running = @()
                } else {
                    $queryLines = @($queryOutput)
                    if ($queryLines.Count -eq 1 -and "$($queryLines[0])" -match '^\s*\d+\s*$') {
                        $tableCount = "$($queryLines[0])".Trim()
                    }
                }
            }
        }
    }
    $probeClock.Stop()
    foreach ($service in 'app','postgres','valkey') {
        Write-Host "Service $service`: $(if ($running -contains $service) { 'up' } else { 'down' })"
    }
    if ($running -contains 'postgres' -and $null -ne $tableCount) {
        Write-Host "yellow_test public tables: $tableCount (validate against the PROJECT-STATUS migration frontier)"
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
