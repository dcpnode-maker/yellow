# Order 077 — Two-operator rate-publication approval inbox

**Phase:** 3 · Rates and policies  
**Branch:** `phase-3/rate-approval-inbox`  
**Tier:** 3 — authenticated four-eyes decision and publication authority  
**Written by:** OpenAI Codex, autonomous temporary architect under D-92/D-115/D-221/D-267

## Outcome

Complete the existing rate-publication journey for real hotel operators. A requester can send one
exact immutable draft and preview for approval; a different, property-authorized operator can find
that request in a bounded inbox, approve or reject it, and only the operator who approved it can use
the unchanged publication command. The workbench must make the separation visible without placing
approval, plan matching, pagination or publication authority in the browser.

## Natural-Solution Test

Order 025 already provides the only approval primitive and its terminal pending-to-approved,
pending-to-rejected and pending-to-expired transitions. Order 069 already binds a rate approval to
the exact release, canonical preview payload and content/preview hashes, and already requires the
publishing actor to equal `approval_request.decided_by`. The missing work is discovery and transport:
there is no plan-scoped approval read, no authenticated decision route, no second deterministic local
reviewer and no workbench inbox. Reuse `approval_request`, `ApprovalService.decide`, the existing
`approval.decided` event, existing rate write scope and existing property grant. Add only one
forward index so a cursor-paginated inbox does not scan tenant approval history. No new table,
extension type, state, event, permission or publication path is needed.

## Scope

- `migrations/0006_rate_release_approval_lookup.sql` — new forward migration only
- `src/contexts/rates/publication.ts`
- `src/http/operator.ts`
- `src/app.ts`
- `src/http/operator/index.html`
- `src/http/operator/operator.js`
- `src/http/operator/operator.css`
- `scripts/seed-review.ts`
- `tests/review-seed.integration.test.ts`
- `tests/rate-publication.integration.test.ts`
- `tests/operator-rate-builder.integration.test.ts`
- `tests/operator-assets-security.test.ts`
- `tests/schema/expected.sql` only as the exact generated mirror of migration 0006 per Question 126
- `tests/database-acceptance.integration.test.ts` only for the exact migration-0006 ledger entry per
  Question 127
- `docs/CONTRACTS.md`
- `docs/UI-SPEC.md`
- `docs/LOCAL-REVIEW.md`
- `src/project-status.ts` only for exact completed-order and Gate-3 debt counters
- `tests/founder-status.integration.test.ts` only for exact current-order assertions
- `handoff/orders/077-rate-publication-approval-inbox.md`
- `DECISIONS.log`
- `handoff/LEDGER.md`
- `handoff/GATE-3-MANIFEST.md`
- further numbered D-92 question/response files only if a hard-floor condition occurs

## Required work

1. Add forward migration `0006_rate_release_approval_lookup.sql`; do not edit an applied migration.
   Create one partial B-tree whose leading column is `tenant_id`, followed by canonical
   `payload->>'rate_plan_id'`, then `created_at DESC, id DESC`, restricted to
   `kind = 'rate_plan_release' AND subject_type = 'extension'`. This supports exact plan scope and
   keyset pagination without casting untrusted historical JSON or using `OFFSET`.
2. Add a rate-publication list method that accepts an exact rate-plan id, an optional opaque
   `(created_at,id)` cursor and a bounded limit (default 50, maximum 100). It must query inside the
   transaction-local tenant context, join each subject to the exact same-tenant
   `rate_plan_release` extension and exact `rate-plan:<id>` key, return newest first, fetch at most
   `limit + 1`, and emit `nextCursor` only when more rows exist. Invalid cursors fail closed. Return
   safe approval/release status, version, requester/decider display names and timestamps; never raw
   payload, tenant ids, hashes, SQL, audit envelopes or database metadata.
3. Add an exact rate-publication decision method. Lock and verify that the approval belongs to the
   requested property/plan/release and is still pending, then delegate `approved` or `rejected` to
   the existing `ApprovalService.decide` in the same transaction. Human decisions use the
   authenticated actor and audit operation `rate_plan_release.approval_decided`; self-approval,
   wrong-plan/wrong-tenant/wrong-property ids, terminal re-decisions and concurrent second decisions
   fail without mutation. Do not expose `expired` as a human action and do not create a new event.
4. Add authenticated `GET .../rate-builder/:ratePlanId/approvals` and idempotent
   `POST .../rate-builder/:ratePlanId/approvals/:approvalId/decision` routes. Both require the
   existing rate-configuration write scope and property grant. The GET accepts only `after` and
   `limit`; the POST accepts only `{ decision: "approved" | "rejected" }` and an
   `Idempotency-Key`. Responses derive `canDecide` and `canPublish` on the server from the current
   actor, request status, requester/decider identity and release status. Replays return the stored
   response; request-shape, auth, scope, property, conflict and service failures preserve the
   existing generic HTTP contract.
