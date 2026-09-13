# Q264 — Order472 property competitor-set source scope

Status: RESOLVED by primary implementation owner, 13 September 2026.

## Scope question

Order472's accepted catalog cannot yet save an authenticated property's confirmed
identity or competitor set. That needs additional source/API/configuration files
outside the catalog tranche. No business-policy choice is missing: the founder
requested explicit confirmation and tenant/property isolation.

## Resolution before implementation

Admit the exact additional source and documentation paths/owners in Order472.
Use a dedicated small HTTP adapter, existing distribution commands, immutable
extension versions, current actor/property grants, idempotency, facts and the
existing extension activation event. Do not add a new table, service, provider,
permission grant, application deployment or alternative operational database.

The domain owns authorization even when later called by voice/automation. Each
request supplies references into an admitted server catalog, never trusted source
metadata. Confirmation serializes before checking the expected active version.
Authorization must be checked before replay; generic extension endpoints cannot
bypass confirmation or disclose property-bound sets.

This resolution admits source and mock/pure tests only. Existing app and PriceLabs
databases are not disposable fixtures. A read-only audit will determine whether a
separate synthetic database on the preserved native cluster can be provisioned
without changing cluster-wide roles. No database creation, SQL mutation, migration,
credential change, destructive teardown or live mounting is admitted here.

Source inspection found an existing pure launch-catalogue assertion hard-coded
to ten types in `tests/extension.integration.test.ts`. Root additionally admits
only that file's pure catalogue test for eleven types and explicit absence of a
seeded market_compset instance. Its database fixtures/cleanup remain unchanged
and will not be executed against the current local database.

## Authorization-lock capability addendum, before implementation

Astra's source inspection found that migration0016 removes app_role UPDATE on
tenant/app_user/role/user_role/role_permission. PostgreSQL row locks require an
UPDATE privilege; direct FOR SHARE would therefore fail, while an unlocked check
would not serialize a concurrent permission withdrawal. No existing non-fiscal
capability provides these narrowly scoped locks.

Primary owner admits source for forward migration
`migrations/0092_market_compset_authority.sql`, owned by Astra, and a generated
`tests/schema/expected.sql` update owned by root only after isolated schema proof
(the actual generated schema path; no new SCHEMA.sql file). The function
may only validate/lock current tenant, active actor, selected property and its
current read/write grant. Fixed search path, explicit owner, exact tenant setting,
restricted execution and coherent snapshot/lock/reread are mandatory. It writes
no rows and adds no broad table UPDATE, role membership or global role alteration.
No fiscal/financial capability is reused or broadened. Invalid, foreign, missing
or changed authority fails closed before replay. The service still owns all
confirmation/evidence/idempotency rules.

This narrowly replaces the earlier no-migration **source** restriction, not its
execution restriction: no migration is applied to the current app or any database
by this addendum. Native isolated proof admission remains separate. No new entity,
table, state, event, automatic permission assignment or production activation.

Acceptance requires independently executed actual PostgreSQL authorization,
idempotency, concurrency and atomic rollback proof after its precise native test
scope is separately recorded. Skipped integration cases are not proof.
