# Order 183 — Governed folio charge correction

**Status:** READY — corrected by D-468/D-469 / Question167
**Phase:** 5 · financial operations and founder UAT
**Branch:** `phase-5/folio-charge-correction`
**Base:** `144753b` (independently approved current local through Order182)
**Risk tier:** 3 — immutable financial reversal and concurrent correction arbitration
**Owner:** Codex implementation; independent non-implementing financial reviewer

## Outcome

Give an authorized operator a safe recovery path after posting an incorrect governed
folio charge. The operator selects one eligible original charge, enters a bounded
reason, previews the effect, and creates a new balanced adjustment journal that exactly
negates the complete original journal. The original journal and posting lines remain
untouched.

## Natural-solution test

This is money movement, so existing `account` + `folio` + `journal` + `posting_line`
primitives solve it. `journal.reverses` already records lineage and the existing
financial lock, business-day, fact, outbox and idempotency primitives supply authority.
No table, column, migration, alternate ledger or mutable balance is needed.

## Scope

- new `src/contexts/financials/corrections.ts` and export from its `index.ts`;
- `migrations/0019_financial_reversal_authority.sql`, the derived expected schema,
  exact migration-acceptance entry and runtime-DML authority proof;
- `src/contexts/financials/statements.ts` only to expose unambiguous
  `reversesJournalId`, `reversedByJournalId` and server-derived correction eligibility;
- `src/app.ts` and `src/http/operator.ts` for one exact property-scoped correction route;
- existing operator HTML/JavaScript/CSS for one progressive `Correct posting` folio
  action that refreshes the authoritative statement and balance;
- `scripts/seed-review.ts`, `scripts/seed-scenario-review.ts` and focused seed tests
  only to provision normal correction authority separately from approver-only post-seal
  authority across the three review properties;
- focused domain/HTTP/UI tests and directly affected existing statement/folio tests;
- `docs/CONTRACTS.md`, this order, additive D-467, ledger and independent review.

No table/column/view/function, account/route authoring, partial-line correction,
transfer, additional folio window, payment/provider/token, settlement, cashier/day-close,
deposit, trust, tax/fiscal/document, checkout, credential, public bind, second local,
merge, push or production deployment is in scope.

## Command contract

1. `ChargeCorrectionService.reverseCharge(tx, input)` accepts server-derived tenant,
   actor and property, exact folio UUID, exact original journal UUID, bounded visible
   reason, idempotency key and audit envelope. The amount is never accepted from the
   browser.
2. Lock the folio/account financial rows, original journal and any reversal evidence
   deterministically. The original must be a governed `charge` on the exact open folio,
   same tenant/property/currency, with a complete balanced posting set. Reject a
   reversal-of-reversal, a second reversal, wrong property/folio and malformed reason
   generically.
3. Insert one `adjustment` journal on the current property-local business date
   with `reverses=original.id`, then insert exact sign-negated copies of every original
   posting line. Preserve accounts, folio lineage, currency and governed tx code;
   tax detail remains null. Never update/delete original financial rows. Existing
   Invariant 7 remains exact: a correction/adjustment may post after seal, while an
   ordinary charge may not.
4. Normal correction requires `financials.adjustments:write`. If the target business
   day is sealed, the authenticated actor must additionally carry exact property-scoped
   `financials.adjustments:post-seal`; this boolean is derived only from verified token
   scopes/grants and is never accepted from JSON. The review operator lacks post-seal
   authority; the distinct review approver has it across Yellow Demo, Riverstone and
   Harbourlight. This is an authorization boundary, not an implied two-person approval.
5. Fact, `journal.posted` outbox event and durable idempotency settle in the same
   transaction. Exact replay returns the same result; changed payload under the same
   key conflicts; publisher or audit failure rolls everything back.
6. The operator route is `POST
   /api/v1/properties/{property}/folios/{folioId}/adjustments`, requires exact new
   `financials.adjustments:write` scope, mandatory `Idempotency-Key`, and body exactly
   `{reversesJournalId, reason}`. It never trusts tenant, actor, property, currency or
   amount from JSON.

## Statement and UI contract

1. A correction row exposes `reversesJournalId` (the original it negates). An original
   row exposes `reversedByJournalId` only when a correction exists. The ambiguous old
   `reversalJournalId` name and incorrect “Reversed by” direction are removed together.
2. Only server-eligible original charge rows offer `Correct posting`; corrections and
   already-corrected rows are never actionable. A sealed-day row is actionable only for
   an actor with post-seal authority. The workflow shows original amount,
   resulting balance effect and irreversible-ledger explanation before submit.
3. Keyboard, focus restoration, pending/error/retry, narrow viewport, 200% zoom,
   reduced motion, dirty-exit confirmation and exact no-secret/no-storage/no-third-party
   asset rules remain green.

## Pre-registered proof

- canonical correction creates exactly one balanced adjustment journal and exact
  sign-negated lines; original row bytes/hashes and counts remain unchanged;
- exact replay is a no-op and changed-key, duplicate, reversal-of-reversal,
  cross-tenant/property/folio, malformed reason and unauthorized scope fail closed;
- a 20-way race yields exactly one correction winner and no deadlock/drift;
- a sealed day accepts only the correction while rejecting ordinary charge posting;
  fact/outbox/idempotency and injected failure rollback proofs pass;
- on a sealed day the ordinary review operator receives generic forbidden with zero
  mutation, the distinct authorized approver succeeds, and a body/header authority
  forgery cannot cross the verified-scope boundary;
- migration 0019 grants only `journal.reverses` INSERT authority beyond the existing
  catalogue and enforces one tenant-bound reversal per original at the database layer;
- statements report both lineage directions correctly across keyset pages; INR and CAD
  examples preserve currency and return the exact refreshed balance;
- served operator workflow completes by keyboard and remains contained at mobile,
  desktop and 200% zoom;
- focused suites, standing tests, typecheck, boundaries, licences, audit, exact schema
  and fresh referee 11/11 pass;
- independent Tier-3 reviewer personally executes the financial/concurrency proofs.

## Definition of done

- [ ] Users can lawfully correct an erroneous charge without mutating history.
- [ ] Reversal lineage and UI language are directionally correct.
- [ ] Concurrency, replay, tenancy, balance and sealed-day proofs pass.
- [ ] Post-seal corrections are restricted to explicitly authorized property users.
- [ ] Independent Tier-3 review approves the exact candidate.
