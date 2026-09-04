# Order 408 — Fresh independent Tier-3 review

**Verdict:** CHANGES-REQUIRED-D1213

**Reviewed candidate:** `3830282`

**Approved base:** `907ef6d`

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
