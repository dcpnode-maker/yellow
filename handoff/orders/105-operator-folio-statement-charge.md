# Order 105 — Operator folio statement and charge workbench

**Phase:** 5  
**Branch:** `phase-5/operator-folio-statement-charge`  
**Base:** `f9d8bc4`  
**Risk tier:** 3 — financial disclosure, authorization and irreversible charge UI  
**Owner:** Codex implementation; independent non-implementing reviewer required

## Outcome

Give authorized property staff one trustworthy folio surface: resolve an exact folio,
read its immutable guest-side statement and server balance, choose only a currently
configured revenue charge code, and post through approved `ChargeService`. The browser
never calculates money, chooses an account/date/currency, or paints an optimistic charge.

## Natural-Solution Test

Order 104 already owns economic mutation and route truth. The natural next slice is a
read-only financial query plus strict operator adapters and one panel in the existing
workbench. No schema, balance cache, alternate journal path or frontend ledger is needed.
The existing tenant-leading folio posting index must pass a measured 10,000-line proof;
otherwise work stops for an explicit index order.

## Scope

- `src/contexts/financials/statements.ts`, `src/contexts/financials/index.ts`
- `src/http/operator.ts`, `src/app.ts`, `src/server.ts`
- `src/http/operator/index.html`, `src/http/operator/operator.css`,
  `src/http/operator/operator.js`
- `scripts/seed-review.ts`
- `tests/financial-statements.integration.test.ts`,
  `tests/operator-folio-workbench.integration.test.ts`,
  `tests/operator-assets-security.test.ts`, `tests/review-seed.integration.test.ts`,
  `tests/operator-holds.integration.test.ts`, `tests/offline-leases.integration.test.ts`,
  `tests/operator-oos-policy.integration.test.ts`
- `docs/CONTRACTS.md`, `docs/DOMAIN-MODEL-V1.md`, `docs/UI-BLUEPRINT.md`,
  `docs/research/CAPABILITY-MATRIX.md`
- `src/project-status.ts`, `tests/founder-status.integration.test.ts` only after green
- this order, `handoff/PHASE-5-PLAN.md`, `handoff/LEDGER.md`, `DECISIONS.log`,
  `handoff/questions/`, and the independent review record

## Required work

1. Add `FolioStatementService.get(tx,input)` with exact tenant id, authorized property,
   folio UUID or strict human reference, optional opaque cursor and bounded limit
   (default 50, max 100). It resolves only the transaction tenant and exact property.
2. One PostgreSQL statement snapshot returns folio metadata, signed canonical decimal
   `balanceMinor`, exact line count, bounded applicable charge options, current
   `chargeAvailability {allowed,reason}`, and guest-side immutable rows only. Exclude
   revenue counterparts, route/account ids, source JSON, tax detail and Party/contact
   data. Read creates no fact, event or idempotency artifact.
3. Each row returns line/journal ids, kind, business date, exact microsecond UTC posted
   text, reversal journal id, tx code, description, quantity, signed `amountMinor` and
   full-ledger `runningBalanceMinor`. PostgreSQL computes sums; JavaScript never converts
   money through `Number`, `parseInt`, `parseFloat` or floating arithmetic.
4. Keyset order is exact `(business_date, journal.created_at, journal.id, seq)`. Compute
   running balance over the complete folio ledger before applying the outer cursor.
   Fetch limit+1. The versioned base64url cursor is length/shape/regex validated and
   bound to property + folio + the full tuple; malformed/foreign cursors fail closed.
5. Applicable charge options come only from exact tenant/property/currency
   `tx_code_route`, attributable revenue codes and open revenue accounts. Return bounded
   code/name/USALI only, never ledger sides. Availability reflects current open
   folio/account/day/options; it is explanatory only and `ChargeService` revalidates.
6. Add `financials.folios:read` and `financials.charges:write` to the deterministic local
   review role and exact inherited permission assertions. They remain separate scopes.
7. Add no-store operator routes:
   `GET /api/v1/properties/{property}/folios/{reference}/statement?after=&limit=` and
   `POST /api/v1/properties/{property}/folios/{folioId}/charges`. Resolve authentication,
   exact scope and property grant before domain work. GET delegates only to the statement
   service. POST accepts exactly `{txCode,amountMinor,quantity?}`, takes idempotency only
   from the header, builds one server audit envelope and delegates only to
   `ChargeService.postCharge`.
