# Question 042 — Order 037 close permission and range proof

**Raised by:** OpenAI Codex (builder / temporary architect)
**Order:** 037 — Audited OOO/OOS lifecycle
**Status:** OPEN — D-92 hard floor after a pre-registered proof ran and failed

## Exact failure

The first Order 037 database run completed with `4 pass, 3 fail`.

- P1 created the correct OOO row, occupancy, fact, and events, but its assertion compared
  PostgreSQL's textual `tstzrange` representation to an ISO string. Received:
  `["2027-10-10 12:00:00+00","2027-10-12 12:00:00+00")`. This is a test instrument
  error; the returned typed lower/upper instants already matched exactly.
- P3 and P5 reached `OperationalBlockService.close` and PostgreSQL rejected
  `DELETE FROM ooo_oos` with SQLSTATE `42501` (`permission denied for table ooo_oos`).

The immutable baseline deliberately grants `app_role` `SELECT, INSERT` on all tables
and `UPDATE` on `ooo_oos`, but never grants `DELETE`. No migration, grant, RLS,
occupancy-function, referee, or pre-existing test was changed.

## Why the current order cannot stand

D-143 and Order 037 define active state as row existence and close as row deletion.
That lifecycle is not executable through the application role. Granting DELETE would
require a new migration and a separate privilege decision; silently doing it would cross
the order's Forbidden list and D-92 floor.

## Proposed correction

Use the baseline's existing UPDATE authority and preserve the row as history:

1. Active means `NOT isempty(period) AND upper(period) > transaction_timestamp()`.
2. Closing a currently-started block changes its upper bound to
   `transaction_timestamp()` while preserving the original lower bound.
3. Closing a future scheduled block changes `period` to `empty`.
4. Capture the original row first under `FOR UPDATE`; the close fact/event retain its
   original period and reason. OOO occupancy is still released only through
   `release_occupancy`.
5. A repeated close finds no active row and adds no evidence.
6. Correct P1 to assert `lower(period)` and `upper(period)` as typed instants instead of
   PostgreSQL's presentation string. The production result and required semantics do not
   change.

This needs amendments to D-143, Order 037 required behavior/P3, production close SQL,
and the P1 assertion, all within the existing order scope.

## Alternatives rejected by the builder

- Add DELETE privilege in a new migration: permanently broadens the application role for
  a lifecycle the baseline appears to have designed around UPDATE.
- Reuse `space.status`: loses interval/cause identity and conflates configuration with an
  operational block.
- Leave the row unchanged and rely only on releasing occupancy: OOS would remain
  commercially active forever and future availability evaluation could not close it.
- Delete through a new SECURITY DEFINER helper: adds migration and privilege surface when
  the existing UPDATE grant can express closure.

## Decision requested

Approve or amend the UPDATE-based close model and typed-bound assertion above. No further
Order 037 implementation or test edits will occur until this hard-floor question is
resolved.
