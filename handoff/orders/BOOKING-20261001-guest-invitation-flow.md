# BOOKING-20261001 — Invitation-bound guest quote, hold and commit

Status: authorized implementation, independent review required before acceptance.
Basis: 444072ffdff2b7745345d88f71b603c17e11ace6, isolated
phase-7/guest-booking-invitation-20261001. Laptop is controller/integrator.
Inventory handoff: d3c1aa62ada0b44a4fd932e5b5d467cae6c96d2b,
handoff/backups/444-current/module-inventory-v1/MODULE_HANDOFF.md.

## Goal

Authenticated hotel staff issue an expiring booking invitation for one existing
active guest Party, one authorized property, one channel and explicitly selected
property rate plans. The invited guest can search offers, obtain a canonical quote,
hold a chosen offer and commit one reservation through existing domain services.
This is a real public guest flow with constrained bearer authority; anonymous
storefront registration and payments remain outside this finite slice.

## Scope

- NEW src/contexts/identity/guest-booking-token.ts and its public index exports.
- NEW src/contexts/identity/guest-booking-authority.ts for the fixed live issuer
  permission check, so reservations reuse identity's public authority surface.
- NEW src/contexts/reservations/guest-booking.ts and its public index exports.
- NEW src/http/guest-booking.ts.
- Small isolated src/app.ts and src/server.ts route/composition hunks only.
- NEW tests/guest-booking-token.test.ts, tests/guest-booking.test.ts,
  tests/guest-booking.http.test.ts, tests/guest-booking.integration.test.ts.
- This order, NEW docs/contracts/GUEST-BOOKING-INVITATION-20261001.md,
  handoff/reviews/BOOKING-20261001-guest-invitation-flow.md, append-only
  handoff/LEDGER.md and DECISIONS.log for the accepted authority decision.
- Necessary src/kernel/build-info.ts release frontier104, setup.sh/setup.ps1
  frontier labels, tests/setup-current-catalogue-oracle.test.ts and existing
  tests/build-readiness.test.ts / build-readiness.integration.test.ts frontier
  assertions. Existing checks remain; historical migrations stay untouched.
- One scripts/local-review.sh readiness frontier literal and corresponding
  tests/release-workflow.test.ts current-frontier expectations.
- Literal migration104 metadata in .github/workflows/ci.yml and release.yml,
  matching tests/free-host-arm64.test.ts / release-workflow.test.ts; no gate changes.
- Necessary migration frontier oracle append in tests/migrate.integration.test.ts;
  no historical checksum or assertion removal.
- NEW handoff/receipts/BOOKING-20261001/*, handoff/BOOKING-20261001-BACKEND-HANDOFF.md
  and handoff/patches/BOOKING-20261001-app-server.patch;
- External owned disposable PG proof/runner receipts; no shared app DB writes.
- NEW migrations/0104_guest_booking_authority.sql, explicitly reserved by the
  laptop controller, and its strict tests/schema/expected.sql snapshot. It adds
  only a locked owner authority assertion with no runtime table privilege changes.
  Actual PG42501 proof requires this forward function. Admission on the laptop
  waits for independent native proof; only owned disposable proof databases apply it.

No frontend/auth/session/header/theme/today/ribbon, laptop/tunnel/phone,
existing migrations, CompSet, provider activation, PAN or payment changes.
No new tables or independently allocated migration numbers: existing command idempotency is used only
for its canonical exact-command replay/conflict semantics, not as a mutable
capability ledger or per-token revocation store.

## Authority and state constraints

1. Staff issuance requires authenticated actor and live grants for availability
   read, rate configuration read, hold write, reservation booking write and party
   read on the exact property. Require active tenant/actor/Party and permitted
   property rate plans. Recheck and lock current issuer authority on every public
   command, concealing foreign/unknown references.
2. Purpose-separated HMAC guest tokens must be rejected by staff token parsing.
   Reuse configured secret material with a separate domain/derived key; no new
   credential distribution or raw token persistence. Session TTL <=15 minutes;
   quote TTL <=5 minutes; hold token no later than its actual hold expiry/session.
3. Caller never chooses tenant/property/party/channel/actor authority. Inputs are
   strict and bounded. Session allowlist controls rate plans. Quote/hold tokens
   are bound to that session and canonical evidence, not arbitrary guest IDs.
4. Hold creation re-quotes under the existing rate-publication lock, rejects stale
   financial/policy/release evidence, uses QuotedTaxHoldBindingService and its
   complete calculated-tax gate. Quotes preserve exact pre-tax/currency/tax
   evidence and do not imply payment or inventory promise.
5. A fixed session-scoped hold command key permits one exact hold choice; a fixed
   session-scoped commit command key permits one exact reservation/replay. Do not
   expose direct reservation commit or let caller keys bypass those limits.
   Short-lived token expiry is below existing 24-hour command retention.
   Issuer deactivation/grant revocation disables all its invitations; individual
   invitation revocation is explicitly not implemented in this bounded slice.
6. Use canonical commitHeld, occupancy exclusion/choke points, quoted-tax lineage,
   audit/facts/outbox and transaction-local tenant RLS. Price/release/policy drift
   fails closed; no automatic guest lifecycle/money mutation.

## Transport / proof

Proposed route hunks for laptop review: POST
/api/v1/properties/:property/booking-invitations through existing operator tenant
boundary; POST /api/public/booking/offers, /quotes, /holds, /reservations through
distinct verified guest bearer boundary. JSON body/response/time bounds, no-store,
generic errors, no token/PII/raw error logs; no CORS wildcard or token in URL.

Pure/mounted tests must cover purpose/tamper/expiry/strict-input/authority/quote
drift/foreign session/hold selection/retry. Actual disposable PG18 tests must prove
least-privilege tenant RLS, revoked grants, quote/tax lineage, successful commit,
rollback, expired holds, concurrent last-unit arbitration, duplicate and changed
command keys. Independent nonimplementer must personally run the registered auth
and state-transition proof. Types, boundaries and canonical setup.sh --db-only
11/11 are required before a reviewable draft PR. Preserve original failures.

Public53018/old services remain unchanged; no hosting or full PMS/CRM/RMS/phase
completion claim. At <=1% plan remaining, checkpoint all jobs and stop; emergency
credits, automatic reset/resume and purchases are forbidden.
