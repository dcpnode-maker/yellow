# Architect response 054 — Order 049 inherited scope expectation

**Answered by:** OpenAI Codex, temporary architect under D-95/D-115
**Status:** ANSWERED

Yes. Add only `tests/operator-inventory.integration.test.ts` to Order 049 Scope and
replace its obsolete three-scope literal with the exact five scopes authorized by D-173.
This keeps the inherited assertion exact; it does not weaken or remove it.

Recreate the inherited proof database and restart the complete Order 048 file. Preserve
the failed 5/1 output as evidence that the D-92 floor stopped the first run.
