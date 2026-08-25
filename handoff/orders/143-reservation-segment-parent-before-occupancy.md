# Order 143 — Create segment-change parents before occupancy reacquisition

**Status:** READY
**Phase:** 5 · Cyber remediation prerequisite
**Branch:** `phase-5/reservation-segment-parent-before-occupancy`
**Base:** `a3c91bc410a4bcc943c57b5ae5d3b89e6a2c29d4` — independently approved
Order-142 metadata frontier; exact reviewed synthetic executable
`a060d49db570185cd711d850aa7113f58eee359f`
**Risk tier:** 3 — reservation-segment history, occupancy ordering, idempotency and
transactional rollback
**Owner:** Codex implementation; independent non-implementing Tier-3 review required

## Admission — D-380

Question 147 proves that approved Order 129 fixed initial direct/held commit but not two
later segment-change paths. Exact Base `src/contexts/reservations/segments.ts` blob
`4a440bf1ad0b32a71c1fd0f5b05f3eb77f205289` currently:

- releases an existing segment claim, reclaims a changed departure period, and only
  afterward updates the authoritative segment period; and
- releases an old room claim, claims with a new segment id, and only afterward inserts
  that authoritative segment.

Strict Order-126 validation must reject both sequences. This order is the separate
migration-free predecessor requested by Question 147. D-379 and the exact Question-147
blob `cd87685d22c6aa37d4fa10e4a69877a1bd31c8ab` are imported solely as provenance.
The preserved Order-126 port remains on its separate branch and is not imported.

## Outcome

Both commands retain one existing idempotent transaction and PostgreSQL occupancy
arbitration while making their typed parent visible transaction-locally before the
corresponding segment claim:

1. departure change releases the exact old claims, updates only the locked segment's
   period to the new exact `[from,to)`, then reclaims against that parent; and
2. room move releases the old exact claim, inserts the exact new in-house segment
   parent with the next sequence and destination identity, then claims for that id.
   After successful acquisition the old segment is trimmed/departed and existing
   immutable evidence is appended.

No provisional parent is externally visible. Any claim conflict, validation mismatch,
concurrent change, idempotency conflict or fact/outbox failure rolls the entire
transaction back, restoring old parent and occupancy state byte-for-byte.

## Required implementation

1. Preserve every existing validation and lock before mutation: tenant/property,
   latest segment, expected source/period, legal statuses, server move clock,
   destination difference and sequence availability.
2. For `changeDeparture`, release through `ReservationOccupancyService`, update the
   exact locked segment period with the existing compare-and-swap predicates, then call
   `claimForSegment` using the same segment id and new period. A zero-row update fails
   before reacquisition. Unit-type and exact returned-period checks stay mandatory.
3. For `moveRoom`, release through inventory, insert the next segment using the
   already locked source commercial shape, target unit type, destination sellable and
   exact active period, then call `claimForSegment` for that row. The acquired unit
   type, one-exclusive-space shape, different physical space and exact period checks
   remain mandatory. Only after acquisition succeeds may the old segment become
   departed with its exact historical period.
4. Preserve existing fact/outbox payloads, ordering, event names, idempotency request
   shape and public result. No new state, transition, event or cross-context SQL.
5. Every failure after a provisional update/insert relies on the existing transaction
   rollback; no compensating delete/update path or committed provisional state is
   permitted.

## Exact scope

Implementation may change only:

- `src/contexts/reservations/segments.ts`;
- `tests/reservation-segment-changes.integration.test.ts`.

Governance may change only:

- `handoff/orders/143-reservation-segment-parent-before-occupancy.md`;
- exact imported
  `handoff/questions/147-order126-reservation-segment-parent-sequencing.md`;
- `handoff/reviews/143-reservation-segment-parent-before-occupancy.md` when written by
  the independent reviewer;
- additive D-379/D-380 and later Order-143 entries in `DECISIONS.log`;
- additive Order-143 entries in `handoff/LEDGER.md`.

No documentation or runtime status file is needed because the public contract and
capability do not change. If proof requires any other implementation path, stop and
record a numbered question rather than widening scope.

## Pre-registered proof

### P0 — exact-parent sequencing red

Before production edits, add a test-only strict guard around segment occupancy insert
on exact Base. It raises distinct SQLSTATE `P0143` unless the exact same-tenant
reservation segment and same-property reservation already exist with matching
sellable, unit type, space mapping, claim mode and period. Exercise both real public
commands. Exact parent must fail change-departure at the changed-period claim and room
move at the new-id claim, while each transaction restores the original parent, claims,
facts, outbox and idempotency state. Commit this red separately. The guard and
observation relation are test fixtures removed by teardown; no production trigger.

### P1 — exact parent before claim

With the unchanged guard, extend and shorten each expose the updated exact parent at
the first changed-period occupancy insert. Room move exposes the inserted next
sequence, in-house status, copied commercial shape, destination sellable and exact
active period before its first occupancy insert. The final segment history, claims and
existing event/fact payloads remain byte-equivalent to Order 086 semantics.

### P2 — rollback and publication atomicity

Re-run occupied extension and occupied/OOO move conflicts plus every existing injected
publication failure. Snapshot reservation, segments, occupancy, fact_log, outbox and
api_idempotency before/after. Every failed provisional parent update/insert and release
rolls back exactly; restoring the blocker/publisher lets the same key succeed once.

### P3 — concurrency, replay and fail-closed scope

Re-run twenty contenders, exact replay and changed-key conflicts. Require one durable
winner, no loser parent/claim/evidence residue, no over-allocation and exact immutable
history. Preserve tenant/property, stale expected values, non-latest/state/shape,
cross-type/composite/positional/same-space and clock guards.

### P4 — regression and least-change shape

Run the complete guarded segment-change suite plus reservation commit, HTTP, lifecycle,
holds and occupancy regressions on fresh isolated databases. Machine-prove no migration,
schema, function, ACL, RLS, event, state or dependency change and that the diff is
limited to this order's exact paths.

### P5 — full gate and independent review

Run current isolated phase matrix, migration/deployment acceptance, exact schema and
protected hashes, standing tests, typecheck, import boundaries, frozen licences/audit
and pristine app-never-started referee `11 passed, 0 failed of 11`. A non-implementing
Tier-3 reviewer must personally reproduce P0–P4 on the immutable executable and issue
APPROVE or REJECT. Builder output is not reviewer evidence.

## Forbidden

- any migration, schema, function, trigger, table, RLS, role, grant, tenant-context,
  occupancy-validation or direct `space_occupancy` change;
- reservation-owned occupancy SQL, alternate write path, cache/projection arbitration,
  caller flag/GUC, owner/app bypass or relaxed/missing/stale parent acceptance;
- a new state, transition, event, API, worker, UI, financial, tax, payment, fiscal or
  rate behavior;
- committing a provisional parent outside the existing transaction, compensating
  cleanup in place of rollback, weakening conflicts/concurrency/idempotency/facts/
  outbox assertions, or editing protected referee/fixture files;
- self-review, self-merge, push, deployment, live-status or Cyber finding closure.

## Definition of done

- [ ] P0 is committed separately and reproduces both exact-parent ordering failures.
- [ ] P1–P4 pass on one immutable executable SHA.
- [ ] P5 and pristine referee are green.
- [ ] Independent non-implementing Tier-3 review approves the exact executable.
- [ ] Only then may Order 126 adopt the approved Order-143 frontier and resume its own
      strict migration proof.
