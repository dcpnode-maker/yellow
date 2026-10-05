# Question 152 — Order-127 repeat-v12 role transition

**Status:** RESOLVED BY D-396 — CORRECTION READY
**Order:** 127 · runtime database authority
**Branch:** `phase-5/runtime-database-authority-final`
**Q151 implementation head:** `37634fb4098060f0ea5224ba235759a214475b68`
**Repeat-database runner correction:** `3d80d7db0a6c5291c2ea16cb7edec76bd2f9f967`
**Related decisions:** D-392, D-393, D-396

## RESOLVED

## P5 affected-proof stop

The first affected P5 suite ran in exclusive disposable project
`yellow-o127b-p5`. A fresh database migrated through 0015, then the inherited
Order-118 proof passed three cases and exposed two exact compatibility failures. The
post-v15 catalogue correctly had one incoming `app_role` membership, but the old
oracle expected zero. Its atomic v12 retry deliberately restored the known pre-0012
parent role, while the repeat-database wrapper rejected any tuple other than already
hardened before unchanged 0012 could do its job. The test database and exact project,
network and volume were removed, and Docker Desktop was stopped.

## D-396 exact wrapper contract

PostgreSQL membership is cluster-global. Once any database installs 0015, the exact
`yellow_runtime`→`app_role` edge exists while another database may still have a
per-database ledger pending v12. The wrapper may accommodate that state only inside
the same v12 ledger transaction and only when all of these are true:

1. the sole relevant membership is exact `app_role` granted to `yellow_runtime` with
   admin false, inherit false and set true;
2. `yellow_runtime` has the final LOGIN, limit `-1`, non-null password,
   NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOINHERIT/NOREPLICATION/NOBYPASSRLS tuple;
3. `app_role` is either the final NOLOGIN, limit `0`, null-password, NOINHERIT tuple,
   or the exact migration-0012 parent tuple: LOGIN, limit `-1`, null password,
   INHERIT, with every elevated attribute false; and
4. no `yellow_runtime` session or other relevant membership exists.

The wrapper revokes the edge transaction-locally, executes unchanged migration 0012,
then requires the final hardened app-role tuple, re-grants the edge and verifies both
before inserting the v12 ledger row and committing. Any third tuple, password,
elevated attribute, session, membership, SQL failure or verification mismatch rolls
the entire transition and ledger back.

The Order-118 proof remains strong: it must still demonstrate that 0012 hardens the
known LOGIN parent, rejects hostile incoming/outgoing membership and an authenticated
direct session atomically, and retries once. Only its final post-v15 membership oracle
changes to exact one incoming edge from `yellow_runtime`, zero outgoing edge and zero
other relevant membership.

## Exclusions

No edit to migrations 0001–0015, role password, production pool, capability, ACL, RLS,
domain behavior or scope path is authorized. D-396 does not permit a visible
cross-transaction revoke, a generic role repair, hidden membership, assertion
weakening, reuse of stopped P5 evidence, self-review, merge, push, deployment, live
mutation or Cyber closure. P0–P5 must restart as applicable on the corrected immutable
head before independent Tier-3 review.
