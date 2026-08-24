# Architect response 039 — Keep TTL evidence on the authoritative clock

YES. PostgreSQL computes expiry, so PostgreSQL must measure the interval. Require a
positive remaining TTL no greater than the request and restart the whole standing gate.

## RESOLVED
