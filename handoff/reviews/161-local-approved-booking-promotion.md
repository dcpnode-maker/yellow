# Operations evidence — Order 161 local approved booking promotion

**State:** BUILT LOCALLY — independent post-cutover verification pending
**Approved executable:** `a4178ce4b3bdf1fd95b097439287802a1edb7f8c`
**Runtime image:** `sha256:83a51f63ff284cab011b3405429ff3fda74bc6fc05251dbf591f271bf2433665`
**Operator:** OpenAI Codex operations
**Date:** 2026-08-25

## Scope and source identity

I read `PROJECT.md`, ran `./state.sh`, read Order161 and D-428, and operated only on
the local Docker resources and additive evidence admitted by the order. I made no
product, test, migration, schema, role, permission, dependency or status-source edit.
There was no merge, push, public exposure or destructive cleanup.

The runtime image was built from a clean detached source tree at exact approved
Order160 executable `a4178ce4b3bdf1fd95b097439287802a1edb7f8c`. The executable-to-evidence
head diff contained only Order160 review/ledger evidence. Protected SHA-256 values
matched:

- immutable baseline: `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`;
- referee: `2afa95bb7c02cd9637ffc9c3df00d1ddf7cfc5d8d31c4fd8fad29b950c1a418d`;
- fixture: `bf71d8fc2987126db61ca3105e5d5cb5a4f48b9e2eba09d8b7fc1f3441fd4c62`.

The runtime-stage image carries both `org.opencontainers.image.revision` and
`yellow.source_commit` equal to the full approved SHA. The local app tag resolves to
the exact image ID above.

## Pre-mutation and rollback identities

Before any container mutation I recorded the following exact identities:

- superseded preview `yellow-order159-candidate-preview`: container
  `f415987680ef50bc6b414666936343b3ad4b90d75c95c53c38e2993072d1455e`, image
  `sha256:e38a41337163f6a120fe5ee7b452a603112ff2aaaf44c6953246f7009acd1736`,
  source label `d8a01f97585beb48b15cc4382679399b8a4aad3c`, on the retained Order147 network;
- permanent app `yellow-order147-founder-status-progress-final-app-1`: container
  `97370e60446ed145fede9e8620a8a0aa60d65145ff32a65dba1d5569ea56fa9c`, image
  `sha256:050286a826f3eea99305ef900f01181251f1e0d3c4fc1d83b887b3138ac3de53`,
  healthy on loopback port 3000 and the retained Order147 network;
- old PostgreSQL: container
  `95dff7e8bbffa69e2746d53834a335a4f54256d2c02f80ea4005b5123bcd6769`,
  healthy, with retained volume
  `yellow-order147-founder-status-progress-final_yellow-pgdata`;
- old Valkey: container
  `afc46167f045f52a93afed35f9002fbcf5a11a95d85193f449086f8c7cf09edc`,
  healthy.

The exact old app image is additionally retained as
`yellow-local-app:rollback-pre-order161-20260825T174233Z`. After cutover its image ID
still equals the recorded old image. Both superseded app containers remain intact and
stopped; the old PostgreSQL and Valkey remain running and healthy, and the old network
and database volume remain retained. No setup, migration or seed command targeted the
old project.

## Fresh governed stack

The Order161 authority file described by the order was absent. `setup.sh --db-only`
created fresh distinct private authority securely at the ignored, owner-restricted
Order161 runtime path; no secret value was printed. Project
`yellow-order161-local-active` uses a distinct network and named volume, with
PostgreSQL bound only to `127.0.0.1:5642` and Valkey only to `127.0.0.1:6589`.

All 17 migrations and the normal seed completed. A fresh referee run returned
**11 passed, 0 failed of 11**. The governed review seed completed against the final
fresh database `yellow_order161_dual`, producing the configured local-review
property, inventory and active rate release. Earlier fresh databases remain
preserved in the same new volume after discarded harness preconditions; none was
deleted or reused as the active database. The final database received all 17
migrations before the exact governed seed was rerun idempotently.

At final capture the fresh resources were healthy:

- port-3000 app container
  `e3d4d29e1befe12429d9732e20f5eff33cd790c17b6767e867fd76f11979dcc7`;
- port-3002 preview container
  `473732367d9a5e6d0ebc067c7a6b83ce4d4aa6dc475fdc95a9f8ab55683e3af1`;
