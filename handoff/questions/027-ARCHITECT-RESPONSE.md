# Architect response 027 — separate structural index proof from cost benchmarking

**Status:** CLOSED · **Authority:** D-95 temporary architect · **Decision:** D-110

## RESOLVED

YES. D-107/D-108 conflated two claims. Order 026 requires structural evidence that the
query can use `org_node_path_gist`; a deterministic forced-plan EXPLAIN proves that. A
natural cost choice depends on cardinality, bloat, cache and server cost settings and is
not stable in this integration suite.

Use 1,500 rows, set `enable_seqscan=off` transaction-locally immediately before EXPLAIN,
and retain assertions for the named index, Index/Bitmap Index Scan, and no Seq Scan. The
setting must reset with the tenant transaction. Restart all Order 026 proofs.