5. Replace the Step-5 pasted approval-id workflow with an approval inbox using the existing design
   system. Show requester, immutable release version, status and decision time; expose Approve and
   Reject only when server `canDecide` is true; expose Publish only for the server-selected row whose
   `canPublish` is true and only after this browser session has a fresh server simulation for the
   same release. The requester sees a waiting state and cannot approve or publish. Refresh after
   request or decision, but never poll, preview, approve, reject or publish automatically.
6. Extend the idempotent local-review seed with a second deterministic active app user,
   `approver@yellow.local`, sharing only the existing operator role, scope node and property grant.
   Require a distinct `YELLOW_REVIEW_APPROVER_PASSWORD` at the CLI boundary; neither password may be
   hard-coded, logged or stored in browser storage. Re-running with identical secrets is a no-op;
   either divergent secret fails the whole transaction without partially changing the seed.
7. Prove the complete two-actor path through production HTTP: requester creates and simulates an
   exact draft, requests approval, and cannot decide it; approver lists it, approves it once, reruns
   the exact server preview and publishes it; requester cannot publish; a rejected request cannot
   publish; wrong property/plan/tenant, malformed cursor/body, missing scope and concurrent decisions
   fail closed. Assert one existing `approval.decided` outbox event and one approval decision fact,
   with no duplicate effects on idempotent replay.
8. Update the local-review and operator contracts, then advance exact founder snapshot/manifest
   counters only after focused and standing proofs are green. Record Order 077 as `UNVERIFIED`; this
   builder work is not independent review.

## Forbidden

- Any edit to `migrations/0001_init.sql` through `0005_projection_replace_privilege.sql`,
  `tests/run_invariants.py`, protected referee logic, applied migration history or dependencies
- A new table, extension type, approval state/transition, permission, role kind, event, worker,
  cache, provider, publication path or browser persistence
- Any change to approval payload identity, preview/content hashes, exact release checks,
  `decided_by = publishing actor`, pricing/evaluator/composition/RMS behavior, restriction,
  availability, occupancy, tax, fiscal, journal, RLS, tenant context or audit/outbox semantics
- `OFFSET`, an unbounded approval query, a tenant-wide scan hidden behind a large limit, a browser-
  generated cursor, browser-computed `canDecide`/`canPublish`, raw approval payload or hash exposure
- Self/auto approval, automatic preview/publication, requester publication through another actor's
  decision, generic admin override, terminal re-open, or changing history in place
- Treating hotel configurability as permission to disable four-eyes separation, immutable history,
  exact money, statutory/tax obligations or constitutional safeguards
- Recreating or reseeding the persistent founder stack before focused proofs are green. Afterward,
  apply the forward migration and idempotent second-user seed without removing existing founder data
- Approval, independent Gate-3 review, merge or relabelling builder evidence as reviewed by Codex

## Pre-registered proof

- **P0 — intentional red:** before production edits, on a fresh migrated database, require the exact
  partial tenant-leading approval index, require two deterministic review users with distinct tokens,
  and run a two-actor HTTP approval scenario. The current database has no lookup index, the seed
  returns one user, and both approval-list/decision routes return 404. Commit the exact red output
  before implementation.
- **P1 — migration and bounded read:** fresh 0001–0006 application plus schema-drift proof confirms
  the exact partial index definition. Seed approvals across tenants, plans, releases and identical
  timestamps; keyset pages are stable, bounded, newest-first, disjoint and complete, while malformed
  cursors and limit/plan mismatches fail closed.
- **P2 — approval authority:** focused publication proof pins exact subject/property/plan locking,
  pending-only transition, self-approval refusal, one-winner concurrency, existing fact/event bytes,
  rejected/terminal behavior and the unchanged rule that only `decided_by` may publish the approved
  exact release/preview.
- **P3 — authenticated two-actor HTTP:** fresh migrated and review-seeded database proves two distinct
  JWT subjects with the same bounded property role. Requester gets waiting/non-decision transport;
  approver gets decision authority, exact idempotent replay and publish authority only after approval;
  cross-tenant/property/plan, missing scope, malformed body/cursor and stale preview cases are generic
  failures with no extra rows, facts, events or releases.
- **P4 — browser security and UX:** always-on assets require the inbox, explicit waiting/approve/
  reject/publish states, safe text output, fresh-simulation binding, no editable approval id, no SQL,
  no browser authority/storage and no automatic decision/publication escape hatch.
- **P5 — live founder workflow:** without removing existing data, migrate and seed the second user.
  Request one harmless draft approval as `operator@yellow.local`, sign in as
  `approver@yellow.local`, approve it through the inbox, rerun preview and confirm Publish becomes
  available only to the approver. Do not publish the founder proof draft. Console remains empty and
  system status remains operational.
- **P6 — standing gate:** frozen install, state, typecheck, boundaries, complete default tests,
  licence audit, dependency audit, schema drift, protected hashes and fresh isolated app-never-started
  referee all remain green. Refresh Graphify as a derived map and report parser/semantic limits.

