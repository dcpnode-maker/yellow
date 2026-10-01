# BOOKING-20261002 — Invitation guest booking context

Status: bounded implementation authorized; independent review required before acceptance.
Basis: `phase-7/guest-booking-context-20261002` at `bdb94cad`.
Parent integration and final app/server route edits remain with the laptop controller.

## Goal

Give an invitation-bound guest an authenticated, property-local context response
before they construct stay instants. It exposes the authorized property's canonical
name and IANA timezone, permitted active rate-plan display details, and bounded
sellable-unit display details. It does not create a booking or infer booking dates,
stay instants, check-in/out times, guest identity, or commercial terms.

## Scope

- `src/contexts/reservations/guest-booking.ts`: add a context read method that uses
  the existing invitation session object, repeats current live issuer authority,
  then reads the property, allowed active plans and linked active sellable-unit
  display data under the caller's tenant transaction.
- `src/http/guest-booking.ts`: add a context action on the existing guest bearer
  boundary. Require an exact empty JSON object body, no query string, and same-origin
  comparison when an `Origin` header is present. Preserve current no-store response,
  generic errors and per-session request budget. Keep the encoded response at or
  below 1 MiB. Reject more than 4096 unit rows; never silently truncate.
- Focused context unit and HTTP tests in the existing guest-booking test files (or
  a narrowly named new context test file if separation materially improves clarity).
- One additive context case in `tests/guest-booking.integration.test.ts` under
  the existing owned fixture, recorded in questions/BOOKING-20261002-context-native-proof.md.
- Bound invitation quote/hold envelope-expiry safety closure, recorded in
  questions/BOOKING-20261002-context-token-expiry.md; no token format change.
- This order and `docs/contracts/GUEST-BOOKING-INVITATION-20261002-CONTEXT.md`.
- A separate proposed `src/app.ts` route hunk handoff at
  `handoff/patches/BOOKING-20261002-context-route.patch`. Do not edit app/server in
  this worker; the parent laptop integrates the hunk after review.

No migration/schema/snapshot changes, no new grant or table, no guest token format,
issuance or reservation mutation changes, no anonymous session or Party/contact
details, no frontend work, no credentials, network calls, real data, purchase,
provider action, or local runtime action. Preserve migration0104 byte-for-byte.

## Authority and query constraints

1. The method accepts the opaque, service-authenticated session and transaction;
   it never decodes caller tokens or trusts path/body tenant/property/party/plan IDs.
2. Run live `#authorize` before the bounded read and again validate returned rows
   against the exact session tenant/property and allowed plan identifiers. Foreign,
   revoked, missing, inactive, or incoherent authority fails closed.
3. Derive query joins and active/sellable semantics from existing schema and canonical
   reservation/rate readers. Use explicit tenant, property, and allowlist predicates.
   Return property id/name/timeZone, allowed active plans id/code/name, and only
   existing display metadata for unit types and sellable units. Do not include Party,
   actor, tenant, scopes, tokens, raw configuration, prices, or fabricated defaults.
4. Validate the returned property timezone as an IANA timezone identifier. Recheck
   service wall-clock session expiry after all reads. Do not derive stay dates or
   instants on the server; there is no existing authoritative check-in/out-time
   source in the bounded schema surface, so omit those fields.
5. Choose and document a response budget at or below the transport's 1 MiB cap.
   Count at most 4096 unit rows as a hard bound and fail closed on excess.

## Transport and proof

Proposed route: `POST /api/public/booking/context` through the existing invitation
guest bearer boundary. Exact `{}` body, no query string, `Cache-Control: no-store`,
and when `Origin` is present require exact origin equality with the request URL.
No wildcard CORS, redirects, token in URL, or new staff route.

Focused tests must cover allowed tenant/property/plan joins, no excluded plan or
foreign unit leakage, revoked/missing authority, malformed/missing timezone, exact
empty body, query rejection, optional strict origin, body and row bounds, JSON
response limit, generic failures, and rechecked expiry. Typecheck and focused suites
are required. The parent laptop owns app/server integration, complete standing,
proof and independent review. No acceptance or release authority is implied.
