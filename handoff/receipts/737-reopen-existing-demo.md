# Receipt737 — existing public founder preview reopened

26 September2026 IST. Founder asked “start live app”. Root reopened only the
existing `yellow-public-demo-tunnel`, with the reviewed startup helper:

`./scripts/start-yellow-existing.ps1 -Start -ReadinessTimeoutSeconds 45`

The helper validated all four existing project/service identities and loopback
3010 binding. App/PostgreSQL/Valkey were already healthy and were not restarted,
rebuilt, recreated, seeded or migrated. Tunnel start time reported by Docker:
2026-09-25T19:00:15.612368249Z. Fresh logs confirm registered QUIC connection.

Current temporary URL:
https://versus-village-florence-turns.trycloudflare.com/

Founder page:
https://versus-village-florence-turns.trycloudflare.com/p/6081b544-22a1-534f-a86d-bb1ae0519e14/today

Local: http://127.0.0.1:3010/

## Personally verified

- Local shell/health200; protected properties without bearer401; normal demo login
  and property GET succeed with only the same nine known seed/review property IDs.
- Public HTTPS shell/health200. Unauthenticated protected properties401. Normal
  demo authentication, authenticated properties GET and reservation-board GET200;
  the board returned10 rows. No reservation/folio/other business write submitted.
- Public main JS `index-DusA4ysm.js` and stylesheet `index-C9ZASg81.css` both200.
- The laptop's ordinary resolver initially reported no such host. Direct DNS
  query to1.1.1.1 returned104.16.231.132/104.16.230.132. Public HTTPS proofs used
  curl's per-request `--resolve` with that observed answer; normal TLS hostname
  and certificate verification remained enabled. No system DNS/proxy/hosts-file
  setting changed. This proves the tunnel/HTTPS route, not universal DNS readiness.
- Open-in-Codex queued the current public founder page in this thread.

Unchanged exact container IDs:

- app8b4fc709f1efd64b01027bebe9deb8f22b5871d641ec2d301ed1770d710e766f;
  image34b83ec68987a308c9c46626cdcfbc97ea542209524d6bdb6b669b21d3eeb0dd.
- PostgreSQL0ea61af6cb9e0924220ab90986a63c2b6057a1201de38315c7f90ff5f59e219b.
- Valkey781c68656c437bf39a2428838b7ebcdd8bbc0f52dcb88c1a6babf084991dea9b.
- Existing tunnel05de34b600122b164f7967397d4e6071a0c26d3d4b526fad17843557ca721172;
  only its state changed from exited to running.

## Explicit limits

Independent read-only audit by `folio_history734` confirmed that prior demo policy
permits reopening this same synthetic full-functional preview at founder request,
while forbidding a production-ready claim. The method named ReadOnlyDemo does NOT
strip write scopes: demo users retain governed operations against synthetic data.
No credential values were printed or changed.

Local `/ready` remains503 `build_revision_unavailable`, frontier101. Existing
serving database role inheritance drift remains unresolved. Neither was bypassed,
repaired or hidden by this startup. No production release, new build, whole-app
completion, permanent URL, live market-data feed or reliability guarantee.

State ritual: state.ps1 read current lifecycle then failed its native probe stream
cleanup check. Direct named Docker/HTTP evidence above was used; the diagnostic
script was not changed. No application source changes or fresh CI/referee proof
were required or claimed for restarting this one existing demo tunnel.

Rollback if needed: stop only the exact tunnel container above; keep app/database/
cache untouched. The preview is intentionally left running for the founder.

## Later same-day tunnel recovery

The versus-village address expired (Cloudflare530/originDNS error). On the renewed
founder request root restarted only the exact existing tunnel at
2026-09-26T06:15:07.690909376Z. New URL:
https://leasing-computed-social-instance.trycloudflare.com/
Normal-resolver public `/health`200 and local3010health200 were subsequently
verified. This supersedes the earlier temporary URL, not the app/release limits.
