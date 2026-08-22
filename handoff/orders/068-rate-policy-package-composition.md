# Order 068 — Guest, promotion, package, policy and distribution composition

**Phase:** 3 · Universal rate plans
**Branch:** `phase-3/rate-policy-package-composition`
**Tier:** 3 — quote composition adjacent to money, restriction and compliance evidence
**Written by:** OpenAI Codex, autonomous temporary architect under D-95/D-115/D-221/D-230/D-245

## Outcome

Compose one exact Order 067 nightly price with the remaining hotel-selectable rate-plan concerns:
guest eligibility, promotion discounts, package/meal/allowance elements, refund treatment, policy
references and channel eligibility. Preserve availability, CTA/CTD/min/max-stay/advance,
operational-block and mandatory-policy evidence separately. Return an exact pre-tax subtotal or an
explicit unpriced/blocked/conflict state. This order writes nothing and cannot publish or sell.

## Natural-Solution Test

The baseline already has policy, package, package-element, promotion, restriction and distribution
tables, while Orders 032/035/036 provide typed policy and restriction truth. Implementing a second
database model here would pre-empt the atomic version/publish unit reserved for Order 069. Order 068
therefore adds a strict pure composition AST and consumes attributable evidence supplied by a later
tenant-scoped quote binder. It never queries, mutates or substitutes for canonical policy,
restriction, occupancy or availability state.

## Scope

- `src/contexts/rates/composition.ts`
- `src/contexts/rates/index.ts`
- `src/contexts/rates/evaluators.ts` only for Question 113's explicit-null idempotence correction
- `docs/CONTRACTS.md`
- `tests/rate-composition.test.ts`
- `tests/rate-evaluators.test.ts` only for Question 113's normalized-input regression assertion
- `src/project-status.ts` only for the exact completed-order and Gate-3 debt counters
- `tests/founder-status.integration.test.ts` only for the exact current-order assertion
- `handoff/orders/068-rate-policy-package-composition.md`
- `handoff/questions/110-order-068-composition-boundaries.md`
- `handoff/questions/110-ARCHITECT-RESPONSE.md`
- `DECISIONS.log`
- `handoff/LEDGER.md`
- `handoff/GATE-3-MANIFEST.md`
- further numbered D-92 question/response files only if a hard-floor condition occurs

## Required implementation

1. Add one strict frozen composition spec with exact currency, guest eligibility, optional package,
   0–50 uniquely keyed promotions, policy configuration and distribution configuration. Unknown
   fields, ambiguous null/empty values, duplicate keys/codes and unsafe counts fail.
2. Guest eligibility has inclusive adult, child and total-guest integer ranges. Runtime guest mix is
   1–99 adults plus 0–30 child ages 0–17 in caller order; eligibility failure returns unpriced and
   never changes availability.
3. An optional versioned package has stable key/version, explicit `included_in_rate`, and 1–100
   uniquely keyed elements. Each element has exact kind (`meal | allowance | service`), hotel code,
   rhythm (`per_stay | per_night | per_person | per_person_night`), non-negative bigint minor amount
   and matching currency. Quantities derive only from local LOS and guest count. Included allocation
   is evidenced but not added and may not exceed the room amount; extra package amount is added.
4. Promotions are selected explicitly by stable code. Each has version, stage 1–8, priority 0–1000,
   scope (`room | room_and_extras`) and an exact discount (`amount` bigint or integer basis points
   0–10,000). Within a stage one uniquely highest priority wins; equal top priority conflicts with
   sorted keys. Apply stages numerically with half-up bigint rounding and never below zero.
5. Policy configuration has exact optional cancellation, deposit, guarantee and no-show UUIDs plus
   `refund_treatment` (`policy | non_refundable`). Runtime evidence must contain one exact matching
   typed id/evidence reference for every configured policy and no duplicate kind. Mandatory policy
   evidence is runtime-owned, always retained and cannot be removed by hotel configuration.
6. Distribution configuration is exact `all | allowlist | denylist` over 0–100 lowercase channel
   codes. Runtime supplies one channel code and an attributable mapping evidence reference for every
   non-`direct` channel. Ineligible channels return unpriced; distribution never changes physical
   capacity or restriction evidence.
7. Runtime availability evidence is strict and frozen: sellable id, non-negative available count,
   `bookable`, ordered restriction and operational-block evidence, plus evidence reference. A true
   blocker or zero capacity cannot claim `bookable=true`. If `bookable=false`, composition returns
   blocked with all causes unchanged regardless of price, promotion or package settings.
8. Accept only a frozen internally consistent Order 067 result. Propagate its unpriced/conflict
   state and evidence. A priced result must have exact matching currency and bigint amount. Return
   frozen exact room amount, included allocation, package extra, promotion discount, pre-tax
   subtotal, selected promotion keys, policy/mandatory/restriction/operational/distribution evidence
   and deterministic work units. Tax is deliberately absent.

## Forbidden

- Any file under `migrations/`, especially `migrations/0001_init.sql`; schema snapshots or
  `tests/run_invariants.py`
- Database reads/writes, extension storage, facts, outbox events, permissions, routes, UI, workers,
  cache, adapters, dependencies, approval, publication, activation, undo or any state transition
- Re-evaluating, suppressing or mutating restrictions, CTA/CTD, min/max stay/advance, OOO/OOS,
  occupancy claims, overbooking, availability or property/channel authority
- Tax, statutory, fiscal, journal, FX, payment, refund execution, cancellation execution,
  distribution writes or RMS/API behavior
- JavaScript-number or floating-point money; negative package prices; implicit promotion stacking;
  arbitrary formulas or hotel code; treating a package allowance as ledger posting
- Treating builder assertions as independent review; approval or merge by Codex

## Pre-registered proof

- **P0 (red first):** focused tests fail before production edits because composition exports do not
  exist. Preserve exact red output.
- **P1:** every package rhythm produces exact quantities/amounts for guest and DST-local LOS;
  included/extras remain distinct; currency, overflow, count and over-allocation fail closed.
- **P2:** amount and basis-point promotions round exactly, stage numerically, ignore unselected codes,
  reject float money and return sorted conflicts for equal top priority.
- **P3:** guest ranges, policy ids/evidence, refund treatment and mandatory evidence normalize exactly;
  missing/mismatched/duplicate/extra inputs fail without mutation.
- **P4:** closed/CTA/CTD/min/max-stay/advance and OOO/OOS evidence remains byte-equivalent; any blocker
  or zero capacity returns blocked even with a valid price and promotion.
- **P5:** all/allowlist/denylist and direct/non-direct mapping evidence are exact; a denied channel is
  unpriced without changing availability evidence.
- **P6:** Order 067 priced/unpriced/conflict results propagate exactly; output is frozen, pre-tax only,
  deterministic across package/promotion/evidence input order and contains no tax or sellability
  override.
- **P7:** 25 versus 50 promotions and 50 versus 100 package elements expose bounded work below 2.2×
  growth for each N/2N comparison.
- **P8:** frozen install, typecheck, boundaries, all default tests, licence, audit, schema drift,
  protected hashes and fresh app-never-started referee remain green.

## Standing and handoff

Commit this order before the test. Preserve P0 before production edits. This pure order needs no
focused database. Restart the entire focused file after every correction, then run the complete
standing gate and fresh isolated `./setup.sh --db-only` with the app never created. Do not rebuild
or reseed the founder's persistent stack because there is no runtime route/UI. Refresh Graphify
structurally, append one UNVERIFIED Gate-3 row, advance only the exact founder-status counters, commit
`[codex]`, push and open a draft stacked PR against Order 067. Do not approve or merge.
