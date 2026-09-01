# Order 343 — Migration-0059 permanent gate repair

**Status:** READY-D969
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/migration-0059-permanent-gate-repair`
**Base:** `72aadad` (Order342 independent WITHHOLD review)
**Risk tier:** 3 — permanent migration and runtime-authority proof
**Owner:** Codex implementation; different fresh non-implementing Tier-3 reviewer

## Outcome

Repair only the three stale permanent catalogue oracles identified by Order342 so
they describe the already-applied migration 0059 and its already-governed thirteenth
runtime capability exactly. Add no product, schema, migration or authority behavior.

## Natural-solution boundary

Fresh review proved migration 0059 and
`runtime_visible_extension_effective_period(uuid,uuid)` are already correct and
live: 59 migrations, 110 public tables, 100 RLS tables/policies, thirteen runtime
functions, owner `yellow_owner`, execution denied to PUBLIC and `app_role`, execution
granted only to `yellow_runtime`, and pinned search path. The natural repair updates
the exact filename/checksum/count ledger and exact capability/ACL expectations in the
existing permanent gates. It must not weaken exactness, replace equality with a lower
bound, skip a gate, or change production truth to satisfy a stale test.

## Exact scope

- `tests/migrate.integration.test.ts`;
- `tests/database-acceptance.integration.test.ts`;
- `tests/runtime-dml-authority.integration.test.ts`;
- this order;
- `handoff/reviews/343-migration-0059-permanent-gate-repair.md`;
- approval/status-only entries in `BUILD-PLAN.md`, `handoff/PHASE-6-PLAN.md`,
  `handoff/ROADMAP.md`, `DECISIONS.log` and `handoff/LEDGER.md`.

## Required implementation

1. Preserve the exact Order342 red results before repair: migrate `38/1`, database
   acceptance `22/1`, runtime authority `8/2`.
2. Extend the historical-upgrade expected applied-file list through exact
   `0059_tax_extension_effective_period.sql`.
3. Add migration 0059's exact version, filename and repository-derived SHA-256 to the
   acceptance ledger and change only the exact migration count from 58 to 59.
4. Add exact signature
   `runtime_visible_extension_effective_period(uuid,uuid)` to both runtime capability
   inventories and change only their exact runtime-function count from twelve to
   thirteen. Preserve owner, SECURITY DEFINER/search-path and PUBLIC/app/runtime ACL
   assertions.
5. Run the three corrected gates on fresh PostgreSQL plus focused migration-0059
   proof, standing/static gates, exact schema and referee 11/11.

## Forbidden

- any migration, production source, API, UI, permission, seed, schema snapshot,
  dependency, environment, credential, Docker composition or local-runtime change;
- deleting, skipping, loosening or converting an exact catalogue assertion to
  contains/at-least behavior;
- changing expected table, RLS, policy or FORCE-RLS counts;
- changing migration 0059 or granting capability execution to PUBLIC or `app_role`;
- `.yellow`, port 3000, stable Order335, merge, push or deployment;
- self-review or Phase-6-complete/application-complete claims.

## Definition of done

- [ ] Intentional red provenance is retained and the diff is limited to the exact
      three permanent test files plus governance.
- [ ] Corrected migration, acceptance and runtime-authority gates are green on fresh
      PostgreSQL without weakening an assertion.
- [ ] Migration-0059 focused proof, standing/static/schema and referee 11/11 pass.
- [ ] A different fresh non-implementing Tier-3 reviewer personally executes the
      repair proof and then reruns the complete Order342 exit gate.