- PostgreSQL container
  `910564d1748f54dfb046d9fccf72faff0c9146d25a2531d538e55ea73ce83a7d`;
- Valkey container
  `559a137226d82ef26aabd8a13a9a32aefea811441e04b7cd7ad186a9d3570f84`;
- network `yellow-order161-local-active_default` and volume
  `yellow-order161-local-active_yellow-pgdata`.

## Port-3002 preview proof

Only after an exact container/image/source/network/port guard succeeded did I stop
the superseded Order159 preview. The approved image then served on loopback port
3002 with matching image ID, both exact revision labels and healthy status.

One redacted authenticated synthetic journey passed through served HTTP on the
dedicated preview container:

`login 200 -> one granted property -> Party create 201 -> masked Party search ->
availability 200 with server-returned bookable offer -> hold 201 active -> reservation
commit 201 -> byte-equivalent replay -> confirmation GET 200`.

The accompanying live-status response was operational for both app and database,
with tenant context present. No identifier, contact, token, password or raw
idempotency key was printed or retained in this evidence.

## Port-3000 cutover proof

After preview success, a second exact guard matched the recorded old permanent app.
I tagged its exact image for rollback, stopped only that app, and started a distinct
approved candidate app on loopback port 3000 using the same exact image ID proven on
3002. Final inspection shows both containers simultaneously healthy, with the full
approved revision in both OCI labels: one publishes only `127.0.0.1:3000`, and the
other only `127.0.0.1:3002`.

Health returned `ok` simultaneously on both ports. A second complete bounded
authenticated journey on port 3000 also returned login 200, one granted property,
Party create 201, masked Party search 200, bookable availability 200, active hold
201, reservation commit/replay 201 and confirmation GET 200. Its live status reported
app/database operational with tenant context. The preserved Order159 preview
container is stopped, not removed. The historical status snapshot correctly remains
latest-built 155 / current 156; deployed identity is the OCI revision and image ID,
not a fabricated snapshot update.

## Discarded preconditions and credential handling

- The documented Compose `database-tools` review-seed form failed before loading app
  code because that image omits `src`; it made no review mutation. The governed host
  seeder was then used successfully.
- A WSL Git precheck could not resolve the Windows worktree `.git` pointer; the clean
  exact tree and ancestry were already verified with Windows Git before build.
- An initially inferred full container-ID guard rejected itself before mutation; the
  guard was corrected from direct inspection and rerun successfully.
- Bun stdin and `/dev/stdin` harness forms failed before smoke mutation; the equivalent
  redacted `bun -e` served-HTTP harness passed.
- Shell exits discarded generated review-password copies, so I created additional
  fresh databases rather than reset or reuse data. An attempted review-password
  rotation against an already seeded database failed closed before change because
  the user was not byte-exact. The final active database was freshly migrated and
  seeded; all unused fresh databases remain preserved.
- The first port-3000 cutover incorrectly recreated one Compose app sequentially and
  left port 3002 unbound. Independent review stopped acceptance immediately. I
  stopped the candidate, restarted the exact retained old app, and proved Docker
  health `healthy` plus served `/health` = `ok` before retrying. No old database or
  Valkey mutation occurred. I then used two distinct containers from the exact same
  approved image and reran both endpoint proofs.
- A first attempt to prepare the final dual-container database reached migration
  0012 while a provisional preview held a runtime session. The migration failed
  closed as designed. I drained only that preview, applied migrations 0012–0017,
  and reran normal and review seeds idempotently before either final app started.
- PowerShell HTTP helper attempts failed before request dispatch because an
  unsupported parameter was used; a subsequent PowerShell availability payload
  was rejected with 400 before hold/commit. The Bun served-HTTP harness then used
  the production UI contract and passed both full journeys.

All authority, DSN, password, token and smoke-key shell copies were cleared after
verification. This record deliberately omits their values. The mandatory rollback
was successfully exercised after the first topology miss; no rollback was required
after the corrected simultaneous cutover because every acceptance check passed.

## Handoff

The local promotion is operationally complete but is **not self-approved**. An
independent non-operating reviewer must inspect the retained identities, execute the
post-cutover health/login/live-status and rollback-retention proof, and record the
Order161 verdict.
