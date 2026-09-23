# Order 091 — Canonical RMS room-economics metric contract

**Phase:** 4 · Cross-cutting RMS foundation while the reservation privilege/security floor remains open
**Branch:** `phase-4/rms-economic-metric-contract`
**Base:** `phase-4/portable-ai-provider-contract` at `2eb0305`
**Tier:** 3 — canonical commercial-money semantics consumed by future models and decisions
**Written by:** OpenAI Codex, founder-authorized temporary architect/builder under D-95/D-115/D-221

## Outcome

Give every future RMS model, backtest, channel/campaign analysis and group-displacement workflow one
executable meaning for gross booked room revenue, net room revenue, contribution and
displacement-adjusted value. The contract uses exact signed-range bigint minor units in one currency,
names every included variable-cost component, fixes the denominator to occupied room nights, retains
exact quotient/remainder ratios instead of floating-point averages, and compares contribution to a
server-supplied minimum acceptable contribution/bid price without rounding.

This is a pure calculation and evidence boundary. It does not forecast demand, estimate a cost,
select a model, infer causality, access PostgreSQL, post accounting, calculate tax, recommend a rate,
decide campaign participation or publish anything.

## Natural-Solution Test

- Order 067/068 already produce exact gross room/package/promotion price evidence and Order 070 can
  consume governed RMS amounts, but nothing defines economic deductions or denominators.
- Put one pure module behind the existing Rates public surface. Future data-readiness/model/channel
  orders may supply components, but none may redefine the arithmetic or silently omit a cost.
- Preserve signed outputs because unprofitable business must remain visible. Inputs representing
  revenue or costs stay non-negative; subtraction may produce a negative net/contribution/value.
- Express per-room-night values as exact rational evidence: signed numerator minor units, positive
  integer occupied-room-night denominator, truncating quotient and exact remainder. UI-specific
  display rounding remains a later presentation decision.

## Scope

- `handoff/orders/091-rms-economic-metric-contract.md`
- `src/contexts/rates/economics.ts`
- `src/contexts/rates/index.ts`
- `tests/rms-economics.test.ts`
- `docs/RMS-ECONOMICS.md`
- `src/project-status.ts`
- `tests/founder-status.integration.test.ts`
- `handoff/GATE-3-MANIFEST.md` only after every proof is green
- `handoff/LEDGER.md`
- `DECISIONS.log` only after every proof is green

## Required work

1. Commit this order and a focused intentional-red proof importing the absent public calculator
   before production code.
2. Accept only one strict input shape with:
   - uppercase three-letter currency;
   - positive safe-integer occupied room nights;
   - exact non-negative signed-range bigint gross booked room revenue;
   - exact non-negative signed-range bigint hotel-funded campaign discount, OTA/channel commission,
     transaction/payment fees, expected cancellation/no-show/refund cost and other variable
     distribution costs;
   - exact non-negative incremental servicing cost and displaced contribution opportunity cost;
   - optional exact non-negative minimum acceptable contribution per occupied room night; and
   - the fixed tax basis `room_revenue_excluding_taxes`.
3. Fail closed on unknown/missing fields, number/string money, invalid currency/counts, negative
   inputs and every intermediate signed-bigint overflow/underflow.
4. Return a deeply frozen version-1 snapshot containing:
   - exact component and total distribution costs;
   - gross, net, contribution and displacement-adjusted totals;
   - exact rational per-occupied-room-night evidence for all four totals; and
   - when a bid price exists, its exact required total, signed surplus/shortfall and boolean result.
5. Provide a deeply frozen transport-evidence projection that renders every bigint as a canonical
   base-10 string and preserves the schema version, currency, tax basis, denominator semantics and
   explicit statement that fixed hotel costs are excluded.
6. Document exact inclusions and exclusions, distinguish this arithmetic from estimation, tax and
   accounting, and name the later data-readiness, channel economics, causal measurement, bid-price
   estimation, model/backtest, group and distribution orders that must supply authoritative inputs.
7. Run focused/default proofs, typecheck, boundaries, licence/audit, exact schema, isolated Phase-3
   gate, protected hashes and fresh app-never-started `./setup.sh --db-only` at 11/11. Record Order
   091 as UNVERIFIED debt, refresh Graphify, rebuild only the founder app, open a stacked draft PR
   and require green replacement final-tip CI. Do not merge.

## Canonical arithmetic

All operands are exact minor units in the same declared currency:

```text
distribution_cost = campaign_discount + commission + payment_fees
                  + expected_cancellation_no_show_refund_cost + other_variable_distribution_cost
net_room_revenue  = gross_booked_room_revenue - distribution_cost
contribution      = net_room_revenue - incremental_servicing_cost
displacement_value = contribution - displaced_contribution
required_bid_total = minimum_contribution_per_room_night × occupied_room_nights
bid_surplus_or_shortfall = contribution - required_bid_total
```

The bid-price comparison uses contribution, not displacement-adjusted value, because the supplied
bid price is itself the shadow price/opportunity-cost threshold. A future caller that derives the
bid price must not also pass the same opportunity cost as displaced contribution for that decision.
The snapshot keeps both values so group/portfolio analysis can report displacement separately.

## Forbidden

