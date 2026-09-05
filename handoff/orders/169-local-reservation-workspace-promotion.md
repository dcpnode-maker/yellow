# Order 169 — Local reservation-workspace promotion

**Status:** APPROVED-LOCALLY — independent operational review complete
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

- [x] Ports 3000 and 3002 serve exact approved Order168 source.
- [x] Board/detail/create prerequisite smoke passes on both ports.
- [x] Independent operational review approves final local state.

## Redacted promotion evidence — 2026-08-26

- Approved source: `ca024eeeebe6560e3e7983c155ee2b344beb1c1d` with independent
  evidence `5025f374e8538e0b0b1ebeba863412e5e43f7c21`.
- Runtime image: `sha256:acb60c5184255e118472bca3ee36db40f85476db4a864cd0051ba6f1a47e3d65`.
- Temporary loopback staging on 3103 passed health, exact approved asset markers,
  local login, one granted property, authenticated status, bounded board (six current
  records), UUID aggregate detail and five current bookable offers; staging was removed.
- Guarded 3002 replacement passed the same smoke while 3000 stayed healthy; guarded
  3000 replacement then passed while 3002 stayed healthy.
- Final app containers are distinct, healthy, loopback-bound and serve the exact image.
  The prior Order165 image `sha256:d3615de2f1ff61d233638bebd6814a5ccde394bbce380f79026861962e6d0db7`
  remains in two stopped rollback containers.
- Retained database, Valkey, network, volumes, credentials and application data were
  not modified by this app-only promotion. No secret value was recorded.

## Independent operational verdict

Approved locally by an independent non-operating OpenAI Codex reviewer at exact
evidence `34422233db21a14fe81cd38e51eda27eb7520c0c`. See
`handoff/reviews/169-local-reservation-workspace-promotion.md`. Approval is limited to
the final loopback app state and does not authorize merge, push, public exposure,
production deployment or destructive rollback cleanup.
