# Order 262 — Governed positive-tax journal posting

**Status:** READY-D678
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/positive-tax-journal-posting`
**Base:** `dff2302` (approved Order259 plus current sole-local Order261)
**Risk tier:** 3 — financial journal, tax lineage, RLS and runtime DML authority
**Owner:** Codex implementation; independent non-implementing Tier-3 execution required

## Outcome

Post one already-quoted, already-reserved, primary-folio-eligible, explicitly routed
positive-tax stay as one governed balanced journal. The server derives every monetary,
folio, account, route, business-date and lineage value from Orders251/256/259; the
caller supplies only tenant, property, reservation, idempotency and audit identity.

## Fixed contract

Export financials-owned `PositiveTaxPostingService.post(tx,{tenantId,propertyNode,reservationId,
idempotencyKey,envelope})` as a deeply frozen discriminated result. An Order251
`policy_blocked` result returns the exact ordered blockers with zero financial,
fiscal, evidence or idempotency write. A resolved result creates exactly one `charge`
journal with:

1. primary-folio guest debit for exact grand total using the configured room-revenue
   transaction code;
2. configured room-revenue credit for exact base total;
3. one configured tax-payable credit for every canonical nonzero tax line, in exact
   canonical order.

Debit is positive, credits are negative, quantity is fixed descriptive `1.000`, all
amounts are exact signed int64 decimal strings and the PostgreSQL posting set balances
to zero. Zero taxes remain in lineage but create no zero posting line.

The root guest posting line alone carries minimized immutable `tax_detail` version1:
attribution/hold/reservation/segment/folio identity, exact quote/snapshot/currency and
jurisdiction identity, configured revenue/tax semantic mapping and route identity,
plus canonical base/tax/grand lineage. Credit-line `tax_detail` is null. No caller JSON,
amount, date, account, code, route, folio or tax payload crosses this boundary.

## Transaction, lock and evidence boundary

The command uses PostgreSQL idempotency operation `financials.positive-tax.post` and
journal source `financials.positive-tax.post`. Before any idempotency or domain write,
a new read-only Order256/259 discovery seam derives policy, folio and the complete
route/account set without acquiring a financial row lock; policy-blocked truth returns
immediately. Inside the idempotency callback the command repeats read-only discovery,
acquires one bounded owner capability that locks all distinct guest/revenue/tax
accounts in global UUID order and the primary folio, then calls the existing locking
Order259 resolver and requires byte-equivalent eligibility, plan and route evidence.
It locks and rechecks the server-derived property business day before writing.
Route/account/folio/day races fail closed; concurrent same-key calls converge to one
journal, while different keys follow the same global financial lock order. A policy
change between preflight and the callback raises a conflict and rolls back the new
idempotency attempt rather than persisting blocked evidence.

Migration0044 adds append-only tenant/RLS-scoped
`tax_attribution_journal_binding`, exact composite lineage/folio/journal/property
foreign keys, tenant-leading uniqueness, owner-mediated insert capability, the
bounded posting-lock capability and an owner-mediated journal-binding capability.
The app may insert only the already-authorized null-tax journal/line columns. The
binding capability must validate the complete just-inserted journal/line set against
the locked lineage, snapshot and exact semantic routes, then set only the root guest
line's `tax_detail` and append the binding. App role receives no direct
`posting_line.tax_detail` INSERT/UPDATE and no binding-table mutation; it receives
SELECT-only binding access plus EXECUTE on the two exact owner capabilities.

The journal, all lines, one binding, one `journal.posted` fact/outbox pair, one
`tax.attribution_posted` binding fact/outbox pair and completed idempotency receipt
commit atomically. The caller audit operation is fixed to `journal.posted`; the binding
fact uses a server-created envelope copy with fixed `tax.attribution_posted`, never a
caller-selected fact type. Failure at any point rolls everything back. Exact replay
adds no domain row and returns the original receipt; different keys for one immutable
lineage converge through the unique binding to the same journal.

## Exact scope

- `migrations/0044_governed_positive_tax_posting.sql`, `setup.sh`,
  `tests/schema/expected.sql`, database-acceptance/migrate/runtime-DML/referee count
  and authority updates;
- new `src/contexts/financials/positive-tax-postings.ts` and financials export;
- narrow read-only discovery methods/refactor in
  `src/contexts/tax-fiscal/folio-eligibility.ts` and `semantic-route.ts`, with existing
  locking `resolve()` contracts unchanged;
- new `tests/positive-tax-posting.intentional-red.test.ts` and
  `tests/positive-tax-posting.integration.test.ts`, plus affected Order251/256/259,
  financial posting/correction/statement and authority tests;
- `docs/CONTRACTS.md`, `docs/EVENTS.md`, `BUILD-PLAN.md`, this order, Phase7 build,
  decision, ledger and independent review documentation.

## Forbidden

No route/account/transaction-code authoring or fallback; no direct/untaxed charge
behavior change; no India CGST/SGST/IGST/place-of-supply invention; no document
rounding allocation; no negative tax/correction/reversal implementation; no fiscal
document/series/hash/submission/provider/IRP; no payment/settlement/transfer; no
HTTP/UI/seed/local promotion/merge/public or production deployment; no Phase7 or
application-complete claim. Existing correction must reject this taxed journal with
zero write; governed tax correction/reversal is a later order.

## Pre-registered proof

- P0 intentional red proves module/export/migration are absent.
- P1 exact non-India line-rounded one-tax posting creates canonical balanced journal,
  root-only tax detail, binding and two exact fact/outbox pairs atomically.
- P2 zero-tax and multiple-tax posting preserve exact line counts/order/routes and
  zero-tax lineage; shared liability accounts remain valid.
- P3 document rounding, India/aggregate GST and every Order251 blocker return ordered
  policy-blocked evidence with zero writes, including no idempotency row.
- P4 caller money/date/folio/account/code/route/tax payload is impossible; tenant,
  property, currency, lineage, route/account status and actor mismatches fail closed.
- P5 same-key replay is byte-equivalent; changed reuse conflicts; different keys for
  one lineage converge to one journal/binding/evidence; injected failures roll back
  journal/lines/binding/facts/outbox/idempotency.
- P6 route, account, folio and business-day races fail closed; same/different-key and
  ordinary-charge concurrency follows the global account order without duplicate
  journal or deadlock.
- P7 migration table/FKs/checks/index/RLS/ACL/capability definer paths and app/runtime/
  owner authorities are exact; direct app tax-detail/binding mutation stays denied,
  including attempts to combine inherited posting grants into a forged taxed line.
- P8 existing charge correction rejects the taxed source/shape with zero correction;
  untaxed charge/correction/transfer/settlement behavior remains exact.
- P9 focused, affected, standing, type, boundary, licence, audit, migration acceptance,
  schema snapshot and fresh PostgreSQL16.15 referee gates are green.

## Definition of done

- [ ] Intentional red precedes implementation.
- [ ] Exact migration/service and P1–P8 proof pass.
- [ ] Standing and fresh referee/acceptance/schema gates pass.
- [ ] A non-implementing Tier-3 reviewer personally executes and records proof.
