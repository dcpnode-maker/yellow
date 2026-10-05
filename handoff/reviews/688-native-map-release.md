# Order 688 independent review — exact native-map licence exceptions

2026-09-24. Reviewer: Codex non-implementing agent `order679_independent_review`. I did not implement the exception policy, build-copy rules, tests, or deployment. This reviews the founder-approved continuation in Order 688 and D-NATIVE-MAP-688, not a general licence-policy change.

## Decision

**Scoped source and native-enabled build admitted for coordinator live acceptance.** I found no remaining blocker in the exact dependency exceptions, retained notices, same-origin asset route or map CSP. This is not a claim that the native map has been promoted or that Yellow listings, other upstream feeds, providers, or full application/CI gates are complete. The coordinator owns final rebuild/provenance comparison, public HTTPS browser acceptance, core reservation smoke and rollback.

## Source findings

- `ALLOWED_LICENSES` remains unchanged. The exception path matches one installed package manifest by exact name, version, and declared expression: `pako@2.2.0` `(MIT AND Zlib)` and `tslib@2.8.1` `0BSD`. It logs both accepted exceptions. Synthetic negatives reject wrong package names, versions, unparenthesized/expanded expressions, and a different package declaring `0BSD`; no file-based exception or blanket SPDX identifier was added.
- The build copies the installed pako MIT `LICENSE` and its `lib/zlib/README` notice, installed tslib `LICENSE.txt`, curated God's Eye MIT licence/provenance, and Cesium licence/third-party JSON. This matters because Cesium's own third-party JSON names pako 2.1.0, not the installed 2.2.0; that older entry is not used as the exact pako notice. I independently compared SHA-256 of all seven copied files with their corresponding source files: **all seven byte-exact** in the reviewed native-enabled build.
- The native asset handler still admits only `Assets`, `Widgets`, `Workers`, `ThirdParty` and two top-level notice files, with traversal/encoded separator and unknown-extension rejection. Operator HTML gets fixed OSM image/connect origins, same-origin worker, narrow WebAssembly compilation permission, and `geolocation=(self)`; API/health responses retain the base geolocation-denying policy. The generated entry HTML preloads only Rolldown and React. Its main entry JavaScript statically imports those two chunks, not the native engine; one native-engine chunk remains behind the map path.
- Default-off remains explicit through `YELLOW_NATIVE_MAP_BUILD=1`; default output has no engine/map assets in the scoped test. No provider key, extra feed or map dataset was authorized by the exception.

## Personally executed proof

- `bun test tests/license-check.test.ts tests/order685-native-map.test.ts tests/order685-native-map-http.test.ts` on default-off output: **24 pass, 1 expected native-build skip, 0 fail, 102 assertions**.
- `bun run license-check`: **120 installed packages passed**, with exact pako and tslib exception lines printed; ordinary dual-license choices were separately logged.
- `bun run typecheck`: backend and frontend TypeScript passed. `bun run boundaries`: **208 TypeScript files scanned**.
- With the coordinator's native-enabled built artifact, `YELLOW_REQUIRE_NATIVE_MAP_BUILD=1 bun test tests/order685-native-map-http.test.ts tests/order685-native-map.test.ts`: **7 pass, 1 expected default-off skip, 0 fail, 83 assertions**. This executes actual app-handler HTML/API CSP and permission separation, engine CSS/worker MIME, all notice routes/content, and rejected asset paths.
- Independently inspected native-enabled `public/yellow-next/index.html` and its entry module import graph: no native-engine preload/static import. Seven notice-file hashes matched their installed or curated sources exactly.

## Remaining release boundary

The coordinator plans a final combined rebuild after Order 689. It must confirm that final artifact retains these exact policy/notice/engine boundaries, then verify the actual HTTPS native globe, city/2D/3D/Overture/mobile behavior and unchanged 686/687 reservations. GPS must remain user-invoked; no actual location request is needed for acceptance without user consent. Existing image and rollback path must remain available. Readiness/build-SHA debt and unbuilt public Yellow listings remain explicit.
