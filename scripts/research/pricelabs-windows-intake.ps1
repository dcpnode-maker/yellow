[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('ValidateOnly', 'ValidateWritten', 'Run')]
    [string] $Action,

    [Parameter(Mandatory)]
    [string] $Archive,

    [Parameter(Mandatory)]
    [string] $Output,

    [string] $BunPath,

    [string] $LoaderPath,

    [ValidateRange(1, 1800)]
    [int] $TimeoutSeconds = 300
)

# Order462: native-only private PriceLabs intake. This wrapper never weakens the
# TypeScript importer's deliberate win32 refusal and never prints child output.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

if (-not $IsWindows) { throw 'windows_intake_requires_windows' }
if ([IO.Path]::GetFileName([Diagnostics.Process]::GetCurrentProcess().MainModule.FileName) -ine 'pwsh.exe') {
    throw 'windows_intake_requires_powershell7'
}

$script:CurrentSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
$script:SystemSid = [Security.Principal.SecurityIdentifier]::new('S-1-5-18')
$script:AllowedSids = @($script:CurrentSid.Value, $script:SystemSid.Value)
$script:ApprovedRoots = @(
    'D:\Yellow\data\pricelabs',
    'D:\Yellow\temp\order462-acl-tests'
)

function Resolve-StrictAbsolutePath([string] $Value, [string] $Code) {
    if ([string]::IsNullOrWhiteSpace($Value) -or -not [IO.Path]::IsPathFullyQualified($Value) -or
        $Value -match '(^|[\\/])\.\.?([\\/]|$)' -or $Value.IndexOf([char]0) -ge 0) {
        throw $Code
    }
    try { return [IO.Path]::GetFullPath($Value) } catch { throw $Code }
}

