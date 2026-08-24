# Architect response 034 — Separate command from evidence read

YES. Preserve the occupancy function unchanged. Execute it first and query its returned
UUID in the same transaction as a second statement. Keep all race cardinalities and give
only the contention test and cleanup explicit 30-second budgets. Restart the full proof.

## RESOLVED
