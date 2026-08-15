> **AMENDED by `handoff/questions/011-ARCHITECT-RESPONSE.md` (D-94) — read it first.**
> **C:** the helper takes `propertyNode` and derives `business_date` transactionally from
> `org_node.timezone`. `valid_from` is also `NOT NULL` — set it to the transaction
> timestamp. Mapping: operation→`fact_type`, actor→`actor_id`, request id→`payload`,
> timestamp→`recorded_at`, entity→`entity_type`/`entity_id`. Tenant-level facts with no
> property are out of scope for Phase 1 — stop and ask.
> **I:** **P5 is removed** from this order and becomes a Phase 1 exit-gate proof. Keep P1–P4.
> **AMENDED by `handoff/questions/013-ARCHITECT-RESPONSE.md` (D-96).** Bun 1.3.14
> JSONB parameter encoding exposed an existing seed defect while P1 ran. Scope gains
> `scripts/seed.ts` and `tests/seed.integration.test.ts` only for the shared
> pre-stringified-JSON correction and its object-type regression proof. P1–P4 are not
> weakened; P3 reads PostgreSQL SQLSTATE from Bun's `errno` field.

# ORDER 021 — fact_log write helper and audit envelope

**Phase:** 1 · **Branch:** `phase-1/fact-log-audit` · **Tier:** 2
**Written by:** Claude (architect) · **Date:** 2026-08-15 · **Decisions:** D-05, D-92

## Goal

Every mutation records who did it, when, in which tenant, and under which request —
inside the same transaction as the mutation itself.

## Why before anything mutates

Retrofitting an audit trail means backfilling rows nobody recorded. This order exists at
position three of the phase so that no mutation in Yellow's history is ever unaudited.

## Scope

`src/kernel/fact-log.ts`, `src/kernel/audit.ts`, `src/kernel/index.ts`,
`tests/fact-log.integration.test.ts`. `fact_log` already exists in the baseline schema
(§2 kernel primitives) — read it before designing; **no migration**.

Correction-only additions under D-96: `scripts/seed.ts` and
`tests/seed.integration.test.ts`. No other Phase 0 file is in Scope.

## Required behaviour

1. The audit envelope captures actor (`sub`), tenant (`tid`), request id, timestamp, and
   the operation name. It is written through the same transaction as the mutation.
2. Insert-only. D-05: corrections reference, never mutate. There is no update path and no
   delete path, and attempting either must be impossible through the exported API.
3. A mutation that rolls back leaves no audit row — the envelope is not a side channel.
4. The helper is the only exported way to write `fact_log`.

## Pre-registered proofs

| # | Proves | Must show |
|---|---|---|
| P1 | Envelope written in-transaction | mutation + audit row commit together |
| P2 | **Rollback leaves nothing** | handler throws → zero audit rows, zero mutation rows |
| P3 | Insert-only holds | UPDATE and DELETE against `fact_log` via the app role → rejected |
| P4 | Tenant scoping | audit rows carry `tid` and are invisible to the other tenant through RLS |
| P5 | No unaudited path | grep-style assertion that no `src/` module writes the mutated tables outside the helper |

P2 is the one that catches a helper that writes on its own connection — an easy and
invisible mistake.

## Forbidden

A second connection or transaction for audit writes · any UPDATE or DELETE path on
`fact_log` · buffering audit rows for later flush · editing `migrations/` or
`tests/run_invariants.py` · merging.
