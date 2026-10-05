# Independent review — Order 095 atomic reservation guest/share command

**Result:** APPROVED

**Reviewed tip:** `1d173a2`

**Implementation base:** `a5ac5cb`

**Order base:** `22e4264`

**Reviewer:** independent non-implementing Codex reviewer

**Date:** 2026-08-24

The reviewer made no edits or commits and found no actionable issue. Static inspection
confirmed canonical two-decimal shares are converted and summed only as integer basis
points; the full normalized request is idempotently bound; reservation and guest rows are
locked; tenant, property, active-party and primary-membership boundaries fail closed; the
primary cannot be overwritten or deleted; exact no-ops emit no fact/event; real changes
reuse the existing `reservation.modified` fact and transactional outbox event; and a
publisher failure rolls membership, fact, outbox and idempotency back together.

On fresh isolated reviewer project `yellow-order095-review`, port 5499 and dedicated
database `yellow_order095_review`, migrations 0001–0007 applied and P1–P4 passed
**4/4 with 52 assertions**. Exact replacement, replay, no-op, changed-key conflict,
twenty concurrent unique replacements, hostile tenant/property/party/status/primary/share
inputs and publication rollback all passed.

The reviewer also personally passed typecheck, 59-file import boundaries, exact normalized
schema, the **120 pass / 0 fail** default suite with 1,544 assertions, 23-package licence
policy and zero-vulnerability audit. A second pristine app-never-started referee database
contained 84 public tables and reported **11 passed, 0 failed of 11**. Migration 0001,
the invariant referee, schema snapshot, package/lock files and all forbidden surfaces were
unchanged. The reviewer discarded an attempted reuse of a consumed one-shot referee
fixture, reproduced 11/11 on the new pristine database, and removed all disposable review
infrastructure.

## Exclusive Order 095 discharge

- 095
