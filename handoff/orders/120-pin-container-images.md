# Order 120 — Pin external container image references

**Status:** IMPLEMENTED; independently approved at exact executable SHA `0ca144b9eb7ad3dcc13c1cac5931c89560e13448` under D-351
**Phase:** 5 · supply-chain hardening  
**Branch:** `phase-5/pin-container-images`  
**Base:** `73f933ae38f1b5d5628e6e0f416a9fbf01a338eb`  
**Risk tier:** 2 — build/runtime provenance and CI supply-chain control  
**Finding:** sealed Cyber `supply-chain.mutable-container-tags`, occurrence
`occ_b05bc911e6d4fb6de7b6382e`  
**Owner:** Codex implementation; independent non-implementing reviewer required

## Outcome

Make every external OCI image reference in the application build and local
runtime configuration immutable without changing application behavior, the
database image, CI action pins, supported platforms, or the zero-cost operating
model.

Order 119 has received independent approval at exact corrected SHA `7ba93e4` and
its D-347 record is integrated here. This order must not overlap or claim Order 118
database-role work. Preserve Graphify artifacts, skills, and all product behavior.

## Provenance already verified

The coordinator independently ran `docker buildx imagetools inspect` on
2026-08-24 and supplied the following OCI index evidence:

- `oven/bun:1.3.14-alpine` →
  `sha256:5acc90a93e91ff07bf72aa90a7c9f0fa189765aec90b47bdbf2152d2196383c0`
  (AMD64 + ARM64).
- `valkey/valkey:8.1.9-alpine` →
  `sha256:e0eb7c480958d32bdc4357a74bdd70653ae15f2f9b4c93c4a5a9fad1dc471c84`
  (AMD64 + ARM64 + ARMv7 + PPC64LE).

The current local `valkey/valkey:8-alpine` resolved to the older
`sha256:a038175...`, while the registry major tag now resolves to the newer
release, directly demonstrating mutability. The exact Bun and Valkey digests
above are coordinator-provided provenance; the implementer must not invent,
shorten, or refresh them.

## Scope

- `Dockerfile` — replace all three `oven/bun:1.3.14-alpine` `FROM` references
  with the exact release tag plus the verified OCI-index digest.
- `docker-compose.yml` — replace `valkey/valkey:8-alpine` with the exact
  `valkey/valkey:8.1.9-alpine` tag plus the verified OCI-index digest.
- `scripts/check-container-image-pins.ts` — add a zero-network static validator
  for the committed Dockerfile and Compose image references.
- `tests/container-image-pins.test.ts` — test the validator's parent-red and
  green contracts using temporary text fixtures only; never contact a registry,
  pull an image, or inspect a running container.
- `handoff/orders/120-pin-container-images.md` — this order and its evidence.
- `DECISIONS.log`, `handoff/LEDGER.md`, and the independent review record only
  for exact builder/reviewer provenance after their respective gates.

Anything not listed is out of scope. If a required file is missing from Scope,
stop and write a question; do not widen Scope silently.

## Required work

1. Pin each Bun stage to the exact equivalent of
   `oven/bun:1.3.14-alpine@sha256:5acc90a93e91ff07bf72aa90a7c9f0fa189765aec90b47bdbf2152d2196383c0`.
   Keep the tag visible for auditability; do not change stage names, commands,
   users, copied files, or runtime environment.
2. Pin Compose Valkey to the exact equivalent of
   `valkey/valkey:8.1.9-alpine@sha256:e0eb7c480958d32bdc4357a74bdd70653ae15f2f9b4c93c4a5a9fad1dc471c84`.
   Do not alter ports, command, healthcheck, volumes, or service dependencies.
3. Leave the already-pinned PostgreSQL reference unchanged:
   `postgres:16.15-alpine@sha256:ab5c955e9e57ae9879d4411ab49a912be9d162455676f7bf56e951b11ac73785`.
   Leave all SHA-pinned GitHub Actions unchanged.
4. The validator must parse the committed text and require every external
   Dockerfile `FROM` and Compose `image:` reference to contain a full
   `@sha256:<64 hex>` digest. It must reject mutable tags, missing digests,
   digest-only substitutions that lose the expected release tag, unexpected
   image names, and changes to the expected PostgreSQL reference.
5. The validator must be deterministic, filesystem-only, and independent of
   Docker, registries, credentials, network access, host architecture, and
   environment variables. It must not inspect image metadata or resolve tags.
6. The focused test lives under the default `bun test` discovery path, so the
   unchanged quality job executes it permanently. Do not edit CI/package scripts
   or weaken any existing quality, container, database, Windows-state, licence,
   audit, schema or referee gate.

## Forbidden

- Any image pull, registry query, credential inspection, container start/stop,
  Docker daemon interaction, or network access in the validator/tests.
