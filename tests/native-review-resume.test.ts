import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dir, "..");
const helperPath = join(repositoryRoot, "scripts", "resume-merged-native-review.ps1");
let fixtureRoot = "";

function resolvePowerShell() {
  const bundled = process.env.USERPROFILE === undefined ? undefined : join(
    process.env.USERPROFILE,
    ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "native", "powershell", "pwsh.exe",
  );
  return Bun.which("pwsh") ?? (bundled !== undefined && existsSync(bundled) ? bundled : "pwsh");
}

function runPowerShell(scriptPath: string) {
  return Bun.spawnSync({
    cmd: [resolvePowerShell(), "-NoLogo", "-NoProfile", "-NonInteractive", "-File", scriptPath],
    cwd: repositoryRoot,
    env: { ...process.env },
    stdout: "pipe",
    stderr: "pipe",
  });
}

beforeAll(async () => { fixtureRoot = await mkdtemp(join(tmpdir(), "yellow-native-resume-")); });
afterAll(async () => { if (fixtureRoot !== "") await rm(fixtureRoot, { recursive: true, force: true }); });

describe("Order442/Q200 native reboot resume", () => {
  test("PowerShell parses and its command AST keeps resumption non-destructive", async () => {
    const probe = join(fixtureRoot, "ast-proof.ps1");
    await writeFile(probe, String.raw`
$ErrorActionPreference = 'Stop'
$tokens = $null
$errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile('${helperPath.replaceAll("'", "''")}', [ref]$tokens, [ref]$errors)
if ($errors.Count -ne 0) { throw ($errors | ForEach-Object Message | Out-String) }
$commands = @($ast.FindAll({ param($node) $node -is [Management.Automation.Language.CommandAst] }, $true))
$names = @($commands | ForEach-Object GetCommandName | Where-Object { $null -ne $_ })
$forbidden = @('Remove-Process','Restart-Process','Stop-Service','Restart-Service','Start-Service','Invoke-Expression','pg_ctl','initdb','createdb','dropdb')
foreach ($name in $forbidden) { if ($names -contains $name) { throw "forbidden command: $name" } }
$environmentRemovals = @($commands | Where-Object { $_.GetCommandName() -eq 'Remove-Item' })
if ($environmentRemovals.Count -ne 3 -or @($environmentRemovals | Where-Object { $_.Extent.Text -notmatch '^Remove-Item -LiteralPath (?:"Env:\$name"|''Env:TEMP''|''Env:TMP'') -ErrorAction SilentlyContinue$' }).Count -ne 0) {
  throw 'Remove-Item may only sanitize and restore the current process environment'
}
$starts = @($commands | Where-Object { $_.GetCommandName() -eq 'Start-Process' })
if ($starts.Count -ne 1) { throw 'expected exactly one Start-Process command' }
$startText = $starts[0].Extent.Text
foreach ($required in @('-FilePath $powerShellPath','-WindowStyle Hidden','-PassThru')) {
  if (-not $startText.Contains($required)) { throw "missing safe start option: $required" }
}
if ($startText -match '(?i)-Wait\b') { throw 'long-lived supervisor start must not wait on descendants' }
$stops = @($commands | Where-Object { $_.GetCommandName() -eq 'Stop-Process' })
if ($stops.Count -ne 2 -or
    @($stops | Where-Object { $_.Extent.Text -cne 'Stop-Process -Id $launchedProcess.Id -Force -ErrorAction SilentlyContinue' -and $_.Extent.Text -cne 'Stop-Process -Id $supervisorProcess.Id -Force -ErrorAction SilentlyContinue' }).Count -ne 0) {
  throw 'only exact owned Bun/supervisor failure cleanup is allowed'
}
$source = $ast.Extent.Text
$listenerOffset = $source.IndexOf('Assert-ApplicationPortAvailable @(')
$startOffset = $starts[0].Extent.StartOffset
if ($listenerOffset -lt 0 -or $listenerOffset -ge $startOffset) { throw 'port refusal must precede Bun launch' }
if ($source -match '(?im)^\s*(?:&\s*)?[^#\r\n]*(?:scripts[/\\](?:migrate|seed)|start-merged-native-review|CREATE\s+DATABASE|DROP\s+DATABASE|ALTER\s+ROLE)') {
  throw 'resume helper contains a provisioning, migration, seed, or role mutation path'
}
$psqlFunctions = @($ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Invoke-ReadOnlyPsql' }, $true))
if ($psqlFunctions.Count -ne 1 -or $psqlFunctions[0].Extent.Text -notmatch 'default_transaction_read_only=on') {
  throw 'database checks are not forced read-only'
}
$databaseFunctions = @($ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Assert-ReviewDatabaseIdentity' }, $true))
if ($databaseFunctions.Count -ne 1) { throw 'database identity function missing' }
$sqlLiterals = @($databaseFunctions[0].FindAll({
  param($node)
  $node -is [Management.Automation.Language.StringConstantExpressionAst] -and $node.Extent.Text -match 'BEGIN TRANSACTION READ ONLY'
}, $true))
if ($sqlLiterals.Count -ne 2 -or @($sqlLiterals | Where-Object { $_.Value -match '(?i)\b(INSERT|UPDATE|DELETE|TRUNCATE|CREATE|DROP|ALTER|GRANT|REVOKE|CALL)\b' }).Count -ne 0) {
  throw 'database proof contains a non-read-only SQL statement'
}
$initialReceiptWrites = @($ast.FindAll({
  param($node)
  $node -is [Management.Automation.Language.CommandAst] -and
    $node.Extent.Text -match '(?i)(Set-Content|Add-Content|Out-File|WriteAllText).*initialReceiptPath'
}, $true))
if ($initialReceiptWrites.Count -ne 0) { throw 'initial receipt must remain read-only' }
if ($source -match 'WriteAllText\(\$initialReceiptPath') { throw 'initial receipt must never be rewritten' }
`, "utf8");
    const result = runPowerShell(probe);
    expect(result.exitCode, result.stderr.toString()).toBe(0);
  });

  test("listener refusal is executable and does not terminate the supplied owner", async () => {
    const probe = join(fixtureRoot, "listener-proof.ps1");
    await writeFile(probe, String.raw`
$ErrorActionPreference = 'Stop'
$tokens = $null
$errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile('${helperPath.replaceAll("'", "''")}', [ref]$tokens, [ref]$errors)
if ($errors.Count -ne 0) { throw 'helper parse failed' }
$function = @($ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Assert-ApplicationPortAvailable' }, $true))
if ($function.Count -ne 1) { throw 'listener guard missing' }
Invoke-Expression $function[0].Extent.Text
Assert-ApplicationPortAvailable @()
$owner = [pscustomobject]@{ OwningProcess = 6396; LocalAddress = '127.0.0.1' }
$refused = $false
try { Assert-ApplicationPortAvailable @($owner) } catch { $refused = $true }
if (-not $refused -or $owner.OwningProcess -ne 6396) { throw 'existing listener was not safely refused' }
`, "utf8");
    const result = runPowerShell(probe);
    expect(result.exitCode, result.stderr.toString()).toBe(0);
  });

  test("postmaster identity accepts only fixed-width ready padding and rejects every changed binding", async () => {
    const probe = join(fixtureRoot, "postmaster-pid-proof.ps1");
    await writeFile(probe, String.raw`
$ErrorActionPreference = 'Stop'
$tokens = $null
$errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile('${helperPath.replaceAll("'", "''")}', [ref]$tokens, [ref]$errors)
if ($errors.Count -ne 0) { throw 'helper parse failed' }
$function = @($ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Assert-PostmasterPidIdentity' }, $true))
if ($function.Count -ne 1) { throw 'postmaster PID identity guard missing' }
Invoke-Expression $function[0].Extent.Text
$clusterRoot = 'D:\Yellow\temp\order434-production-cluster-20260906'
$expectedPid = 15956
$exact = @('15956', $clusterRoot, '1788687960', '55503', '', '127.0.0.1', '0', 'ready   ')
Assert-PostmasterPidIdentity $exact $expectedPid
foreach ($changed in @(
  @('15957', $clusterRoot, '1788687960', '55503', '', '127.0.0.1', '0', 'ready   '),
  @('15956', 'D:\Yellow\temp\wrong-cluster', '1788687960', '55503', '', '127.0.0.1', '0', 'ready   '),
  @('15956', $clusterRoot, '1788687960', '55513', '', '127.0.0.1', '0', 'ready   '),
  @('15956', $clusterRoot, '1788687960', '55503', '', '0.0.0.0', '0', 'ready   '),
  @('15956', $clusterRoot, '1788687960', '55503', '', '127.0.0.1', '0', 'starting'),
  @('15956', $clusterRoot, '1788687960', '55503', '', '127.0.0.1', '0', 'stale   ')
)) {
  $refused = $false
  try { Assert-PostmasterPidIdentity $changed $expectedPid } catch { $refused = $true }
  if (-not $refused) { throw 'changed postmaster PID identity was accepted' }
}
`, "utf8");
    const result = runPowerShell(probe);
    expect(result.exitCode, result.stderr.toString()).toBe(0);
  });

  test("JSON timestamps normalize identically and child ownership never trusts an arbitrary status PID", async () => {
    const probe = join(fixtureRoot, "supervisor-child-proof.ps1");
    await writeFile(probe, String.raw`
$ErrorActionPreference = 'Stop'
$tokens = $null
$errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile('${helperPath.replaceAll("'", "''")}', [ref]$tokens, [ref]$errors)
if ($errors.Count -ne 0) { throw 'helper parse failed' }
foreach ($name in @('Normalize-CommandLine','ConvertTo-UtcDateTime','Select-OwnedSupervisorBunChildRecord')) {
  $definition = @($ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name }, $true))
  if ($definition.Count -ne 1) { throw "missing ownership function $name" }
  Invoke-Expression $definition[0].Extent.Text
}
$jsonTimestamp = ('{"started":"2026-09-06T06:51:34.2630000Z"}' | ConvertFrom-Json).started
$stringTimestamp = '2026-09-06T06:51:34.2630000Z'
$fromJson = ConvertTo-UtcDateTime $jsonTimestamp
$fromString = ConvertTo-UtcDateTime $stringTimestamp
if ($fromJson.Kind -ne [DateTimeKind]::Utc -or $fromString.Kind -ne [DateTimeKind]::Utc -or
    $fromJson.Ticks -ne $fromString.Ticks) { throw 'JSON DateTime and ISO string did not normalize identically' }

$bunPath = 'C:\Users\astha\.bun\bin\bun.exe'
$appEnvironmentPath = 'D:\Yellow\runtime\order442-review\app.env'
$command = "$bunPath --env-file=$appEnvironmentPath src/server.ts"
$supervisorPid = 12345
$supervisorStarted = ConvertTo-UtcDateTime '2026-09-06T06:51:34.0000000Z'
$exact = [pscustomobject]@{ ParentProcessId=$supervisorPid; ProcessId=13072; ExecutablePath=$bunPath;
  CommandLine=$command; CreationDate=(ConvertTo-UtcDateTime '2026-09-06T06:51:34.2630000Z') }
$selected = Select-OwnedSupervisorBunChildRecord @($exact) $supervisorPid $supervisorStarted $command
if ($selected.ProcessId -ne 13072) { throw 'exact owned child was not selected' }
foreach ($changed in @(
  [pscustomobject]@{ ParentProcessId=99999; ProcessId=13072; ExecutablePath=$bunPath; CommandLine=$command; CreationDate=$exact.CreationDate },
  [pscustomobject]@{ ParentProcessId=$supervisorPid; ProcessId=13072; ExecutablePath='C:\other\bun.exe'; CommandLine=$command; CreationDate=$exact.CreationDate },
  [pscustomobject]@{ ParentProcessId=$supervisorPid; ProcessId=13072; ExecutablePath=$bunPath; CommandLine="$bunPath other.ts"; CreationDate=$exact.CreationDate },
  [pscustomobject]@{ ParentProcessId=$supervisorPid; ProcessId=13072; ExecutablePath=$bunPath; CommandLine=$command; CreationDate=(ConvertTo-UtcDateTime '2026-09-06T06:51:33.9999999Z') }
)) {
  if ($null -ne (Select-OwnedSupervisorBunChildRecord @($changed) $supervisorPid $supervisorStarted $command)) {
    throw 'stale or arbitrary child identity was selected'
  }
}
$duplicateRejected = $false
try { Select-OwnedSupervisorBunChildRecord @($exact,$exact) $supervisorPid $supervisorStarted $command } catch { $duplicateRejected = $true }
if (-not $duplicateRejected) { throw 'ambiguous child identities were accepted' }
`, "utf8");
    const result = runPowerShell(probe);
    expect(result.exitCode, result.stderr.toString()).toBe(0);
  });

  test("inherited runtime overrides are absent only during child creation and parent values are restored", async () => {
    const probe = join(fixtureRoot, "environment-proof.ps1");
    await writeFile(probe, String.raw`
$ErrorActionPreference = 'Stop'
$tokens = $null
$errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile('${helperPath.replaceAll("'", "''")}', [ref]$tokens, [ref]$errors)
if ($errors.Count -ne 0) { throw 'helper parse failed' }
$function = @($ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Invoke-WithSanitizedRuntimeEnvironment' }, $true))
if ($function.Count -ne 1) { throw 'runtime environment sanitizer missing' }
Invoke-Expression $function[0].Extent.Text
$original = @{}
foreach ($name in @('YELLOW_HOSTED_PROVIDER_ONLY','YELLOW_LOCAL_REVIEW_PREFILL','HOST','PORT','NODE_ENV','PGOPTIONS','PGPASSWORD','TEMP','TMP')) {
  $original[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
try {
  $env:YELLOW_HOSTED_PROVIDER_ONLY = '1'
  $env:YELLOW_LOCAL_REVIEW_PREFILL = 'hostile-parent'
  $env:HOST = '0.0.0.0'
  $env:PORT = '3999'
  $env:NODE_ENV = 'development'
  $env:PGOPTIONS = '-c role=hostile'
  $env:PGPASSWORD = 'must-not-cross-boundary'
  $env:TEMP = 'C:\hostile-temp'
  $env:TMP = 'C:\hostile-tmp'
  $observed = Invoke-WithSanitizedRuntimeEnvironment {
    [pscustomobject]@{
      YellowCount = @(Get-ChildItem Env: | Where-Object Name -like 'YELLOW_*').Count
      Host = $env:HOST; Port = $env:PORT; NodeEnv = $env:NODE_ENV
      PgCount = @(Get-ChildItem Env: | Where-Object Name -match '^(?i:PG[A-Z0-9_]*)$').Count
      Temp = $env:TEMP; Tmp = $env:TMP
    }
  }
  if ($observed.YellowCount -ne 0 -or $null -ne $observed.Host -or $null -ne $observed.Port -or
      $null -ne $observed.NodeEnv -or $observed.PgCount -ne 0 -or
      $observed.Temp -cne 'D:\Yellow\temp' -or $observed.Tmp -cne 'D:\Yellow\temp') {
    throw ('hostile parent runtime settings crossed the child boundary: ' + ($observed | ConvertTo-Json -Compress))
  }
  if ($env:YELLOW_HOSTED_PROVIDER_ONLY -cne '1' -or $env:YELLOW_LOCAL_REVIEW_PREFILL -cne 'hostile-parent' -or
      $env:HOST -cne '0.0.0.0' -or $env:PORT -cne '3999' -or $env:NODE_ENV -cne 'development' -or
      $env:PGOPTIONS -cne '-c role=hostile' -or $env:PGPASSWORD -cne 'must-not-cross-boundary' -or
      $env:TEMP -cne 'C:\hostile-temp' -or $env:TMP -cne 'C:\hostile-tmp') {
    throw 'parent runtime environment was not restored'
  }
} finally {
  foreach ($entry in $original.GetEnumerator()) {
    [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process')
  }
}
`, "utf8");
    const result = runPowerShell(probe);
    expect(result.exitCode, result.stderr.toString()).toBe(0);
  });

  test("full archive-to-extracted-tree proof detects nested mutation and extra files", async () => {
    const probe = join(fixtureRoot, "source-proof.ps1");
    await writeFile(probe, String.raw`
$ErrorActionPreference = 'Stop'
$tokens = $null
$errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile('${helperPath.replaceAll("'", "''")}', [ref]$tokens, [ref]$errors)
if ($errors.Count -ne 0) { throw 'helper parse failed' }
$needed = @('Get-Sha256Hex','Get-StreamSha256Hex','Get-AppTreeFileMap','Assert-SourceArchiveIdentity')
foreach ($name in $needed) {
  $definition = @($ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name }, $true))
  if ($definition.Count -ne 1) { throw "missing source identity function $name" }
  Invoke-Expression $definition[0].Extent.Text
}
$caseRoot = Join-Path '${fixtureRoot.replaceAll("'", "''")}' 'tree-case'
$sourceRoot = Join-Path $caseRoot 'source'
$archiveRoot = Join-Path $caseRoot 'archive-input'
$archive = Join-Path $caseRoot 'source.zip'
[IO.Directory]::CreateDirectory((Join-Path $sourceRoot 'nested')) | Out-Null
[IO.Directory]::CreateDirectory((Join-Path $archiveRoot 'nested')) | Out-Null
[IO.File]::WriteAllText((Join-Path $sourceRoot 'root.txt'), 'root')
[IO.File]::WriteAllText((Join-Path $sourceRoot 'nested/identity.txt'), 'exact nested bytes')
[IO.File]::WriteAllText((Join-Path $archiveRoot 'root.txt'), 'root')
[IO.File]::WriteAllText((Join-Path $archiveRoot 'nested/identity.txt'), 'exact nested bytes')
[IO.Compression.ZipFile]::CreateFromDirectory($archiveRoot, $archive)
$hash = Get-Sha256Hex $archive
Assert-SourceArchiveIdentity $archive $sourceRoot $hash
[IO.File]::WriteAllText((Join-Path $sourceRoot 'nested/identity.txt'), 'mutated')
$mutationRejected = $false
try { Assert-SourceArchiveIdentity $archive $sourceRoot $hash } catch { $mutationRejected = $true }
if (-not $mutationRejected) { throw 'nested source mutation was accepted' }
[IO.File]::WriteAllText((Join-Path $sourceRoot 'nested/identity.txt'), 'exact nested bytes')
[IO.File]::WriteAllText((Join-Path $sourceRoot 'extra.txt'), 'extra')
$extraRejected = $false
try { Assert-SourceArchiveIdentity $archive $sourceRoot $hash } catch { $extraRejected = $true }
if (-not $extraRejected) { throw 'extra extracted file was accepted' }
$wrongHashRejected = $false
try { Assert-SourceArchiveIdentity $archive $sourceRoot ('0' * 64) } catch { $wrongHashRejected = $true }
if (-not $wrongHashRejected) { throw 'wrong archive hash was accepted' }
`, "utf8");
    const result = runPowerShell(probe);
    expect(result.exitCode, result.stderr.toString()).toBe(0);
  });

  test("pins exact source, database frontier, dependency, ACL, and bounded artifact identities", async () => {
    const source = await Bun.file(helperPath).text();
    expect(source).toContain("b5ef70842b658183f7b5b4c650c8e78c7a0b513d");
    expect(source).toContain("F923DDAD39171E449A3712725A3C43358E7916B6B80E4BA056FC4E2ED0268087");
    expect(source).toContain("yellow_order442_review|160015|77|77|127|1|1");
    expect(source).toContain("$maximumResumeAttempts = 3");
    expect(source).toContain("run-native-review-bounded.ps1");
    expect(source).toContain("logByteLimitPerFile = 5242880");
    expect(source).toContain("retainedLogFilesPerStream = 3");
    expect(source).toContain("automaticRestart = $false");
    expect(source).toContain("$junction.LinkType -cne 'Junction'");
    expect(source).toContain("AreAccessRulesProtected");
    expect(source).toContain("migrationLedgerSha256");
    expect(source).toContain("prefillVerified = $true");
    expect(source).toContain("loginVerified = $true");
  });
});
