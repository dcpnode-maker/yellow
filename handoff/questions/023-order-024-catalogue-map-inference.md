# Question 023 — launch-catalogue map inference

**Status:** CLOSED — see `023-ARCHITECT-RESPONSE.md` and D-106.

## RESOLVED

Typecheck rejected the catalogue proof because Map inferred six literal keys while the
mapped automation rows widen their type field to string. May the proof annotate the map
as `Map<string, unknown>` (with the schema value type preserved) without changing data
or assertions?

