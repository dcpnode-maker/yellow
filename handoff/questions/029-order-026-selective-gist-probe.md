# Question 029 — selective path for structural GiST proof

**Status:** CLOSED — see `029-ARCHITECT-RESPONSE.md` and D-112.

## RESOLVED

Even with plain Index Scan disabled, the B-tree won as a Bitmap Index Scan on tenant
equality for the two-row brand subtree and left `<@` as a filter. Earlier rollback probes
consistently selected GiST for the exact same query shape with a selective existing leaf.

May P2 explain `order026_noise.n000001` instead of the brand path? P1 retains the brand,
chain, ancestor and sibling behavioral proofs; P2 then isolates that `<@` appears in the
GiST Index Cond rather than only in Filter.

