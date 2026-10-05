# Order 685 — Native God's Eye as Yellow's listing map

IMPLEMENTING bounded native explorer — 2026-09-24. Latest founder instruction:
native God's Eye is the intended Yellow map, with Yellow hotels, BnBs and vendors
displayed as selectable listings, user location and nearby discovery. This is not
the claim that Overture's map or the native diagnostic already provides that flow.

## Product contract

- Use the verified native God's Eye/Cesium experience as the map foundation, not a
  link pretending that a disconnected diagnostic is the finished Yellow map.
- Show authorized Yellow listing coordinates and listing details, distinguishing
  Yellow listings from optional Overture context. Never infer permission to publish
  private guest, staff, occupied-room or unlisted-property data.
- `Locate me` asks for browser location permission after a user action. Location
  denial, unavailable GPS and insecure-origin cases have clear retry/manual-search
  alternatives. Do not persist GPS, continuously track users or start background
  collection by default. Scope following-location only while explicitly enabled.
- Select a hotel/BnB/vendor to view its public listing and available actions. Vendor
  registration remains deferred; do not fabricate vendors or working booking links.
- Directions require a real routing provider or clearly labelled external handoff.
  God's Eye's keyless imagery is not universal live video, traffic or navigation.
- Reuse MIT source only where compatible; upstream third-party asset/data licenses
  require per-layer review. Do not ship noncommercial TeleGeography assets in Yellow.
- Lazy-load the globe so front-desk reservations and other ERP pages stay lightweight.
  No bulk global dataset download, paid service activation or new public diagnostic.

## Original intake scope

This order, `docs/product/NATIVE-GOD-EYE-LISTINGS.md`, source/read-only assessment,
ledger/status only. Before implementation, add an explicit file-level scope and
independent tenant/privacy/data-contract proof. Reservation defect683, calendar681
and navigation684 remain in progress in the sole serving tree. Native682 is verified
only on laptop loopback4173; Yellow679 is still the public map at intake.

## Explicit implementation amendment — 24 September

Founder again reports native map absent from live. Implement the native Cesium
foundation inside the same Yellow app, not a second live server. This increment
reuses the MIT map-stack controller from pinned God's Eye commit
759652207fd1279ece97f0f19af566feb9a82146, adapted to a curated OSM-only provider
allowlist and on-demand rendering. No upstream main.js, provider credential UI,
OSINT feeds, third-party models or bundled datasets are imported. Esri keyless
technical access does not establish commercial entitlement; Esri/Google/ion and
external terrain remain disabled pending provider terms/access decisions.

Exact implementation scope:
- package.json, bun.lock (pin Cesium 1.138.0; no runtime provider keys).
- frontend/yellow/vite.config.ts (lazy vendor split and local Cesium static assets).
- frontend/yellow/src/vendor/gods-eye/{map-stack.ts,LICENSE,README.md}.
- frontend/yellow/src/vendor/gods-eye/engine.ts: curated native CesiumWidget
  exports only, avoiding unrelated provider and Knockout UI initialization.
- frontend/yellow/src/god-eye-map.ts and workspaces/{GodEyeMapWorkspace.tsx,god-eye-map.css}.
- frontend/yellow/src/App.tsx: replace only market-map composition with native
  explorer; retain Overture behind an explicit contextual view switch.
- src/http/god-eye-assets.ts; src/http/security-headers.ts; src/app.ts: bounded
  static asset route and map provider/CSP/GPS policy on React operator HTML only.
- tests/order685-native-map.test.ts and tests/order685-native-map-http.test.ts.
- tests/fixtures/order685/server.ts: loopback-only synthetic UI acceptance server;
  production CSP/static functions reused, no live write proxy and no persistent data.
- docs/product/NATIVE-GOD-EYE-LISTINGS.md, this order, handoff/questions/685.md,
  handoff/receipts/685-native-map.md, handoff/reviews/685-native-map.md,
  handoff/LEDGER.md and docs/PROJECT-STATUS.md.
- Generated public/yellow-next build output and one temporary delta-image recipe
  under D:/Yellow/temp, for the existing app service only.

Acceptance: actual lazy Cesium canvas on live route; OSM attribution retained;
world/city/coordinate navigation, 2D/3D controls; user-invoked local GPS with
clear denial/retry; no GPS in URLs/storage/logs; Overture remains reachable;
unmount destroys viewer and no background polling. Independent review executes
asset traversal/CSP/permission tests. Root runs desktop/mobile browser checks.

Yellow public listing publication is NOT invented in this increment: no public
listing contract currently exists. Display that limitation, not fake markers.
Vendor registration and routing remain deferred. No database writes or migrations.
Do not describe this curated native engine as delivery of every upstream feed.

Release separation: native map distribution awaits founder approval for exact
new transitive pako2.2.0 (MIT AND Zlib) and tslib2.8.1 (0BSD) licences under D-64.
Do not self-clear the licence gate. Vite may use explicit YELLOW_NATIVE_MAP_BUILD=1
to build the local candidate; default release excludes native modules/assets and
retains the existing Overture view. App.tsx and OperatorHeader.tsx may use the
compile-time flag to keep the visible map label accurate. Reservations686/687
may ship separately with proof no native engine/assets are in that artifact.
