# Order 407 — Governed India final component-tax journal posting

**Status:** CHANGES REQUIRED — D-1207 ORDERED-LOCK PROOF HANG
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/persisted-india-final-component-tax-evidence`
**Base:** independently approved Order406 coordination head `49e237f`
**Risk tier:** 3 — statutory tax, financial journals, tenant/RLS and immutable lineage
**Owner:** Codex implementation; fresh independent non-implementing Tier-3 reviewer

## Outcome

Post one approved current Order367 India accommodation final component-tax root as
one governed balanced charge journal. The server derives the primary folio, guest
account, current property-local open business date, all amounts, component identities,
transaction codes, accounts and statutory lineage from approved Orders256 and 406.
The caller supplies identity, idempotency and audit authority only.

## Fixed posting contract

`IndiaFinalComponentTaxPostingService.post(tx,{tenantId,propertyNode,reservationId,
idempotencyKey,envelope})` creates exactly one journal per immutable final-tax root:

1. guest receivable debit `+grandTotalMinor`;
2. room-revenue credit `-transactionValueMinor`; and
3. one tax-payable credit per nonzero persisted IGST/CGST/SGST/UTGST component in
   Order406 canonical order.

Zero-rounded components remain durable lineage but create no zero posting. Currency
is INR, every amount is a canonical signed-int64 decimal string, and the journal must
balance exactly to zero. This is an aggregate posting for the already-aggregated
approved final-tax root; no room-night recomputation or re-rounding occurs.

The root guest line alone carries canonical immutable
`india_accommodation_component_tax_v1` detail binding tax id/generation/hash,
valuation and applicability identity/hash, reservation/folio/property, INR totals,
component family, exact global jurisdiction identity, revenue route and every ordered
component including zero components and null route only for zero. Credit-line tax
detail is null.

## Authority and transaction boundary

- Reuse Order256 to derive and lock the exact open primary folio and coherent guest
  account; require its folio to equal the Order406 selector/result.
- Reuse Order406 before idempotency, inside the callback and after globally ordered
  financial locks; all three results must be byte-equivalent.
- Reuse the bounded financial account/folio lock and property-local business-day
  lock/recheck patterns from approved Order262. The current business day must exist
  and be unsealed immediately before writing.
- New operation/source is `financials.india-final-component-tax.post`.
- Same-key replay is byte-equivalent; changed reuse conflicts; different keys for
  one tax root converge to one journal through the database binding.
- Emit `journal.posted` and
  `india_gst.accommodation_final_component_tax_posted` fact/outbox evidence atomically
  with journal, lines, binding and completed idempotency receipt.

Migration0071 adds one append-only, tenant-leading, forced-RLS, SELECT-only-to-app
`india_gst_accommodation_final_component_tax_journal_binding` plus exact composite
foreign keys to the persisted tax root and journal. Uniqueness is by `(tenant_id,
tax_id)` and `(tenant_id,journal_id)`; reservation-wide uniqueness is deliberately
not invented. One fixed-search-path owner capability, executable only through the
existing runtime/app path, re-reads current tax/valuation/applicability/components
and configured routes, validates the complete already-inserted null-tax credit set,
inserts the absent root line with exact tax detail, and appends the binding. Direct
tax-detail or binding DML remains denied.

## Exact scope

- `migrations/0071_governed_india_final_component_tax_posting.sql` (new)
- `src/contexts/financials/india-final-component-tax-postings.ts` (new)
- `src/contexts/financials/index.ts`
- `tests/india-final-component-tax-posting.intentional-red.test.ts` (new)
- `tests/india-final-component-tax-posting.integration.test.ts` (new)
- `tests/schema/expected.sql`, `setup.sh`
- exact catalogue/authority oracle updates in
  `tests/setup-current-catalogue-oracle.test.ts`,
  `tests/database-acceptance.integration.test.ts`, `tests/migrate.integration.test.ts`,
  `tests/app-role-nonlogin.integration.test.ts`,
  `tests/runtime-database-authority.integration.test.ts`,
  `tests/financial-postings.integration.test.ts`,
  `tests/positive-tax-posting.integration.test.ts`,
  `tests/positive-tax-correction.integration.test.ts`
- `docs/CONTRACTS.md`, `docs/EVENTS.md`, `BUILD-PLAN.md`
- this order, its review, `handoff/LEDGER.md`, `DECISIONS.log`

Any other product, schema, test or governance path requires a recorded scope
amendment before editing.

## Required proof

Intentional red; IGST, CGST+SGST and CGST+UTGST at 5/12/18 percent; multi-night and
rounding residuals; zero-rounded components; signed-int64 boundaries and exact
balance/order; exact root-only tax detail; current/superseded/forked/foreign lineage;
route/account/folio/day drift before and after locks; sealed day; same-key replay,
changed reuse, different-key convergence and contention; injected failure rollback;
direct DML/ACL/definer-path containment; two-tenant RLS; complete financial/fiscal/
fact/outbox/idempotency census; existing Order262 and correction behavior unchanged;
fresh migration/schema/catalogue/seed/referee11/11, standing/static gates and fresh
independent Tier-3 execution.

## Forbidden

No caller money/date/folio/account/code/route/tax payload; no heuristic routing; no
tax recalculation; no edit/delete of financial or fiscal history; no correction,
reversal, refund, payment, settlement or transfer; no document, series, invoice
number, IRP/provider/submission; no HTTP/UI/seed/local promotion/merge/deployment or
Phase/application completion authority. India-specific correction is a later order.
