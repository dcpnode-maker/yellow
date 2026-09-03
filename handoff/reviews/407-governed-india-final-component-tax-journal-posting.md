# Order 407 — Fresh independent Tier-3 review

**Verdict:** CHANGES-REQUIRED-D1205

**Reviewed candidate:** `11647dd`

**Approved base:** `49e237f`

**Reviewer:** `/root/order407_fresh_tier3`, fresh independent non-implementing Tier 3

## Finding

The candidate is not yet eligible for approval because its permanent real-service
PostgreSQL proof does not execute the complete matrix required by the order. The two
service-journey tests execute 18-percent IGST, one CGST+SGST root whose SGST rounds
to zero, same-key replay, serial different-key convergence, changed actor/key reuse,
one injected second-publication rollback, sealed-day rejection, one closed tax account,
and cross-tenant binding concealment. They do not execute:

- 5- and 12-percent posting or a CGST+UTGST posting;
- multi-night posting, document-rounding residuals, or signed-int64 boundary posting;
- superseded, forked, foreign or ambiguous tax/valuation/applicability lineage through
  the posting service;
- missing, duplicate, reordered, foreign or malformed component lineage through the
  posting service;
- missing/duplicate/wrong-group/currency/property/jurisdiction-owner/key/version routes;
- folio, guest-account, route/account, tax or business-day drift both before and after
  the service's ordered locks;
- simultaneous same-root different-key contention with one durable winner; or
- direct binding INSERT and UPDATE denial (the current runtime proof attempts DELETE
  only); or
- a complete unchanged evidence/route/account/financial/fiscal/fact/outbox/idempotency
  census around every rejected or rolled-back case.

Order406 proves many resolver-only cases, but that does not prove that Order407's
posting transaction, lock/recheck boundary, journal construction and rollback remain
safe for those cases. Static source assertions and catalogue constraint counts are
supplemental, not substitutes for the order's expressly required real service journey.
Add permanent executable cases for every named class, then produce a new candidate and
restart review with a different fresh Tier-3 reviewer.

## Reviewer-personal execution

On uniquely named disposable PostgreSQL **16.15** containers and databases at explicit
loopback port `55647`, never the stable/default database, I personally obtained:

- fresh migrations **1–71** and exact catalogue **71 migrations / 123 public tables /
  113 RLS tables / 113 policies / 22 forced-RLS tables / 2 security-invoker views**;
- schema dump byte-equivalent to `tests/schema/expected.sql`;
- Order407 intentional-red plus current permanent live suite: **13 pass, 0 fail,
  57 assertions**;
- referee: **11 passed, 0 failed of 11**;
- standing: **1,324 pass, 1,023 expected skips, 0 fail, 19,610 assertions across
  435 files**;
- adjacent Order256: **6/0, 36 assertions**; Order367: **17/0, 693 assertions**;
  Order406: **10/0, 117 assertions**;
- strict TypeScript, **147-file** import-boundary, **23-package** licence and exact
  diff checks green;
- migration0071 SHA-256
  `e0c377b9d881403a2b88742c7d2e09e3723526e76cedb52a465ef57f530919c5`;
  schema snapshot SHA-256
  `ffd24dd7c12af4aaed3094e4238e211cf84c1c0eb3f5037767c997815ba8bf23`.

An Order262 adjacency rerun reached six green cases, then its 100-client race timed out
at the test's 60-second limit and its cleanup hook also timed out; it is not counted
green and is not the basis of this finding. The first parallel adjacency attempt was
also excluded after PostgreSQL's default 100-connection ceiling starved sibling suites.
A clean sequential rerun on a 300-connection disposable PostgreSQL instance produced
the reported Order256/367/406 results. The first referee attempt completed TC12.1 but
its Windows console rejected the Unicode arrow; that database was discarded, and the
reported 11/11 result is from a fresh database with UTF-8 output.

