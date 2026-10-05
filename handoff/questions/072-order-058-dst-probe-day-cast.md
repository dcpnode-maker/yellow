# Question 072 — Order 058 independent DST probe day cast

## Trigger

The D-201 restart returned `5 pass / 1 fail`. Production and P2–P6 passed. P1's
independent probe used `(day + 1)` even though interval-based `generate_series` returns a
timestamp; PostgreSQL rejected `timestamptz + integer` before the 24/23/24-hour assertion.

## Requested correction

May only the probe use `(day::date + 1)`, matching its lower-bound date cast and leaving
production and all expected durations unchanged?

## Status

ANSWERED by the temporary architect in `072-ARCHITECT-RESPONSE.md`; independent review
remains debt.
