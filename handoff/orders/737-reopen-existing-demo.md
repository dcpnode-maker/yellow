# Order737 — reopen the existing founder preview

26 September2026. Founder explicitly requests “start live app”. This supersedes
the earlier instruction to keep the public tunnel off, for this existing demo.

## Scope

- This order; handoff/receipts/737-reopen-existing-demo.md;
  docs/PROJECT-STATUS.md; handoff/LEDGER.md.
- Read-only local HTTP/authentication and exact existing-container inspection.
- Reversible startup of the existing yellow-public-demo-tunnel only, using the
  reviewed Order697 helper; existing app, PostgreSQL and Valkey retained unchanged.
- Public health, shell, asset and authenticated GET verification; no guest,
  reservation, folio, pricing or other business mutation for the smoke test.

No build, migration, fixture/seed changes, role/grant changes, credentials printed,
new tunnel/service, paid resource, DNS change or Windows startup registration.
Do not expose a newly discovered private tenant. If access or target checks fail,
leave the tunnel off (or stop only the exact tunnel started by this order).

## Acceptance and limits

Recheck health200, unauthenticated protected-resource denial, normal synthetic-demo
authentication, and exact same app/tunnel target before startup. Verify actual new
HTTPS URL after startup; never return an old log URL as current. Record unchanged
app/database/cache identities and inherited readiness status. Missing immutable
build revision and serving-role drift remain production-release blockers: this
order reopens only the existing founder demo and cannot declare a production
release, repaired readiness or complete ecosystem. Public-access failures roll
back only this order's tunnel start; no destructive cleanup.
