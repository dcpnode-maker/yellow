# Order 259 — Configured positive-tax semantic routing

**Status:** BUILT-D672
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/semantic-tax-route`
**Base:** `b9187d7` (approved Order256, current status/local through Order258)
**Risk tier:** 3 — tenant financial-route configuration and account selection
**Owner:** Codex implementation; independent non-implementing Tier-3 execution required

## Outcome

Resolve an exact Order256 eligible quoted-tax reservation and Order251 route-ready
posting plan to explicitly configured revenue and tax transaction-code credit routes.
The caller supplies only tenant, property and reservation identity. The resolver
returns frozen route evidence or an explicit policy-blocked result and writes nothing.

## Fixed contract

Export `PositiveTaxSemanticRouteService.resolve(tx,{tenantId,propertyNode,reservationId})`.
It calls Order256 eligibility in the same tenant transaction, derives the Order251
plan internally and returns a deeply frozen discriminated union.

`policy_blocked` returns the exact ordered Order251 blockers and performs no semantic
route lookup. `resolved` returns the complete Order256 lineage/folio evidence, exact
jurisdiction extension id/owner/key/version/content hash, the internally derived plan,
one `room_revenue` route and one route for each nonzero tax in canonical tax order.
Each route carries only mapping id, exact semantic/tax identity, configured transaction
code and configured credit account id. This order does not assign a transaction code
to the aggregate guest debit.

## Schema boundary

Migration0043 adds one tenant/RLS-scoped `tax_semantic_route` table. Every row binds
an exact property/currency and exact stored jurisdiction identity to either
`revenue/room_revenue` or one canonical tax code and an existing exact
`tx_code_route`. Composite property and configured-route foreign keys, extension and
transaction-code foreign keys, canonical checks and a tenant-leading unique identity
are mandatory. `PUBLIC` and `app_role` receive no mutation; `app_role` receives SELECT
only. No runtime authoring capability is added.

Resolver validation requires revenue `tx_code.grp=revenue`, nonblank USALI, an open
exact-property/currency `revenue` credit account; tax requires `grp=tax` and an open
exact-property/currency `tax_payable` credit account. Names, USALI labels, role hints,
default debit/credit, code coincidence and generic TAX/GST/VAT mappings are never
fallbacks. Extra unrelated mappings are ignored.

No effective date is invented: Order240 already freezes jurisdiction-effective
evidence, while the date basis for future route authoring is unresolved. This table
binds the exact jurisdiction identity/version/hash currently configured.

## Exact scope

- migration0043 and exact schema/acceptance/referee count updates;
- new `src/contexts/tax-fiscal/semantic-route.ts` and context export;
- new intentional-red and real-PostgreSQL focused tests;
- affected Order251, Order256 and financial-route proof;
- this order plus Phase7/build/decision/ledger documentation.

## Forbidden

No route-authoring API/capability/seed/default mapping; no journal/posting/tax_detail,
financial/fiscal/fact/outbox/idempotency write; no account/tx-code creation; no
business date, journal kind, guest-debit tx code or posting-time choice; no India
CGST/SGST/IGST/place-of-supply, document-rounding allocation, effective-date policy,
correction/reversal/document/IRP/HTTP/UI/local/merge/public deploy/Phase7/app-complete
claim.

## Pre-registered proof

- P0 intentional red: module/export/migration are absent.
- P1 exact non-India line-rounded route returns full frozen evidence, one revenue and
  canonical ordered nonzero tax routes.
- P2 zero-tax needs only revenue; multiple taxes preserve canonical order; explicitly
  configured distinct semantic rows may share one liability account.
- P3 generic/name/USALI/default-role/code coincidence never falls back; every missing,
  mismatched, wrong-group, wrong-role, closed or incoherent route fails closed.
- P4 tenant/property/currency/RLS and exact jurisdiction id/owner/key/version/hash
  isolate all lookups.
- P5 document rounding, country IN and aggregate GST blockers return policy-blocked
  with zero semantic-route lookup.
- P6 replay is byte-equivalent, output recursively frozen and every read has zero
  financial/fiscal/evidence effect.
- P7 migration schema, tenant-leading indexes/FKs, RLS and PUBLIC/app ACL are exact;
  app SELECT succeeds while raw mutation fails.
- P8 focused, affected, standing, type, boundary, licence, audit, migration acceptance,
  schema snapshot and fresh referee gates are green.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Exact schema, resolver and P1–P7 proof pass.
- [x] Standing and fresh referee/acceptance/schema gates pass.
- [ ] A non-implementing Tier-3 reviewer personally executes and records proof.

## Build evidence

P0 was captured before production as `0 pass / 1 fail` at the absent migration.
Fresh isolated PostgreSQL 16.15 proof after migrations1–43 passes focused `9/9`
with 131 assertions, database acceptance `11/11` with 26 assertions, migration
runner `38/38` with 169 assertions, schema drift `4/4`, exact 97-table/87-policy
snapshot and referee `11/11`. Adjacent Order251/256/259 proof passes `21/21` with
242 assertions. The standing suite passes `837/837` plus 755 expected
environment skips with 8,508 assertions across 1,592 tests/287 files. Typecheck,
95 import boundaries, 23 dependency licences, zero-vulnerability audit, shell/diff
hygiene and exact migration checksum
`a5036df30f07c4c8add08c46cdb805c71b87597efa542e368e64aa35d572bf40`
are green. All disposable proof infrastructure was removed and the stable local was
untouched. Independent Tier-3 execution remains required before approval.
