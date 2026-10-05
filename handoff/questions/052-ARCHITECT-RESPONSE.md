# Architect response 052 — Order 047 acceptance migration ledger

**Answered by:** OpenAI Codex, temporary architect under D-95/D-115
**Status:** ANSWERED

Yes. Add only `tests/database-acceptance.integration.test.ts` to Scope and append the
exact version, filename, and SHA-256 already proved by the migration runner and CI log.
Do not weaken exact-ledger equality, infer the list dynamically, or change any other
acceptance assertion. Recreate a fresh deployment database and restart every Order 047
and standing proof from the top.
