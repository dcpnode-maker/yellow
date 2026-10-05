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

---

## Different fresh Tier-3 rereview — D945

**Disposition:** APPROVE

**Reviewer:** `/root/order335_fresh_rereview`, different fresh independent
non-implementing Tier-3 reviewer

**Exact implementation:** `4f29fd5`

**Permanent-proof repair:** `59239083003aaae1fb125586e9af0c71795e78ab`

**Prior WITHHOLD governance:** `26a44a1`

### D944 closure

The repair changes only the permanent proof. Its `expectedDual` table exact-binds the
complete ordered component arrays for both civil-day schedule selections and both
dual families:

- historical12% is exactly6%/600bp +6%/600bp;
- historical and active18% are exactly9%/900bp +9%/900bp;
- active5% is exactly2.5%/250bp +2.5%/250bp;
- the second identity is SGST or UTGST according to the already-approved family.

The assertion compares identity,decimal `rate` and `rateBasisPoints` together. I
personally challenged its equality shape with12% `599+601`/`.0599+.0601` and18%
`899+901`/`.0899+.0901`; both mutants were rejected despite retaining the aggregate
sum. This closes the exact D944 sensitivity gap. IGST remains protected by the
existing single-component aggregate assertions.

### Source, statutory and security inspection

The pure implementation converts only the already-approved GST_ROOM aggregate
schedule into exact integer basis points, rejects non-integral division, preserves
IGST once and splits dual families by their exact approved ordered identities. It
re-runs complete Order310 ancestry and insertion-byte compares the supplied frozen
result; the final SHA-256 includes tenantId without exposing it. Slab bounds, ITC,
family, legal sources and predecessor hashes remain transitively bound.

The output is recursively frozen and tenant-hidden. Exact-input,proxy,accessor,
symbol,sparse/thawed and surplus-authority proof remains green. No taxable-value,
amount,rounding,residual,Section14,account,posting,correction,document,IRP,SQL,
database,API/UI or local-runtime authority is introduced.

Strict ancestry
`25db385 -> 6037a53 -> 4f29fd5 -> 281e922 -> 26a44a1 -> 5923908` passed. Repair
commit `5923908` changes only the bounded test file by5 insertions/1 replacement;
the full Order337 range contains only the admitted module/export,proof,docs and
governance paths. No migration,seed,role,writer,dependency,Compose or runtime path
changed.

### Personally executed proof

- Focused Order310/337 and adjacent Orders287/307/308/309: **48 pass,0 fail,965
  assertions**.
- Standing: **1154 pass,0 fail,890 expected skips,17583 assertions**,2044 tests
  across376 files.
- TypeScript passed; import boundaries passed for128 files; licence policy passed
  for23 packages; audit found0 vulnerabilities; diff hygiene passed.
- Only the pre-existing untracked `.yellow/` remained; it was not touched. Port3000,
  containers,database/data,credentials and local runtime were never contacted.

### Boundary

**APPROVE** exact implementation `4f29fd5` plus repaired permanent proof `5923908`.
Approval closes only the numeric per-component accommodation-rate schedule described
by Order337. It grants no taxable value,amount,rounding,Section14,posting,correction,
document,IRP,API/UI/local,merge,push,deployment or downstream authority.
