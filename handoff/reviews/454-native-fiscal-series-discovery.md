# Order454 independent settled-rejection review — 2026-09-09

Reviewer: `receipt_oracle_acceptance` (Sol), independent of the root-authored
runner and discovery-worker-authored test. This review covers only the isolated
settled-rejection successor. It does not approve the original full integration
suite, signed HTTP proof, release, or publication.

## Static review

Exact reviewed files:

- `.yellow/evidence/order454/retained-settled-rejection.ps1`, SHA-256
  `9c3d851f1d9e54e1a619dda27bf4863a1e2b7be61d962e5bc00a734b103e3616`;
- `.yellow/evidence/order454/retained-settled-rejection.integration.test.ts`,
  SHA-256
  `2c33501b910aca80da58bd8f542d03b112a8c65544e582e5a11dadc177f308f9`.

All 16 internal source/evidence/tool/status pins matched. The reviewer personally
read every imported AST helper from the pinned
`scripts/order444-native-review.ps1`: private ACL assertions and setter,
protected environment parsing, exact credential URL parsing, retained credential
reader, bounded stream pump, and private child launcher. The source script's
top-level workflow is not evaluated.

The test is bound to paired `yellow_deploy` and `yellow_runtime` identities at
`127.0.0.1:55503/yellow_order453_referee90_20260908`, requires all three native
admission gates, and is rejected by the wrapper if skipped. It imports no fixture.
Its database operations are read-only snapshots and the production discovery
`WITH`/`SELECT`; transaction-local tenant/role setup and settlement do not create
persistent database state. Every one of the seven retained cases requires exactly
one query, the expected raw authority result, an explicitly settled rejection of
the exact class and message, and byte-equal public rows/catalogue/sequences before
and after. The wrapper additionally requires all seven completion/settlement/
snapshot/wrapper stages and both pool-close stages.

The production operation retains its 120-second Bun test ceiling, hooks retain
the pinned Bun 1.3.14 default five-second bound, and only the imported child pump's
outer ceiling is changed in-memory from 120 to 180 seconds. Output is bounded and
private, failure is secret-safe, host and source pins are rechecked in `finally`,
and no retry is present. Static review found no semantic or database-safety blocker.

Immediately before execution the reviewer observed only the exact PostgreSQL
listener on `127.0.0.1:55503`, PID 15956 with the pinned executable/start time;
ports 3000 and 3001 were absent. C, D, and E each exceeded the four-GiB guard.
No database query was made during this preflight.

## Independent executable result — failed before Bun/database

The one admitted reviewer execution used:

```powershell
& 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -NoProfile -ExecutionPolicy Bypass -File '.yellow\evidence\order454\retained-settled-rejection.ps1' -ExpectedRunnerSha256 '9c3d851f1d9e54e1a619dda27bf4863a1e2b7be61d962e5bc00a734b103e3616' -ExpectedTestSha256 '2c33501b910aca80da58bd8f542d03b112a8c65544e582e5a11dadc177f308f9' -ExecuteAfterRootHandoff
```

Result: exit 1 after 5.04 seconds. Windows PowerShell 5.1/.NET Framework reported
that `Dictionary<string,string>` has no `TryAdd` method while the imported
`Read-ProtectedEnvironmentMap` parsed the protected retained environment. This
happened before the runner created its stamp/log, invoked Bun, or opened either
database pool. Consequently there is no independent native proof log and no
database effect from this attempt. No retry was attempted.

Root's earlier exact execution remains separately recorded as two tests passing,
seven native cases rejecting, unchanged snapshots, and both pools closed, with
protected log
`.yellow/evidence/order454/native-logs/20260908-212243-923-3efde621-retained-settled-rejection.log`,
SHA-256
`f315340190ca3209093f20ff034c53f6f3d12f37860a586fafd5567ea738b338`.
That implementer-side result is not substituted for the required independent
execution.

## Disposition

Independent executable acceptance is **not granted**. The runner has an unstated
PowerShell 7 dependency: its hashes and database guards are exact, but it does not
declare or reject Windows PowerShell 5.1 before protected-environment parsing.
A separately admitted execution using the exact PowerShell 7 host, or a separately
reviewed runner-level host/version guard, is required. The original full suite and
signed HTTP path remain outside this successor review regardless of that outcome.

## Corrected PowerShell-pinned successor — independently accepted

