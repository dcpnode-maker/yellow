# Order 727 — complete staff billing charge correction

Founder priority: resume unfinished app delivery while market-data acquisition runs
separately. This order exposes an existing governed financial command; it does not
invent a new posting policy or claim ecosystem completion.

## Scope and ownership

- Builder app_next_slice727: frontend/yellow/src/workspaces/FinanceWorkspace.tsx;
  frontend/yellow/src/ui/FolioActionRibbon.tsx;
  frontend/yellow/src/workspaces/FolioChargeCorrection.tsx;
  frontend/yellow/src/workspaces/folio-charge-correction.ts;
  frontend/yellow/src/workspaces/folio-charge-correction.css;
  tests/order727-folio-charge-correction.test.ts;
  tests/order727-folio-charge-correction.test.tsx;
  tests/order727-finance-integration.test.ts;
  tests/order721-guest-billing-workspace.test.tsx (only new lease integration).
- Root: this order; handoff/receipts/727-folio-charge-correction.md;
  docs/PROJECT-STATUS.md; handoff/LEDGER.md; integration and app-only local build.
- Nonimplementing reviewer: handoff/reviews/727-folio-charge-correction.md;
  personally execute relevant existing financial/PostgreSQL proofs plus new tests.
- Generated QA/build artifacts: D:/Yellow/temp/order727/ only and existing ignored
  frontend build directory. No unrelated staging, checkout switch, or resets.

## Contract

Reuse existing property-authorized statement read and charge reversal endpoint.
Keep original journals immutable. No backend/schema/tax/numbering/permissions or
demo grants changes. No automatic no-show/cancellation fees, payments, cash drawer,
or real guest financial mutations for browser QA. Preserve active drafts and the
shared workspace navigation locks.

Compact Corrections ribbon panel: existing posted-charge selection, original
amount/date/code and server eligibility/reason, mandatory bounded reason, explicit
named confirmation, server-authoritative preflight, exact immutable request and
same-key recovery after an uncertain outcome. Never permit a second reversal
merely because a transport failed. Refresh authoritative statement after success;
never optimistic ledger arithmetic. Page through existing statement cursors so
eligible older charges are reachable, detecting identity/generation changes.

## Acceptance

Regression tests cover parsing, eligibility, context drift, duplicate submission,
uncertainty/replay, mismatched receipt, correct navigation-lock ownership and
pagination without omission/duplication. Typecheck, import boundaries, focused
adjacent billing tests; independent reviewer personally executes existing financial
corrections and folio workbench integration proofs using isolated test data.
Render desktop and mobile against local candidate, verify correction UI and blocked
states without live ledger writes. Promote app only after relevant checks pass;
leave database/cache and public tunnel unchanged (tunnel remains OFF).
