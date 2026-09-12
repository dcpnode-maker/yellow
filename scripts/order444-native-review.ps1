[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidateSet('Prepare','Promote','Rollback')][string]$Action,
    [Parameter(Mandatory)][ValidatePattern('^[0-9a-f]{40}$')][string]$CandidateRevision
)

# Order444/Q209: exact-source candidate preparation and one-listener promotion.
# Runtime execution requires a separately recorded Order444 target admission.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repositoryRoot = Split-Path $PSScriptRoot -Parent
$runtimeBase = 'D:\Yellow\runtime'
$temporaryBase = 'D:\Yellow\temp'
$gitPath = 'C:\Users\astha\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe'
$bunPath = 'C:\Users\astha\.bun\bin\bun.exe'
$powerShellPath = 'C:\Users\astha\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe'
$psqlPath = 'E:\yellow\toolchains\postgresql-16.15\pgsql\bin\psql.exe'
$postgresPath = 'E:\yellow\toolchains\postgresql-16.15\pgsql\bin\postgres.exe'
$pythonPath = 'C:\Users\astha\AppData\Local\Programs\Python\Python313\python.exe'
$clusterRoot = 'D:\Yellow\temp\order434-production-cluster-20260906'
$templateDatabase = 'yellow_order434_production'
$postgresPort = 55503
$stagingPort = 3001
$founderPort = 3000
$expectedFrontier = 85
$oldRevision = 'b5ef70842b658183f7b5b4c650c8e78c7a0b513d'
$oldSourceRoot = 'D:\Yellow\runtime\main-b5ef708'
$oldControlRoot = 'D:\Yellow\runtime\order442-review'
$oldReviewDatabase = 'yellow_order442_review'
$oldResumeHelper = Join-Path $PSScriptRoot 'resume-merged-native-review.ps1'
$oldSupervisorHelper = Join-Path $PSScriptRoot 'run-native-review-bounded.ps1'
$candidateSupervisor = Join-Path $PSScriptRoot 'run-order444-native-review-bounded.ps1'
$candidateChildExecutable = $bunPath
$candidateChildCommand = "$bunPath src/server.ts"
$maximumPromotionReceipts = 1
$privateLogByteLimit = 5MB

function Initialize-Order444ToolPump {
    $toolPumpType='Yellow.Order444.BoundedToolPump' -as [type]
    if($null-ne$toolPumpType){return}
    Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
namespace Yellow.Order444 {
  public static class BoundedToolPump {
    public static async Task CopyAsync(Stream source,string path,long limit,CancellationToken token) {
      var buffer=new byte[65536];long total=0;
      using(var output=new FileStream(path,FileMode.CreateNew,FileAccess.Write,FileShare.Read,65536,FileOptions.Asynchronous)) {
        while(true) {
          int count=await source.ReadAsync(buffer,0,buffer.Length,token).ConfigureAwait(false);
          if(count==0) break;
          if(total+count>limit) {
            int allowed=(int)Math.Max(0,limit-total);
            if(allowed>0) await output.WriteAsync(buffer,0,allowed,token).ConfigureAwait(false);
            throw new InvalidDataException("bounded output exceeded");
          }
          await output.WriteAsync(buffer,0,count,token).ConfigureAwait(false);total+=count;
        }
      }
    }
  }
}
'@
}
Initialize-Order444ToolPump

function Get-Order444CandidatePaths([string]$Base,[string]$Revision) {
    if ($Revision -cnotmatch '^[0-9a-f]{40}$') { throw 'Candidate revision must be exact lowercase40 hex' }
    $baseFull = [IO.Path]::GetFullPath($Base).TrimEnd('\','/')
    $sourceRoot = Join-Path $baseFull "order444-$Revision-source"
    $controlRoot = Join-Path $baseFull "order444-$Revision-control"
    if ([IO.Path]::GetDirectoryName($sourceRoot) -cne $baseFull -or [IO.Path]::GetDirectoryName($controlRoot) -cne $baseFull -or $sourceRoot -ceq $controlRoot) {
        throw 'Candidate paths are not distinct direct children of the admitted runtime root'
    }
    $short = $Revision.Substring(0,12)
    return [pscustomobject]@{
        SourceRoot=$sourceRoot;ControlRoot=$controlRoot
        ReviewDatabase="yellow_order444_review_$short";InvariantDatabase="yellow_order444_invariants_$short"
        ArchivePath=Join-Path $controlRoot 'candidate-source.zip'
        ReceiptPath=Join-Path $controlRoot 'candidate.receipt.json'
        EnvironmentPath=Join-Path $controlRoot 'app.env'
        SeedEnvironmentPath=Join-Path $controlRoot 'seed.env'
        FixtureManifestPath=Join-Path $controlRoot 'fiscal-review-manifest.json'
    }
}

function Assert-CandidateReceiptShape([object]$Receipt,[object]$Paths,[string]$Revision) {
    if ($null -eq $Receipt -or $Receipt.schema -cne 'yellow-order444-native-candidate/v1' -or
        $Receipt.source -cne $Revision -or $Receipt.sourceArchiveSha256 -cnotmatch '^[0-9a-f]{64}$' -or
        $Receipt.sourceRoot -cne $Paths.SourceRoot -or $Receipt.controlRoot -cne $Paths.ControlRoot -or
        $Receipt.reviewDatabase -cne $Paths.ReviewDatabase -or $Receipt.invariantDatabase -cne $Paths.InvariantDatabase -or
        [int]$Receipt.migrationFrontier -ne 85 -or $Receipt.migrationLedgerSha256 -cnotmatch '^[0-9a-f]{64}$' -or
        $Receipt.bunVersion -cne '1.3.14' -or $Receipt.packageJsonSha256 -cnotmatch '^[0-9a-f]{64}$' -or
        $Receipt.bunLockSha256 -cnotmatch '^[0-9a-f]{64}$' -or $Receipt.bunfigSha256 -cnotmatch '^[0-9a-f]{64}$' -or
        $Receipt.appEnvironmentSha256 -cnotmatch '^[0-9a-f]{64}$' -or $Receipt.seedEnvironmentSha256 -cnotmatch '^[0-9a-f]{64}$' -or
        [string]::IsNullOrWhiteSpace([string]$Receipt.dependencyJunction) -or
        $Receipt.postgresVersionNum -cne '160015' -or [int]$Receipt.postgresPort -ne 55503 -or
        $Receipt.fixtureManifestSha256 -cnotmatch '^[0-9a-f]{64}$' -or -not [bool]$Receipt.prepared) {
        throw 'Candidate receipt identity changed'
    }
}

function Assert-ExactLoopbackListener([object[]]$Listeners,[int]$ExpectedPid,[int]$Port) {
    $owners=@($Listeners|ForEach-Object{[int]$_.OwningProcess}|Sort-Object -Unique)
    if ($Listeners.Count -lt 1 -or $owners.Count -ne 1 -or $owners[0] -ne $ExpectedPid -or
        @($Listeners|Where-Object{[string]$_.LocalAddress -notin @('127.0.0.1','::1')}).Count -ne 0) {
        throw "Port$Port listener is absent, public, ambiguous, or foreign"
    }
}

function Get-Sha256Hex([string]$Path) { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Get-TextSha256Hex([string]$Value) {
    $sha=[Security.Cryptography.SHA256]::Create()
    try{return [Convert]::ToHexString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value))).ToLowerInvariant()}finally{$sha.Dispose()}
}
function Get-StreamSha256Hex([IO.Stream]$Stream) {
    $sha=[Security.Cryptography.SHA256]::Create();try{return [Convert]::ToHexString($sha.ComputeHash($Stream)).ToLowerInvariant()}finally{$sha.Dispose()}
}

