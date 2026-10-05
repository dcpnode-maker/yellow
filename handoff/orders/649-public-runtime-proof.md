# Order 649 — public runtime proof endpoint

## Purpose

Expose a deterministic route that reports whether the current demo request is being
served through a colleague-accessible HTTPS public host instead of only local
loopback. This supports the public URL/mobile proof gate without changing PMS state.

## Scope

- `src/demo/public-runtime-proof.ts`
- `src/app.ts`
- `src/demo/share-packet.ts`
- `src/demo/colleague-readiness.ts`
- `tests/demo-public-runtime-proof.test.ts`
- Existing share/readiness tests if they need the new route.

## Out of scope

- No permanent tunnel vendor selection.
- No founder notification or ready-to-share promotion.
- No PMS mutation, migrations, credentials or external writes.

## Acceptance

- `/api/v1/demo/public-runtime-proof` reports request URL, protocol, host class,
  `publicAccessObserved`, and mobile/public proof instructions.
- Localhost requests report `publicAccessObserved=false`.
- HTTPS non-localhost requests can report `publicAccessObserved=true`.
- Share packet and readiness evidence link to the route while preserving
  `readyToShare=false`.
