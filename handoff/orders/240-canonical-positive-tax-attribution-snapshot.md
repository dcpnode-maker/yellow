# Order 240 — Canonical positive tax-attribution snapshot

**Status:** BUILT-UNREVIEWED-D631
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/canonical-tax-attribution-snapshot`
**Base:** `d6e52dc` (built-unreviewed Order239)
**Risk tier:** 2 — pure immutable financial-attribution evidence
**Owner:** Codex implementation; independent review remains deferred by founder build-first direction

## Outcome

Convert one exact calculated Order239 room-tax preview into a canonical, JSON-safe,
deeply immutable positive-origin attribution snapshot whose deterministic hash can be
persisted and consumed by later booking, posting, correction and folio slices without
reconstructing financial meaning from descriptions or mutable configuration.

## Fixed policy

- Version 1 represents only one positive `rate_quote` origin. It binds the exact quote
  SHA-256, currency, stable revenue line id/group, input amount, nights, person-nights,
  ordered room-night amounts, ordered business-date assignment evidence, exact
  jurisdiction extension identity/version/content hash, evaluator country/display/
  rounding mode, exact totals, ordered tax totals and ordered line components.
- Every money and quantity value stored in the snapshot is a canonical non-negative
  decimal string. Runtime `bigint`, float, exponent text, negative zero, unsafe
  magnitude and non-finite values are forbidden.
- Creation validates complete reconciliation before computing `snapshotHash`:
  room-night amounts equal the input amount, evaluator input matches the same amount,
  base plus tax equals grand total, tax totals equal their components, and all ordered
  assignment/component evidence is unique and coherent.
- Parsing is an exact hostile-boundary operation. Unknown fields, accessors, cycles,
  malformed UUID/hash/currency/date/reference values, duplicate or out-of-order nights,
  mismatched totals, unsupported signs and non-canonical decimal text fail closed.
- Creation and parsing never mutate their input and return one recursively frozen
  value. The snapshot hash is over the complete canonical value excluding only the
  hash field itself.
- Version 1 creates no correction, reversal, transfer, tax-posting, invoice,
  CGST/SGST/IGST split, document, numbering, IRP or fiscal-finality meaning.

## Exact scope

- this order, Phase-7 entries in `BUILD-PLAN.md`, `handoff/PHASE-7-PLAN.md`,
  `DECISIONS.log` and `handoff/LEDGER.md`;
- new `src/contexts/tax-fiscal/attribution.ts` and export-only update to
  `src/contexts/tax-fiscal/index.ts`;
- new intentional-red and focused executable proof under `tests/`;
- narrow snapshot-contract notes in `docs/CONTRACTS.md`,
  `docs/DOMAIN-MODEL-V1.md` and `docs/SECURITY.md`.

## Forbidden

- migration/schema/RLS/role/grant/function/table/index changes;
- reservation/hold/commit persistence, financial/posting/journal/folio/tax_detail,
  correction/transfer, document, numbering/hash-chain, provider or IRP behavior;
- evaluator, resolver or quote price/hash behavior changes;
- database, HTTP, UI, event, fact, cache or local-app changes;
- independent approval, merge, push, deploy, Phase-7 or app-complete claim.

## Pre-registered proof

- **P0 red:** builder, parser, error and public exports are absent before implementation.
- **P1 round-trip:** exact Order239-shaped exclusive and inclusive evidence creates one
  canonical snapshot; parse reproduces byte-equivalent recursively frozen truth.
- **P2 reconciliation:** input/base/tax/grand, tax/component, nights/person-nights and
  ordered room-night values reconcile exactly or reject atomically.
- **P3 lineage:** quote hash, assignment dates/references and jurisdiction extension
  identity/version/content hash remain exact and hash-bound.
- **P4 JSON safety:** no `bigint` survives; decimal text and snapshot hashing are
  canonical and deterministic.
- **P5 hostile shape:** unknown/accessor/cyclic shapes, malformed identities, hashes,
  currency, dates, decimals, ordering, duplicates and unsafe magnitudes fail closed.
- **P6 containment:** no database, Financials/Rates implementation import, state write,
  fact or event exists; inputs remain byte-equivalent.
- **P7 standing:** focused and adjacent tax/quote tests plus full suite, typecheck,
  boundaries, licence, audit, JavaScript and diff checks remain green.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Canonical positive-origin snapshot creation and hostile parsing are executable.
- [x] Focused, adjacent and standing results are transcribed.

## Built evidence

Intentional red `0/4` preceded implementation. The combined focused and adjacent
tax/quote proof is green at `50/50` plus 11 expected database skips with 260
assertions; the Order240 contract contributes `12/12` with 131 assertions. The full
standing suite is green at `820/820` plus 708 environment skips with 8,356 assertions
across 1,528 tests/276 files. Typecheck, 90 import boundaries, 23 dependency licences,
zero-vulnerability audit, all four tracked JavaScript syntax checks and diff hygiene
are green. The schema, database and local application are unchanged by Order240.

Independent review remains deferred under the founder's build-first direction. This
order can close only as built-unreviewed.
