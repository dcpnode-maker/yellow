# Order 679 independent review — public global Overture map

2026-09-24. Reviewer: Codex independent non-implementing agent `order679_independent_review`. I did not implement the adapter, UI, tests, or deployment. Scope: Order 679 and Q679 in the serving checkout `D:/Yellow/git-live-order611-source-v2`.

## Decision

**Final source admission approved for the public-only map candidate**, including the later layer controls and lodging view. I found no remaining blocking defect in the reviewed fixed-source range adapter or mounted map after the implementers corrected the issues below. This is approval for the coordinator to proceed to its own guarded existing-service promotion and live browser checks. It is not a claim that the application was already deployed or that Yellow's retained raw archive is queryable.

## Findings and corrections inspected

- Initial map `error` state could be overwritten by a later `idle` event, concealing failed tiles as a settled viewport. Revised component holds failure state through `idle`, clears stale places, and requires retry to reset.
- Initial adapter returned immediate 503 after four concurrent cold reads, even during ordinary map tile fanout. Revised reader permits four active upstream reads and at most 32 body-free waiters, removes aborted/timed-out waiters, uses a 30-second total request deadline, and rechecks cache after admission. The extra queue test passes. A genuinely overloaded or timed-out view can still error; retry is exposed.
- MapLibre 6 initial constructor bounds failure was reported from the coordinator's mounted probe. Revised source uses Mercator projection and disables world copies, while coordinate input remains bounded to the PMTiles latitude/longitude envelope. I independently loaded the revised mounted map.
- The UI states the data is a pinned publisher snapshot, that the list is a capped visible subset, and that Yellow's August 19 Drive archive and future client-country access are not serving this view. Attribution links are present. I found no hotel record, tenancy, database, migration, bulk dataset persistence, or external URL proxy in the scoped adapter.

## Personally executed proof

- `bun test tests/overture-map-http.test.ts tests/security-headers.test.ts tests/overture-map.test.ts` → **15 pass, 0 fail, 115 assertions** after the queue/UI revisions.
- `bun run typecheck` → backend and frontend TypeScript pass.
- `bun run boundaries` → `Import boundaries OK: 206 TypeScript files scanned` before the final UI revision; the final TypeScript pass also completed.
- `./state.ps1` → source checkout and uncommitted integration state printed. `bash ./state.sh` was unavailable in this Windows shell (`/bin/bash` absent); PowerShell equivalent succeeded.
- Direct reader live range `places.pmtiles` `bytes=0-511` → 206, 512 bytes, PMTiles magic, exact pinned ETag and `bytes 0-511/18392360113`, about **1,026 ms** in that run.
- Actual `app.handle` live range `divisions.pmtiles` `bytes=0-511` → 206, 512 bytes, PMTiles magic, exact pinned ETag and `bytes 0-511/19929576927`, about **1,115 ms**; response retained `connect-src 'self'` and the strict existing CSP. Separate isolated fixture HTTP route for Places returned 206 with the same pinned range and ETag.
- Live publisher PMTiles metadata reads (bounded header/metadata) showed global bounds `[-180, -85.0511287, 180, 85.0511287]`, Places max zoom 14 with `place` source layer, Divisions max zoom 12 with `division_area` and `division_boundary` source layers. These match the component's declared source layers.
- Independently opened the isolated, read-only local fixture at `127.0.0.1:57158` in a separate browser tab. World overview rendered; Riyadh returned 200 capped visible Places and an inspected hotel (`Novotel Riyadh Al Anoud`) with GERS ID `b36dd929-4760-4501-9c59-213be0e1f720`, category, address, coordinates, website, and source records. Navigating from Riyadh to Sydney returned 200 capped visible Places and a **4,746 ms** viewport-settled display. The page labeled both counts as a display cap, not area totals. I visually inspected the Sydney map canvas: actual dense place markers and division geometry rendered. I closed my temporary browser tab.

## Limits and follow-through

