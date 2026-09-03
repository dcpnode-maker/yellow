# Order 383 — Audited-seal schema snapshot repair

**Status:** ACTIVE-D1106
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
- [ ] Candidate adds only the two canonical PG16.15 snapshot blocks.
- [ ] Fresh exact-version schema comparison and independent approval are recorded.
