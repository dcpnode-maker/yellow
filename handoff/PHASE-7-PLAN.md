# Phase 7 — Tax engine and India IRP

**Status:** active; implementation begins with Order 237
**Entry point:** built-unreviewed Phase-6 composition through Order 236
**Current order:** Order 237 pure rules-driven tax evaluation is ready under D-624

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
