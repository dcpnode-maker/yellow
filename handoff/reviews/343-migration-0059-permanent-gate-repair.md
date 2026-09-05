# Order 343 migration-0059 permanent-gate fresh Tier-3 review

**Disposition:** WITHHOLD — one masked stale exact catalogue assertion remains

**Reviewer:** `/root/order343_fresh_tier3_review`, fresh independent non-implementing
OpenAI Codex Tier-3 reviewer

**Exact reviewed candidate:** `04e5e12e9e823a5fb4a3dcb665f4c4446d2d40ff`

## Blocking finding

The authorized three-test repair is exact and does not weaken its edited assertions,
but the corrected runtime-authority gate remains red on the required fresh current
database. Updating the expected runtime-capability inventory from twelve to thirteen
allows its P1 test to proceed past the formerly failing assertion and exposes a second,
previously masked stale exact catalogue oracle at
`tests/runtime-database-authority.integration.test.ts:397`:

```text
expected { tables: 94, enabled: 84, forced: 0, policies: 84 }
received { tables: 110, enabled: 100, forced: 10, policies: 100 }
```

The current values agree with migration/acceptance/schema/referee truth. This is not a
product or authority defect, but Order343 requires the complete corrected gate green.
Candidate result is **9 pass, 1 fail, 85 assertions**. A separate bounded repair and a
different fresh reviewer are required; this reviewer made no implementation repair.

## Exact repair and intentional-red provenance

`72aadad..04e5e12` changes only the three admitted permanent test files plus admitted
governance ancestors. The implementation commit adds migration0059's exact filename,
version and repository SHA-256, changes exact counts 58 to 59, and adds the exact
`runtime_visible_extension_effective_period(uuid,uuid)` signature while preserving
strict list equality, owner, pinned search path and PUBLIC/app-role/runtime ACL checks.
There is no production, migration, schema, permission, seed, dependency or runtime
diff.

Against parent `72aadad`, I personally reproduced D968 exactly:

- migrate: **38 pass, 1 fail, 171 assertions**;
- database acceptance: **22/1, 63**;
- runtime database authority: **8/2, 49**.

Against candidate `04e5e12` on fresh PostgreSQL:

- migrate: **39/0, 187**;
- database acceptance: **23/0, 65**;
- runtime database authority: **9/1, 85** (blocking catalogue total above);
- migration0059 effective-period proof: **2/0, 38**.

## Fresh database and Order342 exit rerun

I used one reviewer-owned PostgreSQL 16.15 container from the exact pinned digest,
directly on Docker's built-in `bridge`, loopback port 59400, tmpfs storage and distinct
deploy/runtime/registrar roles. I did not use Compose or create a Docker network. The
fresh databases applied migrations 0001–0059; normalized schema matched
`tests/schema/expected.sql` exactly. Review seed acceptance passed **24/0, 111** and a
separate fresh referee database passed **11/11**.

The complete documented Phase6 product matrix remained green: check-in, due-in room
assignment and arrival roll; actionable open-balance checkout denial and exact-zero
checkout/release; departure roll; housekeeping lifecycle, initial condition and sheet
generation; sleep/skip/person discrepancy classification and concurrency; travel,
pickup, dispatch, room-cleaning and parking; raw runtime DML and SECURITY DEFINER
containment. The main grouped run was **100/1, 925**, where the sole failure was a
review-harness collision from running the unseeded Order202 fixture against the seeded
acceptance database (`vertical_profile` already existed). On a separate unseeded fresh
migrated database the unchanged Order202 suite passed **6/0, 25**; a reviewer-only
custom-cadence substitution also passed **6/0, 25**, proving fail-closed zero-artifact
behavior. This is not a product finding.

Standing `bun test` passed **1187**, skipped **890** database-gated tests, failed **0**,
with **18388 assertions** across 384 files. TypeScript, 132-file boundaries, 23-package
licence policy, production audit 0, JavaScript syntax and diff hygiene passed.

## Boundary

**WITHHOLD** exact candidate `04e5e12`. Order343 is not approved, Order342 and Phase6
remain unapproved, and Order344's after-Order343 prerequisite is not satisfied. No
product, migration, test repair, database/runtime authority, local app, `.yellow`,
credential, port3000, stable-container, merge, push or deployment authority is granted.
