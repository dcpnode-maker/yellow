# Order 488 — Rate-service policy read authority

## Objective

Repair the least-privilege runtime capability required by the existing typed
`RateConfigurationService`: `app_role` must be able to read tenant-scoped
policy rows that it already has permission to create and reference.

## Scope

- one new forward migration under the runtime source `migrations/`
- schema/ACL and focused real-PostgreSQL tests under the runtime source `tests/`
- `handoff/reviews/488-rate-service-policy-read-authority.md`

## Required behaviour

- Grant only `SELECT` on `public.policy` to `app_role`; retain existing RLS,
  ownership, PUBLIC denial, and every column-limited insert privilege.
- Prove an ordinary runtime request can read only its transaction-local tenant
  policies, create/replay the existing typed policy/rate-plan/rate-price flow,
  and cannot read another tenant’s policies, plans or prices.
- Prove no direct update/delete/truncate or ownership/role escalation is added.
- Execute the existing commercial scenario replay on a disposable database only.
- Obtain independent Tier-3 review before any public database migration or
  configuration deployment.

## Exclusions

- No schema/table/policy shape change, no generic table grant, no new write
  authority, no BAR update, no public deployment, no real data, and no rate
  publication.
