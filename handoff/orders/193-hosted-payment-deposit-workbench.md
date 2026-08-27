# Order 193 — Hosted payment and deposit workbench

**Status:** READY — D-510
**Phase:** 5 — Financials
**Branch:** `phase-5/folio-charge-correction-resumed`
**Base:** `5a16caa` (independently approved Order192)
**Risk tier:** 3 — bearer links, signed callbacks, deposit liabilities and journals
**Owner:** Codex implementation; independent non-implementing reviewer required

## Outcome

Staff can create an expiring deposit-payment link, a guest can complete a synthetic
zero-cost payment on a separate loopback provider origin, and a separately authorized
operator can partially or fully apply captured deposit liability to a folio. Payment
truth comes only from the approved Order192 receipt/reconciliation boundary; browser
return values are informational and this order never settles or closes a folio.

## Fixed v1 policy

- Links expire after 24 hours. Regeneration atomically revokes the older active link.
- Deposit capture posts clearing debit and deposit-liability credit without changing
  the folio. Application posts deposit-liability debit and guest-folio credit.
- Application is capped by both captured value less prior applications and the locked
  current positive folio-window balance. Remainder stays deposit liability.
- The local provider supports synthetic approve, decline, cancel and timeout only. It
  has no network dependency, account, payment SDK, card/bank/VPA input or real money.

## Exact scope

- `migrations/0022_hosted_deposit_workbench.sql`
- `src/contexts/financials/hosted-deposits.ts`,
  `src/contexts/financials/payments.ts`, `src/contexts/financials/index.ts`
- `src/http/operator.ts`, `src/app.ts`, `src/http/provider.ts`
- `src/http/operator/index.html`, `src/http/operator/operator.js`,
  `src/http/operator/operator.css`
- `src/http/guest/index.html`, `src/http/guest/guest.js`, `src/http/guest/guest.css`
- `src/http/provider/index.html`, `src/http/provider/provider.js`,
  `src/http/provider/provider.css`
- `docker-compose.yml`, `package.json`
- `tests/hosted-deposits.integration.test.ts`,
  `tests/hosted-deposit-http.integration.test.ts`,
  `tests/hosted-deposit-assets.test.ts`,
  `tests/hosted-deposit-uat.integration.test.ts`,
  `tests/hosted-deposit-workbench.intentional-red.test.ts`
- `tests/operator-folio-workbench.integration.test.ts`,
  `tests/operator-assets-security.test.ts`, `tests/financial-payments.integration.test.ts`
- `tests/review-seed.integration.test.ts`, `tests/seed_fixture.sql`,
  `tests/migrate.integration.test.ts`, `tests/database-acceptance.integration.test.ts`,
  `tests/app-role-nonlogin.integration.test.ts`,
  `tests/runtime-database-authority.integration.test.ts`
- `tests/schema/expected.sql`, `setup.ps1`, `state.ps1`
- hosted-deposit sections only in `docs/CONTRACTS.md`, `docs/EVENTS.md`,
  `docs/STATE-MACHINES.md`, `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md`,
  `docs/research/CAPABILITY-MATRIX.md`, and Phase 5 in `BUILD-PLAN.md`
- this order, its numbered questions/review, `DECISIONS.log`, and `handoff/LEDGER.md`

No other file is admitted. An executable oracle outside this list blocks work and
requires a numbered question; scope must not widen silently.

## Required work

1. Commit an intentional P0 red proof for absent schema, domain, callback, guest,
   provider and operator-workbench markers before product code.
2. Migration 0022 adds tenant-leading `hosted_payment_request` and insert-only
   `deposit_application`, taking public tables 87→89 and tenant RLS/policies 77→79.
   Every tenant table uses coherent composite references, leading tenant indexes,
   fail-closed RLS and exact select/insert-only application grants.
3. Extend the Order192 operation purpose domain with `deposit`. A hosted request binds
   tenant, property, folio window, operation, positive amount/currency, creator,
   expiry, revocation and SHA-256 of a cryptographically random 256-bit bearer. Return
   raw bearer once only; never persist, log, event, fact, cache or browser-store it.
