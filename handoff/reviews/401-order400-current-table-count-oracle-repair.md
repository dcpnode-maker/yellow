# Orders 400/401 — different fresh independent Tier-3 review

**Verdict:** CHANGES-REQUIRED-D1179

**Reviewed candidate:** `22182d6`

**Substantive candidate:** `417c84d`

**Prior withholding:** `62ece4a`

**Reviewer:** `/root/order401_different_fresh_review`, different fresh independent
non-implementing Tier 3

## Findings

Approval remains withheld. The Order401 repair itself is exactly the two admitted
stale assertions reproduced by D1176: one `116` to `119` replacement in
`tests/setup-current-catalogue-oracle.test.ts` and one in
`tests/migrate.integration.test.ts`. All production source, migration0069, schema
snapshot, setup, authority and contract/event bytes are identical to substantive
candidate `417c84d`.

The reviewer-personal complete migration regression nevertheless finishes **37 pass,
2 fail** on fresh PostgreSQL 16.15:

- `tests/migrate.integration.test.ts:1675` still expects an upgraded migration-ledger
  length of 68 and receives 69;
- `tests/migrate.integration.test.ts:2378` still expects 116 public tables and
  receives 119.

The first failure masks two deterministic follow-on stale assertions in that same
historical-upgrade case: line 1684 expects `discoveredFiles` 68 rather than 69, and
line 1706 excludes migration69 from its queried ledger while the immediately
following expected ledger already includes migration69. Repair all four remaining
frontier assertions narrowly; do not change product or migration semantics.

Order400's focused aggregate is green, but its mandatory executable proof is not yet
complete. The fresh-database section contains only catalogue, ACL/index, capability,
one successful runtime record/replay/rollback, and RLS/raw UPDATE/DELETE tests. The
366/367 bounds, calendar hostility, stale/foreign/forged selectors, gaps, duplicates,
divergent replay, concurrent race and `pg_temp` shadow cases are currently only
source-string assertions (or predecessor-pure tests), with no executable capability
challenge. Those Order400-required hostile paths must be exercised against fresh
PostgreSQL by permanent tests before approval.

## Reviewer-personal execution

I read `PROJECT.md`, current state, the Phase 7 plan, Orders400/401, D1174-D1178, the
prior review, roster/workflow, and the complete PostgreSQL/compliance skills. I did
not implement either candidate.

Using only isolated disposable resources, I personally obtained:

- official `setup.sh --db-only`: migrations 1-69, exact 119-table setup gate and
  **11 passed, 0 failed of 11** referee;
- exact catalogue **69/119/109/109/18/2** on PostgreSQL **16.15** with
  `pg_stat_statements` preloaded;
- focused Order341/400 plus repaired setup oracle: **23 pass, 0 fail, 980
  assertions**;
- canonical database acceptance: **23 pass, 0 fail, 65 assertions**;
- normalized schema dump byte-equal to `tests/schema/expected.sql` at 765,876 bytes;
- app-role non-login containment: **5 pass, 0 fail, 25 assertions**;
- runtime database authority: **10 pass, 0 fail, 88 assertions**;
- deterministic seed suite: **10 pass, 0 fail, 63 assertions**;
- complete migration regression: **37 pass, 2 fail, 162 assertions** at the two
  stale frontier assertions above;
- standing rerun: **1,302 pass, 1,002 expected skips, 0 fail, 19,427 assertions**.
  Its first run had one transient Order328 browser geometry failure; the exact test
  immediately passed alone, and the full rerun was green after disposable database
  cleanup;
- TypeScript strict check, 144-file import boundaries, 23-package licence policy,
  exact external-image pins, dependency audit with zero vulnerabilities, and exact
  `417c84d..22182d6` diff whitespace checks: green.

The disposable PostgreSQL container, temporary databases and temporary exact-head
review tree were removed. The stable `yellow-order335-app` at loopback port 3000 and
its Order311 PostgreSQL/provider/Valkey services remained healthy and untouched. I
did not read or modify the retained `.yellow` authority path.

Orders400/401 are not approved or closed, and Order367 is **not** authorized to
resume. No final-tax, local, deploy, merge, push or Phase 7 completion authority
follows.
