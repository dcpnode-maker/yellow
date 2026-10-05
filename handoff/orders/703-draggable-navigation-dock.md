# Order703 — repositionable collapsed navigation ribbon

Founder25September requests same sidebar collapsed into icons, drag/touch to
bottom, meaningful icon hover effects and explanations. Adapt existing approved
neutral ribbon, not a new theme. Root coordinates; independent reviewer must not
implement. No backend/DB/permission/route changes.

Scope: frontend/yellow/src/ui/OperatorHeader.tsx;
frontend/yellow/src/ui/WorkspaceDock.tsx (new extracted dock);
frontend/yellow/src/ui/workspace-dock.ts (pure placement helpers if needed);
frontend/yellow/src/ui/workspace-dock.css (new dedicated overrides);
tests/order703-workspace-dock.test.tsx (new);
tests/order694-navigation-table.test.ts and tests/order700-compact-shell.test.ts
(only obsolete dock structural oracles; preserve assertions via new component);
this order, handoff/receipts/703-workspace-dock.md,
handoff/reviews/703-workspace-dock.md. Root only generated public assets,
docs/PROJECT-STATUS.md and handoff/LEDGER.md.

Collapsed desktop default vertical left icon ribbon, bottom on small screens if
no valid saved preference. Same routes/icons available in both positions with
guarded callbacks and clear accessible names/tooltips. Preserve full-menu access
and property switcher. Existing bottom styling may remain historical; dedicated
new styles must override without editing reference-theme.css (root owns others).

Use a dedicated44px grip, pointer capture for mouse/touch, explicit small movement
threshold, bounded left/bottom snapping, clear drag feedback. No document-wide
touch prevention, no accidental route activation during drag. Escape/pointercancel
restores prior placement; valid completed preference persists best-effort without
storing business data. Keyboard/tap reposition alternative required; no drag-only
feature. Respect locked navigation, mobile drawer inert/focus containment,
reduced motion, resize, horizontal overflow, safe areas. Labels accessible with
keyboard/touch; pointer hover effect cannot obscure adjacent controls.

Tests must execute handlers, not only source regex: placement validation, drag
commit/cancel, keyboard alternate, unavailable localStorage, locked callback.
Root will verify actual mouse/touch drag and positioning in browser and perform
combined static-only app deployment. No unrequested OS/app settings or new model.
