# Question 073 — Order 058 independent DST probe date label

## Trigger

The D-202 restart returned `5 pass / 1 fail`. P1 computed the required 24/23/24-hour
durations, but `day::text` rendered the timestamp-returning series as a full UTC timestamp
instead of the expected local-date key.

## Requested correction

May only the probe label use `day::date::text`, preserving production, exact durations
and expected `YYYY-MM-DD` keys?

## Status

ANSWERED by the temporary architect in `073-ARCHITECT-RESPONSE.md`; independent review
remains debt.
