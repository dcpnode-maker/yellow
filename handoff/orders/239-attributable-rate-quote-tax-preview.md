# Order 239 — Attributable rate-quote tax preview

**Status:** BUILT-UNREVIEWED-D629
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/quote-tax-preview`
**Base:** `537f2c1` (built-unreviewed Order238)
**Risk tier:** 2 — read-only tax calculation evidence
**Owner:** Codex implementation; independent review remains deferred by founder build-first direction

## Outcome

The canonical live rate quote resolves its exact nightly jurisdiction evidence and,
only when the complete stay is exactly attributable, returns one deterministic frozen
room-tax preview bound into the quote hash and exposed through the existing offer APIs.

## Fixed policy

- `RateQuoteService` requires an injected Order238 resolver. There is no production
  path that silently omits tax resolution. The caller retains the exact existing
  quote input and selects no tenant, tax key, rate, version, display mode or tax base.
- Every ordered property-local quote night is resolved through Order238. Zero or
  partial assignment returns explicit preview-unavailable evidence and no partial tax
  total. Every configured night must resolve the same extension id, owner, key,
  version and content hash; mixed jurisdiction/version stays are explicitly
  unavailable in this first slice rather than averaged or split under an invented
  document-rounding policy.
- Tax calculation runs only for an exact `state='quoted'`, room-only stay of at most
  366 nights. It requires no package evidence/allocation, zero package extra, zero
  included allocation, zero promotion discount, no applied promotion and exact
  `preTaxSubtotalMinor === roomAmountMinor`. Other attributable mappings remain
  explicit `unsupported_attribution`, never a fabricated payable total.
- The one evaluator line uses stable group `room_revenue`, exact ordered nightly
  bigint amounts, exact LOS and `(adults + children) * LOS` person-nights. It does not
  derive guest category or average slab value.
- PostgreSQL loads the exact active-tenant, exact-property rate plan currency and
  `tax_inclusive` flag. Jurisdiction `price_display` and the rate-plan flag must agree;
  neither overrides the other. A mismatch fails the quote closed as conflicting
  configuration.
- Resolved preview includes exact per-night assignment evidence, one exact extension
  identity/version/content/hash evidence value and the complete Order237 result.
  It is included before `quoteHash` is calculated. Bigint HTTP values remain canonical
  decimal strings.
- Blocked, unpriced or conflicted quotes do not run the evaluator. Preview, quote and
  offer operations write no row, fact, event, journal, posting, folio, document,
  submission or cache truth.
- Folio preview is deliberately separate. Existing immutable charge/posting truth
  does not retain canonical tax revenue group, room-night/person-night attribution,
  quote lineage, correction allocation or transfer semantics; this order must not
  reconstruct them from descriptive quantity or USALI text.

## Exact scope

- this order, `handoff/PHASE-7-PLAN.md`, Phase-7 entries in `BUILD-PLAN.md`,
  `DECISIONS.log` and `handoff/LEDGER.md`;
- `src/contexts/rates/quote.ts`, `src/contexts/rates/index.ts`,
  `src/contexts/reservations/offers.ts`, `src/http/operator.ts`, `src/server.ts`;
- new intentional-red and quote-tax-preview proof under `tests/`, plus only mechanical
  constructor/shape updates required in existing rate-quote, reservation-offer,
  operator-rate-builder, founder-reservation-journey, operator-rate-intent and
  review-seed tests;
- narrow quote-tax-preview clarifications in `docs/CONTRACTS.md`,
  `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md` and `docs/EXTENSIONS.md`.

## Forbidden

- migration/schema/RLS/role/grant/function/table/index or extension lifecycle changes;
- evaluator/resolver changes, precedence override, mixed-version calculation,
  package/promotion tax mapping, person-category meaning or residual allocation;
- quote price mutation, booking/hold/reservation commit change, cache/projection write;
- folio/charge/correction/transfer/posting/journal/tax_detail, document, numbering/hash
  chain, provider, IRP, fiscal submission or statutory-finality behavior;
- new endpoint, local promotion, independent approval, merge, push, deploy, Phase-7
  or app-complete claim.

## Pre-registered proof

- **P0 red:** exact quote preview type/dependency/result and offer HTTP evidence are absent.
- **P1 room tax:** ordered exact room-night amounts evaluate once without stay-average
  slab selection; India 99,900/100,100 mixed nights retain exact component evidence.
- **P2 inclusion:** exclusive addition and inclusive extraction are exact; rate-plan /
  jurisdiction display mismatch fails closed with no precedence.
- **P3 assignment:** unassigned/partial/mixed version stays expose no partial total;
  same exact version binds assignment, extension and content hash evidence.
- **P4 attribution:** package, included allocation, extra package value, applied
  promotion and stay over 366 nights do not fabricate a tax total.
- **P5 state:** blocked/unpriced/conflict quote results never invoke the evaluator.
- **P6 hash/API:** resolver/evaluator evidence changes quote hash; offers and operator
  JSON expose exact state/evidence and stringify bigint money.
- **P7 hostile/isolation:** malformed/foreign rate plan and resolver evidence fail
  closed; complete result is deeply frozen and input objects remain untouched.
- **P8 read-only:** before/after database truth proves zero assignment/extension,
  fact/outbox, journal/posting, document/series/hash or fiscal-submission writes.
- **P9 standing:** focused and adjacent rate/tax/offer/HTTP proof plus full suite,
  typecheck, boundaries, licence, audit, JavaScript and diff checks remain green.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Exact attributable room-only preview is bound into quote and HTTP evidence.
- [x] Unsupported, conflicting and hostile cases fail without fabricated totals.
- [x] Focused, adjacent and standing totals are transcribed.

Independent review remains deferred under the founder's build-first direction. This
order can close only as built-unreviewed.

## Built evidence

- The pre-registered surface red failed `0/4` before the resolver dependency, quote
  preview and offer/HTTP evidence existed. The completed focused proof passes `7/7`
  with 33 assertions; the source-level contract remains green `4/4` with 4 assertions.
- Fresh isolated PostgreSQL proof passes `8/8` with 49 assertions. It exercises the
  canonical quote path and proves calculated preview leaves tax assignment/extension,
  fact/outbox, journal/posting, document and fiscal-submission counts unchanged.
- Adjacent evaluator/resolver/quote proof passes `33/33` plus 4 expected database
  skips with 121 assertions. The standing repository suite passes `808/808` plus 708
  environment skips, 8,225 assertions and 1,516 tests across 274 files.
- Typecheck, 89-file import boundaries, 23-package licence policy, dependency audit
  (zero vulnerabilities), JavaScript syntax and diff hygiene are green. The schema is
  unchanged. The disposable proof database was removed after execution.
- Independent review remains deferred. No posting, folio, document, fiscal-finality,
  approval, Phase-7/app completion, local promotion, merge, push or deployment is
  claimed.
