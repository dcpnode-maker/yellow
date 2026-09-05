# Order 310 — independent Tier-3 rereview

**Verdict:** APPROVED
**Reviewer:** fresh non-implementing OpenAI Codex Tier-3 rereviewer `/root/order309_fresh_tier3_review`
**Candidate:** `41fb7f01263476aa524106aef6ea7c1470c02eee`
**Remediated parent:** `d5ee24c7b4cbd08a379342f0bc268b1bed2503d0`
**Approved base:** `dc528552d158099f5775181b5f93c3dc70871271` (Order309 governance head)
**Date:** 2026-09-01

## Independence and scope

I implemented none of the Order310 source or proof. I inspected the exact clean branch,
ancestry and complete diff after reading PROJECT.md, state, the order and D858-D859.
The candidate adds one pure five-field component-identity evidence composer, its export,
permanent proof and bounded documentation. It changes no migration, schema, RLS, grant,
seed, role, database adapter or writer path.

The result re-runs complete Order309 ancestry, requires insertion-byte equality, keeps
the aggregate GST_ROOM schedule once at envelope level and derives only `[igst]`,
`[cgst,sgst]` or `[cgst,utgst]`. Dual families expose no component rate, value, amount,
rounding or residual authority.

## Reviewer-executed mutation proof

The initial review rejected exact parent `d5ee24c7...` because removing `tenantId` from
the final evidence-hash preimage left the focused proof green. Before that rejection I
personally confirmed that each of these source mutations made the permanent proof red:

- bypass complete Order309 rederivation: **4 pass / 2 fail, 108 assertions**;
- replace insertion-byte equality with order-insensitive equality: **5/1, 114**;
- swap CGST/SGST tuple order: **5/1, 114**;
- swap CGST/UTGST tuple order: **5/1, 119**;
- allow the sole-component marker for CGST+SGST: **4/2, 103**; and
- attach duplicate aggregate schedules as `componentRate` under dual identities:
  **4/2, 105**.

Candidate `41fb7f0...` adds exact tenant-bound hash assertions. I personally changed
`digest({ tenantId, ...body })` to `digest(body)` in production and reran the permanent
proof. It failed red at **5 pass / 1 fail, 102 assertions** on the exact expected hash.
I restored the source through an explicit reverse patch. `git diff --exit-code` passed,
and source blob `8b141955d0fc62411bd47c61e943bf56b87977c0` and proof blob
`493edb7baed6b935a5c136f816e7c3d1494806ea` exactly matched HEAD.

## Reviewer-executed gates

- Focused Order310 plus adjacent Orders309/308: **25 passed, 0 failed, 369 assertions**.
- Full standing with a 30-second per-test timeout: **1,124 passed, 0 failed, 890
  expected skips, 17,117 assertions**, 2,014 tests across 365 files.
- `bun run typecheck`: passed.
- Import boundaries: **127 TypeScript files scanned**, passed.
- Licence policy: **23 installed packages**, passed.
- `bun audit --production`: **no vulnerabilities found**.
- `git diff --check`, ancestry, scope, clean restoration and protected-path inspection:
  passed. The ancestry is exactly admission `48bcca3`, intentional red `24b8ee2`, build
  `d5ee24c`, and tenant-hash proof remediation `41fb7f0` over approved base `dc52855`.
- No migration/schema/referee/database/seed/role path changed, so approved D844
  preservation evidence (**59 migrations, 110 public tables, referee 11/11**) remains
  governing without database contact.

## Verdict

Exact candidate `41fb7f01263476aa524106aef6ea7c1470c02eee` is **APPROVED** with
no finding. Approval is limited to frozen tenant-hidden levy-component identity and
single aggregate-schedule evidence. It grants no taxable-value or slab selection,
component numeric split/rate/amount, rounding/residual, Section14/calendar,
zero-rating, posting/correction, item/document/IRP, API/UI, local promotion, merge,
deployment, Phase-7 completion or application-complete authority.
