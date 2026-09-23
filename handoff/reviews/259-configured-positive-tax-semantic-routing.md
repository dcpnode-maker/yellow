# Review 259 — Configured positive-tax semantic routing

**Reviewer:** independent Codex Tier-3 reviewer (`/root/order247_verify`)
**Decision:** APPROVED
**Date:** 2026-08-29
**Reviewed commit:** `31662dd0173885ca4cb90c60bf0d1fd3e5c03950`
**Reviewed base:** `b9187d7`
**Authority:** Order259 / D-671 / D-672 only

## Verdict

APPROVED. No blocking Order259 finding.

Migration0043 adds one tenant-leading, RLS-protected, app-SELECT-only semantic-route
root. Each row binds an exact property, currency, complete frozen jurisdiction
identity, semantic revenue/tax identity and pre-existing configured transaction-code
route. The resolver composes the approved Order256 eligibility and Order251 posting
topology in the same tenant transaction. It returns the exact ordered blockers before
any semantic lookup, or exact room-revenue and canonical nonzero-tax credit routes
after validating live transaction-code and account truth. It writes nothing.

No heuristic route selection exists. Names, USALI labels, default account-role hints,
code coincidence and generic TAX/GST/VAT codes cannot satisfy an absent semantic row.
This approval grants no route authoring, guest-debit transaction code, journal,
posting, tax-detail, business-date, India decomposition, document-rounding,
correction, document/IRP, HTTP/UI, local promotion, merge, deploy, Phase7-complete or
application-complete authority.

## Migration and database inspection

- `migrations/0043_positive_tax_semantic_route.sql` has SHA-256
  `a5036df30f07c4c8add08c46cdb805c71b87597efa542e368e64aa35d572bf40`.
- The primary key and every explicit lookup index are tenant-leading. `property_node`
  is protected by a composite tenant/property foreign key; the semantic row also
  references the exact existing global transaction code, exact configured
  `(tenant,property,currency,tx_code)` route and retained jurisdiction extension id.
- `UNIQUE NULLS NOT DISTINCT` makes the complete jurisdiction/semantic identity
  unique for both tenant-owned and platform-global extension evidence. Checks enforce
  canonical currency, positive version, SHA-256 content hash, stable jurisdiction
  key, allowed owner (`NULL` or the route tenant), and only
  `revenue/room_revenue` or canonical tax codes.
- Tenant RLS uses transaction-local `current_setting('app.tenant_id', true)` through
  `NULLIF`. The table owner is `yellow_owner`; PUBLIC, `yellow_runtime` and app
  mutation authority are absent; `app_role` has SELECT only. No authoring function,
  trigger or writable view was added.
- The migration is forward-only and contains no data rewrite. The exact generated
  snapshot, setup count and acceptance/migration manifests advance coherently to
  migration43, 97 public tables and 87 policies.

## Resolver inspection

- The caller supplies only tenant, property and reservation UUIDs. Order256 performs
  exact input validation, tenant/RLS authority, immutable quote-lineage verification,
  primary-folio/account locking and post-lock re-read before semantic routing begins.
- Order251 is derived internally from the reparsed canonical snapshot. A derivation
  failure becomes a conflict. `policy_blocked` returns the exact frozen ordered plan
  blockers and performs no `tax_semantic_route` query.
- A route lookup requires exact tenant context, property, currency, jurisdiction
  extension id, owner tenant including `NULL`, key, positive version and content hash.
  It requests only `room_revenue` and the canonical positive-tax codes present in the
  plan; unrelated configured rows are ignored.
- Missing rows are not-found and duplicate/unexpected rows are conflicts. Revenue
  requires a canonical configured code with `grp='revenue'`, nonblank USALI and an
  open exact-property/currency `revenue` credit account. Tax requires `grp='tax'` and
  an open exact-property/currency `tax_payable` credit account. Missing credit sides,
  wrong groups/roles/status/property/currency or malformed stored identities fail
  closed.
- Zero-tax plans require no tax mapping. Multiple taxes preserve the canonical plan
  order; distinct tax semantics may explicitly share one configured liability
  account. No aggregate guest-debit route is selected.
