# Order 104 — Balanced charge posting

**Phase:** 5  
**Branch:** `phase-5/balanced-charge-posting`  
**Base:** `01dcddd`  
**Risk tier:** 3 — journals, posting integrity, RLS and business-day sealing  
**Owner:** Codex implementation; independent non-implementing reviewer required

## Outcome

Post one untaxed revenue charge to an open account-owned folio through a single strict
financial command. The command derives property, currency, business date and configured
credit account from PostgreSQL, writes one debit-positive/credit-negative two-line
journal, and commits immutable postings, minimized fact/outbox evidence and durable
idempotency atomically. No caller or browser chooses ledger accounts or dates.

## Natural-Solution Test

The baseline journal, posting, folio balance, business-day latch, facts, outbox and
idempotency are the right aggregates, but their current single-column foreign keys allow
cross-tenant/date/account mismatches, the day-open trigger races sealing, and `tx_code`
role hints cannot select between multiple same-role revenue accounts. The natural
solution is one forward integrity migration, one tenant-scoped `tx_code_route` mapping,
and one financial service. It is not a balance cache, tax engine or arbitrary-line API.

## Scope

- `migrations/0010_financial_posting_integrity.sql`
- `src/contexts/financials/postings.ts`, `src/contexts/financials/index.ts`
- `tests/financial-postings.integration.test.ts`
- `tests/migrate.integration.test.ts`, `tests/database-acceptance.integration.test.ts`,
  `tests/schema/expected.sql`
- `setup.sh`, `setup.ps1`, `state.sh`, `state.ps1` for the exact 85-table accounting
- `docs/CONTRACTS.md`, `docs/DOMAIN-MODEL-V1.md`,
  `docs/research/CAPABILITY-MATRIX.md`
- `src/project-status.ts`, `tests/founder-status.integration.test.ts` only after green
- this order, `handoff/PHASE-5-PLAN.md`, `handoff/LEDGER.md`, `DECISIONS.log`,
  `handoff/questions/`, and the independent review record

## Required work

1. Migration 0010 adds tenant-leading candidate keys and composite references so
   journal property/reversal and posting journal/account/folio relationships cannot
   cross tenants; a folio-bearing line's account must own that folio, and each line's
   business date/currency must equal its journal while its currency equals its account.
   A deterministic migration-only currency backfill derives existing posting metadata
   from its journal before `NOT NULL`; it changes no amount, account, folio or economics.
2. Add `tx_code_route`, raising the exact public-table count from 84 to 85. Its primary
   key is tenant + property + currency + tx code; optional debit/credit account ids use
   tenant/property/currency-coherent foreign keys with at least one side configured.
   Enable tenant RLS and grant `app_role` SELECT only. Revoke app-role mutation of the
   global `tx_code` catalogue. Order 104 reads only the required credit route; route
   authoring/versioning is later scope.
3. Replace the day-open trigger implementation so it selects the exact
   tenant/property/date row `FOR SHARE`, rejects a missing or sealed day, and therefore
   serializes with `seal_business_day`. Seal rejects tenant arguments that differ from
   transaction-local authority. Do not weaken adjustment/correction semantics.
4. Add `ChargeService.postCharge(tx,input)` with the exact input: tenant id, folio id,
   tx code, positive canonical int64 decimal-string total `amountMinor`, canonical
   positive quantity string with at most three decimals (default `1.000`), idempotency
   key and `journal.posted` audit envelope. Unknown fields fail. Amount is the total;
   quantity is descriptive and never multiplied or rounded.
5. Lock and validate one open guest folio/account and exact audit property. Derive its
   currency and the transaction-stable property-local calendar date. Require the exact
   unsealed business day, a revenue tx code with attributable USALI line and
   `default_cr='revenue'`, and one configured open revenue credit account for the exact
   tenant/property/currency/code. Never pick by row order, name or caller input.
6. Post one `kind='charge'` journal with exactly two same-code/date/currency/quantity
   lines: sequence 1 debits the guest folio/account `+amount`; sequence 2 credits the
   configured revenue account `-amount` with no folio. Verify the computed sum is zero;
   PostgreSQL's deferred balance trigger remains the final guard. `folio_balance`
   therefore increases by the positive amount.
