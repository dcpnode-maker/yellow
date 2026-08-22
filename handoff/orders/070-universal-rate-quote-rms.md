# Order 070 — Universal stay quote resolver and governed RMS/API recommendation port

**Phase:** 3 · Universal rate plans
**Branch:** `phase-3/universal-rate-quote-rms`
**Tier:** 3 — binds active pricing to tenant, availability, restriction, policy and external evidence
**Written by:** OpenAI Codex, autonomous temporary architect under D-95/D-115/D-221/D-230/D-254

## Outcome

Resolve one reproducible pre-tax stay quote from the active immutable rate release. The caller may
choose the property, plan, exact sellable, stay, guests, commercial identity, channel and configured
promotions, but cannot supply time, price, target, availability, restriction, occupancy, policy,
channel-map, tax-assignment, parent/BAR or RMS evidence. Return every local room-night, one exact
stay total, all applied/blocked/conflicting evidence, the active model/release/version, explicit
RMS source or fallback attribution and a deterministic quote hash.

## Natural-Solution Test

The active `rate_plan_release` extension already contains the complete immutable model, target,
evaluator and composition snapshot. `AvailabilityService`, `availability_projection`, `policy`,
`channel_map` and `tax_assignment` already contain the required runtime evidence. Add one read-only
rates query service plus one typed external recommendation port; extend the pure evaluator and
composer only enough to authenticate that evidence and aggregate a complete stay. Do not add a
table, migration, cache, event, state transition or second price/availability truth.

## Scope

- `src/contexts/inventory/availability-projection.ts`
- `src/contexts/inventory/index.ts`
- `src/contexts/rates/recommendations.ts`
- `src/contexts/rates/quote.ts`
- `src/contexts/rates/evaluators.ts`
- `src/contexts/rates/composition.ts`
- `src/contexts/rates/publication.ts`
- `src/contexts/rates/index.ts`
- `docs/CONTRACTS.md`
- `tests/rate-quote.integration.test.ts`
- `tests/rate-evaluators.test.ts` only for RMS evaluator evidence/guard assertions
- `tests/rate-composition.test.ts` only for whole-stay composition assertions
- `tests/rate-publication.integration.test.ts` only for RMS publication/reference simulation proofs
- `src/project-status.ts` only for exact completed-order and Gate-3 debt counters
- `tests/founder-status.integration.test.ts` only for the exact current-order assertion
- `handoff/orders/070-universal-rate-quote-rms.md`
- `handoff/questions/119-order-070-quote-evidence-and-stay-semantics.md`
- `handoff/questions/119-ARCHITECT-RESPONSE.md`
- `DECISIONS.log`
- `handoff/LEDGER.md`
- `handoff/GATE-3-MANIFEST.md`
- further numbered D-92 question/response files only if a hard-floor condition occurs

## Required implementation

1. Add one strict read-only quote input: property id, active plan id, exact sellable id, finite ordered
   UTC stay instants spanning 1–730 property-local nights, 1–99 adults, 0–30 child ages, 0–50 selected
   promotion codes, exact Order 066 commercial context and one channel code. Reject all unknown
   fields. There is no tenant id, booking instant, amount, evidence, winner or result field.
2. In the tenant transaction, read PostgreSQL `transaction_timestamp()`, exact property timezone,
   the one active release and the exact `AvailabilityService.search` option for the requested
   sellable/stay/party/plan/channel. Convert its capacity, restriction and OOO/OOS causes into frozen
   Order 068 evidence without suppressing blocked options. Missing, duplicate or mismatched property,
   unit type or sellable evidence fails closed.
3. Add a read-only `AvailabilityProjectionService.occupancySignal` query for one exact
   property/unit-type/local-night projection row. Derive basis points as specified by Question 119,
   retain row/update evidence and return null when the disposable projection row is absent. It never
   reads/writes `space_occupancy` and never determines bookability. An evaluator requiring occupancy
   evidence cannot invent it.
4. Evaluate each local night through the release's stored Order 066 target version and stored Order
   067 spec. Runtime timezone/booking instant, projection occupancy and target result are server
   derived. Caller-supplied BAR level remains absent in this order. Stored typed `replace` rules are
   the manual-override mechanism; no separate mutable override path exists.
5. Bind every `bar` or `parent` base to the exact non-draft `rate_plan_release` id/version named by
   the evaluator, in the same property and currency. Recursively evaluate its stored target/spec for
   the same night and request context; retain source kind/id/version, allow retired history, cap depth
   at 16 and reject cycles, drafts, mismatch, conflict or unpriced source results. Never accept a
   caller amount or use database/object order as a winner.
6. Enable `rms-api-managed` only when the model draft and evaluator match, the release carries the
   exact pre-registered non-null RMS binding, and both floor and ceiling are present and ordered.
   Its evaluator retains a governed local base. A typed adapter registry selects only the exact
   approved key/version. The response repeats exact tenant/property/plan/release/sellable/unit-type/
   night/currency scope plus recommendation id/version, observed instant, bigint amount and evidence
   reference. Operational absence/error/staleness produces an explicit `local_evaluator` fallback;
   malformed, future, scope/currency/adapter mismatch or unsafe money fails closed. An accepted
   amount replaces only the base before stored rules/manual override and floor/ceiling guards.
7. Load configured policy evidence from exact tenant rows. For non-direct channels require both the
   exact rate-plan and unit-type `channel_map` rows and hash their stable mapping evidence; direct has
   no mapping claim. Load matching tenant `tax_assignment` rows per local night as non-disableable
   mandatory evidence; two assignments for one night are a conflict, none means no configured
   assignment. Do not calculate or invent tax, fiscal, refund, cancellation or statutory outcomes.
