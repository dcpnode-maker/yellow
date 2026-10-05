# Order723 — show authorized listing exports on the market map

25 September 2026. Founder priority: the exported listing-level PriceLabs data
must be usable on Yellow's map; do not confuse file delivery with integration.
Continue the product build while using available included-quota Antigravity for
a bounded public-source acquisition task. Public tunnel remains OFF.

## Scope and ownership

- Builder review709: frontend/yellow/src/market-listing-import.ts (new strict
  browser-safe decoder/filter/GeoJSON helpers); frontend/yellow/src/workspaces/
  StreetMapWorkspace.tsx and street-map.css; frontend/yellow/src/street-map.ts
  (Abu Dhabi city shortcut only); tests/order723-market-map-import.test.ts and
  tests/order723-market-map-layer.test.tsx; tests/order699-street-map.test.ts only
  where assertions need to reflect the implemented local research layer.
- Root: this order; handoff/questions/723.md; handoff/receipts/723-market-map.md;
  docs/PROJECT-STATUS.md; handoff/LEDGER.md; generated public/yellow-next/**;
  external D:/Yellow/temp/order723-* local build/QA/rollback artifacts.
- Independent guest_contract709: handoff/reviews/723-market-map.md and personally
  executed focused/adjacent tests, types, boundaries, privacy/lifecycle review.
- Antigravity: one sanitized bounded public-source research/code task in the
  existing D:/Yellow/temp/antigravity-quota-check-20260925 empty workspace. Included
  quota only, sandbox/plan, no paid fallback; no Yellow files, exported provider
  records, credentials, guest/owner information or private history forwarded.
  Outputs are suggestions, not trusted acquisition or completed data work.
- Root may reuse the unchanged reviewed Order718 collector only within its
  authorized source/network/output limits. No scraper source change under723.

## Product and privacy contract

Add an explicit local-file import of Order722 normalized listing JSON to the
existing Market map. Decode at most5MB/10000 rows, exact schema/provenance and
operator-supplied source context, unique string IDs, finite Mercator coordinates,
bounded text, nullable exact string numbers. Reject unknown/incoherent data with
plain user-facing errors, no parser exception/record logging. No coercion of long
IDs, no invented zero/rates/availability. Null coordinates count as unmapped.
Source metadata is file-supplied context, not cryptographic provider verification.
Validate its shape/provider/grammar and show it honestly; do not hardcode a report
ID, market name, currency or25September refresh into reusable app code. Current
verified data is Abu Dhabi/AED/report187188. The known v1 limitations remain
mandatory; reject a Dubai market paired with a no-Dubai-coverage assertion.

Data stays in this mounted browser workspace only: no fetch/upload/DB write,
localStorage/sessionStorage/indexedDB/service worker cache, static bundle/data
route, hidden auto-load, or public publication. Clear action/unmount removes rows,
source, layers, selection and listeners. Existing OpenFreeMap tiles continue to
receive viewport tile requests; disclose this separately from listing privacy.
This is an internal research import, not a persistent market database.

Use a clustered GeoJSON source and circle/count layers, not thousands of DOM
markers. On import fit the dataset extent; support cluster zoom and listing
selection. Compact search and bedroom filter apply consistently to map/list/count.
Accessible paged result list offers keyboard selection and clear selected details
even if WebGL/tiles fail. Price explicitly labeled next-year average, not October
quote; approximate coordinates and stale source timestamps remain visible.
Render provider titles as React text only; no HTML injection or automatic external
link fetch. No thumbnails or scraped personal data. Neon-green layer accents.

Keep the 31 regional October observations separate from individual listing pins;
do not attach a market percentile as a listing's rate/calendar. Do not label Abu
Dhabi as Dubai or all provider records as independently verified active inventory.

## Required proof and deployment boundary

Synthetic tests: strict shape/size/count/longIDs/nulls/duplicates/unsafe links,
coordinate bounds, hostile text, filter/pagination, zero matches, source/layer
lifecycle on load/retry/clear/unmount, stale file-read completion and selection.
Independent reviewer executes final tests/typecheck/boundaries. Root reads actual
2528-record file through the UI, verifies count/points/selection/search/clear and
mobile320/390/desktop rendering; no provider rows committed or transmitted in logs.
Measure actual import-to-visible time without calling it server query latency.
App-only loopback replacement after green gates, retain721 rollback, no DB/cache
recreate/migration/tunnel start or whole-ecosystem completion claim.

## Outcome

Scoped implementation complete and locally browser-verified; see receipt/review723.
Final app image1e42ef20 serves loopback3010 only, tunnelOFF. Actual2,528rows imported,
filters/selection/clear/unmount/320px390pxlayout tested. File is private on selected
ankitg.owa Drive; map persistence remains intentionally mounted-browser-memory only.
No persistent market feed or ecosystem-completion claim.
