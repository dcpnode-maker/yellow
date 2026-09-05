# Order 432 — PR80 CI portability repair

**Status:** COMPLETE — exact development CI and database referee passed — D1338
**Phase:** Delivery infrastructure
**Branch:** `phase-7/persisted-india-final-component-tax-evidence`
**Risk tier:** 1 — test harness and CI portability only
**Owner:** Codex

## Outcome

Make PR80's existing executable proof portable on GitHub's Linux runner without
skipping, weakening or reclassifying any product assertion. The current diagnostic
attributes all 46 quality failures to runner portability: stale child-process Bun
path, browser launch assumptions and shallow Git history.

## Scope

- `.github/workflows/ci.yml`
- the four failing Order424/425/426/429 hostile or mutation test files identified by
  the PR80 quality log;
- the six failing browser proof files for Orders195/328/330/386/389/395;
- `tests/project-mcp-config.test.ts` and
  `tests/referee-typed-parent-fixtures.integration.test.ts` only to make their exact
  preregistered historical blob/path resolution portable under a full Linux clone;
- `tests/rate-quote.integration.test.ts` only to derive its aged stay fixture from a
  bounded future offset, make the seeded tax-jurisdiction effective period deterministic,
  and bind effective-period reads to the already-provisioned runtime role;
- `tests/operator-rate-builder.integration.test.ts` only to derive its aged quote
  fixture from the same bounded future-date pattern and bind jurisdiction resolution
  to the already-provisioned runtime role;
- `tests/founder-status.integration.test.ts` only to make its response-privacy oracle
  distinguish credential keys and secret-bearing values from legitimate recorded
  project-status prose while retaining exact credential, database URL and internal-path
  leak detection;
- `tests/operator-inventory.integration.test.ts` only to keep the original Order048
  launch inventory proof exact within the additive shared review seed and bind the
  login-scope assertion to the current authorized review-permission source;
- `tests/operator-rate-pricing.integration.test.ts` only to bind its login-scope
  assertion to that same current authorized review-permission source;
- `tests/financial-postings.integration.test.ts` only to align its exact table-count
  assertion with the current 125-table migration catalogue (including schema_migration);
- `tests/app-role-nonlogin.integration.test.ts` and
  `tests/runtime-database-authority.integration.test.ts` only to align exact whole-schema
  table/RLS/policy/FORCE-RLS counts with the current migration catalogue, preserving
  all role, grant, session, function and tenant-boundary assertions;
- `tests/migrate.integration.test.ts` only to add the existing 0074 migration to its
  exact ordered catalogue and align current full-schema table/policy counts; preserve
  historical partial-migration counts, checksums, rollback and migration behavior.
  Its supplier-registration current constraint count also includes the existing
  0074 tenant/property/id composite unique constraint, with its identity verified;
- `tests/database-acceptance.integration.test.ts` only to include existing migration
  0074 and its verified immutable checksum, and align current migration/table/RLS/
  policy/FORCE-RLS/permission catalogue counts; preserve all schema, grants and runtime checks.
  Its supplier-registration total constraint count also includes the existing 0074
  tenant/property/id unique constraint; keep its original 18-name required subset exact;
- one existing/new test-only executable/browser helper if needed;
- focused tests for the helper/launcher behavior;
- this order, `DECISIONS.log`, and `handoff/LEDGER.md`.

## Requirements

1. CI fetches complete history required by historical-parent proofs.
2. Child-process proofs resolve the active Bun executable portably and never embed a
   stale setup-bun installation path.
3. Browser proofs locate Chrome/Chromium cross-platform and launch Linux CI with
   robust sandbox/shared-memory flags while still executing every UI assertion.
4. No test is skipped, deleted, softened, renamed to evade discovery or changed to
   accept generic errors.
5. Re-run the complete quality job; then run the container/database jobs when the
   quality gate is green.
6. The Phase-3 quote proof retains exact date relationships and tax-resolution
   assertions; only its disposable database fixture may use one bounded clock-relative
   future stay and normalize the launch extension's
   insertion-time default effective bound, and jurisdiction resolution must exercise
   the runtime-only effective-period capability through the runtime role.
7. The operator rate-builder proof retains its exact four-eyes, publication, quote,
   tax-truth and undo assertions while using a bounded clock-relative future stay and
   the runtime-only effective-period capability through the runtime role. Its
   tax-inclusive USD plan uses the existing tax-inclusive launch jurisdiction rather
   than an incompatible tax-exclusive fixture.
