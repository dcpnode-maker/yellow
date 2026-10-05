# Order685 — native map built and verified locally, NOT live

24 September2026. Native CesiumWidget globe adapts the pinned MIT God's Eye
MapStackController. OSM-only, lazy map engine, same-origin assets/workers, street
imagery not live video; no paid provider keys, bulk dataset or private guest data.

Actual built-UI browser proof before release split: globe and OSM tiles; city
Dehradun; world;2D/3D; native->Overture->native with one canvas after remount;
mobile375x812 controls and attribution. Test-only GPS seam exercised denial and
public synthetic coordinate success/accuracy25m. Real device GPS permission was
not granted or collected. Network capture on Reservations showed zero native
engine or OSM tile requests. Source destroys viewer/layers on unmount/retry.

Independent source review685:6/0/62, types and208boundaries, lazy graph inspected.
Final explicit candidate build:
`YELLOW_NATIVE_MAP_BUILD=1` plus `YELLOW_REQUIRE_NATIVE_MAP_BUILD=1 bun test
tests/order685-native-map.test.ts tests/order685-native-map-http.test.ts`:
7pass/1 complementary-mode skip/0fail/62assertions. Default build counterpart:
7pass/1 native-mode skip/0fail/59assertions, proving native artifacts absent.
Vite ships native MIT provenance/Cesium notices/tslib notice only in enabled build.

Release gate: D-64 forbids self-clearing licences. Current allowlist rejects
pako2.2.0 `(MIT AND Zlib)` and tslib2.8.1 `0BSD`. Founder asked asynchronously
to approve these exact dependencies; no answer recorded. Later image comparison
proved tslib was already present in the prior live image, so only pako is a newly
introduced licensing delta. Native candidate remains disabled by default and
absent from the686/687 serving artifact. Existing Overture continues under
the accurate 'Market map' menu label. Do not claim native map live.

Next after approval: record exact exception/order underD64 (do not broadly allow
unknown licences), retain full notices, native-enabled build/tests, delta image
on the existing single app and public desktop/mobile/map acceptance. No newDB
migration needed for map. Yellow-published hotel/BnB/vendor listings still need
an explicit permissioned catalog; do not manufacture markers from private data.
Satellite/routing/livefeeds/full GoogleMaps parity are not in this increment.
