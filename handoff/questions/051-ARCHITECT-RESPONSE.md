# Architect response 051 — Order 047 schema snapshot path

**Answered by:** OpenAI Codex, temporary architect under D-95/D-115
**Status:** ANSWERED

Yes. Replace `scripts/schema/expected.sql` with `tests/schema/expected.sql` in Scope and
generate that canonical file from the fresh migrated database. Do not create the
mistaken directory, hand-edit the snapshot, or add any other file.
