# Order 197 — Governed cashier sessions

**Status:** BUILT-UNREVIEWED-D536 — implementation and registered builder gates green
**Phase:** 5 — Financials
**Branch:** `phase-5/governed-cashier-sessions`
**Base:** `55c5aa0c166a` (built-unreviewed Order196)
**Risk tier:** 3 — cash custody, exact counts and day-seal readiness
**Owner:** Codex implementation; independent proof retained for the Phase-5 gate

## Outcome

Authorized staff can open one attributable property drawer, submit immutable
denomination counts, and close the session with PostgreSQL-derived expected,
counted and over/short evidence. Initial expected cash equals opening float because
Yellow's current payment surface is token-only. No discrepancy is hidden through a
journal and no browser arithmetic becomes financial truth.

## Re-authorized fixed policy

This order re-authorizes Question-140-D from immutable historical commit
`6f002f748b4271c95a7748892617d3648cf361cf`, blob
`e1709a4204d23cca35185cc61acc3c7fec3f8c6a`, on the current line:

- At most one active session exists per drawer and per user across the tenant.
- A drawer uses the property's exact base currency. Foreign cash and FX are later.
- Expected cash is opening count plus only typed authoritative cash effects. Because
  no typed cash effect exists yet, Order197 expected cash equals opening count.
- Every non-zero over/short requires a reason and a different-user four-eyes approval;
  no balancing, suspense or write-off journal is created.
- A supervisor may close an abandoned session only with supervise authority, a fresh
  immutable count and a mandatory reason; the opener cannot self-approve.
- Ordinary cashier close is a blind count: expected cash is hidden until the count is
  submitted. The cashier sees only the latest operational attempt afterward, while
  supervisors and auditors retain the immutable recount trail.
- The deterministic review drawer is `FRONT-DESK-1`, in USD cents, with governed
  denominations `1,5,10,25,100,500,1000,2000,5000,10000`.

## Natural-solution boundary

Baseline `cashier_session` JSON cannot enforce drawer identity, denomination validity,
one active custodian, immutable recounts or exact totals. Migration `0024` therefore
adds normalized drawer, denomination and count truth, hardens the existing session
head, and exposes only exact owner-mediated cashier lifecycle capabilities. It does not
invent cash postings or broaden the existing owner-only business-day seal.

## Exact scope

- `migrations/0024_governed_cashier_sessions.sql`
- `src/contexts/financials/cashiers.ts`, `src/contexts/financials/index.ts`
- `src/http/operator.ts`, `src/app.ts`, `src/server.ts`
- `src/http/operator/index.html`, `src/http/operator/operator.js`,
  `src/http/operator/operator.css`
- `scripts/seed-review.ts`
- `setup.sh` only for the exact migrations-1–24 public-table count/message admitted
  by Question173 and D-535
- `tests/financial-cashier-sessions.integration.test.ts`,
  `tests/financial-cashier-sessions.intentional-red.test.ts`,
  `tests/operator-cashier-workbench.integration.test.ts`,
  `tests/operator-folio-workbench.integration.test.ts`,
  `tests/review-seed.integration.test.ts`, `tests/migrate.integration.test.ts`,
  `tests/database-acceptance.integration.test.ts`,
  `tests/runtime-dml-authority.integration.test.ts`,
  `tests/security-definer-containment.integration.test.ts`,
  `tests/schema/expected.sql`
- cashier-only sections in `docs/CONTRACTS.md`, `docs/EVENTS.md`,
  `docs/STATE-MACHINES.md`, `docs/DOMAIN-MODEL-V1.md`, and Phase 5 in
  `BUILD-PLAN.md`
- this order, its review/question if needed, `DECISIONS.log`, and
  `handoff/LEDGER.md`

No other file is admitted. `migrations/0001_init.sql` remains byte-identical.

## Required work

1. Commit an intentional P0 red proving the normalized schema, domain service,
   routes and operator workbench are absent before product implementation.