The amended Order454 retained the failed predecessor above and separately admitted
one execution of runner successor
`251991f1725bc85fef25af3b9cc49baad38aa0249be614cb65533e41d23a1158`
with the unchanged test
`2c33501b910aca80da58bd8f542d03b112a8c65544e582e5a11dadc177f308f9`.
The only runner prerequisite change is a fail-fast guard, before credential access,
requiring PowerShell Core 7.6.5 at the exact bundled executable path with SHA-256
`362a356ce7f0940ec74f73a8fc2c990a2cc24a38a11c90bbd8eca947110ad139`.
The reviewer read the amended admission and guard and recomputed both runner and
test hashes before execution.

The single newly admitted command was:

```powershell
& 'C:\Users\astha\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe' -NoLogo -NoProfile -NonInteractive -File '.yellow\evidence\order454\retained-settled-rejection.ps1' -ExpectedRunnerSha256 '251991f1725bc85fef25af3b9cc49baad38aa0249be614cb65533e41d23a1158' -ExpectedTestSha256 '2c33501b910aca80da58bd8f542d03b112a8c65544e582e5a11dadc177f308f9' -ExecuteAfterRootHandoff
```

Result: exit 0; wrapper wall time 11.12 seconds. Bun reported two tests passed,
zero failed, 63 assertions, and 5.71 seconds across the one exact test file. The
database case took 5,570.64ms. All seven retained cases emitted exactly one
`operation-settled` rejection, `snapshot-after-done` with `unchanged=true`,
`wrapper-returned`, and `case-complete`; the log contains one runtime-close and one
deploy-close stage. No skip, fixture creation, cleanup, timeout change, or retry
occurred.

Independent protected log:
`.yellow/evidence/order454/native-logs/20260908-212736-829-caa09b37-retained-settled-rejection.log`,
15,392 bytes, SHA-256
`49a3239fcdfed70a21bcac189da5d85dbcf26258e265643c90eca6039418dd99`.
It is a regular non-reparse file with a protected single-rule ACL.

This fresh result supersedes only the predecessor's withheld executable disposition:
the isolated settled-rejection successor is independently **accepted**. It proves
the seven retained discovery denials/unavailability cases settle with their exact
errors and no captured database change. It does not approve or rerun the original
full suite, signed HTTP route, release, publication, or live promotion.

## Full native suite and fresh signed HTTP — 2026-09-09

Root executed canonical settled-assertion testae6ccb66:10pass/0fail,253 assertions,
38.19s. Full-suite final61785924/observedf17633be preserve1,437 prior rows and
eight complete companions/globals/catalogue/ledger/protected sequences; only the
admitted173 fixture rows/two cohorts/six codes were added. Nonimplementing
windows_test_acceptance personally executed the read-only Q247 audit: exit0,
15.34s, audit59bc5056df18688f1e0a03333747956119111eed7658e5c74af46db9f6c1d426.
It checked exact cohort ownership,19 numeric-contiguous owned outbox rows and
recaptured all protected state; it did not rerun fixtures.

The old signed HTTP run4/1 remains retained as logcc911f9c. Exact diagnostic
78ae371b proves September8 supplier evidence versus September9 property-local
date for all three old pairs, with valid actor authority and sanitized503. No
production predicate, test or old record was changed to make this pass.

Root and independent discovery_retained_repro read new runner5034db6d and
selectors7507e7a7/896a0ca9. Existing fresh full-suite-owned cohorts produced
manifest9fb1b9e38618d34fd96fd8f0f2c8b093098128f771362d26e18f64db899ccf5d.
Root and reviewer personally executed the unchanged HTTP test8837cb39 with
the pinned bundled PowerShell7.6.5 runner, Action Execute, respective Actor
Root/Independent, exact runner/manifest hashes and explicit RootHandoff.
Both exit0:5pass/0fail/no skips,66 assertions,2.39s and2.70s respectively.
Independent wrapper wall time7.92s. Every public row, public catalogue and public
sequence matched before/after, and all five exact admitted series identities
passed. No listener, new fixture writes, status backfill, edits or retry.

Protected q247-http-successor-logs/signed-root.log SHA256:
280ebd3981d8682c62c5f5e535d2259a34236464f55abe8a94490153f451e9db.
Protected signed-independent.log SHA256:
7e47c9187cb9ec19b59091e68a528eff1d39b7345904c7db7487fa98fc53ce24.
This accepts the actual discovery SQL and signed HTTP proofs only. Exact-source
standing/CI/publication and version-correct local promotion remain separate.
