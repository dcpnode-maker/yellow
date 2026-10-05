# Q277 — current92 fiscal acceptance oracle repair

Order460,13 September2026. Exactfeff6dc8 CI34760154085 database job failed at
tests/india-native-fiscal-series-authority.integration.test.ts:94. Actual current
database is92; the assertion expects native-draft89 or otherwise91. Actual failure:
9pass/1fail/424 across2files. Earlier434/446/447/452 database stages succeeded;
later gates including the canonical referee were skipped. Five other jobs passed.

Admit production-free test repair only:

- tests/india-native-fiscal-series-authority.integration.test.ts

Builder /root/q258_source_adapter changes the full-current ci-canonical expectation
to92, preserves native-draft89 and all SQL/identity/permission/concurrency/row-graph
assertions. No new mode, target, skip, timeout, SQL, fixture data or product behavior.
Root independently checks the exact hunk and personally runs available pure tests;
gated local SQL skips are reported as skips, not actual proof. Fresh remote database
execution remains mandatory. Native-draft remains an intentionally historical target.

/root/astra_ultra_handoff performs a read-only broader CI invocation/fixture audit
for other stale full-current91 expectations before the successor. Additional edits
require an explicit scope addition here first; no bulk replace of historical91.
Root owns this question, Order460, Review460/checklist, current status, decisions
and ledger. No DB, app, provider, CI cancellation/rerun, Git or destructive action
is admitted by this source-only question. Preserve accepted471 and paused445.

## Proof and coherent successor preparation

Root personally reviews the sole one-line hunk and executes this file plus current
source status:5pass/10explicitDBskips/0fail/114, full typecheck and202boundaries pass.
FileSHA25698ba357a18c9572c0ad7f40087fa0dedd51f8e0fbbc553d25dbf5c18daf6ee84.
Independent Astra audits65 explicit CI test paths and related setup sources:
no additional stale full-current frontier/count found. Historical native91,
89→90 upgrade, Order45289,129tables/119RLS/28FORCE expectations remain unchanged.
The real453 SQL body and later CI stages must still execute; local skips are not proof.

To avoid separate CI runs for already accepted source, Order460 now admits one
coherent successor combining accepted471 and this one test repair. Exactly these
15 paths may be committed after final proof and a separate private root admission:

- src/http/operator/invoices.js
- tests/operator-credit-note-provider-request.test.ts
- tests/operator-credit-note-provider-request.browser.test.ts
- tests/india-native-fiscal-series-authority.integration.test.ts
- docs/CONTRACTS.md
- docs/PROJECT-STATUS.md
- handoff/orders/471-credit-note-provider-request-workflow.md
- handoff/reviews/471-credit-note-provider-request-workflow.md
- handoff/orders/460-current-source-single-local-promotion.md
- handoff/questions/276-market92-native-preservation-preparation.md
- handoff/questions/277-current92-fiscal-test-oracles.md
- handoff/reviews/460-current-source-single-local-promotion.md
- handoff/reviews/460-release-checklist-20260913.md
- DECISIONS.log
- handoff/LEDGER.md

Use native whole-file `git commit --only` from exactfeff6dc8, not a consumed
publisher or mixed-file reset. Private admission/receipts may be created only in
.yellow/evidence/order460/order471-successor-20260913/. Recheck all tracked/prior/
selected working bytes, outside index/flags, six staged paths and unrelated refs
before and after. After exact commit verification, one ordinary nonforce push of
phase-7/operator-invoice-workflow to its existing origin branch may start fresh CI.
No merge, extra checkout/dependency, live92 migration, metadata registration or
provider activation. Q276 remains separately validated private preparation, not
production code. Preserve paused445. PR/source status must distinguish delivery.