function Assert-PrivateDirectory([string]$Path) {
    $item=Get-Item -LiteralPath $Path -Force
    if(-not$item.PSIsContainer -or ($item.Attributes-band[IO.FileAttributes]::ReparsePoint)){throw 'Protected control root is not a regular directory'}
    $identity=[Security.Principal.WindowsIdentity]::GetCurrent().Name;$acl=Get-Acl -LiteralPath $Path;$rules=@($acl.Access)
    if(-not$acl.AreAccessRulesProtected -or $acl.Owner-cne$identity -or $rules.Count-ne1){throw 'Protected control root ACL is not current-user-only'}
    $rule=$rules[0]
    if($rule.IdentityReference.Translate([Security.Principal.NTAccount]).Value-cne$identity -or $rule.AccessControlType-ne[Security.AccessControl.AccessControlType]::Allow -or $rule.IsInherited -or
       (($rule.FileSystemRights-band[Security.AccessControl.FileSystemRights]::FullControl)-ne[Security.AccessControl.FileSystemRights]::FullControl) -or
       (($rule.InheritanceFlags-band[Security.AccessControl.InheritanceFlags]::ContainerInherit)-eq0) -or
       (($rule.InheritanceFlags-band[Security.AccessControl.InheritanceFlags]::ObjectInherit)-eq0)){throw 'Protected control root ACL rule changed'}
}

function Set-PrivateAcl([string]$Path) {
    $identity=[Security.Principal.WindowsIdentity]::GetCurrent().Name;$acl=Get-Acl -LiteralPath $Path
    $acl.SetAccessRuleProtection($true,$false);foreach($rule in @($acl.Access)){[void]$acl.RemoveAccessRuleAll($rule)}
    $acl.SetOwner([Security.Principal.NTAccount]::new($identity))
    $item=Get-Item -LiteralPath $Path -Force
    if($item.PSIsContainer){
        $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity,'FullControl',
          [Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit',[Security.AccessControl.PropagationFlags]::None,
          [Security.AccessControl.AccessControlType]::Allow))
    }else{$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity,'FullControl','Allow'))}
    Set-Acl -LiteralPath $Path -AclObject $acl
}

function New-PrivateDirectory([string]$Path) {
    if(Test-Path -LiteralPath $Path){throw 'Protected control root already exists'}
    [IO.Directory]::CreateDirectory($Path)|Out-Null;Set-PrivateAcl $Path;Assert-PrivateDirectory $Path
}

function Assert-PrivateFileAcl([string]$Path) {
    $item=Get-Item -LiteralPath $Path -Force
    if($item.PSIsContainer -or ($item.Attributes-band[IO.FileAttributes]::ReparsePoint)){throw 'Protected path is not a regular file'}
    $identity=[Security.Principal.WindowsIdentity]::GetCurrent().Name;$acl=Get-Acl -LiteralPath $Path;$rules=@($acl.Access)
    if(-not$acl.AreAccessRulesProtected -or $acl.Owner-cne$identity -or $rules.Count-ne1){throw 'Protected file ACL is not current-user-only'}
    $rule=$rules[0]
    if($rule.IdentityReference.Translate([Security.Principal.NTAccount]).Value-cne$identity -or $rule.AccessControlType-ne[Security.AccessControl.AccessControlType]::Allow -or $rule.IsInherited -or
       (($rule.FileSystemRights-band[Security.AccessControl.FileSystemRights]::FullControl)-ne[Security.AccessControl.FileSystemRights]::FullControl)){throw 'Protected file ACL rule changed'}
}

function Write-PrivateFile([string]$Path,[string]$Value) {
    if(Test-Path -LiteralPath $Path){throw 'Protected file already exists'}
    [IO.File]::WriteAllText($Path,$Value,[Text.UTF8Encoding]::new($false));Set-PrivateAcl $Path;Assert-PrivateFileAcl $Path
}

function Read-BoundedPrivateJson([string]$Path,[int]$MaximumBytes) {
    Assert-PrivateFileAcl $Path;$item=Get-Item -LiteralPath $Path -Force
    if($item.Length-lt2 -or $item.Length-gt$MaximumBytes){throw 'Protected JSON size is outside its admitted bound'}
    try{return Get-Content -LiteralPath $Path -Raw|ConvertFrom-Json}catch{throw 'Protected JSON is malformed'}
}

function Assert-FiscalFixtureManifest([object]$Manifest) {
    $uuid='^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    if($null-eq$Manifest -or $Manifest.schema-cne'yellow-order444-fiscal-review/v1' -or
       $Manifest.tenantSlug-cnotmatch'^[a-z0-9][a-z0-9-]{0,62}$' -or $Manifest.propertyNode-cnotmatch$uuid -or
       $Manifest.operatorEmail-cnotmatch'^[^\s@]+@[^\s@]+$' -or $Manifest.issuedDocumentId-cnotmatch$uuid -or
       $null-eq$Manifest.eligible -or $Manifest.eligible.reservationId-cnotmatch$uuid -or
       $Manifest.eligible.folioId-cnotmatch$uuid -or $Manifest.eligible.recipientRegistrationId-cnotmatch$uuid){throw 'Fiscal review manifest identity is invalid'}
    if((@($Manifest.PSObject.Properties.Name|Sort-Object)-join"`n")-cne((@('eligible','issuedDocumentId','operatorEmail','propertyNode','schema','tenantSlug')|Sort-Object)-join"`n") -or
       (@($Manifest.eligible.PSObject.Properties.Name|Sort-Object)-join"`n")-cne((@('folioId','recipientRegistrationId','reservationId')|Sort-Object)-join"`n")){throw 'Fiscal review manifest shape changed'}
}

