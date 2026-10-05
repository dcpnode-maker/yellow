# Order 671 independent write-boundary review

Reviewer: `/root` (did not implement the backend/service/HTTP/tests).
Implementer: `/root/mapping_backend` (GPT-6 Sol).
Date: 2026-09-24.
Backend result: ACCEPTED for draft creation only. UI and deployment verified below.

## Personally inspected
CommercialMappingService, reporting export surface, HTTP methods, authenticated app
routes, focused service tests, and real PostgreSQL HTTP/concurrency tests. No migrations
or active extension updates. The GET returns bounded latest-draft/effective-active
data; POST uses the same per-tenant/type/key advisory lock namespace as generic
extension versioning and compares the submitted latest version while holding it.

Review corrections implemented before acceptance:
- Replaced unbounded historical content reads with bounded current-version queries.
- Reused existing property configuration permissions after a read-only catalogue
  check proved generic identity.extension scopes are not registered property grants.
  No role or grant was changed in the live application.
- Converted malformed stored taxonomy into an actionable unavailable response.
- Added real validation and audit-failure rollback proof, not only happy-path tests.

## Reviewer-executed proof
Created the uniquely scoped `yellow_order671_review` database in the existing PG18
container from a **schema-only** export of the serving database (99 migrations).
No live business data was copied or modified. Tests create synthetic tenants and
property grants there. Runtime session identity is asserted as `yellow_runtime` and
requests run through the existing tenant transaction/app_role boundary.

Command (credentials loaded in memory from the existing runtime environment, never
printed): `YELLOW_REQUIRE_ORDER671_DB=1 bun test tests/order671-commercial-mappings.integration.test.ts`
with `YELLOW_ORDER671_DEPLOY_DATABASE_URL` and
`YELLOW_ORDER671_RUNTIME_DATABASE_URL` targeting that isolated review database.

Final result personally executed by `/root`: **5 passed, 0 failed, 24 assertions**.
1. Token scope plus property role grants deny foreign tenant/sibling property reads
   and writes; read-only sessions cannot save.
2. Foreign company and other-property unit type references reject without drafts.
3. Malformed mappings reject without a draft or audit fact.
4. Concurrent saves against the same version yield exactly 201 + 409, one draft,
   one audit fact, a reloadable version, and unchanged active content.
5. A controlled invalid timezone in the isolated fixture forces audit insertion to
   fail after the extension insert; the transaction rolls back both. UTC is restored.

No activation event is emitted because drafts are not operational configuration.
This acceptance does not approve activation, historical restatement, room-product
many-to-many changes, portfolio attribution or any financial/lifecycle write.

## UI and delivery closure
Root personally verified the deployed editor in the browser at desktop and 390px
mobile width. Active v1 and edit access load; MICE search and exact filter/sort return
1 of 5 rows. Editing a label makes the form dirty; the in-page Leave confirmation's
Keep editing action retains that label; Reload asks before discarding, Cancel keeps
edits. Restoring the original label disables Save; returning to Property overview
works. Collapsed group cards, selected ribbon, and mobile layout were visually checked.
No horizontal overflow (document375px / viewport390px); console error list empty.
No live configuration was saved. PostgreSQL readback still shows only one active
commercial_attribution version and no drafts.

The initial native window.confirm stalled preview tab3; it was replaced with DOM
dialogs and verified in fresh tab4, left open as the delivery. No claim is made that
the old stalled tab itself was recovered. Standard browser page-exit protection
remains for dirty forms.

Final app image: sha256:dbfa88af5e530bc93536e8934a71ccf30bc81004dcd195dbf713dd262a8cc9d9.
One serving app container remains, health=healthy, /health={"status":"ok"}.
The isolated review database was dropped after verifying its exact name and that
all tenant rows were Order671 synthetic fixtures. No live data was removed.
