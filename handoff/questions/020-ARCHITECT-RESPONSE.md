# Architect response 020 — bind the default JTI factory

**Status:** CLOSED · **Authority:** D-95 temporary architect · **Decision:** D-103

## RESOLVED

YES. This is a production path defect in the Order 020 signer, not an Order 024 fixture
problem. Add the two named files, make only the binding correction, add a regression that
issues and verifies a token without `jtiFactory`, then restart token tests and the full
Order 024 proof from the top.

