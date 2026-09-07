[CmdletBinding()]
param(
    [Parameter(ParameterSetName='Production', Mandatory)][ValidatePattern('^[0-9a-f]{40}$')][string]$CandidateRevision,
    [Parameter(ParameterSetName='Production')][ValidateSet(3000,3001)][int]$Port = 3000,
    [Parameter(ParameterSetName='Test', Mandatory)][switch]$TestMode,
    [Parameter(ParameterSetName='Test', Mandatory)][string]$TestRoot,
    [Parameter(ParameterSetName='Test', Mandatory)][string]$TestChildScript,
    [Parameter(ParameterSetName='Test')][ValidateRange(1,5242880)][long]$TestPerFileByteLimit = 5242880,
    [Parameter(ParameterSetName='Test')][ValidateRange(100,30000)][int]$TestMaximumRuntimeMilliseconds = 5000,
    [Parameter(ParameterSetName='Test')][ValidateRange(10,5000)][int]$TestPollMilliseconds = 50
)

# Order444/Q209: one-shot, storage-bounded supervision for one exact candidate.
# It never provisions, restarts, or discovers a moving source identity.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$productionRuntimeBase = 'D:\Yellow\runtime'
$productionBunPath = 'C:\Users\astha\.bun\bin\bun.exe'
$productionPerFileByteLimit = 5MB
$productionRuntimeMinimumFreeBytes = 1GB
$productionSystemMinimumFreeBytes = 512MB
$productionRuntimeCriticalFreeBytes = 1GB
$productionSystemCriticalFreeBytes = 512MB
$productionPollMilliseconds = 5000
$retainedLogFilesPerStream = 3
$statusByteLimit = 32768

