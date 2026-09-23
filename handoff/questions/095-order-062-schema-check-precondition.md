# Question 095 — Order 062 schema-check precondition

## ANSWERED — TEMPORARY ARCHITECT

**Order:** 062  
**Observed:** the standing run passed frozen install, typecheck, boundaries, 49 default tests,
licence policy and audit, then `bun run schema:check` exited 1 with
`YELLOW_SCHEMA_DATABASE is required`. The command supplied the database as `DATABASE_URL`.
No drift comparison ran.

May the run use the script's declared `YELLOW_SCHEMA_DATABASE` variable and restart the full
standing check from the frozen install?

## Answer

Yes. This is an unmet executable precondition under D-88, not a green or red schema assertion.
Supply the same disposable database URL as `YELLOW_SCHEMA_DATABASE`, restart the complete
standing sequence from `bun install --frozen-lockfile`, and report both attempts. Change no
schema, expected snapshot, or check implementation.

