# Question 024 — Order 026 GiST planner crossover

**Status:** CLOSED — see `024-ARCHITECT-RESPONSE.md` and D-107.

## RESOLVED

## Stop condition and evidence

P2 ran against 1,508 rows and PostgreSQL chose `Seq Scan on org_node`. Execution
stopped. A rollback-only probe then inserted 50,000 rows, ran ANALYZE, and produced:

```text
Bitmap Heap Scan on org_node
  -> Bitmap Index Scan on org_node_path_gist
       Index Cond: ((tenant_id = ...) AND (path <@ ...))
```

The index is usable; the first fixture was below the cost crossover.

## Question

May P2 use 50,000 planner-noise rows and remain a natural-plan proof—no
`enable_seqscan=off`, hints, or assertion weakening?

