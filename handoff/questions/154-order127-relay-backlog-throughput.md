# Question 154 — Order-127 relay backlog throughput

**Status:** RESOLVED BY D-398 — CORRECTION READY
**Order:** 127 · runtime database authority
**Branch:** `phase-5/runtime-database-authority-final`
**D397 rerun head:** `ed1397b`
**Related decisions:** D-392, D-397, D-398

## RESOLVED

## P5 affected-proof stop

On a fresh exclusive v15 database with the canonical fixture, the corrected outbox
proof passed 7/7. The relay then passed crash rollback/restart, crash-window recovery,
polling cadence and two-instance dedupe, but its unchanged 10,000-row backlog case
timed out at exactly 60 seconds inside repeated bounded `drainOnce` calls. The timed-out
operation remained active until teardown, which consequently observed a closed
connection. The disposable database, project, network and volume were removed and
Docker was stopped. This run is not proof.

Inspection identified two cumulative per-row/scan hot paths within existing admitted
scope. The capability selected unpublished rows through a parameterized CASE predicate
that did not expose the existing `published_at IS NULL` partial-index predicate as a
static branch. The adapter also issued one scalar dedupe-mark round trip for every row.

## D-398 exact correction contract

`runtime_consumer_read(text,bigint,integer,boolean)` retains all validation, the exact
consumer cursor lock, result columns, ascending sequence order and bounded limit. It
uses two explicit static query branches: unpublished is exact `published_at IS NULL`,
and cursor consumption is exact `seq > p_after`. No dynamic SQL or result change is
allowed.

For one current bounded ordered/unpublished batch, the outbox adapter may send the
rows' IDs once as an ordinal input and invoke the existing scalar
`runtime_consumer_mark(text,uuid)` set-wise. The statement returns one inserted flag
per input in original ordinality. Existing handlers still execute sequentially and
tenant-scoped in the same transaction, skipping already-marked rows exactly as before;
cursor advance, publication, rollback, crash and retry behavior remain unchanged.
Input is the already bounded batch only and never exceeds 1000 IDs.

Fresh proof must retain the exact 10,000-row, 250-largest-batch, 40-batch,
under-128-MiB and under-60-second assertions, plus all earlier crash/dedupe cases and a
normal process exit.

## Exclusions

No new capability, grant, table, index, interface, batch limit, concurrency model or
handler behavior is authorized. D-398 forbids dynamic SQL, direct runtime table access,
reordered handlers/results, handler parallelism, cursor weakening, timeout increase,
RSS/assertion weakening, reuse of timed-out evidence, self-review, merge, push,
deployment or Cyber closure.
