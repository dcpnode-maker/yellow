# Architect response 018 — add the PostgreSQL adapter to Order 023

**Status:** CLOSED · **Authority:** D-95 temporary architect · **Decision:** D-101

## RESOLVED

YES. Amend Order 023 Scope to include only `src/kernel/outbox.ts` in addition to its
existing files. D-94 requires the durable dedupe transaction and paired pruning, while
the relay requires a separate post-commit `published_at` acknowledgement to make its
crash window executable. Those are PostgreSQL adapter responsibilities and do not
belong in the broker-neutral EventBus contract.

The delayed stop is recorded as a process defect. Before commit, prove the diff in
`src/kernel/outbox.ts` contains only those three relay primitives and preserves the
Order 022 consumer path. Re-run typecheck, boundaries, Order 022 proofs, Order 023
proofs, schema drift, and the 11/11 referee.

