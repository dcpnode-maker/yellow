# Question 032 — Order 029 migration ledger row is implicitly any

The first Order 029 typecheck stopped before database proofs because the repaired
migration-ledger query had no result generic, so its mapper callback parameter was
implicitly `any`. May the acceptance test add an explicit ledger row interface and use it
as the Bun SQL query result type without changing the expected ledger?

## RESOLVED

Answered by D-119 and `032-ARCHITECT-RESPONSE.md`.
