# Order 129 — Create reservation parents before segment occupancy

**Status:** APPROVED-UNINTEGRATED
**Phase:** 5 · Cyber remediation prerequisite  
**Branch:** `phase-5/reservation-parent-before-occupancy`  
**Base:** `0a7eac4acc0c0a6763402a2f3442ded3e9a9cf63` — Order 126 planning line at
Question 145, descended from independently approved Order 124 metadata
`ee0cdc5299d88ba0355972482f5fe5aa4a017b02`  
**Risk tier:** 3 — reservation creation, hold transfer, occupancy ordering,
idempotency and transactional rollback  
**Owner:** Codex implementation; independent non-implementing Tier-3 review required

## Outcome

Normal direct and held reservation commits must create their authoritative
`reservation` and `reservation_segment` rows inside the command transaction before
the first `record_occupancy(..., segment_id, 'segment', ...)` call. This is the narrow
production prerequisite for Order 126's strict database typed-parent validation.
There is never a committed parent without successful occupancy: every conflict,
validation, publication or idempotency failure rolls the provisional rows and all
other effects back atomically.

This order changes sequencing, not authority. Inventory remains the only context that
resolves sellable/hold inventory and mutates occupancy. Reservation code receives a
frozen, read-only preparation result from inventory, inserts the exact parent rows,
then invokes the existing inventory acquisition command and verifies that its result
matches the prepared identity and period. PostgreSQL remains final arbitration.

## Required architecture

1. Add inventory-owned read-only preparation for a direct segment claim. It validates
   the same tenant/property, sellable, unit type, mapped spaces, statuses and bounded
   period needed by `claimForSegment`, but writes no occupancy, fact or event. The
   mutating claim must revalidate authoritative state; preparation is not a promise.
2. Add hold-owned read-only preparation for cart-hold conversion. It locks and
   validates the active, unexpired, same-tenant/property cart hold and resolves its
   sellable, unit type and period without changing status, claims, facts or events.
   The existing consume command must still revalidate and perform the atomic transfer.
3. In `ReservationCommitService`, generate ids, obtain the frozen preparation result,
   insert the reserved reservation and booked segment with that exact inventory
   identity/period, then acquire inventory. Only after acquisition succeeds may it add
   the primary guest and reservation fact/outbox evidence. Compare every acquired
   inventory field with preparation; any mismatch is an internal failure and rolls
   back the whole transaction.
4. Preserve one command transaction and the existing `reservation.commit`
   idempotency boundary. Exact replay stays inert. A losing direct race, stale/consumed
   hold, injected occupancy failure, event failure or identity mismatch leaves no
   reservation, segment, guest, fact, outbox or completed idempotency residue. A failed
   held conversion also leaves the hold active with its original claims.
5. Preserve confirmation derivation, server-owned policy/currency/market/source,
   public result shape, HTTP mappings, bounded positional retry, exact event payloads
   and all existing state transitions. No provisional state is externally visible
   because it exists only in the uncommitted transaction.

## Scope

- `handoff/orders/129-reservation-parent-before-occupancy.md`
- `handoff/orders/126-occupancy-caller-tenant-binding.md` — status only: mark blocked
  on this prerequisite; no other Order-126 change
- `handoff/questions/145-order126-segment-parent-created-after-occupancy.md`
- `src/contexts/inventory/holds.ts`
- `src/contexts/inventory/reservation-occupancy.ts`
- `src/contexts/inventory/index.ts`
- `src/contexts/reservations/commit.ts`
- `tests/reservation-parent-before-occupancy.integration.test.ts` — new focused proof
- `tests/reservation-commit.integration.test.ts`
- `tests/reservation-commit-http.integration.test.ts`
- `tests/operator-holds.integration.test.ts` only if its exact public preparation
  contract requires regression coverage; no assertion weakening
- `scripts/run-phase-3-gate.ts` and `tests/phase-3-gate-runner.test.ts` — register the
  focused proof exactly once
- `docs/CONTRACTS.md` — sequencing clarification only
- `src/project-status.ts` and `tests/founder-status.integration.test.ts` only after
  all builder gates are green, with independent coverage unchanged
- additive `DECISIONS.log`, `handoff/LEDGER.md`, and the independent review record

Every other file is out of scope. If implementation needs a schema, migration, new
table/function/trigger/event, protected referee edit, HTTP contract change, lifecycle
change, or a file outside this list, stop and write a numbered question.

## Pre-registered proof

### P0 — exact-parent sequencing red

