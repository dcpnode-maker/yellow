# Order 412 — India accommodation fiscal-source eligibility

**Status:** ACTIVE — D1222
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/persisted-india-final-component-tax-evidence`
**Base:** independently approved Order411 coordination head `0ce9033`
**Risk tier:** 3 — fiscal eligibility over immutable financial/statutory lineage
**Owner:** Codex implementation; fresh independent non-implementing Tier-3 reviewer

## Outcome

Add one migration-free, read-only Financials resolver proving that an exact approved
Order407 India accommodation tax journal remains the current, unreversed fiscal source
for the caller tenant/property/reservation/folio. It must re-read and byte-check the
persisted Order367 component-tax root, its final valuation and applicability ancestry,
the Order407 binding and complete balanced journal topology, and must reject any
Order408 reversal or later valuation/tax generation.

Return recursively frozen deterministic `eligible_current_posted_source` evidence with
a tenant-bound but tenant-hidden SHA-256. A later issuer must rerun this resolver in its
own locked write transaction; this read does not reserve, allocate or issue anything.

## Natural-Solution Test

This is a composition of existing immutable tax, valuation, applicability, folio,
account, journal, posting-line, tax-detail and posting/reversal-binding truth. It needs
no new table, extension, event, state transition or authority. Financials owns journal
topology, so the resolver belongs behind the existing Financials public surface rather
than importing Financials internals into Tax-Fiscal.

## Exact contract

Input contains only exact `tenantId`, `propertyNode`, `reservationId`, `folioId` and
`journalId`. The service accepts an existing transaction handle and returns one deeply
frozen result containing exact posting-binding, journal, tax, valuation, applicability,
reservation, folio and guest-account identities; generations and evidence hashes;
business date; INR totals; component family; ordered room nights, ordered statutory
components and ordered journal lines; plus the canonical source evidence hash. The
tenant binds the hash but is not returned.

Absence or RLS concealment is not-found. Stale, reversed, forked, duplicated,
unbalanced, cross-property, cross-reservation, cross-folio, malformed or byte-divergent
truth conflicts. Folio/account closure alone is not disqualifying because fiscal
evidence may be consumed after checkout; identity, property, currency and account-role
relationships remain exact.

## Exact scope

- new `src/contexts/financials/india-final-component-tax-fiscal-source.ts`;
- export only through `src/contexts/financials/index.ts`;
- new `tests/india-final-component-tax-fiscal-source.intentional-red.test.ts`;
- new `tests/india-final-component-tax-fiscal-source.integration.test.ts`;
- directly affected Orders367/406/407/408 preservation tests only if executable proof
  exposes a real compatibility correction;
- `docs/CONTRACTS.md`, the Phase-7 section of `BUILD-PLAN.md`, this order/review,
  `DECISIONS.log` and `handoff/LEDGER.md`.

Any migration, schema snapshot/catalogue, permission, server/API/UI, dependency, seed,
runtime or local file is outside scope and requires a recorded amendment before edit.

## Required proof

1. Intentional red proves the exact module and public export are absent before work.
2. Fresh PostgreSQL16 exercises valid 5%, 12% and 18% sources across IGST,
   CGST+SGST and CGST+UTGST, including zero-rounded components and multi-night values.
3. The resolver revalidates exact contiguous tax night/component ordinals, stored
   lineage hashes, selected family/rates/amounts/totals, root-only canonical tax detail,
   exact posting lines, account roles/property/currency, folio ownership and a balanced
   journal.
4. Real database hostility covers foreign tenant/property/reservation/folio/journal;
   missing/duplicate/forked/malformed bindings or children; altered ordering, amounts,
   hashes, routes or account relationships; later valuation/tax generations; Order408
   reversal; and RLS concealment. Every rejection proves a complete unchanged census.
5. Repeated reads are byte-equivalent, recursively frozen and mutation-free. Closed
   folio/account status remains eligible when all immutable lineage is exact.
6. Orders367/406/407/408, database acceptance, exact schema/catalogue, setup/referee
   11/11, standing/type/boundary/licence/audit/diff gates remain green.
7. A fresh non-implementing Tier-3 reviewer personally executes the complete proof on
   an isolated exact PostgreSQL16 environment.

## Forbidden

No actor/idempotency, lock/write, schema/migration/table/extension, event/fact/outbox,
series/counter/number allocation, document/invoice/credit/debit note, hash-chain body,
India `ItemList`, `Pos`, `SupTyp`, quantity/UQC/unit price, document residual or
rounding, provider/submission/IRN/QR, API/UI/seed/runtime/local/deploy/merge/push,
Phase7 or application-completion authority.
