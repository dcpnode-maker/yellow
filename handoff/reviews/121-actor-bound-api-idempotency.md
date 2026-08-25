# Order 121 independent review — actor-bound API idempotency

**Verdict:** APPROVED

**Risk tier:** 2

**Reviewer:** independent non-implementing OpenAI Codex reviewer

**Executable reviewed:** `bc27020e8c3f26e9cc68658cab00a2f9ac1929ed`

**Exact parent red:** `88648fe49ed59717b16e52edb1cc5971258c53fb`

**Builder metadata head received:** `2b8cd28b5eab74b55ccd83275c72c232f0fc7fe3`

## Findings

No Order 121 implementation or scope finding.

## Validation rubric

- [x] Reproduce the same-tenant, different-actor replay through authenticated HTTP
  and real PostgreSQL on the exact parent-red commit.
- [x] Prove same-actor replay, different-actor conflict, changed-request conflict,
  caller-identity rejection and rollback behavior on the exact executable SHA.
- [x] Independently enumerate every direct operator idempotency claim and verify its
  hash input uses only the server-derived authenticated actor.
- [x] Verify the implementation diff preserves existing operation, key, resource,
  body, response and transaction behavior and stays inside the order.
- [x] Run proportionate route, standing, dependency, schema, protected-hash and
  fresh-referee checks.

## Personally executed proof

The reviewer used isolated worktree `yellow-order121-review` and distinct disposable
Compose projects/databases; no builder database, live stack or pasted builder output
was used as review proof.

- On exact parent-red `88648fe49ed59717b16e52edb1cc5971258c53fb`, a fresh
  PostgreSQL fixture ran the committed authenticated HTTP proof with two valid actors
  sharing one tenant, property, scope, request body and idempotency key. Actor A's
  first request and retry returned 201; actor B incorrectly returned 201 rather than
  409. The parent run was intentionally red at 2 pass / 3 fail with 23 assertions:
  both two-actor checks observed 201 and exhaustive source coverage found the missing
  actor field. PostgreSQL retained one claim per exercised key; sanitized request-hash
  prefixes were `984cb27bd007` and `200dcfe2bedb`, each with stored status 201.
- On exact executable `bc27020e8c3f26e9cc68658cab00a2f9ac1929ed`, the same
  focused file passed 5/5 with 54 assertions. It proves exact same-actor replay with
  `idempotency-replayed: true`, same-tenant actor B receives 409 without a successful
  replay or second domain/fact/outbox effect, changed content still conflicts,
  query/header actor injection is ignored, body actor injection is rejected before a
  claim, a foreign tenant receives 403, and publisher failure rolls mutation,
  evidence and idempotency back before a successful retry.
- Independent static enumeration found exactly 16 direct
  `this.#idempotency.execute(context.tx, ...)` calls and exactly 16 corresponding
  `request: { actorId: context.identity.actorId, ... }` inputs. Direct inspection
  covered projection rebuild, bulk rooms, block open/close, hold place/release,
  offline-lease place/release, OOS policy, restrictions, release draft, the shared
  rate-builder helper, rate-price create/supersede, and both shared create helpers.
  No request body, query or client header supplies the hashed actor.
- The exact parent-red-to-executable diff changes only `src/http/operator.ts`: the
  sixteen existing request objects gain the actor field, with five line-wrap-only
  additions. Operations, keys, existing property/resource/body fields, callbacks,
  status codes and transaction placement are unchanged. The full order change adds
  only the scoped focused test beside that implementation; `git diff --check` passed.
- Pristine representative route databases passed inventory 6/6 with 44 assertions,
  rate configuration 7/7 with 50, rate builder 11/11 with 75, bulk rooms 6/6 with
  495, and rate pricing 6/6 with 39. These exercise both shared create helpers, the
  shared rate-builder helper, and representative literal inventory/rate claims.
- Standing tests passed 171 / 399 skipped / 0 failed with 1,952 assertions.
  Typecheck passed; import boundaries passed for 64 TypeScript files. After replacing
  the temporary dependency junction with the frozen installation, licence validation
  passed for 23 installed packages and `bun audit` reported no vulnerabilities.
- Fresh app-never-started setup applied migrations 0001–0011, produced 85 public
  tables with RLS 75/75 and policies 75/75, and passed the referee 11/11. Schema drift
  matched `tests/schema/expected.sql`. Protected hashes independently matched
  `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`
  and `3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1`.

Some non-authoritative setup attempts were discarded rather than presented as proof:
an inventory suite initially reused the focused database and correctly found extra
rows; a combined route command was interrupted during bulk-room fixture setup; a
rate-price attempt then encountered the partially seeded review identity; and the
first network-restricted audit plus junction-based zero-package licence result were
not counted. Each affected proof was rerun from a new migrated database or real frozen
23-package installation and passed as recorded above.

## Scope and residual status

Approval is exclusive to sealed Cyber finding `actorless-api-idempotency` at the exact
executable SHA. It does not approve a schema change, alter service-layer idempotency,
or close any sibling finding. The inherited Order 069 P8 host-timing debt and the
Question 142 / Order 125 stale Order 053 permission fixture remain disclosed sibling
proof debt and are not represented as green here. Ten sibling Cyber findings remain
open on this lineage. No merge, push, integration, deployment or live status is
implied.
