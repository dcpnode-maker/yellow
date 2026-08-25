# Order 120 independent review — immutable container image pins

**Verdict:** APPROVED

**Risk tier:** 2

**Reviewer:** independent non-implementing OpenAI Codex reviewer

**Executable reviewed:** `0ca144b9eb7ad3dcc13c1cac5931c89560e13448`

**Exact parent:** `73f933ae38f1b5d5628e6e0f416a9fbf01a338eb`

**Committed red proof:** `366e5835de7c95d9061befb2140c5600f69a3169`

## Findings

No Order 120 implementation or scope finding.

## Personally executed proof

The reviewer did not reuse builder output as independent proof.

- P0 read `Dockerfile` and `docker-compose.yml` directly from the exact parent
  Git objects and passed them to the implementation validator. All three
  `oven/bun:1.3.14-alpine` stages and `valkey/valkey:8-alpine` were reported
  mutable/undigested and unexpected; the already pinned PostgreSQL reference
  remained accepted. Inspection of red commit `366e583` confirmed that its
  test read the then-committed real files before the configuration change.
- P1 ran `bun scripts/check-container-image-pins.ts` on the exact executable
  files and received `container-image-pins: all external images are exact
  digest pins`. A byte comparison proved that the executable Dockerfile and
  Compose files equal the parent files after only the four prescribed string
  substitutions. PostgreSQL is unchanged and no GitHub Actions file changed.
- P2 ran `bun test tests/container-image-pins.test.ts`: 4 passed, 0 failed,
  7 assertions. A separate hostile matrix independently exercised missing
  digest, malformed digest, mutable tag, wrong digest, wrong release tag,
  unexpected image and changed PostgreSQL reference; every case was red.
- P3 queried the two release tags with `docker buildx imagetools inspect`.
  Bun resolved to OCI index
  `sha256:5acc90a93e91ff07bf72aa90a7c9f0fa189765aec90b47bdbf2152d2196383c0`
  with Linux AMD64 and ARM64 manifests. Valkey resolved to OCI index
  `sha256:e0eb7c480958d32bdc4357a74bdd70653ae15f2f9b4c93c4a5a9fad1dc471c84`
  with Linux AMD64, ARM64, ARMv7 and PPC64LE manifests.
- The isolated `yellow-order120-gate` stack was personally inspected: app,
  pinned PostgreSQL and pinned Valkey were all healthy. HTTP
  `http://127.0.0.1:3532/health` returned exact body `{"status":"ok"}`.
  Container inspection showed Valkey configured and running at the exact
  `e0eb...` digest.
- Fresh `bunx tsc --noEmit` passed, `bun run boundaries` passed with 64
  TypeScript files, the implementation commit diff was clean, and the review
  worktree remained clean at builder metadata head `3b40a81`.

The review session's WSL-backed `state.sh` could not launch because the host
returned `Bash/Service/CreateInstance/E_ACCESSDENIED`; branch, exact SHA,
governance tails and order state were therefore resolved directly with Git and
file reads. An extra `bun audit` attempt was network-denied and a junction-based
licence run enumerated zero packages; neither result is treated as proof or as
an Order 120 assertion. D-350's full standing/audit/licence/schema/referee
results remain builder evidence and are not relabelled reviewer-executed.

## Scope and residual status

Approval is exclusive to the immutable Bun and Valkey image references, the
unchanged PostgreSQL pin, and the filesystem-only fail-closed validator at the
exact executable SHA above. It closes only sealed Cyber finding
`supply-chain.mutable-container-tags`. Eleven sibling Cyber findings remain
open. Order 118 and Order 119 are not re-reviewed or claimed. This approval
does not merge, push, integrate or deploy the executable SHA.
