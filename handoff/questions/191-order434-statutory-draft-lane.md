# Question191 — Parallelize native statutory reconstruction

**Raised:** 2026-09-05, Order434, before creating another draft path.

The remaining preparation needs both actual-date/rate reconstruction and the
existing supplier/recipient/property/classification evidence graph. Those are
independent read-only calculations over the same approved roots. Having both
workers edit the preparation fragment would violate exclusive file ownership.

## RESOLVED — D1352, technical scope amendment only

Admit `handoff/drafts/order434/0076-native-statutory.sql` as a third non-runnable
fragment of the one already reserved completion migration. It may reconstruct
only the statutory roots and existing 295/296/297 evidence required by Order434.
It adds no table, event, provider, public operation, business policy or runtime
grant. Preserve the distinct existing canonical preimages and all dated source
validation; a supplied or stored digest alone is not authoritative evidence.

The preparation worker retains `0076-native-preparation.sql`; the statutory
worker owns the new fragment and the already admitted source-completion database
test. Root owns accounting/guards, integration and shared governance. Serialize
database applications and fixture execution when needed; do not create another
cluster, worktree or dependency installation for parallelism.

All fragments stay outside the migration runner until complete preparation,
accounting, commit, graph authentication and the full independent acceptance
have passed. This division does not create a smaller completion target or
authorize a partial native invoice or local app promotion.
