# Question 070 — Order 058 PostgreSQL date-series overload

## Trigger

The first implemented Order 058 focused run returned `0 pass / 6 fail`. Every test
stopped before its projection assertion because production's bounded date expansion used
`generate_series(date,date,1)`, for which PostgreSQL has no overload. P1's independent
DST-boundary query repeated the same invalid third argument.

## Requested correction

May both in-scope queries use `interval '1 day'` as the third argument, preserving exact
date bounds, timezone conversion, row logic and all assertions?

Recreate the focused database, apply migrations 0001–0005, and restart all six tests.

## Builder position

Yes. This is exact function-overload repair, not a behavioral decision or assertion
change.

## Status

ANSWERED by the temporary architect in `070-ARCHITECT-RESPONSE.md`; independent review
remains debt under D-95/D-115.
