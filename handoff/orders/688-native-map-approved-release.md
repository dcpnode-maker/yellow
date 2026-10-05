# Order 688 — approved native map release

24 September 2026. Founder explicitly approved the two licence exceptions and
asked to proceed with native map release and remaining almost-ready workflows.
This order is the narrow release continuation of685, not permission for all feeds.

Status: bounded live delivery verified24 September. Receipt688-native-map-live.md
and independent review688 record exact proof and exclusions. No PR/merge or full
production-readiness claim; inherited build revision debt remains.

## Scope

- scripts/license-check.ts; tests/license-check.test.ts: exact package/version/
  declared-expression exceptions for pako2.2.0 (MIT AND Zlib) and tslib2.8.1 (0BSD).
  Preserve fail-closed policy for every other package/version/expression. Log the
  accepted exception; no file-driven exception bypass or broad SPDX allowlist.
- frontend/yellow/vite.config.ts; tests/order685-native-map-http.test.ts: retain
  and verify actual pako MIT and embedded zlib notices, plus tslib/GodEye/Cesium
  notices. Explicit native enabled build; retain default-off capability.
- Existing685 map implementation/test files only for regressions preventing its
  documented release contract; report any new scope before editing.
- Generated public/yellow-next output; temporary delta Dockerfile under
  D:/Yellow/temp; deploy only existing public app, based on exact current686/687
  image51be3920. No node_modules replacement, migration or database writes.
- DECISIONS.log, handoff/questions/685.md, docs/PROJECT-STATUS.md (including
  repairing current-order-files delimiter to the parser's semicolon contract),
  docs/product/NATIVE-GOD-EYE-LISTINGS.md, this order, handoff/LEDGER.md,
  handoff/reviews/688-native-map-release.md and handoff/receipts/688-native-map-live.md.

## Acceptance

Licence negative/positive regressions and actual installed dependency audit pass;
independent non-implementer executes licence/CSP/static-asset proof. Types and
boundaries pass. Native-enabled built UI renders actual globe on public HTTPS;
manual city/2D/3D/Overture switch and mobile checked. GPS is button-invoked and
permission-based; do not request real location just to test without consent.
Reservations686/687 remain working. Existing app image retained for rollback;
rollback if map crashes app, core reservation smoke fails, or asset/CSP gate fails.
No new public server; preserve existing database/cache/tunnel. Readiness/build-SHA
debt remains explicit; no full CI or immutable source claim without evidence.

## Exclusions

No public Yellow listings publication, vendor onboarding, navigation/routing,
satellite/live-feed entitlements, new provider keys, financial/inventory writes or
entire ecosystem completion. Remaining workflow implementation gets another
bounded order after reading the actual All Ecosystem catalogue.
