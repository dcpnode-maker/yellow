# Order 303 — India GST Notification 15 accommodation rate correction

**Status:** BUILT-PENDING-FRESH-TIER3-REVIEW-D834
**Phase:** 7 — Tax and India IRP
**Branch:** `phase-7/india-gst-notification15-accommodation-rate-correction`
**Base:** `845cb82` (independently approved Order 302 governance head)
**Risk tier:** 3 — statutory launch-rate correction; fresh independent executable review mandatory

## Outcome

Supersede Order 298's now-outdated 2026 ordinary India hotel-accommodation rate
content with Notification 15/2025-Central Tax (Rate), effective 22 September 2025:
5% aggregate GST without input-tax credit where the value of one accommodation unit
per day is at most INR 7,500, and 18% above INR 7,500. Remove the stale below-INR-
1,000 nil band from the default production seed. Reuse the existing extension,
assignment, evaluator and quote architecture; add no table, migration or second tax
engine.

## Authority and exact contract

- Official CBIC Notification 15/2025-Central Tax (Rate), dated 17 September 2025,
  amends serial 7 item (i) from 22 September 2025 to 2.5% central tax subject to no
  input-tax credit; the aggregate launch rate is therefore 5% without ITC.
- The notification does not change the above-INR-7,500 residual 9% central-tax row;
  the aggregate rate remains 18% with ITC.
- Notification 04/2022 remains authoritative that the former below-INR-1,000 hotel-
  accommodation exemption is not restored.
- `in-gst-lodging` remains tax-exclusive, document-rounded, transaction-value based,
  `GST_ROOM`, and limited to `room_revenue`.
- Exact bands are `<= 750000` minor INR at 5% with `itc_eligible:false`, then 18%
  with `itc_eligible:true` and no upper cap.
- INR 0 is still not a valid positive charge line. INR 0.01, 1,000, 1,001 and 7,500
  select 5%; INR 7,501 selects 18%.
- The explicit 2026 test extension and default production launch seed must agree on
  the two `GST_ROOM` bands. Unrelated `GST_FNB` and non-India content is preserved.

## Scope

- this order, `DECISIONS.log`, `handoff/LEDGER.md`, and bounded Phase-7 plan/roadmap text;
- `tests/seed_fixture.sql` and `scripts/seed.ts` only for exact `in-gst-lodging`
  `GST_ROOM` content;
- `docs/EXTENSIONS.md`, bounded Order303 additions to `docs/CONTRACTS.md`,
  `docs/DOMAIN-MODEL-V1.md` and `docs/SECURITY.md`;
- `tests/tax-evaluator.test.ts`, `tests/rate-quote-tax-preview.integration.test.ts`,
  `tests/PMS_QA_Test_Suite.md`, and focused intentional-red/permanent Order303 proof;
- the superseded `tests/india-gst-accommodation-effective-rates.intentional-red.test.ts`
  standing assertion only, so historical Order298 expectations cannot keep the suite red;
- production-seed parity proof only where needed to bind the exact corrected bands;
- fresh independent Tier-3 review evidence.

## Forbidden boundary

No migration/schema/new table, historical predecessor version, old/new extension
pairing, runtime writer, clock/latest selection, section 14 composition or working-day
calendar, SEZ zero-rating, CGST/SGST/UTGST/IGST decomposition, invoice item/value
payload, posting/correction, fiscal document/number/hash chain, IRP submission, API/UI,
local promotion, merge/deploy or Phase/application-complete claim.

## Pre-registered proof

- **P0 red:** exact retained artifacts and boundary expectations are red before the
  correction.
- **P1 boundaries:** positive INR 0.01/1,000/1,001/7,500 select 500 basis points;
  INR 7,501 selects 1,800 basis points; zero remains rejected.
- **P2 ITC:** the lower band is independently bound to false and the upper band to
  true in both canonical fixture and default production seed.
- **P3 quote parity:** quote preview returns exact corrected component rates and tax
  totals at every boundary.
- **P4 preservation:** unrelated India F&B, non-India content, generic evaluator,
  extension selection, setup/referee and standing/static gates remain green.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Corrected fixture/default-seed boundaries and mutation-sensitive ITC proof are green.
- [x] Standing/static/setup/referee preservation gates are green.
- [ ] Fresh non-implementing Tier-3 reviewer personally executes proof and approves.

## Built evidence

- Official CBIC notification record id `1010453` names
  `15/2025-Central Tax (Rate)`, dated 17 September 2025, file
  `15-2025-CTR-eng.pdf`; the retrieved official PDF SHA-256 is
  `46c9447579017d8bf1fefd75b6e6a48856dab7b23e44c7e06babfdc99ae9d289`.
- Intentional red failed `0/1` before correction. Corrected focused proof passes
  `24/0` with 99 assertions; both historical-supersession and permanent Order303
  artifact proofs pass.
- Exact launch truth is two bands only: `<=750000` minor INR at 5%/no ITC and an
  unbounded 18%/ITC band. Live default seed returned those exact two JSON rows.
- Standing passes `1068/0` with 883 expected database skips and 16,160 assertions
  across 1,951 tests/349 files. Typecheck, 121-file import boundaries, 23-package
  licence policy, zero-vulnerability production audit and diff hygiene are green.
- Fresh disposable PostgreSQL applies all 59 migrations, reports 110 public tables
  before referee artifacts and passes referee `11/11`. The stale Windows wrapper's
  inherited 89-table assertion is recorded rather than weakened; disposable proof
  containers, network and volume were removed.
