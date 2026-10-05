# Order714 — Open a named bill window before charges are routed

Founder continuation, Phase5/7. The active cashier can create a window as part of
a charge transfer but needs the already-built standalone additional-window action.
Natural solution: reuse FolioService.openAdditional and existing reservation and
statement reads. No new ledger, account, numbering, tax or hotel policy is admitted.

Contract: POST /api/v1/properties/:property/reservations/:reservation/folios with
exact {sourceFolioId,name}, retained Idempotency-Key, HTTP201 canonical receipt.
Trimmed name1–80 per existing HTTP contract. Server owns permission, family,
number/reference, duplicate names,20-window cap and status. Review exact name and
source, explicit confirmation. No invoice or charge is created. Read back exact
receipt against refreshed reservation/statement before reporting success. Unknown
outcomes retain exact body/key and lock navigation/competing commands until same-key
reconciliation. Stale property/reservation/token responses must not paint success.
No draft or recovery key may be accidentally discarded by disclosure or window switch.

Scope/owners:
- Builder guest_contract709: new frontend/yellow/src/workspaces/AdditionalFolioWindow.tsx,
  frontend/yellow/src/workspaces/additional-folio-window.ts,
  frontend/yellow/src/workspaces/additional-folio-window.css,
  tests/order714-additional-folio-window.test.tsx. Inject token, canonical read
  callbacks, synchronous parent mutation lease and completion callback; avoid
  importing App or changing existing financial commands.
- Root: frontend/yellow/src/workspaces/FinanceWorkspace.tsx only integration near
  existing folio windows, shared command/navigation lease and exact cache selection;
  tests/order714-finance-integration.test.ts; scripts/order714-folio-proof.ps1
  isolated schema-only proof helper using existing financial-folio-transfers suite.
- Governance: this order, handoff/questions/714.md if needed,
  handoff/receipts/714-additional-folio-window.md, handoff/reviews/714-folio.md,
  docs/PROJECT-STATUS.md and handoff/LEDGER.md.
- Generated public/yellow-next/** and external D:/Yellow/temp/order714-* build files.

Mandatory independent reviewer personally executes client/React/integration checks,
full types/boundaries and canonical financial-folio-transfers.integration.test.ts
against a newly named, schema-only isolated database (not live data/fixtures).
No backend, migration, permission, business policy or live hotel QA mutation.
Actual browser draft/review/cancel and mobile layout, app-only deployment after
approval with current image retained. Whole ecosystem remains unfinished.
