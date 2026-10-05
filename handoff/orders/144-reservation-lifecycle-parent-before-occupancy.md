# Order 144 — Restore live lifecycle parents before occupancy reacquisition

**Status:** APPROVED
**Phase:** 5 · Cyber remediation prerequisite
**Branch:** `phase-5/reservation-lifecycle-parent-before-occupancy`
**Base:** `2faf5e8db8264af59e65effdfcb5603da628a181` — independently approved
Order-143 metadata frontier; exact approved executable
`4e06d4b7580e68af5a716a3bfb6d9ec93994e692`
**Risk tier:** 3 — reservation lifecycle, occupancy ordering, idempotency and
transactional rollback
**Owner:** Codex implementation; independent non-implementing Tier-3 review required

## Admission — D-383

Question 148 at provenance commit
`712477702fc0ba9043359f0b51088b448b64cbab` identifies that
`ReservationLifecycleService.reinstate` locks cancelled segments, reacquires occupancy
for them and only afterward restores their authoritative status to `booked`. Order 144
is the bounded, migration-free production predecessor requested there.

This branch is created directly from independently approved Order-143 metadata, not
from either Order-126 migration branch. The exact imported Question-148 source blob is
`26bc1ea8547d19e6602d5857ec2c898f597b7e10`; D-382 is imported solely to preserve
the question's admission provenance. No Order-126 migration, executable, ancestry,
test-only fixture repair or other blocked artifact is imported.

Evidence correction is explicit: strict draft executable `b96101f` currently permits
`cancelled` in its segment-record parent predicate, and the recorded Order-126 P4 line
598 failure was the later parentless positional-race fixture. This does not remove the
production sequencing debt. Order 144 makes legitimate reinstatement independent of
that temporary cancelled-parent allowance so final strict validation can require a
live `booked`/`in_house` parent. Its proof uses a test-only strict live-parent guard;
this order does not edit or prejudge migration 0014.

Exact Base blobs are:

```text
147afac706d5d3fc54ee9c1bf60a882f154571e4  src/contexts/reservations/lifecycle.ts
66022c921a63ad20330d0f2eabce4540d071f78c  tests/reservation-lifecycle.integration.test.ts
```

## Builder outcome

Admission is exact commit `ca5a9ae761885abbb9e71d5ed8ffae457105fe2f`.
Test-first red `d8054fb673a6b4d72d5e9a75ee4cfc4fa0e6118c` adds the static
ordering canary and test-only live-parent trigger before production edits. On the
untouched Base implementation, real blocked reinstatement raised exact SQLSTATE
`P0144`. Direct readback retained the target as cancelled/cancelled with zero claims,
while the competitor alone was reserved/booked with one claim; reinstate key, fact and
event counts were all zero.

Exact executable `93069db186af231622e0419c82516e59e437d5e4` moves only the
existing locked-segment compare-and-swap update ahead of the existing acquisition
loop. It adds no query, state, event or compensation and retains the same affected-row
verification. Current implementation blobs are:

```text
fa425138a33fe35017e36012d2fd63b5175a9bb5  src/contexts/reservations/lifecycle.ts
67f344e3d33913687e372ec4adca762306c7d6f5  tests/reservation-lifecycle.integration.test.ts
```

Builder-executed proof on isolated `yellow_o144b_*` databases is green:

```text
guarded lifecycle                         6/6, 65 assertions
reservation commit                        5/5, 106 assertions
reservation HTTP commit                   5/5, 61 assertions
holds                                     9/9, 32 assertions
inventory                                 6/6, 30 assertions
Order-129 initial parents                 7/7, 45 assertions
Order-143 segment changes                 7/7, 115 assertions
isolated cumulative matrix              19/19 suites
standing                              174 pass / 422 skip / 0 fail, 1,983 assertions
typecheck                                 PASS
import boundaries                         PASS, 64 files
licences / audit                           23 packages / no vulnerabilities
fresh normalized schema                    exact
app-never-started referee                  11/11, 85 tables / 75 RLS tables
```

Protected SHA-256 values remain exact:

```text
fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923  migrations/0001_init.sql
2afa95bb7c02cd9637ffc9c3df00d1ddf7cfc5d8d31c4fd8fad29b950c1a418d  tests/run_invariants.py
bf71d8fc2987126db61ca3105e5d5cb5a4f48b9e2eba09d8b7fc1f3441fd4c62  tests/seed_fixture.sql
a5ffe526138e0c87365f58bbf1f0a08f51f531418aefe6ebe414ffda7e51d59a  tests/schema/expected.sql
```

