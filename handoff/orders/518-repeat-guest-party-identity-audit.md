# Order 518 — repeat-guest Party identity audit

## Objective

Determine why the current Locanda operating scenario exposes many distinct Party
records for the same guest name, quantify the authoritative relationships and
define a safe deterministic repeat-guest reconciliation.

## Scope

- Read-only inspection of
  `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/scripts/provision-two-property-operating-scenario.ts`
- Read-only queries against the current `yellow-public-demo` PostgreSQL database
- `handoff/reviews/518-repeat-guest-party-identity-audit.md`
- `handoff/questions/016-repeat-guest-party-reconciliation.md`

## Required evidence

1. Count Party IDs per normalized display name and linked reservation counts.
2. Identify the exact provisioner key that creates or reuses guest identity.
3. Distinguish genuine same-name ambiguity from deterministic scenario duplication.
4. Define idempotency, relationship and history-preservation requirements for a
   later source repair and current-database reconciliation.

## Exclusions

- No Party merge, deletion, reservation reassignment or database mutation.
- No synthetic contact invention.
