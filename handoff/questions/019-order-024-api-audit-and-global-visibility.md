# Question 019 — Order 024 API wiring, global audit identity, and visibility

**Status:** CLOSED — see `019-ARCHITECT-RESPONSE.md` and D-102.

## RESOLVED

## Stop conditions

Order 024 preflight found three omissions before code was edited:

1. D-94 requires a real HTTP API, but the Scope does not name `src/app.ts`, the only
   composition root that can mount a route.
2. `extension_type` is platform-global with a text primary key, while every audit fact
   requires a tenant, property, actor, and UUID entity id. “Every write audited” does
   not define that mapping.
3. D-94 says tenants read `tenant_id IS NULL` launch instances. The immutable baseline's
   generic RLS policy is equality-only, so app_role cannot see NULL global rows. Order
   024 forbids a migration.

The current TenantIdentity also drops JWT `sub` and `scp`, so the route cannot enforce
P6 or form a trustworthy audit envelope without accepting actor data from the request
body.

## Questions

May Scope add `src/app.ts`, `src/http/extensions.ts`,
`src/kernel/tenant-context.ts`, and `src/contexts/identity/resolver.ts`?

May the resolver preserve JWT actor/scopes in TenantIdentity; type registration require
`identity.extension-type:register`; type audit facts use the authenticated tenant,
property and actor plus a deterministic UUIDv5 of the type key; and global-instance
reads use a deploy-owned query constrained explicitly to
`tenant_id IS NULL OR tenant_id = authenticated tenant`, while writes remain in the
tenant app_role transaction?

