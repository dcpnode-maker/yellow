# Independent review — Order 113 SECURITY DEFINER containment

**Result:** APPROVED

**Reviewed executable tip:** `2c11ce9a0bb455ddd0a7dcb4bfe3a342c5179e43`

**Metadata head inspected:** `7eb2887931e88984b232aca2049ded5aad611299`

**Direct parent used for red:** `3d27a9c0dd73bd48542edc0146ca916250f3e3fa`

**Approved base lineage:** `52f8b0c61db23d0faf3f232527881083bf8040e2`

**Reviewer:** independent non-implementing Codex Tier-3 reviewer

**Date:** 2026-08-24

The reviewer did not implement or modify product code, approve a merge, or touch the
founder stack or builder worktrees. Review used clean branch
`codex/review-order-113-security-definer-containment`, a detached parent worktree, and
three uniquely named Compose projects on loopback ports 55133–55135/56133–56135.

The exact executable tip is the direct child of the pre-registered red commit. Its
eleven-file delta is entirely inside Order 113's scope: one forward migration, the
focused and inherited evidence surfaces, exact-schema/documentation updates, and
order/decision accounting. It changes no existing migration, protected referee,
application TypeScript, role/DSN/transaction middleware, occupancy policy, RLS
policy, journal sign, secret policy, endpoint, event, table, column, index, or state
transition. The metadata head adds only the `BUILT-UNREVIEWED` ledger row.

## Parent red — exploit reproduced, not inferred

On isolated PostgreSQL 16.15 project `yellow-review-113-red` at the exact parent,
fresh migrations 0001–0010 were applied to `yellow_order113_red`. The reviewer then
personally executed the pre-registered hostile proof.

- `SET LOCAL ROLE app_role` direct insertion into the protected owner probe returned
  SQLSTATE `42501`.
- The same session created attacker-owned `pg_temp.outbox` and
  `pg_temp.business_day` relations with hostile triggers.
- Invoking the old `prune_outbox` and `seal_business_day` reached both temporary
  triggers as `current_user = yellow`; the expected-secure assertion failed exactly
  with markers `business_day/yellow` and `outbox/yellow`.
- Result: **0 passed, 1 failed**, as required. The fixture transaction rolled back.

This is arbitrary deployment-owner execution through temporary relation shadowing,
not merely a suspicious source pattern.

## Fixed-tip P1–P4 — personally executed

Fresh migrations 0001–0011 were applied at the exact executable tip to isolated
database `yellow_order113_green` in project `yellow-review-113-green`.

| Proof | Reviewer result |
|---|---|
| Identical hostile temporary shadows | inert; no protected marker, shadow outbox remained one row, shadow day remained unsealed |
| Focused Order 113 suite | **3 passed, 0 failed, 21 assertions** |
| Exact function catalogue | six rows, all `SECURITY DEFINER`, owner `yellow`, exact `search_path=pg_catalog, public, pg_temp` |
| ACLs | `PUBLIC` executes zero; `app_role` executes only record/release/seal |
| App denials | direct prune, legacy expiry and day-open calls each returned verbose SQLSTATE `42501` |
| Owner prune | negative retention returned `22023`; positive removed only eligible published rows |
| Zero retention | accepted; removed a strictly older published row and preserved the unpublished row |
| Occupancy | focused exclusive record/release passed; referee independently passed exclusive, positional capacity and direct-DML proofs |
| Legacy owner expiry | expired a due hold and removed its exact occupancy claim; rollback-only fixture |
| Day latch/seal/RLS | inherited financial suite passed both seal directions, sealed-day rejection and cross-tenant isolation |
| Cumulative database gate | **15/15 isolated suites passed** |

The live PG16 catalogue ACLs were exactly:

- `assert_day_open()`, `expire_holds()`, `prune_outbox(interval)` — owner execute only;
- `record_occupancy(...)`, `release_occupancy(...)`,
  `seal_business_day(...)` — owner plus `app_role` execute;
- all six — no `PUBLIC` execute.

