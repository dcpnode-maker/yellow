# Order730 — Dubai open-data sample in the existing market map

Builder: Codex agent `antigravity_dubai728`, 25 September 2026.
Source frozen and independently source-reviewed by `app_next_slice727`; root owns
browser acceptance and combined app-only local promotion. No public tunnel requested.

## Implemented source

- New strict decoder for the exact Order728 `yellow.osm-accommodation-sample.v1`
  normalized file, max5MB/10,000 records. Source/count/hash/time/license fields,
  finite coordinates in the declared fixed sample rectangle, node/way/relation ID,
  exact OpenStreetMap links, known category/coordinate kinds and explicit unknown
  commercial fields are validated. Duplicate JSON keys/identities and mixed,
  incomplete or contradictory claims reject the file.
- Shared import uses a discriminated `pricelabs` or `osm` dataset. Order722 decoder
  and original PriceLabs detail renderer remain intact. Only one source can be
  mounted; no invented provider mapping, rate, bedroom or active-unit claim.
- The existing MapLibre client-side point/cluster layer accepts the common geometry
  interface and retains its neon-green styling, point selection, clustering,
  viewport fit, clear/dispose/retry lifecycle and accessible paginated list.
- OSM view shows actual imported count, acquisition/source timestamps, attribution,
  unverified provenance, category filters with counts, name/OSM-ID search, list
  pagination, selected record/coordinate-kind detail, safe exact source link and
  ODbL link. It says explicitly that prices, calendar, bedrooms, reviews, verified
  active inventory, OTA identity and exact entrances are unknown/not supplied.
- Metro rectangle may include neighbouring municipalities; complete Dubai coverage
  and deduplicated physical-property count are not claimed.
- Import uses file.text only; no file upload, browser storage, database or source
  request. It stays in mounted workspace memory; clear and stale/unmount completion
  guards remain. Map tile requests still reveal the viewed/zoomed area, disclosed.

React best-practices skill shaped the implementation: filter results and category
counts are derived/memoized from the one imported source, with no synchronizing
effect or second mutable dataset. Frontend-testing skill used for source/render
checks; actual browser acceptance remains root-owned and must not be inferred from
SSR tests or typecheck. No separate report/site/dependency was added.

## Builder proof

```powershell
& 'C:/Users/astha/.bun/bin/bun.exe' test tests/order730-osm-map-import.test.ts tests/order730-osm-map-results.test.tsx tests/order723-market-map-import.test.ts tests/order723-market-map-layer.test.tsx tests/order699-street-map.test.ts
& 'C:/Users/astha/.bun/bin/bun.exe' run typecheck
& 'C:/Users/astha/.bun/bin/bun.exe' run boundaries
git diff --check -- frontend/yellow/src/market-listing-import.ts frontend/yellow/src/workspaces/StreetMapWorkspace.tsx
```

Result: **26 passed,0 failed,289 assertions**, full root+frontend typecheck passes,
208 TypeScript import-boundary files pass, scoped diff whitespace check passes.

Nonimplementer `app_next_slice727` subsequently personally reran those commands,
matched all five frozen hashes, reported26/0/289, full typecheck,208boundaries and
scoped diff check green with no source-review blocker. Its approval remains
conditional on root's actual-file browser/mobile proof; it made no source edits,
map requests or uploads.

Proof includes strict metadata/shape/count/identity/link/coordinate/unknown-field
validation, JSON duplicate-key rejection, byte/row caps, all five category filters,
1,233 synthetic map points with expected category totals, long string IDs, escaped
hostile titles, pagination/empty states, source-specific SSR copy, unmount/clear
suppression, error recovery, OSM point selection/disposal and prior PriceLabs/699
regressions. Original PriceLabs importer is tested independently and through the
new source-discriminated router.

Builder also decoded the **actual** Order728 local normalized file, read-only:
`D:/Yellow/temp/order728/actual-run-20260925/osm_accommodations_normalized.json`.
Result:1,233 accepted rows; first Coral Deira Hotel. This is an offline decode,
not browser/map performance evidence. No second Overpass request was made.

The first test run caught a syntax typo in a newly written duplicate-key assertion;
it was corrected before the above green run. No implementation test failure was
ignored or bypassed.

## Frozen source hashes

| File | SHA256 |
| --- | --- |
| frontend/yellow/src/osm-market-import.ts | `c0393aecfaba8b1934166c12528382a85edae83667a743c4f5b01daba7eaa19a` |
| frontend/yellow/src/market-listing-import.ts | `1211c581acd792cf9289670240e14f6af78063bdb7de8f30a64125704faab507` |
| frontend/yellow/src/workspaces/StreetMapWorkspace.tsx | `5bfb20e5e3db83a1770741b33400fff9a78ed431086fe9a6c83f4cdfef45b4a6` |
| tests/order730-osm-map-import.test.ts | `ac2aa5115df4a77af0b2c97d734d55f64d9c7f96c9ae7a6345ad671c33baa5ec` |
| tests/order730-osm-map-results.test.tsx | `13431b439633633dae89ee3f6360298ae3a21e778516db58af3663c73a0e259d` |

## Root acceptance still required at builder handoff

Flow under test: existing local Market map → local JSON chooser → real Order728
file →1,233 accommodation places/pins → hotel927/apartment164/hostel75/guest-house55/
motel12 filters → OSM-ID/name search and selected coordinate-kind detail → clear
and remount → original PriceLabs import retains its own metadata/price semantics.

Required rendered checks: correct local page, meaningful DOM, no framework overlay,
console health, actual chooser interaction, point/cluster response, desktop+mobile
fit and no row upload/persistence. Root must record any tile-provider errors rather
than assuming the unchanged tiles succeeded. Local rebuild/promotion follows
independent checks; this builder does not claim the running image is updated.

## Not completed by this order

No active Dubai OTA inventory, Airbnb/Booking mapping, October per-listing prices,
persistent market feed, calendar integration, app-wide ecosystem completion, external
upload, source permission change or public deployment. This makes the real collected
open sample usable through the existing map's memory-only import once promoted.

## Root actual local acceptance

Combined imageff25e836 runs on loopback3010, same env and same DB/cache containers,
public tunnel OFF. Root actual file chooser loaded the real730,836-byte728JSON and
showed1,233places/1,233mapped. Initial setFiles→snapshot208ms is one automation
observation, not database latency, tile completion or a percentile benchmark.

Rendered category Hotel927/Apartment164; ID315482350 and Coral Deira name match1;
impossible search0. Detail shows exact source node,25.2660218/55.3256435 and unknown
commercial fields. Actual cluster click expands map extent; after clearing list
selection, clicking the settled single green point opens correct detail. An initial
click during flight animation missed; fresh geometry/click succeeded. Tiles really
rendered, final console warnings/errors0. No screenshot is substituted for click proof.

Clear removes data/results; invalid fixture is rejected; subsequent genuinePriceLabs
file loads2,528AbuDhabi rows with its own source metadata, and replacing it withOSM
shows only1,233OSM rows. Navigation/remount and reload clear mounted data.320/390px
checks show page scrollWidth=clientWidth305/375 and contained map/forms. Desktop
normalviewport restored; no persisted emulation/content changes. Final deliverable
will be reimported after the later734 app refresh, not treated as a persistentfeed.

Root combined93/0/774, fulltypes,208boundaries and Vite564 passed before cutover.
The freshfinancialproof732 does not repair serving-role drift; ready503 remains.