$pumpType = 'Yellow.Order444.BoundedStreamPump' -as [type]
if ($null -eq $pumpType) {
    Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace Yellow.Order444
{
    public static class BoundedStreamPump
    {
        static string FileName(string directory, int port, string stream, int index) =>
            Path.Combine(directory, $"supervisor.{port}.{stream}.{index}.log");

        static void Rotate(string directory, int port, string stream, int retained)
        {
            var oldest = FileName(directory, port, stream, retained - 1);
            if (File.Exists(oldest)) File.Delete(oldest);
            for (var index = retained - 2; index >= 0; index--)
            {
                var source = FileName(directory, port, stream, index);
                if (File.Exists(source)) File.Move(source, FileName(directory, port, stream, index + 1));
            }
        }

        public static async Task PumpAsync(Stream source, string directory, int port, string stream,
            long perFileLimit, int retained, CancellationToken cancellationToken)
        {
            if (source == null) throw new ArgumentNullException(nameof(source));
            if (perFileLimit < 1 || retained < 1) throw new ArgumentOutOfRangeException();
            Rotate(directory, port, stream, retained);
            var buffer = new byte[65536];
            FileStream output = new FileStream(FileName(directory, port, stream, 0), FileMode.CreateNew,
                FileAccess.Write, FileShare.Read, 65536, FileOptions.Asynchronous);
            long written = 0;
            try
            {
                while (true)
                {
                    int count = await source.ReadAsync(buffer, 0, buffer.Length, cancellationToken).ConfigureAwait(false);
                    if (count == 0) break;
                    int offset = 0;
                    while (offset < count)
                    {
                        if (written == perFileLimit)
                        {
                            await output.FlushAsync(cancellationToken).ConfigureAwait(false);
                            output.Dispose();
                            Rotate(directory, port, stream, retained);
                            output = new FileStream(FileName(directory, port, stream, 0), FileMode.CreateNew,
                                FileAccess.Write, FileShare.Read, 65536, FileOptions.Asynchronous);
                            written = 0;
                        }
                        int take = (int)Math.Min(count - offset, perFileLimit - written);
                        await output.WriteAsync(buffer, offset, take, cancellationToken).ConfigureAwait(false);
                        offset += take;
                        written += take;
                    }
                }
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { }
            finally
            {
                output.Dispose();
            }
        }
    }
}
'@
}

function Get-Order444RuntimePaths([string]$Revision) {
    if ($Revision -cnotmatch '^[0-9a-f]{40}$') { throw 'Candidate revision must be exact lowercase40 hex' }
    $source = Join-Path $productionRuntimeBase "order444-$Revision-source"
    $control = Join-Path $productionRuntimeBase "order444-$Revision-control"
    return [pscustomobject]@{
        SourceRoot = $source
        ControlRoot = $control
        ReceiptPath = Join-Path $control 'candidate.receipt.json'
        EnvironmentPath = Join-Path $control 'app.env'
        ArchivePath = Join-Path $control 'candidate-source.zip'
        ManifestPath = Join-Path $control 'fiscal-review-manifest.json'
    }
}

function Get-Sha256Hex([string]$Path) { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Get-StreamSha256Hex([IO.Stream]$Stream) {
    $sha=[Security.Cryptography.SHA256]::Create();try{return [Convert]::ToHexString($sha.ComputeHash($Stream)).ToLowerInvariant()}finally{$sha.Dispose()}
}
function Get-AppTreeFileMap([string]$Root) {
    $rootItem=Get-Item -LiteralPath $Root -Force
    if(-not$rootItem.PSIsContainer-or($rootItem.Attributes-band[IO.FileAttributes]::ReparsePoint)){throw 'Candidate source root is invalid'}
    $rootFull=[IO.Path]::GetFullPath($rootItem.FullName).TrimEnd('\','/');$files=[Collections.Generic.Dictionary[string,string]]::new([StringComparer]::Ordinal)
    $pending=[Collections.Generic.Stack[IO.DirectoryInfo]]::new();$pending.Push($rootItem)
    while($pending.Count-gt0){$directory=$pending.Pop();foreach($entry in @(Get-ChildItem -LiteralPath $directory.FullName -Force)){
        $relative=[IO.Path]::GetRelativePath($rootFull,$entry.FullName).Replace('\','/')
        if($entry.Attributes-band[IO.FileAttributes]::ReparsePoint){if($entry.PSIsContainer-and$relative-ceq'node_modules'){continue};throw 'Candidate source contains unexpected reparse point'}
        if($entry.PSIsContainer){$pending.Push([IO.DirectoryInfo]$entry);continue};if(-not$files.TryAdd($relative,(Get-Sha256Hex $entry.FullName))){throw 'Candidate source path is duplicated'}
    }};return ,$files
}
function Assert-SourceArchiveIdentity([string]$Archive,[string]$ExtractedRoot,[string]$ExpectedHash) {
    if($ExpectedHash-cnotmatch'^[0-9a-f]{64}$'-or(Get-Sha256Hex $Archive)-cne$ExpectedHash){throw 'Candidate archive hash differs from receipt'}
    $actual=Get-AppTreeFileMap $ExtractedRoot;$archived=[Collections.Generic.Dictionary[string,string]]::new([StringComparer]::Ordinal)
    $zip=[IO.Compression.ZipFile]::OpenRead($Archive);try{foreach($entry in $zip.Entries){if([string]::IsNullOrEmpty($entry.Name)){continue};$relative=$entry.FullName.Replace('\','/')
      if($relative.StartsWith('/')-or$relative-match'(^|/)\.\.(/|$)'){throw 'Candidate archive contains unsafe path'};$stream=$entry.Open();try{$hash=Get-StreamSha256Hex $stream}finally{$stream.Dispose()}
      if(-not$archived.TryAdd($relative,$hash)){throw 'Candidate archive contains duplicate path'}
    }}finally{$zip.Dispose()}
    if($actual.Count-ne$archived.Count){throw 'Candidate source file count differs from archive'};foreach($relative in $archived.Keys){if(-not$actual.ContainsKey($relative)-or$actual[$relative]-cne$archived[$relative]){throw 'Candidate source bytes differ from archive'}}
}

function Assert-PrivateFileAcl([string]$Path) {
    $item = Get-Item -LiteralPath $Path -Force
    if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Protected file is not regular' }
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    $acl = Get-Acl -LiteralPath $Path
    $rules = @($acl.Access)
    if (-not $acl.AreAccessRulesProtected -or $acl.Owner -cne $identity -or $rules.Count -ne 1) { throw 'Protected file ACL is not current-user-only' }
    $rule = $rules[0]
    if ($rule.IdentityReference.Translate([Security.Principal.NTAccount]).Value -cne $identity -or
        $rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow -or $rule.IsInherited -or
        (($rule.FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -ne [Security.AccessControl.FileSystemRights]::FullControl)) {
        throw 'Protected file ACL rule is not exact current-user full-control'
    }
}

function Read-ExactEnvironment([string]$Path) {
    Assert-PrivateFileAcl $Path
    $values = [Collections.Generic.Dictionary[string,string]]::new([StringComparer]::Ordinal)
    foreach ($line in @(Get-Content -LiteralPath $Path)) {
        if ($line -notmatch '^([A-Z][A-Z0-9_]*)=(.*)$' -or -not $values.TryAdd($Matches[1],$Matches[2])) { throw 'Protected runtime environment is malformed' }
    }
    $expected = @(
        'HOST','NODE_ENV','PORT','YELLOW_AVAILABILITY_PROJECTION_WORKER','YELLOW_BUILD_SHA',
        'YELLOW_BUSINESS_DAY_ROLL_WORKER','YELLOW_EXTENSION_REGISTRAR_DATABASE_URL','YELLOW_HOLD_EXPIRY_WORKER',
        'YELLOW_LOCAL_REVIEW_EMAIL','YELLOW_LOCAL_REVIEW_PASSWORD','YELLOW_LOCAL_REVIEW_PREFILL','YELLOW_LOCAL_REVIEW_TENANT',
        'YELLOW_OPERATOR_WORKBENCH','YELLOW_PICKUP_TASK_WORKER','YELLOW_RESERVATION_ARRIVAL_ROLL_WORKER',
        'YELLOW_RESERVATION_DEPARTURE_ROLL_WORKER','YELLOW_RUNTIME_DATABASE_URL','YELLOW_TOKEN_SECRET'
    ) | Sort-Object
    if ((@($values.Keys | Sort-Object) -join "`n") -cne ($expected -join "`n")) { throw 'Protected runtime environment key set changed' }
    if ($values['HOST'] -cne '127.0.0.1' -or $values['PORT'] -cne '3000' -or $values['NODE_ENV'] -cne 'production' -or
        $values['YELLOW_BUILD_SHA'] -cne $CandidateRevision -or $values['YELLOW_OPERATOR_WORKBENCH'] -cne '1' -or
        $values['YELLOW_LOCAL_REVIEW_PREFILL'] -cne '1') { throw 'Protected runtime environment identity changed' }
    foreach ($worker in @('YELLOW_AVAILABILITY_PROJECTION_WORKER','YELLOW_BUSINESS_DAY_ROLL_WORKER','YELLOW_HOLD_EXPIRY_WORKER','YELLOW_PICKUP_TASK_WORKER','YELLOW_RESERVATION_ARRIVAL_ROLL_WORKER','YELLOW_RESERVATION_DEPARTURE_ROLL_WORKER')) {
        if ($values[$worker] -cne '1') { throw 'Protected runtime worker configuration changed' }
    }
    foreach ($forbidden in @('YELLOW_INDIA_IRP_PROVIDERS_FILE','YELLOW_FISCAL_SUBMISSION_WORKER')) {
        if ($values.ContainsKey($forbidden)) { throw 'Hosted fiscal provider activation is forbidden in review runtime' }
    }
    return ,$values
}

function Assert-DependencyJunctionIdentity([object]$Junction,[string]$ExpectedTarget) {
    $targets=@($Junction.Target)
    if($Junction.LinkType-cne'Junction'-or$targets.Count-ne1-or$targets[0]-isnot[string]-or
       -not[IO.Path]::IsPathFullyQualified([string]$targets[0])-or-not[IO.Path]::IsPathFullyQualified($ExpectedTarget)){
        throw 'Candidate dependency junction differs from receipt'
    }
    try{$actual=[IO.Path]::GetFullPath([string]$targets[0]);$expected=[IO.Path]::GetFullPath($ExpectedTarget)}
    catch{throw 'Candidate dependency junction differs from receipt'}
    if($actual-ine$expected){throw 'Candidate dependency junction differs from receipt'}
}

function New-SanitizedStartInfo([string]$Executable,[string]$WorkingDirectory,[string[]]$Arguments,
    [Collections.Generic.Dictionary[string,string]]$RuntimeEnvironment) {
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $Executable
    $info.WorkingDirectory = $WorkingDirectory
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.WindowStyle = [Diagnostics.ProcessWindowStyle]::Hidden
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    foreach ($argument in $Arguments) { [void]$info.ArgumentList.Add($argument) }
    foreach ($name in @($info.Environment.Keys)) {
        if ($name -match '^(?i:YELLOW_|PG[A-Z0-9_]*$|HOST$|PORT$|NODE_ENV$|TEMP$|TMP$)') { [void]$info.Environment.Remove($name) }
    }
    $info.Environment['TEMP'] = 'D:\Yellow\temp'
    $info.Environment['TMP'] = 'D:\Yellow\temp'
    if ($null -ne $RuntimeEnvironment) {
        foreach ($entry in $RuntimeEnvironment.GetEnumerator()) { $info.Environment[$entry.Key] = $entry.Value }
        $info.Environment['PORT'] = [string]$Port
    }
    return $info
}

function Write-Status([Collections.IDictionary]$Status,[string]$Path) {
    $json = $Status | ConvertTo-Json -Depth 6
    if ([Text.Encoding]::UTF8.GetByteCount($json) -gt $statusByteLimit) { throw 'Supervisor status exceeded fixed byte bound' }
    $temporary = "$Path.tmp"
    [IO.File]::WriteAllText($temporary,$json,[Text.UTF8Encoding]::new($false))
    [IO.File]::Move($temporary,$Path,$true)
}

function Stop-OwnedChild([Diagnostics.Process]$OwnedProcess) {
    if ($null -ne $OwnedProcess -and -not $OwnedProcess.HasExited) {
        $OwnedProcess.Kill($false)
        if (-not $OwnedProcess.WaitForExit(2000)) { throw 'Exact owned child did not exit inside cleanup bound' }
    }
}

if ($TestMode) {
    $tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\','/')
    $resolvedTestRoot = [IO.Path]::GetFullPath($TestRoot).TrimEnd('\','/')
    $relative = [IO.Path]::GetRelativePath($tempBase,$resolvedTestRoot)
    if ($relative.StartsWith('..') -or [IO.Path]::IsPathRooted($relative) -or [IO.Path]::GetFileName($resolvedTestRoot) -notlike 'supervisor-*') {
        throw 'TestRoot must be a uniquely named supervisor-* child of the system temporary directory'
    }
    $childItem = Get-Item -LiteralPath $TestChildScript -Force
    if ($childItem.PSIsContainer -or ($childItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Test child must be a regular file' }
    if (Test-Path -LiteralPath $resolvedTestRoot) { throw 'TestRoot must be absent' }
    [IO.Directory]::CreateDirectory($resolvedTestRoot) | Out-Null
    $runtimeRoot = $resolvedTestRoot
    $childExecutable = [Diagnostics.Process]::GetCurrentProcess().MainModule.FileName
    $workingDirectory = $runtimeRoot
    $arguments = @('-NoLogo','-NoProfile','-NonInteractive','-File',$childItem.FullName)
    $runtimeEnvironment = $null
    $perFileByteLimit = $TestPerFileByteLimit
    $runtimeMinimumFreeBytes = 1
    $systemMinimumFreeBytes = 1
    $runtimeCriticalFreeBytes = 1
    $systemCriticalFreeBytes = 1
    $pollMilliseconds = $TestPollMilliseconds
    $maximumRuntimeMilliseconds = $TestMaximumRuntimeMilliseconds
    $Port = 3000
    $mode = 'synthetic-test'
} else {
    if ([IO.Path]::GetFileName([Diagnostics.Process]::GetCurrentProcess().MainModule.FileName) -ine 'pwsh.exe') { throw 'Order444 supervisor requires PowerShell7' }
    if ((& $productionBunPath --version).Trim() -cne '1.3.14') { throw 'Unexpected native Bun version' }
    $paths = Get-Order444RuntimePaths $CandidateRevision
    foreach ($path in @($paths.SourceRoot,$paths.ControlRoot)) {
        if (-not (Test-Path -LiteralPath $path -PathType Container)) { throw 'Exact candidate runtime directory is absent' }
    }
    foreach ($path in @($paths.ReceiptPath,$paths.EnvironmentPath,$paths.ArchivePath,$paths.ManifestPath,(Join-Path $paths.SourceRoot 'src\server.ts'))) {
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw 'Exact candidate runtime file is absent' }
    }
    Assert-PrivateFileAcl $paths.ReceiptPath
    $receipt = Get-Content -LiteralPath $paths.ReceiptPath -Raw | ConvertFrom-Json
    $short=$CandidateRevision.Substring(0,12)
    if ($receipt.schema -cne 'yellow-order444-native-candidate/v1' -or $receipt.source -cne $CandidateRevision -or
        $receipt.sourceRoot -cne $paths.SourceRoot -or $receipt.controlRoot -cne $paths.ControlRoot -or
        $receipt.reviewDatabase -cne "yellow_order444_review_$short" -or $receipt.invariantDatabase -cne "yellow_order444_invariants_$short" -or
        [int]$receipt.migrationFrontier -ne 85 -or $receipt.migrationLedgerSha256-cnotmatch'^[0-9a-f]{64}$' -or
        $receipt.bunVersion -cne '1.3.14' -or $receipt.postgresVersionNum -cne '160015' -or [int]$receipt.postgresPort -ne 55503 -or
        $receipt.fixtureManifestSha256-cnotmatch'^[0-9a-f]{64}$' -or $receipt.appEnvironmentSha256-cnotmatch'^[0-9a-f]{64}$' -or
        $receipt.packageJsonSha256-cnotmatch'^[0-9a-f]{64}$' -or $receipt.bunLockSha256-cnotmatch'^[0-9a-f]{64}$' -or
        $receipt.bunfigSha256-cnotmatch'^[0-9a-f]{64}$' -or -not [bool]$receipt.prepared) { throw 'Candidate receipt identity changed' }
    Assert-SourceArchiveIdentity $paths.ArchivePath $paths.SourceRoot $receipt.sourceArchiveSha256
    if((Get-Sha256Hex $paths.ManifestPath)-cne$receipt.fixtureManifestSha256){throw 'Candidate fixture manifest differs from receipt'}
    if((Get-Sha256Hex $paths.EnvironmentPath)-cne$receipt.appEnvironmentSha256){throw 'Protected runtime environment differs from receipt'}
    foreach($identity in @(@('package.json','packageJsonSha256'),@('bun.lock','bunLockSha256'),@('bunfig.toml','bunfigSha256'))){if((Get-Sha256Hex(Join-Path $paths.SourceRoot $identity[0]))-cne[string]$receipt.($identity[1])){throw 'Candidate dependency identity changed'}}
    $junction=Get-Item -LiteralPath (Join-Path $paths.SourceRoot 'node_modules') -Force
    Assert-DependencyJunctionIdentity $junction ([string]$receipt.dependencyJunction)
    $runtimeRoot = $paths.ControlRoot
    $childExecutable = $productionBunPath
    $workingDirectory = $paths.SourceRoot
    $arguments = @('src/server.ts')
    $runtimeEnvironment = Read-ExactEnvironment $paths.EnvironmentPath
    $perFileByteLimit = $productionPerFileByteLimit
    $runtimeMinimumFreeBytes = $productionRuntimeMinimumFreeBytes
    $systemMinimumFreeBytes = $productionSystemMinimumFreeBytes
    $runtimeCriticalFreeBytes = $productionRuntimeCriticalFreeBytes
    $systemCriticalFreeBytes = $productionSystemCriticalFreeBytes
    $pollMilliseconds = $productionPollMilliseconds
    $maximumRuntimeMilliseconds = 0
    $mode = 'order444-candidate'
}

$statusPath = Join-Path $runtimeRoot "supervisor.$Port.status.json"
$supervisorRecord=Get-CimInstance Win32_Process -Filter "ProcessId = $PID"
if($null-eq$supervisorRecord-or$null-eq$supervisorRecord.CreationDate){throw 'Supervisor process start identity is unavailable'}
$supervisorStartedUtc=$supervisorRecord.CreationDate.ToUniversalTime().ToString('o')
$status = [ordered]@{
    schema='yellow-order444-native-bounded/v1';mode=$mode;source=if($TestMode){$null}else{$CandidateRevision};port=$Port
    supervisorStartedUtc=$supervisorStartedUtc;childPid=$null;childStartedUtc=$null;reason='preflight';launchCount=0
    childExitCode=$null;supervisorExitCode=$null;stoppedUtc=$null;perFileByteLimit=$perFileByteLimit
    retainedLogFilesPerStream=$retainedLogFilesPerStream;automaticRestart=$false;failureType=$null
}
$child = $null
$stdoutTask = $null
$stderrTask = $null
$cancellation = [Threading.CancellationTokenSource]::new()
$exitCode = 22
try {
    $runtimeDrive = [IO.DriveInfo]::new([IO.Path]::GetPathRoot($runtimeRoot))
    $systemDrive = [IO.DriveInfo]::new([IO.Path]::GetPathRoot([Environment]::GetFolderPath([Environment+SpecialFolder]::System)))
    if ($runtimeDrive.AvailableFreeSpace -lt $runtimeMinimumFreeBytes -or $systemDrive.AvailableFreeSpace -lt $systemMinimumFreeBytes) {
        $status.reason='preflight_low_space';$exitCode=20
    } else {
        $info = New-SanitizedStartInfo $childExecutable $workingDirectory $arguments $runtimeEnvironment
        $child = [Diagnostics.Process]::new();$child.StartInfo=$info
        if (-not $child.Start()) { throw 'Exact child process did not start' }
        $childRecord=$null
        foreach($attempt in 1..20){$childRecord=Get-CimInstance Win32_Process -Filter "ProcessId = $($child.Id)";if($null-ne$childRecord-and$null-ne$childRecord.CreationDate){break};Start-Sleep -Milliseconds 25}
        if($null-eq$childRecord-or$null-eq$childRecord.CreationDate){throw 'Exact child process start identity is unavailable'}
        $status.childPid=$child.Id;$status.childStartedUtc=$childRecord.CreationDate.ToUniversalTime().ToString('o');$status.launchCount=1;$status.reason='running'
        Write-Status $status $statusPath
        $stdoutTask = [Yellow.Order444.BoundedStreamPump]::PumpAsync($child.StandardOutput.BaseStream,$runtimeRoot,$Port,'stdout',$perFileByteLimit,$retainedLogFilesPerStream,$cancellation.Token)
        $stderrTask = [Yellow.Order444.BoundedStreamPump]::PumpAsync($child.StandardError.BaseStream,$runtimeRoot,$Port,'stderr',$perFileByteLimit,$retainedLogFilesPerStream,$cancellation.Token)
        $watch=[Diagnostics.Stopwatch]::StartNew()
        while (-not $child.WaitForExit($pollMilliseconds)) {
            if($stdoutTask.IsFaulted-or$stderrTask.IsFaulted){
                $status.reason='log_pump_failure';$status.failureType='bounded_stream_pump_fault';$exitCode=22;Stop-OwnedChild $child;break
            }
            if ($maximumRuntimeMilliseconds -gt 0 -and $watch.ElapsedMilliseconds -ge $maximumRuntimeMilliseconds) {
                $status.reason='runtime_deadline';$exitCode=20;Stop-OwnedChild $child;break
            }
            $runtimeDrive = [IO.DriveInfo]::new([IO.Path]::GetPathRoot($runtimeRoot))
            $systemDrive = [IO.DriveInfo]::new([IO.Path]::GetPathRoot([Environment]::GetFolderPath([Environment+SpecialFolder]::System)))
            if ($runtimeDrive.AvailableFreeSpace -lt $runtimeCriticalFreeBytes -or $systemDrive.AvailableFreeSpace -lt $systemCriticalFreeBytes) {
                $status.reason='critical_low_space';$exitCode=20;Stop-OwnedChild $child;break
            }
        }
        if ($status.reason -ceq 'running') { $status.reason='child_exit';$status.childExitCode=$child.ExitCode;$exitCode=$child.ExitCode }
    }
} catch {
    $status.reason='supervisor_failure';$status.failureType=$_.Exception.GetType().FullName;$exitCode=22
    try { Stop-OwnedChild $child } catch { $status.failureType='owned_child_cleanup_unproven' }
} finally {
    $tasks=@(@($stdoutTask,$stderrTask)|Where-Object{$null-ne$_})
    $streamsSettled=$true
    if ($tasks.Count -gt 0) {
        try{$streamsSettled=[Threading.Tasks.Task]::WaitAll($tasks,1000)}catch{$streamsSettled=@($tasks|Where-Object{-not$_.IsCompleted}).Count-eq0}
    }
    if(-not$streamsSettled){
        $cancellation.Cancel()
        if($null-ne$child){try{$child.StandardOutput.Close()}catch{};try{$child.StandardError.Close()}catch{}}
        try{$streamsSettled=[Threading.Tasks.Task]::WaitAll($tasks,1000)}catch{$streamsSettled=@($tasks|Where-Object{-not$_.IsCompleted}).Count-eq0}
    }
    if (-not $streamsSettled) {
        $status.failureType='stream_cleanup_unproven';$status.reason='supervisor_failure';$exitCode=22
    }
    $status.supervisorExitCode=$exitCode;$status.stoppedUtc=[DateTime]::UtcNow.ToString('o')
    try { Write-Status $status $statusPath } catch { $exitCode=22 }
    $cancellation.Dispose();if($null-ne$child){$child.Dispose()}
}
exit $exitCode
