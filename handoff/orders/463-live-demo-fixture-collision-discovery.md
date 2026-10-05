# ORDER 463 — live-demo-fixture-collision-discovery

**Phase:** 0 · **Branch:** `phase-0/live-demo-fixture-collision-discovery` · **Written by:** Codex · **Date:** 2026-09-20

## Goal
Establish, using read-only evidence, why the current live synthetic demo data prevents the already-reviewed fixture provisioner from completing.

## Why now
Order 461's cashier and reservation demo proof is blocked by incoherent live fixture records. This order satisfies the Phase-0 requirement that deterministic demo fixtures are verified rather than assumed, and creates a safe basis for a separate, explicitly reviewed reconciliation order if one is needed.

## Scope — files Codex may create or change
- `handoff/orders/463-live-demo-fixture-collision-discovery.md`
- `handoff/questions/012-live-demo-fixture-collision.md`
- `handoff/reviews/463-live-demo-fixture-collision-discovery.md`

No application source, migrations, test fixtures, deployment configuration, or database rows are in scope for change.

## Contracts to honour (read before making observations)
- `PROJECT.md` invariants 1, 3, 5, 7, 8 and 9
- `handoff/orders/461-unified-cashier-billing-desk.md`
- `handoff/questions/012-live-demo-fixture-collision.md`
- `docs/CONTRACTS.md` reservation, party and folio boundaries

## Definition of done
- [ ] Current runtime target is identified without disclosing a connection secret.
- [ ] Read-only, tenant-scoped counts and relationship-shape evidence identify the colliding local-review fixture identity without copying guest contact data or secrets into handoff records.
- [ ] The evidence distinguishes an idempotent safe rerun from a reconciliation that requires a new order.
- [ ] Findings and exact read-only commands/results are recorded in `handoff/reviews/463-live-demo-fixture-collision-discovery.md`.
- [ ] No database mutation, migration, reseed, test execution with writes, or public-demo behaviour change occurs.

## Forbidden in this order
- Running `scripts/seed-review.ts`, any migration, reset, baseline seed, or repair script.
- `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, DDL, or invoking any function with state-changing effects.
- Inspecting, emitting, or copying credentials, raw guest contacts, payment information, or API keys.
- Claiming Order 461 acceptance or production readiness.

## Open questions already answered
> Q: Can the live public demo be reset or reseeded to clear this collision?
> A: No. Question 012 requires a narrowly scoped reconciliation order and independent proof before any mutation.
