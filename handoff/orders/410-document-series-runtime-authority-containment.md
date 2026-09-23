# Order 410 — Document-series runtime authority containment

**Status:** APPROVED — CLOSED — D1218
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

## Builder evidence — D1217

Migration0073 and both production folio call sites are implemented in exact scope.
Fresh isolated PostgreSQL16 applies migrations1–73 with exact catalogue73/124/
114/114/23/2 and a regenerated schema body; migration SHA-256 is
`d5cef790f3f75f902de457d22e21f272530a77257f65daac1bb5e6e51f1688aa`.
Focused Order410 passes6/0 (53 expectations), including direct runtime/deploy
capability denial, document/fiscal/non-fiscal raw-DML denial, exact rejection census,
rollback, primary/additional journeys and100 concurrent allocations across two
tenants. Existing primary-folio passes12/0(90), multi-window/transfer8/0(47), runtime
DML5/0(119), strict typecheck and diff check pass. Standing passes1330/0 plus1040
expected database-gated skips (19,662 expectations across439 files).

During integration, the existing primary-folio live harness was correctly separated
into deploy fixture and runtime command URLs, and SQLSTATE22023/40001/55000 from the
bounded allocator was mapped back to the established `FolioConflictError` contract.
Stable/default databases, local port3000 and retained `.yellow` were untouched.
Fresh non-implementing Tier-3 execution was mandatory and is satisfied by D1218.

## Fresh independent Tier-3 approval — D1218

Fresh non-implementing reviewer `/root/order410_fresh_tier3` approves exact
candidate `acee3cc`. Personal official upstream PostgreSQL16.15 execution passes
migrations1–73, exact catalogue and raw normalized schema, focused6/0 including the
two-tenant 100-way gap-free proof, preserved folio/transfer/runtime/Order408
adjacencies, referee11/11, standing1330/0 and all available static gates. The bounded
registry audit transport was unavailable twice; Order410 changes no dependency or
lock file and no audit pass is claimed. Full evidence is recorded in
`handoff/reviews/410-document-series-runtime-authority-containment.md`.
