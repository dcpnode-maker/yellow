# Order 244 — Canonical tax-attribution persistence foundation

**Status:** BUILT-UNREVIEWED-D640
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/canonical-tax-attribution-persistence`
**Base:** `f97464b` (approved sole-local Order243 descendant of built Order242/240)
**Risk tier:** 3 — new tenant-scoped append-only financial-attribution authority
**Owner:** Codex implementation; independent high-risk review deferred by founder build-first direction

## Outcome

Give the canonical positive Order240 snapshot one append-only tenant/property-scoped
database owner and governed internal record/read service. The snapshot must remain
byte/hash exact, idempotent and attributable while minimized fact/outbox evidence is
committed atomically. Persistence alone does not mean a quote was accepted, inventory
held, a reservation committed, money posted or a fiscal document issued.

## Fixed policy

- New `tax_attribution_snapshot` is the canonical durable owner; `fact_log`, outbox,
  journal source, `posting_line.tax_detail`, hold metadata and document content are not
  substitutes for this root.
- Version 1 accepts only a value re-parsed by Order240, origin `rate_quote`, and stores
  exact snapshot JSON plus duplicated constrained schema/origin/quote/hash/currency
  identity for indexed integrity.
- The service binds one active-tenant exact-property and active actor to the record.
  This contextual property binding is not booking acceptance; a later authoritative
  re-quote/hold command must prove the quote belongs to that property before linking it.
- Same snapshot hash converges to one tenant record. Same idempotency key and request
  returns the exact receipt; changed reuse conflicts. A newly created root emits one
  `tax.attribution_recorded` fact and one minimized event containing only attribution
  id, property id, origin kind, quote hash, snapshot hash and currency.
- The table and fact are insert-only. No direct runtime insert/update/delete authority,
  no mutable head and no delete/correction meaning are introduced.

## Exact scope

- this order, Phase-7 plan/build entries, `DECISIONS.log`, `handoff/LEDGER.md`;
- new forward migration `migrations/0038_canonical_tax_attribution_persistence.sql`
  plus exact schema/migration/acceptance/referee fixtures required by the new table;
- new `src/contexts/tax-fiscal/persistence.ts` and export-only context update;
- new intentional-red and focused real-PostgreSQL proof under `tests/`;
- narrow contracts/domain/events/security documentation for the root and event.

## Forbidden

- editing `migrations/0001_init.sql`;
- reservation/segment/hold/folio/journal/posting/tax-detail/document/series/submission
  link or mutation;
- quote acceptance, re-quote, inventory arbitration, tax-payable route/account choice,
  inclusive/exclusive journal topology, negative correction/reversal allocation,
  CGST/SGST/IGST or place-of-supply policy, document rounding allocation;
- HTTP, UI, provider, IRP, local-app replacement, merge, public or production deploy;
- independent approval, Phase7 or application-complete claim.

## Pre-registered proof

- **P0 red:** migration, table, service/export and event contract are absent.
- **P1 shape/authority:** exact table constraints, tenant-leading keys, composite
  property/actor references, RLS and owner capability exist; PUBLIC/app_role raw DML
  and direct capability abuse fail closed.
- **P2 exact round-trip:** a valid Order240 snapshot stores and reads byte/hash-exact,
  deeply frozen truth with matching duplicated identity fields.
- **P3 hostile/tenant:** tampered/noncanonical snapshots, foreign tenant/property/actor
  and malformed input write nothing and reveal no row.
- **P4 idempotency/concurrency:** exact replay and concurrent same/different keys
  converge to one root, one fact and one event; changed key reuse conflicts.
- **P5 atomicity/minimization:** injected evidence failure rolls root, fact, event and
  receipt back; retry succeeds once; event contains no full snapshot or PII.
- **P6 containment:** reservation, hold, occupancy, journal, posting, tax detail,
  document, series counter and fiscal submission counts/bytes remain unchanged.
- **P7 standing:** focused/adjacent/full tests, fresh migration/acceptance/referee,
  typecheck, boundaries, licence, audit, JavaScript and diff checks are green.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Governed append-only root and exact record/read service are executable.
- [x] Fresh PostgreSQL and standing proof is transcribed.
- [x] Order closes only built-unreviewed pending independent Tier-3 review.

## Built checkpoint

The append-only root, owner-mediated capability, strict transaction-taking service,
tenant/property/actor containment, exact parser round-trip, idempotent convergence and
minimized atomic fact/outbox evidence are implemented. Real PostgreSQL P1–P6 pass
6/6 with 49 assertions; the standing suite passes 822/822 plus 717 expected database
skips, with typecheck, 91 boundaries, 23-package licence policy, zero-vulnerability
audit, four JavaScript syntax checks and diff hygiene green. Fresh PostgreSQL has 94
tables/84 policies; database acceptance passes 8/8 and the referee passes 11/11.

The complete migration runner originally stopped at 35/36 because its standing
SECURITY DEFINER proof correctly discovered two inherited Order236 functions whose
immutable migration0037 omitted explicit `pg_temp` from `search_path`. D-638/Order245
repaired those exact configurations forward-only without changing either function
body, signature, owner or ACL. The resulting fresh migration suite is 36/36 with 160
assertions, database acceptance is 8/8 with 18 assertions and the 94-table/84-policy
referee is 11/11. D-640 therefore closes this order built-unreviewed. It is not
independently approved and does not promote or mutate the sole local app.
