# Order 067 — Typed exact-money rate-model evaluators

**Phase:** 3 · Universal rate plans
**Branch:** `phase-3/typed-rate-evaluators`
**Tier:** 3 — money, derivation and occupancy-responsive pricing that later quotes will trust
**Written by:** OpenAI Codex, autonomous temporary architect under D-95/D-115/D-221/D-230/D-242

## Outcome

Provide one canonical, pure evaluator for the configurable pricing families selected in Order 065:
simple fixed, calendar, BAR ladder, derived, room matrix, occupancy/LOS, contract/negotiated and
expert composition. Hotels may combine bounded date, DOW, booking-window, LOS, occupancy and target
conditions, exact replacements, signed-amount adjustments, basis-point adjustments, floors,
ceilings and explicit overrides. The evaluator returns exact money plus attributable rule/reference
evidence or an explicit unpriced/conflict result. It writes nothing and cannot publish a rate.

## Natural-Solution Test

This order is pricing computation, not persistence. Existing insert-only `rate_price` remains the
current authoritative manual/calendar money primitive; Orders 065 and 066 retain immutable model and
target drafts. Adding another table or storing unsafe money in a generic extension would create a
second truth before the publish/quote contract exists. Therefore Order 067 adds a strict in-process
AST normalizer and evaluator only. Order 069 will persist one complete versioned draft/publish unit,
and Order 070 will bind evaluator inputs to tenant-scoped price/reference evidence. Runtime money is
`bigint`; no JSON/HTTP number boundary is authorized here.

## Scope

- `src/contexts/rates/evaluators.ts`
- `src/contexts/rates/index.ts`
- `docs/CONTRACTS.md`
- `tests/rate-evaluators.test.ts`
- `src/project-status.ts` only for the exact completed-order and Gate-3 debt counters
- `tests/founder-status.integration.test.ts` only for the exact current-order assertion
- `handoff/orders/067-typed-rate-model-evaluators.md`
- `handoff/questions/107-order-067-evaluator-boundaries.md`
- `handoff/questions/107-ARCHITECT-RESPONSE.md`
- `DECISIONS.log`
- `handoff/LEDGER.md`
- `handoff/GATE-3-MANIFEST.md`
- further numbered D-92 question/response files only if a hard-floor condition occurs

## Required implementation

1. Add a strict canonical evaluator spec with exact `modelKey`, uppercase three-letter `currency`,
   one base, one optional common temporal gate, 0–200 uniquely keyed adjustment rules, optional
   floor/ceiling and no unknown fields. Normalize keys and arrays deterministically and return frozen
   typed values. Inputs for guided, expert and future AI authoring use this one shape.
2. Base is a strict union:
   - `fixed` — one non-negative signed-bigint amount;
   - `calendar` — 1–731 unique sorted local-date cells, each exactly `open` plus bigint amount or
     `closed` without an amount;
   - `reference` — exact `bar` or `parent` source kind, stable source id and positive version. The
     matching runtime reference supplies bigint amount, currency and the same id/version.
3. An adjustment is exactly `replace` with non-negative bigint, `delta` with signed bigint, or
   `basis_points` with integer value from -10,000 through 100,000. Percentage math multiplies exact
   bigint first and rounds the non-negative result to nearest minor unit, ties upward. Negative or
   signed-bigint-overflow results fail; no float or JavaScript number may carry money.
4. A rule declares stable lowercase key, stage, priority 0–1000, one adjustment, optional
   `target_rule_key`, and a strict condition object over half-open local stay dates, DOW mask 1–127,
   inclusive booking-window/LOS/occupancy-basis-point ranges and canonical BAR level. Empty or
   inverted ranges reject. A common gate uses the same temporal conditions except target/BAR.
5. Derive local booking/stay dates, nightly DOW, booking-window days and LOS from exact UTC instants
   plus an IANA property timezone. The requested local night must fall inside the local half-open
   stay. DST boundaries use local calendar dates, never fixed 24-hour division. Occupancy is optional
   0–10,000 basis points and, when present, requires a bounded evidence reference.
