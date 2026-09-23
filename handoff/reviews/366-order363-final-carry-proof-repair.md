# Order 366 / 363 / 359 / 351 final carry-proof repair — fresh Tier-3 review

**Disposition:** WITHHOLD

**Reviewer:** `/root/order366_fresh_tier3`, fresh independent non-implementing Tier-3

**Exact proof candidate:** `2f631a5722ab8d615ab35c0222f4de538fce25d2`

**Exact governance:** `e4c6e35ee3c339c697263e034e86762a8a36fd43`

## Blocking findings

### Approval and request one-use proof remains masked by source one-use

The purportedly isolated approval-reuse fixture inserts a carry using the same
`source_discrepancy_id` that the subsequent capability call consumes. Dropping only
`UNIQUE (tenant_id, approval_request_id)` still leaves the source unique constraint
to reject the call. The request-reuse fixture has the same masking error: it inserts
the same source discrepancy before attempting the reused request id. On a fresh
63-migration PostgreSQL database, each exact one-constraint-removal mutant passed the
named permanent test **1/0 (8)**. The target-reuse branch is independently isolated;
the approval and request branches are not.

### After-event rollback has no observation that the event was inserted

The failing event publisher now calls the canonical publisher before throwing, but
the permanent oracle observes only the rolled-back post-state and a clean retry.
Removing only `await eventBus!.publish(tx, event)` from that failing publisher still
passes the exact rollback case **1/0 (540)**. The proof therefore cannot distinguish
failure after canonical outbox insertion from failure before insertion, which was the
specific Order363 finding it was required to close.

### Complete snapshot surface is self-declared rather than load-bearing

The snapshot implementation and its expected surface are two duplicate local arrays.
Removing `folio_balance` from both arrays leaves no independent oracle for that
required surface; the exact financial-isolation case still passes **1/0 (93)**.
The same construction applies to every duplicated member, so the repair does not
supply the mutation-sensitive observation for every required financial/cashier/
trust/tax/fiscal surface required by Order366.

## Evidence confirmed before withholding

The exact inactive-authorized-decider repair is load-bearing: removing only migration
0063's approver `u.status='active'` predicate makes the exact hostile actor case fail
**0/1** because the carry resolves when rejection is expected. Exact candidate
baseline passes fresh focused PostgreSQL **11/0 (726)**. Prepare/carry ACL execution,
hostile `pg_temp`, same-key result identity/body equality, target reuse, canonical
catalogue `63/116/106/15/2`, typecheck and diff hygiene are present in that baseline.

Broad downstream gates cannot convert these surviving proof mutants into executable
evidence for the named Order366 claims. No Order366/363/359/351 approval, carry
readiness, seal, local promotion or downstream authority follows.
