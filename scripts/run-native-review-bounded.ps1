[CmdletBinding()]
param(
    [switch]$TestMode,
    [string]$TestRoot,
    [string]$TestChildScript,
    [string]$TestFreeSpaceSequenceFile,
    [ValidateRange(1, 5242880)][long]$TestPerFileByteLimit = 5242880,
    [ValidateRange(1, [long]::MaxValue)][long]$TestRuntimeMinimumFreeBytes = 1073741824,
    [ValidateRange(1, [long]::MaxValue)][long]$TestSystemMinimumFreeBytes = 536870912,
    [ValidateRange(1, [long]::MaxValue)][long]$TestRuntimeCriticalFreeBytes = 1073741824,
    [ValidateRange(1, [long]::MaxValue)][long]$TestSystemCriticalFreeBytes = 536870912,
    [ValidateRange(10, 5000)][int]$TestPollMilliseconds = 5000
)

# Order443: one-shot, storage-bounded supervision for the exact Order442 preview.
# TestMode is intentionally confined to a uniquely named direct child of D:\Yellow\temp.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$productionAppRoot = 'D:\Yellow\runtime\main-b5ef708'
$productionEnvironmentFile = 'D:\Yellow\runtime\order442-review\app.env'
$productionRuntimeRoot = 'D:\Yellow\runtime\order442-review'
$productionBunPath = 'C:\Users\astha\.bun\bin\bun.exe'
$productionPerFileByteLimit = 5MB
$productionRuntimeMinimumFreeBytes = 1GB
$productionSystemMinimumFreeBytes = 512MB
$productionRuntimeCriticalFreeBytes = 1GB
$productionSystemCriticalFreeBytes = 512MB
$productionPollMilliseconds = 5000
$retainedFileCount = 3
$statusByteLimit = 32768
$testBaseRoot = 'D:\Yellow\temp'

$pumpType = 'Yellow.Order443.BoundedStreamPump' -as [type]
if ($null -eq $pumpType) {
    Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace Yellow.Order443
{
    public static class BoundedStreamPump
    {
        public static async Task PumpAsync(
            Stream source,
            string directory,
            string streamName,
            long perFileByteLimit,
            int retainedFileCount,
            CancellationToken cancellationToken)
        {
            if (source == null) throw new ArgumentNullException(nameof(source));
            if (perFileByteLimit < 1) throw new ArgumentOutOfRangeException(nameof(perFileByteLimit));
            if (retainedFileCount < 1) throw new ArgumentOutOfRangeException(nameof(retainedFileCount));

            string PathFor(int index) => Path.Combine(directory, $"supervisor.{streamName}.{index}.log");

            for (var index = 0; index < retainedFileCount; index++)
            {
                var existing = PathFor(index);
                if (File.Exists(existing) && new FileInfo(existing).Length > perFileByteLimit)
                    File.Delete(existing);
            }
            var oldest = PathFor(retainedFileCount - 1);
            if (File.Exists(oldest)) File.Delete(oldest);
            for (var index = retainedFileCount - 2; index >= 0; index--)
            {
                var sourcePath = PathFor(index);
                if (File.Exists(sourcePath)) File.Move(sourcePath, PathFor(index + 1));
            }

            var buffer = new byte[65536];
            FileStream output = OpenCurrent();
            long currentBytes = 0;
            try
            {
                while (true)
                {
                    var read = await source.ReadAsync(buffer, 0, buffer.Length, cancellationToken).ConfigureAwait(false);
                    if (read == 0) break;

                    var offset = 0;
                    while (offset < read)
                    {
                        if (currentBytes == perFileByteLimit)
                        {
                            await output.FlushAsync(cancellationToken).ConfigureAwait(false);
                            output.Dispose();
                            RotateFullFiles();
                            output = OpenCurrent();
                            currentBytes = 0;
                        }

                        var writable = (int)Math.Min(read - offset, perFileByteLimit - currentBytes);
                        await output.WriteAsync(buffer, offset, writable, cancellationToken).ConfigureAwait(false);
                        currentBytes += writable;
                        offset += writable;
                    }
                }

                await output.FlushAsync(cancellationToken).ConfigureAwait(false);
            }
            finally
            {
                output.Dispose();
            }

            FileStream OpenCurrent()
            {
                return new FileStream(
                    PathFor(0),
                    FileMode.Create,
                    FileAccess.Write,
                    FileShare.Read,
                    65536,
                    FileOptions.Asynchronous | FileOptions.SequentialScan);
            }

            void RotateFullFiles()
            {
                var last = PathFor(retainedFileCount - 1);
                if (File.Exists(last)) File.Delete(last);
                for (var index = retainedFileCount - 2; index >= 0; index--)
                {
                    var sourcePath = PathFor(index);
                    if (File.Exists(sourcePath)) File.Move(sourcePath, PathFor(index + 1));
                }
            }
        }
    }
}
'@
    $pumpType = 'Yellow.Order443.BoundedStreamPump' -as [type]
}

