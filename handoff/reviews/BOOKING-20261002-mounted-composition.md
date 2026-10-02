# Independent mounted booking composition proof

Status: **mounted composition proof passed** in a disposable detached worktree. This
review adds evidence only; the original public-booking `src/app.ts` and `src/server.ts`
were left unchanged.

## Composition checked

The proof assembled the exact candidate `createApp` and `createServer` TypeScript
files with the selected invitation-context and public-site TypeScript source from the
public-booking candidate. It exercised actual Elysia `createApp` with both
`GuestBookingHttpApi` and `PublicBookingHttpApi` mounted at once, using controlled
in-memory database, service and site-authority ports. It did not start a server or
connect to PostgreSQL.

The executable proof passed **2 tests, 0 failures, 33 assertions**. It covered the
invitation context, public site session start, all five public storefront commands,
and staff site publication. The staff publication used a signed HMAC tenant token
resolved by `BearerTenantResolver` and the existing `withOperatorTenant` middleware;
the handler received the expected tenant, actor, property and transaction. It also
checked the public and invitation bearer domains separately, invalid staff-token
rejection before a tenant transaction, unknown-route and absent-capability 404s, and
no-store response headers.

Guest context and public-site foreign-Origin requests returned 403 before opening a
tenant transaction, resolving a site, or calling a domain action. A signed staff
publication request with a foreign Origin also returned 403 and stopped before the
publication authority, savepoint or other fixture effects. As required by the
existing operator boundary, `withOperatorTenant` opens the staff tenant transaction
before the publication handler checks Origin; the proof records that transaction
boundary rather than replacing the middleware.

## Reproduction and hashes

The detached proof worktree is `/workspace/yellow-public-booking-mount-proof`, based
on `7b64ede37a4ded1ffe2e77295f2d3e95b30442be`. Candidate app SHA-256 is
`d4b5e07d85972fb936eb70bb08ce29cbc39d928f18f73d5c7b24acab8e65990d`; candidate
server SHA-256 is
`e95c3e0af62eba7c60aefe751d9a9aa82b780e94fb3f667b16ff63db01cfd3cc`. Both copied
files match the parent-provided candidate copies byte-for-byte.

The proof test SHA-256 is
`e2e8bd226159e5dab3bb68435a4186593a757c4d19832996c212460267a64509`. Focused
invocation:

```sh
PATH=/workspace/yellow-toolchain:$PATH bun test tests/public-booking-mounted-composition.proof.test.ts
```

The source-only TypeScript check and the whole-project `bun run typecheck` both pass
for the assembled tree, including `app.ts` and `server.ts`. The first full typecheck
was RED because the base checkout had build-readiness fixtures pinned to migration
104 while the selected source build-info literal is 105. I overlaid only
`tests/build-readiness.test.ts` and `tests/build-readiness.integration.test.ts` from
the canonical 105 public-booking candidate, preserving their complete assertions;
the aligned full typecheck then passed. The pre-alignment RED is retained in the
external results directory. The exact fixture input hashes are
`9aab9b449f3a7a141f13431d08c182eb4a315e3eff372cfd935aebd91812c8be` and
`b1e0e25ac7681d23084b6a0ce8a4d1b4ae58989d29b4e1a3fa70343c54fc6e3d` respectively.
`git diff --check` passed.

The executable test copy, safe logs, source-only `tsconfig`, and JSON hash/result
manifest are retained in this packet under
`handoff/proofs/BOOKING-20261002/mounted-composition/`; original private execution copies remain outside Git under
`/workspace/yellow-coordination/public-booking-proof-20261002/mounted-composition/results/`.

This proves route composition in the selected candidate tree. It does not establish a
running server, a PostgreSQL write, public-site activation, or deployment.
