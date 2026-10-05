# Order 464 — independent design review

**Date:** 2026-09-20  
**Reviewer:** Astra Review (independent; did not execute or edit)  
**Verdict:** rejected as initially written; conditionally acceptable after the
order is restricted and the listed proof requirements are met.

## Findings incorporated into Order 464

1. The initial order contradicted itself by allowing a reviewed seed while
   forbidding the seed's writes. Reconciliation and fixture provisioning must be
   separate orders.
2. A Party presentation/attribute change is visible to other modules. Invariant 9
   requires the appropriate same-transaction audit/outbox effect; a direct SQL
   update or a fabricated creation event is not acceptable.
3. Row counts cannot prove a protected record was not updated. Complete
   deterministic content fingerprints or typed snapshots are required.
4. The candidate must be frozen, tenant-scoped, relationship-locked and
   compare-and-swap guarded. Any unknown drift must abort, while an already
   canonical record must be a verified no-op.

## Required independent proof before execution

- Isolated-database first-run/replay, wrong tenant/UUID, relationship mismatch,
  stale prior data and injected-failure tests.
- Protected-table content fingerprint comparison covering reservations, guests,
  contacts, finance, occupancy, identity, users, facts/outbox, the target's
  unapproved fields, and unrelated Parties.
- Independent current-target pre/post verification, with any approved audit/outbox
  rows asserted exactly.

No database command, edit, secret access, or live value inspection was performed
by this reviewer. This review is not approval to execute a correction.
