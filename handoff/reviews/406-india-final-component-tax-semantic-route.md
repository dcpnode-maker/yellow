# Order 406 — fresh independent Tier-3 review

**Verdict:** CHANGES-REQUIRED-D1197

**Reviewed candidate:** `79568f1`

**Approved base:** `c9521d0`

**Reviewer:** `/root/order406_fresh_tier3`, fresh independent non-implementing Tier 3

## Blocking findings

1. The required PostgreSQL-backed proof is absent. The file named
   `india-gst-accommodation-final-component-tax-semantic-route.integration.test.ts`
   supplies a scripted `Tx` that returns caller-authored rows; it never executes the
   production SQL against Orders259/367 tables, RLS or real constraints. Therefore it
   cannot prove the order's required stale/superseded/fork/foreign/ambiguous root and
   child behavior, tenant isolation, configured-route joins, or the complete zero-write
   census across financial, fiscal, fact, outbox and idempotency state. Order406 is a
   Tier-3 tenant-scoped statutory-money routing boundary, and D1195 expressly requires
   complete current ancestry plus a complete zero-write census. Add a real isolated
   PostgreSQL suite within the already-authorized Order406 integration-test scope and
   make each required hostile and effect-free claim executable.

2. The exact required diff-hygiene gate is red. `git diff --check c9521d0..79568f1`
   exits 2 and reports a new blank line at EOF in both the production resolver at line
   360 and the intentional-red test at line 29. Remove only those two extra EOF blank
   lines.

No product correctness approval can be inferred from mock-only greens. A repaired
candidate and a fresh independent Tier-3 restart are mandatory.

## Reviewer-personal execution

I read `PROJECT.md`, ran current state, read Orders406/259/367, D1195/D1196,
roster/workflow, and the complete Yellow PostgreSQL, compliance and entity skills. I
did not implement the candidate.

Against exact `79568f1`, I personally obtained:

- focused Order406 plus adjacent Order259/367 no-database matrix: **23 pass, 16
  expected skips, 0 fail, 733 assertions**; Order406 itself is **8/0 (60)**;
- standing suite: **1,318 pass, 1,008 expected database skips, 0 fail, 19,578
  assertions across 433 files**;
- strict TypeScript check passed;
- import boundaries passed across **146 TypeScript files**;
- dependency licence policy passed for **23 installed packages**;
- production dependency audit reported no vulnerabilities;
- exact candidate scope is nine authorized files, **684 insertions and one deletion**;
- exact diff check failed as described above.

I did not run schema/referee gates because Order406 changes no migration or schema and
the approval attempt was already blocked. More importantly, the missing focused live
PostgreSQL proof cannot be substituted by a generic referee run.

No product, test, migration, schema, stable database, local app, deployment, merge,
push or credential mutation was performed. The untracked `.yellow/` directory already
present when review began was not accessed or changed.
