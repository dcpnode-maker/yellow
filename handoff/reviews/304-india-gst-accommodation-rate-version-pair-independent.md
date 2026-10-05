# Order 304 fresh independent Tier-3 review

**Reviewer:** `/root/order304_fresh_tier3_review`, fresh non-implementing OpenAI Codex agent

**Candidate:** `bb746f202a53bedc997519262bcffda14db7025f`

**Approved base:** `7010f75a5406b2e8580a34b225e6fcf7b8557445`

**Result:** **APPROVED — NO FINDING**

## Independence, lineage, scope and statutory boundary

I read `PROJECT.md`, `AGENTS.md`, `BUILD-PLAN.md`, the Phase-7 plan, roster/workflow,
Order304 and D-836/D-837. The exact approved base is an ancestor of the candidate,
the candidate worktree is clean, and the exact range changes only the 15 paths declared
by Order304. `migrations/0001_init.sql` and every migration are unchanged. There is no
writer, seed/history conversion, resolver change, retired-rate selection, section14
matrix, tax calculation, fiscal/API/UI, local-promotion or downstream authority.

The official sources independently reviewed were GST Council Notification 20/2019-
Central Tax (Rate), CBIC Notification 04/2022-Central Tax (Rate), and CBIC Notification
15/2025-Central Tax (Rate). Notification 20/2019 gives 6% central tax through INR
7,500 and 9% above; Notification 04/2022 omits exemption serial 14 effective 18 July
2022; Notification 15/2025 changes the lower band to 2.5% central tax without ITC
from 22 September 2025 while preserving the residual 9% central-tax band. The
candidate's aggregate 12%-with-ITC predecessor and 5%-without-ITC successor, both
with an 18%-with-ITC upper band, match the governed narrow evidence contract. The
recorded official source-byte hashes are unchanged and exact: `ee920c82c30ed88d9bb515d7d79b975cc2ed599c6dad411d04d8b7fcd5a86901`,
`c6d264f1906375e93466dd97b2c60bb9b21c0dec34b93900b15237b4a98b7716`, and
`46c9447579017d8bf1fefd75b6e6a48856dab7b23e44c7e06babfdc99ae9d289`.

## Reviewer-executed proof

- Unmodified intentional-red plus permanent focused proof passed **9/0 with 265
  assertions**. It proves exact retired-v1/active-v2 identity, lower and upper slabs,
  no nil band, canonical Kolkata cutover, every one-microsecond adjacency/malformed
  period case, status/version/owner/type/key/duplicate/visibility hostility,
  source-hash and content/evidence binding, recursive freezing and tenant concealment.
- In a separate disposable worktree, independently mutating the cutover, lower rate,
  lower ITC, threshold, upper rate, source hash, evidence-hash preimage, and serialized
  tenant concealment each made the permanent focused proof red. Restoring each exact
  source and removing the disposable worktree returned the candidate bytes to clean.
- A reviewer-owned fresh migration-only PostgreSQL database in Compose passed the
  committed live proof **2/0 with 19 assertions**. It proved both tenant-visible exact
  periods, content/source evidence, frozen tenant-hidden output, foreign-tenant
  concealment, active-only current resolver behavior, and byte-equivalent snapshots
  of extension/fact/outbox/financial/fiscal state before and after the read.
- The isolated database applied **all 59 migrations**, contained **110 public tables**,
  and passed schema drift. The canonical referee passed **11 passed, 0 failed of 11**.
  The Windows setup wrapper reached the completed migration/fixture state but stopped
  at its inherited stale 89-table assertion; direct inspection confirmed 110 tables,
  and the stale oracle was not edited or weakened.
  The standard seeded `yellow_test` run was also inspected; its inherited active seed
  jurisdiction makes the current-resolver assertion intentionally ambiguous once the
  Order304 active extension is added, so the required live proof was run and passed on
  the fresh migration-only database instead. No oracle or product code was changed.
- The complete standing suite passed **1077 pass, 885 skip, 0 fail**, **16,425
  assertions**, across 1,962 tests and 352 files. Typecheck, 122-file boundaries,
  23-package licence policy, zero-vulnerability audit, and exact-range `git diff --check`
  all passed.

Official sources reviewed: [GST Council Notification 20/2019](https://www.gstcouncil.gov.in/en/node/4523),
[CBIC Notification 04/2022](https://cbic-gst.gov.in/pdf/central-tax-rate/04_2022-ctr-eng.pdf),
and the [CBIC GST rate table](https://cbic-gst.gov.in/hindi/gst-goods-services-rates.html).

## Verdict

Exact candidate `bb746f202a53bedc997519262bcffda14db7025f` is **APPROVED** with no
finding. Approval is limited to the explicit frozen tenant-hidden retired-v1/active-v2
accommodation rate-pair evidence and its source/content/period proof. It grants no
seed/history mutation, retired-rate selection, section14/calendar, rate evaluation,
tax/decomposition, posting, fiscal document/IRP, API/UI, local promotion, merge,
deployment, downstream, Phase-complete or application-complete authority.
