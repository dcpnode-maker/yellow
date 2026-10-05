# Order706 independent source and executable review

2026-09-25 — `/root/movement_hover_review`, non-implementing reviewer. **Approved for the bounded source change; rendered/live acceptance remains coordinator-owned.** I inspected Order706 and the relevant source, personally executed the commands below, and changed only this review record. I did not edit implementation/tests, operate a browser, deploy, call an external model, or touch hotel data.

## Finding and repair

The original neutral-theme rule grouped the Today pill with selected buttons inside `:is()` and applied `transform: none`. Its maximum selector specificity `(0,3,1)` beat the later Today translation rule `(0,2,0)`. Thus an updated movement index could not move the pill. I identified this independently before the repair; the original adjacent tests still passed11/0/75, demonstrating their missing cascade coverage.

The repair keeps the shared visual treatment but limits the transform reset to the two static selected-button families. The Today pill retains its existing translation,220ms transition and reduced-motion override. The component adds only touch pointer-down preview; mouse hover, focus precedence, pointer leave/cancel cleanup and the original `onClick={movement.onOpen}` remain. Button-scoped standard/WebKit `user-select: none` suppresses text selection, and `touch-action: manipulation` preserves native pan/pinch handling. No domain command, callback authority or data behavior changes. No blocking source finding remains.

## Reviewer-personal execution

From `D:/Yellow/git-live-order611-source-v2`:

```text
bun test tests/order706-today-pill.test.tsx tests/order702-ribbon-hover.test.tsx tests/order696-movement-ribbon.test.ts tests/order700-compact-shell.test.ts tests/yellow-shared-ribbon-depth.test.ts
19 pass; 0 fail; 115 expect() calls; 5 files; exit0

bun run typecheck
tsc --noEmit && tsc --noEmit -p frontend/yellow/tsconfig.json
exit0
```

Reviewed file SHA256 identities in this existing dirty source tree:

| File | SHA256 |
| --- | --- |
| `frontend/yellow/src/ui/reference-theme.css` | `5CB8198D6DA19569FF61BF1D5E87090FA6EFAEC3625A07A8A2FE15D2E369D76F` |
| `frontend/yellow/src/workspaces/TodayGlassDashboard.tsx` | `A1184AF8CA89E921227AFE11E9B7A8C8AC305C854887E3A8C7E307FF5BD5594F` |
| `frontend/yellow/src/styles.css` | `9E30D88F0EE8B1E398F68E3B944DD47EF4EFD6479B6C2FE11F2D7BB97449CA72` |
| `tests/order706-today-pill.test.tsx` | `46C9056034560CB2224B72DD203D711D4086004196B5ADDA44C69219289619B6` |

## Evidence limits

These focused tests use pure logic, SSR and source assertions. The new regression rejects the specific pill-containing transform reset and pins touch/selection/reduced-motion wiring; it does not execute a browser CSS cascade or real pointer events. I did not personally execute boundaries, build, runtime health, database-ledger comparison or live acceptance. Coordinator-reported results are not substituted for my own execution above.

Before declaring the live defect fixed, the coordinator must verify the actual Today dashboard capsule with production styles at desktop and390px: target alignment on hover/focus, restoration on leave, existing click navigation and reduced motion. A responsive mouse check does not prove physical Android touch, long-press selection suppression or native touch timing. That limitation must remain explicit in the delivery receipt. This approval is not a full-application, clean-Git/CI or deployment-readiness certification.
