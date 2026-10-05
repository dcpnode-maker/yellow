# Order 482 — Department performance matrix discovery

## Objective

Define Yellow's role-based operational dashboard matrix and determine which
existing governed facts can power each card before adding any KPI calculation,
forecast, review-source or ancillary-sale logic.

## Scope

- Read-only inventory of existing Today, reservation, housekeeping, room-status,
  OOO/OOS, rate, folio, invoice, forecast/market and review-source read models.
- A role-to-card matrix for General Manager, Revenue, Front Office,
  Housekeeping, Finance and Sales/HOD views.
- Explicit early-check-in / late-checkout eligibility evidence model covering
  room condition, same-day movement, occupancy/OOO/OOS, configured policy,
  approved price and required confirmation/payment workflow.
- Documentation and focused read-only tests only where a current contract is
  clarified.

## Non-negotiable data rules

- Last-night actuals, ADR, RevPAR, revenue, pickup, forecast and review scores
  display only from their authoritative source. An absent source is labelled
  unavailable, never estimated from reservation counts.
- OOO/OOS, room condition and arrival/departure pressure remain current
  tenant/property-scoped facts; no dashboard computes occupancy by direct DML.
- Guest identities, payment data and external review data are not copied into
  public browser state or assistant prompts.

## Deliverable matrix

| Role | Cards | Required source |
| --- | --- | --- |
| General Manager | occupancy, ADR, RevPAR, revenue, pickup, forecast, exceptions, review health | approved PMS financial/reporting and review feeds |
| Revenue | room nights, pace, channel/rate contribution, restrictions, OOO/OOS supply impact | reservation/rate/distribution and forecast facts |
| Front Office | arrivals, departures, in-house, VIP/exception readiness, early/late requests | Today lanes, reservation and readiness facts |
| Housekeeping | room conditions, cleaning queue, inspections, arrivals/departures pressure, turnaround risk | room condition and task lifecycle facts |
| Finance | revenue postings, balances, unsettled folios, cashier status | governed folio/journal/cashier facts |

## Exclusions

- No invented KPIs, actual/forecast backfill, real guest import, review scraping,
  automated ancillary sale, direct occupancy update, financial posting, provider
  call, database/schema change, or release/promotion.
