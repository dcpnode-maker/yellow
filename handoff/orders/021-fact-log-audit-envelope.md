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
