# Question 106 — Order 066 test array inference

## ANSWERED — TEMPORARY ARCHITECT

**Order:** 066

The first implemented `tsc --noEmit` stopped before database proof because the focused test's empty
`drafts` array is populated inside a loop and TypeScript cannot infer its element type. May the test
annotate only that local as `RateTargetDraft[]`, using the already imported production result type,
then restart typecheck?

## Answer

Yes. Do not cast returned drafts, widen the production type, or change the three-mode equality
assertions. Add the one local annotation and restart the compiler.
