[CmdletBinding()]
param()

# Order442/Q200: resume the already-provisioned, exact merged-main native preview.
# PostgreSQL must already be running. This helper never provisions, migrates, seeds,
# replaces a listener, or starts/stops a PostgreSQL process.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$revision = 'b5ef70842b658183f7b5b4c650c8e78c7a0b513d'
$archiveSha256 = 'F923DDAD39171E449A3712725A3C43358E7916B6B80E4BA056FC4E2ED0268087'
$bunPath = 'C:\Users\astha\.bun\bin\bun.exe'
$postgresPath = 'E:\yellow\toolchains\postgresql-16.15\pgsql\bin\postgres.exe'
$psqlPath = 'E:\yellow\toolchains\postgresql-16.15\pgsql\bin\psql.exe'
$clusterRoot = 'D:\Yellow\temp\order434-production-cluster-20260906'
$appRoot = 'D:\Yellow\runtime\main-b5ef708'
$controlRoot = 'D:\Yellow\runtime\order442-review'
$archivePath = Join-Path $controlRoot 'merged-main-source.zip'
$initialReceiptPath = Join-Path $controlRoot 'receipt.json'
$appEnvironmentPath = Join-Path $controlRoot 'app.env'
$seedEnvironmentPath = Join-Path $controlRoot 'seed.env'
$boundedSupervisorPath = Join-Path $PSScriptRoot 'run-native-review-bounded.ps1'
$reviewDatabase = 'yellow_order442_review'
$postgresPort = 55503
$appPort = 3000
$maximumResumeAttempts = 3

function Get-Sha256Hex([string]$Path) {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-StreamSha256Hex([IO.Stream]$Stream) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return [Convert]::ToHexString($sha.ComputeHash($Stream)).ToLowerInvariant() }
    finally { $sha.Dispose() }
}

