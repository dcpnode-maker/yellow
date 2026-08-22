# Question 056 — Order 051 idempotent response bytes

**Status:** CLOSED — see `056-ARCHITECT-RESPONSE.md`

The first implemented focused run produced 5 pass / 1 fail. P3 showed the first and
replayed responses carried identical values but different object-key order because the
first body came from the in-memory command while the durable replay came back from a
PostgreSQL JSONB column. Should the byte-equivalence proof be weakened to parsed-value
equality, or should this endpoint canonicalize both response paths after settlement?

No database row, monetary value, claim cardinality or assertion is proposed for change.
