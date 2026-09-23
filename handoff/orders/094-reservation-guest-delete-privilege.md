# Order 094 — Reservation-guest DELETE privilege

**Phase:** 4 — Reservations  
**Tier:** 3 — forward migration, runtime-role privilege and tenant-isolation proof  
**Branch:** `phase-4/reservation-guest-delete-privilege`  
**Base:** Order 093 at `142d19f`  
**Written by:** Codex primary implementation owner  
**Date:** 2026-08-24  
**Status:** COMPLETE · INDEPENDENTLY APPROVED

## Goal

Authorize the existing tenant runtime role to delete `reservation_guest` rows through
one forward migration, with executable proof that the grant is limited to that table
and RLS prevents cross-tenant deletion.

## Why now

Phase 4 still requires exact reservation guest/share allocation. The existing
`reservation_guest` table is the canonical and sufficient entity, but its runtime ACL
permits `SELECT`, `INSERT`, and `UPDATE` only. Exact replacement cannot truthfully
remove an accompanying guest and previously stopped with SQLSTATE `42501` (historical
Question 132). This Tier-3 solo gate resolves only that database prerequisite before a
separate Order 095 implements any reservation command.

## Natural-Solution Test

`reservation_guest` is not an insert-only table and already has the correct tenant RLS
policy, primary key, party relationship, roles, and `share_pct`. A narrowly scoped
`DELETE` grant to `app_role` reuses that entity and the established transaction-local
tenant boundary. No new table, state, event, SECURITY DEFINER function, soft-delete
flag, sentinel party, or second membership store is needed.

The future command remains responsible for locking one reservation, preserving its
primary guest, and deleting only absent non-primary rows. This order grants the
necessary SQL capability but exposes no product mutation surface.

## Scope — files Codex may create or change

- `migrations/0007_reservation_guest_delete_privilege.sql`
- `tests/reservation-guest-privilege.integration.test.ts`
- `tests/database-acceptance.integration.test.ts`
- `tests/schema/expected.sql`
- `src/project-status.ts`
- `tests/founder-status.integration.test.ts`
- `handoff/orders/094-reservation-guest-delete-privilege.md`
- `handoff/PHASE-4-PLAN.md`
- `DECISIONS.log`
- `handoff/LEDGER.md`
- `handoff/questions/` if an assertion or undocumented ambiguity stops the order
- the new independent review record for this order

## Contracts to honour

- `PROJECT.md` invariants 3, 5 and 9
- `docs/YELLOW-CONSTITUTION.md` guest/profile and shared-command boundaries
- `docs/ARCHITECTURE-V1.md` database, authorization and migration guidance
- `docs/CONTRACTS.md` §§1, 3 and 4
- `docs/STATE-MACHINES.md` §1 (unchanged)
- `yellow-entity-patterns` Natural-Solution Test and existing-entity rule
- `yellow-postgres-patterns` RLS, runtime-role and forward-migration rules
- D-73 migration checksum discipline, D-275/D-293 Phase-4 sequencing, D-294 review
  discharge, D-295 evidence-derived status, and historical Question 132

## Required work

1. Add migration `0007_reservation_guest_delete_privilege.sql`:
   - revoke `DELETE` on `reservation_guest` from `PUBLIC`;
   - grant `DELETE` only to `app_role` when that role exists;
   - do not change the table, its RLS policy, or any other privilege.
2. Add a focused real-PostgreSQL proof that:
   - `app_role` has `DELETE` only on `reservation_guest` among protected comparison
     tables and `PUBLIC` has none;
   - transaction-local tenant A context plus `SET LOCAL ROLE app_role` deletes a
     same-tenant non-primary row;
   - the same statement targeting tenant B returns zero rows and the foreign row
     remains;
   - rollback restores the local row, proving the test itself leaves no mutation.
3. Append version 7 and its exact SHA-256 checksum to the deployment migration-ledger
   acceptance contract and regenerate the schema snapshot through the migration runner.
4. Advance the recorded build snapshot to Order 094 without changing the continuous
   independently-reviewed boundary of Order 091 or Phase-4 `active` state.
