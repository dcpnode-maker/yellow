# Order 151 — Bound financial account/folio row locking

**Status:** READY — D-418
**Phase:** 5 · Cyber remediation
**Branch:** `phase-5/financial-row-lock-capability`
**Base:** `aff09155d68ad3f69cd0a119e24b79e7f876fc56` — immutable Order-150 positive-catalogue checkpoint
**Risk tier:** 3 — financial row locks, SECURITY DEFINER authority and forward migration
**Owner:** Codex implementation; a non-implementing Tier-3 reviewer must personally execute P0–P4
**Dependency:** Order 150 cannot finish until this exact capability is independently approved and stacked

## Outcome

Replace the otherwise-unused account/folio UPDATE authority required by PostgreSQL
`FOR UPDATE`/`FOR SHARE` syntax with one bounded, non-mutating owner-mediated lock
capability. Preserve FolioService and ChargeService behavior, serialization and
financial validation without granting direct account or folio mutation.

## Scope

- `migrations/0017_financial_row_lock_capability.sql`;
- `src/contexts/financials/folios.ts`;
- `src/contexts/financials/postings.ts`;
- `tests/financial-row-lock-authority.integration.test.ts`;
- `tests/financial-folios.integration.test.ts`;
- `tests/financial-postings.integration.test.ts`;
- `tests/runtime-dml-authority.integration.test.ts`;
- `tests/security-definer-containment.integration.test.ts`;
- `tests/migrate.integration.test.ts`;
- `tests/database-acceptance.integration.test.ts`;
- `tests/schema/expected.sql`, mechanically regenerated only;
- `scripts/run-phase-3-gate.ts` and `tests/phase-3-gate-runner.test.ts`, only for one
  unique Order-151 focused-suite mapping;
- `docs/SECURITY.md` and `docs/CONTRACTS.md`, only for this exact capability;
- this order, D-418/Q162, additive ledger and one independent review.

No table/column, role/principal, RLS policy, state, event, dependency, setup/Compose,
protected referee, finance economics, numbering rule, posting sign, tax or payment
behavior is in scope. Existing migrations remain immutable.

## Required implementation

1. Migration 0017 creates exactly
   `public.lock_financial_rows(uuid,uuid[],uuid) RETURNS void`: one tenant, one or two
   distinct non-null account IDs and one optional folio ID. It locks accounts in UUID
   order, then the optional folio only when it belongs to one requested account.
2. The function is `VOLATILE`, `SECURITY DEFINER`, owned by `yellow_owner`, uses exact
   `search_path = pg_catalog, public, pg_temp`, fully qualifies relations/functions,
   returns no data and performs no write. Missing/foreign/mismatched targets share one
   non-enumerating error. Invalid cardinality/null/duplicate input fails before locks.
3. Revoke all execution from PUBLIC, app_role and yellow_runtime, then grant only to
   app_role. Direct yellow_runtime invocation stays denied; the real runtime path uses
   transaction-local tenant plus `SET LOCAL ROLE app_role`.
4. FolioService retains reservation/advisory/series locks. It performs SELECT-only
   discovery, invokes the capability for an existing account plus optional existing
   primary folio, then exactly re-reads/revalidates before returning or inserting.
5. ChargeService retains property/day locking and all business checks. It discovers
   guest/revenue accounts and folio, invokes the capability once, then exactly
   re-reads/revalidates financial ownership and route state before posting.
6. Migration 0016's positive catalogue remains exact: account/folio direct UPDATE is
   absent, and no other direct mutation expands.

## Pre-registered proof

### P0 — exact v16 red

On fresh exact `aff0915` executable state, personally reproduce financial-folios and
financial-postings SQLSTATE `42501` on account/folio row locking. Prove direct UPDATE
is absent and roll back/remove all proof artifacts.

### P1 — capability authority

Prove exact signature, owner, definer flag, search path and ACL; PUBLIC and direct
yellow_runtime are denied; app_role-after-runtime-transition alone executes. Prove
zero direct account/folio UPDATE and direct row locks still fail `42501`.

### P2 — validation and lock reality

Prove missing/wrong tenant or role, zero/>2/null/duplicate accounts, missing accounts,
missing folio and folio/account mismatch fail atomically without existence leakage.
While the capability transaction is open, deploy `NOWAIT` must return `55P03` for
exact target rows while unrelated rows remain lockable. Commit/rollback releases all
locks; byte snapshots, facts and outbox remain unchanged; pg_temp shadows cannot
intercept any object.

### P3 — legitimate financial flows

Run complete financial-folios and financial-postings proofs including twenty-way
folio convergence, number reuse after rollback, 500 charges/1,000 immutable lines,
charge-first/seal-first races, hostile tenant/property/account/folio inputs and exact
errors. Add opposite-input-order two-account concurrency proving canonical lock order
and no deadlock.

### P4 — cumulative

Run the focused proof, Order-150 catalogue, security-definer containment, migrations,
acceptance, exact live schema, unique cumulative matrix mapping, all affected finance
suites, standing/static/security gates and a separate fresh referee exactly 11/11.
Independent Tier-3 review must execute P0–P4 on the immutable candidate.

## Forbidden

- Direct or column-specific account/folio UPDATE; generic or unbounded lock APIs.
- Returning owner-read business data or duplicating business policy in the function.
- Changing financial state/economics/errors, event/fact semantics or lock budgets.
- Editing any existing migration or `tests/run_invariants.py`.
- Weakening a failed proof, self-review, self-merge, deployment or closure claim.

## Definition of done

- [ ] Exact v16 financial lock red reproduced.
- [ ] One bounded non-mutating capability replaces direct UPDATE need.
- [ ] Full financial behavior/concurrency and hostile authority proofs pass.
- [ ] Cumulative gates and fresh referee pass.
- [ ] Independent Tier-3 reviewer approves the immutable executable.

