# Question 086 — Relevant event proof omits canonical half-open bounds

**Status:** CLOSED — temporary architect response recorded
**Order:** 059
**Evidence:** final source readback found `propertyPeriodEnvelope` rejects empty, infinite,
reversed and unparsable PostgreSQL ranges, but accepts `(]`, `[]` or `()` bounds. Its
upper-minus-one-microsecond date derivation is exact only for Yellow's mandatory half-open
`[)` time-range convention. P5 currently proves malformed text but not a parseable
noncanonical range.

May the in-scope envelope query require `lower_inc(period)` and `NOT upper_inc(period)`,
with P5 adding a parseable `(]` event that leaves projection, cursor and markers unchanged?
No producer, event catalogue, occupancy function, migration or public contract changes.
