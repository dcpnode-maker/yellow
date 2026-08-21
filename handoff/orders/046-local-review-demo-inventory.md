# Order 046 — Reproducible local-review demo inventory

**Phase:** 2 · Founder review enablement
**Branch:** `phase-2/local-review-demo-inventory`
**Tier:** 3 — tenant-scoped provisioning exercised through production inventory services
**Written by:** OpenAI Codex, temporary architect under D-95/D-115

## Outcome

Turn the already-running authenticated operator workbench into a useful founder-review
surface by provisioning deterministic local-only staff access and a small hotel inventory
against the canonical `yellow-demo` tenant/property. Availability must come from the real
tenant-scoped PostgreSQL services, not fixtures embedded in the browser or direct domain
table inserts.

## Scope

- `DECISIONS.log`
- `docs/LOCAL-REVIEW.md`
- `handoff/LEDGER.md`
- `handoff/orders/046-local-review-demo-inventory.md`
- `package.json`
- `scripts/seed-review.ts`
- `setup.ps1`
- `setup.sh`
- `tests/review-seed.integration.test.ts`

## Required behavior

1. Add a local-only review seeder targeting the canonical `SEED_TENANT` and
   `SEED_PROPERTY`; fail if the canonical launch seed is absent.
2. Require the password through `YELLOW_REVIEW_PASSWORD`. Never commit, print, log, or
   persist the cleartext password outside its Argon2id verifier.
3. Derive stable user/role identities from UUIDv5 names. Provision the local user,
   availability permission, property-scoped role and grant idempotently; an existing row
   must match the complete canonical shape or the run fails without silently updating it.
4. Create two room types and five physical rooms/sellable units through
   `InventoryService` with `PostgresEventBus`, inside transaction-local tenant context.
   Identical reruns must verify and reuse existing aggregates, not duplicate them.
5. Every created inventory aggregate must retain the normal fact-log and outbox evidence.
   The browser remains a read-only availability surface in this order.
6. Add a package command and a concise local-review guide containing the exact automated
   startup/seed URL and login identifier, but no password value.
7. After Question 049's reproduced fresh-volume race, require setup readiness to observe
   both `pg_isready` success and PID 1 already running the final `postgres` postmaster.
8. Record the decision and ledger event without approval, merge, or review claims.

## Forbidden

- Migrations, `tests/run_invariants.py`, occupancy functions/claims, holds, OOO/OOS,
  restrictions, rates, journal, fiscal, RLS policy, tenant-middleware, or production API
  behavior changes.
- Direct inserts into inventory domain tables, fake browser options, mutable upsert,
  `ON CONFLICT DO UPDATE`, deletion/reset of hotel data, or a committed default password.
- Public binding/hosting, deployment credentials, marking any order merged, self-review,
  approval, or merge.

## Pre-registered proofs

- **P1:** after canonical base seed, one run creates exactly one active review user, one
  property-scoped role/grant, two room types, five rooms and five sellable units.
- **P2:** every inventory aggregate created in P1 has exactly one matching fact and one
  matching outbox event; no inventory table was written outside the service path.
- **P3:** an identical second run reports existing exact state and changes no row/event/
  fact counts.
- **P4:** a same-identity shape collision fails and leaves the prior row unchanged; the
  password never appears in stdout/stderr or committed files.
- **P5:** login returns a bearer token with only `inventory.availability:read`; property
  listing exposes only the canonical property; a future two-night search returns five
  real, bookable PostgreSQL-backed options.
- **P6:** implementation scope is exactly nine files plus Question 049's two governance
  artifacts; typecheck, boundaries, complete tests, schema
  drift, and fresh isolated db-only referee are unchanged and green at 11/11.

## Standing checks

Run the order proof against an isolated database, then restart the repository standing
self-check from the top. Refresh Graphify, commit with `[codex]`, push, and open a draft
stacked PR. Do not approve or merge.
