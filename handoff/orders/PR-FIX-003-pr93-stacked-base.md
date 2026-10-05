# PR-FIX-003 - Preserve both PR93 and PR92 map workflows

Founder authority: repair all existing public PRs. PR93 remains based on PR92's
phase-7/operator-invoice-workflow at75a2eba1cd34d0512d010bf3f91230ebed4720e7.
No merge into main, base switch, forced push or live promotion.

## Exact scope

- src/app.ts; src/contexts/distribution/index.ts; src/http/market-map.ts;
  src/http/operator/index.html; src/http/operator/operator.js; src/server.ts.
- tests/founder-status.integration.test.ts; operator-adaptive-experience.test.ts;
  operator-flagship-motion.test.ts; operator-layout-composition.test.ts;
  operator-management-demo-navigation-finetune.intentional-red.test.ts;
  operator-market-map.browser.test.ts; operator-market-map.test.ts;
  operator-workspace-layout.browser.test.ts; operator-workspace-skins.test.ts.
- The two existing PR93 research-map tests preserved under distinct names:
  tests/operator-overture-market-map.browser.test.ts and
  tests/operator-overture-market-map.test.ts.
- This order, questions/PR-FIX-003-map-file-collision.md and paired review receipt.

Keep the newer base's governed Market evidence workflow and its same-origin map
frame/CSP, plus PR93's read-only public catalog map and research selection. Both
already-existing API/route contracts and property-grant checks must survive.
Alias the distinct asset helpers rather than replacing security wrappers. Keep
both paired test contracts under distinct names; update exact navigation/icon
vectors to include both destinations, never omit original destinations/assertions.

No applied migration, DB authority, generic seed, price/calendar collection,
financial/occupancy policy, credentials, market-data import or live access change.
Execute focused tests/types/boundaries and actual rendered browser proof; canonical
DB referee before publication. Independent high-risk/runtime acceptance remains
explicitly pending rather than inferred from advisory model output.
