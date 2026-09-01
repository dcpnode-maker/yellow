# Order 341 fresh independent Tier-3 executable review

**Disposition:** WITHHOLD — permanent-proof sensitivity

**Reviewer:** `/root/order341_fresh_tier3`, fresh independent non-implementing OpenAI Codex Tier-3 reviewer

**Exact candidate:** `9731aa8741f8740ff247598619242650484b79df`

**Governance:** `f3c06db01bd82bea6b3463de148906c0f06baf8f` (D962)

**Intentional red:** `acae77dcad8090916b31a2b42d821f0647cea252`

**Approved base:** `a31d3cd` (approved Order340 governance head)

## Finding

The exact implementation is coherent on inspection and the clean focused, adjacent,
standing and static gates are green, but the mandatory permanent Order341 proof is not
mutation-sensitive to the complete pre-registered P2b/P3/P4/P5/P6 contract. Approval is
therefore withheld on proof completeness; I found no separate product-source or
statutory-semantic defect in the unmodified candidate.

The most direct survivor corrupts Order341's copied component schedule *after* the
approved shared Order337 scheduler has returned. It changes predecessor 12% dual
components from exact `600+600` to `599+601` and every 18% dual upper band from exact
`900+900` to `899+901`, preserving each aggregate sum. The combined Order341 plus
unchanged Order337 permanent proof still passes **14/0 with 717 assertions**. A separate
upper-band identity mutant that changes every copied upper component identity to
`cgst` also passes the same **14/0 (717)**. The focused test checks aggregate basis
points for both quoted nights but exact component values/identity only for the lower
successor example, so it cannot protect all six cases, all three families, historical
12%, both 18% upper bands and both dual-family orders.

Additional reviewer-owned mutants that leave required explicit authority or evidence
unbound also survive:

- selecting the pair member from supplied `input.section14Result.selectedVersionSide`
  rather than the fresh local Order340 result: **4/0 (477)**;
- removing the selected pair member's `key`, Notification15 source and `status`
  equality guards: combined Order304/310/337/340/341 proof **32/0 (1,096)**;
- removing persisted reservation-lineage-id equality: Order340+341 **14/0 (598)**;
- removing snapshot-to-payment/invoice full-amount equality: **14/0 (598)**;
- removing all Order341 INR guards while continuing to label output INR: **14/0
  (598)**;
- replacing the exact transaction handle passed to Order340 with a bound wrapper:
  **14/0 (598)**;
- omitting tenant identity from the final evidence-hash preimage: **4/0 (477)**;
- replacing the returned Section14 predecessor hash with 64 zeroes: **4/0 (477)**;
- removing the recursive input-freeze gate: **4/0 (477)**.

These survivors are not excused by transitive dependency checks: D962 and Order341
explicitly require the bridge's selected-member provenance, exact numeric copy,
persisted lineage, full amount/currency/transaction binding, hostile shape rejection
and complete tenant-bound hashes to be permanently executable.

Required repair: add permanent Order341 assertions that exact-bind every returned
component identity, decimal rate and basis points for all six cases, all three
families and both bands (`250+250`, `600+600`, `900+900`, and sole IGST), plus direct
mutation-sensitive pins for every survivor listed above. Then rerun the gates and
obtain a different fresh non-implementing Tier-3 rereview.

## Mutants killed by the committed proof

- Restoring D961's historical-selected-version equality fails Order341 **2/2 (21)**;
  case1 successor and case5 predecessor divergence is executable.
- Selecting the schedule by the historical supply-date member fails **2/2 (21)**.
- Moving the unequal-half corruption into the shared Order337 splitter leaves
  Order341 focused green **4/0 (477)** but unchanged Order337 proof kills it **9/1
  (203)**. This confirms the extraction preserves Order337's approved byte contract;
  the uncovered defect class is the Order341 post-scheduler copy.
- Making INR750000 exclusive fails **3/1 (476)**.
- Removing the service-supply-date structural guard fails **3/1 (475)**.
- Thawing the returned outer envelope fails **3/1 (30)**.
- Adding a forbidden `taxAmountMinor` output fails **3/1 (477)**.

Every disposable source mutation was reverse-patched. Final source blobs match HEAD:
Order341 `c5eb917b40fb07553f1c961904cadacb402247fb`; shared Order337 scheduler
`21832e692a5a893892917d6d54e19e41bca5d1c3`. `git diff --exit-code` passed before
this review record was added.

## Reviewer-executed clean proof

- `bun test tests/india-gst-accommodation-quoted-rate-applicability.intentional-red.test.ts tests/india-gst-accommodation-quoted-rate-applicability.test.ts tests/india-gst-accommodation-rate-version-pair.test.ts tests/india-gst-accommodation-levy-input-bundle.test.ts tests/india-gst-accommodation-levy-component-identity.test.ts tests/india-gst-section14-rate-selection.test.ts`
  → **43 pass, 0 fail, 1,263 assertions**.
- At exact red `acae77d`,
  `bun test tests/india-gst-accommodation-quoted-rate-applicability.intentional-red.test.ts`
  → **0 pass, 1 fail, 1 assertion**, because the resolver export is absent.
- `bun test --timeout 30000` → **1,186 pass, 890 expected environment skips, 0
  fail, 18,295 assertions**, 2,076 tests across 384 files.
- `bun run typecheck` passed.
- `bun run boundaries` passed: **132 TypeScript files scanned**.
- `bun run license-check` passed: **23 installed packages**.
- `bun audit --production` passed: **no vulnerabilities found**.
- `git diff --check a31d3cd..9731aa8`, strict ancestry, exact parent, protected-path
  and scope inspection passed. Candidate parent is exactly D962 `f3c06db`; approved
  base `a31d3cd` is an ancestor. The candidate changes only the admitted docs, context
  export, shared scheduler extraction, new resolver and permanent test. No migration,
  schema, seed, role, writer, Compose, server or local-runtime path changed.

Per the exact order boundary, no database, Docker container, `.yellow`, port 3000,
credentials or stable local runtime was contacted. The approved unchanged database
lineage remains governing; this pure/read-only candidate did not require a new database
proof.

## Boundary

**WITHHOLD** exact candidate `9731aa8741f8740ff247598619242650484b79df` until the
permanent-proof repair and a different fresh Tier-3 rereview. This review grants no
final taxable-value, tax amount, rounding, posting, correction, document, `ItemList`,
IRP, API/UI/local, merge, push, deployment, Phase-7-complete or
application-complete authority.
