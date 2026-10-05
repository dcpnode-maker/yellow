# Order706 — correct Today Guest movement sliding capsule

Founder screenshot25September shows Departures interaction while the white pill
remains on Arrivals. Follow-up to702, not a new design or business workflow.
Root reproduced actual live hover: index1 but computed transform none and pill
still at first button. The neutral theme's mixed :is() selector wins specificity
over the attempted movement override. Prior702 live proof tested the table ribbon,
not this dashboard capsule; that coverage was insufficient.

Scope: frontend/yellow/src/ui/reference-theme.css (pill reset only);
frontend/yellow/src/workspaces/TodayGlassDashboard.tsx (movement feedback only);
frontend/yellow/src/styles.css (movement touch selection only);
tests/order706-today-pill.test.tsx; tests/order702-ribbon-hover.test.tsx only if
existing exact-source oracle must reflect the scoped fix;
handoff/receipts/706-today-pill.md; handoff/reviews/706-today-pill.md;
docs/PROJECT-STATUS.md; handoff/LEDGER.md; this order;
public/yellow-next/** generated release only; D:/Yellow/temp/order706-* evidence
and release Dockerfile only.

Remove the conflicting transform reset from the moving pill without changing
other selected controls. Preserve220ms motion and reduced-motion override.
Touch press previews its target without changing the existing click/navigation
callback; no long-press text selection on these buttons. Hover/focus/leave/cancel
must still work. No delayed navigation, API, dataset or business-state change.

Write regression tests before fix; execute focused/adjacent/type/boundary checks.
Independent source/executable review and root actual rendered CSS/hover/leave/
focus/click proof at desktop and390px. Record inability to prove physical Android
touch if backend still lacks it. App-only frontend release, retain ba4633c rollback,
verify local/public health and database ledger unchanged. No broader completion.