function Resolve-FullPath([string]$Path) {
    return [IO.Path]::GetFullPath($Path).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
}

function Assert-PathWithin([string]$Path, [string]$Root, [string]$Description) {
    $fullPath = Resolve-FullPath $Path
    $fullRoot = Resolve-FullPath $Root
    $prefix = $fullRoot + [IO.Path]::DirectorySeparatorChar
    if (-not $fullPath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "$Description must stay inside the synthetic test root"
    }
    return $fullPath
}

function Write-SupervisorStatus([hashtable]$Status, [string]$Path) {
    $json = $Status | ConvertTo-Json -Depth 5 -Compress
    $bytes = [Text.UTF8Encoding]::new($false).GetBytes($json)
    if ($bytes.Length -gt $statusByteLimit) {
        throw 'Supervisor status exceeded its fixed byte limit'
    }
    [IO.File]::WriteAllBytes($Path, $bytes)
}

function Import-EnvironmentFile([Diagnostics.ProcessStartInfo]$StartInfo, [string]$Path) {
    $file = Get-Item -LiteralPath $Path
    if ($file.Length -gt 1MB) {
        throw 'Protected environment file exceeds the supervisor input bound'
    }
    $lineNumber = 0
    foreach ($line in [IO.File]::ReadLines($file.FullName)) {
        $lineNumber++
        if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith('#')) { continue }
        $separator = $line.IndexOf('=')
        if ($separator -lt 1) { throw "Protected environment file has an invalid line at $lineNumber" }
        $name = $line.Substring(0, $separator).Trim()
        if ($name -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
            throw "Protected environment file has an invalid key at $lineNumber"
        }
        $StartInfo.Environment[$name] = $line.Substring($separator + 1)
    }
}

$testOnlyParameters = @(
    'TestRoot', 'TestChildScript', 'TestFreeSpaceSequenceFile', 'TestPerFileByteLimit',
    'TestRuntimeMinimumFreeBytes', 'TestSystemMinimumFreeBytes',
    'TestRuntimeCriticalFreeBytes', 'TestSystemCriticalFreeBytes', 'TestPollMilliseconds'
)
if (-not $TestMode -and @($testOnlyParameters | Where-Object { $PSBoundParameters.ContainsKey($_) }).Count -gt 0) {
    throw 'Test-only overrides require explicit -TestMode'
}

$spaceSequence = @()
$spaceSequenceIndex = 0
if ($TestMode) {
    if ([string]::IsNullOrWhiteSpace($TestRoot) -or [string]::IsNullOrWhiteSpace($TestChildScript)) {
        throw 'TestMode requires TestRoot and TestChildScript'
    }
    $runtimeRoot = Resolve-FullPath $TestRoot
    $expectedParent = Resolve-FullPath $testBaseRoot
    if (-not [string]::Equals((Split-Path $runtimeRoot -Parent), $expectedParent, [StringComparison]::OrdinalIgnoreCase) -or
        (Split-Path $runtimeRoot -Leaf) -notmatch '^yellow-native-review-bounded-[0-9a-f]{32}$') {
        throw 'TestRoot must be a GUID-named direct child of D:\Yellow\temp'
    }
    if (-not (Test-Path -LiteralPath $runtimeRoot -PathType Container)) { throw 'Synthetic test root does not exist' }
    $childScript = Assert-PathWithin $TestChildScript $runtimeRoot 'TestChildScript'
    if (-not (Test-Path -LiteralPath $childScript -PathType Leaf) -or [IO.Path]::GetExtension($childScript) -ne '.ps1') {
        throw 'TestChildScript must be an existing PowerShell script inside TestRoot'
    }
    $perFileByteLimit = $TestPerFileByteLimit
    $runtimeMinimumFreeBytes = $TestRuntimeMinimumFreeBytes
    $systemMinimumFreeBytes = $TestSystemMinimumFreeBytes
    $runtimeCriticalFreeBytes = $TestRuntimeCriticalFreeBytes
    $systemCriticalFreeBytes = $TestSystemCriticalFreeBytes
    $pollMilliseconds = $TestPollMilliseconds
    if ($TestFreeSpaceSequenceFile) {
        $sequenceFile = Assert-PathWithin $TestFreeSpaceSequenceFile $runtimeRoot 'TestFreeSpaceSequenceFile'
        $sequenceInfo = Get-Item -LiteralPath $sequenceFile
        if ($sequenceInfo.Length -gt 65536) { throw 'Synthetic free-space sequence exceeds its fixed input bound' }
        $parsedSequence = [IO.File]::ReadAllText($sequenceInfo.FullName) | ConvertFrom-Json
        $spaceSequence = @($parsedSequence)
        if ($spaceSequence.Count -lt 1 -or $spaceSequence.Count -gt 100) {
            throw 'Synthetic free-space sequence must contain between 1 and 100 samples'
        }
        foreach ($sample in $spaceSequence) {
            if ($null -eq $sample.RuntimeFreeBytes -or $null -eq $sample.SystemFreeBytes -or
                [long]$sample.RuntimeFreeBytes -lt 0 -or [long]$sample.SystemFreeBytes -lt 0) {
                throw 'Synthetic free-space samples require non-negative RuntimeFreeBytes and SystemFreeBytes'
            }
        }
    }
    $childExecutable = [Diagnostics.Process]::GetCurrentProcess().MainModule.FileName
    if ([IO.Path]::GetFileName($childExecutable) -notin @('pwsh', 'pwsh.exe')) {
        throw 'TestMode requires Windows PowerShell 7 (pwsh)'
    }
} else {
    $runtimeRoot = $productionRuntimeRoot
    $childExecutable = $productionBunPath
    $perFileByteLimit = $productionPerFileByteLimit
    $runtimeMinimumFreeBytes = $productionRuntimeMinimumFreeBytes
    $systemMinimumFreeBytes = $productionSystemMinimumFreeBytes
    $runtimeCriticalFreeBytes = $productionRuntimeCriticalFreeBytes
    $systemCriticalFreeBytes = $productionSystemCriticalFreeBytes
    $pollMilliseconds = $productionPollMilliseconds
    foreach ($requiredPath in @($productionAppRoot, $productionRuntimeRoot)) {
        if (-not (Test-Path -LiteralPath $requiredPath -PathType Container)) { throw "Required admitted production directory is absent: $requiredPath" }
    }
    foreach ($requiredFile in @($productionEnvironmentFile, $productionBunPath, (Join-Path $productionAppRoot 'src\server.ts'))) {
        if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) { throw "Required admitted production file is absent: $requiredFile" }
    }
}

