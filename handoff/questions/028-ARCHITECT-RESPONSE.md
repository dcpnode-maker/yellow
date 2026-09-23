# Architect response 028 — isolate the GiST operator path

**Status:** CLOSED · **Authority:** D-95 temporary architect · **Decision:** D-111

## RESOLVED

YES. Set `enable_seqscan=off` and `enable_indexscan=off` while leaving bitmap scans on.
This excludes the unrelated tenant-equality B-tree path and requires PostgreSQL to prove
the composite GiST supports both predicates. Keep the named-index and no-Seq assertions,
then restart Order 026 from the top.

