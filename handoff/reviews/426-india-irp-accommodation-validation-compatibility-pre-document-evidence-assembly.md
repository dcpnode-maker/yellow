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

## D1284 — Implementation proof repair awaiting different fresh Tier-3

The implementation owner accepted D1283 and split the compatibility child source
mutation into exact outer-source-only, nested-source-only and per-item-source-only
projections. Each recomputes the child tenant-bound evidence hash and requires the
exact Order426 validation class/message. Removing only the per-item production source
guard makes the dedicated per-item probe red `0/1`; restored production is green.

The audit found and split two analogous bundled projections: actual item count versus
declared item count, and child component family versus each item lineage family. It
also added isolated Order424 tax-scheme/format/readiness and Order425 state probes.
The repaired focused suite passes `31/0` (68 assertions); all 24 India-IRP test files
pass `138/0` with seven expected DB skips (1,182 assertions); standing passes
`1,453/0` with 1,054 expected DB skips (20,638 assertions; 2,507 tests / 462 files).
TypeScript, 159 boundaries, 23 licences, audit zero, image pins, protected-input and
diff checks pass. Product source remains byte-exact to `602f4ae`.

This is implementer evidence, not approval. A different fresh non-implementing Tier-3
reviewer must personally challenge the repaired probes and approve an exact candidate.

## Different fresh Tier-3 rereview — D1286

**Verdict:** CHANGES REQUIRED

**Reviewed repaired candidate:** `5db5f6001c30ab2da60f6ed57ab32909135d829d`

**Rejection base:** `11731e5`; **original base:** `7cce6b5`

**Reviewer:** `/root/order426_repair_tier3`, different fresh independent
non-implementing Tier-3

The D1283 per-item-source defect is repaired: its child projection now changes only
the per-item source backlink, recomputes the child hash, requires the exact Order426
class/message, and removing only the matching production guard makes that named test
red `0/1`. Separate outer/nested source, child/per-item family, tax-scheme, format,
readiness, state and declared-count guard removals likewise make their named probes
red.

Approval is still withheld because the claimed separation of actual and declared item
count is false-green. The `compatibility count` child mutation removes items while
leaving `lineage.itemCount` unchanged. When only the production
`compatibility.items.length !== preDocument.sections.ItemList.length` guard is removed,
the named test remains green `1/0`: the later declared-count guard rejects the same
mutation with the same expected class/message. The actual child-versus-pre-document
count guard is therefore not proven load-bearing. Add a coherently tenant-rehashed
actual-count projection that changes both `items` and `lineage.itemCount` together,
while preserving the pre-document child, so only the actual count mismatch remains;
removing only the actual-count guard must then turn that exact-message test red.

Restored evidence: focused `30/0` (67 assertions), strict TypeScript, 159 import
boundaries, 23 licences, candidate scope/diff and protected product/test blobs green;
only pre-existing `.yellow/` is untracked. No product mutation remains. The current
shared head advanced to Order427 while this review ran, but the reviewed product and
test blobs remain byte-exact to `5db5f60`. No database, Docker, runtime, local app or
`.yellow` state was used or mutated. This rejection grants no downstream, document,
provider, submission, IRN/QR, Phase 7 or application-completion authority.

## D1287 — Implementer count-proof repair awaiting another different Tier-3

The actual-count child projection now shortens `items` and changes
`lineage.itemCount` to the same coherent value while Order424 stays unchanged. Removal
of only the child-versus-pre-document count guard makes its exact named probe red
`0/1`; it reaches a different later error and therefore cannot pass its exact-message
oracle. The declared-count projection changes only `lineage.itemCount`; removal of
only that production guard independently makes its named probe red `0/1`. Restored
production passes both `2/0` and remains byte-exact to `602f4ae`.

All same-message mutations were re-audited: outer/nested/per-item source, actual/
declared count, child/per-item family, tax scheme/B2B/currency, format/readiness/state,
ancestry, item order/content, Qty/Unit and evidence hashes have distinct projections.
Complete restored gate results are recorded in D1287. This remains implementation
evidence only; another different fresh non-implementing Tier-3 reviewer is mandatory.

Restored complete execution passes focused `31/0` (68), India-IRP composition
`138/0` plus seven expected DB skips (1,182), and standing `1,452/0` plus 1,054
expected DB skips with one unrelated Order330 Chromium cleanup failure; that exact
test immediately passes in isolation `1/0` (4), consistent with D1283's recorded host
cleanup flake. Static, protected/product-byte, scope and diff checks are green.

## Another different fresh Tier-3 final rereview — D1289

**Verdict:** APPROVED — CLOSED

**Reviewed repaired candidate:** `01a802684d933f5d6d7f832d28ab57eabc053f5f`

**Rejection base:** `54ce83b`; **original product candidate:** `602f4ae`

**Reviewer:** `/root/order426_count_tier3`, another different fresh independent
non-implementing Tier-3

D1286's actual-versus-declared count defect is repaired. I removed only
`compatibility.items.length !== preDocument.sections.ItemList.length`; the exact
`compatibility count` test became red `0/1` because it reached the distinct later
`compatibility enrichment does not preserve pre-document items` error. I restored
that line, removed only
`compatibility.lineage.itemCount !== compatibility.items.length`, and the exact
`compatibility lineageCount` test became red `0/1` because the composer incorrectly
accepted the declared-only mutation. Exact restoration returned both tests to green
`2/0` and restored product blob `2c41436f`.

I also independently removed and restored the repaired per-item source guard, all
four separately projected child outer/nested source guards, each child evidence-hash
guard, the item-family and outer-family gates, fixed `Qty` and `Unit`, and the shared
Order419 item-candidate ancestry gate. Every corresponding named exact-message probe
turned red when its production protection was absent. The ancestry removal made both
pre-document and compatibility ancestry probes red, proving both approved children
contribute independently to the shared lineage. The current child harness separates
outer source, nested source, per-item source, actual count, declared count, child
family, per-item family, tax scheme, format, readiness and compatibility state; every
non-evidence mutation recomputes its tenant-bound child hash, and each probe requires
the exact Order426 error class and message. No catch-any-error masking remains.

Reviewer-personal restored evidence:

- focused `31/0` (68 assertions);
- all India-IRP composition `138/0` plus seven expected database skips (1,182
  assertions);
- standing `1,453/0` plus 1,054 expected database skips, zero failures (20,638
  assertions; 2,507 tests / 462 files);
- strict TypeScript, 159 import boundaries, 23-package licence policy, zero
  vulnerabilities, exact container-image pins and diff hygiene all pass;
- Order424/425 protected product files are byte-exact to approved head `e9d4ef1`;
  Order426 product blob is `2c41436f`, repaired test blob is `d3ecb6d`, and only the
  pre-existing untracked `.yellow/` remains.

The fixed contract is exact: only Order424 `ItemList` is replaced with Order425's
ordered `Qty:"1.000"` / `Unit:"OTH"` projection; stripping those fields reproduces
the pre-document items byte-exact; all other sections and key order are retained;
`DocDtls` is absent; both readiness/certification flags remain false; output is
tenant-hidden, deterministic and recursively frozen. No database, Docker, runtime,
local app or `.yellow` state was used or mutated. Approval grants no document,
provider, submission, IRN/QR, Phase-7 or application-completion authority.
