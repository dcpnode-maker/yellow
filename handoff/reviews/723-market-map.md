# Order723 independent market-map import review

Reviewer: `/root/guest_contract709`, independent of the Order723 implementation.
Scope reviewed: `market-listing-import.ts`, `StreetMapWorkspace.tsx`, the Abu
Dhabi shortcut, scoped CSS and Order699/722/723 tests. No provider listing rows
were opened or printed by this reviewer. No database, live market-data service,
or external source was written.

## Verdict

**Approve the scoped source for root's local UI acceptance.** No blocking privacy,
schema, or map-lifecycle issue found. This is not the final Order723 completion
receipt: root still owns the actual 2,528-row file-selection, map/list/filter/
selection/clear and responsive browser proof required by the order.

## Review findings

- The decoder enforces the Order722 v1 envelope, exact object keys, row/text/file
  limits, unique string listing/source-row IDs, null-or-bounded decimal values,
  paired finite Mercator coordinates, safe HTTPS URL syntax, and the retained
  known limitation list. Source context is treated as an unverified file claim:
  provider/schema/grammar are validated without pinning report, market, currency
  or refresh values; an explicit Dubai claim conflicts with the retained
  no-Dubai limitation and is rejected. The workspace labels market/refresh
  metadata unverified.
- Listing IDs stay strings through filtering, results and GeoJSON feature
  properties. Null-coordinate rows count as unmapped and are omitted from map
  points. Search/bedroom filters drive the result list, mapped/listing counts
  and local map source from the same filtered collection; paging clamps safely.
- Hostile titles are rendered as ordinary React text, and listing URLs are shown
  as text only. The scoped code contains no `localStorage`, `sessionStorage`,
  `indexedDB`, service-worker, upload/fetch, or logging path for imported rows.
  GeoJSON sent to MapLibre contains only local point coordinates and string
  listing IDs. The existing OpenFreeMap style still receives viewport tile
  requests; the workspace separately discloses that viewed areas are visible to
  the tile provider.
- Async file reads use a generation token, generic errors, and disposal checks;
  a stale read cannot restore data after a later import, Clear, or unmount. Clear
  disposes the local source/layers and click listeners and clears selection and
  filters. Layer setup is rollback-safe if a source/layer/listener add fails;
  cluster expansion checks active state before map movement. Accessible paged
  results remain available when map rendering fails.
- Reviewed the final cluster-glyph font correction: the cluster count layer now
  explicitly requests `Noto Sans Regular`, matching the inspected Liberty style
  font; the lifecycle harness asserts this layout value. This avoids a missing
  default-font glyph on the real map style.
- Two correctness fixes were requested and landed before this review: relax
  source metadata literal pins while retaining bounded claims and contradiction
  checks, and avoid exposing provider records through row logging. No new
  backend or persistence path is present.

## Personally executed proof

From `D:/Yellow/git-live-order611-source-v2`:

```text
bun test tests/order723-market-map-import.test.ts tests/order723-market-map-layer.test.tsx tests/order699-street-map.test.ts tests/order722-pricelabs-dashboard-export.test.ts tests/pricelabs-import.test.ts tests/pricelabs-windows-intake.test.ts
39 pass, 6 explicit skips, 0 fail, 306 assertions

bun run typecheck
passed (`tsc --noEmit && tsc --noEmit -p frontend/yellow/tsconfig.json`)

bun run boundaries
Import boundaries OK: 208 TypeScript files scanned
```

The tests use synthetic provider-like rows; no real rows were used as fixtures.
No database acceptance, live financial action, public map tunnel, deployment,
or user-data upload was performed by this reviewer. Root's actual-file browser
proof and app-only release decision remain separate gates.

## Final font-delta proof

```text
bun test tests/order723-market-map-import.test.ts tests/order723-market-map-layer.test.tsx tests/order699-street-map.test.ts
13 pass, 0 fail, 118 assertions

bun run typecheck
passed (`tsc --noEmit && tsc --noEmit -p frontend/yellow/tsconfig.json`)

bun run boundaries
Import boundaries OK: 208 TypeScript files scanned
```
