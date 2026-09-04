# Order 425 — Fresh independent non-implementing Tier-3 review

**Verdict:** CHANGES REQUIRED — D1278

**Candidate:** `8ba86b9` over approved base `b39c64c`

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
