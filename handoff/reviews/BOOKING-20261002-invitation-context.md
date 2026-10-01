# Independent review — BOOKING-20261002 invitation guest context

Status: **component review complete with parent gates outstanding**. Reviewed the exact
candidate on `phase-7/guest-booking-context-20261002`, basis `bdb94cad8ddccda628a6b3db7e69e4b63512f86f`.
No implementation files were changed by the reviewer.

## Reviewed behavior

- The context service accepts only a session object minted by this service instance,
  calls the live guest issuer authority before the read, scopes SQL by session tenant,
  current transaction tenant, exact property and the session's plan allowlist, then
  validates every returned row against those claims. It reauthorizes each returned
  plan, checks database and service-clock expiry after the read, and fails closed for
  missing, foreign, inactive, inconsistent or over-limit rows.
- The query returns only property name/timezone, plan code/name and nested unit-type /
  active sellable-unit labels. It uses unsuperseded price evidence for a unit type and
  exposes no Party, actor, tenant, contact, scope, token, configuration, price or
  booking date. There are no writes in the path.
- The HTTP action retains the existing bearer authentication, tenant transaction,
  session request budget, generic errors, no-store headers, strict JSON reader and
  1 MiB UTF-8 response bound. It requires an empty object, rejects URL query
  delimiters (including a bare `?`), and checks an optional Origin against the exact
  request origin.
- Timezone validation now rejects fixed offsets and noncanonical casing, accepts
  supported slash-form IANA names, and explicitly normalizes the legacy `GMT` alias
  to `UTC`. The timezone policy and negative cases are in the contract and unit test.
- The route patch adds only `POST /api/public/booking/context` to the existing
  guest bearer route chain. It does not modify `app.ts` in this candidate, as required
  by the order. Migration 0104 is unchanged.

## Independent execution

- Focused unit and HTTP suites: **29 passed, 0 failed, 125 assertions**.
- `bun run typecheck`: passed.
- `git diff --check`: passed.
- The final guarded invitation PostgreSQL runner verified its owned target and role
  setup and passed **13 tests, 0 failures, 101 assertions**. C1 proved exact property,
  timezone and active-plan metadata, unchanged fixture counts across the read, and a
  403 after revoking a required issuer grant. C2 proved a quote token with a valid
  signature but a payload deadline beyond its signed envelope is rejected with 403,
  without fixture changes. The runner receipt reports `ownership_verified: true`,
  `credentials_printed: false`, and log SHA-256
  `3a4093c01eb992ca291e14fb451e9894df56e2d612f5a63eb028174a43a1c89f`.
- Current service SHA-256 is
  `565100528c4df6ba245dff0b4c93937d4c8890a7130b1b507c79bbd8747cf18b`, HTTP adapter
  `6b5283dbf91598ae51928caa564ffafbe96d0d892c1f5df0ab4f22a36652ce7b`, and native
  integration test `07af06d7ab2c74d2b78020530525646843efd6974750ff3e48afd5dce36ba6f0`.
  The prior C2 RED is retained as historical evidence; the fixture now uses the
  native service's frozen clock when minting the test token, so it reaches the intended
  envelope guard rather than failing signature time validation.

## Parent integration still required

The `createApp` test list still covers the original four mounted guest actions, not
`/context`. The candidate order deliberately leaves the route hunk with the laptop
controller. After applying that hunk, parent integration must exercise the mounted
context route under a signed guest bearer and retain the configured/unconfigured and
method checks. This review does not claim the context route is live or mounted.

The component behavior and native proof are acceptable for integration. The mounted
route proof remains open; this review does not confer release acceptance.
