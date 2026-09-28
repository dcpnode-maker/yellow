# Q268 — Order472 real map and selectable evidence attributes

Status: RESOLVED by primary owner before implementation,13 September2026.
This is a source integration tranche of Order472, not a new phase or release.

## ADR-Q268: optional isolated raster map

Status: Accepted for source implementation. Decider: root, following Astra Ultra
read-only architecture assessment and the engineering architecture skill.

Context: the requested real2D map is not satisfied by the existing coordinate
plot. Preserve low device/resource cost, no new service, offline table usability,
strict parent CSP and no provider traffic before deliberate activation.

Decision: self-host unmodified Leaflet1.9.4 (BSD-2-Clause) in a small same-origin
frame created only by an explicit Enable map action. Keep scripts/styles local;
use at most500 CircleMarkers with no extra marker/cluster/3D dependency. A marker
click inspects the corresponding evidence; it cannot select own/comparator or
confirm anything. This frame isolates policy, not same-origin confidentiality.

Options: direct Leaflet is slightly less code but relaxes image origins for the
whole operator SPA; rejected. MapLibre supports later vector/3D needs but adds
worker/WebGL delivery unnecessary for this bounded2D flow; deferred, not rejected
for the product. Hand-building a street renderer duplicates mature functionality.

The only frame-document CSP exception is for an exact registered successful GET
response when both operator and market API composition are enabled. Every normal
page, API, asset, wrong method, missing route and error retains existing headers.
Frame scripts/styles self only; connect-src none; img-src self data: and exactly
https://tile.openstreetmap.org; frame-ancestors self; XFO SAMEORIGIN. No global
SECURITY_HEADERS edit, unsafe-inline/eval/blob/remote code or generic URL proxy.
The data image allowance is Leaflet's pinned tile-cancellation placeholder only.

Public basemap activation discloses OSMF receives IP, viewed tile area and origin
referrer. Use the standard HTTPS XYZ endpoint, normal browser caching, visible
linked attribution, no bulk/prefetch/offline archive or geocoder. The table and
inspection remain usable on tile failure. Public OSM tiles have no SLA; production
scale/alternative providers remain separately configured work, not guaranteed
free hosting. Do not send identity/guest/tenant/authentication data externally.
Tests intercept all external tiles; no automated live OSM browsing or harvesting.

Sources checked13 September2026:
- https://leafletjs.com/download.html — stable1.9.4 and published JS/CSS SHA256.
- https://github.com/Leaflet/Leaflet/blob/v1.9.4/LICENSE — BSD-2-Clause.
- https://operations.osmfoundation.org/policies/tiles/ — usage, caching, attribution.
- https://raw.githubusercontent.com/Leaflet/Leaflet/v1.9.4/src/layer/tile/TileLayer.js — cancellation placeholder.
- https://maplibre.org/maplibre-gl-js/docs/ — alternative renderer architecture.

## Exact ownership and file admission

- Root: unmodified src/http/operator/vendor/leaflet-1.9.4/{leaflet.js,leaflet.css,LICENSE}
  and NOTICE.md; this question, Order472, docs/DEPENDENCIES.md, docs/SECURITY.md
  (this precise exception only), existing contracts/receiving/status/manifest/
  review472/DECISIONS/LEDGER; tests/operator-market-map.browser.test.ts new and
  existing tests/operator-market.browser.test.ts.
- /root/q258_runtime_cutover: src/http/market-map.ts new; src/app.ts exact routes/
  successful-document header hook only; tests/operator-market-assets.test.ts.
- /root/astra_ultra_handoff: new src/http/operator/market-map.html,
  market-map.js, market-map.css; tests/operator-market-map.test.ts new.
- /root/q258_source_adapter: existing src/http/operator/market.js,
  operator.css market-prefixed additions, tests/operator-market.test.ts.

Root may fetch only the exact upstream1.9.4 JS/CSS/LICENSE into these absent
vendor paths, verify published hashes before writing and use apply_patch; retain
unmodified content plus full license/provenance. No package manager/lockfile
change, new runtime dependency copy, source map/images/CDN loads or full archive.

