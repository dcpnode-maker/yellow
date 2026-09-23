# Question 097 — Order 064 snapshot literal inference

## ANSWERED — TEMPORARY ARCHITECT

**Order:** 064  
**Observed:** the first implemented typecheck stopped before any database proof. Deeply immutable
snapshot constants infer exact literals `63`, `19` and `0 | ... | 12`; Bun's typed `toBe` and
`toEqual` overloads reject the manifest parser's ordinary `number` and `number[]` values even
though the runtime equality assertions are exactly the intended drift proof.

May the focused test normalize only the immutable snapshot side of those three comparisons with
`Number(...)` / `.map(Number)`, preserving exact equality, production literals and every runtime
assertion, then restart typecheck and the focused proof from the top?

## Answer

Yes. This is test-boundary type normalization, not weakening. Change only the three focused
comparison expressions, retain exact equality and restart typecheck before any database proof.
Do not widen the production snapshot types or cast the manifest parser.