function Get-AppTreeFileMap([string]$Root) {
    $rootItem = Get-Item -LiteralPath $Root -Force
    if (-not $rootItem.PSIsContainer -or ($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'Extracted source root is missing, not a directory, or is a reparse point'
    }
    $rootFull = [IO.Path]::GetFullPath($rootItem.FullName).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
    $files = [Collections.Generic.Dictionary[string,string]]::new([StringComparer]::Ordinal)
    $pending = [Collections.Generic.Stack[IO.DirectoryInfo]]::new()
    $pending.Push($rootItem)
    while ($pending.Count -gt 0) {
        $directory = $pending.Pop()
        foreach ($entry in @(Get-ChildItem -LiteralPath $directory.FullName -Force)) {
            $relative = [IO.Path]::GetRelativePath($rootFull, $entry.FullName).Replace('\', '/')
            if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) {
                if ($entry.PSIsContainer -and $relative -ceq 'node_modules') { continue }
                throw 'Extracted source contains an unexpected reparse point'
            }
            if ($entry.PSIsContainer) {
                $pending.Push([IO.DirectoryInfo]$entry)
                continue
            }
            if (-not $files.TryAdd($relative, (Get-Sha256Hex $entry.FullName))) {
                throw 'Extracted source contains a duplicate relative path'
            }
        }
    }
    return ,$files
}

function Assert-SourceArchiveIdentity([string]$Archive, [string]$ExtractedRoot, [string]$ExpectedArchiveSha256) {
    if ((Get-Sha256Hex $Archive) -cne $ExpectedArchiveSha256.ToLowerInvariant()) {
        throw 'Merged-main source archive hash does not match the admitted receipt'
    }
    $actualFiles = Get-AppTreeFileMap $ExtractedRoot
    $archiveFiles = [Collections.Generic.Dictionary[string,string]]::new([StringComparer]::Ordinal)
    $zip = [IO.Compression.ZipFile]::OpenRead($Archive)
    try {
        foreach ($entry in $zip.Entries) {
            if ([string]::IsNullOrEmpty($entry.Name)) { continue }
            $relative = $entry.FullName.Replace('\', '/')
            if ($relative.StartsWith('/') -or $relative -match '(^|/)\.\.(/|$)') {
                throw 'Merged-main source archive contains an unsafe path'
            }
            $stream = $entry.Open()
            try { $hash = Get-StreamSha256Hex $stream }
            finally { $stream.Dispose() }
            if (-not $archiveFiles.TryAdd($relative, $hash)) {
                throw 'Merged-main source archive contains a duplicate path'
            }
        }
    } finally { $zip.Dispose() }

    if ($actualFiles.Count -ne $archiveFiles.Count) {
        throw 'Extracted source file count differs from the admitted archive'
    }
    foreach ($relative in $archiveFiles.Keys) {
        if (-not $actualFiles.ContainsKey($relative) -or $actualFiles[$relative] -cne $archiveFiles[$relative]) {
            throw 'Extracted source bytes differ from the admitted archive'
        }
    }
}

function Assert-PrivateFileAcl([string]$Path) {
    $item = Get-Item -LiteralPath $Path -Force
    if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'Protected environment path is not a regular file'
    }
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    $acl = Get-Acl -LiteralPath $Path
    $rules = @($acl.Access)
    if (-not $acl.AreAccessRulesProtected -or $acl.Owner -cne $identity -or $rules.Count -ne 1) {
        throw 'Protected environment file ACL identity is not current-user-only'
    }
    $rule = $rules[0]
    $ruleIdentity = $rule.IdentityReference.Translate([Security.Principal.NTAccount]).Value
    if ($ruleIdentity -cne $identity -or
        $rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow -or
        (($rule.FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -ne [Security.AccessControl.FileSystemRights]::FullControl) -or
        $rule.IsInherited) {
        throw 'Protected environment file ACL rule is not the exact current-user full-control rule'
    }
}

function Read-ExactEnvironmentFile([string]$Path, [string[]]$ExpectedKeys) {
    Assert-PrivateFileAcl $Path
    $values = [Collections.Generic.Dictionary[string,string]]::new([StringComparer]::Ordinal)
    foreach ($line in @(Get-Content -LiteralPath $Path)) {
        if ($line -notmatch '^([A-Z][A-Z0-9_]*)=(.*)$') { throw 'Protected environment file contains a malformed entry' }
        if (-not $values.TryAdd($Matches[1], $Matches[2])) { throw 'Protected environment file contains a duplicate key' }
    }
    $expected = @($ExpectedKeys | Sort-Object)
    $actual = @($values.Keys | Sort-Object)
    if (($actual -join "`n") -cne ($expected -join "`n")) { throw 'Protected environment file key set has changed' }
    return ,$values
}

function Assert-ExactValue([Collections.Generic.Dictionary[string,string]]$Values, [string]$Key, [string]$Expected) {
    if ($Values[$Key] -cne $Expected) { throw "Protected runtime setting $Key has changed" }
}

function Get-DatabaseUrlPassword(
    [string]$Value,
    [string]$ExpectedRole,
    [string]$ExpectedDatabase
) {
    $escapedRole = [Regex]::Escape($ExpectedRole)
    $escapedDatabase = [Regex]::Escape($ExpectedDatabase)
    if ($Value -notmatch "^postgres://$escapedRole`:(?<password>[^@\r\n]+)@127\.0\.0\.1:55503/$escapedDatabase$") {
        throw 'Protected database URL identity has changed'
    }
    return $Matches['password']
}

function Assert-ApplicationPortAvailable([object[]]$Listeners) {
    if ($Listeners.Count -ne 0) { throw 'Port3000 already has a listener; refusing replacement or termination' }
}

function Normalize-CommandLine([string]$Value) {
    return (($Value.Replace('\', '/').Replace('"', '') -replace '\s+', ' ').Trim()).ToLowerInvariant()
}

function ConvertTo-UtcDateTime([object]$Value) {
    if ($Value -is [DateTimeOffset]) { return ([DateTimeOffset]$Value).UtcDateTime }
    if ($Value -is [DateTime]) { return ([DateTime]$Value).ToUniversalTime() }
    if ($Value -isnot [string] -or [string]::IsNullOrWhiteSpace([string]$Value)) {
        throw 'Runtime status timestamp is invalid'
    }
    try {
        return [DateTimeOffset]::ParseExact(
            [string]$Value,
            'o',
            [Globalization.CultureInfo]::InvariantCulture,
            [Globalization.DateTimeStyles]::RoundtripKind
        ).UtcDateTime
    } catch { throw 'Runtime status timestamp is invalid' }
}

function Select-OwnedSupervisorBunChildRecord(
    [object[]]$Records,
    [int]$SupervisorPid,
    [DateTime]$SupervisorStartedUtc,
    [string]$ExpectedCommand
) {
    $matching = @($Records | Where-Object {
        [int]$_.ParentProcessId -eq $SupervisorPid -and [int]$_.ProcessId -gt 0 -and
        $null -ne $_.ExecutablePath -and
        [IO.Path]::GetFullPath([string]$_.ExecutablePath) -ieq [IO.Path]::GetFullPath($bunPath) -and
        $null -ne $_.CommandLine -and
        (Normalize-CommandLine ([string]$_.CommandLine)) -ceq (Normalize-CommandLine $ExpectedCommand) -and
        (ConvertTo-UtcDateTime $_.CreationDate) -ge $SupervisorStartedUtc
    })
    if ($matching.Count -gt 1) { throw 'Bounded supervisor has ambiguous exact Bun children' }
    if ($matching.Count -eq 1) {
        return $matching[0]
    }

    return $null
}

function Find-OwnedSupervisorBunChild([Diagnostics.Process]$Supervisor) {
    $expectedCommand = "$bunPath --env-file=$appEnvironmentPath src/server.ts"
    $records = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $($Supervisor.Id)")
    $record = Select-OwnedSupervisorBunChildRecord $records $Supervisor.Id $Supervisor.StartTime.ToUniversalTime() $expectedCommand
    if ($null -eq $record) { return $null }
    $process = Get-Process -Id ([int]$record.ProcessId) -ErrorAction Stop
    if ($process.Id -ne [int]$record.ProcessId -or
        [IO.Path]::GetFullPath($process.Path) -ine [IO.Path]::GetFullPath($bunPath) -or
        $process.StartTime.ToUniversalTime() -lt $Supervisor.StartTime.ToUniversalTime()) {
        throw 'Bounded supervisor Bun child process identity changed'
    }
    return $process
}

function Assert-PostmasterPidIdentity([string[]]$Lines, [int]$ExpectedPid) {
    if ($Lines.Count -lt 8 -or [int]$Lines[0] -ne $ExpectedPid -or
        [IO.Path]::GetFullPath($Lines[1]) -ine [IO.Path]::GetFullPath($clusterRoot) -or
        $Lines[3] -cne '55503' -or $Lines[5] -cne '127.0.0.1' -or $Lines[7].Trim() -cne 'ready') {
        throw 'PostgreSQL55503 PID file does not identify the admitted ready cluster'
    }
}

function Assert-RetainedPostgresListener {
    if ((Get-Content -LiteralPath (Join-Path $clusterRoot 'PG_VERSION') -Raw).Trim() -cne '16') {
        throw 'Retained PostgreSQL cluster is not PG_VERSION16'
    }
    $expectedOptions = "$postgresPath `"-D`" `"$clusterRoot`" `"-p`" `"55503`" `"-h`" `"127.0.0.1`" `"-c`" `"max_connections=200`" `"-c`" `"shared_buffers=32MB`" `"-c`" `"max_wal_size=128MB`" `"-c`" `"min_wal_size=32MB`" `"-c`" `"shared_preload_libraries=pg_stat_statements`""
    $recordedOptions = (Get-Content -LiteralPath (Join-Path $clusterRoot 'postmaster.opts') -Raw).Trim()
    if ((Normalize-CommandLine $recordedOptions) -cne (Normalize-CommandLine $expectedOptions)) {
        throw 'Retained PostgreSQL startup options differ from the admitted loopback cluster'
    }
    $listeners = @(Get-NetTCPConnection -LocalPort $postgresPort -State Listen -ErrorAction SilentlyContinue)
    if ($listeners.Count -eq 0) { throw 'Retained PostgreSQL55503 is not running; start only the admitted cluster before resume' }
    if (@($listeners | Where-Object { $_.LocalAddress -notin @('127.0.0.1', '::1') }).Count -ne 0) {
        throw 'PostgreSQL55503 has a non-loopback listener'
    }
    $listenerPids = @($listeners | Select-Object -ExpandProperty OwningProcess -Unique)
    if ($listenerPids.Count -ne 1) { throw 'PostgreSQL55503 listener ownership is ambiguous' }
    $postgresPid = [int]$listenerPids[0]
    $process = Get-Process -Id $postgresPid -ErrorAction Stop
    if ([IO.Path]::GetFullPath($process.Path) -ine [IO.Path]::GetFullPath($postgresPath)) {
        throw 'PostgreSQL55503 listener belongs to a different executable'
    }
    $pidLines = @(Get-Content -LiteralPath (Join-Path $clusterRoot 'postmaster.pid'))
    Assert-PostmasterPidIdentity $pidLines $postgresPid
    $processRecord = Get-CimInstance Win32_Process -Filter "ProcessId = $postgresPid"
    if ($null -eq $processRecord -or (Normalize-CommandLine $processRecord.CommandLine) -cne (Normalize-CommandLine $recordedOptions)) {
        throw 'PostgreSQL55503 process command line differs from its admitted recorded options'
    }
    $reportedVersion = @(& $postgresPath --version 2>$null)
    if ($LASTEXITCODE -ne 0 -or ($reportedVersion -join '').Trim() -cne 'postgres (PostgreSQL) 16.15') {
        throw 'Retained PostgreSQL binary is not version16.15'
    }
    return $postgresPid
}

function Invoke-ReadOnlyPsql([string]$Password, [string]$Sql) {
    $priorPassword = $env:PGPASSWORD
    $priorOptions = $env:PGOPTIONS
    $priorTimeout = $env:PGCONNECT_TIMEOUT
    try {
        $env:PGPASSWORD = $Password
        $env:PGOPTIONS = '-c default_transaction_read_only=on'
        $env:PGCONNECT_TIMEOUT = '5'
        $output = @(& $psqlPath -h 127.0.0.1 -p $postgresPort -U yellow_deploy -d $reviewDatabase -X -A -t -q -F '|' -v ON_ERROR_STOP=1 -c $Sql 2>$null)
        if ($LASTEXITCODE -ne 0) { throw 'Read-only PostgreSQL identity check failed' }
        return @($output | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    } finally {
        $env:PGPASSWORD = $priorPassword
        $env:PGOPTIONS = $priorOptions
        $env:PGCONNECT_TIMEOUT = $priorTimeout
    }
}

function Assert-ReviewDatabaseIdentity([string]$DeployPassword) {
    $identitySql = @'
BEGIN TRANSACTION READ ONLY;
SELECT current_database(), current_setting('server_version_num'),
       (SELECT count(*) FROM public.schema_migration),
       (SELECT max(version) FROM public.schema_migration),
       (SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname = 'public'),
       (SELECT count(*) FROM public.tenant WHERE slug = 'yellow-demo'),
       (SELECT count(*) FROM public.app_user WHERE email = 'operator@yellow.local');
COMMIT;
'@
    $identity = @(Invoke-ReadOnlyPsql $DeployPassword $identitySql)
    if ($identity.Count -ne 1 -or $identity[0] -cne 'yellow_order442_review|160015|77|77|127|1|1') {
        throw 'Existing review database is not the exact synthetic main77 identity'
    }
    $ledgerSql = @'
BEGIN TRANSACTION READ ONLY;
SELECT version, filename, btrim(checksum_sha256) FROM public.schema_migration ORDER BY version;
COMMIT;
'@
    $ledgerLines = @(Invoke-ReadOnlyPsql $DeployPassword $ledgerSql)
    $migrationFiles = @(Get-ChildItem -LiteralPath (Join-Path $appRoot 'migrations') -File -Filter '*.sql' | Sort-Object Name)
    if ($ledgerLines.Count -ne 77 -or $migrationFiles.Count -ne 77) {
        throw 'Migration ledger or exact source does not contain77 entries'
    }
    for ($index = 0; $index -lt 77; $index++) {
        $line = $ledgerLines[$index]
        if ($line -notmatch '^(\d+)\|([^|]+)\|([0-9a-f]{64})$') { throw 'Migration ledger row is malformed' }
        $version = [int]$Matches[1]
        $filename = $Matches[2]
        $checksum = $Matches[3]
        $file = $migrationFiles[$index]
        if ($version -ne ($index + 1) -or $filename -cne $file.Name -or $checksum -cne (Get-Sha256Hex $file.FullName)) {
            throw 'Actual migration ledger differs from the exact merged-main source'
        }
    }
    $ledgerDigestBytes = [Text.Encoding]::UTF8.GetBytes(($ledgerLines -join "`n") + "`n")
    $stream = [IO.MemoryStream]::new($ledgerDigestBytes, $false)
    try { return Get-StreamSha256Hex $stream }
    finally { $stream.Dispose() }
}

function New-PrivateEmptyFile([string]$Path) {
    $stream = [IO.File]::Open($Path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
    $stream.Dispose()
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    $acl = Get-Acl -LiteralPath $Path
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($rule in @($acl.Access)) { [void]$acl.RemoveAccessRuleAll($rule) }
    $acl.SetOwner([Security.Principal.NTAccount]::new($identity))
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity, 'FullControl', 'Allow'))
    Set-Acl -LiteralPath $Path -AclObject $acl
}

function Invoke-WithSanitizedRuntimeEnvironment([scriptblock]$Launch) {
    $preserved = [Collections.Generic.Dictionary[string,string]]::new([StringComparer]::OrdinalIgnoreCase)
    $names = @(
        Get-ChildItem Env: | Where-Object {
            $_.Name -match '^(?i:YELLOW_)' -or
            $_.Name -in @('HOST', 'PORT', 'NODE_ENV', 'TEMP', 'TMP') -or
            $_.Name -match '^(?i:PG[A-Z0-9_]*)$'
        } | Select-Object -ExpandProperty Name -Unique
    )
    foreach ($name in $names) {
        $preserved[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
    }
    try {
        foreach ($name in $names) { Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue }
        [Environment]::SetEnvironmentVariable('TEMP', 'D:\Yellow\temp', 'Process')
        [Environment]::SetEnvironmentVariable('TMP', 'D:\Yellow\temp', 'Process')
        return & $Launch
    } finally {
        Remove-Item -LiteralPath 'Env:TEMP' -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath 'Env:TMP' -ErrorAction SilentlyContinue
        foreach ($entry in $preserved.GetEnumerator()) {
            [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process')
        }
    }
}

Assert-ApplicationPortAvailable @(Get-NetTCPConnection -LocalPort $appPort -State Listen -ErrorAction SilentlyContinue)

if (-not (Test-Path -LiteralPath $initialReceiptPath -PathType Leaf)) { throw 'Initial Order442 receipt is missing' }
$initialReceipt = Get-Content -LiteralPath $initialReceiptPath -Raw | ConvertFrom-Json
if ($initialReceipt.source -cne $revision -or
    $initialReceipt.sourceArchiveSha256 -cne $archiveSha256 -or
    [int]$initialReceipt.port -ne $appPort -or [int]$initialReceipt.postgresPort -ne $postgresPort -or
    $initialReceipt.database -cne $reviewDatabase -or $initialReceipt.referee -cne '11/11' -or
    $initialReceipt.loginVerified -ne $true -or $initialReceipt.usesWsl -ne $false -or $initialReceipt.usesDocker -ne $false -or
    $initialReceipt.ready.status -cne 'ready' -or $initialReceipt.ready.target -cne 'yellow_runtime_database' -or
    $initialReceipt.ready.build.revision -cne $revision -or [int]$initialReceipt.ready.build.expectedMigrationFrontier -ne 77) {
    throw 'Initial Order442 receipt identity has changed'
}

Assert-SourceArchiveIdentity $archivePath $appRoot $archiveSha256

$appKeys = @(
    'NODE_ENV', 'HOST', 'PORT', 'YELLOW_BUILD_SHA', 'YELLOW_OPERATOR_WORKBENCH',
    'YELLOW_LOCAL_REVIEW_PREFILL', 'YELLOW_LOCAL_REVIEW_TENANT', 'YELLOW_LOCAL_REVIEW_EMAIL',
    'YELLOW_LOCAL_REVIEW_PASSWORD', 'YELLOW_TOKEN_SECRET', 'YELLOW_RUNTIME_DATABASE_URL',
    'YELLOW_EXTENSION_REGISTRAR_DATABASE_URL', 'YELLOW_HOLD_EXPIRY_WORKER',
    'YELLOW_AVAILABILITY_PROJECTION_WORKER', 'YELLOW_PICKUP_TASK_WORKER',
    'YELLOW_RESERVATION_ARRIVAL_ROLL_WORKER', 'YELLOW_RESERVATION_DEPARTURE_ROLL_WORKER',
    'YELLOW_BUSINESS_DAY_ROLL_WORKER'
)
$seedKeys = @('YELLOW_DEPLOY_DATABASE_URL', 'YELLOW_REVIEW_PASSWORD', 'YELLOW_REVIEW_APPROVER_PASSWORD')
$appEnvironment = Read-ExactEnvironmentFile $appEnvironmentPath $appKeys
$seedEnvironment = Read-ExactEnvironmentFile $seedEnvironmentPath $seedKeys

foreach ($setting in @{
    NODE_ENV = 'production'; HOST = '127.0.0.1'; PORT = '3000'; YELLOW_BUILD_SHA = $revision;
    YELLOW_OPERATOR_WORKBENCH = '1'; YELLOW_LOCAL_REVIEW_PREFILL = '1';
    YELLOW_LOCAL_REVIEW_TENANT = 'yellow-demo'; YELLOW_LOCAL_REVIEW_EMAIL = 'operator@yellow.local';
    YELLOW_HOLD_EXPIRY_WORKER = '1'; YELLOW_AVAILABILITY_PROJECTION_WORKER = '1';
    YELLOW_PICKUP_TASK_WORKER = '1'; YELLOW_RESERVATION_ARRIVAL_ROLL_WORKER = '1';
    YELLOW_RESERVATION_DEPARTURE_ROLL_WORKER = '1'; YELLOW_BUSINESS_DAY_ROLL_WORKER = '1'
}.GetEnumerator()) { Assert-ExactValue $appEnvironment $setting.Key $setting.Value }

foreach ($secretKey in @('YELLOW_LOCAL_REVIEW_PASSWORD', 'YELLOW_TOKEN_SECRET')) {
    if ($appEnvironment[$secretKey] -cnotmatch '^[0-9a-f]{64}$') { throw 'Protected runtime secret identity is malformed' }
}
foreach ($secretKey in @('YELLOW_REVIEW_PASSWORD', 'YELLOW_REVIEW_APPROVER_PASSWORD')) {
    if ($seedEnvironment[$secretKey] -cnotmatch '^[0-9a-f]{64}$') { throw 'Protected seed secret identity is malformed' }
}
if ($seedEnvironment['YELLOW_REVIEW_PASSWORD'] -cne $appEnvironment['YELLOW_LOCAL_REVIEW_PASSWORD'] -or
    $seedEnvironment['YELLOW_REVIEW_PASSWORD'] -ceq $seedEnvironment['YELLOW_REVIEW_APPROVER_PASSWORD']) {
    throw 'Protected review credential identities are inconsistent'
}

$runtimeDatabasePassword = Get-DatabaseUrlPassword $appEnvironment['YELLOW_RUNTIME_DATABASE_URL'] 'yellow_runtime' $reviewDatabase
$registrarDatabasePassword = Get-DatabaseUrlPassword $appEnvironment['YELLOW_EXTENSION_REGISTRAR_DATABASE_URL'] 'yellow_extension_registrar' $reviewDatabase
$deployDatabasePassword = Get-DatabaseUrlPassword $seedEnvironment['YELLOW_DEPLOY_DATABASE_URL'] 'yellow_deploy' $reviewDatabase
if ($runtimeDatabasePassword -cne $registrarDatabasePassword -or $runtimeDatabasePassword -cne $deployDatabasePassword) {
    throw 'Protected database credential identities are inconsistent'
}

$junction = Get-Item -LiteralPath (Join-Path $appRoot 'node_modules') -Force
if (-not $junction.PSIsContainer -or $junction.LinkType -cne 'Junction' -or
    -not ($junction.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    throw 'Extracted source dependency path is not the admitted junction'
}
$junctionTargets = @($junction.Target)
if ($junctionTargets.Count -ne 1 -or
    [IO.Path]::GetFullPath($junctionTargets[0]) -ine [IO.Path]::GetFullPath([string]$initialReceipt.dependencyJunction)) {
    throw 'Dependency junction target differs from the initial receipt'
}
$dependencyRoot = Split-Path ([IO.Path]::GetFullPath($junctionTargets[0])) -Parent
foreach ($identityFile in @('package.json', 'bun.lock', 'bunfig.toml')) {
    $extractedIdentity = Join-Path $appRoot $identityFile
    $dependencyIdentity = Join-Path $dependencyRoot $identityFile
    if ((Get-Sha256Hex $extractedIdentity) -cne (Get-Sha256Hex $dependencyIdentity)) {
        throw 'Dependency root package or lock identity differs from merged main'
    }
}
if ([IO.Path]::GetFullPath($bunPath) -ine [IO.Path]::GetFullPath((Get-Command $bunPath -ErrorAction Stop).Source) -or
    (@(& $bunPath --version 2>$null) -join '').Trim() -cne '1.3.14') {
    throw 'Native Bun identity is not the locked1.3.14 executable'
}

$postgresPid = Assert-RetainedPostgresListener
$migrationLedgerSha256 = Assert-ReviewDatabaseIdentity $deployDatabasePassword

$existingResumeReceipts = @(Get-ChildItem -LiteralPath $controlRoot -File -Filter 'resume-receipt-*.json')
if ($existingResumeReceipts.Count -ge $maximumResumeAttempts) {
    throw 'Bounded native resume artifact limit reached; refusing another launch'
}
if (-not (Test-Path -LiteralPath $boundedSupervisorPath -PathType Leaf)) {
    throw 'Admitted bounded native supervisor is missing'
}

$stamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')
$resumeReceiptPath = Join-Path $controlRoot "resume-receipt-$stamp.json"
$supervisorStatusPath = Join-Path $controlRoot 'supervisor.status.json'
$supervisorStdoutPath = Join-Path $controlRoot 'supervisor.stdout.0.log'
$supervisorStderrPath = Join-Path $controlRoot 'supervisor.stderr.0.log'
$powerShellPath = [Diagnostics.Process]::GetCurrentProcess().MainModule.FileName
if ([IO.Path]::GetFileName($powerShellPath) -ine 'pwsh.exe') { throw 'Native resume requires PowerShell7' }

$supervisorProcess = $null
$launchedProcess = $null
$launchAccepted = $false
try {
    $supervisorProcess = Invoke-WithSanitizedRuntimeEnvironment {
        Start-Process -FilePath $powerShellPath -ArgumentList @(
            '-NoLogo', '-NoProfile', '-NonInteractive', '-File', $boundedSupervisorPath
        ) -WorkingDirectory (Split-Path $PSScriptRoot -Parent) -WindowStyle Hidden -PassThru
    }

    $supervisorStatus = $null
    for ($attempt = 1; $attempt -le 30; $attempt++) {
        try {
            if ($null -eq $launchedProcess) {
                $launchedProcess = Find-OwnedSupervisorBunChild $supervisorProcess
            }
            if (Test-Path -LiteralPath $supervisorStatusPath -PathType Leaf) {
                $candidateStatus = Get-Content -LiteralPath $supervisorStatusPath -Raw | ConvertFrom-Json
                $candidateSupervisorStarted = ConvertTo-UtcDateTime $candidateStatus.supervisorStartedUtc
                $candidateChildStarted = ConvertTo-UtcDateTime $candidateStatus.childStartedUtc
                if ($candidateStatus.schema -ceq 'yellow-native-review-bounded/v1' -and
                    $candidateStatus.mode -ceq 'order442-preview' -and [int]$candidateStatus.launchCount -eq 1 -and
                    $candidateStatus.reason -ceq 'running' -and $null -ne $candidateStatus.childPid -and
                    $null -ne $launchedProcess -and [int]$candidateStatus.childPid -eq $launchedProcess.Id -and
                    $candidateChildStarted.Ticks -eq $launchedProcess.StartTime.ToUniversalTime().Ticks -and
                    [long]$candidateStatus.perFileByteLimit -eq 5242880 -and
                    [int]$candidateStatus.retainedFilesPerStream -eq 3 -and
                    [long]$candidateStatus.runtimeMinimumFreeBytes -eq 1073741824 -and
                    [long]$candidateStatus.systemMinimumFreeBytes -eq 536870912 -and
                    [long]$candidateStatus.runtimeCriticalFreeBytes -eq 1073741824 -and
                    [long]$candidateStatus.systemCriticalFreeBytes -eq 536870912 -and
                    $candidateSupervisorStarted -ge $supervisorProcess.StartTime.ToUniversalTime().AddSeconds(-2)) {
                    $supervisorStatus = $candidateStatus
                    break
                }
            }
        } catch { $supervisorStatus = $null }
        $supervisorProcess.Refresh()
        if ($supervisorProcess.HasExited) { throw 'Bounded native supervisor exited before Bun launch; inspect its private status' }
        Start-Sleep -Milliseconds 250
    }
    if ($null -eq $supervisorStatus) { throw 'Bounded native supervisor did not record one Bun launch' }
    if ($null -eq $launchedProcess -or
        [IO.Path]::GetFullPath($launchedProcess.Path) -ine [IO.Path]::GetFullPath($bunPath)) {
        throw 'Bounded supervisor child is not the exact native Bun process'
    }
    $bunRecord = Get-CimInstance Win32_Process -Filter "ProcessId = $($launchedProcess.Id)"
    $expectedBunCommand = "$bunPath --env-file=$appEnvironmentPath src/server.ts"
    if ($null -eq $bunRecord -or (Normalize-CommandLine $bunRecord.CommandLine) -cne (Normalize-CommandLine $expectedBunCommand)) {
        throw 'Bounded supervisor child command differs from the admitted app/environment identity'
    }
    $ready = $null
    for ($attempt = 1; $attempt -le 30; $attempt++) {
        try {
            $ready = Invoke-RestMethod "http://127.0.0.1:$appPort/ready" -TimeoutSec 2
            if ($ready.status -eq 'ready') { break }
        } catch { $ready = $null }
        $launchedProcess.Refresh()
        if ($launchedProcess.HasExited) { throw 'Native Bun exited before readiness; inspect the private resume error log' }
        $supervisorProcess.Refresh()
        if ($supervisorProcess.HasExited) { throw 'Bounded native supervisor exited before readiness' }
        Start-Sleep -Milliseconds 500
    }
    if ($null -eq $ready -or $ready.status -cne 'ready' -or $ready.target -cne 'yellow_runtime_database' -or
        $ready.build.revision -cne $revision -or [int]$ready.build.expectedMigrationFrontier -ne 77) {
        throw 'Exact merged-main77 readiness verification failed'
    }
    $appListeners = @(Get-NetTCPConnection -LocalPort $appPort -State Listen -ErrorAction Stop)
    $appListenerPids = @($appListeners | Select-Object -ExpandProperty OwningProcess -Unique)
    if ($appListeners.Count -eq 0 -or $appListenerPids.Count -ne 1 -or [int]$appListenerPids[0] -ne $launchedProcess.Id -or
        @($appListeners | Where-Object { $_.LocalAddress -notin @('127.0.0.1', '::1') }).Count -ne 0) {
        throw 'Port3000 listener is not the exact launched loopback Bun process'
    }

    try { $prefillResponse = Invoke-WebRequest "http://127.0.0.1:$appPort/" -TimeoutSec 5 }
    catch { throw 'Synthetic login prefill request failed' }
    $reviewPassword = $appEnvironment['YELLOW_LOCAL_REVIEW_PASSWORD']
    if ($prefillResponse.StatusCode -ne 200 -or $prefillResponse.Headers['Cache-Control'] -notcontains 'no-store' -or
        $prefillResponse.Content -notlike '*data-local-default="yellow-demo"*' -or
        $prefillResponse.Content -notlike '*data-local-default="operator@yellow.local"*' -or
        $prefillResponse.Content -notlike "*data-local-default=`"$reviewPassword`"*") {
        throw 'Synthetic login prefill identity verification failed'
    }
    try {
        $login = Invoke-RestMethod "http://127.0.0.1:$appPort/api/v1/auth/local:login" -Method Post -ContentType 'application/json' -Body (@{
            tenant = 'yellow-demo'; email = 'operator@yellow.local'; password = $reviewPassword
        } | ConvertTo-Json -Compress) -TimeoutSec 10
    } catch { throw 'Synthetic review authentication request failed' }
    if ($login.tokenType -cne 'Bearer' -or $login.accessToken -isnot [string] -or $login.accessToken.Length -lt 32) {
        throw 'Synthetic review authentication identity failed'
    }

    $receipt = [ordered]@{
        receiptType = 'order442-native-resume-v1'
        resumedFromReceiptSha256 = Get-Sha256Hex $initialReceiptPath
        source = $revision
        sourceArchiveSha256 = $archiveSha256
        extractedSourceVerified = $true
        dependencyJunction = [string]$initialReceipt.dependencyJunction
        bunVersion = '1.3.14'
        postgresVersionNum = '160015'
        postgresPort = $postgresPort
        postgresPid = $postgresPid
        database = $reviewDatabase
        migrationFrontier = 77
        migrationLedgerSha256 = $migrationLedgerSha256
        port = $appPort
        pid = $launchedProcess.Id
        supervisorPid = $supervisorProcess.Id
        startedUtc = $launchedProcess.StartTime.ToUniversalTime().ToString('o')
        ready = $ready
        prefillVerified = $true
        loginVerified = $true
        credentialsReused = $true
        usesWsl = $false
        usesDocker = $false
        stdoutLog = [IO.Path]::GetFileName($supervisorStdoutPath)
        stderrLog = [IO.Path]::GetFileName($supervisorStderrPath)
        logByteLimitPerFile = 5242880
        retainedLogFilesPerStream = 3
        automaticRestart = $false
    }
    $receiptJson = $receipt | ConvertTo-Json -Depth 8
    New-PrivateEmptyFile $resumeReceiptPath
    [IO.File]::WriteAllText($resumeReceiptPath, $receiptJson, [Text.UTF8Encoding]::new($false))
    Assert-PrivateFileAcl $resumeReceiptPath
    $launchAccepted = $true
    [pscustomobject]@{
        Url = "http://127.0.0.1:$appPort"
        Revision = $revision
        MigrationFrontier = 77
        Pid = $launchedProcess.Id
        Database = $reviewDatabase
        LoginVerified = $true
        CredentialsPrefilled = $true
        ResumeReceipt = $resumeReceiptPath
    }
} finally {
    if (-not $launchAccepted -and $null -eq $launchedProcess -and $null -ne $supervisorProcess) {
        try { $launchedProcess = Find-OwnedSupervisorBunChild $supervisorProcess } catch { $launchedProcess = $null }
    }
    if (-not $launchAccepted -and $null -ne $launchedProcess) {
        $launchedProcess.Refresh()
        if (-not $launchedProcess.HasExited) {
            Stop-Process -Id $launchedProcess.Id -Force -ErrorAction SilentlyContinue
        }
    }
    if (-not $launchAccepted -and $null -ne $supervisorProcess) {
        $supervisorProcess.Refresh()
        if (-not $supervisorProcess.HasExited -and -not $supervisorProcess.WaitForExit(10000)) {
            Stop-Process -Id $supervisorProcess.Id -Force -ErrorAction SilentlyContinue
        }
    }
    $runtimeDatabasePassword = $null
    $registrarDatabasePassword = $null
    $deployDatabasePassword = $null
    $appEnvironment = $null
    $seedEnvironment = $null
}
