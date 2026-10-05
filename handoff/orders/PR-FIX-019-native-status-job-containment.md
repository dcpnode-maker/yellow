# PR-FIX-019 — Native status probe process-instance containment

Founder continuation, 29 September 2026: finish the Yellow ecosystem without
discarding useful work. Continue the existing PR97 repair candidate; this is the
small executable prerequisite to its still-red full-suite gate, not a new plan.

## Exact scope

- `state.ps1`: replace the optional diagnostic's separately spawned PID-tree
  killer with an unnamed Windows Job Object owned by this invocation. The fixed
  `cmd.exe` wrapper must wait for a random stdin admission token before invoking
  either fixed read-only Docker command; send that token only after assigning
  the exact process handle to the kill-on-close job. Do not allow breakaway.
- `tests/project-status.test.ts`: preserve all current status/phase, malformed
  metadata, unavailable/success/slow probe and EOF/deadline assertions. Add real
  Windows child/grandchild containment and early-root-exit coverage, plus an
  admission-failure proof that invokes no Docker command.
- This order and `handoff/reviews/PR-FIX-019-native-status-job-containment.md`.

## Forbidden

No wider 650 ms operation, 1,000 ms lifecycle or 4,500 ms caller budgets; no
process-name/PID-reuse kill, taskkill fallback, admin/approval change, Docker
daemon or live app/database restart, migration, dependency/licence exception,
credential inspection/export, old failure deletion, own PR merge or unexecuted
Windows-proof claim. Do not change Unix behavior. Parent alone writes.

## Definition of done

1. Preserve the existing intentional-red status evidence and reproduce a paired
   test failure before implementation.
2. Fresh native tests prove exact-process admission before execution, complete
   job-tree termination and EOF within the unchanged limits, including a root
   that exits before its child. Failure to establish admission/cleanup remains
   nonzero/fail-closed, never a green unavailable-status workaround.
3. The actual repository status report and focused/standing suites, both strict
   compilers and import-boundary checks pass; skipped database proof remains
   explicit. Record source hashes and commands.
4. Independent non-implementing review is still required before accepting this
   containment correction or publishing the whole ancestry candidate as green.
   Configured reviewer unavailability is recorded, not replaced silently.

Primary design reference: Microsoft Windows Job Objects documentation,
https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects .
This uses the Windows system API already on the laptop, not a new package.

Status: implementation in progress. Existing remote PR97 source, its missing
ordinary CI proof, tslib/0BSD policy decision, isolated referee and independent
ancestry acceptance remain separate gates. Prior failed Kaggle batch is closed;
no remote job or model output is executed by this order.