These timings are individual observed runs with a warm local fixture/browser state where applicable, not a 50 ms promise or a universal cold-start benchmark. Publisher requests and result timing vary; the coordinator separately reported a 936 KB Riyadh tile around 15 seconds cold. The snapshot can expire at the publisher. This view reads publisher-hosted public PMTiles, not all raw attributes or Yellow's Drive archive. It does not implement client geography entitlements. The coordinator must still prove the exact promoted image, one healthy live app, desktop/mobile navigation, live error/retry behavior, and rollback readiness in its own receipt before calling Order 679 delivered. The repository's existing `license-check` failure from `framer-motion` → `tslib` 0BSD was reported as baseline; no gate was weakened here and the new map packages were not the source of that failure.

## Final source follow-up — 2026-09-24

After the founder requested independent Places and administrative-boundary switches and an All/Lodging view, I re-inspected `OvertureMapWorkspace`, the pure map helper, the expanded HTTP tests, and the enabled OperationalHub navigation. I did not implement these changes. The new selected-place DOM marker assigns publisher text with `textContent`; it does not interpret feature names as HTML. The layer/view refs are updated synchronously for map callbacks. An `idle` callback reads the current ref and requires the same live map instance, while the main `idle` path retains the failure guard. Retry removes the old map and protocol and resets error and selected-place state. Turning Places off clears the list and details; Boundaries controls only the division fill/line layers, independently of Places. I found no blocking stale-result or cleanup race in this source path.

Final personally executed checks:

- `bun test tests/overture-map-http.test.ts tests/security-headers.test.ts tests/overture-map.test.ts` → **18 pass, 0 fail, 127 assertions**. New cases cover cancelled queue removal and oversized streamed bodies as well as lodging taxonomy normalization.
- `bun run typecheck` → backend and frontend TypeScript pass.
- `bun run boundaries` → `Import boundaries OK: 206 TypeScript files scanned`.
- Decoded one bounded real Riyadh Places PMTile at z14/x10316/y7030 from the pinned public release: **936,512 bytes, 1,134 features**, including 24 `hotel` basic-category records. Parsed taxonomy hierarchy identifies **33 lodging** features; the exact compact-string predicate used by the MapLibre layer selects the same **33** in this tile. Pinned examples had `hotel` hierarchy `["lodging","hotel"]`, direct `lodging` hierarchy `["lodging"]`, and `restaurant` hierarchy `["food_and_drink","restaurant"]`. This validates the filter against this real tile, not every publisher tile or a complete area count.

`tests/yellow-overture-map.browser.test.ts` is absent. The prior mounted browser proof above was independently executed manually; the coordinator reports further final-fixture toggle/lodging proof and owns the remaining live desktop/mobile/error/retry checks. The missing automated browser fixture is a regression-coverage limitation, not a claim that an automated browser test passed. The source decision above is unchanged.

## Guarded UI follow-up — 2026-09-24

The first live acceptance found the global aside paragraph font made inspector text too small. I inspected the scoped CSS override `.overture-workspace .overture-inspector p`: its more specific selector restores `.875rem` system text, normal letter spacing, and normal case within the map inspector. I also inspected the `goTo` guard: it compares the current center and zoom with the requested 14.5-zoom destination before clearing the selection, results, timing, or loading state. An identical area click therefore leaves an already-settled view intact even if MapLibre emits no new movement event. These are the only two follow-up source edits I reviewed; I did not implement them or run the live browser concurrently with the coordinator.

Personally reran `bun run typecheck:frontend` (pass) and `bun test tests/overture-map-http.test.ts tests/security-headers.test.ts tests/overture-map.test.ts` (**18 pass, 0 fail, 127 assertions**) after these edits. Source admission remains approved. The coordinator owns the exact candidate image promotion and live repeat-click/font checks.

## Mobile inspector cascade follow-up — 2026-09-24

The coordinator's live mobile QA found that the application's inherited `@media` `aside { display: none; }` rule hid the map inspector. I inspected that rule and the scoped `.overture-workspace .overture-inspector { display: block; }` override. The latter has higher selector specificity and keeps the inspector visible at the mobile breakpoint without changing the global navigation-aside policy. The isolated mounted fixture now imports the application's global `styles.css`, so this cascade is represented in future fixture checks. I personally reran `bun run typecheck:frontend` after the edit; it passed. Source approval remains in place. The coordinator will verify actual mobile inspector visibility in the promoted app.
