# Exact receiving and hosting contract — 9ff release worker

Laptop session `01a0ecbc-469b-7671-b1d1-d3e6bab40c98` remains the controller, source reconciler and integration point. This is a bounded cloud handoff, not a competing source plan. CompSet Studio, phone coordinator/authentication, phone jobs and current laptop App/settings/portfolio/HK edits stay outside this order.

## Current source and image identity

- Reviewed cloud source: `9ff27ad8765dc75ebae9e083d4635c7a9b89fa62`; tree `4311a79c0c9ffc33877809162b1b38ae1b3c944a`.
- Laptop committed comparison base: `e06e400a57485cc10a8a35c21dcb1e01b5a667d1`; tree `a5237050fdf81a2d7eea1231318d3ccfb2908e1d`. Its extensive working changes are not represented by that commit.
- CI run [36842043047](https://github.com/dcpnode-maker/yellow/actions/runs/36842043047): all six required checks succeeded; PR98 is draft, open and unmerged. This establishes the tested 9ff source, not laptop integration or a public route.
- Prepared native image `yellow-managed:9ff27ad8765dc75ebae9e083d4635c7a9b89fa62`: config/image ID `sha256:103cafd6ad6ca67c8ba4b41098c09cd325d3ac705e4867707b9f9ec49f9dc1f0`; linux/amd64, Bun1.3.14, user `bun`, full source revision label. All 272 runtime source files were independently matched against Git. RepoDigests is empty; no image was pushed to a registry. Independently verified offline OCI manifest digest: `sha256:843b32dc43df5f7fc5c295c161adb146b4a057ac9d710083218093452362eaeb`; exact config and all11 compressed/uncompressed layer hashes match. `OCI_CONTENT_PROOF.json` records complete content evidence. The single export completed in about10seconds; archive201,482,240bytes, SHA-256 `9900ad842139dfa95ba128362af6a5754a4b93500e1f229123501319ce25ef5a`. An export digest is not an observed registry digest; the binary is local only and not yet retained by the laptop.
- No container has been launched from this image in this order. The existing isolated referee app is older `937912cc0546bfe7b7cd8b3c082f8ef798c20e5b`, image `sha256:35f7d5d121eec9ae34ad1c991bc40bc6474939610938a29383ecd30b65b63c8f`, loopback `127.0.0.1:53007`, restart policy `no`, synthetic VM-local PG18.6/frontier100. Its health/readiness200 and unauthenticated property401 are dated isolated evidence, not latest-release or public-live proof.
- Runtime lifetime/SLA, automatic restart after VM deletion and durable off-VM business/configuration backup are unverified. A Workers URL cannot supply those properties to its origin.

## Receiving the laptop's newer source

Use `PROTECTED_APP_API_HUNKS.json` and `RECEIVING_PLAN_9FF.md`: exact four cloud hunk preimages, new blobs, SHA-256, Git modes and source IDs. `receiving_inventory_classifier.py` is pure metadata and never applies files. Unknown laptop entries remain unobserved; guarded candidates still need actual-byte/mode revalidation and independent review. Preserve laptop-only files. Resolve diverged App/API hunks manually, including raw-body CRS parsing and the existing tenant wrapper, dependency constructor/barrel closure, physical offer siblings and departure-role filtering before the queue limit.

The controller reports 28 overlapping and 89 shared paths. Their exact inventory is missing here; these counts are not independently reconstructed. Request only the selected protected hunks, their direct compile/runtime/test closure, and metadata identity inventory described in the receiving plan. The laptop's accepted mode/portfolio/HK modules require an exact integrated commit/tree and canonical rebuilt frontend assets before the cloud can call its image the latest combined app.

Laptop migrations101/102/103 are accepted source according to the controller; exact bytes, source schema contract and database application are not supplied. Preserve those forward files and compare exact existing applied checksums. Cloud source ends at100; there is no cloud0101 collision. Never renumber, overwrite or blindly apply a historical migration.

`CURRENT_MIGRATION_FRONTIER=100` and `/ready` expected-frontier metadata are not a complete applied-ledger audit. The runtime catalogue/authority check does not itself certify an exact103 ledger. The integrated source must receive a governed frontier update and complete strict schema/authority proof against its exact migrations; old source proof cannot attest later schema. Request the controller's database identifier, applied filename/checksum ledger, strict schema capture and independent authority/readiness result. Database identifiers and checksums are sufficient; no database password, guest rows or credential file belongs in chat or GitHub.

## Domain-free restricted app route

Verified account `1676cc6f7dc7847cfd92a6a07aa70dcd`, workers.dev subdomain `yellow-dcpnode-1676cc6f.workers.dev`. Proposed app Worker `yellow-live` and `https://yellow-live.yellow-dcpnode-1676cc6f.workers.dev` are **not deployed or verified**. Existing `yellow-phone-coordinator` remains a separate phone-control Worker and Durable Object; no admin token, DO state, queue, source endpoint or credential is reused.

Supported documented route:

1. Create one dedicated Cloudflare Tunnel for the reviewed Yellow origin, with a securely bound connector token. No public hostname/ingress or custom domain is required for a Workers VPC service. Register one **HTTP VPC service** with one exact connector-reachable hostname and app port. Do not bind a VPC Network, subnet, raw TCP service, database, cache, Docker socket, debug or admin service.
2. Bind the service to a separate `yellow-live` Worker and forward requests to that fixed service. Never accept a caller-selected upstream URL/host/port; strip hop-by-hop and client-supplied forwarding/Access identity headers and set fixed origin host/protocol context. Keep Yellow's own login, tenant/property grants and command permissions. Hostname switching or an Access session must not grant Yellow data permissions. The exact forwarding implementation and origin reachability require focused tests; these docs are not deployed code.
3. Enable Cloudflare Access on the production workers.dev Worker, restrict it to an explicit tester allowlist using the selected identity provider, no bypass/public allow rule. Disable Worker preview URLs and separately check that previews/alternate routes cannot bypass protection. Disable caching of authenticated app/API responses; static assets may use the reviewed immutable policy. Do not expose development source maps, repository files, runtime secrets or provider admin APIs.
4. Observe connector health, authorized external login/asset/API use, unauthenticated denial, non-allowlisted denial, no origin bypass and Yellow cross-tenant/property denial. Compare response/build asset identity to the exact integrated release and independently audit the applied migration ledger. A route should deny/fail closed while its origin is unavailable. Only then send the user its verified app link.

Workers VPC requires **QUIC over outbound UDP7844** (cloudflared `auto`/`quic`); Tunnel HTTP/2 over TCP7844 does **not** satisfy this VPC route. Current managed cloud has no verified QUIC/UDP capability, connector credential binding or egress rule. Environment status spec162 reports running/connected, empty capabilities/secrets/runtime variables/outbound identities. The local managed TCP policy has empty allowed domains/IP ranges. HTTP access through the inherited proxy is not proof of UDP7844 transport. Do not run a direct/proxy bypass, host-network workaround, unrelated tunnel, phone coordinator relay or public raw-source endpoint.

The laptop's reported OAuth lacks Connectivity Directory/Access/Tunnel permissions. A controller-authorized provider role/permission is needed: Connectivity Directory Admin to register the service, and Directory Bind (or Admin) to bind it, plus the specific tunnel and Access administration rights. Keep laptop OAuth in its Windows credential manager; configure provider resources from that authorized laptop and bind only the dedicated connector token through the cloud host's managed secret mechanism. No password/token value is requested here.

Minimum **nonsecret** provider handoff: dedicated tunnel ID/name, VPC service ID/name and fixed target host/port, Worker name/verified hostname, Access application ID and tester-policy description, preview policy, connector health plus runtime-supported outbound QUIC/UDP7844, and the managed secret **binding name**. Loopback target support has not been verified; test the exact connector-local target under the supported service configuration rather than assuming a Cloudflare-hosted localhost target works. Do not add direct internet origin ingress to compensate.

Official documentation:

- [Access protection for Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)
- [workers.dev routing](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
- [Workers VPC tunnel requirements](https://developers.cloudflare.com/workers-vpc/configuration/tunnel/)
- [Fixed HTTP VPC services](https://developers.cloudflare.com/workers-vpc/configuration/vpc-services/)
- [VPC service API](https://developers.cloudflare.com/workers-vpc/api/)
- [Wrangler VPC commands and roles](https://developers.cloudflare.com/workers-vpc/reference/wrangler-commands/)
- [Private API example](https://developers.cloudflare.com/workers-vpc/examples/private-api/)

Workers VPC is beta and documented free during beta; this is not a perpetual free-hosting promise. Verify actual account plan, available included quotas and permissions. No paid service/domain fallback, emergency-credit use or automatic purchase is authorized for this lane.

## Launch, data authority and recovery

`LAUNCH_SPEC_9FF.json` is an exact proposed specification, not an executed deployment. Before origin cutover, the controller selects the accepted integrated source/image and one authoritative database. Do not seed/migrate/reset the laptop's retained business database or create two active business writers. If the chosen dataset is the existing synthetic referee database, label the app synthetic; it is not real client onboarding or market-data pipeline proof.

Run as image user `bun`, publish only an app loopback port, leave database/cache private. `YELLOW_OPERATOR_WORKBENCH=1`, `HOST=0.0.0.0`, `PORT=3000`, and `YELLOW_OPERATOR_ALLOW_NON_LOOPBACK=1` are explicit container values. Use the image's existing `bun run start` command; package start runs `bun src/server.ts`. Mount only externally provided runtime/registrar credentials and token secret using a reviewed private configuration, with no deployer credential or Docker/admin socket in the app. Do not infer nonloopback authority from a ribbon/UI flag. Disable automatic demo login/prefill and payment/provider operations in the restricted test route. Yellow Next's UI shell remains served; Access must protect that shell and API together.

When workbench is enabled, the actual server requires **all three** bindings: `YELLOW_RUNTIME_DATABASE_URL`, `YELLOW_EXTENSION_REGISTRAR_DATABASE_URL`, `YELLOW_TOKEN_SECRET`. The registrar URL is not optional just because its UI is unused. Use exact `yellow_runtime`/`yellow_extension_registrar` users and current URL validation. Values stay outside this artifact. This initial launch specification explicitly sets all six operational worker flags to0, pending source/data authority and a single-worker cutover; it does not claim task automation is active. Drain old worker processes before the controller enables the existing hold-expiry/projection/pickup/arrival/departure/business-day workers on the selected dataset; preserve cursor/idempotency/outbox semantics, and establish one worker owner. Record exact final0/1 values and execute startup/cursor/idempotency proof before claiming operational background work. Fiscal delivery stays0. No new queue/task database or automatic schedule is added.

Existing role contract remains authoritative:

| Role | Required boundary |
| --- | --- |
| `yellow_deploy` | Offline deployment administrator; current migration0015 contract requires LOGIN/SUPERUSER. Never mount its credential in the running app or weaken historical migrations to pretend otherwise. |
| `yellow_owner` | NOLOGIN, connection limit0, no password, NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOINHERIT/NOREPLICATION/NOBYPASSRLS. |
| `yellow_runtime` | LOGIN, connection limit-1, external password, NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOINHERIT/NOREPLICATION/NOBYPASSRLS; tenant-scoped transactions and internal role authority. |
| `app_role` | Internal NOLOGIN, connection limit0, no password, nonprivileged. Historical0001 LOGIN is corrected by0015; do not attest a historical prefix as current role authority. |
| `yellow_extension_registrar` | LOGIN, connection limit4, external password, NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOINHERIT/NOREPLICATION/NOBYPASSRLS; zero role memberships and no owned database objects, dedicated server URL. Preserve migration0018's catalogue checks. |

A named PG volume survives ordinary container recreation, not VM deletion. Current VM volume is ephemeral; the user accepts that limit but requires copies on the laptop/GitHub. Retain code/order/proof history in GitHub and laptop verified Git backups. **Never put database dumps, configuration secrets or guest/business data in GitHub.** Business/configuration recovery must use encrypted private off-host laptop storage and a tested isolated restore. A source-only Git bundle does not back up data/configuration.

The controller must record exact database identity, role boundary, applied ledger, private backup location/time/hash, encryption/config-recovery ownership and an executable restore receipt. Preserve owners/ACL/RLS in logical dumps and recreate reviewed roles in the isolated restore; `--no-owner`/`--no-acl` alone cannot demonstrate complete recovery. Keep global credentials/hashes private. Restore to a disposable non-serving database, compare ledger/checksums, strict schema, constraints/functions/views/grants/RLS, journal/outbox/cursor integrity and controller-selected business row counts/hashes; exercise read/authorization and a synthetic transaction. Do not attach the restored test database to live workers. No actual business backup/restore has been performed in this order.

Hosting all authoritative data only on the laptop would keep the app dependent on laptop uptime. To meet the founder's laptop-restart goal, the controller must explicitly choose a supported independent origin/database plus off-host restore ownership and coordinated writer cutover. Exact RPO/RTO, restart-after-process-failure proof, cloud lifetime and deletion recovery remain open until observed. Proposed `unless-stopped` restart policy is not proof of current restart behavior.

## Stoppable execution

Image export is one owned, local, read-only job with a300second deadline, a fresh directory, exact process-group cancellation and checkpoints; no automatic retry or network dispatch. Root independently executes both bounded helper proofs and actual image hashing. At a laptop plan-quota<=1% notice, stop new calls/jobs, cancel owned workers and preserve these receipts. No cloud usage-limit reader is available; founder's explicit laptop-monitor instruction governs continued bounded work. No account-credit fallback/reset/resume.
