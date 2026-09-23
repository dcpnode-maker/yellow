# Question 130 — Order 084 exact quote scope

## BLOCKED — ARCHITECT NEEDED

**Order:** 084  
**Raised by:** OpenAI Codex builder  
**Production edits made:** only the in-scope optional availability predicates are uncommitted;
`src/contexts/rates/quote.ts` is untouched

Pre-implementation source tracing found that `RateQuoteService.resolve` currently asks
`AvailabilityService` for every sellable in the property and filters one id in TypeScript. Order
084's one-quote-per-candidate composer would therefore make N full-property availability scans and
degrade quadratically. It would also have only the initial broad option's restriction values and
operational causes after the exact quote reread, so the public adapter could bind stale diagnostic
detail to a newer quote hash.

May Order 084 add `src/contexts/rates/quote.ts` to Scope only to (a) pass its already validated
`sellableUnitId` into the new exact availability predicate and (b) include that exact returned
`AvailabilityOption` in the quote's hashed evidence/output? No query rule, price, composition,
publication, projection, restriction, occupancy or HTTP authority changes. The red proof and P5
will require one broad read plus one exact constant-scope read per candidate.
