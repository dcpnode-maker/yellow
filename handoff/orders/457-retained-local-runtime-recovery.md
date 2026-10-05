# Order457 — Recover the retained native local app after low-space safety stop

Status: bounded preparation admitted, 2026-09-08. Execution requires root review
and fresh admission of the exact helper and retained runtime evidence.

The existing a10851786f17f2fdea0cf970320ee8c46a45b670/frontier85 app stopped at
2026-09-08T17:02:12.9927276Z. Its supervisor explicitly records
`critical_low_space`, exit20, no automatic restart. Process7568/parent9508 and
listeners3000/3001 are now absent; retained PostgreSQL15956/55503 remains alive.
Terminal status SHA256 is
`b1b404ae310a42bcc7dcdddc5640fb49e9209bcf1c7ee2b89deb2d4f248253d5`.

A delegated state.sh probe incorrectly resolved system32/bash.exe to WSL despite
the task's no-WSL constraint. A new61,440-byte wsl-crashes dump was observed at
22:32:15 IST. Temporal overlap is established, not exact causation. No more WSL,
Docker or shell discovery is allowed; use only explicitly named native tools.
The app stop is not evidence of a product crash. Current free space is above its
safety thresholds; record fresh measurements before any restart.

## Scope

- this order; docs/PROJECT-STATUS.md; DECISIONS.log; handoff/LEDGER.md
- bounded new preparation/evidence under .yellow/evidence/order457/
- after separate execution admission: one restart of the exact retained runtime
  using its existing approved source/control/env, no copy, migration or reseeding
- narrowly bounded new recovery receipt and preserved original supervisor status
  under the exact existing order444-a108...-control directory

No changes to production helper/source/SQL/credentials, no branch/index/merge,
no current-worktree promotion, no new app3001, DB/server restart or fallback app.
Never overwrite original failure evidence. No automatic retry. Cleanup only a
failed newly owned child/supervisor after exact process identity validation.

## Required preparation and proof

Reuse reviewed functions from exact pinned scripts/order444-native-review.ps1
and its bounded supervisor by AST selection; never run Prepare/Promote/Rollback.
Validate canonical runtime paths, private ACLs, approved candidate/promotion
receipt/source archive/env/dependency identity, exact85 readiness and source SHA.
Preserve prior terminal status before a new supervisor status can replace it.
Fail closed on any occupied app/staging listener or retained live old process.
Use a hidden native pwsh supervisor, same exact source and database on3000 only.
Run existing read-only readiness/login/list/detail proof without business writes;
record fresh child/supervisor creation identities and bounded logs. Verify all
existing database and app-source inputs remain unchanged. No credentials in output.

This is restoring the already approved older local, not making it current to87da
or admitting production. Backend454/455 acceptance remains separate. Root must
inspect and personally execute the exact prepared recovery helper before claiming
the local is available again.

## Root review hold — 2026-09-09 local

Prepared helperf2d526d9 is NOT admitted for execution. Root and independent
`receipt_oracle_acceptance` find a contract conflict: the exact retained environment
requires six active workers, and retained server.ts starts their drain loops before
listening. They may commit normal cursor/projection/hold/reservation/task/business-day
changes while the recovery proof demands every row and sequence remain unchanged.
Stopping the process on a mismatch cannot undo those committed effects. Conversely,
a worker may commit just after the final snapshot; no quiescence barrier exists.

No restart, status move, environment edit or database query was performed for this
review. Before execution, a separately reviewed bounded preflight must prove the
named consumers already caught up and every time-based worker quiescent across the
entire proof horizon, or a new explicitly scoped recovery contract must account for
normal worker convergence. Do not silently disable workers or relax preservation.
Backend tests and source work are independent of this older-release recovery hold.
