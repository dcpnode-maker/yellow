# Question 071 — Order 058 invented unit-type status predicate

## Trigger

The D-200 full restart again returned `0 pass / 6 fail` before assertions. The rebuild
query filtered `unit_type.status = 'active'`, but the immutable baseline has no such
column. Active lifecycle fields exist on sellable units and spaces, which the query
already checks.

## Requested correction

May production remove only the nonexistent unit-type predicate while retaining exact
property/tenant filtering and the active sellable/space requirements?

Recreate the focused database, apply migrations 0001–0005, and restart all six tests.

## Status

ANSWERED by the temporary architect in `071-ARCHITECT-RESPONSE.md`; independent review
remains debt.