8. Error mapping is validation 400, generic property-safe not found 404,
   state/idempotency conflict 409 and unavailable 503. Reject duplicate/unknown query
   parameters and bodies containing account, line, debit/credit, property, currency,
   date, kind, route, description, balance, tax or unknown fields.
9. Add a Folios workbench with labelled human-reference lookup, semantic immutable
   statement table, signed exact minor-unit strings, running/server balance, bounded
   load-older control, governed code select and explicit irreversible **untaxed charge**
   confirmation. It retains one idempotency key across retry/double-click and refetches
   the server statement only after success; no optimistic row or balance.
10. Every lookup/page/charge success, error and finally path is guarded by captured
    generation + property + folio identity. Property change/sign-out clears statement,
    options, form and pending key. Late old-property/folio responses cannot repaint.
    Use `textContent`/created nodes, semantic headings/table/caption/scope, 44px controls,
    polite status, assertive errors, deliberate focus and reduced-motion support.
11. Document that statement visibility and posting do not mean tax calculation,
    invoicing, payment, settlement, fiscalization or checkout completion.

## Forbidden

- Migration/schema/table/index/view/function changes; direct HTTP/UI SQL; second charge
  command; client/reducer balance or running-balance arithmetic
- Browser/account/date/currency/property/journal-kind/line/route authority; free-form tx
  code; raw counterparty lines; float or locale-decimal money conversion
- Optimistic posting; regenerating idempotency key on retry; stale response repaint;
  token/localStorage persistence; HTML injection; leaking Party or route/account ids
- Tax/tax detail/invoice/document/fiscal behavior, payment/deposit, transfer/correction,
  settlement, trust, AR, cashier, day roll/seal command, folio opening/status transition
- Self-review, self-merge, files outside Scope or weakened exact permission assertions

## Pre-registered proof

### P0 — intentional red

Focused canary imports absent `FolioStatementService` and requires the absent Folios
workbench surface before production or permission work.

### P1 — statement snapshot and exact strings

Fresh PostgreSQL proves empty and mixed-sign folios, values beyond 2^53, exact
microseconds/ties, server/running balances, route-filtered options and zero read writes.
Three or more pages return every line once with non-reset running balance.

### P2 — strict authorized HTTP charge

Real authenticated HTTP proves read-only can GET but not POST, write-only can POST but
not GET, exact/ancestor property grants work, cross-property/tenant references are
generic, hostile queries/bodies fail before services, and POST creates only Order 104's
canonical journal/evidence. Replay keeps one journal; changed body conflicts.

### P3 — operator journey and stale races

Real workbench/assets prove lookup, paging, signed exact text, applicable-code selection,
explicit confirmation, retry key retention, server refetch, keyboard/focus/live regions,
and no client accounting/arbitrary ledger control. Extracted canaries prove late lookup,
page and charge success/error/finally from an old property/folio cannot repaint or clear
the current state.

### P4 — hostile disclosure and performance boundaries

RLS tenant B sees no A folio/rows/options; cursors cannot cross property/folio; statement
never returns counterpart/account/source/tax/PII data. A measured 10,000-line folio page
uses bounded logical work/latency with the existing index or the order stops for a
separate schema decision.

### P5 — project gates

Focused financial/HTTP/assets proof, inherited Order 104 proof, exact permission seed,
typecheck, boundaries, standing, migration/deployment, exact schema, licences/audit,
protected hashes and pristine 85-table referee pass. A non-implementing Tier-3 reviewer
personally executes the financial and real-HTTP proof.

## Definition of done

- [x] Order exists before implementation.
- [x] Intentional P0 red is committed before production/permission code.
- [x] Statement snapshot, pagination, exact strings and 10k proof pass.
- [x] Read/write/property/tenant HTTP authority fails closed.
- [x] Workbench has no browser accounting, stale repaint or unsafe ledger controls.
- [x] Charge path is only approved `ChargeService`; unbuilt tax/payment scope is clear.
- [x] Standing/referee gates pass and scope is exact.
- [x] Independent reviewer approves executed proof.
