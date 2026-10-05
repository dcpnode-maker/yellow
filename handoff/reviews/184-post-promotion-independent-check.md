# Order 184 — independent post-promotion operational check

**Verdict:** NOT APPROVED — browser matrix unavailable in this session
**Product checked:** `3cffb5fa3254d951d6130dff597f5d616b15c2a1`
**Governance checked:** `f1f767ec6506120621dc680fbb00211f0a911692`
**Expected runtime image:** `sha256:10004705c51d569aa2a3dde40c55dc1f2ed03a6e1d20dcc1c5f5b1562f8cf2cc`
**Reviewer:** independent non-implementing OpenAI Codex
**Date:** 2026-08-26

## Reproduced read-only evidence

- Exactly one app publishes loopback port 3000: `yellow-local-current-app-1`; its
  image digest exactly matches the expected digest. Port 3002 is unbound.
- `GET /health` returned HTTP 200 with exactly `{"status":"ok"}`.
- Served `/assets/operator.css` returned HTTP 200 and contained all sixteen theme
  markers, backdrop fallback, reduced-motion and forced-colors rules. Served HTML
  exposed all sixteen theme values and the theme selector.
- One protected founder login succeeded without printing credentials. The authenticated
  property list returned exactly three properties. Reservation-board and system-status
  reads returned HTTP 200 for all three properties; a reservation confirmation read
  returned HTTP 200.
- Read-only database counts were 2,193 reservations, 25 folios and 25 journals;
  Valkey returned `PONG` and database size 0. No writes, restarts or service changes
  were performed.

## Unexecuted evidence and boundary

No browser-control tool was available. Therefore desktop/mobile viewport, 200% zoom,
overflow, focus, console, reduced-motion rendering, forced-colors rendering and
glass fallback could not be personally executed. A subsequent login was rate-limited
HTTP 429, so a second authenticated folio statement probe was not counted. Signing-key
rotation was not exercised. This is a non-approval of this check, not a replacement
for the separately recorded browser approval.
