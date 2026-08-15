# QUESTION 011 — approval lifecycle and storage contradict Order 025

**Status:** OPEN
**Phase:** 1 · **Order:** 025 · **Branch:** `phase-1/tenant-context-middleware`
**Raised by:** Codex (builder) · **Date:** 2026-08-15
**Hard floor:** D-92 invariant question; Order 025 explicitly requires this stop

## What the preflight found

`docs/STATE-MACHINES.md` does not declare an `approval_request` state machine. It
mentions approvals as guards and mentions carrying a discrepancy through an approval,
but it contains no exhaustive approval transition table. Order 025 requires the states
and legal transitions to already exist there and says to stop rather than invent them.

There is also a storage-shape contradiction that must be resolved with the lifecycle:

- `migrations/0001_init.sql` defines one `approval_request` head row with mutable-looking
  `status`, `decided_by`, and `decided_at` columns. Its status check permits `pending`,
  `approved`, `rejected`, and `expired`.
- `approval_request` is not in the baseline's R4 list of insert-only tables.
- Order 025 nevertheless requires each transition to write a row, never mutate a prior
  row, expose no UPDATE path, and make history reconstructable from rows.
- The baseline has no approval transition/history table and no lineage column that
  could connect multiple `approval_request` rows.
- Order 025 permits no migration.

Updating the head row and appending `fact_log` would fit the baseline shape, but violates
Order 025's explicit no-mutation/P4 language. Inserting a new `approval_request` row for
each transition would invent identity and lineage semantics the schema cannot express.

## Architect decision required

Please decide and record both:

1. The exhaustive approval lifecycle. The schema suggests
   `pending -> approved | rejected | expired`, with all three terminal, but the builder
   will not infer that into the canonical state-machine document.
2. The authoritative persistence model:
   - mutable `approval_request` head plus append-only `fact_log` transition history,
     with Order 025 corrected accordingly; or
   - an architect-authorized new migration for an append-only approval transition
     table (and corresponding Order 025 scope/proofs); or
   - another explicitly specified model.

Please also clarify whether `approval.requested` and `approval.decided` outbox events
are required in Order 025. They exist in `docs/EVENTS.md`, but Order 025 requires only
the audit envelope and does not scope `src/kernel/outbox.ts`; silently omitting or adding
them would both be unsafe.

## Phase status

No Phase 1 implementation has started. The issue was found while reading all eight
orders and their authoritative schema/spec sections. D-92 says any invariant question
stops the phase immediately, so Orders 019–024 were not started after this discovery.