## Captured P0

Three separate freshly migrated databases in Compose project `yellow-order-077-red`, before any
production or migration edit:

```text
rate-publication: approval_request_rate_release_plan_cursor
Expected length: 1
Received length: 0
9 pass, 1 fail, 64 expect() calls

review-seed: [approver@yellow.local, operator@yellow.local]
Received: [operator@yellow.local]
5 pass, 1 fail, 15 expect() calls

operator-rate-builder: GET .../approvals
Expected status: 200
Received status: 404
9 pass, 1 fail, 52 expect() calls
```

The failed migration role race during parallel disposable-database preparation was a healed setup
precondition: the two affected untouched databases were migrated sequentially from the top before
the tests above. No assertion, expected value, production file or migration was changed.

## Standing and handoff

Commit this order and D-267 before writing P0. Commit the failing proof without production changes,
then implement in bounded slices: migration/read service, decision/HTTP, seed/UI, documentation and
status. Any assertion red after implementation restarts the complete focused suite; do not weaken a
proof. Do not touch the persistent founder database until P1–P4 are green. Finish with an isolated
referee project whose app is never created, then migrate/seed the persistent stack in place, perform
the two-account browser proof without publication, refresh Graphify, push a stacked draft PR based on
Order 076's branch, and do not approve or merge.

## Builder evidence — UNVERIFIED

This section records builder-executed evidence only. Independent review remains complete through
Order 044. Claude's Gate-3 review of Orders 045–073 found F11 and F12; Order 074 contains both
corrections and its focused proofs are green, but the corrected descendant range has not yet been
independently re-reviewed.

- **P1–P4 focused:** fresh isolated databases produced 11/11 publication tests (86 assertions),
  7/7 review-seed tests (23 assertions), 11/11 authenticated operator-rate-builder tests
  (75 assertions), 3/3 always-on asset tests (41 assertions), exact schema drift, green typecheck,
  and green JavaScript syntax checking. The schema gate first failed because the order omitted the
  generated schema mirror; Question 126/D-268 added only `tests/schema/expected.sql`, whose inspected
  delta is the single migration-0006 index, and the entire gate restarted from the top.
- **P5 deployed workflow:** the persistent PostgreSQL and Valkey container identities were preserved;
  migration 0006 and the idempotent second-user seed were applied in place. Requester
  `operator@yellow.local` created approval `413c7d34-8e38-483b-a961-ead3a91e24c9`; self-decision
  returned 409. Distinct approver `approver@yellow.local` listed and approved it; server authority
  then reported `canPublish=true` only for the approver and `false` for the requester. Release
  `7c5b2631-3ef5-47dd-ae43-174a04ec7077` remains `draft` version 4, so the founder proof published
  nothing. The deployed app is healthy and serves the approval-inbox asset. Codex's bound in-app
  browser blocks loopback URLs with `ERR_BLOCKED_BY_CLIENT`, so no claim is made for a tool-captured
  visual/console proof; the production HTTP flow and always-on asset/security proof are green, and
  the founder can inspect the unchanged persistent localhost stack directly.
- **P6 standing gate:** `bun install --frozen-lockfile` made no changes; state reported zero open
  questions; typecheck, 49-file import-boundary scan, complete default suite (89 pass, 297 skip,
  0 fail, 1,133 assertions), 23-package licence check, dependency audit (zero vulnerabilities),
  schema drift, and protected hashes were green. Fresh isolated Compose project
  `yellow-o77-referee` used explicit non-conflicting ports, never created `app`, and returned
  `11 passed, 0 failed of 11` before its volumes were removed. Graphify was incrementally refreshed
  to 4,925 nodes, 8,031 directed edges and 574 communities after installing the free SQL parser;
  diagnostics show zero missing, dangling or directed-collapsed edges, 10 self-loops, 24 surfaced
  semantic-ID collisions, and 41 no-output semantic files deliberately requeued for a future pass.
  Subagent token counts were not exposed by the runtime, so the cost record marks that run's count
  unavailable instead of inventing a number.
- **P6 deployment-ledger correction:** PR 58's first database job correctly applied migration 0006
  but exposed a stale exact-ledger acceptance array ending at migration 0005. Question 127/D-269
  authorized only the exact version/filename/checksum entry in
  `tests/database-acceptance.integration.test.ts`. A fresh isolated database then applied all six
  migrations, seeded from zero and passed 4/4 deployment-acceptance tests with 10 assertions before
  its project and volume were removed. The pushed descendant must have all four CI jobs green before
  it is reviewable.
- **Protected hashes:** `migrations/0001_init.sql`
  `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`;
  `tests/run_invariants.py`
  `3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1`.

---

## MERGED

Prepared for the founder-authorized cumulative integration from exact reviewed frontier `bc22a9d`. This marker becomes true when the cumulative integration PR lands in `main`; review provenance remains in `handoff/reviews/` and `handoff/LEDGER.md`.