Migration `0011_security_definer_containment.sql` has SHA-256
`6c9af4f72fa6be5a2c0e256624620c7ee8cf61d709c3ca99a37cd126bbe57796`.
It replaces exactly the six current signatures. Every Yellow relation/helper is
`public.`-qualified and relevant built-ins are `pg_catalog.`-qualified. Record/release
claim arithmetic and advisory-lock order are unchanged. Legacy expiry still calls the
same release choke point. Day-open and seal retain Order 104's exact tenant/date locks,
authority checks and SQLSTATEs. Prune's only intended semantic addition is the
fail-closed `22023` check for negative retention; zero and positive behavior are
preserved. Function defaults, trigger attachment and volatility remain exact.

## Fresh referee and quality evidence

The reviewer ran `setup.ps1 -DbOnly` from the exact executable tip in fresh project
`yellow-review-113-referee` on PostgreSQL 55135 and Valkey 56135. Compose contained
only PostgreSQL and Valkey; `docker compose ps -q app` returned zero containers.
Fresh migrations 0001–0011 produced the exact **85-table** deployment and the immutable
referee reported **11 passed, 0 failed of 11**.

Additional personal execution:

- standing suite — **138 passed, 0 failed, 1,738 assertions** (384 database-gated
  tests correctly skipped without their explicit environments);
- typecheck — passed;
- import boundaries — 62 TypeScript files, passed;
- normalized schema drift — exact;
- dependency licence policy — 23 packages, passed;
- `git diff --check` — clean.

The migration integration suite personally passed its Order-113 checksum/catalogue
case and seven other cases. The unrelated inherited Windows symlink
fixture then returned host `EPERM`; this partial suite is not claimed green. Hosted
PR #76 run `32699682414`, database job `97348554929`, independently passed the complete
migration/deployment/health/referee and 15-suite gate, but the approval above does not
substitute hosted output for the reviewer-executed Order 113 proofs.

Protected SHA-256 values remain exact:

- `migrations/0001_init.sql` —
  `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`;
- `tests/run_invariants.py` —
  `3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1`.

## Callsite and residual-risk boundary

The six-function sweep preserves current reachability:

- record/release occupancy are called only from inventory hold, operational-block and
  reservation-occupancy services using their transaction `Tx`; current callsites pass
  a tenant from RLS-read rows or the authenticated envelope;
- prune is called by deployment-owner `PostgresEventBus.prunePublished`;
- legacy `expire_holds` has no production TypeScript caller; the audited hold-expiry
  worker remains the application path;
- `assert_day_open` remains trigger-only and works without a direct app grant;
- seal has no current production TypeScript caller but retains its established app
  authority and transaction-local tenant check.

Approval is **exclusive to temporary-schema name-resolution containment, the exact
signature ACLs, and negative-prune validation**. The following counterevidence was
personally inspected and remains separate release-blocking work, exactly as Order 113
and D-334/D-336 say:

1. In the local Compose deployment, `yellow` is superuser, `BYPASSRLS`, and owner of
   the inspected tenant tables; those tables have RLS enabled but not FORCE RLS.
   `app_role` is neither superuser nor BYPASSRLS. Production-role ownership and FORCE
   RLS therefore still require an explicit deployment proof/order.
2. The app's default local DSN connects as `yellow`. `Database.withTenantTransaction`
   correctly sets `app.tenant_id` and then `SET LOCAL ROLE app_role`, but event and
   platform pools use the same owner DSN. `runHandlerAsTenant` resets from app role
   to the owner after an internal handler, and prune deliberately operates as owner.
   No externally reachable owner-SQL injection was found in this review; the blast
   radius of a missed role transition nevertheless remains and is not discharged.
3. Record/release occupancy still trust their explicit tenant arguments internally;
   the current TypeScript callsites constrain them, but the choke point itself does
   not bind `p_tenant` to transaction authority. This is defence-in-depth today and a
   separate high-risk tenant/occupancy order, not part of migration 0011.
4. The known local token-secret default and absence of an entropy/default refusal are
   unchanged and unapproved for deployment.

A safe next correction must be a new forward migration/order with a hostile red and
independent Tier-3 execution. It may bind occupancy tenant authority or redesign
runtime ownership/FORCE RLS, but must not edit `0001_init.sql`, change occupancy
capacity/exclusion behavior, combine token-secret work with database-role work, or
describe those sibling controls as already solved by Order 113.

No Order 113 implementation or scope defect remains.

## Exclusive Order 113 discharge

- 113
