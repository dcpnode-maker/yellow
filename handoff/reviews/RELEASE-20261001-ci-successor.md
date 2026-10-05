# RELEASE-20261001 — independent CI successor source review

Verdict: **accepted for bounded reviewed source publication**, including the
Windows diagnostic changes needed to collect genuine CI evidence. Final applicable
local source, migration, browser and standing gates pass. Required Windows execution
and the clean committed container launcher remain pending; this verdict does not
close the release, laptop integration, live runtime or phase.

## Independence and source

This reviewer implemented none of the reviewed scripts, tests, orders or governance.
Actual shell/file access was verified, including after the environment reconnect.
Only this admitted review and outside coordination evidence were written.

Published basis: `a0fecd984800baa317a6140eef6ed4ab9528d9e0`, branch
`phase-7/release-local-gates-20261001`, draft PR98. The final order and question admit
seven source/test paths and five governance/review paths. The final seven-path
sorted hash-map SHA256 is
`8a60fe4fe882eccb6afc00773aa04d2ea8a77ce79cebcb397f319b0b611a1f12`, recorded in
`independent-ci-successor-final-freeze-cdp.json`. Every source hash remained unchanged
through final proof. All other tracked bytes match the basis, including all **102
migration/schema/referee files**, product code, authority wiring, existing process
helper, image definitions, package versions, generated assets and CI configuration.
DECISIONS.log and handoff/LEDGER.md remain append-only.

- `local-review.sh` changes only Git mode 100644→100755. Its identical-byte SHA256
  is `4e98e52e63d8744c80bd47614037396d8ea749512ff0c2479f062d8e6eb8f0cc`.
  Personal direct execution reaches its early usage guard; root's documented start
  invocation reaches the dirty-checkout guard before database/runtime work.
- The dump guard requires exact PostgreSQL 18.6 for the already-pinned Compose
  transport and preserves exact 16.15 for native transport. Mutual exclusion,
  absolute native executable, deployment role and isolated database predicates
  remain. Historical equality, rollback, checksum, ACL and nullability assertions
  are unchanged. The image validator adopts the existing exact 18.6 digest and the
  new committed-file test catches the actual prior mismatch.
- Windows supervisor changes reconstruct the basis exactly after removing the
  TestMode-only stage function/calls. Diagnostic output selects literal allowlisted
  markers; timeout cleanup reuses unchanged PID, parent, UTC start, executable and
  script predicates. All 19 native case names, original cleanup probe, outer/inner
  bounds, scrubbing and capped log retention remain.
- The final invoice proof uses actual loopback CDP and real browser time with the
  existing `runOwnedProofProcess` as its sole 20-second/1MiB process owner. Debugger
  work races the same lifecycle; completed-proof observation/capture has a hard
  five-second rejection timer cleared in finally. Abort and socket/pending-command
  cleanup retain the owner's kill/drain/reap responsibility. Both scenarios, the
  original fixture, complete assertion/finally block and 50-second case bound are
  preserved. Only Review's premature sleep(0) snapshot now uses the existing
  three-second condition helper for the same asserted heading focus. No focus or
  product behavior is injected; other virtual-time cases remain unchanged.

## Executed and recovered evidence

Safe logs/receipts are under `/workspace/yellow-coordination/release-20261001/`.
Private authority remained inside the existing admitted wrappers. Required migration
proof used the owned `yellow-catalogue-referee` project, loopback 55442, deployment
`yellow_deploy` and restricted runtime `yellow_runtime`, with isolated synthetic
databases. No other database or guest data was used. The independent wrapper changes
only log/receipt names. The saved canonical receipt was recovered after reconnect,
its log hash and all 11 PASS records verified; no substitute database run was made.

| Proof | Result |
|---|---|
| Personal full required migration suite | 61 passed, 0 failed, 481 assertions; exact pg_dump 18.6; 140.97s |
| Independent canonical setup receipt | 11 passed, 0 failed; 130 tables; disposable yellow_test removed; 5.75s |
| Genuine committed-file image regression with basis validator | 4 passed, 1 expected failure, 8 assertions |
| Candidate image tests and actual CLI | 5 passed, 0 failed, 8 assertions; CLI passed |
| Final complete invoice file, three fresh serial processes | 6 passed, 0 failed, 133 assertions each; 3.28/3.33/3.28s |
| Personal final default standing | 2519 passed, 1578 explicit environment skips, 0 failed, 44976 assertions; 61.28s |
| Final types / import boundaries | Passed; 207 TypeScript files scanned |
| Linux native-tooling run / required-platform negative control | 1 passed, 19 native skips; required gate correctly rejects Linux |
| Linux PowerShell parse and existing narrow AST checks | Passed; source checks only |

The migration run includes historical primary/fresh schema boundaries, rollback,
no-op and checksum controls rather than a current-frontier-only subset. The browser
and default runs use original cases and deadlines with no concurrency/retry flags.
An unchanged external task-owned Linux subreaper supplies orphan reaping absent
from container PID1; it reaped 116 adopted children during final standing. Skips are
not database or Windows evidence. All final browser/default/static log hashes were
verified. Final standing log SHA256 is
`f6199497efd2576b7bc9050f66cfcc5be1a447ec0e56e09845bea5b67f6913f3`.

## Preserved failures and remaining gates

The superseded compositor-only candidate passed three isolated files and root's
default run, but personal default remained **RED: 2518/1578 skips/1/44963**. Its
unchanged Back-focus wait exhausted three virtual seconds in 319.74ms of wall time.
That receipt remains `independent-ci-successor-standing.json`; the flag was removed
and is not accepted as a repair. Root's earlier reconnect execution also retains
its completed raw RED of 2517/1578 skips/2/44963 and absent enclosing receipt; no
unique interruption cause is claimed. The final CDP GREENs above belong to the
subsequent explicitly admitted synchronization changes, not retries of those REDs.

Genuine Windows CI must execute all 20 cases before Windows closure. Linux parsing,
platform skips and diagnostics do not meet that gate. The clean committed launcher
must prove actual container readiness and login after commit; dirty-checkout and
mode proof do not meet that gate. Current remote CI, laptop receiving source and
immutable serving identity require their own receipts. This review authorizes no
self-merge, deployment, provider activation, paid fallback or broad product claim.

Quota remains laptop-monitored: stop/checkpoint on a <=1% notification, with no
emergency credit, reset or automatic resume. No such notification was received
during this bounded reviewer execution.
