# Order 507 — Today command centre and dedicated movement grids

## Objective

Replace the crowded Today composition with a premium, mobile-first operational
launchpad and make each movement count open one dedicated, complete and fast
spreadsheet-style reservation view. Property-local time controls the greeting.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/App.tsx`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/styles.css`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/today-workspace.ts`
- focused frontend tests
- `handoff/reviews/507-today-command-centre-and-due-in-grid.md`

## Required behaviour

1. Today uses two distinct compact ribbons: movement (`Arrivals`, `Departures`,
   `In house`) and core inventory/revenue KPIs (`Occupancy`, `Rooms sold`,
   `ADR`, `RevPAR`, `Inventory`). Values are centered and clickable.
2. KPIs show compact truthful variance against last year with accessible green
   up/red down indicators. Missing comparison data stays unavailable.
3. Operating performance is a small `Actuals · Pace · Plan` summary. Its full
   Today/MTD/QTD/YTD actual/LY/forecast/budget table and OTB chart are hidden
   until explicitly opened.
4. Selecting a movement replaces the Today content with one full-page table for
   exactly that operational state. The table has complete cursor pagination,
   search, multi-column advanced filtering and deterministic multi-key sorting.
5. The whole reservation row and guest name open the reservation; there is no
   redundant `Open` button. Hover/focus provides a concise booking preview from
   governed board fields only.
6. Greeting and displayed clock derive from the selected property's IANA
   timezone and current instant, including a correct evening greeting.
7. Desktop and phone layouts remain fast, readable and Yellow white/yellow with
   gray/black borders only.

## Exclusions

- No database or event mutation, no schema/migration, no synthetic facts, no
  invented review scores or reservation attributes, and no PII/contact display.
- No change to reservation, occupancy, pricing, journal or fiscal calculations.

## Verification

- Pure helper tests for timezone greeting, variance and deterministic filtering
  and sorting.
- Existing reservation-board frontend tests, TypeScript typecheck and Vite build.
- Browser smoke at desktop and phone width after deployment.
