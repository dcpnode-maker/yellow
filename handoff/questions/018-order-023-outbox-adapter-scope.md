# Question 018 — Order 023 outbox adapter scope

**Status:** CLOSED — see `018-ARCHITECT-RESPONSE.md` and D-101.

## RESOLVED

## Stop condition

The pre-commit scope audit found that Order 023 names `src/kernel/relay.ts` but not
`src/kernel/outbox.ts`. The relay must perform the D-94 consumer-effect/dedupe/cursor
transaction, commit it before publication acknowledgement, reselect still-unpublished
rows on restart, and prune processed markers transactionally with old published rows.
The existing PostgreSQL adapter owns the deploy-role pool and that durable consumer
transaction.

Implementation work had already added those narrowly required adapter methods before
this omission was noticed. No commit was made. This should have been raised before the
file was edited.

## Question

May Order 023 Scope add only `src/kernel/outbox.ts` for unpublished-batch consumption,
publication acknowledgement, and paired pruning? No schema, baseline migration,
referee, dependency, or generic EventBus contract change is required.

