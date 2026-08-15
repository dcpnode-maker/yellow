# ORDER 025 — approval_request primitive

**Phase:** 1 · **Branch:** `phase-1/approval-request` · **Tier:** 2
**Written by:** Claude (architect) · **Date:** 2026-08-15 · **Decisions:** D-06, D-27

## Goal

A generic approval primitive that later phases attach to specific actions, with the state
transition recorded rather than inferred.

## Why it is in Phase 1

D-06 (day-close discrepancies carry forward via approval) and D-27 (trust accounting
negative balances require approval) both depend on it. Building it once, generically, in
the kernel is cheaper than two bespoke versions in Phases 5 and 6.

## Scope

`src/kernel/approval.ts`, `src/kernel/index.ts`, `tests/approval.integration.test.ts`.
`approval_request` is a baseline table — **no migration**.

## Required behaviour

1. States and legal transitions are declared in one place and must already exist in
   `docs/STATE-MACHINES.md`. If they do not, **stop and ask** — inventing a state machine
   inside an implementation order is how they drift.
2. A transition writes a row; it never mutates a prior row. Insert-only, per D-05.
3. Requester and approver are distinct — self-approval is rejected at the primitive, not
   left to callers. This is the same rule that governs the agents themselves.
4. Every transition carries the Order 021 audit envelope.

## Pre-registered proofs

| # | Proves | Must show |
|---|---|---|
| P1 | Legal transitions succeed | each declared transition, end to end |
| P2 | **Illegal transitions rejected** | every undeclared pair rejected — enumerate them, do not spot-check |
| P3 | **Self-approval rejected** | requester == approver → rejected at the primitive |
| P4 | Insert-only | no UPDATE path exists; history is reconstructable from rows |
| P5 | Tenant isolation | approvals are invisible across tenants |

## Forbidden

Inventing states not in `docs/STATE-MACHINES.md` · mutating a prior approval row ·
allowing self-approval under any flag · attaching this to a specific domain action (that
belongs to the phase that needs it) · editing `migrations/` or `tests/run_invariants.py` ·
merging.
