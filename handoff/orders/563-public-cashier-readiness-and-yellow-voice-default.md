# Order 563 — public cashier readiness and Yellow voice default

## Objective

Make the live Locanda colleague journey open the named guest's cashier workspace
directly, expose a useful server-owned charge catalogue, and default Yellow voice to
Indian English without displaying a language chooser. Refine operational selectors
as compact, accessible segmented controls with visible active and status states.

## Scope

- `frontend/yellow/src/App.tsx`
- `frontend/yellow/src/styles.css`
- `frontend/yellow/src/voice.ts`
- focused frontend tests for named cashier routing, voice defaults and grouped charge
  selectors
- one exact idempotent provisioning tool and focused tests for the fictional public
  Locanda property's non-fiscal operational charge catalogue, revenue accounts and
  `tx_code_route` rows
- `handoff/reviews/563-public-cashier-readiness-and-yellow-voice-default.md`
- `handoff/LEDGER.md`
- `handoff/FOUNDER-JOURNEY-CAPABILITY-LEDGER.md`

## Required behaviour

1. “Open cashier for Omar Siddiqui” resolves the unique current in-house stay before
   generic workspace routing and opens its primary folio in the same Yellow view.
2. The public Locanda property receives exact, reviewed, property/currency-scoped
   operational charge routes backed by open revenue accounts. Provisioning is
   idempotent and fails closed on conflicting existing rows; it creates no posting,
   journal, payment, document, reservation or occupancy record.
3. Charge choices are grouped into compact pill/segmented controls. The active choice
   is visible without relying on colour alone; all controls retain labels, keyboard
   semantics, 44px touch targets and reduced-motion behaviour.
4. Current stay and folio states use semantic containers/badges for at-a-glance
   reading. Colour supplements text and icons; it never replaces them.
5. Yellow defaults to `en-IN` and an available young Indian English voice. It asks
   conversationally whether the user prefers the likely local language, but shows no
   standalone language-option screen and never changes language without the user.
6. Posting remains a separate explicit confirmation. No test or deployment posts a
   charge to public data merely to prove catalogue readiness.

## Safety and verification

- No mutation of `migrations/0001_init.sql`, no new table, no direct runtime financial
  DML, and no weakening of account/journal/posting/RLS/ACL rules.
- Exact before/after all-table fingerprints must show only the reviewed configuration
  rows. Replay must be zero-change.
- Independent non-implementing review must personally prove the financial
  configuration helper, denial/conflict cases, focused frontend tests, build, and
  public postflight before publication is accepted.

## Exclusions

- No charge posting, correction, transfer, settlement, payment, invoice, fiscal
  document, cashier drawer mutation, market-segment schema, RMS model or OTA action.
- This order does not claim complete cashiering or whole-PMS completion.

## Outcome — 2026-09-21

Published and independently accepted. The public Locanda property now has five
deterministic open SAR revenue accounts and eight property-scoped transaction-code
routes (ROOM plus Food, Beverage, Dessert, Spa, Laundry, Guest transfer and Other),
with no alcohol code. Yellow resolves the unique current Omar Siddiqui stay directly
to its live billing desk, defaults fresh voice sessions to Indian English, prefers an
available exact `en-IN` browser voice, and presents grouped/status controls in the
accepted white/yellow mobile and desktop layout.

The final public proof retained an unchecked confirmation and disabled posting
button: journal, posting, payment and document counts remain zero and occupancy is
unchanged. Custom descriptions/reasons, early-departure policy, allowances, partial
item/person splitting, settlement/fiscal issue and a separately authorized balanced
posting remain outside this order.
