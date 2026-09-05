# Order 383 — Audited-seal schema snapshot repair

**Status:** APPROVED-CLOSED-D1108
**Phase:** 5 — Financials
**Branch:** `phase-5/audited-seal-schema-snapshot-repair`
**Base:** exact withheld Order382 governance `bc4bede3433ed4e3e6392e512f18fbda1541feab`
**Risk tier:** 1 — canonical test snapshot only; immutable financial function bytes

Repair only D1105's exact PostgreSQL16.15 schema mismatch: append the canonical
normalized `pg_dump` representation of migration0064's existing
`seal_business_day_audited(uuid,uuid,date,uuid)` function and ACL to
`tests/schema/expected.sql` at their deterministic sorted positions. Production
migration0064 and every source/schema/runtime behavior remain byte-immutable.

## Exact scope

- `tests/schema/expected.sql`, only the missing function and ACL blocks emitted by
  official Windows PostgreSQL16.15 after migrations1–65;
- a focused static assertion only if necessary to prevent future omission;
- this order, its review, `DECISIONS.log` and `handoff/LEDGER.md`.

No migration, product source, setup, seed, dependency, other test expectation,
HTTP/UI/status/local, Docker, deploy or `.yellow` change is admitted.

## Executable proof

1. Preserve D1105's normalized PG16.15 dump diff as the intentional red.
2. On a fresh official Windows PG16.15 cluster with migrations1–65, regenerate the
   normalized dump using the repository's exact schema procedure; after the bounded
   insertion, byte comparison is empty.
3. Prove the inserted function body/signature/result/search path/owner semantics and
   ACL exactly match live migration0064 truth; no existing snapshot byte changes.
4. Re-run migration/schema/definer/acceptance/standing/static gates and fresh referee
   11/11 as applicable. A fresh independent non-implementing reviewer executes the
   exact PG16.15 comparison before approval.

## Forbidden

- editing migration0064, migration0065 or any production function/permission;
- manually approximating dump formatting, omitting body/ACL, normalizing away a real
  difference, or accepting PostgreSQL17 ordering/version noise;
- broader snapshot regeneration, application/UI/local/deploy/merge/Phase approval.

## Definition of done

- [x] D1105 independently proves the exact missing function and ACL.
- [x] Candidate adds only the two canonical PG16.15 snapshot blocks.
- [x] Fresh exact-version schema comparison and independent approval are recorded.

## Independent review — D1108

Fresh non-implementing reviewer `/root/order383_fresh_pg16_reviewer` independently
reviewed exact candidate `0acde6e1e0a6b546bd8416ea6a1fc623e6776811` against activation
`70319e15098a4517debeaeeb08d892b8fcc18c71`. An official Windows PostgreSQL
16.15 cluster with `pg_stat_statements` preloaded applied migrations 1–65 and
returned exact catalogue `65/116/106/106/15/2`. The repository-normalized native
dump and `tests/schema/expected.sql` are byte-identical at SHA-256
`a5efaaae5ad3d2315cf2fc62a7dd2352e3992b9643f91784ca70994d1f89e8a9`.

The candidate adds exactly 393 snapshot lines and deletes none. Migration0064,
migration0065, production source and protected referee bytes are unchanged. The
live audited-seal signature, result, `yellow_owner`, SECURITY DEFINER fixed path and
app/PUBLIC ACL exactly match the committed dump. Reviewer-personal focused proof
passes 22/0 (379 assertions), acceptance 23/0 (65), migration regression 39/0
(182, including wrong-password `28P01`), standing 1225/0 with 956 expected skips
(18,611), typecheck, 140-file boundaries, 23-package licence policy, zero-vulnerability
audit, diff-check and a fresh referee 11/11. The initial focused import and referee
attempts stopped only on reviewer-harness environment/console encoding before a
complete result; both were corrected and the complete proofs restarted. The exact
server, port and disposable root were removed; no WSL crash dump appeared. Order383
is approved and closed only; Order382/375 are not approved or restarted here.

## Builder evidence — D1107

Official Windows PostgreSQL 16.15 with `pg_stat_statements` preloaded applied
migrations 1–65 and produced exact catalogue `65/116/106/106/15/2`. The repository's
normalizer reports an empty byte comparison after adding exactly the missing
`seal_business_day_audited(uuid,uuid,date,uuid)` definition and ACL: 393 inserted
snapshot lines, zero deletions, with every pre-existing snapshot byte preserved.
Focused seal/schema/definer proof passes **23/0 (385 assertions)**; seeded exact-version
database acceptance passes **23/0 (65 assertions)**; typecheck, 140-file boundaries,
standing passes **1225/0 with 956 expected skips (18,611 assertions)**; the complete
migration suite passed 38 unaffected cases and its sole host-authentication case passed
after enabling SCRAM on the disposable cluster. Typecheck, 140-file boundaries,
23-package licence policy, zero-vulnerability audit and diff-check pass. Production,
migration, source, setup, seed, dependency, HTTP/UI/status/local and Docker surfaces
are unchanged. Fresh independent non-implementing exact-version review remains
mandatory; the builder does not approve this candidate.
