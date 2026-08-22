# Question 093 — Order 062 inherited permission expectations

## ANSWERED — TEMPORARY ARCHITECT

**Order:** 062  
**Observed before running the compiler:** repository search shows six inherited operator proof
files assert the exact local-review role or JWT scope string. Order 062 requires two new
permissions, but its Scope currently names only the hold and review-seed proof files.

May Scope add only these inherited expectation files and update only their exact expected role
from fifteen to seventeen permissions?

- `tests/operator-inventory.integration.test.ts`
- `tests/operator-restrictions.integration.test.ts`
- `tests/operator-rate-configuration.integration.test.ts`
- `tests/operator-rate-pricing.integration.test.ts`
- `tests/operator-operational-blocks.integration.test.ts`
- `tests/operator-oos-policy.integration.test.ts`

## Answer

Yes. The local-review role is intentionally exact and every inherited assertion must continue
to prove that exactness. Add the six files to Order 062 Scope and insert only
`inventory.offline_leases:read/write` in sorted order (renaming a stale fifteen-scope title to
seventeen where present). Do not relax equality, remove an existing permission, or change any
behavioral assertion. Restart every touched inherited proof.

