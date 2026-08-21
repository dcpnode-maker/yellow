# Order 032 — Audited policy and base rate-plan configuration

**Phase:** 2 · Slice 2A
**Branch:** `phase-2/rate-configuration`
**Tier:** 2 — audited tenant configuration, no price or occupancy change
**Written by:** OpenAI Codex, temporary architect under D-95/D-115

## Outcome

Create and read validated commercial policies and base rate plans. Establish the policy
references needed by quote construction without yet introducing money-bearing prices.

## Scope

- `DECISIONS.log`
- `docs/EVENTS.md`
- `handoff/orders/032-policy-rate-plan-configuration.md`
- `src/contexts/rates/index.ts`
- `src/contexts/rates/configuration.ts`
- `tests/rate-configuration.integration.test.ts`

## Required behavior

1. Create/read/list cancellation, deposit, guarantee, and no-show policies using D-131's
   strict content shapes; content is always a JSON object. Fixed-amount variants are
   rejected until their currency + bigint-minor-unit contract is ordered.
2. Create/read/list base rate plans with code, name, currency, tax-inclusive flag,
   optional exact-kind policy references, and optional market/source codes.
3. Explicitly prove property ownership and policy tenant/type membership inside the
   active transaction; never rely only on foreign keys or RLS.
4. Keep `parent_plan` and `derivation` null in this order.
5. Each create records one fact and one exact catalogue event in the caller transaction.
6. Reads are deterministic and tenant/property scoped.

## Forbidden

- Rate prices, money, restrictions, packages, promotions, negotiated rates, quotes,
  availability, occupancy, reservations, HTTP/UI, updates, status transitions, deletion.
- Migrations, schema snapshots, RLS, tenant middleware, or referee changes.
- `early_departure` policy content until specified.
- Generic CRUD or unvalidated JSON.
- Self-approval or merge.

## Pre-registered proofs

- **P1:** all four supported policy kinds round-trip through non-fixed shapes as JSON
  objects with exact facts and events.
- **P2:** a base plan with three exact-kind policies commits atomically and reads back in
  deterministic property order.
- **P3:** kind/content mismatch, malformed rules, invalid currency/code/name, and
  `early_departure` fail without artifacts.
- **P4:** wrong-kind and tenant-B policy references cannot be attached; a tenant-B
  property cannot be targeted from tenant A.
- **P5:** duplicate plan code conflicts and publisher failure rolls data/fact/event back.
- **P6:** tenant B cannot read tenant A policy or plan; another property does not see it.
- **P7:** parent/derivation stay null and no rate_price row is written.
- **P8:** standing checks, schema drift, and canonical 11/11 remain green.

## Standing checks

Run the Order 032 database proof with its required flag, typecheck, boundaries, full
tests, licence policy, audit, schema drift, and `./setup.sh --db-only`. Commit and push
only when all are green. Do not merge.
