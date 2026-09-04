# Order 410 — Document-series runtime authority containment

**Status:** ACTIVE — D1216
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/persisted-india-final-component-tax-evidence`
**Base:** independently approved Orders408/409 coordination head `abbf7e3`
**Risk tier:** 3 — fiscal numbering authority and tenant/RLS containment
**Owner:** Codex implementation; fresh independent non-implementing Tier-3 reviewer

## Outcome

Remove `app_role`'s table-wide ability to advance any document-series counter while
preserving both existing non-fiscal folio-opening journeys. Migration0073 revokes
direct `UPDATE(next_no)` and exposes one fixed-search-path owner capability that may
allocate only the caller tenant/property's unique `kind='folio' AND fiscal=false`
series. Both primary and additional-window folio paths use that capability.

This is authority containment, not fiscal document issuance. It creates no document,
invoice, item, number, hash-chain or submission truth and does not resolve the later
India invoice-item grouping policy.

## Fixed capability

`allocate_non_fiscal_folio_reference(uuid,uuid)` returns exactly one series id and
formatted reference after locking and advancing the unique tenant/property folio
series. It requires the transaction-local runtime tenant, an existing exact property,
one and only one non-fiscal folio series, bounded prefix/positive signed-int64 counter,
and `app_role` execution only. Ambiguous, absent, fiscal, foreign or overflow truth
fails before mutation. The owner capability has a fixed `pg_catalog,public` search
path; PUBLIC/deploy/runtime roles cannot execute it and `app_role` retains no raw
document-series UPDATE or document INSERT/UPDATE/DELETE.

## Exact scope

- `migrations/0073_document_series_runtime_authority_containment.sql` (new);
- the two document-series allocation sites in `src/contexts/financials/folios.ts`;
- Order410 intentional-red/live containment tests and directly affected existing
  folio, runtime-DML, app-role, migration, database-acceptance, schema/catalogue/setup
  oracles;
- `tests/schema/expected.sql`, `setup.sh`, relevant contract/security/domain/build
  documentation, this order/review, `DECISIONS.log`, `handoff/LEDGER.md`.

Any other path requires a recorded scope amendment before editing.

## Required proof

Intentional red; fresh migration1–73 and byte-exact schema/catalogue; exact capability
owner/signature/search-path/ACL; raw app-role fiscal and non-fiscal counter UPDATE and
document INSERT/UPDATE/DELETE denial; primary and additional folio creation/replay/
rollback; absent/duplicate/fiscal/foreign/overflow rejection with exact unchanged
census; 100 concurrent legitimate folio allocations produce unique gap-free numbers;
two-tenant RLS; Orders118/127/148/256 and financial folio/transfer journeys preserved;
standing/static/referee11/11 and fresh independent Tier-3 execution.

## Forbidden

No document INSERT or issuance capability, fiscal number allocation, hash-chain,
invoice/credit/debit note, India `ItemList`/payload, provider/submission, posting,
correction, API/UI/seed/local promotion/deploy/merge/push or Phase/application
completion authority.
