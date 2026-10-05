# Order 342 Phase 6 fresh independent Tier-3 exit review

**Disposition:** WITHHOLD — the exact-head migration, database-acceptance and runtime-authority gates are stale and red

**Reviewer:** `/root/order342_phase6_exit_review_retry`, fresh independent non-implementing OpenAI Codex Tier-3 reviewer

**Exact reviewed subject:** `91dd0cf73a6662825508f93d602ece246e1d4550`

**Phase 6 implementation lineage:** Orders 200–236, ending at `0708df1`

## Blocking finding

Phase 6's executable product journeys and hostile boundaries passed fresh PostgreSQL
proof, but the mandatory current-head permanent database gates do not all pass.
Migration `0059_tax_extension_effective_period.sql` and its thirteenth runtime
capability were added before Order 342 opened, while three exact catalog oracles still
end at migration 0058 and twelve runtime capabilities:

- `tests/migrate.integration.test.ts:1624` expects the historical upgrade result to
  end at `0058_india_gst_accommodation_invoice_issue_date.sql`. The runner correctly
  returns the additional `0059_tax_extension_effective_period.sql`, producing
  **38 pass, 1 fail, 171 assertions**.
- `tests/database-acceptance.integration.test.ts:7`–`298` defines an exact ledger
  only through version 58, and the exact catalogue at line 374 also expects 58
  migrations. A fresh database correctly contains the version-59 row, producing
  **22 pass, 1 fail, 63 assertions**.
- `tests/runtime-database-authority.integration.test.ts:356` and `:462` require
  exactly twelve runtime functions. Migration 0059 correctly creates
  `runtime_visible_extension_effective_period(uuid,uuid)`, so the live catalog has
  thirteen and the suite produces **8 pass, 2 fail, 49 assertions**.

This is permanent-gate maintenance drift, not evidence that migration 0059's product
behavior or authority is defective. On the same fresh database, the focused effective-
period integration proof passed **2/0 with 38 assertions**. A reviewer catalog query
found exactly thirteen `runtime_%` functions, all owned by `yellow_owner`, all denied
to PUBLIC and `app_role`, all executable by `yellow_runtime`, and all pinned to
`search_path=pg_catalog, public, pg_temp`. Nevertheless, Order 342 explicitly requires
the complete migration, acceptance and runtime-authority gates to be green. A separate
repair order must add migration 0059's exact filename/checksum/count and the thirteenth
capability/denial surface to those permanent gates, followed by a different fresh
independent exit review.

## Fresh disposable PostgreSQL proof

I provisioned one reviewer-owned PostgreSQL 16.15 container from the repository's
exact pinned digest, with `pg_stat_statements` preloaded, a Docker-assigned host port
60943, isolated deploy/runtime/registrar roles, tmpfs storage, and no application or
Valkey service. I applied migrations 0001–0059 and seeded it personally. I did not
contact `.yellow`, port 3000, or the stable Order 335 runtime. The disposable container
was removed after proof.

### Required Phase 6 journeys

| Surface | Reviewer-executed result | Exact property proved |
|---|---:|---|
| Order 200 check-in | **8 pass, 0 fail, 41 assertions** | Fresh check-in lifecycle and occupancy |
| Order 231 room assignment | **8/0, 43** | Governed due-in assignment, hostile/no-op/concurrency |
| Order 232 arrival roll and journey | **5/0, 41** | Due-in roll, rollback/replay/tenant boundaries |
| Order 203 readiness | **5/0, 69** | Checkout readiness derives actionable blockers |
| Order 204 checkout | **6/0, 68** | Open balance denies checkout with byte-equal zero write; exact-zero in-house and due-out checkout each releases exactly one sanctioned occupancy and writes the exact departure facts/events |
| Order 233 departure roll and journey | **5/0, 40** | Due-out roll, hostile/no-op/concurrency and checkout handoff |
| Order 201 lifecycle | **5/0, 35** | Housekeeping lifecycle transitions |
| Order 202 cadence sheets | **6/0, 25** | Daily deduplication, DST-sensitive `on_departure`, and fail-closed missing/mixed/weekly cadences |
| Order 227 initial condition | **6/0, 67** | Initial condition task creation boundary |
| Order 235 discrepancy integration | **9/0, 34** | Sleep, skip and person discrepancy rows/facts/events; matching report is a no-op; rollback/replay and 20-reporter convergence |
| Order 235 authority | **6/0, 52** | Hostile tenant/property/actor/raw-DML denial and zero-write behavior |

