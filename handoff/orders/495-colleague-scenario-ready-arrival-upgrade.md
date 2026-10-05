# Order 495 — Contact-free colleague scenario ready-arrival upgrade

## Objective

Provide a versioned, wholly synthetic operating-property scenario with a realistic
mix of arrivals: at least one arrival that can complete the real check-in journey,
and separate arrivals that truthfully demonstrate folio and housekeeping blockers.

## Scope

- `scripts/provision-colleague-current-date.ts` and its focused scenario tests only
- an explicitly versioned, isolated synthetic property record; no mutation or
  deletion of the existing `yellow_demo.colleague_current` scenario
- existing schema primitives and canonical seed contracts only

## Requirements

1. All parties remain synthetic/contact-free with no contact points, payment
   instruments, documents, or imported client/OTA data.
2. A due-in record has a clean or inspected assigned room, precisely one open primary
   folio, and no identity adapter requirement, so the canonical readiness service
   returns `canCheckIn=true`.
3. Other due-in records retain truthful room and folio blockers for the operational
   walkthrough.
4. Scenario identities/path/version and expected counts are explicit and idempotent;
   no raw mutation is used against the already-published scenario.
5. Fresh PostgreSQL proof and an independent reviewer establish occupancy, journal,
   RLS, outbox and source-contact separation before the scenario is provisioned to a
   target.  Target provisioning itself is a separate release order.

## Exclusions

- No personal data, real bookings, historical customer details, raw target DML,
  deletion, migration, provider activation, invoice issuance or automatic check-in.
