# Order 675 — independent product-code projection review

Reviewer: Codex `/root/order675_independent_review`, 2026-09-24. I did not implement the Order 675 backend or frontend changes. This record covers source and personally executed database proof; it does not authorize publication or claim application completion.

## Source inspection

Inspected `src/contexts/reservations/board.ts`, `tests/reservation-board.integration.test.ts`, `frontend/yellow/src/today-workspace.ts`, `frontend/yellow/src/movement-table-query.ts`, the `Stay` contract in `frontend/yellow/src/yellow-api.tsx`, and `tests/order675-movement-codes.test.ts`. The board selects `unit_type.code` and `rate_plan.code` from its existing latest selected segment and same-tenant/same-property joins. New required code fields retain `ReservationBoardConflictError` when a joined reference is missing. Keyset paging, selected-segment ordering, and lanes are unchanged by the scoped backend diff. Frontend search, header filters and multilevel sorts use the actual code fields separately from labels; old payloads do not infer codes. No class or meal-plan field was invented.

## Personally executed proof

Working directory: `D:/Yellow/git-live-order611-source-v2`. Public live PostgreSQL `yellow-public-demo-postgres-1` on localhost:55432 was not contacted. Existing development PostgreSQL `yellow-postgres-1` on localhost:5442 was read only for database/role preflight; it lacked the fixed role names needed by migration 0015. I therefore started a fresh temporary `postgres:18.6-alpine` container named `yellow-order675-independent-pg` on localhost:55475, with no persistent volume or download. Before migrations, `psql` verified `current_user|current_database|public table count` as `yellow_deploy|yellow_order675_review|0`. Credentials were generated in process and never printed. The repository's authority provisioner created the distinct runtime, owner and registrar roles within that isolated container; the migration runner applied 0001–0100. Final `schema_migration` count and max version were `100|100`. The container was stopped and removed after testing; an exact-name `docker ps -a` check returned no container.

- `bun scripts/provision-local-database-authority.ts` with isolated deploy URL and generated runtime/registrar passwords — passed.
- `bun scripts/migrate.ts` with isolated deploy URL — 100 migrations applied, exit 0.
- `bun test tests/reservation-board.integration.test.ts tests/order632-reservation-board-commercial-codes.test.ts` with separate `YELLOW_RESERVATION_BOARD_DEPLOY_URL` and `YELLOW_RESERVATION_BOARD_RUNTIME_URL` for that verified database — **10 passed, 0 failed, 121 assertions, zero skips**. The production-style PostgreSQL case exercised two-tenant fixtures, property isolation, tied-cursor pagination, filtering, and read-only repeatability, and asserted stored code values alongside labels.
- `bun test tests/order675-movement-codes.test.ts tests/order674-movement.test.ts tests/yellow-today-workspace.test.ts` — **19 passed, 0 failed, 65 assertions**.
- `bun test tests/yellow-reservation-board-pages.test.ts tests/yellow-reservation-board-attribute-performance.test.ts` after the authorized regression-test correction — **6 passed, 0 failed, 313 assertions**; the 10,000-row filtering and stable-sort case completed in 28.68 ms against its 500 ms limit.
- `bun run boundaries` — passed, 206 TypeScript files scanned.
- `bun run typecheck` after the correction — root and frontend TypeScript projects passed, exit 0.
- Scoped `git diff --check` — passed.

## Finding and disposition

The first `bun run typecheck` failed with TS6142 in `tests/yellow-reservation-board-attribute-performance.test.ts:4`: the root TS config has no JSX setting, while that revised test statically imported `MovementTableControls.tsx`. I reported it to root. Root changed that test to load the component dynamically while retaining its rendered-control assertions. I inspected the correction and personally reran full typecheck and the two updated test files; both passed. **Independent Order 675 source/database review: PASS for the bounded additive projection.** Live response, browser acceptance, and deployment remain separate root checks.

## HTTP serializer addendum — same reviewer, 24 September 2026

After the initial review, root recorded Q675-http-code-projection and added `src/http/operator.ts` to the order's scope for exactly two `reservationBoardJson` fields. I independently inspected that function: the newly admitted lines copy `reservation.unitTypeCode` and `reservation.ratePlanCode` into the explicit HTTP JSON object alongside their respective labels. Its existing route, scope/property grant checks, page request and canonical JSON response path are unchanged by these two lines. The larger `operator.ts` worktree diff contains prior unrelated commercial-mapping work and is not approved by this review. Root separately reports that the pre-675 operator source matched the serving source byte for byte after line normalization; I did not independently inspect the serving file or deploy image.

I inspected `tests/order675-http-codes.test.ts`, which invokes `OperatorHttpApi.reservationBoard` and verifies the serialized authorized response and 403 behavior before board access for missing scope or property grant. Personally executed:

- `bun test tests/order675-http-codes.test.ts tests/reservation-board.integration.test.ts tests/order675-movement-codes.test.ts` — **12 passed, 1 database skip, 0 failed, 103 assertions**. The skip occurred because the temporary isolated database had already been removed; it does not replace or weaken the earlier zero-skip, 10-pass personally executed PostgreSQL proof above. The two new HTTP tests passed.
- `bun run typecheck` — root and frontend TypeScript projects passed.
- `bun run boundaries` — passed, 206 TypeScript files scanned.
- `git diff --check -- src/http/operator.ts tests/order675-http-codes.test.ts` — passed.

The additive HTTP serializer passes this independent source review. Deployment and live response verification remain separate root checks.
