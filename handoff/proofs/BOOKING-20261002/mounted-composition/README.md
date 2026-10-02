# Mounted composition reproduction

Use a separate disposable checkout of the published public-site candidate; never apply proof overlays to the laptop serving/dirty checkout. Install the pinned Bun dependencies normally.

Apply the separate public-site app/server patch first, then the invitation-context route patch once:

```sh
git apply --unidiff-zero handoff/patches/BOOKING-20261002-public-site-app-server.patch
git apply handoff/patches/BOOKING-20261002-context-route.patch
cp handoff/proofs/BOOKING-20261002/mounted-composition/public-booking-mounted-composition.proof.ts tests/public-booking-mounted-composition.proof.test.ts
bun test tests/public-booking-mounted-composition.proof.test.ts
bun run typecheck
```

The proof imports actual Elysia/createApp and both HTTP APIs, with controlled in-memory service and authority ports. The personally executed result is 2 passed, 0 failed, 33 assertions; matched canonical105 full typecheck passed. These are composition checks, not a running listener, PostgreSQL transaction or public deployment. Real PostgreSQL authority/concurrency evidence is separately retained in the native canonical105 receipt.

project-typecheck.log preserves the earlier RED from base104 test metadata versus selected105 build identity. The two complete canonical105 readiness fixtures were then overlaid without assertion changes, producing full-typecheck-candidate.log. Candidate app/server and test hashes are bound in composition-proof-manifest.json. The public source checkout app/server remain unchanged; only this disposable receiving assembly received the wiring.

Applying both retained patches produces app SHA256
3d72ff0a25128ec97a7ac191fdd97b06f67f4d6858bcc72fa7d7c04d64fcad7c
and server SHA256 e95c3e0af62eba7c60aefe751d9a9aa82b780e94fb3f667b16ff63db01cfd3cc.
The reviewed assembled app hash d4b5e07d... differs only in whitespace on the
invitation-context route line; the route and handler are identical. The reproduction
comparison was actually executed; this difference is not a semantic source change.
