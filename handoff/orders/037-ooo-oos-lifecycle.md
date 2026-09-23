# Order 037 — Audited OOO/OOS lifecycle through the occupancy choke point

**Phase:** 2 · Slice 2F
**Branch:** `phase-2/ooo-oos-lifecycle`
**Tier:** 3 — OOO writes authoritative occupancy
**Written by:** OpenAI Codex, temporary architect under D-95/D-115

## Outcome

Open and close explicit property-space OOO/OOS intervals atomically, preserving the
baseline distinction between physical removal and commercial unavailability.

## Scope

- `DECISIONS.log`
- `handoff/orders/037-ooo-oos-lifecycle.md`
- `src/contexts/inventory/index.ts`
- `src/contexts/inventory/operational-blocks.ts`
- `tests/operational-blocks.integration.test.ts`

## Required behavior

1. Open a bounded, unexpired OOO or OOS interval for an explicitly validated active
   tenant/property space with a trimmed 1..500 UTF-8-byte reason.
2. OOO records one exclusive `slot_kind='ooo'` claim only through
   `record_occupancy`; OOS records no occupancy.
3. Every open writes one fact, one existing-catalogue `ooo.opened` event, and for OOO
   one `occupancy.recorded` event in the same transaction.
4. Close locks one active block, releases OOO only through `release_occupancy`, truncates
   a started interval at transaction time or makes a future interval empty using the
   baseline's UPDATE grant, and writes close facts/events for the captured original row
   atomically. Closing one overlapping cause must not close another.
5. Reads are deterministic and property scoped. Foreign tenant/property references,
   malformed input, publisher failure, and occupancy conflicts fail closed.
6. Work-order task linkage, availability effects, projections/caches, overbooking, and
   HTTP/UI contracts remain deferred.

## Forbidden

- Direct `space_occupancy` INSERT/UPDATE/DELETE or edits to either occupancy function.
- Availability/restriction logic, holds, reservations, projections/caches, OOO/OOS task
  linkage, overbooking, HTTP/UI, new events, migrations, RLS, tenant middleware,
  journal/fiscal logic, or referee changes.
- Self-approval or merge.

## Pre-registered proofs

- **P1:** OOO open creates the exact row, exclusive occupancy claim, fact,
  `ooo.opened`, and `occupancy.recorded` atomically.
- **P2:** OOS open creates the row/fact/event but zero occupancy claims.
- **P3:** close deactivates exactly one cause using the permitted range UPDATE; OOO
  releases its captured claim and emits exact close/release evidence; a repeated close
  adds no evidence.
- **P4:** an existing overlapping hold makes OOO open lose at the PostgreSQL constraint
  and leaves no block, fact, or event.
- **P5:** tenant/property isolation and malformed kind, ids, dates, reason, and expired
  intervals fail without artifacts.
- **P6:** failure on the second publish rolls back the block, occupancy, first outbox
  event, and fact.
- **P7:** twenty concurrent OOO opens for one interval produce exactly one active block
  and one occupancy claim; every loser leaves no artifacts.
- **P8:** Orders 030, 031, and 036 proofs, standing checks, schema drift, and canonical
  11/11 remain green unchanged.

## Standing checks

Run the Order 037 database proof plus Orders 030, 031, and 036 with their required
flags; typecheck, boundaries, full tests, licence policy, audit, schema drift, and
`./setup.sh --db-only`. Commit and push only when all are green. Do not merge.

---

## MERGED

Prepared for the founder-authorized cumulative integration from exact reviewed frontier `bc22a9d`. This marker becomes true when the cumulative integration PR lands in `main`; review provenance remains in `handoff/reviews/` and `handoff/LEDGER.md`.
