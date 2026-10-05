# Order 689 independent review — shared search for persisted groups

2026-09-24. Reviewer: Codex non-implementing agent `order679_independent_review`. I did not implement the group search, deep-link handling, or tests. Database proof used only synthetic data in isolated PostgreSQL 18.6 container `yellow-order689-proof`, bound to 127.0.0.1:55689 with tmpfs/no persistent mounts; the serving database and hotel records were not changed.

## Decision

**Scoped source approved for coordinator's guarded release acceptance.** The exact tenant/property search and deep-link behavior have independent source and executable proof. This does not claim that the shared search is a complete all-record index or that public browser acceptance/deployment has happened. It remains beta: folio, task, catalogue and complete room-history indexes are not part of this order.

## Findings and corrections

- The service executes a parameterized `strpos(lower(name/code), lower(query))` filter **before** UUID-cursor/50-row pagination. It validates the bounded query and scopes by input tenant, transaction-local `app.tenant_id`, current property and a property-kind join. `%` and `_` are literal search characters, not `LIKE` wildcards. The HTTP handler rejects duplicate/unknown query parameters and control characters, and requires the current lifecycle-read scope and property grant before calling the service. No write authority, schema or migration changed for this order.
- The shared dialog uses a separate property/query-keyed group read with debounce, loading/error/retry and 50-result truncation guidance. Stale group results are excluded when the submitted query changes. Group results have an exact existing Groups-workspace URL, no invented cashier route or room-hold claim; group search can be filtered independently of stays and profiles. The existing ecosystem capability stays beta and names its partial coverage.
- My initial source review found that selecting another group could retain the prior detail after a failed fetch or allow an older deep-link response to paint the wrong group. The implementer changed selection and deep-link loading to clear old detail/candidate state synchronously and guard the response by generation, current URL target and component lifetime. The parent continues to key the workspace by property. Pending create/link reconciliation remains governed by its existing same-key safety path.
- The first independent database rerun exposed a **test-fixture** failure: the new 51-group case used globally fixed UUIDs, so the second serial run collided with the first. The implementer made the bulk rows, target and codes unique per test run. I then reran on the **same** disposable database successfully; this is evidence the fixture correction is effective. The initial 6-pass/1-fail run is not presented as application failure or suppressed from this receipt.

## Personally executed proof

- Provisioned isolated roles and applied migrations 0001–0101 through the legitimate runner; read back ledger count/max **101/101**. Loaded canonical `tests/seed_fixture.sql` only into the disposable database and ran `python tests/run_invariants.py yellow_order689_proof`: **11 passed, 0 failed of 11**. No production connection was used.
- `YELLOW_REQUIRE_ORDER687_DB=1 bun test --timeout 15000 tests/order687-groups.integration.test.ts`, with exact isolated deploy/runtime URLs, after the fixture correction: **7 pass, 0 fail, 36 assertions**. The new real-SQL case inserts 51 nonmatching groups plus a high-UUID match, verifies unfiltered first-page exclusion, name/code and literal `%_` search, and rejects foreign tenant/property records. Existing tests still execute replay, membership CAS, transaction rollback, ACL/RLS and no inventory/finance side effects.
- `bun test tests/order687-groups.test.ts tests/order687-groups.http.test.ts tests/order687-groups.ui.test.ts tests/order689-group-search-ui.test.ts tests/order668-hotel-search.test.ts tests/order668-search-surface.test.ts tests/reservation-workspace-routing.test.ts`: **32 pass, 0 fail, 182 assertions**.
- `bun run typecheck`: backend and frontend passed. `bun test tests/import-boundaries.test.ts tests/build-readiness.test.ts`: **15 pass, 0 fail, 279 assertions**. I initially attempted the nonexistent `check:boundaries` script, then used the repository's actual boundary test; that failed command is not a gate result.

## Remaining coordinator acceptance

The coordinator still must verify the actual mounted/public shared search opens an existing same-property group by name/code and selects the exact detail, including a record beyond the first group list page; show explicit no-match/denial/failure behavior, browser navigation and mobile presentation. Do not represent these source/DB checks as public browser evidence. Do not relabel the wider Shared hotel search or All Ecosystem as complete.
