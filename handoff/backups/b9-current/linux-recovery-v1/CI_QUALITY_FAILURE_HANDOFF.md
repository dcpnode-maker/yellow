# Exact b9 quality failure to laptop controller

Source b9ba702a074a487feeafa056abb49abcdcf01ba8, tree9446a6735d712ccfd30c6957ea511fb0e3b644cf, PR99. Actual GitHub run36869095945 quality job110391971870 failed; windows-state/local-review succeeded; database/container-smoke/free-host-arm64 skipped. Root fetched the actual decoded job log. Main test summary:2547pass/5fail,4157tests across695files,98.62seconds. This is not green release CI.

Root personally reproduced four failures in a bounded five-file local run:17pass/4fail across21tests. The group UI test passed alone in that run; its CI error is global-state/suite-order related, not an isolated rendering failure.

| Exact file/line | Actual failure / source basis |
| --- | --- |
| tests/order620-today-colleague-demo-path.test.ts:32 | Expects `onOpen: () => setAssistantOpen(true)` in App; absent in receiving composition. Must prove intended assistant action semantics before changing oracle. |
| tests/order687-groups.ui.test.ts:6 | CI TypeError: Attempted to assign to readonly property at Object.assign(globalThis,{window...}). Other suite fixtures define window via Object.defineProperty. Isolated group test passes. Need scoped descriptor preservation/restoration and full-suite proof, not a skipped test. |
| tests/operator-reservation-travel.integration.test.ts:88 | Exact constructor suffix expects OperatingPerformanceService()) while src/server.ts:395 appends groupReservations. Preserve governed route and command binding while aligning exact composition proof. |
| tests/yellow-cashier-receivable-workbench.test.ts:59 | Expects closest('[data-lifecycle-recovery="true"]'); App:7210 now uses combined closest('[data-lifecycle-recovery="true"], [data-property-mode-recovery="true"]'). Verify both recovery protections and hostile-flow behavior before oracle change. |
| tests/operator-business-day-seal.integration.test.ts:107 | Same exact old constructor suffix versus added groupReservations. No mutation/state/route assertion should be removed. |

Executed command (source unchanged): `bun test tests/order620-today-colleague-demo-path.test.ts tests/order687-groups.ui.test.ts tests/operator-reservation-travel.integration.test.ts tests/yellow-cashier-receivable-workbench.test.ts tests/operator-business-day-seal.integration.test.ts`.

Root has not repaired receiving source or tests; laptop owns the finite reviewed successor. Linux types/boundaries/495frontend/524backend compilation and image build are distinct and passed. Synthetic DB/restore/private-origin proof proceeds separately; no merge/public route/latest-release acceptance follows from compilation.

Actual log: https://github.com/dcpnode-maker/yellow/actions/runs/36869095945/job/110391971870 . Local full focused output retained as b9-ci-quality-focused.log, excluded from public packet until redaction review. Original GitHub failure remains; no assertion/deadline waiver or rerun used to relabel it green.
