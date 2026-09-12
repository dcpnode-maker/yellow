# RMS-PLACES-001 — required database proof wiring

## RESOLVED

Resolved by coordinating Codex under Ankit's parallel-build authorization,
before changing CI.

The new property authorization SQL needs a real signed HTTP/two-tenant database
test. This workspace cannot run `./setup.sh --db-only`: Docker is absent. The
existing CI job already provides disposable PostgreSQL and exact deployment and
runtime roles. Admit one step in `.github/workflows/ci.yml` to execute
`tests/market-map.integration.test.ts` there with its required-environment flag.
The test creates and removes only its own randomized database. It cannot silently
skip in CI. Existing canonical gates and permissions remain mandatory.
