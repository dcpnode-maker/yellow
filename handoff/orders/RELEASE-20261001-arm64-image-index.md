# RELEASE-20261001 — native ARM64 PostgreSQL image index

Status: implementation and independent local proof complete; genuine native
ARM64 CI acceptance remains pending. Source-publication acceptance is recorded in
the separate independent review. Phase 7 release successor.
Source basis: `937912cc0546bfe7b7cd8b3c082f8ef798c20e5b`, isolated
`phase-7/release-local-gates-20261001`; draft PR98. Founder authorized resolving
release blockers; no additional product, spending or deployment decision is needed.

## Verified problem and finite remedy

CI36813515138 free-host-arm64 verifies a native ARM64 runner and ARM64 Yellow
images, but Compose starts the pinned PostgreSQL amd64 child manifest and the
unchanged forty-attempt readiness check fails. Container logs were not retained,
so the server-side startup failure mode is unknown. Do not lengthen or skip it.

Official `docker.io/library/postgres:18.6-alpine3.24` OCI index bytes resolve to
`sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873`.
Its native linux/amd64 descriptor is the EXISTING child
`sha256:d8703cd7fba306b9fec9268ecedfa8a966846c053036a60e3635791957eb2f66`;
its linux/arm64/v8 descriptor is
`sha256:89f747171c4b0af0eacf5984550060be79786dbe286eb60cfa691d79d1e8b23f`.
Pin that exact index while retaining the exact version/tag, AMD64 child bytes,
storage, authority, deadlines, images for other services and all schema/domain code.

## Scope (exhaustive)

- `docker-compose.yml`: PostgreSQL digest only, child to verified OCI index.
- `scripts/check-container-image-pins.ts`: exact expected PostgreSQL digest only.
- `tests/container-image-pins.test.ts`: regression rejects the superseded
  single-architecture child while retaining all existing validation assertions.
- `tests/runtime-storage-containment.test.ts`: exact PostgreSQL pin expectation;
  every exposure, storage, restart, logging and core-limit assertion retained.
- This order, `handoff/questions/RELEASE-20261001-arm64-image-index.md`, and
  `handoff/reviews/RELEASE-20261001-arm64-image-index.md`.
- Append-only `DECISIONS.log` and `handoff/LEDGER.md`.

No other file changes, retries, setup/readiness/referee/CI edits, migrations,
mutable tags, emulation, credentials, real guest/payment operations, laptop bulk
integration, merge or deployment. Old receipts remain source-bound and preserved.

## Proof and acceptance

1. Independent non-implementer fetches exact official index bytes, checks digest,
   native AMD64/ARM64 descriptors and unchanged AMD64 child; save safe receipt.
2. Focused pin/containment tests, actual committed-file pin CLI, type and boundary
   checks; source diff must contain only admitted changes and unchanged safeguards.
3. Unchanged `./setup.sh --db-only` must produce `11 passed, 0 failed` on the owned
   synthetic proof stack before publication. Record its effective native image.
4. Independent review freezes source paths and approves bounded source publication.
   Fast-forward the existing isolated PR branch; do not merge or deploy.
5. Genuine native ARM64 CI must then pass PostgreSQL readiness, migrations,
   canonical referee, exact-source /ready and synthetic login under the original
   bounds. Local AMD64 proof alone cannot close ARM64 acceptance. Track every
   other required CI job and distinguish GitHub's synthetic merge revision from
   the reviewed branch commit by exact Git-tree identity.

Laptop receiving hashes/hunks and immutable serving revision remain separate
required evidence; no claim of laptop/live or full PMS/CRM completion.

## Executed local evidence

Independent official-index receipt verifies10293 exact bytes and both child
manifest hashes; native AMD64 bytes are unchanged. Personal focused9pass/0fail/37
assertions, actual committed-pin CLI, types and207 import-boundary checks pass.
Unchanged canonical setup produces `11 passed, 0 failed of 11`,130 current tables
in5.31s with the effective index resolving to the existing native AMD64 image.
The first canonical attempt correctly rejected an active runtime session at
immutable migration0012; that RED is retained. Only the exact owned synthetic app
was paused for the successful proof and the same container/image was restored.
No schema guard or deadline was changed. Native ARM64 execution is still pending.
