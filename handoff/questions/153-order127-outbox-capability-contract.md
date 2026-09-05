# Question 153 — Order-127 outbox capability contract

**Status:** RESOLVED BY D-397 — CORRECTION READY
**Order:** 127 · runtime database authority
**Branch:** `phase-5/runtime-database-authority-final`
**Affected rerun head:** `19d3e352e68995357e0f9c806d257e5834705c17`
**Related decisions:** D-392, D-397

## RESOLVED

## P5 affected-proof stop

On a fresh exclusive v15 database, canonical fixture loading, auth/token and tenant
context proofs were green. The next fresh outbox proof exposed three distinct facts:

1. `public.outbox.property_node` is `uuid`, but
   `runtime_consumer_read(text,bigint,integer,boolean)` declared result column 4 as
   `ltree`, so real reads failed with SQLSTATE `42804` before cursor/dedupe behavior
   could be proven;
2. the inherited catalogue oracle still expected the current deployment role to own
   `consumer_cursor` and `consumer_processed`, although D-392 requires exact
   `yellow_owner` ownership after v15; and
3. the unchanged P1 task/event atomicity setup inserted a task without its required
   `org_node` property parent and failed SQLSTATE `23503` before reaching the assertion.

The disposable database, project, network and volume were removed and Docker was
stopped. None of these failed results count as proof.

## D-397 exact correction contract

Migration 0015 must declare `runtime_consumer_read` result column 4 as exact
`property_node uuid`, matching the unchanged authoritative outbox column and existing
caller event shape. No cast, path conversion or schema change is allowed. The already
admitted outbox proof must change only its post-v15 owner oracle from current/deploy
to exact `yellow_owner` and retain RLS/ACL denial assertions.

Before the unchanged P1 task/event mutation, the proof must create only the exact
authoritative `org_node` property row referenced by that task, including its required
tenant ancestry if the schema requires it, or load the canonical governed seed
fixture. The task foreign key and expected atomic commit/rollback assertions remain
unchanged. Fresh proof must demonstrate the corrected uuid result under ordering,
dedupe, restart and concurrent-consumer paths.

## Exclusions

No edit to migrations 0001–0014, `public.outbox`, `org_node`, task foreign keys, RLS,
ACL grants, capability breadth, caller event shape or scope path is authorized. D-397
does not permit an `ltree` cast, synthetic orphan task, disabled constraint, nullable
parent, removed owner assertion, expected-error change, assertion weakening, reuse of
failed P5 evidence, self-review, merge, push, deployment or Cyber closure.
