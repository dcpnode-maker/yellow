# Coordinator-owned, fixed source-only proposal packets; no secrets or live data.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$git = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe'
$private = Join-Path ((& $git -C $root rev-parse --absolute-git-dir).Trim()) 'yellow-continuity'
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $private -PathType Container)) { throw 'Existing private continuity directory required.' }
$item = Get-Item -LiteralPath $private
if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Private directory cannot be redirected.' }
$packets = @(
    @{
        Name='worker-spark-q285';
        Scope='.yellow/evidence/order460/market92-local-review-grant-native.test.ts';
        Instruction='Q285 source-only TEST change. Return a unified diff for only the supplied native test. Seed one unrelated existing permission (test.unrelated:read with a fixed description) and corresponding role_permission for the pinned role; prove it survives forced rollback, first successful grant and idempotent replay. Update all full-pair expectations accordingly. Preserve every existing assertion, helper SQL, direct-await errors, transaction/lock deadlines, schema isolation, public/global fingerprints and cleanup. Do NOT reject unrelated existing permissions: they must be preserved. Do not connect to any DB or use tools. No new product behavior. Explain any concern after the diff in at most three sentences.';
    },
    @{
        Name='worker-kilo-q286';
        Scope='.yellow/evidence/order460/market92-metadata-preservation.test.ts';
        Instruction='Q286 source-only TEST change. Return a unified diff appending tests ONLY to the supplied test file. Reuse existing input(), sha(), refreshTable(), refreshInventory() fixtures. Add explicit registered-capture rejection cases for a removed baseline tenant row, an extra correctly-hashed permission, swapping the two tables permission/role_permission hash lists while recomputing aggregates, a changed sequence counter, and changed cluster-global defaultAcl. Assert input immutability for accepted and rejected calls and deep frozen admittedRows entries. Keep existing tests and production helper unchanged. No tools, database, file writes, timeout changes, credentials or releases. Output only the unified diff.';
    }
)
foreach ($packet in $packets) {
    $destination = Join-Path $private ($packet.Name + '.txt')
    if (Test-Path -LiteralPath $destination) { throw 'Packet already exists; preserve it and choose an explicit successor.' }
    $source = Get-Content -LiteralPath (Join-Path $root $packet.Scope) -Raw
    $prompt = $packet.Instruction + "`n`nFILE: " + $packet.Scope + "`n" + $source
    if ([Text.Encoding]::UTF8.GetByteCount($prompt) -gt 160000) { throw 'Packet exceeds fixed limit.' }
    [IO.File]::WriteAllText($destination, $prompt, [Text.UTF8Encoding]::new($false))
    [pscustomobject]@{packet=$packet.Name;sourceSha256=(Get-FileHash -LiteralPath (Join-Path $root $packet.Scope)).Hash;bytes=(Get-Item -LiteralPath $destination).Length}
}
