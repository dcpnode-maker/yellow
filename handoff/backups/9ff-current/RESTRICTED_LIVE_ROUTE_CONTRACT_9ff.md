# Yellow restricted live route — controller handoff

Laptop session `01a0ecbc-469b-7671-b1d1-d3e6bab40c98` owns source integration and acceptance. Cloud owns the reviewed image/runtime lane. This is an executable acceptance contract; no endpoint has been deployed by this document.

## Ready inputs

- Reviewed cloud source: `9ff27ad8765dc75ebae9e083d4635c7a9b89fa62`, tree `4311a79c0c9ffc33877809162b1b38ae1b3c944a`; PR 98 is draft and unmerged. Run 36842043047 passed all six required gates. Laptop independently reported fetching and verifying this head.
- Local managed runtime image: `sha256:103cafd6ad6ca67c8ba4b41098c09cd325d3ac705e4867707b9f9ec49f9dc1f0`, linux/amd64, Bun 1.3.14, runtime user bun. This is an image ID, not an OCI registry manifest digest. `RepoDigests` is empty. No container running this image exists.
- Root executed the image version and source audit: all 272 runtime source files match Git. Only the frozen dependency install receives a managed BuildKit CA secret. No authority/config/session-CA files are in the image. Build scripts, order and receipts are on the artifact-only branch, commit `eb68e4f5d88a4b140f1420156fec8ee1d8e9e03f`.
- Existing VM-local synthetic app: revision `937912cc0546bfe7b7cd8b3c082f8ef798c20e5b`, image `sha256:35f7d5d121eec9ae34ad1c991bc40bc6474939610938a29383ecd30b65b63c8f`, exact container `fe96ec05f4db113a5935c0d7e0f38aa6445b9ca16995c073195e399edcea4599`. Current health/readiness are 200; readiness frontier 100. It is older and has not been promoted as the latest tester release.

## Exact controller input required

1. **Integrated release identity:** the controller-accepted immutable commit and tree that combine the cloud stack with accepted laptop portfolio/property-mode/HK work; all changed paths, relevant proof receipts and generated-asset manifest. A reviewed isolated testing commit is sufficient; main-branch merge is not a prerequisite. Do not export the whole desktop or overwrite dirty source. If not committed, first produce a controller-owned source archive plus complete path/byte/hash manifest and exact base identity.
2. **Data/config authority:** identify whether this restricted release uses the retained synthetic test dataset or a controller-selected business dataset. Supply only nonsecret endpoint/database/ledger identities and secure runtime binding names here. Keep one writer authority and the matching migrations/checksums. No migration 0101 is present in this cloud stack; local unpromoted 0101 must not be silently combined or renumbered. Retain data/config backups on the laptop and a restore receipt before claiming recovery from instance deletion. Do not seed/reset retained data or attach a second business writer.
3. **Supported origin transport:** a provider-supported secure origin binding to the app's loopback listener, or a controller-configured named Cloudflare Tunnel/private service binding supported by this runtime. Required nonsecret fields: transport type, binding ID, app ingress rule, connector instance/health, origin scheme/host/port, allowed hostnames, and rejection behavior for unmatched ingress. Tunnel secret material must use a managed runtime secret/file binding; send its binding name, never its value or Windows OAuth vault. Current cloud status has no such binding.
4. **Distinct protected front door:** actual Yellow hostname/Workers name, deployed routing revision, Access application ID/audience, identity provider, allowed tester identities/group, and verified default-deny policy. Proposed `yellow-live.yellow-dcpnode-1676cc6f.workers.dev` is not deployed. Do not use the phone coordinator hostname, Durable Object, admin token or queue. Apply the gate to assets and APIs, including previews; retain Yellow staff authentication and tenant/property permissions inside it. No automatic demo login or embedded synthetic staff credentials on this route.

## Supported Cloudflare front door and constraints

Official Cloudflare docs explicitly support Access protection of a Worker's production `workers.dev` hostname without a custom domain. Protecting the whole Worker also covers its associated routes and previews. A separate Worker may therefore provide the stable restricted front door. It must forward to an actually reachable, securely bound origin; it cannot run Yellow's current Bun/PostgreSQL runtime by itself.

Account `1676cc6f7dc7847cfd92a6a07aa70dcd` and subdomain `yellow-dcpnode-1676cc6f.workers.dev` are laptop-verified. Existing laptop OAuth has worker write scopes but no reported Access/tunnel administration scope. The laptop account owner must establish those controls through legitimate authorized configuration; cloud will not extract credentials or use the posted password. No paid hosting fallback is authorized.

Current cloud environment status (spec 127, observations current) reports HTTP network access and no capabilities, secret/runtime bindings or outbound identities. Managed policy has no TCP domain/IP grants and no VPN. Cloudflare Tunnel requires outbound TCP 7844 for HTTP/2 or UDP 7844 for QUIC. A named tunnel token alone does not establish that permitted egress. Obtain a provider-approved binding/grant before connector launch; do not bypass the managed proxy/policy or try an unapproved direct-network workaround. Keep all app/DB/cache/debug/metrics/admin listeners private.

## Cutover and executable acceptance

Run these in dependency order on the controller-selected release. They are acceptance requirements, not completed claims.

1. Verify commit/tree, image revision and generated static assets; preserve exact source/config recovery and migration ledger evidence. Build the integrated source with `YELLOW_BUILD_SHA` set to its actual commit. Never relabel the 9ff image as the integrated laptop release.
2. Drain the prior app and its workers before enabling the replacement against the same dataset. Keep an exact rollback receipt. Do not run duplicate hold-expiry/projection/arrival/departure/fiscal writers. No production migration, seed or real payment call is part of this first hosting handoff.
3. Start the accepted image on a loopback/private app port with the approved runtime role, bounded pool/worker settings and securely bound configuration. Verify `/health` 200 and `/ready` 200 with the exact accepted revision, target database and expected frontier/checksums. A 503 or revision mismatch blocks promotion.
4. Verify real signed staff login, an authorized property operation, anonymous API denial, cross-tenant/property denial, same-token grant revocation and server-enforced role differences. Check completed source/assets against the accepted release. Browser proof must target this serving release, not a separate old process.
5. Configure the distinct protected route. From an external client, prove anonymous and unlisted testers are denied; an allowed tester can sign in and use the app; direct-origin and preview bypasses fail; altered Access headers do not grant access; Yellow bearer/RLS checks remain enforced. Prove requests cannot reach DB/cache/debug/admin listeners or serve `.git`, `.env`, private config, server source or source maps.
6. For APIs and authenticated data use no-store; permit only accepted static-asset cache rules. Verify mutating methods, request body limits, upstream Host/TLS checks, redirects and any required streaming/WebSocket behavior. Do not proxy arbitrary user-selected upstreams. Keep secrets/tokens/guest data out of routing logs.
7. Exercise bounded app/connector restart and recheck release/readiness/auth. Record the actual process policy and VM lifetime limits. Prove an off-host restore before making deletion-resilience claims. Publish the literal URL only after the external restrictions and serving-revision checks pass.

The sandbox has no verified always-on lifetime guarantee. Its current app restart policy is `no`; PostgreSQL storage is VM-local. Source artifacts are recoverable; business-data/config recovery remains unproven. A protected stable URL does not change these facts.

## Official primary documentation

- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/workers/configuration/routing/workers-dev/
- https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/tunnel-with-firewall/
- https://developers.cloudflare.com/tunnel/configuration/

