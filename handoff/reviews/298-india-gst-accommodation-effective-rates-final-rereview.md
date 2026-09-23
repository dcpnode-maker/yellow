# Order 298 final fresh independent Tier-3 re-review

**Reviewer:** `/root/order298_approval_review`, fresh non-implementing OpenAI Codex agent

**Candidate:** `c07d21423859ab4d9aceace5eb575a2faee8f5f6`

**Approved base:** `7d41ebe4070c8f6deb6a679eba3dabbc4fa8df14`

**Prior rejected candidates:** `4fc3b0eb9c638f9e3e016cb91a9bc3cb6c733eb8`,
`d2769de7360000f043d5dd9585e977588e5c00ab`

**Result:** **APPROVED**

## Independence and statutory result

I did not implement or previously review Order 298. I read `PROJECT.md`, ran
`state.sh`, read the Phase-7 governance, Yellow compliance and PostgreSQL skills,
Order 298, D-810 through D-815, and both prior Order 298 reviews. The authoritative
worktree was clean, on the named branch, and exactly at the candidate before proof.

I personally checked these official Government of India sources:

- GST Council-hosted Notification 20/2019-Central Tax (Rate):
  https://gstcouncil.gov.in/sites/default/files/2024-05/download_2024-05-17t162415.971.pdf
- CBIC Notification 04/2022-Central Tax (Rate):
  https://cbic-gst.gov.in/pdf/central-tax-rate/04_2022-ctr-eng.pdf
- current CBIC services-rate table:
  https://cbic-gst.gov.in/hindi/gst-goods-services-rates.html

Notification 20/2019 gives ordinary hotel accommodation above INR 1,000 through
INR 7,500 per unit per day 6% CGST with condition `-`, and accommodation above
INR 7,500 9% CGST with condition `-`, effective 1 October 2019. Notification
04/2022 omits exemption serial 14 from 18 July 2022. The current table consequently
gives 6% + 6% = 12% through INR 7,500 and 9% + 9% = 18% above, with no no-ITC
condition on either accommodation row. The adjacent 5% restaurant row expressly
carries the no-ITC condition. Candidate seed, documentation, evaluator and quote
fixtures are therefore correct to mark both ordinary accommodation bands
`itc_eligible:true`.

## Reviewer-executed regression and mutation proof

The exact candidate focused intentional/evaluator/quote suite passed **24/0 with 94
expectations**. It rejects zero under the existing positive-minor-unit policy, then
proves INR 0.01, 1,000, 1,001 and 7,500 at 12%, and INR 7,501 at 18%, in both the
pure evaluator and quote preview. Mixed room nights remain evaluated per unit per
day, never by stay average.

I created one detached disposable worktree at the exact candidate and changed only
one canonical ITC flag at a time. Every mutation was restored before the next:

| Mutation | Exact intentional-proof result |
|---|---:|
| Canonical seed 12% ITC `true -> false` | `0 pass / 1 fail / 1 expectation` |
| Canonical seed 18% ITC `true -> false` | `0 pass / 1 fail / 2 expectations` |
| `docs/EXTENSIONS.md` 12% ITC `true -> false` | `0 pass / 1 fail / 8 expectations` |
| `docs/EXTENSIONS.md` 18% ITC `true -> false` | `0 pass / 1 fail / 9 expectations` |

After exact restoration, the standalone regression passed **1/0 with 13
expectations** and the disposable worktree was removed. This independently closes
the sole D-814 blocker and proves that both canonical 12%/18% seed and documentation
flags are permanently bound.

## Other reviewer-executed evidence

- Fresh isolated canonical `./setup.sh --db-only`: all **58 migrations**, exactly
  **110 public tables**, referee **11 passed / 0 failed of 11**.
- Fresh live seed: `in-gst-lodging`, version 1, effective
  `[2026-01-01 00:00:00+00,)`, tax-exclusive, document-rounded,
  transaction-value/room-revenue-only, with exact rows
  `750000|0.12|true` and `unbounded|0.18|true`.
- Full standing suite: **1050 pass / 0 fail**, 880 expected database skips,
  **16,008 expectations**, 1,930 tests across 341 files.
- TypeScript, 120-file import boundaries, 23-package licence policy and dependency
  audit are green; zero vulnerabilities.
- The approved base is an ancestor. The exact candidate range changes only the 17
  order-admitted seed/docs/evaluator/quote/QA, bounded planning/governance and prior
  review paths. No migration, source, dependency, Compose or schema-mirror path
  changed. Exact-range `git diff --check` and the authoritative worktree are clean.
- Unrelated generic evaluator, restaurant, UAE and Saudi behavior remains outside
  and unchanged. The isolated review containers, volume and network were removed.

## Verdict and boundary

Exact candidate `c07d21423859ab4d9aceace5eb575a2faee8f5f6` is **APPROVED** with
no finding. Approval is limited to the effective-dated 2026 ordinary-accommodation
12%/18% extension content and its exact boundary/ITC proof. It grants no integration,
merge, local promotion, deployment, section 14, SEZ zero-rating, levy decomposition,
document, IRP, API/UI, downstream fiscal, Phase-complete or application-complete
authority.