HTTP routes: GET /assets/market-map/frame.html; GET /assets/market-map/frame.js;
GET /assets/market-map/frame.css; GET /assets/market-map/leaflet.js;
GET /assets/market-map/leaflet.css. No arbitrary path routing or property data here.
Frame assets are public static code, not an authorization source. Preserve error
headers. Do not import operator.ts's operational commands into the new asset module.

## Fixed parent/frame protocol

Frame boot emits {type:"yellow-market-map-ready",version:1} to parent at exact
location.origin. Parent accepts only current iframe.contentWindow and exact origin.
Parent's data message:
{type:"yellow-market-map-data",version:1,nonce:<canonical UUID>,revision:<positive integer>,
 points:[{id:<opaque nonempty<=80>,name:<bounded<=500>,latitude,longitude,
 role:"candidate"|"own"|"comparator"}]}.
No tenant/property IDs, credentials, file paths, evidence hashes or request URLs.
Parent retains exact current property/snapshot/mount binding internally. Frame
accepts only its actual parent/origin, first nonce then same nonce and monotonically
increasing revision; fully validates <=500 distinct points before replacing data.
Frame response {type:"yellow-market-map-inspect",version:1,nonce,revision,id}
is accepted only for the current binding and known filtered point. Inspection
may focus/show record details, never toggle a selection. All labels use text nodes.

Parent destroys frame/listener/bindings on property/source change, refresh start,
suspend/dispose/logout or permission loss; late readiness/inspection cannot act.
Filtering/selection may send a fresh bound revision without recreating a frame.
Disable map-changing controls during uncertain/in-flight confirmation; do not
destroy the exact retry intent. Explicit Disable map removes the frame/resources.
Fit bounds only on first dataset or explicit Fit records, not after each click.
Keep keyboard pan/zoom, zoom controls and visible attribution. No hidden preloads,
pan/zoom animation under reduced motion, or background refresh while hidden.
Handle Mercator's latitude limit explicitly: outside +/-85.05112878 remains in
the complete table and an omitted-from-map count is visible, never false coverage.

## Attributes and proof

Retain already validated websites/categories in frozen parsed records. Provide
selectable table attributes (address, categories, websites, coordinates, operating
status, provenance) with compact defaults and a keyboard-accessible full inspector.
Unsupported source attributes remain absent/unknown, never invented. Preserve all
original dates/coverage/release/schema/attribution and exact confirmation references.

Root independently executes real Chrome/real vendored Leaflet proof using only
intercepted synthetic tile images: zero pre-activation map requests; exact assets;
unchanged parent/error CSP and narrow working frame CSP; real marker inspection;
no automatic selection; pan/zoom bounds; empty/500/out-of-projection records;
wrong/old origin/source/nonce/revision; tile failure fallback;375px/keyboard
usability; refresh/property/session teardown. No screenshot-only acceptance.

No domain, schema, grant, database, server startup, live cutover, publication or
provider-shopping changes. The previous153-test Q267 acceptance remains historical;
new code requires new relevant proof before an updated acceptance claim.

### Root browser-harness reuse amendment (before extraction)

Admit root-owned tests/helpers/market-browser.ts, extracted from the existing
root-owned browser proof without relaxing startup/CDP/condition/cleanup deadlines.
Both market browser files reuse it; add a bounded CDP event subscription so all
external tile requests are intercepted before navigating. No duplicate Chromium
runner, extra dependency or real-browser-profile access. Root executes both old
journeys again after extraction.

## Source acceptance

Completed source tranche,13 September2026; independent root execution and hashes
are recorded in Review472. Related aggregate139pass/20environment-gated skips/
0fail/1777assertions; new actual-map journey1pass/0fail/69assertions. Types and202
boundaries pass. Native/DB/full-referee/CI/live-delivery proofs are not claimed.
The architecture skill influenced the isolated, lazy, replaceable map choice.
Order472 continues through separate exact-source release gates.
