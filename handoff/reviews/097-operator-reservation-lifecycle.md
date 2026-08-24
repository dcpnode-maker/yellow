# Independent review — Order 097 operator reservation lifecycle

**Result:** APPROVED

**Reviewed tip:** `b8e7e06`

**Implementation base:** `a5c8c90`

**Reviewer:** independent non-implementing Codex reviewer

**Date:** 2026-08-24

The reviewer did not implement Order 097. Exact diff inspection found all 18 changed
files inside the order scope. Migration, schema snapshot, referee, package/lock,
Compose/CI and kernel surfaces are unchanged. The four trailing spaces reported by
`git diff --check` are the order header's intentional Markdown hard breaks; no source,
test or generated artifact has whitespace damage.

The real lifecycle query binds tenant id, transaction-local tenant context, property
and exact confirmation number. A reviewer-only runtime canary added temporarily to the
focused test proved the positive lookup and that the same confirmation under a sibling
property or foreign tenant fails with the generic property-local not-found error. The
canary passed 3/3 with 22 assertions and was then removed, leaving no test change.

HTTP inspection and focused proof confirm distinct `reservations.lifecycle:read` and
`:write` grants, exact property authority, strict path/query/body shapes, server-owned
tenant/actor/property/request/operation envelopes and injected-command-only adapter
convergence. Browser controls are derived only from server actions; optimistic expected
fields come from the last server representation; success reloads server truth, announces
through the live region and moves focus to the lifecycle editor. Assets use safe text,
external files, 44px controls and existing responsive/reduced-motion rules, with no
browser persistence or approval/state authority.

On fresh isolated PostgreSQL project `yellow-order097-review`, port 5501, the reviewer
personally executed:

- `YELLOW_REQUIRE_OPERATOR_RESERVATION_LIFECYCLE=1 npx -y bun@1.3.13 test tests/operator-reservation-lifecycle.integration.test.ts` — 3 passed, 0 failed, 20 assertions; reviewer hostile isolation canary — 3 passed, 0 failed, 22 assertions;
- `YELLOW_REQUIRE_RESERVATION_LIFECYCLE=1 npx -y bun@1.3.13 test tests/reservation-lifecycle.integration.test.ts` on a newly migrated database — 5 passed, 0 failed, 62 assertions, covering frozen-policy modify/cancel, exact different-operator waiver, occupancy re-arbitration/races, replay and publication rollback;
- `npx -y bun@1.3.13 test tests/operator-assets-security.test.ts` — 7 passed, 0 failed, 87 assertions;
- `npx -y bun@1.3.13 run typecheck` — passed;
- `npx -y bun@1.3.13 run boundaries` — 59 TypeScript files scanned, no violations;
- `npx -y bun@1.3.13 test` — 124 passed, 339 skipped, 0 failed, 1,590 assertions across 74 files;
- fresh `tests/review-seed.integration.test.ts` — 11 passed, 0 failed, 39 assertions;
- fresh migration/seed plus `tests/database-acceptance.integration.test.ts` — 4 passed, 0 failed, 10 assertions;
- `COMPOSE_PROJECT_NAME=yellow-order097-review YELLOW_SCHEMA_DATABASE=yellow_order097_deploy npx -y bun@1.3.13 scripts/schema-drift.ts --check` — exact snapshot match;
- `npx -y bun@1.3.13 run license-check` — 23 installed packages passed; `npx -y bun@1.3.13 audit` — no vulnerabilities;
- a separate app-never-started, freshly migrated and seeded 84-table database through untouched `tests/run_invariants.py` — **11 passed, 0 failed of 11**.

The temporary Bun 1.3.13 runner was used because Windows Bun 1.3.14 reproduced an
environmental package-export resolver failure for installed `elysia` and
`typescript/unstable/ast`; reinstalling the exact lockfile did not change that runtime
failure. Under Bun 1.3.13 the same checkout passed every assertion and boundary gate.

Migration 0001 SHA-256 remains
`FE2A9FC949C6BACDED3F8D3FC4D14FC596A83EBDE9AEB043EB10845F07B30923`; the untouched
referee remains `3228279BD99A8F9B6AF99748F31D4D4B482A8E627E16D92644D9D859AD8BEFA1`.
User-owned untracked `.agents/`, `.codex/hooks.json` and `handoff/chat-archive/` paths
were not touched.

## Exclusive Order 097 discharge

- 097
