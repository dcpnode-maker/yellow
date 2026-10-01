# RELEASE-20261001 — managed hosting build adapter

Laptop remains controller/final integrator. Source basis is published
9ff27ad8765dc75ebae9e083d4635c7a9b89fa62, tree
4311a79c0c9ffc33877809162b1b38ae1b3c944a. This is a build-only artifact lane,
outside the Yellow source working tree; no deployment, public route or database.

Observed: the previous one actual Docker build timed out at production Bun
installation. Its runner deliberately replaced the managed Docker config and
discarded inherited proxy/trust settings. Cloud runtime Docker guidance requires
preserving those settings and supplying the platform CA to networked build steps.
Clean-environment native Bun received no HTTP response; native Bun and curl with
inherited settings both return200 from registry.npmjs.org/elysia. No registry
outage, package-specific failure or policy-denial claim is established.

Finite scope: prepare a pure Git source archive of Dockerfile, .dockerignore,
package.json, bun.lock, src, scripts, migrations and public/yellow-next at9ff27ad;
one derived managed-build Dockerfile artifact; one bounded pauseable runner;
exact preparation/status/log/image receipts; this order and independent review.
No Yellow Git source edits. Preserve the original failed build and all preflight
receipts. Never replace HOME/CODEX_HOME, read credentials/config contents, weaken
TLS, bypass proxy/policy, use host networking, modify the daemon or auto retry.

Adapter changes ONLY the production-install RUN instruction: use a required
BuildKit proxy_ca secret mount and NODE_EXTRA_CA_CERTS for Bun. Exact original
bytes must be recovered by reversing that single adapter edit. Base image pin,
frozen production lockfile, user, stages, COPYs, CMD, labels and source are intact.
Use the managed Docker config/registry settings without reading or printing them;
clear only Docker endpoint/context/TLS selectors and target local socket. Supply
provided CODEX_PROXY_CERT as a file selector without reading or printing contents.
CA mounts must not enter image layers. Preserve inherited platform network guards.

Root reviews adapter/runner before one controlled300s build. On pause, stop only
owned CLI and retain source/receipts, no automatic resume. On success root must
personally inspect native image/revision/user, frozen input manifest and absence
of session CA/config files; version-only network-disabled temporary container is
allowed. Existing app identity must remain unchanged. Do not start app workers or
make database writes. This proves a managed build, not canonical-CI-byte-identical
image, current laptop portfolio integration, permanent hosting or recovery.
