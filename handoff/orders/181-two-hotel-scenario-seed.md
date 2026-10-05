# Order 181 — Two-hotel scenario review seed

**Status:** READY — D-463
**Phase:** 5 · founder human testing data
**Branch:** `phase-5/two-hotel-scenario-seed`
**Base:** `acda37c` (independently approved Order180 local)
**Risk tier:** 3 — tenant-scoped inventory, occupancy and financial examples
**Owner:** Codex implementation; independent non-implementing reviewer

## Outcome

Convert only the independently approved Order178 India and Canada scenario manifests
into deterministic, synthetic database data that can be reviewed through the existing
single local application. Prove the seed first against a disposable fresh database;
the active founder local is not written until an independent Tier-3 approval.

## Scope

- `scripts/seed-scenario-review.ts`;
- `tests/scenario-review-seed.integration.test.ts`;
- `package.json` only to expose the seed command;
- this order, additive D-463, `handoff/LEDGER.md`, and one independent review.

No schema, migration, runtime route, API, UI, existing seed mutation, dependency,
legal tax/fiscal authority, payment, group/block, OTA/channel integration, public
bind, active-local write before approval, merge, push or production deployment is in
scope.

## Required seed

1. Under the existing `yellow-demo` tenant, create deterministic fictional properties
   for Riverstone Test Hotel (INR, `Asia/Kolkata`) and Harbourlight Test Lodge (CAD,
   `America/Toronto`), and grant the existing operator and approver appropriate access.
2. Materialise four room-class concepts in attributes, five unit types per property,
   forty physical rooms and forty sellable units per property: eighty rooms total.
3. Materialise bounded synthetic cancellation policies and four board-plan rate
   families per property (AP, CP, MAP and EP, each flexible/non-refundable where the
   existing model permits). Prices cover `[2024-01-01, 2027-01-01)` and remain
   explicitly untaxed/pending policy; packages remain scenario intent where no
   authoritative primitive exists.
4. Create exactly 1,096 deterministic stays per property (2,192 total), one anchored
   to each property-local civil date from 2024-01-01 through 2026-12-31. Past stays
   are created then cancelled through the supported lifecycle service; current and
   future stays remain reserved. Do not forge due-in, in-house, due-out, checked-out
   or no-show states for which no supported command exists.
5. Allocate deterministically across the forty sellable units per property without
   overlap. Reservation commitment and cancellation must use the existing domain
   services and therefore preserve occupancy, fact, outbox and idempotency invariants.
6. Open twelve primary folios per property and add one balanced governed `ROOM` charge
   to each (twenty-four total). Do not create payments, taxes or fiscal documents.
7. Every identity is synthetic and provenance links back to the approved manifest.
   Zero live group/block or OTA/channel rows are implied or created.

## Proof

- exact approved manifest hashes and fail-closed validation;
- isolated fresh-database run proves exactly two scenario properties, eighty rooms,
  2,192 reservations, twenty-four folios and twenty-four balanced ROOM journals;
- RLS, tenant grants, occupancy, facts, outbox and idempotency remain correct;
- exact rerun is a no-op and deterministic-definition drift fails closed;
- current operator can switch to both new properties and read bounded board, detail
  and folio surfaces;
- focused test, standing tests, typecheck, boundaries, licences, audit and fresh
  referee 11/11 pass;
- independent non-implementing reviewer personally executes the Tier-3 proof before
  any active-local application.

## Definition of done

- [ ] Deterministic two-hotel seed exists using current domain primitives only.
- [ ] Disposable database proves exact cardinalities, replay and invariants.
- [ ] Founder login is granted both properties without credential changes.
- [ ] Independent Tier-3 review approves the exact candidate.
- [ ] No unsupported legal, fiscal, payment, group, OTA or lifecycle claim is made.
