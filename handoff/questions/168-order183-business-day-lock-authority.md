# Question 168 — Order183 business-day lock authority

**Status:** RESOLVED — D-470
**Order:** 183
**Raised by:** live PostgreSQL correction proof
**Date:** 2026-08-26

## Stop

The first fresh-database correction proof failed with SQLSTATE `42501 permission
denied for table business_day`. PostgreSQL requires table `UPDATE` privilege for
`SELECT ... FOR SHARE`, even when the command changes no row. `app_role` correctly
lacks direct `business_day` UPDATE authority, and restoring it solely to obtain a lock
would reopen a forbidden mutation path.

The existing `assert_day_open()` security-definer trigger locks only the new journal's
current business date. A correction can target an original charge from a different
business date, so it cannot serialize the required original-day authorization check
against sealing. The existing `lock_financial_rows()` capability covers accounts and
the folio, not business days.

## Resolution

D-470 authorizes one bounded capability in migration 0019:
`lock_financial_business_days(uuid,uuid,date[])`. It is a volatile, safe-search-path,
`yellow_owner`-owned security-definer function callable only by exact `app_role`. It
requires an exact transaction-local tenant match, one or two non-null distinct dates,
one property, locks matching tenant/property rows in date order with `FOR SHARE`,
fails closed unless every requested row exists, and returns no data.

The correction service calls the capability after deterministic account/folio and
original-journal advisory locks, then plain-reads the held business-day rows. Direct
`business_day` UPDATE remains denied. Exact catalogue, ACL, hostile-input and
seal/correction concurrency proofs are mandatory.

## RESOLVED

Resolved by D-470 before the Order183 candidate commit.
