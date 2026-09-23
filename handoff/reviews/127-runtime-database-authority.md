# Order 127 — independent Tier-3 review

**Conclusion:** APPROVED
**Reviewer:** Codex, independent non-implementing Tier-3 reviewer
**Executable:** `833376bd61570b098855825fa991697fb3242218`
**Base:** `8daf34e1f1328e866b0b52ff750631e7d651d0b7`
**Date:** 2026-08-25

I did not implement Order 127. I reviewed only the immutable executable above, used
exclusive disposable Compose projects, personally executed every result below, and
found no product, test, migration, authority, tenancy or proof defect.

## Scope and static inspection

- `git rev-parse HEAD`, `git status --short`, and
  `git diff --check 8daf34e1f1328e866b0b52ff750631e7d651d0b7..HEAD` proved the exact clean
  executable and D-406 EOF hygiene.
- The approved-Base diff is confined to Order 127's declared product, migration,
  tooling, test, documentation and governance paths. Migrations 0001–0014,
  `tests/run_invariants.py`, and `tests/seed_fixture.sql` are byte-unchanged.
- Migration 0014 SHA-256 is the pinned
  `706806ad3c041d506df1e90f75b19ed219baa3fedb8968471828657ab6c7493a`.
  Migration 0015 SHA-256 is
  `cd201b7e0bc9a2fb538b32f69adb0900d7b2149f9cc82fd5e9a02056a573166a`,
  matching the acceptance oracle.
- I inspected the final role/ownership/ACL assertions and bounded SECURITY DEFINER
  capabilities in migration 0015; max-one transaction settlement/discard/fail-close
  in `src/kernel/db.ts`; ordered/unpublished cursor, dedupe, tenant transition,
  scrub, settlement and irreversible pool failure in `src/kernel/outbox.ts`; the
  app's unprepared runtime pools; due-hold UUID scope discovery; and extension
  registration/read capabilities. No direct runtime table authority or reusable
  contaminated backend path was found.

## Reviewer-executed proof

Fresh candidate project `yellow-o127-r833376b` used private ports and volumes.
`./setup.sh --db-only` applied migrations 0001–0015 to fresh dev/test databases and
the protected referee returned exactly `11 passed, 0 failed of 11` while the app was
not started.

- D-405/Q156: live `bun run schema:check` passed. Two independent
  `bun scripts/schema-drift.ts --print` captures were byte-identical; both SHA-256
  values were `e0470b0abe2b2a721923978957f056bce1b5c7d542bd67541aecf49febf41989`.
- P0, in a second fresh exact-Base project: a valid tenant transaction began as
  `session_user=yellow,current_user=app_role`; after `RESET ROLE`, the parent became
  `yellow` with `rolsuper=true`, `rolbypassrls=true`, database CREATE and visibility
  of the tenant-B sentinel. Schema CREATE succeeded inside the probe transaction and
  rollback left `schema_persisted=false`.
- Runtime authority: 9/9, 63 assertions. This covered exact role tuples, sole
  membership, ownership, RESET ROLE containment, seed-independent visibility,
  settlement/discard, bounded capabilities, provisioning and atomic incompatible
  owner retry.
- Relay/D-403: 19/19, 130 assertions. Both ordered and unpublished role, wrong-tenant,
  same-value GUC, DEALLOCATE and terminal settlement cases passed. P6 drained 10,000
  rows in 20.055 seconds with the unchanged bound.
- Isolated outbox: 7/7, 24 assertions. Hold worker: 6/6, 30 assertions, including
  two-tenant real due-scope discovery. Extension: 6/6, 25 assertions, including
  app-role atomic registration and global/tenant visibility. Order-129/D-404: 7/7,
  45 assertions.
- Fresh v15 acceptance: 6/6, 13 assertions; normalized schema remained exact after
  recreation. Auth/token: 12/12, 37 assertions. Tenant context: 6/6, 18 assertions.
  Seed: 10/10, 62 assertions. Order-126 focused occupancy: 7/7, 8 assertions.
- `bun run test:phase3-gate`: 20/20 isolated suites, including financial posting,
  SECURITY DEFINER, Orders 118/124/129 and runtime authority.
- Native Windows migration proof: 19/20 and 110 assertions; the sole stop was host
  `EPERM` while creating the symlink at `tests/migrate.integration.test.ts:1064`,
  before the product assertion. Full WSL/Linux execution of the identical suite then
  passed 20/20 with 112 assertions, including the invalid-file fail-closed proof.
- Standing `bun test`: 178 pass, 452 intentional database skips, 0 fail, 2049
  assertions across 94 files. Typecheck passed. Boundaries passed for 64 files.
  JWT runtime-secret proof passed 5/5; image pins 4/4; frozen license policy passed
  for 23 packages; `bun audit --audit-level=high` found no vulnerabilities.
- Actual container environment names only were inspected: the healthy app had the
  runtime URL and no deploy URL; an actual migrate tool container had the deploy URL
  and no runtime URL. `GET /health` returned `status=ok`. No value was printed.

## Findings and limits

No approval-blocking finding remains. The Windows symlink `EPERM` is a reproduced
host privilege limitation, not green evidence; the required identical Linux suite is
the executable invalid-file proof. Approval is limited to Order 127 and the single
runtime-bootstrap-superuser occurrence. It does not close the order's enumerated
residual runtime-DML, arbitrary trusted-application SQL, credential compromise,
global-event payload, deploy credential, external-principal, sibling Cyber, finance,
merge, deployment or production risks.
