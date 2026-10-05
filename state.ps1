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
    # Compile before the shared native-operation clock starts. The caller still
    # bounds the entire script. This job is unnamed and its handle non-inheritable;
    # ordinary descendants cannot break away and last-handle close kills them.
    if (-not ('Yellow.BuildStatus.ProbeJob' -as [type])) {
        Add-Type -ErrorAction Stop -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
namespace Yellow.BuildStatus {
    public sealed class ProbeJob : IDisposable {
        const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000;
        [StructLayout(LayoutKind.Sequential)]
        struct BasicLimits {
            public long ProcessUserTime, JobUserTime;
            public uint Flags;
            public UIntPtr MinimumWorkingSet, MaximumWorkingSet;
            public uint ActiveProcessLimit;
            public UIntPtr Affinity;
            public uint PriorityClass, SchedulingClass;
        }
        [StructLayout(LayoutKind.Sequential)]
        struct IoCounters {
            public ulong ReadOperations, WriteOperations, OtherOperations;
            public ulong ReadBytes, WriteBytes, OtherBytes;
        }
        [StructLayout(LayoutKind.Sequential)]
        struct ExtendedLimits {
            public BasicLimits Basic;
            public IoCounters Io;
            public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory;
        }
        [StructLayout(LayoutKind.Sequential)]
        struct Accounting {
            public long UserTime, KernelTime, PeriodUserTime, PeriodKernelTime;
            public uint PageFaults, TotalProcesses, ActiveProcesses, TerminatedProcesses;
        }
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        static extern IntPtr CreateJobObject(IntPtr attributes, string name);
        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        static extern bool SetInformationJobObject(SafeFileHandle job, int kind, ref ExtendedLimits limits, uint length);
        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        static extern bool AssignProcessToJobObject(SafeFileHandle job, IntPtr process);
        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        static extern bool TerminateJobObject(SafeFileHandle job, uint exitCode);
        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        static extern bool QueryInformationJobObject(SafeFileHandle job, int kind, out Accounting accounting, uint length, IntPtr returned);
        readonly SafeFileHandle handle;
        public ProbeJob() {
            handle = new SafeFileHandle(CreateJobObject(IntPtr.Zero, null), true);
            if (handle.IsInvalid) throw new Win32Exception(Marshal.GetLastWin32Error());
            var limits = new ExtendedLimits();
            limits.Basic.Flags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            if (!SetInformationJobObject(handle, 9, ref limits, (uint)Marshal.SizeOf(typeof(ExtendedLimits)))) {
                int error = Marshal.GetLastWin32Error();
                handle.Dispose();
                throw new Win32Exception(error);
            }
        }
        public void Assign(IntPtr process) {
            if (!AssignProcessToJobObject(handle, process)) throw new Win32Exception(Marshal.GetLastWin32Error());
        }
        public void Terminate() {
            if (!TerminateJobObject(handle, 1)) throw new Win32Exception(Marshal.GetLastWin32Error());
        }
        public uint ActiveProcesses() {
            Accounting accounting;
            if (!QueryInformationJobObject(handle, 1, out accounting, (uint)Marshal.SizeOf(typeof(Accounting)), IntPtr.Zero))
                throw new Win32Exception(Marshal.GetLastWin32Error());
            return accounting.ActiveProcesses;
        }
        public void Dispose() { handle.Dispose(); }
    }
}
'@
    }
    function Stop-OwnedStatusProbe([System.Diagnostics.Process]$Process, $Job) {
        try {
            $Job.Terminate()
            # Root exit alone is not proof: its children remain in the job.
            while ($Job.ActiveProcesses() -ne 0) {
                if ($probeClock.ElapsedMilliseconds -ge $probeLifecycleMs) { return $false }
                [System.Threading.Thread]::Sleep(1)
            }
            $remaining = [Math]::Max(0, $probeLifecycleMs - [int]$probeClock.ElapsedMilliseconds)
            return $Process.WaitForExit($remaining)
        } catch {
            return $false
        }
    }
    function Invoke-BoundedStatusProbe([string]$Arguments) {
        if ($probeClock.ElapsedMilliseconds -ge $probeOperationMs) { return $null }
        $process = $null
        $job = $null
        $admitted = $false
        $cleanupRequired = $false
        try {
            $sentinel = "__YELLOW_STATUS_$([Guid]::NewGuid().ToString('N'))__"
            $admission = [Guid]::NewGuid().ToString('N')
            $job = New-Object Yellow.BuildStatus.ProbeJob -ErrorAction Stop
            $startInfo = New-Object System.Diagnostics.ProcessStartInfo
            $startInfo.FileName = [IO.Path]::Combine($env:SystemRoot, 'System32', 'cmd.exe')
            $startInfo.Arguments = "/d /v:on /s /c `"set `"__yellow_status_admission=`" & set /p __yellow_status_admission= & if `"!__yellow_status_admission!`"==`"$admission`" (call docker $Arguments 2>nul & echo $sentinel`:!errorlevel!) else (exit 97)`""
            $startInfo.WorkingDirectory = $PSScriptRoot
            $startInfo.UseShellExecute = $false
            $startInfo.CreateNoWindow = $true
            $startInfo.RedirectStandardInput = $true
            $startInfo.RedirectStandardOutput = $true
            $startInfo.RedirectStandardError = $true
            $process = New-Object System.Diagnostics.Process
            $process.StartInfo = $startInfo
            # .NET Framework selects the stdin writer's encoding at Start and
            # may emit its preamble immediately. It has no StandardInputEncoding
            # property; temporarily select BOM-free UTF-8, then restore it.
            $previousInputEncoding = [Console]::InputEncoding
            try {
                [Console]::InputEncoding = $utf8NoBom
                [void]$process.Start()
            } finally {
                [Console]::InputEncoding = $previousInputEncoding
            }
            $stdinHold = $process.StandardInput
            $stderr = $process.StandardError.ReadToEndAsync()
            # Nothing beyond this fixed admission gate runs until exact-handle
            # assignment succeeds. EOF/mismatched input exits without Docker.
            $job.Assign($process.Handle)
            $cleanupRequired = $true
            $stdinHold.WriteLine($admission)
            $stdinHold.Flush()
            # cmd's redirected set /p waits for EOF. The job (not an open stdin
            # or surviving root PID) now owns descendants, so closing is safe.
            $stdinHold.Close()
            $admitted = $true
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
            $treeStopped = Stop-OwnedStatusProbe $process $job
            $cleanupRequired = $false
            if (-not $treeStopped) { throw 'Owned native status probe tree cleanup was not proven' }
            $remaining = [Math]::Max(0, $probeLifecycleMs - [int]$probeClock.ElapsedMilliseconds)
            $tail = $process.StandardOutput.ReadLineAsync()
            $tailReady = $tail.Wait($remaining)
            $remaining = [Math]::Max(0, $probeLifecycleMs - [int]$probeClock.ElapsedMilliseconds)
            if (-not $tailReady -or $null -ne $tail.Result -or -not $stderr.Wait($remaining)) {
                throw 'Owned native status probe stream cleanup was not proven'
            }
            if ($null -eq $exitCode -and $process.ExitCode -eq 97) {
                throw 'Owned native status probe admission failed: wrapper rejected input'
            }
            if ($stderr.Result -or $exitCode -ne 0) { return $null }
            return $lines
        } catch {
            if ($cleanupRequired) {
                $treeStopped = Stop-OwnedStatusProbe $process $job
                $cleanupRequired = $false
                if (-not $treeStopped) { throw 'Owned native status probe tree cleanup was not proven' }
            }
            if (-not $admitted) {
                # No child can have launched before admission. Kill by the owned
                # process handle, never by a separately rediscovered PID/tree.
                if ($null -ne $process -and -not $process.HasExited) {
                    $process.Kill()
                    $remaining = [Math]::Max(0, $probeLifecycleMs - [int]$probeClock.ElapsedMilliseconds)
                    if (-not $process.WaitForExit($remaining)) { throw 'Owned native status probe admission cleanup was not proven' }
                }
                throw "Owned native status probe admission failed: $($_.Exception.Message)"
            }
            if ($_.Exception.Message -like 'Owned native status probe * cleanup was not proven' -or
                $_.Exception.Message -like 'Owned native status probe admission failed:*') { throw }
            return $null
        } finally {
            try {
                if ($cleanupRequired) {
                    $treeStopped = Stop-OwnedStatusProbe $process $job
                    if (-not $treeStopped) { throw 'Owned native status probe tree cleanup was not proven' }
                }
            } finally {
                if ($null -ne $job) { $job.Dispose() }
                if ($null -ne $process) { $process.Dispose() }
            }
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
