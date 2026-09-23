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

---

## Different fresh independent Tier-3 rereview — repaired head 531fc4c

**Disposition:** WITHHOLD — one D963 permanent-proof survivor remains

**Reviewer:** `/root/order341_fresh_rereview_d963`, different fresh independent
non-implementing OpenAI Codex Tier-3 reviewer

**Exact repaired head:** `531fc4cbd0def2e257ca9dd5cb38e0a599b68535`

**Implementation:** `9731aa8741f8740ff247598619242650484b79df`

**D962 governance:** `f3c06db01bd82bea6b3463de148906c0f06baf8f`

**D963 record:** `f48bf9a06e3d1d009fe6fab214a0dd33ab1182dd`

### Finding

The bounded repair kills every requested D963 survivor except removal of Order341's
own recursive input-freeze gate. I removed only `frozen(raw);` from `normalize` and
personally ran the complete repaired focused/adjacent command. It still passed
**44/0 with 1,350 assertions** across the Order304/309/310/337/340/341 files. The
new mutable-input challenge is rejected transitively by predecessor services, so it
does not prove that this bridge preserves its explicit exact deeply frozen input
boundary. Approval remains withheld on that one permanent-proof sensitivity gap. I
found no separate product-source or statutory-semantic defect.

The other **15 of 16 individually executed requested mutations were red**: copied
post-scheduler `599+601`/`899+901` dual components; upper-band component identity;
caller-supplied selected side; removed key, Notification15 source, and status guards
(each executed separately); removed persisted lineage id; removed both full-amount
bindings; removed all INR guards; wrapped rather than exact caller transaction;
tenant-free final hash; zeroed Section14 predecessor hash; top-level `hold_id` and
sellable-unit projection-alias bypasses; and removed `supplyDate` binding. Every
disposable mutation was restored. Final Order341 source/test blobs exactly match HEAD:
`9344acbba2bbe2b256acfb884cc7407734a44fb2` and
`7368b8875dd0a3fd317c61aa42217a4c5f8bddfb`.

### Clean proof and containment

- Focused Order341 passed **5/0, 564 assertions**. Complete focused/adjacent passed
  **44/0, 1,350 assertions**.
- Standing passed **1,187/0** with **890 expected environment skips**, **18,382
  assertions**, 2,077 tests across 384 files.
- TypeScript passed; import boundaries passed for **132 TypeScript files**; licence
  policy passed for **23 installed packages**; production audit found **0
  vulnerabilities**.
- Exact ancestry is
  `acae77d -> f3c06db -> 9731aa8 -> 50064a8 -> f48bf9a -> 531fc4c`, with approved
  base `a31d3cd` an ancestor. Repair scope is exactly the Order341 source and permanent
  test; full order scope and both diff checks pass.
- No migration, seed, dependency, Compose, server/runtime or protected path changed.
  Baseline, referee, package, lockfile and Compose blobs match the approved base.
- The repair does not broaden output: public `reservationLineage` is exact and removes
  the candidate's internal `holdId`/`sellableUnitId` disclosure while retaining those
  identities only in the tenant-bound internal lineage hash. No taxable value, tax
  amount, rounding, posting, document or IRP field is added.
- Order337 scheduler, permanent test and tax-fiscal export blobs are byte-identical
  from candidate to repaired head: `21832e692a5a893892917d6d54e19e41bca5d1c3`,
  `8abaf15becc1c7a5f6581aaad90550812d68bf80`, and
  `b26a5c0682931573135648d632e7016eacde22fc`.

The isolated rereview checkout contained no `.yellow`; database, containers, stable
local runtime, credentials and port 3000 were not contacted or changed.

### Boundary

**WITHHOLD** exact repaired head `531fc4cbd0def2e257ca9dd5cb38e0a599b68535`
until the permanent Order341 proof independently kills removal of `frozen(raw);` and
another different fresh Tier-3 reviewer executes that repaired proof. This rereview
grants no final taxable-value, tax amount, rounding, posting, correction, document,
`ItemList`, IRP, API/UI/local, merge, push, deployment, Phase-7-complete or
application-complete authority.

---

