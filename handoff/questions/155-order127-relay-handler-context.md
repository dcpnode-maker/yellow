# Question 155 — Order-127 relay handler context

**Status:** RESOLVED BY D-399 — CORRECTION READY
**Order:** 127 · runtime database authority
**Branch:** `phase-5/runtime-database-authority-final`
**D398 rerun head:** `5255ac2`
**Related decisions:** D-392, D-398, D-399

## RESOLVED

## P5 affected-proof stop

The fresh D-398 relay rerun passed the static query-branch and set-wise-mark canaries,
plus all crash, polling and concurrent-dedupe cases, but the unchanged 10,000-row
backlog again timed out at 60 seconds. Each newly marked event still incurred separate
tenant setter, role-entry and role-reset round trips even when consecutive events had
the same tenant. The timeout left work active until teardown, which observed a closed
connection. The disposable project and volume were removed and Docker was stopped;
the run is not proof.

## D-399 exact correction contract

Within one existing bounded ordered/unpublished consumer transaction, already-marked
events and their handlers remain sequential in original order. The adapter may retain
`app_role` and the exact transaction-local tenant UUID only for immediately consecutive
events with the same tenant. Before the first handler and on every tenant change it
must enter an exact context: `RESET ROLE` when transitioning from an active context,
set the new transaction-local tenant UUID, then `SET LOCAL ROLE app_role`.

After every handler, before processing another event or advancing the cursor, one
exact verification must prove `current_user = 'app_role'` and the transaction-local
`app.tenant_id` equals that event's tenant UUID. Any handler exception, role/tenant
tamper, verification mismatch, RESET/set/role-entry failure or final RESET failure
rolls back the entire marks, handler effects and cursor movement. A final `RESET ROLE`
is mandatory on the success path before cursor advance/commit. Existing catch/rollback
containment remains fail closed.

Fresh permanent canaries must prove hostile handler role/tenant tamper rolls back every
mark/effect/cursor change and that mixed tenant order A/B/A never reuses A across B,
while preserving original handler order. The unchanged relay P6 must still prove
10,000 examined, largest batch 250, exactly 40 batches, RSS growth below 128 MiB and
completion below 60 seconds with normal exit.

## Exclusions

No handler batching, parallelism, reordering, skipped handler, cross-tenant context
reuse, context verification omission, new SQL capability/grant/table/interface, batch
limit change, timeout/RSS/assertion weakening, reuse of timed-out evidence,
self-review, merge, push, deployment or Cyber closure is authorized.
