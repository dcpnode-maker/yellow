# Question 169 — Order183 reversal-header authority

**Status:** RESOLVED — D-473
**Order:** 183
**Raised by:** adversarial privilege review of the paused checkpoint
**Date:** 2026-08-26

## Stop

Migration 0019 granted `app_role` raw column-level INSERT authority for
`journal.reverses`. Although the service used it only for governed charge correction,
the database grant itself could be combined with the existing journal INSERT columns
to choose reversal lineage, kind, source, property and currency without passing the
service's complete validation. The unique partial index arbitrated duplicates but did
not constrain what qualified as a correction header.

The paused checkpoint also read folio/account status before acquiring the existing
financial row locks and did not re-read that authority afterward. The later locks
serialized the rows, but the command continued from the earlier snapshot instead of
explicitly proving that the locked folio/account remained open, unfrozen and coherent.

## Resolution

D-473 removes raw `journal.reverses` INSERT authority and replaces it with exact
`create_charge_correction_header(uuid,uuid,uuid,character,text,uuid)`. The
`yellow_owner` security-definer function is callable only by exact `app_role`, binds
the transaction-local tenant, validates active actor and exact property/currency,
accepts only a governed unreversed charge with exact source, derives the current
property-local business date, enforces the bounded trimmed reason, and inserts only an
`adjustment` with exact reversal source. The tenant-leading unique partial index
remains authoritative for one-winner arbitration.

After `lock_financial_rows`, the correction service re-reads the folio/account/property
and continues only from the locked open guest-account state. No direct journal update
or delete, business-day mutation, broader table grant or active-local mutation is
authorized.

## RESOLVED

Resolved by D-473 before Order183 resumes from its checkpoint.
