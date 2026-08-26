# Question 167 — Order183 reversal authority and sealed-day contradiction

**Status:** RESOLVED — D-468 applies Invariant 7 and founder contra-entry intent
**Order:** 183
**Raised by:** independent pre-implementation adversarial audit
**Date:** 2026-08-26

## Stop

Order183 was stopped before product implementation for two exact reasons:

1. migration `0016_runtime_dml_authority.sql` grants `app_role` journal INSERT only
   across the existing charge columns and omits `journal.reverses`. The required
   immutable contra header would fail SQLSTATE 42501. The admitted migration-free scope
   therefore could not execute its own command.
2. The order required correction to reject a sealed current business day. This
   contradicts PROJECT.md Invariant 7 and `assert_day_open()`, which deliberately allow
   only `adjustment` and `correction` journals after seal. A financial correction must
   remain possible without reopening or mutating a sealed day.

No product file, migration, database or active-local state changed before the stop.

## Resolution

Founder product intent confirms immutable accounting: a wrong entry is nullified by a
new positive/negative corrective entry and is never deleted. D-468 corrects Order183:

- migration `0019_financial_reversal_authority.sql` adds only the missing column-level
  journal INSERT authority for `reverses` and a tenant-leading unique partial index
  allowing at most one reversal per original journal;
- exact migration ledger/schema/acceptance and runtime-DML catalogue proofs join scope;
- adjustments remain lawfully postable on a sealed business date under the existing
  invariant, while ordinary charge posting remains rejected there;
- the service still locks and validates the original, creates exact balanced contra
  lines, preserves history, and rejects duplicate/reversal-of-reversal commands.

The founder's distinct multi-window split/routing requirement is recorded for the next
financial order. It will not silently widen the stopped correction order.

## RESOLVED

Resolved by D-468 before Order183 implementation resumed.
