# RESOURCE-20261003-owner-test-portability

## Authority and inputs

Codex root assigns a finite source-test-only portability successor for the independently accepted owner pointer proof. Input is the immutable `owner-pointer-proof-v1` freeze SHA-256 `3e51a146464533a17e6392e20dbb9487efc34e3424399b14321f11eb5625ab94`, its 24 source paths over Git `6f3157126a3e353f931c288b3f5365b0152aed78`, and clean receiving Git `b8294182e331e9fbadfd6ba3e9b460dd29f18492`. Root alone admits integration after independent review and execution.

## Scope

Only modify `tests/operator-owner-trust-actual-workbench.test.ts` and add `handoff/orders/RESOURCE-20261003-owner-test-portability.md`. Replace the test's `../base/src/http/operator/operator.js` dependency with immutable slices from the exact historical Git-verified source, pinned by commit and raw SHA-256. Preserve every assertion, trusted pointer event, protected mutation comparison and production byte. No runtime Git/history dependency. Do not edit receiving or the frozen bundle.

## Proof and handoff

Build a fresh archive of clean receiving Git with all 24 accepted source paths overlaid and no sibling `base/`. Run the seven owner suites, root and scoped TypeScript checks, and import boundaries. Audit all seven tests for external paths. Deliver exact minimal two-path patch, full 25-path patch against `b8294182`, before/after hashes, and a frozen candidate with logs. Preserve failures and relinquish ownership to root. No native, database, permission, payment, application configuration, dependency installation, live runtime, publication, PR or commit changes.