- Eligibility, plan, jurisdiction, revenue route, each tax route and the enclosing
  discriminated result are recursively frozen. Repeated resolution is byte-equivalent
  but freshly derived. Static and database effect proof found no financial, fiscal,
  evidence or idempotency write.

## Personally executed proof

All database proof ran in one process on a manually created standalone target:

- container `yellow-order259-review-pg`;
- host port `55479`;
- named volume `yellow-order259-review-pgdata`;
- exact PostgreSQL image
  `postgres:16.15-alpine@sha256:ab5c955e9e57ae9879d4411ab49a912be9d162455676f7bf56e951b11ac73785`;
- production `pg_stat_statements` preload/tracking and slow-query setting;
- separate canonical `yellow_dev`, invariant/focused `yellow_test`, and temporary
  migration-runner databases.

Before migration, `docker inspect` proved the exact new container name, port and only
`yellow-order259-review-pgdata:/var/lib/postgresql/data`. The stable volume name was
absent. I then personally ran:

- production authority provisioning, migrations 1–43 and canonical seed;
- `bun test tests/database-acceptance.integration.test.ts` against canonical
  `yellow_dev`: **11 passed, 0 failed, 26 assertions**;
- migrations 1–43 plus `tests/seed_fixture.sql` against `yellow_test`;
- `python tests/run_invariants.py yellow_test` with UTF-8 output:
  **11 passed, 0 failed of 11**; the referee reported 87 tenant tables, 87 RLS tables
  and 87 policies;
- `bun test tests/positive-tax-semantic-route.integration.test.ts` with exact split
  deploy/runtime URLs: **9 passed, 0 failed, 131 assertions**;
- `bun test tests/positive-tax-posting-plan.test.ts
  tests/positive-tax-folio-eligibility.integration.test.ts
  tests/positive-tax-semantic-route.integration.test.ts`:
  **21 passed, 0 failed, 242 assertions**;
- `bun test tests/schema-drift.test.ts`:
  **4 passed, 0 failed, 19 assertions**;
- a live `pg_dump --schema-only --no-owner --no-comments` from the standalone
  `yellow_test`, normalized with the production schema-drift functions and compared
  byte-for-byte with `tests/schema/expected.sql`:
  **exact match**;
- `bun test tests/migrate.integration.test.ts` against the standalone cluster admin
  database with a separate runtime URL:
  **38 passed, 0 failed, 169 assertions**;
- `bun x tsc --noEmit`: pass;
- `bun run boundaries`: pass, **95 TypeScript files scanned**;
- `git diff --check b9187d7..31662dd0173885ca4cb90c60bf0d1fd3e5c03950`:
  pass;
- final direct catalog query: **97 public tables, 87 policies, 43 migration rows and
  exactly one version-43 row**.

The focused proof covered exact jurisdiction resolution, zero and multiple taxes,
canonical ordering, shared explicit liability accounts, generic-fallback rejection,
every wrong group/USALI/side/role/status/property/currency case, complete jurisdiction
and tenant/RLS isolation, blocker short-circuiting, deterministic deep freeze, zero
effects and raw app-role mutation denial.

## Scope and stable-local containment

The exact commit diff is confined to migration0043, the tax-fiscal resolver/export,
focused/acceptance/migration/schema proof, updated setup count, Order259 and Phase7
governance evidence. It adds no seed/default mapping, authoring capability, writer,
HTTP/UI, credential or local-runtime change.

Before starting the disposable target, I captured the stable app/PostgreSQL/Valkey
container IDs, states, health and mounts. The same values were compared again inside
the cleanup `finally` block and were byte-identical. After review, all three stable
containers remained running and healthy, the PostgreSQL mount remained
`yellow-order175-folio-responsive-containment_yellow-pgdata`, and `GET /health` and
`GET /` both returned **200**. No stable database command was executed.

The standalone container and volume were removed in the same process. No
`yellow-order259-review-pg` container or `yellow-order259-review-pgdata` volume
remained. Apart from this review record, the reviewer made no repository change.
