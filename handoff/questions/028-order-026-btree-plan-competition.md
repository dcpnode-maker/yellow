# Question 028 — B-tree competes with structural GiST proof

**Status:** CLOSED — see `028-ARCHITECT-RESPONSE.md` and D-111.

## RESOLVED

With Seq Scan disabled, P2 chose `org_node_tenant_id_path_key` as a plain Index Scan on
tenant equality and applied `<@` as a filter. A rollback probe additionally disabled
plain Index Scan (leaving Bitmap Scan enabled) and produced Bitmap Index Scan on
`org_node_path_gist` with both tenant and `<@` in Index Cond.

May the structural proof set both controls transaction-locally?

