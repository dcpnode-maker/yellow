# Question 025 — production tenant expression raises GiST crossover

**Status:** CLOSED — see `025-ARCHITECT-RESPONSE.md` and D-108.

## RESOLVED

The 50,000-row P2 rerun still chose Seq Scan. Its cleanup also exceeded Bun's default
five-second hook timeout and left the isolated noise rows. An exact production-expression
probe with those 50,000 rows plus 50,000 rollback-only rows then produced the required
Bitmap Index Scan for `order026.brand_a`. The transaction-local `current_setting`
tenant expression raises the observed planner crossover to approximately 100,000 rows.

May the proof use 100,000 rows and 30-second setup/cleanup hook budgets, still without
planner coercion?

