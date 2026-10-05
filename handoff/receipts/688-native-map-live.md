# Order688 — approved native map live acceptance

24 September2026. Coordinator root. Founder approved exact pako2.2.0 `(MIT AND
Zlib)` and tslib2.8.1 `0BSD` exceptions in D-NATIVE-MAP-688. Ordinary allowlist is
unchanged and fails closed; retained notices are served. This supersedes the
deployment status, not historical evidence, in the685 staged receipt.

## Release identity and rollback

Existing sole app `yellow-public-demo-app-1` now serves image
`sha256:a42f0b25dcecc575ade0321635bc2bb292e72c728bd362553c7ffd6e4076ed46`,
tag `yellow-public-demo-app:orders688-689-candidate`. Source remains the existing
dirty D:/Yellow/git-live-order611-source-v2 checkout, HEAD e06e400a57485cc10a8a35c21dcb1e01b5a667d1;
this is not an immutable clean-Git release. Final native-enabled build includes
689's last parser/link-state fixes. Delta Dockerfile D:/Yellow/temp/order688-release.Dockerfile
copies static output and the two scoped group-search backend files over verified
686/687 image51be3920. No node_modules replacement or database migration.

Rollback image51be39202064765e2475209460fba0092547c615b28979826cd09fdf00b06bfd
retained as `yellow-public-demo-app:before-orders688-689`. Tag it to `latest` and
repeat the existing project's app-only compose up if rollback becomes necessary.
Promotion used `-p yellow-public-demo`, existing runtime env/compose/tunnel files,
`up -d --no-deps --no-build app`; database/cache/tunnel were not recreated.

## Executable evidence

- Non-implementer personally ran source/licence/asset/CSP tests; exact record in
  handoff/reviews/688-native-map-release.md. Worktree installed audit120 passed;
  final image installed audit47 passed including explicit tslib exception.
- Final `YELLOW_NATIVE_MAP_BUILD=1` Vite build then required-native combined
  licence/map/search/groups/navigation suites:51pass,1 complementary default-off
  skip,0fail,240 assertions. Both TypeScript checks and208 import boundaries pass.
- Final image/source hashes matched for groups.ts350d8aea…, operator.ts914d0d6d…,
  index.html75d2219e… and nativeengine1a81c118…. Final HTML statically preloads only
  React/Rolldown; engine unchanged from independent byte-exact notice/build proof.
- Public health200, retained pako notice200, Docker healthy. Native engine lazy
  raw3.71MB/gzip1.01MB; bundler large-chunk warnings retained, not a50ms claim.

## Public browser acceptance

URL https://lying-jones-terminal-church.trycloudflare.com/p/6081b544-22a1-534f-a86d-bb1ae0519e14/today?workspace=market-map

CUA in-app browser, desktop908x683 and actual responsive390x844. Page title Yellow
Hotel Operations and intended route verified; meaningful content, no framework
overlay and no error/warn console entries at checkpoints. Globe rendered real
OSM tiles; Dehradun Go ->2D displayed labelled streets. Native->Overture loaded
public2026-09-23 snapshot/world view ->Native remounted one canvas in3D. Mobile
document375px within390px viewport, wrapped controls readable. A browser viewport
override initially targeted another tab; corrected by using that responsive test
tab on the public route and verifying actual DOM dimensions. Superseded mis-scaled
captures are not acceptance evidence.

Screenshots outside repo:
- D:/Yellow/temp/order688-live-map-desktop.png (Dehradun2D)
- D:/Yellow/temp/order688-live-map-mobile.png (actual390px globe)

Local built-UI fixture additionally exercised GPS denied/manual fallback and
public synthetic coordinates30.3165,78.0322 accuracy25m, not real device GPS.
No real location permission requested. Network capture on Reservations had13
requests, zero native-engine/map/OSM loads, no truncated events. Local Overture
fixture404 was expected because it has no proxy; public Overture subsequently
loaded successfully. Public overview settled9,923ms in that session; no universal
latency promise. Local fixture8321 stopped; isolated689 DB removed after proofs.

## Explicit remaining risk

No Yellow-published hotel/BnB/vendor catalog, routing, satellite/live video or all
upstream feeds. No write flow was retested on live hotel data. Shared search
coverage and group room-block commands remain incomplete. Existing `/ready`503
`build_revision_unavailable` remains because source provenance is not clean;
PG18/rawPG16 snapshot drift and earlier legacy fixture failures were not waived.
No full CI/PR/Git publication or production-ready claim. Only scoped acceptance.
