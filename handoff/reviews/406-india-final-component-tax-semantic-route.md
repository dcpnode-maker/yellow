# Order 406 — final fresh independent Tier-3 review after D1198

**Verdict:** CHANGES-REQUIRED-D1199

**Reviewed candidate:** `861ca17`

**Approved base:** `c9521d0`

**Reviewer:** `/root/order406_final_review`, fresh independent non-implementing Tier 3

## Blocking finding

The D1198 repair materially expands the real PostgreSQL 16.15 proof and its census now fingerprints the persisted tax, valuation, applicability, component and room-night evidence plus semantic routes, transaction-code routes/codes and accounts around every exercised rejection. That closes D1198's census blocker. The added test does not, however, execute every hostile class that D1198 explicitly required.

The live matrix executes a tax successor, a valuation successor, a foreign tax root, one changed applicability evidence hash, missing/reordered-family/foreign component children, a changed route content hash, wrong account role and the earlier changed valuation hash/closed account cases. It does not execute forked or ambiguous tax/valuation insert attempts; it only counts unique constraints. It likewise does not execute a distinct foreign valuation root, foreign applicability root or hostile applicability parent coordinates; a duplicate component insertion attempt; or live missing/duplicate/wrong-group/wrong-currency/wrong-property and extension-owner/key/version route cases. Counting catalogue constraints is useful schema evidence, but it is not the D1198-requested hostile execution and cannot prove the exact failure mode or effect-free rollback. Several omitted route cases remain scripted-only.

Extend the already-authorized integration test so each named D1198 hostility is personally attempted against PostgreSQL. Where a uniqueness constraint makes a fork/duplicate structurally impossible, assert the attempted statement's exact rejection and a complete unchanged census; for resolver-visible hostile states, execute the production resolver and assert its exact bounded failure plus the same census. Then produce a new candidate and restart a different fresh Tier-3 review.

## Reviewer-personal execution

Against exact `861ca17`, on a reviewer-owned disposable PostgreSQL 16.15 container and databases, I personally obtained:

- Order406 scripted plus live PostgreSQL/RLS suite: **11/11, 89 assertions**;
- adjacent Order259 live PostgreSQL suite: **10/10, 139 assertions**;
- adjacent Order367 live PostgreSQL suite: **18/18, 694 assertions**;
- standing suite exited green; candidate adds one database-only skipped case over D1198's **1,318 pass, 1,012 skips, 19,578 assertions** baseline;
- strict TypeScript check passed;
- import boundaries passed across **146 TypeScript files**;
- dependency licence policy passed for **23 installed packages**;
- production dependency audit reported no vulnerabilities;
- exact `git diff --check c9521d0..861ca17` passed and the diff contains only the ten authorized Order406 paths;
- a fresh disposable migration 1–70 plus seed and referee run passed **11/11**.

No product, test, migration, schema, local application, deployment, merge, push or credential mutation was authorized or performed. The pre-existing untracked `.yellow/` directory was not accessed or changed. Disposable review resources were removed after execution.

Operational note: before supplying the explicit disposable DSN, I mistakenly invoked the referee with `--help`; the script has no argument parser and used its default port 5442 DSN. It completed and committed TC-12.1 fixture activity before a Windows output-encoding exception stopped it. I did not attempt destructive cleanup or make any further connection to that endpoint. The reported 11/11 evidence is from the later explicit disposable port 55486 database only.
