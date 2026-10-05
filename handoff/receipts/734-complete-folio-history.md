# Order734 builder receipt — bounded folio history

Date: 2026-09-25. Source is frozen for independent review; this receipt is builder evidence, not reviewer approval or runtime promotion.

## Delivered

- Main bill table now renders `FolioHistory`, which keeps the authoritative first statement page in the existing query cache and holds older GET pages only in component memory. `loadFolioStatementPage` sends `limit=100&after=<cursor>` with the existing session token and abort signal.
- The view states `Loaded N of lineCount`, labels search, filter, sort and posting-class counts as applying to loaded rows until the cursor ends, and offers manual Load older, retry and refresh controls. Server order, string minor amounts and server running balances are retained. It reuses `FolioStatementTable` and its controls/copy cells.
- Page parsing binds property, reservation, folio, currency, generation, family balances/window metadata and cursor position. Later pages reject repeated IDs, short nonfinal pages, changed family, cycles, ordering regressions and omitted final rows. A failed read retains prior rows; structural drift requires an authoritative refresh. Context/first-page updates discard stale completions. The existing financial navigation/mutation lock gates loading.
- Manual history is capped at 10,000 loaded rows. A final short page remains available when the server total fits within the cap. The view explicitly says it is incomplete if the cap prevents further loading; it makes no complete-history claim beyond the cap. Older pages never replace financial draft, correction or cache evidence.
- Resolved Question735 amended only two stale direct-child source assertions in Order672/721 to check the keyed history component and existing table child. All their other recovery/lock assertions remain.

## Builder proof

`C:/Users/astha/.bun/bin/bun.exe test tests/order734-folio-history.test.ts tests/order734-folio-history.test.tsx tests/order672-folio-workbench.test.ts tests/order721-guest-billing-workspace.test.tsx tests/order714-finance-integration.test.ts tests/order714-additional-folio-window.test.tsx tests/order727-finance-integration.test.ts tests/order727-folio-charge-correction.test.ts tests/order727-folio-charge-correction.test.tsx tests/order729-folio-table-controls.test.tsx` — **67 pass, 0 fail, 522 assertions**. This includes controller execution through 9,950→9,999, over-cap refusal, and cap wording in the rendered view. An earlier test fixture that rendered all 9,950 table rows twice exceeded Bun's 5-second test timeout; the final fixture selects one visible posting class while retaining 9,950 loaded rows for the cap check. Full-table 9,950-row browser performance is unmeasured here.

`C:/Users/astha/.bun/bin/bun.exe run typecheck` — pass (root and frontend). `C:/Users/astha/.bun/bin/bun.exe run boundaries` — 208 TypeScript files, pass.

No Vite build, browser QA, database statement fixture, local app promotion or hotel financial write was performed by this builder. Root owns browser QA; independent reviewer owns the Order734 executable review.

## Source freeze SHA-256

| File | SHA-256 |
|---|---|
| `frontend/yellow/src/folio-history.ts` | `D07FC55A733B1A84D74A20F7D144FD59316F0BFD5EA4026266A7E10E5F344CC5` |
| `frontend/yellow/src/ui/FolioHistory.tsx` | `80CC6FB65177A6EB6BE386BE7C7A31DCF5AE85BC2B1B83DE037315B8C7D4E90D` |
| `frontend/yellow/src/yellow-api.tsx` | `E0B81D762CECFE6220635DC6EF1EEA7151FB801697B0E0D602B228BFE59419B5` |
| `frontend/yellow/src/workspaces/FinanceWorkspace.tsx` | `7FFC72B8BC2C5DA7CB6E4FFA7B10448E5F175613BD8E79EEBADDA19F31016FF9` |
| `tests/order734-folio-history.test.ts` | `742AA5F9DA2FD20174E77F1342B9F03CC7E2F986ADC1F1563AB2EA30852F7312` |
| `tests/order734-folio-history.test.tsx` | `BDE34008E61BB365FD79B6C585925F320F5BBDA50EED325B12F39B14D1E4504A` |
| `tests/order672-folio-workbench.test.ts` | `9FC258BFFF89A3074F393862BF75366F9C1FA6CA62B5A277C16FE34B5D132520` |
| `tests/order721-guest-billing-workspace.test.tsx` | `5A0C3E147D2673B6CF0B29AEBFF9FA60494EE4ED6C764AD71957AB8FB851130E` |

