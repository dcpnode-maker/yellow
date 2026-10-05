# PR-FIX-017 - Regress the real demo-path assistant callback

Founder authority: repair public PRs. The second native suite is2467pass/1558skip/
1fail. Its sole failure still expects the undefined setAssistantOpen callback
that PR-FIX-014 correctly repaired and frontend strict tsc rejected.

## Scope

- `tests/order620-today-colleague-demo-path.test.ts`: keep the existing route,
  no-write, controls and sequence checks; assert the real setAssistant setter and
  reject the undefined callback. No production source or consent changes.
- This order, paired question and receipt; ignored finite proof output.

Acceptance: focused regression, both strict compilers and full native suite.
Licence/isolated referee/independent review remain separate pending gates.
