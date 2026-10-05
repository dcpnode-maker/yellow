# Order 500 — Public Overwatch folio and reservation release

## Objective

Release the independently reviewed, bounded primary-folio preparation and the
read-only unified reservation command surface to the one current public Yellow demo
runtime, with source-to-asset-to-container-to-public verification.

## Scope

- Existing runtime source at
  `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`
- Existing `yellow-public-demo` Docker Compose deployment and public tunnel
- Frontend build, health, asset-manifest, HTTP and rendered browser postflight evidence

## Required behaviour

1. The public bundle contains only the current reviewed preparation flow: distinct
   folio confirmation, authoritative readiness/detail refetch, current due-in guard,
   no automatic check-in and no client-generated financial state.
2. Reservations render one search/filter/expand surface. Stored `in_house` is shown
   as “In house”; it must not falsely label a stay as “stayover” or “checked in today”.
3. Existing public auto-entry, contact-free synthetic fixture, authorization,
   confirmation and financial invariants remain unchanged.
4. The deployment proves the same Vite asset is served by the current container and
   observed on the public URL. Rollback image tag is retained before replacement.

## Exclusions

- No database/schema/fixture migration, direct DML, folio-opening click, check-in,
  charge, actual guest/contact data, provider activation or new assistant capability.
- No claim that the remaining PMS action catalogue, Gemini Live transport, allowance,
  partial item splitting, guest messaging or F&B ticketing is complete.

## Review protocol

Order496's independent source/API review is required evidence for the financial
preparation control. A separate independent reviewer must inspect the deployed
artifact/postflight without executing a public mutation.
