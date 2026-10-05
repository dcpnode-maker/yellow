# Order 577 — mobile property settings, performance alignment and reservation billing entry

## Objective

Make property configuration easy to find from Yellow on desktop and mobile, repair
the operating-performance table's semantic alignment, and let an operator enter the
correct billing context directly from an in-house or future reservation, including
explicitly opening a future stay's primary billing window after confirmation.

## Scope

- `frontend/yellow/src/App.tsx`
- `frontend/yellow/src/styles.css`
- `tests/yellow-next-property-settings.test.ts`
- `tests/yellow-next-performance-dialog.test.ts`
- `tests/yellow-reservation-finance-entry.test.ts`
- `tests/yellow-reservation-actionable-readiness.test.ts`
- `handoff/orders/577-mobile-property-settings-performance-and-reservation-billing-entry.md`
- `handoff/reviews/577-mobile-property-settings-performance-and-reservation-billing-entry.md`
- `handoff/LEDGER.md`

## Required behaviour

1. Add a real `settings` workspace reachable from desktop and mobile navigation.
   It renders the selected property's canonical identity/timezone/currency plus
   compact live summaries for inventory, room types, rate plans, restrictions and
   operating blocks from existing reviewed GET endpoints. Existing governed setup
   screens remain linked for dense editing; do not expose or mutate `org_node.config`
   directly and do not pretend missing profile/channel/user APIs exist.
2. Keep Settings usable at 375px: grouped progressive-disclosure cards, 44px controls,
   no horizontal document overflow, and no dense setup forms injected into Today.
3. Give the performance matrix semantic period/measure/value columns (including a
   `colgroup` or equivalent stable widths) so Measure and Actual headers align with
   their cells at phone and desktop widths. Preserve the complete six-column table,
   accessible headers and intentional internal horizontal scroll on narrow screens.
4. From an expanded reservation row and full reservation sheet, open Finance with
   the exact reservation id. Clearly label in-house versus pre-arrival billing
   context; never treat client-side status as posting authority.
5. When an exact current `reserved|due_in|in_house|due_out` reservation has no folio,
   offer `Open primary billing window` using only the existing canonical endpoint.
   It requires named visible confirmation, one stable actor/draft-bound idempotency
   key, a fresh preflight, shared mutation/navigation lock, and authoritative detail
   reread proving the open primary folio before success. Drift or uncertainty must
   retain safe same-key recovery and cannot claim success optimistically.
6. Once an open folio exists, enter the existing cashier workbench directly. If
   charge availability is false, render the server reason and keep posting controls
   disabled. Do not add, simulate or infer a deposit in this order.

## Exclusions

- No new API, schema, database/configuration write, deposit request/application,
  payment instrument, PSP, tax/fiscal action or public operational mutation.
- No claim that missing property identity, amenity, OTA, company/TA, meal-plan,
  market-segment or user/role setup APIs are implemented.

## Verification

- Focused Settings, performance-dialog and finance-entry tests.
- Existing reservation, cashier, voice and Today regressions.
- Strict frontend TypeScript and production build.
- Controlled mounted browser proof at 375px and desktop with all mutation routes
  intercepted, plus independent financial review of the future-folio action before
  public promotion.

## Recorded scope correction — 2026-09-21

The R2 reviewer executed the existing reservation-actionable-readiness regression and
found its literal `Open cashier & billing` copy oracle stale after this order
deliberately introduced truthful `IN-HOUSE BILLING` versus `PRE-ARRIVAL BILLING`
context. The existing test file is added explicitly so its assertion can follow the
new semantic contract without reverting product behaviour or weakening any readiness
gate.

## Outcome — independently accepted 2026-09-21

- Added reachable desktop/mobile Settings with canonical property, inventory, rate,
  restriction and block summaries plus honest governed editing links.
- Repaired the performance matrix with stable semantic period/measure/value columns;
  reviewer geometry aligned all six columns at 375px and desktop.
- Added exact full-sheet and live reservation-board cashier entry plus explicit
  in-house/pre-arrival context and a separately confirmed canonical primary-window
  action for eligible no-folio stays.
- Independent R1 rejected cross-reservation consent, lost uncertain recovery, dead
  board JSX and a 31.875px control; R2 found recovery unmounted during a background
  detail-read failure. Final R3 preserves the exact key/body, retry and parent lock
  through POST/read failure and recovery, with a visible stale-data warning.
- Final proof: 80/0/664, strict frontend TypeScript, Vite 469 modules and mounted
  Settings/performance/finance/hostility at phone and desktop widths. No public
  operation, deployment or database mutation occurred in this order.
