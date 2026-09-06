# Question202 — Free-host ARM64 compatibility proof

**Status:** ADMITTED technical preparation under Order442, not a deployment.
**Date:** 2026-09-06. **Owner:** Codex coordinator.

The founder requested free hosting. OCI's recommended Always Free A1 target is
ARM64, but Yellow currently publishes only amd64 images. Before any cloud action,
prove the existing application and migration image on an actual ARM64 runner.
This runs alongside Order440; it does not replace its full fiscal/database gates.

## Exact scope

```text
handoff/questions/202-free-host-arm64-proof.md
handoff/orders/442-host-recovery-and-merged-local-review.md
.github/workflows/ci.yml (one additional free-host-arm64 proof job only)
tests/free-host-arm64.test.ts
docs/RECOVERY.md
docs/PROJECT-STATUS.md
DECISIONS.log
handoff/LEDGER.md
```

Use the standard `ubuntu-24.04-arm` hosted runner, contents-read permission and
the already pinned actions, Bun, Docker images and frozen dependencies. GitHub
confirms standard hosted runners are free for public repositories; Yellow's
repository visibility was verified public. No larger/self-hosted runner, paid
service, QEMU emulation, package publication, credentials or cloud provisioning.

Reuse the supported launcher to prove real migrations, canonical referee11/11,
database-backed readiness and synthetic login. Assert the runner is aarch64 and
both built image targets are linux/arm64. Run only within the isolated CI job;
stop its own Compose project on every outcome. Never run Docker/WSL on the laptop.
No database version, source bytes, dependency pins, product behavior, migration,
release-publishing gate, or stable local app change is authorized.

The new job needs actual clean execution at its exact commit before compatibility
is claimed. A green result is staging preparation, not OCI account access, capacity,
deployment, sustained reliability, production approval or Phase7 completion.
Cloud activation still requires the founder's account verification and a separately
scoped target/credential/TLS/private-database/backup deployment plan.

## Evidence

- [GitHub runner availability and public-repository pricing](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
- [Docker native-platform CI guidance](https://docs.docker.com/build/ci/github-actions/multi-platform/)
- Permanent workflow tests must fail before the new job exists and pin native
  architecture, exact identity, launcher/referee/login reuse, read-only permissions,
  frozen dependencies, bounded execution and cleanup. No new paid dependency.

If any pinned dependency lacks ARM64 support, record the exact failure; do not
silently remove its digest or substitute an unreviewed image/runtime.
