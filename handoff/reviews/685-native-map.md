# Order 685 independent source review — curated native God's Eye map

2026-09-24. Reviewer: Codex non-implementing agent `order679_independent_review`. I did not implement the native map, tests, build, or deployment. Scope: Order 685 in `D:/Yellow/git-live-order611-source-v2`.

## Decision

**Corrected source/build candidate admitted for the coordinator's mounted and live acceptance, subject to those browser checks.** This approval is for the bounded Cesium/OSM foundation, not for Yellow hotel/BnB/vendor publication, routing, satellite imagery, or all upstream God's Eye feeds. The coordinator owns the actual desktop/mobile, GPS-denial, Overture-switch, and deployment proof.

## Findings and corrections

- The first built candidate statically imported an 8,408,341-byte Cesium chunk from the main app and preloaded it in `index.html`; it also failed the coordinator's mounted browser under strict CSP. I reported this as blocking because reservations would pay the map load. The corrected candidate uses a curated `CesiumWidget` engine wrapper and retains the map behind a dynamic workspace import. Its built entry HTML preloads only Rolldown and React; main entry JavaScript does not statically import the engine. The remaining native engine chunk is 3,712,787 bytes and loaded from the map path.
- The mounted browser reportedly needed WebAssembly compilation for Cesium codecs. The corrected operator-document CSP adds only `'wasm-unsafe-eval'`, not general `'unsafe-eval'`; the original exact-token test was updated accordingly. Other documents and APIs keep `geolocation=()` and do not receive the OSM connect/image origins. The policy still has `worker-src 'self'`, and the assets are same-origin.
- The adapted map-stack admits only `osm`, with a fixed `https://tile.openstreetmap.org/` provider and ellipsoid terrain. I found no imported upstream provider proxy, key setup, TeleGeography layer, OSINT feed, or bundled global dataset in the scoped candidate. The local Cesium asset route rejects traversal, encoded separators, dot segments, unknown extensions, and missing files. It serves only the four copied Cesium runtime directories and bundled license/notices. The generated local runtime assets total about 6.8 MiB across 391 files, not an Overture bulk archive.
- `Locate me` is invoked only by its button, calls the browser's one-shot geolocation API, holds its marker in the current Cesium scene, and has denial, timeout, unavailable, and manual coordinate alternatives. It does not write GPS into a URL, Yellow API, storage, log, or background watcher. The UI explains that OpenStreetMap receives tiles for the viewed area, including a GPS-centred view. The map component destroys its widget and imagery listener on unmount/retry, with a generation guard against stale layer completion.
- The UI explicitly says Yellow listing publication is not yet available, rather than manufacturing hotel, BnB, or vendor markers. Overture remains accessible by a separate view switch. OSM attribution and upstream/Cesium licensing are visible and shipped with notices.

## Personally executed proof

- `bun test tests/order685-native-map.test.ts tests/order685-native-map-http.test.ts` on the corrected candidate: **6 pass, 0 fail, 62 assertions**. The HTTP tests exercise actual operator document versus API headers and built asset MIME/missing-path behaviour.
- `bun run typecheck`: backend and frontend TypeScript pass.
- `bun run boundaries`: `Import boundaries OK: 208 TypeScript files scanned`.
- Inspected the generated entry HTML and initial JavaScript import graph for the corrected build: no eager native-engine preload/static import; map engine is a dynamic chunk.

## Remaining coordinator proof

The coordinator is running the mounted desktop/mobile browser acceptance and must record actual native globe tiles, WebAssembly/worker/CSP behaviour, world/city/coordinate navigation, 2D/3D, GPS denial and manual fallback, Overture switching, no engine request on unrelated operator entry, and the exact guarded existing-service promotion. My source admission does not independently attest those browser or live checks. No live data was modified by this review.
