# Order 141 — Reservation detail and history read model

**Phase:** 4 — Reservations  
**Branch:** `phase-4/reservation-detail-read-model`  
**Base:** approved integration `952478d17bcebd67e696d5cb76eec37e89cabcf3`  
**Risk tier:** 1 — migration-free, read-only context query  
**Owner:** Codex builder; stop at builder-green/unintegrated  
**Date:** 2026-08-25  
**Status:** BUILT · UNREVIEWED · UNINTEGRATED

## Outcome

Provide one tenant/property-scoped, exact-confirmation reservation read model that returns
the existing reservation, immutable segment history, guest/share membership, folio-window
visibility, travel/alert detail, and chronological append-only facts without adding a route,
permission, UI, mutation, schema object or runtime wiring.

## Why now

`docs/FULL-HOTEL-UAT.md` UAT-03 is blocked on a coherent detail/history aggregate even
though the underlying approved contracts already exist. This is the earliest independent
full-hotel slice that does not overlap the Cyber chain, finance mutation, live workbench,
occupancy, tenant-policy, migration or status-runtime lanes.

## Scope

- `src/contexts/reservations/detail.ts`
- `src/contexts/reservations/index.ts`
- `tests/reservation-detail.integration.test.ts`
- `handoff/orders/141-reservation-detail-history-read-model.md`
- `handoff/FULL-HOTEL-UAT-BACKLOG.md`
- `handoff/LEDGER.md` only for builder evidence
- `handoff/questions/` only if an assertion or undocumented product ambiguity stops work

Anything else is out of scope.

## Required work

1. Export `ReservationDetailService`, its input/result types, validation error and
   not-found error through the reservations context index.
2. Accept only server-derived tenant UUID, property UUID and a canonical exact
   confirmation number (1–120 printable non-space characters).
3. In the caller's existing tenant transaction, read exactly one property reservation
   and return frozen deterministic collections for:
   - reservation status, channel/codes/currency, ETA/ETD, notes and cancellation detail;
   - every segment in sequence order with exact ISO period bounds, adults, child ages,
     rate plan, assigned sellable unit, price override and status;
   - primary/accompanying/sharer Party id, display name, role and exact decimal share;
   - reservation folios with account, folio number/window/name/status;
   - active/inactive alerts and arrival/departure travel rows;
   - reservation and segment `fact_log` rows in recorded order, including actor,
     business date, whole payload, supersession and request correlation when present.
4. Read whole JSONB values; do not use JSON extraction in a predicate. Perform no write,
   lock, external call, event publication or cache mutation.
5. Hide foreign tenant/property/nonexistent confirmations behind the same not-found error.
   Treat malformed stored rows as a conflict/error rather than inventing values.

## Forbidden

- Any migration, DDL, RLS/grant/permission/auth/tenant change or new table/view/function
- Any route, app/server wiring, operator HTML/CSS/JavaScript, project-status or live runtime
- Any INSERT/UPDATE/DELETE, row lock, occupancy, state transition, fact/outbox publication,
  journal/posting/payment/tax/fiscal/document or housekeeping mutation
- Reconstructing current state from facts, mutating/sanitising stored payloads, querying
  indexed JSONB with `->>` in `WHERE`, or treating folio visibility as payment authority
- Editing protected referee files, package/lock files, Compose/CI, applied migrations or
  any file outside Scope
- Self-review, merge, push, deployment or an end-to-end/full-UAT completion claim

## Pre-registered proof

### P0 — intentional red

Commit this order, the ordered successor backlog and a focused test importing the planned
public surface before production code. It fails only because that export is absent.

### P1 — complete deterministic aggregate

A seeded reservation returns exact reservation fields, ordered segments, guest identities
and shares, folios, travel, alerts and chronological facts with exact bigint/decimal/JSON
representations and no database changes across repeated reads.

### P2 — tenant/property and input boundaries

Malformed UUID/confirmation input fails before SQL; foreign tenant, foreign property and
missing confirmation are indistinguishable not-found results. Tenant B cannot observe
tenant A through Party, folio, travel, alert or fact joins.

### P3 — honest append-only history

Facts for the reservation and all its segments are returned in stable recorded/id order,
whole payload and supersession are preserved, request correlation is derived only from an
existing string payload field, and unrelated entity facts remain absent.

### P4 — standing builder gate

Focused proof, typecheck, boundaries, standing tests, licence check, audit, schema check and
fresh `./setup.sh --db-only` referee `11/11` pass. Stop builder-green/unintegrated; an
independent non-implementer may review later.

## Rollback

Revert the Order 141 commits. No schema, runtime wiring or persisted data changes exist.

## Evidence required at handoff

Exact base SHA, executable SHA, file list, focused test command/result, standing gate
commands/results, protected-surface confirmation and any inherited precondition or risk.

## BUILT — UNREVIEWED

- Base: `952478d17bcebd67e696d5cb76eec37e89cabcf3`.
- Intentional-red registration: `55f5fbd0b6cb1e223ddd34242c972f3874b7a0c1`;
  the public export was absent before implementation.
- Exact executable: `b8d50a0166299964ad3acf1c7a78e4a982ca0474`.
- Product/test files: `src/contexts/reservations/detail.ts`, the reservations public
  index, and the focused integration proof only. No schema, migration, permission,
  route, runtime, UI, dependency, protected referee or financial mutation changed.
- Fresh PostgreSQL focused proof:
  `YELLOW_REQUIRE_RESERVATION_DETAIL=1 YELLOW_RESERVATION_DETAIL_URL=... bun test
  tests/reservation-detail.integration.test.ts` → 5 passed, 0 failed, 37 assertions.
- Standing gate: frozen install unchanged; typecheck green; 64-file import boundary
  gate green; `bun test` 150 passed, 397 skipped, 0 failed, 1,832 assertions; licence
  policy passed for 23 installed packages; audit found no vulnerabilities; schema
  matches `tests/schema/expected.sql`; fresh Windows DB-only setup applied all eleven
  migrations to 85 tables and the protected referee passed 11/11.
- The Unix wrapper stopped before assertions because Git Bash did not expose the
  installed Bun executable; the repository-equivalent PowerShell setup ran the full
  fresh-database proof. No assertion was weakened or called green from the stopped run.

Builder work stops here. Independent review, merge, push, deployment, HTTP/UI wiring
and full-UAT completion are not claimed.
