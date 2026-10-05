# Order 408 — Fresh independent Tier-3 review

**Verdict:** APPROVED-CLOSED-D1215 (supersedes the historical D1213 finding below)

**Reviewed candidate:** `bec262e`

**Approved base:** `907ef6d`

## Different fresh Tier-3 rereview — D1215

**Reviewer:** `/root/order409_different_tier3`, different fresh independent
non-implementing Tier 3

**Verdict:** APPROVED. Order409 contains exactly the admitted two informational
schema-header replacements plus governance; no schema body, product, migration,
test, authority or runtime byte changed. D1213 is fully discharged.

### Reviewer-personal execution

I created a new isolated data directory and databases using the exact official
upstream PostgreSQL 16.15 binaries at
`E:\yellow\toolchains\postgresql-16.15\pgsql\bin`, SCRAM authentication and
`pg_stat_statements` preload. The E: drive had insufficient room for a fresh data
directory, so only this review's new data lived under its unique D: proof path; the
accepted binaries remained the exact E: toolchain. Personal results:

- fresh migrations 1–72 and catalogue **72 migrations / 124 public tables / 114
  RLS tables / 114 policies / 23 forced-RLS tables / 2 views**;
- canonical seed and database acceptance **23/0 (65 expectations)**, including
  exact 16.15, preload, authority and canonical-only tenant/property truth;
- raw upstream `pg_dump` normalized against the committed snapshot is byte-exact
  (**887,413 bytes**), proving the two-line Order409 repair;
- Order408 intentional-red plus complete live matrix **10/0 (106 expectations)**;
- compatible fresh databases prove Order266 at its approved migration46 repair
  frontier **8/0 (68)**, Order367 at migration70 **18/0 (694)**, Order406 at the
  current frontier **11/0 (122)** and Order407 **18/0 (150)**;
- a separately migrated and fixture-loaded database passes the referee **11 passed,
  0 failed of 11**;
- standing **1,328 passed / 1,036 expected skips / 0 failed / 19,652 expectations
  across 437 files**; strict TypeScript, **148-file** boundaries, **23-package**
  licence policy, exact container-image pins, `git diff --check` and `bun audit {}`
  all pass;
- migration0072 SHA-256 is
  `2407d1433672e5f5a958af39acf96406b41ca0e190d1d8987100cd59c5b0f22d`.

For complete provenance, an initial Order266 execution against migration45 exposed
its already-approved migration46 posting-ordinal prerequisite; the fresh compatible
migration46 rerun passed 8/0. One standing run observed the Order330 browser geometry
canary fail under concurrent proof load; that exact canary then passed twice alone,
and the complete clean rerun passed 1328/0. Neither was a product or Order408 finding.

Stable/default databases, local port3000, retained proof directories and the
pre-existing `.yellow/` directory were not accessed or changed. This approval grants
only the exact immutable Order408 reversal and Order409 schema-header repair. It does
not grant partial/replacement correction, credit note, document/number, IRP/provider,
API/UI/local, deployment, merge, Phase or application completion authority.

## Historical D1213 review (superseded)

**Reviewer:** `/root/order408_fresh_tier3`, fresh independent non-implementing Tier 3

## Finding

The candidate is not eligible for approval because `tests/schema/expected.sql` was
regenerated from Ubuntu's packaged `pg_dump` and now hard-codes its packaging suffix
in the two dump-header lines. The repository's exact accepted standalone PostgreSQL
16.15 toolchain reports and dumps plain `16.15`; against that exact environment the
mandatory byte-exact schema comparison fails at line 6. After normalizing only the
two informational version-header lines, the complete schema body is byte-equivalent.

Regenerate or mechanically correct only those two snapshot header lines with the
exact accepted PostgreSQL 16.15 dump, then produce a new candidate and route it to a
different fresh Tier-3 reviewer. No production implementation change is requested.

## Reviewer-personal execution

I first used an isolated native Ubuntu PostgreSQL 16.15 workaround at loopback port
55741. It proved migrations 1–72, Order408 10/0 (106 expectations), Order406 10/0
(117), canonical seed 10/0, normalized schema equality, referee 11/11 and the
functional portions of Order266. Its immutable Ubuntu version banner was explicitly
excluded from acceptance.

I then created a separate fresh SCRAM-authenticated database on the exact official
standalone PostgreSQL **16.15** toolchain at loopback port 55742 with
`pg_stat_statements` preloaded. Personal results before stopping on the finding:

- migrations **1–72** and exact catalogue **72 migrations / 124 public tables /
  114 RLS tables / 114 policies / 23 forced-RLS tables / 2 views**;
- database acceptance **23/0 (65 expectations)**, including exact version, preload,
  availability, authority and canonical-only seed truth;
- complete Order408 intentional-red/live matrix **10/0 (106 expectations)**;
- schema structure byte-equivalent after version-header normalization, but mandatory
  raw normalized comparison fails exactly on the Ubuntu suffix at line 6 (and the
  corresponding dumper line 7);
- referee **11 passed, 0 failed of 11** on a separate migration-72 fixture database;
- standing **1,328 passed / 1,036 expected skips / 0 failed / 19,652 expectations
  across 437 files**; strict TypeScript, **148-file** import boundaries,
  **23-package** licence policy and `git diff --check` green;
- migration0072 SHA-256
  `2407d1433672e5f5a958af39acf96406b41ca0e190d1d8987100cd59c5b0f22d`.

The initial current-frontier Order266 run passed all functional cases except its
historical fixed catalogue count, and a same-database Order407 rerun collided with
fixtures intentionally created by Order408's prerequisite execution; neither is
counted as a fresh adjacency result. Complete adjacency/security reruns stop with
this exact-schema finding and remain mandatory for the different fresh rereviewer.

No product, migration, schema snapshot, permanent test, local app, deployment,
merge, push or credential was changed by this reviewer. Stable/default databases,
local port 3000 and the pre-existing `.yellow/` directory were not accessed or
changed. The native disposable cluster was removed. The exact Windows review server
was stopped cleanly; host policy rejected recursive deletion of its uniquely named
`D:\Yellow\order408-tier3-exact-pg` directory, which contains review-only data and
remains inactive for explicit later cleanup.
