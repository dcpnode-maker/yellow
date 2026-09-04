# Order 414 — India accommodation IRP numeric item-source composition

**Status:** CHANGES REQUIRED — D1233
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/persisted-india-final-component-tax-evidence`
**Base:** independently approved Order413 coordination head `4969c8a`
**Risk tier:** 3 — statutory/fiscal payload prerequisite
**Owner:** Codex implementation; fresh independent non-implementing Tier-3 reviewer

## Outcome

Add one migration-free pure Tax-Fiscal composer that accepts the exact approved
Order413 frozen statutory envelope and returns only a canonical, recursively frozen,
tenant-hidden per-room-night numeric source for a later IRP `ItemList` serializer.
It groups and reconciles already-persisted Order353/367 money and component evidence;
it neither recalculates tax nor emits IRP JSON.

## Natural-Solution Test

Order413 already carries the complete authoritative numeric truth in its exact
`financialSource`: root INR totals and component family, dense room-night ordinals,
business dates, exact transaction/tax values, slab/rate/ITC evidence, and flat
component identities/rates/tax amounts. It also carries the approved accommodation
classification. Order414 therefore needs no SQL, transaction, table, entity, writer,
configuration or caller-supplied amount. It revalidates Order413, groups the existing
components by their existing ordinal, proves exact reconciliation, and preserves the
source fields byte-for-byte. Persisting another snapshot or inventing document/item
presentation fails this test.

## Exact contract

`composeIndiaIrpAccommodationNumericItemSources(input)` accepts only a canonical
tenant UUID and exact `IndiaIrpAccommodationSourceResult`. It independently validates
and tenant-rehashes the complete Order413 result, requires INR, 1..366 dense ordered
room nights, exact component-family topology and signed-int64-safe reconciliation,
then returns `eligible_irp_accommodation_numeric_item_sources` with:

- exact source currency, component family and unchanged classification;
- each unchanged room-night ordinal, business date, transaction value, nullable slab,
  aggregate rate, ITC flag and tax value, plus its exact ordered existing components;
- unchanged exact root transaction, tax and grand totals;
- the exact Order413 evidence hash as source lineage and a new tenant-bound evidence
  hash whose tenant is not returned.

No `SlNo` or new item total is introduced. All public source/classification/component
types must be imported through existing context indexes rather than copied.

## Exact scope

- new `src/contexts/tax-fiscal/india-irp-accommodation-numeric-item-source.ts` and
  public export only;
- new exact intentional-red and permanent pure hostile/mutation tests;
- existing Order413 integration test only if an executable compatibility fixture
  correction is required; otherwise byte-untouched preservation proof;
- `docs/CONTRACTS.md`, Phase7 `BUILD-PLAN.md`, this order/review, `DECISIONS.log` and
  `handoff/LEDGER.md`.

Any other path requires a recorded scope amendment before edit.

## Required proof

1. Intentional red proves the module/export absent for the exact intended reason.
2. Golden 5/12/18-percent, IGST/CGST+SGST/CGST+UTGST, single/multi-night and
   zero-rounded-component sources preserve every exact Order413 numeric field.
3. Missing, duplicated, surplus, reordered or wrong-family components; ordinal gaps;
   wrong rate/tax/night/root/grand-total reconciliation; malformed/unsafe/overflow
   values; mixed lineage and any Order413 identity/hash mutation fail closed.
4. Input remains byte-unchanged; two calls are byte-equivalent; every output object
   and array is deeply frozen; tenant is absent outside the hash preimage.
5. Orders353/367/407/412/413, acceptance, exact catalogue/schema, referee11/11,
   standing and static gates remain green.
6. A fresh non-implementing Tier-3 reviewer personally executes complete proof.

## Forbidden

No migration/schema/table/RLS/permission/SQL/transaction/read/write/lock/entity/event/
fact/outbox/idempotency; no rate selection, tax recalculation, rerounding, residual
allocation or new monetary authority; no `ItemList`, `SlNo`, `PrdDesc`, quantity,
unit/UQC, unit price or IRP item/value/tax field names; no cross-night grouping; no
`DocDtls`, `TranDtls`, `SupTyp`, `RegRev`, `IgstOnIntra`, SEZ/zero-rating/authorized-
operations or reverse-charge inference; no document/series/number/hash-chain/issue,
provider/submission/IRN/QR, API/UI/seed/runtime/local/deploy/merge/push, Phase7 or
application-completion authority.