function Get-AppTreeFileMap([string]$Root) {
    $rootItem=Get-Item -LiteralPath $Root -Force
    if(-not$rootItem.PSIsContainer -or ($rootItem.Attributes-band[IO.FileAttributes]::ReparsePoint)){throw 'Extracted source root is invalid'}
    $rootFull=[IO.Path]::GetFullPath($rootItem.FullName).TrimEnd('\','/');$files=[Collections.Generic.Dictionary[string,string]]::new([StringComparer]::Ordinal)
    $pending=[Collections.Generic.Stack[IO.DirectoryInfo]]::new();$pending.Push($rootItem)
    while($pending.Count-gt0){$directory=$pending.Pop();foreach($entry in @(Get-ChildItem -LiteralPath $directory.FullName -Force)){
        $relative=[IO.Path]::GetRelativePath($rootFull,$entry.FullName).Replace('\','/')
        if($entry.Attributes-band[IO.FileAttributes]::ReparsePoint){if($entry.PSIsContainer-and$relative-ceq'node_modules'){continue};throw 'Extracted source contains unexpected reparse point'}
        if($entry.PSIsContainer){$pending.Push([IO.DirectoryInfo]$entry);continue}
        if(-not$files.TryAdd($relative,(Get-Sha256Hex $entry.FullName))){throw 'Extracted source contains duplicate path'}
    }};return ,$files
}

function Assert-SourceArchiveIdentity([string]$Archive,[string]$ExtractedRoot,[string]$ExpectedHash) {
    if((Get-Sha256Hex $Archive)-cne$ExpectedHash){throw 'Candidate archive hash differs from receipt'}
    $actual=Get-AppTreeFileMap $ExtractedRoot;$archived=[Collections.Generic.Dictionary[string,string]]::new([StringComparer]::Ordinal)
    $zip=[IO.Compression.ZipFile]::OpenRead($Archive);try{foreach($entry in $zip.Entries){if([string]::IsNullOrEmpty($entry.Name)){continue};$relative=$entry.FullName.Replace('\','/')
        if($relative.StartsWith('/')-or$relative-match'(^|/)\.\.(/|$)'){throw 'Candidate archive contains unsafe path'}
        $stream=$entry.Open();try{$hash=Get-StreamSha256Hex $stream}finally{$stream.Dispose()};if(-not$archived.TryAdd($relative,$hash)){throw 'Candidate archive contains duplicate path'}
    }}finally{$zip.Dispose()}
    if($actual.Count-ne$archived.Count){throw 'Extracted candidate file count differs from archive'}
    foreach($relative in $archived.Keys){if(-not$actual.ContainsKey($relative)-or$actual[$relative]-cne$archived[$relative]){throw 'Extracted candidate bytes differ from archive'}}
}

function Normalize-CommandLine([string]$Value){return (($Value.Replace('\','/').Replace('"','')-replace'\s+',' ').Trim()).ToLowerInvariant()}
function ConvertTo-UtcDateTime([object]$Value){
    if($Value -is [DateTimeOffset]){return ([DateTimeOffset]$Value).UtcDateTime}
    if($Value -is [DateTime]){return ([DateTime]$Value).ToUniversalTime()}
    if($Value -isnot [string] -or [string]::IsNullOrWhiteSpace([string]$Value)){throw 'Process timestamp is invalid'}
    try{return [DateTimeOffset]::ParseExact([string]$Value,'o',[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::RoundtripKind).UtcDateTime}catch{throw 'Process timestamp is invalid'}
}

function Assert-ExactProcess([object]$Record,[int]$ExpectedProcessId,[object]$StartedUtc,[string]$Executable,[string]$Command,[object]$ExpectedParentProcessId,[object]$ActualStartedUtc=$null) {
    if($null -eq $Record){throw 'Process identity differs from its protected receipt'}
    $recordedStart = if($null-eq$ActualStartedUtc){ConvertTo-UtcDateTime $Record.CreationDate}else{ConvertTo-UtcDateTime $ActualStartedUtc}
    $expectedStart = ConvertTo-UtcDateTime $StartedUtc
    if([int]$Record.ProcessId -ne $ExpectedProcessId -or $null -eq $Record.ExecutablePath -or
       [IO.Path]::GetFullPath([string]$Record.ExecutablePath) -ine [IO.Path]::GetFullPath($Executable) -or
       (Normalize-CommandLine ([string]$Record.CommandLine)) -cne (Normalize-CommandLine $Command) -or
       $recordedStart.Ticks -ne $expectedStart.Ticks -or
       ($null -ne $ExpectedParentProcessId -and [int]$Record.ParentProcessId -ne [int]$ExpectedParentProcessId)){throw 'Process identity differs from its protected receipt'}
}

function Assert-PostmasterIdentity {
    if((Get-Content -LiteralPath (Join-Path $clusterRoot 'PG_VERSION') -Raw).Trim()-cne'16'){throw 'Retained PostgreSQL is not version16'}
    $listeners=@(Get-NetTCPConnection -LocalPort $postgresPort -State Listen -ErrorAction SilentlyContinue)
    if($listeners.Count-eq0){throw 'Retained PostgreSQL55503 is not running'}
    $pids=@($listeners|Select-Object -ExpandProperty OwningProcess -Unique);if($pids.Count-ne1-or@($listeners|Where-Object{$_.LocalAddress-notin@('127.0.0.1','::1')}).Count-ne0){throw 'PostgreSQL listener identity is ambiguous or public'}
    $record=Get-CimInstance Win32_Process -Filter "ProcessId = $($pids[0])"
    if($null-eq$record-or[IO.Path]::GetFullPath([string]$record.ExecutablePath)-ine[IO.Path]::GetFullPath($postgresPath)){throw 'PostgreSQL listener executable changed'}
    $pidLines=@(Get-Content -LiteralPath (Join-Path $clusterRoot 'postmaster.pid'));if($pidLines.Count-lt8-or[int]$pidLines[0]-ne[int]$pids[0]-or
       [IO.Path]::GetFullPath($pidLines[1])-ine[IO.Path]::GetFullPath($clusterRoot)-or$pidLines[3]-cne'55503'-or$pidLines[5]-cne'127.0.0.1'-or$pidLines[7].Trim()-cne'ready'){throw 'PostgreSQL postmaster identity changed'}
    return [int]$pids[0]
}

function Invoke-Psql([string]$Database,[string]$Statement,[string]$Password) {
    $oldPassword=$env:PGPASSWORD;$oldTimeout=$env:PGCONNECT_TIMEOUT
    try{$env:PGPASSWORD=$Password;$env:PGCONNECT_TIMEOUT='5';$values=@(& $psqlPath -h 127.0.0.1 -p $postgresPort -U yellow_deploy -d $Database -X -A -t -q -v ON_ERROR_STOP=1 -c $Statement 2>$null);if($LASTEXITCODE-ne0){throw 'PostgreSQL operation failed'};return @($values|Where-Object{-not[string]::IsNullOrWhiteSpace($_)})}
    finally{$env:PGPASSWORD=$oldPassword;$env:PGCONNECT_TIMEOUT=$oldTimeout}
}

function Invoke-ReadOnlyPsql([string]$Database,[string]$Statement,[string]$Password) {
    $oldOptions=$env:PGOPTIONS
    try{$env:PGOPTIONS='-c default_transaction_read_only=on';return @(Invoke-Psql $Database $Statement $Password)}finally{$env:PGOPTIONS=$oldOptions}
}

function Invoke-PrivateTool([string]$Executable,[string[]]$Arguments,[string]$WorkingDirectory,[string]$LogPath,[hashtable]$Environment) {
    if(Test-Path -LiteralPath $LogPath){throw 'Private command log already exists'}
    $stdoutPath="$LogPath.stdout.tmp";$stderrPath="$LogPath.stderr.tmp"
    foreach($path in @($stdoutPath,$stderrPath)){if(Test-Path -LiteralPath $path){throw 'Private command temporary log already exists'}}
    $info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=$Executable;$info.WorkingDirectory=$WorkingDirectory;$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden
    $info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true;foreach($argument in $Arguments){[void]$info.ArgumentList.Add($argument)}
    foreach($name in @($info.Environment.Keys)){if($name-match'^(?i:YELLOW_|PG[A-Z0-9_]*$|HOST$|PORT$|NODE_ENV$|TEMP$|TMP$)'){[void]$info.Environment.Remove($name)}}
    $info.Environment['TEMP']=$temporaryBase;$info.Environment['TMP']=$temporaryBase;foreach($entry in $Environment.GetEnumerator()){$info.Environment[$entry.Key]=[string]$entry.Value}
    $process=[Diagnostics.Process]::new();$process.StartInfo=$info;if(-not$process.Start()){throw 'Private command did not start'}
    $cancellation=[Threading.CancellationTokenSource]::new();$perStream=[long]($privateLogByteLimit/2)
    $stdout=[Yellow.Order444.BoundedToolPump]::CopyAsync($process.StandardOutput.BaseStream,$stdoutPath,$perStream,$cancellation.Token)
    $stderr=[Yellow.Order444.BoundedToolPump]::CopyAsync($process.StandardError.BaseStream,$stderrPath,$perStream,$cancellation.Token)
    $watch=[Diagnostics.Stopwatch]::StartNew();$failure=$null
    while(-not$process.WaitForExit(100)){
        if($stdout.IsFaulted-or$stderr.IsFaulted){$failure='Private command output exceeded its fixed byte bound';break}
        if($watch.ElapsedMilliseconds-ge120000){$failure='Private command exceeded its bounded runtime';break}
    }
    $settled=$false
    if($null-eq$failure){
        try{$settled=[Threading.Tasks.Task]::WaitAll(@($stdout,$stderr),3000)}catch{$settled=($stdout.IsCompleted -and $stderr.IsCompleted);$failure='Private command output or stream cleanup failed'}
        if(-not$settled){$failure='Private command output did not reach EOF inside its bounded drain'}
    }
    if($null-ne$failure){try{if(-not$process.HasExited){$process.Kill($false)};[void]$process.WaitForExit(3000)}catch{};$cancellation.Cancel()}
    if(-not$settled){
        try{$process.StandardOutput.Close()}catch{};try{$process.StandardError.Close()}catch{}
        try{$settled=[Threading.Tasks.Task]::WaitAll(@($stdout,$stderr),1000)}catch{$settled=($stdout.IsCompleted -and $stderr.IsCompleted)}
    }
    if(-not$settled){$failure='Private command stream cleanup was not proven'}
    if($settled){
        $combined=[IO.File]::ReadAllText($stdoutPath)+[IO.File]::ReadAllText($stderrPath)
        [IO.File]::WriteAllText($LogPath,$combined,[Text.UTF8Encoding]::new($false));Set-PrivateAcl $LogPath;Assert-PrivateFileAcl $LogPath
        Remove-Item -LiteralPath $stdoutPath -Force;Remove-Item -LiteralPath $stderrPath -Force
    }
    $code=if($process.HasExited){$process.ExitCode}else{22};$cancellation.Dispose();$process.Dispose()
    if($null-ne$failure){throw $failure};if($code-ne0){throw 'Private command failed; inspect its protected bounded log'}
}

function New-RandomSecret{return [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()}

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

function Read-CandidateIdentity([object]$Paths) {
    Assert-PrivateDirectory $Paths.ControlRoot
    $receipt=Read-BoundedPrivateJson $Paths.ReceiptPath 32768;Assert-CandidateReceiptShape $receipt $Paths $CandidateRevision
    Assert-SourceArchiveIdentity $Paths.ArchivePath $Paths.SourceRoot $receipt.sourceArchiveSha256
    $manifest=Read-BoundedPrivateJson $Paths.FixtureManifestPath 32768;Assert-FiscalFixtureManifest $manifest
    if((Get-Sha256Hex $Paths.FixtureManifestPath)-cne$receipt.fixtureManifestSha256){throw 'Fiscal fixture manifest differs from candidate receipt'}
    if((Get-Sha256Hex $Paths.EnvironmentPath)-cne$receipt.appEnvironmentSha256-or
       (Get-Sha256Hex $Paths.SeedEnvironmentPath)-cne$receipt.seedEnvironmentSha256){throw 'Protected candidate environment differs from receipt'}
    foreach($identity in @(@('package.json','packageJsonSha256'),@('bun.lock','bunLockSha256'),@('bunfig.toml','bunfigSha256'))){
        if((Get-Sha256Hex(Join-Path $Paths.SourceRoot $identity[0]))-cne[string]$receipt.($identity[1])){throw 'Candidate dependency manifest differs from receipt'}
    }
    $junction=Get-Item -LiteralPath (Join-Path $Paths.SourceRoot 'node_modules') -Force
    Assert-DependencyJunctionIdentity $junction ([string]$receipt.dependencyJunction)
    return [pscustomobject]@{Receipt=$receipt;Manifest=$manifest}
}

function Get-DatabaseUrlPassword([string]$Value,[string]$Role,[string]$Database) {
    $rolePattern=[Regex]::Escape($Role);$databasePattern=[Regex]::Escape($Database)
    if($Value-notmatch"^postgres://$rolePattern`:(?<password>[^@\r\n]+)@127\.0\.0\.1:55503/$databasePattern$"){throw 'Protected database URL identity changed'}
    return [Uri]::UnescapeDataString($Matches['password'])
}

function Read-ProtectedEnvironmentMap([string]$Path) {
    Assert-PrivateFileAcl $Path
    $values=[Collections.Generic.Dictionary[string,string]]::new([StringComparer]::Ordinal)
    foreach($line in @(Get-Content -LiteralPath $Path)){if($line-notmatch'^([A-Z][A-Z0-9_]*)=(.*)$'-or-not$values.TryAdd($Matches[1],$Matches[2])){throw 'Protected retained environment is malformed'}}
    return ,$values
}

function Read-RetainedDatabaseCredentials {
    $seed=Read-ProtectedEnvironmentMap(Join-Path $oldControlRoot 'seed.env')
    $app=Read-ProtectedEnvironmentMap(Join-Path $oldControlRoot 'app.env')
    return [pscustomobject]@{
        DeployPassword=Get-DatabaseUrlPassword $seed['YELLOW_DEPLOY_DATABASE_URL'] 'yellow_deploy' $oldReviewDatabase
        RuntimePassword=Get-DatabaseUrlPassword $app['YELLOW_RUNTIME_DATABASE_URL'] 'yellow_runtime' $oldReviewDatabase
        RegistrarPassword=Get-DatabaseUrlPassword $app['YELLOW_EXTENSION_REGISTRAR_DATABASE_URL'] 'yellow_extension_registrar' $oldReviewDatabase
    }
}

function Read-SeedEnvironment([object]$Paths) {
    Assert-PrivateFileAcl $Paths.SeedEnvironmentPath;$values=[Collections.Generic.Dictionary[string,string]]::new([StringComparer]::Ordinal)
    foreach($line in @(Get-Content -LiteralPath $Paths.SeedEnvironmentPath)){if($line-notmatch'^([A-Z][A-Z0-9_]*)=(.*)$'-or-not$values.TryAdd($Matches[1],$Matches[2])){throw 'Candidate seed environment is malformed'}}
    $expected=@('YELLOW_DEPLOY_DATABASE_URL','YELLOW_FISCAL_REVIEW_MANIFEST_PATH','YELLOW_REVIEW_APPROVER_PASSWORD','YELLOW_REVIEW_PASSWORD','YELLOW_RUNTIME_DATABASE_URL')|Sort-Object
    if((@($values.Keys|Sort-Object)-join"`n")-cne($expected-join"`n")-or$values['YELLOW_FISCAL_REVIEW_MANIFEST_PATH']-cne$Paths.FixtureManifestPath){throw 'Candidate seed environment identity changed'}
    $deployPassword=Get-DatabaseUrlPassword $values['YELLOW_DEPLOY_DATABASE_URL'] 'yellow_deploy' $Paths.ReviewDatabase
    $runtimePassword=Get-DatabaseUrlPassword $values['YELLOW_RUNTIME_DATABASE_URL'] 'yellow_runtime' $Paths.ReviewDatabase
    return [pscustomobject]@{Values=$values;DeployPassword=$deployPassword;RuntimePassword=$runtimePassword}
}

function Assert-CandidateDatabaseIdentity([object]$Paths,[object]$Receipt,[string]$Password) {
    foreach($database in @($Paths.ReviewDatabase,$Paths.InvariantDatabase)){
        $frontier=@(Invoke-ReadOnlyPsql $database "BEGIN TRANSACTION READ ONLY; SELECT count(*)||'|'||max(version) FROM schema_migration; COMMIT;" $Password)
        if($frontier.Count-ne1-or$frontier[0]-cne'85|85'){throw 'Candidate database migration frontier changed'}
    }
    $ledger=@(Invoke-ReadOnlyPsql $Paths.ReviewDatabase "BEGIN TRANSACTION READ ONLY; SELECT version||':'||filename||':'||btrim(checksum_sha256) FROM schema_migration ORDER BY version; COMMIT;" $Password)
    if((Get-TextSha256Hex($ledger-join"`n"))-cne$Receipt.migrationLedgerSha256){throw 'Candidate database migration ledger differs from receipt'}
}

function Read-AppEnvironment([object]$Paths,[object]$Identity,[object]$SeedEnvironment) {
    Assert-PrivateFileAcl $Paths.EnvironmentPath;$values=[Collections.Generic.Dictionary[string,string]]::new([StringComparer]::Ordinal)
    foreach($line in @(Get-Content -LiteralPath $Paths.EnvironmentPath)){if($line-notmatch'^([A-Z][A-Z0-9_]*)=(.*)$'-or-not$values.TryAdd($Matches[1],$Matches[2])){throw 'Candidate app environment is malformed'}}
    $expected=@('HOST','NODE_ENV','PORT','YELLOW_AVAILABILITY_PROJECTION_WORKER','YELLOW_BUILD_SHA','YELLOW_BUSINESS_DAY_ROLL_WORKER','YELLOW_EXTENSION_REGISTRAR_DATABASE_URL','YELLOW_HOLD_EXPIRY_WORKER','YELLOW_LOCAL_REVIEW_EMAIL','YELLOW_LOCAL_REVIEW_PASSWORD','YELLOW_LOCAL_REVIEW_PREFILL','YELLOW_LOCAL_REVIEW_TENANT','YELLOW_OPERATOR_WORKBENCH','YELLOW_PICKUP_TASK_WORKER','YELLOW_RESERVATION_ARRIVAL_ROLL_WORKER','YELLOW_RESERVATION_DEPARTURE_ROLL_WORKER','YELLOW_RUNTIME_DATABASE_URL','YELLOW_TOKEN_SECRET')|Sort-Object
    if((@($values.Keys|Sort-Object)-join"`n")-cne($expected-join"`n")-or$values['YELLOW_BUILD_SHA']-cne$CandidateRevision-or
       $values['HOST']-cne'127.0.0.1'-or$values['PORT']-cne'3000'-or$values['NODE_ENV']-cne'production'-or
       $values['YELLOW_OPERATOR_WORKBENCH']-cne'1'-or$values['YELLOW_LOCAL_REVIEW_PREFILL']-cne'1'-or
       $values['YELLOW_LOCAL_REVIEW_TENANT']-cne$Identity.Manifest.tenantSlug-or
       $values['YELLOW_LOCAL_REVIEW_EMAIL']-cne$Identity.Manifest.operatorEmail-or
       $values['YELLOW_RUNTIME_DATABASE_URL']-cne$SeedEnvironment.Values['YELLOW_RUNTIME_DATABASE_URL']){throw 'Candidate app environment identity changed'}
    foreach($worker in @('YELLOW_AVAILABILITY_PROJECTION_WORKER','YELLOW_BUSINESS_DAY_ROLL_WORKER','YELLOW_HOLD_EXPIRY_WORKER','YELLOW_PICKUP_TASK_WORKER','YELLOW_RESERVATION_ARRIVAL_ROLL_WORKER','YELLOW_RESERVATION_DEPARTURE_ROLL_WORKER')){
        if($values[$worker]-cne'1'){throw 'Candidate app worker configuration changed'}
    }
    [void](Get-DatabaseUrlPassword $values['YELLOW_EXTENSION_REGISTRAR_DATABASE_URL'] 'yellow_extension_registrar' $Paths.ReviewDatabase)
    return ,$values
}

function Invoke-HttpProof([int]$Port,[object]$Identity,[Collections.Generic.Dictionary[string,string]]$Environment) {
    $origin="http://127.0.0.1:$Port";$ready=$null
    foreach($attempt in 1..40){try{$ready=Invoke-RestMethod "$origin/ready" -TimeoutSec 2;if($ready.status-ceq'ready'){break}}catch{$ready=$null};Start-Sleep -Milliseconds 250}
    if($null-eq$ready-or$ready.status-cne'ready'-or$ready.target-cne'yellow_runtime_database'-or$ready.build.revision-cne$CandidateRevision-or[int]$ready.build.expectedMigrationFrontier-ne85){throw 'Candidate exact-source readiness failed'}
    $homeResponse=Invoke-WebRequest "$origin/" -TimeoutSec 5
    if($homeResponse.StatusCode-ne200-or$homeResponse.Headers['Cache-Control']-notcontains'no-store'-or$homeResponse.Content-notlike"*data-local-default=`"$($Identity.Manifest.tenantSlug)`"*"-or
       $homeResponse.Content-notlike"*data-local-default=`"$($Identity.Manifest.operatorEmail)`"*"-or$homeResponse.Content-notlike"*data-local-default=`"$($Environment['YELLOW_LOCAL_REVIEW_PASSWORD'])`"*"){throw 'Candidate prefilled sign-in identity failed'}
    $login=Invoke-RestMethod "$origin/api/v1/auth/local:login" -Method Post -ContentType 'application/json' -Body (@{tenant=$Identity.Manifest.tenantSlug;email=$Identity.Manifest.operatorEmail;password=$Environment['YELLOW_LOCAL_REVIEW_PASSWORD']}|ConvertTo-Json -Compress) -TimeoutSec 10
    if($login.tokenType-cne'Bearer'-or$login.accessToken-isnot[string]-or$login.accessToken.Length-lt32){throw 'Candidate login failed'}
    $headers=@{Authorization="Bearer $($login.accessToken)"};$property=$Identity.Manifest.propertyNode;$document=$Identity.Manifest.issuedDocumentId
    $detail=Invoke-RestMethod "$origin/api/v1/properties/$property/invoices/$document" -Headers $headers -TimeoutSec 10
    if($detail.invoice.documentId-cne$document-or$detail.invoice.propertyNode-cne$property){throw 'Candidate issued invoice detail identity failed'}
    $date=[DateTime]::ParseExact([string]$detail.invoice.businessDate,'yyyy-MM-dd',[Globalization.CultureInfo]::InvariantCulture)
    $searchBody=@{issuedFrom=$date.ToString('yyyy-MM-dd');issuedBefore=$date.AddDays(1).ToString('yyyy-MM-dd');limit=100}|ConvertTo-Json -Compress
    $list=Invoke-RestMethod "$origin/api/v1/properties/$property/invoices/search" -Method Post -Headers $headers -ContentType 'application/json' -Body $searchBody -TimeoutSec 10
    if(@($list.invoices.items|Where-Object{$_.documentId-ceq$document}).Count-ne1){throw 'Candidate authorized invoice list proof failed'}
    $readyBody=@{recipientRegistrationId=$Identity.Manifest.eligible.recipientRegistrationId;calendarEvidence=$null}|ConvertTo-Json -Compress
    $issueReady=Invoke-RestMethod "$origin/api/v1/properties/$property/reservations/$($Identity.Manifest.eligible.reservationId)/folios/$($Identity.Manifest.eligible.folioId)/invoice-readiness" -Method Post -Headers $headers -ContentType 'application/json' -Body $readyBody -TimeoutSec 10
    if($issueReady.readiness.kind-cne'ready'){throw 'Candidate authorized fiscal readiness proof failed'}
    $providers=Invoke-RestMethod "$origin/api/v1/properties/$property/fiscal-provider-options" -Headers $headers -TimeoutSec 10
    if(@($providers.providers).Count-ne0){throw 'Candidate hosted fiscal provider directory must remain empty'}
    return [pscustomobject]@{Ready=$ready;LoginVerified=$true;ListVerified=$true;DetailVerified=$true;ReadinessVerified=$true;ProviderDirectoryEmpty=$true}
}

function Stop-FailedCandidateStartup([Diagnostics.Process]$Supervisor,[int]$Port,[object]$ObservedChildProcessId=$null) {
    if($null-eq$Supervisor){return}
    $supervisorStarted=$Supervisor.StartTime.ToUniversalTime()
    $Supervisor.Refresh()
    $childrenBeforeStop=@()
    if(-not$Supervisor.HasExited){
        $childrenBeforeStop=@(Get-CimInstance Win32_Process -Filter "ParentProcessId = $($Supervisor.Id)")
        $Supervisor.Kill($false)
        if(-not$Supervisor.WaitForExit(3000)){throw 'Failed candidate supervisor did not exit inside cleanup bound'}
    }
    $childrenAfterStop=@(Get-CimInstance Win32_Process -Filter "ParentProcessId = $($Supervisor.Id)")
    $observedChild=@()
    if($null-ne$ObservedChildProcessId-and[int]$ObservedChildProcessId-gt0){
        $observedRecord=$null
        foreach($attempt in 1..20){$observedRecord=Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$ObservedChildProcessId)";if($null-ne$observedRecord){break};Start-Sleep -Milliseconds 25}
        if($null-ne$observedRecord){$observedChild=@($observedRecord)}
    }
    $children=@(($childrenBeforeStop + $childrenAfterStop + $observedChild)|Sort-Object ProcessId -Unique)
    $ownedChildren=@();$observedWasOwned=$false
    foreach($record in $children){
        $started=ConvertTo-UtcDateTime $record.CreationDate
        if([int]$record.ParentProcessId-ne$Supervisor.Id-or$null-eq$record.ExecutablePath-or
           [IO.Path]::GetFullPath([string]$record.ExecutablePath)-ine[IO.Path]::GetFullPath($candidateChildExecutable)-or
           (Normalize-CommandLine([string]$record.CommandLine))-cne(Normalize-CommandLine $candidateChildCommand)-or$started.Ticks-lt$supervisorStarted.Ticks){continue}
        $ownedChildren+=,$record
        if($null-ne$ObservedChildProcessId-and[int]$record.ProcessId-eq[int]$ObservedChildProcessId){$observedWasOwned=$true}
    }
    foreach($record in $ownedChildren){
        $child=Get-Process -Id ([int]$record.ProcessId) -ErrorAction SilentlyContinue
        if($null-ne$child){$child.Kill($false);if(-not$child.WaitForExit(3000)){throw 'Failed candidate child did not exit inside cleanup bound'}}
    }
    if($null-ne$ObservedChildProcessId-and-not$observedWasOwned-and$null-ne(Get-Process -Id ([int]$ObservedChildProcessId) -ErrorAction SilentlyContinue)){throw 'Observed candidate child identity changed; cleanup refused'}
    if(@(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue).Count-ne0){throw "Port$Port remained occupied after failed candidate startup cleanup"}
}

function Start-CandidateSupervisor([int]$Port,[object]$Paths,[int]$StartupAttempts=40,[int]$StartupPollMilliseconds=250) {
    if($StartupAttempts-lt1-or$StartupAttempts-gt40-or$StartupPollMilliseconds-lt10-or$StartupPollMilliseconds-gt250){throw 'Candidate startup bounds are invalid'}
    if(@(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue).Count-ne0){throw "Port$Port already has a listener; refusing replacement"}
    if(Test-Path -LiteralPath (Join-Path $Paths.ControlRoot "supervisor.$Port.status.json")){throw 'Candidate supervisor status already exists; bounded launch is not reusable'}
    $process=$null;$candidate=$null;$status=$null
    try{
        $process=Start-Process -FilePath $powerShellPath -ArgumentList @('-NoLogo','-NoProfile','-NonInteractive','-File',$candidateSupervisor,'-CandidateRevision',$CandidateRevision,'-Port',[string]$Port) -WorkingDirectory $repositoryRoot -WindowStyle Hidden -PassThru
        foreach($attempt in 1..$StartupAttempts){if(Test-Path -LiteralPath (Join-Path $Paths.ControlRoot "supervisor.$Port.status.json")){try{$candidate=Get-Content -LiteralPath (Join-Path $Paths.ControlRoot "supervisor.$Port.status.json") -Raw|ConvertFrom-Json}catch{$candidate=$null};if($null-ne$candidate){if($candidate.reason-ceq'running'-and[int]$candidate.launchCount-eq1){$status=$candidate;break};if($candidate.reason-cne'preflight'){throw 'Candidate supervisor reported startup failure'}}}
            $process.Refresh();if($process.HasExited){throw 'Candidate supervisor exited before launch'};Start-Sleep -Milliseconds $StartupPollMilliseconds}
        if($null-eq$status){throw 'Candidate supervisor did not record one launch'}
        $record=Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$status.childPid)";$child=Get-Process -Id ([int]$status.childPid) -ErrorAction Stop
        Assert-ExactProcess $record $child.Id $status.childStartedUtc $candidateChildExecutable $candidateChildCommand ([Nullable[int]]$process.Id)
        $listenerReady=$false
        foreach($attempt in 1..$StartupAttempts){
            $listeners=@(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
            if($listeners.Count-gt0){Assert-ExactLoopbackListener $listeners $child.Id $Port;$listenerReady=$true;break}
            $child.Refresh();if($child.HasExited){throw 'Candidate child exited before binding its listener'};Start-Sleep -Milliseconds $StartupPollMilliseconds
        }
        if(-not$listenerReady){throw 'Candidate child did not bind its loopback listener inside startup bound'}
        return [pscustomobject]@{Supervisor=$process;Child=$child;Status=$status}
    }catch{
        $startupFailure=$_
        $observedChildProcessId=if($null-ne$candidate-and$null-ne$candidate.childPid){[int]$candidate.childPid}else{$null}
        try{Stop-FailedCandidateStartup $process $Port $observedChildProcessId}catch{throw 'Candidate startup failed and exact owned cleanup was not proven'}
        throw $startupFailure
    }
}

function Stop-VerifiedLaunch([object]$Launch,[int]$Port) {
    $record=Get-CimInstance Win32_Process -Filter "ProcessId = $($Launch.Child.Id)"
    Assert-ExactProcess $record $Launch.Child.Id $Launch.Status.childStartedUtc $candidateChildExecutable $candidateChildCommand ([Nullable[int]]$Launch.Supervisor.Id)
    $supervisorRecord=Get-CimInstance Win32_Process -Filter "ProcessId = $($Launch.Supervisor.Id)"
    $expectedSupervisor="$powerShellPath -NoLogo -NoProfile -NonInteractive -File $candidateSupervisor -CandidateRevision $CandidateRevision -Port $Port"
    Assert-ExactProcess $supervisorRecord $Launch.Supervisor.Id $Launch.Status.supervisorStartedUtc $powerShellPath $expectedSupervisor $null
    Assert-ExactLoopbackListener @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop) $Launch.Child.Id $Port
    $Launch.Child.Kill($false);if(-not$Launch.Child.WaitForExit(3000)){throw 'Exact candidate child did not exit inside cleanup bound'}
    $Launch.Supervisor.Refresh();if(-not$Launch.Supervisor.HasExited){$Launch.Supervisor.Kill($false);if(-not$Launch.Supervisor.WaitForExit(3000)){throw 'Exact candidate supervisor did not exit inside cleanup bound'}}
    if(@(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue).Count-ne0){throw "Port$Port did not become free after exact owned stop"}
}

function Assert-RetainedOrder442LaunchIdentity([object]$Receipt,[object]$Status,[object]$ChildRecord,[object]$SupervisorRecord,[object]$ChildProcessStartedUtc) {
    if($Receipt.receiptType-cne'order442-native-resume-v1'-or$Receipt.source-cne$oldRevision-or[int]$Receipt.port-ne3000-or-not[bool]$Receipt.loginVerified){throw 'Retained Order442 receipt identity changed'}
    if($Status.schema-cne'yellow-native-review-bounded/v1'-or$Status.mode-cne'order442-preview'-or[int]$Status.childPid-ne[int]$Receipt.pid-or$Status.reason-cne'running'){throw 'Retained Order442 supervisor status changed'}
    $receiptStarted=ConvertTo-UtcDateTime $Receipt.startedUtc;$statusChildStarted=ConvertTo-UtcDateTime $Status.childStartedUtc
    $actualChildStarted=ConvertTo-UtcDateTime $ChildProcessStartedUtc;$supervisorBirth=ConvertTo-UtcDateTime $SupervisorRecord.CreationDate
    $supervisorObservation=ConvertTo-UtcDateTime $Status.supervisorStartedUtc
    if($receiptStarted.Ticks-ne$statusChildStarted.Ticks-or$receiptStarted.Ticks-ne$actualChildStarted.Ticks-or
       $supervisorObservation.Ticks-lt$supervisorBirth.Ticks-or$supervisorObservation.Ticks-gt$actualChildStarted.Ticks){throw 'Retained Order442 timestamp provenance changed'}
    Assert-ExactProcess $ChildRecord ([int]$Receipt.pid) $Receipt.startedUtc $bunPath "$bunPath --env-file=$oldControlRoot\app.env src/server.ts" ([Nullable[int]]([int]$Receipt.supervisorPid)) $ChildProcessStartedUtc
    $expectedSupervisor="$powerShellPath -NoLogo -NoProfile -NonInteractive -File $oldSupervisorHelper"
    Assert-ExactProcess $SupervisorRecord ([int]$Receipt.supervisorPid) $SupervisorRecord.CreationDate $powerShellPath $expectedSupervisor $null
}

function Get-LatestOrder442ResumeReceipt([string]$ControlRoot) {
    $receipts=@(Get-ChildItem -LiteralPath $ControlRoot -File -Filter 'resume-receipt-*.json'|Sort-Object Name)
    if($receipts.Count-eq0){throw 'No retained Order442 resume receipt identifies the old supervised app'}
    $path=$receipts[-1].FullName;Assert-PrivateFileAcl $path;return $path
}

function Get-VerifiedOldLaunch {
    $path=Get-LatestOrder442ResumeReceipt $oldControlRoot;$receipt=Get-Content -LiteralPath $path -Raw|ConvertFrom-Json
    $statusPath=Join-Path $oldControlRoot 'supervisor.status.json';$status=Get-Content -LiteralPath $statusPath -Raw|ConvertFrom-Json
    $child=Get-Process -Id ([int]$receipt.pid) -ErrorAction Stop;$supervisor=Get-Process -Id ([int]$receipt.supervisorPid) -ErrorAction Stop
    $childRecord=Get-CimInstance Win32_Process -Filter "ProcessId = $($child.Id)";$supervisorRecord=Get-CimInstance Win32_Process -Filter "ProcessId = $($supervisor.Id)"
    Assert-RetainedOrder442LaunchIdentity $receipt $status $childRecord $supervisorRecord $child.StartTime
    Assert-ExactLoopbackListener @(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction Stop) $child.Id 3000
    return [pscustomobject]@{ReceiptPath=$path;Receipt=$receipt;Child=$child;Supervisor=$supervisor;Status=$status}
}

function Stop-VerifiedOldLaunch([object]$Launch) {
    $fresh=Get-VerifiedOldLaunch
    if($fresh.Child.Id-ne$Launch.Child.Id-or$fresh.Supervisor.Id-ne$Launch.Supervisor.Id-or$fresh.ReceiptPath-cne$Launch.ReceiptPath){throw 'Retained Order442 identity changed immediately before stop'}
    $fresh.Child.Kill($false);if(-not$fresh.Child.WaitForExit(3000)){throw 'Retained Order442 child did not exit inside cleanup bound'}
    $fresh.Supervisor.Refresh();if(-not$fresh.Supervisor.HasExited){$fresh.Supervisor.Kill($false);if(-not$fresh.Supervisor.WaitForExit(3000)){throw 'Retained Order442 supervisor did not exit inside cleanup bound'}}
    if(@(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue).Count-ne0){throw 'Retained Order442 app did not release port3000'}
}

function Invoke-OldResume {
    if(@(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue).Count-ne0){throw 'Rollback refuses to resume while port3000 is occupied'}
    $log=Join-Path $oldControlRoot("order444-rollback-"+[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')+'.log')
    Invoke-PrivateTool $powerShellPath @('-NoLogo','-NoProfile','-NonInteractive','-File',$oldResumeHelper) $repositoryRoot $log @{}
}

function Invoke-Prepare([object]$Paths) {
    foreach($path in @($Paths.SourceRoot,$Paths.ControlRoot)){if(Test-Path -LiteralPath $path){throw 'Prepare never overwrites an existing candidate path'}}
    foreach($tool in @($gitPath,$bunPath,$psqlPath,$postgresPath,$pythonPath,$powerShellPath)){if(-not(Test-Path -LiteralPath $tool -PathType Leaf)){throw 'Required admitted native tool is absent'}}
    if((&$bunPath --version).Trim()-cne'1.3.14'){throw 'Unexpected native Bun version'}
    $resolved=@(&$gitPath -C $repositoryRoot rev-parse "$CandidateRevision^{commit}");if($LASTEXITCODE-ne0-or$resolved.Count-ne1-or$resolved[0]-cne$CandidateRevision){throw 'Candidate commit is unavailable or not exact'}
    $credentials=Read-RetainedDatabaseCredentials;$databasePassword=$credentials.DeployPassword
    [void](Assert-PostmasterIdentity)
    $template=@(Invoke-Psql $templateDatabase "SELECT (SELECT count(*) FROM schema_migration)||'|'||(SELECT count(*) FROM pg_tables WHERE schemaname='public')||'|'||(SELECT count(*) FROM tenant);" $databasePassword)
    if($template.Count-ne1-or$template[0]-cne'77|127|0'){throw 'Template is not pristine77/127/zero-tenant'}
    $templateSessions=@(Invoke-Psql postgres "SELECT count(*) FROM pg_stat_activity WHERE datname='$templateDatabase';" $databasePassword)
    if($templateSessions.Count-ne1-or$templateSessions[0]-cne'0'){throw 'Pristine template currently has clients'}
    $existing=@(Invoke-Psql postgres "SELECT count(*) FROM pg_database WHERE datname IN ('$($Paths.ReviewDatabase)','$($Paths.InvariantDatabase)');" $databasePassword)
    if($existing.Count-ne1-or$existing[0]-cne'0'){throw 'Candidate database target already exists'}
    New-PrivateDirectory $Paths.ControlRoot
    &$gitPath -C $repositoryRoot archive --format=zip "--output=$($Paths.ArchivePath)" $CandidateRevision;if($LASTEXITCODE-ne0){throw 'Exact candidate archive failed'}
    Expand-Archive -LiteralPath $Paths.ArchivePath -DestinationPath $Paths.SourceRoot
    foreach($identity in @('package.json','bun.lock','bunfig.toml')){if((Get-Sha256Hex(Join-Path $Paths.SourceRoot $identity))-cne(Get-Sha256Hex(Join-Path $repositoryRoot $identity))){throw 'Candidate dependency identity differs from installed workspace'}}
    $junction=New-Item -ItemType Junction -Path (Join-Path $Paths.SourceRoot 'node_modules') -Target (Join-Path $repositoryRoot 'node_modules')
    if($junction.LinkType-cne'Junction'){throw 'Candidate dependency junction failed'}
    $archiveHash=Get-Sha256Hex $Paths.ArchivePath;Assert-SourceArchiveIdentity $Paths.ArchivePath $Paths.SourceRoot $archiveHash
    Invoke-Psql postgres "CREATE DATABASE $($Paths.ReviewDatabase) TEMPLATE $templateDatabase OWNER yellow_deploy;" $databasePassword|Out-Null
    Invoke-Psql postgres "CREATE DATABASE $($Paths.InvariantDatabase) TEMPLATE $templateDatabase OWNER yellow_deploy;" $databasePassword|Out-Null
    $deployEncoded=[Uri]::EscapeDataString($credentials.DeployPassword);$runtimeEncoded=[Uri]::EscapeDataString($credentials.RuntimePassword);$registrarEncoded=[Uri]::EscapeDataString($credentials.RegistrarPassword)
    $reviewDeploy="postgres://yellow_deploy:$deployEncoded@127.0.0.1:55503/$($Paths.ReviewDatabase)";$reviewRuntime="postgres://yellow_runtime:$runtimeEncoded@127.0.0.1:55503/$($Paths.ReviewDatabase)"
    $operator=New-RandomSecret;$approver=New-RandomSecret;$token=New-RandomSecret
    $seedText="YELLOW_DEPLOY_DATABASE_URL=$reviewDeploy`nYELLOW_RUNTIME_DATABASE_URL=$reviewRuntime`nYELLOW_REVIEW_PASSWORD=$operator`nYELLOW_REVIEW_APPROVER_PASSWORD=$approver`nYELLOW_FISCAL_REVIEW_MANIFEST_PATH=$($Paths.FixtureManifestPath)`n"
    Write-PrivateFile $Paths.SeedEnvironmentPath $seedText
    $appLines=@('NODE_ENV=production','HOST=127.0.0.1','PORT=3000',"YELLOW_BUILD_SHA=$CandidateRevision",'YELLOW_OPERATOR_WORKBENCH=1','YELLOW_LOCAL_REVIEW_PREFILL=1','YELLOW_LOCAL_REVIEW_TENANT=yellow-demo','YELLOW_LOCAL_REVIEW_EMAIL=operator@yellow.local',"YELLOW_LOCAL_REVIEW_PASSWORD=$operator","YELLOW_TOKEN_SECRET=$token","YELLOW_RUNTIME_DATABASE_URL=$reviewRuntime","YELLOW_EXTENSION_REGISTRAR_DATABASE_URL=postgres://yellow_extension_registrar:$registrarEncoded@127.0.0.1:55503/$($Paths.ReviewDatabase)",'YELLOW_HOLD_EXPIRY_WORKER=1','YELLOW_AVAILABILITY_PROJECTION_WORKER=1','YELLOW_PICKUP_TASK_WORKER=1','YELLOW_RESERVATION_ARRIVAL_ROLL_WORKER=1','YELLOW_RESERVATION_DEPARTURE_ROLL_WORKER=1','YELLOW_BUSINESS_DAY_ROLL_WORKER=1')
    Write-PrivateFile $Paths.EnvironmentPath (($appLines-join"`n")+"`n")
    foreach($database in @($Paths.ReviewDatabase,$Paths.InvariantDatabase)){
        $url="postgres://yellow_deploy:$deployEncoded@127.0.0.1:55503/$database";Invoke-PrivateTool $bunPath @('scripts/migrate.ts') $Paths.SourceRoot (Join-Path $Paths.ControlRoot "$database-migrate.log") @{YELLOW_DEPLOY_DATABASE_URL=$url}
    }
    Invoke-PrivateTool $bunPath @("--env-file=$($Paths.SeedEnvironmentPath)",'scripts/seed.ts') $Paths.SourceRoot (Join-Path $Paths.ControlRoot 'seed.log') @{}
    Invoke-PrivateTool $bunPath @("--env-file=$($Paths.SeedEnvironmentPath)",'scripts/seed-review.ts') $Paths.SourceRoot (Join-Path $Paths.ControlRoot 'review-seed.log') @{}
    Invoke-PrivateTool $bunPath @("--env-file=$($Paths.SeedEnvironmentPath)",'scripts/seed-fiscal-review.ts') $Paths.SourceRoot (Join-Path $Paths.ControlRoot 'fiscal-seed.log') @{}
    Set-PrivateAcl $Paths.FixtureManifestPath;$manifest=Read-BoundedPrivateJson $Paths.FixtureManifestPath 32768;Assert-FiscalFixtureManifest $manifest
    Invoke-PrivateTool $psqlPath @('-h','127.0.0.1','-p','55503','-U','yellow_deploy','-d',$Paths.InvariantDatabase,'-X','-v','ON_ERROR_STOP=1','-f','tests/seed_fixture.sql') $Paths.SourceRoot (Join-Path $Paths.ControlRoot 'referee-fixture.log') @{PGPASSWORD=$databasePassword;PGCONNECT_TIMEOUT='5'}
    Invoke-PrivateTool $pythonPath @('tests/run_invariants.py',$Paths.InvariantDatabase) $Paths.SourceRoot (Join-Path $Paths.ControlRoot 'referee.log') @{YELLOW_DSN="dbname=$($Paths.InvariantDatabase) user=yellow_deploy password=$databasePassword host=127.0.0.1 port=55503";PYTHONIOENCODING='utf-8'}
    if((Get-Content -LiteralPath (Join-Path $Paths.ControlRoot 'referee.log') -Raw)-notmatch'11 passed, 0 failed of 11'){throw 'Canonical referee did not report11/11'}
    foreach($database in @($Paths.ReviewDatabase,$Paths.InvariantDatabase)){$frontier=@(Invoke-ReadOnlyPsql $database "SELECT count(*)||'|'||max(version) FROM schema_migration;" $databasePassword);if($frontier.Count-ne1-or$frontier[0]-cne'85|85'){throw 'Candidate migration frontier differs from85'}}
    $ledgerLines=@(Invoke-ReadOnlyPsql $Paths.ReviewDatabase "SELECT version||':'||filename||':'||btrim(checksum_sha256) FROM schema_migration ORDER BY version;" $databasePassword)
    $receipt=[ordered]@{schema='yellow-order444-native-candidate/v1';source=$CandidateRevision;sourceArchiveSha256=$archiveHash;sourceRoot=$Paths.SourceRoot;controlRoot=$Paths.ControlRoot;reviewDatabase=$Paths.ReviewDatabase;invariantDatabase=$Paths.InvariantDatabase;migrationFrontier=85;migrationLedgerSha256=Get-TextSha256Hex($ledgerLines-join"`n");bunVersion='1.3.14';packageJsonSha256=Get-Sha256Hex(Join-Path $Paths.SourceRoot 'package.json');bunLockSha256=Get-Sha256Hex(Join-Path $Paths.SourceRoot 'bun.lock');bunfigSha256=Get-Sha256Hex(Join-Path $Paths.SourceRoot 'bunfig.toml');appEnvironmentSha256=Get-Sha256Hex $Paths.EnvironmentPath;seedEnvironmentSha256=Get-Sha256Hex $Paths.SeedEnvironmentPath;postgresVersionNum='160015';postgresPort=55503;fixtureManifestSha256=Get-Sha256Hex $Paths.FixtureManifestPath;referee='11/11';prepared=$true;preparedUtc=[DateTime]::UtcNow.ToString('o');dependencyJunction=(Join-Path $repositoryRoot 'node_modules');providerConfigurationAbsent=$true;fiscalWorkerDisabled=$true;usesDocker=$false;usesWsl=$false}
    Write-PrivateFile $Paths.ReceiptPath ($receipt|ConvertTo-Json -Depth 6)
    [pscustomobject]@{Action='Prepare';Revision=$CandidateRevision;ReviewDatabase=$Paths.ReviewDatabase;InvariantDatabase=$Paths.InvariantDatabase;Prepared=$true;Receipt=$Paths.ReceiptPath}
}

function Invoke-Promote([object]$Paths) {
    [void](Assert-PostmasterIdentity);$identity=Read-CandidateIdentity $Paths;$seedEnvironment=Read-SeedEnvironment $Paths
    Assert-CandidateDatabaseIdentity $Paths $identity.Receipt $seedEnvironment.DeployPassword
    $environment=Read-AppEnvironment $Paths $identity $seedEnvironment
    if(@(Get-ChildItem -LiteralPath $Paths.ControlRoot -File -Filter 'promotion-receipt-*.json').Count-ge$maximumPromotionReceipts){throw 'Bounded promotion receipt limit reached'}
    $old=Get-VerifiedOldLaunch;$stage=$null;$candidate=$null;$oldMutationStarted=$false;$accepted=$false
    try{
        $stage=Start-CandidateSupervisor $stagingPort $Paths;$stageProof=Invoke-HttpProof $stagingPort $identity $environment;Stop-VerifiedLaunch $stage $stagingPort;$stage=$null
        $old=Get-VerifiedOldLaunch
        $oldMutationStarted=$true;Stop-VerifiedOldLaunch $old
        $candidate=Start-CandidateSupervisor $founderPort $Paths;$proof=Invoke-HttpProof $founderPort $identity $environment
        $stamp=[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ');$receiptPath=Join-Path $Paths.ControlRoot "promotion-receipt-$stamp.json"
        $receipt=[ordered]@{schema='yellow-order444-native-promotion/v1';source=$CandidateRevision;candidateReceiptSha256=Get-Sha256Hex $Paths.ReceiptPath;oldReceiptSha256=Get-Sha256Hex $old.ReceiptPath;port=3000;pid=$candidate.Child.Id;supervisorPid=$candidate.Supervisor.Id;startedUtc=$candidate.Status.childStartedUtc;supervisorStartedUtc=$candidate.Status.supervisorStartedUtc;stagingVerified=$true;ready=$proof.Ready;loginVerified=$true;listVerified=$true;detailVerified=$true;readinessVerified=$true;providerDirectoryEmpty=$true;automaticRestart=$false;promotedUtc=[DateTime]::UtcNow.ToString('o')}
        Write-PrivateFile $receiptPath ($receipt|ConvertTo-Json -Depth 8);$accepted=$true
        [pscustomobject]@{Action='Promote';Revision=$CandidateRevision;Url='http://127.0.0.1:3000';Pid=$candidate.Child.Id;Receipt=$receiptPath;LoginVerified=$true}
    } finally {
        $cleanupFailure=$false
        if($null-ne$stage){try{Stop-VerifiedLaunch $stage $stagingPort}catch{$cleanupFailure=$true}}
        if(-not$accepted-and$null-ne$candidate){try{Stop-VerifiedLaunch $candidate $founderPort}catch{$cleanupFailure=$true}}
        if(-not$accepted-and$oldMutationStarted){
            if($cleanupFailure-or@(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue).Count-ne0){throw 'Candidate cleanup was not proven; predecessor resume refused'}
            Invoke-OldResume
        }
        if($cleanupFailure){throw 'Exact candidate cleanup was not proven'}
    }
}

function Invoke-Rollback([object]$Paths) {
    [void](Assert-PostmasterIdentity);$identity=Read-CandidateIdentity $Paths;$seedEnvironment=Read-SeedEnvironment $Paths
    Assert-CandidateDatabaseIdentity $Paths $identity.Receipt $seedEnvironment.DeployPassword
    $receipts=@(Get-ChildItem -LiteralPath $Paths.ControlRoot -File -Filter 'promotion-receipt-*.json'|Sort-Object Name);if($receipts.Count-eq0){throw 'No candidate promotion receipt exists'}
    $receiptPath=$receipts[-1].FullName;Assert-PrivateFileAcl $receiptPath;$receipt=Get-Content -LiteralPath $receiptPath -Raw|ConvertFrom-Json
    if($receipt.schema-cne'yellow-order444-native-promotion/v1'-or$receipt.source-cne$CandidateRevision-or[int]$receipt.port-ne3000){throw 'Candidate promotion receipt identity changed'}
    $child=Get-Process -Id ([int]$receipt.pid) -ErrorAction Stop;$supervisor=Get-Process -Id ([int]$receipt.supervisorPid) -ErrorAction Stop
    $launch=[pscustomobject]@{Child=$child;Supervisor=$supervisor;Status=[pscustomobject]@{childStartedUtc=$receipt.startedUtc;supervisorStartedUtc=$receipt.supervisorStartedUtc}}
    Stop-VerifiedLaunch $launch 3000;Invoke-OldResume
    [pscustomobject]@{Action='Rollback';Revision=$CandidateRevision;RestoredRevision=$oldRevision;Url='http://127.0.0.1:3000';PreviousSourcePreserved=$true}
}

if([IO.Path]::GetFullPath($runtimeBase)-cne'D:\Yellow\runtime'){throw 'Production runtime base identity changed'}
$paths=Get-Order444CandidatePaths $runtimeBase $CandidateRevision
switch($Action){'Prepare'{Invoke-Prepare $paths}'Promote'{Invoke-Promote $paths}'Rollback'{Invoke-Rollback $paths}}