Fresh `bun audit --production` stalled after its header and was stopped without being
counted green. The production dependency graph is unchanged from the independently
audited Order406 base; a fresh OSV batch query of the six locked production packages
returned **0 advisories**.

No product, migration, schema, test, local application, deployment, merge, push or
credential change was made. The pre-existing untracked `.yellow/` directory was not
accessed or changed. Disposable review resources were removed after recording the
result.

## D-1205 different-fresh rereview of repaired candidate

**Reviewed candidate:** `de12c1a`

**Reviewer:** `/root/order407_d1204_fresh_tier3`, different fresh independent
non-implementing Tier 3

The D-1204 repair executes the previously absent 5/12/18-percent,
CGST+UTGST, multi-night residual, signed-int64, 12-way simultaneous convergence,
direct binding mutation-denial, complete hostile lineage/child/route classes,
structural duplicate/fork, and post-resolve ordered-lock drift cases. Those cases
pass against real PostgreSQL and their shared `rejectUnchanged` helper performs the
complete source/route/account/financial/fiscal/fact/outbox/idempotency census.

Approval remains withheld because the final permanent rollback/rejection case does
not apply that complete census to every case as D-1203 expressly required:

- the injected failure after the second real outbox publication checks only
  `journal`, binding and idempotency counts; it does not prove unchanged posting
  lines, facts, outbox, documents, fiscal submissions, source roots, routes,
  accounts, folios or business-day truth;
- the final sealed-day rejection and closed-tax-account route rejection assert only
  that the call throws and perform no after-census at all.

The hostile matrix separately covers a pre-call sealed day and closed tax account
with a complete census, but that cannot substitute for the uniquely injected
mid-transaction publication rollback. Amend the permanent test so the publication
failure uses the complete before/after census, and either remove the redundant final
sealed/route cases or give each its complete expected-mutation/effect census. Then
produce a new candidate and restart review with another different fresh Tier-3
reviewer. No product-source change is requested.

### Reviewer-personal execution on `de12c1a`

On named disposable PostgreSQL **16.15** at loopback port `55671`, never the
stable/default database, I personally obtained:

- fresh migrations **1–71**, exact catalogue **71 / 123 tables / 113 RLS tables /
  113 policies / 22 forced-RLS tables / 2 security-invoker views**, and schema dump
  byte-equivalent to `tests/schema/expected.sql`;
- repaired Order407: **18 pass, 0 fail, 147 assertions** across the intentional-red,
  structural, real-service, hostility, contention, lock-drift and rollback suite;
- referee: **11 passed, 0 failed of 11**;
- adjacent Order256 **6/0 (36)**, Order262 **12/0 (75)** on a fresh 300-connection
  database, Order367 **17/0 (693)** at its exact migration-70 frontier, and Order406
  **10/0 (117)**;
- standing **1,324 pass, 1,028 expected skips, 0 fail, 19,610 assertions across
  435 files**; strict TypeScript, **147-file** import boundaries, **23-package**
  licence policy and exact diff checks green;
- migration0071 SHA-256
  `e0c377b9d881403a2b88742c7d2e09e3723526e76cedb52a465ef57f530919c5`;
  schema snapshot SHA-256
  `ffd24dd7c12af4aaed3094e4238e211cf84c1c0eb3f5037767c997815ba8bf23`.

The first Order262 attempt used PostgreSQL's default 100-connection ceiling and its
100-client race timed out; it was excluded. After increasing only the disposable
review container to 300 connections, the fresh isolated rerun produced the reported
12/0. `bun audit --production` again stalled after its header and is not counted;
the dependency graph is unchanged from approved base `49e237f`, and a fresh OSV
batch query of the six locked production packages returned **0 advisories**.

No product, migration, schema, permanent test, local app, deployment, merge, push or
credential change was made. The pre-existing `.yellow/` directory was not accessed
or changed. Disposable resources were removed after recording the review.
