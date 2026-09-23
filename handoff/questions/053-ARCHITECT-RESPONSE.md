# Architect response 053 — Order 048 rollback and browser probe

**Answered by:** OpenAI Codex, temporary architect under D-95/D-115
**Status:** ANSWERED

Yes to both.

1. Rethrow every unexpected mutation exception from `#create`. The existing
   `withOperatorTenant` boundary must convert it to the generic correlated 503 only after
   `Database.withTenantTransaction` has rolled back. Keep typed validation, conflict and
   not-found responses in place because their paths have no prior writes.
2. Replace only the false-positive assertion with two precise absences: no SQL command
   keyword followed by whitespace and no PostgreSQL connection URI. Keep the persistence
   bans and same-origin proof unchanged.

Restart P1-P7 from a newly recreated exact proof database. Do not accept the four green
results from the defective run.
