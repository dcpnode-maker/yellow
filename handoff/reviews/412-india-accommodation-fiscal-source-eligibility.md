# Order 412 — Fresh independent Tier-3 review

**Verdict:** CHANGES-REQUIRED-D1224

**Reviewed candidate:** `250b522`

**Approved base:** `0ce9033`

**Reviewer:** `/root/order412_fresh_tier3`, fresh independent non-implementing
Tier-3 reviewer

## Finding

Approval is withheld. On a fresh isolated official PostgreSQL 16.15 database, the
reviewer swapped only the guest-root `tax_detail.revenueRoute.mappingId` and first
positive component `route.mappingId`, leaving each semantic code, transaction code,
credit account and every persisted route row unchanged. Production returned
`eligible_current_posted_source`.

The resolver validates each displayed semantic/transaction/account tuple, but then
checks the collected mapping identities as an unordered valid same-jurisdiction set.
It therefore fails to prove that each mapping identity owns the corresponding tuple.
Bind every mapping identity to its exact semantic code, transaction code and credit
account, add this real-database hostility with a complete unchanged census, produce a
new candidate and restart a different fresh Tier-3 review.

## Reviewer-personal execution

- fresh official PostgreSQL 16.15, migrations 1–73;
- permanent Order412 live suite **5/5 (185 assertions)**;
- intentional-red **2/2**;
- separate targeted swapped-route-identity attack: **incorrectly accepted**.

Sentinel canonicalization is test-only and production component-tax byte replay
remained strict. The isolated database was stopped and removed. Stable/default
databases, local port3000 and `.yellow/` were untouched. No approval or downstream
document/IRP/API/UI/local/deploy/Phase authority follows.
