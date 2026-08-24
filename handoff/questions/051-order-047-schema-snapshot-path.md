# Question 051 — Order 047 schema snapshot path

**Raised by:** OpenAI Codex (builder)
**Order:** 047 — Durable API idempotency foundation
**Status:** ANSWERED — see `051-ARCHITECT-RESPONSE.md`

## Evidence and question

The order Scope mistakenly names `scripts/schema/expected.sql`. The executable generator
defines its snapshot at `tests/schema/expected.sql`, matching D-97 and the tracked tree;
`scripts/schema/` does not exist. No snapshot path has been written. May the order replace
the nonexistent path with the canonical generated snapshot path before generation?