function Test-ContainedPath([string] $Root, [string] $Candidate) {
    $normalizedRoot = [IO.Path]::GetFullPath($Root).TrimEnd('\')
    return $Candidate.Equals($normalizedRoot, [StringComparison]::OrdinalIgnoreCase) -or
        $Candidate.StartsWith($normalizedRoot + '\', [StringComparison]::OrdinalIgnoreCase)
}

function Assert-ApprovedPath([string] $Path, [string] $Code) {
    foreach ($root in $script:ApprovedRoots) {
        if (Test-ContainedPath $root $Path) { return }
    }
    throw $Code
}

function Assert-NtfsPath([string] $Path) {
    $driveRoot = [IO.Path]::GetPathRoot($Path)
    if ([string]::IsNullOrEmpty($driveRoot)) { throw 'path_has_no_drive' }
    try { $drive = [IO.DriveInfo]::new($driveRoot) } catch { throw 'drive_unavailable' }
    if (-not $drive.IsReady -or $drive.DriveFormat -cne 'NTFS') { throw 'ntfs_required' }
}

function Assert-NoReparseAncestry([string] $Path, [bool] $IncludeLeaf) {
    $cursor = if ($IncludeLeaf) { $Path } else { [IO.Path]::GetDirectoryName($Path) }
    while (-not [string]::IsNullOrEmpty($cursor)) {
        if (-not [IO.Directory]::Exists($cursor) -and -not [IO.File]::Exists($cursor)) {
            throw 'path_ancestor_missing'
        }
        $item = Get-Item -LiteralPath $cursor -Force
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw 'reparse_ancestry_forbidden'
        }
        $parent = [IO.Path]::GetDirectoryName($cursor.TrimEnd('\'))
        if ([string]::IsNullOrEmpty($parent) -or $parent -eq $cursor) { break }
        $cursor = $parent
    }
}

function Get-RuleSid([Security.AccessControl.FileSystemAccessRule] $Rule) {
    try {
        return $Rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
    } catch {
        throw 'unresolvable_acl_identity'
    }
}

function Assert-PrivateAcl([string] $Path, [bool] $RequireProtected) {
    $acl = Get-Acl -LiteralPath $Path
    if ($RequireProtected -and -not $acl.AreAccessRulesProtected) { throw 'acl_inheritance_not_protected' }
    $ownerSid = $acl.Owner
    try {
        $ownerSid = ([Security.Principal.NTAccount]::new($acl.Owner)).Translate([Security.Principal.SecurityIdentifier]).Value
    } catch {
        if ($ownerSid -notmatch '^S-\d+(?:-\d+)+$') { throw 'unresolvable_acl_owner' }
    }
    if ($ownerSid -notin $script:AllowedSids) { throw 'acl_owner_not_allowed' }

    $fullControl = @{}
    foreach ($rule in @($acl.Access)) {
        $sid = Get-RuleSid $rule
        if ($sid -notin $script:AllowedSids) { throw 'acl_identity_not_allowed' }
        if ($rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow) {
            throw 'acl_non_allow_rule_forbidden'
        }
        if (($rule.FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -eq
            [Security.AccessControl.FileSystemRights]::FullControl) {
            $fullControl[$sid] = $true
        }
    }
    foreach ($sid in $script:AllowedSids) {
        if (-not $fullControl.ContainsKey($sid)) { throw 'acl_full_control_missing' }
    }
}

function New-PrivateDirectorySecurity {
    $acl = [Security.AccessControl.DirectorySecurity]::new()
    $acl.SetAccessRuleProtection($true, $false)
    $acl.SetOwner($script:CurrentSid)
    foreach ($sid in @($script:CurrentSid, $script:SystemSid)) {
        $rule = [Security.AccessControl.FileSystemAccessRule]::new(
            $sid,
            [Security.AccessControl.FileSystemRights]::FullControl,
            [Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit',
            [Security.AccessControl.PropagationFlags]::None,
            [Security.AccessControl.AccessControlType]::Allow
        )
        [void] $acl.AddAccessRule($rule)
    }
    return $acl
}

function New-PrivateOutputDirectory([string] $Path) {
    if ([IO.Directory]::Exists($Path) -or [IO.File]::Exists($Path)) { throw 'output_already_exists' }
    $parent = [IO.Path]::GetDirectoryName($Path)
    if (-not [IO.Directory]::Exists($parent)) { throw 'output_parent_missing' }
    Assert-NoReparseAncestry $Path $false
    Assert-PrivateAcl $parent $true
    $security = New-PrivateDirectorySecurity

    # .NET Framework exposes DirectoryInfo.Create(DirectorySecurity), while the
    # current PowerShell runtime may not. The fallback is safe only because the
    # already-existing parent was proved protected with the identical allowlist.
    $atomicCreate = [IO.DirectoryInfo].GetMethods() | Where-Object {
        $_.Name -ceq 'Create' -and $_.GetParameters().Count -eq 1 -and
        $_.GetParameters()[0].ParameterType -eq [Security.AccessControl.DirectorySecurity]
    } | Select-Object -First 1
    if ($null -ne $atomicCreate) {
        $directory = [IO.DirectoryInfo]::new($Path)
        [void] $atomicCreate.Invoke($directory, @($security))
    } else {
        [void] [IO.Directory]::CreateDirectory($Path)
        [IO.FileSystemAclExtensions]::SetAccessControl([IO.DirectoryInfo]::new($Path), $security)
    }
    Assert-NoReparseAncestry $Path $true
    Assert-PrivateAcl $Path $true
}

function Assert-PrivateTree([string] $Root) {
    Assert-NoReparseAncestry $Root $true
    Assert-PrivateAcl $Root $true
    $pending = [Collections.Generic.Stack[string]]::new()
    $pending.Push($Root)
    $entries = 0
    while ($pending.Count -gt 0) {
        $directory = $pending.Pop()
        foreach ($path in [IO.Directory]::EnumerateFileSystemEntries($directory)) {
            $entries += 1
            if ($entries -gt 500) { throw 'archive_entry_limit_exceeded' }
            $item = Get-Item -LiteralPath $path -Force
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw 'archive_reparse_member_forbidden'
            }
            if (($item.Attributes -band [IO.FileAttributes]::Offline) -ne 0) {
                throw 'archive_offline_member_forbidden'
            }
            Assert-PrivateAcl $path $false
            if ($item.PSIsContainer) {
                $pending.Push($item.FullName)
            } elseif (-not [IO.File]::Exists($item.FullName)) {
                throw 'archive_member_not_regular'
            }
        }
    }
    return $entries
}

function Resolve-RegularExecutable([string] $Path, [string] $MissingCode) {
    if ([string]::IsNullOrWhiteSpace($Path)) { throw $MissingCode }
    $full = Resolve-StrictAbsolutePath $Path 'invalid_executable_path'
    if (-not [IO.File]::Exists($full)) { throw $MissingCode }
    Assert-NoReparseAncestry $full $true
    $item = Get-Item -LiteralPath $full -Force
    if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'executable_not_regular'
    }
    return $full
}

function Invoke-PrivateLoader([string] $Bun, [string] $Loader, [string] $ArchivePath, [string] $OutputPath) {
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $Bun
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.WorkingDirectory = Split-Path $Loader -Parent
    # The loader independently calls this wrapper's ValidateOnly action before
    # writing. Scope the verified native PowerShell path to this child only.
    $start.Environment['YELLOW_PRICELABS_PWSH'] = [Diagnostics.Process]::GetCurrentProcess().MainModule.FileName
    foreach ($argument in @($Loader, '--archive', $ArchivePath, '--output', $OutputPath)) {
        [void] $start.ArgumentList.Add($argument)
    }
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $start
    try {
        if (-not $process.Start()) { throw 'pricelabs_child_start_failed' }
        $discardOutput = $process.StandardOutput.BaseStream.CopyToAsync([IO.Stream]::Null)
        $discardError = $process.StandardError.BaseStream.CopyToAsync([IO.Stream]::Null)
        if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
            try { $process.Kill($true) } catch { }
            [void] $process.WaitForExit(5000)
            throw 'pricelabs_child_timeout'
        }
        $process.WaitForExit()
        [void] $discardOutput.GetAwaiter().GetResult()
        [void] $discardError.GetAwaiter().GetResult()
        if ($process.ExitCode -ne 0) { throw 'pricelabs_child_failed' }
    } finally {
        $process.Dispose()
    }
}

function Write-SafeResult([string] $Status, [int] $ArchiveEntries) {
    $value = [ordered]@{
        schemaVersion = 'yellow.pricelabs-windows-intake/v1'
        status = $Status
        archiveEntries = $ArchiveEntries
        operationalWrites = $false
    }
    [Console]::Out.WriteLine(($value | ConvertTo-Json -Compress))
}

try {
    $archivePath = Resolve-StrictAbsolutePath $Archive 'invalid_archive_path'
    $outputPath = Resolve-StrictAbsolutePath $Output 'invalid_output_path'
    Assert-ApprovedPath $archivePath 'archive_outside_approved_root'
    Assert-ApprovedPath $outputPath 'output_outside_approved_root'
    if ((Test-ContainedPath $archivePath $outputPath) -or (Test-ContainedPath $outputPath $archivePath)) {
        throw 'archive_output_overlap'
    }
    Assert-NtfsPath $archivePath
    Assert-NtfsPath $outputPath
    if (-not [IO.Directory]::Exists($archivePath)) { throw 'archive_directory_missing' }
    $archiveEntries = Assert-PrivateTree $archivePath

    if ($Action -ceq 'ValidateOnly') {
        if ([IO.File]::Exists($outputPath)) { throw 'output_not_directory' }
        if ([IO.Directory]::Exists($outputPath)) {
            Assert-PrivateTree $outputPath | Out-Null
            if ([IO.Directory]::EnumerateFileSystemEntries($outputPath).GetEnumerator().MoveNext()) {
                throw 'output_not_empty'
            }
        } else {
            $outputParent = [IO.Path]::GetDirectoryName($outputPath)
            if (-not [IO.Directory]::Exists($outputParent)) { throw 'output_parent_missing' }
            Assert-NoReparseAncestry $outputPath $false
            Assert-PrivateAcl $outputParent $true
        }
        Write-SafeResult 'validated' $archiveEntries
        exit 0
    }

    if ($Action -ceq 'ValidateWritten') {
        if (-not [IO.Directory]::Exists($outputPath) -or [IO.File]::Exists($outputPath)) {
            throw 'written_output_directory_missing'
        }
        Assert-PrivateTree $outputPath | Out-Null
        Write-SafeResult 'validated-written' $archiveEntries
        exit 0
    }

    if ([IO.Directory]::Exists($outputPath) -or [IO.File]::Exists($outputPath)) { throw 'output_already_exists' }
    if ([string]::IsNullOrWhiteSpace($BunPath)) {
        $bunCommand = Get-Command bun.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($null -eq $bunCommand) { throw 'bun_executable_missing' }
        $BunPath = $bunCommand.Source
    }
    if ([string]::IsNullOrWhiteSpace($LoaderPath)) {
        $LoaderPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'research\pricelabs-staging.ts'
    }
    $bun = Resolve-RegularExecutable $BunPath 'bun_executable_missing'
    $loader = Resolve-RegularExecutable $LoaderPath 'staging_loader_missing'
    New-PrivateOutputDirectory $outputPath
    Invoke-PrivateLoader $bun $loader $archivePath $outputPath
    Assert-PrivateTree $outputPath | Out-Null
    Write-SafeResult 'completed' $archiveEntries
} catch {
    $code = [string] $_.Exception.Message
    if ($code -notmatch '^[a-z0-9_]+$') { $code = 'windows_intake_failed' }
    [Console]::Error.WriteLine("PriceLabs Windows intake failed: $code")
    exit 1
}
