# Invariant Battery — Run Results
**Run:** 13 Aug 2026 · DB: PostgreSQL 16 · SCHEMA.sql v1.1 + seed_fixture.sql (repaired)
**Command:** `python3 tests/run_invariants.py yellow_test` · **Result: 11/11 PASS**

| TC | Invariant | Result | Evidence |
|---|---|---|---|
| TC-12.1 | 50-thread exclusive race → 1 winner | PASS | winners=1 |
| TC-12.2 | private sale vs 6 bed claims never coexist | PASS | exclusive=1, beds=0 |
| TC-12.3 | 40 threads for 6 beds → exactly 6 | PASS | claims=6 |
| TC-12.4 | direct INSERT to space_occupancy blocked | PASS | SQLSTATE 42501 |
| TC-12.5 | contended single-space throughput | PASS | 355 commits/s (multi-space benchmark: 1,409/s, prototype/RESULTS.md) |
| TC-5.6 | unbalanced journal rejected AT COMMIT | PASS | deferred trigger fired |
| TC-7.1 | balanced journal commits | PASS | control case |
| TC-5.4 | posting to sealed day blocked | PASS | "business date sealed" |
| TC-8.2 | 100 concurrent invoice numbers | PASS | gapless 1..100, no dupes |
| TC-13.1 | table RLS (via app_role) | PASS | A=16 rows, B=0 |
| TC-13.4 | view RLS (leak-class regression) | PASS | each tenant sees only itself |

**Defects found by running (all fixed):**
1. seed_fixture.sql — tax_jurisdiction JSON schema literal truncated (brace count); regenerated from EXTENSIONS.md.
2. Reviewer's own dorm insert used non-existent column `kind` → `profile_key` (schema rejected it).
3. Reviewer's runner used slot_kind `'reservation'` → CHECK constraint demands `'segment'` (schema rejected it).

The schema defended itself against its own author twice. That is the design working.
