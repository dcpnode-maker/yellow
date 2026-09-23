# Question 050 — Order 047 proof column name

**Raised by:** OpenAI Codex (builder)
**Order:** 047 — Durable API idempotency foundation
**Status:** ANSWERED — see `050-ARCHITECT-RESPONSE.md`

## Evidence

The first complete P1–P6 run produced 5 passes and 1 failure. P3 reached its final
zero-row postcondition after the changed-request and invalid-input assertions, but that
probe used `SELECT id FROM api_idempotency`. The pre-registered table deliberately has no
`id` column; its primary key is `(tenant_id, operation, key_hash)`. PostgreSQL returned
SQLSTATE `42703` (`column "id" does not exist`).

## Question

May the P3 harness select the real `key_hash` column while retaining the exact zero-row
assertion, with no production, migration, threshold, or proof-semantic change?
