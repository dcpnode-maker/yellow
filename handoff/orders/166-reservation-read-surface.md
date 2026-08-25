# Order 166 — Reservation board and detail read surface

**Status:** BUILT-UNREVIEWED — prerequisite for the real reservation workbench
**Phase:** 5 · human-testable application
**Branch:** `phase-5/reservation-read-surface`
**Base:** `c0fa84d` (Order165 candidate plus approved Order164 evidence; Order165 review remains prerequisite)
**Risk tier:** 3 — tenant/property-scoped reservation and Party reads
**Owner:** Codex implementation; independent non-implementing Tier-3 review

## Outcome

Integrate the already independently approved, unintegrated Order141 reservation-detail
aggregate and expose one bounded reservation board plus one aggregate detail endpoint.
This supplies truthful server data for the next lightweight list/drawer UI without
adding a mutation, schema object, permission or second source of truth.

## Scope

- exact approved Order141 product/test/governance/review files from `9397c141`;
- `docs/CONTRACTS.md`;
- new `src/contexts/reservations/board.ts`;
- `src/contexts/reservations/detail.ts` only for an exact UUID lookup extension if the
  approved confirmation lookup cannot safely serve a deep link;
- `src/contexts/reservations/index.ts`;
- `src/http/operator.ts`;
- `src/app.ts`;
- `src/server.ts`;
- new `tests/reservation-board.integration.test.ts`;
- new `tests/operator-reservation-read-surface.integration.test.ts`;
- inherited `tests/reservation-detail.integration.test.ts`;
- this order, additive D-433, `handoff/LEDGER.md`, and one additive review.

No HTML/CSS/JavaScript, schema, migration, index, grant, seed, state transition, event,
write, lock, occupancy, journal/payment/fiscal behavior, dependency, credential or local
runtime replacement is in scope. Stop and write a question before widening it.

## Required behavior

1. Import Order141 exactly, preserving all hostile stored-reference, tenant/property,
   range, Party, account, task and fact-predecessor guards and its immutable approval.
2. Add one read-only service that lists at most 100 reservations per call (default 50)
   in deterministic `created_at DESC, id DESC` order with a canonical opaque cursor.
   Offset pagination is forbidden.
3. Accept only strict non-PII filters: optional reservation status and optional bounded
   stay-overlap `from`/`to`. Guest names, contacts and arbitrary search text never enter
   a GET URL. Existing exact-confirmation lookup remains byte-compatible.
4. Each row contains only reservation id/reference/status, primary guest display name,
   current stay bounds, latest unit type/sellable/rate labels, adults/child count,
   channel/currency and created time. Contacts, identity documents, notes, history,
   payment/tax and invented totals are absent.
5. Add a UUID-addressed aggregate detail endpoint for canonical
   `/p/{property}/res/{reservation}` deep links. Foreign tenant/property/missing records
   are indistinguishable not-found responses. The endpoint returns the approved Order141
   aggregate and server-derived existing lifecycle actions without client inference.
6. All reads execute inside the caller's transaction-local tenant context, use bounded
   set-wise SQL with tenant-leading predicates, create zero artifacts, and behave the
   same with production-style `prepare: false` connections.

## Proof

- exact Order141 patch/blob/review identity and ancestry evidence;
- tied-timestamp multi-page completeness with no duplicates/omissions, strict malformed
  cursor/filter/limit denial, default/max bounds and deterministic repeated reads;
- two tenants and two properties proving list/detail isolation, generic not-found,
  no contact leakage and unchanged exact-confirmation behavior;
- query-plan/bounded-work evidence, zero before/after mutation cardinality, and
  production-style unprepared parity;
- focused board/detail/operator suites, standing tests, typecheck, boundaries, licences,
  audit, schema/protected hashes and fresh referee 11/11;
- independent non-implementing Tier-3 reviewer personally executes the proof.

## Forbidden

- Guest/contact query strings, OFFSET, unbounded rows, N+1 list queries, JSON extraction
  predicates, RLS bypass, duplicated Order141 joins, client-derived actions, mock data,
  write/event/schema/permission changes, merge, push, deployment, self-review or self-merge.

## Definition of done

- [x] One bounded board page and one UUID detail surface are tenant/property safe.
- [x] Approved Order141 guards remain intact and existing lookup stays compatible.
- [ ] Full Tier-3 proof passes on one immutable independently approved candidate.

## Builder evidence — 2026-08-26

- Integrated the exact ten-commit approved Order141 series `55f5fbd..9397c14` as
  `7591fad..84fe6a1`. `git range-diff` reports exact product commits except additive
  ledger context in the three evidence commits; the approved review blob is
  byte-identical (`4c057cfa43164e4f0caf122c0c846eef7de1ba8e`), as are the Order141 order,
  backlog and final approved source/test blobs before this order's explicitly scoped
  UUID extension. Integrated prerequisite Order165 independent approval `652aa03` as
  `0a4201d`, preserving all current ledger entries.
- Production-style `prepare:false` focused execution passed 14/14 with 113 assertions:
  board 3/3, approved detail plus UUID extension 6/6, and real operator HTTP 5/5.
  It proves tied timestamps over pages, canonical cursor rejection, default/max limits,
  bounded paired overlap, status filtering, deterministic repeats, two-property and
  two-tenant/RLS isolation across the combined inherited fixture, generic UUID
  not-found, no contact leakage, exact-confirmation compatibility, canonical deep link,
  zero reservation mutations and one set-wise `LIMIT` query with no `OFFSET` or contact
  join. The first unprepared run exposed a Bun Date binding failure; converting validated
  dates to canonical ISO parameters fixed it, and the real unprepared proof then passed.
- Standing `bun test`: 190 passed, 471 skipped, 0 failed, 2,206 assertions. Typecheck,
  66-file import boundaries, 23-package licence policy, `bun audit`, image/JWT security,
  `git diff --check`, and exact live schema all pass. Protected hashes remain exact:
  `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`
  (`0001`), `2afa95bb7c02cd9637ffc9c3df00d1ddf7cfc5d8d31c4fd8fad29b950c1a418d`
  (referee), `bf71d8fc2987126db61ca3105e5d5cb5a4f48b9e2eba09d8b7fc1f3441fd4c62`
  (fixture), and `df2d78c5d65545acb04529aacc1af1cfe18a5fece1047ce1dde104c9597c1edf`
  (expected schema).
- The Windows DB-only wrapper created healthy isolated PostgreSQL/Valkey resources on
  app port 3011 but its first readiness loop expired during initialization; its retry
  then stopped at `Set-Acl` because the host lacks `SeSecurityPrivilege`. With secrets
  kept redacted, the equivalent isolated provision/migrate/seed/schema sequence was run
  directly. A pristine recreated 17-migration/85-table database passed the protected
  referee `11 passed, 0 failed of 11`. An earlier encoding-aborted run and its
  contaminated 10/11 retry are explicitly discarded, not represented as proof.

Builder work stops at this candidate. Independent non-implementing Tier-3 review must
personally execute the proof before approval; no merge, push or deployment is claimed.
