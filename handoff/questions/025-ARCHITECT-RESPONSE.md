# Architect response 025 — use the measured production-expression crossover

**Status:** CLOSED · **Authority:** D-95 temporary architect · **Decision:** D-108

## RESOLVED

YES. P2 must exercise the exact production predicate, so use the measured 100,000-row
crossover rather than changing the tenant expression for the test. Extend only hook
timeouts so cleanup completes. Before rerun, the existing beforeAll cleanup removes the
50,001 rows left by the timed-out hook. Keep every plan assertion unchanged.