Before implementation, add the focused test on exact parent `0a7eac4`. In a fresh
database, install a test-only guard on segment occupancy insertion that raises a
distinct test SQLSTATE unless a matching same-tenant reservation segment and its
same-property reservation already exist. Exercise both real direct commit and real
cart-hold conversion. The exact parent must fail both at the first segment occupancy
write and leave no reservation artifacts. Commit this red separately. The guard is a
test fixture only and must be removed by teardown; no production trigger is allowed.

### P1 — parent-before-occupancy direct and held green

Against the unchanged guard, direct and held commits succeed. Capture proof at the
first segment occupancy insertion that the exact reservation/segment parent already
exists with matching tenant, property, sellable, unit type and period. Assert the
normal result, exact claim counts and unchanged fact/event payloads.

### P2 — rollback and replay

Inject failures at direct claim, held transfer, each new sequencing boundary and every
existing publication position. Assert exact before/after snapshots: no provisional
reservation artifact or completed idempotency row survives; failed held conversion
retains the active hold and original claims. A clean retry succeeds once and exact
replay adds nothing.

### P3 — concurrency and stale preparation

Re-run the real last-unit exclusive and positional-capacity races: only database
capacity winners commit, and every loser has zero reservation artifacts. Race two
consumers for one hold and require one success, one conflict and one reservation.
Force authoritative inventory/hold state to become stale between preparation and
acquisition and prove fail-closed rollback rather than accepting the prepared value.

### P4 — regression and standing gate

Run the focused suite, complete reservation commit and HTTP suites, affected hold
suite, current-line isolated matrix with the new proof once, migration/deployment
tests, standing tests, typecheck, import boundaries, licences/audit, exact schema and
protected hashes, then pristine `./setup.sh --db-only` with `11 passed, 0 failed`.
The independent Tier-3 reviewer must personally reproduce P0 and P1–P3 and inspect
the exact transaction ordering before approval.

## Forbidden

- any migration or schema change; production trigger, staging table, alternate
  occupancy function, overload, caller GUC/flag or owner/app bypass;
- reservation-owned inventory SQL, direct `space_occupancy` DML, cache/browser
  arbitration, trusting preparation without acquisition revalidation, or committing a
  provisional parent;
- weakening tenant/property/typed-parent checks, concurrency, retry, rollback,
  idempotency, fact/outbox or HTTP assertions;
- changing financial, payment, tax, rate, lifecycle, guest, UI or permission behavior;
- editing `migrations/0001_init.sql` or `tests/run_invariants.py`;
- self-review, self-merge, push, deployment, live-status claim or Cyber finding
  closure. Order 126 remains the only order eligible to discharge the occupancy
  caller-tenant finding after its own independent review.

## Definition of done

- [x] P0 is committed separately and reproduces both exact-parent ordering failures.
- [x] P1–P3 prove direct/held sequencing, fail-closed revalidation, concurrency,
      rollback and replay on the immutable executable SHA.
- [x] P4 and pristine referee 11/11 are green.
- [x] Independent non-implementing Tier-3 review approves the exact executable SHA.
- [ ] Order 126 rebases onto the approved Order 129 metadata head, restores its strict
      migration/fixture work, and proves the complete typed-parent gate separately.

## Builder evidence

- Exact P0 red `0c4c13fb8f2e451303ae868de2589904cecf91a4` on a fresh isolated
  database proved both real direct and held commands reached the first segment occupancy
  insertion without their authoritative parents. The test-only guard raised SQLSTATE
  `P0129`; direct left no artifacts and held retained its active status and original claim.
- Exact executable `9a6ef73e5e39c8594dda4e56fe5e405aebaa0b90` passes the unchanged
  guard for both paths and records the exact tenant/property/reservation/segment/sellable/
  unit-type/period parent visible at the first occupancy insertion. Focused P1–P3 pass
  7/7 with 45 assertions; held commit passes 5/5 with 106, HTTP commit 5/5 with 61,
  and affected holds 7/7 with 48.
- The native-WSL isolated cumulative matrix passes all 19/19 suites with Order 129
  registered exactly once. The Windows matrix stopped honestly at inherited Order-069 P8
  after 19,436.24 ms against its 15-second host budget; the unchanged P8 passed in WSL at
  14,519.38 ms. Migration passes 17/17; deployment acceptance 6/6; standing passes
  171/0 with 419 skips and 1,977 assertions; typecheck, 64 boundaries, 23 licences,
  audit, exact schema and protected hashes pass.
- A pristine `yellow-order129-referee` `./setup.sh --db-only` run produced 85 tables and
  `11 passed, 0 failed of 11`. Both disposable Order-129 Docker projects, networks and
  volumes were label-verified and removed. Independent Tier-3 review remains required;
  no merge, push, deployment, live status or Cyber finding closure is claimed.