The checkout proof exercised every required denial snapshot: reservation not in a
departure state, missing/ambiguous current segment, missing/ambiguous physical room,
missing/ambiguous occupancy, missing folio window, unsettled window, and a settled
nonzero balance of 500. Each returned its exact actionable blocker and preserved the
full before/after database snapshot. Both exact-zero success variants moved the
reservation to `checked_out`, moved the segment to `departed`, left zero active
occupancies, released exactly one occupancy only through the sanctioned capability,
and left folio/journal/posting bytes unchanged.

In addition to the committed cadence proof, I created a custom-cadence fixture only
inside the disposable database and called the governed generator as
`yellow_runtime` with `SET LOCAL ROLE app_role`. An unsupported custom cadence failed
closed with SQLSTATE `0A000`; an overlapping active-profile ambiguity also failed
closed with `0A000`. Both left sheet, task, fact, event and idempotency counts exactly
`0/0/0/0/0`.

### Hostile boundaries and raw DML

- Order 212 travel lifecycle: **6/0, 26 assertions**.
- Order 213 arrival pickup automation: **7/0, 61 assertions**.
- Order 228 dispatch transition: **8/0, 49 assertions**.
- Order 229 room-cleaning automation: **9/0, 50 assertions**.
- Order 236 vehicle parking assignment: **5/0, 25 assertions**.
- Runtime direct-DML authority: **5/0, 117 assertions**.
- Security-definer containment: **3/0, 174 assertions**.

Together with the room-assignment, arrival/departure-roll and discrepancy suites,
these personally exercised wrong tenant, wrong property, wrong actor, stale state,
missing or mismatched linkage, replay, rollback, concurrency, and direct raw-DML
attempts. Protected occupancy writes remained limited to the sanctioned database
capabilities.

## Schema, seed, standing and referee

- Fresh seed acceptance: **24 pass, 0 fail, 111 assertions**, including Phase 6
  seed-specific checks and repeat-seed no-op behavior.
- Exact normalized fresh `pg_dump` matched `tests/schema/expected.sql` byte-for-byte
  after normalization. The live catalog contained **110 public tables and 59 applied
  migrations**; migration 0059 checksum was
  `b920169d3776ff8f9804b8273c27a35d750a704919f3f1012af50ec94166f2e8`.
- Complete standing `bun test`: **1,187 pass, 890 expected environment skips, 0
  fail, 18,388 assertions**, 2,077 tests across 384 files.
- TypeScript passed; import boundaries passed for **132 TypeScript files**; licence
  policy passed for **23 installed packages**; production audit found **0
  vulnerabilities**; `node --check operator.js` and `git diff --check` passed.
- On a second new disposable database, the repository referee passed **11/11**:
  concurrent single-room winner, private-room/bed exclusion, six independent bed
  claims, direct occupancy insert denied with SQLSTATE 42501, throughput, unbalanced
  journal rejection, balanced journal commit, sealed-day rejection, 100 gapless
  documents, table RLS isolation, and security-invoker view isolation.

The two failed initial attempts to invoke the schema helper used its repository-
hardcoded Compose endpoint rather than the reviewer database; they did not execute a
product assertion. The direct normalized dump comparison above is the exact isolated
schema proof. The first referee process completed its first case but its Windows
console could not encode a result glyph; rerunning on the second brand-new database
with UTF-8 output produced the complete **11 passed, 0 failed** result reported here.