7. Wrap the whole effect in `PostgresIdempotency` namespace
   `financials.charge.post`. Emit one minimized `journal.posted` fact/outbox event in the
   same transaction. JSON represents bigint money as canonical decimal strings and
   carries no Party/contact/note/token/raw reservation data. Exact replay returns the
   same journal; changed content conflicts.
8. Document honestly: this is an untaxed single revenue amount. Tax-inclusive/net
   allocation, scheduled/nightly charging, extra lines, statements/UI/API, transfers,
   reversals/adjustments, payments, deposits, settlement, trust, fiscal documents,
   cashier, AR and day roll remain later orders.

## Forbidden

- Editing any existing migration, `tests/run_invariants.py`, or historic financial
  amounts/accounts/folios; new balance/cache/shadow-ledger mutation
- Caller-selected property, currency, date, journal kind, route or account; arbitrary
  posting lines; float/JS-number money; amount×quantity calculation
- Tax/tax-detail/tax-payable posting, payment/refund/deposit, transfer, reversal,
  adjustment, settlement, FX, trust, AR, cashier, fiscal/statutory document or day roll
- HTTP/UI/worker/automation, reservation transition, tx-code or route authoring command
- Self-review, self-merge, out-of-scope files or weakened referee assertions

## Pre-registered proof

### P0 — intentional red

A focused test imports `ChargeService` from the financial context and fails before
production/migration work because the export is absent.

### P1 — database financial truth

Fresh migrations 0001–0010 and exact schema prove 85 tables, route RLS/SELECT-only ACL,
tenant/property/date/currency/account/folio composite constraints, immutable journal and
posting ACLs, missing-day rejection, balanced commit and unbalanced `P0010` rejection.

### P2 — exact canonical charge

One charge posts `+12345` to the guest folio and `-12345` to the configured revenue
account with exact code, quantity, currency and property-local business date; journal
sum/trial balance is zero, folio balance is `12345`, and minimized fact/event/idempotency
are exact. Excluded money/compliance tables stay unchanged.

### P3 — replay, rollback, concurrency and seal serialization

Exact replay is byte-equivalent; changed requests conflict; twenty same-key calls have
one effect. Failure after real outbox insertion rolls back journal, lines, balance,
fact/event/idempotency and permits exact retry. Deterministic charge-first and seal-first
races prove the day row lock: a committed charge precedes seal, while a committed seal
makes the waiting charge fail `P0011` without artifacts.

### P4 — hostile financial boundaries

Malformed shapes/money/quantity/envelopes, foreign tenant/property/currency, closed
folio/account, missing/ambiguous/wrong route, non-revenue or unattributed code, missing or
sealed day and inconsistent stored relationships fail without artifacts. Tenant B sees
zero tenant-A journals/postings/balances and cannot seal or reference A truth.

### P5 — ledger stress and project gates

Five hundred distinct bounded-concurrency charges create exactly 500 journals and 1,000
immutable lines; every journal and global/property/date/currency trial balance is zero,
guest and revenue sums are exact opposites, and a 500-key replay burst changes nothing.
Focused proof, migration/deployment, exact schema, typecheck, boundaries, standing,
licences/audit, protected hashes and pristine 85-table referee pass. A non-implementing
Tier-3 reviewer personally executes P1–P5 on fresh PostgreSQL.

## Definition of done

- [x] Order exists before implementation.
- [x] Intentional P0 red is committed before production/migration code.
- [x] PostgreSQL enforces tenant/date/currency/folio-account financial coherence.
- [x] Canonical charge signs, balance, routing and bigint evidence are exact.
- [x] Replay, rollback, seal races and 1,000-line stress pass without drift.
- [x] No tax/payment/fiscal/trust/settlement/day-roll behavior enters the slice.
- [x] Standing/referee gates pass and scope is exact.
- [ ] Independent reviewer approves executed proof.
