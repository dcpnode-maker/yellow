# Order 505 — Two-property operating performance release

## Objective

Replace the visible public colleague property set with a privacy-safe two-property
operating scenario: Locanda Homes Riyadh (STR) and one configured London hotel. Give
Today a governed daily/MTD/QTD/YTD operating-performance view with prior-year,
forecast, budget and future OTB comparisons.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/scripts/provision-two-property-operating-scenario.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/src/contexts/reporting/index.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/src/contexts/reporting/operating-performance.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/src/http/operator.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/src/app.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/src/server.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/App.tsx`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/styles.css`
- focused tests in the corresponding runtime `tests/` directory
- `handoff/reviews/505-two-property-operating-performance.md`

## Required behaviour

- The visible selector contains exactly Locanda Homes Riyadh and one London hotel.
  Existing proof fixtures remain intact and reachable only to their existing test
  paths; this order does not delete them.
- Public records use invented contact-free identities. Real provider source bytes,
  guest names, contacts, messages, payments, identity records and confirmation codes
  are never copied into the anonymous app. Reservation mix and listing configuration
  may be shaped from the independently reviewed aggregate Airbnb intake.
- Both properties have realistic configured inventory, room/unit types, reservations,
  housekeeping state and an approximately 70% occupied current night, plus a gradual
  future on-the-books curve. Occupancy uses `record_occupancy()` only.
- `stats_daily` is treated as a rebuildable reporting projection. Scenario projection
  rows are tenant/property scoped and populated deterministically; no ledger or legal
  document is fabricated. Revenue is labelled scenario operating data.
- The Today API derives property-local daily/MTD/QTD/YTD room nights, occupancy, ADR,
  RevPAR and room revenue, with last-year, forecast and budget comparisons. Money is
  bigint minor units plus currency; all queries run in the existing tenant transaction.
- Today renders compact mobile-first KPI cards, period comparison and OTB curve. Existing
  arrival/departure/in-house drill-down remains clickable and fast.
- Budget upload, company/parent-company/GST grouping, sales-owner attribution, group
  enquiry workflow, negotiation history, and outbound email/WhatsApp proposals are
  documented follow-ons unless an already-governed primitive supports them without new
  authority.

## Exclusions

- No production OTA login or scrape, no private guest PII in the public app, no payment
  or message import, no direct occupancy DML, no journal/posting/document mutation, no
  provider publishing, no deletion of proof fixtures, and no claim that scenario revenue
  is client financial truth.

## Independent review

An independent non-implementing reviewer must execute the scenario idempotence,
occupancy conflict, RLS, bigint money, stats reconciliation, API and frontend proof
before deployment.
