# QUESTION 014 — Order 022 migration makes schema accounting stale

**Status:** RESOLVED
**Phase:** 1 · **Order:** 022 · **Branch:** `phase-1/eventbus-outbox-consumer`
**Raised by:** Codex (builder) · **Date:** 2026-08-15

## Conflict

D-94 authorizes two new platform tables in `0002_kernel_consumer_cursor.sql`, but Order
022 Scope omits the migration and every derived schema-accounting artifact. A correct
migration would therefore make the mandatory self-check fail:

- `setup.sh` and `setup.ps1` require exactly 81 public tables;
- `state.sh` and `state.ps1` report 81 as expected;
- `tests/schema/expected.sql` contains only the baseline plus migration ledger; and
- `docs/WALKTHROUGH-WINDOWS.html` tells the founder to expect 81.

The new exact count is 83: 80 immutable baseline tables, 2 kernel consumer tables, and
`schema_migration`.

## Decision requested

May Order 022 Scope include the authorized migration and only those derived artifacts,
with the schema snapshot regenerated from a fresh database through the production
runner? May its Forbidden section be narrowed so only this new migration is writable?

## RESOLVED

Answered **YES** by `handoff/questions/014-ARCHITECT-RESPONSE.md` under D-95.
