# Phase 7 — Tax engine and India IRP

**Status:** active; Order 237 built-unreviewed
**Entry point:** built-unreviewed Phase-6 composition through Order 236
**Current order:** Order 238 effective tax-jurisdiction resolution is ready under D-626

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
