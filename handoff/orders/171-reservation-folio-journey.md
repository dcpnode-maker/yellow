# Order 171 — Reservation-to-folio operator journey

**Status:** READY
**Phase:** 5 · Financials
**Branch:** `phase-5/reservation-folio-journey`
**Base:** `c830c9ebb80dcceb4d70d54784d7f17427ddf02a`
**Risk tier:** 3 — financial aggregate creation and irreversible posting UI
**Owner:** Codex implementation; independent non-implementing Tier-3 reviewer

## Outcome

Deliver one honest founder-testable path:

`reservation → explicitly create/reuse primary folio → UUID-deep-linked statement →
post one governed untaxed charge → refresh immutable server statement`.

Reservation commit remains financially decoupled. The existing `FolioService`,
`FolioStatementService` and `ChargeService` remain the only domain authorities.
PostgreSQL derives Party/account/property/currency/series/business date/routing/balance.

The live legacy PMS is a non-authoritative UX reference only. Preserve its useful
domain navigation, visible property context, retained-list create flow and
folio-list-to-detail progression; reject its unbounded tables, vague balances,
premature deposit/payment coupling, client authority and destructive shortcuts.

## Exact scope

Production:
- `src/http/operator.ts`, `src/app.ts`, `src/server.ts`;
- `src/http/operator/index.html`, `operator.css`, `operator.js`;
- `scripts/seed-review.ts`.

Tests:
- new `tests/operator-primary-folio.integration.test.ts`;
- new `tests/operator-folio-workspace.integration.test.ts`;
- `tests/operator-folio-workbench.integration.test.ts`;
- `tests/operator-reservation-workspace.integration.test.ts`;
- `tests/operator-assets-security.test.ts`;
- `tests/review-seed.integration.test.ts`;
- `tests/operator-founder-reservation-journey.integration.test.ts`;
- only exact local-review permission-oracle assertions discovered by
  `rg "financials.folios:read" tests`.

Documentation/governance:
- `docs/CONTRACTS.md`, `handoff/PHASE-5-PLAN.md`, this order, additive
  `DECISIONS.log`, `handoff/LEDGER.md`, and one independent review.

No financial context, kernel, migration/schema/expected SQL, protected referee,
reservation/rate/inventory domain service, package, lockfile or dependency is in scope.

## API contract

Add exact permission `financials.folios:open`. Add:

`POST /api/v1/properties/{property}/reservations/{reservationId}/primary-folio`

- exact body `{}` and required existing 8–200 visible-ASCII `Idempotency-Key`;
- server tenant/actor/property/correlation envelope, operation `folio.opened`;
- delegate only to `FolioService.openPrimary`;
- safe response omits account/Party/PII and returns only folio/reservation reference,
  window 1 and server changed/replayed truth;
- 201 changed, 200 existing, stable 400/403/404/409/503 mapping; domain failures escape
  tenant middleware so claims and partial work roll back before outer HTTP mapping;
- instantiate/wire one existing `FolioService`; never compose it into reservation commit.

## Review seed

Grant only the local-review role the new scope. Idempotently provision the minimum
non-production configuration: one non-fiscal folio series without rewinding `next_no`,
one property/currency revenue account, exact governed `ROOM` transaction code and
route, and the property-local current unsealed business day. Never pre-create a guest
account, folio, journal, posting, payment, tax, document or fiscal artifact.

## UI contract

- Reservation drawer renders existing folios as 44px UUID-backed controls. When
  server state is eligible and none exists, show one explicit **Create primary folio**
  command with retained idempotency key, progress, replay/conflict/retry states and
  stale property/route suppression. No optimistic artifact.
- Retain `/p/{property}/folios`; add protected `/p/{property}/folio/{uuid}` with
  `?tab=postings|charge` and optional bounded opaque `after`. Canonicalize successful
  human-reference lookup to the returned UUID; unknown query state is replaced.
- Bounded statement pages replace, never append, at most 50 rows/cards. Desktop uses
  a semantic six-column statement; mobile uses equivalent article/dl cards.
- Charge rail exposes only server-returned governed code, exact positive int64 minor
  string, optional canonical quantity and explicit irreversible **untaxed charge**
  acknowledgement. No client arithmetic, inferred major units or optimistic balance.
- Implement explicit loading/empty/error/retry/unavailable/posting/replayed/conflict/
  stale states, route history, dirty-exit confirmation and focus restoration.
- 375/768/1024/1440, 200% zoom, reduced motion, both themes, 44px targets, semantic
  headings/table/cards/live regions and zero document overflow. Combined operator
  HTML+CSS+JS stays at or below 90 KiB gzip with no dependency or external asset.

## Pre-registered proof

- **P0 red:** absent permission, POST adapter, explicit drawer command and served UUID
  workspace fail before implementation for those exact reasons.
- **P1 authority:** open/read/charge scopes are separate; invalid shape/property/tenant
  fail before service; response contains no account/Party/PII.
- **P2 real journey:** on fresh PostgreSQL, login → Party → offer → hold → reservation
  → empty folios → explicit open → empty statement → ROOM charge → refreshed statement.
  Prove exactly one guest account/window/series increment/folio fact+outbox+idempotency,
  then one balanced two-line immutable charge journal and exact server balance; payment,
  tax, document, fiscal, cashier, AR and trust counts remain unchanged.
- **P3 concurrency/rollback/stale:** 20 concurrent opens converge; replay is byte-equal;
  key/body drift conflicts; injected failure leaves zero partial artifact and no skipped
  folio number; UI route/property/drawer races produce zero stale paint/navigation.
- **P4 hostile finance:** ineligible state, foreign tenant/property, inconsistent
  account/folio, missing/ambiguous/fiscal series, sealed/missing day and route failures
  preserve exact existing service behavior with zero partial artifact.
- **P5 UX:** bounded history/DOM, dirty exit, keyboard/focus, both themes, 200% zoom,
  375/768/1024/1440 overflow/44px checks, no PII GET/client authority, gzip cap.
- **P6 gates:** affected Orders103–105/160/168/170 suites, new real journey, permission
  and seed oracles, full tests/typecheck/boundaries/licence/audit/schema/protected hashes
  and fresh app-never-started `./setup.sh --db-only` exactly 11/11.

An independent reviewer who did not implement the order must personally execute P1–P6
against one immutable candidate. Builder evidence is not approval.

## Forbidden

Automatic folio creation, additional windows, client financial authority, arbitrary
posting lines, free-form account/code/date/currency/route, money arithmetic, unbounded
list/DOM/cache, transfer/adjust/reversal, payment/deposit/refund, settlement, checkout,
tax/fiscal/document, cashier/day-close, AR/trust/FX/offline financial queues, production
role grants, PII/account disclosure, dependency, self-review, merge, push or deployment.

## Definition of done

- [ ] Intentional red is recorded before product implementation.
- [ ] Explicit real reservation-to-folio-to-charge path passes on fresh PostgreSQL.
- [ ] Responsive/accessibility/performance and full project gates pass.
- [ ] Independent Tier-3 reviewer approves one immutable executable.
