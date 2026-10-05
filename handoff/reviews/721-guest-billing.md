# Order721 independent review — approved

Reviewer: `/root/guest_contract709`, independent of the FinanceWorkspace and
VoiceField implementation. Final visual refinements in `AdditionalFolioWindow.tsx`
and `folio-workbench.css` were also inspected. No product files or live financial
records were changed by the reviewer.

## Existing canonical surface and reuse

- Check-in already gates on canonical readiness and opens the primary folio through
  the existing primary-folio command before committing check-in:
  `frontend/yellow/src/workspaces/ReservationWorkspace.tsx:2387–2410, 3059–3199`,
  `frontend/yellow/src/yellow-api.tsx:2420–2545`, routes in `src/app.ts:436,682–687`.
- Finance is the active folio charge UI. It consumes server-returned charge options
  and `chargeAvailability`, requires explicit confirmation, and uses the existing
  keyed charge POST: `frontend/yellow/src/workspaces/FinanceWorkspace.tsx:652–673,
  852–877, 1160–1181`; `frontend/yellow/src/yellow-api.tsx:1984+`; `src/app.ts:446`.
  The backend revalidates open folio/guest account, open property business day and
  configured attributable revenue route in `src/contexts/financials/postings.ts`.
- Checkout shows authoritative itemized statements, settles only zero-balance open
  windows, then uses existing checkout readiness/command: `ReservationWorkspace.tsx:
  2140–2230, 2335–2373`; `yellow-api.tsx:2651–2705`; `src/app.ts:707–713`.
  Settlement is a monotonic zero-balance status transition, not payment, journal
  posting or settlement-provider activity (`src/contexts/financials/settlements.ts`).
- These existing APIs are sufficient for Order721's frontend composition; removing
  the active `CashDrawerWorkbench` integration and its FinanceWorkspace snapshot
  query/validation is frontend-only. No backend route/service change is needed.
  Keep the existing cashier endpoint, isolated client/workbench tests and source
  available for deferred Order716; do not couple guest folio access to drawer grants
  or snapshot health.

## Explicit policy boundary

Cancellation uses booking-time frozen policy evidence; nonzero or legacy-unfrozen
penalty requires a separately approved different-actor waiver. Cancellation records
`penaltyJournalId: null` and does not post a penalty (`DECISIONS.log` D-285;
`src/contexts/reservations/lifecycle.ts:477–535, 768–820`). Active React no-show is
disabled and no active no-show POST route was found (`ReservationWorkspace.tsx:
1583–1589, 1674+`). A configured first-night/full-stay no-show policy is not an
executable charge command. Do not add automatic cancellation/no-show fee behavior,
new fee codes, or nonzero-balance settlement under this UI order.

## Final independent verification

Verdict: **approve; no blocking correctness or financial-contract finding**.
Presentation-only final refinements reuse the existing `BillingIcon`, add accessible
titles to the add/edit affordances, and use a two-column mobile guest-context layout
with a compact additional-window action. They do not alter the financial controller,
request, receipt, idempotency, or permission semantics.

Personally executed in `D:/Yellow/git-live-order611-source-v2`:

```text
bun test tests/order721-guest-billing-workspace.test.tsx tests/order721-compact-field-microphone.test.tsx tests/order716-finance-integration.test.ts tests/order672-folio-workbench.test.ts tests/order714-finance-integration.test.ts
18 pass, 0 fail, 122 expect() calls

bun test tests/order708-compact-controls.test.tsx tests/order708-field-dictation.test.tsx tests/order708-field-coverage.test.ts tests/order672-folio-statement.test.ts tests/order691-folio-comparison.test.ts tests/order714-additional-folio-window.test.tsx
39 pass, 0 fail, 301 expect() calls

bun test tests/order716-cash-drawer-client.test.ts tests/order716-cash-drawer-workbench.test.tsx
19 pass, 0 fail, 146 expect() calls

bun run typecheck
passed (backend and frontend TypeScript)

bun run boundaries
Import boundaries OK: 208 TypeScript files scanned

bun test tests/order721-guest-billing-workspace.test.tsx tests/order721-compact-field-microphone.test.tsx tests/order714-finance-integration.test.ts tests/order714-additional-folio-window.test.tsx
25 pass, 0 fail, 174 expect() calls (rerun after final visual refinements)

bun run typecheck
passed after final visual refinements
```

These tests include SSR/source guards, not mounted interaction proof. Root separately
reported local browser checks at 390px and 320px with no page overflow, preserved
charge-draft input node/value while switching panels, and AdditionalFolioWindow
pre-submit draft → Review → Edit → Cancel flows holding and releasing navigation
locks. Those browser checks did not exercise unknown-write recovery or perform a
financial POST. No DB-mutating financial integration test was run by this reviewer.

Removing `CashDrawerWorkbench` and the `cashier-sessions` snapshot dependency from
active Finance is frontend-only; the backend route and isolated Order716 client/UI
remain unchanged. Guest folio access continues to use canonical reservation/folio
reads, server-owned charge options/availability, exact statement balances, explicit
financial confirmation and existing recovery locks. Existing cancellation/no-show
policy was not expanded: no automatic fee, new fee code, settlement, or checkout
command was introduced.
