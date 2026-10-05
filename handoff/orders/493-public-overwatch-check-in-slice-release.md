# Order 493 — Public Overwatch check-in slice release

## Objective

Release only the independently reviewed, source-frozen Order 492 embedded Overwatch
check-in slice to the one `yellow-public-demo` runtime, retaining a tested rollback
image and proving the published route serves the intended asset.  This is a UI-only
release: the database remains at its current ledger and no seed, migration, or
operational record is changed.

## Scope

- `D:\Yellow\runtime\order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`
  Docker build context, limited to the already reviewed Order 492 source bytes
- the running local `yellow-public-demo` Docker compose application service
- existing Cloudflare Quick Tunnel endpoint, read-only availability checks
- an image/asset/HTTP rollback and post-release receipt

## Preconditions

- Order 492 independent review is accepted for its bounded check-in slice.
- A restorable target database backup exists and its archive listing has verified.
- No database container, volume, migration runner, provisioner, seed script, or
  environment credential is changed.

## Required behaviour

1. Capture current container/image/health state and retain a named rollback image.
2. Build the application image from the frozen reviewed source and replace only the
   `app` service using the existing local binding.
3. Verify local and external `today` routes return HTTP 200, the new bundle contains
   the embedded Overwatch journey marker, and the old public default/redirect is not
   introduced.
4. Independently review the target-bound release evidence.  If build, health or
   published-asset verification fails, restore the retained prior image and record the
   failure without database intervention.

## Exclusions

- No database migration/reconciliation, contact cleanup, public data export, actual
  check-in action, cashier posting, real guest data, tunnel account change, cloud
  credential, channel/provider activation, or release of the broader Order 492 scope.
