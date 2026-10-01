# Independent transport review — 2026-10-01

## Finding

The fixed Workers VPC HTTP service proposal is **not runnable or verified with the managed environment as currently observed**. Current `cloud_environment.environment_status` is fresh (`observations_current: true`), connected/running at spec revision 178, with `capabilities`, `secrets`, `runtime_variables`, and `outbound_identities` all empty. The enforced HTTP policy is unrestricted. The read-only `/etc/codex/network-policy.json` snapshot separately reports `vpn_configured: false` and TCP proxy access with empty `domains` and `ip_ranges`.

This establishes a missing configured/observed transport path; it does **not** prove the platform fundamentally cannot support UDP. The status interface exposes no UDP capability/readiness field, and I found no managed-environment configuration tool in the available tool catalog. Thus the precise state is **UDP7844 availability and grant are unverified and not configured here**, not a categorical platform-wide “unsupported.” Unrestricted HTTP is only HTTP through the inherited proxy. It grants neither outbound UDP7844 nor any TCP destination grant. The laptop OAuth/login and the published Worker/image likewise do not establish transport from this cloud executor.

Cloudflare's [Workers VPC tunnel requirements](https://developers.cloudflare.com/workers-vpc/configuration/tunnel/) require the VPC connector tunnel to use QUIC over outbound UDP7844; HTTP/2 over TCP7844 is not a compatible fallback for this route. The managed networking reference says the executor has no general Internet route, the sidecar enforces access, and editing the local policy, direct connections, route changes, or unsetting the proxy cannot grant access. With no UDP grant/observation and no connector-token secret binding, the proposed origin-to-VPC leg cannot presently be established. No currently observed capability provides a supported substitute. Do not treat TCP proxying, the unrestricted HTTP proxy, a laptop session, or the phone coordinator as that substitute.

## 9ff image / synthetic-origin question

The supplied receiving contract records an offline-verified 9ff image, but also says no container was launched from it in this order. The available environment status contains no container/runtime capability or bindings, and the transport review made no launch. Therefore I cannot claim that this managed executor can launch the 9ff image as an owned loopback synthetic origin without changing the old service or business data. That question remains unproven; it needs a separate authorized runtime capability and an isolated launch plan/evidence. The current transport finding neither implies nor tests Docker support, loopback VPC target support, image availability in this executor, or database isolation.

## Exact controller/provider dependency

Before this route can be considered executable, the controller/provider needs to supply a supported and reviewable managed-environment path that answers all of the following:

1. Whether this runtime/provider supports outbound QUIC/UDP7844 for the dedicated cloudflared connector, and the exact supported capability/configuration workflow and destination scope. The result must be observable after apply; a local policy-file edit is not evidence or a grant.
2. The dedicated connector token's managed secret **binding name** and the supported secret-binding setup/review step. No value is requested. Current observed secret bindings are empty.
3. After setup, a fresh status/readiness record for the exact runtime, its UDP7844 capability/grant, and secret binding, plus connector health over QUIC. If the provider cannot supply this supported path, the Workers VPC design remains blocked in this environment; do not silently fall back to HTTP/2 or an improvised tunnel.

No provider or environment configuration has been made. No network probe, container launch, source/app/database/connector change, credential access, or external write was performed. The only public-doc retrieval attempt through the inherited HTTP path returned HTTP 403, so the official Cloudflare statements above are cross-referenced from the exact receiving/hosting contract rather than newly fetched in this review.
