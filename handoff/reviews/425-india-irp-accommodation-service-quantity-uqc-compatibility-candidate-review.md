# Order 425 — Fresh independent non-implementing Tier-3 review

**Verdict:** APPROVED AFTER REPAIR — D1280; original D1278 rejection retained below

**Current approved candidate:** repaired candidate `34984aa` over approved base
`b39c64c`; the original rejected candidate `8ba86b9` is retained below.

**Reviewer:** `/root/order425_fresh_tier3`, fresh independent non-implementing Tier-3

## Decisive finding

The permanent controlled-child projection proof is false-green. The subprocess helper
accepts any thrown error as successful rejection. Removing the production
`UnitPrice === TotAmt` guard leaves the complete focused suite green (`7 pass, 0 fail`),
even though D1276 and the order explicitly require that guard to be
load-bearing. Removing the production B2B guard independently also leaves the suite
green (`7 pass, 0 fail`). Diagnostic execution showed every alleged child mutation
converging only to the composer's generic `...evidence is malformed` catch, rather
than proving each named mismatch reached and was rejected by its intended guard.

This invalidates the claimed controlled proof for amount, count, component family,
currency, B2B and source mismatches. The implementation itself was restored byte-exact
after each reviewer mutation. Approval is withheld; no statutory downstream authority
exists.

## Reviewer-personal evidence

- Exact restored candidate focused plus intentional-red: `8 pass, 0 fail`, 96
  assertions.
- Orders 413–425 IRP composition: `81 pass`, 7 expected database skips, 0 fail.
- Complete standing suite: `1414 pass`, 1,054 expected database skips, 0 fail;
  20,567 assertions across 2,468 tests / 460 files.
- Mutation A: changed only emitted Qty/Unit to `2.000`/`NOS`; focused became
  `6 pass, 1 fail`, proving fixed compatibility constants are mutation-sensitive.
- Mutation B: removed only the UnitPrice/TotAmt guard; focused remained falsely green
  `7 pass, 0 fail`.
- Mutation C: restored B then removed only the B2B inherited-result guard; focused
  remained falsely green `7 pass, 0 fail`.
- Strict TypeScript, 158 import boundaries, 23 dependency licences, production audit
  zero, container image pins and candidate diff check pass.
- `git diff b39c64c..8ba86b9 -- migrations` is empty; no schema, database, referee,
  runtime, local, Docker or `.yellow` mutation was performed by this review.
- Exact scope contains only the ten authorized files. Source inspection confirms the
  intended exact outer/lineage/item key order, only Qty `1.000` and Unit `OTH`
  enrichment, byte-preserved child fields/lineage, tenant-hidden deterministic hash,
  recursive freeze and explicit non-provider-certified/non-submission-ready boundary.

## Required repair

Replace the controlled-child harness with mutation-sensitive proof that cannot pass
on an unrelated exception: retain an unmocked original child reference, assert the
exact expected validation outcome for each named projection, and make each production
guard removal independently turn a permanent test red. Then rerun the complete gates
and obtain a different fresh non-implementing Tier-3 review.

## D1279 repair awaiting different fresh Tier-3

The controlled-child harness now retains the unmocked original child, resolves the
same normalized child module identity, coherently recomputes every mutated Order419
tenant-bound evidence hash, and succeeds only for the exact Order425 validation class
and guard-specific message. Nine named mismatch projections are separately executable.

The implementer removed the amount, B2B, count, family/order, currency, source and
evidence guards independently and observed the corresponding intended test turn red;
all production was restored before final proof. Restored focused passes `16/0` (99),
composition `89/0` plus 7 expected database skips (895), and standing `1422/0` plus
1,054 expected skips (20,570; 2,476 tests/460 files). Static gates remain green.

This is implementation evidence, not approval. A different fresh independent
non-implementing Tier-3 reviewer must personally rerun the mutation audit and complete
gates before changing the verdict.

---

## D1280 — Different fresh independent Tier-3 rereview after repair

**Verdict:** APPROVED — exact repaired candidate only

**Reviewed candidate:** `34984aa40daa88bf3f5b58c7ad9ad2695baf6593`

**Rejection commit:** `bcef856`

**Original base:** `b39c64c`

**Reviewer:** `/root/order425_repair_tier3`, different fresh independent
non-implementing Tier-3 reviewer

### Reviewer-executed mutation proof

The repaired exact-class/exact-message subprocess probes pass `9/0`. I independently
removed each corresponding production guard one at a time. Amount, count, component
family, item order, currency, B2B supply, outer source, per-item source and Order419
evidence-hash guard removals each made only its named permanent test red `0/1`; the
probe received exit `1` instead of the required exact-rejection exit `0`. Thus none
can pass on the unrelated generic malformed-evidence error that caused D1278.

I separately changed `Qty` from `1.000` to `2.000`, removed `Qty`, changed `Unit`
from `OTH` to `NOS`, and removed `Unit`. Each independent mutation made the exact
field/order proof red `0/1`. Bypassing only Order419's ordinary-B2B composer while
retaining its numeric source made the coherently tenant-rehashed CGST+SGST export
fixture return a full candidate instead of rejecting; the permanent Order425 test
became red `0/1`. This proves the approved Order419 child and its B2B admission are
load-bearing. All product mutations were restored before each next probe. Final
candidate and Order419 child Git blob identities equal `10b96eedf04d88a9431478702b1dc2f97ef32f08`
and `3946f92fcbfca347ad6b1b6afd250f0c9736e075` respectively.

### Exact contract and clean gates

A reviewer-direct runtime census across IGST, CGST+SGST and CGST+UTGST confirms exact
outer keys, lineage keys and family-specific item order; two items each carry only
`Qty:"1.000"` and `Unit:"OTH"` as enrichment. Removing those fields reproduces the
Order419 items byte-exact, all source/evidence backlinks and counts match, the result
is recursively frozen, and tenant identity is absent from output.

- Focused plus intentional red: `16 pass, 0 fail`, 99 assertions.
- Orders413–425 composition: `89 pass, 7 expected database skips, 0 fail`, 895
  assertions across 18 files.
- Complete standing suite: `1,422 pass, 1,054 expected database skips, 0 fail`,
  20,570 assertions across 2,476 tests / 460 files.
- Strict TypeScript: green; import boundaries: 158 files; dependency licences: 23
  packages; `bun audit --audit-level=high`: no vulnerabilities.
- Container image validator and tests: exact pins; `4/0`, 7 assertions.
- `git diff --check b39c64c..34984aa`: green. Exact range contains only the ten
  Order425-authorized files. `migrations/`, `tests/schema/expected.sql`, `package.json`
  and `bun.lock` are byte-identical to the original base; approved Order424 ancestry
  and the D1278 rejection/repair ancestry are present.

No database, Docker, local app or `.yellow` state was started or mutated. During the
review, C: reached zero free bytes because six newly regenerated WSL crash dumps
occupied about 5.07 GiB. The transient source write was immediately restored from
the exact reviewed commit and hash-verified. The six crash dumps were moved—not
copied—to recoverable `D:\Yellow\wsl-crash-quarantine`; C: ended with about 5.06 GiB
free. This operational recovery changes no repository or reviewed product evidence.

Approval is strictly bounded to the pure compatibility candidate. `OTH` is not
provider-certified and the result is not submission-ready. This grants no DocDtls,
fiscal issue, provider payload/submission, IRN/QR, API/UI/runtime/local, deployment,
merge, push, Phase 7 or application-completion authority.
