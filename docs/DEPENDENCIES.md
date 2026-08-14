# DEPENDENCIES.md — third-party risk register

The rule: **nothing in the critical path may be revocable by a vendor's decision.**
Every dependency is Class A (eliminate), Class B (replaceable — keep behind an
interface), or Class C (irreducible — legitimate, contracted, no bypass).

## The lesson that sets the standard: MinIO

MinIO was open source (AGPLv3) the whole time and still rug-pulled its users:
admin console stripped from the community edition (2025), binary distribution
stopped, repo archived February–April 2026, source-only, no patches. Anyone who
built backup storage on it now maintains a fork or migrates under pressure.

**So "open source" is not the test.** Three tests are:
1. **Permissive licence** (MIT / Apache-2.0 / BSD / PostgreSQL) for anything we embed.
2. **Governance that isn't one company** — foundation-backed or genuinely multi-vendor.
   Where the company *is* the commons, the commons can be withdrawn.
3. **Standard protocol** — if the interface is S3, SQL, SMTP, OCI-image, WireGuard,
   or VAPID, the implementation is swappable and the vendor is a config line.

Everything below is judged by those three, not by the word "free".

---

## Class A — eliminate (terms or rug-pull risk in our path)

| Risk | Verdict | Action |
|---|---|---|
| **Multiple OCI accounts to multiply free tier** | ToS violation; tenancies are network-isolated so it wouldn't work anyway; termination = losing production | Rejected permanently. Two tenancies (one per real founder), then revenue-funded Hetzner. |
| **MinIO for backup storage** | Archived, source-only, AGPL + aggressive enforcement history | Never adopt. Use **pgBackRest** (MIT) writing to any **S3-compatible** endpoint. |
| **Google Fonts hotlinked in our HTML** | Sends visitor IPs to a third party; EU courts have found this unlawful without consent. Found in our own mockup file. | **Fixed** — self-contained font stack; any webfont we later use is self-hosted from `/static/fonts`. |
| **cdnjs / any CDN-loaded JS in product surfaces** | Third-party runtime dependency + CSP hole + privacy leak | Bundle everything. CSP forbids third-party script origins (SECURITY.md §4). |
| **Docker Desktop** | Commercial licence above revenue/headcount thresholds | Use Docker Engine (Apache-2.0) or Podman. CI and servers never need Desktop. |

## Class B — replaceable (keep behind an interface; swap is config, not surgery)

| Currently | Risk | Open-source replacement | Cost of switching |
|---|---|---|---|
| Cloudflare Tunnel (ingress) | Free tier terms can change | **WireGuard** (GPLv2, in-kernel) + Caddy; **CrowdSec** (MIT) for IP reputation | Hours. DNS + one compose service. |
| Cloudflare Turnstile (bot defence) | Proprietary, phones home | **ALTCHA** (MIT, self-hosted, Argon2id proof-of-work, GDPR-clean) — verified current | Hours. Widget + verify endpoint. |
| Cloudflare edge (DDoS/CDN) | Free tier | *No true OSS equivalent* — see Class C | Keep as a **removable DNS layer**, never an architectural dependency. |
| R2 / B2 (backup target) | Vendor pricing/terms | Any S3-compatible: another provider, or self-hosted **Garage** / **SeaweedFS** (Apache-2.0) | Minutes — pgBackRest config. Keep ≥2 targets, one off-provider. |
| GitHub + Actions | Account/policy risk | **Forgejo** + Forgejo Runner (self-hosted); git is distributed by design | Mirror push from day one = insurance for ~₹0. |
| Grafana / Loki (AGPL) | Licence drift; AGPL network clause if ever modified | **VictoriaMetrics** + **VictoriaLogs** (Apache-2.0) | Dashboards rewritten; metrics keep flowing (Prometheus format). |
| Bun (MIT, VC-backed) | Future relicensing | MIT on released versions is irrevocable; code is standard TS → Node fallback | Only if they relicense; we'd pin the last MIT version meanwhile. |
| Claude API (paid tenant AI tier) | Vendor dependency in *our product* | Model gateway already abstracts it; **llama.cpp** + local models are the floor | Feature degrades, product doesn't break. |
| Piper voices | Some voices are CC BY-SA, not MIT | Ship only permissive/attribution-clean voices; verify per voice file | Voice selection, not code. |

## Class C — irreducible (no open-source bypass exists; stop looking)

- **A physical host.** Someone owns the metal. OCI free → Hetzner → AWS is a *cost*
  decision; portability (Docker Compose + Kamal, zero cloud-specific services) is the
  protection, and we already have it.
- **OTA demand** (Booking.com, Expedia). The marketplace *is* the product. Certified
  integration under their terms is the only path.
- **Payment rails.** Regulated. Token-only design keeps us out of PCI scope (SAQ-A);
  becoming a processor is a licensing project, not a coding one.
- **Government endpoints** — ZATCA, India IRP, e-FRRO, Alloggiati, SIBA, eVisitor.
- **UAE ASP.** Legally mandated accredited intermediary; in-house clearance is not
  permitted there.
- **Browser push services** (FCM/APNs/Mozilla). VAPID is an open standard; the
  endpoints are vendor-run and free.
- **A public CA.** Let's Encrypt (nonprofit) with ZeroSSL as fallback in Caddy.
- **Volumetric DDoS absorption.** Requires network capacity we cannot own. Mitigations
  we *do* own: CrowdSec, Caddy rate limits, ALTCHA on the booking engine, and the fact
  that PMS traffic is mostly authenticated and low-volume. Cloudflare stays as an
  optional shield, swappable by DNS.

---

## What we code ourselves (deliberately — small surface, maximum leverage)

Each of these replaces a SaaS dependency with code we own, and each is small enough
that we can maintain it forever:

1. **Event bus over the outbox** (cursor rows per consumer) — replaces NATS at v1,
   and a broker becomes an option instead of a requirement.
2. **Auth**: JWT + refresh rotation with reuse detection, `Bun.password` argon2id,
   TOTP MFA — replaces Auth0/Clerk. (We use vetted primitives; we never implement
   crypto ourselves.)
3. **Rate limiting**: token bucket in Valkey/PG keyed by IP + token — replaces
   edge-vendor rate limiting for the paths that matter.
4. **Fiscal + statutory adapters** — ZATCA, IRP, Alloggiati, SIBA, Form-C, eVisitor.
   Already the plan; each is one module behind a port.
5. **Backup/restore + drill scripts** around pgBackRest — the restore drill is the
   thing that makes a missing SLA survivable.
6. **Channel adapters** (Booking.com, Expedia direct) — replaces the channel-manager
   subscription for the volume that matters.

**Never build ourselves:** cryptography, a database, a TLS stack, a solver, a
compression algorithm, a font renderer. Adopting battle-tested code there is strictly
faster, safer, and cheaper — the rule is "own what differentiates," not "own everything."

## Enforcement (Phase 0 CI gates)

- `license-check` job fails the build on any dependency outside
  {MIT, Apache-2.0, BSD-2/3, ISC, PostgreSQL, MPL-2.0}. An exception requires
  an architect decision recorded in `DECISIONS.log` and an approved order.
- AGPL tools are permitted only as **standalone, unmodified, internal** services
  (never linked into our shipped code); each is listed with its swap target above.
- Lockfile committed; Renovate PRs; `bun audit` in CI.
- No third-party origins in CSP — enforced by a header test, so a CDN can't sneak in.
