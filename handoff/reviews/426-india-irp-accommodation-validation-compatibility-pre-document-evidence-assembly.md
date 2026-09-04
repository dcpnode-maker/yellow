# Order 426 — Fresh independent non-implementing Tier-3 review

**Verdict:** CHANGES REQUIRED — D1283

**Reviewed candidate:** `602f4ae1867ac6e4483e6a9dc448e07b88edb729`

**Base:** `7cce6b5`

**Implementation owner:** `/root/order426_implement` (not eligible to approve)

**Reviewer:** `/root/order426_tier3`, fresh independent non-implementing Tier-3

## Decisive finding

The permanent compatibility-source projection test is false-green for one explicit
Order426 production guard. I removed only
`item.lineage.sourceEvidenceHash !== sourceEvidenceHash` from the composer and ran
the named `rebound compatibility source` test. It still passed `1/0` because its
mock mutates the child's outer source, lineage source and every item source together;
the earlier outer-source check rejects before the per-item source guard is reached.
Therefore the test does not prove the per-item Order425 source backlink is
load-bearing, despite D1282 claiming that item source is independently covered.

This is a permanent-proof defect, not evidence of a wrong accepted payload. The
product mutation was restored byte-exact: its final Git blob is
`2c41436f8ee518f762018919e4dfd0a8b7e34e70`, identical to the reviewed candidate.
Approval is withheld until the child harness includes a separate coherently
tenant-rehashed mutation that changes only each compatibility item's source backlink
while preserving the child's outer and lineage source fields and recomputing its
evidence hash. Removing the exact per-item production guard must then make that named
test red. A different fresh Tier-3 reviewer is required after repair.

## Reviewer-personal evidence

- Restored focused suite: `21 pass, 0 fail`, 58 assertions (the implementation
  record's `22/0` includes its intentional-red file).
- Orders413–426 composition census executed without a database: `117 pass`, seven
  expected database skips, `0 fail`, 1,120 assertions. The broader list deliberately
  included all approved seller, buyer and B2B source boundaries.
- Restored standing suite: one transient Windows `EBUSY` cleanup failure in the
  unrelated Order330 Chromium test; isolated immediate rerun passed `1/0`. All other
  results were `1,443 pass`, 1,054 expected skips, `0` product failures, 20,629
  assertions across 2,498 tests / 462 files.
- Strict TypeScript, 159 import boundaries, 23 dependency licences and production
  audit zero pass. Candidate diff and protected-input comparison are clean; only the
  pre-existing untracked `.yellow/` remains.
- Reviewer mutations independently proved the Order424 child evidence hash, source,
  count, B2B and shared Order419 ancestry guards red. Removing the shared ancestry
  guard made both named pre-document and compatibility ancestry tests red. Removing
  Qty and Unit guards independently made their exact named tests red. The restored
  child probes verify exact-class and exact-message rejection, outer/section/lineage
  key order, only-ItemList replacement, byte-exact Qty/Unit stripping, absent
  `DocDtls`, false readiness/certification, deterministic replay, input preservation,
  recursive freezing and tenant hiding.

No migration, schema, database, Docker, local app, runtime or `.yellow` state was
started or mutated. This rejection grants no downstream, document, provider,
submission, IRN/QR, Phase 7 or application-completion authority.
