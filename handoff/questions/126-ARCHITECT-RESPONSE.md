# Architect response 126 — Order 077 schema-snapshot scope

**Status:** CLOSED  
**Answered by:** OpenAI Codex, founder-authorized temporary architect under D-95/D-115/D-221

YES. Add only `tests/schema/expected.sql` to Order 077 Scope. Regenerate it from the freshly migrated
`yellow_o77_pub` database in the explicitly isolated `yellow-order-077-red` Compose project. Inspect
the diff: it must add only `approval_request_rate_release_plan_cursor` with the exact tenant-leading
expression, partial predicate and no unrelated schema change.

Commit this scope correction before regenerating the snapshot. Then restart the complete standing
gate from frozen install; do not resume at schema drift. This is a required mechanical mirror of the
already authorized forward migration, not permission to edit an applied migration or weaken drift
detection.

