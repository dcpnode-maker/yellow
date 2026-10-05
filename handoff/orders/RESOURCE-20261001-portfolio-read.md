# RESOURCE-20261001 — authorized portfolio navigation

Author: Codex laptop controller under the founder's explicit build, enterprise hierarchy and parallel-resource authorization. This implements step 2 of DEVICE-ENTERPRISE-ONBOARDING-20261001, within Phase 7. Laptop remains the source/controller; cloud owns its separate release/hosting branch; phone validates exact changed frontend inputs.

## Bounded source ownership

- Backend lane: new src/contexts/identity/portfolio.ts, export through identity/index.ts, src/http/operator.ts, src/app.ts, and portfolio input/real PostgreSQL HTTP/integration tests. Add constructor dependency only if necessary; do not restructure the large operator constructor. No migration, permission catalogue, authentication protocol or existing properties endpoint change.
- UI lane: new frontend/yellow/src/portfolio-navigation.ts, ui/PortfolioExplorer.tsx and its scoped stylesheet, yellow-api.tsx portfolio loader, OperatorHeader.tsx integration, and functional navigation/pagination tests. Preserve existing dirty work, property showcase filters and guarded operation callbacks. No App.tsx-wide rewrite.
- Root owns this order, current status, bounded design contract and receipts. All workers must read PROJECT.md/current state and preserve the dirty source. No blanket stage/reset/merge or deployment in this order.
- Task-owned database/toolchain preparation and proof live beneath E:/YellowWorkspace/Data/BuildArtifacts/yellow-portfolio-20261001-v1/. Use a new loopback-only PostgreSQL18 instance/database and unique fixture tenants; never recreate or alter an existing local database/service. Restrict credentials to the task and do not print them. Existing referee scripts/fixtures may run against this owned database unchanged. Installed PG17 may supply compatibility diagnostics only, never PG18 acceptance.
- Phone jobs remain authenticated typed, hash-bound and deadline-bounded. Root dispatches after fresh actual quota inspection. No detached child escape, third-party proxy, credential sharing or artificial load. Retain the one-percent stop and failed evidence.

## Exact API contract

GET /api/v1/me/portfolio?scopeNode=<uuid>&after=<uuid>&limit=<1..100>, default limit 50. Strictly reject unknown/repeated keys, invalid UUIDs/limits and empty values with 400. Existing signed inventory.availability:read scope is necessary; the same request also checks active tenant/actor and current tenant-local membership, role, permission and grant node within the existing transaction-local app_role boundary. No permission expiry columns are invented.

Response: {scope: PortfolioNode|null, nodes: PortfolioNode[], nextCursor: string|null}. PortfolioNode contains id, name, kind (group/brand/region/property), parentId (null if outside visible authorized hierarchy), authorizedPropertyCount (distinct accessible properties), and nullable timezone/currency (populated only for properties). No raw path, tenant ID, configuration, global regional count or operational/financial aggregation.

Without scopeNode, return authorized grant roots collapsed where one permitted root contains another. With scopeNode, return only immediate children within the authorized hierarchy that lead to a currently accessible property. Property grants include the property itself as a root, never its ungranted ancestors. Outlet-scoped grants cannot authorize a containing property. UUID keyset order, limit+1 detection and recomputation of authorization on every page. A cursor positions results only; it cannot broaden access. Uniform 403 for absent/inactive actor/tenant, missing live permission or unauthorized/nonexistent/foreign scope. A live valid grant containing zero properties returns an empty root page. Counts deduplicate overlapping grants before aggregation. Prefer one statement for a consistent live authorization snapshot.

For the environment-gated synthetic public demo (YELLOW_PUBLIC_DEMO_AUTOMATIC_LOGIN=1), intersect permitted properties with the existing two showcase IDs BEFORE deriving nodes and counts. This server-controlled restriction is not accepted from query parameters. Real authenticated API mode retains the complete currently permitted hierarchy. Do not alter token claims or remove current client showcase filtering.

## UI contract

Add a compact Portfolio control to the existing operator header. It opens a responsive read-only explorer, with accessible properties counts, drilldown, breadcrumb/back, bounded Load more, loading/empty/error/retry states. Consume the API contract rather than inventing client permissions or counts. Reject inconsistent/malformed page data; prevent stale scope responses from being displayed after navigation, and reset loaded rows/cursor on scope change or error. Provide explicit reload/retry so old permissions are not presented as current truth.

Open a chosen property in a separate workspace tab with noopener, preserving the current route's workspace suffix, search and hash. This preserves the current operational draft without replacing existing session or route authority. The UI must label this action clearly. No in-place property switch, localStorage token/session grant, fake registration, speculative Hotel/STR metadata or cross-tenant rollup. Existing API client is demo-authenticated; this order does not claim production session onboarding is complete.

## Acceptance

Backend tests use real PostgreSQL and runtime app_role: two tenants with identical hierarchy paths; independent branch grants; property-only and department actors; overlap dedup; no sibling/ancestor/foreign leaks; current grant/permission revocation, inactive actor/tenant and same-token revocation between pages; token expiry; strict query failures; demo filtering before counts. A large independently generated portfolio is walked at limits 1/50/100 to exact exhaustion without duplicates/skips and with bounded results. Snapshot domain/grant/fact/outbox/idempotency state to prove reads do not mutate it.

Run strict typecheck, module-boundary checks, meaningful frontend helper tests and isolated compilation. Independent non-implementer must execute the actual DB/HTTP proofs and existing 11/11 referee before reviewable PR claims. Review executable evidence, not skip counts or worker status. Browser permission verification remains unavailable; do not bypass it. Compilation is not visual/touch/native-app acceptance. No eighteen-phase or public-hosting completion claim.
