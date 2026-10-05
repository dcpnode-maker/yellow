# Question 013 — Public-demo fixture deployment reconciliation

## Observation

On 2026-09-20 the passwordless public cashier desk could locate synthetic
`PARKING-REVIEW`, but resolving the selected stay returned **"Stored reservation
data is incoherent"**. The defect is visible in the live public application; it
must not be masked in the browser.

The active runtime source contains the independently reviewed fixture repair:

- `scripts/seed-review.ts` SHA-256
  `A394A3201B62515ADE9A2A134D4967080451B3447EE1941854428F603D8B80D4`
- `tests/review-seed.integration.test.ts` SHA-256
  `A57B6465EACB077B46ACE7109506628A5F49F2EFEDEF3910F0DEEF4D0E64A8DF`

However, the retained deployment seed log predates that repair. A later
current-target seed attempt stopped before parking provisioning at
`Local-review clean arrival party collides with non-canonical local-review data`.
Therefore the reviewed source must not be represented as delivered to the live
synthetic database, and `PARKING-REVIEW` remains unfit for the public billing demo.

## Required next order

Before any current-target reseed or reconciliation, create a narrow order that:

1. Performs a **read-only** current-target preflight that fingerprints the
   clean-arrival collision, the PARKING reservation/guest/segment/occupancy/folio
   relationships, and protected zero financial rows.
2. Names the exact authorized reconciliation, its idempotency behaviour, preserved
   state, stop/rollback rule, and postconditions.
3. Requires independent execution of both the mutation proof and public browser
   proof. No blind rerun of `seed-review.ts` is permitted because it deterministically
   stops at the earlier collision.

No mutation, restart, secret disclosure, data deletion, or production access is
authorized by this question.
