# Order 337 fresh independent Tier-3 review

**Disposition:** WITHHOLD — permanent-proof sensitivity

**Reviewer:** `/root/order334_fresh_tier2`, fresh non-implementing Tier-3 reviewer

**Exact implementation:** `4f29fd5`

**Governance reviewed:** `281e922`

**Approved base:** `25db385`

## Finding

There is no product or statutory-semantic finding. The pure implementation correctly
replays exact Order310 ancestry and uses remainder-free basis-point division to produce
IGST unchanged and equal ordered CGST+SGST or CGST+UTGST halves.

Approval is withheld because the permanent proof does not mutation-bind the complete
pre-registered P1 contract. It exact-checks the component values only on the first 5%
slab. For12% and18%, it checks only that component basis points sum to the aggregate.
That assertion cannot distinguish equal halves from unequal components with the same
sum.

I executed a reviewer-only in-memory semantic mutant matching the committed assertion
pattern. The mutant returned 599+601 basis points for12% and 899+901 for18%, preserving
the aggregate sum. It survived every corresponding assertion. Those outputs violate
the order's exact equal-half contract, proving the permanent test is not sensitive to
this defect class.

Required repair: permanently equality-bind both `rateBasisPoints` and `rate` for each
ordered component of every historical and active slab, including exact 6%+6% and
9%+9%, for both dual families. Then rerun all gates and assign a different fresh
Tier-3 rereviewer.

## Official source and source inspection

I personally fetched CBIC's official current goods-and-services rate table and Central
Tax (Rate) notification index. The table presents matching CGST and SGST/UTGST service
rates beside the integrated aggregate, including accommodation rates6%+6%=12% and
9%+9%=18%. The index identifies Notification11/2017-Central Tax (Rate) as the CGST
services-rate instrument. This supports the order's equal-half semantics.

Strict ancestry `25db385 -> 6037a53 -> 4f29fd5 -> 281e922` passed. Exact candidate
inspection found one pure185-line module, its context export and bounded docs/proof.
No migration, SQL, seed, role, writer, dependency, Compose, UI or runtime artifact
changed. The approved59-migration/110-table/referee11/11 lineage therefore remains the
governing unchanged database evidence; no database or runtime was contacted.

## Personally executed proof

- Focused Order310/337 plus adjacent Orders287/307/308/309: **48 pass,0 fail,961
  assertions**.
- Standing: **1154 pass,0 fail,890 expected skips,17579 assertions**,2044 tests across
  376 files.
- TypeScript passed; import boundaries passed for128 files; licence policy passed for
  23 packages; audit found0 vulnerabilities; diff hygiene and protected-path
  preservation passed.
- Worktree retained only the pre-existing untracked `.yellow/`, which I did not touch.
  Port3000, containers, data and credentials were untouched.

## Boundary

**WITHHOLD** exact Order337 candidate `4f29fd5` on verification completeness only.
This grants no taxable value, amount, rounding, Section14, posting, correction,
document, IRP, API/UI/local, merge, push, deployment or downstream authority.
