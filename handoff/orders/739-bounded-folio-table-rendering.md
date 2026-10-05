# Order739 — keep large folio tables responsive

26 September2026. Founder requests completion using only local/free model workers.
Builder and separate reviewer use the existing included-quota Antigravity Gemini
CLI directly while the founder's replacement harness741is researched. No GPT
implementation/review worker or paid fallback. Disjoint from741research scope.
Root may admit exact739write and required source/test/skill reads in740config.

## Exact scope

Builder may edit:
- frontend/yellow/src/ui/FolioStatementTable.tsx
- frontend/yellow/src/ui/folio-workbench.css (pagination styles only)
- tests/order739-folio-table-pagination.test.tsx
- handoff/receipts/739-bounded-folio-table-rendering.md
Independent reviewer may write handoff/reviews/739-bounded-folio-table-rendering.md.
Root owns this order and shared status/ledger. Preserve all prior dirty work.

Read PROJECT.md, AGENTS.md, relevant React performance skill and Orders729/734.
Current table renders every filtered row at once; Order734 retains up to10000
history rows and its proof reports large-table browser performance unmeasured.
Add bounded client-side display pagination (50 rows/page) AFTER existing search/
filter/sort over all loaded rows. Do not truncate query input or change fetches,
load-older behavior, original server balances/order, money formatting, copy
controls, column controls or financial mutation locks.

Show accurate visible range/matching-loaded count and accessible previous/next
controls, disabled at bounds. Reset to first page for query changes; clamp safely
when data shrinks and when zero rows match. Avoid blank out-of-range states.
Maintain compact mobile containment. State clearly that paging is of loaded
rows, not proof of complete server history. No new dependency, API/database/
financial/domain changes, rate/price calls, credentials, actual hotel writes,
promotion, deployment or live/tunnel change. No unbounded background fetching.

Tests must execute real component interactions with more than100 rows and a
large fixture (thousands of rows), verify bounded tbody count, all-page reachability,
query/reset/shrink behavior, exact copying and unchanged authoritative values.
Run focused739 and adjacent729/734 tests plus typecheck/boundaries. Independent
Gemini review must personally execute relevant tests and inspect the diff; do not
claim browser performance merely from unit/render tests. If another file is
needed, write a scoped question and stop; never silently widen scope.
