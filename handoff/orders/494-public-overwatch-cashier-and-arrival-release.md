# Order 494 — Public Overwatch cashier and arrival-workflow release

## Objective

Release the independently reviewed cashier charge workbench and the bounded arrival
workflow routing repair to the sole `yellow-public-demo` runtime.  The release
must serve the embedded Overwatch arrival journey from the Today-board action,
and the actual cashier posting workbench, without database changes.

## Scope

- `D:\Yellow\runtime\order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`
  only, after its Vite build has regenerated `public/yellow-next`
- only the existing `yellow-public-demo` Docker `app` service and its existing
  Cloudflare Quick Tunnel
- source, local HTTP, external HTTP and published-asset postflight evidence

## Preconditions

- Order 492 cashier review is accepted by a non-implementing reviewer.
- Existing target backup is retained and verified.
- No database, volume, migration, seed, identity/contact, provider, credential or
  tunnel configuration is changed.

## Required behaviour

1. The Today-board `Prepare check-in` action opens the embedded Overwatch arrival
   journey and displays canonical blockers; it does not navigate to the legacy
   detail-only check-in page.
2. Cashier selects a canonical reservation and folio, displays the authoritative
   immutable statement and server-provided transaction options, then can call only
   the existing canonical charge endpoint after an explicit confirmation.
3. The target asset contains both the arrival and cashier markers; local and
   external public routes return HTTP 200 after rollout.
4. An independent reviewer inspects target-bound release evidence before this order
   is closed.  Any failed check restores the retained app image only.

## Exclusions

- No actual financial posting, check-in, reconciliation, raw DML, seed change,
  real guest data, public credential, payment, channel/provider activation or
  database migration.
