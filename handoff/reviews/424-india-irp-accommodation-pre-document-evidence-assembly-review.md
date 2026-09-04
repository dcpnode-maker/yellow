# Order 424 — Fresh independent non-implementing Tier-3 review

**Verdict:** REJECTED — nested child source-lineage mismatches fail open

**Reviewed candidate:** `5dd8f6c`

**Reviewed base:** `89c5889`

**Reviewer:** `/root/order424_fresh_tier3`, fresh independent non-implementing
Tier-3 reviewer

## Blocking finding

Order424 promises that all child source hashes equal the supplied Order413 evidence
hash, but `validateCoherence()` checks only each child's outer `sourceEvidenceHash`.
It does not verify the independently approved source-lineage locations carried by
Order423 `transaction.lineage.sourceEvidenceHash`, Order422
`parties.lineage.sourceEvidenceHash`, or Order420
`values.lineage.sourceEvidenceHash`.

I separately replaced each of those three nested child hashes with 64 zeroes while
leaving the corresponding outer child hash correct. In every case the unchanged
Order424 focused suite remained green **6 passed, 0 failed (66 assertions)** and the
assembly was returned instead of rejecting the cross-child mismatch. This directly
contradicts the exact contract and required proofs 4–5. The candidate therefore
cannot receive statutory-composition approval.

Repair must make all actual approved child source-lineage locations load-bearing and
add permanent tests that fail for each independent mismatch. The repaired candidate
must receive another fresh non-implementing Tier-3 review.

## Evidence that remains green but is not sufficient for approval

- exact restored Order424 focused suite: **6 passed, 0 failed (66 assertions)**;
- selected Orders414/419/420/422/423/424 composition suite: **43 passed, 0 failed
  (507 assertions)**;
- complete standing suite: **1,403 passed, 1,054 expected database skips, 0 failed
  (20,465 assertions; 2,457 tests across 458 files)**;
- strict TypeScript: green;
- import boundaries: **157 TypeScript files**, green;
- dependency licence policy: **23 installed packages**, green;
- `bun audit --audit-level=high`: **no vulnerabilities**;
- container image pins: **4 passed, 0 failed (7 assertions)**;
- `git diff --check 89c5889..5dd8f6c`: green.

Projection-corruption controls also made the focused suite red as expected: reversed
Order419 ItemList projection **4/2**, Order422 buyer-as-seller projection **5/1**,
Order423 VAT-for-GST projection **5/1**, and Order420 item-as-ValDtls projection
**4/2**. Those checks prove exact child projection bytes are asserted, but they do
not cure the nested lineage fail-open condition.

## Restoration and scope audit

All reviewer mutations were restored. SHA-256 after restoration is:

- assembly: `8144ABD60D6C974BCE621C12B9D80BC6467267052202C1FDE4EB062A8E2A110C`;
- Order419 child: `D71CEDD58EEA2DD8CC9499D92DC0F0E664562E98FF1D928DA8F6B84D1E728B30`;
- Order420 child: `3CEE4F51B043717085243A7EE498BA2AAB7A35F9F2EBB2F4D0611D09464C47FF`;
- Order422 child: `E37EE60C042EDE40344EA3EB3070AC90EA5F9E7DB5135BD42E3A566C6354442E`;
- Order423 child: `493E2A0FA007A24088B5723ACB2AA1666437C109FDCBA056D568BAADC1501937`.

The exact reviewed range changes only Order424 governance/docs, one pure Tax-Fiscal
module, its bounded-context export and two tests. `migrations/`,
`tests/schema/expected.sql`, `package.json` and `bun.lock` are byte-identical at base
and candidate. No PostgreSQL, Docker, WSL or local app was started or mutated;
`.yellow/` remained untracked and untouched.

This rejection makes no finding against the separately approved child composers. It
grants no document, provider, API/UI, local, deployment, merge, push, Phase 7 or
application-completion authority.
