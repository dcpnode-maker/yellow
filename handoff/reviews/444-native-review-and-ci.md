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

## Actual promotion preflight correction

The first live Promote failed closed before staging or stopping old3000 because
PowerShell7 exposes the real junction Target as a scalar string. Indexing
Target[0] compared only C. Root observed actual and receipt paths are identical.
provider_transport_builder corrected only normalization/identity guard and added
the actual temporary-junction regression (initial18/1, final19/0/33).

Nonimplementer fiscal_http_acceptance personally executed the final required
Windows suite with YELLOW_REQUIRE_ORDER444_NATIVE_REVIEW=1:19pass,0fail,
34assertions,42.29s. The flag contributes the extra required-platform assertion.
Final helper SHA6719c15bab5356c188b7975dfe047a40f7ee40dd8f4bdb3273d171b8a85cfb79;
test SHA9d4662ea1a10f67aac753380bcf6996372146ffd4316ab29647fd675f3f7f1c0.
Both hashes matched before/after. The reviewer then loaded exactly12 named
FunctionDefinitionAst extents into a fresh pwsh process, never the entrypoint.
Actual prepared Read-CandidateIdentity passed against the genuine scalar target;
single-array control passed and eight invalid identity controls failed closed.
Full archive/file-map comparison and five protected artifact hashes stayed equal,
4.57s. No runtime, database, receipt, environment or junction was changed.

Root admits retrying the existing exact a1085178 promotion with this independently
verified orchestration-only helper delta. Application archive58a32748 remains
unchanged, with its all-sixCI34095296622/normalCodeQL34095293723 successful.
Those CI results are not represented as testing the later helper correction.

The second attempt reached the separate supervisor, whose duplicate production
check still indexed Target[0]. It exited before status/log/child creation, leaving
old5716 unchanged. The first correction's acceptance was therefore incomplete.
Both failures remain recorded; neither is an application or database crash.

Final independently accepted pair: orchestrator6719c15bab5356c188b7975dfe047a40f7ee40dd8f4bdb3273d171b8a85cfb79,
supervisor8e57dd3bfb5807db06db241985e2a2d3d366782f1ff6d42fefdc6d9765256aea,
test2f32fe0d8d70675e34202a59c8f1aab64cdc53e37fc046aedbe0067a55197ed1.
Reviewer personally executed required19/0(34),45.30s, then both actual prepared
preflights using12/7 named AST functions,7.49s. Real scalar and single-array
controls pass; eight hostile controls per helper deny. All five protected
artifacts and source archive remain unchanged. Both production callers now use
the checked normalized target; no raw Target[0] remains. No runtime mutation by
the reviewer and no inherited CI claim for these changed helper bytes.

## Q211 self-hosted identity — independently executed acceptance

Nonimplementer fiscal_http_acceptance personally inspected all eighteen pinned
upstream objects in memory: the font and both full licences are byte-exact, and
all fifteen original SVG path bodies match the canonical symbols. Two explicit
routes return the exact MIME under unchanged self-only CSP; eight unlisted,
traversal and suffix variants return404. No package or remote resource is added.

Review found two missing proof details: a database-gated legacy URL assertion
mistook the standard SVG namespace for a remote dependency, and fallback had
only CSS evidence. Implementer native_resume_builder repaired only the admitted
oracles and added a real blocked-font case. The reviewer then personally ran the
final static/route/legacy suite:10pass,0fail,8explicit database skips,170 assertions,
560ms; final Chromium:1pass,0fail,1296 assertions,9.14s with captures enabled.
Builder's no-capture run has1289 assertions,7.78s; these are separate executions.

Browser proof covers the three layouts,1440/1024/768/390/320 CSS-pixel widths,
forced colours, fifteen visible unique currentColor symbols,44px targets, icon
contrast at least3:1, keyboard focus, retained mounted workflow and no layout-only
request. Blocking the sole font yields NetworkError and zero transferred bytes;
actual CDP platform-font inspection proves visible glyphs use noncustom system
fonts, not Urbanist. Reviewer inspected six captures including320px and forced
colours. This is not200percent zoom or complete journey/design acceptance.

