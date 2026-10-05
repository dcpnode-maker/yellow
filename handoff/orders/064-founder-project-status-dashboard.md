# Order 064 — Founder project progress and live system-health dashboard

**Phase:** 3 · Founder visibility before rates implementation  
**Branch:** `phase-3/founder-status-dashboard`  
**Tier:** 2 — authenticated read-only operational visibility; no business-state mutation  
**Written by:** OpenAI Codex, autonomous temporary architect under D-95/D-115/D-221/D-231

## Outcome

Give the founder a permanent, graphical page inside the localhost Yellow workbench that clearly
separates current live service checks from the last committed build/review snapshot. The page
must answer “is the local app usable, where is the build, and what still lacks independent
review?” without scraping GitHub, shipping repository internals, or painting unknown services
green.

## Scope

- `src/project-status.ts`
- `src/http/operator.ts`
- `src/app.ts`
- `src/server.ts`
- `src/http/operator/index.html`
- `src/http/operator/operator.js`
- `src/http/operator/operator.css`
- `tests/founder-status.integration.test.ts`
- `tests/operator-workbench.integration.test.ts`
- `docs/LOCAL-REVIEW.md`
- `handoff/orders/064-founder-project-status-dashboard.md`
- `DECISIONS.log`
- `handoff/LEDGER.md`
- `handoff/GATE-3-MANIFEST.md`
- numbered D-92 question/response files if a hard-floor condition occurs

## Required implementation

1. Add a typed, immutable build snapshot containing all roadmap phases, the latest built order,
   the active phase, reviewed-vs-builder-unverified phase state, the Gate-3 review-debt count,
   and the mandatory referee expectation. Its labels must say “recorded snapshot,” not “live.”
2. Add a default-test drift assertion that derives the latest completed order and UNVERIFIED
   debt count from `handoff/GATE-3-MANIFEST.md` and fails whenever the runtime snapshot is stale.
   The runtime image receives only the typed snapshot, never `handoff/`, `.git`, credentials or
   GitHub state.
3. Add an authenticated, no-store, property-authorized read endpoint under
   `/api/v1/properties/{property}/system-status`. Reuse the existing availability-read property
   grant; add no permission. The active tenant transaction proves PostgreSQL reachability and
   tenant context. Return generic 400/401/403/503 failures through the established edge.
4. Report app and PostgreSQL as live checks with timestamps. Report each worker only as
   `configured` or `disabled` from its explicit runtime flag; do not infer successful polling.
   Report Valkey as `not_connected` and external CI as `not_connected` until real application
   integrations exist. Preserve exact DB-free `GET /health` behavior.
5. Add same-origin route `/p/{property}/status`, a Status navigation item, accessible progress
   bars/cards, phase timeline, service-health cards, proof/review debt explanation and manual
   refresh. Support both Apple and Pixel themes and existing responsive layouts.
6. Browser copy must explain that builder-green is not independent review, unknown/not-connected
   is not failure, and a green live database does not prove every feature. No automatic polling,
   browser persistence, external fetch, token logging or operational mutation.
7. Update the localhost walkthrough with the Status page, its evidence meanings and the fact that
   GitHub CI must still be read on GitHub until a governed integration exists.

## Forbidden

- Any file under `migrations/`, especially `migrations/0001_init.sql`
- `tests/run_invariants.py`, RLS, tenant middleware, occupancy, rate, restriction, journal,
  fiscal, compliance or state-transition behavior
- A new dependency, table, event, fact, permission, role scope, worker or background poll
- Changing `GET /health`, adding database/cache work to it, or exposing unauthenticated details
- Calling Docker, Git, GitHub, Compose, the filesystem or shell from the runtime HTTP request
- Copying `handoff/`, `.git`, Graphify outputs, secrets, environment values or CI tokens into the
  runtime image or response
- Claiming worker liveness from enablement, Valkey health without a client, CI status without a
  provider, or independent review from builder evidence
- Arbitrary percentages presented as completion. A progress bar must state its denominator and
  represent roadmap position/review state, not subjective confidence
- Auto-refresh, telemetry, external fonts/scripts/images, localStorage/sessionStorage/cookies,
  token persistence, `console.log`, mutation buttons or hidden POST requests
- Approval or merge by Codex

## Pre-registered proof

- **P0 (red first):** the focused test fails before production edits because the typed snapshot,
  status endpoint, route and workbench markers do not exist. Record the exact red output.
- **P1:** an authenticated granted-property request returns 200/no-store with exact typed snapshot,
  live app/database timestamps, current tenant-context confirmation, configured/disabled worker
  states, Valkey/CI `not_connected`, and no secrets or repository paths.
- **P2:** missing/malformed bearer is 401, missing availability scope and ungranted property are
  403, malformed property is 400, and transaction failure is generic 503; none leaks internals.
- **P3:** the manifest-derived test matches latest built Order 064 and exact UNVERIFIED count;
  temporary +/- one mutations to either snapshot field make it red and are restored byte-identical.
- **P4:** `/health` remains exact `200 {"status":"ok"}` with zero database reservation when the
  workbench is disabled; the runtime image still copies only package files, modules and assets.
- **P5:** HTML/JS/CSS expose graphical roadmap and review progress, live-vs-recorded labels,
  phase/service cards and manual refresh under both themes; static proof rejects forbidden
  storage, external fetch, auto-polling, shell/Docker/GitHub shortcuts and operational POSTs.
- **P6:** existing operator-workbench authentication, CSP, same-origin assets and theme proof stays
  green, along with frozen install, typecheck, boundaries, default tests, licence, audit, schema
  drift and protected hashes.
- **P7:** fresh isolated `./setup.sh --db-only` returns 11/11 with only PostgreSQL and Valkey
  services created; persistent localhost is rebuilt, login/status returns 200 and the founder can
  open the page without reseeding business data.

## Standing and handoff

Run P0 on a fresh migrations-plus-review-seed database before production edits. Run P1–P5 on a
fresh isolated database, intentionally mutate and restore only the two snapshot counters for P3,
then restart focused tests. Run the complete standing gate from the frozen lockfile and the fresh
app-never-started referee. Restore the persistent `yellow-phase-1` app with both existing workers,
refresh Graphify only for code changes, commit `[codex]`, push, open a draft stacked PR against
Order 063 and append one UNVERIFIED Gate-3 row. Do not approve or merge.


---

## MERGED

Prepared for the founder-authorized cumulative integration from exact reviewed frontier `bc22a9d`. This marker becomes true when the cumulative integration PR lands in `main`; review provenance remains in `handoff/reviews/` and `handoff/LEDGER.md`.
