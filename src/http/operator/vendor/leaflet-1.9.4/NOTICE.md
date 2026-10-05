# Leaflet1.9.4 — local optional market-map renderer

Order472/Q268; fetched13 September2026. Unmodified publisher release files,
including original UTF-8 encoding and line endings (format-restored after patch
creation), verified after writing. No runtime CDN/package-manager dependency.

| File | Source | Bytes | SHA256 |
|---|---|---:|---|
| leaflet.js | https://unpkg.com/leaflet@1.9.4/dist/leaflet.js | 147552 | DB49D009C841F5CA34A888C96511AE936FD9F5533E90D8B2C4D57596F4E5641A |
| leaflet.css | https://unpkg.com/leaflet@1.9.4/dist/leaflet.css | 14806 | A7837102824184820DFA198D1EBCD109FF6D0FF9A2672A074B9A1B4D147D04C6 |
| LICENSE | https://raw.githubusercontent.com/Leaflet/Leaflet/v1.9.4/LICENSE | 1395 | 53E8DC25862014E4324741CA18FBE3611E11D42EF69F59F86EA8C5389647D4CB |

JS/CSS hashes match the publisher SRI pins at https://leafletjs.com/download.html.
LICENSE was retrieved from the exact upstream v1.9.4 tag and is preserved in full.
Leaflet code is BSD-2-Clause, copyright Volodymyr Agafonkin and CloudMade.

Only the release JS/CSS/license are included. This implementation uses
CircleMarker plus zoom/attribution controls, not Marker/Icon/LayerControl images.
The optional development source map is not included. Do not add dynamic CDN,
remote font, tile prefetch or full3D dependencies through this static inclusion.

OSM basemap tiles are separate external data, not covered by Leaflet's code
license. Enable-map disclosure, permanent linked attribution, ordinary browser
caching and viewport-only requests follow
https://operations.osmfoundation.org/policies/tiles/.
Public tiles are optional and best-effort, not a commercial SLA or offline
archive entitlement. No live tile request is part of automated verification.

