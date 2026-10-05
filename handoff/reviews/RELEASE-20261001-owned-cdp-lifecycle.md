# Independent review — owned CDP proof lifecycle

Accepted for a bounded source commit and draft PR update. Official CI on that
exact successor remains required for release acceptance. Laptop session
01a0ecbc-469b-7671-b1d1-d3e6bab40c98 remains controller and final integrator.

Basis: `58cd09ad13987bafb6068ab72a753746a555bfa5`, tree
`3448877604d41fd5ec12eceae763010c378cd012`. Root did not implement the three
test/helper paths and personally executed the proof below after inspection.

CI 36834555882 attempts 1 and 2 timed out in Order459 at the unchanged 120-second
limit. Attempt 2 passed the native PowerShell tests but did not execute the
browser's 1,113 assertions. The old source passed a focused local reproduction.
The precise CI stall is still unlocated; no flaky-test or root-cause claim is made.
Both failed attempts and the initial candidate's TypeScript failure are retained.

The successor reuses the existing executable browser resolver, bounds the CDP
HTTP request including JSON parsing at five seconds, validates the owned loopback
target, and reports browser/startup/viewport phases without private values. Exact
owned-child cleanup tries Browser.close, then bounded TERM/KILL escalation and
exit observation. A callback failure remains the primary failure. No arbitrary
PID or process-wide kill is introduced. The original UI test body is byte-identical
after removing only new diagnostic lines; its assertions, cases, commands and
120,000 ms budget remain unchanged.

Personal executable proof on Bun 1.3.14:

- Controlled stalled HTTP body aborts and cancels its stream; a never-resolving
  graceful request and TERM-ignoring child finish within the explicit bound,
  preserve the callback error and leave an unrelated child alive. Already-exited
  child preserves the successful proof result. Three tests, 13 assertions.
- Focused lifecycle/resolver/actual browser/native-resume run on two CPUs:
  13 passed, 0 failed, 1,148 assertions, 15.640 seconds. All five viewport phases
  complete; exact owned subreaper reports two adopted children reaped.
- Default standing: 2,523 passed, 1,580 existing database-environment skips,
  0 failed, 44,992 assertions, 63.802 seconds. No test/concurrency/deadline changes;
  external task-owned subreaper reaps 115 adopted children.
- Typecheck exit 0, 207 import boundaries, whitespace clean.
- Literal unchanged `./setup.sh --db-only`: 11 passed, 0 failed. Actual PostgreSQL
  18.6 catalogue is frontier 100, 130 tables, 120 RLS tables, two invoker views.
  Every migration checksum matches. Existing retained synthetic schema/ledger,
  row counts, database catalogue, global role flags and authority bytes are
  unchanged. Disposable yellow_test is absent afterward. Only the exact owned
  synthetic app was paused for the existing runtime-session guard and restored
  with the same container/image; no business database was used.

Frozen SHA-256:

- Browser: `ec9f6cf9ed1b2df9958d1a003171c47df996a469030372987079871b73f318cf`
- Helper: `763d4106889cad956a9be19bfef6034660c8cec1eb8dd758849709b9435c254b`
- Lifecycle test: `644ce18dd2ad5edcaa68fb306c48bb12cf139d62cf4899482b4309d4c5bf024d`

Evidence outside source Git is in
`/workspace/yellow-coordination/release-20261001/owned-cdp-review-{focused,standing,static,boundaries,canonical,source-equivalence}.json`.
Standing log SHA-256:
`c702ff88a3d49a91b4625393ed55cb647d0559f8b90d76bcf512956fcbb9894d`.
All 100 migration files remain identical to e06e400a; no cloud 0101 exists.

No product, portfolio, phone, frontend, DB, migration, schema checker, CI or native
PowerShell changes. No self-merge, deployment, laptop overwrite, credential
transfer, paid fallback or phase-completion claim. The shared tester app must use
the latest controller-accepted integrated release; current older VM container,
secure route and business-data recovery are separate open gates.
