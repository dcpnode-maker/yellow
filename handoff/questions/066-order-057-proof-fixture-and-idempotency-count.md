# Question 066 — Order 057 fixture occupancy and rollback idempotency probe

## Trigger

The first implemented Order 057 focused run returned 4 pass / 2 fail.

1. P1 expected `maxOccupancy: 4` for the selected seeded `DLX` type, but the canonical
   review seed returned 3. Production correctly copied the selected type's actual value.
2. P4 expected five total `operator.inventory.rooms.bulk` idempotency rows. P1 stopped
   during its first batch because of the bad assertion, so only three earlier successful
   operations existed. The intended claim is that publisher failure adds no row, not that
   unrelated earlier tests have a fixed total.

## Requested correction

May the proof:

- capture the selected room type's `maxOccupancy` from the authenticated inventory
  snapshot and compare every created space to that value; and
- capture the operation's idempotency-row count immediately before the injected publisher
  failure and assert that the count is identical immediately afterward?

No production code, payload, result, rollback behavior or other assertion changes.
Recreate the focused database and restart all six tests from the top.

## Builder position

Yes. These are fixture/probe corrections. Hard-coding a different occupancy contradicts
the ordered inheritance rule, and an absolute global count makes rollback evidence depend
on whether prior tests reached completion.

## Status

ANSWERED by the temporary architect in `066-ARCHITECT-RESPONSE.md`; independent review
remains debt under D-95/D-115.
