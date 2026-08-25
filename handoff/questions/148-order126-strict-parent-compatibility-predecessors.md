# Question 148 — Strict Order-126 parents expose lifecycle and inherited-fixture predecessors

**Status:** OPEN — BLOCKS ORDER 126
**Order:** 126 · occupancy caller tenant binding
**Branch:** `phase-5/occupancy-caller-tenant-binding-final`
**Approved Base:** `2faf5e8db8264af59e65effdfcb5603da628a181`
**Admission commit:** `972d2fa90649bdcb94e1e9300e62312f7d61efc1`
**Strict executable:** `b96101f55d05eced75d0ed6fe2a432251f810580`
**Related decisions:** D-371, D-376, D-377, D-378, D-379, D-380, D-381, D-382

## Confirmed strict migration result

The admitted four-file port remains exact and does not weaken tenant authority or typed
parents. Against a fresh database migrated only through approved `0013`, the guarded P0
case proved that an `app_role` tenant-A transaction could name tenant B: hostile
occupancy changed from zero to one, the tenant-B victim changed from one to zero, and
both `record_occupancy` and `release_occupancy` returned success. Direct DML remained
exact `42501`, PUBLIC execute remained denied, app role remained NOLOGIN and both
function paths remained qualified.

On a separate fresh database through `0014`, the focused suite passed 6/6. It proved
exact `42501` for missing/mismatched app-role authority, exact `P0003` for invalid,
wrong-kind and stale typed parents, exact release counts, mutual exclusion, one winner
from fifty exclusive clients and exactly six winners from forty positional clients.

The same immutable executable exposed the following compatibility predecessors. They
cannot be repaired within Order 126's exact four implementation paths.

## Production predecessor — reservation reinstatement

`ReservationLifecycleService.reinstate` loads and locks cancelled segments, then calls
`claimForSegment` while each authoritative `reservation_segment.status` is still
`cancelled` at `src/contexts/reservations/lifecycle.ts:858`. It changes those parents to
`booked` only after all claims at line 880. Migration 0014 deliberately accepts only a
live `booked` or `in_house` segment parent, so the inherited P4 two-contender case had
zero fulfilled claims instead of exactly one and raised `P0003` before mutation.

This is a real production transaction sequence, not fixture debt. Relaxing migration
0014 to accept a cancelled segment would authorize occupancy against a non-live parent
and violate Order 126 P1/P2. Order 126 explicitly forbids editing
`src/contexts/reservations/lifecycle.ts`.

Recommended resolution is a separate migration-free Tier-3 predecessor, analogous to
Orders 129 and 143. Inside the already locked idempotent transaction it must move the
exact segment parent(s) to the live reinstated state before revalidating occupancy,
while retaining the one-winner race, competitor conflict, facts/outbox, idempotency and
publication-failure rollback to cancelled parents with zero claims. No predecessor
order or decision is allocated by this question.

## Test-only predecessor — strict release and record fixtures

Two inherited proofs encode behavior that was intentionally superseded by strict typed
parents. Their production subjects need no relaxation.

1. `tests/operational-blocks.integration.test.ts:89-102` selects every `ooo_oos`
   fixture on three spaces and calls `release_occupancy` even for an `oos` parent that
   can never own a claim. After the first two cases pass, `beforeEach` reaches that
   live wrong-kind/zero-claim row. The new function correctly raises exact `P0003`
   instead of returning misleading zero, preventing P3 onward and final cleanup.
   The helper must release only captured authoritative OOO claims; the Order-037
   lifecycle assertions and production caller remain unchanged.
2. `tests/security-definer-containment.integration.test.ts:265-299` creates only a
   tenant, property and space, then asks app role to record a fabricated `segment`
   slot with no reservation or segment parent. The first two containment cases pass;
   P3/P4 now correctly raises exact `P0003`. Its fixture must create an exact typed
   parent (or exercise an exact OOO parent) while retaining the same app-role execute,
   safe-path, owner-prune and release-count assertions.

Both test files are outside Order 126 scope. Recommended resolution is one bounded,
test-only predecessor that updates only these stale fixtures, runs their complete
unchanged-strength suites, and receives proportionate independent inspection because
the tests guard the occupancy choke point. It may not change production, migration
0014, protected referee/fixture files or expected SQLSTATEs.

## Evidence completed before the stop

Fresh isolated results on the strict executable were:

```text
focused caller/typed-parent/races       6/6
availability projection                6/6
holds                                  9/9
OOO availability                       6/6
reservation commit                     5/5
reservation HTTP commit                5/5
Order-129 initial parents               7/7
Order-143 segment changes               7/7
reservation lifecycle                  4/5  (production predecessor above)
operational-block lifecycle             2/7  (test cleanup stops P3 onward)
standalone typed-parent fixture proof   5/5, embedded referee 11/11
native-WSL migration suite             17/17, 95 assertions
Windows migration suite                16/17, only inherited host symlink EPERM
isolated phase matrix                   first 14/14 green; suite 15 P3/P4 exposed
                                        the security-definer fixture above
typecheck                               PASS
import boundaries                       PASS, 64 files
focused non-DB sequencing               2 pass / 17 skip / 0 fail
```

The coordinator stopped further database commands after the matrix finding. The four
remaining matrix suites, deployment acceptance, exact schema and final standing/setup
checks therefore remain unclaimed. The standalone referee database and every database
finished before the matrix were dropped; final cleanup is recorded with the blocked
status commit.

## Requested ruling

Admit and independently approve the production lifecycle predecessor and the separate
test-only fixture predecessor from the current approved frontier. Then resume Order
126 from their approved composed metadata, port the same strict four-file executable,
and restart P0-P4 from fresh databases. Do not edit either out-of-scope production/test
path, relax migration 0014, allocate an order/decision, claim BUILT-UNREVIEWED, or close
the Cyber occurrence under this question alone.
