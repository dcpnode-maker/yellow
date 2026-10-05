# Order 357 — Order354 buyer-approval expiry and proof completion

**Status:** APPROVED-D1012
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/order354-buyer-expiry-proof-completion`
**Base:** exact withheld repair `62a5870` / governance `bf1d8b5`
**Risk tier:** 3 — statutory valuation and immutable financial lineage
**Owner:** Codex repair implementation; different fresh non-implementing Tier-3 reviewer

## Outcome

Close D1007 without widening Order350/354. A conflicting legal-buyer override is
valid only when its exact different-user approval is approved, unexpired at the
database transaction instant, unused for another finalization and bound to the exact
tenant/property/reservation/window/buyer/relationship-set/request evidence. Complete
the permanent executable proof matrix that D999 and Order354 required.

## Production repair

- Within still-unapproved migration0062, add the smallest typed expiry/valid-until
  constraint needed for buyer-override approvals; preserve exact catalogue
  `62/115/105/14/2`.
- The owner command uses PostgreSQL transaction time, never a caller/browser/server
  clock, and rejects missing, expired, future-invalid, reused, changed-buyer,
  changed-relationship-set or mismatched request evidence.
- Preserve exact different-user approval, complete buyer-candidate derivation, locked
  relationship/root/Order244 lineage, canonical server hashes, correction inheritance,
  append-only evidence and atomic fact/outbox behavior.

## Permanent proof completion

Add the missing focused tests without weakening existing assertions:

1. buyer approval below/exactly-at/above expiry, replay/reuse, changed buyer,
   relationship set and request, concurrent finalizers and approval/finalization race;
2. every canonical manual reason and every ordinary conclusion/source/addition/
   discount partition, including incomplete and contradictory attestations;
3. correction inheritance, fork and concurrent-successor arbitration;
4. injected failures after each immutable evidence stage proving complete rollback and
   clean retry;
5. exact replay versus content conflict, canonical fact and outbox payload/hash, one
   winning publication and zero duplicate evidence;
6. allocator mutants and signed-boundary cases; foreign tenant/property/actor/role,
   missing/stale/superseded/duplicate roots and Order244 lineage ambiguity;
7. direct UPDATE/DELETE denial for every Order350 evidence table and rollback-safe
   immutable-DML proof isolation.

## Scope

- `migrations/0062_india_gst_accommodation_final_valuation.sql`
- `src/contexts/tax-fiscal/india-gst-accommodation-final-valuation.ts` only if the
  expiry field/result contract must be typed there
- the existing Order350/354 focused unit and PostgreSQL integration test files
- exact migration/schema/acceptance/runtime/seed oracles only where migration0062's
  checksum or constrained column definition changes
- governance/review evidence for this order

No other file is admitted. If another file is required, stop with a scoped question.

## Excluded

No tax money, slab calculation, posting, journal, document, IRP, HTTP/UI/local change,
new table/event/state, caller-derived hash/classification, relationship inference,
generic authorization or migration0063 allocation.

## Required execution

Reproduce the exact D1007 expiry acceptance and proof-absence findings before repair.
Then personally prove the complete matrix on fresh PostgreSQL with exact
`62/115/105/14/2`, migration/schema/acceptance/runtime/seed gates, standing/static
gates and referee 11/11. A different fresh non-implementing Tier-3 reviewer must rerun
the proof; neither the Order350 nor Order354 implementer nor the D999/D1007 reviewer
may approve it.
