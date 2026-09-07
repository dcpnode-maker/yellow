import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dir, "..");
const orchestratorPath = join(repositoryRoot, "scripts", "order444-native-review.ps1");
const supervisorPath = join(repositoryRoot, "scripts", "run-order444-native-review-bounded.ps1");
const revision = "0123456789abcdef0123456789abcdef01234567";
const requireNativeProof = process.env.YELLOW_REQUIRE_ORDER444_NATIVE_REVIEW === "1";
const nativeTest = process.platform === "win32" ? test : test.skip;
let fixtureRoot = "";

function powerShellPath(): string {
  const bundled = process.env.USERPROFILE === undefined ? undefined : join(
    process.env.USERPROFILE,
    ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "native", "powershell", "pwsh.exe",
  );
  const resolved = Bun.which("pwsh") ?? (bundled !== undefined && existsSync(bundled) ? bundled : undefined);
  if (resolved === undefined) throw new Error("Order444 native review proof requires PowerShell 7 on Windows");
  return resolved;
}

function runPowerShell(scriptPath: string, args: readonly string[] = [], environment: NodeJS.ProcessEnv = process.env, timeoutMs = 10_000) {
  return Bun.spawnSync({
    cmd: [powerShellPath(), "-NoLogo", "-NoProfile", "-NonInteractive", "-File", scriptPath, ...args],
    cwd: repositoryRoot,
    env: { ...environment },
    stdout: "pipe",
    stderr: "pipe",
    timeout: timeoutMs,
  });
}

async function writeProbe(name: string, body: string): Promise<string> {
  const path = join(fixtureRoot, name);
  await writeFile(path, `$ErrorActionPreference='Stop'\n${body}`, "utf8");
  return path;
}

beforeAll(async () => { if (process.platform === "win32") fixtureRoot = await mkdtemp(join(tmpdir(), "yellow-order444-native-test-")); });
afterAll(async () => { if (fixtureRoot !== "") await rm(fixtureRoot, { recursive: true, force: true }); });

test("Order444 native review proof has an explicit required Windows gate", () => {
  if (requireNativeProof && process.platform !== "win32") throw new Error("Required Order444 native review proof cannot run off Windows");
  if (requireNativeProof) expect(process.platform).toBe("win32");
});