## THIRD FRESH REREVIEW — final outer-freeze proof at 7aab21e

**Disposition:** APPROVE — the final D964 permanent-proof survivor is killed

**Reviewer:** `/root/order341_final_freeze_rereview`, third fresh independent
non-implementing OpenAI Codex Tier-3 reviewer

**Exact reviewed head:** `7aab21eb8e39469a8048727e2e6e121750778358`

**Final proof repair:** `cb73dafc68e6ec1a92fc8f9ca9c114bc4e938b63`

**Implementation:** `9731aa8741f8740ff247598619242650484b79df`

**Approved base:** `a31d3cd` (approved Order340 governance head)

### Finding and final D964 proof

No product-source, statutory-semantic, containment, or permanent-proof finding
remains. I removed only the `frozen(raw);` statement from Order341 `normalize` and
personally executed the repaired permanent Order341 test. The new otherwise-valid
mutable-outer-envelope challenge failed at its exact rejection assertion: **4 pass,
1 fail, 566 assertions**. The promise resolved instead of rejecting at line 178.
Before mutation the same focused proof passed **5/0 with 570 assertions**. I restored
the exact statement by reverse patch and verified the source blob returned to
`9344acbba2bbe2b256acfb884cc7407734a44fb2` with no source diff. The permanent test
blob is `033da7e3d00dd2520c3cffc8942c8c0abc422077`.

I also independently sampled the repaired D963 surfaces one mutation at a time:

- post-scheduler dual components changed by `-1/+1` basis point, including the
  upper `899+901` corruption: **3 pass, 2 fail, 76 assertions**;
- projected hold and sellable-unit aliases substituted for their top-level lineage
  coordinates: **4 pass, 1 fail, 570 assertions**, naming both `hold` and
  `sellable unit` as survivors;
- pair selection changed from the fresh local Section14 result to the caller-supplied
  selected side: **4 pass, 1 fail, 558 assertions**;
- tenant identity removed from the final evidence-hash preimage: **3 pass, 2 fail,
  50 assertions**, including the independent expected-hash mismatch.

Every disposable mutation was reverse-patched immediately. Final Order341 source and
test blobs exactly match reviewed HEAD, and their tracked diff is empty.

### Reviewer-executed clean and preservation proof

- Order341 plus adjacent Orders337/340 and shared Orders304/309/310 passed **44/0,
  1,356 assertions** across the six focused files.
- The standing suite passed **1,187/0** with **890 expected environment skips** and
  **18,388 assertions**, 2,077 tests across 384 files.
- TypeScript passed; import boundaries passed for **132 TypeScript files**; licence
  policy passed for **23 installed packages**; production audit found **0
  vulnerabilities**.
- Approved base `a31d3cd` is an ancestor of HEAD and the exact ten-parent Order341
  chain passes **10/10** through `c36cde9 -> acae77d -> f3c06db -> 9731aa8 ->
  50064a8 -> f48bf9a -> 531fc4c -> cb73daf -> 489c51c -> 7aab21e`.
- Exact order scope passes **15/15** with no extra or missing changed path;
  `git diff --check a31d3cd..HEAD` passes; protected-path inspection reports **0
  changed**.
- Baseline migration `dce210b`, referee `7f721e2`, root package `9b96d8c`, lockfile
  `56434f7`, and Compose `5e811f8` blobs match the approved base. Order337 scheduler
  `21832e6`, its permanent test `8abaf15`, and the tax-fiscal export `b26a5c0` match
  the implementation candidate at reviewed HEAD.

Per the exact order boundary, I did not contact or change `.yellow`, Docker, the
database, any stable runtime, credentials, or port 3000. The pre-existing untracked
`.yellow/` directory was left untouched.

### Boundary

**APPROVE** exact reviewed head `7aab21eb8e39469a8048727e2e6e121750778358`
for Order341's bounded immutable, tenant-hidden, per-room-night quoted
rate-applicability partition. This approval closes only the final D964 proof debt. It
grants no final taxable-value, tax amount, rounding, posting, correction, document,
`ItemList`, IRP, API/UI/local, merge, push, deployment, Phase-7-complete or
application-complete authority.
