# Order734 — show complete folio statement history honestly

Root admits the next read-only guest billing gap after727/729: the statement API
defaults to50 rows, but the main table labels and searches that subset as all data.
Reuse existing GET statement limit/after contract; no schema, money or grants.

## Exact scope and coordination

- Builder folio_history734 (takes over initial folio-history.ts draft; antigravity_dubai728 stopped): new frontend/yellow/src/folio-history.ts,
  new frontend/yellow/src/ui/FolioHistory.tsx,
  frontend/yellow/src/yellow-api.tsx (statement pagination metadata/reader only),
  frontend/yellow/src/workspaces/FinanceWorkspace.tsx (history/table integration only),
  tests/order734-folio-history.test.ts, tests/order734-folio-history.test.tsx,
  handoff/receipts/734-complete-folio-history.md.
- Resolved question735 extends test-only integration scope to
  tests/order672-folio-workbench.test.ts and tests/order721-guest-billing-workspace.test.tsx:
  replace only the obsolete direct-table identity assertion with keyed FolioHistory
  and prove its existing table child. Preserve every mutation/recovery guard.
- Independent app_next_slice727: handoff/reviews/734-complete-folio-history.md.
- Root: this order, docs/PROJECT-STATUS.md, handoff/LEDGER.md, generated artifacts
  D:/Yellow/temp/order734/ and existing frontend output; local app-only promotion.
- FIRST implement pure new files/tests only. Do not edit FinanceWorkspace or
  yellow-api until root confirms727 financial review and initial runtime proof
  have frozen. This prevents conflicting source/provenance during ongoing proof.

## Contract

Read-only bounded Load older postings; retain exact server balances/order and
lineCount. Search/filter/sort must label their loaded subset until complete; never
claim all postings while nextCursor exists. No silently skipped pages, duplicate
IDs, cursor cycles, mixed folio/reservation/currency/generation or stale async
completion. Context change/authoritative first-page refresh resets history. Detect
balance/generation/family drift and require refresh rather than merge. Explain
page/error/retry state accessibly; pagination is optional, never automatic unbounded
loading. Existing financial locks/drafts must survive, and loading older history
must not replace the authoritative first-page query cache or mutation evidence.

Proof: pure hostile page/cursor/context tests, render/integration regressions,
full typecheck/boundaries; independent reviewer personally executes relevant tests.
Root uses actual local browser and explicitly labelled synthetic read responses
if real folio has fewer than51 records; no hotel financial writes for QA. No public
tunnel, new provider request, credentials, persistent dataset or release-complete
claim. Further out-of-scope changes require a written scope question first.
