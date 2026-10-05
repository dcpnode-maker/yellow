# Question 012 — Live demo fixture collision before reviewed cashier repair

## Observed state

On 2026-09-20 the runtime public demo database was read-only inspected through
the normal automatic demo boundary. `PARKING-REVIEW` appears as an in-house
reservation but its authoritative reservation detail returns HTTP 409. The
independently reviewed Order 461 candidate source is present in the live runtime
tree at the frozen recorded SHA-256.

The independent nonimplementing reviewer verified that the documented deploy DSN
targets the current runtime database, then executed the reviewed idempotent
`bun scripts/seed-review.ts` once. It stopped before fixture proof with:

```
review seed failed: Local-review clean arrival party collides with non-canonical local-review data
```

The reviewer did not retry, inspect around the collision, run a reset/migration,
or record acceptance. No current-target cashier proof has therefore been made.

## Conflict with prior record

`handoff/reviews/461-cashier-fixture-repair-unreviewed.md` records a historical
successful reviewed scenario and describes a recreated public synthetic database.
The current runtime DB demonstrably differs from that expected fixture state.
Historical proof cannot stand in for the current-target proof.

## Required bounded follow-up

Create a narrow data-reconciliation order that first performs read-only,
tenant-scoped comparison of the colliding local-review arrival Party and expected
seed identity. It must establish whether the mismatch is recoverable solely by the
already-reviewed idempotent fixture mechanism. Any repair that touches
occupancy/folio/journal data must retain an independent reviewer-executed current
target proof, exact before/after census, and the full invariant battery. No reset,
migration, deletion, baseline reseed, or credential disclosure is authorized by
this question.

## Discovery result

Order 463 completed the required read-only comparison; see
`handoff/reviews/463-live-demo-fixture-collision-discovery.md`. The canonical
clean-arrival Party exists and remains correctly referenced by its role and
reservation, but its mutable presentation and attributes differ from the reviewed
fixture. A seed rerun is therefore not safe or idempotent. A separate repair order
is required before Order 461 can be accepted.
