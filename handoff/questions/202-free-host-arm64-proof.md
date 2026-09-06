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
requirements-ci.txt (same-version CPython3.12 manylinux ARM64 wheel hash only)
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

## Exact portability repair admission

Job101423353740 in CI34009685141 failed before image/database work: pip selected
the supported psycopg2-binary2.9.12 CPython3.12 manylinux aarch64 wheel, but the
requirements file allowed only the x86_64 wheel hash. Root retrieved the exact
completed job log and independently checked PyPI's2.9.12 release JSON: both files
are non-yanked, with unchanged x86_64 hash9fe06d93e72f1c048e731a2e3e7854a5bfaa58fc736068df90b352cefe66f03f
and ARM64 hash40e7b28b63aaf737cb3a1edc3a9bbc9a9f4ad3dcb7152e8c1130e4050eddcb7d.
Admit only that additional exact wheel hash and a permanent two-hash regression.
No package version change, source build, hash bypass, unpinned dependency or laptop
installation. Hosted pip must independently hash the actual downloaded bytes on
the next run. [PyPI release metadata](https://pypi.org/pypi/psycopg2-binary/2.9.12/json)
is the hash source; the failing job's observed digest independently matches it.
