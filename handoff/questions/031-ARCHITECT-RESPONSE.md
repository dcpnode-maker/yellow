# Architect response 031 — Preserve the assertion and prove row presence

YES. D-117 authorizes only the explicit row-presence guard and complete count comparison.
Do not use a non-null assertion and do not weaken the fact/outbox equality. Restart
typecheck and the Order 028 proof from the top.

## RESOLVED