describe("Order444 exact-source native review tooling", () => {
  nativeTest("both PowerShell files parse and keep production operations narrowly owned", async () => {
    const probe = await writeProbe("ast-proof.ps1", String.raw`
$paths=@('${orchestratorPath.replaceAll("'", "''")}','${supervisorPath.replaceAll("'", "''")}')
foreach($path in $paths){
  $tokens=$null;$errors=$null
  $ast=[Management.Automation.Language.Parser]::ParseFile($path,[ref]$tokens,[ref]$errors)
  if($errors.Count -ne 0){throw ($errors|ForEach-Object Message|Out-String)}
  $commands=@($ast.FindAll({param($n) $n -is [Management.Automation.Language.CommandAst]},$true))
  $names=@($commands|ForEach-Object GetCommandName|Where-Object{$null-ne$_})
  for($index=0;$index-lt$tokens.Count-1;$index++){
    $token=$tokens[$index];$next=$tokens[$index+1]
    if($token.Kind-eq[Management.Automation.Language.TokenKind]::Parameter-and$token.Extent.EndOffset-eq$next.Extent.StartOffset-and
       $next.Kind-in@([Management.Automation.Language.TokenKind]::LParen,[Management.Automation.Language.TokenKind]::StringLiteral,[Management.Automation.Language.TokenKind]::StringExpandable,[Management.Automation.Language.TokenKind]::Generic)){
      throw "command parameter has a joined argument at line $($token.Extent.StartLineNumber)"
    }
  }
  foreach($forbidden in @('Invoke-Expression','Restart-Process','Stop-Service','Restart-Service','Start-Service','initdb','pg_ctl','dropdb')){
    if($names -contains $forbidden){throw "forbidden command $forbidden"}
  }
}
$orchestrator=[IO.File]::ReadAllText($paths[0])
if($orchestrator -match 'start-merged-native-review\.ps1'){throw 'first-provision predecessor helper must never be called'}
if($orchestrator -notmatch 'resume-merged-native-review\.ps1'){throw 'fixed predecessor resume helper is not the rollback path'}
if($orchestrator -match '(?i)New-Service|Remove-Item\s+[^\r\n]*-Recurse'){throw 'unadmitted runtime mechanism present'}
$orchestratorAst=[Management.Automation.Language.Parser]::ParseFile($paths[0],[ref]$tokens,[ref]$errors)
$stops=@($orchestratorAst.FindAll({param($n)$n-is[Management.Automation.Language.CommandAst]-and$n.GetCommandName()-eq'Stop-Process'},$true))
$kills=@($orchestratorAst.FindAll({param($n)$n-is[Management.Automation.Language.InvokeMemberExpressionAst]-and$n.Member.Value-eq'Kill'},$true))
if($stops.Count-ne0-or$kills.Count-lt7){throw 'process stops are not direct owned-process operations'}
foreach($name in @('Invoke-Promote','Invoke-Rollback')){
  $fn=@($orchestratorAst.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-eq$name},$true));if($fn.Count-ne1){throw "missing $name"}
  if($fn[0].Extent.Text-match'(?i)scripts[/\\](?:migrate|seed)'){throw "$name contains provisioning work"}
}
$promote=@($orchestratorAst.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-eq'Invoke-Promote'},$true))[0].Extent.Text
$stage=$promote.IndexOf('Start-CandidateSupervisor $stagingPort');$stageProof=$promote.IndexOf('Invoke-HttpProof $stagingPort');$oldStop=$promote.IndexOf('Stop-VerifiedOldLaunch');$final=$promote.IndexOf('Start-CandidateSupervisor $founderPort');$finalProof=$promote.IndexOf('Invoke-HttpProof $founderPort')
if(-not(0-le$stage-and$stage-lt$stageProof-and$stageProof-lt$oldStop-and$oldStop-lt$final-and$final-lt$finalProof)){throw 'promotion proof/stop order changed'}
$rollback=@($orchestratorAst.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-eq'Invoke-Rollback'},$true))[0].Extent.Text
if($rollback.IndexOf('Stop-VerifiedLaunch')-gt$rollback.IndexOf('Invoke-OldResume')){throw 'rollback resumes predecessor before exact candidate stop'}
$supervisor=[IO.File]::ReadAllText($paths[1])
if($supervisor -match '(?i)automaticRestart\s*=\s*\$true'){throw 'automatic restart is forbidden'}
if($supervisor -notmatch 'retainedLogFilesPerStream\s*=\s*3'){throw 'bounded log retention missing'}
`);
    const result = runPowerShell(probe);
    expect(result.exitCode, result.stderr.toString()).toBe(0);
  });

  nativeTest("derives only exact lowercase-40 Order444 namespaces and fixed database names", async () => {
    const probe = await writeProbe("path-proof.ps1", String.raw`
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile('${orchestratorPath.replaceAll("'", "''")}',[ref]$tokens,[ref]$errors)
if($errors.Count-ne0){throw 'parse failed'}
$fn=@($ast.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-eq'Get-Order444CandidatePaths'},$true))
if($fn.Count-ne1){throw 'path function missing'}
. ([scriptblock]::Create($fn[0].Extent.Text))
$base='D:\Yellow\runtime'
$p=Get-Order444CandidatePaths $base '${revision}'
if($p.SourceRoot-cne'D:\Yellow\runtime\order444-0123456789abcdef0123456789abcdef01234567-source'){throw 'source namespace drift'}
if($p.ControlRoot-cne'D:\Yellow\runtime\order444-0123456789abcdef0123456789abcdef01234567-control'){throw 'control namespace drift'}
if($p.ReviewDatabase-cne'yellow_order444_review_0123456789ab' -or $p.InvariantDatabase-cne'yellow_order444_invariants_0123456789ab'){throw 'database namespace drift'}
foreach($bad in @('0123','0123456789ABCDEF0123456789ABCDEF01234567','../../0123456789abcdef0123456789abcdef01234567','g123456789abcdef0123456789abcdef01234567')){
  $rejected=$false;try{Get-Order444CandidatePaths $base $bad|Out-Null}catch{$rejected=$true};if(-not$rejected){throw 'unsafe revision accepted'}
}
`);
    const result = runPowerShell(probe);
    expect(result.exitCode, result.stderr.toString()).toBe(0);
  });

  nativeTest("candidate receipt binds the complete source, database and fixture identity", async () => {
    const probe = await writeProbe("receipt-proof.ps1", String.raw`
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile('${orchestratorPath.replaceAll("'", "''")}',[ref]$tokens,[ref]$errors)
if($errors.Count-ne0){throw 'parse failed'}
foreach($name in @('Get-Order444CandidatePaths','Assert-CandidateReceiptShape')){
  $fn=@($ast.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-eq$name},$true));if($fn.Count-ne1){throw "missing $name"};. ([scriptblock]::Create($fn[0].Extent.Text))
}
$p=Get-Order444CandidatePaths 'D:\Yellow\runtime' '${revision}'
$receipt=[pscustomobject]@{schema='yellow-order444-native-candidate/v1';source='${revision}';sourceArchiveSha256=('a'*64);sourceRoot=$p.SourceRoot;controlRoot=$p.ControlRoot;reviewDatabase=$p.ReviewDatabase;invariantDatabase=$p.InvariantDatabase;migrationFrontier=85;migrationLedgerSha256=('c'*64);bunVersion='1.3.14';packageJsonSha256=('d'*64);bunLockSha256=('e'*64);bunfigSha256=('f'*64);appEnvironmentSha256=('1'*64);seedEnvironmentSha256=('2'*64);dependencyJunction='C:\fixture\node_modules';postgresVersionNum='160015';postgresPort=55503;fixtureManifestSha256=('b'*64);prepared=$true}
Assert-CandidateReceiptShape $receipt $p '${revision}'
foreach($change in @(
  @{source='1123456789abcdef0123456789abcdef01234567'},@{sourceArchiveSha256=('A'*64)},@{sourceRoot='D:\Yellow\runtime\order442-review'},@{controlRoot=$p.SourceRoot},
  @{reviewDatabase='yellow_order442_review'},@{invariantDatabase=$p.ReviewDatabase},@{migrationFrontier=84},@{migrationLedgerSha256=$null},@{bunVersion='1.3.15'},@{packageJsonSha256=$null},@{appEnvironmentSha256=$null},@{seedEnvironmentSha256=('A'*64)},@{dependencyJunction=''},@{postgresPort=5432},@{fixtureManifestSha256=$null},@{prepared=$false}
)){
  $copy=$receipt.PSObject.Copy();foreach($entry in $change.GetEnumerator()){$copy.($entry.Key)=$entry.Value}
  $rejected=$false;try{Assert-CandidateReceiptShape $copy $p '${revision}'}catch{$rejected=$true};if(-not$rejected){throw "changed receipt accepted: $($change.Keys)"}
}
`);
    const result = runPowerShell(probe);
    expect(result.exitCode, result.stderr.toString()).toBe(0);
  });

  nativeTest("both candidate preflights accept the real scalar junction target and reject every ambiguous identity", async () => {
    const junctionRoot = join(fixtureRoot, "dependency-junction");
    const target = join(junctionRoot, "target");
    const otherTarget = join(junctionRoot, "other-target");
    const link = join(junctionRoot, "node_modules");
    const ordinaryDirectory = join(junctionRoot, "ordinary-directory");
    const probe = await writeProbe("dependency-junction-proof.ps1", String.raw`
$root='${junctionRoot.replaceAll("'", "''")}'
$target='${target.replaceAll("'", "''")}'
$other='${otherTarget.replaceAll("'", "''")}'
$link='${link.replaceAll("'", "''")}'
$ordinary='${ordinaryDirectory.replaceAll("'", "''")}'
[IO.Directory]::CreateDirectory($target)|Out-Null
[IO.Directory]::CreateDirectory($other)|Out-Null
[IO.Directory]::CreateDirectory($ordinary)|Out-Null
$junction=New-Item -ItemType Junction -Path $link -Target $target
try {
  if($junction.Target-isnot[string]){throw "PowerShell did not expose the real junction target as a scalar string: $($junction.Target.GetType().FullName)"}
  foreach($path in @('${orchestratorPath.replaceAll("'", "''")}','${supervisorPath.replaceAll("'", "''")}')){
    $source=[IO.File]::ReadAllText($path)
    if($source-match'\.Target\s*\[\s*0\s*\]'){throw "scalar target indexing remains in $path"}
    $tokens=$null;$errors=$null
    $ast=[Management.Automation.Language.Parser]::ParseFile($path,[ref]$tokens,[ref]$errors)
    $fn=@($ast.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-eq'Assert-DependencyJunctionIdentity'},$true))
    if($fn.Count-ne1){throw "dependency junction identity guard missing in $path"}
    . ([scriptblock]::Create($fn[0].Extent.Text))
    Assert-DependencyJunctionIdentity $junction $target
    foreach($case in @(
      @((Get-Item -LiteralPath $ordinary -Force),$ordinary),
      @($junction,$other),
      @([pscustomobject]@{LinkType='Junction';Target=@($target,$other)},$target)
    )){
      $rejected=$false
      try{Assert-DependencyJunctionIdentity $case[0] $case[1]}catch{$rejected=$true}
      if(-not$rejected){throw "wrong-type, mismatched or multiple dependency target was accepted by $path"}
    }
  }
} finally {
  if(Test-Path -LiteralPath $link){Remove-Item -LiteralPath $link -Force}
}
`);
    const result = runPowerShell(probe);
    expect(result.exitCode, result.stderr.toString()).toBe(0);
  });

  nativeTest("listener ownership rejects foreign, public, stale and ambiguous listeners without killing them", async () => {
    const probe = await writeProbe("listener-proof.ps1", String.raw`
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile('${orchestratorPath.replaceAll("'", "''")}',[ref]$tokens,[ref]$errors)
if($errors.Count-ne0){throw 'parse failed'}
$fn=@($ast.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-eq'Assert-ExactLoopbackListener'},$true));if($fn.Count-ne1){throw 'listener guard missing'};. ([scriptblock]::Create($fn[0].Extent.Text))
$exact=[pscustomobject]@{OwningProcess=24680;LocalAddress='127.0.0.1'}
Assert-ExactLoopbackListener @($exact) 24680 3000
$dual=@($exact,[pscustomobject]@{OwningProcess=24680;LocalAddress='::1'});Assert-ExactLoopbackListener $dual 24680 3000
foreach($case in @(@(),@([pscustomobject]@{OwningProcess=24681;LocalAddress='127.0.0.1'}),@([pscustomobject]@{OwningProcess=24680;LocalAddress='0.0.0.0'}),@($exact,[pscustomobject]@{OwningProcess=24681;LocalAddress='::1'}))){
  $rejected=$false;try{Assert-ExactLoopbackListener $case 24680 3000}catch{$rejected=$true};if(-not$rejected){throw 'foreign or ambiguous listener accepted'}
}
if($exact.OwningProcess-ne24680){throw 'listener guard mutated supplied owner'}
`);
    const result = runPowerShell(probe);
    expect(result.exitCode, result.stderr.toString()).toBe(0);
  });

  nativeTest("process identity binds PID, parent, executable, command and exact UTC start", async () => {
    const probe = await writeProbe("process-proof.ps1", String.raw`
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile('${orchestratorPath.replaceAll("'", "''")}',[ref]$tokens,[ref]$errors)
foreach($name in @('Normalize-CommandLine','ConvertTo-UtcDateTime','Assert-ExactProcess')){$fn=@($ast.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-eq$name},$true));if($fn.Count-ne1){throw "missing $name"};. ([scriptblock]::Create($fn[0].Extent.Text))}
$record=[pscustomobject]@{ProcessId=42;ParentProcessId=41;ExecutablePath='C:\runtime\bun.exe';CommandLine='"C:\runtime\bun.exe" src/server.ts';CreationDate='2026-09-07T10:11:12.1234567Z'}
Assert-ExactProcess $record 42 '2026-09-07T10:11:12.1234567Z' 'C:\runtime\bun.exe' 'C:\runtime\bun.exe src/server.ts' ([Nullable[int]]41)
foreach($change in @(@{ProcessId=43},@{ParentProcessId=40},@{ExecutablePath='C:\other\bun.exe'},@{CommandLine='C:\runtime\bun.exe other.ts'},@{CreationDate='2026-09-07T10:11:12.1234568Z'})){
  $copy=$record.PSObject.Copy();foreach($entry in $change.GetEnumerator()){$copy.($entry.Key)=$entry.Value};$rejected=$false
  try{Assert-ExactProcess $copy 42 '2026-09-07T10:11:12.1234567Z' 'C:\runtime\bun.exe' 'C:\runtime\bun.exe src/server.ts' ([Nullable[int]]41)}catch{$rejected=$true};if(-not$rejected){throw 'changed process identity accepted'}
}
`);
    const result = runPowerShell(probe);
    expect(result.exitCode, result.stderr.toString()).toBe(0);
  });

  nativeTest("retained Order442 verification respects historical timestamp provenance and full identity", async () => {
    const probe = await writeProbe("old-format-process-proof.ps1", String.raw`
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile('${orchestratorPath.replaceAll("'", "''")}',[ref]$tokens,[ref]$errors)
foreach($name in @('Normalize-CommandLine','ConvertTo-UtcDateTime','Assert-ExactProcess','Assert-RetainedOrder442LaunchIdentity')){$fn=@($ast.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-eq$name},$true));if($fn.Count-ne1){throw "missing $name"};. ([scriptblock]::Create($fn[0].Extent.Text))}
$oldRevision='b5ef70842b658183f7b5b4c650c8e78c7a0b513d';$oldControlRoot='D:\Yellow\runtime\order442-review';$bunPath='C:\runtime\bun.exe';$powerShellPath='C:\runtime\pwsh.exe';$oldSupervisorHelper='C:\repo\scripts\run-native-review-bounded.ps1'
$childProcessStart='2026-09-06T06:56:53.5264898Z';$receipt=[pscustomobject]@{receiptType='order442-native-resume-v1';source=$oldRevision;port=3000;loginVerified=$true;pid=42;supervisorPid=41;startedUtc=$childProcessStart}
$status=[pscustomobject]@{schema='yellow-native-review-bounded/v1';mode='order442-preview';childPid=42;childStartedUtc=$childProcessStart;supervisorStartedUtc='2026-09-06T06:56:53.3899828Z';reason='running'}
$child=[pscustomobject]@{ProcessId=42;ParentProcessId=41;ExecutablePath=$bunPath;CommandLine="$bunPath --env-file=$oldControlRoot\app.env src/server.ts";CreationDate='2026-09-06T06:56:53.5264890Z'}
$supervisor=[pscustomobject]@{ProcessId=41;ParentProcessId=40;ExecutablePath=$powerShellPath;CommandLine="$powerShellPath -NoLogo -NoProfile -NonInteractive -File $oldSupervisorHelper";CreationDate='2026-09-06T06:56:51.9615680Z'}
Assert-RetainedOrder442LaunchIdentity $receipt $status $child $supervisor $childProcessStart
foreach($mutation in @('receipt_time','observation','child_parent','supervisor_command')){
  $r=$receipt.PSObject.Copy();$s=$status.PSObject.Copy();$c=$child.PSObject.Copy();$p=$supervisor.PSObject.Copy()
  switch($mutation){'receipt_time'{$r.startedUtc='2026-09-06T06:56:53.5264897Z'}'observation'{$s.supervisorStartedUtc='2026-09-06T06:56:50.0000000Z'}'child_parent'{$c.ParentProcessId=99}'supervisor_command'{$p.CommandLine="$powerShellPath -File other.ps1"}}
  $rejected=$false;try{Assert-RetainedOrder442LaunchIdentity $r $s $c $p $childProcessStart}catch{$rejected=$true};if(-not$rejected){throw "old-format identity mutation accepted: $mutation"}
}
`);
    const result = runPowerShell(probe);
    expect(result.exitCode, result.stderr.toString()).toBe(0);
  });

  nativeTest("retained receipt discovery uses the literal owned filename filter", async () => {
    const controlRoot = join(fixtureRoot, "receipt-discovery");
    await mkdir(controlRoot);
    await Promise.all([
      writeFile(join(controlRoot, "resume-receipt-20260907T010000000Z.json"), "{}", "utf8"),
      writeFile(join(controlRoot, "resume-receipt-20260907T020000000Z.json"), "{}", "utf8"),
      writeFile(join(controlRoot, "resume-receipt-not-json.txt"), "{}", "utf8"),
    ]);
    const probe = await writeProbe("receipt-discovery-proof.ps1", String.raw`
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile('${orchestratorPath.replaceAll("'", "''")}',[ref]$tokens,[ref]$errors)
foreach($name in @('Set-PrivateAcl','Assert-PrivateFileAcl','Get-LatestOrder442ResumeReceipt')){$fn=@($ast.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-eq$name},$true));if($fn.Count-ne1){throw "missing $name"};. ([scriptblock]::Create($fn[0].Extent.Text))}
$root='${controlRoot.replaceAll("'", "''")}';Get-ChildItem -LiteralPath $root -File -Filter 'resume-receipt-*.json'|ForEach-Object{Set-PrivateAcl $_.FullName}
$actual=Get-LatestOrder442ResumeReceipt $root
if([IO.Path]::GetFileName($actual)-cne'resume-receipt-20260907T020000000Z.json'){throw 'latest owned receipt discovery changed'}
`);
    const result = runPowerShell(probe);
    expect(result.exitCode, result.stderr.toString()).toBe(0);
  });

  nativeTest("HTTP proof binds every JSON POST ContentType and body in memory", async () => {
    const probe = await writeProbe("http-binding-proof.ps1", String.raw`
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile('${orchestratorPath.replaceAll("'", "''")}',[ref]$tokens,[ref]$errors)
$fn=@($ast.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-eq'Invoke-HttpProof'},$true));if($fn.Count-ne1){throw 'missing Invoke-HttpProof'};. ([scriptblock]::Create($fn[0].Extent.Text))
$CandidateRevision='${revision}';$script:posts=@()
function Invoke-WebRequest{param([string]$Uri,[int]$TimeoutSec);return [pscustomobject]@{StatusCode=200;Headers=@{'Cache-Control'=@('no-store')};Content='<input data-local-default="yellow-demo"><input data-local-default="operator@yellow.local"><input data-local-default="password">'}}
function Invoke-RestMethod{
  param([Parameter(Position=0)][string]$Uri,[string]$Method,[string]$ContentType,[string]$Body,[hashtable]$Headers,[int]$TimeoutSec)
  if($Method-ceq'Post'){$script:posts+=,[pscustomobject]@{Uri=$Uri;ContentType=$ContentType;Body=$Body}}
  if($Uri.EndsWith('/ready')){return [pscustomobject]@{status='ready';target='yellow_runtime_database';build=[pscustomobject]@{revision=$CandidateRevision;expectedMigrationFrontier=85}}}
  if($Uri.EndsWith('/auth/local:login')){return [pscustomobject]@{tokenType='Bearer';accessToken=('t'*40)}}
  if($Uri.EndsWith('/invoices/00000000-0000-4000-8000-000000000002')){return [pscustomobject]@{invoice=[pscustomobject]@{documentId='00000000-0000-4000-8000-000000000002';propertyNode='00000000-0000-4000-8000-000000000001';businessDate='2026-09-07'}}}
  if($Uri.EndsWith('/invoices/search')){return [pscustomobject]@{invoices=[pscustomobject]@{items=@([pscustomobject]@{documentId='00000000-0000-4000-8000-000000000002'})}}}
  if($Uri.EndsWith('/invoice-readiness')){return [pscustomobject]@{readiness=[pscustomobject]@{kind='ready'}}}
  if($Uri.EndsWith('/fiscal-provider-options')){return [pscustomobject]@{providers=@()}}
  throw 'unexpected in-memory URI'
}
$identity=[pscustomobject]@{Manifest=[pscustomobject]@{tenantSlug='yellow-demo';operatorEmail='operator@yellow.local';propertyNode='00000000-0000-4000-8000-000000000001';issuedDocumentId='00000000-0000-4000-8000-000000000002';eligible=[pscustomobject]@{reservationId='00000000-0000-4000-8000-000000000003';folioId='00000000-0000-4000-8000-000000000004';recipientRegistrationId='00000000-0000-4000-8000-000000000005'}}}
$environment=[Collections.Generic.Dictionary[string,string]]::new([StringComparer]::Ordinal);$environment['YELLOW_LOCAL_REVIEW_PASSWORD']='password'
$proof=Invoke-HttpProof 3000 $identity $environment
if(-not$proof.ProviderDirectoryEmpty-or$script:posts.Count-ne3){throw 'in-memory HTTP proof did not complete all JSON posts'}
foreach($post in $script:posts){if($post.ContentType-cne'application/json'){throw 'JSON ContentType parameter did not bind'};if($null-eq($post.Body|ConvertFrom-Json)){throw 'JSON body parameter did not bind'}}
`);
    const result = runPowerShell(probe);
    expect(result.exitCode, result.stderr.toString()).toBe(0);
  });

  nativeTest("full candidate archive proof rejects nested mutation and extra source files", async () => {
    const probe = await writeProbe("source-proof.ps1", String.raw`
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile('${orchestratorPath.replaceAll("'", "''")}',[ref]$tokens,[ref]$errors)
foreach($name in @('Get-Sha256Hex','Get-StreamSha256Hex','Get-AppTreeFileMap','Assert-SourceArchiveIdentity')){$fn=@($ast.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-eq$name},$true));if($fn.Count-ne1){throw "missing $name"};. ([scriptblock]::Create($fn[0].Extent.Text))}
$root=Join-Path '${fixtureRoot.replaceAll("'", "''")}' 'archive-proof';$input=Join-Path $root 'input';$source=Join-Path $root 'source';$archive=Join-Path $root 'source.zip'
[IO.Directory]::CreateDirectory((Join-Path $input 'nested'))|Out-Null;[IO.Directory]::CreateDirectory((Join-Path $source 'nested'))|Out-Null
[IO.File]::WriteAllText((Join-Path $input 'root.txt'),'root');[IO.File]::WriteAllText((Join-Path $input 'nested/one.txt'),'one')
[IO.File]::WriteAllText((Join-Path $source 'root.txt'),'root');[IO.File]::WriteAllText((Join-Path $source 'nested/one.txt'),'one')
[IO.Compression.ZipFile]::CreateFromDirectory($input,$archive);$hash=Get-Sha256Hex $archive;Assert-SourceArchiveIdentity $archive $source $hash
[IO.File]::WriteAllText((Join-Path $source 'nested/one.txt'),'changed');$rejected=$false;try{Assert-SourceArchiveIdentity $archive $source $hash}catch{$rejected=$true};if(-not$rejected){throw 'nested mutation accepted'}
[IO.File]::WriteAllText((Join-Path $source 'nested/one.txt'),'one');[IO.File]::WriteAllText((Join-Path $source 'extra.txt'),'extra');$rejected=$false;try{Assert-SourceArchiveIdentity $archive $source $hash}catch{$rejected=$true};if(-not$rejected){throw 'extra source accepted'}
`);
    const result = runPowerShell(probe);
    expect(result.exitCode, result.stderr.toString()).toBe(0);
  });

  nativeTest("fiscal fixture manifest is exact, secret-free and selector-bound", async () => {
    const probe = await writeProbe("manifest-proof.ps1", String.raw`
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile('${orchestratorPath.replaceAll("'", "''")}',[ref]$tokens,[ref]$errors)
$fn=@($ast.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-eq'Assert-FiscalFixtureManifest'},$true));. ([scriptblock]::Create($fn[0].Extent.Text))
$id1='abcdefab-cdef-4abc-8abc-abcdefabcdef';$id2='00000000-0000-4000-8000-000000000002';$id3='00000000-0000-4000-8000-000000000003';$id4='00000000-0000-4000-8000-000000000004';$id5='00000000-0000-4000-8000-000000000005'
$manifest=[pscustomobject]@{schema='yellow-order444-fiscal-review/v1';tenantSlug='yellow-demo';propertyNode=$id1;operatorEmail='operator@yellow.local';issuedDocumentId=$id2;eligible=[pscustomobject]@{reservationId=$id3;folioId=$id4;recipientRegistrationId=$id5}}
Assert-FiscalFixtureManifest $manifest
foreach($change in @(@{password='secret'},@{schema='wrong'},@{propertyNode=$id1.ToUpperInvariant()},@{issuedDocumentId='bad'},@{eligible=[pscustomobject]@{reservationId=$id3;folioId=$id4;recipientRegistrationId=$id5;token='secret'}})){
 $copy=$manifest.PSObject.Copy();foreach($entry in $change.GetEnumerator()){$copy|Add-Member -NotePropertyName $entry.Key -NotePropertyValue $entry.Value -Force};$rejected=$false;try{Assert-FiscalFixtureManifest $copy}catch{$rejected=$true};if(-not$rejected){throw 'changed manifest accepted'}
}
`);
    const result = runPowerShell(probe);
    expect(result.exitCode, result.stderr.toString()).toBe(0);
  });

  nativeTest("bounded supervisor records one nonzero child, drains its final output and retains only capped logs", async () => {
    const caseRoot = join(fixtureRoot, "supervisor-nonzero");
    const child = join(fixtureRoot, "nonzero-child.ps1");
    await writeFile(child, "$text=('é' * 4096)+'TAIL-COMPLETE';[Console]::Out.Write($text);[Console]::Error.Write($text);exit 7\n", "utf8");
    const result = runPowerShell(supervisorPath, [
      "-TestMode", "-TestRoot", caseRoot, "-TestChildScript", child,
      "-TestPerFileByteLimit", "1024", "-TestMaximumRuntimeMilliseconds", "4000", "-TestPollMilliseconds", "20",
    ]);
    expect(result.exitCode, result.stderr.toString()).toBe(7);
    const status = JSON.parse(await readFile(join(caseRoot, "supervisor.3000.status.json"), "utf8"));
    expect(status).toMatchObject({ schema: "yellow-order444-native-bounded/v1", launchCount: 1, reason: "child_exit", childExitCode: 7, automaticRestart: false });
    for (const stream of ["stdout", "stderr"]) {
      const sizes = await Promise.all([0, 1, 2].map(async (index) => {
        const path = join(caseRoot, `supervisor.3000.${stream}.${index}.log`);
        return existsSync(path) ? Bun.file(path).size : 0;
      }));
      expect(Math.max(...sizes)).toBeLessThanOrEqual(1024);
      expect(sizes.reduce((sum, size) => sum + size, 0)).toBeGreaterThan(0);
      expect(await readFile(join(caseRoot, `supervisor.3000.${stream}.0.log`), "utf8")).toEndWith("TAIL-COMPLETE");
    }
  }, 10_000);

  nativeTest("bounded supervisor removes inherited runtime and PostgreSQL overrides at child creation", async () => {
    const caseRoot = join(fixtureRoot, "supervisor-environment");
    const child = join(fixtureRoot, "environment-child.ps1");
    const observedPath = join(fixtureRoot, "environment.json");
    await writeFile(child, `$self=Get-CimInstance Win32_Process -Filter "ProcessId = $PID";$parent=Get-CimInstance Win32_Process -Filter "ProcessId = $($self.ParentProcessId)";$value=[ordered]@{yellow=@(Get-ChildItem Env:|Where-Object Name -like 'YELLOW_*').Count;host=$env:HOST;port=$env:PORT;node=$env:NODE_ENV;pg=@(Get-ChildItem Env:|Where-Object Name -match '^(?i:PG[A-Z0-9_]*)$').Count;parentStartedUtc=$parent.CreationDate.ToUniversalTime().ToString('o');childStartedUtc=$self.CreationDate.ToUniversalTime().ToString('o')};[IO.File]::WriteAllText('${observedPath.replaceAll("'", "''")}',($value|ConvertTo-Json -Compress));exit 0\n`, "utf8");
    const result = runPowerShell(supervisorPath, [
      "-TestMode", "-TestRoot", caseRoot, "-TestChildScript", child,
      "-TestMaximumRuntimeMilliseconds", "4000", "-TestPollMilliseconds", "20",
    ], { ...process.env, YELLOW_HOSTED_PROVIDER_ONLY: "1", YELLOW_ORDER444_DATABASE_PASSWORD: "must-not-cross", HOST: "0.0.0.0", PORT: "3999", NODE_ENV: "development", PGOPTIONS: "-c role=hostile", PGPASSWORD: "hostile" });
    expect(result.exitCode, result.stderr.toString()).toBe(0);
    const observed = JSON.parse(await readFile(observedPath, "utf8"));
    const status = JSON.parse(await readFile(join(caseRoot, "supervisor.3000.status.json"), "utf8"));
    expect(observed).toMatchObject({ yellow: 0, host: null, port: null, node: null, pg: 0 });
    expect(status.supervisorStartedUtc).toBe(observed.parentStartedUtc);
    expect(status.childStartedUtc).toBe(observed.childStartedUtc);
  }, 15_000);

  nativeTest("bounded supervisor stops and reaps only its hanging test child at its deadline", async () => {
    const caseRoot = join(fixtureRoot, "supervisor-hang");
    const child = join(fixtureRoot, "hang-child.ps1");
    const pidFile = join(fixtureRoot, "hang.pid");
    await writeFile(child, `[IO.File]::WriteAllText('${pidFile.replaceAll("'", "''")}',[string]$PID);while($true){Start-Sleep -Milliseconds 20}\n`, "utf8");
    const started = performance.now();
    const result = runPowerShell(supervisorPath, [
      "-TestMode", "-TestRoot", caseRoot, "-TestChildScript", child,
      "-TestMaximumRuntimeMilliseconds", "1000", "-TestPollMilliseconds", "20",
    ]);
    const elapsed = performance.now() - started;
    expect(result.exitCode, result.stderr.toString()).toBe(20);
    expect(elapsed).toBeLessThan(9_000);
    const pid = Number((await readFile(pidFile, "utf8")).trim());
    const alive = Bun.spawnSync({ cmd: [powerShellPath(), "-NoProfile", "-Command", `if(Get-Process -Id ${pid} -ErrorAction SilentlyContinue){exit 1}else{exit 0}`] });
    expect(alive.exitCode).toBe(0);
    const status = JSON.parse(await readFile(join(caseRoot, "supervisor.3000.status.json"), "utf8"));
    expect(status).toMatchObject({ reason: "runtime_deadline", launchCount: 1, automaticRestart: false });
  }, 10_000);

  nativeTest("bounded supervisor stops its child when a log pump faults", async () => {
    const caseRoot = join(fixtureRoot, "supervisor-pump-fault");
    const child = join(fixtureRoot, "pump-fault-child.ps1");
    const pidFile = join(fixtureRoot, "pump-fault.pid");
    await writeFile(child, `[IO.File]::WriteAllText('${pidFile.replaceAll("'", "''")}',[string]$PID);[IO.Directory]::CreateDirectory('${join(caseRoot, "supervisor.3000.stdout.1.log").replaceAll("'", "''")}')|Out-Null;[Console]::Out.Write(('x'*8192));while($true){Start-Sleep -Milliseconds 20}\n`, "utf8");
    let pid: number | undefined;
    try {
      const result = runPowerShell(supervisorPath, [
        "-TestMode", "-TestRoot", caseRoot, "-TestChildScript", child,
        "-TestPerFileByteLimit", "1024", "-TestMaximumRuntimeMilliseconds", "4000", "-TestPollMilliseconds", "20",
      ]);
      expect(result.exitCode, result.stderr.toString()).toBe(22);
      pid = Number((await readFile(pidFile, "utf8")).trim());
      const alive = Bun.spawnSync({ cmd: [powerShellPath(), "-NoProfile", "-Command", `if(Get-Process -Id ${pid} -ErrorAction SilentlyContinue){exit 1}else{exit 0}`] });
      expect(alive.exitCode).toBe(0);
      const status = JSON.parse(await readFile(join(caseRoot, "supervisor.3000.status.json"), "utf8"));
      expect(status).toMatchObject({ reason: "log_pump_failure", failureType: "bounded_stream_pump_fault", launchCount: 1 });
    } finally {
      if (pid === undefined && existsSync(pidFile)) pid = Number((await readFile(pidFile, "utf8")).trim());
      if (pid !== undefined) Bun.spawnSync({ cmd: [powerShellPath(), "-NoProfile", "-Command", `Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue`] });
    }
  }, 10_000);

  nativeTest("candidate startup failure reaps the exact injected supervisor and its child", async () => {
    const childPath = join(fixtureRoot, "startup-failure-child.ps1");
    const supervisorFixture = join(fixtureRoot, "startup-failure-supervisor.ps1");
    const supervisorPidPath = join(fixtureRoot, "startup-failure-supervisor.pid");
    const childPidPath = join(fixtureRoot, "startup-failure-child.pid");
    await writeFile(childPath, "while($true){Start-Sleep -Milliseconds 20}\n", "utf8");
    await writeFile(supervisorFixture, `param([string]$CandidateRevision,[int]$Port)\n$ErrorActionPreference='Stop'\n[IO.File]::WriteAllText('${supervisorPidPath.replaceAll("'", "''")}',[string]$PID)\n$info=[Diagnostics.ProcessStartInfo]::new('${powerShellPath().replaceAll("'", "''")}');$info.UseShellExecute=$false;$info.CreateNoWindow=$true;foreach($arg in @('-NoLogo','-NoProfile','-NonInteractive','-File','${childPath.replaceAll("'", "''")}')){[void]$info.ArgumentList.Add($arg)}\n$p=[Diagnostics.Process]::new();$p.StartInfo=$info;if(-not$p.Start()){throw 'fixture child start failed'}\n[IO.File]::WriteAllText('${childPidPath.replaceAll("'", "''")}',[string]$p.Id)\n$child=$null;foreach($attempt in 1..20){$child=Get-CimInstance Win32_Process -Filter "ProcessId = $($p.Id)";if($null-ne$child){break};Start-Sleep -Milliseconds 25}\n[IO.File]::WriteAllText('${join(fixtureRoot, "supervisor.39876.status.json").replaceAll("'", "''")}',(@{reason='fixture_failure';launchCount=1;childPid=$p.Id;childStartedUtc=$child.CreationDate.ToUniversalTime().ToString('o')}|ConvertTo-Json -Compress))\nwhile($true){Start-Sleep -Milliseconds 20}\n`, "utf8");
    const probe = await writeProbe("startup-failure-proof.ps1", String.raw`
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile('${orchestratorPath.replaceAll("'", "''")}',[ref]$tokens,[ref]$errors)
foreach($name in @('Normalize-CommandLine','ConvertTo-UtcDateTime','Assert-ExactProcess','Assert-ExactLoopbackListener','Stop-FailedCandidateStartup','Start-CandidateSupervisor')){$fn=@($ast.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-eq$name},$true));if($fn.Count-ne1){throw "missing $name"};. ([scriptblock]::Create($fn[0].Extent.Text))}
$powerShellPath='${powerShellPath().replaceAll("'", "''")}';$candidateSupervisor='${supervisorFixture.replaceAll("'", "''")}';$repositoryRoot='${repositoryRoot.replaceAll("'", "''")}';$CandidateRevision='${revision}'
$candidateChildExecutable=$powerShellPath;$candidateChildCommand="$powerShellPath -NoLogo -NoProfile -NonInteractive -File ${childPath.replaceAll("'", "''")}"
$paths=[pscustomobject]@{ControlRoot='${fixtureRoot.replaceAll("'", "''")}' }
$rejected=$false;$failure='';try{Start-CandidateSupervisor 39876 $paths 40 100|Out-Null}catch{$rejected=$true;$failure=$_.Exception.Message};if(-not$rejected){throw 'failed startup status was accepted'}
foreach($pidPath in @('${supervisorPidPath.replaceAll("'", "''")}','${childPidPath.replaceAll("'", "''")}')){if(-not(Test-Path -LiteralPath $pidPath)){throw 'injected process identity was not recorded'};$ownedPid=[int](Get-Content -LiteralPath $pidPath -Raw);if(Get-Process -Id $ownedPid -ErrorAction SilentlyContinue){throw "owned startup failure process survived cleanup: $([IO.Path]::GetFileName($pidPath)); $failure"}}
`);
    let result;
    try {
      result = runPowerShell(probe, [], process.env, 14_000);
      expect(result.exitCode, result.stderr.toString()).toBe(0);
    } finally {
      for (const path of [childPidPath, supervisorPidPath]) {
        if (!existsSync(path)) continue;
        const pid = Number((await readFile(path, "utf8")).trim());
        Bun.spawnSync({ cmd: [powerShellPath(), "-NoProfile", "-Command", `Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue`] });
      }
    }
  }, 15_000);

  nativeTest("candidate startup waits for an exact delayed loopback listener and then stops it", async () => {
    const port = 39877;
    const childPath = join(fixtureRoot, "delayed-listener-child.ps1");
    const supervisorFixture = join(fixtureRoot, "delayed-listener-supervisor.ps1");
    const supervisorPidPath = join(fixtureRoot, "delayed-listener-supervisor.pid");
    const childPidPath = join(fixtureRoot, "delayed-listener-child.pid");
    const statusPath = join(fixtureRoot, `supervisor.${port}.status.json`);
    await writeFile(childPath, `param([int]$Port)\nStart-Sleep -Milliseconds 500\n$listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,$Port)\n$listener.Start()\ntry{while($true){Start-Sleep -Milliseconds 20}}finally{$listener.Stop()}\n`, "utf8");
    await writeFile(supervisorFixture, `param([string]$CandidateRevision,[int]$Port)\n$ErrorActionPreference='Stop'\n[IO.File]::WriteAllText('${supervisorPidPath.replaceAll("'", "''")}',[string]$PID)\n$info=[Diagnostics.ProcessStartInfo]::new('${powerShellPath().replaceAll("'", "''")}');$info.UseShellExecute=$false;$info.CreateNoWindow=$true;foreach($arg in @('-NoLogo','-NoProfile','-NonInteractive','-File','${childPath.replaceAll("'", "''")}','-Port',[string]$Port)){[void]$info.ArgumentList.Add($arg)}\n$p=[Diagnostics.Process]::new();$p.StartInfo=$info;if(-not$p.Start()){throw 'fixture child start failed'}\n[IO.File]::WriteAllText('${childPidPath.replaceAll("'", "''")}',[string]$p.Id)\n$self=Get-CimInstance Win32_Process -Filter "ProcessId = $PID"\n$child=$null;foreach($attempt in 1..20){$child=Get-CimInstance Win32_Process -Filter "ProcessId = $($p.Id)";if($null-ne$child){break};Start-Sleep -Milliseconds 25}\n$status=[ordered]@{reason='running';launchCount=1;childPid=$p.Id;childStartedUtc=$child.CreationDate.ToUniversalTime().ToString('o');supervisorStartedUtc=$self.CreationDate.ToUniversalTime().ToString('o')}\n[IO.File]::WriteAllText('${statusPath.replaceAll("'", "''")}',($status|ConvertTo-Json -Compress))\nwhile($true){Start-Sleep -Milliseconds 20}\n`, "utf8");
    const probe = await writeProbe("delayed-listener-proof.ps1", String.raw`
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile('${orchestratorPath.replaceAll("'", "''")}',[ref]$tokens,[ref]$errors)
foreach($name in @('Normalize-CommandLine','ConvertTo-UtcDateTime','Assert-ExactProcess','Assert-ExactLoopbackListener','Stop-FailedCandidateStartup','Start-CandidateSupervisor','Stop-VerifiedLaunch')){$fn=@($ast.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-eq$name},$true));if($fn.Count-ne1){throw "missing $name"};. ([scriptblock]::Create($fn[0].Extent.Text))}
$powerShellPath='${powerShellPath().replaceAll("'", "''")}';$candidateSupervisor='${supervisorFixture.replaceAll("'", "''")}';$repositoryRoot='${repositoryRoot.replaceAll("'", "''")}';$CandidateRevision='${revision}'
$candidateChildExecutable=$powerShellPath;$candidateChildCommand="$powerShellPath -NoLogo -NoProfile -NonInteractive -File ${childPath.replaceAll("'", "''")} -Port ${port}"
$paths=[pscustomobject]@{ControlRoot='${fixtureRoot.replaceAll("'", "''")}' }
$launch=Start-CandidateSupervisor ${port} $paths 40 100
Assert-ExactLoopbackListener @(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction Stop) $launch.Child.Id ${port}
Stop-VerifiedLaunch $launch ${port}
foreach($ownedPid in @($launch.Child.Id,$launch.Supervisor.Id)){if(Get-Process -Id $ownedPid -ErrorAction SilentlyContinue){throw 'verified delayed-listener process survived stop'}}
`);
    let result;
    try {
      result = runPowerShell(probe, [], process.env, 18_000);
      expect(result.exitCode, result.stderr.toString()).toBe(0);
    } finally {
      for (const path of [childPidPath, supervisorPidPath]) {
        if (!existsSync(path)) continue;
        const pid = Number((await readFile(path, "utf8")).trim());
        Bun.spawnSync({ cmd: [powerShellPath(), "-NoProfile", "-Command", `Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue`] });
      }
    }
  }, 20_000);

  nativeTest("private tool drains immediate-exit output completely before cancellation", async () => {
    const childPath = join(fixtureRoot, "complete-output-child.ps1");
    const logPath = join(fixtureRoot, "complete-output.log");
    await writeFile(childPath, "[Console]::Out.Write(('z'*2000000));exit 0\n", "utf8");
    const probe = await writeProbe("complete-output-proof.ps1", String.raw`
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile('${orchestratorPath.replaceAll("'", "''")}',[ref]$tokens,[ref]$errors)
foreach($name in @('Initialize-Order444ToolPump','Set-PrivateAcl','Assert-PrivateFileAcl','Invoke-PrivateTool')){$fn=@($ast.FindAll({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-eq$name},$true));if($fn.Count-ne1){throw "missing $name"};. ([scriptblock]::Create($fn[0].Extent.Text))}
$temporaryBase='${fixtureRoot.replaceAll("'", "''")}';$privateLogByteLimit=5MB;Initialize-Order444ToolPump
Invoke-PrivateTool '${powerShellPath().replaceAll("'", "''")}' @('-NoLogo','-NoProfile','-NonInteractive','-File','${childPath.replaceAll("'", "''")}') '${fixtureRoot.replaceAll("'", "''")}' '${logPath.replaceAll("'", "''")}' @{}
$bytes=[IO.File]::ReadAllBytes('${logPath.replaceAll("'", "''")}');if($bytes.Length-ne2000000){throw "immediate output truncated to $($bytes.Length)"};if($bytes[0]-ne122-or$bytes[$bytes.Length-1]-ne122){throw 'immediate output boundary bytes changed'}
`);
    const result = runPowerShell(probe, [], process.env);
    expect(result.exitCode, result.stderr.toString()).toBe(0);
  }, 15_000);
});
