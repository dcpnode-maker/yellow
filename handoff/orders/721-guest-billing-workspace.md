# Order721 — Guest-first billing workspace and compact field microphones

Founder25September: cash drawers are not needed now. Prioritize guest folios,
stay/no-show/cancellation charge visibility and settlement/checkout, with compact
search/add/edit icons and a smaller microphone. “3 UI flaws” is a reference to
Kole Jain's design material, NOT a request for glass effects. Order716 is deferred;
retain its isolated source/proof but remove its active FinanceWorkspace integration.
Public tunnel remains OFF; local-only app QA is authorized, not public promotion.

## Scope / ownership

- Root: frontend/yellow/src/workspaces/FinanceWorkspace.tsx;
  frontend/yellow/src/workspaces/AdditionalFolioWindow.tsx (Q721 add/edit icons only);
  frontend/yellow/src/ui/folio-workbench.css;
  frontend/yellow/src/ui/FolioActionRibbon.tsx;
  tests/order721-guest-billing-workspace.test.tsx;
  tests/order672-folio-workbench.test.ts (Q721 extracted disclosure assertions);
  tests/order714-finance-integration.test.ts (Q721 position-anchor only);
  tests/order716-finance-integration.test.ts (assert founder deferral, retain
  independent cash-drawer component/client tests unchanged).
- review709 builder: frontend/yellow/src/ui/VoiceField.tsx,
  frontend/yellow/src/ui/voice-field.css,
  tests/order721-compact-field-microphone.test.tsx only.
- Independent nonimplementer guest_contract709: audit then review721 and personally
  execute focused proof, existing financial UI regressions, types/boundaries.
- Governance: this order, handoff/questions/721.md, handoff/reviews/721-guest-billing.md,
  handoff/receipts/721-guest-billing.md, docs/design/721-guest-billing.md,
  docs/design/721-guest-billing-concept.png, order716 deferral annotation,
  docs/PROJECT-STATUS.md, handoff/LEDGER.md.
- Generated public/yellow-next/** and external D:/Yellow/temp/order721-* local
  image/compose/QA files. App-only local replacement, retained717 rollback.

## Product / safety contract

Compact guest and bill selection beside the statement on desktop, vertically
flowing on mobile. Selected-window/stay balances remain exact server strings.
Keep common bill actions in one nearby ribbon. Opening/hiding a panel must NEVER
unmount a retained financial draft or allow navigation past pending/unknown writes.
Original synchronous shared leases, explicit confirmations, receipt/readback checks
and same-key retry remain. No new posting, fee, payment or checkout command;
reservation/checkout navigation leads to the existing selected reservation workflow
and is disabled while a financial mutation/recovery lock is held.

Remove the cash-drawer dependency from the guest billing entry (a permission or
failure on cash custody must not block guest folio access). Preserve all cash
source files unused; no physical drawer configuration, counting or settlement.
Use only existing catalog charge types; no automatic cancellation/no-show fees or
new fee policy. Immutable entries cannot be edited; edit only unsubmitted drafts.
Keep voice recognition opt-in with review/Use text and disabled/read-only behavior;
small 14px glyph inside a comfortably sized transparent tap target. No automatic
microphone, no dictating financial amount/code/payment commands.

## Design basis / proof

Use the generated721 guest-billing concept as layout direction with existing Yellow
shell kept unchanged and real data replacing fictional concept values. Record exact
intentional deviations for existing financial controls/statement semantics.
Outline icons16px/1.7stroke; white surface, neutral borders, neon-green selected
accent, compact14px UI, no glass. Mobile stays scrollable with no horizontal page
overflow; tables may scroll within their region. Review narrow320/390 and desktop.
Tests cover ribbon disclosure/keyboard names, retained mounted child state,
forced-visible locked recovery, cash drawer deferral, lifecycle navigation lock,
compact microphone geometry contract and existing dictation regressions.
No live guest financial writes for QA. No new migration/API/financial policy.
