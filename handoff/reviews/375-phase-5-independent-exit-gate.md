# Order 375 — Phase-5 independent exit-gate full-rereview

**Verdict:** CHANGES REQUIRED / WITHHELD

**Candidate reviewed:** D1074 activation
`dd09ac24e776398dfb452365f07d2a10e26bcd00`; frozen product frontier
`91fbe1facba34a3edac24e0a08bf974e267da44c`

**Reviewer:** `/root/order375_fresh_full_rereviewer`, fresh non-implementing Tier 3,
distinct from the D1070 Order375 reviewer and the Order376 reviewer

**Date:** 2026-09-03

## Verdict and blocking findings

The full exit proof restarted from item 1 and is withheld on two reproducible stale
strict catalogue assertions. The authoritative freshly migrated Order375 frontier is
`64 migrations / 116 public base tables / 106 RLS relations / 106 policies /
15 FORCE-RLS relations / 2 views`.

1. `tests/financial-owner-trust.integration.test.ts:50` expects `115` tables and
   `105` policies. The fresh 64-migration database returns `116` and `106`; the ACL
   values in the same assertion remain the expected `insert=false, select=true`.
2. `tests/financial-payments.integration.test.ts:243` expects `89` tables, `79` RLS
   relations and `79` policies. The fresh frontier returns `116/106/106`.

The payment assertion failed in the aggregate batch and again in an isolated run.
The trust assertion failed in the aggregate batch and again on a second database
created and migrated from zero through all 64 files, ruling out interrupted-fixture
residue. These are test-oracle defects rather than observed product defects, but
Order375 forbids test repair and red waiver. A separate exact-oracle repair and a
different fresh Tier3 full restart are required.

## Reviewer-personal evidence before the mandatory stop

- Windows-native PostgreSQL 17 was initialized under an exact disposable
  `E:\yellow\order375-rereview-<guid>` root; authority roles were provisioned and
  migrations 1–64 applied successfully.
- The complete first financial batch passed **53/0, 362 assertions** across canonical
  folios, balanced posting, statements, corrections, multi-window transfer and its
  migration contract.
- That batch includes the real **500 charges / 1,000 balanced immutable posting
  lines** zero-drift case, exact replay/rollback, sealed-day denial, tenant hostility,
  original-byte preservation and correction/transfer race arbitration.
- Before the second batch was stopped, complete folio-settlement proof passed 6/0;
  completed cashier, receivable, payment and owner-trust functional cases shown by the
  runner were green. They are not promoted to complete-suite evidence because the
  registered reds terminate the exit review.
- No prior D1070 proof was reused as the verdict and no remaining day-close,
  authority, standing/static or referee gate is claimed after the blockers.

## Teardown and boundaries

The PG17 server stopped cleanly; port 55477 refused connections. The exact disposable
root was removed and verified absent. No WSL crash dump was generated. No product,
test, migration, schema, permission, seed, dependency, HTTP/UI, local, Docker or
`.yellow` file was read or changed. Phase5, UI/status wiring and local promotion remain
unapproved.
