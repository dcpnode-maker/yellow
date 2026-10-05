# Order 668 - Shared hotel search

2026-09-24. Implemented and deployed to the existing single app. This is a partial
search beta, not full ecosystem/PMS completion.

## Delivered

- Search hotel control in all ten operator header branches; Ctrl/Cmd+K, native
  modal, Escape and focus return; responsive 390px layout.
- Explicit-submit, property-keyed authorized reservation/profile reads; reuses
  the Today index, no API call per keystroke or LLM call.
- Name, confirmation, room-reference and API-filtered contact/alias matches;
  bounded results, partial-source errors, exact entity links and cashier handoff.
- Only successful party API candidates produce Profile links. Failed/denied
  profile search cannot recover Profile links from stay data.
- Same-name profiles distinguishable by API-provided masked contact hint or
  last-eight-character profile identity. No record merging.
- Ecosystem search entry is beta; folio/group/task/catalog indexing is not claimed.

## Executed proof

Implementation worker `/root/search_model_builder` (requested GPT-6 Luna) wrote
pure matcher/tests; root integrated the UI. Independent reviewer
`/root/journey_service_research` did not implement this order. Reviewer found the
stay-to-profile fallback boundary defect; root removed it and added a regression.
Reviewer personally re-executed the final proof after the identity-hint UX tweak:

```
bun test tests/order668-hotel-search.test.ts tests/order668-search-surface.test.ts tests/order667-arrival-recovery.test.ts tests/order669-group-overview-activation.test.ts
21 pass, 0 fail, 96 assertions
bun run typecheck
root + frontend: pass
```

Root also ran `bun run boundaries` (205 files, pass), production Vite build and
targeted diff whitespace check. Surface tests include source-contract checks;
actual UI behavior was checked separately in the serving browser, not inferred
from those assertions.

Browser: Ctrl+K focuses search; Aisha returned profile and stay results; exact
L3R-FU-0024 returned the correct stay; its cashier link displayed selected
Aisha Kareem / L3R-FU-0024 and the existing explicit open-window confirmation.
No confirmation was submitted. Empty query result displayed actionable guidance;
Escape closed the dialog and restored trigger focus. At 390x844, search dialog
fit the viewport and its result opened L3R-FU-0024. Screenshots emitted in task.
Final build: ecosystem search button opened the native dialog; same-name profiles
showed different short identity hints, and a selected Aisha profile opened its
profile and stay-history region. Fresh browser error/warning log was empty.

## Deployment / limits

Source `D:/Yellow/git-live-order611-source-v2`, existing dirty work preserved.
252 backend file hashes matched the prior serving container; no backend/data edits.
App `yellow-public-demo-app-1`, port3010; image
`sha256:b02894835eb2e247a5a3fbfcfa6a31195f78e76894d5dba6c3d196c8c2b278f7`.
Entry asset `index-DkL33lbm.js`. Health reported healthy.
Rollback image `yellow-public-demo-app:before-order668` retained.
Used supported empty build SHA for dirty source; did not fabricate clean provenance.

Public review URL: https://lying-jones-terminal-church.trycloudflare.com/
Temporary quick tunnel; synthetic property data. No push/PR or clean-commit claim;
no migrations, permissions changes, real posting, check-in or checkout executed.
No local-phone worker, free cloud usage or automatic model failover claimed.
Remaining activation work is in `docs/FEATURE-ACTIVATION.md`.
