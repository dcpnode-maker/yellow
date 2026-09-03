# Order 387 — Operator business-day discrepancy carry

**Status:** CHANGES-REQUIRED-PROOF-GAP-D1143
**Phase:** 5 — Financials operator delivery
**Base:** exact independently approved Order384 tip `1196d89`
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

## Activated contract

The facade accepts only server-derived tenant/property/actor envelopes. Approval
request accepts one exact workbench source date, authoritative candidate id and a
trimmed visible reason of 1–500 UTF-8 bytes; it derives the current open target and
all state/request hashes through the existing PostgreSQL prepare capability. Decision accepts
an opaque approval id and exact `approved` or `rejected`; before invoking the generic
approval primitive it locks and revalidates exact kind, subject, candidate property,
canonical payload, pending state, different user, checker permission and strict
PostgreSQL thirty-minute validity. Final carry accepts only the approval id and derives
the approved request hash from that same locked canonical evidence before the existing
carry service performs its final authoritative revalidation.

The inbox is carry approvals only, newest-first keyset `(created_at,id)`, default 50
and maximum 100; limit 101, noncanonical cursor or ambiguous/malformed evidence fails
the complete read closed. It returns only approval id, source discrepancy/date, target
date, room code, bounded reason, requester label, status, request/decision/expiry
timestamps and server-derived action flags. It never returns payload, hashes,
target-open instant, emails or permission names. Cursor coordinates confer no authority.

HTTP routes are nested under the property Day-close surface: candidate approval
request, bounded approval inbox, approval/rejection, and final carry. Every mutation
uses the existing visible-ASCII idempotency header, exact body shape, middleware
`context.tx`, correlation envelope and server actor; decision/carry bodies are empty.
The UI adds deliberate Request, Approve/Reject and Carry actions without raw authority,
preserves keys across ambiguous retries, suppresses stale responses, refreshes the
whole workbench after success, and remains keyboard, responsive and theme-complete.
Migration0063 remains immutable and final authority.

## Activated proof

- Intentional reds precede facade, HTTP and browser production changes.
- Official PostgreSQL16.15 proves prepare/request/decision/consume lineage, 30-minute
  boundary, maker/checker grants, inactive/foreign/wrong/stale/reused evidence,
  source/target seal races, rollback, replay/content conflict and concurrency.
- Inbox proves 50/100/101, keyset ties, tenant/property containment, minimized privacy,
  no payload predicate scan, and fail-closed malformed evidence.
- Browser proof executes request, inbox decision and carry, cancellation, ambiguous
  retry keys, stale suppression, focus and all approved layouts/themes.
- Full focused/standing/database/static/referee gates and fresh Tier3 review are
  mandatory before approval or local promotion.
