# Order 192 — Token-only payment lifecycle foundation

**Status:** CHANGES REQUIRED — D-507
**Phase:** 5 — Financials
**Branch:** `phase-5/folio-charge-correction-resumed`
**Base:** `a92659b` (independently approved Order191 local)
**Risk tier:** 3 — payment state, immutable journals, RLS and reconciliation
**Owner:** Codex implementation; independent non-implementing reviewer required

## Outcome

Create one provider-independent durable payment-operation boundary with append-only
attempt and receipt evidence. A deterministic local provider supports authorization,
incremental authorization, one capture, void, refund and reconciliation using only
opaque provider/network tokens. Authorization, increment and void are journal-free;
capture and refund create exact balanced journals. No HTTP or payment UI is admitted.

## Fixed v1 policy

- One operation permits at most one successful capture. Capture may be partial and
  then terminates unused authority; another collection requires another operation.
- Authorization may exceed folio balance for guarantee, but capture may not exceed
  the locked current positive folio-window balance. Deposits and guest credit are
  separate later capabilities.

## Exact scope

- `migrations/0021_token_only_payment_foundation.sql`
- `src/contexts/financials/payment-provider.ts`,
  `src/contexts/financials/payments.ts`, `src/contexts/financials/index.ts`
- `tests/financial-payments.integration.test.ts`
- `tests/operator-party-profiles.integration.test.ts` only to preserve its hostile
  no-PAN sentinel without a contiguous repository PAN literal
- `tests/migrate.integration.test.ts`
- `tests/database-acceptance.integration.test.ts`
- `tests/app-role-nonlogin.integration.test.ts`
- `tests/runtime-database-authority.integration.test.ts`
- `tests/financial-postings.integration.test.ts`
- `tests/schema/expected.sql`, `setup.ps1`, `state.ps1`
- payment sections only in `docs/CONTRACTS.md`, `docs/EVENTS.md`,
  `docs/STATE-MACHINES.md`, `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md`,
  `docs/research/CAPABILITY-MATRIX.md`, and Phase 5 in `BUILD-PLAN.md`
- this order, its questions/review, `DECISIONS.log`, and `handoff/LEDGER.md`

No other file is admitted. An executable oracle outside this list blocks work and
requires a numbered question; scope must not widen silently.

## Required work

1. Commit an intentional P0 red proof importing absent migration/service/provider
   contracts before product code.
2. Preflight live and fixture databases for existing payment rows. Any legacy row
   blocks migration and requires a policy question; never infer/backfill ownership.
3. Migration 0021 adds tenant-leading immutable `payment_operation` and
   `provider_event_receipt`, taking public tables 85→87 and tenant RLS/policies 75→77.
   Add tenant-coherent instrument/operation/folio/payment-predecessor/receipt/journal
   references. Operation, receipt and payment are insert-only; app role receives exact
   select/insert columns and no update/delete/truncate.
4. Operation identity permanently binds tenant, property, guest account/folio,
   instrument, provider, method, currency, governed payment code/clearing route,
   purpose `folio_payment`, key/request hashes and actor. Caller supplies none of the
   authority fields.
5. Receipt identity is unique by provider/event id and stores only content hash,
   bounded provider reference, normalized phase/outcome/amount/currency and time.
   Same id/hash replays; changed content conflicts. Store no raw payload, secret,
   token, Party/contact or card data.
6. Extend existing append-only `payment` rows with operation, predecessor, receipt,
   attempt number and bounded result code. Do not add mutable status or shadow ledger.
7. Add typed `PaymentProvider` and deterministic `LocalPaymentProvider` with authorize,
   incremental-authorize, capture, void, refund and reconcile. Outcomes are approved,
   declined or indeterminate; no network, SDK, fetch, socket or credential.
8. Accept only active same-tenant opaque `card_network_token` or `upi_vpa` instruments
   matching method/provider. Token values reach only the provider port and never
   Results, errors, facts, outbox, idempotency bodies or logs.
9. Use durable prepare → provider call → apply-result seams so a future remote call is
   never held inside a PostgreSQL transaction. Lock operation, then financial rows in
   deterministic order. Indeterminate state blocks later phases except reconciliation.
10. Derive state from append-only attempts: authorize → increment* → one capture or
    void; capture → refund*. Failures do not advance; void is terminal; cumulative
    refunds cannot exceed capture; all money is canonical positive int64 text.
11. Auth/increment/void create no journal. Capture posts guest folio `-amount` and
    governed card/UPI clearing `+amount` on the current open property date. Refund
    posts exact sign-negated capture legs and links to the capture payment/journal;
    do not use correction-only `journal.reverses` for repeated partial refunds.
12. Emit minimized lifecycle events and `journal.posted` where applicable, atomically
    with fact/outbox/idempotency. Provider success is the only local money path; late
    success/failure reconciles once from a durable receipt.
13. Add executable no-PAN/CVV scanning across runtime source/assets, migrations,
    seeds and evidence fixtures. Preserve hostile Party rejection without retaining
    a contiguous PAN literal.

## Forbidden

- PAN/CVV/forms/raw provider payloads/credentials, PSP network calls or SDKs
- HTTP callbacks, hosted UI/links, instrument enrollment/tokenization endpoint
- deposits, cash/bank/cashier, settlement/checkout, trust/AR/tax/fiscal/FX/disputes
- mutable financial history, overpayment, multiple captures, caller authority fields
- editing `0001_init.sql` or an applied migration
- local promotion, merge, push, public/production deployment or Phase completion

## Pre-registered proof

- **P0 red:** absent migration/service/provider imports fail before product code.
- **P1 schema/security:** fresh 1–21 proves 87 tables, 77 RLS/policies, composite
  references, insert-only ACLs, tenant isolation and no PAN/CVV storage or leakage.
- **P2 state:** authorize/increments/void append a causal chain with zero journals;
  illegal/terminal/foreign/unsafe/over-authorized commands have zero effects.
- **P3 money:** one balance-capped capture and bounded partial refunds use exact
  signs, balance, open property date/currency, routes and sealed-day authority.
- **P4 concurrency/reconciliation:** twenty same-key/capture/refund racers, changed
  request, receipt replay/content conflict, late reconciliation and injected rollback
  prove one durable effect without excess money.
- **P5 hostile/standing:** authority mismatches and malformed/zero/overflow money fail;
  inherited suites, schema/deployment, standing, typecheck, boundaries, licences,
  audit and fresh referee 11/11 pass.
- **P6 independent review:** a non-implementer personally executes P1–P5 on a fresh
  database and records commands/findings/results before approval.

## Definition of done

- [ ] Intentional red precedes product/migration code.
- [ ] Stable operation, append-only attempts and durable receipts are proven.
- [ ] Auth/increment/void remain journal-free; capture/refund journals are exact.
- [ ] No-PAN, tenancy, concurrency, replay/reconciliation and rollback proofs pass.
- [ ] Current schema/oracles and referee 11/11 pass.
- [ ] Independent Tier-3 review approves the exact candidate.
