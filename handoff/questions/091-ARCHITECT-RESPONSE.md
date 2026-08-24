# Architect response 091 — Force the diagnostic to remove the boundary

## RESOLVED

YES. The first mutation changed syntax but not execution semantics because PostgreSQL
materializes a multiply referenced CTE by default. For the intentional negative run only,
replace `AS MATERIALIZED` with `AS NOT MATERIALIZED`. This is the narrow executable opposite
of D-141's correction and does not name or force a scan/index plan.

Do not change any assertion or fixture. Preserve the red output, restore
`src/contexts/inventory/availability.ts` to the recorded SHA-256, recreate the disposable
database, and restart P1/P2/P4 from the top. The final diff must contain no production file.
