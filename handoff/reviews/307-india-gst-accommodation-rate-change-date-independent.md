# Order 307 — independent Tier-3 review

**Verdict:** APPROVED-D847
**Reviewer:** fresh non-implementing OpenAI Codex Tier-3 reviewer
**Candidate:** `6e0824df2a6afff5a83573d463bbee4cf73b436e`
**Approved base:** `2c1edccb8a21073d25229837e07726f62a0a5936`
**Date:** 2026-08-31

## Independence, scope and statutory boundary

I implemented none of Order 307. The approved base is an ancestor of the exact
candidate. The 14-path range is confined to the order's pure tax-fiscal module,
exports, mutation-sensitive tests, bounded documentation and governance records.
There is no migration, SQL, schema, role, grant, RLS, seed, database service or
runtime-writer delta; `migrations/`, `tests/run_invariants.py` and the expected schema
snapshot are byte-identical to the approved base.

The implementation revalidates the complete approved Order304 predecessor/successor
pair and derives only `2025-09-22` from the fixed Kolkata-midnight cutover
`2025-09-21T18:30:00.000000Z`. Independent source review confirms Notification
15/2025-Central Tax (Rate), dated 17 September 2025, takes effect 22 September 2025;
the official CBIC Tax Information endpoint was identified but returned HTTP 502 to
this reviewer, so no new source-byte hash is claimed. Order304's independently
approved three source hashes are revalidated exactly rather than re-established.
No calendar, section14 applicability, tax amount, fiscal document or downstream
authority is produced.

## Reviewer-executed proof

- Clean Order307 focused/intentional-red proof passed **9/0, 91 assertions**. The
  adjacent Order304 pair unit proof passed **8/0, 258 assertions**; its two live tests
  were expected database skips in the non-database run.
- I made and exactly reversed source mutations covering tenant-bound pair-hash
  recomputation; deterministic UUID, version, status and microsecond period truth;
  complete GST_ROOM rates, threshold, ITC and nil-band flags; official source hash;
  derived date; recursive freezing; output evidence hash; and forbidden SQL. Every
  mutation made the permanent proof red. After restoration, the focused proof again
  passed 9/0 and the source bytes exactly matched the candidate.
- Full standing passed **1097/0 with 890 expected skips**, **16,743 assertions** over
  1,987 tests and 360 files. Typecheck, 124-file import boundaries, 23-package
  licence policy, zero-vulnerability audit, ancestry, whitespace/diff, exact
  restoration and scope checks passed.
- A direct official-source download attempt was network-precondition-blocked and the
  known reviewer direct-port PostgreSQL credential is precondition-blocked by 28P01
  before database creation or mutation. Database preservation is instead proven by
  exact approved-base comparison: no migration/schema/referee/database/seed/role path
  changed. D844's fresh **59 migrations / 110 public tables / referee 11/11** remains
  governing. Founder local was untouched.

## Verdict

Exact candidate `6e0824df2a6afff5a83573d463bbee4cf73b436e` is **APPROVED-D847**
with no finding. Approval is limited to frozen, tenant-hidden statutory rate-change
date evidence. It grants no working-day calendar, section14 matrix, tax calculation,
posting, fiscal document/IRP, API/UI, local promotion, merge, deployment, Phase-7
completion or application-complete authority.