8. The founder-status proof rejects password, secret, token and database-URL keys;
   known runtime credential values; credential-shaped string values; Postgres URLs;
   and local, Git and handoff paths without treating domain prose such as
   `token-only payment foundation` as a credential leak.
9. The operator-inventory proof requires each original Order048 launch unit type,
   room and sellable exactly once without forbidding additive approved review fixtures.
   Its login assertion exactly matches every valid scope in `REVIEW_PERMISSIONS`,
   rejects duplicate scopes and explicitly excludes approver-only authority.

## Latest verification — 2026-09-05

Fourteenth CI on `8bd24d2` passed quality, Windows-state and container smoke but
failed the app-role catalogue's stale 124/114/114 expectation. Current schema has
exactly 125 tables, 115 RLS-enabled tables, 24 FORCE-RLS tables and 115 policies.
The runtime-authority suite's later 123/113/22/113 expectation was also stale;
both are updated together. Role, grant, function, session and tenant assertions
are unchanged. Root reran focused tests: 3 passed, 14 expected database skips,
0 failed, 24 assertions; typecheck and diff check passed. GitHub database proof
remains pending; no runtime/database success is inferred from skipped cases.

Fifteenth run `33931957315` on `5695e61` passed quality, Windows-state and container
smoke, then failed seven stale assertions in the migration suite. The complete
current-frontier audit also found the next acceptance suite still omitted 0074.
Both now require exactly 74 migrations, 125 tables, 115 RLS tables/policies, 24
forced-RLS tables and 11 permission definitions (0074 adds two, with no role grants).
Historical partial-migration frontiers are unchanged. All 74 filenames and prior
1–73 hashes were verified; 0074 SHA256 is
`58cb493c86aeb13a697f6e882656a49b5b7617d185c5cf0746de8bf2eaa4c43c`.
Root native-Windows focused run: 2 passed, 65 unavailable-DB skips, 0 failed,
9 assertions; typecheck and diff check pass. Seed and remaining Phase-3 current
catalogue checks were audited without additional findings. Full GitHub DB proof
remains required; neither skipped cases nor catalogue repair approve native issuance.

Sixteenth run `33933162737` on `591ace8` again passed quality, Windows-state and
container smoke. Its migration suite exposed the supplier-registration constraint
count still expecting 18 rather than 19. The additional constraint is the existing
0074 `property_fiscal_registration_tenant_property_id_uq` on tenant/property/id;
the assertion now includes it without modifying schema or any substantive role,
lineage or mutation check. Root reran native Windows focused tests: 2 passed,
65 unavailable-DB skips, 0 failed, 9 assertions; typecheck passed. Full database
verification remains pending on the exact newly published commit.

Seventeenth run `33935495750` on `dc407e2` stopped in quality at the historical AI
heading assertion; Order435 restored that quoted historical label without changing
the assertion. Eighteenth run `33935898217` on `61dbeea` passed quality, Windows-state
and container smoke, and progressed through migration proof. Deployment acceptance
then exposed the sibling supplier constraint count, still 18 rather than 19.
The earlier catalogue audit had missed this second assertion. It now includes
0074's existing `property_fiscal_registration_tenant_property_id_uq` without changing
schema or its original 18 required named constraints. Root inspected the exact
one-line diff and ran the acceptance suite: 25 explicit unavailable-DB skips,
0 failed; no local database success is claimed. Typecheck and diff checks pass.
Full GitHub database proof is still required. PR81's separately green main-only
CI does not establish PR80's database result or approve native issuance.

## Verified publication receipt — 2026-09-05

After Order437 reconciled the independently updated main ancestry, development
commit `cb4d5d9fa544d63083bf47e2ab31bb2a94c94a1e` completed
[GitHub run 33937609924](https://github.com/dcpnode-maker/yellow/actions/runs/33937609924)
successfully. Root personally checked the exact head and all four successful jobs:
quality, windows-state, container-smoke and database. The database job's canonical
referee log reports **11 passed, 0 failed of 11**. PR80 is OPEN and MERGEABLE/CLEAN.
This closes the CI-portability repair at that revision, not PR80 product approval,
Order430/434, any phase, or a local application refresh. Later commits require their
own CI; this receipt must not be reused as their result.

## Excluded operations (unchanged)

No production behavior, Phase7 fiscal implementation, schema, database policy,
runtime/local, `.yellow`, dependency upgrade, merge, force push or historical-proof
rewrite.
