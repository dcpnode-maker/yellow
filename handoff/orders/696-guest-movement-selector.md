# Order696 — guest-movement selector alignment and phone fit

25September2026. Founder reports selector not working after opening Arrivals /
Departures / In house. Root reproduced current public clicks changing rows and
aria-selected on desktop and390px phone, but phone ribbon clips third item and
indicator is offset by rail border; measured transform-based button bounds can
also capture pressed scale. Repair those proven presentation defects, not invent
a failed query diagnosis.

Scope: frontend/yellow/src/ui/SegmentedRibbon.tsx (measure layout coordinates),
new ui/movement-ribbon.css imported by that component (only .movement-view-ribbon
selectors), tests/order696-movement-ribbon.test.ts, this order,
tests/order673-ribbon.test.ts (replace superseded measurement-source oracle only),
handoff/reviews/696-movement-ribbon.md, handoff/receipts/696-movement-ribbon.md;
generated public/yellow-next/**; docs/PROJECT-STATUS.md; handoff/LEDGER.md.

Root implementation; order679_independent_review independent proof. No state or
API changes. Keep arrows/Home/End, URL/back, reduced motion, all tabs/row data.
Phone three movement options remain visible simultaneously with >=44px targets.
Measure capsule with element offset metrics instead of transformed screen rects;
verify click and keyboard selection and correct capsule bounds at desktop/mobile.