Every builder database was dropped. The shared PostgreSQL/Valkey stack was left
running and unmodified. This evidence is not independent review; the parallel fixture
predecessor and final strict Order-126 composition remain separate.

## Required implementation

1. Preserve all existing request validation, reservation and segment locks,
   transition checks, exact cancelled-segment shape and non-null original sellable
   validation before mutation.
2. Inside the existing idempotent command transaction, restore the exact locked
   cancelled segment parents to live `booked` status before the first
   `claimForSegment` call. The update must retain tenant, reservation and old-status
   compare-and-swap predicates and exact affected-row verification.
3. Reacquire each segment only through `ReservationOccupancyService`, using its same
   exact id, original sellable unit and period. Preserve inventory revalidation,
   PostgreSQL arbitration and accumulated exact claim count.
4. Only after all acquisitions succeed may the reservation become `reserved` and the
   existing fact/outbox/idempotency result be completed. Any competitor, mismatch,
   concurrency, idempotency, fact or outbox failure must roll the parent update and
   every acquired claim back to the original cancelled/zero-claim state.
5. Preserve the public request/result, legal state transitions, event names and
   payloads. Add no state, schema, migration, occupancy bypass, direct occupancy DML,
   compensating cleanup, cross-context SQL or financial behavior.

## Exact scope

Implementation may change only:

- `src/contexts/reservations/lifecycle.ts`;
- `tests/reservation-lifecycle.integration.test.ts`.

Governance may change only:

- `handoff/orders/144-reservation-lifecycle-parent-before-occupancy.md`;
- exact imported
  `handoff/questions/148-order126-strict-parent-compatibility-predecessors.md`;
- `handoff/reviews/144-reservation-lifecycle-parent-before-occupancy.md` when written
  by the independent reviewer;
- additive D-382/D-383 and later Order-144 entries in `DECISIONS.log`;
- additive Order-144 entries in `handoff/LEDGER.md`.

Every other path is forbidden, especially either Order-126 branch, migrations,
occupancy functions/validation, `segments.ts`, operational-block/security-definer
fixture files, protected referee/fixture files, state/event/API/operator contracts,
runtime/status and finance. If proof needs another path, stop and record a numbered
question rather than widening scope.

## Pre-registered proof

### P0 — exact real-path red

Before production edits, add a focused static ordering assertion plus a database-only
test guard that accepts a segment occupancy insert only when the exact same-tenant
reservation/segment/sellable/property/space/period chain already has status `booked`
or `in_house`. On exact Base, real `reinstate` must fail test-only SQLSTATE `P0144`
because its locked segment is still cancelled. Direct readback must show the cancelled
reservation and segment, zero claims, zero command fact/outbox and no idempotency result.

### P1 — parent-before-claim green

The static assertion and guarded full lifecycle suite pass. Observe the exact restored
`booked` parent at the occupancy insert, then prove successful reinstatement writes one
claim and the existing reservation/fact/outbox/idempotency result without contract
drift. Replace the suite's parentless positional race fixture with an exact booked
segment parent without weakening its two-client one-winner/capacity assertions.

### P2 — conflict, concurrency and rollback

Retain the occupied competitor failure with byte-exact before/after state, two
concurrent reinstatements with exactly one durable winner and exact replay, positional
capacity behavior, and every injected fact/outbox failure with cancelled parent, zero
claim/evidence and clean same-key retry. Add no compensating mutation.

### P3 — affected and cumulative gates

Run the guarded full lifecycle suite, reservation commit/HTTP, holds, approved
Order-129 parents, approved Order-143 segment changes and the eventual strict Order-126
focused proof when its composed branch is admitted. Run standing, typecheck, 64-file
boundaries, licences/audit, protected hashes and proportionate fresh database gates.
No Docker use is authorized until the coordinator explicitly grants a shared-stack
window.

### P4 — independent review

A non-implementing Tier-3 reviewer must inspect and personally execute the real red,
parent-before-claim observation, conflicts/races/rollback and cumulative gates on one
immutable executable. Builder output is not review evidence.

## Definition of done

- [x] Exact approved Order-143 metadata is the Base.
- [x] Question-148 production provenance and its evidence correction are explicit.
- [x] Test-first P0 red is committed before production code.
- [x] P1-P3 pass on one immutable executable.
- [x] Independent Tier-3 review approves exact executable `93069db186af231622e0419c82516e59e437d5e4` at evidence head `5e83fae3b41fd24e68492aa27b7109e21701e01b`.
- [ ] No migration/occupancy relaxation, scope widening, merge, push, deployment or
      Cyber finding closure is claimed.
