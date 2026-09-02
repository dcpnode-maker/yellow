# Order 366 — Order363 final carry-proof repair

**Status:** BUILT-PENDING-DIFFERENT-FRESH-TIER3 — exact candidate `2f631a5`
**Phase:** 5 — Financials
**Branch:** `phase-5/order363-final-carry-proof-repair`
**Base:** exact withheld proof `80b696d` / governance `b270746`
**Risk tier:** 3 — irreversible carry authorization and atomic evidence proof
**Owner:** Codex proof implementation; different fresh non-implementing Tier-3 reviewer

## Outcome and exact scope

Modify only `tests/business-day-discrepancy-carry.integration.test.ts` and bounded
test helpers to close the exact Order363 review findings:

1. bind exact approval permission/scope to the alternate decider, then inactivate
   that bound user and make removal of `u.status='active'` fail the permanent case;
2. publish the canonical outbox event in the supplied transaction and inject failure
   after insertion but before completion, proving exact rollback and clean retry;
3. deterministically snapshot `folio_balance` plus every current in-scope financial,
   cashier, trust, tax, fiscal, document, journal, posting, folio and payment surface;
   add observation mutants so each required surface is load-bearing;
4. prove ACL/execute containment for both prepare and carry capabilities;
5. compare every same-key contender's returned identity/body byte-for-byte; and
6. isolate consumed approval, request and target reuse so source staleness cannot mask
   the named one-use constraints.

Run the exact inactive-status, after-event, snapshot-surface and reuse mutants, fresh
focused PostgreSQL, exact catalogue and complete Order363 full gate matrix. A
different fresh non-implementing Tier-3 reviewer must personally approve.

## Forbidden

No production/migration/schema/catalogue/policy/window/event/permission/route/UI/
financial mutation/local/deploy/merge/`.yellow`/port3000 change. No assertion may rely
on a second guard to mask the authority it claims to prove.

## Builder evidence

Exact test-only candidate `2f631a5` modifies only the permanent carry integration
suite. A fresh isolated PostgreSQL 16 run passes 11/0 with 726 assertions; typecheck
and diff hygiene pass. It binds an authorized alternate decider before inactivation,
inserts the canonical outbox event before injected failure, expands deterministic
financial/cashier/trust/tax/fiscal observations, covers both capabilities' ACLs,
compares same-key response identities/bodies, and isolates approval/request/target
reuse. Disposable resources were removed; the stable local and `.yellow` were not
touched. These builder results do not substitute for the required different fresh
Tier-3 review.
