<#
.SYNOPSIS
    Small reversible Yellow coding session helper for Windows 11.
.DESCRIPTION
    Provides a default read-only report of available RAM, grouped top process working sets,
    and eligible candidate apps. Allows graceful CloseMainWindow() on explicitly confirmed
    candidate PIDs.
#>
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
    [switch]$Apply,
    [int[]]$ProcessIds,
    [switch]$ConfirmSavedWork,
    [scriptblock]$ProcessProvider,
    [scriptblock]$MemoryProvider,
    [scriptblock]$CloseAdapter,
    [scriptblock]$WaitAdapter,
    [scriptblock]$SleepAction,
    [scriptblock]$NowProvider
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

function Test-ValidProcessPath {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) { return $false }
    return ($Path -match '^[a-zA-Z]:\\[^\\]+' -or $Path -match '^\\\\\w+\\[^\\]+')
}

function Get-YellowProcessSnapshot {
    param([scriptblock]$Provider)
    if ($null -ne $Provider) {
        $pRes = & $Provider
        $flat = [System.Collections.Generic.List[psobject]]::new()
        foreach ($item in @($pRes)) {
            if ($null -eq $item) { continue }
            if ($item -is [System.Collections.IEnumerable] -and $item -isnot [string] -and $item -isnot [psobject]) {
                foreach ($sub in $item) { if ($null -ne $sub) { $flat.Add($sub) } }
            } else {
                $flat.Add($item)
            }
        }
        return @($flat)
    }
    $raw = @(Get-Process -ErrorAction SilentlyContinue)
    $list = [System.Collections.Generic.List[psobject]]::new()
    foreach ($p in $raw) {
        $startTime = $null; $path = $null; $ws = 0L; $handle = $null; $sId = -1
        try {
            if ($p.HasExited) { continue }
            $startTime = $p.StartTime.ToUniversalTime()
            $path = $p.MainModule.FileName
            $ws = $p.WorkingSet64
            $handle = $p.MainWindowHandle
            $sId = $p.SessionId
        } catch {
            continue
        }
        $list.Add([pscustomobject]@{
            Id = $p.Id
            ProcessName = $p.ProcessName
            SessionId = $sId
            MainWindowHandle = $handle
            WorkingSet64 = $ws
            StartTimeUtc = $startTime
            Path = $path
            OriginalProcess = $p
        })
    }
    return @($list)
}

function Get-YellowAvailableRamBytes {
    param([scriptblock]$Provider)
    if ($null -ne $Provider) { return & $Provider }
    try {
        $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop
        if ($null -ne $os -and $null -ne $os.FreePhysicalMemory) {
            return [int64]$os.FreePhysicalMemory * 1024
        }
    } catch {}
    return $null
}

function Format-RamMB {
    param($Bytes)
    if ($null -eq $Bytes) { return "Unavailable" }
    return "$([Math]::Round([int64]$Bytes / 1MB, 1)) MB"
}

