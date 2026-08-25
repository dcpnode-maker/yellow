# Question 147 — Strict Order-126 segment parents conflict with approved segment-change sequencing

**Status:** OPEN — PREDECESSOR REQUIRED
**Order:** 126 · occupancy caller tenant binding
**Branch:** `phase-5/occupancy-caller-tenant-binding-resumed`
**Approved Base:** `a3c91bc410a4bcc943c57b5ae5d3b89e6a2c29d4`
**Admission commit:** `c1f66f1`
**Preserved strict-port commit:** `1ac7e5c`
**Related decisions:** D-371, D-376, D-377, D-378, D-379

## Confirmed contradiction

Approved Order 129 correctly changed initial direct and held reservation commit so an
exact reservation and segment parent exist before occupancy acquisition. Approved
Order 130 correctly repaired the protected referee the same way. Order 126 can
therefore resume from the approved synthetic frontier for those paths.

The independently approved frontier still contains two later production lifecycle
paths whose ordering is incompatible with the same strict database contract:

1. `ReservationSegmentService.changeDeparture` releases the existing claim at
   `src/contexts/reservations/segments.ts:501`, then calls `claimForSegment` with the
   changed period at line 511. It updates the authoritative segment period only
   afterward at line 526. Strict migration 0014 requires `rs.period = p_period` at
   migration line 108, so every legitimate shorten/extend attempt must fail exact
   SQLSTATE `P0003` before the parent period is updated.
2. `ReservationSegmentService.moveRoom` releases the old segment claim at line 658,
   calls `claimForSegment` for a newly generated segment id at line 669, and inserts
   that authoritative segment parent only at line 716. Strict migration 0014 requires
   an existing exact segment at lines 79–108, so every legitimate room move must fail
   exact SQLSTATE `P0003` before the new parent exists.

This is production sequencing, not fixture debt. The complete
`tests/reservation-segment-changes.integration.test.ts` suite exercises both paths.
Its Order-126 fixture-only addition repairs only a separately fabricated OOO parent;
it cannot make either service sequence valid.

## Why Order 126 cannot repair this in current scope

D-379 limits implementation to migration 0014 and three test files. The required
production file `src/contexts/reservations/segments.ts` is explicitly outside that
boundary. Accepting a missing new-segment parent or an old mismatched period in
migration 0014 would weaken the exact typed-parent requirement, preserve the hostile
fabricated/stale-parent class, and violate D-371/D-379. A fixture edit cannot change
the public service's transaction order.

The exact four-file dirty draft is preserved at commit `1ac7e5c` with admitted blob
hashes unchanged. Non-database checks pass: frozen install 23 packages, typecheck,
64-file import boundaries, licences 23, dependency audit with no vulnerabilities,
and standing tests 172 passed / 428 skipped / 0 failed with 1,981 assertions. The
database-backed segment suite was deliberately not run against a shared stack after
this static contradiction was established; no Docker resource was started or touched.

## Requested ruling

Admit a separate migration-free Tier-3 predecessor, analogous to Order 129 and based
on the independently approved Order-142 frontier, that owns the exact segment-change
production sequencing and proof. Recommended semantics, all inside the existing
transaction:

- departure change: release the old exact claim, update the locked parent to the new
  exact period, then reacquire; any acquisition/evidence failure rolls the whole
  transaction back to the original parent and claim;
- room move: release the old exact claim, insert the new exact segment parent, then
  acquire for it; complete the old-segment departure/evidence only in the same
  transaction, with every conflict rolling back both parents and occupancy;
- pre-register a test-only strict-parent red on both real service paths, then prove
  legitimate extension/shortening/move, conflicts, concurrency, idempotency and every
  publication rollback before independent Tier-3 approval.

After that predecessor is independently approved and integrated into a new exact Base,
Order 126 may rebase its preserved four-file strict port and resume P0–P4. Do not
allocate the predecessor order/decision, edit `segments.ts`, or relax migration 0014
under this question alone.

## Current disposition

Order 126 is `BLOCKED-PREDECESSOR`. No database-green, independent review, merge, push,
deployment, live status or Cyber finding closure is claimed.
