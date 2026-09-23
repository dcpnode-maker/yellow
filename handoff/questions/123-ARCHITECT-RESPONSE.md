# Architect response 123 — Order 071 test-double interface

## ANSWERED — TEMPORARY ARCHITECT

YES. Derive the non-null rate-builder dependency type from the public constructor parameter and
type the helper to that exact Pick-based interface. Add the optional property only to the test
request helper. Do not expose private service state, implement unrelated methods, cast the failing
double, remove the rollback or forbidden-property proofs, or change production authorization.
Restart typecheck before running the database suite.

