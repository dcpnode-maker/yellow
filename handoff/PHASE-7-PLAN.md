# Phase 7 — Tax engine and India IRP

**Status:** active; Orders 237-240 built-unreviewed
**Entry point:** built-unreviewed Phase-6 composition through Order 236
**Current order:** Order 240 canonical positive tax-attribution snapshot is built-unreviewed under D-631

## Outcome

Phase 7 turns immutable commercial and posting inputs into deterministic integer-minor-
unit tax evidence, then builds governed fiscal-document issue and India IRP reporting
without giving a browser, provider or mutable configuration a second financial truth.

## Planned build sequence

1. pure validated jurisdiction evaluator over the adopted `tax_jurisdiction` contract;
2. effective property/date assignment and immutable jurisdiction-version resolution;
3. quote and folio tax preview using the same evaluator and attributable inputs;
4. governed tax posting lines and correction/reversal composition;
5. fiscal series, gapless document number and hash-chain issue path;
6. provider-neutral fiscal submission state machine and India IRP payload adapter;
7. deliberate operator document/IRP journey with receipts, retry and failure visibility.

Independent review is deferred under the founder's build-first direction. Tax,
financial posting, document numbering, fiscal chains and submission work may therefore
finish only as built-unreviewed until the required non-implementing executable reviews
are performed. No Phase-7 or app completion is claimed by opening this plan.

## Order 237 boundary

Order 237 is pure in-process calculation only. It validates one adopted jurisdiction
content value at the context boundary, converts configured rates to integer basis
points, evaluates signed-safe `bigint` minor-unit inputs, and returns deeply frozen
attributable tax components. It performs no database, HTTP, UI, posting, document,
submission, provider, event or migration work.

The engine supports the existing contract's percent, fixed-per-night, fixed-per-person-
night and slab-percent modes; inclusive/exclusive display, line/document rounding and
explicit acyclic compounding are deterministic. India lodging bands are selected per
room-night transaction value rather than from stay average or caller-selected rates.

This first evaluator is intentionally positive-charge only. Half-up is the inherited
technical computation convention, document rounding is one exact total per tax code
without line allocation, and `slab_percent` is whole-band over the selected component.
Credit notes, progressive slabs, person-category derivation, rate-plan inclusion
precedence, tax-line allocation and India CGST/SGST/IGST decomposition require later
policy/authority orders before any posting or fiscal-document claim.

Order237 proof is green: focused `17/17`, adjacent `24/24` plus 18 expected
database skips, standing `788/788` plus 704 environment skips, typecheck, import
boundaries, licence, audit, JavaScript and diff checks. The result preserves mixed
room-night attribution, uses exact bigint inclusive arithmetic, compounds only from
visible rounded components under line rounding, rejects document-rounding compounding
without an allocation policy, and bounds hostile arithmetic work. Independent review
remains deferred; the next build slice is effective property/date jurisdiction
resolution without quote, posting or document authority.

## Order 238 boundary

Order238 resolves one caller-supplied property/date through active-tenant PostgreSQL
`tax_assignment` truth and the established runtime-visible extension adapter. It
requires one assignment and exactly one active visible global-or-tenant jurisdiction
version, binds exact content hash evidence, and returns a deeply frozen read-only
result. It invents no global/tenant precedence or extension-effective-time policy and
adds no migration, write, event, evaluator, quote, posting, document, provider, HTTP
or UI authority.

Order238 proof is green: the real-database focused suite passes `13/13`, adjacent
extension/rate/tax proof passes `17/17` plus 12 expected database skips, and the
standing suite passes `797/797` plus 708 environment skips. Exact `[)` assignment,
tenant/property isolation, unique active visible version binding, canonical frozen
content/hash evidence and zero writes are executable. Independent review remains
deferred; quote, posting, document and fiscal authority remain absent.

## Order 239 boundary

Order239 composes the two built tax primitives only into the canonical read-only live
rate quote. Exact room-only stays with one exact jurisdiction version may produce a
frozen tax preview bound into quote/offer evidence. Package/promotion attribution,
partial/mixed jurisdiction, more than 366 nights and inclusion-mode disagreement
produce no fabricated total. Folio/posting/document/fiscal integration remains later.

Order239 proof is green: the focused contract passes `7/7` with 33 assertions, fresh
isolated PostgreSQL quote proof passes `8/8` with 49 assertions including exact
before/after zero-write truth, and the standing suite passes `808/808` plus 708
environment skips. Typecheck, 89 import boundaries, 23 dependency licences,
zero-vulnerability audit, JavaScript syntax and diff hygiene are green. The schema is
unchanged and the disposable proof database was removed. Independent review remains
deferred; folio attribution, posting, document and fiscal authority remain absent.

## Order 240 boundary

Order240 adds the pure persistence-boundary value that Order239 deliberately lacked:
one canonical JSON-safe positive `rate_quote` attribution snapshot. It binds exact
quote, nightly assignment, jurisdiction-version and evaluator evidence with fully
reconciled decimal-string money and one deterministic snapshot hash. Hostile or
non-canonical values fail closed; the result is deeply frozen and performs no write.

This slice does not persist a quote, mutate a hold/reservation, post tax, change a
folio, compose a correction/transfer or issue a fiscal document. Those runtime steps
remain separately ordered after the immutable attribution contract exists.

Order240 proof is green: its focused contract passes `12/12` with 131 assertions;
the combined adjacent tax/quote proof passes `50/50` plus 11 expected database skips
with 260 assertions; and the standing suite passes `820/820` plus 708 environment
skips with 8,356 assertions across 1,528 tests/276 files. Typecheck, 90 import
boundaries, 23 dependency licences, zero-vulnerability audit, all four JavaScript
syntax checks and diff hygiene are green. Independent review remains deferred; no
persistence, booking acceptance, posting, document or fiscal authority is claimed.
