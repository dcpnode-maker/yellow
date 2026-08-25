# Question 142 — Order 053 proof still expects the retired 17-scope review role

**Status:** RESOLVED — isolate the fixture-only correction as Order 125
**Raised by:** Order 121 builder
**Observed on:** `bc27020e8c3f26e9cc68658cab00a2f9ac1929ed` (the affected file is unchanged from approved Order 120 base `a2540fdf76f6436f2b59f3d09345b5b054d569c3`)
**Related:** Order 053 P7/P8; D-336/current approved review-seed contract

## Evidence

The fresh `tests/operator-operational-blocks.integration.test.ts` run passed all six
operational-block mutation, authorization, concurrency, rollback, fact, outbox and
idempotency cases. Its final test, `P7/P8: Operations assets are typed, same-origin,
responsive and exact-scope`, then failed only because its inline expected permission
array still names the pre-CRM/reservation/financial 17-scope review role.

The production `runReviewSeed` result was the approved 27-scope role. The received
array contained the original 17 entries plus exactly these ten later approved scopes:

- `crm.parties:read`
- `crm.parties:write`
- `financials.charges:write`
- `financials.folios:read`
- `reservations.guests:read`
- `reservations.guests:write`
- `reservations.lifecycle:read`
- `reservations.lifecycle:write`
- `reservations.segments:read`
- `reservations.segments:write`

This is inherited proof drift, not an Order 121 actor-idempotency defect. Changing
`src/http/operator.ts`, the review seed, permissions, roles, tokens, auth behavior, or
any product file to satisfy the stale assertion would be wrong and is forbidden.

## Resolution

Order 125 owns a fixture-only correction limited to the one named test's exact inline
permission literal. It must prove the approved 27-scope production seed rather than
altering production to match stale history. Order 121 records this stopped run and
continues its nonblocked gates; it does not claim the Order 053 suite green.
