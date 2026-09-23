# Order 308 — independent Tier-3 rereview

**Verdict:** APPROVED-D851
**Reviewer:** fresh non-implementing OpenAI Codex Tier-3 rereviewer
**Candidate:** `b6590425c563a0da17517454c7b028dc282cba58`
**Rejected candidate:** `8a02c464`
**Approved base:** `0659658` (Order307 governance head)
**Date:** 2026-08-31

## Independence, rejected history and boundary

I implemented none of Order 308. The first fresh review correctly rejected candidate
`8a02c464`: after recomputing both `candidateJson` and the tenant-bound candidate hash,
it accepted a `regular` taxpayer paired with `sez_unit` status. D850 records that
history without converting the rejected candidate into approval. The remediation adds
exact regular-to-affirmatively-non-SEZ and SEZ-type-to-identical-SEZ-status checks for
both supplier and recipient, plus permanent hostile proof.

The reviewed range is confined to the pure tax-fiscal component-family module, export,
tests, bounded documentation and governance. It derives only `igst`, `cgst_sgst` or
`cgst_utgst`; codes 04/26/31/35/38 are UTGST-side and 01/07/34 are State-tax-side.
There is no SQL, migration, schema, seed, role, grant, RLS, database writer, amount,
rate, split, rounding, posting, document, IRP, API or UI authority.

## Reviewer-executed proof

- I independently disabled only the supplier pairing guard. The permanent test rebuilt
  the complete candidate JSON and tenant-bound hash, admitted the contradictory
  supplier and failed red at 8/1. After exact restoration, I independently disabled
  only the recipient guard; the analogous fully rehashed recipient contradiction also
  failed red at 8/1. Both mutations were exactly reversed and `git diff --exit-code`
  confirmed restoration to the candidate.
- Focused Order308 plus adjacent Order287 proof passed **21/0, 476 assertions**,
  including all SEZ directions, exact UTGST and State-side sets, tenant/identity/state/
  nature/basis/rule crossings, hostile shapes, recursive freeze, tenant concealment,
  evidence hashing and forbidden downstream authority.
- Full standing passed **1107/0 with 890 expected skips**, **16,824 assertions** over
  1,997 tests and 362 files. Typecheck, 125-file import boundaries, 23-package licence
  policy, zero-vulnerability audit, ancestry, whitespace/diff, scope and clean-worktree
  checks passed.
- No migration, schema, referee, seed, role or database path changed from the approved
  base. Per the order's unchanged-database path and explicit D844 preservation rule,
  D844's reviewer-approved **59 migrations / 110 public tables / referee 11/11** proof
  is retained transparently; no Docker CLI was used and no founder database was touched.

## Verdict

Exact candidate `b6590425c563a0da17517454c7b028dc282cba58` is **APPROVED-D851**
with no remaining finding. Approval is limited to frozen, tenant-hidden statutory
component-family evidence. It grants no rate/value/amount/split, posting, zero-rating,
document/IRP, API/UI, local promotion, merge, deployment, Phase-7 completion or
application-complete authority.
