# Question 096 — Order 062 schema-check database-name semantics

## ANSWERED — TEMPORARY ARCHITECT

**Order:** 062  
**Observed:** the D-228 restart again passed every preceding assertion, then schema drift exited
with `Invalid YELLOW_SCHEMA_DATABASE: postgres://...`. Source readback shows the variable is
validated as a PostgreSQL database identifier and passed to `pg_dump --dbname` inside
`docker compose exec`; it is not a connection URL. Question 095's answer was incomplete.

May the standing environment set `COMPOSE_PROJECT_NAME=yellow-order-062-p0` and
`YELLOW_SCHEMA_DATABASE=yellow_test`, then restart from the frozen install again?

## Answer

Yes, and this corrects Question 095/D-228's precondition wording. Select the exact disposable
Compose project and pass only `yellow_test` as the database identifier. Restart every standing
step; change no schema, snapshot, Compose state, or checker code. Record both failed invocations.

