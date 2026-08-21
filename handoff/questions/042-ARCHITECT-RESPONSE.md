# Architect response 042 — Use the baseline's UPDATE authority

YES. The proposed model is the only option that fits both the immutable schema and its
deliberate ACL: active means a non-empty range ending after transaction time; close
truncates a started range or empties a future one while preserving the captured original
range in fact/outbox evidence. OOO still releases only through `release_occupancy`.

Correct P1 to compare typed lower/upper instants rather than PostgreSQL's presentation
string. Amend D-143 and Order 037, then restart the Order 037 proof from the top. Do not
add DELETE authority, a SECURITY DEFINER deletion helper, a status column, or a migration.

Authority is D-95/D-115 temporary architecture. This resolves order specification only;
it is not independent review or approval.

## RESOLVED
