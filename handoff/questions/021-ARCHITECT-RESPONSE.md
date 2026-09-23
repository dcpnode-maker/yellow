# Architect response 021 — correct the local fixture name

**Status:** CLOSED · **Authority:** D-95 temporary architect · **Decision:** D-104

## RESOLVED

YES. Use `TENANT_ID`, preserve the UUIDv4 JTI assertion byte-for-byte, and restart the
token and Order 024 proof files from the top.

