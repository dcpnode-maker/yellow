# Cashiering64-v2 bounded test compatibility addendum

Root inspected the existing fixture/mount references and authorizes three additional TEST paths under the same order and external64-v2 candidate:

- `tests/yellow-billing-layout.test.tsx`: only explicitly supply the new required synthetic read-only presentation callback to the three existing standalone CashierWorkbench fixtures; retain their existing layout/assertions.
- `tests/yellow-next-finance-workspace.test.ts`: only update the hardcoded existing mount expectation to require the new parent guard wiring.
- `tests/yellow-voice-routing.test.ts`: only update its hardcoded existing main Finance mount expectation to require the same guard. Both existing string assertions reference the main mount; the separate inline mount still requires actual wiring and dedicated proof under the primary order.

This compatibility work follows the independently recommended required callback contract. It grants no further production paths, test hooks, domain/recovery/auth/provider/native changes or weakened assertion coverage. Keep old failed check evidence; prove exact scoped deltas and preserve all unrelated test bytes. The main64-v2 order and Astra guidance remain in force. Include this addendum in source/provenance and handoff scope.
