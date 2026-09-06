[CmdletBinding()]
param(
    [string]$Git = 'C:\Users\astha\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe',
    [string]$StageRoot = 'D:\Yellow\recovery',
    [string]$DriveRoot = 'G:\My Drive\Yellow',
    [switch]$IncludeNativeReview,
    [switch]$StageOnly
)

# Order442: portable source recovery, never a copy of live database/Git internals.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Add-Type -AssemblyName System.IO.Compression

function Invoke-Git([string]$Directory, [string[]]$Arguments) {
    $result = @(& $Git -C $Directory @Arguments)
    if ($LASTEXITCODE -ne 0) { throw "Git operation failed: $($Arguments[0])" }
    return $result
}

function Assert-LocalDirectory([string]$Path) {
    $full = [IO.Path]::GetFullPath($Path)
    if ($full -ne $Path -or $full -eq [IO.Path]::GetPathRoot($full)) { throw 'Invalid backup directory' }
    if (Test-Path -LiteralPath $full) {
        $item = Get-Item -LiteralPath $full -Force
        if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw 'Backup directory must not be a file or junction'
        }
    }
}

function Write-Json([string]$Path, $Value) {
    [IO.File]::WriteAllText($Path, ($Value | ConvertTo-Json -Depth 12), [Text.UTF8Encoding]::new($false))
}

Assert-LocalDirectory $StageRoot
Assert-LocalDirectory $DriveRoot
if (-not $StageOnly -and -not (Test-Path -LiteralPath 'G:\My Drive' -PathType Container)) { throw 'Google Drive desktop mount is unavailable' }
if ($StageRoot -ne 'D:\Yellow\recovery' -or $DriveRoot -ne 'G:\My Drive\Yellow') {
    throw 'This admitted invocation uses only the explicitly named recovery directories'
}
$stamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8)
$stage = Join-Path $StageRoot $stamp
$destination = Join-Path $DriveRoot $stamp
if ((Test-Path -LiteralPath $stage) -or (Test-Path -LiteralPath $destination)) { throw 'Backup checkpoint already exists' }
[IO.Directory]::CreateDirectory($stage) | Out-Null
# This checkpoint can contain private configuration, so do not inherit broader ACLs.
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$acl = Get-Acl -LiteralPath $stage
$acl.SetAccessRuleProtection($true,$false)
foreach ($rule in @($acl.Access)) { [void]$acl.RemoveAccessRuleAll($rule) }
$acl.SetOwner([Security.Principal.NTAccount]::new($identity))
$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))
Set-Acl -LiteralPath $stage -AclObject $acl
if (-not (Get-Acl -LiteralPath $stage).AreAccessRulesProtected) { throw 'Private checkpoint ACL is not protected' }
$main = @(Invoke-Git $projectRoot @('rev-parse','refs/remotes/origin/main'))[0]
if ($main -notmatch '^[0-9a-f]{40}$') { throw 'Exact fetched main revision unavailable' }

