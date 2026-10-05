# Order 672 — implementation receipt

Date: 2026-09-24. Source: D:/Yellow/git-live-order611-source-v2.
State: scoped source independently reviewed; deployed and browser verified in the single existing review app.

## Delivered source
- Removed duplicate Guests navigation in desktop/mobile shells; retain profile deep links and universal search.
- Renamed the active group-block title to native Yellow wording; targeted competitor-name scan finds no matches in frontend/yellow/src or src TypeScript.
- Reorganized finance from three cramped columns into guest/window context and a wider statement, with a collapsible reservation chooser, stacked billing-window cards, exact selected/stay balances and semantic transaction table.
- Reused shared local table controls for search, advanced filters and ordered sorting; preserves server running balances and row identities. Bigint currency rendering tested for INR/JPY/KWD, negative fractions and large amounts.
- Charge posting, whole-charge-group transfers, direct billing and deposits now have expandable action panels. Children remain mounted; pending recovery forces its panel open. No backend, migration, payment or accounting rule changes.
- Independent review found inherited alternate navigation gaps and stale unsent transfer drafts. Fixed by shared navigation lock, parent lookup lock, disabled commands during lookup and draft reset. Reviewer personally executed 25 tests/184 assertions, all passing. See matching review.

## Root source proof
`bun run typecheck` (root + frontend), `bun run boundaries` (206), Vite production build (494 modules) pass. Final focused 8-file regression: 45 pass / 0 fail / 249 assertions. Existing cashier source-contract tests partly inspect legacy App text; they are not represented as end-to-end posting or database evidence. New tests target active FinanceWorkspace and guest workspace.

Initial pure-helper root TS6142 error (type import from JSX) was fixed with a minimal structural view type. Intermediate JSX during concurrent editing and a stale navigation test literal are resolved. Earlier failure evidence is not counted as passing proof.

## Boundaries
No financial operation submitted by this turn, no client data/configuration edited, no schema or role changes. Partial-amount splitting remains unsupported. This is not full PMS/finance completion, GitHub publication, permanent hosting, full regression, database referee or production-readiness proof. Existing dirty work preserved.

## Rollback
`yellow-public-demo-app:before-order672` retains sha256:dbfa88af5e530bc93536e8934a71ccf30bc81004dcd195dbf713dd262a8cc9d9. Only the existing app container is eligible for replacement; PG18, Valkey and tunnel must remain unchanged.

## Single app publication
Final app image sha256:144dfc5a3cfc9b5968a7c4423b3a3c2cb9ef62be9db8f90d9f10eec4758c2ec9, container yellow-public-demo-app-1 healthy at127.0.0.1:3010. Entry asset /yellow-next/assets/index-DVLgrr2I.js. `/health` returns status ok. Compose app-only --no-deps --no-build replacement; no database/cache/tunnel replacement or migration. Public review URL remains https://lying-jones-terminal-church.trycloudflare.com/ (temporary, not permanent production).

## Browser verification (root, Codex in-app browser)
Default desktop1265x712, mobile375x812 and landscape812x375 checked. Page title and URL correct, meaningful rendered content, no framework overlay and final error/warning log empty. Finance page and profile page have no Guests navigation. Universal search Omar -> distinct PartyID profile -> stay history -> Close profile reopens shared search. Profile contains no local guest search form; inline reservation guest picker remains in source.

Existing synthetic Omar L3R-DI-0015 -> primary bill SAR25.00. Selected and stay balances agree with the pre-change displayed statement. Table search to no-match -> Reset restores Laundry; amount descending sort preserves SAR25.00 original running balance; advanced Code filter to NO_CODE -> no-match -> Reset restores row. Split disclosure shows named Laundry charge group, reason/destination controls and disabled confirmation without proposal; no mutation submitted. Panels collapse without destroying drafts. Screenshots emitted inline for desktop and mobile.

Mobile page scrollWidth360 <= innerWidth375; landscape797 <=812. Transaction table scrolls inside its own region, not the page. Final desktop no horizontal overflow. Native reduced-motion CSS provided; OS text enlargement, dark appearance, multi-window live switching and actual financial posting/transfer/payment execution were not re-tested in this UI-only turn. This is read-only journey proof plus independent control/source checks, not complete finance acceptance.
