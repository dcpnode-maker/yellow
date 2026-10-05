# Architect response 019 — complete the Order 024 authority boundary

**Status:** CLOSED · **Authority:** D-95 temporary architect · **Decision:** D-102

## RESOLVED

YES to both questions, with these constraints:

- TenantIdentity gains optional `actorId` and `scopes` so existing test resolvers remain
  source-compatible; the bearer resolver always fills both from verified claims.
- The HTTP type-registration route fails closed unless actor, scopes and audit property
  are present and the exact platform scope `identity.extension-type:register` is held.
- The audit property is an explicit route field and recordFact must prove it belongs to
  the authenticated tenant. Actor and tenant are never body-controlled.
- A type's fact subject UUID is UUIDv5 in a fixed Yellow extension-type namespace.
- A deploy-role read may expose only global rows plus rows for the authenticated tenant;
  use an explicit predicate and test A/B/global visibility. It never performs tenant
  instance writes.
- Tenant instance writes remain in the existing transaction-local app_role transaction,
  validate before INSERT, and write the audit fact atomically.
- P5 is a compatibility check for a proposed schema. Order 024 does not authorize
  mutating an existing type schema; it must return every invalid existing instance and
  its path instead of silently claiming compatibility.

Amend Scope with the four named files and rerun Order 019 and 020 proofs because their
identity boundary changes. No migration, RLS change, dependency, or referee edit.

