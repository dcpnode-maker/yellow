# Order 605 — public Overwatch departure candidate release

## Objective

Restore the stopped post-restart public-review runtime and promote the fully green
Order 593–604 candidate so colleagues can evaluate governed departure-service
coordination, explicit AI speech consent, the repaired classic operator gallery and
the current Overwatch implementation. Preserve the configured synthetic hotel and
the completed-checkout history; never reset, reseed or silently replace public data.

## Source authority

- Candidate: `D:\Yellow\temp\order593-departure-coordination-source`.
- Current serving source: `D:\Yellow\runtime\order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.
- Public Compose project: `yellow-public-demo` with protected environment file and
  runtime override already present under `D:\Yellow\runtime`.
- Orders 593–604 and their retained review/repair evidence define the candidate.
  Do not absorb any later or unrelated main-worktree file.

## Scope

- This order and `handoff/reviews/605-public-overwatch-departure-candidate-release.md`.
- `handoff/LEDGER.md` after independent acceptance.
- A new immutable release-source copy under `D:\Yellow\runtime` made byte-for-byte
  from the candidate, excluding private/test runtime residue.
- Existing public PostgreSQL, Valkey, app and tunnel containers belonging only to
  Compose project `yellow-public-demo`.
- Forward migrations 0098 and 0099 through the production migration runner.
- App image build/recreation and public tunnel restart after local acceptance.

No product-source edit is authorized by this release order.

## Required procedure

1. Prove the candidate is unchanged after its final cumulative green run. Run the
   focused Order 593/594/599/600/604 checks, strict TypeScript, import boundaries and
   exact `setup.ps1 -DbOnly`; retain the existing complete-suite 2389/0 evidence or
   rerun it if any candidate byte changed.
2. Start only the existing public PostgreSQL and Valkey containers after the laptop
   restart. Capture their exact IDs, volumes, health, migration frontier and a
   repeatable-read/read-only preflight. Do not start the public tunnel yet.
3. Create a restorable custom-format `pg_dump` before any public migration, copy it
   outside the container, record SHA-256, and prove `pg_restore --list` can read it.
   Keep the backup; do not exercise destructive restore against the public database.
4. Retain the exact image referenced by the stopped/current app container as
   `yellow-public-demo-app:pre-order605`. Do not derive rollback from a mutable tag.
5. Apply only unapplied numbered migrations through the candidate production runner
   and the existing deploy authority. Do not run seed, review-seed, fixture,
   provision or ad-hoc DDL/DML. The ledger must advance exactly from 97 to 99 with
   the frozen local filenames and SHA-256 checksums; migration 0001 must remain exact.
6. Prove migration 0098/0099 catalogue, RLS, grants, functions and data preservation.
   Apart from migration-owned catalogue/ledger changes, every pre-existing base-table
   row multiset must be byte-stable. Existing worker time-boundary changes must be
   isolated and attributed before acceptance.
7. Copy the exact accepted candidate into a new immutable release-source directory.
   Build the app from that directory with an exact 40-lowercase-hex revision. The
   revision must be a truthfully documented release/content identity; never call an
   uncommitted tree the main Git commit.
8. Recreate only `app` from the new image. Preserve PostgreSQL and Valkey container
   identities and volumes. Do not recreate a provider, seed or worker service.
9. Verify loopback health, build-info frontier 99, frontend source/container/HTTP
   asset hashes and actual Chromium behavior at 240, 375 and 1440 CSS pixels:
   Overwatch naming, eight-interface classic gallery, compact navigation, current
   ribbons/depth cards, completed checkout read-only retrieval, speech-off default,
   departure proposal no-write behavior, separate confirmation and role-visible
   service queue/progression. Use a network guard and do not create/confirm a public
   service request during release proof.
10. A non-implementing reviewer personally executes the migration/catalogue/data,
    app identity, browser/network and rollback proof. Only after that reviewer accepts
    the local target may the existing tunnel container be started.
11. Verify the designated public origin health, root and referenced assets return
    200 and match loopback bytes. Repeat the guarded public browser checks and
    postflight data fingerprint. Notify the founder only after this passes.

## Rollback boundary

- App failure: recreate only `app` from `yellow-public-demo-app:pre-order605`.
- Database rollback is restore-only and destructive; it is not authorized by this
  order. If migration verification fails, stop app/tunnel, preserve evidence and ask
  the founder before any restore.
- Never edit or delete the existing public volumes or backup.

## Required acceptance evidence

- Frozen candidate and release-source hashes.
- Candidate tests/typecheck/boundaries/setup results.
- Pre/post container IDs, image IDs, image labels and rollback tag identity.
- Backup path, size, SHA-256 and readable archive listing.
- Exact migration ledger transition 97→99 and production-runner output.
- Pre-existing-table data fingerprint equality and post-migration 130-table evidence.
- Loopback/public HTTP, asset and guarded browser proof.
- Independent reviewer identity, commands, results, findings and disposition.

## Exclusions

- No seed, fixture, synthetic-data replacement, new operational confirmation,
  checkout, posting, settlement, payment, room-condition or occupancy action.
- No provider/model request, scraping, OTA activation, new credential, API-key
  rotation, external account, paid service or Android change.
- No merge, push, PR, migration rewrite, `migrations/0001_init.sql` edit, public DB
  restore, container/volume deletion or whole-PMS-complete claim.

## Status

**CLOSED — independently accepted 2026-09-23.** Review605 R1 accepted the exact
local target and R2 personally verified the designated public origin, byte-identical
root/assets, guarded240/375/1440 behavior and an unchanged130-table postflight after
the accepted Order606 fixture. See
`handoff/reviews/605-public-overwatch-departure-candidate-release.md`.
