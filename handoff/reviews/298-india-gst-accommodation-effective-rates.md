# Order 298 fresh independent Tier-3 review

**Reviewer:** `/root/order298_fresh_review`, fresh non-implementing OpenAI Codex agent

**Candidate:** `4fc3b0eb9c638f9e3e016cb91a9bc3cb6c733eb8`

**Approved base:** `7d41ebe5acc62ca6ae3e1b41275997b6b08130aa`

**Result:** **CHANGES REQUIRED**

## Independence and authority

I did not implement Order 298. I read `PROJECT.md`, `AGENTS.md`, ran `state.sh`,
read the Yellow compliance and PostgreSQL skills, Order 298, D-23, D-791,
D-810/D-811, and personally inspected the official Government of India rate
instruments before executing the proof below. The authoritative worktree was clean
and exactly at the candidate before reviewer-only governance edits.

Official sources checked:

- GST Council copy of Notification 20/2019-Central Tax (Rate):
  https://gstcouncil.gov.in/sites/default/files/2024-05/download_2024-05-17t162415.971.pdf
- CBIC Notification 04/2022-Central Tax (Rate):
  https://cbic-gst.gov.in/pdf/central-tax-rate/04_2022-ctr-eng.pdf
- current CBIC services-rate table:
  https://cbic-gst.gov.in/hindi/gst-goods-services-rates.html

Notification 20/2019 makes the 6% CGST hotel-accommodation entry apply above
INR1,000 through INR7,500 per unit per day with condition `-`, makes the above-
INR7,500 residual hotel entry 9% CGST with condition `-`, and applies from
1 October 2019. Notification 04/2022 omits exemption serial 14 from 18 July 2022.
The current CBIC table consequently shows 6%+6%=12% through INR7,500 with
condition `-`, and 9%+9%=18% above it. This supports the order's rate and date
boundary but exposes the blocker below.

## Blocking findings

### 1. Canonical immutable content falsely marks the 12% band as ineligible for ITC

The fresh seeded `in-gst-lodging` version and `docs/EXTENSIONS.md` both encode
`{"upto_minor":750000,"rate":0.12,"itc_eligible":false}`. That contradicts the
official rate row's condition `-`; unlike the adjacent restaurant entries, the
hotel-accommodation row carries no condition that input-tax credit must not be
taken. It also contradicts this candidate's evaluator fixture, quote fixture and
QA boundary table, all of which encode the 12% lodging band as ITC-eligible.

This is not a dormant documentation typo. The extension content is the immutable
version selected by the existing effective-dated resolver. The evaluator currently
validates but does not return `itc_eligible`, so all focused amount assertions remain
green while the selected statutory metadata is wrong. The intentional-red test
asserts only rates and removal of the stale nil/5% text; it does not bind the exact
ITC flag and therefore misses the contradiction.

Required repair: change the 12% lodging band to `itc_eligible:true` in the canonical
seed and extension documentation, retain the unrelated restaurant 5%-without-ITC
example, and add permanent exact seed/evaluator/quote proof that fails if either
accommodation band carries the wrong ITC eligibility.

### 2. The claimed clean diff gate is false

`git diff --check 7d41ebe..4fc3b0e` reports trailing whitespace on lines 3 and 4 of
`handoff/orders/298-india-gst-accommodation-effective-rates.md`. D-811 records the
diff gate as green, so the candidate evidence is not reproducible. Remove those two
trailing-space sequences and rerun the exact diff gate.

## Reviewer-executed evidence

- Historical intentional red at exact `8d8c890`: `0 pass / 1 fail / 1 assertion`;
  the stale nil/5% seed fails the new 12% expectation before correction.
- Candidate focused intentional/evaluator/quote suite: `24 pass / 0 fail / 88
  assertions`; exact positive INR0.01/1,000/1,001/7,500/7,501 selections are
  12%/12%/12%/12%/18%, and zero is rejected by the existing positive-minor-unit
  boundary.
- Fresh live seed inspection: version `1`, effective
  `[2026-01-01 00:00:00+00,)`, tax-exclusive, document-rounded, transaction-value,
  room-revenue-only 12%/18% content; it also reproduces the erroneous 12% false ITC
  flag.
- Fresh isolated PostgreSQL 16.15 canonical `./setup.sh --db-only`: 58 migrations,
  exactly 110 public tables and referee `11 passed / 0 failed of 11`.
- Standing suite: first run had one unrelated Order195 Chromium geometry failure;
  its exact isolated rerun passed `1/0/28`, and the complete rerun passed
  `1050/0` with 880 expected database skips and 16,002 assertions across 1,930 tests
  / 341 files.
- TypeScript, 120-file import boundaries, 23-package licence policy and dependency
  audit: green; zero vulnerabilities.
- Ancestry and exact 15-file declared scope are green. No migration, source,
  dependency, Compose or schema-mirror path changed. Unrelated generic evaluator,
  UAE/SA behavior and the 5% restaurant example are preserved.
- Exact-range diff check is red only for the two documented Order-header lines.
- Disposable intentional-red worktree and isolated Compose database/volume/network
  are removed after proof; no local promotion or downstream action was performed.

## Verdict and re-review gate

Exact candidate `4fc3b0eb9c638f9e3e016cb91a9bc3cb6c733eb8` is **CHANGES
REQUIRED**. Do not approve, integrate, merge, promote or deploy it. Correct the
canonical 12% ITC metadata, add exact regression proof for both accommodation-band
ITC flags, clear the whitespace gate, rerun focused/standing/setup/referee/static
proof, and request a fresh independent Tier-3 re-review. The final Order 298 DoD
checkbox remains unchecked. No section 14, SEZ zero-rating, decomposition,
document, IRP, API/UI, local, downstream, Phase-complete or application-complete
authority is granted.
