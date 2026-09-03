# Order 375 — Phase-5 independent exit-gate review

**Verdict:** CHANGES REQUIRED / WITHHELD

**Candidate reviewed:** activation `19ef8559e99096afc9524c73ddb31f94b5949d42`; frozen product frontier `c164056e1b17735f7f9527065271a99750e5839d`

**Reviewer:** `/root/order375_phase5_exit_review`, fresh non-implementing Tier 3

**Date:** 2026-09-03

## Blocking finding

The pre-registered aggregate proof is red on the frozen candidate. The Order 104
posting suite contains a stale exact-catalogue assertion at
`tests/financial-postings.integration.test.ts:194`: it expects 115 public base tables,
while Order375 and the freshly migrated database require and produce 116.

This is deterministic and independently reproduced:

- complete suite: `9 passed, 1 failed`, 102 expectations;
- isolated `P1: exact migration truth` rerun: `0 passed, 1 failed`, with
  `Expected: 115`, `Received: 116`;
- the same complete suite nevertheless passed its real 500-charge / 1,000-posting-line
  zero-drift proof and every other functional, replay, rollback, sealed-day, malformed,
  tenant and RLS case.

Order375 explicitly forbids changing tests inside the review, requires exact
`64/116/106/106/15/2`, and forbids waiving any red. Approval is therefore withheld.
A separately scoped repair must update the stale oracle to the already-authoritative
116-table frontier, prove that no other Phase-5 aggregate oracle is stale, and route
the repaired candidate to a different fresh Tier-3 reviewer for the full exit proof.

## Reviewer-personal evidence before the stop

- Windows-native PostgreSQL 17 disposable cluster was initialized under
  `E:\yellow\order375-review-87717fa83acb4856946681dc56e5f3ba` with a dedicated
  ephemeral database and roles.
- The repository migration runner applied migrations 1–64 successfully.
- Live catalogue was exactly `64 migrations / 116 tables / 106 RLS relations /
  106 policies / 15 FORCE RLS relations / 2 views`.
- `financial-folios.integration.test.ts` passed `12/0` on the corrected registered
  fixture connection.
- `financial-postings.integration.test.ts` produced the blocking `9/1` result and
  the isolated assertion reproduced it.

The remaining Phase-5 aggregate suites, standing/static gates and referee were not
claimed after the non-waivable blocker. Continuing could not convert this candidate
to an approvable state and would spend proof resources without changing the verdict.

## Teardown and boundaries

The PostgreSQL server stopped cleanly and port 55475 returned no response. The exact
disposable review directory was removed and verified absent. Bun regenerated one
1,078,730,752-byte WSL crash dump even though the proof itself used Windows-native
binaries; it was recorded, deleted under the founder's standing crash-dump authority,
and the crash directory was verified absent. No product, test, migration, schema,
permission, seed, dependency, HTTP/UI, local, Docker or `.yellow` file was changed.
Phase 5, its UI/status wiring and local promotion remain unapproved.
