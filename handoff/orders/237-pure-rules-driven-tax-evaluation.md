# Order 237 — Pure rules-driven tax evaluation

**Status:** INDEPENDENTLY APPROVED — CLOSED — D1288
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/rules-driven-tax-evaluation`
**Base:** `0708df1` (built-unreviewed Order236)
**Risk tier:** 2 — tax computation and money presentation evidence
**Owner:** Codex implementation; fresh independent Tier-3 review `/root/order427_tax_review`

## Outcome

A deterministic pure tax engine validates one adopted `tax_jurisdiction` content value
and evaluates exact attributable `bigint` minor-unit inputs without database, browser,
provider or floating-point money authority.

## Fixed policy

- The adopted contract in `docs/EXTENSIONS.md` remains authoritative: country,
  `tax_inclusive|tax_exclusive`, `line|document` rounding, and the four existing tax
  modes. This order does not redesign extension storage or edit migration0001.
- Configuration rates are admitted only when finite, non-negative and exactly
  convertible to integer basis points. All money, bases, intermediate sums and results
  are bounded signed-safe `bigint` minor units; JavaScript-number money is forbidden.
- Inputs are positive immutable attributable lines with exact identity, revenue group,
  amount, explicit nights/person-nights and, for room revenue, explicit per-night
  component amounts. The
  engine does not infer dates, occupancy, prices, currency conversion or jurisdiction.
- Taxes apply only to explicit `applies_to` revenue groups. Fixed-per-night and fixed-
  per-person-night require exact non-negative integer quantities. Slab percent selects
  one ordered band per attributable room-night basis; stay-average slab selection is
  forbidden.
- `tax_exclusive` adds tax to the base. `tax_inclusive` extracts the included component
  from the configured gross basis without increasing gross. Rounding is exact half-up;
  `line` rounds each attributable component, while `document` rounds the exact summed
  rational result once per tax code and performs no line allocation. Half-up is the
  inherited technical engine convention, not a fiscal-jurisdiction certification.
- `slab_percent` is whole-band: the first ordered inclusive `upto_minor` boundary that
  admits the component selects one rate over that complete component. Exactly one final
  null band is required. Progressive/marginal slabs require a future schema version.
- `compound_on` may name only earlier unique tax codes and must be acyclic. A compound
  tax includes the named already-calculated tax components in its basis. Missing,
  duplicate, forward or cyclic references fail the whole evaluation. Line-rounded
  compounding consumes already-rounded attributable components. Document-rounded
  compounding fails closed because this version has no document-to-line allocation
  policy.
- Results are deeply frozen and include jurisdiction identity, price-display mode,
  rounding mode, exact input/base/tax/grand-total minor units, and ordered per-code
  components sufficient for later quote/posting attribution. Mixed room-night rates
  remain ordered per-night components. No event is emitted.
- Input collections, rule collections, dependency breadth and rational representation
  complexity are bounded; oversized hostile work requests fail closed.
- This order deliberately does not settle negative tax corrections, person-category
  derivation, `rate_plan.tax_inclusive` precedence, document residual allocation, or
  India CGST/SGST/IGST decomposition. Those meanings must be resolved before posting or
  fiscal issue; aggregate `GST_ROOM` evidence here is not a legally final invoice.

## Exact scope

- this order, `handoff/PHASE-7-PLAN.md`, Phase-7 entries in `BUILD-PLAN.md`,
  `DECISIONS.log` and `handoff/LEDGER.md`;
- `src/contexts/tax-fiscal/evaluator.ts` and the existing empty
  `src/contexts/tax-fiscal/index.ts`;
- focused intentional-red, evaluator and static contract tests under `tests/`;
- tax-evaluator notes in `docs/CONTRACTS.md`, `docs/DOMAIN-MODEL-V1.md`,
  `docs/SECURITY.md` and `docs/EXTENSIONS.md` only when implementation precision needs
  a non-contradictory clarification of the already adopted format.

## Forbidden

- migration/schema/RLS/role/permission/table/extension-registry or assignment reads;
- HTTP, UI, local promotion, quote/folio/posting/journal/document/number/hash/submission,
  provider, event/outbox, currency conversion, discount or rate calculation;
- floats for money, caller-selected tax rates, hidden defaults, silent malformed-rule
  skipping, stay-average India slabs, negative money/quantities or unbounded arithmetic;
- independent approval, merge, push, deploy, Phase-7 or app-complete claim.

## Pre-registered proof

- **P0 red:** tax evaluator/export and exact calculation contract are absent first.
- **P1 modes:** percent, fixed/night, fixed/person-night and slab-percent return exact
  ordered integer-minor results for exclusive and inclusive regimes.
- **P2 India bands:** per-room-night values at 99,900/100,000/100,100 and
  750,000/750,100 minor-unit boundaries select the documented ₹999/₹1,000/₹1,001/
  ₹7,500/₹7,501 bands exactly; a mixed stay proves there is no stay-average slab.
- **P3 rounding:** positive/zero half-up ties differ only where `line` versus `document`
  policy requires, with exact reconciled totals and no floating-point money.
- **P4 compounding:** ordered valid dependencies compose once; missing, duplicate,
  forward, self and cyclic references reject atomically.
- **P5 hostile shape:** unknown keys/modes/display/rounding, fractional or unsafe
  quantities, invalid rate precision, malformed slabs and arithmetic overflow fail
  closed without partial result.
- **P6 standing:** existing rate/financial/tax-fiscal boundaries plus full suite,
  typecheck, boundaries, licence, audit, JavaScript and diff checks remain green.

## Definition of done

- [x] Intentional red precedes implementation (`57d1f96`: 0/2 before production).
- [x] Pure validated engine covers all four adopted modes and both price displays.
- [x] India boundary, rounding, compounding and hostile-shape vectors are executable.
- [x] Result attribution and deep immutability are proven.
- [x] Focused and standing proof totals are transcribed.

Fresh independent Tier-3 review closes this pure calculation slice under D1288. The
approval is bounded to the exact evaluator contract and grants no database, quote,
posting, document, provider, fiscal-finality or Phase-7 authority.

## Built evidence

- Focused evaluator plus preregistered proof: `17 passed, 0 failed`, 48 assertions.
- Adjacent rate/financial static proof: `24 passed, 18` expected database skips,
  `0 failed`, 244 assertions.
- Standing repository suite: `788 passed, 704` environment skips, `0 failed`,
  8,146 assertions across 1,492 tests / 270 files.
- Typecheck, 88-file import boundaries, 23-package licence policy, dependency audit
  (`0` vulnerabilities), four-file JavaScript syntax and diff checks are green.
- The exact schema and one-local PostgreSQL evidence are inherited unchanged from
  Order236; this pure order adds no migration, table, function, role or grant.
- Independent tax-computation approval remains deliberately deferred by the founder's
  build-first direction. No quote, posting, document, fiscal or legal-finality claim is
  made.
