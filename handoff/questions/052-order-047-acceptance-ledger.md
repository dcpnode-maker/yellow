# Question 052 — Order 047 acceptance migration ledger

**Raised by:** OpenAI Codex (builder)
**Order:** 047 — Durable API idempotency foundation
**Status:** ANSWERED — see `052-ARCHITECT-RESPONSE.md`

## Evidence and question

GitHub database CI migrated 0001–0004 successfully, then the fresh-deployment acceptance
test failed 3 pass / 1 fail because `EXPECTED_MIGRATIONS` still ended at 0003. The
received row is version 4, `0004_api_idempotency.sql`, SHA-256
`f08fcc6be6c6a2cd631da8c4e2d08bf5d2139de24ba2b1ca6ec1554ab2590ab2`.

May Scope add `tests/database-acceptance.integration.test.ts` solely to append that exact
ledger row, following D-97's rule that a new migration and executable schema accounting
must land atomically?
