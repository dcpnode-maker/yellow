# Order730 — put the collected Dubai base on Yellow's existing map

Order728 actually returned 1,233 OSM accommodation points. Founder wants usable
data inside the app, not only files/scripts. Add strict support for that separate
open-data format to the existing in-memory map import without mislabelling it as
PriceLabs or OTA data.

## Scope and ownership

- Builder antigravity_dubai728: frontend/yellow/src/osm-market-import.ts;
  frontend/yellow/src/market-listing-import.ts;
  frontend/yellow/src/workspaces/StreetMapWorkspace.tsx;
  tests/order730-osm-map-import.test.ts;
  tests/order730-osm-map-results.test.tsx;
  handoff/receipts/730-dubai-open-data-map.md.
- Root: this order; docs/PROJECT-STATUS.md; handoff/LEDGER.md; independent tests,
  browser verification and combined app-only local promotion with727/729.
- Generated output/QA D:/Yellow/temp/order730/ and existing ignored frontend build.
- Independent app_next_slice727 review: handoff/reviews/730-dubai-open-data-map.md.

## Contract

Accept the exact yellow.osm-accommodation-sample.v1 normalized shape with bounded
rows/bytes, unique type+string-id identity, valid finite coordinates within declared
sample, fixed OpenStreetMap HTTPS source links, expected unknown fields, known
tourism/coordinate kinds, parseable timestamps, counts and attribution. Unknown
format or corrupted/mixed claims fail closed. Shared display data must distinguish
OSM from PriceLabs with a discriminated source type; do not weaken PriceLabs722
validation or disguise OSM as its schema. No blending of the two datasets.

Show source/provenance and actual data count, hotel/apartment/hostel/guest-house/motel
filter, search, pagination, point/cluster selection and coordinate kind. OSM has no
prices, bedrooms, reviews, verified active inventory, OTA identity or exact entrance;
do not display invented values or imply complete Dubai coverage. Retain visible
OpenStreetMap/ODbL attribution and existing map tiles. Use the existing compact
design and neon-green pins. One source loaded at a time. Local file stays in mounted
memory only, is never uploaded or persisted, clear/remount behavior remains intact.
No backend, DB, role, source request, paid service, public tunnel or dependency change.

## Proof

New synthetic tests for strict input, identities, links, coords, limits, metadata,
malformed claims, exact count/search/category filtering and source-specific rendered
copy. Run prior723/699 map proofs, new tests and typecheck. Root independently samples
real728file, loads it with actual file chooser, checks1,233points/counts, filters and
details plus mobile fit; preserve private PriceLabs behavior. Combined local app-only
promotion only after relevant checks. No calendar-rate or ecosystem-complete claim.
