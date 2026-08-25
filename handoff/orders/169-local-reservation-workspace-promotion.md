# Order 169 — Local reservation-workspace promotion

**Status:** READY — guarded founder local update
**Phase:** 5 · local operations
**Branch:** `phase-5/local-reservation-workspace-promotion`
**Base:** `5025f37` (independently approved Order168 evidence)
**Risk tier:** 2 — loopback-only app replacement
**Owner:** Codex operations; independent post-cutover verification

## Outcome

Build exact approved Order168 source `ca024ee`, stage it against the retained Order163
database/Valkey/credential handoff, prove the real reservation board/detail/create
surface, then replace port 3002 and port 3000 one at a time with immediate rollback.

## Scope

- exact approved source/image build and loopback staging only;
- app-container replacement on 3002 then 3000 only;
- redacted health/auth/status/board/detail/offer asset/API smoke evidence;
- this order, additive D-436, `handoff/LEDGER.md`, and one additive operational review.

No database, Valkey, volume, network, credential, role, permission, data, source,
schema, migration, public bind, merge, push or destructive rollback cleanup is in scope.

## Required behavior

1. Record exact source, image and retained rollback identities without printing secrets.
2. Staging is loopback-only and passes health, authenticated property/status, approved
   asset markers, bounded reservation board, UUID detail and current bookable offer.
3. Replace 3002 first while 3000 stays healthy, then 3000 while 3002 stays healthy.
   Final containers are distinct, healthy and serve the exact approved image.
4. Any failed new-container check restores the immediately prior app. Preserve all
   database/cache/credential/data state and stopped rollback containers.

## Definition of done

- [ ] Ports 3000 and 3002 serve exact approved Order168 source.
- [ ] Board/detail/create prerequisite smoke passes on both ports.
- [ ] Independent operational review approves final local state.