6. Match conditions conjunctively. Within a stage, a target-bound rule beats an unbound rule, then
   more constrained condition dimensions win, then one uniquely higher priority wins. Equal top
   tuples return a conflict with sorted rule keys. Non-expert models require stage 1; expert
   composition allows stages 1–8 and applies at most one winning rule per stage in numeric order.
7. Order 066 targeting evidence is accepted only as its exact frozen result shape. A targeting
   conflict propagates as a pricing conflict; `excluded`/`not_applicable` yields unpriced. A
   `target_rule_key` matches only the included winning key. Room-matrix rules require target keys;
   contract/negotiated specs require 1–100 eligible target keys. The evaluator never reimplements
   physical/commercial precedence.
8. Enforce exact model contracts: simple fixed uses fixed base; calendar uses calendar base; BAR uses
   a bar reference and BAR-conditioned rules; derived uses a parent reference; every room-matrix rule
   is target-bound; occupancy/LOS rules contain at least one booking-window, LOS or occupancy bound;
   contract/negotiated requires target eligibility; expert composition may use the registered base
   and rule features. Package and RMS/API model keys fail as deferred, not inferred.
9. After base and staged adjustments, apply floor then ceiling as guards and return exact amount,
   currency, base/reference evidence, applied rule keys, applied guards and deterministic work-unit
   count. Closed/missing calendar cells, unmatched common gate or ineligible targeting return
   `unpriced`, never “closed inventory.” The same historical parent id/version/amount always returns
   the same derived output after a newer parent context exists.

## Forbidden

- Any file under `migrations/`, especially `migrations/0001_init.sql`; schema snapshots or
  `tests/run_invariants.py`
- Database reads/writes, extensions, facts, outbox events, permissions, routes, UI, workers, cache,
  adapters, dependencies, publication, approval, activation, undo or any state transition
- Creating, releasing or interpreting occupancy claims; availability or restriction evaluation;
  overbooking; allowing price logic to create sellability
- Tax, fiscal, journal, statutory, FX, package, meal, promotion, refund/cancellation, CTA/CTD,
  distribution or RMS/API behavior
- JavaScript-number or floating-point money; opaque formulas; executable hotel code; implicit
  stacking; order/key/JSON iteration as a winner; mutable history
- Treating builder assertions as independent review; approval or merge by Codex

## Pre-registered proof

- **P0 (red first):** focused tests fail before production edits because evaluator exports do not
  exist. Preserve exact red output.
- **P1:** bigint max, unsafe-number-range amounts, signed deltas, basis-point half cases,
  floor/ceiling and overflow/negative boundaries are exact; every number/float money input rejects.
- **P2:** UTC instants crossing DST and local midnight derive exact stay/booking dates, DOW, LOS and
  booking window; invalid timezone/instant/night/range input fails closed.
- **P3:** all seven direct models plus expert composition accept only their documented base/rule
  shapes; calendar open/closed/gaps, BAR levels and every malformed/extra/duplicate boundary are
  explicit. Package and RMS/API reject as deferred.
- **P4:** every rule-array permutation yields the same result; specificity/priority selects one;
  equal top tuples conflict with sorted keys; expert stages compose only numerically.
- **P5:** parent id/version/currency mismatches reject, newer parent evidence changes only the new
  evaluation, and replaying historical parent evidence is byte-equivalent.
- **P6:** included/excluded/not-applicable/conflicting targeting evidence, matrix keys and contract
  eligibility compose exactly without changing targeting or availability semantics.
- **P7:** 100 and 200 rule evaluations expose bounded work with less than 2.2× growth and no hidden
  database or wall-clock claim.
- **P8:** frozen install, typecheck, boundaries, all default tests, licence, audit, schema drift,
  protected hashes and fresh app-never-started referee remain green.

## Standing and handoff

Commit this order before the test. Preserve P0 before production edits. This pure order needs no
focused database. Restart the entire focused file after every correction, then run the complete
standing gate and a fresh isolated `./setup.sh --db-only` with the app never created. Do not rebuild
or reseed the founder's persistent stack because there is no runtime route/UI. Refresh Graphify
structurally, append one UNVERIFIED Gate-3 row, advance only the exact founder-status counters, commit
`[codex]`, push and open a draft stacked PR against Order 066. Do not approve or merge.
