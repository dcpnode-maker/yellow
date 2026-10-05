# Question 107 — Order 067 evaluator, money and occupancy boundaries

## ANSWERED — TEMPORARY ARCHITECT

**Order:** 067

May Order 067 implement the seven direct pricing families plus expert composition as a pure,
bounded, typed evaluator AST with no persistence or active-price write; accept monetary values only
as `bigint`; apply basis-point adjustments with deterministic half-up rounding on a non-negative
product; consume occupancy only as an attributable 0–10,000 basis-point metric supplied by a later
quote boundary; and compose expert rules only through explicit numbered stages?

Package/policy composition remains Order 068, approval/publication remains Order 069, and governed
RMS/API input plus final quote resolution remains Order 070. The evaluator must not read or mutate
occupancy claims, availability, restrictions, rate-price rows, extension rows or any other database
truth.

## Answer

Yes, with these exact constraints:

1. The evaluator is deterministic and side-effect-free. It may normalize and evaluate only the
   supplied typed command plus attributable context; it creates no second active pricing truth.
2. Every amount or signed delta is a runtime `bigint` inside signed-bigint bounds. A JavaScript
   `number`, decimal string, float, NaN or infinity at this boundary is invalid.
3. Basis points are integers. Multiply exact bigint first, then round a non-negative rational to the
   nearest minor unit with ties upward. Negative resulting prices, overflow and floor-above-ceiling
   fail closed.
4. Occupancy response uses only a supplied basis-point metric plus a bounded evidence reference.
   It is pricing context, never occupancy authority, and cannot create inventory or make a blocked
   room sellable.
5. Non-expert models have one adjustment stage. Expert composition may declare stages 1–8 and
   applies them numerically; within a stage, documented specificity and explicit priority select one
   rule, while an equal top tuple returns a conflict.
6. Closed calendar cells mean “no price from this model,” not a restriction or availability change.
   Package, policy, restriction, publication, approval, RMS/API and HTTP/UI behavior remain deferred.
