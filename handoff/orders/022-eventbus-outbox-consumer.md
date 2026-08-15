> **AMENDED by `handoff/questions/011-ARCHITECT-RESPONSE.md` (D-94) — read it first.**
> **D:** the "no migration" line is **withdrawn**. `migrations/0002_kernel_consumer_cursor.sql`
> is authorized and its exact DDL and semantics are specified in the response.
> `push_cursor` is **not** repurposed. `0001_init.sql` remains untouched.
> **AMENDED by `handoff/questions/014-ARCHITECT-RESPONSE.md` (D-97).** The authorized
> migration changes executable schema accounting. Scope gains only the migration,
> generated schema snapshot, setup/state table-count text on both supported paths, and
> the Windows walkthrough's derived count. The exact result is 83 public tables:
> 80 baseline + 2 kernel consumer tables + `schema_migration`.
> **AMENDED by `handoff/questions/015-ARCHITECT-RESPONSE.md` (D-98).** D-94's
> `FOR UPDATE SKIP LOCKED` on shared outbox rows is withdrawn. Serialize instances of
> the same named consumer by locking that consumer's cursor row `FOR UPDATE`; read
> outbox rows without row locks so different named consumers each receive every event.
> **AMENDED by `handoff/questions/016-ARCHITECT-RESPONSE.md` (D-99).** PostgreSQL
> identity allocation is not commit-ordered. `publish()` must take the fixed outbox
> transaction advisory lock before inserting, so no later seq can commit before an
> earlier uncommitted seq and become invisible behind a durable cursor.

# ORDER 022 — EventBus port and in-process outbox consumer

**Phase:** 1 · **Branch:** `phase-1/eventbus-outbox` · **Tier:** 2
**Written by:** Claude (architect) · **Date:** 2026-08-15 · **Decisions:** D-13, D-14

## Goal

Cross-context effects are published through one `EventBus` interface backed by the
transactional outbox, with in-process consumers reading by `seq` from a cursor row.

## Why this shape

D-14 defers NATS until the first out-of-process consumer or second node, and says the
swap must be a config change. That is only true if nothing imports the transport. The
interface is the deliverable; the Postgres implementation is behind it.

## Scope

`src/kernel/event-bus.ts` (port), `src/kernel/outbox.ts` (Postgres implementation and
cursor consumer), `src/kernel/index.ts`, `tests/outbox.integration.test.ts`.
`outbox` and the push_cursor pattern exist in the baseline — **no migration**.

Amended Scope under D-94/D-97: `migrations/0002_kernel_consumer_cursor.sql`,
`tests/schema/expected.sql` (runner-generated), `setup.sh`, `setup.ps1`, `state.sh`,
`state.ps1`, and `docs/WALKTHROUGH-WINDOWS.html` only for the 83-table accounting.

## Required behaviour

1. Publishing writes an outbox row **in the caller's transaction**. An event whose
   transaction rolls back was never published — that is the whole point of an outbox.
2. Consumers read by `seq` with a per-consumer cursor row, per §9's existing pattern.
3. No consumer imports anything Postgres-specific; they take the port.
4. Subjects map 1:1 to EVENTS.md so the NATS swap stays a config change.

## Pre-registered proofs

| # | Proves | Must show |
|---|---|---|
| P1 | Atomic with the write | mutation + event commit together; rollback publishes nothing |
| P2 | Ordering | consumer observes events in `seq` order under concurrent publishers |
| P3 | Cursor durability | consumer restarted mid-stream resumes at its cursor, no gap, no repeat |
| P4 | Port is honoured | a compile-time or test-time assertion that no consumer imports the Postgres module directly |
| P5 | Named consumers do not steal | two different consumers run concurrently and each observes the same complete ordered event set |
| P6 | Seq cannot commit out of order | publisher B remains blocked after publisher A inserts but before A commits; after release, durable seq order matches commit order |

## Forbidden

`LISTEN`/`NOTIFY` as the delivery mechanism (D-13: PgBouncer) · adding NATS, a broker, or
any dependency · publishing outside the caller's transaction · deleting outbox rows
(pruning is `prune_outbox`, already in the baseline) · editing any migration other than
the authorized new `0002_kernel_consumer_cursor.sql` or
`tests/run_invariants.py` · merging.

## Note for Order 023

Order 023 carries the phase's hardest DoD line — kill the relay mid-batch, restart,
nothing lost or duplicated. Design the cursor here with that test in mind; if you find
yourself wanting at-most-once semantics to make it easier, stop and ask.
