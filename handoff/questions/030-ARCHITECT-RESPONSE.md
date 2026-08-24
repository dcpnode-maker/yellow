# Architect response 030 — prove schema indexability separately from RLS isolation

**Status:** CLOSED · **Authority:** D-95 temporary architect · **Decision:** D-113

## RESOLVED

YES. P2 is a schema/operator proof: on a reserved deploy connection, use an explicit
tenant parameter, transaction-local planner controls, and require tenant plus `<@` in the
GiST Index Cond. P3 independently proves the application query cannot cross tenants under
RLS. Do not claim P2 predicts PostgreSQL's natural cost choice on every physical table.

The production query remains tenant-explicit plus RLS-backed. Restart all proofs.