8. Add strict whole-stay composition over exactly one canonical evaluation for every local night.
   Reject gaps, duplicates, mixed stay/spec/currency or noncanonical results; propagate any blocker,
   conflict or unpriced night with its date. Sum exact room-night amounts with overflow protection,
   then apply the stored package and selected-promotion composition exactly once. Package rhythms use
   the complete LOS, included allocation compares with the complete room total, and output includes
   exact per-night room amounts, stay room total, package/promotion totals and pre-tax subtotal.
9. Return a frozen quote whose attribution includes tenant/property/plan, release id/version/content
   hash, model and target draft id/version, sellable/unit type, server booking instant, local stay,
   nightly target/evaluator/RMS/reference/occupancy evidence, policy/mandatory/channel/availability
   evidence and exact totals. Canonically tag bigint values when hashing; two calls in the same
   transaction over unchanged evidence must be byte-equivalent and share one quote hash.
10. Cross-tenant ids, inactive/no/multiple releases, forged stored references, stale projection,
    unavailable/blocked inventory, missing channel maps, adapter tamper, cycles, malformed storage,
    publisher failure inherited from Order 069 and hostile input fail without any write, fact, event,
    approval, price, restriction, occupancy or status artifact.

## Forbidden

- Any file under `migrations/`, especially `migrations/0001_init.sql`; schema snapshots or
  `tests/run_invariants.py`
- A new table, column, constraint, extension type, event, approval state, HTTP route, UI, worker,
  cache, dependency, reservation/hold command or distribution write
- Reading or writing `space_occupancy` in the rates context; changing availability/restriction/OOO/
  OOS logic; treating the projection or RMS as bookability authority
- Mutating `rate_price`, releases, policy, channel maps, tax assignments, facts, outbox, approvals,
  journals, fiscal/statutory records or any published history
- Caller-supplied price, booking time, target result, availability/restriction/occupancy/policy/tax/
  channel/reference/recommendation evidence; arbitrary formulas; float/JavaScript-number money
- Silent RMS error/staleness, RMS bypass of floor/ceiling/manual rules, cross-property references,
  recursive cycles, ambiguous channel/tax evidence, repeated per-stay package application
- Tax calculation, tax-inclusive/exclusive transformation, refund/cancellation execution, fiscal or
  statutory execution, AI compilation, browser authority, auto-publish, self-review or self-merge

## Pre-registered proof

- **P0 (red first):** focused test fails before production edits because `RateQuoteService` and RMS
  recommendation exports do not exist. Preserve exact red output.
- **P1:** a three-night fixed/calendar stay returns three exact local dates and one exact room total;
  every package rhythm and fixed/basis-point promotion applies once to the stay, included allocation
  compares with the whole room total, and a missing/duplicate night or overflow fails closed.
- **P2:** live PostgreSQL availability, closed/CTA/CTD/min/max/OOO/OOS and exact sellable selection
  remain authoritative; a caller has no evidence fields and a blocked option cannot quote despite a
  valid price, override, package or promotion.
- **P3:** projection occupancy is attributable and never bookability truth; property/type/night or
  missing-row mismatch cannot forge a responsive rule. Parent/BAR chains bind exact active/retired
  release id/version and reproduce history; draft, cross-property, currency mismatch, cycle and depth
  overflow fail closed.
- **P4:** an exact fresh RMS response is attributable, passes stored typed adjustments/manual replace
  and floor/ceiling; missing adapter, throw and stale response expose distinct local-fallback evidence;
  malformed/future/wrong adapter, tenant, scope, currency or number evidence fails instead of falling
  back. RMS drafts without binding and local drafts with binding cannot publish.
- **P5:** exact policy ids, non-direct plan+unit channel maps and per-night tax assignments originate
  from the tenant database and remain in output; missing channel map and overlapping assignments fail;
  absence of tax assignment is explicit and does not fabricate tax.
- **P6:** same-transaction repeated and permuted caller-choice inputs produce the same canonical
  nightly order, exact evidence, totals and quote hash; changed release/evidence changes the hash;
  tenant/property/storage tamper and forged reference ids fail closed with zero writes.
- **P7:** 30 versus 60 nights and bounded target/evaluator/package inputs expose work below 2.2×
  growth and stay below a generous catastrophic ceiling without asserting planner/index shape.
- **P8:** frozen install, typecheck, boundaries, all default tests, licence, audit, schema drift,
  protected hashes and fresh app-never-started referee remain green.

## Standing and handoff

Commit this order before the database test. Preserve P0 before production edits. Use a disposable
focused database and restart the complete focused suite after every correction. Commit implementation
before the manifest row, advance only exact founder-status counters, run the full standing gate and
fresh isolated `./setup.sh --db-only` with app never created, refresh Graphify structurally, push a
draft PR stacked on Order 069 and do not approve or merge. Do not rebuild/reseed the founder stack.

## Preserved P0 red proof

Executed after order commit `d2c78a1` and before production edits:

```text
bun test v1.3.14 (0d9b296a)

tests/rate-quote.integration.test.ts:

# Unhandled error between tests
-------------------------------
SyntaxError: Export named 'RateQuoteService' not found in module '/home/astha/projects/yellow-phase-1/src/contexts/rates/index.ts'.
-------------------------------


 0 pass
 1 fail
 1 error
Ran 1 test across 1 file. [81.00ms]
```
