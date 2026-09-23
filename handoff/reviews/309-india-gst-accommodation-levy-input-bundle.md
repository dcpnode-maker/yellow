# Order 309 — independent Tier-3 final rereview

**Verdict:** APPROVED-D857
**Reviewer:** fresh non-implementing OpenAI Codex Tier-3 rereviewer
**Candidate:** `7e1c5f492e2d5876935fdf1e762c07f4c27b2759`
**Approved base:** `4e1b109` (Order308 governance head)
**Rejected candidates:** `c56fd9e`, `94d5f90`
**Date:** 2026-08-31

## Independence and boundary

I implemented none of Order309. I reviewed its exact clean branch/head after reading
PROJECT.md, AGENTS.md, state, the order, D852-D856 and both rejection histories. The
first rejection found missing join-conjunct mutation sensitivity; the second found
missing D850 pairing, selected-member containment and byte-order sensitivity. Neither
rejected candidate is converted into approval by this review.

The candidate is confined to a pure four-field evidence composer and bounded exports,
tests and documentation. It performs no SQL, database, migration, schema, RLS, seed,
writer, component split, value/amount calculation, rounding, Section14/calendar,
posting, document, IRP, API or UI work.

## Reviewer-executed mutation proof

I independently mutated and ran the permanent Order309 proof for each seam separately:

- removed property and supply-date joins;
- removed jurisdiction extension-id, version and content-hash joins one at a time;
- removed the Order287 supply-nature to re-derived Order308 exact-family comparison;
- disabled the D850 supplier and recipient taxpayer-type/SEZ-status guards separately;
- retained sole whole-day containment but removed equality to the selected member; and
- replaced byte-exact family comparison with a genuinely canonical, order-insensitive
  comparison of family bodies that excluded their necessarily different evidence hashes.

Every mutation failed red at **9 pass / 1 fail**. I restored every edit through an
explicit reverse patch. `git diff --exit-code` passed and the restored blob hashes were
`56fe7f8beff5a9a9c4a5d0295056ea0a5e64bb42` (Order309 source),
`08363cdab69ae92c19088a1c93546d634e862423` (Order308 source), and
`98ce2d7cb584225968b2ac4fe72329fd80b61fa2` (permanent Order309 proof).

## Gates and preservation

- Focused Order309 plus adjacent Order308 passed **19/0, 243 assertions**.
- Full standing passed **1118/0 with 890 expected skips**, **16,991 assertions** over
  2,008 tests and 364 files using a 30-second per-test timeout. The default 5-second
  run timed out only Order239 P4 after 6.299 seconds; a 10-second full rerun timed out
  only Order195 Chromium after 12.038 seconds. Neither run had an assertion failure,
  and the 30-second run passed both slow tests.
- Typecheck, 126-file import boundaries, 23-package licence policy, zero-vulnerability
  audit, whitespace/diff, scope and protected-path checks passed.
- No migration, schema, referee, database, seed or role path changed. D844's approved
  **59 migrations / 110 public tables / referee 11/11** proof remains governing
  transparently. I used no Docker CLI and contacted no database.

## Verdict

Exact candidate `7e1c5f492e2d5876935fdf1e762c07f4c27b2759` is **APPROVED-D857**
with no product finding. Approval is limited to frozen tenant-hidden levy-input lineage
and aggregate GST_ROOM schedule evidence. It grants no component split, value, amount,
rounding, Section14, posting, fiscal/document/IRP, API/UI, local promotion, merge,
deployment, Phase-7 completion or application-complete authority.
