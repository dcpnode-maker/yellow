# Question 113 — Order 068 inherited normalized evaluator incompatibility

## ANSWERED — TEMPORARY ARCHITECT

**Order:** 068

The first focused run reached all seven assertions but every case stopped inside Order 067:
`normalizeRateEvaluatorSpec()` emits explicit `floorMinor: null` and `ceilingMinor: null`, while
`evaluateRateModel()` normalizes its input again and rejects those null fields as money. Order 068
must authenticate a frozen canonical evaluator spec rather than accept an unproven raw object. May
scope add `src/contexts/rates/evaluators.ts` and `tests/rate-evaluators.test.ts` solely to make explicit
null guards idempotent and prove normalized output can be evaluated?

## Answer

Yes. Accept `null` only for the already-nullable floor and ceiling fields, preserving all bigint
validation for non-null values. Add one exact regression assertion that a normalized fixed spec can
be evaluated. Do not change pricing math, guards, model rules or any other Order 067 behavior.
Restart typecheck, the complete Order 067 suite and all seven Order 068 proofs.
