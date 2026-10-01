# Cloudflare hosting path and current prerequisites

**Checked:** 2026-10-01 against Cloudflare's current developer documentation.
This is a design checkpoint only: no Worker, Tunnel, Access application, route,
database, credential, or deployment was created or changed.

## Finding

The existing Yellow Bun/Elysia plus PostgreSQL application cannot be placed on
Workers unchanged. Cloudflare Workers are a different runtime and deployment model.
Cloudflare Containers can run existing container images and custom runtimes, but
Containers require a Workers Paid plan and their disk is ephemeral by default.
Cloudflare documents snapshots and object-storage options, but these do not make
an unmodified PostgreSQL data directory a durable, backed-up production database.
Do not make the Container filesystem Yellow's system of record.

The nearest no-custom-domain option for a protected preview is an Access-protected
Worker on the account's existing `workers.dev` hostname. Cloudflare says enabled
`workers.dev` URLs are publicly reachable unless Access is configured. This path
can host a Worker implementation; it does not make the current Bun server or its
PostgreSQL instance run there. The supplied workers.dev hostname is
`yellow-dcpnode-1676cc6f.workers.dev`; the exact Worker route must be confirmed by
the account controller before use.

For the existing app and one authoritative PostgreSQL instance, the no-custom-domain
private path is an externally hosted VM/service connected through Cloudflare Tunnel
private networking, with authorized users connecting through the Cloudflare One
Client/WARP and Access policy. Private network routes do not provide a browser-only
public URL. A Tunnel public application route requires a domain connected to
Cloudflare; no custom domain is currently available. This makes private WARP access
the viable Tunnel design to evaluate until a domain exists.

## Current facts and boundaries

- Account ID: `1676cc6f7dc7847cfd92a6a07aa70dcd`. Reported workers.dev hostname:
  `yellow-dcpnode-1676cc6f.workers.dev`.
- `yellow-phone-coordinator` belongs to the phone lane and must not be reused for
  Yellow application hosting.
- No custom domain, named app Tunnel ID, running laptop `cloudflared` connector, or
  permanent app URL has been found.
- The laptop's Wrangler 4.145 OAuth credential is limited to user/account read and
  Workers write. It lacks connectivity administration and Pages, D1, KV, and route
  permissions; any tunnel/private-route and Access-policy configuration needs an
  appropriately authorized account operator. Keep that credential in the encrypted
  Windows vault; it is not portable to this Linux environment. No credentials are
  included here.
- Cloud's official `cloudflared` 2026.9.3 binary has a verified digest, but no
  connector has been started. The cloud environment has no TCP grants, VPN, secret
  bindings, or verified TCP/VPN route to the origin. This proves no currently
  verified supported public-origin/network grant; it does not establish that every
  possible HTTP proxy path is impossible. Origin exposure and outbound transport
  are unverified. No connector has started; a connector must run beside the chosen
  origin under its owner's control.
- The named VM currently reports a synthetic PostgreSQL database at schema/data
  frontier 100 and app build `937912cc0546bfe7b7cd8b3c082f8ef798c20e5b` with `/health` and `/ready` returning 200. The app listens on loopback port 53007; it is not a public listener. Its restart policy is `NO`; VM lifetime, durable storage, database backup, and tested restore are unverified. The user accepts VM ephemeral-deletion risk for hosting, but recoverable code and business data still require independent backup and tested restore. Treat current readiness as a smoke check, not a reliable always-on service or business-data destination.
- Laptop separately reports UI 42/0/626 across 11 files, typecheck exit 0, restored
  local execution, and phone Node/Android validation. Those results are not bound
  here to a Cloudflare receiving tree or live-serving revision. The laptop remains
  source owner and final integration controller. Its earlier migration-0101
  collision report was unconfirmed; the current cloud branch has 100 migrations
  and no 0101 file. The laptop's exact source and applied ledger remain for its
  controller to reconcile.

## Finite choices

