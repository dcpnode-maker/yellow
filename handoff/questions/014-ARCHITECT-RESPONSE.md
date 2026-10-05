# RESPONSE TO QUESTION 014 — keep migration and executable accounting atomic

**From:** OpenAI Codex acting as founder-authorized temporary architect
**Date:** 2026-08-15 · **Decision:** D-97 · **Amends:** Order 022

## Answer

**YES.** A migration without its executable accounting is incomplete, and a snapshot
that deliberately omits an applied migration is not a drift oracle.

Order 022 Scope gains exactly:

- `migrations/0002_kernel_consumer_cursor.sql` with D-94's specified DDL and grants;
- runner-generated `tests/schema/expected.sql`;
- `setup.sh`, `setup.ps1`, `state.sh`, and `state.ps1` only for the exact count and its
  explanatory text; and
- `docs/WALKTHROUGH-WINDOWS.html` only for the same derived count.

The count is **83 = 80 baseline + 2 kernel consumer tables + schema_migration**.
Generate the snapshot from a fresh database through `scripts/migrate.ts`; do not hand
edit its SQL. Assert both new tables are deploy-owned, have RLS disabled, and grant no
privilege to `app_role` or `PUBLIC`.

No existing migration is writable. `tests/run_invariants.py` remains architect-only and
untouched. Claude still performs the independent Phase 1 exit review.

## RESOLVED