4. A distinct loopback provider origin receives a signed short-lived handoff containing
   only correlation, amount, currency, return URL and expiry. Its deterministic UI has
   approve/decline/cancel/timeout and no sensitive inputs, iframe, external asset,
   fetch to a PSP, credential, account or cost.
5. The callback reads bounded raw bytes before parsing and verifies provider/version,
   exact path, timestamp window, event id and HMAC in constant time. Invalid, stale,
   future, oversized or altered input reveals no tenant existence and creates no
   receipt. Valid input delegates only to Order192 durable receipt/reconciliation.
6. Guest pages disclose only property display name, folio reference, amount, currency
   and expiry. Continue returns 303 to the provider origin. Guest return ignores all
   supplied success/status/reference/amount parameters and renders only fresh server
   truth with bounded manual refresh/polling. Enforce no-store, no-referrer, strict CSP,
   no cookies/local/session storage and token/identity/generation stale guards.
7. Deposit capture creates the approved balanced clearing/deposit-liability journal
   and no folio movement. Application locks capture, prior applications, folio window,
   accounts and business day in deterministic order; it posts one immutable balanced
   liability/guest-folio journal and `deposit.applied` evidence atomically.
8. Staff routes use distinct `financials.payments:read`,
   `financials.payments:write`, and `financials.deposits:apply` scopes with exact
   property grants, durable actor-bound idempotency, no-store responses and generic
   cross-tenant denials. The operator UI uses server amounts/status, retains retry keys,
   refetches after success and never infers authority or optimistic success.
9. Initial delivery is copy-only. Deposit refunds, chargebacks, real PSP/UPI,
   email/WhatsApp delivery, cashier, settlement/checkout, AR/trust, tax/fiscal and
   public booking remain separate orders.

## Forbidden

- PAN/CVV/VPA/bank credentials or forms; real provider network, SDK, account or cost
- raw bearer/secret/payload storage or logs; unsigned or unbounded callbacks
- duplicate payment lifecycle, direct payment mutation or automatic deposit apply
- client money/status authority, optimistic success, folio settlement or closure
- deposit refund/chargeback, cashier, AR/trust, tax/fiscal/FX/public booking
- editing `0001_init.sql` or any applied migration
- local promotion, merge, push, public/production deployment or Phase completion

## Pre-registered proof

- **P0 red:** absent migration/domain/routes/assets/provider/workbench markers fail.
- **P1 schema/security:** fresh 1–22 proves 89 tables, 79 RLS/policies, tenant-leading
  indexes, coherent references, token-hash-only storage and insert-only authority.
- **P2 callback/truth:** exact signed bytes succeed; altered byte/path/time/id/signature
  and oversize fail generically; replay is one effect, conflict is 409, timeout then
  late provider truth reconciles exactly once through Order192.
- **P3 accounting:** capture leaves folio untouched; partial/full apply produces exact
  balanced liability/folio journals and cannot exceed capture or positive balance.
- **P4 authority/concurrency:** A/B tenant/property attacks, missing scopes, revoked or
  expired bearers, pending/failed/foreign captures, twenty application racers and
  injected rollback create no excess or orphan artifact.
- **P5 browser security/UAT:** create → guest → provider outcomes → signed callback →
  informational return → server truth → partial/full application works at 375/768/
  1024/1440 and 200% zoom with keyboard/focus/reduced-motion/stale-path proof.
- **P6 standing/review:** no-PAN full-surface scan, inherited payment/financial/security
  suites, schema/deployment/referee, typecheck/boundaries/licence/audit pass; a fresh
  non-implementer personally executes P1–P5 before approval.

## Definition of done

- [ ] Intentional red precedes schema and production code.
- [ ] Separate synthetic provider and no-sensitive-input boundary are executable.
- [ ] Callback is signed, bounded, replay-safe and Order192-authoritative.
- [ ] Deposit capture and application are separate, balanced and immutable.
- [ ] Guest return cannot mutate or claim payment/settlement truth.
- [ ] Current schema/oracles and referee 11/11 pass.
- [ ] Independent Tier-3 review approves the exact candidate.