$bundle = Join-Path $stage 'yellow-all-refs.bundle'
$refsBefore = @(Invoke-Git $projectRoot @('show-ref'))
Invoke-Git $projectRoot @('bundle','create',$bundle,'--all') | Out-Null
Invoke-Git $projectRoot @('bundle','verify',$bundle) | Out-Null
Invoke-Git $projectRoot @('archive','--format=zip',"--output=$(Join-Path $stage 'merged-main-source.zip')",$main) | Out-Null
$heads = @(Invoke-Git $projectRoot @('bundle','list-heads',$bundle))
$registered = @(Invoke-Git $projectRoot @('worktree','list','--porcelain'))
$worktrees = @($registered | Where-Object { $_.StartsWith('worktree ') } | ForEach-Object { $_.Substring(9).Replace('/','\') })
if ($worktrees.Count -eq 0) { throw 'No registered worktrees found' }
$approvedWorktrees = @(
    'C:\Users\astha\Documents\Codex\2026-08-14\cl\outputs\yellow',
    'C:\Users\astha\Documents\Codex\2026-08-14\cl\outputs\yellow-order175-folio-responsive-containment',
    'C:\Users\astha\Documents\Codex\2026-08-14\cl\outputs\yellow-order432-rate-pricing'
)
foreach ($tree in $worktrees) {
    if ($tree -cnotin $approvedWorktrees) { throw 'Registered worktree outside the independently inventoried exact scope' }
}
$records = @()

foreach ($tree in $worktrees) {
    Assert-LocalDirectory $tree
    $treeName = Split-Path $tree -Leaf
    if ($treeName -notmatch '^yellow(?:-[a-zA-Z0-9-]+)?$') { throw 'Unexpected registered worktree name' }
    $headBefore = @(Invoke-Git $tree @('rev-parse','HEAD'))[0]
    $statusBefore = @(Invoke-Git $tree @('status','--porcelain=v1','--untracked-files=all'))
    $patch = Join-Path $stage "$treeName-working.patch"
    Invoke-Git $tree @('diff','HEAD','--binary',"--output=$patch") | Out-Null
    $paths = @(Invoke-Git $tree @('-c','core.quotePath=false','ls-files','--modified','--others','--exclude-standard'))
    $ignored = @(Invoke-Git $tree @('-c','core.quotePath=false','ls-files','--others','--ignored','--exclude-standard'))
    foreach ($privateName in @('.env','.env.local-review','.yellow/runtime-database-authority.env','.yellow/current-founder-login.env')) {
        if (Test-Path -LiteralPath (Join-Path $tree $privateName) -PathType Leaf) { $paths += $privateName }
    }
    $paths = @($paths | Sort-Object -Unique)
    $saved = @()
    $excluded = @()
    $zipPath = Join-Path $stage "$treeName-uncommitted.zip"
    $zipFile = [IO.File]::Open($zipPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
    $zip = [IO.Compression.ZipArchive]::new($zipFile,[IO.Compression.ZipArchiveMode]::Create,$false)
    try {
        foreach ($relative in $paths) {
            $relative = $relative.Replace('\','/')
            if ($relative -match '(^|/)(node_modules|\.git|content_cache|docker-data)(/|$)|\.(dmp|dump|vhdx|vhd)$') {
                $excluded += @{ path=$relative; reason='regenerable or database/dump artifact requires separate handling' }
                continue
            }
            $absolute = [IO.Path]::GetFullPath((Join-Path $tree $relative))
            if (-not $absolute.StartsWith($tree+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Worktree path escaped its root' }
            if (-not (Test-Path -LiteralPath $absolute)) { continue } # Deletions are retained in the binary patch/status.
            $item = Get-Item -LiteralPath $absolute -Force
            if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
                ($item.Attributes -band [IO.FileAttributes]::Offline)) { throw "Cannot safely snapshot linked/offline path: $relative" }
            # Hold each source read-only against concurrent writers while hashing and copying.
            $inputFile = [IO.File]::Open($absolute,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
            try {
                $sha = [Security.Cryptography.SHA256]::Create()
                try { $digest = [Convert]::ToHexString($sha.ComputeHash($inputFile)).ToLowerInvariant() } finally { $sha.Dispose() }
                $inputFile.Position = 0
                $entry = $zip.CreateEntry($relative,[IO.Compression.CompressionLevel]::Optimal)
                $output = $entry.Open()
                try { $inputFile.CopyTo($output) } finally { $output.Dispose() }
                $saved += @{ path=$relative; bytes=$inputFile.Length; sha256=$digest }
            } finally { $inputFile.Dispose() }
        }
    } finally { $zip.Dispose(); $zipFile.Dispose() }
    $headAfter = @(Invoke-Git $tree @('rev-parse','HEAD'))[0]
    $statusAfter = @(Invoke-Git $tree @('status','--porcelain=v1','--untracked-files=all'))
    if ($headBefore -ne $headAfter -or ($statusBefore -join "`n") -ne ($statusAfter -join "`n")) {
        throw 'Worktree changed during backup; incomplete checkpoint must not be used for cleanup'
    }
    foreach ($file in $saved) {
        if ((Get-FileHash -LiteralPath (Join-Path $tree $file.path) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.sha256) {
            throw 'Working file changed during backup; do not use this checkpoint for cleanup'
        }
    }
    $records += @{ name=$treeName; source=$tree; head=$headBefore; status=$statusBefore;
        patch=[IO.Path]::GetFileName($patch); files=$saved; excluded=$excluded;
        ignoredFilesNotCaptured=@($ignored | Where-Object { $_ -cnotin $paths }) }
}
if (($refsBefore -join "`n") -ne (@(Invoke-Git $projectRoot @('show-ref')) -join "`n")) {
    throw 'Git refs changed during capture; do not publish an inconsistent checkpoint'
}

$nativeRecovery = $null
if ($IncludeNativeReview) {
    # Q200 admits only this new synthetic review database. Never copy live PG files.
    $control = 'D:\Yellow\runtime\order442-review'
    $receipt = Get-Content -LiteralPath (Join-Path $control 'receipt.json') -Raw | ConvertFrom-Json
    if ($receipt.source -ne $main -or $receipt.database -ne 'yellow_order442_review' -or
        $receipt.postgresPort -ne 55503 -or $receipt.usesWsl -or $receipt.usesDocker) {
        throw 'Native recovery receipt does not match the admitted exact source/database'
    }
    $seedEnv = Get-Content -LiteralPath (Join-Path $control 'seed.env')
    $connectionLines = @($seedEnv | Where-Object { $_.StartsWith('YELLOW_DEPLOY_DATABASE_URL=') })
    if ($connectionLines.Count -ne 1) { throw 'Missing unambiguous private dump connection' }
    $connection = [Uri]$connectionLines[0].Substring('YELLOW_DEPLOY_DATABASE_URL='.Length)
    $userInfo = $connection.UserInfo.Split(':',2)
    if ($connection.Scheme -ne 'postgres' -or $connection.Host -ne '127.0.0.1' -or
        $connection.Port -ne 55503 -or $connection.AbsolutePath -ne '/yellow_order442_review' -or
        $userInfo.Count -ne 2 -or $userInfo[0] -ne 'yellow_deploy') { throw 'Dump connection escaped the admitted target' }
    $pgBin = 'E:\yellow\toolchains\postgresql-16.15\pgsql\bin'
    $dump = Join-Path $stage 'native-review-database.pgdump'
    $oldPassword = $env:PGPASSWORD
    $oldTimeout = $env:PGCONNECT_TIMEOUT
    try {
        $env:PGPASSWORD = [Uri]::UnescapeDataString($userInfo[1])
        $env:PGCONNECT_TIMEOUT = '5'
        & (Join-Path $pgBin 'pg_dump.exe') --host=127.0.0.1 --port=55503 --username=yellow_deploy --dbname=yellow_order442_review --no-password --format=custom --lock-wait-timeout=10s "--file=$dump"
        if ($LASTEXITCODE -ne 0) { throw 'Consistent native review logical backup failed' }
        $archiveList = @(& (Join-Path $pgBin 'pg_restore.exe') --list $dump)
        if ($LASTEXITCODE -ne 0 -or $archiveList.Count -lt 10) { throw 'Native logical archive is unreadable' }
        [IO.File]::WriteAllLines((Join-Path $stage 'native-review-database-contents.txt'),$archiveList,[Text.UTF8Encoding]::new($false))
    } finally {
        $env:PGPASSWORD = $oldPassword
        $env:PGCONNECT_TIMEOUT = $oldTimeout
    }
    $configFiles = @(
        @{ source=(Join-Path $control 'app.env'); entry='order442-review/app.env' },
        @{ source=(Join-Path $control 'seed.env'); entry='order442-review/seed.env' },
        @{ source=(Join-Path $control 'receipt.json'); entry='order442-review/receipt.json' },
        @{ source=(Join-Path $control 'referee.log'); entry='order442-review/referee.log' },
        @{ source='C:\Users\astha\.wslconfig'; entry='host/.wslconfig' }
    )
    $configRecords = @()
    $configFile = [IO.File]::Open((Join-Path $stage 'native-review-private-config.zip'),[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
    $configZip = [IO.Compression.ZipArchive]::new($configFile,[IO.Compression.ZipArchiveMode]::Create,$false)
    try {
        foreach ($file in $configFiles) {
            $item = Get-Item -LiteralPath $file.source -Force
            if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Unexpected native configuration link' }
            $inputFile = [IO.File]::Open($file.source,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
            try {
                $sha = [Security.Cryptography.SHA256]::Create()
                try { $digest = [Convert]::ToHexString($sha.ComputeHash($inputFile)).ToLowerInvariant() } finally { $sha.Dispose() }
                $inputFile.Position = 0
                $entry = $configZip.CreateEntry($file.entry,[IO.Compression.CompressionLevel]::Optimal)
                $output = $entry.Open()
                try { $inputFile.CopyTo($output) } finally { $output.Dispose() }
                $configRecords += @{ source=$file.source; entry=$file.entry; sha256=$digest; bytes=$inputFile.Length }
            } finally { $inputFile.Dispose() }
        }
    } finally { $configZip.Dispose(); $configFile.Dispose() }
    $nativeRecovery = @{ database='yellow_order442_review'; postgresVersion='16.15'; source=$main;
        backup='native-review-database.pgdump'; archiveListVerified=$true; restoreDrillVerified=$false;
        privateConfiguration=$configRecords; dumpIncludesGlobalRoles=$false;
        excluded='Other native databases, global role definitions, live PG cluster files, installed tools and dependencies.' }
}

$artifacts = @(Get-ChildItem -LiteralPath $stage -File | ForEach-Object {
    @{ name=$_.Name; bytes=$_.Length; sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant() }
})
$manifest = @{ schema='yellow-recovery/v1'; createdUtc=$stamp; mergedMain=$main; bundleHeads=$heads;
    worktrees=$records; artifacts=$artifacts; privateConfigurationIncluded=$true;
    databaseBackupIncluded=[bool]$IncludeNativeReview; nativeReviewRecovery=$nativeRecovery; remoteUploadVerified=$false;
    desktopCopyRequested=(-not [bool]$StageOnly);
    excluded='Live database files, Docker VHDs, models/toolchains, package caches and crash dumps. Only the explicitly named synthetic database is logically captured when nativeReviewRecovery is present; all other databases remain excluded. Ignored worktree files are not captured except four named configurations; each worktree inventories omitted ignored paths. Reinstall pinned tools. This is not full retained-hotel-data recovery.' }
Write-Json (Join-Path $stage 'manifest.json') $manifest
$restore = @'
YELLOW PRIVATE RECOVERY CHECKPOINT

Contains all Git refs, an exact merged-main source ZIP, binary working patches,
uncommitted files, private local configuration and their manifest hashes.
Do not share this folder or upload it publicly: configuration may contain secrets.

1. Verify artifact SHA-256 values against manifest.json before use.
2. Clone yellow-all-refs.bundle into ONE fresh local directory with native Git.
3. Select the recorded merged-main commit to recover released source. Restore a
   worktree's recorded head, then its binary patch and uncommitted ZIP to recover
   that work in a separate deliberate recovery operation; do not mix worktrees.
4. Restore private local configuration only to its recorded original project;
   keep it ignored by Git and restrict filesystem access. Reinstall pinned tools.
5. No live hotel database or Docker disk is backed up by this source checkpoint.
   The optional native synthetic database addendum below is the only exception;
   otherwise synthetic review data can be regenerated. Real data needs its own
   consistent, verified logical backup and recovery drill.

If copied through Google Drive for desktop, local readback proves only the
copied bytes, NOT completed upload. Confirm the desktop app says sync is
complete before relying on remote recovery or deleting any original files.
Ignored files omitted from this snapshot are listed per worktree in the manifest.
The manifest and this restore note are compared locally on copy; they are not
self-hashed inside the manifest's artifact list.
'@
if ($IncludeNativeReview) {
    $restore += @'


NATIVE SYNTHETIC REVIEW ADDENDUM
The named yellow_order442_review database has a consistent PostgreSQL16.15
custom-format logical backup. pg_restore --list passed; a restore drill has NOT
been executed. No other database or global role definitions were captured.
native-review-private-config.zip contains the app/seed secrets, receipt, referee
log and host WSL configuration. Restrict restored files to the current user.
For recovery, use an isolated native PostgreSQL16.15 cluster, provision the
documented Yellow roles/grants using source setup instructions, create an EMPTY
database, then pg_restore --exit-on-error into that database. Do not use --clean
or restore over retained data. Retain SQL owners/grants; do not use --no-owner
or --no-acl. Recreate runtime-role passwords from protected local configuration,
or rotate those synthetic credentials and update the protected env files.
Restore exact merged-main source, reinstall pinned dependencies, configure the
new endpoint privately, then verify catalogue/migrations, referee and login.
The original node_modules junction and live native PG directory are dependencies,
not portable backups. Source setup documentation is authoritative for role
provisioning; this untested recovery recipe is not a completed recovery drill.
'@
}
[IO.File]::WriteAllText((Join-Path $stage 'RESTORE.txt'),$restore,[Text.UTF8Encoding]::new($false))
if ($StageOnly) {
    $stageNote = @'
STAGED LOCALLY ONLY — NOT AN OFFSITE BACKUP.
This checkpoint was created with -StageOnly on D: because the desktop Drive
destination's remote visibility/sharing has not been verified. No Drive files
were created. Verify destination privacy, upload and retrieve
the bytes independently before claiming offsite recovery. Keep originals.
'@
    [IO.File]::WriteAllText((Join-Path $stage 'STAGED-ONLY.txt'),$stageNote,[Text.UTF8Encoding]::new($false))
    [pscustomobject]@{ LocalStage=$stage; GoogleDriveFolder=$null; Main=$main;
        Worktrees=$records.Count; Files=@(Get-ChildItem -LiteralPath $stage -File).Count;
        Bytes=(Get-ChildItem -LiteralPath $stage -File | Measure-Object Length -Sum).Sum;
        LocalCopyVerified=$false; RemoteUploadVerified=$false; DatabaseBackupIncluded=[bool]$IncludeNativeReview }
    return
}
[IO.Directory]::CreateDirectory($destination) | Out-Null
foreach ($artifact in Get-ChildItem -LiteralPath $stage -File) {
    $target = Join-Path $destination $artifact.Name
    if (Test-Path -LiteralPath $target) { throw 'Refusing to overwrite a Drive recovery artifact' }
    Copy-Item -LiteralPath $artifact.FullName -Destination $target
    if ((Get-FileHash -LiteralPath $artifact.FullName).Hash -ne (Get-FileHash -LiteralPath $target).Hash) {
        throw 'Google Drive desktop readback mismatch; do not delete the source'
    }
}
[pscustomobject]@{ LocalStage=$stage; GoogleDriveFolder=$destination; Main=$main;
    Worktrees=$records.Count; Files=@(Get-ChildItem -LiteralPath $stage -File).Count;
    Bytes=(Get-ChildItem -LiteralPath $stage -File | Measure-Object Length -Sum).Sum;
    LocalCopyVerified=$true; RemoteUploadVerified=$false; DatabaseBackupIncluded=[bool]$IncludeNativeReview }
