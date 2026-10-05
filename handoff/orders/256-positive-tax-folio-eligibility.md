# Order 256 — Authoritative positive-tax primary-folio eligibility

**Status:** APPROVED-D666
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/positive-tax-folio-eligibility`
**Base:** `3139f09` (approved sole-local Order255 descendant)
**Risk tier:** 3 — financial ownership and fiscal-lineage read/lock integrity
**Owner:** Codex implementation; independent non-implementing Tier-3 execution required

## Outcome

Resolve one exact Order252 quoted-tax reservation lineage to its canonical open primary
folio and coherent open guest account inside the caller's existing tenant transaction.
Reparse the exact stored Order240 snapshot, acquire the existing bounded financial row
locks, re-read the complete graph, and return one deeply frozen eligibility value.

This is a read/lock prerequisite only. It does not create a folio, choose transaction
codes or accounts beyond the reservation's own guest account, or post money.

## Fixed contract

Export `PositiveTaxFolioEligibilityService.resolve(tx, input)`, where input has exact
plain fields `tenantId`, `propertyNode`, and `reservationId` as canonical UUIDs.

Resolution begins from the unique tenant-scoped
`tax_attribution_reservation_binding` for that reservation and requires its hold
binding, attribution root and canonical stored snapshot to agree on binding,
attribution, property, quote hash, snapshot hash and currency. The reservation must
agree on property, currency and primary Party; its exact first segment must remain
the segment named by immutable lineage.

Exactly one reservation-linked window `1` must exist. It must be open and belong to
exactly one open guest account whose tenant, property, currency and Party equal the
reservation truth. Additional windows are never candidates. Missing lineage or
financial roots is not-found; ambiguity, stale or divergent stored truth is conflict.

The service invokes existing `public.lock_financial_rows` for that exact guest
account and folio, then re-reads and revalidates the graph in the same transaction.
It returns frozen lineage, attribution, reservation, segment, folio, guest-account,
property, quote-hash, snapshot-hash and currency evidence plus the freshly reparsed
canonical snapshot. It does not re-impose a mutable reservation lifecycle status:
the immutable Order252 edge already proves booking acceptance, while legitimate
financial use can continue through later stay states.

## Exact scope

- new `src/contexts/tax-fiscal/folio-eligibility.ts` and export-only context index;
- new intentional-red and real-PostgreSQL focused proof under `tests/`;
- affected existing attribution, lineage and folio proof only;
- this order plus Phase7/build/decision/ledger documentation.

## Forbidden

No migration/schema/ACL/RLS/seed; no folio/account/reservation/segment/lineage mutation;
no journal/posting/posting-line/tax-detail/fact/outbox/idempotency; no transaction-code
or route selection/authoring; no business-day/date or posting-time choice; no automatic
primary-folio opening or additional-window fallback; no India or document-rounding
policy; no correction, reversal, fiscal document, IRP, HTTP, UI, credential, local,
merge, public/production deploy, Phase7 or application-complete claim.

## Pre-registered proof

- P0 intentional red: service/export is absent.
- P1 exact quoted-tax lineage, stored snapshot, reservation and first segment resolve.
- P2 exact open primary window and coherent open guest account return frozen evidence.
- P3 no primary, additional-only, settled/closed folio and non-open/non-guest account
  fail closed without selecting alternatives.
- P4 foreign tenant/property/currency/Party, broken lineage and tampered snapshot are
  concealed or rejected with zero cross-tenant truth.
- P5 financial rows are locked, concurrent mutation serializes, and the post-lock
  re-read detects divergent truth.
- P6 before/after counts and static proof show zero mutation and unchanged ACL/schema.
- P7 focused, affected, standing, type, boundary, licence, audit, migration acceptance
  and fresh referee gates are green.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Exact read/lock/recheck eligibility contract passes P1-P6.
- [x] All standing gates and fresh referee pass.
- [x] A non-implementing Tier-3 reviewer personally executes and records the proof.

## Built evidence

The intentional-red proof first failed `0/1` because the service file did not exist.
Fresh PostgreSQL 16.15 with migrations1–42 passed focused P0–P6 `7/7` with 48
assertions, including exact nested freeze, every primary-folio/account/lineage blocker,
real financial-lock serialization, post-lock divergence detection and zero-effect/ACL
truth. Adjacent attribution, reservation-lineage, folio, row-lock and acceptance proof
passed `39/39` with 208 assertions. The standing suite passed `835/835` plus 743
expected environment skips with 8,494 assertions across 1,578 tests/285 files.
Typecheck, 94 import boundaries, 23-package licence policy, zero-vulnerability audit,
diff hygiene, fresh migration42/96-table/86-policy schema and referee11/11 are green.
Independent Tier-3 review at
`handoff/reviews/256-positive-tax-folio-eligibility.md` APPROVED the exact candidate
commit with no product finding. The reviewer personally reproduced focused `7/7`,
database acceptance `10/10`, referee `11/11`, migrations1–42 with 96 tables/86
policies, typecheck, 94 boundaries and diff hygiene. The review also records a
disposable-harness isolation incident and complete recovery of the same sole-local
container identities, volume, two properties and HTTP health; no `yellow_dev` product
data changed. Approval grants only this read/lock/recheck prerequisite.
