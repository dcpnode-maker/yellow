# Review 418 — Public React reservation-detail route

Date: 2026-09-20

Reviewer: independent `/root/public_checkin_review` agent. The reviewer did not
implement the reviewed runtime changes and performed no mutation.

## Reviewed runtime

`D:\Yellow\runtime\order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`

The runtime-only public surface adds a React reservation detail and check-in
readiness screen to the temporary synthetic-demo tunnel. It uses the existing
authenticated reservation detail, readiness and check-in endpoints; it does not
add a server, migration, permission, credential or direct database path.

## Independent findings

- Initial review found that malformed `/p/:property/res/...` paths fell through
  to the passwordless legacy operator shell. That was not acceptable as a route
  containment boundary.
- The implementation was corrected in `tools/public-demo-css-proxy.ts` to serve
  React only for an exact lowercase UUID detail route and to return 404 for every
  malformed or extra-path reservation-detail route.
- The reviewer independently rechecked the live loopback edge after that fix:
  `/today` returned React 200; a UUID detail returned React 200; `res/not-a-uuid`
  and `res/<uuid>/extra` returned 404 and neither returned legacy markup.
- The reviewer independently ran:

  ```text
  bun test tests/public-demo-proxy.intentional-red.test.ts tests/yellow-voice-routing.test.ts tests/operator-checkin-workbench.integration.test.ts --timeout 120000
  ```

  Result: 12 passed, 0 failed, 48 expectations. `bun run typecheck` passed.

## Confirmation assurance

The public UI requires a current readiness result plus a visible visitor checkbox
before enabling its Check in guest button. The existing server endpoint separately
locks and revalidates authority and readiness in the tenant transaction, and creates
the existing state/fact/outbox effects atomically.

This is a *UI confirmation gate*, not a security boundary against an intentionally
full-access public synthetic-demo visitor who chooses to call the authenticated
same-origin endpoint directly after receiving the automatic demo session. Do not
describe it as server-attested human confirmation or use it as a production access
control. Production requires normal identity and authorization policy rather than a
temporary passwordless demo session.