function Invoke-YellowSessionMode {
    [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
    param(
        [switch]$Apply,
        [int[]]$ProcessIds,
        [switch]$ConfirmSavedWork,
        [scriptblock]$ProcessProvider,
        [scriptblock]$MemoryProvider,
        [scriptblock]$CloseAdapter,
        [scriptblock]$WaitAdapter,
        [scriptblock]$SleepAction,
        [scriptblock]$NowProvider
    )

    $allowlist = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    @('Zed', 'Claude', 'Spotify', 'Teams', 'ms-teams', 'OneDrive', 'AcroRd32', 'Acrobat', 'utweb', 'Telegram', 'WhatsApp', 'Discord') | ForEach-Object { [void]$allowlist.Add($_) }

    $lines = [System.Collections.Generic.List[string]]::new()
    $actions = [System.Collections.Generic.List[string]]::new()

    $initialRam = Get-YellowAvailableRamBytes -Provider $MemoryProvider
    $lines.Add("=== Yellow Session Mode Helper ===")
    $lines.Add("Available physical RAM (initial): $(Format-RamMB $initialRam)")
    $lines.Add("Notice: Shared working set pages may be shared across processes; closing one process does not guarantee releasing all its reported memory.")

    $allProcesses = @(Get-YellowProcessSnapshot -Provider $ProcessProvider)
    $curSession = [System.Diagnostics.Process]::GetCurrentProcess().SessionId

    # Grouped top process working sets
    $groups = $allProcesses | Group-Object -Property ProcessName
    $sortedGroups = $groups | ForEach-Object {
        $tot = 0L
        foreach ($item in $_.Group) { $tot += [int64]$item.WorkingSet64 }
        [pscustomobject]@{ Name = $_.Name; Count = $_.Count; TotalWorkingSet = $tot }
    } | Sort-Object -Property TotalWorkingSet -Descending | Select-Object -First 10

    $lines.Add("Top process footprints (grouped by name):")
    foreach ($sg in $sortedGroups) {
        $lines.Add("  Process: $($sg.Name) (Instances: $($sg.Count)) | RAM: $(Format-RamMB $sg.TotalWorkingSet)")
    }

    $candidates = [System.Collections.Generic.List[psobject]]::new()
    foreach ($p in $allProcesses) {
        if ($allowlist.Contains($p.ProcessName) -and
            $p.SessionId -eq $curSession -and
            $null -ne $p.MainWindowHandle -and [int64]$p.MainWindowHandle -ne 0 -and
            $null -ne $p.StartTimeUtc -and
            (Test-ValidProcessPath -Path $p.Path)) {
            $candidates.Add($p)
        }
    }

    $lines.Add("Eligible optional app candidates (visible main window in current session):")
    if ($candidates.Count -eq 0) {
        $lines.Add("  (None found)")
    } else {
        foreach ($c in $candidates) {
            $lines.Add("  PID: $($c.Id) | Name: $($c.ProcessName) | RAM: $(Format-RamMB $c.WorkingSet64)")
        }
    }

    if (-not $Apply) {
        $lines.Add("Mode: Read-only report. No processes were modified.")
        return [pscustomobject]@{ Success = $true; Actions = @($actions); Lines = @($lines); Exited = @(); Refused = @(); StillRunning = @() }
    }

    $isWhatIf = [bool]($PSCmdlet.MyInvocation.BoundParameters.ContainsKey('WhatIf') -and $PSCmdlet.MyInvocation.BoundParameters['WhatIf']) -or [bool]$WhatIfPreference

    # Validate parameters
    if ($null -eq $ProcessIds -or $ProcessIds.Count -eq 0) {
        $lines.Add("Validation error: -ProcessIds must be provided when -Apply is specified.")
        return [pscustomobject]@{ Success = $false; Actions = @($actions); Lines = @($lines); Exited = @(); Refused = @(); StillRunning = @() }
    }
    if (-not $ConfirmSavedWork) {
        $lines.Add("Validation error: -ConfirmSavedWork must be specified with -Apply.")
        return [pscustomobject]@{ Success = $false; Actions = @($actions); Lines = @($lines); Exited = @(); Refused = @(); StillRunning = @() }
    }
    if ($ProcessIds.Count -gt 8) {
        $lines.Add("Validation error: Maximum 8 process IDs permitted per session.")
        return [pscustomobject]@{ Success = $false; Actions = @($actions); Lines = @($lines); Exited = @(); Refused = @(); StillRunning = @() }
    }

    $seen = [System.Collections.Generic.HashSet[int]]::new()
    foreach ($id in $ProcessIds) {
        if ($id -le 0) {
            $lines.Add("Validation error: Process ID $id must be a positive integer.")
            return [pscustomobject]@{ Success = $false; Actions = @($actions); Lines = @($lines); Exited = @(); Refused = @(); StillRunning = @() }
        }
        if (-not $seen.Add($id)) {
            $lines.Add("Validation error: Duplicate process ID $id specified.")
            return [pscustomobject]@{ Success = $false; Actions = @($actions); Lines = @($lines); Exited = @(); Refused = @(); StillRunning = @() }
        }
    }

    # Preflight ALL selected IDs against candidate policy
    $candidateMap = @{}
    foreach ($c in $candidates) { $candidateMap[$c.Id] = $c }

    foreach ($id in $ProcessIds) {
        if (-not $candidateMap.ContainsKey($id)) {
            $lines.Add("Preflight failure: PID $id is not an eligible candidate (unknown, protected, hidden, or wrong session). Zero closes performed.")
            return [pscustomobject]@{ Success = $false; Actions = @($actions); Lines = @($lines); Exited = @(); Refused = @(); StillRunning = @() }
        }
    }

    if ($isWhatIf) {
        $lines.Add("WhatIf active: No process close requested or performed.")
        return [pscustomobject]@{ Success = $true; Actions = @($actions); Lines = @($lines); Exited = @(); Refused = @(); StillRunning = @() }
    }

    $defaultClose = {
        param($p)
        if ($null -ne $p.OriginalProcess) { return $p.OriginalProcess.CloseMainWindow() }
        $proc = [System.Diagnostics.Process]::GetProcessById($p.Id)
        return $proc.CloseMainWindow()
    }
    $actualCloseAdapter = if ($null -ne $CloseAdapter) { $CloseAdapter } else { $defaultClose }

    $defaultWait = {
        param($procObj, [int]$TimeoutSec, [scriptblock]$ProcProv, [scriptblock]$SleepAct, [scriptblock]$NowProv)
        if ($null -ne $procObj.OriginalProcess -and $procObj.OriginalProcess -is [System.Diagnostics.Process]) {
            try {
                return $procObj.OriginalProcess.WaitForExit($TimeoutSec * 1000)
            } catch {
                return $false
            }
        }
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $start = if ($null -ne $NowProv) { & $NowProv } else { [DateTimeOffset]::UtcNow }
        $maxPolls = 20
        $polls = 0
        while ($polls -lt $maxPolls -and $sw.Elapsed.TotalSeconds -lt $TimeoutSec) {
            $polls++
            if ($null -ne $SleepAct) { & $SleepAct 0.25 } else { Start-Sleep -Milliseconds 250 }
            if ($null -ne $NowProv) {
                $now = & $NowProv
                if (($now - $start).TotalSeconds -ge $TimeoutSec) { break }
            }
            try {
                if ($null -ne $procObj.OriginalProcess -and $procObj.OriginalProcess.HasExited) { return $true }
            } catch {
                return $false
            }
        }
        return $false
    }
    $actualWaitAdapter = if ($null -ne $WaitAdapter) { $WaitAdapter } else { $defaultWait }

    $exitedList = [System.Collections.Generic.List[int]]::new()
    $refusedList = [System.Collections.Generic.List[int]]::new()
    $stillRunningList = [System.Collections.Generic.List[int]]::new()

    foreach ($id in $ProcessIds) {
        $expected = $candidateMap[$id]

        # ShouldProcess prompts BEFORE fresh revalidation so user delay cannot make revalidation stale
        if (-not $PSCmdlet.ShouldProcess("PID $id ($($expected.ProcessName))", "CloseMainWindow")) {
            $lines.Add("Close cancelled by ShouldProcess for PID $id ($($expected.ProcessName)).")
            $refusedList.Add($id)
            continue
        }

        # Re-fetch live snapshot immediately before action to detect PID reuse, drift, or hidden window
        $currentLive = @(Get-YellowProcessSnapshot -Provider $ProcessProvider)
        $currentProc = $currentLive | Where-Object { $_.Id -eq $id }

        if ($null -eq $currentProc) {
            # Omission in snapshot is unverified; do not assume exit or attempt close
            $lines.Add("PID $id omitted in live snapshot; exit unverified. Zero closes performed.")
            $stillRunningList.Add($id)
            continue
        }

        # Identity and window eligibility re-verification
        if ($currentProc.StartTimeUtc -ne $expected.StartTimeUtc -or
            $currentProc.Path -ne $expected.Path -or
            $currentProc.ProcessName -ne $expected.ProcessName -or
            $currentProc.SessionId -ne $expected.SessionId -or
            $null -eq $currentProc.MainWindowHandle -or
            [int64]$currentProc.MainWindowHandle -eq 0) {
            $lines.Add("Identity drift, hidden window, or PID reuse detected for PID $id. Aborting close request.")
            $refusedList.Add($id)
            continue
        }

        $actions.Add("close-request:$id")
        $accepted = $false
        try {
            $accepted = [bool](& $actualCloseAdapter $currentProc)
        } catch {
            $accepted = $false
        }

        if (-not $accepted) {
            $lines.Add("CloseMainWindow() returned false for PID $id ($($expected.ProcessName)). Request refused or window already closing.")
            $refusedList.Add($id)
            continue
        }

        $didExit = $false
        try {
            $didExit = [bool](& $actualWaitAdapter $currentProc 5 $ProcessProvider $SleepAction $NowProvider)
        } catch {
            $didExit = $false
        }

        if ($didExit) {
            $lines.Add("PID $id ($($expected.ProcessName)) gracefully exited.")
            $exitedList.Add($id)
        } else {
            $lines.Add("PID $id ($($expected.ProcessName)) still running or exit unverified after 5s wait (may be waiting for user save prompt).")
            $stillRunningList.Add($id)
        }
    }

    $finalRam = Get-YellowAvailableRamBytes -Provider $MemoryProvider
    $lines.Add("Available physical RAM (final): $(Format-RamMB $finalRam)")
    $lines.Add("Note: RAM savings are observed without causal or future savings guarantee.")

    $allSucceeded = ($refusedList.Count -eq 0 -and $stillRunningList.Count -eq 0)
    return [pscustomobject]@{
        Success = $allSucceeded
        Actions = @($actions)
        Lines = @($lines)
        Exited = @($exitedList)
        Refused = @($refusedList)
        StillRunning = @($stillRunningList)
    }
}

if ($MyInvocation.InvocationName -ne '.' -and $MyInvocation.Line -notmatch '^\s*\.\s') {
    $cliResult = Invoke-YellowSessionMode @PSBoundParameters
    if ($null -ne $cliResult -and $null -ne $cliResult.Lines) {
        $cliResult.Lines | ForEach-Object { [Console]::WriteLine($_) }
    }
    if ($Apply -and ($null -eq $cliResult -or -not $cliResult.Success)) {
        exit 1
    }
}
