# Order697 — reversible Yellow startup helper

25 September2026. Founder asks whether Windows can start only what Yellow needs.
Prepare an opt-in, non-admin PowerShell helper for the existing single application.
This does not turn Windows into a dedicated OS, guarantee resource savings, change
startup registrations, kill processes, disable services, or alter WSL/pagefile/security.

Scope: this order; new scripts/start-yellow-existing.ps1;
tests/order697-yellow-startup.test.ts; docs/YELLOW-STARTUP.md;
handoff/receipts/697-yellow-startup.md; handoff/reviews/697-yellow-startup.md.
Root alone owns canonical status/LEDGER and any actual live recovery.

Default is report-only. Explicit -Start may start Docker Desktop and then only the
four already-existing yellow-public-demo app/postgres/valkey/tunnel containers.
Discover exact container identities from compose labels, require exactly one of
each expected service, validate project and known app host port3010, and never
create/recreate/build/pull/seed/migrate or replace a listener. Missing or ambiguous
resources fail with actionable advice. Start dependencies before app/tunnel;
already running services remain running. Bound every external process call and
the total readiness wait; no infinite retry or CPU spin; do not log env/credentials.
Do not terminate daemon/database processes on timeout. Output must distinguish
health from readiness and never claim a public tunnel works without a probe.

Dry-run and tests must not touch live containers or register startup. Use mocked
command executors for controlled failure/duplicate/timeout/idempotency cases plus
PowerShell parser validation. Document optional per-user logon installation and
removal, but do not execute registration in this order. Auto-build and unrestricted
agents are not startup tasks. Root independently reviews before any activation.
