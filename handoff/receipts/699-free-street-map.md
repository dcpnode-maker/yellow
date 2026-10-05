# Order699 — free street map receipt

25 September 2026. Replaced the active GodEye/Overture market-map display with a
lazy MapLibre workspace using OpenFreeMap Liberty, while retaining the existing
`market-map` route, navigation guards and white/gray interface. The map provides
explicit city shortcuts and bounded decimal coordinate preview pins labelled
“Preview pin · not saved or verified.” No Yellow listing inventory or persistent
pins are represented. Visible linked map/data attribution and tile-privacy copy
remain in the interface.

## Scoped implementation

- `frontend/yellow/src/workspaces/StreetMapWorkspace.tsx` and
  `frontend/yellow/src/workspaces/street-map.css`: lazy map view, explicit retry,
  partial/unavailable error feedback, city selection, keyboard-accessible
  coordinate preview and linked attribution.
- `frontend/yellow/src/street-map.ts`: pure coordinate validation, Mercator
  latitude bound, map-style/provider URL and attribution helpers.
- `frontend/yellow/src/App.tsx`, `frontend/yellow/src/ui/OperatorHeader.tsx`:
  lazy route integration and the `Map` label. The route and shared guards remain.
- `frontend/yellow/src/workspaces/OperationalHub.tsx`: two stale Overture
  descriptions now describe the streamed street map, not listings or live
  availability.
- `frontend/yellow/vite.config.ts`: removed the active Cesium copy/define/chunk
  setup and disabled copying stale nested generated frontend artifacts.
- `src/http/security-headers.ts`, `src/app.ts`: narrow operator map document
  origins and worker-only response policy, respectively. Default CSP,
  permissions policy, and other routes remain unchanged.
- `tests/order699-street-map.test.ts` and scoped additions to security/header,
  map HTTP, and navigation tests cover coordinates, integration and policy.

Existing GodEye/Overture historical source and tests were preserved; they are
not part of the active or bundled map. No new package, API key, paid map request,
scrape, persistent pin, database change or backend GPS forwarding was added.
GPS is never requested automatically. Coordinate preview does not make a
geocoding request. MapLibre map, marker, listeners and load timeout are explicitly
released on retry/unmount; preview state is cleared on retry.

## CSP finding and repair

The first live candidate returned HTTP 200 for style/raster requests, but MapLibre
fetches vector tiles and glyphs in a separately served worker. That worker retained
the default `connect-src 'self'`, blocking the OpenFreeMap requests. The independent
static approval was suspended until the serving worker response was given the
exact path-limited policy for `/yellow-next/assets/maplibre-gl-worker-*.js` on the
operator surface: `connect-src 'self' https://tiles.openfreemap.org`. It applies
only to the worker response; the operator document CSP is not broadened for this
repair, scripts remain self-only, and ordinary/non-operator responses retain the
default policy. The final worker URL uses `?policy=699` as a cache-key invalidation
for browsers that might otherwise reuse the old worker response; matching remains
on the URL pathname, so the query does not widen the allowlist. No permission
relaxation was made.

Independent reviewer `order679_independent_review` personally verified the
generated worker handler response at HTTP 200 with JavaScript content type and the
narrow policy, verified the policy-key query and unrelated asset default CSP, and
ran the focused tests. The reviewer also inspected the final generated bundle:
MapLibre worker is local and the street-map chunk remains lazy; no active/bundled
GodEye, Cesium, Overture, Google Maps or old OSM raster references were found.

## Verification and deployment

- Independent scoped tests: `bun test tests/order699-street-map.test.ts
  tests/security-headers.test.ts tests/order684-navigation-ribbon.test.ts
  tests/order700-compact-shell.test.ts` — **17 passed, 0 failed, 176 assertions**.
  Independent `bun run typecheck` and `bun run boundaries` passed; boundaries
  covered 208 files. Additional independent post-worker-CSP focused runs passed,
  including a run with the expected native-build skip.
- Root’s final combined 699/700 checks: **47 passed, 1 historical skip, 0 failed,
  364 assertions**; typecheck, 208-file boundaries and combined build passed.
- Root verified actual desktop browser rendering in Dubai with vector buildings,
  streets, English/Arabic labels, linked attribution and coordinate-preview pin;
  no map error alert was shown. Screenshot:
  `D:/Yellow/temp/order699-live-dubai-desktop.png`.
- Root verified at a 390px mobile viewport that the map canvas was 349.6px wide
  and fit within the 375px client width.
- The final serving image is
  `7c28921d9d97359b3c9f7db9a2aa86a68e049bc96c272a03260205b2c85a269f`; rollback
  image `79844d57` was retained. This is the existing sole app, not a second
  deployment. Database ledger remained 101. Local and public health returned 200.
  Readiness remains the inherited 503 `build_revision_unavailable`; this receipt
  does not claim ready/healthy deployment provenance.

## Limits

The coordinate pin is only an unsaved, unverified visual preview. This work does
not deliver saved hotel/listing pins, Yellow-published market inventory, full
global data coverage or verified geocoding. It does not request GPS, assess
coverage/positional accuracy of the tile provider, or claim completion of the
broader map/data ecosystem. OpenFreeMap provides the basemap; it is not a source
of Yellow property, availability, booking or revenue data. Historical standalone
source cleanup remains Order698 and is not included here.