Frozen reviewed SHA256:

```text
src/app.ts a03e6c621309a1f3dc3b774484f696c1b34b0979936ec74862b89bf3968f6f69
src/http/operator.ts 03dd2a01d762b0f078d79fbabc41c9e4a09a38e66914606eab74e618e793eef3
src/http/operator/index.html 2c0b2e30159c2b867ee6c4ce36709a94eea3d011bc39b1ae4b11e4ee76b0362d
src/http/operator/operator.css 3623fc7931f94b01847d687740f4b8f76150ba28c29dd2e36e527f196d16d55f
vendor notice 2dcfea8e373c67dc914afc4ae6687b5e04ecbf9a1891aab9958602f96be6e711
tests/operator-visual-identity.test.ts e300739347b8050362d260d3fe3d1e6f2b8c4fcc7a6fae5f66ada3ff29b8de0e
tests/operator-workbench.integration.test.ts ef810b3f47178a2d41c6b9cd0da12ef72bae378d75ff05c4b3ad701bc916e189
tests/operator-workspace-layout.browser.test.ts fc4a76c7333292fe73025fdd446f447aa49d079bb297f10b0abefca64c116f13
tests/operator-adaptive-experience.test.ts b0badd679d5ecbe5bf7b4a1cc468c9b3e03ee5241305d71c68f3c47092da5801
tests/operator-flagship-motion.test.ts 4d833be80c8f4e973d09ae90e30a4495e37739ca47c7cd3ea5644bb2597e955b
```

No Q211 blocker remains. Current mixed-tree typecheck sees two concurrent Q212
receipt-test errors; no Q211 diagnostic was reported. Complete isolated candidate
quality, current-source CI and later asset runtime publication remain separate.
No live preview or database was changed by this review.

## D1427 — unchanged native-helper bounded rerun and publication

Nonimplementer `native_helper_release_proof` personally ran on Windows:

```powershell
$env:YELLOW_REQUIRE_ORDER444_NATIVE_REVIEW = '1'
bun test --timeout 30000 tests/order444-native-review.test.ts
```

Result:19pass,0fail,34assertions,48.81seconds, Bun1.3.14. Three exact source hashes
were unchanged: orchestrator6719c15b…, supervisor8e57dd3b…,
test2f32fe0d…. These are the same previously reviewed source changes, not new fixes.
The earlier coordinator run17pass/2fail/2errors hit default5-second test deadlines;
it is retained as failed evidence. The larger explicit test-runner deadline matches
the existing nested process bounds and does not weaken assertions. This rerun
does not establish a unique cause for the earlier timing failure.

Root selectively committed exactly those three files as
d0f2f86391dfa1529f5436e7d866834bedda3608 and pushed to draftPR92.
The2045 unrelated index entries have the same before/after SHA256:
e34339e832fccbab762be5614d9bce840c5f0b191f5a998743df9ee31415a6ad.
No visual edits were published, no live app or database was promoted, and no
source branch was merged to main. Exact-head CI remains separately tracked in
PROJECT-STATUS.md; prior source green results are not substituted for it.

Nonimplementer final log inspection: CI34142116072 for d0f2f863 completes all six
jobs successfully. Database101806743003 finishes16:33:44Z: migration53/0(392),
seed10/0(63), explicit85→86 rollback/upgrade/no-op/checksum and fresh86 equality,
native downstream zero-fail suites, canonical referee11/11(118/118 RLS,2 invoker
views,100 gapless), and database-backed runtime step. Windows required helper
proof19/0(34),26.83s runs on the PR merge ref containing the exact head. Normal
CodeQL34142113265 passes all three analyses. No run was dispatched or retried.
This accepts that published checkpoint's checks, not new uncommitted Order446,
not an independent main merge and not live app promotion.