$statusPath = Join-Path $runtimeRoot 'supervisor.status.json'
$status = [ordered]@{
    schema = 'yellow-native-review-bounded/v1'
    mode = if ($TestMode) { 'synthetic-test' } else { 'order442-preview' }
    supervisorStartedUtc = [DateTime]::UtcNow.ToString('o')
    childPid = $null
    childStartedUtc = $null
    reason = 'preflight'
    launchCount = 0
    childExitCode = $null
    supervisorExitCode = $null
    stoppedUtc = $null
    perFileByteLimit = $perFileByteLimit
    retainedFilesPerStream = $retainedFileCount
    runtimeMinimumFreeBytes = $runtimeMinimumFreeBytes
    systemMinimumFreeBytes = $systemMinimumFreeBytes
    runtimeCriticalFreeBytes = $runtimeCriticalFreeBytes
    systemCriticalFreeBytes = $systemCriticalFreeBytes
    lastRuntimeFreeBytes = $null
    lastSystemFreeBytes = $null
    failureType = $null
}

function Get-FreeSpaceSnapshot {
    if ($spaceSequence.Count -gt 0) {
        $index = [Math]::Min($spaceSequenceIndex, $spaceSequence.Count - 1)
        $sample = $spaceSequence[$index]
        $script:spaceSequenceIndex++
        return [pscustomobject]@{
            RuntimeFreeBytes = [long]$sample.RuntimeFreeBytes
            SystemFreeBytes = [long]$sample.SystemFreeBytes
        }
    }
    $runtimeDrive = [IO.DriveInfo]::new([IO.Path]::GetPathRoot($runtimeRoot))
    $systemPath = [Environment]::GetFolderPath([Environment+SpecialFolder]::System)
    $systemDrive = [IO.DriveInfo]::new([IO.Path]::GetPathRoot($systemPath))
    return [pscustomobject]@{
        RuntimeFreeBytes = [long]$runtimeDrive.AvailableFreeSpace
        SystemFreeBytes = [long]$systemDrive.AvailableFreeSpace
    }
}

function Set-SpaceStatus($Snapshot) {
    $status.lastRuntimeFreeBytes = [long]$Snapshot.RuntimeFreeBytes
    $status.lastSystemFreeBytes = [long]$Snapshot.SystemFreeBytes
}

function Stop-OwnedChild([Diagnostics.Process]$OwnedProcess) {
    if ($null -ne $OwnedProcess -and -not $OwnedProcess.HasExited) {
        $OwnedProcess.Kill($false)
        if (-not $OwnedProcess.WaitForExit(10000)) {
            throw 'Owned child did not exit after the bounded stop request'
        }
    }
}

