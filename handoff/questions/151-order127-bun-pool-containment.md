# Question 151 — Order-127 Bun reserved-pool containment

**Status:** RESOLVED BY D-395 — CORRECTION READY
**Order:** 127 · runtime database authority
**Branch:** `phase-5/runtime-database-authority-final`
**Approved Base:** `8daf34e1f1328e866b0b52ff750631e7d651d0b7`
**Question-150 governance:** `80c36d8d48e3c6e8a30736a0cc8b9a0cad6f660b`
**Prepared-cache correction audit:** `11f50d6f4da9b9633bc63e631d72e9858d0e09ba`
**Bounded-close proof head:** `b11b425d9359ad0b90778e96a7bca41d7834104e`
**Related decisions:** D-392, D-394, D-395

## RESOLVED

## Live builder stop

The exclusive disposable Order-127 builder cluster reproduced two incompatible Bun
behaviors inside the already admitted `src/kernel/db.ts` and focused proof paths.
Every disposable database was force-dropped after the stopped run; no app, shared or
live database was used.

First, failed settlement followed by PostgreSQL `DISCARD ALL`, exact re-verification
and release returned the reserved backend to a Bun SQL pool whose client-side prepared
statement catalogue still named statements PostgreSQL had discarded. The next
tenant transaction failed exact SQLSTATE `26000` (`prepared statement ... does not
exist`). The database itself was clean; the client cache was not.

Second, replacing release with `ReservedSQL.close({ timeout: 0 })` did not destroy only
that backend. Bun closed/poisoned the owning SQL pool. The permanent max-one reuse
canary timed out, the next reserve failed `ERR_POSTGRES_CONNECTION_CLOSED`, and bounded
`Database.close()` did not settle. All P0/P1 assertions and the preceding containment
checks were otherwise green, but the hung process was correctly not counted as proof.

## D-395 bounded contract

Only Database-owned application runtime pools created by `Database.connect` use Bun
`prepare: false`. Deploy, migration, seed, schema, referee, login, event, extension and
worker pool contracts do not silently change. With no client prepared-name cache, a
failed settlement path may safely:

1. finish or roll back the outer transaction;
2. issue `DISCARD ALL` outside a transaction;
3. run an unprepared exact check that `session_user = current_user = yellow_runtime`
   and tenant context is null;
4. verify `pg_prepared_statements` is empty; and
5. release the backend only after every check succeeds.

If rollback, discard or either recheck fails, the adapter must not release the
backend. Because Bun exposes no supported single-reserved-backend destroy operation,
the owning pool fails/closes instead. Ordinary successful COMMIT/ROLLBACK settlement
continues to release normally without DISCARD. `Database.close()` remains bounded,
idempotent and safe after both ordinary reuse and successful hostile containment.

The permanent focused proof uses one Database with max one connection. A hostile
callback establishes session tenant state, a temp table and a prepared statement;
after the expected settlement error, the next request through that same Database must
authenticate as `yellow_runtime`, enter only tenant-local `app_role`, observe null
residual session tenant outside the transaction, see neither temp nor prepared state,
and complete without SQLSTATE `26000`, pool poisoning or teardown hang.

## Exclusions

This ruling adds no path and changes no migration, role, membership, capability,
function, ACL, RLS policy, table grant, tenant rule, deploy/tool connection option or
domain behavior. It does not authorize a generic retry, pool replacement during
concurrent work, swallowed shutdown error, weaker settlement assertion, prepared
client release after DISCARD, self-review, merge, push, deployment, live mutation or
Cyber closure. Corrected executable proof must restart P0 and P1–P5, followed by a
fresh non-implementing Tier-3 review.
