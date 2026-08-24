# Order 113 — SECURITY DEFINER shadow-path containment

**Phase:** 5 security gate
**Branch:** `phase-5/security-definer-containment`
**Base:** `52f8b0c` — independently approved Order 104 lineage
**Risk tier:** 3 — database privilege boundary, occupancy choke point, outbox retention and business-day seal
**Severity:** release-blocking critical
**Owner:** Codex implementation; independent non-implementing reviewer required

## Outcome

Close the confirmed PostgreSQL temporary-schema shadowing path across every current
`SECURITY DEFINER` function with one forward migration. An `app_role` session must not
be able to make a definer resolve attacker-owned `pg_temp` relations or execute an
attacker trigger with the deployment owner's authority. Existing occupancy, outbox,
hold-expiry, day-open and day-seal behavior stays otherwise exact.

## Confirmed red

Independent hostile execution at the pre-0011 tree proved that `prune_outbox` and
`seal_business_day` resolve unqualified relations through an attacker's temporary
schema while running as the owner. A temporary shadow table plus attacker trigger can
therefore execute under the definer's owner authority. The five baseline definers and
Order 104's `assert_day_open` use the same unsafe search-path class; containment must
sweep all six current function signatures rather than fix only the two demonstrated
entry points.

This order contains that exploit class only. Caller-supplied tenant trust in occupancy
functions, the superuser/owner runtime DSN and `RESET ROLE`, FORCE RLS/BYPASSRLS design,
and token-secret deployment policy are separate findings and remain release blockers
for later scoped orders.

## Scope

- `migrations/0011_security_definer_containment.sql`
- `tests/security-definer-containment.integration.test.ts`
- `tests/migrate.integration.test.ts`, `tests/database-acceptance.integration.test.ts`,
  `tests/schema/expected.sql`
- `scripts/run-phase-3-gate.ts`, `tests/phase-3-gate-runner.test.ts` solely to make
  the hostile Order 113 proof reviewer-triggerable on an isolated database
- `docs/SECURITY.md`, `docs/CONTRACTS.md` only for the exact definer/ACL contract
- this order, `handoff/LEDGER.md`, `DECISIONS.log`, `handoff/questions/` if a hard
  floor fires, and the independent review record

## Required work

1. Forward migration 0011 replaces the current definitions of exactly:
   `record_occupancy(uuid,uuid,tstzrange,uuid,text,boolean)`,
   `release_occupancy(uuid,uuid)`, `expire_holds()`, `prune_outbox(interval)`,
   `assert_day_open()`, and `seal_business_day(uuid,uuid,date,uuid)`.
2. Every replacement carries exact function-level
   `SET search_path = pg_catalog, public, pg_temp`; all Yellow relations and Yellow
   function calls inside each body are explicitly `public.`-qualified. PostgreSQL
   built-ins resolve from `pg_catalog` before `public` or `pg_temp`. No attacker-owned
   temporary object may win name resolution.
3. Preserve signatures, return types, volatility/defaults, trigger attachment,
   occupancy claim arithmetic/lock order, hold expiry behavior, ordinary-posting
   day latch, seal tenant-authority check and SQLSTATEs. This is containment, not a
   semantic rewrite.
4. Revoke all execution from `PUBLIC` for all six functions after replacement.
   Grant `app_role` only the three runtime authorities already required by current
   product behavior: `record_occupancy`, `release_occupancy` and
   `seal_business_day`. `expire_holds`, `prune_outbox` and `assert_day_open` retain no
   direct app-role execution. Trigger invocation of `assert_day_open` must continue.
5. `prune_outbox` must fail closed with SQLSTATE `22023` for negative retention rather
   than turning a caller mistake into overbroad deletion. Zero and positive retention
   preserve existing published-row semantics. This validation is inside the definer;
   the existing TypeScript non-negative guard remains unchanged.
6. Document the durable rule: safe function search path and schema qualification are
   mandatory; explicit tenant parameters do not by themselves prevent definer
   injection; privileges are signature-specific and least-authority.
7. Add the focused suite to Yellow's cumulative isolated-database gate before review,
   so a non-implementing reviewer can personally execute the exploit and regression
   proof at an immutable SHA.

## Forbidden

- Editing any existing migration or `tests/run_invariants.py`
- New table/column/index/event/state transition or application endpoint
- Changing occupancy capacity/exclusion semantics, journal signs, seal behavior,
  outbox publication/retention meaning, hold transitions or tenant policy shape
- Adding FORCE RLS; changing database roles, DSNs, ownership, BYPASSRLS, `RESET ROLE`
  behavior, transaction middleware or connection pooling
- Adding caller-tenant binding beyond the already approved Order 104 seal check; that
  sibling finding requires its own occupancy/tenant order and proof
- JWT/password/secret/deployment work; UI, API, worker or feature work
- Broad grants, `SECURITY INVOKER` substitution, dynamic SQL, disabling TEMP globally,
  dropping a definer choke point, self-review, self-merge or weakened assertions

## Pre-registered proof

### P0 — hostile red on the exact parent

Against fresh migrations 0001–0010, an `app_role` transaction creates an attacker-owned
temporary `outbox` and `business_day`, attaches temporary triggers, and calls
`prune_outbox` / `seal_business_day`. The trigger writes a marker into an owner-protected
test probe while `current_user` is the deployment owner. Direct app-role insertion into
that probe is denied first. The suite must fail because both definer calls execute the
attacker path. Commit this red before migration 0011.

### P1 — hostile shadows are inert after 0011

On a fresh 0001–0011 database, the identical temporary relations/triggers remain
untouched, no protected marker is written, and each definer operates only on its exact
`public` relation. Catalog inspection requires all six signatures to be security
definers with exact `search_path=pg_catalog, public, pg_temp`; function source contains
the expected schema-qualified Yellow objects.

### P2 — least execution authority

Catalog ACLs and behavior prove `PUBLIC` executes none of the six; `app_role` can call
only record, release and seal; app direct calls to expire, prune and assert are denied
with `42501`. The day-open trigger still runs for app-role journal inserts without a
direct function grant.

### P3 — invariant behavior retained

Record/release preserves exclusive and positional occupancy truth, capacity errors and
direct-DML denial. Owner-only expiry retains current result. Owner prune deletes only
eligible published rows, preserves unpublished/recent rows, accepts zero/positive
retention and rejects negative retention with `22023`. Day-open and seal retain both
Order 104 serialization directions and exact failure SQLSTATEs.

### P4 — rollback and isolation

Every hostile or denied call leaves public occupancy, holds, outbox, business days,
journals/postings and the protected probe unchanged. Tenant B cannot observe tenant A
truth through ordinary RLS. This order makes no claim that caller-supplied tenant
arguments are bound inside the occupancy definers; that separate red remains explicit.

### P5 — standing gates and independent execution

Focused proof, migration/deployment, exact schema, cumulative database gate, standing,
typecheck, boundaries, licences/audit, protected hashes and pristine 85-table referee
pass. A non-implementing Tier-3 reviewer personally runs P0 against the exact parent,
P1–P4 against the immutable implementation SHA, and the app-never-started referee.

## Definition of done

- [x] Order and hostile proof are specified before implementation.
- [ ] P0 reproduces owner-authority execution through attacker `pg_temp` objects.
- [ ] Migration 0011 contains all six current definers with safe resolution and ACLs.
- [ ] P1–P4 pass without changing authorized domain semantics.
- [ ] Cumulative/referee/standing gates pass and protected files stay exact.
- [ ] Independent reviewer personally approves the immutable tip.

