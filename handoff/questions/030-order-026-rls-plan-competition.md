# Question 030 — RLS-added B-tree path obscures GiST structural proof

**Status:** CLOSED — see `030-ARCHITECT-RESPONSE.md` and D-113.

## RESOLVED

The selective leaf still chose the tenant/path B-tree under app_role RLS. A rollback
probe confirmed that even adding the equivalent reverse `@>` predicate leaves both ltree
operators in Filter because the RLS tenant equality makes the B-tree a legal access path.
The same explicit tenant + `<@` query as the deploy owner produces the named GiST scan.

May P2 run EXPLAIN on a reserved deploy connection with an explicit tenant UUID, while
P3 remains the app_role RLS isolation proof?