5. Run the full standing gate and fresh app-never-started referee, then obtain an
   independent non-implementing review that personally executes the privilege and
   cross-tenant proof.

## Pre-registered proof

### P0 — intentional red

Commit this order and the focused proof before the migration exists. On a fresh
six-migration database, `has_table_privilege('app_role', 'reservation_guest',
'DELETE')` must be false and the app-role delete must fail with SQLSTATE `42501`.

Observed on fresh Compose project `yellow-order094-red`, database
`yellow_order094`: **0 pass, 2 fail**. P1 received
`reservation_guest_delete: false` while every protected comparison remained false;
P2 reached PostgreSQL and failed with SQLSTATE `42501`. No migration existed.

### P1 — exact ACL

After migration, `app_role` has DELETE on `reservation_guest`; `PUBLIC` does not.
`space_occupancy`, `fact_log`, `outbox`, `journal`, and `posting_line` retain their
existing DELETE denial. No unrelated ACL changes appear in schema drift.

### P2 — tenant isolation

One app-role transaction with tenant A context targets tenant A and B reservation
guest rows. Only tenant A's non-primary row is returned as deleted. Tenant B remains
present when checked by the deployment role, and rolling back restores tenant A.

### P3 — deployment and invariants

Fresh migration acceptance includes versions 1–7 with exact checksums; schema drift is
empty; frozen install, typecheck, boundaries, default tests, licence and audit pass;
fresh isolated `./setup.sh --db-only` prints `11 passed, 0 failed of 11`.

## Forbidden

- Editing `migrations/0001_init.sql` or any applied migration
- Any `src/contexts/*`, HTTP, UI, worker, guest/share command, alert or waitlist change
- A new table, column, state, transition, event, policy, function, trigger or index
- DELETE privilege on any table except `reservation_guest`
- Disabling, bypassing or weakening RLS; session-scoped tenant context; owner-role
  application queries
- Deleting primary guests in tests or introducing a general-purpose deletion API
- Modifying insert-only records, occupancy logic, journals, payments, fiscal/tax or
  statutory behavior
- Self-reviewing, self-merging, or claiming builder proof as independent review

## Definition of done

- [x] Intentional red is committed and records missing privilege/SQLSTATE 42501.
- [x] Migration grants only the named privilege and has an exact ledger checksum.
- [x] Focused ACL and cross-tenant deletion proof passes on fresh PostgreSQL.
- [x] Deployment acceptance, schema drift and protected privilege comparisons pass.
- [x] Project status reports Order 094, Phase 4 active and review-through Order 091.
- [x] Full standing gate and fresh referee pass at 11/11.
- [x] Independent non-implementing reviewer personally executes P1/P2 and approves.
- [x] No file outside Scope changes; pre-existing untracked user material is preserved.

## Builder evidence

The implementation adds only migration 0007's `reservation_guest` DELETE ACL and its
derived acceptance/status artifacts. Its SHA-256 is
`b39b67ed47e83f348f88dfa892dc5c6df75014822b2bf1084c97c51d2c6571db`.
On disposable PostgreSQL `yellow_order094`, P1/P2 passed **2/2** with three exact
assertions; deployment acceptance passed **4/4**; schema drift is exact and contains
only the expected reservation-guest ACL delta. The restarted standing gate passed
typecheck, 58-file import boundaries, **120/120** default tests with 1,544 assertions,
23-package licence policy and zero-vulnerability audit. Fresh isolated Compose project
`yellow-order094-final` applied migrations 1-7 and the app-never-started referee printed
**11 passed, 0 failed of 11**. Builder evidence is not independent approval.

Independent review at `d5a686d` reproduced P1/P2 on a separate fresh database,
verified the exact ACL/schema/ledger and protected hashes, reran the standing suite and
a second 11/11 referee, and returned **APPROVED**. See
`handoff/reviews/094-reservation-guest-delete-privilege.md`.

---

## MERGED

Prepared for the founder-authorized cumulative integration from exact reviewed frontier `bc22a9d`. This marker becomes true when the cumulative integration PR lands in `main`; review provenance remains in `handoff/reviews/` and `handoff/LEDGER.md`.
