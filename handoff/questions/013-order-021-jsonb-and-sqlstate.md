# QUESTION 013 — Order 021 proof exposed JSONB scalar encoding and SQLSTATE field mismatch

**Status:** RESOLVED
**Phase:** 1 · **Order:** 021 · **Branch:** `phase-1/fact-log-audit-envelope`
**Raised by:** Codex (builder) · **Date:** 2026-08-15
**Hard floor:** D-92 pre-registered proofs P1 and P3 executed and failed

## Evidence

P1 committed the mutation and fact row, but `payload->>'request_id'` returned NULL.
The helper passed `JSON.stringify(object)` directly to a parameter inferred as `jsonb`.
Bun encoded that JavaScript string as a JSON string scalar rather than PostgreSQL
parsing its contents as an object.

The same pattern already exists in `scripts/seed.ts`. Direct database evidence after
the Phase 0 seed is:

```text
SELECT jsonb_typeof(config), config FROM org_node LIMIT 1;
string|"{}"
```

`tests/seed.integration.test.ts` expects `config: "{}"`, and `sameConfig()` explicitly
accepts the string, so the test certified the bug.

P3 correctly received PostgreSQL insufficient-privilege errors, but the proof read
Bun's generic `error.code` (`ERR_POSTGRES_SERVER_ERROR`) instead of the PostgreSQL
SQLSTATE carried in `error.errno`. The repository's migration and seed runners already
use `errno` for this reason.

## Decision requested

May Order 021:

1. encode pre-stringified JSON through a text parameter before PostgreSQL's JSONB cast;
2. add `scripts/seed.ts` and `tests/seed.integration.test.ts` to Scope only to correct
   the same defect and require an actual JSON object;
3. read SQLSTATE from Bun's `errno` field in P3; and
4. rerun P1–P4 unchanged from the top?

## RESOLVED

Answered **YES** by `handoff/questions/013-ARCHITECT-RESPONSE.md` under D-95.
