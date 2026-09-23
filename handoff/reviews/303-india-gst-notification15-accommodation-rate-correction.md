# Order 303 fresh independent Tier-3 review

**Reviewer:** `/root/order303_fresh_review_retry`, fresh non-implementing OpenAI Codex agent

**Candidate:** `eb31746ab9b2e8d70dba6077e5e2970dc1d37970`

**Approved base:** `845cb82`

**Result:** **APPROVED — NO FINDING**

## Independence, lineage, scope and statutory boundary

I did not implement Order 303. I read `PROJECT.md`, `AGENTS.md`, repository state,
the Yellow compliance/entity/PostgreSQL skills, Orders 298 and 303, D-833/D-834,
the Phase-7 plan, roster/workflow, and the exact candidate diff. The specified base
is an ancestor of the candidate and the candidate worktree was clean. The candidate
changes only the 17 paths declared by Order 303; there is no migration, schema,
runtime writer, historical extension pair, section 14 composition, fiscal/API/UI,
local-promotion or downstream authority. `migrations/0001_init.sql` is unchanged and
exact-range diff hygiene passes.

I independently reviewed the official CBIC rate material for the cited rule: the
CBIC Tax Information record is `1010453`, Notification 15/2025-Central Tax (Rate),
dated 17 September 2025, effective 22 September 2025, and the official current CBIC
services-rate table identifies serial 7(i) as hotel accommodation at or below INR
7,500 and serial 7(vi)/explanation (c) as the residual above-INR-7,500 category. I
also reviewed official CBIC Notification 04/2022-Central Tax (Rate), which omits
serial 14 (the former below-INR-1,000 accommodation exemption) and makes that change
effective 18 July 2022. The candidate's two-band content therefore matches the
authorized narrow correction: 5% aggregate without ITC through INR 7,500 and 18%
with ITC above, with no nil band.

## Reviewer-executed proof

- Focused candidate proof passed `25 pass, 0 fail, 110 expect() calls`, including
  exact positive boundaries INR 0.01/1,000/1,001/7,500 at 500 basis points, INR
  7,501 at 1,800 basis points, zero rejection, per-room-night selection, exact
  document totals, quote parity, unrelated F&B/non-India preservation and read-only
  quote behavior.
- The permanent artifact proof is mutation-sensitive. In a disposable mutation
  worktree, changing the fixture lower-band `itc_eligible:false` to `true` made the
  Order303 proof fail; restoring it and changing the launch-seed threshold from
  `750000` to `750001` also made the proof fail. Both mutations were restored by
  removing the disposable worktree; the candidate worktree remained byte-clean.
- The complete standing suite passed `1068 pass, 883 skip, 0 fail`, with 16,160
  assertions across 1,951 tests and 349 files. Typecheck, 121-file import
  boundaries, 23-package license policy, and `git diff --check` passed.
- A reviewer-owned isolated Compose project `yellow-review303-fresh` on dedicated
  ports applied all 59 migrations, loaded the separate fixture database with 110
  public tables, and passed the canonical Python referee: `11 passed, 0 failed of
  11`. Schema drift against the seeded database passed. A direct live query of the
  default production seed returned exactly the two `GST_ROOM` rows:
  `upto_minor=750000, rate=0.05, itc_eligible=false`, followed by
  `upto_minor=null, rate=0.18, itc_eligible=true`.
- Migration/seed integration was also run in the isolated cluster. It passed 48/49;
  the sole failure is an inherited stale assertion in
  `tests/migrate.integration.test.ts` that expects the migration ledger/applied-file
  list to stop at 0058 while the approved base already contains migration 0059 from
  Order 299. The related database-acceptance run likewise passed 22/23 with only the
  same expected-ledger omission. These tests and migration 0059 are outside Order
  303's scope; the stale oracle was not edited or weakened. The canonical setup,
  schema check, seed, and referee all passed. This is recorded transparently and is
  not a finding against the Order303 candidate.
- The disposable PostgreSQL/Valkey containers, network, volume and mutation
  worktree were removed. The founder local runtime was not touched.

## Verdict

Exact candidate `eb31746ab9b2e8d70dba6077e5e2970dc1d37970` is **APPROVED** with no
finding. Approval is limited to the explicit 2026/default `in-gst-lodging` content
correction and its evaluator/quote/fixture/seed parity. It grants no historical
old/new version pairing, section 14 applicability or working-day calendar, rate-date
selection, levy/decomposition, posting/correction, fiscal document/IRP, API/UI,
local promotion, merge, deployment, downstream, Phase-complete or
application-complete authority.

Official sources reviewed: CBIC Tax Information Portal, record `1010453`,
Notification 15/2025-Central Tax (Rate); CBIC, Notification 04/2022-Central Tax
(Rate), <https://cbic-gst.gov.in/pdf/central-tax-rate/04_2022-ctr-eng.pdf>; and the
CBIC current services-rate table,
<https://cbic-gst.gov.in/hindi/gst-goods-services-rates.html>.
