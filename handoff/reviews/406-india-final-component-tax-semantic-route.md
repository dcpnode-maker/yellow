# Order 406 — fresh independent Tier-3 re-review after D1197

**Verdict:** CHANGES-REQUIRED-D1198

**Reviewed candidate:** `c90575b`

**Approved base:** `c9521d0`

**Reviewer:** `/root/order406_rereview`, fresh independent non-implementing Tier 3

## Blocking finding

The D1197 repair adds a real PostgreSQL suite, and that suite genuinely executes the production resolver under runtime RLS against exact Order259/367 tables and an actual approved global India extension identity. It does not, however, execute the complete hostile PostgreSQL matrix D1197 explicitly required. Its two live tests cover a valid success, foreign runtime tenant, changed valuation evidence hash and closed tax account. Superseded and forked tax roots, superseded and forked valuation roots, foreign or ambiguous roots, hostile applicability ancestry, and missing/duplicate/reordered/foreign/malformed component children remain covered only by scripted caller-authored rows or not covered at all. The live zero-write census also observes only journals, posting lines/tax detail, documents, fiscal submissions, facts, outbox and API idempotency; it does not census the persisted tax/valuation/applicability/component roots and configured route/account state around each hostile execution.

D1197 required each named hostile and effect-free claim to become executable against real isolated PostgreSQL. A two-case live smoke test is valuable but does not discharge that requirement. Extend the already-authorized integration test so the production SQL personally encounters every named current-root/current-valuation/applicability/child/route hostility and compare a complete before/after census for every rejection. Produce a new candidate and restart fresh Tier-3 review.

## Repair inspection

The production repair no longer attempts an RLS-invisible runtime join to global `extension`. It binds the exact two global India lodging extension ids, versions, statuses and approved content hashes already fixed by migrations 0069/0070, while retaining persisted applicability evidence as the selected authority. The route query now selects `semantic_kind`, allowing its existing strict decoder to validate the configured semantic group. The two D1197 EOF diff-hygiene findings are repaired.

## Reviewer-personal execution

Against exact `c90575b`, using a disposable PostgreSQL 16.15 container and databases only, I personally obtained:

- Order406 scripted plus live PostgreSQL/RLS suite: **10/10, 70 assertions**;
- adjacent Order259 live PostgreSQL suite: **10/10, 139 assertions**;
- adjacent Order367 live PostgreSQL suite: **18/18, 694 assertions**;
- standing suite: **1,318 pass, 1,012 expected database skips, 0 fail, 19,578 assertions across 433 files**;
- fresh referee: **11 passed, 0 failed of 11**;
- strict TypeScript check passed;
- import boundaries passed across **146 TypeScript files**;
- dependency licence policy passed for **23 installed packages**;
- production dependency audit reported no vulnerabilities;
- exact diff check `c9521d0..c90575b` passed;
- exact candidate diff contains only the ten authorized Order406 product, test, documentation and governance paths.

No product, test, migration, schema, stable database, local app, deployment, merge, push or credential mutation was performed. The disposable review container, databases, network and volume were removed after proof. The pre-existing untracked `.yellow/` directory was not accessed or changed.