$child = $null
$stdoutTask = $null
$stderrTask = $null
$supervisorExitCode = 22
try {
    $preflight = Get-FreeSpaceSnapshot
    Set-SpaceStatus $preflight
    if ($preflight.RuntimeFreeBytes -lt $runtimeMinimumFreeBytes) {
        $status.reason = 'preflight_runtime_low_space'
        $supervisorExitCode = 20
    } elseif ($preflight.SystemFreeBytes -lt $systemMinimumFreeBytes) {
        $status.reason = 'preflight_system_low_space'
        $supervisorExitCode = 20
    } else {
        $startInfo = [Diagnostics.ProcessStartInfo]::new()
        $startInfo.FileName = $childExecutable
        $startInfo.WorkingDirectory = if ($TestMode) { $runtimeRoot } else { $productionAppRoot }
        $startInfo.UseShellExecute = $false
        $startInfo.CreateNoWindow = $true
        $startInfo.WindowStyle = [Diagnostics.ProcessWindowStyle]::Hidden
        $startInfo.RedirectStandardOutput = $true
        $startInfo.RedirectStandardError = $true
        if ($TestMode) {
            [void]$startInfo.ArgumentList.Add('-NoLogo')
            [void]$startInfo.ArgumentList.Add('-NoProfile')
            [void]$startInfo.ArgumentList.Add('-NonInteractive')
            [void]$startInfo.ArgumentList.Add('-File')
            [void]$startInfo.ArgumentList.Add($childScript)
        } else {
            Import-EnvironmentFile $startInfo $productionEnvironmentFile
            [void]$startInfo.ArgumentList.Add("--env-file=$productionEnvironmentFile")
            [void]$startInfo.ArgumentList.Add('src/server.ts')
        }

        $child = [Diagnostics.Process]::new()
        $child.StartInfo = $startInfo
        if (-not $child.Start()) { throw 'Native child process did not start' }
        $status.childPid = $child.Id
        $status.childStartedUtc = $child.StartTime.ToUniversalTime().ToString('o')
        $status.launchCount = 1
        $status.reason = 'running'
        Write-SupervisorStatus $status $statusPath

        $stdoutTask = $pumpType::PumpAsync($child.StandardOutput.BaseStream, $runtimeRoot, 'stdout', $perFileByteLimit, $retainedFileCount, [Threading.CancellationToken]::None)
        $stderrTask = $pumpType::PumpAsync($child.StandardError.BaseStream, $runtimeRoot, 'stderr', $perFileByteLimit, $retainedFileCount, [Threading.CancellationToken]::None)

        while (-not $child.WaitForExit($pollMilliseconds)) {
            $sample = Get-FreeSpaceSnapshot
            Set-SpaceStatus $sample
            if ($sample.RuntimeFreeBytes -lt $runtimeCriticalFreeBytes) {
                $status.reason = 'critical_runtime_low_space'
                $supervisorExitCode = 21
                Stop-OwnedChild $child
                break
            }
            if ($sample.SystemFreeBytes -lt $systemCriticalFreeBytes) {
                $status.reason = 'critical_system_low_space'
                $supervisorExitCode = 21
                Stop-OwnedChild $child
                break
            }
            Write-SupervisorStatus $status $statusPath
        }

        if ($status.reason -eq 'running') {
            $status.reason = 'child_exit'
            $supervisorExitCode = $child.ExitCode
        }
        $child.WaitForExit()
        [Threading.Tasks.Task[]]$pumpTasks = @($stdoutTask, $stderrTask)
        [Threading.Tasks.Task]::WhenAll($pumpTasks).GetAwaiter().GetResult()
        $status.childExitCode = $child.ExitCode
    }
} catch {
    $status.reason = 'supervisor_failure'
    $status.failureType = $_.Exception.GetType().Name
    $supervisorExitCode = 22
    [Console]::Error.WriteLine('Bounded native supervisor failed; inspect its credential-free status and bounded stream files')
} finally {
    if ($null -ne $child -and -not $child.HasExited) {
        try { Stop-OwnedChild $child } catch { $status.reason = 'owned_child_cleanup_failure' }
    }
    if ($null -ne $child -and $child.HasExited) { $status.childExitCode = $child.ExitCode }
    $status.supervisorExitCode = $supervisorExitCode
    $status.stoppedUtc = [DateTime]::UtcNow.ToString('o')
    Write-SupervisorStatus $status $statusPath
    if ($null -ne $child) { $child.Dispose() }
}

[pscustomobject]@{
    StatusPath = $statusPath
    Reason = $status.reason
    ChildPid = $status.childPid
    ChildExitCode = $status.childExitCode
    SupervisorExitCode = $supervisorExitCode
}
exit $supervisorExitCode