| Choice | What it supports | Required conditions | Current status |
|---|---|---|---|
| Protected temporary preview on `workers.dev` | Browser access to a Worker without buying/configuring a custom domain; Access can gate a Worker production URL and preview/version URLs | Account operator confirms exact Worker hostname and configures Access before sharing it; deploy a Worker-compatible app. Keep data synthetic and non-authoritative. | Possible in principle. No Worker, Access policy, or preview is created; the existing app port is loopback-only and no Worker-to-origin binding has been verified. Current Workers-write scope alone does not establish Access-policy permission. |
| Private Tunnel route to the existing app | Laptop-authorized users reach a private origin without a public hostname or custom domain | Account operator creates a named Tunnel and private route; owner runs `cloudflared` beside the origin; configure Cloudflare One Client/WARP, private DNS if using a hostname, and Access policy. Verify connector supervision and reconnect behavior. | Best fit for private access to the existing app, but account admin, verified origin reachability, named Tunnel, and WARP setup are absent. No connector is running. |
| Public Tunnel application | Browser-only public hostname in front of an existing app, with Access authentication | A domain connected to Cloudflare, named Tunnel, origin route, and Access application/policy. Cloudflare notes the published route is public if Access is not set first. | Blocked by no custom domain and no Tunnel ID. Do not substitute another product's hostname or the phone coordinator. |
| Workers Containers | Run a Bun-based application image as a Container and call it from a Worker | Workers Paid plan (no expense authority); adapt/deploy the Worker and container; place PostgreSQL on a separately durable service with a verified protected network path, single-writer ownership, backups, and tested restore. | Not an as-is durable Bun+Postgres deployment. Container local disk is ephemeral by default, and the platform can stop a running instance. No plan upgrade or purchase is approved. |

## Staging versus always-on

A `workers.dev` Worker with Access can be a short-lived, synthetic-data preview
after the account operator sets the policy and the Worker implementation exists.
It is still internet-addressable behind authentication and should not be described
as private network hosting. The historic a0fecd9 front-end artifact remains a
separate source-bound receipt; no new frontend bundle has been generated or exported
for the current PR98 head.

Always-on private hosting of the existing application requires a VM/runtime with a
verified restart policy and durable volume (the user accepts the risk of ephemeral
VM deletion, but code/data recovery must still be proven), exactly one authoritative
PostgreSQL database, tested business-data backup and restore to the laptop, and a
Tunnel connector supervised at the origin. It also requires working private route, Access policy, and WARP client
for each authorized operator. Before any business-data use, the laptop controller
must validate the exact code revision, database ledger, backup/restore, and serving
identity. The current VM smoke result does not meet those conditions; business-data backup and tested laptop restore remain pending.

No new paid resource is selected or authorized here. Before any paid Workers plan,
VM uptime/storage tier, or other billable option is chosen, present the exact
provider plan, recurring and usage-based costs, limits, backup/restore procedure,
and an estimate for the expected test/prod footprint for explicit review. The
laptop's quota rule remains: stop/checkpoint at or below 1% PLAN remaining.

## Official Cloudflare documentation

These five primary documentation pages were checked on 2026-10-01:

1. [Workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/) — subdomain routing; Access protection; public-by-default behavior when enabled; custom-domain onboarding is not required for workers.dev.
2. [Cloudflare Tunnel overview](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/) — outbound-only `cloudflared` connector and private-network use.
3. [Add network routes](https://developers.cloudflare.com/cloudflare-one/networks/routes/add-routes/) — private CIDR/hostname routes use a Tunnel connector; private routes need client connectivity; published application routes require a domain connected to Cloudflare and are Internet-accessible unless Access is applied.
4. [Containers overview](https://developers.cloudflare.com/containers/) — existing container images/custom runtimes and Workers Paid plan requirement.
5. [Containers FAQ](https://developers.cloudflare.com/containers/faq/) — disk is ephemeral by default, snapshots are point-in-time, and platform events can stop a running instance without a guaranteed runtime period.
