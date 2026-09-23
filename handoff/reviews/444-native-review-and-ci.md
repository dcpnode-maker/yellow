# Order444 / Q209 — Independent native tooling acceptance

Reviewer: Codex root, who did not implement either native helper or its tests.
Date:2026-09-07. Parent: Order444; file scope admitted in Question209.

## Exact reviewed source

| File | SHA-256 |
| --- | --- |
| scripts/order444-native-review.ps1 | c88d4ca45e6e9d7e797daf66fa5f3747046e503dfcfe1b34eb9d44e4c1d6ad00 |
| scripts/run-order444-native-review-bounded.ps1 | 742adbf8fc7e1c3320752f1728e4d11c9431dbd9a72be6992a9e78e6b698d804 |
| tests/order444-native-review.test.ts | a86fd1e739d7186087e909bd78b45cf108dc5ccf4a3b502e3f8474f7fdb8304c |

Root read both complete helpers and personally executed the required native suite:

```powershell
$env:YELLOW_REQUIRE_ORDER444_NATIVE_REVIEW='1'
& 'C:\Users\astha\.bun\bin\bun.exe' test tests/order444-native-review.test.ts
```

Result:18 passed,0 failed,33 assertions,44.60s. Proof covers exact namespaces,
receipts/archive bytes, protected controls, process/parent/start identity, rejected
foreign listeners, bounded and fully drained output, inherited-environment removal,
deadline and log-pump cleanup, failed-start child cleanup and delayed real loopback
binding. JSON POST argument binding and literal retained receipt discovery have
permanent regressions. Tests operate on owned synthetic processes and temporary
paths, not the retained app or PostgreSQL.

Root separately parsed the orchestrator AST and loaded only its eight read-only
identity functions into a fresh PowerShell process. With the exact retained source,
control, Bun, PowerShell and supervisor paths, root personally called
`Get-VerifiedOldLaunch`:PASS, child5716, supervisor16176, source
`b5ef70842b658183f7b5b4c650c8e78c7a0b513d`. No entrypoint was dot-sourced and no
Prepare/Promote/Rollback operation was invoked. The actual loopback3000 readiness
still identifies that predecessor. Private receipts and environments were read
internally only; credentials were not printed or altered.

## Findings and failed evidence retained

The earlier16/0 synthetic test pass was not sufficient: root's actual read-only
preflight failed because joined `-Filter'...'` arguments returned no retained
receipt. All three sites were repaired. Argument-token auditing also corrected
joined JSON ContentType arguments; actual in-memory HTTP parameter binding exposed
the forbidden PowerShell `$home` collision, now `$homeResponse`. No missing-receipt
or authentication problem was attributed to the founder.

Earlier findings repaired by the implementer include startup cleanup before caller
assignment, waiting for the actual delayed listener, exact process-time precision,
historical observation-versus-birth timestamp provenance, EOF drain before stream
cancellation, faulted log-pump reaping and separate retained role passwords.
The final executable proof above covers the repaired hashes, not those old versions.

## CI wiring

Current `.github/workflows/ci.yml` SHA-256:
`9c2ccdc104cb924987ab1d277b442f71d13bdebda3d6d9d9d5d3bfeef356ca00`.
Nonimplementing fiscal_http_acceptance parsed the complete YAML, executed29 wiring
assertions and the existing workflow suites15/0(235). Required Windows execution
uses the pinned Bun runtime and cannot silently skip; database CI creates one exact
disposable target and runs fresh baseline then fiscal seed proofs serially before
the canonical referee. Existing six jobs, action pins, split roles and masked
synthetic secrets are preserved. This is source review, not new-head CI execution.

## Decision and limits

No blocking finding remains for these native helper bytes. Implementation acceptance
does not authorize a moving-branch launch. Root must first record the exact frozen
candidate/archive, new source/control/database paths, commands and rollback under
Order444, then personally prove candidate readiness, prefilled login and real fiscal
journeys before switching3000. Final current-source quality and exact-head CI remain
required. No old database, credentials, app, provider or cloud state was mutated by
this review. This is not a full design, Phase7 or application-completion claim.

Final publication preflight: fiscal_http_acceptance personally rehashed all four
accepted seed files, populated proof6104d175, complete89 canonical inputs
0f7d6d44037d05eecbcc8f130398e1e9a88283ab518a40afb10e8d42b11d7d1d,
and schema9c7c57c5c33b40866ef806488e6309c55f65d3a02ef7728264a447641c35cc18
(1,732,510bytes). They match its actually executed85 proofs. No fiscal/domain/SQL/
runner/referee/seed-fixture/readiness/server or operator HTTP implementation drift
was found. That reviewer supports development publication after the full gate;
it did not rerun or claim current CI, merge or runtime acceptance. The subsequent
frozen full source run passes1863/0 with1316 honest skips,24884 assertions,201.13s;
all static/dependency gates pass. Root independently inspected the final Q210 diff
and hashes, preserving all18 phase states and the local77 versus candidate85 split.
