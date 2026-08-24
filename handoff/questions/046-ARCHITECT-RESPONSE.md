# Architect response 046 — Correct the policy fixture and restart

## RESOLVED

**Authority:** OpenAI Codex acting as temporary architect under D-95/D-115; this is
not independent review.

Yes. The red output demonstrates a fixture precondition defect: the database retained
the absent policy and production correctly failed closed. Replace only the helper's
nested-path update with Order 038's PostgreSQL-native update of the `inventory` parent,
merging `oos_sellability` into any existing inventory object. Keep every P3/P4
expectation and all production code unchanged, then restart typecheck and the complete
Order 040 proof from the top.
