# Question 129 — Order 078 evidence-sort collation

## BLOCKED — ARCHITECT NEEDED

**Order:** 078  
**Raised by:** OpenAI Codex builder  
**Production edits made:** unchanged since Question 128; the full uncommitted seeder implementation
remains in `scripts/seed-review.ts`

The complete Question-128 restart returned 10 pass / 1 fail. Every behavior and read-only proof
passed, including divergent-active refusal and the live quote. The sole failure is expected-row
ordering inside the new exact fact-type assertion: PostgreSQL's ordering places
`rate_plan.created` before `rate_plan_model.drafted`, while JavaScript `localeCompare` placed it
after the underscore-prefixed names. The row set and all eight exact counts are identical.

May the proof force C byte-order collation in its SQL `ORDER BY` and sort the dynamic expected rows
with explicit `<`/`>` code-point comparison instead of locale-sensitive `localeCompare`? No row,
count, operation, product code or database object changes. I will then recreate the database and
restart all eleven tests.
