# Receipt: Order 742 — Reversible Windows Sign-In Profiles (Revision 3: Partial Draft & Concept Preview)

- **Order**: 742 (`handoff/orders/742-windows-startup-profiles.md`)
- **Implementer**: Antigravity Gemini
- **Date**: 2026-09-26
- **Status**: PARTIAL DRAFT / CONCEPT PREVIEW ONLY (No installed profiles, zero RAM savings realized, all mutating operations hard-disabled; pending founder sign-in vs preboot architecture decision)

---

## Changes in Revision 3

In compliance with the updated delivery gate directives:
1. **Simplified Script Scope (<=220 lines)**:
   - Completely purged all mutating code: registry setters, registry removers, installers, uninstallers, process launchers, JSON manifest management, and locking mechanisms.
   - Script is now ~210 lines dedicated strictly to read-only `Audit`, `Plan`, and `-PreviewChooser`.
2. **Hard-Disabled Mutating Entrypoints**:
   - Invoking `-Install`, `-Uninstall`, or `-Choose` immediately returns `NOT READY: <mode> is disabled in this delivery gate` and exits with an error. No system or user mutations are performed or attempted.
3. **Preview Chooser**:
   - `-PreviewChooser` displays a WinForms preview dialog with explicit notice that this is a sign-in preview, not preboot BCD.
   - Returns the chosen string (`Normal` vs `YellowOptimized`); closes/cancel default to `Normal`.
   - Under `-WhatIf`, UI prompt is completely suppressed and zero state is altered.
4. **Safe Isolated Tests**:
   - AST parser validation.
   - Purely mocked Audit, Plan, and PreviewChooser test cases.
   - Refusal of mutating modes asserted.
   - WhatIf suppression of UI asserted.
   - Zero writes outside temporary test directory; cleanup managed per suite.
5. **Accurate Status & Claims**:
   - Documentation and receipt state unambiguously that this is a **PARTIAL DRAFT**.
   - No optimization has been installed, no RAM savings have been realized, optional candidates on the machine are already disabled or unmanaged, and the founder is still evaluating sign-in profile manager vs explicit preboot configuration.

---

## Scoped Deliverables Modified

1. [`scripts/yellow-startup-profile.ps1`](file:///D:/Yellow/git-live-order611-source-v2/scripts/yellow-startup-profile.ps1)
2. [`tests/order742-windows-startup-profiles.test.ts`](file:///D:/Yellow/git-live-order611-source-v2/tests/order742-windows-startup-profiles.test.ts)
3. [`docs/YELLOW-WINDOWS-PROFILES.md`](file:///D:/Yellow/git-live-order611-source-v2/docs/YELLOW-WINDOWS-PROFILES.md)
4. [`handoff/receipts/742-windows-startup-profiles.md`](file:///D:/Yellow/git-live-order611-source-v2/handoff/receipts/742-windows-startup-profiles.md)

---

## Execution Reporting
- No system mutations, registry changes, installations, or uninstalls were executed on the host.
- Prepared solely using file tools without shell execution; tests are reported as unexecuted live on the host in this turn.
