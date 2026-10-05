# Question 033 — Order 029 expected ledger tuple is readonly

The D-119 restart failed typecheck because the exact expected ledger uses `as const`,
making it readonly while Bun's equality matcher receives a mutable mapped array. May the
test remove only `as const` and retain exact whole-array equality?

## RESOLVED

Answered by D-120 and `033-ARCHITECT-RESPONSE.md`.
