# Order 679 — delivered public global Overture layer

2026-09-24. Bounded increment delivered to the existing sole Yellow app. This is
not delivery of the entire God Eye product, raw archive service or ecosystem.

## Live artifact

- [Open global market map](https://lying-jones-terminal-church.trycloudflare.com/p/6081b544-22a1-534f-a86d-bb1ae0519e14/today?workspace=market-map).
- Final app image: `583d72792a89aa319a24448829be0d8e90b70f261f3e2973ee9e90a7417c581d`.
- Existing `yellow-public-demo-app-1` healthy; `/health` returns `{"status":"ok"}`.
- Rollback `yellow-public-demo-app:before-order679` = exact676 image
  `9bc9969a63645ee7596101e5caf411af87d31a120a52d5a3997f84deceee961d`.
- Built from exact676 base with generated frontend plus only `src/app.ts` map
  import/reader/GET route and new `src/http/overture-map.ts`. Coordinator compared
  running676 source against local source with those additions removed; equal after
  line-ending normalization. The first raw hash guard stopped promotion because
  line endings differed; no wider backend delta was admitted.
- Same compose app service recreated, no second live app, no DB migration or hotel
  record writes. Temporary build recipe removed. No Git commit/push/PR/merge this
  turn; existing mixed uncommitted work is preserved, not represented as published.

## Functionality and data boundary

Global publisher snapshot 2026-09-23.0, lazy map and locally bundled worker under
unchanged strict CSP. Separate Places and Boundaries toggles; All/Lodging filtering
using published taxonomy, coordinates/global area navigation, actual place
inspection with GERS/category/address/website/provenance, capped visible list,
timing and visible retry. Category filter validated against actual pinned tile,
not guessed from `basic_category=lodging` (hotel is a child category).

No bulk global file stored on laptop. Bounded byte reads and small in-memory caches
only; browser-managed HTTP cache may occur. This reads publisher PMTiles inspection
tiles, **not Yellow's database or retained August19 Google Drive archive**. It is
Places/Divisions, not all six raw themes. Publisher retention, incomplete records,
200-result display cap and lack of geography entitlements are disclosed.

## Personally executed proof

Independent non-implementer `/root/order679_independent_review`:

- Final scoped Bun suite: **18 pass, 0 fail, 127 assertions**.
- Full backend/frontend typecheck; import boundaries **206**; final CSS follow-up
  frontend typecheck. Review in `handoff/reviews/679-global-overture-map-independent.md`.
- Real bounded publisher header/range, strict CSP actual app.handle proof, exact
  ETags and totals; decoded Riyadh 936,512-byte tile with 1,134 features: 33 lodging
  hierarchy matches equal map filter matches, including 24 basic-category hotels.
- Independently mounted initial global/Riyadh/Sydney map and inspected Novotel.

Root:

- Production Vite build, scoped diff check, exact-base Docker builds/promotions and
  current image/health checks. Live map route 206/512-byte partial response.
- Actual live desktop world, Riyadh and London results. Novotel Riyadh Al Anoud
  inspected at GERS `b36dd929-4760-4501-9c59-213be0e1f720`, published hotel category,
  address/site/source records and local DOM name marker.
- Phone viewport: actual document width/scrollWidth **375/375**, no horizontal
  overflow; place inspector visible with 14px/21px text. Selected Hilton Riyadh
  Olaya GERS `ecf76d12-9bb5-43c1-bdeb-8d4c67c2fda2`, address/site/source shown. Places
  off clears selected detail and says layer is off; on restores loaded results.
- Repeated same-area click leaves settled results accessible, no permanent loader.
- Mobile navigation back to Reservations confirmed existing New reservation and
  group evidence panel; desktop navigation back to Global market map remounted it.
- Both isolated fixture and final live tab: intercepted **map-only** HTTP502 makes
  visible Map unavailable/Retry; intercept removed, Retry restores world overview.
  No hotel commands intercepted/submitted, browser cache setting restored.
- Live acceptance caught global aside paragraph 9px text and mobile `aside{display:
  none}` inheritance; scoped fixes independently reviewed and verified live. Test
  fixture now imports existing app CSS to catch these interactions.

## Performance observations and limits

First promoted679 build (same data path; later typography/mobile fixes): live world
4,566 ms, first Riyadh 4,004 ms, London 6,351 ms, repeat cached Riyadh 11 ms. These
are individual browser viewport-settled observations, not controlled benchmarks
or database latency. Cache/network/viewport change results. A single warm value
below50ms does not establish a50ms SLA. Earlier raw cold tile probe took15seconds.

No automated `tests/yellow-overture-map.browser.test.ts` exists; actual mounted CUA
checks above are manual regression evidence. Existing unrelated license gate is
red on `framer-motion` -> `tslib@2.8.1` 0BSD; no license gate weakened and no all-green
repository/PR claim. No DB changes, no database referee run for this increment.

## Follow-on, not delivered

Durable cloud-side archive serving/update pipeline; client region/country grants;
other map themes and real directions; registered/bookable stay and vendor layers;
vendor registration/catalog/order workflows. Order680 captures those God Eye
requirements plus official PMS research for individual/group creation and a real
room calendar inside the existing workspace. Vendor approval/business policy was
asked asynchronously, not silently decided.
