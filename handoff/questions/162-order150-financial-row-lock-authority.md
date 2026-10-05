# Question 162 — Order 150 financial row-lock authority

**Status:** RESOLVED — D-418
**Order:** 150
**Raised:** 2026-08-25
**Trigger:** pre-registered P2/P4 phase-matrix assertion failure

## RESOLVED — D-418

The founder authorized the recommended bounded follow-up on 2026-08-25. Order 151
owns one non-mutating, owner-mediated financial row-lock capability and the exact
FolioService/ChargeService caller substitution. Direct account/folio UPDATE remains
forbidden. Order 150 resumes only through the independently proved stacked result.

## Exact evidence

The real 21-lane phase gate passed its first 13 isolated databases and then stopped
in `tests/financial-postings.integration.test.ts`: 2 passed, 8 failed. Every failure
was PostgreSQL `42501 permission denied for table folio`.

`ChargeService.postCharge` reads the current folio/account authority with:

```sql
SELECT ...
FROM folio
JOIN account ...
...
FOR UPDATE OF folio, account
```

PostgreSQL requires UPDATE authority on a relation named by `FOR UPDATE`, even when
the command never changes that relation. Migration 0016 correctly removed the old
blanket table UPDATE, exposing this hidden authority dependency. There is no exact
folio or account UPDATE column used by the production caller that migration 0016
can safely regrant.

D-324 already rejected restoring direct `business_day` UPDATE merely to obtain a
row lock. The same reasoning applies here: granting an arbitrary folio/account
column would create a real mutation capability solely to satisfy lock syntax and
would contradict Order 150's positive-caller catalogue and Forbidden list.

## Decision needed

Choose the authority shape for the charge serialization lock:

1. **Recommended — authorize a bounded follow-up capability/order.** Keep Order
   150 fail-closed; add a narrowly scoped owner-mediated lock/read capability (or
   another database-enforced lock design) and change `ChargeService` only in that
   new order. Then resume Order 150 P2/P4 from the top.
2. **Authorize a scoped caller redesign without a new function.** Permit an exact
   production change that preserves equivalent folio/account serialization without
   granting direct UPDATE. This still requires widening beyond Order 150's current
   no-production-caller scope and an independent high-risk proof.
3. **Not recommended — grant a column UPDATE solely for row locking.** This would
   restore an otherwise-unused direct mutation path and contradict the positive
   capability direction and D-324 precedent.

No grant or production caller was changed after the failure. The failed runner
cleaned all disposable `yellow_ci_p*` databases; the approved local workbench was
untouched.