- Any edit under `migrations/`, `tests/run_invariants.py`, schema snapshots, Compose, CI, package or
  lock files; any database query, table/column/extension, fact, event, state, route, worker, cache,
  permission, RLS/tenant, occupancy, reservation, idempotency or authentication change
- Journal/posting/document/payment/tax/fiscal/statutory calculation or representing this snapshot as
  recognized accounting revenue, profit, a tax basis or a legally issued figure
- Floating-point money, JavaScript-number money, cross-currency arithmetic, FX, implicit currency
  conversion, hidden rounding, major-unit formatting or an ambiguous bare `ARR` output
- Estimating commission, discount, fees, cancellation probability, servicing cost, displacement,
  demand, conversion, causal uplift, bid price, sale probability, confidence or model quality
- A channel capability, OTA/campaign registry, promotion stacking decision, rate recommendation,
  group accept/reject, campaign enable/close, automatic action, rate mutation or distribution publish
- Fixed hotel costs in net room revenue, arbitrary catch-all deductions beyond the named bounded
  component, double-counting the bid price and displaced contribution, or suppressing a negative value
- AI/model-provided authority, persistence, fabricated review/approval, self-merge or advancing
  independent review beyond Order 044

## Pre-registered proof

### P0 — intentional red

Import `calculateRmsRoomEconomics`, `rmsRoomEconomicsEvidence`, `RmsEconomicsError` and
`RMS_ROOM_ECONOMICS_BASIS` from the Rates public surface. Before production code, the focused test
must fail because those exports do not exist.

### P1 — exact inclusions and denominator

For four occupied room nights and non-even component values, prove every named distribution cost,
their total, gross/net/contribution/displacement totals and exact quotient/remainder identities.
Recompose every ratio as `quotient × denominator + remainder = numerator`; no float exists.

### P2 — losses and bid-price comparison

Prove deductions greater than gross remain signed negative values. Compare contribution against bid
price by exact total multiplication, including exact equality, one-minor-unit surplus and one-minor-
unit shortfall. Prove displacement does not silently alter that comparison.

### P3 — strict and overflow-safe

Reject missing/unknown fields, wrong tax basis, invalid currency/count, number/string/negative or
out-of-range money, component addition overflow, signed subtraction underflow and bid multiplication
overflow. Rejected input produces no partial mutable object.

### P4 — immutable transport evidence

Prove the snapshot and transport evidence are recursively frozen; all bigint leaves become canonical
decimal strings; exact schema/basis/denominator/exclusion language remains present; JSON serialization
succeeds without bigint loss; unsupported input objects are not mutated.

### P5 — standing evidence

The complete existing suite, exact schema, isolated Phase-3 gate, protected hashes and fresh referee
remain green. Graphify stays disposable and the localhost provider/status behavior remains unchanged
except that the honest current built order/debt counters advance after the manifest row exists.

## Definition of done

- [x] P0 is committed red before production code.
- [x] P1–P4 are green with exact bigint/rational evidence and no persistence or authority.
- [x] Documentation names all inclusions, exclusions and deferred estimation/governance boundaries.
- [x] P5 and both protected hashes remain exact.
- [x] Order 091 is recorded as UNVERIFIED review debt; no approval or merge is claimed.

## Builder evidence — UNVERIFIED

- Intentional red commit `8c863e3`: 0 pass, 1 fail and 1 import error because the public RMS
  economics exports did not exist.
- Implementation `51d46f7`, hardened at `5d3f137`: P1–P4 pass 4/4 with 74 assertions. Transport
  evidence recomputes and rejects forged or shallow snapshots before rendering bigint strings.
- Fresh exact tip `5d3f13772b94426d7b79d040cd42a03cab39326c`: native Linux standing suite 117
  pass / 0 fail / 326 database skips / 1,528 assertions; typecheck, 58-file import-boundary check,
  licence policy and `bun audit` are green.
- A Windows-hosted founder-status attempt hit the inherited Bun glob NUL-path defect before its
  assertion; the same working tree passed the focused status/economics set 6/6 under native Linux
  Bun. This platform precondition failure is retained rather than reported as a product test result.
- Fresh Compose project `yellow-order-091-proof`, with the app never started: schema exact,
  deployment acceptance 4/4, isolated Phase-3 gate 13/13 suites and referee 11/11. The first schema
  invocation lacked the Compose project identity and could not run; after declaring the exact
  precondition, the complete database-proof sequence restarted from its first check.
- Protected SHA-256 hashes remain exact: `migrations/0001_init.sql`
  `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923` and
  `tests/run_invariants.py` `3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1`.
- Disposable code-only Graphify map: 2,263 nodes, 6,478 directed edges and 112 communities; zero
  missing, dangling, self-loop, duplicate or collapsed endpoints. It intentionally omits 411
  semantic files and eight SQL files because `tree_sitter_sql` is unavailable.
- This is builder evidence only. Independent review remains through Order 044; no merge is claimed.

---

## MERGED

Prepared for the founder-authorized cumulative integration from exact reviewed frontier `bc22a9d`. This marker becomes true when the cumulative integration PR lands in `main`; review provenance remains in `handoff/reviews/` and `handoff/LEDGER.md`.
