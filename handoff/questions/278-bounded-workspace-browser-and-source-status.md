# Q278 — bounded workspace-browser supervision and current source status

Order460, 13 September2026. Published successor
dd38a9749ca877e7a50258303160bc66fa7fc3ab is on draft PR92, unmerged.
CI34762156051 passes Windows and local-review but quality fails the unchanged
Order459 browser's120-second outer deadline. Aggregate:2226pass/1546skip/1fail,
42555 assertions across602files. Database/ARM64/container are skipped.
Independent Astra's exclusive unchanged native execution passes1/0/1148 in12.21s.
The remote inner failure stage is unknown; local success does not prove its cause.

Admit only this test-infrastructure source scope to /root/q258_source_adapter:

- tests/operator-workspace-layout.browser.test.ts
- tests/helpers/workspace-browser-lifecycle.ts (new, only if needed)
- tests/workspace-browser-lifecycle.test.ts (new)

Bound target-creation fetch/body consumption, debugger lifecycle, journey polling
and owned-child reap inside the existing120-second outer budget. Preserve every
existing application, viewport, accessibility, font, draft and navigation check;
do not raise any existing timeout, add a skip/retry, change app code or weaken an
assertion. Use absolute elapsed-time budgets and useful bounded stage diagnostics.
Failure must retain the primary error and settle pending commands. Kill/reap only
the exact test-created child; never enumerate/kill user browsers or start local3000.
Test hostile hanging fetch/body/socket/child paths with controlled seams, and prove
the unchanged complete real journey. Root independently inspects and executes.
Only one browser test lane at a time; source work can run in parallel.

Root may also update src/project-status.ts and tests/current-source-status.test.ts
for independently accepted/published471 and published472, preserving all18 phase
states, historical evidence, review coverage and dynamic runtime distinction.
The adjacent tests/founder-status.integration.test.ts:588 still expects471
built_unverified; admit that state assertion and its472 publication/local regex
correction before edit, matching the already published source.
All other HTTP, permission and historical snapshot expectations stay unchanged.
Root coordination scope: this question, Order460, current status, Review460/checklist,
DECISIONS.log and handoff/LEDGER.md. No Git publication, CI rerun, database/metadata
mutation, runtime cutover, new dependency or phase closure is authorized here.

## Root acceptance and bounded successor publication

Root independently read the final three files and executed:

    bun test tests/workspace-browser-lifecycle.test.ts tests/operator-workspace-layout.browser.test.ts tests/current-source-status.test.ts tests/founder-status.integration.test.ts
    bun run typecheck
    bun run boundaries

14pass/2explicitDBskips/0fail/1374 assertions in13.99s. The complete original
1148-assertion journey took13.45s; worker execution separately passed1/0/1148.
Six controlled lifecycle tests pass15 assertions. Types and202 boundaries pass.
The119s inner budget reserves3s for cleanup under the unchanged120s outer gate.
This is native acceptance, not proof of the previous remote hang's cause.

After this acceptance, root admits one scoped whole-file successor commit and
ordinary nonforce push to the existing branch/PR92, followed by fresh exact-head
CI. No merge, unchanged rerun, runtime or DB mutation. Exact source paths:

- tests/operator-workspace-layout.browser.test.ts
- tests/helpers/workspace-browser-lifecycle.ts
- tests/workspace-browser-lifecycle.test.ts
- src/project-status.ts
- tests/current-source-status.test.ts
- tests/founder-status.integration.test.ts
- docs/PROJECT-STATUS.md
- docs/research/OVERTURE-GODS-EYE-RECEIVING-20260913.md
- handoff/orders/472-overture-gods-eye-market-discovery-integration.md
- handoff/orders/460-current-source-single-local-promotion.md
- handoff/questions/278-bounded-workspace-browser-and-source-status.md
- handoff/questions/279-native-market-registry-proof.md
- handoff/reviews/460-current-source-single-local-promotion.md
- handoff/reviews/460-release-checklist-20260913.md
- DECISIONS.log
- handoff/LEDGER.md

Private admission/completion records may be written only under
.yellow/evidence/order460/q278-publication-20260913/. Before execution, verify
exact parentdd38a974, selected bytes, complete prior admitted/tracked working
identities, semantic outside index/flags, six staged residuals and unrelated refs.
After commit verify the same preservation plus every committed blob before push.
Q279 ignored preparation remains outside the release; no native execution is
implied. Preserve paused445 and historical failures.
