# Order 387 — Operator business-day discrepancy carry

**Status:** DRAFT-WAITING-ORDER384-D1118
**Phase:** 5 — Financials operator delivery
**Prospective base:** exact independently approved Order384 tip
**Risk tier:** 3 — audited discrepancy maker/checker and day attribution

Extend the approved day-close workbench with the existing governed carry workflow.
The server derives source/target/hash/actor/tenant truth; the browser selects only one
authoritative candidate, supplies a bounded reason, and later invokes actions through
opaque approval identifiers. No new database capability or migration is planned.

Exact draft scope: caller-Tx carry-specific approval list/decision/consume facade and
context export; operator API/app/server/day-close UI; review seed grants
`financials.business-day:carry-discrepancy` only to the ordinary review role and
`financials.business-day:approve-discrepancy-carry` only to the distinct approver role;
focused intentional-red/unit/PG/HTTP/browser tests; exact permission-seed oracles and
CONTRACTS/UI-SPEC/SECURITY; order/review/governance. No generic approval UI, raw payload,
hash, caller target date, seed fixture, migration, local promotion, deploy or merge.

Draft routes: request under exact source-day/candidate; bounded cursor approval inbox;
approve/reject decision; maker-only final carry. Middleware owns `context.tx`; every
mutation requires header idempotency. Exact kind/subject/property/payload and checker
scope are re-proven before generic approval decision, while migration0063 remains the
final authoritative revalidation/atomic mutation. Thirty-minute expiry, different-user
checker, one-use, source/target seal and concurrency hostility require fresh Tier3 proof.