2. Add tenant-scoped `cash_drawer`, `cash_drawer_denomination`, `cashier_count` and
   `cashier_count_line`; harden `cashier_session` with tenant-coherent drawer,
   property, actor, business date, currency, count and close evidence. Counts and
   lines are insert-only. Denominations are unique positive bigint units.
3. Compute every count total in PostgreSQL with signed-int64 overflow rejection.
   Enforce one open session per tenant/drawer and per tenant/user through partial
   uniqueness. Direct app-role insert/update/delete of cashier truth remains denied.
4. Add bounded yellow-owner capabilities for open, append-count and close. Each
   requires the exact runtime transaction tenant/app role, derives property currency,
   locks the current property-local business day before drawer/session/count rows, and
   returns no generic table or mutation authority.
5. `CashierService` owns strict exact-shape input, server audit envelopes, durable
   actor-bound idempotency, transactional facts/outbox and monotonic lifecycle.
   Opening and counts accept denomination quantities only; client totals, currency,
   date, user, property and account authority are forbidden.
6. Close stores `over_short = counted - expected`. Zero closes immediately. Non-zero
   requires a reason plus an exact approved, different-user, one-use request bound to
   session/count/expected/counted/over-short. An abandoned close additionally requires
   supervisor authority, a distinct actor and a fresh count.
7. Emit minimized `cashier.opened`, `cashier.counted`, and `cashier.closed` facts/events
   in the same transaction. No denomination/account detail appears in events. No
   journal, payment, document, folio or business-day mutation is created.
8. Add no-store operator read/open/count/close adapters under exact property grants and
   `financials.cashiers:read`, `financials.cashiers:operate`, and
   `financials.cashiers:supervise`. Add the minimum cashier-specific approval adapter
   only if the existing generic ApprovalService cannot complete the fixed maker/checker
   path without broad approval authority.
9. Add a visible deep-linked Cashier workbench using blind count, governed denomination
   quantities, confirmations, retained retry keys, stale identity/property/session
   guards, authoritative refetch, accessible pending/error/success states and all six
   approved appearance compositions.
10. Extend the deterministic review seed with the exact drawer, cash account,
    denominations, scopes and grants without creating a cashier session or financial
    artifact.

## Forbidden

- cash payments/refunds/paid-outs, FX, offline cash, cash journal or provider settlement
- browser multiplication/subtraction, caller totals/currency/date/user/property/account
- free-form drawer/denomination, count mutation/deletion, reopen or duplicate custody
- hidden balancing/suspense/write-off journal or silent discrepancy normalization
- application day roll, day readiness, seal mutation, discrepancy carry-forward
- deposit refund, chargeback, trust, AR, checkout, invoice, tax or fiscal behavior
- local promotion, second local, merge, push, public or production deployment

## Pre-registered proof

- **P0 red:** schema/service/routes/UI markers are absent before implementation.
- **P1 schema/authority:** fresh migrations1–24 yield exact93 tables/83 tenant
  policies, tenant-leading FKs/indexes, insert-only counts, least ACLs and denied raw
  DML/PUBLIC/runtime-login execution.
- **P2 exact economics:** opening10000 with counted10000/10025/9975 yields exact
  over-short0/+25/-25, immutable attempts and zero journals/payments/documents.
- **P3 policy/concurrency:** blind count, threshold/maker-checker, abandoned supervisor,
  replay/rollback and twenty-way open/count/close races converge without stale close or
  duplicate custody.
- **P4 HTTP/browser:** hostile authority and client-math inputs fail; keyboard/pointer,
  confirmations, retry/refetch and stale-finally behavior work at the required widths
  across all six appearances.
- **P5 standing:** schema/database/referee/financial/type/boundary/licence/audit and full
  suites pass. Independent high-risk execution remains mandatory at the Phase-5 gate.

## Definition of done

- [x] Intentional red precedes product implementation.
- [x] Exact drawer/count/session lifecycle and approval policy are executable.
- [x] No hidden or invented cash accounting enters the slice.
- [x] Operator workflow and all registered executable gates pass.
- [x] Built result is recorded without claiming day close or Phase-5 completion.