### Reviewer command record

With `YELLOW_DEPLOY_DATABASE_URL`, `YELLOW_RUNTIME_DATABASE_URL` and, where required,
the registrar URL exported only to the disposable databases, I personally ran:

```text
bun test tests/stay-checkin.integration.test.ts
bun test tests/due-in-room-assignment.integration.test.ts
bun test tests/reservation-arrival-roll.integration.test.ts tests/reservation-arrival-roll-journey.integration.test.ts
bun test tests/stay-checkout-readiness.integration.test.ts tests/stay-checkout.integration.test.ts
bun test tests/reservation-departure-roll.integration.test.ts tests/reservation-departure-roll-journey.integration.test.ts
bun test tests/housekeeping-task-lifecycle.integration.test.ts tests/housekeeping-task-sheet-generation.integration.test.ts
bun test tests/housekeeping-discrepancy-reporting.domain.test.ts tests/housekeeping-discrepancy-reporting.integration.test.ts
bun test tests/housekeeping-discrepancy-authority.integration.test.ts
bun test tests/reservation-travel-capture.integration.test.ts tests/arrival-pickup-task-automation.integration.test.ts
bun test tests/arrival-pickup-task-dispatch.integration.test.ts tests/arrival-room-cleaning-task.integration.test.ts
bun test tests/vehicle-parking-assignment.integration.test.ts
bun test tests/runtime-dml-authority.integration.test.ts tests/security-definer-containment.integration.test.ts
YELLOW_REQUIRE_REVIEW_SEED=1 bun test tests/review-seed.integration.test.ts
YELLOW_REQUIRE_MIGRATION_DB=1 bun test tests/migrate.integration.test.ts
YELLOW_REQUIRE_DATABASE_ACCEPTANCE=1 bun test tests/database-acceptance.integration.test.ts
YELLOW_REQUIRE_RUNTIME_AUTHORITY_P0=1 bun test tests/runtime-database-authority.integration.test.ts
YELLOW_REQUIRE_ORDER299_DATABASE=1 bun test tests/extension-effective-period.integration.test.ts
bun test
bun run typecheck
bun run boundaries
bun run license-check
bun audit --production
node --check operator.js
git diff --check
PYTHONIOENCODING=utf-8 python tests/run_invariants.py yellow_referee342b
```

The exact focused results are recorded in the tables above; the three intentionally
red permanent-gate outcomes are recorded under the blocking finding.

## Ancestry, order scope and protected paths

I read `PROJECT.md`, ran `state.sh`, followed the Yellow compliance rules, and read
Order 342, the complete Phase 6 plan, and every Order 200–236. The first-parent chain
from the approved Phase 5 base through Order 236 is unbroken, and both the Phase 6 tip
`0708df1` and its base are ancestors of exact subject `91dd0cf`.

I inspected every individual Order 200–236 range and the aggregate Phase 6 range.
Changed paths stay within the recorded order scopes. No order changes `.yellow`,
environment credentials, Compose, setup authority, or `migrations/0001_init.sql`.
Static inspection found no TypeScript direct DML against protected insert-only tables;
sanctioned occupancy release is implemented in the governed migration capability.
The later migration 0039 search-path repair is present and the live definer audit is
green.

While this long-running review was executing, the shared branch acquired later commits
that change only Order 199 governance/review records. Exact subject `91dd0cf` remains
an ancestor, and `git diff 91dd0cf..HEAD -- migrations src tests package.json bun.lock`
was empty before this review record was committed. Those concurrent records do not
alter the exact product/test tree reviewed here.

## Boundary

**WITHHOLD** exact subject `91dd0cf73a6662825508f93d602ece246e1d4550`.
The Phase 6 journey behavior, schema, hostile boundaries, complete standing suite and
referee are green, but the mandatory exact-head migration, database-acceptance and
runtime-authority gates are red. This review grants no Phase-6-complete,
application-complete, merge, push or deployment authority. No product or test file was
modified by this reviewer.