- Inventing, truncating, re-resolving, or silently refreshing a digest.
- Editing `migrations/`, application/domain code, tests outside this Scope,
  `package.json`, `bun.lock`, CI, `docs/`, Graphify output, skills, or active
  Order 118/119 files; governance files may record only this order's exact evidence.
- Changing PostgreSQL, GitHub Action SHAs, runner labels, Compose topology,
  platforms, ports, healthchecks, dependency policy, or product behavior.
- Replacing the images, using `latest`, floating major/minor tags, adding a
  private registry, adding a dependency, or introducing a paid service.
- Treating a locally built CI tag such as `yellow-ci-app:${{ github.sha }}` as
  an external provenance substitute; its base references must still be pinned.
- Self-review, self-merge, sibling-Cyber-finding claims, or weakening red tests.

## Pre-registered proof

### P0 — committed parent-red proof

Before editing configuration, run the validator against the exact parent
`73f933ae38f1b5d5628e6e0f416a9fbf01a338eb` and capture a real failing result:
the three mutable Bun `FROM` references and mutable Valkey image must be
reported, while the existing PostgreSQL digest passes. This proof must read
the committed parent files, not reconstructed strings or a test-only fixture.

### P1 — static green and exact references

After the configuration edit, the validator passes and asserts exactly the
three Bun references, the exact Valkey 8.1.9 reference, and unchanged pinned
PostgreSQL reference. It proves no external `FROM`/Compose `image:` reference
lacks a full digest and no mutable external image remains.

### P2 — validator negative cases

Filesystem-only fixtures prove red for a missing digest, malformed digest,
mutable tag, wrong digest, wrong release tag, unexpected image, and changed
PostgreSQL reference. They prove green for the exact committed references.

### P3 — platform and behavior proof

The order records that the supplied digests are OCI indexes, not
architecture-specific child manifests. Docker build/health and isolated
`setup.sh --db-only`/11-of-11 referee gates must pass on the supported CI/local
paths without changing application or database behavior. No test may require
both architectures to be present on the executing host.

### P4 — standing integrity proof

Run frozen install, typecheck, complete tests, import boundaries, licence check,
dependency audit, schema drift, protected-file hashes, container smoke, and the
isolated database/referee acceptance gates. Record failures as preconditions or
assertions under D-88; never resume after an assertion failure.

### P5 — independent review

A Tier-2 non-implementing reviewer personally reruns P0 against the exact parent,
P1–P3 against the immutable implementation SHA, and confirms the two supplied
OCI-index provenance records. Builder output is not independent proof.

## Definition of done

- [x] Order 119 independent approval is recorded and integrated before P0.
- [x] P0 parent-red is a committed real-file failure before configuration edits
  (`366e5835de7c95d9061befb2140c5600f69a3169`).
- [x] All three Bun `FROM`s and Compose Valkey are exact tag-plus-digest pins.
- [x] PostgreSQL and all action SHAs are byte-for-byte unchanged.
- [x] Static validator and negative tests are filesystem-only and zero-network.
- [x] P1–P4, standing gates, and 11/11 referee are green per the builder evidence
  below.
- [x] Independent Tier-2 review personally executes the required proof on the
  immutable current-line SHA.
- [x] No sibling finding, Order 118, or Order 119 work is claimed.

## Builder evidence — review-ready, not approved

Exact executable implementation SHA: `0ca144b9eb7ad3dcc13c1cac5931c89560e13448`.
The required P0 red proof was committed first at `366e5835de7c95d9061befb2140c5600f69a3169`.
The coordinator independently completed P3/P4 on disposable project
`yellow-order120-gate`: pinned Compose PostgreSQL and Valkey were healthy, the
application returned HTTP 200 with exact body `{"status":"ok"}`, standalone
container smoke passed, and `setup.ps1 -DbOnly` passed 11/11 with 85 tables.
Frozen install had no changes; exact schema and protected hashes matched
baseline `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`
and referee hash
`3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1`.
Focused validator/tests passed 4/4 with 7 assertions; standing checks passed
170/0 with 395 skipped and 1,931 assertions; typecheck, 64 import boundaries,
23 licences, and audit were clean. This is builder evidence only. P5 remains
open for an independent Tier-2 reviewer to personally execute the proof and
approve this exact SHA; no merge, push, deployment, or sibling finding closure
is implied.

## Update workflow

The implementer records the parent-red output, implementation SHA, exact static
green output, and standing-gate results in the review request. The independent
reviewer records the provenance and executable verdict. Only after that verdict
may the order be marked implemented/reviewable and the coordinator update the
handoff ledger or project status. Any digest discrepancy, platform mismatch,
scope pressure, or Order 119 approval absence stops the order and requires a
question rather than an invented choice.
