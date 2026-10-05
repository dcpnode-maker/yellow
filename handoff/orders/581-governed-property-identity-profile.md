# Order 581 — governed property identity profile

## Objective

Add the first real editable property-profile command behind Yellow Settings: an exact
read model for canonical property identity plus a governed, versioned property-name
change. Timezone, currency, hierarchy and raw config remain visible but immutable.

## Scope

- `migrations/0098_property_identity_profile.sql`
- `src/contexts/identity/property-profile.ts`
- `src/contexts/identity/index.ts`
- `src/http/operator.ts`
- `src/app.ts`
- `tests/property-identity-profile.integration.test.ts`
- `tests/property-identity-profile-http.integration.test.ts`
- `tests/schema/expected.sql`
- `docs/CONTRACTS.md`
- `docs/EVENTS.md`
- `handoff/orders/581-governed-property-identity-profile.md`
- `handoff/reviews/581-governed-property-identity-profile.md`
- `handoff/LEDGER.md`

## Required behaviour

1. Add dedicated `identity.property-profile:read` and `:write` capabilities. Read and
   write require an active actor plus an exact ancestor property grant covering the
   target; foreign tenant, sibling and non-property nodes fail closed.
2. `GET /api/v1/properties/:property/profile` returns only canonical id, name,
   timezone, nullable currency, current name-version, effective timestamp and the
   property-local effective business date. Never return `org_node.config`.
3. `POST /api/v1/properties/:property/profile/name` accepts exactly
   `{expectedVersion,name}` plus a visible-ASCII idempotency key. Normalize NFKC,
   «REDACTED-SECRET» whitespace, allow 1–200 visible characters, and reject control or
   bidi-format characters.
4. Lock the exact property. Version zero means no prior rename fact; every changed
   commit increments exactly once. Stale expected version conflicts. Same normalized
   name at the current version is a true no-op with no fact/outbox/version advance.
5. A successful rename changes only `org_node.name`, derives effective timestamp from
   PostgreSQL transaction time and business date from the locked timezone, appends
   one superseding `property.identity.changed` fact and publishes one atomic event.
   Event payload contains only version and `changed_fields:["name"]`; consumers reload
   canonical identity.
6. Durable actor/property/body-bound idempotency returns the exact stored successful
   receipt on replay; changed input under the same key conflicts. Rollback leaves no
   name, idempotency, fact or outbox residue.
7. Runtime receives no direct `UPDATE(name)` authority. Use one tightly bounded
   deployment-owned `SECURITY DEFINER` capability with public execution revoked,
   app-role-only execute, fixed safe search path and internal scope/grant validation.
8. Timezone, currency, path, kind and full config bytes remain identical through every
   success, replay, denial and conflict.

## Exclusions

- No timezone/currency/hierarchy/config mutation, property creation/deletion, address,
  contact, check-in/out, house rule, amenity, content, meal plan, OTA, company/TA,
  user/role, frontend or public deployment.
- Never edit `migrations/0001_init.sql`.

## Verification

- Fresh PostgreSQL 16 migrations 1–98, setup/referee/schema checks.
- Read, normalized rename, no-op, replay/key conflict, stale version and concurrent
  one-winner proofs.
- Cross-tenant/sibling/no-scope/direct-update/security-definer/search-path hostility.
- Atomic fact/outbox/supersession/business-date and rollback evidence.
- Exact before/after fingerprints for config/timezone/currency/path/kind and all
  unrelated tables; existing inventory-policy/runtime-authority regressions.
- HTTP exact-shape/no-config-leak tests, strict TypeScript and boundaries.
- Independent non-implementing Tier-3 review before any release.

## Independent review status — 2026-09-21

R1 **CHANGES REQUIRED**. Independent Astra personally passed fresh pinned PG16.15
1–98, referee11/11, schema equality,20/0/219 focused/adjacent proof, scoped strict TS
and203-file boundary checker, but reproduced actor revocation during property-lock
wait and permission revocation during replay wait still succeeding, plus invisible-only
names persisting. Preserve Review581 R1 and remediate under a fresh frozen review.
No public migration, deployment or operation is admitted. Root-wide pre-existing TS
and exact13-context oracle failures are separately recorded, not attributed to581.

## R1 remediation implementation note — 2026-09-21

The write capability now locks the exact property before it resolves authority roots,
then retains/revalidates tenant, actor, membership, role, permission grant and scope
under the same transaction. A separate bounded SECURITY DEFINER assertion runs after
the idempotency receipt wait so a replay cannot outlive a revoked actor or grant.
This avoids the prior combined-lock ordering deadlock while preserving serialization.

Raw names are rejected before normalization when they contain control or format-only
characters, including soft hyphen U+00AD and invisible separator U+2063. The database
capability enforces the corresponding hostile input boundary.

Implementation proof completed on fresh isolated PostgreSQL 16.15 migrations 1–98:
referee 11/11; schema equality; 20/0 identity/HTTP/runtime-DML/inventory tests;
203-file boundary checker; scoped strict TypeScript; actor-revocation and
permission-revocation race harnesses; Unicode hostility and RLS/idempotency matrix.
The repository-wide `bun run typecheck` and exact-context layout oracle remain blocked
by pre-existing JSX configuration and the unrelated `jarvis` context, respectively.
No deployment, public mutation or database/provider operation was performed.