## Root final runtime acceptance — 2026-09-25

The independent nonimplementer approved the final hashes above in review734.
Root personally reran all ten billing/history files: **67 passed, 0 failed,
522 assertions**. The adjacent five map files separately passed **26 tests,
289 assertions**. Root and frontend types, 208 import boundaries, and Vite's
566-module build passed. The existing large map chunk warning remains unchanged.

The preliminary image `b849706f…` was briefly running locally when the builder
reported the cap finding; it was not a public release. Root rebuilt after the
final reviewer approval and replaced it with
`sha256:34b83ec68987a308c9c46626cdcfbc97ea542209524d6bdb6b669b21d3eeb0dd`.
Only the app service was recreated with `up -d --no-deps --no-build app`.
PostgreSQL/cache container IDs were unchanged. A raw ordered environment-string
comparison returned false, so root checked all configured environment key/value
pairs against the existing Compose configuration without printing values: no
mismatched keys. No configuration file or serving credential was changed.
Final generated assets include `FinanceWorkspace-DZ8b9Eq-.js` and
`index-DusA4ysm.js`.

Actual IAB browser proof on that final candidate:

- Real selected bill L3R-FOL-1 loaded its one existing Laundry posting and SAR25.00
  balance; the strict history parser accepted the genuine endpoint response.
- A temporary current-origin GET-only fetch fixture supplied clearly labelled
  synthetic postings, never a database fixture or a financial POST. Actual UI
  Load older progressed **50 → 150 → 151**, labelled partial versus complete
  accurately, removed Load older when complete, and found the oldest posting in
  the existing table search. Refresh returned to the newest 50 and cleared search.
- A synthetic503 retained the previous rows and exposed Retry; the browser's
  captured safe call metadata confirmed retry used exactly the same cursor.
  Changed generation rejected the older page, retained50 previous rows, and
  required refresh. Synthetic cursors were never sent to the real backend.
- Reload removed the temporary fetch fixture; root explicitly checked its marker
  was absent and closed the temporary billing QA tab. No persistent browser or
  server test modification remains.
- On the genuine bill, preparing a correction disabled history refresh and Map
  navigation. Cancel re-enabled both. No Confirm reversal or other financial
  command was submitted. At390/320 viewport widths, document client/scroll widths
  both matched375/305 respectively; history right edges remained346.4/276 within
  those bounds. The temporary viewport override was reset.
- The final app also reimported the actual728 JSON through the file chooser:
  **1,233 mapped OSM places**, all categories and provenance visible, clustered
  points rendered, console warning/error list empty. That map tab is left as the
  deliverable; rows are still mounted-memory-only, not an automatic feed.

Final service checks: `/health`200. `/ready`503 remains the inherited
`build_revision_unavailable` with migration frontier101; no readiness gate was
weakened. Only the app, original PostgreSQL and original Valkey are running in
this project's Docker stack; public Cloudflare tunnel stays OFF. Review732's
isolated financial proof does not resolve the serving/shared NOINHERIT drift.
No claim is made about 9,950-row browser performance, production readiness,
complete OTA market coverage, October per-listing rates, or ecosystem completion.

The final `state.ps1` ritual correctly read the updated lifecycle but reported all
three services down even with `COMPOSE_PROJECT_NAME=yellow-public-demo`. This
contradicted direct Docker project-label inspection (app, PostgreSQL and Valkey
all healthy) and the actual HTTP200/browser checks. Its bounded Compose status
probe remains a separate diagnostic gap; this receipt does not treat its down
lines as evidence the verified local app is stopped. No state-script edit was
made outside the order scope.
