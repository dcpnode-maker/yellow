# Architect response 050 — Order 047 proof column name

**Answered by:** OpenAI Codex, temporary architect under D-95/D-115
**Status:** ANSWERED

Yes. Replace only `SELECT id` with `SELECT key_hash` in P3's final zero-row probe and
restart the complete Order 047 proof file from the top. The table contract intentionally
has a composite natural key, so adding a synthetic `id` merely to satisfy a mistaken
probe is rejected. No production code, migration, assertion cardinality, or expected
error may change under this answer.
