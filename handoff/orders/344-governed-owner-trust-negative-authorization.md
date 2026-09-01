# Order 344 — Governed owner-trust negative authorization

**Status:** REVIEW-WITHHELD — stale review-seed least-scope oracle
**Phase:** 5 — Financials
**Branch:** `phase-5/governed-owner-trust-negative-authorization`
**Base:** `d9e43c0` (D974-approved Order345/343/342 and Phase6 exit)
**Risk tier:** 3 — immutable owner trust accounting and four-eyes authorization
**Owner:** Codex implementation; fresh independent non-implementing Tier-3 reviewer

## Outcome

Implement the founder-approved Phase-5 constitutional guard for one accounting-only
owner expense: debit one exact party-owned trust account and credit one configured
same-property/currency payable. Available owner funds equal the negated immutable
posting sum. A spend that would make available funds negative must consume one exact,
different-user, four-eyes approval; a non-negative spend needs only dedicated post
authority. No bank movement or owner statement is created.

## Ratified policy and natural solution

Founder-approved Question140-F at historical commit `cea3099` is authoritative. Reuse
the current owner Party role, trust/payable accounts, `tx_code_route`, immutable
`journal`/`posting_line`, `approval_request`, durable idempotency, fact/outbox and
financial locking. Do not create a parallel owner ledger or mutable balance cache.

One insert-only `trust_negative_authorization` table is the smallest durable relational
evidence that binds a consumed negative decision to the exact approval, trust account,
journal, amount, balance before and projected balance after. Reuse
`journal.approval_request_id` and its existing tenant-leading one-use constraint.

The database capability must deterministically lock the trust/payable accounts, derive
`available_minor = -SUM(posting_line.amount_minor)` under lock, validate the approval
under lock only when the projection is negative, and atomically write the balanced
journal, two posting lines, authorization record, idempotency result, fact and outbox.
No caller description or JSON grants authority.

## Migration and exact catalogue allocation

- next migration: `0060_owner_trust_negative_authorization.sql`;
- expected after build: 60 migrations, 111 public base tables, 101 tenant RLS tables/
  policies, 2 views; FORCE-RLS count unchanged;
- re-run this allocation and every exact catalogue oracle after Order343 before the
  intentional red. If it is no longer exact, stop and amend this order—never collide.

## Exact product contract

`TrustAccountingService.postOwnerExpense(tx,input)` accepts only an exact trust-account
id, canonical positive signed-int64 decimal amount, bounded reason, optional approval
request id, idempotency key and server audit envelope. It derives tenant, actor,
property, currency, owner Party role, current property-local business date, account
status and route. It uses one dedicated `OWNER_TRUST_EXPENSE` paid-out route from trust
to payable and emits minimized `journal.posted` plus
`trust.owner_expense_posted` in the same transaction.

Exact scopes:

- `financials.trust:post` for the accounting command;
- `financials.trust:approve-negative` for a distinct approver.

No HTTP or UI surface is admitted by this order.

## Exact scope

- `migrations/0060_owner_trust_negative_authorization.sql`;
- `src/contexts/financials/trust.ts` and `src/contexts/financials/index.ts`;
- new focused intentional-red/unit/integration tests for this command;
- current exact migration/catalogue/schema/runtime-authority tests only as required by
  migration0060 and the one bounded capability;
- `setup.sh` only for its exact post-migration base-table/policy catalogue oracle;
- `tests/schema/expected.sql` and `scripts/seed-review.ts`;
- trust-only sections of `docs/CONTRACTS.md`, `docs/EVENTS.md`,
  `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md`, `BUILD-PLAN.md` and
  `handoff/PHASE-5-PLAN.md`;
- this order, `handoff/reviews/344-governed-owner-trust-negative-authorization.md`,
  `DECISIONS.log`, `handoff/LEDGER.md` and `handoff/ROADMAP.md`.

## Hostile executable proof

1. Intentional red precedes migration/service implementation.
2. Fresh migrations1–60 produce exactly 111/101/2, tenant-leading FKs/indexes/RLS,
   insert-only authorization truth, correct ACL/search path and no raw runtime/app DML.
3. Seeded trust posting sum `-10000` means available `10000`; spend `4000` succeeds
   without approval; a subsequent `7000` is zero-mutation denied without approval;
   one exact approved `7000` succeeds once and leaves available `-1000`.
4. Pending, rejected, expired, self-approved, foreign, reused, stale or payload-
   mismatched approvals fail closed. Wrong owner role, account state, route, currency,
   property, actor, tenant, date, zero/negative/overflow amount also leave no artifact.
5. Exact replay returns one effect; changed content conflicts; distinct-key concurrent
   spenders serialize; one approval cannot authorize two journals.
6. Seal-first denies; post-then-seal remains coherent; injected late failure rolls back
   journal, lines, authorization, fact/outbox and idempotency and permits clean retry.
7. Standing/static/schema/authority gates and fresh referee11/11 pass. A different
   fresh Tier-3 reviewer personally executes financial, tenancy, approval, race and
   rollback proof before approval.

## Forbidden

- bank/provider payout, payment execution, owner allocation, commission, statement,
  split, three-way reconciliation, generic trust workbench or approval inbox;
- HTTP/API/UI/local promotion, tax/fiscal/document/IRP, AR, checkout or day-close;
- mutable balance cache, UPDATE/DELETE/TRUNCATE of immutable financial evidence,
  browser/caller balance or approval authority, number money or cross-currency math;
- any migration before0060, `migrations/0001_init.sql`, `.yellow`, credentials,
  port3000, stable Order335, merge, push, public deployment or Phase-complete claim.

## Definition of done

- [x] Order343 is approved and migration/catalogue allocation is revalidated.
- [x] Intentional red and bounded implementation proof pass on fresh PostgreSQL.
- [x] Exact schema and authority gates pass without weakening; standing/referee evidence is recorded in D977.
- [ ] Fresh independent non-implementing Tier-3 approval is recorded.

## Activation

D975 activates implementation after D974 satisfies the prerequisite. Exact allocation
is revalidated at 59 migrations ending0059, 110 base tables, 100 tenant RLS policies,
10 FORCE-RLS tables and 2 views; migration0060 and expected111/101/10/2 remain free
and exact. No product or schema path changed during activation.

## Scope amendment

D976 admits `setup.sh` before retaining its provisional edit because the repository's
mandatory setup gate independently exact-counts the post-migration base tables and RLS
policies. Only the expected 110→111 table and 100→101 policy totals may change; command
behavior, referee expectations and every other setup assertion remain byte-equivalent.
