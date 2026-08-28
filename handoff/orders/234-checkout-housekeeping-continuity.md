# Order 234 — Checkout-to-Housekeeping continuity

**Status:** READY-D616
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/checkout-housekeeping-continuity`
**Base:** `857601b` (built-unreviewed Order233)
**Risk tier:** 2 — UI-only continuity over existing authoritative reads
**Owner:** Codex implementation; product review remains deferred by founder build-first direction

## Outcome

After one exact successful governed checkout, the refreshed canonical `checked_out`
reservation detail presents one deliberate **Review room in Housekeeping** action for
the exact server-returned room. Activation opens the existing Housekeeping condition
board and focuses that authoritative room without changing condition, creating work,
or claiming that cleaning is required.

## Fixed policy

- Admission comes only from the exact current checkout success receipt: matching
  property and reservation route, parent `checked_out`, current segment `departed`,
  canonical non-null `assignedSpaceId`, and exactly one released claim.
- The minimized descriptor is property, reservation, confirmation, room, expected
  statuses, route/path and browser generation only. It is frozen transient browser
  context, never durable truth.
- The action lives on the authoritative refreshed checked-out reservation-detail
  completion surface because the checkout workbench is invalid after success.
- Activation revalidates route, generation, DOM identity, current property,
  reservation, status and room before opening the existing Housekeeping route and
  condition GET. It focuses the exact authoritative room card or the safe condition
  heading when the room is not present in the current page.
- Back, Escape, browser Back/Forward and refresh return to canonical refreshed
  checked-out reservation detail with exact or safe focus. They never reopen the
  invalid checkout workbench or rerun checkout.
- Direct Housekeeping behavior remains byte-equivalent. Replay may restore the same
  bounded transient action but adds no browser persistence or server effect.
- Copy says **Review room in Housekeeping**. It must not imply dirty, cleaning,
  inspected, discrepancy, task, urgency or completion.

## Exact scope

- this order and focused intentional-red/UI/navigation tests;
- `src/http/operator/operator.js` and `src/http/operator/operator.css`;
- `src/http/operator/index.html` only if one static semantic control is necessary;
- only genuinely superseded assertions in existing Order204/208/219/222/224/226 UI
  and navigation tests;
- `docs/UI-SPEC.md`;
- Phase-6 entries in `BUILD-PLAN.md`, `handoff/PHASE-6-PLAN.md`, this order,
  `DECISIONS.log` and `handoff/LEDGER.md`.

## Forbidden

- TypeScript server/API/context/domain, permission, database, migration, schema,
  seed, dependency or event changes;
- condition mutation, automatic dirtification, discrepancy inference, task creation,
  sheet generation, staff assignment or cleaning outcome;
- checkout replay, occupancy mutation/release, financial/folio, reservation/segment,
  identity, key, statutory, travel, vehicle or business-day effect;
- new request family, polling, storage, background work or generic navigation change;
- local promotion, merge, push, deployment, Phase-6 or app-complete claim.

## Pre-registered proof

- **P0 red:** the validated checkout completion descriptor and Housekeeping action are
  absent before implementation.
- **P1 admission:** only the exact current successful checkout receipt admits one
  frozen minimized action; stale, hostile, surplus and mismatched shapes are inert.
- **P2 navigation:** one activation opens only existing Housekeeping condition truth
  and focuses exact authoritative room or safe heading.
- **P3 continuity:** action survives authoritative detail refresh; Back/Escape/history/
  refresh return to checked-out detail without checkout replay.
- **P4 containment:** direct Housekeeping and existing checkout/detail journeys remain
  unchanged; no additional network mutation, polling, storage or inferred room work.
- **P5 standing:** focused and adjacent regressions plus full suite, typecheck,
  boundaries, licence, audit, JavaScript, diff and fresh referee are green.

## Definition of done

- [x] Order233 is recorded built-unreviewed at exact base `857601b`.
- [ ] Intentional red precedes implementation.
- [ ] Exact checkout success admits one stale-safe transient action.
- [ ] Existing Housekeeping authoritative room truth receives the navigation.
- [ ] No room/task/checkout/server authority changes.
- [ ] Standing gates are green and the result is recorded built-unreviewed.
