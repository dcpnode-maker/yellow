# Order 684 independent source review — unified navigation ribbon

2026-09-24. Reviewer: Codex agent `order679_independent_review`, independent of the navigation implementer. Scope: `OperatorHeader.tsx`, `reference-theme.css`, the relevant shell/nav CSS cascade, and `tests/order684-navigation-ribbon.test.ts`. I did not implement or deploy these changes.

## Decision

**Source admission approved** after correction of the SSR/test-environment `matchMedia` crash. The coordinator still owns actual desktop/mobile mounted browser verification and guarded promotion. This review does not cover unrelated changes to reservation creation or other workspaces sharing the dirty tree.

## Findings

- Initial focused execution failed because the component's state initializer called `window.matchMedia` whenever `window` existed, while Bun's SSR test window did not implement it. The implementer guarded both the initializer and responsive effect. I inspected that correction and reran the tests successfully.
- The rail uses the application canvas background and a thin border-right rather than a floating card/shadow. Desktop collapse retains button accessible names and `aria-current`; the mobile overlay has an accessible dialog label, Escape close, focus return, background inert state, and a focus loop. The shell CSS preserves the shared search and property switcher, provides 44px controls and a contained mobile drawer, and disables transitions for reduced-motion users. Existing route callbacks remain the navigation authority.
- The test validates SSR markup and key CSS/source invariants. It is not an interactive browser test of collapse, drawer focus, search reachability, viewport overflow, or route navigation; those remain coordinator acceptance checks.

## Personally executed checks

- `bun test tests/order684-navigation-ribbon.test.ts tests/order683-reservation-create.test.ts tests/order683-reservation-create-api.test.ts` initially **7 pass, 1 fail** at the `matchMedia` initializer; after the scoped guard, **8 pass, 0 fail, 42 assertions**.
- `bun run typecheck` → backend and frontend TypeScript pass.
- `bun run boundaries` → `Import boundaries OK: 207 TypeScript files scanned`.

I also separately reviewed the Order 683 check-in popup source, without treating it as part of Order 684 approval. I reported two initial findings: ordinary mutation paths did not lock Close/Escape while in flight, and a selected room remained confirmable after its typed filter hid it. The coordinator corrected both; I inspected the retained same-key action/reconciliation path and the filter-change reset, then personally ran five adjacent files (Order 683 pure/API, Order 684 ribbon, existing check-in HTTP surface, and cleaning-conversation tests): **15 pass, 0 fail, 97 assertions**. Actual mounted popup interaction and unknown-response retry remain for the coordinator's browser acceptance.

## Coordinator-reported mounted follow-up

The coordinator later found that the parent application lifecycle guard prevented all clicks inside the new popup. They added `data-lifecycle-recovery="true"` to the dialog, matching the existing guard's recovery allowance; I inspected that marker in source. The coordinator reports personally verifying the mounted flow: choosing Room 107 then filtering to 108 clears selection and disables assignment; during assignment Close is disabled and Escape retains the dialog; an unknown HTTP 503 keeps Close disabled; reconciliation resends the identical body and idempotency key, reads back the assigned room, and then enables Close. They also report a 375px mobile fit check, a Close-button width correction, mobile navigation open/Escape, and pending desktop live verification. These are **coordinator-reported browser results**, not my own browser execution or part of the Order 684 source test result above.
