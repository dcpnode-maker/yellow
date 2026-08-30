# Order 298 fresh independent Tier-3 rereview

**Reviewer:** `/root/order298_fresh_rereview`, fresh non-implementing OpenAI Codex agent

**Candidate:** `d2769de7360000f043d5dd9585e977588e5c00ab`

**Approved base:** `7d41ebe4070c8f6deb6a679eba3dabbc4fa8df14`

**Result:** **CHANGES REQUIRED**

## Independence and statutory result

I did not implement Order 298 or perform its first review. I read `PROJECT.md`, ran
`state.sh`, read the Yellow compliance and PostgreSQL skills, the order, D-810 through
D-813, and the first review before executing this proof.

I personally checked the official CBIC sources used by the order:

- CBIC Central Tax (Rate) notification index entry for Notification 20/2019 and the
  official GST Council-hosted instrument copy:
  https://cbic-gst.gov.in/hindi/central-tax-rate.html
  https://gstcouncil.gov.in/sites/default/files/2024-05/download_2024-05-17t162415.971.pdf
- Notification 04/2022-Central Tax (Rate):
  https://cbic-gst.gov.in/pdf/central-tax-rate/04_2022-ctr-eng.pdf
- current CBIC services-rate table:
  https://cbic-gst.gov.in/hindi/gst-goods-services-rates.html

The current table gives hotel accommodation through INR 7,500 per unit per day
6% CGST + 6% SGST/UTGST = 12% with condition `-`, and its residual entry covers hotel
accommodation above INR 7,500 at 9% + 9% = 18% without a no-ITC condition. The
adjacent 5% restaurant row expressly carries the no-ITC condition. Notification
04/2022 omits exemption serial 14 effective 18 July 2022. Candidate content is
therefore correct to mark both ordinary-accommodation bands ITC-eligible.

## Blocking finding

D-812 required permanent exact seed/evaluator/quote proof that fails if either
accommodation band carries the wrong ITC eligibility. D-813 claims that this is now
true. The repaired test does bind both evaluator and quote fixtures, but its canonical
seed assertion binds `itc_eligible:true` only on the 12% band. Its 18% seed assertion
ends after the rate:

`expect(seedText).toContain('"upto_minor":null,"rate":0.18');`

I created a detached disposable worktree at the exact candidate, changed only the
canonical seed's 18% band from `itc_eligible:true` to `false`, and ran the Order 298
regression. It still passed **1/0 with 12 expectations**. A preliminary stronger
mutation changing the same 18% flag in both seed and extension documentation also
passed **1/0 with 12 expectations**. Thus the committed proof does not fail when the
canonical 18% accommodation band carries the wrong ITC condition, and D-813's proof
claim is not reproducible.

Required repair: make the permanent proof equality-bind the complete 18% canonical
seed fragment, including `"itc_eligible":true` (and bind the documented 18% fragment
as claimed). Rerun the focused, standing, static and fresh isolated setup/referee
proof, then obtain another fresh independent Tier-3 rereview.

## Reviewer-executed evidence

- Candidate focused intentional/evaluator/quote suite: **24 pass / 0 fail / 93
  expectations**. The existing positive-minor-unit policy rejects INR 0; exact
  INR 0.01, 1,000, 1,001 and 7,500 values select 12%, and INR 7,501 selects 18% in
  evaluator and quote-preview proof.
- Fresh isolated PostgreSQL 16.15 `./setup.sh --db-only`: all **58 migrations**,
  exactly **110 public tables**, and referee **11 passed / 0 failed of 11**.
- Fresh live seed query: immutable key `in-gst-lodging`, version 1, effective
  `[2026-01-01 00:00:00+00,)`, tax-exclusive, document-rounded,
  transaction-value/room-revenue-only; rows are exact `750000|0.12|true` and
  unbounded `0.18|true`.
- Standing suite: **1050 pass / 0 fail**, 880 expected database skips, **16,007
  expectations**, 1,930 tests across 341 files.
- TypeScript, 120-file import boundaries, 23-package licence policy and dependency
  audit are green; zero vulnerabilities.
- Approved-base ancestry, exact allowed 16-path candidate scope, clean worktree and
  `git diff --check` are green. No migration, source, dependency, Compose or schema
  mirror changed. The first review's unrelated restaurant/generic/AE/SA preservation
  remains intact; the repair changes only bounded seed/docs/proof/governance evidence.
- Both disposable mutation worktrees and the isolated Compose containers, volume and
  network were removed. No unrelated stack, local promotion or downstream action was
  touched.

## Verdict

Exact candidate `d2769de7360000f043d5dd9585e977588e5c00ab` is **CHANGES
REQUIRED** solely for the mutation-proven missing canonical 18% ITC regression. The
live statutory content, rates, boundaries, fresh seed, setup/referee, standing/static,
scope and preservation checks otherwise pass. The Order 298 final DoD checkbox stays
unchecked. No section 14, SEZ zero-rating, decomposition, document, IRP, API/UI,
local, integration, merge, deploy, downstream, Phase-complete or
application-complete authority is granted.
