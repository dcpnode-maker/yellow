# Question 054 — Order 049 inherited scope expectation

**Raised by:** OpenAI Codex (builder)
**Order:** 049 — Operator restriction management
**Status:** ANSWERED — see `054-ARCHITECT-RESPONSE.md`

## Evidence and question

The fresh Order 048 integration test returned 5 pass / 1 fail after Order 049's focused
proof passed 6/6. Its only failure is the old exact token assertion: it expects the three
Order 048 scopes, while Order 049 explicitly adds restriction read/write to the same
deterministic review role and now correctly issues five scopes.

May Order 049 Scope gain only `tests/operator-inventory.integration.test.ts` to update
that inherited exact expectation to the ordered five-scope contract, then restart the
inherited file from a newly recreated database? No production behavior or assertion
strength would change.
