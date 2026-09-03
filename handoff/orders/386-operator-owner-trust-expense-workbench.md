# Order 386 — Operator owner-trust expense workbench

**Status:** ACTIVE-D1158
**Phase:** 5 — Financials operator delivery
**Branch:** `phase-5/operator-owner-trust-expense-workbench`
**Base:** exact independently approved Order389 closure `418fe25`
**Risk tier:** 3 — trust money, journals, approvals and tenant/property authority

Deliver a truthful operator journey around the already approved
`TrustAccountingService.postOwnerExpense`. The browser never pastes internal account or
approval identifiers and never authors balance/route evidence. PostgreSQL discovers
same-property owner-trust accounts, derives available/projected balances, prepares the
exact negative-authorization payload under the same deterministic locks as posting,
and rederives it again at final post.

Order384 and Order389 are independently approved, and the founder's explicit approval
of all pending approvals resolves Question185. D1158 activates this exact order.

## Proposed contract

- bounded same-property trust-account discovery returns only account reference/display
  label, owner display label, currency, server-derived available balance and capability
  flags; no owner contacts, payable account, journal, posting or raw ledger data;
- preview accepts exact account, signed-int64 minor amount and bounded reason, then
  returns available/projected balance and whether a distinct approval is required;
- negative approval request is prepared server-side under the canonical account lock
  set and binds exact owner/account/payable/amount/before/projected/reason evidence;
- maker uses exact-property `financials.trust:post`; a different active checker uses
  exact-property `financials.trust:approve-negative`; D975/D980/D981 remain authoritative;
- approval lists/decisions never expose raw payload/hash or identities beyond minimized
  operator labels/status/timestamps;
- final post reuses the existing operation and produces one balanced journal plus its
  already-approved immutable evidence; stale/mismatched/reused approval fails closed;
- middleware owns the tenant transaction for every HTTP request; domain orchestration
  accepts `Tx` and never opens a nested transaction.

## Proposed operator surface

- `/p/:property/trust` with account selector, formatted currency amount, reason,
  authoritative preview, deliberate Request approval/Post actions and checker inbox;
- bounded account, preview, approval-request/list/decision and expense-post routes;
- canonical correlation envelopes and header-only idempotency for mutations;
- no bank payout, owner statement, split, reconciliation or generic approval UI claim.

## Proposed exact scope after activation

- `migrations/0068_prepare_owner_trust_expense.sql` if Question185 approves;
- new `src/contexts/financials/trust-workbench.ts`, minimal loader reuse in `trust.ts`,
  and financials public index;
- `src/http/operator.ts`, `src/app.ts`, `src/server.ts` and operator HTML/JS/CSS;
- focused intentional-red, unit, PostgreSQL, HTTP and browser tests;
- only exact migration/catalogue/schema/runtime-authority oracles made stale by 0067;
- exact trust sections in CONTRACTS/UI-SPEC/SECURITY/EVENTS;
- order/review/decisions/ledger.

No seed unless a separate preflight proves canonical demo truth absent. No permission,
role, generic approval surface, bank/payment effect, payout, statement, reconciliation,
local promotion, deploy, merge or push is admitted.

## Mandatory hostile proof

Exact input/money/reason/idempotency bounds; inactive/foreign actor/property/account/
owner/route/currency concealment; signed-int64 edges; nonnegative approval rejection;
negative missing/pending/rejected/expired/self/foreign/wrong-kind/wrong-subject/
wrong-payload/stale/reused approval; maker/checker separation; concurrent previews/
requests/posts; two spenders serialize; seal races; byte-stable replay/change conflict;
rollback on late evidence failure; runtime DML denial; response privacy; bounded inbox;
stale UI suppression,keyboard/focus/responsive/appearance; all database/static/referee
11/11 gates and fresh non-implementing Tier3 review.
